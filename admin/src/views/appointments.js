import { state, L, clientById } from '../state.js';
import { h, ltr, badge, modal, toast, confirmDialog, field } from '../ui.js';
import { insertRow, updateRow, deleteRow, explain } from '../data.js';
import { normalizePhone, formatPhone, waLink } from '../lib/phone.js';
import { splitRiyadh, toIsoRiyadh, fmtShort } from '../lib/dates.js';
import { areaNames } from '../lib/templates.js';
import { openSend } from './send.js';

export const STATUSES = [
  ['new', 'جديد', 'New'],
  ['contacted', 'تم التواصل', 'Contacted'],
  ['confirmed', 'مؤكد', 'Confirmed'],
  ['done', 'تمت الجلسة', 'Done'],
  ['cancelled', 'ملغي', 'Cancelled'],
  ['no_show', 'لم يحضر', 'No-show']
];
export const statusLabel = (s) => { const r = STATUSES.find((x) => x[0] === s); return r ? L(r[1], r[2]) : s; };
const STATUS_KIND = { new: 'gold', confirmed: 'green', done: 'blue', cancelled: 'red', no_show: 'red', contacted: '' };

// preset.client: start with this client. existing: edit this appointment.
export function openAppointmentForm(preset, onSaved, existing) {
  const e = existing || {};
  const clients = [...state.data.clients].sort((a, b) => a.full_name.localeCompare(b.full_name));
  let newClientMode = !existing && !preset.client && clients.length === 0;

  const clientSel = h('select', { 'aria-label': L('العميل', 'Client') },
    clients.map((c) => h('option', { value: c.id }, c.full_name + ' (+' + c.phone + ')')));
  const pickedId = existing ? existing.client_id : (preset.client ? preset.client.id : null);
  if (pickedId) clientSel.value = pickedId;
  const search = h('input', { type: 'search', placeholder: L('ابحث عن عميل…', 'Find a client…'), autocomplete: 'off', 'aria-label': L('بحث عن عميل', 'Find a client') });
  search.addEventListener('input', () => {
    const t = search.value.trim().toLowerCase();
    const digits = t.replace(/\D/g, '');
    for (const o of clientSel.options) {
      const c = clientById(o.value);
      o.hidden = Boolean(t) && !(c.full_name.toLowerCase().includes(t) || (digits.length >= 3 && c.phone.includes(digits)));
    }
    const vis = [...clientSel.options].find((o) => !o.hidden);
    if (t && vis && clientSel.selectedOptions[0] && clientSel.selectedOptions[0].hidden) clientSel.value = vis.value;
  });

  const nName = h('input', { type: 'text', maxlength: '120', autocomplete: 'off' });
  const nPhone = h('input', { type: 'tel', inputmode: 'tel', dir: 'ltr', autocomplete: 'off' });
  const nLang = h('select', null, h('option', { value: 'ar' }, 'العربية'), h('option', { value: 'en' }, 'English'));
  const newBox = h('div', { class: 'subbox', hidden: newClientMode ? null : '' },
    field(L('اسم العميل', 'Client name'), nName), field(L('رقم الجوال', 'Phone'), nPhone), field(L('لغة الرسائل', 'Message language'), nLang));
  const existingBox = h('div', { hidden: newClientMode ? '' : null }, search, clientSel);
  const toggle = h('button', { class: 'btn line sm', type: 'button', onclick: () => {
    newClientMode = !newClientMode;
    newBox.hidden = !newClientMode;
    existingBox.hidden = newClientMode;
    toggle.textContent = newClientMode ? L('اختيار عميل موجود', 'Pick an existing client') : L('+ عميل جديد', '+ New client');
  } }, newClientMode ? L('اختيار عميل موجود', 'Pick an existing client') : L('+ عميل جديد', '+ New client'));
  const clientBox = existing ? h('p', null, h('strong', null, (clientById(existing.client_id) || {}).full_name || '')) : h('div', null, existingBox, newBox, clients.length ? toggle : null);

  const checks = new Set(e.area_codes || []);
  const groups = new Map();
  for (const a of state.data.areas) {
    if (!a.active && !checks.has(a.code)) continue;
    const key = a.collection_ar;
    if (!groups.has(key)) groups.set(key, { ar: a.collection_ar, en: a.collection_en, items: [] });
    groups.get(key).items.push(a);
  }
  const areaBox = h('div', null, [...groups.values()].map((g) => h('fieldset', { class: 'areas' },
    h('legend', null, L(g.ar, g.en)),
    h('div', { class: 'checks' }, g.items.map((a) => h('label', { class: 'check' },
      h('input', { type: 'checkbox', value: a.code, checked: checks.has(a.code) ? true : null, onchange: (ev) => { if (ev.target.checked) checks.add(a.code); else checks.delete(a.code); } }),
      L(a.name_ar, a.name_en)))))));

  const status = h('select', null, STATUSES.map(([v, ar, en]) => h('option', { value: v }, L(ar, en))));
  status.value = e.status || 'new';
  const when = splitRiyadh(e.scheduled_at);
  const date = h('input', { type: 'date', value: when.ymd });
  const time = h('input', { type: 'time', value: when.hm });
  const notes = h('textarea', { rows: '2', maxlength: '500', placeholder: L('ملاحظات غير طبية فقط', 'Non-medical notes only') }, e.notes || '');
  const err = h('p', { class: 'note warn', hidden: '' });
  const save = h('button', { class: 'btn primary', type: 'submit' }, L('حفظ', 'Save'));
  const fail = (m, el) => { err.hidden = false; err.textContent = m; if (el) el.focus(); };

  const form = h('form', { novalidate: '', onsubmit: async (ev) => {
    ev.preventDefault();
    err.hidden = true;
    if (status.value === 'confirmed' && (!date.value || !time.value)) return fail(L('الموعد المؤكد يحتاج تاريخاً ووقتاً.', 'A confirmed appointment needs a date and time.'), date);
    if ((date.value && !time.value) || (!date.value && time.value)) return fail(L('اكتب التاريخ والوقت معاً أو اتركهما فارغين.', 'Enter both date and time, or leave both empty.'), date);
    save.disabled = true;
    try {
      let clientId = existing ? existing.client_id : clientSel.value;
      if (!existing && newClientMode) {
        const phone = normalizePhone(nPhone.value);
        if (!nName.value.trim()) { save.disabled = false; return fail(L('اكتب اسم العميل.', 'Enter the client name.'), nName); }
        if (!phone) { save.disabled = false; return fail(L('رقم الجوال غير صالح.', 'The phone number is not valid.'), nPhone); }
        clientId = (await insertRow('clients', { full_name: nName.value.trim(), phone, preferred_lang: nLang.value })).id;
      }
      if (!clientId) { save.disabled = false; return fail(L('اختر عميلاً.', 'Pick a client.')); }
      const row = {
        client_id: clientId,
        area_codes: [...checks],
        status: status.value,
        scheduled_at: date.value && time.value ? toIsoRiyadh(date.value, time.value) : null,
        notes: notes.value.trim() || null
      };
      const saved = existing ? await updateRow('appointments', existing.id, row) : await insertRow('appointments', row);
      toast(L('تم الحفظ', 'Saved'), 'ok');
      close();
      if (onSaved) onSaved(saved);
    } catch (ex) {
      save.disabled = false;
      fail(explain(ex));
    }
  } },
  field(L('العميل', 'Client'), clientBox),
  h('p', { class: 'lbl' }, L('المناطق', 'Areas')), areaBox,
  h('div', { class: 'grid2' }, field(L('الحالة', 'Status'), status), h('div')),
  h('div', { class: 'grid2' }, field(L('التاريخ (توقيت الرياض)', 'Date (Riyadh time)'), date), field(L('الوقت', 'Time'), time)),
  field(L('ملاحظات', 'Notes'), notes),
  err, h('div', { class: 'row end' }, save));
  const close = modal(existing ? L('تعديل الموعد', 'Edit appointment') : L('موعد جديد', 'New appointment'), form);
}

export function renderAppointments(root, rerender) {
  let filter = sessionStorageGet() || 'open';
  const chips = h('div', { class: 'chips', role: 'group', 'aria-label': L('تصفية', 'Filter') });
  const list = h('ul', { class: 'list' });

  const matches = (a) => (filter === 'all' ? true : filter === 'open' ? ['new', 'contacted', 'confirmed'].includes(a.status) : a.status === filter);

  const draw = () => {
    const opts = [['open', L('المفتوحة', 'Open')], ['all', L('الكل', 'All')], ...STATUSES.map(([v, ar, en]) => [v, L(ar, en)])];
    chips.replaceChildren(...opts.map(([v, label]) => h('button', {
      class: 'chip' + (filter === v ? ' on' : ''), type: 'button', 'aria-pressed': filter === v ? 'true' : 'false',
      onclick: () => { filter = v; sessionStorageSet(v); draw(); }
    }, label)));
    const rows = state.data.appointments.filter(matches).sort((x, y) => {
      const ax = x.scheduled_at || x.created_at; const ay = y.scheduled_at || y.created_at;
      return filter === 'open' ? String(ax).localeCompare(String(ay)) : String(ay).localeCompare(String(ax));
    });
    list.replaceChildren(...(rows.length ? rows.map((a) => item(a)) : [h('li', { class: 'muted' }, L('لا توجد مواعيد هنا.', 'Nothing here.'))]));
  };

  const item = (a) => {
    const c = clientById(a.client_id);
    if (!c) return h('li');
    const sel = h('select', { 'aria-label': L('الحالة', 'Status'), onchange: async (ev) => {
      const next = ev.target.value;
      if (next === 'confirmed' && !a.scheduled_at) { ev.target.value = a.status; openAppointmentForm({}, rerender, { ...a, status: 'confirmed' }); return; }
      try { await updateRow('appointments', a.id, { status: next }); toast(L('تم تحديث الحالة', 'Status updated'), 'ok'); rerender(); } catch (ex) { ev.target.value = a.status; toast(explain(ex), 'err'); }
    } }, STATUSES.map(([v, ar, en]) => h('option', { value: v }, L(ar, en))));
    sel.value = a.status;
    return h('li', { class: 'item col' },
      h('div', { class: 'item-main' },
        h('strong', null, c.full_name), ' ', ltr(formatPhone(c.phone)), ' ', badge(statusLabel(a.status), STATUS_KIND[a.status]),
        h('div', { class: 'sub' }, a.scheduled_at ? fmtShort(a.scheduled_at, state.lang) + ' · ' : '', areaNames(a.area_codes, state.data.areas, state.lang) || L('بدون مناطق', 'No areas')),
        a.notes ? h('div', { class: 'sub' }, a.notes) : null),
      h('div', { class: 'row' }, sel,
        h('button', { class: 'btn line sm', type: 'button', onclick: () => openAppointmentForm({}, rerender, a) }, L('تعديل', 'Edit')),
        h('button', { class: 'btn line sm', type: 'button', onclick: () => openSend({ client: c, appointment: a, onDone: rerender }) }, L('رسالة', 'Message')),
        h('a', { class: 'btn line sm', href: waLink(c.phone), target: '_blank', rel: 'noopener noreferrer' }, L('محادثة', 'Chat')),
        h('button', { class: 'btn danger sm', type: 'button', onclick: async () => {
          if (!(await confirmDialog(L('حذف هذا الموعد؟', 'Delete this appointment?'), L('حذف', 'Delete'), true))) return;
          try { await deleteRow('appointments', a.id); toast(L('تم الحذف', 'Deleted'), 'ok'); rerender(); } catch (ex) { toast(explain(ex), 'err'); }
        } }, L('حذف', 'Delete'))));
  };

  root.appendChild(h('div', { class: 'head' }, h('h1', null, L('المواعيد والطلبات', 'Appointments & requests')),
    h('button', { class: 'btn primary', type: 'button', onclick: () => openAppointmentForm({}, rerender) }, L('+ موعد', '+ Appointment'))));
  root.appendChild(chips);
  root.appendChild(list);
  draw();
}

function sessionStorageGet() { try { return sessionStorage.getItem('jl_appt_filter'); } catch (e) { return null; } }
function sessionStorageSet(v) { try { sessionStorage.setItem('jl_appt_filter', v); } catch (e) { /* ignore */ } }
