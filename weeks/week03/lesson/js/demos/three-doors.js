/* ==========================================================================
   Demo: three-doors — 一個資料夾，四個窗口
   中間是硬碟上真正的資料夾，四周是 Codex / VS Code / 終端機 / 檔案總管。
   在任何一個窗口做的改變，都會出現在其他窗口，因為它們看的是同一個資料夾。
   ========================================================================== */
(function () {
  "use strict";
  const L = window.Lesson;
  if (!L) return;

  const h = L.h;
  const esc = L.escapeHTML;
  const NS = "http://www.w3.org/2000/svg";

  const PROJECT_WIN = "C:\\Users\\an\\Desktop\\Project";
  const PROMPT = "PS " + PROJECT_WIN + ">";
  const CSVS = ["問卷_A班.csv", "問卷_B班.csv", "問卷_C班.csv"];
  const BASE_RULES = ["# 專案規則", "- 報告用繁體中文", "- 輸出的檔案放在 output/"];
  const NEW_RULE = "- 圖表存到 figures/";
  const REQUEST = "幫我寫一份報告到 output/report.md";

  const BASE_TIME = {
    data: { d: "2026/9/28", t: "上午 09:58" },
    output: { d: "2026/9/28", t: "上午 10:12" },
    agents: { d: "2026/9/28", t: "上午 10:12" },
    notes: { d: "2026/9/25", t: "下午 03:40" },
  };

  const START_MSG = "按上面任何一個按鈕，看看在一個窗口做的事，其他窗口看不看得到。";
  const ALL_DONE = " 三個動作都做完了：門有四扇，房間只有一個。";
  const CANCEL = { cancelled: true };
  const FLY_MS = 760;

  /* 路徑只在反斜線後換行，資料夾名稱不被拆開 */
  function pathHTML(p) {
    return p.split("\\").map((seg) => '<span style="white-space:nowrap">' + L.escapeHTML(seg) + "</span>").join("\\<wbr>");
  }

  function fmtTime(min) {
    const hr = Math.floor(min / 60);
    const mi = min % 60;
    const h12 = hr % 12 === 0 ? 12 : hr % 12;
    return {
      d: "2026/9/30",
      t: (hr < 12 ? "上午" : "下午") + " " + String(h12).padStart(2, "0") + ":" + String(mi).padStart(2, "0"),
    };
  }

  L.mount("three-doors", (root) => {
    root.classList.add("demo");

    const wide = window.matchMedia("(min-width: 860px)");

    /* ------------------------------------------------------------------
       狀態
       ------------------------------------------------------------------ */
    let st = null;        // 專案資料夾目前的內容
    let exPath = "";      // 檔案總管目前打開的子資料夾（"" = 專案根目錄）
    let runId = 0;        // 「重來」時加一，讓進行中的動畫中止
    let busy = false;

    const newState = () => ({
      report: false, figures: false, agentsMod: false,
      reportTime: null, figuresTime: null, agentsTime: null,
      clock: 14 * 60 + 31,
    });
    const tick = () => { const t = fmtTime(st.clock); st.clock += 2; return t; };

    /* ------------------------------------------------------------------
       建立 DOM
       ------------------------------------------------------------------ */
    const resetBtn = h("button", { class: "btn btn-sm", type: "button", html: L.icon("reset") + "<span>重來</span>" });
    const bar = h("div", { class: "demo-bar" },
      h("div", { class: "demo-title" }, "一個資料夾，四個窗口"),
      resetBtn);

    const ACTIONS = [
      { id: "report", ico: "agent", where: "在 Codex 輸入：", what: REQUEST, run: runReport },
      { id: "figures", ico: "terminal", where: "在終端機輸入：", what: "mkdir figures", mono: true, run: runFigures },
      { id: "agents", ico: "code", where: "在 VS Code ", what: "修改 AGENTS.md", run: runAgents },
    ];
    ACTIONS.forEach((a) => {
      a.done = false;
      a.btn = h("button", { class: "btn td-act", type: "button", onclick: () => start(a) },
        h("span", { class: "td-act-ico", html: L.icon(a.ico) }),
        h("span", { class: "td-act-text" },
          h("span", { class: "td-act-where" }, a.where),
          h("span", { class: "td-act-what" + (a.mono ? " is-mono" : "") }, a.what)));
    });
    const actions = h("div", { class: "td-actions" }, ACTIONS.map((a) => a.btn));

    const status = h("p", { class: "td-status", "aria-live": "polite", "aria-atomic": "true" });
    const setStatus = (msg) => { status.textContent = msg; };

    /* ---- 視窗外框 ---- */
    function makePane(cls, name, path, body) {
      const badge = h("span", { class: "chip chip-new td-badge", hidden: true }, "看到了");
      const el = h("div", { class: "pane td-pane " + cls, role: "group", "aria-label": name + " 視窗" },
        h("div", { class: "pane-head" },
          h("span", { class: "dots", "aria-hidden": "true" }, h("i"), h("i"), h("i")),
          h("span", { class: "pane-name" }, name),
          h("span", { class: "pane-path" }, path),
          badge),
        body);
      return { el, badge };
    }

    /* ---- 中央：硬碟上的資料夾 ---- */
    const hubTree = h("div", { class: "tree td-hub-tree" });
    const hub = h("div", { class: "td-hub", role: "group", "aria-label": "硬碟上真正的資料夾" },
      h("div", { class: "td-hub-tag", html: L.icon("folder-open") + "<span>真正的檔案在這裡（硬碟）</span>" }),
      h("code", { class: "td-hub-path", html: pathHTML(PROJECT_WIN) }),
      hubTree,
      h("p", { class: "td-hub-note" }, "四個窗口都只是在看這裡。"));

    /* ---- 1 Codex ---- */
    const chat = h("div", { class: "td-chat", tabindex: "0", role: "group", "aria-label": "Codex 對話紀錄" });
    const cInputText = h("span", { class: "td-cinput-text" });
    const codexBody = h("div", { class: "pane-body td-body td-codex-body" },
      chat,
      h("div", { class: "td-cinput", "aria-hidden": "true" },
        cInputText, h("span", { class: "td-caret" }),
        h("span", { class: "td-cinput-send", html: L.icon("next") })));

    /* ---- 2 VS Code ---- */
    const vsTree = h("div", { class: "tree td-vs-tree" });
    const tabState = h("span", { class: "td-tab-state" });
    const editorLines = h("div", { class: "td-code" });
    const vsBody = h("div", { class: "pane-body td-body td-vs-body" },
      h("div", { class: "td-vs-side" },
        h("div", { class: "td-vs-title" }, "Project"),
        vsTree),
      h("div", { class: "td-vs-edit" },
        h("div", { class: "td-tab" },
          h("span", { class: "td-tab-ico", html: L.icon("md") }),
          h("span", { class: "td-tab-name" }, "AGENTS.md"),
          tabState),
        editorLines));

    /* ---- 3 終端機 ---- */
    const termLog = h("div");
    const termCur = h("div");
    const term = h("div", { class: "term td-term", tabindex: "0", role: "group", "aria-label": "終端機畫面" }, termLog, termCur);
    const termBody = h("div", { class: "pane-body td-body td-term-body" }, term);

    /* ---- 4 檔案總管 ---- */
    const exUp = h("button", {
      class: "td-ex-up", type: "button", "aria-label": "回到上一層資料夾", html: L.icon("prev"),
      onclick: () => { exPath = ""; renderExplorer(); },
    });
    const exAddr = h("div", { class: "td-ex-addr", role: "group", "aria-label": "位址列" });
    const exList = h("div", { class: "td-ex-list" });
    const exBody = h("div", { class: "pane-body td-body td-ex-body" },
      h("div", { class: "td-ex-bar" }, exUp, exAddr),
      h("div", { class: "td-ex-cols", "aria-hidden": "true" }, h("span", {}, "名稱"), h("span", {}, "修改日期")),
      exList);

    const panes = [
      makePane("td-p-codex", "Codex", "~\\Desktop\\Project", codexBody),
      makePane("td-p-vscode", "VS Code", "Project", vsBody),
      makePane("td-p-term", "終端機", "PowerShell", termBody),
      makePane("td-p-ex", "檔案總管", "Project", exBody),
    ];
    const P_CODEX = 0, P_VS = 1, P_TERM = 2, P_EX = 3;

    /* ---- 連接線 ---- */
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("class", "td-lines");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    const lineEls = [];
    const portEls = [];
    for (let i = 0; i < 4; i++) {
      const ln = document.createElementNS(NS, "line");
      ln.setAttribute("class", "td-line");
      const pt = document.createElementNS(NS, "circle");
      pt.setAttribute("class", "td-port");
      pt.setAttribute("r", "3.5");
      svg.append(ln, pt);
      lineEls.push(ln);
      portEls.push(pt);
    }

    const stage = h("div", { class: "td-stage" }, svg, hub, panes.map((p) => p.el));
    const body = h("div", { class: "demo-body" }, actions, status, stage);
    const foot = h("div", { class: "demo-foot" },
      "Codex 不會把檔案藏在聊天裡。它寫的每個檔案，都是硬碟上這個資料夾裡的真檔案。");

    /* ------------------------------------------------------------------
       畫面繪製
       ------------------------------------------------------------------ */
    function retrigger(el, cls) {
      el.classList.remove(cls);
      void el.offsetWidth;
      el.classList.add(cls);
    }

    /* ---- 檔案樹（中央與 VS Code 共用） ---- */
    function treeRows(mode) {
      const isHub = mode === "hub";
      const rows = [{ key: "data", name: "data", dir: true, open: isHub, depth: 0 }];
      if (isHub) CSVS.forEach((n, i) => rows.push({ key: "csv" + i, name: n, depth: 1 }));
      if (st.figures) {
        rows.push({ key: "figures", name: "figures", dir: true, open: false, depth: 0, cls: "is-new",
          tag: isHub ? "新資料夾" : null, tagClass: "chip-new" });
      }
      rows.push({ key: "output", name: "output", dir: true, open: st.report, depth: 0 });
      if (st.report) {
        rows.push({ key: "report", name: "report.md", depth: 1, cls: "is-new",
          tag: isHub ? "新檔案" : null, tagClass: "chip-new" });
      }
      rows.push({
        key: "agents", name: "AGENTS.md", depth: 0,
        cls: (mode === "vs" ? "is-selected" : "") + (st.agentsMod ? " is-mod" : ""),
        tag: isHub && st.agentsMod ? "已修改" : null, tagClass: "chip-mod",
      });
      rows.push({ key: "notes", name: "筆記.docx", depth: 0 });
      return rows;
    }

    function renderTree(container, mode, fx) {
      fx = fx || {};
      container.replaceChildren(...treeRows(mode).map((r) => {
        const el = L.treeRow({
          name: r.name, depth: r.depth, dir: !!r.dir, open: !!r.open,
          path: r.key, cls: r.cls, tag: r.tag, tagClass: r.tagClass,
        });
        if (fx.pop === r.key) el.classList.add("anim-pop");
        if (fx.flash === r.key) el.classList.add("anim-flash");
        return el;
      }));
    }

    /* ---- VS Code 編輯區 ---- */
    function renderEditor(partial) {
      const lines = BASE_RULES.map((t) => ({ t, added: false }));
      if (st.agentsMod) lines.push({ t: NEW_RULE, added: true });
      else if (partial != null) lines.push({ t: partial, added: true, cursor: true });
      editorLines.replaceChildren(...lines.map((ln, i) =>
        h("div", { class: "td-code-line" + (ln.added ? " is-added" : "") },
          h("span", { class: "td-ln" }, String(i + 1)),
          h("span", { class: "td-lt" + (i === 0 ? " is-h" : "") },
            ln.t, ln.cursor ? h("span", { class: "td-caret" }) : null))));
    }
    function setTab(mode) {
      if (mode === "dirty") tabState.innerHTML = '<i class="td-dot"></i><span class="td-tab-txt">未儲存</span>';
      else if (mode === "saved") tabState.innerHTML = '<i class="td-dot is-ok"></i><span class="td-tab-txt">已儲存</span>';
      else tabState.textContent = "";
    }

    /* ---- 檔案總管 ---- */
    function exItems(path) {
      if (path === "output") {
        return st.report ? [{ key: "report", name: "report.md", time: st.reportTime, cls: "is-new" }] : [];
      }
      if (path === "data") return CSVS.map((n, i) => ({ key: "csv" + i, name: n, time: BASE_TIME.data }));
      if (path === "figures") return [];
      const items = [{ key: "data", name: "data", dir: true, time: BASE_TIME.data }];
      if (st.figures) items.push({ key: "figures", name: "figures", dir: true, time: st.figuresTime, cls: "is-new" });
      items.push({ key: "output", name: "output", dir: true, time: st.report ? st.reportTime : BASE_TIME.output });
      items.push({ key: "agents", name: "AGENTS.md", time: st.agentsMod ? st.agentsTime : BASE_TIME.agents,
        cls: st.agentsMod ? "is-mod" : "" });
      items.push({ key: "notes", name: "筆記.docx", time: BASE_TIME.notes });
      return items;
    }

    function renderExplorer(fx) {
      fx = fx || {};
      const crumbs = ["本機", "桌面", "Project"];
      if (exPath) crumbs.push(exPath);
      exAddr.replaceChildren();
      crumbs.forEach((c, i) => {
        if (i) exAddr.append(h("span", { class: "td-sep", "aria-hidden": "true" }, "›"));
        exAddr.append(h("span", { class: "td-crumb" + (i === crumbs.length - 1 ? " is-last" : "") }, c));
      });
      exUp.disabled = !exPath;

      const items = exItems(exPath);
      if (!items.length) {
        exList.replaceChildren(h("div", { class: "td-ex-empty" }, "這個資料夾是空的。"));
        return;
      }
      exList.replaceChildren(...items.map((it) => {
        const row = h(it.dir ? "button" : "div", {
          class: "td-ex-row" + (it.cls ? " " + it.cls : ""),
          type: it.dir ? "button" : null,
          "data-key": it.key,
          onclick: it.dir ? () => { exPath = it.key; renderExplorer(); } : null,
        },
          h("span", { class: "td-ex-name" },
            h("span", { class: "ico " + (it.dir ? "ico-folder" : "ico-file"), html: L.icon(L.iconFor(it.name, !!it.dir, false)) }),
            h("span", { class: "name" }, it.name)),
          h("span", { class: "td-ex-time" },
            h("span", { class: "td-d" }, it.time.d + " "),
            h("span", { class: "td-t" }, it.time.t)));
        if (fx.pop === it.key) row.classList.add("anim-pop");
        if (fx.flash === it.key) row.classList.add("anim-flash");
        return row;
      }));
    }

    /* ---- Codex 對話 ---- */
    function resetChat() {
      chat.replaceChildren(h("div", { class: "td-cbox" },
        h("div", { class: "td-cbox-title" }, ">_ Codex"),
        h("div", { class: "td-dir" }, "directory: ~\\Desktop\\Project")));
      cInputText.textContent = "";
    }
    function chatAdd(node) {
      node.classList.add("anim-pop");
      chat.append(node);
      chat.scrollTop = chat.scrollHeight;
    }
    const userMsg = (t) => h("div", { class: "td-msg td-msg-user" }, t);
    const agentMsg = () => h("div", { class: "td-msg td-msg-agent" },
      h("span", { class: "td-msg-ico", html: L.icon("agent") }),
      h("span", {}, "已建立 ", h("code", { class: "path" }, "output/report.md")));
    const noteMsg = (t) => h("div", { class: "td-note" }, t);

    /* ---- 終端機 ---- */
    const promptHTML = '<span class="t-path">' + esc(PROMPT) + "</span> ";
    function termScroll() { term.scrollTop = term.scrollHeight; }
    function termShowCur(cmd) {
      termCur.innerHTML = "<div>" + promptHTML + '<span class="t-cmd">' + esc(cmd) + '</span><span class="t-cursor"></span></div>';
      termScroll();
    }
    function termCommit(cmd, outLines) {
      termLog.append(h("div", { html: promptHTML + '<span class="t-cmd">' + esc(cmd) + "</span>" }));
      outLines.forEach((l) => termLog.append(h("div", { html: l })));
      termShowCur("");
    }
    async function termRun(ctx, cmd, outFn) {
      for (let i = 1; i <= cmd.length; i++) {
        termShowCur(cmd.slice(0, i));
        await ctx.w(45);
      }
      await ctx.w(260);
      termCommit(cmd, outFn());
    }
    function resetTerm() {
      termLog.replaceChildren(h("div", { class: "t-dim", text: "Windows PowerShell" }));
      termShowCur("");
    }
    /* PowerShell 的 dir / mkdir 輸出（精簡版） */
    function dirListing(sub, rows) {
      const head = [
        "    目錄: " + PROJECT_WIN + sub,
        "Mode   LastWriteTime         Name",
        "----   -------------         ----",
      ].map((t) => '<span class="t-dim">' + esc(t) + "</span>");
      return head.concat(rows.map((r) => esc(r.mode.padEnd(5) + "  " + r.time.d + " " + r.time.t + "  " + r.name)));
    }
    function rulesListing() {
      const lines = BASE_RULES.slice();
      if (st.agentsMod) lines.push(NEW_RULE);
      return lines.map((t) => esc(t));
    }

    /* ------------------------------------------------------------------
       連接線、飛行的檔案
       ------------------------------------------------------------------ */
    function layoutLines() {
      if (!wide.matches) return;
      const s = stage.getBoundingClientRect();
      const hr = hub.getBoundingClientRect();
      panes.forEach((p, i) => {
        const r = p.el.getBoundingClientRect();
        const isLeft = r.left + r.width / 2 < hr.left + hr.width / 2;
        const y = r.top - s.top + r.height / 2;
        const x0 = (isLeft ? r.right : r.left) - s.left;
        const x1 = (isLeft ? hr.left : hr.right) - s.left;
        lineEls[i].setAttribute("x1", x0.toFixed(1));
        lineEls[i].setAttribute("y1", y.toFixed(1));
        lineEls[i].setAttribute("x2", x1.toFixed(1));
        lineEls[i].setAttribute("y2", y.toFixed(1));
        portEls[i].setAttribute("cx", x1.toFixed(1));
        portEls[i].setAttribute("cy", y.toFixed(1));
      });
    }
    function setLine(i, on) {
      if (lineEls[i]) lineEls[i].classList.toggle("is-active", on);
      if (portEls[i]) portEls[i].classList.toggle("is-active", on);
    }

    const canFly = () =>
      wide.matches && !L.reduceMotion() && typeof Element.prototype.animate === "function";

    function centerOf(el) {
      const s = stage.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      return { x: r.left - s.left + r.width / 2, y: r.top - s.top + r.height / 2 };
    }
    const hubSpot = (key) => hubTree.querySelector('[data-path="' + key + '"]') || hubTree;

    /* 一個檔案 token 從 fromEl 飛到 toEl。手機（堆疊）或減少動態時不飛，只停一拍。 */
    function travel(ctx, fromEl, toEl, label, lineIdx) {
      setLine(lineIdx, true);
      if (!canFly()) {
        return L.sleep(300).then(() => { setLine(lineIdx, false); ctx.chk(); });
      }
      const tok = h("div", { class: "td-token", "aria-hidden": "true" },
        h("span", { html: L.icon(L.iconFor(label, label === "figures")) }),
        h("span", {}, label));
      stage.append(tok);
      const a = centerOf(fromEl);
      const b = centerOf(toEl);
      const w = tok.offsetWidth;
      const ht = tok.offsetHeight;
      const at = (p) => "translate(" + (p.x - w / 2).toFixed(1) + "px, " + (p.y - ht / 2).toFixed(1) + "px)";
      const move = tok.animate([{ transform: at(a) }, { transform: at(b) }],
        { duration: FLY_MS, easing: "cubic-bezier(.45,.05,.25,1)", fill: "both" });
      tok.animate([{ opacity: 0 }, { opacity: 1, offset: 0.12 }, { opacity: 1, offset: 0.82 }, { opacity: 0 }],
        { duration: FLY_MS, fill: "both" });
      return new Promise((res) => {
        let finished = false;
        const end = () => {
          if (finished) return;
          finished = true;
          tok.remove();
          setLine(lineIdx, false);
          res();
        };
        move.onfinish = end;
        move.oncancel = end;
        setTimeout(end, FLY_MS + 250);
      }).then(() => ctx.chk());
    }

    /* 從中央資料夾同時送到其他窗口 */
    function fanOut(ctx, label, key, targets) {
      return Promise.all(targets.map((t, n) => (async () => {
        await ctx.w(n * 120);
        await travel(ctx, hubSpot(key), panes[t.i].el, label, t.i);
        await t.arrive();
      })()));
    }

    function seen(i) {
      panes[i].badge.hidden = false;
      retrigger(panes[i].el, "td-flash");
    }
    function pulse(i) { retrigger(panes[i].el, "td-flash"); }
    function hubPulse() { retrigger(hub, "td-flash-hub"); }
    function clearBadges() { panes.forEach((p) => { p.badge.hidden = true; }); }

    /* 檔案總管切到某個資料夾（先帶一段「點開」的動作） */
    async function explorerReveal(ctx, target, fx) {
      if (exPath !== target && exPath !== "" && target !== "") {
        exPath = "";
        renderExplorer();
        await ctx.w(300);
      }
      if (exPath !== target) {
        if (target !== "") {
          const row = exList.querySelector('[data-key="' + target + '"]');
          if (row) retrigger(row, "anim-flash");
          await ctx.w(550);
        } else {
          await ctx.w(250);
        }
        exPath = target;
      }
      renderExplorer(fx);
    }

    async function typeText(ctx, text, setter, per) {
      for (let i = 1; i <= text.length; i++) {
        setter(text.slice(0, i));
        await ctx.w(per);
      }
    }

    /* ------------------------------------------------------------------
       三個動作
       ------------------------------------------------------------------ */
    async function runReport(ctx) {
      setStatus("小安在 Codex 輸入需求。");
      await typeText(ctx, REQUEST, (t) => { cInputText.textContent = t; }, 42);
      await ctx.w(380);
      cInputText.textContent = "";
      chatAdd(userMsg(REQUEST));
      await ctx.w(650);
      chatAdd(agentMsg());
      setStatus("Codex 說「已建立 output/report.md」。這個檔案到底在哪裡？");
      await ctx.w(650);

      await travel(ctx, panes[P_CODEX].el, hubTree, "report.md", P_CODEX);
      st.report = true;
      st.reportTime = tick();
      renderTree(hubTree, "hub", { pop: "report" });
      hubPulse();
      setStatus("它落在硬碟的資料夾裡。其他窗口正在看同一個資料夾……");
      await ctx.w(450);

      await fanOut(ctx, "report.md", "report", [
        { i: P_VS, arrive: async () => {
          renderTree(vsTree, "vs", { pop: "report" });
          seen(P_VS);
        } },
        { i: P_EX, arrive: async () => {
          seen(P_EX);
          await explorerReveal(ctx, "output", { pop: "report" });
        } },
        { i: P_TERM, arrive: async () => {
          seen(P_TERM);
          await termRun(ctx, "dir output", () =>
            dirListing("\\output", [{ mode: "-a---", time: st.reportTime, name: "report.md" }]));
        } },
      ]);
      finish("report", "同一個 report.md，四個窗口都看得到，因為它們看的是同一個資料夾。");
    }

    async function runFigures(ctx) {
      setStatus("小安在終端機輸入 mkdir figures，想建一個放圖表的資料夾。");
      pulse(P_TERM);
      await termRun(ctx, "mkdir figures", () => {
        st.figures = true;
        st.figuresTime = tick();
        return dirListing("", [{ mode: "d----", time: st.figuresTime, name: "figures" }]);
      });
      await ctx.w(400);

      await travel(ctx, panes[P_TERM].el, hubTree, "figures", P_TERM);
      renderTree(hubTree, "hub", { pop: "figures" });
      hubPulse();
      setStatus("新資料夾建在硬碟上了。其他窗口正在看同一個資料夾……");
      await ctx.w(450);

      await fanOut(ctx, "figures", "figures", [
        { i: P_CODEX, arrive: async () => {
          chatAdd(noteMsg("（下次 Codex 列出檔案時，也會看到 figures）"));
          seen(P_CODEX);
        } },
        { i: P_VS, arrive: async () => {
          renderTree(vsTree, "vs", { pop: "figures" });
          seen(P_VS);
        } },
        { i: P_EX, arrive: async () => {
          seen(P_EX);
          await explorerReveal(ctx, "", { pop: "figures" });
        } },
      ]);
      finish("figures", "終端機建的 figures，另外三個窗口也看得到，因為資料夾只有一個。");
    }

    async function runAgents(ctx) {
      setStatus("小安在 VS Code 打開 AGENTS.md，準備加一行規則。");
      pulse(P_VS);
      await ctx.w(500);
      setTab("dirty");
      await typeText(ctx, NEW_RULE, (t) => renderEditor(t), 70);
      await ctx.w(450);
      st.agentsMod = true;
      st.agentsTime = tick();
      renderEditor();
      renderTree(vsTree, "vs", { flash: "agents" });
      setTab("saved");
      setStatus("按下存檔，硬碟上的 AGENTS.md 就變成新內容了。");
      await ctx.w(600);

      await travel(ctx, panes[P_VS].el, hubSpot("agents"), "AGENTS.md", P_VS);
      renderTree(hubTree, "hub", { flash: "agents" });
      hubPulse();
      setStatus("硬碟上的檔案改了。其他窗口正在看同一個資料夾……");
      await ctx.w(450);

      await fanOut(ctx, "AGENTS.md", "agents", [
        { i: P_CODEX, arrive: async () => {
          chatAdd(noteMsg("Codex 下次開始工作時會讀到新規則"));
          seen(P_CODEX);
        } },
        { i: P_EX, arrive: async () => {
          seen(P_EX);
          await explorerReveal(ctx, "", { flash: "agents" });
        } },
        { i: P_TERM, arrive: async () => {
          seen(P_TERM);
          await termRun(ctx, "cat AGENTS.md", rulesListing);
        } },
      ]);
      finish("agents", "硬碟上的 AGENTS.md 改了，Codex 下次開始工作時就會讀到，因為它讀的是同一個資料夾。");
    }

    /* ------------------------------------------------------------------
       流程控制
       ------------------------------------------------------------------ */
    function updateButtons() {
      ACTIONS.forEach((a) => { a.btn.disabled = busy || a.done; });
    }

    function finish(id, msg) {
      const a = ACTIONS.find((x) => x.id === id);
      a.done = true;
      a.btn.classList.add("is-done");
      a.btn.querySelector(".td-act-ico").innerHTML = L.icon("check");
      busy = false;
      updateButtons();
      setStatus(msg + (ACTIONS.every((x) => x.done) ? ALL_DONE : ""));
    }

    async function start(a) {
      if (busy || a.done) return;
      const hadFocus = document.activeElement === a.btn;
      busy = true;
      updateButtons();
      clearBadges();
      const id = runId;
      const ctx = {
        w: async (ms) => { await L.sleep(ms); if (id !== runId) throw CANCEL; },
        chk: () => { if (id !== runId) throw CANCEL; },
      };
      try {
        await a.run(ctx);
        if (hadFocus && id === runId) {
          const next = ACTIONS.find((x) => !x.btn.disabled);
          (next ? next.btn : resetBtn).focus({ preventScroll: true });
        }
      } catch (err) {
        if (err !== CANCEL) {
          console.error("[demo:three-doors]", err);
          if (id === runId) { busy = false; updateButtons(); }
        }
      }
    }

    function resetAll() {
      runId++;
      busy = false;
      stage.querySelectorAll(".td-token").forEach((t) => t.remove());
      st = newState();
      exPath = "";
      ACTIONS.forEach((a) => {
        a.done = false;
        a.btn.classList.remove("is-done");
        a.btn.querySelector(".td-act-ico").innerHTML = L.icon(a.ico);
      });
      lineEls.forEach((_, i) => setLine(i, false));
      clearBadges();
      renderTree(hubTree, "hub");
      renderTree(vsTree, "vs");
      renderEditor(null);
      setTab("");
      renderExplorer();
      resetChat();
      resetTerm();
      updateButtons();
      setStatus(START_MSG);
    }

    resetBtn.addEventListener("click", resetAll);

    /* ------------------------------------------------------------------
       掛上頁面
       ------------------------------------------------------------------ */
    resetAll();
    root.append(bar, body, foot);

    if ("ResizeObserver" in window) {
      new ResizeObserver(layoutLines).observe(stage);
    } else {
      window.addEventListener("resize", layoutLines);
    }
    if (wide.addEventListener) wide.addEventListener("change", layoutLines);
    requestAnimationFrame(layoutLines);
  });
})();
