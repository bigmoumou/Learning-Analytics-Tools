/* 銀杏觀測誌｜資料檔
 * 由課程資料表（東京銀杏各地點官方資料來源，逐列查核 2026-09-29）與 2026-10-02 共用核實快照整理而成。
 * places：地圖地點（座標為園區代表點，概略；取自共用快照，由 OpenStreetMap 等公開圖資平均或推定，非官方座標）；history：過去季附日期的官方紀錄（不是現況）；
 * current2026：2026 年官方動態（未標明階段）；sources：來源清單（重複網址已合併）。
 * 當季狀態：沒有任何官方來源同時明確指出銀杏、地點與日期，所以全部是「待確認」。
 */
var GINKGO_DATA = {
 "meta": {
  "title": "銀杏觀測誌",
  "snapshot": "2026-10-02",
  "sheetAudit": "2026-09-29",
  "latestCheck": "2026-10-02",
  "season": "2026 年秋季",
  "noDataReason": "截至 2026-10-02 快照，沒有任何官方來源發布 2026 年銀杏葉況",
  "sheetUrl": "https://docs.google.com/spreadsheets/d/1dx_41InyuuWuILc4ZHJW8tTZMVOCpIuSz-QzISzd7y0/edit?usp=sharing",
  "walkSpeed": 80,
  "coordSource": "2026-10-02 共用快照，由 OpenStreetMap／Nominatim、Wikipedia 等公開圖資平均或推定，不是官方座標",
  "jma": {
   "station": "東京",
   "yellowNormal": "11/23",
   "fallNormal": "12/3",
   "normalPeriod": "1991–2020",
   "yellow2025": "11/22",
   "fall2025": "12/4",
   "yellow2026": null,
   "fall2026": null,
   "yellowUrl": "https://www.data.jma.go.jp/sakura/data/phn_012.html",
   "fallUrl": "https://www.data.jma.go.jp/sakura/data/phn_013.html"
  }
 },
 "stages": [
  {
   "key": "青葉",
   "gloss": "綠葉"
  },
  {
   "key": "色づき始め",
   "gloss": "開始轉色"
  },
  {
   "key": "黄葉進行",
   "gloss": "黃葉進行中"
  },
  {
   "key": "見頃",
   "gloss": "最佳觀賞"
  },
  {
   "key": "落葉始め",
   "gloss": "開始落葉"
  },
  {
   "key": "落葉",
   "gloss": "落葉"
  }
 ],
 "grades": {
  "S": "官方公園協會",
  "A": "官方附日期的現地觀測",
  "B": "官方來源，銀杏專項資料待補",
  "C": "官方網站或入口，無附日期觀測",
  "O": "氣象廳觀測站尺度",
  "T": "第三方整合平台",
  "X": "排除或失效來源"
 },
 "wardGroups": [
  {
   "label": "東京 23 區",
   "wards": [
    "千代田區",
    "港區",
    "新宿區",
    "文京區",
    "台東區",
    "江東區",
    "目黑區",
    "澀谷區",
    "杉並區",
    "練馬區",
    "板橋區"
   ]
  },
  {
   "label": "多摩地區",
   "wards": [
    "八王子市",
    "立川市",
    "昭島市",
    "府中市",
    "小金井市",
    "國立市",
    "秋留野市"
   ]
  }
 ],
 "places": [
  {
   "id": "TKG-002",
   "row": "TKG-002",
   "zh": "上野恩賜公園",
   "ja": "上野恩賜公園",
   "wards": [
    "台東區"
   ],
   "wardNote": null,
   "alias": "上野 ueno 不忍池",
   "grade": "S",
   "operator": "公益財團法人東京都公園協會",
   "sheetName": "上野恩賜公園",
   "sheetArea": "台東區",
   "caveat": "可列為銀杏專項季節觀測候選。",
   "species": "銀杏",
   "lat": 35.713,
   "lng": 139.7724,
   "pointLabel": "公園中心（概略）",
   "pointBasis": "公園整體的代表點（各來源座標平均）",
   "pointNote": "大型公園，銀杏的具體位置在可讀頁面未載明（東京都公園協會2025名單只列到園區層級）；僅適合標示「園區」而非單棵樹。",
   "pointConfidence": "low",
   "ginkgo": "東京都公園協會的園區頁沒有提到銀杏；東京都建設局上野公園頁的「主な植物」列有イチョウ，但未載明位置。地點資格依資料表引用的 2025 年度名單。",
   "season": "東京都建設局上野公園頁植物月曆的イチョウ項目寫「晩秋に黄金色に変わる。11月下旬から12月中旬が紅葉の見頃」（頁面更新 2023-03-04，例年說法）",
   "proof": null,
   "status": "待確認",
   "checked": "2026-10-02",
   "links": [
    {
     "role": "主要網址",
     "url": "https://www.tokyo-park.or.jp/park/ueno/"
    },
    {
     "role": "證據頁",
     "date": "2025-11-04",
     "url": "https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf"
    }
   ],
   "facts": {
    "address": "台東区上野公園・池之端三丁目",
    "access": [
     "JR山手線・JR京浜東北線・JR高崎線・JR宇都宮線・東京メトロ銀座線・東京メトロ日比谷線「上野」(G16･H17)下車 徒歩2分（東京都公園協会の園ページ）",
     "京成本線「京成上野」下車 徒歩1分（同上）",
     "東京都建設局の上野公園ページ：JR各線「上野」徒歩2分／東京メトロ銀座線・日比谷線「上野」徒歩4分／都営地下鉄大江戸線「上野御徒町」徒歩5分／京成本線「京成上野」徒歩1分"
    ],
    "hours": {
     "text": "東京都公園協会の園ページ：常時開園／東京都建設局の上野公園ページ：午前5時～午後11時（時間外は立入禁止）",
     "note": "兩個官方頁面說法不一致，待確認。"
    },
    "closed": "なし（常時開園）。※サービスセンター及び各施設は年末年始は休業",
    "fee": "無料（一部有料施設あり）",
    "phone": "03-3828-5644",
    "events": [],
    "unverified": [
     "開放時間：兩個官方頁面說法不同（東京都公園協會頁寫「常時開園」，東京都建設局頁寫「午前5時～午後11時」）",
     "園內銀杏的具體位置：官方頁面未載明"
    ],
    "verified": "2026-10-02"
   },
   "allLinks": [
    {
     "role": "主要網址",
     "url": "https://www.tokyo-park.or.jp/park/ueno/"
    },
    {
     "role": "證據頁",
     "date": "2025-11-04",
     "url": "https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf"
    },
    {
     "role": "訪客資訊",
     "url": "https://www.kensetsu.metro.tokyo.lg.jp/jimusho/toubuk/ueno/kouenannai"
    },
    {
     "role": "訪客資訊",
     "url": "https://www.kensetsu.metro.tokyo.lg.jp/jimusho/toubuk/ueno/access"
    },
    {
     "role": "訪客資訊",
     "url": "https://www.kensetsu.metro.tokyo.lg.jp/jimusho/toubuk/ueno/rules"
    },
    {
     "role": "訪客資訊",
     "url": "https://www.kensetsu.metro.tokyo.lg.jp/jimusho/toubuk/ueno/midokoro/shizen"
    }
   ]
  },
  {
   "id": "TKG-003",
   "row": "TKG-003",
   "zh": "木場公園",
   "ja": "木場公園",
   "wards": [
    "江東區"
   ],
   "wardNote": null,
   "alias": "木場 kiba",
   "grade": "S",
   "operator": "公益財團法人東京都公園協會",
   "sheetName": "木場公園",
   "sheetArea": "江東區",
   "caveat": "保留園區原文所指子地點。",
   "species": "銀杏",
   "lat": 35.6752,
   "lng": 139.8085,
   "pointLabel": "公園中心（概略）",
   "pointBasis": "公園整體的代表點（平均）",
   "pointNote": "公園被木場公園大橋分成南北兩半，座標平均後落在中間；銀杏位置未載明。",
   "pointConfidence": "low",
   "ginkgo": "園區頁面沒有提到銀杏（秋季見頃列為キンモクセイ、トウカエデ等）；銀杏資格只來自資料表引用的 2025 年度名單。",
   "season": null,
   "proof": null,
   "status": "待確認",
   "checked": "2026-10-02",
   "links": [
    {
     "role": "主要網址",
     "url": "https://www.tokyo-park.or.jp/park/kiba/"
    },
    {
     "role": "證據頁",
     "date": "2025-11-04",
     "url": "https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf"
    }
   ],
   "facts": {
    "address": "江東区木場四・五丁目・平野四丁目・三好四丁目・東陽六丁目",
    "access": [
     "東京メトロ東西線「木場駅」（T13）下車 徒歩10分",
     "東京メトロ半蔵門線、都営大江戸線「清澄白河駅」（Z11、E14）下車 徒歩15分",
     "都営新宿線「菊川駅」（S12）下車 徒歩15分",
     "都営バス [都07、東22、木11甲] 系統「木場駅前」下車 徒歩5分",
     "都営バス [錦13] 系統「東陽六丁目」下車 徒歩3分",
     "都営バス [門21] 系統「木場三丁目」「木場四丁目」下車",
     "都営バス [業10] 系統「木場三丁目」「木場四丁目」「木場公園」「東京都現代美術館前」下車"
    ],
    "hours": {
     "text": "常時開園"
    },
    "closed": {
     "text": "なし（常時開園）。※サービスセンター及び各施設は年末年始は休業。【木場ミドリアム】休館日：毎週月曜日（祝日の場合はその翌日）、年末年始",
     "note": "園區頁 2026-09-28 公告：木場ミドリアム因施工閉館。"
    },
    "fee": "無料（一部有料施設あり）",
    "phone": "03-5245-1770",
    "events": [],
    "unverified": [
     "園內銀杏的位置：官方園區頁沒有提到銀杏，銀杏資格只來自 2025 年度名單",
     "開放時間：官方頁面只寫「常時開園」，沒有列出時段"
    ],
    "verified": "2026-10-02"
   },
   "allLinks": [
    {
     "role": "主要網址",
     "url": "https://www.tokyo-park.or.jp/park/kiba/"
    },
    {
     "role": "證據頁",
     "date": "2025-11-04",
     "url": "https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf"
    },
    {
     "role": "訪客資訊",
     "url": "https://www.tokyo-park.or.jp/park/kiba/assets/公園利用の注意事項（木場公園）（PDF）.pdf"
    }
   ]
  },
  {
   "id": "TKG-004",
   "row": "TKG-004",
   "zh": "小金井公園",
   "ja": "小金井公園",
   "wards": [
    "小金井市"
   ],
   "wardNote": "園區跨小金井市、小平市、西東京市、武藏野市（資料表寫「小金井市等」）。",
   "alias": "小金井 koganei",
   "grade": "S",
   "operator": "公益財團法人東京都公園協會",
   "sheetName": "小金井公園",
   "sheetArea": "小金井市等",
   "caveat": "園區跨行政區；不以服務中心地址代表全部觀測點。",
   "species": "銀杏",
   "lat": 35.7155,
   "lng": 139.5189,
   "pointLabel": "公園中心（概略）",
   "pointBasis": "公園整體的代表點（平均）",
   "pointNote": "約77公頃的大型公園；官方頁面僅列「秋：イチョウ」，無具體地點。",
   "pointConfidence": "low",
   "ginkgo": "園區頁「花の見ごろ情報（秋）」列有イチョウ，但未載明位置。",
   "season": null,
   "proof": null,
   "status": "待確認",
   "checked": "2026-10-02",
   "links": [
    {
     "role": "主要網址",
     "url": "https://www.tokyo-park.or.jp/park/koganei/"
    },
    {
     "role": "證據頁",
     "date": "2025-11-04",
     "url": "https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf"
    }
   ],
   "facts": {
    "address": "小金井市桜町三丁目、関野町一・二丁目、小平市花小金井南町三丁目、西東京市向台町六丁目、武蔵野市桜堤三丁目",
    "access": [
     "JR中央線「武蔵小金井」から西武バス「小金井公園西口」下車、関東バス「江戸東京たてもの園前」・「小金井公園前」・「スポーツセンター入口」下車",
     "JR中央線「東小金井駅」からCoCoバス「小金井公園入口」下車",
     "西武新宿線「花小金井」から西武バス「小金井公園西口」下車",
     "駐車場（第一431台、第二126台・有料・24時間）",
     "※土・日・祝日のご来園は五日市街道が渋滞しますので、公共交通機関をご利用ください"
    ],
    "hours": {
     "text": "常時開園（サービスセンター開所時間8：30～17：30）"
    },
    "closed": "なし（常時開園）。※サービスセンター及び各施設は年末年始は休業",
    "fee": "無料（一部有料施設あり）",
    "phone": "042-385-5611",
    "events": [],
    "unverified": [
     "交通的步行時間：官方頁面只列出公車站，沒有寫步行分鐘數",
     "園內銀杏的具體位置：官方頁面未載明"
    ],
    "verified": "2026-10-02"
   },
   "allLinks": [
    {
     "role": "主要網址",
     "url": "https://www.tokyo-park.or.jp/park/koganei/"
    },
    {
     "role": "證據頁",
     "date": "2025-11-04",
     "url": "https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf"
    }
   ]
  },
  {
   "id": "TKG-005",
   "row": "TKG-005",
   "zh": "芝公園",
   "ja": "芝公園",
   "wards": [
    "港區"
   ],
   "wardNote": null,
   "alias": "芝 shiba siba 増上寺 增上寺",
   "grade": "S",
   "operator": "公益財團法人東京都公園協會",
   "sheetName": "芝公園",
   "sheetArea": "港區",
   "caveat": "銀杏與もみじ谷分開。正確網址使用siba，不是shiba。",
   "species": "楓樹、銀杏",
   "lat": 35.6555,
   "lng": 139.748,
   "pointLabel": "公園中心（概略；銀杏位置未核實）",
   "pointBasis": "環狀公園整體的代表點（平均）",
   "pointNote": "東京都公園協會頁面只寫「クスノキ、ケヤキ、イチョウなどの大木がところどころにあります」，無具體地點，故不能指到單一銀杏。正確網址為siba（不是shiba）。もみじ谷另列一點，且那是楓不是銀杏。",
   "pointConfidence": "low",
   "ginkgo": "官方：園內各處有クスノキ、ケヤキ、イチョウ等大樹，未載明具體位置。もみじ谷是楓樹區，不是銀杏，本站不把它當銀杏地點。",
   "season": null,
   "proof": null,
   "status": "待確認",
   "checked": "2026-10-02",
   "links": [
    {
     "role": "主要網址",
     "url": "https://www.tokyo-park.or.jp/park/siba/"
    },
    {
     "role": "證據頁",
     "date": "2025-11-04",
     "url": "https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf"
    }
   ],
   "facts": {
    "address": "港区芝公園一・二・三・四丁目",
    "access": [
     "JR「浜松町」下車 徒歩12分",
     "都営地下鉄三田線「芝公園」(I05)下車 徒歩2分、「御成門」(I06)下車 徒歩2分",
     "都営地下鉄浅草線・大江戸線「大門」(A09･E20)下車 徒歩5分",
     "都営地下鉄大江戸線「赤羽橋」(E21)下車 徒歩2分",
     "※駐車場はありません"
    ],
    "hours": {
     "text": "常時開園"
    },
    "closed": "なし（常時開園）。※サービスセンター及び各施設は年末年始は休業",
    "fee": "無料（一部有料施設あり）",
    "phone": "03-3431-4359",
    "events": [],
    "unverified": [
     "園內銀杏的具體位置：官方頁面未載明"
    ],
    "verified": "2026-10-02"
   },
   "allLinks": [
    {
     "role": "主要網址",
     "url": "https://www.tokyo-park.or.jp/park/siba/"
    },
    {
     "role": "證據頁",
     "date": "2025-11-04",
     "url": "https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf"
    },
    {
     "role": "訪客資訊",
     "url": "https://www.tokyo-park.or.jp/park/siba/assets/files/shiba_eng.pdf"
    }
   ]
  },
  {
   "id": "TKG-006",
   "row": "TKG-006",
   "zh": "城北中央公園",
   "ja": "城北中央公園",
   "wards": [
    "板橋區",
    "練馬區"
   ],
   "wardNote": null,
   "alias": "城北 johoku",
   "grade": "S",
   "operator": "公益財團法人東京都公園協會",
   "sheetName": "城北中央公園",
   "sheetArea": "板橋區、練馬區",
   "caveat": "必須按物種取值，不把櫸樹葉況套用銀杏。",
   "species": "銀杏、櫸樹",
   "lat": 35.7564,
   "lng": 139.673,
   "pointLabel": "公園中心（概略）",
   "pointBasis": "公園整體的代表點（平均）",
   "pointNote": "東京都公園協會頁面寫「秋にはイチョウ並木が綺麗に色付きます」，但未說並木在哪裡；約26公頃。",
   "pointConfidence": "low",
   "ginkgo": "官方：「秋にはイチョウ並木が綺麗に色付きます」，照片標示「イチョウ並木_正門」；並木確切位置未載明。依資料表提醒，櫸樹葉況不可套用到銀杏。",
   "season": null,
   "proof": null,
   "status": "待確認",
   "checked": "2026-10-02",
   "links": [
    {
     "role": "主要網址",
     "url": "https://www.tokyo-park.or.jp/park/johoku-chuo/"
    },
    {
     "role": "證據頁",
     "date": "2025-11-04",
     "url": "https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf"
    }
   ],
   "facts": {
    "address": "板橋区桜川一丁目、小茂根五丁目、練馬区氷川台一丁目、羽沢三丁目",
    "access": [
     "東武東上線「上板橋」下車 徒歩15分",
     "東京メトロ副都心線「氷川台」(F05)・東京メトロ有楽町線「氷川台」(Y05)下車 徒歩20分",
     "駐車場（有料）。※収容台数が少なく、近くにも駐車できるスペースがないのでなるべく公共機関を利用"
    ],
    "hours": {
     "text": "常時開園"
    },
    "closed": "なし（常時開園）。※サービスセンター及び各施設は年末年始は休業",
    "fee": "無料（一部有料施設あり）",
    "phone": "03-3931-3650",
    "events": [],
    "unverified": [
     "銀杏並木的確切位置：官方頁面只有一張標示「正門」的照片"
    ],
    "verified": "2026-10-02"
   },
   "allLinks": [
    {
     "role": "主要網址",
     "url": "https://www.tokyo-park.or.jp/park/johoku-chuo/"
    },
    {
     "role": "證據頁",
     "date": "2025-11-04",
     "url": "https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf"
    }
   ]
  },
  {
   "id": "TKG-007",
   "row": "TKG-007",
   "zh": "善福寺川綠地",
   "ja": "善福寺川緑地",
   "wards": [
    "杉並區"
   ],
   "wardNote": null,
   "alias": "善福寺川 zempukuji",
   "grade": "S",
   "operator": "公益財團法人東京都公園協會",
   "sheetName": "善福寺川緑地",
   "sheetArea": "杉並區",
   "caveat": "2025表與和田堀公園合併一列，不能假設各有獨立觀測。",
   "species": "銀杏",
   "lat": 35.692,
   "lng": 139.6305,
   "pointLabel": "公園中心（概略；沿河線狀公園）",
   "pointBasis": "沿善福寺川的線狀公園，取兩來源平均",
   "pointNote": "線狀公園（成田東～荻窪），兩個座標相距約450 m，只能當概略位置；銀杏地點未載明。",
   "pointConfidence": "low",
   "ginkgo": "官方：秋季ケヤキ、イチョウ、トウカエデ、サクラ等轉紅（全園描述，未載明位置）。2025 年度名單把本綠地與和田堀公園合為一列，不能假設兩處各有獨立觀測。",
   "season": null,
   "proof": null,
   "status": "待確認",
   "checked": "2026-10-02",
   "links": [
    {
     "role": "主要網址",
     "url": "https://www.tokyo-park.or.jp/park/zempukujigawa-ryokuchi/index.html"
    },
    {
     "role": "證據頁",
     "date": "2025-11-04",
     "url": "https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf"
    }
   ],
   "facts": {
    "address": "杉並区成田東二・三・四丁目、成田西一・三・四丁目、荻窪一丁目",
    "access": [
     "京王井の頭線「西永福」・「浜田山」下車 徒歩15分",
     "関東バス（JR中野駅-吉祥寺駅）「善福寺川緑地公園前」「杉並第二小前」「五日市街道営業所」下車",
     "「すぎ丸」バス（阿佐ヶ谷-浜田山）「児童交通公園入口」・「成田西子供園前」・「善福寺川緑地」下車"
    ],
    "hours": {
     "text": "常時開園"
    },
    "closed": "なし（常時開園）。※サービスセンターは年末年始は休業",
    "fee": "無料（一部有料施設あり）",
    "phone": "03-3313-4247",
    "events": [],
    "unverified": [
     "園內銀杏的具體位置：官方頁面未載明"
    ],
    "verified": "2026-10-02"
   },
   "allLinks": [
    {
     "role": "主要網址",
     "url": "https://www.tokyo-park.or.jp/park/zempukujigawa-ryokuchi/index.html"
    },
    {
     "role": "證據頁",
     "date": "2025-11-04",
     "url": "https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf"
    }
   ]
  },
  {
   "id": "TKG-008",
   "row": "TKG-008",
   "zh": "和田堀公園",
   "ja": "和田堀公園",
   "wards": [
    "杉並區"
   ],
   "wardNote": null,
   "alias": "和田堀 wadabori 大宮八幡宮 夫婦銀杏",
   "grade": "S",
   "operator": "公益財團法人東京都公園協會",
   "sheetName": "和田堀公園",
   "sheetArea": "杉並區",
   "caveat": "2025表與善福寺川緑地合併一列，保留共同來源關係。",
   "species": "銀杏",
   "lat": 35.6855,
   "lng": 139.6395,
   "pointLabel": "公園中心（概略）",
   "pointBasis": "公園整體的代表點（平均，僅OSM來源）",
   "pointNote": "只有OSM來源，無第二種來源核對；公園頁面提到鄰接的大宮八幡宮「神門の夫婦銀杏」，另列副點。",
   "pointConfidence": "low",
   "ginkgo": "官方提到鄰接的大宮八幡宮「神門の夫婦銀杏」（神社是公園旁的另一處設施，本站不另設標記）。2025 年度名單與善福寺川綠地合為一列。",
   "season": null,
   "proof": null,
   "status": "待確認",
   "checked": "2026-10-02",
   "links": [
    {
     "role": "主要網址",
     "url": "https://www.tokyo-park.or.jp/park/wadabori/"
    },
    {
     "role": "證據頁",
     "date": "2025-11-04",
     "url": "https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf"
    }
   ],
   "facts": {
    "address": "杉並区大宮一・二丁目、成田東一・二丁目、成田西一丁目、堀ノ内一・二丁目、松ノ木一丁目",
    "access": [
     "京王井の頭線「西永福」下車 徒歩15分",
     "京王バス、関東バス（京王井の頭線「永福町」駅-松ノ木住宅経由-JR「高円寺」駅または東京メトロ丸の内線「新高円寺」(M03)駅行）「都立和田堀公園」下車",
     "駐車場（有料）"
    ],
    "hours": {
     "text": "常時開園"
    },
    "closed": "なし（常時開園）。※サービスセンター及び各施設は年末年始は休業",
    "fee": "無料（一部有料施設あり）",
    "phone": "03-3313-4247",
    "events": [],
    "unverified": [],
    "verified": "2026-10-02"
   },
   "allLinks": [
    {
     "role": "主要網址",
     "url": "https://www.tokyo-park.or.jp/park/wadabori/"
    },
    {
     "role": "證據頁",
     "date": "2025-11-04",
     "url": "https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf"
    }
   ]
  },
  {
   "id": "TKG-009",
   "row": "TKG-009",
   "zh": "戶山公園",
   "ja": "戸山公園",
   "wards": [
    "新宿區"
   ],
   "wardNote": null,
   "alias": "戸山 toyama 箱根山 大久保",
   "grade": "S",
   "operator": "公益財團法人東京都公園協會",
   "sheetName": "戸山公園",
   "sheetArea": "新宿區",
   "caveat": "須擷取銀杏段落／欄位，不直接使用全園紅葉狀態。",
   "species": "楓樹、銀杏",
   "lat": 35.7037,
   "lng": 139.7135,
   "pointLabel": "戸山（箱根山）地区（概略）",
   "pointBasis": "戸山公園分為東側戸山（箱根山）地區與西側大久保地區，此點為東側",
   "pointNote": "公園分兩處，另列大久保地區副點；官方頁面只寫「イチョウ」，無具體地點。",
   "pointConfidence": "low",
   "ginkgo": "「主な植物」與秋季見頃列有イチョウ，未載明位置。園區分為箱根山地區與大久保地區，地圖代表點取箱根山地區。",
   "season": null,
   "proof": null,
   "status": "待確認",
   "checked": "2026-10-02",
   "links": [
    {
     "role": "主要網址",
     "url": "https://www.tokyo-park.or.jp/park/toyama/"
    },
    {
     "role": "證據頁",
     "date": "2025-11-04",
     "url": "https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf"
    }
   ],
   "facts": {
    "address": "新宿区戸山一・二・三丁目、新宿区大久保三丁目",
    "access": [
     "JR山手線「新大久保」「高田馬場」・東京メトロ東西線「高田馬場」下車 徒歩10分（大久保地区）・徒歩25分（箱根山地区）",
     "東京メトロ副都心線「西早稲田」下車 徒歩6分（大久保地区）・徒歩8分（箱根山地区）",
     "東京メトロ東西線「早稲田」下車 徒歩10分（箱根山地区）",
     "都営地下鉄大江戸線「若松河田」下車 徒歩15分（箱根山地区）",
     "※当公園には駐車場はございません"
    ],
    "hours": {
     "text": "常時開園"
    },
    "closed": "なし（常時開園）。※サービスセンターは年末年始は休業",
    "fee": "無料（車椅子の貸出あり・1台）",
    "phone": "03-3200-1702",
    "events": [],
    "unverified": [
     "園內銀杏的具體位置：官方頁面未載明"
    ],
    "verified": "2026-10-02"
   },
   "allLinks": [
    {
     "role": "主要網址",
     "url": "https://www.tokyo-park.or.jp/park/toyama/"
    },
    {
     "role": "證據頁",
     "date": "2025-11-04",
     "url": "https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf"
    },
    {
     "role": "訪客資訊",
     "url": "https://www.tokyo-park.or.jp/park/toyama/assets/files/toyama_eng.pdf"
    }
   ]
  },
  {
   "id": "TKG-010",
   "row": "TKG-010",
   "zh": "光之丘公園",
   "ja": "光が丘公園",
   "wards": [
    "練馬區",
    "板橋區"
   ],
   "wardNote": null,
   "alias": "光が丘 光丘 hikarigaoka",
   "grade": "S",
   "operator": "公益財團法人東京都公園協會",
   "sheetName": "光が丘公園",
   "sheetArea": "練馬區、板橋區",
   "caveat": "銀杏並木與ふれあいの径宜設為不同子地點。",
   "species": "銀杏",
   "lat": 35.7648,
   "lng": 139.6295,
   "pointLabel": "観賞池與売店之間（概略）",
   "pointBasis": "官方文字「公園中央（売店と観賞池の間）」＋OSM池塘與園內商店建築的位置推算",
   "pointNote": "池塘位置確定；官方所稱「売店」被推定為緊鄰池塘的パークス光が丘（官方未明示建物名）。精度約±100 m；僅OSM物件，無第二座標來源。",
   "pointConfidence": "medium",
   "ginkgo": "官方：「いちょう並木」位於公園中央（売店與観賞池之間），是從グラントハイツ移植的 28 棵；另有「ふれあいの径」，為移植自舊都廳前、樹齡逾百年的 40 棵銀杏。",
   "season": null,
   "proof": null,
   "status": "待確認",
   "checked": "2026-10-02",
   "links": [
    {
     "role": "主要網址",
     "url": "https://www.tokyo-park.or.jp/park/hikarigaoka/"
    },
    {
     "role": "證據頁",
     "date": "2025-11-04",
     "url": "https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf"
    }
   ],
   "facts": {
    "address": "練馬区光が丘二・四丁目、旭町二丁目、板橋区赤塚新町三丁目",
    "access": [
     "都営地下鉄大江戸線「光が丘」(E38)下車 徒歩8分",
     "東武東上線「成増」・東京メトロ副都心線「地下鉄成増」(F02)・東京メトロ有楽町線「地下鉄成増」（Y02）下車 徒歩15分",
     "東武東上線「成増」（南口）から西武バスにて光が丘駅・練馬高野台駅・南田中車庫ゆき「光が丘公園北」下車",
     "駐車場（有料・24時間営業・251台）"
    ],
    "hours": {
     "text": "常時開園"
    },
    "closed": "なし（常時開園）。※サービスセンター及び各施設は年末年始は休業。屋敷森跡地は月曜休園（月曜祝日は開園、翌火曜休園）・年末年始休園、開園時間10:00～15:30（入園は15:00まで）",
    "fee": "無料（一部有料施設あり）",
    "phone": "03-3977-7638",
    "events": [],
    "unverified": [],
    "verified": "2026-10-02"
   },
   "allLinks": [
    {
     "role": "主要網址",
     "url": "https://www.tokyo-park.or.jp/park/hikarigaoka/"
    },
    {
     "role": "證據頁",
     "date": "2025-11-04",
     "url": "https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf"
    }
   ]
  },
  {
   "id": "TKG-011",
   "row": "TKG-011",
   "zh": "日比谷公園",
   "ja": "日比谷公園",
   "wards": [
    "千代田區"
   ],
   "wardNote": null,
   "alias": "日比谷 hibiya 首賭けイチョウ 首賭",
   "grade": "S",
   "operator": "公益財團法人東京都公園協會",
   "sheetName": "日比谷公園",
   "sheetArea": "千代田區",
   "caveat": "葉況與施工、通行公告分開管理。",
   "species": "銀杏",
   "lat": 35.6737,
   "lng": 139.7559,
   "pointLabel": "首賭けイチョウ（松本楼付近・概略）",
   "pointBasis": "OSM的イチョウ導覽牌與松本楼位置（網路搜尋摘要稱該樹在松本楼附近）",
   "pointNote": "OSM只標導覽牌，未直接標出該樹；「在松本楼附近」僅出自搜尋結果摘要，未逐頁核實。精度約±50–100 m；無第二座標來源。",
   "pointConfidence": "medium",
   "ginkgo": "官方：「首賭けイチョウ」推定樹齡 400～500 年、幹圍 7 m，明治 35 年由本多靜六博士移植，是公園的象徵；園內位置本文未載明。",
   "season": null,
   "proof": null,
   "status": "待確認",
   "checked": "2026-10-02",
   "links": [
    {
     "role": "主要網址",
     "url": "https://www.tokyo-park.or.jp/park/hibiya/"
    },
    {
     "role": "證據頁",
     "date": "2025-11-04",
     "url": "https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf"
    }
   ],
   "facts": {
    "address": "千代田区日比谷公園",
    "access": [
     "東京メトロ丸ノ内線・千代田線「霞ケ関」下車（B2）出口すぐ",
     "東京メトロ日比谷線・千代田線・都営地下鉄三田線「日比谷」下車（A10・A14）出口すぐ",
     "東京メトロ有楽町線「桜田門」下車（出口5） 徒歩5分",
     "JR「有楽町」下車 徒歩8分",
     "駐車場（地下公共駐車場、有料）"
    ],
    "hours": {
     "text": "常時開園（サービスセンター開所時間 8:30～17:30、年末年始を除く）"
    },
    "closed": "なし（常時開園）。2026年10月時点で再生整備工事のため、大噴水・噴水広場など一部は立入不可",
    "fee": "無料（一部有料施設あり）",
    "phone": "03-3501-6428（8:30～17:30 ※年末年始を除く）",
    "events": [],
    "unverified": [
     "「首賭けイチョウ」在園內的位置：官方頁面沒有寫方位或地點"
    ],
    "verified": "2026-10-02"
   },
   "allLinks": [
    {
     "role": "主要網址",
     "url": "https://www.tokyo-park.or.jp/park/hibiya/"
    },
    {
     "role": "證據頁",
     "date": "2025-11-04",
     "url": "https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf"
    },
    {
     "role": "訪客資訊",
     "url": "https://www.tokyo-park.or.jp/park/hibiya/assets/files/hibiyapark_map_english.pdf"
    }
   ]
  },
  {
   "id": "TKG-012",
   "row": "TKG-012",
   "zh": "代代木公園",
   "ja": "代々木公園",
   "wards": [
    "澀谷區"
   ],
   "wardNote": null,
   "alias": "代々木 yoyogi 原宿",
   "grade": "S",
   "operator": "公益財團法人東京都公園協會",
   "sheetName": "代々木公園",
   "sheetArea": "澀谷區",
   "caveat": "黃葉公告須限定原文明示區域，不擴張為全園。",
   "species": "銀杏",
   "lat": 35.6717,
   "lng": 139.6965,
   "pointLabel": "公園中心（概略）",
   "pointBasis": "公園整體的代表點（平均）",
   "pointNote": "約54公頃；官方頁面僅列「秋：イチョウ」，無具體地點。",
   "pointConfidence": "low",
   "ginkgo": "「主な植物」與秋季見頃列有イチョウ，未載明位置（見どころ只列ケヤキ並木）。",
   "season": null,
   "proof": null,
   "status": "待確認",
   "checked": "2026-10-02",
   "links": [
    {
     "role": "主要網址",
     "url": "https://www.tokyo-park.or.jp/park/yoyogi/"
    },
    {
     "role": "證據頁",
     "date": "2025-11-04",
     "url": "https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf"
    }
   ],
   "facts": {
    "address": "渋谷区代々木神園町(A地区)、神南一丁目・神南二丁目(B地区)",
    "access": [
     "JR山手線「原宿」下車 徒歩3分",
     "東京メトロ千代田線「代々木公園」(C02)下車 徒歩3分",
     "東京メトロ千代田線・副都心線「明治神宮前（原宿）」（C03、F15）下車 徒歩3分",
     "小田急線「代々木八幡」下車 徒歩6分",
     "駐車場（65台・有料・24時間）。※土・日・祝のご来園は公園前の道路が混雑しますので公共交通機関を利用"
    ],
    "hours": {
     "text": "常時開園"
    },
    "closed": "なし（常時開園）。※サービスセンター及び各施設は年末年始は休業。屋外アーバンスポーツパーク等がある神南一丁目地区は協会の管理外（公式HP https://yoyogi-cpark.com/ ／電話 03-3460-5700）",
    "fee": "無料（一部有料施設あり）",
    "phone": "03-3469-6081",
    "events": [],
    "unverified": [
     "園內銀杏的具體位置：官方頁面未載明"
    ],
    "verified": "2026-10-02"
   },
   "allLinks": [
    {
     "role": "主要網址",
     "url": "https://www.tokyo-park.or.jp/park/yoyogi/"
    },
    {
     "role": "證據頁",
     "date": "2025-11-04",
     "url": "https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf"
    },
    {
     "role": "訪客資訊",
     "url": "https://www.tokyo-park.or.jp/park/yoyogi/assets/files/yoyogi-kinshi20230919.pdf"
    }
   ]
  },
  {
   "id": "TKG-013",
   "row": "TKG-013",
   "zh": "舊岩崎邸庭園",
   "ja": "旧岩崎邸庭園",
   "wards": [
    "台東區"
   ],
   "wardNote": "資料表寫「台東區（入口）」；庭園另跨文京區湯島。",
   "alias": "旧岩崎邸 岩崎 iwasaki 湯島",
   "grade": "S",
   "operator": "公益財團法人東京都公園協會",
   "sheetName": "旧岩崎邸庭園",
   "sheetArea": "台東區（入口）",
   "caveat": "活動或集章日期不是見頃日；注意官網改版後網址。",
   "species": "銀杏",
   "lat": 35.7092,
   "lng": 139.7683,
   "pointLabel": "庭園正門（入口）",
   "pointBasis": "庭園正門（入口）；庭園中心約在 35.7097,139.7677（Nominatim/Wikipedia）",
   "pointNote": "OSM正門節點與Weathernews座標相距約50 m，一致。庭園約2公頃，官方頁面列「イチョウ」但無具體位置。",
   "pointConfidence": "high",
   "ginkgo": "「主な植物」與秋季見頃列有イチョウ、モミジ，未載明位置。",
   "season": null,
   "proof": null,
   "status": "待確認",
   "checked": "2026-10-02",
   "links": [
    {
     "role": "主要網址",
     "url": "https://www.tokyo-park.or.jp/park/kyu-iwasaki-tei/"
    },
    {
     "role": "證據頁",
     "date": "2025-11-04",
     "url": "https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf"
    }
   ],
   "facts": {
    "address": "〒110-0008 東京都台東区池之端1-3-45",
    "access": [
     "東京メトロ千代田線「湯島」（C13）下車 1番出口 徒歩3分（ベビーカー、車いすの方は3番出口のエレベーターを利用）",
     "東京メトロ銀座線「上野広小路」（G15）下車 徒歩10分",
     "都営地下鉄大江戸線「上野御徒町」（E09）下車 徒歩10分",
     "JR山手線・京浜東北線「御徒町」下車 徒歩15分",
     "駐車場：車椅子・障がい者専用が1台分のみ。その他は近隣の公共駐車場を利用"
    ],
    "hours": {
     "text": "午前9時～午後5時（入園は午後4時30分まで）。※イベント開催期間など時間延長が行われる場合もあります"
    },
    "closed": "年末・年始（12月29日～翌年1月1日まで）。※イベント開催期間及びGWなどで休園日開園や時間延長が行われる場合もある",
    "fee": "一般 400円／65歳以上 200円。小学生以下及び都内在住・在学の中学生は無料。20名以上の団体 一般320円／65歳以上160円。障害者手帳等の所持者と付添者（原則1名）は無料。無料公開日：みどりの日（5月4日）、都民の日（10月1日）。年間パスポート：当園のみ 一般1,600円／65歳以上800円、都立9庭園共通 一般4,000円／65歳以上2,000円。（オンライン入園券あり）",
    "phone": "03-3823-8340",
    "events": [
     {
      "date": "2026-10-10～12-06",
      "text": "【都立9庭園】紅葉めぐりスタンプラリー2026",
      "url": "https://www.tokyo-park.or.jp/special/9gardens_stamp/index.html",
      "note": "活動日期，不是見頃日期"
     }
    ],
    "unverified": [
     "園內銀杏的具體位置：官方頁面未載明"
    ],
    "verified": "2026-10-02"
   },
   "allLinks": [
    {
     "role": "主要網址",
     "url": "https://www.tokyo-park.or.jp/park/kyu-iwasaki-tei/"
    },
    {
     "role": "證據頁",
     "date": "2025-11-04",
     "url": "https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf"
    },
    {
     "role": "官方活動",
     "url": "https://www.tokyo-park.or.jp/special/9gardens_stamp/index.html"
    },
    {
     "role": "訪客資訊",
     "url": "https://www.tokyo-park.or.jp/park/kyu-iwasaki-tei/news/2025/park_info_1.html"
    },
    {
     "role": "訪客資訊",
     "url": "https://www.tokyo-park.or.jp/park/kyu-iwasaki-tei/assets/files/kyuiwasaki_eng.pdf"
    }
   ]
  },
  {
   "id": "TKG-014",
   "row": "TKG-014",
   "zh": "國營昭和紀念公園",
   "ja": "国営昭和記念公園",
   "wards": [
    "立川市",
    "昭島市"
   ],
   "wardNote": null,
   "alias": "昭和記念公園 昭和紀念 showa カナール かたらい 立川",
   "grade": "A",
   "operator": "國營昭和記念公園官方網站",
   "sheetName": "國營昭和記念公園｜花だより",
   "sheetArea": "立川市、昭島市",
   "caveat": "カナール、かたらいのイチョウ並木分開；page/3分頁位置會隨新增文章變動，不可當永久存檔ID。",
   "species": "銀杏",
   "lat": 35.7028,
   "lng": 139.4022,
   "pointLabel": "カナール（銀杏並木沿水路）",
   "pointBasis": "OSM標有Ginkgo biloba的樹列夾著水路，且與官方「立川口徒步約1分」相符（OSM立川口節點 35.7022,139.4036，約120 m）",
   "pointNote": "三個OSM物件互相一致，並與官方頁面的位置敘述吻合，故判定high；東端另有兩段銀杏樹列（139.4041-139.4052）靠近立川口。",
   "pointConfidence": "high",
   "ginkgo": "官方：カナールイチョウ並木與かたらいのイチョウ並木。花・植物指南寫カナール 200 m、かたらい 300 m；秋の夜散歩頁寫カナール 106 棵・150 m、かたらい 98 棵・300 m（兩頁的カナール長度不一致，待確認）。官方說明轉色順序是先カナール、後かたらい。かたらいのイチョウ並木位置未核實，只以文字列出，不放標記。",
   "season": "花・植物指南：「イチョウ（黄葉）10月下旬～11月下旬」；秋の夜散歩頁：カナール 色づき 11月上旬～中旬、かたらい 11月中旬～下旬。",
   "proof": null,
   "status": "待確認",
   "checked": "2026-10-02",
   "links": [
    {
     "role": "主要網址",
     "url": "https://www.showakinen-koen.jp/hanadayori/"
    },
    {
     "role": "補充網址",
     "url": "https://www.showakinen-koen.jp/flower-information/"
    },
    {
     "role": "證據頁",
     "date": "2025-10-23至2025-12-04",
     "url": "https://www.showakinen-koen.jp/hanadayori/page/3/"
    }
   ],
   "facts": {
    "address": "〒190-0014 東京都立川市緑町3173",
    "access": [
     "あけぼの口（みどりの文化ゾーン）：JR中央線・立川駅 北口より約10分／多摩都市モノレール・立川北駅 公園口より約8分",
     "立川ゲート：JR中央線・立川駅 北口より約18分／多摩都市モノレール・立川北駅 公園口より約16分",
     "西立川ゲート：JR青梅線・西立川駅 公園口より約2分",
     "昭島ゲート：JR青梅線・東中神駅 北口より約10分",
     "砂川ゲート：西武拝島線・武蔵砂川駅より約20分（玉川上水ゲートは約25分）",
     "公園の有料区には5つのゲート、3つの駐車場があります"
    ],
    "hours": {
     "text": "10月：有料区・無料区 9:30～17:00（みどりの文化ゾーン 8:30～17:00）／11月～2月：9:30～16:30（みどりの文化ゾーン 8:30～16:30）。開園時間はイベント等で変更される場合あり"
    },
    "closed": "年末年始（12/31・1/1）、1月の第3月曜日から金曜日。悪天候等で臨時休園あり",
    "fee": "入園料（大人・高校生以上）450円、シルバー（65歳以上）210円、小人（中学生以下）無料。団体は20人以上で大人290円。年間パスポート大人4,500円。当日に限り再入園可",
    "phone": "042-528-1751",
    "events": [
     {
      "date": "2026-10-29～11-29",
      "text": "黄葉・紅葉まつり＆秋の夜散歩2026（ライトアップ）：かたらいのイチョウ並木・日本庭園・カナール、点灯16:30〜20:30",
      "url": "https://www.showakinen-koen.jp/autumn-night-walk/",
      "note": "活動日期，不是見頃日期"
     }
    ],
    "unverified": [
     "カナール銀杏並木的長度：兩個官方頁面分別寫 200 m 與 150 m",
     "費用：「450 円＝單日入園料」是依官方價目表的排列判讀，表頭沒有逐欄標明",
     "2026 年銀杏黃葉現況：10/1 更新的「花だより」還沒有銀杏的內容"
    ],
    "verified": "2026-10-02"
   },
   "allLinks": [
    {
     "role": "主要網址",
     "url": "https://www.showakinen-koen.jp/hanadayori/"
    },
    {
     "role": "補充網址",
     "url": "https://www.showakinen-koen.jp/flower-information/"
    },
    {
     "role": "證據頁",
     "date": "2025-10-23至2025-12-04",
     "url": "https://www.showakinen-koen.jp/hanadayori/page/3/"
    },
    {
     "role": "官方活動",
     "url": "https://www.showakinen-koen.jp/autumn-night-walk/"
    },
    {
     "role": "訪客資訊",
     "url": "https://www.showakinen-koen.jp/"
    },
    {
     "role": "訪客資訊",
     "url": "https://www.showakinen-koen.jp/park-information/schedule/"
    },
    {
     "role": "訪客資訊",
     "url": "https://www.showakinen-koen.jp/park-information/price/"
    },
    {
     "role": "訪客資訊",
     "url": "https://www.showakinen-koen.jp/access/"
    },
    {
     "role": "訪客資訊",
     "url": "https://www.showakinen-koen.jp/park-information/park-rules/"
    }
   ]
  },
  {
   "id": "TKG-015",
   "row": "TKG-015",
   "zh": "新宿御苑",
   "ja": "新宿御苑",
   "wards": [
    "新宿區",
    "澀谷區"
   ],
   "wardNote": null,
   "alias": "新宿御苑 shinjuku gyoen 大温室",
   "grade": "A",
   "operator": "一般財團法人國民公園協會 新宿御苑",
   "sheetName": "新宿御苑｜國民公園協會自然情報",
   "sheetArea": "新宿區、澀谷區",
   "caveat": "舊文只當歷史樣本。環境省管理資訊與協會自然情報各有用途；不可混入同期其他樹種狀態。",
   "species": "銀杏",
   "lat": 35.6867,
   "lng": 139.7126,
   "pointLabel": "大温室（銀杏拍攝熱點）",
   "pointBasis": "大温室建築物位置；官方稱銀杏在「温室近く」",
   "pointNote": "座標僅OSM（建築物輪廓，位置精確），無第二座標來源；銀杏位於溫室附近而非溫室內，實際樹位誤差約數十公尺。",
   "pointConfidence": "medium",
   "ginkgo": "2025-11-28 官方文章：園內各處銀杏見頃，大溫室附近的枝條較低，是熱門拍攝點（歷史紀錄）。",
   "season": "月別「季節のみどころ」：11 月有紅葉（イチョウ、プラタナスなど）。",
   "proof": null,
   "status": "待確認",
   "checked": "2026-10-02",
   "links": [
    {
     "role": "主要網址",
     "url": "https://fng.or.jp/shinjuku/news/"
    },
    {
     "role": "補充網址",
     "url": "https://policies.env.go.jp/national-garden/shinjukugyoen/index.html"
    },
    {
     "role": "證據頁",
     "date": "2025-11-28",
     "url": "https://fng.or.jp/shinjuku/2025/11/28/20251128_03/"
    }
   ],
   "facts": {
    "address": "〒160-0014 東京都新宿区内藤町11",
    "access": [
     "新宿門：JR・京王・小田急線 新宿駅南口より徒歩10分／西武新宿線 西武新宿駅より徒歩15分／東京メトロ丸ノ内線 新宿御苑前駅出口1より徒歩5分／東京メトロ副都心線 新宿三丁目駅E5出口より徒歩5分／都営地下鉄新宿線 新宿三丁目駅C1・C5出口より徒歩5分",
     "大木戸門：東京メトロ丸ノ内線 新宿御苑前駅出口2より徒歩5分",
     "千駄ヶ谷門：JR総武線 千駄ヶ谷駅より徒歩5分／東京メトロ副都心線 北参道駅出口1より徒歩10分／都営地下鉄大江戸線 国立競技場駅A5出口より徒歩5分",
     "自転車・バイク：新宿門は入園門横、大木戸門と千駄ヶ谷門は入園門内に駐輪可（開園日・開園時間のみ）"
    ],
    "hours": {
     "text": "10月1日～3月14日：9:00～16:30（最終入園 16:00）。温室 9:30～16:00（最終入館 15:30）"
    },
    "closed": "毎週月曜日（月曜日が休日の場合は翌平日）、年末年始（12月29日～1月3日）。特別開園期間は期間中無休：春3月25日～4月24日、秋11月1日～15日",
    "fee": "個人：一般500円、65歳以上250円、学生（高校生以上）250円、小人（中学生以下）無料。団体（30人以上）一般400円。年間パスポート一般2,000円・高校生1,000円",
    "phone": "新宿御苑サービスセンター 03-3350-0151（9:00AMから閉園30分後まで・休園日除く）／国民公園協会新宿御苑 03-3341-1461",
    "events": [
     {
      "date": "2026-11-01～11-15",
      "text": "秋の特別開園：期間中無休",
      "url": "https://fng.or.jp/shinjuku/guide/",
      "note": "依官方入園案內的特別開園期間"
     },
     {
      "date": "2026-10-06～11月下旬（予定）",
      "text": "大木戸門の工事に伴う通行規制",
      "url": "https://fng.or.jp/shinjuku/2026/10/01/20261001-01/",
      "kind": "notice",
      "note": "2026-10-01 公告"
     }
    ],
    "unverified": [
     "大木戶門通行限制：依國民公園協會網站轉載的公告；環境省頁面的原文未能讀取",
     "2026 年菊花壇展的日期：未能核實",
     "2026 年銀杏黃葉現況：官方尚未發布"
    ],
    "verified": "2026-10-02"
   },
   "allLinks": [
    {
     "role": "主要網址",
     "url": "https://fng.or.jp/shinjuku/news/"
    },
    {
     "role": "補充網址",
     "url": "https://policies.env.go.jp/national-garden/shinjukugyoen/index.html"
    },
    {
     "role": "證據頁",
     "date": "2025-11-28",
     "url": "https://fng.or.jp/shinjuku/2025/11/28/20251128_03/"
    },
    {
     "role": "官方活動",
     "url": "https://fng.or.jp/shinjuku/guide/"
    },
    {
     "role": "官方公告",
     "url": "https://fng.or.jp/shinjuku/2026/10/01/20261001-01/"
    },
    {
     "role": "訪客資訊",
     "url": "https://fng.or.jp/shinjuku/access/"
    },
    {
     "role": "訪客資訊",
     "url": "https://fng.or.jp/shinjuku/2026/09/30/20260930-01/"
    },
    {
     "role": "訪客資訊",
     "url": "https://fng.or.jp/shinjuku/2026/09/25/20260925-03/"
    },
    {
     "role": "訪客資訊",
     "url": "https://fng.or.jp/shinjuku/place/season"
    },
    {
     "role": "訪客資訊",
     "url": "https://policies.env.go.jp/national-garden/shinjukugyoen/guide/rule/"
    }
   ]
  },
  {
   "id": "TKG-016",
   "row": "TKG-016",
   "zh": "甲州街道銀杏並木（八王子）",
   "ja": "甲州街道いちょう並木（八王子）",
   "wards": [
    "八王子市"
   ],
   "wardNote": null,
   "alias": "八王子 hachioji いちょう祭り 銀杏祭 甲州街道 高尾 追分",
   "grade": "A",
   "operator": "八王子いちょう祭り祭典委員會",
   "sheetName": "八王子いちょう祭り｜黄葉情報",
   "sheetArea": "八王子市・甲州街道",
   "caveat": "已確認2026季內內容，但不能只看照片日期就自動判定見頃。祭典日期與葉況分離。",
   "species": "銀杏",
   "lat": 35.652,
   "lng": 139.3004,
   "pointLabel": "並木代表點（全長約4 km的中段）",
   "pointBasis": "追分町到高尾駅付近之間的代表點",
   "pointNote": "並木長約4 km（約760棵，出自搜尋結果摘要），單點僅供總覽；請用兩端與兩個官方攝影點。",
   "pointConfidence": "high",
   "ginkgo": "官方：甲州街道（國道 20 號）兩側，自追分町交差點至高尾駅入口約 4 km、約 770 棵，昭和 2～4 年植樹。官方黃葉情報的攝影點是八王子市中央圖書館與多摩御陵入口交差點。地圖代表點取並木中段，只供總覽。",
   "season": "官方黃葉情報頁：「毎年11月頃には美しく黄葉し」。",
   "proof": null,
   "status": "待確認",
   "checked": "2026-10-02",
   "links": [
    {
     "role": "主要網址",
     "url": "https://www.ichou-festa.org/ichounews/"
    },
    {
     "role": "補充網址",
     "url": "https://www.ichou-festa.org/"
    },
    {
     "role": "證據頁",
     "date": "2026-09-24（更新公告）",
     "url": "https://www.ichou-festa.org/notice/post-3629/"
    }
   ],
   "facts": {
    "address": "八王子市追分町交差点から高尾駅入口までの甲州街道（国道20号）沿い。祭典委員会事務局：〒193-0834 東京都八王子市東浅川町120番地",
    "access": [
     "並木は八王子市追分町から高尾駅入口までほぼ4kmにわたり甲州街道（国道20号）の両側に続く",
     "会場には JR高尾駅方面〜多摩御陵入口交差点〜陵南公園〜八王子市中央図書館などが含まれる",
     "祭り開催中は駐車場なし（公共交通機関を利用）。開催中は道路通行止め区間あり"
    ],
    "hours": {
     "text": null,
     "note": "並木在甲州街道（國道 20 號）兩側；祭典時間見下方「官方活動」。"
    },
    "closed": null,
    "fee": null,
    "phone": "八王子いちょう祭り祭典委員会 042-668-8383（FAX 042-673-6661）",
    "events": [
     {
      "date": "2026-11-21・11-22",
      "text": "第47回八王子いちょう祭り：11月21日(土) 午前9時～午後4時30分／11月22日(日) 午前9時～午後4時",
      "url": "https://www.ichou-festa.org/event",
      "note": "祭典日期，不是見頃日期"
     }
    ],
    "unverified": [
     "從最近車站的步行時間與路線公車：官方頁面未載明",
     "開放時間與休日：並木沿公道，官方頁面未載明時間限制",
     "費用：除祭典中的收費活動外，官方頁面未載明",
     "祭典期間交通管制的路段：本站未逐篇核實，請看官方公告"
    ],
    "verified": "2026-10-02"
   },
   "allLinks": [
    {
     "role": "主要網址",
     "url": "https://www.ichou-festa.org/ichounews/"
    },
    {
     "role": "補充網址",
     "url": "https://www.ichou-festa.org/"
    },
    {
     "role": "證據頁",
     "date": "2026-09-24（更新公告）",
     "url": "https://www.ichou-festa.org/notice/post-3629/"
    },
    {
     "role": "官方活動",
     "url": "https://www.ichou-festa.org/event"
    },
    {
     "role": "訪客資訊",
     "url": "https://www.ichou-festa.org/about"
    },
    {
     "role": "訪客資訊",
     "url": "https://www.ichou-festa.org/faq"
    }
   ]
  },
  {
   "id": "TKG-017",
   "row": "TKG-017",
   "zh": "皇居東御苑",
   "ja": "皇居東御苑",
   "wards": [
    "千代田區"
   ],
   "wardNote": null,
   "alias": "東御苑 higashi gyoen 百人番所 皇居",
   "grade": "A",
   "operator": "宮內廳",
   "sheetName": "宮內廳｜皇居東御苑 花だより",
   "sheetArea": "千代田區・皇居東御苑",
   "caveat": "東御苑不是皇居外苑或北之丸公園。全園葉落描述不可自動套用銀杏。",
   "species": "銀杏",
   "lat": 35.6857,
   "lng": 139.7581,
   "pointLabel": "百人番所（前のイチョウ）",
   "pointBasis": "建築物位置；官方照片標示銀杏在百人番所前",
   "pointNote": "三個OSM物件一致（<50 m），但僅OSM；銀杏位於建築前方，與建築位置差約數十公尺。",
   "pointConfidence": "medium",
   "ginkgo": "2025-11-28 宮內廳「花だより」照片標示「百人番所前のイチョウ」（歷史紀錄）。注意：東御苑不是皇居外苑，也不是北之丸公園。",
   "season": null,
   "proof": null,
   "status": "待確認",
   "checked": "2026-10-02",
   "links": [
    {
     "role": "主要網址",
     "url": "https://www.kunaicho.go.jp/visit/higashigyoen/hanadayori/index.html"
    },
    {
     "role": "補充網址",
     "url": "https://www.kunaicho.go.jp/visit/higashigyoen/index.html"
    },
    {
     "role": "證據頁",
     "date": "2025-11-28",
     "url": "https://www.kunaicho.go.jp/visit/higashigyoen/hanadayori/20251128.html"
    }
   ],
   "facts": {
    "address": "東京都千代田区千代田1",
    "access": [
     "大手門：地下鉄各線の大手町駅（C13a出口）から徒歩約5分／地下鉄千代田線 二重橋前駅（6番出口）から徒歩約10分／JR東京駅（丸の内北口）から徒歩約15分",
     "平川門：地下鉄東西線 竹橋駅（1a出口）から徒歩約5分",
     "北桔橋門：地下鉄東西線 竹橋駅（1a出口）から徒歩約5分",
     "出入門は大手門・平川門・北桔橋門の3か所"
    ],
    "hours": {
     "text": "10月1日～10月末日：9時～16時30分（入園は16時まで）／11月1日～2月末日：9時～16時（入園は15時30分まで）"
    },
    "closed": {
     "text": "月曜日・金曜日、12月28日から翌年1月3日まで、行事の実施その他やむを得ない理由のある日。ただし天皇誕生日以外の「国民の祝日等の休日」は公開し、月曜日が休日で公開する場合は火曜日を休園",
     "note": "官方休園日曆顯示 2026-10-02（五）、10-05（一）休園。"
    },
    "fee": "無料（入園料・事前予約は不要）。入園時に入園票の交付を受け、退園時に返納",
    "phone": null,
    "events": [],
    "unverified": [
     "電話：本站未從宮內廳頁面取得",
     "銀杏黃葉的通常時期：官方沒有標示，植物一覽也沒有銀杏項目",
     "休園日的細節：公開要領 PDF（令和元年版）與網頁對國定假日的寫法略有不同，本站採網頁說法"
    ],
    "verified": "2026-10-02"
   },
   "allLinks": [
    {
     "role": "主要網址",
     "url": "https://www.kunaicho.go.jp/visit/higashigyoen/hanadayori/index.html"
    },
    {
     "role": "補充網址",
     "url": "https://www.kunaicho.go.jp/visit/higashigyoen/index.html"
    },
    {
     "role": "證據頁",
     "date": "2025-11-28",
     "url": "https://www.kunaicho.go.jp/visit/higashigyoen/hanadayori/20251128.html"
    },
    {
     "role": "訪客資訊",
     "url": "https://www.kunaicho.go.jp/visit/higashigyoen/pdf/koukaiyouryou.pdf"
    },
    {
     "role": "訪客資訊",
     "url": "https://www.kunaicho.go.jp/visit/higashigyoen/gyoen-close.html"
    },
    {
     "role": "訪客資訊",
     "url": "https://www.kunaicho.go.jp/visit/higashigyoen/info/"
    }
   ]
  },
  {
   "id": "TKG-018",
   "row": "TKG-018",
   "zh": "小石川植物園",
   "ja": "小石川植物園",
   "wards": [
    "文京區"
   ],
   "wardNote": null,
   "alias": "小石川 koishikawa 植物園 精子発見 東京大学",
   "grade": "A",
   "operator": "東京大學大學院理學系研究科附屬植物園",
   "sheetName": "小石川植物園｜見ごろの植物",
   "sheetArea": "文京區",
   "caveat": "見到黃葉不等於已到見頃。小石川植物園與小石川後樂園是不同地點。",
   "species": "銀杏",
   "lat": 35.7202,
   "lng": 139.7452,
   "pointLabel": "精子発見のイチョウ（補充副點）",
   "pointBasis": "園內名木（OSM樹木節點）",
   "pointNote": "補充副點（任務未要求）；僅OSM座標。",
   "pointConfidence": "medium",
   "ginkgo": "園內名木「精子発見のイチョウ」：植物學教室職員平瀨作五郎在這株雌株上發現銀杏精子。注意：小石川植物園與小石川後樂園是不同地點。",
   "season": null,
   "proof": null,
   "status": "待確認",
   "checked": "2026-10-02",
   "links": [
    {
     "role": "主要網址",
     "url": "https://koishikawa-bg.jp/kaikainfo/"
    },
    {
     "role": "補充網址",
     "url": "https://koishikawa-bg.jp/kaika/"
    },
    {
     "role": "證據頁",
     "date": "2025-11-19",
     "url": "https://koishikawa-bg.jp/kaika/5013/"
    }
   ],
   "facts": {
    "address": "〒112-0001 東京都文京区白山3丁目7番1号",
    "access": [
     "都営地下鉄三田線 白山駅【A1出口】徒歩約10分",
     "東京メトロ丸ノ内線 茗荷谷駅【出入口1】徒歩約15分",
     "東京メトロ丸ノ内線 後楽園駅【地上改札】徒歩約15分",
     "都営バス 上60 大塚駅～上野公園線【白山2丁目（東大植物園前）】下車 徒歩約3分",
     "文京区コミュニティバス B-ぐる【目白台・小日向ルート】【共同印刷】下車 徒歩約3分",
     "園内に駐車スペースなし。自転車は正門脇に駐輪場あり。Google Mapでは『小石川植物園正門受付発売所』で検索するよう案内"
    ],
    "hours": {
     "text": "開園期間 1月4日～12月28日。午前9時～午後4時30分（但し入園は午後4時まで）。温室 午前10時～午後3時／柴田記念館 午前10時30分～午後4時"
    },
    "closed": "月曜（月曜が祝日の場合はその翌日、月曜から連休の場合は最後の祝日の翌日）。12月29日～1月3日は開園期間外",
    "fee": "個人：大人（高校生以上）500円、小人（中学生・小学生）150円、年間利用2,500円。6歳未満無料、5月4日(みどりの日)無料。団体（20名以上）は一般350円など。退園した場合は再入園不可",
    "phone": null,
    "events": [],
    "unverified": [
     "電話：本站讀取的官方頁面未載明",
     "2025-11-19 文章的日期：頁面本文沒有顯示日期，依資料表",
     "銀杏的通常見頃時期：官方未載明"
    ],
    "verified": "2026-10-02"
   },
   "allLinks": [
    {
     "role": "主要網址",
     "url": "https://koishikawa-bg.jp/kaikainfo/"
    },
    {
     "role": "補充網址",
     "url": "https://koishikawa-bg.jp/kaika/"
    },
    {
     "role": "證據頁",
     "date": "2025-11-19",
     "url": "https://koishikawa-bg.jp/kaika/5013/"
    },
    {
     "role": "訪客資訊",
     "url": "https://koishikawa-bg.jp/overview/guide/"
    },
    {
     "role": "訪客資訊",
     "url": "https://koishikawa-bg.jp/access/"
    },
    {
     "role": "訪客資訊",
     "url": "https://koishikawa-bg.jp/ennai/ginkgo/"
    },
    {
     "role": "訪客資訊",
     "url": "https://koishikawa-bg.jp/"
    }
   ]
  },
  {
   "id": "TKG-019",
   "row": "TKG-019",
   "zh": "廣德寺（秋留野市）",
   "ja": "広徳寺（あきる野市）",
   "wards": [
    "秋留野市"
   ],
   "wardNote": null,
   "alias": "広徳寺 広德寺 あきる野 akiruno 秋川",
   "grade": "A",
   "operator": "あきる野市觀光協會",
   "sheetName": "あきる野市觀光協會｜のらぼう日記",
   "sheetArea": "秋留野市・廣德寺周邊",
   "caveat": "石舟橋段落是楓樹，不能套用到廣德寺銀杏。發文日與拍攝日分開。",
   "species": "銀杏",
   "lat": 35.7218,
   "lng": 139.2174,
   "pointLabel": "廣徳寺寺院位置",
   "pointBasis": "寺院本體位置",
   "pointNote": "兩來源相差<20 m；銀杏位於寺內（官方文章稱廣徳寺のイチョウ），未找到銀杏的獨立座標，與寺院位置差應在數十公尺內。",
   "pointConfidence": "high",
   "ginkgo": "秋留野市官方頁：境內「イチョウの巨樹もある」。觀光協會巡查文中的石舟橋段落是楓樹，不適用於廣德寺銀杏。",
   "season": null,
   "proof": null,
   "status": "待確認",
   "checked": "2026-10-02",
   "links": [
    {
     "role": "主要網址",
     "url": "https://www.akirunokanko.com/?cat=53"
    },
    {
     "role": "補充網址",
     "url": "https://www.akirunokanko.com/"
    },
    {
     "role": "證據頁",
     "date": "2025-11-08（發文）；2025-11-06（拍照）",
     "url": "https://www.akirunokanko.com/?p=8712"
    }
   ],
   "facts": {
    "address": "あきる野市小和田234",
    "access": [
     "武蔵五日市駅から徒歩約30分",
     "武蔵五日市駅から『払沢の滝入口』『藤倉』『数馬』または『上養沢』行バス『上町』下車 徒歩約15分"
    ],
    "hours": {
     "text": null
    },
    "closed": null,
    "fee": null,
    "phone": "あきる野市観光協会 五日市観光案内所 042-596-0514（3月〜11月 8:30〜17:00／12月〜2月 9:00〜16:30／定休日 水曜日／あきる野市舘谷台16）",
    "events": [],
    "unverified": [
     "參拜時間、費用與休日：官方頁面未載明",
     "銀杏的棵數與名稱：官方頁面未載明（外部網站的「大銀杏 2 棵」不採用）",
     "通常見頃時期：官方未載明（外部網站的「11 月中旬～下旬」不是官方說法，不採用）",
     "廣德寺本身的官方網站：未能確認"
    ],
    "verified": "2026-10-02"
   },
   "allLinks": [
    {
     "role": "主要網址",
     "url": "https://www.akirunokanko.com/?cat=53"
    },
    {
     "role": "補充網址",
     "url": "https://www.akirunokanko.com/"
    },
    {
     "role": "證據頁",
     "date": "2025-11-08（發文）；2025-11-06（拍照）",
     "url": "https://www.akirunokanko.com/?p=8712"
    },
    {
     "role": "訪客資訊",
     "url": "https://www.city.akiruno.tokyo.jp/0000001442.html"
    },
    {
     "role": "訪客資訊",
     "url": "https://www.akirunokanko.com/?p=8731"
    }
   ]
  },
  {
   "id": "TKG-023",
   "row": "TKG-023",
   "zh": "明治神宮外苑 銀杏並木",
   "ja": "明治神宮外苑 いちょう並木",
   "wards": [
    "新宿區",
    "港區"
   ],
   "wardNote": "資料表未寫行政區；外苑官方所在地為新宿區霞ヶ丘町，並木代表點位於港區北青山一帶（共用快照座標註記），兩區都列。",
   "alias": "外苑 gaien 青山 神宮外苑 いちょう並木 絵画館",
   "grade": "C",
   "operator": "明治神宮外苑",
   "sheetName": "明治神宮外苑｜いちょう並木",
   "sheetArea": "明治神宮外苑・銀杏並木",
   "caveat": "不是明治神宮內苑。頁內老樹齡／株數含歷史基準，勿當2026現況。",
   "species": "銀杏",
   "lat": 35.6739,
   "lng": 139.7199,
   "pointLabel": "並木中點",
   "pointBasis": "並木本身的中點",
   "pointNote": "官方：青山口から円周道路まで約300 m、146本。三來源相差<150 m。",
   "pointConfidence": "high",
   "ginkgo": "官方：青山口到円周道路約 300 m、146 棵、四列並木，朝聖德紀念繪畫館方向依樹高排列（官方頁的歷史數值，不保證 2026 現況）。注意：不是明治神宮內苑。",
   "season": null,
   "proof": null,
   "status": "待確認",
   "checked": "2026-10-02",
   "links": [
    {
     "role": "主要網址",
     "url": "https://www.meijijingugaien.jp/walk/sight/season.html"
    },
    {
     "role": "補充網址",
     "url": "https://www.meijijingugaien.jp/news/"
    },
    {
     "role": "證據頁",
     "date": "未見可當現況的日期",
     "url": "https://www.meijijingugaien.jp/walk/sight/season.html"
    }
   ],
   "facts": {
    "address": {
     "text": "〒160-0013 東京都新宿区霞ヶ丘町1番1号",
     "note": "明治神宮外苑的所在地。"
    },
    "access": [
     "JR中央・総武線『信濃町駅』『千駄ヶ谷駅』",
     "東京メトロ銀座線『外苑前駅』『青山一丁目駅』",
     "東京メトロ半蔵門線『青山一丁目駅』",
     "都営大江戸線『国立競技場駅』『青山一丁目駅』",
     "最寄ICは首都高速4号新宿線『外苑出口』",
     "並木の位置：青山通り口から外苑中央広場円周道路まで"
    ],
    "hours": {
     "text": null
    },
    "closed": null,
    "fee": null,
    "phone": "03-3401-0312（代表）／FAX 03-3401-0676",
    "events": [],
    "unverified": [
     "開放時間、費用與利用規則：官方頁面未載明",
     "從車站的步行時間：官方交通圖未載明",
     "2026 年いちょう祭り是否舉辦與日期：未能核實"
    ],
    "verified": "2026-10-02"
   },
   "allLinks": [
    {
     "role": "主要網址",
     "url": "https://www.meijijingugaien.jp/walk/sight/season.html"
    },
    {
     "role": "補充網址",
     "url": "https://www.meijijingugaien.jp/news/"
    },
    {
     "role": "歷史紀錄 2022-11-17",
     "url": "https://www.meijijingugaien.jp/gaien-news/"
    },
    {
     "role": "訪客資訊",
     "url": "https://www.meijijingugaien.jp/walk/sight/"
    },
    {
     "role": "訪客資訊",
     "url": "https://www.meijijingugaien.jp/information/access-map.html"
    },
    {
     "role": "訪客資訊",
     "url": "https://www.meijijingugaien.jp/"
    }
   ]
  },
  {
   "id": "TKG-024",
   "row": "TKG-024",
   "zh": "大田黑公園",
   "ja": "大田黒公園",
   "wards": [
    "杉並區"
   ],
   "wardNote": null,
   "alias": "大田黒 otaguro 荻窪",
   "grade": "B",
   "operator": "杉並區官方指向之公園網站（荻窪三庭園）",
   "sheetName": "大田黑公園｜荻窪三庭園",
   "sheetArea": "杉並區",
   "caveat": "不得沿用已於2024年3月結束管理的箱根植木舊頁作現任營運來源。",
   "species": "銀杏",
   "lat": 35.7007,
   "lng": 139.6248,
   "pointLabel": "公園位置",
   "pointBasis": "公園（約0.9公頃，整園即為標的）",
   "pointNote": "三來源相差<40 m。管理者2024年起已非箱根植木（見TKG-039）。",
   "pointConfidence": "high",
   "ginkgo": "杉並區官方：正門進入後白色御影石步道筆直延伸 70 m，兩側是樹齡百年的大イチョウ並木。",
   "season": null,
   "proof": null,
   "status": "待確認",
   "checked": "2026-10-02",
   "links": [
    {
     "role": "主要網址",
     "url": "https://ogikubo3gardens.jp/ootaguro/"
    },
    {
     "role": "補充網址",
     "url": "https://ogikubo3gardens.jp/"
    },
    {
     "role": "證據頁",
     "date": "區公所頁更新2025-09-09",
     "url": "https://www.city.suginami.tokyo.jp/s100/shisetsu/14632.html"
    }
   ],
   "facts": {
    "address": "〒167-0051 東京都杉並区荻窪3丁目33番12号",
    "access": [
     "［電車でお越しの方］JR中央線・総武線荻窪駅、東京メトロ丸の内線荻窪駅より徒歩10分",
     "［車でお越しの方］駐車場のご用意はございません。車での来園はご遠慮ください",
     "［グリーンスローモビリティ］『大田黒公園』下車すぐ"
    ],
    "hours": {
     "text": "午前9時から午後5時（入園は午後4時30分まで）"
    },
    "closed": {
     "text": "水曜日、年末年始（12月29日から1月1日）",
     "note": "杉並區說明休園日可能變更，最新資訊以官方網頁為準。"
    },
    "fee": null,
    "phone": "03-3398-5814（管理事務室）",
    "events": [],
    "unverified": [
     "入園費用：兩個官方頁面都未載明",
     "2026 年秋季點燈是否舉辦與日期：未能核實"
    ],
    "verified": "2026-10-02"
   },
   "allLinks": [
    {
     "role": "主要網址",
     "url": "https://ogikubo3gardens.jp/ootaguro/"
    },
    {
     "role": "補充網址",
     "url": "https://ogikubo3gardens.jp/"
    },
    {
     "role": "證據頁",
     "date": "區公所頁更新2025-09-09",
     "url": "https://www.city.suginami.tokyo.jp/s100/shisetsu/14632.html"
    }
   ]
  },
  {
   "id": "TKG-025",
   "row": "TKG-025",
   "zh": "大國魂神社",
   "ja": "大國魂神社",
   "wards": [
    "府中市"
   ],
   "wardNote": null,
   "alias": "大国魂 okunitama 府中 大銀杏",
   "grade": "C",
   "operator": "大國魂神社",
   "sheetName": "大國魂神社｜大銀杏／公告",
   "sheetArea": "府中市",
   "caveat": "不要把附近馬場大門的櫸樹並木視為銀杏。",
   "species": "銀杏",
   "lat": 35.6676,
   "lng": 139.479,
   "pointLabel": "本殿・拝殿一帯（大銀杏在本殿の裏）",
   "pointBasis": "神社本殿・拝殿位置；官方稱大銀杏在其後方（南側）",
   "pointNote": "OSM與Wikipedia相差<20 m；大銀杏本身無獨立座標，實際樹位在此點後方數十公尺內。馬場大門的欅並木不是銀杏。",
   "pointConfidence": "high",
   "ginkgo": "官方「豆知識」：本殿後方有傳說樹齡約 1000 年的銀杏大樹。附近馬場大門的欅並木不是銀杏。",
   "season": null,
   "proof": null,
   "status": "待確認",
   "checked": "2026-10-02",
   "links": [
    {
     "role": "主要網址",
     "url": "https://www.ookunitamajinja.or.jp/mame/"
    },
    {
     "role": "補充網址",
     "url": "https://www.ookunitamajinja.or.jp/"
    },
    {
     "role": "證據頁",
     "date": "靜態資料",
     "url": "https://www.ookunitamajinja.or.jp/mame/"
    }
   ],
   "facts": {
    "address": "〒183-0023 東京都府中市宮町3-1",
    "access": [
     "京王線 府中駅南口から徒歩5分",
     "JR南武線・武蔵野線 府中本町駅から徒歩5分",
     "お車：中央自動車道 稲城ICまたは府中スマートICで降りて約10分。参拝者用無料駐車場あり（府中街道『府中本町駅入口』信号脇の新西参道から。ご参拝以外の方の駐車は不可）"
    ],
    "hours": {
     "text": "開門時間：9月15日～3月31日 6:30〜17:00／4月1日～9月14日 6:00〜17:00。ご祈祷 9:00〜16:00、御朱印受付 9:00〜17:00。祭典・行事等で変更の場合あり"
    },
    "closed": null,
    "fee": null,
    "phone": "042-362-2130（FAX 042-335-2621）",
    "events": [],
    "unverified": [
     "參拜費用與參拜規則：本站讀取的官方頁面未載明",
     "銀杏黃葉的見頃時期：官方未載明"
    ],
    "verified": "2026-10-02"
   },
   "allLinks": [
    {
     "role": "主要網址",
     "url": "https://www.ookunitamajinja.or.jp/mame/"
    },
    {
     "role": "補充網址",
     "url": "https://www.ookunitamajinja.or.jp/"
    },
    {
     "role": "訪客資訊",
     "url": "https://www.ookunitamajinja.or.jp/access/"
    }
   ]
  },
  {
   "id": "TKG-026",
   "row": "TKG-026",
   "zh": "靖國神社",
   "ja": "靖國神社",
   "wards": [
    "千代田區"
   ],
   "wardNote": null,
   "alias": "靖国 yasukuni 九段",
   "grade": "C",
   "operator": "靖國神社",
   "sheetName": "靖國神社｜官方公告、境內照片",
   "sheetArea": "千代田區",
   "caveat": "宣傳影片上線日不等於拍攝日。不可將未核視角的LIVE影片宣稱銀杏即時鏡頭。",
   "species": "銀杏專項現況待確認",
   "lat": 35.6941,
   "lng": 139.7431,
   "pointLabel": "境內主要區域（拝殿）",
   "pointBasis": "主殿拝殿位置（境內中心）",
   "pointNote": "神門 35.6943,139.7442；Jorudan稱「銀杏の並木道」（参道），但並木確切範圍與官方日期資料未核實。",
   "pointConfidence": "high",
   "ginkgo": "銀杏證據來自同一官方網域的公告：「参道のイチョウ並木」。並木確切範圍未核實。境內是莊嚴的祭祀場所，參觀請依官方規定。",
   "season": null,
   "proof": {
    "url": "https://www.yasukuni.or.jp/news_detail.html?id=492",
    "label": "同網域公告（令和5年09月06日）",
    "quote": "参道のイチョウ並木、社紋を刺繍した朱印用紙"
   },
   "status": "待確認",
   "checked": "2026-10-02",
   "links": [
    {
     "role": "主要網址",
     "url": "https://www.yasukuni.or.jp/"
    },
    {
     "role": "補充網址",
     "url": "https://www.yasukuni.or.jp/schedule/photo.html"
    },
    {
     "role": "證據頁",
     "date": "本次可讀2026公告",
     "url": "https://www.yasukuni.or.jp/schedule/photo.html"
    }
   ],
   "facts": {
    "address": "〒102-8246 東京都千代田区九段北3-1-1",
    "access": [
     "JR中央・総武線各駅停車『飯田橋駅（西口）』『市ケ谷駅』より各徒歩（約10分）",
     "東西線・半蔵門線・都営新宿線『九段下駅（出口1）』より徒歩（約5分）",
     "東西線・有楽町線・南北線・都営大江戸線『飯田橋駅（A2出口、A5出口、B2a出口）』より徒歩（約10分）",
     "有楽町線・南北線・都営新宿線『市ヶ谷駅（A4出口）』より徒歩（約10分）",
     "バス：九段下～高田馬場系統『九段上停留所』より徒歩（約1分）"
    ],
    "hours": {
     "text": "開門時刻：通年 午前6時。閉門時刻：1・2・11・12月 午後5時／3月〜10月 午後6時。祭典・行事等で変更の場合あり（新着情報で確認、または社務所へ）"
    },
    "closed": null,
    "fee": null,
    "phone": "03-3261-8326（代表）",
    "events": [],
    "unverified": [
     "參拜費用：官方頁面未載明",
     "銀杏的確切位置、棵數與見頃時期：官方只有朱印公告提到「参道のイチョウ並木」（令和5年09月06日），以及 150 週年頁的照片說明「外苑の銀杏並木」，未載明位置與棵數"
    ],
    "verified": "2026-10-02"
   },
   "allLinks": [
    {
     "role": "主要網址",
     "url": "https://www.yasukuni.or.jp/"
    },
    {
     "role": "補充網址",
     "url": "https://www.yasukuni.or.jp/schedule/photo.html"
    },
    {
     "role": "銀杏證據",
     "url": "https://www.yasukuni.or.jp/news_detail.html?id=492"
    },
    {
     "role": "訪客資訊",
     "url": "https://www.yasukuni.or.jp/access.html"
    },
    {
     "role": "訪客資訊",
     "url": "https://www.yasukuni.or.jp/hope.html"
    },
    {
     "role": "訪客資訊",
     "url": "https://www.yasukuni.or.jp/150th/project03.html"
    }
   ]
  },
  {
   "id": "TKG-030",
   "row": "TKG-030",
   "zh": "北之丸公園",
   "ja": "北の丸公園",
   "wards": [
    "千代田區"
   ],
   "wardNote": null,
   "alias": "北の丸 kitanomaru 武道館",
   "grade": "B",
   "operator": "一般財團法人國民公園協會 皇居外苑",
   "sheetName": "皇居外苑・北之丸公園｜國民公園協會",
   "sheetArea": "千代田區",
   "caveat": "與宮內廳東御苑不同來源、不同地理範圍。",
   "species": "銀杏專項現況待確認",
   "lat": 35.6915,
   "lng": 139.7511,
   "pointLabel": "公園中心（概略）",
   "pointBasis": "公園整體代表點",
   "pointNote": "約19公頃；國民公園協會頁面未核得銀杏專項地點。",
   "pointConfidence": "low",
   "ginkgo": "銀杏證據來自國民公園協會同網域文章：日本武道館前的「大イチョウ」。資料表此列為「皇居外苑・北之丸公園」，但只有北之丸公園證實有銀杏；皇居外苑本身未證實，所以不列為地點。",
   "season": null,
   "proof": {
    "url": "https://fng.or.jp/koukyo/2023/11/24/kitanomarukouennnokouyou/",
    "label": "同網域文章（2023-11-24）",
    "quote": "日本武道館の前には大イチョウと呼ばれる特別大きなイチョウの木"
   },
   "status": "待確認",
   "checked": "2026-10-02",
   "links": [
    {
     "role": "主要網址",
     "url": "https://fng.or.jp/koukyo/news/"
    },
    {
     "role": "證據頁",
     "date": "本次可見2026-09-19季節文章入口",
     "url": "https://fng.or.jp/koukyo/"
    }
   ],
   "facts": {
    "address": {
     "text": "〒100-0002 東京都千代田区皇居外苑1-1",
     "note": "管理單位國民公園協會皇居外苑（管轄範圍含北之丸公園）的所在地，不是公園本身的地址。"
    },
    "access": [
     "［北の丸公園］都営新宿線・東京メトロ東西線・半蔵門線 九段下駅 2出口より徒歩約5分／東京メトロ東西線 竹橋駅 毎日新聞社側1b出口または平川門側1a出口より徒歩約8分",
     "北の丸駐車場は公園内に3箇所（公園利用者向け）"
    ],
    "hours": {
     "text": "北の丸公園は常時開放・無休（国家行事等に伴う特別警備で一般利用が規制される日あり）。24時間入園可能（22時消灯）、夜間22時ごろ以降の利用は控える",
     "note": "22 時相關規定出自環境省 2025-11-04 紅葉期注意事項與利用案內。"
    },
    "closed": "無休（国家行事等に伴う特別警備時の利用規制を除く）",
    "fee": "無料（入園料はございません）",
    "phone": "03-3231-5509（平日 8:30〜17:00、国民公園協会 皇居外苑）",
    "events": [],
    "unverified": [
     "休憩所等設施的營業時間：未能確認",
     "銀杏的通常見頃時期：官方沒有例年說法，只有 2023 年文章當年寫的「12 月上旬」"
    ],
    "verified": "2026-10-02"
   },
   "allLinks": [
    {
     "role": "主要網址",
     "url": "https://fng.or.jp/koukyo/news/"
    },
    {
     "role": "證據頁",
     "date": "本次可見2026-09-19季節文章入口",
     "url": "https://fng.or.jp/koukyo/"
    },
    {
     "role": "銀杏證據",
     "url": "https://fng.or.jp/koukyo/2023/11/24/kitanomarukouennnokouyou/"
    },
    {
     "role": "歷史紀錄 2024-11-13",
     "url": "https://fng.or.jp/koukyo/2024/11/13/irodukukitanomarukouen/"
    },
    {
     "role": "訪客資訊",
     "url": "https://fng.or.jp/koukyo/access/"
    },
    {
     "role": "訪客資訊",
     "url": "https://www.env.go.jp/garden/kokyogaien/2_guide/kitanomarukoen_00001.html"
    },
    {
     "role": "訪客資訊",
     "url": "https://www.env.go.jp/garden/kokyogaien/news/2017/03/post_220_00002.html"
    },
    {
     "role": "訪客資訊",
     "url": "https://www.env.go.jp/garden/kokyogaien/news/autumn_leaves/index_4.html"
    }
   ]
  },
  {
   "id": "TKG-040-hongo",
   "row": "TKG-040",
   "zh": "東京大學 本鄉校區 銀杏並木",
   "ja": "東京大学 本郷キャンパス 銀杏並木",
   "wards": [
    "文京區"
   ],
   "wardNote": null,
   "alias": "東大 本郷 todai hongo 安田講堂 東京大学",
   "grade": "C",
   "operator": "東京大學",
   "sheetName": "東京大學｜本鄉・駒場校區官方入口",
   "sheetArea": "文京區、目黑區",
   "caveat": "本鄉、駒場、小石川植物園是不同地點。此頁未證實各校區的當季銀杏觀測。",
   "species": "銀杏專項現況待確認",
   "lat": 35.7131,
   "lng": 139.7606,
   "pointLabel": "並木中點",
   "pointBasis": "OSM名為「銀杏並木」的步道，並與正門、安田講堂位置吻合",
   "pointNote": "OSM以兩段名為「銀杏並木」的步道標出；安田講堂另有Wikipedia座標核對。",
   "pointConfidence": "high",
   "ginkgo": "東京大學官方頁介紹「本郷キャンパスの銀杏並木」（正門到安田講堂）。本鄉、駒場與小石川植物園是三個不同地點。校內參觀請遵守官方見學規則（例如商用拍攝、營利導覽不可）。",
   "season": null,
   "proof": {
    "url": "https://www.u-tokyo.ac.jp/ja/about/campus-guide/1km_of_campus.html",
    "label": "東京大學官方頁",
    "quote": "本郷キャンパスの銀杏並木"
   },
   "status": "待確認",
   "checked": "2026-10-02",
   "links": [
    {
     "role": "主要網址",
     "url": "https://www.u-tokyo.ac.jp/ja/about/campus-guide/index.html"
    },
    {
     "role": "證據頁",
     "date": "2026-04-01（地圖頁）",
     "url": "https://www.u-tokyo.ac.jp/ja/about/campus-guide/index.html"
    }
   ],
   "facts": {
    "address": "〒113-8654 東京都文京区本郷7-3-1",
    "access": [
     "地下鉄丸の内線 本郷三丁目駅より徒歩8分／大江戸線 本郷三丁目駅より徒歩6分／千代田線 湯島駅または根津駅より徒歩8分／南北線 東大前駅より徒歩1分／三田線 春日駅より徒歩10分"
    ],
    "hours": {
     "text": "本郷キャンパスの見学は7時～18時の範囲。門の開閉：正門 平日7時～18時（小扉7時～24時30分）・土日祝は閉鎖（小扉7時～24時30分）／龍岡門 常時開放／弥生門 平日7時～18時／池之端門 7時～22時 など"
    },
    "closed": "入試実施日等は入構不可",
    "fee": null,
    "phone": "本部事務 03(3812)2111／本郷キャンパス見学についてはWebフォーム",
    "events": [],
    "unverified": [
     "銀杏黃葉的時期：官方未公布時期，也沒有附日期的觀測",
     "見學規定的現況：官方見學頁仍留有過期的注意事項（例如 2026 年 1、2 月的入試日），實際運作請向校方確認"
    ],
    "verified": "2026-10-02"
   },
   "allLinks": [
    {
     "role": "主要網址",
     "url": "https://www.u-tokyo.ac.jp/ja/about/campus-guide/index.html"
    },
    {
     "role": "銀杏證據",
     "url": "https://www.u-tokyo.ac.jp/ja/about/campus-guide/1km_of_campus.html"
    },
    {
     "role": "訪客資訊",
     "url": "https://www.u-tokyo.ac.jp/ja/about/campus-guide/public02_05.html"
    },
    {
     "role": "訪客資訊",
     "url": "https://www.u-tokyo.ac.jp/ja/about/campus-guide/map01_02.html"
    },
    {
     "role": "訪客資訊",
     "url": "https://www.u-tokyo.ac.jp/ja/about/campus-guide/map02_02.html"
    },
    {
     "role": "訪客資訊",
     "url": "https://www.u-tokyo.ac.jp/ja/about/campus-guide/list.html"
    }
   ]
  },
  {
   "id": "TKG-040-komaba",
   "row": "TKG-040",
   "zh": "東京大學 駒場校區 銀杏並木",
   "ja": "東京大学 駒場キャンパス 銀杏並木",
   "wards": [
    "目黑區"
   ],
   "wardNote": null,
   "alias": "東大 駒場 todai komaba 東京大学",
   "grade": "C",
   "operator": "東京大學",
   "sheetName": "東京大學｜本鄉・駒場校區官方入口",
   "sheetArea": "文京區、目黑區",
   "caveat": "本鄉、駒場、小石川植物園是不同地點。此頁未證實各校區的當季銀杏觀測。",
   "species": "銀杏專項現況待確認",
   "lat": 35.6604,
   "lng": 139.6852,
   "pointLabel": "並木中段（概略）",
   "pointBasis": "東大官方文章描述的東西向幹線道路（1号館北側～コミュニケーションプラザ），依OSM樹列/樹木點與1号館(35.6600,139.6846)、101号館(35.6600,139.6856)的相對位置推定",
   "pointNote": "【注意】銀杏並木不是「正門～1号館」軸線，而是1号館北側的東西向道路。位置由官方文字＋OSM樹列推定，OSM樹木沒有樹種標籤，精度約±80 m。",
   "pointConfidence": "medium",
   "ginkgo": "東京大學官方網站：「秋には銀杏並木がメインストリートを黄色に染め上げる」。並木是 1 号館北側的東西向道路；代表點由官方文字與 OSM 樹列推定，精度約 ±80 m。",
   "season": null,
   "proof": {
    "url": "https://kimino.ct.u-tokyo.ac.jp/kotohajime/komaba-campus/",
    "label": "東京大學官方網站",
    "quote": "秋には銀杏並木がメインストリートを黄色に染め上げる"
   },
   "status": "待確認",
   "checked": "2026-10-02",
   "links": [
    {
     "role": "主要網址",
     "url": "https://www.u-tokyo.ac.jp/ja/about/campus-guide/index.html"
    },
    {
     "role": "證據頁",
     "date": "2026-04-01（地圖頁）",
     "url": "https://www.u-tokyo.ac.jp/ja/about/campus-guide/index.html"
    }
   ],
   "facts": {
    "address": "〒153-8902 東京都目黒区駒場3-8-1",
    "access": [
     "京王井の頭線 駒場東大前駅より徒歩0分（東口に正門、西口に坂下門）／代々木上原駅（小田急線・東京メトロ千代田線）より徒歩12分／東北沢駅（小田急線）より徒歩8分"
    ],
    "hours": {
     "text": null
    },
    "closed": "入試実施日等は入構不可。駒場IIキャンパスはキャンパス公開時を除き一般公開していない",
    "fee": null,
    "phone": "本部事務 03(3812)2111",
    "events": [],
    "unverified": [
     "銀杏黃葉的時期：官方未公布時期，也沒有附日期的觀測",
     "駒場校區的見學規則與開門時間：本站只讀到本鄉校區的官方 Q&A",
     "見學規定的現況：官方見學頁仍留有過期的注意事項（例如 2026 年 1、2 月的入試日），實際運作請向校方確認"
    ],
    "verified": "2026-10-02"
   },
   "allLinks": [
    {
     "role": "主要網址",
     "url": "https://www.u-tokyo.ac.jp/ja/about/campus-guide/index.html"
    },
    {
     "role": "銀杏證據",
     "url": "https://kimino.ct.u-tokyo.ac.jp/kotohajime/komaba-campus/"
    },
    {
     "role": "訪客資訊",
     "url": "https://www.u-tokyo.ac.jp/ja/about/campus-guide/public02_05.html"
    },
    {
     "role": "訪客資訊",
     "url": "https://www.u-tokyo.ac.jp/ja/about/campus-guide/map01_02.html"
    },
    {
     "role": "訪客資訊",
     "url": "https://www.u-tokyo.ac.jp/ja/about/campus-guide/map02_02.html"
    },
    {
     "role": "訪客資訊",
     "url": "https://www.u-tokyo.ac.jp/ja/about/campus-guide/list.html"
    }
   ]
  },
  {
   "id": "TKG-041",
   "row": "TKG-041",
   "zh": "國立 大學通",
   "ja": "国立市 大学通り",
   "wards": [
    "國立市"
   ],
   "wardNote": null,
   "alias": "国立 大学通り kunitachi 一橋",
   "grade": "C",
   "operator": "NPO法人國立市觀光まちづくり協會",
   "sheetName": "くにたちNAVI｜國立市觀光まちづくり協會",
   "sheetArea": "國立市・大學通り候選",
   "caveat": "區域旅遊更新不等於大學通り銀杏現況；可與Jorudan地點目錄交叉尋源。",
   "species": "銀杏專項現況待確認",
   "lat": 35.6945,
   "lng": 139.4468,
   "pointLabel": "国立駅南側の並木（代表點）",
   "pointBasis": "國立駅南口前的大學通り並木（約1.2 km，OSM樹列35.6982～35.6872）的代表點",
   "pointNote": "Jorudan稱此為イチョウ並木，但OSM樹列沒有樹種標籤，且大學通り也有櫻樹，無法由座標資料區分銀杏列與櫻列；公開頁面也未標出銀杏段的起訖。",
   "pointConfidence": "medium",
   "ginkgo": "くにたちNAVI：秋天「エレガントなイチョウの黄色で辺り一面が覆い尽くされます」。大學通也有櫻花，座標資料無法區分銀杏段與櫻花段。",
   "season": null,
   "proof": {
    "url": "https://kunimachi.jp/spot/daigakustreet/",
    "label": "くにたちNAVI 大学通り頁",
    "quote": "エレガントなイチョウの黄色で辺り一面が覆い尽くされます"
   },
   "status": "待確認",
   "checked": "2026-10-02",
   "links": [
    {
     "role": "主要網址",
     "url": "https://kunimachi.jp/"
    },
    {
     "role": "補充網址",
     "url": "https://sp.jorudan.co.jp/leaf/spot_J0193.html",
     "third": true,
     "thirdNote": "第三方平台 Jorudan，僅供尋源，未採用"
    },
    {
     "role": "證據頁",
     "date": "本次可見2026-09-25更新",
     "url": "https://kunimachi.jp/"
    }
   ],
   "facts": {
    "address": {
     "text": "東京都国立市東2丁目",
     "note": "くにたちNAVI「大学通り」頁所列的概略所在地。"
    },
    "access": [
     "国立駅から真っすぐ南に伸びる大きな道が『大学通り』",
     "JR中央線で東京駅から国立駅まで約45分",
     "国立にはJRの駅が3つ（国立・谷保・矢川）ある"
    ],
    "hours": {
     "text": null
    },
    "closed": null,
    "fee": null,
    "phone": "NPO法人 国立市観光まちづくり協会 042-574-1199（〒186-8501 東京都国立市富士見台2-47-1 国立市役所 北庁舎2階）",
    "events": [],
    "unverified": [
     "銀杏並木的長度、棵數與黃葉的通常時期：官方觀光網站「くにたちNAVI」未載明",
     "銀杏段的確切範圍（例如國立站到一橋大學一帶）：官方介紹未載明",
     "2026 年銀杏現況與點燈日期：未能核實"
    ],
    "verified": "2026-10-02"
   },
   "allLinks": [
    {
     "role": "主要網址",
     "url": "https://kunimachi.jp/"
    },
    {
     "role": "補充網址",
     "url": "https://sp.jorudan.co.jp/leaf/spot_J0193.html",
     "third": true,
     "thirdNote": "第三方平台 Jorudan，僅供尋源，未採用"
    },
    {
     "role": "銀杏證據",
     "url": "https://kunimachi.jp/spot/daigakustreet/"
    },
    {
     "role": "訪客資訊",
     "url": "https://kunimachi.jp/access/"
    }
   ]
  }
 ],
 "history": [
  {
   "place": "TKG-015",
   "date": "2025-11-28",
   "stage": "見頃",
   "text": "國民公園協會新宿御苑文章寫明園內各處銀杏已達「みごろ」，大溫室附近是熱門拍攝點。",
   "url": "https://fng.or.jp/shinjuku/2025/11/28/20251128_03/"
  },
  {
   "place": "TKG-017",
   "date": "2025-11-28",
   "stage": null,
   "text": "宮內廳「花だより」：苑內各處銀杏等落葉樹轉色，照片標示「百人番所前のイチョウ」。原文未標明階段。",
   "url": "https://www.kunaicho.go.jp/visit/higashigyoen/hanadayori/20251128.html"
  },
  {
   "place": "TKG-018",
   "date": "2025-11-19",
   "stage": null,
   "text": "「見ごろの植物」文章把イチョウ列在正在紅葉／黃葉的植物中。原文未標明階段；資料表提醒見到黃葉不等於已到見頃。日期依資料表（頁面本文未顯示日期）。",
   "url": "https://koishikawa-bg.jp/kaika/5013/"
  },
  {
   "place": "TKG-019",
   "date": "2025-11-08",
   "stage": null,
   "text": "觀光協會「のらぼう日記」（照片 2025-11-06 拍攝）：廣德寺銀杏轉色進展中，離見頃還差一點。原文沒有對應到本站六階段中的單一階段。",
   "url": "https://www.akirunokanko.com/?p=8712"
  },
  {
   "place": "TKG-014",
   "date": "2025-11-06～2025-12-04",
   "stage": null,
   "text": "「花だより」2025 年的歷史列表頁（資料表的證據日期範圍為 2025-10-23～12-04）。2026-10-02 再查時，イチョウ（黄葉）項目出現在 2025 年 11/6～12/4 之間的各期；各期的階段未逐篇整理。列表分頁位置會隨新文章變動。",
   "url": "https://www.showakinen-koen.jp/hanadayori/page/3/"
  },
  {
   "place": "TKG-030",
   "date": "2024-11-13",
   "stage": "色づき始め",
   "quote": "園内のイチョウは色づき始めたばかり",
   "text": "國民公園協會皇居外苑文章。",
   "url": "https://fng.or.jp/koukyo/2024/11/13/irodukukitanomarukouen/"
  },
  {
   "place": "TKG-030",
   "date": "2023-11-24",
   "stage": null,
   "quote": "日本武道館の前には大イチョウと呼ばれる特別大きなイチョウの木",
   "text": "同一篇文章寫大イチョウ「見ごろは12月上旬」，是 2023 年當時的說法，未對應到單一觀測階段。",
   "url": "https://fng.or.jp/koukyo/2023/11/24/kitanomarukouennnokouyou/"
  },
  {
   "place": "TKG-023",
   "date": "2022-11-17",
   "stage": "見頃",
   "quote": "イチョウ並木が見頃です",
   "text": "外苑便り貼文；這是外苑官方最近一則附日期的銀杏貼文。",
   "url": "https://www.meijijingugaien.jp/gaien-news/"
  }
 ],
 "current2026": [
  {
   "place": "TKG-016",
   "date": "2026-09-22",
   "text": "官方黃葉情報頁刊出 5 張照片（八王子市中央圖書館與多摩御陵入口交差點各兩個方向，以及ぎんなんの実），文字沒有寫出任何階段。",
   "url": "https://www.ichou-festa.org/ichounews/",
   "kind": "官方照片"
  },
  {
   "place": "TKG-016",
   "date": "2026-09-24",
   "quote": "高尾方面から色変わりが始まる時期となりました",
   "text": "官方公告只說進入轉色開始的時期，並說會不定期更新黃葉情報；不是對某地點的階段觀測。",
   "url": "https://www.ichou-festa.org/notice/post-3629/",
   "kind": "官方公告"
  }
 ],
 "sources": [
  {
   "key": "SN-TP",
   "rows": [
    "TKG-002",
    "TKG-003",
    "TKG-004",
    "TKG-005",
    "TKG-006",
    "TKG-007",
    "TKG-008",
    "TKG-009",
    "TKG-010",
    "TKG-011",
    "TKG-012",
    "TKG-013"
   ],
   "cat": "official",
   "grade": "S",
   "name": "東京都公園協會 12 個園區的共用說明（TKG-002～013）",
   "operator": "公益財團法人東京都公園協會",
   "links": [],
   "checked": [
    "2026-09-29"
   ],
   "supports": "資料表中這 12 列的「角色」「發現」「更新頻率」「建議檢查頻率」文字完全相同，合併成這一則；各列只保留自己的注意事項。",
   "finding": "2025年度官方紅葉情報名單明列本園區之銀杏；本次不宣稱已取得2026銀杏現況。",
   "role": "園區入口／公告；銀杏觀測資格由2025年度名單證實",
   "cadence": "中央整合頁2025季內每週兩次；園區個別公告頻率未承諾。",
   "poll": "季內每日檢查入口；依當年公告調整（建議）",
   "caveat": null,
   "places": [],
   "origin": "merged",
   "isNote": true
  },
  {
   "key": "SH-PRESS",
   "rows": [
    "TKG-001",
    "TKG-002",
    "TKG-003",
    "TKG-004",
    "TKG-005",
    "TKG-006",
    "TKG-007",
    "TKG-008",
    "TKG-009",
    "TKG-010",
    "TKG-011",
    "TKG-012",
    "TKG-013",
    "TKG-031",
    "TKG-038"
   ],
   "cat": "official",
   "grade": "S",
   "name": "東京都公園協會｜2025 年度紅葉情報新聞稿（PDF）",
   "operator": "公益財團法人東京都公園協會",
   "links": [
    {
     "role": "PDF",
     "url": "https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf",
     "date": "2025-11-04"
    }
   ],
   "checked": [
    "2026-09-29",
    "2026-10-02"
   ],
   "supports": "2025 年度 37 處公園／庭園紅葉情報名單，其中 11 列含銀杏（12 個具名園區）。本站 TKG-002～013 的銀杏資格依這份名單；神代植物公園在名單中是楓樹（モミジ）。",
   "caveat": "這是 2025 年資料，不是 2026 現況。37 處不是 37 處銀杏。木場公園的官方園區頁與上野恩賜公園的東京都公園協會園區頁都沒有提到銀杏（東京都建設局上野公園頁的「主な植物」列有イチョウ，但未載明位置），兩處的地點資格依這份名單。2026-10-02 再查時 PDF 可開啟（HTTP 200），但部分自動查核無法擷取 PDF 文字。",
   "places": [
    "TKG-002",
    "TKG-003",
    "TKG-004",
    "TKG-005",
    "TKG-006",
    "TKG-007",
    "TKG-008",
    "TKG-009",
    "TKG-010",
    "TKG-011",
    "TKG-012",
    "TKG-013"
   ],
   "origin": "merged"
  },
  {
   "key": "SH-JMA",
   "rows": [
    "TKG-020",
    "TKG-021",
    "TKG-022"
   ],
   "cat": "jma",
   "grade": "O",
   "name": "氣象廳｜生物季節觀測資料首頁",
   "operator": "日本氣象廳",
   "links": [
    {
     "role": "證據頁",
     "url": "https://www.data.jma.go.jp/sakura/data/"
    }
   ],
   "checked": [
    "2026-09-29",
    "2026-10-02"
   ],
   "supports": "生物季節觀測以各氣象台的標本木、依統一基準進行；資料每日約 08:35（日本時間）更新。",
   "caveat": "觀測站日期不能當作每個公園的最佳觀賞日；未報告不等於青葉。",
   "places": [],
   "origin": "merged"
  },
  {
   "key": "SH-JORUDAN",
   "rows": [
    "TKG-036",
    "TKG-041"
   ],
   "cat": "third",
   "grade": "T",
   "name": "Jorudan｜國立大學通 紅葉景點頁",
   "operator": "ジョルダン（民間平台）",
   "links": [
    {
     "role": "景點頁",
     "url": "https://sp.jorudan.co.jp/leaf/spot_J0193.html"
    }
   ],
   "checked": [
    "2026-09-29",
    "2026-10-02"
   ],
   "supports": "第三方地點目錄（TKG-036 的證據頁、TKG-041 的補充網址）。頁面只有一般性的「紅葉の見頃 11月下旬」，不是觀測，本站沒有採用。",
   "caveat": "頁面上約 120 棵的棵數只出現在第三方頁面，不作為證據。",
   "places": [],
   "origin": "merged"
  },
  {
   "key": "TKG-001",
   "rows": [
    "TKG-001"
   ],
   "cat": "official",
   "grade": "S",
   "name": "東京都公園協會｜紅葉情報入口",
   "operator": "東京都建設局／公益財團法人東京都公園協會",
   "links": [
    {
     "role": "主要網址",
     "url": "https://www.tokyo-park.or.jp/"
    },
    {
     "role": "補充網址",
     "url": "https://www.tokyo-park.or.jp/park_list/"
    },
    {
     "role": "證據頁",
     "shared": "SH-PRESS"
    }
   ],
   "checked": [
    "2026-09-29",
    "2026-10-02"
   ],
   "supports": "2025 年度紅葉情報整合公告的入口。2026-10-02 再查：2026 年度紅葉情報頁尚未開設，2025 舊專頁回傳 404（見 TKG-038）。",
   "finding": "2025年度公告提供37處公園／庭園紅葉情報；其中11列含銀杏，合計12個具名園區。",
   "sharedNote": null,
   "caveat": "2026年度沿用日期及網址尚未確認。37處不是37處銀杏。",
   "places": [],
   "mapNote": "入口頁，不是單一觀賞地點。",
   "origin": "sheet"
  },
  {
   "key": "TKG-002",
   "rows": [
    "TKG-002"
   ],
   "cat": "official",
   "grade": "S",
   "name": "上野恩賜公園",
   "operator": "公益財團法人東京都公園協會",
   "links": [
    {
     "role": "主要網址",
     "url": "https://www.tokyo-park.or.jp/park/ueno/"
    },
    {
     "role": "證據頁",
     "shared": "SH-PRESS"
    }
   ],
   "checked": [
    "2026-09-29",
    "2026-10-02"
   ],
   "supports": "「上野恩賜公園」的官方園區頁（地址、交通、開放時間等訪客資訊）。2026-10-02 再查：沒有 2026 銀杏葉況。",
   "finding": null,
   "sharedNote": "SN-TP",
   "caveat": "可列為銀杏專項季節觀測候選。",
   "places": [
    "TKG-002"
   ],
   "mapNote": null,
   "origin": "sheet"
  },
  {
   "key": "TKG-003",
   "rows": [
    "TKG-003"
   ],
   "cat": "official",
   "grade": "S",
   "name": "木場公園",
   "operator": "公益財團法人東京都公園協會",
   "links": [
    {
     "role": "主要網址",
     "url": "https://www.tokyo-park.or.jp/park/kiba/"
    },
    {
     "role": "證據頁",
     "shared": "SH-PRESS"
    }
   ],
   "checked": [
    "2026-09-29",
    "2026-10-02"
   ],
   "supports": "「木場公園」的官方園區頁（地址、交通、開放時間等訪客資訊）。2026-10-02 再查：沒有 2026 銀杏葉況。",
   "finding": null,
   "sharedNote": "SN-TP",
   "caveat": "保留園區原文所指子地點。",
   "places": [
    "TKG-003"
   ],
   "mapNote": null,
   "origin": "sheet"
  },
  {
   "key": "TKG-004",
   "rows": [
    "TKG-004"
   ],
   "cat": "official",
   "grade": "S",
   "name": "小金井公園",
   "operator": "公益財團法人東京都公園協會",
   "links": [
    {
     "role": "主要網址",
     "url": "https://www.tokyo-park.or.jp/park/koganei/"
    },
    {
     "role": "證據頁",
     "shared": "SH-PRESS"
    }
   ],
   "checked": [
    "2026-09-29",
    "2026-10-02"
   ],
   "supports": "「小金井公園」的官方園區頁（地址、交通、開放時間等訪客資訊）。2026-10-02 再查：沒有 2026 銀杏葉況。",
   "finding": null,
   "sharedNote": "SN-TP",
   "caveat": "園區跨行政區；不以服務中心地址代表全部觀測點。",
   "places": [
    "TKG-004"
   ],
   "mapNote": null,
   "origin": "sheet"
  },
  {
   "key": "TKG-005",
   "rows": [
    "TKG-005"
   ],
   "cat": "official",
   "grade": "S",
   "name": "芝公園",
   "operator": "公益財團法人東京都公園協會",
   "links": [
    {
     "role": "主要網址",
     "url": "https://www.tokyo-park.or.jp/park/siba/"
    },
    {
     "role": "證據頁",
     "shared": "SH-PRESS"
    }
   ],
   "checked": [
    "2026-09-29",
    "2026-10-02"
   ],
   "supports": "「芝公園」的官方園區頁（地址、交通、開放時間等訪客資訊）。2026-10-02 再查：沒有 2026 銀杏葉況。",
   "finding": null,
   "sharedNote": "SN-TP",
   "caveat": "銀杏與もみじ谷分開。正確網址使用siba，不是shiba。",
   "places": [
    "TKG-005"
   ],
   "mapNote": null,
   "origin": "sheet"
  },
  {
   "key": "TKG-006",
   "rows": [
    "TKG-006"
   ],
   "cat": "official",
   "grade": "S",
   "name": "城北中央公園",
   "operator": "公益財團法人東京都公園協會",
   "links": [
    {
     "role": "主要網址",
     "url": "https://www.tokyo-park.or.jp/park/johoku-chuo/"
    },
    {
     "role": "證據頁",
     "shared": "SH-PRESS"
    }
   ],
   "checked": [
    "2026-09-29",
    "2026-10-02"
   ],
   "supports": "「城北中央公園」的官方園區頁（地址、交通、開放時間等訪客資訊）。2026-10-02 再查：沒有 2026 銀杏葉況。",
   "finding": null,
   "sharedNote": "SN-TP",
   "caveat": "必須按物種取值，不把櫸樹葉況套用銀杏。",
   "places": [
    "TKG-006"
   ],
   "mapNote": null,
   "origin": "sheet"
  },
  {
   "key": "TKG-007",
   "rows": [
    "TKG-007"
   ],
   "cat": "official",
   "grade": "S",
   "name": "善福寺川緑地",
   "operator": "公益財團法人東京都公園協會",
   "links": [
    {
     "role": "主要網址",
     "url": "https://www.tokyo-park.or.jp/park/zempukujigawa-ryokuchi/index.html"
    },
    {
     "role": "證據頁",
     "shared": "SH-PRESS"
    }
   ],
   "checked": [
    "2026-09-29",
    "2026-10-02"
   ],
   "supports": "「善福寺川緑地」的官方園區頁（地址、交通、開放時間等訪客資訊）。2026-10-02 再查：沒有 2026 銀杏葉況。",
   "finding": null,
   "sharedNote": "SN-TP",
   "caveat": "2025表與和田堀公園合併一列，不能假設各有獨立觀測。",
   "places": [
    "TKG-007"
   ],
   "mapNote": null,
   "origin": "sheet"
  },
  {
   "key": "TKG-008",
   "rows": [
    "TKG-008"
   ],
   "cat": "official",
   "grade": "S",
   "name": "和田堀公園",
   "operator": "公益財團法人東京都公園協會",
   "links": [
    {
     "role": "主要網址",
     "url": "https://www.tokyo-park.or.jp/park/wadabori/"
    },
    {
     "role": "證據頁",
     "shared": "SH-PRESS"
    }
   ],
   "checked": [
    "2026-09-29",
    "2026-10-02"
   ],
   "supports": "「和田堀公園」的官方園區頁（地址、交通、開放時間等訪客資訊）。2026-10-02 再查：沒有 2026 銀杏葉況。",
   "finding": null,
   "sharedNote": "SN-TP",
   "caveat": "2025表與善福寺川緑地合併一列，保留共同來源關係。",
   "places": [
    "TKG-008"
   ],
   "mapNote": null,
   "origin": "sheet"
  },
  {
   "key": "TKG-009",
   "rows": [
    "TKG-009"
   ],
   "cat": "official",
   "grade": "S",
   "name": "戸山公園",
   "operator": "公益財團法人東京都公園協會",
   "links": [
    {
     "role": "主要網址",
     "url": "https://www.tokyo-park.or.jp/park/toyama/"
    },
    {
     "role": "證據頁",
     "shared": "SH-PRESS"
    }
   ],
   "checked": [
    "2026-09-29",
    "2026-10-02"
   ],
   "supports": "「戸山公園」的官方園區頁（地址、交通、開放時間等訪客資訊）。2026-10-02 再查：沒有 2026 銀杏葉況。",
   "finding": null,
   "sharedNote": "SN-TP",
   "caveat": "須擷取銀杏段落／欄位，不直接使用全園紅葉狀態。",
   "places": [
    "TKG-009"
   ],
   "mapNote": null,
   "origin": "sheet"
  },
  {
   "key": "TKG-010",
   "rows": [
    "TKG-010"
   ],
   "cat": "official",
   "grade": "S",
   "name": "光が丘公園",
   "operator": "公益財團法人東京都公園協會",
   "links": [
    {
     "role": "主要網址",
     "url": "https://www.tokyo-park.or.jp/park/hikarigaoka/"
    },
    {
     "role": "證據頁",
     "shared": "SH-PRESS"
    }
   ],
   "checked": [
    "2026-09-29",
    "2026-10-02"
   ],
   "supports": "「光が丘公園」的官方園區頁（地址、交通、開放時間等訪客資訊）。2026-10-02 再查：沒有 2026 銀杏葉況。",
   "finding": null,
   "sharedNote": "SN-TP",
   "caveat": "銀杏並木與ふれあいの径宜設為不同子地點。",
   "places": [
    "TKG-010"
   ],
   "mapNote": null,
   "origin": "sheet"
  },
  {
   "key": "TKG-011",
   "rows": [
    "TKG-011"
   ],
   "cat": "official",
   "grade": "S",
   "name": "日比谷公園",
   "operator": "公益財團法人東京都公園協會",
   "links": [
    {
     "role": "主要網址",
     "url": "https://www.tokyo-park.or.jp/park/hibiya/"
    },
    {
     "role": "證據頁",
     "shared": "SH-PRESS"
    }
   ],
   "checked": [
    "2026-09-29",
    "2026-10-02"
   ],
   "supports": "「日比谷公園」的官方園區頁（地址、交通、開放時間等訪客資訊）。2026-10-02 再查：沒有 2026 銀杏葉況。",
   "finding": null,
   "sharedNote": "SN-TP",
   "caveat": "葉況與施工、通行公告分開管理。",
   "places": [
    "TKG-011"
   ],
   "mapNote": null,
   "origin": "sheet"
  },
  {
   "key": "TKG-012",
   "rows": [
    "TKG-012"
   ],
   "cat": "official",
   "grade": "S",
   "name": "代々木公園",
   "operator": "公益財團法人東京都公園協會",
   "links": [
    {
     "role": "主要網址",
     "url": "https://www.tokyo-park.or.jp/park/yoyogi/"
    },
    {
     "role": "證據頁",
     "shared": "SH-PRESS"
    }
   ],
   "checked": [
    "2026-09-29",
    "2026-10-02"
   ],
   "supports": "「代々木公園」的官方園區頁（地址、交通、開放時間等訪客資訊）。2026-10-02 再查：沒有 2026 銀杏葉況。",
   "finding": null,
   "sharedNote": "SN-TP",
   "caveat": "黃葉公告須限定原文明示區域，不擴張為全園。",
   "places": [
    "TKG-012"
   ],
   "mapNote": null,
   "origin": "sheet"
  },
  {
   "key": "TKG-013",
   "rows": [
    "TKG-013"
   ],
   "cat": "official",
   "grade": "S",
   "name": "旧岩崎邸庭園",
   "operator": "公益財團法人東京都公園協會",
   "links": [
    {
     "role": "主要網址",
     "url": "https://www.tokyo-park.or.jp/park/kyu-iwasaki-tei/"
    },
    {
     "role": "證據頁",
     "shared": "SH-PRESS"
    }
   ],
   "checked": [
    "2026-09-29",
    "2026-10-02"
   ],
   "supports": "「旧岩崎邸庭園」的官方園區頁（地址、交通、開放時間等訪客資訊）。2026-10-02 再查：沒有 2026 銀杏葉況。",
   "finding": null,
   "sharedNote": "SN-TP",
   "caveat": "活動或集章日期不是見頃日；注意官網改版後網址。",
   "places": [
    "TKG-013"
   ],
   "mapNote": null,
   "origin": "sheet"
  },
  {
   "key": "TKG-014",
   "rows": [
    "TKG-014"
   ],
   "cat": "official",
   "grade": "A",
   "name": "國營昭和記念公園｜花だより",
   "operator": "國營昭和記念公園官方網站",
   "links": [
    {
     "role": "主要網址",
     "url": "https://www.showakinen-koen.jp/hanadayori/"
    },
    {
     "role": "補充網址",
     "url": "https://www.showakinen-koen.jp/flower-information/"
    },
    {
     "role": "證據頁",
     "url": "https://www.showakinen-koen.jp/hanadayori/page/3/",
     "date": "2025-10-23至2025-12-04"
    }
   ],
   "checked": [
    "2026-09-29",
    "2026-10-02"
   ],
   "supports": "昭和記念公園「花だより」附日期的植物快訊（證據列表頁涵蓋 2025-10-23～12-04；2026-10-02 再查，イチョウ（黄葉）項目出現在 2025 年 11/6～12/4 的各期，列為歷史紀錄）；補充網址是花・植物指南（イチョウ（黄葉）10月下旬～11月下旬、兩條並木的長度）。2026-10-02 再查：10/1 的花だより沒有銀杏。",
   "finding": "歷史列表有連續多期イチョウ情報；植物指南明列イチョウ（黄葉）。",
   "sharedNote": null,
   "caveat": "カナール、かたらいのイチョウ並木分開；page/3分頁位置會隨新增文章變動，不可當永久存檔ID。",
   "places": [
    "TKG-014"
   ],
   "mapNote": null,
   "origin": "sheet"
  },
  {
   "key": "TKG-015",
   "rows": [
    "TKG-015"
   ],
   "cat": "official",
   "grade": "A",
   "name": "新宿御苑｜國民公園協會自然情報",
   "operator": "一般財團法人國民公園協會 新宿御苑",
   "links": [
    {
     "role": "主要網址",
     "url": "https://fng.or.jp/shinjuku/news/"
    },
    {
     "role": "補充網址",
     "url": "https://policies.env.go.jp/national-garden/shinjukugyoen/index.html"
    },
    {
     "role": "證據頁",
     "url": "https://fng.or.jp/shinjuku/2025/11/28/20251128_03/",
     "date": "2025-11-28"
    }
   ],
   "checked": [
    "2026-09-29",
    "2026-10-02"
   ],
   "supports": "新宿御苑自然情報（2025-11-28 見頃文章列為歷史紀錄）與環境省新宿御苑頁。2026-10-02 再查：最新文章沒有銀杏。",
   "finding": "日期文章明確敘述銀杏黃葉見頃，包含溫室附近照片及園內植物地圖。",
   "sharedNote": null,
   "caveat": "舊文只當歷史樣本。環境省管理資訊與協會自然情報各有用途；不可混入同期其他樹種狀態。",
   "places": [
    "TKG-015"
   ],
   "mapNote": null,
   "origin": "sheet"
  },
  {
   "key": "TKG-016",
   "rows": [
    "TKG-016"
   ],
   "cat": "official",
   "grade": "A",
   "name": "八王子いちょう祭り｜黄葉情報",
   "operator": "八王子いちょう祭り祭典委員會",
   "links": [
    {
     "role": "主要網址",
     "url": "https://www.ichou-festa.org/ichounews/"
    },
    {
     "role": "補充網址",
     "url": "https://www.ichou-festa.org/"
    },
    {
     "role": "證據頁",
     "url": "https://www.ichou-festa.org/notice/post-3629/",
     "date": "2026-09-24（更新公告）"
    }
   ],
   "checked": [
    "2026-09-29",
    "2026-10-02"
   ],
   "supports": "八王子いちょう祭り黃葉情報：2026-09-22 照片、2026-09-24 公告（都未標明階段）；祭典日期 2026-11-21・22。",
   "finding": "黄葉情報頁可見2026-09-22拍攝日期，分中央圖書館、多摩御陵入口及觀看方向。",
   "sharedNote": null,
   "caveat": "已確認2026季內內容，但不能只看照片日期就自動判定見頃。祭典日期與葉況分離。",
   "places": [
    "TKG-016"
   ],
   "mapNote": null,
   "origin": "sheet"
  },
  {
   "key": "TKG-017",
   "rows": [
    "TKG-017"
   ],
   "cat": "official",
   "grade": "A",
   "name": "宮內廳｜皇居東御苑 花だより",
   "operator": "宮內廳",
   "links": [
    {
     "role": "主要網址",
     "url": "https://www.kunaicho.go.jp/visit/higashigyoen/hanadayori/index.html"
    },
    {
     "role": "補充網址",
     "url": "https://www.kunaicho.go.jp/visit/higashigyoen/index.html"
    },
    {
     "role": "證據頁",
     "url": "https://www.kunaicho.go.jp/visit/higashigyoen/hanadayori/20251128.html",
     "date": "2025-11-28"
    }
   ],
   "checked": [
    "2026-09-29",
    "2026-10-02"
   ],
   "supports": "皇居東御苑「花だより」：2025-11-28「百人番所前のイチョウ」列為歷史紀錄。2026-10-02 再查：最新一期 2026-09-18 沒有銀杏。",
   "finding": "日期文記錄銀杏等樹木變色，照片標示百人番所前のイチョウ。",
   "sharedNote": null,
   "caveat": "東御苑不是皇居外苑或北之丸公園。全園葉落描述不可自動套用銀杏。",
   "places": [
    "TKG-017"
   ],
   "mapNote": null,
   "origin": "sheet"
  },
  {
   "key": "TKG-018",
   "rows": [
    "TKG-018"
   ],
   "cat": "official",
   "grade": "A",
   "name": "小石川植物園｜見ごろの植物",
   "operator": "東京大學大學院理學系研究科附屬植物園",
   "links": [
    {
     "role": "主要網址",
     "url": "https://koishikawa-bg.jp/kaikainfo/"
    },
    {
     "role": "補充網址",
     "url": "https://koishikawa-bg.jp/kaika/"
    },
    {
     "role": "證據頁",
     "url": "https://koishikawa-bg.jp/kaika/5013/",
     "date": "2025-11-19"
    }
   ],
   "checked": [
    "2026-09-29",
    "2026-10-02"
   ],
   "supports": "小石川植物園開花・紅葉狀況：2025-11-19 文章列為歷史紀錄。2026-10-02 再查 12 篇最新文章都沒有銀杏。",
   "finding": "當日文章將イチョウ明列於正在紅葉／黃葉的植物清單。",
   "sharedNote": null,
   "caveat": "見到黃葉不等於已到見頃。小石川植物園與小石川後樂園是不同地點。",
   "places": [
    "TKG-018"
   ],
   "mapNote": null,
   "origin": "sheet"
  },
  {
   "key": "TKG-019",
   "rows": [
    "TKG-019"
   ],
   "cat": "official",
   "grade": "A",
   "name": "あきる野市觀光協會｜のらぼう日記",
   "operator": "あきる野市觀光協會",
   "links": [
    {
     "role": "主要網址",
     "url": "https://www.akirunokanko.com/?cat=53"
    },
    {
     "role": "補充網址",
     "url": "https://www.akirunokanko.com/"
    },
    {
     "role": "證據頁",
     "url": "https://www.akirunokanko.com/?p=8712",
     "date": "2025-11-08（發文）；2025-11-06（拍照）"
    }
   ],
   "checked": [
    "2026-09-29",
    "2026-10-02"
   ],
   "supports": "あきる野市觀光協會紅葉巡查：2025-11-08 廣德寺銀杏列為歷史紀錄。2026-10-02 再查：尚無 2026 紅葉文章。",
   "finding": "廣德寺段落明寫銀杏變色進展、尚差一些到見頃；原文另給照片拍攝日期。",
   "sharedNote": null,
   "caveat": "石舟橋段落是楓樹，不能套用到廣德寺銀杏。發文日與拍攝日分開。",
   "places": [
    "TKG-019"
   ],
   "mapNote": null,
   "origin": "sheet"
  },
  {
   "key": "TKG-020",
   "rows": [
    "TKG-020"
   ],
   "cat": "jma",
   "grade": "O",
   "name": "氣象廳｜いちょうの黄葉日",
   "operator": "日本氣象廳",
   "links": [
    {
     "role": "主要網址",
     "url": "https://www.data.jma.go.jp/sakura/data/phn_012.html"
    },
    {
     "role": "證據頁",
     "shared": "SH-JMA"
    }
   ],
   "checked": [
    "2026-09-29",
    "2026-10-02"
   ],
   "supports": "氣象廳東京站いちょう黄葉日：平年值 11/23（1991–2020）、2025 年 11/22；2026 年尚未觀測（頁面顯示 ///）。只代表標本木，不代表各園區。",
   "finding": "有東京及其他站的銀杏黃葉日期表；官網說明觀測以標本木進行。",
   "sharedNote": null,
   "caveat": "觀測站日期不能充當每處公園最佳觀賞日；未報告不等於青葉。",
   "places": [],
   "mapNote": "氣象廳觀測站尺度，不代表任何園區。",
   "origin": "sheet"
  },
  {
   "key": "TKG-021",
   "rows": [
    "TKG-021"
   ],
   "cat": "jma",
   "grade": "O",
   "name": "氣象廳｜いちょうの落葉日",
   "operator": "日本氣象廳",
   "links": [
    {
     "role": "主要網址",
     "url": "https://www.data.jma.go.jp/sakura/data/phn_013.html"
    },
    {
     "role": "證據頁",
     "shared": "SH-JMA"
    }
   ],
   "checked": [
    "2026-09-29",
    "2026-10-02"
   ],
   "supports": "氣象廳東京站いちょう落葉日：平年值 12/3、2025 年 12/4；2026 年尚未觀測（頁面顯示 ///）。",
   "finding": "有銀杏落葉日期表，與黃葉日分開。",
   "sharedNote": null,
   "caveat": "不是全東京銀杏落葉完成日；保留站點和觀測現象定義。",
   "places": [],
   "mapNote": "氣象廳觀測站尺度，不代表任何園區。",
   "origin": "sheet"
  },
  {
   "key": "TKG-022",
   "rows": [
    "TKG-022"
   ],
   "cat": "jma",
   "grade": "O",
   "name": "氣象廳｜生物季節累年值CSV入口",
   "operator": "日本氣象廳",
   "links": [
    {
     "role": "主要網址",
     "url": "https://www.data.jma.go.jp/sakura/data/download_ruinenchi.html"
    },
    {
     "role": "證據頁",
     "shared": "SH-JMA"
    }
   ],
   "checked": [
    "2026-09-29",
    "2026-10-02"
   ],
   "supports": "生物季節累年值 CSV 下載入口（平年值與歷年日期的出處）。",
   "finding": "下載索引提供いちょう黄葉與いちょう落葉CSV連結。",
   "sharedNote": null,
   "caveat": "已驗證下載入口；本次未成功取得CSV檔位元組，也未驗證CSV欄位。不可宣稱API已測通。",
   "places": [],
   "mapNote": "資料下載入口。",
   "origin": "sheet"
  },
  {
   "key": "TKG-023",
   "rows": [
    "TKG-023"
   ],
   "cat": "official",
   "grade": "C",
   "name": "明治神宮外苑｜いちょう並木",
   "operator": "明治神宮外苑",
   "links": [
    {
     "role": "主要網址＝證據頁",
     "url": "https://www.meijijingugaien.jp/walk/sight/season.html"
    },
    {
     "role": "補充網址",
     "url": "https://www.meijijingugaien.jp/news/"
    }
   ],
   "checked": [
    "2026-09-29",
    "2026-10-02"
   ],
   "supports": "明治神宮外苑いちょう並木官方介紹（並木長度與棵數為歷史數值）。外苑便り 2022-11-17 的見頃貼文列為歷史紀錄（見補充來源）。2026-10-02 再查：沒有 2026 銀杏葉況。",
   "finding": "官網明確介紹銀杏並木與四季景觀；本次未確認穩定的逐日銀杏葉況專頁。",
   "sharedNote": null,
   "caveat": "不是明治神宮內苑。頁內老樹齡／株數含歷史基準，勿當2026現況。",
   "places": [
    "TKG-023"
   ],
   "mapNote": null,
   "origin": "sheet"
  },
  {
   "key": "TKG-024",
   "rows": [
    "TKG-024"
   ],
   "cat": "official",
   "grade": "B",
   "name": "大田黑公園｜荻窪三庭園",
   "operator": "杉並區官方指向之公園網站（荻窪三庭園）",
   "links": [
    {
     "role": "主要網址",
     "url": "https://ogikubo3gardens.jp/ootaguro/"
    },
    {
     "role": "補充網址",
     "url": "https://ogikubo3gardens.jp/"
    },
    {
     "role": "證據頁",
     "url": "https://www.city.suginami.tokyo.jp/s100/shisetsu/14632.html",
     "date": "區公所頁更新2025-09-09"
    }
   ],
   "checked": [
    "2026-09-29",
    "2026-10-02"
   ],
   "supports": "大田黑公園官方網站（荻窪三庭園）與杉並區官方頁（銀杏並木）。2026-10-02 再查：沒有 2026 葉況。",
   "finding": "杉並區官網證明銀杏並木及現行官方網址；本次自動讀取公園頁未取得正文。",
   "sharedNote": null,
   "caveat": "不得沿用已於2024年3月結束管理的箱根植木舊頁作現任營運來源。",
   "places": [
    "TKG-024"
   ],
   "mapNote": null,
   "origin": "sheet"
  },
  {
   "key": "TKG-025",
   "rows": [
    "TKG-025"
   ],
   "cat": "official",
   "grade": "C",
   "name": "大國魂神社｜大銀杏／公告",
   "operator": "大國魂神社",
   "links": [
    {
     "role": "主要網址＝證據頁",
     "url": "https://www.ookunitamajinja.or.jp/mame/"
    },
    {
     "role": "補充網址",
     "url": "https://www.ookunitamajinja.or.jp/"
    }
   ],
   "checked": [
    "2026-09-29",
    "2026-10-02"
   ],
   "supports": "大國魂神社官方「豆知識」頁：本殿後方的大銀杏。沒有附日期的觀測文章。",
   "finding": "神社官網確認本殿後方的大銀杏；未確認定期黃葉觀測文章。",
   "sharedNote": null,
   "caveat": "不要把附近馬場大門的櫸樹並木視為銀杏。",
   "places": [
    "TKG-025"
   ],
   "mapNote": null,
   "origin": "sheet"
  },
  {
   "key": "TKG-026",
   "rows": [
    "TKG-026"
   ],
   "cat": "official",
   "grade": "C",
   "name": "靖國神社｜官方公告、境內照片",
   "operator": "靖國神社",
   "links": [
    {
     "role": "主要網址",
     "url": "https://www.yasukuni.or.jp/"
    },
    {
     "role": "補充網址＝證據頁",
     "url": "https://www.yasukuni.or.jp/schedule/photo.html"
    }
   ],
   "checked": [
    "2026-09-29",
    "2026-10-02"
   ],
   "supports": "靖國神社官方入口與照片頁；銀杏證據來自同網域公告（見補充來源）。2026-10-02 再查：沒有附日期的銀杏觀測。",
   "finding": "官網和照片入口存在；本次未核得可直接當銀杏現況的日期觀測文章。",
   "sharedNote": null,
   "caveat": "宣傳影片上線日不等於拍攝日。不可將未核視角的LIVE影片宣稱銀杏即時鏡頭。",
   "places": [
    "TKG-026"
   ],
   "mapNote": null,
   "origin": "sheet"
  },
  {
   "key": "TKG-027",
   "rows": [
    "TKG-027"
   ],
   "cat": "official",
   "grade": "C",
   "name": "GO TOKYO｜秋季紅葉指南",
   "operator": "東京官方旅遊網站 GO TOKYO",
   "links": [
    {
     "role": "主要網址＝證據頁",
     "url": "https://www.gotokyo.org/jp/story/guide/autumn-leaves-forecast/index.html"
    }
   ],
   "checked": [
    "2026-09-29"
   ],
   "supports": "景點發現與官方外連；本站沒有用它判斷任何狀態。",
   "finding": "指南明確介紹明治神宮外苑銀杏等秋季地點。",
   "sharedNote": null,
   "caveat": "網址含forecast不等於有當日銀杏觀測；文章更新日不能代表照片日期。",
   "places": [],
   "mapNote": "觀光入口，不是單一觀賞地點。",
   "origin": "sheet"
  },
  {
   "key": "TKG-028",
   "rows": [
    "TKG-028"
   ],
   "cat": "official",
   "grade": "C",
   "name": "千代田區觀光協會｜景點／專題",
   "operator": "千代田區觀光協會",
   "links": [
    {
     "role": "主要網址＝證據頁",
     "url": "https://visit-chiyoda.tokyo/app/spot"
    },
    {
     "role": "補充網址",
     "url": "https://visit-chiyoda.tokyo/app/feature"
    }
   ],
   "checked": [
    "2026-09-29"
   ],
   "supports": "區內候選地點發現；本站沒有用它判斷任何狀態。",
   "finding": "景點列表有紅葉名所分類；可用來查區內候選地點。",
   "sharedNote": null,
   "caveat": "尚未證實它對行幸通り等逐點提供定期銀杏觀測。",
   "places": [],
   "mapNote": "觀光入口，不是單一觀賞地點。",
   "origin": "sheet"
  },
  {
   "key": "TKG-029",
   "rows": [
    "TKG-029"
   ],
   "cat": "official",
   "grade": "C",
   "name": "新宿觀光振興協會｜官方入口",
   "operator": "新宿觀光振興協會",
   "links": [
    {
     "role": "主要網址＝證據頁",
     "url": "https://www.kanko-shinjuku.jp/"
    }
   ],
   "checked": [
    "2026-09-29"
   ],
   "supports": "新宿區觀光入口；本站沒有用它判斷任何狀態。",
   "finding": "官方觀光入口可讀；銀杏日期快訊本次未確認。",
   "sharedNote": null,
   "caveat": "不能取代新宿御苑管理相關單位的實際植物報告。",
   "places": [],
   "mapNote": "觀光入口，不是單一觀賞地點。",
   "origin": "sheet"
  },
  {
   "key": "TKG-030",
   "rows": [
    "TKG-030"
   ],
   "cat": "official",
   "grade": "B",
   "name": "皇居外苑・北之丸公園｜國民公園協會",
   "operator": "一般財團法人國民公園協會 皇居外苑",
   "links": [
    {
     "role": "主要網址",
     "url": "https://fng.or.jp/koukyo/news/"
    },
    {
     "role": "證據頁",
     "url": "https://fng.or.jp/koukyo/",
     "date": "本次可見2026-09-19季節文章入口"
    }
   ],
   "checked": [
    "2026-09-29",
    "2026-10-02"
   ],
   "supports": "國民公園協會皇居外苑・北之丸公園消息。北之丸公園的銀杏證據與歷史紀錄來自同網域文章（2023-11-24、2024-11-13）。",
   "finding": "有持續更新的自然／四季消息；本次未核得銀杏專項葉況。",
   "sharedNote": null,
   "caveat": "與宮內廳東御苑不同來源、不同地理範圍。",
   "places": [
    "TKG-030"
   ],
   "mapNote": null,
   "origin": "sheet"
  },
  {
   "key": "TKG-031",
   "rows": [
    "TKG-031"
   ],
   "cat": "official",
   "grade": "B",
   "name": "神代植物公園｜園區植物公告",
   "operator": "公益財團法人東京都公園協會",
   "links": [
    {
     "role": "主要網址",
     "url": "https://www.tokyo-park.or.jp/park/jindai/"
    },
    {
     "role": "證據頁",
     "shared": "SH-PRESS"
    }
   ],
   "checked": [
    "2026-09-29",
    "2026-10-02"
   ],
   "supports": "神代植物公園官方入口（訪客資訊 2026-10-02 查核）；本站沒有用它判斷銀杏狀態。",
   "finding": "有植物園官方入口；中央紅葉名單對本園記錄的是モミジ。",
   "sharedNote": null,
   "caveat": "不可把中央名單的楓樹狀態當作銀杏。",
   "places": [],
   "mapNote": "2025 中央名單記錄本園為楓樹（モミジ），不是銀杏。",
   "origin": "sheet"
  },
  {
   "key": "TKG-032",
   "rows": [
    "TKG-032"
   ],
   "cat": "official",
   "grade": "B",
   "name": "府中市鄉土之森博物館｜花ごよみ",
   "operator": "府中市鄉土之森博物館官方營運網站",
   "links": [
    {
     "role": "主要網址＝證據頁",
     "url": "https://www.fuchu-cpf.or.jp/museum/hanagoyomi/index.html"
    },
    {
     "role": "補充網址",
     "url": "https://www.fuchu-cpf.or.jp/museum/"
    }
   ],
   "checked": [
    "2026-09-29"
   ],
   "supports": "府中市鄉土之森博物館花曆；本次內容不足以證實銀杏。",
   "finding": "植物狀況頁持續更新，但本次所讀內容不足以證實銀杏專項發布。",
   "sharedNote": null,
   "caveat": "不要把彼岸花／萩等花況轉成銀杏；照片需獨立核日期。",
   "places": [],
   "mapNote": "銀杏物種與現況都待補證。",
   "origin": "sheet"
  },
  {
   "key": "TKG-033",
   "rows": [
    "TKG-033"
   ],
   "cat": "third",
   "grade": "T",
   "name": "tenki.jp｜東京都紅葉情報",
   "operator": "tenki.jp（非景點管理機關）",
   "links": [
    {
     "role": "主要網址＝證據頁",
     "url": "https://tenki.jp/kouyou/3/16/"
    },
    {
     "role": "補充網址",
     "url": "https://tenki.jp/kouyou/3/16/30688.html"
    }
   ],
   "checked": [
    "2026-09-29"
   ],
   "supports": "第三方整合紅葉資訊；本站沒有採用其狀態或照片。",
   "finding": "東京都列表顯示2026季資訊；來源說明每日綜合各景點回報。含明治外苑、大田黑、廣德寺等。",
   "sharedNote": null,
   "caveat": "多樹種混合；示意照片不等於當日照片。38個東京都紅葉點不等於38個銀杏點。",
   "places": [],
   "mapNote": "第三方平台，不作為地點或狀態依據。",
   "origin": "sheet"
  },
  {
   "key": "TKG-034",
   "rows": [
    "TKG-034"
   ],
   "cat": "third",
   "grade": "T",
   "name": "Weathernews｜東京都紅葉情報",
   "operator": "Weathernews（民間氣象平台）",
   "links": [
    {
     "role": "主要網址＝證據頁",
     "url": "https://weathernews.jp/koyo/area/tokyo/"
    }
   ],
   "checked": [
    "2026-09-29"
   ],
   "supports": "第三方紅葉平台；本站沒有採用其狀態。",
   "finding": "確認2026東京專頁存在；本次解析結果不足以核對所有景點及銀杏專屬欄位。",
   "sharedNote": null,
   "caveat": "勿宣稱其所有預報／回報均為官方實測。動態渲染內容需另做實測。",
   "places": [],
   "mapNote": "第三方平台，不作為地點或狀態依據。",
   "origin": "sheet"
  },
  {
   "key": "TKG-035",
   "rows": [
    "TKG-035"
   ],
   "cat": "third",
   "grade": "T",
   "name": "WalkerPlus｜東京 黃色に色づく",
   "operator": "KADOKAWA／WalkerPlus",
   "links": [
    {
     "role": "主要網址",
     "url": "https://koyo.walkerplus.com/yellow/ar0313/"
    },
    {
     "role": "補充網址",
     "url": "https://koyo.walkerplus.com/list/ar0313/"
    },
    {
     "role": "證據頁",
     "url": "https://koyo.walkerplus.com/detail/ar0313e154517/",
     "date": "2026-09-28（芝公園狀態）"
    }
   ],
   "checked": [
    "2026-09-29"
   ],
   "supports": "第三方景點目錄；本站沒有採用其狀態或圖片。",
   "finding": "黃色分類列56項（含其他黃葉樹種）；芝公園頁色づき來源標示JRシステム。",
   "sharedNote": null,
   "caveat": "56項不是56處銀杏確證；2026葉況旁可並列2025活動。圖片二次使用受限。",
   "places": [],
   "mapNote": "第三方平台，不作為地點或狀態依據。",
   "origin": "sheet"
  },
  {
   "key": "TKG-036",
   "rows": [
    "TKG-036"
   ],
   "cat": "third",
   "grade": "T",
   "name": "Jorudan｜東京都 紅葉情報",
   "operator": "ジョルダン（民間平台）",
   "links": [
    {
     "role": "主要網址",
     "url": "https://sp.jorudan.co.jp/leaf/tokyo.html"
    },
    {
     "role": "證據頁",
     "shared": "SH-JORUDAN"
    }
   ],
   "checked": [
    "2026-09-29"
   ],
   "supports": "第三方景點與交通資訊；本站只把它當地點目錄參考，沒有採用其狀態。",
   "finding": "東京紅葉列表及國立大學通り等景點入口，可作地點查漏。",
   "sharedNote": null,
   "caveat": "歷年通常見頃不等於今年現況；不要假設所有點均有當日觀測。",
   "places": [],
   "mapNote": "第三方平台，不作為地點或狀態依據。",
   "origin": "sheet"
  },
  {
   "key": "TKG-037",
   "rows": [
    "TKG-037"
   ],
   "cat": "third",
   "grade": "T",
   "name": "日本氣象株式會社｜紅葉・黃葉見頃預想",
   "operator": "日本氣象株式會社（不是氣象廳）",
   "links": [
    {
     "role": "主要網址＝證據頁",
     "url": "https://n-kishou.com/corp/news-contents/autumn/"
    }
   ],
   "checked": [
    "2026-09-29"
   ],
   "supports": "民間氣象公司（不是氣象廳）的黃葉預想；本站沒有採用任何預報。",
   "finding": "2026第一回預報明確區分銀杏黃葉與楓樹紅葉。",
   "sharedNote": null,
   "caveat": "必須標forecast，保留發布日、預測對象和尺度；不得覆寫公園實際觀測。",
   "places": [],
   "mapNote": "民間預報，不作為狀態依據。",
   "origin": "sheet"
  },
  {
   "key": "TKG-038",
   "rows": [
    "TKG-038"
   ],
   "cat": "excluded",
   "grade": "X",
   "name": "東京都公園協會｜2025紅葉季舊專頁",
   "operator": "公益財團法人東京都公園協會",
   "links": [
    {
     "role": "主要網址",
     "url": "https://www.tokyo-park.or.jp/special/kouyou/index.html",
     "dead": true,
     "deadNote": "2026-10-02 再查回傳 404，已失效"
    },
    {
     "role": "證據頁",
     "shared": "SH-PRESS"
    }
   ],
   "checked": [
    "2026-09-29",
    "2026-10-02"
   ],
   "supports": "失效紀錄：2025 紅葉季舊專頁；2026-10-02 再查仍回傳 404。",
   "finding": "2025公告指向此頁；本次查核回傳404。",
   "sharedNote": null,
   "caveat": "此列保留作失效紀錄，不計入可立即使用的現況來源。",
   "places": [],
   "mapNote": "失效來源。",
   "origin": "sheet"
  },
  {
   "key": "TKG-039",
   "rows": [
    "TKG-039"
   ],
   "cat": "excluded",
   "grade": "X",
   "name": "箱根植木｜大田黑公園舊管理案例",
   "operator": "箱根植木（舊管理公司）",
   "links": [
    {
     "role": "主要網址",
     "url": "https://hakone-ueki.com/casestudy/case1/"
    },
    {
     "role": "證據頁",
     "url": "https://hakone-ueki.com/",
     "date": "管理期2011-04至2024-03"
    }
   ],
   "checked": [
    "2026-09-29"
   ],
   "supports": "排除：舊管理公司頁面，大田黑公園的管理已於 2024 年 3 月結束；現行入口見 TKG-024。",
   "finding": "公司首頁明寫大田黑公園管理已於2024年3月結束。",
   "sharedNote": null,
   "caveat": "只保留遷移／排除理由；現行入口由杉並區官方指向荻窪三庭園。",
   "places": [],
   "mapNote": "排除來源。",
   "origin": "sheet"
  },
  {
   "key": "TKG-040",
   "rows": [
    "TKG-040"
   ],
   "cat": "official",
   "grade": "C",
   "name": "東京大學｜本鄉・駒場校區官方入口",
   "operator": "東京大學",
   "links": [
    {
     "role": "主要網址＝證據頁",
     "url": "https://www.u-tokyo.ac.jp/ja/about/campus-guide/index.html"
    }
   ],
   "checked": [
    "2026-09-29",
    "2026-10-02"
   ],
   "supports": "東京大學校區官方入口（見學規則、地圖）；本鄉與駒場的銀杏證據來自其他東大官方頁面（見補充來源）。",
   "finding": "確認本鄉及駒場的官方地圖／參觀入口；尚未確認穩定的銀杏日期觀測來源。",
   "sharedNote": null,
   "caveat": "本鄉、駒場、小石川植物園是不同地點。此頁未證實各校區的當季銀杏觀測。",
   "places": [
    "TKG-040-hongo",
    "TKG-040-komaba"
   ],
   "mapNote": null,
   "origin": "sheet"
  },
  {
   "key": "TKG-041",
   "rows": [
    "TKG-041"
   ],
   "cat": "official",
   "grade": "C",
   "name": "くにたちNAVI｜國立市觀光まちづくり協會",
   "operator": "NPO法人國立市觀光まちづくり協會",
   "links": [
    {
     "role": "主要網址＝證據頁",
     "url": "https://kunimachi.jp/"
    },
    {
     "role": "補充網址",
     "shared": "SH-JORUDAN"
    }
   ],
   "checked": [
    "2026-09-29",
    "2026-10-02"
   ],
   "supports": "くにたちNAVI（國立市觀光まちづくり協會）；大學通的銀杏證據見補充來源。",
   "finding": "頁尾確認營運者為國立市觀光まちづくり協會；本次未確認定期銀杏葉況文章。",
   "sharedNote": null,
   "caveat": "區域旅遊更新不等於大學通り銀杏現況；可與Jorudan地點目錄交叉尋源。",
   "places": [
    "TKG-041"
   ],
   "mapNote": null,
   "origin": "sheet"
  },
  {
   "key": "SP-COORDS",
   "rows": [],
   "cat": "third",
   "grade": null,
   "name": "園區代表點座標｜2026-10-02 共用快照",
   "operator": "OpenStreetMap（Nominatim／Overpass）、日文維基百科、Weathernews／Jorudan／WalkerPlus 景點座標等公開圖資（非官方）",
   "links": [
    {
     "role": "OpenStreetMap 地名檢索（Nominatim）",
     "url": "https://nominatim.openstreetmap.org/"
    },
    {
     "role": "OpenStreetMap 資料授權（ODbL）",
     "url": "https://www.openstreetmap.org/copyright"
    },
    {
     "role": "日文維基百科",
     "url": "https://ja.wikipedia.org/"
    }
   ],
   "checked": [
    "2026-10-02"
   ],
   "supports": "全部 26 個地點的園區代表點座標：地圖標記、觀測卡的「園區代表點」，以及散步路線的直線距離、步行估時與 Google 地圖導航起訖點。",
   "caveat": "不是官方公布的座標。各點由上述公開圖資平均，部分依官方頁面文字（例如「温室近く」「百人番所前」）推定，誤差約數十至數百公尺，也不代表銀杏樹的精確位置。第三方平台的座標只用於取點，沒有用於任何狀態。",
   "places": [
    "TKG-002",
    "TKG-003",
    "TKG-004",
    "TKG-005",
    "TKG-006",
    "TKG-007",
    "TKG-008",
    "TKG-009",
    "TKG-010",
    "TKG-011",
    "TKG-012",
    "TKG-013",
    "TKG-014",
    "TKG-015",
    "TKG-016",
    "TKG-017",
    "TKG-018",
    "TKG-019",
    "TKG-023",
    "TKG-024",
    "TKG-025",
    "TKG-026",
    "TKG-030",
    "TKG-040-hongo",
    "TKG-040-komaba",
    "TKG-041"
   ],
   "origin": "snapshot"
  },
  {
   "key": "SP-YASUKUNI",
   "rows": [],
   "cat": "official",
   "grade": null,
   "name": "靖國神社｜秋季限定刺繡朱印公告（令和5年09月06日）",
   "operator": "靖國神社",
   "links": [
    {
     "role": "頁面",
     "url": "https://www.yasukuni.or.jp/news_detail.html?id=492"
    }
   ],
   "checked": [
    "2026-10-02"
   ],
   "supports": "銀杏證據：「参道のイチョウ並木」。",
   "caveat": null,
   "places": [
    "TKG-026"
   ],
   "origin": "snapshot"
  },
  {
   "key": "SP-KITA23",
   "rows": [],
   "cat": "official",
   "grade": null,
   "name": "國民公園協會 皇居外苑｜北之丸公園的紅葉（2023-11-24）",
   "operator": "一般財團法人國民公園協會 皇居外苑",
   "links": [
    {
     "role": "頁面",
     "url": "https://fng.or.jp/koukyo/2023/11/24/kitanomarukouennnokouyou/"
    }
   ],
   "checked": [
    "2026-10-02"
   ],
   "supports": "銀杏證據：日本武道館前的大イチョウ；歷史紀錄（2023-11-24）。",
   "caveat": null,
   "places": [
    "TKG-030"
   ],
   "origin": "snapshot"
  },
  {
   "key": "SP-KITA24",
   "rows": [],
   "cat": "official",
   "grade": null,
   "name": "國民公園協會 皇居外苑｜色づく北の丸公園（2024-11-13）",
   "operator": "一般財團法人國民公園協會 皇居外苑",
   "links": [
    {
     "role": "頁面",
     "url": "https://fng.or.jp/koukyo/2024/11/13/irodukukitanomarukouen/"
    }
   ],
   "checked": [
    "2026-10-02"
   ],
   "supports": "歷史紀錄：「園内のイチョウは色づき始めたばかり」。",
   "caveat": null,
   "places": [
    "TKG-030"
   ],
   "origin": "snapshot"
  },
  {
   "key": "SP-UT1KM",
   "rows": [],
   "cat": "official",
   "grade": null,
   "name": "東京大學｜1km of campus（本郷キャンパス）",
   "operator": "東京大學",
   "links": [
    {
     "role": "頁面",
     "url": "https://www.u-tokyo.ac.jp/ja/about/campus-guide/1km_of_campus.html"
    }
   ],
   "checked": [
    "2026-10-02"
   ],
   "supports": "銀杏證據：「本郷キャンパスの銀杏並木」。",
   "caveat": null,
   "places": [
    "TKG-040-hongo"
   ],
   "origin": "snapshot"
  },
  {
   "key": "SP-KIMINO-H",
   "rows": [],
   "cat": "official",
   "grade": null,
   "name": "東京大學 キミノ｜本郷キャンパス",
   "operator": "東京大學",
   "links": [
    {
     "role": "頁面",
     "url": "https://kimino.ct.u-tokyo.ac.jp/kotohajime/hongo-campus/"
    }
   ],
   "checked": [
    "2026-10-02"
   ],
   "supports": "輔助證據：正門起的銀杏並木。",
   "caveat": null,
   "places": [
    "TKG-040-hongo"
   ],
   "origin": "snapshot"
  },
  {
   "key": "SP-KIMINO-K",
   "rows": [],
   "cat": "official",
   "grade": null,
   "name": "東京大學 キミノ｜駒場キャンパス",
   "operator": "東京大學",
   "links": [
    {
     "role": "頁面",
     "url": "https://kimino.ct.u-tokyo.ac.jp/kotohajime/komaba-campus/"
    }
   ],
   "checked": [
    "2026-10-02"
   ],
   "supports": "銀杏證據：「秋には銀杏並木がメインストリートを黄色に染め上げる」。",
   "caveat": null,
   "places": [
    "TKG-040-komaba"
   ],
   "origin": "snapshot"
  },
  {
   "key": "SP-UTFOCUS",
   "rows": [],
   "cat": "official",
   "grade": null,
   "name": "東京大學｜駒場Iキャンパス專題",
   "operator": "東京大學",
   "links": [
    {
     "role": "頁面",
     "url": "https://www.u-tokyo.ac.jp/focus/ja/features/z1304_00053.html"
    }
   ],
   "checked": [
    "2026-10-02"
   ],
   "supports": "輔助證據：駒場I校區的銀杏並木位置描述。",
   "caveat": null,
   "places": [
    "TKG-040-komaba"
   ],
   "origin": "snapshot"
  },
  {
   "key": "SP-KUNI",
   "rows": [],
   "cat": "official",
   "grade": null,
   "name": "くにたちNAVI｜大学通り",
   "operator": "NPO法人國立市觀光まちづくり協會",
   "links": [
    {
     "role": "頁面",
     "url": "https://kunimachi.jp/spot/daigakustreet/"
    }
   ],
   "checked": [
    "2026-10-02"
   ],
   "supports": "銀杏證據：秋天大學通的イチョウ黃葉。",
   "caveat": null,
   "places": [
    "TKG-041"
   ],
   "origin": "snapshot"
  },
  {
   "key": "SP-GAIEN",
   "rows": [],
   "cat": "official",
   "grade": null,
   "name": "明治神宮外苑｜外苑便り",
   "operator": "明治神宮外苑",
   "links": [
    {
     "role": "頁面",
     "url": "https://www.meijijingugaien.jp/gaien-news/"
    }
   ],
   "checked": [
    "2026-10-02"
   ],
   "supports": "歷史紀錄：2022-11-17「イチョウ並木が見頃です」（外苑最近一則附日期的官方銀杏貼文）。",
   "caveat": null,
   "places": [
    "TKG-023"
   ],
   "origin": "snapshot"
  },
  {
   "key": "SP-SHOWA-NIGHT",
   "rows": [],
   "cat": "official",
   "grade": null,
   "name": "國營昭和紀念公園｜黄葉・紅葉まつり＆秋の夜散歩2026",
   "operator": "國營昭和記念公園官方網站",
   "links": [
    {
     "role": "頁面",
     "url": "https://www.showakinen-koen.jp/autumn-night-walk/"
    }
   ],
   "checked": [
    "2026-10-02"
   ],
   "supports": "活動日期 2026-10-29～11-29（不是見頃日期）；兩條並木的棵數與長度；轉色順序說明。",
   "caveat": null,
   "places": [
    "TKG-014"
   ],
   "origin": "snapshot"
  },
  {
   "key": "SP-STAMP",
   "rows": [],
   "cat": "official",
   "grade": null,
   "name": "東京都公園協會｜都立9庭園 紅葉めぐりスタンプラリー2026",
   "operator": "公益財團法人東京都公園協會",
   "links": [
    {
     "role": "頁面",
     "url": "https://www.tokyo-park.or.jp/special/9gardens_stamp/index.html"
    }
   ],
   "checked": [
    "2026-10-02"
   ],
   "supports": "活動日期 2026-10-10～12-06（不是見頃日期）。",
   "caveat": null,
   "places": [
    "TKG-013"
   ],
   "origin": "snapshot"
  },
  {
   "key": "SP-JMA013",
   "rows": [],
   "cat": "jma",
   "grade": "O",
   "name": "氣象廳｜いちょう黄葉日 累年值 CSV",
   "operator": "日本氣象廳",
   "links": [
    {
     "role": "頁面",
     "url": "https://www.data.jma.go.jp/sakura/data/ruinenchi/013.csv"
    }
   ],
   "checked": [
    "2026-10-02"
   ],
   "supports": "東京站いちょう黄葉日平年值 11/23 與 2016–2025 年歷年日期的出處。",
   "caveat": null,
   "places": [],
   "origin": "snapshot"
  },
  {
   "key": "SP-JMA014",
   "rows": [],
   "cat": "jma",
   "grade": "O",
   "name": "氣象廳｜いちょう落葉日 累年值 CSV",
   "operator": "日本氣象廳",
   "links": [
    {
     "role": "頁面",
     "url": "https://www.data.jma.go.jp/sakura/data/ruinenchi/014.csv"
    }
   ],
   "checked": [
    "2026-10-02"
   ],
   "supports": "東京站いちょう落葉日平年值 12/3 的出處。",
   "caveat": null,
   "places": [],
   "origin": "snapshot"
  },
  {
   "key": "SP-ICHOU-EVENT",
   "rows": [],
   "cat": "official",
   "grade": null,
   "name": "八王子いちょう祭り｜イベント",
   "operator": "八王子いちょう祭り祭典委員會",
   "links": [
    {
     "role": "頁面",
     "url": "https://www.ichou-festa.org/event"
    }
   ],
   "checked": [
    "2026-10-02"
   ],
   "supports": "第47回八王子いちょう祭り 2026-11-21・22（祭典日期，不是見頃日期）。",
   "caveat": null,
   "places": [
    "TKG-016"
   ],
   "origin": "snapshot"
  },
  {
   "key": "SF-TKG-002",
   "rows": [],
   "cat": "official",
   "grade": null,
   "name": "上野恩賜公園｜訪客資訊官方頁面",
   "operator": "東京都建設局（上野恩賜公園）",
   "links": [
    {
     "role": "頁面",
     "url": "https://www.kensetsu.metro.tokyo.lg.jp/jimusho/toubuk/ueno/kouenannai"
    },
    {
     "role": "頁面",
     "url": "https://www.kensetsu.metro.tokyo.lg.jp/jimusho/toubuk/ueno/access"
    },
    {
     "role": "頁面",
     "url": "https://www.kensetsu.metro.tokyo.lg.jp/jimusho/toubuk/ueno/rules"
    },
    {
     "role": "頁面",
     "url": "https://www.kensetsu.metro.tokyo.lg.jp/jimusho/toubuk/ueno/midokoro/shizen"
    }
   ],
   "checked": [
    "2026-10-02"
   ],
   "supports": "觀測卡「官方資訊摘錄」的所在地、交通、開放時間（兩個官方頁面說法不同）、休園日、費用、電話；以及「銀杏在哪裡」欄的「主な植物」イチョウ記載與植物月曆的例年說法。與資料表該列的官方網址一起使用。",
   "caveat": null,
   "places": [
    "TKG-002"
   ],
   "origin": "snapshot"
  },
  {
   "key": "SF-TKG-003",
   "rows": [],
   "cat": "official",
   "grade": null,
   "name": "木場公園｜訪客資訊官方頁面",
   "operator": "公益財團法人東京都公園協會",
   "links": [
    {
     "role": "頁面",
     "url": "https://www.tokyo-park.or.jp/park/kiba/assets/公園利用の注意事項（木場公園）（PDF）.pdf"
    }
   ],
   "checked": [
    "2026-10-02"
   ],
   "supports": "觀測卡「官方資訊摘錄」的所在地、交通、開放時間、休園日、費用、電話。與資料表該列的官方網址一起使用。",
   "caveat": null,
   "places": [
    "TKG-003"
   ],
   "origin": "snapshot"
  },
  {
   "key": "SF-TKG-005",
   "rows": [],
   "cat": "official",
   "grade": null,
   "name": "芝公園｜訪客資訊官方頁面",
   "operator": "公益財團法人東京都公園協會",
   "links": [
    {
     "role": "頁面",
     "url": "https://www.tokyo-park.or.jp/park/siba/assets/files/shiba_eng.pdf"
    }
   ],
   "checked": [
    "2026-10-02"
   ],
   "supports": "觀測卡「官方資訊摘錄」的所在地、交通、開放時間、休園日、費用、電話。與資料表該列的官方網址一起使用。",
   "caveat": null,
   "places": [
    "TKG-005"
   ],
   "origin": "snapshot"
  },
  {
   "key": "SF-TKG-009",
   "rows": [],
   "cat": "official",
   "grade": null,
   "name": "戶山公園｜訪客資訊官方頁面",
   "operator": "公益財團法人東京都公園協會",
   "links": [
    {
     "role": "頁面",
     "url": "https://www.tokyo-park.or.jp/park/toyama/assets/files/toyama_eng.pdf"
    }
   ],
   "checked": [
    "2026-10-02"
   ],
   "supports": "觀測卡「官方資訊摘錄」的所在地、交通、開放時間、休園日、費用、電話。與資料表該列的官方網址一起使用。",
   "caveat": null,
   "places": [
    "TKG-009"
   ],
   "origin": "snapshot"
  },
  {
   "key": "SF-TKG-011",
   "rows": [],
   "cat": "official",
   "grade": null,
   "name": "日比谷公園｜訪客資訊官方頁面",
   "operator": "公益財團法人東京都公園協會",
   "links": [
    {
     "role": "頁面",
     "url": "https://www.tokyo-park.or.jp/park/hibiya/assets/files/hibiyapark_map_english.pdf"
    }
   ],
   "checked": [
    "2026-10-02"
   ],
   "supports": "觀測卡「官方資訊摘錄」的所在地、交通、開放時間、休園日、費用、電話。與資料表該列的官方網址一起使用。",
   "caveat": null,
   "places": [
    "TKG-011"
   ],
   "origin": "snapshot"
  },
  {
   "key": "SF-TKG-012",
   "rows": [],
   "cat": "official",
   "grade": null,
   "name": "代代木公園｜訪客資訊官方頁面",
   "operator": "公益財團法人東京都公園協會",
   "links": [
    {
     "role": "頁面",
     "url": "https://www.tokyo-park.or.jp/park/yoyogi/assets/files/yoyogi-kinshi20230919.pdf"
    }
   ],
   "checked": [
    "2026-10-02"
   ],
   "supports": "觀測卡「官方資訊摘錄」的所在地、交通、開放時間、休園日、費用、電話。與資料表該列的官方網址一起使用。",
   "caveat": null,
   "places": [
    "TKG-012"
   ],
   "origin": "snapshot"
  },
  {
   "key": "SF-TKG-013",
   "rows": [],
   "cat": "official",
   "grade": null,
   "name": "舊岩崎邸庭園｜訪客資訊官方頁面",
   "operator": "公益財團法人東京都公園協會",
   "links": [
    {
     "role": "頁面",
     "url": "https://www.tokyo-park.or.jp/park/kyu-iwasaki-tei/news/2025/park_info_1.html"
    },
    {
     "role": "頁面",
     "url": "https://www.tokyo-park.or.jp/park/kyu-iwasaki-tei/assets/files/kyuiwasaki_eng.pdf"
    }
   ],
   "checked": [
    "2026-10-02"
   ],
   "supports": "觀測卡「官方資訊摘錄」的所在地、交通、開放時間、休園日、費用、電話、官方活動日期。與資料表該列的官方網址一起使用。",
   "caveat": null,
   "places": [
    "TKG-013"
   ],
   "origin": "snapshot"
  },
  {
   "key": "SF-TKG-014",
   "rows": [],
   "cat": "official",
   "grade": null,
   "name": "國營昭和紀念公園｜訪客資訊官方頁面",
   "operator": "國營昭和記念公園官方網站",
   "links": [
    {
     "role": "頁面",
     "url": "https://www.showakinen-koen.jp/"
    },
    {
     "role": "頁面",
     "url": "https://www.showakinen-koen.jp/park-information/schedule/"
    },
    {
     "role": "頁面",
     "url": "https://www.showakinen-koen.jp/park-information/price/"
    },
    {
     "role": "頁面",
     "url": "https://www.showakinen-koen.jp/access/"
    },
    {
     "role": "頁面",
     "url": "https://www.showakinen-koen.jp/park-information/park-rules/"
    }
   ],
   "checked": [
    "2026-10-02"
   ],
   "supports": "觀測卡「官方資訊摘錄」的所在地、交通、開放時間、休園日、費用、電話、官方活動日期。與資料表該列的官方網址一起使用。",
   "caveat": null,
   "places": [
    "TKG-014"
   ],
   "origin": "snapshot"
  },
  {
   "key": "SF-TKG-015",
   "rows": [],
   "cat": "official",
   "grade": null,
   "name": "新宿御苑｜訪客資訊官方頁面",
   "operator": "一般財團法人國民公園協會 新宿御苑／環境省",
   "links": [
    {
     "role": "頁面",
     "url": "https://fng.or.jp/shinjuku/guide/"
    },
    {
     "role": "頁面",
     "url": "https://fng.or.jp/shinjuku/access/"
    },
    {
     "role": "頁面",
     "url": "https://fng.or.jp/shinjuku/2026/09/30/20260930-01/"
    },
    {
     "role": "頁面",
     "url": "https://fng.or.jp/shinjuku/2026/10/01/20261001-01/"
    },
    {
     "role": "頁面",
     "url": "https://fng.or.jp/shinjuku/2026/09/25/20260925-03/"
    },
    {
     "role": "頁面",
     "url": "https://fng.or.jp/shinjuku/place/season"
    },
    {
     "role": "頁面",
     "url": "https://policies.env.go.jp/national-garden/shinjukugyoen/guide/rule/"
    }
   ],
   "checked": [
    "2026-10-02"
   ],
   "supports": "觀測卡「官方資訊摘錄」的所在地、交通、開放時間、休園日、費用、電話、官方活動日期。與資料表該列的官方網址一起使用。",
   "caveat": null,
   "places": [
    "TKG-015"
   ],
   "origin": "snapshot"
  },
  {
   "key": "SF-TKG-016",
   "rows": [],
   "cat": "official",
   "grade": null,
   "name": "甲州街道銀杏並木（八王子）｜訪客資訊官方頁面",
   "operator": "八王子いちょう祭り祭典委員會",
   "links": [
    {
     "role": "頁面",
     "url": "https://www.ichou-festa.org/about"
    },
    {
     "role": "頁面",
     "url": "https://www.ichou-festa.org/faq"
    }
   ],
   "checked": [
    "2026-10-02"
   ],
   "supports": "觀測卡「官方資訊摘錄」的所在地、交通、いちょう祭り的時間、電話、官方活動日期（並木本身的時間限制、休園日、費用：官方頁面未載明，見觀測卡）。與資料表該列的官方網址一起使用。",
   "caveat": null,
   "places": [
    "TKG-016"
   ],
   "origin": "snapshot"
  },
  {
   "key": "SF-TKG-017",
   "rows": [],
   "cat": "official",
   "grade": null,
   "name": "皇居東御苑｜訪客資訊官方頁面",
   "operator": "宮內廳",
   "links": [
    {
     "role": "頁面",
     "url": "https://www.kunaicho.go.jp/visit/higashigyoen/pdf/koukaiyouryou.pdf"
    },
    {
     "role": "頁面",
     "url": "https://www.kunaicho.go.jp/visit/higashigyoen/gyoen-close.html"
    },
    {
     "role": "頁面",
     "url": "https://www.kunaicho.go.jp/visit/higashigyoen/info/"
    }
   ],
   "checked": [
    "2026-10-02"
   ],
   "supports": "觀測卡「官方資訊摘錄」的所在地、交通、開放時間、休園日、費用。與資料表該列的官方網址一起使用。",
   "caveat": null,
   "places": [
    "TKG-017"
   ],
   "origin": "snapshot"
  },
  {
   "key": "SF-TKG-018",
   "rows": [],
   "cat": "official",
   "grade": null,
   "name": "小石川植物園｜訪客資訊官方頁面",
   "operator": "東京大學大學院理學系研究科附屬植物園",
   "links": [
    {
     "role": "頁面",
     "url": "https://koishikawa-bg.jp/overview/guide/"
    },
    {
     "role": "頁面",
     "url": "https://koishikawa-bg.jp/access/"
    },
    {
     "role": "頁面",
     "url": "https://koishikawa-bg.jp/ennai/ginkgo/"
    },
    {
     "role": "頁面",
     "url": "https://koishikawa-bg.jp/"
    }
   ],
   "checked": [
    "2026-10-02"
   ],
   "supports": "觀測卡「官方資訊摘錄」的所在地、交通、開放時間、休園日、費用。與資料表該列的官方網址一起使用。",
   "caveat": null,
   "places": [
    "TKG-018"
   ],
   "origin": "snapshot"
  },
  {
   "key": "SF-TKG-019",
   "rows": [],
   "cat": "official",
   "grade": null,
   "name": "廣德寺（秋留野市）｜訪客資訊官方頁面",
   "operator": "あきる野市／あきる野市觀光協會",
   "links": [
    {
     "role": "頁面",
     "url": "https://www.city.akiruno.tokyo.jp/0000001442.html"
    },
    {
     "role": "頁面",
     "url": "https://www.akirunokanko.com/?p=8731"
    }
   ],
   "checked": [
    "2026-10-02"
   ],
   "supports": "觀測卡「官方資訊摘錄」的所在地、交通、電話（開放時間、休園日、費用：官方頁面未載明，見觀測卡）。與資料表該列的官方網址一起使用。",
   "caveat": null,
   "places": [
    "TKG-019"
   ],
   "origin": "snapshot"
  },
  {
   "key": "SF-TKG-023",
   "rows": [],
   "cat": "official",
   "grade": null,
   "name": "明治神宮外苑 銀杏並木｜訪客資訊官方頁面",
   "operator": "明治神宮外苑",
   "links": [
    {
     "role": "頁面",
     "url": "https://www.meijijingugaien.jp/walk/sight/"
    },
    {
     "role": "頁面",
     "url": "https://www.meijijingugaien.jp/information/access-map.html"
    },
    {
     "role": "頁面",
     "url": "https://www.meijijingugaien.jp/"
    }
   ],
   "checked": [
    "2026-10-02"
   ],
   "supports": "觀測卡「官方資訊摘錄」的所在地、交通、電話（開放時間、休園日、費用：官方頁面未載明，見觀測卡）。與資料表該列的官方網址一起使用。",
   "caveat": null,
   "places": [
    "TKG-023"
   ],
   "origin": "snapshot"
  },
  {
   "key": "SF-TKG-025",
   "rows": [],
   "cat": "official",
   "grade": null,
   "name": "大國魂神社｜訪客資訊官方頁面",
   "operator": "大國魂神社",
   "links": [
    {
     "role": "頁面",
     "url": "https://www.ookunitamajinja.or.jp/access/"
    }
   ],
   "checked": [
    "2026-10-02"
   ],
   "supports": "觀測卡「官方資訊摘錄」的所在地、交通、開放時間、電話（休園日、費用：官方頁面未載明，見觀測卡）。與資料表該列的官方網址一起使用。",
   "caveat": null,
   "places": [
    "TKG-025"
   ],
   "origin": "snapshot"
  },
  {
   "key": "SF-TKG-026",
   "rows": [],
   "cat": "official",
   "grade": null,
   "name": "靖國神社｜訪客資訊官方頁面",
   "operator": "靖國神社",
   "links": [
    {
     "role": "頁面",
     "url": "https://www.yasukuni.or.jp/access.html"
    },
    {
     "role": "頁面",
     "url": "https://www.yasukuni.or.jp/hope.html"
    },
    {
     "role": "頁面",
     "url": "https://www.yasukuni.or.jp/150th/project03.html"
    }
   ],
   "checked": [
    "2026-10-02"
   ],
   "supports": "觀測卡「官方資訊摘錄」的所在地、交通、開放時間、電話（休園日、費用：官方頁面未載明，見觀測卡）。與資料表該列的官方網址一起使用。",
   "caveat": null,
   "places": [
    "TKG-026"
   ],
   "origin": "snapshot"
  },
  {
   "key": "SF-TKG-030",
   "rows": [],
   "cat": "official",
   "grade": null,
   "name": "北之丸公園｜訪客資訊官方頁面",
   "operator": "一般財團法人國民公園協會 皇居外苑／環境省",
   "links": [
    {
     "role": "頁面",
     "url": "https://fng.or.jp/koukyo/access/"
    },
    {
     "role": "頁面",
     "url": "https://www.env.go.jp/garden/kokyogaien/2_guide/kitanomarukoen_00001.html"
    },
    {
     "role": "頁面",
     "url": "https://www.env.go.jp/garden/kokyogaien/news/2017/03/post_220_00002.html"
    },
    {
     "role": "頁面",
     "url": "https://www.env.go.jp/garden/kokyogaien/news/autumn_leaves/index_4.html"
    }
   ],
   "checked": [
    "2026-10-02"
   ],
   "supports": "觀測卡「官方資訊摘錄」的所在地、交通、開放時間、休園日、費用、電話。與資料表該列的官方網址一起使用。",
   "caveat": null,
   "places": [
    "TKG-030"
   ],
   "origin": "snapshot"
  },
  {
   "key": "SF-TKG-040",
   "rows": [],
   "cat": "official",
   "grade": null,
   "name": "東京大學 本鄉・駒場校區｜訪客資訊官方頁面",
   "operator": "東京大學",
   "links": [
    {
     "role": "頁面",
     "url": "https://www.u-tokyo.ac.jp/ja/about/campus-guide/public02_05.html"
    },
    {
     "role": "頁面",
     "url": "https://www.u-tokyo.ac.jp/ja/about/campus-guide/map01_02.html"
    },
    {
     "role": "頁面",
     "url": "https://www.u-tokyo.ac.jp/ja/about/campus-guide/map02_02.html"
    },
    {
     "role": "頁面",
     "url": "https://www.u-tokyo.ac.jp/ja/about/campus-guide/list.html"
    }
   ],
   "checked": [
    "2026-10-02"
   ],
   "supports": "兩張觀測卡「官方資訊摘錄」的所在地與交通（本鄉：文京区本郷7-3-1；駒場：目黒区駒場3-8-1），以及休園日（入構限制）與電話；本鄉另有開放時間（見學時間與各門開閉）。駒場的開放時間與兩校區的費用：官方頁面未載明，見觀測卡。與資料表該列的官方網址一起使用。",
   "caveat": null,
   "places": [
    "TKG-040-hongo",
    "TKG-040-komaba"
   ],
   "origin": "snapshot"
  },
  {
   "key": "SF-TKG-041",
   "rows": [],
   "cat": "official",
   "grade": null,
   "name": "國立 大學通｜訪客資訊官方頁面",
   "operator": "NPO法人國立市觀光まちづくり協會",
   "links": [
    {
     "role": "頁面",
     "url": "https://kunimachi.jp/access/"
    }
   ],
   "checked": [
    "2026-10-02"
   ],
   "supports": "觀測卡「官方資訊摘錄」的所在地、交通、電話（開放時間、休園日、費用：官方頁面未載明，見觀測卡）。與資料表該列的官方網址一起使用。",
   "caveat": null,
   "places": [
    "TKG-041"
   ],
   "origin": "snapshot"
  }
 ]
};
