/* about.js — 關於這個練習 (DESIGN §4.3.4). Owner EDITORS.
   Four plain-text tabs: 關於 / 快速鍵 / 終端機指令 / 進度. Registers app 'about' (replaces the CORE placeholder). */
(function (LAB) {
  'use strict';

  var h = LAB.util.h;

  var TRADEMARK = 'macOS 與 Finder 是 Apple Inc. 的商標，Codex 是 OpenAI 的商標。這個練習是獨立的教學模擬，與兩家公司都沒有關係。';
  var COPYRIGHT = 'Copyright © 2026 JUNHAO CHEN・程式碼 MIT・內容 CC BY-NC-SA 4.0';
  var RESET_TITLE = '要重設練習環境嗎？';
  var RESET_TEXT = '這會清除你在這個練習裡建立的檔案、對話和任務進度，無法復原。';

  var TABS = [
    { id: 'about', label: '關於' },
    { id: 'keys', label: '快速鍵' },
    { id: 'commands', label: '終端機指令' },
    { id: 'progress', label: '進度' }
  ];

  /* §6.4, in Traditional Chinese */
  var KEYS = [
    ['選單列右上角的放大鏡', '開啟 Spotlight 搜尋（建議用這個方式）'],
    ['⌘Space　／　Ctrl＋空白鍵', '也能開 Spotlight，但真正的電腦常常先把這個鍵拿去用，不一定有效'],
    ['⌘Q', '結束最前面的程式（瀏覽器可能先攔走；也可以用選單的「結束」）'],
    ['⌘W', '關閉視窗（瀏覽器可能先攔走；也可以按視窗左上角的紅色按鈕）'],
    ['⌘M', '最小化視窗'],
    ['⌘H', '隱藏最前面的程式'],
    ['⌘`', '切換到同一個程式的下一個視窗'],
    ['⌘N', '新視窗（Finder、終端機），或 Codex 的新對話'],
    ['Esc', '關閉選單、Spotlight、對話框、快速查看，或取消拖曳'],
    ['Finder', '⌘A 全選　⌘[ ⌘] 上一頁、下一頁　⌘↑ 上層資料夾　⌘↓ 打開　⌘⇧N 新增資料夾　⌘⇧G 前往資料夾　⌘⇧H／D／O／A 前往 an／桌面／文件／應用程式　⌥⌘L 下載項目　⌘D 複製　⌘⌫ 移到垃圾桶　空白鍵 快速查看　Return 重新命名　⌘1／⌘2 圖示、列表'],
    ['終端機', '⌘K 清除全部　⌘C 拷貝　⌘V 貼上　Ctrl+C 中斷　Ctrl+D 結束輸入　Ctrl+L 清畫面　Ctrl+W 或 Alt+Backspace 刪掉前一個字　Tab 補完　↑／↓ 翻看以前的指令'],
    ['文字編輯、Code', '⌘S 儲存']
  ];
  var KEYS_NOTE = '在 Windows 鍵盤上，Command 可以用 Ctrl 代替（終端機裡除外）。⌘Space 常被真正的電腦先拿去用，Ctrl＋空白鍵在 Windows 鍵盤上常是切換輸入法，所以請點選單列右上角的放大鏡。Ctrl+W、Ctrl+T、Ctrl+N 是瀏覽器的快速鍵，請用視窗左上角的按鈕或選單。';

  /* §4.2.4, one line each */
  var COMMANDS = [
    ['pwd', '顯示現在所在的資料夾位置'],
    ['cd', '換到另一個資料夾（cd .. 往外一層，cd ~ 回到「社區」，也就是家目錄 /Users/an）'],
    ['ls', '列出資料夾裡有什麼（ls -l 看詳細資料，ls -a 連隱藏的檔案也列出來）'],
    ['mkdir', '建立新資料夾'],
    ['touch', '建立空白檔案，或更新檔案的時間'],
    ['cat', '把檔案內容印在畫面上'],
    ['echo', '把後面的文字印出來'],
    ['clear', '清除畫面'],
    ['cp', '複製檔案（複製資料夾要加 -r）'],
    ['mv', '搬動檔案，或改名字（目的地不存在時，就是改名）'],
    ['rm', '刪除檔案，不會進垃圾桶（刪資料夾要加 -r），請小心'],
    ['rmdir', '刪除空的資料夾'],
    ['open', '用預設的程式打開檔案或資料夾（open . 打開目前的資料夾，open -a Code . 指定程式）'],
    ['unzip', '解開 .zip 壓縮檔'],
    ['history', '列出以前輸入過的指令'],
    ['whoami', '顯示你的帳號名稱'],
    ['hostname', '顯示這台電腦的名稱'],
    ['date', '顯示現在的日期和時間'],
    ['uname', '顯示作業系統的名稱'],
    ['which', '查一個指令放在哪裡'],
    ['wc', '計算行數、字數和位元組數'],
    ['head / tail', '顯示檔案開頭或結尾的幾行'],
    ['sleep', '等幾秒鐘（按 Ctrl+C 可以中斷）'],
    ['exit', '結束這個終端機的工作階段'],
    ['man / vi / nano', '練習版沒有做這幾個指令']
  ];
  var COMMANDS_NOTE = '這是練習版的終端機：真正的 Mac 上有更多指令，有些在這裡還沒有做。';

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
    } } }, '重設練習環境');
    return h('div', { class: 'ab-body' },
      h('h2', { class: 'ab-h' }, '關於這個練習'),
      p('這是練習用的模擬環境，不是真的 Mac，也不是真的 AI。'),
      p('你可以在這裡練習「學習分析工具」每週的操作，先從 Week 3 的終端機、Finder 和 Codex 開始。照著左邊的任務卡做，或自己隨便玩；弄壞了隨時可以重來。'),
      p('你的進度只存在這個瀏覽器裡。'),
      notice,
      h('div', { class: 'ab-rule' }),
      p('版本 v1', 'ab-muted'),
      p(TRADEMARK, 'ab-muted'),
      h('div', { class: 'ab-rule' }),
      p('如果這是學校的共用電腦，用完請按「重設練習環境」。'),
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
    var input = h('input', { type: 'text', class: 'ab-input', spellcheck: 'false', autocomplete: 'off', placeholder: 'LABv1.…', 'aria-label': '貼上進度代碼', dataset: { lab: 'ab-import-input' } });
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
      p('換電腦或交給老師時，複製這串進度代碼。'),
      code,
      h('p', { class: 'ab-p' }, copyBtn),
      h('div', { class: 'ab-rule' }),
      p('在另一台電腦上，把代碼貼在這裡：'),
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
      appId: 'about', title: '關於這個練習', width: 520, height: 480, bar: 'plain', theme: 'light', content: root,
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
    title: '關於這個練習', en: 'About', aliases: ['about', '關於'], icon: 'app-about', dock: false,
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

  LAB.menu.register('about', function () {
    return [{ label: '視窗', items: LAB.menu.windowMenu(false) }];
  });
})(window.LAB);
