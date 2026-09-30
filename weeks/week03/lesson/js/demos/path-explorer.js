/* ==========================================================================
   Demo: path-explorer（點一個檔案，看它的完整地址）
   左：小安電腦的檔案樹；右：地址卡（路徑一段一段從最上層走下來）。
   ========================================================================== */
(function () {
  "use strict";
  const L = window.Lesson;
  const h = L.h;

  const ROOT_ID = "~";
  const DEFAULT_ID = "Desktop/Project/data/問卷_A班.csv";
  const PROJECT = L.scenario.project;
  const CHEV =
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  /* 專案關係 → 卡片右上角的小標籤 */
  const STATE_CHIP = {
    above: ["專案的上層", ""],
    self: ["專案資料夾", "chip-folder"],
    inside: ["在專案資料夾裡", "chip-agent"],
    outside: ["不在專案資料夾裡", "chip-out"],
  };

  function stateOf(e) {
    const p = e.parts;
    if (p[0] === "Desktop" && p[1] === PROJECT) return p.length === 2 ? "self" : "inside";
    if (p.length === 0 || (p.length === 1 && p[0] === "Desktop")) return "above";
    return "outside";
  }

  L.mount("path-explorer", (root) => {
    /* ---------------- 資料：把 Lesson.computer 攤平成一列一列 ---------------- */
    const entries = L.flatten(L.computer).map((e) => {
      const parts = e.parts;
      const id = parts.length ? parts.join("/") : ROOT_ID;
      const chain = [ROOT_ID]; // 從家目錄到自己，每一層的 id
      for (let i = 1; i <= parts.length; i++) chain.push(parts.slice(0, i).join("/"));
      const kids = e.node.children;
      return {
        id, parts, chain,
        depth: e.depth,
        node: e.node,
        name: e.node.name,
        isDir: e.isDir,
        hasKids: !!(kids && kids.length),
      };
    });
    const byId = new Map(entries.map((e) => [e.id, e]));

    let os = "win";
    let selId = DEFAULT_ID;
    let cur = byId.get(selId);
    const collapsed = new Set();
    let parity = 0;
    let copyTimer = 0;

    const appName = () => (os === "win" ? "檔案總管" : "Finder");
    const sepChar = () => (os === "win" ? "\\" : "/");

    /* ---------------- 上方列：標題 + Windows / Mac ---------------- */
    const btnWin = h("button", { type: "button", "aria-pressed": "true", onclick: () => setOS("win") }, "Windows");
    const btnMac = h("button", { type: "button", "aria-pressed": "false", onclick: () => setOS("mac") }, "Mac");
    const bar = h(
      "div", { class: "demo-bar" },
      h("div", { class: "demo-title" }, "點一個檔案，看它的完整地址"),
      h("div", { class: "seg", role: "group", "aria-label": "作業系統" }, btnWin, btnMac)
    );

    /* ---------------- 左：檔案樹 ---------------- */
    const paneName = h("span", { class: "pane-name" }, "檔案總管");
    const topSegA = h("span", { class: "pe-top-seg" }, "C:");
    const topSegB = h("span", { class: "pe-top-seg" }, "Users");
    const topSegs = [topSegA, topSegB];
    const topLine = h(
      "div", { class: "pe-top" },
      topSegA, h("span", { class: "pe-arrow", "aria-hidden": "true" }, "›"),
      topSegB, h("span", { class: "pe-arrow", "aria-hidden": "true" }, "›"),
      h("span", { class: "pe-top-note" }, "（an 之上的兩層，這裡不畫）")
    );

    const list = h("ul", { class: "tree pe-tree", "aria-label": "小安電腦裡的資料夾與檔案" });
    const rows = new Map();

    entries.forEach((e) => {
      const btn = L.treeRow({
        name: e.name,
        label: e.node.label,
        depth: e.depth,
        dir: e.isDir,
        open: true,
        tag: e.node.project ? "專案" : null,
        tagClass: "chip-folder",
        button: true,
        onClick: () => onRowClick(e),
      });
      btn.dataset.id = e.id;
      btn.title = e.node.label ? `${e.name}（${e.node.label}）` : e.name;
      btn.prepend(
        h("span", {
          class: "pe-chev" + (e.isDir && e.hasKids ? "" : " is-empty"),
          "aria-hidden": "true",
          html: CHEV,
        })
      );
      btn.addEventListener("pointerenter", () => hlCrumb(e.id));
      btn.addEventListener("pointerleave", clearHL);
      btn.addEventListener("focus", () => hlCrumb(e.id));
      btn.addEventListener("blur", clearHL);
      const li = h("li", { class: "pe-li" }, btn);
      list.append(li);
      rows.set(e.id, { li, btn, ico: btn.querySelector(".ico"), e });
    });

    list.addEventListener("keydown", (ev) => {
      const k = ev.key;
      if (k !== "ArrowDown" && k !== "ArrowUp" && k !== "Home" && k !== "End") return;
      const btns = entries.filter((e) => !rows.get(e.id).li.hidden).map((e) => rows.get(e.id).btn);
      const i = btns.indexOf(document.activeElement);
      if (i < 0) return;
      let n = k === "ArrowDown" ? i + 1 : k === "ArrowUp" ? i - 1 : k === "Home" ? 0 : btns.length - 1;
      n = Math.max(0, Math.min(btns.length - 1, n));
      btns[n].focus();
      ev.preventDefault();
    });

    const treeBox = h("div", { class: "pe-treebox" }, topLine, list);
    const treePane = h(
      "div", { class: "pane pe-pane" },
      h(
        "div", { class: "pane-head" },
        h("span", { class: "dots", "aria-hidden": "true" }, h("i"), h("i"), h("i")),
        paneName
      ),
      h("div", { class: "pane-body" }, treeBox)
    );

    /* ---------------- 右：地址卡 ---------------- */
    const stateChip = h("span", { class: "chip" });
    const crumbs = h("ol", { class: "pe-crumbs", "aria-label": "路徑，從最上層一層一層走到目前選的項目" });
    const pathCode = h("code", { class: "pe-path" });
    const copyStatus = h("span", { class: "pe-copied", role: "status", "aria-live": "polite" });
    const copyBtn = h(
      "button", { type: "button", class: "btn btn-sm pe-copy", onclick: doCopy },
      h("span", { class: "pe-btn-ico", "aria-hidden": "true", html: L.icon("copy") }),
      "複製路徑"
    );
    const explainEl = h("p", { class: "pe-explain", "aria-live": "polite" });

    const rowWin = h(
      "div", { class: "pe-cmp-row" },
      h("b", null, "Windows"),
      h("span", null, "從磁碟代號 ", h("code", null, "C:"), " 開頭，每一層用 ", h("code", null, "\\"), " 隔開")
    );
    const rowMac = h(
      "div", { class: "pe-cmp-row" },
      h("b", null, "Mac"),
      h("span", null, "從最上層 ", h("code", null, "/"), " 開頭，每一層用 ", h("code", null, "/"), " 隔開")
    );

    const card = h(
      "div", { class: "pe-card" },
      h("div", { class: "pe-card-head" }, h("span", { class: "pe-card-label" }, "地址卡"), stateChip),
      h(
        "div", { class: "pe-card-body" },
        h("div", null, h("div", { class: "pe-lab" }, "從最上層一層一層走下來"), crumbs),
        h(
          "div", null,
          h("div", { class: "pe-lab" }, "完整路徑（一整串文字）"),
          pathCode,
          h("div", { class: "pe-actions" }, copyBtn, copyStatus)
        ),
        explainEl,
        h("div", { class: "pe-compare" }, h("div", { class: "pe-lab" }, "寫法對照"), rowWin, rowMac)
      )
    );

    const body = h("div", { class: "demo-body" }, h("div", { class: "pe-grid" }, treePane, card));
    const foot = h("div", { class: "demo-foot" }, "路徑＝檔案的完整地址。之後只要看到路徑，就能在檔案總管裡找到它。");
    root.append(bar, body, foot);

    /* ---------------- 高亮（麵包屑 <-> 檔案樹） ---------------- */
    function clearHL() {
      list.querySelectorAll(".pe-hl").forEach((n) => n.classList.remove("pe-hl"));
      crumbs.querySelectorAll(".pe-hl").forEach((n) => n.classList.remove("pe-hl"));
      topSegs.forEach((n) => n.classList.remove("pe-hl"));
    }
    function hlRow(id) {
      clearHL();
      const r = rows.get(id);
      if (r && !r.li.hidden) r.btn.classList.add("pe-hl");
    }
    function hlTop(i) {
      clearHL();
      topSegs[i].classList.add("pe-hl");
    }
    function hlCrumb(id) {
      clearHL();
      const el = Array.from(crumbs.querySelectorAll(".pe-seg")).find((n) => n.dataset.id === id);
      if (el) el.classList.add("pe-hl");
    }

    /* ---------------- 檔案樹狀態 ---------------- */
    function renderTree(animate) {
      const chain = cur.chain;
      entries.forEach((e) => {
        const r = rows.get(e.id);
        let hidden = false;
        for (let i = 0; i < e.chain.length - 1; i++) {
          if (collapsed.has(e.chain[i])) { hidden = true; break; }
        }
        r.li.hidden = hidden;
        if (e.isDir) {
          const open = e.hasKids && !collapsed.has(e.id);
          r.ico.innerHTML = L.icon(L.iconFor(e.name, true, open));
          if (e.hasKids) r.btn.setAttribute("aria-expanded", String(open));
        }
        const isSel = e.id === selId;
        r.btn.classList.toggle("is-selected", isSel);
        if (isSel) r.btn.setAttribute("aria-current", "true");
        else r.btn.removeAttribute("aria-current");
        r.btn.classList.toggle("pe-anc", !isSel && chain.indexOf(e.id) >= 0);
        r.btn.style.setProperty("--pe-i", String(Math.max(0, chain.indexOf(e.id))));
      });
      if (animate && !L.reduceMotion()) {
        parity = 1 - parity;
        list.dataset.par = String(parity); // 換動畫名稱，讓動畫重新播放
      }
    }

    function revealSelected() {
      const r = rows.get(selId);
      if (!r || treeBox.scrollHeight <= treeBox.clientHeight + 1) return;
      treeBox.scrollTop = Math.max(0, r.li.offsetTop - treeBox.clientHeight / 2);
    }

    function onRowClick(e) {
      let toggled = false;
      // 資料夾：已選取時再點一下收合／展開；收合中的一點就展開
      if (e.isDir && e.hasKids && (selId === e.id || collapsed.has(e.id))) {
        if (collapsed.has(e.id)) collapsed.delete(e.id);
        else collapsed.add(e.id);
        toggled = true;
      }
      if (toggled && selId === e.id) {
        renderTree(false);
        return;
      }
      select(e.id);
    }

    function select(id) {
      const hadCrumbFocus = crumbs.contains(document.activeElement);
      selId = id;
      cur = byId.get(id);
      clearHL();
      renderTree(true);
      renderCard(true);
      if (hadCrumbFocus) rows.get(id).btn.focus();
    }

    /* ---------------- 地址卡 ---------------- */
    function segList() {
      const tips = os === "win"
        ? ["磁碟代號：電腦裡最上面的一層", "所有使用者的家目錄都放在 Users 裡"]
        : ["最上層（根目錄）", "所有使用者的家目錄都放在 Users 裡"];
      const segs = [
        { t: os === "win" ? "C:" : "/", top: 0, tip: tips[0] },
        { t: "Users", top: 1, tip: tips[1] },
      ];
      cur.chain.forEach((id) => segs.push({ t: byId.get(id).name, id }));
      return segs;
    }

    function renderCrumbs(animate) {
      const segs = segList();
      const last = segs.length - 1;
      crumbs.classList.toggle("is-tracing", !!animate && !L.reduceMotion());
      const items = segs.map((s, i) => {
        let node;
        if (s.top !== undefined) {
          node = h("span", {
            class: "pe-seg is-top",
            title: s.tip,
            onpointerenter: () => hlTop(s.top),
            onpointerleave: clearHL,
          }, s.t);
        } else if (i === last) {
          node = h("span", {
            class: "pe-seg is-last",
            "data-id": s.id,
            "aria-current": "location",
            onpointerenter: () => hlRow(s.id),
            onpointerleave: clearHL,
          },
            h("span", { class: "pe-seg-ico", "aria-hidden": "true", html: L.icon(L.iconFor(s.t, cur.isDir, false)) }),
            s.t
          );
        } else {
          const en = byId.get(s.id);
          node = h("button", {
            type: "button",
            class: "pe-seg",
            "data-id": s.id,
            title: `選取 ${s.t}` + (en.node.label ? `（${appName()}裡叫「${en.node.label}」）` : ""),
            onclick: () => select(s.id),
            onpointerenter: () => hlRow(s.id),
            onpointerleave: clearHL,
            onfocus: () => hlRow(s.id),
            onblur: clearHL,
          }, s.t);
        }
        const li = h("li", { class: "pe-step" }, node, i < last ? h("span", { class: "pe-arrow", "aria-hidden": "true" }, "›") : null);
        li.style.setProperty("--i", String(i));
        return li;
      });
      crumbs.replaceChildren(...items);
    }

    function renderPath() {
      const str = L.joinPath(os, cur.parts);
      const segs = segList().map((s) => s.t);
      const sep = sepChar();
      const frag = document.createDocumentFragment();
      const addSep = () => frag.append(h("span", { class: "pe-p-sep" }, sep));
      const addName = (t, isLast) => frag.append(h("span", { class: isLast ? "pe-p-last" : "pe-p-name" }, t));
      if (os === "win") {
        segs.forEach((t, i) => {
          if (i) addSep();
          addName(t, i === segs.length - 1);
        });
      } else {
        addSep(); // 開頭的 / 就是最上層
        segs.slice(1).forEach((t, i) => {
          if (i) addSep();
          addName(t, i === segs.length - 2);
        });
      }
      pathCode.replaceChildren(frag);
      if (pathCode.textContent !== str) pathCode.textContent = str; // 保險：文字一定要跟 joinPath 一致
    }

    function explanation() {
      const app = appName();
      const inProj = "這個檔案在專案資料夾裡，在這裡開啟的 Codex 找得到它。";
      const T = {};
      T[ROOT_ID] = "「家目錄」是小安個人的大本營，資料夾名字就是小安的帳號 an。桌面、文件、下載都是它底下的資料夾。";
      T["Desktop"] = `${app}寫「桌面」，真正的資料夾名字是 Desktop，它只是家目錄 an 裡的一個資料夾。這次的專案資料夾 Project 就放在這裡。`;
      T["Desktop/螢幕擷取畫面 2026-09-12.png"] = "這張截圖和 Project 一樣放在桌面，但不在 Project 裡面。在 Project 開啟的 Codex 不會自動用到它。";
      T["Desktop/新增資料夾"] = "這是桌面上一個空的資料夾。中文名字也是路徑的一部分，路徑裡會照樣寫出「新增資料夾」。";
      T["Documents"] = `${app}寫「文件」，真正的名字是 Documents。這裡放著另一門課的教學實習資料夾，和這次的專案無關。`;
      T["Desktop/Project"] = "這是專案資料夾。在這個地址開啟 Codex，它的工作資料夾就是這裡；底下的檔案它都讀得到，也能直接修改。";
      T["Desktop/Project/AGENTS.md"] = "AGENTS.md 放在專案資料夾的最上層，Codex 開始工作時會自動讀它，裡面寫的是給 Codex 的專案規則。";
      T["Desktop/Project/data"] = "data 是專案資料夾裡的子資料夾，三個班的問卷都放在這裡。它的地址就是專案地址再多一層 data。";
      T["Desktop/Project/data/問卷_A班.csv"] = inProj + "Downloads 裡另有一個名字很像的檔案，但地址不同，是另一個檔案。";
      T["Desktop/Project/output"] = "output 目前是空的，是留給 Codex 存放報告和圖表的位置，它也在專案資料夾裡。";
      T["Documents/教學實習"] = "教學實習放在 Documents 裡，Project 放在 Desktop 裡，是彼此獨立的兩個資料夾，誰也不包含誰。";
      T["Documents/教學實習/教案_第三週.docx"] = "這個檔案在教學實習資料夾裡，不在 Project 專案裡。它的地址從 Documents 開始，和 Project 完全不同。";
      T["Downloads"] = `${app}寫「下載」，真正的名字是 Downloads。瀏覽器下載的檔案預設都掉進這裡，跟專案是分開的。`;
      T["Downloads/問卷_A班 (1).csv"] = "名字很像 data 裡的問卷_A班.csv，但地址不同，所以是另一個檔案。Codex 在專案裡不會自動用到它。";
      T["Downloads/課程大綱.pdf"] = "這個檔案在 Downloads，不在專案資料夾裡。要讓專案用到它，得先複製或移進專案資料夾。";
      T["Pictures"] = `${app}寫「圖片」，真正的名字是 Pictures。它和 Desktop、Documents 一樣，是家目錄 an 底下的一個資料夾。`;
      T["Pictures/畢業旅行"] = "這是圖片資料夾裡一個空的資料夾，和專案沒有關係。";
      if (T[cur.id]) return T[cur.id];
      if (stateOf(cur) === "inside") return cur.isDir ? "這個資料夾在專案資料夾裡，在這裡開啟的 Codex 找得到它。" : inProj;
      return `路徑從最上層一路寫到${cur.isDir ? "資料夾" : "檔案"}本身，每一層用 ${sepChar()} 隔開。`;
    }

    function renderCard(animate) {
      renderCrumbs(animate);
      renderPath();
      explainEl.textContent = explanation();
      const [txt, cls] = STATE_CHIP[stateOf(cur)];
      stateChip.className = "chip" + (cls ? " " + cls : "");
      stateChip.textContent = txt;
      clearCopyStatus();
    }

    /* ---------------- 複製路徑 ---------------- */
    function setCopyStatus(msg, ok) {
      copyStatus.textContent = msg;
      copyStatus.classList.toggle("is-ok", !!ok);
      copyBtn.classList.toggle("is-done", !!ok);
      clearTimeout(copyTimer);
      copyTimer = setTimeout(clearCopyStatus, 2600);
    }
    function clearCopyStatus() {
      clearTimeout(copyTimer);
      copyStatus.textContent = "";
      copyStatus.classList.remove("is-ok");
      copyBtn.classList.remove("is-done");
    }
    function selectPath() {
      try {
        const range = document.createRange();
        range.selectNodeContents(pathCode);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      } catch (_) { /* 選不到就算了 */ }
    }
    function doCopy() {
      const text = L.joinPath(os, cur.parts);
      const fallback = () => {
        selectPath();
        let ok = false;
        try { ok = document.execCommand("copy"); } catch (_) { ok = false; }
        if (ok) setCopyStatus("已複製", true);
        else setCopyStatus("已選取路徑，請按 Ctrl+C（Mac：⌘C）複製", false);
      };
      let p = null;
      try {
        p = navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(text) : null;
      } catch (_) { p = null; }
      if (p && typeof p.then === "function") p.then(() => setCopyStatus("已複製", true), fallback);
      else fallback();
    }

    /* ---------------- Windows / Mac ---------------- */
    function setOS(next) {
      if (next === os) return;
      os = next;
      btnWin.setAttribute("aria-pressed", String(os === "win"));
      btnMac.setAttribute("aria-pressed", String(os === "mac"));
      syncOS();
      renderCard(true);
    }
    function syncOS() {
      paneName.textContent = appName();
      topSegA.textContent = os === "win" ? "C:" : "/";
      rowWin.classList.toggle("is-on", os === "win");
      rowMac.classList.toggle("is-on", os === "mac");
    }

    /* ---------------- 第一次繪製：靜態、完整可讀 ---------------- */
    syncOS();
    renderTree(false);
    renderCard(false);
    revealSelected();
  });
})();
