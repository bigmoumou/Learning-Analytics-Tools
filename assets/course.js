/* ==========================================================================
   課程資料與共用行為
   - 新增一週：在 WEEKS 裡加上該週（status: "ready"、標題、摘要、連結、圖片），
     再照 weeks/week03/ 的結構放檔案（index.html、lesson/、video/）。首頁膠捲會自動多一格已開放的畫面。
   - still 是膠捲畫格用的大圖（建議 1920×1080 的影片封面），thumb 是清單用的小圖。
   - 每一頁的 <body data-root="..."> 指到網站根目錄（入口是 "./"，weeks/weekNN/ 是 "../../"）。
   ========================================================================== */
(function () {
  "use strict";

  const COURSE = {
    title: "Learning Analytics Tools",
    subtitle: "Learning Analytics Tools Implementation Applications (NTNU)",
    repo: "https://github.com/bigmoumou/Learning-Analytics-Tools",
    firstWeek: 3,
    lastWeek: 16,
  };

  /* 每週資料。沒列出來的週次會顯示「準備中」。 */
  const WEEKS = {
    3: {
      status: "ready",
      title: "AI 助理的工作資料夾",
      summary: "Codex 為什麼以資料夾為工作單位：路徑、工作資料夾、四扇門、讀跑寫、相對路徑、迷路急救。",
      href: "weeks/week03/",
      thumb: "weeks/week03/video/thumb.jpg",
      still: "weeks/week03/video/poster.jpg",
      web: "網頁教學・約 30 分鐘",
      video: "影片教學・1 分 15 秒",
    },
  };

  window.COURSE = COURSE;
  window.WEEKS = WEEKS;

  const $ = (sel) => document.querySelector(sel);
  const root = () => (document.body && document.body.dataset.root) || "./";
  const pad = (n) => String(n).padStart(2, "0");

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  window.courseUtil = { pad, esc, root };

  /* ---------- 主題切換（和 Week 3 教材共用同一個設定） ---------- */
  const ICON_SUN = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
  const ICON_MOON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>';
  function isDark() {
    const t = document.documentElement.dataset.theme;
    if (t) return t === "dark";
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  }
  function initTheme() {
    try {
      const saved = localStorage.getItem("lesson-theme");
      if (saved === "dark" || saved === "light") document.documentElement.dataset.theme = saved;
    } catch (e) { /* 無法讀取也沒關係 */ }
    const btn = $("#themeBtn");
    if (!btn) return;
    const paint = () => {
      const d = isDark();
      btn.innerHTML = (d ? ICON_SUN : ICON_MOON) + `<span>${d ? "淺色" : "深色"}</span>`;
      btn.setAttribute("aria-label", d ? "切換成淺色" : "切換成深色");
    };
    paint();
    const changed = () => document.dispatchEvent(new CustomEvent("themechange"));
    btn.addEventListener("click", () => {
      const next = isDark() ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      try { localStorage.setItem("lesson-theme", next); } catch (e) { /* 無法儲存也沒關係 */ }
      paint();
      changed();
    });
    if (window.matchMedia) {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const onSystem = () => { if (!document.documentElement.dataset.theme) { paint(); changed(); } };
      if (mq.addEventListener) mq.addEventListener("change", onSystem);
    }
  }

  /* ---------- 每週頁：上一週／下一週 ---------- */
  function renderPager() {
    const el = $("#pager");
    if (!el) return;
    const n = Number(el.dataset.week);
    const r = root();
    const link = (m, dir) => {
      if (m < COURSE.firstWeek || m > COURSE.lastWeek) return "<span></span>";
      const w = WEEKS[m];
      const label = dir < 0 ? `← Week ${m}` : `Week ${m} →`;
      if (w && w.status === "ready") return `<a href="${r}${w.href}">${label}　${esc(w.title)}</a>`;
      return `<span>${label}（準備中）</span>`;
    };
    el.innerHTML = link(n - 1, -1) + link(n + 1, 1);
  }

  function start() {
    initTheme();
    renderPager();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
