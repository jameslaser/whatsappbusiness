import { state, L, clientById } from '../state.js';
import { h, badge, download } from '../ui.js';
import { fmtShort } from '../lib/dates.js';
import { kindLabel } from './send.js';

export function backupJson() {
  const d = state.data;
  return JSON.stringify({
    exported_at: new Date().toISOString(),
    note: 'Backup of the James Laser admin portal. Message log covers the last 90 days only.',
    areas: d.areas, clients: d.clients, appointments: d.appointments, message_templates: d.templates, offers: d.offers, message_log: d.log
  }, null, 2);
}

export function renderLog(root) {
  let kind = 'all';
  const chips = h('div', { class: 'chips', role: 'group' });
  const list = h('ul', { class: 'list' });
  const draw = () => {
    const opts = [['all', L('الكل', 'All')], ['reminder', kindLabel('reminder')], ['pre', kindLabel('pre')], ['post', kindLabel('post')], ['custom', kindLabel('custom')], ['offer', L('عرض', 'Offer')]];
    chips.replaceChildren(...opts.map(([v, label]) => h('button', { class: 'chip' + (kind === v ? ' on' : ''), type: 'button', 'aria-pressed': kind === v ? 'true' : 'false', onclick: () => { kind = v; draw(); } }, label)));
    const rows = state.data.log.filter((m) => kind === 'all' || m.kind === kind);
    list.replaceChildren(...(rows.length ? rows.map((m) => {
      const c = clientById(m.client_id);
      return h('li', { class: 'item col' },
        h('div', { class: 'item-main' }, h('strong', null, c ? c.full_name : '?'), ' ', badge(m.kind === 'offer' ? L('عرض', 'Offer') : kindLabel(m.kind), ''), ' ',
          h('span', { class: 'sub' }, fmtShort(m.created_at, state.lang))),
        h('pre', { class: 'log-body', dir: 'auto' }, m.body));
    }) : [h('li', { class: 'muted' }, L('لا توجد رسائل مسجّلة.', 'No messages logged.'))]));
  };
  root.appendChild(h('h1', null, L('السجل', 'Log')));
  root.appendChild(h('p', { class: 'muted' }, L('ما سُجّل كمُرسل آخر 90 يوماً.', 'What was marked as sent in the last 90 days.')));
  root.appendChild(h('div', { class: 'card' },
    h('p', null, L('نسخة احتياطية: الخطة المجانية في Supabase لا تحتفظ بنسخ احتياطية. نزّل الملف أسبوعياً واحفظه في مكان آمن. يحتوي أسماء وأرقام العملاء، فلا ترسله لأحد.',
      'Backup: the free Supabase plan keeps no backups. Download this file weekly and keep it somewhere safe. It holds client names and numbers, so share it with no one.')),
    h('button', { class: 'btn line', type: 'button', onclick: () => download('jl-backup-' + new Date().toISOString().slice(0, 10) + '.json', backupJson(), 'application/json') }, L('تنزيل نسخة احتياطية (JSON)', 'Download backup (JSON)'))));
  root.appendChild(chips);
  root.appendChild(list);
  draw();
}
