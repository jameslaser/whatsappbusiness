import { L } from '../state.js';
import { h } from '../ui.js';
import { sb } from '../data.js';

export function renderLogin(root, onSignedIn) {
  const email = h('input', { type: 'email', name: 'email', autocomplete: 'username', inputmode: 'email', dir: 'ltr', required: '' });
  const pass = h('input', { type: 'password', name: 'password', autocomplete: 'current-password', dir: 'ltr', required: '' });
  const err = h('p', { class: 'note warn', role: 'alert', hidden: '' });
  const btn = h('button', { class: 'btn primary wide', type: 'submit' }, L('دخول', 'Sign in'));
  const form = h('form', { class: 'login', novalidate: '', onsubmit: async (ev) => {
    ev.preventDefault();                       // first line: a password must never be sent in a URL
    err.hidden = true;
    if (!email.value.trim() || !pass.value) { err.hidden = false; err.textContent = L('اكتب البريد وكلمة المرور.', 'Enter your email and password.'); return; }
    btn.disabled = true;
    const { error } = await sb.auth.signInWithPassword({ email: email.value.trim(), password: pass.value });
    btn.disabled = false;
    if (error) {
      err.hidden = false;
      err.textContent = /Failed to fetch|network/i.test(error.message) ? L('تعذّر الاتصال.', 'Could not connect.') : L('البريد أو كلمة المرور غير صحيحة.', 'Wrong email or password.');
      return;
    }
    pass.value = '';
    onSignedIn();
  } },
  h('label', { class: 'field' }, h('span', { class: 'lbl' }, L('البريد الإلكتروني', 'Email')), email),
  h('label', { class: 'field' }, h('span', { class: 'lbl' }, L('كلمة المرور', 'Password')), pass),
  err, btn);
  root.appendChild(h('div', { class: 'login-wrap' },
    h('h1', null, L('لوحة الإدارة', 'Admin portal')),
    h('p', { class: 'muted' }, 'James Laser Hair Removal for Men'),
    form));
}

export function renderNotAdmin(root, onSignOut) {
  root.appendChild(h('div', { class: 'login-wrap' },
    h('h1', null, L('لا توجد صلاحية', 'No access')),
    h('p', null, L('هذا الحساب غير مضاف كمسؤول، أو لا توجد بيانات. اطلب من صاحب النظام إضافته.', 'This account is not an administrator, or no data is available. Ask the system owner to add it.')),
    h('button', { class: 'btn line', type: 'button', onclick: onSignOut }, L('تسجيل الخروج', 'Sign out'))));
}
