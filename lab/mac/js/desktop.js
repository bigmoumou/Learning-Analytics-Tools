/* desktop.js [SKIN] — stage scaling, rail layout, wallpaper, menu-bar right side, desktop icons, Dock, Spotlight,
   phone notice, performance mode (DESIGN §2). */
(function (LAB) {
  'use strict';

  var h = LAB.util.h;
  var HOME = '/Users/an';
  var DESKTOP = HOME + '/Desktop';

  var rootEl, screenEl, stageEl, wallEl, desktopEl, windowsEl, menubarEl, dockEl, overlaysEl, modalRoot;

  function reduced() {
    try { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  }
  function sget(k) { try { return window.sessionStorage.getItem(k); } catch (e) { return null; } }
  function sset(k, v) { try { window.sessionStorage.setItem(k, v); } catch (e) { /* ignore */ } }

  /* ======================================================== stage (§2.1) */
  var stage = LAB.stage = {
    w: 1024, h: 640, scale: 1, menubarH: 28, dockH: 76, iconColW: 110, availW: 1024, availH: 640, minScale: 0.25
  };
  stage.toStage = function (cx, cy) {
    var r = stageEl.getBoundingClientRect();
    return { x: (cx - r.left) / stage.scale, y: (cy - r.top) / stage.scale };
  };
  stage.rectOf = function (el) {
    var r = el.getBoundingClientRect(), sr = stageEl.getBoundingClientRect(), s = stage.scale;
    return { x: (r.left - sr.left) / s, y: (r.top - sr.top) / s, w: r.width / s, h: r.height / s };
  };
  stage.workArea = function () { return { x: 0, y: stage.menubarH, w: stage.w, h: stage.h - stage.menubarH }; };
  stage.spawnArea = function () { return { x: 24, y: 44, w: stage.w - 24 - 130, h: stage.h - 44 - stage.dockH - 12 }; };
  stage.zoomRect = function () { return { x: 0, y: stage.menubarH, w: stage.w, h: stage.h - stage.menubarH - 84 }; };

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
    if (s < 1) {
      stageEl.style.width = w + 'px'; stageEl.style.height = hh + 'px';
      stageEl.style.transform = 'scale(' + s + ')'; stageEl.style.transformOrigin = '0 0';
    } else {
      stageEl.style.width = '100%'; stageEl.style.height = '100%';
      stageEl.style.transform = 'none';
    }
    if (changed) LAB.bus.emit('stage:resize', { w: stage.w, h: stage.h, scale: stage.scale });
  }

  /* ===================================================== rail layout (§2.1) */
  var drawerOpen = false;
  var appliedMode = null;
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
    /* the 「全螢幕」 control lives in the rail (it is a web-page control, not part of the fake Mac) */
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
    }
  };

  /* ================================================== performance (§2.10) */
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

  /* ======================================================== wallpaper (§2.5) */
  var wallTimer = null;
  function drawWall() {
    if (!wallEl) return;
    try {
      var W = Math.max(64, Math.round(stage.w)), H = Math.max(64, Math.round(stage.h));
      var qw = Math.max(16, Math.ceil(W / 2)), qh = Math.max(16, Math.ceil(H / 2));
      var art = document.createElement('canvas');
      art.width = qw; art.height = qh;
      var c = art.getContext('2d');
      c.scale(qw / 1920, qh / 1080);
      var RW = 1920, RH = 1080;
      var g = c.createLinearGradient(0, RH, RW, 0);
      g.addColorStop(0, '#041a1c'); g.addColorStop(0.45, '#0a3236'); g.addColorStop(1, '#16382c');
      c.fillStyle = g; c.fillRect(0, 0, RW, RH);
      // silk ribbons: wavy bands, feathered by stacking layers (no ctx.filter)
      function band(yL, yR, amp, f, ph, th, cols, alpha, op) {
        var L = 14;
        c.save();
        c.globalCompositeOperation = op || 'screen';
        for (var j = 0; j < L; j++) {
          var half = (th / 2) * (j + 1) / L;
          var gr = c.createLinearGradient(0, yL, RW, yR);
          cols.forEach(function (col, i) { gr.addColorStop(i / (cols.length - 1), col); });
          c.fillStyle = gr; c.globalAlpha = alpha / L * 1.15;
          c.beginPath();
          var x;
          for (x = -80; x <= RW + 80; x += 8) {
            var mid = yL + (yR - yL) * (x / RW) + amp * Math.sin(x * f + ph);
            var hh = half * (0.7 + 0.3 * Math.sin(x * f * 0.8 + ph * 1.3));
            if (x === -80) c.moveTo(x, mid - hh); else c.lineTo(x, mid - hh);
          }
          for (x = RW + 80; x >= -80; x -= 8) {
            var mid2 = yL + (yR - yL) * (x / RW) + amp * Math.sin(x * f + ph);
            var hh2 = half * (0.7 + 0.3 * Math.sin(x * f * 0.8 + ph * 1.3));
            c.lineTo(x, mid2 + hh2);
          }
          c.closePath(); c.fill();
        }
        c.restore();
      }
      band(1050, 330, 90, 0.0024, 0.6, 700, ['#0b3c49', '#0f6b6b', '#1f8a70', '#4d9a4a'], 0.9);
      band(930, 190, 70, 0.0027, 1.9, 380, ['#128c8c', '#2fb09a', '#7bc47f', '#e0b45a', '#ffb35a'], 0.8);
      band(880, 90, 55, 0.0031, 3.1, 190, ['#6fe0cf', '#9fe3b0', '#f3e3a0', '#ffd2a0', '#ffbf8a'], 0.65);
      band(850, 40, 40, 0.0034, 4.4, 70, ['#d5fff2', '#fff2d0', '#fff0e6'], 0.4);
      band(1250, 560, 110, 0.0019, 5.6, 520, ['#021214', '#06282b', '#0b2f26', '#10261f'], 0.85, 'source-over');
      // calm areas: bottom strip (dock), right icon column, soft vignette
      var gb = c.createLinearGradient(0, 780, 0, RH);
      gb.addColorStop(0, 'rgba(5,7,18,0)'); gb.addColorStop(1, 'rgba(5,7,18,.6)');
      c.fillStyle = gb; c.fillRect(0, 780, RW, RH - 780);
      var gr2 = c.createLinearGradient(RW - 240, 0, RW, 0);
      gr2.addColorStop(0, 'rgba(6,8,22,0)'); gr2.addColorStop(1, 'rgba(6,8,22,.5)');
      c.fillStyle = gr2; c.fillRect(RW - 240, 0, 240, RH);
      var vg = c.createRadialGradient(RW * 0.55, RH * 0.45, 500, RW * 0.55, RH * 0.45, 1300);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.45)');
      c.fillStyle = vg; c.fillRect(0, 0, RW, RH);

      // final canvas at HALF resolution: upscaled art + seeded grain (±3 per channel)
      var hw = Math.ceil(W / 2), hh3 = Math.ceil(H / 2);
      wallEl.width = hw; wallEl.height = hh3;
      var fc = wallEl.getContext('2d', { willReadFrequently: true });
      fc.imageSmoothingEnabled = true;
      try { fc.imageSmoothingQuality = 'high'; } catch (e0) { /* ignore */ }
      fc.drawImage(art, 0, 0, hw, hh3);
      var im = fc.getImageData(0, 0, hw, hh3), d = im.data;
      var seed = 20261004;
      for (var i = 0; i < d.length; i += 4) {
        seed = (seed * 16807) % 2147483647;
        var n = Math.round(((seed - 1) / 2147483646 - 0.5) * 3);
        d[i] += n; d[i + 1] += n; d[i + 2] += n;
      }
      fc.putImageData(im, 0, 0);
    } catch (e) {
      console.warn('[desktop] wallpaper failed', e);
      if (wallEl) wallEl.style.background = 'linear-gradient(135deg,#0a0f2e,#16205a 55%,#2a1a5e)';
    }
  }

  /* ===================================================== pop-overs (menu bar) */
  var popEl = null, popOff = null, popBtn = null;
  function closePopover() {
    if (popEl && popEl.parentNode) popEl.parentNode.removeChild(popEl);
    popEl = null;
    if (popOff) { popOff(); popOff = null; }
    if (popBtn) { popBtn.setAttribute('aria-expanded', 'false'); popBtn.classList.remove('is-open'); popBtn = null; }
    window.removeEventListener('pointerdown', onPopDown, true);
  }
  function onPopDown(e) {
    if (popEl && !popEl.contains(e.target) && !(popBtn && popBtn.contains(e.target))) closePopover();
  }
  function openPopover(btn, node, widthPx) {
    if (popBtn === btn) { closePopover(); return; }
    closePopover();
    if (LAB.menu) LAB.menu.closeAll();
    popBtn = btn;
    btn.setAttribute('aria-expanded', 'true'); btn.classList.add('is-open');
    popEl = h('div', { class: 'lab-popover', role: 'dialog' }, node);
    overlaysEl.appendChild(popEl);
    var r = stage.rectOf(btn);
    var w = widthPx || 260;
    popEl.style.width = w + 'px';
    popEl.style.left = Math.max(6, Math.min(r.x + r.w - w + 6, stage.w - w - 6)) + 'px';
    popEl.style.top = (stage.menubarH + 4) + 'px';
    popOff = LAB.keys.modal(function (e) { if (e.key === 'Escape') { closePopover(); return true; } return false; });
    window.addEventListener('pointerdown', onPopDown, true);
  }

  /* ================================================ menu bar right side (§2.2) */
  var clockEl = null, imeBtn = null, imeAbc = true;
  function updateClock() { if (clockEl) clockEl.textContent = LAB.util.fmt.clockMenubar(LAB.clock.now()); }

  function buildMenubar() {
    menubarEl.textContent = '';
    menubarEl.setAttribute('data-lab', 'menubar');
    var left = h('div', { class: 'lab-mb-left' });
    var right = h('div', { class: 'lab-mb-right' });
    menubarEl.appendChild(left);
    menubarEl.appendChild(right);

    imeBtn = h('button', { type: 'button', class: 'lab-mb-btn lab-mb-ime', 'aria-label': '輸入法', title: '輸入法' }, 'ABC');
    imeBtn.addEventListener('click', function () {
      imeAbc = !imeAbc;
      imeBtn.textContent = imeAbc ? 'ABC' : '注';
      LAB.ui.toast('提醒：在終端機輸入指令前，輸入法要用英文（ABC）');
    });
    function glyph(name, label) {
      var b = h('button', { type: 'button', class: 'lab-mb-btn', 'aria-label': label, tabindex: '-1' });
      b.innerHTML = LAB.icons.get(name, { size: 16 });
      return b;
    }
    var wifi = glyph('wifi', 'Wi-Fi');
    var batt = glyph('battery', '電池');
    var spot = h('button', { type: 'button', class: 'lab-mb-btn', 'aria-label': 'Spotlight 搜尋', dataset: { lab: 'spotlight-button' } });
    spot.innerHTML = LAB.icons.get('search', { size: 15 });
    spot.addEventListener('click', function (e) { e.stopPropagation(); LAB.desktop.toggleSpotlight(); });
    var cc = h('button', { type: 'button', class: 'lab-mb-btn', 'aria-label': '控制中心', 'aria-haspopup': 'dialog', 'aria-expanded': 'false' });
    cc.innerHTML = LAB.icons.get('control-center', { size: 16 });
    cc.addEventListener('click', function (e) {
      e.stopPropagation();
      var body = h('div', { class: 'lab-cc' },
        h('div', { class: 'lab-cc-row' }, h('label', null, '顯示器'), h('input', { type: 'range', min: '0', max: '100', value: '70', 'aria-label': '顯示器亮度' })),
        h('div', { class: 'lab-cc-row' }, h('label', null, '音量'), h('input', { type: 'range', min: '0', max: '100', value: '40', 'aria-label': '音量' })),
        h('div', { class: 'lab-cc-note' }, '這個面板只是外觀，不會真的調整任何東西。'));
      openPopover(cc, body, 270);
    });
    clockEl = h('button', { type: 'button', class: 'lab-mb-btn lab-mb-clock', 'aria-haspopup': 'dialog', 'aria-expanded': 'false', dataset: { lab: 'clock' } });
    clockEl.addEventListener('click', function (e) {
      e.stopPropagation();
      openPopover(clockEl, h('div', { class: 'lab-cc' }, h('div', { class: 'lab-cc-note' }, '沒有通知')), 220);
    });
    [imeBtn, wifi, batt, spot, cc, clockEl].forEach(function (b) { right.appendChild(b); });
    updateClock();
    setInterval(updateClock, 15000);
    LAB.menu.mount(left);
  }

  /* ============================================================ file moves */
  /* Shared by the desktop, the Dock and (indirectly) others: move or copy `paths` into `destDir`, asking on name collisions. */
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
          title: '已經有一個名稱為「' + st.name + '」的項目存在於此位置。您要用正在移動的項目取代它嗎？',
          buttons: [
            { label: '保留兩者', value: 'both' },
            { label: '停止', value: 'stop', cancel: true },
            { label: '取代', value: 'replace', 'default': true }
          ]
        }).then(function (v) {
          if (v === 'stop' || v === null) { i = paths.length; return; }
          if (v === 'both') {
            var ext = st.type === 'file' ? vfs.extname(st.name) : '';
            var base = ext ? st.name.slice(0, st.name.length - ext.length) : st.name;
            doIt(vfs.join(destDir, vfs.uniqueName(destDir, base, ext)), false);
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
  LAB.desktop = LAB.desktop || {};
  LAB.desktop.transfer = transfer;

  /* ==================================================== desktop icons (§2.6) */
  var icons = new Map();            // path -> {el, st}
  var selected = new Set();
  var renaming = null;              // path currently in the inline editor
  var iconPos = new Map();          // path -> {x,y}
  var renderTimer = null;
  var rubber = null;

  function setSelected(paths, silent) {
    var next = new Set(paths);
    var same = next.size === selected.size;
    if (same) next.forEach(function (p) { if (!selected.has(p)) same = false; });
    selected = next;
    icons.forEach(function (rec, p) { rec.el.classList.toggle('is-sel', selected.has(p)); rec.el.setAttribute('aria-selected', selected.has(p) ? 'true' : 'false'); });
    updateKey();
    if (!same && !silent) LAB.bus.emit('desktop:select', { paths: Array.from(selected) });
  }

  function cellRows() {
    var top = 56;
    return Math.max(1, Math.floor((stage.h - top - 12) / 100));
  }
  function positionIcons(list) {
    var rows = cellRows();
    list.forEach(function (st, idx) {
      var col = Math.floor(idx / rows), row = idx % rows;
      var x = stage.w - 14 - 96 - col * 100, y = 56 + row * 100;
      iconPos.set(st.path, { x: x, y: y });
      var rec = icons.get(st.path);
      if (rec) { rec.el.style.left = x + 'px'; rec.el.style.top = y + 'px'; }
    });
  }

  function updateKey() {
    if (!desktopEl) return;
    desktopEl.classList.toggle('is-key', !LAB.wm.focused());
  }
  function renderIcons() {
    var list = [];
    try { list = LAB.vfs.visible(LAB.vfs.list(DESKTOP)); } catch (e) { list = []; }
    var seen = new Set();
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
        if (rec.icon !== ic) { rec.icon = ic; rec.el.querySelector('.lab-dicon-img').innerHTML = LAB.icons.get(ic, { size: 64 }); }
      }
    });
    icons.forEach(function (rec, p) {
      if (!seen.has(p) && renaming !== p) {
        if (rec.el.parentNode) rec.el.parentNode.removeChild(rec.el);
        icons.delete(p); iconPos.delete(p); selected.delete(p);
        if (rec.dispose) rec.dispose();
      }
    });
    positionIcons(list.filter(function (s) { return icons.has(s.path); }));
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
  var pendingFlush = false;
  function flushAfterDrag() { if (pendingFlush) { pendingFlush = false; renderIcons(); } }

  function labelFor(st) { return st.name; }

  function makeIcon(st) {
    var iconName = LAB.icons.forNode(st);
    var imgBox = h('div', { class: 'lab-dicon-img' });
    imgBox.innerHTML = LAB.icons.get(iconName, { size: 64 });     // static icon markup only
    var label = h('div', { class: 'lab-dicon-label' }, labelFor(st));
    var el = h('div', {
      class: 'lab-dicon', role: 'button', tabindex: '-1', 'aria-selected': 'false', 'aria-label': st.name,
      dataset: { lab: 'desktop-icon', path: st.path }
    }, imgBox, label);
    var rec = { el: el, st: st, icon: iconName, dispose: null };
    var offs = [];

    function path() { return rec.st.path; }
    offs.push(LAB.dnd.source(el, function () {
      var p = path();
      var paths = selected.has(p) ? Array.from(selected) : [p];
      return { kind: 'fs', paths: paths, from: 'desktop', label: paths.length > 1 ? paths.length + ' 個項目' : rec.st.name, iconName: LAB.icons.forNode(rec.st) };
    }, {
      onPressSelect: function (e) {
        var p = path();
        LAB.wm.focusDesktop();
        if (e.metaKey || e.ctrlKey || e.shiftKey) {
          var n = new Set(selected);
          if (n.has(p)) n.delete(p); else n.add(p);
          setSelected(Array.from(n));
        } else if (!selected.has(p)) setSelected([p]);
      },
      onClickSelect: function (e) {
        if (e.metaKey || e.ctrlKey || e.shiftKey) return;
        setSelected([path()]);
      }
    }));
    el.addEventListener('dblclick', function (e) {
      e.stopPropagation();
      LAB.apps.openPath(path(), { via: 'desktop' });
    });
    // folder icons accept drops (move into the folder)
    if (st.type === 'dir') {
      offs.push(LAB.dnd.target(el, {
        id: 'desktop:folder:' + st.path,
        accept: function (pl, mods) {
          if (pl.kind !== 'fs') return false;
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

  /* ---- rename ---- */
  function baseLen(name, isDir) {
    if (isDir) return name.length;
    var i = name.lastIndexOf('.');
    return i > 0 ? i : name.length;
  }
  function startRename(path) {
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
          var oldPathR = rec.st.path, oldNameR = rec.st.name;
          var np = LAB.vfs.rename(rec.st.path, val, { by: 'desktop' });
          LAB.undo.push('重新命名「' + oldNameR + '」', function () { LAB.vfs.rename(np, oldNameR, { by: 'desktop' }); });
          icons.delete(rec.st.path); iconPos.delete(rec.st.path);
          rec.st = LAB.vfs.stat(np) || rec.st;
          rec.el.dataset.path = np;
          icons.set(np, rec);
          selected = new Set([np]);
        } catch (e) {
          if (e.code === 'EEXIST') LAB.ui.alert(null, { title: '已經有一個名稱為「' + val + '」的項目存在於此位置。', buttons: [{ label: '好', value: true, 'default': true }] });
          else LAB.ui.vfsFail(null, e, '這個名稱不能用（' + LAB.vfs.errText(e.code) + '）', rec.st.path);
        }
      }
      renderIcons();
    }
    input.addEventListener('keydown', function (e) {
      e.stopPropagation();
      if (LAB.ui.isImeEnter(e)) return;
      if (e.key === 'Enter') { e.preventDefault(); finish(true); }
      else if (e.key === 'Escape') { e.preventDefault(); finish(false); }
    });
    input.addEventListener('blur', function () { finish(true); });
    input.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
  }
  LAB.desktop.startRename = startRename;
  LAB.desktop.selected = function () { return Array.from(selected); };
  LAB.desktop.refreshIcons = renderIcons;

  function newFolderOnDesktop() {
    var name = LAB.vfs.uniqueName(DESKTOP, '未命名檔案夾');
    var p = LAB.vfs.join(DESKTOP, name);
    try { LAB.vfs.mkdir(p, { by: 'desktop' }); } catch (e) { LAB.ui.vfsFail(null, e, '無法新增檔案夾', p); return; }
    startRename(p);
  }

  function itemMenu(path, x, y) {
    var st = LAB.vfs.stat(path);
    if (!st) return;
    var multi = selected.size > 1 && selected.has(path);
    var name = st.name;
    var ow = LAB.apps.openWith(path);
    var items = [
      { label: '打開', action: function () { LAB.apps.openPath(path, { via: 'desktop' }); } },
      { label: '打開方式', enabled: ow.length > 0, submenu: ow.map(function (o) { return { label: o.label, action: function () { LAB.apps.openPath(path, { appId: o.appId, via: 'desktop' }); } }; }) },
      { separator: true },
      { label: '移到垃圾桶', shortcut: '⌘⌫', action: function () { trashSelection(multi ? Array.from(selected) : [path]); } },
      { label: '取得資訊', enabled: false },
      { label: '重新命名', action: function () { startRename(path); } },
      { label: '壓縮「' + name + '」', enabled: false },
      { label: '複製', action: function () {
        (multi ? Array.from(selected) : [path]).forEach(function (p) {
          var s2 = LAB.vfs.stat(p); if (!s2) return;
          var ext = s2.type === 'file' ? LAB.vfs.extname(s2.name) : '';
          var base = ext ? s2.name.slice(0, s2.name.length - ext.length) : s2.name;
          try { LAB.vfs.copy(p, LAB.vfs.join(DESKTOP, LAB.vfs.uniqueName(DESKTOP, base + ' 拷貝', ext)), { by: 'desktop', recursive: true }); } catch (e) { LAB.ui.toast('無法複製'); }
        });
      } },
      { separator: true },
      { label: '拷貝「' + name + '」', enabled: false },
      { label: '將「' + name + '」拷貝為路徑名稱', action: function () { LAB.clipboard.setText(st.path); } }
    ];
    LAB.menu.contextMenu(x, y, items);
  }
  function emptyMenu(x, y) {
    LAB.menu.contextMenu(x, y, [
      { label: '新增檔案夾', action: newFolderOnDesktop },
      { separator: true },
      { label: '取得資訊', enabled: false },
      { label: '更改桌面背景⋯', enabled: false },
      { label: '排序方式', enabled: false, submenu: [{ label: '名稱' }] }
    ]);
  }
  function trashSelection(paths) {
    var done = [];
    paths.forEach(function (p) {
      try { done.push({ name: LAB.vfs.basename(p), dest: LAB.vfs.trash(p, { by: 'desktop' }) }); }
      catch (e) { LAB.ui.vfsFail(null, e, '無法移到垃圾桶', p); }
    });
    if (done.length) {
      LAB.undo.push('移到垃圾桶「' + done[0].name + '」' + (done.length > 1 ? '等 ' + done.length + ' 個項目' : ''), function () {
        done.forEach(function (d) { try { LAB.vfs.putBack(d.dest, { by: 'desktop' }); } catch (e) { /* already gone */ } });
      });
    }
    setSelected([]);
    renderIcons();
  }

  function setupDesktop() {
    // fs changes
    LAB.bus.on('fs:change', function () { scheduleRender(); });
    LAB.bus.on('dnd:drop', flushAfterDrag);
    LAB.bus.on('dnd:cancel', flushAfterDrag);
    LAB.bus.on('stage:resize', function () { renderIcons(); });
    ['win:focus', 'win:close', 'win:minimize', 'win:restore', 'app:frontmost'].forEach(function (n) { LAB.bus.on(n, updateKey); });
    updateKey();

    // empty desktop: pointerdown deselects, Finder becomes frontmost, rubber band
    desktopEl.addEventListener('pointerdown', function (e) {
      if (e.target !== desktopEl || e.button !== 0) return;
      LAB.wm.focusDesktop();
      if (!(e.metaKey || e.ctrlKey || e.shiftKey)) setSelected([]);
      if (LAB.menu) LAB.menu.closeAll();
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

    // desktop is a drop target: files from a Finder window are moved into ~/Desktop (⌥ = copy)
    LAB.dnd.target(desktopEl, {
      id: 'desktop',
      accept: function (pl, mods) {
        if (pl.kind !== 'fs') return false;
        if (pl.from === 'desktop') return false;
        for (var i = 0; i < pl.paths.length; i++) { if (LAB.vfs.same(LAB.vfs.dirname(pl.paths[i]), DESKTOP) && !(mods.altKey || mods.mode === 'copy')) return false; }
        return mods.altKey || mods.mode === 'copy' ? 'copy' : 'move';
      },
      drop: function (pl, ctx) { transfer(pl.paths, DESKTOP, ctx.mode === 'copy' ? 'copy' : 'move', 'desktop'); }
    });

    // keyboard (Return, ⌘↓, ⌘⌫) while Finder has no focused window
    LAB.keys.on('enter', function () {
      if (LAB.wm.focused() || renaming || selected.size !== 1) return false;
      startRename(Array.from(selected)[0]);
    }, { scope: 'finder' });
    LAB.keys.on('mod+arrowdown', function () {
      if (LAB.wm.focused() || renaming || !selected.size) return false;
      Array.from(selected).forEach(function (p) { LAB.apps.openPath(p, { via: 'desktop' }); });
    }, { scope: 'finder' });
    LAB.keys.on('mod+backspace', function () {
      if (LAB.wm.focused() || renaming || !selected.size) return false;
      trashSelection(Array.from(selected));
    }, { scope: 'finder' });

    renderIcons();
  }

  function startRubber(e0) {
    var start = LAB.stage.toStage(e0.clientX, e0.clientY);
    var pid = e0.pointerId;
    var band = null;
    var base = (e0.metaKey || e0.ctrlKey || e0.shiftKey) ? new Set(selected) : new Set();
    function move(ev) {
      if (ev.pointerId !== pid) return;
      var p = LAB.stage.toStage(ev.clientX, ev.clientY);
      if (!band) {
        if (Math.abs(p.x - start.x) < 4 && Math.abs(p.y - start.y) < 4) return;
        band = h('div', { class: 'lab-rubber' });
        desktopEl.appendChild(band);
      }
      var x = Math.min(start.x, p.x), y = Math.min(start.y, p.y), w = Math.abs(p.x - start.x), hh = Math.abs(p.y - start.y);
      band.style.left = x + 'px'; band.style.top = y + 'px'; band.style.width = w + 'px'; band.style.height = hh + 'px';
      var hit = new Set(base);
      iconPos.forEach(function (pos, path) {
        if (!icons.has(path)) return;
        if (pos.x < x + w && pos.x + 96 > x && pos.y < y + hh && pos.y + 100 > y) hit.add(path);
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

  /* ============================================================ Dock (§2.7) */
  var DOCK_ORDER = ['finder', 'terminal', 'codex', 'code', 'textedit'];
  var dockApps, dockMini, dockTrash, dockDownloads, dockBar;
  var appItems = new Map();      // appId -> {btn, iconBox, off[]}
  var trashBtn, trashIconBox, downloadsBtn;

  function dockItemFor(id) {
    var def = LAB.apps.get(id);
    var iconBox = h('span', { class: 'lab-dock-icon' });
    iconBox.innerHTML = LAB.icons.get(def.icon, { size: 52 });
    var btn = h('button', {
      type: 'button', class: 'lab-dock-item', role: 'button', 'aria-label': def.title,
      dataset: { lab: 'dock-item', app: id }
    }, h('span', { class: 'lab-dock-label' }, def.title), iconBox, h('span', { class: 'lab-dock-dot' }));
    return { btn: btn, iconBox: iconBox };
  }

  function buildAppItems() {
    var ids = [];
    var all = LAB.apps.all().filter(function (d) { return d.dock; }).map(function (d) { return d.id; });
    DOCK_ORDER.forEach(function (id) { if (all.indexOf(id) >= 0) ids.push(id); });
    all.forEach(function (id) { if (ids.indexOf(id) < 0) ids.push(id); });
    // drop items for apps that no longer exist
    appItems.forEach(function (rec, id) {
      if (ids.indexOf(id) < 0) { rec.off.forEach(function (f) { f(); }); if (rec.btn.parentNode) rec.btn.parentNode.removeChild(rec.btn); appItems.delete(id); }
    });
    ids.forEach(function (id) {
      var def = LAB.apps.get(id);
      var rec = appItems.get(id);
      if (rec) {
        rec.iconBox.innerHTML = LAB.icons.get(def.icon, { size: 52 });
        rec.btn.setAttribute('aria-label', def.title);
        rec.btn.querySelector('.lab-dock-label').textContent = def.title;
      } else {
        var d = dockItemFor(id);
        rec = { btn: d.btn, iconBox: d.iconBox, off: [] };
        appItems.set(id, rec);
        wireAppItem(id, rec);
      }
      dockApps.appendChild(rec.btn);     // keeps/sets the order
      rec.btn.classList.toggle('is-running', LAB.apps.isRunning(id));
    });
  }

  function wireAppItem(id, rec) {
    rec.btn.addEventListener('click', function () { LAB.apps.launch(id, undefined, { bounce: true }); });
    rec.btn.addEventListener('contextmenu', function (e) {
      e.preventDefault();
      var def = LAB.apps.get(id);
      var p = LAB.stage.toStage(e.clientX, e.clientY);
      var ws = LAB.wm.byApp(id);
      var items = [{ label: def.title, enabled: false }];
      if (ws.length) { items.push({ separator: true }); ws.slice().reverse().forEach(function (w) { items.push({ label: w.getTitle() || '（未命名）', action: function () { w.focus(); } }); }); }
      items.push({ separator: true });
      items.push({ label: '選項', enabled: false, submenu: [{ label: '（練習版）' }] });
      items.push({ label: '在 Finder 中顯示', enabled: false });
      if (LAB.apps.isRunning(id)) {
        items.push({ separator: true });
        items.push({ label: '隱藏', action: function () { LAB.wm.hideApp(id); } });
        if (id !== 'finder') items.push({ label: '結束', action: function () { LAB.apps.quit(id); } });
      }
      if ((id === 'finder' || id === 'terminal') && def.open) {
        items.push({ separator: true });
        items.push({ label: '新增視窗', action: function () { def.open({}); } });
      }
      LAB.menu.contextMenu(p.x, p.y - 8, items);
    });
    // a file or folder dropped on an app icon
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

  function updateTrashIcon() {
    var full = false;
    try { full = LAB.vfs.list(HOME + '/.Trash').length > 0; } catch (e) { full = false; }
    trashIconBox.innerHTML = LAB.icons.get(full ? 'app-trash-full' : 'app-trash-empty', { size: 52 });
    trashBtn.dataset.full = full ? '1' : '0';
  }

  function confirmEmptyTrash() {
    return LAB.ui.confirm(null, { title: '確定要永久清除垃圾桶中的項目嗎？您無法復原此動作。', ok: '清倒垃圾桶', cancel: '取消' })
      .then(function (ok) { if (ok) { LAB.vfs.emptyTrash({ by: 'dock' }); updateTrashIcon(); } });
  }
  LAB.desktop.confirmEmptyTrash = confirmEmptyTrash;

  var miniThumbs = new Map();   // winId -> button
  var MAX_THUMBS = 6;           // more minimized windows than this collapse into a 「+N」 stack, so the app icons never leave the screen
  var moreBtn = null;
  function layoutThumbs() {
    var ids = Array.from(miniThumbs.keys());
    var hidden = ids.slice(0, Math.max(0, ids.length - MAX_THUMBS));
    ids.forEach(function (id) { miniThumbs.get(id).hidden = hidden.indexOf(id) >= 0; });
    if (!hidden.length) { if (moreBtn && moreBtn.parentNode) moreBtn.parentNode.removeChild(moreBtn); return; }
    if (!moreBtn) {
      moreBtn = h('button', { type: 'button', class: 'lab-dock-item lab-dock-more', role: 'button', 'aria-label': '其他已最小化的視窗', dataset: { lab: 'dock-more' } },
        h('span', { class: 'lab-dock-label' }, '其他已最小化的視窗'), h('span', { class: 'lab-thumb-win lab-thumb-more' }, ''));
      moreBtn.addEventListener('click', function (e) {
        var hid = Array.from(miniThumbs.keys()).slice(0, Math.max(0, miniThumbs.size - MAX_THUMBS));
        var pt = LAB.stage.toStage(e.clientX, e.clientY);
        LAB.menu.contextMenu(pt.x, pt.y - 8, hid.map(function (id) {
          var ww = LAB.wm.get(id);
          return { label: ww ? (ww.getTitle() || '（未命名）') : '（已關閉）', action: function () { var w2 = LAB.wm.get(id); if (w2) w2.restore(); } };
        }));
      });
    }
    moreBtn.querySelector('.lab-thumb-more').textContent = '+' + hidden.length;
    dockMini.insertBefore(moreBtn, dockMini.firstChild);
  }
  function addThumb(winId) {
    var w = LAB.wm.get(winId);
    if (!w || miniThumbs.has(winId)) return;
    var def = LAB.apps.get(w.appId);
    var badge = h('span', { class: 'lab-thumb-badge' });
    badge.innerHTML = LAB.icons.get(def ? def.icon : 'unknown', { size: 22 });
    var dark = !!(w.el && w.el.classList.contains('theme-dark'));
    // a shrunken sketch of the window: its own bar colour and three lines of "content"
    var thumb = h('span', { class: 'lab-thumb-win' + (dark ? ' is-dark' : '') }, h('span', { class: 'lab-thumb-bar' }),
      h('span', { class: 'lab-thumb-line' }), h('span', { class: 'lab-thumb-line is-short' }), h('span', { class: 'lab-thumb-line' }));
    var b = h('button', {
      type: 'button', class: 'lab-dock-item lab-dock-thumb', role: 'button', 'aria-label': w.getTitle() + '（已最小化）',
      dataset: { lab: 'dock-thumb', win: winId, app: w.appId }
    }, h('span', { class: 'lab-dock-label' }, w.getTitle()), thumb, badge);
    b.addEventListener('click', function () { var ww = LAB.wm.get(winId); if (ww) ww.restore(); });
    miniThumbs.set(winId, b);
    dockMini.appendChild(b);
    layoutThumbs();
  }
  function removeThumb(winId) {
    var b = miniThumbs.get(winId);
    if (b && b.parentNode) b.parentNode.removeChild(b);
    miniThumbs.delete(winId);
    layoutThumbs();
  }

  function setupDock() {
    dockEl.textContent = '';
    dockEl.setAttribute('data-lab', 'dock');
    dockEl.setAttribute('role', 'toolbar');
    dockEl.setAttribute('aria-label', 'Dock');
    dockApps = h('div', { class: 'lab-dock-sec', dataset: { sec: 'apps' } });
    dockMini = h('div', { class: 'lab-dock-sec lab-dock-mini', dataset: { sec: 'mini' } });
    // downloads stack
    var dIcon = h('span', { class: 'lab-dock-icon' });
    dIcon.innerHTML = LAB.icons.get('app-downloads', { size: 52 });
    downloadsBtn = h('button', { type: 'button', class: 'lab-dock-item', role: 'button', 'aria-label': '下載項目', dataset: { lab: 'dock-item', app: 'downloads' } },
      h('span', { class: 'lab-dock-label' }, '下載項目'), dIcon);
    downloadsBtn.addEventListener('click', function () { LAB.apps.openFolder(HOME + '/Downloads', 'dock'); });
    LAB.dnd.target(downloadsBtn, {
      id: 'dock:downloads',
      accept: function (pl, mods) { return pl.kind === 'fs' ? (mods.altKey || mods.mode === 'copy' ? 'copy' : 'move') : false; },
      enter: function () { downloadsBtn.classList.add('is-drop'); },
      leave: function () { downloadsBtn.classList.remove('is-drop'); },
      drop: function (pl, ctx) { downloadsBtn.classList.remove('is-drop'); transfer(pl.paths, HOME + '/Downloads', ctx.mode === 'copy' ? 'copy' : 'move', 'dock'); }
    });
    // trash
    trashIconBox = h('span', { class: 'lab-dock-icon' });
    trashBtn = h('button', { type: 'button', class: 'lab-dock-item', role: 'button', 'aria-label': '垃圾桶', dataset: { lab: 'dock-item', app: 'trash' } },
      h('span', { class: 'lab-dock-label' }, '垃圾桶'), trashIconBox);
    trashBtn.addEventListener('click', function () { LAB.apps.openFolder(HOME + '/.Trash', 'dock'); });
    trashBtn.addEventListener('contextmenu', function (e) {
      e.preventDefault();
      var p = LAB.stage.toStage(e.clientX, e.clientY);
      LAB.menu.contextMenu(p.x, p.y - 8, [{ label: '清倒垃圾桶', enabled: trashBtn.dataset.full === '1', action: confirmEmptyTrash }]);
    });
    LAB.dnd.target(trashBtn, {
      id: 'dock:trash',
      accept: function (pl) { return pl.kind === 'fs' ? 'move' : false; },
      enter: function () { trashBtn.classList.add('is-drop'); },
      leave: function () { trashBtn.classList.remove('is-drop'); },
      drop: function (pl) {
        trashBtn.classList.remove('is-drop');
        var doneT = [];
        pl.paths.forEach(function (p) {
          try { doneT.push({ name: LAB.vfs.basename(p), dest: LAB.vfs.trash(p, { by: 'dock' }) }); }
          catch (e) { LAB.ui.vfsFail(null, e, '無法移到垃圾桶', p); }
        });
        if (doneT.length) LAB.undo.push('移到垃圾桶「' + doneT[0].name + '」' + (doneT.length > 1 ? '等 ' + doneT.length + ' 個項目' : ''), function () {
          doneT.forEach(function (d) { try { LAB.vfs.putBack(d.dest, { by: 'dock' }); } catch (e) { /* already gone */ } });
        });
      }
    });
    var right = h('div', { class: 'lab-dock-sec', dataset: { sec: 'right' } }, downloadsBtn, dockMini, trashBtn);
    dockBar = h('div', { class: 'lab-dock-bar' }, dockApps, h('div', { class: 'lab-dock-div', 'aria-hidden': 'true' }), right);
    dockEl.appendChild(dockBar);
    buildAppItems();
    updateTrashIcon();

    LAB.bus.on('apps:changed', buildAppItems);
    LAB.bus.on('app:launch', function (d) { var r = appItems.get(d.appId); if (r) { r.btn.classList.add('is-running'); r.btn.classList.remove('is-bounce'); } });
    LAB.bus.on('app:launching', function (d) {
      var r = appItems.get(d.appId);
      if (!r || reduced()) return;
      r.btn.classList.add('is-bounce');
      setTimeout(function () { r.btn.classList.remove('is-bounce'); }, 760);
    });
    LAB.bus.on('app:quit', function (d) { var r = appItems.get(d.appId); if (r) r.btn.classList.remove('is-running'); });
    LAB.bus.on('win:minimize', function (d) { addThumb(d.id); });
    LAB.bus.on('win:restore', function (d) { removeThumb(d.id); });
    LAB.bus.on('win:close', function (d) { removeThumb(d.id); });
    LAB.bus.on('win:title', function (d) { var b = miniThumbs.get(d.id); if (b) b.querySelector('.lab-dock-label').textContent = d.title; });
    LAB.bus.on('fs:change', function (d) { if (d.trashed || (d.path && d.path.indexOf(HOME + '/.Trash') === 0) || (d.from && d.from.indexOf(HOME + '/.Trash') === 0)) updateTrashIcon(); });
    LAB.bus.on('store:reset', updateTrashIcon);

    // hover magnification: transform only, never layout
    dockBar.addEventListener('pointermove', function (e) {
      if (reduced() || perf.low || e.pointerType === 'touch') return;
      var s = LAB.stage.scale;
      var items = dockBar.querySelectorAll('.lab-dock-item');
      for (var i = 0; i < items.length; i++) {
        var r = items[i].getBoundingClientRect();
        var d = Math.abs(e.clientX - (r.left + r.width / 2)) / s;
        var k = 1 + 0.35 * Math.exp(-(d * d) / (2 * 42 * 42));
        items[i].firstElementChild.nextElementSibling.style.transform = 'scale(' + k.toFixed(3) + ')';
        items[i].style.zIndex = k > 1.05 ? '2' : '';
      }
    });
    dockBar.addEventListener('pointerleave', function () {
      var ic = dockBar.querySelectorAll('.lab-dock-icon');
      for (var i = 0; i < ic.length; i++) ic[i].style.transform = '';
    });
  }

  /* ======================================================= Spotlight (§2.8) */
  var spot = null;   // {el, input, list, off, prevFocus, results, index}

  function searchApps(q) {
    var out = [];
    LAB.apps.all().forEach(function (def) {
      if (def.id === 'quicklook' || def.id === 'archive') return;
      var keys = [def.id, def.en || '', def.title || ''].concat(def.aliases || []);
      var ok = keys.some(function (k) { return k && String(k).toLowerCase().indexOf(q) >= 0; });
      if (ok) out.push({ kind: 'app', id: def.id, label: def.title, sub: def.en && def.en !== def.title ? def.en : '', icon: def.icon });
    });
    return out;
  }
  function searchFiles(q) {
    var dirs = [], files = [];
    (function rec(path, depth) {
      var list;
      try { list = LAB.vfs.list(path); } catch (e) { return; }
      list.forEach(function (st) {
        if (st.hidden) return;
        if (st.name.toLowerCase().indexOf(q) >= 0) { (st.type === 'dir' ? dirs : files).push(st); }
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
    try { if (s.prevFocus && s.prevFocus.focus && document.contains(s.prevFocus)) s.prevFocus.focus(); } catch (e) { /* ignore */ }
    LAB.bus.emit('shell:spotlight', { open: false });
  }

  function renderResults() {
    var q = spot.input.value.trim().toLowerCase();
    spot.list.textContent = '';
    spot.results = [];
    spot.index = -1;
    if (!q) { spot.input.setAttribute('aria-expanded', 'false'); spot.el.classList.remove('has-results'); return; }
    var apps = searchApps(q);
    var f = searchFiles(q);
    var groups = [
      { title: '應用程式', items: apps.map(function (a) { return a; }) },
      { title: '檔案夾', items: f.dirs.map(function (s) { return { kind: 'path', path: s.path, label: s.name, sub: LAB.vfs.dirname(s.path).replace(HOME, '~'), icon: 'folder' }; }) },
      { title: '文件', items: f.files.map(function (s) { return { kind: 'path', path: s.path, label: s.name, sub: LAB.vfs.dirname(s.path).replace(HOME, '~'), icon: LAB.icons.forNode(s) }; }) }
    ];
    var total = 0;
    groups.forEach(function (g) {
      var take = g.items.slice(0, Math.max(0, 8 - total));
      if (!take.length) return;
      total += take.length;
      spot.list.appendChild(h('div', { class: 'lab-spot-group', role: 'presentation' }, g.title));
      take.forEach(function (it) {
        var idx = spot.results.length;
        var ico = h('span', { class: 'lab-spot-ico' });
        ico.innerHTML = LAB.icons.get(it.icon, { size: 26 });
        var row = h('div', {
          class: 'lab-spot-row', role: 'option', id: 'lab-spot-opt' + idx, 'aria-selected': 'false',
          dataset: { lab: 'spotlight-result', kind: it.kind, id: it.id || '', path: it.path || '' }
        }, ico, h('span', { class: 'lab-spot-label' }, it.label), it.sub ? h('span', { class: 'lab-spot-sub' }, it.sub) : null);
        row.addEventListener('mouseenter', function () { setIndex(idx); });
        row.addEventListener('click', function () { activate(idx); });
        spot.list.appendChild(row);
        spot.results.push({ item: it, el: row });
      });
    });
    spot.el.classList.toggle('has-results', spot.results.length > 0);
    spot.input.setAttribute('aria-expanded', spot.results.length ? 'true' : 'false');
    if (spot.results.length) setIndex(0);
    else spot.list.appendChild(h('div', { class: 'lab-spot-none' }, '找不到符合的項目'));
  }
  function setIndex(i) {
    if (!spot || !spot.results.length) return;
    i = (i + spot.results.length) % spot.results.length;
    spot.index = i;
    spot.results.forEach(function (r, k) { r.el.classList.toggle('is-hl', k === i); r.el.setAttribute('aria-selected', k === i ? 'true' : 'false'); });
    spot.input.setAttribute('aria-activedescendant', 'lab-spot-opt' + i);
  }
  function activate(i) {
    if (!spot) return;
    var r = spot.results[i];
    if (!r) return;
    var it = r.item;
    closeSpotlight();
    if (it.kind === 'app') LAB.apps.launch(it.id, it.id === 'about' ? { tab: 'about' } : undefined, { bounce: true });
    else LAB.apps.openPath(it.path, { via: 'spotlight' });
  }

  function openSpotlight() {
    if (spot) { spot.input.focus(); return; }
    if (LAB.menu) LAB.menu.closeAll();
    closePopover();
    var prev = document.activeElement;
    var input = h('input', {
      type: 'text', class: 'lab-spot-input', role: 'combobox', 'aria-label': '搜尋', placeholder: 'Spotlight 搜尋',
      'aria-expanded': 'false', 'aria-controls': 'lab-spot-list', 'aria-autocomplete': 'list', autocomplete: 'off', spellcheck: 'false',
      dataset: { lab: 'spotlight-input' }
    });
    var list = h('div', { class: 'lab-spot-list', id: 'lab-spot-list', role: 'listbox', 'aria-label': '搜尋結果' });
    var panel = h('div', { class: 'lab-spot-panel', role: 'dialog', 'aria-label': 'Spotlight 搜尋' },
      h('div', { class: 'lab-spot-field' }, (function () { var s = h('span', { class: 'lab-spot-glass' }); s.innerHTML = LAB.icons.get('search', { size: 22 }); return s; })(), input), list);
    var el = h('div', { class: 'lab-spot' }, panel);
    el.addEventListener('pointerdown', function (e) { if (e.target === el) closeSpotlight(); });
    overlaysEl.appendChild(el);
    spot = { el: el, input: input, list: list, prevFocus: prev, results: [], index: -1, composing: false, off: null };
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
    setTimeout(function () { input.focus(); }, 0);
    LAB.bus.emit('shell:spotlight', { open: true });
  }
  LAB.desktop.openSpotlight = openSpotlight;
  LAB.desktop.closeSpotlight = closeSpotlight;
  LAB.desktop.toggleSpotlight = function () { if (spot) closeSpotlight(); else openSpotlight(); };
  LAB.bus.on('stage:resize', function () { if (spot) closeSpotlight(); closePopover(); });

  /* ================================================ phone notice (§6.3) */
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
    layout.apply();
    layoutStage(true);
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(queueMeasure).observe(screenEl);
    window.addEventListener('resize', function () {
      // a browser window that was resized (or zoomed) after load gets the rail mode it would have got at load
      if (rootEl && layout.railMode() !== appliedMode) { drawerOpen = false; layout.apply(); }
      queueMeasure();
    });

    drawWall();
    var redraw = LAB.util.debounce(drawWall, 300);
    LAB.bus.on('stage:resize', redraw);

    buildMenubar();
    setupDesktop();
    setupDock();
    setupTouch();

    // overlay scrollbars: show the thumb while something scrolls (DESIGN §2.4)
    stageEl.addEventListener('scroll', function (e) {
      var t = e.target;
      if (!t || !t.classList) return;
      t.classList.add('lab-scrolling');
      if (t._labScrollT) clearTimeout(t._labScrollT);
      t._labScrollT = setTimeout(function () { t.classList.remove('lab-scrolling'); }, 900);
    }, true);
    // the browser's own context menu stays away from the fake Mac (but not from real text fields)
    stageEl.addEventListener('contextmenu', function (e) {
      var t = e.target;
      if (t && t.closest && t.closest('input, textarea')) return;
      e.preventDefault();
    });
    // a click anywhere in the stage closes the rail drawer
    stageEl.addEventListener('pointerdown', function () { if (layout.isDrawerOpen()) layout.closeDrawer(); }, true);
    LAB.keys.on('escape', function () { if (layout.isDrawerOpen()) { layout.closeDrawer(); return true; } return false; });
    LAB.bus.on('store:reset', function () { renderIcons(); });
  }, 30);

  LAB.ready(function () { showPhoneNotice(); }, 90);
})(window.LAB);
