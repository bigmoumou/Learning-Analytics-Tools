/* ==========================================================================
   Demo: agent-loop —「一步一步看 Codex 工作」
   一段真實的 Codex 工作流程，分成 9 步：
   使用者說話 → 讀檔 → 執行指令 → 讀檔 → 建立檔案 → 出錯 → 修改檔案 → 再執行 → 回報。
   左邊是 Codex 的對話記錄，右邊是資料夾此刻的樣子。
   讀取：檔案內容從資料夾「飛進」對話；寫入：內容從對話「飛進」資料夾。
   ========================================================================== */
(function () {
  "use strict";
  const L = window.Lesson;
  if (!L) return;
  const h = L.h;

  const TYPE_MS = 26;   // 指令打字速度（每字）
  const LINE_MS = 150;  // 每行出現的間隔
  const FLY_MS = 750;   // 檔案飛行時間
  const AUTO_MS = 2600; // 自動播放間隔

  const winPath = (...parts) => L.joinPath("win", ["Desktop", "Project", ...parts]);

  /* ---------------- 動作類型 ---------------- */
  const KINDS = {
    user:   { label: "你的要求", chip: "" },
    read:   { label: "讀取", chip: "chip-folder" },
    cmd:    { label: "執行指令", chip: "chip-agent" },
    create: { label: "建立檔案", chip: "chip-new" },
    edit:   { label: "修改檔案", chip: "chip-mod" },
    report: { label: "回報", chip: "" },
  };
  const KIND_ORDER = ["user", "read", "cmd", "create", "edit", "report"];

  /* 檔案樹上的標記 */
  const MARKS = {
    read: { cls: "is-selected", tag: "讀取", tagClass: "chip-folder", fly: "in", tone: "read" },
    look: { cls: "is-selected", tag: "查看", tagClass: "chip-folder", fly: "in", tone: "read" },
    run:  { cls: "al-run", tag: "執行", tagClass: "chip-agent", fly: null },
    new:  { cls: "is-new", tag: "新增", tagClass: "chip-new", fly: "out", tone: "create" },
    mod:  { cls: "is-mod", tag: "修改", tagClass: "chip-mod", fly: "out", tone: "edit" },
    sum:  { cls: "is-new", tag: "新增", tagClass: "chip-new", fly: null },
  };

  /* ---------------- 資料夾（依出現的步驟） ---------------- */
  const TREE = [
    { id: "root",    name: "Project/", depth: 0, dir: true, from: 0 },
    { id: "agents",  name: "AGENTS.md",     depth: 1, from: 0 },
    { id: "analyze", name: "analyze.py",    depth: 1, from: 4 },
    { id: "data",    name: "data/",         depth: 1, dir: true, from: 0 },
    { id: "a",       name: "問卷_A班.csv",  depth: 2, from: 0 },
    { id: "b",       name: "問卷_B班.csv",  depth: 2, from: 0 },
    { id: "c",       name: "問卷_C班.csv",  depth: 2, from: 0 },
    { id: "output",  name: "output/",       depth: 1, dir: true, from: 0 },
    { id: "report",  name: "report.md",     depth: 2, from: 7 },
    { id: "chart",   name: "chart.png",     depth: 2, from: 7 },
    { id: "notes",   name: "筆記.docx",     depth: 1, from: 0 },
  ];
  const OUTPUT_FILLED_AT = 7;

  /* ---------------- 這次工作的 9 個步驟 ---------------- */
  const STEPS = [
    {
      kind: "user", what: "你只打了一句話",
      text: "你只是打了一段話。接下來 Codex 做的每件事，都發生在「Project」這個資料夾裡。",
      lines: [
        { t: "user", text: "幫我把 data 裡三個班的問卷合併，算出每一題的平均，存成一份報告。" },
      ],
      marks: {},
    },
    {
      kind: "read", what: "AGENTS.md", mono: true,
      text: "Codex 開工前會先讀專案裡的 AGENTS.md，就像先看工作室牆上的規則。",
      lines: [
        { t: "act", verb: "Read", target: "AGENTS.md" },
        { t: "quote", text: "報告用繁體中文。" },
        { t: "quote", text: "輸出的檔案放在 output/。" },
      ],
      marks: { agents: "read" },
    },
    {
      kind: "cmd", what: "ls data", mono: true,
      text: "Codex 在終端機裡執行指令來「看」資料夾（ls 就是「列出這裡有什麼」）。指令的起點，就是工作資料夾。",
      lines: [
        { t: "cmd", text: "ls data" },
        { t: "out", text: "問卷_A班.csv" },
        { t: "out", text: "問卷_B班.csv" },
        { t: "out", text: "問卷_C班.csv" },
      ],
      marks: { data: "look" },
    },
    {
      kind: "read", what: "data/問卷_A班.csv", mono: true,
      text: "它打開檔案讀內容，跟你用 Excel 打開是同一個檔案。",
      lines: [
        { t: "act", verb: "Read", target: "data/問卷_A班.csv" },
        { t: "quote", text: "學號,Q1,Q2,Q3" },
        { t: "quote", text: "41101,4,5,3" },
        { t: "quote", text: "41102,5,4,4" },
        { t: "more", text: "…" },
      ],
      marks: { a: "read" },
    },
    {
      kind: "create", what: "analyze.py", mono: true,
      text: "Codex 寫程式，其實就是在資料夾裡新增一個 .py 檔。你在 VS Code 或檔案總管都看得到它。",
      lines: [
        { t: "act", verb: "Added", target: "analyze.py", meta: "(+8 -0)" },
        { t: "add", text: "import pandas as pd" },
        { t: "add", text: "cols = [\"Q1\", \"Q2\", \"Q3\"]" },
        { t: "add", text: "dfs = [pd.read_csv(f\"data/問卷_{c}班.csv\")[cols] for c in \"ABC\"]" },
        { t: "add", text: "mean = pd.concat(dfs).mean()" },
        { t: "add", text: "open(\"output/report.md\", \"w\").write(mean.to_string())" },
        { t: "add", text: "print(\"已寫入 output/report.md\")" },
        { t: "add", text: "mean.plot.bar().figure.savefig(\"output/chart.png\")" },
        { t: "add", text: "print(\"已寫入 output/chart.png\")" },
      ],
      marks: { analyze: "new" },
    },
    {
      kind: "cmd", what: "python analyze.py（出錯了）", mono: true,
      text: "出錯很正常。Codex 會讀錯誤訊息，再回頭修改。這次是 C 班的檔案少了 Q3 這一欄，程式找不到它。",
      lines: [
        { t: "cmd", text: "python analyze.py" },
        { t: "err", text: "Traceback (most recent call last):" },
        { t: "err", text: "  File \"analyze.py\", line 3, in <module>" },
        { t: "err", text: "KeyError: 'Q3'" },
      ],
      marks: { analyze: "run" },
    },
    {
      kind: "edit", what: "analyze.py", mono: true,
      text: "修改＝直接改寫硬碟上的 analyze.py。紅色 − 是被拿掉的那行，綠色 + 是換上去的新行。",
      lines: [
        { t: "agent", text: "C 班的檔案沒有 Q3 這一欄，我讓程式遇到缺少的欄位就先留空。" },
        { t: "act", verb: "Edited", target: "analyze.py", meta: "(+1 -1)" },
        { t: "del", text: "dfs = [pd.read_csv(f\"data/問卷_{c}班.csv\")[cols] for c in \"ABC\"]" },
        { t: "add", text: "dfs = [pd.read_csv(f\"data/問卷_{c}班.csv\").reindex(columns=cols) for c in \"ABC\"]" },
      ],
      marks: { analyze: "mod" },
    },
    {
      kind: "cmd", what: "python analyze.py（成功）", mono: true,
      text: "程式執行後產生的檔案，也是落在這個資料夾裡（因為指令是在這裡執行的）。",
      lines: [
        { t: "cmd", text: "python analyze.py" },
        { t: "out", text: "已寫入 output/report.md" },
        { t: "out", text: "已寫入 output/chart.png" },
      ],
      marks: { analyze: "run", report: "new", chart: "new" },
    },
    {
      kind: "report", what: "交出結果",
      text: "Codex 說的「我做好了」，指的就是這些真實檔案。去這些路徑就找得到。",
      lines: [
        { t: "agent", text: "完成。我新增了 analyze.py，並在 output/ 產生 report.md 和 chart.png。C 班缺少 Q3，平均只算 A、B 兩班。" },
      ],
      marks: { analyze: "sum", report: "sum", chart: "sum" },
    },
  ];
  const LAST = STEPS.length - 1;

  /* 一步的文字大約要花多久才「寫完」（用來安排檔案飛行的時間） */
  function revealTime(step) {
    let t = 0;
    for (const ln of step.lines) t += ln.t === "cmd" ? Array.from(ln.text).length * TYPE_MS + 240 : LINE_MS;
    return t;
  }

  /* ---------------- 對話記錄的一行 ---------------- */
  const PREFIX = { user: "›", agent: "•", act: "•", cmd: "$", quote: "│", add: "+", del: "-" };

  function lineEl(ln, opt) {
    opt = opt || {};
    const tx = h("span", { class: "al-tx" });
    if (ln.t === "act") {
      tx.append(h("span", { class: "al-verb" }, ln.verb), " ", h("span", { class: "t-path" }, ln.target));
      if (ln.meta) tx.append(" ", h("span", { class: "al-meta" }, ln.meta));
    } else if (ln.t === "cmd") {
      tx.append(h("span", { class: "al-cmdtext t-cmd" }, opt.empty ? "" : ln.text));
    } else {
      tx.textContent = ln.text;
    }
    return h(
      "div",
      { class: "al-ln al-" + ln.t + (opt.fade ? " is-in" : "") },
      h("span", { class: "al-pfx" }, PREFIX[ln.t] || ""),
      tx
    );
  }

  /* ======================================================================
     掛載
     ====================================================================== */
  L.mount("agent-loop", (root) => {
    root.classList.add("al-root");

    let idx = -1;          // 目前顯示的步驟
    let playing = false;
    let timer = 0;
    let anim = 0;          // 動畫世代編號；改變就代表舊動畫作廢
    let pending = null;    // 還在打字中的區塊
    let prevIds = null;    // 上一次畫出的檔案樹（用來判斷哪些是新出現的）

    /* ---------- 控制列 ---------- */
    const prevBtn = h("button", {
      type: "button", class: "btn btn-sm al-prev",
      html: L.icon("prev") + "<span>上一步</span>",
      onclick: () => go(idx - 1),
    });
    const playBtn = h("button", {
      type: "button", class: "btn btn-sm btn-primary al-play", "aria-pressed": "false",
      title: "開始自動播放",
      html: '<span class="al-play-ico">' + L.icon("play") + "</span><span>自動播放</span>",
      onclick: () => togglePlay(),
    });
    const nextBtn = h("button", {
      type: "button", class: "btn btn-sm al-next",
      html: "<span>下一步</span>" + L.icon("next"),
      onclick: () => go(idx + 1),
    });
    const resetBtn = h("button", {
      type: "button", class: "btn btn-sm btn-quiet al-reset",
      html: L.icon("reset") + "<span>重來</span>",
      onclick: () => { setPlaying(false); go(0, { force: true }); },
    });
    const count = h("span", { class: "al-count" }, "1 / " + STEPS.length);

    const bar = h(
      "div", { class: "demo-bar" },
      h("div", { class: "demo-title" }, "一步一步看 Codex 工作"),
      h("div", { class: "al-controls" }, prevBtn, playBtn, nextBtn, resetBtn, count)
    );

    /* ---------- 步驟圓點 ---------- */
    const dots = STEPS.map((s, i) =>
      h("button", {
        type: "button",
        class: "al-dot al-k-" + s.kind,
        "aria-label": "第 " + (i + 1) + " 步：" + KINDS[s.kind].label + "，" + s.what,
        title: (i + 1) + ". " + KINDS[s.kind].label + "：" + s.what,
        onclick: () => go(i),
      })
    );
    const legend = h(
      "div", { class: "al-legend", "aria-hidden": "true" },
      h("span", { class: "al-legend-lead" }, "顏色代表這一步在做的事："),
      KIND_ORDER.map((k) => h("span", { class: "al-key al-k-" + k }, h("i"), KINDS[k].label))
    );
    const strip = h(
      "div", { class: "al-strip" },
      h("div", { class: "al-dots", role: "group", "aria-label": "跳到第幾步" }, dots),
      legend
    );

    /* ---------- 左：Codex 對話記錄 ---------- */
    const banner = h(
      "div", { class: "al-banner" },
      h("div", {}, h("span", { class: "al-brand" }, ">_"), " ", h("b", {}, "Codex")),
      h("div", {}, h("span", { class: "t-dim" }, "directory: "), h("span", { class: "t-path" }, "~\\Desktop\\Project"))
    );
    const term = h("div", {
      class: "term al-term", tabindex: "0", role: "region",
      "aria-label": "Codex 的對話與輸出記錄（可捲動）",
    }, banner);
    const leftPane = h(
      "div", { class: "pane al-pane-left" },
      h("div", { class: "pane-head" },
        h("span", { class: "dots" }, h("i"), h("i"), h("i")),
        h("span", { class: "pane-name" }, "Codex"),
        h("span", { class: "pane-path" }, "~\\Desktop\\Project")),
      term
    );

    /* ---------- 右：資料夾 ---------- */
    const tree = h("div", { class: "tree al-tree", role: "list", "aria-label": "Project 資料夾的內容" });
    const rightPane = h(
      "div", { class: "pane al-tree-pane" },
      h("div", { class: "pane-head" },
        h("span", { class: "dots" }, h("i"), h("i"), h("i")),
        h("span", { class: "pane-name" }, "資料夾現在的樣子")),
      h("div", { class: "pane-body" }, tree),
      h("div", { class: "al-tree-foot" }, "硬碟上的真實位置：", h("code", { class: "path" }, L.scenario.winProject))
    );

    /* ---------- 下：說明框 ---------- */
    const live = h("div", { class: "al-live", "aria-live": "polite", "aria-atomic": "true" });
    const explain = h(
      "div", { class: "al-explain al-k-user" },
      h("div", { class: "al-eyebrow" }, "這一步實際發生了什麼"),
      live
    );

    const bodyEl = h(
      "div", { class: "demo-body al-body" },
      h("div", { class: "al-cols" }, leftPane, rightPane),
      explain
    );

    root.append(bar, strip, bodyEl);

    /* ======================================================================
       對話記錄
       ====================================================================== */
    const pin = () => { term.scrollTop = term.scrollHeight; };

    function fillStatic(block, step) {
      block.replaceChildren(...step.lines.map((ln) => lineEl(ln)));
    }

    async function typeInto(node, text, token) {
      const cur = h("span", { class: "t-cursor" });
      const tn = document.createTextNode("");
      node.append(tn, cur);
      const chars = Array.from(text);
      for (let i = 0; i < chars.length; i++) {
        if (token !== anim) return;
        tn.data = chars.slice(0, i + 1).join("");
        pin();
        await L.sleep(TYPE_MS);
      }
      cur.remove();
    }

    async function fillAnimated(block, step, token) {
      block.replaceChildren();
      for (const ln of step.lines) {
        if (token !== anim) return;
        const isCmd = ln.t === "cmd";
        const el = lineEl(ln, { empty: isCmd, fade: !isCmd });
        block.append(el);
        pin();
        if (isCmd) {
          await typeInto(el.querySelector(".al-cmdtext"), ln.text, token);
          if (token !== anim) return;
          await L.sleep(240);
        } else {
          await L.sleep(LINE_MS);
        }
      }
    }

    /* 立刻把還在打字中的區塊補完 */
    function settle() {
      anim++;
      if (pending) {
        fillStatic(pending.block, pending.step);
        pending = null;
      }
    }

    function renderTranscript(animate) {
      if (animate) {
        const old = term.querySelector(".al-block.is-current");
        if (old) { old.classList.remove("is-current"); old.classList.add("is-past"); }
        const block = h("div", { class: "al-block is-current" });
        term.append(block);
        const token = ++anim;
        pending = { block, step: STEPS[idx] };
        fillAnimated(block, STEPS[idx], token).then(() => {
          if (token === anim) pending = null;
        });
      } else {
        term.querySelectorAll(".al-block").forEach((b) => b.remove());
        for (let i = 0; i <= idx; i++) {
          const b = h("div", { class: "al-block " + (i === idx ? "is-current" : "is-past") });
          fillStatic(b, STEPS[i]);
          term.append(b);
        }
      }
      pin();
    }

    /* ======================================================================
       檔案飛行：讀取 → 從資料夾飛進對話；寫入 → 從對話飛進資料夾
       ====================================================================== */
    function clearFlights() {
      bodyEl.querySelectorAll(".al-fly").forEach((e) => e.remove());
    }

    function startFlight(f) {
      if (!bodyEl.animate) return;
      const chip = h("span", {
        class: "al-fly al-k-" + f.m.tone,
        html: L.icon(L.iconFor(f.name, f.dir)) + "<span>" + L.escapeHTML(f.name) + "</span>",
      });
      bodyEl.append(chip);
      const b = bodyEl.getBoundingClientRect();
      const rr = f.row.getBoundingClientRect();
      const tr = term.getBoundingClientRect();
      const cw = chip.offsetWidth;
      const ch = chip.offsetHeight;
      const maxX = Math.max(0, b.width - cw - 4);
      const clampX = (x) => Math.max(4, Math.min(x, maxX));
      const rowPt = { x: clampX(rr.left - b.left + 20), y: rr.top - b.top + rr.height / 2 - ch / 2 };
      const termPt = { x: clampX(tr.left - b.left + 26), y: tr.bottom - b.top - 30 - ch / 2 };
      const from = f.m.fly === "in" ? rowPt : termPt;
      const to = f.m.fly === "in" ? termPt : rowPt;
      const at = (p, s) => "translate(" + p.x + "px, " + p.y + "px) scale(" + s + ")";
      const a = chip.animate([
        { transform: at(from, 0.92), opacity: 0 },
        { transform: at(from, 1), opacity: 1, offset: 0.14, easing: "cubic-bezier(.2,.7,.2,1)" },
        { transform: at(to, 1), opacity: 1, offset: 0.84 },
        { transform: at(to, 0.94), opacity: 0 },
      ], { duration: FLY_MS, delay: f.delay, fill: "both" });
      a.onfinish = () => chip.remove();
      setTimeout(() => chip.remove(), f.delay + FLY_MS + 500);
    }

    /* ======================================================================
       資料夾
       ====================================================================== */
    function renderTree(animate) {
      const marks = STEPS[idx].marks || {};
      const visible = TREE.filter((r) => r.from <= idx);
      const ids = new Set(visible.map((r) => r.id));
      const base = animate ? revealTime(STEPS[idx]) : 0;
      const flights = [];
      let order = 0;

      const rows = visible.map((r) => {
        const m = MARKS[marks[r.id]];
        const row = L.treeRow({
          name: r.name,
          depth: r.depth,
          dir: !!r.dir,
          open: r.id === "output" ? idx >= OUTPUT_FILLED_AT : true,
          label: r.id === "output" && idx < OUTPUT_FILLED_AT ? "空的" : "",
          cls: m ? m.cls : "",
          tag: m ? m.tag : r.id === "root" ? "工作資料夾" : "",
          tagClass: m ? m.tagClass : "chip-agent",
        });
        row.setAttribute("role", "listitem");
        row.dataset.id = r.id;
        const isNew = !!prevIds && !prevIds.has(r.id);
        if (isNew) row.classList.add("anim-pop");
        if (animate && m && m.fly) {
          if (m.fly === "in") {
            row.classList.add("anim-flash");
            flights.push({ row, m, name: r.name, dir: !!r.dir, delay: 120 + order * 140 });
          } else {
            const delay = Math.max(base - 150, 150) + order * 140;
            const land = delay + Math.round(FLY_MS * 0.7);
            if (isNew) {
              row.style.animationDelay = land + "ms";
            } else {
              row.classList.add("anim-flash");
              row.style.animationDelay = land + "ms";
            }
            flights.push({ row, m, name: r.name, dir: !!r.dir, delay });
          }
          order++;
        }
        return row;
      });

      tree.replaceChildren(...rows);
      prevIds = ids;
      flights.forEach(startFlight);
    }

    /* ======================================================================
       說明框與控制列
       ====================================================================== */
    function pathsCard() {
      const items = [
        [winPath("analyze.py")],
        [winPath("output", "report.md")],
        [winPath("output", "chart.png")],
      ];
      return h(
        "div", { class: "al-paths" },
        h("div", { class: "al-paths-title" }, "這三個檔案是真的，你現在就能在檔案總管找到："),
        h("ul", {}, items.map(([p]) =>
          h("li", {}, h("span", { class: "chip chip-new" }, "新增"), h("code", { class: "path" }, p))
        ))
      );
    }

    function renderExplain() {
      const s = STEPS[idx];
      const k = KINDS[s.kind];
      explain.className = "al-explain al-k-" + s.kind;
      const kids = [
        h("span", { class: "al-sr" }, "第 " + (idx + 1) + " 步，共 " + STEPS.length + " 步。"),
        h("div", { class: "al-what" },
          h("span", { class: "chip " + k.chip }, k.label),
          h("strong", { class: s.mono ? "is-mono" : "" }, s.what)),
        h("p", { class: "al-explain-text" }, s.text),
      ];
      if (s.kind === "report") kids.push(pathsCard());
      live.replaceChildren(...kids);
    }

    function renderChrome() {
      count.textContent = (idx + 1) + " / " + STEPS.length;
      dots.forEach((d, i) => {
        d.classList.toggle("is-done", i < idx);
        d.classList.toggle("is-current", i === idx);
        if (i === idx) d.setAttribute("aria-current", "step");
        else d.removeAttribute("aria-current");
      });
      prevBtn.setAttribute("aria-disabled", String(idx <= 0));
      nextBtn.setAttribute("aria-disabled", String(idx >= LAST));
    }

    /* ======================================================================
       前進 / 後退 / 播放
       ====================================================================== */
    function go(n, opts) {
      opts = opts || {};
      n = Math.max(0, Math.min(LAST, n));
      if (n === idx && !opts.force) return;
      settle();
      clearFlights();
      // 只有「往前一步」才播動畫；跳步、後退都是直接畫出結果
      const animate = idx >= 0 && n === idx + 1 && !L.reduceMotion();
      idx = n;
      renderTranscript(animate);
      renderTree(animate);
      renderExplain();
      renderChrome();
      if (playing && idx >= LAST) setPlaying(false);
      else schedule();
    }

    function schedule() {
      clearTimeout(timer);
      if (!playing) return;
      timer = setTimeout(() => go(idx + 1), AUTO_MS);
    }

    function setPlaying(v) {
      playing = v;
      playBtn.setAttribute("aria-pressed", String(v));
      playBtn.title = v ? "暫停自動播放" : "開始自動播放";
      playBtn.querySelector(".al-play-ico").innerHTML = L.icon(v ? "pause" : "play");
      if (v) schedule();
      else clearTimeout(timer);
    }

    function togglePlay() {
      if (playing) { setPlaying(false); return; }
      if (idx >= LAST) go(0, { force: true });
      setPlaying(true);
    }

    root.addEventListener("keydown", (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (e.key === "ArrowRight") { e.preventDefault(); go(idx + 1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); go(idx - 1); }
    });

    // 捲出畫面就暫停自動播放，避免回來時已經播完
    if ("IntersectionObserver" in window) {
      new IntersectionObserver((entries) => {
        for (const en of entries) if (!en.isIntersecting && playing) setPlaying(false);
      }).observe(root);
    }

    /* 第一次畫面：直接顯示第 0 步的完整狀態 */
    go(0, { force: true });
  });
})();
