/* 東京銀杏散步地圖
   靜態網站：沒有後端、帳號或自動更新。資料都放在這個檔案裡。
   六階段與「示範分組」是示範資料，非即時葉況或預測。 */
(function () {
  'use strict';

  /* =====================================================
     資料
     ===================================================== */
  var DEMO = '示範資料，非即時葉況或預測';
  var PDF_2025 = 'https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf';
  var SHEET_URL = 'https://docs.google.com/spreadsheets/d/1dx_41InyuuWuILc4ZHJW8tTZMVOCpIuSz-QzISzd7y0/edit?usp=sharing';
  var TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  var LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  var LEAFLET_CSS_SRI = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
  var LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
  var LEAFLET_JS_SRI = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';

  // 六階段：只描述銀杏一般的樣子，沒有日期，也不是預測。
  var STAGES = [
    { name: '青葉', desc: '葉片還是綠色，樹看起來和夏天差不多。' },
    { name: '開始變色', desc: '部分葉片開始由綠轉黃，樹冠仍以綠色為主。' },
    { name: '黃葉進行中', desc: '黃色的範圍愈來愈大，樹冠綠、黃交雜。' },
    { name: '見頃', desc: '多數葉片轉為金黃，是整體最適合欣賞的階段。' },
    { name: '開始落葉', desc: '葉片開始飄落，樹下與步道出現零星的黃葉。' },
    { name: '落葉', desc: '大部分葉片已經落下，樹冠變得稀疏，地面鋪著黃葉。' }
  ];

  // 12 處園區：資料表 TKG-002～013。座標是「園區近似位置」，不是銀杏樹的位置。
  var SPOTS = [
    {
      id: 'TKG-002', name: '上野恩賜公園', ja: '上野恩賜公園', area: '台東區', areas: ['台東區'],
      lat: 35.713, lng: 139.7724, url: 'https://www.tokyo-park.or.jp/park/ueno/', gq: '上野恩賜公園 東京都台東区',
      features: [
        '以「上野山」台地與不忍池為中心，博物館、美術館與動物園集中在園內。',
        '春天賞櫻、夏天賞蓮，秋天也有紅葉可看。'
      ],
      ginkgo: '2025 年度公告的名單列有銀杏；官方園區頁面沒有寫明銀杏在園內的哪裡。',
      note: '開園時間在不同官方頁面的寫法不一致，出發前請以官方頁面為準。'
    },
    {
      id: 'TKG-003', name: '木場公園', ja: '木場公園', area: '江東區', areas: ['江東區'],
      lat: 35.6752, lng: 139.8085, url: 'https://www.tokyo-park.or.jp/park/kiba/', gq: '木場公園 東京都江東区',
      features: [
        '承接江戶以來「木材之町」的歷史，整建為有水有綠的森林公園。',
        '南、中、北三個地區由木場公園大橋相連，園區寬廣。'
      ],
      ginkgo: '2025 年度公告的名單列有銀杏；但園區自己的官方頁面沒有提到銀杏，本站只能依該名單列入，沒有銀杏的位置資料。'
    },
    {
      id: 'TKG-004', name: '小金井公園', ja: '小金井公園', area: '小金井市等', areas: ['小金井市等'],
      lat: 35.7155, lng: 139.5189, url: 'https://www.tokyo-park.or.jp/park/koganei/', gq: '小金井公園 東京都小金井市',
      features: [
        '沿著玉川上水、約 80 公頃的大型公園，有大片草地、雜木林、櫻花園與江戶東京たてもの園。',
        '園區橫跨小金井市、小平市、西東京市與武藏野市。'
      ],
      ginkgo: '官方頁面把銀杏列在秋季賞花木之中，沒有寫明位置。'
    },
    {
      id: 'TKG-005', name: '芝公園', ja: '芝公園', area: '港區', areas: ['港區'],
      lat: 35.6555, lng: 139.748, url: 'https://www.tokyo-park.or.jp/park/siba/', gq: '芝公園 東京都港区',
      features: [
        '1873 年（明治 6 年）日本最早指定的五處公園之一；因為曾是增上寺境內，園區呈環狀展開。',
        '有樟樹、櫸樹、銀杏等歷史悠久的大樹。'
      ],
      ginkgo: '官方頁面只寫園內有銀杏等大樹，沒有寫明位置。園內的「もみじ谷」是楓樹區，與銀杏無關，本站不把它當作銀杏地點。'
    },
    {
      id: 'TKG-006', name: '城北中央公園', ja: '城北中央公園', area: '板橋區、練馬區', areas: ['板橋區', '練馬區'],
      lat: 35.7564, lng: 139.673, url: 'https://www.tokyo-park.or.jp/park/johoku-chuo/', gq: '城北中央公園 東京都練馬区',
      features: [
        '位於石神井川沿岸、地形起伏的運動公園，有棒球場與競技場，是東京 23 區北部最大規模的運動公園之一。',
        '樹木多，也適合散步。'
      ],
      ginkgo: '官方頁面寫「秋天銀杏並木會漂亮地變色」，沒有寫明並木的位置。2025 年度名單同時列出銀杏與櫸樹，櫸樹的葉況不能當作銀杏。'
    },
    {
      id: 'TKG-007', name: '善福寺川綠地', ja: '善福寺川緑地', area: '杉並區', areas: ['杉並區'],
      lat: 35.692, lng: 139.6305, url: 'https://www.tokyo-park.or.jp/park/zempukujigawa-ryokuchi/index.html', gq: '善福寺川緑地 東京都杉並区',
      features: [
        '沿善福寺川延伸的帶狀綠地，與和田堀公園相連。',
        '保留武藏野風貌的樹林，與兒童廣場交替出現，適合賞櫻與秋天散步。'
      ],
      ginkgo: '官方頁面提到秋天櫸樹、銀杏、唐楓與櫻花等會變成鮮豔的紅葉，沒有指出銀杏的位置。2025 年度名單把本園與和田堀公園合為一列。'
    },
    {
      id: 'TKG-008', name: '和田堀公園', ja: '和田堀公園', area: '杉並區', areas: ['杉並區'],
      lat: 35.6855, lng: 139.6395, url: 'https://www.tokyo-park.or.jp/park/wadabori/', gq: '和田堀公園 東京都杉並区',
      features: [
        '橫跨善福寺川上 12 座橋的公園，有安靜的和田堀池。',
        '與隔壁大宮八幡宮的樹林連成一片綠意。'
      ],
      ginkgo: '官方頁面介紹鄰接的大宮八幡宮：黃葉的神門「夫婦銀杏」值得一看。神社是公園旁的另一處設施。2025 年度名單把本園與善福寺川綠地合為一列。'
    },
    {
      id: 'TKG-009', name: '戶山公園', ja: '戸山公園', area: '新宿區', areas: ['新宿區'],
      lat: 35.7037, lng: 139.7135, url: 'https://www.tokyo-park.or.jp/park/toyama/', gq: '戸山公園 東京都新宿区',
      features: [
        '分成兩區：以山手線內最高點「箱根山」為中心的箱根山地區，以及運動與休憩的大久保地區。'
      ],
      ginkgo: '官方頁面把銀杏列在秋季賞花木之中，沒有寫明位置。2025 年度名單是楓樹與銀杏，楓葉的葉況不能當作銀杏。',
      pos: '標記放在箱根山地區的近似位置。'
    },
    {
      id: 'TKG-010', name: '光丘公園', ja: '光が丘公園', area: '練馬區、板橋區', areas: ['練馬區', '板橋區'],
      lat: 35.7662, lng: 139.6295, url: 'https://www.tokyo-park.or.jp/park/hikarigaoka/', gq: '光が丘公園 東京都練馬区',
      features: [
        '由美軍住宅「Grant Heights」歸還地整建的大型公園，有銀杏並木、草坪廣場與野鳥保護區。'
      ],
      ginkgo: '官方頁面介紹兩處：公園中央、販賣部與觀賞池之間的「いちょう並木」，是從 Grant Heights 時代移植的 28 棵銀杏；以及「ふれあいの径」，是從有樂町舊都廳前行道樹移植、樹齡超過 100 年的 40 棵巨木。'
    },
    {
      id: 'TKG-011', name: '日比谷公園', ja: '日比谷公園', area: '千代田區', areas: ['千代田區'],
      lat: 35.6732, lng: 139.7555, url: 'https://www.tokyo-park.or.jp/park/hibiya/', gq: '日比谷公園 東京都千代田区',
      features: [
        '1903 年（明治 36 年）開園，由本多靜六設計，是日本第一座西洋式公園。',
        '有大噴水、花壇與江戶時代的遺構，位在都心。'
      ],
      ginkgo: '園內的「首賭けイチョウ」推定樹齡 400 至 500 年、樹幹周長約 7 公尺，1902 年由本多靜六博士移植，是公園的象徵。官方頁面文字沒有寫明園內的確切位置。',
      note: '官方頁面公告：2026 年 10 月時點因再生整備工事，大噴水與噴水廣場一帶等部分區域無法進入。'
    },
    {
      id: 'TKG-012', name: '代代木公園', ja: '代々木公園', area: '澀谷區', areas: ['澀谷區'],
      lat: 35.6717, lng: 139.6965, url: 'https://www.tokyo-park.or.jp/park/yoyogi/', gq: '代々木公園 東京都渋谷区',
      features: [
        '曾是練兵場與選手村的森林公園，是東京 23 區內都立公園中第 5 大的。',
        '由 A 地區的森林，以及 B 地區的競技場與戶外舞台組成。'
      ],
      ginkgo: '官方頁面把銀杏列在秋季賞花木之中，沒有寫明位置。'
    },
    {
      id: 'TKG-013', name: '舊岩崎邸庭園', ja: '旧岩崎邸庭園', area: '台東區（入口）', areas: ['台東區'],
      lat: 35.7092, lng: 139.7683, url: 'https://www.tokyo-park.or.jp/park/kyu-iwasaki-tei/', gq: '旧岩崎邸庭園 東京都台東区',
      features: [
        '1896 年（明治 29 年）建成的岩崎久彌本邸，保留洋館、撞球室與和館，是日本國家指定的重要文化財。'
      ],
      ginkgo: '官方頁面把銀杏與楓樹列為秋季植物，沒有寫明位置。',
      note: '需購票入園：一般 400 日圓、65 歲以上 200 日圓；開園 9:00–17:00（入園至 16:30），12 月 29 日至 1 月 1 日休園。2026-10-02 核對，之後可能變動。',
      pos: '標記放在庭園正門（入口）附近。'
    }
  ];

  // 示範分組：12 處依清單順序每 2 處分成一組，放進六個階段。只是為了示範篩選，與實際葉況無關。
  var byId = {};
  SPOTS.forEach(function (s, i) {
    s.no = ('0' + (i + 1)).slice(-2);
    s.stageIdx = Math.floor(i / 2);
    byId[s.id] = s;
  });

  var AREAS = [];
  SPOTS.forEach(function (s) {
    s.areas.forEach(function (a) { if (AREAS.indexOf(a) < 0) AREAS.push(a); });
  });

  /* =====================================================
     小工具
     ===================================================== */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function reduceMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }
  var deskMQ = window.matchMedia('(min-width: 960px)');
  function isDesktop() { return deskMQ.matches; }

  function leafSVG(cls) {
    return '<svg class="leaf' + (cls ? ' ' + cls : '') + '" viewBox="0 0 32 32" aria-hidden="true" focusable="false">' +
      '<path class="leaf-body" d="M16 25.4C11 22.6 5 17.6 1.8 11.4C1.2 10 2 8.6 3.6 8.2C5.6 7.7 7.4 7 9.4 7C12.4 7 14.6 9.2 16 13.2C17.4 9.2 19.6 7 22.6 7C24.6 7 26.4 7.7 28.4 8.2C30 8.6 30.8 10 30.2 11.4C27 17.6 21 22.6 16 25.4Z"/>' +
      '<path class="leaf-vein" d="M16 24.6V14.2M16 24.6L10.6 8.8M16 24.6L4.6 10.2M16 24.6L21.4 8.8M16 24.6L27.4 10.2"/>' +
      '<path class="leaf-stem" d="M16 25V30.8"/></svg>';
  }

  /* =====================================================
     狀態與元素
     ===================================================== */
  var state = { stage: null, area: 'all', focus: null, route: [], tab: 'map' };

  var el = {
    workspace: $('#workspace'), tabs: $('#tabs'),
    stageRow: $('#stage-row'), stageDesc: $('#stage-desc'), stageClear: $('#stage-clear'),
    area: $('#area'), count: $('#count'), filterClear: $('#filter-clear'),
    controlsToggle: $('#controls-toggle'), controlsBody: $('#controls-body'), controlsSummary: $('#controls-summary'),
    list: $('#spot-list'), listEmpty: $('#list-empty'), listPane: $('#pane-list'),
    routeList: $('#route-list'), routeEmpty: $('#route-empty'), routeActions: $('#route-actions'),
    gmaps: $('#gmaps-links'), routePane: $('#pane-route'),
    detail: $('#detail'), live: $('#live'),
    mapPane: $('#pane-map'), mapEl: $('#map'), mapMsg: $('#map-msg'),
    tabListN: $('#tab-list-n'), tabRouteN: $('#tab-route-n')
  };
  var lastTrigger = null; // 關閉介紹卡時要回到的元素（用選擇器記，因為清單重畫後元素會換新）

  function filtered() {
    return SPOTS.filter(function (s) {
      return (state.area === 'all' || s.areas.indexOf(state.area) >= 0) &&
        (state.stage === null || s.stageIdx === state.stage);
    });
  }
  function shownIds() {
    var set = {};
    filtered().forEach(function (s) { set[s.id] = true; });
    state.route.forEach(function (id) { set[id] = true; });
    return set;
  }
  function stageOf(s) { return state.stage !== null && s.stageIdx === state.stage ? STAGES[s.stageIdx] : null; }

  function announce(msg) {
    el.live.textContent = '';
    window.setTimeout(function () { el.live.textContent = msg; }, 30);
  }

  /* =====================================================
     畫面：階段、篩選
     ===================================================== */
  function buildControls() {
    el.stageRow.innerHTML = STAGES.map(function (st, i) {
      return '<button class="stage" type="button" data-stage="' + i + '" aria-pressed="false">' +
        '<span class="stage__leaf">' + leafSVG() + '</span><span class="stage__name">' + esc(st.name) + '</span></button>';
    }).join('');
    var counts = {};
    SPOTS.forEach(function (s) { s.areas.forEach(function (a) { counts[a] = (counts[a] || 0) + 1; }); });
    el.area.innerHTML = '<option value="all">全部區域（12）</option>' + AREAS.map(function (a) {
      return '<option value="' + esc(a) + '">' + esc(a) + '（' + counts[a] + '）</option>';
    }).join('');
  }

  function stageDescHTML() {
    if (state.stage === null) {
      return '未套用示範階段：地圖與清單顯示全部 12 處，不帶任何葉況。點選階段可預覽銀杏的變化；為了示範篩選，' +
        '12 處依清單順序每 2 處分一組，這個分組與各地點的實際葉況無關。';
    }
    var st = STAGES[state.stage];
    var names = SPOTS.filter(function (s) { return s.stageIdx === state.stage; })
      .map(function (s) { return s.name; });
    return '<b>' + esc(st.name) + '</b>：' + esc(st.desc) + ' 示範分組把「' + esc(names.join('、')) +
      '」放在這一階段，只是為了示範篩選，與這些地點的實際葉況無關。<span class="demo-label">' + DEMO + '。</span>';
  }

  function renderControls(items) {
    $$('.stage', el.stageRow).forEach(function (b) {
      b.setAttribute('aria-pressed', String(state.stage === Number(b.getAttribute('data-stage'))));
    });
    el.stageDesc.innerHTML = stageDescHTML();
    el.stageClear.hidden = state.stage === null;
    el.area.value = state.area;
    var filtering = state.stage !== null || state.area !== 'all';
    el.filterClear.hidden = !filtering;
    el.count.textContent = filtering
      ? '顯示 ' + items.length + ' / 12 處' + (state.stage !== null ? '（示範分組）' : '')
      : '顯示全部 12 處';
    var areaTxt = state.area === 'all' ? '全部區域' : state.area;
    el.controlsSummary.textContent = areaTxt + '．' + (state.stage === null ? '未套用示範階段' : '示範階段：' + STAGES[state.stage].name);
    el.tabListN.textContent = String(items.length);
    el.tabRouteN.textContent = String(state.route.length);
  }

  /* =====================================================
     畫面：清單
     ===================================================== */
  function rowHTML(s) {
    var st = stageOf(s);
    var rIdx = state.route.indexOf(s.id);
    var sel = state.focus === s.id;
    return '<li class="spot" data-id="' + s.id + '" data-sel="' + sel + '">' +
      '<button class="spot__main" type="button" data-act="select" data-id="' + s.id + '" aria-current="' + (sel ? 'true' : 'false') + '">' +
        '<span class="spot__no" aria-hidden="true">' + s.no + '</span>' +
        '<span class="spot__txt">' +
          '<span class="spot__name">' + esc(s.name) + '</span>' +
          '<span class="spot__meta">' + esc(s.area) + '</span>' +
          (st ? '<span class="spot__stage" data-stage="' + s.stageIdx + '">' + leafSVG() +
            '<b>示範階段：' + esc(st.name) + '</b><span class="demo-label">' + DEMO + '</span></span>' : '') +
          (rIdx >= 0 ? '<span class="spot__inroute">路線第 ' + (rIdx + 1) + ' 站</span>' : '') +
        '</span>' +
      '</button>' +
      '<button class="btn ' + (rIdx >= 0 ? 'btn--ghost' : '') + '" type="button" data-act="toggle-route" data-id="' + s.id + '" aria-label="' +
        (rIdx >= 0 ? '移出路線：' : '加入路線：') + esc(s.name) + '">' + (rIdx >= 0 ? '移出路線' : '加入路線') + '</button>' +
    '</li>';
  }

  function renderList(items) {
    el.list.innerHTML = items.map(rowHTML).join('');
    el.listEmpty.hidden = items.length > 0;
  }

  /* =====================================================
     畫面：介紹卡
     ===================================================== */
  function detailHTML(s) {
    var st = stageOf(s);
    var rIdx = state.route.indexOf(s.id);
    var jaLine = s.ja !== s.name ? '<p class="detail__ja">官方日文名稱：<span lang="ja">' + esc(s.ja) + '</span></p>' : '';
    return '<div class="detail__top"><div>' +
        '<p class="detail__area">' + esc(s.area) + '</p>' +
        '<h3 id="detail-title">' + esc(s.name) + '</h3>' + jaLine +
      '</div><button class="detail__close" type="button" data-act="close-detail" aria-label="關閉介紹">' +
        '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 4l12 12M16 4L4 16" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/></svg></button></div>' +
      '<div class="detail__acts">' +
        '<button class="btn ' + (rIdx >= 0 ? 'btn--ghost' : '') + '" type="button" data-act="toggle-route" data-id="' + s.id + '">' +
          (rIdx >= 0 ? '移出路線（目前第 ' + (rIdx + 1) + ' 站）' : '加入路線') + '</button>' +
        '<button class="btn btn--ink" type="button" data-act="show-map" data-id="' + s.id + '">在地圖上看</button>' +
      '</div>' +
      (st ? '<div class="detail__stage" data-stage="' + s.stageIdx + '">' + leafSVG() +
        '<b>示範階段：' + esc(st.name) + '</b><span class="demo-label">' + DEMO + '</span></div>' : '') +
      '<div class="detail__sec"><h4>景點特色</h4><ul>' + s.features.map(function (f) { return '<li>' + esc(f) + '</li>'; }).join('') + '</ul></div>' +
      '<div class="detail__sec"><h4>銀杏的官方說明</h4><p>' + esc(s.ginkgo) + '</p></div>' +
      (s.note ? '<div class="detail__sec"><p class="detail__note">' + esc(s.note) + '</p></div>' : '') +
      '<div class="detail__sec"><h4>2025 年公告（歷史資料）</h4><p class="detail__hist">東京都公園協會 2025 年度公告（2025-11-04）的名單列有銀杏。這是歷史公告，不代表 2026 年葉況；本站沒有這個地點的 2026 年當季葉況。</p></div>' +
      '<div class="detail__sec"><h4>官方來源</h4><div class="detail__links">' +
        '<a href="' + esc(s.url) + '" target="_blank" rel="noopener noreferrer">東京都公園協會官方頁面（' + esc(s.ja) + '）</a>' +
        '<a href="' + PDF_2025 + '" target="_blank" rel="noopener noreferrer">2025 年度紅葉情報公告（PDF，歷史資料）</a>' +
        '<span class="detail__fine">資料表編號 ' + s.id + '；特色與說明整理自官方頁面，2026-10-02 核對。</span>' +
      '</div></div>' +
      '<p class="detail__fine detail__sec">地圖標記是「園區近似位置」，不是銀杏樹的位置。' + (s.pos ? esc(s.pos) : '') + '</p>';
  }

  function renderDetail() {
    var s = state.focus && byId[state.focus];
    if (!s) { el.detail.hidden = true; el.detail.innerHTML = ''; el.detail.removeAttribute('data-for'); el.workspace.removeAttribute('data-detail'); return; }
    var top = el.detail.scrollTop;
    var same = !el.detail.hidden && el.detail.getAttribute('data-for') === s.id;
    el.detail.setAttribute('data-for', s.id);
    el.detail.innerHTML = detailHTML(s);
    el.detail.setAttribute('aria-labelledby', 'detail-title');
    el.detail.removeAttribute('aria-label');
    el.detail.hidden = false;
    el.workspace.setAttribute('data-detail', 'open');
    el.detail.scrollTop = same ? top : 0;
  }

  /* =====================================================
     畫面：自選路線
     ===================================================== */
  function gmapsURL(stops) {
    function q(s) { return encodeURIComponent(s.gq); }
    if (stops.length === 1) return 'https://www.google.com/maps/search/?api=1&query=' + q(stops[0]);
    var u = 'https://www.google.com/maps/dir/?api=1&origin=' + q(stops[0]) + '&destination=' + q(stops[stops.length - 1]);
    if (stops.length > 2) u += '&waypoints=' + stops.slice(1, -1).map(q).join('%7C');
    return u;
  }

  function renderRoute() {
    var n = state.route.length;
    el.routeEmpty.hidden = n > 0;
    el.routeList.innerHTML = state.route.map(function (id, i) {
      var s = byId[id];
      return '<li class="route__item">' +
        '<span class="route__n" aria-hidden="true">' + (i + 1) + '</span>' +
        '<button class="route__name" type="button" data-act="select" data-id="' + id + '"><b>' + esc(s.name) + '</b><small>' + esc(s.area) + '</small></button>' +
        '<div class="route__ctl">' +
          '<button class="btn btn--ink" type="button" data-act="route-up" data-id="' + id + '" aria-label="上移：' + esc(s.name) + '"' + (i === 0 ? ' disabled' : '') + '>上移</button>' +
          '<button class="btn btn--ink" type="button" data-act="route-down" data-id="' + id + '" aria-label="下移：' + esc(s.name) + '"' + (i === n - 1 ? ' disabled' : '') + '>下移</button>' +
          '<button class="btn btn--ghost" type="button" data-act="route-remove" data-id="' + id + '" aria-label="從路線移除：' + esc(s.name) + '">移除</button>' +
        '</div></li>';
    }).join('');
    el.routeActions.hidden = n === 0;
    if (n === 0) { el.gmaps.innerHTML = ''; return; }
    var stops = state.route.map(function (id) { return byId[id]; });
    var html = '';
    if (n === 1) {
      html = '<a class="btn" href="' + gmapsURL(stops) + '" target="_blank" rel="noopener noreferrer">在 Google 地圖查看這個地點</a>' +
        '<p class="route__fine">再加入一處，就能排出自選景點順序的路線。</p>';
    } else if (n <= 11) {
      html = '<a class="btn" href="' + gmapsURL(stops) + '" target="_blank" rel="noopener noreferrer">用 Google 地圖開啟路線（共 ' + n + ' 站）</a>';
    } else {
      var from = 0, seg = 1;
      while (from < n - 1) {
        var to = Math.min(from + 10, n - 1);
        html += '<a class="btn" href="' + gmapsURL(stops.slice(from, to + 1)) + '" target="_blank" rel="noopener noreferrer">用 Google 地圖開啟路線：第 ' +
          seg + ' 段（第 ' + (from + 1) + '–' + (to + 1) + ' 站）</a>';
        from = to; seg += 1;
      }
      html += '<p class="route__fine">Google 地圖一次最多帶入 11 個停靠點，所以分成幾段。</p>';
    }
    el.gmaps.innerHTML = html;
  }

  /* =====================================================
     分頁（手機：地圖／清單／路線；桌機：清單／路線）
     ===================================================== */
  function effectiveTab() {
    return isDesktop() && state.tab === 'map' ? 'list' : state.tab;
  }
  function syncTabs() {
    var eff = effectiveTab();
    el.workspace.setAttribute('data-tab', state.tab);
    $$('.tab', el.tabs).forEach(function (t) {
      var on = t.getAttribute('data-tab') === eff;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
    });
    el.mapPane.setAttribute('role', isDesktop() ? 'region' : 'tabpanel');
    if (isDesktop()) { el.mapPane.setAttribute('aria-label', '地圖'); el.mapPane.removeAttribute('aria-labelledby'); }
    else { el.mapPane.removeAttribute('aria-label'); el.mapPane.setAttribute('aria-labelledby', 'tab-map'); }
  }
  function setTab(tab, opts) {
    opts = opts || {};
    state.tab = tab;
    syncTabs();
    if (!isDesktop() && tab !== 'map' && !opts.keepDetail) closeDetail(true);
    if (tab === 'map') scheduleResize();
  }

  /* =====================================================
     總 render
     ===================================================== */
  function keepFocus(fn) {
    var a = document.activeElement, key = null;
    if (a && a.getAttribute && a.getAttribute('data-act')) {
      var zone = a.closest('#spot-list') ? 'list' : a.closest('#route-list') ? 'route' : a.closest('#detail') ? 'detail' : '';
      key = { act: a.getAttribute('data-act'), id: a.getAttribute('data-id'), zone: zone };
    }
    fn();
    if (!key) return;
    var root = key.zone === 'list' ? el.list : key.zone === 'route' ? el.routeList : key.zone === 'detail' ? el.detail : null;
    if (!root) return;
    var t = $('[data-act="' + key.act + '"][data-id="' + key.id + '"]', root);
    if (t && t.disabled) {
      var alt = key.act === 'route-up' ? 'route-down' : key.act === 'route-down' ? 'route-up' : 'select';
      t = $('[data-act="' + alt + '"][data-id="' + key.id + '"]', root) || t;
      if (t.disabled) t = $('[data-act="select"][data-id="' + key.id + '"]', root);
    }
    if (!t && key.zone === 'route') t = $('[data-act="route-down"]:not([disabled]), [data-act="select"]', el.routeList) || el.routePane;
    if (!t && key.zone === 'list') t = el.listPane;
    if (t && t.focus) t.focus({ preventScroll: true });
  }

  function render(opts) {
    opts = opts || {};
    var items = filtered();
    var shown = shownIds();
    if (state.focus && !shown[state.focus]) state.focus = null;
    keepFocus(function () {
      renderControls(items);
      renderList(items);
      renderRoute();
      renderDetail();
    });
    syncMap(opts);
  }

  /* =====================================================
     選取與路線操作
     ===================================================== */
  function selectSpot(id, o) {
    o = o || {};
    state.focus = id;
    if (o.trigger) lastTrigger = rememberTrigger(o.trigger);
    render({ noFit: true });
    if (mapReady && mapVisible()) revealMap();
    ensureRowVisible(id);
    if (o.focusCard) el.detail.focus({ preventScroll: true });
    if (mapReady && mapVisible()) {
      focusMarker(id);
      ensureVisible(byId[id], !reduceMotion());
    }
  }
  function rememberTrigger(t) {
    if (t.classList && t.classList.contains('leaflet-marker-icon')) return { marker: t.getAttribute('aria-label') };
    var id = t.getAttribute('data-id');
    var zone = t.closest('#route-list') ? '#route-list' : '#spot-list';
    return { sel: zone + ' [data-act="select"][data-id="' + id + '"]' };
  }
  function restoreTrigger() {
    var t = null;
    if (lastTrigger && lastTrigger.sel) t = $(lastTrigger.sel);
    else if (lastTrigger && lastTrigger.marker) {
      t = $$('.leaflet-marker-icon').filter(function (m) { return m.getAttribute('aria-label') === lastTrigger.marker; })[0];
    }
    if (t && t.offsetParent !== null) t.focus({ preventScroll: true });
  }
  // 手機：選到地點時，把地圖捲到分頁列下方，才不會被底部的介紹卡和畫面下緣擋住
  function revealMap() {
    if (isDesktop()) return;
    var r = el.mapEl.getBoundingClientRect(), tabsH = el.tabs.offsetHeight;
    if (r.top < tabsH || r.bottom > window.innerHeight) {
      window.scrollTo({ top: window.scrollY + r.top - tabsH - 4, behavior: 'instant' });
    }
  }
  function closeDetail(silent) {
    if (!state.focus) return;
    state.focus = null;
    render({ noFit: true });
    if (!silent) restoreTrigger();
    if (mapReady) closeAllTips();
  }
  function toggleRoute(id) {
    var i = state.route.indexOf(id);
    if (i >= 0) {
      state.route.splice(i, 1);
      announce('已將 ' + byId[id].name + ' 移出路線，目前共 ' + state.route.length + ' 站。');
    } else {
      state.route.push(id);
      announce('已將 ' + byId[id].name + ' 加入路線，是第 ' + state.route.length + ' 站。');
    }
    render({ noFit: true });
  }
  function moveRoute(id, dir) {
    var i = state.route.indexOf(id), j = i + dir;
    if (i < 0 || j < 0 || j >= state.route.length) return;
    var t = state.route[i]; state.route[i] = state.route[j]; state.route[j] = t;
    announce(byId[id].name + ' 移到第 ' + (j + 1) + ' 站。');
    render({ noFit: true });
  }
  function removeRoute(id) {
    var i = state.route.indexOf(id);
    if (i < 0) return;
    state.route.splice(i, 1);
    announce('已將 ' + byId[id].name + ' 從路線移除，目前共 ' + state.route.length + ' 站。');
    render({ noFit: true });
  }
  function ensureRowVisible(id) {
    var pane = el.listPane;
    var row = $('.spot[data-id="' + id + '"]', el.list);
    if (!row || !pane.offsetParent) return;
    if (pane.scrollHeight <= pane.clientHeight + 2) return; // 手機版是整頁捲動，不需要
    var r = row.getBoundingClientRect(), p = pane.getBoundingClientRect();
    if (r.top < p.top) pane.scrollTop -= (p.top - r.top) + 8;
    else if (r.bottom > p.bottom) pane.scrollTop += (r.bottom - p.bottom) + 8;
  }

  /* =====================================================
     地圖（Leaflet + OpenStreetMap）
     ===================================================== */
  var map = null, markerLayer = null, routeLine = null, tiles = null, markers = {};
  var mapReady = false, fitted = false, viewDirty = false, lastFit = null;
  var tileOK = 0, tileBad = 0, tileMsgOn = false, tilesOn = false, resizeQueued = false;

  function mapVisible() { return !!(el.mapEl.clientWidth && el.mapEl.clientHeight); }

  function showMapMsg(title, text, full, withBtn) {
    el.mapMsg.className = 'map-msg' + (full ? ' map-msg--full' : '');
    el.mapMsg.innerHTML = '<strong>' + esc(title) + '</strong>' + esc(text) +
      (withBtn ? '<div style="margin-top:8px"><button class="btn btn--ghost" type="button" data-act="goto-list">看景點清單</button></div>' : '');
    el.mapMsg.hidden = false;
  }
  function hideMapMsg() { el.mapMsg.hidden = true; el.mapMsg.innerHTML = ''; tileMsgOn = false; }

  function loadLeaflet() {
    return new Promise(function (resolve, reject) {
      if (typeof window.L !== 'undefined') { resolve(); return; }
      var done = false, cssOk = false, jsOk = false, timer = null;
      function finish(ok) {
        if (done) return;
        done = true; window.clearTimeout(timer);
        if (ok && typeof window.L !== 'undefined') resolve(); else reject(new Error('leaflet'));
      }
      function check() { if (cssOk && jsOk) finish(true); }
      timer = window.setTimeout(function () { finish(false); }, 15000);
      var link = document.createElement('link');
      link.rel = 'stylesheet'; link.href = LEAFLET_CSS; link.integrity = LEAFLET_CSS_SRI; link.crossOrigin = 'anonymous';
      link.onload = function () { cssOk = true; check(); };
      link.onerror = function () { finish(false); };
      var sc = document.createElement('script');
      sc.src = LEAFLET_JS; sc.integrity = LEAFLET_JS_SRI; sc.crossOrigin = 'anonymous'; sc.async = true;
      sc.onload = function () { jsOk = true; check(); };
      sc.onerror = function () { finish(false); };
      document.head.appendChild(link);
      document.head.appendChild(sc);
    });
  }

  function tipHTML(s) {
    var st = stageOf(s);
    return '<b>' + esc(s.name) + '</b>' + (st ? '<i>示範階段：' + esc(st.name) + '</i><i>' + DEMO + '</i>' : '');
  }
  function markerLabel(s) {
    var st = stageOf(s), r = state.route.indexOf(s.id);
    return s.name + '，' + s.area + (st ? '，示範階段：' + st.name + '（' + DEMO + '）' : '') +
      (r >= 0 ? '，路線第 ' + (r + 1) + ' 站' : '') + '，按 Enter 看介紹';
  }

  function initMap() {
    var animOK = !reduceMotion();
    map = L.map(el.mapEl, {
      zoomControl: false, trackResize: false, zoomSnap: 0.5, minZoom: 8, maxZoom: 18,
      zoomAnimation: animOK, fadeAnimation: animOK, markerZoomAnimation: animOK
    });
    L.control.zoom({ position: 'topright', zoomInTitle: '放大', zoomOutTitle: '縮小' }).addTo(map);
    map.setView([35.69, 139.69], 10);

    // 底圖等第一次定位好再加入，避免先載入一批用不到的預設圖磚。
    tiles = L.tileLayer(TILE_URL, {
      maxZoom: 19,
      attribution: '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a>'
    });
    tiles.on('tileload', function () { tileOK += 1; if (tileMsgOn) hideMapMsg(); });
    tiles.on('tileerror', function () {
      tileBad += 1;
      if (tileOK === 0 && tileBad >= 3 && !tileMsgOn) {
        tileMsgOn = true;
        showMapMsg('底圖暫時無法載入', '可能是網路中斷或地圖服務暫時無法連線。標記位置仍然有效，也可以直接使用地點清單。', false, !isDesktop());
      }
    });

    markerLayer = L.layerGroup().addTo(map);
    routeLine = L.polyline([], {
      color: '#b3261e', weight: 4, opacity: 0.9, dashArray: '1 9', lineCap: 'round', interactive: false
    }).addTo(map);

    SPOTS.forEach(function (s) {
      var icon = L.divIcon({
        className: 'mk', iconSize: [44, 44], iconAnchor: [22, 22],
        html: leafSVG() + '<svg class="mk__drop leaf" viewBox="0 0 32 32" aria-hidden="true" focusable="false"><path class="leaf-body" d="M16 25.4C11 22.6 5 17.6 1.8 11.4C1.2 10 2 8.6 3.6 8.2C5.6 7.7 7.4 7 9.4 7C12.4 7 14.6 9.2 16 13.2C17.4 9.2 19.6 7 22.6 7C24.6 7 26.4 7.7 28.4 8.2C30 8.6 30.8 10 30.2 11.4C27 17.6 21 22.6 16 25.4Z"/></svg><span class="mk__num"></span>'
      });
      var m = L.marker([s.lat, s.lng], { icon: icon, keyboard: true, riseOnHover: true });
      m.bindTooltip(tipHTML(s), { direction: 'top', offset: [0, -14], opacity: 1, className: 'tip' });
      m.on('click', function () {
        selectSpot(s.id, { trigger: m.getElement(), focusCard: false });
      });
      // Leaflet 1.9 不會把 Enter／空白鍵轉成 click，鍵盤操作要自己處理
      m.on('keypress', function (ev) {
        var oe = ev.originalEvent;
        if (oe && (oe.key === 'Enter' || oe.key === ' ')) {
          oe.preventDefault();
          selectSpot(s.id, { trigger: m.getElement(), focusCard: true });
        }
      });
      markers[s.id] = m;
    });

    map.on('click', function () { if (state.focus) closeDetail(true); });

    mapReady = true;
    syncMap({ noFit: true });
    if (typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(function () { scheduleResize(); }).observe(el.mapEl);
    }
    window.addEventListener('resize', scheduleResize);
    window.addEventListener('orientationchange', scheduleResize);
    scheduleResize();
  }

  // 底圖圖磚在頁面 load 事件之後才開始載入，網路慢時不會拖住整個頁面的載入完成。
  function startTiles() {
    if (tilesOn) return;
    if (document.readyState !== 'complete') {
      window.addEventListener('load', startTiles, { once: true });
      return;
    }
    tilesOn = true;
    tiles.addTo(map);
    window.setTimeout(function () {
      if (tileOK === 0 && !tileMsgOn && mapVisible()) {
        tileMsgOn = true;
        showMapMsg('底圖暫時無法載入', '地圖底圖等了很久還沒有出現。標記位置仍然有效，也可以直接使用地點清單。', false, !isDesktop());
      }
    }, 12000);
  }

  function updateMarker(s) {
    var m = markers[s.id], e = m && m.getElement();
    if (!e) return;
    var st = stageOf(s), r = state.route.indexOf(s.id);
    e.setAttribute('data-stage', st ? String(s.stageIdx) : 'n');
    e.classList.toggle('is-demo', !!st);
    e.classList.toggle('is-sel', state.focus === s.id);
    var num = e.querySelector('.mk__num');
    if (r >= 0) { e.setAttribute('data-n', String(r + 1)); if (num) num.textContent = String(r + 1); }
    else { e.removeAttribute('data-n'); if (num) num.textContent = ''; }
    e.setAttribute('aria-label', markerLabel(s));
    m.setZIndexOffset(state.focus === s.id ? 1000 : r >= 0 ? 500 : 0);
    m.setTooltipContent(tipHTML(s));
  }

  function syncMap(opts) {
    if (!mapReady) return;
    opts = opts || {};
    var shown = shownIds();
    SPOTS.forEach(function (s) {
      var m = markers[s.id], has = markerLayer.hasLayer(m);
      if (shown[s.id] && !has) markerLayer.addLayer(m);
      else if (!shown[s.id] && has) markerLayer.removeLayer(m);
      if (shown[s.id]) updateMarker(s);
    });
    var pts = state.route.map(function (id) { return [byId[id].lat, byId[id].lng]; });
    routeLine.setLatLngs(pts.length >= 2 ? pts : []);
    if (!opts.noFit) {
      if (mapVisible() && fitted) { fitShown(!reduceMotion()); viewDirty = false; }
      else viewDirty = true;
    }
  }

  function shownLatLngs() {
    var shown = shownIds();
    return SPOTS.filter(function (s) { return shown[s.id]; }).map(function (s) { return [s.lat, s.lng]; });
  }
  function fitLatLngs(pts, animate) {
    if (!pts.length) return;
    map.fitBounds(L.latLngBounds(pts), {
      paddingTopLeft: [44, 44], paddingBottomRight: [70, 44], maxZoom: 13, animate: !!animate
    });
  }
  function fitShown(animate) { fitLatLngs(shownLatLngs(), animate); }

  // 介紹卡遮住的地圖範圍
  function coverPadding() {
    var pad = { tl: [44, 44], br: [70, 44] };
    if (el.detail.hidden) return pad;
    var d = el.detail.getBoundingClientRect(), m = el.mapEl.getBoundingClientRect();
    if (isDesktop()) {
      pad.tl[0] = Math.max(44, d.right - m.left + 96);
    } else {
      var over = m.bottom - Math.max(d.top, m.top);
      if (over > 0) pad.br[1] = Math.min(over + 24, m.height - 120);
    }
    return pad;
  }
  function ensureVisible(s, animate) {
    if (!mapReady || !s || !mapVisible()) return;
    var pad = coverPadding();
    map.panInside([s.lat, s.lng], { paddingTopLeft: pad.tl, paddingBottomRight: pad.br, animate: !!animate });
  }
  function closeAllTips() { SPOTS.forEach(function (s) { var m = markers[s.id]; if (m) m.closeTooltip(); }); }
  function focusMarker(id) {
    closeAllTips();
    var m = markers[id];
    if (m && markerLayer.hasLayer(m)) m.openTooltip();
  }

  function scheduleResize() {
    if (resizeQueued) return;
    resizeQueued = true;
    window.requestAnimationFrame(function () { resizeQueued = false; handleResize(); });
  }
  // 容器 0×0（被分頁藏起來）時不處理，也不讓 Leaflet 記下 0×0。
  // 顯示後，若尺寸和上次定位時相差超過 25% 或方向翻轉，就重新定位；小變動（網址列）保持中心。
  function handleResize() {
    if (!mapReady) return;
    var w = el.mapEl.clientWidth, h = el.mapEl.clientHeight;
    if (!w || !h) return;
    map.invalidateSize({ animate: false });
    if (!fitted) {
      fitShown(false); fitted = true; viewDirty = false; lastFit = { w: w, h: h };
      startTiles();
      if (state.focus) { focusMarker(state.focus); ensureVisible(byId[state.focus], false); }
      return;
    }
    if (viewDirty) { fitShown(false); viewDirty = false; lastFit = { w: w, h: h }; return; }
    var dw = Math.abs(w - lastFit.w) / lastFit.w, dh = Math.abs(h - lastFit.h) / lastFit.h;
    var flip = (w >= h) !== (lastFit.w >= lastFit.h);
    if (dw > 0.25 || dh > 0.25 || flip) {
      var f = state.focus && byId[state.focus];
      if (f && shownIds()[f.id]) ensureVisible(f, false);
      else if (state.route.length >= 2) fitLatLngs(state.route.map(function (id) { return [byId[id].lat, byId[id].lng]; }), false);
      else fitShown(false);
      lastFit = { w: w, h: h };
    }
  }

  /* =====================================================
     事件
     ===================================================== */
  document.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target.closest('[data-act]') : null;
    if (!t) return;
    var act = t.getAttribute('data-act'), id = t.getAttribute('data-id');
    var kb = e.detail === 0;
    switch (act) {
      case 'select': selectSpot(id, { trigger: t, focusCard: kb }); break;
      case 'toggle-route': toggleRoute(id); break;
      case 'route-up': moveRoute(id, -1); break;
      case 'route-down': moveRoute(id, 1); break;
      case 'route-remove': removeRoute(id); break;
      case 'close-detail': closeDetail(false); break;
      case 'show-map':
        setTab('map', { keepDetail: true });
        if (mapReady) {
          window.requestAnimationFrame(function () {
            handleResize();
            revealMap();
            focusMarker(id);
            map.setView([byId[id].lat, byId[id].lng], Math.max(map.getZoom(), 13), { animate: false });
            ensureVisible(byId[id], false);
          });
        }
        break;
      case 'goto-list': setTab('list'); break;
    }
  });

  el.stageRow.addEventListener('click', function (e) {
    var b = e.target.closest('.stage');
    if (!b) return;
    var i = Number(b.getAttribute('data-stage'));
    state.stage = state.stage === i ? null : i;
    render();
    announce(state.stage === null ? '已清除示範階段，顯示全部 12 處。' : '示範階段：' + STAGES[state.stage].name + '。' + DEMO + '。');
  });
  el.stageClear.addEventListener('click', function () {
    state.stage = null; render();
    announce('已清除示範階段，顯示全部 12 處。');
    $('.stage', el.stageRow).focus();
  });
  el.area.addEventListener('change', function () { state.area = el.area.value; render(); });
  function clearFilters() { state.stage = null; state.area = 'all'; render(); announce('已清除篩選，顯示全部 12 處。'); }
  el.filterClear.addEventListener('click', clearFilters);
  $('#empty-clear').addEventListener('click', clearFilters);
  $('#route-clear').addEventListener('click', function () {
    state.route = []; render({ noFit: true }); announce('已清空路線。');
  });

  el.controlsToggle.addEventListener('click', function () {
    var open = el.controlsToggle.getAttribute('aria-expanded') === 'true';
    el.controlsToggle.setAttribute('aria-expanded', String(!open));
  });

  el.tabs.addEventListener('click', function (e) {
    var t = e.target.closest('.tab');
    if (t) setTab(t.getAttribute('data-tab'));
  });
  el.tabs.addEventListener('keydown', function (e) {
    var keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
    if (keys.indexOf(e.key) < 0) return;
    var tabs = $$('.tab', el.tabs).filter(function (t) { return t.offsetParent; });
    var i = tabs.indexOf(document.activeElement);
    if (i < 0) return;
    e.preventDefault();
    if (e.key === 'ArrowLeft') i = (i + tabs.length - 1) % tabs.length;
    else if (e.key === 'ArrowRight') i = (i + 1) % tabs.length;
    else if (e.key === 'Home') i = 0;
    else i = tabs.length - 1;
    tabs[i].focus();
    setTab(tabs[i].getAttribute('data-tab'));
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && state.focus && !el.detail.hidden) { e.preventDefault(); closeDetail(false); }
  });

  function onBreakpoint() {
    syncTabs();
    el.controlsToggle.setAttribute('aria-expanded', String(isDesktop()));
    scheduleResize();
  }
  if (deskMQ.addEventListener) deskMQ.addEventListener('change', onBreakpoint);
  else if (deskMQ.addListener) deskMQ.addListener(onBreakpoint);

  /* =====================================================
     啟動
     ===================================================== */
  buildControls();
  syncTabs();
  el.controlsToggle.setAttribute('aria-expanded', String(isDesktop()));
  render({ noFit: true });

  loadLeaflet().then(initMap, function () {
    showMapMsg('地圖暫時無法載入', '可能是網路中斷或地圖服務暫時無法連線。地點清單、介紹、篩選與自選路線都還能使用。', true, true);
    if (!isDesktop()) setTab('list');
  });
})();
