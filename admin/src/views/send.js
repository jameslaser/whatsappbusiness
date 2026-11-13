// "Send" dialog. Nothing is sent automatically: the admin reviews the text, taps Open WhatsApp,
// presses send inside WhatsApp, then comes back and taps "Mark as sent" so the log is right.
import { state, L } from '../state.js';
import { h, modal, toast, copyText, badge, ltr } from '../ui.js';
import { insertRow, explain } from '../data.js';
import { buildVars, render, varsIn } from '../lib/templates.js';
import { waLink, formatPhone } from '../lib/phone.js';
import { fmtShort } from '../lib/dates.js';
import { composeOffer } from '../lib/offers.js';

const KIND_LABEL = {
  reminder: ['تذكير بالموعد', 'Appointment reminder'],
  pre: ['تعليمات قبل الجلسة', 'Before the session'],
  post: ['تعليمات بعد الجلسة', 'After the session'],
  custom: ['رسالة', 'Message']
};
export const kindLabel = (k) => (KIND_LABEL[k] ? L(KIND_LABEL[k][0], KIND_LABEL[k][1]) : k);

export function firstTemplate(kind) {
  const all = state.data.templates.filter((t) => t.kind === kind);
  return all.find((t) => t.approved) || all[0] || null;
}

// kind: restrict the template list (reminder / pre / post), or leave empty for every approved template.
export function openSend({ client, appointment, kind, onDone }) {
  const approved = state.data.templates.filter((t) => t.approved && (!kind || t.kind === kind));
  if (!approved.length) {
    modal(L('لا يوجد قالب معتمد', 'No approved template'), h('div', null,
      h('p', null, L('لا يمكن الإرسال قبل اعتماد القالب. افتح «الرسائل»، اكتب النص ثم اعتمده.', 'Nothing can be sent until a template is approved. Open Messages, write the text, then approve it.')),
      h('a', { class: 'btn primary', href: '#/messages' }, L('فتح الرسائل', 'Open Messages'))));
    return;
  }

  let tpl = approved[0];
  let lang = client.preferred_lang === 'en' ? 'en' : 'ar';
  const preview = h('textarea', { class: 'preview', readOnly: true, rows: '9', dir: 'auto', 'aria-label': L('معاينة الرسالة', 'Message preview') });
  const warn = h('p', { class: 'note warn', hidden: '' });
  const sentNote = h('p', { class: 'note ok', hidden: '' });
  const openLink = h('a', { class: 'btn primary', target: '_blank', rel: 'noopener noreferrer' }, L('فتح واتساب', 'Open WhatsApp'));
  const markBtn = h('button', { class: 'btn line', type: 'button' }, L('تم الإرسال', 'Mark as sent'));
  const copyBtn = h('button', { class: 'btn line', type: 'button' }, L('نسخ', 'Copy'));

  const text = () => render(lang === 'ar' ? tpl.body_ar : tpl.body_en, buildVars({ client, appointment, areas: state.data.areas }, lang));

  const refresh = () => {
    const body = lang === 'ar' ? tpl.body_ar : tpl.body_en;
    const needsAppt = varsIn(body).some((v) => ['date', 'time', 'areas'].includes(v));
    const missing = needsAppt && !(appointment && appointment.scheduled_at);
    preview.value = text();
    warn.hidden = !missing;
    warn.textContent = missing ? L('هذا القالب يحتاج موعداً مؤكداً بتاريخ ووقت.', 'This template needs an appointment with a date and time.') : '';
    openLink.href = missing ? '#' : waLink(client.phone, preview.value);
    openLink.setAttribute('aria-disabled', missing ? 'true' : 'false');
    markBtn.disabled = missing;
    const prior = state.data.log.find((m) => m.status === 'sent' && m.client_id === client.id && m.kind === tpl.kind &&
      (!appointment || m.appointment_id === appointment.id));
    sentNote.hidden = !prior;
    sentNote.textContent = prior ? L('سبق تسجيل إرسالها في ', 'Already marked as sent on ') + fmtShort(prior.created_at, state.lang) : '';
  };

  const tplSelect = h('select', {
    onchange: (e) => { tpl = approved.find((t) => t.code === e.target.value); refresh(); }
  }, approved.map((t) => h('option', { value: t.code }, t.title)));
  const langSelect = h('select', { onchange: (e) => { lang = e.target.value; refresh(); } },
    h('option', { value: 'ar' }, 'العربية'), h('option', { value: 'en' }, 'English'));
  langSelect.value = lang;

  openLink.addEventListener('click', (e) => {
    if (openLink.getAttribute('aria-disabled') === 'true') { e.preventDefault(); return; }
    markBtn.classList.remove('line');
    markBtn.classList.add('primary');
  });
  copyBtn.addEventListener('click', async () => {
    toast((await copyText(preview.value)) ? L('تم النسخ', 'Copied') : L('تعذّر النسخ', 'Could not copy'), 'ok');
  });
  markBtn.addEventListener('click', async () => {
    markBtn.disabled = true;
    try {
      await insertRow('message_log', {
        client_id: client.id,
        appointment_id: appointment ? appointment.id : null,
        template_code: tpl.code,
        kind: tpl.kind,
        lang,
        body: preview.value,
        status: 'sent'
      });
      toast(L('تم تسجيل الإرسال', 'Marked as sent'), 'ok');
      close();
      if (onDone) onDone();
    } catch (err) {
      markBtn.disabled = false;
      toast(explain(err), 'err');
    }
  });

  const body = h('div', null,
    h('p', { class: 'who' }, h('strong', null, client.full_name), ' ', ltr(formatPhone(client.phone))),
    h('div', { class: 'grid2' },
      h('label', { class: 'field' }, h('span', { class: 'lbl' }, L('القالب', 'Template')), tplSelect),
      h('label', { class: 'field' }, h('span', { class: 'lbl' }, L('اللغة', 'Language')), langSelect)),
    preview, warn, sentNote,
    h('div', { class: 'row' }, openLink, copyBtn, markBtn),
    h('p', { class: 'hint' }, L('لا يُرسل شيء تلقائياً: افتح واتساب، اضغط إرسال هناك، ثم ارجع واضغط «تم الإرسال».',
      'Nothing is sent automatically: open WhatsApp, press send there, then come back and tap Mark as sent.')));
  const close = modal(kind ? kindLabel(kind) : L('إرسال رسالة', 'Send a message'), body);
  tplSelect.value = tpl.code;
  refresh();
}

// One offer to one client. The database refuses it unless the offer is approved and in date and the client has opted in.
export function sentOfferTo(offer, client) {
  return state.data.log.some((m) => m.kind === 'offer' && m.offer_id === offer.id && m.client_id === client.id && m.status === 'sent');
}

export async function markOfferSent(offer, client) {
  await insertRow('message_log', {
    client_id: client.id, offer_id: offer.id, kind: 'offer', lang: 'both', body: composeOffer(offer), status: 'sent'
  });
}

export function offerLink(offer, client) {
  return waLink(client.phone, composeOffer(offer));
}

export { badge };
