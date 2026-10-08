/* 金色散策｜東京銀杏地圖
   只用 HTML、CSS、JavaScript；資料在 data.js。地圖用 Leaflet + OpenStreetMap，路線交給 Google 地圖。 */
(function () {
  'use strict';

  var D = window.GINKGO_DATA;
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  if (!D || !D.spots) {
    var box = $('#spotList');
    if (box) box.innerHTML = '<p class="empty">景點資料沒有載入成功，請重新整理頁面。</p>';
    return;
  }

  /* ---------- 常數 ---------- */
  var CATS = [
    { id: 'entry', label: '官方景點入口', desc: '景點管理單位官方網站上的景點頁，用來確認位置、交通與開放資訊。頁面本身通常不是葉況。' },
    { id: 'notice', label: '官方葉況公告', desc: '管理單位在「本季」發布、帶有日期的葉況公告或照片。' },
    { id: 'history', label: '歷史觀測', desc: '往年的日期紀錄或名單（歷年資訊）。只供參考，不代表今年的狀況。' },
    { id: 'third', label: '第三方彙整', desc: '不是景點管理單位的整合網站（例如 tenki.jp、WalkerPlus）。可用來查找，但不是一手來源。' },
    { id: 'forecast', label: '預測', desc: '預報或模型推估。本站沒有把任何預測套用到單一景點。' },
    { id: 'unverified', label: '未核實', desc: '在可讀的官方頁面中找不到、或尚未能確認的說法，單獨標出來。' }
  ];
  var CAT = {}; CATS.forEach(function (c) { CAT[c.id] = c; });
  var DATE_KINDS = [
    { k: 'pub', label: '發布日', desc: '文章或公告上架、更新的日期。' },
    { k: 'shot', label: '拍攝日', desc: '照片實際拍攝的日期，常常早於發布日。' },
    { k: 'obs', label: '觀測日', desc: '人員實際觀察葉況的日期。' },
    { k: 'inv', label: '資料盤點日', desc: '本站檢查這筆資料的日期，不是葉況的日期。' }
  ];
  var DK = {}; DATE_KINDS.forEach(function (d) { DK[d.k] = d; });
  var POS_KIND = { park: '園區代表點（近似位置）', sub: '園內子地點（概略）', avenue: '並木代表點', gate: '入口', site: '景點位置' };
  var MAX_STOPS = 10;
  var TOKYO = [35.69, 139.62];
  var STATUS_TEXT = '當季現況待核對';

  /* ---------- 工具 ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function norm(s) {
    s = String(s).normalize('NFKC').toLowerCase();
    s = s.replace(/[ぁ-ゖ]/g, function (ch) { return String.fromCharCode(ch.charCodeAt(0) + 0x60); });
    return s.replace(/[\s　・\-‐‑–—_()（）「」『』,，、.。:：／\/]+/g, '');
  }
  function jump(y) { window.scrollTo({ top: y, left: 0, behavior: 'instant' }); }
  function reduced() { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
  function parseISO(s) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; }
  function today() { var n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); }
  function ageInfo(iso) {
    var d = parseISO(iso), t = today();
    if (!d) return null;
    var days = Math.round((t - d) / 86400000), text;
    if (days <= 0) text = '今天';
    else if (days <= 45) text = days + ' 天前';
    else {
      var months = Math.round(days / 30.44);
      if (months < 12) text = '約 ' + months + ' 個月前';
      else text = '約 ' + Math.round(months / 12) + ' 年前';
    }
    var current = d.getFullYear() === t.getFullYear() && d.getMonth() >= 8 && t.getMonth() >= 8;
    var label = current ? '本季' : (d.getFullYear() === t.getFullYear() ? '季前' : '往年');
    return { days: days, text: text, current: current, label: label };
  }
  function since(a) { return a.days <= 0 ? '今天' : '距今 ' + a.text.replace('前', ''); }
  function gmapsSpot(s) { return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(s.pos.lat + ',' + s.pos.lng); }
  function debounce(fn, ms) { var t; return function () { var a = arguments, c = this; clearTimeout(t); t = setTimeout(function () { fn.apply(c, a); }, ms); }; }
  function fmtCoord(n) { return n.toFixed(4); }

  var spotById = {};
  D.spots.forEach(function (s) {
    spotById[s.id] = s;
    s.cats = [];
    s.records.forEach(function (r) { if (s.cats.indexOf(r.cat) < 0) s.cats.push(r.cat); });
    var area = D.areas.filter(function (a) { return a.id === s.area; })[0];
    s.areaLabel = area ? area.label : '';
    s.hay = norm([s.zh, s.ja, s.wards, s.summary, s.keywords, s.areaLabel, s.pos.label].join(' '));
  });

  /* ---------- 狀態 ---------- */
  var state = { q: '', cat: 'all', area: 'all', focus: null, view: 'list', route: [], listY: 0 };
  var ws = $('#workspace');
  var mqTab = window.matchMedia('(max-width: 999.98px)');
  function isTabbed() { return mqTab.matches; }

  /* ---------- 日期與卡片內容 ---------- */
  function latestDate(spot, kind) {
    var best = null;
    spot.records.forEach(function (r) {
      if (!r.leaf) return;
      r.dates.forEach(function (d) {
        if (d.k !== kind) return;
        if (!best || d.v > best.v) best = d;
      });
    });
    return best;
  }
  function dateCell(label, d, isInv) {
    if (!d) return '<div><dt>' + label + '</dt><dd><span class="d-none">無</span></dd></div>';
    var a = ageInfo(d.v), cls = '', sub = '';
    if (a) {
      if (isInv) sub = since(a);
      else { sub = a.label + '・' + a.text; cls = a.current ? ' class="is-current"' : ' class="is-old"'; }
    }
    return '<div><dt>' + label + '</dt><dd' + cls + '><span class="d-val">' + esc(d.t || d.v) + '</span>' + (sub ? '<span class="d-age">' + esc(sub) + '</span>' : '') + '</dd></div>';
  }
  function tagHTML(cat) { return '<span class="tag tag-' + cat + '">' + esc(CAT[cat].label) + '</span>'; }
  function recDates(r) {
    return r.dates.map(function (d) {
      var a = ageInfo(d.v), extra = '';
      if (a) extra = d.k === 'inv' ? since(a) : a.label + '・' + a.text;
      return '<span><b>' + esc(DK[d.k].label) + '</b> ' + esc(d.t || d.v) + (extra ? '<em class="age-note">' + esc(extra) + '</em>' : '') + '</span>';
    }).join('');
  }
  function moreHTML(s) {
    var h = '<div class="more-body">';
    h += '<div><h5>位置</h5><p><span class="pos-label">' + esc(s.pos.label) + '</span>　<span class="coord">' + fmtCoord(s.pos.lat) + ', ' + fmtCoord(s.pos.lng) + '</span>' + (s.pos.approx && s.pos.label.indexOf('近似') < 0 ? '（近似位置）' : '') + '</p>';
    h += '<p>' + esc(s.pos.note) + '</p>';
    h += '<p class="mini">座標參考</p><div class="srcs">' + s.pos.src.map(function (x) { return '<a class="link-out" href="' + esc(x.u) + '" target="_blank" rel="noopener noreferrer">' + esc(x.t) + '<svg class="ico" aria-hidden="true"><use href="#i-out"/></svg></a>'; }).join('') + '</div></div>';
    h += '<div><h5>資料紀錄</h5>';
    s.records.forEach(function (r) {
      h += '<div class="rec">' + tagHTML(r.cat) + '<p class="rec-title">' + esc(r.title) + '</p><p>' + esc(r.desc) + '</p>' +
        '<p class="rec-dates">' + recDates(r) + '</p>' +
        '<a class="link-out" href="' + esc(r.url) + '" target="_blank" rel="noopener noreferrer">開啟來源<svg class="ico" aria-hidden="true"><use href="#i-out"/></svg></a></div>';
    });
    h += '</div>';
    if (s.cautions.length) h += '<div><h5>留意</h5><ul class="cautions">' + s.cautions.map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('') + '</ul></div>';
    if (s.events.length) h += '<div><h5>活動日期（不是見頃日）</h5><ul>' + s.events.map(function (e) {
      return '<li>' + esc(e.t) + '：' + esc(e.d) + '　<a class="link-out" href="' + esc(e.u) + '" target="_blank" rel="noopener noreferrer">官方說明</a></li>';
    }).join('') + '</ul></div>';
    if (s.notices.length) h += '<div><h5>開放資訊（不是葉況）</h5><ul>' + s.notices.map(function (n) {
      return '<li>' + esc(n.t) + '（' + esc(DK[n.k].label) + ' ' + esc(n.v) + '）　<a class="link-out" href="' + esc(n.u) + '" target="_blank" rel="noopener noreferrer">官方說明</a></li>';
    }).join('') + '</ul></div>';
    h += '<p class="id-line">來源整理表列號 ' + esc(s.sheetId) + '</p></div>';
    return h;
  }
  function entryHTML(s) {
    var pub = latestDate(s, 'pub'), shot = latestDate(s, 'shot'), obs = latestDate(s, 'obs');
    var inv = { v: D.meta.inventory };
    var reason = s.statusNote || ('資料盤點日 ' + D.meta.inventory + '：尚未找到與本景點、銀杏及 2026 年日期相符的葉況資料，所以不指派階段。');
    var subJa = s.ja !== s.zh ? '<span lang="ja">' + esc(s.ja) + '</span>' : '';
    return '<li class="entry" id="spot-' + esc(s.id) + '" data-id="' + esc(s.id) + '">' +
      '<h4 class="entry-name">' + esc(s.zh) + '</h4>' +
      '<p class="entry-sub">' + subJa + '<span' + (subJa ? ' class="sep"' : '') + '>' + esc(s.wards) + '</span></p>' +
      '<p class="tags"><span class="vh">資料類別：</span>' + s.cats.map(tagHTML).join('') + '</p>' +
      '<p class="entry-summary">' + esc(s.summary) + '</p>' +
      '<p class="status"><svg class="ico" aria-hidden="true"><use href="#i-clock"/></svg><span><b>' + STATUS_TEXT + '</b><span>' + esc(reason) + '</span></span></p>' +
      '<dl class="dates">' + dateCell('發布日', pub) + dateCell('拍攝日', shot) + dateCell('觀測日', obs) + dateCell('資料盤點日', inv, true) + '</dl>' +
      '<div class="entry-actions">' +
        '<button type="button" class="btn btn-primary" data-act="focus" aria-label="在地圖上看：' + esc(s.zh) + '"><svg class="ico" aria-hidden="true"><use href="#i-pin"/></svg>在地圖上看</button>' +
        '<button type="button" class="btn" data-act="route"></button>' +
      '</div>' +
      '<div class="entry-links">' +
        '<a class="link-out" href="' + esc(s.officialUrl) + '" target="_blank" rel="noopener noreferrer" aria-label="官方入口：' + esc(s.zh) + '">官方入口<svg class="ico" aria-hidden="true"><use href="#i-out"/></svg></a>' +
        '<a class="link-out" href="' + esc(gmapsSpot(s)) + '" target="_blank" rel="noopener noreferrer" aria-label="在 Google 地圖開啟：' + esc(s.zh) + '">在 Google 地圖開啟<svg class="ico" aria-hidden="true"><use href="#i-out"/></svg></a>' +
      '</div>' +
      '<details class="more"><summary>詳細資料與來源<svg class="ico chev" aria-hidden="true"><use href="#i-chev"/></svg></summary>' + moreHTML(s) + '</details>' +
      '</li>';
  }

  /* ---------- 清單與篩選 ---------- */
  var listEl = $('#spotList');
  function renderList() {
    var html = '';
    D.areas.forEach(function (a) {
      var items = D.spots.filter(function (s) { return s.area === a.id; });
      html += '<section class="group" data-area="' + esc(a.id) + '" aria-labelledby="gh-' + esc(a.id) + '">' +
        '<h3 class="group-h" id="gh-' + esc(a.id) + '">' + esc(a.label) + '<small></small></h3><ul class="entries">' +
        items.map(entryHTML).join('') + '</ul></section>';
    });
    listEl.innerHTML = html;
  }

  function qTokens() { return state.q.split(/\s+/).map(norm).filter(Boolean); }
  function matches(s, q, cat, area) {
    if (area !== 'all' && s.area !== area) return false;
    if (cat !== 'all' && s.cats.indexOf(cat) < 0) return false;
    for (var i = 0; i < q.length; i++) if (s.hay.indexOf(q[i]) < 0) return false;
    return true;
  }
  function shownSpots() { var q = qTokens(); return D.spots.filter(function (s) { return matches(s, q, state.cat, state.area); }); }
  function isShown(id) { return shownSpots().some(function (s) { return s.id === id; }); }

  function renderChips() {
    var cat = [{ id: 'all', label: '全部' }].concat(CATS.map(function (c) { return { id: c.id, label: c.label }; }));
    var area = [{ id: 'all', label: '全部' }].concat(D.areas);
    function chip(name, o, checked) {
      return '<label class="chip"><input type="radio" name="' + name + '" value="' + esc(o.id) + '"' + (checked ? ' checked' : '') + '><span>' + esc(o.label) + ' <i data-n="' + name + ':' + esc(o.id) + '"></i></span></label>';
    }
    $('#catChips').innerHTML = cat.map(function (o) { return chip('cat', o, o.id === 'all'); }).join('');
    $('#areaChips').innerHTML = area.map(function (o) { return chip('area', o, o.id === 'all'); }).join('');
  }
  function updateCounts() {
    var q = qTokens();
    $$('[data-n]').forEach(function (el) {
      var p = el.getAttribute('data-n').split(':'), n;
      if (p[0] === 'cat') n = D.spots.filter(function (s) { return matches(s, q, p[1], state.area); }).length;
      else n = D.spots.filter(function (s) { return matches(s, q, state.cat, p[1]); }).length;
      el.textContent = n;
    });
  }

  var firstApply = true;
  function applyFilters(opts) {
    opts = opts || {};
    var shown = shownSpots(), ids = {};
    shown.forEach(function (s) { ids[s.id] = true; });
    $$('.entry', listEl).forEach(function (li) { li.hidden = !ids[li.getAttribute('data-id')]; });
    $$('.group', listEl).forEach(function (g) {
      var n = $$('.entry:not([hidden])', g).length;
      g.hidden = n === 0;
      $('small', g).textContent = '　' + n + ' 處';
    });
    var total = D.spots.length;
    $('#resultCount').innerHTML = '顯示 <b>' + shown.length + '</b> / ' + total + ' 處景點';
    $('#tabListN').textContent = ' ' + shown.length;
    var active = !!(state.q.trim() || state.cat !== 'all' || state.area !== 'all');
    $('#clearBtn').disabled = !active;
    var empty = $('#emptyState');
    empty.hidden = shown.length > 0;
    if (!shown.length) {
      $('#emptyMsg').textContent = state.cat === 'forecast' && !state.q.trim()
        ? '沒有任何景點附有針對該景點的預測資料。日本氣象株式會社的預報是東京城市尺度，本站不把它套用到單一景點，只列在「資料來源」。'
        : '換個關鍵字，或放寬資料類別與區域的條件試試。';
    }
    updateCounts();
    if (state.focus && !ids[state.focus]) { setActive(null); }
    syncMarkers();
    if (!firstApply || opts.fit) requestFit();
    firstApply = false;
  }
  function clearFilters() {
    state.q = ''; state.cat = 'all'; state.area = 'all';
    $('#q').value = '';
    $$('input[name="cat"]')[0].checked = true;
    $$('input[name="area"]')[0].checked = true;
    applyFilters();
    announce('已清除篩選，顯示全部 ' + D.spots.length + ' 處景點。');
  }

  /* ---------- 提示訊息 ---------- */
  var toastEl = $('#toast'), toastTimer;
  function announce(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 3600);
  }

  /* ---------- 路線 ---------- */
  function routeIndex(id) { return state.route.indexOf(id); }
  function buildDirectionsUrl(origin, spots) {
    var enc = encodeURIComponent;
    var pt = function (s) { return enc(s.pos.lat + ',' + s.pos.lng); };
    var dest = spots[spots.length - 1], wps = spots.slice(0, -1);
    var u = 'https://www.google.com/maps/dir/?api=1';
    if (origin && origin.trim()) u += '&origin=' + enc(origin.trim());
    u += '&destination=' + pt(dest);
    if (wps.length) u += '&waypoints=' + wps.map(pt).join('%7C');
    u += '&travelmode=walking';
    return u;
  }
  var routeGo = $('#routeGo');
  function renderRoute() {
    var spots = state.route.map(function (id) { return spotById[id]; });
    var n = spots.length;
    $('#routeN').textContent = n;
    $('#tabRouteN').textContent = ' ' + n;
    $('#routeList').innerHTML = spots.map(function (s, i) {
      return '<li class="route-item" data-id="' + esc(s.id) + '"><span class="no" aria-hidden="true">' + (i + 1) + '</span>' +
        '<span class="nm"><span class="vh">第 ' + (i + 1) + ' 站：</span>' + esc(s.zh) + '<small>' + esc(s.wards) + '</small></span>' +
        '<button type="button" class="btn btn-quiet btn-sm" data-remove="' + esc(s.id) + '" aria-label="從路線移除：' + esc(s.zh) + '">移除</button></li>';
    }).join('');
    $('#routeEmpty').hidden = n > 0;
    $('#routeClear').disabled = n === 0;
    var note = '';
    if (n >= 1) note = '步行時間與可行性都由 Google 地圖顯示；景點相距很遠時，Google 地圖可能提供其他交通方式，或沒有步行路線。';
    if (n > 4) note += ' 在手機瀏覽器開啟時，Google 地圖網址最多接受 3 個中途停靠點（共 4 個景點），多出的景點可能不會帶入。';
    if (n >= MAX_STOPS) note += ' 已達 ' + MAX_STOPS + ' 個景點的上限。';
    $('#routeNote').textContent = note;
    updateRouteUrl();
    $$('[data-act="route"]', listEl).forEach(function (b) {
      var s = spotById[b.closest('.entry').getAttribute('data-id')], inR = routeIndex(s.id) >= 0;
      b.classList.toggle('is-in', inR);
      b.innerHTML = '<svg class="ico" aria-hidden="true"><use href="' + (inR ? '#i-check' : '#i-plus') + '"/></svg>' + (inR ? '已加入（按一下移除）' : '加入路線');
      b.setAttribute('aria-label', (inR ? '從路線移除：' : '加入路線：') + s.zh);
    });
    D.spots.forEach(function (s) { refreshMarker(s.id); refreshPopup(s.id); });
  }
  function updateRouteUrl() {
    var n = state.route.length;
    if (!n) {
      routeGo.removeAttribute('href');
      routeGo.setAttribute('aria-disabled', 'true');
      $('#routeStatus').textContent = '';
      return;
    }
    routeGo.href = buildDirectionsUrl($('#origin').value, state.route.map(function (id) { return spotById[id]; }));
    routeGo.setAttribute('aria-disabled', 'false');
    $('#routeStatus').textContent = n + ' 個景點' + ($('#origin').value.trim() ? '，起點：' + $('#origin').value.trim() : '，尚未填起點') + '。';
  }
  function addStop(id) {
    if (routeIndex(id) >= 0) return;
    if (state.route.length >= MAX_STOPS) { announce('路線最多 ' + MAX_STOPS + ' 個景點，請先移除一個。'); return; }
    state.route.push(id);
    renderRoute();
    announce('已加入「' + spotById[id].zh + '」，路線目前有 ' + state.route.length + ' 個景點。');
  }
  function removeStop(id) {
    var i = routeIndex(id); if (i < 0) return;
    state.route.splice(i, 1);
    renderRoute();
    announce('已移除「' + spotById[id].zh + '」，路線目前有 ' + state.route.length + ' 個景點。');
  }
  function toggleStop(id) { if (routeIndex(id) >= 0) removeStop(id); else addStop(id); }

  /* ---------- 地圖 ---------- */
  var M = { map: null, markers: {}, layer: null, lastSize: null, needsFit: true, tileOk: 0, tileErr: 0, tileFailed: false };
  var mapEl = $('#map');

  function fbListHTML() {
    return D.spots.map(function (s) {
      return '<li><span>' + esc(s.zh) + '</span><a class="link-out" href="' + esc(gmapsSpot(s)) + '" target="_blank" rel="noopener noreferrer" aria-label="在 Google 地圖開啟：' + esc(s.zh) + '">在 Google 地圖開啟<svg class="ico" aria-hidden="true"><use href="#i-out"/></svg></a></li>';
    }).join('');
  }
  function showMapMissing() {
    mapEl.hidden = true;
    $('.map-key').hidden = true;
    $('#mapFallback').hidden = false;
    $('#fbMsg').textContent = '內嵌地圖沒有載入（可能是目前沒有網路，或網路擋下了地圖程式庫）。景點清單、搜尋、篩選與路線功能都還能用；下面每個景點都可以直接在 Google 地圖開啟。';
    $('#fbList').innerHTML = fbListHTML();
  }
  function showTileFail() {
    if (M.tileFailed) return;
    M.tileFailed = true;
    $('#mapFallback').hidden = false;
    $('#fbMsg').textContent = '地圖底圖暫時載入不到（可能是目前沒有網路，或圖磚伺服器沒有回應）。清單、搜尋與路線功能不受影響；下面每個景點都可以直接在 Google 地圖開啟。';
    $('#fbList').innerHTML = fbListHTML();
  }
  function hideTileFail() {
    if (!M.tileFailed) return;
    M.tileFailed = false;
    $('#mapFallback').hidden = true;
  }

  function pinIcon(s) {
    var ri = routeIndex(s.id);
    var cls = 'pin' + (s.pos.approx ? ' pin--approx' : '') + (ri >= 0 ? ' pin--route' : '') + (state.focus === s.id ? ' pin--active' : '');
    var inner = ri >= 0 ? String(ri + 1) : '<svg viewBox="0 0 100 110" aria-hidden="true"><use href="#leaf"/></svg>';
    return L.divIcon({ className: 'pin-wrap', html: '<div class="' + cls + '">' + inner + '</div>', iconSize: [40, 40], iconAnchor: [20, 20], popupAnchor: [0, -16] });
  }
  function refreshMarker(id) {
    var m = M.markers[id]; if (!m) return;
    m.setIcon(pinIcon(spotById[id]));
    m.setZIndexOffset(state.focus === id ? 1000 : (routeIndex(id) >= 0 ? 500 : 0));
  }
  var popupEls = {};
  function buildPopup(s) {
    var div = document.createElement('div');
    div.innerHTML = '<div class="pop-name">' + esc(s.zh) + '</div>' +
      (s.ja !== s.zh ? '<div class="pop-ja" lang="ja">' + esc(s.ja) + '</div>' : '') +
      '<div class="pop-status"><svg class="ico" aria-hidden="true"><use href="#i-clock"/></svg>' + STATUS_TEXT + '</div>' +
      '<div class="pop-actions"><button type="button" class="btn btn-primary" data-pop="route"></button>' +
      '<a class="btn" target="_blank" rel="noopener noreferrer" href="' + esc(gmapsSpot(s)) + '">在 Google 地圖開啟</a></div>';
    $('[data-pop="route"]', div).addEventListener('click', function () { toggleStop(s.id); });
    popupEls[s.id] = div;
    return div;
  }
  function refreshPopup(id) {
    var el = popupEls[id]; if (!el) return;
    var b = $('[data-pop="route"]', el), inR = routeIndex(id) >= 0;
    b.textContent = inR ? '從路線移除' : '加入路線';
    b.className = 'btn ' + (inR ? '' : 'btn-primary');
  }
  function syncMarkers() {
    if (!M.map) return;
    var ids = {};
    shownSpots().forEach(function (s) { ids[s.id] = true; });
    D.spots.forEach(function (s) {
      var on = M.layer.hasLayer(M.markers[s.id]);
      if (ids[s.id] && !on) M.layer.addLayer(M.markers[s.id]);
      if (!ids[s.id] && on) M.layer.removeLayer(M.markers[s.id]);
    });
  }
  function mapVisible() { return !!(mapEl && mapEl.clientWidth > 0 && mapEl.clientHeight > 0); }
  function fitPoints(spots, maxZoom) {
    if (!spots.length) { M.map.setView(TOKYO, 10, { animate: false }); return; }
    var b = L.latLngBounds(spots.map(function (s) { return [s.pos.lat, s.pos.lng]; }));
    M.map.fitBounds(b, { paddingTopLeft: [64, 56], paddingBottomRight: [48, 48], maxZoom: maxZoom || 15, animate: false });
  }
  // 把景點放在地圖中央偏下，讓上方留出彈出視窗的空間
  function focusView(s, zoom, animate) {
    var h = mapEl.clientHeight;
    var dy = Math.max(0, Math.min(h * 0.3, 250 - h / 2));
    var pt = M.map.project([s.pos.lat, s.pos.lng], zoom).subtract([0, dy]);
    M.map.setView(M.map.unproject(pt, zoom), zoom, { animate: animate });
  }
  function applyIntent(mode) {
    if (!M.map || !mapVisible()) return;
    var f = state.focus && spotById[state.focus];
    if (mode === 'resize' && f && isShown(f.id)) {
      focusView(f, Math.max(M.map.getZoom(), 14), false);
    } else if (mode === 'resize' && state.route.length >= 2) {
      fitPoints(state.route.map(function (id) { return spotById[id]; }));
    } else {
      fitPoints(shownSpots());
    }
    updateLowZoom();
  }
  function updateLowZoom() { if (M.map) mapEl.classList.toggle('map-low', M.map.getZoom() < 11); }
  function onMapSize() {
    if (!M.map) return;
    var w = mapEl.clientWidth, h = mapEl.clientHeight;
    if (!w || !h || M.animating) return; // 隱藏中或動畫中：等下次再處理
    var prev = M.lastSize, first = !prev;
    var big = first || Math.abs(w - prev.w) / prev.w > 0.25 || Math.abs(h - prev.h) / prev.h > 0.25 || ((w > h) !== (prev.w > prev.h));
    M.map.invalidateSize({ animate: false });
    M.lastSize = { w: w, h: h };
    if (big || M.needsFit) { M.needsFit = false; applyIntent(first ? 'filter' : 'resize'); }
  }
  function requestFit() {
    M.needsFit = true;
    if (M.map && mapVisible()) { onMapSize(); }
  }

  function initMap() {
    if (typeof L === 'undefined') { showMapMissing(); return; }
    try {
      M.map = L.map(mapEl, { center: TOKYO, zoom: 10, zoomSnap: 0.5, minZoom: 8, maxZoom: 18, trackResize: false });
      var tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors'
      }).addTo(M.map);
      tiles.on('tileload', function () { M.tileOk++; hideTileFail(); });
      tiles.on('tileerror', function () { M.tileErr++; if (M.tileOk === 0 && M.tileErr >= 4) showTileFail(); });
      setTimeout(function () { if (M.tileOk === 0 && mapVisible()) showTileFail(); }, 12000);
      M.layer = L.layerGroup().addTo(M.map);
      D.spots.forEach(function (s) {
        var m = L.marker([s.pos.lat, s.pos.lng], { icon: pinIcon(s), keyboard: false, title: s.zh });
        m.bindPopup(buildPopup(s), { maxWidth: 340, autoPanPadding: [24, 24], closeButton: true });
        m.on('click', function () { focusSpot(s.id, { fromMap: true }); });
        M.markers[s.id] = m;
        refreshPopup(s.id);
      });
      M.map.on('zoomend', updateLowZoom);
      M.map.on('zoomanim movestart', function () { M.animating = true; });
      M.map.on('zoomend moveend', function () { M.animating = false; });
      if ('ResizeObserver' in window) new ResizeObserver(function () { onMapSize(); }).observe(mapEl);
      window.addEventListener('resize', debounce(onMapSize, 120));
      window.addEventListener('orientationchange', function () { setTimeout(onMapSize, 250); });
      syncMarkers();
      onMapSize();
    } catch (err) {
      if (window.console) console.warn('地圖初始化失敗，改用替代連結：', err);
      M.map = null;
      showMapMissing();
    }
  }

  /* ---------- 定位、標示 ---------- */
  function setActive(id) {
    var prev = state.focus;
    state.focus = id;
    $$('.entry.is-active', listEl).forEach(function (li) { li.classList.remove('is-active'); li.removeAttribute('aria-current'); });
    if (id) {
      var li = $('#spot-' + id);
      if (li) { li.classList.add('is-active'); li.setAttribute('aria-current', 'true'); }
    }
    if (prev) refreshMarker(prev);
    if (id) refreshMarker(id);
  }
  function whenLaidOut(fn) { requestAnimationFrame(function () { requestAnimationFrame(fn); }); }
  function focusSpot(id, opts) {
    opts = opts || {};
    var s = spotById[id]; if (!s) return;
    setActive(id);
    if (opts.fromMap) {
      var li = $('#spot-' + id);
      if (li && !isTabbed()) li.scrollIntoView({ block: 'nearest', behavior: reduced() ? 'instant' : 'smooth' });
      return;
    }
    var wasVisible = mapVisible();
    if (isTabbed()) setView('map');
    if (!M.map || M.tileFailed) {
      announce('內嵌地圖無法使用，請改按「在 Google 地圖開啟」。');
      if (!M.map) return;
    }
    whenLaidOut(function () {
      M.map.invalidateSize({ animate: false });
      M.lastSize = { w: mapEl.clientWidth, h: mapEl.clientHeight };
      M.needsFit = false;
      focusView(s, 15, wasVisible && !reduced());
      M.markers[id].openPopup();
      updateLowZoom();
    });
  }

  /* ---------- 窄螢幕分頁 ---------- */
  var tabEls = $$('[role="tab"]', $('#wsTabs'));
  var panes = { list: $('#explore'), tools: $('#tools'), map: $('#panel-map'), route: $('#panel-route') };
  var origLabels = { list: panes.list.getAttribute('aria-labelledby') };
  function applyPanels() {
    var tabbed = isTabbed(), v = state.view;
    if (!tabbed) {
      ['list', 'tools', 'map', 'route'].forEach(function (k) { panes[k].hidden = false; });
      panes.list.removeAttribute('role'); panes.map.removeAttribute('role'); panes.route.removeAttribute('role');
      panes.map.removeAttribute('aria-labelledby');
      panes.list.setAttribute('aria-labelledby', origLabels.list);
      return;
    }
    panes.list.hidden = v !== 'list';
    panes.tools.hidden = v === 'list';
    panes.map.hidden = v !== 'map';
    panes.route.hidden = v !== 'route';
    panes.list.setAttribute('role', 'tabpanel'); panes.list.setAttribute('aria-labelledby', 'tab-list');
    panes.map.setAttribute('role', 'tabpanel'); panes.map.setAttribute('aria-labelledby', 'tab-map');
    panes.route.setAttribute('role', 'tabpanel'); panes.route.setAttribute('aria-labelledby', 'tab-route');
  }
  function updateTabs() {
    tabEls.forEach(function (t) {
      var on = t.getAttribute('data-view') === state.view;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
    });
  }
  function setView(v, opts) {
    opts = opts || {};
    var prev = state.view;
    if (prev === 'list' && v !== 'list') state.listY = window.pageYOffset;
    state.view = v;
    ws.setAttribute('data-view', v);
    applyPanels(); updateTabs();
    if (isTabbed() && !opts.noScroll) {
      var top = ws.getBoundingClientRect().top + window.pageYOffset;
      if (v === 'list' && prev !== 'list') {
        jump(Math.max(state.listY, top));
        var act = $('.entry.is-active', listEl);
        if (act && state.focus) act.scrollIntoView({ block: 'center', behavior: 'instant' });
      } else if (v !== 'list' && window.pageYOffset > top) {
        jump(top);
      }
    }
    if (v === 'map') whenLaidOut(onMapSize);
  }
  tabEls.forEach(function (t, i) {
    t.addEventListener('click', function () { setView(t.getAttribute('data-view'), { fromTab: true }); });
    t.addEventListener('keydown', function (e) {
      var j = -1;
      if (e.key === 'ArrowRight') j = (i + 1) % tabEls.length;
      else if (e.key === 'ArrowLeft') j = (i + tabEls.length - 1) % tabEls.length;
      else if (e.key === 'Home') j = 0;
      else if (e.key === 'End') j = tabEls.length - 1;
      if (j < 0) return;
      e.preventDefault();
      tabEls[j].focus();
      setView(tabEls[j].getAttribute('data-view'));
    });
  });
  function onModeChange() { applyPanels(); updateTabs(); whenLaidOut(onMapSize); }
  if (mqTab.addEventListener) mqTab.addEventListener('change', onModeChange); else if (mqTab.addListener) mqTab.addListener(onModeChange);

  // 窄螢幕上，導覽連結要切到對應的分頁
  document.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('a[href="#explore"], a[href="#tools"]') : null;
    if (!a || !isTabbed()) return;
    e.preventDefault();
    setView(a.getAttribute('href') === '#tools' ? 'map' : 'list', { noScroll: true });
    var top = ws.getBoundingClientRect().top + window.pageYOffset;
    jump(top);
  });

  /* ---------- 資料來源、圖例 ---------- */
  function renderSources() {
    function item(x) {
      return '<li><div class="src-name">' + esc(x.name) + '<small>' + esc(x.op) + '</small><span class="tags">' + x.cats.map(tagHTML).join('') + '</span></div>' +
        '<div><p class="src-cover"><b>涵蓋</b>' + esc(x.cover) + '</p><p class="src-date"><b>日期</b>' + esc(x.date) + '</p></div>' +
        '<div><a class="link-out" href="' + esc(x.u) + '" target="_blank" rel="noopener noreferrer">' + esc(x.ulabel || '開啟來源') + '<svg class="ico" aria-hidden="true"><use href="#i-out"/></svg></a>' +
        (x.u2 ? '<a class="link-out" href="' + esc(x.u2) + '" target="_blank" rel="noopener noreferrer">' + esc(x.u2label || '另一頁') + '<svg class="ico" aria-hidden="true"><use href="#i-out"/></svg></a>' : '') + '</div></li>';
    }
    $('#srcOfficial').innerHTML = D.sources.filter(function (x) { return x.kind === 'official'; }).map(item).join('');
    $('#srcOther').innerHTML = D.sources.filter(function (x) { return x.kind === 'other'; }).map(item).join('');
  }
  function renderLegend() {
    $('#legendCats').innerHTML = CATS.map(function (c) { return '<div><dt>' + tagHTML(c.id) + '</dt><dd>' + esc(c.desc) + '</dd></div>'; }).join('');
    $('#legendDates').innerHTML = DATE_KINDS.map(function (d) { return '<div><dt>' + esc(d.label) + '</dt><dd>' + esc(d.desc) + '</dd></div>'; }).join('');
  }
  function renderFigures() {
    var assigned = D.spots.filter(function (s) { return s.stage; }).length;
    var current = D.spots.filter(function (s) {
      return s.records.some(function (r) {
        return r.cat === 'notice' && r.dates.some(function (d) { var a = ageInfo(d.v); return d.k !== 'inv' && a && a.current; });
      });
    }).length;
    $('#figSpots').textContent = D.spots.length;
    $('#figStage').textContent = assigned;
    $('#figCurrent').textContent = current;
    $('#stageAssigned').textContent = assigned;
    $('#stageTotal').textContent = D.spots.length;
    $('#figInv').textContent = D.meta.inventory;
    var a = ageInfo(D.meta.inventory);
    $('#figAge').textContent = a ? since(a) : '';
    $('#srcSheetDate').textContent = D.meta.sheetAudit;
    $('#srcInvDate').textContent = D.meta.inventory;
    $('#srcBuiltDate').textContent = D.meta.built;
  }

  /* ---------- 事件 ---------- */
  listEl.addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-act]');
    if (btn) {
      var id = btn.closest('.entry').getAttribute('data-id');
      if (btn.getAttribute('data-act') === 'focus') focusSpot(id); else toggleStop(id);
      return;
    }
    if (e.target.closest('a, summary, details, button')) return;
    var li = e.target.closest('.entry');
    if (!li) return;
    if (isTabbed()) setActive(li.getAttribute('data-id')); else focusSpot(li.getAttribute('data-id'));
  });
  $('#routeList').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-remove]');
    if (b) {
      var items = $$('.route-item');
      var idx = items.indexOf(b.closest('.route-item'));
      removeStop(b.getAttribute('data-remove'));
      var rest = $$('#routeList [data-remove]');
      if (rest.length) rest[Math.min(idx, rest.length - 1)].focus(); else $('#origin').focus();
    }
  });
  $('#routeClear').addEventListener('click', function () {
    var n = state.route.length;
    state.route = [];
    renderRoute();
    announce('已移除全部 ' + n + ' 個景點。');
  });
  routeGo.addEventListener('click', function (e) {
    if (routeGo.getAttribute('aria-disabled') === 'true') {
      e.preventDefault();
      announce('請先在景點卡片按「加入路線」，至少加入一個景點。');
      return;
    }
    announce('已在新分頁開啟 Google 地圖，路線與步行時間由 Google 地圖提供。');
  });
  $('#origin').addEventListener('input', updateRouteUrl);
  $('#filterForm').addEventListener('submit', function (e) { e.preventDefault(); });
  $('#q').addEventListener('input', debounce(function () { state.q = $('#q').value; applyFilters(); }, 120));
  $('#filterForm').addEventListener('change', function (e) {
    var t = e.target;
    if (t.name === 'cat') { state.cat = t.value; applyFilters(); }
    else if (t.name === 'area') { state.area = t.value; applyFilters(); }
  });
  $('#clearBtn').addEventListener('click', clearFilters);
  $('#emptyClear').addEventListener('click', function () { clearFilters(); $('#q').focus(); });

  /* ---------- 啟動 ---------- */
  renderChips();
  renderList();
  renderSources();
  renderLegend();
  renderFigures();
  applyPanels();
  updateTabs();
  initMap();
  renderRoute();
  applyFilters({ fit: true });
})();
