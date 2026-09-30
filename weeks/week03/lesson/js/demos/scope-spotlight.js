/* ==========================================================================
   示範：scope-spotlight（Codex 開在哪個資料夾，它的工作範圍就在哪裡）
   - 左：小安電腦的完整資料夾樹，虛線邊界框圈出「工作資料夾」的範圍
   - 右：範圍內的檔案數、無關檔案數、可不經同意修改的路徑、評語、Auto 模式說明
   - 下：模擬「請 Codex 把報告存到桌面」——範圍內直接寫，範圍外要先問你
   類別前綴：ss-
   ========================================================================== */
(function () {
  "use strict";

  const L = window.Lesson;
  const h = L.h;

  const PROJECT = ["Desktop", "Project"]; // 這份作業的資料夾（家目錄以下）
  const TARGET = ["Desktop", "report.md"]; // 這次請 Codex 寫入的檔案
  const PAD = 4; // 邊界框比列高多出來的上下留白（px）

  const OPTIONS = [
    {
      id: "project",
      label: "Project",
      badge: "（推薦）",
      prefix: PROJECT,
      tone: "good",
      head: "剛剛好。",
      body: "作業需要的資料都在裡面，其他課程、照片都不在範圍內。",
      inNote: "",
    },
    {
      id: "desktop",
      label: "Desktop（上一層）",
      prefix: ["Desktop"],
      tone: "warn",
      head: "太大了。",
      body: "桌面上的截圖和其他資料夾也被算進來，Codex 可能讀錯檔、改錯檔，產出的檔案也會散落在桌面。",
      inNote: "因為工作資料夾就是 Desktop，它不需要問你。",
    },
    {
      id: "home",
      label: "an（整個家目錄）",
      prefix: [],
      tone: "danger",
      head: "非常危險。",
      body: "整台電腦的個人檔案都在範圍內，一個錯誤指令可能動到照片和其他課程。",
      inNote: "範圍開得越大，Codex 不用問你就能動的地方就越多。",
    },
    {
      id: "downloads",
      label: "Downloads",
      prefix: ["Downloads"],
      tone: "warn",
      head: "找錯地方。",
      body: "作業的 data 資料夾不在下載，這裡只有一份重複下載的「問卷_A班 (1).csv」，Codex 可能拿錯檔案，產出也會散落在下載。",
      inNote: "",
    },
  ];

  /* parts 是否落在 prefix 這個資料夾之內（含它自己） */
  function isWithin(parts, prefix) {
    if (parts.length < prefix.length) return false;
    return prefix.every((p, i) => parts[i] === p);
  }

  /* 數字「count-up」：從目前顯示的數字滑到新數字 */
  function countTo(el, to, animate) {
    if (el._raf) cancelAnimationFrame(el._raf);
    el._raf = 0;
    const from = typeof el._val === "number" ? el._val : Number(el.textContent) || 0;
    if (!animate || L.reduceMotion() || from === to) {
      el._val = to;
      el.textContent = String(to);
      return;
    }
    const t0 = performance.now();
    const dur = 600;
    const step = (now) => {
      const p = Math.min(1, (now - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      el._val = from + (to - from) * eased;
      el.textContent = String(Math.round(el._val));
      if (p < 1) el._raf = requestAnimationFrame(step);
      else {
        el._val = to;
        el._raf = 0;
      }
    };
    el._raf = requestAnimationFrame(step);
  }

  /* 重新播放某個 CSS 動畫 class */
  function replay(el, cls) {
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  }

  /* 路徑文字：在反斜線後面允許換行，窄螢幕才不會把單字切斷 */
  function pathParts(text) {
    const out = [];
    text.split("\\").forEach((seg, i, arr) => {
      out.push(seg + (i < arr.length - 1 ? "\\" : ""));
      if (i < arr.length - 1) out.push(document.createElement("wbr"));
    });
    return out;
  }

  function windowDots() {
    return h("span", { class: "dots", "aria-hidden": "true" }, h("i"), h("i"), h("i"));
  }

  L.mount("scope-spotlight", (root) => {
    const entries = L.flatten(L.computer);
    const totalFiles = entries.filter((e) => !e.isDir).length;
    let current = OPTIONS[0];
    let span = { first: 0, last: 0 };

    /* ------------------------------------------------------------------
       上方：標題 + 選擇按鈕
       ------------------------------------------------------------------ */
    const segButtons = OPTIONS.map((opt) =>
      h(
        "button",
        {
          type: "button",
          "aria-pressed": "false",
          onclick: () => select(opt),
        },
        opt.label,
        opt.badge ? h("span", { class: "ss-rec" }, opt.badge) : null
      )
    );
    const seg = h(
      "div",
      { class: "seg ss-seg", role: "group", "aria-label": "選擇要把 Codex 開在哪個資料夾" },
      segButtons
    );
    const bar = h(
      "div",
      { class: "demo-bar" },
      h("div", { class: "demo-title" }, "Codex 開在哪個資料夾，它的工作範圍就在哪裡"),
      seg
    );

    /* ------------------------------------------------------------------
       左：檔案樹 + 邊界框
       ------------------------------------------------------------------ */
    const rows = entries.map((e) => {
      const el = L.treeRow({
        name: e.node.name,
        label: e.node.label,
        depth: e.depth,
        dir: e.isDir,
      });
      const lock = h("span", {
        class: "ss-lock",
        role: "img",
        "aria-label": "在工作範圍外",
        "aria-hidden": "true",
        title: "在工作範圍外",
      });
      lock.innerHTML =
        `<span class="ss-locked">${L.icon("lock")}</span>` +
        `<span class="ss-unlocked">${L.icon("unlock")}</span>`;
      el.append(lock);
      return { el, lock, parts: e.parts, isDir: e.isDir };
    });
    const desktopRow = rows.find((r) => r.parts.length === 1 && r.parts[0] === "Desktop");

    const tree = h(
      "div",
      {
        class: "tree ss-tree",
        role: "group",
        "aria-label": "小安電腦的資料夾。虛線框裡是 Codex 的工作範圍，框外的有鎖頭。",
      },
      rows.map((r) => r.el)
    );
    const frame = h("div", { class: "ss-frame", "aria-hidden": "true" });
    const tab = h("div", { class: "ss-tab", "aria-hidden": "true" }, "工作資料夾");
    const treeWrap = h("div", { class: "ss-treewrap" }, frame, tab, tree);
    const treePane = h(
      "div",
      { class: "pane ss-pane" },
      h(
        "div",
        { class: "pane-head" },
        windowDots(),
        h("span", { class: "pane-name" }, "小安的電腦"),
        h("span", { class: "pane-path" }, L.joinPath("win", []))
      ),
      h("div", { class: "pane-body ss-pane-body" }, treeWrap)
    );

    /* 依目前選項算出邊界框位置並移過去 */
    function place(animate) {
      const first = rows[span.first].el;
      const last = rows[span.last].el;
      if (!first.offsetHeight) return; // 還沒排版（例如被隱藏），等 ResizeObserver 再來
      const top = tree.offsetTop + first.offsetTop - PAD;
      const height = last.offsetTop + last.offsetHeight - first.offsetTop + PAD * 2;
      if (!animate) {
        frame.classList.add("is-instant");
        tab.classList.add("is-instant");
      }
      frame.style.transform = `translateY(${top}px)`;
      frame.style.height = `${height}px`;
      tab.style.transform = `translateY(${top}px)`;
      if (!animate) {
        void frame.offsetHeight;
        frame.classList.remove("is-instant");
        tab.classList.remove("is-instant");
      }
    }

    /* ------------------------------------------------------------------
       右：三個數字 + 評語 + Auto 模式說明
       ------------------------------------------------------------------ */
    function statBlock(label, tone) {
      const num = h("b", { class: "ss-num" }, "0");
      const fill = h("i");
      const sub = h("div", { class: "ss-sub" });
      const el = h(
        "div",
        { class: "ss-stat" },
        h(
          "div",
          { class: "ss-stat-top" },
          h("span", { class: "ss-stat-label" }, label),
          h("span", { class: "ss-stat-val" }, num, h("small", null, " 個"))
        ),
        h("div", { class: "ss-bar ss-bar-" + tone, "aria-hidden": "true" }, fill),
        sub
      );
      return { el, num, fill, sub };
    }
    const statFiles = statBlock("Codex 預設會看到的檔案", "agent");
    const statUnrelated = statBlock("跟這份作業無關的檔案", "out");

    const pathCode = h("code", { class: "path ss-path" });
    const pathWrap = h("div", { class: "ss-path-wrap" }, pathCode);
    const statPath = h(
      "div",
      { class: "ss-stat" },
      h(
        "div",
        { class: "ss-stat-top" },
        h("span", { class: "ss-stat-label" }, "可以不經同意就修改的範圍")
      ),
      pathWrap,
      h("div", { class: "ss-sub" }, "含它底下的所有檔案和資料夾。超出這裡，Codex 就要先問你。")
    );
    const stats = h("div", { class: "ss-stats" }, statFiles.el, statUnrelated.el, statPath);

    const vBadge = h("span", { class: "ss-verdict-badge", "aria-hidden": "true" });
    const vHead = h("strong");
    const vBody = h("span");
    const vSr = h("span", { class: "ss-sr" });
    const vText = h("p", { class: "ss-verdict-text" }, vHead, vBody, vSr);
    const verdict = h(
      "div",
      { class: "ss-verdict tone-good", "aria-live": "polite", "aria-atomic": "true" },
      vBadge,
      vText
    );

    function rule(kind, iconName, title, text) {
      const ico = h("span", { class: "ss-rule-ico", "aria-hidden": "true" });
      ico.innerHTML = L.icon(iconName);
      return h(
        "div",
        { class: "ss-rule is-" + kind },
        ico,
        h("p", null, h("strong", null, title), text)
      );
    }
    const legend = h(
      "div",
      { class: "ss-legend" },
      h("div", { class: "ss-legend-title" }, "Codex 預設的權限（Auto 模式）"),
      rule("in", "unlock", "在工作資料夾「裡面」：", "讀檔、改檔、執行指令，不用問你。"),
      rule("out", "lock", "在「外面」修改檔案，或要上網：", "會先停下來問你同意。")
    );

    const cols = h(
      "div",
      { class: "ss-cols" },
      h("div", { class: "ss-col" }, treePane),
      h("div", { class: "ss-col" }, stats, verdict, legend)
    );

    /* ------------------------------------------------------------------
       下：「請 Codex 把報告存到桌面」
       ------------------------------------------------------------------ */
    const askOut = h("div", {
      class: "ss-ask-out",
      "aria-live": "polite",
      "data-hint": "按下按鈕，看看在目前的工作範圍下，Codex 是直接動手，還是先問你。",
    });
    const askBtn = h(
      "button",
      { type: "button", class: "btn btn-primary ss-ask-btn", onclick: () => ask() },
      "請 Codex 把報告存到桌面"
    );
    const askSec = h(
      "div",
      { class: "ss-ask" },
      h(
        "div",
        { class: "ss-ask-head" },
        h(
          "div",
          { class: "ss-ask-info" },
          h("div", { class: "ss-ask-title" }, "試試看：叫 Codex 寫一個檔案到桌面"),
          h("p", { class: "ss-ask-desc" }, "選不同的工作資料夾，再按一次，比較 Codex 的反應。")
        ),
        askBtn
      ),
      askOut
    );

    const foot = h(
      "div",
      { class: "demo-foot" },
      h("strong", null, "重點："),
      "先打開對的資料夾，再開始叫 Codex 做事。"
    );

    root.append(bar, h("div", { class: "demo-body" }, cols, askSec), foot);

    /* ------------------------------------------------------------------
       行為
       ------------------------------------------------------------------ */
    function clearMarks() {
      const el = desktopRow.el;
      el.classList.remove("is-new", "is-out", "ss-lit", "anim-flash");
    }

    function resetAsk() {
      clearMarks();
      askOut.replaceChildren();
    }

    function askPane(kind, status) {
      return h(
        "div",
        { class: "pane ss-ask-pane is-" + kind + " anim-pop" },
        h(
          "div",
          { class: "pane-head" },
          windowDots(),
          h("span", { class: "pane-name" }, "Codex"),
          h("span", { class: "pane-path" }, status)
        )
      );
    }

    function resolveRow(chipClass, chipText, text) {
      return h(
        "div",
        { class: "ss-resolve anim-pop" },
        h("span", { class: "chip " + chipClass }, chipText),
        h("p", null, text)
      );
    }

    function ask() {
      clearMarks();
      const inside = isWithin(TARGET, current.prefix);
      const shortPath = TARGET.join("\\");
      const fullPath = L.joinPath("win", TARGET);

      if (inside) {
        /* 桌面在工作範圍內：直接寫，不用問 */
        const pane = askPane("direct", "不需要同意");
        pane.append(
          h(
            "div",
            { class: "pane-body" },
            h(
              "div",
              { class: "ss-line" },
              h("span", { class: "chip chip-new" }, "範圍內"),
              h(
                "p",
                null,
                "在工作範圍內，直接寫入 ",
                h("code", { class: "path" }, shortPath)
              )
            ),
            current.inNote ? h("p", { class: "ss-note" }, current.inNote) : null
          )
        );
        askOut.replaceChildren(pane);
        desktopRow.el.classList.add("is-new");
        replay(desktopRow.el, "anim-flash");
        return;
      }

      /* 桌面在工作範圍外：Codex 停下來問你 */
      const pane = askPane("pending", "等你同意");
      const ico = h("span", { class: "ss-msg-ico", "aria-hidden": "true" });
      ico.innerHTML = L.icon("lock");
      const actions = h(
        "div",
        { class: "ss-actions" },
        h(
          "button",
          { type: "button", class: "btn btn-sm", onclick: () => resolve(true) },
          "允許這一次"
        ),
        h(
          "button",
          { type: "button", class: "btn btn-sm", onclick: () => resolve(false) },
          "不允許"
        )
      );
      const body = h(
        "div",
        { class: "pane-body" },
        h(
          "div",
          { class: "ss-msg" },
          ico,
          h(
            "div",
            { class: "ss-msg-text" },
            h("p", null, "Codex 想要修改工作資料夾以外的位置："),
            h("p", null, h("code", { class: "path" }, pathParts(fullPath))),
            h("p", null, "允許嗎？")
          )
        ),
        actions
      );
      pane.append(body);
      askOut.replaceChildren(pane);

      function resolve(allowed) {
        actions.remove();
        pane.classList.remove("is-pending");
        pane.querySelector(".pane-path").textContent = allowed ? "已允許" : "已拒絕";
        if (allowed) {
          pane.classList.add("is-allowed");
          body.append(
            resolveRow(
              "chip-out",
              "已允許（只這一次）",
              "Codex 把 " +
                shortPath +
                " 寫到桌面了。這是你替它開的一次例外，下次它要寫到外面，還是會再問你。"
            )
          );
          desktopRow.el.classList.add("is-out", "ss-lit");
          replay(desktopRow.el, "anim-flash");
        } else {
          pane.classList.add("is-denied");
          body.append(
            resolveRow(
              "chip-new",
              "已拒絕",
              "好習慣：先想想為什麼它要寫到專案外面。想留下報告，請它存在工作資料夾裡面（例如 output 資料夾），需要時你再自己複製到桌面。"
            )
          );
        }
        askBtn.focus();
      }
    }

    function statsFor(opt) {
      const inside = entries.filter((e) => !e.isDir && isWithin(e.parts, opt.prefix));
      const relevant = inside.filter((e) => isWithin(e.parts, PROJECT)).length;
      return { files: inside.length, relevant, unrelated: inside.length - relevant };
    }

    function updatePanel(init) {
      const s = statsFor(current);
      const animate = !init;

      countTo(statFiles.num, s.files, animate);
      countTo(statUnrelated.num, s.unrelated, animate);
      statFiles.fill.style.transform = `scaleX(${s.files / totalFiles})`;
      statUnrelated.fill.style.transform = `scaleX(${s.unrelated / totalFiles})`;
      statFiles.sub.textContent = `其中作業會用到的：${s.relevant} 個。電腦裡共有 ${totalFiles} 個檔案。`;
      statUnrelated.sub.textContent =
        s.unrelated === 0
          ? "沒有。範圍裡只有這份作業的檔案。"
          : "它們跟作業無關，卻在 Codex 讀得到、改得到的範圍內。";

      const pathText = L.joinPath("win", current.prefix);
      pathCode.replaceChildren(...pathParts(pathText));

      vHead.textContent = current.head;
      vBody.textContent = current.body;
      vSr.textContent =
        ` 工作資料夾：${pathText}。預設看得到 ${s.files} 個檔案，其中 ${s.unrelated} 個跟作業無關。`;
      verdict.className = "ss-verdict tone-" + current.tone;
      vBadge.innerHTML = current.tone === "good" ? L.icon("check") : "!";

      if (animate) {
        replay(vText, "ss-swap");
        replay(pathWrap, "ss-swap");
      }
    }

    function select(opt, init) {
      if (!init && opt === current) return;
      current = opt;

      segButtons.forEach((b, i) =>
        b.setAttribute("aria-pressed", OPTIONS[i] === opt ? "true" : "false")
      );

      let first = -1;
      let last = -1;
      rows.forEach((r, i) => {
        const inside = isWithin(r.parts, opt.prefix);
        if (inside) {
          if (first < 0) first = i;
          last = i;
        }
        r.el.classList.toggle("is-dim", !inside);
        r.el.classList.remove("ss-root");
        r.lock.setAttribute("aria-hidden", inside ? "true" : "false");
      });
      span = { first, last };
      rows[first].el.classList.add("ss-root");

      resetAsk();
      place(!init);
      updatePanel(!!init);
    }

    select(OPTIONS[0], true);

    /* 視窗大小或字型載入後，列高會變，邊界框要重新對齊（不做動畫） */
    if ("ResizeObserver" in window) {
      new ResizeObserver(() => place(false)).observe(treeWrap);
    } else {
      window.addEventListener("resize", () => place(false));
    }
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => place(false));
    }
  });
})();
