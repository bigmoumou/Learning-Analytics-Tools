/* ==========================================================================
   Week 5 影片 01 專用（window.V），載在 loop.js 後面
   - 換掉 loop.js 的劇本：資料夾 ginkgo-map、側欄、第二次對話的活動紀錄（L.ITEMS、L.ORDER、L.WORKLOG）
   - V.agents(el, o)／V.verify(el, o)：長期協作規則、驗收單兩張紙；V.mark：打勾／打叉（畫出來的進度）
   - V.map(o)：地圖（照 Codex 實跑做出來的 index.html：同樣的形狀、同樣的座標換算）
   - V.popup(i, o)：點標記跳出的卡片；V.phone：手機外框
   - V.report(rows, on)：Codex 最後的回答裡那張表
   全部只依參數決定畫面。
   ========================================================================== */
(function () {
  "use strict";
  const L = window.L, K = window.K, I = (n) => K.icon(n);
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const V = (window.V = {});

  /* ---------------- 劇本 ---------------- */
  L.FOLDER_PATH = "/Users/an/Desktop/ginkgo-map";
  L.APP_SCALE = 0.5;
  // 第 2 版：小安只說「全部做好」，沒說幾個景點、也沒說要檢查手機（開頭兩段對話和第 6 段都是這一句）
  L.ASK = "幫我把銀杏散步地圖全部做好";
  V.TITLE1 = "銀杏散步地圖";            // 第一次的對話（第 0 段）
  V.TITLE2 = "重做銀杏散步地圖";        // 開新對話（第 6 段起）
  L.SIDEBAR = (title) => [
    { name: "game", open: false, chats: [] }, { name: "Project", open: false, chats: [] },
    { name: "ginkgo-map", open: true, chats: title === V.TITLE1 || title === "New chat" ? [{ title, on: true }] : [{ title, on: true }, { title: V.TITLE1 }] },
    { name: "日常", open: false, chats: [] },
  ];
  // 推近 Codex 對話欄（視窗縮 0.5；對話字 30 px × 0.5 × 1.7 ≈ 25 px）；對話欄在畫面左半，右邊留給小張的驗收單
  V.PUSH = [783, 562, 1.7];
  L.PUSH = V.PUSH;                    // 遮罩、壓暗的程度照這支的推近倍數算
  V.PUSH_T = [783, 552, 1.7];          // 第 7 段：回報表比較高，鏡頭中心對準表格（小安的訊息藏進上面的遮罩）

  // 展開的指令和輸出：都在 source/demo 的假專案真的跑過（source/demo/outputs/）
  V.OUT = {
    check1: ["$ python3 check_data.py", "12 筆，0 個空白", "照片 10/12", "  找不到 ginkgo-03.jpg（photos/ 裡是 ginkgo-03.JPG）", "  找不到 ginkgo-08.jpg（photos/ 裡是 ginkgo-08.JPG）"],
    fix: ["$ mv photos/ginkgo-03.JPG photos/ginkgo-03.tmp", "$ mv photos/ginkgo-03.tmp photos/ginkgo-03.jpg", "! （ginkgo-08 也一樣）", "$ python3 check_data.py", "12 筆，0 個空白", "照片 12/12"],
  };
  const tr = (icon, text) => `<div class="tr">${I(icon)}<span>${esc(text)}</span></div>`;
  const agent = (txt) => K.cx.agent(`<p>${txt}</p>`);
  const exp = (lines) => `<div class="exp">${lines.map((l) => l[0] === "$" ? `<span class="c">${esc(l.slice(2))}</span>` : l[0] === "!" ? `<span class="e">${esc(l.slice(2))}</span>` : esc(l)).join("\n")}</div>`;

  // Codex 最後的回答：一張 7 列的表（第 3–6 條的證據是示意：實跑的 CLI 沒有瀏覽器，見 source/run/run1-log.md）
  V.ROWS = [
    ["1. 12 筆、沒有空白", "通過", "<code>check_data.py</code>：12 筆，0 個空白"],
    ["2. 照片 12/12", "通過", "<code>check_data.py</code>：照片 12/12（改了 2 個檔名）"],
    ["3. 12 個標記", "通過", "內建瀏覽器：數到 12 個標記"],
    ["4. 照片有顯示", "通過", "內建瀏覽器：點 3 號，照片有顯示"],
    ["5. 390 px 不捲動", "通過", "內建瀏覽器縮到 390 px：頁面寬 390 px"],
    ["6. Console 沒紅字", "通過", "Console：0 個錯誤"],
    ["7. 回報表", "通過", "這張表"],
  ];
  V.report = (rows, on = -1) => `<table class="rep"><tr><th>項目</th><th>結果</th><th>證據</th></tr>` +
    rows.map(([a, b, c], i) => `<tr class="${i === on ? "on" : ""}"><td>${a}</td><td class="ok">${b}</td><td class="ev">${c}</td></tr>`).join("") + `</table>`;

  L.ITEMS = {
    tm: () => K.cx.time("Today 4:10 PM"),
    ask: () => K.cx.user(L.ASK, "", false),
    work: (s) => s.done ? K.cx.worked(V.WORKED || "Worked for 1m 12s") : `<div class="working"><span class="shine">Working…</span></div>`,
    a1: () => agent("我先讀 AGENTS.md 和 VERIFY.md，再做地圖。"),
    r1: () => tr("termBox", "Ran commands"),
    a2: () => agent("地圖做好了。照 VERIFY.md 完整驗證一次。"),
    r2: () => tr("termBox", "Ran commands"),
    x1: () => exp(V.OUT.check1),
    a3: () => agent("照片 10/12：兩個檔名的大小寫不一樣。改成小寫，再檢查一次。"),
    r3: () => tr("termBox", "Ran commands"),
    x2: () => exp(V.OUT.fix),
    a4: () => agent("用內建瀏覽器打開 index.html：數標記、點一個標記、縮到手機寬度。"),
    r4: () => tr("browser", "Used the browser"),
    fin: () => K.cx.agent(`<p>做好了，照 VERIFY.md 逐條檢查過：</p>${V.report(V.ROWS)}`),
    // 第 0 段：第一次的對話
    fin1: () => agent("做好了！地圖上有 12 個銀杏景點。"),
  };
  L.ORDER = ["tm", "ask", "work", "a1", "r1", "a2", "r2", "x1", "a3", "r3", "x2", "a4", "r4", "fin", "fin1"];
  L.WORKLOG = new Set(["a1", "r1", "a2", "r2", "x1", "a3", "r3", "x2", "a4", "r4"]);

  /* ---------------- 兩張紙 ---------------- */
  V.AGENTS = [
    "用繁體中文回答。",
    "網頁是 <code>index.html</code>，景點在 <code>data/spots.csv</code>。",
    "地圖自己用 SVG 畫，不要用外部的地圖服務。",
    "不要改 <code>spots.csv</code> 裡的景點內容。",
  ];
  // 第 2 版：老師指定的原文（整句畫琥珀底線，--ul 從左到右一行一行畫過去；<u> 是細線接到驗收單的起點）
  V.ADD_TEXT = "每次做完一個新功能，都要把 VERIFY.md 完整驗證一次，確保全部通過。";
  V.ADD = `<span class="hl">${V.ADD_TEXT.replace("VERIFY.md", "<u>VERIFY.md</u>")}</span>`;
  // o：{ add: 0..1（第 5 段加的那一行）, ul: 0..1（那一行的琥珀底線）, n: 顯示幾行 }
  V.agents = (el, o = {}) => {
    const n = o.n === undefined ? V.AGENTS.length : o.n;
    const h = `<div class="hd"><span class="ttl">長期協作規則</span><span class="fn">AGENTS.md</span><span class="wk">Week 3 學過</span></div>
      <div class="sub">寫「怎麼做」</div>` + V.AGENTS.slice(0, n).map((l) => `<div class="ln">${l}</div>`).join("") +
      (o.add ? `<div class="ln add" id="agAdd" style="white-space:normal">${V.ADD}</div>` : "");
    if (el.__h !== h) { el.innerHTML = h; el.__h = h; }
    const a = el.querySelector("#agAdd");
    if (a) { a.style.opacity = K.clamp(o.add / 0.6); a.style.setProperty("--ul", K.clamp(o.ul || 0)); }
  };
  V.CHECKS = [
    ["資料", "<code>spots.csv</code> 有 12 筆，沒有空白", "<code>check_data.py</code>"],
    ["資料", "照片 12/12（大小寫也要一樣）", "<code>check_data.py</code>"],
    ["網頁", "地圖上有 12 個標記", "內建瀏覽器"],
    ["網頁", "點標記：照片有顯示", "內建瀏覽器"],
    ["網頁", "寬 390 px：不會左右捲動", "內建瀏覽器"],
    ["網頁", "Console 沒有紅字", "Console"],
    ["回報", "最後列一張表：結果和證據", "回報"],
  ];
  // 一格的打勾／打叉：s＝"ok"｜"ng"｜""，k＝畫出來的進度
  V.mark = (s, k = 1) => {
    if (!s) return `<span class="box"></span>`;
    const d = s === "ok" ? "M5 19 L14 28 L33 4" : "M6 6 L28 28 M28 6 L6 28";
    return `<span class="box${s === "ng" ? " ng" : ""}"><svg viewBox="0 0 36 36"><path d="${d}" pathLength="1" style="stroke-dasharray:1;stroke-dashoffset:${(1 - K.clamp(k)).toFixed(3)}"/></svg></span>`;
  };
  // o：{ marks: [[s, k] × 7], hi: 亮哪一列, n: 顯示幾列, groups: 顯示「資料／網頁／回報」分組, rows: 每一列出現的進度 }
  V.verify = (el, o = {}) => {
    const list = o.list || V.CHECKS, n = o.n === undefined ? list.length : o.n, marks = o.marks || [];
    let h = `<div class="hd"><span class="ttl">驗收單</span><span class="fn">VERIFY.md</span></div><div class="sub">寫「怎樣算做好、怎麼檢查」</div>`;
    let grp = "";
    list.slice(0, n).forEach(([g, what, how], i) => {
      if (g !== grp && o.groups) { h += `<div class="vgrp">${g}</div>`; grp = g; }
      const [s, k] = marks[i] || ["", 0];
      h += `<div class="vrow" data-i="${i}">${V.mark(s, k)}<span class="n">${i + 1}</span><span>${what}</span><span class="how">${how}</span></div>`;
    });
    if (el.__h !== h) { el.innerHTML = h; el.__h = h; }
    el.querySelectorAll(".vrow").forEach((r, i) => {
      r.style.setProperty("--hi", o.hi === i ? 1 : 0);
      if (o.rows) { const a = o.rows[i]; r.style.opacity = a === undefined ? 1 : K.clamp(a); r.style.transform = a === undefined ? "" : `translateY(${((1 - K.easeOut(a)) * 10).toFixed(1)}px)`; }
    });
  };

  /* ---------------- 地圖 ---------------- */
  const S = window.SPOTS;
  const minLat = Math.min(...S.map((s) => s.lat)), maxLat = Math.max(...S.map((s) => s.lat)), minLon = Math.min(...S.map((s) => s.lon)), maxLon = Math.max(...S.map((s) => s.lon));
  V.xy = (i) => [120 + (S[i].lon - minLon) / (maxLon - minLon) * 660, 445 - (S[i].lat - minLat) / (maxLat - minLat) * 330];   // 和 index.html 一樣
  const BASE = `<defs><pattern id="grass" width="32" height="32" patternUnits="userSpaceOnUse"><circle cx="5" cy="7" r="1.2" fill="#d4dfc2"/><circle cx="23" cy="22" r="1" fill="#d4dfc2"/></pattern></defs>
    <rect width="900" height="560" fill="#edf0e2"/><rect width="900" height="560" fill="url(#grass)"/>
    <path d="M35 83 Q220 18 440 55 T858 80 L875 465 Q650 535 430 507 T35 474Z" fill="#e3e9d3" stroke="#c8d4bb" stroke-width="2"/>
    <path d="M119 346 C235 230 366 168 494 194 S698 328 793 356" fill="none" stroke="#d2dfd0" stroke-width="103" stroke-linecap="round"/>
    <path d="M119 346 C235 230 366 168 494 194 S698 328 793 356" fill="none" stroke="#f8f3df" stroke-width="78" stroke-linecap="round"/>
    <path d="M105 372 C254 254 368 197 496 220 S697 352 811 381" fill="none" stroke="#e8d9ac" stroke-width="2" stroke-dasharray="4 10"/>
    <path d="M111 83 C175 106 218 140 243 195 M717 112 C673 146 652 181 650 225 M153 454 C196 420 226 400 263 390 M674 439 C643 408 628 385 619 355" fill="none" stroke="#cbd8bb" stroke-width="15" stroke-linecap="round"/>
    <path d="M190 405 C205 359 250 336 305 344 C352 352 381 386 371 423 C360 461 313 475 254 460 C214 451 183 434 190 405Z" fill="#c4d9d8" stroke="#abcac7" stroke-width="3"/>
    <path d="M510 139 C553 116 597 129 611 163 C625 197 603 222 565 219 C527 216 496 177 510 139Z" fill="#d5e3d9" stroke="#c0d4c4" stroke-width="2"/>
    <g fill="#91a980" opacity=".85"><circle cx="118" cy="147" r="18"/><circle cx="151" cy="128" r="13"/><circle cx="748" cy="171" r="18"/><circle cx="784" cy="190" r="13"/><circle cx="432" cy="416" r="17"/><circle cx="466" cy="432" r="13"/><circle cx="705" cy="454" r="16"/><circle cx="738" cy="433" r="12"/></g>
    <text x="248" y="407" class="lbl">鏡湖</text><text x="541" y="168" class="lbl">林間池</text><text x="67" y="108" class="lbl">北門</text><text x="758" y="454" class="lbl">南門</text>`;
  // o：{ w, h（畫在多大的框裡）, n: 畫幾個標記, hi: 被點的那一個, r: 標記半徑, ring: [i, k]（數到的標記外圈） }
  V.map = (o = {}) => {
    const n = o.n === undefined ? 12 : o.n, r = o.r || 14;
    let m = "";
    for (let i = 0; i < n; i++) {
      const [x, y] = V.xy(i), on = i === o.hi;
      m += `<g><circle class="pin" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${on ? r + 3 : r}"${on ? ' style="fill:#b97d16"' : ""}/><text class="num" x="${x.toFixed(1)}" y="${y.toFixed(1)}" style="font-size:${Math.round(r * 0.95)}px">${i + 1}</text></g>`;
    }
    return `<svg class="gmap" viewBox="0 0 900 560" width="${o.w || 900}" height="${o.h || 560}" preserveAspectRatio="xMidYMid meet">${BASE}${m}</svg>`;
  };
  // 點標記跳出的卡片；broken：照片是破圖
  V.popup = (i, o = {}) => `<div class="gpop" style="left:${o.x}px;top:${o.y}px;width:${o.w}px">` +
    `<div style="position:relative">${o.broken ? `<div style="height:${Math.round(o.w * 0.75)}px"></div><div class="bk" style="height:${Math.round(o.w * 0.75)}px"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 15l5-5 4 4 3-3 6 6"/><path d="M4 4l16 16"/></svg></div>` : `<img src="../photos/${S[i].photo.replace(/\.jpg$/, (m) => ((i === 2 || i === 7) && o.upper ? ".JPG" : m))}">`}</div>` +
    `<div class="t">${i + 1}. ${esc(S[i].name)}</div><div class="d">${esc(S[i].desc)}</div></div>`;

  /* ---------------- 每一段開頭、結尾淡入淡出（段落之間不硬切） ---------------- */
  V.dip = (t, D, a = 0.4) => { L.$("stage").style.opacity = (K.clamp(t / a) * (1 - K.clamp((t - (D - a)) / a))).toFixed(3); };

  /* ---------------- 第 8 段新加的第 8 條 ---------------- */
  V.CHECK8 = ["網頁", "寬 390 px：每個標記至少 44 px", "內建瀏覽器"];

  /* ---------------- 第 4 段：完整的驗收單（兩欄：資料｜網頁、回報） ---------------- */
  V.FULL = {
    intro: "做完之後，照下面每一條檢查，回報「通過／沒通過」和你怎麼確認的。沒通過的先修，修完再檢查一次。",
    data: [
      ["data/spots.csv 有 <b>12 筆</b>，每筆都不是空的", "檢查：<code>python3 check_data.py</code> →「12 筆，0 個空白」"],
      ["每個照片檔名在 photos/ 裡都找得到（大小寫也要一樣）", "檢查：<code>python3 check_data.py</code> →「照片 12/12」"],
    ],
    web: [
      ["用內建瀏覽器打開 index.html：地圖上有 <b>12 個</b>標記", ""],
      ["點任一個標記：跳出名稱、說明和照片，照片有顯示", ""],
      ["視窗縮到手機寬度 <b>390 px</b>：不會左右捲動，標記點得到", ""],
      ["Console 沒有紅字（錯誤訊息）", ""],
    ],
    report: [["最後列一張表：每一條的結果和證據（指令的輸出或截圖）", ""]],
  };

  /* ---------------- 手機裡的截圖（真的截圖：materials/shots/，2 倍圖） ---------------- */
  // o：{ src, w（手機外框寬）, sx（往右捲了幾 CSS px）, url（網址列，示意）, fade: [另一張圖, 0..1] }
  V.screen = (el, o) => {
    const W = o.w, sw = W - 24, k = sw / 390, bar = o.url ? 44 : 0, sh = Math.round(844 * k) + bar, H = sh + 24;
    const img = (src, op) => `<img src="../shots/${src}" style="position:absolute;left:${(-o.sx * k || 0).toFixed(1)}px;top:${bar}px;width:${o.full ? 1100 * k : sw}px;opacity:${op}">`;
    const inner = (o.url ? `<div style="position:absolute;left:0;right:0;top:0;height:${bar}px;background:#ece8dc;display:flex;align-items:center;justify-content:center;font:500 15px 'Noto Sans TC',sans-serif;color:#555"><span style="background:#fff;border-radius:10px;padding:3px 14px">${o.url}</span></div>` : "") +
      img(o.src, 1) + (o.fade ? img(o.fade[0], o.fade[1]) : "");
    el.innerHTML = `<div class="spk"></div><div class="scr" style="width:${sw}px;height:${sh}px">${inner}</div>`;
    el.style.width = W + "px"; el.style.height = H + "px";
    return { k, bar, H };
  };

  /* ---------------- 手機外框 ---------------- */
  V.phone = (el, w, h, inner) => {
    const key = w + "x" + h + inner;
    if (el.__h !== key) { el.innerHTML = `<div class="spk"></div><div class="scr" style="width:${w - 24}px;height:${h - 24}px">${inner}</div>`; el.__h = key; }
    el.style.width = w + "px"; el.style.height = h + "px";
  };
})();
