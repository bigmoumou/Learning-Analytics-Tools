/* missions-week3.js — Week 3 mission data and free-play tips (DESIGN §5.3). MISSIONS-WEEK3 owner.
   Data only: it calls LAB.missions.register and uses the public mission api (§5.1) and the event
   catalogue (§3.3). Every string the student reads is Traditional Chinese (Taiwan usage). */
(function (LAB) {
  'use strict';

  var HOME = '/Users/an';
  var DESKTOP = '/Users/an/Desktop';
  var DOWNLOADS = '/Users/an/Downloads';
  var DOCUMENTS = '/Users/an/Documents';
  var PROJECT = '/Users/an/Desktop/Project';
  var AGENTS = PROJECT + '/AGENTS.md';
  var REPORT = PROJECT + '/output/report.md';

  var MAP = '~ 社區（/Users/an）· Downloads 管理室 · Desktop 中庭 · Desktop/Project 家 · .. 往外一層';

  /* ------------------------------------------------------------------ helpers */
  function isFlag(a) { return typeof a === 'string' && a.length > 1 && a.charAt(0) === '-'; }
  function operands(args) {
    var out = [];
    (args || []).forEach(function (a) { if (!isFlag(a)) out.push(a); });
    return out;
  }
  function same(api, a, b) { try { return !!api.same(a, b); } catch (e) { return false; } }
  function isNullish(v) { return v === null || v === undefined; }

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

  /* Zip-kind files that sit directly in Desktop or Project under any name (the "typo trap": mv to a
     destination that does not exist renames the zip instead of moving it). */
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

  /* every mission starts from a Mac that has the Desktop, Project (with data and AGENTS.md); a Project that was trashed,
     renamed away or rm -rf'ed in free play comes back (resetsFiles: 「重來這個任務」 does the same) */
  function ensureBase(api) {
    api.ensureSeed(DESKTOP);
    api.ensureSeed(PROJECT);
    api.ensureSeed(PROJECT + '/data');
    api.ensureSeed(AGENTS);
  }
  /* the second `unzip week3.zip` stops at the "replace …? [y]es, [n]o, [A]ll …" question and swallows whatever is typed next */
  function overwritePromptTrap(ev) {
    if (ev && ev.name === 'term:prompt' && /\[y\]es/.test(String((ev.data || {}).text || ''))) {
      return '它在問要不要覆蓋已經存在的檔案：輸入 `A` 再按 Return（全部覆蓋），或按 Ctrl+C 取消。回答完就可以繼續，不用再拆一次。';
    }
    return null;
  }
  /* a Codex reply that was written outside the Project: the one trap behind M5 s2, M7 s2 and M7 s4 */
  var NOT_IN_PROJECT = '這個對話不在 Project 底下（輸入框上方沒有「Project」標籤），所以檔案沒有放進專案。點 Codex 左邊的 Project，在專案底下再試一次。';
  function orphanReplyTrap(intentId) {
    return function (ev, api) {
      if (!ev || ev.name !== 'codex:reply' || !ev.data) return null;
      var d = ev.data;
      if (d.intent === intentId && isNullish(d.projectPath)) return NOT_IN_PROJECT;
      return null;
    };
  }

  /* ------------------------------------------------------------------ M1 */
  LAB.missions.register({
    id: 'w3-01-desktop',
    week: 3, order: 1,
    title: '認識桌面與 Finder',
    minutes: 6,
    resetsFiles: true,
    needs: [PROJECT],
    intro: '這是一台練習用的 Mac。先認識最常用的兩個地方：桌面，和用來看檔案的 Finder。',
    prepare: function (api) {
      ensureBase(api);
      api.remove(DESKTOP + '/練習');
    },
    steps: [
      {
        id: 's1',
        text: '點 Dock 最左邊的 Finder，打開一個視窗。',
        hint: '螢幕最下面那一排叫 Dock，第一個圖示就是 Finder。',
        answer: '點一下 Dock 上的 Finder。',
        check: function (ev, api) {
          return !!(api.seen('win:open', function (d) { return d.appId === 'finder'; }) || api.win('finder').length > 0);
        }
      },
      {
        id: 's2',
        text: '在 Finder 左邊的側邊欄點「桌面」。',
        hint: '側邊欄在視窗左邊，找到寫著「桌面」的那一列。',
        answer: '點側邊欄的「桌面」。',
        check: function (ev, api) {
          return !!(api.seen('finder:navigate', function (d) { return same(api, d.path, DESKTOP); }) || api.finderAt(DESKTOP));
        }
      },
      {
        id: 's3',
        text: '在桌面上點兩下 Project 資料夾，打開它。',
        hint: '要連續點兩下，點一下只是選取。桌面的 Project 圖示在螢幕右上角，也可以在 Finder 視窗裡點兩下。',
        answer: '點兩下 Project。',
        check: function (ev, api) {
          return !!(api.seen('finder:navigate', function (d) { return same(api, d.path, PROJECT); }) || api.finderAt(PROJECT));
        }
      },
      {
        id: 's4',
        text: '看視窗最下面的路徑列，再點其中的「桌面」，回到上一層。',
        hint: '路徑列從左到右，就是這個資料夾的完整位置：Macintosh HD › 使用者 › an › 桌面 › Project，也就是 /Users/an/Desktop/Project。',
        answer: '點路徑列的「桌面」（或側邊欄的「桌面」，或左上角的返回鍵）。',
        check: function (ev, api) {
          // any natural way back to the Desktop counts (pathbar, sidebar, back, up, go-to…)
          if (api.seen('finder:navigate', function (d) { return same(api, d.path, DESKTOP); })) return true;
          // state fallback: a Finder window shows the Desktop and none is still inside Project.
          // (A second window left on the Desktop from step 2 must not finish this step by itself.)
          return api.finderAt(DESKTOP) && !api.finderAt(PROJECT);
        }
      },
      {
        id: 's5',
        text: '在桌面空白處按右鍵，選「新增檔案夾」（macOS 選單裡資料夾叫「檔案夾」），命名為「練習」，按 Return（Windows 鍵盤是 Enter）。',
        hint: '如果找不到空白處，先把 Finder 視窗拖開或最小化。筆電觸控板：用兩指點一下就是右鍵。新增後名字會變成可以直接輸入的狀態；要先把輸入法切到中文，才打得出「練習」。',
        answer: '右鍵 → 新增檔案夾 → 輸入 練習 → Return。',
        check: function (ev, api) {
          return !!(api.exists(DESKTOP + '/練習') && api.vfs.isDir(DESKTOP + '/練習'));
        },
        trap: function (ev, api) {
          // a new folder on the Desktop with another name (「練習 」, 「practice」, 「练习」 …)
          if (!ev || api.exists(DESKTOP + '/練習')) return null;
          var list = [];
          try { list = api.vfs.list(DESKTOP); } catch (e) { list = []; }
          var odd = null;
          list.forEach(function (s) {
            if (s.type !== 'dir' || s.name === 'Project') return;
            if (/^未命名檔案夾/.test(s.name) && ev.name === 'fs:change') return;      // still being named
            if (!odd) odd = s.name;
          });
          if (!odd) return null;
          return '桌面上多了一個叫「' + odd + '」的資料夾，名字要剛好是「練習」（兩個中文字，沒有空格）。點它一下，按 Return 改名；輸入法要先切到中文。';
        }
      },
      {
        id: 's6',
        text: '在 Finder 的桌面裡找到「練習」，點它一下：它和桌面上的圖示是同一個東西。',
        hint: 'Finder 視窗要停在「桌面」；如果不在，點側邊欄的「桌面」。',
        answer: 'Finder → 側邊欄「桌面」→ 點「練習」。',
        check: function (ev, api) {
          return !!api.seen('finder:select', function (d) {
            return (d.paths || []).some(function (p) { return same(api, p, DESKTOP + '/練習'); });
          });
        }
      }
    ],
    outro: '做得好。桌面上的東西，其實都是 /Users/an/Desktop 這個資料夾裡的檔案。'
  });

  /* ------------------------------------------------------------------ M2 */
  LAB.missions.register({
    id: 'w3-02-terminal',
    week: 3, order: 2,
    title: '用終端機走路',
    minutes: 12,
    tag: '補充教材',
    map: MAP,
    resetsFiles: true,
    needs: [PROJECT],
    intro: '終端機是用打字叫電腦做事的視窗。這一關練習五個指令：pwd、ls、cd、mkdir、open。影片把電腦比喻成社區：~ 是社區，Desktop 是中庭，Project 是家。不確定時，展開下面的「地圖」。',
    prepare: function (api) {
      ensureBase(api);
      api.remove(PROJECT + '/figures');
      api.remove(HOME + '/figures');       // a figures folder made in the wrong place on an earlier try
    },
    steps: [
      {
        id: 's1',
        text: '點 Dock 上的「終端機」（滑鼠移過去會顯示名字）。也可以點右上角選單列的放大鏡，輸入 `terminal`，按 Return（Windows 鍵盤是 Enter）。',
        hint: '終端機的圖示是黑底，左下角有 `>_`。打指令前，輸入法先切到英文（ABC）。Command＋空白鍵可能被真正的電腦拿去用，Windows 鍵盤的 Ctrl＋空白鍵也常是切換輸入法，所以請用點的。',
        answer: '點一下 Dock 上的「終端機」。',
        check: function (ev, api) {
          return !!(api.seen('win:open', function (d) { return d.appId === 'terminal'; }) || api.win('terminal').length > 0);
        }
      },
      {
        id: 's2',
        text: '輸入 `ls`，按 Return：看看這裡有什麼。',
        hint: 'ls 是「看一圈」。打完要按 Return 才會執行。',
        answer: '輸入：`ls`',
        replay: 'mission',
        check: function (ev, api) {
          return !!api.termSeen(function (c) { return c.name === 'ls' && c.status === 0; });
        }
      },
      {
        id: 's3',
        text: '輸入 `cd Desktop`，再輸入 `pwd`。注意提示字元最後面的字變成什麼？',
        hint: 'cd 是走路，後面接要去的資料夾名字；pwd 會印出你現在的完整位置。你在哪裡，提示字元的最後一個字會告訴你。',
        answer: '`cd Desktop`，Return；`pwd`，Return。提示字元從 ~ 變成 Desktop，pwd 印出 /Users/an/Desktop。',
        where: HOME,
        replay: 'mission',
        check: function (ev, api) {
          return !!api.termSeen(function (c) { return c.name === 'pwd' && c.status === 0 && same(api, c.cwd, DESKTOP); });
        },
        trap: function (ev, api) {
          // `cd Desktop` typed while the Terminal is not in ~ (it was left in Project, say)
          var bad = api.termCmd(ev, function (c) { return c.name === 'cd' && c.status !== 0 && !same(api, c.cwd, HOME); });
          if (!bad) return null;
          return '你現在不在 ~（社區）：提示字元最後一個字不是 ~。先輸入 `cd ~` 回到社區，再輸入 `cd Desktop`。';
        }
      },
      {
        id: 's4',
        text: '走進 Project，用 ls 看看裡面有什麼。',
        hint: 'cd 後面接資料夾名字，ls 看一圈。Project 裡會看到 AGENTS.md、data 和 筆記.docx。',
        answer: '`cd Project`，Return；`ls`，Return。',
        where: DESKTOP,
        replay: 'mission',
        check: function (ev, api) {
          return !!api.termSeen(function (c) { return c.name === 'ls' && c.status === 0 && same(api, api.lsDir(c), PROJECT); });
        }
      },
      {
        id: 's5',
        text: '用 `cd ..` 回到上一層，看看提示字元變成什麼。',
        hint: '兩個點 .. 代表「往外一層」。從 Project 往外一層，就回到 Desktop。',
        answer: '輸入：`cd ..`',
        where: PROJECT,
        replay: 'mission',
        check: function (ev, api) {
          return !!api.termSeen(function (c) {
            return c.name === 'cd' && /^\.\.\/?$/.test(String((c.args || [])[0])) && same(api, c.cwdAfter, DESKTOP);
          });
        }
      },
      {
        id: 's6',
        text: '用 `cd ~` 一步回到「社區」，不管你現在在哪裡都可以。',
        hint: '~ 代表你的「社區」，也就是 /Users/an（正式名稱是家目錄）。回到社區後，提示字元會變成 ~。',
        answer: '輸入：`cd ~`',
        replay: 'mission',
        check: function (ev, api) {
          return !!api.termSeen(function (c) { return c.name === 'cd' && same(api, c.cwdAfter, HOME); });
        }
      },
      {
        id: 's7',
        text: '走到 Project，輸入 `mkdir figures`，新增一個叫 figures 的資料夾。',
        hint: 'mkdir 後面接新資料夾的名字，而且要在 Project 裡輸入：先用 cd 加上地址走到 Project（~ 是社區，Desktop 是中庭，Project 是家），打完用 ls 確認它出現了。',
        answer: '`cd ~/Desktop/Project`，Return；`mkdir figures`，Return；`ls`，Return。',
        where: PROJECT,
        replay: 'mission',
        check: function (ev, api) {
          return !!(api.exists(PROJECT + '/figures') &&
            api.termSeen(function (c) { return c.name === 'mkdir' && c.status === 0; }));
        },
        trap: function (ev, api) {
          // mkdir figures succeeded, but somewhere other than Project (usually ~, right after step 6)
          var wrong = api.termCmd(ev, function (c) {
            return c.name === 'mkdir' && c.status === 0 && !same(api, c.cwd, PROJECT) && operands(c.args).indexOf('figures') >= 0;
          });
          if (!wrong || api.exists(PROJECT + '/figures')) return null;
          var where = same(api, wrong.cwd, HOME) ? '~' : LAB.vfs.basename(wrong.cwd);
          return 'figures 被建在「' + where + '」裡了，不是在 Project。先輸入 `rmdir figures` 刪掉它，再用 `cd ~/Desktop/Project` 走到 Project，重新 `mkdir figures`。';
        }
      },
      {
        id: 's8',
        text: '輸入 `open .`（open 空白 點），用 Finder 打開這個資料夾，確認 figures 在裡面。',
        hint: '那個點代表「這裡」；open 後面接地址，就會用 Finder 打開它。',
        answer: '在 Project 裡輸入：`open .`',
        where: PROJECT,
        replay: 'mission',
        check: function (ev, api) {
          return !!api.termSeen(function (c) {
            if (c.name !== 'open' || c.status !== 0) return false;
            if ((c.args || []).indexOf('-a') >= 0 || (c.args || []).indexOf('-R') >= 0) return false;
            var first = operands(c.args)[0];
            return !!first && same(api, api.resolve(c.cwd, first), PROJECT);
          });
        }
      }
    ],
    outro: '終端機和 Finder 看的是同一個資料夾：你在終端機新增的東西，Finder 馬上就看得到。影片 01 的「一個資料夾，四個視窗」也會用到 mkdir 和 open。'
  });

  /* ------------------------------------------------------------------ M3 */
  LAB.missions.register({
    id: 'w3-03-unzip',
    week: 3, order: 3,
    title: '拆包裹：week3.zip',
    minutes: 12,
    tag: '補充教材',
    map: MAP,
    resetsFiles: true,
    needs: [PROJECT],
    intro: '老師給你一個壓縮檔 week3.zip，在「下載項目」（終端機裡叫 Downloads）。把它搬進 Project，拆開，再把包裝紙收到桌面。不確定路怎麼走時，展開下面的「地圖」。',
    prepare: function (api) {
      ensureBase(api);
      api.remove(DOWNLOADS + '/week3');    // what a double-click in Finder leaves behind
      api.remove(PROJECT + '/week3');
      api.remove(PROJECT + '/week3.zip');
      api.remove(DESKTOP + '/week3.zip');
      // a renamed copy of the zip left by the "typo trap" (mv to a destination that did not exist), in Downloads, Desktop or Project
      var seedNode = null;
      try { seedNode = LAB.seed.nodeAt(DOWNLOADS + '/week3.zip'); } catch (e) { seedNode = null; }
      var seedSize = seedNode && typeof seedNode.s === 'number' ? seedNode.s : 1301;
      zipCopies(api, true).forEach(function (z) {
        if (z.size === seedSize) api.remove(z.path);
      });
      api.ensureSeed(DOWNLOADS + '/week3.zip', { overwrite: true });
    },
    steps: [
      {
        id: 's1',
        text: '先確認你在社區：看提示字元是 ~。不在的話，輸入 `cd ~`。',
        hint: '提示字元最後一個字是 ~，就代表你在社區。如果你剛才停在 Project，提示字元會寫 Project；打指令前先看一下提示字元。',
        answer: '輸入：`cd ~`（提示字元已經是 ~ 的話，直接做下一步也可以）。',
        where: HOME,
        replay: 'mission',
        check: function (ev, api) {
          // `cd ~`, or an immediate `cd Downloads` from ~ (the student saw the ~ prompt and went on)
          return !!api.termSeen(function (c) {
            return c.name === 'cd' && (same(api, c.cwdAfter, HOME) || same(api, c.cwdAfter, DOWNLOADS));
          });
        }
      },
      {
        id: 's2',
        text: '走進 Downloads，看看裡面有什麼。',
        hint: 'cd 後面接資料夾名字，ls 看一圈。下載項目在終端機裡叫 Downloads。',
        answer: '`cd Downloads`，Return；`ls`，Return。',
        where: HOME,
        replay: 'mission',
        check: function (ev, api) {
          return !!api.termSeen(function (c) { return c.name === 'ls' && c.status === 0 && same(api, api.lsDir(c), DOWNLOADS); });
        }
      },
      {
        id: 's3',
        text: '把 week3.zip 搬進 Project：`mv week3.zip ~/Desktop/Project`',
        hint: 'mv 東西 地方。week3.zip 是要搬的東西；地方是一串地址：~ 是社區，Desktop 是中庭，Project 是家，用 / 隔開。沒有印出任何字，就是成功了。',
        answer: '輸入：`mv week3.zip ~/Desktop/Project`',
        where: DOWNLOADS,
        check: function (ev, api) {
          // a student who ran ahead (moved it, unzipped it, tidied up) must not get stuck here
          return !!((api.exists(PROJECT + '/week3.zip') || api.exists(PROJECT + '/week3')) && !api.exists(DOWNLOADS + '/week3.zip'));
        },
        trap: function (ev, api) {
          if (api.exists(DOWNLOADS + '/week3.zip') || api.exists(PROJECT + '/week3.zip')) return null;
          var copies = zipCopies(api, false);
          if (!copies.length) {
            if (api.exists(PROJECT + '/week3') || api.exists(DESKTOP + '/week3.zip') || api.exists(HOME + '/week3.zip')) return null;
            return '找不到 week3.zip 了（可能被 rm 刪掉，或丟進垃圾桶）。按下面的「重來這個任務」，它會放回 Downloads。';
          }
          var z = copies[0];
          return 'week3.zip 被改名成「' + z.name + '」了：mv 的目的地不存在時，會直接把東西改名。' +
            '看看' + (z.dir === DESKTOP ? '桌面' : z.dir === DOWNLOADS ? '下載項目' : z.dir === HOME ? '你的家目錄（~）' : 'Project') + '，多了一個叫「' + z.name + '」的壓縮檔。' +
            '在 ' + (z.dir === DESKTOP ? 'Desktop' : z.dir === DOWNLOADS ? 'Downloads' : z.dir === HOME ? '~' : 'Project') + ' 輸入 `mv ' + z.name + ' week3.zip` 改回名字，再輸入 `mv week3.zip ~/Desktop/Project`，把它搬進 Project。';
        }
      },
      {
        id: 's4',
        text: '再 ls 一次看 Downloads：week3.zip 還在嗎？',
        hint: 'mv 是搬走，不是複製。',
        answer: '在 Downloads 輸入：`ls`（或在別處輸入 `ls ~/Downloads`）。syllabus.pdf 還在，week3.zip 不見了。',
        where: DOWNLOADS,
        replay: 'mission',
        check: function (ev, api) {
          return !!api.termSeen(function (c) {
            return c.name === 'ls' && c.status === 0 && same(api, api.lsDir(c), DOWNLOADS) && !/week3\.zip/.test(String(c.out || ''));
          });
        }
      },
      {
        id: 's5',
        text: '用一整串地址走到 Project，再 ls 確認包裹到了。',
        hint: 'cd 後面接地址：~ 是社區，Desktop 是中庭，Project 是家，用 / 隔開。ls 會看到 week3.zip（還有 Project 原本的東西）。',
        answer: '`cd ~/Desktop/Project`，Return；`ls`，Return。',
        where: DOWNLOADS,
        replay: 'mission',
        check: function (ev, api) {
          return !!api.termSeen(function (c) {
            // week3.zip, or (a student who ran ahead, unzipped and tidied up already) the week3 folder it left behind
            return c.name === 'ls' && c.status === 0 && same(api, api.lsDir(c), PROJECT) && /week3/.test(String(c.out || ''));
          });
        },
        trap: overwritePromptTrap
      },
      {
        id: 's6',
        text: '拆包裹：輸入 `unzip week3.zip`，再 `ls` 看看多了什麼。',
        hint: 'unzip 後面接要拆的檔案。它會把東西拆在現在這個資料夾，多出一個叫 week3 的資料夾。',
        answer: '`unzip week3.zip`，Return；`ls`，Return。',
        where: PROJECT,
        replay: 'mission',
        check: function (ev, api) {
          // ls pads names with spaces, so the standalone word `week3` only appears after the unzip
          // (`week3.zip` alone does not match).
          return !!(api.exists(PROJECT + '/week3/README.md') &&
            api.termSeen(function (c) {
              return c.name === 'ls' && c.status === 0 && same(api, api.lsDir(c), PROJECT) && /(^|\s)week3(\s|$)/.test(String(c.out || ''));
            }));
        },
        trap: function (ev, api) {
          if (!ev) return null;
          var pt = overwritePromptTrap(ev);
          if (pt) return pt;
          if (ev.name !== 'term:run') return null;
          var wrong = api.termCmd(ev, function (c) { return c.name === 'unzip' && c.status === 0 && !same(api, c.cwd, PROJECT); });
          if (wrong) return 'unzip 會把東西拆在你現在所在的資料夾。這一步要在 Project 裡拆：提示字元最後一個字要是 Project。';
          return null;
        }
      },
      {
        id: 's7',
        text: '把包裝紙 week3.zip 放到家門外。',
        hint: 'mv 東西 地方；家門外是往外一層，怎麼寫？',
        answer: '輸入：`mv week3.zip ..`（.. 就是往外一層，也就是 Desktop）',
        where: PROJECT,
        check: function (ev, api) {
          return !!(api.exists(DESKTOP + '/week3.zip') && !api.exists(PROJECT + '/week3.zip') && api.exists(PROJECT + '/week3/A.csv'));
        },
        trap: function (ev, api) {
          var pt = overwritePromptTrap(ev);
          if (pt) return pt;
          if (!ev || ev.name !== 'term:run') return null;
          if (api.exists(DESKTOP + '/week3.zip') || api.exists(PROJECT + '/week3.zip')) return null;
          if (api.exists(HOME + '/week3.zip')) return 'week3.zip 被搬到 ~（社區）了，比 Desktop 再外面一層。`..` 只往外一層。輸入 `mv ~/week3.zip ~/Desktop` 把它放到 Desktop。';
          if (api.exists(DOWNLOADS + '/week3.zip')) return 'week3.zip 被搬回 Downloads 了。輸入 `mv ~/Downloads/week3.zip ~/Desktop` 把它放到 Desktop。';
          return null;
        }
      },
      {
        id: 's8',
        text: '用 Finder 打開 Project 裡的 week3，點兩下 README.md，看看裡面寫什麼。',
        hint: 'README.md 會用「文字編輯」打開。（真正的 Mac 預設會把 .zip 藏起來，只顯示 week3；練習版把副檔名都顯示出來，所以你看得到 week3.zip。）',
        answer: 'Finder → 桌面 → Project → week3 → 點兩下 README.md。',
        // a student who opened README.md a moment before step 7 finished is still credited
        replay: 'mission',
        check: function (ev, api) {
          return !!api.seen('editor:open', function (d) { return same(api, d.path, PROJECT + '/week3/README.md'); });
        },
        trap: overwritePromptTrap
      }
    ],
    outro: 'cd 是走路、ls 是看一圈、mv 是搬東西、unzip 是拆包裹。記得：mv 是搬走，不是複製。這就是用終端機整理檔案的基本功。在 Finder 對 zip 點兩下也能解壓縮；這一關為了練習終端機，才用指令。'
  });

  /* ------------------------------------------------------------------ M4 */
  LAB.missions.register({
    id: 'w3-04-project',
    week: 3, order: 4,
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
        text: '點 Dock 上的「Codex」（滑鼠移過去會顯示名字；是 Codex，不是 Code）。',
        hint: 'Codex 的圖示是深色底，中間只有一個線條畫的輪廓；黑底、左下角有 `>_` 的是終端機。',
        answer: '點一下 Dock 上的「Codex」。',
        check: function (ev, api) {
          return !!(api.seen('win:open', function (d) { return d.appId === 'codex'; }) || api.win('codex').length > 0);
        }
      },
      {
        id: 's2',
        text: '把桌面上的 Project 資料夾，拖進 Codex 左邊的側邊欄。',
        hint: '按住 Project 圖示不放，拖到 Codex 左邊那一欄，看到側邊欄亮起藍框再放開。放開後桌面上的 Project 還在，這是正常的：只是告訴 Codex 它在哪裡。如果 Codex 蓋住了桌面圖示，先把視窗往左拖開一點，或從 Finder 視窗裡拖。',
        answer: 'Project 圖示 → 按住拖 → 放進 Codex 側邊欄。（也可以：Finder 對 Project 按右鍵 → 打開方式 → Codex。）',
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
        text: '到 Finder 看看它在電腦裡的真實位置：打開桌面的 Project，看視窗最下面的路徑列。',
        hint: 'Macintosh HD › 使用者 › an › 桌面 › Project 就是它真實的位置，也就是 /Users/an/Desktop/Project。',
        answer: '點兩下桌面上的 Project 資料夾。',
        check: function (ev, api) {
          return !!api.seen('finder:navigate', function (d) { return same(api, d.path, PROJECT); });
        }
      }
    ],
    outro: '記住：Codex 說的「專案」，就是電腦裡真的存在的那個資料夾。拖進去不是搬走，Project 還在桌面上。'
  });

  /* ------------------------------------------------------------------ M5 */
  LAB.missions.register({
    id: 'w3-05-in-project',
    week: 3, order: 5,
    title: '在專案裡請 Codex 做事',
    minutes: 10,
    resetsFiles: true,
    needs: [PROJECT],
    intro: '在專案底下開對話，Codex 做出來的東西會放進這個資料夾。我們來驗證：它做的檔案，在其他視窗也看得到。',
    prepare: function (api) {
      ensureBase(api);
      ensureProject(api);
      api.remove(PROJECT + '/output');
      api.remove(PROJECT + '/charts');
    },
    steps: [
      {
        id: 's1',
        text: '在 Codex 側邊欄點一下 Project，確認輸入框上方有「Project」這個標籤。',
        hint: '點 Project 這一列（不是最上面的 New chat）。',
        answer: '點側邊欄的 Project。',
        check: function (ev, api) {
          return !!api.seen('codex:select-project', function (d) { return same(api, d.path, PROJECT); });
        },
        trap: orphanReplyTrap('write_report')      // sent from New chat before this step was done
      },
      {
        id: 's2',
        text: '請 Codex 寫報告：點「複製」，貼進輸入框，再按 Return。[[幫我寫一份報告到 output/report.md]]',
        hint: '點「複製」，再點 Codex 的輸入框，按 Ctrl+V（Mac 用 Command+V）貼上。等它出現 Created output/report.md 就是做完了。',
        answer: '把「幫我寫一份報告到 output/report.md」貼到輸入框，按 Return。',
        check: function (ev, api) {
          return !!api.seen('codex:reply', function (d) { return d.intent === 'write_report' && same(api, d.projectPath, PROJECT); });
        },
        trap: orphanReplyTrap('write_report')
      },
      {
        id: 's3',
        text: '真實位置 = 專案資料夾 + output/report.md。到 Finder 找到它，看路徑列是不是這樣。',
        hint: '先打開 Project，再往下找 output。路徑列會寫 Macintosh HD › 使用者 › an › 桌面 › Project › output。',
        answer: 'Finder → 桌面 → Project → output。',
        check: function (ev, api) {
          return !!api.seen('finder:navigate', function (d) { return same(api, d.path, PROJECT + '/output'); });
        }
      },
      {
        id: 's4',
        text: '點兩下 report.md，用文字編輯讀它。',
        hint: '裡面有各班的平均分數，是 Codex 讀了 data 裡的 CSV 算出來的。',
        answer: '在 output 資料夾裡點兩下 report.md。',
        check: function (ev, api) {
          return !!api.seen('editor:open', function (d) { return same(api, d.path, REPORT); });
        }
      },
      {
        id: 's5',
        optional: true,
        text: '在終端機走到 Project，看看 output 裡有什麼。',
        hint: '先用地址走到 Project，再用 ls 看 output。想看檔案內容，可以試 `cat output/report.md`。',
        answer: '`cd ~/Desktop/Project`，Return；`ls output`，Return。',
        where: HOME,
        check: function (ev, api) {
          return !!api.termSeen(function (c) {
            return c.name === 'ls' && c.status === 0 && same(api, api.lsDir(c), PROJECT + '/output') && /report\.md/.test(String(c.out || ''));
          });
        }
      },
      {
        id: 's6',
        text: '用 Code（就是影片裡的 VS Code）打開 Project 資料夾。',
        hint: '資料夾可以拖到 Code 的視窗或 Dock 圖示上，也可以在 Finder 用右鍵的「打開方式」選 Code（不是 Codex）。',
        answer: 'Finder 對 Project 按右鍵 → 打開方式 → Code。',
        replay: 'mission',
        check: function (ev, api) {
          return !!api.seen('code:folder', function (d) { return same(api, d.path, PROJECT); });
        }
      },
      {
        id: 's7',
        text: '在 Code 左邊的檔案列表點開 output，再點 report.md。',
        hint: '左邊那一欄叫 EXPLORER，像 Finder 的側邊欄。',
        answer: 'EXPLORER → output → report.md。',
        check: function (ev, api) {
          return !!api.seen('editor:open', function (d) { return d.appId === 'code' && same(api, d.path, REPORT); });
        }
      },
      {
        id: 's8',
        optional: true,
        text: '在終端機的 Project 裡新增一個叫 charts 的資料夾，同時看 Code 左邊和 Finder：它會自己出現。',
        hint: 'mkdir 後面接資料夾名字。Finder 和 Code 都不用重新整理。',
        answer: '在 Project 裡輸入：`mkdir charts`',
        where: PROJECT,
        replay: 'mission',
        check: function (ev, api) {
          return !!(api.exists(PROJECT + '/charts') &&
            api.termSeen(function (c) { return c.name === 'mkdir' && c.status === 0; }));
        }
      }
    ],
    outro: 'Codex、Finder、終端機、Code，四個視窗看的是同一個資料夾；檔案不在聊天室裡，而是真的存在硬碟上。「output/report.md」是相對路徑，從對話所在的資料夾算起。'
  });

  /* ------------------------------------------------------------------ M6 */
  LAB.missions.register({
    id: 'w3-06-orphan',
    week: 3, order: 6,
    title: 'New chat 的陷阱',
    minutes: 8,
    resetsFiles: true,
    needs: [PROJECT],
    intro: '按最上面的 New chat 開出來的對話，不屬於任何專案。同一句話，檔案會放到哪裡？',
    prepare: function (api) {
      ensureBase(api);
      ensureProject(api);
      api.remove(DOCUMENTS + '/output');
      api.remove(PROJECT + '/output');   // so M5's file cannot blur the contrast in step 5
    },
    steps: [
      {
        id: 's1',
        text: '按 Codex 最上面的 New chat。注意：輸入框上方沒有 Project 標籤。',
        hint: '主畫面只問 What should we work on?，沒有專案名稱。',
        answer: '點側邊欄最上面的 New chat。',
        check: function (ev, api) {
          return !!api.seen('codex:new-chat', function (d) { return isNullish(d.projectPath); });
        }
      },
      {
        id: 's2',
        text: '輸入同一句話：點「複製」，貼進輸入框，再按 Return。[[幫我寫一份報告到 output/report.md]]',
        hint: '整句照打（或複製貼上），和上一個任務一模一樣。等它做完，側邊欄的 Recents 會出現這個對話：它不在 Project 底下。',
        answer: '輸入「幫我寫一份報告到 output/report.md」，按 Return。',
        check: function (ev, api) {
          return !!api.seen('codex:reply', function (d) { return d.intent === 'write_report' && isNullish(d.projectPath); });
        }
      },
      {
        id: 's3',
        text: '它說「已建立 output/report.md」，可是在哪？點「複製」，貼進輸入框，問它：[[列出你新增的檔案完整路徑]]',
        hint: '在同一個對話裡接著問。可以複製上面這句。',
        answer: '輸入「列出你新增的檔案完整路徑」，按 Return。',
        check: function (ev, api) {
          return !!api.seen('codex:reply', function (d) { return d.intent === 'list_paths' && isNullish(d.projectPath); });
        }
      },
      {
        id: 's4',
        text: '照它給的路徑，在 Finder 找到這個檔案。',
        hint: '路徑裡的 Documents，在 Finder 叫「文件」；一層一層往下找 output。',
        answer: '路徑是 /Users/an/Documents/output/report.md：Finder → 側邊欄「文件」→ output。',
        check: function (ev, api) {
          return !!api.seen('finder:navigate', function (d) { return same(api, d.path, DOCUMENTS + '/output'); });
        }
      },
      {
        id: 's5',
        text: '改在專案底下重做：點側邊欄的 Project，再把同一句話貼進輸入框（複製過的話，直接貼）。',
        hint: '這次輸入框上方會有 Project 標籤，檔案會寫進 Project 底下的 output。',
        answer: '點 Project → 輸入「幫我寫一份報告到 output/report.md」→ Return。',
        check: function (ev, api) {
          return !!api.seen('codex:reply', function (d) { return d.intent === 'write_report' && same(api, d.projectPath, PROJECT); });
        }
      },
      {
        id: 's6',
        text: '到 Finder 打開 Project 裡的 output，看到 report.md：這次它在專案裡。',
        hint: 'Finder → 桌面 → Project → output。',
        answer: '點兩下桌面的 Project，再點兩下 output。',
        check: function (ev, api) {
          return !!api.seen('finder:navigate', function (d) { return same(api, d.path, PROJECT + '/output'); });
        }
      }
    ],
    outro: 'New chat 開出來的對話不屬於任何專案，它做出來的檔案會放在你沒指定的地方（這次是「文件」，下次可能是別處）。要做正事，先點專案，再開始對話；也一定要知道檔案放在哪裡。'
  });

  /* ------------------------------------------------------------------ M7 */
  LAB.missions.register({
    id: 'w3-07-agents',
    week: 3, order: 7,
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
      // the seed text of §4.0 comes back when the file is missing or already carries the figures rule
      var text = api.read(AGENTS);
      if (text === null || text.indexOf('figures/') >= 0) api.ensureSeed(AGENTS, { overwrite: true });
    },
    steps: [
      {
        id: 's1',
        text: '用文字編輯或 Code 打開 Project 裡的 AGENTS.md，看它現在有哪些規則。',
        hint: '在 Finder 的 Project 裡，點兩下 AGENTS.md。',
        answer: 'Finder → 桌面 → Project → 點兩下 AGENTS.md。',
        check: function (ev, api) {
          return !!api.seen('editor:open', function (d) { return same(api, d.path, AGENTS); });
        },
        trap: orphanReplyTrap('write_agents')
      },
      {
        id: 's2',
        text: '在 Codex 點 Project 那一列，開新對話，點「複製」，貼進輸入框，再按 Return。[[把「圖表存到 figures/」加進 AGENTS.md]]',
        hint: '要用專案底下的對話（輸入框上方有 Project 標籤），不是 New chat。',
        answer: '點 Project 那一列，輸入整句，按 Return。',
        replay: 'mission',
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
        hint: '視窗被 Codex 蓋住了：點 Dock 的「文字編輯」，或把 Codex 視窗拖開。文字編輯會自己更新，不用重開。',
        answer: '點 Dock 的「文字編輯」（或在 Finder 再點兩下 AGENTS.md），最後一行是「- 圖表存到 figures/」。',
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
        answer: '點 Project 那一列右邊的 +，輸入「你目前遵守哪些規則？」，Return。',
        replay: 'mission',
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
        answer: '點最上面的 New chat，輸入「你目前遵守哪些規則？」，Return。',
        check: function (ev, api) {
          return !!api.seen('codex:reply', function (d) { return d.intent === 'ask_rules' && isNullish(d.projectPath); });
        }
      }
    ],
    outro: '重要的事寫進 AGENTS.md，專案裡的每個新對話都會讀到；不在專案裡的對話看不到專案的檔案，也看不到 AGENTS.md。完整的 AGENTS.md 通常有三個段落：這個專案在做什麼、希望 AI 怎麼幫忙、有哪些事情不要做（影片 02 示範過）；練習版的只有一段，你可以自己把它補完整。'
  });

  /* ------------------------------------------------------------------ free play */
  LAB.missions.freePlayTips = [
    '在桌面新增檔案夾，再把它拖進 Finder 視窗裡。',
    '在終端機試試 cp、rm、cat，看看會發生什麼事。',
    '在 Finder 對檔案按空白鍵，快速查看內容。',
    '請 Codex 列出目前資料夾裡有哪些檔案。',
    '打錯指令看看，終端機會怎麼回你。'
  ];
})(window.LAB);
