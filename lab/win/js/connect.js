/* connect.js [SKIN] — the 「connecting to the remote computer」 screen shown for about 2.5 s on every visit (DESIGN M§17, W8).
   It looks like Windows Remote Desktop Connection: dark, a small monitor-with-arrow glyph, 「正在連線到 AN-LAPTOP」, 「an 的筆電」, a thin
   progress bar and the status line stepping through 正在起始遠端連線… → 正在設定遠端工作階段… → 正在驗證認證… → 正在準備桌面… → 已連線.
   The markup is in index.html so it covers the page from the first paint; this file steps the status line and the bar,
   lets the desktop come in sharpening (like a remote picture arriving), removes the screen and emits 'connect:done'.
   ?connect=0 (and the tests) skip it: an inline script in <head> adds html.lab-noconnect before anything paints. */
(function (LAB) {
  'use strict';

  var STEPS = [
    { at: 0, text: '正在起始遠端連線…', bar: 16 },
    { at: 520, text: '正在設定遠端工作階段…', bar: 40 },
    { at: 1000, text: '正在驗證認證…', bar: 64 },
    { at: 1400, text: '正在準備桌面…', bar: 88 },
    { at: 1800, text: '已連線', bar: 100 }
  ];
  var FADE_AT = 1950, DONE_AT = 2500;

  function done() { if (LAB.bus) LAB.bus.emit('connect:done', {}); }

  var root = document.documentElement;
  var el = document.getElementById('lab-connect');
  if (!el || root.classList.contains('lab-noconnect')) {
    if (el && el.parentNode) el.parentNode.removeChild(el);
    root.classList.remove('lab-connecting');
    LAB.ready(done, 99);
    return;
  }

  var stepEl = el.querySelector('.lab-cn-step');
  var barEl = el.querySelector('.lab-cn-bar i');
  STEPS.forEach(function (s) {
    setTimeout(function () {
      if (stepEl) stepEl.textContent = s.text;
      if (barEl) barEl.style.width = s.bar + '%';
    }, s.at);
  });
  setTimeout(function () {
    el.classList.add('is-leaving');          // the screen fades
    root.classList.remove('lab-connecting'); // and the desktop under it sharpens (mission.css)
  }, FADE_AT);
  setTimeout(function () {
    if (el.parentNode) el.parentNode.removeChild(el);
    // boot is synchronous on DOMContentLoaded, so it has run long before this; ready() would also wait for it
    LAB.ready(done, 99);
  }, DONE_AT);
})(window.LAB);
