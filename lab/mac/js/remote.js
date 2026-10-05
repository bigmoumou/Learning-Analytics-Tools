/* remote.js [SKIN] — the remote-session bar (DESIGN §20). A small dark HUD capsule at the top centre says the student is
   connected to an's MacBook Air and offers 「中斷連線」. It belongs to the student's own computer, not to the fake Mac, so it
   is page chrome: not scaled with the stage, drawn above the Mac and above the mission sheets, and it stays out of the way of
   the menu bar's items (full → compact → just under the menu bar, whichever fits). Disconnecting asks first (a macOS alert)
   when this visit has mission progress, because nothing is kept (§18); then a short 「已中斷連線」 screen, and the page goes
   back to where the student came from (history.back()), or to Week 3 when there is no such page. */
(function (LAB) {
  'use strict';

  var HOST = 'an 的 MacBook Air';
  var BACK_URL = '../../weeks/week03/#lab-mac';
  var h = LAB.util.h;

  // static strings only (DESIGN §0.5)
  var EXIT_SVG = '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M9.5 3.2V2.6A1.1 1.1 0 0 0 8.4 1.5H3.6A1.1 1.1 0 0 0 2.5 2.6v10.8a1.1 1.1 0 0 0 1.1 1.1h4.8a1.1 1.1 0 0 0 1.1-1.1v-.6" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M6.5 8h7.6M11.4 5.3 14.1 8l-2.7 2.7" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var APP_SVG = '<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false"><defs><linearGradient id="lab-ra-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7d8ba1"/><stop offset="1" stop-color="#3b4658"/></linearGradient></defs><rect x="4" y="4" width="56" height="56" rx="13" fill="url(#lab-ra-g)"/><rect x="4.5" y="4.5" width="55" height="55" rx="12.5" fill="none" stroke="rgba(255,255,255,.22)"/><rect x="17" y="19" width="30" height="20" rx="2.2" fill="none" stroke="#fff" stroke-width="2.6"/><path d="M12 43.5h40l-2.4 3H14.4z" fill="#fff"/><circle cx="46.5" cy="44.5" r="7" fill="#ff5f57" stroke="#3b4658" stroke-width="2"/><path d="M43.9 41.9l5.2 5.2M49.1 41.9l-5.2 5.2" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/></svg>';
  var MARK_SVG = '<svg class="lab-cn-mark" viewBox="0 0 64 44" width="64" height="44" aria-hidden="true" focusable="false"><rect x="10" y="3" width="44" height="30" rx="3" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M3 38h58l-3 3.5H6z" fill="currentColor"/></svg>';
  function svg(s) { var w = document.createElement('span'); w.innerHTML = s; return w.firstChild; }

  var bar = null, btn = null, mode = '', shown = false, progressed = false, leaving = false;
  var alert = null;                                      // { scrim, panel, ok, cancel, off, back }

  function reduced() { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }
  function host() { return document.fullscreenElement || document.body; }
  function screenEl() { return document.getElementById('lab-screen'); }

  /* ------------------------------------------------------------------ the bar */
  function build() {
    btn = h('button', { type: 'button', class: 'lab-rb-btn', title: '結束遠端連線，回到上一頁', dataset: { lab: 'remote-disconnect' } },
      svg(EXIT_SVG), h('span', { class: 'lab-rb-label' }, '中斷連線'));
    btn.addEventListener('click', function (e) { e.stopPropagation(); remote.disconnect(); });
    bar = h('div', { class: 'lab-rb', role: 'toolbar', 'aria-label': '遠端連線', dataset: { lab: 'remote-bar', mode: 'full' } },
      h('span', { class: 'lab-rb-status', title: '遠端連線中：MacBook-Air.local' },
        h('i', { class: 'lab-rb-dot', 'aria-hidden': 'true' }),
        h('span', { class: 'lab-rb-name' }, h('span', { class: 'lab-rb-sr' }, '已連線到 '), HOST)),
      h('span', { class: 'lab-rb-sep', 'aria-hidden': 'true' }),
      btn);
    // pointer events on the bar never reach the Mac under it
    ['pointerdown', 'mousedown', 'contextmenu', 'dblclick'].forEach(function (t) { bar.addEventListener(t, function (e) { e.stopPropagation(); }); });
    host().appendChild(bar);
  }
  function setMode(m) { if (mode !== m) { mode = m; bar.setAttribute('data-mode', m); } }

  /* the menu bar's free middle: between the last menu title and the first status item */
  function place() {
    if (!bar) return;
    var scr = screenEl();
    if (!scr) return;
    var sr = scr.getBoundingClientRect();
    var mb = parseFloat(getComputedStyle(scr).getPropertyValue('--lab-mb')) || 28;
    var L = document.querySelector('#lab-menubar .lab-mb-left'), R = document.querySelector('#lab-menubar .lab-mb-right');
    var left = L ? L.getBoundingClientRect().right : sr.left;
    var right = R ? R.getBoundingClientRect().left : sr.right;
    var cx = sr.left + sr.width / 2, gap = 16;
    // as tall as the menu bar allows (22 px; less when the stage is scaled down on a small screen)
    bar.style.setProperty('--rb-h', Math.max(16, Math.min(22, Math.floor(mb - 4))) + 'px');
    function fits(m) {
      setMode(m);
      var w = bar.offsetWidth;
      return cx - w / 2 >= left + gap && cx + w / 2 <= right - gap;
    }
    var m = fits('full') ? 'full' : (fits('compact') ? 'compact' : 'below');
    setMode(m);
    var bw = bar.offsetWidth, bh = bar.offsetHeight;
    bar.style.left = Math.round(cx - bw / 2) + 'px';
    bar.style.top = Math.round(m === 'below' ? sr.top + mb + 6 : sr.top + Math.max(1, (mb - bh) / 2)) + 'px';
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
      var mbEl = document.getElementById('lab-menubar');
      if (mbEl) { ro.observe(mbEl); [].forEach.call(mbEl.children, function (c) { ro.observe(c); }); }
    }
  }

  /* ------------------------------------------------------- the alert (macOS style) */
  function openAlert() {
    if (alert) return;
    var cancel = h('button', { type: 'button', class: 'lab-ra-cancel', dataset: { lab: 'remote-alert-cancel' } }, '取消');
    var ok = h('button', { type: 'button', class: 'lab-ra-ok', dataset: { lab: 'remote-alert-ok' } }, '中斷連線');
    var panel = h('div', { class: 'lab-ra', role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': 'lab-ra-t', 'aria-describedby': 'lab-ra-d', dataset: { lab: 'remote-alert' } },
      h('div', { class: 'lab-ra-icon' }, svg(APP_SVG)),
      h('h2', { class: 'lab-ra-title', id: 'lab-ra-t' }, '要中斷遠端連線嗎？'),
      h('p', { class: 'lab-ra-text', id: 'lab-ra-d' }, '你正連線到 ' + HOST + '。這台練習用的電腦不會保存任何東西：中斷後，這次的任務進度就不會留下。'),
      h('div', { class: 'lab-ra-btns' }, cancel, ok));
    var scrim = h('div', { class: 'lab-ra-scrim' }, panel);
    ['pointerdown', 'mousedown', 'click', 'contextmenu'].forEach(function (t) { scrim.addEventListener(t, function (e) { e.stopPropagation(); }); });
    var back = document.activeElement;
    host().appendChild(scrim);
    cancel.addEventListener('click', function () { closeAlert(); });
    ok.addEventListener('click', function () { closeAlert(true); leave(); });
    var off = LAB.keys && LAB.keys.modal ? LAB.keys.modal(function (e) {
      if (e.key === 'Escape') { closeAlert(); return true; }
      if (e.key === 'Enter' && !e.repeat) { if (document.activeElement === cancel) closeAlert(); else { closeAlert(true); leave(); } return true; }
      if (e.key === 'Tab') { (document.activeElement === ok ? cancel : ok).focus(); return true; }
      if (e.key === ' ') { if (document.activeElement === cancel || document.activeElement === ok) document.activeElement.click(); return true; }
      return true;                                       // the Mac behind the alert takes no keys
    }) : null;
    alert = { scrim: scrim, panel: panel, ok: ok, cancel: cancel, off: off, back: back };
    ok.focus();                                          // the default button, as in macOS (Return)
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
    hasProgress: function () { return progressed; },
    alertOpen: function () { return !!alert; },
    backUrl: BACK_URL
  };

  LAB.ready(function () {
    if (LAB.bus) {
      LAB.bus.on('connect:done', show);
      LAB.bus.on('mission:step', function (d) { if (!d || !d.skipped) progressed = true; });
      LAB.bus.on('mission:complete', function () { progressed = true; });
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
