/* 東京銀杏地圖：靜態資料快照（2026-10-02）
 * 依據：老師提供的東京銀杏資料表，以及表內各列的官方來源。
 * 「目前狀態」只採官方明確發布的 2026 年銀杏階段；截至快照日，沒有任何來源發布，因此一律為 null（顯示「資料未提供」）。
 * past = 有日期的過去官方紀錄，只作歷史參考；stage 只在原文明確寫出該階段時才填入。
 * 座標皆為近似值（WGS84），用於地圖示意與直線距離估算。
 */
window.GINKGO_DATA = {
  snapshot: '2026-10-02',
  sheetUrl: 'https://docs.google.com/spreadsheets/d/1dx_41InyuuWuILc4ZHJW8tTZMVOCpIuSz-QzISzd7y0/edit?usp=sharing',
  pressRelease: 'https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf',

  stages: [
    { key: 'aoba',    ja: '青葉',       zh: '葉片仍為綠色', desc: '樹冠仍以綠色為主，尚未轉色。' },
    { key: 'iro',     ja: '色づき始め', zh: '開始轉色',     desc: '葉緣或部分枝條開始出現黃色。' },
    { key: 'shinko',  ja: '黄葉進行',   zh: '黃葉進行中',   desc: '黃色範圍擴大，綠黃交錯。' },
    { key: 'migoro',  ja: '見頃',       zh: '最佳觀賞期',   desc: '大部分葉片轉為金黃，正值觀賞期。' },
    { key: 'rakuyo1', ja: '落葉始め',   zh: '開始落葉',     desc: '黃葉開始飄落，地面出現落葉。' },
    { key: 'rakuyo',  ja: '落葉',       zh: '多數已落葉',   desc: '大部分葉片已落下，枝條逐漸露出。' }
  ],

  areas: [
    { key: 'kokyo',  label: '皇居周邊',     sub: '千代田區、港區' },
    { key: 'yamate', label: '新宿・澀谷',   sub: '新宿區、澀谷區、目黑區' },
    { key: 'ueno',   label: '上野・文京',   sub: '台東區、文京區、江東區' },
    { key: 'johoku', label: '城北・杉並',   sub: '練馬區、板橋區、杉並區' },
    { key: 'tama',   label: '多摩地區',     sub: '小金井、立川、八王子、府中、國立、秋留野' }
  ],

  grades: {
    S: '官方公園協會（年度紅葉情報名單）',
    A: '官方附日期的現地觀測',
    B: '官方來源，銀杏專項資料待補',
    C: '官方景點或入口，無日期觀測'
  },

  jma: {
    station: '東京（氣象廳標本木）',
    yellowNormal: '11/23',
    fallNormal: '12/3',
    yellow2025: '11/22',
    fall2025: '12/4',
    status2026: '尚未觀測（頁面顯示 ///）',
    recentYellow: { 2016: '11/21', 2017: '11/17', 2018: '11/19', 2019: '11/29', 2020: '11/26', 2021: '11/28', 2022: '11/19', 2023: '12/1', 2024: '12/3', 2025: '11/22' },
    defYellow: '標本木整體看來，大部分葉片轉為黃色的第一天。',
    defFall: '葉片約 80% 落下的第一天。',
    sources: [
      { label: '氣象廳｜いちょうの黄葉日（2025–2026）', url: 'https://www.data.jma.go.jp/sakura/data/phn_012.html' },
      { label: '氣象廳｜いちょうの落葉日（2025–2026）', url: 'https://www.data.jma.go.jp/sakura/data/phn_013.html' },
      { label: '氣象廳｜生物季節 累年值下載（平年值 CSV）', url: 'https://www.data.jma.go.jp/sakura/data/download_ruinenchi.html' },
      { label: '氣象廳 鹿兒島地方氣象台｜生物季節觀測說明（黃葉日、落葉日定義）', url: 'https://www.data.jma.go.jp/kagoshima/obs/seibutsu_kisetsu.html' }
    ]
  },

  spots: [
    {
      id: 'TKG-002', nameZh: '上野恩賜公園', nameJa: '上野恩賜公園', area: 'ueno', ward: '台東區', grade: 'S',
      lat: 35.713, lng: 139.7724, coordNote: '座標為近似值（園區代表點）；園內銀杏的確切位置官方未載明。',
      address: '台東区上野公園・池之端三丁目',
      intro: '以「上野山」台地與不忍池為中心的都立代表性公園，博物館、美術館與動物園集中於此，春櫻、夏荷與秋季紅葉都很有名。',
      ginkgo: '東京都建設局的上野公園頁面把銀杏列為主要植物；2025 年度東京都公園協會紅葉情報名單也將本園列為銀杏。園內銀杏的具體位置，官方頁面未載明。',
      season: { text: '東京都建設局植物月曆：銀杏晚秋轉為金黃，例年 11 月下旬至 12 月中旬為紅葉觀賞期（頁面 2023-03-04 更新，屬例年目安，不是 2026 年現況）。', url: 'https://www.kensetsu.metro.tokyo.lg.jp/jimusho/toubuk/ueno/midokoro/shizen' },
      evidenceDate: '2025-11-04（2025 年度紅葉情報名單）',
      visit: { hours: '東京都公園協會頁面寫「常時開園」，東京都建設局頁面寫 5:00–23:00；兩頁不一致，待確認。', closed: '無休（服務中心與各設施年末年始休息）', fee: '免費（部分設施收費）' },
      caveat: '資料表將本園列為銀杏專項季節觀測候選；目前不宣稱已取得 2026 年銀杏現況。',
      past: [],
      sources: [
        { label: '東京都公園協會｜上野恩賜公園', url: 'https://www.tokyo-park.or.jp/park/ueno/' },
        { label: '東京都建設局｜上野公園 自然（植物月曆）', url: 'https://www.kensetsu.metro.tokyo.lg.jp/jimusho/toubuk/ueno/midokoro/shizen' },
        { label: '東京都建設局｜上野公園 公園介紹（開放時間 5:00–23:00 的出處）', url: 'https://www.kensetsu.metro.tokyo.lg.jp/jimusho/toubuk/ueno/kouenannai' },
        { label: '東京都公園協會｜2025 年度紅葉情報新聞稿（PDF）', url: 'https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf' }
      ]
    },
    {
      id: 'TKG-003', nameZh: '木場公園', nameJa: '木場公園', area: 'ueno', ward: '江東區', grade: 'S',
      lat: 35.6752, lng: 139.8085, coordNote: '座標為近似值（園區代表點，位於南北兩區之間）；銀杏位置官方未載明。',
      address: '江東区木場四・五丁目・平野四丁目・三好四丁目・東陽六丁目',
      intro: '承襲江戶以來「材木之町」的歷史，以水與綠為主題整建的森林公園；南、中、北三個區域由木場公園大橋相連。',
      ginkgo: '園區頁面本身沒有銀杏的記載；本園的銀杏資格來自資料表引用的 2025 年度東京都公園協會紅葉情報名單。',
      season: null,
      evidenceDate: '2025-11-04（2025 年度紅葉情報名單）',
      visit: { hours: '常時開園', closed: '無休（服務中心與各設施年末年始休息）', fee: '免費（部分設施收費）' },
      caveat: '保留園區原文所指的子地點；園區頁「秋季見頃」列的是金木犀、唐楓等，未列銀杏。',
      past: [],
      sources: [
        { label: '東京都公園協會｜木場公園', url: 'https://www.tokyo-park.or.jp/park/kiba/' },
        { label: '東京都公園協會｜2025 年度紅葉情報新聞稿（PDF）', url: 'https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf' }
      ]
    },
    {
      id: 'TKG-004', nameZh: '小金井公園', nameJa: '小金井公園', area: 'tama', ward: '小金井市等', grade: 'S',
      lat: 35.7155, lng: 139.5189, coordNote: '座標為近似值（園區代表點）；銀杏位置官方未載明。',
      address: '小金井市桜町三丁目、関野町一・二丁目、小平市花小金井南町三丁目、西東京市向台町六丁目、武蔵野市桜堤三丁目',
      intro: '沿著玉川上水、面積約 80 公頃的大型公園，有開闊草地、雜木林、櫻之園，以及江戶東京建築園。',
      ginkgo: '園區頁面的「花の見ごろ情報（秋）」列有銀杏，但沒有寫位置。',
      season: null,
      evidenceDate: '2025-11-04（2025 年度紅葉情報名單）',
      visit: { hours: '常時開園（服務中心 8:30–17:30）', closed: '無休（服務中心與各設施年末年始休息）', fee: '免費（部分設施收費）' },
      caveat: '園區橫跨多個行政區；不以服務中心地址代表所有觀賞點。',
      past: [],
      sources: [
        { label: '東京都公園協會｜小金井公園', url: 'https://www.tokyo-park.or.jp/park/koganei/' },
        { label: '東京都公園協會｜2025 年度紅葉情報新聞稿（PDF）', url: 'https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf' }
      ]
    },
    {
      id: 'TKG-005', nameZh: '芝公園', nameJa: '芝公園', area: 'kokyo', ward: '港區', grade: 'S',
      lat: 35.6555, lng: 139.748, coordNote: '座標為近似值（環狀園區代表點）；銀杏位置官方未載明。',
      address: '港区芝公園一・二・三・四丁目',
      intro: '明治 6 年日本最早指定的 5 座公園之一；因曾是增上寺境內，園區呈環狀分布。',
      ginkgo: '官方介紹寫園內各處有樟樹、櫸樹、銀杏等大樹，但沒有指出位置；主要植物與秋季見頃也列有銀杏。',
      season: null,
      evidenceDate: '2025-11-04（2025 年度紅葉情報名單）',
      visit: { hours: '常時開園', closed: '無休（服務中心與各設施年末年始休息）', fee: '免費（部分設施收費）' },
      caveat: '銀杏與「もみじ谷」分開：もみじ谷是楓樹區，不是銀杏景點。官方網址為 siba（不是 shiba）。',
      past: [],
      sources: [
        { label: '東京都公園協會｜芝公園', url: 'https://www.tokyo-park.or.jp/park/siba/' },
        { label: '東京都公園協會｜2025 年度紅葉情報新聞稿（PDF）', url: 'https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf' }
      ]
    },
    {
      id: 'TKG-006', nameZh: '城北中央公園', nameJa: '城北中央公園', area: 'johoku', ward: '板橋區、練馬區', grade: 'S',
      lat: 35.7564, lng: 139.673, coordNote: '座標為近似值（園區代表點）；銀杏並木的確切位置官方未載明。',
      address: '板橋区桜川一丁目、小茂根五丁目、練馬区氷川台一丁目、羽沢三丁目',
      intro: '位於石神井川沿岸的起伏地形上，設有棒球場與競技場，是 23 區北部規模最大的運動公園之一，樹木多，也適合散步。',
      ginkgo: '官方寫「秋天銀杏並木會漂亮地轉色」；相簿的拍攝地點標示為「イチョウ並木_正門」（2018 年拍攝）。',
      season: null,
      evidenceDate: '2025-11-04（2025 年度紅葉情報名單）',
      visit: { hours: '常時開園', closed: '無休（服務中心與各設施年末年始休息）', fee: '免費（部分設施收費）' },
      caveat: '須依樹種判讀：不把櫸樹的葉況套用到銀杏。',
      past: [],
      sources: [
        { label: '東京都公園協會｜城北中央公園', url: 'https://www.tokyo-park.or.jp/park/johoku-chuo/' },
        { label: '東京都公園協會｜2025 年度紅葉情報新聞稿（PDF）', url: 'https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf' }
      ]
    },
    {
      id: 'TKG-007', nameZh: '善福寺川綠地', nameJa: '善福寺川緑地', area: 'johoku', ward: '杉並區', grade: 'S',
      lat: 35.692, lng: 139.6305, coordNote: '座標為近似值（沿河帶狀綠地的代表點）；銀杏位置官方未載明。',
      address: '杉並区成田東二・三・四丁目、成田西一・三・四丁目、荻窪一丁目',
      intro: '沿著善福寺川、與和田堀公園相連的帶狀綠地，保有武藏野風貌的樹林與兒童廣場交錯分布。',
      ginkgo: '官方寫秋天櫸樹、銀杏、唐楓、櫻樹等會鮮豔轉色，是攝影愛好者的題材（全園描述，未指出位置）。',
      season: null,
      evidenceDate: '2025-11-04（2025 年度紅葉情報名單）',
      visit: { hours: '常時開園', closed: '無休（服務中心年末年始休息）', fee: '免費（部分設施收費）' },
      caveat: '2025 年度名單把本綠地與和田堀公園合併為一列，不能假設兩處各有獨立觀測。',
      past: [],
      sources: [
        { label: '東京都公園協會｜善福寺川緑地', url: 'https://www.tokyo-park.or.jp/park/zempukujigawa-ryokuchi/index.html' },
        { label: '東京都公園協會｜2025 年度紅葉情報新聞稿（PDF）', url: 'https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf' }
      ]
    },
    {
      id: 'TKG-008', nameZh: '和田堀公園', nameJa: '和田堀公園', area: 'johoku', ward: '杉並區', grade: 'S',
      lat: 35.6855, lng: 139.6395, coordNote: '座標為近似值（園區代表點）。',
      address: '杉並区大宮一・二丁目、成田東一・二丁目、成田西一丁目、堀ノ内一・二丁目、松ノ木一丁目',
      intro: '橫跨善福寺川上 12 座橋的公園，以寧靜的和田堀池，以及與大宮八幡宮連成一片的綠意為特色。',
      ginkgo: '官方提到，相鄰的大宮八幡宮「神門的夫婦銀杏」轉黃時值得一看（神社是公園旁的另一處設施）。',
      season: null,
      evidenceDate: '2025-11-04（2025 年度紅葉情報名單）',
      visit: { hours: '常時開園', closed: '無休（服務中心與各設施年末年始休息）', fee: '免費（部分設施收費）' },
      caveat: '2025 年度名單把本園與善福寺川綠地合併為一列，保留兩者共同的來源關係。',
      past: [],
      sources: [
        { label: '東京都公園協會｜和田堀公園', url: 'https://www.tokyo-park.or.jp/park/wadabori/' },
        { label: '東京都公園協會｜2025 年度紅葉情報新聞稿（PDF）', url: 'https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf' }
      ]
    },
    {
      id: 'TKG-009', nameZh: '戶山公園', nameJa: '戸山公園', area: 'yamate', ward: '新宿區', grade: 'S',
      lat: 35.7037, lng: 139.7135, coordNote: '座標為近似值（箱根山地區代表點）；銀杏位置官方未載明。',
      address: '新宿区戸山一・二・三丁目、新宿区大久保三丁目',
      intro: '分成兩區：以山手線內最高點「箱根山」為中心的箱根山地區，以及以運動和休憩為主的大久保地區。',
      ginkgo: '主要植物與秋季見頃列有銀杏，但沒有寫位置。',
      season: null,
      evidenceDate: '2025-11-04（2025 年度紅葉情報名單）',
      visit: { hours: '常時開園', closed: '無休（服務中心年末年始休息）', fee: '免費' },
      caveat: '須擷取銀杏的段落，不直接使用全園的紅葉狀態。',
      past: [],
      sources: [
        { label: '東京都公園協會｜戸山公園', url: 'https://www.tokyo-park.or.jp/park/toyama/' },
        { label: '東京都公園協會｜2025 年度紅葉情報新聞稿（PDF）', url: 'https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf' }
      ]
    },
    {
      id: 'TKG-010', nameZh: '光之丘公園', nameJa: '光が丘公園', area: 'johoku', ward: '練馬區、板橋區', grade: 'S',
      lat: 35.7648, lng: 139.6295, coordNote: '座標為近似值：地圖點是官方所稱「いちょう並木」的推定位置（売店與観賞池之間，誤差約 ±100 m）。',
      address: '練馬区光が丘二・四丁目、旭町二丁目、板橋区赤塚新町三丁目',
      intro: '由美軍住宅區「Grant Heights」返還地的一部分整建而成的大型公園，有銀杏並木、草坪廣場與野鳥保護區。',
      ginkgo: '官方介紹兩處銀杏：「いちょう並木」位於公園中央（売店與観賞池之間），由 Grant Heights 時代的 28 棵銀杏移植而來；「ふれあいの径」則是從有樂町舊都廳前移植的行道樹，樹齡超過百年的銀杏共 40 棵。',
      season: null,
      evidenceDate: '2025-11-04（2025 年度紅葉情報名單）',
      visit: { hours: '常時開園', closed: '無休（服務中心與各設施年末年始休息；屋敷森跡地週一休園）', fee: '免費（部分設施收費）' },
      caveat: '銀杏並木與「ふれあいの径」宜視為不同子地點。',
      past: [],
      sources: [
        { label: '東京都公園協會｜光が丘公園', url: 'https://www.tokyo-park.or.jp/park/hikarigaoka/' },
        { label: '東京都公園協會｜2025 年度紅葉情報新聞稿（PDF）', url: 'https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf' }
      ]
    },
    {
      id: 'TKG-011', nameZh: '日比谷公園', nameJa: '日比谷公園', area: 'kokyo', ward: '千代田區', grade: 'S',
      lat: 35.6737, lng: 139.7559, coordNote: '座標為近似值：地圖點是「首賭けイチョウ」的推定位置（松本樓附近，誤差約 ±50–100 m）。',
      address: '千代田区日比谷公園',
      intro: '由本多靜六設計、明治 36 年開園的日本第一座西式公園，保有大噴水、花壇與江戶時代的遺構。',
      ginkgo: '公園象徵「首賭けイチョウ」推定樹齡 400–500 年、樹圍約 7 m；原本在今日比谷交叉口附近，因道路拓寬險遭砍伐，明治 35 年由本多靜六博士主張移植至此。',
      season: null,
      evidenceDate: '2025-11-04（2025 年度紅葉情報名單）',
      visit: { hours: '常時開園（服務中心 8:30–17:30，年末年始除外）', closed: '無休；2026 年 10 月因再生整備工程，大噴水、噴水廣場等部分區域不可進入', fee: '免費（部分設施收費）' },
      caveat: '葉況與施工、通行公告分開判讀。',
      past: [],
      sources: [
        { label: '東京都公園協會｜日比谷公園', url: 'https://www.tokyo-park.or.jp/park/hibiya/' },
        { label: '東京都公園協會｜2025 年度紅葉情報新聞稿（PDF）', url: 'https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf' }
      ]
    },
    {
      id: 'TKG-012', nameZh: '代代木公園', nameJa: '代々木公園', area: 'yamate', ward: '澀谷區', grade: 'S',
      lat: 35.6717, lng: 139.6965, coordNote: '座標為近似值（園區代表點）；銀杏位置官方未載明。',
      address: '渋谷区代々木神園町（A地区）、神南一丁目・神南二丁目（B地区）',
      intro: '曾是練兵場與奧運選手村，是 23 區內面積第 5 大的都立公園；由 A 區的森林與 B 區的競技場、野外舞台組成。',
      ginkgo: '主要植物與秋季見頃列有銀杏，但沒有寫位置。',
      season: null,
      evidenceDate: '2025-11-04（2025 年度紅葉情報名單）',
      visit: { hours: '常時開園', closed: '無休（服務中心與各設施年末年始休息）', fee: '免費（部分設施收費）' },
      caveat: '黃葉公告只限原文明示的區域，不擴大解讀為全園。',
      past: [],
      sources: [
        { label: '東京都公園協會｜代々木公園', url: 'https://www.tokyo-park.or.jp/park/yoyogi/' },
        { label: '東京都公園協會｜2025 年度紅葉情報新聞稿（PDF）', url: 'https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf' }
      ]
    },
    {
      id: 'TKG-013', nameZh: '舊岩崎邸庭園', nameJa: '旧岩崎邸庭園', area: 'ueno', ward: '台東區', grade: 'S',
      lat: 35.7092, lng: 139.7683, coordNote: '座標為近似值（庭園正門）；園內銀杏位置官方未載明。',
      address: '台東区池之端1-3-45',
      intro: '明治 29 年作為岩崎久彌的本邸興建，洋館、撞球室與和館留存至今，是國家重要文化財，可看到早期近代庭園的草坪庭樣貌。',
      ginkgo: '主要植物與秋季見頃列有銀杏與楓，但沒有寫位置。',
      season: null,
      evidenceDate: '2025-11-04（2025 年度紅葉情報名單）',
      visit: { hours: '9:00–17:00（16:30 停止入園；活動期間可能延長）', closed: '年末年始（12/29–1/1）', fee: '一般 400 円；65 歲以上 200 円；小學生以下與都內在住・在學的國中生免費' },
      caveat: '活動或集章的日期不是見頃日：2026 年都立 9 庭園「紅葉めぐりスタンプラリー」（10/10–12/6）只是活動期間。',
      past: [],
      sources: [
        { label: '東京都公園協會｜旧岩崎邸庭園', url: 'https://www.tokyo-park.or.jp/park/kyu-iwasaki-tei/' },
        { label: '東京都公園協會｜2025 年度紅葉情報新聞稿（PDF）', url: 'https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf' }
      ]
    },
    {
      id: 'TKG-014', nameZh: '國營昭和紀念公園', nameJa: '国営昭和記念公園', area: 'tama', ward: '立川市、昭島市', grade: 'A',
      lat: 35.7028, lng: 139.4022, coordNote: '座標為近似值：地圖點是「カナール」銀杏並木。另一處「かたらいのイチョウ並木」位於園區西側，位置未經核實，只以文字列出、不放地圖點。',
      address: '立川市緑町3173',
      intro: '橫跨立川市與昭島市的大型國營公園；「カナール」與「かたらいのイチョウ並木」是知名的秋季黃葉景點。',
      ginkgo: '官方植物指南：カナール銀杏並木約 200 m、かたらいのイチョウ並木約 300 m，可欣賞「黃金隧道」。秋夜散步頁則寫カナール 106 棵、約 150 m，かたらい 98 棵、約 300 m（兩頁的カナール長度不一致），並說明轉色由カナール先開始、かたらい在後。',
      season: { text: '官方植物指南：銀杏（黃葉）10 月下旬～11 月下旬。秋夜散步頁：カナール 11 月上旬～中旬、かたらい 11 月中旬～下旬（例年說明，不是 2026 年實況）。', url: 'https://www.showakinen-koen.jp/flower-information/' },
      evidenceDate: '2025-10-23 至 2025-12-04（花だより歷史列表）',
      visit: { hours: '10 月 9:30–17:00；11–2 月 9:30–16:30（活動期間可能變動）', closed: '年末年始（12/31、1/1）、1 月第 3 個週一至週五；天候不佳時可能臨時休園', fee: '大人（高中生以上）450 円；65 歲以上 210 円；國中生以下免費', event: '官方活動「黄葉・紅葉まつり＆秋の夜散歩2026」：2026-10-29 至 11-29（活動期間，不是見頃日）' },
      caveat: 'カナール與かたらいのイチョウ並木是不同地點；花だより分頁位置會隨新文章變動，不可當永久存檔。',
      past: [
        { date: '2025-11-06 至 12-04', stage: null, text: '官方「花だより」2025 年 11/6–12/4 各期列有銀杏（本網站未逐期標示階段）。資料表的證據期間為 2025-10-23 至 12-04，取自同一份歷史列表。', url: 'https://www.showakinen-koen.jp/hanadayori/page/3/' }
      ],
      sources: [
        { label: '國營昭和記念公園｜花だより', url: 'https://www.showakinen-koen.jp/hanadayori/' },
        { label: '國營昭和記念公園｜花・植物ガイド', url: 'https://www.showakinen-koen.jp/flower-information/' },
        { label: '國營昭和記念公園｜黄葉・紅葉まつり＆秋の夜散歩', url: 'https://www.showakinen-koen.jp/autumn-night-walk/' },
        { label: '國營昭和記念公園｜開園時間・休園日', url: 'https://www.showakinen-koen.jp/park-information/schedule/' },
        { label: '國營昭和記念公園｜入園料', url: 'https://www.showakinen-koen.jp/park-information/price/' },
        { label: '國營昭和記念公園｜交通・所在地', url: 'https://www.showakinen-koen.jp/access/' }
      ]
    },
    {
      id: 'TKG-015', nameZh: '新宿御苑', nameJa: '新宿御苑', area: 'yamate', ward: '新宿區、澀谷區', grade: 'A',
      lat: 35.6867, lng: 139.7126, coordNote: '座標為近似值：地圖點是大溫室（官方稱溫室附近的銀杏是熱門拍攝點），與實際樹位約差數十公尺。',
      address: '新宿区内藤町11',
      intro: '位於新宿中心的舊皇室庭園，現為國民公園；秋天可欣賞園內各處的銀杏黃葉與菊花壇展。',
      ginkgo: '官方「季節のみどころ」月份表在 11 月列出紅葉（銀杏、懸鈴木等）。',
      season: { text: '官方季節月份表：11 月　紅葉（銀杏、懸鈴木等）。', url: 'https://fng.or.jp/shinjuku/place/season' },
      evidenceDate: '2025-11-28',
      visit: { hours: '10/1–3/14：9:00–16:30（16:00 停止入園）', closed: '每週一（遇假日順延至次一平日）、12/29–1/3；秋季特別開園 11/1–11/15 期間無休', fee: '一般 500 円；65 歲以上、學生（高中以上）250 円；國中生以下免費', event: '官方公告：大木戶門因工程自 2026-10-06 至 11 月下旬（預定）實施通行管制（2026-10-01 公告）' },
      caveat: '舊文章只當歷史樣本；不可把同期其他樹種的狀態混入銀杏。',
      past: [
        { date: '2025-11-28', stage: 'migoro', text: '官方文章寫園內各處銀杏正值觀賞期，大樹被黃色覆蓋；溫室附近枝條較低，是熱門拍攝點。', url: 'https://fng.or.jp/shinjuku/2025/11/28/20251128_03/' }
      ],
      sources: [
        { label: '國民公園協會 新宿御苑｜自然情報', url: 'https://fng.or.jp/shinjuku/news/' },
        { label: '國民公園協會 新宿御苑｜季節のみどころ', url: 'https://fng.or.jp/shinjuku/place/season' },
        { label: '國民公園協會 新宿御苑｜入園案內（開園時間・入園料・休園日・秋季特別開園）', url: 'https://fng.or.jp/shinjuku/guide/' },
        { label: '國民公園協會 新宿御苑｜10/1～3/14 開園時間公告（2026-09-30）', url: 'https://fng.or.jp/shinjuku/2026/09/30/20260930-01/' },
        { label: '國民公園協會 新宿御苑｜交通・所在地', url: 'https://fng.or.jp/shinjuku/access/' },
        { label: '國民公園協會 新宿御苑｜大木戸門通行規制公告（2026-10-01）', url: 'https://fng.or.jp/shinjuku/2026/10/01/20261001-01/' },
        { label: '環境省｜新宿御苑', url: 'https://policies.env.go.jp/national-garden/shinjukugyoen/index.html' }
      ]
    },
    {
      id: 'TKG-016', nameZh: '八王子 甲州街道銀杏並木', nameJa: '八王子 甲州街道いちょう並木', area: 'tama', ward: '八王子市', grade: 'A',
      lat: 35.652, lng: 139.3004, coordNote: '座標為近似值：全長約 4 km 並木的中段代表點。',
      address: '八王子市追分町交差点至高尾駅入口的甲州街道（國道 20 號）沿線',
      intro: '從追分町交叉口延伸到高尾站入口、約 4 km 的甲州街道銀杏並木，約 770 棵；昭和 2～4 年作為武藏陵墓地的紀念樹種植，1964 年指定為八王子市天然紀念物。',
      ginkgo: '官方黃葉情報頁有 2026-09-22 拍攝的照片（八王子市中央圖書館、多摩御陵入口交叉口，各朝兩個方向），但文字沒有標示階段。2026-09-24 官方公告表示高尾方向進入開始變色的時期，並會不定期更新黃葉情報。',
      season: { text: '官方：每年 11 月前後會美麗地轉黃。第 47 回八王子いちょう祭り為 2026-11-21、22（祭典日期不等於見頃日）。', url: 'https://www.ichou-festa.org/' },
      evidenceDate: '2026-09-24（更新公告）',
      visit: { hours: '公共道路，官方未記載時間（資料未提供）', closed: null, fee: null, event: '第 47 回八王子いちょう祭り：2026-11-21（9:00–16:30）、11-22（9:00–16:00）；祭典期間無停車場、部分路段交通管制' },
      caveat: '已有 2026 年照片，但不能只看照片日期就判定階段；祭典日期與葉況分開。',
      past: [],
      sources: [
        { label: '八王子いちょう祭り｜黄葉情報', url: 'https://www.ichou-festa.org/ichounews/' },
        { label: '八王子いちょう祭り｜2026-09-24 公告', url: 'https://www.ichou-festa.org/notice/post-3629/' },
        { label: '八王子いちょう祭り｜官方首頁', url: 'https://www.ichou-festa.org/' },
        { label: '八王子いちょう祭り｜いちょう祭りとは', url: 'https://www.ichou-festa.org/about' },
        { label: '八王子いちょう祭り｜祭典資訊（2026 時段）', url: 'https://www.ichou-festa.org/event' },
        { label: '八王子いちょう祭り｜FAQ（停車場・交通管制）', url: 'https://www.ichou-festa.org/faq' }
      ]
    },
    {
      id: 'TKG-017', nameZh: '皇居東御苑', nameJa: '皇居東御苑', area: 'kokyo', ward: '千代田區', grade: 'A',
      lat: 35.6857, lng: 139.7581, coordNote: '座標為近似值：地圖點是百人番所（官方照片標示「百人番所前のイチョウ」），與樹位約差數十公尺。',
      address: '千代田区千代田1',
      intro: '整建舊江戶城本丸、二之丸、三之丸一部分而成的皇居附屬庭園，免費入園。',
      ginkgo: '宮內廳「花だより」以照片記錄園內植物，2025 年的紀錄中有「百人番所前的銀杏」。',
      season: null,
      evidenceDate: '2025-11-28',
      visit: { hours: '10 月 9:00–16:30（16:00 停止入園）；11–2 月 9:00–16:00（15:30 停止入園）', closed: '每週一、週五，12/28–1/3，以及舉行儀式等日子（國民假日原則上開放）', fee: '免費（入園時領取入園票，離園時交回）' },
      caveat: '皇居東御苑不是皇居外苑，也不是北之丸公園；全園落葉的描述不可直接套用到銀杏。',
      past: [
        { date: '2025-11-28', stage: null, text: '花だより：苑內各處的銀杏、楓類與其他落葉樹轉色，照片標示「百人番所前のイチョウ」（原文未寫明階段）。', url: 'https://www.kunaicho.go.jp/visit/higashigyoen/hanadayori/20251128.html' }
      ],
      sources: [
        { label: '宮內廳｜皇居東御苑 花だより', url: 'https://www.kunaicho.go.jp/visit/higashigyoen/hanadayori/index.html' },
        { label: '宮內廳｜皇居東御苑', url: 'https://www.kunaicho.go.jp/visit/higashigyoen/index.html' },
        { label: '宮內廳｜皇居東御苑 休園日', url: 'https://www.kunaicho.go.jp/visit/higashigyoen/gyoen-close.html' },
        { label: '宮內廳｜皇居東御苑 公開要領（PDF）', url: 'https://www.kunaicho.go.jp/visit/higashigyoen/pdf/koukaiyouryou.pdf' }
      ]
    },
    {
      id: 'TKG-018', nameZh: '小石川植物園', nameJa: '小石川植物園', area: 'ueno', ward: '文京區', grade: 'A',
      lat: 35.7202, lng: 139.7452, coordNote: '座標為近似值：地圖點是園內名木「精子発見のイチョウ」。',
      address: '文京区白山3丁目7番1号',
      intro: '東京大學大學院理學系研究科附屬植物園，園內有植物學史上著名的「精子發現的銀杏」。',
      ginkgo: '官方園內導覽：植物學教室的平瀨作五郎在這棵銀杏上發現精子；它是雌株，秋天會結許多銀杏果。',
      season: null,
      evidenceDate: '2025-11-19',
      visit: { hours: '9:00–16:30（16:00 停止入園）', closed: '每週一（遇假日順延至次日）；12/29–1/3 為開園期間外', fee: '大人（高中生以上）500 円；中小學生 150 円；未滿 6 歲免費' },
      caveat: '看到黃葉不等於已到見頃。小石川植物園與小石川後樂園是不同地點。',
      past: [
        { date: '2025-11-19', stage: null, text: '官方「開花・紅葉狀況」文章把銀杏和イロハモミジ等列為正在紅葉／黃葉的植物（原文未寫明階段）。', url: 'https://koishikawa-bg.jp/kaika/5013/' }
      ],
      sources: [
        { label: '小石川植物園｜見ごろの植物', url: 'https://koishikawa-bg.jp/kaikainfo/' },
        { label: '小石川植物園｜精子発見のイチョウ', url: 'https://koishikawa-bg.jp/ennai/ginkgo/' },
        { label: '小石川植物園｜利用案內', url: 'https://koishikawa-bg.jp/overview/guide/' }
      ]
    },
    {
      id: 'TKG-019', nameZh: '廣德寺（秋留野市）', nameJa: '広徳寺', area: 'tama', ward: '秋留野市', grade: 'A',
      lat: 35.7218, lng: 139.2174, coordNote: '座標為近似值（寺院位置）；銀杏在寺內，未另有獨立座標。',
      address: 'あきる野市小和田234',
      intro: '位於秋川溪谷的臨濟宗古剎，以茅草屋頂的山門和銀杏巨樹聞名。',
      ginkgo: '秋留野市官方「あきる野百景」介紹：境內有東京都指定天然紀念物的カヤ與タラヨウ，也有銀杏巨樹。',
      season: null,
      evidenceDate: '2025-11-08（發文）；2025-11-06（拍照）',
      visit: { hours: null, closed: null, fee: null },
      caveat: '觀光協會紅葉情報中「石舟橋」段落是楓樹，不能套用到廣德寺的銀杏；發文日與拍照日分開標示。',
      past: [
        { date: '2025-11-08（照片 11-06 拍攝）', stage: null, text: '秋留野市觀光協會：廣德寺銀杏的轉色持續進展，距離見頃還差一點（原文未使用六階段的用語，因此不對應階段）。', url: 'https://www.akirunokanko.com/?p=8712' }
      ],
      sources: [
        { label: 'あきる野市觀光協會｜のらぼう日記（紅葉情報）', url: 'https://www.akirunokanko.com/?cat=53' },
        { label: '秋留野市｜あきる野百景 31. 広徳寺', url: 'https://www.city.akiruno.tokyo.jp/0000001442.html' }
      ]
    },
    {
      id: 'TKG-023', nameZh: '明治神宮外苑 銀杏並木', nameJa: '明治神宮外苑 いちょう並木', area: 'yamate', ward: '新宿區（外苑所在地）', grade: 'C',
      lat: 35.6739, lng: 139.7199, coordNote: '座標為近似值（並木中點）。',
      address: '新宿区霞ヶ丘町1番1号（明治神宮外苑所在地）',
      intro: '從青山口延伸到外苑中央廣場圓周道路的四列銀杏並木；以聖德紀念繪畫館為背景的景觀聞名，樹木依高度排列，運用遠近法。',
      ginkgo: '官方：青山口到圓周道路約 300 m 的並木共 146 棵，間隔 9 m 種植（屬歷史數值，不保證為 2026 年現況）。',
      season: null,
      evidenceDate: '未見可當現況的日期（資料表原文）',
      visit: { hours: null, closed: null, fee: null },
      caveat: '這裡不是明治神宮內苑；官方沒有穩定的逐日銀杏葉況頁面，2026 年いちょう祭り也未見官方公告。',
      past: [
        { date: '2022-11-17', stage: 'migoro', text: '官方「外苑便り」文章標題：「イチョウ並木が見頃です」。', url: 'https://www.meijijingugaien.jp/gaien-news/' }
      ],
      sources: [
        { label: '明治神宮外苑｜いちょう並木の春夏秋冬', url: 'https://www.meijijingugaien.jp/walk/sight/season.html' },
        { label: '明治神宮外苑｜外苑便り', url: 'https://www.meijijingugaien.jp/gaien-news/' },
        { label: '明治神宮外苑｜交通地圖', url: 'https://www.meijijingugaien.jp/information/access-map.html' },
        { label: '明治神宮外苑｜官方首頁（所在地）', url: 'https://www.meijijingugaien.jp/' }
      ]
    },
    {
      id: 'TKG-024', nameZh: '大田黑公園', nameJa: '大田黒公園', area: 'johoku', ward: '杉並區', grade: 'B',
      lat: 35.7007, lng: 139.6248, coordNote: '座標為近似值（公園位置；整座公園約 0.9 公頃）。',
      address: '杉並区荻窪3丁目33番12号',
      intro: '音樂評論家大田黑元雄的宅邸舊址改建的區立回遊式日本庭園。',
      ginkgo: '杉並區官網：走進正門，白色御影石園路筆直延伸約 70 m，左右是樹齡百年的大銀杏並木。',
      season: null,
      evidenceDate: '區公所頁更新 2025-09-09',
      visit: { hours: '9:00–17:00（16:30 停止入園）', closed: '每週三、12/29–1/1（可能變更）', fee: null },
      caveat: '不沿用 2024 年 3 月已結束管理的箱根植木舊頁；現行入口由杉並區官網指向荻窪三庭園網站。',
      past: [],
      sources: [
        { label: '荻窪三庭園｜大田黒公園', url: 'https://ogikubo3gardens.jp/ootaguro/' },
        { label: '杉並區｜大田黒公園', url: 'https://www.city.suginami.tokyo.jp/s100/shisetsu/14632.html' }
      ]
    },
    {
      id: 'TKG-025', nameZh: '大國魂神社', nameJa: '大國魂神社', area: 'tama', ward: '府中市', grade: 'C',
      lat: 35.6676, lng: 139.479, coordNote: '座標為近似值（本殿、拜殿一帶）；大銀杏在本殿後方數十公尺內。',
      address: '府中市宮町3-1',
      intro: '府中市的古社，本殿後方有相傳樹齡約 1000 年的大銀杏。',
      ginkgo: '官方「豆知識」：大銀杏根部棲息著蜷貝，相傳有助於產後恢復。',
      season: null,
      evidenceDate: '靜態資料（資料表原文）',
      visit: { hours: '開門 9/15–3/31 6:30–17:00；4/1–9/14 6:00–17:00（祭典時可能變更）', closed: null, fee: null },
      caveat: '附近馬場大門的櫸樹並木不是銀杏。',
      past: [],
      sources: [
        { label: '大國魂神社｜豆知識（大銀杏）', url: 'https://www.ookunitamajinja.or.jp/mame/' },
        { label: '大國魂神社｜官方首頁', url: 'https://www.ookunitamajinja.or.jp/' },
        { label: '大國魂神社｜交通（開門時間）', url: 'https://www.ookunitamajinja.or.jp/access/' }
      ]
    },
    {
      id: 'TKG-026', nameZh: '靖國神社', nameJa: '靖國神社', area: 'kokyo', ward: '千代田區', grade: 'C',
      lat: 35.6941, lng: 139.7431, coordNote: '座標為近似值（境內拜殿）；參道銀杏並木的確切範圍未經核實。',
      address: '千代田区九段北3-1-1',
      intro: '位於九段北的祭祀場所；官方網站提到參道的銀杏並木。',
      ginkgo: '銀杏的佐證來自官方網站：2023-09-06 的公告提到「参道のイチョウ並木」。',
      proof: { label: '官方佐證：靖國神社公告（2023-09-06）', url: 'https://www.yasukuni.or.jp/news_detail.html?id=492' },
      season: null,
      evidenceDate: '本次可讀 2026 公告（資料表原文）',
      visit: { hours: '開門 6:00；閉門 1、2、11、12 月 17:00，3–10 月 18:00（祭典時可能變更）', closed: null, fee: null },
      caveat: '宣傳影片的上線日不等於拍攝日；境內是莊嚴的祭祀場所，請依官方參拜規定。',
      past: [],
      sources: [
        { label: '靖國神社｜官方首頁', url: 'https://www.yasukuni.or.jp/' },
        { label: '靖國神社｜境內照片', url: 'https://www.yasukuni.or.jp/schedule/photo.html' },
        { label: '靖國神社｜交通（開門・閉門時刻）', url: 'https://www.yasukuni.or.jp/access.html' }
      ]
    },
    {
      id: 'TKG-030', nameZh: '北之丸公園', nameJa: '北の丸公園', area: 'kokyo', ward: '千代田區', grade: 'B',
      lat: 35.6915, lng: 139.7511, coordNote: '座標為近似值（園區代表點）；大銀杏位於日本武道館前，未另有獨立座標。',
      address: '千代田区北の丸公園（詳細地址資料未提供）',
      intro: '皇居北側的國民公園，24 小時開放；日本武道館前有銀杏並木與被稱為「大銀杏」的園內最大銀杏。',
      ginkgo: '銀杏的佐證來自官方網站：國民公園協會 2023-11-24 文章寫日本武道館前有被稱為「大イチョウ」的特別大銀杏，園內各處也種有銀杏。',
      proof: { label: '官方佐證：國民公園協會 皇居外苑（2023-11-24）', url: 'https://fng.or.jp/koukyo/2023/11/24/kitanomarukouennnokouyou/' },
      season: null,
      evidenceDate: '本次可見 2026-09-19 季節文章入口（資料表原文）',
      visit: { hours: '24 小時開放（22 時熄燈；夜間 22 時後請避免使用）', closed: '無休（國家活動特別警備時可能限制使用）', fee: '免費' },
      caveat: '本網站只採北之丸公園；資料表同列的皇居外苑本身未經官方證實有銀杏，因此不列為景點。與宮內廳的皇居東御苑是不同來源、不同範圍。',
      past: [
        { date: '2024-11-13', stage: 'iro', text: '國民公園協會文章：園內的銀杏「才剛開始轉色」（色づき始めたばかり）。', url: 'https://fng.or.jp/koukyo/2024/11/13/irodukukitanomarukouen/' },
        { date: '2023-11-24', stage: null, text: '國民公園協會文章：日本武道館前的大銀杏，觀賞期在 12 月上旬（當年的預告，原文未寫明當日階段）。', url: 'https://fng.or.jp/koukyo/2023/11/24/kitanomarukouennnokouyou/' }
      ],
      sources: [
        { label: '國民公園協會 皇居外苑｜最新消息', url: 'https://fng.or.jp/koukyo/news/' },
        { label: '國民公園協會 皇居外苑｜交通', url: 'https://fng.or.jp/koukyo/access/' },
        { label: '環境省 皇居外苑｜北の丸公園 利用案內（24 小時開放・免費・無休）', url: 'https://www.env.go.jp/garden/kokyogaien/2_guide/kitanomarukoen_00001.html' },
        { label: '環境省 皇居外苑｜北の丸公園 紅葉期散策注意事項（22 時熄燈）', url: 'https://www.env.go.jp/garden/kokyogaien/news/2017/03/post_220_00002.html' },
        { label: '環境省 皇居外苑｜紅葉さんぽ 2016「北の丸公園の銀杏」（銀杏並木與大銀杏）', url: 'https://www.env.go.jp/garden/kokyogaien/news/autumn_leaves/index_4.html' }
      ]
    },
    {
      id: 'TKG-040-hongo', nameZh: '東京大學 本鄉校區 銀杏並木', nameJa: '東京大学 本郷キャンパス 銀杏並木', area: 'ueno', ward: '文京區', grade: 'C',
      lat: 35.7131, lng: 139.7606, coordNote: '座標為近似值（正門到安田講堂之間的並木中點）。',
      address: '文京区本郷7-3-1',
      intro: '從正門延伸到安田講堂的銀杏並木；東大官方頁面形容這裡的紅葉比周邊任何地方都壯觀，會被金黃色的銀杏葉鋪滿。',
      ginkgo: '銀杏的佐證來自官方網站：東京大學「1km of campus」頁面提到「本郷キャンパスの銀杏並木」。',
      proof: { label: '官方佐證：東京大學 1km of campus', url: 'https://www.u-tokyo.ac.jp/ja/about/campus-guide/1km_of_campus.html' },
      season: null,
      evidenceDate: '2026-04-01（地圖頁）',
      visit: { hours: '校園見學可在 7:00–18:00 範圍內（正門週末關閉，部分側門開放時間不同）', closed: '入學考試日等不可入校', fee: null },
      caveat: '本鄉、駒場與小石川植物園是不同地點；官方未提供銀杏的日期觀測。校內禁止營利導覽與商業攝影。',
      past: [],
      sources: [
        { label: '東京大學｜校區導覽', url: 'https://www.u-tokyo.ac.jp/ja/about/campus-guide/index.html' },
        { label: '東京大學｜校園見學', url: 'https://www.u-tokyo.ac.jp/ja/about/campus-guide/public02_05.html' },
        { label: '東京大學｜所在地一覽', url: 'https://www.u-tokyo.ac.jp/ja/about/campus-guide/list.html' }
      ]
    },
    {
      id: 'TKG-040-komaba', nameZh: '東京大學 駒場校區 銀杏並木', nameJa: '東京大学 駒場キャンパス 銀杏並木', area: 'yamate', ward: '目黑區', grade: 'C',
      lat: 35.6604, lng: 139.6852, coordNote: '座標為近似值（1 號館北側東西向道路的並木中段，誤差約 ±80 m）。',
      address: '目黒区駒場3-8-1',
      intro: '駒場 I 校區的主要道路（メインストリート），秋天銀杏並木把路面染成一片黃色。',
      ginkgo: '銀杏的佐證來自官方網站：東京大學網站寫「秋には銀杏並木がメインストリートを黄色に染め上げる」。',
      proof: { label: '官方佐證：東京大學「駒場キャンパス」介紹', url: 'https://kimino.ct.u-tokyo.ac.jp/kotohajime/komaba-campus/' },
      season: null,
      evidenceDate: '2026-04-01（地圖頁）',
      visit: { hours: '駒場 I 校區的見學規則需另向校方確認（資料未提供）', closed: null, fee: null },
      caveat: '本鄉、駒場與小石川植物園是不同地點；官方未提供銀杏的日期觀測。',
      past: [],
      sources: [
        { label: '東京大學｜校區導覽', url: 'https://www.u-tokyo.ac.jp/ja/about/campus-guide/index.html' },
        { label: '東京大學｜所在地一覽', url: 'https://www.u-tokyo.ac.jp/ja/about/campus-guide/list.html' }
      ]
    },
    {
      id: 'TKG-041', nameZh: '國立 大學通', nameJa: '国立 大学通り', area: 'tama', ward: '國立市', grade: 'C',
      lat: 35.6945, lng: 139.4468, coordNote: '座標為近似值（國立站南側並木的代表點）；座標資料無法區分銀杏列與櫻花列。',
      address: '国立市東2丁目（くにたちNAVI「大学通り」頁面的所在地欄）',
      intro: '從國立站筆直向南延伸、文教地區的代表性大道；春天有櫻花，秋天被銀杏的黃色覆蓋。冬季站前沿路 10 棵銀杏會掛上約 9 萬顆 LED。',
      ginkgo: '銀杏的佐證來自官方網站：國立市觀光まちづくり協會的「大學通」頁面描述秋天一帶被銀杏的黃色覆蓋。',
      proof: { label: '官方佐證：くにたちNAVI「大学通り」', url: 'https://kunimachi.jp/spot/daigakustreet/' },
      season: null,
      evidenceDate: '本次可見 2026-09-25 更新（資料表原文）',
      visit: { hours: null, closed: null, fee: null },
      caveat: '大學通也有櫻樹；地方觀光網站的更新不等於銀杏現況。',
      past: [],
      sources: [
        { label: 'くにたちNAVI｜官方首頁', url: 'https://kunimachi.jp/' }
      ]
    }
  ],

  /* 資料表中未列為景點的來源（只在「資料來源」區揭露） */
  otherRows: [
    { id: 'TKG-001', name: '東京都公園協會｜紅葉情報入口', grade: 'S', url: 'https://www.tokyo-park.or.jp/', reason: '年度葉況入口；本網站採用其 2025 年度新聞稿作為 S 級景點的銀杏依據。2026 年度頁面尚未開設。' },
    { id: 'TKG-020', name: '氣象廳｜いちょうの黄葉日', grade: 'O', url: 'https://www.data.jma.go.jp/sakura/data/phn_012.html', reason: '觀測站尺度；用於「狀態辨識」中的東京參考時間軸，不當景點狀態。' },
    { id: 'TKG-021', name: '氣象廳｜いちょうの落葉日', grade: 'O', url: 'https://www.data.jma.go.jp/sakura/data/phn_013.html', reason: '同上，用於參考時間軸。' },
    { id: 'TKG-022', name: '氣象廳｜生物季節累年值 CSV 入口', grade: 'O', url: 'https://www.data.jma.go.jp/sakura/data/download_ruinenchi.html', reason: '平年值與歷年日期的來源。' },
    { id: 'TKG-027', name: 'GO TOKYO｜秋季紅葉指南', grade: 'C', url: 'https://www.gotokyo.org/jp/story/guide/autumn-leaves-forecast/index.html', reason: '觀光入口，非景點管理單位；未採用。' },
    { id: 'TKG-028', name: '千代田區觀光協會｜景點／專題', grade: 'C', url: 'https://visit-chiyoda.tokyo/app/spot', reason: '區域入口；未證實逐點銀杏觀測，未採用。' },
    { id: 'TKG-029', name: '新宿觀光振興協會｜官方入口', grade: 'C', url: 'https://www.kanko-shinjuku.jp/', reason: '觀光入口；不能取代新宿御苑的植物報告，未採用。' },
    { id: 'TKG-030', name: '皇居外苑（同列）', grade: 'B', url: 'https://fng.or.jp/koukyo/news/', reason: '同列的北之丸公園已列為景點；皇居外苑本身未經官方證實有銀杏。' },
    { id: 'TKG-031', name: '神代植物公園', grade: 'B', url: 'https://www.tokyo-park.or.jp/park/jindai/', reason: '2025 年度中央名單記錄的是楓樹，不是銀杏。' },
    { id: 'TKG-032', name: '府中市鄉土之森博物館｜花ごよみ', grade: 'B', url: 'https://www.fuchu-cpf.or.jp/museum/hanagoyomi/index.html', reason: '銀杏物種與現況均待補證。' },
    { id: 'TKG-033', name: 'tenki.jp｜東京都紅葉情報', grade: 'T', url: 'https://tenki.jp/kouyou/3/16/', reason: '第三方整合平台；僅作資訊架構參考。' },
    { id: 'TKG-034', name: 'Weathernews｜東京都紅葉情報', grade: 'T', url: 'https://weathernews.jp/koyo/area/tokyo/', reason: '第三方平台；僅作資訊架構參考。' },
    { id: 'TKG-035', name: 'WalkerPlus｜東京 黃色に色づく', grade: 'T', url: 'https://koyo.walkerplus.com/yellow/ar0313/', reason: '第三方目錄，含其他黃葉樹種；未採用。' },
    { id: 'TKG-036', name: 'Jorudan｜東京都 紅葉情報', grade: 'T', url: 'https://sp.jorudan.co.jp/leaf/tokyo.html', reason: '第三方目錄；未採用。' },
    { id: 'TKG-037', name: '日本氣象株式會社｜紅葉・黃葉見頃預想', grade: 'T', url: 'https://n-kishou.com/corp/news-contents/autumn/', reason: '民間預報產品（不是氣象廳）；未採用。' },
    { id: 'TKG-038', name: '東京都公園協會｜2025 紅葉季舊專頁', grade: 'X', url: 'https://www.tokyo-park.or.jp/special/kouyou/index.html', reason: '已失效（404），只保留紀錄。' },
    { id: 'TKG-039', name: '箱根植木｜大田黑公園舊管理案例', grade: 'X', url: 'https://hakone-ueki.com/casestudy/case1/', reason: '管理已於 2024 年 3 月結束，排除。' }
  ]
};
