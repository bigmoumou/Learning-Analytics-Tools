/* sysapps.js [SKIN] — round 5 (SYS-MAC): the system features of the practice Mac that were missing, and five new apps.
   Apple menu items (About This Mac, Force Quit, power dialogs, lock screen), Control Center, Notification Center, the Wi-Fi panel,
   appearance / accent / wallpaper / brightness, the fake process table, and the apps 系統設定 (settings), 計算機 (calculator),
   活動監視器 (activity), Safari (safari), 預覽程式 (preview) plus the 「應用程式」 grid (launchpad).
   Everything is fake data from SPEC §1 and lives in memory for the visit only (DESIGN §18). Heavy DOM is built when a feature is
   used, never at load; timers only run while the thing they update is on screen. Public surface: LAB.sys (see the end of this file). */
(function (LAB) {
  'use strict';

  var h = LAB.util.h;
  var sys = LAB.sys = LAB.sys || {};

  /* ------------------------------------------------------------------ small helpers */
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
  function stageEl() { return document.getElementById('lab-stage'); }
  function overlaysEl() { return document.getElementById('lab-overlays'); }
  function reduced() {
    try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; }
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function ico(name, size) { var s = h('span', { class: 'sy-ico', 'aria-hidden': 'true' }); s.innerHTML = LAB.icons.get(name, { size: size || 24 }); return s; }
  function svgIn(markup) { var s = h('span', { class: 'sy-svg', 'aria-hidden': 'true' }); s.innerHTML = markup; return s; }   // static markup only
  function p2(n) { return (n < 10 ? '0' : '') + n; }
  function fmtNum(n, d) { return Number(n).toLocaleString('en-US', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }); }
  function emit(key, value) { try { LAB.bus.emit('sys:change', { key: key, value: value }); } catch (e) { /* ignore */ } }
  function toastLab(t) { LAB.ui.toast(t); }

  /* ------------------------------------------------------------------ facts (SPEC §1) */
  var HW = {
    model: 'MacBook Air', size: '13 吋', year: 2024, modelId: 'Mac15,12', chip: 'Apple M3', cores: 8, ram: '16 GB', ramMB: 16384,
    serial: 'C02ZL4BAN1MX', os: 'macOS Tahoe', ver: '26.0.1', build: '25A362',
    hostName: 'MacBook-Air', computerName: 'an 的 MacBook Air', user: 'an', display: '13.6 吋', res: '2560 × 1664',
    disk: 'Macintosh HD', diskTotal: 494.38, diskFree: 312.6
  };
  var NET = { ssid: 'NTNU-Classroom', ip: '10.20.31.57', mask: '255.255.255.0', gw: '10.20.31.1', dns: '10.20.0.53', mac: '3c:22:fb:7a:19:e4', iface: 'en0' };
  sys.hw = HW;
  sys.net = NET;

  /* ------------------------------------------------------------------ state (this visit only) */
  function defaults() {
    return {
      appearance: 'light', accent: 'blue', wallpaper: 'tahoe',
      wifi: true, bluetooth: true, airdrop: true, focus: false, brightness: 100, volume: 55, keyLight: 40,
      screensaver: 'drift', saverMin: 10, keyRepeat: 6, keyDelay: 4, track: 5, scroll: 5, naturalScroll: true,
      reminders: [false, false, false]
    };
  }
  var state = sys.state = defaults();
  LAB.store.register('sys', {
    serialize: function () { return {}; },
    restore: function () { Object.keys(state).forEach(function (k) { delete state[k]; }); var d = defaults(); Object.keys(d).forEach(function (k) { state[k] = d[k]; }); applyAll(); },
    reset: function () { Object.keys(state).forEach(function (k) { delete state[k]; }); var d = defaults(); Object.keys(d).forEach(function (k) { state[k] = d[k]; }); applyAll(); }
  });
  function applyAll() {
    try { applyAppearance(); applyAccent(); applyWallpaper(); applyBrightness(); applyNetwork(); } catch (e) { /* the page skeleton may not exist yet */ }
  }

  /* ================================================================== appearance, accent */
  var darkMq = null, darkMqOn = false;
  function systemDark() {
    try { darkMq = darkMq || window.matchMedia('(prefers-color-scheme: dark)'); return !!darkMq.matches; } catch (e) { return false; }
  }
  function isDark() { return state.appearance === 'dark' || (state.appearance === 'auto' && systemDark()); }
  function applyAppearance() {
    var dark = isDark();
    document.documentElement.setAttribute('data-appearance', dark ? 'dark' : 'light');
    if (state.appearance === 'auto' && !darkMqOn && darkMq && darkMq.addEventListener) {
      darkMqOn = true;
      darkMq.addEventListener('change', function () { if (state.appearance === 'auto') { applyAppearance(); emit('appearance', state.appearance); } });
    }
  }
  sys.setAppearance = function (mode) {
    if (mode !== 'light' && mode !== 'dark' && mode !== 'auto') return;
    state.appearance = mode;
    systemDark();
    applyAppearance();
    emit('appearance', mode);
  };
  sys.isDark = isDark;

  var ACCENTS = [
    { id: 'blue', label: '藍色', color: '#0a6cff' }, { id: 'purple', label: '紫色', color: '#a550a7' }, { id: 'pink', label: '粉紅色', color: '#f74f9e' },
    { id: 'red', label: '紅色', color: '#e0383e' }, { id: 'orange', label: '橘色', color: '#f7821b' }, { id: 'yellow', label: '黃色', color: '#e8b400' },
    { id: 'green', label: '綠色', color: '#46a34a' }, { id: 'graphite', label: '石墨色', color: '#7d7d82' }
  ];
  sys.accents = ACCENTS;
  function applyAccent() {
    var st = stageEl();
    if (!st) return;
    var a = null;
    ACCENTS.forEach(function (x) { if (x.id === state.accent) a = x; });
    if (!a || a.id === 'blue') {
      ['--mac-accent', '--mac-sel-strong', '--mac-sel'].forEach(function (k) { st.style.removeProperty(k); });
      return;
    }
    var c = a.color;
    st.style.setProperty('--mac-accent', c);
    st.style.setProperty('--mac-sel-strong', c);
    var r = parseInt(c.slice(1, 3), 16), g = parseInt(c.slice(3, 5), 16), b = parseInt(c.slice(5, 7), 16);
    st.style.setProperty('--mac-sel', 'rgba(' + r + ',' + g + ',' + b + ',.16)');
  }
  sys.setAccent = function (id) { state.accent = id; applyAccent(); emit('accent', id); };

  /* ================================================================== brightness (dims the stage a little) */
  function applyBrightness() {
    var st = stageEl();
    if (!st) return;
    var dim = st.querySelector('#lab-dim');
    var a = clamp((100 - state.brightness) / 100, 0, 1) * 0.55;
    if (a <= 0.004) { if (dim) dim.style.opacity = '0'; return; }
    if (!dim) { dim = h('div', { id: 'lab-dim', class: 'sy-dim', 'aria-hidden': 'true' }); st.appendChild(dim); }
    dim.style.opacity = a.toFixed(3);
  }
  sys.setBrightness = function (v) { state.brightness = clamp(Math.round(v), 0, 100); applyBrightness(); emit('brightness', state.brightness); };
  sys.setVolume = function (v) { state.volume = clamp(Math.round(v), 0, 100); emit('volume', state.volume); };

  /* ================================================================== network switches (Wi-Fi in the menu bar) */
  function applyNetwork() {
    var w = document.querySelector('.lab-mb-wifi');
    if (w) { w.classList.toggle('is-off', !state.wifi); w.setAttribute('aria-label', state.wifi ? 'Wi-Fi' : 'Wi-Fi：已關閉'); }
  }
  sys.setWifi = function (on) { state.wifi = !!on; applyNetwork(); emit('wifi', state.wifi); };
  sys.online = function () { return !!state.wifi; };

  /* ================================================================== wallpapers
     The Lake Tahoe photo (img/wallpaper.jpg) stays the default. Three more are drawn here with canvas (seeded, no files, nothing
     downloaded): 暮色山脊 (dusk ridges), 流光 (silk ribbons) and 海灣 (a calm bay); plus a few plain colours. A wallpaper is drawn
     once, the first time it is looked at or chosen, and cached as a small JPEG data URL. */
  var WALLS = [
    { id: 'tahoe', label: '湖光', kind: 'photo' },
    { id: 'dusk', label: '暮色山脊', kind: 'draw' },
    { id: 'silk', label: '流光', kind: 'draw' },
    { id: 'bay', label: '海灣', kind: 'draw' }
  ];
  var WALL_COLORS = [
    { id: 'c-slate', label: '藍灰', color: '#4f6178' }, { id: 'c-pine', label: '松綠', color: '#2f4a41' }, { id: 'c-sand', label: '沙色', color: '#a99c86' },
    { id: 'c-navy', label: '深藍', color: '#1d2b4d' }, { id: 'c-wine', label: '酒紅', color: '#5b2c3c' }, { id: 'c-char', label: '炭灰', color: '#2d2f33' }
  ];
  sys.wallpapers = { drawn: WALLS, colors: WALL_COLORS };

  function mkCanvas(w, hh) { var c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(hh)); return c; }
  function ridgeLine(rng, w, base, amp, freq, oct) {
    var ph = [], i, x, t, y, a, f, out = [];
    for (i = 0; i < oct; i++) ph.push(rng() * 6.283);
    for (x = 0; x <= w; x++) {
      t = x / w; y = 0; a = amp; f = freq;
      for (i = 0; i < oct; i++) { y += a * Math.sin(t * f * 6.283 + ph[i]); a *= 0.5; f *= 2.1; }
      out.push(base + y);
    }
    return out;
  }
  function fillRidge(g, line, w, bottom, top, c0, c1) {
    var gr = g.createLinearGradient(0, top, 0, bottom);
    gr.addColorStop(0, c0); gr.addColorStop(1, c1);
    g.fillStyle = gr;
    g.beginPath(); g.moveTo(0, line[0]);
    for (var x = 1; x <= w; x++) g.lineTo(x, line[x]);
    g.lineTo(w, bottom); g.lineTo(0, bottom); g.closePath(); g.fill();
  }
  function grain(g, w, hh, amt, rng) {
    var im = g.getImageData(0, 0, w, hh), d = im.data;
    for (var i = 0; i < d.length; i += 4) { var n = (rng() - 0.5) * amt; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
    g.putImageData(im, 0, 0);
  }

  function drawDusk(w, hh) {
    var c = mkCanvas(w, hh), g = c.getContext('2d'), rng = mulberry32(11), s = w / 1280, i;
    var sky = g.createLinearGradient(0, 0, 0, hh * 0.74);
    sky.addColorStop(0, '#1b2056'); sky.addColorStop(0.34, '#56478c'); sky.addColorStop(0.6, '#c4658a'); sky.addColorStop(0.82, '#f0a07a'); sky.addColorStop(1, '#ffd7a2');
    g.fillStyle = sky; g.fillRect(0, 0, w, hh);
    var rg = g.createRadialGradient(w * 0.68, hh * 0.6, 0, w * 0.68, hh * 0.6, hh * 0.6);
    rg.addColorStop(0, 'rgba(255,238,196,.95)'); rg.addColorStop(0.22, 'rgba(255,205,150,.55)'); rg.addColorStop(1, 'rgba(255,170,130,0)');
    g.fillStyle = rg; g.fillRect(0, 0, w, hh);
    for (i = 0; i < 70; i++) { g.fillStyle = 'rgba(255,255,255,' + (0.15 + rng() * 0.5).toFixed(2) + ')'; g.fillRect(rng() * w, rng() * hh * 0.34, 1.4 * s + 0.4, 1.4 * s + 0.4); }
    var cols = [['#9a6a92', '#6a4a82'], ['#734f88', '#473a74'], ['#523f7a', '#2c2a60'], ['#35336a', '#1a1a46'], ['#1f2050', '#0d0e2c']];
    for (i = 0; i < cols.length; i++) {
      var base = hh * (0.60 + i * 0.075), line = ridgeLine(rng, w, base, hh * (0.05 + i * 0.012), 1.2 + i * 0.35, 5);
      fillRidge(g, line, w, hh, base - hh * 0.08, cols[i][0], cols[i][1]);
    }
    grain(g, c.width, c.height, 5, rng);
    return c;
  }

  function drawSilk(w, hh) {
    var sw = Math.max(64, Math.round(w / 9)), sh = Math.max(40, Math.round(hh / 9)), rng = mulberry32(23);
    var sc = mkCanvas(sw, sh), g = sc.getContext('2d'), i, x;
    var bg = g.createLinearGradient(0, 0, sw, sh);
    bg.addColorStop(0, '#0a0f2e'); bg.addColorStop(0.55, '#16205a'); bg.addColorStop(1, '#2a1a5e');
    g.fillStyle = bg; g.fillRect(0, 0, sw, sh);
    g.globalCompositeOperation = 'lighter';
    var pal = [['rgba(50,100,255,.34)', 'rgba(150,90,230,.28)'], ['rgba(80,130,255,.28)', 'rgba(220,110,200,.26)'], ['rgba(120,80,230,.32)', 'rgba(255,150,170,.24)'], ['rgba(50,150,255,.26)', 'rgba(130,90,240,.26)'], ['rgba(160,90,235,.28)', 'rgba(255,170,150,.22)']];
    for (i = 0; i < 5; i++) {
      var cy = sh * (0.1 + i * 0.2), thick = sh * (0.2 + rng() * 0.1), a1 = sh * (0.07 + rng() * 0.06), a2 = sh * (0.03 + rng() * 0.03);
      var f1 = 0.9 + rng() * 0.9, f2 = 2.1 + rng() * 1.6, p1 = rng() * 6.28, p2_ = rng() * 6.28, p3 = rng() * 6.28;
      var gr = g.createLinearGradient(0, 0, sw, 0);
      gr.addColorStop(0, pal[i][0]); gr.addColorStop(1, pal[i][1]);
      g.fillStyle = gr;
      g.beginPath();
      for (x = 0; x <= sw; x += 2) {
        var t = x / sw, y = cy + a1 * Math.sin(t * f1 * 6.283 + p1) + a2 * Math.sin(t * f2 * 6.283 + p2_) - thick * 0.5 * (1 + 0.5 * Math.sin(t * 5 + p3));
        if (x === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      for (x = sw; x >= 0; x -= 2) {
        var t2 = x / sw, y2 = cy + a1 * Math.sin(t2 * f1 * 6.283 + p1) + a2 * Math.sin(t2 * f2 * 6.283 + p2_) + thick * 0.5 * (1 + 0.5 * Math.sin(t2 * 4 + p3 + 1));
        g.lineTo(x, y2);
      }
      g.closePath(); g.fill();
    }
    g.globalCompositeOperation = 'source-over';
    var c = mkCanvas(w, hh), g2 = c.getContext('2d');
    g2.imageSmoothingEnabled = true;
    try { g2.imageSmoothingQuality = 'high'; } catch (e) { /* ignore */ }
    g2.drawImage(sc, 0, 0, w, hh);
    grain(g2, c.width, c.height, 3, rng);
    return c;
  }

  function drawBay(w, hh) {
    var c = mkCanvas(w, hh), g = c.getContext('2d'), rng = mulberry32(37), i, hz = hh * 0.56;
    var sky = g.createLinearGradient(0, 0, 0, hz);
    sky.addColorStop(0, '#5f9bc2'); sky.addColorStop(0.55, '#a9cfe2'); sky.addColorStop(1, '#f4ecd8');
    g.fillStyle = sky; g.fillRect(0, 0, w, hz);
    var sun = g.createRadialGradient(w * 0.3, hz, 0, w * 0.3, hz, hh * 0.5);
    sun.addColorStop(0, 'rgba(255,244,210,.95)'); sun.addColorStop(0.3, 'rgba(255,230,180,.5)'); sun.addColorStop(1, 'rgba(255,230,180,0)');
    g.fillStyle = sun; g.fillRect(0, 0, w, hz);
    for (i = 0; i < 6; i++) {          // soft clouds
      var cx = rng() * w, cy = hh * (0.08 + rng() * 0.28), rw = w * (0.08 + rng() * 0.12);
      var cg = g.createRadialGradient(cx, cy, 0, cx, cy, rw);
      cg.addColorStop(0, 'rgba(255,255,255,.55)'); cg.addColorStop(1, 'rgba(255,255,255,0)');
      g.save(); g.translate(cx, cy); g.scale(1, 0.28); g.translate(-cx, -cy); g.fillStyle = cg; g.beginPath(); g.arc(cx, cy, rw, 0, 6.283); g.fill(); g.restore();
    }
    var isl = [['#b3c8c2', 0.035, 1.1], ['#86aaa0', 0.055, 1.7], ['#55857a', 0.075, 0.8]];
    for (i = 0; i < isl.length; i++) {
      var ph = rng() * 6.283, rip = ridgeLine(rng, w, 0, hh * 0.006, 5, 3);
      g.fillStyle = isl[i][0]; g.beginPath(); g.moveTo(0, hz);
      for (var x = 0; x <= w; x++) {
        var bump = Math.pow(Math.max(0, Math.sin((x / w) * isl[i][2] * 6.283 + ph)), 1.4);
        g.lineTo(x, hz - bump * hh * isl[i][1] + rip[x] * bump);
      }
      g.lineTo(w, hz); g.closePath(); g.fill();
    }
    var sea = g.createLinearGradient(0, hz, 0, hh);
    sea.addColorStop(0, '#9fcbd0'); sea.addColorStop(0.18, '#4f9aab'); sea.addColorStop(1, '#17566b');
    g.fillStyle = sea; g.fillRect(0, hz, w, hh - hz);
    for (i = 0; i < 160; i++) {         // sparkles and swell
      var y = hz + 4 + Math.pow(rng(), 1.4) * (hh - hz - 6), len = (6 + rng() * 60) * (0.4 + (y - hz) / (hh - hz));
      g.fillStyle = 'rgba(255,255,255,' + (0.1 + rng() * 0.28).toFixed(2) + ')';
      g.fillRect(rng() * w * 0.9 + w * 0.02, y, len, 1.4);
    }
    for (var yy = hz; yy < hh; yy += 3) {          // the sun's path on the water: a soft column that widens and fades downward
      var k = (yy - hz) / (hh - hz), half = 24 + k * 90, cg2 = g.createLinearGradient(w * 0.3 - half, 0, w * 0.3 + half, 0), al = (0.55 * (1 - k)).toFixed(3);
      cg2.addColorStop(0, 'rgba(255,244,214,0)'); cg2.addColorStop(0.5, 'rgba(255,244,214,' + al + ')'); cg2.addColorStop(1, 'rgba(255,244,214,0)');
      g.fillStyle = cg2; g.fillRect(w * 0.3 - half, yy, half * 2, 3);
    }
    grain(g, c.width, c.height, 4, rng);
    return c;
  }

  function drawWall(id, w, hh) {
    if (id === 'dusk') return drawDusk(w, hh);
    if (id === 'silk') return drawSilk(w, hh);
    if (id === 'bay') return drawBay(w, hh);
    return null;
  }
  function colorOf(id) { var r = null; WALL_COLORS.forEach(function (c) { if (c.id === id) r = c.color; }); return r; }
  var wallCache = {};
  function wallUrl(id) {
    if (wallCache[id]) return wallCache[id];
    var c = drawWall(id, 1280, 800);
    if (!c) return '';
    try { wallCache[id] = c.toDataURL('image/jpeg', 0.86); } catch (e) { wallCache[id] = c.toDataURL(); }
    return wallCache[id];
  }
  var TINT = 'linear-gradient(180deg, rgba(14,54,104,.42) 0, rgba(14,54,104,.22) 30px, rgba(14,54,104,0) 140px)';
  function applyWallpaper() {
    var w = document.getElementById('lab-wall');
    if (!w) return;
    var id = state.wallpaper, col = colorOf(id);
    if (id === 'tahoe' || (!col && !drawWall.names[id])) {
      w.style.backgroundImage = ''; w.style.backgroundSize = ''; w.style.backgroundPosition = ''; w.style.backgroundColor = ''; w.style.backgroundRepeat = '';
      w.removeAttribute('data-wall');
      return;
    }
    w.setAttribute('data-wall', id);
    if (col) {
      w.style.backgroundColor = col; w.style.backgroundImage = TINT; w.style.backgroundSize = '100% 140px'; w.style.backgroundPosition = '0 0'; w.style.backgroundRepeat = 'no-repeat';
      return;
    }
    w.style.backgroundColor = '#101428';
    w.style.backgroundImage = TINT + ', url("' + wallUrl(id) + '")';
    w.style.backgroundSize = '100% 140px, cover'; w.style.backgroundPosition = '0 0, center'; w.style.backgroundRepeat = 'no-repeat, no-repeat';
  }
  drawWall.names = { dusk: 1, silk: 1, bay: 1 };
  sys.setWallpaper = function (id) {
    if (id !== 'tahoe' && !colorOf(id) && !drawWall.names[id]) return false;
    state.wallpaper = id;
    applyWallpaper();
    emit('wallpaper', id);
    return true;
  };
  /* a small picture of a wallpaper for the settings pane: an <img>/<canvas> element of the given size */
  sys.wallThumb = function (id, w, hh) {
    var col = colorOf(id);
    if (col) return h('span', { class: 'sy-wthumb', style: { background: col } });
    if (id === 'tahoe') return h('span', { class: 'sy-wthumb is-photo' });
    var c = drawWall(id, w * 2, hh * 2);
    c.className = 'sy-wthumb';
    return c;
  };

  /* ================================================================== the fake process table (SPEC §1)
     One table for `ps`, `top`, `kill` and Activity Monitor: when the Terminal's LAB.procs (js/terminal.js) is there, this file reads it
     (list() and kill(pid) are its whole interface) and only adds the columns Activity Monitor needs, derived from the PID so they
     never change. Without it, a table of the same shape is built here (fixed PIDs; every app that is really open adds its rows).
     LAB.sys.processes() → rows {pid, name, user, cpu, memMB, threads, kind:'system'|'app'|'helper'|'shell', appId, …};
     LAB.sys.killProcess(pid|name) really quits the app behind a row. */
  var SYS_PROCS = [   // name, pid, user, cpu%, memory MB, threads
    ['kernel_task', 0, 'root', 2.6, 1840, 442], ['launchd', 1, 'root', 0.1, 24, 4], ['logd', 88, 'root', 0.2, 12, 3],
    ['UserEventAgent', 91, 'root', 0.1, 9, 4], ['fseventsd', 95, 'root', 0.3, 22, 12], ['mediaremoted', 98, 'root', 0, 6, 3],
    ['configd', 104, 'root', 0.1, 17, 8], ['powerd', 107, 'root', 0, 6, 3], ['mds', 112, 'root', 0.4, 118, 8],
    ['coreaudiod', 133, '_coreaudiod', 0.2, 21, 6], ['bluetoothd', 136, 'root', 0, 11, 4], ['airportd', 140, 'root', 0.1, 14, 5],
    ['WindowServer', 391, '_windowserver', 3.4, 438, 14], ['loginwindow', 412, 'an', 0.1, 63, 7], ['cfprefsd', 421, 'an', 0, 8, 4],
    ['mds_stores', 540, 'root', 0.2, 164, 5], ['Dock', 623, 'an', 0.2, 72, 6], ['SystemUIServer', 625, 'an', 0.1, 48, 5],
    ['ControlCenter', 627, 'an', 0.1, 91, 8], ['NotificationCenter', 630, 'an', 0, 37, 4], ['Spotlight', 640, 'an', 0.1, 129, 7],
    ['sharingd', 644, 'an', 0, 14, 4]
  ];
  var APP_PROCS = {   // appId -> name, pid, cpu%, memory MB, threads, helpers [name, offset, cpu, mem]
    finder: ['Finder', 626, 0.3, 180, 9],
    terminal: ['終端機', 1204, 0.3, 96, 8],
    textedit: ['文字編輯', 1277, 0.1, 71, 6],
    preview: ['預覽程式', 1296, 0.1, 108, 7],
    safari: ['Safari', 1311, 0.8, 214, 18, [['Safari Networking', 1, 0.1, 58], ['Safari Web Content', 2, 0.4, 142]]],
    calculator: ['計算機', 1342, 0, 52, 4],
    activity: ['活動監視器', 1360, 1.4, 124, 9],
    codex: ['Codex', 1388, 1.9, 372, 38, [['Codex Helper (GPU)', 1, 0.6, 120], ['Codex Helper (Renderer)', 2, 1.1, 280]]],
    code: ['Code', 1432, 2.4, 418, 42, [['Code Helper (GPU)', 1, 0.7, 126], ['Code Helper (Renderer)', 2, 1.3, 310]]],
    settings: ['系統設定', 1405, 0.2, 143, 11],
    about: ['關於這個練習', 1450, 0, 40, 4],
    quicklook: ['QuickLookUIService', 1466, 0, 66, 6],
    forcequit: ['強制結束', 1480, 0, 30, 3],
    aboutmac: ['系統資訊', 1484, 0, 34, 3]
  };
  var queryCount = 0;
  function fix1(n) { return Math.round(n * 10) / 10; }
  /* the columns of the other tabs: derived from the PID and the usual CPU share only, so a process looks the same on every visit */
  function derive(pid, user, name, cpu, base, mem, threads, memJitter) {
    var rng = mulberry32(pid * 2654435 + queryCount * 7919 + 13), rng2 = mulberry32(pid * 31 + 5);
    var secs = base * 5400 + (pid % 53) * 41 + rng2() * 300;     // CPU time since launch, steady per process
    return {
      pid: pid, name: name, user: user, cpu: cpu, cpuTime: secs, threads: threads, ports: 40 + (pid % 97) * 2 + threads * 3,
      memMB: Math.round(mem * (memJitter ? 0.985 + rng() * 0.03 : 1)), wakeups: Math.round(base * 28 + rng() * 6),
      energy: fix1(base * 0.9 + rng() * 0.3), nap: user === 'an' && base < 1 ? '是' : '否', noSleep: name === 'WindowServer' ? '是' : '否',
      read: Math.round((base * 4 + 0.5) * 1048576 * (0.8 + rng2())), written: Math.round((base * 2 + 0.2) * 1048576 * (0.7 + rng2())),
      sent: Math.round((base * 0.6 + 0.02) * 1048576 * (0.7 + rng2())), recv: Math.round((base * 1.6 + 0.04) * 1048576 * (0.7 + rng2())),
      pktSent: Math.round(base * 320 + 80 * rng2()), pktRecv: Math.round(base * 520 + 120 * rng2()), kind: 'system', appId: null
    };
  }
  function row(name, pid, user, base, mem, threads, extra) {
    var rng = mulberry32(pid * 2654435 + queryCount * 7919 + 13);
    var cpu = base * (0.55 + rng() * 0.9);
    if (base > 0 && rng() < 0.08) cpu += base * (0.5 + rng() * 1.5);
    if (base === 0 && rng() < 0.05) cpu = 0.1;
    var r = derive(pid, user, name, fix1(cpu), base, mem, threads, true);
    if (extra) for (var k in extra) r[k] = extra[k];
    return r;
  }
  /* the Terminal's table (LAB.procs.list) in Activity Monitor's shape; apps carry their zh-TW names, like the real one */
  function fromTerminalTable(list) {
    return list.map(function (t) {
      var def = t.appId && LAB.apps.get(t.appId);
      var kind = t.appId ? 'app' : (t.name === 'login' || t.name === '-zsh' ? 'shell' : 'system');
      var r = derive(t.pid, t.user, def ? def.title : t.name, t.cpu, Math.max(t.cpu, 0), t.memMB, t.threads, false);
      r.kind = kind; r.appId = t.appId || null; r.ppid = t.ppid; r.tty = t.tty; r.command = t.command; r.psName = t.name;
      return r;
    });
  }
  sys.processes = function () {
    queryCount++;
    if (LAB.procs && typeof LAB.procs.list === 'function') {
      try {
        var tl = LAB.procs.list();
        var rows = fromTerminalTable(tl);
        if (!tl.some(function (t) { return t.pid === 0; })) {
          var kr = mulberry32(queryCount * 7919 + 3), kc = fix1(2.6 * (0.55 + kr() * 0.9));
          var k = derive(0, 'root', 'kernel_task', kc, 2.6, 1840, 442, false);
          k.ppid = 0; k.tty = '??'; k.command = 'kernel_task'; k.psName = 'kernel_task';
          rows.unshift(k);
        }
        return rows;
      } catch (e) { console.error('[sys] LAB.procs.list failed, using the built-in table', e); }
    }
    var out = [], running = LAB.apps.running().slice();
    if (running.indexOf('finder') < 0) running.push('finder');
    SYS_PROCS.forEach(function (s) { out.push(row(s[0], s[1], s[2], s[3], s[4], s[5])); });
    running.forEach(function (id) {
      var a = APP_PROCS[id];
      if (!a) return;
      out.push(row(a[0], a[1], 'an', a[2], a[3], a[4], { kind: 'app', appId: id }));
      (a[5] || []).forEach(function (hp) { out.push(row(hp[0], a[1] + hp[1], 'an', hp[2], hp[3], 6, { kind: 'helper', appId: id })); });
      if (id === 'terminal') {
        LAB.wm.byApp('terminal').forEach(function (w, i) {
          out.push(row('login', 1208 + i * 2, 'root', 0, 6, 3, { kind: 'shell', appId: 'terminal', winId: w.id }));
          out.push(row('zsh', 1209 + i * 2, 'an', 0, 9, 2, { kind: 'shell', appId: 'terminal', winId: w.id }));
        });
      }
    });
    out.sort(function (a, b) { return a.pid - b.pid; });
    return out;
  };
  /* what Activity Monitor and `top` show as the whole-machine totals, from the same rows */
  sys.cpuTotals = function (list) {
    list = list || sys.processes();
    var u = 0, s = 0, th = 0;
    list.forEach(function (p) { if (p.user === 'an') u += p.cpu; else s += p.cpu; th += p.threads; });
    var n = HW.cores;
    var user = fix1(u / n), system = fix1(s / n);
    return { user: user, system: system, idle: fix1(100 - user - system), threads: th, count: list.length };
  };
  sys.killProcess = function (which) {
    var list = sys.processes(), hit = null;
    list.forEach(function (p) { if (!hit && (p.pid === which || p.name === which || p.psName === which || (which && which.pid === p.pid))) hit = p; });
    if (!hit) return { ok: false, reason: 'none' };
    if (LAB.procs && typeof LAB.procs.kill === 'function') {
      if (hit.kind === 'system' && hit.user !== 'an') return { ok: false, reason: 'system', name: hit.name };
      var tr = LAB.procs.kill(hit.pid);
      if (tr && tr.ok) return { ok: true, name: hit.name, appId: hit.appId };
      return { ok: false, reason: 'system', name: hit.name };
    }
    if (hit.kind === 'shell') {
      var w = hit.winId && LAB.wm.get(hit.winId);
      if (w) { w.close(true); return { ok: true, name: hit.name, appId: 'terminal' }; }
      return { ok: false, reason: 'none' };
    }
    if (hit.appId) {
      if (hit.appId === 'finder') { LAB.wm.byApp('finder').slice().forEach(function (fw) { fw.close(true); }); return { ok: true, name: hit.name, appId: 'finder' }; }
      LAB.apps.quit(hit.appId, { force: true });
      return { ok: true, name: hit.name, appId: hit.appId };
    }
    return { ok: false, reason: 'system', name: hit.name };
  };

  /* ================================================================== a tiny UI kit shared by the panels and apps below */
  var GL = {   // 24-box stroke glyphs (currentColor), our own drawings
    wifi: '<path d="M3.2 9.6a13 13 0 0 1 17.6 0M6.2 12.9a8.6 8.6 0 0 1 11.6 0M9.1 16a4.3 4.3 0 0 1 5.8 0"/><circle cx="12" cy="19.2" r="1.1" fill="currentColor" stroke="none"/>',
    bluetooth: '<path d="M7 7.5l10 9-5 4.5V3l5 4.5-10 9"/>',
    airdrop: '<circle cx="12" cy="13.2" r="1.7" fill="currentColor" stroke="none"/><path d="M8.2 17a5.4 5.4 0 1 1 7.6 0M5.2 20a9.6 9.6 0 1 1 13.6 0"/>',
    moon: '<path d="M19.2 14.6A7.6 7.6 0 0 1 9.4 4.8a7.6 7.6 0 1 0 9.8 9.8z"/>',
    sun: '<circle cx="12" cy="12" r="3.7"/><path d="M12 3.4v2.2M12 18.4v2.2M3.4 12h2.2M18.4 12h2.2M5.9 5.9l1.5 1.5M16.6 16.6l1.5 1.5M18.1 5.9l-1.5 1.5M7.4 16.6l-1.5 1.5"/>',
    speaker: '<path d="M4.5 9.6h3.2l4.1-3.6v12l-4.1-3.6H4.5z"/><path d="M15.2 9.3a4 4 0 0 1 0 5.4M17.6 6.9a7.4 7.4 0 0 1 0 10.2"/>',
    half: '<circle cx="12" cy="12" r="7.6"/><path d="M12 4.4v15.2a7.6 7.6 0 0 0 0-15.2z" fill="currentColor"/>',
    note: '<path d="M9.2 17.4V6.4l9-2v11"/><circle cx="7.2" cy="17.4" r="2"/><circle cx="16.2" cy="15.4" r="2"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3.6v2.4M12 18v2.4M3.6 12H6M18 12h2.4M6.1 6.1l1.7 1.7M16.2 16.2l1.7 1.7M17.9 6.1l-1.7 1.7M7.8 16.2l-1.7 1.7"/>',
    image: '<rect x="4" y="5" width="16" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M4.5 17l4.5-4.5 3.5 3.5 3-3 4 4"/>',
    screen: '<rect x="3.5" y="5" width="17" height="11" rx="1.8"/><path d="M9 20h6M12 16v4"/>',
    dock: '<rect x="3.5" y="5" width="17" height="14" rx="2"/><rect x="6.5" y="15" width="11" height="2.6" rx="1.3"/>',
    keyboard: '<rect x="3" y="7" width="18" height="10" rx="2"/><path d="M6.5 10.5h.5M9.5 10.5h.5M12.5 10.5h.5M15.5 10.5h.5M8 14h8"/>',
    mouse: '<rect x="7" y="3.5" width="10" height="17" rx="5"/><path d="M12 3.8v5.2"/>',
    users: '<circle cx="9" cy="9" r="3"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><circle cx="17" cy="9.8" r="2.4"/><path d="M16.5 14.4a4.6 4.6 0 0 1 4 4.6"/>',
    lock: '<rect x="5.5" y="10.5" width="13" height="9" rx="2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    chev: '<path d="M9.5 5.5L16 12l-6.5 6.5"/>',
    back: '<path d="M14.5 5.5L8 12l6.5 6.5"/>',
    reload: '<path d="M19.5 12a7.5 7.5 0 1 1-2.4-5.5M19.5 4.5v4.2h-4.2"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    search: '<circle cx="10.5" cy="10.5" r="5.5"/><path d="M15 15l5 5"/>',
    sidebar: '<rect x="3.5" y="5" width="17" height="14" rx="2.2"/><path d="M9.5 5v14"/>',
    share: '<path d="M12 4v10M8 8l4-4 4 4M6 12v6.5a1.5 1.5 0 0 0 1.5 1.5h9a1.5 1.5 0 0 0 1.5-1.5V12"/>',
    tabs: '<rect x="4" y="7" width="12" height="12" rx="2"/><path d="M8 4.5h10a2 2 0 0 1 2 2v10"/>',
    info: '<circle cx="12" cy="12" r="8.2"/><path d="M12 11v5M12 8v.3"/>',
    stop: '<circle cx="12" cy="12" r="8.2"/><path d="M8.8 8.8l6.4 6.4M15.2 8.8l-6.4 6.4"/>',
    zoomin: '<circle cx="10.5" cy="10.5" r="5.5"/><path d="M15 15l5 5M8.3 10.5h4.4M10.5 8.3v4.4"/>',
    zoomout: '<circle cx="10.5" cy="10.5" r="5.5"/><path d="M15 15l5 5M8.3 10.5h4.4"/>',
    fit: '<path d="M4.5 9V5.5H8M15.5 5.5H19V9M19 15v3.5h-3.5M8 18.5H4.5V15"/>',
    rotate: '<path d="M5 12a7 7 0 1 1 2 4.9M5 17.4V13h4.4"/>',
    person: '<circle cx="12" cy="9" r="3.6"/><path d="M5 20a7 7 0 0 1 14 0"/>',
    star: '<path d="M12 4.2l2.4 5 5.4.7-4 3.7 1 5.4-4.8-2.7-4.8 2.7 1-5.4-4-3.7 5.4-.7z"/>',
    page: '<path d="M7 3.5h7l4 4v12a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 19.5v-14A1.5 1.5 0 0 1 7.5 4z"/><path d="M14 3.5v4h4"/>',
    battery: '<rect x="3" y="8" width="16" height="8" rx="2.2"/><path d="M21 11v2"/>',
    globe: '<circle cx="12" cy="12" r="8.2"/><path d="M3.8 12h16.4M12 3.8c2.6 2.4 3.6 5.2 3.6 8.2s-1 5.8-3.6 8.2c-2.6-2.4-3.6-5.2-3.6-8.2s1-5.8 3.6-8.2z"/>'
  };
  function glyph(name, size, sw) {
    var s = h('span', { class: 'sy-gl', 'aria-hidden': 'true' });
    s.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="' + (size || 18) + '" height="' + (size || 18) + '" fill="none" stroke="currentColor" stroke-width="' + (sw || 1.7) + '" stroke-linecap="round" stroke-linejoin="round">' + (GL[name] || '') + '</svg>';
    return s;
  }
  function sw(on, onChange, label) {
    var b = h('button', { type: 'button', class: 'sy-sw' + (on ? ' is-on' : ''), role: 'switch', 'aria-checked': on ? 'true' : 'false', 'aria-label': label || null }, h('i'));
    b.addEventListener('click', function () { b.set(!b.classList.contains('is-on'), true); });
    b.set = function (v, fire) {
      b.classList.toggle('is-on', !!v); b.setAttribute('aria-checked', v ? 'true' : 'false');
      if (fire && onChange) onChange(!!v);
    };
    return b;
  }
  function range(min, max, val, onInput, label, step) {
    var r = h('input', { type: 'range', class: 'sy-range', 'aria-label': label || null });
    r.min = String(min); r.max = String(max); r.step = String(step || 1); r.value = String(val);
    function paint() { r.style.setProperty('--v', (((+r.value) - min) / (max - min) * 100).toFixed(1) + '%'); }
    r.addEventListener('input', function () { paint(); if (onInput) onInput(+r.value); });
    r.paint = paint;
    paint();
    return r;
  }
  function seg(items, cur, onChange) {
    var box = h('div', { class: 'sy-seg', role: 'radiogroup' });
    items.forEach(function (it) {
      var b = h('button', { type: 'button', class: 'sy-seg-b' + (it.id === cur ? ' is-on' : ''), role: 'radio', 'aria-checked': it.id === cur ? 'true' : 'false', dataset: { val: it.id } }, it.label);
      b.addEventListener('click', function () {
        [].forEach.call(box.children, function (c) { var on = c === b; c.classList.toggle('is-on', on); c.setAttribute('aria-checked', on ? 'true' : 'false'); });
        if (onChange) onChange(it.id);
      });
      box.appendChild(b);
    });
    return box;
  }
  function btn(text, fn, cls) {
    var b = h('button', { type: 'button', class: 'sy-btn' + (cls ? ' ' + cls : '') }, text);
    if (fn) b.addEventListener('click', fn);
    return b;
  }
  function icoCircle(name, on, size) {   // the round toggle used in Control Center
    var c = h('span', { class: 'sy-cic' + (on ? ' is-on' : '') });
    c.appendChild(glyph(name, size || 17, 1.8));
    return c;
  }

  /* the avatar used on the lock screen, in Settings and in the notification header: a plain person on a grey disc (our own drawing) */
  function avatar(px) {
    var a = h('span', { class: 'sy-avatar', style: { width: px + 'px', height: px + 'px' } });
    a.innerHTML = '<svg viewBox="0 0 64 64" width="' + px + '" height="' + px + '" aria-hidden="true"><defs><linearGradient id="sy-av-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c8ccd4"/><stop offset="1" stop-color="#8c929e"/></linearGradient></defs><circle cx="32" cy="32" r="32" fill="url(#sy-av-g)"/><circle cx="32" cy="25" r="10.5" fill="#f3f4f6"/><path d="M11 56a21 21 0 0 1 42 0A31.5 31.5 0 0 1 32 64a31.5 31.5 0 0 1-21-8z" fill="#f3f4f6"/></svg>';
    return a;
  }
  function uiHost(win) { return win && win.el ? win : null; }

  /* ================================================================== About This Mac, Force Quit, power dialogs, lock screen, sleep */
  var ZH_DAY = ['日', '一', '二', '三', '四', '五', '六'];
  function h12(d) { var x = d.getHours() % 12; return x === 0 ? 12 : x; }
  function closeTransient() {
    try { if (LAB.menu) LAB.menu.closeAll(); } catch (e) { /* ignore */ }
    try { if (LAB.desktop && LAB.desktop.closeSpotlight) LAB.desktop.closeSpotlight(); } catch (e2) { /* ignore */ }
    try { if (LAB.desktop && LAB.desktop.closePopover) LAB.desktop.closePopover(); } catch (e3) { /* ignore */ }
    try { if (sys.closePanels) sys.closePanels(); } catch (e4) { /* ignore */ }
  }

  /* ---- a laptop drawn from a few shapes (screen shows a soft lake-and-ridge scene) ---- */
  function laptopSvg(w) {
    var s = h('span', { class: 'sy-laptop', 'aria-hidden': 'true' });
    s.innerHTML = '<svg viewBox="0 0 240 150" width="' + w + '" height="' + Math.round(w * 150 / 240) + '">' +
      '<defs><linearGradient id="sy-lap-s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7cb7d8"/><stop offset=".6" stop-color="#2f84a8"/><stop offset="1" stop-color="#175a74"/></linearGradient>' +
      '<linearGradient id="sy-lap-b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e3e5ea"/><stop offset="1" stop-color="#b6bac3"/></linearGradient></defs>' +
      '<rect x="38" y="8" width="164" height="108" rx="9" fill="#2a2c31"/><rect x="43" y="13" width="154" height="98" rx="4" fill="url(#sy-lap-s)"/>' +
      '<path d="M43 92l30-22 22 16 26-24 34 26 42-14v37H43z" fill="#0f4a62" opacity=".55"/><path d="M43 100l40-14 28 10 36-12 50 14v13H43z" fill="#0b3a4e" opacity=".6"/>' +
      '<rect x="112" y="9" width="16" height="3.4" rx="1.7" fill="#101114"/>' +
      '<path d="M16 117h208l-8 12a9 9 0 0 1-7.5 4H31.5a9 9 0 0 1-7.5-4z" fill="url(#sy-lap-b)"/><rect x="100" y="117" width="40" height="5" rx="2.5" fill="#a3a8b2"/></svg>';
    return s;
  }

  function openAboutMac() {
    var root = h('div', { class: 'sy-ab', dataset: { lab: 'aboutmac' } });
    var rows = h('div', { class: 'sy-ab-rows' });
    [['晶片', HW.chip], ['記憶體', HW.ram], ['序號', HW.serial]].forEach(function (r) {
      rows.appendChild(h('div', { class: 'sy-ab-row' }, h('span', { class: 'sy-ab-k' }, r[0]), h('span', { class: 'sy-ab-v' }, r[1])));
    });
    root.appendChild(laptopSvg(176));
    root.appendChild(h('div', { class: 'sy-ab-name' }, HW.model));
    root.appendChild(h('div', { class: 'sy-ab-sub' }, HW.size + '，' + HW.year + ' 年'));
    root.appendChild(rows);
    root.appendChild(h('div', { class: 'sy-ab-os' }, HW.os + ' ' + HW.ver));
    root.appendChild(btn('更多資訊…', function () { sys.openSettings('general', 'about'); }, 'sy-ab-more'));
    var win = LAB.wm.open({
      appId: 'aboutmac', title: '關於這台 Mac', width: 288, height: 428, minW: 288, minH: 428, resizable: false, bar: 'hidden',
      singleton: 'aboutmac', content: root, icon: 'app-settings'
    });
    return win;
  }
  sys.aboutThisMac = openAboutMac;

  /* ---- Force Quit ---- */
  function quitApp(id) {
    if (id === 'finder') { LAB.wm.byApp('finder').slice().forEach(function (w) { w.close(true); }); return true; }
    return LAB.apps.quit(id, { force: true });
  }
  var NOT_LISTED = { quicklook: 1, forcequit: 1, aboutmac: 1, launchpad: 1, archive: 1 };
  function openForceQuit() {
    var sel = null, win = null;
    var list = h('div', { class: 'sy-fq-list', role: 'listbox', 'aria-label': '正在執行的 App', tabindex: '0', dataset: { lab: 'fq-list' } });
    var go = btn('強制結束', null, 'is-primary');
    go.setAttribute('data-lab', 'fq-quit');
    go.disabled = true;
    function ids() {
      var out = [];
      LAB.apps.running().forEach(function (id) { if (!NOT_LISTED[id] && LAB.apps.get(id)) out.push(id); });
      out.sort(function (a, b) { return (a === 'finder' ? -1 : 0) - (b === 'finder' ? -1 : 0); });
      return out;
    }
    function render() {
      var all = ids();
      if (sel && all.indexOf(sel) < 0) sel = null;
      list.textContent = '';
      all.forEach(function (id) {
        var d = LAB.apps.get(id);
        var r = h('div', { class: 'sy-fq-row' + (id === sel ? ' is-sel' : ''), role: 'option', 'aria-selected': id === sel ? 'true' : 'false', dataset: { lab: 'fq-row', app: id } }, ico(d.icon, 22), h('span', { class: 'sy-fq-name' }, d.title));
        r.addEventListener('click', function () { sel = id; render(); });
        list.appendChild(r);
      });
      go.disabled = !sel;
      go.textContent = sel === 'finder' ? '重新啟動' : '強制結束';
    }
    go.addEventListener('click', function () {
      if (!sel) return;
      var id = sel, d = LAB.apps.get(id), fin = id === 'finder';
      LAB.ui.alert(win, {
        title: fin ? '您確定要重新啟動 Finder 嗎？' : '您確定要強制結束「' + d.title + '」嗎？',
        text: fin ? '' : '如果您強制結束某個 App，您將會遺失尚未儲存的任何更動內容。',
        buttons: [{ label: '取消', value: false, cancel: true }, { label: fin ? '重新啟動' : '強制結束', value: true, 'default': true }]
      }).then(function (ok) { if (ok) { quitApp(id); sel = null; render(); } });
    });
    var root = h('div', { class: 'sy-fq' },
      h('div', { class: 'sy-fq-head' }, '如果某個 App 沒有回應，請選取它，然後按「強制結束」。'),
      list,
      h('div', { class: 'sy-fq-foot' }, h('span', { class: 'sy-fq-tip' }, '也可以按 ⌥⌘⎋ 開啟這個視窗。'), go));
    win = LAB.wm.open({ appId: 'forcequit', title: '強制結束應用程式', width: 392, height: 330, minW: 392, minH: 330, resizable: false, bar: 'plain', singleton: 'forcequit', content: root, icon: 'app-forcequit' });
    win.own(LAB.bus.on('app:launch', render));
    win.own(LAB.bus.on('app:quit', render));
    render();
    return win;
  }
  sys.forceQuit = openForceQuit;

  /* ---- sleep, restart, shut down, log out ---- */
  var POWER = {
    restart: { title: '您確定要現在重新啟動您的電腦嗎？', ok: '重新啟動' },
    shutdown: { title: '您確定要現在關閉您的電腦嗎？', ok: '關機' },
    logout: { title: '您確定要登出使用者「an」嗎？', ok: '登出' }
  };
  /* the practice Mac has nothing to restart: after the question, the session ends the same way 「中斷連線」 does (LAB.remote.disconnect) */
  function powerDialog(kind) {
    var spec = POWER[kind];
    if (!spec) return Promise.resolve(false);
    closeTransient();
    return LAB.ui.alert(null, {
      title: spec.title,
      text: '練習版：按「' + spec.ok + '」會結束遠端連線，回到課程頁面。',
      buttons: [{ label: '取消', value: false, cancel: true }, { label: spec.ok, value: true, 'default': true }]
    }).then(function (ok) {
      if (ok === true) {
        try { LAB.bus.emit('sys:power', { kind: kind }); } catch (e) { /* ignore */ }
        if (LAB.remote && LAB.remote.disconnect) LAB.remote.disconnect();
        else toastLab('已結束連線（練習版）');
      }
      return ok === true;
    });
  }
  sys.restart = function () { return powerDialog('restart'); };
  sys.shutdown = function () { return powerDialog('shutdown'); };
  sys.logout = function () { return powerDialog('logout'); };

  /* ---- lock screen: wallpaper blurred, date and time, the avatar and 「an」; a click or Enter unlocks, no password ---- */
  var lockEl = null, lockTimer = 0, lockOff = null;
  sys.isLocked = function () { return !!lockEl; };
  sys.lock = function () {
    if (lockEl) return;
    closeTransient();
    var st = stageEl();
    if (!st) return;
    var wall = document.getElementById('lab-wall');
    var bg = h('div', { class: 'sy-lock-bg' });
    if (wall) {
      var cs = window.getComputedStyle(wall);
      bg.style.backgroundImage = cs.backgroundImage; bg.style.backgroundSize = cs.backgroundSize;
      bg.style.backgroundPosition = cs.backgroundPosition; bg.style.backgroundColor = cs.backgroundColor; bg.style.backgroundRepeat = cs.backgroundRepeat;
    }
    var dateEl = h('div', { class: 'sy-lock-date' }), timeEl = h('div', { class: 'sy-lock-time' });
    function tick() {
      var n = LAB.clock.now();
      dateEl.textContent = (n.getMonth() + 1) + '月' + n.getDate() + '日 週' + ZH_DAY[n.getDay()];
      timeEl.textContent = h12(n) + ':' + p2(n.getMinutes());
    }
    tick();
    var back = document.activeElement;
    lockEl = h('div', { class: 'sy-lock', role: 'dialog', 'aria-modal': 'true', 'aria-label': '鎖定螢幕', tabindex: '-1', dataset: { lab: 'lock-screen' } },
      bg,
      h('div', { class: 'sy-lock-top' }, dateEl, timeEl),
      h('div', { class: 'sy-lock-user' }, avatar(76), h('div', { class: 'sy-lock-name' }, 'an'),
        h('div', { class: 'sy-lock-hint' }, '點一下或按 Enter 解鎖'), h('div', { class: 'sy-lock-note' }, '練習版：不用輸入密碼')));
    function unlock() {
      if (!lockEl) return;
      var el = lockEl; lockEl = null;
      if (lockOff) { lockOff(); lockOff = null; }
      clearInterval(lockTimer);
      el.classList.remove('is-in');
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, reduced() ? 0 : 260);
      try { if (back && back.focus && document.contains(back)) back.focus(); } catch (e) { /* ignore */ }
      try { LAB.bus.emit('sys:unlock', {}); } catch (e2) { /* ignore */ }
    }
    lockEl.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
    lockEl.addEventListener('click', function (e) { e.stopPropagation(); unlock(); });
    ['mousedown', 'contextmenu'].forEach(function (n) { lockEl.addEventListener(n, function (e) { e.stopPropagation(); }); });
    lockOff = LAB.keys.modal(function (e) {
      if (/^F\d+$/.test(e.key)) return false;
      if (e.key === 'Enter' || e.key === ' ') { if (!LAB.ui.isImeEnter(e)) unlock(); }
      return true;                                        // the Mac behind the lock takes no keys
    });
    lockTimer = setInterval(tick, 15000);
    st.appendChild(lockEl);
    try { lockEl.focus({ preventScroll: true }); } catch (e3) { /* ignore */ }
    requestAnimationFrame(function () { requestAnimationFrame(function () { if (lockEl) lockEl.classList.add('is-in'); }); });
    try { LAB.bus.emit('sys:lock', {}); } catch (e4) { /* ignore */ }
    sys.unlock = unlock;
  };
  sys.unlock = function () { /* replaced while locked */ };

  /* ---- sleep: a black screen until a click or any key (a real Mac wakes the same way) ---- */
  var sleepEl = null, sleepOff = null;
  sys.isAsleep = function () { return !!sleepEl; };
  sys.sleep = function () {
    if (sleepEl) return;
    closeTransient();
    var st = stageEl();
    if (!st) return;
    sleepEl = h('div', { class: 'sy-sleep', role: 'dialog', 'aria-modal': 'true', 'aria-label': '睡眠中', tabindex: '-1', dataset: { lab: 'sleep-screen' } },
      h('div', { class: 'sy-sleep-note' }, '練習版：點一下或按任何鍵喚醒'));
    function wake() {
      if (!sleepEl) return;
      var el = sleepEl; sleepEl = null;
      if (sleepOff) { sleepOff(); sleepOff = null; }
      el.classList.remove('is-in');
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, reduced() ? 0 : 300);
      try { LAB.bus.emit('sys:wake', {}); } catch (e) { /* ignore */ }
    }
    ['pointerdown', 'mousedown', 'click', 'contextmenu'].forEach(function (n) { sleepEl.addEventListener(n, function (e) { e.stopPropagation(); if (n === 'click') wake(); }); });
    sleepOff = LAB.keys.modal(function (e) {
      if (/^F\d+$/.test(e.key)) return false;
      if (e.key !== 'Shift' && e.key !== 'Control' && e.key !== 'Alt' && e.key !== 'Meta') wake();
      return true;
    });
    st.appendChild(sleepEl);
    try { sleepEl.focus({ preventScroll: true }); } catch (e2) { /* ignore */ }
    requestAnimationFrame(function () { requestAnimationFrame(function () { if (sleepEl) sleepEl.classList.add('is-in'); }); });
    try { LAB.bus.emit('sys:sleep', {}); } catch (e3) { /* ignore */ }
    sys.wake = wake;
  };
  sys.wake = function () { /* replaced while asleep */ };

  /* ================================================================== Control Center, Notification Center, Wi-Fi panel (menu bar)
     They open through LAB.desktop.openPopover (desktop.js), which closes them on a click outside or Esc. Built on every open from
     LAB.sys.state, so nothing runs while they are closed. */
  GL.cloud = '<path d="M7.2 18.4a4.2 4.2 0 0 1-.5-8.4 5.6 5.6 0 0 1 10.6-1.2 4.8 4.8 0 0 1 .4 9.6z"/>';
  GL.suncloud = '<circle cx="8.6" cy="8.4" r="2.8"/><path d="M8.6 2.8v1.2M2.9 8.4h1.2M4.6 4.4l.9.9M12.6 4.4l-.9.9"/><path d="M9.4 19a3.6 3.6 0 0 1-.3-7.2 4.8 4.8 0 0 1 9.1 1 4.1 4.1 0 0 1 .1 6.2z"/>';

  function openPop(btn, node, width, opts) {
    if (LAB.desktop && LAB.desktop.openPopover) { LAB.desktop.openPopover(btn, node, width, opts); return true; }
    return false;
  }

  /* ---- Control Center ---- */
  function ccTile(cls) { return h('div', { class: 'sy-tile ' + (cls || '') }); }
  function buildControlCenter() {
    var root = h('div', { class: 'sy-cc', dataset: { lab: 'control-center' } });
    function toggleRow(key, glyphName, title, subFn, getOn, setOn) {
      var c = icoCircle(glyphName, getOn()), sub = h('span', { class: 'sy-cc-sub' }, subFn());
      var b = h('button', { type: 'button', class: 'sy-cc-row', 'aria-pressed': getOn() ? 'true' : 'false', dataset: { lab: 'cc-' + key } },
        c, h('span', { class: 'sy-cc-txt' }, h('span', { class: 'sy-cc-t' }, title), sub));
      b.addEventListener('click', function () {
        var v = !getOn();
        setOn(v);
        c.classList.toggle('is-on', v); b.setAttribute('aria-pressed', v ? 'true' : 'false'); sub.textContent = subFn();
      });
      return b;
    }
    var conn = ccTile('sy-cc-conn');
    conn.appendChild(toggleRow('wifi', 'wifi', 'Wi-Fi', function () { return state.wifi ? NET.ssid : '已關閉'; }, function () { return state.wifi; }, function (v) { sys.setWifi(v); }));
    conn.appendChild(toggleRow('bluetooth', 'bluetooth', '藍牙', function () { return state.bluetooth ? '開啟' : '關閉'; }, function () { return state.bluetooth; }, function (v) { state.bluetooth = v; emit('bluetooth', v); }));
    conn.appendChild(toggleRow('airdrop', 'airdrop', 'AirDrop', function () { return state.airdrop ? '僅限聯絡人' : '接收關閉'; }, function () { return state.airdrop; }, function (v) { state.airdrop = v; emit('airdrop', v); }));
    var focus = ccTile('sy-cc-small');
    focus.appendChild(toggleRow('focus', 'moon', '專注模式', function () { return state.focus ? '勿擾模式' : '關閉'; }, function () { return state.focus; }, function (v) { state.focus = v; emit('focus', v); }));
    var dark = ccTile('sy-cc-small');
    dark.appendChild(toggleRow('dark', 'half', '深色模式', function () { return isDark() ? '開啟' : '關閉'; }, function () { return isDark(); }, function (v) { sys.setAppearance(v ? 'dark' : 'light'); }));
    var right = h('div', { class: 'sy-cc-right' }, focus, dark);
    root.appendChild(h('div', { class: 'sy-cc-top' }, conn, right));

    function sliderTile(key, title, glyphName, val, min, onInput) {
      var r = range(min, 100, val, onInput, title);
      r.setAttribute('data-lab', 'cc-' + key);
      var t = ccTile('sy-cc-slider');
      t.appendChild(h('div', { class: 'sy-cc-st' }, title));
      t.appendChild(h('div', { class: 'sy-cc-sw' }, h('span', { class: 'sy-cc-sg' }, glyph(glyphName, 16, 1.9)), r));
      return t;
    }
    root.appendChild(sliderTile('brightness', '顯示器', 'sun', state.brightness, 0, function (v) { sys.setBrightness(v); }));
    root.appendChild(sliderTile('volume', '聲音', 'speaker', state.volume, 0, function (v) { sys.setVolume(v); }));
    var np = ccTile('sy-cc-np');
    np.appendChild(h('span', { class: 'sy-cc-npi' }, glyph('note', 20, 1.6)));
    np.appendChild(h('span', { class: 'sy-cc-txt' }, h('span', { class: 'sy-cc-t' }, '正在播放'), h('span', { class: 'sy-cc-sub', dataset: { lab: 'cc-nowplaying' } }, '未在播放')));
    root.appendChild(np);
    return root;
  }
  sys.openControlCenter = function (btn) {
    var node = buildControlCenter();
    return openPop(btn, node, 336, { cls: 'sy-pop sy-cc-pop', right: 8, label: '控制中心' });
  };

  /* ---- Notification Center: calendar, weather (fake: Taipei 26°) and reminders ---- */
  function calendarWidget() {
    var now = LAB.clock.now(), y = now.getFullYear(), m = now.getMonth(), today = now.getDate();
    var first = new Date(y, m, 1).getDay(), days = new Date(y, m + 1, 0).getDate(), prevDays = new Date(y, m, 0).getDate();
    var grid = h('div', { class: 'sy-cal-grid' });
    ZH_DAY.forEach(function (d) { grid.appendChild(h('span', { class: 'sy-cal-wd' }, d)); });
    var cells = Math.ceil((first + days) / 7) * 7;
    for (var i = 0; i < cells; i++) {
      var n = i - first + 1, other = n < 1 || n > days, label = n < 1 ? prevDays + n : (n > days ? n - days : n);
      grid.appendChild(h('span', { class: 'sy-cal-d' + (other ? ' is-other' : '') + (!other && n === today ? ' is-today' : ''), dataset: { today: !other && n === today ? '1' : null } }, String(label)));
    }
    return h('div', { class: 'sy-tile sy-nc-w sy-nc-cal', dataset: { lab: 'nc-calendar' } },
      h('div', { class: 'sy-cal-head' }, h('span', { class: 'sy-cal-mon' }, (m + 1) + '月'), h('span', { class: 'sy-cal-yr' }, y + '年')), grid);
  }
  function weatherWidget() {
    var hours = [['現在', 26, 'suncloud'], ['11時', 27, 'suncloud'], ['12時', 28, 'sun'], ['13時', 29, 'sun'], ['14時', 29, 'suncloud'], ['15時', 28, 'cloud']];
    var strip = h('div', { class: 'sy-wx-hours' });
    hours.forEach(function (x) { strip.appendChild(h('div', { class: 'sy-wx-h' }, h('span', null, x[0]), glyph(x[2], 18, 1.5), h('span', { class: 'sy-wx-hd' }, x[1] + '°'))); });
    return h('div', { class: 'sy-tile sy-nc-w sy-nc-wx', dataset: { lab: 'nc-weather' } },
      h('div', { class: 'sy-wx-top' },
        h('div', null, h('div', { class: 'sy-wx-city' }, '台北市'), h('div', { class: 'sy-wx-deg' }, '26°')),
        h('div', { class: 'sy-wx-side' }, glyph('suncloud', 22, 1.5), h('div', { class: 'sy-wx-cond' }, '多雲時晴'), h('div', { class: 'sy-wx-hl' }, '最高 29°　最低 23°'))),
      strip);
  }
  function remindersWidget() {
    var items = ['交 Week 3 作業', '把 Project 資料夾整理好', '預習 Week 4 的內容'];
    var box = h('div', { class: 'sy-tile sy-nc-w sy-nc-rem', dataset: { lab: 'nc-reminders' } });
    var count = h('span', { class: 'sy-rem-n' });
    box.appendChild(h('div', { class: 'sy-rem-head' }, h('span', { class: 'sy-rem-t' }, '提醒事項'), count));
    function upd() { count.textContent = String(state.reminders.filter(function (d) { return !d; }).length); }
    items.forEach(function (txt, i) {
      var c = h('button', { type: 'button', class: 'sy-rem-c' + (state.reminders[i] ? ' is-done' : ''), role: 'checkbox', 'aria-checked': state.reminders[i] ? 'true' : 'false', 'aria-label': txt });
      var row = h('div', { class: 'sy-rem-row' + (state.reminders[i] ? ' is-done' : '') }, c, h('span', { class: 'sy-rem-x' }, txt));
      c.addEventListener('click', function () {
        state.reminders[i] = !state.reminders[i];
        c.classList.toggle('is-done', state.reminders[i]); row.classList.toggle('is-done', state.reminders[i]); c.setAttribute('aria-checked', state.reminders[i] ? 'true' : 'false'); upd();
      });
      box.appendChild(row);
    });
    upd();
    return box;
  }
  sys.openNotificationCenter = function (btn) {
    var root = h('div', { class: 'sy-nc', dataset: { lab: 'notification-center' } },
      h('div', { class: 'sy-nc-none' }, '沒有新的通知'), calendarWidget(), weatherWidget(), remindersWidget());
    return openPop(btn, root, 352, { cls: 'sy-pop sy-nc-pop', right: 8, label: '通知中心' });
  };

  /* ---- Wi-Fi panel (the glyph in the menu bar) ---- */
  sys.openWifiPanel = function (btn) {
    var root = h('div', { class: 'sy-wifi', dataset: { lab: 'wifi-panel' } });
    var head = h('div', { class: 'sy-wifi-head' }, h('span', { class: 'sy-wifi-t' }, 'Wi-Fi'));
    var list = h('div', { class: 'sy-wifi-list' });
    var s = sw(state.wifi, function (v) { sys.setWifi(v); render(); }, 'Wi-Fi');
    s.setAttribute('data-lab', 'wifi-switch');
    head.appendChild(s);
    function net(name, locked, on, sub) {
      var r = h('button', { type: 'button', class: 'sy-wifi-row' + (on ? ' is-on' : ''), dataset: { lab: 'wifi-net', ssid: name } },
        h('span', { class: 'sy-wifi-c' }, on ? glyph('check', 14, 2.4) : null), h('span', { class: 'sy-wifi-n' }, name, sub ? h('small', null, sub) : null),
        locked ? glyph('lock', 14, 1.7) : null, glyph('wifi', 16, 1.9));
      r.addEventListener('click', function () { if (!on) toastLab('練習版只能連到 ' + NET.ssid); });
      return r;
    }
    function render() {
      list.textContent = '';
      if (state.wifi) {
        list.appendChild(net(NET.ssid, true, true, '已連線'));
        list.appendChild(h('div', { class: 'sy-wifi-sec' }, '其他網路'));
        list.appendChild(net('NTNU-Guest', false, false));
        list.appendChild(net('eduroam', true, false));
        list.appendChild(net('TANetRoaming', false, false));
      } else {
        list.appendChild(h('div', { class: 'sy-wifi-off' }, 'Wi-Fi 已關閉'));
      }
    }
    render();
    root.appendChild(head); root.appendChild(list);
    var more = h('button', { type: 'button', class: 'sy-wifi-more', dataset: { lab: 'wifi-settings' } }, 'Wi-Fi 設定⋯');
    more.addEventListener('click', function () { if (LAB.desktop && LAB.desktop.closePopover) LAB.desktop.closePopover(); sys.openSettings('wifi'); });
    root.appendChild(more);
    return openPop(btn, root, 300, { cls: 'sy-pop sy-wifi-pop', label: 'Wi-Fi' });
  };

  /* ================================================================== 系統設定 (settings)
     Sidebar with a search field, a header with back / forward, and panes that really work: Wi-Fi, 一般 › 關於 (SPEC §1), 外觀 (light and
     dark switch the whole Mac, plus the accent colour), 桌面與 Dock (size, magnification, indicators), 桌布 (the Tahoe photo, three
     drawn wallpapers, plain colours), 聲音 and 顯示器 (the same sliders as Control Center). 螢幕保護程式, 鍵盤, 滑鼠, 使用者與群組 are screens. */
  function sbIcon(color, g) {
    var s = h('span', { class: 'sy-sbi', style: { background: color } });
    s.appendChild(glyph(g, 14, 1.9));
    return s;
  }
  function grp(rows) { return h('div', { class: 'sy-grp' }, rows); }
  function rw(label, ctrl, sub, cls) {
    return h('div', { class: 'sy-rw' + (cls ? ' ' + cls : '') },
      h('div', { class: 'sy-rw-l' }, h('div', { class: 'sy-rw-t' }, label), sub ? h('div', { class: 'sy-rw-s' }, sub) : null),
      h('div', { class: 'sy-rw-c' }, ctrl));
  }
  function kv(label, value) { return rw(label, h('span', { class: 'sy-rw-v' }, value)); }
  function cap(text) { return h('div', { class: 'sy-cap' }, text); }
  function bigHead(title, sub, art) { return h('div', { class: 'sy-bighead' }, art || null, h('div', { class: 'sy-bh-t' }, title), sub ? h('div', { class: 'sy-bh-s' }, sub) : null); }

  var STORAGE = [   // GB, colour: sums to the used space of SPEC §1 (494.38 - 312.6 = 181.78)
    ['應用程式', 38.2, '#4c9be8'], ['文件', 21.4, '#e8a64c'], ['照片', 12.9, '#5fbf7a'], ['macOS', 79.8, '#9b9ba3'], ['系統資料', 29.48, '#c9c9ce']
  ];

  function paneWifi(S) {
    var root = h('div'), detailOpen = false;
    function render() {
      root.textContent = '';
      var s = sw(state.wifi, function (v) { sys.setWifi(v); render(); }, 'Wi-Fi');
      s.setAttribute('data-lab', 'set-wifi-switch');
      root.appendChild(grp([rw('Wi-Fi', s)]));
      if (!state.wifi) { root.appendChild(h('div', { class: 'sy-note' }, 'Wi-Fi 已關閉。打開後，Mac 會自動連到已知的網路。')); return; }
      var det = btn(detailOpen ? '收合' : '詳細資料⋯', function () { detailOpen = !detailOpen; render(); });
      det.setAttribute('data-lab', 'set-wifi-details');
      root.appendChild(cap('已知的網路'));
      root.appendChild(grp([rw(h('span', { class: 'sy-rw-wf' }, glyph('wifi', 16, 1.9), NET.ssid), det, '已連線')]));
      if (detailOpen) {
        root.appendChild(grp([kv('IP 位址', NET.ip), kv('子網路遮罩', NET.mask), kv('路由器', NET.gw), kv('DNS 伺服器', NET.dns), kv('硬體位址', NET.mac), kv('介面', NET.iface)]));
      }
      root.appendChild(cap('其他網路'));
      root.appendChild(grp(['NTNU-Guest', 'eduroam', 'TANetRoaming'].map(function (n) {
        var b = btn('連線', function () { toastLab('練習版只能連到 ' + NET.ssid); });
        return rw(h('span', { class: 'sy-rw-wf' }, glyph('wifi', 16, 1.9), n), b);
      })));
    }
    render();
    return root;
  }
  function paneBluetooth() {
    var root = h('div');
    root.appendChild(grp([rw('藍牙', sw(state.bluetooth, function (v) { state.bluetooth = v; emit('bluetooth', v); }, '藍牙'), '這台 Mac 現在可以被附近的藍牙裝置找到，名稱是「' + HW.hostName + '」。')]));
    root.appendChild(cap('我的裝置'));
    root.appendChild(h('div', { class: 'sy-empty' }, '沒有連接的裝置'));
    return root;
  }
  function paneSound() {
    var root = h('div'), r = range(0, 100, state.volume, function (v) { sys.setVolume(v); }, '輸出音量');
    r.setAttribute('data-lab', 'set-volume');
    root.appendChild(grp([rw('輸出音量', h('div', { class: 'sy-slidebox' }, glyph('speaker', 16, 1.7), r))]));
    root.appendChild(cap('輸出'));
    root.appendChild(grp([rw('MacBook Air 揚聲器', glyph('check', 16, 2.2), '內建')]));
    return root;
  }
  function paneDisplay() {
    var root = h('div'), r = range(0, 100, state.brightness, function (v) { sys.setBrightness(v); }, '亮度');
    r.setAttribute('data-lab', 'set-brightness');
    root.appendChild(grp([rw('亮度', h('div', { class: 'sy-slidebox' }, glyph('sun', 16, 1.7), r))]));
    root.appendChild(grp([kv('內建顯示器', HW.display + '（' + HW.res + '）'), kv('更新率', '60 赫茲')]));
    return root;
  }

  function paneGeneral(S, sub) {
    var root = h('div');
    if (sub === 'about') {
      root.appendChild(bigHead(HW.model, HW.size + '，' + HW.year + ' 年', laptopSvg(150)));
      root.appendChild(grp([kv('名稱', HW.computerName)]));
      root.appendChild(grp([kv('晶片', HW.chip), kv('記憶體', HW.ram), kv('序號', HW.serial), kv('macOS', '' + HW.os.replace('macOS ', '') + ' ' + HW.ver)]));
      root.appendChild(cap('更多'));
      root.appendChild(grp([kv('型號識別碼', HW.modelId), kv('主機名稱', HW.hostName + '.local'), kv('組建', HW.build)]));
      root.appendChild(cap('顯示器'));
      root.appendChild(grp([kv('內建顯示器', HW.display + '（' + HW.res + '）')]));
      root.appendChild(cap('儲存空間'));
      root.appendChild(grp([kv(HW.disk, fmtNum(HW.diskFree, 1) + ' GB 可用（共 ' + fmtNum(HW.diskTotal, 2) + ' GB）')]));
      root.appendChild(h('div', { class: 'sy-actions' }, btn('系統報告⋯', function () { toastLab('練習版沒有系統報告'); })));
      return root;
    }
    if (sub === 'update') {
      root.appendChild(bigHead('macOS Tahoe ' + HW.ver, '你的 Mac 已是最新。', null));
      root.appendChild(grp([rw('自動保持 Mac 最新', sw(true, null, '自動保持 Mac 最新'))]));
      return root;
    }
    if (sub === 'storage') {
      var used = 0;
      STORAGE.forEach(function (s) { used += s[1]; });
      var bar = h('div', { class: 'sy-stbar', role: 'img', 'aria-label': HW.disk + '的使用情形' }), legend = h('div', { class: 'sy-stlegend' });
      STORAGE.forEach(function (s) {
        bar.appendChild(h('i', { style: { width: (s[1] / HW.diskTotal * 100).toFixed(2) + '%', background: s[2] } }));
        legend.appendChild(h('div', { class: 'sy-stl' }, h('i', { style: { background: s[2] } }), h('span', null, s[0]), h('b', null, fmtNum(s[1], 1) + ' GB')));
      });
      root.appendChild(h('div', { class: 'sy-grp sy-st' },
        h('div', { class: 'sy-st-head' }, h('b', null, HW.disk), h('span', null, '已使用 ' + fmtNum(used, 2) + ' GB，共 ' + fmtNum(HW.diskTotal, 2) + ' GB')),
        bar, legend,
        h('div', { class: 'sy-st-free' }, fmtNum(HW.diskFree, 1) + ' GB 可用')));
      return root;
    }
    var items = [['關於', 'about'], ['軟體更新', 'update'], ['儲存空間', 'storage'], ['日期與時間', null], ['語言與地區', null]];
    root.appendChild(grp(items.map(function (it) {
      var b = h('button', { type: 'button', class: 'sy-rw sy-rw-btn', dataset: { lab: 'set-general-' + (it[1] || 'x') } }, h('div', { class: 'sy-rw-l' }, h('div', { class: 'sy-rw-t' }, it[0])), h('div', { class: 'sy-rw-c' }, glyph('chev', 14, 2)));
      b.addEventListener('click', function () { if (it[1]) S.go('general', it[1]); else toastLab('練習版沒有這個頁面'); });
      return b;
    })));
    return root;
  }

  function appearanceCard(id, label, cur, onPick) {
    var thumb = h('span', { class: 'sy-ap-th is-' + id });
    thumb.innerHTML = '<i class="a"></i><i class="b"></i><i class="c"></i><i class="d"></i>';
    var b = h('button', { type: 'button', class: 'sy-ap' + (cur === id ? ' is-on' : ''), role: 'radio', 'aria-checked': cur === id ? 'true' : 'false', dataset: { lab: 'set-appearance-' + id } }, thumb, h('span', { class: 'sy-ap-l' }, label));
    b.addEventListener('click', function () { onPick(id); });
    return b;
  }
  function paneAppearance() {
    var root = h('div');
    var cards = h('div', { class: 'sy-aprow', role: 'radiogroup', 'aria-label': '外觀' });
    function pick(id) {
      sys.setAppearance(id);
      [].forEach.call(cards.children, function (c) { var on = c.getAttribute('data-lab') === 'set-appearance-' + id; c.classList.toggle('is-on', on); c.setAttribute('aria-checked', on ? 'true' : 'false'); });
    }
    [['light', '淺色'], ['dark', '深色'], ['auto', '自動']].forEach(function (x) { cards.appendChild(appearanceCard(x[0], x[1], state.appearance, pick)); });
    root.appendChild(grp([h('div', { class: 'sy-rw sy-rw-col' }, h('div', { class: 'sy-rw-t' }, '外觀'), cards)]));
    var dots = h('div', { class: 'sy-dots', role: 'radiogroup', 'aria-label': '強調色' });
    ACCENTS.forEach(function (a) {
      var d = h('button', { type: 'button', class: 'sy-dot' + (state.accent === a.id ? ' is-on' : ''), role: 'radio', 'aria-checked': state.accent === a.id ? 'true' : 'false', 'aria-label': a.label, title: a.label, style: { '--c': a.color }, dataset: { lab: 'set-accent-' + a.id } });
      d.addEventListener('click', function () {
        sys.setAccent(a.id);
        [].forEach.call(dots.children, function (c) { var on = c === d; c.classList.toggle('is-on', on); c.setAttribute('aria-checked', on ? 'true' : 'false'); });
      });
      dots.appendChild(d);
    });
    root.appendChild(grp([rw('強調色', dots)]));
    root.appendChild(h('div', { class: 'sy-note' }, '深色和淺色會換掉選單列、Dock、Finder 和這些系統設定的顏色；終端機、Codex、Code 本來就有自己的配色。'));
    return root;
  }

  function paneDock() {
    var root = h('div'), P = (LAB.desktop && LAB.desktop.dock) ? LAB.desktop.dock : null;
    var prefs = P ? P.prefs : { size: 1, magnify: true, mag: 1.35, dots: true };
    function set(o) { if (P) P.set(o); }
    var size = range(0, 100, Math.round((prefs.size - 0.5) / 0.7 * 100), function (v) { set({ size: 0.5 + v / 100 * 0.7 }); }, 'Dock 大小');
    size.setAttribute('data-lab', 'set-dock-size');
    var magOn = sw(prefs.magnify, function (v) { set({ magnify: v }); mag.disabled = !v; }, '放大');
    magOn.setAttribute('data-lab', 'set-dock-magnify');
    var mag = range(0, 100, Math.round((prefs.mag - 1.1) / 0.6 * 100), function (v) { set({ mag: 1.1 + v / 100 * 0.6 }); }, '放大倍率');
    mag.disabled = !prefs.magnify;
    var dots = sw(prefs.dots, function (v) { set({ dots: v }); }, '顯示已開啟的 App 的指示燈');
    dots.setAttribute('data-lab', 'set-dock-dots');
    var pos = seg([{ id: 'left', label: '左側' }, { id: 'bottom', label: '下方' }, { id: 'right', label: '右側' }], 'bottom', function (id) {
      if (id !== 'bottom') { toastLab('練習版的 Dock 只能放在畫面下方'); [].forEach.call(pos.children, function (c) { var on = c.dataset.val === 'bottom'; c.classList.toggle('is-on', on); c.setAttribute('aria-checked', on ? 'true' : 'false'); }); }
    });
    root.appendChild(cap('Dock'));
    root.appendChild(grp([
      rw('大小', h('div', { class: 'sy-slidebox sy-w200' }, h('small', null, '小'), size, h('small', null, '大'))),
      rw('放大', magOn),
      rw('放大倍率', h('div', { class: 'sy-slidebox sy-w200' }, h('small', null, '小'), mag, h('small', null, '大'))),
      rw('在螢幕上的位置', pos),
      rw('顯示已開啟的 App 的指示燈', dots)
    ]));
    return root;
  }

  function wallItem(S, id, label, onPick) {
    var b = h('button', { type: 'button', class: 'sy-wi' + (state.wallpaper === id ? ' is-on' : ''), role: 'radio', 'aria-checked': state.wallpaper === id ? 'true' : 'false', 'aria-label': label, dataset: { lab: 'set-wall-' + id } },
      sys.wallThumb(id, 128, 80), h('span', { class: 'sy-wi-l' }, label));
    b.addEventListener('click', function () { onPick(id); });
    return b;
  }
  function paneWallpaper(S) {
    var root = h('div'), prev = h('div', { class: 'sy-wprev', dataset: { lab: 'set-wall-preview' } }), name = h('div', { class: 'sy-wname' });
    var grid = h('div', { class: 'sy-wgrid', role: 'radiogroup', 'aria-label': '圖片' }), cgrid = h('div', { class: 'sy-wgrid is-colors', role: 'radiogroup', 'aria-label': '顏色' });
    function label(id) {
      var l = id;
      WALLS.forEach(function (w) { if (w.id === id) l = w.label; });
      WALL_COLORS.forEach(function (w) { if (w.id === id) l = w.label; });
      return l;
    }
    function paintPrev() {
      var id = state.wallpaper, col = colorOf(id);
      prev.style.background = ''; prev.style.backgroundImage = '';
      if (col) prev.style.background = col;
      else if (id === 'tahoe') { prev.style.backgroundImage = 'url("img/wallpaper.jpg")'; prev.style.backgroundSize = 'cover'; prev.style.backgroundPosition = '60% 62%'; }
      else { prev.style.backgroundImage = 'url("' + wallUrl(id) + '")'; prev.style.backgroundSize = 'cover'; prev.style.backgroundPosition = 'center'; }
      name.textContent = label(id);
    }
    function pick(id) {
      sys.setWallpaper(id);
      paintPrev();
      [grid, cgrid].forEach(function (g) { [].forEach.call(g.children, function (c) { var on = c.getAttribute('data-lab') === 'set-wall-' + id; c.classList.toggle('is-on', on); c.setAttribute('aria-checked', on ? 'true' : 'false'); }); });
    }
    WALLS.forEach(function (w) { grid.appendChild(wallItem(S, w.id, w.label, pick)); });
    WALL_COLORS.forEach(function (w) { cgrid.appendChild(wallItem(S, w.id, w.label, pick)); });
    paintPrev();
    root.appendChild(h('div', { class: 'sy-grp sy-wcur' }, prev, h('div', { class: 'sy-wcur-t' }, h('div', { class: 'sy-wname-k' }, '目前的桌布'), name)));
    root.appendChild(cap('圖片'));
    root.appendChild(grid);
    root.appendChild(cap('顏色'));
    root.appendChild(cgrid);
    return root;
  }

  function paneSaver() {
    var root = h('div'), cur = state.screensaver;
    var grid = h('div', { class: 'sy-wgrid is-saver', role: 'radiogroup', 'aria-label': '螢幕保護程式' });
    [['drift', '漂移'], ['color', '色彩'], ['photo', '相片']].forEach(function (x) {
      var b = h('button', { type: 'button', class: 'sy-wi' + (cur === x[0] ? ' is-on' : ''), role: 'radio', 'aria-checked': cur === x[0] ? 'true' : 'false', dataset: { lab: 'set-saver-' + x[0] } }, h('span', { class: 'sy-wthumb sy-sv-' + x[0] }), h('span', { class: 'sy-wi-l' }, x[1]));
      b.addEventListener('click', function () {
        state.screensaver = x[0];
        [].forEach.call(grid.children, function (c) { var on = c === b; c.classList.toggle('is-on', on); c.setAttribute('aria-checked', on ? 'true' : 'false'); });
      });
      grid.appendChild(b);
    });
    root.appendChild(grid);
    var sel = h('select', { class: 'sy-select', 'aria-label': '開始前的閒置時間' });
    [[5, '5 分鐘'], [10, '10 分鐘'], [20, '20 分鐘'], [0, '永不']].forEach(function (o) { var op = h('option', { value: String(o[0]) }, o[1]); if (o[0] === state.saverMin) op.selected = true; sel.appendChild(op); });
    sel.addEventListener('change', function () { state.saverMin = +sel.value; });
    root.appendChild(grp([rw('開始前的閒置時間', sel), rw('以時鐘顯示', sw(false, null, '以時鐘顯示'))]));
    root.appendChild(h('div', { class: 'sy-note' }, '練習版只有設定畫面，螢幕保護程式不會真的啟動。'));
    return root;
  }
  function paneKeyboard() {
    var root = h('div');
    root.appendChild(grp([
      rw('按鍵重複速率', h('div', { class: 'sy-slidebox sy-w200' }, h('small', null, '慢'), range(0, 10, state.keyRepeat, function (v) { state.keyRepeat = v; }, '按鍵重複速率'), h('small', null, '快'))),
      rw('重複前延遲', h('div', { class: 'sy-slidebox sy-w200' }, h('small', null, '長'), range(0, 10, state.keyDelay, function (v) { state.keyDelay = v; }, '重複前延遲'), h('small', null, '短'))),
      rw('鍵盤亮度', h('div', { class: 'sy-slidebox sy-w200' }, glyph('sun', 14, 1.6), range(0, 100, state.keyLight, function (v) { state.keyLight = v; }, '鍵盤亮度')))
    ]));
    root.appendChild(grp([rw('使用 F1、F2 等鍵作為標準功能鍵', sw(false, null, '標準功能鍵'))]));
    root.appendChild(cap('輸入來源'));
    root.appendChild(grp([rw('注音', glyph('check', 16, 2.2)), rw('ABC', null)]));
    return root;
  }
  function paneMouse() {
    var root = h('div');
    root.appendChild(grp([
      rw('追蹤速度', h('div', { class: 'sy-slidebox sy-w200' }, h('small', null, '慢'), range(0, 10, state.track, function (v) { state.track = v; }, '追蹤速度'), h('small', null, '快'))),
      rw('捲動速度', h('div', { class: 'sy-slidebox sy-w200' }, h('small', null, '慢'), range(0, 10, state.scroll, function (v) { state.scroll = v; }, '捲動速度'), h('small', null, '快'))),
      rw('自然捲動', sw(state.naturalScroll, function (v) { state.naturalScroll = v; }, '自然捲動'), '捲動時內容會跟著手指移動的方向')
    ]));
    root.appendChild(h('div', { class: 'sy-note' }, '練習版只有設定畫面，不會改變瀏覽器裡滑鼠的反應。'));
    return root;
  }
  function paneUsers() {
    var root = h('div');
    root.appendChild(grp([h('div', { class: 'sy-rw sy-user' }, avatar(48), h('div', { class: 'sy-rw-l' }, h('div', { class: 'sy-rw-t' }, 'an'), h('div', { class: 'sy-rw-s' }, '管理員')), h('div', { class: 'sy-rw-c' }, glyph('check', 16, 2.2)))]));
    root.appendChild(grp([rw('密碼', btn('變更⋯', function () { toastLab('練習版不能變更密碼'); })), rw('登入時自動登入', sw(true, null, '自動登入'))]));
    root.appendChild(h('div', { class: 'sy-note' }, '這台練習用的 Mac 只有一個使用者，不需要輸入密碼。'));
    return root;
  }

  var PANES = [
    { id: 'wifi', label: 'Wi-Fi', color: '#0a84ff', gl: 'wifi', kw: 'wifi wi-fi 無線網路 ip dns ssid network internet', build: paneWifi },
    { id: 'bluetooth', label: '藍牙', color: '#0a84ff', gl: 'bluetooth', kw: 'bluetooth 藍芽', build: paneBluetooth },
    { sep: true },
    { id: 'sound', label: '聲音', color: '#ff453a', gl: 'speaker', kw: 'sound volume 音量 喇叭 揚聲器', build: paneSound },
    { id: 'display', label: '顯示器', color: '#0a84ff', gl: 'sun', kw: 'display brightness 亮度 螢幕 解析度', build: paneDisplay },
    { sep: true },
    { id: 'general', label: '一般', color: '#8e8e93', gl: 'gear', kw: 'general about 關於 序號 serial 晶片 chip 記憶體 memory 軟體更新 update 儲存空間 storage 版本 macos', build: paneGeneral },
    { id: 'appearance', label: '外觀', color: '#1c1c1e', gl: 'half', kw: 'appearance dark light 深色 淺色 暗色 亮色 外觀 強調色 accent 主題 theme', build: paneAppearance },
    { id: 'dock', label: '桌面與 Dock', color: '#3a3a3c', gl: 'dock', kw: 'dock desktop 桌面 放大 大小 指示燈', build: paneDock },
    { id: 'wallpaper', label: '桌布', color: '#32ade6', gl: 'image', kw: 'wallpaper 桌布 背景 背景圖片 圖片 顏色', build: paneWallpaper },
    { id: 'saver', label: '螢幕保護程式', color: '#5e5ce6', gl: 'screen', kw: 'screen saver 螢幕保護', build: paneSaver },
    { sep: true },
    { id: 'keyboard', label: '鍵盤', color: '#8e8e93', gl: 'keyboard', kw: 'keyboard 鍵盤 輸入 注音 input', build: paneKeyboard },
    { id: 'mouse', label: '滑鼠', color: '#8e8e93', gl: 'mouse', kw: 'mouse 滑鼠 捲動 追蹤 trackpad', build: paneMouse },
    { id: 'users', label: '使用者與群組', color: '#0a84ff', gl: 'users', kw: 'users 使用者 群組 密碼 account an', build: paneUsers }
  ];
  var PANE_BY = {};
  PANES.forEach(function (p) { if (p.id) PANE_BY[p.id] = p; });
  var SUB_TITLE = { about: '關於', update: '軟體更新', storage: '儲存空間' };
  sys.settingsPanes = function () { return PANES.filter(function (p) { return p.id; }).map(function (p) { return { id: p.id, label: p.label, kw: p.kw }; }); };

  function openSettings(args) {
    args = args || {};
    var pane = PANE_BY[args.pane] ? args.pane : null, sub = args.sub || null;
    var existing = LAB.wm.byApp('settings')[0];
    if (existing && existing.state.S) {
      var S0 = existing.state.S;
      if (pane) S0.go(pane, sub);
      existing.focus();
      return existing;
    }
    var S = { pane: null, sub: null, hist: [], hi: -1 };
    var side = h('div', { class: 'sy-set-side' }), main = h('div', { class: 'sy-set-main' });
    var search = h('input', { type: 'search', class: 'sy-set-search', placeholder: '搜尋', 'aria-label': '搜尋', autocomplete: 'off', spellcheck: 'false', dataset: { lab: 'set-search' } });
    var sglyph = h('span', { class: 'sy-set-sg' }, glyph('search', 14, 1.9));
    var account = h('button', { type: 'button', class: 'sy-set-acc', dataset: { lab: 'set-account' } }, avatar(40), h('span', { class: 'sy-set-accn' }, h('b', null, 'an'), h('small', null, '管理員')));
    account.addEventListener('click', function () { S.go('users'); });
    var list = h('div', { class: 'sy-set-list', role: 'listbox', 'aria-label': '設定項目' });
    var none = h('div', { class: 'sy-set-none', hidden: true }, '找不到符合的設定');
    var items = [];
    PANES.forEach(function (p) {
      if (p.sep) { var sp = h('div', { class: 'sy-set-sep' }); list.appendChild(sp); items.push({ sep: sp }); return; }
      var b = h('button', { type: 'button', class: 'sy-set-item', role: 'option', 'aria-selected': 'false', dataset: { lab: 'set-pane', pane: p.id } }, sbIcon(p.color, p.gl), h('span', null, p.label));
      b.addEventListener('click', function () { S.go(p.id); });
      list.appendChild(b); items.push({ b: b, p: p });
    });
    list.appendChild(none);
    function filter() {
      var q = search.value.trim().toLowerCase(), any = false;
      items.forEach(function (it) {
        if (it.sep) { it.sep.hidden = !!q; return; }
        var ok = !q || (it.p.label + ' ' + it.p.kw).toLowerCase().indexOf(q) >= 0;
        it.b.hidden = !ok;
        if (ok) any = true;
      });
      none.hidden = any;
    }
    search.addEventListener('input', filter);
    search.addEventListener('keydown', function (e) {
      if (LAB.ui.isImeEnter(e)) return;
      if (e.key === 'Enter') {
        for (var i = 0; i < items.length; i++) { if (items[i].b && !items[i].b.hidden) { S.go(items[i].p.id); break; } }
        e.preventDefault();
      } else if (e.key === 'Escape' && search.value) { search.value = ''; filter(); e.stopPropagation(); e.preventDefault(); }
    });
    side.appendChild(h('div', { class: 'sy-set-sw' }, sglyph, search));
    side.appendChild(account);
    side.appendChild(list);

    var back = h('button', { type: 'button', class: 'sy-hbtn', 'aria-label': '上一頁', dataset: { lab: 'set-back' } }, glyph('back', 16, 2));
    var fwd = h('button', { type: 'button', class: 'sy-hbtn', 'aria-label': '下一頁', dataset: { lab: 'set-forward' } }, glyph('chev', 16, 2));
    var title = h('div', { class: 'sy-set-title', dataset: { lab: 'set-title' } });
    var scroll = h('div', { class: 'sy-set-scroll' });
    main.appendChild(h('div', { class: 'sy-set-head' }, back, fwd, title));
    main.appendChild(scroll);
    back.addEventListener('click', function () { S.step(-1); });
    fwd.addEventListener('click', function () { S.step(1); });

    function show(pane, subId) {
      S.pane = pane; S.sub = subId || null;
      var def = PANE_BY[pane];
      items.forEach(function (it) { if (it.b) { var on = it.p.id === pane; it.b.classList.toggle('is-on', on); it.b.setAttribute('aria-selected', on ? 'true' : 'false'); } });
      title.textContent = S.sub && SUB_TITLE[S.sub] ? SUB_TITLE[S.sub] : def.label;
      scroll.textContent = '';
      var body = def.build(S, S.sub);
      body.classList.add('sy-set-pane');
      body.setAttribute('data-pane', pane);
      if (S.sub) body.setAttribute('data-sub', S.sub);
      scroll.appendChild(body);
      scroll.scrollTop = 0;
      back.disabled = S.hi <= 0; fwd.disabled = S.hi >= S.hist.length - 1;
      win.setTitle(S.sub && SUB_TITLE[S.sub] ? SUB_TITLE[S.sub] : def.label);
      try { LAB.bus.emit('settings:pane', { pane: pane, sub: S.sub }); } catch (e) { /* ignore */ }
    }
    S.go = function (pane, subId) {
      if (!PANE_BY[pane]) return;
      if (S.pane === pane && (S.sub || null) === (subId || null) && S.hi >= 0) { show(pane, subId); return; }
      S.hist = S.hist.slice(0, S.hi + 1);
      S.hist.push({ pane: pane, sub: subId || null });
      S.hi = S.hist.length - 1;
      show(pane, subId);
    };
    S.step = function (d) {
      var n = S.hi + d;
      if (n < 0 || n >= S.hist.length) return;
      S.hi = n;
      show(S.hist[n].pane, S.hist[n].sub);
    };

    /* The hidden title bar (40 px, over the lights) would cover the back and forward buttons, so it does not take clicks here; the strip below
       forwards a press on empty header space to the bar, which is what drags the window (and a double-click zooms it). */
    var dragStrip = h('div', { class: 'sy-set-drag', 'aria-hidden': 'true' });
    dragStrip.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      var bar = win.el.querySelector('.lab-win-bar');
      if (!bar) return;
      bar.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, clientX: e.clientX, clientY: e.clientY, pointerId: e.pointerId, pointerType: e.pointerType, isPrimary: true, button: 0, buttons: 1 }));
    });
    dragStrip.addEventListener('dblclick', function () { win.zoom(); });
    var shell = h('div', { class: 'sy-set', dataset: { lab: 'settings' } }, side, main, dragStrip);
    var win = LAB.wm.open({
      appId: 'settings', title: '系統設定', width: 800, height: 548, minW: 640, minH: 420, bar: 'hidden', singleton: 'settings', content: shell, icon: 'app-settings'
    });
    win.state.S = S;
    win.own(function () { win.state.S = null; });
    /* the appearance or Wi-Fi switch changed somewhere else (Control Center, the Wi-Fi panel): the open pane shows the new state */
    win.own(LAB.bus.on('sys:change', function (d) {
      if (!d || (d.key !== 'appearance' && d.key !== 'wifi') || S.busy) return;
      S.busy = true;
      try { if (S.pane) show(S.pane, S.sub); } finally { S.busy = false; }
    }));
    S.win = win; S.search = search;
    S.go(pane || 'wifi', pane ? sub : null);
    return win;
  }
  sys.openSettings = function (pane, sub) { return LAB.apps.launch('settings', { pane: pane || null, sub: sub || null }); };

  LAB.apps.register('settings', {
    title: '系統設定', en: 'System Settings', aliases: ['settings', 'system settings', 'preferences', 'system preferences', '設定', '偏好設定', '系統偏好設定'],
    icon: 'app-settings', dock: true,
    open: function (args) { return openSettings(args); },
    canHandle: function () { return false; }
  });
  LAB.menu.register('settings', function () {
    var S = (LAB.wm.byApp('settings')[0] || { state: {} }).state.S;
    var viewItems = [
      { label: '返回', shortcut: '⌘[', enabled: !!(S && S.hi > 0), action: function () { if (S) S.step(-1); } },
      { label: '前進', shortcut: '⌘]', enabled: !!(S && S.hi < S.hist.length - 1), action: function () { if (S) S.step(1); } },
      { separator: true }
    ];
    PANES.forEach(function (p) { if (p.id) viewItems.push({ label: p.label, checked: !!(S && S.pane === p.id), action: function () { if (S) S.go(p.id); else sys.openSettings(p.id); } }); });
    return [
      { label: '編輯', items: [{ label: '搜尋', shortcut: '⌘F', action: function () { if (S && S.search) S.search.focus(); } }] },
      { label: '顯示方式', items: viewItems },
      { label: '視窗', items: LAB.menu.windowMenu() },
      { label: '輔助說明', items: [{ label: '搜尋', enabled: false }, { separator: true }, { label: '系統設定輔助說明', enabled: false }] }
    ];
  });
  LAB.keys.on('mod+f', function () {
    var S = (LAB.wm.byApp('settings')[0] || { state: {} }).state.S;
    if (!S || !S.search) return false;
    S.search.focus();
  }, { scope: 'settings' });
  LAB.keys.on('mod+[', function () { var S = (LAB.wm.byApp('settings')[0] || { state: {} }).state.S; if (!S) return false; S.step(-1); }, { scope: 'settings' });
  LAB.keys.on('mod+]', function () { var S = (LAB.wm.byApp('settings')[0] || { state: {} }).state.S; if (!S) return false; S.step(1); }, { scope: 'settings' });

  /* ================================================================== 計算機 (calculator)
     Basic: a four-function calculator that runs each operation at once (2 + 3 × 4 = 20, like the Mac's), % , ±, AC / C, repeated =,
     digits and keys from the keyboard. ⌘2 switches to the scientific layout (precedence, parentheses, roots, logs, trig, memory). */
  function calcFmt(n) {
    if (!isFinite(n)) return '不是數字';
    if (n === 0) return '0';
    var a = Math.abs(n);
    if (a >= 1e9 || a < 1e-7) {
      var e = n.toExponential(5).replace(/\.?0+e/, 'e').replace('e+', 'e');
      return e;
    }
    var s = String(parseFloat(n.toPrecision(9)));
    return s;
  }
  function groupInt(s) {      // 1234567.89 -> 1,234,567.89 (the part typed so far is kept as it is)
    if (s === '不是數字' || /e/.test(s)) return s;
    var neg = s.charAt(0) === '-', body = neg ? s.slice(1) : s, parts = body.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (neg ? '-' : '') + parts.join('.');
  }
  function factorial(n) {
    if (n < 0 || Math.floor(n) !== n || n > 170) return NaN;
    var r = 1;
    for (var i = 2; i <= n; i++) r *= i;
    return r;
  }

  function openCalculator() {
    var existing = LAB.wm.byApp('calculator')[0];
    if (existing) { existing.focus(); return existing; }
    var mode = 'basic', deg = false;
    var cur = '0', fresh = true, acc = null, op = null, lastOp = null, lastB = null, mem = 0, err = false;
    var sci = { toks: [] };      // scientific: [number, '+', number, '(', ...]
    var disp = h('div', { class: 'sy-calc-num', dataset: { lab: 'calc-display' }, 'aria-live': 'polite' }, '0');
    var memMark = h('span', { class: 'sy-calc-mem', hidden: true }, 'M');
    var keysBox = h('div', { class: 'sy-calc-keys' });
    var root = h('div', { class: 'sy-calc is-basic', tabindex: '0', dataset: { lab: 'calculator' } }, h('div', { class: 'sy-calc-screen' }, memMark, disp), keysBox);
    var opBtns = {}, clearBtn = null, degBtn = null;

    function val() { var n = parseFloat(cur); return isNaN(n) ? 0 : n; }
    function show() {
      var s = err ? '不是數字' : groupInt(cur);
      disp.textContent = s;
      disp.className = 'sy-calc-num' + (s.length > 14 ? ' is-xs' : s.length > 11 ? ' is-s' : s.length > 8 ? ' is-m' : '');
      memMark.hidden = mem === 0;
      if (clearBtn) clearBtn.textContent = (cur === '0' && !op && fresh) || err ? 'AC' : 'C';
      Object.keys(opBtns).forEach(function (k) { opBtns[k].classList.toggle('is-active', op === k && fresh); });
      if (degBtn) degBtn.textContent = deg ? 'Deg' : 'Rad';
      LAB.bus.emit('calc:display', { text: disp.textContent });
    }
    function setNum(n) { if (!isFinite(n)) { err = true; cur = '0'; } else { cur = calcFmt(n); } }
    function apply(a, o, b) {
      switch (o) {
        case '+': return a + b;
        case '-': return a - b;
        case '*': return a * b;
        case '/': return b === 0 ? NaN : a / b;
        case 'pow': return Math.pow(a, b);
        case 'root': return a < 0 && b % 2 ? -Math.pow(-a, 1 / b) : Math.pow(a, 1 / b);
      }
      return b;
    }
    function clearAll() { cur = '0'; fresh = true; acc = null; op = null; lastOp = null; lastB = null; err = false; sci.toks = []; pend = false; }

    /* ---- keys ---- */
    function digit(d) {
      if (err) clearAll();
      pend = true;
      if (fresh) { cur = d; fresh = false; }
      else {
        var digits = cur.replace(/[^0-9]/g, '').length;
        if (digits >= 15) return;
        cur = cur === '0' ? d : (cur === '-0' ? '-' + d : cur + d);
      }
      show();
    }
    function dot() {
      if (err) clearAll();
      pend = true;
      if (fresh) { cur = '0.'; fresh = false; }
      else if (cur.indexOf('.') < 0 && cur.indexOf('e') < 0) cur += '.';
      show();
    }
    function ee() { if (!fresh && cur.indexOf('e') < 0) { cur += 'e'; pend = true; show(); } }
    function back() {
      if (fresh || err) return;
      cur = cur.length > 1 && !(cur.length === 2 && cur.charAt(0) === '-') ? cur.slice(0, -1) : '0';
      if (cur === '0') fresh = true;
      show();
    }
    function neg() {
      if (err) return;
      if (mode === 'sci') pend = true;
      if (cur === '0' && !fresh) { cur = '-0'; show(); return; }
      cur = cur.charAt(0) === '-' ? cur.slice(1) : '-' + cur;
      show();
    }
    function pct() {
      if (err) return;
      var v = val();
      if (mode === 'basic' && op && acc !== null && (op === '+' || op === '-')) setNum(acc * v / 100); else setNum(v / 100);
      fresh = false;
      show();
    }
    function clearKey() {
      if (clearBtn && clearBtn.textContent === 'C' && !err) { cur = '0'; fresh = true; pend = false; show(); }
      else { clearAll(); show(); }
    }
    function setOp(o) {
      if (err) return;
      if (mode === 'sci') { sciOp(o); return; }
      if (op && !fresh) { var r = apply(acc, op, val()); setNum(r); acc = isFinite(r) ? r : null; if (err) { op = null; show(); return; } }
      else acc = val();
      op = o; fresh = true; lastOp = null;
      show();
    }
    function equals() {
      if (err) return;
      if (mode === 'sci') { sciEquals(); return; }
      if (op) {
        var b = val(), r = apply(acc, op, b);
        lastOp = op; lastB = b; op = null; acc = null;
        setNum(r); fresh = true;
      } else if (lastOp) {
        setNum(apply(val(), lastOp, lastB)); fresh = true;
      }
      show();
    }
    /* scientific: a token list ([number, '+', number, '(', ...]) evaluated with precedence when = is pressed.
       `pend` is true while the number on the display has been typed or produced but is not in the list yet. */
    var pend = false;
    function isOpTok(t) { return typeof t === 'string' && t !== '(' && t !== ')'; }
    function sciOp(o) {
      var last = sci.toks[sci.toks.length - 1];
      if (pend) { sci.toks.push(val()); pend = false; }
      else if (isOpTok(last)) { sci.toks[sci.toks.length - 1] = o; fresh = true; op = o; show(); return; }
      else if (last === undefined || last === '(') sci.toks.push(val());
      sci.toks.push(o); fresh = true; op = o;
      show();
    }
    function sciEval(toks) {
      var prec = { '+': 1, '-': 1, '*': 2, '/': 2, pow: 3, root: 3 }, out = [], st = [], i, t;
      function red() { var o = st.pop(), b = out.pop(), a = out.pop(); out.push(apply(a === undefined ? 0 : a, o, b === undefined ? 0 : b)); }
      for (i = 0; i < toks.length; i++) {
        t = toks[i];
        if (typeof t === 'number') out.push(t);
        else if (t === '(') st.push(t);
        else if (t === ')') { while (st.length && st[st.length - 1] !== '(') red(); st.pop(); }
        else {
          while (st.length && st[st.length - 1] !== '(' && (prec[st[st.length - 1]] > prec[t] || (prec[st[st.length - 1]] === prec[t] && t !== 'pow'))) red();
          st.push(t);
        }
      }
      while (st.length) { if (st[st.length - 1] === '(') st.pop(); else red(); }
      return out.length ? out[out.length - 1] : 0;
    }
    function sciEquals() {
      var last = sci.toks[sci.toks.length - 1];
      if (pend || isOpTok(last) || last === '(' || last === undefined) sci.toks.push(val());
      var r = sciEval(sci.toks);
      sci.toks = []; op = null; pend = false;
      setNum(r); fresh = true;
      show();
    }
    function paren(p) {
      if (err) return;
      var last = sci.toks[sci.toks.length - 1];
      if (p === '(') {
        if (pend) { sci.toks.push(val(), '*'); pend = false; }
        else if (typeof last === 'number' || last === ')') sci.toks.push('*');
        sci.toks.push('('); fresh = true; op = null;
      } else {
        var opens = 0, closes = 0;
        sci.toks.forEach(function (t) { if (t === '(') opens++; else if (t === ')') closes++; });
        if (opens <= closes) return;
        if (pend || isOpTok(last) || last === '(') { sci.toks.push(val()); pend = false; }
        sci.toks.push(')');
        var depth = 0, start = 0, i;
        for (i = sci.toks.length - 1; i >= 0; i--) { if (sci.toks[i] === ')') depth++; else if (sci.toks[i] === '(') { depth--; if (depth === 0) { start = i + 1; break; } } }
        setNum(sciEval(sci.toks.slice(start, sci.toks.length - 1)));
        fresh = true; op = null;
      }
      show();
    }
    function unary(f) {
      if (err) return;
      setNum(f(val()));
      fresh = true; pend = mode === 'sci';
      show();
    }
    function constant(n) { if (err) clearAll(); cur = calcFmt(n); fresh = true; pend = true; show(); }
    var toRad = function (x) { return deg ? x * Math.PI / 180 : x; };
    var fromRad = function (x) { return deg ? x * 180 / Math.PI : x; };
    var FN = {
      sq: function (x) { return x * x; }, cube: function (x) { return x * x * x; }, inv: function (x) { return x === 0 ? NaN : 1 / x; },
      sqrt: function (x) { return x < 0 ? NaN : Math.sqrt(x); }, cbrt: function (x) { return Math.cbrt ? Math.cbrt(x) : (x < 0 ? -Math.pow(-x, 1 / 3) : Math.pow(x, 1 / 3)); },
      ln: function (x) { return x <= 0 ? NaN : Math.log(x); }, log: function (x) { return x <= 0 ? NaN : Math.log(x) / Math.LN10; },
      ex: function (x) { return Math.exp(x); }, tenx: function (x) { return Math.pow(10, x); }, fact: factorial, abs: function (x) { return Math.abs(x); },
      sin: function (x) { var r = Math.sin(toRad(x)); return Math.abs(r) < 1e-15 ? 0 : r; }, cos: function (x) { var r = Math.cos(toRad(x)); return Math.abs(r) < 1e-15 ? 0 : r; },
      tan: function (x) { var r = Math.tan(toRad(x)); return Math.abs(r) < 1e-15 ? 0 : r; },
      sinh: function (x) { return (Math.exp(x) - Math.exp(-x)) / 2; }, cosh: function (x) { return (Math.exp(x) + Math.exp(-x)) / 2; },
      tanh: function (x) { var a = Math.exp(x), b = Math.exp(-x); return (a - b) / (a + b); }
    };
    function mem_(kind) {
      if (kind === 'mc') mem = 0;
      else if (kind === 'm+') mem += val();
      else if (kind === 'm-') mem -= val();
      else if (kind === 'mr') { cur = calcFmt(mem); fresh = true; pend = true; err = false; }
      show();
    }

    var BASIC = [
      [['AC', 'fn', 'clear'], ['±', 'fn', 'neg'], ['%', 'fn', 'pct'], ['÷', 'op', '/']],
      [['7', 'num'], ['8', 'num'], ['9', 'num'], ['×', 'op', '*']],
      [['4', 'num'], ['5', 'num'], ['6', 'num'], ['−', 'op', '-']],
      [['1', 'num'], ['2', 'num'], ['3', 'num'], ['+', 'op', '+']],
      [['0', 'num wide'], ['.', 'num', 'dot'], ['=', 'op', 'eq']]
    ];
    var SCI = [
      [['(', 'sf', 'lp'], [')', 'sf', 'rp'], ['mc', 'sf', 'mc'], ['m+', 'sf', 'm+'], ['m−', 'sf', 'm-'], ['mr', 'sf', 'mr']],
      [['Rad', 'sf', 'deg'], ['x²', 'sf', 'sq'], ['x³', 'sf', 'cube'], ['xʸ', 'sf', 'pow'], ['eˣ', 'sf', 'ex'], ['10ˣ', 'sf', 'tenx']],
      [['1/x', 'sf', 'inv'], ['²√x', 'sf', 'sqrt'], ['³√x', 'sf', 'cbrt'], ['ʸ√x', 'sf', 'root'], ['ln', 'sf', 'ln'], ['log₁₀', 'sf', 'log']],
      [['x!', 'sf', 'fact'], ['sin', 'sf', 'sin'], ['cos', 'sf', 'cos'], ['tan', 'sf', 'tan'], ['e', 'sf', 'e'], ['|x|', 'sf', 'abs']],
      [['π', 'sf', 'pi'], ['sinh', 'sf', 'sinh'], ['cosh', 'sf', 'cosh'], ['tanh', 'sf', 'tanh'], ['Rand', 'sf', 'rand'], ['EE', 'sf', 'ee']]
    ];
    function press(spec) {
      var label = spec[0], kind = spec[1], act = spec[2] || label;
      if (/^num/.test(kind) && act !== 'dot') { digit(label); return; }
      if (act === 'dot') { dot(); return; }
      if (act === 'clear') { clearKey(); return; }
      if (act === 'neg') { neg(); return; }
      if (act === 'pct') { pct(); return; }
      if (act === 'eq') { equals(); return; }
      if (kind === 'op') { setOp(act); return; }
      if (act === 'lp' || act === 'rp') { paren(act === 'lp' ? '(' : ')'); return; }
      if (act === 'mc' || act === 'm+' || act === 'm-' || act === 'mr') { mem_(act); return; }
      if (act === 'deg') { deg = !deg; show(); return; }
      if (act === 'pow' || act === 'root') { sciOp(act); return; }
      if (act === 'pi') { constant(Math.PI); return; }
      if (act === 'e') { constant(Math.E); return; }
      if (act === 'rand') { constant(Math.random()); return; }
      if (act === 'ee') { ee(); return; }
      if (FN[act]) unary(FN[act]);
    }
    function build() {
      keysBox.textContent = '';
      opBtns = {}; clearBtn = null; degBtn = null;
      root.classList.toggle('is-basic', mode === 'basic'); root.classList.toggle('is-sci', mode === 'sci');
      function block(rows, cls) {
        var g = h('div', { class: 'sy-calc-blk ' + cls });
        rows.forEach(function (r) {
          r.forEach(function (spec) {
            var kind = spec[1].split(' ')[0];
            var b = h('button', { type: 'button', class: 'sy-ck is-' + spec[1].replace(' ', ' is-'), dataset: { lab: 'calc-key', key: spec[2] || spec[0] } }, spec[0]);
            b.addEventListener('click', function () { press(spec); try { root.focus({ preventScroll: true }); } catch (e) { /* ignore */ } });
            if (spec[1] === 'op' && spec[2] !== 'eq') opBtns[spec[2]] = b;
            if (spec[2] === 'clear') clearBtn = b;
            if (spec[2] === 'deg') degBtn = b;
            g.appendChild(b);
          });
        });
        return g;
      }
      if (mode === 'sci') keysBox.appendChild(block(SCI, 'is-sci6'));
      keysBox.appendChild(block(BASIC, 'is-b4'));
      show();
    }
    function setMode(m) {
      if (m === mode) return;
      mode = m; sci.toks = []; op = null; acc = null; pend = false;
      build();
      win.setRect(m === 'sci' ? { w: 640, h: 360 } : { w: 244, h: 372 });
    }

    var win = LAB.wm.open({
      appId: 'calculator', title: '計算機', width: 244, height: 372, minW: 244, minH: 360, resizable: false, bar: 'hidden', singleton: 'calculator', content: root, icon: 'app-calculator'
    });
    win.state.calc = { setMode: setMode, mode: function () { return mode; }, copy: function () { LAB.clipboard.setText(cur); toastLab('已拷貝「' + groupInt(cur) + '」'); }, paste: function (t) { var n = parseFloat(String(t).replace(/,/g, '')); if (!isNaN(n)) { cur = calcFmt(n); fresh = false; err = false; show(); } } };
    root.addEventListener('keydown', function (e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (LAB.ui.isImeEnter(e)) return;
      var k = e.key, handled = true;
      if (/^[0-9]$/.test(k)) digit(k);
      else if (k === '.' || k === ',') dot();
      else if (k === '+') setOp('+');
      else if (k === '-') setOp('-');
      else if (k === '*' || k === 'x' || k === 'X') setOp('*');
      else if (k === '/') setOp('/');
      else if (k === 'Enter' || k === '=') equals();
      else if (k === 'Backspace' || k === 'Delete') back();
      else if (k === 'Escape' || k === 'c' || k === 'C') { clearAll(); show(); }
      else if (k === '%') pct();
      else if (k === '(' && mode === 'sci') paren('(');
      else if (k === ')' && mode === 'sci') paren(')');
      else handled = false;
      if (handled) { e.preventDefault(); e.stopPropagation(); }
    });
    win.on('focus', function () { try { root.focus({ preventScroll: true }); } catch (e) { /* ignore */ } });
    build();
    setTimeout(function () { try { root.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }, 0);
    return win;
  }
  function calcState() { var w = LAB.wm.byApp('calculator')[0]; return w && w.state.calc ? w.state.calc : null; }
  LAB.apps.register('calculator', {
    title: '計算機', en: 'Calculator', aliases: ['calculator', 'calc', '計算', '算數'], icon: 'app-calculator', dock: true,
    open: function () { return openCalculator(); },
    canHandle: function () { return false; }
  });
  LAB.menu.register('calculator', function () {
    var c = calcState();
    return [
      { label: '檔案', items: [{ label: '關閉視窗', shortcut: '⌘W', action: function () { var w = LAB.wm.byApp('calculator')[0]; if (w) w.close(); } }] },
      { label: '編輯', items: [
        { label: '拷貝', shortcut: '⌘C', action: function () { if (c) c.copy(); } },
        { label: '貼上', shortcut: '⌘V', action: function () { var t = LAB.clipboard.text; if (c && t) c.paste(t); } }
      ] },
      { label: '顯示方式', items: [
        { label: '基本型', shortcut: '⌘1', checked: !!(c && c.mode() === 'basic'), action: function () { if (c) c.setMode('basic'); } },
        { label: '進階型', shortcut: '⌘2', checked: !!(c && c.mode() === 'sci'), action: function () { if (c) c.setMode('sci'); } },
        { label: '程式設計型', shortcut: '⌘3', enabled: false }
      ] },
      { label: '視窗', items: LAB.menu.windowMenu() },
      { label: '輔助說明', items: [{ label: '搜尋', enabled: false }, { separator: true }, { label: '計算機輔助說明', enabled: false }] }
    ];
  });
  LAB.keys.on('mod+1', function () { var c = calcState(); if (!c) return false; c.setMode('basic'); }, { scope: 'calculator' });
  LAB.keys.on('mod+2', function () { var c = calcState(); if (!c) return false; c.setMode('sci'); }, { scope: 'calculator' });
  LAB.keys.on('mod+c', function () { var c = calcState(); if (!c) return false; c.copy(); }, { scope: 'calculator' });

  /* ================================================================== 活動監視器 (activity)
     The process table of SPEC §1 from sys.processes() (every app that is really open is in it), five tabs (CPU, 記憶體, 能源, 硬碟,
     網路), a graph panel under the table, and 結束 that really quits the app behind the selected row. It refreshes every 2 s, only while
     its window is on screen (visible, not minimised, page not hidden). */
  function fmtTime(sec) {
    var m = Math.floor(sec / 60), s = sec - m * 60;
    return m + ':' + (s < 10 ? '0' : '') + s.toFixed(2);
  }
  function fmtBytes(b) {
    if (b < 1024) return b + ' 位元組';
    if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
    if (b < 1073741824) return (b / 1048576).toFixed(1) + ' MB';
    return (b / 1073741824).toFixed(2) + ' GB';
  }
  function fmtMem(mb) { return mb >= 1024 ? (mb / 1024).toFixed(2) + ' GB' : mb.toFixed(1) + ' MB'; }
  var AM_TABS = [
    { id: 'cpu', label: 'CPU', cols: [
      { k: 'name', t: '程序名稱', w: '1.7fr' }, { k: 'cpu', t: '% CPU', n: 1, f: function (p) { return p.cpu.toFixed(1); } }, { k: 'cpuTime', t: 'CPU 時間', n: 1, f: function (p) { return fmtTime(p.cpuTime); } },
      { k: 'threads', t: '執行緒', n: 1 }, { k: 'wakeups', t: '閒置喚醒', n: 1 }, { k: 'pid', t: 'PID', n: 1 }, { k: 'user', t: '使用者', w: '1.1fr' }], sort: ['cpu', -1] },
    { id: 'mem', label: '記憶體', cols: [
      { k: 'name', t: '程序名稱', w: '1.7fr' }, { k: 'memMB', t: '記憶體', n: 1, f: function (p) { return fmtMem(p.memMB); } }, { k: 'threads', t: '執行緒', n: 1 },
      { k: 'ports', t: '連接埠', n: 1 }, { k: 'pid', t: 'PID', n: 1 }, { k: 'user', t: '使用者', w: '1.1fr' }], sort: ['memMB', -1] },
    { id: 'energy', label: '能源', cols: [
      { k: 'name', t: '程序名稱', w: '1.7fr' }, { k: 'energy', t: '能源影響', n: 1, f: function (p) { return p.energy.toFixed(1); } }, { k: 'nap', t: 'App Nap' },
      { k: 'noSleep', t: '防止睡眠' }, { k: 'pid', t: 'PID', n: 1 }, { k: 'user', t: '使用者', w: '1.1fr' }], sort: ['energy', -1] },
    { id: 'disk', label: '硬碟', cols: [
      { k: 'name', t: '程序名稱', w: '1.7fr' }, { k: 'written', t: '已寫入的位元組', n: 1, f: function (p) { return fmtBytes(p.written); } }, { k: 'read', t: '已讀取的位元組', n: 1, f: function (p) { return fmtBytes(p.read); } },
      { k: 'pid', t: 'PID', n: 1 }, { k: 'user', t: '使用者', w: '1.1fr' }], sort: ['written', -1] },
    { id: 'net', label: '網路', cols: [
      { k: 'name', t: '程序名稱', w: '1.7fr' }, { k: 'sent', t: '已傳送的位元組', n: 1, f: function (p) { return fmtBytes(p.sent); } }, { k: 'recv', t: '已接收的位元組', n: 1, f: function (p) { return fmtBytes(p.recv); } },
      { k: 'pktSent', t: '已傳送的封包', n: 1 }, { k: 'pktRecv', t: '已接收的封包', n: 1 }, { k: 'pid', t: 'PID', n: 1 }, { k: 'user', t: '使用者', w: '1.1fr' }], sort: ['recv', -1] }
  ];
  var AM_FILTERS = [['all', '所有程序'], ['mine', '我的程序'], ['system', '系統程序'], ['apps', 'App 程序']];

  function openActivity() {
    var existing = LAB.wm.byApp('activity')[0];
    if (existing) { existing.focus(); return existing; }
    var A = { tab: 'cpu', sel: null, sort: {}, filter: 'all', q: '', list: [], hist: { cpu: [], mem: [], energy: [], disk: [], net: [] } };
    AM_TABS.forEach(function (t) { A.sort[t.id] = t.sort.slice(); });
    var win = null, timer = 0;

    var stopBtn = h('button', { type: 'button', class: 'sy-tbtn', 'aria-label': '結束程序', title: '結束程序', disabled: true, dataset: { lab: 'am-quit' } }, glyph('stop', 20, 1.5));
    var infoBtn = h('button', { type: 'button', class: 'sy-tbtn', 'aria-label': '檢視程序資訊', title: '檢視程序資訊', disabled: true, dataset: { lab: 'am-info' } }, glyph('info', 20, 1.5));
    var sel = h('select', { class: 'sy-select sy-am-filter', 'aria-label': '顯示的程序', dataset: { lab: 'am-filter' } });
    AM_FILTERS.forEach(function (f) { sel.appendChild(h('option', { value: f[0] }, f[1])); });
    var title = h('div', { class: 'sy-am-title' }, h('b', null, '活動監視器'), h('small', { dataset: { lab: 'am-sub' } }, '所有程序'));
    var search = h('input', { type: 'search', class: 'sy-am-search', placeholder: '搜尋', 'aria-label': '搜尋程序', autocomplete: 'off', spellcheck: 'false', dataset: { lab: 'am-search' } });
    var tools = h('div', { class: 'sy-am-tools' }, stopBtn, infoBtn, h('span', { class: 'sy-am-sp' }), title, h('span', { class: 'sy-am-sp' }), sel, h('span', { class: 'sy-am-sg' }, glyph('search', 13, 2), search));

    var tabs = h('div', { class: 'sy-am-tabs', role: 'tablist' });
    AM_TABS.forEach(function (t) {
      var b = h('button', { type: 'button', class: 'sy-am-tab' + (t.id === A.tab ? ' is-on' : ''), role: 'tab', 'aria-selected': t.id === A.tab ? 'true' : 'false', dataset: { lab: 'am-tab', tab: t.id } }, t.label);
      b.addEventListener('click', function () { setTab(t.id); });
      tabs.appendChild(b);
    });
    var head = h('div', { class: 'sy-am-head', dataset: { lab: 'am-head' } }), body = h('div', { class: 'sy-am-body', dataset: { lab: 'am-body' } });
    var table = h('div', { class: 'sy-am-table' }, head, body);
    var foot = h('div', { class: 'sy-am-foot', dataset: { lab: 'am-foot' } });
    var root = h('div', { class: 'sy-am', dataset: { lab: 'activity' } }, h('div', { class: 'sy-am-tabbar' }, tabs), table, foot);

    function tabDef() { var d = AM_TABS[0]; AM_TABS.forEach(function (t) { if (t.id === A.tab) d = t; }); return d; }
    function gridCols(d) { return d.cols.map(function (c) { return c.w || (c.n ? '.8fr' : '.7fr'); }).join(' '); }
    function visibleRows() {
      var d = tabDef(), s = A.sort[A.tab], q = A.q.trim().toLowerCase();
      var rows = A.list.filter(function (p) {
        if (A.filter === 'mine' && p.user !== 'an') return false;
        if (A.filter === 'system' && p.user === 'an') return false;
        if (A.filter === 'apps' && p.kind !== 'app') return false;
        if (q && p.name.toLowerCase().indexOf(q) < 0 && String(p.pid).indexOf(q) < 0 && p.user.toLowerCase().indexOf(q) < 0) return false;
        return true;
      });
      rows.sort(function (a, b) {
        var x = a[s[0]], y = b[s[0]];
        if (typeof x === 'string') { var c = x.localeCompare(y); return c * s[1] || (a.pid - b.pid); }
        return ((x - y) * s[1]) || (a.pid - b.pid);
      });
      return rows;
    }
    function renderHead() {
      var d = tabDef(), s = A.sort[A.tab];
      head.textContent = '';
      head.style.gridTemplateColumns = gridCols(d);
      d.cols.forEach(function (c) {
        var b = h('button', { type: 'button', class: 'sy-am-th' + (c.n ? ' is-n' : '') + (s[0] === c.k ? ' is-sorted' : ''), dataset: { lab: 'am-th', key: c.k } }, h('span', null, c.t), s[0] === c.k ? h('i', { class: 'sy-am-arrow' }, s[1] < 0 ? '▾' : '▴') : null);
        b.addEventListener('click', function () { var cur = A.sort[A.tab]; A.sort[A.tab] = cur[0] === c.k ? [c.k, -cur[1]] : [c.k, c.n ? -1 : 1]; renderHead(); renderBody(); });
        head.appendChild(b);
      });
    }
    function procIcon(p) {
      if (p.kind === 'app' || p.kind === 'helper') {
        var def = LAB.apps.get(p.appId);
        if (def && p.kind === 'app') return ico(def.icon, 16);
      }
      return h('span', { class: 'sy-am-exec' + (p.kind === 'app' ? ' is-app' : ''), 'aria-hidden': 'true' });
    }
    function renderBody() {
      var d = tabDef(), rows = visibleRows(), top = body.scrollTop;
      body.textContent = '';
      var frag = document.createDocumentFragment();
      rows.forEach(function (p, i) {
        var r = h('div', { class: 'sy-am-row' + (p.pid === A.sel ? ' is-sel' : '') + (i % 2 ? ' is-odd' : ''), role: 'row', 'aria-selected': p.pid === A.sel ? 'true' : 'false', dataset: { lab: 'am-row', pid: p.pid, name: p.name, app: p.appId || '' } });
        r.style.gridTemplateColumns = gridCols(d);
        d.cols.forEach(function (c) {
          if (c.k === 'name') r.appendChild(h('span', { class: 'sy-am-c sy-am-cn' }, procIcon(p), h('span', null, p.name)));
          else r.appendChild(h('span', { class: 'sy-am-c' + (c.n ? ' is-n' : '') }, c.f ? c.f(p) : String(p[c.k])));
        });
        r.addEventListener('click', function () { A.sel = p.pid; renderBody(); updateBtns(); });
        frag.appendChild(r);
      });
      body.appendChild(frag);
      body.scrollTop = top;
      if (!rows.length) body.appendChild(h('div', { class: 'sy-am-none' }, '沒有符合的程序'));
    }
    function updateBtns() {
      var has = false;
      A.list.forEach(function (p) { if (p.pid === A.sel) has = true; });
      stopBtn.disabled = !has; infoBtn.disabled = !has;
    }
    /* ---- the graph panel ---- */
    var canvas = null;
    function histPush(arr, v) { arr.push(v); while (arr.length > 60) arr.shift(); }
    function stat(label, value, cls) { return h('div', { class: 'sy-am-st' + (cls ? ' ' + cls : '') }, h('span', null, label), h('b', null, value)); }
    function renderFoot() {
      var tot = sys.cpuTotals(A.list), memUsed = 0, i;
      A.list.forEach(function (p) { memUsed += p.memMB; });
      var usedGB = (memUsed / 1024) + 4.1, cachedGB = 4.7;
      var left = h('div', { class: 'sy-am-stats' }), gtitle = '';
      if (A.tab === 'cpu') {
        left.appendChild(stat('系統：', tot.system.toFixed(2) + '%', 'is-red')); left.appendChild(stat('使用者：', tot.user.toFixed(2) + '%', 'is-blue')); left.appendChild(stat('閒置：', tot.idle.toFixed(2) + '%'));
        left.appendChild(stat('執行緒：', String(tot.threads))); left.appendChild(stat('程序：', String(tot.count)));
        gtitle = 'CPU 負載';
      } else if (A.tab === 'mem') {
        left.appendChild(stat('實體記憶體：', HW.ram.replace(' GB', '.00 GB'))); left.appendChild(stat('已使用記憶體：', usedGB.toFixed(2) + ' GB'));
        left.appendChild(stat('已快取檔案：', cachedGB.toFixed(2) + ' GB')); left.appendChild(stat('已使用交換檔：', '0 位元組'));
        gtitle = '記憶體壓力';
      } else if (A.tab === 'energy') {
        var en = 0; A.list.forEach(function (p) { en += p.energy; });
        left.appendChild(stat('全部的能源影響：', en.toFixed(1))); left.appendChild(stat('平均能源影響：', (en / Math.max(1, A.list.length)).toFixed(2)));
        left.appendChild(stat('電源：', '電源轉接器'));
        gtitle = '能源影響';
      } else if (A.tab === 'disk') {
        var rd = 0, wr = 0; A.list.forEach(function (p) { rd += p.read; wr += p.written; });
        left.appendChild(stat('已讀取 IO：', fmtNum(Math.round(rd / 4096)))); left.appendChild(stat('已寫入 IO：', fmtNum(Math.round(wr / 4096))));
        left.appendChild(stat('資料已讀取：', fmtBytes(rd), 'is-blue')); left.appendChild(stat('資料已寫入：', fmtBytes(wr), 'is-red'));
        gtitle = '硬碟 IO';
      } else {
        var sn = 0, rc = 0, ps = 0, pr = 0; A.list.forEach(function (p) { sn += p.sent; rc += p.recv; ps += p.pktSent; pr += p.pktRecv; });
        left.appendChild(stat('已接收的封包：', fmtNum(pr), 'is-blue')); left.appendChild(stat('已傳送的封包：', fmtNum(ps), 'is-red'));
        left.appendChild(stat('已接收的資料：', fmtBytes(rc))); left.appendChild(stat('已傳送的資料：', fmtBytes(sn)));
        gtitle = '網路';
      }
      canvas = h('canvas', { class: 'sy-am-graph', width: 360, height: 70, 'aria-label': gtitle });
      foot.textContent = '';
      foot.appendChild(left);
      foot.appendChild(h('div', { class: 'sy-am-gwrap' }, h('div', { class: 'sy-am-gt' }, gtitle), canvas));
      drawGraph();
    }
    function series() {
      var u = A.hist[A.tab];
      return u;
    }
    function drawGraph() {
      if (!canvas || !canvas.getContext) return;
      var g = canvas.getContext('2d'), w = canvas.width, hh = canvas.height, data = series(), dark = isDark();
      g.clearRect(0, 0, w, hh);
      g.strokeStyle = dark ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.1)'; g.lineWidth = 1;
      for (var y = 0.5; y < hh; y += hh / 4) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
      if (!data.length) return;
      var step = w / 59;
      function line(key, color, fill) {
        g.beginPath();
        for (var i = 0; i < data.length; i++) { var x = w - (data.length - 1 - i) * step, yy = hh - clamp(data[i][key], 0, 1) * (hh - 4) - 2; if (i === 0) g.moveTo(x, yy); else g.lineTo(x, yy); }
        g.strokeStyle = color; g.lineWidth = 1.6; g.stroke();
        if (fill) { g.lineTo(w, hh); g.lineTo(w - (data.length - 1) * step, hh); g.closePath(); g.fillStyle = fill; g.fill(); }
      }
      if (A.tab === 'cpu') { line('a', '#ff5a52', 'rgba(255,90,82,.18)'); line('b', '#2f8bff', null); }
      else if (A.tab === 'mem') line('a', '#34c759', 'rgba(52,199,89,.2)');
      else if (A.tab === 'disk' || A.tab === 'net') { line('a', '#2f8bff', null); line('b', '#ff5a52', null); }
      else line('a', '#34c759', 'rgba(52,199,89,.2)');
    }
    function sample() {
      var t = sys.cpuTotals(A.list), mem = 0, en = 0, rd = 0, wr = 0, sn = 0, rc = 0;
      A.list.forEach(function (p) { mem += p.memMB; en += p.energy; rd += p.read; wr += p.written; sn += p.sent; rc += p.recv; });
      histPush(A.hist.cpu, { a: clamp(t.system / 100 * 14, 0, 1), b: clamp(t.user / 100 * 8, 0, 1) });
      histPush(A.hist.mem, { a: 0.22 + (mem / 1024 / 16) * 0.35 });
      histPush(A.hist.energy, { a: clamp(en / 40, 0, 1) });
      histPush(A.hist.disk, { a: clamp(rd / 1e9 * 6, 0, 1), b: clamp(wr / 1e9 * 9, 0, 1) });
      histPush(A.hist.net, { a: clamp(rc / 2e8, 0, 1), b: clamp(sn / 1e8, 0, 1) });
    }
    function tick() {
      A.list = sys.processes();
      sample();
      if (A.sel !== null && !A.list.some(function (p) { return p.pid === A.sel; })) A.sel = null;
      renderBody(); updateBtns(); renderFoot();
    }
    function setTab(id) {
      A.tab = id;
      [].forEach.call(tabs.children, function (b) { var on = b.getAttribute('data-tab') === id; b.classList.toggle('is-on', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); });
      renderHead(); renderBody(); renderFoot();
    }
    win = LAB.wm.open({
      appId: 'activity', title: '活動監視器', width: 880, height: 560, minW: 640, minH: 380, bar: 'unified', toolbar: tools, singleton: 'activity', content: root, icon: 'app-activity'
    });
    win.state.A = A;
    A.setTab = setTab;

    sel.addEventListener('change', function () { A.filter = sel.value; title.querySelector('small').textContent = AM_FILTERS.filter(function (f) { return f[0] === A.filter; })[0][1]; renderBody(); });
    search.addEventListener('input', function () { A.q = search.value; renderBody(); });
    search.addEventListener('keydown', function (e) { e.stopPropagation(); if (e.key === 'Escape' && search.value) { search.value = ''; A.q = ''; renderBody(); } });
    function quitSelected() {
      var p = null;
      A.list.forEach(function (x) { if (x.pid === A.sel) p = x; });
      if (!p) return;
      if (p.kind === 'system' && p.user !== 'an') {
        LAB.ui.alert(win, { title: '無法結束「' + p.name + '」', text: '這是系統程序，練習版不能結束它。', buttons: [{ label: '好', value: true, 'default': true }] });
        return;
      }
      LAB.ui.alert(win, {
        title: '您確定要結束「' + p.name + '」程序嗎？', text: '如果您無法結束某個程序，請強制結束。',
        buttons: [{ label: '取消', value: 'no', cancel: true }, { label: '強制結束', value: 'force' }, { label: '結束', value: 'quit', 'default': true }]
      }).then(function (v) {
        if (v !== 'quit' && v !== 'force') return;
        var r = sys.killProcess(p.pid);
        if (r.ok) { try { LAB.bus.emit('sys:kill', { pid: p.pid, name: p.name, appId: r.appId || null }); } catch (e) { /* ignore */ } }
        if (!win.closed) { A.sel = null; tick(); }
      });
    }
    stopBtn.addEventListener('click', quitSelected);
    infoBtn.addEventListener('click', function () {
      var p = null; A.list.forEach(function (x) { if (x.pid === A.sel) p = x; });
      if (!p) return;
      LAB.ui.alert(win, { title: p.name, text: 'PID ' + p.pid + '　使用者 ' + p.user + '　記憶體 ' + fmtMem(p.memMB) + '　執行緒 ' + p.threads + '　% CPU ' + p.cpu.toFixed(1), buttons: [{ label: '好', value: true, 'default': true }] });
    });
    A.quit = quitSelected;

    function visibleNow() { return !document.hidden && !win.closed && !win.isMinimized() && !LAB.wm.isHidden('activity'); }
    timer = setInterval(function () { if (visibleNow()) tick(); }, 2000);
    win.own(function () { clearInterval(timer); });
    /* the graphs start with a minute of quiet history (seeded), so they are never empty */
    (function () {
      var rg = mulberry32(2026), base = sys.processes(), i;
      A.list = base; var t = sys.cpuTotals(base), mem = 0;
      base.forEach(function (p) { mem += p.memMB; });
      for (i = 0; i < 60; i++) {
        histPush(A.hist.cpu, { a: clamp(t.system / 100 * 14 * (0.6 + rg() * 0.8), 0, 1), b: clamp(t.user / 100 * 8 * (0.5 + rg()), 0, 1) });
        histPush(A.hist.mem, { a: 0.22 + (mem / 1024 / 16) * 0.35 + (rg() - 0.5) * 0.01 });
        histPush(A.hist.energy, { a: clamp(0.18 + rg() * 0.12, 0, 1) });
        histPush(A.hist.disk, { a: clamp(0.05 + rg() * 0.15, 0, 1), b: clamp(0.03 + rg() * 0.1, 0, 1) });
        histPush(A.hist.net, { a: clamp(0.04 + rg() * 0.18, 0, 1), b: clamp(0.02 + rg() * 0.08, 0, 1) });
      }
    })();
    renderHead(); tick();
    return win;
  }
  function actState() { var w = LAB.wm.byApp('activity')[0]; return w && w.state.A ? w.state.A : null; }
  LAB.apps.register('activity', {
    title: '活動監視器', en: 'Activity Monitor', aliases: ['activity monitor', 'activity', 'process', 'processes', 'task manager', 'cpu', '程序', '工作管理員'], icon: 'app-activity', dock: true,
    open: function () { return openActivity(); },
    canHandle: function () { return false; }
  });
  LAB.menu.register('activity', function () {
    var A = actState();
    function tabItem(label, id, key) { return { label: label, shortcut: '⌘' + key, checked: !!(A && A.tab === id), action: function () { if (A) A.setTab(id); } }; }
    return [
      { label: '檔案', items: [
        { label: '結束程序', shortcut: '⌥⌘Q', enabled: !!(A && A.sel !== null), action: function () { if (A) A.quit(); } },
        { separator: true }, { label: '關閉視窗', shortcut: '⌘W', action: function () { var w = LAB.wm.byApp('activity')[0]; if (w) w.close(); } }] },
      { label: '編輯', items: [{ label: '拷貝', shortcut: '⌘C', enabled: false }, { label: '全選', shortcut: '⌘A', enabled: false }] },
      { label: '顯示方式', items: [tabItem('CPU', 'cpu', '1'), tabItem('記憶體', 'mem', '2'), tabItem('能源', 'energy', '3'), tabItem('硬碟', 'disk', '4'), tabItem('網路', 'net', '5')] },
      { label: '視窗', items: LAB.menu.windowMenu() },
      { label: '輔助說明', items: [{ label: '搜尋', enabled: false }, { separator: true }, { label: '活動監視器輔助說明', enabled: false }] }
    ];
  });
  [['1', 'cpu'], ['2', 'mem'], ['3', 'energy'], ['4', 'disk'], ['5', 'net']].forEach(function (k) {
    LAB.keys.on('mod+' + k[0], function () { var A = actState(); if (!A) return false; A.setTab(k[1]); }, { scope: 'activity' });
  });

  /* ================================================================== Safari (safari)
     Nothing here touches the network (SPEC §1): example.com shows the fake Example Domain page, every other address shows the 練習版
     offline page, and with Wi-Fi switched off in Control Center it shows the 「未連接網際網路」 page. Address bar, tabs (⌘T, ⌘W),
     back and forward per tab. LAB.apps.launch('safari', {url}) (the Terminal's `open https://…`) opens the address in a new tab. */
  function sfParse(input) {
    var s = String(input || '').trim();
    if (!s || s === 'about:blank' || s === 'topsites://') return { kind: 'start', url: '' };
    var url = s;
    if (!/^[a-z][a-z0-9+.\-]*:\/\//i.test(s)) {
      if (/^[^\s\/]+\.[a-z]{2,}([\/:?#].*)?$/i.test(s) || /^localhost([:\/].*)?$/i.test(s) || /^\d{1,3}(\.\d{1,3}){3}([:\/].*)?$/.test(s)) url = 'https://' + s;
      else return { kind: 'search', url: 'search:' + s, query: s };
    }
    var m = /^[a-z][a-z0-9+.\-]*:\/\/(?:[^@\/?#]*@)?([^\/?#:]*)(?::\d+)?([^?#]*)/i.exec(url) || [];
    var host = (m[1] || '').toLowerCase().replace(/^www\./, '');
    var kind = host === 'example.com' || host === 'example.org' || host === 'example.net' ? 'example' : 'offline';
    return { kind: kind, url: url, host: host, path: m[2] || '' };
  }
  function sfDisplay(p) {
    if (p.kind === 'start') return '';
    if (p.kind === 'search') return p.query;
    return p.url.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '');
  }
  var SF_FAVS = [['Example', 'https://example.com', '#3a7bd5'], ['師大', 'https://www.ntnu.edu.tw', '#b03a48'], ['維基百科', 'https://zh.wikipedia.org', '#6b6f78'], ['課程網站', 'https://learning-analytics-tools.pages.dev', '#c78a2a']];

  function openSafari(args) {
    args = args || {};
    var wins = LAB.wm.byApp('safari');
    if (wins.length && args.url && !args.newWindow) {
      var w0 = wins[wins.length - 1];
      if (w0.state.sf) { w0.state.sf.newTab(args.url); w0.focus(); return w0; }
    }
    var F = { tabs: [], cur: 0, nextId: 1 };
    var win = null;
    var back = h('button', { type: 'button', class: 'sy-tbtn', 'aria-label': '上一頁', title: '上一頁', disabled: true, dataset: { lab: 'sf-back' } }, glyph('back', 18, 2));
    var fwd = h('button', { type: 'button', class: 'sy-tbtn', 'aria-label': '下一頁', title: '下一頁', disabled: true, dataset: { lab: 'sf-forward' } }, glyph('chev', 18, 2));
    var lockIc = h('span', { class: 'sy-sf-lock', hidden: true }, glyph('lock', 12, 2));
    var addr = h('input', { type: 'text', class: 'sy-sf-addr', placeholder: '搜尋或輸入網站名稱', 'aria-label': '網址', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', dataset: { lab: 'sf-address' } });
    var reload = h('button', { type: 'button', class: 'sy-sf-reload', 'aria-label': '重新載入頁面', title: '重新載入頁面', dataset: { lab: 'sf-reload' } }, glyph('reload', 14, 2));
    var prog = h('i', { class: 'sy-sf-prog' });
    var field = h('div', { class: 'sy-sf-field' }, lockIc, addr, reload, prog);
    var share = h('button', { type: 'button', class: 'sy-tbtn', 'aria-label': '分享', title: '分享（拷貝網址）', dataset: { lab: 'sf-share' } }, glyph('share', 18, 1.7));
    var plus = h('button', { type: 'button', class: 'sy-tbtn', 'aria-label': '新增分頁', title: '新增分頁', dataset: { lab: 'sf-newtab' } }, glyph('plus', 18, 1.8));
    var tools = h('div', { class: 'sy-sf-tools' }, h('span', { class: 'sy-sf-nav' }, back, fwd), h('span', { class: 'sy-sf-fw' }, field), h('span', { class: 'sy-sf-act' }, share, plus));
    var tabbar = h('div', { class: 'sy-sf-tabs', role: 'tablist', hidden: true, dataset: { lab: 'sf-tabs' } });
    var page = h('div', { class: 'sy-sf-page', dataset: { lab: 'sf-page' } });
    var root = h('div', { class: 'sy-sf', dataset: { lab: 'safari' } }, tabbar, page);

    function T() { return F.tabs[F.cur]; }
    function titleFor(p) {
      if (p.kind === 'start') return '起始頁面';
      if (p.kind === 'example') return 'Example Domain';
      if (p.kind === 'search') return p.query;
      return state.wifi ? '練習版瀏覽器' : '未連接網際網路';
    }
    function link(text, url) {
      var a = h('a', { href: '#', class: 'sy-link', dataset: { lab: 'sf-link', url: url } }, text);
      a.addEventListener('click', function (e) { e.preventDefault(); navigate(url); });
      return a;
    }
    function buildPage(p) {
      var box;
      if (p.kind === 'start') {
        var favs = h('div', { class: 'sy-sf-favs' });
        SF_FAVS.forEach(function (f) {
          var b = h('button', { type: 'button', class: 'sy-sf-fav', dataset: { lab: 'sf-fav', url: f[1] } }, h('span', { class: 'sy-sf-favi', style: { background: f[2] } }, f[0].charAt(0)), h('span', { class: 'sy-sf-favn' }, f[0]));
          b.addEventListener('click', function () { navigate(f[1]); });
          favs.appendChild(b);
        });
        return h('div', { class: 'sy-sf-start' }, h('h2', null, '喜好項目'), favs);
      }
      if (!state.wifi) {
        return h('div', { class: 'sy-sf-off', dataset: { lab: 'sf-offline', kind: 'nonet' } }, h('h1', null, '您未連接網際網路'),
          h('p', null, 'Safari 無法開啟這個頁面，因為這台 Mac 沒有連接網際網路。'),
          h('p', null, link('打開 Wi-Fi 設定', 'about:wifi')));
      }
      if (p.kind === 'example') {
        return h('div', { class: 'sy-ex', dataset: { lab: 'sf-example' } }, h('div', null, h('h1', null, 'Example Domain'),
          h('p', null, 'This domain is for use in illustrative examples in documents. You may use this domain in literature without prior coordination or asking for permission.'),
          h('p', null, link('More information...', 'https://www.iana.org/domains/example'))));
      }
      box = h('div', { class: 'sy-sf-off', dataset: { lab: 'sf-offline', kind: p.kind } },
        h('div', { class: 'sy-sf-eyebrow' }, '練習版瀏覽器'),
        h('h1', null, '這台練習電腦不能上網'),
        h('p', { class: 'sy-sf-url' }, p.kind === 'search' ? '搜尋：' + p.query : p.url),
        h('p', null, '練習用的 Mac 沒有連到網際網路，所以這個網頁不會真的載入。'),
        h('p', null, '想試試看瀏覽器怎麼運作？可以輸入 ', link('example.com', 'https://example.com'), '，會看到一頁示範用的網頁。'));
      return box;
    }
    function loadBar() {
      if (reduced()) return;
      prog.style.transition = 'none'; prog.style.width = '0'; prog.style.opacity = '1';
      void prog.offsetWidth;
      prog.style.transition = 'width .28s ease-out, opacity .18s'; prog.style.width = '100%';
      setTimeout(function () { prog.style.opacity = '0'; }, 300);
    }
    function render() {
      var t = T();
      page.textContent = '';
      page.appendChild(buildPage(t.p));
      page.scrollTop = 0;
      page.classList.toggle('is-grey', t.p.kind === 'example' && state.wifi);
      addr.value = sfDisplay(t.p);
      lockIc.hidden = !(t.p.kind === 'example' || (t.p.kind === 'offline' && /^https:/i.test(t.p.url)));
      back.disabled = t.hi <= 0; fwd.disabled = t.hi >= t.hist.length - 1;
      t.title = titleFor(t.p);
      win.setTitle(t.title);
      renderTabs();
      LAB.bus.emit('safari:page', { url: t.p.url, kind: t.p.kind, title: t.title });
    }
    function renderTabs() {
      tabbar.hidden = F.tabs.length < 2;
      tabbar.textContent = '';
      F.tabs.forEach(function (t, i) {
        var x = h('button', { type: 'button', class: 'sy-sf-x', 'aria-label': '關閉分頁', tabindex: '-1' }, glyph('x', 10, 2.4));
        var b = h('div', { class: 'sy-sf-tab' + (i === F.cur ? ' is-on' : ''), role: 'tab', 'aria-selected': i === F.cur ? 'true' : 'false', tabindex: '0', dataset: { lab: 'sf-tab', tab: String(i) } }, h('span', { class: 'sy-sf-tt' }, t.title || '起始頁面'), x);
        b.addEventListener('click', function () { F.cur = i; render(); });
        x.addEventListener('click', function (e) { e.stopPropagation(); closeTab(i); });
        tabbar.appendChild(b);
      });
    }
    function navigate(input, o) {
      var t = T();
      if (input === 'about:wifi') { sys.openSettings('wifi'); return; }
      var p = sfParse(input);
      if (!o || !o.noHist) { t.hist = t.hist.slice(0, t.hi + 1); t.hist.push(p); t.hi = t.hist.length - 1; }
      t.p = p;
      loadBar();
      render();
    }
    function newTab(url) {
      var p = sfParse(url || '');
      F.tabs.push({ id: F.nextId++, p: p, hist: [p], hi: 0, title: '' });
      F.cur = F.tabs.length - 1;
      loadBar();
      render();
      if (!url) { try { addr.focus(); } catch (e) { /* ignore */ } }
    }
    function closeTab(i) {
      if (F.tabs.length === 1) { win.close(); return; }
      F.tabs.splice(i, 1);
      F.cur = Math.min(F.cur, F.tabs.length - 1);
      if (i < F.cur) F.cur--;
      render();
    }
    function go(d) {
      var t = T(), n = t.hi + d;
      if (n < 0 || n >= t.hist.length) return;
      t.hi = n; t.p = t.hist[n];
      loadBar(); render();
    }
    back.addEventListener('click', function () { go(-1); });
    fwd.addEventListener('click', function () { go(1); });
    reload.addEventListener('click', function () { loadBar(); render(); });
    plus.addEventListener('click', function () { newTab(''); });
    share.addEventListener('click', function () { var t = T(); if (t.p.url) { LAB.clipboard.setText(t.p.url); toastLab('已拷貝網址'); } else toastLab('這一頁沒有網址可以分享'); });
    addr.addEventListener('focus', function () {
      var t = T();
      addr.value = t.p.kind === 'search' ? t.p.query : t.p.url;
      setTimeout(function () { try { addr.select(); } catch (e) { /* ignore */ } }, 0);
    });
    addr.addEventListener('blur', function () { addr.value = sfDisplay(T().p); });
    addr.addEventListener('keydown', function (e) {
      e.stopPropagation();
      if (LAB.ui.isImeEnter(e)) return;
      if (e.key === 'Enter') { e.preventDefault(); var v = addr.value; addr.blur(); navigate(v); }
      else if (e.key === 'Escape') { e.preventDefault(); addr.value = sfDisplay(T().p); addr.blur(); }
    });
    win = LAB.wm.open({
      appId: 'safari', title: 'Safari', width: 980, height: 620, minW: 560, minH: 360, bar: 'unified', toolbar: tools, content: root, icon: 'app-safari'
    });
    win.state.sf = {
      F: F, newTab: newTab, navigate: navigate, closeTab: closeTab, back: function () { go(-1); }, forward: function () { go(1); },
      reload: function () { loadBar(); render(); }, focusAddress: function () { addr.focus(); },
      url: function () { return T().p.url; }, kind: function () { return T().p.kind; }, tabs: function () { return F.tabs.length; }
    };
    F.tabs.push({ id: F.nextId++, p: sfParse(args.url || ''), hist: [], hi: 0, title: '' });
    F.tabs[0].hist = [F.tabs[0].p];
    render();
    LAB.bus.emit('safari:open', { url: F.tabs[0].p.url });
    win.own(LAB.bus.on('sys:change', function (d) { if (d && d.key === 'wifi' && !win.closed) render(); }));
    return win;
  }
  function sfState() { var w = LAB.wm.focused(); if (w && w.appId === 'safari' && w.state.sf) return w.state.sf; var all = LAB.wm.byApp('safari'); w = all[all.length - 1]; return w && w.state.sf ? w.state.sf : null; }
  sys.openUrl = function (url) { return LAB.apps.launch('safari', { url: url }); };
  LAB.apps.register('safari', {
    title: 'Safari', en: 'Safari', aliases: ['safari', 'browser', 'web', 'internet', '瀏覽器', '網頁', '上網'], icon: 'app-safari', dock: true,
    open: function (args) { return openSafari(args); },
    newWindow: function () { openSafari({ newWindow: true }); },
    canHandle: function () { return false; }
  });
  LAB.menu.register('safari', function () {
    var s = sfState();
    return [
      { label: '檔案', items: [
        { label: '新增視窗', shortcut: '⌘N', action: function () { openSafari({ newWindow: true }); } },
        { label: '新增分頁', shortcut: '⌘T', action: function () { if (s) s.newTab(''); else openSafari({ newWindow: true }); } },
        { label: '開啟位置⋯', shortcut: '⌘L', enabled: !!s, action: function () { if (s) s.focusAddress(); } },
        { separator: true },
        { label: '關閉分頁', shortcut: '⌘W', enabled: !!s, action: function () { if (s) s.closeTab(s.F.cur); } },
        { label: '關閉視窗', shortcut: '⇧⌘W', action: function () { var w = LAB.wm.focused(); if (w && w.appId === 'safari') w.close(); } }] },
      { label: '編輯', items: [{ label: '拷貝', shortcut: '⌘C', enabled: false }, { label: '貼上', shortcut: '⌘V', enabled: false }] },
      { label: '顯示方式', items: [{ label: '重新載入頁面', shortcut: '⌘R', enabled: !!s, action: function () { if (s) s.reload(); } }] },
      { label: '歷史記錄', items: [
        { label: '上一頁', shortcut: '⌘[', enabled: !!(s && s.F.tabs[s.F.cur].hi > 0), action: function () { if (s) s.back(); } },
        { label: '下一頁', shortcut: '⌘]', enabled: !!(s && s.F.tabs[s.F.cur].hi < s.F.tabs[s.F.cur].hist.length - 1), action: function () { if (s) s.forward(); } }] },
      { label: '書籤', items: [{ label: '加入書籤⋯', shortcut: '⌘D', enabled: false }] },
      { label: '視窗', items: LAB.menu.windowMenu() },
      { label: '輔助說明', items: [{ label: '搜尋', enabled: false }, { separator: true }, { label: 'Safari 輔助說明', enabled: false }] }
    ];
  });
  LAB.keys.on('mod+l', function () { var s = sfState(); if (!s) return false; s.focusAddress(); }, { scope: 'safari' });
  LAB.keys.on('mod+t', function () { var s = sfState(); if (!s) return false; s.newTab(''); }, { scope: 'safari' });
  LAB.keys.on('mod+w', function () { var s = sfState(); if (!s) return false; s.closeTab(s.F.cur); }, { scope: 'safari' });
  LAB.keys.on('mod+r', function () { var s = sfState(); if (!s) return false; s.reload(); }, { scope: 'safari' });
  LAB.keys.on('mod+[', function () { var s = sfState(); if (!s) return false; s.back(); }, { scope: 'safari' });
  LAB.keys.on('mod+]', function () { var s = sfState(); if (!s) return false; s.forward(); }, { scope: 'safari' });

  /* ================================================================== 預覽程式 (preview)
     Opens .pdf, .png, .jpg (and a few more picture types). A pdf shows pages drawn here (a title and a few lines, nothing from the
     file: the file nodes are empty); a picture shows the seed photo found by its name (LAB.seed.imageUrl) or, for any other picture,
     a landscape drawn from the file name. Zoom in and out, fit to window, a page sidebar for pdfs. */
  var PV_EXT = { '.pdf': 'pdf', '.png': 'img', '.jpg': 'img', '.jpeg': 'img', '.gif': 'img', '.heic': 'img', '.webp': 'img' };
  function pvKind(path) {
    var st = LAB.vfs.stat(path);
    if (!st || st.type !== 'file') return null;
    return PV_EXT[LAB.vfs.extname(st.name).toLowerCase()] || null;
  }
  function pdfPages(name) {
    var base = name.replace(/\.[^.]+$/, '');
    if (/^resume/i.test(base)) {
      return [[
        { t: 'h1', x: '小安' }, { t: 'small', x: '國立臺灣師範大學　學習分析工具 修課學生　an@example.com' }, { t: 'rule' },
        { t: 'h2', x: '學歷' }, { t: 'p', x: '國立臺灣師範大學　教育學院　大學部三年級（就讀中）' },
        { t: 'h2', x: '技能' }, { t: 'li', x: '資料整理：CSV、Excel' }, { t: 'li', x: '終端機基本操作：cd、ls、mv、unzip' }, { t: 'li', x: '請 Codex 幫忙整理專案資料夾' },
        { t: 'h2', x: '專案經驗' }, { t: 'p', x: 'Project：整理 A、B、C 三個班的小考成績（每班 40 位學生），算出平均分數並寫成報告。' },
        { t: 'h2', x: '興趣' }, { t: 'p', x: '登山、攝影、寫課堂筆記' }
      ]];
    }
    if (/^syllabus/i.test(base)) {
      return [[
        { t: 'h1', x: '學習分析工具　課程大綱' }, { t: 'small', x: '這是練習用的示範文件' }, { t: 'rule' },
        { t: 'h2', x: '課程簡介' }, { t: 'p', x: '這門課帶大家用資料了解學習的過程。每週練習一種工具，從資料夾、終端機到 AI 助手，不需要有程式經驗。' },
        { t: 'h2', x: '評分方式' }, { t: 'li', x: '每週作業　40%' }, { t: 'li', x: '課堂小考　30%' }, { t: 'li', x: '期末專案　30%' },
        { t: 'h2', x: '上課方式' }, { t: 'p', x: '每週先看教學影片，再到練習用的電腦完成任務。有問題可以在課堂上提問。' }
      ], [
        { t: 'h1', x: '每週進度' }, { t: 'rule' },
        { t: 'kv', k: 'Week 1', x: '課程介紹與工具準備' }, { t: 'kv', k: 'Week 2', x: '資料與檔案：資料夾和 CSV' }, { t: 'kv', k: 'Week 3', x: '終端機、Finder 與 Codex' },
        { t: 'kv', k: 'Week 4', x: '資料清理' }, { t: 'kv', k: 'Week 5', x: '描述統計' }, { t: 'kv', k: 'Week 6', x: '資料視覺化' },
        { t: 'kv', k: 'Week 7', x: '期中專案報告' }, { t: 'kv', k: 'Week 8', x: '學習歷程資料的分析' },
        { t: 'small', x: '以上為練習版的假資料，與真正的課程進度無關。' }
      ]];
    }
    return [[
      { t: 'h1', x: base }, { t: 'small', x: '練習版預覽程式畫出來的示範頁面' }, { t: 'rule' },
      { t: 'p', x: '這是一個 PDF 檔案。練習用的電腦裡的檔案都是假的，所以這一頁的文字不是檔案真正的內容。' },
      { t: 'p', x: '真正的預覽程式會顯示檔案裡的每一頁，可以放大、縮小、搜尋文字。' }
    ]];
  }
  function pageNode(blocks) {
    var pg = h('div', { class: 'sy-pv-page' });
    blocks.forEach(function (b) {
      if (b.t === 'rule') pg.appendChild(h('div', { class: 'sy-pvb-rule' }));
      else if (b.t === 'kv') pg.appendChild(h('div', { class: 'sy-pvb-kv' }, h('b', null, b.k), h('span', null, b.x)));
      else pg.appendChild(h('div', { class: 'sy-pvb-' + b.t }, b.t === 'li' ? '•　' + b.x : b.x));
    });
    return pg;
  }
  function fallbackPicture(name) {
    var sum = 0;
    for (var i = 0; i < name.length; i++) sum = (sum * 31 + name.charCodeAt(i)) >>> 0;
    var id = ['dusk', 'bay', 'silk'][sum % 3];
    return drawWall(id, 960, 640).toDataURL('image/jpeg', 0.85);
  }

  function openPreview(path) {
    if (!path || !pvKind(path)) { toastLab('預覽程式打不開這個項目'); return null; }
    var p = LAB.vfs.canon(path), st = LAB.vfs.stat(p), kind = pvKind(p), name = st.name;
    var win = null, z = 1, fitMode = true, side = false, nat = { w: 0, h: 0 };
    var pages = kind === 'pdf' ? pdfPages(name) : null;
    var scroll = h('div', { class: 'sy-pv-scroll', tabindex: '0', dataset: { lab: 'pv-scroll' } }), inner = h('div', { class: 'sy-pv-inner' });
    scroll.appendChild(inner);
    var thumbs = h('div', { class: 'sy-pv-side', hidden: true, dataset: { lab: 'pv-sidebar' } });
    var root = h('div', { class: 'sy-pv is-' + kind, dataset: { lab: 'preview', kind: kind, path: p } }, thumbs, scroll);
    var zl = h('span', { class: 'sy-pv-zl' }, '');
    var sub = h('small', null, '');
    var title = h('div', { class: 'sy-pv-title' }, h('b', { dataset: { lab: 'pv-title' } }, name), sub);

    function btnT(gname, label, fn, lab) { var b = h('button', { type: 'button', class: 'sy-tbtn', 'aria-label': label, title: label, dataset: { lab: lab } }, glyph(gname, 19, 1.6)); b.addEventListener('click', fn); return b; }
    var sbBtn = btnT('sidebar', '顯示側邊欄', function () { toggleSide(); }, 'pv-sidebar-toggle');
    if (kind !== 'pdf') sbBtn.disabled = true;
    var tools = h('div', { class: 'sy-pv-tools' }, sbBtn, h('span', { class: 'sy-pv-grp' }, btnT('zoomout', '縮小', function () { zoom(1 / 1.25); }, 'pv-zoom-out'), btnT('zoomin', '放大', function () { zoom(1.25); }, 'pv-zoom-in')),
      btnT('fit', '符合視窗大小', function () { fitMode = true; layout(); }, 'pv-fit'), h('span', { class: 'sy-am-sp' }), title, h('span', { class: 'sy-am-sp' }), zl);

    function viewW() { return Math.max(120, scroll.clientWidth - 48); }
    function viewH() { return Math.max(120, scroll.clientHeight - 48); }
    function fitScale() {
      if (kind === 'pdf') return Math.min(1.4, viewW() / 612);
      if (!nat.w) return 1;
      return Math.min(1, viewW() / nat.w, viewH() / nat.h);
    }
    function layout() {
      if (fitMode) z = fitScale();
      var wrappers = inner.querySelectorAll('.sy-pv-wrap');
      for (var i = 0; i < wrappers.length; i++) {
        var w = wrappers[i];
        if (kind === 'pdf') { w.style.width = (612 * z) + 'px'; w.style.height = (792 * z) + 'px'; w.firstChild.style.transform = 'scale(' + z + ')'; }
        else if (nat.w) { w.style.width = (nat.w * z) + 'px'; w.style.height = (nat.h * z) + 'px'; }
      }
      zl.textContent = Math.round(z * 100) + '%';
      if (win) win.state.pv.z = z;
    }
    function zoom(f) { fitMode = false; z = clamp(z * f, 0.2, 5); layout(); }
    function toggleSide() {
      if (kind !== 'pdf') return;
      side = !side; thumbs.hidden = !side; root.classList.toggle('has-side', side);
      layout();
    }
    function curPage() {
      var wr = inner.querySelectorAll('.sy-pv-wrap'), top = scroll.scrollTop + scroll.clientHeight * 0.35, idx = 0;
      for (var i = 0; i < wr.length; i++) { if (wr[i].offsetTop <= top) idx = i; }
      return idx;
    }
    function updSub() {
      if (kind === 'pdf') sub.textContent = '第 ' + (curPage() + 1) + ' 頁，共 ' + pages.length + ' 頁';
      else sub.textContent = nat.w ? nat.w + ' × ' + nat.h : '';
    }

    if (kind === 'pdf') {
      pages.forEach(function (blocks, i) {
        var wrap = h('div', { class: 'sy-pv-wrap', dataset: { page: String(i + 1) } }, pageNode(blocks));
        inner.appendChild(wrap);
        var th = h('button', { type: 'button', class: 'sy-pv-th', 'aria-label': '第 ' + (i + 1) + ' 頁', dataset: { lab: 'pv-thumb', page: String(i + 1) } }, h('span', { class: 'sy-pv-thp' }, pageNode(blocks)), h('small', null, String(i + 1)));
        th.addEventListener('click', function () { scroll.scrollTop = wrap.offsetTop - 12; updSub(); });
        thumbs.appendChild(th);
      });
      scroll.addEventListener('scroll', updSub);
    } else {
      var url = (LAB.seed && LAB.seed.imageUrl && LAB.seed.imageUrl(p)) || fallbackPicture(name);
      var img = h('img', { alt: name, draggable: 'false', dataset: { lab: 'pv-image' } });
      var wrap2 = h('div', { class: 'sy-pv-wrap is-img' }, img);
      inner.appendChild(wrap2);
      img.addEventListener('load', function () { nat.w = img.naturalWidth; nat.h = img.naturalHeight; layout(); updSub(); });
      img.src = url;
    }
    win = LAB.wm.open({
      appId: 'preview', title: name, width: 780, height: 580, minW: 420, minH: 320, bar: 'unified', toolbar: tools, singleton: 'pv:' + p, content: root, icon: 'app-preview'
    });
    win.state.pv = { path: p, kind: kind, z: z, zoom: zoom, fit: function () { fitMode = true; layout(); }, toggleSide: toggleSide };
    win.state.path = p;
    win.on('resize', function () { if (fitMode) layout(); });
    layout(); updSub();
    LAB.bus.emit('preview:open', { path: p, kind: kind });
    return win;
  }
  function pvState() { var w = LAB.wm.focused(); return w && w.appId === 'preview' && w.state.pv ? w.state.pv : null; }
  LAB.apps.register('preview', {
    title: '預覽程式', en: 'Preview', aliases: ['preview', 'pdf', 'image', 'photo', '圖片', '相片', '照片'], icon: 'app-preview', dock: true,
    open: function (args) {
      if (args && args.path) return openPreview(args.path);
      toastLab('把 PDF 或圖片拖到這裡，或在 Finder 裡點兩下就能用預覽程式打開');
      return null;
    },
    canHandle: function (path) { return !!pvKind(path); },
    handleOpen: function (path) { return !!openPreview(path); },
    canOpen: function (st) { return st && st.type === 'file' && PV_EXT[LAB.vfs.extname(st.name).toLowerCase()] ? 30 : 0; }
  });
  LAB.menu.register('preview', function () {
    var s = pvState();
    return [
      { label: '檔案', items: [{ label: '關閉', shortcut: '⌘W', action: function () { var w = LAB.wm.focused(); if (w) w.close(); } }] },
      { label: '編輯', items: [{ label: '拷貝', shortcut: '⌘C', enabled: false }, { label: '全選', shortcut: '⌘A', enabled: false }] },
      { label: '顯示方式', items: [
        { label: '顯示側邊欄', shortcut: '⌥⌘2', enabled: !!(s && s.kind === 'pdf'), action: function () { if (s) s.toggleSide(); } },
        { separator: true },
        { label: '放大', shortcut: '⌘+', enabled: !!s, action: function () { if (s) s.zoom(1.25); } },
        { label: '縮小', shortcut: '⌘-', enabled: !!s, action: function () { if (s) s.zoom(1 / 1.25); } },
        { label: '符合視窗大小', shortcut: '⌘9', enabled: !!s, action: function () { if (s) s.fit(); } }] },
      { label: '前往', items: [{ label: '上一頁', enabled: false }, { label: '下一頁', enabled: false }] },
      { label: '工具', items: [{ label: '標示', enabled: false }, { label: '調整大小⋯', enabled: false }] },
      { label: '視窗', items: LAB.menu.windowMenu() },
      { label: '輔助說明', items: [{ label: '搜尋', enabled: false }, { separator: true }, { label: '預覽程式輔助說明', enabled: false }] }
    ];
  });
  LAB.keys.on('mod+=', function () { var s = pvState(); if (!s) return false; s.zoom(1.25); }, { scope: 'preview' });
  LAB.keys.on('mod+-', function () { var s = pvState(); if (!s) return false; s.zoom(1 / 1.25); }, { scope: 'preview' });
  LAB.keys.on('mod+9', function () { var s = pvState(); if (!s) return false; s.fit(); }, { scope: 'preview' });

  /* ================================================================== 應用程式 (launchpad): the full-screen grid of apps, the Dock's second icon */
  var lpEl = null, lpOff = null;
  var LP_SKIP = { finder: 1, quicklook: 1, archive: 1, launchpad: 1, forcequit: 1, aboutmac: 1 };
  function closeLaunchpad() {
    if (!lpEl) return;
    var el = lpEl; lpEl = null;
    if (lpOff) { lpOff(); lpOff = null; }
    el.classList.remove('is-in');
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, reduced() ? 0 : 180);
    try { LAB.bus.emit('launchpad:close', {}); } catch (e) { /* ignore */ }
  }
  function openLaunchpad() {
    if (lpEl) { closeLaunchpad(); return; }
    closeTransient();
    var st = stageEl();
    if (!st) return;
    var wall = document.getElementById('lab-wall');
    var bg = h('div', { class: 'sy-lp-bg' });
    if (wall) {
      var cs = window.getComputedStyle(wall);
      bg.style.backgroundImage = cs.backgroundImage; bg.style.backgroundSize = cs.backgroundSize; bg.style.backgroundPosition = cs.backgroundPosition;
      bg.style.backgroundColor = cs.backgroundColor; bg.style.backgroundRepeat = cs.backgroundRepeat;
    }
    var input = h('input', { type: 'text', class: 'sy-lp-search', placeholder: '搜尋', 'aria-label': '搜尋 App', autocomplete: 'off', spellcheck: 'false', dataset: { lab: 'lp-search' } });
    var grid = h('div', { class: 'sy-lp-grid', role: 'list', dataset: { lab: 'lp-grid' } });
    var back = document.activeElement;
    function appsList() {
      var out = [];
      LAB.apps.all().forEach(function (d) { if (!LP_SKIP[d.id] && d.title) out.push(d); });
      out.sort(function (a, b) {
        var la = /^[A-Za-z]/.test(a.title) ? 0 : 1, lb = /^[A-Za-z]/.test(b.title) ? 0 : 1;      // Latin names first, then the Chinese ones
        if (la !== lb) return la - lb;
        return String(a.title).localeCompare(String(b.title), 'zh-Hant');
      });
      return out;
    }
    function render() {
      var q = input.value.trim().toLowerCase();
      grid.textContent = '';
      appsList().forEach(function (d) {
        if (q && (d.title + ' ' + (d.en || '') + ' ' + (d.aliases || []).join(' ')).toLowerCase().indexOf(q) < 0) return;
        var b = h('button', { type: 'button', class: 'sy-lp-app', role: 'listitem', dataset: { lab: 'lp-app', app: d.id } }, h('span', { class: 'sy-lp-ic' }, ico(d.icon, 84)), h('span', { class: 'sy-lp-nm' }, d.title));
        b.addEventListener('click', function (e) { e.stopPropagation(); closeLaunchpad(); LAB.apps.launch(d.id, undefined, { bounce: true }); });
        grid.appendChild(b);
      });
      if (!grid.children.length) grid.appendChild(h('div', { class: 'sy-lp-none' }, '找不到符合的 App'));
    }
    render();
    input.addEventListener('input', render);
    input.addEventListener('keydown', function (e) {
      if (LAB.ui.isImeEnter(e)) return;
      if (e.key === 'Enter') { var f = grid.querySelector('.sy-lp-app'); if (f) f.click(); }
    });
    lpEl = h('div', { class: 'sy-lp', role: 'dialog', 'aria-modal': 'true', 'aria-label': '應用程式', dataset: { lab: 'launchpad' } }, bg, h('div', { class: 'sy-lp-top' }, h('span', { class: 'sy-lp-sg' }, glyph('search', 15, 2), input)), grid);
    lpEl.addEventListener('pointerdown', function (e) { if (e.target === lpEl || e.target === grid || e.target === bg || e.target.className === 'sy-lp-top') closeLaunchpad(); });
    lpOff = LAB.keys.modal(function (e) {
      if (e.key === 'Escape') { if (!LAB.ui.isImeEnter(e)) closeLaunchpad(); return true; }
      return false;
    });
    st.appendChild(lpEl);
    requestAnimationFrame(function () { requestAnimationFrame(function () { if (lpEl) { lpEl.classList.add('is-in'); try { input.focus(); } catch (e) { /* ignore */ } } }); });
    try { LAB.bus.emit('launchpad:open', {}); } catch (e2) { /* ignore */ }
  }
  sys.openLaunchpad = openLaunchpad;
  sys.closeLaunchpad = closeLaunchpad;
  LAB.bus.on('stage:resize', function () { closeLaunchpad(); });

  LAB.apps.register('launchpad', {
    title: '應用程式', en: 'Apps', aliases: ['launchpad', 'apps', '應用程式', '啟動台'], icon: 'app-launchpad', dock: true, nospot: true, noBounce: true,
    open: function () { openLaunchpad(); return null; }
  });
  LAB.menu.register('launchpad', function () { return [{ label: '視窗', items: LAB.menu.windowMenu() }]; });
  LAB.apps.register('aboutmac', { title: '關於這台 Mac', en: 'About This Mac', icon: 'app-settings', dock: false, nospot: true, open: function () { return openAboutMac(); } });
  LAB.menu.register('aboutmac', function () { return [{ label: '視窗', items: LAB.menu.windowMenu() }]; });
  LAB.apps.register('forcequit', { title: '強制結束', en: 'Force Quit', icon: 'app-forcequit', dock: false, nospot: true, open: function () { return openForceQuit(); } });
  LAB.menu.register('forcequit', function () { return [{ label: '視窗', items: LAB.menu.windowMenu() }]; });

  /* ================================================================== recents (Apple menu › 最近使用的項目) */
  var recents = { apps: [], docs: [] };
  var NO_RECENT = { finder: 1, quicklook: 1, archive: 1, launchpad: 1, forcequit: 1, aboutmac: 1, about: 1 };
  function pushRecent(list, v, max) { var i = list.indexOf(v); if (i >= 0) list.splice(i, 1); list.unshift(v); if (list.length > max) list.length = max; }
  LAB.bus.on('app:launch', function (d) { if (d && d.appId && !NO_RECENT[d.appId]) pushRecent(recents.apps, d.appId, 8); });
  LAB.bus.on('finder:open', function (d) { if (d && d.path && d.kind !== 'missing' && d.kind !== 'folder') pushRecent(recents.docs, d.path, 10); });
  sys.recents = function () { return { apps: recents.apps.slice(), docs: recents.docs.filter(function (p) { return LAB.vfs.exists(p); }) }; };
  sys.clearRecents = function () { recents.apps.length = 0; recents.docs.length = 0; };

  /* ================================================================== Spotlight helpers: inline maths and unit conversion */
  sys.evalMath = function (src) {
    var s = String(src || '').replace(/×/g, '*').replace(/÷/g, '/').replace(/（/g, '(').replace(/）/g, ')').replace(/＋/g, '+').replace(/－/g, '-').replace(/＊/g, '*').replace(/，/g, '');
    s = s.replace(/(\d)\s*[xX]\s*(?=[\d(])/g, '$1*').replace(/(\d),(?=\d{3}\b)/g, '$1');
    if (!/^[0-9+\-*\/().%^\s]+$/.test(s) || !/[0-9]/.test(s) || !/[+\-*\/%^]/.test(s.replace(/^\s*-/, ''))) return null;
    var i = 0, bad = false;
    function ws() { while (i < s.length && s.charAt(i) === ' ') i++; }
    function peek() { ws(); return s.charAt(i); }
    function num() {
      ws();
      var m = /^\d*\.?\d+(?:\.\d*)?|^\d+\.?/.exec(s.slice(i));
      if (!m) { bad = true; return 0; }
      i += m[0].length;
      var v = parseFloat(m[0]);
      if (peek() === '%') { i++; v = v / 100; }
      return v;
    }
    function primary() {
      var c = peek();
      if (c === '(') { i++; var v = expr(); if (peek() === ')') i++; else bad = true; return v; }
      return num();
    }
    function unary() {
      var c = peek();
      if (c === '-') { i++; return -unary(); }
      if (c === '+') { i++; return unary(); }
      return primary();
    }
    function power() { var b = unary(); if (peek() === '^') { i++; return Math.pow(b, power()); } return b; }
    function term() {
      var v = power();
      for (;;) {
        var c = peek();
        if (c === '*') { i++; v *= power(); } else if (c === '/') { i++; v /= power(); } else break;
      }
      return v;
    }
    function expr() {
      var v = term();
      for (;;) {
        var c = peek();
        if (c === '+') { i++; v += term(); } else if (c === '-') { i++; v -= term(); } else break;
      }
      return v;
    }
    var r = expr();
    ws();
    if (bad || i < s.length || !isFinite(r)) return null;
    return r;
  };
  sys.fmtResult = function (n) { return groupInt(String(parseFloat(n.toPrecision(12)))); };
  var UNIT_TABLE = (function () {
    var t = {};
    function add(kind, factor, names) { names.forEach(function (n) { t[n] = { kind: kind, f: factor, label: names[0] }; }); }
    add('length', 1, ['m', 'meter', 'meters', 'metre', '公尺', '米']); add('length', 1000, ['km', 'kilometer', 'kilometers', '公里']);
    add('length', 0.01, ['cm', '公分']); add('length', 0.001, ['mm', '公釐', '毫米']); add('length', 1609.344, ['mi', 'mile', 'miles', '英里']);
    add('length', 0.3048, ['ft', 'foot', 'feet', '英呎', '英尺']); add('length', 0.0254, ['in', 'inch', 'inches', '英吋']); add('length', 0.9144, ['yd', 'yard', 'yards', '碼']);
    add('mass', 1, ['kg', 'kilogram', 'kilograms', '公斤']); add('mass', 0.001, ['g', 'gram', 'grams', '公克']); add('mass', 0.45359237, ['lb', 'lbs', 'pound', 'pounds', '磅']);
    add('mass', 0.028349523125, ['oz', 'ounce', 'ounces', '盎司']);
    add('temp', 0, ['c', '°c', 'celsius', '攝氏']); add('temp', 1, ['f', '°f', 'fahrenheit', '華氏']); add('temp', 2, ['k', 'kelvin']);
    return t;
  })();
  sys.convertUnits = function (q) {
    var m = /^\s*(-?\d+(?:[.,]\d+)?)\s*([^\d\s]+?)\s+(?:in|to|=|轉|轉成|換成|是多少)\s*([^\d\s]+?)\s*$/i.exec(String(q || '')) || /^\s*(-?\d+(?:[.,]\d+)?)\s*([a-z°]+|[^\d\s]+?)\s*(?:to|in|=|轉成|換成)\s*([a-z°]+|[^\d\s]+?)\s*$/i.exec(String(q || ''));
    if (!m) return null;
    var v = parseFloat(m[1].replace(',', '.')), a = UNIT_TABLE[m[2].toLowerCase()], b = UNIT_TABLE[m[3].toLowerCase()];
    if (!a || !b || a.kind !== b.kind) return null;
    var out;
    if (a.kind === 'temp') {
      var c = a.f === 0 ? v : a.f === 1 ? (v - 32) * 5 / 9 : v - 273.15;
      out = b.f === 0 ? c : b.f === 1 ? c * 9 / 5 + 32 : c + 273.15;
    } else out = v * a.f / b.f;
    var sh = { c: '°C', f: '°F', k: 'K' };
    function lab(u, x) { return u.kind === 'temp' ? sh[['c', 'f', 'k'][u.f]] : u.label; }
    function fmt6(n) { return groupInt(String(parseFloat(n.toPrecision(6)))); }
    return { value: out, text: sys.fmtResult(v) + ' ' + lab(a) + ' = ' + fmt6(out) + ' ' + lab(b), result: fmt6(out) + ' ' + lab(b) };
  };

  /* ================================================================== boot */
  LAB.ready(function () { applyNetwork(); applyBrightness(); }, 35);
  LAB.keys.on('alt+mod+escape', function () { openForceQuit(); });
})(window.LAB);
