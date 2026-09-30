/* ==========================================================================
   共用工具：window.Lesson
   - Lesson.h()           建立 DOM 元素
   - Lesson.icon()        取得 SVG 圖示字串（顏色跟隨 currentColor）
   - Lesson.iconFor()     依檔名挑圖示
   - Lesson.treeRow()     產生一列檔案樹（搭配 base.css 的 .tree-row）
   - Lesson.computer      教材情境：小安電腦裡的資料夾結構
   - Lesson.flatten()     把樹攤平成一列一列
   - Lesson.joinPath()    依 Windows / Mac 格式組路徑
   - Lesson.mount()       找到 [data-demo="名稱"] 並渲染
   - Lesson.sleep()       等待（減少動態時直接跳過）
   - Lesson.reduceMotion() 使用者是否要求減少動態
   ========================================================================== */
(function () {
  "use strict";

  const reduceMotion = () =>
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const sleep = (ms) =>
    new Promise((resolve) => setTimeout(resolve, reduceMotion() ? Math.min(ms, 30) : ms));

  function escapeHTML(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /* h("div", {class: "x", onclick: fn, html: "<b>..</b>"}, child1, "text") */
  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v == null || v === false) continue;
        if (k === "class") el.className = v;
        else if (k === "html") el.innerHTML = v;
        else if (k === "text") el.textContent = v;
        else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
        else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
        else if (k === "dataset") Object.assign(el.dataset, v);
        else el.setAttribute(k, v === true ? "" : v);
      }
    }
    for (const c of children.flat()) {
      if (c == null || c === false) continue;
      el.append(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    return el;
  }

  /* ---------------- 圖示（24×24，線條用 currentColor） ---------------- */
  const S = 'fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"';
  const FILE = `<path d="M6.5 3h7.5l4.5 4.5V20a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" ${S}/><path d="M14 3v4.5h4.5" ${S}/>`;
  const ICONS = {
    folder: `<path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h4.3l2 2h8.7A1.5 1.5 0 0 1 21 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z" fill="currentColor" fill-opacity=".25" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>`,
    "folder-open": `<path d="M3 17.5v-11A1.5 1.5 0 0 1 4.5 5h4.3l2 2h7.7A1.5 1.5 0 0 1 20 8.5V10" ${S}/><path d="M3 17.5 5.4 11a1.5 1.5 0 0 1 1.4-1H21.2l-2.5 8a1.5 1.5 0 0 1-1.4 1H4.5A1.5 1.5 0 0 1 3 17.5z" fill="currentColor" fill-opacity=".25" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>`,
    file: FILE + `<path d="M8.5 12.5h7M8.5 15.5h5" ${S}/>`,
    csv: FILE + `<path d="M8.5 11.5h7v6h-7zM8.5 14.5h7M12 11.5v6" ${S}/>`,
    md: FILE + `<path d="M8.5 17v-5l1.75 2 1.75-2v5M14.5 12v5M13.2 15.7l1.3 1.3 1.3-1.3" ${S}/>`,
    py: FILE + `<path d="M10.5 12l-2 2.25 2 2.25M13.5 12l2 2.25-2 2.25" ${S}/>`,
    img: FILE + `<path d="M8.5 17.5l2.3-2.8 1.8 1.8 1.2-1.2 1.7 2.2z" fill="currentColor" stroke="currentColor" stroke-width="1" stroke-linejoin="round"/><circle cx="10" cy="11.5" r="1.1" fill="currentColor"/>`,
    doc: FILE + `<path d="M8.5 11.5l1.1 5 1.4-3.6 1.4 3.6 1.1-5" ${S}/>`,
    pdf: FILE + `<path d="M8.5 17v-5h1.5a1.3 1.3 0 0 1 0 2.6H8.5" ${S}/>`,
    lock: `<rect x="5" y="10.5" width="14" height="10" rx="1.8" ${S}/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" ${S}/>`,
    unlock: `<rect x="5" y="10.5" width="14" height="10" rx="1.8" ${S}/><path d="M8 10.5V8a4 4 0 0 1 7.6-1.7" ${S}/>`,
    terminal: `<rect x="3" y="4.5" width="18" height="15" rx="2" ${S}/><path d="M7 9.5l3 2.5-3 2.5M12.5 15h4.5" ${S}/>`,
    code: `<path d="M8.5 7 3.5 12l5 5M15.5 7l5 5-5 5M13.5 4.5l-3 15" ${S}/>`,
    agent: `<path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9z" fill="currentColor" fill-opacity=".2" ${S}/><path d="M18.5 16v4M16.5 18h4" ${S}/>`,
    explorer: `<path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h4.3l2 2h8.7A1.5 1.5 0 0 1 21 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z" ${S}/><path d="M3 10h18" ${S}/>`,
    home: `<path d="M4 11 12 4l8 7v8.5a1 1 0 0 1-1 1h-4.5V15h-5v5.5H5a1 1 0 0 1-1-1z" ${S}/>`,
    chat: `<path d="M5 5h14a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 19 16h-8l-4.5 3.5V16H5a1.5 1.5 0 0 1-1.5-1.5v-8A1.5 1.5 0 0 1 5 5z" ${S}/>`,
    user: `<circle cx="12" cy="8.5" r="3.5" ${S}/><path d="M5 20a7 7 0 0 1 14 0" ${S}/>`,
    check: `<path d="M5 12.5 9.5 17 19 7.5" ${S}/>`,
    x: `<path d="M6 6l12 12M18 6 6 18" ${S}/>`,
    play: `<path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/>`,
    pause: `<path d="M8 5.5v13M16 5.5v13" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>`,
    next: `<path d="M5 12h14M13 6l6 6-6 6" ${S}/>`,
    prev: `<path d="M19 12H5M11 6l-6 6 6 6" ${S}/>`,
    reset: `<path d="M4 4.5v5h5" ${S}/><path d="M5.2 14.5A7 7 0 1 0 6.8 7.3L4 9.5" ${S}/>`,
    copy: `<rect x="8.5" y="8.5" width="11.5" height="11.5" rx="1.8" ${S}/><path d="M15.5 8.5V5.5a1.5 1.5 0 0 0-1.5-1.5H5.5A1.5 1.5 0 0 0 4 5.5V14a1.5 1.5 0 0 0 1.5 1.5h3" ${S}/>`,
    eye: `<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" ${S}/><circle cx="12" cy="12" r="2.8" ${S}/>`,
    pencil: `<path d="M4 20h4L19 9l-4-4L4 16z" ${S}/><path d="M13.5 6.5l4 4" ${S}/>`,
    sun: `<circle cx="12" cy="12" r="4" ${S}/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" ${S}/>`,
    moon: `<path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z" ${S}/>`,
  };

  function icon(name, cls) {
    const body = ICONS[name] || ICONS.file;
    return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"${cls ? ` class="${cls}"` : ""}>${body}</svg>`;
  }

  function iconFor(name, isDir, open) {
    if (isDir) return open ? "folder-open" : "folder";
    const ext = String(name).split(".").pop().toLowerCase();
    if (ext === "csv" || ext === "xlsx") return "csv";
    if (ext === "md" || ext === "txt") return "md";
    if (ext === "py" || ext === "js" || ext === "r") return "py";
    if (ext === "png" || ext === "jpg" || ext === "jpeg") return "img";
    if (ext === "docx" || ext === "doc") return "doc";
    if (ext === "pdf") return "pdf";
    return "file";
  }

  /* 產生一列檔案樹
     opts: { name, label, depth, dir, open, path, tag, tagClass, cls, button, onClick }
     - label：顯示用的中文別名（例如「桌面」），會以灰字附在 name 後面
     - tag：右側小標籤文字（例如「新檔案」）
     - button：true 時做成可點的 <button>
  */
  function treeRow(opts) {
    const o = Object.assign({ depth: 0, dir: false, open: true }, opts);
    const tagName = o.button ? "button" : "div";
    const row = h(tagName, {
      class: "tree-row" + (o.cls ? " " + o.cls : ""),
      type: o.button ? "button" : null,
      "data-path": o.path || null,
      style: { "--depth": o.depth },
      onclick: o.onClick || null,
    });
    row.style.setProperty("--depth", o.depth);
    const iconName = iconFor(o.name, o.dir, o.open);
    const iconCls = o.dir ? "ico ico-folder" : "ico ico-file";
    row.innerHTML =
      `<span class="${iconCls}">${icon(iconName)}</span>` +
      `<span class="name">${escapeHTML(o.name)}${o.dir ? "" : ""}` +
      (o.label ? ` <span style="color:var(--ink-3);font-weight:400">（${escapeHTML(o.label)}）</span>` : "") +
      `</span>` +
      (o.tag ? `<span class="chip tag ${o.tagClass || ""}">${escapeHTML(o.tag)}</span>` : "");
    return row;
  }

  /* ---------------- 教材情境 ----------------
     主角：小安，師大教育系學生，Windows 帳號 an。
     專案資料夾：桌面上的「Project」。 */
  const scenario = {
    student: "小安",
    user: "an",
    project: "Project",
    winHome: "C:\\Users\\an",
    macHome: "/Users/an",
    winProject: "C:\\Users\\an\\Desktop\\Project",
    macProject: "/Users/an/Desktop/Project",
  };

  /* 小安電腦的資料夾結構（家目錄以下）。label 是檔案總管顯示的中文名稱。 */
  const computer = {
    name: "an",
    label: "家目錄",
    dir: true,
    children: [
      {
        name: "Desktop", label: "桌面", dir: true,
        children: [
          { name: "螢幕擷取畫面 2026-09-12.png" },
          { name: "新增資料夾", dir: true, children: [] },
          {
            name: "Project", dir: true, project: true,
            children: [
              { name: "AGENTS.md" },
              {
                name: "data", dir: true,
                children: [
                  { name: "問卷_A班.csv" },
                  { name: "問卷_B班.csv" },
                  { name: "問卷_C班.csv" },
                ],
              },
              { name: "output", dir: true, children: [] },
              { name: "筆記.docx" },
            ],
          },
        ],
      },
      {
        name: "Documents", label: "文件", dir: true,
        children: [
          {
            name: "教學實習", dir: true,
            children: [{ name: "教案_第三週.docx" }],
          },
        ],
      },
      {
        name: "Downloads", label: "下載", dir: true,
        children: [
          { name: "問卷_A班 (1).csv" },
          { name: "課程大綱.pdf" },
        ],
      },
      {
        name: "Pictures", label: "圖片", dir: true,
        children: [{ name: "畢業旅行", dir: true, children: [] }],
      },
    ],
  };

  /* 攤平：回傳 [{node, depth, parts:[...名稱鏈], isDir}]
     parts 從家目錄之下開始，例如 ["Desktop","Project","data"] */
  function flatten(node, depth = 0, parts = [], out = []) {
    out.push({ node, depth, parts, isDir: !!node.dir });
    if (node.children) {
      for (const c of node.children) flatten(c, depth + 1, parts.concat(c.name), out);
    }
    return out;
  }

  /* 依作業系統組路徑。parts 為家目錄以下的名稱陣列 */
  function joinPath(os, parts) {
    if (os === "mac") return [scenario.macHome, ...parts].join("/");
    return [scenario.winHome, ...parts].join("\\");
  }

  function mount(name, fn) {
    const run = () => {
      document.querySelectorAll(`[data-demo="${name}"]`).forEach((el) => {
        if (el.dataset.mounted) return;
        el.dataset.mounted = "1";
        try {
          fn(el);
        } catch (err) {
          console.error(`[demo:${name}]`, err);
        }
      });
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run);
    else run();
  }

  /* 元素進入畫面時呼叫一次 cb（沒有 IntersectionObserver 就直接呼叫） */
  function onVisible(el, cb, threshold = 0.35) {
    if (!("IntersectionObserver" in window)) { cb(); return; }
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) { io.disconnect(); cb(); break; }
      }
    }, { threshold });
    io.observe(el);
  }

  window.Lesson = {
    h, icon, iconFor, treeRow, escapeHTML,
    scenario, computer, flatten, joinPath,
    mount, onVisible, sleep, reduceMotion,
  };
})();
