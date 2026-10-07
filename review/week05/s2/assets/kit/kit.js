/* ==========================================================================
   素材共用程式（window.K）
   - 時間工具：clamp、lerp、ease、seg、spring、typed、keys
   - 顯示工具：fade、pop、rise（都只依 t 設定樣式，沒有內部狀態）
   - K.camera：推拉鏡頭（把畫布上的某一點放到畫面中央、放大 z 倍）
   - K.codex：產生 Codex 桌面版介面的 HTML；K.cx.*：對話裡的各種訊息
   - K.scene：預覽播放器。網址加 ?t=秒數 跳到那裡；?capture（或自動化瀏覽器）時隱藏播放列、不自動播放，
     給 opus-video 的 render.py / HyperFrames 逐格呼叫 window.render(t)
   ========================================================================== */
(function () {
  "use strict";
  const K = (window.K = {});

  /* ---------------- 時間工具 ---------------- */
  K.clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  K.lerp = (a, b, u) => a + (b - a) * u;
  K.ease = (x) => { x = K.clamp(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
  K.easeOut = (x) => 1 - Math.pow(1 - K.clamp(x), 3);
  K.seg = (t, a, b) => K.ease((t - a) / (b - a));
  K.spring = (x, w = 16, z = 0.72) => {
    if (x <= 0) return 0;
    const wd = w * Math.sqrt(1 - z * z);
    return 1 - Math.exp(-z * w * x) * (Math.cos(wd * x) + ((z * w) / wd) * Math.sin(wd * x));
  };
  // 打字：從 a 秒開始，每秒 cps 個字
  K.typed = (str, t, a, cps = 18) => {
    const chars = Array.from(str);
    return chars.slice(0, K.clamp(Math.floor((t - a) * cps), 0, chars.length)).join("");
  };
  K.typedDone = (str, a, cps = 18) => a + Array.from(str).length / cps;
  // 關鍵影格：[[時間, 值], ...]，中間用 ease 補
  K.keys = (t, ks) => {
    if (t <= ks[0][0]) return ks[0][1];
    for (let i = 1; i < ks.length; i++) {
      if (t <= ks[i][0]) return K.lerp(ks[i - 1][1], ks[i][1], K.ease((t - ks[i - 1][0]) / (ks[i][0] - ks[i - 1][0])));
    }
    return ks[ks.length - 1][1];
  };
  // 固定種子的亂數（同一個 seed 每次都一樣）
  K.rand = (seed) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

  /* ---------------- 顯示工具 ---------------- */
  K.vis = (el, v) => { el.style.opacity = v; el.style.visibility = v > 0.001 ? "visible" : "hidden"; };
  // a 秒淡入、b 秒前淡出（d 秒）
  K.fade = (el, t, a, b = 1e9, d = 0.3) => K.vis(el, K.clamp((t - a) / d) * (1 - K.clamp((t - (b - d)) / d)));
  // 彈出（縮放），base 是要保留的其他 transform
  K.pop = (el, t, a, b = 1e9, base = "") => {
    const s = K.spring(t - a, 18, 0.55), out = K.clamp((t - (b - 0.3)) / 0.3);
    K.vis(el, K.clamp((t - a) * 6) * (1 - out));
    el.style.transform = `${base} scale(${Math.max(0, s) * (1 - out * 0.3)})`;
  };
  // 往上浮現
  K.rise = (el, t, a, b = 1e9, dy = 24) => {
    const k = K.spring(t - a, 14, 0.8), out = K.clamp((t - (b - 0.3)) / 0.3);
    K.vis(el, K.clamp((t - a) * 4) * (1 - out));
    el.style.transform = `translateY(${(1 - k) * dy + out * 12}px)`;
  };
  // 依時間決定是否出現在版面上（不出現時 display:none，後面的東西會往上補）
  K.appear = (el, t, a, dy = 14) => {
    if (t < a) { el.style.display = "none"; return; }
    el.style.display = "";
    const k = K.spring(t - a, 14, 0.85);
    el.style.opacity = K.clamp((t - a) * 5);
    el.style.transform = `translateY(${(1 - k) * dy}px)`;
  };

  /* ---------------- 標註定位 ---------------- */
  // 元素在 root 裡的位置（不受 transform 影響，用 offset 累加）
  K.rectIn = (el, root) => {
    // SVG 元素沒有 offsetLeft：用它和外層 HTML 元素的畫面位置差，換算回未縮放的座標
    if (el.offsetLeft === undefined) {
      const p = el.parentElement, pr = K.rectIn(p, root);
      const a = el.getBoundingClientRect(), b = p.getBoundingClientRect();
      const s = p.offsetWidth ? b.width / p.offsetWidth : 1;
      return { x: pr.x + (a.left - b.left) / s, y: pr.y + (a.top - b.top) / s, w: a.width / s, h: a.height / s };
    }
    let x = 0, y = 0, n = el;
    while (n && n !== root) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
    return { x, y, w: el.offsetWidth, h: el.offsetHeight };
  };
  // 把橘框（callout）擺到一組元素外圍；cam 是鏡頭的狀態（K.camera 的回傳值），沒有就當作沒推拉
  K.frame = (box, els, root, pad = 8, cam = null) => {
    const rs = els.map((e) => K.rectIn(e, root));
    let x0 = Math.min(...rs.map((r) => r.x)) - pad, y0 = Math.min(...rs.map((r) => r.y)) - pad;
    let x1 = Math.max(...rs.map((r) => r.x + r.w)) + pad, y1 = Math.max(...rs.map((r) => r.y + r.h)) + pad;
    if (cam) {
      const f = (x, y) => [960 + (x - cam.cx) * cam.z, 540 + (y - cam.cy) * cam.z];
      [x0, y0] = f(x0, y0); [x1, y1] = f(x1, y1);
    }
    Object.assign(box.style, { left: x0 + "px", top: y0 + "px", width: x1 - x0 + "px", height: y1 - y0 + "px" });
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  };

  /* ---------------- 鏡頭 ---------------- */
  // keys：[[時間, 中心 x, 中心 y, 放大倍數], ...]；把 (x, y) 放在畫面中央
  // 鏡頭不會超出 1920×1080 的畫布（中心點會被夾在看得到整個畫面的範圍內）
  K.camera = (el, t, keys) => {
    const z = K.keys(t, keys.map((k) => [k[0], k[3]]));
    let cx = K.keys(t, keys.map((k) => [k[0], k[1]]));
    let cy = K.keys(t, keys.map((k) => [k[0], k[2]]));
    cx = K.clamp(cx, 960 / z, 1920 - 960 / z);
    cy = K.clamp(cy, 540 / z, 1080 - 540 / z);
    el.style.transform = `translate(${960 - cx * z}px, ${540 - cy * z}px) scale(${z})`;
    return { cx, cy, z };
  };

  /* ---------------- 圖示（24×24，線條） ---------------- */
  const P = {
    left: '<path d="M19 12H5M12 19l-7-7 7-7"/>',
    right: '<path d="M5 12h14M12 5l7 7-7 7"/>',
    sidebar: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>',
    home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    stack: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    at: '<circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8"/>',
    more: '<circle cx="5" cy="12" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="19" cy="12" r="1.2" fill="currentColor"/>',
    vmore: '<circle cx="12" cy="5" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="12" cy="19" r="1.2" fill="currentColor"/>',
    git: '<circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="7" r="2"/><path d="M6 7v10M18 9c0 5-7 4-11 8"/>',
    bell: '<path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10 20a2 2 0 0 0 4 0"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
    newchat: '<path d="M12 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7"/><path d="M18.4 2.6a2 2 0 0 1 2.8 2.8L12 14.6 8 16l1.4-4z"/>',
    pencil: '<path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z"/>',
    dot: '<circle cx="12" cy="12" r="7" fill="currentColor" stroke="none"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    folderOpen: '<path d="M3 17V7a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v1"/><path d="M3 17l2.4-6a1.5 1.5 0 0 1 1.4-1H21l-2.6 7a2 2 0 0 1-1.9 1.3H4.5A1.5 1.5 0 0 1 3 17z"/>',
    down: '<path d="M6 9l6 6 6-6"/>',
    chev: '<path d="M9 6l6 6-6 6"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
    thumbs: '<path d="M7 11v9H4v-9z"/><path d="M7 11l4-7a2 2 0 0 1 2 2.5L12 10h6a2 2 0 0 1 2 2.3l-1.2 6A2 2 0 0 1 16.8 20H7"/>',
    branch: '<path d="M14 4h6v6"/><path d="M20 4l-8 8"/><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/>',
    code: '<path d="M8 7l-5 5 5 5M16 7l5 5-5 5"/>',
    term: '<path d="M4 17l6-5-6-5M12 19h8"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    warn: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5v.01"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
    wave: '<path d="M5 10v4M9 7v10M13 4v16M17 8v8M21 11v2"/>',
    up: '<path d="M12 19V5M5 12l7-7 7 7"/>',
    list: '<path d="M4 6h16M4 12h16M4 18h10"/>',
    panel: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    file: '<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5"/>',
    spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
    sidechat: '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    agent: '<path d="M9 3h6M12 3v3"/><rect x="5" y="6" width="14" height="13" rx="3"/><path d="M9.5 12v1M14.5 12v1"/>',
    browser: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M7 6.5h.01M10 6.5h.01"/>',
    compact: '<path d="M4 7h16M4 12h10M4 17h6"/><path d="M17 14l3 3-3 3"/>',
    globeS: '<circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4a12 12 0 0 1 0 16M12 4a12 12 0 0 0 0 16"/>',
    termBox: '<rect x="3.5" y="4.5" width="17" height="15" rx="3"/><path d="M8 10l3 2.2L8 14.4M13 15h3"/>',
    expand: '<path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/>',
  };
  K.icon = (name, cls = "") => `<svg viewBox="0 0 24 24" class="${cls}" aria-hidden="true">${P[name] || ""}</svg>`;
  const I = K.icon;
  K.esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  /* ---------------- Codex 介面 ---------------- */
  // 預設是小安的 Mac：猜數字遊戲的專案資料夾是 game（和第一支影片的報告資料夾 Project 分開）；標題列是 macOS 的三顆紅綠燈
  K.codex = (o = {}) => {
    o = Object.assign({
      title: "猜數字小遊戲",
      folders: [
        { name: "game", open: true, chats: [{ title: "猜數字小遊戲", on: true }, { title: "介紹猜數字遊戲" }, { title: "介紹猜數字遊戲" }] },
        { name: "Project", open: true, chats: [{ title: "寫報告" }] },
        { name: "日常", open: false, chats: [] },
      ],
      recents: ["寫報告", "英文信件潤稿", "整理課堂筆記"],
      avatar: "AN",
      dot: 2,
      panel: true,
      model: "GPT-6 Astra Medium",
      messages: "",
      input: "",
    }, o);
    const chatRow = (c, fi, ci) => `<div class="cx-row chat${c.on ? " on" : ""}" id="cxChat${fi}_${ci}"><span>${K.esc(c.title)}</span>${c.meta ? `<span class="meta">${K.esc(c.meta)}</span>` : ""}</div>`;
    const folders = o.folders.map((f, fi) =>
      `<div class="cx-row folder" id="cxFolder${fi}">${I(f.open ? "folderOpen" : "folder")}<span>${K.esc(f.name)}</span></div>` +
      (f.open ? f.chats.map((c, ci) => chatRow(c, fi, ci)).join("") : "")).join("");
    const recents = o.recents.map((r, i) => `<div class="cx-row" id="cxRecent${i}"><span>${K.esc(r)}</span></div>`).join("");
    const panel = !o.panel ? "" : `<div class="cx-panel" id="cxPanel">
        <div class="h">Outputs${I("plus")}</div><div class="s">Create a file or site</div>
        <div class="h">Subagents</div><div class="s">${I("spark")} 0 running</div>
        <div class="h">Sources${I("plus")}</div><div class="s">${I("globe")} Web search</div><div class="s">${I("link")} View all</div>
      </div>`;
    return `<div class="cx" id="cx">
      <div class="cx-titlebar"><span class="lights"><i class="r"></i><i class="y"></i><i class="g"></i></span><span class="nav">${I("left")}${I("right")}${I("sidebar")}</span></div>
      <div class="cx-rail"><span class="on">${I("home")}</span>${I("stack")}${I("clock")}${I("at")}${I("more")}${I("git")}<span class="avatar">${K.esc(o.avatar)}</span></div>
      <div class="cx-side" id="cxSide">
        <div class="brand">Codex ${I("down")}<span class="tools">${I("bell")}${I("search")}</span></div>
        <div class="cx-row" id="cxNew">${I("newchat")}<span>New chat</span></div>
        <div class="cx-row">${I("dot")}<span>Your dot</span>${o.dot ? `<span class="badge">${o.dot}</span>` : ""}</div>
        <div class="group"></div>
        <div id="cxFolders">${folders}</div>
        <div class="section">Recents</div>
        <div id="cxRecents">${recents}</div>
      </div>
      <div class="cx-main" id="cxMain">
        <div class="cx-head">${I("folder")}<span id="cxTitle">${K.esc(o.title)}</span><span class="tools">${I("more")}<span class="sel">${I("list")}</span>${I("panel")}</span></div>
        <div class="cx-thread" id="cxThread"><div class="cx-msgs" id="cxMsgs">${o.messages}</div></div>
        ${K.cx.composer(o.input, o.model, "cxComposer")}
        ${panel}
      </div>
    </div>`;
  };

  // 對話裡的元件（回傳 HTML 字串；id 讓 render(t) 可以控制）
  K.cx = {
    time: (label, id = "") => `<div class="cx-time" ${id ? `id="${id}"` : ""}>${K.esc(label)}</div>`,
    user: (text, id = "", tools = true) => `<div class="cx-user" ${id ? `id="${id}"` : ""}><span class="txt">${K.esc(text)}</span>${tools ? `<span class="tools"><span>2:31 PM</span>${I("copy")}${I("pencil")}</span>` : ""}</div>`,
    worked: (label, id = "") => `<div class="cx-worked" ${id ? `id="${id}"` : ""}><span class="lbl">${K.esc(label)}</span>${I("chev")}</div>`,
    agent: (html, id = "") => `<div class="cx-agent" ${id ? `id="${id}"` : ""}>${html}</div>`,
    code: (lang, code, id = "") => `<div class="cx-codeblock" ${id ? `id="${id}"` : ""}><div class="bar">${I("code")}<span>${K.esc(lang)}</span><span class="r">${I("copy")}</span></div><pre>${K.esc(code)}</pre></div>`,
    actions: (id = "") => `<div class="cx-actions" ${id ? `id="${id}"` : ""}>${I("copy")}${I("thumbs")}${I("branch")}</div>`,
    file: (name) => `<span class="cx-file">${I("file")}${K.esc(name)}</span>`,
    composer: (text = "", model = "GPT-6 Astra Medium", id = "") => `<div class="cx-composer" ${id ? `id="${id}"` : ""}>
        <div class="text${text ? "" : " ph"}">${text ? K.esc(text) : "Do anything"}</div>
        <div class="row">${I("plus")}<span class="access">${I("warn")}Full access</span>${I("agent")}
          <span class="model">${K.esc(model)}${I("down")}</span>${I("mic")}<span class="send">${I("wave")}</span></div>
      </div>`,
  };
  // 輸入框打字：text 空的時候顯示 Do anything；有字時送出鍵變成箭頭
  K.setComposer = (comp, text, caret = true, t = 0) => {
    const box = comp.querySelector(".text"), send = comp.querySelector(".send");
    const blink = caret && Math.floor(t * 2.2) % 2 === 0;
    if (text) {
      box.classList.remove("ph");
      box.innerHTML = K.esc(text) + (caret ? `<span class="cx-caret" style="opacity:${blink ? 1 : 0}"></span>` : "");
      send.innerHTML = I("up");
    } else {
      box.classList.add("ph");
      box.textContent = "Do anything";
      send.innerHTML = I("wave");
    }
  };

  /* ---------------- 預覽播放器 ---------------- */
  K.scene = (o) => {
    const D = o.duration;
    const capture = /[?&]capture\b/.test(location.search) || navigator.webdriver === true;
    if (capture) document.body.classList.add("capture");
    const vp = document.getElementById("viewport");
    window.DURATION = D;
    window.render = (t) => o.render(K.clamp(t, 0, D));

    const fit = () => {
      if (capture) { vp.style.transform = "none"; return; }
      const W = innerWidth, Hh = innerHeight - 56, s = Math.min(W / 1920, Hh / 1080);
      vp.style.transform = `translate(${(W - 1920 * s) / 2}px, ${(Hh - 1080 * s) / 2}px) scale(${s})`;
    };
    addEventListener("resize", fit);
    fit();

    const m = location.search.match(/[?&]t=([\d.]+)/);
    let t = m ? Number(m[1]) : 0;
    if (capture) { window.render(t); return; }

    const ctl = document.createElement("div");
    ctl.id = "ctl";
    ctl.innerHTML = `<a href="../index.html">← 全部素材</a><span class="name">${K.esc(o.name || document.title)}</span>
      <button type="button" id="ctlPlay">❚❚</button><button type="button" id="ctlRestart">↺</button>
      <input type="range" id="ctlSeek" min="0" max="${D}" step="0.01" value="${t}"><span class="time" id="ctlTime"></span>`;
    document.body.appendChild(ctl);
    const playBtn = ctl.querySelector("#ctlPlay"), seek = ctl.querySelector("#ctlSeek"), time = ctl.querySelector("#ctlTime");
    let playing = !m, last = performance.now(), raf = 0;
    const paint = () => { window.render(t); seek.value = t; time.textContent = `${t.toFixed(2)} / ${D.toFixed(1)}s`; playBtn.textContent = playing ? "❚❚" : "▶"; };
    // 播放中才持續重畫；暫停時只在拖動或按鍵時畫一次
    const loop = (now) => {
      raf = 0;
      if (playing) { t += (now - last) / 1000; if (t >= D) t = 0; }
      last = now;
      paint();
      if (playing) raf = requestAnimationFrame(loop);
    };
    const go = () => { last = performance.now(); if (!raf) raf = requestAnimationFrame(loop); };
    playBtn.onclick = () => { playing = !playing; go(); };
    ctl.querySelector("#ctlRestart").onclick = () => { t = 0; playing = true; go(); };
    seek.oninput = () => { t = Number(seek.value); playing = false; go(); };
    addEventListener("keydown", (e) => {
      if (e.key === " ") { e.preventDefault(); playBtn.click(); }
      else if (e.key === "ArrowRight") { t = Math.min(D, t + 1 / 30); playing = false; go(); }
      else if (e.key === "ArrowLeft") { t = Math.max(0, t - 1 / 30); playing = false; go(); }
    });
    (document.fonts ? document.fonts.ready : Promise.resolve()).then(go);
  };
})();
