/* 東京銀杏黃葉地圖 — 原生 JavaScript（不需後端；資料於 2026-10-02 依官方頁面核對） */
(function () {
  'use strict';

  /* =========================================================
   * 1. 小工具
   * ======================================================= */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  var store = {
    get: function (key, fallback) {
      try { var v = window.localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
      catch (e) { return fallback; }
    },
    set: function (key, value) {
      try { window.localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* 無痕或封鎖時略過 */ }
    }
  };
  var DAY = 86400000;
  function dayDiff(a, b) { return Math.round((a - b) / DAY); }
  function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
  var WEEK = '日一二三四五六';
  function fmtLong(d) { return (d.getMonth() + 1) + '月' + d.getDate() + '日（' + WEEK[d.getDay()] + '）'; }
  function fmtShort(d) { return (d.getMonth() + 1) + '/' + d.getDate(); }
  function haversine(a, b) {
    var R = 6371000, toR = Math.PI / 180;
    var dLat = (b.lat - a.lat) * toR, dLng = (b.lng - a.lng) * toR;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  function fmtDist(m) { return m < 1000 ? Math.round(m / 10) * 10 + ' m' : (m / 1000).toFixed(m < 10000 ? 1 : 0) + ' km'; }
  var WALK_M_PER_MIN = 80;
  function fmtWalk(m) {
    var min = Math.max(1, Math.round(m / WALK_M_PER_MIN));
    if (min < 60) return '約 ' + min + ' 分鐘';
    var h = Math.floor(min / 60), r = min % 60;
    return '約 ' + h + ' 小時' + (r ? ' ' + r + ' 分' : '');
  }

  var ICON = {
    bookmark: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3.5h12v17l-6-4.2-6 4.2z"/></svg>',
    route: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="18" r="2.2"/><circle cx="18" cy="6" r="2.2"/><path d="M8.2 18H15a3.5 3.5 0 0 0 0-7H9a3.5 3.5 0 0 1 0-7h6.8"/></svg>',
    pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/></svg>',
    ext: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
    chev: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>',
    up: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M5.5 11.5L12 5l6.5 6.5"/></svg>',
    down: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5.5 12.5L12 19l6.5-6.5"/></svg>',
    x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    walk: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="13" cy="4.5" r="1.8"/><path d="M10 21l2-6-2.5-2.5L11 8l3 2.5 3 1M11 8l-3 1.5-1.5 3.5M12 15l3 6"/></svg>',
    leaf: '<svg viewBox="0 0 64 68" aria-hidden="true"><use href="#gk"/></svg>'
  };

  /* =========================================================
   * 2. 季節模型（依氣象廳東京 いちょう黄葉日 平年值 11/23）
   * ======================================================= */
  /* 「今天」一律以東京日期為準（不受瀏覽器所在時區影響） */
  function tokyoToday() {
    try {
      var parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
      var v = {};
      parts.forEach(function (x) { v[x.type] = parseInt(x.value, 10); });
      if (v.year && v.month && v.day) return new Date(v.year, v.month - 1, v.day);
    } catch (e) { /* 不支援時區時改用本機日期 */ }
    var n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate());
  }
  var TODAY = tokyoToday();
  var YEAR = TODAY.getFullYear();
  var D_NORMAL = new Date(YEAR, 10, 23);          // 11/23 黃葉平年日 = 見頃第一天
  var RANGE_START = new Date(YEAR, 9, 15);        // 10/15
  var RANGE_END = new Date(YEAR, 11, 31);         // 12/31
  var RANGE_DAYS = dayDiff(RANGE_END, RANGE_START);

  var STAGES = [
    { key: 'aoba',  name: '青葉',     from: -Infinity, to: -29,      color: '#4F7A3A', group: 'green',   offset: '平年黃葉日前 29 天以前' },
    { key: 'turn',  name: '轉色',     from: -28,       to: -15,      color: '#8E9F33', group: 'turning', offset: '前 28～15 天' },
    { key: 'prog',  name: '黃葉進行', from: -14,       to: -1,       color: '#C99A16', group: 'turning', offset: '前 14～1 天' },
    { key: 'peak',  name: '見頃',     from: 0,         to: 5,        color: '#E8AE12', group: 'gold',    offset: '當天～後 5 天（11/23 為氣象廳平年值）' },
    { key: 'early', name: '落葉初期', from: 6,         to: 9,        color: '#C2761C', group: 'fall',    offset: '後 6～9 天' },
    { key: 'fall',  name: '落葉',     from: 10,        to: Infinity, color: '#8A6440', group: 'fall',    offset: '後 10 天起（12/3 為氣象廳落葉平年值）' }
  ];
  var GROUPS = [
    { key: 'all', name: '全部' },
    { key: 'green', name: '青綠' },
    { key: 'turning', name: '轉黃' },
    { key: 'gold', name: '金黃' },
    { key: 'fall', name: '落葉' }
  ];
  function stageStart(s) { return isFinite(s.from) ? addDays(D_NORMAL, s.from) : RANGE_START; }
  function stageEnd(s) { return isFinite(s.to) ? addDays(D_NORMAL, s.to) : RANGE_END; }
  function stageFor(date) {
    var d = dayDiff(date, D_NORMAL);
    for (var i = 0; i < STAGES.length; i++) if (d >= STAGES[i].from && d <= STAGES[i].to) return STAGES[i];
    return STAGES[STAGES.length - 1];
  }
  function groupRange(gkey) {
    var list = STAGES.filter(function (s) { return s.group === gkey; });
    return { start: stageStart(list[0]), end: stageEnd(list[list.length - 1]), names: list.map(function (s) { return s.name; }) };
  }

  /* =========================================================
   * 3. 資料：試算表欄位（原文摘錄）＋座標＋官方銀杏說明
   * ======================================================= */
  var TP = {
    operator: '公益財團法人東京都公園協會',
    evidenceUrl: 'https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf',
    evidenceDate: '2025-11-04',
    finding: '2025年度官方紅葉情報名單明列本園區之銀杏；本次不宣稱已取得2026銀杏現況。',
    cadence: '中央整合頁2025季內每週兩次；園區個別公告頻率未承諾。'
  };
  function tp(name, area, url, caveat) {
    return { name: name, area: area, grade: 'S', operator: TP.operator, url: url, evidenceUrl: TP.evidenceUrl,
      evidenceDate: TP.evidenceDate, finding: TP.finding, cadence: TP.cadence, caveat: caveat };
  }
  var SHEET = {
    'TKG-002': tp('上野恩賜公園', '台東區', 'https://www.tokyo-park.or.jp/park/ueno/', '可列為銀杏專項季節觀測候選。'),
    'TKG-003': tp('木場公園', '江東區', 'https://www.tokyo-park.or.jp/park/kiba/', '保留園區原文所指子地點。'),
    'TKG-004': tp('小金井公園', '小金井市等', 'https://www.tokyo-park.or.jp/park/koganei/', '園區跨行政區；不以服務中心地址代表全部觀測點。'),
    'TKG-005': tp('芝公園', '港區', 'https://www.tokyo-park.or.jp/park/siba/', '銀杏與もみじ谷分開。正確網址使用siba，不是shiba。'),
    'TKG-006': tp('城北中央公園', '板橋區、練馬區', 'https://www.tokyo-park.or.jp/park/johoku-chuo/', '必須按物種取值，不把櫸樹葉況套用銀杏。'),
    'TKG-007': tp('善福寺川緑地', '杉並區', 'https://www.tokyo-park.or.jp/park/zempukujigawa-ryokuchi/index.html', '2025表與和田堀公園合併一列，不能假設各有獨立觀測。'),
    'TKG-008': tp('和田堀公園', '杉並區', 'https://www.tokyo-park.or.jp/park/wadabori/', '2025表與善福寺川緑地合併一列，保留共同來源關係。'),
    'TKG-009': tp('戸山公園', '新宿區', 'https://www.tokyo-park.or.jp/park/toyama/', '須擷取銀杏段落／欄位，不直接使用全園紅葉狀態。'),
    'TKG-010': tp('光が丘公園', '練馬區、板橋區', 'https://www.tokyo-park.or.jp/park/hikarigaoka/', '銀杏並木與ふれあいの径宜設為不同子地點。'),
    'TKG-011': tp('日比谷公園', '千代田區', 'https://www.tokyo-park.or.jp/park/hibiya/', '葉況與施工、通行公告分開管理。'),
    'TKG-012': tp('代々木公園', '澀谷區', 'https://www.tokyo-park.or.jp/park/yoyogi/', '黃葉公告須限定原文明示區域，不擴張為全園。'),
    'TKG-013': tp('旧岩崎邸庭園', '台東區（入口）', 'https://www.tokyo-park.or.jp/park/kyu-iwasaki-tei/', '活動或集章日期不是見頃日；注意官網改版後網址。'),
    'TKG-014': { name: '國營昭和記念公園｜花だより', area: '立川市、昭島市', grade: 'A', operator: '國營昭和記念公園官方網站',
      url: 'https://www.showakinen-koen.jp/hanadayori/', evidenceUrl: 'https://www.showakinen-koen.jp/hanadayori/page/3/',
      evidenceDate: '2025-10-23至2025-12-04', finding: '歷史列表有連續多期イチョウ情報；植物指南明列イチョウ（黄葉）。',
      cadence: '歷史季內約每週一篇；並非官網保證的更新頻率。',
      caveat: 'カナール、かたらいのイチョウ並木分開；page/3分頁位置會隨新增文章變動，不可當永久存檔ID。' },
    'TKG-015': { name: '新宿御苑｜國民公園協會自然情報', area: '新宿區、澀谷區', grade: 'A', operator: '一般財團法人國民公園協會 新宿御苑',
      url: 'https://fng.or.jp/shinjuku/news/', evidenceUrl: 'https://fng.or.jp/shinjuku/2025/11/28/20251128_03/',
      evidenceDate: '2025-11-28', finding: '日期文章明確敘述銀杏黃葉見頃，包含溫室附近照片及園內植物地圖。',
      cadence: '已見每週みどころ及其他不定期文章；不是保證頻率。',
      caveat: '舊文只當歷史樣本。環境省管理資訊與協會自然情報各有用途；不可混入同期其他樹種狀態。' },
    'TKG-016': { name: '八王子いちょう祭り｜黄葉情報', area: '八王子市・甲州街道', grade: 'A', operator: '八王子いちょう祭り祭典委員會',
      url: 'https://www.ichou-festa.org/ichounews/', evidenceUrl: 'https://www.ichou-festa.org/notice/post-3629/',
      evidenceDate: '2026-09-24（更新公告）', finding: '黄葉情報頁可見2026-09-22拍攝日期，分中央圖書館、多摩御陵入口及觀看方向。',
      cadence: '官方明示不定期更新。',
      caveat: '已確認2026季內內容，但不能只看照片日期就自動判定見頃。祭典日期與葉況分離。' },
    'TKG-017': { name: '宮內廳｜皇居東御苑 花だより', area: '千代田區・皇居東御苑', grade: 'A', operator: '宮內廳',
      url: 'https://www.kunaicho.go.jp/visit/higashigyoen/hanadayori/index.html', evidenceUrl: 'https://www.kunaicho.go.jp/visit/higashigyoen/hanadayori/20251128.html',
      evidenceDate: '2025-11-28', finding: '日期文記錄銀杏等樹木變色，照片標示百人番所前のイチョウ。',
      cadence: '列表可見近每週更新；未將其視為保證頻率。',
      caveat: '東御苑不是皇居外苑或北之丸公園。全園葉落描述不可自動套用銀杏。' },
    'TKG-018': { name: '小石川植物園｜見ごろの植物', area: '文京區', grade: 'A', operator: '東京大學大學院理學系研究科附屬植物園',
      url: 'https://koishikawa-bg.jp/kaikainfo/', evidenceUrl: 'https://koishikawa-bg.jp/kaika/5013/',
      evidenceDate: '2025-11-19', finding: '當日文章將イチョウ明列於正在紅葉／黃葉的植物清單。',
      cadence: '不定期，已有多篇日期文章。',
      caveat: '見到黃葉不等於已到見頃。小石川植物園與小石川後樂園是不同地點。' },
    'TKG-019': { name: 'あきる野市觀光協會｜のらぼう日記', area: '秋留野市・廣德寺周邊', grade: 'A', operator: 'あきる野市觀光協會',
      url: 'https://www.akirunokanko.com/?cat=53', evidenceUrl: 'https://www.akirunokanko.com/?p=8712',
      evidenceDate: '2025-11-08（發文）；2025-11-06（拍照）', finding: '廣德寺段落明寫銀杏變色進展、尚差一些到見頃；原文另給照片拍攝日期。',
      cadence: '原文說隨時更新；2025季內有多期，非固定每週承諾。',
      caveat: '石舟橋段落是楓樹，不能套用到廣德寺銀杏。發文日與拍摄日分開。' },
    'TKG-023': { name: '明治神宮外苑｜いちょう並木', area: '明治神宮外苑・銀杏並木', grade: 'C', operator: '明治神宮外苑',
      url: 'https://www.meijijingugaien.jp/walk/sight/season.html', evidenceUrl: 'https://www.meijijingugaien.jp/walk/sight/season.html',
      evidenceDate: '未見可當現況的日期', finding: '官網明確介紹銀杏並木與四季景觀；本次未確認穩定的逐日銀杏葉況專頁。',
      cadence: '未確認。', caveat: '不是明治神宮內苑。頁內老樹齡／株數含歷史基準，勿當2026現況。' },
    'TKG-024': { name: '大田黑公園｜荻窪三庭園', area: '杉並區', grade: 'B', operator: '杉並區官方指向之公園網站（荻窪三庭園）',
      url: 'https://ogikubo3gardens.jp/ootaguro/', evidenceUrl: 'https://www.city.suginami.tokyo.jp/s100/shisetsu/14632.html',
      evidenceDate: '區公所頁更新2025-09-09', finding: '杉並區官網證明銀杏並木及現行官方網址；本次自動讀取公園頁未取得正文。',
      cadence: '尚未確認黃葉更新頻率。', caveat: '不得沿用已於2024年3月結束管理的箱根植木舊頁作現任營運來源。' },
    'TKG-025': { name: '大國魂神社｜大銀杏／公告', area: '府中市', grade: 'C', operator: '大國魂神社',
      url: 'https://www.ookunitamajinja.or.jp/mame/', evidenceUrl: 'https://www.ookunitamajinja.or.jp/mame/',
      evidenceDate: '靜態資料', finding: '神社官網確認本殿後方的大銀杏；未確認定期黃葉觀測文章。',
      cadence: '未確認。', caveat: '不要把附近馬場大門的櫸樹並木視為銀杏。' },
    'TKG-026': { name: '靖國神社｜官方公告、境內照片', area: '千代田區', grade: 'C', operator: '靖國神社',
      url: 'https://www.yasukuni.or.jp/', evidenceUrl: 'https://www.yasukuni.or.jp/schedule/photo.html',
      evidenceDate: '本次可讀2026公告', finding: '官網和照片入口存在；本次未核得可直接當銀杏現況的日期觀測文章。',
      cadence: '未確認。', caveat: '宣傳影片上線日不等於拍攝日。不可將未核視角的LIVE影片宣稱銀杏即時鏡頭。' },
    'TKG-030': { name: '皇居外苑・北之丸公園｜國民公園協會', area: '千代田區', grade: 'B', operator: '一般財團法人國民公園協會 皇居外苑',
      url: 'https://fng.or.jp/koukyo/news/', evidenceUrl: 'https://fng.or.jp/koukyo/',
      evidenceDate: '本次可見2026-09-19季節文章入口', finding: '有持續更新的自然／四季消息；本次未核得銀杏專项葉況。',
      cadence: '不定期；銀杏頻率待查。', caveat: '與宮內廳東御苑不同來源、不同地理範圍。' },
    'TKG-040': { name: '東京大學｜本鄉・駒場校區官方入口', area: '文京區、目黑區', grade: 'C', operator: '東京大學',
      url: 'https://www.u-tokyo.ac.jp/ja/about/campus-guide/index.html', evidenceUrl: 'https://www.u-tokyo.ac.jp/ja/about/campus-guide/index.html',
      evidenceDate: '2026-04-01（地圖頁）', finding: '確認本鄉及駒場的官方地圖／參觀入口；尚未確認穩定的銀杏日期觀測來源。',
      cadence: '銀杏更新頻率未確認。', caveat: '本鄉、駒場、小石川植物園是不同地點。此頁未證實各校區的當季銀杏觀測。' },
    'TKG-041': { name: 'くにたちNAVI｜國立市觀光まちづくり協會', area: '國立市・大學通り候選', grade: 'C', operator: 'NPO法人國立市觀光まちづくり協會',
      url: 'https://kunimachi.jp/', evidenceUrl: 'https://kunimachi.jp/',
      evidenceDate: '本次可見2026-09-25更新', finding: '頁尾確認營運者為國立市觀光まちづくり協會；本次未確認定期銀杏葉況文章。',
      cadence: '銀杏更新頻率未確認。', caveat: '區域旅遊更新不等於大學通り銀杏現況；可與Jorudan地點目錄交叉尋源。' }
  };

  var REGIONS = [
    { key: 'center', name: '都心（千代田・港）' },
    { key: 'west', name: '新宿・澀谷・目黑' },
    { key: 'east', name: '上野・本鄉・江東' },
    { key: 'north', name: '杉並・練馬・板橋' },
    { key: 'tama', name: '多摩地區' }
  ];
  var GRADES = [
    { key: 'S', name: 'S｜官方公園協會', desc: '東京都公園協會等官方園區管理單位的公告與名單。' },
    { key: 'A', name: 'A｜官方附日期觀測', desc: '官方網站有附日期的現地植物或黃葉紀錄。' },
    { key: 'B', name: 'B｜官方，銀杏資料待補', desc: '官方來源，但銀杏專項的資料仍待確認。' },
    { key: 'C', name: 'C｜官方網站或入口', desc: '官方網站或景點介紹，沒有附日期的觀測。' }
  ];
  var GRADE_EXTRA = [
    { key: 'O', desc: '氣象廳觀測站尺度（標本木），不代表各公園。' },
    { key: 'T', desc: '第三方整合平台，非景點管理單位。' },
    { key: 'X', desc: '已排除或失效的來源。' }
  ];

  /* 座標說明一律標「座標為近似值」 */
  var PLACES = [
    { id: 'shiba', src: 'TKG-005', region: 'center', title: '芝公園', ja: '芝公園', lat: 35.6555, lng: 139.748,
      coord: '座標為近似值（園區代表點；銀杏位置未核實）',
      ginkgo: '官方：園內有「クスノキ、ケヤキ、イチョウなどの大木」，未載明位置。もみじ谷是楓樹區，不是銀杏。' },
    { id: 'hibiya', src: 'TKG-011', region: 'center', title: '日比谷公園・首賭けイチョウ', ja: '日比谷公園 首賭けイチョウ', lat: 35.6737, lng: 139.7559,
      coord: '座標為近似值（首賭けイチョウ一帶，約 ±50–100 m）',
      ginkgo: '官方：園內特別高大的「首賭けイチョウ」，推定樹齡 400～500 年。' },
    { id: 'higashigyoen', src: 'TKG-017', region: 'center', title: '皇居東御苑・百人番所前', ja: '皇居東御苑 百人番所前のイチョウ', lat: 35.6857, lng: 139.7581,
      coord: '座標為近似值（百人番所建物；銀杏在其前方）',
      ginkgo: '宮內廳花だより的照片標示「百人番所前のイチョウ」。',
      history: '2025-11-28 花だより：銀杏等樹木變色（去年紀錄，不是今年現況）。' },
    { id: 'yasukuni', src: 'TKG-026', region: 'center', title: '靖國神社', ja: '靖國神社', lat: 35.6941, lng: 139.7431,
      coord: '座標為近似值（境內拝殿一帶；銀杏並木確切範圍未核實）',
      ginkgo: '官方網域的公告提到「参道のイチョウ並木」。',
      proof: { quote: '参道のイチョウ並木', url: 'https://www.yasukuni.or.jp/news_detail.html?id=492', date: '2023-09-06 公告' } },
    { id: 'kitanomaru', src: 'TKG-030', region: 'center', title: '北之丸公園', ja: '北の丸公園', lat: 35.6915, lng: 139.7511,
      coord: '座標為近似值（園區代表點）',
      ginkgo: '官方文章：日本武道館前有「大イチョウ」，園內各處也種有銀杏。只列北之丸公園；皇居外苑本身未證實有銀杏。',
      proof: { quote: '日本武道館の前には大イチョウと呼ばれる特別大きなイチョウの木', url: 'https://fng.or.jp/koukyo/2023/11/24/kitanomarukouennnokouyou/', date: '2023-11-24 文章' },
      history: '2023-11-24 官方文章寫大イチョウ「見ごろは12月上旬」（2023 年紀錄）；2024-11-13 國民公園協會：園內銀杏才剛開始轉色（去年以前紀錄，不是今年現況）。',
      historyLinks: [['開啟 2024-11-13 文章', 'https://fng.or.jp/koukyo/2024/11/13/irodukukitanomarukouen/']] },

    { id: 'shinjuku', src: 'TKG-015', region: 'west', title: '新宿御苑', ja: '新宿御苑（大温室付近）', lat: 35.6867, lng: 139.7126,
      coord: '座標為近似值（大溫室；銀杏在溫室附近）',
      ginkgo: '官方 2025-11-28 文章：園內各處銀杏，溫室附近枝條較低，是熱門拍攝點。',
      history: '2025-11-28 官方文章明寫銀杏「みごろ」（去年紀錄，不是今年現況）。' },
    { id: 'gaien', src: 'TKG-023', region: 'west', title: '明治神宮外苑・銀杏並木', ja: '明治神宮外苑 いちょう並木', lat: 35.6739, lng: 139.7199,
      coord: '座標為近似值（並木中點）',
      ginkgo: '官方：青山口至円周道路約 300 m、146 棵（頁面上的歷史數值），盡頭可望聖德記念繪畫館。',
      history: '2022-11-17 外苑便り「イチョウ並木が見頃です」（2022 年紀錄）。' },
    { id: 'toyama', src: 'TKG-009', region: 'west', title: '戶山公園', ja: '戸山公園', lat: 35.7037, lng: 139.7135,
      coord: '座標為近似值（箱根山地區代表點；銀杏位置未載明）',
      ginkgo: '官方「主な植物」與秋季見頃列有イチョウ，未載明位置；園區分箱根山與大久保兩區。' },
    { id: 'yoyogi', src: 'TKG-012', region: 'west', title: '代代木公園', ja: '代々木公園', lat: 35.6717, lng: 139.6965,
      coord: '座標為近似值（園區代表點；銀杏位置未載明）',
      ginkgo: '官方秋季見頃列有イチョウ，未載明位置。' },
    { id: 'komaba', src: 'TKG-040', region: 'west', title: '東京大學 駒場校區・銀杏並木', ja: '東京大学 駒場キャンパス 銀杏並木', lat: 35.6604, lng: 139.6852,
      coord: '座標為近似值（1 號館北側東西向道路，約 ±80 m）',
      ginkgo: '東大官方網站：秋天銀杏並木把主要道路染成黃色。本鄉、駒場與小石川植物園是不同地點。',
      proof: { quote: '秋には銀杏並木がメインストリートを黄色に染め上げる', url: 'https://kimino.ct.u-tokyo.ac.jp/kotohajime/komaba-campus/', date: '東京大學官方網站' } },

    { id: 'ueno', src: 'TKG-002', region: 'east', title: '上野恩賜公園', ja: '上野恩賜公園', lat: 35.713, lng: 139.7724,
      coord: '座標為近似值（園區代表點；銀杏位置未載明）',
      ginkgo: '官方頁面未載明園內銀杏位置；試算表依 2025 年度官方紅葉情報名單列為銀杏。' },
    { id: 'iwasaki', src: 'TKG-013', region: 'east', title: '舊岩崎邸庭園', ja: '旧岩崎邸庭園', lat: 35.7092, lng: 139.7683,
      coord: '座標為近似值（庭園正門）',
      ginkgo: '官方「主な植物」與秋季見頃列有イチョウ，未載明位置。集章等活動日期不是見頃日。' },
    { id: 'koishikawa', src: 'TKG-018', region: 'east', title: '小石川植物園・精子発見のイチョウ', ja: '小石川植物園 精子発見のイチョウ', lat: 35.7202, lng: 139.7452,
      coord: '座標為近似值（園內名木位置）',
      ginkgo: '官方園內介紹的「精子発見のイチョウ」。小石川植物園與小石川後樂園是不同地點。',
      history: '2025-11-19 官方文章把イチョウ列在紅葉／黃葉植物中（去年紀錄；看到黃葉不等於見頃）。' },
    { id: 'hongo', src: 'TKG-040', region: 'east', title: '東京大學 本鄉校區・銀杏並木', ja: '東京大学 本郷キャンパス 銀杏並木', lat: 35.7131, lng: 139.7606,
      coord: '座標為近似值（正門至安田講堂的並木中點）',
      ginkgo: '東大官方網站介紹「本郷キャンパスの銀杏並木」（正門至安田講堂）。',
      proof: { quote: '本郷キャンパスの銀杏並木', url: 'https://www.u-tokyo.ac.jp/ja/about/campus-guide/1km_of_campus.html', date: '東京大學官方網站' } },
    { id: 'kiba', src: 'TKG-003', region: 'east', title: '木場公園', ja: '木場公園', lat: 35.6752, lng: 139.8085,
      coord: '座標為近似值（園區代表點；銀杏位置未載明）',
      ginkgo: '園區頁面未見銀杏記載；試算表依 2025 年度官方紅葉情報名單列為銀杏。' },

    { id: 'johoku', src: 'TKG-006', region: 'north', title: '城北中央公園', ja: '城北中央公園', lat: 35.7564, lng: 139.673,
      coord: '座標為近似值（園區代表點；並木位置未載明）',
      ginkgo: '官方：「秋にはイチョウ並木が綺麗に色付きます」，照片標示「イチョウ並木_正門」。' },
    { id: 'hikarigaoka', src: 'TKG-010', region: 'north', title: '光之丘公園・銀杏並木', ja: '光が丘公園 いちょう並木', lat: 35.7648, lng: 139.6295,
      coord: '座標為近似值（売店與観賞池之間，約 ±100 m）',
      ginkgo: '官方：公園中央（売店與観賞池之間）的いちょう並木，移植自グラントハイツ的 28 棵；另有「ふれあいの径」移植自舊都廳前的 40 棵銀杏。' },
    { id: 'zenpukuji', src: 'TKG-007', region: 'north', title: '善福寺川綠地', ja: '善福寺川緑地', lat: 35.692, lng: 139.6305,
      coord: '座標為近似值（沿河帶狀公園的代表點）',
      ginkgo: '官方：秋天ケヤキ、イチョウ、トウカエデ、サクラ等轉色（全園描述，未指定地點）。' },
    { id: 'wadabori', src: 'TKG-008', region: 'north', title: '和田堀公園', ja: '和田堀公園', lat: 35.6855, lng: 139.6395,
      coord: '座標為近似值（園區代表點）',
      ginkgo: '官方：鄰接的大宮八幡宮「黄色く色づいた神門の夫婦銀杏は見もの」。' },
    { id: 'otaguro', src: 'TKG-024', region: 'north', title: '大田黑公園', ja: '大田黒公園', lat: 35.7007, lng: 139.6248,
      coord: '座標為近似值（公園位置）',
      ginkgo: '杉並區官方：正門起 70 m 的園路兩側是樹齡 100 年的大イチョウ並木。' },

    { id: 'koganei', src: 'TKG-004', region: 'tama', title: '小金井公園', ja: '小金井公園', lat: 35.7155, lng: 139.5189,
      coord: '座標為近似值（園區代表點；銀杏位置未載明）',
      ginkgo: '官方「花の見ごろ情報（秋）」列有イチョウ，未載明位置。' },
    { id: 'showa', src: 'TKG-014', region: 'tama', title: '國營昭和紀念公園・カナール', ja: '国営昭和記念公園 カナール', lat: 35.7028, lng: 139.4022,
      coord: '座標為近似值（カナール銀杏並木）',
      ginkgo: '官方：カナール水路兩側是銀杏並木（花・植物指南寫 200 m，秋の夜散歩頁寫 150 m、106 棵，兩頁不一致）；「カナールからかたらいのイチョウ並木の順に色づきが進む」。另一條かたらいのイチョウ並木（官方：全長約 300 m、98 棵，距西立川口約 730 m）位置未核實（約 ±400 m），只列文字，不上地圖、不可加入路線。' },
    { id: 'hachioji', src: 'TKG-016', region: 'tama', title: '八王子・甲州街道銀杏並木', ja: '甲州街道いちょう並木', lat: 35.652, lng: 139.3004,
      coord: '座標為近似值（約 4 km 並木的中段代表點）',
      ginkgo: '官方：追分町交差點至高尾駅附近約 4 km、約 770 棵；官方黃葉情報的攝影點是八王子市中央圖書館與多摩御陵入口交差點。',
      recent: '2026-09-22 官方黃葉情報照片；2026-09-24 官方公告：已到從高尾方面開始變色的時期（未標示階段，不定期更新）。' },
    { id: 'kotokuji', src: 'TKG-019', region: 'tama', title: '廣德寺（秋留野）', ja: '広徳寺（あきる野市）', lat: 35.7218, lng: 139.2174,
      coord: '座標為近似值（寺院位置；銀杏在境內）',
      ginkgo: 'あきる野市官方：境內「イチョウの巨樹もある」。',
      history: '2025-11-08 發文（11/06 拍攝）：銀杏變色進展、距見頃尚差一些（去年紀錄）。' },
    { id: 'okunitama', src: 'TKG-025', region: 'tama', title: '大國魂神社・大銀杏', ja: '大國魂神社', lat: 35.6676, lng: 139.479,
      coord: '座標為近似值（本殿・拝殿一帶；大銀杏在本殿後方）',
      ginkgo: '官方：本殿後方有傳說樹齡約 1000 年的銀杏大樹。馬場大門的櫸樹並木不是銀杏。' },
    { id: 'kunitachi', src: 'TKG-041', region: 'tama', title: '國立・大學通', ja: '国立 大学通り', lat: 35.6945, lng: 139.4468,
      coord: '座標為近似值（國立駅南側並木的代表點）',
      ginkgo: 'くにたちNAVI：秋天大學通被銀杏的黃色覆蓋；這條路也有櫻花樹。',
      proof: { quote: 'エレガントなイチョウの黄色で辺り一面が覆い尽くされます', url: 'https://kunimachi.jp/spot/daigakustreet/', date: 'くにたちNAVI 景點頁' } }
  ];
  var BY_ID = {};
  PLACES.forEach(function (p, i) { p.order = i; p.sheet = SHEET[p.src]; p.mappable = !p.listOnly; BY_ID[p.id] = p; });

  var SOURCE_ONLY = [
    ['TKG-001', 'S', '東京都公園協會｜紅葉情報入口', 'https://www.tokyo-park.or.jp/', '年度葉況的整合入口，不是單一地點；2026 年度網址尚未確認。'],
    ['TKG-020', 'O', '氣象廳｜いちょうの黄葉日', 'https://www.data.jma.go.jp/sakura/data/phn_012.html', '觀測站標本木尺度，用於季節示意的平年值。'],
    ['TKG-021', 'O', '氣象廳｜いちょうの落葉日', 'https://www.data.jma.go.jp/sakura/data/phn_013.html', '觀測站標本木尺度，用於「落葉」階段起點。'],
    ['TKG-022', 'O', '氣象廳｜生物季節累年值CSV入口', 'https://www.data.jma.go.jp/sakura/data/download_ruinenchi.html', '歷史資料下載索引，不是景點。'],
    ['TKG-027', 'C', 'GO TOKYO｜秋季紅葉指南', 'https://www.gotokyo.org/jp/story/guide/autumn-leaves-forecast/index.html', '觀光指南，用來發現景點，不是單一地點。'],
    ['TKG-028', 'C', '千代田區觀光協會｜景點／專題', 'https://visit-chiyoda.tokyo/app/spot', '區域景點入口，未證實逐點銀杏資料。'],
    ['TKG-029', 'C', '新宿觀光振興協會｜官方入口', 'https://www.kanko-shinjuku.jp/', '觀光入口，不能取代新宿御苑的植物報告。'],
    ['TKG-031', 'B', '神代植物公園｜園區植物公告', 'https://www.tokyo-park.or.jp/park/jindai/', '2025 年中央名單記錄的是楓樹（モミジ），未證實銀杏。'],
    ['TKG-032', 'B', '府中市鄉土之森博物館｜花ごよみ', 'https://www.fuchu-cpf.or.jp/museum/hanagoyomi/index.html', '銀杏物種與現況均待補證。'],
    ['TKG-033', 'T', 'tenki.jp｜東京都紅葉情報', 'https://tenki.jp/kouyou/3/16/', '第三方平台，多樹種混合。'],
    ['TKG-034', 'T', 'Weathernews｜東京都紅葉情報', 'https://weathernews.jp/koyo/area/tokyo/', '第三方平台，非官方實測。'],
    ['TKG-035', 'T', 'WalkerPlus｜東京 黃色に色づく', 'https://koyo.walkerplus.com/yellow/ar0313/', '第三方目錄，含其他黃葉樹種。'],
    ['TKG-036', 'T', 'Jorudan｜東京都 紅葉情報', 'https://sp.jorudan.co.jp/leaf/tokyo.html', '第三方目錄，僅作查漏。'],
    ['TKG-037', 'T', '日本氣象株式會社｜紅葉・黃葉見頃預想', 'https://n-kishou.com/corp/news-contents/autumn/', '民間預報產品（不是氣象廳）。'],
    ['TKG-038', 'X', '東京都公園協會｜2025紅葉季舊專頁', 'https://www.tokyo-park.or.jp/special/kouyou/index.html', '已失效（查核時回傳 404），保留作紀錄。', true],
    ['TKG-039', 'X', '箱根植木｜大田黑公園舊管理案例', 'https://hakone-ueki.com/casestudy/case1/', '舊管理公司，2024 年 3 月已結束管理，排除。']
  ];

  /* 散步提案：只用官方資料（facts_*.json、試算表注意事項） */
  var WALKS = [
    { no: '01', title: '明治神宮外苑 銀杏並木', place: 'gaien', area: '港區北青山／新宿區霞ヶ丘町',
      steps: [
        '從青山通り側的青山口進入，沿四列銀杏並木走到円周道路；並木盡頭正對聖德記念繪畫館（官方：約 300 m、146 棵，屬頁面上的歷史數值）。',
        '官方也提到並木途中有兩條向西分出、通往秩父宮ラグビー場的支線。',
        '最近車站（官方列出）：東京メトロ銀座線「外苑前」「青山一丁目」、JR「信濃町」「千駄ヶ谷」等。'
      ],
      combo: '順路組合：新宿御苑（千駄ヶ谷門靠近 JR 千駄ヶ谷駅，官方寫徒步約 5 分）與外苑相近，可以排在同一天。',
      notes: [
        '這裡是明治神宮「外苑」，不是明治神宮內苑。',
        '官方沒有公布開放時間或費用；截至 2026-10-02，官方網站沒有 2026 年いちょう祭り的公告。'
      ],
      links: [['明治神宮外苑 いちょう並木（官方）', 'https://www.meijijingugaien.jp/walk/sight/season.html']],
      gmaps: { label: 'Google 地圖步行：青山口側 → 円周道路側', from: [35.6722, 139.7208], to: [35.675, 139.7195] },
      load: ['gaien', 'shinjuku'] },
    { no: '02', title: '新宿御苑', place: 'shinjuku', area: '新宿區・澀谷區',
      steps: [
        '官方 2025-11-28 的文章寫園內各處銀杏「みごろ」，溫室附近枝條較低，是熱門拍攝點（去年紀錄，不是今年現況）。',
        '官方季節みどころ：11 月有紅葉（イチョウ、プラタナスなど）與菊花壇展。',
        '10/1～3/14 開園 9:00～16:30（16:00 最後入園）；週一休園（逢假日改為下一個平日）；秋の特別開園 11/1～11/15 期間無休。一般入園 500 円。'
      ],
      combo: '順路組合：可與明治神宮外苑銀杏並木同日安排（見提案 01）。',
      notes: [
        '大木戸門周邊 2026-10-06 至 11 月下旬（預定）施工，作業時有通行管制、園路變窄，機車請停新宿門（2026-10-01 官方公告）。'
      ],
      links: [['新宿御苑 自然情報（官方）', 'https://fng.or.jp/shinjuku/news/'], ['大木戸門通行管制公告', 'https://fng.or.jp/shinjuku/2026/10/01/20261001-01/']] },
    { no: '03', title: '國營昭和紀念公園', place: 'showa', area: '立川市・昭島市',
      steps: [
        'カナール：立川口附近的水路，兩側是銀杏並木（官方兩頁分別寫 200 m 與 150 m）。',
        'かたらいのイチョウ並木：全長約 300 m、98 棵，距西立川口約 730 m（確切位置未核實，約 ±400 m；只列文字，不上地圖、不可加入路線）。',
        '官方說明「カナールからかたらいのイチョウ並木の順に色づきが進む」，可以先看カナール，再往西走。官方的銀杏黃葉時期寫法是「10月下旬～11月下旬」。'
      ],
      combo: '入口：西立川ゲート（JR 青梅線西立川駅，官方寫約 2 分）、立川ゲート（JR 立川駅北口，官方寫約 18 分）。',
      notes: [
        '「黄葉・紅葉まつり＆秋の夜散歩2026」為 2026-10-29 至 11-29（官方活動日期，不等於見頃日）。',
        '入園需購票，費用與開園時間以官方頁面為準。'
      ],
      links: [['昭和記念公園 花だより（官方）', 'https://www.showakinen-koen.jp/hanadayori/'], ['秋の夜散歩 2026（官方）', 'https://www.showakinen-koen.jp/autumn-night-walk/']] },
    { no: '04', title: '八王子 甲州街道銀杏並木', place: 'hachioji', area: '八王子市・國道 20 號',
      steps: [
        '並木沿甲州街道（國道 20 號），從追分町交差點到高尾駅附近約 4 km、約 770 棵（官方）；昭和 2～4 年（1927～1929）植樹；今年的祭典以「甲州街道いちょう並木100年記念」為名（官方）。',
        '官方黃葉情報的兩個攝影點：八王子市中央圖書館、多摩御陵入口交差點，可以當成散步中途的觀察點。',
        '2026-09-24 官方公告：已到從高尾方面開始變色的時期，黃葉情報不定期更新（未標示階段）。'
      ],
      combo: '全程很長，可以只走其中一段；Google 地圖可規劃追分町到高尾駅附近的步行路線。',
      notes: [
        '第47回八王子いちょう祭り：2026-11-21（六）、11-22（日）（官方；祭典日期不等於見頃日）。',
        '祭典期間沒有停車場、部分道路通行管制，官方建議搭乘大眾運輸。'
      ],
      links: [['八王子いちょう祭り 黄葉情報（官方）', 'https://www.ichou-festa.org/ichounews/'], ['八王子いちょう祭り（官方）', 'https://www.ichou-festa.org/']],
      gmaps: { label: 'Google 地圖步行：追分町 → 高尾駅附近', from: [35.6609, 139.3186], to: [35.6423, 139.2812] } }
  ];

  var RECENT_YEARS = [
    ['2016', '11/21'], ['2017', '11/17'], ['2018', '11/19'], ['2019', '11/29'], ['2020', '11/26'],
    ['2021', '11/28'], ['2022', '11/19'], ['2023', '12/1'], ['2024', '12/3'], ['2025', '11/22']
  ];

  /* =========================================================
   * 4. 狀態
   * ======================================================= */
  var KEY_FAV = 'tokyoGinkgoWalk.favorites';
  var KEY_ROUTE = 'tokyoGinkgoWalk.route';
  var savedFav = store.get(KEY_FAV, []);
  var savedRoute = store.get(KEY_ROUTE, { ids: [], manual: false });

  var defaultIdx = Math.min(RANGE_DAYS, Math.max(0, dayDiff(TODAY, RANGE_START)));
  var state = {
    dateIdx: defaultIdx,
    group: 'all',
    region: 'all',
    grade: 'all',
    favOnly: false,
    userPos: null,
    selected: null,
    expanded: {},
    favs: (Array.isArray(savedFav) ? savedFav : []).filter(function (id) { return BY_ID[id]; }),
    route: {
      ids: (savedRoute && Array.isArray(savedRoute.ids) ? savedRoute.ids : []).filter(function (id) { return BY_ID[id] && BY_ID[id].mappable; }).slice(0, 5),
      manual: !!(savedRoute && savedRoute.manual)
    },
    tab: 'map'
  };
  function currentDate() { return addDays(RANGE_START, state.dateIdx); }
  function currentStage() { return stageFor(currentDate()); }
  function isFav(id) { return state.favs.indexOf(id) !== -1; }
  function inRoute(id) { return state.route.ids.indexOf(id) !== -1; }

  /* =========================================================
   * 5. 季節區塊
   * ======================================================= */
  var slider = $('#dateSlider');
  function initSeason() {
    $('#sliderYear').textContent = YEAR;
    slider.max = RANGE_DAYS;
    slider.value = state.dateIdx;

    // 滑桿軌道依階段比例上色
    var stops = [];
    STAGES.forEach(function (s) {
      var a = Math.max(0, dayDiff(stageStart(s), RANGE_START));
      var b = Math.min(RANGE_DAYS + 1, dayDiff(stageEnd(s), RANGE_START) + 1);
      if (b <= a) return;
      stops.push(s.color + ' ' + (a / (RANGE_DAYS + 1) * 100).toFixed(2) + '%');
      stops.push(s.color + ' ' + (b / (RANGE_DAYS + 1) * 100).toFixed(2) + '%');
    });
    slider.style.setProperty('--track', 'linear-gradient(90deg,' + stops.join(',') + ')');

    // 刻度
    var marks = [
      { d: RANGE_START, t: fmtShort(RANGE_START), cls: '' },
      { d: new Date(YEAR, 10, 1), t: '11/1', cls: 'm-hide' },
      { d: D_NORMAL, t: '11/23 黃葉平年日', cls: 'm-key' },
      { d: new Date(YEAR, 11, 3), t: '12/3 落葉平年日', cls: 'm-hide' },
      { d: RANGE_END, t: fmtShort(RANGE_END), cls: '' }
    ];
    $('#sliderScale').innerHTML = marks.map(function (m) {
      var pct = dayDiff(m.d, RANGE_START) / RANGE_DAYS * 100;
      return '<span class="' + m.cls + '" style="left:' + pct.toFixed(2) + '%">' + esc(m.t) + '</span>';
    }).join('');

    // 今天在範圍外的說明
    var note = '';
    if (TODAY < RANGE_START) note = '今天（東京日期 ' + fmtShort(TODAY) + '）早於滑桿起點，所以預設顯示 ' + fmtShort(RANGE_START) + '。';
    else if (TODAY > RANGE_END) note = '今天（東京日期）已超過滑桿範圍，預設顯示 ' + fmtShort(RANGE_END) + '。';
    else note = '預設為今天（東京日期 ' + fmtShort(TODAY) + '）。';
    $('#todayNote').textContent = note;

    // 六個階段
    $('#stageSteps').innerHTML = STAGES.map(function (s) {
      var a = stageStart(s), b = stageEnd(s);
      var range = isFinite(s.from) ? fmtShort(a) + (isFinite(s.to) ? '–' + fmtShort(b) : ' 起') : '至 ' + fmtShort(b);
      return '<li><button type="button" class="step" data-stage="' + s.key + '" style="--c:' + s.color + '">' +
        '<span class="step-name">' + esc(s.name) + '</span><span class="step-range">' + esc(range) + '</span></button></li>';
    }).join('');
    $all('#stageSteps .step').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var s = STAGES.filter(function (x) { return x.key === btn.getAttribute('data-stage'); })[0];
        setDateIdx(Math.max(0, dayDiff(stageStart(s), RANGE_START)));
      });
    });

    slider.addEventListener('input', function () { setDateIdx(parseInt(slider.value, 10)); });

    // 說明表
    $('#stageTable tbody').innerHTML = STAGES.map(function (s) {
      var a = stageStart(s), b = stageEnd(s);
      var dates = isFinite(s.from) ? fmtShort(a) + (isFinite(s.to) ? '–' + fmtShort(b) : ' 起') : '至 ' + fmtShort(b);
      return '<tr><th scope="row"><i class="dot" style="background:' + s.color + '"></i>' + esc(s.name) + '</th><td>' + esc(s.offset) + '</td><td>' + esc(dates) + '</td></tr>';
    }).join('');

    // 近年黃葉日
    $('#yearStrip').innerHTML = RECENT_YEARS.map(function (y) {
      var parts = y[1].split('/');
      var d = new Date(YEAR, parseInt(parts[0], 10) - 1, parseInt(parts[1], 10));
      var off = dayDiff(d, D_NORMAL); // -7..+10
      var pct = (off + 8) / 20 * 100;
      return '<li><span class="ys-year">' + y[0] + '</span><span class="ys-track"><i class="ys-normal" aria-hidden="true"></i><i class="ys-dot" style="left:' + pct.toFixed(1) + '%"></i></span><span class="ys-date">' + y[1] + '<small>' + (off === 0 ? '±0' : (off > 0 ? '+' : '') + off) + ' 天</small></span></li>';
    }).join('') + '<li class="ys-legend"><span></span><span class="ys-track-label">直線＝平年值 11/23</span><span></span></li>';

    // 來源等級說明
    $('#gradeLegend').innerHTML = GRADES.map(function (g) {
      return '<div><dt><b class="grade g-' + g.key + '">' + g.key + '</b></dt><dd>' + esc(g.desc) + '</dd></div>';
    }).join('') + GRADE_EXTRA.map(function (g) {
      return '<div><dt><b class="grade g-' + g.key + '">' + g.key + '</b></dt><dd>' + esc(g.desc) + '（只出現在資料來源表）</dd></div>';
    }).join('');

    // 來源表
    $('#srcTable tbody').innerHTML = SOURCE_ONLY.map(function (r) {
      return '<tr><td class="mono">' + r[0] + '</td><td><b class="grade g-' + r[1] + '">' + r[1] + '</b></td><td>' + (r[5] ? esc(r[2]) + '<br><span class="dead-url">' + esc(r[3]) + '（失效，不提供連結）</span>' : '<a href="' + esc(r[3]) + '" target="_blank" rel="noopener">' + esc(r[2]) + '</a>') + '</td><td>' + esc(r[4]) + '</td></tr>';
    }).join('');
  }

  function setDateIdx(idx) {
    state.dateIdx = Math.max(0, Math.min(RANGE_DAYS, idx));
    if (parseInt(slider.value, 10) !== state.dateIdx) slider.value = state.dateIdx;
    renderSeason();
    renderAll();
  }

  function renderSeason() {
    var d = currentDate(), s = currentStage();
    var diff = dayDiff(d, D_NORMAL);
    document.documentElement.style.setProperty('--stage', s.color);
    $('#seasonDate').textContent = fmtLong(d);
    $('#seasonStage').textContent = s.name;
    $('#seasonHint').textContent = diff === 0 ? '正好是氣象廳東京黃葉平年日（11/23）'
      : diff < 0 ? '距東京黃葉平年日（11/23）還有 ' + (-diff) + ' 天'
        : '東京黃葉平年日（11/23）後第 ' + diff + ' 天';
    slider.setAttribute('aria-valuetext', fmtLong(d) + '，季節示意：' + s.name);
    $all('#stageSteps .step').forEach(function (b) {
      var on = b.getAttribute('data-stage') === s.key;
      b.classList.toggle('is-on', on);
      if (on) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
    });
  }

  /* =========================================================
   * 6. 篩選
   * ======================================================= */
  var groupChips = $('#groupChips'), regionSel = $('#regionSel'), gradeSel = $('#gradeSel');
  function initFilters() {
    groupChips.innerHTML = GROUPS.map(function (g) {
      return '<button type="button" class="chip" role="radio" data-group="' + g.key + '" aria-checked="false">' +
        (g.key !== 'all' ? '<i class="chip-dot g-' + g.key + '" aria-hidden="true"></i>' : '') + esc(g.name) + '</button>';
    }).join('');
    $all('.chip', groupChips).forEach(function (c) {
      c.addEventListener('click', function () { state.group = c.getAttribute('data-group'); renderAll(); });
    });
    groupChips.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      var keys = GROUPS.map(function (g) { return g.key; });
      var i = keys.indexOf(state.group) + (e.key === 'ArrowRight' ? 1 : -1);
      state.group = keys[(i + keys.length) % keys.length];
      renderAll();
      var el = $('.chip[data-group="' + state.group + '"]', groupChips); if (el) el.focus();
      e.preventDefault();
    });

    regionSel.innerHTML = '<option value="all">全部地區</option>' + REGIONS.map(function (r) {
      return '<option value="' + r.key + '">' + esc(r.name) + '</option>';
    }).join('');
    gradeSel.innerHTML = '<option value="all">全部來源等級</option>' + GRADES.map(function (g) {
      return '<option value="' + g.key + '">' + esc(g.name) + '</option>';
    }).join('');
    regionSel.addEventListener('change', function () { state.region = regionSel.value; renderAll(); fitVisible(); });
    gradeSel.addEventListener('change', function () { state.grade = gradeSel.value; renderAll(); fitVisible(); });

    $('#favOnly').addEventListener('click', function () { state.favOnly = !state.favOnly; renderAll(); fitVisible(); });
    $('#clearBtn').addEventListener('click', clearFilters);
    $('#locateBtn').addEventListener('click', locate);
  }
  function clearFilters() {
    state.group = 'all'; state.region = 'all'; state.grade = 'all'; state.favOnly = false;
    regionSel.value = 'all'; gradeSel.value = 'all';
    renderAll(); fitVisible();
  }
  function baseMatch(p) {
    if (state.region !== 'all' && p.region !== state.region) return false;
    if (state.grade !== 'all' && p.sheet.grade !== state.grade) return false;
    if (state.favOnly && !isFav(p.id)) return false;
    return true;
  }
  function groupOk() { return state.group === 'all' || currentStage().group === state.group; }
  function visiblePlaces() {
    if (!groupOk()) return [];
    var list = PLACES.filter(baseMatch);
    if (state.userPos) {
      list.sort(function (a, b) {
        if (!a.mappable) return 1; if (!b.mappable) return -1;
        return haversine(state.userPos, a) - haversine(state.userPos, b);
      });
    }
    return list;
  }

  /* 定位：依距離排序；拒絕時給友善提示（不輸出錯誤到 console） */
  function geoMsg(text, tone) {
    var el = $('#geoMsg');
    if (!text) { el.hidden = true; el.textContent = ''; return; }
    el.hidden = false; el.className = 'geo-msg' + (tone ? ' is-' + tone : ''); el.textContent = text;
  }
  function locate() {
    var btn = $('#locateBtn');
    if (state.userPos) { // 再按一次＝取消距離排序
      state.userPos = null; btn.setAttribute('aria-pressed', 'false'); $('#locateLabel').textContent = '依我的位置排序';
      if (userMarker && map) { map.removeLayer(userMarker); userMarker = null; }
      geoMsg(''); renderAll(); return;
    }
    if (!('geolocation' in navigator)) { geoMsg('這個瀏覽器不支援定位，可以改用「地區」篩選找附近的景點。', 'warn'); return; }
    geoMsg('正在取得你的位置…');
    btn.disabled = true;
    navigator.geolocation.getCurrentPosition(function (pos) {
      btn.disabled = false;
      state.userPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      btn.setAttribute('aria-pressed', 'true'); $('#locateLabel').textContent = '取消距離排序';
      geoMsg('已依你的位置由近到遠排序（直線距離）。位置只用在這個頁面，不會上傳。', 'ok');
      if (map) {
        if (userMarker) map.removeLayer(userMarker);
        userMarker = L.circleMarker([state.userPos.lat, state.userPos.lng], { radius: 8, color: '#fff', weight: 3, fillColor: '#2B6CB0', fillOpacity: 1 })
          .addTo(map).bindTooltip('你的位置', { direction: 'top' });
      }
      renderAll();
    }, function (err) {
      btn.disabled = false;
      if (err && err.code === 1) geoMsg('你沒有允許定位，所以無法依距離排序。沒關係，清單仍可使用；之後若想用，可以在瀏覽器網址列的網站設定中允許位置，或改用「地區」篩選。', 'warn');
      else geoMsg('暫時取得不到位置（可能是訊號或逾時）。可以稍後再試，或改用「地區」篩選。', 'warn');
    }, { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 });
  }

  /* =========================================================
   * 7. 清單
   * ======================================================= */
  var listEl = $('#placeList');
  function placeRow(p, stage) {
    var sh = p.sheet, fav = isFav(p.id), rt = inRoute(p.id), sel = state.selected === p.id, open = !!state.expanded[p.id];
    var dist = state.userPos && p.mappable ? '<span class="meta-dist">距你約 ' + fmtDist(haversine(state.userPos, p)) + '（直線）</span>' : '';
    var routeFull = !rt && state.route.ids.length >= 5;
    var routeBtn = p.mappable
      ? '<button type="button" class="act' + (rt ? ' is-on' : '') + '" data-act="route" aria-pressed="' + rt + '"' + (routeFull ? ' disabled title="路線最多 5 個景點"' : '') + '>' + ICON.route + '<span>' + (rt ? '已在路線' : routeFull ? '路線已滿' : '加入路線') + '</span></button>'
      : '<button type="button" class="act" disabled title="位置未確定，不能加入路線">' + ICON.route + '<span>不可排路線</span></button>';
    var mapBtn = p.mappable ? '<button type="button" class="act act-map" data-act="map">' + ICON.pin + '<span>在地圖上看</span></button>' : '';
    var proof = p.proof ? '<div class="dl-row dl-proof"><dt>銀杏證據</dt><dd>官方網域原文「' + esc(p.proof.quote) + '」（' + esc(p.proof.date) + '）<a href="' + esc(p.proof.url) + '" target="_blank" rel="noopener">開啟證據頁' + ICON.ext + '</a></dd></div>' : '';
    var histLinks = (p.historyLinks || []).map(function (l) {
      return ' <a href="' + esc(l[1]) + '" target="_blank" rel="noopener">' + esc(l[0]) + ICON.ext + '</a>';
    }).join('');
    var extra = (p.history ? '<p class="note-history"><b>過去紀錄</b>' + esc(p.history) + histLinks + '</p>' : '') +
      (p.recent ? '<p class="note-recent"><b>2026 官方動態</b>' + esc(p.recent) + '</p>' : '');

    return '<li class="place' + (sel ? ' is-selected' : '') + (p.listOnly ? ' is-listonly' : '') + '" id="place-' + p.id + '" data-id="' + p.id + '">' +
      '<button type="button" class="place-head" data-act="select" aria-pressed="' + sel + '">' +
        '<span class="place-mark' + (p.listOnly ? ' is-off' : '') + '" aria-hidden="true">' + ICON.leaf + '</span>' +
        '<span class="place-text">' +
          '<span class="place-title">' + esc(p.title) + '</span>' +
          (p.ja && p.ja !== p.title ? '<span class="place-ja" lang="ja">' + esc(p.ja) + '</span>' : '') +
          '<span class="place-meta"><b class="grade g-' + sh.grade + '" title="來源等級 ' + sh.grade + '">' + sh.grade + '</b>' +
            '<span>' + esc(sh.area) + '</span><span class="meta-stage">季節示意・' + esc(stage.name) + '</span>' + dist + '</span>' +
          '<span class="place-coord">' + esc(p.coord) + '</span>' +
        '</span>' +
      '</button>' +
      '<div class="place-actions">' +
        '<button type="button" class="act act-fav' + (fav ? ' is-on' : '') + '" data-act="fav" aria-pressed="' + fav + '" aria-label="' + (fav ? '取消收藏 ' : '收藏 ') + esc(p.title) + '">' + ICON.bookmark + '<span>' + (fav ? '已收藏' : '收藏') + '</span></button>' +
        routeBtn + mapBtn +
        '<a class="act act-link" href="' + esc(sh.url) + '" target="_blank" rel="noopener">' + ICON.ext + '<span>官方連結</span></a>' +
      '</div>' +
      '<button type="button" class="place-toggle" data-act="detail" aria-expanded="' + open + '" aria-controls="detail-' + p.id + '"><span>來源資料</span>' + ICON.chev + '</button>' +
      '<div class="place-detail" id="detail-' + p.id + '"' + (open ? '' : ' hidden') + '>' +
        '<p class="detail-ginkgo"><b>銀杏在哪裡</b>' + esc(p.ginkgo) + '</p>' + extra +
        '<dl class="dl">' +
          '<div class="dl-row"><dt>來源等級</dt><dd><b class="grade g-' + sh.grade + '">' + sh.grade + '</b> ' + esc(gradeName(sh.grade)) + '</dd></div>' +
          '<div class="dl-row"><dt>管理單位</dt><dd>' + esc(sh.operator) + '</dd></div>' +
          '<div class="dl-row"><dt>資料摘錄</dt><dd>' + esc(sh.finding) + '</dd></div>' +
          '<div class="dl-row"><dt>證據日期</dt><dd>' + esc(sh.evidenceDate) + (sh.evidenceUrl && sh.evidenceUrl !== sh.url ? ' <a href="' + esc(sh.evidenceUrl) + '" target="_blank" rel="noopener">證據頁' + ICON.ext + '</a>' : '') + '</dd></div>' +
          '<div class="dl-row"><dt>更新頻率</dt><dd>' + esc(sh.cadence) + '</dd></div>' +
          '<div class="dl-row"><dt>注意事項</dt><dd>' + esc(sh.caveat) + '</dd></div>' +
          '<div class="dl-row"><dt>官方連結</dt><dd><a href="' + esc(sh.url) + '" target="_blank" rel="noopener">' + esc(sh.name) + ICON.ext + '</a></dd></div>' +
          proof +
        '</dl>' +
        '<p class="detail-src">試算表列 ' + esc(p.src) + '｜座標：' + esc(p.coord) + '</p>' +
      '</div>' +
    '</li>';
  }
  function gradeName(k) { var g = GRADES.filter(function (x) { return x.key === k; })[0]; return g ? g.name.split('｜')[1] : ''; }

  function renderList(list) {
    var stage = currentStage();
    listEl.innerHTML = list.map(function (p) { return placeRow(p, stage); }).join('');
    $('#listCount').textContent = list.length;
    var mapped = list.filter(function (p) { return p.mappable; }).length;
    $('#resultLine').textContent = list.length
      ? '共 ' + list.length + ' 處（地圖上 ' + mapped + ' 處' + (list.length - mapped ? '，' + (list.length - mapped) + ' 處只列清單' : '') + '）' + (state.userPos ? '・依距離排序' : '')
      : '';
    var empty = $('#listEmpty');
    if (list.length) { empty.hidden = true; empty.innerHTML = ''; return; }
    empty.hidden = false;
    if (!groupOk()) {
      var g = GROUPS.filter(function (x) { return x.key === state.group; })[0];
      var r = groupRange(state.group);
      var s = currentStage();
      var s0 = r.start < RANGE_START ? RANGE_START : r.start;
      empty.innerHTML = '<p class="empty-title" tabindex="-1">' + esc(fmtLong(currentDate())) + ' 不在「' + esc(g.name) + '」期間</p>' +
        '<p>本站的階段是依氣象廳東京平年值推估的季節示意，所有景點共用同一個階段。這一天的示意是「' + esc(s.name) + '」。' +
        '「' + esc(g.name) + '」（' + esc(r.names.join('、')) + '）大約在 <b>' + fmtShort(s0) + (state.group === 'fall' ? ' 以後' : ' – ' + fmtShort(r.end)) + '</b>。</p>' +
        '<div class="empty-actions"><button type="button" class="btn btn-forest" data-jump="' + dayDiff(s0, RANGE_START) + '">把日期移到 ' + fmtShort(s0) + '</button>' +
        '<button type="button" class="btn-text" data-reset="group">改看全部階段</button></div>';
    } else if (state.favOnly && !state.favs.length) {
      empty.innerHTML = '<p class="empty-title" tabindex="-1">還沒有收藏的景點</p><p>在清單中按「收藏」，想去的地方就會保存在這個瀏覽器。</p>' +
        '<div class="empty-actions"><button type="button" class="btn-text" data-reset="fav">顯示全部景點</button></div>';
    } else {
      empty.innerHTML = '<p class="empty-title" tabindex="-1">沒有符合條件的景點</p><p>目前的地區、來源等級' + (state.favOnly ? '或收藏' : '') + '條件下沒有景點。可以放寬篩選再試一次。</p>' +
        '<div class="empty-actions"><button type="button" class="btn-text" data-reset="all">清除篩選</button></div>';
    }
  }

  listEl.addEventListener('click', function (e) {
    var actEl = e.target.closest('[data-act]');
    if (!actEl) return;
    var li = actEl.closest('.place'); if (!li) return;
    var id = li.getAttribute('data-id'), act = actEl.getAttribute('data-act');
    if (act === 'select') { selectPlace(id, { pan: true, from: 'list' }); }
    else if (act === 'fav') { toggleFav(id); }
    else if (act === 'route') { toggleRoute(id); focusEl($('#place-' + id + ' [data-act="route"]') || $('#routeList .stop[data-id="' + id + '"] [data-remove]')); }
    else if (act === 'map') { selectPlace(id, { pan: true, from: 'list', showMap: true }); }
    else if (act === 'detail') {
      state.expanded[id] = !state.expanded[id];
      actEl.setAttribute('aria-expanded', String(!!state.expanded[id]));
      var det = $('#detail-' + id); if (det) det.hidden = !state.expanded[id];
    }
  });
  $('#listEmpty').addEventListener('click', function (e) {
    var j = e.target.closest('[data-jump]'), r = e.target.closest('[data-reset]');
    if (j) { var idx = parseInt(j.getAttribute('data-jump'), 10); setDateIdx(idx); focusListTop(); }
    else if (r) {
      var k = r.getAttribute('data-reset');
      if (k === 'group') state.group = 'all';
      else if (k === 'fav') state.favOnly = false;
      else { clearFilters(); focusListTop(); return; }
      renderAll(); fitVisible(); focusListTop();
    }
  });

  function toggleFav(id) {
    var i = state.favs.indexOf(id);
    if (i === -1) state.favs.push(id); else state.favs.splice(i, 1);
    store.set(KEY_FAV, state.favs);
    renderAll();
    var btn = $('#place-' + id + ' [data-act="fav"]');
    if (btn) btn.focus(); else focusListTop();
  }
  /* 重新繪製後把鍵盤焦點放回合理的位置，避免掉回頁首 */
  function focusEl(el) { if (el) { try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); } } }
  function focusListTop() {
    var rl = $('#resultLine');
    focusEl(rl && rl.textContent ? rl : ($('#placeList .place-head') || $('#listEmpty .empty-title')));
  }
  function focusRouteAt(i) {
    var rms = $all('#routeList [data-remove]');
    if (rms.length) focusEl(rms[Math.max(0, Math.min(i, rms.length - 1))]);
    else focusEl($('#routeEmpty .empty-title'));
  }

  /* =========================================================
   * 8. 地圖（Leaflet + OpenStreetMap；失敗時不影響其他功能）
   * ======================================================= */
  var map = null, markers = {}, markerLayer = null, routeLine = null, userMarker = null, tileLayer = null;
  var tileErrors = 0, tileOk = 0, tileNoticeShown = false;
  /* mode 'banner'：底圖失敗時只在地圖上方放一條提示，葉片與路線仍可點選；
     完整遮罩只用在 Leaflet 本身載入失敗（typeof L === 'undefined'）時 */
  function mapNotice(html, mode) {
    var n = $('#mapNotice');
    if (!html) { n.hidden = true; n.innerHTML = ''; n.classList.remove('is-banner'); return; }
    n.classList.toggle('is-banner', mode === 'banner');
    n.hidden = false; n.innerHTML = html;
  }
  function initMap() {
    if (typeof window.L === 'undefined') {
      document.body.classList.add('no-map');
      mapNotice('<p class="mn-title">示意地圖暫時無法載入</p><p>可能是離線或地圖程式庫被網路阻擋。清單、收藏與路線仍然可以使用，路線也能直接用 Google 地圖導航。</p><button type="button" class="btn btn-forest" data-goto="list">改看清單</button>');
      return;
    }
    try {
      map = L.map('map', { trackResize: false, zoomControl: true, scrollWheelZoom: true, minZoom: 8, maxZoom: 18, zoomSnap: 0.25, zoomDelta: 0.5 });
      map.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a>');
      useOsmTiles();
      markerLayer = L.layerGroup().addTo(map);
      PLACES.forEach(function (p) {
        if (!p.mappable) return;
        var m = L.marker([p.lat, p.lng], { icon: buildIcon(p), title: p.title, keyboard: true, riseOnHover: true });
        m.bindPopup(function () { return popupHtml(p); }, { maxWidth: isMobile() ? 220 : 236, minWidth: 196, autoPanPaddingTopLeft: [58, 12], autoPanPaddingBottomRight: [16, 12] });
        // 由我們決定點擊後要「放大葉片群」還是「選取並開啟說明」，避免在擠成一團時開到隔壁景點
        m.off('click', m._openPopup, m);
        m.on('click', function () {
          if (zoomIntoCrowd(m)) return;
          selectPlace(p.id, { pan: false, from: 'map' });
          m.openPopup();
        });
        markers[p.id] = m;
      });
      var syncZoomClass = function () { map.getContainer().classList.toggle('z-low', map.getZoom() < 11); };
      map.on('zoomend', syncZoomClass);
      fitVisible(true);
      syncZoomClass();
      watchMapSize();
      map.on('popupopen', function (e) {
        var el = e.popup.getElement(); if (!el) return;
        if (!el.getAttribute('data-bound')) { el.setAttribute('data-bound', '1'); el.addEventListener('click', onPopupClick); }
      });
    } catch (err) {
      map = null;
      document.body.classList.add('no-map');
      mapNotice('<p class="mn-title">示意地圖暫時無法載入</p><p>清單、收藏與路線仍然可以使用。</p>');
    }
  }
  function useOsmTiles() {
    tileLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>'
    });
    tileLayer.on('tileerror', onTileError);
    tileLayer.on('tileload', function () { tileOk++; if (tileNoticeShown) { tileNoticeShown = false; mapNotice(''); } });
    tileLayer.addTo(map);
  }
  /* OSM 圖磚一直失敗時（例如離線或被阻擋），直接顯示提示；不改用其他底圖 */
  function onTileError() {
    tileErrors++;
    if (!tileNoticeShown && tileErrors >= 4 && tileOk === 0) {
      tileNoticeShown = true;
      mapNotice('<p class="mn-title">示意地圖暫時無法載入</p><p>OpenStreetMap 底圖圖磚讀取失敗（可能是離線或網路阻擋）。景點葉片與路線仍顯示在空白底圖上，可以照常點選；清單、收藏與路線照常可用，也能直接用 Google 地圖導航。</p>', 'banner');
    }
  }
  /* 全東京縮放層級時，市中心的葉片會互相重疊：點到葉片群時先放大，讓每片葉子分開後再選 */
  function zoomIntoCrowd(m) {
    if (!map || map.getZoom() >= 14) return false; // 14 級以上葉片已分開（最近兩點約 560 m，相距 70 px 以上）
    var pt = map.latLngToContainerPoint(m.getLatLng());
    var near = Object.keys(markers).filter(function (k) {
      return markerLayer.hasLayer(markers[k]) && map.latLngToContainerPoint(markers[k].getLatLng()).distanceTo(pt) < 40;
    });
    if (near.length < 2) return false;
    map.closePopup();
    var b = L.latLngBounds(near.map(function (k) { return markers[k].getLatLng(); }));
    if (smooth() === 'auto') map.fitBounds(b, { padding: [60, 60], maxZoom: 14, animate: false });
    else map.flyToBounds(b, { padding: [60, 60], maxZoom: 14, duration: 0.6 });
    return true;
  }
  function buildIcon(p) {
    var idx = state.route.ids.indexOf(p.id);
    var cls = 'gk-marker' + (state.selected === p.id ? ' is-selected' : '') + (isFav(p.id) ? ' is-fav' : '') + (idx !== -1 ? ' in-route' : '');
    var badge = idx !== -1 ? '<b class="gk-num">' + (idx + 1) + '</b>' : '';
    return L.divIcon({
      className: cls,
      html: '<span class="gk-pin"><svg viewBox="0 0 64 68" aria-hidden="true"><use href="#gk"/></svg></span>' + badge,
      iconSize: [44, 44], iconAnchor: [22, 40], popupAnchor: [0, -34]
    });
  }
  function popupHtml(p) {
    var s = currentStage(), rt = inRoute(p.id), full = !rt && state.route.ids.length >= 5;
    return '<div class="pop" data-id="' + p.id + '">' +
      '<p class="pop-title">' + esc(p.title) + '</p>' +
      '<p class="pop-meta"><b class="grade g-' + p.sheet.grade + '">' + p.sheet.grade + '</b> ' + esc(p.sheet.area) + '</p>' +
      '<p class="pop-stage">季節示意（' + esc(fmtShort(currentDate())) + '）：<b>' + esc(s.name) + '</b></p>' +
      '<p class="pop-coord">' + esc(p.coord) + '</p>' +
      '<div class="pop-actions">' +
        '<button type="button" class="pop-btn" data-pop="detail">看來源資料</button>' +
        '<button type="button" class="pop-btn' + (rt ? ' is-on' : '') + '" data-pop="route"' + (full ? ' disabled' : '') + '>' + (rt ? '移出路線' : full ? '路線已滿' : '加入路線') + '</button>' +
      '</div></div>';
  }
  function onPopupClick(e) {
    var b = e.target.closest('[data-pop]'); if (!b) return;
    var id = b.closest('.pop').getAttribute('data-id');
    if (b.getAttribute('data-pop') === 'detail') {
      state.expanded[id] = true;
      setTab('list');
      renderAll();
      var li = $('#place-' + id);
      if (li) { li.scrollIntoView({ block: 'start', behavior: smooth() }); var h = $('.place-head', li); if (h) h.focus({ preventScroll: true }); }
    } else {
      toggleRoute(id);
      if (map) map.closePopup();
      var mk = markers[id] && markers[id].getElement && markers[id].getElement();
      focusEl(mk && markerLayer.hasLayer(markers[id]) ? mk : $('#place-' + id + ' [data-act="route"]'));
    }
  }
  function renderMarkers(list) {
    if (!map) return;
    var vis = {};
    list.forEach(function (p) { if (p.mappable) vis[p.id] = true; });
    PLACES.forEach(function (p) {
      var m = markers[p.id]; if (!m) return;
      if (vis[p.id]) { if (!markerLayer.hasLayer(m)) markerLayer.addLayer(m); m.setIcon(buildIcon(p)); }
      else if (markerLayer.hasLayer(m)) markerLayer.removeLayer(m);
    });
    // 篩選後地圖上沒有景點的提示
    var n = Object.keys(vis).length;
    var frame = $('.map-frame');
    frame.classList.toggle('is-empty', n === 0);
    frame.setAttribute('data-empty', n === 0 ? (groupOk() ? '目前的篩選條件下，地圖上沒有景點' : '所選日期不在這個階段期間，地圖上暫不顯示景點') : '');
  }
  function fitVisible(initial) {
    if (!map) return;
    var pts = visiblePlaces().filter(function (p) { return p.mappable; }).map(function (p) { return [p.lat, p.lng]; });
    if (!pts.length) pts = PLACES.filter(function (p) { return p.mappable; }).map(function (p) { return [p.lat, p.lng]; });
    map.fitBounds(L.latLngBounds(pts), { padding: isMobile() ? [40, 40] : [28, 28], maxZoom: 14, animate: !initial });
    noteFitSize();
  }
  function renderRouteLine(list) {
    if (!map) return;
    if (routeLine) { map.removeLayer(routeLine); routeLine = null; }
    var pts = state.route.ids.map(function (id) { return [BY_ID[id].lat, BY_ID[id].lng]; });
    if (pts.length >= 2) {
      // 篩選把路線上的景點藏起來時，路線淡化，避免在空地圖上漂浮
      var shown = {}; (list || []).forEach(function (p) { shown[p.id] = true; });
      var allShown = state.route.ids.every(function (id) { return shown[id]; });
      routeLine = L.polyline(pts, { color: '#24452F', weight: 4, opacity: allShown ? 0.9 : 0.25, dashArray: '2 9', lineCap: 'round', interactive: false }).addTo(map);
    }
  }
  /* 把地圖框到整條路線（2 站以上）；地圖在手機分頁中隱藏時先略過，切到地圖分頁時再框 */
  function fitRoute() {
    if (!map || state.route.ids.length < 2) return;
    var c = map.getContainer(); if (!c.offsetWidth || !c.offsetHeight) return;
    map.invalidateSize();
    var b = L.latLngBounds(state.route.ids.map(function (id) { return [BY_ID[id].lat, BY_ID[id].lng]; }));
    map.fitBounds(b, { padding: isMobile() ? [40, 40] : [50, 50], maxZoom: 15, animate: smooth() !== 'auto' });
    noteFitSize();
  }

  /* 選取：地圖與清單同步高亮 */
  function selectPlace(id, opt) {
    opt = opt || {};
    state.selected = id;
    var p = BY_ID[id];
    if (opt.showMap) setTab('map');
    renderAll();
    if (map && p.mappable && markers[id]) {
      var go = function () {
        if (opt.pan) map.setView([p.lat, p.lng], Math.max(map.getZoom(), 14), { animate: true });
        if (opt.from === 'list' && !isMobile() && markerLayer.hasLayer(markers[id])) markers[id].openPopup();
      };
      // 上一個縮放動畫進行中時，Leaflet 會忽略新的 setView，所以等動畫結束再移動
      if (map._animatingZoom) map.once('zoomend', go); else go();
      if (opt.showMap) setTimeout(function () { if (markers[id] && markerLayer.hasLayer(markers[id])) markers[id].openPopup(); }, 260);
    }
    if (opt.from === 'list' && !opt.showMap) { var hd = $('#place-' + id + ' .place-head'); if (hd) hd.focus({ preventScroll: true }); }
    if (opt.from === 'map') {
      var li = $('#place-' + id);
      if (li && !isMobile()) li.scrollIntoView({ block: 'nearest', behavior: smooth() });
    }
  }

  /* =========================================================
   * 9. 路線：2–5 個有座標的景點；最近鄰自動排序＋手動調整
   * ======================================================= */
  function nearestOrder(ids) {
    if (ids.length < 3) return ids.slice();
    var rest = ids.slice(1), out = [ids[0]];
    while (rest.length) {
      var last = BY_ID[out[out.length - 1]], bi = 0, bd = Infinity;
      rest.forEach(function (id, i) { var d = haversine(last, BY_ID[id]); if (d < bd) { bd = d; bi = i; } });
      out.push(rest.splice(bi, 1)[0]);
    }
    return out;
  }
  /* 散步提案取代原路線時的「復原」：保存前一條路線；其他路線變更後就收起提示 */
  var routeUndoPrev = null;
  function hideRouteUndo() { routeUndoPrev = null; $('#routeUndo').hidden = true; }
  function saveRoute() { hideRouteUndo(); store.set(KEY_ROUTE, state.route); }
  $('#routeUndoBtn').addEventListener('click', function () {
    if (!routeUndoPrev) return;
    var prev = routeUndoPrev;
    state.route.ids = prev.ids.slice(); state.route.manual = prev.manual;
    saveRoute(); renderAll();
    setTimeout(fitRoute, 40);
    focusRouteAt(0);
  });
  function toggleRoute(id) {
    var ids = state.route.ids, i = ids.indexOf(id);
    if (i !== -1) ids.splice(i, 1);
    else {
      if (ids.length >= 5 || !BY_ID[id].mappable) return;
      ids.push(id);
      if (!state.route.manual) state.route.ids = nearestOrder(ids);
    }
    saveRoute();
    renderAll();
    flashRouteTab();
    if (i === -1) fitRoute(); // 路線加到第 2 站以上時，地圖框到整條路線
  }
  function flashRouteTab() {
    var t = $('#tab-route'); t.classList.remove('flash'); void t.offsetWidth; t.classList.add('flash');
  }
  function moveStop(i, dir) {
    var ids = state.route.ids, j = i + dir;
    if (j < 0 || j >= ids.length) return;
    var tmp = ids[i]; ids[i] = ids[j]; ids[j] = tmp;
    state.route.manual = true;
    saveRoute(); renderAll();
    var btn = $('#routeList [data-move="' + dir + '"][data-i="' + j + '"]') || $('#routeList [data-i="' + j + '"]');
    if (btn && !btn.disabled) btn.focus();
  }
  function gmapsUrl(points) {
    var o = points[0], d = points[points.length - 1];
    var url = 'https://www.google.com/maps/dir/?api=1&travelmode=walking&origin=' + o[0] + ',' + o[1] + '&destination=' + d[0] + ',' + d[1];
    if (points.length > 2) url += '&waypoints=' + points.slice(1, -1).map(function (p) { return p[0] + ',' + p[1]; }).join('%7C');
    return url;
  }
  /* 路線站名下的小字：地區欄和站名重複時（例：明治神宮外苑・銀杏並木），改用地區分類名稱 */
  function stopSub(p) {
    if (p.sheet.area && p.sheet.area !== p.title) return p.sheet.area;
    var r = REGIONS.filter(function (x) { return x.key === p.region; })[0];
    return r ? r.name : '';
  }
  function renderRoute() {
    var ids = state.route.ids, n = ids.length;
    $('#routeCount').textContent = n + ' / 5';
    $('#routeTabCount').textContent = n;
    var listHtml = '', total = 0;
    ids.forEach(function (id, i) {
      var p = BY_ID[id];
      if (i > 0) {
        var d = haversine(BY_ID[ids[i - 1]], p); total += d;
        listHtml += '<li class="leg" aria-hidden="false"><span class="leg-line" aria-hidden="true"></span><span>直線 ' + fmtDist(d) + '・步行' + fmtWalk(d) + '（估算）' + (d > 5000 ? '<em>直線距離超過 5 km，步行較遠</em>' : '') + '</span></li>';
      }
      listHtml += '<li class="stop" data-id="' + id + '"><span class="stop-num">' + (i + 1) + '</span>' +
        '<span class="stop-text"><span class="stop-title">' + esc(p.title) + '</span><span class="stop-sub">' + esc(stopSub(p)) + '</span></span>' +
        '<span class="stop-ctrl">' +
          '<button type="button" class="icon-btn" data-move="-1" data-i="' + i + '" aria-label="把 ' + esc(p.title) + ' 往前移"' + (i === 0 ? ' disabled' : '') + '>' + ICON.up + '</button>' +
          '<button type="button" class="icon-btn" data-move="1" data-i="' + i + '" aria-label="把 ' + esc(p.title) + ' 往後移"' + (i === n - 1 ? ' disabled' : '') + '>' + ICON.down + '</button>' +
          '<button type="button" class="icon-btn" data-remove="' + id + '" aria-label="從路線移除 ' + esc(p.title) + '">' + ICON.x + '</button>' +
        '</span></li>';
    });
    $('#routeList').innerHTML = listHtml;

    var empty = $('#routeEmpty'), sum = $('#routeSummary'), nav = $('#routeNav');
    if (n < 2) {
      empty.hidden = false;
      empty.innerHTML = n === 0
        ? '<p class="empty-title" tabindex="-1">路線還是空的</p><p>在清單或地圖上按「加入路線」，至少選 2 個景點就能看到距離與步行時間。</p><button type="button" class="btn-text" data-goto="list">去清單挑景點</button>'
        : '<p class="empty-title" tabindex="-1">再選 1 個景點</p><p>路線需要 2 至 5 個有座標的景點。</p><button type="button" class="btn-text" data-goto="list">去清單挑景點</button>';
      sum.hidden = true;
      nav.setAttribute('aria-disabled', 'true'); nav.setAttribute('href', '#'); nav.setAttribute('tabindex', '-1');
    } else {
      empty.hidden = true; empty.innerHTML = '';
      sum.hidden = false;
      sum.innerHTML = '<div><span class="sum-label">總直線距離</span><span class="sum-val">' + fmtDist(total) + '</span></div>' +
        '<div><span class="sum-label">步行時間估算</span><span class="sum-val">' + fmtWalk(total) + '</span></div>' +
        '<p class="sum-note">依直線距離估算（每分鐘 80 m），' + (state.route.manual ? '目前為手動順序。' : '目前為自動排序（從第 1 站起依最近距離）。') + '</p>';
      nav.setAttribute('aria-disabled', 'false'); nav.removeAttribute('tabindex');
      nav.setAttribute('href', gmapsUrl(ids.map(function (id) { return [BY_ID[id].lat, BY_ID[id].lng]; })));
    }
    $('#routeSort').disabled = n < 3;
    $('#routeClear').disabled = n === 0;
    $('#routeOnMap').disabled = n < 2;
  }
  $('#routeList').addEventListener('click', function (e) {
    var mv = e.target.closest('[data-move]'), rm = e.target.closest('[data-remove]');
    if (mv) moveStop(parseInt(mv.getAttribute('data-i'), 10), parseInt(mv.getAttribute('data-move'), 10));
    else if (rm) {
      var ri = state.route.ids.indexOf(rm.getAttribute('data-remove'));
      toggleRoute(rm.getAttribute('data-remove'));
      focusRouteAt(ri);
    }
  });
  $('#routeSort').addEventListener('click', function () {
    state.route.ids = nearestOrder(state.route.ids); state.route.manual = false; saveRoute(); renderAll();
  });
  $('#routeOnMap').addEventListener('click', function () {
    if (isMobile()) setTab('map');
    setTimeout(fitRoute, 40);
  });
  $('#routeClear').addEventListener('click', function () {
    state.route.ids = []; state.route.manual = false; saveRoute(); renderAll();
    focusRouteAt(0);
  });
  $('#routeNav').addEventListener('click', function (e) {
    if (this.getAttribute('aria-disabled') === 'true') e.preventDefault();
  });

  /* =========================================================
   * 10. 分頁（手機：地圖／清單／路線；桌機：地圖常駐）
   * ======================================================= */
  var mq = window.matchMedia('(min-width: 960px)');
  function isMobile() { return !mq.matches; }
  function smooth() { return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'; }
  /* 手機：切換分頁時，若已捲過分頁列，就回到分頁列頂端，讓新內容出現在畫面上 */
  function scrollToPanes() {
    var a = $('#paneAnchor'); if (!a || !isMobile()) return;
    var top = a.getBoundingClientRect().top;
    if (top < 0) window.scrollTo({ top: top + window.pageYOffset, behavior: smooth() });
  }
  function setTab(tab, noScroll) {
    if (!isMobile() && tab === 'map') tab = state.tab === 'route' ? 'route' : 'list';
    state.tab = tab;
    var grid = $('.explore-grid');
    grid.setAttribute('data-tab', tab);
    ['map', 'list', 'route'].forEach(function (t) {
      var b = $('#tab-' + t);
      b.setAttribute('aria-selected', String(t === tab));
      b.setAttribute('tabindex', t === tab ? '0' : '-1');
    });
    if (map) setTimeout(mapShown, 30);
    if (!noScroll) scrollToPanes();
  }
  /* 版面跨過桌機／手機斷點後，地圖下次顯示時重新框景點（有 2 站以上路線就框路線）；
   * 地圖隱藏（0×0）時先略過；使用者正開著某個景點的說明時，只把該景點留在畫面中 */
  var needsRefit = false;
  /* 地圖上次框景點時的大小；之後大小變動超過約 25% 或橫直轉向，下次看得到地圖時就重新框 */
  var fitSize = null;
  function noteFitSize() {
    var c = map.getContainer();
    if (c.offsetWidth && c.offsetHeight) fitSize = { w: c.offsetWidth, h: c.offsetHeight };
  }
  function bigSizeChange(w, h) {
    if (!fitSize) return true;
    return Math.abs(w - fitSize.w) > fitSize.w * 0.25 || Math.abs(h - fitSize.h) > fitSize.h * 0.25 || (w > h) !== (fitSize.w > fitSize.h);
  }
  /* 不讓 Leaflet 自己跟著視窗調整（隱藏時會記成 0×0）；改由這裡觀察地圖框，0×0 時略過 */
  function watchMapSize() {
    var c = map.getContainer();
    if (window.ResizeObserver) new ResizeObserver(function () { mapShown(); }).observe(c);
    else { var t; window.addEventListener('resize', function () { clearTimeout(t); t = setTimeout(mapShown, 100); }); }
  }
  function mapShown() {
    if (!map) return;
    var c = map.getContainer(), w = c.offsetWidth, h = c.offsetHeight; if (!w || !h) return;
    map.invalidateSize();
    if (bigSizeChange(w, h)) needsRefit = true;
    if (!needsRefit) return;
    needsRefit = false;
    var pop = map._popup, src = pop && map.hasLayer(pop) ? pop._source : null;
    if (src && markerLayer.hasLayer(src)) { map.panTo(src.getLatLng(), { animate: false }); popupIntoView(pop); noteFitSize(); return; }
    if (state.route.ids.length >= 2) fitRoute(); else fitVisible(true);
  }
  /* 景點置中後，說明框可能比上半張地圖高（例如轉成橫向）；依說明框自己的留白再移一點，讓整個說明框都看得到 */
  function popupIntoView(pop) {
    var el = pop.getElement(); if (!el) return;
    var cr = map.getContainer().getBoundingClientRect(), pr = el.getBoundingClientRect(), o = pop.options;
    var tl = L.point(o.autoPanPaddingTopLeft || o.autoPanPadding), br = L.point(o.autoPanPaddingBottomRight || o.autoPanPadding);
    var dx = 0, dy = 0;
    if (pr.right + br.x > cr.right) dx = pr.right + br.x - cr.right;
    if (pr.left - tl.x < cr.left) dx = pr.left - tl.x - cr.left;
    if (pr.bottom + br.y > cr.bottom) dy = pr.bottom + br.y - cr.bottom;
    if (pr.top - tl.y < cr.top) dy = pr.top - tl.y - cr.top;
    if (dx || dy) map.panBy([Math.round(dx), Math.round(dy)], { animate: false });
  }
  /* 使用者切換分頁：桌機開「路線」、手機開「地圖」時，若路線已有 2 站以上，就把地圖框到路線 */
  function userTab(t) {
    setTab(t);
    if ((t === 'route' && !isMobile()) || (t === 'map' && isMobile())) setTimeout(fitRoute, 40);
  }
  function initTabs() {
    ['map', 'list', 'route'].forEach(function (t) {
      $('#tab-' + t).addEventListener('click', function () { userTab(t); });
    });
    $('.tabs').addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      var tabs = isMobile() ? ['map', 'list', 'route'] : ['list', 'route'];
      var i = tabs.indexOf(state.tab) + (e.key === 'ArrowRight' ? 1 : -1);
      var t = tabs[(i + tabs.length) % tabs.length]; userTab(t); $('#tab-' + t).focus(); e.preventDefault();
    });
    document.addEventListener('click', function (e) {
      var g = e.target.closest('[data-goto]'); if (!g) return;
      setTab(g.getAttribute('data-goto'));
      var tb = $('#tab-' + state.tab); if (tb) focusEl(tb);
    });
    var onChange = function () { needsRefit = true; setTab(state.tab, true); };
    if (mq.addEventListener) mq.addEventListener('change', onChange); else if (mq.addListener) mq.addListener(onChange);
    setTab(isMobile() && map ? 'map' : 'list', true);
    if (map) setTimeout(function () { map.invalidateSize(); fitVisible(true); }, 60);
  }

  /* =========================================================
   * 11. 散步提案
   * ======================================================= */
  function renderWalks() {
    $('#walkList').innerHTML = WALKS.map(function (w) {
      var p = BY_ID[w.place];
      var acts = '<button type="button" class="btn btn-line-dark" data-walk-map="' + w.place + '">' + ICON.pin + '在地圖上看</button>';
      if (w.load) acts += '<button type="button" class="btn btn-forest" data-walk-load="' + w.no + '">' + ICON.route + '載入到路線（' + w.load.length + ' 站）</button>';
      if (w.gmaps) acts += '<a class="btn btn-line-dark" href="' + esc(gmapsUrl([w.gmaps.from, w.gmaps.to])) + '" target="_blank" rel="noopener">' + ICON.walk + esc(w.gmaps.label) + '</a>';
      return '<article class="walk">' +
        '<div class="walk-no" aria-hidden="true">' + w.no + '</div>' +
        '<div class="walk-body">' +
          '<header><p class="walk-area">' + esc(w.area) + '</p><h3>' + esc(w.title) + '</h3></header>' +
          '<ol class="walk-steps">' + w.steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol>' +
          '<p class="walk-combo">' + esc(w.combo) + '</p>' +
          '<ul class="walk-notes">' + w.notes.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul>' +
          '<p class="walk-links">' + w.links.map(function (l) { return '<a href="' + esc(l[1]) + '" target="_blank" rel="noopener">' + esc(l[0]) + ICON.ext + '</a>'; }).join('') + '</p>' +
          '<div class="walk-actions">' + acts + '</div>' +
        '</div></article>';
    }).join('');
    $('#walkList').addEventListener('click', function (e) {
      var m = e.target.closest('[data-walk-map]'), l = e.target.closest('[data-walk-load]');
      if (m) {
        var id = m.getAttribute('data-walk-map');
        goExplore(); selectPlace(id, { pan: true, from: 'list', showMap: true });
      } else if (l) {
        var w = WALKS.filter(function (x) { return x.no === l.getAttribute('data-walk-load'); })[0];
        var prevIds = state.route.ids.slice(), prevManual = state.route.manual;
        state.route.ids = w.load.slice(0, 5); state.route.manual = false;
        state.route.ids = nearestOrder(state.route.ids);
        saveRoute(); renderAll();
        if (prevIds.length && prevIds.join('|') !== state.route.ids.join('|')) {
          routeUndoPrev = { ids: prevIds, manual: prevManual };
          $('#routeUndoText').textContent = '已用散步提案取代原本的 ' + prevIds.length + ' 站路線。';
          $('#routeUndo').hidden = false;
        }
        goExplore(); setTab('route');
        setTimeout(fitRoute, 40);
      }
    });
  }
  function goExplore() {
    var t = isMobile() ? $('#paneAnchor') : $('#explore'); if (t) t.scrollIntoView({ block: 'start', behavior: smooth() });
  }

  /* =========================================================
   * 12. 整體更新
   * ======================================================= */
  function renderAll() {
    var list = visiblePlaces();
    $all('.chip', groupChips).forEach(function (c) {
      var on = c.getAttribute('data-group') === state.group;
      c.setAttribute('aria-checked', String(on)); c.classList.toggle('is-on', on);
      c.setAttribute('tabindex', on ? '0' : '-1');
    });
    var fb = $('#favOnly');
    fb.setAttribute('aria-pressed', String(state.favOnly));
    $('#favCount').textContent = state.favs.length;
    renderList(list);
    renderMarkers(list);
    renderRoute();
    renderRouteLine(list);
    if (map) map.eachLayer(function (layer) {
      if (layer.getPopup && layer.getPopup() && layer.isPopupOpen && layer.isPopupOpen()) {
        var pid = null; Object.keys(markers).forEach(function (k) { if (markers[k] === layer) pid = k; });
        if (pid) layer.setPopupContent(popupHtml(BY_ID[pid]));
      }
    });
  }

  /* =========================================================
   * 13. 啟動
   * ======================================================= */
  $('#factMapped').textContent = PLACES.filter(function (p) { return p.mappable; }).length;
  $('#factWalks').textContent = WALKS.length;
  initSeason();
  initFilters();
  initMap();
  initTabs();
  renderWalks();
  renderSeason();
  renderAll();
})();
