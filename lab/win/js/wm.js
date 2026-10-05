/* wm.js [SKIN] — LAB.wm window manager (M§3.6) with the Windows 11 frame (DESIGN W3): caption buttons at the right, 32 px title bar,
   optional app-drawn title bar (`titlebar: 'custom'`, content goes into win.tbc). All pointer maths go through LAB.stage.toStage. */
(function (LAB) {
  'use strict';

  var h = LAB.util.h;
  var wins = new Map();            // id -> Win
  var zCounter = 0;
  var focusedId = null;
  var frontApp = 'finder';
  var hiddenApps = new Set();
  var lastFocus = new Map();       // appId -> winId
  var probed = false;

  var wm = {};

  function layer() { return document.getElementById('lab-windows'); }
  function reduced() {
    try { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  }
  function stage() { return LAB.stage; }

  /* Windows 11 caption glyphs: 10 px, 1 px strokes on half-pixel coordinates so they stay crisp at scale 1 (colour = currentColor) */
  var CAP = {
    min: '<svg viewBox="0 0 10 10" aria-hidden="true" focusable="false"><path d="M0 5.5h10" fill="none" stroke="currentColor" stroke-width="1"/></svg>',
    max: '<svg class="g-max" viewBox="0 0 10 10" aria-hidden="true" focusable="false"><rect x=".5" y=".5" width="9" height="9" rx="1.5" fill="none" stroke="currentColor" stroke-width="1"/></svg>',
    restore: '<svg class="g-restore" viewBox="0 0 10 10" aria-hidden="true" focusable="false"><path d="M2.5 2.5V2A1.5 1.5 0 0 1 4 .5h4A1.5 1.5 0 0 1 9.5 2v4A1.5 1.5 0 0 1 8 7.5h-.5" fill="none" stroke="currentColor" stroke-width="1"/><rect x=".5" y="2.5" width="7" height="7" rx="1.5" fill="none" stroke="currentColor" stroke-width="1"/></svg>',
    close: '<svg viewBox="0 0 10 10" aria-hidden="true" focusable="false"><path d="M.5.5l9 9M9.5.5l-9 9" fill="none" stroke="currentColor" stroke-width="1"/></svg>'
  };

  function visible(w) { return !w.minimized && !hiddenApps.has(w.appId) && !w.closed; }
  function orderByZ() {
    var arr = [];
    wins.forEach(function (w) { arr.push(w); });
    arr.sort(function (a, b) { return a.z - b.z; });
    return arr;
  }
  function refreshMenu() { if (LAB.menu && LAB.menu.refresh) LAB.menu.refresh(); }
  function updateClasses() {
    wins.forEach(function (w) {
      var act = w.id === focusedId;
      w.el.classList.toggle('is-active', act);
      w.el.classList.toggle('is-inactive', !act);
    });
  }
  function setFront(appId) {
    if (frontApp !== appId) {
      frontApp = appId;
      LAB.bus.emit('app:frontmost', { appId: appId });
    }
  }

  /* ----------------------------------------------------------- geometry */
  function work() { return stage().workArea(); }
  function clampRect(r, minW, minH) {
    var wa = work();
    var w = Math.max(minW, Math.min(r.w, wa.w));
    var hh = Math.max(minH, Math.min(r.h, wa.h));
    var x = Math.max(-(w - 40), Math.min(r.x, wa.w - 40));
    var y = Math.max(wa.y, Math.min(r.y, wa.y + wa.h - 32));     // the title bar always stays above the taskbar
    return { x: x, y: y, w: w, h: hh };
  }

  wm.spawnRect = function (w, hh, appId) {
    var sa = stage().spawnArea();
    var n = 0;
    wins.forEach(function (x) { if (!x.closed && !x.minimized) n++; });      // Windows cascades new windows over the ones already open
    var off = (n % 6) * 26;
    var x = sa.x + Math.max(0, (sa.w - w) / 2 - 40) + off;
    var y = sa.y + Math.max(0, (sa.h - hh) / 2 - 20) + off;
    x = Math.max(sa.x, Math.min(x, sa.x + Math.max(0, sa.w - w)));
    y = Math.max(sa.y, Math.min(y, sa.y + Math.max(0, sa.h - hh)));
    // still too wide for the room left of the mission pill (narrow screens): keep the desktop icons clear and start below the pill
    var below = w > sa.w && stage().belowCard ? stage().belowCard() : null;
    if (below !== null) { x = Math.max(stage().reserveLeft(), Math.min(x, stage().w - 12 - w)); y = Math.max(y, below); }
    return { x: Math.round(x), y: Math.round(y) };
  };

  /* -------------------------------------------------------------- open */
  wm.open = function (opts) {
    var appId = opts.appId;
    if (opts.singleton) {
      var found = null;
      wins.forEach(function (w) { if (w.singleton === opts.singleton && !w.closed) found = w; });
      if (found) { found.focus(); return found; }
    }
    if (LAB.apps && LAB.apps._ensureRunning) LAB.apps._ensureRunning(appId);

    var minW = opts.minW || 320, minH = opts.minH || 200;
    // title bar kind: 'plain' (icon + title), 'custom' (the app draws its own tab strip into win.tbc), 'hidden' (caption buttons only).
    // `titlebar:'custom'` is the documented spelling; the Mac values bar:'unified' (= custom) and bar:'hidden' still work.
    var bar = opts.titlebar === 'custom' ? 'custom' : (opts.bar || 'plain');
    if (bar === 'unified') bar = 'custom';
    var theme = opts.theme || 'light';
    var wa = work();
    var width = Math.max(minW, Math.min(opts.width || 640, wa.w));
    var height = Math.max(minH, Math.min(opts.height || 420, wa.h));
    // a new window wider than the room left of the mission card first gets narrower (never below its minimum width)
    if (opts.x === undefined || opts.y === undefined) width = Math.max(minW, Math.min(width, stage().spawnArea().w));
    var pos = (opts.x === undefined || opts.y === undefined) ? wm.spawnRect(width, height, appId) : { x: opts.x, y: opts.y };
    // a new window stops above the taskbar: when it starts low (below the mission pill) it gets shorter rather than reaching behind it
    if ((opts.x === undefined || opts.y === undefined) && stage().dockTop) height = Math.max(minH, Math.min(height, stage().dockTop() - 8 - pos.y));
    var rect = clampRect({ x: pos.x, y: pos.y, w: width, h: height }, minW, minH);

    var id = LAB.util.uid('w');
    var titleEl = h('div', { class: 'lab-win-title', dataset: { drag: '1' } }, opts.title || '');
    // the app icon at the left of a plain bar (16 px); an unknown icon name simply shows no icon
    var iconName = opts.icon || ('app-' + appId);
    var iconEl = null;
    if (bar === 'plain' && LAB.icons.has && LAB.icons.has(iconName)) {
      iconEl = h('span', { class: 'lab-win-icon', dataset: { drag: '1' }, 'aria-hidden': 'true' });
      iconEl.innerHTML = LAB.icons.get(iconName, { size: 16 });          // static icon markup only
    }
    // win.tbc: the area an app with its own tab strip fills (titlebar:'custom')
    var tbc = h('div', { class: 'lab-win-tbc', dataset: { drag: '1' } });
    var tbContent = opts.titlebarContent || opts.toolbar;
    if (tbContent) tbc.appendChild(tbContent);
    var btnClose = h('button', { type: 'button', class: 'lab-tl-btn lab-cap-btn lab-tl-close', 'aria-label': '關閉', dataset: { lab: 'tl-close' } });
    var btnMin = h('button', { type: 'button', class: 'lab-tl-btn lab-cap-btn lab-tl-min', 'aria-label': '最小化', dataset: { lab: 'tl-min' } });
    var btnZoom = h('button', { type: 'button', class: 'lab-tl-btn lab-cap-btn lab-cap-zoom lab-tl-zoom', 'aria-label': '最大化', dataset: { lab: 'tl-zoom' } });
    btnClose.innerHTML = CAP.close; btnMin.innerHTML = CAP.min; btnZoom.innerHTML = CAP.max + CAP.restore;   // static strings
    if (opts.resizable === false) { btnZoom.disabled = true; }
    var capGroup = h('div', { class: 'lab-tl lab-caption' }, btnMin, btnZoom, btnClose);
    var barEl = h('div', { class: 'lab-win-bar' + (bar === 'custom' ? ' lab-win-bar-custom' : ''), dataset: { drag: '1' } }, iconEl, titleEl, tbc, capGroup);
    var body = h('div', { class: 'lab-win-body' });
    if (opts.content) body.appendChild(opts.content);
    var el = h('div', {
      class: 'lab-win bar-' + bar + ' theme-' + theme + ' is-inactive',
      role: 'group', 'aria-label': opts.title || appId,
      dataset: { lab: 'win', app: appId, win: id }
    }, barEl, body);
    if (bar === 'custom') el.style.setProperty('--lab-tb-h', Math.max(32, opts.titlebarHeight || 40) + 'px');
    el.style.setProperty('--lab-cap-h', Math.max(24, opts.captionHeight || 32) + 'px');
    if (opts.resizable !== false) {
      ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'].forEach(function (d) {
        el.appendChild(h('div', { class: 'lab-rz lab-rz-' + d, dataset: { dir: d } }));
      });
    }
    el.style.left = rect.x + 'px'; el.style.top = rect.y + 'px';
    el.style.width = rect.w + 'px'; el.style.height = rect.h + 'px';

    var handlers = { focus: [], blur: [], resize: [], move: [], close: [], zoom: [] };
    var disposers = [];
    var win = {
      id: id, appId: appId, el: el, body: body, titleEl: titleEl, tbc: tbc, toolsEl: tbc, titlebarEl: barEl, btnZoom: btnZoom, state: {}, singleton: opts.singleton || null,
      minW: minW, minH: minH, bar: bar, theme: theme, icon: opts.icon || ('app-' + appId),
      z: 0, minimized: false, zoomed: false, snapped: null, closed: false, prevRect: null, onCloseCb: opts.onClose || null,
      setTitle: function (t) {
        titleEl.textContent = t;
        el.setAttribute('aria-label', t);
        LAB.bus.emit('win:title', { id: id, appId: appId, title: t });
      },
      getTitle: function () { return titleEl.textContent; },
      getRect: function () {
        return { x: parseFloat(el.style.left) || 0, y: parseFloat(el.style.top) || 0, w: parseFloat(el.style.width) || 0, h: parseFloat(el.style.height) || 0 };
      },
      setRect: function (r) {
        var cur = win.getRect();
        var nr = { x: r.x === undefined ? cur.x : r.x, y: r.y === undefined ? cur.y : r.y, w: r.w === undefined ? cur.w : r.w, h: r.h === undefined ? cur.h : r.h };
        nr = clampRect(nr, minW, minH);
        el.style.left = nr.x + 'px'; el.style.top = nr.y + 'px'; el.style.width = nr.w + 'px'; el.style.height = nr.h + 'px';
        emitWin('resize', nr);
      },
      focus: function () { focusWin(win, true); },
      close: function (force) { return closeWin(win, force); },
      minimize: function () { minimizeWin(win); },
      restore: function () { restoreWin(win); },
      zoom: function () { zoomWin(win); },
      isFocused: function () { return focusedId === id; },
      isMinimized: function () { return win.minimized; },
      isZoomed: function () { return win.zoomed; },
      on: function (evt, fn) {
        if (!handlers[evt]) handlers[evt] = [];
        handlers[evt].push(fn);
        return function () { var i = handlers[evt].indexOf(fn); if (i >= 0) handlers[evt].splice(i, 1); };
      },
      own: function (fn) { disposers.push(fn); return fn; },
      _handlers: handlers, _disposers: disposers
    };
    function emitWin(evt, arg) {
      (handlers[evt] || []).slice().forEach(function (fn) { try { fn(arg, win); } catch (e) { console.error(e); } });
    }
    win._emit = emitWin;

    wins.set(id, win);
    win.z = ++zCounter;
    el.style.zIndex = String(win.z);
    layer().appendChild(el);
    if (!reduced()) { el.classList.add('is-opening'); setTimeout(function () { el.classList.remove('is-opening'); }, 220); }

    wireWindow(win);
    LAB.bus.emit('win:open', { id: id, appId: appId, title: opts.title || '' });
    focusWin(win, true);
    return win;
  };

  /* -------------------------------------------------------- wiring */
  function wireWindow(win) {
    var el = win.el;
    // focus + raise on press anywhere (capture: the event continues to the control underneath)
    el.addEventListener('mousedown', function () { if (focusedId !== win.id) focusWin(win, true); }, true);
    el.querySelector('[data-lab="tl-close"]').addEventListener('click', function (e) { e.stopPropagation(); closeWin(win); });
    el.querySelector('[data-lab="tl-min"]').addEventListener('click', function (e) { e.stopPropagation(); minimizeWin(win); });
    el.querySelector('[data-lab="tl-zoom"]').addEventListener('click', function (e) { e.stopPropagation(); zoomWin(win); });
    wireSnap(win, el.querySelector('[data-lab="tl-zoom"]'));
    var bar = el.querySelector('.lab-win-bar');
    // double-click on the title bar maximizes / restores (not on buttons, fields or anything marked data-nodrag)
    bar.addEventListener('dblclick', function (e) {
      if (e.target.closest('button, input, textarea, select, a, [contenteditable], [data-nodrag]')) return;
      if (!e.target.closest('[data-drag]')) return;
      if (win.el.querySelector('.lab-rz')) zoomWin(win);
    });
    bar.addEventListener('pointerdown', function (e) { startDrag(win, e); });
    var hs = el.querySelectorAll('.lab-rz');
    for (var i = 0; i < hs.length; i++) {
      (function (hnd) { hnd.addEventListener('pointerdown', function (e) { startResize(win, hnd.dataset.dir, e); }); })(hs[i]);
    }
  }

  function startDrag(win, e) {
    if (e.button !== 0 || e.isPrimary === false) return;
    var t = e.target;
    if (t.closest('button, input, textarea, select, a, [contenteditable], [data-nodrag]')) return;
    if (!t.closest('[data-drag]')) return;
    var start = stage().toStage(e.clientX, e.clientY);
    var r0 = win.getRect();
    var moved = false, dx = 0, dy = 0, pending = null, rafId = 0, pid = e.pointerId, lastPt = null;
    var frames = 0, lastT = 0, sumDt = 0;
    var wa = work();

    function apply() {
      rafId = 0;
      if (!pending) return;
      var p = pending; pending = null;
      var ndx = p.x - start.x, ndy = p.y - start.y;
      if (!moved) {
        if (Math.abs(ndx) < 3 && Math.abs(ndy) < 3) return;
        moved = true;
        // dragging a maximized (or snapped) window restores its old size under the pointer (as Windows does)
        if ((win.zoomed || win.snapped) && win.prevRect) {
          var pr = win.prevRect;
          var fx = r0.w ? (start.x - r0.x) / r0.w : 0.5;
          r0 = { x: Math.round(start.x - fx * pr.w), y: r0.y, w: pr.w, h: pr.h };
          win.el.style.left = r0.x + 'px'; win.el.style.top = r0.y + 'px'; win.el.style.width = r0.w + 'px'; win.el.style.height = r0.h + 'px';
          win.prevRect = null; win.snapped = null;
          setZoomedUI(win, false);
          win._emit('resize', win.getRect());
          win._emit('zoom', false);
          LAB.bus.emit('win:zoom', { id: win.id, appId: win.appId, zoomed: false });
        }
        win.el.style.willChange = 'transform';
        document.body.classList.add('lab-dragging-win');
      }
      var nx = Math.max(-(r0.w - 40), Math.min(r0.x + ndx, wa.w - 40));
      var ny = Math.max(wa.y, Math.min(r0.y + ndy, wa.y + wa.h - 32));
      dx = nx - r0.x; dy = ny - r0.y;
      win.el.style.transform = 'translate3d(' + dx + 'px,' + dy + 'px,0)';
    }
    function move(ev) {
      if (ev.pointerId !== pid) return;
      pending = lastPt = stage().toStage(ev.clientX, ev.clientY);
      if (!probed && moved) {
        var now = performance.now();
        if (lastT) { sumDt += now - lastT; frames++; }
        lastT = now;
        if (frames >= 20) { probed = true; if (LAB.perf && LAB.perf.probe) LAB.perf.probe(sumDt / frames); }
      }
      if (!rafId) rafId = requestAnimationFrame(apply);
    }
    function up(ev) {
      if (ev.pointerId !== pid) return;
      window.removeEventListener('pointermove', move, true);
      window.removeEventListener('pointerup', up, true);
      window.removeEventListener('pointercancel', up, true);
      if (rafId) { cancelAnimationFrame(rafId); rafId = 0; if (pending) apply(); }
      document.body.classList.remove('lab-dragging-win');
      if (moved) {
        win.el.style.transform = '';
        win.el.style.willChange = '';
        win.el.style.left = (r0.x + dx) + 'px';
        win.el.style.top = (r0.y + dy) + 'px';
        win.zoomed = false; win.snapped = null;
        setZoomedUI(win, false);
        win._emit('move', win.getRect());
        LAB.bus.emit('win:move', { id: win.id, appId: win.appId, rect: win.getRect() });
        // dropping a window with the pointer at the very top edge maximizes it (Windows snap)
        if (lastPt && lastPt.y <= 2 && win.el.querySelector('.lab-rz')) zoomWin(win);
      }
    }
    window.addEventListener('pointermove', move, true);
    window.addEventListener('pointerup', up, true);
    window.addEventListener('pointercancel', up, true);
  }

  function startResize(win, dir, e) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    if (focusedId !== win.id) focusWin(win, true);
    var start = stage().toStage(e.clientX, e.clientY);
    var r0 = win.getRect();
    var wa = work();
    var pid = e.pointerId, pending = null, rafId = 0, changed = false;
    win.el.style.willChange = 'width,height';
    function apply() {
      rafId = 0;
      if (!pending) return;
      var p = pending; pending = null;
      var dx = p.x - start.x, dy = p.y - start.y;
      var x = r0.x, y = r0.y, w = r0.w, hh = r0.h;
      if (dir.indexOf('e') >= 0) w = Math.max(win.minW, r0.w + dx);
      if (dir.indexOf('s') >= 0) hh = Math.max(win.minH, r0.h + dy);
      if (dir.indexOf('w') >= 0) { w = Math.max(win.minW, r0.w - dx); x = r0.x + (r0.w - w); }
      if (dir.indexOf('n') >= 0) {
        hh = Math.max(win.minH, r0.h - dy); y = r0.y + (r0.h - hh);
        if (y < wa.y) { hh -= (wa.y - y); y = wa.y; }
      }
      win.el.style.left = x + 'px'; win.el.style.top = y + 'px'; win.el.style.width = w + 'px'; win.el.style.height = hh + 'px';
      changed = true;
      if (win.zoomed || win.snapped) { win.zoomed = false; win.snapped = null; win.prevRect = null; setZoomedUI(win, false); }
      win._emit('resize', { x: x, y: y, w: w, h: hh });
    }
    function move(ev) {
      if (ev.pointerId !== pid) return;
      pending = stage().toStage(ev.clientX, ev.clientY);
      if (!rafId) rafId = requestAnimationFrame(apply);
    }
    function up(ev) {
      if (ev.pointerId !== pid) return;
      window.removeEventListener('pointermove', move, true);
      window.removeEventListener('pointerup', up, true);
      window.removeEventListener('pointercancel', up, true);
      if (rafId) { cancelAnimationFrame(rafId); rafId = 0; if (pending) apply(); }
      win.el.style.willChange = '';
      document.body.classList.remove('lab-resizing');
      if (changed) LAB.bus.emit('win:resize', { id: win.id, appId: win.appId, rect: win.getRect() });
    }
    document.body.classList.add('lab-resizing');
    window.addEventListener('pointermove', move, true);
    window.addEventListener('pointerup', up, true);
    window.addEventListener('pointercancel', up, true);
  }

  /* ----------------------------------------------------- focus & state */
  function raise(win) { win.z = ++zCounter; win.el.style.zIndex = String(win.z); }

  function focusWin(win, emit) {
    if (win.closed) return;
    if (hiddenApps.has(win.appId)) wm.showApp(win.appId, true);
    if (win.minimized) { restoreWin(win, true); }
    var was = focusedId;
    if (was !== win.id) {
      var prev = was && wins.get(was);
      focusedId = win.id;
      if (prev) prev._emit('blur', prev);
    }
    raise(win);
    lastFocus.set(win.appId, win.id);
    updateClasses();
    setFront(win.appId);
    if (emit && was !== win.id) { win._emit('focus', win); }
    if (emit) LAB.bus.emit('win:focus', { id: win.id, appId: win.appId });
    refreshMenu();
  }

  wm.focus = function (id) { var w = wins.get(id); if (w) focusWin(w, true); };

  /* clicking the empty desktop: Finder becomes frontmost, every window looks inactive, stacking is kept */
  wm.focusDesktop = function () {
    var prev = focusedId && wins.get(focusedId);
    focusedId = null;
    if (prev) prev._emit('blur', prev);
    updateClasses();
    setFront('finder');
    refreshMenu();
    LAB.bus.emit('desktop:focus', {});          // the taskbar drops its focused-app indicator
  };

  function nextVisibleAfter(closing) {
    var arr = orderByZ().filter(function (w) { return visible(w) && w !== closing; });
    var same = arr.filter(function (w) { return closing && w.appId === closing.appId; });
    var pool = same.length ? same : arr;
    return pool.length ? pool[pool.length - 1] : null;
  }

  function closeWin(win, force) {
    if (win.closed) return true;
    if (!force && win.onCloseCb) {
      var r;
      try { r = win.onCloseCb(win); } catch (e) { console.error(e); r = true; }
      if (r === false) return false;
    }
    win.closed = true;
    win._emit('close', win);
    var ds = win._disposers.slice().reverse();
    ds.forEach(function (fn) { try { fn(); } catch (e) { console.error('[wm] disposer failed', e); } });
    win._disposers.length = 0;
    wins.delete(win.id);
    var wasFocused = focusedId === win.id;
    if (win.el.parentNode) win.el.parentNode.removeChild(win.el);
    if (lastFocus.get(win.appId) === win.id) lastFocus.delete(win.appId);
    LAB.bus.emit('win:close', { id: win.id, appId: win.appId });
    if (wasFocused) {
      focusedId = null;
      var nx = nextVisibleAfter(win);
      if (nx) focusWin(nx, false); else { updateClasses(); setFront(win.appId === frontApp ? frontApp : 'finder'); refreshMenu(); }
    } else refreshMenu();
    if (LAB.debug && LAB.debug.afterWindowClose) LAB.debug.afterWindowClose();
    return true;
  }
  wm.close = function (id, o) { var w = wins.get(id); if (!w) return false; return closeWin(w, !!(o && o.force)); };

  function minimizeWin(win) {
    if (win.minimized || win.closed) return;
    win.minimized = true;
    var finish = function () { win.el.classList.remove('is-minimizing'); win.el.hidden = true; };
    if (reduced()) finish();
    else { win.el.classList.add('is-minimizing'); setTimeout(finish, 250); }
    LAB.bus.emit('win:minimize', { id: win.id, appId: win.appId });
    if (focusedId === win.id) {
      focusedId = null;
      var nx = nextVisibleAfter(win);
      if (nx) focusWin(nx, false); else { updateClasses(); setFront('finder'); refreshMenu(); }
    }
  }
  wm.minimize = function (id) { var w = wins.get(id); if (w) minimizeWin(w); };

  function restoreWin(win, noFocus) {
    if (!win.minimized) return;
    win.minimized = false;
    win.el.hidden = false;
    win.el.classList.remove('is-minimizing');
    if (!reduced()) { win.el.classList.add('is-restoring'); setTimeout(function () { win.el.classList.remove('is-restoring'); }, 220); }
    LAB.bus.emit('win:restore', { id: win.id, appId: win.appId });
    if (!noFocus) focusWin(win, true);
  }
  wm.restore = function (id) { var w = wins.get(id); if (w) restoreWin(w); };

  /* maximized look: `is-zoomed` (state; the caption glyph shows 還原) and `is-flush` (the rectangle touches every screen edge: square corners, no border) */
  function setZoomedUI(win, zoomed) {
    var flush = false;
    if (zoomed) {
      var wa = work(), r = win.getRect();
      flush = r.x <= 0.5 && r.y <= 0.5 && r.w >= wa.w - 1 && r.h >= wa.h - 1;
    }
    win.el.classList.toggle('is-zoomed', !!zoomed);
    win.el.classList.toggle('is-flush', flush);
    if (win.btnZoom) {
      var lab = zoomed ? '還原' : '最大化';
      win.btnZoom.setAttribute('aria-label', lab);
    }
  }

  function zoomWin(win) {
    if (win.closed || win.el.querySelector('.lab-rz') === null) return;
    if (!reduced()) {
      win.el.classList.add('is-animating');
      setTimeout(function () { win.el.classList.remove('is-animating'); }, 200);
    }
    if (win.zoomed && win.prevRect) {
      var r = win.prevRect;
      win.prevRect = null; win.zoomed = false;
      win.el.style.left = r.x + 'px'; win.el.style.top = r.y + 'px'; win.el.style.width = r.w + 'px'; win.el.style.height = r.h + 'px';
    } else {
      if (!win.snapped) win.prevRect = win.getRect();          // a snapped window already holds its normal size
      win.snapped = null;
      var z = stage().zoomRect();
      win.zoomed = true;
      win.el.style.left = z.x + 'px'; win.el.style.top = z.y + 'px'; win.el.style.width = z.w + 'px'; win.el.style.height = z.h + 'px';
    }
    setZoomedUI(win, win.zoomed);
    win._emit('resize', win.getRect());
    win._emit('zoom', win.zoomed);
    LAB.bus.emit('win:zoom', { id: win.id, appId: win.appId, zoomed: win.zoomed });
    LAB.bus.emit('win:resize', { id: win.id, appId: win.appId, rect: win.getRect() });
  }
  wm.zoom = function (id) { var w = wins.get(id); if (w) zoomWin(w); };

  /* ------------------------------------------------ Snap layouts (round 5)
     Pointing at the maximize button for half a second opens a small panel of four layouts (two halves, 2/3 + 1/3, three columns, four corners).
     Clicking a zone puts the window there: the zones are cut from the same rectangle a maximized window uses (LAB.stage.zoomRect(), clear of the desktop
     icons and of the mission card), with a small gap. Dragging a snapped window, or resizing it, gives its old size back, like a maximized one. */
  var SNAP_LAYOUTS = [
    { id: 'half', name: '兩欄', zones: [[0, 0, 0.5, 1], [0.5, 0, 0.5, 1]] },
    { id: 'wide', name: '大小欄', zones: [[0, 0, 2 / 3, 1], [2 / 3, 0, 1 / 3, 1]] },
    { id: 'thirds', name: '三欄', zones: [[0, 0, 1 / 3, 1], [1 / 3, 0, 1 / 3, 1], [2 / 3, 0, 1 / 3, 1]] },
    { id: 'quad', name: '四格', zones: [[0, 0, 0.5, 0.5], [0.5, 0, 0.5, 0.5], [0, 0.5, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5]] }
  ];
  function snapLayout(id) { for (var i = 0; i < SNAP_LAYOUTS.length; i++) if (SNAP_LAYOUTS[i].id === id) return SNAP_LAYOUTS[i]; return null; }
  function snapRect(layoutId, zone) {
    var lay = snapLayout(layoutId), z = lay && lay.zones[zone];
    if (!z) return null;
    var b = stage().zoomRect(), g = 3;
    return { x: Math.round(b.x + z[0] * b.w + g), y: Math.round(b.y + z[1] * b.h + g), w: Math.round(z[2] * b.w - 2 * g), h: Math.round(z[3] * b.h - 2 * g) };
  }
  function snapWin(win, layoutId, zone) {
    if (win.closed || win.el.querySelector('.lab-rz') === null) return false;
    var r = snapRect(layoutId, zone);
    if (!r) return false;
    if (win.minimized) restoreWin(win, true);
    if (!win.zoomed && !win.snapped) win.prevRect = win.getRect();        // a window that was maximized or snapped already remembers its normal size
    if (!reduced()) {
      win.el.classList.add('is-animating');
      setTimeout(function () { win.el.classList.remove('is-animating'); }, 200);
    }
    win.zoomed = false;
    win.snapped = { layout: layoutId, zone: zone };
    setZoomedUI(win, false);
    var nr = clampRect(r, win.minW, win.minH);
    // a window that cannot get as narrow as its zone (its minimum width) keeps its side of the screen: it slides back inside the maximize rectangle
    var zr = stage().zoomRect();
    if (nr.x + nr.w > zr.x + zr.w) nr.x = Math.max(zr.x, Math.round(zr.x + zr.w - nr.w));
    win.el.style.left = nr.x + 'px'; win.el.style.top = nr.y + 'px'; win.el.style.width = nr.w + 'px'; win.el.style.height = nr.h + 'px';
    win._emit('resize', win.getRect());
    LAB.bus.emit('win:snap', { id: win.id, appId: win.appId, layout: layoutId, zone: zone, rect: win.getRect() });
    LAB.bus.emit('win:resize', { id: win.id, appId: win.appId, rect: win.getRect() });
    focusWin(win, true);
    return true;
  }
  wm.snap = function (id, layoutId, zone) { var w = wins.get(id); return w ? snapWin(w, layoutId, zone) : false; };
  wm.snapLayouts = function () { return SNAP_LAYOUTS.map(function (l) { return { id: l.id, name: l.name, zones: l.zones.length }; }); };
  wm.snapRect = snapRect;

  var snapUI = null;       // {el, win, timer, hideT}
  function snapHide() {
    if (!snapUI) return;
    var s = snapUI; snapUI = null;
    clearTimeout(s.hideT);
    if (s.el.parentNode) s.el.parentNode.removeChild(s.el);
  }
  function snapShow(win, btn) {
    snapHide();
    var host = document.getElementById('lab-overlays');
    if (!host || win.closed) return;
    var grid = h('div', { class: 'lab-snap-grid' });
    SNAP_LAYOUTS.forEach(function (lay) {
      var box = h('div', { class: 'lab-snap-lay', role: 'group', 'aria-label': lay.name, dataset: { lab: 'snap-layout', layout: lay.id } });
      lay.zones.forEach(function (z, i) {
        var pad = 1.5;
        var zb = h('button', { type: 'button', class: 'lab-snap-zone', 'aria-label': lay.name + ' ' + (i + 1), dataset: { lab: 'snap-zone', layout: lay.id, zone: i } });
        zb.style.left = 'calc(' + (z[0] * 100) + '% + ' + pad + 'px)'; zb.style.top = 'calc(' + (z[1] * 100) + '% + ' + pad + 'px)';
        zb.style.width = 'calc(' + (z[2] * 100) + '% - ' + (pad * 2) + 'px)'; zb.style.height = 'calc(' + (z[3] * 100) + '% - ' + (pad * 2) + 'px)';
        zb.addEventListener('click', function (e) { e.stopPropagation(); snapHide(); snapWin(win, lay.id, i); });
        box.appendChild(zb);
      });
      grid.appendChild(box);
    });
    var el = h('div', { class: 'lab-snap', role: 'dialog', 'aria-label': '貼齊版面配置', dataset: { lab: 'snap-flyout' } }, grid);
    host.appendChild(el);
    var r = stage().rectOf(btn), w = el.offsetWidth;
    el.style.left = Math.round(Math.max(4, Math.min(r.x + r.w - w + 24, stage().w - w - 4))) + 'px';
    el.style.top = Math.round(r.y + r.h + 2) + 'px';
    snapUI = { el: el, win: win, hideT: 0 };
    el.addEventListener('mouseenter', function () { if (snapUI) clearTimeout(snapUI.hideT); });
    el.addEventListener('mouseleave', function () { if (snapUI) snapUI.hideT = setTimeout(snapHide, 200); });
  }
  var snapTimer = 0;
  function wireSnap(win, btn) {
    if (btn.disabled) return;
    btn.addEventListener('mouseenter', function () {
      clearTimeout(snapTimer);
      if (snapUI && snapUI.win === win) { clearTimeout(snapUI.hideT); return; }
      snapTimer = setTimeout(function () { if (!win.closed && btn.matches(':hover')) snapShow(win, btn); }, 450);
    });
    btn.addEventListener('mouseleave', function () {
      clearTimeout(snapTimer);
      if (snapUI && snapUI.win === win) snapUI.hideT = setTimeout(snapHide, 220);
    });
    btn.addEventListener('click', function () { clearTimeout(snapTimer); snapHide(); });
  }
  window.addEventListener('pointerdown', function (e) { if (snapUI && !(e.target.closest && e.target.closest('.lab-snap'))) snapHide(); }, true);
  LAB.bus.on('stage:resize', snapHide);
  LAB.bus.on('win:close', function (d) { if (snapUI && snapUI.win.id === d.id) snapHide(); });

  /* ---------------------------------------------------------- queries */
  wm.get = function (id) { return wins.get(id) || null; };
  wm.all = function () { return orderByZ(); };
  wm.byApp = function (appId) { return orderByZ().filter(function (w) { return w.appId === appId; }); };
  wm.focused = function () { return focusedId ? (wins.get(focusedId) || null) : null; };
  wm.frontmostApp = function () { return frontApp; };
  wm.lastFocused = function (appId) { var id = lastFocus.get(appId); return id ? (wins.get(id) || null) : null; };
  wm.isHidden = function (appId) { return hiddenApps.has(appId); };
  wm.visibleByApp = function (appId) { return wm.byApp(appId).filter(function (w) { return !w.minimized; }); };

  wm.hideApp = function (appId) {
    if (!appId || hiddenApps.has(appId)) return;
    var ws = wm.byApp(appId);
    if (!ws.length) return;
    hiddenApps.add(appId);
    ws.forEach(function (w) { if (!w.minimized) w.el.hidden = true; });
    if (focusedId && wins.get(focusedId) && wins.get(focusedId).appId === appId) {
      focusedId = null;
      var nx = nextVisibleAfter(null);
      if (nx) focusWin(nx, false); else { updateClasses(); setFront('finder'); refreshMenu(); }
    }
  };
  wm.showApp = function (appId, noFocus) {
    if (!hiddenApps.has(appId)) return;
    hiddenApps.delete(appId);
    wm.byApp(appId).forEach(function (w) { if (!w.minimized) w.el.hidden = false; });
    if (!noFocus) {
      var w = wm.lastFocused(appId) || wm.visibleByApp(appId).pop();
      if (w) focusWin(w, true);
    }
  };

  /* the next window of an app comes to the front (taskbar button of an app with several windows) */
  wm.cycle = function (appId) {
    appId = appId || frontApp;
    var ws = wm.visibleByApp(appId).filter(function (w) { return !hiddenApps.has(appId); });
    if (ws.length < 2) return;
    focusWin(ws[0], true);      // the bottom-most window of the app comes to the front
  };

  /* ------------------------------------------------- stage resize rule */
  function reclamp() {
    wins.forEach(function (w) {
      if (w.minimized) return;
      var r;
      if (w.zoomed) r = stage().zoomRect();
      else if (w.snapped && snapRect(w.snapped.layout, w.snapped.zone)) r = clampRect(snapRect(w.snapped.layout, w.snapped.zone), w.minW, w.minH);
      else r = clampRect(w.getRect(), w.minW, w.minH);
      w.el.style.left = r.x + 'px'; w.el.style.top = r.y + 'px'; w.el.style.width = r.w + 'px'; w.el.style.height = r.h + 'px';
      if (w.zoomed) setZoomedUI(w, true);
      w._emit('resize', r);
    });
  }
  LAB.bus.on('stage:resize', reclamp);

  LAB.wm = wm;
})(window.LAB);
