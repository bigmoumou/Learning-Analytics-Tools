/* data.js — 東京銀杏黃葉地圖的資料（純 JS 變數，不用 fetch）
 * 資料快照：2026-10-02。來源為老師資料表（41 列來源索引）＋ 共用核實資料（座標、氣象廳平年值、官方頁面核對）。
 * 這個檔案只放資料與常數；畫面邏輯在 app.js。 */

/* 資料表與快照 */
const SITE_META = {
  "sheetUrl": "https://docs.google.com/spreadsheets/d/1dx_41InyuuWuILc4ZHJW8tTZMVOCpIuSz-QzISzd7y0/edit#gid=164385659",
  "snapshotDate": "2026-10-02",
  "rowCount": 41
};

/* 季節模型：東京基準（氣象廳東京いちょう黄葉日・落葉日 平年值，1991–2020） */
const JMA_BASE = {
  "station": "東京",
  "period": "1991–2020",
  "yellowNormal": {
    "month": 11,
    "day": 23
  },
  "fallNormal": {
    "month": 12,
    "day": 3
  },
  "yellowUrl": "https://www.data.jma.go.jp/sakura/data/phn_012.html",
  "fallUrl": "https://www.data.jma.go.jp/sakura/data/phn_013.html",
  "csvIndexUrl": "https://www.data.jma.go.jp/sakura/data/download_ruinenchi.html",
  "recentYellow": [
    {
      "year": 2023,
      "date": "12/1"
    },
    {
      "year": 2024,
      "date": "12/3"
    },
    {
      "year": 2025,
      "date": "11/22"
    }
  ],
  "observed2026": null
};

/* 各階段起日相對「見頃起日 D（= 黄葉日平年值 11/23）」的偏移天數（示意參數）。
 * 見頃 = D（氣象廳黄葉平年值），落葉 = D+10（= 12/3，氣象廳落葉平年值），其餘為示意參數。 */
const STAGE_OFFSETS = { iroduki: -28, shinko: -14, mikoro: 0, rakuyouHajime: 6, rakuyou: 10 };

/* 六階段：固定顏色（地圖標記、圖例、徽章三處共用） */
const STAGES = [
  { key: 'aoba',          ja: '青葉',       zh: '綠葉期',   startOffset: null,                         color: '#3d7a4b', ink: '#ffffff', desc: '葉片仍以綠色為主。' },
  { key: 'iroduki',       ja: '色づき始め', zh: '開始轉黃', startOffset: STAGE_OFFSETS.iroduki,       color: '#9db546', ink: '#1a1712', desc: '綠中帶黃，葉緣開始轉色。' },
  { key: 'shinko',        ja: '黄葉進行',   zh: '黃葉進行', startOffset: STAGE_OFFSETS.shinko,        color: '#efd77c', ink: '#1a1712', desc: '黃色比例一天天增加。' },
  { key: 'mikoro',        ja: '見頃',       zh: '最佳觀賞', startOffset: STAGE_OFFSETS.mikoro,        color: '#e2a81c', ink: '#1a1712', desc: '整體轉為金黃，最適合觀賞。' },
  { key: 'rakuyouHajime', ja: '落葉始め',   zh: '開始落葉', startOffset: STAGE_OFFSETS.rakuyouHajime, color: '#c8793a', ink: '#1a1712', desc: '黃葉開始飄落，地面鋪上一層金黃。' },
  { key: 'rakuyou',       ja: '落葉',       zh: '落葉期',   startOffset: STAGE_OFFSETS.rakuyou,       color: '#7a5233', ink: '#ffffff', desc: '大部分葉片已落（氣象廳落葉日的定義約為 80%）。' },
];

/* 日期滑桿範圍（採當年） */
const SLIDER_RANGE = { start: { month: 10, day: 15 }, end: { month: 12, day: 31 } };

/* 步行速度（每分鐘公尺） */
const WALK_M_PER_MIN = 80;
const ROUTE_MIN = 2;
const ROUTE_MAX = 5;

/* 區域分組（由資料表 area 欄整理） */
const AREA_GROUPS = [
  { key: 'center', label: '都心', sub: '千代田・港' },
  { key: 'east',   label: '下町・文京', sub: '台東・文京・江東' },
  { key: 'west',   label: '山手・西郊', sub: '新宿・澀谷・目黑・杉並・練馬・板橋' },
  { key: 'tama',   label: '多摩地區', sub: '小金井・立川・八王子・府中・國立・秋留野' },
];

/* 來源等級（資料表 grade） */
const GRADE_INFO = {
  S: '園區管理協會官方',
  A: '官方附日期的現地觀察',
  B: '官方來源，銀杏資料待補',
  C: '官方網站或入口，無日期觀測',
  O: '氣象廳觀測站尺度',
  T: '第三方整合平台',
  X: '排除或失效來源',
};
/* 篩選列下方的等級簡稱（與 GRADE_INFO 同義的短版） */
const GRADE_SHORT = { S: '公園協會', A: '官方實地觀察', B: '銀杏資料待補', C: '官方入口' };

/* 景點：資料表中已證實有銀杏的單一地點（座標來自共用座標檔，均為近似值） */
const SPOTS = [
  {
    "id": "TKG-002",
    "row": "TKG-002",
    "nameJa": "上野恩賜公園",
    "sheetName": "上野恩賜公園",
    "area": "台東區",
    "group": "east",
    "grade": "S",
    "operator": "公益財團法人東京都公園協會",
    "finding": "2025年度官方紅葉情報名單明列本園區之銀杏；本次不宣稱已取得2026銀杏現況。",
    "evidenceDate": "2025-11-04",
    "cadence": "中央整合頁2025季內每週兩次；園區個別公告頻率未承諾。",
    "caveat": "可列為銀杏專項季節觀測候選。",
    "url": "https://www.tokyo-park.or.jp/park/ueno/",
    "species": "銀杏",
    "lat": 35.713,
    "lng": 139.7724,
    "pointLabel": "公園中心（概略）",
    "parkLevel": true,
    "snapshot": "2026-10-02 核對官方頁面：尚未發布 2026 年銀杏葉況。",
    "pastNote": null,
    "subPoints": [],
    "proof": null
  },
  {
    "id": "TKG-003",
    "row": "TKG-003",
    "nameJa": "木場公園",
    "sheetName": "木場公園",
    "area": "江東區",
    "group": "east",
    "grade": "S",
    "operator": "公益財團法人東京都公園協會",
    "finding": "2025年度官方紅葉情報名單明列本園區之銀杏；本次不宣稱已取得2026銀杏現況。",
    "evidenceDate": "2025-11-04",
    "cadence": "中央整合頁2025季內每週兩次；園區個別公告頻率未承諾。",
    "caveat": "保留園區原文所指子地點。",
    "url": "https://www.tokyo-park.or.jp/park/kiba/",
    "species": "銀杏",
    "lat": 35.6752,
    "lng": 139.8085,
    "pointLabel": "公園中心（概略）",
    "parkLevel": true,
    "snapshot": "2026-10-02 核對官方頁面：尚未發布 2026 年銀杏葉況；官方園區頁沒有指名銀杏子地點，所以地圖只標公園中心。",
    "pastNote": null,
    "subPoints": [],
    "proof": null
  },
  {
    "id": "TKG-004",
    "row": "TKG-004",
    "nameJa": "小金井公園",
    "sheetName": "小金井公園",
    "area": "小金井市等",
    "group": "tama",
    "grade": "S",
    "operator": "公益財團法人東京都公園協會",
    "finding": "2025年度官方紅葉情報名單明列本園區之銀杏；本次不宣稱已取得2026銀杏現況。",
    "evidenceDate": "2025-11-04",
    "cadence": "中央整合頁2025季內每週兩次；園區個別公告頻率未承諾。",
    "caveat": "園區跨行政區；不以服務中心地址代表全部觀測點。",
    "url": "https://www.tokyo-park.or.jp/park/koganei/",
    "species": "銀杏",
    "lat": 35.7155,
    "lng": 139.5189,
    "pointLabel": "公園中心（概略）",
    "parkLevel": true,
    "snapshot": "2026-10-02 核對官方頁面：尚未發布 2026 年銀杏葉況。",
    "pastNote": null,
    "subPoints": [],
    "proof": null
  },
  {
    "id": "TKG-005",
    "row": "TKG-005",
    "nameJa": "芝公園",
    "sheetName": "芝公園",
    "area": "港區",
    "group": "center",
    "grade": "S",
    "operator": "公益財團法人東京都公園協會",
    "finding": "2025年度官方紅葉情報名單明列本園區之銀杏；本次不宣稱已取得2026銀杏現況。",
    "evidenceDate": "2025-11-04",
    "cadence": "中央整合頁2025季內每週兩次；園區個別公告頻率未承諾。",
    "caveat": "銀杏與もみじ谷分開。正確網址使用siba，不是shiba。",
    "url": "https://www.tokyo-park.or.jp/park/siba/",
    "species": "楓樹、銀杏",
    "lat": 35.6555,
    "lng": 139.748,
    "pointLabel": "公園中心（概略；銀杏位置未核實）",
    "parkLevel": true,
    "snapshot": "2026-10-02 核對官方頁面：尚未發布 2026 年銀杏葉況。",
    "pastNote": null,
    "subPoints": [
      {
        "name": "もみじ谷",
        "note": "楓樹區，不是銀杏，本站不列為銀杏點。"
      }
    ],
    "proof": null
  },
  {
    "id": "TKG-006",
    "row": "TKG-006",
    "nameJa": "城北中央公園",
    "sheetName": "城北中央公園",
    "area": "板橋區、練馬區",
    "group": "west",
    "grade": "S",
    "operator": "公益財團法人東京都公園協會",
    "finding": "2025年度官方紅葉情報名單明列本園區之銀杏；本次不宣稱已取得2026銀杏現況。",
    "evidenceDate": "2025-11-04",
    "cadence": "中央整合頁2025季內每週兩次；園區個別公告頻率未承諾。",
    "caveat": "必須按物種取值，不把櫸樹葉況套用銀杏。",
    "url": "https://www.tokyo-park.or.jp/park/johoku-chuo/",
    "species": "銀杏、櫸樹",
    "lat": 35.7564,
    "lng": 139.673,
    "pointLabel": "公園中心（概略）",
    "parkLevel": true,
    "snapshot": "2026-10-02 核對官方頁面：尚未發布 2026 年銀杏葉況。",
    "pastNote": null,
    "subPoints": [],
    "proof": null
  },
  {
    "id": "TKG-007",
    "row": "TKG-007",
    "nameJa": "善福寺川緑地",
    "sheetName": "善福寺川緑地",
    "area": "杉並區",
    "group": "west",
    "grade": "S",
    "operator": "公益財團法人東京都公園協會",
    "finding": "2025年度官方紅葉情報名單明列本園區之銀杏；本次不宣稱已取得2026銀杏現況。",
    "evidenceDate": "2025-11-04",
    "cadence": "中央整合頁2025季內每週兩次；園區個別公告頻率未承諾。",
    "caveat": "2025表與和田堀公園合併一列，不能假設各有獨立觀測。",
    "url": "https://www.tokyo-park.or.jp/park/zempukujigawa-ryokuchi/index.html",
    "species": "銀杏",
    "lat": 35.692,
    "lng": 139.6305,
    "pointLabel": "公園中心（概略；沿河線狀公園）",
    "parkLevel": true,
    "snapshot": "2026-10-02 核對官方頁面：尚未發布 2026 年銀杏葉況。",
    "pastNote": null,
    "subPoints": [
      {
        "name": "與和田堀公園同一來源",
        "note": "2025 名單兩園合併一列，不假設各有獨立觀測。"
      }
    ],
    "proof": null
  },
  {
    "id": "TKG-008",
    "row": "TKG-008",
    "nameJa": "和田堀公園",
    "sheetName": "和田堀公園",
    "area": "杉並區",
    "group": "west",
    "grade": "S",
    "operator": "公益財團法人東京都公園協會",
    "finding": "2025年度官方紅葉情報名單明列本園區之銀杏；本次不宣稱已取得2026銀杏現況。",
    "evidenceDate": "2025-11-04",
    "cadence": "中央整合頁2025季內每週兩次；園區個別公告頻率未承諾。",
    "caveat": "2025表與善福寺川緑地合併一列，保留共同來源關係。",
    "url": "https://www.tokyo-park.or.jp/park/wadabori/",
    "species": "銀杏",
    "lat": 35.6855,
    "lng": 139.6395,
    "pointLabel": "公園中心（概略）",
    "parkLevel": true,
    "snapshot": "2026-10-02 核對官方頁面：尚未發布 2026 年銀杏葉況。",
    "pastNote": null,
    "subPoints": [
      {
        "name": "大宮八幡宮「神門の夫婦銀杏」",
        "note": "和田堀公園官方頁提到的鄰接神社銀杏；僅文字說明，不另標點。"
      },
      {
        "name": "與善福寺川緑地同一來源",
        "note": "2025 名單兩園合併一列。"
      }
    ],
    "proof": null
  },
  {
    "id": "TKG-009",
    "row": "TKG-009",
    "nameJa": "戸山公園",
    "sheetName": "戸山公園",
    "area": "新宿區",
    "group": "west",
    "grade": "S",
    "operator": "公益財團法人東京都公園協會",
    "finding": "2025年度官方紅葉情報名單明列本園區之銀杏；本次不宣稱已取得2026銀杏現況。",
    "evidenceDate": "2025-11-04",
    "cadence": "中央整合頁2025季內每週兩次；園區個別公告頻率未承諾。",
    "caveat": "須擷取銀杏段落／欄位，不直接使用全園紅葉狀態。",
    "url": "https://www.tokyo-park.or.jp/park/toyama/",
    "species": "楓樹、銀杏",
    "lat": 35.7037,
    "lng": 139.7135,
    "pointLabel": "戸山（箱根山）地区（概略）",
    "parkLevel": true,
    "snapshot": "2026-10-02 核對官方頁面：尚未發布 2026 年銀杏葉況。",
    "pastNote": null,
    "subPoints": [],
    "proof": null
  },
  {
    "id": "TKG-010",
    "row": "TKG-010",
    "nameJa": "光が丘公園",
    "sheetName": "光が丘公園",
    "area": "練馬區、板橋區",
    "group": "west",
    "grade": "S",
    "operator": "公益財團法人東京都公園協會",
    "finding": "2025年度官方紅葉情報名單明列本園區之銀杏；本次不宣稱已取得2026銀杏現況。",
    "evidenceDate": "2025-11-04",
    "cadence": "中央整合頁2025季內每週兩次；園區個別公告頻率未承諾。",
    "caveat": "銀杏並木與ふれあいの径宜設為不同子地點。",
    "url": "https://www.tokyo-park.or.jp/park/hikarigaoka/",
    "species": "銀杏",
    "lat": 35.7648,
    "lng": 139.6295,
    "pointLabel": "観賞池與売店之間（概略）",
    "parkLevel": false,
    "snapshot": "2026-10-02 核對官方頁面：尚未發布 2026 年銀杏葉況。",
    "pastNote": null,
    "subPoints": [
      {
        "name": "いちょう並木",
        "note": "地圖標示點（観賞池與売店之間，概略）。",
        "mapped": true
      },
      {
        "name": "ふれあいの径",
        "note": "另一個銀杏子地點；座標未核實，僅文字列出。"
      }
    ],
    "proof": null
  },
  {
    "id": "TKG-011",
    "row": "TKG-011",
    "nameJa": "日比谷公園",
    "sheetName": "日比谷公園",
    "area": "千代田區",
    "group": "center",
    "grade": "S",
    "operator": "公益財團法人東京都公園協會",
    "finding": "2025年度官方紅葉情報名單明列本園區之銀杏；本次不宣稱已取得2026銀杏現況。",
    "evidenceDate": "2025-11-04",
    "cadence": "中央整合頁2025季內每週兩次；園區個別公告頻率未承諾。",
    "caveat": "葉況與施工、通行公告分開管理。",
    "url": "https://www.tokyo-park.or.jp/park/hibiya/",
    "species": "銀杏",
    "lat": 35.6737,
    "lng": 139.7559,
    "pointLabel": "首賭けイチョウ（松本楼付近・概略）",
    "parkLevel": false,
    "snapshot": "2026-10-02 核對官方頁面：尚未發布 2026 年銀杏葉況。",
    "pastNote": null,
    "subPoints": [
      {
        "name": "首賭けイチョウ",
        "note": "地圖標示點（松本楼附近，概略）。",
        "mapped": true
      }
    ],
    "proof": null
  },
  {
    "id": "TKG-012",
    "row": "TKG-012",
    "nameJa": "代々木公園",
    "sheetName": "代々木公園",
    "area": "澀谷區",
    "group": "west",
    "grade": "S",
    "operator": "公益財團法人東京都公園協會",
    "finding": "2025年度官方紅葉情報名單明列本園區之銀杏；本次不宣稱已取得2026銀杏現況。",
    "evidenceDate": "2025-11-04",
    "cadence": "中央整合頁2025季內每週兩次；園區個別公告頻率未承諾。",
    "caveat": "黃葉公告須限定原文明示區域，不擴張為全園。",
    "url": "https://www.tokyo-park.or.jp/park/yoyogi/",
    "species": "銀杏",
    "lat": 35.6717,
    "lng": 139.6965,
    "pointLabel": "公園中心（概略）",
    "parkLevel": true,
    "snapshot": "2026-10-02 核對官方頁面：尚未發布 2026 年銀杏葉況。",
    "pastNote": null,
    "subPoints": [],
    "proof": null
  },
  {
    "id": "TKG-013",
    "row": "TKG-013",
    "nameJa": "旧岩崎邸庭園",
    "sheetName": "旧岩崎邸庭園",
    "area": "台東區（入口）",
    "group": "east",
    "grade": "S",
    "operator": "公益財團法人東京都公園協會",
    "finding": "2025年度官方紅葉情報名單明列本園區之銀杏；本次不宣稱已取得2026銀杏現況。",
    "evidenceDate": "2025-11-04",
    "cadence": "中央整合頁2025季內每週兩次；園區個別公告頻率未承諾。",
    "caveat": "活動或集章日期不是見頃日；注意官網改版後網址。",
    "url": "https://www.tokyo-park.or.jp/park/kyu-iwasaki-tei/",
    "species": "銀杏",
    "lat": 35.7092,
    "lng": 139.7683,
    "pointLabel": "庭園正門（入口）",
    "parkLevel": false,
    "snapshot": "2026-10-02 核對官方頁面：尚未發布 2026 年銀杏葉況。",
    "pastNote": null,
    "subPoints": [],
    "proof": null
  },
  {
    "id": "TKG-014",
    "row": "TKG-014",
    "nameJa": "国営昭和記念公園",
    "sheetName": "國營昭和記念公園｜花だより",
    "area": "立川市、昭島市",
    "group": "tama",
    "grade": "A",
    "operator": "國營昭和記念公園官方網站",
    "finding": "歷史列表有連續多期イチョウ情報；植物指南明列イチョウ（黄葉）。",
    "evidenceDate": "2025-10-23至2025-12-04",
    "cadence": "歷史季內約每週一篇；並非官網保證的更新頻率。",
    "caveat": "カナール、かたらいのイチョウ並木分開；page/3分頁位置會隨新增文章變動，不可當永久存檔ID。",
    "url": "https://www.showakinen-koen.jp/hanadayori/",
    "species": "銀杏",
    "lat": 35.7028,
    "lng": 139.4022,
    "pointLabel": "カナール（銀杏並木沿水路）",
    "parkLevel": false,
    "snapshot": "2026-10-02 核對官方頁面：尚未發布 2026 年銀杏葉況。",
    "pastNote": "證據為 2025 年季內的日期紀錄，只代表當時，不是 2026 年現況。",
    "subPoints": [
      {
        "name": "カナールイチョウ並木",
        "note": "地圖標示點（沿水路的銀杏並木）。",
        "mapped": true
      },
      {
        "name": "かたらいのイチョウ並木",
        "note": "位置未核實（誤差可達 ±400 m），只列在清單，不上地圖，也不可加入路線。"
      }
    ],
    "proof": null
  },
  {
    "id": "TKG-015",
    "row": "TKG-015",
    "nameJa": "新宿御苑",
    "sheetName": "新宿御苑｜國民公園協會自然情報",
    "area": "新宿區、澀谷區",
    "group": "west",
    "grade": "A",
    "operator": "一般財團法人國民公園協會 新宿御苑",
    "finding": "日期文章明確敘述銀杏黃葉見頃，包含溫室附近照片及園內植物地圖。",
    "evidenceDate": "2025-11-28",
    "cadence": "已見每週みどころ及其他不定期文章；不是保證頻率。",
    "caveat": "舊文只當歷史樣本。環境省管理資訊與協會自然情報各有用途；不可混入同期其他樹種狀態。",
    "url": "https://fng.or.jp/shinjuku/news/",
    "species": "銀杏",
    "lat": 35.6867,
    "lng": 139.7126,
    "pointLabel": "大温室（銀杏拍攝熱點）",
    "parkLevel": false,
    "snapshot": "2026-10-02 核對官方頁面：尚未發布 2026 年銀杏葉況。",
    "pastNote": "證據為 2025 年季內的日期紀錄，只代表當時，不是 2026 年現況。",
    "subPoints": [
      {
        "name": "大温室附近",
        "note": "地圖標示點；2025-11-28 官方文章的拍攝熱點，銀杏在溫室附近而非溫室內。",
        "mapped": true
      }
    ],
    "proof": null
  },
  {
    "id": "TKG-016",
    "row": "TKG-016",
    "nameJa": "八王子 甲州街道いちょう並木",
    "sheetName": "八王子いちょう祭り｜黄葉情報",
    "area": "八王子市・甲州街道",
    "group": "tama",
    "grade": "A",
    "operator": "八王子いちょう祭り祭典委員會",
    "finding": "黄葉情報頁可見2026-09-22拍攝日期，分中央圖書館、多摩御陵入口及觀看方向。",
    "evidenceDate": "2026-09-24（更新公告）",
    "cadence": "官方明示不定期更新。",
    "caveat": "已確認2026季內內容，但不能只看照片日期就自動判定見頃。祭典日期與葉況分離。",
    "url": "https://www.ichou-festa.org/ichounews/",
    "species": "銀杏",
    "lat": 35.652,
    "lng": 139.3004,
    "pointLabel": "並木代表點（全長約4 km的中段）",
    "parkLevel": false,
    "snapshot": "2026-10-02 核對官方頁面：黃葉情報有 2026-09-22 拍攝的照片（中央図書館、多摩御陵入口），文字未寫階段。",
    "pastNote": null,
    "subPoints": [
      {
        "name": "甲州街道いちょう並木",
        "note": "地圖標示點為全長約 4 km 並木的中段代表點。",
        "mapped": true
      },
      {
        "name": "官方攝影點",
        "note": "八王子市中央図書館、多摩御陵入口交差点。"
      }
    ],
    "proof": null
  },
  {
    "id": "TKG-017",
    "row": "TKG-017",
    "nameJa": "皇居東御苑",
    "sheetName": "宮內廳｜皇居東御苑 花だより",
    "area": "千代田區・皇居東御苑",
    "group": "center",
    "grade": "A",
    "operator": "宮內廳",
    "finding": "日期文記錄銀杏等樹木變色，照片標示百人番所前のイチョウ。",
    "evidenceDate": "2025-11-28",
    "cadence": "列表可見近每週更新；未將其視為保證頻率。",
    "caveat": "東御苑不是皇居外苑或北之丸公園。全園葉落描述不可自動套用銀杏。",
    "url": "https://www.kunaicho.go.jp/visit/higashigyoen/hanadayori/index.html",
    "species": "銀杏",
    "lat": 35.6857,
    "lng": 139.7581,
    "pointLabel": "百人番所（前のイチョウ）",
    "parkLevel": false,
    "snapshot": "2026-10-02 核對官方頁面：尚未發布 2026 年銀杏葉況。",
    "pastNote": "證據為 2025 年季內的日期紀錄，只代表當時，不是 2026 年現況。",
    "subPoints": [
      {
        "name": "百人番所前のイチョウ",
        "note": "地圖標示點（2025-11-28 官方照片標示）。",
        "mapped": true
      }
    ],
    "proof": null
  },
  {
    "id": "TKG-018",
    "row": "TKG-018",
    "nameJa": "小石川植物園",
    "sheetName": "小石川植物園｜見ごろの植物",
    "area": "文京區",
    "group": "east",
    "grade": "A",
    "operator": "東京大學大學院理學系研究科附屬植物園",
    "finding": "當日文章將イチョウ明列於正在紅葉／黃葉的植物清單。",
    "evidenceDate": "2025-11-19",
    "cadence": "不定期，已有多篇日期文章。",
    "caveat": "見到黃葉不等於已到見頃。小石川植物園與小石川後樂園是不同地點。",
    "url": "https://koishikawa-bg.jp/kaikainfo/",
    "species": "銀杏",
    "lat": 35.7202,
    "lng": 139.7452,
    "pointLabel": "精子発見のイチョウ（補充副點）",
    "parkLevel": false,
    "snapshot": "2026-10-02 核對官方頁面：尚未發布 2026 年銀杏葉況。",
    "pastNote": "證據為 2025 年季內的日期紀錄，只代表當時，不是 2026 年現況。",
    "subPoints": [
      {
        "name": "精子発見のイチョウ",
        "note": "地圖標示點（園內著名銀杏，概略）。",
        "mapped": true
      }
    ],
    "proof": null
  },
  {
    "id": "TKG-019",
    "row": "TKG-019",
    "nameJa": "広徳寺（あきる野）",
    "sheetName": "あきる野市觀光協會｜のらぼう日記",
    "area": "秋留野市・廣德寺周邊",
    "group": "tama",
    "grade": "A",
    "operator": "あきる野市觀光協會",
    "finding": "廣德寺段落明寫銀杏變色進展、尚差一些到見頃；原文另給照片拍攝日期。",
    "evidenceDate": "2025-11-08（發文）；2025-11-06（拍照）",
    "cadence": "原文說隨時更新；2025季內有多期，非固定每週承諾。",
    "caveat": "石舟橋段落是楓樹，不能套用到廣德寺銀杏。發文日與拍摄日分開。",
    "url": "https://www.akirunokanko.com/?cat=53",
    "species": "銀杏",
    "lat": 35.7218,
    "lng": 139.2174,
    "pointLabel": "廣徳寺寺院位置",
    "parkLevel": false,
    "snapshot": "2026-10-02 核對官方頁面：尚未發布 2026 年銀杏葉況。",
    "pastNote": "證據為 2025 年季內的日期紀錄，只代表當時，不是 2026 年現況。",
    "subPoints": [
      {
        "name": "広徳寺のイチョウ",
        "note": "地圖標示點為寺院位置；銀杏在寺內。",
        "mapped": true
      }
    ],
    "proof": null
  },
  {
    "id": "TKG-023",
    "row": "TKG-023",
    "nameJa": "明治神宮外苑 いちょう並木",
    "sheetName": "明治神宮外苑｜いちょう並木",
    "area": "明治神宮外苑・銀杏並木",
    "group": "center",
    "grade": "C",
    "operator": "明治神宮外苑",
    "finding": "官網明確介紹銀杏並木與四季景觀；本次未確認穩定的逐日銀杏葉況專頁。",
    "evidenceDate": "未見可當現況的日期",
    "cadence": "未確認。",
    "caveat": "不是明治神宮內苑。頁內老樹齡／株數含歷史基準，勿當2026現況。",
    "url": "https://www.meijijingugaien.jp/walk/sight/season.html",
    "species": "銀杏",
    "lat": 35.6739,
    "lng": 139.7199,
    "pointLabel": "並木中點",
    "parkLevel": false,
    "snapshot": "2026-10-02 核對官方頁面：尚未發布 2026 年銀杏葉況。",
    "pastNote": "過去紀錄（舊紀錄，非今年現況）：",
    "pastRecords": [
      {
        "date": "2022-11-17",
        "source": "官方外苑便り",
        "quote": "イチョウ並木が見頃です",
        "url": "https://www.meijijingugaien.jp/gaien-news/2022/111734.html"
      }
    ],
    "subPoints": [],
    "proof": null
  },
  {
    "id": "TKG-024",
    "row": "TKG-024",
    "nameJa": "大田黒公園",
    "sheetName": "大田黑公園｜荻窪三庭園",
    "area": "杉並區",
    "group": "west",
    "grade": "B",
    "operator": "杉並區官方指向之公園網站（荻窪三庭園）",
    "finding": "杉並區官網證明銀杏並木及現行官方網址；本次自動讀取公園頁未取得正文。",
    "evidenceDate": "區公所頁更新2025-09-09",
    "cadence": "尚未確認黃葉更新頻率。",
    "caveat": "不得沿用已於2024年3月結束管理的箱根植木舊頁作現任營運來源。",
    "url": "https://ogikubo3gardens.jp/ootaguro/",
    "species": "銀杏",
    "lat": 35.7007,
    "lng": 139.6248,
    "pointLabel": "公園位置",
    "parkLevel": false,
    "snapshot": "2026-10-02 核對官方頁面：尚未發布 2026 年銀杏葉況。",
    "pastNote": null,
    "subPoints": [],
    "proof": null
  },
  {
    "id": "TKG-025",
    "row": "TKG-025",
    "nameJa": "大國魂神社",
    "sheetName": "大國魂神社｜大銀杏／公告",
    "area": "府中市",
    "group": "tama",
    "grade": "C",
    "operator": "大國魂神社",
    "finding": "神社官網確認本殿後方的大銀杏；未確認定期黃葉觀測文章。",
    "evidenceDate": "靜態資料",
    "cadence": "未確認。",
    "caveat": "不要把附近馬場大門的櫸樹並木視為銀杏。",
    "url": "https://www.ookunitamajinja.or.jp/mame/",
    "species": "銀杏",
    "lat": 35.6676,
    "lng": 139.479,
    "pointLabel": "本殿・拝殿一帯（大銀杏在本殿の裏）",
    "parkLevel": false,
    "snapshot": "2026-10-02 核對官方頁面：尚未發布 2026 年銀杏葉況。",
    "pastNote": null,
    "subPoints": [
      {
        "name": "大銀杏（本殿の裏）",
        "note": "地圖標示點為本殿一帶；馬場大門的櫸樹並木不是銀杏。",
        "mapped": true
      }
    ],
    "proof": null
  },
  {
    "id": "TKG-026",
    "row": "TKG-026",
    "nameJa": "靖國神社",
    "sheetName": "靖國神社｜官方公告、境內照片",
    "area": "千代田區",
    "group": "center",
    "grade": "C",
    "operator": "靖國神社",
    "finding": "官網和照片入口存在；本次未核得可直接當銀杏現況的日期觀測文章。",
    "evidenceDate": "本次可讀2026公告",
    "cadence": "未確認。",
    "caveat": "宣傳影片上線日不等於拍攝日。不可將未核視角的LIVE影片宣稱銀杏即時鏡頭。",
    "url": "https://www.yasukuni.or.jp/",
    "species": "銀杏專項現況待確認",
    "lat": 35.6941,
    "lng": 139.7431,
    "pointLabel": "境內主要區域（拝殿）",
    "parkLevel": false,
    "snapshot": "2026-10-02 核對官方頁面：尚未發布 2026 年銀杏葉況。",
    "pastNote": null,
    "subPoints": [],
    "proof": {
      "text": "參道的銀杏並木由官方網站另一頁證實：",
      "url": "https://www.yasukuni.or.jp/news_detail.html?id=492",
      "quote": "参道のイチョウ並木"
    }
  },
  {
    "id": "TKG-030",
    "row": "TKG-030",
    "nameJa": "北の丸公園",
    "sheetName": "皇居外苑・北之丸公園｜國民公園協會",
    "area": "千代田區",
    "group": "center",
    "grade": "B",
    "operator": "一般財團法人國民公園協會 皇居外苑",
    "finding": "有持續更新的自然／四季消息；本次未核得銀杏專项葉況。",
    "evidenceDate": "本次可見2026-09-19季節文章入口",
    "cadence": "不定期；銀杏頻率待查。",
    "caveat": "與宮內廳東御苑不同來源、不同地理範圍。",
    "url": "https://fng.or.jp/koukyo/news/",
    "species": "銀杏專項現況待確認",
    "lat": 35.6915,
    "lng": 139.7511,
    "pointLabel": "公園中心（概略）",
    "parkLevel": true,
    "snapshot": "2026-10-02 核對官方頁面：尚未發布 2026 年銀杏葉況。",
    "pastNote": "過去紀錄（舊紀錄，非今年現況）：",
    "pastRecords": [
      {
        "date": "2024-11-13",
        "source": "國民公園協會 皇居外苑",
        "quote": "園内のイチョウは色づき始めたばかり",
        "url": "https://fng.or.jp/koukyo/2024/11/13/irodukukitanomarukouen/"
      }
    ],
    "subPoints": [
      {
        "name": "日本武道館前の大イチョウ",
        "note": "官方文章提到的大銀杏。地圖標記是公園中心（概略），不是這棵樹的位置。",
        "mapped": false
      },
      {
        "name": "皇居外苑",
        "note": "同列中的皇居外苑未證實有銀杏專項地點，不列為景點、不上地圖。"
      }
    ],
    "proof": {
      "text": "北の丸公園的銀杏由國民公園協會同網站 2023-11-24 的文章證實：",
      "url": "https://fng.or.jp/koukyo/2023/11/24/kitanomarukouennnokouyou/",
      "quote": "日本武道館の前には大イチョウと呼ばれる特別大きなイチョウの木",
      "note": "同文寫大イチョウ「見ごろは12月上旬」，這是 2023 年紀錄，不是今年現況或預測。"
    }
  },
  {
    "id": "TKG-040-hongo",
    "row": "TKG-040",
    "nameJa": "東京大学 本郷キャンパス 銀杏並木",
    "sheetName": "東京大學｜本鄉・駒場校區官方入口",
    "area": "文京區、目黑區",
    "group": "east",
    "grade": "C",
    "operator": "東京大學",
    "finding": "確認本鄉及駒場的官方地圖／參觀入口；尚未確認穩定的銀杏日期觀測來源。",
    "evidenceDate": "2026-04-01（地圖頁）",
    "cadence": "銀杏更新頻率未確認。",
    "caveat": "本鄉、駒場、小石川植物園是不同地點。此頁未證實各校區的當季銀杏觀測。",
    "url": "https://www.u-tokyo.ac.jp/ja/about/campus-guide/index.html",
    "species": "銀杏專項現況待確認",
    "lat": 35.7131,
    "lng": 139.7606,
    "pointLabel": "並木中點",
    "parkLevel": false,
    "snapshot": "2026-10-02 核對官方頁面：尚未發布 2026 年銀杏葉況。",
    "pastNote": null,
    "subPoints": [
      {
        "name": "正門～安田講堂",
        "note": "地圖標示點為並木中點。駒場是另一個景點；小石川植物園也是不同地點。",
        "mapped": true
      }
    ],
    "proof": {
      "text": "本郷校區的銀杏並木由東京大學官方網站另一頁證實：",
      "url": "https://www.u-tokyo.ac.jp/ja/about/campus-guide/1km_of_campus.html",
      "quote": "本郷キャンパスの銀杏並木"
    }
  },
  {
    "id": "TKG-040-komaba",
    "row": "TKG-040",
    "nameJa": "東京大学 駒場キャンパス 銀杏並木",
    "sheetName": "東京大學｜本鄉・駒場校區官方入口",
    "area": "文京區、目黑區",
    "group": "west",
    "grade": "C",
    "operator": "東京大學",
    "finding": "確認本鄉及駒場的官方地圖／參觀入口；尚未確認穩定的銀杏日期觀測來源。",
    "evidenceDate": "2026-04-01（地圖頁）",
    "cadence": "銀杏更新頻率未確認。",
    "caveat": "本鄉、駒場、小石川植物園是不同地點。此頁未證實各校區的當季銀杏觀測。",
    "url": "https://www.u-tokyo.ac.jp/ja/about/campus-guide/index.html",
    "species": "銀杏專項現況待確認",
    "lat": 35.6604,
    "lng": 139.6852,
    "pointLabel": "並木中段（概略）",
    "parkLevel": false,
    "snapshot": "2026-10-02 核對官方頁面：尚未發布 2026 年銀杏葉況。",
    "pastNote": null,
    "subPoints": [
      {
        "name": "1号館北側的東西向道路",
        "note": "地圖標示點為並木中段（概略，約 ±80 m）。本郷是另一個景點。",
        "mapped": true
      }
    ],
    "proof": {
      "text": "駒場校區的銀杏並木由東京大學網站另一頁證實：",
      "url": "https://kimino.ct.u-tokyo.ac.jp/kotohajime/komaba-campus/",
      "quote": "秋には銀杏並木がメインストリートを黄色に染め上げる"
    }
  },
  {
    "id": "TKG-041",
    "row": "TKG-041",
    "nameJa": "国立 大学通り",
    "sheetName": "くにたちNAVI｜國立市觀光まちづくり協會",
    "area": "國立市・大學通り候選",
    "group": "tama",
    "grade": "C",
    "operator": "NPO法人國立市觀光まちづくり協會",
    "finding": "頁尾確認營運者為國立市觀光まちづくり協會；本次未確認定期銀杏葉況文章。",
    "evidenceDate": "本次可見2026-09-25更新",
    "cadence": "銀杏更新頻率未確認。",
    "caveat": "區域旅遊更新不等於大學通り銀杏現況；可與Jorudan地點目錄交叉尋源。",
    "url": "https://kunimachi.jp/",
    "species": "銀杏專項現況待確認",
    "lat": 35.6945,
    "lng": 139.4468,
    "pointLabel": "国立駅南側の並木（代表點）",
    "parkLevel": false,
    "snapshot": "2026-10-02 核對官方頁面：尚未發布 2026 年銀杏葉況。",
    "pastNote": null,
    "subPoints": [
      {
        "name": "国立駅南側的並木",
        "note": "地圖標示點為代表點；大學通也有櫻花樹，座標無法區分銀杏列與櫻花列。",
        "mapped": true
      }
    ],
    "proof": {
      "text": "大學通的銀杏由くにたちNAVI 官方景點頁證實：",
      "url": "https://kunimachi.jp/spot/daigakustreet/",
      "quote": "エレガントなイチョウの黄色で辺り一面が覆い尽くされます"
    }
  }
];

/* 只放「資料來源」區的列（入口網站、氣象廳、彙整網站、物種未證實、第三方、排除） */
const SOURCE_CATEGORIES = [
  {
    "key": "portal",
    "label": "入口網站與觀光彙整",
    "note": "沒有對應單一景點，或只是入口／彙整頁。"
  },
  {
    "key": "jma",
    "label": "氣象廳",
    "note": "觀測站（標本木）尺度，不是各公園的觀賞日；季節示意的基準來自這裡。"
  },
  {
    "key": "species",
    "label": "物種待補證",
    "note": "尚未證實有銀杏，不列為景點。"
  },
  {
    "key": "third",
    "label": "第三方平台",
    "note": "非景點管理機關，僅供參考。"
  },
  {
    "key": "excluded",
    "label": "排除來源",
    "note": "失效或非現任管理單位，只保留排除理由。"
  }
];
const SOURCES = [
  {
    "id": "TKG-001",
    "cat": "portal",
    "name": "東京都公園協會｜紅葉情報入口",
    "area": "東京都內都立公園、庭園",
    "grade": "S",
    "operator": "東京都建設局／公益財團法人東京都公園協會",
    "url": "https://www.tokyo-park.or.jp/",
    "finding": "2025年度公告提供37處公園／庭園紅葉情報；其中11列含銀杏，合計12個具名園區。",
    "caveat": "2026年度沿用日期及網址尚未確認。37處不是37處銀杏。",
    "species": "銀杏",
    "evidenceDate": "2025-11-04"
  },
  {
    "id": "TKG-020",
    "cat": "jma",
    "name": "氣象廳｜いちょうの黄葉日",
    "area": "東京觀測站（標本木尺度）",
    "grade": "O",
    "operator": "日本氣象廳",
    "url": "https://www.data.jma.go.jp/sakura/data/phn_012.html",
    "finding": "有東京及其他站的銀杏黃葉日期表；官網说明觀測以標本木進行。",
    "caveat": "觀測站日期不能充當每處公園最佳觀賞日；未報告不等於青葉。",
    "species": "銀杏",
    "evidenceDate": "最近資料頁2025–2026"
  },
  {
    "id": "TKG-021",
    "cat": "jma",
    "name": "氣象廳｜いちょうの落葉日",
    "area": "東京觀測站（標本木尺度）",
    "grade": "O",
    "operator": "日本氣象廳",
    "url": "https://www.data.jma.go.jp/sakura/data/phn_013.html",
    "finding": "有銀杏落葉日期表，與黃葉日分開。",
    "caveat": "不是全東京銀杏落葉完成日；保留站點和觀測現象定義。",
    "species": "銀杏",
    "evidenceDate": "最近資料頁2025–2026"
  },
  {
    "id": "TKG-022",
    "cat": "jma",
    "name": "氣象廳｜生物季節累年值CSV入口",
    "area": "東京及全國站點歷史",
    "grade": "O",
    "operator": "日本氣象廳",
    "url": "https://www.data.jma.go.jp/sakura/data/download_ruinenchi.html",
    "finding": "下載索引提供いちょう黄葉與いちょう落葉CSV連結。",
    "caveat": "已驗證下載入口；本次未成功取得CSV檔位元組，也未驗證CSV欄位。不可宣稱API已測通。",
    "species": "銀杏",
    "evidenceDate": "累年表主頁標記2026-03-19"
  },
  {
    "id": "TKG-027",
    "cat": "portal",
    "name": "GO TOKYO｜秋季紅葉指南",
    "area": "東京都全域",
    "grade": "C",
    "operator": "東京官方旅遊網站 GO TOKYO",
    "url": "https://www.gotokyo.org/jp/story/guide/autumn-leaves-forecast/index.html",
    "finding": "指南明確介紹明治神宮外苑銀杏等秋季地點。",
    "caveat": "網址含forecast不等於有當日銀杏觀測；文章更新日不能代表照片日期。",
    "species": "銀杏",
    "evidenceDate": "2026-09-01"
  },
  {
    "id": "TKG-028",
    "cat": "portal",
    "name": "千代田區觀光協會｜景點／專題",
    "area": "千代田區",
    "grade": "C",
    "operator": "千代田區觀光協會",
    "url": "https://visit-chiyoda.tokyo/app/spot",
    "finding": "景點列表有紅葉名所分類；可用來查區內候選地點。",
    "caveat": "尚未證實它對行幸通り等逐點提供定期銀杏觀測。",
    "species": "紅葉混合分類",
    "evidenceDate": "本次讀取2026-09-29"
  },
  {
    "id": "TKG-029",
    "cat": "portal",
    "name": "新宿觀光振興協會｜官方入口",
    "area": "新宿區",
    "grade": "C",
    "operator": "新宿觀光振興協會",
    "url": "https://www.kanko-shinjuku.jp/",
    "finding": "官方觀光入口可讀；銀杏日期快訊本次未確認。",
    "caveat": "不能取代新宿御苑管理相關單位的實際植物報告。",
    "species": "銀杏專項現況待確認",
    "evidenceDate": "本次讀取2026-09-29"
  },
  {
    "id": "TKG-031",
    "cat": "species",
    "name": "神代植物公園｜園區植物公告",
    "area": "調布市",
    "grade": "B",
    "operator": "公益財團法人東京都公園協會",
    "url": "https://www.tokyo-park.or.jp/park/jindai/",
    "finding": "有植物園官方入口；中央紅葉名單對本園記錄的是モミジ。",
    "caveat": "不可把中央名單的楓樹狀態當作銀杏。",
    "species": "2025中央項目是楓樹",
    "evidenceDate": "2025-11-04"
  },
  {
    "id": "TKG-032",
    "cat": "species",
    "name": "府中市鄉土之森博物館｜花ごよみ",
    "area": "府中市",
    "grade": "B",
    "operator": "府中市鄉土之森博物館官方營運網站",
    "url": "https://www.fuchu-cpf.or.jp/museum/hanagoyomi/index.html",
    "finding": "植物狀況頁持續更新，但本次所讀內容不足以證實銀杏專項發布。",
    "caveat": "不要把彼岸花／萩等花況轉成銀杏；照片需獨立核日期。",
    "species": "銀杏物種／現況均待補證",
    "evidenceDate": "2026-09-28"
  },
  {
    "id": "TKG-033",
    "cat": "third",
    "name": "tenki.jp｜東京都紅葉情報",
    "area": "東京都多景點",
    "grade": "T",
    "operator": "tenki.jp（非景點管理機關）",
    "url": "https://tenki.jp/kouyou/3/16/",
    "finding": "東京都列表顯示2026季資訊；來源說明每日綜合各景點回報。含明治外苑、大田黑、廣德寺等。",
    "caveat": "多樹種混合；示意照片不等於當日照片。38個東京都紅葉點不等於38個銀杏點。",
    "species": "銀杏與其他紅葉物種混合",
    "evidenceDate": "2026-09-29"
  },
  {
    "id": "TKG-034",
    "cat": "third",
    "name": "Weathernews｜東京都紅葉情報",
    "area": "東京都多景點",
    "grade": "T",
    "operator": "Weathernews（民間氣象平台）",
    "url": "https://weathernews.jp/koyo/area/tokyo/",
    "finding": "確認2026東京專頁存在；本次解析結果不足以核對所有景點及銀杏專屬欄位。",
    "caveat": "勿宣稱其所有預報／回報均為官方實測。動態渲染內容需另做實測。",
    "species": "多物種紅葉",
    "evidenceDate": "2026版頁面"
  },
  {
    "id": "TKG-035",
    "cat": "third",
    "name": "WalkerPlus｜東京 黃色に色づく",
    "area": "東京都多景點",
    "grade": "T",
    "operator": "KADOKAWA／WalkerPlus",
    "url": "https://koyo.walkerplus.com/yellow/ar0313/",
    "finding": "黃色分類列56項（含其他黃葉樹種）；芝公園頁色づき來源標示JRシステム。",
    "caveat": "56項不是56處銀杏確證；2026葉況旁可並列2025活动。圖片二次使用受限。",
    "species": "銀杏等黃色樹種；混合",
    "evidenceDate": "2026-09-28（芝公園狀態）"
  },
  {
    "id": "TKG-036",
    "cat": "third",
    "name": "Jorudan｜東京都 紅葉情報",
    "area": "東京都多景點",
    "grade": "T",
    "operator": "ジョルダン（民間平台）",
    "url": "https://sp.jorudan.co.jp/leaf/tokyo.html",
    "finding": "東京紅葉列表及國立大學通り等景點入口，可作地點查漏。",
    "caveat": "歷年通常見頃不等於今年現況；不要假設所有點均有當日觀測。",
    "species": "紅葉混合",
    "evidenceDate": "2026版列表"
  },
  {
    "id": "TKG-037",
    "cat": "third",
    "name": "日本氣象株式會社｜紅葉・黃葉見頃預想",
    "area": "東京城市尺度及其他地點",
    "grade": "T",
    "operator": "日本氣象株式會社（不是氣象廳）",
    "url": "https://n-kishou.com/corp/news-contents/autumn/",
    "finding": "2026第一回預報明確區分銀杏黃葉與楓樹紅葉。",
    "caveat": "必須標forecast，保留發布日、預測對象和尺度；不得覆寫公園實際觀測。",
    "species": "黃葉=銀杏；紅葉主要=楓樹",
    "evidenceDate": "2026-09-02（第一回）"
  },
  {
    "id": "TKG-038",
    "cat": "excluded",
    "name": "東京都公園協會｜2025紅葉季舊專頁",
    "area": "東京都內",
    "grade": "X",
    "operator": "公益財團法人東京都公園協會",
    "url": "https://www.tokyo-park.or.jp/special/kouyou/index.html",
    "finding": "2025公告指向此頁；本次查核回傳404。",
    "caveat": "此列保留作失效紀錄，不計入可立即使用的現況來源。",
    "species": "銀杏",
    "evidenceDate": "2025-11-04（公告中的連結）"
  },
  {
    "id": "TKG-039",
    "cat": "excluded",
    "name": "箱根植木｜大田黑公園舊管理案例",
    "area": "杉並區",
    "grade": "X",
    "operator": "箱根植木（舊管理公司）",
    "url": "https://hakone-ueki.com/casestudy/case1/",
    "finding": "公司首頁明寫大田黑公園管理已於2024年3月結束。",
    "caveat": "只保留遷移／排除理由；現行入口由杉並區官方指向荻窪三庭園。",
    "species": "不適用",
    "evidenceDate": "管理期2011-04至2024-03"
  }
];

/* 其他參考資料 */
const OTHER_REFS = [
  {
    "label": "氣象廳 いちょう黄葉日（平年值 11/23）",
    "url": "https://www.data.jma.go.jp/sakura/data/phn_012.html"
  },
  {
    "label": "氣象廳 いちょう落葉日（平年值 12/3）",
    "url": "https://www.data.jma.go.jp/sakura/data/phn_013.html"
  },
  {
    "label": "氣象廳 生物季節累年值 CSV 入口",
    "url": "https://www.data.jma.go.jp/sakura/data/download_ruinenchi.html"
  },
  {
    "label": "座標參考：OpenStreetMap（Nominatim／Overpass）",
    "url": "https://www.openstreetmap.org/"
  }
];
