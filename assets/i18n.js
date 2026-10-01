/* ==========================================================================
   多語系：繁中（預設）、简中、English、Tiếng Việt
   - 語言的決定順序：網址 ?lang= → 上次選的（localStorage）→ 瀏覽器語言 → 繁中。
   - 預設的繁中直接寫在 HTML 裡（沒有 JavaScript 也看得到），其他語言這樣標：
       data-ui="key"                     全站共用的文字，從 assets/i18n-strings.js 取（{n} 這類變數取自同一個元素的 data-n）
       data-ui-attr="aria-label:key"     把共用文字放進屬性，多個用 ; 隔開
       data-i18n                        這一頁自己的內容：翻譯寫在 data-zh-hans、data-en、data-vi（可以含 <strong>、<code>）
       data-i18n-attr="content"         同上，但換的是屬性，例如 <meta name="description">
   - 語言選單自動加在 #themeBtn 前面。換語言時直接換掉頁面上的文字，並送出 "langchange" 事件。
   - 程式裡：I18N.lang、I18N.t("key", { n: 3 })、I18N.pick(WEEKS[3], "title")。
   - 放在 <head>、所有程式之前載入（不要 defer），i18n-strings.js 要再更前面。
   ========================================================================== */
(function () {
  "use strict";

  const LANGS = [
    { code: "zh-Hant", label: "繁體中文", short: "繁中" },
    { code: "zh-Hans", label: "简体中文", short: "简中" },
    { code: "en", label: "English", short: "EN" },
    { code: "vi", label: "Tiếng Việt", short: "VI" },
  ];
  const DEFAULT = "zh-Hant";
  const CODES = LANGS.map((l) => l.code);
  const DATA_KEY = { "zh-Hans": "zhHans", en: "en", vi: "vi" }; // data-zh-hans → dataset.zhHans
  const STORE = "site-lang";
  const STR = window.I18N_STRINGS || {};

  function fromBrowser() {
    const list = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || ""];
    for (const raw of list) {
      const l = String(raw).toLowerCase();
      if (/^zh-(hans|cn|sg|my)\b/.test(l)) return "zh-Hans";
      if (l.startsWith("zh")) return "zh-Hant";
      if (l.startsWith("vi")) return "vi";
      if (l.startsWith("en")) return "en";
    }
    return list[0] ? "en" : DEFAULT; // 其他語言的瀏覽器先給英文
  }

  function save(code) {
    try { localStorage.setItem(STORE, code); } catch (e) { /* 無法儲存也沒關係 */ }
  }

  function initial() {
    let q = null;
    try { q = new URLSearchParams(location.search).get("lang"); } catch (e) { /* 忽略 */ }
    if (CODES.includes(q)) { save(q); return q; } // 從分享的連結進來：之後換頁也維持這個語言
    try {
      const s = localStorage.getItem(STORE);
      if (CODES.includes(s)) return s;
    } catch (e) { /* 無法讀取也沒關係 */ }
    return fromBrowser();
  }

  // 簡體中文用 Noto Sans SC（同一個字的寫法和繁體字型不一樣），選到時才載入
  function loadSC() {
    if (document.getElementById("font-sc")) return;
    const link = document.createElement("link");
    link.id = "font-sc";
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700;900&display=swap";
    document.head.appendChild(link);
  }

  let lang = initial();
  document.documentElement.lang = lang; // 先設好，CSS 的 :lang() 字型一開始就對
  if (lang === "zh-Hans") loadSC();

  const fill = (s, vars) => (vars ? String(s).replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m)) : s);
  function raw(key, code) {
    const table = STR[code || lang];
    if (table && table[key] != null) return table[key];
    const base = STR[DEFAULT];
    return base && base[key] != null ? base[key] : key;
  }
  const t = (key, vars) => fill(raw(key), vars);

  // WEEKS[n] 的欄位：有這個語言的翻譯就用，沒有就用繁中
  function pick(obj, field) {
    const tr = obj && obj.i18n && obj.i18n[lang];
    return tr && tr[field] != null ? tr[field] : obj[field];
  }

  // 第一次換之前，記下元素原本（繁中）的內容，換回繁中時用
  const original = new WeakMap();
  function keep(el, prop, value) {
    let m = original.get(el);
    if (!m) original.set(el, (m = {}));
    if (!(prop in m)) m[prop] = value;
    return m[prop];
  }
  const setText = (el, html, isHtml) => { if (isHtml && el.tagName !== "TITLE") el.innerHTML = html; else el.textContent = html; };

  function apply(root) {
    root = root || document;
    document.documentElement.lang = lang;
    const dk = DATA_KEY[lang];

    root.querySelectorAll("[data-ui]").forEach((el) => {
      const zh = keep(el, "text", el.textContent);
      el.textContent = lang === DEFAULT ? zh : fill(raw(el.dataset.ui), el.dataset);
      el.hidden = el.textContent === "" && el.classList.contains("lang-note");
    });
    root.querySelectorAll("[data-ui-attr]").forEach((el) => {
      el.dataset.uiAttr.split(";").forEach((pair) => {
        const [attr, key] = pair.split(":").map((s) => s.trim());
        if (!attr || !key) return;
        const zh = keep(el, "@" + attr, el.getAttribute(attr));
        el.setAttribute(attr, lang === DEFAULT ? zh : fill(raw(key), el.dataset));
      });
    });
    root.querySelectorAll("[data-i18n]").forEach((el) => {
      const zh = keep(el, "html", el.tagName === "TITLE" ? el.textContent : el.innerHTML);
      const v = dk ? el.dataset[dk] : "";
      setText(el, v ? v : zh, true);
    });
    root.querySelectorAll("[data-i18n-attr]").forEach((el) => {
      const attr = el.dataset.i18nAttr;
      const zh = keep(el, "@" + attr, el.getAttribute(attr));
      const v = dk ? el.dataset[dk] : "";
      el.setAttribute(attr, v ? v : zh);
    });
    document.querySelectorAll(".lang-switch").forEach((w) => {
      w.querySelector("select").value = lang;
      w.querySelector(".lang-short").textContent = LANGS[CODES.indexOf(lang)].short;
    });
  }

  // 語言選單：看起來是一顆小按鈕（地球＋「繁中」），點下去是瀏覽器原生的選單
  const GLOBE = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.6" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M3.6 12h16.8M12 3.4c2.4 2.4 3.6 5.3 3.6 8.6s-1.2 6.2-3.6 8.6c-2.4-2.4-3.6-5.3-3.6-8.6s1.2-6.2 3.6-8.6z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>';
  function buildSwitch() {
    const anchor = document.getElementById("themeBtn");
    if (!anchor || document.querySelector(".lang-switch")) return;
    const wrap = document.createElement("label");
    wrap.className = "pill lang-switch";
    wrap.innerHTML = GLOBE + '<span class="lang-short"></span><select class="lang-select" data-ui-attr="aria-label:lang.label"></select>';
    const sel = wrap.querySelector("select");
    sel.setAttribute("aria-label", raw("lang.label"));
    LANGS.forEach((l) => {
      const o = document.createElement("option");
      o.value = l.code;
      o.lang = l.code;
      o.textContent = l.label;
      sel.appendChild(o);
    });
    sel.addEventListener("change", () => setLang(sel.value));
    anchor.parentNode.insertBefore(wrap, anchor);
  }

  function setLang(code) {
    if (!CODES.includes(code) || code === lang) return;
    lang = code;
    save(code);
    try {
      const u = new URL(location.href);
      if (code === DEFAULT) u.searchParams.delete("lang");
      else u.searchParams.set("lang", code);
      history.replaceState(history.state, "", u);
    } catch (e) { /* 網址沒改也沒關係 */ }
    if (code === "zh-Hans") loadSC();
    apply();
    document.dispatchEvent(new CustomEvent("langchange", { detail: { lang: code } }));
  }

  window.I18N = {
    LANGS, DEFAULT, t, pick, apply, setLang,
    get lang() { return lang; },
  };

  function start() {
    buildSwitch();
    apply();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
