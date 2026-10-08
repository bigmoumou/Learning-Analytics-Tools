/* 景點資料：由來源整理表與各管理單位官方頁面整理而成。
   stage 為 null 表示沒有找到與景點、樹種及日期相符的可靠資料，不指派階段。 */
window.GINKGO_DATA = {
 "meta": {
  "sheetUrl": "https://docs.google.com/spreadsheets/d/1dx_41InyuuWuILc4ZHJW8tTZMVOCpIuSz-QzISzd7y0/edit?usp=sharing",
  "sheetAudit": "2026-09-29",
  "inventory": "2026-10-02",
  "built": "2026-10-08"
 },
 "areas": [
  {
   "id": "chiyoda",
   "label": "千代田・港"
  },
  {
   "id": "shinjuku",
   "label": "新宿・澀谷・目黑"
  },
  {
   "id": "east",
   "label": "台東・文京・江東"
  },
  {
   "id": "northwest",
   "label": "練馬・板橋・杉並"
  },
  {
   "id": "tama",
   "label": "多摩中部"
  },
  {
   "id": "tamawest",
   "label": "多摩西部"
  }
 ],
 "spots": [
  {
   "id": "TKG-011",
   "zh": "日比谷公園",
   "ja": "日比谷公園",
   "wards": "千代田區",
   "area": "chiyoda",
   "summary": "園內有官方介紹的「首賭けイチョウ」，官方標示推定樹齡 400～500 年。",
   "keywords": "首賭けイチョウ 松本楼 本多静六 Hibiya",
   "officialUrl": "https://www.tokyo-park.or.jp/park/hibiya/",
   "records": [
    {
     "cat": "entry",
     "title": "東京都公園協會｜日比谷公園",
     "url": "https://www.tokyo-park.or.jp/park/hibiya/",
     "desc": "官方園區介紹頁，其中「首賭けイチョウ」一節介紹園內最大的銀杏；頁面沒有 2026 年的銀杏葉況。",
     "dates": [
      {
       "k": "inv",
       "v": "2026-10-02"
      }
     ],
     "leaf": false
    },
    {
     "cat": "history",
     "title": "東京都公園協會｜2025 年度紅葉情報名單",
     "url": "https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf",
     "desc": "2025 年度名單把本園的紅葉樹種寫為「イチョウ」。名單只列樹種，沒有階段，也不是 2026 年的現況。",
     "dates": [
      {
       "k": "pub",
       "v": "2025-11-04"
      },
      {
       "k": "inv",
       "v": "2026-10-02"
      }
     ],
     "leaf": false
    }
   ],
   "notices": [
    {
     "t": "公園正在進行再生整備工程，大噴水、噴水廣場與小音樂堂周邊等部分區域目前不能進入。",
     "k": "inv",
     "v": "2026-10-02",
     "u": "https://www.tokyo-park.or.jp/park/hibiya/"
    }
   ],
   "sheetId": "TKG-011",
   "pos": {
    "lat": 35.6737,
    "lng": 139.7559,
    "kind": "sub",
    "label": "園內子地點：首賭けイチョウ（概略）",
    "approx": false,
    "confidence": "medium",
    "note": "座標依 OpenStreetMap 的導覽牌位置推定，精度約 ±50～100 m。官方英文園內地圖有標示這棵樹，但本站沒有取得它的座標。",
    "coordId": "TKG-011-kubikake",
    "src": [
     {
      "t": "OpenStreetMap node 5500138998",
      "u": "https://www.openstreetmap.org/node/5500138998"
     },
     {
      "t": "OpenStreetMap node 469818509",
      "u": "https://www.openstreetmap.org/node/469818509"
     },
     {
      "t": "官方頁面",
      "u": "https://www.tokyo-park.or.jp/park/hibiya/"
     }
    ]
   },
   "cautions": [],
   "events": [],
   "statusNote": "",
   "stage": null
  },
  {
   "id": "TKG-017",
   "zh": "皇居東御苑",
   "ja": "皇居東御苑",
   "wards": "千代田區",
   "area": "chiyoda",
   "summary": "官方往年的花だより曾拍到「百人番所前のイチョウ」。",
   "keywords": "百人番所 宮內廳 花だより",
   "officialUrl": "https://www.kunaicho.go.jp/visit/higashigyoen/hanadayori/index.html",
   "records": [
    {
     "cat": "entry",
     "title": "宮內廳｜皇居東御苑 花だより",
     "url": "https://www.kunaicho.go.jp/visit/higashigyoen/hanadayori/index.html",
     "desc": "宮內廳每週的園內自然消息。盤點時最新一期（2026-09-18）沒有提到銀杏。",
     "dates": [
      {
       "k": "inv",
       "v": "2026-10-02"
      }
     ],
     "leaf": false
    },
    {
     "cat": "history",
     "title": "宮內廳｜花だより 2025-11-28",
     "url": "https://www.kunaicho.go.jp/visit/higashigyoen/hanadayori/20251128.html",
     "desc": "往年紀錄：苑內各處的銀杏與楓類等落葉樹正在變色，照片說明為「百人番所前のイチョウ」。文中是全園的描述，沒有為銀杏單獨指定階段。",
     "dates": [
      {
       "k": "pub",
       "v": "2025-11-28"
      },
      {
       "k": "inv",
       "v": "2026-10-02"
      }
     ],
     "leaf": true
    }
   ],
   "cautions": [
    "皇居東御苑不是皇居外苑，也不是北之丸公園，三處的資料來源各自獨立。"
   ],
   "sheetId": "TKG-017",
   "pos": {
    "lat": 35.6857,
    "lng": 139.7581,
    "kind": "sub",
    "label": "園內子地點：百人番所前（概略）",
    "approx": false,
    "confidence": "medium",
    "note": "此點是百人番所的建築位置；官方照片標示銀杏在建築前方，實際樹位相差約數十公尺。座標僅有 OpenStreetMap 來源。",
    "coordId": "TKG-017-hyakunin",
    "src": [
     {
      "t": "OpenStreetMap way 176109786",
      "u": "https://www.openstreetmap.org/way/176109786"
     },
     {
      "t": "OpenStreetMap node 5833843701",
      "u": "https://www.openstreetmap.org/node/5833843701"
     },
     {
      "t": "OpenStreetMap node 5247182004",
      "u": "https://www.openstreetmap.org/node/5247182004"
     },
     {
      "t": "官方頁面",
      "u": "https://www.kunaicho.go.jp/visit/higashigyoen/hanadayori/20251128.html"
     }
    ]
   },
   "events": [],
   "notices": [],
   "statusNote": "",
   "stage": null
  },
  {
   "id": "TKG-030",
   "zh": "北之丸公園",
   "ja": "北の丸公園",
   "wards": "千代田區",
   "area": "chiyoda",
   "summary": "日本武道館前有官方稱為「大イチョウ」的銀杏；本站只收北之丸公園，不含皇居外苑。",
   "keywords": "日本武道館 大イチョウ 皇居外苑 国民公園協会",
   "officialUrl": "https://fng.or.jp/koukyo/news/",
   "records": [
    {
     "cat": "entry",
     "title": "國民公園協會｜皇居外苑・北之丸公園 消息",
     "url": "https://fng.or.jp/koukyo/news/",
     "desc": "官方消息列表。盤點時 2026 年的文章還沒有銀杏專項消息。",
     "dates": [
      {
       "k": "inv",
       "v": "2026-10-02"
      }
     ],
     "leaf": false
    },
    {
     "cat": "history",
     "title": "國民公園協會｜北之丸公園的紅葉 2023-11-24",
     "url": "https://fng.or.jp/koukyo/2023/11/24/kitanomarukouennnokouyou/",
     "desc": "往年紀錄：日本武道館前有「大イチョウ」，文中寫「見ごろは12月上旬」。這是 2023 年的預估說法，不是今年的現況。",
     "dates": [
      {
       "k": "pub",
       "v": "2023-11-24"
      },
      {
       "k": "inv",
       "v": "2026-10-02"
      }
     ],
     "leaf": true
    },
    {
     "cat": "history",
     "title": "國民公園協會｜北之丸公園 2024-11-13",
     "url": "https://fng.or.jp/koukyo/2024/11/13/irodukukitanomarukouen/",
     "desc": "往年紀錄：園內的銀杏「色づき始めたばかり」。",
     "dates": [
      {
       "k": "pub",
       "v": "2024-11-13"
      },
      {
       "k": "inv",
       "v": "2026-10-02"
      }
     ],
     "leaf": true
    }
   ],
   "cautions": [
    "皇居外苑（行幸通り一帶）的銀杏在官方頁面中沒有找到，本站不收；皇居東御苑則是另一處。"
   ],
   "sheetId": "TKG-030",
   "pos": {
    "lat": 35.6915,
    "lng": 139.7511,
    "kind": "park",
    "label": "園區代表點（近似位置）",
    "approx": true,
    "confidence": "low",
    "note": "北之丸公園整體的代表點。官方文章說大イチョウ在日本武道館前，但沒有給座標，本站不自行推算。",
    "coordId": "TKG-030-kitanomaru",
    "src": [
     {
      "t": "OpenStreetMap relation 3551876",
      "u": "https://www.openstreetmap.org/relation/3551876"
     },
     {
      "t": "OpenStreetMap way 624081603",
      "u": "https://www.openstreetmap.org/way/624081603"
     },
     {
      "t": "Wikipedia",
      "u": "https://ja.wikipedia.org/wiki/%E5%8C%97%E3%81%AE%E4%B8%B8%E5%85%AC%E5%9C%92"
     },
     {
      "t": "Weathernews 景點座標",
      "u": "https://weathernews.jp/s/koyo/spot/24452/"
     }
    ]
   },
   "events": [],
   "notices": [],
   "statusNote": "",
   "stage": null
  },
  {
   "id": "TKG-026",
   "zh": "靖國神社",
   "ja": "靖國神社",
   "wards": "千代田區",
   "area": "chiyoda",
   "summary": "官方公告提到参道的銀杏並木；確切位置與葉況官方都沒有載明。",
   "keywords": "参道 九段 Yasukuni",
   "officialUrl": "https://www.yasukuni.or.jp/",
   "records": [
    {
     "cat": "entry",
     "title": "靖國神社｜官方網站",
     "url": "https://www.yasukuni.or.jp/",
     "desc": "官方公告與影像的入口。盤點時沒有可當作銀杏葉況的日期紀錄。",
     "dates": [
      {
       "k": "inv",
       "v": "2026-10-02"
      }
     ],
     "leaf": false
    },
    {
     "cat": "entry",
     "title": "靖國神社｜秋季限定朱印公告（令和 5 年 9 月 6 日）",
     "url": "https://www.yasukuni.or.jp/news_detail.html?id=492",
     "desc": "官方公告提到「参道のイチョウ並木」，是本站確認此處有銀杏的官方依據；公告不含葉況。",
     "dates": [
      {
       "k": "pub",
       "v": "2023-09-06"
      },
      {
       "k": "inv",
       "v": "2026-10-02"
      }
     ],
     "leaf": false
    },
    {
     "cat": "unverified",
     "title": "銀杏的位置、數量與見頃時期",
     "url": "https://www.yasukuni.or.jp/schedule/photo.html",
     "desc": "官方網站沒有說明銀杏並木的確切範圍、棵數與見頃時期。2026-09-15 的秋季宣傳影片沒有標示拍攝日，不能當作葉況。",
     "dates": [
      {
       "k": "inv",
       "v": "2026-10-02"
      }
     ],
     "leaf": false
    }
   ],
   "cautions": [
    "境內是祭祀場所，參拜與拍攝請遵守現場規範。"
   ],
   "sheetId": "TKG-026",
   "pos": {
    "lat": 35.6941,
    "lng": 139.7431,
    "kind": "site",
    "label": "境內主要區域（拝殿）",
    "approx": false,
    "confidence": "high",
    "note": "此點是拝殿位置，不代表銀杏並木的位置；並木的確切範圍尚未核實。",
    "coordId": "TKG-026",
    "src": [
     {
      "t": "OpenStreetMap way 144379616",
      "u": "https://www.openstreetmap.org/way/144379616"
     },
     {
      "t": "OpenStreetMap way 144379617",
      "u": "https://www.openstreetmap.org/way/144379617"
     },
     {
      "t": "Wikipedia",
      "u": "https://ja.wikipedia.org/wiki/%E9%9D%96%E5%9B%BD%E7%A5%9E%E7%A4%BE"
     },
     {
      "t": "Jorudan 景點頁",
      "u": "https://sp.jorudan.co.jp/leaf/spot_J0200.html"
     }
    ]
   },
   "events": [],
   "notices": [],
   "statusNote": "",
   "stage": null
  },
  {
   "id": "TKG-005",
   "zh": "芝公園",
   "ja": "芝公園",
   "wards": "港區",
   "area": "chiyoda",
   "summary": "歷史悠久的環狀公園，官方只寫園內各處有イチョウ等大木。",
   "keywords": "もみじ谷 増上寺 Shiba",
   "officialUrl": "https://www.tokyo-park.or.jp/park/siba/",
   "records": [
    {
     "cat": "entry",
     "title": "東京都公園協會｜芝公園",
     "url": "https://www.tokyo-park.or.jp/park/siba/",
     "desc": "官方園區介紹頁，寫園內「クスノキ、ケヤキ、イチョウなどの大木がところどころにあります」，沒有具體地點。",
     "dates": [
      {
       "k": "inv",
       "v": "2026-10-02"
      }
     ],
     "leaf": false
    },
    {
     "cat": "history",
     "title": "東京都公園協會｜2025 年度紅葉情報名單",
     "url": "https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf",
     "desc": "2025 年度名單把本園的紅葉樹種寫為「モミジ・イチョウ」。名單只列樹種，沒有階段，也不是 2026 年的現況。",
     "dates": [
      {
       "k": "pub",
       "v": "2025-11-04"
      },
      {
       "k": "inv",
       "v": "2026-10-02"
      }
     ],
     "leaf": false
    },
    {
     "cat": "third",
     "title": "WalkerPlus｜芝公園頁",
     "url": "https://koyo.walkerplus.com/detail/ar0313e154517/",
     "desc": "第三方整合網站，頁面有「色づき」狀態，來源標示為 JR システム。來源整理表記錄的頁面日期是 2026-09-28（日期類型來源未載）。該站不分樹種，本站不採用它的階段。",
     "dates": [
      {
       "k": "inv",
       "v": "2026-09-29"
      }
     ],
     "leaf": true
    }
   ],
   "cautions": [
    "官方網址是 siba，不是 shiba。「もみじ谷」是楓樹，不要和銀杏混在一起。"
   ],
   "sheetId": "TKG-005",
   "pos": {
    "lat": 35.6555,
    "lng": 139.748,
    "kind": "park",
    "label": "園區代表點（近似位置）",
    "approx": true,
    "confidence": "low",
    "note": "環狀公園整體的代表點。官方頁面沒有銀杏的具體地點，所以不能指到單一銀杏；「もみじ谷」是楓樹區，不是銀杏，沒有標在地圖上。",
    "coordId": "TKG-005",
    "src": [
     {
      "t": "OpenStreetMap way 745301114",
      "u": "https://www.openstreetmap.org/way/745301114"
     },
     {
      "t": "OpenStreetMap relation 18180831",
      "u": "https://www.openstreetmap.org/relation/18180831"
     },
     {
      "t": "Wikipedia",
      "u": "https://ja.wikipedia.org/wiki/%E8%8A%9D%E5%85%AC%E5%9C%92"
     },
     {
      "t": "Weathernews 景點座標",
      "u": "https://weathernews.jp/s/koyo/spot/24414/"
     }
    ]
   },
   "events": [],
   "notices": [],
   "statusNote": "",
   "stage": null
  },
  {
   "id": "TKG-015",
   "zh": "新宿御苑",
   "ja": "新宿御苑",
   "wards": "新宿區・澀谷區",
   "area": "shinjuku",
   "summary": "官方往年文章提到園內各處的銀杏滿園轉黃，大溫室附近是熱門拍攝處。",
   "keywords": "大温室 国民公園協会 環境省 Shinjuku Gyoen",
   "officialUrl": "https://fng.or.jp/shinjuku/news/",
   "records": [
    {
     "cat": "entry",
     "title": "國民公園協會｜新宿御苑 自然情報",
     "url": "https://fng.or.jp/shinjuku/news/",
     "desc": "官方的季節消息列表。盤點時最新幾篇（2026-09-25 至 10-01）都不是銀杏消息，「紅葉」分類最新一篇仍是 2025 年。",
     "dates": [
      {
       "k": "inv",
       "v": "2026-10-02"
      }
     ],
     "leaf": false
    },
    {
     "cat": "history",
     "title": "國民公園協會｜新宿御苑 季節みどころ 2025-11-28",
     "url": "https://fng.or.jp/shinjuku/2025/11/28/20251128_03/",
     "desc": "往年紀錄：文章寫園內各處的銀杏正值見頃，大溫室附近是人氣拍攝處。這是一年前的紀錄，不能當作今年的現況。",
     "dates": [
      {
       "k": "pub",
       "v": "2025-11-28"
      },
      {
       "k": "inv",
       "v": "2026-10-02"
      }
     ],
     "leaf": true
    }
   ],
   "notices": [
    {
     "t": "大木戶門周邊自 2026-10-06 起至 11 月下旬（預定）施工，通行受限。",
     "k": "pub",
     "v": "2026-10-01",
     "u": "https://fng.or.jp/shinjuku/2026/10/01/20261001-01/"
    }
   ],
   "sheetId": "TKG-015",
   "pos": {
    "lat": 35.6867,
    "lng": 139.7126,
    "kind": "sub",
    "label": "園內子地點：大溫室附近（概略）",
    "approx": false,
    "confidence": "medium",
    "note": "官方文章稱銀杏在「溫室附近」，此點是大溫室的建築位置，實際樹位可能相差數十公尺。座標僅有 OpenStreetMap 來源。",
    "coordId": "TKG-015-greenhouse",
    "src": [
     {
      "t": "OpenStreetMap way 228926578",
      "u": "https://www.openstreetmap.org/way/228926578"
     },
     {
      "t": "OpenStreetMap node 2375692281",
      "u": "https://www.openstreetmap.org/node/2375692281"
     },
     {
      "t": "官方頁面",
      "u": "https://fng.or.jp/shinjuku/2025/11/28/20251128_03/"
     }
    ]
   },
   "cautions": [],
   "events": [],
   "statusNote": "",
   "stage": null
  },
  {
   "id": "TKG-023",
   "zh": "明治神宮外苑 銀杏並木",
   "ja": "明治神宮外苑 いちょう並木",
   "wards": "新宿區",
   "area": "shinjuku",
   "summary": "從青山口通往聖德紀念繪畫館的四列銀杏並木，官方介紹全長約 300 m。",
   "keywords": "聖徳記念絵画館 青山口 円周道路 Gaien",
   "officialUrl": "https://www.meijijingugaien.jp/walk/sight/season.html",
   "records": [
    {
     "cat": "entry",
     "title": "明治神宮外苑｜いちょう並木",
     "url": "https://www.meijijingugaien.jp/walk/sight/season.html",
     "desc": "官方的景點介紹頁。頁內的樹齡與棵數（青山口至圓周道路約 300 m、146 棵）是歷史數字，不保證今年的現況；沒有逐日葉況。",
     "dates": [
      {
       "k": "inv",
       "v": "2026-10-02"
      }
     ],
     "leaf": false
    },
    {
     "cat": "history",
     "title": "明治神宮外苑｜外苑便り 2022-11-17",
     "url": "https://www.meijijingugaien.jp/gaien-news/",
     "desc": "往年紀錄：外苑便り寫「イチョウ並木が見頃です」。這是已知最近的官方銀杏文章，距今已多年；外苑便り列表在盤點時最新一篇是 2024 年。",
     "dates": [
      {
       "k": "pub",
       "v": "2022-11-17"
      },
      {
       "k": "inv",
       "v": "2026-10-02"
      }
     ],
     "leaf": true
    },
    {
     "cat": "third",
     "title": "tenki.jp｜東京都 紅葉情報",
     "url": "https://tenki.jp/kouyou/3/16/",
     "desc": "第三方整合網站的東京都列表有列出明治外苑（來源整理表記錄 2026-09-29）。該站混合多種樹種，本站不採用它的階段。",
     "dates": [
      {
       "k": "inv",
       "v": "2026-09-29"
      }
     ],
     "leaf": false
    }
   ],
   "cautions": [
    "這裡是外苑的銀杏並木，不是明治神宮內苑。"
   ],
   "sheetId": "TKG-023",
   "pos": {
    "lat": 35.6739,
    "lng": 139.7199,
    "kind": "avenue",
    "label": "並木中點",
    "approx": false,
    "confidence": "high",
    "note": "青山口到圓周道路之間約 300 m 並木的中點；OpenStreetMap、Weathernews 與 Jorudan 三個座標來源相差 150 m 以內。",
    "coordId": "TKG-023",
    "src": [
     {
      "t": "OpenStreetMap way 499552710",
      "u": "https://www.openstreetmap.org/way/499552710"
     },
     {
      "t": "Weathernews 景點座標",
      "u": "https://weathernews.jp/s/koyo/spot/24408/"
     },
     {
      "t": "Jorudan 景點頁",
      "u": "https://sp.jorudan.co.jp/leaf/spot_55006.html"
     }
    ]
   },
   "events": [],
   "notices": [],
   "statusNote": "",
   "stage": null
  },
  {
   "id": "TKG-009",
   "zh": "戶山公園",
   "ja": "戸山公園",
   "wards": "新宿區",
   "area": "shinjuku",
   "summary": "分成箱根山與大久保兩個地區的公園，官方只列イチョウ，未指明地點。",
   "keywords": "箱根山 大久保 Toyama",
   "officialUrl": "https://www.tokyo-park.or.jp/park/toyama/",
   "records": [
    {
     "cat": "entry",
     "title": "東京都公園協會｜戶山公園",
     "url": "https://www.tokyo-park.or.jp/park/toyama/",
     "desc": "官方園區介紹頁。秋季賞花資訊列有イチョウ，沒有地點與日期。",
     "dates": [
      {
       "k": "inv",
       "v": "2026-10-02"
      }
     ],
     "leaf": false
    },
    {
     "cat": "history",
     "title": "東京都公園協會｜2025 年度紅葉情報名單",
     "url": "https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf",
     "desc": "2025 年度名單把本園的紅葉樹種寫為「モミジ・イチョウ」。名單只列樹種，沒有階段，也不是 2026 年的現況。",
     "dates": [
      {
       "k": "pub",
       "v": "2025-11-04"
      },
      {
       "k": "inv",
       "v": "2026-10-02"
      }
     ],
     "leaf": false
    }
   ],
   "cautions": [
    "園內同時有楓樹，葉況須按樹種分開看，不能把楓樹的狀況套用到銀杏。"
   ],
   "sheetId": "TKG-009",
   "pos": {
    "lat": 35.7037,
    "lng": 139.7135,
    "kind": "park",
    "label": "園區代表點（近似位置）",
    "approx": true,
    "confidence": "low",
    "note": "此點在東側的戶山（箱根山）地區；西側另有大久保地區，兩處都沒有官方指出的銀杏位置。",
    "coordId": "TKG-009",
    "src": [
     {
      "t": "OpenStreetMap way 209465552",
      "u": "https://www.openstreetmap.org/way/209465552"
     },
     {
      "t": "Wikipedia",
      "u": "https://ja.wikipedia.org/wiki/%E7%AE%B1%E6%A0%B9%E5%B1%B1_(%E6%96%B0%E5%AE%BF%E5%8C%BA)"
     },
     {
      "t": "Weathernews 景點座標",
      "u": "https://weathernews.jp/s/koyo/spot/24462/"
     }
    ]
   },
   "events": [],
   "notices": [],
   "statusNote": "",
   "stage": null
  },
  {
   "id": "TKG-012",
   "zh": "代代木公園",
   "ja": "代々木公園",
   "wards": "澀谷區",
   "area": "shinjuku",
   "summary": "大型森林公園，官方只列秋季有イチョウ，未指明地點。",
   "keywords": "代々木 Yoyogi",
   "officialUrl": "https://www.tokyo-park.or.jp/park/yoyogi/",
   "records": [
    {
     "cat": "entry",
     "title": "東京都公園協會｜代代木公園",
     "url": "https://www.tokyo-park.or.jp/park/yoyogi/",
     "desc": "官方園區介紹頁。秋季賞花資訊列有イチョウ，沒有地點與日期。",
     "dates": [
      {
       "k": "inv",
       "v": "2026-10-02"
      }
     ],
     "leaf": false
    },
    {
     "cat": "history",
     "title": "東京都公園協會｜2025 年度紅葉情報名單",
     "url": "https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf",
     "desc": "2025 年度名單把本園的紅葉樹種寫為「イチョウ」。名單只列樹種，沒有階段，也不是 2026 年的現況。",
     "dates": [
      {
       "k": "pub",
       "v": "2025-11-04"
      },
      {
       "k": "inv",
       "v": "2026-10-02"
      }
     ],
     "leaf": false
    }
   ],
   "sheetId": "TKG-012",
   "pos": {
    "lat": 35.6717,
    "lng": 139.6965,
    "kind": "park",
    "label": "園區代表點（近似位置）",
    "approx": true,
    "confidence": "low",
    "note": "公園整體的代表點；官方頁面沒有銀杏的具體地點。",
    "coordId": "TKG-012",
    "src": [
     {
      "t": "OpenStreetMap relation 19862716",
      "u": "https://www.openstreetmap.org/relation/19862716"
     },
     {
      "t": "Wikipedia",
      "u": "https://ja.wikipedia.org/wiki/%E4%BB%A3%E3%80%85%E6%9C%A8%E5%85%AC%E5%9C%92"
     },
     {
      "t": "Weathernews 景點座標",
      "u": "https://weathernews.jp/s/koyo/spot/24409/"
     }
    ]
   },
   "cautions": [],
   "events": [],
   "notices": [],
   "statusNote": "",
   "stage": null
  },
  {
   "id": "TKG-040K",
   "sheetId": "TKG-040",
   "zh": "東京大學駒場校區 銀杏並木",
   "ja": "東京大学 駒場キャンパス 銀杏並木",
   "wards": "目黑區",
   "area": "shinjuku",
   "summary": "駒場校區主要道路旁的銀杏並木，東京大學官方文章有介紹。",
   "keywords": "駒場 東大 Komaba UTokyo 1号館",
   "officialUrl": "https://www.u-tokyo.ac.jp/ja/about/campus-guide/index.html",
   "records": [
    {
     "cat": "entry",
     "title": "東京大學｜校區導覽",
     "url": "https://www.u-tokyo.ac.jp/ja/about/campus-guide/index.html",
     "desc": "官方的校區地圖與參觀規則入口，頁面沒有逐日的銀杏葉況。",
     "dates": [
      {
       "k": "inv",
       "v": "2026-10-02"
      }
     ],
     "leaf": false
    },
    {
     "cat": "entry",
     "title": "東京大學（kimino.ct.u-tokyo.ac.jp）｜駒場校區介紹",
     "url": "https://kimino.ct.u-tokyo.ac.jp/kotohajime/komaba-campus/",
     "desc": "東京大學的官方網站（u-tokyo.ac.jp 網域）寫「秋には銀杏並木がメインストリートを黄色に染め上げる」，是本站確認此處有銀杏並木的依據；不含當季葉況。",
     "dates": [
      {
       "k": "inv",
       "v": "2026-10-02"
      }
     ],
     "leaf": false
    },
    {
     "cat": "unverified",
     "title": "並木的確切位置",
     "url": "https://www.u-tokyo.ac.jp/focus/ja/features/z1304_00053.html",
     "desc": "官方文章描述並木在西側道路往北的方向，沒有給座標；本站的位置是依文字與 OpenStreetMap 樹列推定，尚未核實。",
     "dates": [
      {
       "k": "inv",
       "v": "2026-10-02"
      }
     ],
     "leaf": false
    }
   ],
   "cautions": [
    "並木在 1 號館北側的東西向道路，不是「正門到 1 號館」那條軸線。",
    "本鄉校區、駒場校區與小石川植物園是三個不同的地點。校園有參觀規則，請先看官方說明。"
   ],
   "pos": {
    "lat": 35.6604,
    "lng": 139.6852,
    "kind": "avenue",
    "label": "並木中段（推定位置）",
    "approx": false,
    "confidence": "medium",
    "note": "依東京大學官方文章的描述（1 號館北側的東西向道路）與 OpenStreetMap 樹列推定，精度約 ±80 m；OpenStreetMap 的樹木沒有樹種標籤。",
    "coordId": "TKG-040-komaba",
    "src": [
     {
      "t": "OpenStreetMap way 695889364",
      "u": "https://www.openstreetmap.org/way/695889364"
     },
     {
      "t": "OpenStreetMap node 2332994271",
      "u": "https://www.openstreetmap.org/node/2332994271"
     },
     {
      "t": "Wikipedia",
      "u": "https://ja.wikipedia.org/wiki/%E6%9D%B1%E4%BA%AC%E5%A4%A7%E5%AD%A6%E9%A7%92%E5%A0%B4%E5%9C%B0%E5%8C%BA%E3%82%AD%E3%83%A3%E3%83%B3%E3%83%91%E3%82%B9"
     },
     {
      "t": "官方頁面",
      "u": "https://www.u-tokyo.ac.jp/focus/ja/features/z1304_00053.html"
     }
    ]
   },
   "events": [],
   "notices": [],
   "statusNote": "",
   "stage": null
  },
  {
   "id": "TKG-002",
   "zh": "上野恩賜公園",
   "ja": "上野恩賜公園",
   "wards": "台東區",
   "area": "east",
   "summary": "台地上的大型都立公園，銀杏的位置官方頁面沒有載明。",
   "keywords": "不忍池 Ueno",
   "officialUrl": "https://www.tokyo-park.or.jp/park/ueno/",
   "records": [
    {
     "cat": "entry",
     "title": "東京都公園協會｜上野恩賜公園",
     "url": "https://www.tokyo-park.or.jp/park/ueno/",
     "desc": "官方園區介紹頁。頁面沒有出現銀杏或紅葉的文字。",
     "dates": [
      {
       "k": "inv",
       "v": "2026-10-02"
      }
     ],
     "leaf": false
    },
    {
     "cat": "unverified",
     "title": "銀杏資格尚未獨立核對",
     "url": "https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf",
     "desc": "本園的官方頁面沒有提到銀杏。本站把它列入，是因為來源整理表引用了 2025 年度紅葉情報名單；盤點時未能獨立核對名單內容，園內哪裡有銀杏也沒有官方說明。",
     "dates": [
      {
       "k": "pub",
       "v": "2025-11-04"
      },
      {
       "k": "inv",
       "v": "2026-10-02"
      }
     ],
     "leaf": false
    }
   ],
   "sheetId": "TKG-002",
   "pos": {
    "lat": 35.713,
    "lng": 139.7724,
    "kind": "park",
    "label": "園區代表點（近似位置）",
    "approx": true,
    "confidence": "low",
    "note": "公園整體的代表點（取各來源座標平均）。沒有來源指出銀杏的確切位置，所以這個點只代表公園，不代表任何一棵樹。",
    "coordId": "TKG-002",
    "src": [
     {
      "t": "OpenStreetMap relation 5413419",
      "u": "https://www.openstreetmap.org/relation/5413419"
     },
     {
      "t": "Wikipedia",
      "u": "https://ja.wikipedia.org/wiki/%E4%B8%8A%E9%87%8E%E6%81%A9%E8%B3%9C%E5%85%AC%E5%9C%92"
     },
     {
      "t": "Weathernews 景點座標",
      "u": "https://weathernews.jp/s/koyo/spot/24412/"
     }
    ]
   },
   "cautions": [],
   "events": [],
   "notices": [],
   "statusNote": "",
   "stage": null
  },
  {
   "id": "TKG-003",
   "zh": "木場公園",
   "ja": "木場公園",
   "wards": "江東區",
   "area": "east",
   "summary": "被木場公園大橋分成南北兩側的都立公園，銀杏的位置官方頁面沒有載明。",
   "keywords": "Kiba",
   "officialUrl": "https://www.tokyo-park.or.jp/park/kiba/",
   "records": [
    {
     "cat": "entry",
     "title": "東京都公園協會｜木場公園",
     "url": "https://www.tokyo-park.or.jp/park/kiba/",
     "desc": "官方園區介紹頁。秋季賞花資訊列的是キンモクセイ等，沒有イチョウ。",
     "dates": [
      {
       "k": "inv",
       "v": "2026-10-02"
      }
     ],
     "leaf": false
    },
    {
     "cat": "unverified",
     "title": "銀杏資格尚未獨立核對",
     "url": "https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf",
     "desc": "本園的官方頁面沒有提到銀杏。本站把它列入，是因為來源整理表引用了 2025 年度紅葉情報名單；盤點時未能獨立核對名單內容，園內哪裡有銀杏也沒有官方說明。",
     "dates": [
      {
       "k": "pub",
       "v": "2025-11-04"
      },
      {
       "k": "inv",
       "v": "2026-10-02"
      }
     ],
     "leaf": false
    }
   ],
   "sheetId": "TKG-003",
   "pos": {
    "lat": 35.6752,
    "lng": 139.8085,
    "kind": "park",
    "label": "園區代表點（近似位置）",
    "approx": true,
    "confidence": "low",
    "note": "公園被木場公園大橋分成南北兩半，座標取平均後落在中間；銀杏位置未載明。",
    "coordId": "TKG-003",
    "src": [
     {
      "t": "OpenStreetMap relation 14273608",
      "u": "https://www.openstreetmap.org/relation/14273608"
     },
     {
      "t": "OpenStreetMap way 845051284",
      "u": "https://www.openstreetmap.org/way/845051284"
     },
     {
      "t": "Wikipedia",
      "u": "https://ja.wikipedia.org/wiki/%E6%9C%A8%E5%A0%B4%E5%85%AC%E5%9C%92"
     }
    ]
   },
   "cautions": [],
   "events": [],
   "notices": [],
   "statusNote": "",
   "stage": null
  },
  {
   "id": "TKG-013",
   "zh": "舊岩崎邸庭園",
   "ja": "旧岩崎邸庭園",
   "wards": "台東區",
   "area": "east",
   "summary": "國指定重要文化財的庭園，官方頁面列有イチョウ，未指明位置。",
   "keywords": "岩崎久彌 Iwasaki",
   "officialUrl": "https://www.tokyo-park.or.jp/park/kyu-iwasaki-tei/",
   "records": [
    {
     "cat": "entry",
     "title": "東京都公園協會｜舊岩崎邸庭園",
     "url": "https://www.tokyo-park.or.jp/park/kyu-iwasaki-tei/",
     "desc": "官方園區介紹頁。秋季賞花資訊列有イチョウ與モミジ，沒有地點；頁面沒有 2026 年的葉況。",
     "dates": [
      {
       "k": "inv",
       "v": "2026-10-02"
      }
     ],
     "leaf": false
    },
    {
     "cat": "history",
     "title": "東京都公園協會｜2025 年度紅葉情報名單",
     "url": "https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf",
     "desc": "2025 年度名單把本園的紅葉樹種寫為「イチョウ」。名單只列樹種，沒有階段，也不是 2026 年的現況。",
     "dates": [
      {
       "k": "pub",
       "v": "2025-11-04"
      },
      {
       "k": "inv",
       "v": "2026-10-02"
      }
     ],
     "leaf": false
    }
   ],
   "events": [
    {
     "t": "都立 9 庭園「紅葉めぐりスタンプラリー」",
     "d": "2026-10-10 至 2026-12-06",
     "u": "https://www.tokyo-park.or.jp/special/9gardens_stamp/index.html"
    },
    {
     "t": "園內活動「秋空の下で楽しむ旧岩崎邸庭園」",
     "d": "2026-10-18 至 2026-11-29",
     "u": "https://www.tokyo-park.or.jp/park/kyu-iwasaki-tei/"
    }
   ],
   "sheetId": "TKG-013",
   "pos": {
    "lat": 35.7092,
    "lng": 139.7683,
    "kind": "gate",
    "label": "庭園正門（入口）",
    "approx": false,
    "confidence": "high",
    "note": "庭園正門的位置；OpenStreetMap 正門節點與 Weathernews 座標相距約 50 m，兩者一致。",
    "coordId": "TKG-013",
    "src": [
     {
      "t": "OpenStreetMap node 4653514711",
      "u": "https://www.openstreetmap.org/node/4653514711"
     },
     {
      "t": "Weathernews 景點座標",
      "u": "https://weathernews.jp/s/koyo/spot/24457/"
     }
    ]
   },
   "cautions": [],
   "notices": [],
   "statusNote": "",
   "stage": null
  },
  {
   "id": "TKG-018",
   "zh": "小石川植物園",
   "ja": "小石川植物園",
   "wards": "文京區",
   "area": "east",
   "summary": "園內有植物學史上知名的「精子発見のイチョウ」，官方往年曾列入紅葉植物清單。",
   "keywords": "精子発見のイチョウ 東京大学附属植物園 Koishikawa",
   "officialUrl": "https://koishikawa-bg.jp/kaikainfo/",
   "records": [
    {
     "cat": "entry",
     "title": "小石川植物園｜開花・紅葉狀況",
     "url": "https://koishikawa-bg.jp/kaikainfo/",
     "desc": "官方的開花與紅葉日期文章列表。盤點時 2026-09 至 10-01 的文章都沒有提到イチョウ。",
     "dates": [
      {
       "k": "inv",
       "v": "2026-10-02"
      }
     ],
     "leaf": false
    },
    {
     "cat": "history",
     "title": "小石川植物園｜開花・紅葉狀況 2025-11-19",
     "url": "https://koishikawa-bg.jp/kaika/5013/",
     "desc": "往年紀錄：文章把イチョウ列在「正在紅葉、黃葉」的植物之中，沒有寫見頃。日期取自來源整理表，頁面本文沒有顯示日期。",
     "dates": [
      {
       "k": "pub",
       "v": "2025-11-19",
       "t": "2025-11-19（取自來源整理表）"
      },
      {
       "k": "inv",
       "v": "2026-10-02"
      }
     ],
     "leaf": true
    }
   ],
   "cautions": [
    "小石川植物園不是小石川後樂園。看到黃葉不等於已經是見頃。"
   ],
   "sheetId": "TKG-018",
   "pos": {
    "lat": 35.7202,
    "lng": 139.7452,
    "kind": "sub",
    "label": "園內子地點：精子発見のイチョウ（概略）",
    "approx": false,
    "confidence": "medium",
    "note": "園內名木「精子発見のイチョウ」的位置，座標僅有 OpenStreetMap 樹木節點一種來源。",
    "coordId": "TKG-018-sperm",
    "src": [
     {
      "t": "OpenStreetMap node 4683343152",
      "u": "https://www.openstreetmap.org/node/4683343152"
     },
     {
      "t": "官方頁面",
      "u": "https://koishikawa-bg.jp/kaika/5013/"
     }
    ]
   },
   "events": [],
   "notices": [],
   "statusNote": "",
   "stage": null
  },
  {
   "id": "TKG-040H",
   "sheetId": "TKG-040",
   "zh": "東京大學本鄉校區 銀杏並木",
   "ja": "東京大学 本郷キャンパス 銀杏並木",
   "wards": "文京區",
   "area": "east",
   "summary": "正門通往安田講堂的銀杏並木，東京大學官方校園導覽有介紹。",
   "keywords": "本郷 東大 安田講堂 正門 Hongo UTokyo",
   "officialUrl": "https://www.u-tokyo.ac.jp/ja/about/campus-guide/index.html",
   "records": [
    {
     "cat": "entry",
     "title": "東京大學｜校區導覽",
     "url": "https://www.u-tokyo.ac.jp/ja/about/campus-guide/index.html",
     "desc": "官方的校區地圖與參觀規則入口，頁面沒有逐日的銀杏葉況。",
     "dates": [
      {
       "k": "inv",
       "v": "2026-10-02"
      }
     ],
     "leaf": false
    },
    {
     "cat": "entry",
     "title": "東京大學｜校區導覽「1km of campus」",
     "url": "https://www.u-tokyo.ac.jp/ja/about/campus-guide/1km_of_campus.html",
     "desc": "官方導覽寫到「本郷キャンパスの銀杏並木」，是本站確認此處有銀杏並木的依據；不含當季葉況。",
     "dates": [
      {
       "k": "inv",
       "v": "2026-10-02"
      }
     ],
     "leaf": false
    }
   ],
   "cautions": [
    "本鄉校區、駒場校區與小石川植物園是三個不同的地點。校園有參觀規則，請先看官方說明。"
   ],
   "pos": {
    "lat": 35.7131,
    "lng": 139.7606,
    "kind": "avenue",
    "label": "並木中點",
    "approx": false,
    "confidence": "high",
    "note": "正門到安田講堂之間「銀杏並木」的中點；OpenStreetMap 有名為「銀杏並木」的步道，位置與正門、安田講堂吻合。",
    "coordId": "TKG-040-hongo",
    "src": [
     {
      "t": "OpenStreetMap way 33050411",
      "u": "https://www.openstreetmap.org/way/33050411"
     },
     {
      "t": "OpenStreetMap way 643102413",
      "u": "https://www.openstreetmap.org/way/643102413"
     },
     {
      "t": "Wikipedia",
      "u": "https://ja.wikipedia.org/wiki/%E6%9D%B1%E4%BA%AC%E5%A4%A7%E5%AD%A6"
     }
    ]
   },
   "events": [],
   "notices": [],
   "statusNote": "",
   "stage": null
  },
  {
   "id": "TKG-010",
   "zh": "光之丘公園",
   "ja": "光が丘公園",
   "wards": "練馬區・板橋區",
   "area": "northwest",
   "summary": "公園中央（売店與觀賞池之間）有官方介紹的「いちょう並木」。",
   "keywords": "いちょう並木 ふれあいの径 Hikarigaoka",
   "officialUrl": "https://www.tokyo-park.or.jp/park/hikarigaoka/",
   "records": [
    {
     "cat": "entry",
     "title": "東京都公園協會｜光之丘公園",
     "url": "https://www.tokyo-park.or.jp/park/hikarigaoka/",
     "desc": "官方園區介紹頁，介紹園內的「いちょう並木」與「ふれあいの径」兩處銀杏；頁面沒有 2026 年的葉況。",
     "dates": [
      {
       "k": "inv",
       "v": "2026-10-02"
      }
     ],
     "leaf": false
    },
    {
     "cat": "history",
     "title": "東京都公園協會｜2025 年度紅葉情報名單",
     "url": "https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf",
     "desc": "2025 年度名單把本園的紅葉樹種寫為「イチョウ」。名單只列樹種，沒有階段，也不是 2026 年的現況。",
     "dates": [
      {
       "k": "pub",
       "v": "2025-11-04"
      },
      {
       "k": "inv",
       "v": "2026-10-02"
      }
     ],
     "leaf": false
    }
   ],
   "cautions": [
    "「ふれあいの径」的銀杏位置官方沒有給座標，本站只標示「いちょう並木」。"
   ],
   "sheetId": "TKG-010",
   "pos": {
    "lat": 35.7648,
    "lng": 139.6295,
    "kind": "sub",
    "label": "園內子地點：いちょう並木（概略）",
    "approx": false,
    "confidence": "medium",
    "note": "官方描述並木在公園中央、売店與觀賞池之間；座標依官方文字與 OpenStreetMap 的池塘位置推定，精度約 ±100 m。",
    "coordId": "TKG-010-ichounamiki",
    "src": [
     {
      "t": "OpenStreetMap way 57018838",
      "u": "https://www.openstreetmap.org/way/57018838"
     },
     {
      "t": "OpenStreetMap way 57404792",
      "u": "https://www.openstreetmap.org/way/57404792"
     },
     {
      "t": "官方頁面",
      "u": "https://www.tokyo-park.or.jp/park/hikarigaoka/"
     }
    ]
   },
   "events": [],
   "notices": [],
   "statusNote": "",
   "stage": null
  },
  {
   "id": "TKG-006",
   "zh": "城北中央公園",
   "ja": "城北中央公園",
   "wards": "板橋區・練馬區",
   "area": "northwest",
   "summary": "官方說秋天有イチョウ並木，但沒有寫並木的位置。",
   "keywords": "Johoku 石神井川",
   "officialUrl": "https://www.tokyo-park.or.jp/park/johoku-chuo/",
   "records": [
    {
     "cat": "entry",
     "title": "東京都公園協會｜城北中央公園",
     "url": "https://www.tokyo-park.or.jp/park/johoku-chuo/",
     "desc": "官方園區介紹頁，寫「秋にはイチョウ並木が綺麗に色付きます」，沒有日期；頁面沒有 2026 年的葉況。",
     "dates": [
      {
       "k": "inv",
       "v": "2026-10-02"
      }
     ],
     "leaf": false
    },
    {
     "cat": "history",
     "title": "東京都公園協會｜2025 年度紅葉情報名單",
     "url": "https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf",
     "desc": "2025 年度名單把本園的紅葉樹種寫為「イチョウ・ケヤキ」。名單只列樹種，沒有階段，也不是 2026 年的現況。",
     "dates": [
      {
       "k": "pub",
       "v": "2025-11-04"
      },
      {
       "k": "inv",
       "v": "2026-10-02"
      }
     ],
     "leaf": false
    }
   ],
   "cautions": [
    "園內同時有櫸樹，葉況須按樹種分開看，不能把櫸樹的狀況套用到銀杏。"
   ],
   "sheetId": "TKG-006",
   "pos": {
    "lat": 35.7564,
    "lng": 139.673,
    "kind": "park",
    "label": "園區代表點（近似位置）",
    "approx": true,
    "confidence": "low",
    "note": "公園整體的代表點；官方只在照片說明寫「イチョウ並木_正門」，並木的確切位置未核實。",
    "coordId": "TKG-006",
    "src": [
     {
      "t": "OpenStreetMap relation 17981647",
      "u": "https://www.openstreetmap.org/relation/17981647"
     },
     {
      "t": "Wikipedia",
      "u": "https://ja.wikipedia.org/wiki/%E5%9F%8E%E5%8C%97%E4%B8%AD%E5%A4%AE%E5%85%AC%E5%9C%92"
     },
     {
      "t": "Weathernews 景點座標",
      "u": "https://weathernews.jp/s/koyo/spot/24482/"
     },
     {
      "t": "Jorudan 景點頁",
      "u": "https://sp.jorudan.co.jp/leaf/spot_J0226.html"
     }
    ]
   },
   "events": [],
   "notices": [],
   "statusNote": "",
   "stage": null
  },
  {
   "id": "TKG-007",
   "zh": "善福寺川綠地",
   "ja": "善福寺川緑地",
   "wards": "杉並區",
   "area": "northwest",
   "summary": "沿善福寺川的線狀綠地，官方提到秋季銀杏等樹種轉色，未指明地點。",
   "keywords": "Zempukuji 和田堀",
   "officialUrl": "https://www.tokyo-park.or.jp/park/zempukujigawa-ryokuchi/index.html",
   "records": [
    {
     "cat": "entry",
     "title": "東京都公園協會｜善福寺川綠地",
     "url": "https://www.tokyo-park.or.jp/park/zempukujigawa-ryokuchi/index.html",
     "desc": "官方園區介紹頁，寫秋季ケヤキ、イチョウ、トウカエデ等會轉為鮮豔紅葉，沒有地點與日期。",
     "dates": [
      {
       "k": "inv",
       "v": "2026-10-02"
      }
     ],
     "leaf": false
    },
    {
     "cat": "history",
     "title": "東京都公園協會｜2025 年度紅葉情報名單",
     "url": "https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf",
     "desc": "2025 年度名單把本園的紅葉樹種寫為「イチョウ（與和田堀公園合併為一列）」。名單只列樹種，沒有階段，也不是 2026 年的現況。",
     "dates": [
      {
       "k": "pub",
       "v": "2025-11-04"
      },
      {
       "k": "inv",
       "v": "2026-10-02"
      }
     ],
     "leaf": false
    }
   ],
   "cautions": [
    "2025 年度名單把善福寺川綠地與和田堀公園合成一列，不能假設兩處各有獨立的觀測。"
   ],
   "sheetId": "TKG-007",
   "pos": {
    "lat": 35.692,
    "lng": 139.6305,
    "kind": "park",
    "label": "園區代表點（近似位置）",
    "approx": true,
    "confidence": "low",
    "note": "沿河的線狀公園，點位只是概略位置；兩個座標來源相距約 450 m，銀杏地點未載明。",
    "coordId": "TKG-007",
    "src": [
     {
      "t": "OpenStreetMap relation 17376005",
      "u": "https://www.openstreetmap.org/relation/17376005"
     },
     {
      "t": "Weathernews 景點座標",
      "u": "https://weathernews.jp/s/koyo/spot/24444/"
     }
    ]
   },
   "events": [],
   "notices": [],
   "statusNote": "",
   "stage": null
  },
  {
   "id": "TKG-008",
   "zh": "和田堀公園",
   "ja": "和田堀公園",
   "wards": "杉並區",
   "area": "northwest",
   "summary": "與善福寺川綠地相連；官方頁面介紹鄰接的大宮八幡宮神門前的夫婦銀杏。",
   "keywords": "大宮八幡宮 夫婦銀杏 Wadabori",
   "officialUrl": "https://www.tokyo-park.or.jp/park/wadabori/",
   "records": [
    {
     "cat": "entry",
     "title": "東京都公園協會｜和田堀公園",
     "url": "https://www.tokyo-park.or.jp/park/wadabori/",
     "desc": "官方園區介紹頁，寫鄰接的大宮八幡宮「黄色く色づいた神門の夫婦銀杏は見もの」（沒有日期，是景色的描述）。",
     "dates": [
      {
       "k": "inv",
       "v": "2026-10-02"
      }
     ],
     "leaf": false
    },
    {
     "cat": "history",
     "title": "東京都公園協會｜2025 年度紅葉情報名單",
     "url": "https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf",
     "desc": "2025 年度名單把本園的紅葉樹種寫為「イチョウ（與善福寺川綠地合併為一列）」。名單只列樹種，沒有階段，也不是 2026 年的現況。",
     "dates": [
      {
       "k": "pub",
       "v": "2025-11-04"
      },
      {
       "k": "inv",
       "v": "2026-10-02"
      }
     ],
     "leaf": false
    }
   ],
   "cautions": [
    "夫婦銀杏在鄰接的大宮八幡宮，是公園旁的另一處設施。"
   ],
   "sheetId": "TKG-008",
   "pos": {
    "lat": 35.6855,
    "lng": 139.6395,
    "kind": "park",
    "label": "園區代表點（近似位置）",
    "approx": true,
    "confidence": "low",
    "note": "公園整體的代表點，座標只有 OpenStreetMap 一種來源。官方頁面提到的「神門の夫婦銀杏」在鄰接的大宮八幡宮，不在這個點上。",
    "coordId": "TKG-008",
    "src": [
     {
      "t": "OpenStreetMap relation 3974046",
      "u": "https://www.openstreetmap.org/relation/3974046"
     },
     {
      "t": "OpenStreetMap way 40294887",
      "u": "https://www.openstreetmap.org/way/40294887"
     },
     {
      "t": "OpenStreetMap way 577458755",
      "u": "https://www.openstreetmap.org/way/577458755"
     }
    ]
   },
   "events": [],
   "notices": [],
   "statusNote": "",
   "stage": null
  },
  {
   "id": "TKG-024",
   "zh": "大田黑公園",
   "ja": "大田黒公園",
   "wards": "杉並區",
   "area": "northwest",
   "summary": "從正門延伸的銀杏並木，官方稱樹齡超過一百年。",
   "keywords": "荻窪三庭園 荻窪 Otaguro",
   "officialUrl": "https://ogikubo3gardens.jp/ootaguro/",
   "records": [
    {
     "cat": "entry",
     "title": "荻窪三庭園｜大田黑公園",
     "url": "https://ogikubo3gardens.jp/ootaguro/",
     "desc": "公園官方網站，寫「樹齢百年を超えるイチョウ並木」。盤點時最新消息（2026-09-24）沒有葉況。",
     "dates": [
      {
       "k": "inv",
       "v": "2026-10-02"
      }
     ],
     "leaf": false
    },
    {
     "cat": "entry",
     "title": "杉並區｜大田黑公園",
     "url": "https://www.city.suginami.tokyo.jp/s100/shisetsu/14632.html",
     "desc": "杉並區公所的設施頁，寫正門進去的園路左右是樹齡約百年的大イチョウ並木；頁面更新日 2025-09-09。",
     "dates": [
      {
       "k": "pub",
       "v": "2025-09-09",
       "t": "2025-09-09（頁面更新日）"
      },
      {
       "k": "inv",
       "v": "2026-10-02"
      }
     ],
     "leaf": false
    },
    {
     "cat": "third",
     "title": "tenki.jp｜東京都 紅葉情報",
     "url": "https://tenki.jp/kouyou/3/16/",
     "desc": "第三方整合網站的東京都列表有列出大田黑公園（來源整理表記錄 2026-09-29）。該站混合多種樹種，本站不採用它的階段。",
     "dates": [
      {
       "k": "inv",
       "v": "2026-09-29"
      }
     ],
     "leaf": false
    }
   ],
   "sheetId": "TKG-024",
   "pos": {
    "lat": 35.7007,
    "lng": 139.6248,
    "kind": "site",
    "label": "公園位置",
    "approx": false,
    "confidence": "high",
    "note": "整座公園不大，以公園位置為標示；OpenStreetMap、Wikipedia 與 Weathernews 三個座標相差 40 m 以內。",
    "coordId": "TKG-024",
    "src": [
     {
      "t": "OpenStreetMap way 100013319",
      "u": "https://www.openstreetmap.org/way/100013319"
     },
     {
      "t": "Wikipedia",
      "u": "https://ja.wikipedia.org/wiki/%E5%A4%A7%E7%94%B0%E9%BB%92%E5%85%AC%E5%9C%92"
     },
     {
      "t": "Weathernews 景點座標",
      "u": "https://weathernews.jp/s/koyo/spot/24458/"
     }
    ]
   },
   "cautions": [],
   "events": [],
   "notices": [],
   "statusNote": "",
   "stage": null
  },
  {
   "id": "TKG-004",
   "zh": "小金井公園",
   "ja": "小金井公園",
   "wards": "小金井市・小平市等",
   "area": "tama",
   "summary": "沿玉川上水的大型公園，官方頁面只列秋季有イチョウ，未指明地點。",
   "keywords": "玉川上水 江戸東京たてもの園 Koganei",
   "officialUrl": "https://www.tokyo-park.or.jp/park/koganei/",
   "records": [
    {
     "cat": "entry",
     "title": "東京都公園協會｜小金井公園",
     "url": "https://www.tokyo-park.or.jp/park/koganei/",
     "desc": "官方園區介紹頁。秋季賞花資訊列有イチョウ，沒有地點與日期。",
     "dates": [
      {
       "k": "inv",
       "v": "2026-10-02"
      }
     ],
     "leaf": false
    },
    {
     "cat": "history",
     "title": "東京都公園協會｜2025 年度紅葉情報名單",
     "url": "https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf",
     "desc": "2025 年度名單把本園的紅葉樹種寫為「イチョウ」。名單只列樹種，沒有階段，也不是 2026 年的現況。",
     "dates": [
      {
       "k": "pub",
       "v": "2025-11-04"
      },
      {
       "k": "inv",
       "v": "2026-10-02"
      }
     ],
     "leaf": false
    }
   ],
   "sheetId": "TKG-004",
   "pos": {
    "lat": 35.7155,
    "lng": 139.5189,
    "kind": "park",
    "label": "園區代表點（近似位置）",
    "approx": true,
    "confidence": "low",
    "note": "公園整體的代表點；公園橫跨小金井市、小平市、西東京市與武藏野市，官方頁面沒有銀杏的具體地點。",
    "coordId": "TKG-004",
    "src": [
     {
      "t": "OpenStreetMap way 591077391",
      "u": "https://www.openstreetmap.org/way/591077391"
     },
     {
      "t": "Wikipedia",
      "u": "https://ja.wikipedia.org/wiki/%E5%B0%8F%E9%87%91%E4%BA%95%E5%85%AC%E5%9C%92"
     },
     {
      "t": "Weathernews 景點座標",
      "u": "https://weathernews.jp/s/koyo/spot/24403/"
     },
     {
      "t": "Jorudan 景點頁",
      "u": "https://sp.jorudan.co.jp/leaf/spot_J0039.html"
     }
    ]
   },
   "cautions": [],
   "events": [],
   "notices": [],
   "statusNote": "",
   "stage": null
  },
  {
   "id": "TKG-014",
   "zh": "國營昭和紀念公園",
   "ja": "国営昭和記念公園",
   "wards": "立川市・昭島市",
   "area": "tama",
   "summary": "以カナール的銀杏並木聞名，官方另有「かたらいのイチョウ並木」。",
   "keywords": "カナール かたらいのイチョウ並木 花だより Showa Kinen",
   "officialUrl": "https://www.showakinen-koen.jp/hanadayori/",
   "records": [
    {
     "cat": "entry",
     "title": "國營昭和記念公園｜花だより",
     "url": "https://www.showakinen-koen.jp/hanadayori/",
     "desc": "官方每週的花況消息。盤點時最新一期（2026-10-01）沒有銀杏；官方植物指南寫「イチョウ（黄葉）10月下旬～11月下旬」，那是常年說明，不是今年的觀測。",
     "dates": [
      {
       "k": "inv",
       "v": "2026-10-02"
      }
     ],
     "leaf": false
    },
    {
     "cat": "history",
     "title": "國營昭和記念公園｜花だより 2025 年多期",
     "url": "https://www.showakinen-koen.jp/hanadayori/page/3/",
     "desc": "往年紀錄：2025 年的花だより有連續多期提到イチョウ（日期範圍取自來源整理表）。列表頁的位置會隨新文章增加而改變，不是固定的存檔網址。",
     "dates": [
      {
       "k": "pub",
       "v": "2025-12-04",
       "t": "2025-10-23 至 2025-12-04（多期）"
      },
      {
       "k": "inv",
       "v": "2026-10-02"
      }
     ],
     "leaf": true
    },
    {
     "cat": "unverified",
     "title": "かたらいのイチョウ並木的位置",
     "url": "https://www.showakinen-koen.jp/flower-information/",
     "desc": "官方說這條並木長約 300 m，但本站沒有核實到它的位置（誤差約 ±400 m），因此沒有標在地圖上，只在文字提及。",
     "dates": [
      {
       "k": "inv",
       "v": "2026-10-02"
      }
     ],
     "leaf": false
    }
   ],
   "events": [
    {
     "t": "黃葉・紅葉まつり＆秋の夜散歩2026（點燈）",
     "d": "2026-10-29 至 2026-11-29",
     "u": "https://www.showakinen-koen.jp/autumn-night-walk/"
    }
   ],
   "cautions": [
    "カナール與かたらいのイチョウ並木是兩處不同的並木，葉況要分開看。"
   ],
   "sheetId": "TKG-014",
   "pos": {
    "lat": 35.7028,
    "lng": 139.4022,
    "kind": "sub",
    "label": "園內子地點：カナール（銀杏並木）",
    "approx": false,
    "confidence": "high",
    "note": "三個 OpenStreetMap 物件互相一致，且與官方「立川口徒步約 1 分」的描述相符。",
    "coordId": "TKG-014-canal",
    "src": [
     {
      "t": "OpenStreetMap way 1455348813",
      "u": "https://www.openstreetmap.org/way/1455348813"
     },
     {
      "t": "OpenStreetMap way 1455348814",
      "u": "https://www.openstreetmap.org/way/1455348814"
     },
     {
      "t": "OpenStreetMap way 766598267",
      "u": "https://www.openstreetmap.org/way/766598267"
     },
     {
      "t": "官方頁面",
      "u": "https://www.showakinen-koen.jp/facility/facility-305/"
     }
    ]
   },
   "notices": [],
   "statusNote": "",
   "stage": null
  },
  {
   "id": "TKG-025",
   "zh": "大國魂神社",
   "ja": "大國魂神社",
   "wards": "府中市",
   "area": "tama",
   "summary": "本殿後方有傳說樹齡約 1000 年的大銀杏。",
   "keywords": "府中 大銀杏 Okunitama",
   "officialUrl": "https://www.ookunitamajinja.or.jp/mame/",
   "records": [
    {
     "cat": "entry",
     "title": "大國魂神社｜豆知識（大銀杏）",
     "url": "https://www.ookunitamajinja.or.jp/mame/",
     "desc": "官方網站寫本殿後方有傳說樹齡約 1000 年的大銀杏。盤點時沒有找到黃葉觀測文章。",
     "dates": [
      {
       "k": "inv",
       "v": "2026-10-02"
      }
     ],
     "leaf": false
    }
   ],
   "cautions": [
    "參道旁馬場大門的並木是櫸樹，不是銀杏。"
   ],
   "sheetId": "TKG-025",
   "pos": {
    "lat": 35.6676,
    "lng": 139.479,
    "kind": "site",
    "label": "本殿・拝殿一帶",
    "approx": false,
    "confidence": "high",
    "note": "官方稱大銀杏在本殿後方（南側），它沒有獨立座標，實際樹位在此點後方數十公尺內。",
    "coordId": "TKG-025",
    "src": [
     {
      "t": "OpenStreetMap way 172007556",
      "u": "https://www.openstreetmap.org/way/172007556"
     },
     {
      "t": "Wikipedia",
      "u": "https://ja.wikipedia.org/wiki/%E5%A4%A7%E5%9C%8B%E9%AD%82%E7%A5%9E%E7%A4%BE"
     },
     {
      "t": "OpenStreetMap way 443035348",
      "u": "https://www.openstreetmap.org/way/443035348"
     },
     {
      "t": "官方頁面",
      "u": "https://www.ookunitamajinja.or.jp/mame/"
     }
    ]
   },
   "events": [],
   "notices": [],
   "statusNote": "",
   "stage": null
  },
  {
   "id": "TKG-041",
   "zh": "國立 大學通",
   "ja": "国立 大学通り",
   "wards": "國立市",
   "area": "tama",
   "summary": "國立站南口筆直延伸的大學通，官方介紹秋天被銀杏的黃色覆蓋。",
   "keywords": "くにたちNAVI 大学通り 国立駅 Kunitachi",
   "officialUrl": "https://kunimachi.jp/spot/daigakustreet/",
   "records": [
    {
     "cat": "entry",
     "title": "くにたちNAVI｜大学通り",
     "url": "https://kunimachi.jp/spot/daigakustreet/",
     "desc": "國立市觀光まちづくり協會的景點頁，寫秋天「エレガントなイチョウの黄色で辺り一面が覆い尽くされます」（沒有日期，是景色的描述）。",
     "dates": [
      {
       "k": "inv",
       "v": "2026-10-02"
      }
     ],
     "leaf": false
    },
    {
     "cat": "third",
     "title": "Jorudan｜國立 大学通り",
     "url": "https://sp.jorudan.co.jp/leaf/spot_J0193.html",
     "desc": "第三方網站的景點頁（頁面更新日 2026-08-18），寫的是歷年通常的見頃「11月下旬」，不是今年的觀測。來源整理表記錄日 2026-09-29。",
     "dates": [
      {
       "k": "pub",
       "v": "2026-08-18",
       "t": "2026-08-18（頁面更新日）"
      },
      {
       "k": "inv",
       "v": "2026-09-29"
      }
     ],
     "leaf": false
    },
    {
     "cat": "unverified",
     "title": "銀杏段的起訖",
     "url": "https://kunimachi.jp/spot/daigakustreet/",
     "desc": "官方介紹沒有標出銀杏段的起訖與棵數，同一條街也有櫻花，本站不自行劃定。",
     "dates": [
      {
       "k": "inv",
       "v": "2026-10-02"
      }
     ],
     "leaf": false
    }
   ],
   "cautions": [
    "大學通同時有櫻花與銀杏，葉況要按樹種看。"
   ],
   "sheetId": "TKG-041",
   "pos": {
    "lat": 35.6945,
    "lng": 139.4468,
    "kind": "avenue",
    "label": "並木代表點（國立站南側）",
    "approx": false,
    "confidence": "medium",
    "note": "國立站南口前大學通並木的代表點（OpenStreetMap 樹列約 1.2 km）。樹列沒有樹種標籤，無法與同一條街的櫻樹區分。",
    "coordId": "TKG-041",
    "src": [
     {
      "t": "Jorudan 景點頁",
      "u": "https://sp.jorudan.co.jp/leaf/spot_J0193.html"
     },
     {
      "t": "OpenStreetMap way 1158057700",
      "u": "https://www.openstreetmap.org/way/1158057700"
     },
     {
      "t": "Wikipedia",
      "u": "https://ja.wikipedia.org/wiki/%E5%9B%BD%E7%AB%8B%E9%A7%85"
     }
    ]
   },
   "events": [],
   "notices": [],
   "statusNote": "",
   "stage": null
  },
  {
   "id": "TKG-016",
   "zh": "八王子 甲州街道銀杏並木",
   "ja": "八王子 甲州街道いちょう並木",
   "wards": "八王子市",
   "area": "tamawest",
   "summary": "甲州街道約 4 km 的銀杏並木；官方有 2026 年的黃葉情報照片，但沒有標示階段。",
   "keywords": "八王子いちょう祭り 追分町 高尾 多摩御陵 中央図書館 Hachioji",
   "officialUrl": "https://www.ichou-festa.org/ichounews/",
   "statusNote": "官方黃葉情報頁有 2026-09-22 拍攝的照片，但文字沒有寫階段；本站不從照片判斷，所以仍不指派階段。",
   "records": [
    {
     "cat": "entry",
     "title": "八王子いちょう祭り｜官方網站",
     "url": "https://www.ichou-festa.org/",
     "desc": "祭典委員會的官方網站，介紹並木與祭典。官方說並木約 4 km、約 770 棵。",
     "dates": [
      {
       "k": "inv",
       "v": "2026-10-02"
      }
     ],
     "leaf": false
    },
    {
     "cat": "notice",
     "title": "八王子いちょう祭り｜黄葉情報",
     "url": "https://www.ichou-festa.org/ichounews/",
     "desc": "本季的官方黃葉情報：頁面有 5 張照片，拍攝日都是 2026-09-22（八王子市中央図書館與多摩御陵入口交差點，兩個方向，另有一張銀杏果實）。文字沒有寫任何階段。",
     "dates": [
      {
       "k": "shot",
       "v": "2026-09-22"
      },
      {
       "k": "inv",
       "v": "2026-10-02"
      }
     ],
     "leaf": true
    },
    {
     "cat": "notice",
     "title": "八王子いちょう祭り｜お知らせ（2026-09-24）",
     "url": "https://www.ichou-festa.org/notice/post-3629/",
     "desc": "公告說已進入從高尾方向開始變色的時期，並預告會不定期更新黃葉情報。這是季節性說明，不是階段判定，也不是見頃。",
     "dates": [
      {
       "k": "pub",
       "v": "2026-09-24"
      },
      {
       "k": "inv",
       "v": "2026-10-02"
      }
     ],
     "leaf": true
    }
   ],
   "events": [
    {
     "t": "第 47 回八王子いちょう祭り",
     "d": "2026-11-21（六）・11-22（日）",
     "u": "https://www.ichou-festa.org/event"
    }
   ],
   "cautions": [
    "祭典日期是活動日期，不是見頃日。照片的拍攝日不等於現況。"
   ],
   "sheetId": "TKG-016",
   "pos": {
    "lat": 35.652,
    "lng": 139.3004,
    "kind": "avenue",
    "label": "並木中段代表點",
    "approx": false,
    "confidence": "high",
    "note": "追分町到高尾站附近之間的代表點，全長約 4 km，單點只供總覽。官方黃葉情報的兩個拍攝地點是八王子市中央圖書館與多摩御陵入口交差點。",
    "coordId": "TKG-016",
    "src": [
     {
      "t": "Weathernews 景點座標",
      "u": "https://weathernews.jp/s/koyo/spot/24433/"
     },
     {
      "t": "官方頁面",
      "u": "https://www.ichou-festa.org/ichounews/"
     }
    ]
   },
   "notices": [],
   "stage": null
  },
  {
   "id": "TKG-019",
   "zh": "廣德寺（あきる野）",
   "ja": "広徳寺（あきる野市）",
   "wards": "あきる野市",
   "area": "tamawest",
   "summary": "秋川溪谷的古剎，寺內有銀杏巨樹，觀光協會往年有追蹤色づき。",
   "keywords": "秋川渓谷 小和田 秋留野 Kotokuji Akiruno",
   "officialUrl": "https://www.city.akiruno.tokyo.jp/0000001442.html",
   "records": [
    {
     "cat": "entry",
     "title": "あきる野市｜あきる野百景「広徳寺」",
     "url": "https://www.city.akiruno.tokyo.jp/0000001442.html",
     "desc": "市公所的官方介紹頁，提到寺內有「イチョウの巨樹」；頁面更新日 2021-01-22。",
     "dates": [
      {
       "k": "pub",
       "v": "2021-01-22",
       "t": "2021-01-22（頁面更新日）"
      },
      {
       "k": "inv",
       "v": "2026-10-02"
      }
     ],
     "leaf": false
    },
    {
     "cat": "history",
     "title": "あきる野市觀光協會｜秋川渓谷紅葉情報 2025-11-08",
     "url": "https://www.akirunokanko.com/?p=8712",
     "desc": "往年紀錄：廣徳寺的銀杏「色づきが進んで、見ごろとなるまであと少し」。文章發布於 2025-11-08，照片拍攝於 2025-11-06。",
     "dates": [
      {
       "k": "pub",
       "v": "2025-11-08"
      },
      {
       "k": "shot",
       "v": "2025-11-06"
      },
      {
       "k": "inv",
       "v": "2026-10-02"
      }
     ],
     "leaf": true
    },
    {
     "cat": "third",
     "title": "tenki.jp｜東京都 紅葉情報",
     "url": "https://tenki.jp/kouyou/3/16/",
     "desc": "第三方整合網站的東京都列表有列出廣徳寺（來源整理表記錄 2026-09-29）。該站混合多種樹種，本站不採用它的階段。",
     "dates": [
      {
       "k": "inv",
       "v": "2026-09-29"
      }
     ],
     "leaf": false
    }
   ],
   "cautions": [
    "同篇文章中石舟橋一帶是楓樹，不能套用到廣徳寺的銀杏。"
   ],
   "sheetId": "TKG-019",
   "pos": {
    "lat": 35.7218,
    "lng": 139.2174,
    "kind": "site",
    "label": "寺院位置",
    "approx": false,
    "confidence": "high",
    "note": "寺院本體位置；OpenStreetMap 與 Wikipedia 相差 20 m 以內。銀杏在寺內，沒有獨立座標。",
    "coordId": "TKG-019",
    "src": [
     {
      "t": "OpenStreetMap way 232257234",
      "u": "https://www.openstreetmap.org/way/232257234"
     },
     {
      "t": "Wikipedia",
      "u": "https://ja.wikipedia.org/wiki/%E5%BA%83%E5%BE%B3%E5%AF%BA"
     }
    ]
   },
   "events": [],
   "notices": [],
   "statusNote": "",
   "stage": null
  }
 ],
 "sources": [
  {
   "kind": "official",
   "name": "東京都公園協會　園區頁與紅葉情報",
   "op": "東京都建設局／公益財團法人東京都公園協會",
   "cats": [
    "entry",
    "history"
   ],
   "cover": "上野、木場、小金井、芝、城北中央、善福寺川、和田堀、戶山、光之丘、日比谷、代代木、舊岩崎邸（12 處）",
   "date": "2025 年度紅葉情報名單的發布日是 2025-11-04。2026 年度的專頁在 2026-10-02 尚未出現，2025 年的舊專頁網址已失效（404）。",
   "u": "https://www.tokyo-park.or.jp/"
  },
  {
   "kind": "official",
   "name": "國營昭和記念公園　花だより",
   "op": "國營昭和記念公園官方網站",
   "cats": [
    "entry",
    "history"
   ],
   "cover": "國營昭和紀念公園",
   "date": "花だより每週更新。2025 年有連續多期提到イチョウ；2026-10-01 的最新一期還沒有銀杏。",
   "u": "https://www.showakinen-koen.jp/hanadayori/"
  },
  {
   "kind": "official",
   "name": "新宿御苑　自然情報",
   "op": "一般財團法人國民公園協會",
   "cats": [
    "entry",
    "history"
   ],
   "cover": "新宿御苑",
   "date": "往年文章的日期是 2025-11-28；2026 年的「紅葉」分類在 2026-10-02 還沒有新文章。",
   "u": "https://fng.or.jp/shinjuku/news/"
  },
  {
   "kind": "official",
   "name": "皇居外苑・北之丸公園　消息",
   "op": "一般財團法人國民公園協會",
   "cats": [
    "entry",
    "history"
   ],
   "cover": "北之丸公園",
   "date": "往年文章的日期是 2023-11-24 與 2024-11-13。皇居外苑（行幸通り一帶）的銀杏沒有找到官方依據。",
   "u": "https://fng.or.jp/koukyo/news/"
  },
  {
   "kind": "official",
   "name": "皇居東御苑　花だより",
   "op": "宮內廳",
   "cats": [
    "entry",
    "history"
   ],
   "cover": "皇居東御苑",
   "date": "往年花だより的日期是 2025-11-28；盤點時最新一期是 2026-09-18，沒有銀杏。",
   "u": "https://www.kunaicho.go.jp/visit/higashigyoen/hanadayori/index.html"
  },
  {
   "kind": "official",
   "name": "小石川植物園　開花・紅葉狀況",
   "op": "東京大學大學院理學系研究科附屬植物園",
   "cats": [
    "entry",
    "history"
   ],
   "cover": "小石川植物園",
   "date": "往年文章的日期取自來源整理表（2025-11-19）；2026-09 至 10-01 的文章沒有提到イチョウ。",
   "u": "https://koishikawa-bg.jp/kaikainfo/"
  },
  {
   "kind": "official",
   "name": "八王子いちょう祭り　黃葉情報",
   "op": "八王子いちょう祭り祭典委員會",
   "cats": [
    "entry",
    "notice"
   ],
   "cover": "八王子 甲州街道銀杏並木",
   "date": "本季唯一的官方日期資料：照片拍攝日 2026-09-22、公告發布日 2026-09-24。官方說明會不定期更新，沒有寫階段。",
   "u": "https://www.ichou-festa.org/ichounews/"
  },
  {
   "kind": "official",
   "name": "あきる野市觀光協會　のらぼう日記",
   "op": "あきる野市觀光協會（另有あきる野市公所介紹頁）",
   "cats": [
    "entry",
    "history"
   ],
   "cover": "廣德寺",
   "date": "往年文章發布日 2025-11-08、拍攝日 2025-11-06；2026 年的紅葉情報在 2026-10-02 尚未出現。",
   "u": "https://www.akirunokanko.com/?cat=53"
  },
  {
   "kind": "official",
   "name": "明治神宮外苑　いちょう並木",
   "op": "明治神宮外苑",
   "cats": [
    "entry",
    "history"
   ],
   "cover": "明治神宮外苑 銀杏並木",
   "date": "景點介紹頁沒有日期；最近的銀杏文章是外苑便り 2022-11-17。",
   "u": "https://www.meijijingugaien.jp/walk/sight/season.html"
  },
  {
   "kind": "official",
   "name": "荻窪三庭園　大田黑公園",
   "op": "杉並區指定的公園網站與杉並區公所",
   "cats": [
    "entry"
   ],
   "cover": "大田黑公園",
   "date": "杉並區頁面更新日 2025-09-09；公園網站盤點時最新消息是 2026-09-24，沒有葉況。",
   "u": "https://ogikubo3gardens.jp/ootaguro/"
  },
  {
   "kind": "official",
   "name": "大國魂神社　豆知識",
   "op": "大國魂神社",
   "cats": [
    "entry"
   ],
   "cover": "大國魂神社",
   "date": "靜態介紹頁，沒有帶日期的葉況文章。",
   "u": "https://www.ookunitamajinja.or.jp/mame/"
  },
  {
   "kind": "official",
   "name": "靖國神社　官方網站",
   "op": "靖國神社",
   "cats": [
    "entry"
   ],
   "cover": "靖國神社",
   "date": "確認有銀杏的公告發布日是 2023-09-06；沒有帶日期的葉況紀錄。",
   "u": "https://www.yasukuni.or.jp/"
  },
  {
   "kind": "official",
   "name": "東京大學　校區導覽",
   "op": "東京大學",
   "cats": [
    "entry"
   ],
   "cover": "本鄉校區、駒場校區的銀杏並木",
   "date": "校區地圖頁更新日為 2026-04-01；沒有帶日期的葉況紀錄。",
   "u": "https://www.u-tokyo.ac.jp/ja/about/campus-guide/index.html"
  },
  {
   "kind": "official",
   "name": "くにたちNAVI　大学通り",
   "op": "NPO 法人國立市觀光まちづくり協會",
   "cats": [
    "entry"
   ],
   "cover": "國立 大學通",
   "date": "網站首頁可見 2026-09-25 更新；沒有銀杏葉況文章。",
   "u": "https://kunimachi.jp/spot/daigakustreet/"
  },
  {
   "kind": "other",
   "name": "氣象廳　いちょうの黄葉日／落葉日",
   "op": "日本氣象廳",
   "cats": [
    "history"
   ],
   "cover": "東京觀測站的標本木（單一測站，不是任何一個景點）",
   "date": "東京的平年值（1991–2020）：黃葉日 11/23、落葉日 12/3；2025 年觀測：黃葉日 11/22、落葉日 12/4；2026 年尚未觀測（2026-10-02 頁面顯示「///」）。這是歷年紀錄，本站不套用到任何景點。",
   "u": "https://www.data.jma.go.jp/sakura/data/phn_012.html",
   "ulabel": "黃葉日頁",
   "u2": "https://www.data.jma.go.jp/sakura/data/phn_013.html",
   "u2label": "落葉日頁"
  },
  {
   "kind": "other",
   "name": "tenki.jp　東京都紅葉情報",
   "op": "tenki.jp（非景點管理單位）",
   "cats": [
    "third"
   ],
   "cover": "東京都多景點，其中列有明治外苑、大田黑公園、廣徳寺等",
   "date": "來源整理表記錄日 2026-09-29。混合多種樹種，本站不採用它的階段。",
   "u": "https://tenki.jp/kouyou/3/16/"
  },
  {
   "kind": "other",
   "name": "Weathernews　東京都紅葉情報",
   "op": "Weathernews（民間氣象平台）",
   "cats": [
    "third"
   ],
   "cover": "東京都多景點",
   "date": "2026-09-29 確認專頁存在，但細項無法自動核對，本站不採用其內容；它的景點座標只用來交叉核對位置。",
   "u": "https://weathernews.jp/koyo/area/tokyo/"
  },
  {
   "kind": "other",
   "name": "WalkerPlus　東京 黃色に色づく",
   "op": "KADOKAWA／WalkerPlus",
   "cats": [
    "third"
   ],
   "cover": "東京都多景點，包含芝公園",
   "date": "來源整理表記錄日 2026-09-28（芝公園頁）。清單含其他黃葉樹種，本站不採用其階段。",
   "u": "https://koyo.walkerplus.com/yellow/ar0313/"
  },
  {
   "kind": "other",
   "name": "Jorudan　東京都紅葉情報",
   "op": "ジョルダン（民間平台）",
   "cats": [
    "third"
   ],
   "cover": "東京都多景點，包含國立 大學通",
   "date": "國立 大学通り頁面更新日 2026-08-18；寫的是歷年通常的見頃，不是今年的觀測。",
   "u": "https://sp.jorudan.co.jp/leaf/tokyo.html"
  },
  {
   "kind": "other",
   "name": "日本氣象株式會社　紅葉・黃葉見頃預想",
   "op": "日本氣象株式會社（不是氣象廳）",
   "cats": [
    "forecast"
   ],
   "cover": "東京城市尺度，沒有針對單一景點",
   "date": "第一回預報的發布日是 2026-09-02。這是預測，本站不把它套用到任何景點。",
   "u": "https://n-kishou.com/corp/news-contents/autumn/"
  }
 ]
};
