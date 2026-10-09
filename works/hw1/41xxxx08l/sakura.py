#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""東京銀杏一年生長階段情報：網站產生程式（只使用 Python 標準庫）。

這個檔案是網站的唯一來源：資料、頁面樣板、樣式與腳本都在這裡。
執行後會在「這個檔案所在的資料夾」產生下列靜態檔案：

    index.html  style.css  app.js  data.js  sources.html
    stages/1.html ... stages/6.html          六個生長階段的詳細頁
    places/<id>.html                         26 處觀賞地點的詳細頁

用法
----
    python sakura.py build            產生網站（不啟動伺服器）
    python sakura.py serve            先產生網站，再開啟本機伺服器：http://localhost:8000/
    python sakura.py serve --port 8080   改用其他連接埠

    也可以不啟動伺服器：產生後直接雙擊 index.html 就能開啟（所有連結都是相對路徑）。
    要放到靜態主機（例如 Cloudflare Pages）時，把整個資料夾上傳即可。
    停止伺服器請按 Ctrl+C。若直接修改產生出來的檔案，下次 build 會被覆蓋，請改這個檔案。

階段怎麼判定
------------
    資料表（tokyo_ginkgo_sources_2026-09-29.xlsx）與官方頁面都沒有「2026 年各地點的銀杏階段」，
    所以網站使用「依氣象廳東京平年值推估」的共通階段：
        見頃從氣象廳東京いちょう黄葉日平年值（11/23）開始，落葉從いちょう落葉日平年值（12/3）開始，
        其餘邊界是示意參數：11/23 的前 28 天、前 14 天、後 6 天。
    階段由 app.js 在瀏覽器中依「你開啟頁面當天的日期」計算，所以不需要重新產生網站，
    判定日期、依據與資料來源都會標示在每個頁面。26 處地點共用同一個推估，沒有逐地點的差異。
    過去年度的官方紀錄只會以「有日期的歷史紀錄」顯示，不當作現況。

需要的外部資源（都在瀏覽器端載入，失敗時網站仍可使用表格與各頁面）
    Leaflet 1.9.4（unpkg）、OpenStreetMap 圖磚（tile.openstreetmap.org）、Google Fonts。
"""
import argparse
import html
import http.server
import json
import mimetypes
import os
import re
import socket
import socketserver
import sys
from datetime import date, timedelta
from pathlib import Path
from urllib.parse import quote, urlparse

ROOT = Path(__file__).resolve().parent

SITE_NAME = "東京銀杏一年生長階段情報"
BRAND = "東京銀杏情報"
SHEET_FILE = "tokyo_ginkgo_sources_2026-09-29.xlsx"
SHEET_DATE = "2026-09-29"
CHECKED_ON = "2026-10-02"

# ----------------------------------------------------------------------------
# 1. 階段模型
# ----------------------------------------------------------------------------
# D = 氣象廳（JMA）東京 いちょう黄葉日 平年值 11/23（1991–2020）= 見頃的第一天
# いちょう落葉日 平年值 12/3 = D+10 = 落葉的第一天
MODEL = {"baseMonth": 11, "baseDay": 23, "offsets": [None, -28, -14, 0, 6, 10], "springMonth": 4}
_BASE = date(2001, 11, 23)  # 只用月日；2001 年不是閏年


def _md(offset):
    d = _BASE + timedelta(days=offset)
    return "%d/%d" % (d.month, d.day)


STAGES = [
    dict(
        n=1, ja="青葉", yomi="あおば", gloss="綠葉期", window="〜" + _md(-29),
        full="4/1 至 " + _md(-29), edge="起點 4/1 是本站的保守假設", edge_kind="假設",
        look=[
            "葉片仍是鮮綠色，整棵樹的樹冠是一片綠。從春天長出新葉，到初秋之前都屬於這個階段，是一年裡最長的一段。",
            "這個階段還不是賞黃葉的時候。看到葉子變黃的零星樹木，也不代表整體已經進入下一階段。",
        ],
        history=[
            ("2026-10-02", "氣象廳東京的 2026 年黃葉日尚未觀測（官方頁面顯示「///」）。「尚未報告」不等於青葉，本站的青葉是依平年值倒推的推估。",
             "https://www.data.jma.go.jp/sakura/data/phn_012.html"),
        ],
    ),
    dict(
        n=2, ja="色づき始め", yomi="いろづきはじめ", gloss="開始轉色", window=_md(-28) + "–" + _md(-15),
        full=_md(-28) + " 至 " + _md(-15), edge="示意參數：D−28 日起", edge_kind="示意參數",
        look=[
            "部分枝條或葉緣的葉片開始由綠轉黃，樹冠仍以綠色為主，黃色只是點綴。",
            "同一棵樹、同一條並木的不同位置，轉色的快慢可能不一樣，所以這個階段的樣子差異很大。",
        ],
        history=[
            ("2024-11-13", "國民公園協會報導北の丸公園的銀杏「剛開始變色」。這是 2024 年的紀錄；當年氣象廳東京的黃葉日是 12/3，比平年值晚 10 天，所以日期不能直接套用到今年。",
             "https://fng.or.jp/koukyo/2024/11/13/irodukukitanomarukouen/"),
        ],
    ),
    dict(
        n=3, ja="黄葉進行", yomi="おうようしんこう", gloss="黃葉進行中", window=_md(-14) + "–" + _md(-1),
        full=_md(-14) + " 至 " + _md(-1), edge="示意參數：D−14 日起", edge_kind="示意參數",
        look=[
            "黃色從局部擴大到整棵樹，綠色一天比一天少。氣象廳把「標本木大部分的葉子變成黃色的第一天」定為黃葉日，也就是這個階段的終點。",
            "樹上的葉子還很多，離最飽滿的金黃色只差一步。",
        ],
        history=[
            ("2025-11-08", "あきる野市觀光協會的紅葉情報：廣德寺的銀杏變色有進展，離見頃還差一點（2025-11-06 拍攝）。",
             "https://www.akirunokanko.com/?p=8712"),
            ("2025-11-19", "小石川植物園的日期文章把イチョウ列為正在紅葉／黃葉的植物。看到黃葉不等於見頃。",
             "https://koishikawa-bg.jp/kaika/5013/"),
        ],
    ),
    dict(
        n=4, ja="見頃", yomi="みごろ", gloss="最佳觀賞期", window=_md(0) + "–" + _md(5),
        full=_md(0) + " 至 " + _md(5), edge="起點取自氣象廳平年值（11/23）", edge_kind="氣象廳平年值",
        look=[
            "大部分的葉子已經變成黃色，而且多數還留在樹上，整排銀杏呈現最飽滿的金黃色。",
            "本站把氣象廳東京的いちょう黄葉日平年值 11/23 當作見頃的第一天；氣象廳的黃葉日是標本木的觀測定義，並不是各公園的實際最佳觀賞日，真正的時機每年會前後移動。",
        ],
        history=[
            ("2025-11-28", "新宿御苑的官方文章寫園內各處的銀杏正值見頃（去年的紀錄）。",
             "https://fng.or.jp/shinjuku/2025/11/28/20251128_03/"),
            ("2022-11-17", "明治神宮外苑的外苑便り：「イチョウ並木が見頃です」（四年前的紀錄）。",
             "https://www.meijijingugaien.jp/gaien-news/"),
            ("2025-11-22", "氣象廳東京 2025 年的いちょう黄葉日是 11/22，比平年值早 1 天（標本木）。",
             "https://www.data.jma.go.jp/sakura/data/phn_012.html"),
        ],
    ),
    dict(
        n=5, ja="落葉始め", yomi="おちばはじめ", gloss="開始落葉", window=_md(6) + "–" + _md(9),
        full=_md(6) + " 至 " + _md(9), edge="示意參數：D+6 日起", edge_kind="示意參數",
        look=[
            "葉子開始成片掉落，地面鋪上一層黃色的落葉，樹上仍留著不少葉子。",
            "風大或下雨之後，落葉的速度會明顯加快。",
        ],
        history=[],
    ),
    dict(
        n=6, ja="落葉", yomi="おちば", gloss="落葉期", window=_md(10) + "〜",
        full=_md(10) + " 至翌年 3/31", edge="起點取自氣象廳平年值（12/3）", edge_kind="氣象廳平年值",
        look=[
            "氣象廳把「約 80% 的葉子已經掉落的第一天」定為落葉日，東京的平年值是 12/3；本站從這一天起進入落葉階段。樹枝逐漸變得稀疏，只剩少數葉子。",
            "六個階段裡沒有「光禿禿的冬天」，所以本站保守地讓這個階段持續到翌年 3/31，4/1 起回到青葉。",
        ],
        history=[
            ("2025-12-04", "氣象廳東京 2025 年的いちょう落葉日是 12/4（平年值 12/3，標本木）。",
             "https://www.data.jma.go.jp/sakura/data/phn_013.html"),
        ],
    ),
]

JMA_SOURCES = [
    ("氣象廳｜いちょうの黄葉日（東京）", "https://www.data.jma.go.jp/sakura/data/phn_012.html",
     "東京的いちょう黄葉日：2025 年觀測 11/22；2026 年尚未觀測（顯示「///」）。資料表 TKG-020"),
    ("氣象廳｜いちょうの落葉日（東京）", "https://www.data.jma.go.jp/sakura/data/phn_013.html",
     "東京的いちょう落葉日：2025 年觀測 12/4；2026 年尚未觀測。資料表 TKG-021"),
    ("氣象廳｜生物季節 累年値 CSV 入口", "https://www.data.jma.go.jp/sakura/data/download_ruinenchi.html",
     "取得平年值的入口。資料表 TKG-022"),
    ("氣象廳｜いちょう黄葉日 累年値 CSV", "https://www.data.jma.go.jp/sakura/data/ruinenchi/013.csv",
     "東京 平年值（1991–2020）= 11/23，也用來列出近年的黃葉日（2023 年 12/1、2024 年 12/3、2025 年 11/22）"),
    ("氣象廳｜いちょう落葉日 累年値 CSV", "https://www.data.jma.go.jp/sakura/data/ruinenchi/014.csv",
     "東京 平年值（1991–2020）= 12/3"),
    ("氣象廳鹿兒島地方氣象台｜生物季節観測", "https://www.data.jma.go.jp/kagoshima/obs/seibutsu_kisetsu.html",
     "黃葉日與落葉日的定義（落葉日＝約 80% 的葉子已經掉落）、統計期間 1991–2020"),
]

GRADES = {
    "S": "官方公園協會",
    "A": "官方、有日期的現場觀測",
    "B": "官方，但銀杏專項資料尚待補",
    "C": "官方網站或入口，沒有日期的觀測",
    "O": "氣象廳觀測站尺度",
    "T": "第三方彙整",
    "X": "排除或失效來源",
}

KIND_LABEL = {
    "status": "本年度葉況（2026）",
    "notice": "2026 公告・非葉況",
    "event": "活動日期・非見頃日",
    "past": "往年度紀錄",
    "static": "官方介紹・無日期",
    "proof": "銀杏存在的依據",
}
KIND_ORDER = {"status": 0, "notice": 1, "event": 2, "past": 3, "static": 4, "proof": 5}

POS_EXPLAIN = {
    "park": "首頁地圖上的點是園區的代表位置（概略）。官方沒有指出銀杏的確切位置，所以它不是銀杏樹的座標。",
    "sub": "首頁地圖上的點是依官方文字與 OpenStreetMap 地物推算的園內位置（概略）。官方文字指出銀杏在這附近，但它不是銀杏樹的精確座標。",
    "avenue": "銀杏並木是線狀的。首頁地圖上的點是並木的代表位置（概略），實際的銀杏沿道路兩側分布。",
    "site": "首頁地圖上的點是地點本身的位置（概略），不是銀杏樹的精確座標。",
}
POS_LABEL = {
    "tkg-002": "公園中心（概略）", "tkg-003": "公園中心（概略）", "tkg-004": "公園中心（概略）",
    "tkg-005": "公園中心（概略；銀杏位置未核實）", "tkg-006": "公園中心（概略）",
    "tkg-007": "公園中心（概略；沿河的線狀公園）", "tkg-008": "公園中心（概略）",
    "tkg-009": "箱根山地區（概略）", "tkg-010": "觀賞池與販賣部之間（概略）",
    "tkg-011": "首賭けイチョウ附近（松本楼附近，概略）", "tkg-012": "公園中心（概略）",
    "tkg-013": "庭園正門（入口）", "tkg-014": "カナール（銀杏並木沿著水路）",
    "tkg-015": "大溫室附近（概略）", "tkg-016": "並木中段的代表點",
    "tkg-017": "百人番所附近（概略）", "tkg-018": "精子発見のイチョウ附近（概略）",
    "tkg-019": "廣德寺寺院位置", "tkg-023": "並木中點", "tkg-024": "公園位置",
    "tkg-025": "本殿・拜殿一帶", "tkg-026": "境內主要區域（拜殿）",
    "tkg-030-kitanomaru": "公園中心（概略）", "tkg-040-hongo": "並木中點（正門至安田講堂）",
    "tkg-040-komaba": "並木中段（概略）", "tkg-041": "國立站南側的並木（代表點）",
}

# 資料表 41 列各自的用途（place:<id> 表示在該地點頁面使用）
SHEET_USE = {
    "TKG-001": ("證據", "公園協會 2025 年度紅葉情報名單（TKG-002～013 的樹種依據）的出處。只證明樹種，不當作 2026 現況。"),
    "TKG-020": ("基準", "階段推估的基準：氣象廳東京いちょう黄葉日。"),
    "TKG-021": ("基準", "階段推估的基準：氣象廳東京いちょう落葉日。"),
    "TKG-022": ("基準", "取得平年值的入口（累年值 CSV）。"),
    "TKG-027": ("未採用", "東京全域的觀光介紹，沒有逐地點的銀杏觀測。"),
    "TKG-028": ("未採用", "區域觀光入口，尚未證實有定期的銀杏觀測。"),
    "TKG-029": ("未採用", "觀光入口，銀杏日期快訊未確認。"),
    "TKG-031": ("未採用", "神代植物公園：2025 年名單中的樹種是モミジ（楓），不是銀杏。"),
    "TKG-032": ("未採用", "銀杏物種與專項發布都尚待補證。"),
    "TKG-033": ("未採用", "第三方整合（多樹種混合），不用來判定階段。"),
    "TKG-034": ("未採用", "第三方紅葉平台（多樹種混合），不用來判定階段。"),
    "TKG-035": ("未採用", "第三方景點目錄（黃色樹種混合），不用來判定階段。"),
    "TKG-036": ("未採用", "第三方景點與見頃資訊，只作地點查漏，不用來判定階段。"),
    "TKG-037": ("未採用", "民間氣象公司的預報產品，不是觀測，也不是氣象廳。"),
    "TKG-038": ("排除", "2025 年舊專頁，查核時回傳 404。"),
    "TKG-039": ("排除", "舊管理公司的案例頁，不是現任營運來源。"),
}

# ----------------------------------------------------------------------------
# 2. 資料（由資料表與共用查證檔整理；細節見 ARCHITECTURE.md）
# ----------------------------------------------------------------------------
SHEET = {'TKG-001': {'name': '東京都公園協會｜紅葉情報入口',
             'area': '東京都內都立公園、庭園',
             'grade': 'S',
             'operator': '東京都建設局／公益財團法人東京都公園協會',
             'role': '年度葉況整合公告與當年網址發現',
             'url': 'https://www.tokyo-park.or.jp/',
             'extra_url': 'https://www.tokyo-park.or.jp/park_list/',
             'evidence_url': 'https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf',
             'evidence_date': '2025-11-04',
             'finding': '2025年度公告提供37處公園／庭園紅葉情報；其中11列含銀杏，合計12個具名園區。',
             'caveat': '2026年度沿用日期及網址尚未確認。37處不是37處銀杏。',
             'access': '已讀取頁面',
             'species': '銀杏'},
 'TKG-002': {'name': '上野恩賜公園',
             'area': '台東區',
             'grade': 'S',
             'operator': '公益財團法人東京都公園協會',
             'role': '園區入口／公告；銀杏觀測資格由2025年度名單證實',
             'url': 'https://www.tokyo-park.or.jp/park/ueno/',
             'extra_url': '',
             'evidence_url': 'https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf',
             'evidence_date': '2025-11-04',
             'finding': '2025年度官方紅葉情報名單明列本園區之銀杏；本次不宣稱已取得2026銀杏現況。',
             'caveat': '可列為銀杏專項季節觀測候選。',
             'access': '已讀取頁面',
             'species': '銀杏'},
 'TKG-003': {'name': '木場公園',
             'area': '江東區',
             'grade': 'S',
             'operator': '公益財團法人東京都公園協會',
             'role': '園區入口／公告；銀杏觀測資格由2025年度名單證實',
             'url': 'https://www.tokyo-park.or.jp/park/kiba/',
             'extra_url': '',
             'evidence_url': 'https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf',
             'evidence_date': '2025-11-04',
             'finding': '2025年度官方紅葉情報名單明列本園區之銀杏；本次不宣稱已取得2026銀杏現況。',
             'caveat': '保留園區原文所指子地點。',
             'access': '已讀取頁面',
             'species': '銀杏'},
 'TKG-004': {'name': '小金井公園',
             'area': '小金井市等',
             'grade': 'S',
             'operator': '公益財團法人東京都公園協會',
             'role': '園區入口／公告；銀杏觀測資格由2025年度名單證實',
             'url': 'https://www.tokyo-park.or.jp/park/koganei/',
             'extra_url': '',
             'evidence_url': 'https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf',
             'evidence_date': '2025-11-04',
             'finding': '2025年度官方紅葉情報名單明列本園區之銀杏；本次不宣稱已取得2026銀杏現況。',
             'caveat': '園區跨行政區；不以服務中心地址代表全部觀測點。',
             'access': '已讀取頁面',
             'species': '銀杏'},
 'TKG-005': {'name': '芝公園',
             'area': '港區',
             'grade': 'S',
             'operator': '公益財團法人東京都公園協會',
             'role': '園區入口／公告；銀杏觀測資格由2025年度名單證實',
             'url': 'https://www.tokyo-park.or.jp/park/siba/',
             'extra_url': '',
             'evidence_url': 'https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf',
             'evidence_date': '2025-11-04',
             'finding': '2025年度官方紅葉情報名單明列本園區之銀杏；本次不宣稱已取得2026銀杏現況。',
             'caveat': '銀杏與もみじ谷分開。正確網址使用siba，不是shiba。',
             'access': '已讀取頁面',
             'species': '楓樹、銀杏'},
 'TKG-006': {'name': '城北中央公園',
             'area': '板橋區、練馬區',
             'grade': 'S',
             'operator': '公益財團法人東京都公園協會',
             'role': '園區入口／公告；銀杏觀測資格由2025年度名單證實',
             'url': 'https://www.tokyo-park.or.jp/park/johoku-chuo/',
             'extra_url': '',
             'evidence_url': 'https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf',
             'evidence_date': '2025-11-04',
             'finding': '2025年度官方紅葉情報名單明列本園區之銀杏；本次不宣稱已取得2026銀杏現況。',
             'caveat': '必須按物種取值，不把櫸樹葉況套用銀杏。',
             'access': '已讀取頁面',
             'species': '銀杏、櫸樹'},
 'TKG-007': {'name': '善福寺川緑地',
             'area': '杉並區',
             'grade': 'S',
             'operator': '公益財團法人東京都公園協會',
             'role': '園區入口／公告；銀杏觀測資格由2025年度名單證實',
             'url': 'https://www.tokyo-park.or.jp/park/zempukujigawa-ryokuchi/index.html',
             'extra_url': '',
             'evidence_url': 'https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf',
             'evidence_date': '2025-11-04',
             'finding': '2025年度官方紅葉情報名單明列本園區之銀杏；本次不宣稱已取得2026銀杏現況。',
             'caveat': '2025表與和田堀公園合併一列，不能假設各有獨立觀測。',
             'access': '已讀取頁面',
             'species': '銀杏'},
 'TKG-008': {'name': '和田堀公園',
             'area': '杉並區',
             'grade': 'S',
             'operator': '公益財團法人東京都公園協會',
             'role': '園區入口／公告；銀杏觀測資格由2025年度名單證實',
             'url': 'https://www.tokyo-park.or.jp/park/wadabori/',
             'extra_url': '',
             'evidence_url': 'https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf',
             'evidence_date': '2025-11-04',
             'finding': '2025年度官方紅葉情報名單明列本園區之銀杏；本次不宣稱已取得2026銀杏現況。',
             'caveat': '2025表與善福寺川緑地合併一列，保留共同來源關係。',
             'access': '已讀取頁面',
             'species': '銀杏'},
 'TKG-009': {'name': '戸山公園',
             'area': '新宿區',
             'grade': 'S',
             'operator': '公益財團法人東京都公園協會',
             'role': '園區入口／公告；銀杏觀測資格由2025年度名單證實',
             'url': 'https://www.tokyo-park.or.jp/park/toyama/',
             'extra_url': '',
             'evidence_url': 'https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf',
             'evidence_date': '2025-11-04',
             'finding': '2025年度官方紅葉情報名單明列本園區之銀杏；本次不宣稱已取得2026銀杏現況。',
             'caveat': '須擷取銀杏段落／欄位，不直接使用全園紅葉狀態。',
             'access': '已讀取頁面',
             'species': '楓樹、銀杏'},
 'TKG-010': {'name': '光が丘公園',
             'area': '練馬區、板橋區',
             'grade': 'S',
             'operator': '公益財團法人東京都公園協會',
             'role': '園區入口／公告；銀杏觀測資格由2025年度名單證實',
             'url': 'https://www.tokyo-park.or.jp/park/hikarigaoka/',
             'extra_url': '',
             'evidence_url': 'https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf',
             'evidence_date': '2025-11-04',
             'finding': '2025年度官方紅葉情報名單明列本園區之銀杏；本次不宣稱已取得2026銀杏現況。',
             'caveat': '銀杏並木與ふれあいの径宜設為不同子地點。',
             'access': '已讀取頁面',
             'species': '銀杏'},
 'TKG-011': {'name': '日比谷公園',
             'area': '千代田區',
             'grade': 'S',
             'operator': '公益財團法人東京都公園協會',
             'role': '園區入口／公告；銀杏觀測資格由2025年度名單證實',
             'url': 'https://www.tokyo-park.or.jp/park/hibiya/',
             'extra_url': '',
             'evidence_url': 'https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf',
             'evidence_date': '2025-11-04',
             'finding': '2025年度官方紅葉情報名單明列本園區之銀杏；本次不宣稱已取得2026銀杏現況。',
             'caveat': '葉況與施工、通行公告分開管理。',
             'access': '已讀取頁面',
             'species': '銀杏'},
 'TKG-012': {'name': '代々木公園',
             'area': '澀谷區',
             'grade': 'S',
             'operator': '公益財團法人東京都公園協會',
             'role': '園區入口／公告；銀杏觀測資格由2025年度名單證實',
             'url': 'https://www.tokyo-park.or.jp/park/yoyogi/',
             'extra_url': '',
             'evidence_url': 'https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf',
             'evidence_date': '2025-11-04',
             'finding': '2025年度官方紅葉情報名單明列本園區之銀杏；本次不宣稱已取得2026銀杏現況。',
             'caveat': '黃葉公告須限定原文明示區域，不擴張為全園。',
             'access': '已讀取頁面',
             'species': '銀杏'},
 'TKG-013': {'name': '旧岩崎邸庭園',
             'area': '台東區（入口）',
             'grade': 'S',
             'operator': '公益財團法人東京都公園協會',
             'role': '園區入口／公告；銀杏觀測資格由2025年度名單證實',
             'url': 'https://www.tokyo-park.or.jp/park/kyu-iwasaki-tei/',
             'extra_url': '',
             'evidence_url': 'https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf',
             'evidence_date': '2025-11-04',
             'finding': '2025年度官方紅葉情報名單明列本園區之銀杏；本次不宣稱已取得2026銀杏現況。',
             'caveat': '活動或集章日期不是見頃日；注意官網改版後網址。',
             'access': '已讀取頁面',
             'species': '銀杏'},
 'TKG-014': {'name': '國營昭和記念公園｜花だより',
             'area': '立川市、昭島市',
             'grade': 'A',
             'operator': '國營昭和記念公園官方網站',
             'role': '附日期的植物／黃葉現地快訊',
             'url': 'https://www.showakinen-koen.jp/hanadayori/',
             'extra_url': 'https://www.showakinen-koen.jp/flower-information/',
             'evidence_url': 'https://www.showakinen-koen.jp/hanadayori/page/3/',
             'evidence_date': '2025-10-23至2025-12-04',
             'finding': '歷史列表有連續多期イチョウ情報；植物指南明列イチョウ（黄葉）。',
             'caveat': 'カナール、かたらいのイチョウ並木分開；page/3分頁位置會隨新增文章變動，不可當永久存檔ID。',
             'access': '已讀取頁面',
             'species': '銀杏'},
 'TKG-015': {'name': '新宿御苑｜國民公園協會自然情報',
             'area': '新宿區、澀谷區',
             'grade': 'A',
             'operator': '一般財團法人國民公園協會 新宿御苑',
             'role': 'みどころ／紅葉／植物公告',
             'url': 'https://fng.or.jp/shinjuku/news/',
             'extra_url': 'https://policies.env.go.jp/national-garden/shinjukugyoen/index.html',
             'evidence_url': 'https://fng.or.jp/shinjuku/2025/11/28/20251128_03/',
             'evidence_date': '2025-11-28',
             'finding': '日期文章明確敘述銀杏黃葉見頃，包含溫室附近照片及園內植物地圖。',
             'caveat': '舊文只當歷史樣本。環境省管理資訊與協會自然情報各有用途；不可混入同期其他樹種狀態。',
             'access': '已讀取頁面',
             'species': '銀杏'},
 'TKG-016': {'name': '八王子いちょう祭り｜黄葉情報',
             'area': '八王子市・甲州街道',
             'grade': 'A',
             'operator': '八王子いちょう祭り祭典委員會',
             'role': '沿道路多觀景點、附拍攝日期的黃葉照片',
             'url': 'https://www.ichou-festa.org/ichounews/',
             'extra_url': 'https://www.ichou-festa.org/',
             'evidence_url': 'https://www.ichou-festa.org/notice/post-3629/',
             'evidence_date': '2026-09-24（更新公告）',
             'finding': '黄葉情報頁可見2026-09-22拍攝日期，分中央圖書館、多摩御陵入口及觀看方向。',
             'caveat': '已確認2026季內內容，但不能只看照片日期就自動判定見頃。祭典日期與葉況分離。',
             'access': '已讀取頁面',
             'species': '銀杏'},
 'TKG-017': {'name': '宮內廳｜皇居東御苑 花だより',
             'area': '千代田區・皇居東御苑',
             'grade': 'A',
             'operator': '宮內廳',
             'role': '附日期的園內植物與黃葉記錄',
             'url': 'https://www.kunaicho.go.jp/visit/higashigyoen/hanadayori/index.html',
             'extra_url': 'https://www.kunaicho.go.jp/visit/higashigyoen/index.html',
             'evidence_url': 'https://www.kunaicho.go.jp/visit/higashigyoen/hanadayori/20251128.html',
             'evidence_date': '2025-11-28',
             'finding': '日期文記錄銀杏等樹木變色，照片標示百人番所前のイチョウ。',
             'caveat': '東御苑不是皇居外苑或北之丸公園。全園葉落描述不可自動套用銀杏。',
             'access': '已讀取頁面',
             'species': '銀杏'},
 'TKG-018': {'name': '小石川植物園｜見ごろの植物',
             'area': '文京區',
             'grade': 'A',
             'operator': '東京大學大學院理學系研究科附屬植物園',
             'role': '附日期的物種級植物觀察',
             'url': 'https://koishikawa-bg.jp/kaikainfo/',
             'extra_url': 'https://koishikawa-bg.jp/kaika/',
             'evidence_url': 'https://koishikawa-bg.jp/kaika/5013/',
             'evidence_date': '2025-11-19',
             'finding': '當日文章將イチョウ明列於正在紅葉／黃葉的植物清單。',
             'caveat': '見到黃葉不等於已到見頃。小石川植物園與小石川後樂園是不同地點。',
             'access': '已讀取頁面',
             'species': '銀杏'},
 'TKG-019': {'name': 'あきる野市觀光協會｜のらぼう日記',
             'area': '秋留野市・廣德寺周邊',
             'grade': 'A',
             'operator': 'あきる野市觀光協會',
             'role': '秋川溪谷分地點紅葉巡查，含廣德寺銀杏',
             'url': 'https://www.akirunokanko.com/?cat=53',
             'extra_url': 'https://www.akirunokanko.com/',
             'evidence_url': 'https://www.akirunokanko.com/?p=8712',
             'evidence_date': '2025-11-08（發文）；2025-11-06（拍攝）',
             'finding': '廣德寺段落明寫銀杏變色進展、尚差一些到見頃；原文另給照片拍攝日期。',
             'caveat': '石舟橋段落是楓樹，不能套用到廣德寺銀杏。發文日與拍攝日分開。',
             'access': '已讀取頁面',
             'species': '銀杏'},
 'TKG-020': {'name': '氣象廳｜いちょうの黄葉日',
             'area': '東京觀測站（標本木尺度）',
             'grade': 'O',
             'operator': '日本氣象廳',
             'role': '依統一基準記錄黃葉日',
             'url': 'https://www.data.jma.go.jp/sakura/data/phn_012.html',
             'extra_url': '',
             'evidence_url': 'https://www.data.jma.go.jp/sakura/data/',
             'evidence_date': '最近資料頁2025–2026',
             'finding': '有東京及其他站的銀杏黃葉日期表；官網說明觀測以標本木進行。',
             'caveat': '觀測站日期不能充當每處公園最佳觀賞日；未報告不等於青葉。',
             'access': '已讀取頁面',
             'species': '銀杏'},
 'TKG-021': {'name': '氣象廳｜いちょうの落葉日',
             'area': '東京觀測站（標本木尺度）',
             'grade': 'O',
             'operator': '日本氣象廳',
             'role': '標本木落葉日期',
             'url': 'https://www.data.jma.go.jp/sakura/data/phn_013.html',
             'extra_url': '',
             'evidence_url': 'https://www.data.jma.go.jp/sakura/data/',
             'evidence_date': '最近資料頁2025–2026',
             'finding': '有銀杏落葉日期表，與黃葉日分開。',
             'caveat': '不是全東京銀杏落葉完成日；保留站點和觀測現象定義。',
             'access': '已讀取頁面',
             'species': '銀杏'},
 'TKG-022': {'name': '氣象廳｜生物季節累年值CSV入口',
             'area': '東京及全國站點歷史',
             'grade': 'O',
             'operator': '日本氣象廳',
             'role': '官方歷史資料下載索引',
             'url': 'https://www.data.jma.go.jp/sakura/data/download_ruinenchi.html',
             'extra_url': '',
             'evidence_url': 'https://www.data.jma.go.jp/sakura/data/',
             'evidence_date': '累年表主頁標記2026-03-19',
             'finding': '下載索引提供いちょう黄葉與いちょう落葉CSV連結。',
             'caveat': '已驗證下載入口；本次未成功取得CSV檔位元組，也未驗證CSV欄位。不可宣稱API已測通。',
             'access': '已讀取頁面',
             'species': '銀杏'},
 'TKG-023': {'name': '明治神宮外苑｜いちょう並木',
             'area': '明治神宮外苑・銀杏並木',
             'grade': 'C',
             'operator': '明治神宮外苑',
             'role': '第一方景點及四季介紹；監看公告的入口',
             'url': 'https://www.meijijingugaien.jp/walk/sight/season.html',
             'extra_url': 'https://www.meijijingugaien.jp/news/',
             'evidence_url': 'https://www.meijijingugaien.jp/walk/sight/season.html',
             'evidence_date': '未見可當現況的日期',
             'finding': '官網明確介紹銀杏並木與四季景觀；本次未確認穩定的逐日銀杏葉況專頁。',
             'caveat': '不是明治神宮內苑。頁內老樹齡／株數含歷史基準，勿當2026現況。',
             'access': '已讀取頁面',
             'species': '銀杏'},
 'TKG-024': {'name': '大田黑公園｜荻窪三庭園',
             'area': '杉並區',
             'grade': 'B',
             'operator': '杉並區官方指向之公園網站（荻窪三庭園）',
             'role': '現行官方入口，待人工／瀏覽器核對季內葉況',
             'url': 'https://ogikubo3gardens.jp/ootaguro/',
             'extra_url': 'https://ogikubo3gardens.jp/',
             'evidence_url': 'https://www.city.suginami.tokyo.jp/s100/shisetsu/14632.html',
             'evidence_date': '區公所頁更新2025-09-09',
             'finding': '杉並區官網證明銀杏並木及現行官方網址；本次自動讀取公園頁未取得正文。',
             'caveat': '不得沿用已於2024年3月結束管理的箱根植木舊頁作現任營運來源。',
             'access': '官方身分已確認；公園頁正文讀取不足',
             'species': '銀杏'},
 'TKG-025': {'name': '大國魂神社｜大銀杏／公告',
             'area': '府中市',
             'grade': 'C',
             'operator': '大國魂神社',
             'role': '第一方大銀杏地點資訊及公告入口',
             'url': 'https://www.ookunitamajinja.or.jp/mame/',
             'extra_url': 'https://www.ookunitamajinja.or.jp/',
             'evidence_url': 'https://www.ookunitamajinja.or.jp/mame/',
             'evidence_date': '靜態資料',
             'finding': '神社官網確認本殿後方的大銀杏；未確認定期黃葉觀測文章。',
             'caveat': '不要把附近馬場大門的櫸樹並木視為銀杏。',
             'access': '已讀取頁面',
             'species': '銀杏'},
 'TKG-026': {'name': '靖國神社｜官方公告、境內照片',
             'area': '千代田區',
             'grade': 'C',
             'operator': '靖國神社',
             'role': '公告與影像入口；銀杏日期觀測仍待核對',
             'url': 'https://www.yasukuni.or.jp/',
             'extra_url': 'https://www.yasukuni.or.jp/schedule/photo.html',
             'evidence_url': 'https://www.yasukuni.or.jp/schedule/photo.html',
             'evidence_date': '本次可讀2026公告',
             'finding': '官網和照片入口存在；本次未核得可直接當銀杏現況的日期觀測文章。',
             'caveat': '宣傳影片上線日不等於拍攝日。不可將未核視角的LIVE影片宣稱銀杏即時鏡頭。',
             'access': '已讀取頁面',
             'species': '銀杏專項現況待確認'},
 'TKG-027': {'name': 'GO TOKYO｜秋季紅葉指南',
             'area': '東京都全域',
             'grade': 'C',
             'operator': '東京官方旅遊網站 GO TOKYO',
             'role': '景點發現、地址與官方外連',
             'url': 'https://www.gotokyo.org/jp/story/guide/autumn-leaves-forecast/index.html',
             'extra_url': '',
             'evidence_url': 'https://www.gotokyo.org/jp/story/guide/autumn-leaves-forecast/index.html',
             'evidence_date': '2026-09-01',
             'finding': '指南明確介紹明治神宮外苑銀杏等秋季地點。',
             'caveat': '網址含forecast不等於有當日銀杏觀測；文章更新日不能代表照片日期。',
             'access': '已讀取頁面',
             'species': '銀杏'},
 'TKG-028': {'name': '千代田區觀光協會｜景點／專題',
             'area': '千代田區',
             'grade': 'C',
             'operator': '千代田區觀光協會',
             'role': '區域景點及來源發現入口',
             'url': 'https://visit-chiyoda.tokyo/app/spot',
             'extra_url': 'https://visit-chiyoda.tokyo/app/feature',
             'evidence_url': 'https://visit-chiyoda.tokyo/app/spot',
             'evidence_date': '本次讀取2026-09-29',
             'finding': '景點列表有紅葉名所分類；可用來查區內候選地點。',
             'caveat': '尚未證實它對行幸通り等逐點提供定期銀杏觀測。',
             'access': '已讀取頁面',
             'species': '紅葉混合分類'},
 'TKG-029': {'name': '新宿觀光振興協會｜官方入口',
             'area': '新宿區',
             'grade': 'C',
             'operator': '新宿觀光振興協會',
             'role': '景點、活動與公告發現',
             'url': 'https://www.kanko-shinjuku.jp/',
             'extra_url': '',
             'evidence_url': 'https://www.kanko-shinjuku.jp/',
             'evidence_date': '本次讀取2026-09-29',
             'finding': '官方觀光入口可讀；銀杏日期快訊本次未確認。',
             'caveat': '不能取代新宿御苑管理相關單位的實際植物報告。',
             'access': '已讀取頁面',
             'species': '銀杏專項現況待確認'},
 'TKG-030': {'name': '皇居外苑・北之丸公園｜國民公園協會',
             'area': '千代田區',
             'grade': 'B',
             'operator': '一般財團法人國民公園協會 皇居外苑',
             'role': '四季景觀、植物公告入口',
             'url': 'https://fng.or.jp/koukyo/news/',
             'extra_url': '',
             'evidence_url': 'https://fng.or.jp/koukyo/',
             'evidence_date': '本次可見2026-09-19季節文章入口',
             'finding': '有持續更新的自然／四季消息；本次未核得銀杏專项葉況。',
             'caveat': '與宮內廳東御苑不同來源、不同地理範圍。',
             'access': '已讀取頁面',
             'species': '銀杏專項現況待確認'},
 'TKG-031': {'name': '神代植物公園｜園區植物公告',
             'area': '調布市',
             'grade': 'B',
             'operator': '公益財團法人東京都公園協會',
             'role': '多物種植物公告入口',
             'url': 'https://www.tokyo-park.or.jp/park/jindai/',
             'extra_url': '',
             'evidence_url': 'https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf',
             'evidence_date': '2025-11-04',
             'finding': '有植物園官方入口；中央紅葉名單對本園記錄的是モミジ。',
             'caveat': '不可把中央名單的楓樹狀態當作銀杏。',
             'access': '已讀取頁面',
             'species': '2025中央項目是楓樹'},
 'TKG-032': {'name': '府中市鄉土之森博物館｜花ごよみ',
             'area': '府中市',
             'grade': 'B',
             'operator': '府中市鄉土之森博物館官方營運網站',
             'role': '園內花曆／植物動態',
             'url': 'https://www.fuchu-cpf.or.jp/museum/hanagoyomi/index.html',
             'extra_url': 'https://www.fuchu-cpf.or.jp/museum/',
             'evidence_url': 'https://www.fuchu-cpf.or.jp/museum/hanagoyomi/index.html',
             'evidence_date': '2026-09-28',
             'finding': '植物狀況頁持續更新，但本次所讀內容不足以證實銀杏專項發布。',
             'caveat': '不要把彼岸花／萩等花況轉成銀杏；照片需獨立核日期。',
             'access': '已讀取頁面',
             'species': '銀杏物種／現況均待補證'},
 'TKG-033': {'name': 'tenki.jp｜東京都紅葉情報',
             'area': '東京都多景點',
             'grade': 'T',
             'operator': 'tenki.jp（非景點管理機關）',
             'role': '第三方整合葉況／五階段狀態',
             'url': 'https://tenki.jp/kouyou/3/16/',
             'extra_url': 'https://tenki.jp/kouyou/3/16/30688.html',
             'evidence_url': 'https://tenki.jp/kouyou/3/16/',
             'evidence_date': '2026-09-29',
             'finding': '東京都列表顯示2026季資訊；來源說明每日綜合各景點回報。含明治外苑、大田黑、廣德寺等。',
             'caveat': '多樹種混合；示意照片不等於當日照片。38個東京都紅葉點不等於38個銀杏點。',
             'access': '已讀取頁面',
             'species': '銀杏與其他紅葉物種混合'},
 'TKG-034': {'name': 'Weathernews｜東京都紅葉情報',
             'area': '東京都多景點',
             'grade': 'T',
             'operator': 'Weathernews（民間氣象平台）',
             'role': '第三方紅葉平台',
             'url': 'https://weathernews.jp/koyo/area/tokyo/',
             'extra_url': '',
             'evidence_url': 'https://weathernews.jp/koyo/area/tokyo/',
             'evidence_date': '2026版頁面',
             'finding': '確認2026東京專頁存在；本次解析結果不足以核對所有景點及銀杏專屬欄位。',
             'caveat': '勿宣稱其所有預報／回報均為官方實測。動態渲染內容需另做實測。',
             'access': '頁面可開啟；細項自動解析不足',
             'species': '多物種紅葉'},
 'TKG-035': {'name': 'WalkerPlus｜東京 黃色に色づく',
             'area': '東京都多景點',
             'grade': 'T',
             'operator': 'KADOKAWA／WalkerPlus',
             'role': '第三方景點目錄及色づき狀態',
             'url': 'https://koyo.walkerplus.com/yellow/ar0313/',
             'extra_url': 'https://koyo.walkerplus.com/list/ar0313/',
             'evidence_url': 'https://koyo.walkerplus.com/detail/ar0313e154517/',
             'evidence_date': '2026-09-28（芝公園狀態）',
             'finding': '黃色分類列56項（含其他黃葉樹種）；芝公園頁色づき來源標示JRシステム。',
             'caveat': '56項不是56處銀杏確證；2026葉況旁可並列2025活动。圖片二次使用受限。',
             'access': '已讀取頁面',
             'species': '銀杏等黃色樹種；混合'},
 'TKG-036': {'name': 'Jorudan｜東京都 紅葉情報',
             'area': '東京都多景點',
             'grade': 'T',
             'operator': 'ジョルダン（民間平台）',
             'role': '第三方景點、見頃與交通資訊',
             'url': 'https://sp.jorudan.co.jp/leaf/tokyo.html',
             'extra_url': '',
             'evidence_url': 'https://sp.jorudan.co.jp/leaf/spot_J0193.html',
             'evidence_date': '2026版列表',
             'finding': '東京紅葉列表及國立大學通り等景點入口，可作地點查漏。',
             'caveat': '歷年通常見頃不等於今年現況；不要假設所有點均有當日觀測。',
             'access': '已讀取頁面',
             'species': '紅葉混合'},
 'TKG-037': {'name': '日本氣象株式會社｜紅葉・黃葉見頃預想',
             'area': '東京城市尺度及其他地點',
             'grade': 'T',
             'operator': '日本氣象株式會社（不是氣象廳）',
             'role': '預報產品／黃葉模型結果',
             'url': 'https://n-kishou.com/corp/news-contents/autumn/',
             'extra_url': '',
             'evidence_url': 'https://n-kishou.com/corp/news-contents/autumn/',
             'evidence_date': '2026-09-02（第一回）',
             'finding': '2026第一回預報明確區分銀杏黃葉與楓樹紅葉。',
             'caveat': '必須標forecast，保留發布日、預測對象和尺度；不得覆寫公園實際觀測。',
             'access': '已讀取頁面',
             'species': '黃葉=銀杏；紅葉主要=楓樹'},
 'TKG-038': {'name': '東京都公園協會｜2025紅葉季舊專頁',
             'area': '東京都內',
             'grade': 'X',
             'operator': '公益財團法人東京都公園協會',
             'role': '歷史入口／網址失效監測',
             'url': 'https://www.tokyo-park.or.jp/special/kouyou/index.html',
             'extra_url': '',
             'evidence_url': 'https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf',
             'evidence_date': '2025-11-04（公告中的連結）',
             'finding': '2025公告指向此頁；本次查核回傳404。',
             'caveat': '此列保留作失效紀錄，不計入可立即使用的現況來源。',
             'access': '本次回傳404',
             'species': '銀杏'},
 'TKG-039': {'name': '箱根植木｜大田黑公園舊管理案例',
             'area': '杉並區',
             'grade': 'X',
             'operator': '箱根植木（舊管理公司）',
             'role': '歷史管理身分核對／排除來源',
             'url': 'https://hakone-ueki.com/casestudy/case1/',
             'extra_url': '',
             'evidence_url': 'https://hakone-ueki.com/',
             'evidence_date': '管理期2011-04至2024-03',
             'finding': '公司首頁明寫大田黑公園管理已於2024年3月結束。',
             'caveat': '只保留遷移／排除理由；現行入口由杉並區官方指向荻窪三庭園。',
             'access': '已讀取頁面',
             'species': '不適用'},
 'TKG-040': {'name': '東京大學｜本鄉・駒場校區官方入口',
             'area': '文京區、目黑區',
             'grade': 'C',
             'operator': '東京大學',
             'role': '校區地圖、參觀規則及公告發現',
             'url': 'https://www.u-tokyo.ac.jp/ja/about/campus-guide/index.html',
             'extra_url': '',
             'evidence_url': 'https://www.u-tokyo.ac.jp/ja/about/campus-guide/index.html',
             'evidence_date': '2026-04-01（地圖頁）',
             'finding': '確認本鄉及駒場的官方地圖／參觀入口；尚未確認穩定的銀杏日期觀測來源。',
             'caveat': '本鄉、駒場、小石川植物園是不同地點。此頁未證實各校區的當季銀杏觀測。',
             'access': '已讀取頁面',
             'species': '銀杏專項現況待確認'},
 'TKG-041': {'name': 'くにたちNAVI｜國立市觀光まちづくり協會',
             'area': '國立市・大學通り候選',
             'grade': 'C',
             'operator': 'NPO法人國立市觀光まちづくり協會',
             'role': '地方觀光／活動入口，供來源拓展',
             'url': 'https://kunimachi.jp/',
             'extra_url': 'https://sp.jorudan.co.jp/leaf/spot_J0193.html',
             'evidence_url': 'https://kunimachi.jp/',
             'evidence_date': '本次可見2026-09-25更新',
             'finding': '頁尾確認營運者為國立市觀光まちづくり協會；本次未確認定期銀杏葉況文章。',
             'caveat': '區域旅遊更新不等於大學通り銀杏現況；可與Jorudan地點目錄交叉尋源。',
             'access': '已讀取頁面',
             'species': '銀杏專項現況待確認'}}

GEO = {'tkg-002': {'sid': 'TKG-002',
             'lat': 35.713,
             'lng': 139.7724,
             'label': '公園中心（概略）',
             'confidence': 'low',
             'maxdist': 175,
             'refs': ['https://www.openstreetmap.org/relation/5413419',
                      'https://ja.wikipedia.org/wiki/上野恩賜公園',
                      'https://weathernews.jp/s/koyo/spot/24412/']},
 'tkg-003': {'sid': 'TKG-003',
             'lat': 35.6752,
             'lng': 139.8085,
             'label': '公園中心（概略）',
             'confidence': 'low',
             'maxdist': 200,
             'refs': ['https://www.openstreetmap.org/relation/14273608',
                      'https://www.openstreetmap.org/way/845051284',
                      'https://ja.wikipedia.org/wiki/木場公園']},
 'tkg-004': {'sid': 'TKG-004',
             'lat': 35.7155,
             'lng': 139.5189,
             'label': '公園中心（概略）',
             'confidence': 'low',
             'maxdist': 130,
             'refs': ['https://www.openstreetmap.org/way/591077391',
                      'https://ja.wikipedia.org/wiki/小金井公園',
                      'https://weathernews.jp/s/koyo/spot/24403/',
                      'https://sp.jorudan.co.jp/leaf/spot_J0039.html']},
 'tkg-005': {'sid': 'TKG-005',
             'lat': 35.6555,
             'lng': 139.748,
             'label': '公園中心（概略；銀杏位置未核實）',
             'confidence': 'low',
             'maxdist': 332,
             'refs': ['https://www.openstreetmap.org/way/745301114',
                      'https://www.openstreetmap.org/relation/18180831',
                      'https://ja.wikipedia.org/wiki/芝公園',
                      'https://weathernews.jp/s/koyo/spot/24414/']},
 'tkg-006': {'sid': 'TKG-006',
             'lat': 35.7564,
             'lng': 139.673,
             'label': '公園中心（概略）',
             'confidence': 'low',
             'maxdist': 104,
             'refs': ['https://www.openstreetmap.org/relation/17981647',
                      'https://ja.wikipedia.org/wiki/城北中央公園',
                      'https://weathernews.jp/s/koyo/spot/24482/',
                      'https://sp.jorudan.co.jp/leaf/spot_J0226.html']},
 'tkg-007': {'sid': 'TKG-007',
             'lat': 35.692,
             'lng': 139.6305,
             'label': '公園中心（概略；沿河線狀公園）',
             'confidence': 'low',
             'maxdist': 226,
             'refs': ['https://www.openstreetmap.org/relation/17376005', 'https://weathernews.jp/s/koyo/spot/24444/']},
 'tkg-008': {'sid': 'TKG-008',
             'lat': 35.6855,
             'lng': 139.6395,
             'label': '公園中心（概略）',
             'confidence': 'low',
             'maxdist': 196,
             'refs': ['https://www.openstreetmap.org/relation/3974046',
                      'https://www.openstreetmap.org/way/40294887',
                      'https://www.openstreetmap.org/way/577458755']},
 'tkg-009': {'sid': 'TKG-009',
             'lat': 35.7037,
             'lng': 139.7135,
             'label': '戸山（箱根山）地区（概略）',
             'confidence': 'low',
             'maxdist': 14,
             'refs': ['https://www.openstreetmap.org/way/209465552',
                      'https://ja.wikipedia.org/wiki/箱根山_(新宿区)',
                      'https://weathernews.jp/s/koyo/spot/24462/']},
 'tkg-010': {'sid': 'TKG-010',
             'lat': 35.7648,
             'lng': 139.6295,
             'label': '観賞池與売店之間（概略）',
             'confidence': 'medium',
             'maxdist': 21,
             'refs': ['https://www.openstreetmap.org/way/57018838',
                      'https://www.openstreetmap.org/way/57404792',
                      'https://www.tokyo-park.or.jp/park/hikarigaoka/']},
 'tkg-011': {'sid': 'TKG-011',
             'lat': 35.6737,
             'lng': 139.7559,
             'label': '首賭けイチョウ（松本楼付近・概略）',
             'confidence': 'medium',
             'maxdist': 21,
             'refs': ['https://www.openstreetmap.org/node/5500138998',
                      'https://www.openstreetmap.org/node/469818509',
                      'https://www.tokyo-park.or.jp/park/hibiya/']},
 'tkg-012': {'sid': 'TKG-012',
             'lat': 35.6717,
             'lng': 139.6965,
             'label': '公園中心（概略）',
             'confidence': 'low',
             'maxdist': 122,
             'refs': ['https://www.openstreetmap.org/relation/19862716',
                      'https://ja.wikipedia.org/wiki/代々木公園',
                      'https://weathernews.jp/s/koyo/spot/24409/']},
 'tkg-013': {'sid': 'TKG-013',
             'lat': 35.7092,
             'lng': 139.7683,
             'label': '庭園正門（入口）',
             'confidence': 'high',
             'maxdist': 24,
             'refs': ['https://www.openstreetmap.org/node/4653514711', 'https://weathernews.jp/s/koyo/spot/24457/']},
 'tkg-014': {'sid': 'TKG-014',
             'lat': 35.7028,
             'lng': 139.4022,
             'label': 'カナール（銀杏並木沿水路）',
             'confidence': 'high',
             'maxdist': 36,
             'refs': ['https://www.openstreetmap.org/way/1455348813',
                      'https://www.openstreetmap.org/way/1455348814',
                      'https://www.openstreetmap.org/way/766598267',
                      'https://www.showakinen-koen.jp/facility/facility-305/']},
 'tkg-015': {'sid': 'TKG-015',
             'lat': 35.6867,
             'lng': 139.7126,
             'label': '大温室（銀杏拍攝熱點）',
             'confidence': 'medium',
             'maxdist': 49,
             'refs': ['https://www.openstreetmap.org/way/228926578',
                      'https://www.openstreetmap.org/node/2375692281',
                      'https://fng.or.jp/shinjuku/2025/11/28/20251128_03/']},
 'tkg-016': {'sid': 'TKG-016',
             'lat': 35.652,
             'lng': 139.3004,
             'label': '並木代表點（全長約4 km的中段）',
             'confidence': 'high',
             'maxdist': 64,
             'refs': ['https://weathernews.jp/s/koyo/spot/24433/', 'https://www.ichou-festa.org/ichounews/']},
 'tkg-017': {'sid': 'TKG-017',
             'lat': 35.6857,
             'lng': 139.7581,
             'label': '百人番所（前のイチョウ）',
             'confidence': 'medium',
             'maxdist': 34,
             'refs': ['https://www.openstreetmap.org/way/176109786',
                      'https://www.openstreetmap.org/node/5833843701',
                      'https://www.openstreetmap.org/node/5247182004',
                      'https://www.kunaicho.go.jp/visit/higashigyoen/hanadayori/20251128.html']},
 'tkg-018': {'sid': 'TKG-018',
             'lat': 35.7202,
             'lng': 139.7452,
             'label': '精子発見のイチョウ（補充副點）',
             'confidence': 'medium',
             'maxdist': 0,
             'refs': ['https://www.openstreetmap.org/node/4683343152', 'https://koishikawa-bg.jp/kaika/5013/']},
 'tkg-019': {'sid': 'TKG-019',
             'lat': 35.7218,
             'lng': 139.2174,
             'label': '廣徳寺寺院位置',
             'confidence': 'high',
             'maxdist': 11,
             'refs': ['https://www.openstreetmap.org/way/232257234', 'https://ja.wikipedia.org/wiki/広徳寺']},
 'tkg-023': {'sid': 'TKG-023',
             'lat': 35.6739,
             'lng': 139.7199,
             'label': '並木中點',
             'confidence': 'high',
             'maxdist': 69,
             'refs': ['https://www.openstreetmap.org/way/499552710',
                      'https://weathernews.jp/s/koyo/spot/24408/',
                      'https://sp.jorudan.co.jp/leaf/spot_55006.html']},
 'tkg-024': {'sid': 'TKG-024',
             'lat': 35.7007,
             'lng': 139.6248,
             'label': '公園位置',
             'confidence': 'high',
             'maxdist': 24,
             'refs': ['https://www.openstreetmap.org/way/100013319',
                      'https://ja.wikipedia.org/wiki/大田黒公園',
                      'https://weathernews.jp/s/koyo/spot/24458/']},
 'tkg-025': {'sid': 'TKG-025',
             'lat': 35.6676,
             'lng': 139.479,
             'label': '本殿・拝殿一帯（大銀杏在本殿の裏）',
             'confidence': 'high',
             'maxdist': 22,
             'refs': ['https://www.openstreetmap.org/way/172007556',
                      'https://ja.wikipedia.org/wiki/大國魂神社',
                      'https://www.openstreetmap.org/way/443035348',
                      'https://www.ookunitamajinja.or.jp/mame/']},
 'tkg-026': {'sid': 'TKG-026',
             'lat': 35.6941,
             'lng': 139.7431,
             'label': '境內主要區域（拝殿）',
             'confidence': 'high',
             'maxdist': 46,
             'refs': ['https://www.openstreetmap.org/way/144379616',
                      'https://www.openstreetmap.org/way/144379617',
                      'https://ja.wikipedia.org/wiki/靖国神社',
                      'https://sp.jorudan.co.jp/leaf/spot_J0200.html',
                      'https://www.openstreetmap.org/relation/21067209']},
 'tkg-030-kitanomaru': {'sid': 'TKG-030',
                        'lat': 35.6915,
                        'lng': 139.7511,
                        'label': '公園中心（概略）',
                        'confidence': 'low',
                        'maxdist': 130,
                        'refs': ['https://www.openstreetmap.org/relation/3551876',
                                 'https://www.openstreetmap.org/way/624081603',
                                 'https://ja.wikipedia.org/wiki/北の丸公園',
                                 'https://weathernews.jp/s/koyo/spot/24452/']},
 'tkg-040-hongo': {'sid': 'TKG-040',
                   'lat': 35.7131,
                   'lng': 139.7606,
                   'label': '並木中點',
                   'confidence': 'high',
                   'maxdist': 146,
                   'refs': ['https://www.openstreetmap.org/way/33050411',
                            'https://www.openstreetmap.org/way/643102413',
                            'https://ja.wikipedia.org/wiki/東京大学']},
 'tkg-040-komaba': {'sid': 'TKG-040',
                    'lat': 35.6604,
                    'lng': 139.6852,
                    'label': '並木中段（概略）',
                    'confidence': 'medium',
                    'maxdist': 102,
                    'refs': ['https://www.openstreetmap.org/way/695889364',
                             'https://www.openstreetmap.org/node/2332994271',
                             'https://ja.wikipedia.org/wiki/東京大学駒場地区キャンパス',
                             'https://www.u-tokyo.ac.jp/focus/ja/features/z1304_00053.html']},
 'tkg-041': {'sid': 'TKG-041',
             'lat': 35.6945,
             'lng': 139.4468,
             'label': '国立駅南側の並木（代表點）',
             'confidence': 'medium',
             'maxdist': 501,
             'refs': ['https://sp.jorudan.co.jp/leaf/spot_J0193.html',
                      'https://www.openstreetmap.org/way/1158057700',
                      'https://ja.wikipedia.org/wiki/国立駅']}}

# Record kinds:  status = this year's leaf report | notice = 2026 notice, not about leaves | past = dated past-season record
#                static = official introduction without a date | event = event dates, never 見頃 dates | proof = evidence that ginkgo exists here
PLACE_TEXT = {
    "tkg-002": dict(
        ja="上野恩賜公園", zh=None, area="台東區", kind="park",
        intro="位在上野之山（台地）與不忍池一帶的都立公園，周邊聚集博物館、美術館和動物園，是東京最具代表性的公園之一。",
        ginkgo="公園協會的園頁沒有任何銀杏或紅葉的文字，園內銀杏的位置官方頁面也沒有記載。本園列為銀杏地點的依據，是公園協會 2025 年度紅葉情報名單把本園的樹種列為銀杏。東京都建設局的上野公園頁面把銀杏列為主要植物，並寫「11 月下旬到 12 月中旬是紅葉的見頃」，但頁面更新日是 2023-03-04，屬於例年的大致時期，不是今年的現況。",
        status="2026-10-02 查核公園協會園頁：沒有任何銀杏或紅葉的文字，尚未發布本年度銀杏現況。",
        status_url="https://www.tokyo-park.or.jp/park/ueno/",
        records=[
            ("2025-11-04", "proof", "公園協會 2025 年度紅葉情報名單明列本園的樹種為銀杏（只證明這裡有銀杏，不是葉況）。", "https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf"),
            ("2023-03-04", "static", "東京都建設局頁面（更新日 2023-03-04）：晚秋變成金黃色，11 月下旬到 12 月中旬為紅葉見頃。這是例年的大致時期，不是今年的現況。", "https://www.kensetsu.metro.tokyo.lg.jp/jimusho/toubuk/ueno/midokoro/shizen"),
        ],
        caution="園區很大，官方沒有指出銀杏在園內哪個位置，地圖上的點只是公園的代表位置。",
        visit=dict(
            address="東京都台東區上野公園・池之端三丁目",
            access="JR 各線、東京 Metro 銀座線與日比谷線「上野」站步行約 2 分鐘；京成本線「京成上野」站步行約 1 分鐘（公園協會園頁）。",
            hours="公園協會園頁寫「常時開園」；東京都建設局頁面寫「上午 5 時至晚上 11 時（時間外禁止進入）」。兩者不一致，待確認。",
            closed="無（常時開園）。服務中心與各設施在年末年始休業。",
            fee="免費（部分設施收費）。",
        ),
        sources=[
            ("東京都公園協會｜上野恩賜公園", "https://www.tokyo-park.or.jp/park/ueno/", "園區簡介、交通、開放時間"),
            ("東京都建設局｜上野恩賜公園（公園案內、主要植物）", "https://www.kensetsu.metro.tokyo.lg.jp/jimusho/toubuk/ueno/midokoro/shizen", "銀杏的例年時期說明、開放時間的另一種記載"),
        ],
    ),
    "tkg-003": dict(
        ja="木場公園", zh=None, area="江東區", kind="park",
        intro="承襲江戶以來木材之町的歷史、以水與綠為主題整備的森林公園，南、中、北三個地區由木場公園大橋連接。",
        ginkgo="公園協會的園頁（公園介紹、主要植物、花的見頃資訊）都找不到銀杏的記載，秋季見頃列的是桂花、三角楓等其他樹種。本園列為銀杏地點，只因公園協會 2025 年度紅葉情報名單把本園的樹種列為銀杏，所以園內銀杏的位置不明。",
        status="2026-10-02 查核公園協會園頁：沒有銀杏文字；最新消息（2026-09-28）與葉況無關。",
        status_url="https://www.tokyo-park.or.jp/park/kiba/",
        records=[
            ("2025-11-04", "proof", "公園協會 2025 年度紅葉情報名單明列本園的樹種為銀杏（只證明樹種，不是葉況）。", "https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf"),
            ("2026-09-28", "notice", "園頁公告：「木場ミドリアム」因工程閉館（與銀杏無關）。", "https://www.tokyo-park.or.jp/park/kiba/"),
        ],
        caution="園頁沒有提到銀杏，請把這裡當作「名單上的候選地點」，不要預期一定有明顯的銀杏景觀。",
        visit=dict(
            address="東京都江東區木場四・五丁目、平野四丁目、三好四丁目、東陽六丁目",
            access="東京 Metro 東西線「木場」站步行約 10 分鐘；都營巴士「木場駅前」下車步行約 5 分鐘（公園協會園頁）。",
            hours="常時開園。",
            closed="無（常時開園）。服務中心與各設施在年末年始休業。",
            fee="免費（部分設施收費）。",
        ),
        sources=[
            ("東京都公園協會｜木場公園", "https://www.tokyo-park.or.jp/park/kiba/", "園區簡介、交通、開放時間"),
        ],
    ),
    "tkg-004": dict(
        ja="小金井公園", zh=None, area="小金井市等", kind="park",
        intro="沿著玉川上水、面積約 80 公頃的大型都立公園，有寬廣的草地、雜木林、櫻花園和江戶東京たてもの園。",
        ginkgo="公園協會園頁的「花的見頃資訊（秋）」列有銀杏，但沒寫在園內的哪裡；「名木、大木」項目寫的是桂花、鵝掌楸和尤加利。公園協會 2025 年度紅葉情報名單把本園的樹種列為銀杏。",
        status="2026-10-02 查核公園協會園頁：沒有 2026 年的葉況消息，最新消息是活動公告（例如波斯菊祭）。",
        status_url="https://www.tokyo-park.or.jp/park/koganei/",
        records=[
            ("2025-11-04", "proof", "公園協會 2025 年度紅葉情報名單明列本園的樹種為銀杏。", "https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf"),
            ("", "static", "園頁「花的見頃資訊（秋）」列有銀杏，沒有日期，也沒有地點。", "https://www.tokyo-park.or.jp/park/koganei/"),
        ],
        caution="公園橫跨小金井市、小平市、西東京市、武藏野市，服務中心的地址不代表所有銀杏所在位置。",
        visit=dict(
            address="東京都小金井市桜町三丁目、關野町一・二丁目（園區另跨小平市、西東京市、武藏野市）",
            access="JR 中央線「武蔵小金井」站轉西武巴士至「小金井公園西口」；園頁只列巴士站，沒有步行分鐘數。",
            hours="常時開園（服務中心 8:30–17:30）。",
            closed="無（常時開園）。服務中心與各設施在年末年始休業。",
            fee="免費（部分設施收費）。",
        ),
        sources=[
            ("東京都公園協會｜小金井公園", "https://www.tokyo-park.or.jp/park/koganei/", "園區簡介、交通、開放時間、秋季見頃的樹種列表"),
        ],
    ),
    "tkg-005": dict(
        ja="芝公園", zh=None, area="港區", kind="park",
        intro="明治 6 年（1873）成為日本最早指定的五處公園之一，原是增上寺的境內，公園呈環狀分布。",
        ginkgo="園頁寫「歷史悠久的公園裡，樟樹、櫸樹、銀杏等大樹零星分布」，沒有指出位置。園內的「もみじ谷」是楓樹的區塊，與銀杏無關，所以本站不把它標在地圖上。公園協會 2025 年度名單的樹種是モミジ與イチョウ。",
        status="2026-10-02 查核公園協會園頁：沒有 2026 年的葉況消息（最新是 2026-09-03 的攝影散步消息）。",
        status_url="https://www.tokyo-park.or.jp/park/siba/",
        records=[
            ("2025-11-04", "proof", "公園協會 2025 年度紅葉情報名單的樹種為モミジ・イチョウ（楓與銀杏分開記載）。", "https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf"),
        ],
        caution="銀杏與「もみじ谷」（楓樹）是不同的東西。正確的園頁網址是 siba，不是 shiba。",
        visit=dict(
            address="東京都港區芝公園一・二・三・四丁目",
            access="都營三田線「芝公園」或「御成門」站步行約 2 分鐘；JR「浜松町」站步行約 12 分鐘（公園協會園頁）。園內沒有停車場。",
            hours="常時開園。",
            closed="無（常時開園）。服務中心與各設施在年末年始休業。",
            fee="免費（部分設施收費）。",
        ),
        sources=[
            ("東京都公園協會｜芝公園", "https://www.tokyo-park.or.jp/park/siba/", "園區簡介、交通、主要植物"),
        ],
    ),
    "tkg-006": dict(
        ja="城北中央公園", zh=None, area="板橋區、練馬區", kind="park",
        intro="位在石神井川沿岸、地形有起伏的運動公園，設有棒球場和競技場，是 23 區北部最大級的公園之一。",
        ginkgo="園頁「園內的樹木」寫著「秋天銀杏並木會漂亮地變色」，照片庫也有標為「イチョウ並木_正門」的照片（2018 年拍攝），但並木的確切位置園頁沒有記載。公園協會 2025 年度名單的樹種是銀杏與櫸樹，所以必須分樹種判讀，不能把櫸樹的葉況當成銀杏。",
        status="2026-10-02 查核公園協會園頁：沒有 2026 年的葉況消息（最新是 2026-09-01 的消息）。",
        status_url="https://www.tokyo-park.or.jp/park/johoku-chuo/",
        records=[
            ("2025-11-04", "proof", "公園協會 2025 年度紅葉情報名單的樹種為イチョウ・ケヤキ。", "https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf"),
            ("2018", "static", "園頁照片庫的拍攝地點標示「イチョウ並木_正門」（2018 年拍攝，單張照片不代表今年）。", "https://www.tokyo-park.or.jp/park/johoku-chuo/"),
        ],
        caution="園內銀杏與櫸樹的葉況不同，請分開看。",
        visit=dict(
            address="東京都板橋區櫻川一丁目、小茂根五丁目；練馬區氷川台一丁目、羽澤三丁目",
            access="東武東上線「上板橋」站步行約 15 分鐘；東京 Metro 副都心線與有樂町線「氷川台」站步行約 20 分鐘（公園協會園頁）。停車場收費、車位少。",
            hours="常時開園。",
            closed="無（常時開園）。服務中心與各設施在年末年始休業。",
            fee="免費（部分設施收費）。",
        ),
        sources=[
            ("東京都公園協會｜城北中央公園", "https://www.tokyo-park.or.jp/park/johoku-chuo/", "園區簡介、交通、園內樹木"),
        ],
    ),
    "tkg-007": dict(
        ja="善福寺川緑地", zh="善福寺川綠地", area="杉並區", kind="park",
        intro="沿善福寺川與和田堀公園相連的帶狀綠地，樹林與兒童廣場交錯，適合春天賞櫻與秋天散步。",
        ginkgo="園頁寫「秋天櫸樹、銀杏、三角楓、櫻花等會鮮豔地變色」，這是對整個園區的敘述，沒有指出特定位置。公園協會 2025 年度名單把本園和和田堀公園合併成一列（樹種：銀杏），所以不能假設兩處各有獨立的觀測。",
        status="2026-10-02 查核公園協會園頁：沒有 2026 年的葉況消息（最新是 2026-07-10 的消息）。",
        status_url="https://www.tokyo-park.or.jp/park/zempukujigawa-ryokuchi/index.html",
        records=[
            ("2025-11-04", "proof", "公園協會 2025 年度紅葉情報名單把善福寺川緑地與和田堀公園合為一列（樹種：イチョウ）。", "https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf"),
        ],
        caution="2025 年度名單與和田堀公園合併為一列，兩處不能各自宣稱有獨立觀測。",
        visit=dict(
            address="東京都杉並區成田東二・三・四丁目、成田西一・三・四丁目、荻窪一丁目",
            access="京王井の頭線「西永福」或「浜田山」站步行約 15 分鐘（公園協會園頁）。",
            hours="常時開園。",
            closed="無（常時開園）。服務中心在年末年始休業。",
            fee="免費（部分設施收費）。",
        ),
        sources=[
            ("東京都公園協會｜善福寺川緑地", "https://www.tokyo-park.or.jp/park/zempukujigawa-ryokuchi/index.html", "園區簡介、交通、園內樹木"),
        ],
    ),
    "tkg-008": dict(
        ja="和田堀公園", zh=None, area="杉並區", kind="park",
        intro="橫跨善福寺川、從白山前橋到武藏野橋共 12 座橋的公園，特色是安靜的和田堀池，以及與鄰接的大宮八幡宮連成一體的綠地。",
        ginkgo="園頁在介紹鄰接的大宮八幡宮時寫道「變成黃色的神門夫婦銀杏很值得一看」（神社在公園旁邊，是另一處設施，沒有日期）。本站地圖上標示的是公園的代表位置，大宮八幡宮的夫婦銀杏只在文字說明。",
        status="2026-10-02 查核公園協會園頁：沒有 2026 年的葉況消息（最新是 2026-10-01 的運動場預約公告）。",
        status_url="https://www.tokyo-park.or.jp/park/wadabori/",
        records=[
            ("2025-11-04", "proof", "公園協會 2025 年度紅葉情報名單把和田堀公園與善福寺川緑地合為一列（樹種：イチョウ）。", "https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf"),
            ("", "static", "園頁介紹大宮八幡宮：變黃的神門夫婦銀杏很值得一看（沒有日期的景點介紹）。", "https://www.tokyo-park.or.jp/park/wadabori/"),
        ],
        caution="夫婦銀杏屬於鄰接的大宮八幡宮，不在公園本體內；與善福寺川緑地合併記載。",
        visit=dict(
            address="東京都杉並區大宮一・二丁目、成田東一・二丁目、成田西一丁目、堀ノ内一・二丁目、松ノ木一丁目",
            access="京王井の頭線「西永福」站步行約 15 分鐘；或搭巴士至「都立和田堀公園」下車（公園協會園頁）。",
            hours="常時開園。",
            closed="無（常時開園）。服務中心與各設施在年末年始休業。",
            fee="免費（部分設施收費）。",
        ),
        sources=[
            ("東京都公園協會｜和田堀公園", "https://www.tokyo-park.or.jp/park/wadabori/", "園區簡介、交通、大宮八幡宮的夫婦銀杏"),
        ],
    ),
    "tkg-009": dict(
        ja="戸山公園", zh="戶山公園", area="新宿區", kind="park",
        intro="由山手線內側最高的箱根山所在的「箱根山地區」，以及運動與休憩的「大久保地區」兩個區域組成。",
        ginkgo="園頁的主要植物與秋季見頃把銀杏列在楓樹、連香樹旁，但沒有寫位置。公園協會 2025 年度名單的樹種是モミジ與イチョウ，所以要擷取銀杏的部分，不能直接用全園的紅葉狀態。地圖上標的是箱根山地區的概略位置；大久保地區只在文字說明。",
        status="2026-10-02 查核公園協會園頁：沒有 2026 年的葉況消息（最新是 2026-09-18 的消息）。",
        status_url="https://www.tokyo-park.or.jp/park/toyama/",
        records=[
            ("2025-11-04", "proof", "公園協會 2025 年度紅葉情報名單的樹種為モミジ・イチョウ。", "https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf"),
        ],
        caution="園區分成箱根山與大久保兩個地區，銀杏在哪一區官方沒有寫。",
        visit=dict(
            address="東京都新宿區戶山一・二・三丁目、大久保三丁目",
            access="大久保地區：JR「新大久保」或「高田馬場」站步行約 10 分鐘；箱根山地區：東京 Metro 副都心線「西早稻田」站步行約 8 分鐘（公園協會園頁）。園內沒有停車場。",
            hours="常時開園。",
            closed="無（常時開園）。服務中心在年末年始休業。",
            fee="免費。",
        ),
        sources=[
            ("東京都公園協會｜戸山公園", "https://www.tokyo-park.or.jp/park/toyama/", "園區簡介、交通、主要植物"),
        ],
    ),
    "tkg-010": dict(
        ja="光が丘公園", zh="光之丘公園", area="練馬區、板橋區", kind="sub",
        intro="把美軍住宅區 Grant Heights 歸還後的土地整備成的大型公園，有銀杏大道、草坪廣場和野鳥保護區。",
        ginkgo="園頁「見どころ」介紹了兩處銀杏：①「いちょう並木」在公園中央（販賣部與觀賞池之間），是從 Grant Heights 時代移植過來的 28 棵銀杏，寫著「秋天的黃葉很壯觀」；②「ふれあいの径」是從有樂町舊都廳前的行道樹移植過來、樹齡超過百年的 40 棵巨木。地圖上標的是依官方文字「販賣部與觀賞池之間」並對照 OpenStreetMap 地物推算的概略位置。",
        status="2026-10-02 查核公園協會園頁：沒有 2026 年的葉況消息（最新是 9 月下旬的足球與活動公告）。",
        status_url="https://www.tokyo-park.or.jp/park/hikarigaoka/",
        records=[
            ("2025-11-04", "proof", "公園協會 2025 年度紅葉情報名單明列本園的樹種為銀杏。", "https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf"),
            ("", "static", "園頁介紹「いちょう並木」（28 棵）與「ふれあいの径」（40 棵），沒有日期。", "https://www.tokyo-park.or.jp/park/hikarigaoka/"),
        ],
        caution="「いちょう並木」與「ふれあいの径」是兩處不同的銀杏，後者的位置官方沒有寫。",
        visit=dict(
            address="東京都練馬區光が丘二・四丁目、旭町二丁目；板橋區赤塚新町三丁目",
            access="都營大江戶線「光が丘」站步行約 8 分鐘；東武東上線「成増」站步行約 15 分鐘（公園協會園頁）。",
            hours="常時開園。",
            closed="無（常時開園）。服務中心與各設施在年末年始休業。",
            fee="免費（部分設施收費）。",
        ),
        sources=[
            ("東京都公園協會｜光が丘公園", "https://www.tokyo-park.or.jp/park/hikarigaoka/", "園區簡介、交通、いちょう並木與ふれあいの径"),
        ],
    ),
    "tkg-011": dict(
        ja="日比谷公園", zh=None, area="千代田區", kind="sub",
        intro="由本多靜六設計、明治 36 年（1903）開園的日本第一座西式公園，大噴水、花壇和江戶時代的遺構留在市中心。",
        ginkgo="園裡最醒目的銀杏是「首賭けイチョウ」：推定樹齡 400–500 年、樹幹周長約 7 公尺。它原本長在現在的日比谷交叉路口附近，因道路拓寬差點被砍，由本多靜六博士在明治 35 年促成移植，是公園的象徵。園頁本文沒有寫它在園內的位置；英文版園內地圖有標示 Kubikake Ginkgo tree，地圖上的點是依 OpenStreetMap 的導覽牌與松本楼位置推算的概略位置。",
        status="2026-10-02 查核公園協會園頁：沒有 2026 年的葉況消息；2026-10-01 的公告與葉況無關。",
        status_url="https://www.tokyo-park.or.jp/park/hibiya/",
        records=[
            ("2025-11-04", "proof", "公園協會 2025 年度紅葉情報名單明列本園的樹種為銀杏。", "https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf"),
            ("", "static", "園頁介紹「首賭けイチョウ」（推定樹齡 400–500 年），沒有日期。", "https://www.tokyo-park.or.jp/park/hibiya/"),
            ("2026-10-02", "notice", "查核當天（2026-10-02）園頁顯示：公園再生整備工程進行中，大噴水、噴水廣場與小音樂堂周邊暫時不能進入（與葉況無關）。", "https://www.tokyo-park.or.jp/park/hibiya/"),
        ],
        caution="葉況與施工、通行公告是不同的資訊，請分開看。",
        visit=dict(
            address="東京都千代田區日比谷公園",
            access="東京 Metro 丸之內線、千代田線「霞ケ関」站，或日比谷線、千代田線、都營三田線「日比谷」站，出口即達（公園協會園頁）。",
            hours="常時開園（服務中心 8:30–17:30，年末年始除外）。",
            closed="無（常時開園）。2026 年 10 月時點因再生整備工程，大噴水與噴水廣場等部分區域不能進入。",
            fee="免費（部分設施收費）。",
        ),
        sources=[
            ("東京都公園協會｜日比谷公園", "https://www.tokyo-park.or.jp/park/hibiya/", "園區簡介、交通、首賭けイチョウ"),
        ],
    ),
    "tkg-012": dict(
        ja="代々木公園", zh="代代木公園", area="澀谷區", kind="park",
        intro="擁有練兵場與奧運選手村歷史的森林公園，是 23 區內都立公園中面積第五大的公園，A 地區是森林，B 地區有競技場與戶外舞台。",
        ginkgo="園頁的主要植物與秋季見頃列有銀杏，但沒有寫位置；見どころ只提到櫸樹並木，沒有銀杏並木。公園協會 2025 年度名單把本園的樹種列為銀杏。黃葉的公告必須限定在原文明示的區域，不能擴大成全園。",
        status="2026-10-02 查核公園協會園頁：沒有 2026 年的葉況消息（最新是 2026-09-25 的活動公告）。",
        status_url="https://www.tokyo-park.or.jp/park/yoyogi/",
        records=[
            ("2025-11-04", "proof", "公園協會 2025 年度紅葉情報名單明列本園的樹種為銀杏。", "https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf"),
        ],
        caution="官方沒有指出銀杏在園內的位置，地圖上的點只是公園的代表位置。",
        visit=dict(
            address="東京都澀谷區代代木神園町（A 地區）、神南一丁目・二丁目（B 地區）",
            access="JR 山手線「原宿」站或東京 Metro 千代田線「代々木公園」站步行約 3 分鐘；小田急線「代々木八幡」站步行約 6 分鐘（公園協會園頁）。",
            hours="常時開園。",
            closed="無（常時開園）。服務中心與各設施在年末年始休業。神南一丁目地區不在公園協會的管理範圍。",
            fee="免費（部分設施收費）。",
        ),
        sources=[
            ("東京都公園協會｜代々木公園", "https://www.tokyo-park.or.jp/park/yoyogi/", "園區簡介、交通、秋季見頃的樹種列表"),
        ],
    ),
    "tkg-013": dict(
        ja="旧岩崎邸庭園", zh="舊岩崎邸庭園", area="台東區", kind="site",
        intro="明治 29 年（1896）建成的岩崎久彌本邸，洋館、撞球室與和館保存至今，是日本國家指定重要文化財的庭園。",
        ginkgo="園頁的主要植物與秋季見頃列有銀杏與楓樹，但沒有寫位置。公園協會 2025 年度名單把本園的樹種列為銀杏。2026 年的「都立 9 庭園紅葉巡禮集章活動」（10-10 至 12-06）和園內活動（10-18 至 11-29）只是活動期間，不是見頃日期。",
        status="2026-10-02 查核公園協會園頁：沒有葉況貼文，只有活動公告。",
        status_url="https://www.tokyo-park.or.jp/park/kyu-iwasaki-tei/",
        records=[
            ("2025-11-04", "proof", "公園協會 2025 年度紅葉情報名單明列本園的樹種為銀杏。", "https://www.tokyo-park.or.jp/association/assets/20251104_2025autumnleaves_pressrelease.pdf"),
            ("2026-10-10", "event", "「都立 9 庭園紅葉巡禮集章活動」2026-10-10 至 12-06；園內活動「秋空の下で楽しむ旧岩崎邸庭園」2026-10-18 至 11-29。這些是活動期間，不是見頃日期。", "https://www.tokyo-park.or.jp/special/9gardens_stamp/index.html"),
        ],
        caution="活動或集章日期不是見頃日。官網改版後網址可能變動。",
        visit=dict(
            address="東京都台東區池之端一丁目 3-45",
            access="東京 Metro 千代田線「湯島」站 1 號出口步行約 3 分鐘；銀座線「上野廣小路」站步行約 10 分鐘（公園協會園頁）。",
            hours="上午 9 時至下午 5 時（入園到下午 4 時 30 分）；活動期間可能延長。",
            closed="年末年始（12 月 29 日至 1 月 1 日）。",
            fee="一般 400 圓、65 歲以上 200 圓；小學生以下免費。",
        ),
        sources=[
            ("東京都公園協會｜旧岩崎邸庭園", "https://www.tokyo-park.or.jp/park/kyu-iwasaki-tei/", "園區簡介、交通、開放時間、費用"),
            ("東京都公園協會｜都立 9 庭園 紅葉巡禮集章活動", "https://www.tokyo-park.or.jp/special/9gardens_stamp/index.html", "活動期間（不是見頃日期）"),
        ],
    ),
}

PLACE_TEXT.update({
    "tkg-014": dict(
        ja="国営昭和記念公園", zh="國營昭和紀念公園", area="立川市、昭島市", kind="sub",
        intro="橫跨立川市與昭島市的大型國營公園，秋天以「カナール」和「かたらいのイチョウ並木」兩條銀杏大道聞名。",
        ginkgo="官方植物指南寫「カナールイチョウ並木 200 公尺、かたらいのイチョウ並木 300 公尺」，可以走進金黃色的隧道；「秋の夜散歩」頁面則寫かたらい 98 棵、全長 300 公尺，カナール 106 棵、全長 150 公尺，並說色づき會從カナール先開始。兩個官方頁面對カナール的長度說法不同（200 公尺與 150 公尺），本站兩者並列，不擅自判斷。地圖上標的是カナール（OpenStreetMap 標有銀杏的樹列夾著水路）；かたらいのイチョウ並木的位置尚未核實（誤差約 400 公尺），所以只用文字說明，不標在地圖上。",
        status="2026-10-02 查核：2026 年最新的「花だより」（10 月 1 日）沒有提到銀杏，9 月 24 日、9 月 17 日兩篇也沒有。",
        status_url="https://www.showakinen-koen.jp/hanadayori/",
        records=[
            ("2026-10-01", "status", "最新的花だより（2026-10-01）列的是其他花卉，沒有銀杏；本年度尚未發布銀杏現況。", "https://www.showakinen-koen.jp/hanadayori/"),
            ("2025-10-23", "past", "歷史花だより列表中，2025-10-23 至 2025-12-04 之間有連續多期的イチョウ情報（列表頁的位置會隨新文章變動，不能當永久存檔）。", "https://www.showakinen-koen.jp/hanadayori/page/3/"),
            ("", "static", "官方植物指南：イチョウ（黄葉）10 月下旬～11 月下旬。「秋の夜散歩」頁面：カナールの色づき 11 月上旬～中旬、かたらいのイチョウ並木 11 月中旬～下旬。這是官方的例行時期說明，不是今年的現況。", "https://www.showakinen-koen.jp/flower-information/"),
            ("2026-10-29", "event", "「黄葉・紅葉まつり＆秋の夜散歩2026」2026-10-29 至 11-29（點燈 16:30–20:30）。活動期間不是見頃日期。", "https://www.showakinen-koen.jp/autumn-night-walk/"),
        ],
        caution="カナール與かたらいのイチョウ並木是兩處不同的銀杏。",
        posnote="かたらいのイチョウ並木的位置尚未核實（誤差約 400 公尺），不標在地圖上。",
        visit=dict(
            address="〒190-0014 東京都立川市緑町 3173",
            access="JR 青梅線「西立川」站公園口步行約 2 分鐘（西立川門）；JR 中央線「立川」站北口步行約 10–18 分鐘（依入口而異）。",
            hours="10 月：收費區 9:30–17:00；11 月至 2 月：9:30–16:30。活動時可能變更。",
            closed="年末年始（12/31、1/1）、1 月第 3 週的週一至週五；天候不佳時臨時休園。",
            fee="大人 450 圓、65 歲以上 210 圓、國中生以下免費（以官方費用頁為準）。",
            note="活動「秋の夜散歩」期間的夜間進出園只開放西立川口與立川口。",
        ),
        sources=[
            ("國營昭和記念公園｜花だより", "https://www.showakinen-koen.jp/hanadayori/", "本年度葉況的查核（資料表來源列）"),
            ("國營昭和記念公園｜花・植物ガイド", "https://www.showakinen-koen.jp/flower-information/", "銀杏並木的長度與例行時期"),
            ("國營昭和記念公園｜秋の夜散歩", "https://www.showakinen-koen.jp/autumn-night-walk/", "活動期間、棵數與色づき順序"),
            ("國營昭和記念公園｜開園時間・休園日", "https://www.showakinen-koen.jp/park-information/schedule/", "開放時間與休園日"),
            ("國營昭和記念公園｜入園料金", "https://www.showakinen-koen.jp/park-information/price/", "費用"),
            ("國營昭和記念公園｜アクセス", "https://www.showakinen-koen.jp/access/", "交通"),
        ],
    ),
    "tkg-015": dict(
        ja="新宿御苑", zh=None, area="新宿區、澀谷區", kind="sub",
        intro="位在新宿市中心、由舊皇室庭園改成的國民公園，秋天可以同時看到銀杏黃葉和菊花壇展。",
        ginkgo="國民公園協會 2025-11-28 的「季節のみどころ」文章寫道：園內各處的銀杏正值見頃，大樹被黃色整片覆蓋，很好拍；溫室附近的枝條離人很近，是人氣拍攝點。這是去年的紀錄，不是今年的現況。官方「季節のみどころ」月別表在 11 月欄寫「紅葉（イチョウ、プラタナスなど）」。地圖上標的是大溫室附近（依文章所述的概略位置）。",
        status="2026-10-02 查核：自然情報的最新貼文（2026-10-01、09-30 等）都與銀杏無關，紅葉分類的最新文章仍是 2025 年底。",
        status_url="https://fng.or.jp/shinjuku/news/",
        records=[
            ("2025-11-28", "past", "官方「季節のみどころ」：園內各處的銀杏見頃（本站只把它當作去年的紀錄）。", "https://fng.or.jp/shinjuku/2025/11/28/20251128_03/"),
            ("2026-10-01", "notice", "環境省公告：大木戶門周邊工程，2026-10-06 至 11 月下旬（預定）通行受限制，園路變窄；停放機車請用新宿門（與葉況無關）。", "https://fng.or.jp/shinjuku/2026/10/01/20261001-01/"),
            ("2026-09-30", "notice", "10/1 至 3/14 的開園時間為 9:00 至 16:30（16:00 停止入園）。", "https://fng.or.jp/shinjuku/2026/09/30/20260930-01/"),
        ],
        caution="舊文章只當歷史樣本；環境省的管理資訊與協會的自然情報用途不同，不可混入其他樹種的狀態。",
        posnote="「溫室附近」是依官方文章的敘述與 OpenStreetMap 的大溫室位置推算，並不是銀杏樹本身的座標。",
        visit=dict(
            address="〒160-0014 東京都新宿區內藤町 11",
            access="新宿門：JR、京王、小田急「新宿」站南口步行約 10 分鐘；東京 Metro 丸之內線「新宿御苑前」站 1 號出口步行約 5 分鐘。",
            hours="10/1 至 3/14：9:00–16:30（最後入園 16:00）；大溫室 9:30–16:00。",
            closed="每週一（遇假日順延至隔天平日）、12/29–1/3。特別開園期間（春 3/25–4/24、秋 11/1–11/15）無休。",
            fee="一般 500 圓、65 歲以上 250 圓、學生（高中生以上）250 圓、國中生以下免費。",
        ),
        sources=[
            ("國民公園協會｜新宿御苑 自然情報", "https://fng.or.jp/shinjuku/news/", "本年度葉況的查核（資料表來源列）"),
            ("國民公園協會｜新宿御苑 季節のみどころ（2025-11-28）", "https://fng.or.jp/shinjuku/2025/11/28/20251128_03/", "去年的銀杏見頃紀錄"),
            ("國民公園協會｜新宿御苑 季節のみどころ（月別）", "https://fng.or.jp/shinjuku/place/season", "11 月欄的紅葉樹種"),
            ("環境省｜新宿御苑", "https://policies.env.go.jp/national-garden/shinjukugyoen/index.html", "管理單位的官方頁面（資料表來源列）"),
            ("國民公園協會｜新宿御苑 利用案內", "https://fng.or.jp/shinjuku/guide/", "開放時間、休園日、費用"),
            ("國民公園協會｜新宿御苑 アクセス", "https://fng.or.jp/shinjuku/access/", "交通"),
        ],
    ),
    "tkg-016": dict(
        ja="八王子 甲州街道いちょう並木", zh="八王子甲州街道銀杏大道", area="八王子市", kind="avenue",
        intro="沿甲州街道（國道 20 號）從追分町到高尾站入口，約 4 公里、約 770 棵銀杏連綿的大道。今年是種植滿 100 年。",
        ginkgo="官方說明：並木是為了紀念大正天皇崩御後造營的武藏陵墓地，在 1927–1929 年（昭和 2–4 年）種植，1964 年被指定為八王子市天然紀念物，由國土交通省相武國道事務所管理。官方「黃葉情報」頁已刊出 2026-09-22 拍攝的 5 張照片（八王子市中央圖書館、多摩御陵入口交差點，含銀杏果實），但文字沒有寫任何階段。",
        status="2026-10-02 查核：已有 2026 年度的官方黃葉情報頁與公告，但沒有任何一處寫出階段，因此本站不覆寫推估階段。",
        status_url="https://www.ichou-festa.org/ichounews/",
        records=[
            ("2026-09-24", "status", "官方公告：已進入從高尾方向開始變色的時期，並預告會不定期發布黃葉情報。這是季節性說明，沒有寫階段，本站不把它當作階段判定。", "https://www.ichou-festa.org/notice/post-3629/"),
            ("2026-09-22", "status", "黃葉情報頁刊出 5 張 2026-09-22 拍攝的照片（中央圖書館、多摩御陵入口交差點），文字沒有階段；照片的顏色本站未判讀。", "https://www.ichou-festa.org/ichounews/"),
            ("2026-11-21", "event", "第 47 回八王子いちょう祭り 2026-11-21（六）、22（日）。祭典日期與葉況分開，不是見頃日期。", "https://www.ichou-festa.org/event"),
            ("", "static", "並木約 770 棵、約 4 公里，1927–1929 年種植，1964 年指定為八王子市天然紀念物。", "https://www.ichou-festa.org/about"),
        ],
        caution="照片拍攝日不能直接當成見頃判定；祭典日期與葉況是兩回事。",
        posnote="並木是線狀的，全長約 4 公里。地圖上的點在並木中段；東端約在追分町交差點（北緯 35.6609、東經 139.3186）、西端約在高尾站附近（北緯 35.6423、東經 139.2812），皆為概略位置。",
        visit=dict(
            address="八王子市追分町交差點至高尾站入口之間的甲州街道（國道 20 號）沿線",
            access="官方說明並木從追分町延伸到高尾站入口；最近車站的步行時間官方頁面沒有寫。",
            hours="公道，官方沒有公布開放時間。",
            closed=None,
            fee=None,
            note="祭典期間（11/21、11/22）有交通管制，沒有停車場，官方請搭乘大眾運輸。",
        ),
        sources=[
            ("八王子いちょう祭り｜黃葉情報", "https://www.ichou-festa.org/ichounews/", "2026 年度的黃葉情報（照片日期）"),
            ("八王子いちょう祭り｜お知らせ（2026-09-24）", "https://www.ichou-festa.org/notice/post-3629/", "黃葉情報的更新公告"),
            ("八王子いちょう祭り｜いちょう祭りとは", "https://www.ichou-festa.org/about", "並木的由來、棵數與長度"),
            ("八王子いちょう祭り｜開催情報", "https://www.ichou-festa.org/event", "祭典日期"),
        ],
    ),
    "tkg-017": dict(
        ja="皇居東御苑", zh=None, area="千代田區", kind="sub",
        intro="整備舊江戶城本丸、二之丸、三之丸部分區域而成的皇居附屬庭園，免費入園（週一、週五休園）。",
        ginkgo="宮內廳 2025-11-28 的花だより記錄：園內各處的銀杏和楓類等落葉樹正在變色，照片標題是「百人番所前のイチョウ」。這是去年的紀錄，不是今年的現況。2026 年最新一期的花だより（2026-09-18）談的是彼岸花等，沒有銀杏。地圖上標的是百人番所附近（依官方照片標題與 OpenStreetMap 建築位置推算的概略位置）。",
        status="2026-10-02 查核：最新的花だより（2026-09-18）沒有銀杏；9/25 與 10/2 的頁面尚未公開（404）。",
        status_url="https://www.kunaicho.go.jp/visit/higashigyoen/hanadayori/index.html",
        records=[
            ("2025-11-28", "past", "宮內廳花だより：苑內各處的銀杏與楓類等樹木變色，照片標題「百人番所前のイチョウ」（去年的紀錄）。", "https://www.kunaicho.go.jp/visit/higashigyoen/hanadayori/20251128.html"),
            ("2026-09-18", "status", "本年度最新的花だより（2026-09-18）談的是彼岸花等，沒有銀杏。", "https://www.kunaicho.go.jp/visit/higashigyoen/hanadayori/20260918.html"),
        ],
        caution="皇居東御苑不是皇居外苑，也不是北の丸公園，三者來源與範圍都不同。全園的落葉描述不能自動套用到銀杏。",
        visit=dict(
            address="東京都千代田區千代田 1",
            access="大手門：東京 Metro 大手町站 C13a 出口步行約 5 分鐘；平川門、北桔橋門：東西線「竹橋」站 1a 出口步行約 5 分鐘。",
            hours="10 月：9:00–16:30（入園到 16:00）；11 月至 2 月：9:00–16:00（入園到 15:30）。",
            closed="週一、週五，12/28 至 1/3，以及行事等不得已的日子。",
            fee="免費（入園時領取入園票，退園時歸還）。",
        ),
        sources=[
            ("宮內廳｜皇居東御苑 花だより", "https://www.kunaicho.go.jp/visit/higashigyoen/hanadayori/index.html", "本年度葉況的查核（資料表來源列）"),
            ("宮內廳｜花だより 2025-11-28", "https://www.kunaicho.go.jp/visit/higashigyoen/hanadayori/20251128.html", "去年的銀杏變色紀錄"),
            ("宮內廳｜皇居東御苑", "https://www.kunaicho.go.jp/visit/higashigyoen/index.html", "開放時間、休園日、入園方式"),
            ("宮內廳｜皇居東御苑 休園日", "https://www.kunaicho.go.jp/visit/higashigyoen/gyoen-close.html", "休園日行事曆"),
        ],
    ),
    "tkg-018": dict(
        ja="小石川植物園", zh="小石川植物園（東京大學附屬植物園）", area="文京區", kind="sub",
        intro="東京大學大學院理學系研究科的附屬植物園，園內有在植物學史上很有名的「精子発見のイチョウ」（週一休園）。",
        ginkgo="官方園內導覽說明：「精子発見のイチョウ」是平瀬作五郎發現銀杏精子的那一株，而且是雌株，秋天會結很多銀杏果。官方「開花・紅葉狀況」的日期文章曾把イチョウ與イロハモミジ等列為正在紅葉／黃葉的植物。地圖上標的是這棵名木的位置（OpenStreetMap 的樹木節點，概略位置）。",
        status="2026-10-02 查核：開花・紅葉狀況的貼文（2026-10-01、09-30 等）共開啟 12 篇，都沒有提到銀杏或黃葉。",
        status_url="https://koishikawa-bg.jp/kaikainfo/",
        records=[
            ("2025-11-19", "past", "開花・紅葉狀況的日期文章把イチョウ列在正在紅葉／黃葉的植物清單中。看到黃葉不等於見頃（日期取自資料表；文章本文沒有顯示日期）。", "https://koishikawa-bg.jp/kaika/5013/"),
            ("", "static", "園內導覽介紹「精子発見のイチョウ」（雌株，秋天結很多銀杏果），沒有日期。", "https://koishikawa-bg.jp/ennai/ginkgo/"),
        ],
        caution="小石川植物園與小石川後樂園是不同的地點，不要搞混。",
        visit=dict(
            address="〒112-0001 東京都文京區白山 3-7-1",
            access="都營三田線「白山」站 A1 出口步行約 10 分鐘；東京 Metro 丸之內線「茗荷谷」站步行約 15 分鐘。園內沒有停車位。",
            hours="9:00–16:30（入園到 16:00）；開園期間 1/4 至 12/28。",
            closed="週一（遇假日順延）、12/29 至 1/3 不開園。",
            fee="大人（高中生以上）500 圓、國中小學生 150 圓；離園後不可再入園。",
        ),
        sources=[
            ("小石川植物園｜開花・紅葉狀況", "https://koishikawa-bg.jp/kaikainfo/", "本年度葉況的查核（資料表來源列）"),
            ("小石川植物園｜開花・紅葉狀況（2025 年的文章）", "https://koishikawa-bg.jp/kaika/5013/", "去年的銀杏變色紀錄"),
            ("小石川植物園｜精子発見のイチョウ", "https://koishikawa-bg.jp/ennai/ginkgo/", "名木的介紹"),
            ("小石川植物園｜利用案內", "https://koishikawa-bg.jp/overview/guide/", "開放時間、休園日、費用"),
            ("小石川植物園｜アクセス", "https://koishikawa-bg.jp/access/", "交通"),
        ],
    ),
    "tkg-019": dict(
        ja="広徳寺", zh="廣德寺", area="あきる野市", kind="site",
        intro="位在秋川溪谷的臨濟宗古剎，以茅草屋頂的山門和銀杏巨樹聞名。",
        ginkgo="あきる野市官方的「あきる野百景」介紹：山門被推測是江戶時代中期的建築，境內有東京都指定天然紀念物的榧樹與タラヨウ，「也有銀杏巨樹」（頁面更新日 2021-01-22）。觀光協會的紅葉情報（2025-11-08 發文、照片 11-06 拍攝）寫道銀杏的變色有進展，離見頃還差一點；之後的更新說「銀杏也已經是見頃」。這些都是去年的紀錄。",
        status="2026-10-02 查核：觀光協會的紅葉情報最後一篇仍是 2025 年（2025-12-01），2026 年尚未發布紅葉文章。",
        status_url="https://www.akirunokanko.com/?cat=53",
        records=[
            ("2025-11-08", "past", "觀光協會紅葉情報：發文日 2025-11-08、照片拍攝日 2025-11-06。銀杏的變色有進展，離見頃還差一點。（發文日與拍攝日分開記載。）", "https://www.akirunokanko.com/?p=8712"),
            ("", "past", "觀光協會之後的 2025 年更新（第 3 回）寫「銀杏也已經是見頃」（本站未取得該篇的確切日期）。", "https://www.akirunokanko.com/?p=8731"),
            ("2021-01-22", "static", "あきる野市官方「あきる野百景」介紹境內有銀杏巨樹（頁面更新日 2021-01-22）。", "https://www.city.akiruno.tokyo.jp/0000001442.html"),
        ],
        caution="同一篇紅葉情報裡「石舟橋」那段是楓樹，不能套用到廣德寺的銀杏；發文日與拍攝日要分開看。",
        posnote="地圖上的點是廣德寺寺院本身的位置，不是銀杏樹的座標。",
        visit=dict(
            address="東京都あきる野市小和田 234",
            access="JR「武蔵五日市」站步行約 30 分鐘；或搭巴士到「上町」下車步行約 15 分鐘。（觀光協會紅葉情報裡的交通說明是石舟橋的，不是廣德寺的。）",
            hours=None, closed=None, fee=None,
            note="拜觀時間、拜觀費與休日官方頁面沒有找到；廣德寺本身的官方網站也未確認。",
        ),
        sources=[
            ("あきる野市觀光協會｜のらぼう日記（秋川溪谷紅葉情報）", "https://www.akirunokanko.com/?cat=53", "本年度葉況的查核（資料表來源列）"),
            ("あきる野市觀光協會｜紅葉情報 2025（2025-11-08）", "https://www.akirunokanko.com/?p=8712", "去年的銀杏變色紀錄"),
            ("あきる野市觀光協會｜紅葉情報 2025（第 3 回）", "https://www.akirunokanko.com/?p=8731", "去年的銀杏見頃紀錄"),
            ("あきる野市｜あきる野百景 31 広徳寺", "https://www.city.akiruno.tokyo.jp/0000001442.html", "寺院簡介、境內有銀杏巨樹、交通"),
        ],
    ),
    "tkg-023": dict(
        ja="明治神宮外苑 いちょう並木", zh="明治神宮外苑銀杏大道", area="新宿區", kind="avenue",
        intro="從青山通口筆直走向聖德記念繪畫館的四排銀杏大道，是東京最具代表性的秋季景觀之一。",
        ginkgo="官方「いちょう並木の春夏秋冬」寫道：從青山通口到外苑中央廣場圓周道路是四排並列的行道樹，春天發芽、夏天青葉、秋天黃葉、冬天裸木，四季都受到喜愛。並木長 300 公尺、146 棵、9 公尺間隔（這是歷史數值，不能當作 2026 年的現況）；依樹高順序朝繪畫館種植、利用遠近法讓景觀顯得更深遠，每四年的 1 至 3 月修剪成圓錐形。官方網站上最近一則日期明確的銀杏貼文，是外苑便り 2022-11-17「イチョウ並木が見頃です」。",
        status="2026-10-02 查核：官方網站沒有 2026 年的銀杏貼文，也沒有每日更新的葉況頁；也沒有找到 2026 年銀杏祭的官方公告。",
        status_url="https://www.meijijingugaien.jp/walk/sight/season.html",
        records=[
            ("2022-11-17", "past", "外苑便り「イチョウ並木が見頃です」（官方網站上最近一則日期明確的銀杏貼文，四年前的紀錄）。", "https://www.meijijingugaien.jp/gaien-news/"),
            ("", "static", "「いちょう並木の春夏秋冬」頁面介紹並木（300 公尺、146 棵），沒有日期，棵數為歷史基準。", "https://www.meijijingugaien.jp/walk/sight/season.html"),
        ],
        caution="這裡是明治神宮外苑，不是明治神宮內苑。頁面裡的樹齡與棵數含有歷史基準，不要當成 2026 年的現況。",
        posnote="並木是線狀的。地圖上的點在並木中點；青山口側端點約在北緯 35.6722、東經 139.7208，圓周道路（繪畫館前）側端點約在北緯 35.6750、東經 139.7195，皆為概略位置。",
        visit=dict(
            address="〒160-0013 東京都新宿區霞ヶ丘町 1 番 1 號（明治神宮外苑）",
            access="JR 中央・總武線「信濃町」「千駄ヶ谷」站；東京 Metro 銀座線「外苑前」、銀座線與半藏門線「青山一丁目」站。官方交通圖沒有寫步行分鐘。",
            hours=None, closed=None, fee=None,
            note="並木的位置在青山通口到外苑中央廣場圓周道路之間。開放時間、費用與利用規則官方頁面沒有記載。",
        ),
        sources=[
            ("明治神宮外苑｜いちょう並木の春夏秋冬", "https://www.meijijingugaien.jp/walk/sight/season.html", "並木的介紹（資料表來源列）"),
            ("明治神宮外苑｜外苑便り", "https://www.meijijingugaien.jp/gaien-news/", "2022-11-17 的銀杏貼文與 2026 年無貼文的查核"),
            ("明治神宮外苑｜アクセスマップ", "https://www.meijijingugaien.jp/information/access-map.html", "交通"),
        ],
    ),
    "tkg-024": dict(
        ja="大田黒公園", zh="大田黑公園", area="杉並區", kind="site",
        intro="由音樂評論家大田黑元雄的宅邸舊址改建的區立迴遊式日本庭園，是荻窪三庭園之一。",
        ginkgo="杉並區官方介紹：進入正門後，白色花崗岩的園路筆直延伸 70 公尺，左右是樹齡超過 100 年的大銀杏並木。公園網站寫「樹齡百年以上的銀杏並木和楓樹等紅葉的時期，有很多人造訪」。2026 年度沒有公布葉況。",
        status="2026-10-02 查核：公園網站的最新公告（2026-09-15 至 10-01）都與紅葉無關；2026 年秋季點燈的官方公告也沒有找到。",
        status_url="https://ogikubo3gardens.jp/ootaguro/",
        records=[
            ("2025-09-09", "static", "杉並區官方頁面（更新日 2025-09-09）：左右是樹齡 100 年的大銀杏並木。這是景點介紹，不是葉況。", "https://www.city.suginami.tokyo.jp/s100/shisetsu/14632.html"),
            ("", "static", "公園網站介紹銀杏並木與紅葉時期的人潮，沒有日期。", "https://ogikubo3gardens.jp/ootaguro/"),
        ],
        caution="2024 年 3 月已經結束管理的舊管理公司（箱根植木）網頁，不能當作現任的營運來源。本地點在資料表的等級是 B：官方身分已確認，但公園頁面的正文讀取不足。",
        posnote="公園面積約 0.9 公頃，地圖上的點是公園本身的位置，不是銀杏樹的座標。",
        visit=dict(
            address="〒167-0051 東京都杉並區荻窪 3 丁目 33 番 12 號",
            access="JR 中央線、總武線與東京 Metro 丸之內線「荻窪」站步行約 10 分鐘。沒有停車場，區公所請勿開車前往。",
            hours="上午 9 時至下午 5 時（入園到下午 4 時 30 分）。",
            closed="週三、年末年始（12 月 29 日至 1 月 1 日）；可能變動，請以官網為準。",
            fee=None,
            note="杉並區官方說明，點燈期間及其前後無法進行拍攝取景。",
        ),
        sources=[
            ("荻窪三庭園｜大田黑公園", "https://ogikubo3gardens.jp/ootaguro/", "現行官方網站（資料表來源列）"),
            ("杉並區｜大田黑公園", "https://www.city.suginami.tokyo.jp/s100/shisetsu/14632.html", "銀杏並木的介紹、開放時間、休園日、交通"),
        ],
    ),
    "tkg-025": dict(
        ja="大國魂神社", zh=None, area="府中市", kind="site",
        intro="府中市的古老神社，本殿後方有傳說樹齡約 1000 年的銀杏大樹。",
        ginkgo="神社官網的「豆知識」頁寫道：本殿後方有樹齡約 1000 年的銀杏大樹，樹根處有蜷貝（にながい）棲息，被認為對產後恢復有益。官方沒有黃葉的觀測文章，也沒有寫通常的見頃時期。",
        status="2026-10-02 查核：官網 2026 年的公告是秋季祭「くり祭」與刀劍展，與葉況無關。",
        status_url="https://www.ookunitamajinja.or.jp/mame/",
        records=[
            ("", "static", "神社官網「豆知識」頁介紹本殿後方的大銀杏（樹齡約 1000 年），沒有日期，也不是葉況。", "https://www.ookunitamajinja.or.jp/mame/"),
        ],
        caution="附近馬場大門的並木是櫸樹，不是銀杏。",
        posnote="地圖上的點在本殿・拜殿一帶；官方說大銀杏在本殿後方，不是銀杏樹的精確座標。",
        visit=dict(
            address="〒183-0023 東京都府中市宮町 3-1",
            access="京王線「府中」站南口步行約 5 分鐘；JR 南武線、武藏野線「府中本町」站步行約 5 分鐘。",
            hours="開門：9/15 至 3/31 為 6:30–17:00，4/1 至 9/14 為 6:00–17:00；祭典等活動時可能變更。",
            closed=None, fee=None,
        ),
        sources=[
            ("大國魂神社｜豆知識", "https://www.ookunitamajinja.or.jp/mame/", "大銀杏的介紹（資料表來源列）"),
            ("大國魂神社｜アクセス", "https://www.ookunitamajinja.or.jp/access/", "交通"),
            ("大國魂神社", "https://www.ookunitamajinja.or.jp/", "開門時間、2026 年的公告"),
        ],
    ),
    "tkg-026": dict(
        ja="靖國神社", zh=None, area="千代田區", kind="site",
        intro="位在九段北的神社，是莊嚴的祭祀場所。氣象廳指定的東京櫻花標本木也在境內（那是櫻花，與銀杏的標本木無關）。",
        ginkgo="資料表該列的三個連結都沒有銀杏的文字，本站是依同一官方網域的另一則公告確認境內有銀杏：2023-09-06 的朱印公告提到「参道のイチョウ並木」。此外，150 年紀念事業的頁面有一張照片說明寫「外苑の銀杏並木」（大村益次郎銅像附近的景色）。日期明確的黃葉觀測文章與見頃時期，官方都沒有寫；銀杏在參道的哪裡、有幾棵，也未能核實。",
        status="2026-10-02 查核：照片頁沒有銀杏文字；2026-09-15 公告的「色づく季節、秋の靖國神社」是宣傳影片（拍攝日不明），不是日期明確的觀測。",
        status_url="https://www.yasukuni.or.jp/schedule/photo.html",
        records=[
            ("2023-09-06", "proof", "朱印公告提到「参道のイチョウ並木」（確認境內有銀杏；不是葉況）。", "https://www.yasukuni.or.jp/news_detail.html?id=492"),
            ("2026-09-15", "notice", "宣傳影片「令和 8 年 色づく季節、秋の靖國神社」的配信公告。影片上線日不等於拍攝日，不能當作銀杏的即時鏡頭。", "https://www.yasukuni.or.jp/news_detail.html?id=654"),
            ("", "static", "150 年紀念事業頁面的照片說明「外苑の銀杏並木」（沒有日期）。", "https://www.yasukuni.or.jp/150th/project03.html"),
        ],
        caution="境內是莊嚴的祭祀場所，請遵守官方的參拜規定。氣象廳東京的櫻花標本木在這裡，但銀杏標本木的位置本站未能核實，不要把兩者混為一談。",
        posnote="地圖上的點在拜殿一帶（境內主要區域），不是銀杏的位置；銀杏在參道上的確切位置未能核實。",
        visit=dict(
            address="〒102-8246 東京都千代田區九段北 3-1-1",
            access="東京 Metro 東西線、半藏門線與都營新宿線「九段下」站 1 號出口步行約 5 分鐘；JR「飯田橋」「市ケ谷」站步行約 10 分鐘。",
            hours="開門 6:00；閉門 3 月至 10 月為 18:00，11 月至 2 月為 17:00；祭典等活動時可能變更。",
            closed=None, fee=None,
            note="官方列出境內禁止的行為，例如內苑鋪墊子飲食、攜帶寵物散步、無人機、未經許可的取材與拍攝等，請先閱讀。",
        ),
        sources=[
            ("靖國神社", "https://www.yasukuni.or.jp/", "官方首頁（資料表來源列）"),
            ("靖國神社｜照片・映像", "https://www.yasukuni.or.jp/schedule/photo.html", "本年度葉況的查核（資料表來源列）"),
            ("靖國神社｜秋季限定 朱印公告（2023-09-06）", "https://www.yasukuni.or.jp/news_detail.html?id=492", "確認境內有銀杏並木的依據"),
            ("靖國神社｜150 年記念事業『いざない』", "https://www.yasukuni.or.jp/150th/project03.html", "照片說明「外苑の銀杏並木」"),
            ("靖國神社｜アクセス", "https://www.yasukuni.or.jp/access.html", "交通"),
            ("靖國神社｜ご参拝時のお願い", "https://www.yasukuni.or.jp/hope.html", "參拜規定"),
            ("靖國神社｜境內案內（櫻花標本木）", "https://www.yasukuni.or.jp/precincts/map.html", "氣象廳東京的櫻花標本木在境內（用來避免與銀杏混淆）"),
        ],
    ),
    "tkg-030-kitanomaru": dict(
        ja="北の丸公園", zh="北之丸公園", area="千代田區", kind="park",
        intro="皇居周邊國民公園的一部分，日本武道館前有銀杏並木與園內最大的「大イチョウ」，24 小時開放、免費。",
        ginkgo="國民公園協會 2023-11-24 的文章寫道：日本武道館前有特別大的「大イチョウ」，銀杏種在園內各處，「見ごろは 12 月上旬」。2024-11-13 的文章寫「園內的銀杏剛開始變色」。環境省皇居外苑部落格 2016-11-25 提到武道館前的銀杏並木在見頃時是人氣拍攝點，並木中段有石牆圍住樹根的「大イチョウ」（昭和 44 年開園以來就這樣稱呼的園內最大銀杏）。這些都是往年的紀錄。",
        status="2026-10-02 查核：國民公園協會皇居外苑的最新消息（2026-10-01 的 3 則、09-19 的季節散文等）沒有提到銀杏。",
        status_url="https://fng.or.jp/koukyo/news/",
        records=[
            ("2024-11-13", "past", "國民公園協會文章：園內的銀杏剛開始變色（往年的紀錄）。", "https://fng.or.jp/koukyo/2024/11/13/irodukukitanomarukouen/"),
            ("2023-11-24", "past", "國民公園協會文章：武道館前有「大イチョウ」，見ごろは 12 月上旬（往年的紀錄與預期）。", "https://fng.or.jp/koukyo/2023/11/24/kitanomarukouennnokouyou/"),
            ("2016-11-25", "past", "環境省皇居外苑部落格：武道館前的銀杏並木見頃，並木中段有園內最大的「大イチョウ」。", "https://www.env.go.jp/garden/kokyogaien/news/autumn_leaves/index_4.html"),
        ],
        caution="本站只標示北の丸公園。皇居外苑（行幸通り一帶）的銀杏未獲官方文字證實，不標示；皇居東御苑則是另一個地點、另一個管理單位。",
        posnote="地圖上的點是公園的代表位置（概略），大イチョウ在日本武道館前，但不是銀杏樹的精確座標。",
        visit=dict(
            address="東京都千代田區北の丸公園（管理單位：國民公園協會 皇居外苑，事務所 〒100-0002 東京都千代田區皇居外苑 1-1）",
            access="都營新宿線、東京 Metro 東西線與半藏門線「九段下」站 2 號出口步行約 5 分鐘；東西線「竹橋」站步行約 8 分鐘。",
            hours="常時開放（國家行事等的特別警備日會有利用限制）；紅葉期官方請避免晚上 10 點以後的利用。",
            closed="無休（特別警備日除外）。",
            fee="免費。",
        ),
        sources=[
            ("國民公園協會｜皇居外苑 新聞・季節", "https://fng.or.jp/koukyo/news/", "本年度葉況的查核（資料表來源列）"),
            ("國民公園協會｜北の丸公園の紅葉（2023-11-24）", "https://fng.or.jp/koukyo/2023/11/24/kitanomarukouennnokouyou/", "大イチョウ與見ごろ的說明（確認銀杏的依據）"),
            ("國民公園協會｜北の丸公園 色づき（2024-11-13）", "https://fng.or.jp/koukyo/2024/11/13/irodukukitanomarukouen/", "往年的色づき紀錄"),
            ("環境省｜皇居外苑 紅葉さんぽ", "https://www.env.go.jp/garden/kokyogaien/news/autumn_leaves/index_4.html", "往年的銀杏並木介紹"),
            ("環境省｜北の丸公園 利用案內", "https://www.env.go.jp/garden/kokyogaien/2_guide/kitanomarukoen_00001.html", "開放時間、費用、利用規則"),
            ("國民公園協會｜皇居外苑 アクセス", "https://fng.or.jp/koukyo/access/", "交通"),
        ],
    ),
    "tkg-040-hongo": dict(
        ja="東京大学 本郷キャンパス", zh="東京大學本鄉校區", area="文京區", kind="avenue",
        intro="東京大學的本鄉校區，從正門通往安田講堂的銀杏並木是校園的代表景觀。",
        ginkgo="東大官方的校園導覽頁寫著「本郷キャンパスの銀杏並木」，說秋天金黃色的銀杏葉鋪滿地面；東大的另一個官方網站也寫「從正門延伸的銀杏並木」。校園導覽的索引頁本身沒有逐日的銀杏觀測，所以沒有本年度的葉況。",
        status="2026-10-02 查核：校園導覽索引頁只有地圖與參觀規則，沒有日期明確的銀杏觀測。",
        status_url="https://www.u-tokyo.ac.jp/ja/about/campus-guide/index.html",
        records=[
            ("", "proof", "東大校園導覽「1km_of_campus」頁介紹本鄉校區的銀杏並木（沒有日期，確認這裡有銀杏）。", "https://www.u-tokyo.ac.jp/ja/about/campus-guide/1km_of_campus.html"),
            ("2026-04-01", "static", "校園導覽索引頁（地圖更新 2026-04-01）確認本鄉與駒場的官方地圖與參觀入口，沒有銀杏觀測。", "https://www.u-tokyo.ac.jp/ja/about/campus-guide/index.html"),
        ],
        caution="本鄉校區、駒場校區與小石川植物園是三個不同的地點。校園導覽頁沒有證實各校區的當季銀杏觀測。",
        posnote="並木是線狀的。地圖上的點在正門到安田講堂之間的並木中點；正門端約在北緯 35.7129、東經 139.7595，安田講堂端約在北緯 35.7133、東經 139.7617，皆為概略位置。",
        visit=dict(
            address="〒113-8654 東京都文京區本鄉 7-3-1",
            access="東京 Metro 南北線「東大前」站步行約 1 分鐘；丸之內線「本鄉三丁目」站步行約 8 分鐘。",
            hours="本鄉校區的自由參觀請在 7:00–18:00 之間（官方 Q&A）；各門開閉時間不同。",
            closed="入學考試實施日等不能入校。",
            fee=None,
            note="官方參觀規則：保持安靜、各學部建築與教室原則上不能進入、商業攝影與婚紗照不可、攝影成果不可刊登於刊物或社群網站。",
        ),
        sources=[
            ("東京大學｜キャンパスガイド", "https://www.u-tokyo.ac.jp/ja/about/campus-guide/index.html", "官方校園地圖與參觀入口（資料表來源列）"),
            ("東京大學｜キャンパス 1km", "https://www.u-tokyo.ac.jp/ja/about/campus-guide/1km_of_campus.html", "確認本鄉校區有銀杏並木"),
            ("東京大學 本郷｜こと始め", "https://kimino.ct.u-tokyo.ac.jp/kotohajime/hongo-campus/", "「從正門延伸的銀杏並木」的說明"),
            ("東京大學｜本郷キャンパスの見学", "https://www.u-tokyo.ac.jp/ja/about/campus-guide/public02_05.html", "參觀時間與規則"),
        ],
    ),
    "tkg-040-komaba": dict(
        ja="東京大学 駒場キャンパス", zh="東京大學駒場校區", area="目黑區", kind="avenue",
        intro="東京大學的駒場校區，主幹道旁的銀杏並木在秋天會把道路染成黃色。",
        ginkgo="東大官方的學生網站介紹駒場校區時寫「秋天銀杏並木把主幹道染成黃色」，另一則說「談到駒場的秋天，就是銀杏並木的黃葉」。東大官網的特集文章也提到從 1 號館西側的路往北走就會看到銀杏並木。官方沒有日期明確的葉況，所以沒有本年度的葉況。",
        status="2026-10-02 查核：校園導覽索引頁沒有日期明確的銀杏觀測。",
        status_url="https://www.u-tokyo.ac.jp/ja/about/campus-guide/index.html",
        records=[
            ("", "proof", "東大官方學生網站：秋天銀杏並木把主幹道染成黃色（沒有日期，確認這裡有銀杏）。", "https://kimino.ct.u-tokyo.ac.jp/kotohajime/komaba-campus/"),
            ("", "static", "東大官網特集：從 1 號館西側的路往北走就會看到銀杏並木（沒有日期）。", "https://www.u-tokyo.ac.jp/focus/ja/features/z1304_00053.html"),
        ],
        caution="本鄉校區、駒場校區與小石川植物園是三個不同的地點；駒場 II 校區除校園開放日外不對外開放。",
        posnote="並木位置是依東大官方的敘述與 OpenStreetMap 的樹列、建築位置推算的概略位置，來源之間約有 100 公尺的差距。",
        visit=dict(
            address="〒153-8902 東京都目黑區駒場 3-8-1",
            access="京王井の頭線「駒場東大前」站步行約 0 分鐘（東口為正門）；小田急線「東北澤」站步行約 8 分鐘。",
            hours=None,
            closed="駒場 II 校區除校園開放日外不對外開放。",
            fee=None,
            note="駒場 I 校區的具體參觀規則與開門時間，本站只讀到本鄉的官方 Q&A，尚待確認。",
        ),
        sources=[
            ("東京大學｜キャンパスガイド", "https://www.u-tokyo.ac.jp/ja/about/campus-guide/index.html", "官方校園地圖與參觀入口（資料表來源列）"),
            ("東京大學 駒場｜こと始め", "https://kimino.ct.u-tokyo.ac.jp/kotohajime/komaba-campus/", "確認駒場校區有銀杏並木"),
            ("東京大學 駒場｜秋の駒場（1592）", "https://kimino.ct.u-tokyo.ac.jp/1592/", "「駒場的秋天就是銀杏並木的黃葉」的說明"),
            ("東京大學｜特集（駒場 I キャンパス）", "https://www.u-tokyo.ac.jp/focus/ja/features/z1304_00053.html", "並木的大致位置"),
        ],
    ),
    "tkg-041": dict(
        ja="国立 大学通り", zh="國立大學通", area="國立市", kind="avenue",
        intro="從國立站筆直向南延伸的大道，是文教地區的象徵。春天是櫻花，秋天被銀杏的黃色覆蓋，冬天有銀杏燈飾。",
        ginkgo="くにたちNAVI（國立市觀光まちづくり協會）寫道：秋天「被優雅的銀杏黃色整片覆蓋」；冬天從國立站延伸到大學通的道路旁，10 棵銀杏會披上約 9 萬顆 LED。長度、棵數與通常的黃葉時期，官方都沒有寫（第三方網站有約 120 棵的說法，本站不採用）。",
        status="2026-10-02 查核：官網 2026-09-03 至 10-01 的消息都是活動與店家，沒有銀杏相關消息。",
        status_url="https://kunimachi.jp/",
        records=[
            ("", "proof", "くにたちNAVI「大學通り」景點頁介紹秋天的銀杏黃葉與冬季燈飾（沒有日期的介紹文，確認這裡有銀杏）。", "https://kunimachi.jp/spot/daigakustreet/"),
            ("2026-09-25", "static", "くにたちNAVI 首頁最近的更新為 2026-09-25，頁尾確認營運者為國立市觀光まちづくり協會；沒有銀杏專項葉況文章。", "https://kunimachi.jp/"),
        ],
        caution="區域旅遊網站的更新不等於大學通り銀杏的現況；冬季燈飾的 2026 年日程官方尚未公布。",
        posnote="大學通り是長約 1.2 公里（依 OpenStreetMap 樹列推算）的線狀並木；地圖上的點在國立站南側的代表位置，與各來源座標最遠相差約 500 公尺，是本站 26 處中來源座標差距最大的一個。",
        visit=dict(
            address="東京都國立市東 2 丁目一帶（くにたちNAVI 景點頁的表記）；從國立站筆直向南的道路",
            access="JR 中央線「國立」站；從東京站搭中央線約 45 分鐘（くにたちNAVI 交通資訊）。",
            hours=None, closed=None, fee=None,
            note="冬季點燈的 2026 年日程官方尚未公布。",
        ),
        sources=[
            ("くにたちNAVI｜大學通り", "https://kunimachi.jp/spot/daigakustreet/", "確認有銀杏並木的官方景點頁"),
            ("くにたちNAVI｜國立市觀光まちづくり協會", "https://kunimachi.jp/", "官方入口（資料表來源列）、本年度消息的查核"),
            ("くにたちNAVI｜アクセス", "https://kunimachi.jp/access/", "交通"),
        ],
    ),
})


def build_places():
    places = []
    for pid in GEO:
        t = PLACE_TEXT[pid]
        g = GEO[pid]
        places.append(dict(t, id=pid, sid=g["sid"], geo=g, sheet=SHEET[g["sid"]], poslabel=POS_LABEL[pid]))
    return places


PLACES = build_places()
assert len(PLACES) == 26 and len(set(p["id"] for p in PLACES)) == 26

# ----------------------------------------------------------------------------
# 3. 樣式與腳本（由此檔輸出為 style.css、app.js）
# ----------------------------------------------------------------------------
STYLE_CSS = r"""/* 東京銀杏一年生長階段情報：樣式。由 sakura.py 產生，請改 sakura.py 而不是這個檔案。 */
:root {
  --paper: #f3f5f1;
  --card: #ffffff;
  --ink: #15262c;
  --ink2: #44555b;
  --line: #cbd5cf;
  --line2: #e0e6e2;
  --link: #135b6b;
  --link-h: #0b3d49;
  --focus: #0a58ca;
  --s1: #4c8a56;
  --s2: #9ab13a;
  --s3: #dfbb2b;
  --s4: #f1a30d;
  --s5: #bb6a27;
  --s6: #85776b;
  --s1bg: #e3efe4;
  --s2bg: #edf2d3;
  --s3bg: #f8efc4;
  --s4bg: #fbe5b8;
  --s5bg: #f3dac3;
  --s6bg: #e8e2dc;
  --serif: "Noto Serif TC", "Shippori Mincho", "Hiragino Mincho ProN", "Yu Mincho", "PMingLiU", serif;
  --sans: "Noto Sans TC", "Hiragino Sans", "Yu Gothic UI", "Microsoft JhengHei", system-ui, -apple-system, "Segoe UI", sans-serif;
}

*, *::before, *::after { box-sizing: border-box; }
[hidden] { display: none !important; }
html { -webkit-text-size-adjust: 100%; scroll-behavior: smooth; }
body {
  margin: 0;
  background: var(--paper);
  color: var(--ink);
  font-family: var(--sans);
  font-size: 16px;
  line-height: 1.75;
  overflow-wrap: anywhere;
}
h1, h2, h3, p, ul, ol, dl, dd, figure { margin: 0; }
ul, ol { padding: 0; list-style: none; }
img, svg { max-width: 100%; }
.wrap { width: 100%; max-width: 1200px; margin: 0 auto; padding: 0 16px; }
.sr-only { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }

/* links: every link box reaches 44px in height and width */
a { color: var(--link); text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: 3px; padding: 12px 6px; border-radius: 2px; }
a:hover { color: var(--link-h); text-decoration-thickness: 2px; }
a:focus-visible, .leaflet-container:focus-visible, [tabindex]:focus-visible { outline: 3px solid var(--focus); outline-offset: 2px; }
.skip { position: absolute; left: 8px; top: -80px; background: var(--ink); color: #fff; padding: 12px 18px; z-index: 2000; text-decoration: none; }
.skip:focus { top: 8px; }

/* header / footer */
.site-head { background: var(--card); border-bottom: 1px solid var(--line); }
.head-in { display: flex; align-items: center; justify-content: space-between; min-height: 60px; }
.brand { display: inline-flex; align-items: center; gap: 10px; min-height: 48px; padding: 6px 8px 6px 0; color: var(--ink); text-decoration: none; font-family: var(--serif); font-weight: 700; font-size: 18px; letter-spacing: .04em; }
.brand:hover { color: var(--ink); text-decoration: none; }
.brand .mark { width: 28px; height: 28px; color: var(--s1); flex: none; }
.head-note { font-size: 14px; color: var(--ink2); }
.site-foot { margin-top: 72px; border-top: 1px solid var(--line); background: var(--card); padding: 28px 0 40px; }
.foot-main { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 28px; }
.foot-src { display: inline-flex; align-items: center; min-height: 48px; padding: 0 20px; border: 1px solid var(--ink); color: var(--ink); text-decoration: none; font-weight: 700; letter-spacing: .12em; border-radius: 2px; }
.foot-src:hover { background: var(--ink); color: #fff; text-decoration: none; }
.foot-main p { color: var(--ink2); font-size: 15px; flex: 1 1 280px; }
.foot-small { margin-top: 10px; color: var(--ink2); font-size: 14px; }

/* breadcrumb */
.crumbs { padding-top: 12px; font-size: 14px; color: var(--ink2); }
.crumbs ol { display: flex; flex-wrap: wrap; align-items: center; }
.crumbs li + li::before { content: "/"; margin: 0 4px; color: var(--line); }
.crumbs a { display: inline-block; padding: 12px 8px; }

/* hero (home) */
.hero { position: relative; padding: 34px 0 24px; }
.hero-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 8px 56px; align-items: end; }
.eyebrow { font-size: 14px; letter-spacing: .14em; color: var(--ink2); }
h1 { font-family: var(--serif); font-weight: 700; font-size: clamp(30px, 4.6vw, 52px); line-height: 1.22; letter-spacing: .03em; margin-top: 8px; }
.lede { max-width: 38em; margin-top: 16px; color: var(--ink2); font-size: 17px; }
.today-line { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px 22px; margin-top: 22px; padding: 12px 0; border-top: 1px solid var(--ink); border-bottom: 1px solid var(--line); }
.today-line .k { font-size: 14px; color: var(--ink2); letter-spacing: .1em; }
.today-line .v { font-family: var(--serif); font-size: 22px; font-weight: 700; }
.today-line .v a { font-size: inherit; }
.basis-note { margin-top: 12px; color: var(--ink2); font-size: 15px; max-width: 46em; }

/* stage dot + stage link */
.dot { display: inline-block; width: 11px; height: 11px; border-radius: 50%; background: var(--c, var(--s1)); margin-right: 8px; flex: none; box-shadow: 0 0 0 1px rgba(21, 38, 44, .35); }
.s1 { --c: var(--s1); --cbg: var(--s1bg); }
.s2 { --c: var(--s2); --cbg: var(--s2bg); }
.s3 { --c: var(--s3); --cbg: var(--s3bg); }
.s4 { --c: var(--s4); --cbg: var(--s4bg); }
.s5 { --c: var(--s5); --cbg: var(--s5bg); }
.s6 { --c: var(--s6); --cbg: var(--s6bg); }
.stage-link { display: inline-flex; align-items: center; min-height: 44px; min-width: 44px; padding: 0 8px; font-weight: 700; color: var(--ink); text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: 4px; }
.stage-link:hover { color: var(--ink); text-decoration-thickness: 2px; }
.stage-link.inline { padding: 0 1px; margin: 0 2px; }
.stage-link.big { font-family: var(--serif); font-size: 30px; padding: 0; }
.stage-link.big .dot { width: 16px; height: 16px; margin-right: 12px; }

/* ruler: six stages as one season scale */
.ruler { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 0; margin-top: 30px; border-top: 1px solid var(--line); }
.rs { position: relative; border-left: 1px solid var(--line2); }
.rs:first-child { border-left: 0; }
.rs a { display: block; min-height: 96px; padding: 16px 10px 12px; color: var(--ink); text-decoration: none; position: relative; }
.rs a:hover { background: var(--cbg); color: var(--ink); text-decoration: none; }
.rs-bar { position: absolute; left: 0; right: 0; top: -1px; height: 7px; background: var(--c); }
.rs-name { display: block; font-family: var(--serif); font-weight: 700; font-size: 19px; line-height: 1.3; margin-top: 4px; }
.rs-date { display: block; margin-top: 4px; font-size: 14px; color: var(--ink2); line-height: 1.4; }
.rs-now { display: none; margin-top: 6px; font-size: 13px; font-weight: 700; letter-spacing: .12em; color: #fff; background: var(--ink); padding: 1px 8px; border-radius: 2px; width: max-content; }
.rs.is-now a { background: var(--cbg); }
.rs.is-now .rs-bar { height: 12px; }
.rs.is-now .rs-now { display: inline-block; }
.rs a[aria-current="page"] { box-shadow: inset 0 -3px 0 var(--ink); }
.ruler-cap { margin-top: 8px; color: var(--ink2); font-size: 14px; }

/* two panes on the home page */
.explorer { display: grid; grid-template-columns: minmax(0, 1fr); gap: 36px; margin-top: 24px; }
.pane-h { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 4px 16px; margin-bottom: 10px; }
h2 { font-family: var(--serif); font-weight: 700; font-size: 24px; line-height: 1.35; letter-spacing: .03em; }
.pane-h .meta { color: var(--ink2); font-size: 14px; }
.map-wrap { position: relative; border: 1px solid var(--line); background: #dfe6e2; }
.map { width: 100%; height: 56vh; min-height: 340px; max-height: 560px; }
.map-msg { padding: 24px; color: var(--ink2); }
.map.map-failed { display: grid; place-items: center; text-align: center; background: repeating-linear-gradient(45deg, #e9eeea, #e9eeea 12px, #e1e8e3 12px, #e1e8e3 24px); }
.map-notice { position: absolute; left: 12px; right: 12px; bottom: 28px; z-index: 900; background: var(--card); border: 1px solid var(--ink); padding: 10px 14px; font-size: 14px; color: var(--ink); line-height: 1.6; }
.map-hint { margin-top: 8px; color: var(--ink2); font-size: 14px; }

/* table */
.table-note { color: var(--ink2); font-size: 15px; margin-bottom: 12px; padding-left: 12px; border-left: 3px solid var(--ink); }
.tbl-wrap { border-top: 1px solid var(--ink); }
table.places { width: 100%; border-collapse: collapse; font-size: 16px; }
.places th, .places td { text-align: left; padding: 0; border-bottom: 1px solid var(--line); vertical-align: middle; font-weight: 400; }
.places thead th { font-size: 14px; color: var(--ink2); padding: 12px 10px; font-weight: 500; border-bottom: 1px solid var(--ink); letter-spacing: .06em; }
.places thead th small { display: block; font-size: 13px; letter-spacing: 0; color: var(--ink2); margin-top: 2px; font-weight: 400; }
.places tbody tr:hover { background: #fff; }
.places .nm { display: flex; flex-direction: column; justify-content: center; min-height: 54px; padding: 6px 10px 6px 4px; color: var(--ink); font-weight: 500; text-decoration: none; }
.places .nm:hover { color: var(--link); text-decoration: underline; }
.places .nm .zh { font-size: 13px; color: var(--ink2); font-weight: 400; line-height: 1.4; }
.places .nm .sub { display: none; font-size: 13px; color: var(--ink2); font-weight: 400; line-height: 1.4; }
.places td.area { padding: 0 10px; color: var(--ink2); font-size: 15px; }
.places td.stage { padding: 0 4px; }
.places .stage-link { padding: 0 8px; }
col.c-name { width: 46%; }
col.c-area { width: 20%; }
col.c-stage { width: 34%; }

/* leaflet overrides (touch targets, popup, marker label) */
.leaflet-touch .leaflet-bar a, .leaflet-bar a { width: 44px; height: 44px; line-height: 44px; font-size: 22px; padding: 0; text-decoration: none; color: #1b2a30; }
.leaflet-touch .leaflet-bar a:first-child, .leaflet-touch .leaflet-bar a:last-child { width: 44px; height: 44px; line-height: 44px; }
.leaflet-container { font-family: var(--sans); font-size: 15px; background: #dfe6e2; }
.leaflet-container a { padding: 0; }
.leaflet-container .leaflet-control-attribution { font-size: 12px; color: #1b2a30; background: rgba(255, 255, 255, .92); }
.leaflet-container .leaflet-control-attribution a { color: #0b4e80; padding: 0 2px; }
.leaflet-popup-content-wrapper { border-radius: 2px; box-shadow: 0 2px 10px rgba(21, 38, 44, .3); color: var(--ink); }
.leaflet-popup-content { margin: 14px 46px 14px 16px; line-height: 1.55; font-size: 15px; max-width: min(270px, calc(100vw - 150px)) !important; }
.leaflet-container a.leaflet-popup-close-button { top: 0; right: 0; width: 44px; height: 44px; padding: 0; font: 400 26px/44px var(--sans); text-align: center; color: var(--ink); }
.gk-pop .pop-name { display: block; font-family: var(--serif); font-weight: 700; font-size: 18px; color: var(--link); padding: 4px 0; min-height: 44px; display: flex; align-items: center; line-height: 1.35; }
.gk-pop .pop-line { color: var(--ink2); font-size: 14px; line-height: 1.5; }
.gk-pop .stage-link { min-height: 44px; padding: 0 6px; }
.gk-marker { background: none; border: 0; }
.gk-marker:focus-visible { outline: 3px solid var(--focus); outline-offset: -4px; border-radius: 50%; }
.gk-pin { position: absolute; left: 50%; top: 50%; width: 18px; height: 18px; margin: -9px 0 0 -9px; border-radius: 50%; background: var(--c); border: 2px solid #15262c; box-shadow: 0 0 0 2px rgba(255, 255, 255, .9); }
.gk-lbl { position: absolute; top: 50%; left: calc(50% + 14px); transform: translateY(-50%); display: block; white-space: nowrap; background: rgba(255, 255, 255, .94); border: 1px solid var(--ink); padding: 1px 7px 2px; line-height: 1.3; color: var(--ink); text-align: left; transition: opacity .2s; }
.gk-lbl b { display: block; font-size: 13px; font-weight: 700; }
.gk-lbl i { display: block; font-style: normal; font-size: 12px; color: var(--ink2); }
.gk-lbl.is-left { left: auto; right: calc(50% + 14px); text-align: right; }
.gk-lbl.is-off { opacity: 0; pointer-events: none; }

/* inner pages */
main { display: block; }
.page-head { padding: 28px 0 20px; border-bottom: 1px solid var(--line); }
.page-head h1 { font-size: clamp(28px, 4vw, 42px); }
.page-head h1 .dot { width: 18px; height: 18px; margin-right: 14px; vertical-align: .12em; }
.page-head .alt { margin-top: 4px; color: var(--ink2); font-size: 16px; }
.page-head .alt .yomi { letter-spacing: .1em; }
.cols { display: grid; grid-template-columns: minmax(0, 1fr); gap: 32px; margin-top: 28px; }
.cols > section, .stack > section { min-width: 0; }
.stack > section + section, .cols .main > section + section, .cols .side > section + section { margin-top: 36px; }
h3 { font-size: 17px; font-weight: 700; margin-top: 18px; }
section > h2 { padding-bottom: 8px; border-bottom: 1px solid var(--ink); margin-bottom: 14px; }
section p + p { margin-top: 10px; }
.verdict { margin-top: 26px; padding: 22px 20px 20px; background: var(--card); border: 1px solid var(--line); border-top: 4px solid var(--c, var(--ink)); }
.verdict h2 { border: 0; padding: 0; margin: 0; font-size: 15px; letter-spacing: .14em; font-family: var(--sans); color: var(--ink2); font-weight: 500; }
.verdict .big-row { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 18px; margin-top: 6px; }
.verdict .tag { font-size: 14px; color: var(--ink2); border: 1px solid var(--line); padding: 0 8px; border-radius: 2px; }
.facts { display: grid; grid-template-columns: minmax(0, 1fr); gap: 0; margin-top: 12px; }
.facts > div { display: grid; grid-template-columns: 7.5em minmax(0, 1fr); gap: 0 16px; padding: 10px 0; border-top: 1px solid var(--line2); }
.facts dt { color: var(--ink2); font-size: 15px; }
.facts dd { min-width: 0; }
.estimate { margin-top: 12px; padding: 10px 14px; background: var(--paper); border-left: 3px solid var(--ink); font-size: 15px; }
.caution { margin-top: 14px; padding: 10px 14px; border-left: 3px solid var(--s5); background: #fbf4ec; font-size: 15px; }
.caution b { font-weight: 700; }

.records { border-top: 1px solid var(--line); }
.records li { padding: 12px 0; border-bottom: 1px solid var(--line); display: grid; grid-template-columns: 8.5em minmax(0, 1fr); gap: 4px 16px; }
.rec-k { font-size: 14px; color: var(--ink2); line-height: 1.5; }
.rec-k .date { display: block; color: var(--ink); font-weight: 700; font-size: 15px; font-variant-numeric: tabular-nums; }
.rec-k .kind { display: inline-block; margin-top: 2px; padding: 0 6px; border: 1px solid var(--line); border-radius: 2px; background: var(--card); }
.rec-k .kind.k-status { border-color: var(--ink); color: var(--ink); }
.rec-k .kind.k-past { border-style: dashed; }
.rec-body a { display: inline-flex; align-items: center; font-size: 15px; margin: 2px 0 0 -6px; }

.linkrow { display: flex; flex-wrap: wrap; gap: 0 14px; }
.linkrow a { display: inline-flex; align-items: center; min-height: 44px; min-width: 44px; padding: 0 4px; font-size: 15px; }
.src-list li { padding: 8px 0 6px; border-bottom: 1px solid var(--line2); }
.src-list li .use { display: block; color: var(--ink2); font-size: 14px; line-height: 1.5; }
.src-list a { display: inline-flex; align-items: center; min-height: 44px; padding: 0 4px; margin-left: -4px; }

.dl { border-top: 1px solid var(--line); }
.dl > div { display: grid; grid-template-columns: 6.5em minmax(0, 1fr); gap: 0 14px; padding: 9px 0; border-bottom: 1px solid var(--line); }
.dl dt { color: var(--ink2); font-size: 15px; }
.dl dd { min-width: 0; }
.missing { color: var(--ink2); }
.coord { font-variant-numeric: tabular-nums; }
.pos-tag { display: inline-block; padding: 0 8px; border: 1px solid var(--ink); font-size: 14px; font-weight: 700; letter-spacing: .08em; margin-right: 6px; }

.steps { counter-reset: st; }
.steps li { counter-increment: st; padding: 6px 0 6px 2.2em; position: relative; }
.steps li::before { content: counter(st); position: absolute; left: 0; top: 6px; font-family: var(--serif); font-weight: 700; color: var(--ink2); }
.plist { display: grid; grid-template-columns: minmax(0, 1fr); gap: 0 24px; border-top: 1px solid var(--line); }
.plist li { border-bottom: 1px solid var(--line); }
.plist a { display: flex; align-items: center; min-height: 48px; padding: 4px 4px; text-decoration: none; color: var(--ink); }
.plist a:hover { color: var(--link); text-decoration: underline; }
.pager { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 44px; border-top: 1px solid var(--ink); }
.pager a { display: block; min-height: 64px; padding: 12px 6px; text-decoration: none; color: var(--ink); }
.pager a:hover { background: var(--card); }
.pager .dir { display: block; font-size: 13px; color: var(--ink2); letter-spacing: .1em; }
.pager .nm { font-family: var(--serif); font-weight: 700; font-size: 19px; }
.pager .next { text-align: right; }
.window-lines { margin-top: 6px; }

/* sources page */
.edu-note { margin-top: 24px; padding: 18px 20px; border: 2px solid var(--ink); background: var(--card); font-family: var(--serif); font-weight: 700; font-size: 26px; letter-spacing: .08em; }
.toc { display: flex; flex-wrap: wrap; gap: 0 6px; margin-top: 14px; }
.toc a { display: inline-flex; align-items: center; min-height: 44px; padding: 0 10px; border: 1px solid var(--line); background: var(--card); text-decoration: none; color: var(--ink); font-size: 15px; }
.toc a:hover { border-color: var(--ink); }
.grid-table { width: 100%; border-collapse: collapse; font-size: 15px; }
.grid-table th, .grid-table td { text-align: left; padding: 8px 10px 8px 0; border-bottom: 1px solid var(--line); vertical-align: top; font-weight: 400; }
.grid-table thead th { font-size: 14px; color: var(--ink2); border-bottom: 1px solid var(--ink); font-weight: 500; }
.grid-table .gr { font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap; }
.grid-table thead th.gr { font-weight: 500; }
.grid-table a { display: inline-flex; align-items: center; min-height: 44px; padding: 0 2px; }
.tscroll { overflow-x: auto; }
.src-group + .src-group { margin-top: 22px; }
.src-group h3 { margin-top: 0; padding: 8px 0 4px; border-bottom: 1px solid var(--line); }

/* gentle entrance */
@keyframes rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
.rise { animation: rise .6s ease both; }
.rise.d1 { animation-delay: .08s; }
.rise.d2 { animation-delay: .16s; }
.rise.d3 { animation-delay: .24s; }
@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  .rise, .rise.d1, .rise.d2, .rise.d3 { animation: none; }
  .gk-lbl { transition: none; }
}

@media (min-width: 700px) {
  .wrap { padding: 0 28px; }
  .plist { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (min-width: 1000px) {
  .hero-grid { grid-template-columns: minmax(0, 6fr) minmax(0, 5fr); }
  .hero-side { padding-bottom: 6px; }
}
@media (min-width: 1100px) {
  .explorer { grid-template-columns: minmax(0, 5fr) minmax(0, 6fr); gap: 44px; align-items: start; }
  .map-pane { grid-column: 2; grid-row: 1; position: sticky; top: 12px; }
  .table-pane { grid-column: 1; grid-row: 1; }
  .map { height: calc(100vh - 150px); min-height: 440px; max-height: 760px; }
  .cols { grid-template-columns: minmax(0, 7fr) minmax(0, 4fr); gap: 56px; }
  .plist { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
@media (max-width: 760px) {
  .ruler { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .rs:nth-child(4) { border-left: 0; }
  .rs:nth-child(n+4) { border-top: 1px solid var(--line2); }
  .hero { padding-top: 26px; }
  .today-line .v { font-size: 20px; }
  .rs a { min-height: 92px; padding-inline: 8px; }
  .rs-name { font-size: 18px; }
  .facts > div, .dl > div, .records li { grid-template-columns: minmax(0, 1fr); }
  .facts dt, .dl dt { font-size: 14px; }
  .places td.area, .places thead th.area, col.c-area { display: none; }
  col.c-name { width: 58%; }
  col.c-stage { width: 42%; }
  .places .nm .sub { display: block; }
  .edu-note { font-size: 22px; }
  h2 { font-size: 22px; }
  .stage-link.big { font-size: 26px; }
}
@media (max-width: 420px) {
  .rs-name { font-size: 16px; }
  .rs a { padding-inline: 7px; }
}
@media (max-width: 380px) {
  .places .stage-link { padding: 0 2px; }
  .places .nm { padding-right: 4px; }
}"""

APP_JS = r"""/* 東京銀杏一年生長階段情報：共用腳本。由 sakura.py 產生，請改 sakura.py 而不是這個檔案。
 * 做兩件事：
 *   1. 依「你開啟頁面當天的日期」推估階段（氣象廳東京平年值），填進各頁的階段欄位。
 *   2. 首頁：用 Leaflet + OpenStreetMap 圖磚畫地圖；圖磚或 Leaflet 載入失敗時顯示說明，表格仍可使用。
 * 不使用 ES module，也不讀取本機檔案，所以直接雙擊 index.html 也能運作。 */
(function () {
  'use strict';
  var D = window.GINKGO_DATA;
  if (!D) { return; }
  var ROOT = document.body.getAttribute('data-root') || '';

  /* ---------- 階段模型 ---------- */
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }

  // 回傳 1..6。D = 氣象廳東京 いちょう黄葉日 平年值（11/23）；offsets 是各階段起點相對 D 的天數。
  function stageNumber(date) {
    var m = D.model;
    var y = date.getFullYear();
    var t = Date.UTC(y, date.getMonth(), date.getDate());
    var base = Date.UTC(y, m.baseMonth - 1, m.baseDay);
    var diff = Math.round((t - base) / 86400000);
    var n = 0;
    for (var i = 0; i < m.offsets.length; i++) {
      if (m.offsets[i] !== null && diff >= m.offsets[i]) { n = i + 1; }
    }
    if (n > 0) { return n; }
    // 早於 D-28：模型只涵蓋秋季。保守假設：1 月到 3 月仍是落葉，之後到 10/25 是青葉。
    return (date.getMonth() + 1) < m.springMonth ? 6 : 1;
  }

  var NOW = new Date();
  var ISO = ymd(NOW);
  var N = stageNumber(NOW);
  var ST = D.stages[N - 1];

  function stageHref(n) { return ROOT + 'stages/' + n + '.html'; }
  function placeHref(id) { return ROOT + 'places/' + id + '.html'; }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) { e.className = cls; }
    if (text !== undefined && text !== null) { e.textContent = text; }
    return e;
  }
  function each(list, fn) { Array.prototype.forEach.call(list, fn); }

  function fillStageLink(a, n) {
    var s = D.stages[n - 1];
    a.className = (a.className ? a.className.replace(/\bs[1-6]\b/g, '').trim() + ' ' : '') + 'stage-link s' + n;
    a.setAttribute('href', stageHref(n));
    a.setAttribute('title', s.ja + '（' + s.gloss + '）：依氣象廳東京平年值推估');
    a.textContent = '';
    a.appendChild(el('i', 'dot'));
    var t = el('span', null, s.ja);
    t.setAttribute('lang', 'ja');
    a.appendChild(t);
  }
  function fillInline(a, n) { fillStageLink(a, n); a.className += ' inline'; }

  each(document.querySelectorAll('[data-slot="today"]'), function (e) {
    e.textContent = ISO;
    if (e.tagName === 'TIME') { e.setAttribute('datetime', ISO); }
  });
  each(document.querySelectorAll('[data-slot="stage-name"]'), function (e) { e.textContent = ST.ja; });
  each(document.querySelectorAll('[data-slot="stage-gloss"]'), function (e) { e.textContent = ST.gloss; });
  each(document.querySelectorAll('a[data-slot="stage-link"]'), function (a) { fillStageLink(a, N); });
  each(document.querySelectorAll('td[data-stage-cell]'), function (td) {
    var a = el('a');
    a.setAttribute('data-slot', 'stage-link');
    fillStageLink(a, N);
    td.appendChild(a);
  });
  each(document.querySelectorAll('.verdict'), function (v) { v.classList.add('s' + N); });
  each(document.querySelectorAll('.ruler .rs'), function (li) {
    if (parseInt(li.getAttribute('data-stage'), 10) === N) { li.classList.add('is-now'); }
  });

  /* ---------- 階段頁：今天是否屬於此階段、目前在此階段的地點 ---------- */
  var pageStage = parseInt(document.body.getAttribute('data-stage') || '0', 10);
  if (pageStage) {
    var status = document.getElementById('stage-status');
    if (status) {
      status.textContent = '';
      status.appendChild(document.createTextNode('依今天（' + ISO + '）的日期，並依氣象廳東京平年值推估：'));
      if (pageStage === N) {
        status.appendChild(el('strong', null, '東京的銀杏現在就在這個階段。'));
      } else {
        status.appendChild(document.createTextNode('東京的銀杏目前在「'));
        var link = el('a');
        fillInline(link, N);
        status.appendChild(link);
        status.appendChild(document.createTextNode('」，不在這個階段。'));
      }
    }
    var list = document.getElementById('stage-places');
    var empty = document.getElementById('stage-places-empty');
    if (list && empty) {
      if (pageStage === N) {
        list.hidden = false;
        empty.hidden = true;
        var c = document.getElementById('stage-places-count');
        if (c) { c.textContent = String(D.places.length); }
      } else {
        list.hidden = true;
        empty.hidden = false;
        var where = document.getElementById('stage-places-now');
        if (where) { where.textContent = ''; var l2 = el('a'); fillInline(l2, N); where.appendChild(l2); }
      }
    }
  }

  /* ---------- 首頁地圖 ---------- */
  function initMap() {
    var box = document.getElementById('map');
    if (!box) { return; }
    var msg = box.querySelector('.map-msg');
    if (typeof window.L === 'undefined') {
      box.classList.add('map-failed');
      if (msg) { msg.textContent = '地圖元件沒有載入成功（可能是網路限制）。所有地點的位置與階段，仍可在「地點彙整」表格與各地點頁面查看。'; }
      var hint = document.getElementById('map-hint-text');
      if (hint) { hint.textContent = '地圖暫時無法使用。'; }
      return;
    }
    var L = window.L;
    if (msg) { msg.parentNode.removeChild(msg); }
    var notice = document.getElementById('map-notice');

    var map = L.map(box, { trackResize: false, zoomControl: false, minZoom: 8, maxZoom: 18, zoomSnap: 0.5 });
    L.control.zoom({ zoomInTitle: '放大地圖', zoomOutTitle: '縮小地圖' }).addTo(map);
    map.setView([35.69, 139.6], 10);
    map.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noopener noreferrer">Leaflet</a>');

    var tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>'
    }).addTo(map);

    var loaded = 0, failed = 0, noticeShown = false;
    function showNotice() {
      if (noticeShown || !notice) { return; }
      noticeShown = true;
      notice.hidden = false;
    }
    tiles.on('tileload', function () {
      loaded++;
      if (noticeShown && notice) { notice.hidden = true; noticeShown = false; }
    });
    tiles.on('tileerror', function () {
      failed++;
      if (loaded === 0 && failed >= 3) { showNotice(); }
    });
    window.setTimeout(function () { if (loaded === 0) { showNotice(); } }, 9000);

    function esc(s) {
      return String(s).replace(/[&<>"']/g, function (ch) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
      });
    }

    function popupFor(p) {
      var wrap = el('div', 'gk-pop');
      var a = el('a', 'pop-name', p.ja);
      a.setAttribute('href', placeHref(p.id));
      a.setAttribute('lang', 'ja');
      wrap.appendChild(a);
      wrap.appendChild(el('div', 'pop-line', p.area));
      var row = el('div', 'pop-line');
      row.appendChild(document.createTextNode('銀杏現況：'));
      var s = el('a');
      fillStageLink(s, N);
      row.appendChild(s);
      wrap.appendChild(row);
      wrap.appendChild(el('div', 'pop-line', '依氣象廳東京平年值推估'));
      wrap.appendChild(el('div', 'pop-line', '判定日期 ' + ISO));
      wrap.appendChild(el('div', 'pop-line', '近似位置：' + p.pos));
      return wrap;
    }

    var markers = [];
    var latlngs = [];
    D.places.forEach(function (p) {
      var icon = L.divIcon({
        className: 'gk-marker s' + N,
        html: '<span class="gk-pin"></span><span class="gk-lbl"><b>' + esc(p.ja) + '</b><i>' + esc(ST.ja) + '</i></span>',
        iconSize: [44, 44],
        iconAnchor: [22, 22],
        popupAnchor: [0, -16]
      });
      var m = L.marker([p.lat, p.lng], { icon: icon, title: p.ja + '（' + ST.ja + '，推估）', keyboard: true, riseOnHover: true });
      m.bindPopup(function () { return popupFor(p); }, { maxWidth: 270, minWidth: 180, autoPanPadding: [12, 12] });
      m.addTo(map);
      m._gkPlace = p;
      markers.push(m);
      latlngs.push([p.lat, p.lng]);
    });
    var bounds = L.latLngBounds(latlngs);

    var focused = null;
    function labelOf(m) { var e = m.getElement(); return e ? e.querySelector('.gk-lbl') : null; }
    markers.forEach(function (m) {
      m.on('popupopen', function (ev) {
        focused = m;
        var close = ev.popup.getElement() && ev.popup.getElement().querySelector('.leaflet-popup-close-button');
        if (close) { close.setAttribute('aria-label', '關閉視窗'); close.setAttribute('title', '關閉視窗'); }
        schedule();
      });
      m.on('popupclose', function () { if (focused === m) { focused = null; } });
    });

    /* 標籤避讓：只顯示不互相重疊的標籤，放大後會出現更多；點標記一定看得到完整資訊。 */
    var sizes = {};
    function layoutLabels() {
      var mapSize = map.getSize();
      var rects = [];
      var items = markers.map(function (m) {
        var pt = map.latLngToContainerPoint(m.getLatLng());
        rects.push([pt.x - 12, pt.y - 12, pt.x + 12, pt.y + 12]);
        return { m: m, x: pt.x, y: pt.y };
      });
      function hit(r) {
        for (var i = 0; i < rects.length; i++) {
          var q = rects[i];
          if (r[0] < q[2] + 2 && r[2] > q[0] - 2 && r[1] < q[3] + 2 && r[3] > q[1] - 2) { return true; }
        }
        return false;
      }
      items.sort(function (a, b) { return (b.m === focused) - (a.m === focused); });
      items.forEach(function (it) {
        var lbl = labelOf(it.m);
        if (!lbl) { return; }
        var id = it.m._gkPlace.id;
        if (!sizes[id]) { sizes[id] = { w: lbl.offsetWidth, h: lbl.offsetHeight }; }
        var w = sizes[id].w, h = sizes[id].h;
        var right = [it.x + 14, it.y - h / 2, it.x + 14 + w, it.y + h / 2];
        var left = [it.x - 14 - w, it.y - h / 2, it.x - 14, it.y + h / 2];
        var chosen = null, isLeft = false;
        [right, left].some(function (r, idx) {
          var inside = r[0] >= 4 && r[2] <= mapSize.x - 4 && r[1] >= 4 && r[3] <= mapSize.y - 4;
          if (inside && !hit(r)) { chosen = r; isLeft = idx === 1; return true; }
          return false;
        });
        if (chosen) {
          rects.push(chosen);
          lbl.classList.remove('is-off');
          lbl.classList.toggle('is-left', isLeft);
        } else {
          lbl.classList.add('is-off');
        }
      });
    }
    var pending = false;
    function schedule() {
      if (pending) { return; }
      pending = true;
      window.requestAnimationFrame(function () { pending = false; layoutLabels(); });
    }

    /* 視窗大小變化：trackResize 關閉，改由 ResizeObserver 處理；忽略 0x0（地圖被隱藏時）。 */
    var ref = null;
    function refit() {
      if (focused && focused.isPopupOpen()) {
        var z = map.getZoom();
        map.setView(focused.getLatLng(), z, { animate: false });
        focused.openPopup();
      } else {
        map.fitBounds(bounds, { padding: [52, 52], animate: false });
      }
    }
    function handleSize(w, h) {
      if (!w || !h) { return; }
      map.invalidateSize({ animate: false });
      var big = !ref ||
        Math.abs(w - ref.w) > ref.w * 0.25 ||
        Math.abs(h - ref.h) > ref.h * 0.25 ||
        ((w >= h) !== (ref.w >= ref.h));
      if (big) { ref = { w: w, h: h }; refit(); }
      schedule();
    }
    if (box.clientWidth && box.clientHeight) { handleSize(box.clientWidth, box.clientHeight); }
    if (typeof window.ResizeObserver === 'function') {
      var ro = new window.ResizeObserver(function (entries) {
        var r = entries[0].contentRect;
        handleSize(r.width, r.height);
      });
      ro.observe(box);
    }
    window.addEventListener('resize', function () { handleSize(box.clientWidth, box.clientHeight); });
    window.addEventListener('orientationchange', function () {
      window.setTimeout(function () { handleSize(box.clientWidth, box.clientHeight); }, 250);
    });
    map.on('zoomend moveend', schedule);
    // Esc 關閉彈出視窗（焦點在標記上時 Leaflet 不會處理這個按鍵）
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && focused) { map.closePopup(); }
    });
    schedule();
  }

  initMap();
})();"""

# ----------------------------------------------------------------------------
# 4. HTML 產生
# ----------------------------------------------------------------------------
LEAF_PATH = ("M12 21.2V14M12 14C8 13.6 3.4 10.6 2.8 4.8c2.2 1.2 4.4 1.6 6.4.6L12 8l2.8-2.6c2 1 4.2.6 6.4-.6C20.6 10.6 16 13.6 12 14zM12 14L7.4 7.4M12 14V9M12 14l4.6-6.6")
LEAF_SVG = ('<svg class="mark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" '
            'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="%s"/></svg>' % LEAF_PATH)
FAVICON = "data:image/svg+xml," + quote(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#4c8a56" stroke-width="1.8" '
    'stroke-linecap="round" stroke-linejoin="round"><path d="%s"/></svg>' % LEAF_PATH, safe="")
LEAFLET_CSS = ('<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" '
               'integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="">')
LEAFLET_JS = ('<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" '
              'integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>')
FONTS = ('<link rel="preconnect" href="https://fonts.googleapis.com">'
         '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
         '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700'
         '&family=Noto+Serif+TC:wght@700&display=swap">')


def e(s):
    return html.escape(str(s), quote=True)


def safe_url(u):
    return quote(u, safe=":/?#[]@!$&'()*+,;=%~")


def ja(text):
    return '<span lang="ja">%s</span>' % e(text)


def ext(url, label, cls=""):
    c = (' class="%s"' % cls) if cls else ""
    return ('<a href="%s" target="_blank" rel="noopener noreferrer"%s>%s<span class="sr-only">（外部網站，另開新分頁）</span></a>'
            % (safe_url(url), c, e(label)))


def href_place(pid, root):
    return "%splaces/%s.html" % (root, pid)


def href_stage(n, root):
    return "%sstages/%d.html" % (root, n)


def layout(*, title, description, body, root="", kind="inner", head_extra="", foot_extra="", attrs=""):
    full_title = title if title == SITE_NAME else "%s｜%s" % (title, SITE_NAME)
    return """<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="description" content="{desc}">
<meta name="theme-color" content="#f3f5f1">
<link rel="icon" href="{icon}">
{fonts}
{head_extra}<link rel="stylesheet" href="{root}style.css">
</head>
<body class="page-{kind}" data-root="{root}"{attrs}>
<a class="skip" href="#main">跳到主要內容</a>
<header class="site-head">
<div class="wrap head-in">
<a class="brand" href="{root}index.html">{leaf}<span>{brand}</span></a>
<span class="head-note">教學使用，非營利</span>
</div>
</header>
<main id="main">
{body}
</main>
<footer class="site-foot">
<div class="wrap">
<div class="foot-main">
<a class="foot-src" href="{root}sources.html">資料來源</a>
<p>階段為依氣象廳東京平年值的推估，不是各地點的現場觀測。教學使用，非營利。</p>
</div>
<p class="foot-small">地圖圖磚：&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>。資料查核日 {checked}（資料表快照 {sheet_date}）。</p>
</div>
</footer>
<script src="{root}data.js"></script>
{foot_extra}<script src="{root}app.js"></script>
</body>
</html>
""".format(title=e(full_title), desc=e(description), icon=FAVICON, fonts=FONTS, head_extra=head_extra, root=root,
           kind=kind, attrs=attrs, leaf=LEAF_SVG, brand=e(BRAND), body=body, foot_extra=foot_extra,
           checked=CHECKED_ON, sheet_date=SHEET_DATE)


def ruler(root, current=None):
    items = []
    for s in STAGES:
        n = s["n"]
        cur = ' aria-current="page"' if current == n else ""
        items.append(
            '<li class="rs s%d" data-stage="%d"><a href="%s"%s><span class="rs-bar" aria-hidden="true"></span>'
            '<span class="rs-name" lang="ja">%s</span><span class="rs-date">%s</span>'
            '<span class="rs-now">今日</span></a></li>'
            % (n, n, href_stage(n, root), cur, e(s["ja"]), e(s["window"])))
    return '<ol class="ruler" aria-label="銀杏的六個生長階段與推估期間">%s</ol>' % "".join(items)


def basis_sentence():
    return ("氣象廳（JMA）東京的「いちょう黄葉日」平年值 11/23 與「いちょう落葉日」平年值 12/3（1991–2020）。"
            "見頃從 11/23 起、落葉從 12/3 起，其餘邊界是示意參數（11/23 的前 28 日、前 14 日、後 6 日）。")


# ---------------------------------------------------------------- 首頁
def render_index():
    rows = []
    for p in PLACES:
        zh = ('<span class="zh">%s</span>' % e(p["zh"])) if p["zh"] else ""
        rows.append(
            '<tr><th scope="row"><a class="nm" href="%s">%s%s<span class="sub">%s</span></a></th>'
            '<td class="area">%s</td><td class="stage" data-stage-cell></td></tr>'
            % (href_place(p["id"], ""), ja(p["ja"]), zh, e(p["area"]), e(p["area"])))
    body = """<div class="wrap">
<section class="hero" aria-labelledby="top-h">
<div class="hero-grid">
<div class="hero-main">
<p class="eyebrow rise">東京都內 26 處銀杏觀賞地點</p>
<h1 id="top-h" class="rise d1">東京銀杏<br>一年生長階段情報</h1>
<p class="lede rise d2">青葉、色づき始め、黄葉進行、見頃、落葉始め、落葉。把東京各地的銀杏放在這六個階段上，並在每個地點頁附上判定日期、依據與該地點自己的官方資料。</p>
</div>
<div class="hero-side rise d3">
<div class="today-line">
<span class="k">今日</span><span class="v"><time data-slot="today"></time></span>
<span class="k">推估階段</span><span class="v"><a data-slot="stage-link" href="stages/1.html">青葉</a></span>
</div>
<p class="basis-note">階段依氣象廳東京平年值推估，在你開啟頁面時依當天日期計算。26 處地點共用同一個推估，並不是各地點的現場觀測；過去年度的官方紀錄只會以有日期的歷史資料顯示。</p>
</div>
</div>
{ruler}
</section>
<div class="explorer">
<section class="map-pane" aria-labelledby="map-h">
<div class="pane-h"><h2 id="map-h">地圖</h2><span class="meta">圖磚：OpenStreetMap</span></div>
<div class="map-wrap">
<div id="map" class="map" role="region" aria-label="東京銀杏地點地圖"><p class="map-msg">地圖載入中⋯⋯</p><noscript><p class="map-msg">需要啟用 JavaScript 才能顯示地圖；地點與階段請看表格。</p></noscript></div>
<div id="map-notice" class="map-notice" role="status" hidden>地圖底圖暫時無法載入，標記仍在原來的位置。你可以改用下方的「地點彙整」表格，或點進各地點頁面查看。</div>
</div>
<p class="map-hint"><span id="map-hint-text">圓點是地點的近似位置，不是銀杏樹的精確座標。放大地圖會顯示更多地點名稱，點標記可看詳細資訊。</span><a class="skiptable" href="#table-h">跳到地點彙整</a></p>
</section>
<section class="table-pane" aria-labelledby="table-h">
<div class="pane-h"><h2 id="table-h">地點彙整</h2><span class="meta">共 26 處</span></div>
<p class="table-note">「銀杏現況」欄依氣象廳東京平年值推估，26 處共用同一個階段。點地點名稱看詳細介紹，點階段看該階段的說明。</p>
<div class="tbl-wrap">
<table class="places">
<caption class="sr-only">東京銀杏觀賞地點與推估的銀杏現況</caption>
<colgroup><col class="c-name"><col class="c-area"><col class="c-stage"></colgroup>
<thead><tr><th scope="col">地點名稱</th><th scope="col" class="area">所在區域</th><th scope="col">銀杏現況<small>依氣象廳東京平年值推估</small></th></tr></thead>
<tbody>
{rows}
</tbody>
</table>
<noscript><p class="table-note">需要啟用 JavaScript，才能依今天的日期顯示推估階段。階段與期間請見各階段頁面。</p></noscript>
</div>
</section>
</div>
</div>""".format(leaf=LEAF_PATH, ruler=ruler(""), rows="\n".join(rows))
    return layout(
        title=SITE_NAME,
        description="東京 26 處銀杏觀賞地點的一年生長階段（青葉到落葉）：依氣象廳東京平年值推估，附地圖、地點彙整與資料來源。",
        body=body, root="", kind="home", head_extra=LEAFLET_CSS + "\n", foot_extra=LEAFLET_JS + "\n")


# ---------------------------------------------------------------- 階段頁
def judge_steps():
    return """<ol class="steps">
<li>取氣象廳東京的「いちょう黄葉日」平年值 11/23 當作基準日 D。</li>
<li>見頃從 D 開始；落葉從「いちょう落葉日」平年值 12/3（D+10）開始。</li>
<li>其餘邊界是示意參數：色づき始め從 D−28、黄葉進行從 D−14、落葉始め從 D+6。</li>
<li>瀏覽器依「你開啟頁面當天的日期」算出階段。1 月到 3 月沿用落葉，4 月 1 日起到 10/25 是青葉（保守假設）。</li>
<li>26 處地點共用同一個推估，不編造地點之間的差異。</li>
</ol>"""


def render_stage(s):
    n = s["n"]
    root = "../"
    prev_s = STAGES[n - 2] if n > 1 else None
    next_s = STAGES[n] if n < 6 else None
    hist = ""
    if s["history"]:
        lis = "".join(
            '<li><div class="rec-k"><span class="date">%s</span><span class="kind k-past">往年度紀錄</span></div>'
            '<div class="rec-body"><p>%s</p>%s</div></li>' % (e(d), e(t), ext(u, source_label(u)))
            for d, t, u in s["history"])
        hist = '<ul class="records">%s</ul>' % lis
    else:
        hist = '<p class="missing">目前沒有已核實的往年官方紀錄可以放在這一階段。</p>'
    place_links = "".join(
        '<li><a href="%s">%s</a></li>' % (href_place(p["id"], root), ja(p["ja"])) for p in PLACES)
    pager = '<nav class="pager" aria-label="上一個與下一個階段">%s%s</nav>' % (
        ('<a class="prev" href="%s"><span class="dir">上一個階段</span><span class="nm" lang="ja">%s</span></a>' % ("%d.html" % prev_s["n"], e(prev_s["ja"]))) if prev_s else "<span></span>",
        ('<a class="next" href="%s"><span class="dir">下一個階段</span><span class="nm" lang="ja">%s</span></a>' % ("%d.html" % next_s["n"], e(next_s["ja"]))) if next_s else "<span></span>")
    kind_note = {"氣象廳平年值": "這個起點直接取自氣象廳東京的平年值。",
                 "示意參數": "這個起點是示意參數（離氣象廳平年值的固定天數），不是觀測值。",
                 "假設": "春季的發芽日期不在氣象廳平年值的範圍內，4/1 是本站的保守假設，不是觀測值。"}[s["edge_kind"]]
    body = """<div class="wrap">
<nav class="crumbs" aria-label="麵包屑"><ol><li><a href="{root}index.html">首頁</a></li><li>生長階段</li><li aria-current="page">{ja}</li></ol></nav>
<header class="page-head s{n} rise">
<p class="eyebrow">銀杏的生長階段　{n} / 6</p>
<h1><i class="dot" aria-hidden="true"></i><span lang="ja">{ja}</span></h1>
<p class="alt"><span class="yomi" lang="ja">{yomi}</span>　{gloss}</p>
</header>
{ruler}
<p id="stage-status" class="estimate" role="status">依氣象廳東京平年值推估；今天屬於哪個階段，需要啟用 JavaScript 才能計算。</p>
<div class="cols">
<div class="main">
<section><h2>這個階段看起來像什麼</h2>{look}</section>
<section><h2>推估期間</h2>
<dl class="dl">
<div><dt>期間</dt><dd><strong>{full}</strong>（每年相同，因為是用平年值換算）</dd></div>
<div><dt>起點的性質</dt><dd>{edge}。{kind_note}</dd></div>
<div><dt>注意</dt><dd>這是依氣象廳東京平年值的推估。近年東京的黃葉日有明顯起伏（2023 年 12/1、2024 年 12/3、2025 年 11/22），實際季節可能前後差約一週。</dd></div>
</dl></section>
<section><h2>目前在此階段的地點</h2>
<div id="stage-places" hidden>
<p>依今天的日期推估，下面 <strong id="stage-places-count">26</strong> 處地點都在這個階段。它們共用同一個推估，沒有逐地點的差異。</p>
<ul class="plist" style="margin-top:12px">{place_links}</ul>
</div>
<p id="stage-places-empty">目前沒有地點屬於這個階段。依氣象廳東京平年值推估，所有地點目前都在「<span id="stage-places-now"></span>」。</p>
</section>
<section><h2>往年的相關紀錄（有日期的歷史資料）</h2>
<p>下面是過去的官方紀錄，只用來說明這個階段在往年大約長什麼樣子，不代表今年的現況；日期也不能直接套用到今年。</p>
{hist}</section>
</div>
<div class="side">
<section><h2>判定方式</h2>{steps}
<div class="linkrow"><a href="{root}sources.html#jma">氣象廳資料與其他來源</a></div></section>
</div>
</div>
{pager}
</div>""".format(root=root, ja=e(s["ja"]), n=n, yomi=e(s["yomi"]), gloss=e(s["gloss"]), ruler=ruler(root, current=n),
                 look="".join("<p>%s</p>" % e(t) for t in s["look"]), full=e(s["full"]), edge=e(s["edge"]),
                 kind_note=e(kind_note), place_links=place_links, hist=hist, steps=judge_steps(), pager=pager)
    return layout(title="%s（%s）" % (s["ja"], s["gloss"]),
                  description="銀杏生長階段「%s」：外觀、推估期間（%s）、判定方式與往年的相關紀錄。" % (s["ja"], s["full"]),
                  body=body, root=root, kind="stage", attrs=' data-stage="%d"' % n)


# ---------------------------------------------------------------- 地點頁
def osm_link(lat, lng):
    return "https://www.openstreetmap.org/?mlat=%s&mlon=%s#map=17/%s/%s" % (lat, lng, lat, lng)


def ref_label(url):
    u = urlparse(url)
    host = u.netloc.lower()
    if "openstreetmap.org" in host:
        m = re.match(r"/(node|way|relation)/(\d+)", u.path)
        return "OpenStreetMap %s %s" % (m.group(1), m.group(2)) if m else "OpenStreetMap"
    if "wikipedia.org" in host:
        return "ja.wikipedia 條目"
    if "weathernews.jp" in host:
        return "Weathernews 景點頁"
    if "jorudan.co.jp" in host:
        return "Jorudan 景點頁"
    return "官方頁面（%s）" % host.replace("www.", "")


def source_label(u):
    return "官方出處（%s）" % urlparse(u).netloc.replace("www.", "")


def records_html(p):
    first_text = re.sub(r"^%s 查核[：:]?" % CHECKED_ON, "", p["status"])
    recs = [(CHECKED_ON, "status", first_text, p["status_url"], True)]
    for d, k, t, u in p["records"]:
        recs.append((d, k, t, u, False))
    recs.sort(key=lambda r: r[0], reverse=True)  # 新的日期在前；沒有日期的排最後
    recs.sort(key=lambda r: (KIND_ORDER[r[1]], 0 if r[4] else 1))
    lis = []
    for d, k, t, u, first in recs:
        date_txt = ("%s 查核" % d) if first else (d if d else "無日期")
        lis.append('<li><div class="rec-k"><span class="date">%s</span><span class="kind k-%s">%s</span></div>'
                   '<div class="rec-body"><p>%s</p>%s</div></li>' % (e(date_txt), k, e(KIND_LABEL[k]), e(t), ext(u, source_label(u))))
    return '<ul class="records">%s</ul>' % "".join(lis)


def dl_row(label, value):
    if value:
        v = e(value)
    else:
        v = '<span class="missing">資料未提供（官方頁面沒有記載）</span>'
    return "<div><dt>%s</dt><dd>%s</dd></div>" % (e(label), v)


def render_place(p):
    root = "../"
    g = p["geo"]
    sh = p["sheet"]
    kind = p["kind"]
    v = p["visit"]
    zh_line = ('<p class="alt">%s</p>' % e(p["zh"])) if p["zh"] else ""
    maxd = g["maxdist"]
    spread = ("參考來源的座標與此點最遠相差約 %d 公尺。" % maxd) if maxd else "此點只有單一座標來源，沒有可交叉比對的差距。"
    refs = "".join(ext(u, ref_label(u)) for u in g["refs"])
    caution = ('<p class="caution"><b>注意　</b>%s</p>' % e(p["caution"])) if p.get("caution") else ""
    posnote = dl_row("補充說明", p.get("posnote")) if p.get("posnote") else ""
    src_items = "".join(
        '<li>%s<span class="use">%s</span></li>' % (ext(u, label), e(use)) for label, u, use in p["sources"])
    ev = ext(sh["evidence_url"], "資料表所載的證據頁面") if sh.get("evidence_url") else ""
    visit_note = dl_row("備註", v.get("note")) if v.get("note") else ""
    body = """<div class="wrap">
<nav class="crumbs" aria-label="麵包屑"><ol><li><a href="{root}index.html">首頁</a></li><li>觀賞地點</li><li aria-current="page">{ja_plain}</li></ol></nav>
<header class="page-head rise">
<p class="eyebrow">{area}</p>
<h1 lang="ja">{ja_plain}</h1>
{zh_line}
</header>
<section class="verdict" aria-labelledby="v-h">
<h2 id="v-h">銀杏現況（推估）</h2>
<div class="big-row"><a class="stage-link big" data-slot="stage-link" href="{root}stages/1.html">青葉</a><span class="tag">依氣象廳東京平年值推估</span></div>
<dl class="facts">
<div><dt>判定日期</dt><dd><time data-slot="today"></time>（你開啟此頁當天的日期）</dd></div>
<div><dt>判定依據</dt><dd>{basis}</dd></div>
<div><dt>這個地點的資料</dt><dd>下方「{ja_plain}自己的最新資料」列出此地點官方來源的日期與內容（{checked} 查核）。</dd></div>
</dl>
<p class="estimate">這是東京共通的季節推估，不是{ja_plain}的現場觀測。26 處地點共用同一個推估，沒有逐地點的差異。</p>
<noscript><p class="estimate">需要啟用 JavaScript，才能依今天的日期顯示推估階段；階段與期間請見各階段頁面。</p></noscript>
{ruler}
</section>
<div class="cols">
<div class="main">
<section><h2>簡介</h2><p>{intro}</p></section>
<section><h2>銀杏與官方資料</h2><p>{ginkgo}</p>{caution}</section>
<section><h2>{ja_plain}自己的最新資料</h2>
<p>下面依性質分類並標示日期。<strong>往年度紀錄與無日期的介紹，都不是今年的現況。</strong></p>
{records}</section>
<section><h2>參觀資訊</h2>
<dl class="dl">
{r_address}{r_access}{r_hours}{r_closed}{r_fee}{r_note}
</dl>
<p class="missing" style="margin-top:8px">以官方頁面 {checked} 的內容為準；實際前往前請再確認官方公告。</p></section>
</div>
<div class="side">
<section><h2>位置與精度</h2>
<p><span class="pos-tag">近似位置</span>{pos_explain}</p>
<dl class="dl" style="margin-top:12px">
{r_poslabel}<div><dt>座標</dt><dd class="coord">北緯 {lat:.4f}°、東經 {lng:.4f}°（WGS84，四位小數）</dd></div>
<div><dt>來源差距</dt><dd>{spread}</dd></div>
{r_posnote}
</dl>
<div class="linkrow">{osm}</div>
<h3>位置依據</h3>
<div class="linkrow">{refs}</div>
</section>
<section><h2>資料表記載</h2>
<dl class="dl">
{r_sid}{r_grade}{r_op}<div><dt>證據日期</dt><dd>{evdate}　{ev}</dd></div>{r_finding}{r_caveat}
</dl></section>
<section><h2>本地點的資料來源</h2>
<ul class="src-list">{src_items}</ul>
<div class="linkrow"><a href="{root}sources.html">全站資料來源</a></div></section>
</div>
</div>
</div>""".format(
        root=root, ja_plain=e(p["ja"]), area=e(p["area"]), zh_line=zh_line, basis=e(basis_sentence()), checked=CHECKED_ON,
        ruler=ruler(root), intro=e(p["intro"]), ginkgo=e(p["ginkgo"]), caution=caution, records=records_html(p),
        r_address=dl_row("地址", v.get("address")), r_access=dl_row("交通", v.get("access")),
        r_hours=dl_row("開放時間", v.get("hours")), r_closed=dl_row("休園日・公休日", v.get("closed")),
        r_fee=dl_row("費用", v.get("fee")), r_note=visit_note,
        pos_explain=e(POS_EXPLAIN[kind]), r_poslabel=dl_row("標示點", p["poslabel"]), lat=g["lat"], lng=g["lng"],
        spread=e(spread), r_posnote=posnote, osm=ext(osm_link(g["lat"], g["lng"]), "在 OpenStreetMap 開啟這個位置"),
        refs=refs, r_sid=dl_row("來源識別碼", p["sid"]),
        r_grade=dl_row("等級", "%s（%s）" % (sh["grade"], GRADES[sh["grade"]])), r_op=dl_row("管理單位", sh["operator"]),
        evdate=e(sh["evidence_date"]), ev=ev, r_finding=dl_row("資料表的發現", sh["finding"]),
        r_caveat=dl_row("資料表的注意", sh["caveat"]), src_items=src_items)
    return layout(title=p["ja"],
                  description="%s（%s）的銀杏：依氣象廳東京平年值推估的階段、判定日期與依據，以及此地點的官方資料、位置精度與參觀資訊。" % (p["ja"], p["area"]),
                  body=body, root=root, kind="place", attrs=' data-place="%s"' % p["id"])


# ---------------------------------------------------------------- 資料來源頁
def place_by_sid():
    m = {}
    for p in PLACES:
        m.setdefault(p["sid"], []).append(p)
    return m


def render_sources():
    root = ""
    by = place_by_sid()
    # 活頁簿 41 列
    rows = []
    for sid in sorted(SHEET):
        r = SHEET[sid]
        if sid in by:
            names = "、".join('<a href="%s">%s</a>' % (href_place(p["id"], root), e(p["ja"])) for p in by[sid])
            use = "<strong>地點頁面</strong>：" + names
        elif sid in SHEET_USE:
            tag, txt = SHEET_USE[sid]
            use = "<strong>%s</strong>：%s" % (e(tag), e(txt))
        else:
            use = ""
        rows.append('<tr><td class="gr">%s</td><td>%s</td><td class="gr">%s</td><td>%s</td></tr>' % (e(sid), e(r["name"]), e(r["grade"]), use))
    # 氣象廳
    jma = "".join('<li>%s<span class="use">%s</span></li>' % (ext(u, label), e(use)) for label, u, use in JMA_SOURCES)
    # 各地點
    groups = []
    for p in PLACES:
        items = "".join('<li>%s<span class="use">%s</span></li>' % (ext(u, label), e(use)) for label, u, use in p["sources"])
        sh = p["sheet"]
        groups.append(
            '<div class="src-group"><h3><a href="%s">%s</a>　<span class="missing">%s・等級 %s</span></h3><ul class="src-list">%s</ul></div>'
            % (href_place(p["id"], root), e(p["ja"]), e(p["sid"]), e(sh["grade"]), items))
    # 位置依據
    pos = []
    for p in PLACES:
        refs = "".join(ext(u, ref_label(u)) for u in p["geo"]["refs"])
        pos.append('<div class="src-group"><h3>%s</h3><div class="linkrow">%s</div></div>' % (e(p["ja"]), refs))
    grade_rows = "".join('<tr><td class="gr">%s</td><td>%s</td></tr>' % (k, e(v)) for k, v in GRADES.items())
    body = """<div class="wrap">
<nav class="crumbs" aria-label="麵包屑"><ol><li><a href="index.html">首頁</a></li><li aria-current="page">資料來源</li></ol></nav>
<p class="edu-note rise">教學使用，非營利</p>
<header class="page-head">
<h1>資料來源</h1>
<p class="alt">本站使用的活頁簿、氣象廳資料、各地點的官方頁面與位置依據，以及它們各自的用途。</p>
</header>
<nav class="toc" aria-label="本頁目錄">
<a href="#sheet">活頁簿</a><a href="#jma">階段推估的基準</a><a href="#places">各地點的官方來源</a><a href="#position">位置依據</a><a href="#tech">地圖與程式庫</a><a href="#honesty">資料原則</a>
</nav>
<div class="stack" style="margin-top:28px">
<section id="sheet"><h2>活頁簿：{sheet_file}</h2>
<p>快照日期 {sheet_date}，共 41 列來源。本站先讀欄位、等級、證據日期、發現與注意事項，再整理成網站資料；下表列出每一列在本站的用途。外部來源的連結只放在實際使用的列；「未採用」與「排除」的列不附連結。共用查證（官方頁面逐一開啟核對）的日期是 {checked}。</p>
<div class="tscroll"><table class="grid-table">
<thead><tr><th scope="col" class="gr">識別碼</th><th scope="col">名稱</th><th scope="col" class="gr">等級</th><th scope="col">在本站的用途</th></tr></thead>
<tbody>{rows}</tbody></table></div>
<h3>等級的意思</h3>
<table class="grid-table"><tbody>{grade_rows}</tbody></table>
</section>
<section id="jma"><h2>階段推估的基準：氣象廳</h2>
<p>資料表與官方頁面都沒有 2026 年各地點的銀杏階段，所以本站用氣象廳東京的平年值（1991–2020）推估共通階段：見頃從 11/23 起、落葉從 12/3 起，其餘邊界為示意參數。氣象廳的黃葉日與落葉日是標本木的觀測定義（黃葉日＝大部分的葉子變黃的第一天；落葉日＝約 80% 的葉子掉落的第一天），不是各公園的最佳觀賞日。氣象廳 2026 年的東京黃葉日與落葉日在 {checked} 都尚未觀測。</p>
<ul class="src-list">{jma}</ul></section>
<section id="places"><h2>各地點的官方來源</h2>
<p>每個地點頁面只列該地點自己的來源，並區分本年度葉況、往年度紀錄、無日期的介紹與活動日期。以下是全部的整理。</p>
{groups}</section>
<section id="position"><h2>位置依據</h2>
<p>座標以 OpenStreetMap（Nominatim）為主，並與 ja.wikipedia、Weathernews、Jorudan 的景點座標及官方頁面文字交叉核對，取到小數第四位（約 10 公尺）。所有點都標示為「近似位置」，不是銀杏樹的精確座標；大型園區與線狀並木另在地點頁說明位置精度。這些第三方網站只用來核對座標，不用來判定銀杏階段。</p>
{pos}</section>
<section id="tech"><h2>地圖與程式庫</h2>
<ul class="src-list">
<li>{osm}<span class="use">地圖圖磚（tile.openstreetmap.org），依圖磚使用規範標示著作權；圖磚載入失敗時顯示說明，不改用其他底圖。</span></li>
<li>{leaflet}<span class="use">Leaflet 1.9.4，互動式地圖。</span></li>
<li>{fonts}<span class="use">Noto Sans TC、Noto Serif TC 字型。</span></li>
</ul></section>
<section id="honesty"><h2>資料原則</h2>
<ul class="src-list">
<li>階段是推估，每個出現階段的地方都標示「依氣象廳東京平年值推估」與判定日期。</li>
<li>過去年度的官方紀錄只以有日期的歷史資料顯示，不當作現況；活動日期（例如祭典、點燈）不是見頃日期。</li>
<li>保留資料表的區分：小石川植物園不是小石川後樂園；皇居東御苑不是皇居外苑；北の丸公園只標示公園本身；本鄉與駒場是兩個不同的校區。</li>
<li>沒有資料的欄位顯示「資料未提供」，不編造日期、時間、距離或費用。</li>
</ul></section>
</div>
</div>""".format(sheet_file=SHEET_FILE, sheet_date=SHEET_DATE, checked=CHECKED_ON, rows="".join(rows), grade_rows=grade_rows,
                 jma=jma, groups="".join(groups), pos="".join(pos),
                 osm=ext("https://www.openstreetmap.org/copyright", "OpenStreetMap contributors"),
                 leaflet=ext("https://leafletjs.com/", "Leaflet"),
                 fonts=ext("https://fonts.google.com/", "Google Fonts"))
    return layout(title="資料來源", description="東京銀杏一年生長階段情報的資料來源：活頁簿、氣象廳資料、各地點官方來源與位置依據。教學使用，非營利。",
                  body=body, root=root, kind="sources")


# ---------------------------------------------------------------- data.js
def render_data_js():
    data = {
        "model": MODEL,
        "stages": [{"n": s["n"], "ja": s["ja"], "gloss": s["gloss"], "window": s["window"]} for s in STAGES],
        "places": [{"id": p["id"], "ja": p["ja"], "zh": p["zh"] or "", "area": p["area"],
                    "lat": p["geo"]["lat"], "lng": p["geo"]["lng"], "pos": p["poslabel"]} for p in PLACES],
    }
    return ("/* 由 sakura.py 產生：網站資料（階段模型與 26 處地點）。 */\nwindow.GINKGO_DATA = %s;\n"
            % json.dumps(data, ensure_ascii=False, indent=1))


# ----------------------------------------------------------------------------
# 5. build / verify / serve
# ----------------------------------------------------------------------------
def write(path, text):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(str(path), "w", encoding="utf-8", newline="\n") as f:
        f.write(text)


def build():
    for sub in ("stages", "places"):
        d = ROOT / sub
        if d.is_dir():
            for old in d.glob("*.html"):
                old.unlink()
    write(ROOT / "style.css", STYLE_CSS.strip() + "\n")
    write(ROOT / "app.js", APP_JS.strip() + "\n")
    write(ROOT / "data.js", render_data_js())
    write(ROOT / "index.html", render_index())
    write(ROOT / "sources.html", render_sources())
    for s in STAGES:
        write(ROOT / "stages" / ("%d.html" % s["n"]), render_stage(s))
    for p in PLACES:
        write(ROOT / "places" / ("%s.html" % p["id"]), render_place(p))
    return verify()


def verify():
    """檢查產生的檔案：每個相對連結與資源都指到存在的檔案；回傳 (頁數, 連結數)。"""
    pages = [ROOT / "index.html", ROOT / "sources.html"] + sorted((ROOT / "stages").glob("*.html")) + sorted((ROOT / "places").glob("*.html"))
    attr = re.compile(r'(?:href|src)="([^"]+)"')
    links = 0
    problems = []
    for page in pages:
        text = page.read_text(encoding="utf-8")
        for m in attr.finditer(text):
            u = m.group(1)
            if re.match(r"^(https?:|mailto:|data:|#)", u):
                continue
            links += 1
            target = (page.parent / u.split("#")[0].split("?")[0]).resolve()
            if not target.is_file():
                problems.append("%s -> %s" % (page.relative_to(ROOT), u))
    if problems:
        raise SystemExit("連結檢查失敗：\n  " + "\n  ".join(problems))
    expected = 2 + len(STAGES) + len(PLACES)
    if len(pages) != expected:
        raise SystemExit("頁數不符：%d != %d" % (len(pages), expected))
    return len(pages), links


class _Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, fmt, *args):
        sys.stderr.write("  %s\n" % (fmt % args))


def serve(port):
    pages, links = build()
    print("已產生 %d 個頁面（%d 個相對連結檢查通過）" % (pages, links))
    mimetypes.add_type("text/javascript", ".js")
    mimetypes.add_type("text/css", ".css")
    # 連接埠已經有程式在用時就停止，不要默默共用（Windows 的 SO_REUSEADDR 會允許兩個伺服器綁同一個連接埠）
    probe = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    probe.settimeout(1)
    in_use = probe.connect_ex(("127.0.0.1", port)) == 0
    probe.close()
    if in_use:
        raise SystemExit("連接埠 %d 已經被其他程式使用。請改用其他連接埠，例如：python sakura.py serve --port %d" % (port, port + 1))
    socketserver.TCPServer.allow_reuse_address = (os.name != "nt")
    with socketserver.ThreadingTCPServer(("127.0.0.1", port), _Handler) as httpd:
        print("網站在 http://localhost:%d/ （按 Ctrl+C 結束）" % port)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n已停止。")


def main(argv=None):
    ap = argparse.ArgumentParser(description="東京銀杏一年生長階段情報：產生與預覽網站")
    ap.add_argument("command", nargs="?", choices=["build", "serve"], help="build 產生網站；serve 產生後開啟 http://localhost:8000/")
    ap.add_argument("--port", type=int, default=8000, help="serve 使用的連接埠（預設 8000）")
    args = ap.parse_args(argv)
    if args.command == "build":
        pages, links = build()
        print("已產生 %d 個頁面，相對連結檢查通過（%d 個）。直接雙擊 index.html 即可開啟。" % (pages, links))
    elif args.command == "serve":
        serve(args.port)
    else:
        ap.print_help()
    return 0


if __name__ == "__main__":
    sys.exit(main())
