/* ==========================================================================
   週次頁共用：播放影片、片段按鈕、#t= 連結、播放清單
   - 一支影片一個 <section class="unit" id="NN-slug">，裡面放
     <video data-hls="video/NN-slug/hls/index.m3u8"> 和片段 <ol class="chapters">（button[data-t]）。
   - 網站放在 Cloudflare Pages，它不支援 Range 請求，mp4 無法跳轉，所以影片一律切成 HLS 小段
     （tools/publish-video.sh）。hls.js 在 assets/vendor/，要在這個檔案之前載入。
   - 一週有兩支以上影片時，自動做成播放清單：畫面上只顯示一支（播放器、片段、重點），
     清單（.reel）放在右邊（手機在上方），點了就換。清單從各個 section 自動產生，頁面不用另外寫。
     清單上緣的細線是觀看進度（記在這台瀏覽器的 localStorage）；影片播完會出現「下一支」。
     沒有 JavaScript 時，各個 section 照原本的順序排下來。
   - 網址：#t=秒數 是目前（第一支）影片的那個時間；#NN-slug 選那一支；#NN-slug&t=秒數 選那一支並跳到那個時間。
   - 補充教材：<section class="unit unit-supp" id="sN-slug">，放在這週影片後面；清單上寫「補充 N」，
     第一個補充教材前面有一行「補充教材」小標。
   ========================================================================== */
(function () {
  "use strict";

  const vids = Array.from(document.querySelectorAll("video[data-hls]"));
  const units = vids.map((v) => v.closest(".unit")).filter(Boolean);
  const reduceMotion = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const I18N = window.I18N;
  const tr = (key, zh) => (I18N ? I18N.t(key) : zh);

  // 影片要看了才接上 HLS（清單裡沒選到的影片先不下載）
  function attach(vid) {
    if (vid.dataset.attached) return;
    vid.dataset.attached = "1";
    const src = new URL(vid.dataset.hls, location.href).href;
    const Hls = window.Hls;
    if (Hls && Hls.isSupported()) {
      const hls = new Hls();
      let recovered = false;
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (!data.fatal) return;
        if (data.type === Hls.ErrorTypes.MEDIA_ERROR && !recovered) {
          recovered = true;
          hls.recoverMediaError();
          return;
        }
        hls.destroy();
        failed(vid);
      });
      hls.loadSource(src);
      hls.attachMedia(vid);
    } else if (vid.canPlayType("application/vnd.apple.mpegurl")) {
      // Safari 原生支援 HLS
      vid.addEventListener("error", () => failed(vid), { once: true });
      vid.src = src;
    } else {
      failed(vid);
    }
  }

  // 播不了時直接在畫面上說明，不讓學生對著黑畫面
  function failed(vid) {
    const box = vid.closest(".player") || vid.parentNode;
    if (box.querySelector(".video-error")) return;
    const p = document.createElement("p");
    p.className = "video-error";
    p.textContent = tr("video.failed", "影片載入失敗。請重新整理頁面；還是不行的話，換一個瀏覽器（Chrome、Edge、Safari）試試。");
    box.append(p);
  }

  function seek(vid, t, play) {
    attach(vid);
    const go = () => {
      vid.currentTime = t;
      if (play) vid.play().catch(() => {});
    };
    if (vid.readyState >= 1) go();
    else vid.addEventListener("loadedmetadata", go, { once: true });
  }

  function chapters(unit, vid) {
    const btns = Array.from(unit.querySelectorAll(".chapters button[data-t]"));
    const starts = btns.map((b) => Number(b.dataset.t));
    const mark = () => {
      let i = 0;
      starts.forEach((s, k) => { if (vid.currentTime + 0.05 >= s) i = k; });
      btns.forEach((b, k) => b.setAttribute("aria-current", k === i ? "true" : "false"));
    };
    btns.forEach((b) => b.addEventListener("click", () => seek(vid, Number(b.dataset.t), true)));
    vid.addEventListener("timeupdate", mark);
    vid.addEventListener("seeked", mark);
    mark();
  }

  vids.forEach((vid) => {
    chapters(vid.closest(".unit") || document, vid);
    // 一次只播一支
    vid.addEventListener("play", () => vids.forEach((v) => { if (v !== vid) v.pause(); }));
  });

  // #t=56、#02-slug、#02-slug&t=30
  function parseHash() {
    const h = decodeURIComponent(location.hash.slice(1));
    const mt = h.match(/(?:^|&)t=(\d+(?:\.\d+)?)$/);
    const id = h.replace(/&?t=\d+(?:\.\d+)?$/, "");
    const unit = id ? document.getElementById(id) : null;
    return { unit: units.includes(unit) ? unit : null, t: mt ? Number(mt[1]) : null };
  }

  const hash = parseHash();

  // 只有一支影片：照原本的版面
  if (units.length < 2) {
    vids.forEach(attach);
    if (hash.t != null && vids[0]) seek(vids[0], hash.t, false);
    if (hash.unit) hash.unit.scrollIntoView();
    return;
  }

  /* ---------- 播放清單 ---------- */
  const main = units[0].parentElement;
  const reel = document.createElement("nav");
  reel.className = "reel";
  reel.setAttribute("aria-label", "本週影片");
  reel.dataset.uiAttr = "aria-label:reel.label";
  const label = document.createElement("p");
  label.className = "reel-label";
  label.dataset.ui = "reel.label";
  label.textContent = "本週影片";
  const list = document.createElement("ol");
  reel.append(label, list);

  const fmt = (s) => { s = Math.round(s); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
  // 長度從播放清單（.m3u8）的各段秒數加起來，不用先下載影片
  function showLength(vid, el) {
    fetch(new URL(vid.dataset.hls, location.href).href)
      .then((r) => (r.ok ? r.text() : ""))
      .then((txt) => {
        let s = 0;
        for (const m of txt.matchAll(/#EXTINF:([\d.]+)/g)) s += Number(m[1]);
        if (s) el.textContent = fmt(s); else el.remove();
      })
      .catch(() => el.remove());
  }

  const items = units.map((unit, i) => {
    const vid = unit.querySelector("video[data-hls]");
    const num = unit.querySelector(".unit-num");
    const title = unit.querySelector(".unit-title [data-i18n]");
    const b = document.createElement("button");
    b.type = "button";
    b.className = "reel-item";
    b.innerHTML =
      '<span class="reel-bar" aria-hidden="true"><span></span></span>' +
      '<span class="reel-thumb"><img alt="" loading="lazy" width="800" height="450"><span class="reel-len"></span></span>' +
      '<span class="reel-text"><span class="reel-n"></span></span>';
    b.querySelector("img").src = (vid.getAttribute("poster") || "").replace(/poster\.jpg$/, "thumb.jpg");
    const n = b.querySelector(".reel-n");
    const supp = unit.classList.contains("unit-supp");
    if (supp && num) {
      // 補充教材：清單上寫「補充 1」（data-ui 跟著語言換），不寫編號
      n.dataset.ui = num.dataset.ui;
      n.dataset.n = num.dataset.n;
      n.textContent = num.textContent;
    } else {
      n.textContent = (num && num.dataset.n) || String(i + 1).padStart(2, "0");
    }
    // 第一個補充教材前面加一行小標「補充教材」
    if (supp && !list.querySelector(".reel-sep")) {
      const sep = document.createElement("li");
      sep.className = "reel-sep";
      sep.dataset.ui = "reel.supp";
      sep.textContent = "補充教材";
      list.append(sep);
    }
    // 標題複製 section 裡那一個（連翻譯屬性一起），換語言時 i18n.js 會一起換
    const t = title ? title.cloneNode(true) : document.createElement("span");
    if (!title) t.textContent = unit.querySelector(".unit-title").textContent;
    t.removeAttribute("id");
    t.classList.add("reel-t");
    b.querySelector(".reel-text").append(t);
    b.addEventListener("click", () => select(unit, { scroll: true, hash: true }));
    showLength(vid, b.querySelector(".reel-len"));
    const li = document.createElement("li");
    li.append(b);
    list.append(li);
    return b;
  });

  const head = main.querySelector(":scope > .head");
  if (head) head.after(reel); else main.prepend(reel);
  main.classList.add("has-reel");

  /* 觀看進度：清單上緣的細線看到哪就填到哪（記在這台瀏覽器） */
  const storeKey = (id) => `watched:${location.pathname}#${id}`;
  const readP = (id) => { try { return Math.min(1, Number(localStorage.getItem(storeKey(id))) || 0); } catch (e) { return 0; } };
  const writeP = (id, p) => { try { localStorage.setItem(storeKey(id), p.toFixed(3)); } catch (e) { /* 無法儲存也沒關係 */ } };

  units.forEach((unit, i) => {
    const vid = unit.querySelector("video[data-hls]");
    const item = items[i];
    let best = readP(unit.id), saved = best;
    const paint = () => {
      item.style.setProperty("--p", best);
      item.classList.toggle("is-done", best >= 0.95);
    };
    paint();
    vid.addEventListener("timeupdate", () => {
      if (!vid.duration || !isFinite(vid.duration)) return;
      const p = Math.min(1, vid.currentTime / vid.duration);
      if (p <= best) return;
      best = p;
      paint();
      if (best - saved >= 0.02 || best >= 0.95) { saved = best; writeP(unit.id, best); }
    });
    vid.addEventListener("play", () => item.classList.add("is-playing"));
    ["pause", "ended", "emptied"].forEach((ev) => vid.addEventListener(ev, () => item.classList.remove("is-playing")));
    vid.addEventListener("ended", () => {
      best = saved = 1;
      writeP(unit.id, 1);
      paint();
      if (units[i + 1]) nextUp(unit, units[i + 1], items[i + 1]);
    });
  });

  /* 影片播完：在畫面中間出現「下一支」，點了才播 */
  function nextUp(unit, next, nextItem) {
    const box = unit.querySelector(".player");
    if (!box || box.querySelector(".next-up")) return;
    const b = document.createElement("button");
    b.type = "button";
    b.className = "next-up";
    b.innerHTML = '<span class="next-k"></span><span class="next-t"></span>' +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/></svg>';
    const paint = () => {
      b.querySelector(".next-k").textContent = tr("reel.next", "下一支");
      b.querySelector(".next-t").textContent = nextItem.querySelector(".reel-t").textContent;
    };
    paint();
    document.addEventListener("langchange", paint);
    const vid = unit.querySelector("video[data-hls]");
    const off = () => {
      b.remove();
      document.removeEventListener("langchange", paint);
      vid.removeEventListener("play", off);
      vid.removeEventListener("seeking", off);
    };
    vid.addEventListener("play", off);
    vid.addEventListener("seeking", off);
    b.addEventListener("click", () => { off(); select(next, { play: true, scroll: true, hash: true }); });
    box.append(b);
  }

  /* 換影片：其他的暫停、收起來，這一支淡入（只往上移 10px） */
  let current = null;
  function select(unit, opts) {
    opts = opts || {};
    const vid = unit.querySelector("video[data-hls]");
    if (unit !== current) {
      const first = current === null;
      vids.forEach((v) => v.pause());
      units.forEach((u) => { u.hidden = u !== unit; });
      items.forEach((b, k) => b.setAttribute("aria-current", units[k] === unit ? "true" : "false"));
      current = unit;
      attach(vid);
      if (!first && !reduceMotion) {
        unit.querySelectorAll(".points li").forEach((li, k) => li.style.setProperty("--i", k));
        unit.classList.remove("is-entering");
        void unit.offsetWidth;
        unit.classList.add("is-entering");
      }
      if (opts.hash) {
        try { history.replaceState(history.state, "", `${location.pathname}${location.search}#${unit.id}`); } catch (e) { /* 網址沒改也沒關係 */ }
      }
      if (opts.scroll) {
        const top = unit.getBoundingClientRect().top;
        if (top < 0 || top > window.innerHeight * 0.55) unit.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
      }
    }
    if (opts.play) vid.play().catch(() => {});
  }

  select(hash.unit || units[0]);
  if (hash.t != null) seek(current.querySelector("video[data-hls]"), hash.t, false);
  if (hash.unit) hash.unit.scrollIntoView();

  // 網址的 # 變了（例如點了頁面裡的 #02-slug 連結）就換到那一支
  window.addEventListener("hashchange", () => {
    const h = parseHash();
    if (h.unit) select(h.unit, { scroll: true });
    if (h.t != null) seek(current.querySelector("video[data-hls]"), h.t, false);
  });

  if (I18N) I18N.apply(reel);
})();
