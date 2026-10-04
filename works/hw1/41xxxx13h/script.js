/*
 * 東京銀杏資訊地圖：銀杏資料來源目錄
 *
 * 資料：課程提供的 Google 試算表（CSV 匯出，41 列、18 欄，各列最後稽核 2026-09-29）。
 * 直接在本機開啟 index.html 時，瀏覽器不允許讀取旁邊的 CSV 檔，
 * 所以 CSV 原文內嵌在下方 SHEET_CSV，執行時再逐列解析。
 * 介面中的資料一律以 textContent 寫入，不用 innerHTML 插入資料。
 */
(function () {
  'use strict';

  /* ------------------------------------------------------------------
   * 1. 資料（CSV 原文，未經修改）
   * ------------------------------------------------------------------ */
  var SHEET_CSV = String.raw`source_id,group_id,name,area,grade,operator,role,url,extra_url,evidence_url,evidence_date,finding,cadence,suggested_poll,caveat,access,species,audited_at
TKG-001,TOKYO_PARK,東京都公園協會｜紅葉情報入口,東京都內都立公園、庭園,S,東京都建設局／公益財團法人東京都公園協會,年度葉況整合公告與當年網址發現,https://www.tokyo-park.or.jp/,https://www.tokyo-park.or.jp/park_list/,https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf,2025-11-04,2025年度公告提供37處公園／庭園紅葉情報；其中11列含銀杏，合計12個具名園區。,2025年度：11/10–12/22；週一、週四傍晚更新，假日順延；最後更新12/18。,季前每週檢查；季內公告更新後檢查一次（建議，非授權）,2026年度沿用日期及網址尚未確認。37處不是37處銀杏。,已讀取頁面,銀杏,2026-09-29
TKG-002,TOKYO_PARK,上野恩賜公園,台東區,S,公益財團法人東京都公園協會,園區入口／公告；銀杏觀測資格由2025年度名單證實,https://www.tokyo-park.or.jp/park/ueno/,,https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf,2025-11-04,2025年度官方紅葉情報名單明列本園區之銀杏；本次不宣稱已取得2026銀杏現況。,中央整合頁2025季內每週兩次；園區個別公告頻率未承諾。,季內每日檢查入口；依當年公告調整（建議）,可列為銀杏專項季節觀測候選。,已讀取頁面,銀杏,2026-09-29
TKG-003,TOKYO_PARK,木場公園,江東區,S,公益財團法人東京都公園協會,園區入口／公告；銀杏觀測資格由2025年度名單證實,https://www.tokyo-park.or.jp/park/kiba/,,https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf,2025-11-04,2025年度官方紅葉情報名單明列本園區之銀杏；本次不宣稱已取得2026銀杏現況。,中央整合頁2025季內每週兩次；園區個別公告頻率未承諾。,季內每日檢查入口；依當年公告調整（建議）,保留園區原文所指子地點。,已讀取頁面,銀杏,2026-09-29
TKG-004,TOKYO_PARK,小金井公園,小金井市等,S,公益財團法人東京都公園協會,園區入口／公告；銀杏觀測資格由2025年度名單證實,https://www.tokyo-park.or.jp/park/koganei/,,https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf,2025-11-04,2025年度官方紅葉情報名單明列本園區之銀杏；本次不宣稱已取得2026銀杏現況。,中央整合頁2025季內每週兩次；園區個別公告頻率未承諾。,季內每日檢查入口；依當年公告調整（建議）,園區跨行政區；不以服務中心地址代表全部觀測點。,已讀取頁面,銀杏,2026-09-29
TKG-005,TOKYO_PARK,芝公園,港區,S,公益財團法人東京都公園協會,園區入口／公告；銀杏觀測資格由2025年度名單證實,https://www.tokyo-park.or.jp/park/siba/,,https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf,2025-11-04,2025年度官方紅葉情報名單明列本園區之銀杏；本次不宣稱已取得2026銀杏現況。,中央整合頁2025季內每週兩次；園區個別公告頻率未承諾。,季內每日檢查入口；依當年公告調整（建議）,銀杏與もみじ谷分開。正確網址使用siba，不是shiba。,已讀取頁面,楓樹、銀杏,2026-09-29
TKG-006,TOKYO_PARK,城北中央公園,板橋區、練馬區,S,公益財團法人東京都公園協會,園區入口／公告；銀杏觀測資格由2025年度名單證實,https://www.tokyo-park.or.jp/park/johoku-chuo/,,https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf,2025-11-04,2025年度官方紅葉情報名單明列本園區之銀杏；本次不宣稱已取得2026銀杏現況。,中央整合頁2025季內每週兩次；園區個別公告頻率未承諾。,季內每日檢查入口；依當年公告調整（建議）,必須按物種取值，不把櫸樹葉況套用銀杏。,已讀取頁面,銀杏、櫸樹,2026-09-29
TKG-007,TOKYO_PARK,善福寺川緑地,杉並區,S,公益財團法人東京都公園協會,園區入口／公告；銀杏觀測資格由2025年度名單證實,https://www.tokyo-park.or.jp/park/zempukujigawa-ryokuchi/index.html,,https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf,2025-11-04,2025年度官方紅葉情報名單明列本園區之銀杏；本次不宣稱已取得2026銀杏現況。,中央整合頁2025季內每週兩次；園區個別公告頻率未承諾。,季內每日檢查入口；依當年公告調整（建議）,2025表與和田堀公園合併一列，不能假設各有獨立觀測。,已讀取頁面,銀杏,2026-09-29
TKG-008,TOKYO_PARK,和田堀公園,杉並區,S,公益財團法人東京都公園協會,園區入口／公告；銀杏觀測資格由2025年度名單證實,https://www.tokyo-park.or.jp/park/wadabori/,,https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf,2025-11-04,2025年度官方紅葉情報名單明列本園區之銀杏；本次不宣稱已取得2026銀杏現況。,中央整合頁2025季內每週兩次；園區個別公告頻率未承諾。,季內每日檢查入口；依當年公告調整（建議）,2025表與善福寺川緑地合併一列，保留共同來源關係。,已讀取頁面,銀杏,2026-09-29
TKG-009,TOKYO_PARK,戸山公園,新宿區,S,公益財團法人東京都公園協會,園區入口／公告；銀杏觀測資格由2025年度名單證實,https://www.tokyo-park.or.jp/park/toyama/,,https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf,2025-11-04,2025年度官方紅葉情報名單明列本園區之銀杏；本次不宣稱已取得2026銀杏現況。,中央整合頁2025季內每週兩次；園區個別公告頻率未承諾。,季內每日檢查入口；依當年公告調整（建議）,須擷取銀杏段落／欄位，不直接使用全園紅葉狀態。,已讀取頁面,楓樹、銀杏,2026-09-29
TKG-010,TOKYO_PARK,光が丘公園,練馬區、板橋區,S,公益財團法人東京都公園協會,園區入口／公告；銀杏觀測資格由2025年度名單證實,https://www.tokyo-park.or.jp/park/hikarigaoka/,,https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf,2025-11-04,2025年度官方紅葉情報名單明列本園區之銀杏；本次不宣稱已取得2026銀杏現況。,中央整合頁2025季內每週兩次；園區個別公告頻率未承諾。,季內每日檢查入口；依當年公告調整（建議）,銀杏並木與ふれあいの径宜設為不同子地點。,已讀取頁面,銀杏,2026-09-29
TKG-011,TOKYO_PARK,日比谷公園,千代田區,S,公益財團法人東京都公園協會,園區入口／公告；銀杏觀測資格由2025年度名單證實,https://www.tokyo-park.or.jp/park/hibiya/,,https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf,2025-11-04,2025年度官方紅葉情報名單明列本園區之銀杏；本次不宣稱已取得2026銀杏現況。,中央整合頁2025季內每週兩次；園區個別公告頻率未承諾。,季內每日檢查入口；依當年公告調整（建議）,葉況與施工、通行公告分開管理。,已讀取頁面,銀杏,2026-09-29
TKG-012,TOKYO_PARK,代々木公園,澀谷區,S,公益財團法人東京都公園協會,園區入口／公告；銀杏觀測資格由2025年度名單證實,https://www.tokyo-park.or.jp/park/yoyogi/,,https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf,2025-11-04,2025年度官方紅葉情報名單明列本園區之銀杏；本次不宣稱已取得2026銀杏現況。,中央整合頁2025季內每週兩次；園區個別公告頻率未承諾。,季內每日檢查入口；依當年公告調整（建議）,黃葉公告須限定原文明示區域，不擴張為全園。,已讀取頁面,銀杏,2026-09-29
TKG-013,TOKYO_PARK,旧岩崎邸庭園,台東區（入口）,S,公益財團法人東京都公園協會,園區入口／公告；銀杏觀測資格由2025年度名單證實,https://www.tokyo-park.or.jp/park/kyu-iwasaki-tei/,,https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf,2025-11-04,2025年度官方紅葉情報名單明列本園區之銀杏；本次不宣稱已取得2026銀杏現況。,中央整合頁2025季內每週兩次；園區個別公告頻率未承諾。,季內每日檢查入口；依當年公告調整（建議）,活動或集章日期不是見頃日；注意官網改版後網址。,已讀取頁面,銀杏,2026-09-29
TKG-014,SHOWA,國營昭和記念公園｜花だより,立川市、昭島市,A,國營昭和記念公園官方網站,附日期的植物／黃葉現地快訊,https://www.showakinen-koen.jp/hanadayori/,https://www.showakinen-koen.jp/flower-information/,https://www.showakinen-koen.jp/hanadayori/page/3/,2025-10-23至2025-12-04,歷史列表有連續多期イチョウ情報；植物指南明列イチョウ（黄葉）。,歷史季內約每週一篇；並非官網保證的更新頻率。,季內每日一次（建議）,カナール、かたらいのイチョウ並木分開；page/3分頁位置會隨新增文章變動，不可當永久存檔ID。,已讀取頁面,銀杏,2026-09-29
TKG-015,FNG_SHINJUKU,新宿御苑｜國民公園協會自然情報,新宿區、澀谷區,A,一般財團法人國民公園協會 新宿御苑,みどころ／紅葉／植物公告,https://fng.or.jp/shinjuku/news/,https://policies.env.go.jp/national-garden/shinjukugyoen/index.html,https://fng.or.jp/shinjuku/2025/11/28/20251128_03/,2025-11-28,日期文章明確敘述銀杏黃葉見頃，包含溫室附近照片及園內植物地圖。,已見每週みどころ及其他不定期文章；不是保證頻率。,季內每日一次（建議）,舊文只當歷史樣本。環境省管理資訊與協會自然情報各有用途；不可混入同期其他樹種狀態。,已讀取頁面,銀杏,2026-09-29
TKG-016,HACHIOJI,八王子いちょう祭り｜黄葉情報,八王子市・甲州街道,A,八王子いちょう祭り祭典委員會,沿道路多觀景點、附拍攝日期的黃葉照片,https://www.ichou-festa.org/ichounews/,https://www.ichou-festa.org/,https://www.ichou-festa.org/notice/post-3629/,2026-09-24（更新公告）,黄葉情報頁可見2026-09-22拍攝日期，分中央圖書館、多摩御陵入口及觀看方向。,官方明示不定期更新。,季內每日一次（建議）,已確認2026季內內容，但不能只看照片日期就自動判定見頃。祭典日期與葉況分離。,已讀取頁面,銀杏,2026-09-29
TKG-017,KUNAICHO,宮內廳｜皇居東御苑 花だより,千代田區・皇居東御苑,A,宮內廳,附日期的園內植物與黃葉記錄,https://www.kunaicho.go.jp/visit/higashigyoen/hanadayori/index.html,https://www.kunaicho.go.jp/visit/higashigyoen/index.html,https://www.kunaicho.go.jp/visit/higashigyoen/hanadayori/20251128.html,2025-11-28,日期文記錄銀杏等樹木變色，照片標示百人番所前のイチョウ。,列表可見近每週更新；未將其視為保證頻率。,季內每日一次（建議）,東御苑不是皇居外苑或北之丸公園。全園葉落描述不可自動套用銀杏。,已讀取頁面,銀杏,2026-09-29
TKG-018,UTOKYO_BOT,小石川植物園｜見ごろの植物,文京區,A,東京大學大學院理學系研究科附屬植物園,附日期的物種級植物觀察,https://koishikawa-bg.jp/kaikainfo/,https://koishikawa-bg.jp/kaika/,https://koishikawa-bg.jp/kaika/5013/,2025-11-19,當日文章將イチョウ明列於正在紅葉／黃葉的植物清單。,不定期，已有多篇日期文章。,季內每日一次（建議）,見到黃葉不等於已到見頃。小石川植物園與小石川後樂園是不同地點。,已讀取頁面,銀杏,2026-09-29
TKG-019,AKIRUNO,あきる野市觀光協會｜のらぼう日記,秋留野市・廣德寺周邊,A,あきる野市觀光協會,秋川溪谷分地點紅葉巡查，含廣德寺銀杏,https://www.akirunokanko.com/?cat=53,https://www.akirunokanko.com/,https://www.akirunokanko.com/?p=8712,2025-11-08（發文）；2025-11-06（拍照）,廣德寺段落明寫銀杏變色進展、尚差一些到見頃；原文另給照片拍攝日期。,原文說隨時更新；2025季內有多期，非固定每週承諾。,季內每日一次（建議）,石舟橋段落是楓樹，不能套用到廣德寺銀杏。發文日與拍摄日分開。,已讀取頁面,銀杏,2026-09-29
TKG-020,JMA,氣象廳｜いちょうの黄葉日,東京觀測站（標本木尺度）,O,日本氣象廳,依統一基準記錄黃葉日,https://www.data.jma.go.jp/sakura/data/phn_012.html,,https://www.data.jma.go.jp/sakura/data/,最近資料頁2025–2026,有東京及其他站的銀杏黃葉日期表；官網说明觀測以標本木進行。,最近資料每日約08:35（日本時間）更新。,每日09:00日本時間一次（建議）,觀測站日期不能充當每處公園最佳觀賞日；未報告不等於青葉。,已讀取頁面,銀杏,2026-09-29
TKG-021,JMA,氣象廳｜いちょうの落葉日,東京觀測站（標本木尺度）,O,日本氣象廳,標本木落葉日期,https://www.data.jma.go.jp/sakura/data/phn_013.html,,https://www.data.jma.go.jp/sakura/data/,最近資料頁2025–2026,有銀杏落葉日期表，與黃葉日分開。,最近資料每日約08:35（日本時間）更新。,每日09:00日本時間一次（建議）,不是全東京銀杏落葉完成日；保留站點和觀測現象定義。,已讀取頁面,銀杏,2026-09-29
TKG-022,JMA,氣象廳｜生物季節累年值CSV入口,東京及全國站點歷史,O,日本氣象廳,官方歷史資料下載索引,https://www.data.jma.go.jp/sakura/data/download_ruinenchi.html,,https://www.data.jma.go.jp/sakura/data/,累年表主頁標記2026-03-19,下載索引提供いちょう黄葉與いちょう落葉CSV連結。,累年資料不應當作每日即時資料。,開發建檔及年度更新時檢查（建議）,已驗證下載入口；本次未成功取得CSV檔位元組，也未驗證CSV欄位。不可宣稱API已測通。,已讀取頁面,銀杏,2026-09-29
TKG-023,MEIJI_GAIEN,明治神宮外苑｜いちょう並木,明治神宮外苑・銀杏並木,C,明治神宮外苑,第一方景點及四季介紹；監看公告的入口,https://www.meijijingugaien.jp/walk/sight/season.html,https://www.meijijingugaien.jp/news/,https://www.meijijingugaien.jp/walk/sight/season.html,未見可當現況的日期,官網明確介紹銀杏並木與四季景觀；本次未確認穩定的逐日銀杏葉況專頁。,未確認。,季內檢查官網公告；不得由靜態頁生成現況（建議）,不是明治神宮內苑。頁內老樹齡／株數含歷史基準，勿當2026現況。,已讀取頁面,銀杏,2026-09-29
TKG-024,OGIKUBO_GARDENS,大田黑公園｜荻窪三庭園,杉並區,B,杉並區官方指向之公園網站（荻窪三庭園）,現行官方入口，待人工／瀏覽器核對季內葉況,https://ogikubo3gardens.jp/ootaguro/,https://ogikubo3gardens.jp/,https://www.city.suginami.tokyo.jp/s100/shisetsu/14632.html,區公所頁更新2025-09-09,杉並區官網證明銀杏並木及現行官方網址；本次自動讀取公園頁未取得正文。,尚未確認黃葉更新頻率。,先完成人工開站與樣本文核對，再設定排程（建議）,不得沿用已於2024年3月結束管理的箱根植木舊頁作現任營運來源。,官方身分已確認；公園頁正文讀取不足,銀杏,2026-09-29
TKG-025,OOKUNITAMA,大國魂神社｜大銀杏／公告,府中市,C,大國魂神社,第一方大銀杏地點資訊及公告入口,https://www.ookunitamajinja.or.jp/mame/,https://www.ookunitamajinja.or.jp/,https://www.ookunitamajinja.or.jp/mame/,靜態資料,神社官網確認本殿後方的大銀杏；未確認定期黃葉觀測文章。,未確認。,保留景點資料；季內監看公告（建議）,不要把附近馬場大門的櫸樹並木視為銀杏。,已讀取頁面,銀杏,2026-09-29
TKG-026,YASUKUNI,靖國神社｜官方公告、境內照片,千代田區,C,靖國神社,公告與影像入口；銀杏日期觀測仍待核對,https://www.yasukuni.or.jp/,https://www.yasukuni.or.jp/schedule/photo.html,https://www.yasukuni.or.jp/schedule/photo.html,本次可讀2026公告,官網和照片入口存在；本次未核得可直接當銀杏現況的日期觀測文章。,未確認。,季內監看；照片須先核拍攝日期（建議）,宣傳影片上線日不等於拍攝日。不可將未核視角的LIVE影片宣稱銀杏即時鏡頭。,已讀取頁面,銀杏專項現況待確認,2026-09-29
TKG-027,GOTOKYO,GO TOKYO｜秋季紅葉指南,東京都全域,C,東京官方旅遊網站 GO TOKYO,景點發現、地址與官方外連,https://www.gotokyo.org/jp/story/guide/autumn-leaves-forecast/index.html,,https://www.gotokyo.org/jp/story/guide/autumn-leaves-forecast/index.html,2026-09-01,指南明確介紹明治神宮外苑銀杏等秋季地點。,編輯型更新，非每景點每日觀測。,每週或每月檢查基本資料（建議）,網址含forecast不等於有當日銀杏觀測；文章更新日不能代表照片日期。,已讀取頁面,銀杏,2026-09-29
TKG-028,CHIYODA_TOURISM,千代田區觀光協會｜景點／專題,千代田區,C,千代田區觀光協會,區域景點及來源發現入口,https://visit-chiyoda.tokyo/app/spot,https://visit-chiyoda.tokyo/app/feature,https://visit-chiyoda.tokyo/app/spot,本次讀取2026-09-29,景點列表有紅葉名所分類；可用來查區內候選地點。,未確認銀杏葉況頻率。,僅供景點資料維護；發現日期文章後再升級（建議）,尚未證實它對行幸通り等逐點提供定期銀杏觀測。,已讀取頁面,紅葉混合分類,2026-09-29
TKG-029,SHINJUKU_TOURISM,新宿觀光振興協會｜官方入口,新宿區,C,新宿觀光振興協會,景點、活動與公告發現,https://www.kanko-shinjuku.jp/,,https://www.kanko-shinjuku.jp/,本次讀取2026-09-29,官方觀光入口可讀；銀杏日期快訊本次未確認。,未確認。,低頻景點資料維護；不直接用作葉況（建議）,不能取代新宿御苑管理相關單位的實際植物報告。,已讀取頁面,銀杏專項現況待確認,2026-09-29
TKG-030,FNG_KOUKYO,皇居外苑・北之丸公園｜國民公園協會,千代田區,B,一般財團法人國民公園協會 皇居外苑,四季景觀、植物公告入口,https://fng.or.jp/koukyo/news/,,https://fng.or.jp/koukyo/,本次可見2026-09-19季節文章入口,有持續更新的自然／四季消息；本次未核得銀杏專项葉況。,不定期；銀杏頻率待查。,季內每日檢查標題；先人工確認物種（建議）,與宮內廳東御苑不同來源、不同地理範圍。,已讀取頁面,銀杏專項現況待確認,2026-09-29
TKG-031,TOKYO_PARK,神代植物公園｜園區植物公告,調布市,B,公益財團法人東京都公園協會,多物種植物公告入口,https://www.tokyo-park.or.jp/park/jindai/,,https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf,2025-11-04,有植物園官方入口；中央紅葉名單對本園記錄的是モミジ。,園區植物公告頻率未確認。,先補銀杏日期樣本，不啟用銀杏自動狀態（建議）,不可把中央名單的楓樹狀態當作銀杏。,已讀取頁面,2025中央項目是楓樹,2026-09-29
TKG-032,FUCHU_MUSEUM,府中市鄉土之森博物館｜花ごよみ,府中市,B,府中市鄉土之森博物館官方營運網站,園內花曆／植物動態,https://www.fuchu-cpf.or.jp/museum/hanagoyomi/index.html,https://www.fuchu-cpf.or.jp/museum/,https://www.fuchu-cpf.or.jp/museum/hanagoyomi/index.html,2026-09-28,植物狀況頁持續更新，但本次所讀內容不足以證實銀杏專項發布。,有日期更新；银杏頻率未確認。,先補銀杏物種與日期樣本（建議）,不要把彼岸花／萩等花況轉成銀杏；照片需獨立核日期。,已讀取頁面,銀杏物種／現況均待補證,2026-09-29
TKG-033,TENKI,tenki.jp｜東京都紅葉情報,東京都多景點,T,tenki.jp（非景點管理機關）,第三方整合葉況／五階段狀態,https://tenki.jp/kouyou/3/16/,https://tenki.jp/kouyou/3/16/30688.html,https://tenki.jp/kouyou/3/16/,2026-09-29,東京都列表顯示2026季資訊；來源說明每日綜合各景點回報。含明治外苑、大田黑、廣德寺等。,網站說明每日更新／回報。,許可及條款確認後每日一次（建議）,多樹種混合；示意照片不等於當日照片。38個東京都紅葉點不等於38個銀杏點。,已讀取頁面,銀杏與其他紅葉物種混合,2026-09-29
TKG-034,WEATHERNEWS,Weathernews｜東京都紅葉情報,東京都多景點,T,Weathernews（民間氣象平台）,第三方紅葉平台,https://weathernews.jp/koyo/area/tokyo/,,https://weathernews.jp/koyo/area/tokyo/,2026版頁面,確認2026東京專頁存在；本次解析結果不足以核對所有景點及銀杏專屬欄位。,本次未核定固定頻率。,先核欄位、來源及條款，再設排程（建議）,勿宣稱其所有預報／回報均為官方實測。動態渲染內容需另做實測。,頁面可開啟；細項自動解析不足,多物種紅葉,2026-09-29
TKG-035,WALKER,WalkerPlus｜東京 黃色に色づく,東京都多景點,T,KADOKAWA／WalkerPlus,第三方景點目錄及色づき狀態,https://koyo.walkerplus.com/yellow/ar0313/,https://koyo.walkerplus.com/list/ar0313/,https://koyo.walkerplus.com/detail/ar0313e154517/,2026-09-28（芝公園狀態）,黃色分類列56項（含其他黃葉樹種）；芝公園頁色づき來源標示JRシステム。,平台標示每日更新色づき資訊。,許可及條款確認後每日一次（建議）,56項不是56處銀杏確證；2026葉況旁可並列2025活动。圖片二次使用受限。,已讀取頁面,銀杏等黃色樹種；混合,2026-09-29
TKG-036,JORUDAN,Jorudan｜東京都 紅葉情報,東京都多景點,T,ジョルダン（民間平台）,第三方景點、見頃與交通資訊,https://sp.jorudan.co.jp/leaf/tokyo.html,,https://sp.jorudan.co.jp/leaf/spot_J0193.html,2026版列表,東京紅葉列表及國立大學通り等景點入口，可作地點查漏。,個別點現況更新頻率需另核。,先作候選地點索引（建議）,歷年通常見頃不等於今年現況；不要假設所有點均有當日觀測。,已讀取頁面,紅葉混合,2026-09-29
TKG-037,N_KISHOU,日本氣象株式會社｜紅葉・黃葉見頃預想,東京城市尺度及其他地點,T,日本氣象株式會社（不是氣象廳）,預報產品／黃葉模型結果,https://n-kishou.com/corp/news-contents/autumn/,,https://n-kishou.com/corp/news-contents/autumn/,2026-09-02（第一回）,2026第一回預報明確區分銀杏黃葉與楓樹紅葉。,公告按回次更新；本次頁標記下次預定10月上旬。,公告更新時檢查（建議）,必須標forecast，保留發布日、預測對象和尺度；不得覆寫公園實際觀測。,已讀取頁面,黃葉=銀杏；紅葉主要=楓樹,2026-09-29
TKG-038,TOKYO_PARK,東京都公園協會｜2025紅葉季舊專頁,東京都內,X,公益財團法人東京都公園協會,歷史入口／網址失效監測,https://www.tokyo-park.or.jp/special/kouyou/index.html,,https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf,2025-11-04（公告中的連結）,2025公告指向此頁；本次查核回傳404。,當年季內每週兩次；目前不可當作工作中端點。,季前由主站重新發現當年網址（建議）,此列保留作失效紀錄，不計入可立即使用的現況來源。,本次回傳404,銀杏,2026-09-29
TKG-039,HAKONE_OLD,箱根植木｜大田黑公園舊管理案例,杉並區,X,箱根植木（舊管理公司）,歷史管理身分核對／排除來源,https://hakone-ueki.com/casestudy/case1/,,https://hakone-ueki.com/,管理期2011-04至2024-03,公司首頁明寫大田黑公園管理已於2024年3月結束。,不是現任管理單位季內更新來源。,不排程抓取葉況。,只保留遷移／排除理由；現行入口由杉並區官方指向荻窪三庭園。,已讀取頁面,不適用,2026-09-29
TKG-040,UTOKYO_CAMPUS,東京大學｜本鄉・駒場校區官方入口,文京區、目黑區,C,東京大學,校區地圖、參觀規則及公告發現,https://www.u-tokyo.ac.jp/ja/about/campus-guide/index.html,,https://www.u-tokyo.ac.jp/ja/about/campus-guide/index.html,2026-04-01（地圖頁）,確認本鄉及駒場的官方地圖／參觀入口；尚未確認穩定的銀杏日期觀測來源。,銀杏更新頻率未確認。,先人工查廣報／官方社群及參觀規則；不以地圖生成葉況（建議）,本鄉、駒場、小石川植物園是不同地點。此頁未證實各校區的當季銀杏觀測。,已讀取頁面,銀杏專項現況待確認,2026-09-29
TKG-041,KUNITACHI,くにたちNAVI｜國立市觀光まちづくり協會,國立市・大學通り候選,C,NPO法人國立市觀光まちづくり協會,地方觀光／活動入口，供來源拓展,https://kunimachi.jp/,https://sp.jorudan.co.jp/leaf/spot_J0193.html,https://kunimachi.jp/,本次可見2026-09-25更新,頁尾確認營運者為國立市觀光まちづくり協會；本次未確認定期銀杏葉況文章。,銀杏更新頻率未確認。,季內查公告與官方社群；先補日期觀測樣本（建議）,區域旅遊更新不等於大學通り銀杏現況；可與Jorudan地點目錄交叉尋源。,已讀取頁面,銀杏專項現況待確認,2026-09-29`;

  var MISSING = '資料未提供';
  var COLUMNS = ['source_id', 'group_id', 'name', 'area', 'grade', 'operator', 'role', 'url',
    'extra_url', 'evidence_url', 'evidence_date', 'finding', 'cadence', 'suggested_poll',
    'caveat', 'access', 'species', 'audited_at'];

  /* 已知失效的網址：只以文字顯示，不做成按鈕 */
  var DEAD_LINKS = {
    'https://www.tokyo-park.or.jp/special/kouyou/index.html': '已失效（2026-09-29 查核回傳 404）'
  };

  /* 資料等級：排序 S > A > B > C > O > T > X */
  var GRADE_ORDER = ['S', 'A', 'B', 'C', 'O', 'T', 'X'];
  var GRADE_INFO = {
    S: { short: '官方公園協會', long: '官方公園協會的整合公告或園區頁面' },
    A: { short: '官方附日期現地觀測', long: '官方網站發布、附日期的現地觀測' },
    B: { short: '官方，銀杏專項待核對', long: '官方來源，但銀杏專項資料仍待核對' },
    C: { short: '官方網站或入口', long: '官方網站或入口，沒有附日期的觀測' },
    O: { short: '氣象廳觀測站尺度', long: '氣象廳以標本木觀測，屬於觀測站尺度' },
    T: { short: '第三方整合平台', long: '第三方整合平台，不是景點管理單位' },
    X: { short: '排除或失效來源', long: '已排除或已失效的來源' }
  };

  /* 四種資料性質：只依 grade 欄判斷，每列只屬於一類（顯示順序） */
  var GROUPS = [
    {
      id: 'observe', name: '銀杏觀測資料', grades: ['A'],
      rule: '資料等級為 A。官方網站發布、附日期的植物或黃葉快訊，是最接近現地觀測的來源。',
      note: '其中的日期大多是 2025 季的歷史紀錄；TKG-016 雖有 2026-09-22 拍攝的照片，原文沒有判定葉況階段。'
    },
    {
      id: 'portal', name: '官方入口', grades: ['S', 'C'],
      rule: '資料等級為 S 或 C。官方公園協會或官方網站、園區頁面與公告入口；目前沒有 2026 季附日期的銀杏葉況（S 列的葉況由東京都公園協會在季內整合公告，2025 年度為每週兩次，2026 年度的日期與網址尚未確認）。',
      note: 'S 列的證據是 2025 年度的官方名單（2025-11-04），只證明該園區列有銀杏，不是 2026 年的現況。'
    },
    {
      id: 'pending', name: '尚未確認即時葉況', grades: ['B', 'T'],
      rule: '資料等級為 B 或 T。官方但銀杏專項資料待核對，或第三方整合平台；可能有葉況消息，但銀杏即時葉況尚未經官方確認。',
      note: '不能把這些來源的內容當成目前狀態。等級空白或無法辨識的列，也歸入這一類。'
    },
    {
      id: 'history', name: '歷史資料', grades: ['O', 'X'],
      rule: '資料等級為 O 或 X。氣象廳標本木的歷年黃葉、落葉日期與累年值索引，以及已失效的 2025 紅葉季舊專頁、已結束的舊管理資料。',
      note: '只能當作有日期的歷史參考，不代表目前狀態。氣象廳的黃葉日、落葉日頁面（TKG-020、021）每日更新，觀測到 2026 年東京標本木的日期後才會刊出；截至 2026-10-02，東京的 2026 年欄位顯示「///」（尚未觀測），頁面上可讀的是 2025 年的紀錄。'
    }
  ];
  var FALLBACK_GROUP = 'pending';

  /* 個別列的 2026 季補充說明：
   * TKG-016 有 2026 季內容、但原文沒有判定葉況階段（依試算表該列的證據日期、摘要與 caveat）；
   * TKG-020、021 頁面每日更新，但 2026 年東京尚未觀測（依試算表 cadence 與 2026-10-02 共用氣象廳核對） */
  var STATUS_NOTES = {
    'TKG-016': '這一列有 2026 季的照片（2026-09-22 拍攝）與更新公告（2026-09-24），但原文沒有判定葉況階段。',
    'TKG-020': '氣象廳這一頁每日更新，觀測到 2026 年東京標本木的黃葉日後才會刊出日期；截至 2026-10-02，東京的 2026 年欄位顯示「///」（尚未觀測），頁面上可讀的是 2025 年的紀錄。',
    'TKG-021': '氣象廳這一頁每日更新，觀測到 2026 年東京標本木的落葉日後才會刊出日期；截至 2026-10-02，東京的 2026 年欄位顯示「///」（尚未觀測），頁面上可讀的是 2025 年的紀錄。'
  };

  /* 區域：東京都區市代碼順序 */
  var WARD_ORDER = ['千代田區', '中央區', '港區', '新宿區', '文京區', '台東區', '墨田區', '江東區',
    '品川區', '目黑區', '大田區', '世田谷區', '澀谷區', '中野區', '杉並區', '豐島區', '北區', '荒川區',
    '板橋區', '練馬區', '足立區', '葛飾區', '江戶川區'];
  var CITY_ORDER = ['八王子市', '立川市', '武藏野市', '三鷹市', '青梅市', '府中市', '昭島市', '調布市',
    '町田市', '小金井市', '小平市', '日野市', '東村山市', '國分寺市', '國立市', '福生市', '狛江市',
    '東大和市', '清瀨市', '東久留米市', '武藏村山市', '多摩市', '稻城市', '羽村市', '秋留野市', '西東京市'];
  var AREA_ALL_TOKYO = '全東京／跨區域';
  var AREA_STATION = '觀測站尺度';
  var AREA_UNLABELLED = '未標示區市';
  var SPECIAL_AREAS = [AREA_ALL_TOKYO, AREA_STATION, AREA_UNLABELLED, MISSING];

  /* 物種分組（顯示順序） */
  var SPECIES_GROUPS = ['銀杏', '銀杏與其他樹種', '多樹種混合', '銀杏專項待確認', '非銀杏／不適用', MISSING];

  /* 書背高度變化（只為了像真正的書架） */
  var SPINE_HEIGHTS = [0.96, 1, 0.92, 0.98, 0.9, 0.97, 0.94, 1, 0.93, 0.96, 0.91, 0.99, 0.95];

  /* 搜尋時把常見的日文、簡體字形對應到繁體 */
  var FOLD_MAP = {
    '黄': '黃', '银': '銀', '叶': '葉', '红': '紅', '园': '園', '区': '區', '国': '國', '观': '觀',
    '観': '觀', '广': '廣', '広': '廣', '边': '邊', '辺': '邊', '专': '專', '専': '專', '项': '項',
    '动': '動', '说': '說', '摄': '攝', '气': '氣', '気': '氣', '庁': '廳', '厅': '廳', '渋': '澀',
    '黒': '黑', '内': '內', '旧': '舊', '楽': '樂', '桜': '櫻', '図': '圖', '徳': '德', '沢': '澤',
    '豊': '豐', '会': '會', '协': '協', '発': '發', '预': '預', '测': '測', '証': '證', '证': '證',
    '据': '據', '拠': '據', '时': '時', '间': '間', '状': '狀', '况': '況', '览': '覽', '覧': '覽',
    '东': '東', '马': '馬', '场': '場', '宫': '宮', '浅': '淺'
  };

  /* ------------------------------------------------------------------
   * 2. 小工具
   * ------------------------------------------------------------------ */
  var SVGNS = 'http://www.w3.org/2000/svg';
  var ICONS = {
    ext: ['M6.5 3.5H3.5v9h9v-3', 'M9.5 3.5h3v3', 'M12.5 3.5 7.5 8.5'],
    arrow: ['M3 8h10', 'M9 4l4 4-4 4'],
    note: ['M8 2.2 14.4 13.4H1.6Z', 'M8 6.4v3.2', 'M8 11.5v.2']
  };

  function icon(name, extraClass) {
    var svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('viewBox', '0 0 16 16');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.setAttribute('class', 'icon icon--' + name + (extraClass ? ' ' + extraClass : ''));
    (ICONS[name] || []).forEach(function (d) {
      var p = document.createElementNS(SVGNS, 'path');
      p.setAttribute('d', d);
      svg.appendChild(p);
    });
    return svg;
  }

  function append(el, kids) {
    if (kids == null) return el;
    if (!Array.isArray(kids)) kids = [kids];
    kids.forEach(function (c) {
      if (c == null || c === false) return;
      el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
    });
    return el;
  }

  function h(tag, attrs, kids) {
    var el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v == null || v === false) return;
        if (k === 'class') el.className = v;
        else if (k === 'text') el.textContent = v;
        else if (k === 'hidden') el.hidden = true;
        else if (k.indexOf('on') === 0 && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else el.setAttribute(k, v === true ? '' : String(v));
      });
    }
    return append(el, kids);
  }

  function clean(v) { return v == null ? '' : String(v).trim(); }

  /* 文字中的日期（例如 2025-11-04、2011-04）包成不斷行的片段；文字本身照原文 */
  var DATE_RUN = /\d{4}(?:-\d{2}){1,2}|\d{4}–\d{4}/g;
  function runs(text) {
    text = String(text == null ? '' : text);
    var out = [];
    var last = 0;
    var m;
    DATE_RUN.lastIndex = 0;
    while ((m = DATE_RUN.exec(text))) {
      if (m.index > last) out.push(text.slice(last, m.index));
      out.push(h('span', { class: 'date-run', text: m[0] }));
      last = m.index + m[0].length;
    }
    if (last < text.length) out.push(text.slice(last));
    return out;
  }

  /* 欄位空白時顯示「資料未提供」 */
  function valueNode(v, tag) {
    v = clean(v);
    return h(tag || 'span', { class: v ? null : 'is-missing' }, v ? runs(v) : MISSING);
  }

  function fold(s) {
    s = String(s || '');
    if (s.normalize) s = s.normalize('NFKC');
    s = s.toLowerCase();
    var out = '';
    for (var i = 0; i < s.length; i++) {
      var ch = s.charAt(i);
      var code = s.charCodeAt(i);
      if (code >= 0x30A1 && code <= 0x30F6) ch = String.fromCharCode(code - 0x60); /* 片假名 → 平假名 */
      out += FOLD_MAP[ch] || ch;
    }
    return out;
  }

  function fullDates(s) { return clean(s).match(/\d{4}-\d{2}-\d{2}/g) || []; }

  function yearsIn(s) {
    return (clean(s).match(/(?:19|20)\d{2}/g) || []).map(Number);
  }

  /* 證據日期只含 2025 年以前的年份 → 歷史日期 */
  function isPastOnly(s) {
    var y = yearsIn(s);
    return y.length > 0 && Math.max.apply(null, y) <= 2025;
  }

  function isHttpUrl(u) { return /^https?:\/\/[^\s]+$/i.test(u); }

  function hostOf(u) {
    var m = /^https?:\/\/([^\/?#]+)/i.exec(u);
    return m ? m[1].replace(/^www\./i, '') : u;
  }

  function prefersReducedMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function pad2(n) { return n < 10 ? '0' + n : String(n); }

  /* 「推薦第 15 名」 */
  function rankWords(n) { return ['推薦第 ', h('span', { class: 'num', text: String(n) }), ' 名']; }

  /* ------------------------------------------------------------------
   * 3. 讀取與整理資料
   * ------------------------------------------------------------------ */
  function parseCSV(text) {
    var rows = [];
    var row = [];
    var field = '';
    var inQuotes = false;
    text = String(text).replace(/^﻿/, '');
    for (var i = 0; i < text.length; i++) {
      var c = text.charAt(i);
      if (inQuotes) {
        if (c === '"') {
          if (text.charAt(i + 1) === '"') { field += '"'; i++; } else { inQuotes = false; }
        } else {
          field += c;
        }
      } else if (c === '"') {
        inQuotes = true;
      } else if (c === ',') {
        row.push(field); field = '';
      } else if (c === '\n' || c === '\r') {
        if (c === '\r' && text.charAt(i + 1) === '\n') i++;
        row.push(field); field = '';
        if (row.length > 1 || row[0] !== '') rows.push(row);
        row = [];
      } else {
        field += c;
      }
    }
    if (field !== '' || row.length) {
      row.push(field);
      if (row.length > 1 || row[0] !== '') rows.push(row);
    }
    return rows;
  }

  function toRecords(rows) {
    if (!rows.length) throw new Error('CSV 沒有內容');
    var header = rows[0].map(clean);
    if (header.indexOf('source_id') < 0 || header.indexOf('name') < 0) throw new Error('CSV 欄位名稱不符');
    return rows.slice(1).map(function (cells) {
      var o = {};
      header.forEach(function (key, j) { o[key] = clean(cells[j]); });
      COLUMNS.forEach(function (key) { if (!(key in o)) o[key] = ''; });
      return o;
    }).filter(function (o) {
      return COLUMNS.some(function (key) { return o[key] !== ''; });
    });
  }

  function groupById(id) {
    for (var i = 0; i < GROUPS.length; i++) if (GROUPS[i].id === id) return GROUPS[i];
    return null;
  }

  function groupForGrade(g) {
    for (var i = 0; i < GROUPS.length; i++) if (GROUPS[i].grades.indexOf(g) >= 0) return GROUPS[i];
    return groupById(FALLBACK_GROUP);
  }

  function splitName(name) {
    name = clean(name);
    if (!name) return { main: MISSING, sub: '', sep: '', missing: true };
    var k = name.indexOf('｜');
    if (k < 0) k = name.indexOf('|');
    if (k > 0 && k < name.length - 1) {
      return { main: name.slice(0, k), sub: name.slice(k + 1), sep: name.charAt(k), missing: false };
    }
    return { main: name, sub: '', sep: '', missing: false };
  }

  /* 區域：去掉括號註記與結尾「等」，以「、」「・」拆開，取以區或市結尾的行政區 */
  function areaKeys(area) {
    area = clean(area);
    if (!area) return [MISSING];
    var stripped = area.replace(/（[^）]*）|\([^)]*\)/g, '');
    var keys = [];
    stripped.split(/[、・，,／\/]/).forEach(function (part) {
      part = part.trim().replace(/等$/, '');
      if (/^[^\s]{1,6}[區市]$/.test(part) && keys.indexOf(part) < 0) keys.push(part);
    });
    if (keys.length) return keys;
    if (/觀測站|站點/.test(area)) return [AREA_STATION];
    if (/^東京都|^東京城市/.test(area)) return [AREA_ALL_TOKYO];
    return [AREA_UNLABELLED];
  }

  function speciesGroup(s) {
    s = clean(s);
    if (!s) return MISSING;
    if (/混合|多物種/.test(s)) return '多樹種混合';
    if (/待確認|待補證/.test(s)) return '銀杏專項待確認';
    if (s === '銀杏') return '銀杏';
    if (/銀杏/.test(s)) return '銀杏與其他樹種';
    return '非銀杏／不適用';
  }

  function enrich(raw, idx) {
    var g = clean(raw.grade).toUpperCase();
    var gradeKey = GRADE_INFO.hasOwnProperty(g) ? g : '';
    var group = groupForGrade(gradeKey);
    var dates = fullDates(raw.evidence_date).slice().sort();
    var rec = {
      raw: raw,
      idx: idx,
      key: 'r' + idx,
      id: raw.source_id || ('第 ' + (idx + 1) + ' 列'),
      gradeKey: gradeKey,
      group: group,
      name: splitName(raw.name),
      areaKeys: areaKeys(raw.area),
      speciesGroup: speciesGroup(raw.species),
      hasDate: dates.length > 0,
      latest: dates.length ? dates[dates.length - 1] : '',
      pastOnly: isPastOnly(raw.evidence_date),
      rank: 0
    };
    rec.search = fold(COLUMNS.map(function (k) { return raw[k]; }).join('\n') + '\n' + group.name + '\n' +
      (gradeKey ? GRADE_INFO[gradeKey].short + ' ' + GRADE_INFO[gradeKey].long : MISSING) + '\n' +
      rec.areaKeys.join(' ') + '\n' + rec.speciesGroup);
    return rec;
  }

  function gradeRank(r) {
    var i = GRADE_ORDER.indexOf(r.gradeKey);
    return i < 0 ? 99 : i;
  }

  /* 推薦排序：等級 → 有完整證據日期 → 最新日期（新到舊） → 編號 */
  function rankCompare(a, b) {
    return (gradeRank(a) - gradeRank(b)) ||
      ((b.hasDate ? 1 : 0) - (a.hasDate ? 1 : 0)) ||
      (a.latest < b.latest ? 1 : a.latest > b.latest ? -1 : 0) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : a.idx - b.idx);
  }

  /* ------------------------------------------------------------------
   * 4. 畫面元件
   * ------------------------------------------------------------------ */
  var state = { q: '', area: '', grade: '', species: '' };
  var records = [];
  var byKey = {};
  var cardEls = {};
  var sectionEls = {};
  var navEls = {};
  var areaButtons = [];
  var lastTrigger = null;

  var $ = function (id) { return document.getElementById(id); };

  function gradeLabel(r) {
    if (r.gradeKey) return r.gradeKey + '｜' + GRADE_INFO[r.gradeKey].long;
    return clean(r.raw.grade) ? clean(r.raw.grade) + '｜無法辨識的等級' : MISSING;
  }

  function gradeMark(r) {
    var letter = r.gradeKey || (clean(r.raw.grade) || '—');
    var meaning = r.gradeKey ? GRADE_INFO[r.gradeKey].short : (clean(r.raw.grade) ? '無法辨識的等級' : MISSING);
    return h('p', { class: 'grade-mark grade-mark--' + (r.gradeKey || 'none') }, [
      h('span', { class: 'grade-mark__label', text: '資料等級' }),
      h('span', { class: 'grade-mark__meaning', text: meaning }),
      h('span', { class: 'grade-mark__letter', text: letter })
    ]);
  }

  function nameNodes(r, mainClass, subClass) {
    var n = r.name;
    var kids = [h('span', { class: mainClass + (n.missing ? ' is-missing' : ''), text: n.main })];
    if (n.sub) {
      kids.push(h('span', { class: 'sr-only', text: n.sep }));
      kids.push(h('span', { class: subClass, text: n.sub }));
    }
    return kids;
  }

  function evidenceNodes(r) {
    var kids = [valueNode(r.raw.evidence_date)];
    if (r.pastOnly) kids.push(h('span', { class: 'date-tag', text: '歷史日期・非目前狀態' }));
    return kids;
  }

  function linkButton(label, url) {
    url = clean(url);
    if (!url) {
      return h('span', { class: 'link-btn link-btn--missing' }, [label + '：' + MISSING]);
    }
    if (DEAD_LINKS[url]) {
      /* 整句包在同一個行內元素裡，窄螢幕換行時仍是一句連續的文字 */
      return h('span', { class: 'link-btn link-btn--dead', title: url },
        h('span', { class: 'link-btn__text' }, [label + '：'].concat(runs(DEAD_LINKS[url]))));
    }
    if (!isHttpUrl(url)) {
      return h('span', { class: 'link-btn link-btn--missing', title: url }, [label + '：網址格式無法開啟']);
    }
    return h('a', { class: 'link-btn', href: url, target: '_blank', rel: 'noopener noreferrer', title: url }, [
      h('span', { text: label }), icon('ext'), h('span', { class: 'sr-only', text: '（另開新視窗）' })
    ]);
  }

  function metaItem(label, kids, mod) {
    return h('div', { class: 'meta-item' + (mod ? ' meta-item--' + mod : '') }, [
      h('dt', { text: label }),
      h('dd', null, kids)
    ]);
  }

  function buildCard(r) {
    var titleId = 'card-title-' + r.key;
    var openBtn = h('button', { type: 'button', class: 'card__open', 'data-open': r.key, 'aria-haspopup': 'dialog' },
      nameNodes(r, 'card__name', 'card__subname'));

    var kicker = r.rank ? h('p', { class: 'card__kicker' }, h('span', { class: 'card__rank' }, rankWords(r.rank))) : null;

    var card = h('article', { class: 'card tone-' + r.group.id, 'data-key': r.key, 'aria-labelledby': titleId }, [
      h('div', { class: 'card__head' }, [
        h('p', { class: 'card__callno' }, [
          h('span', { class: 'card__id', text: r.id }),
          valueNode(r.raw.group_id, 'span')
        ]),
        gradeMark(r)
      ]),
      kicker,
      h('h4', { class: 'card__title', id: titleId }, openBtn),
      h('dl', { class: 'card__meta' }, [
        metaItem('區域', valueNode(r.raw.area)),
        metaItem('物種', valueNode(r.raw.species)),
        metaItem('資料提供者', valueNode(r.raw.operator), 'wide'),
        metaItem('資料角色', valueNode(r.raw.role), 'wide'),
        metaItem('證據日期', evidenceNodes(r)),
        metaItem('最後稽核日期', valueNode(r.raw.audited_at), 'quiet')
      ]),
      h('div', { class: 'card__finding' }, [
        h('p', { class: 'card__finding-label', text: '摘要' }),
        valueNode(r.raw.finding, 'p')
      ]),
      h('div', { class: 'card__links', role: 'group', 'aria-label': '連結' }, [
        linkButton('官方網站', r.raw.url),
        linkButton('證據來源', r.raw.evidence_url),
        linkButton('其他連結', r.raw.extra_url)
      ]),
      h('button', { type: 'button', class: 'card__more', 'data-open': r.key, 'aria-haspopup': 'dialog' }, [
        h('span', null, ['詳細資訊與資料限制', h('span', { class: 'sr-only', text: '：' + (r.raw.name || r.id) })]),
        icon('arrow', 'card__more-arrow')
      ])
    ]);
    return card;
  }

  /* ---------- 推薦來源書架 ---------- */
  function buildShelf(ranked) {
    var list = $('shelf-list');
    list.textContent = '';
    var items = ranked.filter(function (r) { return (r.gradeKey === 'S' || r.gradeKey === 'A') && r.hasDate; });
    if (!items.length) {
      list.appendChild(h('p', { class: 'state', text: '目前沒有符合推薦規則的來源。' }));
      return;
    }
    $('shelf-note').textContent = '書架列出等級 S 與 A、而且有完整證據日期的 ' + items.length +
      ' 筆，依上面的規則排序；書背上的日期是證據日期中最新的一天，不等於目前葉況。';

    ['S', 'A'].forEach(function (g) {
      var tierItems = items.filter(function (r) { return r.gradeKey === g; });
      if (!tierItems.length) return;
      var spines = h('div', { class: 'tier__spines' });
      tierItems.forEach(function (r) {
        var hf = SPINE_HEIGHTS[(r.rank - 1) % SPINE_HEIGHTS.length];
        var parts = r.latest.split('-');
        var label = '推薦第 ' + r.rank + ' 名：' + (r.raw.name || r.id) + '，資料等級 ' + g + '（' +
          GRADE_INFO[g].short + '），證據日期 ' + (r.raw.evidence_date || MISSING) + '。開啟詳細資訊';
        var btn = h('button', {
          type: 'button', class: 'spine spine--' + g, 'data-open': r.key, 'aria-haspopup': 'dialog',
          'aria-label': label, title: r.raw.name || r.id, style: '--hf:' + hf
        }, [
          h('span', { class: 'spine__band', 'aria-hidden': 'true', text: g }),
          h('span', { class: 'spine__title', 'aria-hidden': 'true' }, [
            h('span', { class: 'spine__name', text: r.name.main }),
            r.name.sub ? h('span', { class: 'spine__sub', text: r.name.sub }) : null
          ]),
          h('span', { class: 'spine__foot', 'aria-hidden': 'true' }, [
            h('span', { class: 'spine__date' }, [parts[0], h('br'), parts[1] + '·' + parts[2]]),
            h('span', { class: 'spine__rank' }, ['第', h('span', { class: 'num', text: String(r.rank) }), '名'])
          ])
        ]);
        spines.appendChild(btn);
      });
      list.appendChild(h('div', { class: 'tier tier--' + g }, [
        spines,
        h('p', { class: 'tier__label' }, [
          h('span', { class: 'tier__letter', text: g }),
          h('span', { text: GRADE_INFO[g].short + '・' + tierItems.length + ' 筆' })
        ])
      ]));
    });
  }

  /* ---------- 篩選選單與區域索引 ---------- */
  function countBy(fn) {
    var m = {};
    records.forEach(function (r) {
      [].concat(fn(r)).forEach(function (k) { m[k] = (m[k] || 0) + 1; });
    });
    return m;
  }

  function orderAreas(keys) {
    function idx(list, k) { var i = list.indexOf(k); return i < 0 ? 999 : i; }
    var wards = keys.filter(function (k) { return /區$/.test(k) && SPECIAL_AREAS.indexOf(k) < 0; });
    var cities = keys.filter(function (k) { return /市$/.test(k) && SPECIAL_AREAS.indexOf(k) < 0; });
    var others = keys.filter(function (k) { return wards.indexOf(k) < 0 && cities.indexOf(k) < 0; });
    wards.sort(function (a, b) { return idx(WARD_ORDER, a) - idx(WARD_ORDER, b) || (a < b ? -1 : 1); });
    cities.sort(function (a, b) { return idx(CITY_ORDER, a) - idx(CITY_ORDER, b) || (a < b ? -1 : 1); });
    others.sort(function (a, b) { return idx(SPECIAL_AREAS, a) - idx(SPECIAL_AREAS, b) || (a < b ? -1 : 1); });
    return [
      { label: '區部（23 區）', keys: wards },
      { label: '市部（多摩地區）', keys: cities },
      { label: '跨區域與其他', keys: others }
    ].filter(function (g) { return g.keys.length; });
  }

  function buildFilters() {
    var areaCounts = countBy(function (r) { return r.areaKeys; });
    var areaGroups = orderAreas(Object.keys(areaCounts));

    var areaSel = $('f-area');
    areaGroups.forEach(function (g) {
      var og = h('optgroup', { label: g.label });
      g.keys.forEach(function (k) { og.appendChild(h('option', { value: k, text: k + '（' + areaCounts[k] + '）' })); });
      areaSel.appendChild(og);
    });

    var gradeCounts = countBy(function (r) { return r.gradeKey || '__none'; });
    var gradeSel = $('f-grade');
    GRADE_ORDER.forEach(function (g) {
      if (!gradeCounts[g]) return;
      gradeSel.appendChild(h('option', { value: g, text: g + '｜' + GRADE_INFO[g].short + '（' + gradeCounts[g] + '）' }));
    });
    if (gradeCounts.__none) {
      var unknown = records.some(function (r) { return !r.gradeKey && clean(r.raw.grade); });
      gradeSel.appendChild(h('option', { value: '__none', text: (unknown ? MISSING + '或無法辨識' : MISSING) + '（' + gradeCounts.__none + '）' }));
    }

    var spCounts = countBy(function (r) { return r.speciesGroup; });
    var spSel = $('f-species');
    SPECIES_GROUPS.forEach(function (s) {
      if (!spCounts[s]) return;
      spSel.appendChild(h('option', { value: s, text: s + '（' + spCounts[s] + '）' }));
    });

    /* 區域索引（取代地圖） */
    var list = $('area-list');
    list.textContent = '';
    function areaBtn(value, label, count) {
      var b = h('button', { type: 'button', class: 'area-btn', 'data-area': value, 'aria-pressed': 'false' }, [
        h('span', { class: 'area-btn__name', text: label }),
        h('span', { class: 'area-btn__leader', 'aria-hidden': 'true' }),
        h('span', { class: 'area-btn__count' }, [String(count), h('span', { class: 'sr-only', text: ' 筆' })])
      ]);
      areaButtons.push(b);
      return b;
    }
    list.appendChild(h('div', { class: 'area-group area-group--all' }, [areaBtn('', '全部區域', records.length)]));
    areaGroups.forEach(function (g) {
      var ul = h('ul', { class: 'area-group__list' });
      g.keys.forEach(function (k) { ul.appendChild(h('li', null, areaBtn(k, k, areaCounts[k]))); });
      list.appendChild(h('div', { class: 'area-group' }, [h('p', { class: 'area-group__title', text: g.label }), ul]));
    });
  }

  /* ---------- 分類區塊 ---------- */
  function buildGroups() {
    var wrap = $('groups');
    var nav = $('group-nav');
    wrap.textContent = '';
    nav.textContent = '';
    GROUPS.forEach(function (g, i) {
      var items = records.filter(function (r) { return r.group.id === g.id; });
      var cards = h('div', { class: 'cards' });
      items.forEach(function (r) {
        var c = buildCard(r);
        cardEls[r.key] = c;
        cards.appendChild(c);
      });
      var countEl = h('span', { class: 'group__count' }, [h('span', { class: 'num', text: String(items.length) }), ' 筆']);
      var section = h('section', { class: 'group tone-' + g.id, id: 'group-' + g.id, 'aria-labelledby': 'group-title-' + g.id }, [
        h('header', { class: 'group__head' }, [
          h('span', { class: 'group__num', 'aria-hidden': 'true', text: pad2(i + 1) }),
          h('h3', { class: 'group__title', id: 'group-title-' + g.id, text: g.name }),
          countEl,
          h('p', { class: 'group__rule' }, [h('b', { text: '分類規則　' })].concat(runs(g.rule))),
          h('p', { class: 'group__note' }, runs(g.note))
        ]),
        cards
      ]);
      sectionEls[g.id] = { section: section, count: countEl.firstChild, total: items.length };
      wrap.appendChild(section);

      var navCount = h('span', { class: 'group-nav__n', text: String(items.length) });
      var a = h('a', { class: 'group-nav__link tone-' + g.id, href: '#group-' + g.id }, [
        h('span', { class: 'group-nav__bar', 'aria-hidden': 'true' }),
        h('span', { class: 'group-nav__name', text: g.name }),
        navCount
      ]);
      navEls[g.id] = { link: a, count: navCount };
      nav.appendChild(a);
    });
    wrap.setAttribute('aria-busy', 'false');

    /* 資料說明中的分類規則與等級說明 */
    var rules = $('group-rules');
    rules.textContent = '';
    GROUPS.forEach(function (g) {
      rules.appendChild(h('div', { class: 'rule-item tone-' + g.id }, [
        h('dt', { text: g.name + '（' + g.grades.join('、') + '）' }),
        h('dd', null, runs(g.rule))
      ]));
    });
    var legend = $('grade-legend');
    legend.textContent = '';
    var gc = countBy(function (r) { return r.gradeKey || '__none'; });
    GRADE_ORDER.forEach(function (g) {
      legend.appendChild(h('div', { class: 'legend-item' }, [
        h('dt', { class: 'legend-item__letter grade-' + g, text: g }),
        h('dd', null, [
          h('span', { class: 'legend-item__text', text: GRADE_INFO[g].long }),
          h('span', { class: 'legend-item__count', text: (gc[g] || 0) + ' 筆' })
        ])
      ]));
    });
  }

  /* ------------------------------------------------------------------
   * 5. 篩選
   * ------------------------------------------------------------------ */
  function terms() {
    return fold(state.q).split(/\s+/).filter(Boolean);
  }

  function matches(r, t) {
    if (state.area && r.areaKeys.indexOf(state.area) < 0) return false;
    if (state.grade && (r.gradeKey || '__none') !== state.grade) return false;
    if (state.species && r.speciesGroup !== state.species) return false;
    for (var i = 0; i < t.length; i++) if (r.search.indexOf(t[i]) < 0) return false;
    return true;
  }

  function isFiltered() { return !!(state.q.trim() || state.area || state.grade || state.species); }

  function apply(animate) {
    var t = terms();
    var shown = 0;
    var perGroup = {};
    var reveal = [];
    records.forEach(function (r) {
      var ok = matches(r, t);
      var el = cardEls[r.key];
      if (ok) {
        shown++;
        perGroup[r.group.id] = (perGroup[r.group.id] || 0) + 1;
        if (el.hidden) reveal.push(el);
      }
      el.hidden = !ok;
    });

    GROUPS.forEach(function (g) {
      var n = perGroup[g.id] || 0;
      var s = sectionEls[g.id];
      s.section.hidden = n === 0;
      s.count.textContent = String(n);
      var nav = navEls[g.id];
      nav.count.textContent = String(n);
      nav.link.classList.toggle('is-empty', n === 0);
      if (n === 0) {
        nav.link.setAttribute('aria-disabled', 'true');
        nav.link.classList.remove('is-current'); /* 沒有結果的分類不標成「目前位置」 */
      } else {
        nav.link.removeAttribute('aria-disabled');
      }
    });

    var total = records.length;
    var countEl = $('result-count');
    countEl.textContent = '';
    if (isFiltered()) {
      append(countEl, ['符合 ', h('b', { class: 'num', text: String(shown) }), ' 筆', h('span', { class: 'result-bar__total', text: '（共 ' + total + ' 筆）' })]);
    } else {
      append(countEl, ['共 ', h('b', { class: 'num', text: String(total) }), ' 筆來源']);
    }
    $('reset-filters').hidden = !isFiltered();
    $('empty-state').hidden = shown !== 0;
    $('group-nav').hidden = shown === 0;

    areaButtons.forEach(function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-area') === state.area ? 'true' : 'false');
    });

    if (animate && !prefersReducedMotion()) {
      reveal.slice(0, 16).forEach(function (el, i) {
        el.classList.remove('is-entering');
        void el.offsetWidth;
        el.style.setProperty('--d', (i * 28) + 'ms');
        el.classList.add('is-entering');
      });
    }
  }

  function syncControls() {
    $('q').value = state.q;
    $('f-area').value = state.area;
    $('f-grade').value = state.grade;
    $('f-species').value = state.species;
  }

  function resetFilters() {
    state.q = ''; state.area = ''; state.grade = ''; state.species = '';
    syncControls();
    apply(true);
  }

  function scrollResultsIntoView() {
    var bar = document.querySelector('.result-bar');
    if (!bar) return;
    var top = bar.getBoundingClientRect().top;
    if (top < 0 || top > window.innerHeight * 0.6) {
      bar.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
    }
  }

  function bindFilters() {
    var timer = null;
    var q = $('q');
    q.addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(function () { state.q = q.value; apply(true); }, 140);
    });
    q.addEventListener('search', function () { clearTimeout(timer); state.q = q.value; apply(true); });
    $('filters').addEventListener('submit', function (e) {
      e.preventDefault();
      clearTimeout(timer);
      state.q = q.value;
      apply(true);
      scrollResultsIntoView();
    });
    [['f-area', 'area'], ['f-grade', 'grade'], ['f-species', 'species']].forEach(function (pair) {
      $(pair[0]).addEventListener('change', function (e) { state[pair[1]] = e.target.value; apply(true); });
    });
    $('reset-filters').addEventListener('click', function () { resetFilters(); q.focus(); });
    $('empty-reset').addEventListener('click', function () { resetFilters(); q.focus(); });

    $('area-list').addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('.area-btn') : null;
      if (!b) return;
      state.area = b.getAttribute('data-area') || '';
      $('f-area').value = state.area;
      apply(true);
      scrollResultsIntoView();
    });

    $('group-nav').addEventListener('click', function (e) {
      var a = e.target.closest ? e.target.closest('a') : null;
      if (a && a.getAttribute('aria-disabled') === 'true') e.preventDefault();
    });
  }

  /* ------------------------------------------------------------------
   * 6. 詳細資訊抽屜
   * ------------------------------------------------------------------ */
  var dialog, panelBody, closing = false, closeTimer = null;
  var hasDialog = false;

  function detailRow(label, kids) {
    return h('div', { class: 'detail-row' }, [h('dt', { text: label }), h('dd', null, kids)]);
  }

  function detailLink(label, url) {
    url = clean(url);
    if (!url) {
      return h('li', { class: 'dlink dlink--missing' }, [
        h('span', { class: 'dlink__label', text: label }),
        h('span', { class: 'dlink__host is-missing', text: MISSING })
      ]);
    }
    if (DEAD_LINKS[url] || !isHttpUrl(url)) {
      return h('li', { class: 'dlink dlink--dead' }, [
        h('span', { class: 'dlink__label', text: label }),
        h('span', { class: 'dlink__host' }, runs(DEAD_LINKS[url] || '網址格式無法開啟')),
        h('span', { class: 'dlink__url', text: url })
      ]);
    }
    return h('li', null, h('a', { class: 'dlink', href: url, target: '_blank', rel: 'noopener noreferrer' }, [
      h('span', { class: 'dlink__label', text: label }),
      h('span', { class: 'dlink__host', text: hostOf(url) }),
      icon('ext', 'dlink__icon'),
      h('span', { class: 'dlink__url', text: url }),
      h('span', { class: 'sr-only', text: '（另開新視窗）' })
    ]));
  }

  function fillDetail(r) {
    $('detail-callno').textContent = '';
    append($('detail-callno'), [
      h('span', { class: 'drawer__id', text: r.id }),
      h('span', { class: 'drawer__gid', text: clean(r.raw.group_id) || MISSING })
    ]);

    var caveatKids = [
      h('p', { class: 'caveat__label' }, [icon('note'), '資料限制（使用前請先看）']),
      valueNode(r.raw.caveat, 'p')
    ];
    caveatKids[1].classList.add('caveat__text');
    if (r.pastOnly) {
      caveatKids.push(h('p', { class: 'caveat__extra', text: '這一列的證據日期在 2025 年（含）以前，只能當作歷史紀錄，不代表目前狀態。' }));
    }

    panelBody.textContent = '';
    append(panelBody, [
      h('p', { class: 'drawer__kicker tone-' + r.group.id }, [
        h('span', { class: 'drawer__group', text: r.group.name }),
        h('span', { class: 'drawer__grade', text: '資料等級 ' + (r.gradeKey || clean(r.raw.grade) || MISSING) }),
        r.rank ? h('span', { class: 'drawer__rank' }, rankWords(r.rank)) : null
      ]),
      h('h2', { class: 'drawer__title', id: 'detail-title' }, nameNodes(r, 'drawer__name', 'drawer__subname')),
      h('section', { class: 'caveat', 'aria-label': '資料限制' }, caveatKids),
      h('p', { class: 'drawer__status' }, [
        h('span', { class: 'drawer__status-label', text: '2026 季即時葉況' }),
        h('span', { class: 'drawer__status-value', text: '尚未確認' }),
        h('span', { class: 'drawer__status-text' }, runs('截至 2026-10-02 沒有官方判定的 2026 季銀杏葉況階段；本站不推測葉況，請以官方網站最新公告為準。')),
        STATUS_NOTES[r.raw.source_id] ? h('span', { class: 'drawer__status-note' }, runs(STATUS_NOTES[r.raw.source_id])) : null
      ]),
      h('h3', { class: 'drawer__h', text: '資料內容' }),
      h('dl', { class: 'detail-list' }, [
        detailRow('區域', valueNode(r.raw.area)),
        detailRow('資料提供者', valueNode(r.raw.operator)),
        detailRow('資料角色', valueNode(r.raw.role)),
        detailRow('物種', valueNode(r.raw.species)),
        detailRow('資料等級', h('span', { class: r.gradeKey || clean(r.raw.grade) ? null : 'is-missing', text: gradeLabel(r) })),
        detailRow('證據日期', evidenceNodes(r)),
        detailRow('最後稽核日期', valueNode(r.raw.audited_at)),
        detailRow('摘要', valueNode(r.raw.finding)),
        detailRow('更新頻率', valueNode(r.raw.cadence)),
        detailRow('建議檢查頻率', valueNode(r.raw.suggested_poll)),
        detailRow('頁面讀取狀態', valueNode(r.raw.access)),
        detailRow('來源群組', valueNode(r.raw.group_id))
      ]),
      h('h3', { class: 'drawer__h', text: '連結' }),
      h('ul', { class: 'dlinks' }, [
        detailLink('官方網站', r.raw.url),
        detailLink('證據來源', r.raw.evidence_url),
        detailLink('其他連結', r.raw.extra_url)
      ]),
      h('p', { class: 'drawer__reason' }, runs(
        '分類依據：資料等級 ' + (r.gradeKey || (clean(r.raw.grade) || '空白')) + ' → ' + r.group.name + '。' +
        '資料取自課程提供的 Google 試算表，各列最後稽核 2026-09-29。'
      ))
    ]);
  }

  function openDetail(key, trigger) {
    var r = byKey[key];
    if (!r) return;
    clearTimeout(closeTimer);
    closing = false;
    dialog.classList.remove('is-closing');
    lastTrigger = trigger || null;
    fillDetail(r);
    /* 先量捲軸寬度，再鎖住頁面捲動，頁面內容才不會跳動 */
    if (!document.documentElement.classList.contains('has-modal')) {
      var sbw = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
      document.documentElement.style.setProperty('--sbw', sbw + 'px');
    }
    if (!dialog.open) {
      if (hasDialog) dialog.showModal();
      else dialog.setAttribute('open', '');
    }
    document.documentElement.classList.add('has-modal');
    panelBody.scrollTop = 0;
    $('detail-close').focus();
  }

  function finishClose() {
    dialog.classList.remove('is-closing');
    closing = false;
    if (hasDialog) { if (dialog.open) dialog.close(); }
    else { dialog.removeAttribute('open'); afterClose(); }
  }

  function afterClose() {
    document.documentElement.classList.remove('has-modal');
    document.documentElement.style.removeProperty('--sbw');
    if (lastTrigger && document.body.contains(lastTrigger) && !lastTrigger.closest('[hidden]')) {
      try { lastTrigger.focus({ preventScroll: true }); } catch (e) { lastTrigger.focus(); }
    }
    lastTrigger = null;
  }

  function closeDetail() {
    if (!dialog.open || closing) return;
    if (prefersReducedMotion()) { finishClose(); return; }
    closing = true;
    dialog.classList.add('is-closing');
    closeTimer = setTimeout(finishClose, 190);
  }

  function bindDetail() {
    dialog = $('detail');
    panelBody = $('detail-body');
    hasDialog = typeof dialog.showModal === 'function';
    if (!hasDialog) dialog.classList.add('drawer--fallback');

    document.addEventListener('click', function (e) {
      var t = e.target.closest ? e.target.closest('[data-open]') : null;
      if (t) { e.preventDefault(); openDetail(t.getAttribute('data-open'), t); }
    });
    $('detail-close').addEventListener('click', closeDetail);
    dialog.addEventListener('cancel', function (e) { e.preventDefault(); closeDetail(); });
    dialog.addEventListener('close', afterClose);
    dialog.addEventListener('click', function (e) { if (e.target === dialog) closeDetail(); });
    document.addEventListener('keydown', function (e) {
      if ((e.key === 'Escape' || e.key === 'Esc') && dialog.open && !hasDialog) closeDetail();
    });
  }

  /* ------------------------------------------------------------------
   * 7. 版面細節
   * ------------------------------------------------------------------ */
  function bindLayout() {
    var details = $('area-details');
    var summary = details.querySelector('summary');
    var wide = window.matchMedia ? window.matchMedia('(min-width: 1100px)') : null;
    function isWide() { return !!(wide && wide.matches); }
    function onChange(list, fn) {
      if (!list) return;
      if (list.addEventListener) list.addEventListener('change', fn);
      else if (list.addListener) list.addListener(fn);
    }
    /* 寬螢幕：區域索引固定展開在目錄左側，標題列不能收合，也不是 Tab 停駐點（對螢幕報讀器標示為停用）。
       平板與手機：預設收合在篩選列上方，點標題列即可展開，讓搜尋框與筆數留在第一屏附近 */
    function syncWide() {
      if (!wide) return;
      if (isWide()) {
        details.open = true;
        summary.tabIndex = -1;
        summary.setAttribute('aria-disabled', 'true');
      } else {
        details.open = false;
        summary.removeAttribute('tabindex');
        summary.removeAttribute('aria-disabled');
      }
    }
    syncWide();
    onChange(wide, syncWide);
    summary.addEventListener('click', function (e) { if (isWide()) e.preventDefault(); });
    details.addEventListener('toggle', function () { if (isWide() && !details.open) details.open = true; });
    document.addEventListener('click', function (e) {
      var a = e.target.closest ? e.target.closest('a[href="#area-index"]') : null;
      if (a) details.open = true;
    });

    /* 目前閱讀到的分類，在分類列上標示 */
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          var id = en.target.id.replace('group-', '');
          Object.keys(navEls).forEach(function (k) { navEls[k].link.classList.toggle('is-current', k === id); });
        });
      }, { rootMargin: '-25% 0px -65% 0px' });
      GROUPS.forEach(function (g) { io.observe(sectionEls[g.id].section); });
    }

    /* 書架：可左右捲動時顯示提示 */
    var scroller = $('shelf-scroller');
    function syncShelf() {
      var over = scroller.scrollWidth > scroller.clientWidth + 2;
      scroller.classList.toggle('is-scrollable', over);
      scroller.tabIndex = over ? 0 : -1;
      document.querySelector('.shelf__hint').classList.toggle('is-visible', over);
    }
    syncShelf();
    window.addEventListener('resize', syncShelf);
  }

  function showError() {
    var msg = '資料載入失敗，請重新整理頁面；若仍無法顯示，請直接開啟課程提供的 Google 試算表查看。';
    var groups = $('groups');
    groups.textContent = '';
    groups.appendChild(h('p', { class: 'state state--error', role: 'alert', text: msg }));
    groups.setAttribute('aria-busy', 'false');
    document.documentElement.classList.add('is-error');
    var countEl = $('result-count');
    if (countEl) countEl.textContent = '目前無法顯示資料';
    var shelf = $('shelf-list');
    shelf.textContent = '';
    shelf.appendChild(h('p', { class: 'state state--error', text: '推薦來源無法顯示。' }));
  }

  /* ------------------------------------------------------------------
   * 8. 啟動
   * ------------------------------------------------------------------ */
  function init() {
    try {
      records = toRecords(parseCSV(SHEET_CSV)).map(enrich);
      if (!records.length) throw new Error('沒有資料列');
      records.forEach(function (r) { byKey[r.key] = r; });
      var ranked = records.slice().sort(rankCompare);
      ranked.forEach(function (r, i) {
        if ((r.gradeKey === 'S' || r.gradeKey === 'A') && r.hasDate) r.rank = i + 1;
      });
      $('fact-total').textContent = String(records.length);
      buildShelf(ranked);
      buildFilters();
      buildGroups();
      bindFilters();
      bindDetail();
      bindLayout();
      apply(false);
      document.documentElement.classList.add('is-ready');
    } catch (err) {
      showError();
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
