/* 東京櫻花地圖與散步指南：互動邏輯（純前端，不使用模組） */
(function () {
  'use strict';

  var D = window.SAKURA_DATA;
  if (!D) { return; }

  /* ───────── 小工具 ───────── */
  var SVGNS = 'http://www.w3.org/2000/svg';
  function qs(s, r) { return (r || document).querySelector(s); }
  function qsa(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function h(tag, props, kids) {
    var e = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach(function (k) {
        var v = props[k];
        if (v === null || v === undefined || v === false) { return; }
        if (k === 'class') { e.className = v; }
        else if (k === 'text') { e.textContent = v; }
        else { e.setAttribute(k, v === true ? '' : v); }
      });
    }
    add(e, kids);
    return e;
  }
  function add(parent, kids) {
    if (kids === null || kids === undefined) { return parent; }
    if (!Array.isArray(kids)) { kids = [kids]; }
    kids.forEach(function (k) {
      if (k === null || k === undefined || k === false) { return; }
      if (Array.isArray(k)) { add(parent, k); return; }
      parent.appendChild(typeof k === 'string' ? document.createTextNode(k) : k);
    });
    return parent;
  }
  function clear(node) { while (node.firstChild) { node.removeChild(node.firstChild); } return node; }
  function icon(id, cls) {
    var s = document.createElementNS(SVGNS, 'svg');
    s.setAttribute('class', 'ic' + (cls ? ' ' + cls : ''));
    s.setAttribute('aria-hidden', 'true');
    var u = document.createElementNS(SVGNS, 'use');
    u.setAttribute('href', '#' + id);
    s.appendChild(u);
    return s;
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function md(a) { return a[0] + '/' + a[1]; }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function debounce(fn, ms) { var t; return function () { clearTimeout(t); t = setTimeout(fn, ms); }; }
  var WEEK = ['日', '一', '二', '三', '四', '五', '六'];
  var reduceMQ = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  function prefersReduced() { return !!(reduceMQ && reduceMQ.matches); }

  /* ───────── 日期與花期階段（東京時間） ───────── */
  var REF_YEAR = 2001; // 非閏年，只拿來把「月/日」換成一年中的第幾天
  function doy(m, d) { return Math.round((Date.UTC(REF_YEAR, m - 1, d) - Date.UTC(REF_YEAR, 0, 1)) / 86400000) + 1; }
  function fromDoy(n) { var dt = new Date(Date.UTC(REF_YEAR, 0, n)); return [dt.getUTCMonth() + 1, dt.getUTCDate()]; }

  function jstToday() {
    var y, m, d;
    try {
      var parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
      parts.forEach(function (p) {
        if (p.type === 'year') { y = +p.value; }
        if (p.type === 'month') { m = +p.value; }
        if (p.type === 'day') { d = +p.value; }
      });
    } catch (e) { y = 0; }
    if (!y) { var n = new Date(); y = n.getFullYear(); m = n.getMonth() + 1; d = n.getDate(); }
    return { y: y, m: m, d: d };
  }
  function daysUntil(target, today) {
    var ty = today.y;
    var t = Date.UTC(ty, target[0] - 1, target[1]);
    var n = Date.UTC(today.y, today.m - 1, today.d);
    if (t < n) { t = Date.UTC(ty + 1, target[0] - 1, target[1]); }
    return Math.round((t - n) / 86400000);
  }

  var OPEN = doy(D.jma.bloomNormal[0], D.jma.bloomNormal[1]);   // 3/24（氣象廳平年值）
  var FULL = doy(D.jma.fullNormal[0], D.jma.fullNormal[1]);     // 3/31（氣象廳平年值）
  var STAGES = [
    { key: 'bud', ja: 'つぼみ', zh: '花苞', from: OPEN - 14, to: OPEN - 1, icon: 'i-bud', basis: '示意：開花前 14 天' },
    { key: 'bloom', ja: '開花', zh: '初綻', from: OPEN, to: FULL - 1, icon: 'i-bloom', basis: '起點為氣象廳開花平年值' },
    { key: 'peak', ja: '見頃', zh: '滿開最佳賞花期', from: FULL, to: FULL + 6, icon: 'i-blossom', basis: '起點為氣象廳満開平年值，長度 7 天為示意' },
    { key: 'leaf', ja: '葉桜', zh: '花落新綠', from: FULL + 7, to: doy(4, 30), icon: 'i-leaf', basis: '示意：満開後第 8 天起' }
  ];
  function stageAtDoy(n) {
    for (var i = 0; i < STAGES.length; i++) { if (n >= STAGES[i].from && n <= STAGES[i].to) { return STAGES[i]; } }
    return null;
  }
  function stageAt(m, d) { return stageAtDoy(doy(m, d)); }
  function range(s) { return md(fromDoy(s.from)) + '–' + md(fromDoy(s.to)); }

  /* ───────── 距離與連結 ───────── */
  function haversine(a, b) {
    var R = 6371000, rad = Math.PI / 180;
    var dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
    var x = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.sqrt(x));
  }
  function fmtDist(m) {
    if (m < 1000) { return Math.max(10, Math.round(m / 10) * 10) + ' m'; }
    if (m < 10000) { return (m / 1000).toFixed(1) + ' km'; }
    return Math.round(m / 1000).toLocaleString('en-US') + ' km';
  }
  function fmtMin(min) {
    min = Math.max(1, Math.round(min));
    if (min < 60) { return min + ' 分'; }
    var hr = Math.floor(min / 60), r = min % 60;
    return r ? hr + ' 小時 ' + r + ' 分' : hr + ' 小時';
  }
  function walkMin(m) { return m / D.walkSpeedMPerMin; }

  var MODES = [
    { k: 'walking', label: '步行' },
    { k: 'transit', label: '大眾運輸' },
    { k: 'driving', label: '開車' },
    { k: 'bicycling', label: '騎車' }
  ];
  function modeLabel() { return MODES.filter(function (m) { return m.k === S.mode; })[0].label; }
  function gmapsUrl(destName, wayNames) {
    var u = 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(destName) + '&travelmode=' + S.mode;
    if (wayNames && wayNames.length) { u += '&waypoints=' + wayNames.map(encodeURIComponent).join('%7C'); }
    return u;
  }
  function gmapsRouteUrl(ids) {
    var names = ids.map(function (id) { return BY_ID[id].ja; });
    var u = 'https://www.google.com/maps/dir/?api=1&origin=' + encodeURIComponent(names[0]) + '&destination=' + encodeURIComponent(names[names.length - 1]) + '&travelmode=' + S.mode;
    var way = names.slice(1, -1);
    if (way.length) { u += '&waypoints=' + way.map(encodeURIComponent).join('%7C'); }
    return u;
  }
  function refreshGmapLinks() {
    qsa('a[data-gm]').forEach(function (a) {
      var v = a.getAttribute('data-gm');
      if (v.indexOf('route:') === 0) { a.href = gmapsRouteUrl(v.slice(6).split(',')); }
      else { a.href = gmapsUrl(BY_ID[v].ja); }
      var lab = a.querySelector('.gm-mode');
      if (lab) { lab.textContent = modeLabel(); }
    });
  }

  /* ───────── 狀態 ───────── */
  var BY_ID = {};
  D.spots.forEach(function (s) { BY_ID[s.id] = s; });
  var S = {
    pos: null, mode: 'walking', selected: null, route: null, tab: 'map',
    wxState: 'loading', forecast: null, wxTime: null, preview: 30
  };
  var TODAY = jstToday();

  /* ───────── 交通模式選擇 ───────── */
  function renderModes() {
    qsa('[data-mode-group]').forEach(function (grp) {
      clear(grp);
      MODES.forEach(function (m) {
        var checked = m.k === S.mode;
        var b = h('button', { type: 'button', role: 'radio', 'aria-checked': checked ? 'true' : 'false', tabindex: checked ? '0' : '-1', 'data-mode': m.k, text: m.label });
        grp.appendChild(b);
      });
      grp.addEventListener('click', function (ev) {
        var b = ev.target.closest('button[data-mode]');
        if (b) { setMode(b.getAttribute('data-mode'), true); }
      });
      grp.addEventListener('keydown', function (ev) {
        var keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
        if (!(ev.key in keys)) { return; }
        ev.preventDefault();
        var idx = MODES.map(function (m) { return m.k; }).indexOf(S.mode);
        var next = MODES[(idx + keys[ev.key] + MODES.length) % MODES.length].k;
        setMode(next, true, grp);
      });
    });
  }
  function setMode(k, focus, grp) {
    S.mode = k;
    qsa('[data-mode-group]').forEach(function (g) {
      qsa('button[data-mode]', g).forEach(function (b) {
        var on = b.getAttribute('data-mode') === k;
        b.setAttribute('aria-checked', on ? 'true' : 'false');
        b.setAttribute('tabindex', on ? '0' : '-1');
        if (focus && on && (!grp || g === grp)) { b.focus(); }
      });
    });
    refreshGmapLinks();
  }

  /* ───────── 首頁狀態與階段橫幅 ───────── */
  function renderStatus() {
    var st = stageAt(TODAY.m, TODAY.d);
    var open = D.jma.bloomNormal, full = D.jma.fullNormal;
    var s = qs('#hero-status');
    var dateTxt = TODAY.m + ' 月 ' + TODAY.d + ' 日';
    if (!st) {
      var dOpen = daysUntil(open, TODAY);
      s.textContent = '今天是 ' + dateTxt + '（東京時間），依氣象廳平年值推估不在染井吉野的花期；本站不提供任何景點的即時花況。距離平年值的開花日（' + md(open) + '）約還有 ' + dOpen + ' 天。';
    } else {
      s.textContent = '今天是 ' + dateTxt + '（東京時間）。依氣象廳平年值推估，東京的染井吉野大約在「' + st.ja + '（' + st.zh + '）」階段，這只是示意，不是任何景點的實際花況。';
    }
    var ban = qs('#stage-banner');
    clear(ban);
    add(ban, [icon(st ? st.icon : 'i-leaf'), h('span', null, [
      '今天（' + TODAY.m + '/' + TODAY.d + '）依平年值推估：',
      h('b', { text: st ? st.ja + '（' + st.zh + '）' : '季節外' }),
      '。全東京共用同一組示意日期，不是各景點的即時花況。'
    ])]);
  }

  /* ───────── 景點清單 ───────── */
  var rows = {};
  function renderSpots() {
    var ol = qs('#spot-list');
    clear(ol);
    D.spots.forEach(function (sp) {
      var li = h('li', { class: 'spot', 'data-id': sp.id });
      var name = h('h3', { class: 'spot-name' }, h('button', { type: 'button', 'data-pick': sp.id }, [
        h('span', { text: sp.zh }),
        sp.ja !== sp.zh ? h('span', { class: 'spot-ja', lang: 'ja', text: sp.ja }) : null
      ]));
      var meta = h('p', { class: 'spot-area' }, sp.area + '　座標：' + sp.coordNote + (sp.mapped ? '' : '　（郊外，未標在地圖）'));
      var bloom = h('ul', { class: 'bloom-list' }, sp.bloom.map(function (t) { return h('li', { text: t }); }));
      var actions = h('div', { class: 'spot-actions' });
      if (sp.mapped) {
        actions.appendChild(h('button', { type: 'button', class: 'btn btn-quiet', 'data-show': sp.id, 'aria-label': '在地圖上看 ' + sp.zh }, [icon('i-pin'), h('span', { text: '在地圖上看' })]));
      }
      actions.appendChild(h('a', { class: 'link', href: '#', 'data-gm': sp.id, target: '_blank', rel: 'noopener' }, [
        h('span', null, ['Google 地圖路線（', h('span', { class: 'gm-mode', text: '步行' }), '）']), icon('i-ext')
      ]));
      sp.links.forEach(function (l) {
        actions.appendChild(h('a', { class: 'link', href: l.url, target: '_blank', rel: 'noopener' }, [h('span', { text: l.label }), icon('i-ext')]));
      });
      add(li, [
        name, meta,
        h('p', { class: 'spot-intro', text: sp.intro }),
        bloom,
        h('p', { class: 'bloom-note', text: sp.bloomNote }),
        h('p', { class: 'spot-visit' }, [h('b', { text: '入園資訊：' }), sp.visit]),
        h('div', { class: 'spot-dist', hidden: true }),
        actions
      ]);
      rows[sp.id] = li;
      ol.appendChild(li);
    });
    ol.addEventListener('click', function (ev) {
      var show = ev.target.closest('button[data-show]');
      if (show) { showOnMap(show.getAttribute('data-show')); return; }
      var pick = ev.target.closest('button[data-pick]');
      if (pick) { selectSpot(pick.getAttribute('data-pick'), { popup: !isNarrow() }); }
    });
    refreshGmapLinks();
    updateDistances();
  }

  function distTo(sp) { return S.pos ? haversine(S.pos, sp) : null; }
  function distBlock(m) {
    if (m > 50000) {
      return [h('span', null, ['直線距離約 ' + fmtDist(m) + '（估算）']), h('br'), h('em', { text: '距離太遠，不做步行時間估算；請用上方的 Google 地圖連結看大眾運輸或飛行。' })];
    }
    var out = [h('span', null, ['直線距離約 ', h('b', { text: fmtDist(m) }), '（估算）']), h('br'),
      h('span', null, ['步行約 ', h('b', { text: fmtMin(walkMin(m)) }), '（直線距離 ÷ 每分鐘 80 公尺，估算）'])];
    if (m > 5000) { out.push(h('br'), h('em', { text: '距離較遠，不太適合步行；Google 地圖會顯示實際的交通方式與時間。' })); }
    else { out.push(h('br'), h('em', { text: '實際走路會繞得比直線更遠，真正的時間請看 Google 地圖。' })); }
    return out;
  }
  function updateDistances() {
    var note = qs('#sort-note');
    var ol = qs('#spot-list');
    if (S.pos) {
      var sorted = D.spots.slice().sort(function (a, b) { return distTo(a) - distTo(b); });
      sorted.forEach(function (sp) { ol.appendChild(rows[sp.id]); });
      note.textContent = '已依你的位置排序：近的在前。距離是從近似座標算出的直線距離，只是估算。';
    } else {
      D.spots.forEach(function (sp) { ol.appendChild(rows[sp.id]); });
      note.textContent = '預設順序：先列出上野、新宿御苑、代代木公園三處，再列其他名所。取得位置後會改成由近到遠。';
    }
    D.spots.forEach(function (sp) {
      var box = qs('.spot-dist', rows[sp.id]);
      if (!box) { return; }
      var m = distTo(sp);
      if (m === null) { box.hidden = true; clear(box); return; }
      box.hidden = false;
      box.className = 'spot-dist' + (m > 5000 ? ' is-far' : '');
      clear(box);
      add(box, distBlock(m));
    });
  }

  function selectSpot(id, opts) {
    opts = opts || {};
    S.selected = id;
    Object.keys(rows).forEach(function (k) { rows[k].classList.toggle('is-selected', k === id); });
    mapSelectionChanged(opts);
  }
  function scrollRowIntoView(id) {
    var r = rows[id];
    if (r && r.scrollIntoView) { r.scrollIntoView({ block: 'nearest', behavior: prefersReduced() ? 'auto' : 'smooth' }); }
  }
  function showOnMap(id) {
    if (S.route && D.routes.filter(function (r) { return r.id === S.route; })[0].stops.every(function (s) { return s.id !== id; })) { setRoute(null, true); }
    setTab('map');
    selectSpot(id, { popup: true });
    var m = qs('#explorer'); if (m && isNarrow()) { m.scrollIntoView({ behavior: prefersReduced() ? 'auto' : 'smooth', block: 'start' }); }
  }
  function isNarrow() { return window.matchMedia('(max-width: 959px)').matches; }

  /* ───────── 分頁（手機：地圖／清單） ───────── */
  function setTab(which) {
    S.tab = which;
    var ex = qs('#explorer');
    ex.setAttribute('data-active', which);
    var tm = qs('#tab-map'), tl = qs('#tab-list');
    tm.setAttribute('aria-selected', which === 'map' ? 'true' : 'false');
    tl.setAttribute('aria-selected', which === 'list' ? 'true' : 'false');
    tm.tabIndex = which === 'map' ? 0 : -1;
    tl.tabIndex = which === 'list' ? 0 : -1;
    if (which === 'map') { requestAnimationFrame(function () { requestAnimationFrame(onMapSize); }); }
  }
  function bindTabs() {
    var tm = qs('#tab-map'), tl = qs('#tab-list');
    tm.addEventListener('click', function () { setTab('map'); });
    tl.addEventListener('click', function () { setTab('list'); });
    qs('.tabs').addEventListener('keydown', function (ev) {
      if (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft' || ev.key === 'Home' || ev.key === 'End') {
        ev.preventDefault();
        var to = (ev.key === 'ArrowLeft' || ev.key === 'Home') ? 'map' : 'list';
        setTab(to); (to === 'map' ? tm : tl).focus();
      }
    });
  }

  /* ───────── 花期區塊 ───────── */
  var TL_START = doy(3, 1), TL_DAYS = 61; // 3/1 到 4/30
  function tlPct(n) { return ((n - TL_START + 0.5) / TL_DAYS) * 100; }

  function renderSeason() {
    var strip = qs('#stage-strip'); clear(strip);
    STAGES.forEach(function (s) {
      var li = h('li', { class: 'st-' + s.key, 'data-stage': s.key }, [
        icon(s.icon, 'st-ic'),
        h('div', { class: 'st-ja', lang: 'ja', text: s.ja }),
        h('div', { class: 'st-zh', text: s.zh }),
        h('div', { class: 'st-date', text: range(s) }),
        h('div', { class: 'st-basis', text: s.basis })
      ]);
      strip.appendChild(li);
    });
    renderTimeline();
    var rng = qs('#tl-range');
    rng.max = String(TL_DAYS - 1);
    rng.value = String(S.preview);
    rng.addEventListener('input', function () { S.preview = +rng.value; updatePreview(); });
    updatePreview();
    renderHistory();
    renderGinkgo();
  }
  function renderTimeline() {
    var bar = qs('#tl-bar'); clear(bar);
    var track = h('div', { class: 'tl-track' });
    STAGES.forEach(function (s) {
      var left = ((s.from - TL_START) / TL_DAYS) * 100, w = ((s.to - s.from + 1) / TL_DAYS) * 100;
      var seg = h('div', { class: 'tl-seg st-' + s.key });
      seg.style.left = left + '%'; seg.style.width = w + '%';
      track.appendChild(seg);
    });
    bar.appendChild(track);
    function mark(n, label, cls, side) {
      var down = cls.indexOf('down') >= 0;
      var m = h('div', { class: 'tl-mark ' + cls }, down ? [h('i'), h('span', { text: label })] : [h('span', { text: label }), h('i')]);
      m.style.left = tlPct(n) + '%';
      m.style.transform = side === 'l' ? 'translateX(-100%)' : 'translateX(0)';
      m.style.alignItems = side === 'l' ? 'flex-end' : 'flex-start';
      m.style.textAlign = side === 'l' ? 'right' : 'left';
      bar.appendChild(m);
    }
    mark(OPEN, '開花 平年值 ' + md(D.jma.bloomNormal), 'up', 'l');
    mark(FULL, '満開 平年值 ' + md(D.jma.fullNormal), 'up', 'r');
    mark(doy(D.jma.observed2026.bloom[0], D.jma.observed2026.bloom[1]), '2026 開花 ' + md(D.jma.observed2026.bloom), 'down obs', 'l');
    mark(doy(D.jma.observed2026.full[0], D.jma.observed2026.full[1]), '2026 満開 ' + md(D.jma.observed2026.full), 'down obs', 'r');
    var n = doy(TODAY.m, TODAY.d);
    if (n >= TL_START && n < TL_START + TL_DAYS) {
      var t = h('div', { class: 'tl-today', text: '今天' }); t.style.left = tlPct(n) + '%'; bar.appendChild(t);
    }
    var cur = h('div', { class: 'tl-cursor', id: 'tl-cursor' }); bar.appendChild(cur);
    var legend = qs('#tl-legend');
    if (!legend) {
      legend = h('div', { class: 'tl-legend', id: 'tl-legend' }, STAGES.map(function (s) {
        var sp = h('span', { class: 'st-' + s.key }, [h('i'), s.ja + ' ' + range(s)]);
        return sp;
      }));
      bar.parentNode.insertBefore(legend, bar.nextSibling);
    }
  }
  function updatePreview() {
    var n = TL_START + S.preview;
    var date = fromDoy(n);
    var st = stageAtDoy(n);
    qs('#timeline-read').textContent = md(date) + '：' + (st ? st.ja + '（' + st.zh + '）' : '季節外') + '　示意';
    var cur = qs('#tl-cursor');
    if (cur) { cur.style.left = tlPct(n) + '%'; }
    var today = stageAt(TODAY.m, TODAY.d);
    qsa('#stage-strip li').forEach(function (li) {
      var k = li.getAttribute('data-stage');
      li.classList.toggle('is-now', !!today && today.key === k);
      li.classList.toggle('is-preview', !!st && st.key === k);
    });
  }

  /* 歷年開花・満開（啞鈴圖） */
  function renderHistory() {
    var box = qs('#history-chart');
    var years = Object.keys(D.jma.history).map(Number).sort(function (a, b) { return a - b; });
    var W = Math.max(280, Math.round(box.clientWidth || 640));
    var rowH = 24, top = 36, left = 44, right = 14, H = top + years.length * rowH + 14;
    var x0 = doy(3, 10), x1 = doy(4, 10), plotW = W - left - right;
    function X(n) { return left + ((n - x0) / (x1 - x0)) * plotW; }
    clear(box);
    var svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', '東京 2011 到 2026 年各年的開花日與満開日，開花日多在 3 月中下旬，満開日在 3 月下旬到 4 月上旬；詳細日期請展開下方表格。');
    function el(tag, attrs, txt) {
      var e = document.createElementNS(SVGNS, tag);
      Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); });
      if (txt !== undefined) { e.textContent = txt; }
      svg.appendChild(e); return e;
    }
    var ticks = plotW < 330 ? [[3, 10], [3, 20], [3, 30], [4, 9]] : [[3, 10], [3, 15], [3, 20], [3, 25], [3, 30], [4, 4], [4, 9]];
    ticks.forEach(function (t) {
      var x = X(doy(t[0], t[1]));
      el('line', { x1: x, x2: x, y1: top - 6, y2: H - 10, stroke: 'rgba(59,44,51,.1)' });
      el('text', { x: x, y: top - 12, 'text-anchor': 'middle' }, t[0] + '/' + t[1]);
    });
    years.forEach(function (yr, i) {
      var y = top + i * rowH + rowH / 2;
      var rec = D.jma.history[yr];
      var xb = X(doy(rec[0][0], rec[0][1])), xf = X(doy(rec[1][0], rec[1][1]));
      el('line', { x1: left, x2: W - right, y1: y + rowH / 2, y2: y + rowH / 2, stroke: 'rgba(59,44,51,.07)' });
      el('text', { x: left - 8, y: y + 4, 'text-anchor': 'end', class: 'yr' + (yr === 2026 ? ' cur' : '') }, String(yr));
      el('line', { x1: xb, x2: xf, y1: y, y2: y, stroke: '#dba8b6', 'stroke-width': 3, 'stroke-linecap': 'round' });
      el('circle', { cx: xb, cy: y, r: 5.5, fill: '#fbf6ee', stroke: '#a23b55', 'stroke-width': 2 });
      el('circle', { cx: xf, cy: y, r: 5.5, fill: '#a23b55' });
    });
    [[D.jma.bloomNormal, 'end'], [D.jma.fullNormal, 'start']].forEach(function (p) {
      var x = X(doy(p[0][0], p[0][1]));
      el('line', { x1: x, x2: x, y1: top - 4, y2: H - 10, stroke: '#3b2c33', 'stroke-width': 1.2, 'stroke-dasharray': '4 4' });
      el('text', { x: x + (p[1] === 'end' ? -5 : 5), y: 12, 'text-anchor': p[1], style: 'fill:#3b2c33;font-weight:700' }, '平年值 ' + md(p[0]));
    });
    box.appendChild(svg);

    var legend = qs('#history-legend');
    if (!legend) {
      legend = h('p', { class: 'chart-note', id: 'history-legend' }, '空心圓是開花日，實心圓是満開日，虛線是氣象廳的平年值（1991–2020）。2026 年是今年春天的觀測，屬於過去紀錄。');
      box.parentNode.insertBefore(legend, box.nextSibling);
    }
    var tbl = h('table', null, [
      h('caption', { class: 'sr-only', text: '東京歷年開花日與満開日' }),
      h('thead', null, h('tr', null, [h('th', { text: '年' }), h('th', { text: '開花日' }), h('th', { text: '満開日' })])),
      h('tbody', null, years.slice().reverse().map(function (yr) {
        var rec = D.jma.history[yr];
        return h('tr', null, [h('td', { text: String(yr) }), h('td', { text: md(rec[0]) }), h('td', { text: md(rec[1]) })]);
      }))
    ]);
    clear(qs('#history-table')).appendChild(tbl);
    var ex = D.jma.extremes;
    qs('#history-note').textContent = '氣象廳東京的累年紀錄中，開花日最早 ' + md(ex.bloomEarliest) + '、最晚 ' + md(ex.bloomLatest) + '；満開日最早 ' + md(ex.fullEarliest) + '、最晚 ' + md(ex.fullLatest) + '。資料：氣象廳「生物季節累年値」東京與 2026 年開花、満開狀況頁面。';
  }

  function renderGinkgo() {
    var g = D.ginkgo;
    var colors = ['#bcd6b0', '#e4dd98', '#efd070', '#e6b445', '#d8a066', '#b88a6a'];
    var ol = qs('#ginkgo-strip'); clear(ol);
    g.stages.forEach(function (s, i) {
      var li = h('li', null, [h('div', { class: 'g-ja', lang: 'ja', text: s.ja }), h('div', { class: 'g-range', text: s.range })]);
      li.style.setProperty('--g', colors[i]);
      ol.appendChild(li);
    });
    var note = qs('#ginkgo-note'); clear(note);
    add(note, ['參考模板：階段名稱取自 BRIEF 的銀杏參考。「見頃」的起點是氣象廳東京銀杏黃葉日平年值（' + md(g.anchors.yellowNormal) + '），「落葉」的起點是落葉日平年值（' + md(g.anchors.fallNormal) + '），其餘邊界是編者的示意參數。這些都不是銀杏的現況。 ',
      h('a', { class: 'link', href: g.link, target: '_blank', rel: 'noopener' }, [h('span', { text: '氣象廳：銀杏黃葉日' }), icon('i-ext')])]);
  }

  /* ───────── 散步路線 ───────── */
  function renderRoutes() {
    var wrap = qs('#routes-wrap'); clear(wrap);
    D.routes.forEach(function (rt) {
      var stops = rt.stops.map(function (s) { return { sp: BY_ID[s.id], stay: s.stay }; });
      var totalM = 0, totalStay = 0, children = [];
      stops.forEach(function (s, i) {
        totalStay += s.stay;
        var meta = '建議停留 ' + s.stay + ' 分（編者建議值）';
        children.push(h('li', { class: 'stop' }, [
          h('div', { class: 'stop-num', text: String(i + 1) }),
          h('div', { class: 'stop-body' }, [
            h('div', { class: 'stop-name' }, [s.sp.zh, s.sp.ja !== s.sp.zh ? h('small', { lang: 'ja', text: s.sp.ja }) : null]),
            h('div', { class: 'stop-meta', text: meta })
          ])
        ]));
        if (i < stops.length - 1) {
          var m = haversine(s.sp, stops[i + 1].sp); totalM += m;
          children.push(h('li', { class: 'leg' }, [
            h('div', { class: 'rail', 'aria-hidden': 'true' }),
            h('div', { class: 'leg-text' }, [
              '直線 ' + fmtDist(m) + '，步行約 ' + fmtMin(walkMin(m)) + '（估算）',
              h('em', { text: m > 2500 ? '這段較長，可改搭電車；實際路線與時間請看 Google 地圖。' : '實際走路會繞得比直線更遠。' })
            ])
          ]));
        }
      });
      var warn = stops.filter(function (s) { return s.sp.closed; }).map(function (s) { return s.sp.zh + '：' + s.sp.closed; });
      var ids = rt.stops.map(function (s) { return s.id; });
      var art = h('article', { class: 'route', 'data-route': rt.id }, [
        h('h3', { text: rt.title }),
        h('p', { class: 'route-sub', text: rt.sub }),
        h('ol', { class: 'stops', 'aria-label': rt.title + '的停靠站' }, children),
        h('div', { class: 'route-total' }, [
          h('div', { class: 'big', text: '直線合計 ' + fmtDist(totalM) + '，步行約 ' + fmtMin(walkMin(totalM)) + '（估算）' }),
          h('small', { text: '加上建議停留 ' + totalStay + ' 分，全程約 ' + fmtMin(walkMin(totalM) + totalStay) + '。步行時間與停留時間都是估算與建議，不是實測。' })
        ]),
        warn.length ? h('p', { class: 'route-warn' }, ['休園提醒：' + warn.join('；') + '。']) : null,
        h('p', { class: 'route-note', text: rt.note }),
        h('div', { class: 'route-actions' }, [
          h('button', { type: 'button', class: 'btn btn-primary', 'data-route-btn': rt.id, 'aria-pressed': 'false' }, [icon('i-pin'), h('span', { text: '在地圖上顯示路線' })]),
          h('a', { class: 'link', href: '#', 'data-gm': 'route:' + ids.join(','), target: '_blank', rel: 'noopener' }, [
            h('span', null, ['Google 地圖路線（', h('span', { class: 'gm-mode', text: '步行' }), '）']), icon('i-ext')
          ])
        ])
      ]);
      wrap.appendChild(art);
    });
    wrap.addEventListener('click', function (ev) {
      var b = ev.target.closest('button[data-route-btn]');
      if (!b) { return; }
      var id = b.getAttribute('data-route-btn');
      setRoute(S.route === id ? null : id, false);
      if (S.route) { goToMap(); }
    });
    refreshGmapLinks();
  }
  function goToMap() {
    setTab('map');
    var m = qs('#explorer');
    if (m) { m.scrollIntoView({ behavior: prefersReduced() ? 'auto' : 'smooth', block: 'start' }); }
  }
  function setRoute(id, silent) {
    S.route = id;
    qsa('button[data-route-btn]').forEach(function (b) {
      var on = b.getAttribute('data-route-btn') === id;
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      qs('span', b).textContent = on ? '正在地圖上顯示（再按一次取消）' : '在地圖上顯示路線';
    });
    qs('#route-clear').hidden = !id;
    var cap = qs('.map-caption');
    cap.textContent = id ? '地圖只顯示這條路線的名所；虛線是直線示意，不是實際步行路徑，數字是停靠順序。' : '花形標記是園區近似位置。散步路線顯示的是直線示意，不是實際步行路徑。';
    syncMarkers();
    if (!silent) { fitView(); }
  }

  /* ───────── 花瓣 ───────── */
  function buildPetals() {
    var layer = qs('#petals');
    var n = window.innerWidth < 600 ? 9 : 16;
    var cols = ['#f6c1cd', '#f1a7b8', '#f9d3db', '#f4b6c5'];
    for (var i = 0; i < n; i++) {
      var p = h('span', { class: 'petal' }, h('i'));
      var s = rand(9, 16);
      p.style.setProperty('--x', rand(0, 100).toFixed(1) + '%');
      p.style.setProperty('--s', s.toFixed(1) + 'px');
      p.style.setProperty('--o', rand(.5, .85).toFixed(2));
      p.style.setProperty('--dur', rand(18, 30).toFixed(1) + 's');
      p.style.setProperty('--delay', '-' + rand(0, 30).toFixed(1) + 's');
      p.style.setProperty('--drift', rand(-140, 180).toFixed(0) + 'px');
      p.style.setProperty('--sway', rand(3.5, 6.5).toFixed(1) + 's');
      p.firstChild.style.setProperty('--pc', cols[i % cols.length]);
      layer.appendChild(p);
    }
    var btn = qs('#petal-toggle');
    var note = qs('#petal-note');
    function apply() {
      var reduced = prefersReduced();
      if (reduced) {
        document.body.classList.add('petals-off');
        btn.setAttribute('aria-pressed', 'false');
        btn.textContent = '花瓣飄動：關（依系統設定）';
        btn.disabled = true;
        note.hidden = false;
      } else {
        btn.disabled = false; note.hidden = true;
        var on = !document.body.classList.contains('petals-off');
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
        btn.textContent = '花瓣飄動：' + (on ? '開' : '關');
      }
    }
    btn.addEventListener('click', function () {
      if (prefersReduced()) { return; }
      document.body.classList.toggle('petals-off');
      apply();
    });
    if (reduceMQ) {
      if (reduceMQ.addEventListener) { reduceMQ.addEventListener('change', function () { if (!prefersReduced()) { document.body.classList.remove('petals-off'); } apply(); }); }
    }
    apply();
  }

  /* ───────── 天氣（Open-Meteo） ───────── */
  var WX_URL = 'https://api.open-meteo.com/v1/forecast?latitude=35.6895&longitude=139.6917&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia%2FTokyo&forecast_days=7';
  function wmo(code) {
    if (code === 0) { return { t: '晴朗', i: 'i-sun' }; }
    if (code === 1) { return { t: '大致晴朗', i: 'i-sun' }; }
    if (code === 2) { return { t: '晴時多雲', i: 'i-partly' }; }
    if (code === 3) { return { t: '陰天', i: 'i-cloud' }; }
    if (code === 45 || code === 48) { return { t: '有霧', i: 'i-fog' }; }
    if (code >= 51 && code <= 57) { return { t: '毛毛雨', i: 'i-rain' }; }
    if (code >= 61 && code <= 67) { return { t: '下雨', i: 'i-rain' }; }
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) { return { t: '下雪', i: 'i-snow' }; }
    if (code >= 80 && code <= 82) { return { t: '陣雨', i: 'i-rain' }; }
    if (code >= 95 && code <= 99) { return { t: '雷雨', i: 'i-storm' }; }
    return { t: '天氣不明', i: 'i-cloud' };
  }
  function isClear(day) { return (day.code === 0 || day.code === 1) && (day.pop === null || day.pop <= 30); }

  function parseForecast(j) {
    var d = j && j.daily;
    if (!d || !Array.isArray(d.time) || !d.time.length) { throw new Error('bad shape'); }
    var days = d.time.map(function (t, i) {
      var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
      if (!m) { throw new Error('bad date'); }
      var code = d.weather_code && d.weather_code[i];
      if (typeof code !== 'number') { throw new Error('bad code'); }
      var y = +m[1], mo = +m[2], da = +m[3];
      return {
        date: t, y: y, m: mo, d: da, wd: new Date(Date.UTC(y, mo - 1, da)).getUTCDay(),
        code: code,
        tmax: d.temperature_2m_max ? d.temperature_2m_max[i] : null,
        tmin: d.temperature_2m_min ? d.temperature_2m_min[i] : null,
        pop: d.precipitation_probability_max && typeof d.precipitation_probability_max[i] === 'number' ? d.precipitation_probability_max[i] : null
      };
    });
    days.forEach(function (x) { x.stage = stageAt(x.m, x.d); x.clear = isClear(x); x.good = !!(x.stage && x.stage.key === 'peak' && x.clear); });
    return days;
  }
  function fetchWeather() {
    S.wxState = 'loading'; renderWx(); renderAnswer();
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) { ctrl.abort(); } }, 10000);
    var failed = function () { S.wxState = 'error'; S.forecast = null; };
    var p;
    try { p = fetch(WX_URL, ctrl ? { signal: ctrl.signal } : undefined); } catch (e) { clearTimeout(timer); failed(); renderWx(); renderAnswer(); return; }
    p.then(function (r) { if (!r.ok) { throw new Error('HTTP ' + r.status); } return r.json(); })
      .then(function (j) { S.forecast = parseForecast(j); S.wxState = 'ok'; S.wxTime = new Date(); })
      .catch(failed)
      .then(function () { clearTimeout(timer); renderWx(); renderAnswer(); });
  }
  function renderWx() {
    var st = qs('#wx-status'), list = qs('#wx-list'), src = qs('#wx-source'), retry = qs('#wx-retry');
    clear(list); clear(src);
    st.className = 'wx-status';
    retry.hidden = S.wxState !== 'error';
    if (S.wxState === 'loading') { st.textContent = '正在向 Open-Meteo 取得預報…'; return; }
    if (S.wxState === 'error') {
      st.className = 'wx-status is-warn';
      st.textContent = '天氣預報暫時取不到（可能是離線、被瀏覽器或網路擋下，或服務暫停）。其他功能不受影響，只是無法判斷「晴朗」。';
      add(src, [h('a', { class: 'link', href: 'https://www.jma.go.jp/bosai/forecast/', target: '_blank', rel: 'noopener' }, [h('span', { text: '改看氣象廳的天氣預報' }), icon('i-ext')])]);
      return;
    }
    st.textContent = '條件：預報天氣為晴朗（代碼 0 或 1）且降雨機率 30% 以下，才算「晴朗」。';
    S.forecast.forEach(function (x, i) {
      var w = wmo(x.code);
      var isToday = x.y === TODAY.y && x.m === TODAY.m && x.d === TODAY.d;
      var li = h('li', { class: x.good ? 'is-good' : '' }, [
        h('div', { class: 'd' }, [x.m + '/' + x.d, h('small', { text: '週' + WEEK[x.wd] + (isToday ? '・今天' : '') })]),
        icon(w.i, 'wx-ic'),
        h('div', { class: 't', text: w.t }),
        h('div', { class: 'n' }, [
          (x.tmax !== null && x.tmin !== null ? Math.round(x.tmax) + '° / ' + Math.round(x.tmin) + '°' : '—'),
          h('br'),
          '降雨 ' + (x.pop === null ? '—' : x.pop + '%')
        ]),
        x.good ? h('div', { class: 'tag', text: '見頃（示意）＋晴朗' }) : null
      ]);
      list.appendChild(li);
    });
    var tm = S.wxTime ? pad2(S.wxTime.getHours()) + ':' + pad2(S.wxTime.getMinutes()) : '';
    add(src, [h('a', { class: 'link', href: 'https://open-meteo.com/', target: '_blank', rel: 'noopener' }, [h('span', { text: '天氣資料：Open-Meteo.com（CC BY 4.0）' }), icon('i-ext')]),
      h('p', { text: '預報點是東京都心（北緯 35.69°、東經 139.69°），整個東京共用同一份預報，沒有分景點。' + (tm ? '取得時間 ' + tm + '（你的裝置時間）。' : '') })]);
  }

  /* ───────── 位置 ───────── */
  function locate() {
    var btn = qs('#loc-btn'), msg = qs('#loc-msg');
    msg.className = 'loc-msg';
    if (!('geolocation' in navigator)) {
      msg.className = 'loc-msg is-warn';
      msg.textContent = '這個瀏覽器不支援定位。沒關係，其他功能都能用，Google 地圖連結也會用你裝置的目前位置規劃路線。';
      return;
    }
    btn.disabled = true;
    msg.textContent = '正在請瀏覽器讀取位置…（若跳出詢問視窗，請選「允許」）';
    navigator.geolocation.getCurrentPosition(function (p) {
      btn.disabled = false;
      S.pos = { lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy };
      qs('span', btn).textContent = '重新取得位置';
      var far = haversine(S.pos, { lat: 35.6895, lng: 139.6917 }) > 80000;
      msg.className = 'loc-msg is-ok';
      msg.textContent = '已取得位置' + (isFinite(S.pos.acc) && S.pos.acc > 0 ? '（精度約 ' + Math.round(S.pos.acc) + ' m）' : '') + '。位置只在這個頁面中計算距離，不會上傳。' + (far ? '你目前不在東京一帶，所以距離會很大，只供參考。' : '');
      updateAll();
    }, function (e) {
      btn.disabled = false;
      qs('span', btn).textContent = '再試一次';
      msg.className = 'loc-msg is-warn';
      if (e && e.code === 1) {
        msg.textContent = '沒有取得位置的權限。沒關係，其他功能都能用，只是不顯示你到各處的距離；Google 地圖連結會用你裝置的目前位置規劃路線。想改變設定，請到瀏覽器網址列旁的網站設定開啟「位置」。';
      } else if (e && e.code === 3) {
        msg.textContent = '定位花太久了。你可以再試一次，或先使用其他功能。';
      } else {
        msg.textContent = '目前無法判斷你的位置（可能是裝置或網路的問題）。其他功能不受影響，你可以稍後再試。';
      }
    }, { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 });
  }
  function updateAll() {
    updateDistances();
    renderAnswer();
    updateUserMarker();
  }

  /* ───────── 今日推薦（見頃＋晴朗） ───────── */
  function nearestList(title, count) {
    var arr = D.spots.slice();
    if (S.pos) { arr.sort(function (a, b) { return distTo(a) - distTo(b); }); }
    arr = arr.slice(0, count);
    var ol = h('ol', { class: 'near-list' }, arr.map(function (sp) {
      var m = distTo(sp);
      return h('li', null, [
        h('b', { text: sp.zh }),
        m === null ? null : h('span', { text: m > 50000 ? '直線約 ' + fmtDist(m) + '（太遠，不估步行）' : '直線約 ' + fmtDist(m) + '，步行約 ' + fmtMin(walkMin(m)) + '（估算）' }),
        h('a', { class: 'link', href: '#', 'data-gm': sp.id, target: '_blank', rel: 'noopener' }, [h('span', null, ['Google 地圖（', h('span', { class: 'gm-mode', text: modeLabel() }), '）']), icon('i-ext')])
      ]);
    }));
    return [h('p', { class: 'answer-title', text: title }), ol];
  }
  function renderAnswer() {
    var root = qs('#answer'); clear(root);
    var today = TODAY;
    var st = stageAt(today.m, today.d);
    var open = D.jma.bloomNormal, full = D.jma.fullNormal;
    var dOpen = daysUntil(open, today), dFull = daysUntil(full, today);
    var days = S.wxState === 'ok' ? S.forecast : null;
    var good = days ? days.filter(function (x) { return x.good; }) : [];
    var peakDays = days ? days.filter(function (x) { return x.stage && x.stage.key === 'peak'; }) : [];
    var main, subs = [], extra = [];
    var weekday = function (x) { return x.m + '/' + x.d + '（週' + WEEK[x.wd] + '）'; };

    if (good.length) {
      main = '最適合賞櫻的日子：' + weekday(good[0]);
      subs.push('這一天依平年值推估處於「見頃（滿開最佳賞花期）」，預報也是晴朗。' + (good.length > 1 ? '符合條件的還有：' + good.slice(1).map(weekday).join('、') + '。' : ''));
      subs.push('「見頃」是依氣象廳東京平年值推估的示意，不是各景點的觀測，出發前請再看官方花況。');
      extra = nearestList(S.pos ? '推薦的名所（由近到遠）' : '可以先去的名所', 3);
      if (!S.pos) { subs.push('按下「使用我的位置」，就會依你的位置由近到遠排列。'); }
    } else if (peakDays.length) {
      main = '見頃（示意）期間，但這幾天預報不晴朗';
      subs.push('依平年值推估這幾天是見頃，不過預報不符合「晴朗」（天氣代碼 0 或 1，降雨機率 30% 以下），所以本站不推薦。預報會變，可以過幾天再來看。');
      extra = nearestList(S.pos ? '離你最近的名所（只依距離排序）' : '名所', 3);
    } else if (st && st.key === 'peak') {
      main = '依平年值是見頃（示意），但缺少天氣預報';
      subs.push('今天依平年值推估是見頃，不過目前取不到天氣預報，無法判斷是否晴朗。請自行查看預報，再決定要去哪一處。');
      extra = nearestList(S.pos ? '離你最近的名所（只依距離排序）' : '名所', 3);
    } else if (!st) {
      var past = doy(today.m, today.d) > STAGES[3].to;
      main = '今天沒有可推薦的賞櫻景點';
      subs.push('今天是 ' + today.m + ' 月 ' + today.d + ' 日。依氣象廳東京平年值推估，現在不是染井吉野的花期（' + (past ? '今年春天已經過了，要等明年春天' : '還沒有開始') + '），而且本站沒有任何景點的即時花況，所以不會假裝推薦。');
      if (days) {
        var clearN = days.filter(function (x) { return x.clear; }).length;
        subs.push('未來 7 天的預報裡有 ' + clearN + ' 天晴朗，但都不在「見頃」，所以沒有符合「見頃＋晴朗」的日子。');
      } else if (S.wxState === 'error') {
        subs.push('天氣預報目前取不到，不過這不影響上面的判斷。');
      }
      if (S.pos) { extra = nearestList('離你最近的名所（只依距離排序，不代表有花）', 3); }
    } else if (st.key === 'leaf') {
      main = '見頃（示意）已經過了';
      subs.push('依平年值推估，染井吉野現在是「葉桜（花落新綠）」。不過部分名所的八重櫻在 4 月中旬之後才是見頃，細節請看各景點說明。');
      if (S.pos) { extra = nearestList('離你最近的名所（只依距離排序）', 3); }
    } else {
      main = '還沒到見頃，再等等';
      subs.push('依平年值推估，現在是「' + st.ja + '（' + st.zh + '）」階段（示意）。見頃的起點是 ' + md(full) + '，還有 ' + dFull + ' 天。');
      if (S.pos) { extra = nearestList('離你最近的名所（只依距離排序）', 3); }
    }

    add(root, [h('p', { class: 'answer-label', text: '判斷結果' }), h('p', { class: 'answer-main', text: main })]);
    subs.forEach(function (t) { root.appendChild(h('p', { class: 'sub', text: t })); });
    if (!good.length && !(st && st.key === 'peak')) {
      var fullR = md(fromDoy(STAGES[2].from)) + '–' + md(fromDoy(STAGES[2].to));
      root.appendChild(h('p', { class: 'next', text: '下一次：平年值開花日 ' + md(open) + '（還有 ' + dOpen + ' 天）；見頃推估 ' + fullR + '（示意，還有 ' + dFull + ' 天）。' }));
    }
    add(root, extra);
    refreshGmapLinks();
  }

  /* ───────── 地圖（Leaflet + OpenStreetMap） ───────── */
  var M = { map: null, group: null, markers: {}, line: null, tips: [], user: null, lastFit: null, tileOk: 0, tileErr: 0, tiles: null, timer: null, failed: false };
  var mapEl = qs('#map');
  function hasLeaflet() { return typeof L !== 'undefined' && L && typeof L.map === 'function'; }
  function mapNotice(text, canRetry) {
    var box = qs('#map-notice');
    qs('#map-notice-text').textContent = text;
    qs('#map-retry').hidden = !canRetry;
    box.hidden = false;
  }
  function hideMapNotice() { qs('#map-notice').hidden = true; }

  function setupMap() {
    if (!hasLeaflet()) {
      M.failed = true;
      document.body.classList.add('no-map');
      mapEl.style.display = 'none';
      mapNotice('地圖程式庫沒有載入（可能是離線或被網路擋下）。地圖暫時無法使用，但景點清單、距離、路線與 Google 地圖連結都可以正常使用。', false);
      qs('#map-notice').style.bottom = 'auto'; qs('#map-notice').style.top = '12px';
      return;
    }
    var sched = function () { requestAnimationFrame(onMapSize); };
    if (typeof ResizeObserver !== 'undefined') { new ResizeObserver(sched).observe(mapEl); }
    window.addEventListener('resize', debounce(onMapSize, 120));
    window.addEventListener('orientationchange', function () { setTimeout(onMapSize, 200); });
    onMapSize();
  }
  function pinIcon(sp, num, selected) {
    var inner = h('span', { class: 'pin' }, num ? h('b', { text: String(num) }) : icon('i-blossom'));
    var wrap = document.createElement('div'); wrap.appendChild(inner);
    return L.divIcon({ className: 'sk-pin' + (selected ? ' is-selected' : ''), html: wrap.innerHTML, iconSize: [44, 44], iconAnchor: [22, 22], popupAnchor: [0, -20], tooltipAnchor: [20, 0] });
  }
  function createMap() {
    M.map = L.map(mapEl, { trackResize: false, zoomControl: true, scrollWheelZoom: false, minZoom: 8, maxZoom: 18, zoomSnap: 0.5, attributionControl: true });
    M.tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>'
    }).addTo(M.map);
    M.tiles.on('tileload', function () { M.tileOk++; hideMapNotice(); });
    M.tiles.on('tileerror', function () {
      M.tileErr++;
      if (M.tileErr >= 3 && M.tileOk === 0) { mapNotice('地圖底圖載入失敗（可能是離線，或被網路擋下）。標記仍在，景點清單與 Google 地圖連結都能正常使用。', true); }
    });
    M.timer = setTimeout(function () { if (M.tileOk === 0) { mapNotice('地圖底圖載入很慢或失敗。標記仍在，景點清單與 Google 地圖連結都能正常使用。', true); } }, 9000);
    qs('#map-retry').addEventListener('click', function () {
      M.tileErr = 0; hideMapNotice(); M.tiles.redraw();
      clearTimeout(M.timer);
      M.timer = setTimeout(function () { if (M.tileOk === 0) { mapNotice('底圖還是載入不了。標記仍在，景點清單與 Google 地圖連結都能正常使用。', true); } }, 9000);
    });
    M.group = L.layerGroup().addTo(M.map);
    D.spots.forEach(function (sp) {
      if (!sp.mapped) { return; }
      var mk = L.marker([sp.lat, sp.lng], { icon: pinIcon(sp, null, false), keyboard: true, title: sp.zh, riseOnHover: true });
      mk.bindTooltip(sp.zh, { direction: 'top', className: 'sk-tip', offset: [0, -16] });
      mk.bindPopup(function () { return buildPopup(sp); }, { maxWidth: 260, autoPanPadding: [24, 24] });
      mk.on('click', function () { selectSpot(sp.id, { fromMap: true }); });
      M.markers[sp.id] = mk;
    });
    syncMarkers();
    updateUserMarker();
  }
  function buildPopup(sp) {
    var m = distTo(sp);
    var line = m === null ? '座標：' + sp.coordNote : (m > 50000 ? '直線約 ' + fmtDist(m) : '直線約 ' + fmtDist(m) + '，步行約 ' + fmtMin(walkMin(m)) + '（估算）');
    var btn = h('button', { type: 'button', class: 'pop-btn', text: '看清單中的說明' });
    btn.addEventListener('click', function () {
      if (isNarrow()) { setTab('list'); }
      selectSpot(sp.id, {});
      setTimeout(function () { scrollRowIntoView(sp.id); }, 60);
    });
    return h('div', null, [h('div', { class: 'pop-name', text: sp.zh }), sp.ja !== sp.zh ? h('div', { class: 'pop-ja', lang: 'ja', text: sp.ja }) : null, h('div', { class: 'pop-line', text: line }), btn]);
  }
  function visibleIds() {
    if (S.route) { return D.routes.filter(function (r) { return r.id === S.route; })[0].stops.map(function (s) { return s.id; }); }
    return D.spots.filter(function (s) { return s.mapped; }).map(function (s) { return s.id; });
  }
  function syncMarkers() {
    if (!M.map) { return; }
    var ids = visibleIds();
    Object.keys(M.markers).forEach(function (id) {
      var mk = M.markers[id], idx = ids.indexOf(id);
      if (idx < 0) { if (M.group.hasLayer(mk)) { M.group.removeLayer(mk); } return; }
      if (!M.group.hasLayer(mk)) { M.group.addLayer(mk); }
      mk.setIcon(pinIcon(BY_ID[id], S.route ? idx + 1 : null, S.selected === id));
    });
    if (M.line) { M.map.removeLayer(M.line); M.line = null; }
    M.tips.forEach(function (t) { M.map.removeLayer(t); }); M.tips = [];
    if (S.route) {
      var pts = ids.map(function (id) { return [BY_ID[id].lat, BY_ID[id].lng]; });
      M.line = L.polyline(pts, { color: '#a23b55', weight: 3.5, opacity: .85, dashArray: '1 9', lineCap: 'round', interactive: false }).addTo(M.map);
      for (var i = 0; i < ids.length - 1; i++) {
        var a = BY_ID[ids[i]], b = BY_ID[ids[i + 1]];
        var tip = L.tooltip({ permanent: true, direction: 'center', className: 'sk-leg', interactive: false })
          .setLatLng([(a.lat + b.lat) / 2, (a.lng + b.lng) / 2]).setContent(fmtDist(haversine(a, b)) + '（直線）');
        tip.addTo(M.map); M.tips.push(tip);
      }
    }
  }
  function updateUserMarker() {
    if (!M.map) { return; }
    if (M.user) { M.map.removeLayer(M.user); M.user = null; }
    if (!S.pos) { return; }
    if (haversine(S.pos, { lat: 35.6895, lng: 139.6917 }) > 40000) { return; } // 不在東京一帶就不畫在地圖上
    M.user = L.circleMarker([S.pos.lat, S.pos.lng], { radius: 9, color: '#ffffff', weight: 3, fillColor: '#2f5f8f', fillOpacity: 1 }).addTo(M.map);
    M.user.bindTooltip('你的位置（約略）', { direction: 'top', className: 'sk-tip' });
    if (M.lastFit) { fitView(); }
  }
  function fitView() {
    if (!M.map) { return; }
    var w = mapEl.clientWidth, hgt = mapEl.clientHeight;
    if (!w || !hgt) { return; }
    var pts = visibleIds().map(function (id) { return [BY_ID[id].lat, BY_ID[id].lng]; });
    if (!S.route && M.user) { pts.push(M.user.getLatLng()); }
    if (!pts.length) { return; }
    M.map.invalidateSize({ animate: false });
    var narrow = w < 520;
    M.map.fitBounds(L.latLngBounds(pts), { paddingTopLeft: narrow ? [36, 44] : [66, 60], paddingBottomRight: narrow ? [32, 52] : [60, 64], maxZoom: 15, animate: false });
    M.lastFit = { w: w, h: hgt };
    keepSelectedInView();
  }
  function keepSelectedInView() {
    var mk = S.selected && M.markers[S.selected];
    if (mk && M.group.hasLayer(mk) && !M.map.getBounds().contains(mk.getLatLng())) { M.map.panInside(mk.getLatLng(), { padding: [60, 60], animate: false }); }
  }
  function onMapSize() {
    if (M.failed || !hasLeaflet()) { return; }
    var w = mapEl.clientWidth, hgt = mapEl.clientHeight;
    if (!w || !hgt) { return; }          // 地圖被藏起來（0×0）時什麼都不做
    if (!M.map) { createMap(); fitView(); return; }
    var lf = M.lastFit;
    var big = !lf || Math.abs(w - lf.w) / lf.w > 0.25 || Math.abs(hgt - lf.h) / lf.h > 0.25 || ((w > hgt) !== (lf.w > lf.h));
    M.map.invalidateSize({ animate: false }); // 預設會保持中心點
    if (big) { fitView(); }
  }
  function mapSelectionChanged(opts) {
    if (!M.map) { return; }
    syncMarkers();
    var mk = M.markers[S.selected];
    if (!mk || !M.group.hasLayer(mk)) { return; }
    if (opts && opts.popup) {
      if (M.map.getSize().x > 0) { mk.openPopup(); }
    }
    if (opts && opts.fromMap) { scrollRowIntoViewIfDesktop(S.selected); }
  }
  function scrollRowIntoViewIfDesktop(id) { if (!isNarrow()) { scrollRowIntoView(id); } }

  /* ───────── 初始化 ───────── */
  function init() {
    renderModes();
    renderStatus();
    renderSpots();
    renderSeason();
    renderRoutes();
    renderAnswer();
    renderWx();
    bindTabs();
    buildPetals();
    qs('#loc-btn').addEventListener('click', locate);
    qs('#wx-retry').addEventListener('click', fetchWeather);
    qs('#route-clear').addEventListener('click', function () { setRoute(null, false); });
    setupMap();
    fetchWeather();
    // 歷年圖表隨寬度重畫
    if (typeof ResizeObserver !== 'undefined') {
      var last = qs('#history-chart').clientWidth;
      new ResizeObserver(function () {
        var w = qs('#history-chart').clientWidth;
        if (w && Math.abs(w - last) > 8) { last = w; renderHistory(); }
      }).observe(qs('#history-chart'));
    }
  }
  init();
})();
