/* Home page: area chips (grouped like the WhatsApp catalog) and the main chat button. */
(function () {
  'use strict';
  var W = window.JLWA;
  var host = document.getElementById('areas');
  var chat = document.getElementById('chat-btn');

  function render() {
    var lang = W.currentLang();
    if (chat) chat.href = W.waLink(W.askMessage(lang, ''));
    if (!host) return;
    host.textContent = '';
    W.collections().forEach(function (col, ci) {
      var h = document.createElement('h3');
      h.textContent = col[lang];
      host.appendChild(h);
      var box = document.createElement('div');
      box.className = 'chips';
      W.areas().filter(function (a) { return a.collection === ci; }).forEach(function (a) {
        var link = document.createElement('a');
        link.className = 'chip';
        link.target = '_blank';
        link.rel = 'noopener';
        link.href = W.waLink(W.askMessage(lang, a[lang]));
        link.textContent = a[lang];
        box.appendChild(link);
      });
      host.appendChild(box);
    });
  }

  document.addEventListener('jlwa:lang', render);
  render();
})();
