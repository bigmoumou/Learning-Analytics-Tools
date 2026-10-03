/* 東京銀杏地圖 — script.js
 * 純 JavaScript（不使用框架、不使用 module），可直接以 file:// 開啟。
 * 資料來自 data.js（window.GINKGO_DATA）。
 */
(function () {
  'use strict';

  /* ------------------------------------------------------------
   * 0. 基本工具
   * ---------------------------------------------------------- */
  var D = window.GINKGO_DATA;
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  var MISSING = '<em class="missing">資料未提供</em>';
  function val(v) { return (v == null || v === '') ? MISSING : esc(v); }

  var mqDesktop = window.matchMedia('(min-width: 1024px)');
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function toast(msg) {
    var t = $('#toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('is-on');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.classList.remove('is-on'); }, 2200);
  }

  /* ------------------------------------------------------------
   * 1. 資料檢查（資料載入失敗時顯示錯誤狀態，不讓頁面壞掉）
   * ---------------------------------------------------------- */
  if (!D || !Array.isArray(D.spots) || !D.spots.length) {
    var listEl = $('#list');
    if (listEl) {
      listEl.innerHTML = '<div class="load-error" role="alert"><strong>資料載入失敗。</strong>找不到 data.js 的景點資料，請確認 data.js 與 index.html 放在同一個資料夾後重新整理。</div>';
    }
    var rc = $('#resultCount');
    if (rc) rc.innerHTML = '顯示 <b>0</b> / 0 處';
    var mm = $('#mapMsg');
    if (mm) {
      mm.hidden = false;
      mm.innerHTML = '<div class="map-msg-card"><h4>沒有可顯示的資料</h4><p>景點資料未載入，因此地圖不顯示標記。</p></div>';
    }
    ['#routeEmpty', '#stageTrack'].forEach(function (s) { var e = $(s); if (e && s === '#routeEmpty') e.innerHTML = '<p>資料未載入，無法規劃路線。</p>'; });
    return;
  }

  var SPOTS = D.spots;
  var BY_ID = {};
  SPOTS.forEach(function (s) { BY_ID[s.id] = s; });
  var STAGES = D.stages;
  var STAGE_BY_KEY = {};
  STAGES.forEach(function (st, i) { st.idx = i; STAGE_BY_KEY[st.key] = st; });
  var AREAS = D.areas;
  var AREA_BY_KEY = {};
  AREAS.forEach(function (a) { AREA_BY_KEY[a.key] = a; });

  function statusKey(s) { return s.status && STAGE_BY_KEY[s.status] ? s.status : 'nodata'; }
  function statusLabel(key) { return key === 'nodata' ? '資料未提供' : STAGE_BY_KEY[key].ja; }

  /* ------------------------------------------------------------
   * 2. 銀杏葉圖示（六階段填色不同；資料未提供＝虛線空心葉）
   * ---------------------------------------------------------- */
  var LEAF = 'M12 14.6C9.1 13.9 4.6 11.5 3.4 7.2 6.2 4.1 9.4 3.4 11.2 4l.8 3.4.8-3.4c1.8-.6 5 .1 7.8 3.2-1.2 4.3-5.7 6.7-8.6 7.4Z';
  var STEM = 'M12 14.6c.2 2.2.7 4.3 1.5 6.4';

  function leaf(key, extraCls) {
    var cls = 'leaf leaf--' + key + (extraCls ? ' ' + extraCls : '');
    var inner;
    if (key === 'nodata') {
      inner = '<path class="lf-body" d="' + LEAF + '"/><path class="lf-stem" d="' + STEM + '"/>';
    } else if (key === 'rakuyo1') {
      inner = '<g transform="translate(-1.2 -.6)"><path class="lf-body" fill="url(#lg-rakuyo1)" d="' + LEAF + '"/><path class="lf-stem" d="' + STEM + '"/></g>' +
        '<g class="lf-fall" transform="translate(19.6 17.6) rotate(38) scale(.34) translate(-12 -9)"><path fill="#E0A030" d="' + LEAF + '"/></g>';
    } else if (key === 'rakuyo') {
      inner = '<g transform="rotate(32 12 12) translate(0 -.4)"><path class="lf-body" fill="url(#lg-rakuyo)" d="' + LEAF + '"/><path class="lf-stem" d="' + STEM + '"/></g>' +
        '<path d="M3 21.6h18" stroke="#B9A894" stroke-width="1.2" stroke-linecap="round"/>' +
        '<g transform="translate(6.2 20.2) rotate(-12) scale(.3) translate(-12 -9)"><path fill="#9C8064" d="' + LEAF + '"/></g>';
    } else {
      inner = '<path class="lf-body" fill="url(#lg-' + key + ')" d="' + LEAF + '"/><path class="lf-stem" d="' + STEM + '"/>';
    }
    return '<svg class="' + cls + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + inner + '</svg>';
  }

  function badge(key, big) {
    return '<span class="badge badge--' + key + (big ? ' badge--lg' : '') + '">' + leaf(key) + esc(statusLabel(key)) + '</span>';
  }
  function gradeTag(g) {
    return '<span class="grade" title="' + esc(g + '：' + (D.grades[g] || '')) + '">' + esc(g) + '</span>';
  }

  var ICON = {
    plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
    ext: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 5h5v5M19 5l-8 8M17 14v5H5V7h5"/></svg>',
    back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5 8 12l7 7"/></svg>',
    up: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 14 6-6 6 6"/></svg>',
    down: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 10 6 6 6-6"/></svg>',
    x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17"/></svg>',
    shield: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5 5 6v5.5c0 4.2 2.9 7.7 7 9 4.1-1.3 7-4.8 7-9V6l-7-2.5Z"/><path d="m9 12 2.2 2.2L15.5 10"/></svg>',
    route: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="18" r="2.2"/><circle cx="18" cy="6" r="2.2"/><path d="M8.2 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.8"/></svg>',
    map: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4 3.5 6v14L9 18l6 2 5.5-2V4L15 6 9 4Zm0 0v14m6-12v14"/></svg>'
  };

  /* ------------------------------------------------------------
   * 3. 狀態（篩選、選取、路線）
   * ---------------------------------------------------------- */
  var state = {
    q: '', status: 'all', area: 'all',
    selected: null,
    picks: [],      // 選取順序
    route: [],      // 停靠順序
    auto: true      // true＝依最近距離自動排序
  };

  // 搜尋正規化：讓繁中與日文字形、イチョウ／銀杏互通
  var VARIANTS = [['國', '国'], ['舊', '旧'], ['黑', '黒'], ['戶', '戸'], ['區', '区'], ['澀', '渋'], ['廣', '広'], ['德', '徳'], ['綠', '緑'], ['學', '学'], ['營', '営'], ['紀念', '記念'], ['の', '之'], ['が', '之'], ['邊', '辺'], ['鄉', '郷'], ['濱', '浜'], ['驛', '駅'], ['站', '駅'], ['黃', '黄']];
  function norm(s) {
    s = String(s || '').normalize('NFKC').toLowerCase();
    s = s.replace(/(.)々/g, '$1$1');
    s = s.replace(/イチョウ|いちょう|ぎんなん|ginkgo/g, '銀杏');
    for (var i = 0; i < VARIANTS.length; i++) s = s.split(VARIANTS[i][0]).join(VARIANTS[i][1]);
    return s.replace(/\s+/g, '');
  }
  SPOTS.forEach(function (s) {
    var a = AREA_BY_KEY[s.area] || {};
    s._hay = norm([s.nameZh, s.nameJa, s.ward, a.label, s.address, s.intro, s.ginkgo, s.id].join('|'));
  });

  function match(s, ignore) {
    if (ignore !== 'q' && state.q) {
      var terms = state.q.split(/\s+/).filter(Boolean).map(norm);
      for (var i = 0; i < terms.length; i++) if (s._hay.indexOf(terms[i]) === -1) return false;
    }
    if (ignore !== 'status' && state.status !== 'all' && statusKey(s) !== state.status) return false;
    if (ignore !== 'area' && state.area !== 'all' && s.area !== state.area) return false;
    return true;
  }
  function visibleSpots() { return SPOTS.filter(function (s) { return match(s); }); }
  function filtersActive() { return !!state.q || state.status !== 'all' || state.area !== 'all'; }

  /* ------------------------------------------------------------
   * 4. 距離（直線，依近似座標）
   * ---------------------------------------------------------- */
  function dist(a, b) {
    var R = 6371000, rad = Math.PI / 180;
    var dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  function fmtDist(m) {
    if (m < 1000) return '<span class="num">' + Math.round(m / 10) * 10 + '</span> m';
    return '<span class="num">' + (m / 1000).toFixed(m < 10000 ? 1 : 0) + '</span> km';
  }
  function fmtDistText(m) { return m < 1000 ? (Math.round(m / 10) * 10) + ' m' : (m / 1000).toFixed(m < 10000 ? 1 : 0) + ' km'; }

  // 最近鄰排序：從第一個選取的景點出發
  function nearestOrder(ids) {
    if (ids.length < 3) return ids.slice();
    var rest = ids.slice(1), order = [ids[0]];
    while (rest.length) {
      var cur = BY_ID[order[order.length - 1]], best = 0, bestD = Infinity;
      for (var i = 0; i < rest.length; i++) {
        var d = dist(cur, BY_ID[rest[i]]);
        if (d < bestD) { bestD = d; best = i; }
      }
      order.push(rest.splice(best, 1)[0]);
    }
    return order;
  }

  /* ------------------------------------------------------------
   * 5. 靜態區塊：計數、圖例、六階段、JMA 參考、資料來源
   * ---------------------------------------------------------- */
  function bindCounts() {
    var known = SPOTS.filter(function (s) { return statusKey(s) !== 'nodata'; }).length;
    $$('[data-bind="spotCount"]').forEach(function (e) { e.textContent = SPOTS.length; });
    $$('[data-bind="areaCount"]').forEach(function (e) { e.textContent = AREAS.length; });
    $$('[data-bind="statusKnown"]').forEach(function (e) { e.textContent = known; });
  }

  function renderLegend() {
    var html = STAGES.map(function (st) { return '<span>' + leaf(st.key) + esc(st.ja) + '</span>'; }).join('');
    html += '<span><span class="lg-pin">' + leaf('nodata') + '</span>資料未提供</span>';
    $('#mapLegend').innerHTML = html;
  }

  function renderLifecycle() {
    var counts = {};
    SPOTS.forEach(function (s) { var k = statusKey(s); counts[k] = (counts[k] || 0) + 1; });
    $('#stageTrack').innerHTML = STAGES.map(function (st, i) {
      return '<li class="stage">' +
        '<div class="stage-icon">' + leaf(st.key) + '</div>' +
        '<p class="stage-step">STAGE 0' + (i + 1) + '</p>' +
        badge(st.key) +
        '<p class="stage-zh">' + esc(st.zh) + '</p>' +
        '<p class="stage-desc">' + esc(st.desc) + '</p>' +
        '<p class="stage-count">目前狀態 <b>' + (counts[st.key] || 0) + '</b> 處</p>' +
        '</li>';
    }).join('');
    $('#nodataRow').innerHTML =
      '<div class="stage-icon">' + leaf('nodata') + '</div>' +
      '<div class="nd-text">' + badge('nodata') + '<p style="margin-top:8px"><strong>官方來源尚未發布 2026 年銀杏階段時使用。</strong>以虛線框與空心葉片表示，和六個階段明顯區分；不以平年值或往年紀錄推估。</p></div>' +
      '<p class="nd-count"><b class="num">' + (counts.nodata || 0) + '</b>處</p>';
  }

  function md2doy(md) { // "11/23" -> day index from 11/10
    var p = md.split('/').map(Number);
    var base = Date.UTC(2001, 10, 10);
    return Math.round((Date.UTC(2001, p[0] - 1, p[1]) - base) / 86400000);
  }
  // 圖表依容器實際寬度繪製（文字維持 12px 以上，不隨縮放變小）
  function renderJMAChart() {
    var J = D.jma, years = Object.keys(J.recentYellow).sort();
    var box = $('#jmaChart');
    var W = Math.max(260, Math.round(box.clientWidth || 600));
    var L0 = 46, R0 = 14, top = 34, rowH = W < 480 ? 20 : 18, H = top + years.length * rowH + 30;
    var span = md2doy('12/12');
    var x = function (md) { return L0 + (md2doy(md) / span) * (W - L0 - R0); };
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" aria-hidden="true">';
    years.forEach(function (y, i) {
      var cy = top + i * rowH + rowH / 2;
      s += '<line class="row" x1="' + L0 + '" x2="' + (W - R0) + '" y1="' + cy + '" y2="' + cy + '"/>';
      s += '<text class="yr" x="' + (L0 - 10) + '" y="' + (cy + 4) + '" text-anchor="end">' + y + '</text>';
    });
    var yN = x(J.yellowNormal), fN = x(J.fallNormal), bottom = top + years.length * rowH;
    s += '<line class="normal" x1="' + yN + '" x2="' + yN + '" y1="' + (top - 8) + '" y2="' + bottom + '"/>';
    s += '<text class="nlabel" x="' + (yN + 4) + '" y="' + (top - 14) + '" text-anchor="end">黃葉平年 ' + esc(J.yellowNormal) + '</text>';
    s += '<line class="normal-fall" x1="' + fN + '" x2="' + fN + '" y1="' + (top - 8) + '" y2="' + bottom + '"/>';
    s += '<text class="nlabel-fall" x="' + Math.min(fN - 4, W - 96) + '" y="' + (top - 14) + '" text-anchor="start">落葉平年 ' + esc(J.fallNormal) + '</text>';
    years.forEach(function (y, i) {
      var cy = top + i * rowH + rowH / 2, md = J.recentYellow[y];
      s += '<circle class="dot' + (i === years.length - 1 ? ' last' : '') + '" cx="' + x(md) + '" cy="' + cy + '" r="5.5"><title>' + y + ' 年黃葉日 ' + md + '</title></circle>';
    });
    s += '<line class="ax" x1="' + L0 + '" x2="' + (W - R0) + '" y1="' + bottom + '" y2="' + bottom + '"/>';
    (W < 480 ? ['11/10', '11/20', '11/30', '12/10'] : ['11/10', '11/15', '11/20', '11/25', '11/30', '12/5', '12/10']).forEach(function (t) {
      s += '<text class="tick" x="' + x(t) + '" y="' + (bottom + 20) + '" text-anchor="middle">' + t + '</text>';
    });
    s += '</svg>';
    box.innerHTML = s;
    box.setAttribute('data-w', W);
    // 窄螢幕時，「落葉平年」標籤若超出右緣就往左收
    var fl = box.querySelector('.nlabel-fall');
    try {
      var bb = fl && fl.getBBox();
      if (bb && bb.width && bb.x + bb.width > W - 2) fl.setAttribute('x', Math.max(0, W - 2 - bb.width));
    } catch (e) { /* getBBox 不可用時維持原位 */ }
  }
  function renderJMA() {
    var J = D.jma;
    renderJMAChart();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(renderJMAChart);
    var rt = null;
    window.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(function () {
        var box = $('#jmaChart');
        if (Math.abs((box.clientWidth || 0) - (+box.getAttribute('data-w') || 0)) > 8) renderJMAChart();
      }, 160);
    });

    $('#jmaFacts').innerHTML =
      '<dt>黃葉日平年值</dt><dd><span class="num">' + esc(J.yellowNormal) + '</span>（1991–2020）</dd>' +
      '<dt>落葉日平年值</dt><dd><span class="num">' + esc(J.fallNormal) + '</span></dd>' +
      '<dt>2025 年觀測</dt><dd>黃葉 <span class="num">' + esc(J.yellow2025) + '</span>・落葉 <span class="num">' + esc(J.fall2025) + '</span></dd>' +
      '<dt>2026 年</dt><dd>' + esc(J.status2026) + '</dd>' +
      '<dt>黃葉日定義</dt><dd>' + esc(J.defYellow) + '</dd>' +
      '<dt>落葉日定義</dt><dd>' + esc(J.defFall) + '</dd>' +
      '<dd class="src">來源：' + J.sources.slice(0, 2).map(function (r) {
        return '<a href="' + esc(r.url) + '" target="_blank" rel="noopener">' + esc(r.label.replace('氣象廳｜', '氣象廳 ')) + '</a>';
      }).join('') + '</dd>';
  }

  function renderSources() {
    $('#sheetLink').href = D.sheetUrl;
    $('#gradeKey').innerHTML = Object.keys(D.grades).map(function (g) {
      return '<span>' + gradeTag(g) + esc(D.grades[g]) + '</span>';
    }).join('');

    $('#sourceList').innerHTML = SPOTS.map(function (s) {
      var seen = {}, items = [];
      function add(kind, label, url) {
        if (!url || seen[url]) return; seen[url] = 1;
        items.push('<li><span class="kind">' + esc(kind) + '</span><a href="' + esc(url) + '" target="_blank" rel="noopener">' + esc(label) + '</a></li>');
      }
      s.sources.forEach(function (r) { add('官方', r.label, r.url); });
      if (s.proof) add('銀杏佐證', s.proof.label, s.proof.url);
      (s.past || []).forEach(function (p) { add('過去紀錄', p.date + ' 原文', p.url); });
      if (s.season) add('例年說明', '例年觀賞期說明', s.season.url);
      return '<article class="src-card"><div class="src-card-head"><h4>' + esc(s.nameZh) + '</h4><span>' + esc(s.id) + ' · ' + esc(s.grade) + '</span></div><ul>' + items.join('') + '</ul></article>';
    }).join('');

    var refs = D.jma.sources.concat([{ label: '東京都公園協會｜2025 年度紅葉情報新聞稿（PDF，S 級景點的銀杏依據）', url: D.pressRelease }]);
    $('#refList').innerHTML = refs.map(function (r) {
      return '<li><a href="' + esc(r.url) + '" target="_blank" rel="noopener">' + esc(r.label) + '</a></li>';
    }).join('');

    $('#otherCount').textContent = D.otherRows.length;
    // X 級（已排除或已失效）只列文字與網址，不做成可點的連結
    $('#otherRows').innerHTML = D.otherRows.map(function (o) {
      var body = o.grade === 'X'
        ? '<span class="dead"><span class="dead-name">' + esc(o.name) + '</span><code>' + esc(o.url) + '</code></span>'
        : '<a href="' + esc(o.url) + '" target="_blank" rel="noopener">' + esc(o.name) + '</a>';
      return '<li' + (o.grade === 'X' ? ' class="is-x"' : '') + '><span class="oid">' + esc(o.id) + ' · ' + esc(o.grade) + '</span>' + body + '<p>' + esc(o.reason) + '</p></li>';
    }).join('');
  }

  /* ------------------------------------------------------------
   * 6. 篩選列
   * ---------------------------------------------------------- */
  function renderFilters() {
    var base = SPOTS.filter(function (s) { return match(s, 'status'); });
    var cnt = { all: base.length };
    base.forEach(function (s) { var k = statusKey(s); cnt[k] = (cnt[k] || 0) + 1; });

    var chips = [{ key: 'all', label: '全部狀態' }].concat(STAGES.map(function (st) { return { key: st.key, label: st.ja }; }));
    var html = chips.map(function (c) {
      var n = cnt[c.key] || 0;
      return '<button type="button" class="chip' + (c.key === 'all' ? ' chip--all' : '') + (n === 0 ? ' is-zero' : '') + '" data-status="' + c.key + '" aria-pressed="' + (state.status === c.key) + '">' +
        (c.key === 'all' ? '' : leaf(c.key)) + '<span>' + esc(c.label) + '</span><span class="chip-count" aria-label="' + n + ' 處">' + n + '</span></button>';
    }).join('');
    var nd = cnt.nodata || 0;
    html += '<span class="chip-sep" aria-hidden="true"></span>' +
      '<button type="button" class="chip' + (nd === 0 ? ' is-zero' : '') + '" data-status="nodata" aria-pressed="' + (state.status === 'nodata') + '">' + leaf('nodata') + '<span>資料未提供</span><span class="chip-count" aria-label="' + nd + ' 處">' + nd + '</span></button>';
    $('#statusChips').innerHTML = html;

    var aBase = SPOTS.filter(function (s) { return match(s, 'area'); });
    var aSel = $('#areaSel');
    aSel.innerHTML = '<option value="all">全部（' + aBase.length + '）</option>' + AREAS.map(function (a) {
      var n = aBase.filter(function (s) { return s.area === a.key; }).length;
      return '<option value="' + a.key + '">' + esc(a.label) + '（' + n + '）</option>';
    }).join('');
    aSel.value = state.area;

    // 「清除篩選」固定佔位，沒有篩選時停用，避免篩選列跳動
    $('#clearFilters').disabled = !filtersActive();
    $('#qClear').hidden = !state.q;
  }

  /* ------------------------------------------------------------
   * 7. 景點列表
   * ---------------------------------------------------------- */
  var firstListRender = true;
  function cardHTML(s) {
    var inRoute = state.route.indexOf(s.id) !== -1;
    return '<article class="spot-card' + (state.selected === s.id ? ' is-active' : '') + '" data-id="' + esc(s.id) + '">' +
      '<button type="button" class="spot-main" data-open="' + esc(s.id) + '" aria-label="查看「' + esc(s.nameZh) + '」詳情">' +
      '<span class="spot-eyebrow">' + esc(s.ward) + '</span>' +
      '<span class="spot-name">' + esc(s.nameZh) + '</span>' +
      (s.nameJa !== s.nameZh ? '<span class="spot-ja" lang="ja">' + esc(s.nameJa) + '</span>' : '') +
      '<span class="spot-meta">' + badge(statusKey(s)) + gradeTag(s.grade) +
      '<span class="spot-date"><em>查核</em> 2026-10-02</span></span>' +
      '</button>' +
      routeToggleHTML(s.id, inRoute) +
      '</article>';
  }
  function routeToggleLabel(id, inRoute) { return (inRoute ? '從路線移除' : '加入路線') + '：' + BY_ID[id].nameZh; }
  function routeToggleInner(inRoute) { return (inRoute ? ICON.check : ICON.plus) + '<span>' + (inRoute ? '已加入' : '加入路線') + '</span>'; }
  function routeToggleHTML(id, inRoute) {
    return '<button type="button" class="route-toggle" data-route="' + esc(id) + '" aria-pressed="' + inRoute + '" aria-label="' + esc(routeToggleLabel(id, inRoute)) + '">' +
      routeToggleInner(inRoute) + '</button>';
  }

  function emptyHTML() {
    var stage = state.status !== 'all' && state.status !== 'nodata' ? STAGE_BY_KEY[state.status] : null;
    var title = stage ? '目前沒有「' + esc(stage.ja) + '」的景點' : '找不到符合條件的景點';
    var msg = stage
      ? '截至 2026-10-02 快照，沒有任何官方來源發布 2026 年的「' + esc(stage.ja) + '」狀態。各景點目前皆為「資料未提供」。'
      : '試試其他關鍵字（例如「並木」「新宿」「大銀杏」），或清除篩選條件。';
    return '<div class="empty" role="status">' + leaf(stage ? stage.key : 'nodata') +
      '<h4>' + title + '</h4><p>' + msg + '</p>' +
      '<button type="button" class="btn btn-primary" data-reset="1">清除篩選，顯示全部 ' + SPOTS.length + ' 處</button></div>';
  }

  function renderList() {
    var vis = visibleSpots();
    $('#resultCount').innerHTML = '顯示 <b>' + vis.length + '</b> / ' + SPOTS.length + ' 處';
    var list = $('#list');
    if (!vis.length) {
      list.innerHTML = emptyHTML();
    } else {
      var html = '';
      AREAS.forEach(function (a) {
        var group = vis.filter(function (s) { return s.area === a.key; });
        if (!group.length) return;
        html += '<p class="list-group-title"><span class="lgt-name">' + esc(a.label) + '<small>' + esc(a.sub) + '</small></span><span class="lgt-count">' + group.length + '</span></p>';
        html += group.map(cardHTML).join('');
      });
      list.innerHTML = html;
    }
    if (!firstListRender) $$('.spot-card', list).forEach(function (c) { c.style.animation = 'none'; });
    firstListRender = false;
    $('#panelSub').textContent = filtersActive() ? '已套用篩選 · 點選查看詳情' : '依區域排列 · 點選查看詳情';
  }

  function applyFilters(opts) {
    renderFilters();
    renderList();
    updateMarkers(opts && opts.fit);
  }

  /* ------------------------------------------------------------
   * 8. 地圖（Leaflet；失敗時顯示友善訊息，其餘功能照常）
   * ---------------------------------------------------------- */
  var map = null, markers = {}, markerLayer = null, mainRouteLine = null, pendingFit = false;
  var routeMap = null, routeLayer = null;

  function mapFailHTML(title, msg) {
    return '<div class="map-msg-card"><svg viewBox="0 0 48 48" aria-hidden="true"><path d="M17 8 6 12v28l11-4 14 4 11-4V8l-11 4-14-4Zm0 0v28m14-24v28"/><path d="m20 20 8 8m0-8-8 8"/></svg>' +
      '<h4>' + esc(title) + '</h4><p>' + esc(msg) + '</p></div>';
  }

  // 底圖：OpenStreetMap 標準圖磚（以 CSS 調成淡雅暖色）。
  // 註：CARTO 底圖在 file:// 下會回傳「API KEY REQUIRED」佔位圖，因此不使用。
  function addTiles(m, onTotalFail) {
    var errors = 0, loads = 0, failed = false;
    var layer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19
    });
    layer.on('tileload', function () { loads++; });
    layer.on('tileerror', function () {
      errors++;
      if (!failed && errors >= 4 && loads === 0) { failed = true; onTotalFail(); }
    });
    layer.addTo(m);
    return layer;
  }

  function pinIcon(s) {
    var k = statusKey(s);
    var idx = state.route.indexOf(s.id);
    var cls = 'gpin gpin--' + k + (state.selected === s.id ? ' is-active' : '') + (idx !== -1 ? ' is-route' : '');
    var html = '<span class="' + cls + '" data-pin="' + esc(s.id) + '">' + leaf(k) +
      (idx !== -1 ? '<b class="gpin-num">' + (idx + 1) + '</b>' : '') + '</span>';
    return L.divIcon({ className: 'gpin-icon', html: html, iconSize: [44, 44], iconAnchor: [22, 22], tooltipAnchor: [0, -18] });
  }

  function initMap() {
    var msg = $('#mapMsg');
    if (typeof L === 'undefined') {
      msg.hidden = false;
      msg.innerHTML = mapFailHTML('地圖暫時無法載入', '地圖程式庫沒有成功載入（可能離線或連線被封鎖）。景點列表、搜尋篩選、景點詳情與路線規劃仍可正常使用。');
      return;
    }
    try {
      // trackResize 關閉：地圖隱藏（display:none）時 Leaflet 不會記下 0×0 尺寸；改由 watchMapSize() 處理尺寸變化
      map = L.map('map', { zoomControl: true, scrollWheelZoom: false, minZoom: 8, maxZoom: 18, zoomSnap: 0.5, trackResize: false });
      map.attributionControl.setPrefix('<a href="https://leafletjs.com/" target="_blank" rel="noopener">Leaflet</a>');
      addTiles(map, function () {
        msg.hidden = false;
        msg.classList.add('is-banner');
        msg.innerHTML = '<p><strong>底圖圖磚無法載入</strong>（可能離線）。景點標記、列表與路線規劃仍可使用。</p>';
      });
      markerLayer = L.layerGroup().addTo(map);
      SPOTS.forEach(function (s) {
        var mk = L.marker([s.lat, s.lng], { icon: pinIcon(s), keyboard: true, title: s.nameZh, alt: s.nameZh, riseOnHover: true });
        mk.bindTooltip('<b>' + esc(s.nameZh) + '</b><small>' + esc(s.ward) + '・' + esc(statusLabel(statusKey(s))) + '</small>', { className: 'gtip', direction: 'top', offset: [0, -4] });
        mk.on('click', function () { openSpot(s.id, { from: 'map' }); });
        mk.on('mouseover', function () { hoverCard(s.id, true); });
        mk.on('mouseout', function () { hoverCard(s.id, false); });
        markers[s.id] = mk;
      });
      // 縮小檢視時標記跟著變小，避免市中心的標記擠成一團
      var syncFar = function () { map.getContainer().classList.toggle('is-far', map.getZoom() < 11); };
      map.on('zoomend', syncFar);
      updateMarkers(true);
      syncFar();
      // 鍵盤：在標記上按 Enter 或空白鍵開啟詳情
      map.getContainer().addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        var icon = e.target.closest && e.target.closest('.leaflet-marker-icon');
        var pin = icon && icon.querySelector('[data-pin]');
        if (!pin) return;
        e.preventDefault();
        e.stopPropagation();
        openSpot(pin.getAttribute('data-pin'), { from: 'map' });
      });
      // 滾輪縮放：點一下地圖後才啟用，避免捲動頁面時誤觸
      map.on('click focus', function () { map.scrollWheelZoom.enable(); });
      map.getContainer().addEventListener('mouseleave', function () { map.scrollWheelZoom.disable(); });
      watchMapSize();
    } catch (e) {
      msg.hidden = false;
      msg.innerHTML = mapFailHTML('地圖初始化失敗', '請重新整理頁面。景點列表與其他功能仍可使用。');
      map = null;
    }
  }

  // 地圖尺寸：只在容器有實際大小時才 invalidateSize；版面跨過桌機／行動斷點，
  // 或地圖容器寬／高變化超過約 25%、方向翻轉（不論當時地圖是否可見）後，下次地圖可見時重新框選
  var mapW = 0, mapH = 0, baseW = 0, baseH = 0, layoutRefit = false;
  function syncMapSize() {
    if (!map) return;
    var c = map.getContainer(), w = c.clientWidth, h = c.clientHeight;
    if (!w || !h) return; // 隱藏中（0×0）：不更新尺寸，避免視角偏移
    var hadSize = mapW > 0 && mapH > 0;
    mapW = w; mapH = h;
    map.invalidateSize(hadSize ? {} : { pan: false });
    if (!baseW) { baseW = w; baseH = h; }
    var bigChange = Math.abs(w - baseW) > baseW * 0.25 || Math.abs(h - baseH) > baseH * 0.25 || (w > h) !== (baseW > baseH);
    if (layoutRefit || bigChange) {
      layoutRefit = false;
      baseW = w; baseH = h;
      var focusing = !!state.selected && (!sheet.hidden || !$('#panelDetail').hidden);
      if (focusing) focusOnMap(state.selected);
      else if (state.route.length >= 2) {
        pendingFit = false;
        map.fitBounds(state.route.map(function (id) { return [BY_ID[id].lat, BY_ID[id].lng]; }), { padding: [50, 50], maxZoom: 15, animate: !reduceMotion });
      } else updateMarkers(true, true); // 尺寸大變動後框選：含仍顯示的已選景點／路線標記
    } else if (pendingFit) updateMarkers(true);
  }
  function watchMapSize() {
    var c = map.getContainer();
    if (typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(function () { syncMapSize(); }).observe(c);
    } else {
      var rt = null;
      window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(syncMapSize, 120); });
    }
  }

  function updateMarkers(fit, fitShown) {
    if (!map) return;
    var vis = visibleSpots();
    var visSet = {};
    vis.forEach(function (s) { visSet[s.id] = 1; });
    SPOTS.forEach(function (s) {
      var mk = markers[s.id];
      var show = !!visSet[s.id] || state.selected === s.id || state.route.indexOf(s.id) !== -1;
      if (show && !markerLayer.hasLayer(mk)) markerLayer.addLayer(mk);
      if (!show && markerLayer.hasLayer(mk)) markerLayer.removeLayer(mk);
      mk.setIcon(pinIcon(s));
      mk.setZIndexOffset(state.selected === s.id ? 1000 : (state.route.indexOf(s.id) !== -1 ? 500 : 0));
    });
    if (fit && map.getContainer().clientWidth === 0) { pendingFit = true; fit = false; }
    var pts = fitShown ? SPOTS.filter(function (s) { return markerLayer.hasLayer(markers[s.id]); }) : vis;
    if (fit && pts.length) {
      pendingFit = false;
      var b = L.latLngBounds(pts.map(function (s) { return [s.lat, s.lng]; }));
      if (pts.length === 1) map.setView(b.getCenter(), 14, { animate: !reduceMotion });
      else { var pad = mqDesktop.matches ? 40 : 14; map.fitBounds(b, { padding: [pad, pad], maxZoom: 14, animate: !reduceMotion }); }
    }
    drawMainRoute();
  }

  function refreshPins() {
    if (!map) return;
    SPOTS.forEach(function (s) {
      markers[s.id].setIcon(pinIcon(s));
      markers[s.id].setZIndexOffset(state.selected === s.id ? 1000 : (state.route.indexOf(s.id) !== -1 ? 500 : 0));
    });
  }

  function drawMainRoute() {
    if (!map) return;
    if (mainRouteLine) { map.removeLayer(mainRouteLine); mainRouteLine = null; }
    if (state.route.length >= 2) {
      mainRouteLine = L.polyline(state.route.map(function (id) { return [BY_ID[id].lat, BY_ID[id].lng]; }),
        { color: '#B8860B', weight: 3, opacity: .9, dashArray: '7 8', interactive: false }).addTo(map);
    }
  }

  function hoverCard(id, on) {
    var c = $('.spot-card[data-id="' + cssEsc(id) + '"]');
    if (c) c.classList.toggle('is-hover', on);
  }
  function hoverPin(id, on) {
    var p = $('[data-pin="' + cssEsc(id) + '"]');
    if (p) p.classList.toggle('is-hover', on);
  }
  function cssEsc(s) { return String(s).replace(/["\\]/g, '\\$&'); }

  function focusOnMap(id) {
    if (!map) return;
    var s = BY_ID[id];
    var ll = L.latLng(s.lat, s.lng);
    if (!map._loaded) {
      // 地圖尚無視角（例如行動版從未開過地圖）：可見時直接以該景點為中心，隱藏時等下次可見再框選
      var c = map.getContainer();
      if (c.clientWidth && c.clientHeight) map.setView(ll, 13, { animate: false });
      else layoutRefit = true;
      return;
    }
    if (map.getZoom() < 12) map.setView(ll, 13, { animate: !reduceMotion });
    else if (!map.getBounds().pad(-0.15).contains(ll)) map.panTo(ll, { animate: !reduceMotion });
  }

  /* ------------------------------------------------------------
   * 9. 景點詳情（桌機：側欄；行動：bottom sheet）
   * ---------------------------------------------------------- */
  function detailHTML(s, ctx) {
    var a = AREA_BY_KEY[s.area];
    var k = statusKey(s);
    var inRoute = state.route.indexOf(s.id) !== -1;
    var titleId = ctx === 'sheet' ? 'sheetTitle' : 'panelTitle';
    var h = '<article class="detail">';
    if (ctx === 'panel') {
      h += '<div class="detail-bar"><button type="button" class="back-btn" data-back="1">' + ICON.back + '返回列表</button><span class="detail-id">' + esc(s.id) + '</span></div>';
    }
    h += '<header class="detail-hero">' +
      '<p class="detail-eyebrow">' + esc(s.ward) + '・' + esc(a.label) + (ctx === 'sheet' ? '・' + esc(s.id) : '') + '</p>' +
      '<h3 class="detail-title" id="' + titleId + '">' + esc(s.nameZh) + '</h3>' +
      (s.nameJa !== s.nameZh ? '<p class="detail-ja" lang="ja">' + esc(s.nameJa) + '</p>' : '') +
      '<div class="detail-status"><p class="detail-status-label">目前狀態</p>' + badge(k, true) +
      '<p class="note">' + (k === 'nodata'
        ? '截至 2026-10-02 快照，此景點的官方來源尚未發布 2026 年的銀杏階段，因此不標示推估狀態。'
        : '依官方來源發布的狀態。') + '</p></div>' +
      '<div class="detail-actions">' +
      '<button type="button" class="btn btn-primary btn-route" data-route="' + esc(s.id) + '" aria-pressed="' + inRoute + '">' + (inRoute ? ICON.check + '已加入路線（點擊移除）' : ICON.route + '加入散步路線') + '</button>' +
      (ctx === 'sheet' && map ? '<button type="button" class="btn btn-ghost" data-showmap="' + esc(s.id) + '">' + ICON.map + '在地圖上查看</button>' : '') +
      '</div></header>';

    h += '<dl class="dl-grid">' +
      '<dt>更新日期</dt><dd>狀態查核 <span class="num">2026-10-02</span>（靜態快照）<small>資料表證據日期：' + val(s.evidenceDate) + '</small></dd>' +
      '<dt>位置</dt><dd><span lang="ja">' + val(s.address) + '</span><small>' + esc(s.coordNote) + '</small></dd>' +
      '<dt>來源等級</dt><dd>' + gradeTag(s.grade) + ' ' + esc(D.grades[s.grade] || '') + '</dd>' +
      '</dl>';

    h += '<section class="d-sec"><h4>簡介</h4><p>' + val(s.intro) + '</p><p>' + val(s.ginkgo) + '</p>';
    if (s.proof) h += '<p class="proof">' + ICON.shield + '<span>此景點的銀杏佐證來自官方網站：<a href="' + esc(s.proof.url) + '" target="_blank" rel="noopener">' + esc(s.proof.label) + '</a></span></p>';
    if (s.season) h += '<p class="season-box"><b>官方例年說明：</b>' + esc(s.season.text) + ' <a href="' + esc(s.season.url) + '" target="_blank" rel="noopener">來源</a></p>';
    h += '</section>';

    h += '<section class="d-sec"><h4>上季／過去官方紀錄</h4>';
    if (s.past && s.past.length) {
      h += '<p class="hint" style="margin-bottom:10px">以下是有日期的過去紀錄，只供參考，<strong>不是目前狀態</strong>，也不影響狀態篩選。</p><ul class="past-list">' +
        s.past.map(function (p) {
          return '<li class="past-item"><div class="past-head"><span class="past-date">' + esc(p.date) + '</span><span class="past-tag">過去紀錄・非目前狀態</span>' +
            (p.stage ? badge(p.stage) : '') + '</div><p>' + esc(p.text) + '</p>' +
            '<a href="' + esc(p.url) + '" target="_blank" rel="noopener">查看官方原文</a></li>';
        }).join('') + '</ul>';
    } else {
      h += '<p class="hint">官方來源沒有可引用、附日期的過去銀杏紀錄（資料未提供）。</p>';
    }
    h += '</section>';

    var v = s.visit || {};
    h += '<section class="d-sec"><h4>參觀資訊（官方）</h4><dl class="dl-grid" style="margin-top:0">' +
      '<dt>開放時間</dt><dd>' + val(v.hours) + '</dd>' +
      '<dt>休園日</dt><dd>' + val(v.closed) + '</dd>' +
      '<dt>費用</dt><dd>' + val(v.fee) + '</dd>' +
      (v.event ? '<dt>官方公告</dt><dd>' + esc(v.event) + '</dd>' : '') +
      '</dl></section>';

    h += '<section class="d-sec"><h4>注意</h4><p>' + val(s.caveat) + '</p></section>';

    var links = s.sources.slice();
    if (s.proof) links.push(s.proof);
    h += '<section class="d-sec"><h4>官方來源</h4><ul class="src-links">' + links.map(function (r) {
      return '<li><a href="' + esc(r.url) + '" target="_blank" rel="noopener">' + ICON.ext + '<span>' + esc(r.label) + '<span class="u">' + esc(r.url) + '</span></span></a></li>';
    }).join('') + '</ul><p class="hint" style="margin-top:10px">資料依據：<a href="' + esc(D.sheetUrl) + '" target="_blank" rel="noopener">老師提供的東京銀杏資料表</a>（' + esc(s.id.replace(/-(hongo|komaba)$/, '')) + '）</p></section>';
    h += '</article>';
    return h;
  }

  var lastTrigger = null;

  function openSpot(id, opts) {
    opts = opts || {};
    if (!BY_ID[id]) return;
    lastTrigger = document.activeElement;
    state.selected = id;
    state.openedFrom = opts.from || 'list';
    $$('.spot-card').forEach(function (c) { c.classList.toggle('is-active', c.getAttribute('data-id') === id); });
    refreshPins();
    if (mqDesktop.matches) {
      showPanelDetail(id);
      focusOnMap(id);
    } else {
      openSheet(id);
    }
  }

  function showPanelDetail(id) {
    var pd = $('#panelDetail');
    pd.innerHTML = detailHTML(BY_ID[id], 'panel');
    $('#panelList').hidden = true;
    pd.hidden = false;
    pd.scrollTop = 0;
    pd.style.animation = 'none'; void pd.offsetWidth; pd.style.animation = '';
    pd.focus({ preventScroll: true });
    // 面板頂端若被 sticky 篩選列蓋住，捲回可見位置，讓「返回列表」與標題露出
    var panel = $('#panel'), fbEl = $('#filterbar');
    if (panel && fbEl) {
      var top = panel.getBoundingClientRect().top, fb = fbEl.getBoundingClientRect().bottom;
      if (top < fb) window.scrollBy({ top: top - fb - 12, behavior: reduceMotion ? 'auto' : 'smooth' });
    }
  }
  function closePanelDetail() {
    var pd = $('#panelDetail');
    if (pd.hidden) return;
    pd.hidden = true;
    $('#panelList').hidden = false;
    // 從地圖標記開啟的，焦點回到同一個標記（與手機 bottom sheet 一致）
    var mk = state.openedFrom === 'map' && state.selected && markers[state.selected];
    var pinEl = mk && mk.getElement && mk.getElement();
    if (pinEl && document.body.contains(pinEl)) { try { pinEl.focus({ preventScroll: true }); return; } catch (e) { /* 改用卡片 */ } }
    var card = $('.spot-card[data-id="' + cssEsc(state.selected) + '"]');
    if (card) {
      card.scrollIntoView({ block: 'nearest' });
      var b = $('.spot-main', card); if (b) b.focus({ preventScroll: true });
    }
  }

  /* bottom sheet */
  var sheet = $('#sheet'), backdrop = $('#sheetBackdrop');
  function openSheet(id) {
    $('#sheetBody').innerHTML = detailHTML(BY_ID[id], 'sheet');
    $('#sheetBody').scrollTop = 0;
    sheet.hidden = false; backdrop.hidden = false;
    sheet.style.transform = '';
    void sheet.offsetWidth;
    sheet.classList.add('is-open'); backdrop.classList.add('is-open');
    document.documentElement.style.overflow = 'hidden';
    setTimeout(function () { $('#sheetClose').focus({ preventScroll: true }); }, 30);
  }
  function closeSheet(keepFocus) {
    if (sheet.hidden) return;
    sheet.classList.remove('is-open'); backdrop.classList.remove('is-open');
    sheet.style.transform = '';
    document.documentElement.style.overflow = '';
    setTimeout(function () { sheet.hidden = true; backdrop.hidden = true; }, reduceMotion ? 0 : 380);
    if (keepFocus) return;
    var back = lastTrigger && document.body.contains(lastTrigger) ? lastTrigger : null;
    // 從地圖標記開啟時，標記圖示會重繪；改把焦點還給同一個標記
    if (!back && state.selected && markers[state.selected] && markers[state.selected].getElement()) back = markers[state.selected].getElement();
    if (back) { try { back.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
  }
  // 往下滑動關閉
  (function () {
    var y0 = null, dy = 0;
    var grip = $('#sheetGrip');
    function start(e) { y0 = (e.touches ? e.touches[0] : e).clientY; dy = 0; sheet.style.transition = 'none'; }
    function move(e) {
      if (y0 == null) return;
      dy = Math.max(0, (e.touches ? e.touches[0] : e).clientY - y0);
      sheet.style.transform = 'translateY(' + dy + 'px)';
    }
    function end() {
      if (y0 == null) return;
      sheet.style.transition = '';
      if (dy > 90) closeSheet(); else sheet.style.transform = '';
      y0 = null;
    }
    grip.addEventListener('touchstart', start, { passive: true });
    grip.addEventListener('touchmove', move, { passive: true });
    grip.addEventListener('touchend', end);
  })();

  /* ------------------------------------------------------------
   * 10. 銀杏散步路線規劃
   * ---------------------------------------------------------- */
  function toggleRoute(id) {
    var s = BY_ID[id];
    if (!s) return;
    var i = state.picks.indexOf(id);
    if (i !== -1) {
      state.picks.splice(i, 1);
      state.route.splice(state.route.indexOf(id), 1);
      if (state.auto) state.route = nearestOrder(state.picks);
      toast('已從路線移除：' + s.nameZh);
    } else {
      state.picks.push(id);
      if (state.auto) state.route = nearestOrder(state.picks);
      else state.route.push(id);
      toast('已加入路線：' + s.nameZh + '（第 ' + (state.route.indexOf(id) + 1) + ' 站）');
    }
    syncRoute();
  }
  function moveStop(idx, dir) {
    var j = idx + dir;
    if (j < 0 || j >= state.route.length) return;
    var r = state.route, t = r[idx];
    r[idx] = r[j]; r[j] = t;
    state.auto = false;
    syncRoute(r[j]);
  }
  function reorderNN() {
    state.auto = true;
    state.route = nearestOrder(state.picks);
    syncRoute();
    toast('已依最近距離重新排序');
  }
  function clearRoute() {
    state.picks = []; state.route = []; state.auto = true;
    syncRoute();
    toast('已清空路線');
    // 「清空」按鈕會被停用；把焦點移到空狀態標題，鍵盤使用者不會失去位置
    var h = $('#routeEmptyTitle');
    if (h) h.focus({ preventScroll: true });
  }

  function syncRoute(movedId) {
    // 更新所有「加入路線」按鈕
    $$('[data-route]').forEach(function (b) {
      var id = b.getAttribute('data-route');
      var inR = state.route.indexOf(id) !== -1;
      if (b.classList.contains('route-toggle')) {
        // 原地更新，不替換按鈕，鍵盤焦點才不會遺失
        if (b.getAttribute('aria-pressed') === String(inR)) return;
        b.setAttribute('aria-pressed', inR);
        b.setAttribute('aria-label', routeToggleLabel(id, inR));
        b.innerHTML = routeToggleInner(inR);
      } else if (b.classList.contains('btn-route')) {
        b.setAttribute('aria-pressed', inR);
        b.innerHTML = inR ? ICON.check + '已加入路線（點擊移除）' : ICON.route + '加入散步路線';
      }
    });
    renderPicks();
    renderRoute(movedId);
    refreshPins();
    if (map) updateMarkers(false);
  }

  function renderPicks() {
    $('#pickGroups').innerHTML = AREAS.map(function (a) {
      var group = SPOTS.filter(function (s) { return s.area === a.key; });
      return '<div class="pick-group"><h4>' + esc(a.label) + '<small>' + esc(a.sub) + '</small></h4><div class="pick-chips">' +
        group.map(function (s) {
          var idx = state.route.indexOf(s.id);
          return '<button type="button" class="pick" data-pick="' + esc(s.id) + '" aria-pressed="' + (idx !== -1) + '">' +
            '<span class="pick-mark" aria-hidden="true">' + (idx !== -1 ? (idx + 1) : ICON.plus) + '</span>' + esc(s.nameZh) +
            (idx !== -1 ? '<span class="sr-only">（第 ' + (idx + 1) + ' 站）</span>' : '') + '</button>';
        }).join('') + '</div></div>';
    }).join('');
  }

  function routeEmptySVG() {
    return '<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="16" cy="46" r="5" fill="none" stroke="#1E3A32" stroke-width="2"/><circle cx="48" cy="18" r="5" fill="none" stroke="#1E3A32" stroke-width="2"/><path d="M21 46h17a8 8 0 0 0 0-16H26a8 8 0 0 1 0-16h17" fill="none" stroke="#C9A43A" stroke-width="2" stroke-dasharray="4 4" stroke-linecap="round"/></svg>';
  }

  function googleUrl(ids) {
    var pts = ids.slice(0, 11).map(function (id) { return BY_ID[id].lat + ',' + BY_ID[id].lng; });
    var u = 'https://www.google.com/maps/dir/?api=1&travelmode=walking&origin=' + encodeURIComponent(pts[0]) + '&destination=' + encodeURIComponent(pts[pts.length - 1]);
    if (pts.length > 2) u += '&waypoints=' + encodeURIComponent(pts.slice(1, -1).join('|'));
    return u;
  }

  function renderRoute(movedId) {
    var r = state.route;
    $('#routeNN').disabled = r.length < 3 || state.auto;
    $('#routeClear').disabled = r.length === 0;

    var mode = $('#routeMode');
    if (r.length >= 2) {
      mode.innerHTML = state.auto
        ? '排序方式：<b>自動</b>・從第一個選取的景點「' + esc(BY_ID[state.picks[0]].nameZh) + '」出發，每一站都前往直線距離最近的下一站。'
        : (r.length < 3
          ? '排序方式：<b>手動調整</b>・只有 2 站時，順序就是起點與終點。'
          : '排序方式：<b>手動調整</b>・按「依最近距離重新排序」可恢復自動排序。');
    } else mode.textContent = '';

    $('#stops').innerHTML = r.map(function (id, i) {
      var s = BY_ID[id], a = AREA_BY_KEY[s.area];
      var leg = i > 0 ? '<p class="stop-leg">距上一站 ' + fmtDist(dist(BY_ID[r[i - 1]], s)) + '（直線）</p>' : '<p class="stop-leg">起點</p>';
      return '<li class="stop' + (movedId === id ? ' is-moved' : '') + '" data-stop="' + esc(id) + '">' +
        '<span class="stop-num">' + (i + 1) + '</span>' +
        '<div><p class="stop-name">' + esc(s.nameZh) + '</p><p class="stop-sub">' + esc(s.ward) + '・' + esc(a.label) + '</p>' + leg + '</div>' +
        '<div class="stop-ctrl">' +
        '<button type="button" class="icon-btn" data-move="' + i + '" data-dir="-1" aria-label="將「' + esc(s.nameZh) + '」往前移"' + (i === 0 ? ' disabled' : '') + '>' + ICON.up + '</button>' +
        '<button type="button" class="icon-btn" data-move="' + i + '" data-dir="1" aria-label="將「' + esc(s.nameZh) + '」往後移"' + (i === r.length - 1 ? ' disabled' : '') + '>' + ICON.down + '</button>' +
        '<button type="button" class="icon-btn icon-btn--rm" data-rm="' + esc(id) + '" aria-label="從路線移除「' + esc(s.nameZh) + '」">' + ICON.x + '</button>' +
        '</div></li>';
    }).join('');

    var empty = $('#routeEmpty'), sum = $('#routeSummary'), mapWrap = $('#routeMapWrap');
    if (r.length < 2) {
      empty.hidden = false;
      empty.innerHTML = routeEmptySVG() + (r.length === 0
        ? '<h4 id="routeEmptyTitle" tabindex="-1">尚未選擇景點</h4><p>請至少選擇 2 個景點，才會產生停靠順序與路線摘要。</p>'
        : '<h4 id="routeEmptyTitle" tabindex="-1">再選 1 個景點</h4><p>目前只有 1 站，至少需要 2 個景點才能產生路線。</p>');
      sum.hidden = true;
    } else {
      empty.hidden = true;
      var total = 0, maxLeg = 0;
      for (var i = 1; i < r.length; i++) { var d = dist(BY_ID[r[i - 1]], BY_ID[r[i]]); total += d; if (d > maxLeg) maxLeg = d; }
      var areas = {};
      r.forEach(function (id) { areas[BY_ID[id].area] = 1; });
      sum.hidden = false;
      sum.innerHTML =
        '<div class="rs-top">' +
        '<div class="rs-stat"><span>停靠站數</span><b>' + r.length + '<small>站</small></b></div>' +
        '<div class="rs-stat"><span>直線距離合計</span><b>' + fmtDistText(total).replace(/ (k?m)$/, '<small>$1</small>') + '</b></div>' +
        '<div class="rs-stat"><span>涵蓋分區</span><b>' + Object.keys(areas).length + '<small>個</small></b></div>' +
        '</div>' +
        '<p class="rs-order">' + r.map(function (id, i) { return '<span class="rs-stop"><span class="num">' + (i + 1) + '</span> ' + esc(BY_ID[id].nameZh) + '</span>'; }).join('<span class="arrow" aria-hidden="true">→</span>') + '</p>' +
        (maxLeg > 5000 ? '<p class="rs-warn">部分路段的直線距離超過 5 km，實際上可能不適合步行，請自行查詢交通方式。</p>' : '') +
        '<p class="rs-note"><strong>直線距離，依近似座標估算；非實際步行距離。</strong>資料不足以計算實際步行距離與時間，因此不顯示步行時間；路線圖只是示意。</p>' +
        '<div class="rs-actions">' +
        '<a class="btn btn-primary" href="' + esc(googleUrl(r)) + '" target="_blank" rel="noopener">' + ICON.ext + '在 Google 地圖查看實際路線</a>' +
        (map ? '<button type="button" class="btn btn-ghost" id="routeOnMap">' + ICON.map + '在主地圖顯示</button>' : '') +
        '</div>' +
        (r.length > 11 ? '<p class="rs-warn">Google 地圖連結最多帶入前 11 站。</p>' : '');
    }

    mapWrap.hidden = r.length < 1;
    drawRouteMap();
  }

  function drawRouteMap() {
    var r = state.route;
    var msg = $('#routeMapMsg');
    if (!r.length) return;
    if (typeof L === 'undefined') {
      msg.hidden = false;
      msg.innerHTML = mapFailHTML('示意地圖無法載入', '地圖程式庫沒有載入；停靠順序與路線摘要仍可使用。');
      return;
    }
    try {
      if (!routeMap) {
        routeMap = L.map('routeMap', { scrollWheelZoom: false, zoomControl: true, attributionControl: true, zoomSnap: 0.5 });
        routeMap.attributionControl.setPrefix('<a href="https://leafletjs.com/" target="_blank" rel="noopener">Leaflet</a>');
        addTiles(routeMap, function () {
          msg.hidden = false; msg.classList.add('is-banner');
          msg.innerHTML = '<p><strong>底圖圖磚無法載入</strong>，只顯示站點與連線。</p>';
        });
        routeLayer = L.layerGroup().addTo(routeMap);
      }
      routeMap.invalidateSize();
      routeLayer.clearLayers();
      var pts = r.map(function (id) { return [BY_ID[id].lat, BY_ID[id].lng]; });
      if (pts.length >= 2) L.polyline(pts, { color: '#1E3A32', weight: 3, opacity: .85, dashArray: '6 8', interactive: false }).addTo(routeLayer);
      r.forEach(function (id, i) {
        var s = BY_ID[id];
        L.marker([s.lat, s.lng], {
          icon: L.divIcon({ className: 'gpin-icon', html: '<span class="rpin' + (i === 0 ? ' is-start' : '') + '">' + (i + 1) + '</span>', iconSize: [44, 44], iconAnchor: [22, 22] }),
          title: (i + 1) + '. ' + s.nameZh, alt: (i + 1) + '. ' + s.nameZh
        }).bindTooltip(esc((i + 1) + '. ' + s.nameZh), { className: 'gtip', direction: 'top', offset: [0, -14] }).addTo(routeLayer);
      });
      if (pts.length === 1) routeMap.setView(pts[0], 14, { animate: false });
      else routeMap.fitBounds(pts, { padding: [36, 36], maxZoom: 15, animate: false });
    } catch (e) {
      msg.hidden = false;
      msg.innerHTML = mapFailHTML('示意地圖無法顯示', '停靠順序與路線摘要仍可使用。');
    }
  }

  function showRouteOnMainMap() {
    if (!map || state.route.length < 2) return;
    if (!mqDesktop.matches) setView('map');
    $('#explore').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    setTimeout(function () {
      map.invalidateSize();
      map.fitBounds(state.route.map(function (id) { return [BY_ID[id].lat, BY_ID[id].lng]; }), { padding: [50, 50], maxZoom: 15 });
    }, reduceMotion ? 0 : 450);
  }

  /* ------------------------------------------------------------
   * 11. 行動版：列表／地圖切換
   * ---------------------------------------------------------- */
  function setView(v) {
    $('#exploreGrid').setAttribute('data-view', v);
    $('#tabList').setAttribute('aria-selected', v === 'list');
    $('#tabMap').setAttribute('aria-selected', v === 'map');
    if (v === 'map' && map) setTimeout(syncMapSize, 30);
  }

  /* ------------------------------------------------------------
   * 12. 事件
   * ---------------------------------------------------------- */
  var qTimer = null;
  $('#q').addEventListener('input', function (e) {
    clearTimeout(qTimer);
    var v = e.target.value.trim();
    qTimer = setTimeout(function () { state.q = v; applyFilters({ fit: false }); }, 140);
  });
  $('#q').addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && e.target.value) { e.target.value = ''; state.q = ''; applyFilters({ fit: true }); }
    if (e.key === 'Enter') { clearTimeout(qTimer); state.q = e.target.value.trim(); applyFilters({ fit: true }); }
  });
  $('#qClear').addEventListener('click', function () {
    $('#q').value = ''; state.q = ''; applyFilters({ fit: true }); $('#q').focus();
  });
  $('#statusChips').addEventListener('click', function (e) {
    var b = e.target.closest('[data-status]');
    if (!b) return;
    var k = b.getAttribute('data-status');
    state.status = (state.status === k && k !== 'all') ? 'all' : k;
    applyFilters({ fit: true });
    var nb = $('#statusChips [data-status="' + k + '"]'); if (nb) nb.focus({ preventScroll: true });
  });
  $('#areaSel').addEventListener('change', function (e) { state.area = e.target.value; applyFilters({ fit: true }); });
  function resetFilters() {
    state.q = ''; state.status = 'all'; state.area = 'all';
    $('#q').value = '';
    applyFilters({ fit: true });
  }
  $('#clearFilters').addEventListener('click', function () {
    resetFilters(); toast('已清除篩選');
    $('#q').focus({ preventScroll: true }); // 按鈕會變成停用，焦點移回搜尋框
  });

  // 行動版搜尋框寬度較窄，改用較短的提示文字
  var mqNarrow = window.matchMedia('(max-width: 760px)');
  var mqMid = window.matchMedia('(min-width: 761px) and (max-width: 1180px)');
  function syncPlaceholder() {
    $('#q').placeholder = mqNarrow.matches ? '搜尋景點或行政區'
      : (mqMid.matches ? '搜尋景點、行政區或關鍵字' : '搜尋景點、行政區或關鍵字（例：並木、新宿）');
  }
  syncPlaceholder();
  [mqNarrow, mqMid].forEach(function (m) {
    if (m.addEventListener) m.addEventListener('change', syncPlaceholder); else m.addListener(syncPlaceholder);
  });

  // 跳過地圖：直接到景點列表（窄螢幕先切回列表檢視）
  $('#skipMap').addEventListener('click', function (e) {
    e.preventDefault();
    if (!mqDesktop.matches) setView('list');
    var l = $('#list');
    l.focus({ preventScroll: true });
    l.scrollIntoView({ block: 'nearest' });
  });

  $('#tabList').addEventListener('click', function () { setView('list'); });
  $('#tabMap').addEventListener('click', function () { setView('map'); });

  // 委派：開啟詳情、加入路線、重設、返回
  document.addEventListener('click', function (e) {
    var t;
    if ((t = e.target.closest('[data-route]'))) { toggleRoute(t.getAttribute('data-route')); return; }
    if ((t = e.target.closest('[data-open]'))) { openSpot(t.getAttribute('data-open'), { from: 'list' }); return; }
    if ((t = e.target.closest('[data-reset]'))) { resetFilters(); return; }
    if ((t = e.target.closest('[data-back]'))) { closePanelDetail(); return; }
    if ((t = e.target.closest('[data-pick]'))) { toggleRoute(t.getAttribute('data-pick')); var nb = $('[data-pick="' + cssEsc(t.getAttribute('data-pick')) + '"]'); if (nb) nb.focus({ preventScroll: true }); return; }
    if ((t = e.target.closest('[data-move]'))) {
      var idx = +t.getAttribute('data-move'), dir = +t.getAttribute('data-dir');
      var id = state.route[idx];
      moveStop(idx, dir);
      var nbtn = $('[data-stop="' + cssEsc(id) + '"] [data-dir="' + dir + '"]');
      if (nbtn && !nbtn.disabled) nbtn.focus({ preventScroll: true });
      return;
    }
    if ((t = e.target.closest('[data-rm]'))) {
      var rmIdx = state.route.indexOf(t.getAttribute('data-rm'));
      toggleRoute(t.getAttribute('data-rm'));
      // 焦點移到下一站（或上一站）的移除鈕；沒有站點時回到選擇景點
      var rms = $$('#stops [data-rm]');
      var nf = rms[Math.min(rmIdx, rms.length - 1)] || $('#pickGroups .pick');
      if (nf) nf.focus({ preventScroll: true });
      return;
    }
    if ((t = e.target.closest('[data-showmap]'))) {
      var sid = t.getAttribute('data-showmap');
      closeSheet(true);
      setView('map');
      $('#explore').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      setTimeout(function () { if (map) { map.invalidateSize(); map.setView([BY_ID[sid].lat, BY_ID[sid].lng], 15); } }, reduceMotion ? 0 : 420);
      return;
    }
    if (e.target.closest('#routeOnMap')) { showRouteOnMainMap(); return; }
  });

  $('#routeNN').addEventListener('click', reorderNN);
  $('#routeClear').addEventListener('click', clearRoute);
  $('#sheetClose').addEventListener('click', function () { closeSheet(); });
  backdrop.addEventListener('click', function () { closeSheet(); });

  // 卡片 hover ↔ 地圖標記
  $('#list').addEventListener('mouseover', function (e) {
    var c = e.target.closest('.spot-card'); if (c) hoverPin(c.getAttribute('data-id'), true);
  });
  $('#list').addEventListener('mouseout', function (e) {
    var c = e.target.closest('.spot-card'); if (c) hoverPin(c.getAttribute('data-id'), false);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (!sheet.hidden) { closeSheet(); return; }
    if (!$('#panelDetail').hidden) closePanelDetail();
  });

  // 焦點留在 bottom sheet 內
  sheet.addEventListener('keydown', function (e) {
    if (e.key !== 'Tab') return;
    var f = $$('a[href], button:not([disabled])', sheet).filter(function (x) { return x.offsetParent !== null; });
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  // 桌機／行動切換時，詳情容器跟著切換
  function onMQ() {
    if (mqDesktop.matches) {
      if (!sheet.hidden && state.selected) { closeSheet(true); showPanelDetail(state.selected); }
      $('#exploreGrid').setAttribute('data-view', 'list');
    } else {
      $('#panelDetail').hidden = true; $('#panelList').hidden = false;
    }
    if (map) { layoutRefit = true; setTimeout(syncMapSize, 50); }
    if (routeMap) setTimeout(function () { routeMap.invalidateSize(); }, 50);
  }
  if (mqDesktop.addEventListener) mqDesktop.addEventListener('change', onMQ); else mqDesktop.addListener(onMQ);

  // sticky 篩選列陰影：依篩選列本身的位置判斷是否已貼頂（一次捲動跨過很遠時也正確）
  var fb = $('#filterbar');
  var sentinel = document.createElement('div');
  sentinel.setAttribute('aria-hidden', 'true');
  sentinel.style.height = '1px';
  fb.parentNode.insertBefore(sentinel, fb);
  var stuckTop = 0, stuckRaf = 0;
  function readStuckTop() { stuckTop = parseFloat(getComputedStyle(fb).top) || 0; }
  function syncStuck() {
    stuckRaf = 0;
    var top = fb.getBoundingClientRect().top;
    fb.classList.toggle('is-stuck', Math.abs(top - stuckTop) <= 0.5 && sentinel.getBoundingClientRect().top < 0);
  }
  function queueStuck() { if (!stuckRaf) stuckRaf = requestAnimationFrame(syncStuck); }
  function onStuckMQ() { readStuckTop(); queueStuck(); }
  window.addEventListener('scroll', queueStuck, { passive: true });
  window.addEventListener('resize', queueStuck, { passive: true });
  [mqDesktop, mqNarrow].forEach(function (m) {
    if (m.addEventListener) m.addEventListener('change', onStuckMQ); else m.addListener(onStuckMQ);
  });
  readStuckTop();
  syncStuck();

  /* ------------------------------------------------------------
   * 13. 啟動
   * ---------------------------------------------------------- */
  bindCounts();
  renderLegend();
  renderLifecycle();
  renderJMA();
  renderSources();
  renderFilters();
  renderList();
  initMap();
  renderPicks();
  renderRoute();

})();
