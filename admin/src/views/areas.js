// Treatment areas used by appointments and the booking page. Areas are never deleted here (turn them off instead),
// so old appointments keep their names. The public booking page reads site/data/areas.js, so changes reach it
// only after you download the file below and replace it in the repository.
import { state, L } from '../state.js';
import { h, badge, modal, toast, field, download } from '../ui.js';
import { insertRow, updateRow, explain } from '../data.js';

export function buildAreasJs(areas) {
  const active = areas.filter((a) => a.active).sort((x, y) => x.sort_order - y.sort_order);
  const collections = [];
  const rows = active.map((a) => {
    let i = collections.findIndex((c) => c.ar === a.collection_ar);
    if (i < 0) { collections.push({ ar: a.collection_ar, en: a.collection_en }); i = collections.length - 1; }
    return { ar: a.name_ar, en: a.name_en, collection: i, code: a.code };
  });
  return '/* Source: WhatsApp catalog (' + rows.length + ' areas, ' + collections.length + ' collections). Edit here to change every page. */\n' +
    'window.JLWA_AREAS = ' + JSON.stringify({ collections, areas: rows }, null, 2) + ';\n';
}

function openEditor(a, rerender) {
  const e = a || {};
  const known = [...new Map(state.data.areas.map((x) => [x.collection_ar, x.collection_en])).entries()];
  const f = {
    code: h('input', { type: 'text', dir: 'ltr', maxlength: '20', value: e.code || '', placeholder: 'FACE-06', disabled: a ? true : null }),
    name_ar: h('input', { type: 'text', dir: 'rtl', value: e.name_ar || '' }),
    name_en: h('input', { type: 'text', dir: 'ltr', value: e.name_en || '' }),
    coll: h('select', null, known.map(([ar, en]) => h('option', { value: ar }, L(ar, en)))),
    sort: h('input', { type: 'number', dir: 'ltr', value: String(e.sort_order ?? (Math.max(0, ...state.data.areas.map((x) => x.sort_order)) + 10)) }),
    active: h('input', { type: 'checkbox', checked: e.active === false ? null : true })
  };
  if (e.collection_ar) f.coll.value = e.collection_ar;
  const err = h('p', { class: 'note warn', hidden: '' });
  const form = h('form', { novalidate: '', onsubmit: async (ev) => {
    ev.preventDefault();
    err.hidden = true;
    const code = f.code.value.trim().toUpperCase();
    if (!/^[A-Z]+-[0-9]{2}$/.test(code)) { err.hidden = false; err.textContent = L('الرمز مثل FACE-06 (حروف إنجليزية كبيرة، شرطة، رقمان).', 'The code looks like FACE-06 (capital letters, a dash, two digits).'); return; }
    if (!f.name_ar.value.trim() || !f.name_en.value.trim()) { err.hidden = false; err.textContent = L('اكتب الاسم بالعربية والإنجليزية.', 'Write the name in Arabic and English.'); return; }
    const coll = known.find(([ar]) => ar === f.coll.value);
    const row = {
      name_ar: f.name_ar.value.trim(), name_en: f.name_en.value.trim(),
      collection_ar: coll[0], collection_en: coll[1],
      sort_order: parseInt(f.sort.value, 10) || 0, active: f.active.checked
    };
    try {
      if (a) await updateRow('areas', a.code, row); else await insertRow('areas', { code, ...row });
      toast(L('تم الحفظ', 'Saved'), 'ok');
      close();
      rerender();
    } catch (ex) { err.hidden = false; err.textContent = explain(ex); }
  } },
  field(L('الرمز', 'Code'), f.code), field(L('الاسم (عربي)', 'Name (Arabic)'), f.name_ar), field(L('الاسم (إنجليزي)', 'Name (English)'), f.name_en),
  field(L('المجموعة', 'Group'), f.coll), field(L('الترتيب', 'Order'), f.sort),
  h('label', { class: 'check' }, f.active, L('فعّالة (تظهر في المواعيد)', 'Active (shown in appointments)')),
  err, h('div', { class: 'row end' }, h('button', { class: 'btn primary', type: 'submit' }, L('حفظ', 'Save'))));
  const close = modal(a ? L('تعديل المنطقة', 'Edit area') : L('منطقة جديدة', 'New area'), form);
}

export function renderAreas(root, rerender) {
  root.appendChild(h('div', { class: 'head' }, h('h1', null, L('المناطق', 'Areas')),
    h('button', { class: 'btn primary', type: 'button', onclick: () => openEditor(null, rerender) }, L('+ منطقة', '+ Area'))));
  root.appendChild(h('div', { class: 'card' },
    h('p', null, L('صفحات الحجز العامة تقرأ ملف areas.js داخل المستودع، فلا تتغير تلقائياً. بعد التعديل نزّل الملف واستبدل به site/data/areas.js ثم ادفع التغيير.',
      'The public booking pages read areas.js from the repository, so they do not change by themselves. After editing, download the file, replace site/data/areas.js with it and push the change.')),
    h('button', { class: 'btn line', type: 'button', onclick: () => download('areas.js', buildAreasJs(state.data.areas), 'text/javascript;charset=utf-8') }, L('تنزيل areas.js', 'Download areas.js'))));
  root.appendChild(h('ul', { class: 'list' }, [...state.data.areas].sort((x, y) => x.sort_order - y.sort_order).map((a) =>
    h('li', { class: 'item' },
      h('div', { class: 'item-main' }, h('strong', null, L(a.name_ar, a.name_en)), ' ', h('span', { class: 'ltr muted' }, a.code), ' ',
        a.active ? null : badge(L('متوقفة', 'Off'), ''),
        h('div', { class: 'sub' }, L(a.collection_ar, a.collection_en))),
      h('div', { class: 'row' },
        h('button', { class: 'btn line sm', type: 'button', onclick: () => openEditor(a, rerender) }, L('تعديل', 'Edit')),
        h('button', { class: 'btn line sm', type: 'button', onclick: async () => {
          try { await updateRow('areas', a.code, { active: !a.active }); rerender(); } catch (ex) { toast(explain(ex), 'err'); }
        } }, a.active ? L('إيقاف', 'Turn off') : L('تفعيل', 'Turn on')))))));
}
