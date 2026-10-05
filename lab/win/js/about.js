/* about.js — 關於這個練習 (DESIGN M§4.3.4 + W6). Owner APPS.
   Four plain-text tabs: 關於 / 快速鍵 / 終端機指令 / 進度, in Windows words (Ctrl, Enter, 檔案總管, the extensions note, LABw1.).
   Registers app 'about' (replaces the CORE placeholder). */
(function (LAB) {
  'use strict';

  var h = LAB.util.h;

  var TRADEMARK = 'Windows、檔案總管、Windows Terminal、PowerShell 與 Visual Studio Code 是 Microsoft 的商標，Codex 是 OpenAI 的商標。這個練習是獨立的教學模擬，與這些公司都沒有關係。';
  var WALLPAPER = '桌布是用程式畫的原創圖案，沒有使用任何公司的圖片。';
  var COPYRIGHT = 'Copyright © 2026 JUNHAO CHEN・程式碼 MIT・內容 CC BY-NC-SA 4.0';
  var EXT_NOTE = '關於副檔名：真正的 Windows 檔案總管預設會把副檔名藏起來（week3.zip 只會顯示 week3）。為了讓你分得清楚，練習版一律顯示完整的檔名。想在自己的電腦上顯示副檔名：檔案總管 › 檢視 › 顯示 › 檔案名稱副檔名。';
  var RESET_TITLE = '要重設全部嗎？';
  var RESET_TEXT = '這會清除你在這個練習裡建立的檔案、對話和任務進度，無法復原。';

  var TABS = [
    { id: 'about', label: '關於' },
    { id: 'keys', label: '快速鍵' },
    { id: 'commands', label: '終端機指令' },
    { id: 'progress', label: '進度' }
  ];

  /* the Windows keys (DESIGN W3, W4, W5, W6) */
  var KEYS = [
    ['工作列的「搜尋」框', '開啟搜尋（建議用這個方式）'],
    ['Ctrl＋空白鍵', '也能開搜尋，但在 Windows 鍵盤上它常是切換輸入法的快速鍵，不一定有效'],
    ['Ctrl+W', '關閉視窗（瀏覽器可能先攔走；也可以按視窗右上角的 ✕）'],
    ['Ctrl+N', '新視窗（檔案總管、終端機），Codex 的新對話，記事本的新索引標籤'],
    ['Esc', '關閉選單、搜尋、對話框，或取消拖曳'],
    ['檔案總管：瀏覽', 'Enter 開啟　Backspace 或 Alt+← 上一頁　Alt+→ 下一頁　Alt+↑ 上一層資料夾　Ctrl+A 全選'],
    ['檔案總管：整理', 'F2 重新命名　Delete 移到資源回收筒　Ctrl+Shift+N 新增資料夾　Ctrl+C／X／V 複製、剪下、貼上'],
    ['終端機', 'Ctrl+C 中斷（有選取文字時是複製）　Ctrl+V 貼上　Ctrl+L 清畫面　Tab 補完　↑／↓ 翻看以前的指令　Esc 清除這一行　Home／End 跳到行首、行尾'],
    ['記事本、Visual Studio Code', 'Ctrl+S 儲存'],
    ['Codex', 'Enter 送出　Shift+Enter 換行']
  ];
  var KEYS_NOTE = 'Ctrl+W、Ctrl+T、Ctrl+N 是瀏覽器的快速鍵，可能被瀏覽器先拿去用，沒有反應時請改用視窗右上角的按鈕或功能表。Ctrl＋空白鍵在 Windows 上常是切換輸入法，所以請點工作列的「搜尋」框。在終端機裡，Ctrl 鍵只做終端機自己的事，不會觸發其他快速鍵。';

  /* DESIGN W5, one line each (the names a student may type are listed together) */
  var COMMANDS = [
    ['ls　dir　Get-ChildItem', '列出資料夾裡有什麼（Mode 欄的 d 代表資料夾，Name 欄是名字）'],
    ['cd　Set-Location', '換到另一個資料夾（cd .. 往外一層，cd ~ 回到「社區」，也就是家目錄 C:\Users\an）'],
    ['pwd　Get-Location', '顯示現在所在的資料夾位置'],
    ['mkdir　md', '建立新資料夾'],
    ['mv　move', '搬動檔案，或改名字（目的地不存在時，就是改名）'],
    ['cp　copy', '複製檔案（複製資料夾要加 -Recurse）'],
    ['rm　del', '刪除檔案，不會進資源回收筒（刪資料夾要加 -Recurse），請小心'],
    ['cat　type　Get-Content', '把檔案內容印在畫面上'],
    ['echo　Write-Output', '把後面的文字印出來'],
    ['cls　clear', '清除畫面'],
    ['tar -xvf', '解開 .zip 壓縮檔（x 解開、v 列出、f 指定檔案）。Windows 沒有 unzip'],
    ['Expand-Archive', '另一種解開 .zip 的方法'],
    ['explorer .', '用檔案總管打開目前的資料夾（explorer 檔案路徑 也可以；start、ii 也行）'],
    ['code .', '用 Visual Studio Code 打開目前的資料夾'],
    ['notepad', '用記事本打開檔案'],
    ['history', '列出以前輸入過的指令'],
    ['whoami', '顯示你的帳號名稱'],
    ['hostname', '顯示這台電腦的名稱'],
    ['exit', '結束這個終端機的工作階段'],
    ['help', '列出練習版有哪些指令']
  ];
  var COMMANDS_NOTE = '這是練習版的 Windows PowerShell：真正的電腦上有更多指令，有些在這裡還沒有做。路徑可以用 \ 也可以用 /。';

  function p(text, cls) { return h('p', { class: 'ab-p' + (cls ? ' ' + cls : '') }, text); }

  function buildAbout(win, ctl) {
    var notice = h('p', { class: 'ab-p ab-notice', dataset: { lab: 'ab-notice' } });
    function setNotice() {
      var t = LAB.store && LAB.store.noticeText;
      notice.textContent = t || '';
      notice.hidden = !t;
    }
    setNotice();
    win.own(LAB.bus.on('store:notice', setNotice));
    var resetBtn = h('button', { type: 'button', class: 'ab-textbtn', dataset: { lab: 'ab-reset' }, on: { click: function () {
      LAB.ui.confirm(win, { title: RESET_TITLE, text: RESET_TEXT, ok: '重設', cancel: '取消', danger: true })
        .then(function (ok) { if (ok) LAB.store.reset('all'); });
    } } }, '重設全部');
    return h('div', { class: 'ab-body' },
      h('h2', { class: 'ab-h' }, '關於這個練習'),
      p('這是練習用的模擬環境，不是真的 Windows，也不是真的 AI。'),
      p('你可以在這裡練習「學習分析工具」每週的操作，先從 Week 3 的終端機、檔案總管和 Codex 開始。照著右上角的任務卡做；想練哪一個任務，按任務卡上的「換任務」自己挑。弄壞了隨時可以重來。'),
      p('每次進來都是一台全新的電腦，任務都還沒做過；重新整理或離開這一頁，這次的進度就不會留下。'),
      p(EXT_NOTE),
      notice,
      h('div', { class: 'ab-rule' }),
      p('版本 v1（Windows）', 'ab-muted'),
      p(TRADEMARK, 'ab-muted'),
      p(WALLPAPER, 'ab-muted'),
      h('div', { class: 'ab-rule' }),
      p('想馬上重來，可以把這台電腦恢復成全新的樣子：'),
      h('p', { class: 'ab-p' }, resetBtn),
      h('div', { class: 'ab-rule' }),
      p(COPYRIGHT, 'ab-muted ab-copy'));
  }

  function buildKeys() {
    var rows = KEYS.map(function (r) {
      return h('tr', null, h('th', { scope: 'row', class: 'ab-key' }, r[0]), h('td', null, r[1]));
    });
    return h('div', { class: 'ab-body' },
      h('h2', { class: 'ab-h' }, '快速鍵'),
      h('table', { class: 'ab-table', dataset: { lab: 'ab-keys' } }, h('tbody', null, rows)),
      p(KEYS_NOTE, 'ab-muted'));
  }

  function buildCommands() {
    var rows = COMMANDS.map(function (r) {
      return h('tr', null, h('th', { scope: 'row', class: 'ab-cmd' }, r[0]), h('td', null, r[1]));
    });
    return h('div', { class: 'ab-body' },
      h('h2', { class: 'ab-h' }, '終端機指令'),
      h('table', { class: 'ab-table', dataset: { lab: 'ab-commands' } }, h('tbody', null, rows)),
      p(COMMANDS_NOTE, 'ab-muted'));
  }

  function buildProgress(win) {
    var code = h('textarea', { class: 'ab-code', readonly: true, rows: '3', spellcheck: 'false', 'aria-label': '進度代碼', dataset: { lab: 'ab-progress-code' } });
    var copyBtn = h('button', { type: 'button', class: 'ab-link', dataset: { lab: 'ab-copy' } }, '複製');
    var copyTimer = 0;
    var input = h('input', { type: 'text', class: 'ab-input', spellcheck: 'false', autocomplete: 'off', placeholder: (LAB.progressPrefix || 'LABw1.') + '…', 'aria-label': '貼上進度代碼', dataset: { lab: 'ab-import-input' } });
    var importBtn = h('button', { type: 'button', class: 'ab-textbtn', dataset: { lab: 'ab-import' } }, '匯入');
    var msg = h('p', { class: 'ab-p', dataset: { lab: 'ab-import-msg' }, 'aria-live': 'polite' });
    var summary = h('pre', { class: 'ab-summary', dataset: { lab: 'ab-import-summary' } });
    msg.hidden = true; summary.hidden = true;
    var notice = h('p', { class: 'ab-p ab-notice' });

    function refresh() {
      var c = '';
      try { c = LAB.missions && LAB.missions.progressCode ? LAB.missions.progressCode() : ''; } catch (e) { c = ''; }
      if (code.value !== c) code.value = c;
      var t = LAB.store && LAB.store.noticeText;
      notice.textContent = t || '';
      notice.hidden = !t;
    }
    copyBtn.addEventListener('click', function () {
      LAB.clipboard.setText(code.value);
      copyBtn.textContent = '已複製';
      if (copyTimer) clearTimeout(copyTimer);
      copyTimer = setTimeout(function () { copyBtn.textContent = '複製'; copyTimer = 0; }, 1800);
    });
    code.addEventListener('focus', function () { code.select(); });
    function doImport() {
      var r = { ok: false, message: '還不能匯入。', summary: '' };
      try { r = LAB.missions.importProgressCode(input.value); } catch (e) { r = { ok: false, message: '匯入時發生錯誤。', summary: '' }; }
      msg.hidden = false;
      msg.textContent = r.message || '';
      msg.classList.toggle('is-error', !r.ok);
      summary.hidden = !r.summary;
      summary.textContent = r.summary || '';
      refresh();
    }
    importBtn.addEventListener('click', doImport);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !LAB.ui.isImeEnter(e)) { e.preventDefault(); doImport(); }
    });
    win.own(LAB.bus.on('mission:start', refresh));
    win.own(LAB.bus.on('mission:step', refresh));
    win.own(LAB.bus.on('mission:complete', refresh));
    win.own(LAB.bus.on('mission:reset', refresh));
    win.own(LAB.bus.on('store:notice', refresh));
    win.own(function () { if (copyTimer) clearTimeout(copyTimer); });
    refresh();

    var node = h('div', { class: 'ab-body' },
      h('h2', { class: 'ab-h' }, '進度'),
      p('要給老師看這次完成了哪些任務，複製這串進度代碼。'),
      code,
      h('p', { class: 'ab-p' }, copyBtn),
      h('div', { class: 'ab-rule' }),
      p('如果你有之前複製的進度代碼，可以貼在這裡看內容（只在這次有效，重新整理就會消失）：'),
      h('div', { class: 'ab-row' }, input, importBtn),
      msg, summary,
      notice);
    node.refresh = refresh;
    return node;
  }

  var ctls = new Map();

  function createWindow(tab) {
    var tabEls = {}, panels = {};
    var current = 'about';
    var tablist = h('div', { class: 'ab-tabs', role: 'tablist', 'aria-label': '關於這個練習' });
    var panelHost = h('div', { class: 'ab-panels' });
    var root = h('div', { class: 'ab-root', dataset: { lab: 'ab-root' } }, tablist, panelHost);
    var win = LAB.wm.open({
      appId: 'about', title: '關於這個練習', width: 520, height: 520, theme: 'light', content: root,
      icon: 'app-about', singleton: 'about', minW: 400, minH: 300
    });
    var builders = {
      about: function () { return buildAbout(win); },
      keys: buildKeys,
      commands: buildCommands,
      progress: function () { return buildProgress(win); }
    };

    function show(id) {
      if (!builders[id]) id = 'about';
      current = id;
      TABS.forEach(function (t) {
        var on = t.id === id;
        tabEls[t.id].classList.toggle('is-on', on);
        tabEls[t.id].setAttribute('aria-selected', on ? 'true' : 'false');
        tabEls[t.id].tabIndex = on ? 0 : -1;
        if (panels[t.id]) panels[t.id].hidden = !on;
      });
      if (!panels[id]) {
        var pn = h('div', { class: 'ab-panel', role: 'tabpanel', 'aria-label': tabLabel(id), dataset: { tab: id } }, builders[id]());
        panels[id] = pn;
        panelHost.appendChild(pn);
      } else if (id === 'progress') {
        var inner = panels[id].firstChild;
        if (inner && inner.refresh) inner.refresh();
      }
      panels[id].hidden = false;
      panels[id].scrollTop = 0;
    }
    function tabLabel(id) { for (var i = 0; i < TABS.length; i++) if (TABS[i].id === id) return TABS[i].label; return id; }

    TABS.forEach(function (t, i) {
      var b = h('button', { type: 'button', class: 'ab-tab', role: 'tab', dataset: { lab: 'ab-tab', tab: t.id } }, t.label);
      b.addEventListener('click', function () { show(t.id); });
      b.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
          e.preventDefault();
          var n = (i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length;
          show(TABS[n].id);
          tabEls[TABS[n].id].focus();
        }
      });
      tabEls[t.id] = b;
      tablist.appendChild(b);
    });

    var ctl = { win: win, show: show, current: function () { return current; } };
    ctls.set(win.id, ctl);
    win.own(function () { ctls.delete(win.id); });
    win.state.path = '';
    show(tab || 'about');
    return win;
  }

  LAB.apps.register('about', {
    title: '關於這個練習', en: 'About', aliases: ['about', '關於', '關於這個練習', '練習'], icon: 'app-about', dock: false,
    open: function (args) {
      var tab = args && args.tab;
      if (tab === 'commands' || tab === 'terminal') tab = 'commands';
      var existing = LAB.wm.byApp('about')[0];
      if (existing) {
        existing.focus();
        var c = ctls.get(existing.id);
        if (c && tab) c.show(tab);
        return existing;
      }
      return createWindow(tab);
    }
  });
})(window.LAB);
