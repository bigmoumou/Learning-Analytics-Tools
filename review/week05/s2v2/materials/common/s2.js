/* ==========================================================================
   Week 5 補充 2 共用程式（window.L）
   以補充 1 的 materials/common/loop.js 為底（鏡頭、Codex 對話、資料夾、面板、字幕、小安、游標的寫法都一樣），
   改成這支要的：沒有伺服器和網路線；右上角是時鐘；一疊紙條會變薄、會壓縮、決定那張有琥珀小標籤。
   - L.mount(o)：搭好場景（#world 會推近／平移；段落標、時鐘、字幕、示意不動）
   - L.cam(t, keys)：鏡頭。keys = [[秒, 中心 x, 中心 y, 倍數], ...]
   - L.SLIPS：這段對話的紙條（一個下午）；L.stack(t, n0, adds, o)：一疊紙條；L.compact(t, T)：第 3 段的壓縮
   - L.thread(t, cfg)：Codex 對話；L.folder、L.panel、L.clock、L.caps、L.sec、L.illus、L.fox、L.cursor
   全部只依 t 決定畫面；DOM 只在狀態改變時重建。
   ========================================================================== */
(function () {
  "use strict";
  const L = (window.L = {});
  const K = window.K, C = K.clamp, E = K.ease, lerp = K.lerp;
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const $ = (id) => document.getElementById(id);
  L.$ = $; L.esc = esc;
  L.seg = (t, a, b) => E((t - a) / (b - a));

  /* ================= 劇本：這段對話的紙條（順序＝對話的順序，只增不減） =================
     d＝那則決定（琥珀），keep＝壓縮後留下的（小安最近說的話）。 */
  L.FOUND = [["說明書", "Codex 的工作說明"], ["AGENTS.md", "用繁體中文回答…"]];
  L.ASK = "幫我分析 grades.csv，畫一張圖，寫進 report.md";   // 小安在 Codex 裡打的完整句子（紙條上放短的）
  L.S1 = [                                                   // 第 1 段（14:00）
    ["小安", "幫我分析 grades.csv…"],
    ["模型", "請幫我跑 <code>head grades.csv</code>"],
    ["結果", "grades.csv 的前 10 行"],
    ["模型", "<u>缺考的 3 人我先不算進平均</u>，這樣…", "d"],
    ["小安", "好"],
    ["模型", "請幫我寫 <code>plot.py</code>"], ["結果", "已寫入 plot.py"],
    ["模型", "請幫我跑 <code>python3 plot.py</code>"], ["結果", "各班平均、一張散佈圖"],
    ["模型", "請幫我改 <code>report.md</code>"], ["結果", "已更新 report.md"],
    ["模型", "做好了：散佈圖和 report.md"],
  ];
  L.S2 = [                                                   // 第 2 段（一個下午，快轉）
    ["小安", "散佈圖的點改小一點"], ["模型", "請幫我改 <code>plot.py</code>"], ["結果", "已更新 plot.py"], ["模型", "改好了"],
    ["小安", "報告加一段結論"], ["模型", "請幫我改 <code>report.md</code>"], ["結果", "已更新 report.md"], ["模型", "加好了"],
    ["小安", "看一下 survey.csv 的欄位"], ["模型", "請幫我跑 <code>head survey.csv</code>"], ["結果", "survey.csv 的前 10 行"], ["模型", "一共 3 欄"],
    ["小安", "把兩份資料合在一起"], ["模型", "請幫我寫 <code>merge.py</code>"], ["結果", "已寫入 merge.py"], ["模型", "請幫我跑 <code>python3 merge.py</code>"], ["結果", "合併好了"], ["模型", "做好了"],
    ["小安", "畫一張讀書時數的分布圖"], ["模型", "請幫我跑 <code>python3 plot.py</code>"], ["結果", "多了一張分布圖"], ["模型", "畫好了"],
    ["小安", "把圖的標題改大一點", "keep"], ["模型", "已把標題改成 28 pt"],
    ["小安", "第二節改短一點", "keep"], ["模型", "已改短第二節"],
    ["小安", "顏色換成藍色系", "keep"], ["模型", "已換成藍色系"],
  ];
  L.SLIPS = L.FOUND.concat(L.S1, L.S2);
  L.N1 = L.FOUND.length + L.S1.length;                       // 第 1 段結束時的張數（14）
  L.NFULL = L.SLIPS.length;                                  // 疊到頂的張數（42）
  L.KEEP = L.SLIPS.map((s, i) => (s[2] === "keep" ? i : -1)).filter((i) => i >= 0);
  L.DEC = L.SLIPS.findIndex((s) => s[2] === "d");
  L.NEW = ["小安", "再幫我畫一張各班平均的圖"];
  L.DECISION = "grades.csv 有 3 個人缺考，分數是空的。<u class=\"amb\">缺考的 3 人我先不算進平均，這樣比較能反映有來考的同學。</u>";
  L.FILES = ["AGENTS.md", "grades.csv", "survey.csv", "analyze.py", "report.md"];

  /* ================= 版面（全片固定，和補充 1 一樣） ================= */
  L.P = { stack: { x: 806, y: 652 } };
  L.WIDE = [960, 540, 1];
  L.PUSH = [471, 466, 2.2];              // 推近 Codex 對話欄：對話字 30 px × 0.38 × 2.2 ≈ 25 px

  /* ================= 搭場景 ================= */
  L.mount = (o = {}) => {
    $("stage").innerHTML = `
      <div id="world">
        <div class="zone" id="zMac" style="left:48px;top:112px">小安的 Mac</div>
        <div class="app" id="app"></div>
        <div class="pfolder" id="folder"><div class="p">/Users/an/Desktop/Project</div><div class="f" id="folderF"></div></div>
        <div class="ctx" id="ctx"></div>
        <div class="stack" id="stack"></div><div class="stack-n" id="stackN"></div>
        <div class="lbl" id="foundL"></div>
        ${o.world || ""}
        <canvas class="fox" id="foxW" width="1920" height="1080"></canvas>
        <div class="cur" id="cur"></div>
      </div>
      <div class="scrim top" id="scrimT"></div><div class="scrim bot" id="scrimB"></div>
      ${o.boards || ""}
      <canvas class="fox" id="foxO" width="1920" height="1080"></canvas>
      <div class="sec" id="sec"><b id="secN"></b><span id="secT"></span></div>
      <div class="clock" id="clock"></div>
      <div class="cap" id="cap"><div class="t" id="capT"></div><div class="s" id="capS"></div></div>
      <div class="illus" id="illus"></div>`;
    ["sec", "cap", "illus", "foundL"].forEach((id) => K.vis($(id), 0));
  };

  /* ================= 鏡頭（照補充 1） ================= */
  L.Z = 1;
  L.cam = (t, keys) => {
    const cx = K.keys(t, keys.map((k) => [k[0], k[1]])), cy = K.keys(t, keys.map((k) => [k[0], k[2]])), z = K.keys(t, keys.map((k) => [k[0], k[3]]));
    $("world").style.transform = `translate(${(960 - cx * z).toFixed(2)}px, ${(540 - cy * z).toFixed(2)}px) scale(${z.toFixed(4)})`;
    L.Z = z;
    return { cx, cy, z };
  };
  L.pushK = (z) => C((z - 1) / (L.PUSH[2] - 1));
  // 上下遮罩和「其他東西淡下去」用同一條比較快的曲線：拉回時，放大的紙條、面板不會壓到段落標和時鐘
  L.scrims = (k) => { const kk = C(k / 0.35); $("scrimT").style.opacity = kk; $("scrimB").style.opacity = kk; };
  // 推近 Codex 時，其他東西淡下去。fast：拉回時紙條堆先淡一點（推近一點點就幾乎看不到），不會壓到右上角的時鐘
  L.dim = (k, ids = ["stack", "stackN", "folder", "ctx", "foundL", "zMac"], fast = true) => ids.forEach((id) => {
    const el = $(id); if (!el) return;
    const kk = fast ? C(k / 0.35) : k;
    el.style.filter = kk > 0.001 ? `opacity(${(1 - kk).toFixed(3)})` : "";
  });
  // 元素在 #world 裡的位置（不受鏡頭影響）
  L.wr = (el) => {
    const r = el.getBoundingClientRect(), w = $("world").getBoundingClientRect(), s = w.width / 1920;
    return { x: (r.left - w.left) / s, y: (r.top - w.top) / s, w: r.width / s, h: r.height / s };
  };

  /* ================= 一疊紙條 =================
     和補充 1 同一套：整張 58 px（間隔 8）、紙邊 9 px（間隔 3）；最上面幾張是整張，其他壓成紙邊。
     這支的對話很長，疊到上限（MAXH）以後紙邊再變薄一點（最薄 5 px 一張），整疊剛好頂到面板的上緣。 */
  const SH = 58, SG = 8, EH = 9, EG = 3, MAXH = 492, SUMH = 72;
  L.SH = SH; L.SG = SG; L.EH = EH; L.EG = EG; L.SUMH = SUMH;
  const JX = (i) => [0, 7, -4, 5, -7, 3, -2, 6, -5, 4, -3, 7, -6, 2, -4, 5, -1, 3][((i % 18) + 18) % 18];
  const JR = (i) => [0, -.35, .25, -.15, .4, -.3, .2, -.4, .3, -.2, .35, -.25, .15, -.35, .3, -.1, .25, -.3][((i % 18) + 18) % 18];
  L.JX = JX; L.JR = JR;
  // n 張的疊法：每張 { y（相對整疊的底，往上是負的）, h, fa（1 整張、0 紙邊） }
  L.lay = (n) => {
    if (n <= 0) return [];
    const f = Math.max(1, Math.min(n, 7, Math.floor((MAXH - (EH + EG) * n) / (SH + SG - EH - EG))));
    const nE = n - f, fullH = f * (SH + SG);
    let ep = EH + EG;
    if (nE > 0 && fullH + nE * ep > MAXH) ep = Math.max(5, (MAXH - fullH) / nE);
    const eh = ep * EH / (EH + EG);
    const out = []; let y = 0;
    for (let i = 0; i < n; i++) {
      const full = n - 1 - i < f, hh = full ? SH : eh, gg = full ? SG : ep - eh;
      y -= hh + gg; out.push({ y, h: hh, fa: full ? 1 : 0 });
    }
    return out;
  };
  L.topY = (n) => { const l = L.lay(n); return L.P.stack.y + (n ? l[n - 1].y : 0); };
  // 一張紙條的畫面狀態
  L.item = (slips, i, l, extra) => Object.assign({ i, k: slips[i][0], v: slips[i][1], x: JX(i), y: l.y, h: l.h, fa: l.fa, rot: JR(i), dim: 0, alpha: 1, tab: slips[i][2] === "d" ? 1 : 0 }, extra || {});
  L.draw = (items, id = "stack") => {
    let h = "";
    for (const s of items) {
      if (s.alpha <= 0.002) continue;
      const st = `top:${s.y.toFixed(1)}px;height:${s.h.toFixed(1)}px;left:${(s.x || 0).toFixed(1)}px;transform:rotate(${(s.rot || 0).toFixed(3)}deg);opacity:${s.alpha.toFixed(3)};` +
        (s.dim > 0.001 ? `filter:brightness(${(1 - 0.4 * s.dim).toFixed(3)});` : "");
      if (s.sum) {
        const bars = [0.9, 0.62].map((w) => `<i style="width:${(w * 100 * C(s.bars == null ? 1 : s.bars)).toFixed(1)}%"></i>`).join("");
        h += `<div class="slip sum" style="${st}"><span class="k">精簡版</span><span class="v">${bars}</span></div>`;
      } else if (s.fa < 0.02) h += `<div class="edge${s.i % 2 ? " alt" : ""}" style="${st}"></div>`;
      else {
        const to = C((s.fa - 0.5) * 2).toFixed(2);
        h += `<div class="slip${s.isNew ? " new" : ""}" style="${st}"><span class="k" style="opacity:${to}">${esc(s.k)}</span><span class="v" style="opacity:${to}">${s.v}</span></div>`;
      }
      if (s.tab > 0.002) h += `<div class="tab" style="left:${((s.x || 0) + 438).toFixed(1)}px;top:${(s.y + s.h / 2 - 11).toFixed(1)}px;opacity:${(s.tab * s.alpha).toFixed(3)}"></div>`;
    }
    const el = $(id); if (el.__h !== h) { el.innerHTML = h; el.__h = h; }
  };
  // 照時間疊：n0＝開始時的張數；adds：[[落下的時間, 落下後的張數], ...]（只增不減）；o.slips 換一份紙條（第 8 段的新對話）
  L.stackState = (t, n0, adds = []) => {
    let n = n0, ta = -1e9;
    for (const [a, m] of adds) if (t >= a) { n = m; ta = a; }
    return { n, k: C((t - ta) / 0.45), since: t - ta };
  };
  L.stack = (t, n0, adds, o = {}) => {
    const slips = o.slips || L.SLIPS;
    const { n, k, since } = L.stackState(t, n0, adds);
    const A = L.lay(Math.max(0, n - 1)), B = L.lay(n), out = [];
    for (let i = 0; i < n; i++) {
      const top = i === n - 1, b = B[i], a = A[i] || b, e = top ? 1 : E(k);
      const it = L.item(slips, i, { y: lerp(a.y, b.y, e), h: lerp(a.h, b.h, e), fa: top ? b.fa : lerp(a.fa, b.fa, e) });
      if (top && since < 1.6) {      // 新的一張：從上面輕輕落下（照補充 1）
        it.y -= (1 - K.spring(since, 16, 0.8)) * 26; it.alpha = C(since / 0.25); it.isNew = true;
      }
      if (o.each) o.each(it);
      out.push(it);
    }
    L.draw(out);
    L.count(n, o.countOn == null ? 1 : o.countOn);
    return n;
  };
  L.count = (n, on = 1) => { const h = n ? `這一疊：<b>${n}</b> 張` : ""; const el = $("stackN"); if (el.__h !== h) { el.innerHTML = h; el.__h = h; } K.vis(el, on); };

  /* ---- 第 3 段：自動壓縮。T＝這段裡的秒數表（scenes/03-compact.html） ----
     notice：要被濃縮的紙條變暗，留下的三則微微浮起；gather：慢慢收攏到「說明書、AGENTS.md」上；press：壓平成一張精簡版；
     留下的三則一張一張落到精簡版上（仍是紙邊）；新訊息最後才放上去。 */
  L.compactState = (t, T) => {
    const pre = L.lay(L.NFULL), S = L.SLIPS;
    const notice = L.seg(t, T.n0, T.n1), gather = L.seg(t, T.n1, T.g1), press = L.seg(t, T.g1, T.p1);
    const foundTop = pre[1].y, sumY = foundTop - 8 - SUMH, out = [];
    let k = 0;
    for (let i = 0; i < L.NFULL; i++) {
      const l = pre[i];
      if (i < 2) { out.push(L.item(S, i, l)); continue; }
      if (L.KEEP.includes(i)) continue;
      const hT = lerp(EH, SUMH, press), pitch = lerp(2.2, 0, press);
      const yT = lerp(foundTop - 4 - (k + 1) * pitch - hT, sumY, press);
      out.push(L.item(S, i, l, {
        y: lerp(l.y, yT, gather), h: lerp(lerp(l.h, EH, gather), SUMH, press), fa: l.fa * (1 - gather),
        x: lerp(JX(i), 0, gather), rot: JR(i) * (1 - gather), dim: notice * (1 - press * 0.6),
        tab: i === L.DEC ? 1 - L.seg(t, T.n1, T.n1 + 2.0) : 0,
      }));
      k++;
    }
    out.push({ i: -1, sum: true, x: 0, y: sumY, h: SUMH, alpha: L.seg(t, T.p1 - 0.5, T.p1 + 0.1), bars: L.seg(t, T.bars0, T.bars1), rot: 0, dim: 0, tab: 0 });
    L.KEEP.forEach((i, j) => {
      const l = pre[i], a = T.s0 + j * T.sStep, s = L.seg(t, a, a + T.sDur);
      const lift = 12 * notice * (1 - s), dest = sumY - (j + 1) * (EH + EG) + EG;
      out.push(L.item(S, i, l, { y: lerp(l.y, dest, s) - lift, h: lerp(l.h, EH, s), x: lerp(JX(i), JX(i) * 0.6, s) }));
    });
    const topKept = sumY - L.KEEP.length * (EH + EG) + EG, land = L.seg(t, T.new0, T.new1);
    const waitY = pre[L.NFULL - 1].y - SH - 30;
    out.push({ i: 99, k: L.NEW[0], v: L.NEW[1], x: lerp(26, 0, land), y: lerp(waitY - 14 * (1 - K.easeOut((t - T.send) / 0.5)), topKept - SG - SH, land), h: SH, fa: 1,
      rot: lerp(-0.4, 0, land), dim: 0, alpha: C((t - T.send) / 0.3) * lerp(0.92, 1, land), tab: 0 });
    const n = t < T.p1 ? L.NFULL : (t < T.new1 - 0.2 ? 2 + 1 + L.KEEP.length : 3 + L.KEEP.length + 1);
    return { items: out, n, foundTop, sumY, topKept };
  };
  // 壓縮之後的疊法（第 4、5 段接著用）：說明書、AGENTS.md（紙邊）、精簡版、留下的三則（紙邊）、新訊息，再往上加
  // extra：[{ a: 落下的時間, s: [誰, 內容] }, ...]；最上面一張整張，下面一張落下時平順地壓成紙邊
  L.afterItems = (t, extra = []) => {
    const pre = L.lay(L.NFULL), foundTop = pre[1].y, sumY = foundTop - 8 - SUMH, out = [];
    out.push(L.item(L.SLIPS, 0, pre[0]), L.item(L.SLIPS, 1, pre[1]));
    out.push({ i: -1, sum: true, x: 0, y: sumY, h: SUMH, alpha: 1, bars: 1, rot: 0, dim: 0, tab: 0 });
    L.KEEP.forEach((i, j) => out.push(L.item(L.SLIPS, i, { y: sumY - (j + 1) * (EH + EG) + EG, h: EH, fa: 0 }, { x: JX(i) * 0.6 })));
    let y = sumY - L.KEEP.length * (EH + EG) + EG;
    const tail = [{ a: -1, s: L.NEW }].concat(extra.filter((e) => t >= e.a));
    tail.forEach((e, j) => {
      const next = tail[j + 1], fa = next ? 1 - C((t - next.a) / 0.45) : 1, f = E(fa);
      const hh = lerp(EH, SH, f), gg = lerp(EG, SG, f);
      y -= hh + gg;
      const it = { i: 100 + j, k: e.s[0], v: e.s[1], x: j ? JX(100 + j) : 0, y, h: hh, fa, rot: j ? JR(100 + j) : 0, dim: 0, alpha: 1, tab: 0 };
      if (!next && e.a >= 0 && t - e.a < 1.6) { const since = t - e.a; it.y -= (1 - K.spring(since, 16, 0.8)) * 26; it.alpha = C(since / 0.25); it.isNew = true; }
      out.push(it);
    });
    return { items: out, n: 3 + L.KEEP.length + tail.length, top: y };
  };

  /* ================= 整支片同一段對話「分析成績」的歷史 =================
     每段開頭的對話＝上一段結尾的對話（接點前後一樣）。h01()：第 1 段結束時；s2Items(T0, STEP)：第 2 段快轉加上的；
     hist(...)：把前面幾段的項目都當成一開始就在（出現時間 -1）。 */
  L.H01 = () => [
    ["tm", K.cx.time("Today 2:00 PM")], ["ask", L.user(L.ASK)], ["w1", L.work(true, "Worked for 38s")], ["dec", L.agent(L.DECISION)], ["ok", L.user("好")],
    ["w2", L.work(true, "Worked for 1m 12s")], ["r1", L.tr("pencil", "Created plot.py")], ["r2", L.tr("termBox", "Ran commands")], ["r3", L.tr("pencil", "Edited report.md")],
    ["fin", L.agent(`已畫好散佈圖 ${K.cx.file("scatter.png")}，各班平均寫進 ${K.cx.file("report.md")}（缺考的 3 人不算進平均）。`)],
  ];
  L.S2ITEMS = (T0 = -1, STEP = 0) => {
    const out = [];
    L.S2.forEach(([who, v], j) => {
      const a = T0 < 0 ? -1 : T0 + j * STEP, txt = v.replace(/<[^>]+>/g, "");
      if (who === "小安") out.push(["u" + j, L.user(txt), a]);
      else if (who === "模型" && !txt.startsWith("請幫我")) out.push(["a" + j, L.agent(txt + "。"), a]);
      else if (who === "模型") out.push(["r" + j, L.tr(txt.includes("跑") ? "termBox" : "pencil", txt.includes("跑") ? "Ran commands" : "Edited files"), a]);
    });
    return out;
  };
  L.hist = (...lists) => [].concat(...lists).map(([id, h]) => [id, h, -1]);
  // 第 3 段送出、壓縮之後的那幾則（第 4、5 段接著用）：done＝Working… 換成 Worked for
  L.H03 = (done) => [["u4", L.user(L.NEW[1])], ["w3", L.work(!!done, "Worked for 46s")], ["row", L.tr("compact", "Context automatically compacted")]];
  L.H05 = () => [["c1", L.tr("pencil", "Created class_avg.py")], ["c2", L.tr("termBox", "Ran commands")],
    ["c3", L.agent(`畫好了 ${K.cx.file("class_avg.png")}：A 班 64.8、B 班 65.4、C 班 58.6。`)]];

  /* ================= Codex 對話 =================
     cfg：{ items: [[id, html, 出現的秒數（-1＝一開始就在）], ...], title, chats（側欄 Project 底下的其他對話）, input(t), scale } */
  const I = (n) => K.icon(n);
  L.tr = (icon, text) => `<div class="tr">${I(icon)}<span>${esc(text)}</span></div>`;
  L.agent = (txt) => K.cx.agent(`<p>${txt}</p>`);
  L.user = (txt) => K.cx.user(txt, "", false);
  L.work = (done, label) => done ? K.cx.worked(label || "Worked for 30s") : `<div class="working"><span class="shine">Working…</span></div>`;
  L.thread = (t, cfg) => {
    const app = $("app");
    const list = cfg.items.filter(([, , a]) => a < 0 || t >= a);
    const html = list.map(([id, h]) => h.replace(/^<div /, `<div data-id="${id}" `)).join("");
    const title = cfg.title || "分析成績";
    const chats = [{ title, on: true }].concat((cfg.chats || ["課程問卷報告", "寫報告"]).map((c) => ({ title: c })));
    const key = html + "|" + title + "|" + JSON.stringify(chats);
    if (app.__k !== key) {
      app.innerHTML = K.codex({
        title, folders: [{ name: "game", open: false, chats: [] }, { name: "Project", open: true, chats }, { name: "日常", open: false, chats: [] }],
        recents: ["寫報告", "英文信件潤稿", "整理課堂筆記"], panel: false, dot: 0, messages: html, model: "GPT-6 Luna Extra High",
      });
      app.__k = key;
      if (cfg.empty && !list.length) $("cxMain").insertAdjacentHTML("beforeend", `<div class="empty">${I("spark")}What should we work on in Project?</div>`);
    }
    app.style.transform = `scale(${cfg.scale || 0.38})`;
    const inp = cfg.input ? cfg.input(t) : "";
    K.setComposer($("cxComposer"), inp, !!inp, t);
    const msgs = $("cxMsgs"), view = $("cxThread");
    const els = list.map(([id]) => msgs.querySelector(`[data-id="${id}"]`));
    els.forEach((el, j) => {
      const a = list[j][2];
      if (!el) return;
      if (a < 0 || t >= a + 0.6) { el.style.opacity = ""; el.style.transform = ""; return; }
      el.style.opacity = C((t - a) / 0.25);
      el.style.transform = `translateY(${((1 - K.spring(t - a, 14, 0.85)) * 18).toFixed(1)}px)`;
    });
    const sh = msgs.querySelector(".shine");
    if (sh) sh.style.backgroundPosition = `${200 - ((t * 120) % 200)}% 0`;
    // 琥珀底線：從左到右畫出來（cfg.ul(t)：0..1）
    msgs.querySelectorAll("u.amb").forEach((u) => u.style.setProperty("--ul", cfg.ul ? C(cfg.ul(t)) : 1));
    // 捲動：最新出現的那一則停在對話欄下緣（照補充 1）
    const bottom = (el) => el.offsetTop + el.offsetHeight;
    const sc = (el) => Math.max(0, bottom(el) + 40 - view.offsetHeight);
    const seq = list.map((it, j) => [it[2], els[j]]).filter((p) => p[1]).sort((p, q) => p[0] - q[0]);
    const pre = seq.filter((p) => p[0] < 0), post = seq.filter((p) => p[0] >= 0);
    const ks = [[-1, pre.length ? sc(pre[pre.length - 1][1]) : 0]];
    let prev = ks[0][1];
    for (const [a, el] of post) { ks.push([a - 0.01, prev], [a + 0.45, (prev = sc(el))]); }
    msgs.style.top = -K.keys(t, ks) + "px";
  };
  L.msgRect = (id) => { const el = $("cxMsgs") && $("cxMsgs").querySelector(`[data-id="${id}"]`); return el ? L.wr(el) : null; };

  /* ================= Project 資料夾（照補充 1） ================= */
  // files：[[檔名, 出現的秒數（-1＝一開始就在）, 琥珀字到幾秒（預設出現後 2.4 秒）], ...]
  L.folder = (t, files, on = 1) => {
    const h = files.filter(([, a]) => t >= a).map(([f, a, hi]) => `<span class="${(a >= 0 || hi !== undefined) && t < (hi === undefined ? a + 2.4 : hi) ? "new" : ""}">${esc(f)}</span>`).join("");
    const el = $("folderF");
    if (el.__h !== h) { el.innerHTML = h; el.__h = h; }
    K.vis($("folder"), on);
  };

  /* ================= context window 面板（只放比例，照補充 1） ================= */
  const row = (sw, n, p) => `<div class="item"><span class="sw" style="background:${sw}"></span><span>${n}</span><span class="p">${p}</span></div>`;
  // pct：整個 context window 用了幾 %（null＝只畫外框，不顯示數字）；sub：名字後面的小字（例如「新對話」）
  L.panel = (t, a, pct, o = {}) => {
    const el = $("ctx"), fix = 5.3, blank = pct == null;
    const msg = blank ? 0 : Math.max(0, pct - fix), free = blank ? 0 : 100 - pct;
    const p = (v) => (blank ? "" : v);
    const h = `<div class="who"><i></i>GPT-6 Luna${o.sub ? `<small>${esc(o.sub)}</small>` : ""}</div>
      <div class="top"><span>Context window</span><b>${blank ? "" : Math.round(pct) + "%"}</b></div>
      <div class="bar">${blank ? "" : `<i style="width:${msg}%;background:#3b82f6"></i><i style="width:2.7%;background:#e2582a"></i><i style="width:1.2%;background:#2ea66a"></i><i style="width:1%;background:#d99200"></i><i style="width:.4%;background:#8e8e8e"></i>`}</div>
      ${row("#3b82f6", "Messages", p(msg.toFixed(1) + "%"))}${row("#e2582a", "System tools", p("2.7%"))}${row("#2ea66a", "MCP tools", p("1.2%"))}
      ${row("#d99200", "Memory files", p("1.0%"))}${row("#8e8e8e", "System prompt", p("0.4%"))}${row("#262626;border:1px solid #555", "Free space", p(free.toFixed(1) + "%"))}`;
    if (el.__h !== h) { el.innerHTML = h; el.__h = h; }
    el.style.opacity = (C((t - a) / 0.35) * (1 - C((t - (o.out == null ? 1e9 : o.out)) / 0.4))).toFixed(3);
    el.style.transform = `scale(${(0.94 + 0.06 * K.spring(t - a, 15, 0.7)).toFixed(4)})`;
  };

  /* ================= 時鐘（右上角） ================= */
  // m：從 0:00 起算的分鐘數（可以是小數，快轉時指針連續地轉）
  L.clock = (m, on = 1) => {
    const hh = Math.floor(m / 60) % 24, mm = Math.floor(m % 60);
    const a = ((m / 60) % 12) / 12 * Math.PI * 2, b = (m % 60) / 60 * Math.PI * 2;
    const s = `<svg viewBox="0 0 40 40" fill="none" stroke="#aeb8c6" stroke-width="2.4" stroke-linecap="round"><circle cx="20" cy="20" r="17"/>` +
      `<path d="M20 20L${(20 + 9 * Math.sin(a)).toFixed(1)} ${(20 - 9 * Math.cos(a)).toFixed(1)}"/><path d="M20 20L${(20 + 13 * Math.sin(b)).toFixed(1)} ${(20 - 13 * Math.cos(b)).toFixed(1)}" stroke="#e6e6e6"/></svg>` +
      `<span>${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}</span>`;
    const el = $("clock"); if (el.__h !== s) { el.innerHTML = s; el.__h = s; }
    K.vis(el, on);
  };

  /* ================= 小安、游標（照補充 1） ================= */
  L.fox = (id, x, y, s, pose, opts) => {
    const cv = $(id), g = cv.getContext("2d");
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, cv.width, cv.height);
    if (window.drawFox && s > 0 && (!opts || opts.alpha === undefined || opts.alpha > 0)) window.drawFox(g, x, y, s, pose, Object.assign({ shadowAlpha: 0, contactAlpha: 0.35 }, opts || {}));
  };
  L.cursor = (t, pts, click = []) => {
    const c = $("cur");
    if (!pts || t < pts[0][0] || t > pts[pts.length - 1][0]) { K.vis(c, 0); return; }
    const x = K.keys(t, pts.map((p) => [p[0], p[1]])), y = K.keys(t, pts.map((p) => [p[0], p[2]]));
    const pr = click.some((a) => Math.abs(t - a) < 0.12) ? 0.88 : 1;
    c.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${pr})`;
    K.vis(c, C((t - pts[0][0]) / 0.2) * (1 - C((t - (pts[pts.length - 1][0] - 0.25)) / 0.25)));
  };

  /* ================= 文字層（照補充 1） ================= */
  const showEl = (el, t, a, b, dy = 14) => {
    const v = C((t - a) / 0.3) * (1 - C((t - (b - 0.3)) / 0.3));
    K.vis(el, v);
    el.style.transform = v > 0 && t < a + 0.6 ? `translateY(${((1 - K.easeOut((t - a) / 0.5)) * dy).toFixed(1)}px)` : "none";
    return v;
  };
  L.showEl = showEl;
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
  L.sec = (t, n, title, a = 0.1, b = L.D || 1e9) => {   // 每段結束前 0.3 秒淡出（照補充 1 最後的版本）
    $("secN").textContent = n; $("secT").textContent = title; showEl($("sec"), t, a, b, 8); };
  L.illus = (t, list) => {
    let on = 0;
    for (const [a, b, h] of list) if (t >= a && t < b) { if ($("illus").__h !== h) { $("illus").innerHTML = h; $("illus").__h = h; } on = C((t - a) / 0.3) * (1 - C((t - (b - 0.3)) / 0.3)); }
    K.vis($("illus"), on);
  };
  L.label = (id, t, a, b, html, x, y) => { const el = $(id); if (el.__h !== html) { el.innerHTML = html; el.__h = html; } el.style.left = x + "px"; el.style.top = y + "px"; K.vis(el, C((t - a) / 0.4) * (1 - C((t - (b - 0.4)) / 0.4))); };
  // 段落結尾淡到全黑：最後一格（D − 1/30）剛好是 0，下一段的第一格也是全黑，接點前後一樣
  L.fadeOut = (t, d = 0.5) => { $("stage").style.opacity = (1 - C((t - (L.D - d)) / (d - 1 / 30))).toFixed(3); };
  // 第 2 版：段落開頭從全黑淡入、結尾淡到全黑（o.in、o.out 為 true 時）；兩個一起算，不會互相蓋掉
  L.stageFade = (t, o = {}) => {
    const fi = o.in ? C(t / 0.5) : 1, fo = o.out ? 1 - C((t - (L.D - 0.5)) / (0.5 - 1 / 30)) : 1;
    $("stage").style.opacity = Math.min(fi, fo).toFixed(3);
  };
  // 字幕的小字晚一點出現（大字不重新淡入）：CAPS 每一列 [a, b, 大字, 小字, 小字出現的秒數]
  L.caps2 = (t, CAPS) => {
    const row = CAPS.find(([a, b]) => t >= a && t < b);
    if (!row) { L.caps(t, []); return; }
    const [a, b, main, sub, sa] = row, on = sub && (sa == null || t >= sa);
    L.caps(t, [[a, b, main, on ? sub : ""]]);
    $("capS").style.opacity = on ? C((t - (sa == null ? a : sa)) / 0.35).toFixed(3) : 0;
  };
  // 推近紙條堆時（第 3 段最後、第 4 段），面板會跑到右上角時鐘底下：鏡頭一推近就先淡掉，拉回全景才出現（兩段同一條規則，接點一致）
  L.panelByZoom = (z) => { const o = 1 - C((z - 1) / 0.1); $("ctx").style.filter = o < 0.999 ? `opacity(${o.toFixed(3)})` : ""; };
  L.ILLUS = "情境是示意；面板借用 Claude Code 的 /context 樣式，比例不是實測";

  /* ================= 啟動 ================= */
  L.ready = () => Promise.all([document.fonts ? document.fonts.ready : Promise.resolve(), window.FOX2 && window.FOX2.ready ? window.FOX2.ready : Promise.resolve()]);
  L.start = (name, duration, render) => {
    window.ready = false;
    L.D = duration;
    L.ready().then(() => { K.scene({ duration, name, render }); window.ready = true; });
  };
})();
