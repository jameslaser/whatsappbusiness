-- James Laser Hair Removal for Men: admin portal, schema v1
-- Security model: only people listed in private.admin_users can read or write anything. No anonymous access at all.
-- Sending is manual (one-tap WhatsApp links); this database only prepares and records messages.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table private.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table private.admin_users enable row level security;
revoke all on private.admin_users from public, anon, authenticated;

create or replace function private.is_admin() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from private.admin_users where user_id = (select auth.uid())) $$;
revoke all on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated;

create or replace function private.touch_updated_at() returns trigger
language plpgsql set search_path = ''
as $$ begin new.updated_at = now(); return new; end $$;

/* ---------- areas (mirrors the WhatsApp catalog) ---------- */
create table public.areas (
  code text primary key check (code ~ '^[A-Z]+-[0-9]{2}$'),
  collection_ar text not null,
  collection_en text not null,
  name_ar text not null,
  name_en text not null,
  sort_order int not null default 0,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

/* ---------- clients and consent ---------- */
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (length(btrim(full_name)) between 1 and 120),
  phone text not null unique check (phone ~ '^[1-9][0-9]{7,14}$'),   -- digits only, country code first, e.g. 9665XXXXXXXX
  preferred_lang text not null default 'ar' check (preferred_lang in ('ar', 'en')),
  whatsapp_opt_in boolean not null default false,                     -- agreed to promotional messages
  opt_in_at timestamptz,
  opt_in_source text check (opt_in_source in ('in_clinic', 'whatsapp_chat', 'website', 'other')),
  opted_out_at timestamptz,
  notes text check (notes is null or length(notes) <= 500),           -- non-medical notes only
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint opt_in_needs_proof check (not whatsapp_opt_in or (opt_in_at is not null and opt_in_source is not null))
);

/* ---------- appointments / requests ---------- */
create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  area_codes text[] not null default '{}',
  status text not null default 'new' check (status in ('new', 'contacted', 'confirmed', 'done', 'cancelled', 'no_show')),
  scheduled_at timestamptz,
  notes text check (notes is null or length(notes) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint confirmed_needs_time check (status <> 'confirmed' or scheduled_at is not null)
);
create index appointments_client_id_idx on public.appointments (client_id);
create index appointments_status_idx on public.appointments (status);
create index appointments_confirmed_time_idx on public.appointments (scheduled_at) where status = 'confirmed';

/* ---------- message templates (reminder, pre/post instructions, custom) ---------- */
create table public.message_templates (
  code text primary key check (code ~ '^[a-z0-9_]{2,40}$'),
  kind text not null check (kind in ('reminder', 'pre', 'post', 'custom')),
  title text not null,
  body_ar text not null default '',
  body_en text not null default '',
  approved boolean not null default false,       -- nothing can be sent from a template until the clinic approves it
  approved_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint approved_needs_text check (not approved or (length(btrim(body_ar)) > 0 and length(btrim(body_en)) > 0 and approved_at is not null))
);

/* ---------- offers ---------- */
create table public.offers (
  id uuid primary key default gen_random_uuid(),
  title_ar text not null,
  title_en text not null,
  body_ar text not null,
  body_en text not null,
  starts_on date,
  ends_on date,
  approval_number text,
  status text not null default 'draft' check (status in ('draft', 'approved', 'withdrawn')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint offer_dates_ok check (starts_on is null or ends_on is null or ends_on >= starts_on),
  constraint offer_max_60_days check (starts_on is null or ends_on is null or (ends_on - starts_on) + 1 <= 60),
  constraint approved_needs_proof check (
    status <> 'approved'
    or (approval_number is not null and length(btrim(approval_number)) > 0 and starts_on is not null and ends_on is not null)
  )
);

/* ---------- message log (what was prepared and marked as sent) ---------- */
create table public.message_log (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  appointment_id uuid references public.appointments (id) on delete set null,
  offer_id uuid references public.offers (id) on delete set null,
  template_code text references public.message_templates (code) on delete set null,
  kind text not null check (kind in ('reminder', 'pre', 'post', 'custom', 'offer')),
  lang text not null check (lang in ('ar', 'en', 'both')),
  body text not null,
  status text not null default 'sent' check (status in ('prepared', 'sent')),
  created_at timestamptz not null default now()
);
create index message_log_client_idx on public.message_log (client_id, created_at desc);
create index message_log_appointment_idx on public.message_log (appointment_id);
create index message_log_offer_idx on public.message_log (offer_id);
create index message_log_template_idx on public.message_log (template_code);

/* Hard guard in the database: whatever the app does, these rules hold. */
create or replace function private.guard_message_log() returns trigger
language plpgsql set search_path = ''
as $$
declare
  c public.clients;
  o public.offers;
  t public.message_templates;
  today date := (now() at time zone 'Asia/Riyadh')::date;
begin
  select * into c from public.clients where id = new.client_id;
  if not found then raise exception 'client not found'; end if;

  if new.kind = 'offer' then
    if new.offer_id is null then raise exception 'an offer message needs an offer'; end if;
    select * into o from public.offers where id = new.offer_id;
    if not found or o.status <> 'approved' or o.approval_number is null or o.starts_on is null or o.ends_on is null
       or today < o.starts_on or today > o.ends_on then
      raise exception 'offer is not approved or is outside its approved dates';
    end if;
    if not c.whatsapp_opt_in or c.opted_out_at is not null then
      raise exception 'client has not opted in to promotional messages';
    end if;
  else
    if new.template_code is null then raise exception 'messages must come from an approved template'; end if;
    select * into t from public.message_templates where code = new.template_code;
    if not found or not t.approved then raise exception 'template is not approved'; end if;
  end if;
  return new;
end $$;
create trigger message_log_guard before insert on public.message_log
  for each row execute function private.guard_message_log();

/* updated_at */
create trigger areas_touch before update on public.areas for each row execute function private.touch_updated_at();
create trigger clients_touch before update on public.clients for each row execute function private.touch_updated_at();
create trigger appointments_touch before update on public.appointments for each row execute function private.touch_updated_at();
create trigger templates_touch before update on public.message_templates for each row execute function private.touch_updated_at();
create trigger offers_touch before update on public.offers for each row execute function private.touch_updated_at();

/* ---------- Row Level Security: admins only, nothing for anon ---------- */
do $$
declare t text;
begin
  foreach t in array array['areas', 'clients', 'appointments', 'message_templates', 'offers', 'message_log'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('create policy "admins only" on public.%I for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()))', t);
  end loop;
end $$;

/* ---------- seed: 22 areas from the WhatsApp catalog ---------- */
insert into public.areas (code, collection_ar, collection_en, name_ar, name_en, sort_order) values
  ('FACE-01', 'الوجه والرقبة', 'Face & neck', 'خط اللحية', 'Beard line', 10),
  ('FACE-02', 'الوجه والرقبة', 'Face & neck', 'الوجه كاملاً', 'Full face', 20),
  ('FACE-03', 'الوجه والرقبة', 'Face & neck', 'الرقبة (أمامية وخلفية)', 'Neck (front and back)', 30),
  ('FACE-04', 'الوجه والرقبة', 'Face & neck', 'الأذنان (الخارجية فقط)', 'Ears (outer only)', 40),
  ('FACE-05', 'الوجه والرقبة', 'Face & neck', 'الأنف (الخارجي فقط)', 'Nose (outer only)', 50),
  ('UPPER-01', 'الجزء العلوي', 'Upper body', 'الإبطان', 'Underarms', 60),
  ('UPPER-02', 'الجزء العلوي', 'Upper body', 'الصدر', 'Chest', 70),
  ('UPPER-03', 'الجزء العلوي', 'Upper body', 'البطن', 'Abdomen', 80),
  ('UPPER-04', 'الجزء العلوي', 'Upper body', 'الكتفان', 'Shoulders', 90),
  ('UPPER-05', 'الجزء العلوي', 'Upper body', 'الظهر كاملاً', 'Full back', 100),
  ('UPPER-06', 'الجزء العلوي', 'Upper body', 'أسفل الظهر', 'Lower back', 110),
  ('LIMB-01', 'الذراعان والساقان', 'Arms & legs', 'الذراعان كاملتان', 'Full arms', 120),
  ('LIMB-02', 'الذراعان والساقان', 'Arms & legs', 'نصف الذراع', 'Half arms', 130),
  ('LIMB-03', 'الذراعان والساقان', 'Arms & legs', 'الفخذان', 'Thighs', 140),
  ('LIMB-04', 'الذراعان والساقان', 'Arms & legs', 'نصف الساق', 'Half legs', 150),
  ('LIMB-05', 'الذراعان والساقان', 'Arms & legs', 'الساقان كاملتان', 'Full legs', 160),
  ('BOXER-01', 'منطقة البوكسر', 'Boxer area', 'خط البكيني', 'Bikini line', 170),
  ('BOXER-02', 'منطقة البوكسر', 'Boxer area', 'المنطقة الحساسة', 'Intimate zone', 180),
  ('BOXER-03', 'منطقة البوكسر', 'Boxer area', 'الأرداف', 'Buttocks', 190),
  ('BOXER-04', 'منطقة البوكسر', 'Boxer area', 'منطقة البوكسر كاملة', 'Full boxer area', 200),
  ('PKG-01', 'الباقات', 'Packages', 'باقة الجسم المصغّر', 'Mini body package', 210),
  ('PKG-02', 'الباقات', 'Packages', 'باقة الجسم كاملاً', 'Full body package', 220);

/* ---------- seed: message templates (all start NOT approved; the clinic writes and approves them in the portal) ---------- */
insert into public.message_templates (code, kind, title, body_ar, body_en) values
('reminder_24h', 'reminder', 'Appointment reminder',
 E'السلام عليكم {{name}}،\nتذكير بموعدك في {{clinic}}، Harmony Derma، الحمراء، الرياض:\n{{date}} الساعة {{time}}\nالمناطق: {{areas}}\nللتأكيد أو التغيير راسلنا هنا.',
 E'Hello {{name}},\nA reminder of your appointment at {{clinic}}, Harmony Derma, Al Hamra, Riyadh:\n{{date}} at {{time}}\nAreas: {{areas}}\nTo confirm or change it, reply here.'),
('pre_instructions', 'pre', 'Before your session',
 E'السلام عليكم {{name}}،\nتعليمات ما قبل جلستك:\n[تكتبها العيادة هنا ثم تعتمدها]',
 E'Hello {{name}},\nBefore your session:\n[The clinic writes this text here, then approves it]'),
('post_instructions', 'post', 'After your session',
 E'السلام عليكم {{name}}،\nتعليمات ما بعد جلستك:\n[تكتبها العيادة هنا ثم تعتمدها]',
 E'Hello {{name}},\nAfter your session:\n[The clinic writes this text here, then approves it]');
