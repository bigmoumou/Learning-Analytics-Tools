/* ==========================================================================
   相對路徑實驗室（relative-path-lab）
   第 5 章：同一句話，檔案卻跑到不同地方。
   完整路徑 ＝ 工作資料夾 ＋ 相對路徑。改變「Codex 開在哪」，同一句話就會落在不同位置。
   ========================================================================== */
(function () {
  "use strict";
  const L = window.Lesson;
  if (!L) return;
  const h = L.h;

  /* ---------------- 資料 ---------------- */
  const USER = L.scenario.user;            // "an"
  const PROJECT_NAME = L.scenario.project; // "Project"
  const HOME = ["Users", USER];
  const PROJECT = HOME.concat(["Desktop", PROJECT_NAME]);

  /* 工作資料夾的選項（parts 從磁碟根目錄之下算起） */
  const WDS = [
    { id: "project", parts: PROJECT, name: PROJECT_NAME, label: () => PROJECT_NAME },
    { id: "desktop", parts: HOME.concat(["Desktop"]), name: "Desktop", label: () => "Desktop" },
    { id: "home", parts: HOME, name: USER, label: () => USER + "（家目錄）" },
    { id: "data", parts: PROJECT.concat(["data"]), name: "data", label: (sep) => PROJECT_NAME + sep + "data" },
  ];

  /* 你對 Codex 說的相對路徑（說的時候一律用 /） */
  const RELS = [
    { id: "out", say: "output/chart.png", ups: 0, segs: ["output", "chart.png"] },
    { id: "file", say: "chart.png", ups: 0, segs: ["chart.png"] },
    { id: "up", say: "../chart.png", ups: 1, segs: ["chart.png"] },
  ];

  /* 12 種組合的結論。level: ok / warn / bad */
  function messageFor(wdId, relId, os) {
    const usersPath = os === "mac" ? "/Users" : "C:\\Users";
    const table = {
      "project|out": ["ok", "在專案的 output 裡，正是你要的位置。"],
      "project|file": ["warn", "在專案裡，但不在 output 資料夾，下次要記得說清楚。"],
      "project|up": ["bad", "往上一層，存到桌面（Desktop）了，已經離開專案資料夾。"],
      "desktop|out": ["bad", "檔案跑到桌面的 output 資料夾，不是 Project 裡的那個。Codex 沒有做錯，是它被開在桌面（Project 的上一層）。"],
      "desktop|file": ["bad", "檔案直接掉在桌面上，不在 Project 裡。Codex 沒有做錯，是它被開在桌面（Project 的上一層）。"],
      "desktop|up": ["bad", "往上一層，離開桌面，存到家目錄 " + USER + " 的最外層，很難找。"],
      "home|out": ["bad", "檔案跑到家目錄 " + USER + " 底下，還多出一個新的 output 資料夾，很難找。"],
      "home|file": ["bad", "檔案直接掉在家目錄 " + USER + " 的最外層，很難找。"],
      "home|up": ["bad", "往上一層，離開家目錄，存到 " + usersPath + "（所有帳號共用的地方），離你的專案更遠了。"],
      "data|out": ["bad", "跑到 data 裡面多了一個 output，和原本的 output 是兩個不同的資料夾。"],
      "data|file": ["bad", "存進 data 資料夾了，和問卷資料混在一起，不在 output 裡。"],
      "data|up": ["warn", "往上一層，存到專案最外層了。位置在專案裡，但不在 output 裡。"],
    };
    return table[wdId + "|" + relId] || ["bad", "檔案存到別的地方了。"];
  }

  const HINT = "按「存檔！」可以再看一次整個過程。";
  const SKIP_DIRS = new Set(["新增資料夾", "畢業旅行"]); // 檔案樹裡略過的空資料夾

  /* ---------------- 路徑小工具 ---------------- */
  const sepOf = (os) => (os === "mac" ? "/" : "\\");

  /* 絕對路徑切成一段一段（每段前面帶分隔符）：Windows → ["C:", "\Users", "\an"]；Mac → ["/Users", "/an"] */
  function absTexts(os, parts) {
    const sep = sepOf(os);
    const t = parts.map((p) => sep + p);
    return os === "mac" ? t : ["C:"].concat(t);
  }

  /* 相對路徑的顯示段落：第一段不帶分隔符 */
  function relTexts(os, rel) {
    const sep = sepOf(os);
    const names = [];
    for (let i = 0; i < rel.ups; i++) names.push("..");
    rel.segs.forEach((s) => names.push(s));
    return names.map((n, i) => (i ? sep : "") + n);
  }

  function startsWith(a, b) {
    return b.length <= a.length && b.every((v, i) => a[i] === v);
  }

  /* 工作資料夾 ＋ 相對路徑 → 結果 */
  function resolve(wd, rel) {
    const base = wd.parts.slice();
    const removed = [];
    for (let i = 0; i < rel.ups; i++) removed.push(base.pop());
    const dirParts = base.concat(rel.segs.slice(0, -1));
    const file = rel.segs[rel.segs.length - 1];
    return {
      base,
      removed,
      dirParts,
      file,
      full: base.concat(rel.segs),
      inside: startsWith(dirParts, wd.parts),
    };
  }

  function seg(text, cls) {
    return h("span", { class: "rp-s" + (cls ? " " + cls : "") }, text);
  }

  /* 完整路徑的各段：工作資料夾的部分（一般色）＋ 相對路徑的部分（青綠色） */
  function pathNodes(os, info, rel) {
    const sep = sepOf(os);
    return absTexts(os, info.base)
      .map((t) => seg(t))
      .concat(rel.segs.map((n) => seg(sep + n, "rp-s-rel")));
  }

  function collapse(el) {
    el.style.maxWidth = el.getBoundingClientRect().width + "px";
    void el.offsetWidth; // 讓瀏覽器先記住起點，動畫才會從目前寬度縮到 0
    el.classList.add("rp-gone");
  }

  /* 檔案樹的底稿：只列資料夾，取自 Lesson.computer，上面多一層 Users */
  const BASE_ROWS = (function () {
    const rows = [{ key: "Users", parts: ["Users"], depth: 0, name: "Users", label: "所有帳號", dir: true }];
    L.flatten(L.computer).forEach((item) => {
      if (!item.isDir || SKIP_DIRS.has(item.node.name)) return;
      const full = HOME.concat(item.parts);
      rows.push({
        key: full.join("/"),
        parts: full,
        depth: item.depth + 1,
        name: item.node.name,
        label: item.node.label,
        dir: true,
      });
    });
    return rows;
  })();

  /* ---------------- 主程式 ---------------- */
  L.mount("relative-path-lab", (root) => {
    root.classList.add("rp-root");
    const uid = "rp" + Math.random().toString(36).slice(2, 7);
    const state = { os: "win", wd: "project", rel: "out" };
    let runId = 0;
    let transient = []; // 動畫中臨時加進畫面的元素（殘影、飛行的檔案）

    const getWd = () => WDS.find((w) => w.id === state.wd);
    const getRel = () => RELS.find((r) => r.id === state.rel);

    /* ----- 標題列：Windows / Mac ----- */
    const osBtns = [["win", "Windows"], ["mac", "Mac"]].map(([id, text]) => {
      const b = h("button", { type: "button", "aria-pressed": "false", onclick: () => setOs(id) }, text);
      b.dataset.os = id;
      return b;
    });
    const bar = h(
      "div",
      { class: "demo-bar" },
      h("div", { class: "demo-title" }, "相對路徑實驗室"),
      h("div", { class: "seg", role: "group", "aria-label": "作業系統" }, osBtns)
    );

    /* ----- 控制區 ----- */
    const wdBtns = WDS.map((w) => {
      const b = h("button", { type: "button", "aria-pressed": "false", onclick: () => pick("wd", w.id) });
      b.dataset.id = w.id;
      return b;
    });
    const relBtns = RELS.map((r) => {
      const b = h("button", { type: "button", "aria-pressed": "false", onclick: () => pick("rel", r.id) }, r.say);
      b.dataset.id = r.id;
      return b;
    });
    const saveBtn = h("button", { type: "button", class: "btn btn-primary rp-save", onclick: () => run() });
    saveBtn.innerHTML = L.icon("play") + "<span>存檔！</span>";

    const controls = h(
      "div",
      { class: "rp-controls" },
      h(
        "div",
        { class: "rp-group" },
        h("div", { class: "rp-group-label", id: uid + "-wd" }, "Codex 是在哪裡開的？"),
        h("div", { class: "seg rp-choices", role: "group", "aria-labelledby": uid + "-wd" }, wdBtns)
      ),
      h(
        "div",
        { class: "rp-group" },
        h(
          "div",
          { class: "rp-group-label", id: uid + "-rel" },
          "你說：把圖表存成 ",
          h("span", { class: "rp-blank", "aria-hidden": "true" }, "＿＿＿")
        ),
        h("div", { class: "seg rp-choices rp-mono", role: "group", "aria-labelledby": uid + "-rel" }, relBtns)
      ),
      saveBtn
    );

    /* ----- 等式區 ----- */
    const eqSlot = h("div", { class: "rp-eqslot" });
    const stepEl = h("div", { class: "rp-step", "aria-hidden": "true" }, HINT);
    const noteEl = h("p", { class: "rp-note" });
    const eqCol = h("div", { class: "rp-eqcol" }, eqSlot, stepEl, noteEl);

    /* ----- 檔案樹 ----- */
    const treeBox = h("div", { class: "tree rp-tree", role: "list", "aria-label": "小安電腦裡的資料夾（簡化版）" });
    const paneName = h("span", { class: "pane-name" });
    const treePane = h(
      "div",
      { class: "pane rp-tree-pane" },
      h(
        "div",
        { class: "pane-head" },
        h("span", { class: "dots", "aria-hidden": "true" }, h("i"), h("i"), h("i")),
        paneName,
        h("span", { class: "pane-path" }, "只列出相關資料夾")
      ),
      h("div", { class: "pane-body" }, treeBox)
    );

    /* ----- 結論列 ----- */
    const verdict = h("div", { class: "rp-verdict", role: "status", "aria-live": "polite", "aria-atomic": "true" });

    const body = h("div", { class: "demo-body rp-body" }, controls, eqCol, treePane, verdict);
    const foot = h(
      "div",
      { class: "demo-foot" },
      "完整路徑 ＝ 工作資料夾 ＋ 相對路徑。檔案找不到時，先問：Codex 是在哪個資料夾開的？"
    );
    root.append(bar, body, foot);

    /* ---------------- 畫面更新 ---------------- */
    const rectIn = (el) => {
      const r = el.getBoundingClientRect();
      const b = body.getBoundingClientRect();
      return { left: r.left - b.left, top: r.top - b.top, width: r.width, height: r.height };
    };

    function fx(el, keyframes, ms) {
      if (L.reduceMotion() || !el.animate) return null;
      return el.animate(keyframes, { duration: ms, easing: "cubic-bezier(.2,.7,.2,1)", fill: "forwards" });
    }

    function cleanup() {
      transient.forEach((el) => el.remove());
      transient = [];
    }

    function setStep(text) {
      stepEl.textContent = text;
    }

    function setBusy(on) {
      saveBtn.setAttribute("aria-busy", on ? "true" : "false");
      verdict.setAttribute("aria-busy", on ? "true" : "false");
    }

    function syncControls() {
      const sep = sepOf(state.os);
      osBtns.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.os === state.os)));
      wdBtns.forEach((b) => {
        const w = WDS.find((x) => x.id === b.dataset.id);
        b.textContent = w.label(sep);
        b.setAttribute("aria-pressed", String(w.id === state.wd));
      });
      relBtns.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.id === state.rel)));
      paneName.textContent = state.os === "mac" ? "Finder" : "檔案總管";
      noteEl.textContent =
        state.os === "mac"
          ? "Mac 的路徑用 / 隔開，和你對 Codex 說的寫法一樣。"
          : "Windows 的路徑用 \\ 隔開，所以這裡把相對路徑也顯示成 \\。Codex 通常寫成 output/chart.png，Windows 兩種寫法都看得懂。";
    }

    /* 等式：工作資料夾 ＋ 相對路徑 ＝ 完整路徑
       mode "final"：全部算好；"pending"：完整路徑還空著，等動畫算出來 */
    function buildEq(os, wd, rel, info, mode, fadeIn) {
      const final = mode === "final";

      const wdSegs = absTexts(os, wd.parts).map((t) => seg(t));
      if (final && rel.ups) wdSegs.slice(wdSegs.length - rel.ups).forEach((s) => s.classList.add("rp-struck"));
      const wdBox = h("div", { class: "rp-box rp-box-wd" }, wdSegs);
      const wdTerm = h(
        "div",
        { class: "rp-term rp-term-wd" },
        h("div", { class: "rp-term-label" }, "工作資料夾", h("span", { class: "rp-term-sub" }, "（Codex 開在這）")),
        wdBox
      );

      const lead = h("span", { class: "rp-lead", "aria-hidden": "true" }, sepOf(os));
      const relSegs = relTexts(os, rel).map((t, i) => seg(t, i < rel.ups ? "rp-s-up" + (final ? " rp-hot" : "") : ""));
      const relBox = h("div", { class: "rp-box rp-box-rel" }, lead, relSegs);
      const upHint = rel.ups
        ? h("span", { class: "chip chip-out rp-uphint" + (final ? "" : " is-hidden") }, ".. ＝ 往上一層")
        : null;
      const relLabel = h(
        "div",
        { class: "rp-term-label" },
        "相對路徑",
        h("span", { class: "rp-term-sub" }, "（你說的）"),
        upHint
      );
      const relTerm = h("div", { class: "rp-term rp-term-rel" + (fadeIn ? " rp-fadein" : "") }, relLabel, relBox);

      const plus = h("span", { class: "rp-op" + (fadeIn ? " rp-fadein" : ""), "aria-hidden": "true" }, "＋");
      const equals = h("span", { class: "rp-op", "aria-hidden": "true" }, "＝");

      const resBox = final
        ? h("div", { class: "rp-box rp-box-res" }, pathNodes(os, info, rel))
        : h("div", { class: "rp-box rp-box-res rp-pending" }, "計算中…");
      const resTerm = h(
        "div",
        { class: "rp-term rp-term-res" },
        h("div", { class: "rp-term-label" }, "完整路徑", h("span", { class: "rp-term-sub" }, "（檔案真正的位置）")),
        resBox
      );

      const eq = h(
        "div",
        { class: "rp-eq" },
        h("div", { class: "rp-line" }, wdTerm, h("div", { class: "rp-addend" }, plus, relTerm)),
        h("div", { class: "rp-line rp-line-res" }, equals, resTerm)
      );
      return { root: eq, wdBox, wdSegs, relTerm, relLabel, relBox, relSegs, lead, upHint, plus, resBox };
    }

    /* 檔案樹。o: { os, wd, land(info|null), pin: "none"|"hidden"|"shown", animate } */
    function renderTree(o) {
      const rows = BASE_ROWS.map((r) => Object.assign({}, r));
      const wdKey = o.wd.parts.join("/");
      const lastDesc = (i) => {
        let j = i;
        while (j + 1 < rows.length && rows[j + 1].depth > rows[i].depth) j++;
        return j;
      };
      const indexOf = (key) => rows.findIndex((r) => r.key === key);

      if (o.land) {
        const dirKey = o.land.dirParts.join("/");
        let li = indexOf(dirKey);
        if (li < 0) {
          // 目標資料夾原本不存在（例如 Desktop\output）：Codex 會自動建立
          const pi = indexOf(o.land.dirParts.slice(0, -1).join("/"));
          if (pi >= 0) {
            const at = lastDesc(pi) + 1;
            rows.splice(at, 0, {
              key: dirKey,
              parts: o.land.dirParts,
              depth: rows[pi].depth + 1,
              name: o.land.dirParts[o.land.dirParts.length - 1],
              dir: true,
              fresh: true,
            });
            li = at;
          }
        }
        if (li >= 0 && o.pin !== "none") {
          const at = lastDesc(li) + 1;
          rows.splice(at, 0, {
            key: dirKey + "/" + o.land.file,
            depth: rows[li].depth + 1,
            name: o.land.file,
            dir: false,
            pin: true,
          });
        }
      }

      let pinRow = null;
      let freshRow = null;
      const els = rows.map((r, i) => {
        const isWd = r.key === wdKey;
        const cls = [];
        let tag = null;
        let tagClass = "";
        if (isWd) {
          cls.push("rp-wd-row");
          tag = "工作資料夾";
          tagClass = "chip-agent";
        }
        if (r.fresh) {
          cls.push("is-new");
          if (o.animate) cls.push("anim-pop");
          tag = "自動建立";
          tagClass = "chip-new";
        }
        if (r.pin) {
          cls.push("is-new", "rp-pin");
          tag = "剛存好";
          tagClass = "chip-new";
        }
        const open = r.dir && ((rows[i + 1] && rows[i + 1].depth > r.depth) || isWd);
        const el = L.treeRow({
          name: r.name,
          label: r.label,
          depth: r.depth,
          dir: r.dir,
          open: !!open,
          tag,
          tagClass,
          cls: cls.join(" "),
        });
        el.setAttribute("role", "listitem");
        if (r.fresh) freshRow = el;
        if (r.pin) {
          pinRow = el;
          if (o.pin === "hidden") el.style.visibility = "hidden";
        }
        return el;
      });
      treeBox.replaceChildren(...els);
      return { pinRow, freshRow };
    }

    function setVerdict(info, wd, rel, os) {
      if (!info) {
        verdict.className = "rp-verdict is-run";
        verdict.replaceChildren(
          h("span", { class: "chip" }, "存檔中"),
          h("div", { class: "rp-v-text" }, h("p", { class: "rp-v-main" }, "Codex 正在算這個檔案要存到哪裡…"))
        );
        return;
      }
      const [level, main] = messageFor(wd.id, rel.id, os);
      let chip;
      if (level === "ok") chip = h("span", { class: "chip chip-new", html: L.icon("check") + "<span>位置正確</span>" });
      else if (level === "warn") chip = h("span", { class: "chip chip-folder" }, "位置不夠好");
      else chip = h("span", { class: "chip chip-out", html: L.icon("x") + "<span>放錯地方了</span>" });

      const text = h("div", { class: "rp-v-text" }, h("p", { class: "rp-v-main" }, main));
      if (!info.inside) {
        const sub = h("p", { class: "rp-v-sub" });
        sub.innerHTML = L.icon("lock");
        sub.append(
          "這個位置在工作資料夾（" +
            wd.name +
            "）之外，Codex 在 Auto 模式會先問你同意才能存。這裡當作你按了同意。"
        );
        text.append(sub);
      }
      verdict.className = "rp-verdict is-" + level;
      verdict.replaceChildren(chip, text);
    }

    /* 靜止狀態：全部算好，不需要點擊 */
    function renderRest() {
      runId++;
      cleanup();
      const os = state.os;
      const wd = getWd();
      const rel = getRel();
      const info = resolve(wd, rel);
      syncControls();
      eqSlot.replaceChildren(buildEq(os, wd, rel, info, "final").root);
      renderTree({ os, wd, land: info, pin: "shown", animate: false });
      setVerdict(info, wd, rel, os);
      setStep(HINT);
      setBusy(false);
    }

    function setOs(id) {
      if (state.os === id) return;
      state.os = id;
      renderRest();
    }

    function pick(kind, id) {
      if (state[kind] === id) {
        run(); // 再按一次同一個選項＝重播
        return;
      }
      state[kind] = id;
      syncControls();
      run();
    }

    /* ---------------- 存檔動畫 ---------------- */
    async function run() {
      const token = ++runId;
      cleanup();
      const os = state.os;
      const wd = getWd();
      const rel = getRel();
      const info = resolve(wd, rel);
      const alive = async (ms) => {
        await L.sleep(ms);
        return token === runId;
      };

      syncControls();
      setBusy(true);
      let r = buildEq(os, wd, rel, info, "pending");
      eqSlot.replaceChildren(r.root);
      renderTree({ os, wd, land: null, pin: "none", animate: false });
      setVerdict(null);

      let n = 1;
      setStep(n + ". 從「工作資料夾」出發：Codex 是在這裡開的。");
      r.wdBox.classList.add("anim-flash");
      if (!(await alive(900))) return;

      /* 「..」＝ 往上一層：把工作資料夾的最後一段劃掉 */
      if (rel.ups) {
        n++;
        const gone = wd.parts.slice(wd.parts.length - rel.ups).join(sepOf(os));
        setStep(n + ". 「..」＝ 往上一層：先把最後一層「" + gone + "」拿掉。");
        r.upHint.classList.remove("is-hidden");
        r.upHint.classList.add("anim-pop");
        r.relSegs.slice(0, rel.ups).forEach((s) => s.classList.add("rp-hot"));
        if (!(await alive(600))) return;
        const struck = r.wdSegs.slice(r.wdSegs.length - rel.ups);
        struck.forEach((s) => s.classList.add("rp-struck"));
        if (!(await alive(900))) return;
        struck.forEach(collapse);
        r.relSegs.slice(0, rel.ups).forEach(collapse);
        if (!(await alive(500))) return;
      }

      /* 相對路徑滑過來，接在工作資料夾的尾巴上 */
      n++;
      setStep(n + ". 把「相對路徑」接在後面。");
      r.relBox.classList.add("is-tight");
      if (!rel.ups) r.lead.classList.add("is-on");
      r.plus.style.opacity = "0";
      r.relLabel.style.opacity = "0";
      if (!(await alive(360))) return;

      const tail = r.wdSegs.filter((s) => !s.classList.contains("rp-gone")).pop();
      const head = rel.ups ? r.relSegs[rel.ups] : r.lead;
      const tr = tail.getBoundingClientRect();
      const hr = head.getBoundingClientRect();
      const dx = tr.right - hr.left;
      const dy = tr.top - hr.top;
      const slide = fx(
        r.relTerm,
        [{ transform: "translate(0,0)" }, { transform: "translate(" + dx + "px," + dy + "px)" }],
        750
      );
      if (!slide) r.relTerm.style.transform = "translate(" + dx + "px," + dy + "px)";
      if (!(await alive(820))) return;

      /* 喀一聲接上，合成一條完整路徑 */
      n++;
      setStep(n + ". 接起來，就是完整路徑：檔案真正的位置。");
      const gp = rectIn(r.wdBox);
      const ghost = h(
        "div",
        {
          class: "rp-box rp-ghost anim-flash",
          style: { left: gp.left + "px", top: gp.top + "px", minWidth: gp.width + "px", maxWidth: "calc(100% - " + gp.left + "px)" },
        },
        pathNodes(os, info, rel)
      );
      body.append(ghost);
      transient.push(ghost);
      r.relTerm.style.visibility = "hidden";
      if (!(await alive(650))) return;

      /* 掉進「完整路徑」 */
      const g2 = rectIn(ghost);
      const rr = rectIn(r.resBox);
      const gx = rr.left - g2.left;
      const gy = rr.top - g2.top;
      const drop = fx(
        ghost,
        [
          { transform: "translate(0,0)", opacity: 1 },
          { transform: "translate(" + gx + "px," + gy + "px)", opacity: 1, offset: 0.78 },
          { transform: "translate(" + gx + "px," + gy + "px)", opacity: 0 },
        ],
        700
      );
      if (!(await alive(drop ? 720 : 60))) return;

      r = buildEq(os, wd, rel, info, "final", true);
      eqSlot.replaceChildren(r.root);
      r.resBox.classList.add("anim-flash");
      cleanup();

      /* 資料夾之外：Codex 會先問 */
      if (!info.inside) {
        n++;
        setStep(n + ". 這裡在工作資料夾之外，Codex（Auto 模式）會先問你同意。這裡當作你按了同意。");
        if (!(await alive(1500))) return;
      }

      /* 檔案落地：飛進檔案樹 */
      n++;
      setStep(n + ". 檔案存進 " + absTexts(os, info.dirParts).join("") + "。");
      const t = renderTree({ os, wd, land: info, pin: "hidden", animate: true });
      if (!(await alive(320))) return;
      if (t.pinRow) {
        const fly = h("div", { class: "rp-fly", html: L.icon("img") + "<span>chart.png</span>" });
        body.append(fly);
        transient.push(fly);
        const f = rectIn(r.resBox);
        const target = rectIn(t.pinRow.querySelector(".ico") || t.pinRow);
        const me = fly.getBoundingClientRect();
        const sx = f.left + 10;
        const sy = f.top + f.height / 2 - me.height / 2;
        const ex = target.left;
        const ey = target.top + target.height / 2 - me.height / 2;
        fx(
          fly,
          [
            { transform: "translate(" + sx + "px," + sy + "px)", opacity: 0 },
            { transform: "translate(" + sx + "px," + (sy - 8) + "px)", opacity: 1, offset: 0.16 },
            { transform: "translate(" + ex + "px," + ey + "px)", opacity: 1, offset: 0.88 },
            { transform: "translate(" + ex + "px," + ey + "px)", opacity: 0 },
          ],
          950
        );
        if (!(await alive(L.reduceMotion() ? 30 : 940))) return;
        t.pinRow.style.visibility = "";
        t.pinRow.classList.add("anim-pop");
      }
      cleanup();
      setVerdict(info, wd, rel, os);
      setBusy(false);
      setStep(HINT);
    }

    renderRest();
  });
})();
