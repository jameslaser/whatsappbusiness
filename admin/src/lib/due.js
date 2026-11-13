import { riyadhYmd, addDaysYmd } from './dates.js';

// What needs attention today. Pure function: pass in the rows and the clock.
export function computeDue({ appointments, clients, log, now = new Date() }) {
  const today = riyadhYmd(now);
  const tomorrow = addDaysYmd(today, 1);
  const in2 = addDaysYmd(today, 2);
  const yesterday = addDaysYmd(today, -1);
  const byClient = new Map(clients.map((c) => [c.id, c]));
  const sent = (kind, apptId) => log.some((m) => m.appointment_id === apptId && m.kind === kind && m.status === 'sent');
  const out = { requests: [], reminders: [], pre: [], post: [] };

  for (const a of appointments) {
    const client = byClient.get(a.client_id);
    if (!client) continue;
    const item = { appointment: a, client };
    if (a.status === 'new') out.requests.push(item);
    if (a.status === 'confirmed' && a.scheduled_at) {
      const day = riyadhYmd(new Date(a.scheduled_at));
      const future = new Date(a.scheduled_at) > now;
      if (future && day >= today && day <= tomorrow && !sent('reminder', a.id)) out.reminders.push(item);
      if (future && day >= today && day <= in2 && !sent('pre', a.id)) out.pre.push(item);
    }
    if (a.status === 'done' && a.scheduled_at) {
      const day = riyadhYmd(new Date(a.scheduled_at));
      if (day >= yesterday && day <= today && !sent('post', a.id)) out.post.push(item);
    }
  }
  const byTime = (x, y) => String(x.appointment.scheduled_at || x.appointment.created_at).localeCompare(String(y.appointment.scheduled_at || y.appointment.created_at));
  for (const k of Object.keys(out)) out[k].sort(byTime);
  return out;
}
