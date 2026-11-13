/* Floating WhatsApp button for the Blogger blog (or any page). Self-contained: no libraries, no tracking.
   Optional settings, set in a separate script block BEFORE this one:
     window.JLWA_BUTTON = { lang: 'auto' | 'ar' | 'en', position: 'left' | 'right' };            */
(function () {
  if (window.__jlwaButton) { return; }
  window.__jlwaButton = true;

  var opt = window.JLWA_BUTTON || {};
  var NUMBER = '966557401562';
  var BRAND = 'James Laser Hair Removal for Men';

  function pickLang() {
    if (opt.lang === 'ar' || opt.lang === 'en') { return opt.lang; }
    var list = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || ''];
    for (var i = 0; i < list.length; i++) {
      if (/^ar/i.test(list[i])) { return 'ar'; }
    }
    return 'en';
  }

  var lang = pickLang();
  var side = opt.position === 'right' ? 'right' : 'left';

  var title = (document.title || '').replace(/\s+/g, ' ').trim();
  if (title.length > 80) { title = title.slice(0, 77) + '...'; }
  var page = location.origin + location.pathname;   // no query string or hash

  var text;
  var label;
  var aria;
  if (lang === 'ar') {
    text = 'السلام عليكم، أود الاستفسار عن خدمات ' + BRAND + '.' + (title ? '\n(من صفحة: ' + title + ' ' + page + ')' : '');
    label = 'واتساب';
    aria = 'تواصل عبر واتساب';
  } else {
    text = 'Hello, I would like to ask about the services of ' + BRAND + '.' + (title ? '\n(From the page: ' + title + ' ' + page + ')' : '');
    label = 'WhatsApp';
    aria = 'Chat on WhatsApp';
  }

  var css = '' +
    '#jlwa-btn{position:fixed;bottom:18px;' + side + ':18px;z-index:2147483000;display:inline-flex;align-items:center;gap:8px;' +
    'min-height:52px;padding:0 18px 0 14px;border-radius:999px;background:#0a1a2b;color:#f1ece1;border:1.5px solid #c3a56a;' +
    'font:600 15px/1 system-ui,-apple-system,"Segoe UI",Tahoma,Arial,sans-serif;text-decoration:none;box-shadow:0 6px 18px rgba(0,0,0,.28);' +
    'transition:transform .15s ease,background .15s ease}' +
    '#jlwa-btn:hover{background:#13293f;transform:translateY(-1px)}' +
    '#jlwa-btn:focus-visible{outline:3px solid #c3a56a;outline-offset:3px}' +
    '#jlwa-btn svg{color:#c3a56a;flex:none}' +
    '@media print{#jlwa-btn{display:none}}' +
    '@media (prefers-reduced-motion:reduce){#jlwa-btn{transition:none}}';

  var style = document.createElement('style');
  style.setAttribute('data-jlwa', '');
  style.appendChild(document.createTextNode(css));
  document.head.appendChild(style);

  var a = document.createElement('a');
  a.id = 'jlwa-btn';
  a.href = 'https://wa.me/' + NUMBER + '?text=' + encodeURIComponent(text);
  a.target = '_blank';
  a.rel = 'noopener';
  a.setAttribute('aria-label', aria);
  a.setAttribute('lang', lang);
  a.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
  a.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M4 4h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-5 4v-4H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/></svg><span></span>';
  a.lastChild.appendChild(document.createTextNode(label));

  function mount() { document.body.appendChild(a); }
  if (document.body) { mount(); } else { document.addEventListener('DOMContentLoaded', mount); }
})();
