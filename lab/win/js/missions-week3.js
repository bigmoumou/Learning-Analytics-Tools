/* missions-week3.js — Week 3 mission data, Windows edition (DESIGN W7 on top of M§5.3): ten missions in three groups, each
   startable on its own. MISSIONS owner. Data only: it calls LAB.missions.register and uses the public mission api (M§5.1)
   and the event catalogue (M§3.3). Every string the student reads is Traditional Chinese (Taiwan usage); file and folder
   names the student meets or makes are English (Practice, notes.docx, midterm-report.docx, resume.pdf).

   Same ids, groups, order, steps and engine rules as the Mac missions. What changed for Windows:
   - wording: Enter, 右鍵, 檔案總管, 工作列, 開始, 搜尋, 記事本, Visual Studio Code, 資源回收筒; paths with backslashes
     (`~\Desktop\Project`, PowerShell also takes /);
   - Terminal checks look at `c.canon` (W5: ls cd pwd mkdir mv cp rm cat tar unzip open code …), not at the typed name, so
     dir / gci / Get-ChildItem all count as `ls`, `explorer .` / `ii .` / `start .` as `open`; paths typed by the student are
     read through LAB.win.fromWin (the engine's api.lsDir / api.resolve only know Unix paths);
   - the traps: the mv rename (facts §5.3, also with a trailing \), `unzip` (facts §5.4), `cd` alone does nothing in PowerShell,
     `open .` is not a Windows command;
   - the prompt is `PS C:\Users\an>` (no `~`), so "最後一個字是 ~" became "提示字元的路徑". */
(function (LAB) {
  'use strict';

  var HOME = '/Users/an';
  var DESKTOP = '/Users/an/Desktop';
  var DOWNLOADS = '/Users/an/Downloads';
  var DOCUMENTS = '/Users/an/Documents';
  var PROJECT = '/Users/an/Desktop/Project';
  var AGENTS = PROJECT + '/AGENTS.md';
  var OUTPUT = PROJECT + '/output';
  var REPORT = OUTPUT + '/report.md';

  var G_DESKTOP = '桌面與檔案總管';
  var G_TERMINAL = '終端機（Week 3 補充 2）';      // 補充 2 = the Windows video (補充 1 is the Mac one)
  var G_CODEX = 'Codex';
  var TAG = 'Week 3 補充 2';
  var MAP = '~ 社區（C:\\Users\\an）· Downloads 管理室 · Desktop 中庭 · Desktop\\Project 家 · .. 往外一層';
  var PANE = '導覽窗格';                           // the left pane of File Explorer (zh-TW: 導覽窗格)
  var P_HOME = '`PS C:\\Users\\an>`';              // the prompt when you stand in 社區

  /* ------------------------------------------------------------------ helpers */
  function isFlag(a) { return typeof a === 'string' && a.length > 1 && a.charAt(0) === '-'; }
  /* the operands of a Terminal command: PowerShell switches (-Force, -Recurse, …) and the value of -Filter/-Include/… are skipped,
     the value of -Path / -LiteralPath counts as an operand */
  function operands(args) {
    var out = [], list = args || [];
    for (var i = 0; i < list.length; i++) {
      var a = String(list[i]);
      if (/^-(path|literalpath|lp)$/i.test(a)) { if (i + 1 < list.length) out.push(String(list[++i])); continue; }
      if (/^-(filter|include|exclude|depth|itemtype|type|destination|dest)$/i.test(a)) { i++; continue; }
      if (isFlag(a)) continue;
      out.push(a);
    }
    return out;
  }
  function same(api, a, b) { try { return !!api.same(a, b); } catch (e) { return false; } }
  function isNullish(v) { return v === null || v === undefined; }
  function winPath(p) { return LAB.win ? LAB.win.toWin(p) : p; }

  /* the Terminal's own word for what a command is (W5 `canon`); when it is missing, the alias table of PowerShell 5.1 */
  var ALIAS = {
    ls: 'ls', dir: 'ls', gci: 'ls', 'get-childitem': 'ls',
    cd: 'cd', chdir: 'cd', sl: 'cd', 'set-location': 'cd', 'cd..': 'cd', 'cd\\': 'cd',
    pwd: 'pwd', gl: 'pwd', 'get-location': 'pwd',
    mkdir: 'mkdir', md: 'mkdir',
    mv: 'mv', move: 'mv', mi: 'mv', 'move-item': 'mv',
    cp: 'cp', copy: 'cp', cpi: 'cp', 'copy-item': 'cp',
    rm: 'rm', del: 'rm', erase: 'rm', ri: 'rm', 'remove-item': 'rm', rmdir: 'rm', rd: 'rm',
    cat: 'cat', type: 'cat', gc: 'cat', 'get-content': 'cat',
    tar: 'tar', unzip: 'unzip',
    explorer: 'open', 'explorer.exe': 'open', ii: 'open', 'invoke-item': 'open', start: 'open', 'start-process': 'open',
    code: 'code', notepad: 'notepad'
  };
  function canonOf(c) {
    if (c && c.canon) return String(c.canon);
    var n = String((c && c.name) || '').toLowerCase();
    return Object.prototype.hasOwnProperty.call(ALIAS, n) ? ALIAS[n] : 'unknown';
  }
  /* a path the student typed in a command, as an internal path (null when it is not a path at all) */
  function argPath(c, arg) {
    try { return LAB.win.fromWin(arg, c.cwd); } catch (e) { return null; }
  }
  /* the folder an `ls` listed: its first operand resolved against c.cwd, else c.cwd */
  function lsDirOf(c) {
    var first = operands(c.args)[0];
    if (first === undefined) return c.cwd;
    return argPath(c, first);
  }
  /* `cd ..` in any spelling: cd .. / cd ..\ / cd../ / cd.. (PowerShell has a function called cd..) */
  function isUpCmd(c) {
    if (String(c.name || '').toLowerCase() === 'cd..') return true;
    var a = operands(c.args)[0];
    return a !== undefined && /^\.\.[\\/]*$/.test(String(a));
  }
  /* a `cd` that names its target (a bare `cd` does nothing in PowerShell 5.1) and ends in `dest` */
  function cdTo(api, c, dest) {
    return canonOf(c) === 'cd' && c.status === 0 && operands(c.args).length > 0 && same(api, c.cwdAfter, dest);
  }

  /* Codex projects (the codex file may not be loaded yet: everything here is tolerant) */
  function projectList(api) {
    try {
      var st = api.codex && api.codex.state ? api.codex.state() : null;
      return st && st.projects ? st.projects : [];
    } catch (e) { return []; }
  }
  function hasProject(api, path) {
    return projectList(api).some(function (p) { return same(api, p.path, path); });
  }
  function ensureProject(api) {
    if (!api.codex || !api.codex.addProject) return;
    if (!api.exists(PROJECT) || hasProject(api, PROJECT)) return;
    try { api.codex.addProject(PROJECT, { trust: true, select: false }); } catch (e) { /* ignore */ }
  }
  function dropProject(api) {
    if (!api.codex || !api.codex.removeProject) return;
    try { api.codex.removeProject(PROJECT, { chats: 'remove' }); } catch (e) { /* ignore */ }
  }
  function winHasPath(api, id, path) {
    var w = null;
    try { w = LAB.wm.get(id); } catch (e) { w = null; }
    return !!(w && w.state && w.state.path && same(api, w.state.path, path));
  }
  /* the folder the frontmost Terminal window is in right now (state, for steps that must complete without a new event) */
  function terminalCwd() {
    try {
      var t = LAB.terminal && LAB.terminal.current ? LAB.terminal.current() : null;
      if (t && t.session && t.session.cwd) return t.session.cwd;
    } catch (e) { /* no terminal */ }
    return null;
  }

  /* Zip-kind files that sit directly in Desktop, Project, Downloads or ~ under any name (the "typo trap": mv to a
     destination that does not exist renames the zip instead of moving it — also with a trailing \ on Windows). */
  function zipCopies(api, includeOriginalName) {
    var out = [];
    [DESKTOP, PROJECT, DOWNLOADS, HOME].forEach(function (dir) {
      var list = [];
      try { list = api.vfs.list(dir); } catch (e) { list = []; }
      list.forEach(function (s) {
        if (s.kind !== 'zip') return;
        if (!includeOriginalName && s.name.toLowerCase() === 'week3.zip') return;
        out.push({ name: s.name, dir: dir, path: s.path, size: s.size });
      });
    });
    return out;
  }
  /* remove the renamed copies the typo trap leaves behind (same size as the seeded week3.zip) */
  function removeRenamedZips(api) {
    var seedNode = null;
    try { seedNode = LAB.seed.nodeAt(DOWNLOADS + '/week3.zip'); } catch (e) { seedNode = null; }
    var seedSize = seedNode && typeof seedNode.s === 'number' ? seedNode.s : 1301;
    zipCopies(api, true).forEach(function (z) {
      if (z.size === seedSize) api.remove(z.path);
    });
  }

  /* every mission starts from a PC that has the Desktop, Project (with data and AGENTS.md); a Project that was recycled,
     renamed away or removed with rm comes back (resetsFiles: 「重來這個任務」 does the same) */
  function ensureBase(api) {
    api.ensureSeed(DESKTOP);
    api.ensureSeed(PROJECT);
    api.ensureSeed(PROJECT + '/data');
    api.ensureSeed(AGENTS);
  }
  /* a Codex reply that was written outside the Project: the one trap behind the Codex missions */
  var NOT_IN_PROJECT = '這個對話不在 Project 底下（輸入框上方沒有「Project」標籤），所以檔案沒有放進專案。點 Codex 左邊的 Project，在專案底下再試一次。';
  function orphanReplyTrap(intentId) {
    return function (ev, api) {
      if (!ev || ev.name !== 'codex:reply' || !ev.data) return null;
      var d = ev.data;
      if (d.intent === intentId && isNullish(d.projectPath)) return NOT_IN_PROJECT;
      return null;
    };
  }

  /* Windows has no `unzip` (win-facts §5.4: the red 「無法辨識 'unzip' 詞彙」). The sentence is the one of DESIGN W7. */
  function unzipTrap(ev, api) {
    var u = api.termCmd(ev, function (c) { return canonOf(c) === 'unzip' || String(c.name || '').toLowerCase() === 'unzip'; });
    return u ? 'Windows 沒有 unzip，要用 tar -xvf。' : null;
  }
  /* Two quiet lines the engine (missions.js) does not know, used when a step has no trap of its own to say. The engine itself covers
     the input method (a failed command with a non-ASCII name) and the red 找不到 '…' 路徑 error, so they are not repeated here. */
  var NON_ASCII = /[^\u0000-\u007f]|\u3000/;
  function termGeneric(ev, api) {
    if (!ev || ev.name !== 'term:run' || !ev.data) return null;
    var cmds = ev.data.cmds || [], i, c;
    for (i = 0; i < cmds.length; i++) {          // a word PowerShell does not know (a typo): red 無法辨識 '…' 詞彙
      c = cmds[i];
      if (canonOf(c) === 'unknown' && c.status && !NON_ASCII.test(String(c.name || ''))) return '「' + c.name + '」不是指令，多半是拼錯字：ls、cd、pwd、mv、tar 都是小寫英文，指令和後面的東西中間要有一個空格。';
    }
    for (i = 0; i < cmds.length; i++) {          // the Mac habit `ls -l`: PowerShell reads -l as -LiteralPath and complains
      c = cmds[i];
      if (c.status && canonOf(c) === 'ls' && (c.args || []).some(function (a) { return /^-l$/i.test(String(a)); })) return '`ls -l` 是 Mac 的寫法，PowerShell 的 ls 不用加 -l：直接輸入 `ls` 就會有一張表格。';
    }
    return null;
  }
  function firstTrap() {
    var fns = [].slice.call(arguments);
    return function (ev, api) {
      for (var i = 0; i < fns.length; i++) {
        var t = null;
        try { t = fns[i](ev, api); } catch (e) { t = null; }
        if (t) return t;
      }
      return null;
    };
  }
  /* every Terminal step (after step 1) also gets the generic Windows nudges */
  function withTermGeneric(steps) {
    steps.forEach(function (s, i) { if (i > 0) s.trap = s.trap ? firstTrap(s.trap, termGeneric) : termGeneric; });
    return steps;
  }

  /* ------------------------------------------------------------------ cue targets (M§5.1 `target`, M§19.4)
     A step may name the thing to click, so the practice PC can point at it. These helpers only READ the page:
     they return an Element (or null) and never click anything. A target is a selector string, an array of them, or
     function(api) → Element|null. Here every target is a function (or a string) built from the pieces below:
       chain(a, b, c)   the first candidate that is really visible (not covered by another window), else the first one
                        that exists; strings are selectors, functions return an Element or null
     The hooks are the Mac ones: the taskbar buttons are still data-lab="dock-item" data-app=…, File Explorer still uses fd-*. */
  function dock(app) { return '[data-lab=dock-item][data-app=' + app + ']'; }

  function liveWins(appId) {
    var l = [];
    try { l = LAB.wm.byApp(appId).filter(function (w) { return !w.minimized; }); } catch (e) { l = []; }
    return l;                                    // bottom to top
  }
  /* the hit-test of the element's centre: true when the element itself (or something inside it) is what the pointer would meet */
  function seeable(el) {
    if (!el || !el.getBoundingClientRect) return false;
    var r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    var t = null;
    try { t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); } catch (e) { t = null; }
    return !!t && (t === el || el.contains(t));
  }
  /* case-insensitive on the path: Windows keeps the case the student typed (Practice or practice) */
  function byPath(root, lab, path) {
    if (!root) return null;
    if (path === null || path === undefined) return root.querySelector('[data-lab="' + lab + '"]');
    var want = String(path).toLowerCase();
    var list = root.querySelectorAll('[data-lab="' + lab + '"]');
    for (var i = 0; i < list.length; i++) {
      var p = list[i].getAttribute('data-path');
      if (p && p.toLowerCase() === want) return list[i];
    }
    return null;
  }
  /* an element of an app's windows, topmost window first; the first one that is visible, else the first that exists */
  function inWins(appId, lab, path) {
    return function () {
      var l = liveWins(appId), first = null, i, el;
      for (i = l.length - 1; i >= 0; i--) {
        el = byPath(l[i].el, lab, path);
        if (!el) continue;
        if (seeable(el)) return el;
        if (!first) first = el;
      }
      return first;
    };
  }
  function desktopIcon(path) {
    return function () { return byPath(document.getElementById('lab-desktop'), 'desktop-icon', path); };
  }
  function trusted(fn) { fn.trusted = true; return fn; }      // the function already checked that its element is visible
  function chain() {
    var parts = [].slice.call(arguments);
    return function (api) {
      var fallback = null;
      for (var i = 0; i < parts.length; i++) {
        var part = parts[i], el = null;
        try { el = typeof part === 'function' ? part(api) : document.querySelector(part); } catch (e) { el = null; }
        if (!el) continue;
        if ((typeof part === 'function' && part.trusted) || seeable(el)) return el;
        if (!fallback) fallback = el;
      }
      return fallback;
    };
  }
  var fdItem = function (p) { return inWins('finder', 'fd-item', p); };
  var fdSide = function (p) { return inWins('finder', 'fd-sidebar-item', p); };
  var fdSeg = function (p) { return inWins('finder', 'fd-pathbar-seg', p); };
  /* walking to a folder in File Explorer: the deepest of `paths` that is on screen, else the navigation-pane item `side`, else File Explorer on the taskbar */
  function finderWalk(paths, side) {
    return chain.apply(null, paths.map(fdItem).concat([fdSide(side || DESKTOP), dock('finder')]));
  }
  /* typing in the Terminal: with the window already focused the student is typing (the target is the hidden input, which the
     cue leaves alone); otherwise the whole screen is the thing to click. No Terminal window: the taskbar button. */
  var termShown = trusted(function () {
    var l = liveWins('terminal');
    if (!l.length) return null;
    var w = l[l.length - 1];
    var screen = w.el.querySelector('[data-lab=term-screen]');
    if (!seeable(screen)) return null;
    var f = LAB.wm.focused();
    if (f && f.id === w.id) return w.el.querySelector('[data-lab=term-input]');
    return screen;
  });
  var T_TERM = chain(termShown, dock('terminal'));

  var cxNew = inWins('codex', 'cx-new-chat');
  var cxComposer = inWins('codex', 'cx-composer');
  var cxProject = inWins('codex', 'cx-project', PROJECT);
  var cxPlus = inWins('codex', 'cx-project-plus', PROJECT);
  function cdRow(p) { return inWins('code', 'cd-explorer-row', p); }
  /* "put a sentence into Codex": the composer when the open chat is the Project's, else the Project row first */
  var T_PROJECT_CHAT = chain(function (api) {
    var c = null;
    try { c = api.codex.activeChat(); } catch (e) { c = null; }
    return c && !isNullish(c.projectPath) && same(api, c.projectPath, PROJECT) ? cxComposer() : cxProject();
  }, dock('codex'));

  /* the first step of every Terminal mission */
  function openTerminalStep() {
    return {
      id: 's1',
      text: '點工作列上的「終端機」（滑鼠移過去會顯示名字）。也可以點工作列的「搜尋」，輸入 `terminal`，再按 Enter。',
      hint: '終端機的圖示是黑底，上面有 `>_`。打指令前，輸入法先切到英文：右下角顯示「中」時，按一下 Shift，變成「英」才打得出指令。',
      answer: '點一下工作列上的「終端機」。',
      target: dock('terminal'),
      // already open (a Terminal from an earlier mission) counts: the step ticks itself
      check: function (ev, api) {
        return !!(api.seen('win:open', function (d) { return d.appId === 'terminal'; }) || api.win('terminal').length > 0);
      }
    };
  }

  /* ------------------------------------------------------------------ 1 · 桌面與檔案總管 */
  LAB.missions.register({
    id: 'w3-01-desktop',
    week: 3, order: 1,
    group: G_DESKTOP,
    title: '認識桌面與檔案總管',
    minutes: 6,
    resetsFiles: true,
    needs: [PROJECT],
    intro: '這是一台練習用的 Windows 電腦。先認識最常用的兩個地方：桌面，和用來看檔案的檔案總管。',
    prepare: function (api) {
      ensureBase(api);
      api.remove(DESKTOP + '/Practice');           // the file system ignores case, so this also removes `practice`
    },
    steps: [
      {
        id: 's1',
        text: '點工作列上的檔案總管（黃色資料夾的圖示），打開一個視窗。',
        hint: '螢幕最下面那一條叫工作列，檔案總管的圖示是黃色資料夾。滑鼠移過去會顯示名字。',
        answer: '點一下工作列上的檔案總管。',
        target: dock('finder'),
        check: function (ev, api) {
          return !!(api.seen('win:open', function (d) { return d.appId === 'finder'; }) || api.win('finder').length > 0);
        }
      },
      {
        id: 's2',
        text: '在檔案總管左邊的' + PANE + '點「桌面」。',
        hint: PANE + '在視窗左邊，找到寫著「桌面」的那一列。',
        answer: '點' + PANE + '的「桌面」。',
        target: chain(fdSide(DESKTOP), dock('finder')),
        check: function (ev, api) {
          return !!(api.seen('finder:navigate', function (d) { return same(api, d.path, DESKTOP); }) || api.finderAt(DESKTOP));
        }
      },
      {
        id: 's3',
        text: '在桌面上點兩下 Project 資料夾，打開它。',
        hint: '要連續點兩下，點一下只是選取。桌面的 Project 圖示在螢幕左上角（資源回收筒的下面），也可以在檔案總管視窗裡點兩下。',
        answer: '點兩下 Project。',
        target: chain(desktopIcon(PROJECT), fdItem(PROJECT), fdSide(DESKTOP), dock('finder')),
        check: function (ev, api) {
          return !!(api.seen('finder:navigate', function (d) { return same(api, d.path, PROJECT); }) || api.finderAt(PROJECT));
        }
      },
      {
        id: 's4',
        text: '看視窗上方的網址列，再點其中的「桌面」，回到上一層。',
        hint: '網址列從左到右，就是這個資料夾的完整位置：本機 › 本機磁碟 (C:) › 使用者 › an › 桌面 › Project，也就是 `C:\\Users\\an\\Desktop\\Project`。',
        answer: '點網址列的「桌面」（或' + PANE + '的「桌面」，或左上角的「向上」↑、「上一頁」←）。',
        target: chain(fdSeg(DESKTOP), fdSide(DESKTOP), dock('finder')),
        check: function (ev, api) {
          // any natural way back to the Desktop counts (address bar, navigation pane, back, up, typing the address…)
          if (api.seen('finder:navigate', function (d) { return same(api, d.path, DESKTOP); })) return true;
          // state fallback: an Explorer window shows the Desktop and none is still inside Project.
          // (A second window left on the Desktop from step 2 must not finish this step by itself.)
          return api.finderAt(DESKTOP) && !api.finderAt(PROJECT);
        }
      },
      {
        id: 's5',
        text: '在桌面空白處按右鍵，選「新增」→「資料夾」，命名為「Practice」，按 Enter。',
        hint: '如果找不到空白處，先把檔案總管視窗拖開或最小化。新增後名字會變成可以直接輸入的狀態；輸入法先切到英文（按一下 Shift，右下角的「中」變成「英」）再打 Practice。',
        answer: '右鍵 → 新增 → 資料夾 → 輸入 Practice → Enter。',
        check: function (ev, api) {
          return !!(api.exists(DESKTOP + '/Practice') && api.vfs.isDir(DESKTOP + '/Practice'));      // case-insensitive, like Windows
        },
        trap: function (ev, api) {
          // a new folder on the Desktop with another name (「Practise」, 「Practice 」, 「練習」 …)
          if (!ev || api.exists(DESKTOP + '/Practice')) return null;
          var list = [];
          try { list = api.vfs.list(DESKTOP); } catch (e) { list = []; }
          var odd = null;
          list.forEach(function (s) {
            if (s.type !== 'dir' || s.name === 'Project') return;
            if (/^新增資料夾( \(\d+\))?$/.test(s.name) && ev.name === 'fs:change') return;      // still being named
            if (!odd) odd = s.name;
          });
          if (!odd) return null;
          return '桌面上多了一個叫「' + odd + '」的資料夾，名字要剛好是 Practice（英文，沒有空格，大小寫都可以）。點它一下，按 F2 改名；輸入法要先切到英文。';
        }
      },
      {
        id: 's6',
        text: '在檔案總管的桌面裡找到「Practice」，點它一下：它和桌面上的圖示是同一個東西。',
        hint: '檔案總管視窗要停在「桌面」；如果不在，點' + PANE + '的「桌面」。',
        answer: '檔案總管 → ' + PANE + '「桌面」→ 點「Practice」。',
        target: finderWalk([DESKTOP + '/Practice']),
        check: function (ev, api) {
          return !!api.seen('finder:select', function (d) {
            return (d.paths || []).some(function (p) { return same(api, p, DESKTOP + '/Practice'); });
          });
        }
      }
    ],
    outro: '做得好。桌面上的東西，其實都是 `C:\\Users\\an\\Desktop` 這個資料夾裡的檔案。'
  });

  /* ------------------------------------------------------------------ 2 · ls 看一圈 */
  LAB.missions.register({
    id: 'w3-t1-ls',
    week: 3, order: 2,
    group: G_TERMINAL,
    title: 'ls 看一圈',
    minutes: 4,
    tag: TAG,
    map: MAP,
    resetsFiles: false,
    needs: [PROJECT],
    intro: '終端機是用打字叫電腦做事的視窗，這裡用的是 Windows PowerShell。ls 是「看一圈」：看看一個地方裡有什麼。影片把電腦比喻成社區：~ 是社區，Downloads 是管理室，Desktop 是中庭，Project 是家。不確定時，展開卡片裡的「地圖」。',
    prepare: function (api) {
      ensureBase(api);
    },
    steps: withTermGeneric([
      openTerminalStep(),
      {
        id: 's2',
        text: '輸入 `ls`，按 Enter：看看社區（~）裡有什麼。',
        hint: 'ls 是「看一圈」。打完要按 Enter 才會執行。提示字元寫著 ' + P_HOME + '，就表示你站在社區。印出來的表格，Name 欄是名字，Mode 欄的 d 代表資料夾。',
        answer: '輸入：`ls`（提示字元是 ' + P_HOME + ' 時）。人在別的資料夾的話，輸入 `ls ~`。',
        // no `where`: the engine would say 「~」, and this prompt has no ~ in it
        replay: 'mission',
        target: T_TERM,
        check: function (ev, api) {
          return !!api.termSeen(function (c) { return canonOf(c) === 'ls' && c.status === 0 && same(api, lsDirOf(c), HOME); });
        },
        trap: function (ev, api) {
          // a plain `ls` from another folder lists THAT folder, not the community
          var wrong = api.termCmd(ev, function (c) {
            return canonOf(c) === 'ls' && c.status === 0 && operands(c.args).length === 0 && !same(api, c.cwd, HOME);
          });
          if (!wrong) return null;
          return '你列出的是 `' + winPath(wrong.cwd) + '`，不是社區：ls 看的是你現在站的地方，而提示字元的路徑不是 `C:\\Users\\an`。想看社區，輸入 `ls ~`。';
        }
      },
      {
        id: 's3',
        text: '不用走過去也能看：輸入 `ls Downloads`，看看管理室裡有什麼。',
        hint: 'ls 後面接地址，就看那個地方，不用走過去。Downloads（檔案總管叫它「下載」）是管理室。提示字元不是 ' + P_HOME + ' 的話，找不到 Downloads，改用 `ls ~\\Downloads`。',
        answer: '輸入：`ls Downloads`（在社區），或 `ls ~\\Downloads`（在哪裡都可以）。',
        replay: 'mission',
        target: T_TERM,
        check: function (ev, api) {
          return !!api.termSeen(function (c) { return canonOf(c) === 'ls' && c.status === 0 && same(api, lsDirOf(c), DOWNLOADS); });
        }
      },
      {
        id: 's4',
        text: '看看中庭（Desktop）裡有什麼，找到「家」Project。',
        hint: '想看哪個地方，就在 ls 後面接它的地址。中庭是 Desktop，就在社區裡面。',
        answer: '輸入：`ls Desktop`（在社區），或 `ls ~\\Desktop`。',
        replay: 'mission',
        target: T_TERM,
        check: function (ev, api) {
          return !!api.termSeen(function (c) { return canonOf(c) === 'ls' && c.status === 0 && same(api, lsDirOf(c), DESKTOP); });
        }
      },
      {
        id: 's5',
        text: '看看家（Project）裡有什麼。',
        hint: '地址用 \\ 隔開（PowerShell 也接受 /）：先中庭 Desktop，再家 Project。把這一串接在 ls 後面。',
        answer: '輸入：`ls Desktop\\Project`（在社區），或 `ls ~\\Desktop\\Project`。會看到 AGENTS.md、data 和 notes.docx。',
        replay: 'mission',
        target: T_TERM,
        check: function (ev, api) {
          return !!api.termSeen(function (c) { return canonOf(c) === 'ls' && c.status === 0 && same(api, lsDirOf(c), PROJECT); });
        }
      }
    ]),
    outro: 'ls 後面不接東西，看的是你現在站的地方；接地址，就看那個地方。下一個任務用 cd 真的走過去。'
  });

  /* ------------------------------------------------------------------ 3 · cd 走路 */
  LAB.missions.register({
    id: 'w3-t2-cd',
    week: 3, order: 3,
    group: G_TERMINAL,
    title: 'cd 走路',
    minutes: 6,
    tag: TAG,
    map: MAP,
    resetsFiles: false,
    needs: [PROJECT],
    intro: 'cd 是走路。走到哪裡，提示字元裡的路徑就跟著變。影片的比喻：~ 是社區，Desktop 是中庭，Project 是家。不確定時，展開卡片裡的「地圖」。',
    prepare: function (api) {
      ensureBase(api);
    },
    steps: withTermGeneric([
      openTerminalStep(),
      {
        id: 's2',
        text: '輸入 `cd Desktop`，按 Enter，走進中庭。提示字元會變成 `PS C:\\Users\\an\\Desktop>`。',
        hint: 'cd 是走路，後面接要去的資料夾名字。你在哪裡，提示字元的路徑會告訴你；要從社區（提示字元是 ' + P_HOME + '）出發，才找得到 Desktop。',
        answer: '輸入：`cd Desktop`。提示字元的路徑多了 \\Desktop。',
        replay: 'mission',
        target: T_TERM,
        check: function (ev, api) {
          return !!api.termSeen(function (c) { return cdTo(api, c, DESKTOP); });
        },
        trap: function (ev, api) {
          // `cd Desktop` typed while the Terminal is not in ~ (it was left in Project, say): the red 「找不到路徑」
          var bad = api.termCmd(ev, function (c) { return canonOf(c) === 'cd' && c.status !== 0 && !same(api, c.cwd, HOME); });
          if (!bad) return null;
          return '你現在不在社區：提示字元的路徑不是 `C:\\Users\\an`。先輸入 `cd ~` 回到社區，再輸入 `cd Desktop`。';
        }
      },
      {
        id: 's3',
        text: '走進家（Project），再用 `ls` 看一圈。',
        hint: 'cd 後面接資料夾名字：家（Project）就在中庭（Desktop）裡面。ls 看一圈，會看到 AGENTS.md、data 和 notes.docx。',
        answer: '輸入：`cd Project`，Enter；`ls`，Enter。',
        where: DESKTOP,
        replay: 'mission',
        target: T_TERM,
        check: function (ev, api) {
          return !!api.termSeen(function (c) { return canonOf(c) === 'ls' && c.status === 0 && same(api, c.cwd, PROJECT); });
        }
      },
      {
        id: 's4',
        text: '輸入 `pwd`，看看你現在的完整地址。',
        hint: 'pwd 會印出你現在所在的完整位置，像在社區裡看門牌。Path 下面那一行就是地址。在哪個資料夾都可以。',
        answer: '輸入：`pwd`。在家（Project）會印出 `C:\\Users\\an\\Desktop\\Project`。',
        replay: 'mission',
        target: T_TERM,
        check: function (ev, api) {
          return !!api.termSeen(function (c) { return canonOf(c) === 'pwd' && c.status === 0; });
        }
      },
      {
        id: 's5',
        text: '用 `cd ..` 往外一層，回到中庭。',
        hint: '兩個點 .. 代表「往外一層」。從 Project 往外一層，就回到 Desktop。提示字元的路徑會少掉 \\Project。',
        answer: '輸入：`cd ..`',
        where: PROJECT,
        replay: 'mission',
        target: T_TERM,
        check: function (ev, api) {
          return !!api.termSeen(function (c) {
            return canonOf(c) === 'cd' && c.status === 0 && isUpCmd(c) && same(api, c.cwdAfter, DESKTOP);
          });
        }
      },
      {
        id: 's6',
        text: '用 `cd ~` 一步回到社區，不管你現在在哪裡都可以。',
        hint: '~ 代表你的「社區」，也就是 `C:\\Users\\an`（正式名稱是家目錄）。回到社區後，提示字元會變回 ' + P_HOME + '。',
        answer: '輸入：`cd ~`',
        replay: 'mission',
        target: T_TERM,
        check: function (ev, api) {
          return !!api.termSeen(function (c) { return cdTo(api, c, HOME); });
        },
        trap: function (ev, api) {
          // PowerShell 5.1: a bare `cd` stays where it is (the Mac's cd goes home)
          var bare = api.termCmd(ev, function (c) { return canonOf(c) === 'cd' && c.status === 0 && operands(c.args).length === 0; });
          return bare ? '在 PowerShell 裡，只打 `cd` 不會回社區（和 Mac 不一樣）。要加上 ~：`cd ~`。' : null;
        }
      },
      {
        id: 's7',
        text: '用一整串地址，一步走回家。',
        hint: 'cd 後面接地址：~ 是社區，Desktop 是中庭，Project 是家，用 \\ 隔開（PowerShell 也接受 /）。',
        answer: '輸入：`cd ~\\Desktop\\Project`',
        replay: 'mission',
        target: T_TERM,
        check: function (ev, api) {
          // one `cd` whose address has a \ or / in it and that ends in Project
          return !!api.termSeen(function (c) {
            return cdTo(api, c, PROJECT) && /[\\/]/.test(String(operands(c.args)[0] || ''));
          });
        }
      }
    ]),
    outro: '`cd 資料夾名字` 走進去，`cd ..` 往外一層，`cd ~` 回社區，`cd` 加一整串地址，一步到位。'
  });

  /* ------------------------------------------------------------------ 4 · mv 搬東西 */
  LAB.missions.register({
    id: 'w3-t3-mv',
    week: 3, order: 4,
    group: G_TERMINAL,
    title: 'mv 搬東西',
    minutes: 5,
    tag: TAG,
    map: MAP,
    resetsFiles: true,
    needs: [PROJECT],
    intro: '老師給的壓縮檔 week3.zip 在管理室（Downloads）。把這個包裹搬回家（Project）。mv 是搬走，不是複製。',
    prepare: function (api) {
      ensureBase(api);
      api.remove(DOWNLOADS + '/week3');
      api.remove(PROJECT + '/week3');
      api.remove(PROJECT + '/week3.zip');
      api.remove(DESKTOP + '/week3.zip');
      removeRenamedZips(api);              // a renamed copy left by the "typo trap" (in Downloads, Desktop, Project or ~)
      api.ensureSeed(DOWNLOADS + '/week3.zip', { overwrite: true });
    },
    steps: withTermGeneric([
      openTerminalStep(),
      {
        id: 's2',
        text: '走到管理室：輸入 `cd Downloads`，按 Enter，再輸入 `ls`，看到 week3.zip。',
        hint: 'cd 後面接資料夾名字，ls 看一圈。下載在終端機裡叫 Downloads（管理室）。提示字元不是 ' + P_HOME + ' 的話，找不到 Downloads，改用 `cd ~\\Downloads`。',
        answer: '`cd Downloads`，Enter；`ls`，Enter。會看到 syllabus.pdf 和 week3.zip。',
        replay: 'mission',
        target: T_TERM,
        check: function (ev, api) {
          return !!api.termSeen(function (c) { return canonOf(c) === 'ls' && c.status === 0 && same(api, lsDirOf(c), DOWNLOADS); });
        }
      },
      {
        id: 's3',
        text: '把 week3.zip 搬進家：`mv week3.zip ~\\Desktop\\Project`',
        hint: 'mv 東西 地方。week3.zip 是要搬的東西；地方是一串地址：~ 是社區，Desktop 是中庭，Project 是家，用 \\ 隔開。沒有印出任何字，就是成功了。',
        answer: '輸入：`mv week3.zip ~\\Desktop\\Project`',
        where: DOWNLOADS,
        target: T_TERM,
        check: function (ev, api) {
          // a student who ran ahead (moved it, extracted it, tidied up) must not get stuck here
          return !!((api.exists(PROJECT + '/week3.zip') || api.exists(PROJECT + '/week3')) && !api.exists(DOWNLOADS + '/week3.zip'));
        },
        trap: function (ev, api) {
          // a second `mv week3.zip …` onto a file that is already there: PowerShell refuses (win-facts §5.3), the zip stays put
          if (api.exists(DOWNLOADS + '/week3.zip') && api.exists(PROJECT + '/week3.zip')) {
            var dup = api.termCmd(ev, function (c) { return canonOf(c) === 'mv' && c.status !== 0 && /已存在|已經存在/.test(String(c.out || '')); });
            if (dup) return 'Project 裡已經有一個 week3.zip 了，所以 mv 不肯再放一個。按下面的「重來這個任務」，讓檔案回到起始狀態再做一次。';
          }
          if (api.exists(DOWNLOADS + '/week3.zip') || api.exists(PROJECT + '/week3.zip')) return null;
          var copies = zipCopies(api, false);
          if (!copies.length) {
            if (api.exists(PROJECT + '/week3') || api.exists(DESKTOP + '/week3.zip') || api.exists(HOME + '/week3.zip')) return null;
            return '找不到 week3.zip 了（可能被 rm 刪掉，或丟進資源回收筒）。按下面的「重來這個任務」，它會放回 Downloads。';
          }
          var z = copies[0];
          var where = z.dir === DESKTOP ? 'Desktop' : z.dir === DOWNLOADS ? 'Downloads' : z.dir === HOME ? '~' : 'Project';
          return 'week3.zip 被改名成「' + z.name + '」了：mv 的目的地不存在時，會直接把東西改名（連最後加 \\ 也一樣）。' +
            '看看 ' + where + '，多了一個叫「' + z.name + '」的壓縮檔。' +
            '在 ' + where + ' 輸入 `mv ' + z.name + ' week3.zip` 改回名字，再輸入 `mv week3.zip ~\\Desktop\\Project`，把它搬進 Project。';
        }
      },
      {
        id: 's4',
        text: '再 ls 一次看管理室：week3.zip 還在嗎？',
        hint: 'mv 是搬走，不是複製。',
        answer: '在 Downloads 輸入：`ls`（或在別處輸入 `ls ~\\Downloads`）。syllabus.pdf 還在，week3.zip 不見了。',
        where: DOWNLOADS,
        replay: 'mission',
        target: T_TERM,
        check: function (ev, api) {
          return !!api.termSeen(function (c) {
            return canonOf(c) === 'ls' && c.status === 0 && same(api, lsDirOf(c), DOWNLOADS) && !/week3\.zip/.test(String(c.out || ''));
          });
        }
      },
      {
        id: 's5',
        text: '用一整串地址走回家（Project），再 ls 確認包裹到了。',
        hint: 'cd 後面接地址：~ 是社區，Desktop 是中庭，Project 是家，用 \\ 隔開。ls 會看到 week3.zip（還有 Project 原本的東西）。',
        answer: '`cd ~\\Desktop\\Project`，Enter；`ls`，Enter。',
        where: DOWNLOADS,
        replay: 'mission',
        target: T_TERM,
        check: function (ev, api) {
          return !!api.termSeen(function (c) {
            // week3.zip, or (a student who ran ahead, extracted and tidied up already) the week3 folder it left behind
            return canonOf(c) === 'ls' && c.status === 0 && same(api, lsDirOf(c), PROJECT) && /week3/.test(String(c.out || ''));
          });
        }
      }
    ]),
    outro: 'mv 東西 地方。管理室裡的 week3.zip 不見了，因為它已經搬進家裡。'
  });

  /* ------------------------------------------------------------------ 5 · tar 拆包裹 (the id stays w3-t4-unzip) */
  LAB.missions.register({
    id: 'w3-t4-unzip',
    week: 3, order: 5,
    group: G_TERMINAL,
    title: 'tar 拆包裹',
    minutes: 5,
    tag: TAG,
    map: MAP,
    resetsFiles: true,
    needs: [PROJECT],
    intro: '包裹 week3.zip 已經在家（Project）裡。把它拆開，再把包裝紙放到家門外（中庭）。',
    prepare: function (api) {
      ensureBase(api);
      api.remove(DOWNLOADS + '/week3');
      api.remove(PROJECT + '/week3');
      api.remove(DESKTOP + '/week3.zip');
      removeRenamedZips(api);              // the original and any renamed copy: the package is put back in Project below
      // the story: the package was already carried home (mission 4), so Downloads no longer has it
      api.remove(DOWNLOADS + '/week3.zip');
      api.remove(PROJECT + '/week3.zip');
      api.ensureSeed(DOWNLOADS + '/week3.zip', { overwrite: true });
      try { api.vfs.move(DOWNLOADS + '/week3.zip', PROJECT + '/week3.zip', { by: 'system' }); } catch (e) { /* the zip stays in Downloads */ }
    },
    steps: withTermGeneric([
      openTerminalStep(),
      {
        id: 's2',
        text: '走回家（Project）：輸入 `cd ~\\Desktop\\Project`，按 Enter。',
        hint: 'cd 後面接地址：~ 是社區，Desktop 是中庭，Project 是家，用 \\ 隔開（PowerShell 也接受 /）。回到家以後，提示字元會是 `PS C:\\Users\\an\\Desktop\\Project>`。',
        answer: '輸入：`cd ~\\Desktop\\Project`',
        target: T_TERM,
        check: function (ev, api) {
          // a cd (or any command) that ended in Project, or a Terminal that is already standing there (it ticks by itself)
          if (api.termCmd(ev, function (c) { return same(api, c.cwdAfter, PROJECT); })) return true;
          return same(api, terminalCwd(), PROJECT);
        }
      },
      {
        id: 's3',
        text: '拆包裹：輸入 `tar -xvf week3.zip`，再輸入 `ls` 看看多了什麼。',
        hint: 'tar 後面接要拆的檔案。-xvf 是三個意思：x 解開、v 列出、f 指定檔案。它會把東西拆在現在這個資料夾，多出一個叫 week3 的資料夾。',
        answer: '`tar -xvf week3.zip`，Enter；`ls`，Enter。',
        where: PROJECT,
        replay: 'mission',
        target: T_TERM,
        check: function (ev, api) {
          // ls pads names with spaces, so the standalone word `week3` only appears after the extraction
          // (`week3.zip` alone does not match).
          return !!(api.exists(PROJECT + '/week3/README.md') &&
            api.termSeen(function (c) {
              return canonOf(c) === 'ls' && c.status === 0 && same(api, lsDirOf(c), PROJECT) && /(^|\s)week3(\s|$)/.test(String(c.out || ''));
            }));
        },
        trap: function (ev, api) {
          if (!ev || ev.name !== 'term:run') return null;
          var uz = unzipTrap(ev, api);
          if (uz) return uz;
          var wrong = api.termCmd(ev, function (c) { return canonOf(c) === 'tar' && c.status === 0 && !same(api, c.cwd, PROJECT); });
          if (wrong) return 'tar 會把東西拆在你現在所在的資料夾。這一步要在 Project 裡拆：提示字元的路徑要是 `C:\\Users\\an\\Desktop\\Project`。';
          var noFile = api.termCmd(ev, function (c) { return canonOf(c) === 'tar' && c.status !== 0 && /Error opening archive/i.test(String(c.out || '')); });
          if (noFile) return 'tar 說打不開那個壓縮檔：檔名要和 `ls` 看到的一模一樣（week3.zip），而且要在 Project 裡。先 `ls` 看看。';
          // the package is not in Project any more (another mission carried it off, or it was renamed by a mv typo)
          if (!api.exists(PROJECT + '/week3.zip') && !api.exists(PROJECT + '/week3')) {
            var z = zipCopies(api, false)[0];
            if (z) return 'week3.zip 被改名成「' + z.name + '」了。在它所在的資料夾輸入 `mv ' + z.name + ' week3.zip` 改回名字，再把它放進 Project。';
            return '包裹 week3.zip 不在 Project 裡了（可能被別的任務搬走，或被刪掉）。按下面的「重來這個任務」，它會放回 Project。';
          }
          return null;
        }
      },
      {
        id: 's4',
        text: '把包裝紙 week3.zip 放到家門外：輸入 `mv week3.zip ..`',
        hint: 'mv 東西 地方。東西是 week3.zip；地方是往外一層，用兩個點 .. 表示，也就是中庭（Desktop）。',
        answer: '輸入：`mv week3.zip ..`（.. 就是往外一層，也就是 Desktop）',
        where: PROJECT,
        target: T_TERM,
        check: function (ev, api) {
          return !!(api.exists(DESKTOP + '/week3.zip') && !api.exists(PROJECT + '/week3.zip') && api.exists(PROJECT + '/week3/A.csv'));
        },
        trap: function (ev, api) {
          var uz = unzipTrap(ev, api);
          if (uz) return uz;
          if (!ev || ev.name !== 'term:run') return null;
          if (api.exists(DESKTOP + '/week3.zip') || api.exists(PROJECT + '/week3.zip')) return null;
          if (api.exists(HOME + '/week3.zip')) return 'week3.zip 被搬到 ~（社區）了，比 Desktop 再外面一層。`..` 只往外一層。輸入 `mv ~\\week3.zip ~\\Desktop` 把它放到 Desktop。';
          if (api.exists(DOWNLOADS + '/week3.zip')) return 'week3.zip 被搬回 Downloads 了。輸入 `mv ~\\Downloads\\week3.zip ~\\Desktop` 把它放到 Desktop。';
          return null;
        }
      },
      {
        id: 's5',
        text: '用檔案總管打開 Project 裡的 week3，點兩下 README.md，看看裡面寫什麼。',
        hint: 'README.md 會用「記事本」打開。（真正的 Windows 預設會把 .zip、.md 的副檔名藏起來，只顯示 week3；練習版把副檔名都顯示出來，所以你看得到 week3.zip。）',
        answer: '檔案總管 → 桌面 → Project → week3 → 點兩下 README.md。',
        // a student who opened README.md a moment before step 4 finished is still credited
        replay: 'mission',
        target: finderWalk([PROJECT + '/week3/README.md', PROJECT + '/week3', PROJECT]),
        check: function (ev, api) {
          return !!api.seen('editor:open', function (d) { return same(api, d.path, PROJECT + '/week3/README.md'); });
        }
      }
    ]),
    outro: 'tar 拆出來的東西，會放在你現在站的地方。cd 走路、ls 看一圈、mv 搬東西、tar 拆包裹：這就是用終端機整理檔案的基本功。真正的 Windows 在檔案總管對 zip 按右鍵，選「全部解壓縮」也行；這個任務為了練習終端機，才用指令。'
  });

  /* ------------------------------------------------------------------ 6 · mkdir 和 explorer */
  LAB.missions.register({
    id: 'w3-t5-mkdir',
    week: 3, order: 6,
    group: G_TERMINAL,
    title: 'mkdir 和 explorer',
    minutes: 3,
    tag: TAG,
    map: MAP,
    resetsFiles: true,
    needs: [PROJECT],
    intro: '影片 01「四個窗口看同一個資料夾」那一幕用到兩個指令：mkdir 新增資料夾，explorer 用檔案總管打開。',
    prepare: function (api) {
      ensureBase(api);
      api.remove(PROJECT + '/figures');
      api.remove(HOME + '/figures');       // a figures folder made in the wrong place on an earlier try
    },
    steps: withTermGeneric([
      openTerminalStep(),
      {
        id: 's2',
        text: '輸入 `cd ~\\Desktop\\Project` 走到家（Project），按 Enter，再輸入 `mkdir figures`，新增一個叫 figures 的資料夾。',
        hint: 'cd 後面接地址：~ 是社區，Desktop 是中庭，Project 是家，用 \\ 隔開。mkdir 後面接新資料夾的名字，而且要在家裡輸入。做好以後它會印出一張小表格；也可以用 ls 確認它出現了。',
        answer: '`cd ~\\Desktop\\Project`，Enter；`mkdir figures`，Enter；`ls`，Enter。',
        where: PROJECT,
        replay: 'mission',
        target: T_TERM,
        check: function (ev, api) {
          return !!(api.exists(PROJECT + '/figures') &&
            api.termSeen(function (c) { return canonOf(c) === 'mkdir' && c.status === 0; }));
        },
        trap: function (ev, api) {
          // mkdir figures succeeded, but somewhere other than Project (usually ~)
          var wrong = api.termCmd(ev, function (c) {
            return canonOf(c) === 'mkdir' && c.status === 0 && !same(api, c.cwd, PROJECT) && /\bfigures\b/i.test((c.args || []).join(' '));
          });
          if (!wrong || api.exists(PROJECT + '/figures')) return null;
          var where = same(api, wrong.cwd, HOME) ? '~' : LAB.vfs.basename(wrong.cwd);
          return 'figures 被建在「' + where + '」裡了，不是在 Project。先輸入 `rm figures` 刪掉它，再用 `cd ~\\Desktop\\Project` 走到 Project，重新 `mkdir figures`。';
        }
      },
      {
        id: 's3',
        text: '輸入 `explorer .`（explorer 空白 點），用檔案總管打開這個資料夾，確認 figures 在裡面。',
        hint: '那個點代表「這裡」；explorer 後面接地址，就會用檔案總管打開它。',
        answer: '在 Project 裡輸入：`explorer .`',
        where: PROJECT,
        replay: 'mission',
        target: T_TERM,
        check: function (ev, api) {
          return !!api.termSeen(function (c) {
            if (canonOf(c) !== 'open' || c.status !== 0) return false;
            var first = operands(c.args)[0];
            return !!first && same(api, argPath(c, first), PROJECT);
          });
        },
        trap: function (ev, api) {
          // `open .` is the Mac word: PowerShell does not know it (red error, canon unknown)
          var mac = api.termCmd(ev, function (c) { return String(c.name || '').toLowerCase() === 'open' && c.status !== 0; });
          return mac ? 'Windows 沒有 open 這個指令，要用 explorer：輸入 `explorer .`。' : null;
        }
      }
    ]),
    outro: '終端機和檔案總管看的是同一個資料夾：在終端機新增的東西，檔案總管馬上看得到。'
  });

  /* ------------------------------------------------------------------ 7 · 把資料夾交給 Codex */
  LAB.missions.register({
    id: 'w3-04-project',
    week: 3, order: 7,
    group: G_CODEX,
    title: '把資料夾交給 Codex',
    minutes: 5,
    resetsFiles: true,
    needs: [PROJECT],
    intro: 'Codex 以「一個資料夾」為工作單位。先把桌面上的 Project 資料夾交給它。',
    prepare: function (api) {
      // so the Trust prompt appears again and no stale Project chats survive
      ensureBase(api);
      dropProject(api);
    },
    steps: [
      {
        id: 's1',
        text: '點工作列上的「Codex」（滑鼠移過去會顯示名字；是 Codex，不是 Visual Studio Code）。',
        hint: 'Codex 的圖示是深色底，中間只有一個線條畫的輪廓；黑底、上面有 `>_` 的是終端機。',
        answer: '點一下工作列上的「Codex」。',
        target: dock('codex'),
        check: function (ev, api) {
          return !!(api.seen('win:open', function (d) { return d.appId === 'codex'; }) || api.win('codex').length > 0);
        }
      },
      {
        id: 's2',
        text: '把桌面上的 Project 資料夾，拖進 Codex 左邊的側邊欄。',
        hint: '按住 Project 圖示不放，拖到 Codex 左邊那一欄，看到側邊欄亮起藍框再放開。放開後桌面上的 Project 還在，這是正常的：只是告訴 Codex 它在哪裡。如果 Codex 蓋住了桌面圖示，先把視窗往右拖開一點，或從檔案總管視窗裡拖。',
        answer: 'Project 圖示 → 按住拖 → 放進 Codex 側邊欄。（也可以：檔案總管對 Project 按右鍵 → 開啟檔案 → Codex。）',
        target: chain(desktopIcon(PROJECT), fdItem(PROJECT)),
        check: function (ev, api) {
          return !!(
            api.seen('codex:trust-prompt', function (d) { return same(api, d.path, PROJECT); }) ||
            api.seen('dnd:drop', function (d) {
              return d.accepted && /^codex:/.test(String(d.targetId || '')) && d.payload &&
                (d.payload.paths || []).some(function (p) { return same(api, p, PROJECT); });
            }) ||
            hasProject(api, PROJECT)
          );
        }
      },
      {
        id: 's3',
        text: '看到「Trust this folder?」：這是在問你信不信任這個資料夾。按 Trust folder。',
        hint: 'Trust folder 是讓 Codex 可以在這個資料夾裡讀檔、改檔、執行指令。只信任你自己的資料夾。',
        answer: '點白色的 Trust folder。',
        target: '[data-lab=cx-modal-trust]',
        check: function (ev, api) {
          return !!(api.seen('codex:trust', function (d) { return same(api, d.path, PROJECT); }) || hasProject(api, PROJECT));
        },
        trap: function (ev, api) {
          // the prompt went away without an answer (Codex window closed): ask again
          if (!ev || hasProject(api, PROJECT)) return null;
          if (ev.name === 'codex:trust-prompt' || ev.name === 'dnd:drop') return null;
          try { if (api.codex && api.codex.pendingTrust && api.codex.pendingTrust()) return null; } catch (e) { return null; }
          if (!api.seen('codex:trust-prompt', function (d) { return same(api, d.path, PROJECT); })) return null;
          return '「Trust this folder?」的提示不見了。把桌面的 Project 再拖進 Codex 左邊的側邊欄一次，它就會再問。';
        }
      },
      {
        id: 's4',
        text: '到檔案總管看看它在電腦裡的真實位置：打開桌面的 Project，看視窗上方的網址列。',
        hint: '本機 › 本機磁碟 (C:) › 使用者 › an › 桌面 › Project 就是它真實的位置，也就是 `C:\\Users\\an\\Desktop\\Project`。',
        answer: '點兩下桌面上的 Project 資料夾。',
        target: chain(desktopIcon(PROJECT), fdItem(PROJECT), fdSide(DESKTOP), dock('finder')),
        check: function (ev, api) {
          return !!api.seen('finder:navigate', function (d) { return same(api, d.path, PROJECT); });
        }
      }
    ],
    outro: '記住：Codex 說的「專案」，就是電腦裡真的存在的那個資料夾。拖進去不是搬走，Project 還在桌面上。'
  });

  /* ------------------------------------------------------------------ 8 · 在專案裡請 Codex 做事 */
  LAB.missions.register({
    id: 'w3-05-in-project',
    week: 3, order: 8,
    group: G_CODEX,
    title: '在專案裡請 Codex 做事',
    minutes: 10,
    resetsFiles: true,
    needs: [PROJECT],
    intro: '在專案底下開對話，Codex 做出來的東西會放進這個資料夾。我們來驗證：它做的檔案，在其他視窗也看得到。',
    prepare: function (api) {
      ensureBase(api);
      ensureProject(api);
      api.remove(OUTPUT);
      api.remove(PROJECT + '/charts');
    },
    steps: [
      {
        id: 's1',
        text: '在 Codex 側邊欄點一下 Project，確認輸入框上方有「Project」這個標籤。',
        hint: '點 Project 這一列（不是最上面的 New chat）。Codex 還沒打開的話，先點工作列上的「Codex」。',
        answer: '點側邊欄的 Project。',
        target: chain(cxProject, dock('codex')),
        check: function (ev, api) {
          return !!api.seen('codex:select-project', function (d) { return same(api, d.path, PROJECT); });
        },
        trap: orphanReplyTrap('write_report')      // sent from New chat before this step was done
      },
      {
        id: 's2',
        text: '請 Codex 寫報告：點「複製」，貼進輸入框，再按 Enter。[[幫我寫一份報告到 output/report.md]]',
        hint: '點「複製」，再點 Codex 的輸入框，按 Ctrl+V 貼上。等它出現 Created output/report.md 就是做完了。',
        answer: '把「幫我寫一份報告到 output/report.md」貼到輸入框，按 Enter。',
        target: chain(cxComposer, cxProject, dock('codex')),
        check: function (ev, api) {
          return !!api.seen('codex:reply', function (d) { return d.intent === 'write_report' && same(api, d.projectPath, PROJECT); });
        },
        trap: orphanReplyTrap('write_report')
      },
      {
        id: 's3',
        text: '真實位置 = 專案資料夾 + output/report.md。到檔案總管找到它，看網址列是不是這樣。',
        hint: '先打開 Project，再往下找 output。網址列會寫 本機 › 本機磁碟 (C:) › 使用者 › an › 桌面 › Project › output。',
        answer: '檔案總管 → 桌面 → Project → output。',
        target: finderWalk([OUTPUT, PROJECT]),
        check: function (ev, api) {
          return !!api.seen('finder:navigate', function (d) { return same(api, d.path, OUTPUT); });
        }
      },
      {
        id: 's4',
        text: '點兩下 report.md，用記事本讀它。',
        hint: '裡面有各班的平均分數，是 Codex 讀了 data 裡的 CSV 算出來的。',
        answer: '在 output 資料夾裡點兩下 report.md。',
        target: finderWalk([REPORT, OUTPUT, PROJECT]),
        check: function (ev, api) {
          return !!api.seen('editor:open', function (d) { return same(api, d.path, REPORT); });
        }
      },
      {
        id: 's5',
        optional: true,
        text: '在終端機走到 Project，看看 output 裡有什麼。',
        hint: '先用地址走到 Project，再用 ls 看 output。想看檔案內容，可以試 `cat output\\report.md`。',
        answer: '`cd ~\\Desktop\\Project`，Enter；`ls output`，Enter。',
        target: T_TERM,
        check: function (ev, api) {
          return !!api.termSeen(function (c) {
            return canonOf(c) === 'ls' && c.status === 0 && same(api, lsDirOf(c), OUTPUT) && /report\.md/.test(String(c.out || ''));
          });
        },
        trap: termGeneric
      },
      {
        id: 's6',
        text: '用 Visual Studio Code（就是影片裡的 VS Code）打開 Project 資料夾。',
        hint: '資料夾可以拖到 VS Code 的視窗或工作列圖示上，也可以在檔案總管用右鍵的「開啟檔案」選 Visual Studio Code（不是 Codex）。',
        answer: '檔案總管對 Project 按右鍵 → 開啟檔案 → Visual Studio Code。（也可以在終端機的 Project 裡輸入 `code .`。）',
        replay: 'mission',
        target: chain(fdItem(PROJECT), desktopIcon(PROJECT), fdSide(DESKTOP), dock('finder')),
        check: function (ev, api) {
          return !!api.seen('code:folder', function (d) { return same(api, d.path, PROJECT); });
        }
      },
      {
        id: 's7',
        text: '在 VS Code 左邊的檔案列表點開 output，再點 report.md。',
        hint: '左邊那一欄叫 EXPLORER，像檔案總管的導覽窗格。',
        answer: 'EXPLORER → output → report.md。',
        target: chain(cdRow(REPORT), cdRow(OUTPUT), dock('code')),
        check: function (ev, api) {
          return !!api.seen('editor:open', function (d) { return d.appId === 'code' && same(api, d.path, REPORT); });
        }
      },
      {
        id: 's8',
        optional: true,
        text: '在終端機的 Project 裡新增一個叫 charts 的資料夾，同時看 VS Code 左邊和檔案總管：它會自己出現。',
        hint: 'mkdir 後面接資料夾名字。檔案總管和 VS Code 都不用重新整理。',
        answer: '在 Project 裡輸入：`mkdir charts`',
        where: PROJECT,
        replay: 'mission',
        target: T_TERM,
        check: function (ev, api) {
          return !!(api.exists(PROJECT + '/charts') &&
            api.termSeen(function (c) { return canonOf(c) === 'mkdir' && c.status === 0; }));
        },
        trap: termGeneric
      }
    ],
    outro: 'Codex、檔案總管、終端機、VS Code，四個視窗看的是同一個資料夾；檔案不在聊天室裡，而是真的存在硬碟上。「output/report.md」是相對路徑，從對話所在的資料夾算起。'
  });

  /* ------------------------------------------------------------------ 9 · New chat 的陷阱 */
  LAB.missions.register({
    id: 'w3-06-orphan',
    week: 3, order: 9,
    group: G_CODEX,
    title: 'New chat 的陷阱',
    minutes: 8,
    resetsFiles: true,
    needs: [PROJECT],
    intro: '按最上面的 New chat 開出來的對話，不屬於任何專案。同一句話，檔案會放到哪裡？',
    prepare: function (api) {
      ensureBase(api);
      ensureProject(api);
      api.remove(DOCUMENTS + '/output');
      api.remove(OUTPUT);   // so the earlier Project mission's file cannot blur the contrast in step 5
    },
    steps: [
      {
        id: 's1',
        text: '按 Codex 最上面的 New chat。注意：輸入框上方沒有 Project 標籤。',
        hint: '主畫面只問 What should we work on?，沒有專案名稱。Codex 還沒打開的話，先點工作列上的「Codex」。',
        answer: '點側邊欄最上面的 New chat。',
        target: chain(cxNew, dock('codex')),
        check: function (ev, api) {
          return !!api.seen('codex:new-chat', function (d) { return isNullish(d.projectPath); });
        }
      },
      {
        id: 's2',
        text: '輸入同一句話：點「複製」，貼進輸入框，再按 Enter。[[幫我寫一份報告到 output/report.md]]',
        hint: '整句照打（或複製貼上），和上一個任務一模一樣。等它做完，側邊欄的 Recents 會出現這個對話：它不在 Project 底下。',
        answer: '輸入「幫我寫一份報告到 output/report.md」，按 Enter。',
        target: chain(cxComposer, cxNew, dock('codex')),
        check: function (ev, api) {
          return !!api.seen('codex:reply', function (d) { return d.intent === 'write_report' && isNullish(d.projectPath); });
        }
      },
      {
        id: 's3',
        text: '它說「已建立 output/report.md」，可是在哪？點「複製」，貼進輸入框，問它：[[列出你新增的檔案完整路徑]]',
        hint: '在同一個對話裡接著問。可以複製上面這句。',
        answer: '輸入「列出你新增的檔案完整路徑」，按 Enter。',
        target: chain(cxComposer, dock('codex')),
        check: function (ev, api) {
          return !!api.seen('codex:reply', function (d) { return d.intent === 'list_paths' && isNullish(d.projectPath); });
        }
      },
      {
        id: 's4',
        text: '照它給的路徑，在檔案總管找到這個檔案。',
        hint: '路徑裡的 Documents，在檔案總管叫「文件」；一層一層往下找 output。',
        answer: '路徑是 `C:\\Users\\an\\Documents\\output\\report.md`：檔案總管 → ' + PANE + '「文件」→ output。',
        target: finderWalk([DOCUMENTS + '/output'], DOCUMENTS),
        check: function (ev, api) {
          return !!api.seen('finder:navigate', function (d) { return same(api, d.path, DOCUMENTS + '/output'); });
        }
      },
      {
        id: 's5',
        text: '改在專案底下重做：點側邊欄的 Project，再把同一句話貼進輸入框（複製過的話，直接貼）。',
        hint: '這次輸入框上方會有 Project 標籤，檔案會寫進 Project 底下的 output。',
        answer: '點 Project → 輸入「幫我寫一份報告到 output/report.md」→ Enter。',
        target: T_PROJECT_CHAT,
        check: function (ev, api) {
          return !!api.seen('codex:reply', function (d) { return d.intent === 'write_report' && same(api, d.projectPath, PROJECT); });
        }
      },
      {
        id: 's6',
        text: '到檔案總管打開 Project 裡的 output，看到 report.md：這次它在專案裡。',
        hint: '檔案總管 → 桌面 → Project → output。',
        answer: '點兩下桌面的 Project，再點兩下 output。',
        target: finderWalk([OUTPUT, PROJECT]),
        check: function (ev, api) {
          return !!api.seen('finder:navigate', function (d) { return same(api, d.path, OUTPUT); });
        }
      }
    ],
    outro: 'New chat 開出來的對話不屬於任何專案，它做出來的檔案會放在你沒指定的地方（這次是「文件」，下次可能是別處）。要做正事，先點專案，再開始對話；也一定要知道檔案放在哪裡。'
  });

  /* ------------------------------------------------------------------ 10 · AGENTS.md */
  LAB.missions.register({
    id: 'w3-07-agents',
    week: 3, order: 10,
    group: G_CODEX,
    title: 'AGENTS.md：給專案的長期記憶',
    minutes: 8,
    resetsFiles: true,
    needs: [PROJECT],
    intro: '每個專案資料夾都該有一份 AGENTS.md，Codex 每次對話都會先讀它。我們來改它，看看新對話是不是真的記得。',
    prepare: function (api) {
      api.ensureSeed(DESKTOP);
      api.ensureSeed(PROJECT);
      api.ensureSeed(PROJECT + '/data');
      ensureProject(api);
      // the seed text of M§4.0 comes back when the file is missing or already carries the figures rule
      var text = api.read(AGENTS);
      if (text === null || text.indexOf('figures/') >= 0) api.ensureSeed(AGENTS, { overwrite: true });
    },
    steps: [
      {
        id: 's1',
        text: '用記事本或 Visual Studio Code 打開 Project 裡的 AGENTS.md，看它現在有哪些規則。',
        hint: '在檔案總管的 Project 裡，點兩下 AGENTS.md。',
        answer: '檔案總管 → 桌面 → Project → 點兩下 AGENTS.md。',
        target: finderWalk([AGENTS, PROJECT]),
        check: function (ev, api) {
          return !!api.seen('editor:open', function (d) { return same(api, d.path, AGENTS); });
        },
        trap: orphanReplyTrap('write_agents')
      },
      {
        id: 's2',
        text: '在 Codex 點 Project 那一列，開新對話，點「複製」，貼進輸入框，再按 Enter。[[把「圖表存到 figures/」加進 AGENTS.md]]',
        hint: '要用專案底下的對話（輸入框上方有 Project 標籤），不是 New chat。Codex 還沒打開的話，先點工作列上的「Codex」。',
        answer: '點 Project 那一列，輸入整句，按 Enter。',
        replay: 'mission',
        target: T_PROJECT_CHAT,
        trap: orphanReplyTrap('write_agents'),
        check: function (ev, api) {
          var hit = api.seen('codex:reply', function (d) { return d.intent === 'write_agents' && same(api, d.projectPath, PROJECT); });
          if (!hit) return false;
          var text = api.read(AGENTS);
          return !!(text && text.indexOf('figures/') >= 0);
        },
        onDone: function (api) {
          var hit = api.seen('codex:reply', function (d) { return d.intent === 'write_agents' && same(api, d.projectPath, PROJECT); }, { since: 'mission' });
          if (hit) api.state.agentsChat = hit.chatId;
        }
      },
      {
        id: 's3',
        text: '回到 AGENTS.md 的視窗，看它是不是多了一行「- 圖表存到 figures/」。',
        hint: '視窗被 Codex 蓋住了：點工作列的「記事本」，或把 Codex 視窗拖開。記事本會自己更新，不用重開。',
        answer: '點工作列的「記事本」（或在檔案總管再點兩下 AGENTS.md），最後一行是「- 圖表存到 figures/」。',
        target: dock('textedit'),
        check: function (ev, api) {
          // only events after step 2: re-opening, or bringing the already-open window to the front
          return !!(
            api.seen('editor:open', function (d) { return same(api, d.path, AGENTS); }) ||
            api.seen('win:focus', function (d) {
              return (d.appId === 'textedit' || d.appId === 'code') && winHasPath(api, d.id, AGENTS);
            })
          );
        }
      },
      {
        id: 's4',
        text: '在 Project 底下再開一個全新的對話，點「複製」，貼進輸入框，問：[[你目前遵守哪些規則？]]',
        hint: '把滑鼠移到 Project 那一列，右邊會出現「+」；一定要開新對話，不要接著剛剛那個。新對話的短期記憶是空的，但 AGENTS.md 每次都會帶入。',
        answer: '點 Project 那一列右邊的 +，輸入「你目前遵守哪些規則？」，Enter。',
        replay: 'mission',
        target: chain(cxPlus, cxProject, dock('codex')),
        check: function (ev, api) {
          return !!api.seen('codex:reply', function (d) {
            return d.intent === 'ask_rules' && same(api, d.projectPath, PROJECT) && d.chatId !== api.state.agentsChat;
          });
        },
        trap: function (ev, api) {
          if (!ev || ev.name !== 'codex:reply' || !ev.data) return null;
          var d = ev.data;
          if (d.intent === 'ask_rules' && api.state.agentsChat !== undefined && d.chatId === api.state.agentsChat) return '這是同一個對話。請開一個新的。';
          // asked from New chat: that is the comparison of the NEXT step; this one needs a chat under Project
          if (d.intent === 'ask_rules' && isNullish(d.projectPath)) return '這個對話不在 Project 底下。這一步先在 Project 底下開新對話（Project 那一列右邊的 +）；New chat 的對照在下一步。';
          return null;
        }
      },
      {
        id: 's5',
        text: '對照看看：按 New chat（沒有專案），問同一句話。',
        hint: '這個對話看不到專案裡的 AGENTS.md。',
        answer: '點最上面的 New chat，輸入「你目前遵守哪些規則？」，Enter。',
        target: chain(cxNew, dock('codex')),
        check: function (ev, api) {
          return !!api.seen('codex:reply', function (d) { return d.intent === 'ask_rules' && isNullish(d.projectPath); });
        }
      }
    ],
    outro: '重要的事寫進 AGENTS.md，專案裡的每個新對話都會讀到；不在專案裡的對話看不到專案的檔案，也看不到 AGENTS.md。完整的 AGENTS.md 通常有三個段落：這個專案在做什麼、希望 AI 怎麼幫忙、有哪些事情不要做（影片 02 示範過）；練習版的只有一段，你可以自己把它補完整。'
  });
})(window.LAB);
