/* ==========================================================================
   首頁膠捲：片頭 + Week 3–16 排成一圈膠捲，繞著觀眾轉。
   - 畫面：原生 WebGL2（不用任何函式庫）。每一格是一段圓柱曲面，
     貼上用 2D canvas 畫的畫格（齒孔、邊緣字、畫面）。
   - 效能：只有膠捲在動的時候才重畫，停住時完全不耗顯示卡；解析度最多 1.5 倍，
     跑不動會自動降；畫格貼圖一張一張慢慢做，先做看得到的。
   - 操作：拖曳、滾輪、方向鍵、下方週次刻度；點已開放的畫格進入那一週。
   - 畫格內容來自 course.js 的 WEEKS：已開放的週次用 still 大圖，其他顯示「準備中」。
   - 瀏覽器不支援 WebGL2 時直接顯示「全部週次」清單。
   ========================================================================== */
(function () {
  "use strict";

  const COURSE = window.COURSE;
  const WEEKS = window.WEEKS;
  const { pad, esc, root } = window.courseUtil;
  const $ = (sel) => document.querySelector(sel);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const reduceMotion = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  // 多語系（assets/i18n.js）。畫格上的字是畫進貼圖裡的，所以換語言時重新載入首頁，並停在原本那一格
  const I18N = window.I18N || { t: (k) => k, pick: (o, f) => o[f], lang: "zh-Hant" };
  const tr = (key, vars) => I18N.t(key, vars);
  const wf = (w, field) => I18N.pick(w, field);
  const weekName = (n) => tr("week.n", { n });
  let frameNow = () => -1;
  document.addEventListener("langchange", () => {
    try { const i = frameNow(); if (i > 0) sessionStorage.setItem("film-frame", String(i)); } catch (e) { /* 無法儲存也沒關係 */ }
    window.location.reload();
  });

  /* ---------- 畫格資料：第 0 格是片頭，之後依序是每一週 ---------- */
  const frames = [{ kind: "leader" }];
  for (let n = COURSE.firstWeek; n <= COURSE.lastWeek; n++) {
    const w = WEEKS[n];
    frames.push(w && w.status === "ready" ? { kind: "ready", n, w } : { kind: "soon", n });
  }
  const N = frames.length;
  let latest = 0; // 開場停在最新開放的一週
  frames.forEach((f, i) => { if (f.kind === "ready") latest = i; });
  const mod = (i) => ((i % N) + N) % N;

  /* ---------- 左下角的介紹 ---------- */
  const info = $("#info");
  const els = {
    kicker: $("#infoKicker"), title: $("#infoTitle"), meta: $("#infoMeta"),
    cta: $("#infoCta"), ctaLabel: $("#infoCtaLabel"), alt: $("#infoAlt"), announce: $("#announce"),
  };

  // 一行長度說明，例如「影片 1 分 23 秒・5 則重點」（course.js 的 meta）
  const lengths = (w) => `<span class="nw">${esc(wf(w, "meta") || "")}</span>`;

  function describe(f) {
    if (f.kind === "leader") {
      return {
        kicker: "LEARNING ANALYTICS TOOLS・NTNU",
        title: tr("home.leaderTitle"),
        meta: tr("home.leaderMeta"),
        alt: tr("home.seeAll"), altAction: "index",
      };
    }
    if (f.kind === "ready") {
      return {
        kicker: tr("fmt.dot", { a: `WEEK ${pad(f.n)}`, b: tr("home.open") }), title: wf(f.w, "title"), metaHtml: lengths(f.w),
        href: root() + f.w.href, cta: tr("home.enter", { n: f.n }), ready: true,
      };
    }
    const newest = frames[latest];
    return {
      kicker: tr("fmt.dot", { a: `WEEK ${pad(f.n)}`, b: tr("home.soon") }),
      title: tr("home.soonTitle"),
      meta: tr("home.soonMeta"),
      alt: newest.kind === "ready" ? tr("home.latest", { n: newest.n }) : tr("home.seeAll"),
      altAction: newest.kind === "ready" ? "latest" : "index",
    };
  }

  let shown = -1;
  function showInfo(i, animate) {
    if (i === shown) return;
    shown = i;
    const d = describe(frames[i]);
    document.body.classList.toggle("spot-on", !!d.ready); // 舞台光：停在已開放的週次才亮（home.css 的 .spot）
    els.kicker.textContent = d.kicker;
    els.title.textContent = d.title;
    if (d.metaHtml) els.meta.innerHTML = d.metaHtml;
    else els.meta.textContent = d.meta;
    info.classList.toggle("is-ready", !!d.ready);
    els.cta.hidden = !d.href;
    if (d.href) { els.cta.href = d.href; els.ctaLabel.textContent = d.cta; }
    els.alt.hidden = !d.alt;
    if (d.alt) { els.alt.textContent = d.alt; els.alt.dataset.action = d.altAction; }
    if (animate) { info.classList.remove("swap"); void info.offsetWidth; info.classList.add("swap"); }
    scrubButtons.forEach((b) => b.setAttribute("aria-current", Number(b.dataset.i) === i ? "true" : "false"));
  }
  function announce(i) {
    const d = describe(frames[i]);
    els.announce.textContent = tr("fmt.colon", { a: d.kicker, b: d.title });
  }

  /* ---------- 右下角的週次刻度 ---------- */
  const scrub = $("#scrub");
  scrub.innerHTML = frames.map((f, i) => {
    if (f.kind === "leader") return "";
    const label = f.kind === "ready" ? tr("fmt.colon", { a: weekName(f.n), b: wf(f.w, "title") }) : tr("pager.soon", { a: weekName(f.n) });
    return `<li><button type="button" data-i="${i}" class="${f.kind === "ready" ? "is-ready" : ""}" aria-label="${esc(label)}">${pad(f.n)}</button></li>`;
  }).join("");
  const scrubButtons = Array.from(scrub.querySelectorAll("button"));

  /* ---------- 全部週次（清單） ---------- */
  $("#indexList").innerHTML = frames.filter((f) => f.kind !== "leader").map((f) => {
    if (f.kind === "ready") {
      return `<li><a class="index-row" href="${root()}${f.w.href}">
        <span class="n">${pad(f.n)}</span>
        <span class="t"><strong>${esc(wf(f.w, "title"))}</strong><small>${lengths(f.w)}</small></span>
        <span class="thumb"><img src="${root()}${f.w.thumb}" alt="" loading="lazy" width="800" height="450"></span>
      </a></li>`;
    }
    return `<li><div class="index-row is-soon"><span class="n">${pad(f.n)}</span><span class="t"><strong>${esc(tr("home.soon"))}</strong></span></div></li>`;
  }).join("");

  const viewBtn = $("#viewBtn");
  const indexView = $("#indexView");
  let indexOpen = false;
  let film = null; // WebGL 準備好之後才有

  function setIndex(open, moveFocus) {
    indexOpen = open;
    indexView.hidden = !open;
    document.body.classList.toggle("index-open", open);
    viewBtn.setAttribute("aria-expanded", String(open));
    const label = open ? tr("home.back") : tr("home.all");
    $("#viewLabel").textContent = label;
    viewBtn.setAttribute("aria-label", label);
    if (moveFocus) (open ? $("#indexTitle") : viewBtn).focus();
    if (film) { if (open) film.clearHover(); else film.wake(); }
  }
  viewBtn.addEventListener("click", () => setIndex(!indexOpen, true));

  /* ---------- 沒有 WebGL2：只留清單 ---------- */
  let fellBack = false;
  function fallback() {
    if (fellBack) return;
    fellBack = true;
    document.body.classList.remove("is-loading");
    document.body.classList.add("no-film");
    $("#hud").hidden = true;
    viewBtn.hidden = true;
    $(".stage").hidden = true;
    setIndex(true, false);
  }

  const canvas = $("#film");
  const gl = canvas.getContext("webgl2", {
    alpha: true, antialias: true, depth: false, stencil: false,
    premultipliedAlpha: true, preserveDrawingBuffer: false, powerPreference: "default",
  });
  if (!gl) { fallback(); return; }

  /* ======================================================================
     場景常數
     ====================================================================== */
  const R = 10;                       // 圓柱半徑
  const TH = (Math.PI * 2) / N;       // 每一格佔的角度
  const TEX_W = 1024, TEX_H = 768;    // 畫格貼圖（邏輯尺寸）
  const H = R * TH * (TEX_H / TEX_W); // 膠捲高度，跟貼圖比例一致
  const CAM_Y = 0.12;                 // 相機大約在膠捲中線的高度，上下兩側的透視變形才會對稱
  const CAM_BACK = -2.5;              // 相機在圓心前方：兩側畫格離得比較遠，像一圈繞著你的膠捲
  const FLOOR_Y = -H / 2 - 1.15;
  const NEAR = 0.1, FAR = 200;
  const IDLE_MS = 2500;               // 停止操作多久之後恢復自動前進
  const HOLD_MS = 3600;               // 自動前進時，每一格停多久（像放映機一格一格走）

  /* ---------- 著色器 ---------- */
  const FRAME_VS = `#version 300 es
    in vec2 aUv;
    uniform mat4 uProj; uniform vec3 uCam;
    uniform float uAngle, uTH, uR, uH, uBend;
    out vec2 vUv; out float vAng;
    void main() {
      float a = uAngle + (aUv.x - 0.5) * uTH;          // 這個頂點離正前方多少角度
      vec3 p = vec3(uR * sin(a), (aUv.y - 0.5) * uH, -uR * cos(a));
      p.y += uBend * a * a;                             // 轉得快時兩端微微翹起
      vUv = aUv; vAng = a;
      gl_Position = uProj * vec4(p - uCam, 1.0);
    }`;
  const FRAME_FS = `#version 300 es
    precision mediump float;
    uniform sampler2D uMap; uniform vec3 uHole, uFog; uniform float uHover;
    in vec2 vUv; in float vAng; out vec4 outColor;
    void main() {
      vec4 t = texture(uMap, vUv);
      vec3 c = mix(uHole, t.rgb, t.a);                  // 齒孔是透明的，透出後面的光
      c = mix(c, vec3(1.0), uHover * 0.07);
      float fog = smoothstep(0.22, 0.75, abs(vAng)) * 0.85;   // 越往兩側越淡
      outColor = vec4(mix(c, uFog, fog), 1.0);
    }`;
  const FLOOR_VS = `#version 300 es
    in vec2 aXZ;
    uniform mat4 uProj; uniform vec3 uCam; uniform float uY;
    out vec3 vW;
    void main() {
      vec3 p = vec3(aXZ.x, uY, aXZ.y);
      vW = p;
      gl_Position = uProj * vec4(p - uCam, 1.0);
    }`;
  const FLOOR_FS = `#version 300 es
    precision highp float;
    uniform vec3 uLine, uCam; uniform float uAlpha, uRot, uSpokes;
    in vec3 vW; out vec4 outColor;
    void main() {
      vec2 p = vW.xz;
      float r = length(p);
      float s = (atan(p.x, -p.y) + uRot) / 6.2831853 * uSpokes;   // 跟著膠捲轉的放射線
      float ls = abs(fract(s - 0.5) - 0.5) / fwidth(s);
      float rr = r * 0.8;                                          // 同心圓
      float lr = abs(fract(rr - 0.5) - 0.5) / fwidth(rr);
      float line = 1.0 - min(min(ls, lr), 1.0);
      float d = distance(vW.xz, uCam.xz);
      float a = line * (1.0 - smoothstep(5.0, 28.0, d)) * smoothstep(1.5, 5.0, r) * uAlpha;
      outColor = vec4(uLine * a, a);                               // 預乘 alpha
    }`;

  function program(vs, fs) {
    const make = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const p = gl.createProgram();
    gl.attachShader(p, make(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, make(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {};
    const count = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let k = 0; k < count; k++) {
      const name = gl.getActiveUniform(p, k).name;
      u[name] = gl.getUniformLocation(p, name);
    }
    return { p, u };
  }
  function strip(prog, attr, data, size) {
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog.p, attr);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    return { vao, count: data.length / size };
  }

  let frameProg, floorProg, arc, floorQuad;
  try {
    frameProg = program(FRAME_VS, FRAME_FS);
    floorProg = program(FLOOR_VS, FLOOR_FS);
    // 一格曲面：沿著圓柱切 28 段（所有畫格共用，角度在著色器裡算）
    const uv = [];
    for (let s = 0; s <= 28; s++) uv.push(s / 28, 0, s / 28, 1);
    arc = strip(frameProg, "aUv", uv, 2);
    floorQuad = strip(floorProg, "aXZ", [-45, -45, 45, -45, -45, 45, 45, 45], 2);
  } catch (e) {
    fallback();
    return;
  }

  /* ---------- 貼圖 ---------- */
  const aniso = gl.getExtension("EXT_texture_filter_anisotropic");
  const maxAniso = aniso ? Math.min(8, gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)) : 0;
  function texture(source) {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    if (source) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      if (maxAniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, maxAniso);
    } else {
      // 還沒畫好的畫格先用片基的顏色代替
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([13, 12, 11, 255]));
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    }
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }
  const blank = texture(null);
  const tex = frames.map(() => blank);

  /* ---------- 顏色跟著主題 ---------- */
  const col = { fog: [0, 0, 0], hole: [0, 0, 0], line: [0, 0, 0], alpha: 0.14 };
  const want = { fog: [0, 0, 0], hole: [0, 0, 0], line: [0, 0, 0], alpha: 0.14 };
  function readColors(instant) {
    const cs = getComputedStyle(document.documentElement);
    const rgb = (name) => {
      const m = /#([0-9a-f]{6})/i.exec(cs.getPropertyValue(name));
      const v = m ? parseInt(m[1], 16) : 0;
      return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
    };
    want.fog = rgb("--gl-bg"); want.hole = rgb("--gl-hole"); want.line = rgb("--gl-grid");
    want.alpha = parseFloat(cs.getPropertyValue("--gl-grid-alpha")) || 0.14;
    if (instant) {
      col.fog = want.fog.slice(); col.hole = want.hole.slice(); col.line = want.line.slice(); col.alpha = want.alpha;
    }
    wake();
  }
  document.addEventListener("themechange", () => readColors(false));

  /* ---------- 畫格圖案（2D canvas） ---------- */
  const small = Math.min(window.innerWidth, window.innerHeight) <= 600;
  const TS_MAIN = small ? 0.75 : 1;          // 片頭和已開放的畫格
  const TS_SOON = small ? 0.6 : 0.75;        // 「準備中」只有大字，用小一點的貼圖就夠
  const IMG = { x: 40, y: 118, w: 944, h: 532 };
  const MONO = '"JetBrains Mono", "Cascadia Mono", Consolas, monospace';
  const SANS_FAMILY = I18N.lang === "zh-Hans" ? "Noto Sans SC" : "Noto Sans TC"; // 簡中用簡體字型
  const SANS = I18N.lang === "zh-Hans"
    ? '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif'
    : '"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif';

  function rr(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }

  function drawFilm(g, f) {
    g.clearRect(0, 0, TEX_W, TEX_H);
    g.fillStyle = "#0d0c0b";
    g.fillRect(0, 0, TEX_W, TEX_H);
    // 齒孔：每格上下各 8 個，挖成透明
    g.save();
    g.globalCompositeOperation = "destination-out";
    for (let k = 0; k < 8; k++) {
      const x = k * 128 + 29;
      rr(g, x, 26, 70, 50, 9); g.fill();
      rr(g, x, TEX_H - 76, 70, 50, 9); g.fill();
    }
    g.restore();
    // 邊緣字：像底片邊上印的片名和格號
    const num = f.kind === "leader" ? "00" : pad(f.n);
    g.fillStyle = "rgba(214, 150, 52, .8)";
    g.font = `700 15px ${MONO}`;
    g.textBaseline = "alphabetic";
    g.textAlign = "left";
    g.fillText("LEARNING ANALYTICS TOOLS", 56, 107);
    g.fillText(`▸ ${num}`, 56, 675);
    g.textAlign = "right";
    g.fillText("NTNU", TEX_W - 56, 107);
    g.fillText(`${num}A`, TEX_W - 56, 675);
    g.textAlign = "left";
  }

  function drawLeader(g) {
    const { x, y, w, h } = IMG;
    g.fillStyle = "#1c1b19";
    g.fillRect(x, y, w, h);
    const cx = x + w * 0.7, cy = y + h / 2;
    // 片頭倒數的十字線和圓
    g.strokeStyle = "rgba(255,255,255,.2)"; g.lineWidth = 2;
    g.beginPath(); g.moveTo(x, cy); g.lineTo(x + w, cy); g.moveTo(cx, y); g.lineTo(cx, y + h); g.stroke();
    g.fillStyle = "rgba(255,255,255,.07)";
    g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, 158, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * 0.3); g.closePath(); g.fill();
    g.strokeStyle = "rgba(255,255,255,.55)"; g.lineWidth = 3;
    g.beginPath(); g.arc(cx, cy, 196, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = "rgba(255,255,255,.3)"; g.lineWidth = 2;
    g.beginPath(); g.arc(cx, cy, 158, 0, Math.PI * 2); g.stroke();
    g.fillStyle = "rgba(255,255,255,.88)";
    g.beginPath(); g.moveTo(cx - 26, cy - 36); g.lineTo(cx + 40, cy); g.lineTo(cx - 26, cy + 36); g.closePath(); g.fill();
    // 課程名稱
    g.fillStyle = "#f4f2ec";
    g.font = `900 60px ${SANS}`;
    ["LEARNING", "ANALYTICS", "TOOLS"].forEach((t, k) => g.fillText(t, x + 44, y + 150 + k * 66));
    g.fillStyle = "#f0b545";
    g.font = `700 19px ${MONO}`;
    g.fillText("NTNU・WEEK 03 — 16", x + 48, y + 368);
    g.fillStyle = "rgba(244,242,236,.72)";
    g.font = `500 24px ${SANS}`;
    g.fillText(tr("home.tagline"), x + 46, y + h - 44);
  }

  function drawReady(g, f, img) {
    const { x, y, w, h } = IMG;
    g.fillStyle = "#222";
    g.fillRect(x, y, w, h);
    if (img) {
      const s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
      const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
      g.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
    }
    // 右上角「WEEK 03・已開放」（標題寫在畫面下方的介紹裡，這裡不重複；封面左上角是影片自己的標題）
    const wk = `WEEK ${pad(f.n)}`, st = tr("home.open");
    g.font = `700 22px ${MONO}`;
    const w1 = g.measureText(wk).width;
    g.font = `700 20px ${SANS}`;
    const w2 = g.measureText(st).width;
    const pw = 58 + w1 + 22 + w2 + 22, px = x + w - 26 - pw;
    g.fillStyle = "rgba(10,10,10,.78)";
    rr(g, px, y + 24, pw, 46, 23); g.fill();
    g.fillStyle = "#f0b545";
    g.beginPath(); g.arc(px + 24, y + 47, 7, 0, Math.PI * 2); g.fill();
    g.font = `700 22px ${MONO}`;
    g.fillText(wk, px + 44, y + 55);
    g.fillStyle = "#fff";
    g.font = `700 20px ${SANS}`;
    g.fillText(st, px + 44 + w1 + 22, y + 55);
  }

  function drawSoon(g, f) {
    const { x, y, w, h } = IMG;
    g.fillStyle = "#15110c";
    g.fillRect(x, y, w, h);
    const glow = g.createRadialGradient(x + w / 2, y + h / 2, 10, x + w / 2, y + h / 2, w * 0.62);
    glow.addColorStop(0, "rgba(201,138,43,.16)");
    glow.addColorStop(1, "rgba(201,138,43,0)");
    g.fillStyle = glow;
    g.fillRect(x, y, w, h);
    g.textAlign = "center";
    g.strokeStyle = "rgba(214,150,52,.55)";
    g.lineWidth = 2.5;
    g.font = `700 290px ${MONO}`;
    g.strokeText(pad(f.n), x + w / 2, y + h / 2 + 100);
    g.textAlign = "left";
    g.fillStyle = "rgba(255,255,255,.5)";
    g.font = `700 19px ${MONO}`;
    g.fillText(`WEEK ${pad(f.n)}`, x + 32, y + 52);
    g.fillStyle = "rgba(255,255,255,.85)";
    g.font = `700 34px ${SANS}`;
    g.fillText(tr("home.soon"), x + 30, y + h - 34);
    g.textAlign = "right";
    g.fillStyle = "rgba(255,255,255,.38)";
    g.font = `700 15px ${MONO}`;
    g.fillText("COMING SOON", x + w - 32, y + h - 40);
    g.textAlign = "left";
  }

  // 所有畫格共用同一張 2D canvas：畫好、上傳到顯示卡，再畫下一格
  const scratch = document.createElement("canvas");
  const sg = scratch.getContext("2d");
  function paintFrame(f, img) {
    const s = f.kind === "soon" ? TS_SOON : TS_MAIN;
    scratch.width = Math.round(TEX_W * s);
    scratch.height = Math.round(TEX_H * s);
    const draw = (withImage) => {
      sg.setTransform(s, 0, 0, s, 0, 0);
      drawFilm(sg, f);
      sg.save();
      rr(sg, IMG.x, IMG.y, IMG.w, IMG.h, 10);
      sg.clip();
      if (f.kind === "leader") drawLeader(sg);
      else if (f.kind === "ready") drawReady(sg, f, withImage ? img : null);
      else drawSoon(sg, f);
      sg.restore();
    };
    draw(true);
    // 用 file:// 直接開的時候圖片會汙染 canvas，WebGL 不能用，改畫沒有圖片的版本
    if (img) { try { sg.getImageData(0, 0, 1, 1); } catch (e) { draw(false); } }
    return scratch;
  }

  function loadImage(src) {
    return new Promise((resolve) => {
      const im = new Image();
      im.decoding = "async";
      im.onload = () => (im.decode ? im.decode().catch(() => {}) : Promise.resolve()).then(() => resolve(im));
      im.onerror = () => resolve(null);
      im.src = src;
    });
  }
  function fontsReady() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    const titles = frames.filter((f) => f.w).map((f) => wf(f.w, "title")).join("");
    const jobs = [
      document.fonts.load(`900 60px "${SANS_FAMILY}"`, "LEARNINGANALYTICSTOOLS"),
      document.fonts.load(`700 44px "${SANS_FAMILY}"`, titles + tr("home.soon") + tr("home.open")),
      document.fonts.load(`500 24px "${SANS_FAMILY}"`, tr("home.tagline")),
      document.fonts.load(`700 20px "JetBrains Mono"`, "0123456789 WEEKNTUAOLSGRCMIY"),
    ];
    return Promise.race([Promise.all(jobs).catch(() => {}), new Promise((r) => setTimeout(r, 2500))]);
  }

  /* ======================================================================
     相機和版面
     ====================================================================== */
  const cam = [0, CAM_Y, CAM_BACK];            // 相機一直朝 -z 看，不旋轉
  const proj = new Float32Array(16);
  const fr = { l: -1, r: 1, t: 1, b: -1 };     // 近平面上的視窗範圍（點擊判斷也要用）
  let pxPerFrame = 600;
  let vw = 1, vh = 1;
  let dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  const brandEl = $(".brand");
  const dockEl = $(".dock");

  function layout() {
    const w = window.innerWidth, h = window.innerHeight;
    vw = w; vh = h;
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    // 中間那一格放在頂列和底部介紹之間，大小跟著空間調整
    const portrait = w / h < 0.8;
    const top = brandEl.getBoundingClientRect().bottom + 14;
    const bottom = Math.min(info.getBoundingClientRect().top, dockEl.getBoundingClientRect().top) - 14;
    const band = Math.max(90, bottom - top);
    const half = Math.atan2(R * Math.sin(TH / 2), R * Math.cos(TH / 2) + CAM_BACK);
    // 廣角透視會讓畫面左右兩側的膠捲看起來比中間高，放大倍數要算進去才不會壓到文字
    const flare = (fracW) => {
      const tanH = Math.tan(half) / fracW;
      let lo = 0, hi = Math.PI / 2;
      for (let k = 0; k < 24; k++) {
        const m = (lo + hi) / 2;
        if ((R * Math.sin(m)) / (R * Math.cos(m) + CAM_BACK) < tanH) lo = m; else hi = m;
      }
      return (R + CAM_BACK) / (R * Math.cos(lo) + CAM_BACK);
    };
    let fw = portrait ? w * 0.86 : Math.min(w * 0.44, (h * 0.5) / 0.75);
    for (let k = 0; k < 3; k++) fw = Math.min(fw, band / (0.75 * flare(fw / w))); // 一格（含齒孔）的寬高比是 4:3
    const tanH = Math.tan(half) / (fw / w);
    const tanV = tanH / (w / h);
    // 膠捲中線本來會落在哪一列像素，再把整個畫面往上或往下移到 band 的正中間
    const ndc0 = (0 - CAM_Y) / ((R + CAM_BACK) * tanV);
    const shift = ((1 - ndc0) / 2) * h - (top + band / 2);
    const t0 = NEAR * tanV, height = 2 * t0;
    fr.t = t0 - (shift * height) / h;
    fr.b = fr.t - height;
    fr.r = NEAR * tanH;
    fr.l = -fr.r;
    proj.fill(0);
    proj[0] = (2 * NEAR) / (fr.r - fr.l);
    proj[5] = (2 * NEAR) / (fr.t - fr.b);
    proj[8] = (fr.r + fr.l) / (fr.r - fr.l);
    proj[9] = (fr.t + fr.b) / (fr.t - fr.b);
    proj[10] = -(FAR + NEAR) / (FAR - NEAR);
    proj[11] = -1;
    proj[14] = (-2 * FAR * NEAR) / (FAR - NEAR);
    pxPerFrame = fw;
    wake();
  }
  let resizeQueued = false;
  window.addEventListener("resize", () => {
    if (resizeQueued) return;
    resizeQueued = true;
    requestAnimationFrame(() => { resizeQueued = false; layout(); });
  });

  // 螢幕上的一點對到哪一格：從相機射出一條線，算它打到圓柱的哪個角度
  function pick(x, y) {
    const dx = fr.l + (x / vw) * (fr.r - fr.l);
    const dy = fr.t - (y / vh) * (fr.t - fr.b);
    const dz = -NEAR;
    const A = dx * dx + dz * dz;
    const B = 2 * (cam[0] * dx + cam[2] * dz);
    const C = cam[0] * cam[0] + cam[2] * cam[2] - R * R;
    const t = (-B + Math.sqrt(B * B - 4 * A * C)) / (2 * A);
    const hy = cam[1] + t * dy;
    if (Math.abs(hy) > H / 2) return -1;
    const a = Math.atan2(cam[0] + t * dx, -(cam[2] + t * dz));
    return mod(Math.round(a / TH + pos));
  }

  /* ======================================================================
     畫一格畫面
     ====================================================================== */
  const hover = new Float32Array(N);
  function draw() {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // 地板
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(floorProg.p);
    const fu = floorProg.u;
    gl.uniformMatrix4fv(fu.uProj, false, proj);
    gl.uniform3fv(fu.uCam, cam);
    gl.uniform1f(fu.uY, FLOOR_Y);
    gl.uniform3fv(fu.uLine, col.line);
    gl.uniform1f(fu.uAlpha, col.alpha);
    gl.uniform1f(fu.uRot, pos * TH);
    gl.uniform1f(fu.uSpokes, N * 4);
    gl.bindVertexArray(floorQuad.vao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, floorQuad.count);
    gl.disable(gl.BLEND);

    // 膠捲：只畫看得到的那幾格
    gl.useProgram(frameProg.p);
    const u = frameProg.u;
    gl.uniformMatrix4fv(u.uProj, false, proj);
    gl.uniform3fv(u.uCam, cam);
    gl.uniform1f(u.uTH, TH);
    gl.uniform1f(u.uR, R);
    gl.uniform1f(u.uH, H);
    gl.uniform1f(u.uBend, bend);
    gl.uniform3fv(u.uHole, col.hole);
    gl.uniform3fv(u.uFog, col.fog);
    gl.uniform1i(u.uMap, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindVertexArray(arc.vao);
    for (let i = 0; i < N; i++) {
      let a = (i - pos) * TH;
      a = Math.atan2(Math.sin(a), Math.cos(a));   // 換算到 -π ~ π
      if (Math.abs(a) > 1.7) continue;             // 在相機後面或旁邊
      gl.uniform1f(u.uAngle, a);
      gl.uniform1f(u.uHover, hover[i]);
      gl.bindTexture(gl.TEXTURE_2D, tex[i]);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, arc.count);
    }
    gl.bindVertexArray(null);
  }

  /* ======================================================================
     狀態和操作
     ====================================================================== */
  // 從某一週回到首頁時，停在剛剛進去的那一格，開場只輕輕滑進來
  let start = latest, spin = 2.8;
  try {
    const saved = Number(sessionStorage.getItem("film-frame"));
    if (saved > 0 && saved < N) { start = saved; spin = 0.6; }
  } catch (e) { /* 無法讀取也沒關係 */ }
  let pos = start - (reduceMotion ? 0 : spin); // 目前轉到第幾格（可以是小數，會一直累加）
  let target = start;
  let vel = 0, bend = 0;
  let lastInput = performance.now();
  let introUntil = 0;
  let paused = reduceMotion;
  let hovered = -1;
  let drag = null;
  let leaving = null;
  let snapTimer = 0;
  let nextAuto = 0;     // 下一次自動前進的時間
  let gliding = false;  // 自動前進中（用比較慢的速度滑過去）
  let ready = false;    // 第一批畫格貼圖做好了沒
  const current = () => mod(Math.round(pos));
  frameNow = current;

  function touch() { lastInput = performance.now(); gliding = false; wake(); }
  function scheduleSnap(ms) {
    clearTimeout(snapTimer);
    snapTimer = setTimeout(() => { target = Math.round(target); wake(); }, ms);
  }
  function goTo(i, speak) {
    let d = mod(i - target);
    if (d > N / 2) d -= N;
    target = Math.round(target + d);
    touch();
    if (speak) announce(mod(i));
  }
  function step(d) { target = Math.round(target) + d; touch(); announce(mod(target)); }

  function enter(i) {
    const f = frames[i];
    if (!f || f.kind !== "ready" || leaving) return;
    goTo(i, false);
    try { sessionStorage.setItem("film-frame", String(i)); } catch (e) { /* 無法儲存也沒關係 */ }
    leaving = { t0: performance.now() };
    document.body.classList.add("is-leaving");
    setTimeout(() => { window.location.href = root() + f.w.href; }, reduceMotion ? 60 : 650);
  }
  function activate(i) {
    const f = frames[i];
    if (f.kind === "ready") enter(i);
    else if (f.kind === "leader" && current() === i) setIndex(true, true);
    else goTo(i, true);
  }

  // 從週次頁按「上一頁」回來時，把轉場恢復原狀
  window.addEventListener("pageshow", (e) => {
    if (!e.persisted) return;
    leaving = null;
    document.body.classList.remove("is-leaving");
    cam[2] = CAM_BACK;
    touch();
  });

  els.cta.addEventListener("click", (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    enter(current());
  });
  els.alt.addEventListener("click", () => {
    if (els.alt.dataset.action === "index") setIndex(true, true);
    else goTo(latest, true);
  });
  scrubButtons.forEach((b) => b.addEventListener("click", () => goTo(Number(b.dataset.i), true)));
  $("#prevBtn").addEventListener("click", () => step(-1));
  $("#nextBtn").addEventListener("click", () => step(1));
  const playBtn = $("#playBtn");
  function paintPlay() {
    playBtn.setAttribute("aria-pressed", String(paused));
    playBtn.setAttribute("aria-label", paused ? tr("home.play") : tr("home.pause"));
  }
  playBtn.addEventListener("click", () => { paused = !paused; paintPlay(); lastInput = 0; wake(); });
  paintPlay();

  document.addEventListener("keydown", (e) => {
    if (indexOpen) { if (e.key === "Escape") setIndex(false, true); return; }
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === "ArrowRight") { e.preventDefault(); step(1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); step(-1); }
    else if (e.key === "Enter" && (e.target === document.body || e.target === canvas)) activate(current());
  });

  window.addEventListener("wheel", (e) => {
    if (indexOpen || leaving) return;
    e.preventDefault();
    const raw = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    const d = raw * (e.deltaMode === 1 ? 32 : 1);
    target += clamp((d / pxPerFrame) * 1.1, -0.6, 0.6);
    touch();
    scheduleSnap(170);
  }, { passive: false });

  /* 拖曳和點擊 */
  const tag = $("#cursorTag");
  let mouse = null; // 滑鼠停在膠捲上的位置（膠捲轉動時要重新判斷指到哪一格）
  function tagText(i) {
    const f = frames[i];
    if (f.kind === "ready") return { text: tr("home.enter", { n: f.n }), soon: false };
    if (f.kind === "leader") return { text: current() === i ? tr("home.all") : tr("home.leaderTag"), soon: true };
    return { text: tr("fmt.dot", { a: weekName(f.n), b: tr("home.soon") }), soon: true };
  }
  function setHover(i, x, y) {
    if (i !== hovered) wake();
    hovered = i;
    canvas.classList.toggle("is-link", i >= 0);
    if (i < 0) { tag.classList.remove("is-on"); return; }
    const t = tagText(i);
    tag.textContent = t.text;
    tag.classList.toggle("is-soon", t.soon);
    tag.classList.add("is-on");
    tag.style.transform = `translate3d(${x + 16}px, ${y + 18}px, 0)`;
  }

  canvas.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || leaving) return;
    canvas.setPointerCapture(e.pointerId);
    const now = performance.now();
    drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, from: target, moved: false, axis: "x", lx: e.clientX, ly: e.clientY, lt: now, v: 0 };
    clearTimeout(snapTimer);
    touch();
  });
  canvas.addEventListener("pointermove", (e) => {
    if (drag && e.pointerId === drag.id) {
      const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
      if (!drag.moved && Math.hypot(dx, dy) > 6) {
        drag.moved = true;
        drag.axis = Math.abs(dx) >= Math.abs(dy) ? "x" : "y";
        canvas.classList.add("is-dragging");
        setHover(-1);
      }
      if (drag.moved) {
        const now = performance.now();
        const d = drag.axis === "x" ? dx : dy * 0.8;
        const moved = drag.axis === "x" ? e.clientX - drag.lx : (e.clientY - drag.ly) * 0.8;
        target = drag.from - d / pxPerFrame;
        const dt = Math.max(1, now - drag.lt) / 1000;
        drag.v = drag.v * 0.6 + (-moved / pxPerFrame / dt) * 0.4;
        drag.lx = e.clientX; drag.ly = e.clientY; drag.lt = now;
        touch();
      }
      return;
    }
    if (e.pointerType === "mouse" && !indexOpen && !leaving) {
      mouse = { x: e.clientX, y: e.clientY };
      setHover(pick(e.clientX, e.clientY), e.clientX, e.clientY);
    }
  });
  function endDrag(e, cancelled) {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    canvas.classList.remove("is-dragging");
    if (!d.moved && !cancelled) {
      const i = pick(e.clientX, e.clientY);
      if (i >= 0) activate(i);
    } else {
      const fresh = performance.now() - d.lt < 90 ? d.v : 0;
      target = Math.round(target + clamp(fresh * 0.28, -3, 3));
    }
    touch();
  }
  canvas.addEventListener("pointerup", (e) => endDrag(e, false));
  canvas.addEventListener("pointercancel", (e) => endDrag(e, true));
  canvas.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse" && !drag) { mouse = null; setHover(-1); } });
  canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); fallback(); });

  /* ======================================================================
     動畫迴圈：有東西在動才畫，停住就睡，等下一次自動前進再醒來
     ====================================================================== */
  let raf = 0, sleepTimer = 0;
  let last = 0;
  let slow = 0;           // 連續幾格畫得太慢（用來自動降低解析度）
  function wake() {
    clearTimeout(sleepTimer);
    if (!raf && !indexOpen && !fellBack) { last = 0; raf = requestAnimationFrame(tick); }
  }
  const near = (a, b) => Math.abs(a - b) < 0.002;
  function lerp3(c, w, e) { for (let k = 0; k < 3; k++) c[k] += (w[k] - c[k]) * e; }

  function tick(now) {
    raf = 0;
    if (!ready) return; // 開場那幾格貼圖還沒做好（舞台也還看不到）
    const measured = last ? (now - last) / 1000 : 0;
    const dt = Math.min(0.05, measured || 1 / 60);
    last = now;

    // 自動前進
    const canAuto = !paused && !drag && !leaving && hovered < 0 && ready;
    if (!canAuto || now - lastInput < IDLE_MS) nextAuto = 0;
    else if (!nextAuto) nextAuto = now + HOLD_MS;
    else if (now >= nextAuto) { target = Math.round(target) + 1; nextAuto = now + HOLD_MS; gliding = true; }

    const k = now < introUntil ? 2.3 : drag ? 20 : gliding ? 3.2 : 7;
    const prev = pos;
    pos += (target - pos) * (1 - Math.exp(-k * dt));
    if (Math.abs(target - pos) < 5e-4) pos = target;   // 差不到 0.3 像素就算停好
    vel += ((pos - prev) / dt - vel) * (1 - Math.exp(-10 * dt));
    if (Math.abs(vel) < 1e-3 && pos === target) vel = 0;
    bend = reduceMotion ? 0 : clamp(-vel * 0.05, -0.45, 0.45);

    const e = 1 - Math.exp(-9 * dt);
    lerp3(col.fog, want.fog, e); lerp3(col.hole, want.hole, e); lerp3(col.line, want.line, e);
    col.alpha += (want.alpha - col.alpha) * e;
    let hoverMoving = false;
    for (let i = 0; i < N; i++) {
      const goal = i === hovered ? 1 : 0;
      hover[i] += (goal - hover[i]) * (1 - Math.exp(-12 * dt));
      if (Math.abs(goal - hover[i]) < 0.003) hover[i] = goal; else hoverMoving = true;
    }
    if (leaving) {
      const t = clamp((now - leaving.t0) / 650, 0, 1);
      cam[2] = CAM_BACK - t * t * t * R * 0.55;
    }

    const c = current();
    if (c !== shown) showInfo(c, true);
    draw();
    if (mouse && !drag && !leaving && Math.abs(target - pos) > 1e-3) setHover(pick(mouse.x, mouse.y), mouse.x, mouse.y);

    const moving = pos !== target || vel !== 0 || hoverMoving || !!leaving || now < introUntil ||
      !near(col.fog[0], want.fog[0]) || !near(col.alpha, want.alpha);

    // 太慢就降解析度（只在連續動畫時量，睡醒的第一格不算）
    if (measured && moving) {
      slow = measured > 0.028 ? slow + 1 : Math.max(0, slow - 1);
      if (slow > 45 && dpr > 1) { dpr = Math.max(1, dpr - 0.25); slow = 0; layout(); }
    }

    if (indexOpen) return;
    if (moving) { if (!raf) raf = requestAnimationFrame(tick); return; }
    if (raf) return; // 這一格裡已經有人（例如 layout、setHover）排好下一格
    // 停住了：不再重畫，等到該自動前進的時候再醒來
    gliding = false;
    if (canAuto) {
      const at = nextAuto || lastInput + IDLE_MS + 1;
      sleepTimer = setTimeout(wake, Math.max(16, at - performance.now()));
    }
  }

  film = { wake, clearHover: () => { mouse = null; setHover(-1); } };

  /* ======================================================================
     開場：先做看得到的那幾格貼圖，其他的在空檔慢慢做
     ====================================================================== */
  showInfo(start, false);
  readColors(true);
  layout();

  const idle = window.requestIdleCallback
    ? (cb) => window.requestIdleCallback(cb, { timeout: 300 })
    : (cb) => setTimeout(cb, 30);
  const order = frames.map((f, i) => i).sort((a, b) => {
    const dist = (i) => { const d = mod(i - (start - 1)); return Math.min(d, N - d); };
    return dist(a) - dist(b);
  });
  const FIRST = 5; // 開場會轉過的幾格

  // 封面圖不擋開場：先畫沒有圖的版本，小縮圖（thumb）到了就換上，
  // 大圖（still）在背景下載，到了再換一次（手機只用小縮圖）
  const imgs = new Array(N).fill(null);
  const painted = new Array(N).fill(false);
  function paint(i) {
    let t = blank;
    try { t = texture(paintFrame(frames[i], imgs[i])); } catch (e) { /* 畫不出來就先留空 */ }
    if (tex[i] !== blank) gl.deleteTexture(tex[i]);
    tex[i] = t;
    painted[i] = true;
  }
  function gotImage(i, img) {
    if (!img || fellBack) return;
    imgs[i] = img;
    if (painted[i]) idle(() => { paint(i); wake(); });
  }
  frames.forEach((f, i) => {
    if (f.kind !== "ready") return;
    const first = f.w.thumb || f.w.still;
    loadImage(root() + first).then((img) => {
      gotImage(i, img);
      if (!small && f.w.still && f.w.still !== first) loadImage(root() + f.w.still).then((big) => gotImage(i, big));
    });
  });

  fontsReady().then(() => {
    let done = 0;
    const next = () => {
      if (fellBack || done >= order.length) return;
      const i = order[done++];
      paint(i);
      if (done === FIRST) {
        ready = true;
        document.body.classList.remove("is-loading");
        layout(); // 字型載入後文字高度可能改變，重新量一次
        introUntil = performance.now() + 2400;
        touch();
      } else {
        wake();
      }
      // 開場那幾格一格一個工作，避免一次卡住；其餘的等瀏覽器有空再做
      if (done < FIRST) setTimeout(next, 0); else idle(next);
    };
    next();
  });
})();
