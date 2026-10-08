/* ==========================================================================
   課程資料與共用行為
   - 新增一週：在 WEEKS 裡加上該週（status: "ready"、標題、摘要、連結、圖片、meta），
     再照 weeks/week03/ 的結構放檔案（一頁 index.html：每支影片一段，影片、片段、幾則重點；
     影片檔放在 video/NN-slug/）。首頁膠捲會自動多一格已開放的畫面。
   - still 是膠捲畫格用的大圖、thumb 是清單用的小圖，通常用這週第一支影片的 poster.jpg、thumb.jpg；
     meta 是首頁顯示的一行說明，例如「影片 1 分 23 秒・5 則重點」或「2 支影片・共 3 分鐘」。
   - i18n 放 title、summary、meta 的簡中、英文、越南文；已開放的週次三種都要有（tools/check.mjs 會檢查）。
     介面文字在 assets/i18n-strings.js，語言切換在 assets/i18n.js（要比這個檔案先載入）。
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
      summary: "Codex 為什麼以資料夾為工作單位：路徑、四個窗口、找回檔案；再用 AGENTS.md 當長期記憶，管理上下文；最後是作業：只用 Codex 收集佛羅倫斯美術館資料。",
      href: "weeks/week03/",
      thumb: "weeks/week03/video/01-report-journey/thumb.jpg",
      still: "weeks/week03/video/01-report-journey/poster.jpg",
      meta: "3 支影片＋2 支補充・共 15 分 35 秒",
      i18n: {
        "zh-Hans": {
          title: "AI 助理的工作文件夹",
          summary: "Codex 为什么以文件夹为工作单位：路径、四个窗口、找回文件；再用 AGENTS.md 当长期记忆，管理上下文；最后是作业：只用 Codex 收集佛罗伦萨美术馆数据。",
          meta: "3 个视频＋2 个补充・共 15 分 35 秒",
        },
        en: {
          title: "The AI Assistant's Working Folder",
          summary: "Why Codex works inside one folder: paths, four windows and finding files again; then AGENTS.md as long-term memory, and managing the context; and finally the homework: collecting Florence museum data with Codex only.",
          meta: "3 videos + 2 extras · 15 min 35 s in total",
        },
        vi: {
          title: "Thư mục làm việc của trợ lý AI",
          summary: "Vì sao Codex làm việc trong một thư mục: đường dẫn, bốn cửa sổ, cách tìm lại tệp; rồi dùng AGENTS.md làm bộ nhớ dài hạn và quản lý ngữ cảnh; cuối cùng là bài tập: chỉ dùng Codex để thu thập dữ liệu bảo tàng ở Florence.",
          meta: "3 video + 2 bổ sung · tổng cộng 15 phút 35 giây",
        },
      },
    },
    4: {
      status: "ready",
      title: "AI Agent 內建瀏覽器",
      summary: "AI Agent 控制瀏覽器的五種方法；用 Codex 內建瀏覽器開網頁、修好卡住的連線，實際做出方塊桌椅。",
      href: "weeks/week04/",
      thumb: "weeks/week04/video/01-built-in-browser/thumb.jpg",
      still: "weeks/week04/video/01-built-in-browser/poster.jpg",
      meta: "影片 2 分 24 秒・5 則重點",
      i18n: {
        "zh-Hans": {
          title: "AI Agent 内置浏览器",
          summary: "AI Agent 控制浏览器的五种方法；用 Codex 内置浏览器打开网页、修好卡住的连接，实际做出方块桌椅。",
          meta: "视频 2 分 24 秒・5 条重点",
        },
        en: {
          title: "AI Agent Built-in Browser",
          summary: "Five ways an AI agent can control a browser; using Codex's built-in browser to open pages, fix a stuck connection and build a block table and chair.",
          meta: "Video 2 min 24 s · 5 key points",
        },
        vi: {
          title: "Trình duyệt tích hợp của AI Agent",
          summary: "Năm cách AI Agent điều khiển trình duyệt; dùng trình duyệt tích hợp của Codex để mở trang web, sửa kết nối bị kẹt và làm bộ bàn ghế khối.",
          meta: "Video 2 phút 24 giây · 5 ý chính",
        },
      },
    },
    5: {
      status: "ready",
      title: "讓 Codex 做對：驗證與 context window",
      summary: "先寫一份驗證清單，讓 Codex 知道怎樣才算做好、做完自己檢查。每個模型有自己的 context window；中途換模型，新模型要整段重讀、快取失效，用量一次跳高。開工前選好模型，真的要換就帶交接摘要開新對話。",
      href: "weeks/week05/",
      thumb: "weeks/week05/video/01-verify-md/thumb.jpg",
      still: "weeks/week05/video/01-verify-md/poster.jpg",
      meta: "2 支影片＋2 支補充・共 12 分 32 秒",
      i18n: {
        "zh-Hans": {
          title: "让 Codex 做对：验证与 context window",
          summary: "先写一份验证清单，让 Codex 知道怎样才算做好、做完自己检查。每个模型有自己的 context window；中途换模型，新模型要整段重读、缓存失效，用量一下子跳高。开工前选好模型，真的要换就带交接摘要开新对话。",
          meta: "2 个视频＋2 个补充・共 12 分 32 秒",
        },
        en: {
          title: "Getting It Right with Codex: Verification and the Context Window",
          summary: "First, write a verification checklist so Codex knows what counts as done and checks its own work. Each model has its own context window; switching mid-chat makes the new model reread everything and breaks the cache, so usage jumps. Pick the model before you start, and if you must switch, open a new chat with a hand-off summary.",
          meta: "2 videos + 2 extras · 12 min 32 s in total",
        },
        vi: {
          title: "Để Codex làm đúng: kiểm chứng và context window",
          summary: "Trước hết, viết danh sách kiểm tra để Codex biết thế nào là xong và tự kiểm tra. Mỗi mô hình có context window riêng; đổi mô hình giữa chừng khiến mô hình mới phải đọc lại toàn bộ và bộ nhớ đệm mất hiệu lực, nên mức sử dụng tăng vọt. Hãy chọn mô hình trước khi bắt đầu; nếu buộc phải đổi, mở cuộc hội thoại mới kèm bản tóm tắt bàn giao.",
          meta: "2 video + 2 bổ sung · tổng cộng 12 phút 32 giây",
        },
      },
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

  // 多語系（assets/i18n.js）；萬一沒載入就用繁中
  const I18N = window.I18N;
  const t = (key, vars, zh) => (I18N ? I18N.t(key, vars) : zh);
  const pick = (w, field) => (I18N ? I18N.pick(w, field) : w[field]);

  /* ---------- 主題切換（和 Week 3 教材共用同一個設定） ---------- */
  const ICON_SUN = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
  const ICON_MOON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>';
  function isDark() {
    const t = document.documentElement.dataset.theme;
    if (t) return t === "dark";
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  }
  let paintTheme = () => {};
  function initTheme() {
    try {
      const saved = localStorage.getItem("lesson-theme");
      if (saved === "dark" || saved === "light") document.documentElement.dataset.theme = saved;
    } catch (e) { /* 無法讀取也沒關係 */ }
    const btn = $("#themeBtn");
    if (!btn) return;
    const paint = (paintTheme = () => {
      const d = isDark();
      btn.innerHTML = (d ? ICON_SUN : ICON_MOON) + `<span>${esc(d ? t("theme.light", null, "淺色") : t("theme.dark", null, "深色"))}</span>`;
      btn.setAttribute("aria-label", d ? t("theme.toLight", null, "切換成淺色") : t("theme.toDark", null, "切換成深色"));
    });
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
    const zh = !I18N || I18N.lang.startsWith("zh");
    const link = (m, dir) => {
      if (m < COURSE.firstWeek || m > COURSE.lastWeek) return "<span></span>";
      const w = WEEKS[m];
      const wk = t("week.n", { n: m }, `Week ${m}`);
      const label = dir < 0 ? `← ${wk}` : `${wk} →`;
      if (w && w.status === "ready") return `<a href="${r}${w.href}">${esc(label)}${zh ? "　" : " · "}${esc(pick(w, "title"))}</a>`;
      return `<span>${esc(t("pager.soon", { a: label }, `${label}（準備中）`))}</span>`;
    };
    el.innerHTML = link(n - 1, -1) + link(n + 1, 1);
  }

  function start() {
    initTheme();
    renderPager();
    document.addEventListener("langchange", () => { paintTheme(); renderPager(); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
