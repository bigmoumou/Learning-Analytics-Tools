/* remote.js [SKIN] — the Remote Desktop connection bar (DESIGN M§20, W8). Like the bar Windows Remote Desktop hangs from the top edge of a
   full-screen session: a light bar at the top centre (flat top touching the edge, 6 px bottom corners) with a pin, three signal bars,
   「AN-LAPTOP」, 「—」 (folds the bar into a slim tab that comes back on hover) and 「✕ 中斷連線」. It belongs to the student's own computer,
   not to the fake PC, so it is page chrome: not scaled with the stage, drawn above the PC and above the mission sheets, and it keeps
   out of the mission card's way (full → compact when the card would be under it). Disconnecting asks first (the Windows dialog
   「遠端桌面連線」) when this visit has mission progress, because nothing is kept (M§18); then a short 「已中斷與 AN-LAPTOP 的連線」 screen,
   and the page goes back to where the student came from (history.back()), or to Week 3 when there is no such page.
   The Start menu's power button calls LAB.remote.disconnect() (desktop.js). */
(function (LAB) {
  'use strict';

  var HOST = (LAB.win && LAB.win.HOST) || 'AN-LAPTOP';
  var BACK_URL = '../../weeks/week03/#lab-mac';
  var h = LAB.util.h;

  // static strings only (DESIGN M§0.5)
  var PIN_SVG = '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M5 2h6v1.4l-1.2 1.1v2.7l1.7 2V10H8.6v4.2H7.4V10H4.5V9.2l1.7-2V4.5L5 3.4z" fill="currentColor"/></svg>';
  var MIN_SVG = '<svg viewBox="0 0 10 10" aria-hidden="true" focusable="false"><path d="M0 5h10" stroke="currentColor" stroke-width="1" fill="none"/></svg>';
  var X_SVG = '<svg viewBox="0 0 10 10" aria-hidden="true" focusable="false"><path d="M.5.5l9 9M9.5.5l-9 9" stroke="currentColor" stroke-width="1.1" fill="none"/></svg>';
  var APP_SVG = '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><rect x="1.5" y="2.2" width="13" height="8.8" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M5.5 14h5M8 11v3" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><path d="M4.8 6.6h6M9 4.6l2 2-2 2" fill="none" stroke="#005fb8" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var MARK_SVG = '<svg class="lab-cn-mark" viewBox="0 0 64 48" width="64" height="48" aria-hidden="true" focusable="false"><rect x="6" y="4" width="52" height="34" rx="4" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M32 38v6M23 44.5h18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M19 21h24M36 14l7 7-7 7" fill="none" stroke="#4cc2ff" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  function svg(s) { var w = document.createElement('span'); w.innerHTML = s; return w.firstChild; }

  var bar = null, btn = null, minBtn = null, mode = '', shown = false, progressed = false, leaving = false;
  var alert = null;                                      // { scrim, panel, ok, cancel, off, back }

  function reduced() { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }
  function host() { return document.fullscreenElement || document.body; }
  function screenEl() { return document.getElementById('lab-screen'); }

  /* ------------------------------------------------------------------ the bar */
  function build() {
    btn = h('button', { type: 'button', class: 'lab-rb-btn lab-rb-close', title: '結束遠端連線，回到上一頁', dataset: { lab: 'remote-disconnect' } },
      svg(X_SVG), h('span', { class: 'lab-rb-label' }, '中斷連線'));
    btn.addEventListener('click', function (e) { e.stopPropagation(); remote.disconnect(); });
    minBtn = h('button', { type: 'button', class: 'lab-rb-btn lab-rb-min', 'aria-label': '收合連線列', title: '收合連線列（把滑鼠移到畫面上緣就會再出現）', dataset: { lab: 'remote-collapse' } }, svg(MIN_SVG));
    minBtn.addEventListener('click', function (e) { e.stopPropagation(); collapse(); });
    bar = h('div', { class: 'lab-rb', role: 'toolbar', 'aria-label': '遠端連線', dataset: { lab: 'remote-bar', mode: 'full' } },
      h('span', { class: 'lab-rb-pin', title: '連線列已固定', 'aria-hidden': 'true' }, svg(PIN_SVG)),
      h('span', { class: 'lab-rb-sig', title: '連線品質：良好', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')),
      h('span', { class: 'lab-rb-name', title: '遠端連線中：' + HOST }, h('span', { class: 'lab-rb-sr' }, '已連線到 '), HOST),
      minBtn, btn);
    // pointer events on the bar never reach the PC under it
    ['pointerdown', 'mousedown', 'contextmenu', 'dblclick'].forEach(function (t) { bar.addEventListener(t, function (e) { e.stopPropagation(); }); });
    // after 「—」 the bar stays folded until the pointer has left it once; then hovering the tab brings it back
    bar.addEventListener('pointerleave', function () { bar.classList.remove('is-fresh'); });
    host().appendChild(bar);
  }
  function setMode(m) { if (mode !== m) { mode = m; bar.setAttribute('data-mode', m); } }
  /* 「—」: fold the bar into a slim tab at the top edge (the real bar auto-hides); hover or keyboard focus brings it back */
  function collapse() {
    if (!bar) return;
    bar.classList.add('is-min');
    var hovered = false;
    try { hovered = bar.matches(':hover'); } catch (e) { hovered = false; }
    if (hovered) bar.classList.add('is-fresh');
    try { minBtn.blur(); } catch (e2) { /* ignore */ }
  }

  /* the mission card (or its pill) when it is on screen: the bar must not sit on top of it */
  function cardRect() {
    var rail = document.getElementById('lab-rail');
    if (!rail) return null;
    var els = [rail.querySelector('.lab-rail-body'), rail.querySelector('.lab-rail-strip')];
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (!el) continue;
      var r = el.getBoundingClientRect(), vis = true;
      try { vis = window.getComputedStyle(el).visibility !== 'hidden'; } catch (e) { vis = true; }
      if (vis && r.width > 8 && r.height > 8) return r;
    }
    return null;
  }

  /* top centre of the screen; compact (the pin and 「✕ 中斷連線」 only) when the full bar would cover the card */
  function place() {
    if (!bar) return;
    var scr = screenEl();
    if (!scr) return;
    var sr = scr.getBoundingClientRect();
    var cx = sr.left + sr.width / 2;
    var c = cardRect();
    function clash() {
      if (!c) return false;
      var w = bar.offsetWidth, hh = bar.offsetHeight;
      return c.top < sr.top + hh + 4 && cx - w / 2 < c.right + 12 && cx + w / 2 > c.left - 12;
    }
    setMode('full');
    if (clash()) setMode('compact');
    bar.style.left = Math.round(cx - bar.offsetWidth / 2) + 'px';
    bar.style.top = Math.round(sr.top) + 'px';
  }
  var placeQueued = false;
  function queuePlace() {
    if (placeQueued) return;
    placeQueued = true;
    requestAnimationFrame(function () { placeQueued = false; place(); });
  }

  function show() {
    if (shown || leaving) return;
    if (!bar) build();
    shown = true;
    place();
    // the next frame, so the entrance transition runs from the hidden state
    requestAnimationFrame(function () { requestAnimationFrame(function () { if (bar) bar.classList.add('is-on'); }); });
    if (window.ResizeObserver) {
      var ro = new ResizeObserver(queuePlace);
      var rail = document.getElementById('lab-rail');
      if (rail) ro.observe(rail);
    }
    // the card was dragged or put back (desktop.js changes its inline position and class): keep the bar clear of it
    if (window.MutationObserver) {
      var rail2 = document.getElementById('lab-rail');
      if (rail2) new MutationObserver(queuePlace).observe(rail2, { attributes: true, attributeFilter: ['style', 'class'] });
    }
  }

  /* ------------------------------------------------------- the dialog (Windows style) */
  function openAlert() {
    if (alert) return;
    var cancel = h('button', { type: 'button', class: 'lab-ra-cancel', dataset: { lab: 'remote-alert-cancel' } }, '取消');
    var ok = h('button', { type: 'button', class: 'lab-ra-ok', dataset: { lab: 'remote-alert-ok' } }, '中斷連線');
    var x = h('button', { type: 'button', class: 'lab-ra-x', 'aria-label': '取消', title: '取消', tabindex: '-1', dataset: { lab: 'remote-alert-x' } }, svg(X_SVG));
    var panel = h('div', { class: 'lab-ra', role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': 'lab-ra-t', 'aria-describedby': 'lab-ra-d', dataset: { lab: 'remote-alert' } },
      h('div', { class: 'lab-ra-bar' }, svg(APP_SVG), h('span', null, '遠端桌面連線'), x),
      h('div', { class: 'lab-ra-body' },
        h('h2', { class: 'lab-ra-title', id: 'lab-ra-t' }, '要中斷遠端工作階段嗎？'),
        h('p', { class: 'lab-ra-text', id: 'lab-ra-d' }, '這台練習用的電腦不會保存任何東西：中斷後，這次的任務進度就不會留下。')),
      h('div', { class: 'lab-ra-foot' }, ok, cancel));
    var scrim = h('div', { class: 'lab-ra-scrim' }, panel);
    ['pointerdown', 'mousedown', 'click', 'contextmenu'].forEach(function (t) { scrim.addEventListener(t, function (e) { e.stopPropagation(); }); });
    var back = document.activeElement;
    host().appendChild(scrim);
    cancel.addEventListener('click', function () { closeAlert(); });
    x.addEventListener('click', function () { closeAlert(); });
    ok.addEventListener('click', function () { closeAlert(true); leave(); });
    var off = LAB.keys && LAB.keys.modal ? LAB.keys.modal(function (e) {
      if (e.key === 'Escape') { closeAlert(); return true; }
      if (e.key === 'Enter' && !e.repeat) { if (document.activeElement === cancel) closeAlert(); else { closeAlert(true); leave(); } return true; }
      if (e.key === 'Tab') { (document.activeElement === ok ? cancel : ok).focus(); return true; }
      if (e.key === ' ') { if (document.activeElement === cancel || document.activeElement === ok) document.activeElement.click(); return true; }
      return true;                                       // the PC behind the dialog takes no keys
    }) : null;
    alert = { scrim: scrim, panel: panel, ok: ok, cancel: cancel, off: off, back: back };
    ok.focus();                                          // the default button (Enter)
  }
  function closeAlert(leavingNow) {
    if (!alert) return;
    var a = alert;
    alert = null;
    if (a.off) a.off();
    if (a.scrim.parentNode) a.scrim.parentNode.removeChild(a.scrim);
    if (!leavingNow) { try { (a.back && document.contains(a.back) ? a.back : btn).focus(); } catch (e) { /* ignore */ } }
  }

  /* ------------------------------------------------------------- leaving */
  function leave() {
    if (leaving) return;
    leaving = true;
    closeAlert(true);
    if (LAB.bus) LAB.bus.emit('remote:disconnect', {});
    if (document.fullscreenElement) { try { var p = document.exitFullscreen(); if (p && p.catch) p.catch(function () {}); } catch (e) { /* ignore */ } }
    var title = h('div', { class: 'lab-cn-title' }, '已中斷與 ' + HOST + ' 的連線');
    var bye = h('div', { class: 'lab-bye', role: 'status', 'aria-live': 'polite', dataset: { lab: 'remote-bye' } },
      h('div', { class: 'lab-cn-box' }, svg(MARK_SVG), title, h('div', { class: 'lab-cn-step' }, '正在回到上一頁…')));
    document.body.appendChild(bye);
    if (bar) bar.classList.remove('is-on');
    document.documentElement.classList.add('lab-connecting');    // the desktop blurs and dims again (mission.css)
    requestAnimationFrame(function () { requestAnimationFrame(function () { bye.classList.add('is-in'); }); });
    setTimeout(function () { remote.go(); }, reduced() ? 350 : 900);
  }
  /* where the student came from; Week 3 when the page was opened directly (a new tab, a bookmark) */
  function go() {
    var same = false;
    try { same = !!document.referrer && new URL(document.referrer).origin === window.location.origin; } catch (e) { /* ignore */ }
    if (same && window.history.length > 1) {
      window.history.back();
      setTimeout(function () { window.location.href = BACK_URL; }, 800);   // back did nothing: go to Week 3
    } else {
      window.location.href = BACK_URL;
    }
  }

  var remote = LAB.remote = {
    disconnect: function () {
      if (leaving) return;
      if (progressed) openAlert(); else leave();
    },
    go: go,                                              // tests replace this to stay on the page
    place: place,
    mode: function () { return mode; },
    collapsed: function () { return !!(bar && bar.classList.contains('is-min')); },
    hasProgress: function () { return progressed; },
    alertOpen: function () { return !!alert; },
    backUrl: BACK_URL
  };

  LAB.ready(function () {
    if (LAB.bus) {
      LAB.bus.on('connect:done', show);
      LAB.bus.on('mission:step', function (d) { if (!d || !d.skipped) progressed = true; });
      LAB.bus.on('mission:complete', function () { progressed = true; });
      // the card changed place or size (the pill, a drag, a window resize): keep the bar clear of it
      LAB.bus.on('rail:layout', queuePlace);
      LAB.bus.on('card:moved', queuePlace);
      LAB.bus.on('stage:resize', queuePlace);
    }
    if (!document.documentElement.classList.contains('lab-connecting')) show();
    window.addEventListener('resize', queuePlace);
    document.addEventListener('fullscreenchange', function () {
      if (bar) host().appendChild(bar);
      if (alert) host().appendChild(alert.scrim);
      queuePlace();
    });
  }, 90);
})(window.LAB);
