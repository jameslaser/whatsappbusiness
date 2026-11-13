// Message templates: reminder, before-session and after-session texts. A template can be sent only after the clinic approves it.
import { state, L } from '../state.js';
import { h, badge, modal, toast, confirmDialog, field } from '../ui.js';
import { insertRow, updateRow, deleteRow, explain } from '../data.js';
import { VARS, render, sampleVars, unknownVars } from '../lib/templates.js';
import { lint, hasPlaceholders } from '../lib/lint.js';

const KINDS = [['reminder', 'تذكير', 'Reminder'], ['pre', 'قبل الجلسة', 'Before'], ['post', 'بعد الجلسة', 'After'], ['custom', 'مخصص', 'Custom']];
const kindName = (k) => { const r = KINDS.find((x) => x[0] === k); return r ? L(r[1], r[2]) : k; };

// Problems that stop approval, as readable lines.
export function templateProblems(ar, en) {
  const p = [];
  if (!ar.trim() || !en.trim()) p.push(L('اكتب النص بالعربية والإنجليزية.', 'Write the text in both Arabic and English.'));
  if (hasPlaceholders(ar) || hasPlaceholders(en)) p.push(L('ما زالت في النص أقواس [ ] تعني أنه غير مكتمل.', 'The text still has [ ] brackets, so it is not finished.'));
  const bad = [...new Set([...lint(ar), ...lint(en)])];
  if (bad.length) p.push(L('عبارات يجب تجنبها: ', 'Wording to avoid: ') + bad.join('، '));
  const unk = [...new Set([...unknownVars(ar), ...unknownVars(en)])];
  if (unk.length) p.push(L('متغيرات غير معروفة: ', 'Unknown variables: ') + unk.map((v) => '{{' + v + '}}').join(' '));
  return p;
}

function openEditor(t, rerender) {
  const ar = h('textarea', { rows: '8', dir: 'rtl', 'aria-label': L('النص العربي', 'Arabic text') }, t.body_ar);
  const en = h('textarea', { rows: '8', dir: 'ltr', 'aria-label': L('النص الإنجليزي', 'English text') }, t.body_en);
  const prevAr = h('pre', { class: 'preview-box', dir: 'rtl' });
  const prevEn = h('pre', { class: 'preview-box', dir: 'ltr' });
  const problems = h('ul', { class: 'problems' });
  let active = ar;

  const insert = (v) => {
    const el = active;
    const s = el.selectionStart ?? el.value.length;
    const e = el.selectionEnd ?? s;
    const txt = '{{' + v + '}}';
    el.value = el.value.slice(0, s) + txt + el.value.slice(e);
    el.selectionStart = el.selectionEnd = s + txt.length;
    el.focus();
    update();
  };
  const chips = h('div', { class: 'chips' }, VARS.map((v) => h('button', { class: 'chip', type: 'button', onmousedown: (ev) => ev.preventDefault(), onclick: () => insert(v) }, '{{' + v + '}}')));
  ar.addEventListener('focus', () => { active = ar; });
  en.addEventListener('focus', () => { active = en; });

  const update = () => {
    prevAr.textContent = render(ar.value, sampleVars('ar'));
    prevEn.textContent = render(en.value, sampleVars('en'));
    const p = templateProblems(ar.value, en.value);
    problems.replaceChildren(...p.map((x) => h('li', null, x)));
    approveBtn.disabled = p.length > 0;
  };
  ar.addEventListener('input', update);
  en.addEventListener('input', update);

  const persist = async (approve) => {
    const patch = { body_ar: ar.value, body_en: en.value };
    if (approve) { patch.approved = true; patch.approved_at = new Date().toISOString(); }
    else { patch.approved = false; patch.approved_at = null; }   // saving as a draft always withdraws approval
    try {
      await updateRow('message_templates', t.code, patch);
      toast(approve ? L('تم الاعتماد', 'Approved') : L('تم الحفظ كمسودة', 'Saved as draft'), 'ok');
      close();
      rerender();
    } catch (ex) { toast(explain(ex), 'err'); }
  };

  const approveBtn = h('button', { class: 'btn primary', type: 'button', onclick: () => persist(true) }, L('حفظ واعتماد', 'Save & approve'));
  const draftBtn = h('button', { class: 'btn line', type: 'button', onclick: () => persist(false) }, L('حفظ كمسودة', 'Save as draft'));

  const body = h('div', null,
    h('p', { class: 'note' }, t.kind === 'pre' || t.kind === 'post'
      ? L('هذا نص طبي: تكتبه العيادة وتعتمده بنفسها. لا تعتمد على نص مولَّد آلياً دون مراجعة المختص المرخّص.', 'This is medical guidance: the clinic writes and approves it. Do not rely on machine-written text without review by the licensed practitioner.')
      : L('الرسالة لا تُرسل إلا بعد الاعتماد.', 'The message can be sent only after you approve it.')),
    field(L('النص العربي', 'Arabic text'), ar),
    field(L('النص الإنجليزي', 'English text'), en),
    h('p', { class: 'lbl' }, L('أدخل متغيراً في المكان الحالي:', 'Insert a variable at the cursor:')), chips,
    h('p', { class: 'lbl' }, L('معاينة بقيم تجريبية', 'Preview with sample values')), prevAr, prevEn,
    problems,
    h('div', { class: 'row end' }, draftBtn, approveBtn));
  const close = modal(t.title, body, { sticky: true });
  update();
}

export function renderMessages(root, rerender) {
  root.appendChild(h('div', { class: 'head' }, h('h1', null, L('الرسائل', 'Messages')),
    h('button', { class: 'btn primary', type: 'button', onclick: () => openNew(rerender) }, L('+ قالب', '+ Template'))));
  root.appendChild(h('p', { class: 'muted' }, L(
    'القوالب هي نصوص التذكير وتعليمات ما قبل الجلسة وما بعدها. لا يمكن إرسال أي منها قبل اعتمادها، وأي تعديل يلغي الاعتماد. هذه القوالب لا تغيّر ردود الواتساب الآلية في الخادم.',
    'Templates are the reminder and the before and after instructions. None can be sent until approved, and any edit removes the approval. These templates do not change the automatic WhatsApp replies on the server.')));
  root.appendChild(h('ul', { class: 'list' }, state.data.templates.map((t) => {
    const probs = templateProblems(t.body_ar, t.body_en);
    return h('li', { class: 'item col' },
      h('div', { class: 'item-main' }, h('strong', null, t.title), ' ', badge(kindName(t.kind), ''), ' ',
        t.approved ? badge(L('معتمد', 'Approved'), 'green') : badge(L('غير معتمد', 'Not approved'), 'gold'),
        !t.approved && probs.length ? h('div', { class: 'sub' }, probs[0]) : null),
      h('div', { class: 'row' },
        h('button', { class: 'btn line sm', type: 'button', onclick: () => openEditor(t, rerender) }, L('تعديل', 'Edit')),
        t.kind === 'custom' ? h('button', { class: 'btn danger sm', type: 'button', onclick: async () => {
          if (!(await confirmDialog(L('حذف هذا القالب؟', 'Delete this template?'), L('حذف', 'Delete'), true))) return;
          try { await deleteRow('message_templates', t.code); toast(L('تم الحذف', 'Deleted'), 'ok'); rerender(); } catch (ex) { toast(explain(ex), 'err'); }
        } }, L('حذف', 'Delete')) : null));
  })));
}

function openNew(rerender) {
  const title = h('input', { type: 'text', maxlength: '80', autocomplete: 'off' });
  const code = h('input', { type: 'text', maxlength: '40', dir: 'ltr', placeholder: 'follow_up', autocomplete: 'off' });
  const err = h('p', { class: 'note warn', hidden: '' });
  const form = h('form', { novalidate: '', onsubmit: async (ev) => {
    ev.preventDefault();
    err.hidden = true;
    const c = code.value.trim().toLowerCase();
    if (!title.value.trim() || !/^[a-z0-9_]{2,40}$/.test(c)) { err.hidden = false; err.textContent = L('اكتب عنواناً ورمزاً بأحرف إنجليزية صغيرة وأرقام و _ فقط.', 'Enter a title and a code using lowercase letters, numbers and _ only.'); return; }
    if (state.data.templates.some((t) => t.code === c)) { err.hidden = false; err.textContent = L('هذا الرمز مستخدم.', 'This code is already used.'); return; }
    try {
      await insertRow('message_templates', { code: c, kind: 'custom', title: title.value.trim() });
      close();
      rerender();
    } catch (ex) { err.hidden = false; err.textContent = explain(ex); }
  } }, field(L('العنوان', 'Title'), title), field(L('الرمز', 'Code'), code), err,
  h('div', { class: 'row end' }, h('button', { class: 'btn primary', type: 'submit' }, L('إنشاء', 'Create'))));
  const close = modal(L('قالب جديد', 'New template'), form);
}
