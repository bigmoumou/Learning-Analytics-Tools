/* wm.js [SKIN] — LAB.wm window manager (DESIGN §3.6). All pointer maths go through LAB.stage.toStage. */
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

  var LIGHT_GLYPHS = {
    close: '<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M3.6 3.6l4.8 4.8M8.4 3.6L3.6 8.4" stroke="rgba(60,0,0,.7)" stroke-width="1.3" stroke-linecap="round"/></svg>',
    min: '<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M3 6h6" stroke="rgba(70,45,0,.75)" stroke-width="1.4" stroke-linecap="round"/></svg>',
    zoom: '<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M3.7 8.3V4.4a.7.7 0 0 1 .7-.7h3.9M8.3 3.7v3.9a.7.7 0 0 1-.7.7H3.7" fill="none" stroke="rgba(0,50,0,.7)" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" transform="rotate(0 6 6)"/></svg>'
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
    var y = Math.max(wa.y, Math.min(r.y, wa.y + wa.h - 28));
    return { x: x, y: y, w: w, h: hh };
  }

  wm.spawnRect = function (w, hh, appId) {
    var sa = stage().spawnArea();
    var n = 0;
    if (appId) wins.forEach(function (x) { if (x.appId === appId && !x.closed) n++; });
    var off = (n % 8) * 26;
    var x = sa.x + Math.max(0, (sa.w - w) / 2 - 40) + off;
    var y = sa.y + Math.max(0, (sa.h - hh) / 2 - 20) + off;
    x = Math.max(sa.x, Math.min(x, sa.x + Math.max(0, sa.w - w)));
    y = Math.max(sa.y, Math.min(y, sa.y + Math.max(0, sa.h - hh)));
    // still too wide for the room right of the mission pill (narrow screens): keep the desktop icons clear and start below the pill
    var below = w > sa.w && stage().belowCard ? stage().belowCard() : null;
    if (below !== null) { x = Math.max(24, Math.min(x, stage().w - 130 - w)); y = Math.max(y, below); }
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
    var bar = opts.bar || 'plain';
    var theme = opts.theme || 'light';
    var wa = work();
    var width = Math.max(minW, Math.min(opts.width || 640, wa.w));
    var height = Math.max(minH, Math.min(opts.height || 420, wa.h));
    // a new window wider than the room right of the mission card first gets narrower (never below its minimum width)
    if (opts.x === undefined || opts.y === undefined) width = Math.max(minW, Math.min(width, stage().spawnArea().w));
    var pos = (opts.x === undefined || opts.y === undefined) ? wm.spawnRect(width, height, appId) : { x: opts.x, y: opts.y };
    // a new window stops above the Dock: when it starts low (below the mission pill) it gets shorter rather than reaching behind it
    if ((opts.x === undefined || opts.y === undefined) && stage().dockTop) height = Math.max(minH, Math.min(height, stage().dockTop() - 8 - pos.y));
    var rect = clampRect({ x: pos.x, y: pos.y, w: width, h: height }, minW, minH);

    var id = LAB.util.uid('w');
    var titleEl = h('div', { class: 'lab-win-title', dataset: { drag: '1' } }, opts.title || '');
    var tools = h('div', { class: 'lab-win-tools', dataset: { drag: '1' } });
    if (opts.toolbar) tools.appendChild(opts.toolbar);
    var btnClose = h('button', { type: 'button', class: 'lab-tl-btn lab-tl-close', 'aria-label': '關閉視窗', dataset: { lab: 'tl-close' } });
    var btnMin = h('button', { type: 'button', class: 'lab-tl-btn lab-tl-min', 'aria-label': '最小化', dataset: { lab: 'tl-min' } });
    var btnZoom = h('button', { type: 'button', class: 'lab-tl-btn lab-tl-zoom', 'aria-label': '縮放', dataset: { lab: 'tl-zoom' } });
    btnClose.innerHTML = LIGHT_GLYPHS.close; btnMin.innerHTML = LIGHT_GLYPHS.min; btnZoom.innerHTML = LIGHT_GLYPHS.zoom;   // static strings
    if (opts.resizable === false) { btnZoom.disabled = true; }
    var barEl = h('div', { class: 'lab-win-bar', dataset: { drag: '1' } },
      h('div', { class: 'lab-tl' }, btnClose, btnMin, btnZoom), titleEl, tools);
    var body = h('div', { class: 'lab-win-body' });
    if (opts.content) body.appendChild(opts.content);
    var el = h('div', {
      class: 'lab-win bar-' + bar + ' theme-' + theme + ' is-inactive',
      role: 'group', 'aria-label': opts.title || appId,
      dataset: { lab: 'win', app: appId, win: id }
    }, barEl, body);
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
      id: id, appId: appId, el: el, body: body, titleEl: titleEl, toolsEl: tools, state: {}, singleton: opts.singleton || null,
      minW: minW, minH: minH, bar: bar, theme: theme, icon: opts.icon || null,
      z: 0, minimized: false, zoomed: false, closed: false, prevRect: null, onCloseCb: opts.onClose || null,
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
    var bar = el.querySelector('.lab-win-bar');
    bar.addEventListener('dblclick', function (e) {
      if (e.target.closest('button, input, textarea, select, a')) return;
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
    var moved = false, dx = 0, dy = 0, pending = null, rafId = 0, pid = e.pointerId;
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
        win.el.style.willChange = 'transform';
        document.body.classList.add('lab-dragging-win');
      }
      var nx = Math.max(-(r0.w - 40), Math.min(r0.x + ndx, wa.w - 40));
      var ny = Math.max(wa.y, Math.min(r0.y + ndy, wa.y + wa.h - 28));
      dx = nx - r0.x; dy = ny - r0.y;
      win.el.style.transform = 'translate3d(' + dx + 'px,' + dy + 'px,0)';
    }
    function move(ev) {
      if (ev.pointerId !== pid) return;
      pending = stage().toStage(ev.clientX, ev.clientY);
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
        win.zoomed = false;
        win._emit('move', win.getRect());
        LAB.bus.emit('win:move', { id: win.id, appId: win.appId, rect: win.getRect() });
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
      win.zoomed = false;
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

  function zoomWin(win) {
    if (win.closed || win.el.querySelector('.lab-rz') === null) return;
    if (!reduced()) {
      win.el.classList.add('is-animating');
      setTimeout(function () { win.el.classList.remove('is-animating'); }, 230);
    }
    if (win.zoomed && win.prevRect) {
      var r = win.prevRect;
      win.prevRect = null; win.zoomed = false;
      win.el.style.left = r.x + 'px'; win.el.style.top = r.y + 'px'; win.el.style.width = r.w + 'px'; win.el.style.height = r.h + 'px';
    } else {
      win.prevRect = win.getRect();
      var z = stage().zoomRect();
      win.zoomed = true;
      win.el.style.left = z.x + 'px'; win.el.style.top = z.y + 'px'; win.el.style.width = z.w + 'px'; win.el.style.height = z.h + 'px';
    }
    win._emit('resize', win.getRect());
    win._emit('zoom', win.zoomed);
    LAB.bus.emit('win:zoom', { id: win.id, appId: win.appId, zoomed: win.zoomed });
    LAB.bus.emit('win:resize', { id: win.id, appId: win.appId, rect: win.getRect() });
  }
  wm.zoom = function (id) { var w = wins.get(id); if (w) zoomWin(w); };

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
      else r = clampRect(w.getRect(), w.minW, w.minH);
      w.el.style.left = r.x + 'px'; w.el.style.top = r.y + 'px'; w.el.style.width = r.w + 'px'; w.el.style.height = r.h + 'px';
      w._emit('resize', r);
    });
  }
  LAB.bus.on('stage:resize', reclamp);

  LAB.wm = wm;
})(window.LAB);
