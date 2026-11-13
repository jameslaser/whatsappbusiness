import { state, L } from '../state.js';
import { h, ltr, badge } from '../ui.js';
import { computeDue } from '../lib/due.js';
import { fmtShort, fmtDate, fmtTime, riyadhYmd } from '../lib/dates.js';
import { areaNames } from '../lib/templates.js';
import { formatPhone } from '../lib/phone.js';
import { openSend, firstTemplate, kindLabel } from './send.js';

function row(item, kind, rerender) {
  const { appointment: a, client: c } = item;
  const tpl = firstTemplate(kind);
  const ready = Boolean(tpl && tpl.approved);
  return h('li', { class: 'item' },
    h('div', { class: 'item-main' },
      h('strong', null, c.full_name), ' ', ltr(formatPhone(c.phone)),
      h('div', { class: 'sub' }, a.scheduled_at ? fmtShort(a.scheduled_at, state.lang) : '', a.scheduled_at ? ' · ' : '', areaNames(a.area_codes, state.data.areas, state.lang))),
    ready
      ? h('button', { class: 'btn primary sm', type: 'button', onclick: () => openSend({ client: c, appointment: a, kind, onDone: rerender }) }, L('إرسال', 'Send'))
      : h('a', { class: 'btn line sm', href: '#/messages' }, L('اعتمد القالب أولاً', 'Approve the template first')));
}

function section(title, items, kind, rerender, empty) {
  return h('section', { class: 'card' },
    h('h2', null, title, ' ', badge(String(items.length), items.length ? 'gold' : '')),
    items.length ? h('ul', { class: 'list' }, items.map((i) => row(i, kind, rerender))) : h('p', { class: 'muted' }, empty));
}

export function renderToday(root, rerender) {
  const { appointments, clients, log } = state.data;
  const due = computeDue({ appointments, clients, log });
  const today = riyadhYmd();
  const todays = appointments
    .filter((a) => a.status === 'confirmed' && a.scheduled_at && riyadhYmd(new Date(a.scheduled_at)) === today)
    .sort((x, y) => x.scheduled_at.localeCompare(y.scheduled_at));
  const byId = new Map(clients.map((c) => [c.id, c]));

  root.appendChild(h('h1', null, L('اليوم', 'Today')));
  root.appendChild(h('p', { class: 'muted' }, fmtDate(new Date().toISOString(), state.lang)));

  root.appendChild(h('section', { class: 'card' },
    h('h2', null, L('طلبات جديدة', 'New requests'), ' ', badge(String(due.requests.length), due.requests.length ? 'gold' : '')),
    due.requests.length
      ? h('ul', { class: 'list' }, due.requests.map(({ appointment: a, client: c }) =>
        h('li', { class: 'item' },
          h('div', { class: 'item-main' }, h('strong', null, c.full_name), ' ', ltr(formatPhone(c.phone)),
            h('div', { class: 'sub' }, areaNames(a.area_codes, state.data.areas, state.lang))),
          h('a', { class: 'btn line sm', href: '#/appointments' }, L('فتح', 'Open')))))
      : h('p', { class: 'muted' }, L('لا توجد طلبات جديدة.', 'No new requests.'))));

  root.appendChild(h('section', { class: 'card' },
    h('h2', null, L('مواعيد اليوم', "Today's appointments"), ' ', badge(String(todays.length), todays.length ? 'gold' : '')),
    todays.length
      ? h('ul', { class: 'list' }, todays.map((a) => {
        const c = byId.get(a.client_id);
        return h('li', { class: 'item' }, h('div', { class: 'item-main' },
          h('strong', null, fmtTime(a.scheduled_at, state.lang)), ' · ', c ? c.full_name : '',
          h('div', { class: 'sub' }, areaNames(a.area_codes, state.data.areas, state.lang))));
      }))
      : h('p', { class: 'muted' }, L('لا توجد مواعيد مؤكدة اليوم.', 'No confirmed appointments today.'))));

  root.appendChild(section(kindLabel('reminder'), due.reminders, 'reminder', rerender, L('لا توجد تذكيرات مستحقة.', 'No reminders due.')));
  root.appendChild(section(kindLabel('pre'), due.pre, 'pre', rerender, L('لا توجد تعليمات قبل الجلسة مستحقة.', 'No pre-session messages due.')));
  root.appendChild(section(kindLabel('post'), due.post, 'post', rerender, L('لا توجد تعليمات بعد الجلسة مستحقة.', 'No post-session messages due.')));
}
