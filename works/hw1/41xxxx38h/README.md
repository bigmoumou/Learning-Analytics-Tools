# 東京銀杏地圖與散步指南

**Tokyo Ginkgo Map & Walking Guide** — 繁體中文／English 雙語、手機優先的東京銀杏散步指南，給前往東京賞銀杏的旅客。

設計概念：把它做成一本「口袋散步手帖」。米白紙面、銀杏金、深綠與炭黑；全站使用同一套自繪的線描銀杏葉（標誌、首頁的植物圖版、六階段圖例、地圖標記），沒有照片、街景或天氣服務。
Design: a pocket walking handbook in cream paper, ginkgo gold, deep green and charcoal, with one self-drawn ginkgo-leaf system and no photos, street view or weather.

## 開啟方式 / How to open

1. 雙擊 `index.html`，用 Chrome、Edge、Safari 或 Firefox 開啟。不需要安裝、伺服器、登入、資料庫或建置流程。
2. `index.html`、`style.css`、`app.js`、`data.js` 要放在同一個資料夾（全部使用相對路徑）。景點資料放在 `data.js` 的 JavaScript 變數裡，沒有用 `fetch()` 讀本機檔案。
3. 沒有網路時，搜尋、篩選、清單、景點詳情、散步規劃與資料來源區仍然可用；只有地圖底圖與網路字體需要網路。

Double-click `index.html`. Keep the four files in one folder. Without a network everything works except the base map and web fonts.

## 網路需求與授權 / Network and licences

| 資源 | 用途 | 授權／說明 |
|---|---|---|
| Leaflet 1.9.4（unpkg.com，含 SRI 檢查碼） | 地圖 | BSD 2-Clause |
| OpenStreetMap 圖磚（tile.openstreetmap.org） | 底圖 | 地圖資料 © OpenStreetMap contributors（ODbL 1.0），地圖右下角保留 attribution |
| Google Fonts（Noto Serif TC、Noto Sans TC、Shippori Mincho、Cormorant Garamond） | 字體 | SIL Open Font License 1.1；載入失敗時改用系統字體 |
| Google 地圖連結 | 散步順序的外部連結 | 只有使用者按下按鈕才會開啟新分頁；本站不呼叫 Google 服務 |

Leaflet 或圖磚載入失敗時，地圖區顯示明確的提示（說明原因與下一步），清單、搜尋、詳情與散步規劃照常運作；底圖失敗時標記仍會顯示。

## 資料與方法 / Data and method

- **來源索引**：老師提供的試算表（41 列、18 個欄位）。2026-10-08 以唯讀的 CSV 匯出讀取線上試算表（HTTP 200），與 `data.js` 內保存的 41 列逐格比對（41 列 × 18 欄 = 738 格），差異 0；原有欄位與等級（S／A／B／C／O／T／X）全部保留，不改成評分，只附白話說明。試算表只是來源索引，不是完整景點清單。
- **共用核實資料**：座標、各景點的開放資訊、氣象廳平年值，皆為 2026-10-02 核實的資料（來源表稽核日 2026-09-29）。
- **26 處景點**：只收資料表與同網域官方頁面能證實有銀杏的單一地點（來源 25 列；東京大學一列對應本郷與駒場兩個不同地點）。第三方、氣象廳、入口與排除的列只放在「資料來源與方法」。
- **資料性質分六種**：地點介紹、當季現場觀測、歷史觀測、季節參考／預測、官方一般資訊、第三方資訊；每一則證據都標示是哪一種。
- **日期分開記錄**：文章／公告日期、照片日期、觀測日期、預測期間、查核日期各一欄；來源沒有寫的顯示「資料未提供」。
- **葉況**：當季現場葉況必須同時有「銀杏、特定地點、可辨識日期、現場狀況」。目前 25 處顯示「尚無當季回報」，1 處（八王子甲州街道）有 2026-09-22 的照片說明但沒有葉況文字，顯示「待補證」；兩者與六個季節階段分開篩選，沒有任何景點被指派到六階段（六階段只是教學參考流程）。楓葉、其他樹種、區域狀況與氣象廳標本木都不套用到個別景點。過去的官方紀錄（例如新宿御苑 2025-11-28）只以有日期的歷史觀測呈現。
- **氣象廳東京站**：平年值（1991–2020）黃葉日 11/23、落葉日 12/3，2025 年觀測 11/22 與 12/4，2026 年尚未觀測；只放在「葉況怎麼讀」的摺疊區，標示為東京全域參考，不稱為官方「見頃開始日」。
- **座標**：沿用共用核實資料，全部標示為「園區近似位置」並附依據、信心等級與來源連結；不暗示是銀杏樹的精確位置。沒有可追溯座標的景點只列在清單，不上地圖也不算距離（程式已支援，並用測試資料驗證過；目前 26 處都有座標）。
- **距離與時間**：直線距離用 Haversine 公式，顯示時取整並標示「估算」；步行時間以每分鐘 80 公尺換算，標示「估算、不是導航時間、不是實際路程」。距離超過 2.5 公里的路段另提示通常需要搭大眾運輸，本站不提供交通時間。地圖上的虛線只表示停靠順序，不是步行路線。
- **名稱**：日文原名一律保留；中文名稱是依台灣用字轉寫日文名稱，不是官方名稱；英文名稱只顯示能在官方英文頁面核實的 12 處（Shiba Park、Toyama Park、Hibiya Park、Kyu-Iwasaki-tei Gardens、Shinjuku Gyoen National Garden、East Gardens of the Imperial Palace、Koishikawa Botanical Gardens、Meijijingu Gaien、Yasukuni Shrine、Kitanomaru Garden、The University of Tokyo, Hongo Campus、The University of Tokyo, Komaba Campus；其中芝公園、戶山公園、日比谷公園、舊岩崎邸庭園來自 2026-10-02 共用資料所記的官方英文導覽圖，其餘在 2026-10-08 於各管理單位的官方英文頁面確認），其餘顯示「英文譯名未提供／English name not verified」，沒有自行杜撰。
- **搜尋**：可用日文、中文名稱、區名、來源編號（如 TKG-015）搜尋；也可用羅馬拼音（例如 Ueno）。羅馬拼音只是隱藏的搜尋關鍵字，不會顯示成景點名稱。

## 沒有做的事 / Not included

依 BRIEF 與老師對 BRIEF 的解讀：沒有日期滑桿、沒有獨立的收藏功能、沒有街景、沒有假的即時天氣或即時葉況、沒有定位推薦、沒有交通時間、沒有自動更新。只會保存語言與散步清單到 `localStorage`（儲存被禁止時仍可正常操作，並提示一次）。

## 未驗證項目與限制 / Unverified items and limits

- 目前沒有任何官方來源為這 26 處景點發布 2026 年的葉況階段（資料查核日 2026-10-02）。
- 東京都公園協會 2025 年度名單是 PDF，本站無法自行讀取文字，12 處公園景點的內容依老師的來源表；上野恩賜公園與木場公園的園區頁本身沒有提到銀杏。
- 上野恩賜公園的開放時間，兩個官方頁面寫法不同，標示為「待確認」。
- 昭和記念公園的カナール全長，兩個官方頁面數字不同（200 m／150 m），かたらいのイチョウ並木的位置未核實，因此不上地圖。
- 英文名稱只核實了 12／26 處；其餘 14 處標示未核實。
- 資料是快照：開放時間、費用、休園與活動可能改變，出發前請看官方公告。本站不是即時觀測或導航服務。
- 地圖在 Chromium（Playwright）上實測；Safari、Firefox 與實體手機、螢幕閱讀器沒有實測（只檢查了鍵盤操作與 ARIA 結構）。OpenStreetMap 公用圖磚可能因流量限制而暫時載入失敗，頁面會顯示提示。

## 實際測試結果（2026-10-08，Chromium／Playwright，從 file:// 開啟）

- **冒煙檢查**（1440 px 與 360 px）：console 錯誤 0／0，頁面錯誤 0／0，失敗請求 0／0，水平捲動 無／無，小於 44×44 px 的觸控目標 0／0；桌面版載入 25 張底圖圖磚。
- **地圖尺寸情境**（11 種：分頁切換、網址列縮放、旋轉、桌面↔手機、從未開過地圖就放大等）：連跑 3 次，allPass 皆為 true、true、true；每個情境 26／26 個標記都在地圖內，錯誤 0。
- **流程測試**（193 項檢查，通過 193，失敗 0）：
  - 1 資料初始化與首頁：15／15
  - 2 搜尋與篩選：38／38
  - 3 詳情與來源區：26／26
  - 4 標記與清單連動：8／8
  - 5 散步路線：27／27
  - 6 中英切換保留狀態：20／20
  - 7 localStorage 被禁止：8／8
  - 8 Leaflet 被擋：9／9
  - 9 圖磚失敗：6／6
  - 10 鍵盤與焦點：12／12
  - 11 手機 360 px 分頁與詳情面板：12／12
  - 12 座標與欄位缺失：12／12
  內容涵蓋：資料初始化與缺欄位、中英切換（保留搜尋、區域、選取景點與 2–5 站路線，重新整理後語言與路線仍在）、搜尋與每一個篩選（區域 4、來源等級 4、葉況 2 + 六階段）的結果數與清除、無結果與六階段為空的說明、季節圖例與「尚無當季回報」「待補證」的區分、詳情與來源連結、標記與清單連動、路線新增／移除／排序／5 站上限／座標不足提示、直線距離與 Haversine 比對、localStorage 全面禁止與寫入失敗、Leaflet 被擋、圖磚失敗、鍵盤焦點與手機詳情的焦點限制。
- **資料核對**：15／15 項（738 格來源表欄位與今天的線上匯出一致；26 處座標與 coords.json 一致；沒有景點被指派到六階段；沒有學號或姓名）。
- **外部連結**：網站會顯示的 187 個外部網址以瀏覽器 User-Agent 逐一請求，狀態 200：186，404：1。非 200 的項目：
  - 404 https://www.tokyo-park.or.jp/special/kouyou/index.html（data.js）：來源表第 TKG-038 列自己記錄這個 2025 年舊網址已失效（本次回傳 404），網站只以文字顯示、不做成連結
- **文字對比**：35 組主要前景／背景色對比皆 ≥ 4.5:1（最低 5.18:1）。
- 測試視窗：桌面 1440 px；手機 360、390 px；橫向 844 px；平板 900 px。

## 檔案 / Files

- `index.html`（20.0 KB）
- `style.css`（44.2 KB）
- `app.js`（94.6 KB）
- `data.js`（179.2 KB）
- `README.md`（10.5 KB）

## English summary

A bilingual (Traditional Chinese / English), mobile-first walking guide to 26 Tokyo ginkgo spots that have traceable evidence. It keeps current-season on-site observations (none exist yet: 25 spots "No current-season report", 1 "Evidence pending") apart from history, seasonal references, official general information and third-party material, records article, photo, observation, forecast and checked dates separately, shows every coordinate as an approximate park position, and offers a 2 to 5 stop walking order with straight-line distances (haversine) and times at 80 m per minute, always labelled as estimates. Leaflet and OpenStreetMap need a network; when they fail the list, search and walk planner still work. Tests were run in Chromium only; see the Chinese section for the real numbers.
