/* 東京銀杏散步圖 — 介面程式（純 JavaScript，無框架、無後端） */
(function () {
  'use strict';

  var DATA = window.GINKGO_DATA;
  if (!DATA) { return; }

  /* ---------- 介面文字（三語） ---------- */
  var T = {
    zh: {
      htmlLang: 'zh-Hant-TW',
      skip: '跳到主要內容', siteTitle: '東京銀杏散步圖', langLabel: '語言', navLabel: '主要導覽',
      navSpots: '景點', navStatus: '葉況流程', navWalk: '散步順序', navCheck: '行前查核', navSources: '來源',
      introEyebrow: '東京・2026 秋季',
      introLede: '整理東京各地區的銀杏景點、具日期的官方或在地葉況觀測，以及分區散步順序與出發前查核事項。',
      factSpots: '收錄景點', factStatus: '本季葉況', factChecked: '資料核對',
      introNote: '截至核對日，沒有任何列出景點具備「銀杏樹種、特定地點、觀測日期」且屬於現場觀測的 2026 資料，因此全部顯示「尚無回報」，不推測葉況。',
      spotsTitle: '景點與分區',
      spotsLede: '點選分區示意圖或使用下方篩選，比較各景點的地區、葉況、最新回報日期與官方來源。點選景點可開啟資料視窗。',
      mapLabel: '示意圖，非比例地圖', mapHint: '分區為本站自訂、只供辨識地區；點選分區即可篩選景點。',
      bay: '東京灣（示意）',
      searchLabel: '搜尋景點名稱', searchPh: '例：新宿、Hibiya、昭和', areaLabel: '地區', allAreas: '全部地區', clear: '清除篩選',
      count: '顯示 {n} / {t} 處景點', empty: '沒有符合條件的景點。請換個關鍵字或清除篩選。',
      colSpot: '景點', colStatus: '當季葉況', colLatest: '最新回報', colSource: '官方來源',
      noReport: '尚無回報', no2026: '無符合條件的回報', photoUpdate: '官方照片 {d}・未描述階段',
      officialSite: '官方網站', openDetail: '查看資料', spotsUnit: '處',
      areaWards: '{a}：{w}', areaAllWards: '目前顯示全部地區。',
      statusTitle: '銀杏狀態流程',
      statusLede: '葉況依六個階段描述。只有同時具備銀杏樹種、特定地點與觀測日期，且明確屬於現場觀測的資料，才會標上階段。',
      stages: ['青葉', '開始轉色', '黃葉進行', '見頃', '開始落葉', '落葉'],
      stageDesc: ['葉片仍是綠色', '部分葉片開始變黃', '黃色的比例持續增加', '整體轉黃，最適合觀賞', '葉片開始掉落', '大部分葉片已落下'],
      noReportDesc: '沒有符合條件的當季資料時顯示。截至 2026-10-02，本站所有景點都是這個狀態。',
      rulesTitle: '資料品質規則',
      rule1: '景點葉況只採用同時具備「銀杏樹種、特定地點、觀測日期」且明確屬於現場觀測的資料。',
      rule2: '舊資料、預報、其他樹種、東京標本木的狀態，不可代替個別景點葉況。',
      rule3: '每個葉況項目都保留資料日期、資料性質與可點擊的來源。',
      rule4: '輔助來源（氣象廳標本木、GO TOKYO、tenki.jp、Weathernews）只用於找景點或連到預報，不當作個別景點的現場觀測。',
      walkTitle: '分區散步順序', walkLede: '選擇一個地區，產生該區景點的建議造訪順序。',
      walkDisclaimer: '這是靜態散步建議，不是即時導航，不提供即時路況或步行時間。',
      walkPick: '選擇地區', walkLogicTitle: '排序方式',
      walkLogic: '從該區最北的景點開始，每一步接往直線上最近、尚未排入的景點。計算只使用各景點的近似代表座標，結果不是實際步行路線，也不顯示任何距離或時間。',
      walkAreaNote: '{a}包含：{w}。', walkOne: '此區只有一處景點，因此沒有排序。', walkStop: '第 {n} 站',
      checkTitle: '行前查核清單', checkLede: '選擇景點後，逐項查看查核結果、引用來源與本次核對日期。',
      checkDisclaimer: '行前資訊容易變動。本頁列出的是查核日期與來源，不保證查核日之後仍有效；請在行程當日回到官方來源再次確認。',
      checkPick: '選擇景點', commonOpt: '全部共通（不分景點）',
      thItem: '項目', thResult: '查核結果', thMark: '狀態', thSource: '引用來源', thDate: '核對日期',
      checkCaption: '行前查核清單：{s}',
      items: { leaf: '葉況', hours: '開園與休園', access: '交通', weather: '天氣', wear: '穿著', crowd: '人潮', event: '活動', rules: '入園規定', contact: '官方聯絡資訊' },
      mark: { ok: '已核對', part: '部分待確認', tbc: '待確認', per: '依景點' },
      legend: '已核對＝官方頁面已確認；待確認＝未能核實，請看官方連結；部分待確認＝其中一部分未能核實。',
      perSpot: '因景點而異，請在上方選擇景點；各景點的官方網址列於來源資料表。',
      commonLeaf: '本次查核（2026-10-01 BRIEF、2026-10-02 官方頁面）未找到任何列出景點符合條件的 2026 銀杏現場葉況，全部顯示「尚無回報」。',
      commonCrowd: '各官方網站皆未公布即時或預估人潮。',
      leafResult: '尚無回報。{n}',
      sourcesTitle: '資料來源', sourcesLede: '來源依性質分為三類。所有連結都會在新分頁開啟官方或原始頁面。',
      srcOfficial: '官方或在地觀測', srcOfficialDesc: '園區管理單位或在地機構發布的資料。只有附日期、指明銀杏與地點的現場觀測，才會用於景點葉況。',
      srcAux: '輔助資訊', srcAuxDesc: '可用於找景點或查看預報，不是個別景點的官方現場觀測。',
      srcSheet: '原始資料表', srcSheetDesc: '本站景點與來源分級的依據。',
      gradesTitle: '來源分級（資料表）',
      gradeO: 'O：氣象廳觀測站（標本木）尺度', gradeT: 'T：第三方整合平台',
      footer: '僅供教學使用、非營利、非即時導航',
      footerSmall: '資料來自老師指定資料表與各官方網站，核對日期 2026-10-01（BRIEF）與 2026-10-02。分區圖為示意圖，非比例地圖。',
      close: '關閉', gradeShort: '等級', grade: '來源等級', area: '地區',
      fLeaf: '當季葉況及日期', fHours: '開園與休園', fAccess: '交通', fWeather: '天氣', fEventCrowd: '活動／人潮', fRules: '入園規定', fContact: '官方聯絡資訊',
      subEvent: '活動', subCrowd: '人潮',
      dataDate: '資料日期', dataNature: '資料性質', source: '來源', checked: '核對日期',
      noDate: '無（2026 尚無符合條件的資料）',
      history: '過去紀錄（只供參考，不是今年葉況）',
      ginkgoWhere: '銀杏所在', proof: '銀杏證明',
      srcLink: '來源 {n}'
    },
    en: {
      htmlLang: 'en',
      skip: 'Skip to main content', siteTitle: 'Tokyo Ginkgo Walking Map', langLabel: 'Language', navLabel: 'Main navigation',
      navSpots: 'Spots', navStatus: 'Leaf stages', navWalk: 'Walking order', navCheck: 'Pre-trip checks', navSources: 'Sources',
      introEyebrow: 'Tokyo · Autumn 2026',
      introLede: 'Ginkgo spots across Tokyo\'s areas, dated official or local leaf observations, suggested walking orders by area, and checks to make before you set out.',
      factSpots: 'Spots listed', factStatus: 'Leaf status this season', factChecked: 'Data checked',
      introNote: 'As of the check dates, no listed spot has 2026 data that names the ginkgo species, a specific place and an observation date as an on-site observation. Every spot therefore shows "No report yet"; nothing is inferred.',
      spotsTitle: 'Spots and areas',
      spotsLede: 'Click an area on the schematic or use the filters to compare each spot\'s area, leaf status, latest report date and official source. Select a spot to open its details.',
      mapLabel: 'Schematic, not to scale', mapHint: 'Areas are this site\'s own grouping, for orientation only. Click an area to filter the spots.',
      bay: 'Tokyo Bay (schematic)',
      searchLabel: 'Search by spot name', searchPh: 'e.g. Shinjuku, 日比谷, Showa', areaLabel: 'Area', allAreas: 'All areas', clear: 'Clear filters',
      count: 'Showing {n} of {t} spots', empty: 'No spots match. Try another keyword or clear the filters.',
      colSpot: 'Spot', colStatus: 'Leaf status', colLatest: 'Latest report', colSource: 'Official source',
      noReport: 'No report yet', no2026: 'None that qualifies', photoUpdate: 'Official photos {d} · no stage stated',
      officialSite: 'Official site', openDetail: 'View details', spotsUnit: 'spots',
      areaWards: '{a}: {w}', areaAllWards: 'Showing all areas.',
      statusTitle: 'Ginkgo leaf stages',
      statusLede: 'Leaf status follows six stages. A stage is shown only for data that names the ginkgo species, a specific place and an observation date, and is clearly an on-site observation.',
      stages: ['Green', 'Starting to turn', 'Turning yellow', 'Peak', 'Starting to fall', 'Fallen'],
      stageDesc: ['Leaves are still green', 'Some leaves begin to yellow', 'The share of yellow keeps growing', 'Fully yellow, best for viewing', 'Leaves begin to drop', 'Most leaves have fallen'],
      noReportDesc: 'Shown when no qualifying data exists for this season. As of 2026-10-02, every spot on this site is in this state.',
      rulesTitle: 'Data quality rules',
      rule1: 'A spot\'s leaf status uses only data that names the ginkgo species, a specific place and an observation date, and is clearly an on-site observation.',
      rule2: 'Old data, forecasts, other tree species and the Tokyo specimen tree never stand in for a spot\'s status.',
      rule3: 'Every leaf-status item keeps its data date, the nature of the data and a clickable source.',
      rule4: 'Auxiliary sources (JMA specimen tree, GO TOKYO, tenki.jp, Weathernews) are used only to find spots or link to forecasts, never as a spot\'s on-site observation.',
      walkTitle: 'Walking order by area', walkLede: 'Pick an area to generate a suggested visiting order for its spots.',
      walkDisclaimer: 'This is a static walking suggestion, not live navigation. It gives no live traffic and no walking times.',
      walkPick: 'Choose an area', walkLogicTitle: 'How the order is made',
      walkLogic: 'Start at the northernmost spot in the area, then go each time to the nearest spot not yet listed, by straight line. Only approximate representative coordinates are used; the result is not a walking route and shows no distances or times.',
      walkAreaNote: '{a} covers: {w}.', walkOne: 'This area has a single spot, so there is no order to compute.', walkStop: 'Stop {n}',
      checkTitle: 'Pre-trip checklist', checkLede: 'Pick a spot to see each item\'s check result, cited source and check date.',
      checkDisclaimer: 'Pre-trip information changes easily. This page lists check dates and sources and does not guarantee anything after the check date. On the day of your trip, confirm again at the official source.',
      checkPick: 'Choose a spot', commonOpt: 'All spots (common items)',
      thItem: 'Item', thResult: 'Check result', thMark: 'Status', thSource: 'Cited source', thDate: 'Check date',
      checkCaption: 'Pre-trip checklist: {s}',
      items: { leaf: 'Leaf status', hours: 'Opening and closing', access: 'Access', weather: 'Weather', wear: 'Clothing', crowd: 'Crowds', event: 'Events', rules: 'Admission rules', contact: 'Official contact' },
      mark: { ok: 'Confirmed', part: 'Partly to be confirmed', tbc: 'To be confirmed', per: 'Varies by spot' },
      legend: 'Confirmed = checked on an official page. To be confirmed = could not be verified; see the official link. Partly to be confirmed = part of the item could not be verified.',
      perSpot: 'Varies by spot; choose a spot above. Each spot\'s official site is listed in the source sheet.',
      commonLeaf: 'This check (BRIEF 2026-10-01, official pages 2026-10-02) found no qualifying 2026 on-site ginkgo status for any listed spot, so all show "No report yet".',
      commonCrowd: 'No official site publishes live or forecast crowd levels.',
      leafResult: 'No report yet. {n}',
      sourcesTitle: 'Sources', sourcesLede: 'Sources fall into three groups. Every link opens the official or original page in a new tab.',
      srcOfficial: 'Official or local observations', srcOfficialDesc: 'Published by park managers or local bodies. Only dated on-site observations that name ginkgo and a place are used for a spot\'s status.',
      srcAux: 'Auxiliary information', srcAuxDesc: 'Useful for finding spots or viewing forecasts; not official on-site observations of any spot.',
      srcSheet: 'Original data sheet', srcSheetDesc: 'The basis for this site\'s spots and source grades.',
      gradesTitle: 'Source grades (data sheet)',
      gradeO: 'O: JMA observation-station (specimen tree) scale', gradeT: 'T: third-party aggregator',
      footer: 'For teaching use only · Non-profit · Not real-time navigation',
      footerSmall: 'Data from the assigned source sheet and official websites, checked 2026-10-01 (BRIEF) and 2026-10-02. The area map is a schematic, not to scale.',
      close: 'Close', gradeShort: 'Grade', grade: 'Source grade', area: 'Area',
      fLeaf: 'Leaf status and date', fHours: 'Opening and closing', fAccess: 'Access', fWeather: 'Weather', fEventCrowd: 'Events / crowds', fRules: 'Admission rules', fContact: 'Official contact',
      subEvent: 'Events', subCrowd: 'Crowds',
      dataDate: 'Data date', dataNature: 'Nature of data', source: 'Source', checked: 'Check date',
      noDate: 'None (no qualifying 2026 data)',
      history: 'Past records (reference only, not this year\'s status)',
      ginkgoWhere: 'Where the ginkgo are', proof: 'Ginkgo proof',
      srcLink: 'Source {n}'
    },
    ja: {
      htmlLang: 'ja',
      skip: '本文へ移動', siteTitle: '東京イチョウ散歩マップ', langLabel: '言語', navLabel: 'メインナビゲーション',
      navSpots: 'スポット', navStatus: '葉の段階', navWalk: '散歩の順番', navCheck: '出発前チェック', navSources: '情報源',
      introEyebrow: '東京・2026年秋',
      introLede: '東京各地のイチョウの名所、日付のある公式・地元の葉の観測、エリア別の散歩の順番、出発前の確認事項をまとめました。',
      factSpots: '掲載スポット', factStatus: '今季の葉況', factChecked: 'データ確認日',
      introNote: '確認日時点で、「イチョウ・特定の場所・観測日」がそろった現地観測の2026年データがあるスポットはありません。そのため全スポットを「報告なし」と表示し、葉況は推定しません。',
      spotsTitle: 'スポットとエリア',
      spotsLede: 'エリア図をクリックするか下の絞り込みを使い、各スポットのエリア・葉況・最新の報告日・公式情報源を比べられます。スポットを選ぶと詳細を表示します。',
      mapLabel: '模式図（縮尺は正確ではありません）', mapHint: 'エリア分けは本サイト独自の目安です。エリアをクリックするとスポットを絞り込みます。',
      bay: '東京湾（模式）',
      searchLabel: 'スポット名で検索', searchPh: '例：新宿、Hibiya、昭和', areaLabel: 'エリア', allAreas: 'すべてのエリア', clear: '絞り込みを解除',
      count: '{t}件中 {n}件を表示', empty: '条件に合うスポットはありません。別のキーワードを試すか、絞り込みを解除してください。',
      colSpot: 'スポット', colStatus: '今季の葉況', colLatest: '最新の報告', colSource: '公式情報源',
      noReport: '報告なし', no2026: '該当する報告なし', photoUpdate: '公式写真 {d}・段階の記載なし',
      officialSite: '公式サイト', openDetail: '詳細を見る', spotsUnit: '件',
      areaWards: '{a}：{w}', areaAllWards: 'すべてのエリアを表示中。',
      statusTitle: 'イチョウの段階',
      statusLede: '葉況は6つの段階で表します。イチョウ・特定の場所・観測日がそろい、明らかに現地観測であるデータにだけ段階を付けます。',
      stages: ['青葉', '色づき始め', '黄葉進行', '見頃', '落葉始め', '落葉'],
      stageDesc: ['葉はまだ緑', '一部の葉が黄色くなり始める', '黄色の割合が増えていく', '全体が黄色、見頃', '葉が落ち始める', 'ほとんどの葉が落ちた'],
      noReportDesc: '今季の条件を満たすデータがないときに表示します。2026年10月2日時点で、本サイトの全スポットがこの状態です。',
      rulesTitle: 'データ品質のルール',
      rule1: 'スポットの葉況には「イチョウ・特定の場所・観測日」がそろい、明らかに現地観測であるデータだけを使います。',
      rule2: '古いデータ、予想、他の樹種、東京の標本木の状態をスポットの葉況の代わりにしません。',
      rule3: '葉況の各項目にデータの日付・データの性質・クリックできる情報源を残します。',
      rule4: '補助情報（気象庁の標本木、GO TOKYO、tenki.jp、ウェザーニュース）はスポット探しや予想へのリンクにだけ使い、スポットの現地観測としては扱いません。',
      walkTitle: 'エリア別の散歩の順番', walkLede: 'エリアを選ぶと、そのエリアのスポットを回るおすすめの順番を作ります。',
      walkDisclaimer: 'これは静的な散歩の提案で、リアルタイムのナビではありません。リアルタイムの道路状況や徒歩時間は提供しません。',
      walkPick: 'エリアを選ぶ', walkLogicTitle: '順番の決め方',
      walkLogic: 'エリア内で最も北のスポットから始め、毎回まだ並べていないスポットのうち直線で最も近いものへ進みます。各スポットのおおよその代表座標だけで計算するため、実際の徒歩ルートではなく、距離や時間も表示しません。',
      walkAreaNote: '{a}の範囲：{w}。', walkOne: 'このエリアのスポットは1件のため、順番はありません。', walkStop: '{n}番目',
      checkTitle: '出発前チェックリスト', checkLede: 'スポットを選ぶと、項目ごとに確認結果・引用元・確認日を表示します。',
      checkDisclaimer: '出発前の情報は変わりやすいものです。このページは確認日と情報源を示すもので、確認日以降も有効とは限りません。当日、公式情報源で改めてご確認ください。',
      checkPick: 'スポットを選ぶ', commonOpt: '全スポット共通',
      thItem: '項目', thResult: '確認結果', thMark: '状態', thSource: '引用元', thDate: '確認日',
      checkCaption: '出発前チェックリスト：{s}',
      items: { leaf: '葉況', hours: '開園・休園', access: '交通', weather: '天気', wear: '服装', crowd: '混雑', event: 'イベント', rules: '入園のきまり', contact: '公式の連絡先' },
      mark: { ok: '確認済み', part: '一部要確認', tbc: '要確認', per: 'スポットによる' },
      legend: '確認済み＝公式ページで確認。要確認＝確認できなかったため公式リンクを参照。一部要確認＝一部が確認できていない項目。',
      perSpot: 'スポットによって異なります。上でスポットを選んでください。各スポットの公式サイトはソース表に掲載しています。',
      commonLeaf: '今回の確認（BRIEF 2026-10-01、公式ページ 2026-10-02）では、掲載スポットの条件を満たす2026年のイチョウ現地観測は見つからず、すべて「報告なし」です。',
      commonCrowd: 'どの公式サイトもリアルタイム・予想の混雑情報を公開していません。',
      leafResult: '報告なし。{n}',
      sourcesTitle: '情報源', sourcesLede: '情報源を性質ごとに3つに分けています。リンクはすべて新しいタブで公式・元のページを開きます。',
      srcOfficial: '公式・地元の観測', srcOfficialDesc: '公園の管理者や地元団体が出す情報。日付があり、イチョウと場所を明記した現地観測だけをスポットの葉況に使います。',
      srcAux: '補助情報', srcAuxDesc: 'スポット探しや予想の確認に使えますが、各スポットの公式な現地観測ではありません。',
      srcSheet: '元のデータ表', srcSheetDesc: '本サイトのスポットと情報源の等級の根拠です。',
      gradesTitle: '情報源の等級（データ表）',
      gradeO: 'O：気象庁の観測所（標本木）スケール', gradeT: 'T：第三者のまとめサイト',
      footer: '教育目的のみ・非営利・リアルタイムのナビではありません',
      footerSmall: 'データは指定ソース表と各公式サイトによるもので、確認日は2026-10-01（BRIEF）と2026-10-02です。エリア図は模式図で、縮尺は正確ではありません。',
      close: '閉じる', gradeShort: '等級', grade: '情報源の等級', area: 'エリア',
      fLeaf: '今季の葉況と日付', fHours: '開園・休園', fAccess: '交通', fWeather: '天気', fEventCrowd: 'イベント／混雑', fRules: '入園のきまり', fContact: '公式の連絡先',
      subEvent: 'イベント', subCrowd: '混雑',
      dataDate: 'データの日付', dataNature: 'データの性質', source: '情報源', checked: '確認日',
      noDate: 'なし（2026年の該当データなし）',
      history: '過去の記録（参考のみ、今年の葉況ではありません）',
      ginkgoWhere: 'イチョウの場所', proof: 'イチョウの根拠',
      srcLink: '情報源 {n}'
    }
  };

  /* ---------- 狀態 ---------- */
  var LANGS = ['zh', 'en', 'ja'];
  var state = { lang: 'zh', area: '', q: '', walkArea: 'toshin', checkId: '' };
  var lastFocus = null;

  function store(key, val) {
    try { if (val === undefined) { return window.localStorage.getItem(key); } window.localStorage.setItem(key, val); } catch (e) { /* 無法使用 localStorage 時忽略 */ }
    return null;
  }

  function t(key) { var v = T[state.lang][key]; return v === undefined ? T.zh[key] : v; }
  function fmt(s, o) { return String(s).replace(/\{(\w+)\}/g, function (m, k) { return o[k] !== undefined ? o[k] : m; }); }
  function L(obj) { return obj ? (obj[state.lang] || obj.zh) : ''; }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) { n.className = cls; }
    if (text !== undefined && text !== null) { n.textContent = text; }
    return n;
  }
  function $(id) { return document.getElementById(id); }
  // 日期、電話等以連字號相連的數字，不在連字號處換行
  var NUMRUN = /\d+(?:-\d+)+/g;
  function setText(node, str) {
    str = String(str === undefined || str === null ? '' : str);
    var last = 0, m;
    NUMRUN.lastIndex = 0;
    while ((m = NUMRUN.exec(str))) {
      if (m.index > last) { node.appendChild(document.createTextNode(str.slice(last, m.index))); }
      node.appendChild(el('span', 'nowrap', m[0]));
      last = m.index + m[0].length;
    }
    if (last < str.length) { node.appendChild(document.createTextNode(str.slice(last))); }
    return node;
  }
  function elD(tag, cls, text) { return setText(el(tag, cls), text); }

  var AREA_BY_ID = {};
  DATA.AREAS.forEach(function (a) { AREA_BY_ID[a.id] = a; });
  var SPOT_BY_ID = {};
  DATA.SPOTS.forEach(function (s) { SPOT_BY_ID[s.id] = s; });

  function hostOf(url) {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return url; }
  }
  function extLink(url, label, cls) {
    var a = el('a', cls || 'src', label || hostOf(url));
    a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
    return a;
  }

  /* ---------- 靜態文字 ---------- */
  function applyStatic() {
    document.documentElement.lang = t('htmlLang');
    document.title = t('siteTitle');
    document.querySelectorAll('[data-i18n]').forEach(function (n) { n.textContent = t(n.getAttribute('data-i18n')); });
    document.querySelectorAll('[data-i18n-ph]').forEach(function (n) { n.setAttribute('placeholder', t(n.getAttribute('data-i18n-ph'))); });
    document.querySelectorAll('[data-i18n-aria]').forEach(function (n) { n.setAttribute('aria-label', t(n.getAttribute('data-i18n-aria'))); });
    document.querySelectorAll('[data-i18n-svg]').forEach(function (n) { n.textContent = t(n.getAttribute('data-i18n-svg')); });
    document.querySelector('.brand').setAttribute('aria-label', t('siteTitle'));
    document.querySelectorAll('.lang__btn').forEach(function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-lang') === state.lang ? 'true' : 'false');
    });
    $('factCount').textContent = String(DATA.SPOTS.length);
  }

  /* ---------- 分區示意圖 ---------- */
  function countIn(areaId) { return DATA.SPOTS.filter(function (s) { return s.area === areaId; }).length; }

  function renderMap() {
    document.querySelectorAll('#areaMap .region').forEach(function (g) {
      var id = g.getAttribute('data-area');
      var a = AREA_BY_ID[id];
      var n = countIn(id);
      g.querySelector('.region__name').textContent = L(a.name);
      g.querySelector('.region__count').textContent = n + (state.lang === 'en' ? '' : ' ') + (state.lang === 'en' ? (n === 1 ? ' spot' : ' spots') : t('spotsUnit'));
      g.setAttribute('aria-label', L(a.name) + ' — ' + n + ' ' + t('spotsUnit'));
      var on = state.area === id;
      g.classList.toggle('is-selected', on);
      g.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    var w = $('areaWards');
    if (state.area) {
      var a = AREA_BY_ID[state.area];
      w.textContent = fmt(t('areaWards'), { a: L(a.name), w: L(a.wards) });
    } else {
      w.textContent = t('areaAllWards');
    }
  }

  function selectArea(id) {
    state.area = (state.area === id) ? '' : id;
    if (state.area) { state.walkArea = state.area; }
    $('areaSel').value = state.area;
    renderMap(); renderList(); renderWalk();
  }

  /* ---------- 篩選與清單 ---------- */
  function renderAreaSelect() {
    var sel = $('areaSel');
    sel.textContent = '';
    var o = el('option', null, t('allAreas')); o.value = ''; sel.appendChild(o);
    DATA.AREAS.forEach(function (a) {
      var op = el('option', null, L(a.name) + '（' + countIn(a.id) + '）');
      if (state.lang === 'en') { op.textContent = L(a.name) + ' (' + countIn(a.id) + ')'; }
      op.value = a.id; sel.appendChild(op);
    });
    sel.value = state.area;
  }

  function norm(s) { return String(s || '').toLowerCase().replace(/[\s・·\-‐－　]/g, ''); }

  function matches(s) {
    if (state.area && s.area !== state.area) { return false; }
    var q = norm(state.q);
    if (!q) { return true; }
    var hay = [s.name.zh, s.name.en, s.name.ja, s.id].join('|');
    return norm(hay).indexOf(q) !== -1;
  }

  function latestText(s) {
    if (s.leaf.date) { return fmt(t('photoUpdate'), { d: s.leaf.date }); }
    return t('no2026');
  }

  function renderList() {
    var ul = $('spotList');
    ul.textContent = '';
    var list = DATA.SPOTS.filter(matches);
    list.forEach(function (s) {
      var li = el('li', 'spotrow');
      var btn = el('button', 'spotrow__main');
      btn.type = 'button';
      btn.setAttribute('data-id', s.id);
      var nameBox = el('span', 'spotrow__name');
      nameBox.appendChild(el('span', 'spotrow__title', L(s.name)));
      var sub = el('span', 'spotrow__sub', L(AREA_BY_ID[s.area].name) + (s.name.ja !== L(s.name) ? ' · ' + s.name.ja : ''));
      nameBox.appendChild(sub);
      btn.appendChild(nameBox);
      var st = el('span', 'spotrow__status');
      st.appendChild(el('span', 'ring', null));
      st.appendChild(el('span', null, t('noReport')));
      btn.appendChild(st);
      btn.appendChild(elD('span', 'spotrow__latest', latestText(s)));
      var more = el('span', 'spotrow__more', t('openDetail'));
      btn.appendChild(more);
      btn.addEventListener('click', function () { openModal(s.id, btn); });
      li.appendChild(btn);
      var src = el('span', 'spotrow__src');
      src.appendChild(extLink(s.official, hostOf(s.official)));
      li.appendChild(src);
      ul.appendChild(li);
    });
    $('resultCount').textContent = fmt(t('count'), { n: list.length, t: DATA.SPOTS.length });
    $('emptyState').hidden = list.length !== 0;
    $('clearBtn').disabled = !state.area && !state.q;
  }

  function clearFilters() {
    state.area = ''; state.q = '';
    $('q').value = ''; $('areaSel').value = '';
    renderMap(); renderList();
  }

  /* ---------- 狀態流程 ---------- */
  var STAGE_CLASS = ['s1', 's2', 's3', 's4', 's5', 's6'];
  function renderFlow() {
    var ol = $('flow');
    ol.textContent = '';
    t('stages').forEach(function (name, i) {
      var li = el('li', 'flow__step ' + STAGE_CLASS[i]);
      // 階段標記：以該階段顏色繪製的銀杏葉（純裝飾）
      var dot = el('span', 'flow__dot', null);
      var svgNS = 'http://www.w3.org/2000/svg';
      var leaf = document.createElementNS(svgNS, 'svg');
      leaf.setAttribute('viewBox', '0 0 24 24');
      leaf.setAttribute('aria-hidden', 'true');
      leaf.setAttribute('focusable', 'false');
      leaf.setAttribute('class', 'flow__leaf');
      var lp = document.createElementNS(svgNS, 'path');
      lp.setAttribute('d', 'M12 21.5 V13.4 M12 13.4 C7.6 13.4 3.7 10.4 2.6 5.2 C5.6 3.5 9.2 3.7 11.3 6.3 L12 8.1 L12.7 6.3 C14.8 3.7 18.4 3.5 21.4 5.2 C20.3 10.4 16.4 13.4 12 13.4 Z');
      leaf.appendChild(lp);
      dot.appendChild(leaf);
      li.appendChild(dot);
      li.appendChild(el('span', 'flow__idx', String(i + 1).padStart(2, '0')));
      li.appendChild(el('span', 'flow__name', name));
      li.appendChild(el('span', 'flow__desc', t('stageDesc')[i]));
      ol.appendChild(li);
    });
  }

  /* ---------- 散步順序 ---------- */
  function orderSpots(areaId) {
    var pts = DATA.SPOTS.filter(function (s) { return s.area === areaId; }).slice();
    if (pts.length < 2) { return pts; }
    // 以最北（緯度最大）的景點為起點，之後每次接直線最近的景點（只用於排序，不顯示距離）
    pts.sort(function (a, b) { return b.ll[0] - a.ll[0]; });
    var out = [pts.shift()];
    var k = Math.cos(35.7 * Math.PI / 180);
    while (pts.length) {
      var cur = out[out.length - 1], best = 0, bd = Infinity;
      for (var i = 0; i < pts.length; i++) {
        var dy = pts[i].ll[0] - cur.ll[0], dx = (pts[i].ll[1] - cur.ll[1]) * k;
        var d = dy * dy + dx * dx;
        if (d < bd) { bd = d; best = i; }
      }
      out.push(pts.splice(best, 1)[0]);
    }
    return out;
  }

  function renderWalkTabs() {
    var row = $('walkTabs');
    row.textContent = '';
    DATA.AREAS.forEach(function (a) {
      var b = el('button', 'tab', L(a.name));
      b.type = 'button';
      b.setAttribute('data-area', a.id);
      b.setAttribute('aria-pressed', state.walkArea === a.id ? 'true' : 'false');
      b.addEventListener('click', function () {
        state.walkArea = a.id;
        renderWalkTabs(); renderWalk();
      });
      row.appendChild(b);
    });
  }

  function renderWalk() {
    document.querySelectorAll('#walkTabs .tab').forEach(function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-area') === state.walkArea ? 'true' : 'false');
    });
    var ol = $('walkList');
    ol.textContent = '';
    var seq = orderSpots(state.walkArea);
    seq.forEach(function (s, i) {
      var li = el('li', 'walkstep');
      li.appendChild(el('span', 'walkstep__no', String(i + 1).padStart(2, '0')));
      var body = el('div', 'walkstep__body');
      body.appendChild(el('span', 'walkstep__stop', fmt(t('walkStop'), { n: i + 1 })));
      body.appendChild(el('span', 'walkstep__name', L(s.name)));
      var meta = el('span', 'walkstep__meta');
      meta.appendChild(el('span', 'ring', null));
      meta.appendChild(document.createTextNode(t('noReport')));
      body.appendChild(meta);
      li.appendChild(body);
      var b = el('button', 'linkbtn walkstep__open', t('openDetail'));
      b.type = 'button';
      b.setAttribute('aria-label', t('openDetail') + '：' + L(s.name));
      b.addEventListener('click', function () { openModal(s.id, b); });
      li.appendChild(b);
      ol.appendChild(li);
    });
    var a = AREA_BY_ID[state.walkArea];
    var note = fmt(t('walkAreaNote'), { a: L(a.name), w: L(a.wards) });
    if (seq.length < 2) { note += ' ' + t('walkOne'); }
    $('walkArea').textContent = note;
    $('walkList').classList.toggle('is-single', seq.length < 2);
  }

  /* ---------- 行前查核 ---------- */
  var ITEMS = ['leaf', 'hours', 'access', 'weather', 'wear', 'crowd', 'event', 'rules', 'contact'];

  function renderCheckSelect() {
    var sel = $('checkSel');
    sel.textContent = '';
    var o = el('option', null, t('commonOpt')); o.value = ''; sel.appendChild(o);
    DATA.AREAS.forEach(function (a) {
      var g = document.createElement('optgroup');
      g.label = L(a.name);
      DATA.SPOTS.filter(function (s) { return s.area === a.id; }).forEach(function (s) {
        var op = el('option', null, L(s.name)); op.value = s.id; g.appendChild(op);
      });
      sel.appendChild(g);
    });
    sel.value = state.checkId;
  }

  function markNode(kind) {
    var m = el('span', 'mark mark--' + kind);
    var svgNS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '0 0 16 16');
    svg.setAttribute('aria-hidden', 'true');
    var p = document.createElementNS(svgNS, 'path');
    if (kind === 'ok') { p.setAttribute('d', 'M3 8.5 L6.5 12 L13 4.5'); }
    else if (kind === 'per') { p.setAttribute('d', 'M3 8 H13'); }
    else if (kind === 'part') { p.setAttribute('d', 'M8 2.5 A5.5 5.5 0 0 1 8 13.5 Z'); }
    else { p.setAttribute('d', 'M8 4.5 V9 M8 11.2 V11.6'); }
    svg.appendChild(p);
    if (kind !== 'ok' && kind !== 'per') {
      var c = document.createElementNS(svgNS, 'circle');
      c.setAttribute('cx', '8'); c.setAttribute('cy', '8'); c.setAttribute('r', '5.5');
      svg.appendChild(c);
    }
    m.appendChild(svg);
    m.appendChild(el('span', null, t('mark')[kind]));
    return m;
  }

  function srcCell(urls) {
    var wrap = el('span', 'srclist');
    var hosts = urls.map(hostOf);
    urls.forEach(function (u, i) {
      var label = (u === DATA.SHEET) ? t('srcSheet') : hosts[i];
      var dup = hosts.filter(function (h) { return h === hosts[i]; }).length > 1;
      if (dup) {
        try {
          var seg = new URL(u).pathname.replace(/\/index\.html$/, '/').replace(/\/$/, '');
          var last = decodeURIComponent(seg.split('/').pop() || '');
          if (last) { label += ' /' + (last.length > 22 ? last.slice(0, 21) + '…' : last); }
        } catch (e) { /* 保留主機名稱 */ }
      }
      wrap.appendChild(extLink(u, label));
    });
    if (!urls.length) { wrap.appendChild(el('span', 'muted', '—')); }
    return wrap;
  }

  function checkRows(spot) {
    var rows = [];
    if (!spot) {
      rows.push({ k: 'leaf', s: 'ok', t: t('commonLeaf'), src: [DATA.SHEET, 'https://www.tokyo-park.or.jp/'], d: DATA.D1 + ' / ' + DATA.D2 });
      ['hours', 'access'].forEach(function (k) { rows.push({ k: k, s: 'per', t: t('perSpot'), src: [DATA.SHEET], d: DATA.D2 }); });
      rows.push({ k: 'weather', s: DATA.WEATHER.s, t: L(DATA.WEATHER.t), src: DATA.WEATHER.src, d: DATA.WEATHER.d });
      rows.push({ k: 'wear', s: DATA.WEAR.s, t: L(DATA.WEAR.t), src: DATA.WEAR.src, d: DATA.WEAR.d });
      rows.push({ k: 'crowd', s: 'tbc', t: t('commonCrowd'), src: ['https://www.tokyo-park.or.jp/', DATA.SHEET], d: DATA.D2 });
      ['event', 'rules', 'contact'].forEach(function (k) { rows.push({ k: k, s: 'per', t: t('perSpot'), src: [DATA.SHEET], d: DATA.D2 }); });
      return rows;
    }
    ITEMS.forEach(function (k) {
      if (k === 'leaf') {
        rows.push({ k: k, s: 'ok', t: fmt(t('leafResult'), { n: L(spot.leaf.note) }), src: [spot.leaf.src], d: spot.leaf.d, none: true });
      } else if (k === 'weather') {
        rows.push({ k: k, s: DATA.WEATHER.s, t: L(DATA.WEATHER.t), src: DATA.WEATHER.src, d: DATA.WEATHER.d });
      } else if (k === 'wear') {
        rows.push({ k: k, s: DATA.WEAR.s, t: L(DATA.WEAR.t), src: DATA.WEAR.src, d: DATA.WEAR.d });
      } else {
        var f = spot.f[k];
        rows.push({ k: k, s: f.s, t: L(f.t), src: f.src, d: f.d });
      }
    });
    return rows;
  }

  function renderCheck() {
    var spot = state.checkId ? SPOT_BY_ID[state.checkId] : null;
    var body = $('checkBody');
    body.textContent = '';
    checkRows(spot).forEach(function (r) {
      var tr = el('tr', 'row--' + r.s);
      var th = el('th', 'ck__item', t('items')[r.k]); th.scope = 'row';
      tr.appendChild(th);
      var tdR = el('td', 'ck__result');
      tdR.setAttribute('data-label', t('thResult'));
      tdR.appendChild(elD('span', null, r.t));
      tr.appendChild(tdR);
      var tdM = el('td', 'ck__mark'); tdM.setAttribute('data-label', t('thMark'));
      tdM.appendChild(markNode(r.s)); tr.appendChild(tdM);
      var tdS = el('td', 'ck__src'); tdS.setAttribute('data-label', t('thSource'));
      tdS.appendChild(srcCell(r.src)); tr.appendChild(tdS);
      var tdD = el('td', 'ck__date'); tdD.appendChild(elD('span', null, r.d)); tdD.setAttribute('data-label', t('thDate'));
      tr.appendChild(tdD);
      body.appendChild(tr);
    });
    $('checkCaption').textContent = fmt(t('checkCaption'), { s: spot ? L(spot.name) : t('commonOpt') });
    $('checkLegend').textContent = t('legend');
  }

  /* ---------- 來源 ---------- */
  function renderSources() {
    var box = $('sourceGroups');
    box.textContent = '';
    [['official', 'srcOfficial', 'srcOfficialDesc'], ['aux', 'srcAux', 'srcAuxDesc'], ['sheet', 'srcSheet', 'srcSheetDesc']].forEach(function (g, gi) {
      var sec = el('section', 'srcgroup');
      var h = el('h3', null, null);
      h.appendChild(el('span', 'srcgroup__no', String.fromCharCode(65 + gi)));
      h.appendChild(document.createTextNode(t(g[1])));
      sec.appendChild(h);
      sec.appendChild(el('p', 'srcgroup__desc', t(g[2])));
      var ul = el('ul', 'srcgroup__list');
      DATA.SOURCES[g[0]].forEach(function (s) {
        var li = el('li');
        var top = el('div', 'srcitem__top');
        top.appendChild(extLink(s.url, L(s.name), 'srcitem__name'));
        if (s.g) { top.appendChild(el('span', 'srcitem__grade', t('gradeShort') + ' ' + s.g)); }
        li.appendChild(top);
        li.appendChild(elD('p', 'srcitem__note', L(s.note)));
        ul.appendChild(li);
      });
      sec.appendChild(ul);
      box.appendChild(sec);
    });
    var gl = $('gradeList');
    gl.textContent = '';
    ['S', 'A', 'B', 'C'].forEach(function (g) { gl.appendChild(el('li', null, L(DATA.GRADES[g]))); });
    gl.appendChild(el('li', null, t('gradeO')));
    gl.appendChild(el('li', null, t('gradeT')));
  }

  /* ---------- 景點資料視窗 ---------- */
  function fieldBlock(f, extraLabel) {
    var wrap = el('div', 'fv');
    if (extraLabel) { wrap.appendChild(el('p', 'fv__sub', extraLabel)); }
    var top = el('div', 'fv__top');
    top.appendChild(elD('p', 'fv__text', L(f.t)));
    top.appendChild(markNode(f.s));
    wrap.appendChild(top);
    var meta = el('p', 'fv__meta');
    meta.appendChild(el('span', 'fv__k', t('source')));
    meta.appendChild(srcCell(f.src));
    meta.appendChild(el('span', 'fv__k fv__k--gap', t('checked')));
    meta.appendChild(elD('span', null, f.d));
    wrap.appendChild(meta);
    return wrap;
  }

  function leafBlock(s) {
    var wrap = el('div', 'fv');
    var top = el('div', 'fv__top');
    var st = el('p', 'fv__status');
    st.appendChild(el('span', 'ring', null));
    st.appendChild(el('span', null, t('noReport')));
    top.appendChild(st);
    wrap.appendChild(top);
    wrap.appendChild(elD('p', 'fv__text', L(s.leaf.note)));
    var dl = el('dl', 'fv__dl');
    function pair(k, v) { dl.appendChild(el('dt', null, k)); var dd = el('dd'); if (typeof v === 'string') { setText(dd, v); } else { dd.appendChild(v); } dl.appendChild(dd); }
    pair(t('dataDate'), s.leaf.date ? s.leaf.date : t('noDate'));
    pair(t('dataNature'), L(s.leaf.nature));
    pair(t('source'), srcCell([s.leaf.src]));
    pair(t('checked'), s.leaf.d);
    wrap.appendChild(dl);
    if (s.leaf.history && s.leaf.history.length) {
      var hist = el('div', 'hist');
      hist.appendChild(el('p', 'hist__title', t('history')));
      var ul = el('ul');
      s.leaf.history.forEach(function (h) {
        var li = el('li');
        li.appendChild(elD('span', 'hist__date', h.date));
        li.appendChild(el('span', null, L(h.t) + ' '));
        li.appendChild(extLink(h.url));
        ul.appendChild(li);
      });
      hist.appendChild(ul);
      wrap.appendChild(hist);
    }
    return wrap;
  }

  function buildModal(s) {
    var a = AREA_BY_ID[s.area];
    $('modalMeta').textContent = L(a.name) + ' · ' + t('grade') + ' ' + s.grade + ' · ' + s.id;
    $('modalTitle').textContent = L(s.name);
    $('modalSub').textContent = (s.name.ja !== L(s.name) ? s.name.ja + ' · ' : '') + L(DATA.GRADES[s.grade]);
    var body = $('modalBody');
    body.textContent = '';

    var where = el('div', 'modal__where');
    where.appendChild(el('p', 'modal__label', t('ginkgoWhere')));
    where.appendChild(elD('p', null, L(s.ginkgo)));
    var links = el('p', 'modal__links');
    links.appendChild(extLink(s.official, t('officialSite') + ' — ' + hostOf(s.official), 'btnlink'));
    [].concat(s.proof || []).forEach(function (p) { links.appendChild(extLink(p.url, L(p.t), 'btnlink')); });
    where.appendChild(links);
    body.appendChild(where);

    var table = el('table', 'fields');
    var tb = el('tbody');
    function row(label, node) {
      var tr = el('tr');
      var th = el('th', null, label); th.scope = 'row';
      tr.appendChild(th);
      var td = el('td'); td.appendChild(node); tr.appendChild(td);
      tb.appendChild(tr);
    }
    row(t('fLeaf'), leafBlock(s));
    row(t('fHours'), fieldBlock(s.f.hours));
    row(t('fAccess'), fieldBlock(s.f.access));
    row(t('fWeather'), fieldBlock(DATA.WEATHER));
    var ec = el('div', 'fv-pair');
    ec.appendChild(fieldBlock(s.f.event, t('subEvent')));
    ec.appendChild(fieldBlock(s.f.crowd, t('subCrowd')));
    row(t('fEventCrowd'), ec);
    row(t('fRules'), fieldBlock(s.f.rules));
    row(t('fContact'), fieldBlock(s.f.contact));
    table.appendChild(tb);
    body.appendChild(table);
  }

  var openId = null;
  function openModal(id, opener) {
    var dlg = $('spotModal');
    lastFocus = opener || document.activeElement;
    openId = id;
    buildModal(SPOT_BY_ID[id]);
    if (typeof dlg.showModal === 'function') {
      if (!dlg.open) { dlg.showModal(); }
    } else {
      dlg.setAttribute('open', '');
    }
    document.body.classList.add('modal-open');
    $('modalBody').scrollTop = 0;
    $('modalClose').focus();
  }
  function closeModal() {
    var dlg = $('spotModal');
    if (typeof dlg.close === 'function' && dlg.open) { dlg.close(); } else { dlg.removeAttribute('open'); }
  }
  function onClosed() {
    openId = null;
    document.body.classList.remove('modal-open');
    if (lastFocus && document.contains(lastFocus)) { lastFocus.focus(); }
  }

  /* ---------- 語言 ---------- */
  function setLang(lang) {
    if (LANGS.indexOf(lang) === -1) { lang = 'zh'; }
    state.lang = lang;
    store('ginkgo-walk-lang', lang);
    renderAll();
    if (openId) { buildModal(SPOT_BY_ID[openId]); }
  }

  function renderAll() {
    applyStatic();
    renderMap();
    renderAreaSelect();
    renderList();
    renderFlow();
    renderWalkTabs();
    renderWalk();
    renderCheckSelect();
    renderCheck();
    renderSources();
  }

  /* ---------- 事件 ---------- */
  function bind() {
    document.querySelectorAll('.lang__btn').forEach(function (b) {
      b.addEventListener('click', function () { setLang(b.getAttribute('data-lang')); });
    });
    document.querySelectorAll('#areaMap .region').forEach(function (g) {
      var id = g.getAttribute('data-area');
      g.addEventListener('click', function () { selectArea(id); });
      g.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectArea(id); }
      });
    });
    $('q').addEventListener('input', function (e) { state.q = e.target.value; renderList(); });
    $('areaSel').addEventListener('change', function (e) {
      state.area = e.target.value;
      if (state.area) { state.walkArea = state.area; renderWalk(); }
      renderMap(); renderList();
    });
    $('clearBtn').addEventListener('click', function () { clearFilters(); $('q').focus(); });
    $('emptyClear').addEventListener('click', function () { clearFilters(); $('q').focus(); });
    $('checkSel').addEventListener('change', function (e) { state.checkId = e.target.value; renderCheck(); });
    $('modalClose').addEventListener('click', closeModal);
    var dlg = $('spotModal');
    dlg.addEventListener('close', onClosed);
    dlg.addEventListener('click', function (e) { if (e.target === dlg) { closeModal(); } });
  }

  /* ---------- 啟動 ---------- */
  var saved = store('ginkgo-walk-lang');
  if (saved && LANGS.indexOf(saved) !== -1) { state.lang = saved; }
  bind();
  renderAll();
})();
