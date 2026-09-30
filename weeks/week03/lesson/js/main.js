/* ==========================================================================
   頁面行為：圖示、主題切換、進度條、章節導覽、開場動畫、複製、範本樹、小測驗
   ========================================================================== */
(function () {
  "use strict";
  const L = window.Lesson;

  /* ---------------- 靜態圖示 ---------------- */
  document.querySelectorAll("[data-icon]").forEach((el) => {
    el.innerHTML = L.icon(el.dataset.icon);
  });

  /* ---------------- 主題切換 ---------------- */
  const root = document.documentElement;
  const themeBtn = document.getElementById("themeToggle");
  const themeIcon = document.getElementById("themeIcon");
  const themeLabel = document.getElementById("themeLabel");

  function storedTheme() {
    try { return localStorage.getItem("lesson-theme"); } catch (e) { return null; }
  }
  function isDark() {
    const t = root.dataset.theme;
    if (t === "dark") return true;
    if (t === "light") return false;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  }
  function paintToggle() {
    const dark = isDark();
    themeIcon.innerHTML = L.icon(dark ? "sun" : "moon");
    themeLabel.textContent = dark ? "淺色" : "深色";
    themeBtn.setAttribute("aria-label", dark ? "切換成淺色" : "切換成深色");
  }
  const saved = storedTheme();
  if (saved === "dark" || saved === "light") root.dataset.theme = saved;
  paintToggle();
  themeBtn.addEventListener("click", () => {
    const next = isDark() ? "light" : "dark";
    root.dataset.theme = next;
    try { localStorage.setItem("lesson-theme", next); } catch (e) { /* 無法儲存也沒關係 */ }
    paintToggle();
  });
  if (window.matchMedia) {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    if (mq.addEventListener) mq.addEventListener("change", paintToggle);
  }

  /* ---------------- 進度條 ---------------- */
  const bar = document.getElementById("progressBar");
  let ticking = false;
  function updateProgress() {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    bar.style.transform = `scaleX(${p})`;
    ticking = false;
  }
  window.addEventListener("scroll", () => {
    if (!ticking) { ticking = true; requestAnimationFrame(updateProgress); }
  }, { passive: true });
  updateProgress();

  /* ---------------- 章節導覽 ---------------- */
  const tocLinks = Array.from(document.querySelectorAll(".toc a"));
  const sections = tocLinks
    .map((a) => document.querySelector(a.getAttribute("href")))
    .filter(Boolean);
  function updateToc() {
    const y = window.innerHeight * 0.35;
    let current = sections[0];
    for (const s of sections) {
      if (s.getBoundingClientRect().top <= y) current = s;
    }
    tocLinks.forEach((a) => {
      const on = a.getAttribute("href") === "#" + current.id;
      a.classList.toggle("is-active", on);
      if (on) a.setAttribute("aria-current", "true"); else a.removeAttribute("aria-current");
    });
  }
  window.addEventListener("scroll", () => requestAnimationFrame(updateToc), { passive: true });
  updateToc();

  /* ---------------- 開場動畫 ---------------- */
  const art = document.getElementById("heroArt");
  const replay = document.getElementById("heroReplay");
  let heroRun = 0;

  async function playHero() {
    const run = ++heroRun;
    const bubbles = art.querySelectorAll(".ha-bubble");
    const boxes = art.querySelectorAll(".ha-box, .ha-file");
    const segs = art.querySelectorAll(".ha-addr span");
    const all = [...bubbles, ...boxes, ...segs];

    if (L.reduceMotion()) { art.classList.remove("is-playing"); return; }

    all.forEach((el) => el.classList.remove("is-on"));
    art.classList.add("is-playing");
    await L.sleep(350);
    for (const b of bubbles) {
      if (run !== heroRun) return;
      b.classList.add("is-on");
      await L.sleep(750);
    }
    for (let i = 0; i < boxes.length; i++) {
      if (run !== heroRun) return;
      boxes[i].classList.add("is-on");
      if (segs[i]) segs[i].classList.add("is-on");
      await L.sleep(i === boxes.length - 1 ? 0 : 420);
    }
    await L.sleep(500);
    if (run !== heroRun) return;
    art.classList.remove("is-playing");
    all.forEach((el) => el.classList.remove("is-on"));
  }
  replay.addEventListener("click", playHero);
  playHero();

  /* ---------------- 複製 ---------------- */
  document.querySelectorAll("[data-copy]").forEach((btn) => {
    const original = btn.innerHTML;
    btn.addEventListener("click", () => {
      const target = document.querySelector(btn.dataset.copy);
      if (!target) return;
      const text = target.textContent.trim();
      const done = (msg) => {
        btn.innerHTML = L.icon("check").replace("<svg", '<svg style="width:1em;height:1em"') + msg;
        setTimeout(() => { btn.innerHTML = original; }, 1600);
      };
      const selectFallback = () => {
        const range = document.createRange();
        range.selectNodeContents(target);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        done("已選取，按 Ctrl+C");
      };
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(() => done("已複製"), selectFallback);
        } else {
          selectFallback();
        }
      } catch (e) {
        selectFallback();
      }
    });
  });

  /* ---------------- 第 7 章：建議的資料夾樣子 ---------------- */
  const tpl = document.getElementById("templateTree");
  if (tpl) {
    const rows = [
      { name: "Project", dir: true, depth: 0, tag: "專案資料夾", tagClass: "chip-folder" },
      { name: "AGENTS.md", depth: 1, tag: "給 Codex 的規則", tagClass: "chip-agent" },
      { name: "data", dir: true, depth: 1, tag: "原始資料，不要改" },
      { name: "問卷_A班.csv", depth: 2 },
      { name: "問卷_B班.csv", depth: 2 },
      { name: "output", dir: true, depth: 1, tag: "產出都放這裡", tagClass: "chip-new" },
      { name: "report.md", depth: 2 },
      { name: "analyze.py", depth: 1, tag: "Codex 寫的程式" },
      { name: "README.md", depth: 1, tag: "給人看的說明" },
    ];
    rows.forEach((r) => tpl.append(L.treeRow(r)));
  }

  /* ---------------- 小測驗 ---------------- */
  const QUIZ = [
    {
      q: "小安在 C:\\Users\\an\\Desktop 啟動 Codex，請它「把報告存到 output/report.md」。報告會在哪裡？",
      opts: [
        "C:\\Users\\an\\Desktop\\Project\\output\\report.md",
        "C:\\Users\\an\\Desktop\\output\\report.md",
        "存在 Codex 的聊天紀錄裡，要另外下載",
      ],
      a: 1,
      why: "output/report.md 是相對路徑，起點是 Codex 被打開的資料夾。Codex 開在桌面，報告就會落在桌面的 output 資料夾，而不是 Project 裡的 output。",
    },
    {
      q: "Codex 在 VS Code 裡新增了 analyze.py。現在用檔案總管打開專案資料夾，看得到它嗎？",
      opts: [
        "看得到，因為它是同一個資料夾裡的真檔案",
        "看不到，要先從 Codex 匯出",
        "要重新開機才看得到",
      ],
      a: 0,
      why: "Codex、VS Code、檔案總管看的是硬碟上同一個資料夾。Codex 寫完，檔案就已經在那裡了。",
    },
    {
      q: "在預設的 Auto 模式下，下面哪件事 Codex 會先停下來問你？",
      opts: [
        "讀取專案裡的 data/問卷_A班.csv",
        "在專案資料夾裡執行 python analyze.py",
        "修改桌面上的一個檔案",
      ],
      a: 2,
      why: "工作資料夾裡的讀、寫、執行指令不用問。要改工作資料夾外面的檔案，或要上網，Codex 會先請你同意。",
    },
    {
      q: "要做教育統計期末作業，最適合在哪個資料夾啟動 Codex？",
      opts: [
        "C:\\Users\\an（整個家目錄）",
        "C:\\Users\\an\\Desktop（桌面）",
        "C:\\Users\\an\\Desktop\\Project",
      ],
      a: 2,
      why: "範圍剛好：作業需要的資料都在 Project 裡。開在桌面或整個家目錄，桌面上的其他東西、其他課程、照片都會被算進範圍。",
    },
    {
      q: "Codex 說「完成了」，但你不確定它動了哪些檔案。最直接的做法是？",
      opts: [
        "請 Codex 列出新增或修改的檔案完整路徑，或輸入 /diff",
        "關掉 Codex 再重開一次",
        "到桌面和下載資料夾慢慢找",
      ],
      a: 0,
      why: "直接問最快。/diff 會列出資料夾裡被改過的內容（資料夾要用 Git 管理）。也可以把「做完後列出完整路徑」寫進 AGENTS.md。",
    },
  ];

  const quizRoot = document.getElementById("quizRoot");
  if (quizRoot) {
    let answered = 0;
    let correct = 0;
    const scoreEl = L.h("div", { class: "q-score", "aria-live": "polite" },
      L.h("span", { class: "q-score-text", text: "還沒作答。" }),
      L.h("span", { class: "q-score-num", text: `0 / ${QUIZ.length}` })
    );
    const resetBtn = L.h("button", { class: "btn btn-sm", type: "button", html: L.icon("reset").replace("<svg", '<svg style="width:1em;height:1em"') + "重新作答" });

    function render() {
      quizRoot.innerHTML = "";
      answered = 0;
      correct = 0;
      QUIZ.forEach((item, qi) => {
        const explain = L.h("p", { class: "q-explain", "aria-live": "polite", hidden: true });
        const opts = L.h("div", { class: "q-opts", role: "group", "aria-label": `第 ${qi + 1} 題選項` });
        const buttons = item.opts.map((text, oi) => {
          const b = L.h("button", { class: "q-opt", type: "button" },
            L.h("span", { class: "q-letter", text: "ABC"[oi] }),
            L.h("span", { text })
          );
          b.addEventListener("click", () => {
            buttons.forEach((x) => { x.disabled = true; });
            const ok = oi === item.a;
            buttons[item.a].classList.add("is-right");
            if (!ok) b.classList.add("is-wrong");
            explain.hidden = false;
            explain.className = "q-explain " + (ok ? "good" : "bad");
            explain.textContent = (ok ? "答對了。" : "再想想。") + item.why;
            answered++;
            if (ok) correct++;
            updateScore();
          });
          opts.append(b);
          return b;
        });
        quizRoot.append(
          L.h("div", { class: "q-card" },
            L.h("p", { class: "q-num", text: `第 ${qi + 1} 題` }),
            L.h("p", { class: "q-text", text: item.q }),
            opts,
            explain
          )
        );
      });
      quizRoot.append(scoreEl);
      updateScore();
    }

    function updateScore() {
      const text = scoreEl.querySelector(".q-score-text");
      const num = scoreEl.querySelector(".q-score-num");
      num.textContent = `${correct} / ${QUIZ.length}`;
      if (answered === 0) text.textContent = "還沒作答。";
      else if (answered < QUIZ.length) text.textContent = `已作答 ${answered} 題，答對 ${correct} 題。`;
      else if (correct === QUIZ.length) text.textContent = "全對！你已經不會在 Codex 裡迷路了。";
      else text.textContent = `答對 ${correct} 題。回頭看看答錯的題目對應哪一章。`;
      if (answered === QUIZ.length && !scoreEl.contains(resetBtn)) scoreEl.append(resetBtn);
      if (answered < QUIZ.length && scoreEl.contains(resetBtn)) resetBtn.remove();
    }

    resetBtn.addEventListener("click", render);
    render();
  }
})();
