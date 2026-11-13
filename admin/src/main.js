import './config.js';
import { state, L, applyLang, setLang } from './state.js';
import { h, clear, toast, closeAllModals } from './ui.js';
import { sb, loadAll, explain } from './data.js';
import { IDLE_SIGN_OUT_MINUTES } from './config.js';
import { renderLogin, renderNotAdmin } from './views/login.js';
import { renderToday } from './views/today.js';
import { renderAppointments } from './views/appointments.js';
import { renderClients } from './views/clients.js';
import { renderMessages } from './views/messages.js';
import { renderOffers } from './views/offers.js';
import { renderAreas } from './views/areas.js';
import { renderLog } from './views/log.js';

const ROUTES = [
  ['today', 'اليوم', 'Today', renderToday],
  ['appointments', 'المواعيد', 'Appointments', renderAppointments],
  ['clients', 'العملاء', 'Clients', renderClients],
  ['messages', 'الرسائل', 'Messages', renderMessages],
  ['offers', 'العروض', 'Offers', renderOffers],
  ['areas', 'المناطق', 'Areas', renderAreas],
  ['log', 'السجل', 'Log', renderLog]
];

const app = document.getElementById('app');
let signedIn = false;
let idleTimer;

function route() {
  const name = (location.hash.replace(/^#\/?/, '') || 'today').split('?')[0];
  return ROUTES.find((r) => r[0] === name) || ROUTES[0];
}

function header() {
  return h('header', { class: 'top' },
    h('div', { class: 'brand' }, 'James Laser', h('small', null, L('لوحة الإدارة', 'Admin portal'))),
    h('div', { class: 'tools' },
      h('button', { class: 'pill', type: 'button', onclick: () => { setLang(state.lang === 'ar' ? 'en' : 'ar'); closeAllModals(); render(); } }, state.lang === 'ar' ? 'English' : 'العربية'),
      signedIn ? h('button', { class: 'pill', type: 'button', onclick: signOut }, L('خروج', 'Sign out')) : null));
}

function render() {
  applyLang();
  clear(app);
  app.appendChild(header());
  const main = h('main', { class: 'wrap', id: 'main' });
  if (!signedIn) {
    renderLogin(main, start);
    app.appendChild(main);
    return;
  }
  if (!state.data.areas.length) {
    renderNotAdmin(main, signOut);
    app.appendChild(main);
    return;
  }
  const [name, , , view] = route();
  app.appendChild(h('nav', { class: 'tabs', 'aria-label': L('التنقل', 'Navigation') },
    ROUTES.map(([n, ar, en]) => h('a', { href: '#/' + n, class: 'tab' + (n === name ? ' on' : ''), 'aria-current': n === name ? 'page' : null }, L(ar, en)))));
  view(main, rerender);
  app.appendChild(main);
}

function rerender() {
  const y = window.scrollY;
  render();
  window.scrollTo(0, y);
}

async function start() {
  try {
    await loadAll();
    signedIn = true;
    armIdle();
  } catch (e) {
    signedIn = false;
    await sb.auth.signOut();
    toast(explain(e), 'err');
  }
  render();
}

async function signOut() {
  clearTimeout(idleTimer);
  signedIn = false;
  state.data = { areas: [], clients: [], appointments: [], templates: [], offers: [], log: [] };
  closeAllModals();
  await sb.auth.signOut();
  render();
}

function armIdle() {
  const reset = () => {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => { if (signedIn) { toast(L('تم تسجيل الخروج لعدم النشاط.', 'Signed out because of inactivity.')); signOut(); } }, IDLE_SIGN_OUT_MINUTES * 60000);
  };
  if (!armIdle.bound) {
    ['click', 'keydown', 'touchstart', 'scroll'].forEach((ev) => window.addEventListener(ev, () => { if (signedIn) reset(); }, { passive: true }));
    armIdle.bound = true;
  }
  reset();
}

window.addEventListener('hashchange', () => { if (signedIn) { closeAllModals(); render(); window.scrollTo(0, 0); } });

(async () => {
  applyLang();
  const { data } = await sb.auth.getSession();
  if (data && data.session) await start(); else render();
})();
