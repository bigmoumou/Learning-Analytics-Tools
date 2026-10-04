/* 銀杏觀測誌 — 互動程式
 * 原生 JavaScript，不使用任何框架或套件。地圖是自寫的 OpenStreetMap 圖磚瀏覽器（Web Mercator）。
 * 資料來自 data.js（GINKGO_DATA）。所有資料都以 textContent 插入，不使用 innerHTML。
 */
(function () {
  'use strict';

  var D = window.GINKGO_DATA;
  var main = document.getElementById('main');
  if (!D || !D.places) {
    if (main) {
      var p = document.createElement('p');
      p.className = 'wrap noscript';
      p.textContent = '資料檔 data.js 沒有載入，請確認它和 index.html 放在同一個資料夾。';
      main.prepend(p);
    }
    return;
  }

  /* ---------------- helpers ---------------- */
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var SVGNS = 'http://www.w3.org/2000/svg';
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v == null || v === false) return;
        if (k === 'class') el.className = v;
        else if (k === 'text') el.textContent = v;
        else if (k === 'dataset') Object.keys(v).forEach(function (d) { el.dataset[d] = v[d]; });
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else el.setAttribute(k, v === true ? '' : v);
      });
    }
    for (var i = 2; i < arguments.length; i++) append(el, arguments[i]);
    return el;
  }
  function append(el, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { append(el, x); }); return; }
    el.appendChild(c.nodeType ? c : document.createTextNode(String(c)));
  }
  function s(tag, attrs) {
    var el = document.createElementNS(SVGNS, tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { el.setAttribute(k, attrs[k]); });
    for (var i = 2; i < arguments.length; i++) { var c = arguments[i]; if (c != null) el.appendChild(c.nodeType ? c : document.createTextNode(String(c))); }
    return el;
  }
  function icon(paths, cls) {
    var svg = s('svg', { viewBox: '0 0 20 20', 'aria-hidden': 'true', focusable: 'false' });
    if (cls) svg.setAttribute('class', cls);
    paths.forEach(function (d) { svg.appendChild(s('path', { d: d })); });
    return svg;
  }
  var IC = {
    plus: ['M10 4v12', 'M4 10h12'],
    check: ['M4 10.5l4 4 8-9'],
    up: ['M10 15V5', 'M5 9.5 10 4.5l5 5'],
    down: ['M10 5v10', 'M5 10.5l5 5 5-5'],
    x: ['M5 5l10 10', 'M15 5 5 15'],
    ext: ['M8 4H4v12h12v-4', 'M11 3h6v6', 'M17 3l-8 8'],
    walk: ['M10.5 3.5a1.5 1.5 0 1 1 0 .01', 'M9 7l-2 4 3 2v4', 'M9 7l3 1 1 3', 'M7 11l-2 6']
  };
  function extLink(href, text, cls) {
    return h('a', { href: href, target: '_blank', rel: 'noopener noreferrer', class: cls || null }, text);
  }
  function announce(msg) {
    var a = $('#announce');
    a.textContent = '';
    window.setTimeout(function () { a.textContent = msg; }, 30);
  }
  function storage() {
    try { var k = '__t'; window.localStorage.setItem(k, k); window.localStorage.removeItem(k); return window.localStorage; } catch (e) { return null; }
  }

  // search normalisation: width, case, kana, Japanese shinjitai → traditional forms
  var VARIANTS = { '黒': '黑', '国': '國', '区': '區', '広': '廣', '徳': '德', '旧': '舊', '戸': '戶', '渋': '澀', '沢': '澤', '楽': '樂', '学': '學', '駅': '站', '辺': '邊', '桜': '櫻', '温': '溫', '径': '徑', '気': '氣', '内': '內', '緑': '綠', '黄': '黃', '観': '觀', '関': '關', '台': '臺', '会': '會', '絵': '繪', '画': '畫', '図': '圖', '庁': '廳', '蔵': '藏', '仏': '佛', '伝': '傳', '万': '萬', '与': '與', '豊': '豐', '鉄': '鐵', '条': '條', '様': '樣', '経': '經', '総': '總', '覧': '覽', '郷': '鄉', '団': '團', '単': '單', '読': '讀', '県': '縣', '円': '圓', '発': '發', '芸': '藝', '営': '營', '歩': '步', '塩': '鹽', '浜': '濱', '将': '將', '寿': '壽', '児': '兒', '実': '實' };
  function norm(str) {
    var t = String(str || '').normalize ? String(str || '').normalize('NFKC') : String(str || '');
    t = t.toLowerCase().replace(/(.)々/g, '$1$1').replace(/[ヶヵ]/g, 'が');
    t = t.replace(/[ァ-ヶ]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0x60); });
    t = t.replace(/[\s・｜|、，,。．.／/（）()「」『』\-–—_~～]/g, '');
    var out = '';
    for (var i = 0; i < t.length; i++) { var c = t[i]; out += VARIANTS[c] || c; }
    return out;
  }

  /* ---------------- data ---------------- */
  var PLACES = D.places;
  var byId = {};
  PLACES.forEach(function (p) { byId[p.id] = p; });
  var STAGES = D.stages;
  var UNK = '待確認';
  var META = D.meta;
  var SPEED = META.walkSpeed || 80;
  var WARD_ORDER = [];
  D.wardGroups.forEach(function (g) { g.wards.forEach(function (w) { WARD_ORDER.push(w); }); });
  var stageColor = {};
  STAGES.forEach(function (st, i) { stageColor[st.key] = 'var(--s' + (i + 1) + ')'; });
  function groupBy(arr, key) { var o = {}; arr.forEach(function (x) { (o[x[key]] = o[x[key]] || []).push(x); }); return o; }
  var histBy = groupBy(D.history, 'place');
  var curBy = groupBy(D.current2026, 'place');
  PLACES.forEach(function (p) {
    p._hay = norm([p.id, p.row, p.zh, p.ja, p.wards.join(' '), p.alias, p.sheetArea].join(' '));
    var hs = (histBy[p.id] || []).slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    p._hist = hs;
    p._cur = (curBy[p.id] || []).slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; });   // 2026 items, oldest first
  });
  function placeLabel(p) { return p.zh; }
  // keep row IDs such as TKG-038 on one line (wrap each in a no-wrap span)
  function ids(str) {
    var out = [], re = /TKG-\d{3}(?:[～~]\d{3})?/g, last = 0, m;
    str = String(str == null ? '' : str);
    while ((m = re.exec(str))) {
      if (m.index > last) out.push(str.slice(last, m.index));
      out.push(h('span', { class: 'nowrap' }, m[0]));
      last = re.lastIndex;
    }
    if (last < str.length) out.push(str.slice(last));
    return out;
  }
  function wardText(p) { return p.wards.join('、'); }
  function shortUrl(u) { return u.replace(/^https?:\/\//, '').replace(/\/$/, '/'); }

  /* ---------------- state ---------------- */
  var LS_KEY = 'ginkgo-notebook.walk.v1';
  var store = storage();
  function loadWalk() {
    if (!store) return [];
    try {
      var v = JSON.parse(store.getItem(LS_KEY) || '[]');
      if (!Array.isArray(v)) return [];
      var seen = {};
      return v.filter(function (id) { if (!byId[id] || seen[id]) return false; seen[id] = 1; return true; });
    } catch (e) { return []; }
  }
  function saveWalk() {
    if (!store) return;
    try { store.setItem(LS_KEY, JSON.stringify(state.walk)); } catch (e) { /* storage full or blocked: keep in memory */ }
  }
  var state = { zone: 'map', view: 'map', q: '', ward: '', stage: null, selected: null, walk: loadWalk(), srcQ: '', srcCat: 'all', auto: null };

  /* ---------------- geo ---------------- */
  function haversine(a, b) {
    var R = 6371008.8, toR = Math.PI / 180;
    var dLat = (b.lat - a.lat) * toR, dLng = (b.lng - a.lng) * toR;
    var x = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)));
  }
  function walkMin(m) { return Math.max(1, Math.round(m / SPEED)); }
  function fmtDist(m) { return m < 1000 ? (Math.round(m / 10) * 10) + ' m' : (m / 1000).toFixed(m < 10000 ? 1 : 0) + ' km'; }
  function nwDist(m) { return h('span', { class: 'nowrap' }, fmtDist(m)); }
  function nwMin(min) { return h('span', { class: 'nowrap' }, fmtMin(min)); }
  function fmtMin(min) { if (min < 60) return min + ' 分'; var hh = Math.floor(min / 60), mm = min % 60; return hh + ' 小時' + (mm ? ' ' + mm + ' 分' : ''); }
  function ll(p) { return p.lat + ',' + p.lng; }
  function gDest(p) { return 'https://www.google.com/maps/dir/?api=1&destination=' + ll(p) + '&travelmode=walking'; }
  function gLeg(a, b) { return 'https://www.google.com/maps/dir/?api=1&origin=' + ll(a) + '&destination=' + ll(b) + '&travelmode=walking'; }
  function gRoute(ps) {
    if (ps.length < 2) return null;
    var mid = ps.slice(1, -1);
    if (mid.length > 9) return null;
    var u = 'https://www.google.com/maps/dir/?api=1&origin=' + ll(ps[0]) + '&destination=' + ll(ps[ps.length - 1]) + '&travelmode=walking';
    if (mid.length) u += '&waypoints=' + mid.map(ll).join('%7C');
    return u;
  }
  function legsOf(ps) {
    var out = [];
    for (var i = 1; i < ps.length; i++) { var d = haversine(ps[i - 1], ps[i]); out.push({ a: ps[i - 1], b: ps[i], m: d, min: walkMin(d) }); }
    return out;
  }

  /* ---------------- tabs (roving tabindex, arrow keys) ---------------- */
  function setupTabs(list, onSelect) {
    var tabs = $$('[role="tab"]', list);
    function select(tab, focus) {
      tabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.tabIndex = on ? 0 : -1;
        var panel = document.getElementById(t.getAttribute('aria-controls'));
        if (panel) panel.hidden = !on;
      });
      if (focus) tab.focus();
      onSelect(tab);
    }
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { select(t, false); });
      t.addEventListener('keydown', function (e) {
        var j = null;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') j = (i + 1) % tabs.length;
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') j = (i - 1 + tabs.length) % tabs.length;
        else if (e.key === 'Home') j = 0;
        else if (e.key === 'End') j = tabs.length - 1;
        if (j != null) { e.preventDefault(); select(tabs[j], true); }
      });
    });
    return { select: function (id, focus) { var t = document.getElementById(id); if (t) select(t, focus); } };
  }

  /* ======================================================================
   * NoteMap — a small hand-built slippy map for OpenStreetMap tiles
   * ==================================================================== */
  function NoteMap(root, opt) {
    var TILE = 256, MINZ = 8, MAXZ = 18, TILEMAX = 19;
    var tilesEl = $('.map__tiles', root), pinsEl = $('.map__pins', root);
    var msgEl = opt.msgEl, scaleBar = $('.map__scalebar', root), scaleText = $('.map__scaletext', root);
    var W = 0, H = 0, lastSize = null, hasView = false, wantFit = true;
    var z = 11, center = { lat: 35.69, lng: 139.6 };
    var tiles = {}, tileCount = 0, loadedN = 0, failedN = 0;
    var markers = [], selectedId = null, raf = 0, anim = null;
    var drag = null, pointers = {}, pinch = null, suppressClick = false;
    var userView = false;   // true once the person pans or zooms away from the fitted overview

    function worldSize(zz) { return TILE * Math.pow(2, zz); }
    function project(lat, lng, zz) {
      var sz = worldSize(zz), sin = Math.sin(lat * Math.PI / 180);
      sin = Math.max(Math.min(sin, 0.9999), -0.9999);
      return { x: (lng + 180) / 360 * sz, y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * sz };
    }
    function unproject(x, y, zz) {
      var sz = worldSize(zz), n = Math.PI - 2 * Math.PI * y / sz;
      return { lat: 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))), lng: x / sz * 360 - 180 };
    }
    function clampZ(v) { return Math.max(MINZ, Math.min(MAXZ, v)); }
    function screenOf(lat, lng) {
      var c = project(center.lat, center.lng, z), p = project(lat, lng, z);
      return { x: p.x - c.x + W / 2, y: p.y - c.y + H / 2 };
    }

    function schedule() { if (!raf) raf = window.requestAnimationFrame(function () { raf = 0; render(); }); }

    function render() {
      if (!W || !H || !hasView) return;
      root.classList.toggle('is-far', z < 11.5);      // overview: smaller dots so crowded central pins stay apart
      var tz = Math.max(0, Math.min(TILEMAX, Math.round(z)));
      var need = {}, allLoaded = true;
      var n = Math.pow(2, tz);
      var scale = Math.pow(2, z - tz), ts = TILE * scale;
      var c = project(center.lat, center.lng, tz);
      var ox = c.x * scale - W / 2, oy = c.y * scale - H / 2;
      var x0 = Math.floor(ox / ts), x1 = Math.floor((ox + W) / ts), y0 = Math.max(0, Math.floor(oy / ts)), y1 = Math.min(n - 1, Math.floor((oy + H) / ts));
      for (var ty = y0; ty <= y1; ty++) {
        for (var tx = x0; tx <= x1; tx++) {
          var wx = ((tx % n) + n) % n, key = tz + '/' + wx + '/' + ty;
          need[key] = 1;
          var t = tiles[key];
          if (!t) t = addTile(tz, wx, ty, key);
          t.tx = tx;
          if (!t.loaded) allLoaded = false;
        }
      }
      Object.keys(tiles).forEach(function (key) {
        var t = tiles[key];
        if (need[key]) { place(t, tz, t.tx); return; }
        if (t.z !== tz && !allLoaded && t.loaded && !t.failed && Math.abs(t.z - tz) <= 3 && place(t, t.z, t.tx)) return;
        removeTile(key);
      });
      markers.forEach(function (m) {
        var p = screenOf(m.lat, m.lng);
        m.sx = p.x; m.sy = p.y;
        m.el.style.transform = 'translate(' + Math.round(p.x) + 'px,' + Math.round(p.y) + 'px)';
        m.el.classList.toggle('flip', p.x > W - 170);
      });
      renderScale();
    }
    function place(t, tz, txUnwrapped) {
      var scale = Math.pow(2, z - tz), ts = TILE * scale;
      var c = project(center.lat, center.lng, tz);
      var ox = c.x * scale - W / 2, oy = c.y * scale - H / 2;
      var tx = txUnwrapped != null ? txUnwrapped : t.x;
      var left = Math.round(tx * ts - ox), right = Math.round((tx + 1) * ts - ox);
      var top = Math.round(t.y * ts - oy), bottom = Math.round((t.y + 1) * ts - oy);
      t.img.style.transform = 'translate(' + left + 'px,' + top + 'px)';
      t.img.style.width = (right - left) + 'px';
      t.img.style.height = (bottom - top) + 'px';
      t.img.style.zIndex = String(10 - Math.abs(tz - Math.round(z)));
      return right > 0 && bottom > 0 && left < W && top < H;   // still covers part of the view
    }
    // OSM answers blocked clients with HTTP 200 and an "Access blocked" picture that has a
    // yellow/black hazard stripe on its left edge; treat such tiles as failures, not as a map.
    var checkedN = 0, blockedN = 0;
    function looksBlocked(img) {
      try {
        var c = document.createElement('canvas');
        c.width = 24; c.height = 256;
        var g = c.getContext('2d', { willReadFrequently: true });
        g.drawImage(img, 0, 0);
        var d = g.getImageData(0, 0, 24, 256).data, yellow = 0, black = 0;
        for (var yy = 0; yy < 256; yy += 4) {
          for (var xx = 12; xx <= 14; xx += 2) {
            var i = (yy * 24 + xx) * 4, r = d[i], gg = d[i + 1], bb = d[i + 2];
            if (r > 200 && gg > 160 && bb < 90) yellow++;
            else if (r < 60 && gg < 60 && bb < 60) black++;
          }
        }
        return yellow > 6 && black > 6;
      } catch (e) { return false; }
    }
    function addTile(tz, x, y, key) {
      var img = new Image();
      img.alt = '';
      img.decoding = 'async';
      img.draggable = false;
      img.crossOrigin = 'anonymous';
      var t = { z: tz, x: x, y: y, img: img, loaded: false };
      img.onload = function () {
        if (blockedN || checkedN < 8) {
          checkedN++;
          if (looksBlocked(img)) { blockedN++; t.failed = true; failedN++; root.classList.add('is-blocked'); updateMsg(); return; }
        }
        t.loaded = true; img.classList.add('is-loaded'); loadedN++; updateMsg(); schedule();
      };
      img.onerror = function () { failedN++; t.failed = true; updateMsg(); };
      img.src = 'https://tile.openstreetmap.org/' + tz + '/' + x + '/' + y + '.png';
      tilesEl.appendChild(img);
      tiles[key] = t; tileCount++;
      return t;
    }
    function removeTile(key) {
      var t = tiles[key];
      if (!t) return;
      t.img.onload = t.img.onerror = null;
      if (t.img.parentNode) t.img.parentNode.removeChild(t.img);
      delete tiles[key]; tileCount--;
    }
    function updateMsg() {
      var bad = blockedN >= 2 || (failedN >= 3 && loadedN === 0) || (failedN >= 8 && failedN > loadedN);
      msgEl.hidden = !bad;
    }
    function renderScale() {
      var mpp = 156543.03392 * Math.cos(center.lat * Math.PI / 180) / Math.pow(2, z);
      var steps = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000];
      var pick = steps[0];
      for (var i = 0; i < steps.length; i++) if (steps[i] / mpp <= 110) pick = steps[i];
      scaleBar.style.width = Math.round(pick / mpp) + 'px';
      scaleText.textContent = pick >= 1000 ? (pick / 1000) + ' km' : pick + ' m';
    }

    /* ---- view changes ---- */
    function setView(c, zz, animate) {
      zz = clampZ(zz);
      if (anim) { window.cancelAnimationFrame(anim.raf); anim = null; }
      if (!animate || reduceMotion || !hasView) { center = { lat: c.lat, lng: c.lng }; z = zz; hasView = true; schedule(); return; }
      var from = { c: center, z: z }, t0 = performance.now(), dur = 300;
      anim = { raf: 0 };
      (function step(now) {
        var k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
        z = from.z + (zz - from.z) * e;
        var a = project(from.c.lat, from.c.lng, 0), b = project(c.lat, c.lng, 0);
        center = unproject(a.x + (b.x - a.x) * e, a.y + (b.y - a.y) * e, 0);
        render();
        if (k < 1) anim.raf = window.requestAnimationFrame(step); else anim = null;
      })(t0);
    }
    function zoomAround(newZ, sx, sy, animate) {
      newZ = clampZ(newZ);
      if (sx == null) { setView(center, newZ, animate); return; }
      var c = project(center.lat, center.lng, z);
      var px = c.x + (sx - W / 2), py = c.y + (sy - H / 2);
      var anchor = unproject(px, py, z);
      var a2 = project(anchor.lat, anchor.lng, newZ);
      var nc = unproject(a2.x - (sx - W / 2), a2.y - (sy - H / 2), newZ);
      setView(nc, newZ, animate);
    }
    function panBy(dx, dy, animate) {
      var c = project(center.lat, center.lng, z);
      setView(unproject(c.x + dx, c.y + dy, z), z, animate);
    }
    // symmetric side padding uses the full width; the zoom buttons only cover the top-right corner,
    // so a fit that would put a pin under them is redone with a wider right margin
    function pad(wide) {
      var small = W < 520;
      return { t: small ? 44 : 54, r: wide ? (small ? 66 : 74) : (small ? 30 : 48), b: small ? 44 : 56, l: small ? 30 : 48 };
    }
    var ctrlEl = $('.map__ctrl', root);
    function solveFit(pts, P) {
      var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      pts.forEach(function (p) { var q = project(p.lat, p.lng, 0); minX = Math.min(minX, q.x); maxX = Math.max(maxX, q.x); minY = Math.min(minY, q.y); maxY = Math.max(maxY, q.y); });
      var aw = Math.max(40, W - P.l - P.r), ah = Math.max(40, H - P.t - P.b);
      var zx = Math.log(aw / Math.max(1e-9, maxX - minX)) / Math.LN2, zy = Math.log(ah / Math.max(1e-9, maxY - minY)) / Math.LN2;
      var zz = clampZ(Math.min(zx, zy, 15));
      // centre of the padded box, not of the whole map
      var cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, k = Math.pow(2, zz);
      var sx = cx + (P.r - P.l) / 2 / k, sy = cy + (P.b - P.t) / 2 / k;
      return { c: unproject(sx, sy, 0), z: zz, k: k, x0: sx, y0: sy };
    }
    function underCtrl(pts, f) {
      if (!ctrlEl || !ctrlEl.offsetWidth) return false;
      var left = ctrlEl.offsetLeft - 14, bottom = ctrlEl.offsetTop + ctrlEl.offsetHeight + 14;
      return pts.some(function (p) {
        var q = project(p.lat, p.lng, 0);
        var x = (q.x - f.x0) * f.k + W / 2, y = (q.y - f.y0) * f.k + H / 2;
        return x > left && y < bottom;
      });
    }
    function fitPoints(pts, animate) {
      if (!W || !H) { wantFit = true; return; }
      userView = false;
      if (!pts.length) { if (!hasView) { center = { lat: 35.69, lng: 139.55 }; z = 10; hasView = true; } schedule(); return; }
      if (pts.length === 1) { setView(pts[0], Math.max(z, 14), animate); return; }
      var f = solveFit(pts, pad());
      if (underCtrl(pts, f)) f = solveFit(pts, pad(true));
      setView(f.c, f.z, animate);
    }
    function zoomStep(dz, aroundId) {
      userView = true;
      var want = aroundId || selectedId;
      var m = want && markers.filter(function (x) { return x.id === want; })[0];
      if (m && m.sx >= 0 && m.sx <= W && m.sy >= 0 && m.sy <= H) zoomAround(Math.round(z) + dz, m.sx, m.sy, true);
      else zoomAround(Math.round(z) + dz, null, null, true);
    }
    function ensureVisible(m, animate) {
      if (!hasView || !W) return;
      var p = screenOf(m.lat, m.lng), P = pad();
      if (p.x < P.l || p.x > W - P.r || p.y < P.t || p.y > H - P.b) setView({ lat: m.lat, lng: m.lng }, z, animate);
    }
    // after a big size change: keep the selected place in view if the person had zoomed in on it,
    // otherwise re-fit every shown marker (the selected one is among them)
    function refit() {
      var sel = selectedId && markers.filter(function (m) { return m.id === selectedId; })[0];
      if (sel && userView) { setView({ lat: sel.lat, lng: sel.lng }, Math.min(Math.max(z, 11), 15), false); return; }
      fitPoints(markers, false);
    }

    /* ---- size handling: ignore 0×0, refit after big changes ---- */
    function measure() {
      var r = root.getBoundingClientRect();
      var nw = Math.round(r.width), nh = Math.round(r.height);
      if (!nw || !nh) return;                         // hidden: keep the last real size
      W = nw; H = nh;
      if (!lastSize || wantFit) { lastSize = { w: nw, h: nh }; wantFit = false; refit(); return; }
      var big = Math.abs(nw - lastSize.w) / lastSize.w > 0.25 || Math.abs(nh - lastSize.h) / lastSize.h > 0.25 || ((nw > nh) !== (lastSize.w > lastSize.h));
      if (nw === lastSize.w && nh === lastSize.h) { schedule(); return; }
      lastSize = { w: nw, h: nh };
      if (big) refit(); else schedule();              // small change (URL bar): keep the centre
    }
    if ('ResizeObserver' in window) new ResizeObserver(measure).observe(root);
    window.addEventListener('resize', measure);
    window.addEventListener('orientationchange', function () { window.setTimeout(measure, 120); });

    /* ---- markers ---- */
    function setMarkers(list, opts) {
      opts = opts || {};
      var keep = {};
      list.forEach(function (d) { keep[d.id] = d; });
      markers = markers.filter(function (m) { if (keep[m.id]) return true; m.el.remove(); return false; });
      list.forEach(function (d) {
        var m = markers.filter(function (x) { return x.id === d.id; })[0];
        if (!m) {
          var el = h('button', { type: 'button', class: 'pin', dataset: { id: d.id } },
            h('span', { class: 'pin__dot', 'aria-hidden': 'true' }),
            h('span', { class: 'pin__label', 'aria-hidden': 'true' }),
            h('span', { class: 'pin__no', 'aria-hidden': 'true', hidden: true }));
          el.addEventListener('click', function (e) {
            if (suppressClick) { e.preventDefault(); return; }
            // a pointer click picks the nearest dot; Enter/Space (detail 0) opens the card and moves focus there
            opt.onPick(e.detail > 0 ? nearestTo(e, d.id) : d.id, e.detail > 0 ? 'map' : 'keyboard');
          });
          m = { id: d.id, el: el };
          pinsEl.appendChild(el);
          markers.push(m);
        }
        m.lat = d.lat; m.lng = d.lng;
        m.el.className = 'pin' + (d.stage === UNK ? ' pin--unk' : '') + (d.id === selectedId ? ' is-selected' : '');
        m.el.style.setProperty('--c', d.color || 'var(--unk)');
        m.el.setAttribute('aria-label', d.label);
        if (d.id === selectedId) m.el.setAttribute('aria-current', 'true'); else m.el.removeAttribute('aria-current');
        $('.pin__label', m.el).textContent = d.short;
        var no = $('.pin__no', m.el);
        no.hidden = !d.order; no.textContent = d.order || '';
      });
      // DOM order follows list order (arrow-key order)
      list.forEach(function (d) { var m = markers.filter(function (x) { return x.id === d.id; })[0]; pinsEl.appendChild(m.el); });
      syncPinTabs();
      if (opts.fit) { if (W && H) fitPoints(markers, opts.animate); else wantFit = true; }
      else schedule();
    }
    // roving tabindex: the markers are one Tab stop (the selected pin, else the last one reached, else the first);
    // arrow keys move between them in list order, Enter / Space opens the card
    var rovingId = null;
    function markerById(id) { return id ? markers.filter(function (x) { return x.id === id; })[0] : null; }
    function syncPinTabs() {
      var order = $$('.pin', pinsEl);
      var cur = markerById(rovingId) || markerById(selectedId);
      var curEl = cur ? cur.el : order[0];
      order.forEach(function (el) { el.tabIndex = el === curEl ? 0 : -1; });
    }
    function focusPin(el) {
      rovingId = el.dataset.id;
      syncPinTabs();
      el.focus({ preventScroll: true });
    }
    pinsEl.addEventListener('keydown', function (e) {
      var pin = e.target.closest && e.target.closest('.pin');
      if (!pin) return;
      var order = $$('.pin', pinsEl), i = order.indexOf(pin), n = order.length, k = e.key, j = null;
      if (k === 'ArrowRight' || k === 'ArrowDown') j = (i + 1) % n;
      else if (k === 'ArrowLeft' || k === 'ArrowUp') j = (i - 1 + n) % n;
      else if (k === 'Home') j = 0;
      else if (k === 'End') j = n - 1;
      else if (k === '+' || k === '=') { e.preventDefault(); zoomStep(1, pin.dataset.id); return; }
      else if (k === '-' || k === '_') { e.preventDefault(); zoomStep(-1, pin.dataset.id); return; }
      if (j == null) return;
      e.preventDefault();
      focusPin(order[j]);
    });
    // a pin reached by keyboard is brought into view (a mouse press never moves the map here)
    pinsEl.addEventListener('focusin', function (e) {
      var pin = e.target.closest && e.target.closest('.pin');
      if (!pin) return;
      rovingId = pin.dataset.id;
      syncPinTabs();
      var isKbd = false;
      try { isKbd = pin.matches(':focus-visible'); } catch (err) { isKbd = false; }
      var m = markerById(pin.dataset.id);
      if (isKbd && m) ensureVisible(m, true);
    });
    // focusing a pin outside the frame must never scroll the clipped map box itself
    root.addEventListener('scroll', function () { if (root.scrollTop || root.scrollLeft) { root.scrollTop = 0; root.scrollLeft = 0; } });
    // crowded overview: hit areas overlap, so a pointer click picks the dot nearest to the pointer
    function nearestTo(e, fallback) {
      var r = root.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, best = null;
      markers.forEach(function (m) {
        var dd = Math.hypot(m.sx - x, m.sy - y);
        if (dd <= 24 && (!best || dd < best.d)) best = { id: m.id, d: dd };
      });
      return best ? best.id : fallback;
    }
    function select(id, opts) {
      selectedId = id;
      if (id) rovingId = id;
      markers.forEach(function (m) {
        var on = m.id === id;
        m.el.classList.toggle('is-selected', on);
        if (on) m.el.setAttribute('aria-current', 'true'); else m.el.removeAttribute('aria-current');
      });
      syncPinTabs();
      var m = markers.filter(function (x) { return x.id === id; })[0];
      if (m && opts && opts.reveal) ensureVisible(m, true);
    }

    /* ---- pointer: drag, pinch, wheel, double click ---- */
    function local(e) { var r = root.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
    function isUi(t) { return t.closest && t.closest('.map__ctrl, .map__attr, .map__msg, .map__empty, .map__hint'); }
    root.addEventListener('pointerdown', function (e) {
      if (isUi(e.target) || (e.pointerType === 'mouse' && e.button !== 0)) return;
      pointers[e.pointerId] = local(e);
      var ids = Object.keys(pointers);
      if (ids.length === 1) drag = { id: e.pointerId, start: local(e), last: local(e), moved: false, target: e.target };
      else if (ids.length === 2) {
        var a = pointers[ids[0]], b = pointers[ids[1]];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, z: z };
        drag = null;
        try { root.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      }
    });
    root.addEventListener('pointermove', function (e) {
      if (!pointers[e.pointerId]) return;
      pointers[e.pointerId] = local(e);
      var ids = Object.keys(pointers);
      if (pinch && ids.length >= 2) {
        var a = pointers[ids[0]], b = pointers[ids[1]];
        var d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
        var nz = clampZ(pinch.z + Math.log(d / pinch.d) / Math.LN2);
        suppressClick = true; userView = true;
        zoomAround(nz, (a.x + b.x) / 2, (a.y + b.y) / 2, false);
        render();
        return;
      }
      if (!drag || drag.id !== e.pointerId) return;
      var p = local(e);
      if (!drag.moved && Math.hypot(p.x - drag.start.x, p.y - drag.start.y) > 5) {
        drag.moved = true; suppressClick = true; userView = true; root.classList.add('is-dragging');
        try { root.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      }
      if (drag.moved) {
        var c = project(center.lat, center.lng, z);
        center = unproject(c.x - (p.x - drag.last.x), c.y - (p.y - drag.last.y), z);
        drag.last = p;
        render();
      }
    });
    function endPointer(e) {
      delete pointers[e.pointerId];
      if (Object.keys(pointers).length < 2) pinch = null;
      if (drag && drag.id === e.pointerId) { drag = null; root.classList.remove('is-dragging'); }
      if (!Object.keys(pointers).length) window.setTimeout(function () { suppressClick = false; }, 0);
    }
    root.addEventListener('pointerup', endPointer);
    root.addEventListener('pointercancel', endPointer);
    // the wheel zooms only once the map is engaged (clicked or focused) or with Ctrl / ⌘ held;
    // otherwise it scrolls the page past the map and a short hint explains how to zoom
    var hintEl = h('div', { class: 'map__hint', 'aria-hidden': 'true' },
      /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '') ? '按住 ⌘ 再滾動可縮放，或先點一下地圖' : '按住 Ctrl 再滾動可縮放，或先點一下地圖');
    root.appendChild(hintEl);
    var hintTimer = 0;
    function showHint() {
      hintEl.classList.add('is-on');
      window.clearTimeout(hintTimer);
      hintTimer = window.setTimeout(function () { hintEl.classList.remove('is-on'); }, 1400);
    }
    root.addEventListener('wheel', function (e) {
      if (isUi(e.target)) return;
      var engaged = e.ctrlKey || e.metaKey || document.activeElement === root || root.contains(document.activeElement);
      if (!engaged) { showHint(); return; }
      e.preventDefault();
      hintEl.classList.remove('is-on');
      var p = local(e);
      var dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      var dz = Math.max(-0.6, Math.min(0.6, -dy * 0.0028));
      userView = true;
      zoomAround(z + dz, p.x, p.y, false);
    }, { passive: false });
    root.addEventListener('dblclick', function (e) {
      if (isUi(e.target) || e.target.closest('.pin')) return;
      var p = local(e);
      userView = true;
      zoomAround(Math.round(z) + 1, p.x, p.y, true);
    });
    root.addEventListener('keydown', function (e) {
      if (e.target !== root) return;
      var step = 90;
      var k = e.key;
      if (/^Arrow/.test(k)) userView = true;
      if (k === 'ArrowLeft') panBy(-step, 0, true);
      else if (k === 'ArrowRight') panBy(step, 0, true);
      else if (k === 'ArrowUp') panBy(0, -step, true);
      else if (k === 'ArrowDown') panBy(0, step, true);
      else if (k === '+' || k === '=') zoomStep(1);
      else if (k === '-' || k === '_') zoomStep(-1);
      else return;
      e.preventDefault();
    });
    $$('.map__btn', root).forEach(function (b) {
      b.addEventListener('click', function () {
        var act = b.dataset.act;
        if (act === 'in') zoomStep(1);
        else if (act === 'out') zoomStep(-1);
        else fitPoints(markers, true);
      });
    });

    return {
      setMarkers: setMarkers, select: select, fit: function (a) { fitPoints(markers, a); }, measure: measure
    };
  }

  /* ======================================================================
   * Zone 1 — 地圖與狀態
   * ==================================================================== */
  var zoneTabs, viewTabs, map;
  var qEl = $('#q'), wardEl = $('#ward');

  function stageCounts() {
    var c = {};
    STAGES.forEach(function (st) { c[st.key] = 0; });
    c[UNK] = 0;
    PLACES.forEach(function (p) { c[p.status] = (c[p.status] || 0) + 1; });
    return c;
  }

  function buildStageStrip() {
    var strip = $('#stageStrip'), counts = stageCounts();
    STAGES.forEach(function (st, i) {
      strip.appendChild(h('li', null,
        h('button', { type: 'button', class: 'stage' + (counts[st.key] ? '' : ' is-zero'), 'aria-pressed': 'false', dataset: { stage: st.key }, style: '--c: var(--s' + (i + 1) + ')',
          'aria-label': st.key + '（' + st.gloss + '），當季已核實 ' + counts[st.key] + ' 處' },
          h('span', { class: 'stage__bar', 'aria-hidden': 'true' }),
          h('span', { class: 'stage__idx mono', 'aria-hidden': 'true' }, String(i + 1).padStart(2, '0')),
          h('span', { class: 'stage__name', lang: 'ja' }, st.key),
          h('span', { class: 'stage__gloss' }, st.gloss),
          h('span', { class: 'stage__count' }, h('span', { class: 'stage__num' }, String(counts[st.key])), h('span', { class: 'stage__unit' }, '處已核實')))));
    });
    strip.appendChild(h('li', { class: 'is-unk' },
      h('button', { type: 'button', class: 'stage stage--unk', 'aria-pressed': 'false', dataset: { stage: UNK }, 'aria-label': '待確認，' + counts[UNK] + ' 處' },
        h('span', { class: 'stage__bar', 'aria-hidden': 'true' }),
        h('span', { class: 'stage__idx mono', 'aria-hidden': 'true' }, '—'),
        h('span', { class: 'stage__name' }, UNK),
        h('span', { class: 'stage__gloss' }, '沒有可核實的當季官方資料'),
        h('span', { class: 'stage__count' }, h('span', { class: 'stage__num' }, String(counts[UNK])), h('span', { class: 'stage__unit' }, '處')))));
    strip.addEventListener('click', function (e) {
      var b = e.target.closest('.stage');
      if (!b) return;
      setStage(state.stage === b.dataset.stage ? null : b.dataset.stage);
    });
    $('#statPlaces').textContent = String(PLACES.length);
    $('#statVerified').textContent = String(PLACES.length - counts[UNK]);
  }

  function histLine(r, withPlace) {
    var p = byId[r.place];
    return h('li', null,
      h('span', { class: 'hist__date' }, r.date, h('small', null, r.stage ? '原文對應：' + r.stage : '未標明階段')),
      h('div', { class: 'hist__body' },
        withPlace ? h('span', { class: 'hist__place' }, placeLabel(p), '　') : null,
        r.quote ? h('span', { class: 'hist__quote', lang: 'ja' }, '「' + r.quote + '」') : null,
        r.text,
        ' ', extLink(r.url, '官方頁面', 'hist__src')));
  }

  function renderStagePanel() {
    var panel = $('#stagePanel'), st = state.stage, counts = stageCounts();
    panel.textContent = '';
    var jma = META.jma;
    var jmaLine = '氣象廳東京站 2026 年的いちょう黄葉日與落葉日也還沒有觀測（官方頁面顯示 ///），而且觀測站標本木的日期不能代表各園區。';
    if (!st) {
      panel.appendChild(h('p', { class: 'panel__title' }, '六個階段的當季已核實地點都是 0 處', h('span', { class: 'mono' }, PLACES.length + ' 處顯示「待確認」')));
      panel.appendChild(h('div', { class: 'panel__body' },
        h('p', { class: 'reason' }, h('strong', null, '原因　'), META.noDataReason + '。' + jmaLine),
        h('p', null, '本站只有在官方來源同時明確寫出銀杏、地點與日期時才標示當季階段；不從平年值或往年經驗推測。點選任一階段，可查看該階段的當季地點與過去季紀錄。')));
      return;
    }
    if (st === UNK) {
      var cur = D.current2026;
      panel.appendChild(h('p', { class: 'panel__title' }, '待確認', h('span', { class: 'mono' }, counts[UNK] + ' 處 · 地圖與清單已篩選')));
      panel.appendChild(h('div', { class: 'panel__body' },
        h('p', { class: 'reason' }, h('strong', null, '原因　'), META.noDataReason + '。未知狀態一律顯示「待確認」，不推測。'),
        h('div', { class: 'panel__hist' },
          h('h4', null, '2026 年的官方動態（沒有標明階段，所以不列入任何階段）'),
          h('ul', { class: 'hist' }, cur.map(function (r) { return histLine(r, true); }))),
        h('div', { class: 'panel__actions' }, h('button', { type: 'button', class: 'textbtn', onclick: function () { setStage(null); } }, '清除階段篩選'))));
      return;
    }
    var idx = STAGES.map(function (x) { return x.key; }).indexOf(st);
    var past = D.history.filter(function (r) { return r.stage === st; });
    panel.appendChild(h('p', { class: 'panel__title' }, h('span', null, h('span', { lang: 'ja' }, st), '（' + STAGES[idx].gloss + '）'), h('span', { class: 'mono' }, '當季已核實 ' + counts[st] + ' 處')));
    panel.appendChild(h('div', { class: 'panel__body' },
      h('p', { class: 'reason' }, h('strong', null, '0 處的原因　'), META.noDataReason + '。' + jmaLine),
      h('div', { class: 'panel__hist' },
        h('h4', null, '過去季的官方紀錄（附日期，只供參考，不代表 2026 現況）'),
        past.length
          ? h('ul', { class: 'hist' }, past.map(function (r) { return histLine(r, true); }))
          : h('p', { class: 'obs__mute' }, '快照中沒有原文明確寫到「' + st + '」的過去季官方紀錄。')),
      h('div', { class: 'panel__actions' }, h('button', { type: 'button', class: 'textbtn', onclick: function () { setStage(null); } }, '清除階段篩選'))));
  }

  function setStage(st, animate) {
    state.stage = st;
    $$('#stageStrip .stage').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.stage === st ? 'true' : 'false'); });
    renderStagePanel();
    refresh(true, animate);
  }

  function buildWardSelect() {
    var counts = {};
    PLACES.forEach(function (p) { p.wards.forEach(function (w) { counts[w] = (counts[w] || 0) + 1; }); });
    wardEl.appendChild(h('option', { value: '' }, '全部行政區（' + PLACES.length + '）'));
    D.wardGroups.forEach(function (g) {
      var og = h('optgroup', { label: g.label });
      g.wards.forEach(function (w) { og.appendChild(h('option', { value: w }, w + '（' + (counts[w] || 0) + '）')); });
      wardEl.appendChild(og);
    });
  }

  function visiblePlaces() {
    var terms = state.q.split(/\s+/).map(norm).filter(Boolean);
    return PLACES.filter(function (p) {
      if (state.ward && p.wards.indexOf(state.ward) < 0) return false;
      if (state.stage && p.status !== state.stage) return false;
      for (var i = 0; i < terms.length; i++) if (p._hay.indexOf(terms[i]) < 0) return false;
      return true;
    });
  }

  function emptyBox(target, list) {
    target.textContent = '';
    var reasons = [];
    if (state.stage && state.stage !== UNK) reasons.push(h('p', null, '「' + state.stage + '」當季已核實 0 處。原因：' + META.noDataReason + '。'));
    if (state.q) reasons.push(h('p', null, '找不到符合「' + state.q + '」的地點。可以試試日文或中文名稱、行政區或編號。'));
    if (state.ward && !state.stage && !state.q) reasons.push(h('p', null, state.ward + '沒有資料中的銀杏地點。'));
    target.appendChild(h('strong', null, '目前條件下沒有地點'));
    reasons.forEach(function (r) { target.appendChild(r); });
    target.appendChild(h('button', { type: 'button', class: 'textbtn', onclick: clearFilters }, '清除搜尋與篩選'));
    return list;
  }

  function refresh(fit, animate) {
    var list = visiblePlaces();
    var active = !!(state.q || state.ward || state.stage);
    var bits = ['顯示 ' + list.length + '／' + PLACES.length + ' 處'];
    if (state.stage) bits.push('階段：' + state.stage);
    if (state.ward) bits.push('行政區：' + state.ward);
    if (state.q) bits.push('搜尋：「' + state.q + '」');
    $('#resultText').textContent = bits.join(' · ');
    $('#clearFilters').hidden = !active;
    renderList(list);
    var mapEmpty = $('#mapEmpty');
    if (!list.length) { mapEmpty.hidden = false; emptyBox(mapEmpty); } else mapEmpty.hidden = true;
    map.setMarkers(list.map(markerData), { fit: fit && list.length > 0, animate: animate !== false });
  }
  function markerData(p) {
    var order = state.walk.indexOf(p.id) + 1;
    return {
      id: p.id, lat: p.lat, lng: p.lng, stage: p.status, color: stageColor[p.status] || 'var(--unk)', short: p.zh,
      order: order || 0,
      label: p.zh + '，' + wardText(p) + '，狀態：' + p.status + (order ? '，散步清單第 ' + order + ' 站' : '')
    };
  }
  function clearFilters() {
    state.q = ''; state.ward = ''; qEl.value = ''; wardEl.value = '';
    if (state.stage) { setStage(null); return; }
    refresh(true);
  }

  function walkToggle(p) {
    var on = state.walk.indexOf(p.id) >= 0;
    var b = h('button', { type: 'button', class: 'walkbtn', 'aria-pressed': on ? 'true' : 'false', dataset: { walk: p.id },
      'aria-label': (on ? '從散步清單移除「' : '加入散步清單：「') + p.zh + '」' },
      icon(on ? IC.check : IC.plus), h('span', null, on ? '已在清單' : '加入散步'));
    b.addEventListener('click', function () { toggleWalk(p.id); });
    return b;
  }

  function renderList(list) {
    var ul = $('#placeList'), empty = $('#listEmpty');
    ul.textContent = '';
    if (!list.length) { empty.hidden = false; emptyBox(empty); return; }
    empty.hidden = true;
    list.forEach(function (p) {
      var last = p._hist[0], cur = p._cur;
      var dated = [];
      if (cur.length) dated.push('2026 官方動態：' + cur[cur.length - 1].date + '（未標明階段，非階段觀測）');
      if (last) dated.push('最近一筆官方日期紀錄：' + last.date + '（歷史，非當季）');
      ul.appendChild(h('li', { class: 'place' + (p.id === state.selected ? ' is-selected' : ''), dataset: { id: p.id } },
        h('button', { type: 'button', class: 'place__main', 'aria-label': p.zh + '，' + wardText(p) + '，狀態：' + p.status + '，打開觀測卡' },
          h('span', { class: 'place__id mono' }, ids(p.id.replace('-hongo', '・本鄉').replace('-komaba', '・駒場') + ' · 等級 ' + p.grade)),
          h('span', { class: 'place__name' }, p.zh, p.ja !== p.zh ? h('span', { class: 'place__ja', lang: 'ja' }, p.ja) : null),
          h('span', { class: 'place__meta' }, wardText(p)),
          h('span', { class: 'place__hist' }, dated.length ? dated.join('；') : '沒有附日期的官方銀杏觀測紀錄')),
        h('span', { class: 'chip chip--unk' }, p.status),
        walkToggle(p)));
    });
  }
  $('#placeList').addEventListener('click', function (e) {
    var b = e.target.closest('.place__main');
    if (b) openDetail(b.parentNode.dataset.id, e.detail === 0 ? 'keyboard' : 'list');
  });

  /* ---------------- observation card ---------------- */
  var lastTrigger = null;
  function blankCard() {
    var el = $('#detail');
    el.textContent = '';
    el.scrollTop = 0;
    var leaf = s('svg', { viewBox: '0 0 72 72', 'aria-hidden': 'true', focusable: 'false' },
      s('path', { d: 'M36 66V38', fill: 'none', stroke: 'var(--ink)', 'stroke-width': '2', 'stroke-linecap': 'round' }),
      s('path', { d: 'M36 38C21 38 9 27.5 8 12.5c9.8-3.6 18.9-3 25.5 1.4L36 21l2.5-7.1C45.1 9.5 54.2 8.9 64 12.5 63 27.5 51 38 36 38z', fill: 'var(--amber-wash)', stroke: 'var(--ink)', 'stroke-width': '2', 'stroke-linejoin': 'round', 'stroke-dasharray': '4 3' }));
    el.appendChild(h('div', { class: 'obs__blank' }, leaf,
      h('h3', null, '觀測卡'),
      h('p', null, '點選地圖標記或清單中的地點，這裡會顯示：'),
      h('ul', null,
        h('li', null, '當季狀態與觀測日期（目前都是「待確認」）'),
        h('li', null, '過去季附日期的官方紀錄'),
        h('li', null, '官方說明的銀杏位置與園區代表點'),
        h('li', null, '官方來源連結與 Google 地圖步行導航'))));
    syncCardFade();
  }
  // desktop card is a scroll box: a fade at its bottom edge shows there is more below, until the end is reached
  function syncCardFade() {
    var el = $('#detail');
    var more = !isSingleColumn() && el.scrollHeight - el.scrollTop - el.clientHeight > 4;
    el.classList.toggle('has-more', more);
  }
  function kv(pairs) {
    var dl = h('dl', { class: 'kv' });
    pairs.forEach(function (pr) { if (!pr) return; dl.appendChild(h('dt', null, pr[0])); dl.appendChild(h('dd', null, pr[1])); });
    return dl;
  }
  function linkList(links, cls) {
    return h('ul', { class: 'links' + (cls ? ' ' + cls : '') }, links.map(function (l) {
      // a dead source stays visible for traceability, but as plain text rather than a live link
      if (l.dead) {
        return h('li', null, h('p', { class: 'links__dead' },
          h('span', { class: 'links__role' }, l.role + '（' + (l.deadNote || '已失效') + '）'),
          h('span', { class: 'links__url' }, shortUrl(l.url))));
      }
      return h('li', null, h('a', { href: l.url, target: '_blank', rel: 'noopener noreferrer' },
        h('span', { class: 'links__role' }, l.role + (l.date ? '（' + l.date + '）' : '') + (l.thirdNote ? '（' + l.thirdNote + '）' : '')),
        h('span', { class: 'links__url' }, shortUrl(l.url)),
        icon(IC.ext, 'links__go')));
    }));
  }
  function bullets(arr, lang) { return h('ul', null, arr.map(function (t) { return h('li', { lang: lang || null }, t); })); }
  // official fact values: Japanese text (lang="ja") plus an optional Chinese note; a missing value shows the Chinese 待確認 wording
  var FACT_UNK = '待確認（官方頁面未載明）';
  // keep phone numbers such as 042-673-6661 or 03(3812)2111 on one line
  function telNowrap(str) {
    var out = [], re = /\d{2,4}-\d{2,4}-\d{3,4}|\d{2}\(\d{4}\)\d{4}/g, last = 0, m;
    while ((m = re.exec(str))) {
      if (m.index > last) out.push(str.slice(last, m.index));
      out.push(h('span', { class: 'nowrap' }, m[0]));
      last = re.lastIndex;
    }
    if (last < str.length) out.push(str.slice(last));
    return out;
  }
  function factVal(v, cls) {
    var tel = cls === 'mono';
    if (v && typeof v === 'object') return h('span', null,
      v.text ? h('span', { lang: 'ja', class: cls || null }, tel ? telNowrap(v.text) : v.text) : FACT_UNK,
      v.note ? h('span', { class: 'fact__note' }, v.note) : null);
    return v ? h('span', { lang: 'ja', class: cls || null }, tel ? telNowrap(v) : v) : h('span', null, FACT_UNK);
  }
  function eventList(list) {
    return h('ul', null, list.map(function (e) {
      return h('li', null, h('span', { class: 'mono' }, e.date), '　', h('span', { lang: 'ja' }, e.text), e.note ? h('span', { class: 'fact__note' }, e.note) : null);
    }));
  }
  // card title: break only between words, and keep 「銀杏並木」 or a trailing 「（八王子）」 whole, so no single character is left on its own line
  function titleNodes(str) {
    var out = [];
    str.split(' ').forEach(function (w, i) {
      if (i) out.push(' ');
      if (w.length <= 6) { out.push(h('span', { class: 'nowrap' }, w)); return; }
      var re = /銀杏並木|いちょう並木|イチョウ並木|（[^）]*）/g, last = 0, m;
      while ((m = re.exec(w))) {
        if (m.index > last) out.push(w.slice(last, m.index));
        out.push(h('span', { class: 'nowrap' }, m[0]));
        last = re.lastIndex;
      }
      if (last < w.length) out.push(w.slice(last));
    });
    return out;
  }
  // 觀測日期: 2026 official items exist only as unstaged photos / notices, so the status stays 待確認
  function obsDate(cur) {
    if (!cur.length) return '2026 年：沒有官方發布的銀杏觀測';
    var items = [];
    cur.forEach(function (r, i) { if (i) items.push('、'); items.push(h('span', { class: 'nowrap' }, r.date + ' ' + (r.kind || '官方動態'))); });
    return h('span', null, items,
      h('span', { class: 'fact__note' }, '（' + (cur.length > 1 ? '都' : '') + '未標明階段，所以仍是「' + UNK + '」）'));
  }

  function renderDetail(p) {
    var el = $('#detail');
    el.textContent = '';
    el.scrollTop = 0;                                   // a new place always opens at its title
    var inWalk = state.walk.indexOf(p.id) >= 0;
    var f = p.facts;
    var cur = p._cur;
    var art = h('article', { 'aria-labelledby': 'detailTitle' });
    art.appendChild(h('header', { class: 'obs__head' },
      // the grade gloss is one unit: when the line is too narrow it moves down whole instead of leaving 「測）」 alone
      h('p', { class: 'obs__id mono' }, ids(p.row + (p.id !== p.row ? ' · ' + (p.id.indexOf('hongo') > 0 ? '本鄉' : '駒場') : '') + ' · 等級 ' + p.grade),
        h('span', { class: 'obs__gloss' }, '（' + D.grades[p.grade] + '）')),
      h('h3', { class: 'obs__title', id: 'detailTitle', tabindex: '-1' }, titleNodes(p.zh)),
      p.ja !== p.zh ? h('p', { class: 'obs__ja', lang: 'ja' }, p.ja) : null,
      h('p', { class: 'obs__ward' }, wardText(p) + (p.wardNote ? '　' : ''), p.wardNote ? h('span', { class: 'obs__mute' }, p.wardNote) : null),
      h('button', { type: 'button', class: 'obs__close', 'aria-label': '關閉觀測卡', onclick: closeDetail }, icon(IC.x))));
    var wb = h('button', { type: 'button', class: 'btn' + (inWalk ? ' btn--on' : ''), 'aria-pressed': inWalk ? 'true' : 'false', dataset: { walk: p.id } },
      icon(inWalk ? IC.check : IC.plus), inWalk ? '已在散步清單（再按移除）' : '加入散步清單');
    wb.addEventListener('click', function () { toggleWalk(p.id); });
    art.appendChild(h('div', { class: 'obs__actions' }, wb,
      h('a', { class: 'btn', href: gDest(p), target: '_blank', rel: 'noopener noreferrer' }, icon(IC.ext), 'Google 地圖步行導航')));

    // status
    art.appendChild(h('section', { class: 'obs__sec', 'aria-label': '當季狀態' },
      h('h4', null, '當季狀態（2026 秋）'),
      kv([
        ['階段', h('span', { class: 'status-big' }, h('span', { class: 'chip chip--unk' }, p.status))],
        ['觀測日期', obsDate(cur)],
        ['最近查核', h('span', { class: 'mono' }, p.checked)]
      ]),
      h('p', { class: 'reason' }, META.noDataReason + '。')));

    if (cur.length) {
      art.appendChild(h('section', { class: 'obs__sec' },
        h('h4', null, '2026 年官方動態（未標明階段）'),
        h('ul', { class: 'hist' }, cur.map(function (r) { return histLine(r, false); })),
        h('p', { class: 'obs__mute' }, '照片與公告沒有寫出階段，本站不從照片判斷，所以仍是「待確認」。')));
    }
    art.appendChild(h('section', { class: 'obs__sec' },
      h('h4', null, '過去季的官方紀錄（附日期，不代表 2026 現況）'),
      p._hist.length ? h('ul', { class: 'hist' }, p._hist.map(function (r) { return histLine(r, false); }))
        : h('p', { class: 'obs__mute' }, '快照中沒有這個地點附日期的官方銀杏觀測紀錄。')));

    art.appendChild(h('section', { class: 'obs__sec' },
      h('h4', null, '銀杏在哪裡（官方說法）'),
      h('p', null, p.ginkgo),
      p.proof ? h('p', { class: 'quote' }, '銀杏證據：', h('span', { lang: 'ja' }, '「' + p.proof.quote + '」'), '　', extLink(p.proof.url, p.proof.label)) : null,
      p.season ? h('p', { class: 'obs__mute' }, '官方例年說法（不是 2026 現況，也不用來推算階段）：', p.season) : null,
      h('p', { class: 'obs__mute' }, '資料表注意事項：', p.caveat)));

    art.appendChild(h('section', { class: 'obs__sec' },
      h('h4', null, '園區代表點'),
      h('p', { class: 'coord' }, p.lat.toFixed(4) + ', ' + p.lng.toFixed(4)),
      h('p', null, '這是園區代表點（概略），不是銀杏樹的精確位置。'),
      h('p', { class: 'obs__mute' }, '取點：', p.pointLabel, '。', p.pointBasis, '。'),
      h('p', { class: 'obs__mute' }, '座標來源：' + META.coordSource + '。')));

    // dated official items: activities (stamp rally, light-up, festival, special opening) vs notices (e.g. an access restriction)
    var evts = f.events.filter(function (e) { return e.kind !== 'notice'; });
    var notices = f.events.filter(function (e) { return e.kind === 'notice'; });
    var acc = f.access || [];
    var accNode = acc.length <= 3 ? bullets(acc, 'ja')
      : h('div', null, bullets(acc.slice(0, 3), 'ja'), h('details', { class: 'more' }, h('summary', null, '其他交通方式（' + (acc.length - 3) + '）'), bullets(acc.slice(3), 'ja')));
    art.appendChild(h('section', { class: 'obs__sec' },
      h('h4', null, '官方資訊摘錄', h('span', { class: 'obs__h4sub' }, '（依官方頁面整理，多為日文；', h('span', { class: 'nowrap' }, f.verified), ' 查核）')),
      kv([
        ['所在地', factVal(f.address)],
        acc.length ? ['交通', accNode] : ['交通', FACT_UNK],
        ['開放時間', factVal(f.hours)],
        ['休園日', factVal(f.closed)],
        ['費用', factVal(f.fee)],
        f.phone ? ['電話', factVal(f.phone, 'mono')] : null,
        evts.length ? ['官方活動', eventList(evts)] : null,
        notices.length ? ['官方公告', eventList(notices)] : null
      ]),
      f.unverified.length ? h('details', { class: 'more' }, h('summary', null, '未能核實的欄位（' + f.unverified.length + '）'), h('ul', { class: 'unver' }, f.unverified.map(function (u) { return h('li', null, u); }))) : null));

    // a third-party URL the sheet lists for this row stays traceable, but outside the 官方來源 list and labelled as such
    var offLinks = p.allLinks.filter(function (l) { return !l.third; });
    var thirdLinks = p.allLinks.filter(function (l) { return l.third; });
    art.appendChild(h('section', { class: 'obs__sec' },
      h('h4', null, '官方來源'),
      linkList(offLinks),
      thirdLinks.length ? h('div', { class: 'links-third' },
        h('p', { class: 'links-third__head' }, '第三方參考', h('span', { class: 'links-third__sub' }, '不是官方來源，本站沒有採用它的內容')),
        linkList(thirdLinks, 'links--third')) : null,
      h('p', { class: 'obs__mute' }, ids('更多來源說明請見「來源」區的 ' + p.row + '。'))));
    el.appendChild(art);
    syncCardFade();
  }

  function isSingleColumn() { return window.matchMedia('(max-width: 960px)').matches; }
  function openDetail(id, from) {
    var p = byId[id];
    if (!p) return;
    lastTrigger = document.activeElement;
    state.selected = id;
    renderDetail(p);
    $$('#placeList .place').forEach(function (li) { li.classList.toggle('is-selected', li.dataset.id === id); });
    map.select(id, { reveal: state.view === 'map' });
    if (isSingleColumn() || from === 'src' || from === 'walk' || from === 'keyboard') {
      var det = $('#detail');
      det.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      $('#detailTitle').focus({ preventScroll: true });
    }
    announce('已打開「' + p.zh + '」的觀測卡');
  }
  function closeDetail() {
    state.selected = null;
    map.select(null);
    $$('#placeList .place').forEach(function (li) { li.classList.remove('is-selected'); });
    blankCard();
    var back = lastTrigger;
    if (back && document.body.contains(back) && back.offsetParent) back.focus();
    else if (state.view === 'map') $('#map').focus();
  }

  /* ======================================================================
   * Zone 2 — 散步路線
   * ==================================================================== */
  var undoState = null;
  // any manual edit after a clear / replace makes the old snapshot stale: drop the 復原 offer
  function dismissUndo() {
    if (!undoState && $('#undoWrap').hidden) return;
    undoState = null;
    $('#undoWrap').hidden = true;
    syncWalkTools();
  }
  function toggleWalk(id) {
    dismissUndo();
    hideAddHint();
    var i = state.walk.indexOf(id), p = byId[id];
    if (i >= 0) { state.walk.splice(i, 1); announce('已從散步清單移除「' + p.zh + '」'); }
    else { state.walk.push(id); announce('已把「' + p.zh + '」加入散步清單，第 ' + state.walk.length + ' 站'); }
    walkChanged();
  }
  function walkChanged() {
    saveWalk();
    $('#walkTabCount').textContent = state.walk.length ? String(state.walk.length) : '';
    $('#tab-walk').setAttribute('aria-label', '散步路線' + (state.walk.length ? '（清單 ' + state.walk.length + ' 處）' : ''));
    renderWalk();
    // sync toggles in the list and the card without rebuilding them
    $$('[data-walk]').forEach(function (b) {
      var id = b.dataset.walk, on = state.walk.indexOf(id) >= 0, p = byId[id];
      if (b.classList.contains('walkbtn')) {
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
        b.setAttribute('aria-label', (on ? '從散步清單移除「' : '加入散步清單：「') + p.zh + '」');
        b.textContent = '';
        append(b, [icon(on ? IC.check : IC.plus), h('span', null, on ? '已在清單' : '加入散步')]);
      } else {
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
        b.classList.toggle('btn--on', on);
        b.textContent = '';
        append(b, [icon(on ? IC.check : IC.plus), on ? '已在散步清單（再按移除）' : '加入散步清單']);
      }
    });
    map.setMarkers(visiblePlaces().map(markerData), { fit: false });
  }

  function wardSuffix(p) {
    var w = p.wards[0], stem = w.replace(/[區市]$/, '');
    return stem.length >= 2 && p.zh.indexOf(stem) >= 0 ? '' : '（' + w + '）';   // the name already carries the area: no doubled brackets
  }

  function placeOptions(sel, opts) {
    sel.textContent = '';
    sel.appendChild(h('option', { value: '' }, opts.placeholder));
    D.wardGroups.forEach(function (g) {
      var og = h('optgroup', { label: g.label });
      PLACES.filter(function (p) { return g.wards.indexOf(p.wards[0]) >= 0; })
        .sort(function (a, b) { return WARD_ORDER.indexOf(a.wards[0]) - WARD_ORDER.indexOf(b.wards[0]); })
        .forEach(function (p) {
          var inList = opts.markInList && state.walk.indexOf(p.id) >= 0;
          og.appendChild(h('option', { value: p.id, disabled: inList || null }, p.zh + wardSuffix(p) + (inList ? '　已在清單' : '')));
        });
      sel.appendChild(og);
    });
  }

  function routeSummary(ps, opts) {
    var legs = legsOf(ps);
    var dist = legs.reduce(function (a, l) { return a + l.m; }, 0);
    var mins = legs.reduce(function (a, l) { return a + l.min; }, 0);
    var frag = [];
    frag.push(h('dl', { class: 'total' },
      h('div', null, h('dt', null, '地點'), h('dd', null, String(ps.length), h('small', null, '處'))),
      h('div', null, h('dt', null, '直線距離合計'), h('dd', null, nwDist(dist))),
      h('div', null, h('dt', null, '步行估時合計'), h('dd', null, nwMin(mins)))));
    frag.push(h('p', { class: 'routeout__note' }, '估時依直線距離與每分鐘 80 公尺計算，不含園內步道與停留' + (opts && opts.target ? '；目標「' + opts.target + '」' : '') + '。'));
    var url = gRoute(ps);
    frag.push(h('div', { class: 'routeout__actions' },
      url ? h('a', { class: 'btn btn--primary', href: url, target: '_blank', rel: 'noopener noreferrer' }, icon(IC.ext), '用 Google 地圖開啟全程步行導航')
        : h('p', { class: 'routeout__note' }, 'Google 地圖網址最多帶 9 個中途點，這條路線太長；請使用各段的導航連結。')));
    if (url && ps.length > 5) frag.push(h('p', { class: 'routeout__note' }, '部分手機瀏覽器只會帶入前幾個中途點；若導航缺站，請改用各段連結。'));
    return { nodes: frag, legs: legs, mins: mins, dist: dist };
  }

  function renderWalk() {
    var ol = $('#mineList'), empty = $('#mineEmpty'), out = $('#mineOut');
    var ps = state.walk.map(function (id) { return byId[id]; });
    ol.textContent = ''; out.textContent = '';
    $('#mineCount').textContent = ps.length ? ps.length + ' 處' : '尚未加入地點';
    placeOptions($('#addSel'), { placeholder: '選擇要加入的地點…', markInList: true });
    $('#clearWalk').hidden = !ps.length;
    syncWalkTools();
    if (!ps.length) {
      empty.hidden = false;
      empty.textContent = '';
      append(empty, [h('strong', null, '散步清單是空的'),
        h('p', null, '用上方選單加入地點，或在「地圖與狀態」的清單、觀測卡按「加入散步」。也可以用右側的自動規劃產生路線後存成清單。')]);
      return;
    }
    empty.hidden = true;
    var legs = legsOf(ps);
    ps.forEach(function (p, i) {
      var li = h('li', { class: 'stop' },
        h('span', { class: 'stop__no', 'aria-hidden': 'true' }, String(i + 1)),
        h('div', { class: 'stop__name' },
          h('button', { type: 'button', 'aria-label': '第 ' + (i + 1) + ' 站：' + p.zh + '，打開觀測卡', onclick: function () { goPlace(p.id, 'walk'); } }, titleNodes(p.zh)),
          h('span', { class: 'stop__ward' }, wardText(p))),
        h('div', { class: 'stop__ctl' },
          h('button', { type: 'button', class: 'iconbtn', 'aria-label': '將「' + p.zh + '」上移', disabled: i === 0 || null, onclick: function () { moveStop(i, -1); } }, icon(IC.up)),
          h('button', { type: 'button', class: 'iconbtn', 'aria-label': '將「' + p.zh + '」下移', disabled: i === ps.length - 1 || null, onclick: function () { moveStop(i, 1); } }, icon(IC.down)),
          h('button', { type: 'button', class: 'iconbtn', 'aria-label': '從清單移除「' + p.zh + '」', onclick: function () { removeStop(i); } }, icon(IC.x))));
      ol.appendChild(li);
      if (i < legs.length) {
        var l = legs[i];
        ol.appendChild(h('li', { class: 'leg', 'aria-label': '第 ' + (i + 1) + ' 到第 ' + (i + 2) + ' 站：直線 ' + fmtDist(l.m) + '，步行約 ' + fmtMin(l.min) },
          h('span', { class: 'leg__line', 'aria-hidden': 'true' }),
          h('div', { class: 'leg__body' },
            h('span', { class: 'leg__est' }, '直線 ', h('b', null, nwDist(l.m)), ' · 約 ', h('b', null, nwMin(l.min))),
            extLink(gLeg(l.a, l.b), '此段步行導航'))));
      }
    });
    if (ps.length === 1) {
      append(out, h('p', { class: 'routeout__note' }, '再加入一個地點，就會計算每段估時與總時長。'));
      append(out, h('div', { class: 'routeout__actions' }, h('a', { class: 'btn', href: gDest(ps[0]), target: '_blank', rel: 'noopener noreferrer' }, icon(IC.ext), '用 Google 地圖導航到這裡')));
      return;
    }
    append(out, routeSummary(ps).nodes);
  }
  function moveStop(i, dir) {
    var j = i + dir;
    if (j < 0 || j >= state.walk.length) return;
    dismissUndo();
    var t = state.walk[i]; state.walk[i] = state.walk[j]; state.walk[j] = t;
    walkChanged();
    var p = byId[state.walk[j]];
    announce('「' + p.zh + '」移到第 ' + (j + 1) + ' 站');
    var btns = $$('#mineList .stop')[j].querySelectorAll('.iconbtn');
    var target = dir < 0 ? btns[0] : btns[1];
    if (target.disabled) target = dir < 0 ? btns[1] : btns[0];
    target.focus();
  }
  function removeStop(i) {
    var id = state.walk[i], p = byId[id];
    dismissUndo();
    state.walk.splice(i, 1);
    walkChanged();
    announce('已從散步清單移除「' + p.zh + '」');
    var stops = $$('#mineList .stop');
    var next = stops[Math.min(i, stops.length - 1)];
    if (next) next.querySelector('.stop__name button').focus(); else $('#addSel').focus();
  }
  function showUndo(prev, text) {
    undoState = prev;
    $('#undoText').textContent = text;
    $('#undoWrap').hidden = false;
    syncWalkTools();
  }
  // the clear / undo row sits right under the list; hide the row itself when it has nothing to show
  function syncWalkTools() {
    $('#walkTools').hidden = $('#clearWalk').hidden && $('#undoWrap').hidden;
  }
  $('#undoBtn').addEventListener('click', function () {
    if (!undoState) return;
    state.walk = undoState.slice(); undoState = null;
    $('#undoWrap').hidden = true;
    walkChanged();
    syncWalkTools();
    announce('已復原散步清單');
    $('#addSel').focus();
  });
  // visible prompt for 「加入清單」 with nothing chosen (the auto planner shows the same kind of prompt for a missing start)
  function showAddHint() {
    var sel = $('#addSel');
    $('#addHint').hidden = false;
    sel.setAttribute('aria-invalid', 'true');
    sel.setAttribute('aria-describedby', 'addHint');
  }
  function hideAddHint() {
    var sel = $('#addSel');
    if ($('#addHint').hidden) return;
    $('#addHint').hidden = true;
    sel.removeAttribute('aria-invalid');
    sel.removeAttribute('aria-describedby');
  }
  $('#addSel').addEventListener('change', hideAddHint);
  $('#addBtn').addEventListener('click', function () {
    var id = $('#addSel').value;
    if (!id) { showAddHint(); announce('請先在選單中選擇地點'); $('#addSel').focus(); return; }
    if (state.walk.indexOf(id) < 0) toggleWalk(id);
    $('#addSel').value = '';
    $('#addSel').focus();
  });
  $('#clearWalk').addEventListener('click', function () {
    if (!state.walk.length) return;
    var prev = state.walk.slice();
    hideAddHint();
    state.walk = [];
    walkChanged();
    showUndo(prev, '已清空 ' + prev.length + ' 處。');
    announce('已清空散步清單，可按復原');
    $('#undoBtn').focus();
  });

  /* auto planner: greedy nearest neighbour from the chosen start */
  function autoPlan(startId, target) {
    var route = [byId[startId]], total = 0, used = {}, stop = null;
    used[startId] = 1;
    for (;;) {
      var last = route[route.length - 1], best = null;
      PLACES.forEach(function (p) {
        if (used[p.id]) return;
        var d = haversine(last, p);
        if (!best || d < best.d) best = { p: p, d: d };
      });
      if (!best) { stop = { kind: 'all' }; break; }
      var m = walkMin(best.d);
      if (total + m > target) { stop = { kind: 'over', next: best.p, m: m, d: best.d }; break; }
      route.push(best.p); used[best.p.id] = 1; total += m;
    }
    return { route: route, total: total, stop: stop, target: target };
  }
  function renderAuto(res) {
    var out = $('#autoOut');
    out.textContent = '';
    var label = res.target === 30 ? '約 30 分鐘' : '約 1 小時';
    var start = res.route[0];
    if (res.route.length < 2) {
      // suggest 「約 1 小時」 only when that setting really gives a route from this start
      var hint = ['可以換一個起點。'], hour = h('span', { class: 'nowrap' }, '「約 1 小時」');
      if (res.target === 30) {
        hint = autoPlan(start.id, 60).route.length >= 2 ? ['可以換一個起點，或改選', hour, '。']
          : ['這個地點離其他地點都超過 1 小時步行（直線估算），改選', hour, '也一樣找不到；可以換一個起點。'];
      }
      append(out, h('div', { class: 'empty' },
        h('strong', null, '沒有符合「' + label + '」的路線'),
        h('p', null, '從「' + start.zh + '」出發，在' + label + '內（直線估算）找不到其他資料中的地點。最近的是「' + res.stop.next.zh + '」，直線 ', nwDist(res.stop.d), '、步行約 ', nwMin(res.stop.m), '，超過目標時間。'),
        h('p', null, '本站不會為了湊時間加入無來源的地點或路段。', hint)));
      return;
    }
    var sum = routeSummary(res.route, { target: label });
    var legs = sum.legs;
    append(out, h('p', { class: 'routeout__lead' }, '從「' + start.zh + '」出發的' + label + '路線'));
    append(out, h('ol', { class: 'autolist', 'aria-label': '自動規劃的順序' }, res.route.map(function (p, i) {
      var l = legs[i - 1];
      return h('li', null,
        h('span', { class: 'stop__no', 'aria-hidden': 'true' }, String(i + 1)),
        h('div', null,
          h('span', { class: 'stop__name' }, h('button', { type: 'button', onclick: function () { goPlace(p.id, 'walk'); }, 'aria-label': '第 ' + (i + 1) + ' 站：' + p.zh + '，打開觀測卡' }, titleNodes(p.zh))),
          h('span', { class: 'stop__ward' }, wardText(p)),
          l ? h('span', { class: 'autolist__leg' }, '前一站 → 這裡：直線 ', nwDist(l.m), ' · 約 ', nwMin(l.min), '　', extLink(gLeg(l.a, l.b), '此段導航')) : h('span', { class: 'autolist__leg' }, '起點')));
    })));
    var why = res.stop.kind === 'all' ? '資料中的地點已全部加入。'
      : ['停止原因：下一個最近的地點「' + res.stop.next.zh + '」還要約 ', nwMin(res.stop.m), '，總計會超過' + label + '。'];
    append(out, h('p', { class: 'routeout__note routeout__note--mute' }, why));
    append(out, sum.nodes);
    var save = h('button', { type: 'button', class: 'btn' }, icon(IC.check), '以此路線取代我的散步清單');
    save.addEventListener('click', function () {
      var prev = state.walk.slice();
      dismissUndo();                                   // an older 清空 snapshot must not survive the replace
      hideAddHint();
      state.walk = res.route.map(function (p) { return p.id; });
      walkChanged();
      if (prev.length) showUndo(prev, '已用自動規劃的路線取代原本 ' + prev.length + ' 處。');
      announce('已存成散步清單，共 ' + state.walk.length + ' 處');
      var first = $('#mineList .stop__name button');
      if (first) first.focus();
    });
    append(out, h('div', { class: 'routeout__actions' }, save));
  }
  $('#autoForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var id = $('#startSel').value;
    var out = $('#autoOut');
    if (!id) {
      out.textContent = '';
      append(out, h('div', { class: 'empty' }, h('strong', null, '請先選擇起點'), h('p', null, '自動規劃會從你選的起點出發，依序加入最近的地點。')));
      $('#startSel').focus();
      return;
    }
    var target = Number(($('input[name="dur"]:checked') || {}).value || 30);
    state.auto = autoPlan(id, target);
    renderAuto(state.auto);
  });

  // from the walk list or a source entry: if the current search / ward / stage hides this place,
  // clear them first so the open card never sits beside an empty map and list
  function goPlace(id, from) {
    zoneTabs.select('tab-map', false);
    var cleared = false;
    if (!visiblePlaces().some(function (p) { return p.id === id; })) {
      window.clearTimeout(qTimer);
      state.q = ''; state.ward = ''; qEl.value = ''; wardEl.value = '';
      if (state.stage) setStage(null, false); else refresh(true, false);
      cleared = true;
    }
    window.setTimeout(function () {
      openDetail(id, from);
      if (cleared) announce('已清除搜尋與篩選，並打開「' + byId[id].zh + '」的觀測卡');
    }, 0);
  }

  /* ======================================================================
   * Zone 3 — 來源
   * ==================================================================== */
  var CATS = [
    { key: 'all', label: '全部' }, { key: 'official', label: '官方' }, { key: 'jma', label: '氣象廳' },
    { key: 'third', label: '第三方整合' }, { key: 'excluded', label: '排除・失效' }
  ];
  var CAT_LABEL = { official: '官方', jma: '氣象廳', third: '第三方整合', excluded: '排除・失效' };
  var SRC = D.sources;
  var srcByKey = {};
  SRC.forEach(function (x) {
    srcByKey[x.key] = x;
    var placesTxt = (x.places || []).map(function (id) { return byId[id] ? byId[id].zh + ' ' + byId[id].ja : id; }).join(' ');
    x._hay = norm([x.key, x.rows.join(' '), x.name, x.operator, x.supports, x.finding, x.caveat, x.mapNote, x.role, x.cadence,
      x.links.map(function (l) { return (l.url || '') + ' ' + l.role; }).join(' '), placesTxt, CAT_LABEL[x.cat]].join(' '));
  });
  function originTag(x) {
    if (x.origin === 'sheet') return '資料表 ' + x.key;
    if (x.origin === 'merged') return x.isNote ? '合併說明 · ' + x.rows.length + ' 列' : '合併網址 · 被 ' + x.rows.length + ' 列引用';
    return '快照補充 · 2026-10-02 查核';
  }
  function buildCats() {
    var box = $('#srcCats');
    CATS.forEach(function (c) {
      var n = c.key === 'all' ? SRC.length : SRC.filter(function (x) { return x.cat === c.key; }).length;
      box.appendChild(h('button', { type: 'button', 'aria-pressed': c.key === state.srcCat ? 'true' : 'false', dataset: { cat: c.key } }, c.label, h('span', { class: 'mono' }, String(n))));
    });
    box.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      state.srcCat = b.dataset.cat;
      $$('#srcCats button').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      renderSources();
    });
    $('#srcTotal').textContent = String(SRC.length);
  }
  function srcEntry(x) {
    var linksNodes = [];
    var plain = x.links.filter(function (l) { return l.url; });
    if (plain.length) linksNodes.push(linkList(plain));
    x.links.filter(function (l) { return l.shared; }).forEach(function (l) {
      var t = srcByKey[l.shared];
      linksNodes.push(h('a', { href: '#src-' + l.shared, class: 'sharedref', dataset: { shared: l.shared } }, l.role + ' → 見共用來源：' + t.name));
    });
    var checked = [], snap = x.origin === 'snapshot';
    x.checked.forEach(function (d, k) {
      if (k) checked.push(' · ');   // each date + gloss stays on one line; breaks only fall between dates
      var gloss = snap ? (k === x.checked.length - 1 ? '（共用核實快照）' : '') : (d === META.sheetAudit ? '（資料表）' : '（快照再查）');
      checked.push(h('span', { class: 'nowrap' }, d + gloss));
    });
    var placesNode = (x.places && x.places.length) ? h('div', { class: 'placechips' }, x.places.map(function (id) {
      var p = byId[id];
      return h('button', { type: 'button', onclick: function () { goPlace(id, 'src'); }, 'aria-label': '打開「' + p.zh + '」的觀測卡' }, p.zh);
    })) : null;
    var pairs = [];
    if (linksNodes.length) pairs.push(['網址', h('div', null, linksNodes)]);
    pairs.push(['查核日期', h('span', { class: 'mono' }, checked)]);
    pairs.push(['支持的資料', h('div', null, ids(x.supports), placesNode)]);
    if (x.isNote) {
      pairs.push(['角色', x.role]); pairs.push(['發現', x.finding]); pairs.push(['更新頻率', x.cadence]); pairs.push(['建議檢查', x.poll]);
      pairs.push(['適用資料列', h('span', { class: 'mono' }, ids(x.rows.join('、')))]);
    } else {
      if (x.finding) pairs.push(['資料表發現', ids(x.finding)]);
      if (x.sharedNote) pairs.push(['共同說明', h('a', { href: '#src-' + x.sharedNote, class: 'sharedref', dataset: { shared: x.sharedNote } }, '見「' + srcByKey[x.sharedNote].name + '」')]);
      if (x.origin === 'merged') pairs.push(['引用資料列', h('span', { class: 'mono' }, ids(x.rows.join('、')))]);
    }
    if (x.caveat) pairs.push(['注意', ids(x.caveat)]);
    if (x.mapNote) pairs.push(['地圖', '不列入地圖：' + x.mapNote]);
    return h('li', { class: 'src', id: 'src-' + x.key },
      h('span', { class: 'src__grade' + (x.grade ? '' : ' src__grade--none'), title: x.grade ? '等級 ' + x.grade + '：' + D.grades[x.grade] : '補充頁面，未分級', 'aria-label': x.grade ? '等級 ' + x.grade + '：' + D.grades[x.grade] : '補充頁面，未分級' }, x.grade || '補'),
      h('div', { class: 'src__head' },
        h('p', { class: 'src__tags mono' }, ids(CAT_LABEL[x.cat] + ' · ' + originTag(x))),
        h('h4', { class: 'src__name' }, x.name),
        x.operator ? h('p', { class: 'src__op' }, x.operator) : null),
      h('div', { class: 'src__body' }, kv(pairs)));
  }
  function renderSources() {
    var terms = state.srcQ.split(/\s+/).map(norm).filter(Boolean);
    var list = SRC.filter(function (x) {
      if (state.srcCat !== 'all' && x.cat !== state.srcCat) return false;
      for (var i = 0; i < terms.length; i++) if (x._hay.indexOf(terms[i]) < 0) return false;
      return true;
    });
    var ol = $('#srcList'), empty = $('#srcEmpty');
    ol.textContent = '';
    var active = !!(state.srcQ || state.srcCat !== 'all');
    var cat = CATS.filter(function (c) { return c.key === state.srcCat; })[0].label;
    $('#srcLine').textContent = '顯示 ' + list.length + '／' + SRC.length + ' 筆 · 分類：' + cat + (state.srcQ ? ' · 搜尋：「' + state.srcQ + '」' : '');
    $('#clearSrc').hidden = !active;
    if (!list.length) {
      empty.hidden = false; empty.textContent = '';
      append(empty, [h('strong', null, '沒有符合的來源'), h('p', null, '試試其他關鍵字（例如地點名稱、網域或 TKG 編號），或切換到「全部」分類。'),
        h('button', { type: 'button', class: 'textbtn', onclick: clearSrc }, '清除搜尋與分類')]);
      return;
    }
    empty.hidden = true;
    var frag = document.createDocumentFragment();
    list.forEach(function (x) { frag.appendChild(srcEntry(x)); });
    ol.appendChild(frag);
  }
  function clearSrc() {
    state.srcQ = ''; $('#sq').value = ''; state.srcCat = 'all';
    $$('#srcCats button').forEach(function (x) { x.setAttribute('aria-pressed', x.dataset.cat === 'all' ? 'true' : 'false'); });
    renderSources();
  }
  $('#clearSrc').addEventListener('click', clearSrc);
  var srcTimer = 0;
  $('#sq').addEventListener('input', function (e) {
    window.clearTimeout(srcTimer);
    var v = e.target.value;
    srcTimer = window.setTimeout(function () { state.srcQ = v.trim(); renderSources(); }, 120);
  });
  $('#srcList').addEventListener('click', function (e) {
    var a = e.target.closest('a[data-shared]');
    if (!a) return;
    e.preventDefault();
    var key = a.dataset.shared;
    if (!document.getElementById('src-' + key)) clearSrc();
    var t = document.getElementById('src-' + key);
    if (!t) return;
    t.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    t.classList.add('is-flash');
    window.setTimeout(function () { t.classList.remove('is-flash'); }, 1400);
    var name = t.querySelector('.src__name');
    name.tabIndex = -1; name.focus({ preventScroll: true });
  });

  /* ======================================================================
   * init
   * ==================================================================== */
  function buildLegend() {
    var ul = $('#legend');
    STAGES.forEach(function (st, i) {
      ul.appendChild(h('li', null, h('span', { class: 'swatch', style: '--c: var(--s' + (i + 1) + ')', 'aria-hidden': 'true' }), h('span', { lang: 'ja' }, st.key)));
    });
    ul.appendChild(h('li', null, h('span', { class: 'swatch swatch--unk', 'aria-hidden': 'true' }), '待確認（目前全部地點）'));
  }

  var mapMsg = $('#mapMsg');
  append(mapMsg, [h('strong', null, '地圖圖磚暫時無法載入'),
    '可能是離線或連線被封鎖。標記仍依座標畫在方格底上；也可以切換到「清單」查看所有地點。']);

  map = NoteMap($('#map'), { msgEl: mapMsg, onPick: function (id, from) { openDetail(id, from); } });

  buildStageStrip();
  renderStagePanel();
  buildWardSelect();
  buildLegend();
  blankCard();
  buildCats();
  placeOptions($('#startSel'), { placeholder: '選擇起點…' });
  if (state.walk.length) $('#startSel').value = state.walk[0];

  zoneTabs = setupTabs($('#zoneTabs'), function (tab) {
    state.zone = tab.id;
    if (tab.id === 'tab-map') map.measure();
    if (tab.id === 'tab-src' && !$('#srcList').children.length) renderSources();
    var navTop = $('.masthead__inner').getBoundingClientRect().bottom + window.pageYOffset;
    if (window.pageYOffset > navTop) window.scrollTo(0, navTop);
  });
  viewTabs = setupTabs($('#viewTabs'), function (tab) {
    state.view = tab.id === 'view-map' ? 'map' : 'list';
    if (state.view === 'map') {
      map.measure();
      if (state.selected) map.select(state.selected, { reveal: true });
    }
  });

  var qTimer = 0;
  qEl.addEventListener('input', function () {
    window.clearTimeout(qTimer);
    qTimer = window.setTimeout(function () { state.q = qEl.value.trim(); refresh(true); }, 120);
  });
  qEl.addEventListener('keydown', function (e) { if (e.key === 'Escape' && qEl.value) { qEl.value = ''; state.q = ''; refresh(true); } });
  wardEl.addEventListener('change', function () { state.ward = wardEl.value; refresh(true); });
  $('#clearFilters').addEventListener('click', clearFilters);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && state.selected && $('#detail').contains(document.activeElement)) closeDetail();
  });
  $('#detail').addEventListener('scroll', syncCardFade, { passive: true });
  $('#detail').addEventListener('toggle', syncCardFade, true);   // a <details> opening makes the card longer
  window.addEventListener('resize', syncCardFade);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(syncCardFade);

  walkChanged();
  refresh(true);
  renderSources();

})();
