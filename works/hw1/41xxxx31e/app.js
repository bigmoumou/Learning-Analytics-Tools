/* 東京銀杏黃葉散步地圖：互動程式（原生 JavaScript，不用框架、不用 fetch）。
 * 資料全部來自 data.js 的 window.GINKGO_DATA。
 * 景點座標是「園區近似位置」；距離是直線距離，步行時間以 80 公尺／分估算。 */
(function () {
  'use strict';

  var D = window.GINKGO_DATA;
  if (!D || !D.spots) {
    var warn = document.createElement('p');
    warn.className = 'noscript';
    warn.textContent = '資料檔 data.js 沒有載入，請確認 data.js 與 index.html 放在同一個資料夾。';
    document.body.insertBefore(warn, document.body.firstChild);
    return;
  }

  var SVGNS = 'http://www.w3.org/2000/svg';
  var WALK = D.meta.walkSpeedMPerMin;      // 80 m/min
  var MAX_STOPS = D.meta.maxStops;         // 5
  var MIN_STOPS = D.meta.minStops;         // 2
  var FAR_LEG_M = 4000;                    // 單段直線距離超過這個數字就提醒
  var STORE_KEY = 'ginkgo-walk-route-v1';
  var TOTAL = D.spots.length;

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  function h(tag, attrs, kids) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (attrs[k] === null || attrs[k] === undefined || attrs[k] === false) continue;
      if (k === 'text') e.textContent = attrs[k];
      else if (k === 'class') e.className = attrs[k];
      else e.setAttribute(k, attrs[k] === true ? '' : attrs[k]);
    }
    if (kids) kids.forEach(function (c) { if (c) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }
  function s(tag, attrs, kids) {
    var e = document.createElementNS(SVGNS, tag);
    if (attrs) for (var k in attrs) { if (attrs[k] !== null && attrs[k] !== undefined) e.setAttribute(k, attrs[k]); }
    if (kids) kids.forEach(function (c) { if (c) e.appendChild(c); });
    return e;
  }
  function extLink(href, text, label, cls) {
    return h('a', { href: href, target: '_blank', rel: 'noopener noreferrer', 'class': cls === undefined ? 'lnk' : cls, 'aria-label': label || (text + '（開新分頁）') }, [text]);
  }
  function host(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return u; } }

  /* ---------------- 搜尋用的字形折疊（台灣常用字與日文新字體視為相同） ---------------- */
  var FOLD = { '戶': '戸', '國': '国', '學': '学', '舊': '旧', '廣': '広', '德': '徳', '綠': '緑', '黑': '黒', '區': '区', '鄉': '郷', '櫸': '欅', '營': '営', '紀': '記', '澀': '渋', '實': '実', '點': '点', '觀': '観', '會': '会', '證': '証', '關': '関', '縣': '県', '體': '体', '號': '号', '圖': '図', '總': '総', '驛': '駅', '禮': '礼', '濱': '浜', '條': '条' };
  function fold(str) {
    var t = String(str == null ? '' : str);
    try { t = t.normalize('NFKC'); } catch (e) { /* ignore */ }
    t = t.toLowerCase();
    var out = '';
    for (var i = 0; i < t.length; i++) out += FOLD[t[i]] || t[i];
    return out;
  }

  /* ---------------- 投影：和 index.html 內嵌 SVG 底圖使用同一組參數 ---------------- */
  var M = D.map;
  function px(lat, lng) {
    var x = lng >= M.lngBreak ? M.xb + (lng - M.lngBreak) * M.kE : M.xb - (M.lngBreak - lng) * M.kW;
    var y = M.topPad + (M.latTop - lat) * M.kY;
    return { x: x, y: y };
  }

  /* ---------------- 距離（直線，估算） ---------------- */
  var EARTH = 6371008.8;
  function rad(d) { return d * Math.PI / 180; }
  function dist(a, b) {
    var dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
    var q = Math.pow(Math.sin(dLat / 2), 2) + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.pow(Math.sin(dLng / 2), 2);
    return 2 * EARTH * Math.asin(Math.sqrt(q));
  }
  function fmtDist(m) {
    if (m < 1000) return (Math.round(m / 10) * 10) + ' m';
    return (m / 1000).toFixed(1) + ' km';
  }
  function minutes(m) { return Math.max(1, Math.round(m / WALK)); }

  /* ---------------- 資料索引 ---------------- */
  var byId = {};
  var areaName = {};
  D.areas.forEach(function (a) { areaName[a.id] = a.name; });
  D.spots.forEach(function (sp) {
    byId[sp.id] = sp;
    var hist = sp.history.map(function (x) { return x.date + ' ' + x.text; }).join(' ');
    sp._hay = fold([sp.no, sp.id, sp.src, sp.ja, sp.zh, sp.ward, areaName[sp.area], sp.grade + '級', D.grades[sp.grade].short, sp.operator, sp.species, sp.pos, sp.limit, sp.proof, hist, '待查核'].join(' '));
    sp._px = px(sp.lat, sp.lng);
  });

  /* ---------------- 狀態 ---------------- */
  var state = {
    area: 'all', grade: 'all', q: '', official: false,
    visible: D.spots.slice(), visibleKey: D.spots.map(function (x) { return x.id; }).join(','),
    selected: null, hover: null, tabStop: null,
    route: [],
  };

  /* ---------------- localStorage（會丟例外時仍可使用） ---------------- */
  var storage = {
    ok: true,
    read: function () { try { return window.localStorage.getItem(STORE_KEY); } catch (e) { storage.ok = false; return null; } },
    write: function (v) { try { window.localStorage.setItem(STORE_KEY, v); return true; } catch (e) { storage.ok = false; return false; } },
    remove: function () { try { window.localStorage.removeItem(STORE_KEY); return true; } catch (e) { storage.ok = false; return false; } },
  };
  function loadRoute() {
    var raw = storage.read();
    if (!raw) return [];
    try {
      var obj = JSON.parse(raw);
      var ids = (obj && obj.ids) || [];
      var seen = {}, out = [];
      ids.forEach(function (id) { if (byId[id] && !seen[id] && out.length < MAX_STOPS) { seen[id] = 1; out.push(id); } });
      return out;
    } catch (e) { return []; }
  }
  function saveRoute() {
    if (!state.route.length) storage.remove();
    else storage.write(JSON.stringify({ v: 1, ids: state.route }));
    $('#storage-note').hidden = storage.ok;
  }

  /* ---------------- 訊息提示（地圖上的短訊息） ---------------- */
  var flashTimer = null;
  function flash(msg) {
    var box = $('#map-flash');
    box.textContent = msg;
    box.hidden = false;
    clearTimeout(flashTimer);
    flashTimer = setTimeout(function () { box.hidden = true; }, 4200);
  }

  /* =====================================================================
     01 季節：六階段物候指引
     ===================================================================== */
  function lum(hex) {
    var n = parseInt(hex.slice(1), 16);
    var c = [n >> 16 & 255, n >> 8 & 255, n & 255].map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  function inkOn(hex) {
    var l = lum(hex);
    var dark = (l + 0.05) / (lum('#0f1d12') + 0.05), light = 1.05 / (l + 0.05);
    return dark >= light ? '#0f1d12' : '#ffffff';
  }

  function renderSeason() {
    var days = D.stages.reduce(function (n, st) { return n + st.days; }, 0);
    var cal = $('#calendar');
    var before4 = D.stages[0].days + D.stages[1].days + D.stages[2].days;
    var before6 = before4 + D.stages[3].days + D.stages[4].days;

    var flags = h('div', { 'class': 'cal-flags', 'aria-hidden': 'true' }, [
      h('div', { 'class': 'cal-flag is-low', style: 'left:' + (before4 / days * 100) + '%' }, [h('b', { text: D.jma.yellowNormal }), '黃葉日 平年值']),
      h('div', { 'class': 'cal-flag is-high', style: 'left:' + (before6 / days * 100) + '%' }, [h('b', { text: D.jma.fallNormal }), '落葉日 平年值']),
    ]);
    var axis = h('div', { 'class': 'cal-axis', role: 'img', 'aria-label': '十月二十日到十二月十二日的時間軸，依序是：' + D.stages.map(function (st) { return st.name + ' ' + st.range; }).join('、') });
    D.stages.forEach(function (st) {
      axis.appendChild(h('div', { 'class': 'cal-seg', style: 'flex:' + st.days + ' 1 0;background:' + st.color + ';color:' + inkOn(st.color) }, [String(st.no)]));
    });
    var ruler = h('div', { 'class': 'cal-ruler', 'aria-hidden': 'true' });
    for (var d = 0; d <= days; d++) {
      var cls = d === 12 || d === 42 ? 'mo' : (d % 7 === 0 ? 'wk' : '');
      ruler.appendChild(h('i', { 'class': cls, style: 'left:' + (d / days * 100) + '%' }));
    }
    [['10/20', 0, 'at-start'], ['11/1', 12, ''], ['12/1', 42, ''], ['12/12', days, 'at-end']].forEach(function (t) {
      ruler.appendChild(h('span', { 'class': t[2], style: t[2] === 'at-start' ? '' : 'left:' + (t[1] / days * 100) + '%', text: t[0] }));
    });
    cal.appendChild(flags);
    cal.appendChild(axis);
    cal.appendChild(ruler);
    cal.appendChild(h('figcaption', { 'class': 'cal-cap', id: 'cal-cap', text: '橫軸是 10/20 到 12/12，色塊寬度對應各階段的天數（示意參數）。數字對應下方的六個階段。' }));

    var list = $('#stage-list');
    D.stages.forEach(function (st) {
      var name = h('span', { 'class': 'st-name' }, [st.name]);
      if (st.jp !== st.name) name.appendChild(h('small', { text: st.jp }));
      list.appendChild(h('li', { style: '--c:' + st.color }, [
        h('span', { 'class': 'st-no', text: String(st.no) }),
        name,
        h('span', { 'class': 'st-range', text: st.range }),
        h('span', { 'class': 'st-text', text: st.text }),
      ]));
    });

    var note = $('#season-note');
    note.appendChild(h('p', { text: '這六個階段的日期是依氣象廳東京觀測站的平年值（' + D.jma.period + '）推估的示意參數：「最佳觀賞」從黃葉日的平年值 ' + D.jma.yellowNormal + ' 開始，「落葉」從落葉日的平年值 ' + D.jma.fallNormal + ' 開始；其餘的分界只是示意。它們是推估，不是任何景點的觀測。' }));
    note.appendChild(h('p', { 'class': 'est', text: '實際年份會前後差約一週：東京的黃葉日在 ' + D.jma.recentYellow.map(function (r) { return r[0] + ' 年是 ' + r[1]; }).join('、') + '；2026 年截至 2026-10-02 還沒有觀測值。氣象廳標本木的日期，也不能當作每一處公園的最佳觀賞日。' }));
    note.appendChild(h('p', { text: '氣象廳的「黃葉日」是標本木整體大部分葉片轉黃的第一天，「落葉日」是約 80% 的葉片掉落的第一天。' }));
    note.appendChild(h('div', { 'class': 'jma-links' }, [
      extLink(D.jma.yellowUrl, '氣象廳：いちょうの黄葉日'),
      extLink(D.jma.fallUrl, '氣象廳：いちょうの落葉日'),
    ]));
  }

  /* =====================================================================
     02 篩選
     ===================================================================== */
  function fillFilters() {
    var fa = $('#f-area'), fg = $('#f-grade');
    fa.appendChild(h('option', { value: 'all', text: '全部地區（' + TOTAL + '）' }));
    D.areas.forEach(function (a) {
      var n = D.spots.filter(function (x) { return x.area === a.id; }).length;
      fa.appendChild(h('option', { value: a.id, text: a.name + '（' + n + '）' }));
    });
    fg.appendChild(h('option', { value: 'all', text: '全部等級（' + TOTAL + '）' }));
    ['S', 'A', 'B', 'C'].forEach(function (g) {
      var n = D.spots.filter(function (x) { return x.grade === g; }).length;
      fg.appendChild(h('option', { value: g, text: g + '｜' + D.grades[g].short + '（' + n + '）' }));
    });
  }

  function renderLegend() {
    var box = $('#legend-body');
    ['S', 'A', 'B', 'C', 'O', 'T', 'X'].forEach(function (g) {
      var info = D.grades[g];
      var inList = info.official && D.spots.some(function (x) { return x.grade === g; });
      box.appendChild(h('div', { 'class': 'grade-row' + (inList ? '' : ' is-src') }, [
        h('span', { 'class': 'g', text: g }),
        h('span', { 'class': 'n', text: info.short }),
        h('span', { 'class': 'd', text: info.desc + (inList ? '' : '（只出現在頁尾來源區，不在地圖與名單中）') }),
      ]));
    });
    box.appendChild(h('p', { 'class': 'fine', text: '「只看官方證據」＝證據等級 S、A、B、C。證據等級說的是資料來源的性質，不是葉況好壞，也不代表某處此刻的狀態。' }));
    var key = h('div', { 'class': 'legend-key' });
    key.appendChild(h('span', {}, [
      (function () { var v = s('svg', { viewBox: '0 0 14 14', width: '16', height: '16', 'aria-hidden': 'true' }); v.appendChild(s('circle', { cx: 7, cy: 7, r: 5, 'class': 'key-solid' })); return v; })(),
      '實心：S、A（官方名單或附日期的現地紀錄）']));
    key.appendChild(h('span', {}, [
      (function () { var v = s('svg', { viewBox: '0 0 14 14', width: '16', height: '16', 'aria-hidden': 'true' }); v.appendChild(s('circle', { cx: 7, cy: 7, r: 4.2, 'class': 'key-ring' })); return v; })(),
      '空心：B、C（官方網站，尚無附日期的銀杏觀測）']));
    key.appendChild(h('span', { text: '金色圓點：已選取，或已加入路線（內有順序）' }));
    key.appendChild(h('span', { text: '金色虛線：你的路線（直線連接，不是步行路徑）' }));
    box.appendChild(key);
  }

  /* =====================================================================
     景點名單
     ===================================================================== */
  var cardEls = {};
  function histItem(it) {
    var li = h('li', {}, [h('span', { 'class': 'd', text: it.date }), it.text]);
    if (it.past) li.appendChild(h('span', { 'class': 'past', text: '（過往季節，非本季現況）' }));
    li.appendChild(h('br'));
    li.appendChild(extLink(it.url, '看原文', '看原文：' + it.text.slice(0, 20) + '（開新分頁）'));
    return li;
  }
  function row(dt, dd) { return [h('dt', { text: dt }), dd]; }

  function renderCards() {
    var ol = $('#spot-list');
    D.spots.forEach(function (sp) {
      var gInfo = D.grades[sp.grade];
      var title = h('h3', { 'class': 'card-title', id: 't-' + sp.id }, [
        h('button', { type: 'button', 'class': 'card-select', 'aria-pressed': 'false', 'data-id': sp.id, 'aria-label': 'No. ' + sp.no + ' ' + sp.zh + '，在地圖上標示' }, [sp.zh]),
      ]);
      var facts = h('dl', { 'class': 'facts' });
      var dates = sp.audited + '（來源表）' + (sp.rechecked ? '；' + sp.rechecked + ' 複核官方頁面' : '');
      [
        row('證據等級', h('dd', { text: sp.grade + '｜' + gInfo.short })),
        row('管理單位', h('dd', { text: sp.operator })),
        row('查核日期', h('dd', { text: dates })),
        row('本季狀態', h('dd', { 'class': 'pending' }, ['待查核', h('small', { text: '　尚無 2026 年現況' })])),
        row('限制', h('dd', { text: sp.limit })),
      ].forEach(function (pair) { pair.forEach(function (n) { facts.appendChild(n); }); });

      var more = h('details', { 'class': 'more' });
      more.appendChild(h('summary', { text: '更多依據與位置說明' }));
      var mf = h('dl', { 'class': 'facts' });
      var proofDd = h('dd', {}, [sp.proof]);
      if (sp.proofUrl) {
        proofDd.appendChild(h('br'));
        proofDd.appendChild(extLink(sp.proofUrl, '依據原文' + (sp.proofDate ? '（' + sp.proofDate + '）' : '（日期待查核）'), '依據原文：' + sp.zh + '（開新分頁）'));
      }
      var rows = [
        row('銀杏依據', proofDd),
        row('地圖位置', h('dd', { text: '園區近似位置。' + sp.pos + '座標精度：' + sp.posConfLabel + '。' })),
      ];
      if (sp.history.length) rows.push(row('官方紀錄', h('dd', {}, [h('ul', { 'class': 'hist' }, sp.history.map(histItem))])));
      if (sp.season) rows.push(row('官方一般時期', h('dd', { text: sp.season })));
      var cad = /^(銀杏更新頻率)?未確認。?$/.test(sp.cadence) ? '待查核（來源表記為「未確認」）' : sp.cadence + '（來源表）';
      var spe = /待確認/.test(sp.species) ? '銀杏（依據見上方「銀杏依據」；來源表欄位註記「' + sp.species + '」）' : sp.species + '（來源表）';
      rows.push(row('更新頻率', h('dd', { text: cad })));
      rows.push(row('樹種', h('dd', { text: spe })));
      rows.push(row('來源列', h('dd', { text: sp.src + '　目錄編號 No. ' + sp.no })));
      rows.forEach(function (pair) { pair.forEach(function (n) { mf.appendChild(n); }); });
      more.appendChild(mf);

      var osm = 'https://www.openstreetmap.org/?mlat=' + sp.lat + '&mlon=' + sp.lng + '#map=16/' + sp.lat + '/' + sp.lng;
      var actions = h('div', { 'class': 'card-actions' }, [
        extLink(sp.official, '官方連結（' + host(sp.official) + '）', '官方連結：' + sp.zh + '（開新分頁）'),
        extLink(osm, 'OSM 位置', '在 OpenStreetMap 查看 ' + sp.zh + ' 的近似位置（開新分頁）'),
        h('button', { type: 'button', 'class': 'btn btn-ghost btn-route', 'data-id': sp.id, 'aria-pressed': 'false' }, ['加入路線']),
      ]);

      var main = h('div', { 'class': 'card-main' }, [title]);
      if (sp.ja !== sp.zh) main.appendChild(h('p', { 'class': 'card-ja', lang: 'ja', text: sp.ja }));
      main.appendChild(h('p', { 'class': 'card-ja', text: sp.ward + '・' + areaName[sp.area] }));
      main.appendChild(facts);
      main.appendChild(more);
      main.appendChild(actions);

      var card = h('article', { 'class': 'card', 'aria-labelledby': 't-' + sp.id, 'data-id': sp.id }, [
        h('div', { 'class': 'card-id' }, [h('span', { 'class': 'card-no', text: sp.no }), h('span', { 'class': 'card-grade', text: sp.grade + ' 級', 'aria-hidden': 'true' })]),
        main,
      ]);
      var li = h('li', { 'class': 'entry', id: 'spot-' + sp.id, 'data-id': sp.id }, [card]);
      ol.appendChild(li);
      cardEls[sp.id] = { li: li, card: card, select: $('.card-select', card), routeBtn: $('.btn-route', card) };
    });

    ol.addEventListener('click', function (e) {
      var rb = e.target.closest('.btn-route');
      if (rb) { toggleRoute(rb.getAttribute('data-id')); return; }
      if (e.target.closest('a, summary, details')) return;
      var card = e.target.closest('.card');
      if (card) select(card.getAttribute('data-id'), { source: 'card' });
    });
    ol.addEventListener('mouseover', function (e) {
      var card = e.target.closest('.card');
      setHover(card ? card.getAttribute('data-id') : null, 'card');
    });
    ol.addEventListener('mouseleave', function () { setHover(null, 'card'); });
  }

  /* =====================================================================
     示意地圖
     ===================================================================== */
  var svg = $('#map');
  var frame = $('#map-frame');
  var layerSpots = $('#layer-spots');
  var layerRoute = $('#layer-route');
  var layerCallout = $('#layer-callout');
  var labelEls = $$('#layer-labels .lbl');
  var markerEls = {};

  var view = { fitMode: true, cw: 0, ch: 0, scale: 1, cx: M.W / 2, cy: M.H / 2, minScale: 0.1, maxScale: 6, home: { scale: 0.3, cx: 600, cy: 350 } };
  var BOUNDS = { x0: -120, y0: -140, x1: M.W + 120, y1: M.H + 140 };
  var PAD = { l: 30, r: 66, t: 46, b: 62 };

  function clampView() {
    var vw = view.cw / view.scale, vh = view.ch / view.scale;
    var minX = BOUNDS.x0 + vw / 2, maxX = BOUNDS.x1 - vw / 2;
    var minY = BOUNDS.y0 + vh / 2, maxY = BOUNDS.y1 - vh / 2;
    view.cx = minX > maxX ? (BOUNDS.x0 + BOUNDS.x1) / 2 : Math.max(minX, Math.min(maxX, view.cx));
    view.cy = minY > maxY ? (BOUNDS.y0 + BOUNDS.y1) / 2 : Math.max(minY, Math.min(maxY, view.cy));
  }
  function zoomLevel() { return view.scale / view.home.scale; }

  function buildMarkers() {
    D.spots.forEach(function (sp) {
      var isRing = sp.grade === 'B' || sp.grade === 'C';
      var g = s('g', {
        'class': 'spot' + (isRing ? ' is-ring' : ''), 'data-id': sp.id, role: 'button', tabindex: '-1', 'aria-pressed': 'false',
        'aria-label': 'No. ' + sp.no + ' ' + sp.zh + '，證據等級 ' + sp.grade + '，本季狀態待查核',
      }, [
        s('circle', { 'class': 'hit', r: 22.5 }),
        s('circle', { 'class': 'ring', r: 13 }),
        s('circle', { 'class': 'focus', r: 17 }),
        s('circle', { 'class': 'dot', r: 6.5 }),
        s('text', { 'class': 'rnum', x: 0, y: 0 }),
        s('text', { 'class': 'tag', x: 10, y: 4 }),
      ]);
      $('.tag', g).textContent = sp.no;
      layerSpots.appendChild(g);
      markerEls[sp.id] = g;
    });
  }

  function applyView() {
    if (!view.cw || !view.ch) return;
    clampView();
    var vw = view.cw / view.scale, vh = view.ch / view.scale;
    svg.setAttribute('viewBox', [view.cx - vw / 2, view.cy - vh / 2, vw, vh].map(function (n) { return Math.round(n * 100) / 100; }).join(' '));
    var inv = 1 / view.scale, z = zoomLevel();
    D.spots.forEach(function (sp) {
      markerEls[sp.id].setAttribute('transform', 'translate(' + sp._px.x.toFixed(2) + ' ' + sp._px.y.toFixed(2) + ') scale(' + inv.toFixed(5) + ')');
    });
    labelEls.forEach(function (t) {
      var lz = parseFloat(t.getAttribute('data-z')) || 0;
      t.setAttribute('transform', 'translate(' + t.getAttribute('data-x') + ' ' + t.getAttribute('data-y') + ') scale(' + inv.toFixed(5) + ')');
      t.classList.toggle('is-off', z < lz);
    });
    svg.classList.toggle('show-tags', z >= 3.4);
    drawCallout();
  }

  function setView(v) {
    view.scale = Math.max(view.minScale, Math.min(view.maxScale, v.scale));
    view.cx = v.cx; view.cy = v.cy;
    applyView();
  }

  var anim = null;
  function animateTo(target, ms) {
    if (anim) { cancelAnimationFrame(anim); anim = null; }
    var to = { scale: Math.max(view.minScale, Math.min(view.maxScale, target.scale)), cx: target.cx, cy: target.cy };
    if (reduceMotion || !ms) { setView(to); return; }
    var from = { scale: view.scale, cx: view.cx, cy: view.cy };
    var t0 = null;
    function step(t) {
      if (t0 === null) t0 = t;
      var k = Math.min(1, (t - t0) / ms);
      var e = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      setView({ scale: Math.exp(Math.log(from.scale) + (Math.log(to.scale) - Math.log(from.scale)) * e), cx: from.cx + (to.cx - from.cx) * e, cy: from.cy + (to.cy - from.cy) * e });
      if (k < 1) anim = requestAnimationFrame(step); else anim = null;
    }
    anim = requestAnimationFrame(step);
  }

  function fitBox(box, minSpan) {
    var span = minSpan || 150;
    var w = Math.max(box.x1 - box.x0, span), hh = Math.max(box.y1 - box.y0, span * 0.6);
    var availW = Math.max(60, view.cw - PAD.l - PAD.r), availH = Math.max(60, view.ch - PAD.t - PAD.b);
    var sc = Math.min(availW / w, availH / hh);
    sc = Math.max(view.minScale, Math.min(view.maxScale, sc));
    var bcx = (box.x0 + box.x1) / 2, bcy = (box.y0 + box.y1) / 2;
    var offX = ((PAD.l + view.cw - PAD.r) / 2 - view.cw / 2) / sc;
    var offY = ((PAD.t + view.ch - PAD.b) / 2 - view.ch / 2) / sc;
    return { scale: sc, cx: bcx - offX, cy: bcy - offY };
  }
  function boxOf(spots) {
    var b = { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 };
    spots.forEach(function (sp) { b.x0 = Math.min(b.x0, sp._px.x); b.y0 = Math.min(b.y0, sp._px.y); b.x1 = Math.max(b.x1, sp._px.x); b.y1 = Math.max(b.y1, sp._px.y); });
    return b;
  }
  function computeHome() {
    view.minScale = 0.01; view.maxScale = 60;              // 先不套用舊的縮放上下限，再依新容器大小重算
    var f = fitBox(boxOf(D.spots), 150);
    view.home = f;
    view.minScale = f.scale * 0.8;
    view.maxScale = Math.max(f.scale * 2, 6);
  }
  function fitVisible(ms) {
    if (!state.visible.length) return;
    if (state.visible.length === TOTAL) animateTo(view.home, ms);
    else animateTo(fitBox(boxOf(state.visible), 170), ms);
    view.fitMode = true;                                   // 這個取景會在視窗大小改變時重新計算
  }

  function zoomAt(sx, sy, factor, ms) {
    view.fitMode = false;
    var target = Math.max(view.minScale, Math.min(view.maxScale, view.scale * factor));
    var wx = view.cx + (sx - view.cw / 2) / view.scale, wy = view.cy + (sy - view.ch / 2) / view.scale;
    var ncx = wx - (sx - view.cw / 2) / target, ncy = wy - (sy - view.ch / 2) / target;
    if (ms) animateTo({ scale: target, cx: ncx, cy: ncy }, ms); else setView({ scale: target, cx: ncx, cy: ncy });
  }
  function panByPx(dx, dy) {
    view.fitMode = false;
    view.cx -= dx / view.scale; view.cy -= dy / view.scale;
    applyView();
  }
  function screenOf(sp) {
    return { x: (sp._px.x - view.cx) * view.scale + view.cw / 2, y: (sp._px.y - view.cy) * view.scale + view.ch / 2 };
  }
  function ensureVisible(sp) {
    var p = screenOf(sp);
    var mx = 56, my = 56;
    if (p.x < mx || p.x > view.cw - mx - 20 || p.y < my || p.y > view.ch - my) {
      view.fitMode = false;
      animateTo({ scale: view.scale, cx: sp._px.x, cy: sp._px.y }, 380);
    }
  }

  /* --- 選取用的名牌（畫在最上層，不會擋住標記的點擊） --- */
  var calloutCache = {};
  function drawCallout() {
    layerCallout.textContent = '';
    var id = state.hover || state.selected;
    if (!id || !byId[id]) return;
    var sp = byId[id];
    if (markerEls[id].classList.contains('is-hidden')) return;
    var inv = 1 / view.scale;
    var p = screenOf(sp);
    var g = s('g', { 'class': 'callout', transform: 'translate(' + sp._px.x.toFixed(2) + ' ' + sp._px.y.toFixed(2) + ') scale(' + inv.toFixed(5) + ')' });
    var inRoute = state.route.indexOf(id) >= 0;
    g.appendChild(s('circle', { r: 14, fill: 'none', stroke: '#86590a', 'stroke-width': 2.4 }));
    if (!inRoute) g.appendChild(s('circle', { r: 7.5, fill: '#e0a21b', stroke: '#1d3326', 'stroke-width': 2.2 }));
    var label = s('text', { x: 0, y: 0 });
    var num = s('tspan', { 'class': 'cn' }); num.textContent = sp.no + '  ';
    var nm = s('tspan', {}); nm.textContent = sp.zh.replace(/（.*$/, '');
    label.appendChild(num); label.appendChild(nm);
    var cached = calloutCache[id];
    var holder = s('g', {}); holder.appendChild(label); g.appendChild(holder);
    layerCallout.appendChild(g);
    var tw = cached ? cached.w : label.getComputedTextLength();
    if (!cached) calloutCache[id] = { w: tw };
    var bw = tw + 16, bh = 26;
    var right = p.x + 18 + bw < view.cw - 8;
    var below = p.y - 18 - bh < 6;
    var bx = right ? 18 : -18 - bw, by = below ? 16 : -16 - bh;
    var rect = s('rect', { x: bx, y: by, width: bw, height: bh, rx: 2 });
    label.setAttribute('x', bx + 8); label.setAttribute('y', by + 17.5);
    holder.insertBefore(rect, label);
  }

  /* --- 路線圖層 --- */
  function drawRoute() {
    layerRoute.textContent = '';
    var spots = state.route.map(function (id) { return byId[id]; });
    D.spots.forEach(function (sp) {
      var g = markerEls[sp.id];
      var idx = state.route.indexOf(sp.id);
      g.classList.toggle('in-route', idx >= 0);
      var dot = $('.dot', g);
      dot.setAttribute('r', idx >= 0 ? 10 : 6.5);
      $('.rnum', g).textContent = idx >= 0 ? String(idx + 1) : '';
    });
    if (spots.length >= 2) {
      var d = spots.map(function (sp, i) { return (i ? 'L' : 'M') + sp._px.x.toFixed(1) + ' ' + sp._px.y.toFixed(1); }).join('');
      layerRoute.appendChild(s('path', { 'class': 'route-line-halo', d: d, 'vector-effect': 'non-scaling-stroke' }));
      layerRoute.appendChild(s('path', { 'class': 'route-line', d: d, 'vector-effect': 'non-scaling-stroke' }));
    }
    drawCallout();
  }

  /* --- 平移、縮放、雙指縮放 --- */
  var pointers = {};
  var dragMoved = false;
  var pinchPrev = null;
  function ptrCount() { return Object.keys(pointers).length; }
  function pinchNow() {
    var ids = Object.keys(pointers);
    var a = pointers[ids[0]], b = pointers[ids[1]];
    var r = svg.getBoundingClientRect();
    return { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, x: (a.x + b.x) / 2 - r.left, y: (a.y + b.y) / 2 - r.top };
  }
  svg.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    pointers[e.pointerId] = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY };
    if (anim) { cancelAnimationFrame(anim); anim = null; }
    dragMoved = false;
    if (ptrCount() === 2) pinchPrev = pinchNow();
  });
  svg.addEventListener('pointermove', function (e) {
    var p = pointers[e.pointerId];
    if (!p) return;
    if (ptrCount() === 1) {
      if (!dragMoved && Math.hypot(e.clientX - p.sx, e.clientY - p.sy) > 5) {
        dragMoved = true; svg.classList.add('is-dragging');
        try { svg.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      }
      if (dragMoved) panByPx(e.clientX - p.x, e.clientY - p.y);
      p.x = e.clientX; p.y = e.clientY;
    } else if (ptrCount() === 2) {
      p.x = e.clientX; p.y = e.clientY;
      var now = pinchNow();
      if (pinchPrev) {
        dragMoved = true;
        zoomAt(now.x, now.y, now.d / pinchPrev.d, 0);
        panByPx(now.x - pinchPrev.x, now.y - pinchPrev.y);
      }
      pinchPrev = now;
    }
  });
  function endPointer(e) {
    delete pointers[e.pointerId];
    if (ptrCount() < 2) pinchPrev = null;
    if (ptrCount() === 0) { svg.classList.remove('is-dragging'); setTimeout(function () { dragMoved = false; }, 0); }
  }
  svg.addEventListener('pointerup', endPointer);
  svg.addEventListener('pointercancel', endPointer);
  svg.addEventListener('wheel', function (e) {
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    var r = svg.getBoundingClientRect();
    zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0022), 0);
  }, { passive: false });

  $('#z-in').addEventListener('click', function () { zoomAt(view.cw / 2, view.ch / 2, 1.6, 260); });
  $('#z-out').addEventListener('click', function () { zoomAt(view.cw / 2, view.ch / 2, 1 / 1.6, 260); });
  $('#z-fit').addEventListener('click', function () { fitVisible(380); });

  /* --- 標記的點擊、滑過、鍵盤 --- */
  // 標記的點擊區是 44px 的圓，密集處會互相重疊，所以用「離點擊位置最近的標記」來判斷點到誰
  function nearestSpot(clientX, clientY, maxD) {
    var r = svg.getBoundingClientRect(), best = null, bd = maxD;
    state.visible.forEach(function (sp) {
      var p = screenOf(sp);
      var d = Math.hypot(p.x + r.left - clientX, p.y + r.top - clientY);
      if (d <= bd) { bd = d; best = sp; }
    });
    return best;
  }
  layerSpots.addEventListener('click', function (e) {
    if (dragMoved) return;
    var sp = null;
    if (e.detail === 0 || (e.clientX === 0 && e.clientY === 0)) {
      var g = e.target.closest('.spot');
      sp = g ? byId[g.getAttribute('data-id')] : null;       // 鍵盤或輔助科技觸發
    } else {
      sp = nearestSpot(e.clientX, e.clientY, 24);
    }
    if (sp) { setTabStop(sp.id); select(sp.id, { source: 'map' }); }
  });
  layerSpots.addEventListener('pointermove', function (e) {
    if (e.pointerType !== 'mouse' || ptrCount() > 0) return;
    var sp = nearestSpot(e.clientX, e.clientY, 24);
    setHover(sp ? sp.id : null, 'map');
  });
  layerSpots.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') setHover(null, 'map'); });
  frame.addEventListener('focusin', function (e) {
    var g = e.target.closest('.spot');
    if (g) { setTabStop(g.getAttribute('data-id')); setHover(g.getAttribute('data-id'), 'map'); }
  });
  frame.addEventListener('focusout', function () { setHover(null, 'map'); });
  layerSpots.addEventListener('keydown', function (e) {
    var g = e.target.closest('.spot');
    if (!g) return;
    var id = g.getAttribute('data-id');
    var ids = state.visible.map(function (x) { return x.id; });
    var i = ids.indexOf(id);
    var key = e.key;
    if (e.shiftKey && /^Arrow/.test(key)) {
      e.preventDefault();
      var step = 90;
      panByPx(key === 'ArrowLeft' ? step : key === 'ArrowRight' ? -step : 0, key === 'ArrowUp' ? step : key === 'ArrowDown' ? -step : 0);
      return;
    }
    if (key === 'Enter' || key === ' ') { e.preventDefault(); select(id, { source: 'map' }); return; }
    if (key === 'Escape') { deselect(); return; }
    if (key === '+' || key === '=') { e.preventDefault(); zoomAt(view.cw / 2, view.ch / 2, 1.6, 260); return; }
    if (key === '-' || key === '_') { e.preventDefault(); zoomAt(view.cw / 2, view.ch / 2, 1 / 1.6, 260); return; }
    if (key === '0') { e.preventDefault(); fitVisible(380); return; }
    var n = null;
    if (key === 'ArrowRight' || key === 'ArrowDown') n = ids[(i + 1) % ids.length];
    else if (key === 'ArrowLeft' || key === 'ArrowUp') n = ids[(i - 1 + ids.length) % ids.length];
    else if (key === 'Home') n = ids[0];
    else if (key === 'End') n = ids[ids.length - 1];
    if (n) { e.preventDefault(); setTabStop(n); markerEls[n].focus(); ensureVisible(byId[n]); }
  });

  function setTabStop(id) {
    state.tabStop = id;
    D.spots.forEach(function (sp) { markerEls[sp.id].setAttribute('tabindex', sp.id === id ? '0' : '-1'); });
  }
  function fixTabStop() {
    var ok = state.tabStop && state.visible.some(function (x) { return x.id === state.tabStop; });
    if (!ok) setTabStop(state.visible.length ? (state.selected && byId[state.selected] && state.visible.indexOf(byId[state.selected]) >= 0 ? state.selected : state.visible[0].id) : null);
  }

  /* =====================================================================
     選取與同步（地圖 ↔ 名單）
     ===================================================================== */
  function setHover(id, from) {
    if (state.hover === id) return;
    if (state.hover && cardEls[state.hover]) cardEls[state.hover].card.classList.remove('is-hover');
    if (state.hover && markerEls[state.hover]) markerEls[state.hover].classList.remove('is-hover');
    state.hover = id;
    if (id) {
      if (from === 'map' && cardEls[id]) cardEls[id].card.classList.add('is-hover');
      if (from === 'card' && markerEls[id]) markerEls[id].classList.add('is-hover');
    }
    drawCallout();
  }

  function isTwoPane() { return window.matchMedia('(min-width: 900px)').matches; }

  function scrollToCard(id) {
    var li = cardEls[id] && cardEls[id].li;
    if (!li || li.hidden) return;
    var smooth = reduceMotion ? 'auto' : 'smooth';
    if (isTwoPane()) {
      var pane = $('#list-pane');
      var pr = pane.getBoundingClientRect(), lr = li.getBoundingClientRect();
      pane.scrollTo({ top: pane.scrollTop + (lr.top - pr.top) - 6, behavior: smooth });
      // 若整個區塊還不在畫面內，也把區塊帶進來
      var grid = $('#explore-grid').getBoundingClientRect();
      if (grid.top < 0 || grid.bottom > window.innerHeight + 40) {
        var head = document.querySelector('.site-head').getBoundingClientRect().height;
        window.scrollTo({ top: window.scrollY + grid.top - head - 12, behavior: smooth });
      }
    } else {
      var mp = $('#map-pane').getBoundingClientRect().height;
      var y = li.getBoundingClientRect().top + window.scrollY - mp - 6;
      window.scrollTo({ top: Math.max(0, y), behavior: smooth });
    }
  }

  function select(id, opts) {
    opts = opts || {};
    if (!byId[id]) return;
    var prev = state.selected;
    if (prev && prev !== id) {
      markerEls[prev].classList.remove('is-active'); markerEls[prev].setAttribute('aria-pressed', 'false');
      cardEls[prev].card.classList.remove('is-active'); cardEls[prev].select.setAttribute('aria-pressed', 'false');
      cardEls[prev].card.removeAttribute('aria-current');
    }
    state.selected = id;
    markerEls[id].classList.add('is-active'); markerEls[id].setAttribute('aria-pressed', 'true');
    cardEls[id].card.classList.add('is-active'); cardEls[id].select.setAttribute('aria-pressed', 'true');
    cardEls[id].card.setAttribute('aria-current', 'true');
    setTabStop(id);
    drawCallout();
    if (opts.source === 'map' || opts.source === 'proposal') scrollToCard(id);
    if (opts.source === 'card' || opts.source === 'proposal') ensureVisible(byId[id]);
  }
  function deselect() {
    var id = state.selected;
    if (!id) return;
    markerEls[id].classList.remove('is-active'); markerEls[id].setAttribute('aria-pressed', 'false');
    cardEls[id].card.classList.remove('is-active'); cardEls[id].select.setAttribute('aria-pressed', 'false');
    cardEls[id].card.removeAttribute('aria-current');
    state.selected = null;
    drawCallout();
  }

  /* =====================================================================
     篩選
     ===================================================================== */
  function applyFilters(opts) {
    opts = opts || {};
    var tokens = fold(state.q.trim()).split(/\s+/).filter(Boolean);
    var vis = D.spots.filter(function (sp) {
      if (state.area !== 'all' && sp.area !== state.area) return false;
      if (state.grade !== 'all' && sp.grade !== state.grade) return false;
      if (state.official && !D.grades[sp.grade].official) return false;
      for (var i = 0; i < tokens.length; i++) if (sp._hay.indexOf(tokens[i]) < 0) return false;
      return true;
    });
    var key = vis.map(function (x) { return x.id; }).join(',');
    var changed = key !== state.visibleKey;
    state.visible = vis; state.visibleKey = key;
    var set = {}; vis.forEach(function (x) { set[x.id] = 1; });
    D.spots.forEach(function (sp) {
      var on = !!set[sp.id];
      cardEls[sp.id].li.hidden = !on;
      markerEls[sp.id].classList.toggle('is-hidden', !on);
    });
    if (state.selected && !set[state.selected]) deselect();
    if (state.hover && !set[state.hover]) setHover(null, 'card');
    fixTabStop();

    var n = vis.length;
    var rc = $('#result-count');
    rc.textContent = '';
    rc.appendChild(document.createTextNode('目前顯示 '));
    rc.appendChild(h('b', { text: String(n) }));
    rc.appendChild(document.createTextNode('／' + TOTAL + ' 處（地圖標記 ' + n + '，名單 ' + n + '，兩邊數量一致）'));
    $('#official-note').hidden = !state.official;
    if (state.official) $('#official-note').textContent = '「官方證據」＝證據等級 S、A、B、C。名單裡的 ' + TOTAL + ' 處景點全部符合，所以這個開關不會減少景點；第三方（T）、氣象站（O）與失效（X）的來源只列在頁尾來源區。';

    var empty = n === 0;
    $('#empty-state').hidden = !empty;
    $('#map-empty').hidden = !empty;
    if (empty) {
      var parts = [];
      if (state.area !== 'all') parts.push('地區＝' + areaName[state.area]);
      if (state.grade !== 'all') parts.push('證據等級＝' + state.grade);
      if (state.official) parts.push('只看官方證據');
      if (state.q.trim()) parts.push('關鍵字＝「' + state.q.trim() + '」');
      $('#empty-text').textContent = '沒有景點同時符合：' + parts.join('、') + '。換個關鍵字，或放寬地區與證據等級試試看。';
    }
    if (changed && opts.fit !== false) fitVisible(420);
    else if (opts.fit === 'force') fitVisible(420);
    if (changed) { var lp = $('#list-pane'); if (lp && isTwoPane()) lp.scrollTop = 0; }
  }

  function clearFilters() {
    state.area = 'all'; state.grade = 'all'; state.q = ''; state.official = false;
    $('#f-area').value = 'all'; $('#f-grade').value = 'all'; $('#f-q').value = ''; $('#f-official').checked = false;
    applyFilters({ fit: 'force' });
  }

  function bindFilters() {
    $('#f-area').addEventListener('change', function (e) { state.area = e.target.value; applyFilters(); });
    $('#f-grade').addEventListener('change', function (e) { state.grade = e.target.value; applyFilters(); });
    $('#f-q').addEventListener('input', function (e) { state.q = e.target.value; applyFilters(); });
    $('#f-official').addEventListener('change', function (e) { state.official = e.target.checked; applyFilters(); });
    $('#f-clear').addEventListener('click', clearFilters);
    $('#empty-clear').addEventListener('click', clearFilters);
    $('#filters').addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.id === 'f-q') e.preventDefault(); });
  }

  /* =====================================================================
     03 路線
     ===================================================================== */
  function nearestOrder(ids) {
    if (ids.length < 3) return ids.slice();
    var left = ids.slice(1), out = [ids[0]];
    while (left.length) {
      var cur = byId[out[out.length - 1]], best = 0, bd = Infinity;
      for (var i = 0; i < left.length; i++) {
        var dd = dist(cur, byId[left[i]]);
        if (dd < bd - 1e-6) { bd = dd; best = i; }
      }
      out.push(left.splice(best, 1)[0]);
    }
    return out;
  }
  function gmapsUrl(spots) {
    var ll = function (x) { return x.lat + ',' + x.lng; };
    var u = 'https://www.google.com/maps/dir/?api=1&origin=' + encodeURIComponent(ll(spots[0])) + '&destination=' + encodeURIComponent(ll(spots[spots.length - 1])) + '&travelmode=walking';
    if (spots.length > 2) u += '&waypoints=' + encodeURIComponent(spots.slice(1, -1).map(ll).join('|'));
    return u;
  }

  function toggleRoute(id) {
    var i = state.route.indexOf(id);
    if (i >= 0) { removeStop(id); return; }
    if (state.route.length >= MAX_STOPS) {
      flash('路線最多 ' + MAX_STOPS + ' 處，請先移除一處再加入「' + byId[id].zh + '」。');
      return;
    }
    state.route.push(id);
    state.route = nearestOrder(state.route);
    saveRoute(); renderRoute();
    flash('已加入「' + byId[id].zh + '」，目前 ' + state.route.length + '／' + MAX_STOPS + ' 處' + (state.route.length >= MIN_STOPS ? '，已依鄰近程度排序。' : '，再選 1 處就能算距離。'));
  }
  function removeStop(id) {
    var i = state.route.indexOf(id);
    if (i < 0) return;
    state.route.splice(i, 1);
    state.route = nearestOrder(state.route);
    saveRoute(); renderRoute();
    flash('已移除「' + byId[id].zh + '」，目前 ' + state.route.length + '／' + MAX_STOPS + ' 處。');
  }
  function moveStop(id, dir) {
    var i = state.route.indexOf(id), j = i + dir;
    if (i < 0 || j < 0 || j >= state.route.length) return;
    var t = state.route[i]; state.route[i] = state.route[j]; state.route[j] = t;
    saveRoute(); renderRoute({ focus: id, dir: dir });
  }
  function clearRoute() {
    if (!state.route.length) { flash('路線本來就是空的。'); return; }
    state.route = [];
    saveRoute(); renderRoute();
    flash('已清空路線。');
  }

  function renderRoute(opts) {
    opts = opts || {};
    var n = state.route.length;
    var spots = state.route.map(function (id) { return byId[id]; });
    var cnt = $('#route-count');
    cnt.textContent = '';
    cnt.appendChild(document.createTextNode('已選 '));
    cnt.appendChild(h('b', { text: String(n) }));
    cnt.appendChild(document.createTextNode('／' + MAX_STOPS + ' 處（至少 ' + MIN_STOPS + ' 處才能規劃）'));

    var list = $('#route-list');
    list.textContent = '';
    var legs = [], totalM = 0, totalMin = 0;
    for (var i = 0; i < n - 1; i++) {
      var m = dist(spots[i], spots[i + 1]);
      legs.push(m); totalM += m; totalMin += minutes(m);
    }
    spots.forEach(function (sp, i) {
      var li = h('li', { 'data-id': sp.id });
      var nm = h('span', { 'class': 'stop-name' }, [sp.zh]);
      nm.appendChild(h('small', { text: 'No. ' + sp.no + '・' + sp.ward + '・園區近似位置' }));
      var btns = h('div', { 'class': 'stop-btns' }, [
        h('button', { type: 'button', 'data-act': 'up', 'data-id': sp.id, 'aria-label': '上移：' + sp.zh, disabled: i === 0 }, ['↑ 上移']),
        h('button', { type: 'button', 'data-act': 'down', 'data-id': sp.id, 'aria-label': '下移：' + sp.zh, disabled: i === n - 1 }, ['↓ 下移']),
        h('button', { type: 'button', 'data-act': 'remove', 'data-id': sp.id, 'aria-label': '移出路線：' + sp.zh }, ['移除']),
      ]);
      li.appendChild(h('div', { 'class': 'stop' }, [h('span', { 'class': 'stop-n', text: String(i + 1), 'aria-hidden': 'true' }), nm, btns]));
      if (i < n - 1) {
        var leg = h('p', { 'class': 'leg' }, ['往下一站：直線約 ', h('b', { text: fmtDist(legs[i]) }), '（估算），步行約 ', h('b', { text: minutes(legs[i]) + ' 分' }), '（以 ' + WALK + ' m/分估算）']);
        if (legs[i] > FAR_LEG_M) leg.appendChild(h('span', { 'class': 'far', text: '這一段直線距離超過 ' + (FAR_LEG_M / 1000) + ' 公里，不適合步行，建議搭電車，或拆成不同天的散步。' }));
        li.appendChild(leg);
      }
      list.appendChild(li);
    });

    var empty = $('#route-empty');
    empty.textContent = n === 0 ? '還沒有選擇景點。到「地圖與景點名單」，對想去的景點按「加入路線」。' : (n < MIN_STOPS ? '再加入至少 ' + (MIN_STOPS - n) + ' 處，才能算出距離與步行時間。' : '');

    var sum = $('#route-sum');
    sum.textContent = '';
    function srow(t, v) { sum.appendChild(h('div', {}, [h('dt', { text: t }), v])); }
    srow('站數', h('dd', { text: n + ' 處' }));
    srow('直線距離（估算）', h('dd', {}, [n >= MIN_STOPS ? fmtDist(totalM) : '—']));
    srow('步行時間（估算）', h('dd', {}, [n >= MIN_STOPS ? '約 ' + totalMin + ' 分' : '—', h('small', { text: '　以 ' + WALK + ' m/分估算，不含停留' })]));

    var link = $('#gmaps-link');
    if (n >= MIN_STOPS) { link.href = gmapsUrl(spots); link.setAttribute('aria-disabled', 'false'); link.removeAttribute('tabindex'); }
    else { link.setAttribute('href', '#route'); link.setAttribute('aria-disabled', 'true'); }
    $('#route-resort').disabled = n < 3;
    $('#route-clear').disabled = n === 0;

    // 名單上的按鈕、地圖上的標記與路線
    D.spots.forEach(function (sp) {
      var b = cardEls[sp.id].routeBtn;
      var idx = state.route.indexOf(sp.id);
      b.setAttribute('aria-pressed', idx >= 0 ? 'true' : 'false');
      b.textContent = idx >= 0 ? '已加入第 ' + (idx + 1) + ' 站・移除' : '加入路線';
      b.setAttribute('aria-label', (idx >= 0 ? '從路線移除：' : '加入路線：') + sp.zh);
      b.setAttribute('aria-disabled', idx < 0 && n >= MAX_STOPS ? 'true' : 'false');
      markerEls[sp.id].setAttribute('aria-label', 'No. ' + sp.no + ' ' + sp.zh + '，證據等級 ' + sp.grade + '，本季狀態待查核' + (idx >= 0 ? '，路線第 ' + (idx + 1) + ' 站' : ''));
    });
    var pill = $('#route-pill');
    pill.textContent = '路線 ' + n + '／' + MAX_STOPS;
    pill.classList.toggle('has-route', n > 0);
    drawRoute();
    $('#storage-note').hidden = storage.ok;
    if (opts.focus) {
      var sel = '#route-list button[data-act="' + (opts.dir < 0 ? 'up' : 'down') + '"][data-id="' + opts.focus + '"]';
      var btn = $(sel) || $('#route-list button[data-act="' + (opts.dir < 0 ? 'down' : 'up') + '"][data-id="' + opts.focus + '"]');
      if (btn && !btn.disabled) btn.focus();
      else { var any = $('#route-list li[data-id="' + opts.focus + '"] button:not(:disabled)'); if (any) any.focus(); }
    }
  }

  function bindRoute() {
    $('#route-list').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-act]');
      if (!b) return;
      var id = b.getAttribute('data-id'), act = b.getAttribute('data-act');
      if (act === 'up') moveStop(id, -1);
      else if (act === 'down') moveStop(id, 1);
      else if (act === 'remove') removeStop(id);
    });
    $('#route-clear').addEventListener('click', clearRoute);
    $('#route-resort').addEventListener('click', function () {
      state.route = nearestOrder(state.route); saveRoute(); renderRoute();
      flash('已從第一站開始，重新依鄰近程度排序。');
    });
    $('#gmaps-link').addEventListener('click', function (e) {
      if (this.getAttribute('aria-disabled') === 'true') { e.preventDefault(); flash('先選好 ' + MIN_STOPS + ' 到 ' + MAX_STOPS + ' 處景點，才能開啟 Google 地圖的步行路線。'); }
    });
  }

  /* =====================================================================
     04 五條同區域散步提案
     ===================================================================== */
  function focusSpot(id) {
    var sp = byId[id];
    if (state.visible.indexOf(sp) < 0) clearFilters();
    select(id, { source: 'proposal' });
    if (isTwoPane()) {
      var grid = $('#explore-grid').getBoundingClientRect();
      var head = document.querySelector('.site-head').getBoundingClientRect().height;
      window.scrollTo({ top: window.scrollY + grid.top - head - 12, behavior: reduceMotion ? 'auto' : 'smooth' });
    }
  }
  function applyProposal(p) {
    var had = state.route.length;
    state.route = p.stops.slice();
    saveRoute(); renderRoute();
    flash('已把「' + p.name + '」套用到我的路線' + (had ? '（取代原本的 ' + had + ' 處）' : '') + '。');
    var sec = $('#route').getBoundingClientRect();
    var headEl = document.querySelector('.site-head');
    var offset = window.getComputedStyle(headEl).position === 'sticky' ? headEl.getBoundingClientRect().height : 0;
    window.scrollTo({ top: window.scrollY + sec.top - offset - 8, behavior: reduceMotion ? 'auto' : 'smooth' });
  }

  function renderProposals() {
    var ol = $('#prop-list');
    D.proposals.forEach(function (p, i) {
      var stops = p.stops.map(function (id) { return byId[id]; });
      var stopsUl = h('ol', { 'class': 'prop-stops' }, stops.map(function (sp) {
        return h('li', {}, [h('button', { type: 'button', 'data-id': sp.id, 'aria-label': '在地圖上標示：' + sp.zh }, [sp.zh])]);
      }));
      var nums = h('dl', { 'class': 'prop-nums' }, [
        h('div', {}, [h('dt', { text: '直線距離（估算）' }), h('dd', {}, [fmtDist(p.lineTotal), h('small', { text: '　約 ' + minutes(p.lineTotal) + ' 分（' + WALK + ' m/分）' })])]),
        h('div', {}, [h('dt', { text: '路網距離（OSM 預估）' }), h('dd', {}, [fmtDist(p.netTotal), h('small', { text: '　約 ' + minutes(p.netTotal) + ' 分；FOSSGIS OSRM 於 ' + D.meta.osrmDate + ' 預先計算' })])]),
        h('div', {}, [h('dt', { text: '相鄰兩處最遠' }), h('dd', {}, [fmtDist(p.lineMax), h('small', { text: '　直線，估算' })])]),
      ]);
      var gm = extLink(gmapsUrl(stops), '在 Google 地圖開啟步行路線', p.name + '：在 Google 地圖開啟步行路線（開新分頁）', 'btn btn-primary');
      var apply = h('button', { type: 'button', 'class': 'btn btn-ghost', 'data-prop': p.id }, ['套用到我的路線']);
      apply.addEventListener('click', function () { applyProposal(p); });
      var left = h('div', {}, [
        h('p', { 'class': 'prop-no', text: '提案 ' + (i + 1) }),
        h('h3', { text: p.name }),
        h('p', { 'class': 'prop-area', text: '區域：' + areaName[p.area] + '（' + stops.length + ' 處）' }),
        stopsUl,
      ]);
      var right = h('div', {}, [nums, h('p', { 'class': 'prop-tip', text: p.tip + '距離與時間都是估算，端點是園區近似位置。' }), h('div', { 'class': 'prop-actions' }, [gm, apply])]);
      ol.appendChild(h('li', { 'class': 'prop' }, [left, right]));
    });
    ol.addEventListener('click', function (e) {
      var b = e.target.closest('.prop-stops button');
      if (b) focusSpot(b.getAttribute('data-id'));
    });
  }

  /* =====================================================================
     05 頁尾：來源與引用
     ===================================================================== */
  function srcList(items) {
    return h('ul', { 'class': 'src-list' }, items.map(function (it) {
      var li = h('li');
      if (it.url) li.appendChild(extLink(it.url, it.name, it.name + '（開新分頁）', ''));
      else li.appendChild(h('span', { 'class': 'src-name-plain', text: it.name }));
      li.appendChild(h('span', { 'class': 'src-role', text: it.reason || it.role }));
      return li;
    }));
  }
  function section(title, note, body, cls) {
    var sec = h('section', { 'class': cls || '' }, [h('h3', { text: title })]);
    if (note) sec.appendChild(h('p', { 'class': 'foot-note', text: note }));
    sec.appendChild(body);
    return sec;
  }
  function renderFooter() {
    var S = D.sources, box = $('#foot-body');
    box.appendChild(section('資料範圍', '本站的景點只來自下面這份來源表，逐列閱讀、去重後，只保留已被來源證實有銀杏的實際景點（26 處）。', srcList([S.sheet]), 'span-2'));
    box.appendChild(section('官方來源', '各景點卡片上的「官方連結」也是這些官方網站的頁面。', srcList(S.official)));
    box.appendChild(h('div', { 'class': 'stack' }, [
      section('官方觀光入口', '只用來發現地點，不提供各景點的葉況。', srcList(S.portals)),
      section('氣象資料（氣象廳）', '只用在「季節說明」的物候指引，不是景點來源。', srcList(S.weather)),
    ]));
    box.appendChild(section('第三方參考', '民間或第三方彙整的葉況與預報。本站不引用它們的葉況，只列出作為來源紀錄。', srcList(S.thirdParty)));
    box.appendChild(section('排除與候選紀錄', '這些來源因為物種未證實、網址失效或管理單位已更換，沒有列入地圖與名單。', srcList(S.excluded)));

    var use = h('dl', { 'class': 'use-list' }, [
      h('dt', { text: 'OpenStreetMap' }),
      h('dd', {}, ['每張景點卡的「OSM 位置」連結，會在新分頁用 openstreetmap.org 標出該景點的近似座標，讓你自己核對位置。座標是以 OpenStreetMap（Nominatim、Overpass）為主，對照維基百科與官方頁面文字整理的近似值。本站的地圖是自繪的示意圖，沒有載入 OSM 圖磚。', h('br'), extLink(S.maps.osm.url, S.maps.osm.note, S.maps.osm.note + '（開新分頁）', '')]),
      h('dt', { text: 'OSRM 步行路由（OSM 路網）' }),
      h('dd', {}, ['「同區域散步提案」的路網距離，是用 FOSSGIS 公開的 OSRM 步行路由（路網資料來自 OpenStreetMap），在 ' + D.meta.osrmDate + ' 事先算好寫進 data.js；網站執行時不會連線。', h('br'), extLink(S.maps.osrm.url, S.maps.osrm.name, S.maps.osrm.name + '（開新分頁）', '')]),
      h('dt', { text: 'Google 地圖' }),
      h('dd', {}, ['「在 Google 地圖開啟步行路線」會把你選的景點座標組成 Google 地圖的步行路線網址，只有你按下去才會開啟；本站不載入任何 Google 的程式或資料。路線端點是園區近似位置，實際路線以 Google 地圖為準。', h('br'), extLink(S.maps.google.url, S.maps.google.name, S.maps.google.name + '（開新分頁）', '')]),
    ]);
    box.appendChild(section('OpenStreetMap、Google 地圖連結的用途', null, use, 'span-2'));
  }

  /* =====================================================================
     啟動
     ===================================================================== */
  function measure() {
    var r = frame.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height) };
  }
  var lastSize = { w: 0, h: 0 };
  function onResize() {
    var m = measure();
    if (m.w < 10 || m.h < 10) return;                       // 隱藏時不處理（0×0）
    var first = lastSize.w === 0;
    var big = !first && (Math.abs(m.w - lastSize.w) / lastSize.w > 0.25 || Math.abs(m.h - lastSize.h) / lastSize.h > 0.25 || (m.w > m.h) !== (lastSize.w > lastSize.h));
    if (!first && m.w === lastSize.w && m.h === lastSize.h) return;
    lastSize = m;
    view.cw = m.w; view.ch = m.h;
    computeHome();
    if (anim) { cancelAnimationFrame(anim); anim = null; }
    if (first || view.fitMode) { setView(state.visible.length === TOTAL ? view.home : fitBox(boxOf(state.visible), 170)); return; }
    if (big) {
      // 容器大小明顯改變：依「選取的標記 → 路線 → 目前顯示的標記」重新取景
      if (state.selected) setView({ scale: Math.max(view.scale, view.home.scale * 1.8), cx: byId[state.selected]._px.x, cy: byId[state.selected]._px.y });
      else if (state.route.length >= 2) setView(fitBox(boxOf(state.route.map(function (id) { return byId[id]; })), 170));
      else setView(state.visible.length ? fitBox(boxOf(state.visible), 170) : view.home);
    } else {
      applyView();                                           // 小幅改變（例如網址列）：保持中心
    }
  }

  function init() {
    fillFilters();
    renderLegend();
    renderSeason();
    buildMarkers();
    renderCards();
    renderProposals();
    renderFooter();
    bindFilters();
    bindRoute();

    state.route = loadRoute();
    applyFilters({ fit: false });
    setTabStop(D.spots[0].id);
    renderRoute();
    $('#storage-note').hidden = storage.ok;

    onResize();
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(onResize).observe(frame);
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', function () { setTimeout(onResize, 200); });
    if (state.route.length >= 2 && view.cw) { setView(fitBox(boxOf(state.route.map(function (id) { return byId[id]; })), 170)); view.fitMode = false; }
    document.documentElement.setAttribute('data-ready', '1');
  }

  init();
})();
