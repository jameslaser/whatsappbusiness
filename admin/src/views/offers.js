// Offers and promotions. Rules shown here mirror the database: regional approval number, at most 60 days,
// only approved offers inside their dates, only to clients who agreed and have not opted out.
import { state, L } from '../state.js';
import { h, ltr, badge, modal, toast, confirmDialog, field, copyText } from '../ui.js';
import { insertRow, updateRow, deleteRow, explain } from '../data.js';
import { riyadhYmd, fmtYmd } from '../lib/dates.js';
import { offerState, offerProblems, offerLint, composeOffer, canReceiveOffers, spanDays } from '../lib/offers.js';
import { formatPhone } from '../lib/phone.js';
import { sentOfferTo, markOfferSent, offerLink } from './send.js';

const STATE_LABEL = {
  draft: ['مسودة', 'Draft', ''], upcoming: ['قادم', 'Upcoming', 'blue'], active: ['ساري', 'Active', 'green'],
  expired: ['منتهي', 'Expired', ''], withdrawn: ['مسحوب', 'Withdrawn', 'red']
};

function problemText(code, o) {
  switch (code) {
    case 'text': return L('اكتب العنوان والنص بالعربية والإنجليزية.', 'Write the title and text in Arabic and English.');
    case 'approval_number': return L('أدخل رقم الموافقة من الإدارة الصحية.', 'Enter the approval number from the regional health authority.');
    case 'dates': return L('حدّد تاريخ البداية والنهاية.', 'Set the start and end dates.');
    case 'order': return L('تاريخ النهاية قبل البداية.', 'The end date is before the start date.');
    case 'span': return L('المدة ' + spanDays(o.starts_on, o.ends_on) + ' يوماً، والحد الأقصى 60.', 'The offer runs ' + spanDays(o.starts_on, o.ends_on) + ' days; the maximum is 60.');
    case 'lint': return L('عبارات يجب تجنبها: ', 'Wording to avoid: ') + offerLint(o).join('، ');
    case 'placeholder': return L('ما زالت في النص أقواس [ ].', 'The text still has [ ] brackets.');
    default: return code;
  }
}

function openEditor(existing, rerender) {
  const e = existing || {};
  const f = {
    title_ar: h('input', { type: 'text', maxlength: '120', dir: 'rtl', value: e.title_ar || '' }),
    title_en: h('input', { type: 'text', maxlength: '120', dir: 'ltr', value: e.title_en || '' }),
    body_ar: h('textarea', { rows: '4', dir: 'rtl' }, e.body_ar || ''),
    body_en: h('textarea', { rows: '4', dir: 'ltr' }, e.body_en || ''),
    starts_on: h('input', { type: 'date', value: e.starts_on || '' }),
    ends_on: h('input', { type: 'date', value: e.ends_on || '' }),
    approval_number: h('input', { type: 'text', maxlength: '60', dir: 'ltr', value: e.approval_number || '', autocomplete: 'off' })
  };
  const problems = h('ul', { class: 'problems' });
  const preview = h('pre', { class: 'preview-box', dir: 'auto' });
  const read = () => ({
    title_ar: f.title_ar.value.trim(), title_en: f.title_en.value.trim(), body_ar: f.body_ar.value.trim(), body_en: f.body_en.value.trim(),
    starts_on: f.starts_on.value || null, ends_on: f.ends_on.value || null, approval_number: f.approval_number.value.trim() || null
  });
  const update = () => {
    const o = read();
    const p = offerProblems(o);
    problems.replaceChildren(...p.map((c) => h('li', null, problemText(c, o))));
    approveBtn.disabled = p.length > 0;
    preview.textContent = p.some((c) => ['text', 'approval_number', 'dates', 'order'].includes(c)) ? L('تظهر المعاينة بعد استكمال البيانات.', 'The preview appears once the details are complete.') : composeOffer(o);
  };
  Object.values(f).forEach((el) => el.addEventListener('input', update));

  const persist = async (approve) => {
    const patch = { ...read(), status: approve ? 'approved' : 'draft' };
    try {
      if (existing) await updateRow('offers', existing.id, patch); else await insertRow('offers', patch);
      toast(approve ? L('تم اعتماد العرض', 'Offer approved') : L('تم الحفظ كمسودة', 'Saved as draft'), 'ok');
      close();
      rerender();
    } catch (ex) { toast(explain(ex), 'err'); }
  };
  const approveBtn = h('button', { class: 'btn primary', type: 'button', onclick: () => persist(true) }, L('حفظ واعتماد', 'Save & approve'));
  const draftBtn = h('button', { class: 'btn line', type: 'button', onclick: () => persist(false) }, L('حفظ كمسودة', 'Save as draft'));

  const body = h('div', null,
    h('p', { class: 'note' }, L('العرض يحتاج موافقة الإدارة الصحية المختصة، ولا تزيد مدته على 60 يوماً، ويظهر رقم الموافقة في كل رسالة. أي تعديل يعيد العرض إلى مسودة.',
      'An offer needs approval from the regional health authority, lasts at most 60 days, and shows the approval number in every message. Any edit returns it to a draft.')),
    field(L('العنوان (عربي)', 'Title (Arabic)'), f.title_ar), field(L('العنوان (إنجليزي)', 'Title (English)'), f.title_en),
    field(L('النص (عربي)', 'Text (Arabic)'), f.body_ar), field(L('النص (إنجليزي)', 'Text (English)'), f.body_en),
    h('div', { class: 'grid2' }, field(L('يبدأ', 'Starts'), f.starts_on), field(L('ينتهي', 'Ends'), f.ends_on)),
    field(L('رقم الموافقة', 'Approval number'), f.approval_number),
    h('p', { class: 'lbl' }, L('الرسالة كما ستُرسل', 'Message as it will be sent')), preview, problems,
    h('div', { class: 'row end' }, draftBtn, approveBtn));
  const close = modal(existing ? L('تعديل العرض', 'Edit offer') : L('عرض جديد', 'New offer'), body, { sticky: true });
  update();
}

function openRecipients(offer, rerender) {
  const today = riyadhYmd();
  const st = offerState(offer, today);
  const body = h('div');
  if (st !== 'active') {
    body.appendChild(h('p', { class: 'note warn' }, st === 'upcoming'
      ? L('يبدأ العرض في ' + fmtYmd(offer.starts_on, 'ar') + '. لا يمكن الإرسال قبل ذلك.', 'The offer starts on ' + fmtYmd(offer.starts_on, 'en') + '. Sending opens then.')
      : L('الإرسال متاح فقط للعرض المعتمد وضمن تواريخه.', 'Sending is possible only for an approved offer inside its dates.')));
    modal(offer.title_ar, body);
    return;
  }
  const people = state.data.clients.filter(canReceiveOffers);
  const skipped = state.data.clients.length - people.length;
  body.appendChild(h('p', { class: 'muted' }, L(people.length + ' عميل وافقوا على العروض. تم استبعاد ' + skipped + ' بدون موافقة أو أوقفوا الرسائل.',
    people.length + ' clients agreed to offers. ' + skipped + ' left out (no consent, or opted out).')));
  const copyBtn = h('button', { class: 'btn line', type: 'button', onclick: async () => toast((await copyText(composeOffer(offer))) ? L('تم النسخ', 'Copied') : L('تعذّر النسخ', 'Could not copy'), 'ok') }, L('نسخ نص العرض', 'Copy offer text'));
  body.appendChild(h('div', { class: 'row' }, copyBtn));
  const list = h('ul', { class: 'list' });
  const draw = () => list.replaceChildren(...people.map((c) => {
    const sent = sentOfferTo(offer, c);
    const mark = h('button', { class: 'btn line sm', type: 'button', disabled: sent ? true : null, onclick: async () => {
      mark.disabled = true;
      try { await markOfferSent(offer, c); toast(L('تم تسجيل الإرسال', 'Marked as sent'), 'ok'); draw(); } catch (ex) { mark.disabled = false; toast(explain(ex), 'err'); }
    } }, sent ? L('أُرسل', 'Sent') : L('تم الإرسال', 'Mark as sent'));
    return h('li', { class: 'item' },
      h('div', { class: 'item-main' }, h('strong', null, c.full_name), ' ', ltr(formatPhone(c.phone))),
      h('div', { class: 'row' }, h('a', { class: 'btn primary sm', href: offerLink(offer, c), target: '_blank', rel: 'noopener noreferrer' }, L('فتح واتساب', 'Open WhatsApp')), mark));
  }));
  draw();
  body.appendChild(list);
  body.appendChild(h('p', { class: 'hint' }, L('لا يُرسل شيء تلقائياً. بعد الإرسال من واتساب اضغط «تم الإرسال».', 'Nothing is sent automatically. After sending in WhatsApp, tap Mark as sent.')));
  modal(offer.title_ar, body, { onClose: rerender });
}

export function renderOffers(root, rerender) {
  const today = riyadhYmd();
  root.appendChild(h('div', { class: 'head' }, h('h1', null, L('العروض', 'Offers')),
    h('button', { class: 'btn primary', type: 'button', onclick: () => openEditor(null, rerender) }, L('+ عرض', '+ Offer'))));
  if (!state.data.offers.length) root.appendChild(h('p', { class: 'muted' }, L('لا توجد عروض بعد.', 'No offers yet.')));
  root.appendChild(h('ul', { class: 'list' }, state.data.offers.map((o) => {
    const st = offerState(o, today);
    const [ar, en, kind] = STATE_LABEL[st];
    const sentCount = state.data.log.filter((m) => m.offer_id === o.id && m.status === 'sent').length;
    return h('li', { class: 'item col' },
      h('div', { class: 'item-main' }, h('strong', null, L(o.title_ar, o.title_en)), ' ', badge(L(ar, en), kind),
        h('div', { class: 'sub' }, o.starts_on ? fmtYmd(o.starts_on, state.lang) + ' → ' + fmtYmd(o.ends_on, state.lang) : L('بدون تواريخ', 'No dates'),
          o.approval_number ? ' · ' : '', o.approval_number ? ltr(o.approval_number) : '',
          sentCount ? ' · ' + L('أُرسل إلى ' + sentCount, 'Sent to ' + sentCount) : '')),
      h('div', { class: 'row' },
        h('button', { class: 'btn line sm', type: 'button', onclick: () => openEditor(o, rerender) }, L('تعديل', 'Edit')),
        st === 'draft' || st === 'withdrawn' ? null : h('button', { class: 'btn primary sm', type: 'button', onclick: () => openRecipients(o, rerender) }, L('إرسال', 'Send')),
        st === 'draft' || st === 'withdrawn' ? null : h('button', { class: 'btn line sm', type: 'button', onclick: async () => {
          if (!(await confirmDialog(L('سحب العرض؟ لن يمكن إرساله بعد ذلك.', 'Withdraw this offer? It can no longer be sent.'), L('سحب', 'Withdraw'), true))) return;
          try { await updateRow('offers', o.id, { status: 'withdrawn' }); toast(L('تم سحب العرض', 'Offer withdrawn'), 'ok'); rerender(); } catch (ex) { toast(explain(ex), 'err'); }
        } }, L('سحب', 'Withdraw')),
        h('button', { class: 'btn danger sm', type: 'button', onclick: async () => {
          if (!(await confirmDialog(L('حذف هذا العرض؟', 'Delete this offer?'), L('حذف', 'Delete'), true))) return;
          try { await deleteRow('offers', o.id); toast(L('تم الحذف', 'Deleted'), 'ok'); rerender(); } catch (ex) { toast(explain(ex), 'err'); }
        } }, L('حذف', 'Delete'))));
  })));
}
