-- Security test for the admin portal database (Supabase). Run each DO block on its own.
-- Each block builds fixtures, switches role with SET LOCAL ROLE (anon / authenticated, as the API does), records PASS/FAIL
-- lines, and ends by RAISING AN EXCEPTION on purpose so everything is rolled back. The report is in that error text.
-- Part A has no UPDATE or DELETE; Part B has them, each with a WHERE clause.

-- PART A: reads, inserts, constraints, message guard
do $$
declare
  r text := '';
  n bigint;
  t record;
begin
  -- fixtures (created as postgres inside this statement; everything is rolled back at the end)
  insert into auth.users (id, aud, role, email) values ('00000000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', 'admin-test@example.invalid'), ('00000000-0000-0000-0000-0000000000b2', 'authenticated', 'authenticated', 'other-test@example.invalid');
  insert into private.admin_users (user_id) values ('00000000-0000-0000-0000-0000000000a1');
  insert into public.clients (id, full_name, phone, created_at, updated_at) values ('00000000-0000-0000-0000-00000000c001', 'Fixture A', '966500000001', now() - interval '1 day', now() - interval '1 day');
  insert into public.clients (id, full_name, phone, whatsapp_opt_in, opt_in_at, opt_in_source) values ('00000000-0000-0000-0000-00000000c002', 'Fixture opted in', '966500000002', true, now(), 'in_clinic');
  insert into public.clients (id, full_name, phone, whatsapp_opt_in, opt_in_at, opt_in_source, opted_out_at) values ('00000000-0000-0000-0000-00000000c003', 'Fixture opted out', '966500000003', true, now(), 'in_clinic', now());
  insert into public.appointments (id, client_id) values ('00000000-0000-0000-0000-0000000a0001', '00000000-0000-0000-0000-00000000c001');
  insert into public.message_templates (code, kind, title, body_ar, body_en, approved, approved_at) values ('t_ok', 'custom', 'ok', 'نص', 'text', true, now());
  insert into public.offers (id, title_ar, title_en, body_ar, body_en, status) values ('00000000-0000-0000-0000-0000000f0001', 'a', 'a', 'a', 'a', 'draft');
  insert into public.offers (id, title_ar, title_en, body_ar, body_en, status, approval_number, starts_on, ends_on) values
    ('00000000-0000-0000-0000-0000000f0002', 'a', 'a', 'a', 'a', 'approved', 'T-1', (now() at time zone 'Asia/Riyadh')::date - 1, (now() at time zone 'Asia/Riyadh')::date + 10),
    ('00000000-0000-0000-0000-0000000f0003', 'a', 'a', 'a', 'a', 'approved', 'T-2', (now() at time zone 'Asia/Riyadh')::date - 30, (now() at time zone 'Asia/Riyadh')::date - 2),
    ('00000000-0000-0000-0000-0000000f0004', 'a', 'a', 'a', 'a', 'approved', 'T-3', (now() at time zone 'Asia/Riyadh')::date + 5, (now() at time zone 'Asia/Riyadh')::date + 20);

  for t in select * from (values
    (1,'anon','deny','anon cannot read areas',$q$select * from public.areas limit 1$q$,'42501'),
    (2,'anon','deny','anon cannot read clients',$q$select * from public.clients limit 1$q$,'42501'),
    (3,'anon','deny','anon cannot read appointments',$q$select * from public.appointments limit 1$q$,'42501'),
    (4,'anon','deny','anon cannot read message_templates',$q$select * from public.message_templates limit 1$q$,'42501'),
    (5,'anon','deny','anon cannot read offers',$q$select * from public.offers limit 1$q$,'42501'),
    (6,'anon','deny','anon cannot read message_log',$q$select * from public.message_log limit 1$q$,'42501'),
    (7,'anon','deny','anon cannot insert a client',$q$insert into public.clients (full_name, phone) values ('x', '966511111111')$q$,'42501'),
    (8,'anon','deny','anon cannot call is_admin()',$q$select private.is_admin()$q$,'42501'),
    (9,'anon','deny','anon cannot read admin list',$q$select * from private.admin_users$q$,'42501'),
    (10,'other','n','signed-in non-admin sees 0 rows of areas',$q$select count(*) from public.areas$q$,'n = 0'),
    (11,'other','n','signed-in non-admin sees 0 rows of clients',$q$select count(*) from public.clients$q$,'n = 0'),
    (12,'other','n','signed-in non-admin sees 0 rows of appointments',$q$select count(*) from public.appointments$q$,'n = 0'),
    (13,'other','n','signed-in non-admin sees 0 rows of message_templates',$q$select count(*) from public.message_templates$q$,'n = 0'),
    (14,'other','n','signed-in non-admin sees 0 rows of offers',$q$select count(*) from public.offers$q$,'n = 0'),
    (15,'other','n','signed-in non-admin sees 0 rows of message_log',$q$select count(*) from public.message_log$q$,'n = 0'),
    (16,'other','deny','non-admin cannot insert a client',$q$insert into public.clients (full_name, phone) values ('x', '966511111112')$q$,'42501'),
    (17,'other','deny','non-admin cannot insert an area',$q$insert into public.areas (code, collection_ar, collection_en, name_ar, name_en) values ('ZZ-01','a','a','a','a')$q$,'42501'),
    (18,'other','deny','non-admin cannot insert a template',$q$insert into public.message_templates (code, kind, title) values ('zz', 'custom', 'x')$q$,'42501'),
    (19,'other','deny','non-admin cannot insert an offer',$q$insert into public.offers (title_ar, title_en, body_ar, body_en) values ('a','a','a','a')$q$,'42501'),
    (20,'other','deny','non-admin cannot insert a log row',$q$insert into public.message_log (client_id, template_code, kind, lang, body) values ('00000000-0000-0000-0000-00000000c001', 't_ok', 'custom', 'ar', 'x')$q$,'42501,P0001'),
    (21,'other','deny','non-admin cannot read admin list',$q$select * from private.admin_users$q$,'42501'),
    (22,'other','n','is_admin() is false for a non-admin',$q$select (private.is_admin())::int$q$,'n = 0'),
    (23,'admin','n','is_admin() is true for an admin',$q$select (private.is_admin())::int$q$,'n = 1'),
    (24,'admin','n','admin sees the 22 areas',$q$select count(*) from public.areas$q$,'n = 22'),
    (25,'admin','n','admin sees the 3 seeded templates (+1 fixture)',$q$select count(*) from public.message_templates$q$,'n = 4'),
    (26,'admin','n','admin sees fixture clients',$q$select count(*) from public.clients$q$,'n >= 3'),
    (27,'admin','n','seeded templates start NOT approved',$q$select count(*) from public.message_templates where code in ('reminder_24h','pre_instructions','post_instructions') and approved$q$,'n = 0'),
    (28,'admin','deny','admin cannot read the admin list directly',$q$select * from private.admin_users$q$,'42501'),
    (29,'admin','ok','admin can add a valid client',$q$insert into public.clients (full_name, phone) values ('New', '966511111113')$q$,''),
    (30,'admin','deny','duplicate phone is refused',$q$insert into public.clients (full_name, phone) values ('Dup', '966500000001')$q$,'23505'),
    (31,'admin','deny','local-format phone 05… is refused',$q$insert into public.clients (full_name, phone) values ('x', '0551234567')$q$,'23514'),
    (32,'admin','deny','phone with plus sign is refused',$q$insert into public.clients (full_name, phone) values ('x', '+966551234567')$q$,'23514'),
    (33,'admin','deny','too-short phone is refused',$q$insert into public.clients (full_name, phone) values ('x', '12345')$q$,'23514'),
    (34,'admin','deny','empty name is refused',$q$insert into public.clients (full_name, phone) values ('  ', '966511111114')$q$,'23514'),
    (35,'admin','deny','promo consent without source and date is refused',$q$insert into public.clients (full_name, phone, whatsapp_opt_in) values ('x', '966511111115', true)$q$,'23514'),
    (36,'admin','deny','unknown language is refused',$q$insert into public.clients (full_name, phone, preferred_lang) values ('x', '966511111116', 'fr')$q$,'23514'),
    (37,'admin','deny','confirmed appointment without time is refused',$q$insert into public.appointments (client_id, status) values ('00000000-0000-0000-0000-00000000c001', 'confirmed')$q$,'23514'),
    (38,'admin','deny','unknown appointment status is refused',$q$insert into public.appointments (client_id, status) values ('00000000-0000-0000-0000-00000000c001', 'maybe')$q$,'23514'),
    (39,'admin','ok','confirmed appointment with time is accepted',$q$insert into public.appointments (client_id, status, scheduled_at) values ('00000000-0000-0000-0000-00000000c001', 'confirmed', now() + interval '2 days')$q$,''),
    (40,'admin','deny','approved offer without approval number is refused',$q$insert into public.offers (title_ar, title_en, body_ar, body_en, status, starts_on, ends_on) values ('a','a','a','a','approved', current_date, current_date + 5)$q$,'23514'),
    (41,'admin','deny','approved offer with blank approval number is refused',$q$insert into public.offers (title_ar, title_en, body_ar, body_en, status, approval_number, starts_on, ends_on) values ('a','a','a','a','approved','   ', current_date, current_date + 5)$q$,'23514'),
    (42,'admin','deny','approved offer without dates is refused',$q$insert into public.offers (title_ar, title_en, body_ar, body_en, status, approval_number) values ('a','a','a','a','approved','N-1')$q$,'23514'),
    (43,'admin','deny','offer longer than 60 days is refused (61)',$q$insert into public.offers (title_ar, title_en, body_ar, body_en, starts_on, ends_on) values ('a','a','a','a', date '2027-01-01', date '2027-03-02')$q$,'23514'),
    (44,'admin','ok','offer of exactly 60 days is accepted',$q$insert into public.offers (title_ar, title_en, body_ar, body_en, starts_on, ends_on) values ('a','a','a','a', date '2027-01-01', date '2027-03-01')$q$,''),
    (45,'admin','deny','offer ending before it starts is refused',$q$insert into public.offers (title_ar, title_en, body_ar, body_en, starts_on, ends_on) values ('a','a','a','a', date '2027-01-10', date '2027-01-01')$q$,'23514'),
    (46,'admin','deny','approved template with empty Arabic text is refused',$q$insert into public.message_templates (code, kind, title, body_ar, body_en, approved, approved_at) values ('bad1','custom','x','','text',true,now())$q$,'23514'),
    (47,'admin','deny','approved template without approval time is refused',$q$insert into public.message_templates (code, kind, title, body_ar, body_en, approved) values ('bad2','custom','x','نص','text',true)$q$,'23514'),
    (48,'admin','deny','template code with capitals is refused',$q$insert into public.message_templates (code, kind, title) values ('BadCode','custom','x')$q$,'23514'),
    (49,'admin','deny','log: reminder from an UNAPPROVED template is refused',$q$insert into public.message_log (client_id, template_code, kind, lang, body) values ('00000000-0000-0000-0000-00000000c001', 'reminder_24h', 'reminder', 'ar', 'x')$q$,'P0001'),
    (50,'admin','deny','log: message with no template is refused',$q$insert into public.message_log (client_id, kind, lang, body) values ('00000000-0000-0000-0000-00000000c001', 'reminder', 'ar', 'x')$q$,'P0001'),
    (51,'admin','ok','log: message from an approved template is accepted',$q$insert into public.message_log (client_id, template_code, kind, lang, body) values ('00000000-0000-0000-0000-00000000c001', 't_ok', 'custom', 'ar', 'x')$q$,''),
    (52,'admin','deny','log: offer message without an offer is refused',$q$insert into public.message_log (client_id, kind, lang, body) values ('00000000-0000-0000-0000-00000000c002', 'offer', 'both', 'x')$q$,'P0001'),
    (53,'admin','deny','log: DRAFT offer is refused',$q$insert into public.message_log (client_id, offer_id, kind, lang, body) values ('00000000-0000-0000-0000-00000000c002', '00000000-0000-0000-0000-0000000f0001', 'offer', 'both', 'x')$q$,'P0001'),
    (54,'admin','deny','log: offer whose dates ended is refused',$q$insert into public.message_log (client_id, offer_id, kind, lang, body) values ('00000000-0000-0000-0000-00000000c002', '00000000-0000-0000-0000-0000000f0003', 'offer', 'both', 'x')$q$,'P0001'),
    (55,'admin','deny','log: offer not started yet is refused',$q$insert into public.message_log (client_id, offer_id, kind, lang, body) values ('00000000-0000-0000-0000-00000000c002', '00000000-0000-0000-0000-0000000f0004', 'offer', 'both', 'x')$q$,'P0001'),
    (56,'admin','deny','log: live offer to a client WITHOUT consent is refused',$q$insert into public.message_log (client_id, offer_id, kind, lang, body) values ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-0000000f0002', 'offer', 'both', 'x')$q$,'P0001'),
    (57,'admin','deny','log: live offer to a client who OPTED OUT is refused',$q$insert into public.message_log (client_id, offer_id, kind, lang, body) values ('00000000-0000-0000-0000-00000000c003', '00000000-0000-0000-0000-0000000f0002', 'offer', 'both', 'x')$q$,'P0001'),
    (58,'admin','ok','log: live offer to a consenting client is accepted',$q$insert into public.message_log (client_id, offer_id, kind, lang, body) values ('00000000-0000-0000-0000-00000000c002', '00000000-0000-0000-0000-0000000f0002', 'offer', 'both', 'x')$q$,''),
    (59,'admin','deny','log: unknown kind is refused',$q$insert into public.message_log (client_id, template_code, kind, lang, body) values ('00000000-0000-0000-0000-00000000c001', 't_ok', 'spam', 'ar', 'x')$q$,'23514'),
    (60,'admin','deny','log: unknown language is refused',$q$insert into public.message_log (client_id, template_code, kind, lang, body) values ('00000000-0000-0000-0000-00000000c001', 't_ok', 'custom', 'fr', 'x')$q$,'23514')
  ) v(ord, who, kind, name, sql, arg) order by ord loop
    execute 'reset role';
    if t.who = 'anon' then
      perform set_config('request.jwt.claims', '{"role":"anon"}', true); execute 'set local role anon';
    elsif t.who in ('admin', 'other') then
      perform set_config('request.jwt.claims', json_build_object('sub', case t.who when 'admin' then '00000000-0000-0000-0000-0000000000a1' else '00000000-0000-0000-0000-0000000000b2' end, 'role', 'authenticated')::text, true);
      perform set_config('request.jwt.claim.sub', case t.who when 'admin' then '00000000-0000-0000-0000-0000000000a1' else '00000000-0000-0000-0000-0000000000b2' end, true);
      execute 'set local role authenticated';
    end if;
    begin
      n := null;
      if t.kind = 'n' then
        execute t.sql into n;
        r := r || case when (case t.arg when 'n = 0' then n = 0 when 'n = 1' then n = 1 when 'n = 22' then n = 22 when 'n = 4' then n = 4 when 'n >= 3' then n >= 3 when 'n >= 2' then n >= 2 else null end) then 'PASS  ' else 'FAIL  ' end || t.name || ' (n=' || coalesce(n::text, 'null') || ')' || E'\n';
      elsif t.kind = 'rows' then
        execute t.sql; get diagnostics n = row_count;
        r := r || case when n = t.arg::int then 'PASS  ' else 'FAIL  ' end || t.name || ' (rows=' || n || ')' || E'\n';
      else
        execute t.sql;
        r := r || case t.kind when 'ok' then 'PASS  ' else 'FAIL  ' end || t.name || case t.kind when 'ok' then '' else ' (was allowed)' end || E'\n';
      end if;
    exception when others then
      if t.kind = 'deny' and sqlstate = any (string_to_array(t.arg, ',')) then
        r := r || 'PASS  ' || t.name || E'\n';
      else
        r := r || 'FAIL  ' || t.name || ' (' || sqlstate || ': ' || sqlerrm || ')' || E'\n';
      end if;
    end;
  end loop;
  execute 'reset role';
  raise exception E'\nSECURITY TEST REPORT (rolled back, nothing saved)\n%\nPASS: %  FAIL: %', r,
    (select count(*) from unnest(string_to_array(r, E'\n')) l where l like 'PASS%'),
    (select count(*) from unnest(string_to_array(r, E'\n')) l where l like 'FAIL%');
end $$;

-- PART B: updates, deletes, cascade
do $$
declare
  r text := '';
  n bigint;
  t record;
begin
  -- fixtures (created as postgres inside this statement; everything is rolled back at the end)
  insert into auth.users (id, aud, role, email) values ('00000000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', 'admin-test@example.invalid'), ('00000000-0000-0000-0000-0000000000b2', 'authenticated', 'authenticated', 'other-test@example.invalid');
  insert into private.admin_users (user_id) values ('00000000-0000-0000-0000-0000000000a1');
  insert into public.clients (id, full_name, phone, created_at, updated_at) values ('00000000-0000-0000-0000-00000000c001', 'Fixture A', '966500000001', now() - interval '1 day', now() - interval '1 day');
  insert into public.clients (id, full_name, phone, whatsapp_opt_in, opt_in_at, opt_in_source) values ('00000000-0000-0000-0000-00000000c002', 'Fixture opted in', '966500000002', true, now(), 'in_clinic');
  insert into public.clients (id, full_name, phone, whatsapp_opt_in, opt_in_at, opt_in_source, opted_out_at) values ('00000000-0000-0000-0000-00000000c003', 'Fixture opted out', '966500000003', true, now(), 'in_clinic', now());
  insert into public.appointments (id, client_id) values ('00000000-0000-0000-0000-0000000a0001', '00000000-0000-0000-0000-00000000c001');
  insert into public.message_templates (code, kind, title, body_ar, body_en, approved, approved_at) values ('t_ok', 'custom', 'ok', 'نص', 'text', true, now());
  insert into public.offers (id, title_ar, title_en, body_ar, body_en, status) values ('00000000-0000-0000-0000-0000000f0001', 'a', 'a', 'a', 'a', 'draft');
  insert into public.offers (id, title_ar, title_en, body_ar, body_en, status, approval_number, starts_on, ends_on) values
    ('00000000-0000-0000-0000-0000000f0002', 'a', 'a', 'a', 'a', 'approved', 'T-1', (now() at time zone 'Asia/Riyadh')::date - 1, (now() at time zone 'Asia/Riyadh')::date + 10),
    ('00000000-0000-0000-0000-0000000f0003', 'a', 'a', 'a', 'a', 'approved', 'T-2', (now() at time zone 'Asia/Riyadh')::date - 30, (now() at time zone 'Asia/Riyadh')::date - 2),
    ('00000000-0000-0000-0000-0000000f0004', 'a', 'a', 'a', 'a', 'approved', 'T-3', (now() at time zone 'Asia/Riyadh')::date + 5, (now() at time zone 'Asia/Riyadh')::date + 20);

  for t in select * from (values
    (1,'other','rows','non-admin cannot change a client',$q$update public.clients set full_name = 'hacked' where id = '00000000-0000-0000-0000-00000000c001'$q$,'0'),
    (2,'other','rows','non-admin cannot delete a client',$q$delete from public.clients where id = '00000000-0000-0000-0000-00000000c001'$q$,'0'),
    (3,'other','rows','non-admin cannot change an appointment',$q$update public.appointments set status = 'cancelled' where id = '00000000-0000-0000-0000-0000000a0001'$q$,'0'),
    (4,'other','rows','non-admin cannot approve a template',$q$update public.message_templates set approved = true, approved_at = now() where code = 'reminder_24h'$q$,'0'),
    (5,'other','rows','non-admin cannot change an offer',$q$update public.offers set status = 'withdrawn' where id = '00000000-0000-0000-0000-0000000f0002'$q$,'0'),
    (6,'other','rows','non-admin cannot change an area',$q$update public.areas set active = false where code = 'FACE-01'$q$,'0'),
    (7,'other','rows','non-admin cannot delete a log row',$q$delete from public.message_log where kind = 'offer'$q$,'0'),
    (8,'anon','deny','anon cannot update a client',$q$update public.clients set full_name = 'hacked' where id = '00000000-0000-0000-0000-00000000c001'$q$,'42501'),
    (9,'anon','deny','anon cannot delete a client',$q$delete from public.clients where id = '00000000-0000-0000-0000-00000000c001'$q$,'42501'),
    (10,'admin','rows','admin can change a client',$q$update public.clients set full_name = 'Renamed' where id = '00000000-0000-0000-0000-00000000c001'$q$,'1'),
    (11,'admin','n','updated_at moves forward on update',$q$select (updated_at > now() - interval '1 hour')::int from public.clients where id = '00000000-0000-0000-0000-00000000c001'$q$,'n = 1'),
    (12,'admin','deny','admin cannot enable promo consent without proof',$q$update public.clients set whatsapp_opt_in = true where id = '00000000-0000-0000-0000-00000000c001'$q$,'23514'),
    (13,'admin','deny','admin cannot confirm an appointment without a time',$q$update public.appointments set status = 'confirmed' where id = '00000000-0000-0000-0000-0000000a0001'$q$,'23514'),
    (14,'admin','deny','admin cannot approve an offer without an approval number',$q$update public.offers set status = 'approved', starts_on = (now() at time zone 'Asia/Riyadh')::date, ends_on = (now() at time zone 'Asia/Riyadh')::date + 5 where id = '00000000-0000-0000-0000-0000000f0001'$q$,'23514'),
    (15,'admin','rows','admin can approve an offer with number and dates',$q$update public.offers set status = 'approved', approval_number = 'X-9', starts_on = (now() at time zone 'Asia/Riyadh')::date, ends_on = (now() at time zone 'Asia/Riyadh')::date + 5 where id = '00000000-0000-0000-0000-0000000f0001'$q$,'1'),
    (16,'admin','deny','admin cannot stretch an offer beyond 60 days',$q$update public.offers set ends_on = starts_on + 60 where id = '00000000-0000-0000-0000-0000000f0001'$q$,'23514'),
    (17,'admin','rows','admin can approve a template with both texts',$q$update public.message_templates set body_ar = 'نص', body_en = 'text', approved = true, approved_at = now() where code = 'reminder_24h'$q$,'1'),
    (18,'admin','ok','after approval the reminder can be logged',$q$insert into public.message_log (client_id, template_code, kind, lang, body) values ('00000000-0000-0000-0000-00000000c001', 'reminder_24h', 'reminder', 'ar', 'x')$q$,''),
    (19,'admin','rows','admin can withdraw approval',$q$update public.message_templates set approved = false, approved_at = null where code = 'reminder_24h'$q$,'1'),
    (20,'admin','deny','after withdrawal the reminder is refused again',$q$insert into public.message_log (client_id, template_code, kind, lang, body) values ('00000000-0000-0000-0000-00000000c001', 'reminder_24h', 'reminder', 'ar', 'x')$q$,'P0001'),
    (21,'admin','rows','admin can turn an area off',$q$update public.areas set active = false where code = 'FACE-01'$q$,'1'),
    (22,'admin','ok','log row for the cascade check',$q$insert into public.message_log (client_id, appointment_id, template_code, kind, lang, body) values ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-0000000a0001', 't_ok', 'custom', 'ar', 'x')$q$,''),
    (23,'admin','rows','deleting a template keeps the log row (template set null)',$q$delete from public.message_templates where code = 't_ok'$q$,'1'),
    (24,'admin','n','...and the log row now has no template',$q$select count(*) from public.message_log where client_id = '00000000-0000-0000-0000-00000000c001' and template_code is null$q$,'n = 1'),
    (25,'admin','rows','admin can delete a client (erasure)',$q$delete from public.clients where id = '00000000-0000-0000-0000-00000000c001'$q$,'1'),
    (26,'admin','n','erasure removed that client''s appointments',$q$select count(*) from public.appointments where client_id = '00000000-0000-0000-0000-00000000c001'$q$,'n = 0'),
    (27,'admin','n','erasure removed that client''s message log',$q$select count(*) from public.message_log where client_id = '00000000-0000-0000-0000-00000000c001'$q$,'n = 0')
  ) v(ord, who, kind, name, sql, arg) order by ord loop
    execute 'reset role';
    if t.who = 'anon' then
      perform set_config('request.jwt.claims', '{"role":"anon"}', true); execute 'set local role anon';
    elsif t.who in ('admin', 'other') then
      perform set_config('request.jwt.claims', json_build_object('sub', case t.who when 'admin' then '00000000-0000-0000-0000-0000000000a1' else '00000000-0000-0000-0000-0000000000b2' end, 'role', 'authenticated')::text, true);
      perform set_config('request.jwt.claim.sub', case t.who when 'admin' then '00000000-0000-0000-0000-0000000000a1' else '00000000-0000-0000-0000-0000000000b2' end, true);
      execute 'set local role authenticated';
    end if;
    begin
      n := null;
      if t.kind = 'n' then
        execute t.sql into n;
        r := r || case when (case t.arg when 'n = 0' then n = 0 when 'n = 1' then n = 1 when 'n = 22' then n = 22 when 'n = 4' then n = 4 when 'n >= 3' then n >= 3 when 'n >= 2' then n >= 2 else null end) then 'PASS  ' else 'FAIL  ' end || t.name || ' (n=' || coalesce(n::text, 'null') || ')' || E'\n';
      elsif t.kind = 'rows' then
        execute t.sql; get diagnostics n = row_count;
        r := r || case when n = t.arg::int then 'PASS  ' else 'FAIL  ' end || t.name || ' (rows=' || n || ')' || E'\n';
      else
        execute t.sql;
        r := r || case t.kind when 'ok' then 'PASS  ' else 'FAIL  ' end || t.name || case t.kind when 'ok' then '' else ' (was allowed)' end || E'\n';
      end if;
    exception when others then
      if t.kind = 'deny' and sqlstate = any (string_to_array(t.arg, ',')) then
        r := r || 'PASS  ' || t.name || E'\n';
      else
        r := r || 'FAIL  ' || t.name || ' (' || sqlstate || ': ' || sqlerrm || ')' || E'\n';
      end if;
    end;
  end loop;
  execute 'reset role';
  raise exception E'\nSECURITY TEST REPORT (rolled back, nothing saved)\n%\nPASS: %  FAIL: %', r,
    (select count(*) from unnest(string_to_array(r, E'\n')) l where l like 'PASS%'),
    (select count(*) from unnest(string_to_array(r, E'\n')) l where l like 'FAIL%');
end $$;
