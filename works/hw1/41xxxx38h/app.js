/* Tokyo ginkgo map and walking guide: plain JavaScript, no framework, no build step.
   Data lives in data.js (window.GINKGO_DATA). Opens from file://. */
(function () {
'use strict';
// UI strings (zh, en). Placeholders {0}, {1}... Authored text only; data comes from data.js.
const T = {
  'skip': ['跳到地圖與清單', 'Skip to the map and list'],
  'title': ['東京銀杏地圖與散步指南', 'Tokyo Ginkgo Map & Walking Guide'],
  'brand.long': ['東京銀杏地圖與散步指南', 'Tokyo Ginkgo Map & Walking Guide'],
  'brand.short': ['東京銀杏地圖', 'Tokyo Ginkgo Map'],
  'meta.desc': ['給前往東京賞銀杏的旅客：有來源支持的 26 處銀杏景點、當季觀測與歷史資料的區分，以及 2 到 5 站的散步順序。', 'A bilingual guide to 26 sourced ginkgo spots in Tokyo, with a clear line between current-season observations and history, and a walking order of 2 to 5 stops.'],
  'nav.aria': ['頁面導覽', 'Page navigation'],
  'nav.explore': ['探索', 'Explore'],
  'nav.foliage': ['葉況說明', 'Foliage guide'],
  'nav.walk': ['散步', 'Walk'],
  'nav.sources': ['資料來源', 'Sources'],
  'ribbon.aria': ['散步清單：已選 {0} 站（最多 5 站），前往散步規劃', 'Walk list: {0} of 5 stops chosen, go to the walk planner'],
  'hero.eyebrow': ['東京 · 2026 秋', 'Tokyo · Autumn 2026'],
  'hero.lead': ['給前往東京賞銀杏的旅客：找到有資料支持的景點，分清楚「當季現場觀測」和「歷史或一般季節資訊」，再排出 2 到 5 站的散步順序。', 'For visitors heading to Tokyo for the ginkgo: find spots backed by sources, tell current-season on-site observations apart from history and general seasonal information, then set a walking order of 2 to 5 stops.'],
  'hero.cta1': ['開始探索', 'Start exploring'],
  'hero.cta2': ['安排散步順序', 'Plan the walk'],
  'led.checked': ['資料查核日', 'Data checked'],
  'led.checked.sub': ['來源表稽核日 {0}', 'Source sheet audited {0}'],
  'led.spots': ['有來源支持的景點', 'Spots backed by sources'],
  'led.spots.sub': ['每一處都有可追溯的銀杏證據', 'Each has traceable ginkgo evidence'],
  'led.now': ['當季現場觀測', 'Current-season observations'],
  'led.now.sub': ['待補證 {0} 處，其餘「尚無當季回報」', 'Evidence pending: {0}. The rest have no current-season report'],
  'hero.status': ['目前沒有任何景點有可當作葉況階段的當季現場觀測，所以 {0} 處顯示「尚無當季回報」。{2}有 2026 年的資料線索，但官方沒有寫葉況，列為「待補證」。過去的紀錄一律標示日期，不當作現況。', 'No spot has an on-site observation that can serve as a foliage stage, so {0} spots show "No current-season report". {2} has 2026 material but no foliage wording, so it is listed as "Evidence pending". Past records always carry their dates and are never treated as current.'],
  'hero.status.nopending': ['目前沒有任何景點有可當作葉況階段的當季現場觀測，所以 {0} 處都顯示「尚無當季回報」。過去的紀錄一律標示日期，不當作現況。', 'No spot has an on-site observation that can serve as a foliage stage, so all {0} spots show "No current-season report". Past records always carry their dates and are never treated as current.'],
  'plate.cap': ['圖 1　季節參考流程（教學示意；不代表任何景點的現況）', 'Figure 1 — The seasonal reference flow (a teaching illustration; not the status of any spot)'],

  'explore.h': ['探索景點', 'Explore the spots'],
  'explore.sub': ['用名稱、區域、來源等級或葉況找景點；點清單或地圖標記，就能看證據、日期與注意事項。', 'Find spots by name, area, source grade or foliage status; choose one in the list or on the map to see its evidence, dates and cautions.'],
  'f.search': ['搜尋景點', 'Search spots'],
  'f.search.ph': ['例：新宿、Ueno', 'e.g. Shinjuku, Ueno'],
  'f.search.clear': ['清除搜尋', 'Clear search'],
  'f.toggle': ['篩選', 'Filters'],
  'f.region': ['區域', 'Area'],
  'f.grade': ['來源等級', 'Source grade'],
  'f.status': ['葉況', 'Foliage status'],
  'f.all': ['全部', 'All'],
  'f.status.g1': ['目前能不能確認', 'Can this site confirm it?'],
  'f.status.g2': ['六階段（教學參考，目前每項都是 0）', 'Six stages (teaching reference; every count is 0 for now)'],
  'status.none': ['尚無當季回報', 'No current-season report'],
  'status.pending': ['待補證', 'Evidence pending'],
  'f.clear': ['清除條件', 'Clear filters'],
  'result': ['顯示 {0} / {1} 處', 'Showing {0} of {1} spots'],
  'result.zero': ['沒有符合的景點（共 {1} 處）', 'No matching spots (of {1})'],
  'tabs.aria': ['清單與地圖切換', 'Switch between list and map'],
  'tabs.list': ['清單', 'List'],
  'tabs.map': ['地圖', 'Map'],
  'pane.list': ['景點清單', 'Spot list'],
  'pane.map': ['景點地圖', 'Spot map'],
  'empty.h': ['沒有符合條件的景點', 'No spots match'],
  'empty.p': ['試試少用幾個關鍵字，或清除篩選條件。名稱可以用日文、中文或羅馬拼音搜尋。', 'Try fewer keywords or clear the filters. You can search by Japanese or Chinese name, or by romanised name.'],
  'empty.stage.h': ['目前沒有景點被指派到「{0}」', 'No spot is assigned to "{0}"'],
  'empty.stage.p': ['六個階段只是教學參考。本站只在同時有「銀杏、特定地點、可辨識日期、現場狀況」四項證據時才標階段，目前沒有任何景點符合，所以這裡是空的才是正確的。', 'The six stages are a teaching reference. This site assigns a stage only when there is evidence for ginkgo, a specific place, an identifiable date and an on-site condition; no spot qualifies at present, so an empty result is the correct one.'],
  'empty.btn.none': ['看「尚無當季回報」的景點', 'Show spots with no current-season report'],
  'empty.btn.clear': ['清除所有條件', 'Clear all filters'],
  'spot.grade': ['來源等級 {0}', 'Source grade {0}'],
  'name.nv': ['英文譯名未提供／English name not verified', '英文譯名未提供／English name not verified'],
  'name.nv.short': ['英文譯名未提供', 'English name not verified'],
  'spot.add': ['加入', 'Add'],
  'spot.stopn': ['第 {0} 站', 'Stop {0}'],
  'spot.add.aria': ['加入散步：{0}', 'Add to walk: {0}'],
  'spot.remove.aria': ['從散步移除：{0}（目前第 {1} 站）', 'Remove from walk: {0} (currently stop {1})'],
  'spot.nocoord': ['沒有座標，不能加入散步', 'No coordinates, cannot join the walk'],
  'map.aria': ['東京銀杏景點地圖', 'Map of Tokyo ginkgo spots'],
  'map.note': ['標記是「園區近似位置」，不是銀杏樹的精確位置；方形菱形標記是「待補證」，圓形是「尚無當季回報」，有數字的是散步停靠順序。虛線只表示停靠順序，不是實際步行路線。', 'Markers show approximate park positions, not the exact position of any ginkgo tree. A diamond marker means "Evidence pending", a round one "No current-season report", and a number is the walking order. The dotted line only shows the order of stops, not a real walking route.'],
  'map.fail.leaflet.h': ['地圖元件沒有載入', 'The map component did not load'],
  'map.fail.leaflet.p': ['Leaflet 地圖程式庫無法從網路取得（可能離線，或被網路設定擋下）。搜尋、清單、詳情和散步規劃都還能使用；連上網路後重新整理頁面就能看到地圖。', 'The Leaflet map library could not be fetched (you may be offline, or the network blocked it). Search, the list, details and the walk planner still work; reload the page once you are online to see the map.'],
  'map.fail.tiles.h': ['底圖暫時載入不了', 'The base map is not loading'],
  'map.fail.tiles.p': ['OpenStreetMap 圖磚沒有回應，標記位置仍會顯示，但看不到街道。清單與散步規劃不受影響。', 'OpenStreetMap tiles are not responding. Markers still show, but streets do not. The list and the walk planner are unaffected.'],
  'map.retry': ['再試一次', 'Try again'],
  'map.marker.sel': ['已選取', 'selected'],

  'd.close': ['關閉詳情', 'Close details'],
  'd.status.h': ['當季現場觀測', 'Current-season on-site observation'],
  'd.status.none.p': ['沒有找到同時符合「銀杏、特定地點、可辨識日期、現場狀況」的當季證據。這不代表是青葉，也不代表還沒變色，只是本站目前無法確認。', 'No current-season evidence was found that covers ginkgo, a specific place, an identifiable date and an on-site condition. That does not mean the leaves are green or have not turned; this site simply cannot confirm it.'],
  'd.ev.h': ['銀杏證據與資料性質', 'Ginkgo evidence and kind of information'],
  'd.ev.checked': ['每一則證據的日期分開列出；來源沒有寫的，就顯示「資料未提供」。', 'Each piece of evidence lists its dates separately; anything the source does not state is shown as "Not provided".'],
  'd.link.src': ['開啟來源頁面 ↗', 'Open the source page ↗'],
  'd.notes.h': ['注意事項', 'Cautions'],
  'd.unv.h': ['尚未核實', 'Not verified'],
  'd.src2.h': ['來源與管理單位', 'Source and operator'],
  'd.operator': ['管理／提供單位', 'Operator or provider'],
  'd.grade': ['來源等級（來源表原有分級）', 'Source grade (as in the source sheet)'],
  'd.cadence': ['更新頻率', 'Update frequency'],
  'd.unpublished': ['未公布', 'Not published'],
  'd.audit': ['來源表稽核日', 'Source sheet audited'],
  'd.sheetnote': ['來源表註記', 'Source-sheet note'],
  'd.info.h': ['官方一般資訊', 'Official general information'],
  'd.info.note': ['這些資訊來自 2026-10-02 讀取的官方頁面，可能已經變動；出發前請再查官方公告。', 'Taken from official pages read on 2026-10-02; they may have changed. Check the official announcements again before you go.'],
  'd.hours': ['開放時間', 'Opening hours'],
  'd.closed': ['休園日', 'Closing days'],
  'd.fee': ['入園費', 'Admission'],
  'd.access': ['交通', 'Getting there'],
  'd.address': ['地址', 'Address'],
  'd.tel': ['電話', 'Telephone'],
  'd.na': ['資料未提供', 'Not provided'],
  'd.coord.h': ['座標：園區近似位置', 'Coordinates: approximate park position'],
  'd.coord.p': ['這是「園區近似位置」，不是銀杏樹的精確位置，只用來在地圖上標示範圍和計算直線距離。', 'This is an approximate park position, not the exact position of any ginkgo tree. It is used only to place the marker and to compute straight-line distances.'],
  'd.coord.type': ['位置類型', 'Type of point'],
  'd.coord.point': ['這個點在哪裡', 'Where the point is'],
  'd.coord.basis': ['依據', 'Basis'],
  'd.coord.conf': ['座標查核信心', 'Coordinate confidence'],
  'd.coord.lat': ['緯度、經度（WGS84）', 'Latitude, longitude (WGS84)'],
  'd.coord.srcs': ['座標來源', 'Coordinate sources'],
  'd.coord.osm': ['在 OpenStreetMap 看這個點 ↗', 'See this point on OpenStreetMap ↗'],
  'ct.park': ['園區代表點', 'Representative point of the park'],
  'ct.inpark': ['園區內的參考點', 'A reference point inside the park'],
  'ct.avenue': ['並木的中點或代表點', 'Midpoint or representative point of the avenue'],
  'ct.site': ['地點本體的位置', 'Position of the place itself'],
  'cf.low': ['低：大型園區內銀杏的確切位置不明，只有園區層級的概略點', 'Low: the exact ginkgo position inside a large park is unknown; only a park-level approximate point'],
  'cf.medium': ['中：只有單一來源、來源相差較大，或屬於推定', 'Medium: a single source, sources far apart, or an estimate'],
  'cf.high': ['高：兩種以上不同來源都在所選點 200 公尺內', 'High: two or more different sources lie within 200 m of the point'],
  'd.src.h': ['來源表紀錄（原表欄位）', 'Source-sheet record (original columns)'],
  'd.src.p': ['以下是老師來源表中這一列的欄位。英文版會附上譯文，原文（繁體中文或日文）保留在下方。', 'The columns of this spot\'s row in the teacher\'s source sheet. In English mode a translation is shown with the original (Traditional Chinese or Japanese) kept beneath it.'],
  'd.src.orig': ['原文', 'Original'],
  'd.add': ['加入散步', 'Add to walk'],
  'd.remove': ['移出散步（第 {0} 站）', 'Remove from walk (stop {0})'],
  'd.official': ['官方網頁 ↗', 'Official page ↗'],
  'd.nocoord': ['這個景點沒有可追溯的座標，所以不在地圖上標示，也不能加入散步或計算距離。', 'This spot has no traceable coordinates, so it is not shown on the map and cannot join the walk or be measured.'],
  'd.final': ['出發前請再查官方公告。', 'Check the official announcements again before you go.'],
  'dt.article': ['文章／公告日期', 'Article or notice date'],
  'dt.photo': ['照片日期', 'Photo date'],
  'dt.observed': ['觀測日期', 'Observation date'],
  'dt.forecast': ['預測期間', 'Forecast period'],
  'dt.checked': ['查核日期', 'Checked on'],
  'kind.intro': ['地點介紹', 'Place introduction'],
  'kind.now': ['當季現場觀測', 'Current-season on-site observation'],
  'kind.history': ['歷史觀測', 'Historical observation'],
  'kind.season': ['季節參考／預測', 'Seasonal reference or forecast'],
  'kind.official': ['官方一般資訊', 'Official general information'],
  'kind.third': ['第三方資訊', 'Third-party information'],
  'kind.intro.d': ['官方或管理單位對這個地點與銀杏的介紹，通常沒有日期，不代表今年的葉況。', 'An official or operator description of the place and its ginkgo; usually undated and not this year\'s foliage.'],
  'kind.now.d': ['2026 年、有日期、指名銀杏與地點，並寫出現場狀況的紀錄。目前沒有任何景點達到。', 'A 2026 record that is dated, names the ginkgo and the place, and states the on-site condition. No spot meets this at present.'],
  'kind.history.d': ['過去季節的有日期紀錄，只當歷史參考，不是現況。', 'A dated record from a past season: history only, never current status.'],
  'kind.season.d': ['一般的季節說法或預測，例如「11 月下旬」，是歷年經驗，不是現場觀測。', 'A general seasonal statement or forecast, such as "late November": past experience, not an on-site observation.'],
  'kind.official.d': ['開放時間、費用、交通與活動日期等，以官方公告為準。', 'Hours, fees, access and event dates; the official announcement prevails.'],
  'kind.third.d': ['不是管理單位的網站，只能當線索，不用來判定葉況。', 'Sites that are not the operator: a lead only, never used to judge foliage.'],
  'pending.badge': ['未達當季現場觀測條件', 'Does not meet the on-site observation rule'],

  'fol.h': ['葉況怎麼讀', 'How to read the foliage status'],
  'fol.sub': ['這裡把「教學用的六個階段」和「本站目前能不能確認」分開說明。除了顏色，每個階段都有編號、圖形和文字。', 'This page keeps "the six teaching stages" apart from "whether this site can confirm anything now". Besides colour, every stage has a number, a shape and a text label.'],
  'fol.stages.h': ['六個季節階段（教學參考）', 'The six seasonal stages (teaching reference)'],
  'fol.stages.note': ['這是教學用的參考流程，不代表任何一個景點的現況。沒有合格的當季證據時，本站不會把景點放進其中任何一個階段。', 'A teaching flow, not the status of any single spot. Without qualifying current-season evidence this site does not place a spot in any of the stages.'],
  'fol.none.h': ['不屬於六階段的兩種狀態', 'Two statuses outside the six stages'],
  'fol.none.t': ['尚無當季回報', 'No current-season report'],
  'fol.none.p': ['沒有同時符合「銀杏、特定地點、可辨識日期、現場狀況」的當季證據。不代表是青葉，也不代表還沒變色。', 'There is no current-season evidence that covers ginkgo, a specific place, an identifiable date and an on-site condition. It does not mean green leaves, and it does not mean no colour yet.'],
  'fol.pend.t': ['待補證', 'Evidence pending'],
  'fol.pend.p': ['有一些 2026 年的資料線索（例如標著 2026 日期的照片說明），但來源沒有寫出葉況，本站也沒有判讀照片，所以不指派任何階段。', 'There is some 2026 material (for example photo captions dated 2026), but the source states no foliage condition and this site does not judge photos, so no stage is assigned.'],
  'fol.kinds.h': ['資料性質', 'Kinds of information'],
  'jma.h': ['東京全域的季節參考（氣象廳標本木）', 'Tokyo-wide seasonal reference (JMA specimen tree)'],
  'jma.p': ['氣象廳在東京站的標本木上，記錄銀杏的「黃葉日」與「落葉日」。這是東京站的尺度，不是任何一個景點的觀測，「黃葉日」也不是官方的「見頃開始日」。', 'The Japan Meteorological Agency records a ginkgo "yellowing date" and "leaf-fall date" on a specimen tree for Tokyo station. That is a Tokyo-wide scale, not an observation of any spot, and the yellowing date is not an official start of peak viewing.'],
  'jma.th.item': ['項目', 'Item'],
  'jma.th.y': ['黃葉日', 'Yellowing date'],
  'jma.th.f': ['落葉日', 'Leaf-fall date'],
  'jma.normal': ['平年值（{0}）', 'Normal ({0})'],
  'jma.obs25': ['2025 年觀測', '2025 observed'],
  'jma.obs26': ['2026 年觀測', '2026 observed'],
  'jma.notyet': ['尚未觀測', 'Not yet observed'],
  'jma.def.h': ['定義', 'Definitions'],
  'jma.def.y': ['黃葉日：標本木上大部分葉片轉黃的第一天。', 'Yellowing date: the first day on which most of the specimen tree\'s leaves have turned yellow.'],
  'jma.def.f': ['落葉日：約 80% 的葉片掉落的第一天。', 'Leaf-fall date: the first day on which about 80% of the leaves have fallen.'],
  'jma.recent': ['近十年東京的黃葉日', 'Tokyo yellowing dates, last ten years'],
  'jma.vary': ['2023 與 2024 年是 12/1 與 12/3，比平年值晚；實際季節可能前後差約一週。', '2023 and 2024 were 1 Dec and 3 Dec, later than the normal; the real season can shift by about a week either way.'],
  'jma.src': ['氣象廳：黃葉日 ↗', 'JMA: yellowing dates ↗'],
  'jma.src2': ['氣象廳：落葉日 ↗', 'JMA: leaf-fall dates ↗'],
  'jma.src3': ['氣象廳：累年值下載入口 ↗', 'JMA: multi-year data downloads ↗'],

  'walk.h': ['安排散步順序', 'Plan the walking order'],
  'walk.sub': ['選 2 到 5 個有座標的景點，手動調整順序。距離是依近似座標算出的直線估算，不是實際步行路線，也不是導航時間。', 'Pick 2 to 5 spots with coordinates and set the order by hand. Distances are straight-line estimates from approximate coordinates, not a real walking route and not a navigation time.'],
  'walk.add.label': ['加入一個停靠景點', 'Add a stop'],
  'walk.add.btn': ['加入', 'Add'],
  'walk.select.ph': ['選擇景點…', 'Choose a spot…'],
  'walk.hint.0': ['從上面的清單、地圖或這個選單選 2 到 5 個景點。', 'Pick 2 to 5 spots from the list, the map or this menu.'],
  'walk.hint.1': ['已選 1 處；再加入至少 1 處，才會顯示距離。', 'One spot chosen; add at least one more to see distances.'],
  'walk.hint.max': ['最多 5 站。要換景點的話，請先移除其中一站。', 'At most 5 stops. Remove one first if you want to swap.'],
  'walk.hint.nocoord': ['這個景點沒有可信的座標，不能加入散步。', 'This spot has no reliable coordinates and cannot join the walk.'],
  'walk.hint.pick': ['請先從選單選一個景點。', 'Choose a spot from the menu first.'],
  'walk.empty.p': ['還沒有停靠景點。選 2 到 5 個景點後，停靠順序會出現在這裡，可以用上移、下移調整。', 'No stops yet. Choose 2 to 5 spots and their order appears here; use move up and move down to change it.'],
  'stop.up': ['上移', 'Up'],
  'stop.down': ['下移', 'Down'],
  'stop.remove': ['移除', 'Remove'],
  'stop.up.aria': ['把「{0}」往前移一站', 'Move "{0}" one stop earlier'],
  'stop.down.aria': ['把「{0}」往後移一站', 'Move "{0}" one stop later'],
  'stop.remove.aria': ['從散步移除「{0}」', 'Remove "{0}" from the walk'],
  'stop.open.aria': ['查看「{0}」的詳情', 'Open details for "{0}"'],
  'stop.sub': ['{0} · 園區近似位置', '{0} · approximate park position'],
  'leg': ['到下一站：直線約 {0}（估算）；步行約 {1}（以每分鐘 80 公尺估算，不是導航時間）。', 'To the next stop: about {0} in a straight line (an estimate); about {1} on foot (estimated at 80 m per minute, not a navigation time).'],
  'leg.far': ['距離較遠，實際移動多半要搭大眾運輸；本站不提供交通時間。', 'This is far enough that you would probably take public transport; this site gives no transit times.'],
  'sum.h': ['這條散步', 'This walk'],
  'sum.stops': ['停靠站數', 'Stops'],
  'sum.dist': ['直線距離合計（估算）', 'Straight-line total (estimate)'],
  'sum.time': ['步行時間（估算）', 'Walking time (estimate)'],
  'sum.about': ['約 {0}', 'about {0}'],
  'sum.note1': ['距離是「園區近似位置」之間的直線，所以只是估算；步行時間用每分鐘 80 公尺換算，不是導航時間，也不是實際路程。', 'Distances are straight lines between approximate park positions, so they are estimates; walking time is converted at 80 m per minute; it is not a navigation time and not a real route length.'],
  'sum.note2': ['地圖上的虛線只表示停靠順序。本站沒有路網資料，也不提供即時導航或交通資訊。', 'The dotted line on the map only shows the order of stops. This site has no road-network data and gives no live navigation or transit information.'],
  'sum.gmaps': ['在 Google 地圖開啟 ↗', 'Open in Google Maps ↗'],
  'sum.gmaps.note': ['只有你按下按鈕才會開啟新分頁；路線與時間由 Google 計算，和本站的估算無關。座標是近似位置。', 'A new tab opens only when you press the button; Google computes its own route and time, independent of this site\'s estimates. The coordinates are approximate.'],
  'sum.clear': ['清除整條散步', 'Clear the whole walk'],
  'sum.empty': ['加入 2 處以上之後，這裡會顯示距離，以及開啟 Google 地圖的連結。', 'Add two or more spots and the distances, and a link to open Google Maps, appear here.'],
  'u.m': ['公尺', 'm'], 'u.km': ['公里', 'km'], 'u.min': ['分鐘', 'min'], 'u.h': ['小時', 'h'], 'u.mm': ['分', 'min'],
  'toast.added': ['已加入第 {0} 站：{1}', 'Added as stop {0}: {1}'],
  'toast.removed': ['已移除：{0}', 'Removed: {0}'],
  'toast.moved': ['「{0}」移到第 {1} 站', '"{0}" moved to stop {1}'],
  'toast.cleared': ['已清除散步清單', 'Walk cleared'],
  'toast.see': ['看順序', 'See the order'],
  'toast.storage': ['這個瀏覽器無法儲存語言與散步清單；本次仍可正常使用，重新整理後會回到預設。', 'This browser cannot store your language and walk; everything still works, but a reload resets them.'],
  'toast.max': ['最多 5 站，請先移除一站。', 'At most 5 stops; remove one first.'],

  'src.h': ['資料來源與方法', 'Sources and method'],
  'src.sub': ['每個景點都要有可追溯的證據才會列入。這裡列出用了哪些來源、各來源支持什麼，以及查核日期。', 'A spot is listed only with traceable evidence. This section lists the sources used, what each supports, and the dates checked.'],
  'src.sheet.h': ['來源索引：老師提供的試算表', 'Source index: the teacher\'s spreadsheet'],
  'src.sheet.p': ['景點與來源都從這份 {0} 列的試算表出發。本站保留各列原有的欄位與等級，不自行改成評分。{1} 以唯讀的 CSV 匯出讀取線上試算表（HTTP {2}），與資料檔內保存的 {0} 列逐格比對，沒有差異；來源表稽核日是 {3}，景點資料快照日是 {4}。試算表只是來源索引，不是完整的景點清單。', 'Spots and sources start from this {0}-row spreadsheet. The original columns and grades of each row are kept and never turned into scores. On {1} the online sheet was read through a read-only CSV export (HTTP {2}) and compared cell by cell with the {0} rows stored in this site\'s data, with no differences; the sheet was audited on {3} and the spot data snapshot is {4}. The sheet is a source index, not a complete list of spots.'],
  'src.sheet.link': ['開啟試算表 ↗', 'Open the spreadsheet ↗'],
  'src.method.h': ['方法', 'Method'],
  'src.attr.h': ['外部資源與授權', 'External resources and licences'],
  'src.lim.h': ['限制與尚未驗證的項目', 'Limits and unverified items'],
  'src.groups.h': ['各來源支持什麼', 'What each source supports'],
  'src.groups.p': ['來源表的 {0} 列依用途分組。每一列都列出它支持的內容、證據日期、稽核日與連結，原表欄位可展開查看。', 'The sheet\x27s {0} rows are grouped by use. Each row lists what it supports, its evidence date, its audit date and links; the original columns can be expanded.'],
  'src.group.spot': ['景點證據來源', 'Spot evidence sources'],
  'src.group.spot.n': ['支持 26 處景點的來源列。每一列都附上它支持的內容、證據日期與稽核日。', 'The source rows that support the 26 spots, each with what it supports, its evidence date and its audit date.'],
  'src.group.entry': ['入口與名單', 'Entrances and lists'],
  'src.group.entry.n': ['2025 年度官方名單的入口；2026 年度專頁尚未公布。', 'The entrance to the 2025 official list; no 2026 page has been published.'],
  'src.group.season': ['季節參考：氣象廳', 'Seasonal reference: JMA'],
  'src.group.season.n': ['東京站標本木的資料，只作為東京全域的季節參考，不套用到個別景點。', 'Specimen-tree data for Tokyo station, used only as a Tokyo-wide seasonal reference and never applied to individual spots.'],
  'src.group.background': ['僅作背景，未列為景點', 'Background only, not listed as spots'],
  'src.group.background.n': ['沒有證實銀杏，或只能用來發現候選地點。', 'Ginkgo is not evidenced, or the row is only a lead to candidate places.'],
  'src.group.third': ['第三方資訊', 'Third-party information'],
  'src.group.third.n': ['不是管理單位的網站，只能當線索，本站不用它判定任何景點的葉況。', 'Not the operator\'s sites: leads only, never used to judge any spot\'s foliage.'],
  'src.group.excluded': ['已排除或失效', 'Excluded or dead'],
  'src.group.excluded.n': ['保留作紀錄，不是可用的現況來源。', 'Kept as a record; not usable status sources.'],
  'src.rows': ['{0} 列', '{0} rows'],
  'src.supports': ['支持內容', 'Supports'],
  'src.operator': ['管理／提供單位', 'Operator'],
  'src.evdate': ['證據日期', 'Evidence date'],
  'src.audit': ['稽核日', 'Audited'],
  'src.dead': ['原網址已失效（回傳 404），只保留作紀錄', 'The original URL is dead (it returned 404); kept as a record only'],
  'src.link.main': ['官方頁面 ↗', 'Official page ↗'],
  'src.link.extra': ['補充頁面 ↗', 'Extra page ↗'],
  'src.link.evid': ['證據頁面 ↗', 'Evidence page ↗'],
  'src.more': ['展開來源表原欄位', 'Show the sheet\'s original columns'],
  'src.extra.h': ['各景點另外用到的證據頁面', 'Other evidence pages used for each spot'],
  'src.extra.p': ['這些頁面是景點詳情裡「銀杏證據」使用的來源，來自 2026-10-02 核實的共用資料。', 'These are the pages used as "Ginkgo evidence" in the spot details, from the shared data verified on 2026-10-02.'],
  'foot.meta': ['資料查核日 {0}　·　來源表稽核日 {1}　·　本頁建立 {2}　·　地圖 © OpenStreetMap contributors、Leaflet', 'Data checked {0}  ·  source sheet audited {1}  ·  page built {2}  ·  map © OpenStreetMap contributors, Leaflet'],
  'err.data.h': ['景點資料沒有載入', 'The spot data did not load'],
  'err.data.p': ['data.js 沒有成功載入，所以暫時沒有景點可以顯示。請確認 index.html 與 data.js 放在同一個資料夾，再重新整理。 / data.js did not load, so there are no spots to show. Make sure index.html and data.js sit in the same folder, then reload.', 'data.js did not load, so there are no spots to show. Make sure index.html and data.js sit in the same folder, then reload. / data.js 沒有成功載入，所以暫時沒有景點可以顯示。'],
};
const STAGES = [
  { ja: '青葉', zh: '青葉（綠葉）', en: 'Green leaves', dz: '葉片主要還是綠色。', de: 'The leaves are still mostly green.' },
  { ja: '色づき始め', zh: '開始轉色', en: 'Starting to colour', dz: '少數葉片開始轉黃。', de: 'A few leaves begin to turn yellow.' },
  { ja: '黄葉進行', zh: '黃葉增加', en: 'Yellowing spreads', dz: '黃葉的比例逐漸增加。', de: 'The share of yellow leaves keeps growing.' },
  { ja: '見頃', zh: '最佳觀賞期', en: 'Peak viewing', dz: '整體轉為金黃。這是教學用語，實際的見頃要看管理單位的公告。', de: 'The whole tree turns golden. A teaching label; the real peak is whatever the site operator announces.' },
  { ja: '落葉始め', zh: '開始落葉', en: 'Leaves begin to fall', dz: '葉片開始明顯掉落。', de: 'Leaves visibly start to fall.' },
  { ja: '落葉', zh: '落葉', en: 'Leaves fallen', dz: '多數葉片已經掉落。', de: 'Most leaves have fallen.' },
];
const METHOD = [
  ['逐筆確認銀杏', 'Check ginkgo, row by row', '只有來源明確寫到銀杏的地點才列為景點，不憑搜尋摘要或關鍵字判定。26 處景點來自 25 列來源（東京大學這一列對應本郷與駒場兩個不同的地點）。', 'Only places whose sources explicitly mention ginkgo are listed; search snippets and keywords are not enough. The 26 spots come from 25 source rows (the University of Tokyo row covers two different places, Hongo and Komaba).'],
  ['分開資料性質', 'Keep the kinds of information apart', '每一則證據都標示為地點介紹、當季現場觀測、歷史觀測、季節參考／預測、官方一般資訊或第三方資訊，不互相替代。', 'Every piece of evidence is labelled as place introduction, current-season on-site observation, historical observation, seasonal reference or forecast, official general information, or third-party information; none stands in for another.'],
  ['葉況只認當季證據', 'Foliage status needs current-season evidence', '要同時有「銀杏、特定地點、可辨識日期、現場狀況」才算當季現場觀測；否則顯示「尚無當季回報」或「待補證」。楓葉、其他樹種、區域狀況和氣象廳標本木都不套用到個別景點。', 'Only evidence covering ginkgo, a specific place, an identifiable date and an on-site condition counts as a current-season observation; otherwise the status is "No current-season report" or "Evidence pending". Maple colour, other species, regional conditions and the JMA specimen tree are never applied to a single spot.'],
  ['日期分開記錄', 'Dates are recorded separately', '文章或公告日期、照片日期、觀測日期、預測期間與查核日期各自一欄；來源沒有寫的就顯示「資料未提供」。', 'Article or notice date, photo date, observation date, forecast period and checked date each have their own field; anything a source does not state shows as "Not provided".'],
  ['座標與距離', 'Coordinates and distances', '座標沿用 2026-10-02 核實的資料，一律標示為「園區近似位置」並附上依據；沒有可追溯座標的景點只列在清單，不上地圖也不算距離。直線距離用 Haversine 公式計算，步行時間以每分鐘 80 公尺換算，兩者都是估算。', 'Coordinates come from the data verified on 2026-10-02 and are always labelled as approximate park positions with their basis; a spot without traceable coordinates would stay in the list only, off the map and out of distances. Straight-line distances use the haversine formula and walking time is converted at 80 m per minute; both are estimates.'],
  ['名稱', 'Names', '日文原名一律保留。中文名稱是依台灣用字轉寫日文名稱，不是官方名稱；英文名稱只在官方英文頁面能核實時才顯示，否則標示「英文譯名未提供／English name not verified」。', 'Japanese names are always kept. Chinese names are Taiwan-usage renderings of the Japanese names, not official names; an English name is shown only when an official English page confirms it, otherwise the label reads "English name not verified".'],
  ['不做的事', 'What this site does not do', '沒有即時葉況、即時天氣、街景、定位推薦、交通時間或自動更新。資料停在查核日，之後官方的變動不會自動反映。', 'There are no live foliage reports, live weather, street views, location-based recommendations, transit times or automatic updates. The data stops at the checked date and later official changes are not reflected automatically.'],
];
const ATTRIB = [
  ['Leaflet 1.9.4（BSD 2-Clause），從 unpkg.com 載入；需要網路。', 'Leaflet 1.9.4 (BSD 2-Clause), loaded from unpkg.com; needs a network connection.', 'https://leafletjs.com/'],
  ['地圖資料 © OpenStreetMap contributors（ODbL 1.0）；底圖圖磚來自 tile.openstreetmap.org，需要網路。', 'Map data © OpenStreetMap contributors (ODbL 1.0); base-map tiles come from tile.openstreetmap.org and need a network connection.', 'https://www.openstreetmap.org/copyright'],
  ['字體：Noto Serif TC、Noto Sans TC、Shippori Mincho、Cormorant Garamond，經 Google Fonts 載入（SIL Open Font License 1.1）；載入失敗時改用系統字體。', 'Fonts: Noto Serif TC, Noto Sans TC, Shippori Mincho and Cormorant Garamond, loaded through Google Fonts (SIL Open Font License 1.1); system fonts take over if they fail.', 'https://fonts.google.com/'],
  ['插圖：本站自製的內嵌 SVG 與 CSS。沒有使用照片、街景、天氣服務，也沒有仿製特定動畫工作室或藝術家的風格。', 'Illustrations: this site\'s own inline SVG and CSS. No photos, street views or weather services, and no imitation of any animation studio or artist.', null],
  ['Google 地圖連結是外部服務，只有你按下按鈕才會開啟。', 'The Google Maps link is an external service and opens only when you press the button.', 'https://www.google.com/maps'],
];

/* ================= core ================= */
const D = window.GINKGO_DATA;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safeUrl = u => (typeof u === 'string' && /^https?:\/\//i.test(u.trim())) ? u.trim() : '';
const MAX_STOPS = 5, WALK_SPEED = 80, FAR_M = 2500;
const OSM_TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors';
const LEAFLET_PREFIX = '<a href="https://leafletjs.com" target="_blank" rel="noopener noreferrer">Leaflet</a>';
const mqDesktop = window.matchMedia ? window.matchMedia('(min-width: 1024px)') : { matches: true, addEventListener() {} };
const reduceMotion = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

/* ---------- storage that may throw ---------- */
const store = {
  ok: true, warned: false,
  get(k) { try { return window.localStorage.getItem('ginkgo-walk:' + k); } catch (e) { this.ok = false; return null; } },
  set(k, v) { try { window.localStorage.setItem('ginkgo-walk:' + k, v); return true; } catch (e) { this.ok = false; return false; } },
};
function warnStorage() { if (!store.ok && !store.warned) { store.warned = true; toast(t('toast.storage')); } }

/* ---------- language ---------- */
let lang = 'zh';
const savedLang = store.get('lang');
if (savedLang === 'zh' || savedLang === 'en') lang = savedLang;
const li = () => (lang === 'en' ? 1 : 0);
function t(key, ...a) {
  const e = T[key]; if (!e) return key;
  return String(e[li()] != null ? e[li()] : e[0]).replace(/\{(\d+)\}/g, (m, i) => (a[i] !== undefined ? a[i] : ''));
}
const th = (key, ...a) => t(key, ...a.map(esc));
const bi = o => (o && typeof o === 'object' && !Array.isArray(o)) ? (o[lang] != null && o[lang] !== '' ? o[lang] : (o.zh != null ? o.zh : (o.en != null ? o.en : ''))) : (o == null ? '' : o);
const pair = p => Array.isArray(p) ? (p[li()] != null ? p[li()] : p[0]) : p;

/* ---------- data guard and normalising ---------- */
function showDataError() {
  const sec = $('#explore .wrap') || document.body;
  sec.innerHTML = '<div class="empty"><h4>' + esc(T['err.data.h'][0]) + ' / ' + esc(T['err.data.h'][1]) + '</h4><p>' + esc(T['err.data.p'][1]) + '</p><p lang="zh-Hant">' + esc(T['err.data.p'][0]).replace(/ \/ [\s\S]*$/, '') + '</p></div>';
}
const dataOk = !!(D && Array.isArray(D.spots) && D.spots.length);
const hasCoord = s => !!s && Number.isFinite(Number(s.lat)) && Number.isFinite(Number(s.lng)) && s.lat !== null && s.lng !== null && s.lat !== '' && s.lng !== '';
const SPOTS = dataOk ? D.spots.filter(s => s && s.id).map(s => {
  const o = Object.assign({}, s);
  o.name_ja = o.name_ja || o.name_zh || o.id;
  o.name_zh = o.name_zh || '';
  o.area = o.area || {}; o.intro = o.intro || {}; o.ginkgo = o.ginkgo || {}; o.info = o.info || {};
  o.coord = o.coord || {}; o.evidence = Array.isArray(o.evidence) ? o.evidence : [];
  o.notes = Array.isArray(o.notes) ? o.notes : []; o.unverified = Array.isArray(o.unverified) ? o.unverified : [];
  o.aliases = Array.isArray(o.aliases) ? o.aliases : [];
  o.lat = hasCoord(s) ? Number(s.lat) : null; o.lng = hasCoord(s) ? Number(s.lng) : null;
  return o;
}) : [];
const SOURCES = (dataOk && Array.isArray(D.sources)) ? D.sources : [];
const META = (dataOk && D.meta) || {};
const spotById = new Map(SPOTS.map(s => [s.id, s]));
const spotIndex = new Map(SPOTS.map((s, i) => [s.id, i + 1]));
const rowById = new Map(SOURCES.map(r => [r.source_id, r]));
const REGIONS = (dataOk && D.regions) || {};
const GRADES = (dataOk && D.grades) || {};
function statusKey(s) {
  if (s.now === 'live' && Number.isInteger(s.stage) && s.stage >= 1 && s.stage <= 6) return 'stage' + s.stage;
  return s.now === 'pending' ? 'pending' : 'none';
}
const statusLabel = k => k === 'none' ? t('status.none') : k === 'pending' ? t('status.pending') : lang === 'en' ? STAGES[+k.slice(5) - 1].en : STAGES[+k.slice(5) - 1].ja;
const glyph = (id, cls) => '<svg' + (cls ? ' class="' + cls + '"' : '') + ' viewBox="0 0 100 100" aria-hidden="true" focusable="false"><use href="#' + id + '"/></svg>';
const statusGlyph = k => glyph(k === 'none' ? 'st-none' : k === 'pending' ? 'st-pend' : 'st' + k.slice(5));
const regionName = k => bi(REGIONS[k]) || k;

/* ---------- state ---------- */
const ST = { q: '', region: '', grade: '', status: '', selected: null, detail: null, route: [], tab: 'list', filtersOpen: false };
(function loadRoute() {
  let r = null;
  try { r = JSON.parse(store.get('route') || 'null'); } catch (e) { r = null; }
  if (Array.isArray(r)) {
    const seen = new Set();
    ST.route = r.filter(id => { const s = spotById.get(id); if (!s || !hasCoord(s) || seen.has(id)) return false; seen.add(id); return true; }).slice(0, MAX_STOPS);
  }
})();

/* ---------- search and filters ---------- */
const norm = s => String(s == null ? '' : s).normalize('NFKC').toLowerCase().replace(/[\s　・･·\-_/()（）「」『』,，、。:：]+/g, '');
function haystack(s) {
  return norm([s.id, s.source_id, s.name_ja, s.name_zh, s.name_en, s.area.zh, s.area.en, s.aliases.join(' ')].join(' '));
}
const HAY = new Map(SPOTS.map(s => [s.id, haystack(s)]));
function matches(s, skip) {
  const f = ST;
  if (skip !== 'region' && f.region && s.region !== f.region) return false;
  if (skip !== 'grade' && f.grade && ((rowById.get(s.source_id) || {}).grade !== f.grade)) return false;
  if (skip !== 'status' && f.status && statusKey(s) !== f.status) return false;
  if (f.q) {
    const terms = String(f.q).normalize('NFKC').toLowerCase().split(/\s+/).map(norm).filter(Boolean);
    const h = HAY.get(s.id) || '';
    if (!terms.every(x => h.includes(x))) return false;
  }
  return true;
}
const filtered = () => SPOTS.filter(s => matches(s));
const activeFilterCount = () => (ST.region ? 1 : 0) + (ST.grade ? 1 : 0) + (ST.status ? 1 : 0);
const anyFilter = () => !!(ST.q || ST.region || ST.grade || ST.status);

/* ---------- geometry ---------- */
function haversine(a, b) {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
function fmtDist(m) {
  if (m < 1000) return Math.max(50, Math.round(m / 50) * 50) + ' ' + t('u.m');
  return (m / 1000).toFixed(1) + ' ' + t('u.km');
}
function fmtTime(m) {
  const min = Math.max(1, Math.round(m / WALK_SPEED));
  if (min < 60) return min + ' ' + t('u.min');
  const h = Math.floor(min / 60), r = min % 60;
  return h + ' ' + t('u.h') + (r ? ' ' + r + ' ' + t('u.mm') : '');
}
const routeSpots = () => ST.route.map(id => spotById.get(id)).filter(Boolean);
function legs() {
  const rs = routeSpots(), out = [];
  for (let i = 0; i < rs.length - 1; i++) out.push(haversine(rs[i], rs[i + 1]));
  return out;
}

/* ---------- toast ---------- */
let toastTimer = 0;
function toast(msg, action) {
  const el = $('#toast'); if (!el) return;
  el.textContent = '';
  const sp = document.createElement('span'); sp.textContent = msg; el.appendChild(sp);
  if (action) { const a = document.createElement('a'); a.href = action.href; a.textContent = action.label; a.addEventListener('click', () => { closeDetail({ restore: false }); el.hidden = true; }); el.appendChild(a); }
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, action ? 7000 : 4500);
}

/* ---------- static i18n ---------- */
function applyStatic() {
  document.documentElement.lang = lang === 'en' ? 'en' : 'zh-Hant';
  document.title = t('title');
  const md = $('meta[name="description"]'); if (md) md.setAttribute('content', t('meta.desc'));
  $$('[data-t]').forEach(el => { el.textContent = t(el.getAttribute('data-t')); });
  $$('[data-t-ph]').forEach(el => el.setAttribute('placeholder', t(el.getAttribute('data-t-ph'))));
  $$('[data-t-aria]').forEach(el => { if (el.id !== 'ribbon') el.setAttribute('aria-label', t(el.getAttribute('data-t-aria'))); });
  $$('.lang-btn').forEach(b => b.setAttribute('aria-pressed', String(b.getAttribute('data-lang') === lang)));
  const br = $('.brand'); if (br) br.setAttribute('aria-label', t('title'));
  $('#pane-list').setAttribute('aria-label', t('pane.list'));
  $('#pane-map').setAttribute('aria-label', t('pane.map'));
}

/* ---------- hero ---------- */
function renderHero() {
  const nPend = SPOTS.filter(s => statusKey(s) === 'pending').length;
  const nNone = SPOTS.filter(s => statusKey(s) === 'none').length;
  const nLive = SPOTS.filter(s => statusKey(s).startsWith('stage')).length;
  $('#ledger').innerHTML =
    '<div><dt>' + esc(t('led.checked')) + '</dt><dd>' + esc(META.snapshot || t('d.na')) + '</dd><dd class="sub">' + esc(t('led.checked.sub', META.sheetAudited || t('d.na'))) + '</dd></div>' +
    '<div><dt>' + esc(t('led.spots')) + '</dt><dd>' + SPOTS.length + '</dd><dd class="sub">' + esc(t('led.spots.sub')) + '</dd></div>' +
    '<div><dt>' + esc(t('led.now')) + '</dt><dd>' + nLive + '</dd><dd class="sub">' + esc(t('led.now.sub', nPend)) + '</dd></div>';
  const pendNames = SPOTS.filter(s => statusKey(s) === 'pending').map(s => lang === 'en' ? (s.name_en || s.name_ja) : s.name_ja);
  const namesHtml = pendNames.map(n => '<span lang="ja">' + esc(n) + '</span>').join(lang === 'en' ? ', ' : '、');
  $('#hero-status').innerHTML = nPend ? esc(t('hero.status', nNone, nPend, '@@NAMES@@')).replace('@@NAMES@@', namesHtml) : esc(t('hero.status.nopending', nNone));
  $('#foot-meta').textContent = t('foot.meta', META.snapshot || '', META.sheetAudited || '', META.built || '');
}

/* ---------- filter controls ---------- */
function optHtml(v, label, sel) { return '<option value="' + esc(v) + '"' + (sel ? ' selected' : '') + '>' + esc(label) + '</option>'; }
function renderFilters() {
  const regions = Object.keys(REGIONS);
  const rc = {}; SPOTS.forEach(s => { rc[s.region] = (rc[s.region] || 0) + 1; });
  $('#f-region').innerHTML = optHtml('', t('f.all') + '（' + SPOTS.length + '）', !ST.region) + regions.filter(k => rc[k]).map(k => optHtml(k, regionName(k) + '（' + rc[k] + '）', ST.region === k)).join('');
  const gc = {}; SPOTS.forEach(s => { const g = (rowById.get(s.source_id) || {}).grade; if (g) gc[g] = (gc[g] || 0) + 1; });
  $('#f-grade').innerHTML = optHtml('', t('f.all') + '（' + SPOTS.length + '）', !ST.grade) + Object.keys(gc).sort().map(g => optHtml(g, g + ' · ' + bi(GRADES[g] || {}) + '（' + gc[g] + '）', ST.grade === g)).join('');
  const cnt = k => SPOTS.filter(s => statusKey(s) === k).length;
  const tok = (value, label, glyphId, n, extra) => '<label class="tok' + (n === 0 && value ? ' zero' : '') + (extra || '') + '"><input type="radio" name="status" value="' + esc(value) + '"' + (ST.status === value ? ' checked' : '') + '><span class="tok-body">' + (glyphId ? glyph(glyphId) : '') + '<span>' + esc(label) + '</span>' + (n != null ? '<span class="tok-n">' + n + '</span>' : '') + '<svg class="tok-check" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 12.5L10 17.5L19 7"/></svg></span></label>';
  let g2 = '';
  for (let i = 1; i <= 6; i++) g2 += tok('stage' + i, lang === 'en' ? STAGES[i - 1].en : STAGES[i - 1].ja, 'st' + i, cnt('stage' + i));
  $('#status-groups').innerHTML =
    '<div class="sg"><p class="sg-h">' + esc(t('f.status.g1')) + '</p><div class="sg-list">' + tok('', t('f.all'), '', SPOTS.length, ' tok-all') + tok('none', t('status.none'), 'st-none', cnt('none')) + tok('pending', t('status.pending'), 'st-pend', cnt('pending')) + '</div></div>' +
    '<div class="sg"><p class="sg-h">' + esc(t('f.status.g2')) + '</p><div class="sg-list">' + g2 + '</div></div>';
  syncFilterUi();
}
function syncFilterUi() {
  const q = $('#q'); if (q.value !== ST.q) q.value = ST.q;
  $('#q-clear').hidden = !ST.q;
  const n = activeFilterCount();
  const b = $('#filter-badge'); b.hidden = n === 0; b.textContent = n;
  $('#f-clear').disabled = !anyFilter();
  const open = ST.filtersOpen;
  $('#filter-panel').classList.toggle('open', open);
  $('#filter-toggle').setAttribute('aria-expanded', String(open));
}

/* ---------- list ---------- */
function rowHtml(s) {
  const idx = String(spotIndex.get(s.id)).padStart(2, '0');
  const pos = ST.route.indexOf(s.id);
  const key = statusKey(s);
  const row = rowById.get(s.source_id) || {};
  const nameZh = (lang === 'zh' && s.name_zh && s.name_zh !== s.name_ja) ? esc(s.name_zh) : '';
  const nameEn = s.name_en ? '<i>' + esc(s.name_en) + '</i>' : '<span class="nv">' + esc(t('name.nv.short')) + '</span>';
  const alt = (nameZh ? nameZh + ' · ' : '') + nameEn;
  const coordOk = hasCoord(s);
  const addLabel = pos >= 0 ? t('spot.remove.aria', s.name_ja, pos + 1) : coordOk ? t('spot.add.aria', s.name_ja) : t('spot.nocoord');
  const addInner = pos >= 0
    ? '<span class="stop-n">' + (pos + 1) + '</span><span class="t-label">' + esc(t('spot.stopn', pos + 1)) + '</span>'
    : '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 5V19M5 12H19"/></svg><span class="t-label">' + esc(t('spot.add')) + '</span>';
  return '<li class="spot' + (ST.selected === s.id ? ' is-selected' : '') + '" data-id="' + esc(s.id) + '">' +
    '<button type="button" class="spot-open" data-act="open"' + (ST.selected === s.id ? ' aria-current="true"' : '') + '>' +
    '<span class="spot-no" aria-hidden="true">' + idx + '</span><span class="spot-body">' +
    '<span class="spot-name" lang="ja">' + esc(s.name_ja) + '</span>' +
    '<span class="spot-alt">' + alt + '</span>' +
    '<span class="spot-meta">' + esc(bi(s.area)) + ' · ' + esc(t('spot.grade', row.grade || '-')) + '</span>' +
    '<span class="spot-status">' + statusGlyph(key) + esc(statusLabel(key)) + '</span></span></button>' +
    '<button type="button" class="spot-add' + (pos >= 0 ? ' is-on' : '') + '" data-act="toggle" aria-label="' + esc(addLabel) + '" title="' + esc(addLabel) + '"' + (!coordOk && pos < 0 ? ' aria-disabled="true"' : '') + '>' + addInner + '</button></li>';
}
function renderList() {
  const items = filtered();
  const ol = $('#spot-list'), empty = $('#empty');
  ol.innerHTML = items.map(rowHtml).join('');
  ol.hidden = items.length === 0;
  const rc = $('#result-count');
  rc.textContent = items.length ? t('result', items.length, SPOTS.length) : t('result.zero', 0, SPOTS.length);
  $('#tab-count').textContent = items.length;
  if (!items.length) {
    const stageSel = /^stage\d$/.test(ST.status);
    const stageName = stageSel ? statusLabel(ST.status) : '';
    empty.innerHTML = '<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false"><use href="#st-none"/></svg>' +
      '<h4>' + (stageSel ? th('empty.stage.h', stageName) : esc(t('empty.h'))) + '</h4>' +
      '<p>' + esc(stageSel ? t('empty.stage.p') : t('empty.p')) + '</p>' +
      '<div class="btn-row">' + (stageSel ? '<button type="button" class="btn" data-act="show-none">' + esc(t('empty.btn.none')) + '</button>' : '') + '<button type="button" class="btn btn-primary" data-act="clear">' + esc(t('empty.btn.clear')) + '</button></div>';
  }
  empty.hidden = items.length !== 0;
}
function updateListSelection() {
  $$('#spot-list .spot').forEach(li => {
    const on = li.getAttribute('data-id') === ST.selected;
    li.classList.toggle('is-selected', on);
    const b = li.querySelector('.spot-open');
    if (on) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
  });
}
function scrollNow(fn) { try { fn('instant'); } catch (e) { fn('auto'); } }
function scrollListTo(id, behavior) {
  const li = $('#spot-list .spot[data-id="' + CSS.escape(id) + '"]'); if (!li) return;
  const pane = $('#pane-list');
  const mode = b => (behavior && behavior !== 'instant' ? behavior : b);
  if (mqDesktop.matches) {
    const top = li.offsetTop - pane.offsetTop, bottom = top + li.offsetHeight;
    if (top < pane.scrollTop + 8) scrollNow(b => pane.scrollTo({ top: Math.max(0, top - 12), behavior: mode(b) }));
    else if (bottom > pane.scrollTop + pane.clientHeight - 8) scrollNow(b => pane.scrollTo({ top: bottom - pane.clientHeight + 12, behavior: mode(b) }));
  } else scrollNow(b => li.scrollIntoView({ block: 'center', behavior: mode(b) }));
}

/* ---------- selection and detail ---------- */
let lastTrigger = null;
function select(id, opts) {
  opts = opts || {};
  const s = spotById.get(id); if (!s) return;
  ST.selected = id;
  updateListSelection();
  refreshMarkers();
  if (opts.open) openDetail(id, opts.trigger);
  if (opts.fromMap && isListVisible()) scrollListTo(id, reduceMotion() ? 'instant' : 'smooth');
  focusOnMap(id);
}
const isListVisible = () => mqDesktop.matches || ST.tab === 'list';
const isMapVisible = () => mqDesktop.matches || ST.tab === 'map';
function setBackgroundInert(on) {
  const sel = ['#top', '#hero', '#filters', '#tabs', '.panes', '#foliage', '#walk', '#sources', '#foot'];
  sel.forEach(q => { const el = $(q); if (el) { if (on) el.setAttribute('inert', ''); else el.removeAttribute('inert'); } });
}
function applyDetailMode() {
  const det = $('#detail'); if (det.hidden) { $('#scrim').hidden = true; setBackgroundInert(false); document.documentElement.style.overflow = ''; return; }
  const modal = !mqDesktop.matches;
  det.setAttribute('aria-modal', String(modal));
  $('#scrim').hidden = !modal;
  setBackgroundInert(modal);
  document.documentElement.style.overflow = modal ? 'hidden' : '';
}
function openDetail(id, trigger) {
  const s = spotById.get(id); if (!s) return;
  const det = $('#detail');
  const wasOpen = !det.hidden;
  ST.detail = id;
  if (!wasOpen) lastTrigger = trigger || document.activeElement;
  renderDetail();
  det.hidden = false;
  if (!wasOpen && !reduceMotion()) { det.classList.remove('anim-in'); void det.offsetWidth; det.classList.add('anim-in'); }
  applyDetailMode();
  $('#detail-body').scrollTop = 0;
  try { det.focus({ preventScroll: true }); } catch (e) { det.focus(); }
  focusOnMap(id);
}
function closeDetail(opts) {
  opts = opts || { restore: true };
  const det = $('#detail'); if (det.hidden) return;
  det.hidden = true; ST.detail = null;
  applyDetailMode();
  if (opts.restore !== false) {
    let tgt = lastTrigger;
    if (!tgt || !document.contains(tgt) || (tgt.offsetParent === null && !(tgt.getBoundingClientRect && tgt.getBoundingClientRect().width))) {
      tgt = ST.selected ? $('#spot-list .spot[data-id="' + CSS.escape(ST.selected) + '"] .spot-open') : null;
    }
    if (tgt && tgt.focus) { try { tgt.focus({ preventScroll: true }); } catch (e) { tgt.focus(); } }
  }
  lastTrigger = null;
}
function dateCell(v) {
  const x = pair(v);
  return x ? '<dd>' + esc(x) + '</dd>' : '<dd class="na">' + esc(t('d.na')) + '</dd>';
}
function telText(v) { if (!v) return ''; if (typeof v === 'string') return v; const lb = lang === 'en' ? v.en : v.zh; return v.num + (lb ? (lang === 'en' ? ' (' + lb + ')' : '（' + lb + '）') : ''); }
function infoRow(label, v, isJa) {
  const x = (v && typeof v === 'object') ? bi(v) : v;
  return '<div><dt>' + esc(label) + '</dt>' + (x ? '<dd' + (isJa ? ' lang="ja"' : '') + '>' + esc(x) + '</dd>' : '<dd class="na">' + esc(t('d.na')) + '</dd>') + '</div>';
}
const JA_RUN = /[぀-ヿ㐀-鿿][぀-ヿ㐀-鿿ー・s]*[぀-ヿ㐀-鿿]|[぀-ヿ㐀-鿿]/g;
const jaWrap = h => (lang === 'en' ? h.replace(JA_RUN, m => '<span lang="ja">' + m + '</span>') : h);
const SRC_FIELDS = ['source_id', 'group_id', 'name', 'area', 'grade', 'operator', 'role', 'url', 'extra_url', 'evidence_url', 'evidence_date', 'finding', 'cadence', 'suggested_poll', 'caveat', 'access', 'species', 'audited_at'];
const SRC_TR = new Set(['area', 'name', 'operator', 'role', 'finding', 'cadence', 'suggested_poll', 'caveat', 'access', 'species', 'evidence_date']);
const isDead = r => r.use === 'excluded' && /404/.test(r.access || '');
function srcFieldHtml(r, k) {
  const raw = r[k];
  let body;
  if (!raw && raw !== 0) body = '<dd class="na">' + esc(t('d.na')) + '</dd>';
  else if (k === 'url' && isDead(r)) body = '<dd>' + esc(raw) + '<span class="orig">' + esc(t('src.dead')) + '</span></dd>';
  else if (k === 'url' || k === 'extra_url' || k === 'evidence_url') { const u = safeUrl(raw); body = '<dd>' + (u ? '<a href="' + esc(u) + '" target="_blank" rel="noopener noreferrer">' + esc(u) + '</a>' : esc(raw)) + '</dd>'; }
  else if (k === 'grade') { const g = GRADES[raw]; body = '<dd><b>' + esc(raw) + '</b>' + (g ? ' · ' + esc(bi(g)) : '') + (g ? '<span class="orig">' + esc(lang === 'en' ? g.noteEn : g.noteZh) + '</span>' : '') + '</dd>'; }
  else if (lang === 'en' && SRC_TR.has(k) && r.en && r.en[k] != null && r.en[k] !== raw) body = '<dd>' + jaWrap(esc(r.en[k])) + '<span class="orig"><span class="d-tag">' + esc(t('d.src.orig')) + ':</span> <span lang="zh-Hant">' + esc(raw) + '</span></span></dd>';
  else body = '<dd>' + jaWrap(esc(raw)) + '</dd>';
  return '<div><dt>' + esc(k) + '</dt>' + body + '</div>';
}
function coordHtml(s) {
  if (!hasCoord(s)) return '<section class="d-sec"><h4 class="d-h">' + esc(t('d.coord.h')) + '</h4><p class="d-p">' + esc(t('d.nocoord')) + '</p></section>';
  const c = s.coord;
  const srcs = (c.sources || []).map(u => safeUrl(u)).filter(Boolean).map(u => { let h = u; try { h = new URL(u).hostname.replace(/^www\./, ''); } catch (e) { /* keep */ } return '<li><a href="' + esc(u) + '" target="_blank" rel="noopener noreferrer">' + esc(h) + '</a></li>'; }).join('');
  const osm = 'https://www.openstreetmap.org/?mlat=' + s.lat + '&mlon=' + s.lng + '#map=16/' + s.lat + '/' + s.lng;
  return '<section class="d-sec"><h4 class="d-h">' + esc(t('d.coord.h')) + '</h4><p class="d-p">' + esc(t('d.coord.p')) + '</p>' +
    '<dl class="kv">' +
    infoRow(t('d.coord.type'), t('ct.' + (c.kind || 'park'))) +
    infoRow(t('d.coord.point'), c.label) +
    infoRow(t('d.coord.basis'), c.basis) +
    infoRow(t('d.coord.conf'), c.confidence ? t('cf.' + c.confidence) : '') +
    infoRow(t('d.coord.lat'), s.lat.toFixed(4) + ', ' + s.lng.toFixed(4)) +
    (srcs ? '<div><dt>' + esc(t('d.coord.srcs')) + '</dt><dd><ul class="srcs">' + srcs + '</ul></dd></div>' : '') +
    '</dl><p class="d-p"><a href="' + esc(osm) + '" target="_blank" rel="noopener noreferrer">' + esc(t('d.coord.osm')) + '</a></p></section>';
}
function renderDetail() {
  const s = spotById.get(ST.detail); if (!s) return;
  const row = rowById.get(s.source_id) || {};
  const key = statusKey(s);
  $('#detail-kicker').textContent = spotIndex.get(s.id) + ' / ' + SPOTS.length + ' · ' + s.source_id + ' · ' + bi(s.area);
  $('#detail-title').textContent = s.name_ja;
  const zh = (lang === 'zh' && s.name_zh && s.name_zh !== s.name_ja) ? esc(s.name_zh) + ' · ' : '';
  $('#detail-names').innerHTML = zh + (s.name_en ? '<i>' + esc(s.name_en) + '</i>' : esc(t('name.nv')));
  const pending = key === 'pending';
  let h = '<section class="d-sec"><h4 class="d-h">' + esc(t('d.status.h')) + '</h4><div class="d-status">' + statusGlyph(key) + '<p class="st">' + esc(statusLabel(key)) + '</p><p>' + esc(pending ? bi(s.nowNote) : t('d.status.none.p')) + '</p></div></section>';
  h += '<section class="d-sec"><h4 class="d-h">' + esc(t('d.ev.h')) + '</h4><p class="d-p">' + esc(bi(s.intro)) + '</p><p class="d-p" style="margin-top:8px">' + esc(bi(s.ginkgo)) + '</p><ul class="ev-list" style="margin-top:12px">' +
    s.evidence.map(e => {
      const u = safeUrl(e.url), d = e.dates || {};
      return '<li><span class="kind kind-' + esc(e.kind) + '">' + esc(t('kind.' + e.kind)) + '</span><p class="ev-text">' + esc(bi(e)) + '</p>' +
        (u ? '<a class="ev-link" href="' + esc(u) + '" target="_blank" rel="noopener noreferrer">' + esc(t('d.link.src')) + '</a>' : '') +
        '<dl class="dates"><div><dt>' + esc(t('dt.article')) + '</dt>' + dateCell(d.article) + '</div><div><dt>' + esc(t('dt.photo')) + '</dt>' + dateCell(d.photo) + '</div><div><dt>' + esc(t('dt.observed')) + '</dt>' + dateCell(d.observed) + '</div><div><dt>' + esc(t('dt.forecast')) + '</dt>' + dateCell(d.forecast) + '</div><div><dt>' + esc(t('dt.checked')) + '</dt>' + dateCell(d.checked) + '</div></dl>' +
        (e.note ? '<p class="ev-note">' + esc(bi(e.note)) + '</p>' : '') + '</li>';
    }).join('') + '</ul><p class="note" style="margin-top:8px;font-size:13.5px">' + esc(t('d.ev.checked')) + '</p></section>';
  h += sourceBlock(s, row);
  const sheetNote = row.caveat ? '<li><b>' + esc(t('d.sheetnote')) + '：</b>' + esc(lang === 'en' && row.en && row.en.caveat ? row.en.caveat : row.caveat) + (lang === 'en' && row.en && row.en.caveat && row.en.caveat !== row.caveat ? '<span class="orig" lang="zh-Hant">' + esc(row.caveat) + '</span>' : '') + '</li>' : '';
  if (s.notes.length || s.unverified.length || sheetNote) {
    h += '<section class="d-sec">' + (s.notes.length || sheetNote ? '<h4 class="d-h">' + esc(t('d.notes.h')) + '</h4><ul class="bul">' + sheetNote + s.notes.map(n => '<li>' + esc(bi(n)) + '</li>').join('') + '</ul>' : '') +
      (s.unverified.length ? '<h4 class="d-h" style="margin-top:' + (s.notes.length ? 16 : 0) + 'px">' + esc(t('d.unv.h')) + '</h4><ul class="bul">' + s.unverified.map(n => '<li>' + esc(bi(n)) + '</li>').join('') + '</ul>' : '') + '</section>';
  }
  const inf = s.info || {};
  h += '<section class="d-sec"><h4 class="d-h">' + esc(t('d.info.h')) + '</h4><dl class="kv">' +
    infoRow(t('d.hours'), inf.hours) + infoRow(t('d.closed'), inf.closed) + infoRow(t('d.fee'), inf.fee) + infoRow(t('d.access'), inf.access) +
    infoRow(t('d.address'), inf.address, true) + infoRow(t('d.tel'), telText(inf.tel)) + '</dl><p class="note" style="margin-top:8px;font-size:13.5px">' + esc(t('d.info.note')) + '</p></section>';
  h += coordHtml(s);
  if (row.source_id) h += '<section class="d-sec"><details class="d-det"><summary>' + esc(t('d.src.h')) + '</summary><p class="note" style="font-size:13.5px;margin-bottom:6px">' + esc(t('d.src.p')) + '</p><dl class="kv src-more-kv">' + SRC_FIELDS.map(k => srcFieldHtml(row, k)).join('') + '</dl></details></section>';
  h += '<p class="d-p" style="padding:6px 0 2px;font-weight:700;color:var(--green)">' + esc(t('d.final')) + '</p>';
  $('#detail-body').innerHTML = h;
  updateDetailFoot();
}
function sourceBlock(s, row) {
  if (!row || !row.source_id) return '';
  const en = row.en || {};
  const g = GRADES[row.grade];
  const op = lang === 'en' ? (en.operator || row.operator) : row.operator;
  const cadRaw = row.cadence || '', cadTr = lang === 'en' ? (en.cadence || cadRaw) : cadRaw;
  const unpub = !cadRaw || /未確認|尚未確認|待查|未承諾/.test(cadRaw);
  const cad = !cadRaw ? t('d.unpublished') : (unpub ? t('d.unpublished') + '（' + (lang === 'en' ? 'source sheet: ' : '來源表：') + cadTr + '）' : cadTr);
  const gradeDd = g ? '<dd><b>' + esc(row.grade) + '</b> · ' + esc(bi(g)) + '<span class="orig">' + esc(lang === 'en' ? g.noteEn : g.noteZh) + '</span></dd>' : '<dd class="na">' + esc(t('d.na')) + '</dd>';
  return '<section class="d-sec"><h4 class="d-h">' + esc(t('d.src2.h')) + '</h4><dl class="kv">' +
    '<div><dt>' + esc(t('d.operator')) + '</dt><dd>' + esc(op || t('d.na')) + '</dd></div>' +
    '<div><dt>' + esc(t('d.grade')) + '</dt>' + gradeDd + '</div>' +
    '<div><dt>' + esc(t('d.cadence')) + '</dt><dd>' + esc(cad) + '</dd></div>' +
    '<div><dt>' + esc(t('d.audit')) + '</dt><dd>' + esc(row.audited_at || t('d.na')) + '</dd></div></dl></section>';
}
function updateDetailFoot() {
  const s = spotById.get(ST.detail); if (!s) return;
  const add = $('#detail-add'), pos = ST.route.indexOf(s.id);
  add.textContent = pos >= 0 ? t('d.remove', pos + 1) : t('d.add');
  if (!hasCoord(s) && pos < 0) add.setAttribute('aria-disabled', 'true'); else add.removeAttribute('aria-disabled');
  add.classList.toggle('is-on', pos >= 0);
  const row = rowById.get(s.source_id) || {};
  const a = $('#detail-official'), u = safeUrl(row.url);
  a.textContent = t('d.official');
  if (u) { a.href = u; a.removeAttribute('aria-disabled'); } else { a.removeAttribute('href'); a.setAttribute('aria-disabled', 'true'); }
}

/* ---------- route ---------- */
function saveRoute() { store.set('route', JSON.stringify(ST.route)); warnStorage(); }
function addStop(id, opts) {
  const s = spotById.get(id); if (!s) return false;
  if (ST.route.includes(id)) return false;
  if (!hasCoord(s)) { setHint('walk.hint.nocoord'); toast(t('walk.hint.nocoord')); return false; }
  if (ST.route.length >= MAX_STOPS) { setHint('walk.hint.max'); toast(t('toast.max')); return false; }
  ST.route.push(id); saveRoute();
  afterRouteChange();
  toast(t('toast.added', ST.route.length, s.name_ja), { href: '#walk', label: t('toast.see') });
  return true;
}
function removeStop(id) {
  const i = ST.route.indexOf(id); if (i < 0) return;
  ST.route.splice(i, 1); saveRoute();
  const s = spotById.get(id);
  afterRouteChange();
  toast(t('toast.removed', s ? s.name_ja : id));
}
function moveStop(id, dir) {
  const i = ST.route.indexOf(id), j = i + dir;
  if (i < 0 || j < 0 || j >= ST.route.length) return;
  const x = ST.route[i]; ST.route[i] = ST.route[j]; ST.route[j] = x; saveRoute();
  afterRouteChange();
  const s = spotById.get(id);
  $('#walk-hint').textContent = t('toast.moved', s ? s.name_ja : id, j + 1);
}
function clearRoute() { ST.route = []; saveRoute(); afterRouteChange(); $('#walk-hint').textContent = t('toast.cleared'); }
function toggleStop(id) { if (ST.route.includes(id)) removeStop(id); else addStop(id); }
function afterRouteChange() {
  hintKey = null;
  renderList(); renderWalk(); updateRibbon(); updateDetailFoot(); refreshMarkers(); drawRoute();
  if (map && isMapVisible() && ST.route.length >= 2) { const b = mapBox(); if (b.w && b.h) fitAll(b); }
}
let hintKey = null;
function setHint(k) { hintKey = k; $('#walk-hint').textContent = k ? t(k) : ''; }
function updateRibbon() {
  const n = ST.route.length;
  $('#ribbon-n').textContent = n + '/' + MAX_STOPS;
  $('#ribbon').setAttribute('aria-label', t('ribbon.aria', n));
}
function gmapsUrl() {
  const pts = routeSpots().map(s => s.lat + ',' + s.lng);
  if (pts.length < 2) return '';
  let u = 'https://www.google.com/maps/dir/?api=1&origin=' + encodeURIComponent(pts[0]) + '&destination=' + encodeURIComponent(pts[pts.length - 1]);
  if (pts.length > 2) u += '&waypoints=' + encodeURIComponent(pts.slice(1, -1).join('|'));
  return u;
}
function stopSvgLine() {
  return '<svg viewBox="0 0 360 80" aria-hidden="true" focusable="false"><g fill="none" stroke="#23251f" stroke-width="1.6"><circle cx="40" cy="40" r="19" stroke-opacity=".55"/><circle cx="180" cy="40" r="19" stroke-opacity=".55"/><circle cx="320" cy="40" r="19" stroke-opacity=".3" stroke-dasharray="2 4"/><path d="M62 40H158M202 40H298" stroke-dasharray="1 7" stroke-linecap="round" stroke-opacity=".6"/></g><g font-family="Cormorant Garamond, Georgia, serif" font-style="italic" font-weight="700" font-size="22" fill="#44463c" text-anchor="middle"><text x="40" y="48">1</text><text x="180" y="48">2</text><text x="320" y="48" fill-opacity=".5">3</text></g></svg>';
}
function renderWalk() {
  const rs = routeSpots(), n = rs.length, lg = legs();
  // select
  const sel = $('#walk-select'), prev = sel.value;
  sel.innerHTML = '<option value="">' + esc(t('walk.select.ph')) + '</option>' + SPOTS.filter(s => hasCoord(s) && !ST.route.includes(s.id)).map(s => '<option value="' + esc(s.id) + '">' + esc(s.name_ja + (lang === 'zh' && s.name_zh && s.name_zh !== s.name_ja ? '（' + s.name_zh + '）' : '')) + '</option>').join('');
  if (prev && ST.route.indexOf(prev) < 0) sel.value = prev;
  $('#walk-add-btn').disabled = n >= MAX_STOPS;
  sel.disabled = n >= MAX_STOPS;
  // hint
  const hk = n >= MAX_STOPS ? 'walk.hint.max' : n === 0 ? 'walk.hint.0' : n === 1 ? 'walk.hint.1' : null;
  if (hintKey === null || /^walk\.hint\.(0|1|max)$/.test(hintKey)) { hintKey = hk; $('#walk-hint').textContent = hk ? t(hk) : ''; }
  // itinerary
  const it = $('#itinerary');
  it.hidden = n === 0;
  it.innerHTML = rs.map((s, i) => {
    const sub = t('stop.sub', bi(s.area));
    const leg = i < n - 1 ? '<div class="leg-wrap"><p class="leg">' + esc(t('leg', fmtDist(lg[i]), fmtTime(lg[i]))) + (lg[i] > FAR_M ? '<small>' + esc(t('leg.far')) + '</small>' : '') + '</p></div>' : '';
    const ico = p => '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="' + p + '"/></svg>';
    return '<li class="stop" data-id="' + esc(s.id) + '"><span class="stop-no" aria-hidden="true">' + (i + 1) + '</span>' +
      '<div class="stop-main"><button type="button" class="stop-name" lang="ja" data-act="open" aria-label="' + esc(t('stop.open.aria', s.name_ja)) + '">' + esc(s.name_ja) + '</button><span class="stop-sub">' + esc(sub) + '</span></div>' +
      '<div class="stop-tools">' +
      '<button type="button" class="tool" data-act="up" aria-label="' + esc(t('stop.up.aria', s.name_ja)) + '"' + (i === 0 ? ' disabled' : '') + '>' + ico('M12 19V5M6 11L12 5L18 11') + '<span>' + esc(t('stop.up')) + '</span></button>' +
      '<button type="button" class="tool" data-act="down" aria-label="' + esc(t('stop.down.aria', s.name_ja)) + '"' + (i === n - 1 ? ' disabled' : '') + '>' + ico('M12 5V19M6 13L12 19L18 13') + '<span>' + esc(t('stop.down')) + '</span></button>' +
      '<button type="button" class="tool" data-act="remove" aria-label="' + esc(t('stop.remove.aria', s.name_ja)) + '">' + ico('M6 6L18 18M18 6L6 18') + '<span>' + esc(t('stop.remove')) + '</span></button></div>' + leg + '</li>';
  }).join('');
  $('#walk-empty').hidden = n > 0;
  $('#walk-empty').innerHTML = n === 0 ? stopSvgLine() + '<p>' + esc(t('walk.empty.p')) + '</p>' : '';
  // summary
  const total = lg.reduce((a, b) => a + b, 0), url = gmapsUrl();
  let sum = '<h3 id="walk-sum-h">' + esc(t('sum.h')) + '</h3>';
  if (n >= 2) {
    sum += '<dl class="sum-grid"><div><dt>' + esc(t('sum.stops')) + '</dt><dd>' + n + '</dd></div><div><dt>' + esc(t('sum.dist')) + '</dt><dd>' + esc(t('sum.about', fmtDist(total))) + '</dd></div><div><dt>' + esc(t('sum.time')) + '</dt><dd>' + esc(t('sum.about', fmtTime(total))) + '</dd></div></dl>' +
      '<p class="sum-note">' + esc(t('sum.note1')) + '</p><p class="sum-note">' + esc(t('sum.note2')) + '</p>' +
      '<div class="sum-actions"><a class="btn btn-primary" id="gmaps" href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + esc(t('sum.gmaps')) + '</a><p class="sum-note" style="margin:0">' + esc(t('sum.gmaps.note')) + '</p><button type="button" class="btn" data-act="clear-route">' + esc(t('sum.clear')) + '</button></div>';
  } else {
    sum += '<p class="sum-note">' + esc(t('sum.empty')) + '</p>' + (n === 1 ? '<div class="sum-actions"><button type="button" class="btn" data-act="clear-route">' + esc(t('sum.clear')) + '</button></div>' : '');
  }
  $('#walk-sum').innerHTML = sum;
}

/* ---------- foliage, kinds, JMA ---------- */
function renderFoliage() {
  $('#stage-list').innerHTML = STAGES.map((st, i) => '<li class="stage"><div class="stage-top">' + glyph('st' + (i + 1), 'stage-leaf') + '<span class="stage-no" aria-hidden="true">' + (i + 1) + '</span></div><span class="stage-ja" lang="ja">' + esc(st.ja) + '</span><span class="stage-name">' + esc(lang === 'en' ? st.en : st.zh) + '</span><span class="stage-desc">' + esc(lang === 'en' ? st.de : st.dz) + '</span></li>').join('');
  $('#nostage-list').innerHTML =
    '<div>' + glyph('st-none') + '<dt>' + esc(t('fol.none.t')) + '</dt><dd>' + esc(t('fol.none.p')) + '</dd></div>' +
    '<div>' + glyph('st-pend') + '<dt>' + esc(t('fol.pend.t')) + '</dt><dd>' + esc(t('fol.pend.p')) + '</dd></div>';
  $('#kind-list').innerHTML = ['intro', 'now', 'history', 'season', 'official', 'third'].map(k => '<div><dt><span class="kind kind-' + k + '">' + esc(t('kind.' + k)) + '</span></dt><dd>' + esc(t('kind.' + k + '.d')) + '</dd></div>').join('');
  const j = D && D.jma;
  if (j) {
    const recent = Object.keys(j.yellowRecent || {}).map(y => y + ' ' + j.yellowRecent[y]).join('　');
    const link = (u, k) => '<a href="' + esc(u) + '" target="_blank" rel="noopener noreferrer">' + esc(t(k)) + '</a>';
    $('#jma-body').innerHTML =
      '<div><p class="callout">' + esc(t('jma.p')) + '</p><div class="jma-scroll"><table class="jma-table"><thead><tr><th scope="col">' + esc(t('jma.th.item')) + '</th><th scope="col">' + esc(t('jma.th.y')) + '</th><th scope="col">' + esc(t('jma.th.f')) + '</th></tr></thead><tbody>' +
      '<tr><th scope="row">' + esc(t('jma.normal', j.normalPeriod)) + '</th><td>' + esc(j.yellowNormal) + '</td><td>' + esc(j.fallNormal) + '</td></tr>' +
      '<tr><th scope="row">' + esc(t('jma.obs25')) + '</th><td>' + esc(j.yellow2025) + '</td><td>' + esc(j.fall2025) + '</td></tr>' +
      '<tr><th scope="row">' + esc(t('jma.obs26')) + '</th><td>' + esc(j.yellow2026 || t('jma.notyet')) + '</td><td>' + esc(j.fall2026 || t('jma.notyet')) + '</td></tr></tbody></table></div></div>' +
      '<div><h3>' + esc(t('jma.def.h')) + '</h3><ul class="bul"><li>' + esc(t('jma.def.y')) + '</li><li>' + esc(t('jma.def.f')) + '</li></ul><h3 style="margin-top:18px">' + esc(t('jma.recent')) + '</h3><p class="d-p" style="font-variant-numeric:tabular-nums">' + esc(recent) + '</p><p class="note">' + esc(t('jma.vary')) + '</p>' +
      '<p class="d-p" style="margin-top:10px">' + link(j.urls.yellow, 'jma.src') + '　' + link(j.urls.fall, 'jma.src2') + '　' + link(j.urls.csv, 'jma.src3') + '</p></div>';
  }
}

/* ---------- sources ---------- */
const GROUPS = ['spot', 'entry', 'season', 'background', 'third', 'excluded'];
function srcRowHtml(r) {
  const en = r.en || {};
  const name = lang === 'en' ? (en.name || r.name) : r.name;
  const op = lang === 'en' ? (en.operator || r.operator) : r.operator;
  const evd = lang === 'en' ? (en.evidence_date || r.evidence_date) : r.evidence_date;
  const g = GRADES[r.grade];
  const l = (u, k) => { if (k === 'src.link.main' && isDead(r)) return '<span class="dead-link">' + esc(t('src.dead')) + '</span>'; const x = safeUrl(u); return x ? '<a href="' + esc(x) + '" target="_blank" rel="noopener noreferrer">' + esc(t(k)) + '</a>' : ''; };
  const nameJa = lang === 'en' && /[぀-ヿ一-鿿]/.test(name);
  return '<li class="src"><div class="src-top"><span class="src-id">' + esc(r.source_id) + '</span><span class="src-name"' + (nameJa ? ' lang="ja"' : '') + '>' + esc(name) + '</span><span class="src-grade">' + esc(t('spot.grade', r.grade)) + (g ? ' · ' + esc(bi(g)) : '') + '</span></div>' +
    '<p class="src-sup"><b>' + esc(t('src.supports')) + '：</b>' + esc(bi(r.supports)) + '</p>' +
    '<div class="src-meta"><span>' + esc(t('src.operator')) + '：' + jaWrap(esc(op)) + '</span><span>' + esc(t('src.evdate')) + '：' + esc(evd || t('d.na')) + '</span><span>' + esc(t('src.audit')) + '：' + esc(r.audited_at || t('d.na')) + '</span></div>' +
    '<div class="src-links">' + l(r.url, 'src.link.main') + l(r.extra_url, 'src.link.extra') + l(r.evidence_url, 'src.link.evid') + '</div>' +
    '<details class="src-more"><summary>' + esc(t('src.more')) + '</summary><dl class="kv">' + SRC_FIELDS.map(k => srcFieldHtml(r, k)).join('') + '</dl></details></li>';
}
function renderSources() {
  const rows = SOURCES;
  const sr = META.sheetRead || {};
  const ev = new Map();
  SPOTS.forEach(s => s.evidence.forEach(e => { const u = safeUrl(e.url); if (u) { if (!ev.has(u)) ev.set(u, []); ev.get(u).push({ s, e }); } }));
  const grp = k => rows.filter(r => r.use === k);
  const openGroups = new Set(['spot', 'season']);
  const prevOpen = new Set($$('#src-body .src-group[open]').map(d => d.getAttribute('data-g')));
  const keepOpen = prevOpen.size ? prevOpen : openGroups;
  let h = '<div class="src-block"><h3>' + esc(t('src.sheet.h')) + '</h3><p class="d-p" style="margin-top:6px">' + esc(t('src.sheet.p', rows.length, sr.date || '', sr.http || '', META.sheetAudited || '', META.snapshot || '')) + '</p><p class="d-p"><a class="btn" href="' + esc(safeUrl(META.sheetUrl) || '#') + '" target="_blank" rel="noopener noreferrer">' + esc(t('src.sheet.link')) + '</a></p></div>';
  h += '<div class="src-cols"><div class="src-block"><h3>' + esc(t('src.method.h')) + '</h3><ol class="src-steps">' + METHOD.map(m => '<li><b>' + esc(m[li()]) + '</b>' + esc(m[2 + li()]) + '</li>').join('') + '</ol></div>' +
    '<div><div class="src-block"><h3>' + esc(t('src.attr.h')) + '</h3><ul class="attrib">' + ATTRIB.map(a => '<li>' + esc(a[li()]) + (a[2] ? ' <a href="' + esc(a[2]) + '" target="_blank" rel="noopener noreferrer">' + esc(a[2].replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')) + '</a>' : '') + '</li>').join('') + '</ul></div>' +
    '<div class="src-block"><h3>' + esc(t('src.lim.h')) + '</h3><ul class="lim">' + limits().map(x => '<li>' + esc(x).replace(/(.*?)/g, (m, n) => '<span lang="ja">' + n + '</span>') + '</li>').join('') + '</ul></div></div></div>';
  h += '<div class="src-block" style="margin-bottom:12px"><h3>' + esc(t('src.groups.h')) + '</h3><p class="d-p">' + esc(t('src.groups.p', rows.length)) + '</p></div>';
  h += GROUPS.map(k => { const g = grp(k); if (!g.length) return ''; return '<details class="src-group" data-g="' + k + '"' + (keepOpen.has(k) ? ' open' : '') + '><summary><span>' + esc(t('src.group.' + k)) + '</span><span class="cnt">' + esc(t('src.rows', g.length)) + '</span></summary><p class="gnote">' + esc(t('src.group.' + k + '.n')) + '</p><ul>' + g.map(srcRowHtml).join('') + '</ul></details>'; }).join('');
  h += '<details class="src-group" data-g="extra" style="margin-top:28px"' + (keepOpen.has('extra') ? ' open' : '') + '><summary><span>' + esc(t('src.extra.h')) + '</span><span class="cnt">' + ev.size + '</span></summary><p class="gnote">' + esc(t('src.extra.p')) + '</p><ul>' + Array.from(ev.entries()).map(([u, list]) => {
    const names = list.map(x => lang === 'en' ? (x.s.name_en || x.s.name_ja) : x.s.name_ja);
    const e0 = list[0].e;
    return '<li class="src"><div class="src-top"><span class="src-name" lang="ja">' + esc(names.join('、')) + '</span><span class="src-grade">' + esc(t('kind.' + e0.kind)) + '</span></div><p class="src-sup">' + esc(bi(e0)) + '</p><div class="src-meta"><span>' + esc(t('dt.checked')) + '：' + esc(pair((e0.dates || {}).checked) || t('d.na')) + '</span></div><div class="src-links"><a href="' + esc(u) + '" target="_blank" rel="noopener noreferrer">' + esc(u.replace(/^https?:\/\/(www\.)?/, '')) + '</a></div></li>';
  }).join('') + '</ul></details>';
  $('#src-body').innerHTML = h;
}
function limits() {
  const nEn = SPOTS.filter(s => s.name_en).length;
  const pend = SPOTS.filter(s => statusKey(s) === 'pending').map(s => '' + s.name_ja + '');
  return lang === 'en' ? [
    'No official source had published a 2026 foliage stage for any of the ' + SPOTS.length + ' spots when the data was checked on ' + (META.snapshot || '') + '. The only 2026 material is photo captions for ' + (pend.join(', ') || 'none') + ', with no foliage wording.',
    'The 2025 Tokyo Park Association list is a PDF whose text this site could not read itself; its content for the twelve park spots follows the teacher\'s source sheet. Ueno Park\'s and Kiba Park\'s own pages do not mention ginkgo.',
    'Ueno Park\'s opening hours are given differently by two official pages and are marked as to be confirmed.',
    'Only ' + nEn + ' of the ' + SPOTS.length + ' English names are shown, because only those could be confirmed on official English pages; the rest are marked "English name not verified".',
    'All coordinates are approximate park positions, not the position of a tree. Distances are straight-line estimates and walking times use 80 m per minute; they are not navigation times.',
    'The data is a snapshot. Opening hours, fees, closures and events can change, so check the official announcement before you go.',
  ] : [
    '資料查核日（' + (META.snapshot || '') + '）時，沒有任何官方來源為這 ' + SPOTS.length + ' 處景點發布 2026 年的葉況階段。唯一的 2026 年資料是' + (pend.join('、') || '（無）') + '的照片說明，並沒有葉況文字。',
    '東京都公園協會 2025 年度名單是 PDF，本站無法自行讀取其文字；12 處公園景點的內容依老師的來源表記載。上野恩賜公園與木場公園的園區頁本身沒有提到銀杏。',
    '上野恩賜公園的開放時間，兩個官方頁面寫法不同，標示為「待確認」。',
    '26 處景點中只有 ' + nEn + ' 處顯示英文名稱，因為只有這些能在官方英文頁面核實；其餘標示「英文譯名未提供／English name not verified」。',
    '所有座標都是園區近似位置，不是銀杏樹的位置。距離是直線估算，步行時間以每分鐘 80 公尺換算，都不是導航時間。',
    '資料是某一天的快照。開放時間、費用、休園與活動都可能變動，出發前請再查官方公告。',
  ];
}

/* ---------- map ---------- */
let map = null, tileLayer = null, markerLayer = null, routeLayer = null, selTip = null;
const markers = new Map();
const MS = { fitSize: null, tileErr: 0, tileOk: 0, raf: 0, pendingFocus: null, failed: null, hasFit: false, ro: null };
const mapEl = () => $('#map');
function mapBox() { const r = mapEl().getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; }
function showMapMsg(kind, full) {
  const m = $('#map-msg'); MS.failed = kind;
  m.className = 'map-msg' + (full ? ' is-full' : '');
  m.innerHTML = '<strong>' + esc(t('map.fail.' + kind + '.h')) + '</strong>' + esc(t('map.fail.' + kind + '.p')) + (kind === 'tiles' ? '<br><button type="button" class="btn" data-act="map-retry">' + esc(t('map.retry')) + '</button>' : '');
  m.hidden = false;
}
function hideMapMsg() { const m = $('#map-msg'); if (!m.hidden && MS.failed === 'tiles') { m.hidden = true; MS.failed = null; } }
function markerHtml(s) {
  const pos = ST.route.indexOf(s.id), key = statusKey(s);
  const cls = 'mk' + (key === 'pending' ? ' pending' : '') + (pos >= 0 ? ' in-route' : '') + (ST.selected === s.id ? ' is-selected' : '');
  return '<div class="' + cls + '"><span class="mk-ring"></span><span class="mk-dot">' + (pos >= 0 ? pos + 1 : '') + '</span></div>';
}
function markerLabel(s) {
  const pos = ST.route.indexOf(s.id);
  return s.name_ja + '（' + statusLabel(statusKey(s)) + (pos >= 0 ? '，' + t('spot.stopn', pos + 1) : '') + (ST.selected === s.id ? '，' + t('map.marker.sel') : '') + '）';
}
function iconFor(s) { return L.divIcon({ className: 'mk-wrap', html: markerHtml(s), iconSize: [44, 44], iconAnchor: [22, 22] }); }
function labelMarker(m, s) { const el = m.getElement(); if (el) { el.setAttribute('aria-label', markerLabel(s)); el.setAttribute('title', s.name_ja); } }
function syncMarkers() {
  if (!map) return;
  const shown = new Set(filtered().filter(hasCoord).map(s => s.id));
  markers.forEach((m, id) => { if (!shown.has(id)) { markerLayer.removeLayer(m); markers.delete(id); } });
  shown.forEach(id => {
    if (markers.has(id)) return;
    const s = spotById.get(id);
    const m = L.marker([s.lat, s.lng], { icon: iconFor(s), keyboard: true, title: s.name_ja, riseOnHover: true });
    m.bindTooltip(esc(s.name_ja), { direction: 'top', offset: [0, -14], className: 'mk-tip', opacity: 1 });
    let lastAct = 0;
    const act = () => { const n = Date.now(); if (n - lastAct < 400) return; lastAct = n; select(id, { open: true, fromMap: true, trigger: m.getElement() }); };
    m.on('click', act);
    m.on('add', () => { labelMarker(m, s); const el = m.getElement(); if (el && !el._gk) { el._gk = 1; el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); act(); } }); } });
    m.addTo(markerLayer); markers.set(id, m); labelMarker(m, s);
  });
}
function refreshMarkers() {
  if (!map) return;
  markers.forEach((m, id) => { const s = spotById.get(id); m.setIcon(iconFor(s)); labelMarker(m, s); m.setZIndexOffset(ST.selected === id ? 1000 : ST.route.includes(id) ? 500 : 0); });
  if (selTip) { map.removeLayer(selTip); selTip = null; }
  const s = ST.selected && spotById.get(ST.selected);
  if (s && hasCoord(s) && markers.has(s.id)) { selTip = L.tooltip({ permanent: true, direction: 'top', offset: [0, -24], className: 'mk-tip', opacity: 1 }).setLatLng([s.lat, s.lng]).setContent(esc(s.name_ja)); selTip.addTo(map); }
}
function drawRoute() {
  if (!map) return;
  routeLayer.clearLayers();
  const rs = routeSpots();
  if (rs.length >= 2) {
    const pts = rs.map(s => [s.lat, s.lng]);
    L.polyline(pts, { color: '#fcf9f0', weight: 7, opacity: .85, lineCap: 'round', interactive: false }).addTo(routeLayer);
    L.polyline(pts, { color: '#1f3a2b', weight: 3, opacity: .95, dashArray: '1 9', lineCap: 'round', interactive: false }).addTo(routeLayer);
  }
}
function insets() {
  const det = $('#detail');
  if (det.hidden) return { right: 0, bottom: 0 };
  if (mqDesktop.matches) return { right: det.offsetWidth || 0, bottom: 0 };
  return { right: 0, bottom: Math.min(det.offsetHeight || 0, Math.round(mapEl().clientHeight * 0.6)) };
}
function fitAll(b) {
  const items = filtered().filter(hasCoord);
  const ins = insets();
  const opt = { paddingTopLeft: [56, 56], paddingBottomRight: [56 + ins.right, 56 + ins.bottom], animate: false, maxZoom: 15 };
  const rs = routeSpots();
  const pts = rs.length >= 2 ? rs : items;
  if (pts.length >= 2) map.fitBounds(L.latLngBounds(pts.map(s => [s.lat, s.lng])), opt);
  else if (pts.length === 1) map.setView([pts[0].lat, pts[0].lng], 14, { animate: false });
  else map.setView([35.69, 139.62], 10, { animate: false });
}
function createMap(b) {
  const calm = reduceMotion();
  map = L.map(mapEl(), { trackResize: false, zoomControl: true, attributionControl: true, minZoom: 8, maxZoom: 18, zoomSnap: 0.5, preferCanvas: false, zoomAnimation: !calm, fadeAnimation: !calm, markerZoomAnimation: !calm, inertia: !calm });
  map.attributionControl.setPrefix(LEAFLET_PREFIX);
  map.setView([35.69, 139.62], 10, { animate: false });
  tileLayer = L.tileLayer(OSM_TILES, { maxZoom: 19, attribution: OSM_ATTR });
  tileLayer.on('tileerror', () => { MS.tileErr++; if (MS.tileOk === 0 && MS.tileErr >= 3) showMapMsg('tiles', false); });
  tileLayer.on('tileload', () => { MS.tileOk++; hideMapMsg(); });
  tileLayer.addTo(map);
  markerLayer = L.layerGroup().addTo(map);
  routeLayer = L.layerGroup().addTo(map);
  syncMarkers(); drawRoute();
  map.invalidateSize({ animate: false });
  fitAll(b);
  MS.fitSize = b; MS.hasFit = true;
  refreshMarkers();
  if (MS.pendingFocus) { const id = MS.pendingFocus; MS.pendingFocus = null; focusOnMap(id); }
}
function refit() {
  if (!map) return;
  const b = mapBox(); if (!b.w || !b.h) return;
  map.invalidateSize({ animate: false, pan: false });
  const s = ST.selected && spotById.get(ST.selected);
  if (s && hasCoord(s) && markers.has(s.id) && ST.route.length < 2) {
    // 1. keep the focused marker in view (zoom unchanged)
    const sz = map.getSize(); const pt = map.latLngToContainerPoint([s.lat, s.lng]);
    if (pt.x < 40 || pt.y < 40 || pt.x > sz.x - 40 || pt.y > sz.y - 40) focusOnMap(s.id, true);
    else if (!map.getBounds().contains([s.lat, s.lng])) fitAll(b);
  } else fitAll(b);
  MS.fitSize = b;
}
function checkMap() {
  if (typeof L === 'undefined' || MS.failed === 'leaflet') return;
  const b = mapBox(); if (!b.w || !b.h) return; // never act on a 0x0 container
  if (!map) { createMap(b); return; }
  const last = MS.fitSize;
  if (!last) { refit(); return; }
  const dw = Math.abs(b.w - last.w) / Math.max(1, last.w), dh = Math.abs(b.h - last.h) / Math.max(1, last.h);
  const flip = (b.w > b.h) !== (last.w > last.h);
  if (dw > 0.25 || dh > 0.25 || flip) { refit(); return; }
  if (b.w !== map.getSize().x || b.h !== map.getSize().y) map.invalidateSize({ animate: false, pan: true });
  if (MS.pendingFocus) { const id = MS.pendingFocus; MS.pendingFocus = null; focusOnMap(id); }
}
function scheduleMapCheck() { if (MS.raf) return; MS.raf = requestAnimationFrame(() => { MS.raf = 0; checkMap(); }); }
function focusOnMap(id, keepZoom) {
  const s = spotById.get(id);
  if (!s || !hasCoord(s)) return;
  const b = mapBox();
  if (!map || !b.w || !b.h) { MS.pendingFocus = id; return; }
  const ll = L.latLng(s.lat, s.lng), ins = insets(), anim = !reduceMotion();
  if (!markers.has(id)) return;
  if (!keepZoom && map.getZoom() < 12) { map.setView(ll, 13, { animate: false }); map.panBy([ins.right / 2, ins.bottom / 2], { animate: false }); return; }
  map.panInside(ll, { paddingTopLeft: [70, 70], paddingBottomRight: [70 + ins.right, 70 + ins.bottom], animate: anim });
}
function initMap() {
  if (typeof L === 'undefined') { showMapMsg('leaflet', true); $('#map').hidden = true; return; }
  if ('ResizeObserver' in window) { MS.ro = new ResizeObserver(scheduleMapCheck); MS.ro.observe(mapEl()); }
  window.addEventListener('resize', scheduleMapCheck);
  window.addEventListener('orientationchange', scheduleMapCheck);
  scheduleMapCheck();
}
function retryTiles() { if (!tileLayer) return; MS.tileErr = 0; MS.tileOk = 0; $('#map-msg').hidden = true; MS.failed = null; tileLayer.redraw(); }

/* ---------- tabs and layout mode ---------- */
function setTab(name, focus) {
  ST.tab = name === 'map' ? 'map' : 'list';
  const tl = $('#tab-list'), tm = $('#tab-map');
  tl.setAttribute('aria-selected', String(ST.tab === 'list')); tm.setAttribute('aria-selected', String(ST.tab === 'map'));
  tl.tabIndex = ST.tab === 'list' ? 0 : -1; tm.tabIndex = ST.tab === 'map' ? 0 : -1;
  if (!mqDesktop.matches) { $('#pane-list').classList.toggle('is-off', ST.tab !== 'list'); $('#pane-map').classList.toggle('is-off', ST.tab !== 'map'); }
  if (focus) (ST.tab === 'map' ? tm : tl).focus();
  if (ST.tab === 'map') { scheduleMapCheck(); requestAnimationFrame(() => { scheduleMapCheck(); if (ST.selected) focusOnMap(ST.selected, true); }); }
  else if (ST.selected) requestAnimationFrame(() => scrollListTo(ST.selected, 'instant'));
}
function applyLayoutMode() {
  const tabMode = !mqDesktop.matches;
  const pl = $('#pane-list'), pm = $('#pane-map');
  if (tabMode) {
    pl.setAttribute('role', 'tabpanel'); pm.setAttribute('role', 'tabpanel');
    pl.setAttribute('aria-labelledby', 'tab-list'); pm.setAttribute('aria-labelledby', 'tab-map');
    pl.removeAttribute('aria-label'); pm.removeAttribute('aria-label');
    pl.classList.toggle('is-off', ST.tab !== 'list'); pm.classList.toggle('is-off', ST.tab !== 'map');
  } else {
    pl.setAttribute('role', 'region'); pm.setAttribute('role', 'region');
    pl.removeAttribute('aria-labelledby'); pm.removeAttribute('aria-labelledby');
    pl.setAttribute('aria-label', t('pane.list')); pm.setAttribute('aria-label', t('pane.map'));
    pl.classList.remove('is-off'); pm.classList.remove('is-off');
  }
  applyDetailMode();
  scheduleMapCheck();
}

/* ---------- language switch ---------- */
function setLang(l, persist) {
  if (l !== 'zh' && l !== 'en') return;
  lang = l;
  if (persist !== false) { store.set('lang', l); warnStorage(); }
  applyStatic(); renderAll();
}
function renderAll() {
  renderHero(); renderFilters(); renderList(); renderWalk(); renderFoliage(); renderSources(); updateRibbon();
  if (ST.detail) renderDetail();
  refreshMarkers();
  if (MS.failed) showMapMsg(MS.failed, MS.failed === 'leaflet');
  $('#map-note').textContent = t('map.note'); $('#map-note').hidden = MS.failed === 'leaflet';
  applyLayoutMode();
}

/* ---------- events ---------- */
function bind() {
  $$('.lang-btn').forEach(b => b.addEventListener('click', () => setLang(b.getAttribute('data-lang'))));
  $('#filters').addEventListener('submit', e => e.preventDefault());
  $('#q').addEventListener('input', e => { ST.q = e.target.value; $('#q-clear').hidden = !ST.q; applyFilters(); });
  $('#q-clear').addEventListener('click', () => { ST.q = ''; $('#q').value = ''; $('#q').focus(); applyFilters(); });
  $('#f-region').addEventListener('change', e => { ST.region = e.target.value; applyFilters(); });
  $('#f-grade').addEventListener('change', e => { ST.grade = e.target.value; applyFilters(); });
  $('#status-groups').addEventListener('change', e => { if (e.target && e.target.name === 'status') { ST.status = e.target.value; applyFilters(); } });
  $('#f-clear').addEventListener('click', clearFilters);
  $('#filter-toggle').addEventListener('click', () => { ST.filtersOpen = !ST.filtersOpen; syncFilterUi(); });
  $('#tab-list').addEventListener('click', () => setTab('list'));
  $('#tab-map').addEventListener('click', () => setTab('map'));
  $('#tabs').addEventListener('keydown', e => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft' || e.key === 'Home' || e.key === 'End') { e.preventDefault(); setTab(e.key === 'ArrowLeft' || e.key === 'Home' ? 'list' : 'map', true); } });
  $('#spot-list').addEventListener('click', e => {
    const li = e.target.closest('.spot'); if (!li) return;
    const id = li.getAttribute('data-id');
    const act = e.target.closest('[data-act]');
    if (!act) return;
    if (act.getAttribute('data-act') === 'toggle') { toggleStop(id); const nb = $('#spot-list .spot[data-id="' + CSS.escape(id) + '"] .spot-add'); if (nb && document.activeElement === document.body) nb.focus(); }
    else select(id, { open: true, trigger: act });
  });
  $('#empty').addEventListener('click', e => {
    const a = e.target.closest('[data-act]'); if (!a) return;
    if (a.getAttribute('data-act') === 'clear') clearFilters();
    if (a.getAttribute('data-act') === 'show-none') { ST.status = 'none'; applyFilters(); }
  });
  $('#itinerary').addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); const li = e.target.closest('.stop'); if (!b || !li) return;
    const id = li.getAttribute('data-id'), act = b.getAttribute('data-act');
    if (act === 'open') select(id, { open: true, trigger: b });
    else if (act === 'remove') { removeStop(id); const n = $('#walk-select'); if (n) n.focus(); }
    else {
      moveStop(id, act === 'up' ? -1 : 1);
      const same = $('#itinerary .stop[data-id="' + CSS.escape(id) + '"] [data-act="' + act + '"]');
      const any = $('#itinerary .stop[data-id="' + CSS.escape(id) + '"] .tool:not(:disabled)');
      const f = same && !same.disabled ? same : any; if (f) f.focus();
    }
  });
  $('#walk-add-btn').addEventListener('click', () => {
    const v = $('#walk-select').value; if (!v) { setHint('walk.hint.pick'); return; }
    hintKey = null; if (addStop(v)) { hintKey = null; renderWalk(); }
  });
  $('#walk-select').addEventListener('change', () => { if (/pick/.test(hintKey || '')) setHint(null); });
  $('#walk-sum').addEventListener('click', e => { const b = e.target.closest('[data-act="clear-route"]'); if (b) { clearRoute(); $('#walk-select').focus(); } });
  $('#detail-close').addEventListener('click', () => closeDetail());
  $('#scrim').addEventListener('click', () => closeDetail());
  $('#detail-add').addEventListener('click', () => { if (ST.detail) toggleStop(ST.detail); });
  $('#map-msg').addEventListener('click', e => { if (e.target.closest('[data-act="map-retry"]')) retryTiles(); });
  document.addEventListener('keydown', e => {
    const det = $('#detail');
    if (e.key === 'Escape' && !det.hidden) { e.preventDefault(); closeDetail(); return; }
    if (e.key === 'Tab' && !det.hidden && det.getAttribute('aria-modal') === 'true') {
      const f = $$('button:not([disabled]), a[href], input, select, summary', det).filter(x => x.getClientRects().length && !(x.closest('details') && !x.closest('details').open && x.tagName !== 'SUMMARY'));
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1], cur = document.activeElement;
      if (!det.contains(cur)) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && (cur === first || cur === det)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && cur === last) { e.preventDefault(); first.focus(); }
    }
  });
  const onMq = () => applyLayoutMode();
  if (mqDesktop.addEventListener) mqDesktop.addEventListener('change', onMq); else if (mqDesktop.addListener) mqDesktop.addListener(onMq);
}
function applyFilters() {
  renderList(); renderFilters(); syncMarkers(); refreshMarkers();
  if (map && isMapVisible()) { const b = mapBox(); if (b.w && b.h) fitAll(b); }
}
function clearFilters() { ST.q = ''; ST.region = ''; ST.grade = ''; ST.status = ''; $('#q').value = ''; applyFilters(); $('#q').focus(); }

/* ---------- section highlight in the header ---------- */
function initScrollSpy() {
  if (!('IntersectionObserver' in window)) return;
  const links = $$('#nav a'); const map = new Map();
  links.forEach(l => { const id = (l.getAttribute('href') || '').slice(1); const sec = id && document.getElementById(id); if (sec) map.set(sec, l); });
  const io = new IntersectionObserver(entries => {
    entries.forEach(en => { if (en.isIntersecting) { links.forEach(l => l.removeAttribute('aria-current')); const l = map.get(en.target); if (l) l.setAttribute('aria-current', 'location'); } });
  }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });
  map.forEach((l, sec) => io.observe(sec));
}

/* ---------- boot ---------- */
function boot() {
  if (!dataOk) { showDataError(); return; }
  bind();
  applyStatic();
  renderAll();
  setTab('list');
  initMap();
  initScrollSpy();
  warnStorage();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();

})();
