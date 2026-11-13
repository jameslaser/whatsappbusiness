/* Booking request: builds a WhatsApp message in the browser. Nothing is stored or transmitted by this page. */
(function () {
  'use strict';
  var W = window.JLWA;
  var $ = function (id) { return document.getElementById(id); };

  var DAYS = [
    { ar: 'السبت', en: 'Saturday' }, { ar: 'الأحد', en: 'Sunday' }, { ar: 'الاثنين', en: 'Monday' },
    { ar: 'الثلاثاء', en: 'Tuesday' }, { ar: 'الأربعاء', en: 'Wednesday' }, { ar: 'الخميس', en: 'Thursday' }
  ];
  var TIMES = [
    { ar: '1:00 – 4:00 م', en: '1:00 – 4:00 PM' },
    { ar: '4:00 – 7:00 م', en: '4:00 – 7:00 PM' },
    { ar: '7:00 – 10:00 م', en: '7:00 – 10:00 PM' }
  ];
  var ANY = { ar: 'أي وقت مناسب', en: 'Any suitable time' };
  var ANYDAY = { ar: 'أي يوم (السبت – الخميس)', en: 'Any day (Saturday – Thursday)' };

  var selected = {};   // area code -> true

  function fillSelect(sel, list, anyLabel) {
    var lang = W.currentLang();
    var keep = sel.selectedIndex;
    sel.textContent = '';
    var o = document.createElement('option');
    o.value = ''; o.textContent = anyLabel[lang];
    sel.appendChild(o);
    list.forEach(function (x, i) {
      var opt = document.createElement('option');
      opt.value = String(i + 1);
      opt.textContent = x[lang];
      sel.appendChild(opt);
    });
    sel.selectedIndex = keep > 0 ? keep : 0;
  }

  function renderAreas() {
    var lang = W.currentLang();
    var host = $('areas');
    host.textContent = '';
    W.collections().forEach(function (col, ci) {
      var h = document.createElement('h3');
      h.textContent = col[lang];
      host.appendChild(h);
      var box = document.createElement('div');
      box.className = 'opts';
      W.areas().filter(function (a) { return a.collection === ci; }).forEach(function (a) {
        var label = document.createElement('label');
        label.className = 'opt';
        var cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.value = a.code;
        cb.checked = !!selected[a.code];
        cb.addEventListener('change', function () {
          if (cb.checked) selected[a.code] = true; else delete selected[a.code];
          update();
          showErrorsIfShown();
        });
        var span = document.createElement('span');
        span.textContent = a[lang];
        label.appendChild(cb);
        label.appendChild(span);
        box.appendChild(label);
      });
      host.appendChild(box);
    });
  }

  function chosenAreas(lang) {
    return W.areas().filter(function (a) { return selected[a.code]; }).map(function (a) { return a[lang]; });
  }

  function data(lang) {
    var dayIdx = parseInt($('day').value, 10);
    var timeIdx = parseInt($('time').value, 10);
    var first = document.querySelector('input[name="first"]:checked');
    var areas = chosenAreas(lang);
    if ($('unsure').checked) areas.push(lang === 'ar' ? 'أريد الاستفسار أولاً' : 'I want to ask first');
    return {
      name: $('name').value.trim(),
      areas: areas,
      day: dayIdx ? DAYS[dayIdx - 1][lang] : '',
      time: timeIdx ? TIMES[timeIdx - 1][lang] : '',
      first: first ? first.value : '',
      note: $('note').value.trim()
    };
  }

  function update() {
    var lang = W.currentLang();
    var d = data(lang);
    var ok = d.name.length > 0 && d.areas.length > 0;
    var msg = W.bookMessage(lang, d);
    var pv = $('preview');
    pv.textContent = msg;
    pv.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
    var send = $('send');
    send.href = ok ? W.waLink(msg) : '#';
    send.setAttribute('aria-disabled', ok ? 'false' : 'true');
    return ok;
  }

  function showErrors() {
    var lang = W.currentLang();
    var d = data(lang);
    $('err-name').textContent = d.name ? '' : (lang === 'ar' ? 'اكتب اسمك من فضلك.' : 'Please enter your name.');
    $('err-areas').textContent = d.areas.length ? '' : (lang === 'ar' ? 'اختر منطقة واحدة على الأقل.' : 'Choose at least one area.');
  }

  function refreshLabels() {
    fillSelect($('day'), DAYS, ANYDAY);
    fillSelect($('time'), TIMES, ANY);
    renderAreas();
    update();
    showErrorsIfShown();
  }

  var errorsShown = false;
  function showErrorsIfShown() { if (errorsShown) showErrors(); }

  $('send').addEventListener('click', function (e) {
    if (!update()) {
      e.preventDefault();
      errorsShown = true;
      showErrors();
      var first = $('name').value.trim() ? $('areas-set') : $('name');
      first.scrollIntoView({ block: 'center' });
      if (first.focus) first.focus({ preventScroll: true });
    }
  });

  ['name', 'note', 'day', 'time', 'unsure'].forEach(function (id) {
    $(id).addEventListener('input', function () { update(); showErrorsIfShown(); });
    $(id).addEventListener('change', function () { update(); showErrorsIfShown(); });
  });
  Array.prototype.forEach.call(document.querySelectorAll('input[name="first"]'), function (r) {
    r.addEventListener('change', update);
  });
  $('book').addEventListener('submit', function (e) { e.preventDefault(); });

  document.addEventListener('jlwa:lang', refreshLabels);
  refreshLabels();
})();
