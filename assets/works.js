/* ==========================================================================
   作品集：works/index.html（全部練習）和 works/<分類>/index.html（一個練習的作品）共用
   - 資料在 assets/works-data.js（window.WORKS），要比這個檔案先載入。
   - 頁面放一個 <main id="works" data-cat="分類代號">；沒有 data-cat 就是作品集首頁。
   - 分類頁的網址加 ?s=代號，就在網站裡打開那件作品：上方一條細列（回到列表、上一位／下一位、
     在新分頁開啟），下面整塊是學生的網頁（iframe，樣式和程式互不干擾）。方向鍵也能換人，Esc 回到列表。
   - 和週次頁同一套樣子：細線分隔、等寬編號、黃色點綴，不用卡片。
   ========================================================================== */
(function () {
  "use strict";

  const WORKS = window.WORKS || [];
  const I18N = window.I18N;
  const t = (key, vars, zh) => (I18N ? I18N.t(key, vars) : zh);
  const pick = (obj, field) => (I18N ? I18N.pick(obj, field) : obj[field]);
  const pad = (n) => String(n).padStart(2, "0");
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const $ = (sel, el = document) => el.querySelector(sel);

  const ICON_PREV = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const ICON_NEXT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const ICON_OPEN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 5h5v5M19 5l-8 8M17 14v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const ICON_BACK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H6M11 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  const main = document.getElementById("works");
  if (!main) return;
  let listTitle = "";
  const catSlug = main.dataset.cat || "";
  const cat = WORKS.find((c) => c.slug === catSlug);
  const catIndex = WORKS.indexOf(cat);

  /* ---------- 作品集首頁：全部練習 ---------- */
  function renderIndex() {
    const rows = WORKS.map((c, i) => {
      const n = c.items.length;
      const meta = n ? t("works.count", { n }, `${n} 件作品`) : t("works.empty", null, "作品整理中");
      const wk = c.week ? t("week.n", { n: c.week }, `Week ${c.week}`) : "";
      const metaLine = wk ? t("fmt.dot", { a: meta, b: wk }, `${meta}・${wk}`) : meta;
      const peek = c.items.slice(0, 4).map((it) => `<img src="${esc(c.slug)}/_thumbs/${esc(it.code)}.jpg" alt="" loading="lazy">`).join("");
      const inner = `<span class="cat-n">${pad(i + 1)}</span>` +
        `<span class="cat-text"><span class="cat-t">${esc(pick(c, "title"))}</span><span class="cat-m">${esc(metaLine)}</span></span>` +
        (peek ? `<span class="cat-peek" aria-hidden="true">${peek}</span>` : "");
      return `<li>${n ? `<a class="cat" href="${esc(c.slug)}/">${inner}</a>` : `<span class="cat is-empty">${inner}</span>`}</li>`;
    }).join("");
    main.innerHTML =
      `<div class="head"><p class="kicker"><span class="dot" aria-hidden="true"></span>${esc(t("works.kicker", null, "作品集"))}</p>` +
      `<h1>${esc(t("works.title", null, "作品集"))}</h1><p class="lede">${esc(t("works.lede", null, ""))}</p></div>` +
      (WORKS.length ? `<ol class="cats" aria-label="${esc(t("works.cats", null, "練習分類"))}">${rows}</ol>` : `<p class="works-none">${esc(t("works.none", null, ""))}</p>`);
  }

  /* ---------- 分類頁：一個練習的全部作品 ---------- */
  function renderList() {
    const n = cat.items.length;
    const kicker = `${t("works.kicker", null, "作品集")} ／ ${pad(catIndex + 1)}`;
    const shots = cat.items.map((it) =>
      `<li><a class="shot" href="?s=${encodeURIComponent(it.code)}" data-code="${esc(it.code)}">` +
      `<span class="shot-img"><img src="_thumbs/${esc(it.code)}.jpg" alt="" loading="lazy"></span>` +
      `<span class="shot-label">${esc(it.label)}</span></a></li>`).join("");
    main.innerHTML =
      `<div class="head"><p class="kicker"><span class="dot" aria-hidden="true"></span>${esc(kicker)}</p>` +
      `<h1>${esc(pick(cat, "title"))}</h1>` +
      `<p class="lede">${esc(n ? t("works.listLede", { n }, `${n} 件作品`) : t("works.none", null, ""))}</p></div>` +
      (n ? `<ol class="shots">${shots}</ol>` : "") +
      `<nav class="pager"><a href="../">← ${esc(t("works.title", null, "作品集"))}</a><span></span></nav>`;
    // 分類頁的標題由這裡決定（換語言時 assets/i18n.js 不要把它蓋回「作品集」）
    const titleEl = document.querySelector("title[data-ui]");
    if (titleEl) titleEl.removeAttribute("data-ui");
    listTitle = `${pick(cat, "title")}｜${t("works.title", null, "作品集")}｜Learning Analytics Tools`;
    if (!document.body.classList.contains("is-viewing")) document.title = listTitle;
  }

  /* ---------- 在網站裡看一件作品 ---------- */
  let viewer = null;
  function codeFromUrl() {
    try { return new URLSearchParams(location.search).get("s") || ""; } catch (e) { return ""; }
  }
  function urlFor(code) {
    const u = new URL(location.href);
    if (code) u.searchParams.set("s", code); else u.searchParams.delete("s");
    u.hash = "";
    return u.pathname + u.search;
  }
  function buildViewer() {
    viewer = document.createElement("div");
    viewer.className = "viewer";
    viewer.hidden = true;
    viewer.innerHTML =
      `<div class="vbar">` +
      `<a class="vback" href="${esc(urlFor(""))}">${ICON_BACK}<span class="vback-t"></span></a>` +
      `<p class="vwho"><span class="vlabel"></span><span class="vcount"></span></p>` +
      `<div class="vnav"><a class="round vprev">${ICON_PREV}</a><a class="round vnext">${ICON_NEXT}</a>` +
      `<a class="round vopen" target="_blank" rel="noopener">${ICON_OPEN}</a></div></div>` +
      `<iframe class="vframe"></iframe>`;
    document.body.appendChild(viewer);
    viewer.addEventListener("click", (e) => {
      const a = e.target.closest("a.vback, a.vprev, a.vnext");
      if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      go(a.classList.contains("vback") ? "" : a.dataset.code, true);
    });
  }
  function paintViewer(code) {
    const items = cat.items;
    const i = items.findIndex((it) => it.code === code);
    const it = items[i];
    const prev = items[(i - 1 + items.length) % items.length];
    const next = items[(i + 1) % items.length];
    $(".vback-t", viewer).textContent = pick(cat, "title");
    $(".vback", viewer).setAttribute("aria-label", t("works.back", null, "回到列表"));
    $(".vlabel", viewer).textContent = it.label;
    $(".vcount", viewer).textContent = t("works.of", { a: i + 1, b: items.length }, `${i + 1} / ${items.length}`);
    for (const [cls, target, key, zh] of [["vprev", prev, "works.prev", "上一位"], ["vnext", next, "works.next", "下一位"]]) {
      const a = $("." + cls, viewer);
      a.href = urlFor(target.code);
      a.dataset.code = target.code;
      a.setAttribute("aria-label", `${t(key, null, zh)}：${target.label}`);
      a.title = t(key, null, zh);
    }
    const open = $(".vopen", viewer);
    open.href = `${it.code}/`;
    open.setAttribute("aria-label", t("works.open", null, "在新分頁開啟"));
    open.title = t("works.open", null, "在新分頁開啟");
    // 換人時換一個新的 iframe：直接改 src 會在瀏覽器的上一頁紀錄裡多一筆，按上一頁會卡在學生的網頁裡
    let frame = $(".vframe", viewer);
    if (frame.dataset.code !== it.code) {
      const fresh = frame.cloneNode(false);
      fresh.dataset.code = it.code;
      fresh.src = `${it.code}/`;
      frame.replaceWith(fresh);
      frame = fresh;
    }
    frame.title = t("works.frame", { a: it.label }, `${it.label} 的作品`);
    document.title = `${it.label}｜${pick(cat, "title")}｜${t("works.title", null, "作品集")}`;
  }
  function show(code) {
    const ok = code && cat.items.some((it) => it.code === code);
    if (!ok) {
      if (viewer) viewer.hidden = true;
      document.body.classList.remove("is-viewing");
      if (listTitle) document.title = listTitle;
      const note = $(".works-missing", main);
      if (code && !note) main.querySelector(".head").insertAdjacentHTML("beforeend", `<p class="works-missing">${esc(t("works.missing", null, ""))}</p>`);
      return;
    }
    if (!viewer) buildViewer();
    paintViewer(code);
    viewer.hidden = false;
    document.body.classList.add("is-viewing");
  }
  function go(code, push) {
    if (push) history.pushState(null, "", urlFor(code));
    show(code);
    if (!code) {
      const back = main.querySelector(`.shot[data-code="${CSS.escape(viewer && $(".vframe", viewer).dataset.code || "")}"]`);
      if (back) back.focus({ preventScroll: false });
    }
  }

  function render() {
    if (!cat) return renderIndex();
    renderList();
    show(codeFromUrl());
  }

  render();
  if (cat) {
    main.addEventListener("click", (e) => {
      const a = e.target.closest("a.shot");
      if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      go(a.dataset.code, true);
    });
    window.addEventListener("popstate", () => show(codeFromUrl()));
    document.addEventListener("keydown", (e) => {
      if (!document.body.classList.contains("is-viewing") || e.altKey || e.ctrlKey || e.metaKey) return;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test((e.target && e.target.tagName) || "")) return;
      if (e.key === "ArrowLeft") go($(".vprev", viewer).dataset.code, true);
      else if (e.key === "ArrowRight") go($(".vnext", viewer).dataset.code, true);
      else if (e.key === "Escape") go("", true);
    });
  }
  document.addEventListener("langchange", () => {
    if (cat && viewer && !viewer.hidden) {
      renderList();
      paintViewer($(".vframe", viewer).dataset.code);
    } else render();
  });
})();
