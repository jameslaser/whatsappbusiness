// All database access. The browser talks to Supabase with the publishable key; Row Level Security
// decides what a signed-in admin can see. A visitor who is not an admin gets empty results, never data.
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';
import { state, L } from './state.js';

export const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
});

const PAGE = 1000;

async function fetchAll(table, build) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(sb.from(table).select('*')).range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...data);
    if (data.length < PAGE) break;
  }
  return rows;
}

export async function loadAll() {
  const since = new Date(Date.now() - 90 * 86400000).toISOString();
  const [areas, clients, appointments, templates, offers, log] = await Promise.all([
    fetchAll('areas', (q) => q.order('sort_order')),
    fetchAll('clients', (q) => q.order('created_at', { ascending: false })),
    fetchAll('appointments', (q) => q.order('created_at', { ascending: false })),
    fetchAll('message_templates', (q) => q.order('code')),
    fetchAll('offers', (q) => q.order('created_at', { ascending: false })),
    fetchAll('message_log', (q) => q.gte('created_at', since).order('created_at', { ascending: false }))
  ]);
  state.data = { areas, clients, appointments, templates, offers, log };
}

const KEYS = { areas: 'code', clients: 'id', appointments: 'id', message_templates: 'code', offers: 'id', message_log: 'id' };
const SLOT = { areas: 'areas', clients: 'clients', appointments: 'appointments', message_templates: 'templates', offers: 'offers', message_log: 'log' };

function putLocal(table, row) {
  const list = state.data[SLOT[table]];
  const k = KEYS[table];
  const i = list.findIndex((r) => r[k] === row[k]);
  if (i >= 0) list[i] = row; else list.unshift(row);
}

export async function insertRow(table, row) {
  const { data, error } = await sb.from(table).insert(row).select();
  if (error) throw error;
  putLocal(table, data[0]);
  return data[0];
}

export async function updateRow(table, keyValue, patch) {
  const { data, error } = await sb.from(table).update(patch).eq(KEYS[table], keyValue).select();
  if (error) throw error;
  if (!data || !data.length) throw new Error('not-found-or-denied');
  putLocal(table, data[0]);
  return data[0];
}

export async function deleteRow(table, keyValue) {
  const { error } = await sb.from(table).delete().eq(KEYS[table], keyValue);
  if (error) throw error;
  const list = state.data[SLOT[table]];
  const i = list.findIndex((r) => r[KEYS[table]] === keyValue);
  if (i >= 0) list.splice(i, 1);
  if (table === 'clients') {                       // the database cascades; mirror it locally
    state.data.appointments = state.data.appointments.filter((a) => a.client_id !== keyValue);
    state.data.log = state.data.log.filter((m) => m.client_id !== keyValue);
  }
  if (table === 'appointments') state.data.log.forEach((m) => { if (m.appointment_id === keyValue) m.appointment_id = null; });
}

// Friendly bilingual message for a database error.
export function explain(err) {
  const code = err && err.code;
  const msg = (err && err.message) || String(err);
  if (code === '23505') return L('هذا الرقم مسجّل مسبقاً.', 'This phone number is already registered.');
  if (code === '23514') {
    if (/phone/.test(msg)) return L('رقم الجوال غير صالح.', 'The phone number is not valid.');
    if (/confirmed_needs_time/.test(msg)) return L('الموعد المؤكد يحتاج تاريخاً ووقتاً.', 'A confirmed appointment needs a date and time.');
    if (/offer_max_60/.test(msg)) return L('مدة العرض لا تتجاوز 60 يوماً.', 'An offer can last at most 60 days.');
    if (/approved_needs_proof/.test(msg)) return L('اعتماد العرض يحتاج رقم الموافقة وتاريخ البداية والنهاية.', 'Approving an offer needs the approval number and both dates.');
    if (/opt_in_needs_proof/.test(msg)) return L('الموافقة على الرسائل الترويجية تحتاج مصدراً وتاريخاً.', 'Promotional consent needs a source and a date.');
    return L('قيمة غير مسموحة: ', 'A value is not allowed: ') + msg;
  }
  if (code === 'P0001') {
    if (/not opted in/.test(msg)) return L('هذا العميل لم يوافق على الرسائل الترويجية.', 'This client has not agreed to promotional messages.');
    if (/outside its approved dates|not approved/.test(msg)) return L('العرض غير معتمد أو خارج تواريخه المعتمدة.', 'The offer is not approved or is outside its approved dates.');
    return msg;
  }
  if (code === '42501' || /not-found-or-denied|row-level security/.test(msg)) return L('ليست لديك صلاحية لهذه العملية.', 'You do not have permission for this action.');
  if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) return L('تعذّر الاتصال بالإنترنت.', 'Could not connect. Check the internet and try again.');
  return msg;
}
