// Tiny DOM helpers. Everything is built with createElement and textContent, never innerHTML,
// so client names and notes can never run as code.
import { L } from './state.js';

function append(el, kids) {
  for (const k of kids) {
    if (k == null || k === false) continue;
    if (Array.isArray(k)) append(el, k);
    else el.appendChild(k instanceof Node ? k : document.createTextNode(String(k)));
  }
}

export function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  let value;
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'value') value = v;
    else if (k === 'checked' || k === 'disabled' || k === 'selected' || k === 'readOnly') el[k] = true;
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  append(el, kids);
  if (value !== undefined) el.value = value;     // after children, so <select> options exist
  return el;
}

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

export function ltr(text) {
  return h('span', { class: 'ltr' }, text);
}

/* ---------- toast ---------- */
let toastTimer;
export function toast(message, kind) {
  let box = document.getElementById('toast');
  if (!box) {
    box = h('div', { id: 'toast', role: 'status', 'aria-live': 'polite' });
    document.body.appendChild(box);
  }
  box.className = 'toast show ' + (kind || '');
  box.textContent = message;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { box.className = 'toast'; }, kind === 'err' ? 7000 : 3500);
}

/* ---------- modal ---------- */
const openModals = [];

export function modal(title, body, opts = {}) {
  const prev = document.activeElement;
  const close = () => {
    const i = openModals.indexOf(entry);
    if (i >= 0) openModals.splice(i, 1);
    overlay.remove();
    if (!openModals.length) document.body.classList.remove('modal-open');
    if (prev && prev.focus) prev.focus();
    if (opts.onClose) opts.onClose();
  };
  const closeBtn = h('button', { class: 'icon-btn', type: 'button', 'aria-label': L('إغلاق', 'Close'), onclick: close }, '×');
  const dlg = h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h('div', { class: 'modal-head' }, h('h2', null, title), closeBtn),
    h('div', { class: 'modal-body' }, body));
  const overlay = h('div', { class: 'overlay', onmousedown: (e) => { if (e.target === overlay && !opts.sticky) close(); } }, dlg);
  const entry = { close };
  openModals.push(entry);
  document.body.classList.add('modal-open');
  document.body.appendChild(overlay);
  const first = dlg.querySelector('input:not([type=hidden]), select, textarea, button.primary');
  (first || closeBtn).focus();
  return close;
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && openModals.length) openModals[openModals.length - 1].close();
});

export function closeAllModals() {
  while (openModals.length) openModals[openModals.length - 1].close();
}

export function confirmDialog(message, okLabel, danger) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (!done) { done = true; resolve(v); close(); } };
    const body = h('div', null,
      h('p', null, message),
      h('div', { class: 'row end' },
        h('button', { class: 'btn line', type: 'button', onclick: () => finish(false) }, L('إلغاء', 'Cancel')),
        h('button', { class: 'btn ' + (danger ? 'danger' : 'primary'), type: 'button', onclick: () => finish(true) }, okLabel || L('تأكيد', 'Confirm'))));
    const close = modal(L('تأكيد', 'Please confirm'), body, { onClose: () => { if (!done) { done = true; resolve(false); } } });
  });
}

/* ---------- small pieces ---------- */
export function badge(text, kind) {
  return h('span', { class: 'badge ' + (kind || '') }, text);
}

export function field(label, control, hint) {
  return h('label', { class: 'field' }, h('span', { class: 'lbl' }, label), control, hint ? h('span', { class: 'hint' }, hint) : null);
}

export function download(filename, text, mime) {
  const url = URL.createObjectURL(new Blob([text], { type: mime || 'text/plain;charset=utf-8' }));
  const a = h('a', { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    const ta = h('textarea', { 'aria-hidden': 'true', class: 'offscreen' });
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e2) { ok = false; }
    ta.remove();
    return ok;
  }
}
