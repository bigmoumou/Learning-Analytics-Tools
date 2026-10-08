/* 東京櫻花地圖與散步指南：資料檔
   所有櫻花相關事實都在 2026-10-08 直接檢視官方頁面後整理；
   找不到官方說法的欄位一律寫「待確認」，不推測、不編造。
   座標為「園區近似位置」，只用來估算直線距離與標在地圖上。 */
window.SAKURA_DATA = {
  checkedOn: '2026-10-08',

  /* 氣象庁（JMA）東京：さくら開花・満開 */
  jma: {
    station: '東京',
    normalPeriod: '1991–2020',
    // 平年值（JMA 生物季節累年表 004 / 005，東京列：324、331；官方頁面顯示 3月24日、3月31日）
    bloomNormal: [3, 24],
    fullNormal: [3, 31],
    // 2026 年春天的實際觀測（JMA 頁面；靖國神社公告相符），只當作過去紀錄
    observed2026: { bloom: [3, 19], full: [3, 28] },
    // 歷年觀測（JMA 累年表 CSV，東京）：[開花, 満開]
    history: {
      2011: [[3, 28], [4, 6]], 2012: [[3, 31], [4, 6]], 2013: [[3, 16], [3, 22]],
      2014: [[3, 25], [3, 30]], 2015: [[3, 23], [3, 29]], 2016: [[3, 21], [3, 31]],
      2017: [[3, 21], [4, 2]], 2018: [[3, 17], [3, 24]], 2019: [[3, 21], [3, 27]],
      2020: [[3, 14], [3, 22]], 2021: [[3, 14], [3, 22]], 2022: [[3, 20], [3, 27]],
      2023: [[3, 14], [3, 22]], 2024: [[3, 29], [4, 4]], 2025: [[3, 24], [3, 30]],
      2026: [[3, 19], [3, 28]]
    },
    extremes: { bloomEarliest: [3, 14], bloomLatest: [4, 11], fullEarliest: [3, 21], fullLatest: [4, 17] },
    links: {
      bloom: 'https://www.data.jma.go.jp/sakura/data/sakura_kaika.html',
      full: 'https://www.data.jma.go.jp/sakura/data/sakura_mankai.html',
      download: 'https://www.data.jma.go.jp/sakura/data/download_ruinenchi.html',
      terms: 'https://www.data.jma.go.jp/kagoshima/obs/seibutsu_kisetsu.html'
    }
  },

  /* 銀杏參考模板（只作參考；平年值錨點取自 JMA 東京：黃葉 11/23、落葉 12/3） */
  ginkgo: {
    anchors: { yellowNormal: [11, 23], fallNormal: [12, 3] },
    stages: [
      { ja: '青葉', range: '～10/25' },
      { ja: '色づき始め', range: '10/26–11/8' },
      { ja: '黄葉進行', range: '11/9–11/22' },
      { ja: '見頃', range: '11/23–11/28' },
      { ja: '落葉始め', range: '11/29–12/2' },
      { ja: '落葉', range: '12/3～' }
    ],
    link: 'https://www.data.jma.go.jp/sakura/data/phn_012.html'
  },

  /* 賞櫻名所。mapped:false 的兩處在郊外，只列在清單，不標在地圖、不排進散步路線。 */
  spots: [
    {
      id: 'ueno', ja: '上野恩賜公園', zh: '上野恩賜公園', area: '台東區',
      lat: 35.713, lng: 139.7724, coordNote: '園區中心（近似）', mapped: true,
      intro: '官方頁面稱上野之山從江戶時代起就是「桜の名所」，賞花季人潮很多（官方寫延べ近 330 萬人）。公園內約有 1,200 棵櫻花。',
      bloom: [
        '染井吉野、小松乙女：3 月下旬至 4 月上旬為見頃',
        '寒桜 2–3 月、大寒桜 3 月中旬等早開品種',
        '一葉 4 月中旬、関山與普賢象 4 月中旬至下旬（八重櫻較晚）'
      ],
      bloomNote: '以上是官方植物曆頁面（更新於 2023-03-04）的「常年大約時期」，不是今年的花況。',
      visit: '開園時間：東京都公園協會頁面寫「常時開園」，東京都建設局頁面寫「午前 5 時至午後 11 時」，兩者不同，待確認。入園免費。',
      closed: '',
      links: [
        { label: '東京都公園協會：公園頁', url: 'https://www.tokyo-park.or.jp/park/ueno/' },
        { label: '東京都建設局：植物曆（櫻花品種與花期）', url: 'https://www.kensetsu.metro.tokyo.lg.jp/jimusho/toubuk/ueno/midokoro/shizen' }
      ]
    },
    {
      id: 'shinjuku', ja: '新宿御苑', zh: '新宿御苑', area: '新宿區',
      lat: 35.6852, lng: 139.7097, coordNote: '園區中心（近似）', mapped: true,
      intro: '官方頁面介紹園內有約 70 品種、約 900 棵櫻花，從早開到晚開，可以賞很久。',
      bloom: [
        '早開的寒櫻類：1 月至 3 月上旬（約 20 棵）',
        '染井吉野：3 月下旬至 4 月上旬（約 300 棵）',
        '一葉 4 月上旬至中旬、関山 4 月中旬至下旬（八重櫻）',
        '十月桜是一年開兩次的品種，官方寫秋天（10 月起）與春天（3 月）都會開花；本站沒有秋季花況資料'
      ],
      bloomNote: '以上是環境省官方頁面的「花期」說明，不是今年的花況。',
      visit: '3/15–6/10 開園 9:00–18:00（最終入園 17:30）；一般入園 500 日圓；週一休園（遇假日順延至次一平日）。春季特別開園 3/25–4/24 無休。',
      closed: '週一休園（春季特別開園期間 3/25–4/24 除外）',
      links: [
        { label: '環境省：新宿御苑の桜', url: 'https://policies.env.go.jp/national-garden/shinjukugyoen/highlights/sakura/' },
        { label: '國民公園協會：入園案內', url: 'https://fng.or.jp/shinjuku/guide/' }
      ]
    },
    {
      id: 'yoyogi', ja: '代々木公園', zh: '代代木公園', area: '澀谷區',
      lat: 35.6717, lng: 139.6965, coordNote: '園區中心（近似）', mapped: true,
      intro: '東京都公園協會的公園頁在「主要植物」列有サクラ（ソメイヨシノ）。',
      bloom: [
        '官方「花の見ごろ情報」春季欄列出ソメイヨシノ、カワヅザクラ',
        '官方只寫「春」，沒有日期，所以本站不替它推測花期'
      ],
      bloomNote: '代代木公園官方頁面沒有提供櫻花日期，待確認。',
      visit: '開園日：常時開園。入園免費（部分設施收費）。',
      closed: '',
      links: [
        { label: '東京都公園協會：公園頁', url: 'https://www.tokyo-park.or.jp/park/yoyogi/' }
      ]
    },
    {
      id: 'yasukuni', ja: '靖國神社', zh: '靖國神社', area: '千代田區',
      lat: 35.6941, lng: 139.7431, coordNote: '拜殿附近', mapped: true,
      intro: '官方說明境內自古就是賞櫻名所，並有氣象廳（東京管區氣象台）指定的東京櫻花「標本木」（染井吉野）。神社公告的開花與満開，就是這棵標本木的觀測。',
      bloom: [
        '2026 年春天：開花 3/19、満開 3/28（靖國神社公告，與氣象廳一致）',
        '官方沒有寫通用的見頃期間'
      ],
      bloomNote: '這是過去一季的紀錄，不是現在的狀態。神社是祭祀場所，參觀時請留意禮儀。',
      visit: '開門 6:00；閉門 3–10 月 18:00、11–2 月 17:00（祭典等可能變更）。',
      closed: '',
      links: [
        { label: '靖國神社：境內案內（靖國の桜）', url: 'https://www.yasukuni.or.jp/precincts/map.html' },
        { label: '靖國神社：満開公告（2026-03-28）', url: 'https://www.yasukuni.or.jp/news_detail.html?id=692' }
      ]
    },
    {
      id: 'higashigyoen', ja: '皇居東御苑', zh: '皇居東御苑', area: '千代田區',
      lat: 35.687, lng: 139.7574, coordNote: '園區中心（近似）', mapped: true,
      intro: '官方介紹園內有約 30 種櫻花，「桜の島」可看到其中約一半的品種。注意：這裡不是皇居外苑。',
      bloom: [
        '官方寫 2 月到 4 月，各種形狀與顏色的櫻花陸續開放',
        '沒有各品種的細部日期，待確認'
      ],
      bloomNote: '官方只給大範圍月份，不是今年的花況。',
      visit: '3/1–4/14 開放 9:00–17:00（入園至 16:30）；不需入園費與預約。週一、週五休園（國民假日原則上開放）。',
      closed: '週一、週五休園',
      links: [
        { label: '宮內廳：皇居東御苑', url: 'https://www.kunaicho.go.jp/visit/higashigyoen/index.html' },
        { label: '宮內廳：苑內的樹木與庭園（桜の島）', url: 'https://www.kunaicho.go.jp/visit/higashigyoen/structures-gardens/index.html' }
      ]
    },
    {
      id: 'koganei', ja: '小金井公園', zh: '小金井公園', area: '小金井市（郊外）',
      lat: 35.7155, lng: 139.5189, coordNote: '園區中心（近似）', mapped: false,
      intro: '官方頁面稱它是「伝統受け継ぐサクラの名所」。園內約 50 種、約 1,400 棵櫻花，其中約 400 棵在「桜の園」（2.9 公頃）。',
      bloom: [
        '官方寫「一か月にわたって様々なサクラが春を彩る」',
        '相鄰的玉川上水櫻花並木於 1924 年被指定為國家名勝'
      ],
      bloomNote: '官方沒有寫具體日期，待確認。距離市區較遠，未標在地圖與路線中。',
      visit: '開園日：常時開園。入園免費（部分設施收費）。',
      closed: '',
      links: [
        { label: '東京都公園協會：公園頁', url: 'https://www.tokyo-park.or.jp/park/koganei/' }
      ]
    },
    {
      id: 'showa', ja: '国営昭和記念公園', zh: '國營昭和紀念公園', area: '立川市（郊外）',
      lat: 35.7095, lng: 139.3948, coordNote: '園區中心（近似）', mapped: false,
      intro: '官方花情報頁面寫園內種有 31 品種、約 1,500 棵櫻花，其中一半是染井吉野，「桜の園・旧桜の園」有樹齡約 50 年的大樹。',
      bloom: [
        '官方列出：3 月下旬至 4 月中旬（桜の園・旧桜の園等）',
        '官方註明見頃每年不同，請看「花だより」'
      ],
      bloomNote: '這是官方的常年大約時期，不是今年的花況。距離市區較遠，未標在地圖與路線中。',
      visit: '開園時間與休園日請看官方頁面（本站未查證）。',
      closed: '',
      links: [
        { label: '昭和記念公園：花情報', url: 'https://www.showakinen-koen.jp/flower-information/' }
      ]
    }
  ],

  /* 散步路線。距離由程式用座標算直線距離；停留時間是編者的建議值。 */
  routes: [
    {
      id: 'half', title: '半日路線', sub: '靖國神社 → 新宿御苑 → 代代木公園',
      stops: [
        { id: 'yasukuni', stay: 45 },
        { id: 'shinjuku', stay: 90 },
        { id: 'yoyogi', stay: 60 }
      ],
      note: '一路向西，適合半天。新宿御苑週一休園（春季特別開園期間除外）。'
    },
    {
      id: 'day', title: '一日路線', sub: '上野 → 皇居東御苑 → 靖國神社 → 新宿御苑 → 代代木公園',
      stops: [
        { id: 'ueno', stay: 90 },
        { id: 'higashigyoen', stay: 60 },
        { id: 'yasukuni', stay: 45 },
        { id: 'shinjuku', stay: 90 },
        { id: 'yoyogi', stay: 60 }
      ],
      note: '從東邊的上野一路走到西邊的代代木。週一新宿御苑與皇居東御苑休園、週五皇居東御苑休園，請避開這些日子。'
    }
  ],

  walkSpeedMPerMin: 80
};
