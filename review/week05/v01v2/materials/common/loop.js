/* ==========================================================================
   Week 5 影片 01 用的共用程式（window.L）：從補充 1 的 loop.js 複製來的（補充 1 已上線，不動它的檔案）。
   這一份多了：對話項目、資料夾路徑、側欄可以由 v01.js 換掉（L.ITEMS、L.ORDER、L.WORKLOG、L.FOLDER_PATH、L.SIDEBAR）。
   原本的說明：Week 5 補充 1 共用程式 — 第 2 版
   - L.mount(o)：在 #stage 裡搭好整個場景（#world 會推近／平移；段落標、計數、字幕、示意不動）
   - L.cam(t, keys)：鏡頭。keys = [[秒, 中心 x, 中心 y, 倍數], ...]，把場景的 (x, y) 放到畫面中央
   - L.SLIPS／L.SENDS：整支片的 18 張紙條、7 次傳送時整疊的張數（3、5、7、11、13、15、17）
   - L.stack(t, n0, adds)：一疊紙條（舊的平順地壓成紙邊）；L.sends、L.flies：整疊傳過去、一張飛回來
   - L.thread(t, cfg)：小安的 Codex 對話（整支片同一份，每段只決定哪些項目什麼時候出現）
   - 其他：L.folder、L.search、L.panel、L.link、L.fox、L.cursor、L.caps、L.sec、L.count、L.illus
   全部只依 t 決定畫面；DOM 只在狀態改變時重建。
   ========================================================================== */
(function () {
  "use strict";
  const L = (window.L = {});
  const K = window.K, C = K.clamp, E = K.ease, lerp = K.lerp;
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const $ = (id) => document.getElementById(id);
  L.$ = $;

  /* ================= 劇本 ================= */
  L.ASK = "幫我上網找一份公開的課程問卷資料，下載下來，和資料夾裡的 grades.csv 一起看，寫一份 report.md";
  L.URL = "https://example.org/survey.csv";                 // 示意（保留網域）
  L.CURL = "curl -L -o survey.csv " + L.URL;

  // 一疊紙條：[誰, 內容 HTML]；只增不減，順序＝對話的順序
  L.SLIPS = [
    ["說明書", "Codex 的工作說明"],                               // 1  ┐
    ["AGENTS.md", "用繁體中文回答…"],                              // 2  │ 第 1 次傳送：3 張
    ["小安", "幫我上網找一份公開的課程…"],                          // 3  ┘
    ["模型", "請幫我跑 <code>ls</code>"],                          // 4
    ["結果", "<code>AGENTS.md  grades.csv</code>"],               // 5  ← 第 2 次傳送：5 張
    ["模型", "請幫我跑 <code>head grades.csv</code>"],             // 6
    ["結果", "grades.csv 的前 10 行"],                             // 7  ← 第 3 次傳送：7 張
    ["模型", "網路搜尋：公開的課程問卷資料"],                         // 8  （搜尋在 OpenAI 那邊做）
    ["模型", "找到了（來源 example.org）"],                         // 9  原始結果留在伺服器那一側
    ["模型", "請幫我跑 <code>curl</code> 下載問卷"],                 // 10
    ["結果", "已下載 survey.csv"],                                 // 11 ← 第 4 次傳送：11 張
    ["模型", "請幫我寫 <code>analyze.py</code>"],                   // 12
    ["結果", "已寫入 analyze.py"],                                 // 13 ← 第 5 次傳送：13 張
    ["模型", "請幫我跑 <code>python3 analyze.py</code>"],          // 14
    ["結果", "印出幾個數字"],                                       // 15 ← 第 6 次傳送：15 張
    ["模型", "請幫我寫 <code>report.md</code>"],                   // 16
    ["結果", "已寫入 report.md"],                                  // 17 ← 第 7 次傳送：17 張
    ["模型", "做好了，這是結果"],                                   // 18  最後的回答
  ];
  L.SENDS = [0, 3, 5, 7, 11, 13, 15, 17];

  /* ================= 版面（全片固定） ================= */
  L.P = {
    stack: { x: 806, y: 652 },          // 紙條的底
    net: { x0: 1272, x1: 1590, y: 330 },
    srvIn: { x: 1600, y: 300 },          // 從伺服器飛出來的紙條起點
  };
  L.WIDE = [960, 540, 1];
  L.PUSH = [471, 466, 2.2];              // 推近 Codex 對話欄：對話字 30 px × 0.38 × 2.2 ≈ 25 px
  L.PAN = [1600, 540, 1];                // 往右平移，看伺服器那一側（第 4 段）

  /* ================= 搭場景 ================= */
  L.mount = (o = {}) => {
    $("stage").innerHTML = `
      <div id="world">
        <div class="zone" id="zMac" style="left:48px;top:112px">小安的 Mac</div>
        <div class="zone" id="zSrv" style="left:1610px;top:112px">OpenAI 的伺服器</div>
        <div class="app" id="app"></div>
        <div class="pfolder" id="folder"><div class="box" id="folderBox"><i>Codex 只在這裡面寫</i></div><div class="p">${L.FOLDER_PATH || "/Users/an/Desktop/Project"}</div><div class="f" id="folderF"></div></div>
        <div class="net" id="net"></div><div class="net-l" id="netL">網路</div>
        <div class="server" id="srv"></div><div class="led" id="led"></div>
        <div class="search" id="search"></div>
        <div class="ctx" id="ctx"></div>
        <svg id="link" style="position:absolute;left:0;top:0;width:1920px;height:1080px;overflow:visible;pointer-events:none"><path id="linkP" d="" fill="none" stroke="#f0b545" stroke-width="2"/></svg>
        <div class="stack" id="stack"></div><div class="stack-n" id="stackN"></div>
        <div class="bundle" id="bundle"></div>
        <div class="slip fly" id="fly0"><span class="k"></span><span class="v"></span></div>
        <div class="slip fly" id="fly1"><span class="k"></span><span class="v"></span></div>
        ${o.world || ""}
        <canvas class="fox" id="foxW" width="1920" height="1080"></canvas>
        <div class="cur" id="cur"></div>
      </div>
      <div class="scrim top" id="scrimT"></div><div class="scrim bot" id="scrimB"></div>
      ${o.boards || ""}
      <canvas class="fox" id="foxO" width="1920" height="1080"></canvas>
      <div class="sec" id="sec"><b id="secN"></b><span id="secT"></span></div>
      <div class="count" id="count">第<b id="countN"></b>次傳送<small>示意</small></div>
      <div class="cap" id="cap"><div class="t" id="capT"></div><div class="s" id="capS"></div></div>
      <div class="illus" id="illus"></div>`;
    L.server();
    ["fly0", "fly1", "bundle", "count", "sec", "cap", "illus", "search"].forEach((id) => K.vis($(id), 0));
  };

  /* ================= 鏡頭 ================= */
  L.Z = 1;
  L.cam = (t, keys) => {
    const cx = K.keys(t, keys.map((k) => [k[0], k[1]])), cy = K.keys(t, keys.map((k) => [k[0], k[2]])), z = K.keys(t, keys.map((k) => [k[0], k[3]]));
    $("world").style.transform = `translate(${(960 - cx * z).toFixed(2)}px, ${(540 - cy * z).toFixed(2)}px) scale(${z.toFixed(4)})`;
    L.Z = z;
    return { cx, cy, z };
  };
  // 推近的程度（0＝全景、1＝推到 L.PUSH）：遮罩、把其他東西壓暗
  L.pushK = (z) => C((z - 1) / (L.PUSH[2] - 1));
  L.scrims = (k) => { $("scrimT").style.opacity = k; $("scrimB").style.opacity = k; };
  // 推近時，Codex 視窗以外的東西淡下去（不搶視線，也不會露出半截紙條）
  L.dim = (k, ids = ["stack", "stackN", "net", "netL", "srv", "zSrv", "zMac", "folder", "bundle", "led", "fly0", "fly1"]) => ids.forEach((id) => { const el = $(id); if (el) el.style.filter = k > 0.001 ? `opacity(${(1 - k).toFixed(3)})` : ""; });
  // 元素在 #world 裡的位置（不受鏡頭、預覽縮放影響）
  L.wr = (el) => {
    const r = el.getBoundingClientRect(), w = $("world").getBoundingClientRect(), s = w.width / 1920;
    return { x: (r.left - w.left) / s, y: (r.top - w.top) / s, w: r.width / s, h: r.height / s };
  };

  /* ================= 一疊紙條 ================= */
  const SH = 58, SG = 8, EH = 9, EG = 3, MAXH = 480;
  // 最上面最多幾張看得到字：疊得越高，越多張壓成紙邊（整疊高度不超過 MAXH）
  L.full = (n) => Math.max(1, Math.min(n, 7, Math.floor((MAXH - (EH + EG) * n) / (SH + SG - EH - EG))));
  const layout = (n) => { const f = L.full(n); return Array.from({ length: n }, (_, i) => (n - 1 - i < f ? 1 : 0)); };   // 1＝整張、0＝紙邊
  L.stackHeight = (n) => layout(n).reduce((s, b) => s + (b ? SH + SG : EH + EG), 0);
  L.topY = (n) => L.P.stack.y - L.stackHeight(n);      // 第 n 張（最上面那張）的上緣
  const JX = (i) => [0, 7, -4, 5, -7, 3, -2, 6, -5, 4, -3, 7, -6, 2, -4, 5, -1, 3][i % 18];
  const JR = (i) => [0, -.35, .25, -.15, .4, -.3, .2, -.4, .3, -.2, .35, -.25, .15, -.35, .3, -.1, .25, -.3][i % 18];
  // n0：開始時的張數；adds：[[落下的時間, 落下後的張數], ...]（張數只增不減）
  L.stackState = (t, n0, adds = []) => {
    let n = n0, ta = -1e9;
    for (const [a, m] of adds) if (t >= a) { n = m; ta = a; }
    return { n, k: C((t - ta) / 0.45), since: t - ta };
  };
  L.stack = (t, n0, adds) => {
    const { n, k, since } = L.stackState(t, n0, adds);
    const A = layout(Math.max(0, n - 1)), B = layout(n);
    let h = "", y = 0;
    for (let i = 0; i < n; i++) {
      const top = i === n - 1;
      const fa = top ? B[i] : lerp(A[i], B[i], E(k));            // 1＝整張、0＝紙邊（中間值＝正在壓扁）
      const hh = lerp(EH, SH, fa), gg = lerp(EG, SG, fa);
      y -= hh + gg;
      if (fa < 0.02) { h += `<div class="edge${i % 2 ? " alt" : ""}" style="top:${y.toFixed(1)}px;left:${JX(i) * 0.6}px"></div>`; continue; }
      const [kk, v] = L.SLIPS[i];
      const drop = top && since < 1.6 ? (1 - K.spring(since, 16, 0.8)) * 26 : 0;
      const op = top && since < 0.25 ? C(since / 0.25) : 1;
      const to = C((fa - 0.5) * 2).toFixed(2);
      h += `<div class="slip${top && since < 1.6 ? " new" : ""}" style="top:${(y - drop).toFixed(1)}px;height:${hh.toFixed(1)}px;left:${JX(i)}px;transform:rotate(${JR(i)}deg);opacity:${op.toFixed(3)}">` +
        `<span class="k" style="opacity:${to}">${esc(kk)}</span><span class="v" style="opacity:${to}">${v}</span></div>`;
    }
    const el = $("stack");
    if (el.__h !== h) { el.innerHTML = h; el.__h = h; }
    const nh = n ? `這一疊：<b>${n}</b> 張` : "";
    if ($("stackN").__h !== nh) { $("stackN").innerHTML = nh; $("stackN").__h = nh; }
    return n;
  };

  /* ---- 整疊傳過去：縮小的紙邊，先從紙條頂端移到網路線左端，再沿著線進伺服器 ---- */
  // list：[[出發的時間, 張數], ...]；回傳現在是第幾次傳送
  L.FLY = 1.5;
  L.sends = (t, list, c0 = 0) => {
    const b = $("bundle");
    let on = 0, c = c0;
    for (const [a, cnt] of list) {
      if (t >= a) c = L.SENDS.indexOf(cnt);
      const u = (t - a) / L.FLY;
      if (u < 0 || u > 1.1) continue;
      let hh = "";
      for (let i = 0; i < cnt; i++) hh += `<i style="position:absolute;left:0;top:${-(i + 1) * 6}px;width:120px;height:4px;border-radius:1px;background:${i % 2 ? "#e6e0d2" : "#d6cfbf"}"></i>`;
      hh += `<span style="position:absolute;left:0;top:${-(cnt * 6) - 40}px;font-size:24px;color:#aeb8c6;white-space:nowrap">整疊 ${cnt} 張</span>`;
      if (b.__h !== hh) { b.innerHTML = hh; b.__h = hh; }
      const x0 = L.P.stack.x + 300, y0 = L.topY(cnt) + 10, xa = L.P.net.x0, ya = L.P.net.y - 4, x1 = L.P.net.x1 + 30;
      const p = E(C(u / 0.3)), q = E(C((u - 0.3) / 0.7));
      const x = u < 0.3 ? lerp(x0, xa, p) : lerp(xa, x1, q), y = u < 0.3 ? lerp(y0, ya, p) : ya;
      b.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      on = C(u * 8) * (1 - C((u - 0.92) / 0.12));
    }
    K.vis(b, on);
    return c;
  };

  /* ---- 一張紙條飛到這疊的最上面 ----
     list：[{ a: 出發, i: 紙條編號（0 起算）, from: {x, y}（預設從伺服器）, d: 飛行秒數, s0: 起始縮放, arc }]；最多同時兩張 */
  L.flies = (t, list) => {
    let slot = 0;
    for (const f of list) {
      const d = f.d || 1.4, u = (t - f.a) / d;
      if (u < 0 || u >= 1 || slot > 1) continue;
      const el = $("fly" + slot++);
      const [kk, v] = L.SLIPS[f.i];
      if (el.__k !== f.i) { el.querySelector(".k").textContent = kk; el.querySelector(".v").innerHTML = v; el.__k = f.i; }
      const from = f.from || L.P.srvIn, e = E(u), s0 = f.s0 === undefined ? 0.7 : f.s0;
      const x1 = L.P.stack.x + JX(f.i), y1 = L.topY(f.i + 1);
      const x = lerp(from.x, x1, e), y = lerp(from.y, y1, e) - Math.sin(Math.PI * e) * (f.arc === undefined ? 46 : f.arc);
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${lerp(s0, 1, e).toFixed(3)})`;
      K.vis(el, C(u * 6));
    }
    for (let i = slot; i < 2; i++) K.vis($("fly" + i), 0);
  };

  /* ---- 伺服器：讀整疊、寫紙條的時候，亮一顆琥珀色的小燈 ---- */
  L.server = () => {
    let h = "";
    for (let i = 0; i < 4; i++) h += `<div class="unit"><s></s><i style="right:44px"></i><i style="right:26px"></i></div>`;
    $("srv").innerHTML = h + `<div class="name">GPT-6 Luna</div>`;
  };
  L.led = (t, spans) => { const on = spans.some(([a, b]) => t >= a && t < b); $("led").style.opacity = on ? (0.55 + 0.45 * Math.pow(Math.cos(t * 4.2), 2)).toFixed(3) : 0; };

  /* ================= Codex 對話 ================= */
  const I = (n) => K.icon(n);
  const tr = (icon, text) => `<div class="tr">${I(icon)}<span>${esc(text)}</span></div>`;
  const agent = (txt) => K.cx.agent(`<p>${txt}</p>`);
  const exp = (lines) => `<div class="exp">${lines.map((l) => l[0] === "$" ? `<span class="c">${esc(l.slice(2))}</span>` : l[0] === "!" ? `<span class="e">${esc(l.slice(2))}</span>` : esc(l)).join("\n")}</div>`;
  // 輸出都在 source/demo/Project 真的跑過（source/demo/outputs/）
  L.OUT = {
    ls: ["$ ls", "AGENTS.md", "grades.csv"],
    head: ["$ head grades.csv", "student,class,hours_per_week,score", "S01,A,4,71", "S02,A,4,64", "S03,A,7,73", "S04,A,9,81", "S05,A,3,", "S06,A,6,88", "S07,A,6,78", "S08,A,3,63", "S09,B,6,72"],
    curl: ["$ " + L.CURL, "! 已下載 survey.csv"],
    py: ["$ python3 analyze.py", "grades.csv：24 人，缺考 3 人（不算進平均）", "平均分數：71.9", "  A 班：74.0", "  B 班：74.7", "  C 班：67.0", "每週讀書時數：班上 4.7 小時，問卷 4.5 小時"],
  };
  L.FINAL = `做好了。我把 grades.csv 和下載的 survey.csv 一起看，報告寫在 ${K.cx.file("report.md")}。`;
  const ASKBOX = `<div class="ask"><div class="h">${I("globe")}<span>Codex 想執行一個需要連網的指令</span></div>` +
    `<div class="cmd">curl -L -o survey.csv <u>${esc(L.URL)}</u></div><div class="btns"><span class="no">不要</span><span class="yes">允許</span></div></div>`;
  const ITEMS = {
    tm: () => K.cx.time("Today 3:02 PM"),
    ask: () => K.cx.user(L.ASK, "", false),
    work: (s) => s.done ? K.cx.worked("Worked for 30s") : `<div class="working"><span class="shine">Working…</span></div>`,
    a1: () => agent("我先看看 Project 資料夾裡有什麼。"),
    r1: () => tr("termBox", "Ran commands"),
    x1: () => exp(L.OUT.ls),
    x2: () => exp(L.OUT.head),
    a2: () => agent("接著上網找一份公開的課程問卷資料。"),
    r2: () => tr("globe", "Searched the web"),
    a3: () => agent("找到一份公開的課程問卷，把它下載到 Project。"),
    p1: (s) => s.allowed ? tr("termBox", "Ran commands") : ASKBOX,
    x3: () => exp(L.OUT.curl),
    a4: () => agent("寫一個小程式來算。"),
    r3: () => tr("pencil", "Created analyze.py"),
    a5: () => agent("跑程式，算出幾個數字。"),
    r4: () => tr("termBox", "Ran commands"),
    x4: () => exp(L.OUT.py),
    a6: () => agent("把結果寫成 report.md。"),
    r5: () => tr("pencil", "Created report.md"),
    fin: () => agent(L.FINAL),
  };
  L.ITEMS = ITEMS;
  const ORDER = ["tm", "ask", "work", "a1", "r1", "x1", "x2", "a2", "r2", "a3", "p1", "x3", "a4", "r3", "a5", "r4", "x4", "a6", "r5", "fin"];
  L.ORDER = ORDER;
  const WORKLOG = new Set(["a1", "r1", "x1", "x2", "a2", "r2", "a3", "p1", "x3", "a4", "r3", "a5", "r4", "x4", "a6", "r5"]);   // 做完時收進 Worked for 那一列
  /* cfg：{ at: {id: 出現的秒數（-1＝一開始就在）}, doneAt, allowAt, title(t), input(t), pressAt, ul(t), hide, scale, pos } */
  L.thread = (t, cfg) => {
    const app = $("app");
    const st = { done: cfg.doneAt !== undefined && t >= cfg.doneAt, allowed: cfg.allowAt !== undefined && t >= cfg.allowAt };
    const hide = new Set(typeof cfg.hide === "function" ? cfg.hide(t) : (cfg.hide || []));
    const ITEMS_ = L.ITEMS, ORDER_ = L.ORDER, WORKLOG_ = L.WORKLOG || WORKLOG;
    const ids = ORDER_.filter((id) => cfg.at[id] !== undefined && !hide.has(id) && !(st.done && WORKLOG_.has(id)));
    const html = ids.map((id) => ITEMS_[id](st).replace(/^<div /, `<div data-id="${id}" `)).join("");
    const title = cfg.title ? cfg.title(t) : "課程問卷報告";
    const key = html + "|" + title;
    if (app.__k !== key) {
      app.innerHTML = K.codex({
        title,
        folders: L.SIDEBAR ? L.SIDEBAR(title, t) : [{ name: "game", open: false, chats: [] }, { name: "Project", open: true, chats: [{ title, on: true }, { title: "寫報告" }] }, { name: "日常", open: false, chats: [] }],
        recents: ["寫報告", "英文信件潤稿", "整理課堂筆記"], panel: false, dot: 0, messages: html, model: "GPT-6 Luna Extra High",
      });
      app.__k = key;
      if (L.AFTER_BUILD) L.AFTER_BUILD(app);     // 例如：重新插回內建瀏覽器面板
    }
    app.style.transform = `scale(${cfg.scale || L.APP_SCALE || 0.38})`;
    if (cfg.pos) { app.style.left = cfg.pos.x + "px"; app.style.top = cfg.pos.y + "px"; }
    const inp = cfg.input ? cfg.input(t) : "";
    K.setComposer($("cxComposer"), inp, !!inp, t);
    // 出現：淡入＋往上浮
    const msgs = $("cxMsgs"), view = $("cxThread");
    const els = ids.map((id) => msgs.querySelector(`[data-id="${id}"]`));
    els.forEach((el, j) => {
      const a = cfg.at[ids[j]];
      if (a < 0 || t >= a + 0.6) { el.style.opacity = ""; el.style.transform = ""; return; }
      el.style.opacity = C((t - a) / 0.25);
      el.style.transform = `translateY(${((1 - K.spring(t - a, 14, 0.85)) * 18).toFixed(1)}px)`;
    });
    const sh = msgs.querySelector(".shine");
    if (sh) sh.style.backgroundPosition = `${200 - ((t * 120) % 200)}% 0`;
    // 允許提示：網址底下的琥珀色線、按下「允許」
    const ask = msgs.querySelector(".ask");
    if (ask) {
      ask.style.setProperty("--ul", cfg.ul ? C(cfg.ul(t)) : 0);
      const yes = ask.querySelector(".yes"), p = cfg.pressAt !== undefined ? C(1 - Math.abs(t - cfg.pressAt) / 0.18) : 0;
      yes.style.transform = `scale(${1 - 0.05 * p})`; yes.style.background = p > 0 ? "#d8d8d8" : "";
    }
    // 捲動：最新出現的那一則停在對話欄下緣
    const bottom = (el) => el.offsetTop + el.offsetHeight;
    const sc = (el) => Math.max(0, bottom(el) + 40 - view.offsetHeight);
    const seq = ids.map((id, j) => [cfg.at[id], els[j]]).sort((p, q) => p[0] - q[0]);
    const pre = seq.filter((p) => p[0] < 0), post = seq.filter((p) => p[0] >= 0);
    const ks = [[-1, pre.length ? sc(pre[pre.length - 1][1]) : 0]];
    let prev = ks[0][1];
    for (const [a, el] of post) { ks.push([a - 0.01, prev], [a + 0.45, (prev = sc(el))]); }
    msgs.style.top = -K.keys(t, ks) + "px";
    return st;
  };
  // 對話裡某一則在 #world 裡的位置（給標註、游標用）
  L.item = (id) => { const el = $("cxMsgs") && $("cxMsgs").querySelector(`[data-id="${id}"]`); return el ? L.wr(el) : null; };

  /* ================= Project 資料夾 ================= */
  // files：[[檔名, 出現的秒數（-1＝一開始就在）], ...]；box：0..1（第 7 段的琥珀色框）
  L.folder = (t, files, box = 0, on = 1) => {
    const h = files.filter(([, a]) => t >= a).map(([f, a, hi]) => `<span class="${a >= 0 && t < (hi === undefined ? a + 2.4 : hi) ? "new" : ""}">${esc(f)}</span>`).join("");
    const el = $("folderF");
    if (el.__h !== h) { el.innerHTML = h; el.__h = h; }
    $("folderBox").style.opacity = box;
    K.vis($("folder"), on);
  };

  /* ================= 搜尋結果（伺服器那一側） ================= */
  L.RESULTS = [
    ["公開的課程問卷資料", "example.org/survey.csv", "120 份問卷：每週讀書時數、課程滿意度"],
    ["大學課程回饋：開放資料", "example.net/open-data", "各學院的課程回饋，整理成表格"],
    ["怎麼設計課程問卷", "example.com/blog/survey", "問卷題目的寫法和常見錯誤"],
  ];
  L.search = (t, a, gap = 0.7, out = 1e9) => {
    const el = $("search");
    if (!el.__b) {
      el.innerHTML = `<div class="h">網路搜尋<small>在 OpenAI 這邊做，回來的全部是文字</small></div>` +
        L.RESULTS.map(([ti, u, sn]) => `<div class="r"><div class="ti">${esc(ti)}</div><div class="u">${esc(u)}</div><div class="sn">${esc(sn)}</div></div>`).join("");
      el.__b = 1;
    }
    K.vis(el, C((t - a) / 0.3) * (1 - C((t - out) / 0.4)));
    el.querySelectorAll(".r").forEach((r, i) => K.rise(r, t, a + 0.5 + i * gap, 1e9, 14));
  };

  /* ================= context window 面板 ================= */
  const row = (sw, n, p) => `<div class="item"><span class="sw" style="background:${sw}"></span><span>${n}</span><span class="p">${p}</span></div>`;
  L.panel = (t, a, msg, out = 1e9) => {
    const el = $("ctx"), fix = 5.3, free = 100 - msg - fix;
    const h = `<div class="who"><i></i>GPT-6 Luna</div>
      <div class="top"><span>Context window</span><b>${Math.round(msg + fix)}%</b></div>
      <div class="bar"><i style="width:${msg}%;background:#3b82f6"></i><i style="width:2.7%;background:#e2582a"></i><i style="width:1.2%;background:#2ea66a"></i><i style="width:1%;background:#d99200"></i><i style="width:.4%;background:#8e8e8e"></i></div>
      ${row("#3b82f6", "Messages", msg.toFixed(1) + "%")}${row("#e2582a", "System tools", "2.7%")}${row("#2ea66a", "MCP tools", "1.2%")}
      ${row("#d99200", "Memory files", "1.0%")}${row("#8e8e8e", "System prompt", "0.4%")}${row("#262626;border:1px solid #555", "Free space", free.toFixed(1) + "%")}`;
    if (el.__h !== h) { el.innerHTML = h; el.__h = h; }
    el.style.opacity = C((t - a) / 0.35) * (1 - C((t - out) / 0.4));
    el.style.transform = `scale(${(0.94 + 0.06 * K.spring(t - a, 15, 0.7)).toFixed(4)})`;
  };
  // 一條琥珀色細線：整疊 → 面板的 Messages 那一列（u：畫出來的進度）
  L.link = (u, n) => {
    const p = $("linkP"), it = $("ctx").querySelector(".item");
    if (u <= 0 || !it) { p.style.opacity = 0; return; }
    const r = L.wr(it), x0 = L.P.stack.x + 440 + 16, y0 = L.topY(n) + 4, y1 = L.P.stack.y, x1 = r.x - 14, ym = r.y + r.h / 2, mid = (y0 + y1) / 2;
    p.setAttribute("d", `M ${x0} ${y0} H ${x0 + 14} V ${y1} H ${x0} M ${x0 + 14} ${mid} C ${x0 + 90} ${mid}, ${x1 - 90} ${ym}, ${x1} ${ym}`);
    const len = p.getTotalLength();
    p.style.opacity = 1; p.style.strokeDasharray = len; p.style.strokeDashoffset = len * (1 - C(u));
  };

  /* ================= 小安、游標 ================= */
  L.fox = (id, x, y, s, pose, opts) => {
    const cv = $(id), g = cv.getContext("2d");
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, cv.width, cv.height);
    if (window.drawFox && s > 0 && (!opts || opts.alpha === undefined || opts.alpha > 0)) window.drawFox(g, x, y, s, pose, Object.assign({ shadowAlpha: 0, contactAlpha: 0.35 }, opts || {}));
  };
  // pts：[[秒, x, y], ...]（#world 座標）；最後一點之後淡出
  L.cursor = (t, pts, click = []) => {
    const c = $("cur");
    if (!pts || t < pts[0][0] || t > pts[pts.length - 1][0]) { K.vis(c, 0); return; }
    const x = K.keys(t, pts.map((p) => [p[0], p[1]])), y = K.keys(t, pts.map((p) => [p[0], p[2]]));
    const pr = click.some((a) => Math.abs(t - a) < 0.12) ? 0.88 : 1;
    c.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${pr})`;
    K.vis(c, C((t - pts[0][0]) / 0.2) * (1 - C((t - (pts[pts.length - 1][0] - 0.25)) / 0.25)));
  };

  /* ================= 文字層 ================= */
  const showEl = (el, t, a, b, dy = 14) => {
    const v = C((t - a) / 0.3) * (1 - C((t - (b - 0.3)) / 0.3));
    K.vis(el, v);
    el.style.transform = v > 0 && t < a + 0.6 ? `translateY(${((1 - K.easeOut((t - a) / 0.5)) * dy).toFixed(1)}px)` : "none";
    return v;
  };
  // CAPS：[[a, b, 大字 HTML, 小字 HTML], ...]
  L.caps = (t, CAPS) => {
    let on = 0;
    for (const [a, b, s1, s2] of CAPS) if (t >= a && t < b) {
      const key = s1 + "|" + (s2 || "");
      if ($("cap").__k !== key) { $("capT").innerHTML = s1; $("capS").innerHTML = s2 || ""; $("capS").style.display = s2 ? "" : "none"; $("cap").__k = key; }
      on = showEl($("cap"), t, a, b);
    }
    if (!on) K.vis($("cap"), 0);
  };
  // 段落標在這一段結束前淡出（接成整支時換得順）
  L.sec = (t, n, title, a = 0.1, b = L.D || 1e9) => { $("secN").textContent = n; $("secT").textContent = title; showEl($("sec"), t, a, b, 8); };
  L.count = (t, c, a = -1, b = 1e9) => {
    const el = $("count");
    if (!c) { K.vis(el, 0); return; }
    if ($("countN").textContent !== String(c)) $("countN").textContent = c;
    K.vis(el, C((t - a) / 0.3) * (1 - C((t - (b - 0.3)) / 0.3)));
  };
  // 計數換數字的那一下：新數字從下面輕輕浮上來（ch：換的時間）
  L.countBump = (t, ch) => {
    const u = ch.map((a) => t - a).filter((d) => d >= 0 && d < 0.5)[0];
    $("countN").style.transform = u !== undefined ? `translateY(${((1 - K.easeOut(u / 0.35)) * 10).toFixed(1)}px)` : "";
    $("countN").style.opacity = u !== undefined ? C(u / 0.2) : 1;
  };
  L.illus = (t, list) => {
    let on = 0;
    for (const [a, b, h] of list) if (t >= a && t < b) { if ($("illus").__h !== h) { $("illus").innerHTML = h; $("illus").__h = h; } on = C((t - a) / 0.3) * (1 - C((t - (b - 0.3)) / 0.3)); }
    K.vis($("illus"), on);
  };
  L.fade = (id, t, a, b = 1e9, d = 0.3) => K.fade($(id), t, a, b, d);

  /* ================= 啟動 ================= */
  L.ready = () => Promise.all([document.fonts ? document.fonts.ready : Promise.resolve(), window.FOX2 && window.FOX2.ready ? window.FOX2.ready : Promise.resolve()]);
  L.start = (name, duration, render) => {
    L.D = duration;
    window.ready = false;
    L.ready().then(() => { K.scene({ duration, name, render }); window.ready = true; });
  };
})();
