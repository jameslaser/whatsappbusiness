/* James Laser Hair Removal for Men: WhatsApp helpers.
   No dependencies, no tracking, nothing is sent anywhere except by the visitor tapping "send" inside WhatsApp. */
(function (root) {
  'use strict';

  var CFG = {
    number: '966557401562',
    display: '+966 55 740 1562',
    brand: 'James Laser Hair Removal for Men',
    guide: 'https://jameslaserhairremoval.blogspot.com/2026/11/mens-laser-hair-removal-riyadh.html',
    tz: 'Asia/Riyadh',
    openHour: 13,   // 1:00 PM
    closeHour: 22,  // 10:00 PM
    closedDay: 'Fri'
  };

  var doc = root.document;

  function waLink(text) {
    return 'https://wa.me/' + CFG.number + (text ? '?text=' + encodeURIComponent(text) : '');
  }

  /* ---------- language ---------- */
  function langFromUrl() {
    var m = /[?&]lang=(ar|en)\b/.exec(root.location.search);
    return m ? m[1] : 'ar';
  }

  function currentLang() {
    return doc.documentElement.getAttribute('lang') === 'en' ? 'en' : 'ar';
  }

  function setLang(lang) {
    var el = doc.documentElement;
    el.setAttribute('lang', lang);
    el.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
    var btn = doc.getElementById('lang-toggle');
    if (btn) {
      btn.textContent = lang === 'ar' ? 'English' : 'العربية';
      btn.setAttribute('lang', lang === 'ar' ? 'en' : 'ar');
    }
    try {
      var url = new URL(root.location.href);
      url.searchParams.set('lang', lang);
      root.history.replaceState(null, '', url.toString());
    } catch (e) { /* file:// or old browser: ignore */ }
    refreshStatus();
    doc.dispatchEvent(new CustomEvent('jlwa:lang', { detail: lang }));
  }

  /* ---------- clinic hours (Riyadh time, Saturday to Thursday 1 PM to 10 PM) ---------- */
  function riyadhNow() {
    try {
      var f = new Intl.DateTimeFormat('en-US', { timeZone: CFG.tz, weekday: 'short', hour: 'numeric', hourCycle: 'h23' });
      var p = {};
      f.formatToParts(new Date()).forEach(function (x) { p[x.type] = x.value; });
      return { day: p.weekday, hour: parseInt(p.hour, 10) };
    } catch (e) {
      return null;
    }
  }

  function isOpen() {
    var n = riyadhNow();
    if (!n || isNaN(n.hour)) return null;
    return n.day !== CFG.closedDay && n.hour >= CFG.openHour && n.hour < CFG.closeHour;
  }

  function refreshStatus() {
    var el = doc.getElementById('status');
    if (!el) return;
    var open = isOpen();
    if (open === null) { el.hidden = true; return; }
    var lang = currentLang();
    el.hidden = false;
    el.className = 'status' + (open ? ' open' : '');
    var label = open
      ? (lang === 'ar' ? 'العيادة مفتوحة الآن' : 'Clinic open now')
      : (lang === 'ar' ? 'العيادة مغلقة الآن' : 'Clinic closed now');
    el.innerHTML = '<i aria-hidden="true"></i><span></span>';
    el.lastChild.textContent = label;
  }

  /* ---------- messages (plain text, what the visitor will see in WhatsApp before sending) ---------- */
  function askMessage(lang, area) {
    if (lang === 'ar') {
      return 'السلام عليكم، أود الاستفسار عن ' + (area ? '«' + area + '»' : 'الخدمات') + ' في ' + CFG.brand + '.';
    }
    return 'Hello, I would like to ask about ' + (area ? '"' + area + '"' : 'your services') + ' at ' + CFG.brand + '.';
  }

  function bookMessage(lang, d) {
    var L = lang === 'ar'
      ? { head: 'السلام عليكم، أرغب بطلب موعد في ' + CFG.brand + '.', name: 'الاسم', areas: 'المناطق', day: 'اليوم المفضل', time: 'الوقت المفضل', first: 'أول زيارة', yes: 'نعم', no: 'لا', note: 'ملاحظات', sep: '، ' }
      : { head: 'Hello, I would like to request an appointment at ' + CFG.brand + '.', name: 'Name', areas: 'Areas', day: 'Preferred day', time: 'Preferred time', first: 'First visit', yes: 'Yes', no: 'No', note: 'Notes', sep: ', ' };
    var lines = [L.head];
    if (d.name) lines.push(L.name + ': ' + d.name);
    if (d.areas && d.areas.length) lines.push(L.areas + ': ' + d.areas.join(L.sep));
    if (d.day) lines.push(L.day + ': ' + d.day);
    if (d.time) lines.push(L.time + ': ' + d.time);
    if (d.first === 'yes') lines.push(L.first + ': ' + L.yes);
    if (d.first === 'no') lines.push(L.first + ': ' + L.no);
    if (d.note) lines.push(L.note + ': ' + d.note);
    return lines.join('\n');
  }

  /* ---------- areas (from data/areas.js) ---------- */
  function areas() { return (root.JLWA_AREAS && root.JLWA_AREAS.areas) || []; }
  function collections() { return (root.JLWA_AREAS && root.JLWA_AREAS.collections) || []; }

  /* ---------- clipboard ---------- */
  function copyText(text) {
    if (root.navigator.clipboard && root.navigator.clipboard.writeText) {
      return root.navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      var ta = doc.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      doc.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = doc.execCommand('copy'); } catch (e) { ok = false; }
      doc.body.removeChild(ta);
      ok ? resolve() : reject(new Error('copy failed'));
    });
  }

  function bindCopy(btn, getText) {
    btn.addEventListener('click', function () {
      var original = btn.getAttribute('data-label') || btn.textContent;
      btn.setAttribute('data-label', original);
      copyText(getText()).then(function () {
        btn.classList.add('done');
        btn.textContent = currentLang() === 'ar' ? 'تم النسخ' : 'Copied';
        setTimeout(function () { btn.classList.remove('done'); btn.textContent = original; }, 1600);
      }, function () {
        btn.textContent = currentLang() === 'ar' ? 'تعذّر النسخ' : 'Copy failed';
        setTimeout(function () { btn.textContent = original; }, 1600);
      });
    });
  }

  /* ---------- boot ---------- */
  function boot() {
    setLang(langFromUrl());
    var btn = doc.getElementById('lang-toggle');
    if (btn) {
      btn.addEventListener('click', function () { setLang(currentLang() === 'ar' ? 'en' : 'ar'); });
    }
    setInterval(refreshStatus, 60000);
  }

  root.JLWA = {
    CFG: CFG, waLink: waLink, currentLang: currentLang, setLang: setLang,
    askMessage: askMessage, bookMessage: bookMessage,
    areas: areas, collections: collections, copyText: copyText, bindCopy: bindCopy, isOpen: isOpen
  };

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window);
