/* desktop.js [SKIN] — Windows 11 shell: stage scaling, the mission card at the top-RIGHT, the taskbar (Start, search box, Task View, pinned apps,
   tray with IME / network / clock), the Start menu, the Search panel, desktop icons with the Recycle Bin, the desktop context menu,
   phone notice, performance mode (DESIGN W3, M§2). Dark Windows mode: taskbar, Start, Search, flyouts. Light app mode: menus, dialogs. */
(function (LAB) {
  'use strict';

  var h = LAB.util.h;
  var HOME = '/Users/an';
  var DESKTOP = HOME + '/Desktop';
  var TRASH = HOME + '/.Trash';
  var TB_H = 60;                       // taskbar height in stage px (the 125 % taskbar; css/base.css --win-taskbar-h has the same number)
  var ICON_X0 = 4, ICON_Y0 = 4;        // desktop icon grid origin (Windows: icons run down the left edge, then to the next column)
  /* the three icon sizes of 檢視 (icon = the picture, w x h = one grid cell; css/shell.css has the same numbers as --di-*) */
  var SIZES = {
    large: { icon: 96, w: 110, h: 126 },
    medium: { icon: 48, w: 76, h: 84 },
    small: { icon: 32, w: 68, h: 74 }
  };
  /* how the desktop is laid out in this visit (memory only: a reload is a new computer). Windows defaults: medium icons, 「將圖示對齊格線」 on,
     「自動排列圖示」 off, icons shown, sorted by name. sortKey = the last 排序方式 chosen (null once the student reordered by hand in auto-arrange). */
  var DT = { size: 'medium', autoArrange: false, snap: true, show: true, sortKey: 'name', sortDesc: false, order: null };
  function metr() { return SIZES[DT.size] || SIZES.medium; }

  /* names the taskbar, Start and Search show (the apps themselves may still carry other titles during the build) */
  var APP_NAME = { finder: '檔案總管', terminal: '終端機', codex: 'Codex', code: 'Visual Studio Code', textedit: '記事本', about: '關於這個練習',
    settings: '設定', calculator: '小算盤', taskmgr: '工作管理員', edge: 'Microsoft Edge', photos: '相片' };
  var APP_KEYS = {
    finder: ['finder', 'explorer', 'explorer.exe', 'file explorer', 'files', 'file', '檔案', '檔案總管', '資料夾', 'folder'],
    terminal: ['terminal', 'windows terminal', 'powershell', 'cmd', 'wt', 'wt.exe', 'shell', '終端機', '終端', '命令提示字元', 'command prompt'],
    codex: ['codex', 'chatgpt'],
    code: ['code', 'vscode', 'vs code', 'visual studio code', 'visual studio'],
    textedit: ['notepad', 'notepad.exe', '記事本', 'text', 'txt'],
    about: ['about', '關於', '關於這個練習'],
    settings: ['settings', 'setting', 'ms-settings', '設定', 'control panel', '控制台'],
    calculator: ['calculator', 'calc', 'calc.exe', '小算盤', '計算機'],
    taskmgr: ['task manager', 'taskmgr', 'taskmgr.exe', '工作管理員', '工作管理'],
    edge: ['edge', 'microsoft edge', 'msedge', 'browser', '瀏覽器', 'internet', '網頁'],
    photos: ['photos', 'photo', '相片', '照片', 'picture viewer']
  };
  /* settings pages Search finds (name + words, the Settings page id, where it lives) */
  var SETTING_HITS = [
    ['夜間光線', ['night light', '夜間模式', '護眼', 'nightlight'], 'system/nightlight', '系統 › 顯示器'], ['亮度', ['brightness', '螢幕亮度'], 'system/display', '系統 › 顯示器'],
    ['顯示器', ['display', '解析度', 'screen'], 'system/display', '系統'], ['音效', ['sound', 'volume', '音量', '聲音'], 'system/sound', '系統'], ['關於', ['about', '裝置規格', 'device specifications', '系統資訊'], 'system/about', '系統'],
    ['背景', ['background', 'wallpaper', '桌布', '桌面背景'], 'personalization/background', '個人化'], ['色彩', ['colors', 'dark mode', '深色模式', '淺色模式', '深色', '淺色', 'color'], 'personalization/colors', '個人化'],
    ['Wi-Fi', ['wifi', '無線網路', 'network'], 'network/wifi', '網路和網際網路'], ['藍牙', ['bluetooth'], 'bluetooth', '藍牙與裝置'], ['已安裝的應用程式', ['installed apps', 'apps'], 'apps/installed', '應用程式'],
    ['Windows Update', ['update', '更新', 'windows update'], 'update', '']
  ];
  var EXCLUDE_TB = { quicklook: 1, archive: 1, downloads: 1, trash: 1 };   // registered, but no Windows counterpart: never on the taskbar
  function appTitle(id) {
    var def = LAB.apps.get(id);
    return APP_NAME[id] || (def && def.title) || id;
  }
  function appIconName(id) { var def = LAB.apps.get(id); return (def && def.icon) || ('app-' + id); }
  function winPath(p) { return (LAB.win && LAB.win.toWin) ? LAB.win.toWin(p) : p; }
  function dispName(p) { return (LAB.win && LAB.win.displayName) ? LAB.win.displayName(p) : LAB.vfs.basename(p); }
  function iconBox(name, size, cls) {
    var s = h('span', { class: cls || 'lab-ico-box', 'aria-hidden': 'true' });
    s.innerHTML = LAB.icons.get(name, { size: size });          // static icon markup only
    return s;
  }
  function toastNoApp() { LAB.ui.toast('練習版沒有安裝這個程式'); }
  function toastNoFeature() { LAB.ui.toast('練習版沒有這個功能'); }

  var rootEl, screenEl, stageEl, wallEl, desktopEl, windowsEl, menubarEl, dockEl, overlaysEl, modalRoot;

  function reduced() {
    try { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  }
  function sget(k) { try { return window.sessionStorage.getItem(k); } catch (e) { return null; } }
  function sset(k, v) { try { window.sessionStorage.setItem(k, v); } catch (e) { /* ignore */ } }

  /* ======================================================== stage (M§2.1) */
  var stage = LAB.stage = {
    w: 1024, h: 640, scale: 1, menubarH: 0, dockH: TB_H, taskbarH: TB_H, iconColW: ICON_X0 + SIZES.medium.w, availW: 1024, availH: 640, minScale: 0.25
  };
  stage.toStage = function (cx, cy) {
    var r = stageEl.getBoundingClientRect();
    return { x: (cx - r.left) / stage.scale, y: (cy - r.top) / stage.scale };
  };
  stage.rectOf = function (el) {
    var r = el.getBoundingClientRect(), sr = stageEl.getBoundingClientRect(), s = stage.scale;
    return { x: (r.left - sr.left) / s, y: (r.top - sr.top) / s, w: r.width / s, h: r.height / s };
  };
  /* The mission card (or its pill) floats at the top-RIGHT. New and zoomed windows open to the LEFT of it and to the RIGHT of the desktop icon
     column, so neither is ever covered. All values in stage px. */
  function cardShowing() {
    return !!(LAB.layout && (LAB.layout.railMode() === 'pinned' || LAB.layout.isDrawerOpen()));
  }
  function cardFace() {
    var rail = document.getElementById('lab-rail');
    return rail ? rail.querySelector(cardShowing() ? '.lab-rail-body' : '.lab-rail-strip') : null;
  }
  /* right edge of the desktop icon column (grows with the number of icons: a second column once the first is full) */
  var iconCount = 1;
  function cellRows() { return Math.max(1, Math.floor((stage.h - TB_H - ICON_Y0 - 8) / metr().h)); }
  function cellCols() { return Math.max(1, Math.floor((stage.w - ICON_X0) / metr().w)); }
  stage.iconColRight = function () { return ICON_X0 + Math.max(1, Math.ceil(iconCount / cellRows())) * metr().w; };
  /* the left limit for new and zoomed windows */
  stage.reserveLeft = function () { return Math.round(stage.iconColRight() + 12); };
  /* the width the card takes at the right (card or pill + 16 px gap), 0 when the student dragged it away from the right edge */
  stage.reserveRight = function () {
    var el = cardFace();
    if (!el || !stageEl) return 0;
    var r = el.getBoundingClientRect();
    if (!r.width) return 0;
    var sr = stageEl.getBoundingClientRect();
    if (sr.right - r.right > 48) return 0;
    return Math.max(0, Math.min(stage.w * 0.45, Math.round((sr.right - r.left) / stage.scale + 16)));
  };
  /* drawer mode: the stage y just below the pill (or the open card), for a window too wide to open left of it (wm.spawnRect). null when pinned */
  stage.belowCard = function () {
    if (!LAB.layout || LAB.layout.railMode() === 'pinned' || !stageEl) return null;
    var el = cardFace();
    var r = el && el.getBoundingClientRect();
    if (!r || !r.height) return null;
    var sr = stageEl.getBoundingClientRect();
    if (sr.right - r.right > 48) return null;     // dragged away: nothing to keep clear
    return Math.round((r.bottom - sr.top) / stage.scale + 10);
  };
  /* the stage y of the taskbar's top edge (windows stop above it) */
  stage.dockTop = function () { return Math.round(stage.h - TB_H); };
  /* the open card stops above the taskbar (the taskbar spans the whole width, so it always reaches under the card's column) */
  function updateCardRoom() {
    if (!screenEl) return;
    screenEl.style.setProperty('--lab-card-bottom', Math.round(TB_H * stage.scale + 10) + 'px');
  }
  stage.workArea = function () { return { x: 0, y: 0, w: stage.w, h: stage.h - TB_H }; };
  stage.spawnArea = function () {
    var x = Math.max(24, stage.reserveLeft());
    var y = 20;
    var right = Math.max(12, stage.reserveRight());
    return { x: x, y: y, w: Math.max(240, stage.w - x - right), h: Math.max(240, stage.dockTop() - y - 12) };
  };
  stage.zoomRect = function () {
    var x = stage.reserveLeft();
    var right = stage.reserveRight();
    return { x: x, y: 0, w: Math.max(320, stage.w - x - right), h: Math.max(200, stage.dockTop()) };
  };

  var measureQueued = false;
  function queueMeasure() {
    if (measureQueued) return;
    measureQueued = true;
    requestAnimationFrame(function () { measureQueued = false; layoutStage(false); });
  }
  function layoutStage(force) {
    if (!screenEl) return;
    var r = screenEl.getBoundingClientRect();
    var aw = Math.max(1, r.width), ah = Math.max(1, r.height);
    var s = Math.min(1, aw / 1024, ah / 640);
    s = Math.max(s, phoneContinue ? 0.4 : stage.minScale);
    var w = s < 1 ? aw / s : aw, hh = s < 1 ? ah / s : ah;
    var changed = force || Math.abs(w - stage.w) > 0.5 || Math.abs(hh - stage.h) > 0.5 || s !== stage.scale;
    stage.availW = aw; stage.availH = ah; stage.scale = s; stage.w = w; stage.h = hh;
    // the card is not scaled with the stage; Windows has no menu bar, so the card's top is just 10 px from the screen top
    screenEl.style.setProperty('--lab-mb', (stage.menubarH * s) + 'px');
    if (s < 1) {
      stageEl.style.width = w + 'px'; stageEl.style.height = hh + 'px';
      stageEl.style.transform = 'scale(' + s + ')'; stageEl.style.transformOrigin = '0 0';
    } else {
      stageEl.style.width = '100%'; stageEl.style.height = '100%';
      stageEl.style.transform = 'none';
    }
    applyCardPos();
    updateCardRoom();
    if (changed) LAB.bus.emit('stage:resize', { w: stage.w, h: stage.h, scale: stage.scale });
  }

  /* ===================================================== card layout (M§2.1, M§16) */
  var drawerOpen = false;
  var appliedMode = null;
  var lastReserveMode = null;
  var layout = LAB.layout = {
    railMode: function () {
      var m = LAB.store.get('ui.railMode', null);
      if (m === 'pinned' || m === 'drawer') return m;
      return window.innerWidth >= 1366 ? 'pinned' : 'drawer';
    },
    setRailMode: function (m) {
      LAB.store.set('ui.railMode', m);
      drawerOpen = false;
      layout.apply();
    },
    isDrawerOpen: function () { return drawerOpen; },
    openDrawer: function () { drawerOpen = true; layout.apply(); },
    closeDrawer: function () { if (!drawerOpen) return; drawerOpen = false; layout.apply(); },
    /* the 「全螢幕」 control lives in the card (it is a web-page control, not part of the fake PC) */
    canFullscreen: function () {
      var coarse = false;
      try { coarse = window.matchMedia('(pointer: coarse)').matches; } catch (e) { /* ignore */ }
      return !!(screenEl && screenEl.requestFullscreen) && !coarse;
    },
    toggleFullscreen: function () {
      if (!screenEl) return;
      if (document.fullscreenElement) { try { document.exitFullscreen(); } catch (e) { /* ignore */ } }
      else if (screenEl.requestFullscreen) { try { var p = screenEl.requestFullscreen(); if (p && p.catch) p.catch(function () {}); } catch (e2) { /* ignore */ } }
    },
    apply: function () {
      var m = layout.railMode();
      appliedMode = m;
      rootEl.classList.toggle('rail-pinned', m === 'pinned');
      rootEl.classList.toggle('rail-drawer', m === 'drawer');
      rootEl.classList.toggle('rail-open', m === 'drawer' && drawerOpen);
      queueMeasure();
      LAB.bus.emit('rail:layout', { mode: m, open: drawerOpen });
      applyCardPos();                    // card <-> pill: keep whichever is showing inside the screen
      // pinned card <-> pill changes the column the card covers: zoomed windows move to the new zoom rectangle
      if (m !== lastReserveMode) {
        lastReserveMode = m;
        requestAnimationFrame(function () { layoutStage(true); });
      }
    }
  };

  /* ============================================== dragging the card (M§17, mirrored: it lives at the top-RIGHT)
     The glass card can be dragged by its title row, and the pill by itself, anywhere over the PC; the spot is remembered for this visit
     (ui.cardPos = {y, r} when it sits on the right edge, r = px between the card and the right edge of #lab-screen; {x, y} = left px when it was
     put somewhere else; both in page px). Dropped within 32 px of the right edge it snaps back to it. Double-clicking the title row puts it back
     in the top-right corner. null = the default spot (CSS: 12 px from the right, 10 px from the top). Inline styles used:
     default -> left/right cleared; dragged -> left:<x>px;right:auto; snapped -> right:<r>px;left:auto; plus --lab-card-top and .is-moved. */
  var cardDrag = null, suppressClickUntil = 0;
  function railEl() { return document.getElementById('lab-rail'); }
  function savedCardPos() {
    var p = LAB.store.get('ui.cardPos', null);
    if (!p || typeof p.y !== 'number' || !isFinite(p.y)) return null;
    if (typeof p.r === 'number' && isFinite(p.r)) return p;
    if (typeof p.x === 'number' && isFinite(p.x)) return p;
    return null;
  }
  /* gaps between the card's own box (#lab-rail) and the face that is showing (card or pill), in page px. Layout numbers (offset*), not
     getBoundingClientRect: the face is scaled up a little while it is being dragged and the rect would include that. */
  function railGaps() {
    var r = railEl(), face = r && r.querySelector(cardShowing() ? '.lab-rail-body' : '.lab-rail-strip');
    var rw = r.offsetWidth;
    if (!face || !face.offsetWidth) return { offL: 0, offR: 0, w: rw };
    return { offL: face.offsetLeft, offR: rw - face.offsetLeft - face.offsetWidth, w: face.offsetWidth };
  }
  function clampCardXY(x, y) {          // x = wanted left of #lab-rail in page px
    var sr = screenEl.getBoundingClientRect(), g = railGaps();
    var top = stage.menubarH * stage.scale + 4;
    return {
      x: Math.round(Math.max(6 - g.offL, Math.min(x, sr.width - 6 - g.w - g.offL))),
      y: Math.round(Math.max(top, Math.min(y, sr.height - 64)))
    };
  }
  function applyCardPos() {
    var r = railEl();
    if (!r || !screenEl || (cardDrag && cardDrag.moved)) return;
    var p = savedCardPos();
    if (!p) { r.style.left = ''; r.style.right = ''; r.style.removeProperty('--lab-card-top'); r.classList.remove('is-moved'); return; }
    var sr = screenEl.getBoundingClientRect(), g = railGaps();
    var y = Math.round(Math.max(stage.menubarH * stage.scale + 4, Math.min(p.y, sr.height - 64)));
    if (typeof p.r === 'number') {
      var rr2 = Math.max(6, Math.min(p.r, sr.width - 6 - g.w));
      r.style.right = (Math.abs(g.offR) < 1 ? rr2 : Math.round(rr2 - g.offR)) + 'px'; r.style.left = 'auto';     // sub-pixel gaps must not drift the card
    } else {
      var c = clampCardXY(p.x, y);
      r.style.left = c.x + 'px'; r.style.right = 'auto';
    }
    r.style.setProperty('--lab-card-top', y + 'px');
    r.classList.add('is-moved');
  }
  function setupCardDrag() {
    var r = railEl();
    if (!r) return;
    r.addEventListener('pointerdown', function (e) {
      if (e.button !== 0 || cardDrag) return;
      var t = e.target;
      var onPill = t.closest && t.closest('.lab-rail-strip');
      if (!onPill && !(t.closest && t.closest('.lab-rail-head'))) return;
      if (!onPill && t.closest('a, button, input')) return;     // 收起 / 釘住 / ← Week 3 still work as links
      var rr = r.getBoundingClientRect(), sr = screenEl.getBoundingClientRect();
      cardDrag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, ox: rr.left - sr.left, oy: rr.top - sr.top, moved: false };
    });
    window.addEventListener('pointermove', function (e) {
      if (!cardDrag || e.pointerId !== cardDrag.id) return;
      var dx = e.clientX - cardDrag.sx, dy = e.clientY - cardDrag.sy;
      if (!cardDrag.moved) {
        if (Math.abs(dx) + Math.abs(dy) < 5) return;               // a plain click on the pill still opens the card
        cardDrag.moved = true;
        r.classList.add('is-dragging');
        document.body.classList.add('lab-card-dragging');
      }
      e.preventDefault();
      var c = clampCardXY(cardDrag.ox + dx, cardDrag.oy + dy);
      r.style.left = c.x + 'px'; r.style.right = 'auto';
      r.style.setProperty('--lab-card-top', c.y + 'px');
    }, { passive: false });
    function end(e) {
      if (!cardDrag || (e && e.pointerId !== cardDrag.id)) return;
      var d = cardDrag;
      cardDrag = null;
      if (!d.moved) return;
      r.classList.remove('is-dragging');
      document.body.classList.remove('lab-card-dragging');
      suppressClickUntil = Date.now() + 120;                        // the click that ends a drag must not open or fold the card
      var rr = r.getBoundingClientRect(), sr = screenEl.getBoundingClientRect(), g = railGaps();
      var gapR = sr.right - (rr.right - g.offR);                    // distance between the face and the right edge
      var y = rr.top - sr.top;
      var next;
      if (gapR < 32) {                                              // snap to the right edge
        var home = Math.abs(y - (stage.menubarH * stage.scale + 10)) < 16;
        next = home ? null : { r: 12, y: Math.round(y) };
      } else next = { x: Math.round(rr.left - sr.left), y: Math.round(y) };
      LAB.store.set('ui.cardPos', next);
      applyCardPos();
      updateCardRoom();
      LAB.bus.emit('card:moved', { x: Math.round(rr.left - sr.left), y: Math.round(y), snapped: gapR < 32 });
    }
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    r.addEventListener('click', function (e) {
      if (Date.now() < suppressClickUntil) { e.stopPropagation(); e.preventDefault(); }
    }, true);
    r.addEventListener('dblclick', function (e) {
      var t = e.target;
      if (!t.closest || !t.closest('.lab-rail-head') || t.closest('a, button, input')) return;
      layout.resetCardPos();
    });
  }
  layout.resetCardPos = function () { LAB.store.set('ui.cardPos', null); applyCardPos(); updateCardRoom(); };

  /* ================================================== performance (M§2.10) */
  var perf = LAB.perf;
  perf.low = false;
  perf.set = function (low) {
    perf.low = !!low;
    document.documentElement.setAttribute('data-perf', low ? 'low' : 'high');
  };
  perf.probe = function (avgMs) {
    if (perf.forced) return;
    if (avgMs > 24 && !perf.low) perf.set(true);
  };
  function initPerf() {
    var f = perf.forced;
    if (f === 'low') { perf.set(true); return; }
    if (f === 'high') { perf.set(false); return; }
    var low = false;
    try {
      if (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) low = true;
      if (navigator.deviceMemory && navigator.deviceMemory <= 4) low = true;
      if (window.matchMedia && window.matchMedia('(prefers-reduced-transparency: reduce)').matches) low = true;
    } catch (e) { /* ignore */ }
    perf.set(low);
  }

  /* ======================================================== wallpaper
     img/wallpaper.jpg (the code-drawn flower of Week 3 補充 2) is painted by CSS (#lab-wall in base.css, background-size: cover). */

  /* ===================================================== flyouts (tray, calendar) */
  var fly = null;    // {el, btn, off}
  function closeFlyout() {
    if (!fly) return;
    var f = fly; fly = null;
    var inner = f.el.firstChild;
    if (inner && inner._labOff) inner._labOff();            // a flyout built by sysapps.js unhooks its sys:change listener
    if (f.el.parentNode) f.el.parentNode.removeChild(f.el);
    if (f.off) f.off();
    if (f.btn) { f.btn.setAttribute('aria-expanded', 'false'); f.btn.classList.remove('is-open'); }
    window.removeEventListener('pointerdown', onFlyDown, true);
  }
  function onFlyDown(e) {
    if (fly && !fly.el.contains(e.target) && !(fly.btn && fly.btn.contains(e.target))) closeFlyout();
  }
  function openFlyout(btn, node, widthPx) {
    if (fly && fly.btn === btn) { closeFlyout(); return; }
    closeAllPopups();
    btn.setAttribute('aria-expanded', 'true'); btn.classList.add('is-open');
    var el = h('div', { class: 'lab-flyout', role: 'dialog' }, typeof node === 'function' ? node() : node);     // a function builds the content only when the flyout really opens
    el.style.width = (widthPx || 300) + 'px';
    overlaysEl.appendChild(el);
    fly = { el: el, btn: btn, off: LAB.keys.modal(function (e) { if (e.key === 'Escape') { closeFlyout(); return true; } return false; }) };
    window.addEventListener('pointerdown', onFlyDown, true);
  }
  function closeAllPopups() {
    closeFlyout();
    if (typeof closeStart === 'function') closeStart();
    if (typeof closeSpotlight === 'function') closeSpotlight();
    if (LAB.menu) LAB.menu.closeAll();
    if (LAB.sys && LAB.sys.taskView && LAB.sys.taskView.isOpen()) LAB.sys.taskView.close();
  }
  LAB.desktop = LAB.desktop || {};
  LAB.desktop.closeFlyout = closeFlyout;

  /* ================================================ taskbar: tray (M§2.2 replaced) */
  var clockBtn = null, clockT1 = null, clockT2 = null, imeBtn = null, wifiBtn = null;
  var P2 = function (n) { return (n < 10 ? '0' : '') + n; };
  function fmtClock(ms) {
    if (LAB.win && LAB.win.fmtClock) return LAB.win.fmtClock(ms);
    var d = new Date(ms), hh = d.getHours() % 12 || 12;
    return [(d.getHours() < 12 ? '上午 ' : '下午 ') + P2(hh) + ':' + P2(d.getMinutes()), d.getFullYear() + '/' + (d.getMonth() + 1) + '/' + d.getDate()];
  }
  function updateClock() {
    if (!clockT1) return;
    var c = fmtClock(LAB.clock.ms());
    if (clockT1.textContent !== c[0]) clockT1.textContent = c[0];
    if (clockT2.textContent !== c[1]) clockT2.textContent = c[1];
  }
  /* the Quick Settings panel (network / speaker area) and the notification centre with the calendar (the clock) are built in sysapps.js
     (LAB.sys.quickSettings / notificationCenter); before that file is there a flyout just says so */
  function sysNode(name, fallbackText) {
    if (LAB.sys && typeof LAB.sys[name] === 'function') return LAB.sys[name]();
    return h('div', { class: 'lab-fly-note' }, fallbackText);
  }
  /* the network / speaker button's tooltip and the Wi-Fi glyph follow the settings (Quick Settings, Settings app) */
  function updateTrayState() {
    var s = LAB.sys && LAB.sys.state;
    if (!s) return;
    var sysBtn = tbBar && tbBar.querySelector('[data-lab=tray-system]');
    if (sysBtn) sysBtn.setAttribute('data-tip', (s.wifi ? 'Wi-Fi：已連線（' + LAB.sys.info.WIFI + '）' : 'Wi-Fi：已關閉') + '　音量：' + s.volume + '%');
    if (wifiBtn) wifiBtn.classList.toggle('is-off', !s.wifi);
  }

  /* IME indicator (中 / 英). Shift alone toggles it, like the Microsoft Bopomofo IME; the state is public for the apps that care */
  var ime = LAB.ime = { mode: 'zh', get: function () { return this.mode; }, set: function (m) { setIme(m); }, toggle: function () { setIme(ime.mode === 'zh' ? 'en' : 'zh'); } };
  var osdEl = null, osdTimer = null;
  function showOsd(txt) {
    if (!overlaysEl) return;
    if (!osdEl) { osdEl = h('div', { class: 'lab-ime-osd', 'aria-hidden': 'true' }); overlaysEl.appendChild(osdEl); }
    osdEl.textContent = txt;
    osdEl.classList.add('is-in');
    clearTimeout(osdTimer);
    osdTimer = setTimeout(function () { if (osdEl) osdEl.classList.remove('is-in'); }, 900);
  }
  function setIme(m) {
    if (m !== 'zh' && m !== 'en') return;
    if (ime.mode === m) return;
    ime.mode = m;
    if (imeBtn) {
      imeBtn.textContent = m === 'zh' ? '中' : '英';
      imeBtn.setAttribute('aria-label', '輸入法：' + (m === 'zh' ? '中文' : '英文'));
      imeBtn.setAttribute('data-tip', m === 'zh' ? '中文（繁體，台灣）　按 Shift 切換' : '英文　按 Shift 切換');
    }
    showOsd(m === 'zh' ? '中' : '英');
    LAB.bus.emit('ime:change', { mode: m });
  }
  var shiftArmed = false;
  function setupImeKey() {
    window.addEventListener('keydown', function (e) {
      if (e.key === 'Shift') { if (!e.repeat) shiftArmed = !e.ctrlKey && !e.altKey && !e.metaKey; }
      else shiftArmed = false;
    }, true);
    window.addEventListener('keyup', function (e) {
      if (e.key === 'Shift' && shiftArmed) { shiftArmed = false; ime.toggle(); }
    }, true);
    window.addEventListener('pointerdown', function () { shiftArmed = false; }, true);
  }

  /* Wi-Fi joining animation (shell.css .is-joining): the arcs light up one after another (same API as the Mac copy) */
  var wifiTimer = null;
  function wifiJoin(ms) {
    if (!wifiBtn) return;
    wifiBtn.classList.add('is-joining');
    wifiBtn.setAttribute('aria-label', 'Wi-Fi：連線中');
    clearTimeout(wifiTimer);
    wifiTimer = setTimeout(function () { wifiBtn.classList.remove('is-joining'); wifiBtn.setAttribute('aria-label', 'Wi-Fi'); }, ms);
  }
  function scheduleWifi() {
    // every 4 to 9 minutes, for 2 to 3.5 s
    setTimeout(function () { if (!document.hidden) wifiJoin(2000 + Math.random() * 1500); scheduleWifi(); }, (4 + Math.random() * 5) * 60000);
  }
  LAB.desktop = LAB.desktop || {};
  LAB.desktop.wifiJoin = wifiJoin;

  /* show desktop (the 4 px sliver at the far right): minimizes everything, a second click brings the same windows back */
  var deskHidden = null;
  function showDesktop() {
    var vis = LAB.wm.all().filter(function (w) { return !w.isMinimized(); });
    if (vis.length) { deskHidden = vis.map(function (w) { return w.id; }); vis.forEach(function (w) { LAB.wm.minimize(w.id); }); LAB.wm.focusDesktop(); }
    else if (deskHidden) {
      deskHidden.forEach(function (id) { var w = LAB.wm.get(id); if (w && w.isMinimized()) LAB.wm.restore(id); });
      deskHidden = null;
    }
  }
  LAB.desktop.showDesktop = showDesktop;

  /* ============================================================ file moves */
  /* Shared by the desktop and the taskbar: move or copy `paths` into `destDir`, asking on name collisions. */
  function transfer(paths, destDir, mode, by) {
    var vfs = LAB.vfs;
    var i = 0;
    function next() {
      if (i >= paths.length) return Promise.resolve();
      var src = paths[i++];
      var st = vfs.stat(src);
      if (!st) return next();
      var dest = vfs.join(destDir, st.name);
      var replaced = false;
      if (vfs.same(vfs.dirname(st.path), destDir) && mode === 'move') return next();
      if (vfs.isUnder(destDir, st.path) && st.type === 'dir') { return next(); }
      var doIt = function (target, overwrite) {
        try {
          if (mode === 'copy') vfs.copy(st.path, target, { by: by, recursive: true });
          else {
            var from = st.path;
            var to = vfs.move(st.path, target, { by: by, overwrite: overwrite !== false });
            if (overwrite === false || !replaced) LAB.undo.push('移動「' + st.name + '」', function () { vfs.move(to, from, { by: by, overwrite: false }); });
          }
        } catch (e) { LAB.ui.vfsFail(null, e, '這個項目移不過去（' + vfs.errText(e.code) + '）', st.path); }
      };
      if (vfs.exists(dest) && !vfs.same(dest, st.path)) {
        return LAB.ui.alert(null, {
          title: '這個目的地已有相同名稱的檔案',
          text: '「' + st.name + '」已經存在於這個位置。要取代它，還是兩個都保留？',
          buttons: [
            { label: '兩個都保留', value: 'both' },
            { label: '取消', value: 'stop', cancel: true },
            { label: '取代目的地中的項目', value: 'replace', 'default': true }
          ]
        }).then(function (v) {
          if (v === 'stop' || v === null) { i = paths.length; return; }
          if (v === 'both') {
            var ext = st.type === 'file' ? vfs.extname(st.name) : '';
            var base = ext ? st.name.slice(0, st.name.length - ext.length) : st.name;
            doIt(vfs.join(destDir, winUniqueName(destDir, base + ' - 複製', ext)), false);
          } else {
            try { vfs.remove(dest, { by: by, recursive: true, force: true }); } catch (e) { /* ignore */ }
            replaced = true;
            doIt(dest, true);
          }
          return next();
        });
      }
      doIt(dest, true);
      return next();
    }
    return next();
  }
  LAB.desktop.transfer = transfer;

  /* Windows numbering for a name that is taken: 新增資料夾, 新增資料夾 (2), 新增資料夾 (3) ... */
  function winUniqueName(dir, base, ext) {
    ext = ext || '';
    var name = base + ext, n = 2;
    while (LAB.vfs.exists(LAB.vfs.join(dir, name))) { name = base + ' (' + n + ')' + ext; n++; if (n > 999) break; }
    return name;
  }

  /* ==================================================== desktop icons (W3) */
  var icons = new Map();            // path -> {el, st, icon, dispose}; the Recycle Bin is the virtual path '::trash'
  var selected = new Set();
  var renaming = null;              // path currently in the inline editor
  var iconPos = new Map();          // path -> {x,y}: the top-left of the icon's cell in stage px. An icon keeps its place until the student moves it
  var pendingAt = new Map();        // path -> {x,y}: a NEW icon that should appear where the student pointed (the 新增 menu, a file dropped from Explorer)
  var renderTimer = null;
  var pendingFlush = false;
  var TRASH_KEY = '::trash';
  var focusPath = null;             // the icon that carries the keyboard focus rectangle (arrow keys)

  function setSelected(paths, silent) {
    var next = new Set(paths);
    var same = next.size === selected.size;
    if (same) next.forEach(function (p) { if (!selected.has(p)) same = false; });
    selected = next;
    if (focusPath && !selected.has(focusPath)) focusPath = null;
    icons.forEach(function (rec, p) {
      rec.el.classList.toggle('is-sel', selected.has(p)); rec.el.setAttribute('aria-selected', selected.has(p) ? 'true' : 'false');
      rec.el.classList.toggle('is-focus', p === focusPath);
    });
    updateKey();
    if (!same && !silent) LAB.bus.emit('desktop:select', { paths: Array.from(selected) });
  }

  /* ---- the grid: one cell per icon (cell size = the chosen icon size). 「將圖示對齊格線」 puts a dropped icon on the nearest free cell. ---- */
  function workH() { return stage.h - TB_H; }
  function cellKey(c, r) { return c + ',' + r; }
  function cellToXY(c, r) { var m = metr(); return { x: ICON_X0 + c * m.w, y: ICON_Y0 + r * m.h }; }
  function xyToCell(x, y) {
    var m = metr();
    return { c: Math.max(0, Math.min(cellCols() - 1, Math.round((x - ICON_X0) / m.w))), r: Math.max(0, Math.min(cellRows() - 1, Math.round((y - ICON_Y0) / m.h))) };
  }
  /* an icon's top-left kept fully on the desktop: never off the screen, never under the taskbar */
  function clampXY(x, y) {
    var m = metr();
    return { x: Math.round(Math.max(0, Math.min(x, stage.w - m.w))), y: Math.round(Math.max(0, Math.min(y, workH() - m.h))) };
  }
  function setPos(p, xy) {
    var c = { x: Math.round(xy.x), y: Math.round(xy.y) };
    iconPos.set(p, c);
    var rec = icons.get(p);
    if (rec) { rec.el.style.left = c.x + 'px'; rec.el.style.top = c.y + 'px'; }
  }
  /* the mission card (or its pill) is no place for an icon: where it sits, in stage px with a little air around it; null when it is not showing */
  function cardBox() {
    var el = cardFace();
    if (!el || !stageEl) return null;
    var r = el.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    var sr = stageEl.getBoundingClientRect(), s = stage.scale;
    return { x: (r.left - sr.left) / s - 6, y: (r.top - sr.top) / s - 6, w: r.width / s + 12, h: r.height / s + 12 };
  }
  function hitsBox(xy, box) {
    var m = metr();
    return !!box && xy.x < box.x + box.w && xy.x + m.w > box.x && xy.y < box.y + box.h && xy.y + m.h > box.y;
  }
  /* what a NEW icon (a new folder, a file dropped in from Explorer) must not land under: the mission card and, when `wins` is given, the windows that
     are open: 'cells' = no cell that touches a window (the student types the name into a new folder: it has to be in sight), 'center' = no cell whose
     middle is under a window (a dropped file may sit half under the window it came from, as in Windows) */
  function blockers(wins) {
    var list = [], c = cardBox();
    if (c) list.push(c);
    if (wins && LAB.wm) LAB.wm.all().forEach(function (w) {
      if (w.isMinimized() || w.el.hidden) return;
      var r = w.getRect();
      list.push({ x: r.x - 4, y: r.y - 4, w: r.w + 8, h: r.h + 8, win: true });
    });
    return list;
  }
  function hitsAny(xy, list, mode) {
    var m = metr();
    for (var i = 0; i < list.length; i++) {
      var b = list[i];
      if (b.win && mode === 'center') {
        var cx = xy.x + m.w / 2, cy = xy.y + m.h / 2;
        if (cx > b.x && cx < b.x + b.w && cy > b.y && cy < b.y + b.h) return true;
      } else if (hitsBox(xy, b)) return true;
    }
    return false;
  }
  /* the cells taken by the icons that have a place, except the paths in `skip` (a Set) */
  function takenCells(skip) {
    var t = new Set();
    icons.forEach(function (rec, p) {
      if (skip && skip.has(p)) return;
      var pos = iconPos.get(p);
      if (!pos) return;
      var c = xyToCell(pos.x, pos.y);
      t.add(cellKey(c.c, c.r));
    });
    return t;
  }
  /* the free cell closest to a wanted top-left (px); null when the grid is full */
  function nearestFree(x, y, taken, wins) {
    var cols = cellCols(), rows = cellRows(), bl = blockers(wins), best = null, bd = 1e12;
    for (var c = 0; c < cols; c++) {
      for (var r = 0; r < rows; r++) {
        if (taken.has(cellKey(c, r))) continue;
        var xy = cellToXY(c, r);
        if (hitsAny(xy, bl, wins)) continue;
        var d = (xy.x - x) * (xy.x - x) + (xy.y - y) * (xy.y - y);
        if (d < bd - 0.001) { bd = d; best = { c: c, r: r, x: xy.x, y: xy.y }; }
      }
    }
    if (!best && wins === 'cells') return nearestFree(x, y, taken, 'center');
    if (!best && wins) return nearestFree(x, y, taken, false);          // windows everywhere (a maximized one): never mind them
    return best;
  }
  /* the first free cell, filling column by column from the top-left (where Windows puts a new icon) */
  function firstFree(taken) {
    var cols = cellCols(), rows = cellRows(), bl = blockers(false);
    for (var c = 0; c < cols; c++) {
      for (var r = 0; r < rows; r++) {
        if (taken.has(cellKey(c, r))) continue;
        var xy = cellToXY(c, r);
        if (hitsAny(xy, bl, false)) continue;
        return { c: c, r: r, x: xy.x, y: xy.y };
      }
    }
    return null;
  }
  /* items = [{path, x, y}] (wanted top-lefts) -> Map path -> {x,y} on free cells; `taken` (a Set of cell keys) gains the cells that are used.
     The icons whose wanted spot is closest to a cell choose first, so a dropped icon lands on the nearest free cell around where it was let go. */
  function snapGroup(items, taken, wins) {
    var out = new Map();
    var order = items.map(function (it) {
      var c = xyToCell(it.x, it.y), xy = cellToXY(c.c, c.r);
      return { it: it, d: Math.abs(xy.x - it.x) + Math.abs(xy.y - it.y) };
    }).sort(function (a, b) { return a.d - b.d; });
    order.forEach(function (o) {
      var f = nearestFree(o.it.x, o.it.y, taken, wins);
      if (f) { taken.add(cellKey(f.c, f.r)); out.set(o.it.path, { x: f.x, y: f.y }); }
      else out.set(o.it.path, clampXY(o.it.x, o.it.y));      // the grid is full: stay where it was let go
    });
    return out;
  }
  /* 「將圖示對齊格線」 is off: an icon stays exactly where it was let go, only pushed aside a little when it would sit on another icon,
     and out from under the mission card */
  function placeFree(items, group) {
    var m = metr(), out = new Map(), placed = [], box = cardBox();
    items.forEach(function (it) {
      var q = clampXY(it.x, it.y);
      for (var k = 0; k < 14; k++) {
        var hit = false;
        icons.forEach(function (rec, p) {
          if (hit || group.has(p)) return;
          var o = iconPos.get(p);
          if (o && Math.abs(o.x - q.x) < m.w * 0.55 && Math.abs(o.y - q.y) < m.h * 0.55) hit = true;
        });
        placed.forEach(function (o) { if (!hit && Math.abs(o.x - q.x) < m.w * 0.55 && Math.abs(o.y - q.y) < m.h * 0.55) hit = true; });
        if (!hit) break;
        q = clampXY(q.x + 22, q.y + 14);
      }
      if (hitsBox(q, box)) q = clampXY(box.x - m.w - 2, q.y);
      out.set(it.path, q);
      placed.push(q);
    });
    return out;
  }
  /* 自動排列圖示: every icon in its place in a column-by-column flow from the top-left, no gaps */
  function flow(ordered) {
    var rows = cellRows(), cols = cellCols();
    ordered.forEach(function (p, idx) {
      var c = Math.min(cols - 1, Math.floor(idx / rows)), r = idx % rows;
      setPos(p, cellToXY(c, r));
    });
  }
  /* the order the icons are in while auto-arrange is on: the student's own order (after a drag), else the sort order */
  function autoOrder(all) {
    if (!DT.order) return all;
    var seen = new Set(), out = [];
    DT.order.forEach(function (p) { if (all.indexOf(p) >= 0 && !seen.has(p)) { seen.add(p); out.push(p); } });
    all.forEach(function (p) { if (!seen.has(p)) out.push(p); });          // new icons go last
    return out;
  }
  /* the icons as the eye reads them: column by column, top to bottom (arrow keys, type-ahead, turning auto-arrange on) */
  function visualOrder() {
    var arr = [];
    icons.forEach(function (rec, p) { var pos = iconPos.get(p); if (pos) arr.push({ p: p, c: xyToCell(pos.x, pos.y), pos: pos }); });
    arr.sort(function (a, b) { return a.c.c - b.c.c || a.c.r - b.c.r || a.pos.x - b.pos.x || a.pos.y - b.pos.y; });
    return arr.map(function (o) { return o.p; });
  }
  /* give a place to every icon that has none (the first free cell, or where the student pointed); icons that have one keep it */
  function layoutIcons(order) {
    iconCount = Math.max(1, order.length);
    if (DT.autoArrange) { flow(autoOrder(order)); return; }
    var fresh = order.filter(function (p) { return !iconPos.has(p); });
    if (!fresh.length) return;
    var taken = takenCells(null);
    var withAt = fresh.filter(function (p) { return pendingAt.has(p); });
    if (withAt.length) {
      var m = metr();
      var items = withAt.map(function (p, i) { var a = pendingAt.get(p); return { path: p, x: a.x + (i % 3) * m.w, y: a.y + Math.floor(i / 3) * m.h }; });
      var out = snapGroup(items, taken, pendingAt.get(withAt[0]).wins || 'cells');            // a new icon always takes a cell near where the student pointed, clear of the open windows
      out.forEach(function (xy, p) { setPos(p, xy); });
      withAt.forEach(function (p) { pendingAt.delete(p); });
      taken = takenCells(null);
    }
    fresh.filter(function (p) { return !pendingAt.has(p) && !iconPos.has(p); }).forEach(function (p) {
      var f = firstFree(taken);
      if (f) taken.add(cellKey(f.c, f.r));
      setPos(p, f || clampXY(ICON_X0, ICON_Y0));
    });
  }
  /* the screen changed size (or the icons did): everything that is now outside is brought back inside; on the grid, icons that would share
     a cell move on to the next free one. Icons that are fine do not move. */
  function reflowIcons() {
    if (!desktopEl) return;
    var order = currentOrder();
    if (DT.autoArrange) { flow(autoOrder(order)); return; }
    var stray = [];
    order.forEach(function (p) {
      var pos = iconPos.get(p);
      if (!pos) return;
      var c = clampXY(pos.x, pos.y);
      if (c.x !== pos.x || c.y !== pos.y) stray.push({ path: p, x: c.x, y: c.y });
    });
    if (!stray.length) return;
    var group = new Set(stray.map(function (s) { return s.path; }));
    var out = DT.snap ? snapGroup(stray, takenCells(group)) : placeFree(stray, group);
    out.forEach(function (xy, p) { setPos(p, xy); });
  }
  function currentOrder() {
    var list = sortedDesktop();
    return [TRASH_KEY].concat(list.map(function (s) { return s.path; }).filter(function (p) { return icons.has(p); }));
  }

  function updateKey() {
    if (!desktopEl) return;
    desktopEl.classList.toggle('is-key', !LAB.wm.focused());
  }
  function trashFull() {
    try { return LAB.vfs.list(TRASH).length > 0; } catch (e) { return false; }
  }
  function trashIconName() { return trashFull() ? 'app-trash-full' : 'app-trash-empty'; }

  /* the Desktop folder in the order of the chosen 排序方式 (the Recycle Bin is not in the list: it always comes first). Folders stay in front, as Windows
     sorts the desktop. 大小 and 修改日期 start with the biggest / the newest (my reading of Windows 11; choosing the same item again turns the order round). */
  function sortedDesktop() {
    var list = [];
    try { list = LAB.vfs.visible(LAB.vfs.list(DESKTOP)); } catch (e) { list = []; }
    var key = DT.sortKey || 'name', dir = DT.sortDesc ? -1 : 1;
    function byName(a, b) { var x = a.name.toLowerCase(), y = b.name.toLowerCase(); return x < y ? -1 : (x > y ? 1 : 0); }
    function ext(s) { return s.type === 'dir' ? '' : LAB.vfs.extname(s.name).toLowerCase(); }
    list.sort(function (a, b) {
      if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
      var r = 0;
      if (key === 'name') return byName(a, b) * dir;
      if (key === 'size') r = ((a.size || 0) - (b.size || 0)) * dir;
      else if (key === 'date') r = ((a.mtime || 0) - (b.mtime || 0)) * dir;
      else if (key === 'type') { var ea = ext(a), eb = ext(b); r = ea < eb ? -dir : (ea > eb ? dir : 0); }
      return r || byName(a, b);
    });
    return list;
  }

  function renderIcons() {
    var list = sortedDesktop();
    var seen = new Set([TRASH_KEY]);
    // the Recycle Bin always comes first
    var trashRec = icons.get(TRASH_KEY);
    if (!trashRec) { trashRec = makeIcon({ path: TRASH_KEY, name: '資源回收筒', type: 'special' }); icons.set(TRASH_KEY, trashRec); desktopEl.appendChild(trashRec.el); }
    var tn = trashIconName();
    if (trashRec.icon !== tn) { trashRec.icon = tn; trashRec.el.querySelector('.lab-dicon-img').innerHTML = LAB.icons.get(tn, { size: 48 }); }
    list.forEach(function (st) {
      seen.add(st.path);
      var rec = icons.get(st.path);
      if (!rec) { rec = makeIcon(st); icons.set(st.path, rec); desktopEl.appendChild(rec.el); }
      else {
        rec.st = st;
        if (renaming !== st.path) {
          var lab = rec.el.querySelector('.lab-dicon-label');
          if (lab && lab.textContent !== st.name) lab.textContent = st.name;
        }
        var ic = LAB.icons.forNode(st);
        if (rec.icon !== ic) { rec.icon = ic; rec.el.querySelector('.lab-dicon-img').innerHTML = LAB.icons.get(ic, { size: 48 }); }
      }
    });
    icons.forEach(function (rec, p) {
      if (!seen.has(p) && renaming !== p) {
        if (rec.el.parentNode) rec.el.parentNode.removeChild(rec.el);
        icons.delete(p); iconPos.delete(p); pendingAt.delete(p); selected.delete(p);
        if (rec.dispose) rec.dispose();
      }
    });
    layoutIcons([TRASH_KEY].concat(list.filter(function (s) { return icons.has(s.path); }).map(function (s) { return s.path; })));
    setSelected(Array.from(selected).filter(function (p) { return icons.has(p); }), true);
  }
  function scheduleRender() {
    if (renderTimer) return;
    renderTimer = setTimeout(function () {
      renderTimer = null;
      if (LAB.dnd.active()) { pendingFlush = true; return; }
      renderIcons();
    }, 100);
  }
  function flushAfterDrag() { if (pendingFlush) { pendingFlush = false; renderIcons(); } }

  function makeIcon(st) {
    var isTrash = st.path === TRASH_KEY;
    var iconName = isTrash ? trashIconName() : LAB.icons.forNode(st);
    var imgBox = h('div', { class: 'lab-dicon-img' });
    imgBox.innerHTML = LAB.icons.get(iconName, { size: 48 });     // static icon markup only
    var label = h('div', { class: 'lab-dicon-label' }, st.name);
    var el = h('div', {
      class: 'lab-dicon', role: 'button', tabindex: '-1', 'aria-selected': 'false', 'aria-label': st.name,
      dataset: { lab: 'desktop-icon', path: st.path }
    }, imgBox, label);
    var rec = { el: el, st: st, icon: iconName, dispose: null };
    var offs = [];

    function path() { return rec.st.path; }
    function pressSelect(e) {
      var p = path();
      LAB.wm.focusDesktop();
      focusPath = null;
      if (e.metaKey || e.ctrlKey || e.shiftKey) {
        var n = new Set(selected);
        if (n.has(p)) n.delete(p); else n.add(p);
        setSelected(Array.from(n));
      } else if (!selected.has(p)) setSelected([p]);
      beginPress(e);
    }
    function clickSelect(e) {
      if (e.metaKey || e.ctrlKey || e.shiftKey) return;
      setSelected([path()]);
    }
    offs.push(LAB.dnd.source(el, function () {
      /* the whole selection goes together (the pressed icon alone when it was not selected). The files among them make the ordinary 'fs'
         drag (folders, the Recycle Bin, windows, taskbar buttons take them as before); `desk` is what the empty desktop needs to move the icons.
         The Recycle Bin itself can be moved too, but never dropped anywhere: alone it is a 'desk' drag that only the empty desktop accepts. */
      var p = path();
      var group = (selected.has(p) ? Array.from(selected) : [p]).filter(function (q) { return icons.has(q); });
      var paths = group.filter(function (q) { return q !== TRASH_KEY; });
      var label = group.length > 1 ? group.length + ' 個項目' : (isTrash ? '資源回收筒' : rec.st.name);
      return { kind: paths.length ? 'fs' : 'desk', paths: paths, from: 'desktop', label: label, iconName: isTrash ? rec.icon : LAB.icons.forNode(rec.st), desk: { group: group, anchor: p } };
    }, { onPressSelect: pressSelect, onClickSelect: clickSelect }));
    el.addEventListener('dblclick', function (e) {
      e.stopPropagation();
      if (isTrash) { LAB.apps.openFolder(TRASH, 'desktop'); return; }
      openItem(path(), 'desktop');
    });
    if (isTrash) {
      // files dropped on the Recycle Bin are deleted into it (no confirmation, like Windows 11)
      offs.push(LAB.dnd.target(el, {
        id: 'desktop:trash',
        accept: function (pl) { return pl.kind === 'fs' && !(pl.desk && pl.desk.group.indexOf(TRASH_KEY) >= 0) ? 'move' : false; },
        enter: function () { el.classList.add('is-drop'); },
        leave: function () { el.classList.remove('is-drop'); },
        drop: function (pl) { el.classList.remove('is-drop'); trashPaths(pl.paths, 'desktop'); }
      }));
    } else if (st.type === 'dir') {
      // folder icons accept drops (move into the folder)
      offs.push(LAB.dnd.target(el, {
        id: 'desktop:folder:' + st.path,
        accept: function (pl, mods) {
          if (pl.kind !== 'fs') return false;
          if (pl.desk && pl.desk.group.indexOf(TRASH_KEY) >= 0) return false;      // the Recycle Bin is part of what is being carried: it only moves on the empty desktop
          var p = path();
          for (var i = 0; i < pl.paths.length; i++) {
            if (LAB.vfs.same(pl.paths[i], p) || LAB.vfs.isUnder(p, pl.paths[i])) return false;
            if (LAB.vfs.same(LAB.vfs.dirname(pl.paths[i]), p)) return false;
          }
          return mods.altKey || mods.mode === 'copy' ? 'copy' : 'move';
        },
        enter: function () { el.classList.add('is-drop'); },
        leave: function () { el.classList.remove('is-drop'); },
        drop: function (pl, ctx) { el.classList.remove('is-drop'); transfer(pl.paths, path(), ctx.mode === 'copy' ? 'copy' : 'move', 'desktop'); }
      }));
    }
    rec.dispose = function () { offs.forEach(function (f) { f(); }); };
    return rec;
  }

  /* ---- rename (F2 or the right-click menu; the name field is a one-line text box over the label) ---- */
  function baseLen(name, isDir) {
    if (isDir) return name.length;
    var i = name.lastIndexOf('.');
    return i > 0 ? i : name.length;
  }
  function startRename(path) {
    if (path === TRASH_KEY) return;
    renderIcons();
    var rec = icons.get(path);
    if (!rec) return;
    if (renaming) return;
    renaming = path;
    var label = rec.el.querySelector('.lab-dicon-label');
    var st = rec.st;
    var input = h('input', { type: 'text', class: 'lab-dicon-edit', 'aria-label': '重新命名', spellcheck: 'false', autocomplete: 'off', dataset: { lab: 'desktop-rename' } });
    input.value = st.name;
    label.textContent = '';
    label.appendChild(input);
    rec.el.classList.add('is-renaming');
    setSelected([path]);
    input.focus();
    input.setSelectionRange(0, baseLen(st.name, st.type === 'dir'));
    var done = false;
    function finish(commit) {
      if (done) return;
      done = true;
      var val = input.value;
      renaming = null;
      rec.el.classList.remove('is-renaming');
      label.textContent = rec.st.name;
      if (commit && val !== rec.st.name && val.trim() !== '') {
        try {
          var oldNameR = rec.st.name;
          var np = LAB.vfs.rename(rec.st.path, val, { by: 'desktop' });
          LAB.undo.push('重新命名「' + oldNameR + '」', function () { LAB.vfs.rename(np, oldNameR, { by: 'desktop' }); });
          var oldPos = iconPos.get(rec.st.path);
          icons.delete(rec.st.path); iconPos.delete(rec.st.path);
          rec.st = LAB.vfs.stat(np) || rec.st;
          rec.el.dataset.path = np;
          icons.set(np, rec);
          if (oldPos) iconPos.set(np, oldPos);                // a renamed icon stays where it is (Windows does not move it)
          selected = new Set([np]);
        } catch (e) {
          if (e.code === 'EEXIST') LAB.ui.alert(null, { title: '重新命名檔案', text: '已經有一個名稱為「' + val + '」的項目存在於此位置。請使用不同的名稱。', buttons: [{ label: '確定', value: true, 'default': true }] });
          else LAB.ui.vfsFail(null, e, '這個名稱不能用（' + LAB.vfs.errText(e.code) + '）', rec.st.path);
        }
      }
      renderIcons();
    }
    input.addEventListener('keydown', function (e) {
      e.stopPropagation();
      if (LAB.ui.isImeEnter(e)) return;
      if (e.key === 'Enter') { e.preventDefault(); finish(true); }
      else if (e.key === 'Escape') { e.preventDefault(); finish(false); }   // Esc keeps the name it has now (the default 「新增資料夾」 for a new folder)
    });
    input.addEventListener('blur', function () { finish(true); });
    input.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
  }
  LAB.desktop.startRename = startRename;
  LAB.desktop.selected = function () { return Array.from(selected); };
  LAB.desktop.refreshIcons = renderIcons;

  /* 新增 > 資料夾 / 文字文件: the new icon appears where the student right-clicked (on the nearest free cell with 「對齊格線」), in rename mode */
  function newItemOnDesktop(kind, at) {
    var isDir = kind === 'folder';
    var base = isDir ? '新增資料夾' : '新增文字文件', ext = isDir ? '' : '.txt';
    var name = winUniqueName(DESKTOP, base, ext);
    var p = LAB.vfs.join(DESKTOP, name);
    if (at && !DT.autoArrange) pendingAt.set(p, { x: at.x - metr().w * 0.4, y: at.y - 16, wins: 'cells' });
    try {
      if (isDir) LAB.vfs.mkdir(p, { by: 'desktop' }); else LAB.vfs.writeFile(p, '', { by: 'desktop' });
    } catch (e) { pendingAt.delete(p); LAB.ui.vfsFail(null, e, '無法建立新的項目', p); return; }
    startRename(p);
  }

  /* ---- delete / recycle ---- */
  function trashPaths(paths, by) {
    var done = [];
    paths.forEach(function (p) {
      if (p === TRASH_KEY) return;
      try { done.push({ name: LAB.vfs.basename(p), dest: LAB.vfs.trash(p, { by: by }) }); }
      catch (e) { LAB.ui.vfsFail(null, e, '無法移到資源回收筒', p); }
    });
    if (done.length) {
      LAB.undo.push('刪除「' + done[0].name + '」' + (done.length > 1 ? '等 ' + done.length + ' 個項目' : ''), function () {
        done.forEach(function (d) { try { LAB.vfs.putBack(d.dest, { by: by }); } catch (e) { /* already gone */ } });
      });
    }
    return done.length;
  }
  function trashSelection(paths) {
    trashPaths(paths, 'desktop');
    setSelected([]);
    renderIcons();
  }
  function confirmEmptyTrash() {
    var n = 0;
    try { n = LAB.vfs.list(TRASH).length; } catch (e) { n = 0; }
    if (!n) { LAB.ui.toast('資源回收筒是空的'); return Promise.resolve(); }
    return LAB.ui.confirm(null, {
      title: n === 1 ? '刪除檔案' : '刪除多個項目',
      text: n === 1 ? '您確定要永久刪除這個項目嗎?' : '您確定要永久刪除這 ' + n + ' 個項目嗎?',
      ok: '是', cancel: '否', danger: true
    }).then(function (ok) { if (ok) { LAB.vfs.emptyTrash({ by: 'desktop' }); renderIcons(); } });
  }
  LAB.desktop.confirmEmptyTrash = confirmEmptyTrash;

  /* ---- clipboard (cut / copy on the desktop, paste in the empty-desktop menu) ---- */
  function clipPaste() {
    var paths = (LAB.clipboard && LAB.clipboard.paths) || [], op = LAB.clipboard && LAB.clipboard.op;
    paths.forEach(function (p) {
      var st = LAB.vfs.stat(p);
      if (!st) return;
      if (op === 'cut') { transfer([p], DESKTOP, 'move', 'desktop'); return; }
      var ext = st.type === 'file' ? LAB.vfs.extname(st.name) : '';
      var base = ext ? st.name.slice(0, st.name.length - ext.length) : st.name;
      var target = LAB.vfs.join(DESKTOP, LAB.vfs.same(LAB.vfs.dirname(p), DESKTOP) || LAB.vfs.exists(LAB.vfs.join(DESKTOP, st.name)) ? winUniqueName(DESKTOP, base + ' - 複製', ext) : st.name);
      try { LAB.vfs.copy(p, target, { by: 'desktop', recursive: true }); } catch (e) { LAB.ui.toast('無法複製'); }
    });
  }
  /* Open a file or folder the Windows way (the shell's own entry points: desktop icons, Start recommendations, Search results).
     Everything goes through LAB.apps.openPath (apps.js), so the desktop, Start, Search and File Explorer agree: folders and .zip files -> File Explorer
     (a zip opens like a folder), .md .txt .csv .json .log -> Notepad, .pdf -> Edge, .png .jpg -> Photos, .docx -> a toast. finder:open is emitted once. */
  function openItem(path, via) {
    var st = LAB.vfs.stat(path);
    if (!st) return false;
    return LAB.apps.openPath(path, { via: via });
  }
  LAB.desktop.openItem = openItem;
  function termAt(path) {
    if (LAB.terminal && LAB.terminal.openAt) LAB.terminal.openAt(path);
    else LAB.apps.launch('terminal', { cwd: path });
  }

  /* ---- context menus (Windows 11) ---- */
  function itemMenu(path, x, y) {
    if (path === TRASH_KEY) {
      var full = trashFull();
      LAB.menu.contextMenu(x, y, [
        { label: '開啟', icon: 'fl-open', action: function () { LAB.apps.openFolder(TRASH, 'desktop'); } },
        { label: '清空資源回收筒', icon: 'fl-recycle', enabled: full, action: confirmEmptyTrash },
        { separator: true },
        { label: '內容', icon: 'fl-props', action: toastNoFeature }
      ]);
      return;
    }
    var st = LAB.vfs.stat(path);
    if (!st) return;
    var multi = selected.size > 1 && selected.has(path);
    var targets = (multi ? Array.from(selected) : [path]).filter(function (p) { return p !== TRASH_KEY; });
    var ow = LAB.apps.openWith(path);
    var items = [
      { iconRow: [
        { icon: 'fl-cut', label: '剪下', shortcut: 'Ctrl+X', action: function () { LAB.clipboard.setPaths(targets, 'cut'); } },
        { icon: 'fl-copy', label: '複製', shortcut: 'Ctrl+C', action: function () { LAB.clipboard.setPaths(targets, 'copy'); } },
        { icon: 'fl-rename', label: '重新命名', enabled: !multi, action: function () { startRename(path); } },
        { icon: 'fl-delete', label: '刪除', shortcut: 'Delete', action: function () { trashSelection(targets); } }
      ] },
      { label: '開啟', icon: 'fl-open', action: function () { targets.forEach(function (p) { openItem(p, 'desktop'); }); } },
      { label: '開啟檔案', icon: 'fl-open', enabled: ow.length > 0, submenu: ow.map(function (o) { return { label: o.label, action: function () { LAB.apps.openPath(path, { appId: o.appId, via: 'desktop' }); } }; }) }
    ];
    if (st.type === 'dir') items.push({ label: '在終端中開啟', icon: 'fl-prompt', action: function () { termAt(path); } });
    items.push({ separator: true });
    items.push({ label: '複製路徑', icon: 'fl-link', action: function () { LAB.clipboard.setText('"' + winPath(st.path) + '"'); } });
    items.push({ label: '內容', icon: 'fl-props', shortcut: 'Alt+Enter', action: toastNoFeature });
    LAB.menu.contextMenu(x, y, items);
  }
  function emptyMenu(x, y) {
    var canPaste = !!(LAB.clipboard && LAB.clipboard.paths && LAB.clipboard.paths.length);
    var at = { x: x, y: y };
    function sortItem(label, key) { return { label: label, radio: true, checked: DT.sortKey === key, action: function () { sortBy(key); } }; }
    function sizeItem(label, key) { return { label: label, radio: true, checked: DT.size === key, action: function () { setSize(key); } }; }
    var items = [
      { label: '檢視', icon: 'fl-view', submenu: [
        sizeItem('大圖示', 'large'), sizeItem('中圖示', 'medium'), sizeItem('小圖示', 'small'),
        { separator: true },
        { label: '自動排列圖示', checked: DT.autoArrange, action: function () { setAutoArrange(!DT.autoArrange); } },
        { label: '將圖示對齊格線', checked: DT.snap || DT.autoArrange, enabled: !DT.autoArrange, action: function () { setSnap(!DT.snap); } },
        { separator: true },
        { label: '顯示桌面圖示', checked: DT.show, action: function () { setShowIcons(!DT.show); } }] },
      { label: '排序方式', icon: 'fl-sort', submenu: [sortItem('名稱', 'name'), sortItem('大小', 'size'), sortItem('項目類型', 'type'), sortItem('修改日期', 'date')] },
      { label: '重新整理', icon: 'fl-refresh', action: renderIcons },
      { separator: true }
    ];
    if (canPaste) { items.push({ label: '貼上', icon: 'fl-paste', shortcut: 'Ctrl+V', action: clipPaste }); items.push({ separator: true }); }
    items.push({ label: '新增', icon: 'fl-new', submenu: [
      { label: '資料夾', icon: 'fl-folder-new', action: function () { newItemOnDesktop('folder', at); } },
      { label: '文字文件', icon: 'fl-doc-new', action: function () { newItemOnDesktop('text', at); } }] });
    items.push({ separator: true });
    items.push({ label: '顯示設定', icon: 'fl-display', action: function () { LAB.apps.launch('settings', { page: 'system/display' }); } });
    items.push({ label: '個人化', icon: 'fl-personalize', action: function () { LAB.apps.launch('settings', { page: 'personalization' }); } });
    items.push({ separator: true });
    items.push({ label: '在終端中開啟', icon: 'fl-prompt', action: function () { termAt(DESKTOP); } });
    items.push({ label: '顯示其他選項', icon: 'fl-more-opts', shortcut: 'Shift+F10', action: toastNoFeature });
    LAB.menu.contextMenu(x, y, items);
  }

  /* ---- 檢視 and 排序方式 of the desktop menu: every item really changes the desktop ---- */
  function viewChanged(what) {
    LAB.bus.emit('desktop:view', { what: what, size: DT.size, autoArrange: DT.autoArrange, snap: DT.snap, show: DT.show, sortKey: DT.sortKey, sortDesc: DT.sortDesc });
  }
  /* 排序方式: the icons are laid out again from the top-left in the chosen order; choosing the same item again turns the order round */
  function sortBy(key) {
    if (['name', 'size', 'type', 'date'].indexOf(key) < 0) return;
    if (DT.sortKey === key) DT.sortDesc = !DT.sortDesc;
    else { DT.sortKey = key; DT.sortDesc = (key === 'size' || key === 'date'); }
    DT.order = null;
    iconPos.clear();
    renderIcons();
    viewChanged('sort');
  }
  /* 大圖示 / 中圖示 / 小圖示: each icon keeps its cell (on the grid) or its proportional spot (free), the cells get bigger or smaller */
  function setSize(sz) {
    if (!SIZES[sz] || sz === DT.size) return;
    var old = metr();
    DT.size = sz;
    var nw = metr();
    if (desktopEl) desktopEl.setAttribute('data-size', sz);
    iconPos.forEach(function (pos, p) {
      setPos(p, { x: ICON_X0 + (pos.x - ICON_X0) * nw.w / old.w, y: ICON_Y0 + (pos.y - ICON_Y0) * nw.h / old.h });
    });
    var all = currentOrder();
    if (DT.autoArrange) flow(autoOrder(all));
    else {
      var items = all.filter(function (p) { return iconPos.has(p); }).map(function (p) { return { path: p, x: iconPos.get(p).x, y: iconPos.get(p).y }; });
      var out = DT.snap ? snapGroup(items, new Set()) : placeFree(items, new Set(all));
      out.forEach(function (xy, p) { setPos(p, xy); });
    }
    layoutStage(true);                      // windows keep clear of the icon column, whose width just changed
    viewChanged('size');
  }
  /* 將圖示對齊格線: turning it on puts every icon on a cell at once */
  function setSnap(on) {
    DT.snap = !!on;
    if (DT.snap && !DT.autoArrange) {
      var items = visualOrder().map(function (p) { var o = iconPos.get(p); return { path: p, x: o.x, y: o.y }; });
      snapGroup(items, new Set()).forEach(function (xy, p) { setPos(p, xy); });
    }
    viewChanged('snap');
  }
  /* 自動排列圖示: icons flow from the top-left in the sort order (or the order the student made by hand) and cannot be put anywhere else */
  function setAutoArrange(on) {
    on = !!on;
    if (on === DT.autoArrange) return;
    DT.autoArrange = on;
    if (on) {
      if (DT.sortKey) DT.order = null;
      else if (!DT.order) DT.order = visualOrder();
      flow(autoOrder(currentOrder()));
    }
    viewChanged('auto');
  }
  function setShowIcons(on) {
    DT.show = !!on;
    if (desktopEl) desktopEl.classList.toggle('is-icons-off', !DT.show);
    if (!DT.show) setSelected([]);
    viewChanged('show');
  }
  LAB.desktop = LAB.desktop || {};
  LAB.desktop.view = function () { return { size: DT.size, autoArrange: DT.autoArrange, snap: DT.snap, show: DT.show, sortKey: DT.sortKey, sortDesc: DT.sortDesc }; };
  LAB.desktop.setView = function (o) {
    o = o || {};
    if (o.size) setSize(o.size);
    if (typeof o.autoArrange === 'boolean') setAutoArrange(o.autoArrange);
    if (typeof o.snap === 'boolean') setSnap(o.snap);
    if (typeof o.show === 'boolean') setShowIcons(o.show);
  };
  LAB.desktop.sortBy = sortBy;
  /* path -> {x, y} (stage px, the top-left of the icon's cell) of every icon on the desktop; the Recycle Bin is '::trash' */
  LAB.desktop.positions = function () { var o = {}; iconPos.forEach(function (pos, p) { o[p] = { x: pos.x, y: pos.y }; }); return o; };

  /* ---- dragging icons ----
     dnd.js does the picking up and the drop targets (folders, the Recycle Bin, windows, taskbar buttons). This is the picture and the new places:
     the originals stay behind half see-through, copies of them (proxies, in #lab-dnd) follow the pointer, and dropped on empty desktop they glide
     into their cell. A drag that ends anywhere else (cancel, Esc, the taskbar) sends the copies back where they came from. */
  var press = null;       // {id, pt0, cur, group, anchor, starts, proxies, glide}
  function beginPress(e) {
    cleanupPress();
    var pt = LAB.stage.toStage(e.clientX, e.clientY);
    press = { id: e.pointerId, pt0: pt, cur: pt, group: null, anchor: null, starts: null, proxies: null, glide: null };
    window.addEventListener('pointermove', onPressMove, true);
    window.addEventListener('pointerup', onPressUp, true);
    window.addEventListener('pointercancel', onPressUp, true);
  }
  function onPressMove(ev) {
    if (!press || ev.pointerId !== press.id) return;
    press.cur = LAB.stage.toStage(ev.clientX, ev.clientY);
    if (press.proxies) moveProxies(press.cur);
  }
  function onPressUp(ev) {
    if (!press || ev.pointerId !== press.id) return;
    window.removeEventListener('pointermove', onPressMove, true);
    // this listener runs before dnd.js's own: a drag is still "active" here and ends through dnd:drop / dnd:cancel; a plain click ends here
    if (!LAB.dnd.active()) cleanupPress();
  }
  function cleanupPress() {
    if (!press) return;
    window.removeEventListener('pointermove', onPressMove, true);
    window.removeEventListener('pointerup', onPressUp, true);
    window.removeEventListener('pointercancel', onPressUp, true);
    if (press.proxies) retireProxies(press.proxies, 'gone');
    document.body.classList.remove('lab-dd-desk');
    icons.forEach(function (rec) { rec.el.classList.remove('is-dragsrc'); });
    press = null;
  }
  function onDndStart(d) {
    var pl = d && d.payload;
    if (!pl || !pl.desk || !press) return;
    var layer = document.getElementById('lab-dnd'), m = metr();
    if (!layer) return;
    press.group = pl.desk.group.slice();
    press.anchor = pl.desk.anchor;
    press.starts = {};
    press.proxies = [];
    press.group.forEach(function (p) {
      var rec = icons.get(p), pos = iconPos.get(p);
      if (!rec || !pos) return;
      press.starts[p] = { x: pos.x, y: pos.y };
      var el = rec.el.cloneNode(true);            // a picture of the icon: no hooks (data-lab would double the desktop-icon count), no ids
      ['data-lab', 'data-path', 'role', 'aria-label', 'aria-selected', 'tabindex', 'id'].forEach(function (a) { el.removeAttribute(a); });
      el.className = 'lab-dicon lab-dicon-proxy' + (selected.has(p) ? ' is-sel' : '');
      el.style.left = '0px'; el.style.top = '0px';
      el.style.setProperty('--di-w', m.w + 'px'); el.style.setProperty('--di-h', m.h + 'px'); el.style.setProperty('--di-icon', m.icon + 'px');
      layer.appendChild(el);
      press.proxies.push({ p: p, el: el });
      rec.el.classList.add('is-dragsrc');
    });
    document.body.classList.add('lab-dd-desk');
    moveProxies(press.cur);
  }
  function moveProxies(pt) {
    if (!press || !press.proxies) return;
    var dx = pt.x - press.pt0.x, dy = pt.y - press.pt0.y;
    press.proxies.forEach(function (o) { var s = press.starts[o.p]; if (s) o.el.style.transform = 'translate(' + (s.x + dx) + 'px,' + (s.y + dy) + 'px)'; });
  }
  /* mode 'gone' = remove now; 'back' = fly back to `dest` (path -> {x,y}) and fade; 'glide' = slide to `dest`, then show the real icons */
  function retireProxies(list, mode, dest) {
    function drop(o) { if (o.el.parentNode) o.el.parentNode.removeChild(o.el); var rec = icons.get(o.p); if (rec) rec.el.classList.remove('is-landing'); }
    if (mode === 'gone' || reduced() || !dest) { list.forEach(drop); return; }
    list.forEach(function (o) {
      var t = dest[o.p];
      if (!t) { drop(o); return; }
      o.el.classList.add(mode === 'back' ? 'is-back' : 'is-gliding');
      o.el.style.transform = 'translate(' + t.x + 'px,' + t.y + 'px)';
    });
    setTimeout(function () { list.forEach(drop); }, mode === 'back' ? 290 : 190);
  }
  function endDrag(cancelled) {
    if (!press) return;
    var list = press.proxies;
    press.proxies = null;
    if (list) {
      if (press.glide) retireProxies(list, 'glide', press.glide);
      else if (cancelled) retireProxies(list, 'back', press.starts);
      else retireProxies(list, 'gone');
    }
    cleanupPress();
  }
  /* released on empty desktop: the icons take their new places */
  function moveGroup(pl, ctx) {
    var d = press;
    if (!d || !d.starts) return;
    var m = metr();
    var group = d.group.filter(function (p) { return icons.has(p) && d.starts[p]; });
    if (!group.length) return;
    var dx = ctx.x - d.pt0.x, dy = ctx.y - d.pt0.y;
    // the icons move as one block and stop when the first of them reaches the edge of the work area (never off the screen, never under the taskbar)
    var minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
    group.forEach(function (p) { var s = d.starts[p]; minX = Math.min(minX, s.x); minY = Math.min(minY, s.y); maxX = Math.max(maxX, s.x); maxY = Math.max(maxY, s.y); });
    dx = Math.max(-minX, Math.min(dx, stage.w - m.w - maxX));
    dy = Math.max(-minY, Math.min(dy, workH() - m.h - maxY));
    var gset = new Set(group);
    if (DT.autoArrange) {
      // auto-arrange: the icons cannot sit anywhere, they go in between the others at the place they were let go
      var a = d.starts[d.anchor] || d.starts[group[0]];
      var cell = xyToCell(a.x + dx, a.y + dy);
      var all = autoOrder(currentOrder());
      var rest = all.filter(function (p) { return !gset.has(p); }), mine = all.filter(function (p) { return gset.has(p); });
      var idx = Math.min(cell.c * cellRows() + cell.r, rest.length);
      DT.order = rest.slice(0, idx).concat(mine, rest.slice(idx));
      DT.sortKey = null;
      flow(DT.order);
    } else {
      var items = group.map(function (p) { return { path: p, x: d.starts[p].x + dx, y: d.starts[p].y + dy }; });
      var out = DT.snap ? snapGroup(items, takenCells(gset)) : placeFree(items, gset);
      out.forEach(function (xy, p) { setPos(p, xy); });
    }
    var dest = {}, positions = [], moved = false;
    group.forEach(function (p) {
      var pos = iconPos.get(p), s = d.starts[p];
      dest[p] = { x: pos.x, y: pos.y };
      positions.push({ path: p, x: pos.x, y: pos.y });
      if (pos.x !== s.x || pos.y !== s.y) moved = true;
      var rec = icons.get(p);
      if (rec) { rec.el.classList.remove('is-dragsrc'); rec.el.classList.add('is-landing'); }
    });
    d.glide = dest;
    if (moved || DT.autoArrange) LAB.bus.emit('desktop:move', { paths: group.slice(), positions: positions });
  }
  function deskPaths() { return sortedDesktop().map(function (s) { return s.path; }); }
  /* files that came from another window land where they were let go (Windows keeps an icon where you dropped it) */
  function placeDropped(before, x, y) {
    var added = deskPaths().filter(function (p) { return !before.has(p); });
    if (!added.length || DT.autoArrange) return;
    var m = metr();
    added.forEach(function (p) { pendingAt.set(p, { x: x - m.w / 2, y: y - m.icon / 2 - 4, wins: 'center' }); iconPos.delete(p); });
    renderIcons();
  }

  function setupDesktop() {
    // fs changes
    LAB.bus.on('fs:change', function () { scheduleRender(); });
    LAB.bus.on('dnd:start', onDndStart);
    LAB.bus.on('dnd:drop', function () { endDrag(false); });
    LAB.bus.on('dnd:cancel', function () { endDrag(true); });
    LAB.bus.on('dnd:drop', flushAfterDrag);
    LAB.bus.on('dnd:cancel', flushAfterDrag);
    LAB.bus.on('stage:resize', function () { reflowIcons(); });
    desktopEl.setAttribute('data-size', DT.size);
    ['win:focus', 'win:close', 'win:minimize', 'win:restore', 'app:frontmost', 'desktop:focus'].forEach(function (n) { LAB.bus.on(n, updateKey); });
    updateKey();

    // empty desktop: pointerdown deselects, nothing is focused, rubber band
    desktopEl.addEventListener('pointerdown', function (e) {
      if (e.target !== desktopEl || e.button !== 0) return;
      LAB.wm.focusDesktop();
      focusPath = null;
      if (!(e.metaKey || e.ctrlKey || e.shiftKey)) setSelected([]);
      closeAllPopups();
      if (layout.isDrawerOpen()) layout.closeDrawer();
      startRubber(e);
    });
    desktopEl.addEventListener('contextmenu', function (e) {
      var p = LAB.stage.toStage(e.clientX, e.clientY);
      var iconEl = e.target.closest ? e.target.closest('.lab-dicon') : null;
      if (iconEl) {
        var path = iconEl.dataset.path;
        if (!selected.has(path)) { LAB.wm.focusDesktop(); setSelected([path]); }
        itemMenu(path, p.x, p.y);
      } else { LAB.wm.focusDesktop(); setSelected([]); emptyMenu(p.x, p.y); }
    });

    // the desktop is a drop target: icons of the desktop dropped on empty space move to that spot; files from an Explorer window are moved
    // into ~\Desktop (Alt = copy) and appear where they were let go
    LAB.dnd.target(desktopEl, {
      id: 'desktop',
      accept: function (pl, mods) {
        if (pl.desk) return mods.mode === 'copy' ? false : 'move';          // moving icons about: Alt does not make it a copy
        if (pl.kind !== 'fs') return false;
        if (pl.from === 'desktop') return false;
        for (var i = 0; i < pl.paths.length; i++) { if (LAB.vfs.same(LAB.vfs.dirname(pl.paths[i]), DESKTOP) && !(mods.altKey || mods.mode === 'copy')) return false; }
        return mods.altKey || mods.mode === 'copy' ? 'copy' : 'move';
      },
      drop: function (pl, ctx) {
        if (pl.desk) { moveGroup(pl, ctx); return; }
        var before = new Set(deskPaths());
        var done = transfer(pl.paths, DESKTOP, ctx.mode === 'copy' ? 'copy' : 'move', 'desktop');
        if (done && done.then) done.then(function () { placeDropped(before, ctx.x, ctx.y); });
      }
    });

    // keyboard (F2, Enter, Delete, Ctrl+A) while no window has the focus (frontmost app = finder = the desktop)
    function desktopIdle() { return !LAB.wm.focused() && !renaming && !LAB.keys.hasModal(); }
    LAB.keys.on('f2', function () {
      if (!desktopIdle() || selected.size !== 1) return false;
      var only = Array.from(selected)[0];
      if (only === TRASH_KEY) return false;
      startRename(only);
    }, { scope: 'finder' });
    LAB.keys.on('enter', function () {
      if (!desktopIdle() || !selected.size) return false;
      Array.from(selected).forEach(function (p) { if (p === TRASH_KEY) LAB.apps.openFolder(TRASH, 'desktop'); else openItem(p, 'desktop'); });
    }, { scope: 'finder' });
    LAB.keys.on('delete', function () {
      if (!desktopIdle() || !selected.size) return false;
      trashSelection(Array.from(selected));
    }, { scope: 'finder' });
    LAB.keys.on('mod+a', function () {
      if (!desktopIdle() || !DT.show) return false;
      setSelected(Array.from(icons.keys()));
    }, { scope: 'finder' });
    LAB.keys.on('mod+c', function () {
      if (!desktopIdle() || !selected.size) return false;
      LAB.clipboard.setPaths(Array.from(selected).filter(function (p) { return p !== TRASH_KEY; }), 'copy');
    }, { scope: 'finder' });
    LAB.keys.on('mod+x', function () {
      if (!desktopIdle() || !selected.size) return false;
      LAB.clipboard.setPaths(Array.from(selected).filter(function (p) { return p !== TRASH_KEY; }), 'cut');
    }, { scope: 'finder' });
    LAB.keys.on('mod+v', function () {
      if (!desktopIdle() || !(LAB.clipboard.paths && LAB.clipboard.paths.length)) return false;
      clipPaste();
    }, { scope: 'finder' });

    /* arrow keys, Home / End and typing the first letters of a name move the selection like Windows; the Menu key and Shift+F10 open the menu of
       the selected icon (or the desktop menu). Only while no window has the focus. */
    var taBuf = '', taAt = 0;
    function navTarget(key) {
      var vis = visualOrder();
      if (!vis.length) return null;
      var cur = focusPath && icons.has(focusPath) ? focusPath : (selected.size ? Array.from(selected).pop() : null);
      if (!cur || !iconPos.has(cur)) return key === 'End' ? vis[vis.length - 1] : vis[0];
      if (key === 'Home') return vis[0];
      if (key === 'End') return vis[vis.length - 1];
      var cp = iconPos.get(cur), best = null, bs = 1e12, vertical = key === 'ArrowDown' || key === 'ArrowUp';
      vis.forEach(function (p) {
        if (p === cur) return;
        var o = iconPos.get(p), dx = o.x - cp.x, dy = o.y - cp.y;
        var main = key === 'ArrowDown' ? dy : key === 'ArrowUp' ? -dy : key === 'ArrowRight' ? dx : -dx;
        var side = vertical ? Math.abs(dx) : Math.abs(dy);
        if (main < 8) return;
        var score = main + side * 2.5;
        if (score < bs) { bs = score; best = p; }
      });
      if (!best && vertical) {                       // the end of a column: carry on with the next (or the previous) column
        var i = vis.indexOf(cur);
        best = vis[key === 'ArrowDown' ? i + 1 : i - 1] || null;
      }
      return best;
    }
    window.addEventListener('keydown', function (e) {
      if (!desktopIdle() || !DT.show || e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
      var t = e.target;
      if (t && t.closest && t.closest('input, textarea, select, button, a, #lab-rail')) return;      // keys that belong to a control (the mission card scrolls with the arrows) are not the desktop's
      var k = e.key, p;
      if (k.indexOf('Arrow') === 0 || k === 'Home' || k === 'End') {
        p = navTarget(k);
        e.preventDefault();
        if (!p) return;
        focusPath = p;
        if (e.shiftKey) { var s = new Set(selected); s.add(p); setSelected(Array.from(s)); } else setSelected([p]);
      } else if (k === 'ContextMenu' || (k === 'F10' && e.shiftKey)) {
        e.preventDefault();
        var last = focusPath && selected.has(focusPath) ? focusPath : Array.from(selected).pop();
        var rec = last && icons.get(last);
        if (rec) { var r = LAB.stage.rectOf(rec.el); itemMenu(last, r.x + r.w * 0.55, r.y + r.h * 0.6); }
        else emptyMenu(stage.w * 0.4, stage.h * 0.4);
      } else if (k.length === 1 && k !== ' ') {
        var now = Date.now();
        if (now - taAt > 900) taBuf = '';
        taAt = now;
        taBuf += k.toLowerCase();
        var hit = null;
        visualOrder().some(function (q) { var rc = icons.get(q); if (rc && rc.st.name.toLowerCase().indexOf(taBuf) === 0) { hit = q; return true; } return false; });
        if (!hit && taBuf.length > 1 && taBuf.split('').every(function (ch) { return ch === taBuf.charAt(0); })) {      // the same letter again: the next name with that letter
          var ch0 = taBuf.charAt(0), order = visualOrder(), from = order.indexOf(focusPath || Array.from(selected).pop());
          for (var j = 1; j <= order.length; j++) { var q2 = order[(Math.max(from, 0) + j) % order.length], r2 = icons.get(q2); if (r2 && r2.st.name.toLowerCase().charAt(0) === ch0) { hit = q2; break; } }
        }
        if (hit) { focusPath = hit; setSelected([hit]); }
      }
    });

    renderIcons();
  }

  function startRubber(e0) {
    var start = LAB.stage.toStage(e0.clientX, e0.clientY);
    var pid = e0.pointerId;
    var band = null;
    var base = (e0.metaKey || e0.ctrlKey || e0.shiftKey) ? new Set(selected) : new Set();
    function move(ev) {
      if (ev.pointerId !== pid) return;
      var q = LAB.stage.toStage(ev.clientX, ev.clientY);
      var p = { x: Math.max(0, Math.min(stage.w, q.x)), y: Math.max(0, Math.min(stage.h, q.y)) };       // the box stays on the screen
      if (!band) {
        if (Math.abs(p.x - start.x) < 4 && Math.abs(p.y - start.y) < 4) return;
        band = h('div', { class: 'lab-rubber' });
        desktopEl.appendChild(band);
      }
      var x = Math.min(start.x, p.x), y = Math.min(start.y, p.y), w = Math.abs(p.x - start.x), hh = Math.abs(p.y - start.y);
      band.style.left = x + 'px'; band.style.top = y + 'px'; band.style.width = w + 'px'; band.style.height = hh + 'px';
      var hit = new Set(base), m = metr();
      if (DT.show) iconPos.forEach(function (pos, path) {
        if (!icons.has(path)) return;
        if (pos.x + 4 < x + w && pos.x + m.w - 4 > x && pos.y < y + hh && pos.y + m.h > y) hit.add(path);
      });
      setSelected(Array.from(hit));
    }
    function up(ev) {
      if (ev.pointerId !== pid) return;
      window.removeEventListener('pointermove', move, true);
      window.removeEventListener('pointerup', up, true);
      window.removeEventListener('pointercancel', up, true);
      if (band && band.parentNode) band.parentNode.removeChild(band);
    }
    window.addEventListener('pointermove', move, true);
    window.addEventListener('pointerup', up, true);
    window.addEventListener('pointercancel', up, true);
  }

  /* ================================================================ taskbar (W3) */
  var PINNED = ['finder', 'terminal', 'codex', 'code', 'textedit'];
  var appItems = new Map();          // appId -> {slot, btn, tip, prev, iconBox, off[]}
  var startBtn, searchBtn, tvBtn, appsWrap, tbBar;

  function tipNode(text) { return h('span', { class: 'lab-tb-tip', 'aria-hidden': 'true' }, text); }
  function glyphBtn(cls, label, hook, iconName, size) {
    var b = h('button', { type: 'button', class: cls, 'aria-label': label, 'data-tip': label, dataset: { lab: hook } });
    b.appendChild(iconBox(iconName, size || 30, 'lab-tb-ico'));
    return b;
  }

  function appSlot(id) {
    var def = LAB.apps.get(id);
    var name = appTitle(id);
    var icon = h('span', { class: 'lab-dock-icon' });
    icon.innerHTML = LAB.icons.get((def && def.icon) || ('app-' + id), { size: 30 });          // static icon markup only
    var btn = h('button', {
      type: 'button', class: 'lab-dock-item lab-tb-btn', role: 'button', 'aria-label': name,
      dataset: { lab: 'dock-item', app: id }
    }, icon, h('span', { class: 'lab-dock-dot' }));
    var tip = tipNode(name);
    var prev = h('div', { class: 'lab-tb-prev', role: 'group', 'aria-label': name + '的視窗' });
    var slot = h('div', { class: 'lab-tb-slot' }, btn, tip, prev);
    return { slot: slot, btn: btn, tip: tip, prev: prev, iconBox: icon, off: [] };
  }

  /* the taskbar also shows the apps that are open but not pinned (Settings, Calculator, Edge ...), in the order they were opened, until their last window closes */
  var extraOrder = [];
  function buildAppItems() {
    var ids = [];
    var known = LAB.apps.all().map(function (d) { return d.id; });
    PINNED.forEach(function (id) { if (known.indexOf(id) >= 0) ids.push(id); });
    extraOrder = extraOrder.filter(function (id) { return known.indexOf(id) >= 0 && LAB.wm.byApp(id).length > 0; });
    LAB.wm.all().forEach(function (w) {
      var a = w.appId;
      if (PINNED.indexOf(a) < 0 && !EXCLUDE_TB[a] && known.indexOf(a) >= 0 && extraOrder.indexOf(a) < 0) extraOrder.push(a);
    });
    extraOrder.forEach(function (id) { ids.push(id); });
    appItems.forEach(function (rec, id) {
      if (ids.indexOf(id) < 0) { rec.off.forEach(function (f) { f(); }); if (rec.slot.parentNode) rec.slot.parentNode.removeChild(rec.slot); appItems.delete(id); }
    });
    ids.forEach(function (id) {
      var def = LAB.apps.get(id);
      var rec = appItems.get(id);
      if (rec) {
        rec.iconBox.innerHTML = LAB.icons.get(def.icon || ('app-' + id), { size: 30 });
        rec.btn.setAttribute('aria-label', appTitle(id));
        rec.tip.textContent = appTitle(id);
      } else {
        rec = appSlot(id);
        appItems.set(id, rec);
        wireAppItem(id, rec);
      }
      appsWrap.appendChild(rec.slot);     // keeps/sets the order
    });
    refreshIndicators();
    fitTaskbar();
  }

  /* Windows keeps the centred group clear of the tray: when the buttons need the room, the group slides left, and the search box folds into an icon first */
  function fitTaskbar() {
    if (!tbBar || !searchBtn) return;
    var center = tbBar.querySelector('.lab-tb-center'), tray = tbBar.querySelector('.lab-tb-tray');
    if (!center || !tray) return;
    center.style.left = ''; center.style.transform = '';
    searchBtn.classList.remove('is-compact');
    var W = tbBar.clientWidth;
    if (!W) return;
    function limits() { var cw = center.offsetWidth; return { ideal: (W - cw) / 2, max: W - tray.offsetWidth - cw - 8 }; }
    var m = limits();
    if (m.ideal > m.max) { searchBtn.classList.add('is-compact'); m = limits(); }
    if (m.ideal > m.max) { center.style.left = Math.max(4, m.max) + 'px'; center.style.transform = 'none'; }
  }

  function refreshIndicators() {
    var focused = LAB.wm.focused();
    appItems.forEach(function (rec, id) {
      var ws = LAB.wm.byApp(id);
      rec.btn.classList.toggle('is-running', ws.length > 0);
      rec.btn.classList.toggle('is-focused', !!focused && focused.appId === id && !focused.isMinimized());
    });
  }

  /* small cards for an app with several windows (hover) */
  function refreshPreview(id) {
    var rec = appItems.get(id);
    if (!rec) return;
    var ws = LAB.wm.byApp(id);
    rec.prev.textContent = '';
    if (ws.length < 2) { rec.slot.classList.remove('has-prev'); return; }
    var focused = LAB.wm.focused();
    ws.slice().reverse().forEach(function (w) {
      var close = h('button', { type: 'button', class: 'lab-tb-pclose', 'aria-label': '關閉視窗' });
      close.innerHTML = '<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M.5.5l9 9M9.5.5l-9 9" fill="none" stroke="currentColor"/></svg>';
      close.addEventListener('click', function (e) { e.stopPropagation(); w.close(); setTimeout(function () { refreshPreview(id); }, 30); });
      var head = h('div', { class: 'lab-tb-phead' }, iconBox(w.icon || appIconName(id), 16, 'lab-ico-box'), h('span', { class: 'lab-tb-ptitle' }, w.getTitle() || appTitle(id)), close);
      var card = h('div', { class: 'lab-tb-pcard' + (focused === w ? ' is-front' : ''), role: 'button', tabindex: '0', 'aria-label': w.getTitle() || appTitle(id), dataset: { lab: 'dock-win', win: w.id } },
        head, h('div', { class: 'lab-tb-pbody' + (w.theme === 'dark' ? ' is-dark' : '') }));
      function activate(e) {
        if (e) e.stopPropagation();
        if (w.isMinimized()) w.restore(); else w.focus();
        rec.slot.classList.remove('has-prev');
        setTimeout(function () { rec.slot.classList.add('has-prev'); }, 600);
      }
      card.addEventListener('click', activate);
      card.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); } });
      rec.prev.appendChild(card);
    });
    rec.slot.classList.add('has-prev');
  }

  /* what a click on a pinned app does (Windows): launch; a minimized window comes back; the focused one minimizes; several windows: bring the last one up, or cycle */
  function onAppClick(id) {
    var wm = LAB.wm;
    var ws = wm.byApp(id);
    if (!ws.length) { LAB.apps.launch(id); return; }
    if (wm.isHidden(id)) { wm.showApp(id); return; }
    var focused = wm.focused();
    if (ws.length === 1) {
      var w = ws[0];
      if (w.isMinimized()) w.restore();
      else if (focused === w) w.minimize();
      else w.focus();
      return;
    }
    var vis = ws.filter(function (x) { return !x.isMinimized(); });
    if (focused && focused.appId === id && !focused.isMinimized() && vis.length > 1) { wm.cycle(id); return; }
    var last = wm.lastFocused(id) || ws[ws.length - 1];
    if (last.isMinimized()) last.restore(); else last.focus();
  }

  function wireAppItem(id, rec) {
    rec.btn.addEventListener('click', function () { onAppClick(id); setTimeout(function () { refreshPreview(id); }, 30); });
    rec.btn.addEventListener('mouseenter', function () { refreshPreview(id); });
    rec.btn.addEventListener('focus', function () { refreshPreview(id); });
    rec.btn.addEventListener('contextmenu', function (e) {
      e.preventDefault(); e.stopPropagation();
      var def = LAB.apps.get(id);
      var p = LAB.stage.toStage(e.clientX, e.clientY);
      var ws = LAB.wm.byApp(id);
      var items = [
        { label: appTitle(id), icon: def && def.icon, action: function () { if (def && def.newWindow && ws.length) def.newWindow(); else if (ws.length && (id === 'finder' || id === 'terminal') && def.open) def.open({}); else LAB.apps.launch(id); } }
      ];
      if (ws.length > 1) { items.push({ separator: true }); ws.slice().reverse().forEach(function (w) { items.push({ label: w.getTitle() || '（未命名）', action: function () { if (w.isMinimized()) w.restore(); else w.focus(); } }); }); }
      items.push({ separator: true });
      items.push(PINNED.indexOf(id) >= 0
        ? { label: '從工作列取消釘選', icon: 'fl-pin', action: function () { LAB.ui.toast('練習版的工作列不能取消釘選'); } }
        : { label: '釘選到工作列', icon: 'fl-pin', action: function () { LAB.ui.toast('練習版的工作列不能新增釘選'); } });
      if (ws.length) items.push({ label: ws.length > 1 ? '關閉所有視窗' : '關閉視窗', icon: 'x', action: function () { ws.slice().forEach(function (w) { w.close(); }); } });
      LAB.menu.contextMenu(p.x, p.y - 8, items, { dark: 'win' });
    });
    // a file or folder dropped on an app button (Windows: drop on a taskbar button to open it there)
    rec.off.push(LAB.dnd.target(rec.btn, {
      id: 'dock:app:' + id,
      accept: function (pl) {
        var def = LAB.apps.get(id);
        if (!def || typeof def.canHandle !== 'function' || pl.kind !== 'fs') return false;
        for (var i = 0; i < pl.paths.length; i++) { if (!def.canHandle(pl.paths[i])) return false; }
        return 'link';
      },
      enter: function () { rec.btn.classList.add('is-drop'); },
      leave: function () { rec.btn.classList.remove('is-drop'); },
      drop: function (pl) {
        rec.btn.classList.remove('is-drop');
        var def = LAB.apps.get(id);
        if (def && def.handleOpen) def.handleOpen(pl.paths[0], { via: 'dock' });
      }
    }));
  }

  function setupTaskbar() {
    dockEl.textContent = '';
    dockEl.setAttribute('data-lab', 'dock');
    dockEl.setAttribute('role', 'toolbar');
    dockEl.setAttribute('aria-label', '工作列');

    // ---- centred group: Start, search box, Task View, pinned apps
    startBtn = glyphBtn('lab-tb-btn lab-tb-start', '開始', 'start-button', 'start', 30);
    startBtn.setAttribute('aria-haspopup', 'dialog'); startBtn.setAttribute('aria-expanded', 'false');
    startBtn.addEventListener('click', function (e) { e.stopPropagation(); toggleStart(); });
    startBtn.addEventListener('contextmenu', function (e) {
      // right-click Start = the Win+X menu (sysapps.js); it opens just above the taskbar, at the pointer
      e.preventDefault(); e.stopPropagation();
      closeAllPopups();
      var p = LAB.stage.toStage(e.clientX, e.clientY);
      if (LAB.sys && LAB.sys.winX) LAB.sys.winX(Math.max(4, p.x - 8), stage.dockTop());
      else LAB.menu.contextMenu(p.x, p.y - 8, [
        { label: '終端機', icon: 'app-terminal', action: function () { LAB.apps.launch('terminal'); } },
        { label: '檔案總管', icon: 'app-finder', action: function () { LAB.apps.launch('finder'); } },
        { label: '搜尋', icon: 'search', action: function () { openSpotlight(); } },
        { separator: true },
        { label: '關機或登出', icon: 'power', action: function () { LAB.desktop.disconnect(); } }
      ], { dark: 'win' });
    });

    searchBtn = h('button', { type: 'button', class: 'lab-tb-search', 'aria-label': '搜尋', 'aria-haspopup': 'dialog', 'aria-expanded': 'false', dataset: { lab: 'spotlight-button' } },
      iconBox('search-tb', 20, 'lab-tb-sglass'), h('span', { class: 'lab-tb-stext' }, '搜尋'), iconBox('search-art', 22, 'lab-tb-sart'));
    searchBtn.addEventListener('click', function (e) { e.stopPropagation(); toggleSpotlight(); });

    tvBtn = glyphBtn('lab-tb-btn', '工作檢視', 'taskview-button', 'task-view', 30);
    tvBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      var tvApi = LAB.sys && LAB.sys.taskView, wasOpen = !!(tvApi && tvApi.isOpen());
      closeAllPopups();
      if (tvApi) { if (!wasOpen) tvApi.open(); } else LAB.ui.toast('練習版沒有工作檢視');
    });

    appsWrap = h('div', { class: 'lab-tb-apps', dataset: { sec: 'apps' } });
    var center = h('div', { class: 'lab-tb-center' }, startBtn, searchBtn, tvBtn, appsWrap);

    // ---- tray: ^, IME, network + speaker, clock, show-desktop sliver
    var chev = glyphBtn('lab-tray-btn', '顯示隱藏的圖示', 'tray-chevron', 'tray-chevron', 20);
    chev.setAttribute('aria-haspopup', 'dialog'); chev.setAttribute('aria-expanded', 'false');
    chev.addEventListener('click', function (e) {
      e.stopPropagation();
      openFlyout(chev, h('div', { class: 'lab-fly-note' }, '沒有隱藏的圖示'), 180);
    });

    imeBtn = h('button', { type: 'button', class: 'lab-tray-btn lab-tray-ime', 'aria-label': '輸入法：中文', 'data-tip': '中文（繁體，台灣）　按 Shift 切換', dataset: { lab: 'ime' } }, '中');
    imeBtn.addEventListener('click', function (e) { e.stopPropagation(); ime.toggle(); });

    wifiBtn = h('span', { class: 'lab-tray-g', 'aria-label': 'Wi-Fi', dataset: { lab: 'wifi' } });
    wifiBtn.innerHTML = LAB.icons.get('wifi', { size: 20 });
    var spk = h('span', { class: 'lab-tray-g', 'aria-label': '音量', dataset: { lab: 'volume' } });
    spk.innerHTML = LAB.icons.get('speaker', { size: 20 });
    var sys = h('button', { type: 'button', class: 'lab-tray-btn lab-tray-sys', 'aria-label': '網路、音量', 'data-tip': 'Wi-Fi：已連線　音量：40%', 'aria-haspopup': 'dialog', 'aria-expanded': 'false', dataset: { lab: 'tray-system' } }, wifiBtn, spk);
    sys.addEventListener('click', function (e) { e.stopPropagation(); openFlyout(sys, function () { return sysNode('quickSettings', '快速設定還沒有載入'); }, 372); });

    clockT1 = h('span', null); clockT2 = h('span', null);
    clockBtn = h('button', { type: 'button', class: 'lab-tray-btn lab-tray-clock', 'aria-haspopup': 'dialog', 'aria-expanded': 'false', dataset: { lab: 'clock' } }, clockT1, clockT2);
    clockBtn.addEventListener('click', function (e) { e.stopPropagation(); openFlyout(clockBtn, function () { return sysNode('notificationCenter', '沒有新通知'); }, 360); });
    updateClock();
    setInterval(updateClock, 10000);

    var show = h('button', { type: 'button', class: 'lab-tb-show', 'aria-label': '顯示桌面', dataset: { lab: 'show-desktop' } });
    show.addEventListener('click', function (e) { e.stopPropagation(); closeAllPopups(); showDesktop(); });

    var tray = h('div', { class: 'lab-tb-tray' }, chev, imeBtn, sys, clockBtn, show);
    tbBar = h('div', { class: 'lab-tb' }, center, tray);
    tbBar.addEventListener('contextmenu', function (e) {
      if (e.target.closest && e.target.closest('button, .lab-tb-search')) return;
      e.preventDefault();
      var p = LAB.stage.toStage(e.clientX, e.clientY);
      LAB.menu.contextMenu(p.x, p.y - 8, [
        { label: '工作管理員', icon: 'app-taskmgr', action: function () { LAB.apps.launch('taskmgr'); } },
        { separator: true },
        { label: '工作列設定', icon: 'gear', action: function () { LAB.apps.launch('settings', { page: 'personalization' }); } }
      ], { dark: 'win' });
    });
    dockEl.appendChild(tbBar);
    buildAppItems();

    LAB.bus.on('apps:changed', buildAppItems);
    // an app that is not pinned gets a button while it has a window (and loses it with the last one)
    ['win:open', 'win:close'].forEach(function (n) { LAB.bus.on(n, function (d) { if (d && d.appId && PINNED.indexOf(d.appId) < 0) buildAppItems(); }); });
    LAB.bus.on('stage:resize', fitTaskbar);
    LAB.bus.on('sys:change', updateTrayState);
    ['win:open', 'win:close', 'win:focus', 'win:minimize', 'win:restore', 'app:frontmost', 'app:launch', 'app:quit', 'desktop:focus'].forEach(function (n) { LAB.bus.on(n, refreshIndicators); });
    ['win:open', 'win:close', 'win:title', 'win:minimize', 'win:restore', 'win:focus'].forEach(function (n) {
      LAB.bus.on(n, function (d) { if (d && d.appId) refreshPreview(d.appId); });      // the hover cards follow the windows
    });
    if (LAB.bus) LAB.bus.once('connect:done', function () { wifiJoin(2600); scheduleWifi(); });
    setupImeKey();
    updateTrayState();
    fitTaskbar();
  }

  /* ================================================ Start menu (W3) */
  var start = null;     // {el, input, off}
  var RECENT = [
    { path: HOME + '/Downloads/week3.zip', sub: '最近新增' },
    { path: HOME + '/Desktop/Project/notes.docx', sub: '昨天' }
  ];
  var START_PINNED = ['finder', 'terminal', 'codex', 'code', 'textedit', 'edge', 'settings', 'photos', 'calculator'];
  /* 所有應用程式: grouped by the first Latin letter, then by the first 注音 symbol of a Chinese name (the Taiwan order; the symbols below are my reading of
     each name, which the real Start menu takes from its own dictionary) */
  var ZHU_ORDER = 'ㄅㄆㄇㄈㄉㄊㄋㄌㄍㄎㄏㄐㄑㄒㄓㄔㄕㄖㄗㄘㄙㄧㄨㄩㄚㄛㄜㄝㄞㄟㄠㄡㄢㄣㄤㄥㄦ';
  var ZHU_OF = { '小算盤': 'ㄒ', '工作管理員': 'ㄍ', '檔案總管': 'ㄉ', '記事本': 'ㄐ', '設定': 'ㄕ', '相片': 'ㄒ', '終端機': 'ㄓ', '命令提示字元': 'ㄇ' };
  function allAppsGroups() {
    var list = [];
    ['finder', 'terminal', 'codex', 'code', 'textedit', 'edge', 'settings', 'photos', 'calculator', 'taskmgr'].forEach(function (id) {
      if (LAB.apps.get(id)) list.push({ id: id, name: appTitle(id), icon: appIconName(id), run: function () { LAB.apps.launch(id); } });
    });
    list.push({ id: 'powershell', name: 'Windows PowerShell', icon: 'app-powershell', run: function () { LAB.apps.launch('terminal'); } });
    list.push({ id: 'cmd', name: '命令提示字元', icon: 'app-terminal', run: function () { LAB.apps.launch('terminal'); } });
    var groups = {};
    list.forEach(function (it) {
      var c = it.name.charAt(0), key;
      if (/[a-z]/i.test(c)) key = c.toUpperCase(); else if (/\d/.test(c)) key = '#'; else key = ZHU_OF[it.name] || '其他';
      (groups[key] = groups[key] || { key: key, items: [] }).items.push(it);
    });
    function rank(k) { if (k === '#') return -1; if (/^[A-Z]$/.test(k)) return k.charCodeAt(0); var i = ZHU_ORDER.indexOf(k); return 1000 + (i < 0 ? 99 : i); }
    return Object.keys(groups).map(function (k) { return groups[k]; }).sort(function (a, b) { return rank(a.key) - rank(b.key); }).map(function (g) {
      g.items.sort(function (a, b) { return a.name.localeCompare(b.name, 'zh-Hant'); });
      return g;
    });
  }
  LAB.desktop = LAB.desktop || {};
  LAB.desktop.allApps = allAppsGroups;

  function closeStart() {
    if (!start) return;
    var s = start; start = null;
    if (s.el.parentNode) s.el.parentNode.removeChild(s.el);
    if (s.off) s.off();
    if (startBtn) { startBtn.setAttribute('aria-expanded', 'false'); startBtn.classList.remove('is-open'); }
    window.removeEventListener('pointerdown', onStartDown, true);
    LAB.bus.emit('shell:start', { open: false });
  }
  function onStartDown(e) {
    if (start && !start.el.contains(e.target) && !(startBtn && startBtn.contains(e.target))) closeStart();
  }
  function openStart() {
    if (start) { start.input.focus(); return; }
    closeAllPopups();
    if (startBtn) { startBtn.setAttribute('aria-expanded', 'true'); startBtn.classList.add('is-open'); }
    var input = h('input', {
      type: 'text', class: 'lab-sf-input', 'aria-label': '搜尋應用程式、設定與文件', placeholder: '搜尋應用程式、設定與文件',
      autocomplete: 'off', spellcheck: 'false', dataset: { lab: 'start-search' }
    });
    var field = h('div', { class: 'lab-start-field' }, iconBox('search-tb', 18, 'lab-sf-glass'), input);

    function appBtn(opts) {
      var b = h('button', { type: 'button', class: 'lab-start-app', dataset: Object.assign({ lab: 'start-item' }, opts.data) },
        iconBox(opts.icon, 36), h('span', { class: 'lab-sa-name' }, opts.name));
      b.addEventListener('click', function () { closeStart(); opts.run(); });
      return b;
    }
    var grid = h('div', { class: 'lab-start-grid' });
    START_PINNED.forEach(function (id) {
      if (!LAB.apps.get(id)) return;
      grid.appendChild(appBtn({ icon: appIconName(id), name: appTitle(id), data: { app: id }, run: function () { LAB.apps.launch(id); } }));
    });

    var recGrid = h('div', { class: 'lab-start-recgrid' });
    RECENT.forEach(function (r) {
      var st = LAB.vfs.stat(r.path);
      if (!st) return;
      var b = h('button', { type: 'button', class: 'lab-start-rec', dataset: { lab: 'start-item', path: r.path } },
        iconBox(LAB.icons.forNode(st), 32), h('span', { class: 'lab-sr-text' }, h('span', { class: 'lab-sr-name' }, st.name), h('span', { class: 'lab-sr-sub' }, r.sub)));
      b.addEventListener('click', function () { closeStart(); openItem(r.path, 'menu'); });
      recGrid.appendChild(b);
    });

    var more = h('button', { type: 'button', class: 'lab-start-allbtn', dataset: { lab: 'start-all-apps' } }, '所有應用程式'); more.appendChild(iconBox('chev-right', 12));
    var recMore = h('button', { type: 'button', class: 'lab-start-allbtn' }, '更多'); recMore.appendChild(iconBox('chev-right', 12));
    recMore.addEventListener('click', toastNoFeature);

    var user = h('button', { type: 'button', class: 'lab-start-user', 'aria-label': 'an', dataset: { lab: 'start-user' } }, h('span', { class: 'lab-start-avatar' }, iconBox('user', 20)), h('span', null, 'an'));
    user.addEventListener('click', function (e) {
      e.stopPropagation();
      var r = LAB.stage.rectOf(user);
      LAB.menu.contextMenu(r.x, r.y - 4, [
        { label: '變更帳戶設定', icon: 'user', action: function () { LAB.apps.launch('settings', { page: 'accounts' }); } },
        { label: '鎖定', icon: 'lock', action: function () { if (LAB.sys && LAB.sys.sleep) LAB.sys.sleep(); } },
        { label: '登出', icon: 'signout', action: function () { if (LAB.sys && LAB.sys.power) LAB.sys.power('signout'); else LAB.desktop.disconnect(); } }
      ], { dark: 'win' });
    });
    // the power button opens 睡眠 / 關機 / 重新啟動 (sysapps.js); 關機 and 重新啟動 leave the practice through LAB.remote.disconnect()
    var power = h('button', { type: 'button', class: 'lab-start-power', 'aria-label': '電源', 'aria-haspopup': 'menu', dataset: { lab: 'start-power' } }, iconBox('power', 20));
    power.addEventListener('click', function (e) {
      e.stopPropagation();
      var r = LAB.stage.rectOf(power);
      var items = LAB.sys && LAB.sys.powerItems ? LAB.sys.powerItems() : [{ label: '關機', icon: 'power', action: function () { LAB.desktop.disconnect(); } }];
      LAB.menu.contextMenu(r.x + r.w - 140, r.y - 4, items, { dark: 'win' });
    });

    // the 所有應用程式 list swaps places with 已釘選 and 建議 (the 返回 button on the right brings them back)
    var scroll = h('div', { class: 'lab-start-scroll' });
    function showHome() {
      start.mode = 'home';
      scroll.textContent = '';
      scroll.appendChild(h('div', { class: 'lab-start-h' }, h('span', null, '已釘選'), more)); scroll.appendChild(grid);
      scroll.appendChild(h('div', { class: 'lab-start-h' }, h('span', null, '建議'), recMore)); scroll.appendChild(recGrid);
      scroll.scrollTop = 0;
    }
    function showAll() {
      start.mode = 'all';
      scroll.textContent = '';
      var back = h('button', { type: 'button', class: 'lab-start-allbtn', dataset: { lab: 'start-back' } }, iconBox('chev-left', 12), '返回');
      back.addEventListener('click', showHome);
      scroll.appendChild(h('div', { class: 'lab-start-allhead' }, h('span', null, '所有應用程式'), back));
      var box = h('div', { class: 'lab-start-all', dataset: { lab: 'start-all-list' } });
      allAppsGroups().forEach(function (g) {
        box.appendChild(h('div', { class: 'lab-all-grp', dataset: { lab: 'start-all-group' } }, g.key));
        g.items.forEach(function (it) {
          var b = h('button', { type: 'button', class: 'lab-all-row', dataset: { lab: 'start-item', app: it.id } }, iconBox(it.icon, 24), h('span', null, it.name));
          b.addEventListener('click', function () { closeStart(); it.run(); });
          box.appendChild(b);
        });
      });
      scroll.appendChild(box);
      scroll.scrollTop = 0;
    }
    more.addEventListener('click', showAll);

    var el = h('div', { class: 'lab-start', role: 'dialog', 'aria-label': '開始', dataset: { lab: 'start-menu' } },
      h('div', { class: 'lab-start-top' }, field),
      scroll,
      h('div', { class: 'lab-start-foot' }, user, power));
    el.style.height = Math.max(360, Math.min(720, stage.dockTop() - 12 - 12)) + 'px';
    overlaysEl.appendChild(el);
    start = { el: el, input: input, off: null, mode: 'home' };
    showHome();
    // typing moves into the Search panel (as in Windows 11); an IME that is still composing finishes first
    var composing = false;
    function handoff() { var v = input.value; if (!v) return; closeStart(); openSpotlight(v); }
    input.addEventListener('compositionstart', function () { composing = true; });
    input.addEventListener('compositionend', function () { composing = false; handoff(); });
    input.addEventListener('input', function (e) { if (!composing && !e.isComposing) handoff(); });
    start.off = LAB.keys.modal(function (e) {
      if (!start) return false;
      if (e.key === 'Escape') { if (LAB.ui.isImeEnter(e)) return false; closeStart(); return true; }
      return false;
    });
    window.addEventListener('pointerdown', onStartDown, true);
    input.focus();
    LAB.bus.emit('shell:start', { open: true });
  }
  function toggleStart() { if (start) closeStart(); else openStart(); }
  LAB.desktop.openStart = openStart;
  LAB.desktop.closeStart = closeStart;
  LAB.desktop.toggleStart = toggleStart;
  LAB.desktop.disconnect = function () {
    if (LAB.remote && LAB.remote.disconnect) LAB.remote.disconnect();
    else LAB.ui.toast('練習版：請關閉這個分頁來離開');
  };

  /* ====================================================== Search panel (W3, replaces Spotlight) */
  var spot = null;   // {el, input, left, right, off, prevFocus, results, index, composing}

  function scoreOf(q, keys) {
    var best = 0;
    keys.forEach(function (k) {
      k = String(k || '').toLowerCase();
      if (!k) return;
      if (k === q) best = Math.max(best, 100);
      else if (k.indexOf(q) === 0) best = Math.max(best, 60);
      else if (q.length >= 2 && k.indexOf(q) >= 0) best = Math.max(best, 30);
    });
    return best;
  }
  function searchApps(q) {
    var out = [];
    LAB.apps.all().forEach(function (def) {
      if (def.id === 'quicklook' || def.id === 'archive' || def.id === 'downloads' || def.id === 'trash') return;
      var keys = (APP_KEYS[def.id] || []).concat([def.id, def.en || '', def.title || '', APP_NAME[def.id] || ''], def.aliases || []);
      var sc = scoreOf(q, keys);
      if (sc) out.push({ kind: 'app', id: def.id, label: appTitle(def.id), sub: '應用程式', icon: appIconName(def.id), score: sc });
    });
    out.sort(function (a, b) { return b.score - a.score; });
    return out;
  }
  /* pages of the Settings app (夜間光線, 背景, 深色模式 ...): they come after the apps */
  function searchSettings(q) {
    var out = [];
    SETTING_HITS.forEach(function (s) {
      var sc = scoreOf(q, [s[0]].concat(s[1]));
      if (sc) out.push({ kind: 'setting', id: 'setting-' + s[2], page: s[2], label: s[0], sub: '設定' + (s[3] ? ' › ' + s[3] : ''), icon: 'app-settings', score: sc });
    });
    out.sort(function (a, b) { return b.score - a.score; });
    return out;
  }
  function searchFiles(q) {
    var dirs = [], files = [];
    (function rec(path, depth) {
      var list;
      try { list = LAB.vfs.list(path); } catch (e) { return; }
      list.forEach(function (st) {
        if (st.hidden) return;
        if (st.name.toLowerCase().indexOf(q) >= 0 || dispName(st.path).toLowerCase().indexOf(q) >= 0) { (st.type === 'dir' ? dirs : files).push(st); }
        if (st.type === 'dir' && depth < 8) rec(st.path, depth + 1);
      });
    })(HOME, 0);
    return { dirs: dirs, files: files };
  }

  function closeSpotlight() {
    if (!spot) return;
    var s = spot; spot = null;
    if (s.el.parentNode) s.el.parentNode.removeChild(s.el);
    if (s.off) s.off();
    if (searchBtn) { searchBtn.setAttribute('aria-expanded', 'false'); searchBtn.classList.remove('is-open'); }
    window.removeEventListener('pointerdown', onSpotDown, true);
    try { if (s.prevFocus && s.prevFocus.focus && document.contains(s.prevFocus)) s.prevFocus.focus(); } catch (e) { /* ignore */ }
    LAB.bus.emit('shell:spotlight', { open: false });
  }
  function onSpotDown(e) {
    if (spot && !spot.el.contains(e.target) && !(searchBtn && searchBtn.contains(e.target))) closeSpotlight();
  }

  function resultRow(it, idx, best) {
    var ico = iconBox(it.icon, best ? 36 : 28, 'lab-search-ico');
    var row = h('div', {
      class: 'lab-search-row' + (best ? ' is-best' : ''), role: 'option', id: 'lab-spot-opt' + idx, 'aria-selected': 'false',
      dataset: { lab: 'spotlight-result', kind: it.kind, id: it.id || '', path: it.path || '' }
    }, ico, h('span', { class: 'lab-search-txt' }, h('span', { class: 'lab-search-label' }, it.label), it.sub ? h('span', { class: 'lab-search-sub' }, it.sub) : null));
    row.addEventListener('mouseenter', function () { setIndex(idx); });
    row.addEventListener('click', function () { activate(idx); });
    return row;
  }

  function renderResults() {
    var q = spot.input.value.trim().toLowerCase();
    spot.left.textContent = '';
    spot.right.textContent = '';
    spot.results = [];
    spot.index = -1;
    if (!q) {
      // nothing typed yet: the apps of this PC as suggestions (they do not take Enter; a click opens them)
      spot.input.setAttribute('aria-expanded', 'false');
      spot.left.appendChild(h('div', { class: 'lab-search-grp' }, '應用程式'));
      PINNED.forEach(function (id) {
        if (!LAB.apps.get(id)) return;
        var row = h('div', { class: 'lab-search-row', role: 'button', tabindex: '-1', dataset: { lab: 'spotlight-suggest', id: id } },
          iconBox(appIconName(id), 28, 'lab-search-ico'), h('span', { class: 'lab-search-txt' }, h('span', { class: 'lab-search-label' }, appTitle(id))));
        row.addEventListener('click', function () { closeSpotlight(); LAB.apps.launch(id); });
        spot.left.appendChild(row);
      });
      return;
    }
    var apps = searchApps(q);
    var f = searchFiles(q);
    function pathItem(st, folder) {
      return { kind: 'path', path: st.path, label: st.name, sub: winPath(LAB.vfs.dirname(st.path)), icon: folder ? 'folder' : LAB.icons.forNode(st), folder: folder, type: st.type };
    }
    var all = apps.concat(searchSettings(q), f.dirs.map(function (s) { return pathItem(s, true); }), f.files.map(function (s) { return pathItem(s, false); }));
    all = all.slice(0, 10);
    if (!all.length) { spot.left.appendChild(h('div', { class: 'lab-search-none' }, '找不到符合「' + spot.input.value.trim() + '」的項目')); spot.input.setAttribute('aria-expanded', 'false'); return; }
    // 「最佳比對」 = the first result; then the rest in groups
    spot.left.appendChild(h('div', { class: 'lab-search-grp' }, '最佳比對'));
    var idx = 0;
    spot.left.appendChild(resultRow(all[0], idx, true));
    spot.results.push({ item: all[0], el: spot.left.lastChild });
    idx++;
    var groups = [
      { title: '應用程式', items: all.slice(1).filter(function (x) { return x.kind === 'app' || x.kind === 'decor'; }) },
      { title: '設定', items: all.slice(1).filter(function (x) { return x.kind === 'setting'; }) },
      { title: '資料夾', items: all.slice(1).filter(function (x) { return x.kind === 'path' && x.folder; }) },
      { title: '文件', items: all.slice(1).filter(function (x) { return x.kind === 'path' && !x.folder; }) }
    ];
    groups.forEach(function (g) {
      if (!g.items.length) return;
      spot.left.appendChild(h('div', { class: 'lab-search-grp' }, g.title));
      g.items.forEach(function (it) {
        var row = resultRow(it, idx, false);
        spot.left.appendChild(row);
        spot.results.push({ item: it, el: row });
        idx++;
      });
    });
    spot.input.setAttribute('aria-expanded', 'true');
    setIndex(0);
  }
  function renderDetail(it) {
    spot.right.textContent = '';
    if (!it) return;
    var kind = it.kind === 'path' ? (it.folder ? '檔案資料夾' : '檔案') : (it.kind === 'setting' ? '系統設定' : '應用程式');
    var open = h('button', { type: 'button', class: 'lab-search-act', dataset: { lab: 'spotlight-open' } }, iconBox('fl-open', 18), h('span', null, '開啟'));
    open.addEventListener('click', function () { activate(spot.index); });
    var acts = h('div', { class: 'lab-search-acts' }, open);
    if (it.kind === 'path') {
      var loc = h('button', { type: 'button', class: 'lab-search-act' }, iconBox('folder-sm', 18), h('span', null, '開啟檔案位置'));
      loc.addEventListener('click', function () { closeSpotlight(); LAB.apps.openPath(it.folder ? it.path : LAB.vfs.dirname(it.path), { via: 'spotlight' }); });
      var cp = h('button', { type: 'button', class: 'lab-search-act' }, iconBox('fl-link', 18), h('span', null, '複製完整路徑'));
      cp.addEventListener('click', function () { LAB.clipboard.setText(winPath(it.path)); LAB.ui.toast('已複製路徑'); });
      acts.appendChild(loc); acts.appendChild(cp);
    } else {
      var adm = h('button', { type: 'button', class: 'lab-search-act is-dim' }, iconBox('fl-more-opts', 18), h('span', null, '以系統管理員身分執行'));
      adm.addEventListener('click', toastNoFeature);
      acts.appendChild(adm);
    }
    spot.right.appendChild(h('span', { class: 'lab-search-big' }, iconBox(it.icon, 72, 'lab-ico-box')));
    spot.right.appendChild(h('div', { class: 'lab-search-dname' }, it.label));
    spot.right.appendChild(h('div', { class: 'lab-search-dkind' }, kind));
    spot.right.appendChild(acts);
  }
  function setIndex(i) {
    if (!spot || !spot.results.length) return;
    i = (i + spot.results.length) % spot.results.length;
    spot.index = i;
    spot.results.forEach(function (r, k) { r.el.classList.toggle('is-hl', k === i); r.el.setAttribute('aria-selected', k === i ? 'true' : 'false'); });
    spot.input.setAttribute('aria-activedescendant', 'lab-spot-opt' + i);
    renderDetail(spot.results[i].item);
    try { spot.results[i].el.scrollIntoView({ block: 'nearest' }); } catch (e) { /* ignore */ }
  }
  function activate(i) {
    if (!spot) return;
    var r = spot.results[i];
    if (!r) return;
    var it = r.item;
    closeSpotlight();
    if (it.kind === 'decor') toastNoApp();
    else if (it.kind === 'setting') LAB.apps.launch('settings', { page: it.page });
    else if (it.kind === 'app') LAB.apps.launch(it.id, it.id === 'about' ? { tab: 'about' } : undefined);
    else openItem(it.path, 'spotlight');
  }

  function openSpotlight(initial) {
    if (spot) { spot.input.focus(); if (typeof initial === 'string') { spot.input.value = initial; renderResults(); } return; }
    closeAllPopups();
    var prev = document.activeElement;
    var input = h('input', {
      type: 'text', class: 'lab-sf-input', role: 'combobox', 'aria-label': '搜尋', placeholder: '在此輸入以搜尋',
      'aria-expanded': 'false', 'aria-controls': 'lab-spot-list', 'aria-autocomplete': 'list', autocomplete: 'off', spellcheck: 'false',
      dataset: { lab: 'spotlight-input' }
    });
    var left = h('div', { class: 'lab-search-left', id: 'lab-spot-list', role: 'listbox', 'aria-label': '搜尋結果' });
    var right = h('div', { class: 'lab-search-right' });
    var field = h('div', { class: 'lab-search-field' }, iconBox('search-tb', 18, 'lab-sf-glass'), input);
    var el = h('div', { class: 'lab-search', role: 'dialog', 'aria-label': '搜尋', dataset: { lab: 'spotlight' } }, field, h('div', { class: 'lab-search-body' }, left, right));
    overlaysEl.appendChild(el);
    if (searchBtn) { searchBtn.setAttribute('aria-expanded', 'true'); searchBtn.classList.add('is-open'); }
    spot = { el: el, input: input, left: left, right: right, prevFocus: prev, results: [], index: -1, composing: false, off: null };
    spot.off = LAB.keys.modal(function (e) {
      if (!spot) return false;
      if (e.key === 'Escape') { if (LAB.ui.isImeEnter(e)) return false; closeSpotlight(); return true; }
      if (LAB.ui.isImeEnter(e)) return false;
      if (e.key === 'ArrowDown') { setIndex(spot.index + 1); return true; }
      if (e.key === 'ArrowUp') { setIndex(spot.index - 1); return true; }
      if (e.key === 'Enter') { if (spot.index >= 0) activate(spot.index); return true; }
      if (e.key === 'Tab') return true;
      return false;
    });
    input.addEventListener('compositionstart', function () { if (spot) spot.composing = true; });
    input.addEventListener('compositionend', function () { if (spot) { spot.composing = false; renderResults(); } });
    input.addEventListener('input', function (e) { if (spot && !spot.composing && !e.isComposing) renderResults(); });
    window.addEventListener('pointerdown', onSpotDown, true);
    if (typeof initial === 'string') input.value = initial;
    renderResults();
    // focus at once (not on a timer): when Start hands over what the student was typing, the next keys must land in this field
    input.focus();
    try { input.setSelectionRange(input.value.length, input.value.length); } catch (e2) { /* ignore */ }
    LAB.bus.emit('shell:spotlight', { open: true });
  }
  LAB.desktop.openSpotlight = openSpotlight;
  LAB.desktop.closeSpotlight = closeSpotlight;
  LAB.desktop.toggleSpotlight = function () { if (spot) closeSpotlight(); else openSpotlight(); };
  function toggleSpotlight() { LAB.desktop.toggleSpotlight(); }
  LAB.bus.on('stage:resize', function () { closeAllPopups(); });

  /* ================================================ phone notice (M§6.3) */
  var phoneContinue = false;
  function phoneNeeded() {
    try {
      var coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
      return (coarse && Math.min(screen.width, screen.height) < 768) || window.innerWidth < 760;
    } catch (e) { return window.innerWidth < 760; }
  }
  LAB.desktop.phoneBlocked = false;
  function showPhoneNotice() {
    if (sget('lab-phone-ok') === '1') { phoneContinue = true; document.documentElement.classList.add('lab-small'); return; }
    if (!phoneNeeded()) return;
    LAB.desktop.phoneBlocked = true;
    var btn = h('button', { type: 'button', class: 'lab-textbtn', dataset: { lab: 'phone-continue' } }, '仍要繼續（不建議）');
    var box = h('div', { class: 'lab-phone', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'lab-phone-t' },
      h('div', { class: 'lab-phone-in' },
        h('h1', { id: 'lab-phone-t' }, '請用電腦開啟'),
        h('p', null, '這個練習需要滑鼠和鍵盤，手機畫面太小，操作會很吃力。建議改用電腦的瀏覽器開啟。'),
        h('p', { class: 'lab-phone-note' }, '建議把手機橫放'),
        btn));
    modalRoot.appendChild(box);
    btn.focus();
    btn.addEventListener('click', function () {
      sset('lab-phone-ok', '1');
      phoneContinue = true;
      document.documentElement.classList.add('lab-small');
      LAB.desktop.phoneBlocked = false;
      if (box.parentNode) box.parentNode.removeChild(box);
      LAB.layout.setRailMode('drawer');
      layoutStage(true);
      LAB.bus.emit('phone:continue', {});
    });
  }

  function setupTouch() {
    // a 500 ms long press stands in for right click on touch screens
    var timer = null, sx = 0, sy = 0;
    stageEl.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'touch') return;
      sx = e.clientX; sy = e.clientY;
      var t = e.target;
      timer = setTimeout(function () {
        timer = null;
        t.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: sx, clientY: sy, button: 2 }));
      }, 500);
    });
    ['pointerup', 'pointercancel'].forEach(function (n) { stageEl.addEventListener(n, function () { if (timer) { clearTimeout(timer); timer = null; } }); });
    stageEl.addEventListener('pointermove', function (e) {
      if (timer && (Math.abs(e.clientX - sx) > 8 || Math.abs(e.clientY - sy) > 8)) { clearTimeout(timer); timer = null; }
    });
  }

  /* ================================================================ boot */
  LAB.ready(function () {
    rootEl = document.getElementById('lab-root');
    screenEl = document.getElementById('lab-screen');
    stageEl = document.getElementById('lab-stage');
    wallEl = document.getElementById('lab-wall');
    desktopEl = document.getElementById('lab-desktop');
    windowsEl = document.getElementById('lab-windows');
    menubarEl = document.getElementById('lab-menubar');
    dockEl = document.getElementById('lab-dock');
    overlaysEl = document.getElementById('lab-overlays');
    modalRoot = document.getElementById('lab-modal-root');
    if (!rootEl || !stageEl) { console.error('[desktop] page skeleton missing'); return; }

    initPerf();
    if (sget('lab-phone-ok') === '1') { phoneContinue = true; document.documentElement.classList.add('lab-small'); }
    if (menubarEl) menubarEl.textContent = '';             // Windows has no menu bar: the element stays, empty and 0 px tall
    layout.apply();
    layoutStage(true);
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(queueMeasure).observe(screenEl);
    window.addEventListener('resize', function () {
      // a browser window that was resized (or zoomed) after load gets the card mode it would have got at load
      if (rootEl && layout.railMode() !== appliedMode) { drawerOpen = false; layout.apply(); }
      queueMeasure();
    });

    setupDesktop();
    setupTaskbar();
    setupTouch();
    setupCardDrag();
    updateCardRoom();

    // overlay scrollbars: show the thumb while something scrolls (M§2.4)
    stageEl.addEventListener('scroll', function (e) {
      var t = e.target;
      if (!t || !t.classList) return;
      t.classList.add('lab-scrolling');
      if (t._labScrollT) clearTimeout(t._labScrollT);
      t._labScrollT = setTimeout(function () { t.classList.remove('lab-scrolling'); }, 900);
    }, true);
    // the browser's own context menu stays away from the fake PC (but not from real text fields)
    stageEl.addEventListener('contextmenu', function (e) {
      var t = e.target;
      if (t && t.closest && t.closest('input, textarea')) return;
      e.preventDefault();
    });
    // a click anywhere in the stage closes the card drawer
    stageEl.addEventListener('pointerdown', function () { if (layout.isDrawerOpen()) layout.closeDrawer(); }, true);
    LAB.keys.on('escape', function () { if (layout.isDrawerOpen()) { layout.closeDrawer(); return true; } return false; });
    LAB.bus.on('store:reset', function () { renderIcons(); });
  }, 30);

  LAB.ready(function () { showPhoneNotice(); }, 90);
})(window.LAB);
