// Shared app state and the language helper. Arabic is the default language.
const KEY = 'jl_admin_lang';

export const state = {
  lang: 'ar',
  user: null,
  data: { areas: [], clients: [], appointments: [], templates: [], offers: [], log: [] }
};

try {
  const v = localStorage.getItem(KEY);
  if (v === 'en' || v === 'ar') state.lang = v;
} catch (e) { /* storage unavailable: keep the default */ }

export const L = (ar, en) => (state.lang === 'ar' ? ar : en);

export function applyLang() {
  document.documentElement.lang = state.lang;
  document.documentElement.dir = state.lang === 'ar' ? 'rtl' : 'ltr';
}

export function setLang(l) {
  state.lang = l === 'en' ? 'en' : 'ar';
  try { localStorage.setItem(KEY, state.lang); } catch (e) { /* ignore */ }
  applyLang();
}

export function clientById(id) {
  return state.data.clients.find((c) => c.id === id);
}
