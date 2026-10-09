/* 東京銀杏一年生長階段情報：共用腳本。由 sakura.py 產生，請改 sakura.py 而不是這個檔案。
 * 做兩件事：
 *   1. 依「你開啟頁面當天的日期」推估階段（氣象廳東京平年值），填進各頁的階段欄位。
 *   2. 首頁：用 Leaflet + OpenStreetMap 圖磚畫地圖；圖磚或 Leaflet 載入失敗時顯示說明，表格仍可使用。
 * 不使用 ES module，也不讀取本機檔案，所以直接雙擊 index.html 也能運作。 */
(function () {
  'use strict';
  var D = window.GINKGO_DATA;
  if (!D) { return; }
  var ROOT = document.body.getAttribute('data-root') || '';

  /* ---------- 階段模型 ---------- */
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }

  // 回傳 1..6。D = 氣象廳東京 いちょう黄葉日 平年值（11/23）；offsets 是各階段起點相對 D 的天數。
  function stageNumber(date) {
    var m = D.model;
    var y = date.getFullYear();
    var t = Date.UTC(y, date.getMonth(), date.getDate());
    var base = Date.UTC(y, m.baseMonth - 1, m.baseDay);
    var diff = Math.round((t - base) / 86400000);
    var n = 0;
    for (var i = 0; i < m.offsets.length; i++) {
      if (m.offsets[i] !== null && diff >= m.offsets[i]) { n = i + 1; }
    }
    if (n > 0) { return n; }
    // 早於 D-28：模型只涵蓋秋季。保守假設：1 月到 3 月仍是落葉，之後到 10/25 是青葉。
    return (date.getMonth() + 1) < m.springMonth ? 6 : 1;
  }

  var NOW = new Date();
  var ISO = ymd(NOW);
  var N = stageNumber(NOW);
  var ST = D.stages[N - 1];

  function stageHref(n) { return ROOT + 'stages/' + n + '.html'; }
  function placeHref(id) { return ROOT + 'places/' + id + '.html'; }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) { e.className = cls; }
    if (text !== undefined && text !== null) { e.textContent = text; }
    return e;
  }
  function each(list, fn) { Array.prototype.forEach.call(list, fn); }

  function fillStageLink(a, n) {
    var s = D.stages[n - 1];
    a.className = (a.className ? a.className.replace(/\bs[1-6]\b/g, '').trim() + ' ' : '') + 'stage-link s' + n;
    a.setAttribute('href', stageHref(n));
    a.setAttribute('title', s.ja + '（' + s.gloss + '）：依氣象廳東京平年值推估');
    a.textContent = '';
    a.appendChild(el('i', 'dot'));
    var t = el('span', null, s.ja);
    t.setAttribute('lang', 'ja');
    a.appendChild(t);
  }
  function fillInline(a, n) { fillStageLink(a, n); a.className += ' inline'; }

  each(document.querySelectorAll('[data-slot="today"]'), function (e) {
    e.textContent = ISO;
    if (e.tagName === 'TIME') { e.setAttribute('datetime', ISO); }
  });
  each(document.querySelectorAll('[data-slot="stage-name"]'), function (e) { e.textContent = ST.ja; });
  each(document.querySelectorAll('[data-slot="stage-gloss"]'), function (e) { e.textContent = ST.gloss; });
  each(document.querySelectorAll('a[data-slot="stage-link"]'), function (a) { fillStageLink(a, N); });
  each(document.querySelectorAll('td[data-stage-cell]'), function (td) {
    var a = el('a');
    a.setAttribute('data-slot', 'stage-link');
    fillStageLink(a, N);
    td.appendChild(a);
  });
  each(document.querySelectorAll('.verdict'), function (v) { v.classList.add('s' + N); });
  each(document.querySelectorAll('.ruler .rs'), function (li) {
    if (parseInt(li.getAttribute('data-stage'), 10) === N) { li.classList.add('is-now'); }
  });

  /* ---------- 階段頁：今天是否屬於此階段、目前在此階段的地點 ---------- */
  var pageStage = parseInt(document.body.getAttribute('data-stage') || '0', 10);
  if (pageStage) {
    var status = document.getElementById('stage-status');
    if (status) {
      status.textContent = '';
      status.appendChild(document.createTextNode('依今天（' + ISO + '）的日期，並依氣象廳東京平年值推估：'));
      if (pageStage === N) {
        status.appendChild(el('strong', null, '東京的銀杏現在就在這個階段。'));
      } else {
        status.appendChild(document.createTextNode('東京的銀杏目前在「'));
        var link = el('a');
        fillInline(link, N);
        status.appendChild(link);
        status.appendChild(document.createTextNode('」，不在這個階段。'));
      }
    }
    var list = document.getElementById('stage-places');
    var empty = document.getElementById('stage-places-empty');
    if (list && empty) {
      if (pageStage === N) {
        list.hidden = false;
        empty.hidden = true;
        var c = document.getElementById('stage-places-count');
        if (c) { c.textContent = String(D.places.length); }
      } else {
        list.hidden = true;
        empty.hidden = false;
        var where = document.getElementById('stage-places-now');
        if (where) { where.textContent = ''; var l2 = el('a'); fillInline(l2, N); where.appendChild(l2); }
      }
    }
  }

  /* ---------- 首頁地圖 ---------- */
  function initMap() {
    var box = document.getElementById('map');
    if (!box) { return; }
    var msg = box.querySelector('.map-msg');
    if (typeof window.L === 'undefined') {
      box.classList.add('map-failed');
      if (msg) { msg.textContent = '地圖元件沒有載入成功（可能是網路限制）。所有地點的位置與階段，仍可在「地點彙整」表格與各地點頁面查看。'; }
      var hint = document.getElementById('map-hint-text');
      if (hint) { hint.textContent = '地圖暫時無法使用。'; }
      return;
    }
    var L = window.L;
    if (msg) { msg.parentNode.removeChild(msg); }
    var notice = document.getElementById('map-notice');

    var map = L.map(box, { trackResize: false, zoomControl: false, minZoom: 8, maxZoom: 18, zoomSnap: 0.5 });
    L.control.zoom({ zoomInTitle: '放大地圖', zoomOutTitle: '縮小地圖' }).addTo(map);
    map.setView([35.69, 139.6], 10);
    map.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noopener noreferrer">Leaflet</a>');

    var tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>'
    }).addTo(map);

    var loaded = 0, failed = 0, noticeShown = false;
    function showNotice() {
      if (noticeShown || !notice) { return; }
      noticeShown = true;
      notice.hidden = false;
    }
    tiles.on('tileload', function () {
      loaded++;
      if (noticeShown && notice) { notice.hidden = true; noticeShown = false; }
    });
    tiles.on('tileerror', function () {
      failed++;
      if (loaded === 0 && failed >= 3) { showNotice(); }
    });
    window.setTimeout(function () { if (loaded === 0) { showNotice(); } }, 9000);

    function esc(s) {
      return String(s).replace(/[&<>"']/g, function (ch) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
      });
    }

    function popupFor(p) {
      var wrap = el('div', 'gk-pop');
      var a = el('a', 'pop-name', p.ja);
      a.setAttribute('href', placeHref(p.id));
      a.setAttribute('lang', 'ja');
      wrap.appendChild(a);
      wrap.appendChild(el('div', 'pop-line', p.area));
      var row = el('div', 'pop-line');
      row.appendChild(document.createTextNode('銀杏現況：'));
      var s = el('a');
      fillStageLink(s, N);
      row.appendChild(s);
      wrap.appendChild(row);
      wrap.appendChild(el('div', 'pop-line', '依氣象廳東京平年值推估'));
      wrap.appendChild(el('div', 'pop-line', '判定日期 ' + ISO));
      wrap.appendChild(el('div', 'pop-line', '近似位置：' + p.pos));
      return wrap;
    }

    var markers = [];
    var latlngs = [];
    D.places.forEach(function (p) {
      var icon = L.divIcon({
        className: 'gk-marker s' + N,
        html: '<span class="gk-pin"></span><span class="gk-lbl"><b>' + esc(p.ja) + '</b><i>' + esc(ST.ja) + '</i></span>',
        iconSize: [44, 44],
        iconAnchor: [22, 22],
        popupAnchor: [0, -16]
      });
      var m = L.marker([p.lat, p.lng], { icon: icon, title: p.ja + '（' + ST.ja + '，推估）', keyboard: true, riseOnHover: true });
      m.bindPopup(function () { return popupFor(p); }, { maxWidth: 270, minWidth: 180, autoPanPadding: [12, 12] });
      m.addTo(map);
      m._gkPlace = p;
      markers.push(m);
      latlngs.push([p.lat, p.lng]);
    });
    var bounds = L.latLngBounds(latlngs);

    var focused = null;
    function labelOf(m) { var e = m.getElement(); return e ? e.querySelector('.gk-lbl') : null; }
    markers.forEach(function (m) {
      m.on('popupopen', function (ev) {
        focused = m;
        var close = ev.popup.getElement() && ev.popup.getElement().querySelector('.leaflet-popup-close-button');
        if (close) { close.setAttribute('aria-label', '關閉視窗'); close.setAttribute('title', '關閉視窗'); }
        schedule();
      });
      m.on('popupclose', function () { if (focused === m) { focused = null; } });
    });

    /* 標籤避讓：只顯示不互相重疊的標籤，放大後會出現更多；點標記一定看得到完整資訊。 */
    var sizes = {};
    function layoutLabels() {
      var mapSize = map.getSize();
      var rects = [];
      var items = markers.map(function (m) {
        var pt = map.latLngToContainerPoint(m.getLatLng());
        rects.push([pt.x - 12, pt.y - 12, pt.x + 12, pt.y + 12]);
        return { m: m, x: pt.x, y: pt.y };
      });
      function hit(r) {
        for (var i = 0; i < rects.length; i++) {
          var q = rects[i];
          if (r[0] < q[2] + 2 && r[2] > q[0] - 2 && r[1] < q[3] + 2 && r[3] > q[1] - 2) { return true; }
        }
        return false;
      }
      items.sort(function (a, b) { return (b.m === focused) - (a.m === focused); });
      items.forEach(function (it) {
        var lbl = labelOf(it.m);
        if (!lbl) { return; }
        var id = it.m._gkPlace.id;
        if (!sizes[id]) { sizes[id] = { w: lbl.offsetWidth, h: lbl.offsetHeight }; }
        var w = sizes[id].w, h = sizes[id].h;
        var right = [it.x + 14, it.y - h / 2, it.x + 14 + w, it.y + h / 2];
        var left = [it.x - 14 - w, it.y - h / 2, it.x - 14, it.y + h / 2];
        var chosen = null, isLeft = false;
        [right, left].some(function (r, idx) {
          var inside = r[0] >= 4 && r[2] <= mapSize.x - 4 && r[1] >= 4 && r[3] <= mapSize.y - 4;
          if (inside && !hit(r)) { chosen = r; isLeft = idx === 1; return true; }
          return false;
        });
        if (chosen) {
          rects.push(chosen);
          lbl.classList.remove('is-off');
          lbl.classList.toggle('is-left', isLeft);
        } else {
          lbl.classList.add('is-off');
        }
      });
    }
    var pending = false;
    function schedule() {
      if (pending) { return; }
      pending = true;
      window.requestAnimationFrame(function () { pending = false; layoutLabels(); });
    }

    /* 視窗大小變化：trackResize 關閉，改由 ResizeObserver 處理；忽略 0x0（地圖被隱藏時）。 */
    var ref = null;
    function refit() {
      if (focused && focused.isPopupOpen()) {
        var z = map.getZoom();
        map.setView(focused.getLatLng(), z, { animate: false });
        focused.openPopup();
      } else {
        map.fitBounds(bounds, { padding: [52, 52], animate: false });
      }
    }
    function handleSize(w, h) {
      if (!w || !h) { return; }
      map.invalidateSize({ animate: false });
      var big = !ref ||
        Math.abs(w - ref.w) > ref.w * 0.25 ||
        Math.abs(h - ref.h) > ref.h * 0.25 ||
        ((w >= h) !== (ref.w >= ref.h));
      if (big) { ref = { w: w, h: h }; refit(); }
      schedule();
    }
    if (box.clientWidth && box.clientHeight) { handleSize(box.clientWidth, box.clientHeight); }
    if (typeof window.ResizeObserver === 'function') {
      var ro = new window.ResizeObserver(function (entries) {
        var r = entries[0].contentRect;
        handleSize(r.width, r.height);
      });
      ro.observe(box);
    }
    window.addEventListener('resize', function () { handleSize(box.clientWidth, box.clientHeight); });
    window.addEventListener('orientationchange', function () {
      window.setTimeout(function () { handleSize(box.clientWidth, box.clientHeight); }, 250);
    });
    map.on('zoomend moveend', schedule);
    // Esc 關閉彈出視窗（焦點在標記上時 Leaflet 不會處理這個按鍵）
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && focused) { map.closePopup(); }
    });
    schedule();
  }

  initMap();
})();
