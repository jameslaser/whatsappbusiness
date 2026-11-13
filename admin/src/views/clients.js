import { state, L } from '../state.js';
import { h, ltr, badge, modal, toast, confirmDialog, field } from '../ui.js';
import { insertRow, updateRow, deleteRow, explain } from '../data.js';
import { normalizePhone, formatPhone, waLink } from '../lib/phone.js';
import { openSend } from './send.js';
import { openAppointmentForm } from './appointments.js';

const SOURCES = [
  ['in_clinic', 'في العيادة', 'In the clinic'],
  ['whatsapp_chat', 'محادثة واتساب', 'WhatsApp chat'],
  ['website', 'الموقع', 'Website'],
  ['other', 'أخرى', 'Other']
];

export function consentBadge(c) {
  if (c.opted_out_at) return badge(L('أوقف الرسائل الترويجية', 'Opted out'), 'red');
  if (c.whatsapp_opt_in) return badge(L('موافق على العروض', 'Offers OK'), 'green');
  return badge(L('بدون موافقة ترويجية', 'No promo consent'), '');
}

// existing: a client row to edit, or null to add. onSaved(row) runs after a successful save.
export function openClientForm(existing, onSaved) {
  const e = existing || {};
  const name = h('input', { type: 'text', maxlength: '120', value: e.full_name || '', autocomplete: 'off', required: '' });
  const phone = h('input', { type: 'tel', inputmode: 'tel', value: e.phone ? '+' + e.phone : '', autocomplete: 'off', dir: 'ltr', required: '' });
  const phoneHint = h('span', { class: 'hint' });
  const lang = h('select', null, h('option', { value: 'ar' }, 'العربية'), h('option', { value: 'en' }, 'English'));
  lang.value = e.preferred_lang || 'ar';
  const notes = h('textarea', { rows: '2', maxlength: '500', placeholder: L('ملاحظات غير طبية فقط', 'Non-medical notes only') }, e.notes || '');
  const optIn = h('input', { type: 'checkbox', id: 'optin', checked: e.whatsapp_opt_in ? true : null });
  const source = h('select', null, SOURCES.map(([v, ar, en]) => h('option', { value: v }, L(ar, en))));
  source.value = e.opt_in_source || 'in_clinic';
  const optOut = h('input', { type: 'checkbox', id: 'optout', checked: e.opted_out_at ? true : null });
  const err = h('p', { class: 'note warn', hidden: '' });
  const save = h('button', { class: 'btn primary', type: 'submit' }, L('حفظ', 'Save'));

  const syncPhone = () => {
    const n = normalizePhone(phone.value);
    phoneHint.textContent = n ? formatPhone(n) : (phone.value.trim() ? L('الرقم غير صالح', 'Number not valid') : '');
    phoneHint.className = 'hint ltr' + (n || !phone.value.trim() ? '' : ' bad');
  };
  phone.addEventListener('input', syncPhone);
  syncPhone();

  const form = h('form', { novalidate: '', onsubmit: async (ev) => {
    ev.preventDefault();
    err.hidden = true;
    const n = normalizePhone(phone.value);
    if (!name.value.trim()) { err.hidden = false; err.textContent = L('اكتب الاسم.', 'Enter the name.'); name.focus(); return; }
    if (!n) { err.hidden = false; err.textContent = L('رقم الجوال غير صالح.', 'The phone number is not valid.'); phone.focus(); return; }
    const now = new Date().toISOString();
    const row = {
      full_name: name.value.trim(), phone: n, preferred_lang: lang.value, notes: notes.value.trim() || null,
      whatsapp_opt_in: optIn.checked,
      opted_out_at: optOut.checked ? (e.opted_out_at || now) : null
    };
    if (optIn.checked) {
      row.opt_in_source = source.value;
      row.opt_in_at = e.whatsapp_opt_in && e.opt_in_at ? e.opt_in_at : now;
    }
    save.disabled = true;
    try {
      const saved = existing ? await updateRow('clients', existing.id, row) : await insertRow('clients', row);
      toast(L('تم الحفظ', 'Saved'), 'ok');
      close();
      if (onSaved) onSaved(saved);
    } catch (ex) {
      save.disabled = false;
      err.hidden = false;
      err.textContent = explain(ex);
    }
  } },
  field(L('الاسم', 'Name'), name),
  h('div', null, field(L('رقم الجوال', 'Phone'), phone), phoneHint),
  field(L('لغة الرسائل', 'Message language'), lang),
  h('fieldset', { class: 'consent' },
    h('legend', null, L('الموافقة على الرسائل الترويجية', 'Consent for promotional messages')),
    h('label', { class: 'check' }, optIn, L('وافق العميل على استلام العروض عبر واتساب', 'Client agreed to receive offers on WhatsApp')),
    field(L('مصدر الموافقة', 'Where the consent was given'), source),
    h('label', { class: 'check' }, optOut, L('طلب العميل إيقاف الرسائل الترويجية', 'Client asked to stop promotional messages'))),
  field(L('ملاحظات', 'Notes'), notes),
  err,
  h('div', { class: 'row end' }, save));
  const close = modal(existing ? L('تعديل العميل', 'Edit client') : L('عميل جديد', 'New client'), form);
}

export function renderClients(root, rerender) {
  const q = h('input', { type: 'search', placeholder: L('بحث بالاسم أو الرقم', 'Search by name or number'), 'aria-label': L('بحث', 'Search'), autocomplete: 'off' });
  const list = h('ul', { class: 'list' });
  const count = h('p', { class: 'muted' });
  const LIMIT = 100;

  const draw = () => {
    const term = q.value.trim().toLowerCase();
    const digits = term.replace(/\D/g, '');
    const found = state.data.clients.filter((c) => !term || c.full_name.toLowerCase().includes(term) || (digits.length >= 3 && c.phone.includes(digits)));
    list.replaceChildren(...found.slice(0, LIMIT).map((c) => {
      const appts = state.data.appointments.filter((a) => a.client_id === c.id).length;
      return h('li', { class: 'item col' },
        h('div', { class: 'item-main' },
          h('strong', null, c.full_name), ' ', ltr(formatPhone(c.phone)),
          h('div', { class: 'sub' }, consentBadge(c), ' ', badge(L('مواعيد: ', 'Appointments: ') + appts, ''))),
        h('div', { class: 'row' },
          h('button', { class: 'btn line sm', type: 'button', onclick: () => openClientForm(c, rerender) }, L('تعديل', 'Edit')),
          h('button', { class: 'btn line sm', type: 'button', onclick: () => openAppointmentForm({ client: c }, rerender) }, L('موعد', 'Appointment')),
          h('button', { class: 'btn line sm', type: 'button', onclick: () => openSend({ client: c, onDone: rerender }) }, L('رسالة', 'Message')),
          h('a', { class: 'btn line sm', href: waLink(c.phone), target: '_blank', rel: 'noopener noreferrer' }, L('محادثة', 'Chat')),
          h('button', { class: 'btn danger sm', type: 'button', onclick: async () => {
            const ok = await confirmDialog(
              L('حذف ' + c.full_name + ' نهائياً مع كل مواعيده وسجل رسائله؟ لا يمكن التراجع.', 'Delete ' + c.full_name + ' with all appointments and message history? This cannot be undone.'),
              L('حذف', 'Delete'), true);
            if (!ok) return;
            try { await deleteRow('clients', c.id); toast(L('تم الحذف', 'Deleted'), 'ok'); rerender(); } catch (ex) { toast(explain(ex), 'err'); }
          } }, L('حذف', 'Delete'))));
    }));
    count.textContent = found.length > LIMIT
      ? L('يظهر أول ' + LIMIT + ' من ' + found.length + '. ضيّق البحث.', 'Showing the first ' + LIMIT + ' of ' + found.length + '. Narrow the search.')
      : (found.length ? '' : L('لا توجد نتائج.', 'No results.'));
  };
  q.addEventListener('input', draw);

  root.appendChild(h('div', { class: 'head' }, h('h1', null, L('العملاء', 'Clients')),
    h('button', { class: 'btn primary', type: 'button', onclick: () => openClientForm(null, rerender) }, L('+ عميل', '+ Client'))));
  root.appendChild(q);
  root.appendChild(count);
  root.appendChild(list);
  draw();
}
