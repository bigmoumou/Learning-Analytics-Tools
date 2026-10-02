/* app.js — 東京銀杏黃葉地圖的畫面邏輯（原生 JavaScript，無框架）
 * 資料與常數都在 data.js。地圖載入失敗時，清單、篩選、我附近與路線仍可使用。 */
(function () {
  'use strict';

  /* ---------- 小工具 ---------- */
  var $ = function (id) { return document.getElementById(id); };
  function h(tag, attrs, kids) {
    var e = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === null || v === undefined || v === false) return;
        if (k === 'class') e.className = v;
        else if (k === 'text') e.textContent = v;
        else if (k === 'style') e.setAttribute('style', v);
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') e.addEventListener(k.slice(2), v);
        else e.setAttribute(k, v === true ? '' : v);
      });
    }
    (kids || []).forEach(function (c) {
      if (c === null || c === undefined || c === false) return;
      e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return e;
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  var reduceMotion = false;
  try { reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { /* 忽略 */ }
  var mqDesktop = window.matchMedia ? window.matchMedia('(min-width: 960px)') : { matches: true, addEventListener: function () {} };

  /* ---------- 日期與季節模型 ---------- */
  var DAY = 86400000;
  var WEEK = ['日', '一', '二', '三', '四', '五', '六'];
  function tokyoToday() {
    try {
      var s = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
      var p = s.split('-').map(Number);
      if (p.length === 3 && p[0] && p[1] && p[2]) return { y: p[0], m: p[1], d: p[2] };
    } catch (e) { /* 忽略，改用本機日期 */ }
    var n = new Date();
    return { y: n.getFullYear(), m: n.getMonth() + 1, d: n.getDate() };
  }
  var today = tokyoToday();
  var YEAR = today.y; // 滑桿採當年
  function dayOf(m, d) { return Date.UTC(YEAR, m - 1, d) / DAY; }
  var startDay = dayOf(SLIDER_RANGE.start.month, SLIDER_RANGE.start.day);
  var endDay = dayOf(SLIDER_RANGE.end.month, SLIDER_RANGE.end.day);
  var D = dayOf(JMA_BASE.yellowNormal.month, JMA_BASE.yellowNormal.day); // 見頃起日
  var fallDay = dayOf(JMA_BASE.fallNormal.month, JMA_BASE.fallNormal.day);
  var todayDay = Date.UTC(today.y, today.m - 1, today.d) / DAY;
  var maxIdx = endDay - startDay;
  var todayInRange = todayDay >= startDay && todayDay <= endDay;
  var defaultIdx = clamp(todayDay - startDay, 0, maxIdx);

  function dateParts(day) { var t = new Date(day * DAY); return { m: t.getUTCMonth() + 1, d: t.getUTCDate(), w: t.getUTCDay() }; }
  function md(day) { var p = dateParts(day); return p.m + '/' + p.d; }
  function stageIndex(day) {
    var diff = day - D, idx = 0;
    STAGES.forEach(function (s, i) { if (s.startOffset !== null && diff >= s.startOffset) idx = i; });
    return idx;
  }
  function stageStart(i) { return STAGES[i].startOffset === null ? null : D + STAGES[i].startOffset; }
  function stageEnd(i) { return i < STAGES.length - 1 ? stageStart(i + 1) - 1 : null; }
  function offsetText(o) { return o === 0 ? 'D' : 'D' + (o > 0 ? '+' : '−') + Math.abs(o); }

  /* ---------- 狀態 ---------- */
  var STORE_KEY = 'tokyo-ginkgo-kouyou-map:walk-route:v1';
  var SPOT = {};
  SPOTS.forEach(function (s) { SPOT[s.id] = s; });
  function hasCoords(s) { return s && typeof s.lat === 'number' && typeof s.lng === 'number'; }

  var state = {
    dayIdx: defaultIdx,
    area: 'all',
    grades: { S: true, A: true, B: true, C: true },
    selected: null,
    route: [],
    manualOrder: false,
    me: null,
    view: 'map'
  };

  /* ---------- 距離 ---------- */
  function meters(a, b) {
    var R = 6371000, toR = Math.PI / 180;
    var dLat = (b.lat - a.lat) * toR, dLng = (b.lng - a.lng) * toR;
    var x = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.sqrt(x));
  }
  function fmtDist(m) { return m < 1000 ? Math.round(m / 10) * 10 + ' m' : (m / 1000).toFixed(m < 10000 ? 1 : 0) + ' km'; }
  // 路線：每段先四捨五入到顯示精度（未滿 1 km 到 10 m，1 km 以上到 100 m），
  // 總距離與總時間都由「已四捨五入的各段」相加，讓讀者把各段加起來會得到同一個總數
  function roundLeg(m) {
    var r = Math.round(m / 10) * 10;
    return r < 1000 ? r : Math.round(m / 100) * 100;
  }
  function fmtRouteDist(m) {
    if (m < 1000) return m + ' m';
    return (m / 1000).toFixed(m % 100 === 0 ? 1 : 2) + ' km';
  }
  function legMinutes(m) { return Math.max(1, Math.round(m / WALK_M_PER_MIN)); }
  function fmtMin(min) {
    if (min < 60) return '約 ' + min + ' 分';
    return '約 ' + Math.floor(min / 60) + ' 小時' + (min % 60 ? ' ' + (min % 60) + ' 分' : '');
  }

  /* ======================================================================
   * 季節模組
   * ==================================================================== */
  var slider = $('date-slider');
  var rafPending = false;

  function buildSeason() {
    slider.max = String(maxIdx);
    slider.value = String(state.dayIdx);

    // 階段色帶（與滑桿刻度對齊）
    var band = $('stage-band');
    STAGES.forEach(function (s, i) {
      var a = stageStart(i), b = stageEnd(i);
      var from = clamp((a === null ? startDay : a) - startDay, 0, maxIdx);
      var to = clamp((b === null ? endDay : b) - startDay, 0, maxIdx);
      if (to < from) return;
      var l = Math.max(0, (from - 0.5) / maxIdx), r = Math.min(1, (to + 0.5) / maxIdx);
      var seg = h('span', { class: 'band-seg', style: 'left:' + (l * 100) + '%;width:' + ((r - l) * 100) + '%;background:' + s.color });
      band.appendChild(seg);
    });

    // 刻度
    var scale = $('slider-scale');
    [{ day: startDay, t: md(startDay) }, { day: dayOf(11, 1), t: '11/1' }, { day: D, t: md(D) + ' 見頃起日', key: true }, { day: fallDay, t: md(fallDay) + ' 落葉', small: true }, { day: endDay, t: md(endDay) }].forEach(function (k) {
      var pct = (k.day - startDay) / maxIdx * 100;
      scale.appendChild(h('span', { class: 'tick' + (k.key ? ' is-key' : '') + (k.small ? ' is-minor' : '') + (pct <= 0 ? ' at-start' : '') + (pct >= 100 ? ' at-end' : ''), style: 'left:' + pct + '%', text: k.t }));
    });

    // 圖例
    var legend = $('legend');
    STAGES.forEach(function (s, i) {
      var a = stageStart(i), b = stageEnd(i);
      var range = a === null ? '～' + md(b) : (b === null ? md(a) + '～' : md(a) + '–' + md(b));
      legend.appendChild(h('li', { class: 'legend-item', 'data-i': i }, [
        h('span', { class: 'swatch', style: 'background:' + s.color, 'aria-hidden': 'true' }),
        h('span', { class: 'legend-text' }, [
          h('span', { class: 'legend-ja', lang: 'ja', text: s.ja }),
          h('span', { class: 'legend-zh', text: s.zh })
        ]),
        h('span', { class: 'legend-range', text: range })
      ]));
    });

    // 模型說明（由 data.js 常數產生）
    $('model-line').textContent = '見頃起日＝氣象廳' + JMA_BASE.station + 'いちょう黄葉日平年值 ' + md(D) + '（' + JMA_BASE.period + '），落葉＝いちょう落葉日平年值 ' + md(fallDay) + '；其他階段界線是示意參數。所有景點共用這個東京基準。';
    var body = $('model-body');
    var tbl = h('table', { class: 'model-table' }, [
      h('thead', null, [h('tr', null, [h('th', { scope: 'col', text: '階段' }), h('th', { scope: 'col', text: '起日偏移' }), h('th', { scope: 'col', text: YEAR + ' 年日期' }), h('th', { scope: 'col', text: '依據' })])])
    ]);
    var tb = h('tbody');
    STAGES.forEach(function (s, i) {
      var a = stageStart(i), b = stageEnd(i);
      var basis = s.key === 'mikoro' ? '氣象廳黄葉日平年值' : (s.key === 'rakuyou' ? '氣象廳落葉日平年值' : '示意參數');
      tb.appendChild(h('tr', null, [
        h('td', { 'data-basis': basis }, [h('span', { class: 'swatch sm', style: 'background:' + s.color, 'aria-hidden': 'true' }), h('span', { lang: 'ja', text: s.ja }), h('small', { text: ' ' + s.zh })]),
        h('td', { text: s.startOffset === null ? '～' + offsetText(STAGES[1].startOffset - 1) : offsetText(s.startOffset) + ' 起' }),
        h('td', { text: a === null ? '～' + md(b) : (b === null ? md(a) + '～' : md(a) + '–' + md(b)) }),
        h('td', { text: basis })
      ]));
    });
    tbl.appendChild(tb);
    var recent = JMA_BASE.recentYellow.map(function (r) { return r.year + ' 年 ' + r.date; }).join('、');
    body.appendChild(h('p', null, ['D 是氣象廳東京いちょう黄葉日的平年值 ' + md(D) + '（' + JMA_BASE.period + '），本站以這天作為「見頃」起日；「落葉」從いちょう落葉日的平年值 ' + md(fallDay) + '（D+' + (fallDay - D) + '）開始。其他界線（D' + '−28、D−14、D+6）是寫在 data.js 的示意參數，不是觀測值。']));
    body.appendChild(tbl);
    var obs = JMA_BASE.observed2026
      ? '氣象廳公布的 2026 年東京いちょう黄葉日是 ' + JMA_BASE.observed2026 + '。'
      : '截至 ' + SITE_META.snapshotDate + '（資料快照），氣象廳尚未公布 2026 年東京いちょう黄葉日。';
    body.appendChild(h('p', null, ['氣象廳是以觀測站的標本木記錄，不是各公園的觀賞日。近年東京黄葉日有前後變動（' + recent + '），實際季節可能相差約一週。' + obs]));
    body.appendChild(h('p', { class: 'model-links' }, [
      h('a', { href: JMA_BASE.yellowUrl, target: '_blank', rel: 'noopener', text: '氣象廳 いちょう黄葉日' }),
      h('a', { href: JMA_BASE.fallUrl, target: '_blank', rel: 'noopener', text: '氣象廳 いちょう落葉日' })
    ]));

    // 回到今天（今天不在範圍時，回到最近的邊界日）
    var reset = $('reset-date');
    reset.textContent = todayInRange ? '回到今天' : '回到預設日 ' + md(startDay + defaultIdx);
    reset.title = todayInRange ? '' : '今天（' + today.m + '/' + today.d + '）不在 10/15～12/31，預設為最近的邊界日';
    reset.addEventListener('click', function () { state.dayIdx = defaultIdx; slider.value = String(defaultIdx); renderSeason(); });

    slider.addEventListener('input', function () {
      state.dayIdx = Number(slider.value);
      if (rafPending) return;
      rafPending = true;
      requestAnimationFrame(function () { rafPending = false; renderSeason(); });
    });
  }

  var lastStage = -1;
  function renderSeason() {
    var day = startDay + state.dayIdx;
    var p = dateParts(day);
    var si = stageIndex(day);
    var S = STAGES[si];
    var root = document.documentElement;
    root.style.setProperty('--stage-c', S.color);
    root.style.setProperty('--stage-ink', S.ink);
    root.style.setProperty('--slider-pct', (state.dayIdx / maxIdx * 100) + '%');

    $('sel-date').textContent = p.m + '月' + p.d + '日';
    $('sel-dow').textContent = '（' + WEEK[p.w] + '）';
    if (si !== lastStage) {
      var nameEl = $('stage-ja');
      $('stage-ja').textContent = S.ja;
      $('stage-zh').textContent = S.zh;
      $('stage-desc').textContent = S.desc;
      if (lastStage !== -1 && !reduceMotion) {
        nameEl.parentNode.classList.remove('is-changing');
        void nameEl.parentNode.offsetWidth;
        nameEl.parentNode.classList.add('is-changing');
      }
      lastStage = si;
      document.querySelectorAll('.legend-item').forEach(function (li) {
        var on = Number(li.getAttribute('data-i')) === si;
        li.classList.toggle('is-current', on);
        if (on) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
      });
      document.querySelectorAll('[data-stage-badge]').forEach(fillBadge);
    }
    var diff = day - D;
    var cnt;
    if (diff < 0) cnt = '距見頃起日（' + md(D) + '）還有 ' + (-diff) + ' 天';
    else if (day < fallDay) cnt = '見頃起日後第 ' + (diff + 1) + ' 天';
    else cnt = '已過氣象廳落葉平年日（' + md(fallDay) + '）';
    $('stage-count').textContent = cnt + '・示意';
    slider.setAttribute('aria-valuetext', p.m + '月' + p.d + '日，東京季節示意：' + S.ja + '（' + S.zh + '）');
  }

  function stageBadge() {
    var b = h('span', { class: 'stage-badge', 'data-stage-badge': '' }, [
      h('span', { class: 'sb-ja', lang: 'ja' }),
      h('span', { class: 'sb-zh' })
    ]);
    fillBadge(b);
    return b;
  }
  function fillBadge(b) {
    var S = STAGES[stageIndex(startDay + state.dayIdx)];
    b.querySelector('.sb-ja').textContent = S.ja;
    b.querySelector('.sb-zh').textContent = S.zh + '・東京示意';
    b.setAttribute('title', '東京季節示意（依往年平均推估，非本景點實測）');
  }

  /* ======================================================================
   * 篩選
   * ==================================================================== */
  function buildFilters() {
    var areaBox = $('area-chips');
    [{ key: 'all', label: '全部' }].concat(AREA_GROUPS).forEach(function (g) {
      areaBox.appendChild(h('button', {
        type: 'button', class: 'chip', 'data-area': g.key, 'aria-pressed': String(g.key === state.area),
        title: g.sub || '', onclick: function () { state.area = g.key; renderFilters(); applyFilters(); }
      }, [g.label]));
    });
    var gradeBox = $('grade-chips');
    ['S', 'A', 'B', 'C'].forEach(function (g) {
      gradeBox.appendChild(h('button', {
        type: 'button', class: 'chip chip-grade', 'data-grade': g, 'aria-pressed': 'true',
        'aria-label': g + '：' + GRADE_INFO[g], title: g + '：' + GRADE_INFO[g],
        onclick: function () { state.grades[g] = !state.grades[g]; renderFilters(); applyFilters(); }
      }, [g]));
    });
    // 等級簡稱說明（觸控裝置看不到 title）
    var key = $('grade-key');
    ['S', 'A', 'B', 'C'].forEach(function (g, i) {
      key.appendChild(h('span', { class: 'gk-item' }, [h('b', { text: g }), ' ' + GRADE_SHORT[g] + (i < 3 ? '；' : '')]));
    });
    // 區域晶片可左右捲動時，哪一側還有內容就在哪一側淡出提示
    var syncFade = function () {
      var more = areaBox.scrollWidth - areaBox.clientWidth - areaBox.scrollLeft > 4;
      areaBox.classList.toggle('has-more', more);
      areaBox.classList.toggle('has-before', areaBox.scrollLeft > 4);
    };
    areaBox.addEventListener('scroll', syncFade, { passive: true });
    window.addEventListener('resize', syncFade);
    requestAnimationFrame(syncFade);
    try { if (document.fonts && document.fonts.ready) document.fonts.ready.then(syncFade); } catch (e) { /* 忽略 */ }
    $('empty-clear').addEventListener('click', clearFilters);
  }
  function clearFilters() {
    state.area = 'all';
    state.grades = { S: true, A: true, B: true, C: true };
    renderFilters(); applyFilters();
    // 區域列捲回開頭，讓「全部」完整露出
    var areaBox = $('area-chips');
    if (areaBox && areaBox.scrollLeft > 0) {
      try { areaBox.scrollTo({ left: 0, behavior: reduceMotion ? 'auto' : 'smooth' }); } catch (e) { areaBox.scrollLeft = 0; }
    }
  }
  function renderFilters() {
    document.querySelectorAll('[data-area]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-area') === state.area)); });
    document.querySelectorAll('[data-grade]').forEach(function (b) { b.setAttribute('aria-pressed', String(!!state.grades[b.getAttribute('data-grade')])); });
  }
  function passes(s) { return (state.area === 'all' || s.group === state.area) && !!state.grades[s.grade]; }
  function filtersActive() { return state.area !== 'all' || !state.grades.S || !state.grades.A || !state.grades.B || !state.grades.C; }

  /* ======================================================================
   * 清單卡片
   * ==================================================================== */
  var cards = {};
  function areaLabel(key) { for (var i = 0; i < AREA_GROUPS.length; i++) if (AREA_GROUPS[i].key === key) return AREA_GROUPS[i].label; return ''; }

  function buildCards() {
    var list = $('spot-list');
    SPOTS.forEach(function (s, i) {
      var mapped = hasCoords(s);
      var coordText = mapped
        ? '座標為近似值・' + (s.parkLevel ? '園區代表點（' + s.pointLabel + '）' : s.pointLabel)
        : '位置不確定：只列在清單，不上地圖，也不可加入路線';

      var titleBtn = h('button', { type: 'button', class: 'spot-title', 'aria-describedby': 'coord-' + s.id }, [h('span', { lang: 'ja', text: s.nameJa })]);
      titleBtn.addEventListener('click', function () { select(s.id, 'list'); });

      var facts = h('dl', { class: 'facts' }, [
        fact('營運單位', s.operator, 'op'),
        fact('來源等級', s.grade + '｜' + GRADE_INFO[s.grade], 'grade'),
        fact('證據日期', s.evidenceDate, 'date'),
        fact('官方資訊', s.finding, 'wide'),
        fact('更新頻率', s.cadence, 'cad')
      ]);

      var subs = null;
      if (s.subPoints.length) {
        subs = h('ul', { class: 'subpoints', 'aria-label': '子地點與說明' }, s.subPoints.map(function (sp) {
          return h('li', { class: sp.mapped ? 'is-mapped' : '' }, [h('span', { class: 'sp-name', lang: 'ja', text: sp.name }), h('span', { class: 'sp-note', text: sp.note })]);
        }));
      }

      var proof = null;
      if (s.proof) {
        proof = h('div', { class: 'proof' }, [
          h('p', null, [s.proof.text, h('q', { lang: 'ja', text: s.proof.quote }), s.proof.note ? h('span', { class: 'proof-note', text: s.proof.note }) : null]),
          h('a', { class: 'inline-link', href: s.proof.url, target: '_blank', rel: 'noopener' }, ['銀杏佐證頁（官方）', arrowSvg()])
        ]);
      }

      var routeBtn = h('button', { type: 'button', class: 'route-toggle', 'data-route-toggle': s.id, 'aria-pressed': 'false' });
      routeBtn.addEventListener('click', function (ev) { ev.stopPropagation(); toggleRoute(s.id); });
      if (!mapped) { routeBtn.disabled = true; }

      var mapBtn = mapped ? h('button', { type: 'button', class: 'ghost-btn show-on-map', onclick: function (ev) { ev.stopPropagation(); select(s.id, 'list'); setView('map', true); } }, ['在地圖上看']) : null;

      var card = h('article', { class: 'spot', id: 'spot-' + s.id, 'data-id': s.id, 'aria-labelledby': 'name-' + s.id }, [
        h('div', { class: 'spot-top' }, [
          h('span', { class: 'spot-no', 'aria-hidden': 'true', text: String(i + 1).padStart(2, '0') }),
          h('div', { class: 'spot-heading' }, [
            h('p', { class: 'spot-kicker' }, [
              h('span', { class: 'grade-mark g-' + s.grade, text: s.grade, title: GRADE_INFO[s.grade] }),
              h('span', { text: s.area }),
              h('span', { class: 'sep', 'aria-hidden': 'true', text: '・' }),
              h('span', { text: areaLabel(s.group) })
            ]),
            h('h3', { id: 'name-' + s.id }, [titleBtn]),
            h('p', { class: 'spot-stage' }, [stageBadge()]),
            h('p', { class: 'spot-coord' + (mapped ? '' : ' is-unmapped'), id: 'coord-' + s.id, text: coordText }),
            h('p', { class: 'spot-dist', 'data-dist': s.id, hidden: true })
          ])
        ]),
        facts,
        subs,
        proof,
        h('p', { class: 'caveat' }, [h('span', { class: 'caveat-label', text: '注意' }), h('span', { text: s.caveat })]),
        h('p', { class: 'snapshot' }, [s.snapshot]),
        s.pastNote ? h('p', { class: 'past-note', text: s.pastNote }) : null,
        s.pastRecords && s.pastRecords.length ? h('ul', { class: 'past-records', 'aria-label': '往年官方紀錄（非今年現況）' }, s.pastRecords.map(function (r) {
          return h('li', null, [h('a', { class: 'past-rec', href: r.url, target: '_blank', rel: 'noopener' }, [
            h('span', { class: 'pr-date', text: r.date }),
            h('span', { class: 'pr-text' }, [r.source, h('q', { lang: 'ja', text: r.quote })]),
            arrowSvg()
          ])]);
        })) : null,
        h('div', { class: 'spot-actions' }, [
          h('a', { class: 'official-link', href: s.url, target: '_blank', rel: 'noopener' }, ['查看最新狀況', arrowSvg()]),
          routeBtn,
          mapBtn
        ])
      ]);
      card.addEventListener('click', function (ev) {
        if (ev.target.closest('a, button')) return;
        select(s.id, 'list');
      });
      cards[s.id] = card;
      list.appendChild(card);
    });
    // 只在第一次出現時淡入；之後重新排序不再閃爍
    list.classList.add('is-intro');
    setTimeout(function () { list.classList.remove('is-intro'); }, 700);
  }
  function fact(label, value, cls) {
    var dd;
    if (cls === 'date' && value) {
      // 日期（2025-10-23、2011-04）整段不斷行，只在「至」「；」等處換行
      dd = h('dd', null, String(value).split(/(\d{4}-\d{2}(?:-\d{2})?)/).filter(Boolean).map(function (part) {
        return /^\d{4}-\d{2}/.test(part) ? h('span', { class: 'nowrap', text: part }) : part;
      }));
    } else dd = h('dd', { text: value || '資料未提供' });
    return h('div', { class: 'fact' + (cls ? ' ' + cls : '') }, [h('dt', { text: label }), dd]);
  }
  function arrowSvg() {
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 16 16'); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('class', 'ext');
    var p = document.createElementNS(ns, 'path');
    p.setAttribute('d', 'M5 11 L11 5 M6 5 H11 V10');
    svg.appendChild(p);
    var sr = h('span', { class: 'sr-only', text: '（另開新分頁）' });
    var frag = document.createDocumentFragment(); frag.appendChild(svg); frag.appendChild(sr);
    var wrap = h('span', { class: 'ext-wrap' }); wrap.appendChild(frag);
    return wrap;
  }

  function orderedSpots() {
    var arr = SPOTS.slice();
    if (state.me) {
      arr.sort(function (a, b) {
        var da = hasCoords(a) ? meters(state.me, a) : Infinity;
        var db = hasCoords(b) ? meters(state.me, b) : Infinity;
        return da - db;
      });
    }
    return arr;
  }

  var lastOrderKey = '';
  function applyFilters() {
    var list = $('spot-list');
    var shown = 0;
    var ordered = orderedSpots();
    var orderKey = ordered.map(function (s) { return s.id; }).join(',');
    var reorder = orderKey !== lastOrderKey; // 只有順序真的改變（我附近開／關）才重新排列 DOM
    lastOrderKey = orderKey;
    ordered.forEach(function (s) {
      var c = cards[s.id];
      if (reorder) list.appendChild(c);
      var ok = passes(s);
      c.hidden = !ok;
      if (ok) shown++;
      var dEl = c.querySelector('[data-dist]');
      if (state.me && hasCoords(s)) { dEl.hidden = false; dEl.textContent = '距你約 ' + fmtDist(meters(state.me, s)) + '（直線）'; }
      else if (state.me) { dEl.hidden = false; dEl.textContent = '無座標，排在最後'; }
      else { dEl.hidden = true; dEl.textContent = ''; }
    });
    $('empty').hidden = shown !== 0;
    var st = '顯示 ' + shown + '／' + SPOTS.length + ' 處';
    if (state.me) st += '・依距離排序';
    $('list-status').textContent = st;
    $('tab-count').textContent = String(shown);
    var clr = $('list-clear');
    if (filtersActive() && shown > 0) {
      if (!clr) {
        clr = h('button', { type: 'button', class: 'text-btn', id: 'list-clear', onclick: clearFilters }, ['清除篩選']);
        $('list-status').parentNode.appendChild(clr);
      }
    } else if (clr) clr.remove();
    updateMarkers();
  }

  /* ======================================================================
   * 地圖（Leaflet）
   * ==================================================================== */
  var map = null, markers = {}, tileLayer = null, routeLayer = null, meLayer = null;
  var fitted = false, mapFailed = false, booted = false, popupFromMarker = false;

  function mapVisible() {
    var el = $('map');
    return !!map && el.offsetWidth > 0 && el.offsetHeight > 0;
  }
  function showMapMsg(kind) {
    var box = $('map-msg');
    box.textContent = '';
    if (kind === 'fail') {
      box.className = 'map-msg is-fail';
      box.appendChild(h('p', { class: 'map-msg-title', text: '地圖暫時無法載入' }));
      box.appendChild(h('p', { text: '可能是網路離線，或地圖服務被封鎖。清單、篩選、我附近、路線距離與 Google 地圖導航都仍可使用。' }));
      box.appendChild(h('button', { type: 'button', class: 'ghost-btn to-list', onclick: function () { setView('list', true); } }, ['改看清單']));
      $('map').classList.add('is-failed');
      $('skip-map').hidden = true;
      mapFailed = true;
      document.body.classList.add('map-failed');
      if (booted && !mqDesktop.matches) setView('list');
    } else {
      box.className = 'map-msg is-tiles';
      box.appendChild(h('p', { class: 'map-msg-title', text: '底圖圖磚無法載入' }));
      box.appendChild(h('p', { text: '可能是網路離線，或地圖服務被封鎖。標記、清單與路線仍可使用。' }));
    }
    box.hidden = false;
  }

  function initMap() {
    if (typeof L === 'undefined') { showMapMsg('fail'); return; }
    try {
      map = L.map('map', { trackResize: false, zoomControl: true, scrollWheelZoom: true, zoomSnap: 1, minZoom: 8, maxZoom: 18 });
      map.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a>');
      addTiles();
      SPOTS.forEach(function (s) {
        if (!hasCoords(s)) return;
        var m = L.marker([s.lat, s.lng], {
          icon: L.divIcon({ className: 'pin-wrap', html: '<span class="pin"><span class="pin-dot"></span><span class="pin-num"></span></span>', iconSize: [44, 44], iconAnchor: [22, 22], popupAnchor: [0, -12] }),
          title: s.nameJa, keyboard: true, riseOnHover: true
        });
        m.on('click', function () {
          popupFromMarker = true;
          setTimeout(function () { popupFromMarker = false; }, 0);
          select(s.id, 'map');
        });
        // 鍵盤：Enter 由 Leaflet 開啟小視窗（同時連動卡片）；Esc 關閉
        m.on('keypress', function (e) {
          var k = e.originalEvent && (e.originalEvent.key || e.originalEvent.keyCode);
          if (k !== 'Enter' && k !== 13) return;
          popupFromMarker = true;
          setTimeout(function () { popupFromMarker = false; }, 0);
          select(s.id, 'map');
        });
        m.on('keydown', function (e) {
          var k = e.originalEvent && e.originalEvent.key;
          if ((k === 'Escape' || k === 'Esc') && m.isPopupOpen()) m.closePopup();
        });
        m.on('add', function () { decorate(s.id); });
        // 小視窗避開左上角的縮放鈕（左 10px＋寬 44px）；窄螢幕時縮窄寬度，讓留白一定放得下
        m.bindPopup(function () {
          var p = m.getPopup();
          if (p) { var w = popupWidth(); p.options.maxWidth = w; p.options.minWidth = Math.min(220, w); }
          return popupFor(s, m);
        }, { maxWidth: 270, minWidth: 220, autoPanPaddingTopLeft: L.point(64, 18), autoPanPaddingBottomRight: L.point(18, 18), closeButton: true });
        // 從標記（滑鼠或鍵盤 Enter）打開小視窗時，把焦點移進小視窗
        m.on('popupopen', function (e) {
          if (!popupFromMarker) return;
          popupFromMarker = false;
          var el = e.popup.getElement();
          var b = el && el.querySelector('.pop-btn');
          if (b) { try { b.focus({ preventScroll: true }); } catch (err) { b.focus(); } }
        });
        markers[s.id] = m;
      });
      updateMarkers();
      if (mapVisible()) { fitAll(); fitted = true; }
      else map.setView([35.69, 139.55], 10);
      // 桌面版地圖高度會隨路線面板伸縮；讓 Leaflet 的尺寸永遠跟容器一致，圖磚才會鋪滿
      // 清單分頁時地圖容器是 display:none（0×0）：跳過，不然切回地圖時 Leaflet 會依尺寸差平移，標記跑出畫面
      // Leaflet 內建的 trackResize 已關閉（它在 display:none 時也會量到 0×0）；改由這裡處理，沒有 ResizeObserver 時退回 window resize
      var onMapResize = function () {
        var el = $('map');
        if (!map || el.clientWidth === 0 || el.clientHeight === 0) return;
        afterMapShown(true);
      };
      if (window.ResizeObserver) new ResizeObserver(onMapResize).observe($('map'));
      else window.addEventListener('resize', onMapResize);
    } catch (e) {
      map = null;
      showMapMsg('fail');
    }
  }

  // 只用 OpenStreetMap 圖磚；連續失敗時直接顯示友善提示（標記、清單與路線照常可用）
  function addTiles() {
    var failures = 0, loaded = 0;
    tileLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'
    });
    tileLayer.on('tileload', function () { loaded++; var b = $('map-msg'); if (b.classList.contains('is-tiles')) b.hidden = true; });
    tileLayer.on('tileerror', function () {
      failures++;
      if (loaded === 0 && failures >= 4) {
        failures = -1000; // 只觸發一次
        showMapMsg('tiles');
      }
    });
    tileLayer.addTo(map);
  }

  function fitAll() {
    if (!map) return;
    var pts = SPOTS.filter(function (s) { return hasCoords(s) && passes(s); }).map(function (s) { return [s.lat, s.lng]; });
    if (!pts.length) pts = SPOTS.filter(hasCoords).map(function (s) { return [s.lat, s.lng]; });
    map.fitBounds(pts, { padding: [28, 28], maxZoom: 14, animate: false });
  }

  function decorate(id) {
    var m = markers[id];
    var e = m && m.getElement && m.getElement();
    if (!e) return;
    var s = SPOT[id];
    var ord = state.route.indexOf(id);
    e.classList.toggle('is-selected', state.selected === id);
    e.classList.toggle('in-route', ord >= 0);
    var num = e.querySelector('.pin-num');
    if (num) num.textContent = ord >= 0 ? String(ord + 1) : '';
    e.setAttribute('role', 'button');
    e.setAttribute('aria-label', s.nameJa + (ord >= 0 ? '，路線第 ' + (ord + 1) + ' 站' : ''));
    m.setZIndexOffset(state.selected === id ? 1000 : (ord >= 0 ? 500 : 0));
  }

  function updateMarkers() {
    if (!map) return;
    SPOTS.forEach(function (s) {
      var m = markers[s.id];
      if (!m) return;
      var show = passes(s) || state.route.indexOf(s.id) >= 0;
      var on = map.hasLayer(m);
      if (show && !on) m.addTo(map);
      else if (!show && on) { if (m.isPopupOpen()) m.closePopup(); map.removeLayer(m); }
      else if (show) decorate(s.id);
    });
  }

  // 小視窗內容寬度：地圖寬扣掉左右留白（64＋18）與小視窗內距（16×2）
  function popupWidth() {
    var mw = map ? map.getSize().x : window.innerWidth;
    return Math.max(180, Math.min(270, mw - 64 - 18 - 32 - 4));
  }
  function popupFor(s, m) {
    var inRoute = state.route.indexOf(s.id) >= 0;
    var addBtn = h('button', { type: 'button', class: 'pop-btn', 'data-pop-route': s.id }, [inRoute ? '移出路線' : '加入路線']);
    addBtn.addEventListener('click', function () { toggleRoute(s.id); });
    if (!inRoute && state.route.length >= ROUTE_MAX) { addBtn.disabled = true; addBtn.textContent = '路線已滿 5 站'; }
    var wrap = h('div', { class: 'pop' });
    // Esc：關閉小視窗，焦點回到標記
    wrap.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Escape' && ev.key !== 'Esc') return;
      ev.stopPropagation();
      m.closePopup();
      var me = m.getElement && m.getElement();
      if (me) me.focus();
    });
    [
      h('p', { class: 'pop-kicker' }, [h('span', { class: 'grade-mark g-' + s.grade, text: s.grade }), ' ' + s.area]),
      h('p', { class: 'pop-title', lang: 'ja', text: s.nameJa }),
      stageBadge(),
      h('p', { class: 'pop-coord', text: '座標為近似值・' + (s.parkLevel ? '園區代表點' : s.pointLabel) }),
      h('div', { class: 'pop-actions' }, [
        h('button', { type: 'button', class: 'pop-btn', onclick: function () { setView('list'); scrollToCard(s.id); } }, ['查看卡片']),
        addBtn
      ]),
      h('a', { class: 'pop-link', href: s.url, target: '_blank', rel: 'noopener' }, ['查看最新狀況', arrowSvg()])
    ].forEach(function (c) { wrap.appendChild(c); });
    return wrap;
  }

  /* ---------- 選取：標記與卡片互相連動 ---------- */
  var pendingFocus = null, routeFitPending = false, refitPending = false;
  function select(id, from) {
    var prev = state.selected;
    state.selected = id;
    if (prev && cards[prev]) cards[prev].classList.remove('is-selected');
    if (cards[id]) cards[id].classList.add('is-selected');
    if (prev) decorate(prev);
    decorate(id);
    var s = SPOT[id];
    if (from === 'map') {
      if (mqDesktop.matches) scrollToCard(id, true);
    } else if (map && hasCoords(s)) {
      if (mapVisible()) focusMarker(id);
      else pendingFocus = id;
    }
  }
  function focusMarker(id) {
    var s = SPOT[id], m = markers[id];
    if (!map || !m || !hasCoords(s)) return;
    if (!map.hasLayer(m)) m.addTo(map);
    var z = Math.min(Math.max(map.getZoom(), 13), 15);
    var target = L.latLng(s.lat, s.lng);
    if (map.getCenter().distanceTo(target) < 5 && map.getZoom() === z) { m.openPopup(); return; }
    map.once('moveend', function () { if (map.hasLayer(m)) m.openPopup(); });
    map.setView(target, z, { animate: !reduceMotion });
  }
  function scrollToCard(id, soft) {
    var c = cards[id];
    if (!c) return;
    if (c.hidden) { clearFilters(); }
    requestAnimationFrame(function () {
      c.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: soft ? 'nearest' : 'center' });
      c.classList.add('is-selected');
      if (!soft) { c.querySelector('.spot-title').focus({ preventScroll: true }); }
    });
  }

  /* ======================================================================
   * 手機：地圖／清單切換
   * ==================================================================== */
  function setView(v, scroll) {
    state.view = v;
    document.body.classList.toggle('view-map', v === 'map');
    document.body.classList.toggle('view-list', v === 'list');
    ['map', 'list'].forEach(function (k) {
      var t = $('tab-' + k);
      t.setAttribute('aria-selected', String(k === v));
      t.tabIndex = k === v ? 0 : -1;
    });
    if (v === 'map') requestAnimationFrame(afterMapShown);
    renderRouteBar();
    if (scroll && !mqDesktop.matches) {
      var tgt = v === 'map' ? $('map-col') : $('list-panel');
      var top = tgt.getBoundingClientRect().top;
      if (top < 0 || top > window.innerHeight * 0.6) tgt.scrollIntoView({ block: 'start' });
    }
  }
  // 地圖容器尺寸：refSize 是上次框景時的尺寸。寬或高變動超過約 25%、或直橫向翻轉，就標記需要重新框景；
  // 小變動（例如手機網址列伸縮）只同步尺寸並保持中心點。0×0（隱藏中）一律跳過，不讓 Leaflet 記到 0×0
  var refSize = null;
  function syncMapSize() {
    var el = $('map');
    var w = el.clientWidth, hgt = el.clientHeight;
    if (!map || !w || !hgt) return false;
    if (!refSize) refSize = { w: w, h: hgt };
    var big = Math.abs(w - refSize.w) > refSize.w * 0.25 || Math.abs(hgt - refSize.h) > refSize.h * 0.25 ||
      (w > hgt) !== (refSize.w > refSize.h);
    if (big) { refitPending = true; refSize = { w: w, h: hgt }; }
    map.invalidateSize({ pan: !big, animate: false });
    return true;
  }
  // fromResize：由尺寸改變觸發（不是使用者切到地圖）。這時若需要重新框景，就以框景為準，不再放大到清單上點過的地點
  function afterMapShown(fromResize) {
    if (!map) return;
    if (!syncMapSize() || !mapVisible()) return;
    if (!fitted) { fitAll(); fitted = true; }
    if (pendingFocus && !(fromResize === true && refitPending)) { var id = pendingFocus; pendingFocus = null; routeFitPending = false; refitPending = false; focusMarker(id); }
    else if (refitPending) {
      // 版面大幅改變後重新框景：正在看某個標記（小視窗開著）就讓它留在畫面中；否則有路線框路線，再否則框目前顯示的標記
      // 有路線時，清單上選取（小視窗未開）的標記也一併框進來，不讓它落在畫面外
      var sel = pendingFocus || state.selected;
      refitPending = false; pendingFocus = null;
      var open = popupOpen();
      if (open) focusMarker(open);
      else if (state.route.length >= 2) fitRoute(sel && markers[sel] && map.hasLayer(markers[sel]) ? sel : null); else fitAll();
    }
    else if (routeFitPending && state.route.length >= 2) fitRoute();
  }
  function popupOpen() {
    var ids = Object.keys(markers);
    for (var i = 0; i < ids.length; i++) if (markers[ids[i]].isPopupOpen()) return ids[i];
    return null;
  }
  function buildTabs() {
    ['map', 'list'].forEach(function (k) {
      var t = $('tab-' + k);
      t.addEventListener('click', function () { setView(k, true); });
      t.addEventListener('keydown', function (ev) {
        if (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight') {
          var nv = k === 'map' ? 'list' : 'map';
          setView(nv); $('tab-' + nv).focus();
        }
      });
    });
    var onMq = function () {
      if (map) { refitPending = true; requestAnimationFrame(function () { if (mapVisible()) afterMapShown(true); }); }
      renderRouteBar();
    };
    if (mqDesktop.addEventListener) mqDesktop.addEventListener('change', onMq);
    else if (mqDesktop.addListener) mqDesktop.addListener(onMq);
  }

  /* ======================================================================
   * 我附近
   * ==================================================================== */
  function geoMsg(text, tone) {
    var m = $('geo-msg');
    m.textContent = '';
    if (!text) { m.hidden = true; return; }
    m.className = 'geo-msg' + (tone ? ' is-' + tone : '');
    m.appendChild(document.createTextNode(text));
    m.hidden = false;
  }
  function buildNear() {
    var btn = $('near-btn');
    btn.addEventListener('click', function () {
      if (state.me) { // 取消距離排序
        state.me = null;
        btn.setAttribute('aria-pressed', 'false');
        $('near-label').textContent = '我附近';
        if (meLayer && map) { map.removeLayer(meLayer); meLayer = null; }
        geoMsg('');
        applyFilters();
        return;
      }
      if (!('geolocation' in navigator) || !navigator.geolocation) {
        geoMsg('這個瀏覽器不支援定位，清單維持原本順序。', 'warn');
        return;
      }
      btn.disabled = true;
      $('near-label').textContent = '定位中…';
      geoMsg('正在取得你的位置…');
      try {
        navigator.geolocation.getCurrentPosition(function (pos) {
          btn.disabled = false;
          state.me = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          btn.setAttribute('aria-pressed', 'true');
          $('near-label').textContent = '依距離排序中・取消';
          var near = orderedSpots()[0];
          geoMsg('已依你的位置由近到遠排序（直線距離）。最近的是「' + near.nameJa + '」，約 ' + fmtDist(meters(state.me, near)) + '。', 'ok');
          applyFilters();
          if (map) {
            if (meLayer) map.removeLayer(meLayer);
            meLayer = L.circleMarker([state.me.lat, state.me.lng], { radius: 7, color: '#ffffff', weight: 3, fillColor: '#2f5d8a', fillOpacity: 1, interactive: false }).addTo(map);
          }
        }, function (err) {
          btn.disabled = false;
          $('near-label').textContent = '我附近';
          if (err && err.code === 1) geoMsg('你沒有允許定位，所以無法依距離排序；清單維持原本順序。若想使用，請在瀏覽器的網站設定中允許位置存取後再按一次。', 'warn');
          else geoMsg('目前無法取得位置（訊號不足或逾時），清單維持原本順序。可以稍後再試，或改用區域篩選。', 'warn');
        }, { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 });
      } catch (e) {
        btn.disabled = false;
        $('near-label').textContent = '我附近';
        geoMsg('目前無法使用定位，清單維持原本順序。', 'warn');
      }
    });
  }

  /* ======================================================================
   * 銀杏散步路線
   * ==================================================================== */
  function nearestOrder(ids) {
    if (ids.length < 3) return ids.slice();
    var rest = ids.slice(1), out = [ids[0]];
    while (rest.length) {
      var last = SPOT[out[out.length - 1]], bi = 0, bd = Infinity;
      for (var i = 0; i < rest.length; i++) {
        var d = meters(last, SPOT[rest[i]]);
        if (d < bd) { bd = d; bi = i; }
      }
      out.push(rest.splice(bi, 1)[0]);
    }
    return out;
  }
  function saveRoute() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify({ v: 1, ids: state.route, manual: !!state.manualOrder })); } catch (e) { /* 無法儲存時仍可使用 */ }
  }
  function loadRoute() {
    var ids = [], manual = false;
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (raw) { var o = JSON.parse(raw); if (o && Array.isArray(o.ids)) { ids = o.ids; manual = o.manual === true; } }
    } catch (e) { ids = []; }
    var seen = {};
    state.route = ids.filter(function (id) {
      if (typeof id !== 'string' || seen[id] || !SPOT[id] || !hasCoords(SPOT[id])) return false;
      seen[id] = true; return true;
    }).slice(0, ROUTE_MAX);
    state.manualOrder = manual && state.route.length > 0;
  }
  function announce(t) { $('route-live').textContent = t; }

  /* 使用者手動調整過順序後，新加入的點插在離它最近的那一站後面，其他站不動 */
  function insertNearest(ids, id) {
    if (!ids.length) return { ids: [id], after: null };
    var bi = 0, bd = Infinity;
    for (var i = 0; i < ids.length; i++) {
      var d = meters(SPOT[ids[i]], SPOT[id]);
      if (d < bd) { bd = d; bi = i; }
    }
    var out = ids.slice();
    out.splice(bi + 1, 0, id);
    return { ids: out, after: ids[bi] };
  }

  function toggleRoute(id, fromPanel) {
    var s = SPOT[id];
    if (!hasCoords(s)) return;
    var i = state.route.indexOf(id);
    if (i >= 0) {
      state.route.splice(i, 1);
      if (!state.route.length) state.manualOrder = false;
      announce('已移除「' + s.nameJa + '」，其餘順序不變。');
    } else {
      if (state.route.length >= ROUTE_MAX) { announce('路線最多 ' + ROUTE_MAX + ' 站，請先移除一站。'); return; }
      if (state.manualOrder) {
        var r = insertNearest(state.route, id);
        state.route = r.ids;
        announce('已加入「' + s.nameJa + '」，排在最近的「' + SPOT[r.after].nameJa + '」之後；你調整過的順序保持不變。');
      } else {
        state.route = nearestOrder(state.route.concat([id]));
        announce(state.route.length >= 3 ? '已加入「' + s.nameJa + '」，並從第 1 站起以最近鄰法自動排序。' : '已加入「' + s.nameJa + '」。');
      }
    }
    routeChanged(true, fromPanel === true && i >= 0 ? { removedAt: i } : null);
  }
  function moveStop(i, dir) {
    var j = i + dir;
    if (j < 0 || j >= state.route.length) return;
    var t = state.route[i]; state.route[i] = state.route[j]; state.route[j] = t;
    state.manualOrder = true;
    announce('「' + SPOT[t].nameJa + '」移到第 ' + (j + 1) + ' 站。之後加入的地點會插在最近的一站後面，不會打亂這個順序。');
    routeChanged(true, { movedId: t, dir: dir });
  }
  function routeChanged(fit, focus) {
    saveRoute();
    renderRoute(focus);
    // 路線面板高度剛改變：先同步地圖尺寸，再依實際（縮小後的）高度框住路線
    if (map && mapVisible()) { map.invalidateSize({ pan: false }); refSize = { w: $('map').clientWidth, h: $('map').clientHeight }; }
    if (state.route.length < 2) routeFitPending = false;
    else if (fit && map) {
      if (mapVisible()) fitRoute();
      else routeFitPending = true; // 手機在清單頁改路線：切回地圖時再框住路線
    }
  }
  function fitRoute(extraId) {
    routeFitPending = false;
    var b = L.latLngBounds(state.route.map(function (id) { return [SPOT[id].lat, SPOT[id].lng]; }));
    if (extraId) b.extend([SPOT[extraId].lat, SPOT[extraId].lng]);
    map.fitBounds(b, { padding: [40, 40], maxZoom: 15, animate: !reduceMotion });
  }

  function googleUrl() {
    var pts = state.route.map(function (id) { return SPOT[id].lat + ',' + SPOT[id].lng; });
    var u = 'https://www.google.com/maps/dir/?api=1&origin=' + pts[0] + '&destination=' + pts[pts.length - 1];
    if (pts.length > 2) u += '&waypoints=' + pts.slice(1, -1).join('%7C');
    return u + '&travelmode=walking';
  }
  function routeTotals() {
    var total = 0, totalMin = 0, legs = [], legMin = [];
    for (var i = 1; i < state.route.length; i++) {
      var d = roundLeg(meters(SPOT[state.route[i - 1]], SPOT[state.route[i]]));
      var mm = legMinutes(d);
      legs.push(d); legMin.push(mm); total += d; totalMin += mm;
    }
    return { total: total, legs: legs, legMin: legMin, totalMin: totalMin };
  }

  function iconBtn(label, kind, path, onClick, disabled) {
    var ns = 'http://www.w3.org/2000/svg';
    var b = h('button', { type: 'button', class: 'icon-btn', 'data-act': kind, 'aria-label': label, title: label });
    var svg = document.createElementNS(ns, 'svg'); svg.setAttribute('viewBox', '0 0 20 20'); svg.setAttribute('aria-hidden', 'true');
    var p = document.createElementNS(ns, 'path'); p.setAttribute('d', path); svg.appendChild(p); b.appendChild(svg);
    b.addEventListener('click', onClick);
    if (disabled) b.disabled = true;
    return b;
  }

  function focusEl(el) { if (el) { try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); } } }

  /* focus：{movedId, dir}（上移／下移後）、{removedAt}（從路線面板移除後）、{act:'resort'|'clear'} */
  function renderRoute(focus) {
    focus = focus || {};
    var n = state.route.length;
    $('route-count').textContent = n + '／' + ROUTE_MAX + ' 站';
    var body = $('route-body');
    body.textContent = '';
    body.classList.toggle('has-stops', n > 0);

    if (n === 0) {
      body.appendChild(h('p', { class: 'route-empty' }, ['在清單卡片（或地圖標記的小視窗）按「加入路線」，選 ' + ROUTE_MIN + '～' + ROUTE_MAX + ' 個有座標的地點。系統會以最近鄰法自動排序，之後可再上下調整。']));
    } else {
      var t = routeTotals();
      var ol = h('ol', { class: 'stops' });
      state.route.forEach(function (id, i) {
        var s = SPOT[id];
        if (i > 0) {
          ol.appendChild(h('li', { class: 'leg', 'aria-label': '第 ' + i + ' 段：直線 ' + fmtRouteDist(t.legs[i - 1]) + '，步行' + fmtMin(t.legMin[i - 1]) }, [
            h('span', { class: 'leg-line', 'aria-hidden': 'true' }),
            h('span', { class: 'leg-text', text: '直線 ' + fmtRouteDist(t.legs[i - 1]) + '・步行' + fmtMin(t.legMin[i - 1]) })
          ]));
        }
        var li = h('li', { class: 'stop' + (id === focus.movedId ? (focus.dir < 0 ? ' moved-up' : ' moved-down') : ''), 'data-stop': id }, [
          h('span', { class: 'stop-no', 'aria-hidden': 'true', text: String(i + 1) }),
          h('button', { type: 'button', class: 'stop-name', lang: 'ja', onclick: function () { select(id, 'list'); } }, [s.nameJa]),
          h('span', { class: 'stop-tools' }, [
            iconBtn('「' + s.nameJa + '」上移', 'up', 'M10 15V5M5.5 9.5L10 5l4.5 4.5', function () { moveStop(i, -1); }, i === 0),
            iconBtn('「' + s.nameJa + '」下移', 'down', 'M10 5v10M5.5 10.5L10 15l4.5-4.5', function () { moveStop(i, 1); }, i === n - 1),
            iconBtn('從路線移除「' + s.nameJa + '」', 'remove', 'M5.5 5.5l9 9M14.5 5.5l-9 9', function () { toggleRoute(id, true); })
          ])
        ]);
        ol.appendChild(li);
      });
      body.appendChild(ol);

      // 摘要：總距離、時間、聲明、按鈕（桌面放在站點清單旁，永遠看得到）
      var sum = h('div', { class: 'route-summary' });
      if (n < ROUTE_MIN) {
        sum.appendChild(h('p', { class: 'route-hint', text: '再選 ' + (ROUTE_MIN - n) + ' 個地點，就能計算距離與步行時間。' }));
      } else {
        sum.appendChild(h('div', { class: 'route-total' }, [
          h('p', { class: 'total-main' }, [h('span', { class: 'total-label', text: '總直線距離' }), h('strong', { text: fmtRouteDist(t.total) })]),
          h('p', { class: 'total-main' }, [h('span', { class: 'total-label', text: '步行時間' }), h('strong', { text: fmtMin(t.totalMin) })]),
          h('p', { class: 'total-sub', text: '以每分鐘 ' + WALK_M_PER_MIN + ' 公尺計算' })
        ]));
      }
      sum.appendChild(h('p', { class: 'route-disclaimer', text: '依直線距離估算，不含繞路與停留，實際以 Google 地圖為準' }));

      var actions = h('div', { class: 'route-actions' });
      if (n >= ROUTE_MIN) {
        actions.appendChild(h('a', { class: 'primary-btn', id: 'gmaps-link', href: googleUrl(), target: '_blank', rel: 'noopener' }, ['開啟 Google 地圖步行導航', arrowSvg()]));
      } else {
        actions.appendChild(h('button', { type: 'button', class: 'primary-btn', disabled: true }, ['開啟 Google 地圖步行導航']));
      }
      if (n >= 3) actions.appendChild(h('button', { type: 'button', class: 'ghost-btn', 'data-act': 'resort', onclick: function () {
        state.route = nearestOrder(state.route); state.manualOrder = false;
        announce('已從第 1 站起以最近鄰法重新排序。之後加入的地點會再自動排序。');
        routeChanged(true, { act: 'resort' });
      } }, ['重新自動排序']));
      actions.appendChild(h('button', { type: 'button', class: 'ghost-btn', 'data-act': 'clear', onclick: function () {
        state.route = []; state.manualOrder = false; announce('已清除路線。'); routeChanged(false, { act: 'clear' });
      } }, ['清除路線']));
      sum.appendChild(actions);
      body.appendChild(sum);
    }

    // 鍵盤操作後把焦點放回合理位置（重建按鈕會讓焦點掉到 body）
    if (focus.movedId) {
      var mli = body.querySelector('[data-stop="' + focus.movedId + '"]');
      var want = mli && mli.querySelector('[data-act="' + (focus.dir < 0 ? 'up' : 'down') + '"]');
      if (!want || want.disabled) want = mli && mli.querySelector('.icon-btn:not(:disabled)');
      focusEl(want);
    } else if (typeof focus.removedAt === 'number') {
      var names = body.querySelectorAll('.stop-name');
      focusEl(names.length ? names[Math.min(focus.removedAt, names.length - 1)] : $('route-title'));
    } else if (focus.act === 'resort') {
      focusEl(body.querySelector('[data-act="resort"]'));
    } else if (focus.act === 'clear') {
      focusEl($('route-title'));
    }

    // 地圖連線（路線用墨色，不與季節階段色混淆）
    if (map) {
      if (routeLayer) { map.removeLayer(routeLayer); routeLayer = null; }
      if (n >= 2) {
        var ll = state.route.map(function (id) { return [SPOT[id].lat, SPOT[id].lng]; });
        routeLayer = L.layerGroup([
          L.polyline(ll, { color: '#fffaf0', weight: 8, opacity: 0.85, interactive: false, lineCap: 'round', lineJoin: 'round' }),
          L.polyline(ll, { color: '#22201c', weight: 4, opacity: 0.9, dashArray: '1 9', lineCap: 'round', interactive: false })
        ]).addTo(map);
      }
      updateMarkers();
    }

    // 卡片上的按鈕狀態
    document.querySelectorAll('[data-route-toggle]').forEach(function (b) {
      var id = b.getAttribute('data-route-toggle');
      var ord = state.route.indexOf(id);
      var s = SPOT[id];
      if (!hasCoords(s)) { b.textContent = '無座標，不可加入路線'; b.disabled = true; return; }
      b.setAttribute('aria-pressed', String(ord >= 0));
      b.disabled = ord < 0 && n >= ROUTE_MAX;
      b.textContent = ord >= 0 ? '已加入・第 ' + (ord + 1) + ' 站' : (n >= ROUTE_MAX ? '路線已滿 5 站' : '加入路線');
    });
    document.querySelectorAll('[data-pop-route]').forEach(function (b) {
      var id = b.getAttribute('data-pop-route');
      var inR = state.route.indexOf(id) >= 0;
      b.disabled = !inR && n >= ROUTE_MAX;
      b.textContent = inR ? '移出路線' : (n >= ROUTE_MAX ? '路線已滿 5 站' : '加入路線');
    });
    renderRouteBar();
  }

  function renderRouteBar() {
    var bar = $('route-bar');
    var n = state.route.length;
    var show = n > 0 && state.view === 'list' && !mqDesktop.matches;
    bar.hidden = !show;
    document.body.classList.toggle('has-route-bar', show);
    if (!show) return;
    var box = $('route-bar-text');
    box.textContent = '';
    box.appendChild(h('strong', { class: 'rb-title', text: '銀杏散步路線・' + n + ' 站' }));
    var line2;
    if (n >= ROUTE_MIN) { var t = routeTotals(); line2 = '直線 ' + fmtRouteDist(t.total) + '・步行' + fmtMin(t.totalMin); }
    else line2 = '再選 ' + (ROUTE_MIN - n) + ' 站就能計算距離';
    box.appendChild(h('span', { class: 'rb-sub', text: line2 }));
  }

  /* ======================================================================
   * 頁尾：資料來源
   * ==================================================================== */
  function buildSources() {
    var box = $('source-list');
    var a = function (href, text, cls) { return h('a', { href: href, target: '_blank', rel: 'noopener', class: cls || null }, [text]); };

    box.appendChild(h('div', { class: 'src-block' }, [
      h('h3', { text: '主要資料' }),
      h('ul', { class: 'src-links' }, [
        h('li', null, [a(SITE_META.sheetUrl, '老師資料表（Google 試算表，' + SITE_META.rowCount + ' 列來源索引）')]),
      ]),
      h('p', { class: 'src-note', text: '景點欄位（營運單位、等級、官方資訊、證據日期、更新頻率、注意事項）取自此表；座標與官方頁面核對為 ' + SITE_META.snapshotDate + ' 的資料快照。' })
    ]));

    var seenRows = {};
    var spotLinks = [];
    SPOTS.forEach(function (s) {
      if (seenRows[s.row]) return; seenRows[s.row] = true;
      spotLinks.push(h('li', null, [a(s.url, s.row + '　' + s.sheetName)]));
    });
    box.appendChild(h('div', { class: 'src-block' }, [
      h('h3', { text: '景點官方來源（' + spotLinks.length + ' 列）' }),
      h('ul', { class: 'src-links cols' }, spotLinks)
    ]));

    var proofs = SPOTS.filter(function (s) { return s.proof; });
    box.appendChild(h('div', { class: 'src-block' }, [
      h('h3', { text: '銀杏佐證（同一官方網域的其他頁）' }),
      h('ul', { class: 'src-links cols' }, proofs.map(function (s) { return h('li', null, [a(s.proof.url, s.row + '　' + s.nameJa)]); }))
    ]));

    SOURCE_CATEGORIES.forEach(function (cat) {
      var rows = SOURCES.filter(function (r) { return r.cat === cat.key; });
      if (!rows.length) return;
      box.appendChild(h('div', { class: 'src-block' + (cat.key === 'excluded' ? ' is-excluded' : '') }, [
        h('h3', { text: cat.label }),
        h('p', { class: 'src-note', text: cat.note }),
        h('ul', { class: 'src-rows' }, rows.map(function (r) {
          var dead = cat.key === 'excluded' && /404/.test(r.finding);
          return h('li', null, [
            dead
              ? h('p', { class: 'src-dead' }, [h('span', { text: r.id + '　' + r.name }), h('span', { class: 'src-url', text: r.url + '（已失效，不提供連結）' })])
              : a(r.url, r.id + '　' + r.name),
            h('p', { class: 'src-meta', text: r.grade + '｜' + GRADE_INFO[r.grade] + '・' + r.operator }),
            cat.key === 'excluded' ? h('p', { class: 'src-reason', text: '排除理由：' + r.finding + ' ' + r.caveat }) : h('p', { class: 'src-reason', text: r.caveat })
          ]);
        }))
      ]));
    });

    box.appendChild(h('div', { class: 'src-block' }, [
      h('h3', { text: '其他參考' }),
      h('ul', { class: 'src-links cols' }, OTHER_REFS.map(function (r) { return h('li', null, [a(r.url, r.label)]); }))
    ]));
  }

  /* ======================================================================
   * 啟動
   * ==================================================================== */
  function init() {
    buildSeason();
    buildFilters();
    buildCards();
    buildTabs();
    buildNear();
    buildSources();
    loadRoute();
    renderSeason();
    initMap();
    applyFilters();
    renderRoute();
    $('route-bar-btn').addEventListener('click', function () {
      setView('map');
      requestAnimationFrame(function () { $('route').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' }); });
    });
    // 跳過 26 個地圖標記，直接到散步路線
    $('skip-map').addEventListener('click', function (ev) {
      ev.preventDefault();
      var t = $('route-title');
      t.focus({ preventScroll: true });
      t.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'nearest' });
    });
    // 桌面篩選列固定在上方：把它的高度提供給 scroll-padding，避免卡片標題被蓋住
    var tool = $('toolbar');
    var syncTool = function () { document.documentElement.style.setProperty('--tool-h', tool.offsetHeight + 'px'); };
    syncTool();
    if (window.ResizeObserver) new ResizeObserver(syncTool).observe(tool);
    else window.addEventListener('resize', syncTool);
    // 地圖載入失敗時，手機直接顯示清單，避免停在只有錯誤訊息的畫面
    setView(mapFailed && !mqDesktop.matches ? 'list' : 'map');
    booted = true;
    if (state.route.length) announce('已還原上次儲存的路線（' + state.route.length + ' 站）。');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
