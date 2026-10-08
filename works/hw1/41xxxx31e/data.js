/* 東京銀杏黃葉散步地圖：資料檔。
 * 範圍：老師提供的 41 列來源表，去重後只保留已被來源證實有銀杏的 26 處實際景點。
 * 座標是「園區近似位置」（概略，不是單棵樹的位置）；每處景點的本季狀態一律為「待查核」。
 * 氣象資料、彙整平台、入口頁、排除與候選紀錄只出現在 sources（頁尾來源區）。 */
window.GINKGO_DATA = {
 "meta": {
  "sheetUrl": "https://docs.google.com/spreadsheets/d/1dx_41InyuuWuILc4ZHJW8tTZMVOCpIuSz-QzISzd7y0/edit#gid=164385659",
  "sheetRows": 41,
  "sheetChecked": "2026-09-29",
  "rechecked": "2026-10-02",
  "built": "2026-10-08",
  "walkSpeedMPerMin": 80,
  "maxStops": 5,
  "minStops": 2,
  "osrmDate": "2026-10-08"
 },
 "map": {
  "W": 1200,
  "H": 700,
  "latTop": 35.792,
  "topPad": 20,
  "lngBreak": 139.6,
  "xb": 431.25,
  "kY": 3669.6,
  "kE": 2979.9,
  "kW": 993.3
 },
 "jma": {
  "yellowNormal": "11/23",
  "fallNormal": "12/3",
  "yellow2025": "11/22",
  "fall2025": "12/4",
  "recentYellow": [
   [
    "2023",
    "12/1"
   ],
   [
    "2024",
    "12/3"
   ],
   [
    "2025",
    "11/22"
   ]
  ],
  "period": "1991–2020",
  "yellowUrl": "https://www.data.jma.go.jp/sakura/data/phn_012.html",
  "fallUrl": "https://www.data.jma.go.jp/sakura/data/phn_013.html"
 },
 "stages": [
  {
   "no": 1,
   "name": "青葉",
   "jp": "青葉",
   "range": "10/25 以前",
   "days": 6,
   "color": "#5f8f3e",
   "text": "葉片仍是綠色，樹冠看不出明顯的黃色。"
  },
  {
   "no": 2,
   "name": "開始轉色",
   "jp": "色づき始め",
   "range": "10/26–11/8",
   "days": 14,
   "color": "#a9b535",
   "text": "少部分葉片開始泛黃，整體仍以綠色為主。"
  },
  {
   "no": 3,
   "name": "黃葉進行",
   "jp": "黄葉進行",
   "range": "11/9–11/22",
   "days": 14,
   "color": "#d6b62a",
   "text": "黃色的比例逐日增加，還帶著些綠意。"
  },
  {
   "no": 4,
   "name": "最佳觀賞",
   "jp": "見頃",
   "range": "11/23–11/28",
   "days": 6,
   "color": "#e0a21b",
   "text": "多數葉片轉黃，是安排賞銀杏的主要時段。"
  },
  {
   "no": 5,
   "name": "開始落葉",
   "jp": "落葉始め",
   "range": "11/29–12/2",
   "days": 4,
   "color": "#b9722a",
   "text": "葉片開始成片掉落，樹冠漸疏、地面鋪上金黃。"
  },
  {
   "no": 6,
   "name": "落葉",
   "jp": "落葉",
   "range": "12/3 以後",
   "days": 10,
   "color": "#6e6050",
   "text": "大半葉片已經掉落，只剩零星的黃葉。"
  }
 ],
 "grades": {
  "S": {
   "short": "公園協會名單",
   "desc": "東京都公園協會的官方公園頁與 2025 年度紅葉情報名單，列有銀杏。",
   "official": true
  },
  "A": {
   "short": "官方現地紀錄",
   "desc": "官方網站有附日期的現地快訊或黃葉紀錄（多數是過往季節）。",
   "official": true
  },
  "B": {
   "short": "官方・待補",
   "desc": "官方網站，但銀杏專項的資料還在待補。",
   "official": true
  },
  "C": {
   "short": "官方入口",
   "desc": "官方網站或入口頁，沒有附日期的銀杏觀測。",
   "official": true
  },
  "O": {
   "short": "氣象站觀測",
   "desc": "氣象廳觀測站（標本木）尺度，不是景點，只用在季節說明。",
   "official": false
  },
  "T": {
   "short": "第三方彙整",
   "desc": "第三方平台或預報產品，不是景點管理單位，只列在來源區。",
   "official": false
  },
  "X": {
   "short": "排除或失效",
   "desc": "排除、失效或舊管理單位的紀錄，只列在來源區。",
   "official": false
  }
 },
 "areas": [
  {
   "id": "chiyoda",
   "name": "千代田・皇居周邊",
   "note": "日比谷、皇居、靖國"
  },
  {
   "id": "shinjuku-shibuya",
   "name": "新宿・澀谷",
   "note": "新宿、外苑、代代木、駒場"
  },
  {
   "id": "ueno-hongo",
   "name": "上野・本鄉",
   "note": "台東區、文京區"
  },
  {
   "id": "bay",
   "name": "東京灣岸（港區・江東區）",
   "note": "芝公園、木場公園"
  },
  {
   "id": "suginami",
   "name": "杉並",
   "note": "荻窪、善福寺川一帶"
  },
  {
   "id": "nerima-itabashi",
   "name": "練馬・板橋（北部）",
   "note": "光が丘、城北中央"
  },
  {
   "id": "tama-east",
   "name": "多摩東部（立川・國立・府中・小金井）",
   "note": "位於東京西側郊外"
  },
  {
   "id": "tama-west",
   "name": "多摩西部（八王子・あきる野）",
   "note": "位於東京西側郊外，距離最遠"
  }
 ],
 "spots": [
  {
   "id": "TKG-011",
   "no": "01",
   "src": "TKG-011",
   "area": "chiyoda",
   "ja": "日比谷公園",
   "zh": "日比谷公園",
   "ward": "千代田區",
   "grade": "S",
   "operator": "公益財團法人東京都公園協會",
   "official": "https://www.tokyo-park.or.jp/park/hibiya/",
   "evidenceUrl": "https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf",
   "evidenceDate": "2025-11-04",
   "audited": "2026-09-29",
   "rechecked": "2026-10-02",
   "status": "待查核",
   "species": "銀杏",
   "cadence": "中央整合頁2025季內每週兩次；園區個別公告頻率未承諾。",
   "sheetFinding": "2025年度官方紅葉情報名單明列本園區之銀杏；本次不宣稱已取得2026銀杏現況。",
   "lat": 35.6737,
   "lng": 139.7559,
   "posLabel": "首賭けイチョウ（松本楼付近・概略）",
   "posConf": "medium",
   "posConfLabel": "中等（單一來源或由官方文字推定）",
   "pos": "首賭けイチョウ一帶（松本楼附近）。位置由 OSM 導覽牌與松本楼推算，誤差約 50～100 公尺。",
   "proof": "官方公園頁介紹園內的「首賭けイチョウ」，推定樹齡 400～500 年，是公園的象徵；來源表記載：2025 年度東京都公園協會的紅葉情報名單（2025-11-04）明列本園區的銀杏；本站不宣稱已取得 2026 年的銀杏現況。",
   "proofUrl": "https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf",
   "proofDate": "2025-11-04",
   "proofFromOfficialDomain": false,
   "limit": "官方公園頁只介紹這棵樹的由來，沒有本季葉況。園內正在整修，大噴水、噴水廣場與小音樂堂周邊暫不可進入（官方公園頁，2026-10-02 讀取）。",
   "season": null,
   "history": []
  },
  {
   "id": "TKG-017",
   "no": "02",
   "src": "TKG-017",
   "area": "chiyoda",
   "ja": "皇居東御苑",
   "zh": "皇居東御苑",
   "ward": "千代田區",
   "grade": "A",
   "operator": "宮內廳",
   "official": "https://www.kunaicho.go.jp/visit/higashigyoen/hanadayori/index.html",
   "evidenceUrl": "https://www.kunaicho.go.jp/visit/higashigyoen/hanadayori/20251128.html",
   "evidenceDate": "2025-11-28",
   "audited": "2026-09-29",
   "rechecked": "2026-10-02",
   "status": "待查核",
   "species": "銀杏",
   "cadence": "列表可見近每週更新；未將其視為保證頻率。",
   "sheetFinding": "日期文記錄銀杏等樹木變色，照片標示百人番所前のイチョウ。",
   "lat": 35.6857,
   "lng": 139.7581,
   "posLabel": "百人番所（前のイチョウ）",
   "posConf": "medium",
   "posConfLabel": "中等（單一來源或由官方文字推定）",
   "pos": "百人番所前一帶。位置由 OSM 建築物推算，銀杏在建築前方數十公尺內。",
   "proof": "宮內廳官方「花だより」有附日期的銀杏紀錄（見「官方紀錄」）。",
   "proofUrl": "https://www.kunaicho.go.jp/visit/higashigyoen/hanadayori/20251128.html",
   "proofDate": "2025-11-28",
   "proofFromOfficialDomain": false,
   "limit": "皇居東御苑不是皇居外苑，也不是北之丸公園，管理機關與範圍都不同。全園落葉的描述不能直接當作銀杏。官方花だより最新一期是 2026-09-18（2026-10-02 讀取），還沒有銀杏內容。",
   "season": null,
   "history": [
    {
     "date": "2025-11-28",
     "past": true,
     "text": "宮內廳花だより：園內銀杏等樹木轉色，照片標示「百人番所前のイチョウ」。",
     "url": "https://www.kunaicho.go.jp/visit/higashigyoen/hanadayori/20251128.html"
    }
   ]
  },
  {
   "id": "TKG-030",
   "no": "03",
   "src": "TKG-030",
   "area": "chiyoda",
   "ja": "北の丸公園",
   "zh": "北之丸公園",
   "ward": "千代田區",
   "grade": "B",
   "operator": "一般財團法人國民公園協會 皇居外苑",
   "official": "https://fng.or.jp/koukyo/news/",
   "evidenceUrl": "https://fng.or.jp/koukyo/",
   "evidenceDate": "本次可見2026-09-19季節文章入口",
   "audited": "2026-09-29",
   "rechecked": "2026-10-02",
   "status": "待查核",
   "species": "銀杏專項現況待確認",
   "cadence": "不定期；銀杏頻率待查。",
   "sheetFinding": "有持續更新的自然／四季消息；本次未核得銀杏專项葉況。",
   "lat": 35.6915,
   "lng": 139.7511,
   "posLabel": "公園中心（概略）",
   "posConf": "low",
   "posConfLabel": "概略（園區代表點）",
   "pos": "公園中心的概略位置（園區代表點）。官方文章說大イチョウ在日本武道館前，但本站沒有取得確切座標。",
   "proof": "同一官方網站的日期文章（2023-11-24）寫到日本武道館前有「大イチョウ」，並說明「イチョウは園内各所に植栽されています」。",
   "proofUrl": "https://fng.or.jp/koukyo/2023/11/24/kitanomarukouennnokouyou/",
   "proofDate": "2023-11-24",
   "proofFromOfficialDomain": true,
   "limit": "只有「北之丸公園」有銀杏依據；皇居外苑（皇居前廣場、行幸通り）沒有，所以不列入。與宮內廳管理的皇居東御苑是不同來源、不同範圍。",
   "season": null,
   "history": [
    {
     "date": "2023-11-24",
     "past": true,
     "text": "官方文章寫大イチョウ「見ごろは12月上旬」。",
     "url": "https://fng.or.jp/koukyo/2023/11/24/kitanomarukouennnokouyou/"
    },
    {
     "date": "2024-11-13",
     "past": true,
     "text": "官方文章寫「園内のイチョウは色づき始めたばかり」。",
     "url": "https://fng.or.jp/koukyo/2024/11/13/irodukukitanomarukouen/"
    }
   ]
  },
  {
   "id": "TKG-026",
   "no": "04",
   "src": "TKG-026",
   "area": "chiyoda",
   "ja": "靖國神社",
   "zh": "靖國神社",
   "ward": "千代田區",
   "grade": "C",
   "operator": "靖國神社",
   "official": "https://www.yasukuni.or.jp/",
   "evidenceUrl": "https://www.yasukuni.or.jp/schedule/photo.html",
   "evidenceDate": "本次可讀2026公告",
   "audited": "2026-09-29",
   "rechecked": "2026-10-02",
   "status": "待查核",
   "species": "銀杏專項現況待確認",
   "cadence": "未確認。",
   "sheetFinding": "官網和照片入口存在；本次未核得可直接當銀杏現況的日期觀測文章。",
   "lat": 35.6941,
   "lng": 139.7431,
   "posLabel": "境內主要區域（拝殿）",
   "posConf": "high",
   "posConfLabel": "較精確（兩種以上來源相符）",
   "pos": "境內主要區域（拝殿）的位置。參道並木的確切範圍未核實。",
   "proof": "同一官方網站的公告（令和 5 年 9 月 6 日，限定朱印頒布）提到「参道のイチョウ並木」。",
   "proofUrl": "https://www.yasukuni.or.jp/news_detail.html?id=492",
   "proofDate": "2023-09-06",
   "proofFromOfficialDomain": true,
   "limit": "官方網站沒有附日期的銀杏觀測，也沒有銀杏的株數與位置。宣傳影片的上線日不等於拍攝日。境內是莊嚴的祭祀場所，請依現場規定安靜參拜。",
   "season": null,
   "history": []
  },
  {
   "id": "TKG-015",
   "no": "05",
   "src": "TKG-015",
   "area": "shinjuku-shibuya",
   "ja": "新宿御苑",
   "zh": "新宿御苑",
   "ward": "新宿區、澀谷區",
   "grade": "A",
   "operator": "一般財團法人國民公園協會 新宿御苑",
   "official": "https://fng.or.jp/shinjuku/news/",
   "evidenceUrl": "https://fng.or.jp/shinjuku/2025/11/28/20251128_03/",
   "evidenceDate": "2025-11-28",
   "audited": "2026-09-29",
   "rechecked": "2026-10-02",
   "status": "待查核",
   "species": "銀杏",
   "cadence": "已見每週みどころ及其他不定期文章；不是保證頻率。",
   "sheetFinding": "日期文章明確敘述銀杏黃葉見頃，包含溫室附近照片及園內植物地圖。",
   "lat": 35.6867,
   "lng": 139.7126,
   "posLabel": "大温室（銀杏拍攝熱點）",
   "posConf": "medium",
   "posConfLabel": "中等（單一來源或由官方文字推定）",
   "pos": "大溫室一帶。官方說銀杏在「温室近く」，位置取自 OSM 建築物，實際樹位誤差約數十公尺。",
   "proof": "國民公園協會官方「自然情報」有附日期的銀杏紀錄（見「官方紀錄」）。",
   "proofUrl": "https://fng.or.jp/shinjuku/2025/11/28/20251128_03/",
   "proofDate": "2025-11-28",
   "proofFromOfficialDomain": false,
   "limit": "過往文章只是歷史樣本，不可當作本季。官方 2026-10-01 公告：大木戶門周邊施工，自 2026-10-06 起至 11 月下旬（預定）有通行管制。",
   "season": null,
   "history": [
    {
     "date": "2025-11-28",
     "past": true,
     "text": "官方「みどころ」文章寫園內各處的銀杏「みごろ」，大溫室附近是熱門拍攝點。",
     "url": "https://fng.or.jp/shinjuku/2025/11/28/20251128_03/"
    }
   ]
  },
  {
   "id": "TKG-009",
   "no": "06",
   "src": "TKG-009",
   "area": "shinjuku-shibuya",
   "ja": "戸山公園",
   "zh": "戶山公園",
   "ward": "新宿區",
   "grade": "S",
   "operator": "公益財團法人東京都公園協會",
   "official": "https://www.tokyo-park.or.jp/park/toyama/",
   "evidenceUrl": "https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf",
   "evidenceDate": "2025-11-04",
   "audited": "2026-09-29",
   "rechecked": "2026-10-02",
   "status": "待查核",
   "species": "楓樹、銀杏",
   "cadence": "中央整合頁2025季內每週兩次；園區個別公告頻率未承諾。",
   "sheetFinding": "2025年度官方紅葉情報名單明列本園區之銀杏；本次不宣稱已取得2026銀杏現況。",
   "lat": 35.7037,
   "lng": 139.7135,
   "posLabel": "戸山（箱根山）地区（概略）",
   "posConf": "low",
   "posConfLabel": "概略（園區代表點）",
   "pos": "戸山（箱根山）地區的概略位置。公園另有西側的大久保地區，地圖沒有標示。",
   "proof": "來源表記載：2025 年度東京都公園協會的紅葉情報名單（2025-11-04）明列本園區的銀杏；本站不宣稱已取得 2026 年的銀杏現況。",
   "proofUrl": "https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf",
   "proofDate": "2025-11-04",
   "proofFromOfficialDomain": false,
   "limit": "官方公園頁同時列出楓樹與銀杏，銀杏只寫「イチョウ」而沒有地點。不要把全園的紅葉狀況當作銀杏。",
   "season": null,
   "history": []
  },
  {
   "id": "TKG-023",
   "no": "07",
   "src": "TKG-023",
   "area": "shinjuku-shibuya",
   "ja": "明治神宮外苑 いちょう並木",
   "zh": "明治神宮外苑 銀杏大道",
   "ward": "新宿區",
   "grade": "C",
   "operator": "明治神宮外苑",
   "official": "https://www.meijijingugaien.jp/walk/sight/season.html",
   "evidenceUrl": "https://www.meijijingugaien.jp/walk/sight/season.html",
   "evidenceDate": "未見可當現況的日期",
   "audited": "2026-09-29",
   "rechecked": "2026-10-02",
   "status": "待查核",
   "species": "銀杏",
   "cadence": "未確認。",
   "sheetFinding": "官網明確介紹銀杏並木與四季景觀；本次未確認穩定的逐日銀杏葉況專頁。",
   "lat": 35.6739,
   "lng": 139.7199,
   "posLabel": "並木中點",
   "posConf": "high",
   "posConfLabel": "較精確（兩種以上來源相符）",
   "pos": "並木中點，依官方文字與 OSM 推算。",
   "proof": "官方網站「いちょう並木の春夏秋冬」介紹並木：從青山口到圓周道路約 300 公尺、146 棵（歷史數字，不保證今年現況）。",
   "proofUrl": "https://www.meijijingugaien.jp/walk/sight/season.html",
   "proofDate": "未見可當現況的日期",
   "proofFromOfficialDomain": false,
   "limit": "這裡是明治神宮外苑，不是明治神宮內苑。官方沒有逐日的葉況頁，2026 年是否舉辦「いちょう祭り」也未能核實。",
   "season": null,
   "history": [
    {
     "date": "2022-11-17",
     "past": true,
     "text": "官方「外苑便り」寫「イチョウ並木が見頃です」，是官方網站上最近一則有日期的銀杏貼文。",
     "url": "https://www.meijijingugaien.jp/gaien-news/"
    }
   ]
  },
  {
   "id": "TKG-012",
   "no": "08",
   "src": "TKG-012",
   "area": "shinjuku-shibuya",
   "ja": "代々木公園",
   "zh": "代代木公園",
   "ward": "澀谷區",
   "grade": "S",
   "operator": "公益財團法人東京都公園協會",
   "official": "https://www.tokyo-park.or.jp/park/yoyogi/",
   "evidenceUrl": "https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf",
   "evidenceDate": "2025-11-04",
   "audited": "2026-09-29",
   "rechecked": "2026-10-02",
   "status": "待查核",
   "species": "銀杏",
   "cadence": "中央整合頁2025季內每週兩次；園區個別公告頻率未承諾。",
   "sheetFinding": "2025年度官方紅葉情報名單明列本園區之銀杏；本次不宣稱已取得2026銀杏現況。",
   "lat": 35.6717,
   "lng": 139.6965,
   "posLabel": "公園中心（概略）",
   "posConf": "low",
   "posConfLabel": "概略（園區代表點）",
   "pos": "公園中心的概略位置（約 54 公頃）。",
   "proof": "來源表記載：2025 年度東京都公園協會的紅葉情報名單（2025-11-04）明列本園區的銀杏；本站不宣稱已取得 2026 年的銀杏現況。",
   "proofUrl": "https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf",
   "proofDate": "2025-11-04",
   "proofFromOfficialDomain": false,
   "limit": "官方公園頁只在秋季花況列出「イチョウ」，沒有指出地點。若日後有黃葉公告，也只能套用在公告寫明的區域，不能擴及全園。",
   "season": null,
   "history": []
  },
  {
   "id": "TKG-040-komaba",
   "no": "09",
   "src": "TKG-040",
   "area": "shinjuku-shibuya",
   "ja": "東京大学 駒場キャンパス 銀杏並木",
   "zh": "東京大學 駒場校區 銀杏並木",
   "ward": "目黑區",
   "grade": "C",
   "operator": "東京大學",
   "official": "https://www.u-tokyo.ac.jp/ja/about/campus-guide/index.html",
   "evidenceUrl": "https://www.u-tokyo.ac.jp/ja/about/campus-guide/index.html",
   "evidenceDate": "2026-04-01（地圖頁）",
   "audited": "2026-09-29",
   "rechecked": "2026-10-02",
   "status": "待查核",
   "species": "銀杏專項現況待確認",
   "cadence": "銀杏更新頻率未確認。",
   "sheetFinding": "確認本鄉及駒場的官方地圖／參觀入口；尚未確認穩定的銀杏日期觀測來源。",
   "lat": 35.6604,
   "lng": 139.6852,
   "posLabel": "並木中段（概略）",
   "posConf": "medium",
   "posConfLabel": "中等（單一來源或由官方文字推定）",
   "pos": "並木中段的概略位置。由官方文字與 OSM 樹列推定，誤差約 80 公尺；並木在 1 號館北側的東西向道路，不是正門到 1 號館的軸線。",
   "proof": "東京大學官方網站寫「秋には銀杏並木がメインストリートを黄色に染め上げる」。",
   "proofUrl": "https://kimino.ct.u-tokyo.ac.jp/kotohajime/komaba-campus/",
   "proofDate": null,
   "proofFromOfficialDomain": true,
   "limit": "本鄉校區、駒場校區與小石川植物園是三個不同的地點。東京大學官方的校區導覽沒有銀杏的日期觀測，校內參觀規則請見官方連結。",
   "season": null,
   "history": []
  },
  {
   "id": "TKG-002",
   "no": "10",
   "src": "TKG-002",
   "area": "ueno-hongo",
   "ja": "上野恩賜公園",
   "zh": "上野恩賜公園",
   "ward": "台東區",
   "grade": "S",
   "operator": "公益財團法人東京都公園協會",
   "official": "https://www.tokyo-park.or.jp/park/ueno/",
   "evidenceUrl": "https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf",
   "evidenceDate": "2025-11-04",
   "audited": "2026-09-29",
   "rechecked": "2026-10-02",
   "status": "待查核",
   "species": "銀杏",
   "cadence": "中央整合頁2025季內每週兩次；園區個別公告頻率未承諾。",
   "sheetFinding": "2025年度官方紅葉情報名單明列本園區之銀杏；本次不宣稱已取得2026銀杏現況。",
   "lat": 35.713,
   "lng": 139.7724,
   "posLabel": "公園中心（概略）",
   "posConf": "low",
   "posConfLabel": "概略（園區代表點）",
   "pos": "公園中心的概略位置（各來源座標的平均）。",
   "proof": "來源表記載：2025 年度東京都公園協會的紅葉情報名單（2025-11-04）明列本園區的銀杏；本站不宣稱已取得 2026 年的銀杏現況。",
   "proofUrl": "https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf",
   "proofDate": "2025-11-04",
   "proofFromOfficialDomain": false,
   "limit": "官方公園頁本身沒有提到銀杏，銀杏依據是 2025 年的東京都公園協會名單；園內銀杏的位置也沒有載明。",
   "season": null,
   "history": []
  },
  {
   "id": "TKG-013",
   "no": "11",
   "src": "TKG-013",
   "area": "ueno-hongo",
   "ja": "旧岩崎邸庭園",
   "zh": "舊岩崎邸庭園",
   "ward": "台東區",
   "grade": "S",
   "operator": "公益財團法人東京都公園協會",
   "official": "https://www.tokyo-park.or.jp/park/kyu-iwasaki-tei/",
   "evidenceUrl": "https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf",
   "evidenceDate": "2025-11-04",
   "audited": "2026-09-29",
   "rechecked": "2026-10-02",
   "status": "待查核",
   "species": "銀杏",
   "cadence": "中央整合頁2025季內每週兩次；園區個別公告頻率未承諾。",
   "sheetFinding": "2025年度官方紅葉情報名單明列本園區之銀杏；本次不宣稱已取得2026銀杏現況。",
   "lat": 35.7092,
   "lng": 139.7683,
   "posLabel": "庭園正門（入口）",
   "posConf": "high",
   "posConfLabel": "較精確（兩種以上來源相符）",
   "pos": "庭園正門（入口）的位置。庭園約 2 公頃，銀杏的位置未載明。",
   "proof": "來源表記載：2025 年度東京都公園協會的紅葉情報名單（2025-11-04）明列本園區的銀杏；本站不宣稱已取得 2026 年的銀杏現況。",
   "proofUrl": "https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf",
   "proofDate": "2025-11-04",
   "proofFromOfficialDomain": false,
   "limit": "官方頁列有「イチョウ」，但沒有指出位置。2026-10-10 起的「都立 9 庭園 紅葉めぐりスタンプラリー」是活動期間，不是銀杏的最佳觀賞日。",
   "season": null,
   "history": []
  },
  {
   "id": "TKG-040-hongo",
   "no": "12",
   "src": "TKG-040",
   "area": "ueno-hongo",
   "ja": "東京大学 本郷キャンパス 銀杏並木",
   "zh": "東京大學 本鄉校區 銀杏並木",
   "ward": "文京區",
   "grade": "C",
   "operator": "東京大學",
   "official": "https://www.u-tokyo.ac.jp/ja/about/campus-guide/index.html",
   "evidenceUrl": "https://www.u-tokyo.ac.jp/ja/about/campus-guide/index.html",
   "evidenceDate": "2026-04-01（地圖頁）",
   "audited": "2026-09-29",
   "rechecked": "2026-10-02",
   "status": "待查核",
   "species": "銀杏專項現況待確認",
   "cadence": "銀杏更新頻率未確認。",
   "sheetFinding": "確認本鄉及駒場的官方地圖／參觀入口；尚未確認穩定的銀杏日期觀測來源。",
   "lat": 35.7131,
   "lng": 139.7606,
   "posLabel": "並木中點",
   "posConf": "high",
   "posConfLabel": "較精確（兩種以上來源相符）",
   "pos": "並木中點（正門到安田講堂一帶），依 OSM 名為「銀杏並木」的步道推算。",
   "proof": "東京大學官方「キャンパス 1km」介紹頁寫到「本郷キャンパスの銀杏並木」。",
   "proofUrl": "https://www.u-tokyo.ac.jp/ja/about/campus-guide/1km_of_campus.html",
   "proofDate": null,
   "proofFromOfficialDomain": true,
   "limit": "本鄉校區、駒場校區與小石川植物園是三個不同的地點。東京大學官方的校區導覽沒有銀杏的日期觀測，校內參觀規則請見官方連結。",
   "season": null,
   "history": []
  },
  {
   "id": "TKG-018",
   "no": "13",
   "src": "TKG-018",
   "area": "ueno-hongo",
   "ja": "小石川植物園",
   "zh": "小石川植物園（東京大學附屬植物園）",
   "ward": "文京區",
   "grade": "A",
   "operator": "東京大學大學院理學系研究科附屬植物園",
   "official": "https://koishikawa-bg.jp/kaikainfo/",
   "evidenceUrl": "https://koishikawa-bg.jp/kaika/5013/",
   "evidenceDate": "2025-11-19",
   "audited": "2026-09-29",
   "rechecked": "2026-10-02",
   "status": "待查核",
   "species": "銀杏",
   "cadence": "不定期，已有多篇日期文章。",
   "sheetFinding": "當日文章將イチョウ明列於正在紅葉／黃葉的植物清單。",
   "lat": 35.7202,
   "lng": 139.7452,
   "posLabel": "精子発見のイチョウ（補充副點）",
   "posConf": "medium",
   "posConfLabel": "中等（單一來源或由官方文字推定）",
   "pos": "「精子発見のイチョウ」一帶（園內名木），只有 OSM 單一座標來源。",
   "proof": "官方「見ごろの植物」有附日期的銀杏紀錄（見「官方紀錄」），園內導覽也介紹「精子発見のイチョウ」。",
   "proofUrl": "https://koishikawa-bg.jp/kaika/5013/",
   "proofDate": "2025-11-19",
   "proofFromOfficialDomain": false,
   "limit": "看到黃葉不等於已是最佳觀賞期。小石川植物園與小石川後樂園是不同地點。官方 2026 年的開花・紅葉狀況文章（到 2026-10-01 為止）還沒有提到銀杏。",
   "season": null,
   "history": [
    {
     "date": "2025-11-19",
     "past": true,
     "text": "官方「見ごろの植物」把イチョウ列在「正在紅葉・黃葉」的植物中；這不等於已是最佳期。",
     "url": "https://koishikawa-bg.jp/kaika/5013/"
    }
   ]
  },
  {
   "id": "TKG-005",
   "no": "14",
   "src": "TKG-005",
   "area": "bay",
   "ja": "芝公園",
   "zh": "芝公園",
   "ward": "港區",
   "grade": "S",
   "operator": "公益財團法人東京都公園協會",
   "official": "https://www.tokyo-park.or.jp/park/siba/",
   "evidenceUrl": "https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf",
   "evidenceDate": "2025-11-04",
   "audited": "2026-09-29",
   "rechecked": "2026-10-02",
   "status": "待查核",
   "species": "楓樹、銀杏",
   "cadence": "中央整合頁2025季內每週兩次；園區個別公告頻率未承諾。",
   "sheetFinding": "2025年度官方紅葉情報名單明列本園區之銀杏；本次不宣稱已取得2026銀杏現況。",
   "lat": 35.6555,
   "lng": 139.748,
   "posLabel": "公園中心（概略；銀杏位置未核實）",
   "posConf": "low",
   "posConfLabel": "概略（園區代表點）",
   "pos": "公園中心的概略位置（環狀公園，銀杏位置未核實）。",
   "proof": "來源表記載：2025 年度東京都公園協會的紅葉情報名單（2025-11-04）明列本園區的銀杏；本站不宣稱已取得 2026 年的銀杏現況。",
   "proofUrl": "https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf",
   "proofDate": "2025-11-04",
   "proofFromOfficialDomain": false,
   "limit": "官方公園頁只寫「クスノキ、ケヤキ、イチョウなどの大木がところどころにあります」，沒有指出地點。もみじ谷是楓樹，不是銀杏。",
   "season": null,
   "history": []
  },
  {
   "id": "TKG-003",
   "no": "15",
   "src": "TKG-003",
   "area": "bay",
   "ja": "木場公園",
   "zh": "木場公園",
   "ward": "江東區",
   "grade": "S",
   "operator": "公益財團法人東京都公園協會",
   "official": "https://www.tokyo-park.or.jp/park/kiba/",
   "evidenceUrl": "https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf",
   "evidenceDate": "2025-11-04",
   "audited": "2026-09-29",
   "rechecked": "2026-10-02",
   "status": "待查核",
   "species": "銀杏",
   "cadence": "中央整合頁2025季內每週兩次；園區個別公告頻率未承諾。",
   "sheetFinding": "2025年度官方紅葉情報名單明列本園區之銀杏；本次不宣稱已取得2026銀杏現況。",
   "lat": 35.6752,
   "lng": 139.8085,
   "posLabel": "公園中心（概略）",
   "posConf": "low",
   "posConfLabel": "概略（園區代表點）",
   "pos": "公園中心的概略位置。公園被木場公園大橋分成南北兩半，座標平均後落在中間。",
   "proof": "來源表記載：2025 年度東京都公園協會的紅葉情報名單（2025-11-04）明列本園區的銀杏；本站不宣稱已取得 2026 年的銀杏現況。",
   "proofUrl": "https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf",
   "proofDate": "2025-11-04",
   "proofFromOfficialDomain": false,
   "limit": "官方公園頁本身沒有「銀杏」字樣，銀杏依據是 2025 年的東京都公園協會名單；銀杏的位置未載明。",
   "season": null,
   "history": []
  },
  {
   "id": "TKG-024",
   "no": "16",
   "src": "TKG-024",
   "area": "suginami",
   "ja": "大田黒公園",
   "zh": "大田黑公園",
   "ward": "杉並區",
   "grade": "B",
   "operator": "荻窪三庭園（杉並區官方指向的公園網站）",
   "official": "https://ogikubo3gardens.jp/ootaguro/",
   "evidenceUrl": "https://www.city.suginami.tokyo.jp/s100/shisetsu/14632.html",
   "evidenceDate": "區公所頁更新2025-09-09",
   "audited": "2026-09-29",
   "rechecked": "2026-10-02",
   "status": "待查核",
   "species": "銀杏",
   "cadence": "尚未確認黃葉更新頻率。",
   "sheetFinding": "杉並區官網證明銀杏並木及現行官方網址；本次自動讀取公園頁未取得正文。",
   "lat": 35.7007,
   "lng": 139.6248,
   "posLabel": "公園位置",
   "posConf": "high",
   "posConfLabel": "較精確（兩種以上來源相符）",
   "pos": "公園位置（整園約 0.9 公頃，三個座標來源相差不到 40 公尺）。",
   "proof": "杉並區官方網站寫：從正門進去的園路左右，是樹齡約 100 年的大銀杏並木（頁面更新 2025-09-09）。",
   "proofUrl": "https://www.city.suginami.tokyo.jp/s100/shisetsu/14632.html",
   "proofDate": "2025-09-09",
   "proofFromOfficialDomain": false,
   "limit": "公園官方頁需要瀏覽器執行程式才顯示正文，本站未能完整核對季節內容。2024 年 3 月起已不是箱根植木管理，請勿參考其舊頁面。",
   "season": null,
   "history": []
  },
  {
   "id": "TKG-007",
   "no": "17",
   "src": "TKG-007",
   "area": "suginami",
   "ja": "善福寺川緑地",
   "zh": "善福寺川綠地",
   "ward": "杉並區",
   "grade": "S",
   "operator": "公益財團法人東京都公園協會",
   "official": "https://www.tokyo-park.or.jp/park/zempukujigawa-ryokuchi/index.html",
   "evidenceUrl": "https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf",
   "evidenceDate": "2025-11-04",
   "audited": "2026-09-29",
   "rechecked": "2026-10-02",
   "status": "待查核",
   "species": "銀杏",
   "cadence": "中央整合頁2025季內每週兩次；園區個別公告頻率未承諾。",
   "sheetFinding": "2025年度官方紅葉情報名單明列本園區之銀杏；本次不宣稱已取得2026銀杏現況。",
   "lat": 35.692,
   "lng": 139.6305,
   "posLabel": "公園中心（概略；沿河線狀公園）",
   "posConf": "low",
   "posConfLabel": "概略（園區代表點）",
   "pos": "沿善福寺川的線狀公園，標示的是概略中心；兩個座標來源相距約 450 公尺。",
   "proof": "來源表記載：2025 年度東京都公園協會的紅葉情報名單（2025-11-04）明列本園區的銀杏；本站不宣稱已取得 2026 年的銀杏現況。",
   "proofUrl": "https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf",
   "proofDate": "2025-11-04",
   "proofFromOfficialDomain": false,
   "limit": "2025 年名單把善福寺川緑地與和田堀公園合併成一列，不能假設兩處各有獨立的觀測。官方頁只寫秋季有「イチョウ」，沒有指出地點。",
   "season": null,
   "history": []
  },
  {
   "id": "TKG-008",
   "no": "18",
   "src": "TKG-008",
   "area": "suginami",
   "ja": "和田堀公園",
   "zh": "和田堀公園",
   "ward": "杉並區",
   "grade": "S",
   "operator": "公益財團法人東京都公園協會",
   "official": "https://www.tokyo-park.or.jp/park/wadabori/",
   "evidenceUrl": "https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf",
   "evidenceDate": "2025-11-04",
   "audited": "2026-09-29",
   "rechecked": "2026-10-02",
   "status": "待查核",
   "species": "銀杏",
   "cadence": "中央整合頁2025季內每週兩次；園區個別公告頻率未承諾。",
   "sheetFinding": "2025年度官方紅葉情報名單明列本園區之銀杏；本次不宣稱已取得2026銀杏現況。",
   "lat": 35.6855,
   "lng": 139.6395,
   "posLabel": "公園中心（概略）",
   "posConf": "low",
   "posConfLabel": "概略（園區代表點）",
   "pos": "公園中心的概略位置，只有 OSM 單一座標來源。",
   "proof": "官方公園頁介紹鄰接的大宮八幡宮「神門の夫婦銀杏」（神社是公園旁的另一處設施，本站不另標示）；來源表記載：2025 年度東京都公園協會的紅葉情報名單（2025-11-04）明列本園區的銀杏；本站不宣稱已取得 2026 年的銀杏現況。",
   "proofUrl": "https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf",
   "proofDate": "2025-11-04",
   "proofFromOfficialDomain": false,
   "limit": "2025 年名單把和田堀公園與善福寺川緑地合併成一列，不能假設兩處各有獨立的觀測。",
   "season": null,
   "history": []
  },
  {
   "id": "TKG-006",
   "no": "19",
   "src": "TKG-006",
   "area": "nerima-itabashi",
   "ja": "城北中央公園",
   "zh": "城北中央公園",
   "ward": "板橋區、練馬區",
   "grade": "S",
   "operator": "公益財團法人東京都公園協會",
   "official": "https://www.tokyo-park.or.jp/park/johoku-chuo/",
   "evidenceUrl": "https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf",
   "evidenceDate": "2025-11-04",
   "audited": "2026-09-29",
   "rechecked": "2026-10-02",
   "status": "待查核",
   "species": "銀杏、櫸樹",
   "cadence": "中央整合頁2025季內每週兩次；園區個別公告頻率未承諾。",
   "sheetFinding": "2025年度官方紅葉情報名單明列本園區之銀杏；本次不宣稱已取得2026銀杏現況。",
   "lat": 35.7564,
   "lng": 139.673,
   "posLabel": "公園中心（概略）",
   "posConf": "low",
   "posConfLabel": "概略（園區代表點）",
   "pos": "公園中心的概略位置（約 26 公頃，並木位置未載明）。",
   "proof": "來源表記載：2025 年度東京都公園協會的紅葉情報名單（2025-11-04）明列本園區的銀杏；本站不宣稱已取得 2026 年的銀杏現況。",
   "proofUrl": "https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf",
   "proofDate": "2025-11-04",
   "proofFromOfficialDomain": false,
   "limit": "官方頁寫「秋にはイチョウ並木が綺麗に色付きます」，但沒有說並木在哪裡。這座公園也有櫸樹，葉況要分樹種看，不要把櫸樹套用到銀杏。",
   "season": null,
   "history": []
  },
  {
   "id": "TKG-010",
   "no": "20",
   "src": "TKG-010",
   "area": "nerima-itabashi",
   "ja": "光が丘公園",
   "zh": "光之丘公園",
   "ward": "練馬區、板橋區",
   "grade": "S",
   "operator": "公益財團法人東京都公園協會",
   "official": "https://www.tokyo-park.or.jp/park/hikarigaoka/",
   "evidenceUrl": "https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf",
   "evidenceDate": "2025-11-04",
   "audited": "2026-09-29",
   "rechecked": "2026-10-02",
   "status": "待查核",
   "species": "銀杏",
   "cadence": "中央整合頁2025季內每週兩次；園區個別公告頻率未承諾。",
   "sheetFinding": "2025年度官方紅葉情報名單明列本園區之銀杏；本次不宣稱已取得2026銀杏現況。",
   "lat": 35.7648,
   "lng": 139.6295,
   "posLabel": "観賞池與売店之間（概略）",
   "posConf": "medium",
   "posConfLabel": "中等（單一來源或由官方文字推定）",
   "pos": "觀賞池與売店之間（概略）。依官方文字與 OSM 推算，誤差約 100 公尺；官方所稱的「売店」是本站推定。",
   "proof": "官方公園頁「いちょう並木」位於公園中央（売店と観賞池の間），是移植自舊美軍住宅區 Grant Heights 的 28 棵銀杏；來源表記載：2025 年度東京都公園協會的紅葉情報名單（2025-11-04）明列本園區的銀杏；本站不宣稱已取得 2026 年的銀杏現況。",
   "proofUrl": "https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf",
   "proofDate": "2025-11-04",
   "proofFromOfficialDomain": false,
   "limit": "官方頁另有「ふれあいの径」（由舊有樂町都廳前移植的銀杏），本站只標示「いちょう並木」一處。",
   "season": null,
   "history": []
  },
  {
   "id": "TKG-004",
   "no": "21",
   "src": "TKG-004",
   "area": "tama-east",
   "ja": "小金井公園",
   "zh": "小金井公園",
   "ward": "小金井市等",
   "grade": "S",
   "operator": "公益財團法人東京都公園協會",
   "official": "https://www.tokyo-park.or.jp/park/koganei/",
   "evidenceUrl": "https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf",
   "evidenceDate": "2025-11-04",
   "audited": "2026-09-29",
   "rechecked": "2026-10-02",
   "status": "待查核",
   "species": "銀杏",
   "cadence": "中央整合頁2025季內每週兩次；園區個別公告頻率未承諾。",
   "sheetFinding": "2025年度官方紅葉情報名單明列本園區之銀杏；本次不宣稱已取得2026銀杏現況。",
   "lat": 35.7155,
   "lng": 139.5189,
   "posLabel": "公園中心（概略）",
   "posConf": "low",
   "posConfLabel": "概略（園區代表點）",
   "pos": "公園中心的概略位置（約 77 公頃）。",
   "proof": "來源表記載：2025 年度東京都公園協會的紅葉情報名單（2025-11-04）明列本園區的銀杏；本站不宣稱已取得 2026 年的銀杏現況。",
   "proofUrl": "https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf",
   "proofDate": "2025-11-04",
   "proofFromOfficialDomain": false,
   "limit": "公園橫跨多個行政區，不以服務中心的地址代表所有觀測點。官方頁只在秋季花況列出「イチョウ」，沒有指出地點。",
   "season": null,
   "history": []
  },
  {
   "id": "TKG-014",
   "no": "22",
   "src": "TKG-014",
   "area": "tama-east",
   "ja": "国営昭和記念公園",
   "zh": "國營昭和紀念公園",
   "ward": "立川市、昭島市",
   "grade": "A",
   "operator": "國營昭和記念公園官方網站",
   "official": "https://www.showakinen-koen.jp/hanadayori/",
   "evidenceUrl": "https://www.showakinen-koen.jp/hanadayori/page/3/",
   "evidenceDate": "2025-10-23至2025-12-04",
   "audited": "2026-09-29",
   "rechecked": "2026-10-02",
   "status": "待查核",
   "species": "銀杏",
   "cadence": "歷史季內約每週一篇；並非官網保證的更新頻率。",
   "sheetFinding": "歷史列表有連續多期イチョウ情報；植物指南明列イチョウ（黄葉）。",
   "lat": 35.7028,
   "lng": 139.4022,
   "posLabel": "カナール（銀杏並木沿水路）",
   "posConf": "high",
   "posConfLabel": "較精確（兩種以上來源相符）",
   "pos": "カナール（水路旁的銀杏並木）一帶。OSM 樹列與官方「立川口徒歩約1分」相符。",
   "proof": "官方「花・植物ガイド」列出イチョウ（黄葉）與兩段銀杏並木，官方花だより有 2025 年連續多期的銀杏紀錄。",
   "proofUrl": "https://www.showakinen-koen.jp/hanadayori/page/3/",
   "proofDate": "2025-10-23至2025-12-04",
   "proofFromOfficialDomain": false,
   "limit": "園內有兩段並木（カナール與かたらいのイチョウ並木）；本站只標示カナール，かたらい並木的位置未能核實，不標在地圖上。官方活動期間（2026-10-29 至 11-29）不等於最佳觀賞日。",
   "season": "官方一般時期（非本季現況）：花・植物ガイド寫「イチョウ（黄葉）10月下旬～11月下旬」。",
   "history": [
    {
     "date": "2025-10-23～2025-12-04",
     "past": true,
     "text": "官方花だより的歷史列表有連續多期的銀杏紀錄。",
     "url": "https://www.showakinen-koen.jp/hanadayori/page/3/"
    }
   ]
  },
  {
   "id": "TKG-041",
   "no": "23",
   "src": "TKG-041",
   "area": "tama-east",
   "ja": "国立 大学通り",
   "zh": "國立 大學通",
   "ward": "國立市",
   "grade": "C",
   "operator": "NPO法人國立市觀光まちづくり協會（くにたちNAVI）",
   "official": "https://kunimachi.jp/",
   "evidenceUrl": "https://kunimachi.jp/",
   "evidenceDate": "本次可見2026-09-25更新",
   "audited": "2026-09-29",
   "rechecked": "2026-10-02",
   "status": "待查核",
   "species": "銀杏專項現況待確認",
   "cadence": "銀杏更新頻率未確認。",
   "sheetFinding": "頁尾確認營運者為國立市觀光まちづくり協會；本次未確認定期銀杏葉況文章。",
   "lat": 35.6945,
   "lng": 139.4468,
   "posLabel": "国立駅南側の並木（代表點）",
   "posConf": "medium",
   "posConfLabel": "中等（單一來源或由官方文字推定）",
   "pos": "國立站南側並木的代表點。座標資料無法區分銀杏段與櫻花段，誤差可能達數百公尺。",
   "proof": "くにたちNAVI 的「大學通り」介紹頁寫「秋は…エレガントなイチョウの黄色で辺り一面が覆い尽くされます」（無日期的介紹文）。",
   "proofUrl": "https://kunimachi.jp/spot/daigakustreet/",
   "proofDate": null,
   "proofFromOfficialDomain": true,
   "limit": "大學通也有櫻花，銀杏段的起訖沒有公開標示。地方觀光網站的更新不等於銀杏的現況。",
   "season": null,
   "history": []
  },
  {
   "id": "TKG-025",
   "no": "24",
   "src": "TKG-025",
   "area": "tama-east",
   "ja": "大國魂神社",
   "zh": "大國魂神社",
   "ward": "府中市",
   "grade": "C",
   "operator": "大國魂神社",
   "official": "https://www.ookunitamajinja.or.jp/mame/",
   "evidenceUrl": "https://www.ookunitamajinja.or.jp/mame/",
   "evidenceDate": "靜態資料",
   "audited": "2026-09-29",
   "rechecked": "2026-10-02",
   "status": "待查核",
   "species": "銀杏",
   "cadence": "未確認。",
   "sheetFinding": "神社官網確認本殿後方的大銀杏；未確認定期黃葉觀測文章。",
   "lat": 35.6676,
   "lng": 139.479,
   "posLabel": "本殿・拝殿一帯（大銀杏在本殿の裏）",
   "posConf": "high",
   "posConfLabel": "較精確（兩種以上來源相符）",
   "pos": "本殿・拝殿一帶；大銀杏在其後方數十公尺內，沒有獨立座標。",
   "proof": "神社官方「豆知識」頁寫本殿後方有樹齡約 1000 年的大銀杏。",
   "proofUrl": "https://www.ookunitamajinja.or.jp/mame/",
   "proofDate": null,
   "proofFromOfficialDomain": false,
   "limit": "官方沒有銀杏的定期觀測文章。不要把附近馬場大門的櫸樹並木當作銀杏。",
   "season": null,
   "history": []
  },
  {
   "id": "TKG-016",
   "no": "25",
   "src": "TKG-016",
   "area": "tama-west",
   "ja": "八王子 甲州街道いちょう並木",
   "zh": "八王子 甲州街道銀杏大道",
   "ward": "八王子市",
   "grade": "A",
   "operator": "八王子いちょう祭り祭典委員會",
   "official": "https://www.ichou-festa.org/ichounews/",
   "evidenceUrl": "https://www.ichou-festa.org/notice/post-3629/",
   "evidenceDate": "2026-09-24（更新公告）",
   "audited": "2026-09-29",
   "rechecked": "2026-10-02",
   "status": "待查核",
   "species": "銀杏",
   "cadence": "官方明示不定期更新。",
   "sheetFinding": "黄葉情報頁可見2026-09-22拍攝日期，分中央圖書館、多摩御陵入口及觀看方向。",
   "lat": 35.652,
   "lng": 139.3004,
   "posLabel": "並木代表點（全長約4 km的中段）",
   "posConf": "high",
   "posConfLabel": "較精確（兩種以上來源相符）",
   "pos": "並木中段的代表點（追分町到高尾站之間）；官方黃葉情報的拍攝點在中央圖書館與多摩御陵入口。",
   "proof": "官方「いちょう祭りとは」介紹並木從追分町交差點到高尾駅，約 4 公里、約 770 棵。",
   "proofUrl": "https://www.ichou-festa.org/notice/post-3629/",
   "proofDate": "2026-09-24（更新公告）",
   "proofFromOfficialDomain": false,
   "limit": "官方 2026-09-22 的黃葉情報只有照片，文字沒有標示階段；2026-09-24 的公告只說高尾方向「色変わりが始まる時期」。不能只看照片日期就判定最佳觀賞期。第 47 回八王子いちょう祭り在 2026-11-21、22，祭典日期不等於葉況。",
   "season": null,
   "history": [
    {
     "date": "2026-09-22",
     "past": false,
     "text": "官方黃葉情報頁有當天拍攝的照片（中央圖書館、多摩御陵入口），文字沒有階段；本站不據此判定。",
     "url": "https://www.ichou-festa.org/ichounews/"
    }
   ]
  },
  {
   "id": "TKG-019",
   "no": "26",
   "src": "TKG-019",
   "area": "tama-west",
   "ja": "広徳寺（あきる野市）",
   "zh": "廣德寺（あきる野市）",
   "ward": "あきる野市",
   "grade": "A",
   "operator": "あきる野市觀光協會",
   "official": "https://www.akirunokanko.com/?cat=53",
   "evidenceUrl": "https://www.akirunokanko.com/?p=8712",
   "evidenceDate": "2025-11-08（發文）；2025-11-06（拍照）",
   "audited": "2026-09-29",
   "rechecked": "2026-10-02",
   "status": "待查核",
   "species": "銀杏",
   "cadence": "原文說隨時更新；2025季內有多期，非固定每週承諾。",
   "sheetFinding": "廣德寺段落明寫銀杏變色進展、尚差一些到見頃；原文另給照片拍攝日期。",
   "lat": 35.7218,
   "lng": 139.2174,
   "posLabel": "廣徳寺寺院位置",
   "posConf": "high",
   "posConfLabel": "較精確（兩種以上來源相符）",
   "pos": "寺院的位置；銀杏在寺內，與此點相差應在數十公尺內。",
   "proof": "あきる野市官方介紹寫境內有「イチョウの巨樹」（頁面更新 2021-01-22）。",
   "proofUrl": "https://www.akirunokanko.com/?p=8712",
   "proofDate": "2025-11-08（發文）；2025-11-06（拍照）",
   "proofFromOfficialDomain": false,
   "limit": "石舟橋一帶是楓樹，不能套用到廣德寺的銀杏。官方資訊的發文日與拍攝日不同。官方 2026 年的紅葉資訊尚未發布（2026-10-02 讀取時，最近一期是 2025-12-01）。",
   "season": null,
   "history": [
    {
     "date": "2025-11-08",
     "past": true,
     "text": "觀光協會發文（照片 11-06 拍攝）：「イチョウの色づきが進んで、見ごろとなるまであと少し」。",
     "url": "https://www.akirunokanko.com/?p=8712"
    }
   ]
  }
 ],
 "proposals": [
  {
   "id": "p-chiyoda",
   "area": "chiyoda",
   "name": "皇居周邊半日散步",
   "stops": [
    "TKG-011",
    "TKG-017",
    "TKG-030",
    "TKG-026"
   ],
   "tip": "皇居東御苑有固定休園日，各處的開放時間也不同，出發前請看官方連結。",
   "legs": [
    {
     "from": "TKG-011",
     "to": "TKG-017",
     "line": 1349,
     "net": 1918
    },
    {
     "from": "TKG-017",
     "to": "TKG-030",
     "line": 903,
     "net": 1218
    },
    {
     "from": "TKG-030",
     "to": "TKG-026",
     "line": 778,
     "net": 1090
    }
   ],
   "lineTotal": 3030,
   "netTotal": 4226,
   "lineMax": 1349
  },
  {
   "id": "p-ueno-hongo",
   "area": "ueno-hongo",
   "name": "上野・本鄉半日散步",
   "stops": [
    "TKG-013",
    "TKG-002",
    "TKG-040-hongo",
    "TKG-018"
   ],
   "tip": "東京大學與小石川植物園各有參觀規則與開放時間，出發前請看官方連結。",
   "legs": [
    {
     "from": "TKG-013",
     "to": "TKG-002",
     "line": 562,
     "net": 1158
    },
    {
     "from": "TKG-002",
     "to": "TKG-040-hongo",
     "line": 1065,
     "net": 1587
    },
    {
     "from": "TKG-040-hongo",
     "to": "TKG-018",
     "line": 1599,
     "net": 2096
    }
   ],
   "lineTotal": 3226,
   "netTotal": 4841,
   "lineMax": 1599
  },
  {
   "id": "p-shinjuku",
   "area": "shinjuku-shibuya",
   "name": "新宿・外苑半日散步",
   "stops": [
    "TKG-009",
    "TKG-015",
    "TKG-023"
   ],
   "tip": "新宿御苑有固定休園日與入園費；大木戶門周邊自 2026-10-06 起因施工有通行管制（官方 2026-10-01 公告）。",
   "legs": [
    {
     "from": "TKG-009",
     "to": "TKG-015",
     "line": 1892,
     "net": 2382
    },
    {
     "from": "TKG-015",
     "to": "TKG-023",
     "line": 1569,
     "net": 2245
    }
   ],
   "lineTotal": 3461,
   "netTotal": 4627,
   "lineMax": 1892
  },
  {
   "id": "p-shibuya-komaba",
   "area": "shinjuku-shibuya",
   "name": "代代木・駒場短程散步",
   "stops": [
    "TKG-012",
    "TKG-040-komaba"
   ],
   "tip": "東京大學駒場校區的參觀規則請見官方連結。這條只有兩處，適合搭配其他行程。",
   "legs": [
    {
     "from": "TKG-012",
     "to": "TKG-040-komaba",
     "line": 1619,
     "net": 2217
    }
   ],
   "lineTotal": 1619,
   "netTotal": 2217,
   "lineMax": 1619
  },
  {
   "id": "p-suginami",
   "area": "suginami",
   "name": "杉並三園散步",
   "stops": [
    "TKG-024",
    "TKG-007",
    "TKG-008"
   ],
   "tip": "善福寺川緑地是沿河的線狀公園，地圖點只是概略中心。",
   "legs": [
    {
     "from": "TKG-024",
     "to": "TKG-007",
     "line": 1096,
     "net": 1818
    },
    {
     "from": "TKG-007",
     "to": "TKG-008",
     "line": 1088,
     "net": 1430
    }
   ],
   "lineTotal": 2184,
   "netTotal": 3248,
   "lineMax": 1096
  }
 ],
 "sources": {
  "sheet": {
   "name": "課程提供的 41 列來源表（Google 試算表）",
   "role": "唯一的地點資料範圍；逐列閱讀後，把證實有銀杏的實際景點去重為 26 處。",
   "url": "https://docs.google.com/spreadsheets/d/1dx_41InyuuWuILc4ZHJW8tTZMVOCpIuSz-QzISzd7y0/edit#gid=164385659"
  },
  "official": [
   {
    "name": "東京都公園協會（東京都建設局）",
    "role": "12 處都立公園的官方園頁；紅葉情報入口與 2025 年度名單的來源。",
    "url": "https://www.tokyo-park.or.jp/"
   },
   {
    "name": "東京都公園協會 2025 年度紅葉情報公告（PDF，2025-11-04）",
    "role": "S 級景點的銀杏依據。",
    "url": "https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf"
   },
   {
    "name": "國營昭和記念公園 花だより",
    "role": "昭和記念公園的官方花況與黃葉快訊。",
    "url": "https://www.showakinen-koen.jp/hanadayori/"
   },
   {
    "name": "國民公園協會 新宿御苑 自然情報",
    "role": "新宿御苑的官方自然與季節消息。",
    "url": "https://fng.or.jp/shinjuku/news/"
   },
   {
    "name": "國民公園協會 皇居外苑・北之丸公園",
    "role": "北之丸公園的官方消息與銀杏文章。",
    "url": "https://fng.or.jp/koukyo/news/"
   },
   {
    "name": "宮內廳 皇居東御苑 花だより",
    "role": "皇居東御苑的官方植物紀錄。",
    "url": "https://www.kunaicho.go.jp/visit/higashigyoen/hanadayori/index.html"
   },
   {
    "name": "小石川植物園 開花・紅葉狀況",
    "role": "小石川植物園的官方日期文章。",
    "url": "https://koishikawa-bg.jp/kaikainfo/"
   },
   {
    "name": "八王子いちょう祭り 黃葉情報",
    "role": "甲州街道銀杏並木的官方黃葉照片與公告。",
    "url": "https://www.ichou-festa.org/ichounews/"
   },
   {
    "name": "あきる野市觀光協會 のらぼう日記",
    "role": "廣德寺等秋川溪谷的官方紅葉巡查文章。",
    "url": "https://www.akirunokanko.com/?cat=53"
   },
   {
    "name": "明治神宮外苑 いちょう並木",
    "role": "外苑銀杏並木的官方介紹。",
    "url": "https://www.meijijingugaien.jp/walk/sight/season.html"
   },
   {
    "name": "荻窪三庭園 大田黒公園",
    "role": "大田黑公園的官方公園網站。",
    "url": "https://ogikubo3gardens.jp/ootaguro/"
   },
   {
    "name": "杉並區 大田黒公園",
    "role": "杉並區官方頁，證實銀杏並木與現行官方網址。",
    "url": "https://www.city.suginami.tokyo.jp/s100/shisetsu/14632.html"
   },
   {
    "name": "大國魂神社 豆知識",
    "role": "大銀杏的官方介紹。",
    "url": "https://www.ookunitamajinja.or.jp/mame/"
   },
   {
    "name": "靖國神社",
    "role": "官方網站；銀杏並木的依據是同網站的公告。",
    "url": "https://www.yasukuni.or.jp/"
   },
   {
    "name": "東京大學 校區導覽",
    "role": "本鄉、駒場校區的官方入口與銀杏並木介紹。",
    "url": "https://www.u-tokyo.ac.jp/ja/about/campus-guide/index.html"
   },
   {
    "name": "くにたちNAVI（國立市觀光まちづくり協會）",
    "role": "國立大學通的官方觀光介紹。",
    "url": "https://kunimachi.jp/"
   }
  ],
  "portals": [
   {
    "name": "GO TOKYO（東京官方旅遊網站）秋季紅葉指南",
    "role": "官方觀光入口，只用來發現地點，不提供各景點的葉況。",
    "url": "https://www.gotokyo.org/jp/story/guide/autumn-leaves-forecast/index.html"
   },
   {
    "name": "千代田區觀光協會 景點",
    "role": "官方觀光入口，只用來查區內候選地點。",
    "url": "https://visit-chiyoda.tokyo/app/spot"
   },
   {
    "name": "新宿觀光振興協會",
    "role": "官方觀光入口，沒有銀杏日期快訊，不能取代新宿御苑的植物報告。",
    "url": "https://www.kanko-shinjuku.jp/"
   }
  ],
  "weather": [
   {
    "name": "氣象廳 いちょうの黄葉日",
    "role": "東京觀測站（標本木）黃葉日，平年值 11/23（1991–2020）；用於季節說明。",
    "url": "https://www.data.jma.go.jp/sakura/data/phn_012.html"
   },
   {
    "name": "氣象廳 いちょうの落葉日",
    "role": "東京觀測站落葉日，平年值 12/3；用於季節說明。",
    "url": "https://www.data.jma.go.jp/sakura/data/phn_013.html"
   },
   {
    "name": "氣象廳 生物季節累年值",
    "role": "歷年資料下載入口；本站只引用其中的平年值，沒有下載檔案。",
    "url": "https://www.data.jma.go.jp/sakura/data/download_ruinenchi.html"
   }
  ],
  "thirdParty": [
   {
    "name": "tenki.jp 東京都紅葉情報",
    "role": "第三方彙整的葉況；多樹種混合，本站不引用其葉況。",
    "url": "https://tenki.jp/kouyou/3/16/"
   },
   {
    "name": "Weathernews 東京都紅葉情報",
    "role": "民間氣象平台；本站不引用其預報或回報。",
    "url": "https://weathernews.jp/koyo/area/tokyo/"
   },
   {
    "name": "WalkerPlus 東京 黃色に色づく",
    "role": "第三方景點目錄，含其他黃葉樹種；本站不引用。",
    "url": "https://koyo.walkerplus.com/yellow/ar0313/"
   },
   {
    "name": "Jorudan 東京都紅葉情報",
    "role": "第三方景點與見頃資訊；只當查漏的參考，本站不引用。",
    "url": "https://sp.jorudan.co.jp/leaf/tokyo.html"
   },
   {
    "name": "日本氣象株式會社 紅葉・黃葉見頃預想",
    "role": "民間預報產品（不是氣象廳）；本站不引用其預測。",
    "url": "https://n-kishou.com/corp/news-contents/autumn/"
   }
  ],
  "excluded": [
   {
    "name": "神代植物公園",
    "reason": "2025 年中央名單記錄的是楓樹，不是銀杏，所以不列為景點。",
    "url": "https://www.tokyo-park.or.jp/park/jindai/"
   },
   {
    "name": "府中市鄉土之森博物館 花ごよみ",
    "reason": "讀到的內容不足以證實銀杏，所以不列為景點。",
    "url": "https://www.fuchu-cpf.or.jp/museum/hanagoyomi/index.html"
   },
   {
    "name": "東京都公園協會 2025 年紅葉季舊專頁",
    "reason": "官方網址目前回傳 404（已失效），不提供連結。",
    "url": null
   },
   {
    "name": "箱根植木（大田黑公園的舊管理公司）",
    "reason": "管理期到 2024 年 3 月結束，只保留排除理由，不提供連結。",
    "url": null
   }
  ],
  "maps": {
   "osm": {
    "name": "OpenStreetMap",
    "url": "https://www.openstreetmap.org/copyright",
    "note": "© OpenStreetMap contributors（ODbL）"
   },
   "osrm": {
    "name": "FOSSGIS OSRM 步行路由",
    "url": "https://routing.openstreetmap.de/"
   },
   "google": {
    "name": "Google Maps URLs 說明",
    "url": "https://developers.google.com/maps/documentation/urls/get-started"
   }
  }
 }
};
