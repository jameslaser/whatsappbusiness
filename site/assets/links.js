/* Link builder for the clinic team. Everything happens in the browser. */
(function () {
  'use strict';
  var W = window.JLWA;
  var $ = function (id) { return document.getElementById(id); };
  var PAGE = location.href.replace(/links\.html.*$/, '');

  function makeRow(name, sub, links) {
    var row = document.createElement('div');
    row.className = 'tool-row';
    var nm = document.createElement('div');
    nm.className = 'nm';
    nm.textContent = name;
    if (sub) {
      var s = document.createElement('small');
      s.textContent = sub;
      nm.appendChild(s);
    }
    row.appendChild(nm);
    links.forEach(function (l) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'copy';
      b.textContent = l.label;
      W.bindCopy(b, function () { return l.url; });
      row.appendChild(b);
    });
    return row;
  }

  function fillArea() {
    var lang = W.currentLang();
    var sel = $('sel');
    var keep = sel.value;
    sel.textContent = '';
    var none = document.createElement('option');
    none.value = '';
    none.textContent = lang === 'ar' ? 'عام (بدون منطقة)' : 'General (no area)';
    sel.appendChild(none);
    W.areas().forEach(function (a) {
      var o = document.createElement('option');
      o.value = a.code;
      o.textContent = a[lang] + '  ·  ' + a.code;
      sel.appendChild(o);
    });
    sel.value = keep;
  }

  function current() {
    var lang = $('ln').value;
    var custom = $('custom').value.trim();
    var code = $('sel').value;
    var area = W.areas().filter(function (a) { return a.code === code; })[0];
    var text = custom || W.askMessage(lang, area ? area[lang] : '');
    return W.waLink(text);
  }

  function updateMain() {
    var url = current();
    $('out').textContent = url;
    $('test').href = url;
  }

  function renderGeneral() {
    var host = $('general');
    host.textContent = '';
    var ar = W.currentLang() === 'ar';
    host.appendChild(makeRow(ar ? 'محادثة عامة' : 'General chat', null, [
      { label: 'AR', url: W.waLink(W.askMessage('ar', '')) },
      { label: 'EN', url: W.waLink(W.askMessage('en', '')) }
    ]));
    host.appendChild(makeRow(ar ? 'صفحة طلب الموعد' : 'Appointment request page', null, [
      { label: 'AR', url: PAGE + 'book.html?lang=ar' },
      { label: 'EN', url: PAGE + 'book.html?lang=en' }
    ]));
    host.appendChild(makeRow(ar ? 'الصفحة الرئيسية' : 'Home page', null, [
      { label: 'AR', url: PAGE + '?lang=ar' },
      { label: 'EN', url: PAGE + '?lang=en' }
    ]));
    host.appendChild(makeRow(ar ? 'دليل المدونة' : 'Blog guide', null, [
      { label: ar ? 'نسخ' : 'Copy', url: W.CFG.guide }
    ]));
  }

  function renderAll() {
    var lang = W.currentLang();
    var host = $('all');
    host.textContent = '';
    W.areas().forEach(function (a) {
      host.appendChild(makeRow(a[lang], a.code, [
        { label: 'AR', url: W.waLink(W.askMessage('ar', a.ar)) },
        { label: 'EN', url: W.waLink(W.askMessage('en', a.en)) }
      ]));
    });
  }

  function csvCell(v) { return '"' + String(v).replace(/"/g, '""') + '"'; }

  function downloadCsv() {
    var rows = [['code', 'collection_ar', 'collection_en', 'area_ar', 'area_en', 'link_ar', 'link_en']];
    var cols = W.collections();
    W.areas().forEach(function (a) {
      rows.push([a.code, cols[a.collection].ar, cols[a.collection].en, a.ar, a.en,
        W.waLink(W.askMessage('ar', a.ar)), W.waLink(W.askMessage('en', a.en))]);
    });
    var text = '﻿' + rows.map(function (r) { return r.map(csvCell).join(','); }).join('\r\n');
    var blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'whatsapp-area-links.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }

  W.bindCopy($('copy-main'), current);
  ['sel', 'ln', 'custom'].forEach(function (id) {
    $(id).addEventListener('input', updateMain);
    $(id).addEventListener('change', updateMain);
  });
  $('csv').addEventListener('click', downloadCsv);

  function renderAllLang() { fillArea(); updateMain(); renderGeneral(); renderAll(); }
  document.addEventListener('jlwa:lang', function () { $('ln').value = W.currentLang(); renderAllLang(); });
  $('ln').value = W.currentLang();
  renderAllLang();
})();
