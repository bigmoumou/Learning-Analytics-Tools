/* textedit.js — 記事本 (Windows 11 Notepad; app id stays 'textedit') and Quick Look (kept callable, unused on Windows). DESIGN W6. Owner APPS.
   Registers apps 'textedit' and 'quicklook' (a non-taskbar helper), plus LAB.textedit and LAB.quicklook.
   One window holds several tabs (like the real Notepad). Each tab has its own <textarea>; only the shown tab's textarea carries data-lab="te-text",
   so a test that asks a window for [data-lab=te-text] always gets the document on screen.
   User data (file names, file contents) only ever goes through textContent or textarea.value, never innerHTML (M§0.5). */
(function (LAB) {
  'use strict';

  var h = LAB.util.h;
  var vfs = LAB.vfs;
  var HOME = vfs.HOME;
  var DESKTOP = HOME + '/Desktop';
  var TRASH = HOME + '/.Trash';
  var TEXT_EXT = { '.md': 1, '.txt': 1, '.csv': 1, '.json': 1, '.log': 1 };
  var QL_MAX_LINES = 200;
  var UNTITLED = '無標題';
  var APP_NAME = '記事本';
  var ZOOM_MIN = 10, ZOOM_MAX = 500, ZOOM_STEP = 10;

  /* ------------------------------------------------------------ helpers */
  function normNl(s) { return String(s).replace(/\r\n?/g, '\n'); }
  function toast(t) { LAB.ui.toast(t); }
  /* every path the student can read goes through LAB.win (W1); the local fallback only covers a half-loaded page */
  function toWin(p) {
    if (LAB.win && LAB.win.toWin) return LAB.win.toWin(p);
    var s = String(p);
    return s.charAt(0) === '/' ? 'C:' + (s === '/' ? '\\' : s.replace(/\//g, '\\')) : s;
  }
  function isEditableTarget(t) {
    if (!t || !t.tagName) return false;
    return t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable === true;
  }

  /* insert text at the caret of a textarea, keeping the native undo stack when the browser allows it */
  function insertText(ta, text) {
    try { ta.focus({ preventScroll: true }); } catch (e) { ta.focus(); }
    var ok = false;
    try { ok = document.execCommand('insertText', false, text); } catch (e2) { ok = false; }
    if (!ok) {
      ta.setRangeText(text, ta.selectionStart, ta.selectionEnd, 'end');
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  function sheet(win, title, text) {
    return LAB.ui.alert(win, { title: title, text: text || '', buttons: [{ label: '好', value: true, 'default': true, cancel: true }] });
  }

  /* a student-readable reason for a failed save (never the raw English code text) */
  var ERR_ZH = {
    ENOTDIR: '這個路徑中間有一個是檔案，不是資料夾。', ENOENT: '找不到這個位置。', EEXIST: '已經有同名的項目。', EISDIR: '這個名稱是資料夾。',
    EACCES: '這個位置不能寫入。', EPROTECTED: '這是系統用的資料夾，不能改。', ENAMETOOLONG: '檔案名稱太長。', EINVAL: '這個名稱或路徑不能用。'
  };
  function saveFailure(win, name, text, e) {
    var code = e && e.code;
    if (code === 'ENOSPC') {
      if (vfs.limits && vfs.utf8len(text) > vfs.limits.maxFile) return sheet(win, '這個檔案太大了：練習版每個檔案最多 200 KB。', '沒有儲存任何內容。');
      return sheet(win, '練習用的電腦儲存空間滿了。', '請刪除一些檔案再試一次。沒有儲存任何內容。');
    }
    return sheet(win, '無法儲存「' + name + '」。', (code && ERR_ZH[code]) || '發生了未知的錯誤。');
  }

  function pasteText(ta) {
    var done = function (t) { if (t) insertText(ta, normNl(t)); };
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        navigator.clipboard.readText().then(function (t) { done(t || LAB.clipboard.text); }, function () { done(LAB.clipboard.text); });
        return;
      }
    } catch (e) { /* fall through */ }
    done(LAB.clipboard.text);
  }

  /* ---- own small glyphs (flat, drawn here; the taskbar's Notepad icon belongs to icons.js) ---- */
  function glyph(inner) {
    return '<svg viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' + inner + '</g></svg>';
  }
  function gearPath(cx, cy, ro, ri, n) {
    var pts = [], i, a, step = Math.PI * 2 / n, w1 = step * 0.17, w2 = step * 0.11;
    for (i = 0; i < n; i++) {
      a = i * step;
      pts.push([cx + ri * Math.cos(a - w1 - 0.05), cy + ri * Math.sin(a - w1 - 0.05)]);
      pts.push([cx + ro * Math.cos(a - w2), cy + ro * Math.sin(a - w2)]);
      pts.push([cx + ro * Math.cos(a + w2), cy + ro * Math.sin(a + w2)]);
      pts.push([cx + ri * Math.cos(a + w1 + 0.05), cy + ri * Math.sin(a + w1 + 0.05)]);
    }
    return 'M' + pts.map(function (q) { return q[0].toFixed(2) + ' ' + q[1].toFixed(2); }).join('L') + 'Z';
  }
  LAB.icons.add('np-gear', glyph('<path d="' + gearPath(12, 12, 9.2, 7.3, 8) + '"/><circle cx="12" cy="12" r="3.1"/>'));
  /* the small notepad in the tab strip: a blue pad with a page, three lines and the spiral rings */
  LAB.icons.add('np-pad', '<svg viewBox="0 0 16 16"><rect x="2" y="2" width="12" height="12.6" rx="2" fill="#1f7ad6"/><rect x="3.4" y="4.6" width="9.2" height="8.6" rx="1" fill="#eef6ff"/>' +
    '<path d="M5.2 7.2h5.6M5.2 9.2h5.6M5.2 11.2h3.4" stroke="#7fb2e8" stroke-width="1" stroke-linecap="round"/>' +
    '<rect x="4" y=".9" width="1.4" height="3" rx=".7" fill="#0c4d92"/><rect x="7.3" y=".9" width="1.4" height="3" rx=".7" fill="#0c4d92"/><rect x="10.6" y=".9" width="1.4" height="3" rx=".7" fill="#0c4d92"/></svg>');

  /* ============================================================ Notepad */
  var ctls = new Map();          // winId -> controller
  function activeCtl() {
    var w = LAB.wm.focused();
    return w && w.appId === 'textedit' ? (ctls.get(w.id) || null) : null;
  }
  function allCtls() {
    var list = LAB.wm.byApp('textedit');      // bottom to top
    var out = [];
    for (var i = list.length - 1; i >= 0; i--) { var c = ctls.get(list[i].id); if (c) out.push(c); }
    return out;
  }
  var tabSeq = 0;

  function createWindow(path) {
    var tabs = [];
    var active = null;
    var zoom = 100, wrapOn = true, statusOn = true;
    var asking = false;
    var win = null;

    /* ---------------------------------------------------------- DOM skeleton */
    var tabsEl = h('div', { class: 'te-tabs', role: 'tablist', 'aria-label': '索引標籤' });
    var addBtn = h('button', { type: 'button', class: 'te-add', 'aria-label': '新增索引標籤', title: '新增索引標籤 (Ctrl+N)', dataset: { lab: 'te-newtab' },
      on: { click: function () { newTab(); } } }, LAB.icons.el('plus', { size: 14 }));
    var strip = h('div', { class: 'te-strip' }, h('span', { class: 'te-app', 'aria-hidden': 'true' }, LAB.icons.el('np-pad', { size: 16 })), tabsEl, addBtn);

    var menuBtns = [];
    var MENU_NAMES = ['檔案', '編輯', '檢視'];
    var openIdx = -1, closedAt = 0, closedIdx = -1;
    function markMenus() { menuBtns.forEach(function (b, i) { b.classList.toggle('is-open', i === openIdx); b.setAttribute('aria-expanded', i === openIdx ? 'true' : 'false'); }); }
    function openMenu(idx) {
      var btn = menuBtns[idx];
      var r = LAB.stage.rectOf(btn);
      openIdx = idx;
      markMenus();
      LAB.menu.contextMenu(r.x, r.y + r.h + 2, menuItems(idx), {
        onClose: function () {
          if (openIdx === idx) { openIdx = -1; closedAt = Date.now(); closedIdx = idx; markMenus(); }
        }
      });
    }
    MENU_NAMES.forEach(function (name, i) {
      var b = h('button', { type: 'button', class: 'te-mi', role: 'menuitem', 'aria-haspopup': 'menu', 'aria-expanded': 'false', dataset: { lab: 'te-menu', menu: name } }, name);
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        if (closedIdx === i && Date.now() - closedAt < 250) return;     // the press that closed this menu is not a click to open it again
        if (openIdx === i) { LAB.menu.closeAll(); return; }
        openMenu(i);
      });
      b.addEventListener('mouseenter', function () { if (openIdx >= 0 && openIdx !== i) openMenu(i); });
      menuBtns.push(b);
    });
    var gearBtn = h('button', { type: 'button', class: 'te-gear', 'aria-label': '設定', title: '設定', on: { click: function () { toast('練習版沒有記事本的設定'); } } }, LAB.icons.el('np-gear', { size: 16 }));
    var menubar = h('div', { class: 'te-menubar', role: 'menubar', 'aria-label': '功能表' }, h('div', { class: 'te-menus' }, menuBtns), h('span', { class: 'te-grow' }), gearBtn);

    var editEl = h('div', { class: 'te-edit' });

    var posEl = h('span', { class: 'te-st', dataset: { lab: 'te-pos' } }, '行 1，欄 1');
    var countEl = h('span', { class: 'te-st' }, '0 個字元');
    var zoomEl = h('span', { class: 'te-st te-st-r' }, '100%');
    var eolEl = h('span', { class: 'te-st te-st-r' }, 'Windows (CRLF)');
    var encEl = h('span', { class: 'te-st te-st-r' }, 'UTF-8');
    var status = h('div', { class: 'te-status', dataset: { lab: 'te-status' } }, posEl, countEl, h('span', { class: 'te-grow' }), zoomEl, eolEl, encEl);

    var root = h('div', { class: 'te-root', dataset: { lab: 'te-root' } }, menubar, editEl, status);

    win = LAB.wm.open({
      appId: 'textedit', title: APP_NAME, width: 640, height: 440, theme: 'light', content: root, icon: 'app-textedit', minW: 360, minH: 240,
      titlebar: 'custom', titlebarHeight: 32, captionHeight: 32, titlebarContent: strip, onClose: onClose
    });

    /* ---------------------------------------------------------- tabs */
    function baseName(t) { return t.path ? vfs.basename(t.path) : UNTITLED; }
    function titleOf(t) {
      if (!t) return APP_NAME;
      var s = baseName(t);
      if (t.deleted) s += '（已被刪除）';
      return (t.dirty ? '*' : '') + s + ' - ' + APP_NAME;
    }
    function currentText() { return active ? active.ta.value : ''; }

    function makeTab(p) {
      var t = { id: ++tabSeq, path: p || null, saved: '', dirty: false, deleted: false, changedOnDisk: false };
      var ta = h('textarea', {
        class: 'te-text', spellcheck: 'false', autocomplete: 'off', autocorrect: 'off', autocapitalize: 'off', hidden: true, 'aria-label': '文字編輯區'
      });
      if (p) { try { ta.value = normNl(vfs.readFile(p, { by: 'editor' })); } catch (e) { ta.value = ''; } }
      t.ta = ta; t.saved = ta.value;
      ta.addEventListener('input', function () { if (t === active) onEdit(); else setDirty(t); });
      ['keyup', 'click', 'mouseup', 'select', 'focus'].forEach(function (n) { ta.addEventListener(n, function () { if (t === active) updateStatus(); }); });
      ta.addEventListener('keydown', function (e) {
        if (e.key === 'Tab' && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey && !LAB.ui.isImeEnter(e)) {
          e.preventDefault();
          insertText(ta, '\t');
        }
      });
      ta.addEventListener('paste', function (e) {
        e.preventDefault();
        var s = LAB.clipboard.forPaste(e);
        if (s) insertText(ta, normNl(s));
      });
      ta.addEventListener('wheel', function (e) {
        if (!e.ctrlKey) return;
        e.preventDefault();
        setZoom(zoom + (e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP));
      }, { passive: false });
      applyView(ta);

      var nameEl = h('span', { class: 'te-tab-name' });
      var xBtn = h('button', { type: 'button', class: 'te-tab-x', tabindex: '-1', 'aria-label': '關閉索引標籤', dataset: { lab: 'te-tab-close' } },
        h('span', { class: 'te-dot', 'aria-hidden': 'true' }), LAB.icons.el('x', { size: 12 }));
      var el = h('div', { class: 'te-tab', role: 'tab', 'aria-selected': 'false', dataset: { lab: 'te-tab', nodrag: '1' } }, nameEl, xBtn);
      el.addEventListener('mousedown', function (e) { if (e.button === 1) e.preventDefault(); });
      el.addEventListener('auxclick', function (e) { if (e.button === 1) { e.preventDefault(); closeTab(t); } });
      el.addEventListener('dblclick', function (e) { e.stopPropagation(); });      // a double-click on a tab must not maximize the window
      el.addEventListener('click', function (e) {
        if (e.target.closest('.te-tab-x')) { e.stopPropagation(); closeTab(t); return; }
        if (t !== active) { activate(t); if (t.path) LAB.bus.emit('editor:open', { path: t.path, appId: 'textedit', winId: win.id, via: 'tab' }); }
      });
      t.el = el; t.nameEl = nameEl;
      paintTab(t);
      editEl.appendChild(ta);
      tabsEl.appendChild(el);
      tabs.push(t);
      return t;
    }
    function paintTab(t) {
      t.nameEl.textContent = baseName(t);
      t.el.title = t.path ? toWin(t.path) : UNTITLED;
      t.el.classList.toggle('is-dirty', t.dirty);
      t.el.classList.toggle('is-deleted', t.deleted);
    }
    function layoutTabs() {
      tabs.forEach(function (t, i) {
        t.el.classList.toggle('is-pre', !!tabs[i + 1] && tabs[i + 1] === active);
      });
    }
    function setDirty(t) {
      var d = t.ta.value !== t.saved;
      if (d === t.dirty) return;
      t.dirty = d;
      paintTab(t);
      if (t === active) syncWindow();
    }
    function syncWindow() {
      win.state.path = active && active.path ? active.path : '';
      win.state.dirty = !!(active && active.dirty);
      var tt = titleOf(active);
      if (win.getTitle() !== tt) win.setTitle(tt);
    }
    function onEdit() { setDirty(active); updateStatus(); }

    function activate(t, noFocus) {
      if (active && active !== t) active.ta.removeAttribute('data-lab');
      active = t;
      tabs.forEach(function (x) {
        var on = x === t;
        x.ta.hidden = !on;
        x.el.classList.toggle('is-active', on);
        x.el.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      t.ta.setAttribute('data-lab', 'te-text');
      layoutTabs();
      syncWindow();
      updateStatus();
      keepTabVisible(t);
      if (!noFocus && win.isFocused()) { try { t.ta.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
    }
    function keepTabVisible(t) {
      var l = t.el.offsetLeft, w = t.el.offsetWidth;
      if (l < tabsEl.scrollLeft) tabsEl.scrollLeft = l;
      else if (l + w > tabsEl.scrollLeft + tabsEl.clientWidth) tabsEl.scrollLeft = l + w - tabsEl.clientWidth;
    }
    function newTab(p) {
      var t = makeTab(p || null);
      activate(t);
      return t;
    }
    function removeTab(t) {
      var i = tabs.indexOf(t);
      if (i < 0) return;
      tabs.splice(i, 1);
      if (t.el.parentNode) t.el.parentNode.removeChild(t.el);
      if (t.ta.parentNode) t.ta.parentNode.removeChild(t.ta);
      if (!tabs.length) { active = null; win.close(true); return; }      // the last tab closes the window, like the real Notepad
      if (active === t) { active = null; activate(tabs[i] || tabs[i - 1]); } else layoutTabs();
    }

    /* ---------------------------------------------------------- status bar, view */
    function updateStatus() {
      if (!active) return;
      var ta = active.ta, v = ta.value;
      var pos = ta.selectionStart || 0;
      var before = v.slice(0, pos);
      var ln = 1, i = -1;
      while ((i = before.indexOf('\n', i + 1)) !== -1) ln++;
      var col = pos - (before.lastIndexOf('\n') + 1) + 1;
      posEl.textContent = '行 ' + ln + '，欄 ' + col;
      countEl.textContent = Array.from(v.replace(/\n/g, '')).length + ' 個字元';
      zoomEl.textContent = zoom + '%';
    }
    function applyView(ta) {
      ta.style.fontSize = (14.67 * zoom / 100).toFixed(2) + 'px';
      ta.setAttribute('wrap', wrapOn ? 'soft' : 'off');
      ta.classList.toggle('is-nowrap', !wrapOn);
    }
    function applyViewAll() { tabs.forEach(function (t) { applyView(t.ta); }); updateStatus(); }
    function setZoom(z) { zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Math.round(z))); applyViewAll(); }
    function setStatusBar(on) { statusOn = !!on; status.hidden = !statusOn; }
    function setWrap(on) { wrapOn = !!on; applyViewAll(); }

    /* ---------------------------------------------------------- saving */
    function writeTo(t, p, text) {
      try { vfs.writeFile(p, text, { by: 'editor' }); }
      catch (e) { saveFailure(win, vfs.basename(p), text, e); return false; }
      t.path = p; t.saved = text; t.deleted = false; t.changedOnDisk = false;
      t.dirty = t.ta.value !== t.saved;
      paintTab(t);
      if (t === active) syncWindow();
      LAB.bus.emit('editor:save', { path: p, appId: 'textedit' });
      return true;
    }
    /* the Windows 「另存新檔」: file name defaults to untitled.txt, location is the desktop; built on LAB.ui.prompt (hooks sheet-input / sheet-button) */
    function saveAs(t) {
      t = t || active;
      if (!t) return Promise.resolve(false);
      return LAB.ui.prompt(win, {
        title: '另存新檔', text: '儲存位置：桌面（' + toWin(DESKTOP) + '）', value: t.path ? vfs.basename(t.path) : 'untitled.txt', ok: '儲存', cancel: '取消'
      }).then(function (name) {
        if (name === null || name === undefined) return false;
        name = String(name).trim();
        if (!name) return false;
        if (/[\\\/:*?"<>|]/.test(name)) {
          return sheet(win, '另存新檔', '檔案名稱不能包含下列任何字元：\\ / : * ? " < > |').then(function () { return false; });
        }
        if (!/\.[^./]+$/.test(name)) name += '.txt';
        try { vfs.checkName(name); }
        catch (e) { return sheet(win, '另存新檔', '這個檔案名稱不能用。').then(function () { return false; }); }
        var dest = vfs.join(DESKTOP, name);
        if (vfs.isDir(dest)) return sheet(win, '另存新檔', '桌面上已經有一個叫「' + name + '」的資料夾，請換一個檔案名稱。').then(function () { return false; });
        var go = function () { return writeTo(t, vfs.canon(dest), t.ta.value); };
        if (vfs.exists(dest)) {
          return LAB.ui.confirm(win, { title: '確認另存新檔', text: toWin(vfs.canon(dest)) + ' 已經存在。要取代它嗎？', ok: '是', cancel: '否' })
            .then(function (yes) { return yes ? go() : false; });
        }
        return go();
      });
    }
    function save(t) {
      t = t || active;
      if (!t) return Promise.resolve(false);
      if (!t.path) return saveAs(t);
      if (t.changedOnDisk && vfs.exists(t.path)) {
        // someone else (here: Codex or the Terminal) rewrote the file after it was opened
        var base = vfs.basename(t.path);
        return LAB.ui.alert(win, {
          title: '「' + base + '」在你開啟它之後，被其他程式改過了。',
          text: '要用你現在的版本取代它，還是放棄你的更動、重新讀取磁碟上的內容？',
          buttons: [
            { label: '取代', value: 'overwrite', 'default': true },
            { label: '重新讀取', value: 'revert' },
            { label: '取消', value: 'cancel', cancel: true }
          ]
        }).then(function (v) {
          if (v === 'overwrite') return writeTo(t, t.path, t.ta.value);
          if (v === 'revert') {
            var text = '';
            try { text = normNl(vfs.readFile(t.path)); } catch (err) { return false; }
            t.ta.value = text; t.saved = text; t.changedOnDisk = false;
            t.dirty = false; paintTab(t);
            if (t === active) { syncWindow(); updateStatus(); }
          }
          return false;
        });
      }
      return Promise.resolve(writeTo(t, t.path, t.ta.value));
    }

    /* ---------------------------------------------------------- closing */
    function askSave(t) {
      return LAB.ui.alert(win, {
        title: '要儲存對「' + baseName(t) + '」所做的變更嗎？', text: '',
        buttons: [{ label: '儲存', value: 'save', 'default': true }, { label: '不要儲存', value: 'discard' }, { label: '取消', value: 'cancel', cancel: true }]
      });
    }
    function closeTab(t) {
      if (!t.dirty) { removeTab(t); return; }
      if (asking) return;
      asking = true;
      activate(t, true);
      askSave(t).then(function (v) {
        asking = false;
        if (v === 'save') { save(t).then(function (ok) { if (ok) removeTab(t); }); }
        else if (v === 'discard') removeTab(t);
      });
    }
    function onClose() {
      var dirty = tabs.filter(function (t) { return t.dirty; });
      if (!dirty.length) return true;
      if (asking) return false;
      asking = true;
      var next = function (i) {
        if (i >= dirty.length) { asking = false; win.close(true); return; }
        activate(dirty[i], true);
        askSave(dirty[i]).then(function (v) {
          if (v === 'save') save(dirty[i]).then(function (ok) { if (ok) next(i + 1); else asking = false; });
          else if (v === 'discard') next(i + 1);
          else asking = false;
        });
      };
      next(0);
      return false;
    }

    /* ---------------------------------------------------------- the file changed (or moved) on disk */
    function onFs(e) {
      var changedTitle = false;
      tabs.forEach(function (t) {
        if (!t.path) return;
        if ((e.op === 'move' || e.op === 'rename') && e.from && vfs.isUnder(t.path, e.from)) {
          t.path = e.path + t.path.slice(e.from.length);
          t.deleted = !!e.trashed || vfs.isUnder(t.path, TRASH);
          paintTab(t);
          changedTitle = true;
          return;
        }
        if (!vfs.exists(t.path)) { if (!t.deleted) { t.deleted = true; paintTab(t); changedTitle = true; } return; }
        if (t.deleted) { t.deleted = false; paintTab(t); changedTitle = true; }
        if (t.dirty) {                                         // keep what the student typed, but remember the file changed underneath
          try { if (normNl(vfs.readFile(t.path)) !== t.saved) t.changedOnDisk = true; } catch (err0) { /* ignore */ }
          return;
        }
        var st = vfs.stat(t.path);
        if (!st || st.kind !== 'text') return;
        var text = '';
        try { text = normNl(vfs.readFile(t.path)); } catch (err) { return; }
        if (text !== t.ta.value) {
          var top = t.ta.scrollTop;
          t.ta.value = text;
          t.saved = t.ta.value;
          t.ta.scrollTop = top;
          if (t === active) updateStatus();
        }
      });
      if (changedTitle) syncWindow();
    }

    /* ---------------------------------------------------------- menus (Windows 11 flyouts, LAB.menu.contextMenu) */
    function exec(cmd) {
      if (!active) return;
      try { active.ta.focus({ preventScroll: true }); } catch (e) { active.ta.focus(); }
      try { document.execCommand(cmd); } catch (e2) { /* ignore */ }
    }
    function menuItems(idx) {
      var has = !!active;
      var sel = !!(active && active.ta.selectionStart !== active.ta.selectionEnd);
      if (idx === 0) {
        return [
          { label: '新增索引標籤', shortcut: 'Ctrl+N', action: function () { newTab(); } },
          { label: '開新視窗', shortcut: 'Ctrl+Shift+N', action: function () { createWindow(null); } },
          { label: '開啟…', shortcut: 'Ctrl+O', action: function () { toast('練習版沒有「開啟」對話方塊：請在檔案總管對檔案點兩下，用記事本開啟'); } },
          { separator: true },
          { label: '儲存', shortcut: 'Ctrl+S', enabled: has, action: function () { save(); } },
          { label: '另存新檔…', shortcut: 'Ctrl+Shift+S', enabled: has, action: function () { saveAs(); } },
          { separator: true },
          { label: '關閉索引標籤', shortcut: 'Ctrl+W', enabled: has, action: function () { if (active) closeTab(active); } },
          { label: '關閉視窗', shortcut: 'Ctrl+Shift+W', action: function () { win.close(); } }
        ];
      }
      if (idx === 1) {
        return [
          { label: '復原', shortcut: 'Ctrl+Z', enabled: has, action: function () { exec('undo'); } },
          { separator: true },
          { label: '剪下', shortcut: 'Ctrl+X', enabled: sel, action: function () { exec('cut'); } },
          { label: '複製', shortcut: 'Ctrl+C', enabled: sel, action: function () { exec('copy'); } },
          { label: '貼上', shortcut: 'Ctrl+V', enabled: has, action: function () { if (active) { active.ta.focus({ preventScroll: true }); pasteText(active.ta); } } },
          { label: '刪除', shortcut: 'Del', enabled: sel, action: function () { exec('delete'); } },
          { separator: true },
          { label: '全選', shortcut: 'Ctrl+A', enabled: has, action: function () { if (active) { active.ta.focus({ preventScroll: true }); active.ta.select(); } } }
        ];
      }
      return [
        { label: '縮放', submenu: [
          { label: '放大', shortcut: 'Ctrl+加號', enabled: zoom < ZOOM_MAX, action: function () { setZoom(zoom + ZOOM_STEP); } },
          { label: '縮小', shortcut: 'Ctrl+減號', enabled: zoom > ZOOM_MIN, action: function () { setZoom(zoom - ZOOM_STEP); } },
          { label: '還原預設縮放', shortcut: 'Ctrl+0', enabled: zoom !== 100, action: function () { setZoom(100); } }
        ] },
        { label: '狀態列', checked: statusOn, action: function () { setStatusBar(!statusOn); } },
        { label: '自動換行', checked: wrapOn, action: function () { setWrap(!wrapOn); } }
      ];
    }

    /* ---------------------------------------------------------- wiring */
    var ctl = {
      win: win, save: save, saveAs: saveAs, exec: exec, newTab: newTab,
      closeTab: function () { if (active) closeTab(active); },
      hasTab: function (p) { return !!findTabIn(tabs, p); },
      showPath: function (p) { var t = findTabIn(tabs, p); if (t) activate(t); return t; },
      addFile: function (p) { return newTab(p); },
      activePath: function () { return active && active.path ? active.path : ''; },
      activeTextarea: function () { return active ? active.ta : null; },
      tabCount: function () { return tabs.length; }
    };
    ctls.set(win.id, ctl);
    win.own(function () { ctls.delete(win.id); LAB.menu.closeAll(); });
    win.own(LAB.bus.on('fs:change', onFs));
    win.on('focus', function () { if (active) { try { active.ta.focus({ preventScroll: true }); } catch (e) { /* ignore */ } } });
    // when another window (or the desktop) takes over, let go of the keyboard so File Explorer shortcuts such as Enter and Delete work again
    win.on('blur', function () { var a = document.activeElement; if (a && a.tagName === 'TEXTAREA' && win.el.contains(a)) a.blur(); });

    newTab(path || null);
    if (path && active) { try { active.ta.setSelectionRange(0, 0); } catch (e) { /* ignore */ } }
    return win;
  }

  function findTabIn(list, path) {
    for (var i = 0; i < list.length; i++) if (list[i].path && vfs.same(list[i].path, path)) return list[i];
    return null;
  }

  /* a path that is already open in some tab: focus that window and show the tab */
  function findCtlFor(path) {
    var all = allCtls();
    for (var i = 0; i < all.length; i++) if (all[i].hasTab(path)) return all[i];
    return null;
  }

  function openFile(path, via) {
    var p = vfs.canon(path);
    var st = vfs.stat(p);
    if (!st) { toast('找不到這個檔案'); return null; }
    if (st.type !== 'file' || st.kind !== 'text') { toast('記事本打不開這種檔案（練習版）'); return null; }
    var c = findCtlFor(p);
    var win;
    if (c) { win = c.win; win.focus(); c.showPath(p); }
    else {
      // like the real Notepad: a file opened while Notepad is already running becomes a new tab of the window used last
      var lf = LAB.wm.lastFocused('textedit');
      var host = lf ? ctls.get(lf.id) : null;
      if (!host) { var all = allCtls(); host = all.length ? all[0] : null; }
      if (host) { win = host.win; win.focus(); host.addFile(p); }
      else win = createWindow(p);
    }
    LAB.bus.emit('editor:open', { path: p, appId: 'textedit', winId: win.id, via: via || 'open' });
    return win;
  }

  LAB.textedit = {
    openFile: openFile,
    newWindow: function () { return createWindow(null); },
    windows: function () { return LAB.wm.byApp('textedit').map(function (w) { return { winId: w.id, path: w.state.path || '' }; }); }
  };

  LAB.apps.register('textedit', {
    title: APP_NAME, en: 'Notepad', aliases: ['textedit', 'text', 'notepad', 'notepad.exe', '記事本'], icon: 'app-textedit', dock: true,
    open: function (args) {
      if (args && args.path) return openFile(args.path, args.via);
      return createWindow(null);
    },
    newWindow: function () { return createWindow(null); },
    canHandle: function (p) { var s = vfs.stat(p); return !!s && s.type === 'file' && s.kind === 'text'; },
    handleOpen: function (p, o) { return !!openFile(p, o && o.via); },
    canOpen: function (st) {
      if (!st || st.type !== 'file' || st.kind !== 'text') return 0;
      return TEXT_EXT[vfs.extname(st.name).toLowerCase()] ? 20 : 10;
    }
  });

  /* ---- keys: the app-scoped handlers only run while 記事本 is frontmost (ui.js routing). Ctrl+N / Ctrl+W / Ctrl+Shift+N belong to the browser on a
          real page and may never arrive; every one of them is also in the 檔案 menu. ---- */
  LAB.keys.on('mod+s', function () {
    var c = activeCtl();
    if (!c) return false;
    c.save();
  }, { scope: 'textedit' });
  LAB.keys.on('mod+shift+s', function () {
    var c = activeCtl();
    if (!c) return false;
    c.saveAs();
  }, { scope: 'textedit' });
  LAB.keys.on('mod+n', function () {
    var c = activeCtl();
    if (!c) return false;
    c.newTab();
  }, { scope: 'textedit' });
  LAB.keys.on('mod+shift+n', function () {
    if (!activeCtl()) return false;
    createWindow(null);
  }, { scope: 'textedit' });
  LAB.keys.on('mod+w', function () {
    var c = activeCtl();
    if (!c) return false;
    c.closeTab();
  }, { scope: 'textedit' });

  /* ============================================================ Quick Look (kept callable; the Windows lab does not use it) */
  var ql = null;            // {el, titleEl, bodyEl, path, off}

  function bigIcon(name) { return LAB.icons.el(name, { size: 96, cls: 'te-ql-icon' }); }

  function previewBody(path) {
    var st = vfs.stat(path);
    if (!st) {
      return h('div', { class: 'te-ql-msg' }, h('div', { class: 'te-ql-name' }, vfs.basename(path)), h('div', { class: 'te-ql-sub' }, '找不到這個項目'));
    }
    if (st.type === 'dir') {
      var n = 0;
      try { n = vfs.visible(vfs.list(st.path)).length; } catch (e) { n = 0; }
      return h('div', { class: 'te-ql-msg' }, bigIcon('folder'), h('div', { class: 'te-ql-name' }, vfs.displayName(st.path)), h('div', { class: 'te-ql-sub' }, n + ' 個項目'));
    }
    if (st.kind === 'text') {
      var txt = '';
      try { txt = normNl(vfs.readFile(st.path)); } catch (e2) { txt = ''; }
      var lines = txt.split('\n');
      if (lines.length && lines[lines.length - 1] === '') lines.pop();
      var more = lines.length > QL_MAX_LINES;
      var shown = lines.slice(0, QL_MAX_LINES).join('\n') + (more ? '\n…（練習版只顯示前 ' + QL_MAX_LINES + ' 行）' : '');
      return h('pre', { class: 'te-ql-text', dataset: { lab: 'ql-text' } }, shown);
    }
    return h('div', { class: 'te-ql-msg' }, bigIcon(LAB.icons.forNode(st)), h('div', { class: 'te-ql-name' }, st.name), h('div', { class: 'te-ql-sub' }, '練習版不支援預覽這種檔案'));
  }

  function qlTitle(path) {
    var st = vfs.stat(path);
    return st && st.type === 'dir' ? vfs.displayName(st.path) : vfs.basename(path);
  }

  function qlKey(e) {
    if (LAB.ui.isImeEnter(e)) return false;
    if (e.key === 'Escape') { qlHide(); return true; }
    if ((e.key === ' ' || e.code === 'Space') && !isEditableTarget(e.target)) { qlHide(); return true; }
    return false;
  }

  function qlFill(p) {
    ql.path = p;
    ql.titleEl.textContent = qlTitle(p);
    ql.bodyEl.textContent = '';
    ql.bodyEl.appendChild(previewBody(p));
    ql.el.setAttribute('aria-label', '預覽：' + qlTitle(p));
  }

  function qlShow(path) {
    var p = vfs.canon(path);
    if (!vfs.exists(p)) { toast('找不到這個項目'); return; }
    if (ql) { qlFill(p); return; }
    var host = document.getElementById('lab-overlays');
    if (!host) return;
    var xBtn = h('button', { type: 'button', class: 'te-ql-x', 'aria-label': '關閉預覽', dataset: { lab: 'ql-close' }, on: { click: function () { qlHide(); } } }, LAB.icons.el('x', { size: 11 }));
    var titleEl = h('div', { class: 'te-ql-title' });
    var bodyEl = h('div', { class: 'te-ql-body' });
    var el = h('div', { class: 'te-ql', role: 'dialog', dataset: { lab: 'ql' } }, h('div', { class: 'te-ql-bar' }, titleEl, xBtn), bodyEl);
    host.appendChild(el);
    ql = { el: el, titleEl: titleEl, bodyEl: bodyEl, path: p, off: LAB.keys.modal(qlKey) };
    qlFill(p);
    requestAnimationFrame(function () { if (ql && ql.el === el) el.classList.add('is-in'); });
    LAB.bus.emit('ql:show', { path: p });
  }

  function qlHide() {
    if (!ql) return;
    var q = ql;
    ql = null;
    if (q.off) q.off();
    q.el.classList.remove('is-in');
    setTimeout(function () { if (q.el.parentNode) q.el.parentNode.removeChild(q.el); }, 160);
    LAB.bus.emit('ql:hide', { path: q.path });
  }

  /* the open Quick Look follows the selection of File Explorer */
  LAB.bus.on('finder:select', function (e) {
    if (!ql || !e) return;
    var paths = e.paths || [];
    if (!paths.length) { qlHide(); return; }
    if (paths.length === 1 && !vfs.same(paths[0], ql.path) && vfs.exists(paths[0])) qlFill(vfs.canon(paths[0]));
  });

  /* switching to another app puts the preview away */
  LAB.bus.on('app:frontmost', function (e) { if (ql && e && e.appId !== 'finder') qlHide(); });

  LAB.quicklook = {
    show: qlShow,
    hide: qlHide,
    toggle: function (path) { if (ql) qlHide(); else if (path) qlShow(path); },
    isOpen: function () { return !!ql; },
    path: function () { return ql ? ql.path : ''; }
  };

  /* window form: the default app (apps.js defaultFor) for docx, pdf and other files that have no editor.
     Windows has no Quick Look; a real PC without Word or a PDF reader would offer an app store. The practice PC says so with a toast and opens no window. */
  function noViewerText(st) {
    var ext = st ? vfs.extname(st.name).toLowerCase() : '';
    if (ext === '.docx' || ext === '.doc') return '練習版沒有安裝 Word';
    if (ext === '.pdf') return '練習版沒有安裝 PDF 閱讀器';
    return '練習版沒有可以開啟這種檔案的程式';
  }
  function openQlWindow(path, via) {
    var p = vfs.canon(path);
    var st = vfs.stat(p);
    if (!st) { toast('找不到這個項目'); return null; }
    toast(noViewerText(st));
    LAB.bus.emit('editor:open', { path: p, appId: 'quicklook', winId: null, via: via || 'open' });
    return null;
  }

  LAB.apps.register('quicklook', {
    title: '預覽', en: 'Quick Look', aliases: [], icon: 'doc', dock: false,
    open: function (args) { if (args && args.path) return openQlWindow(args.path, args.via); toast('練習版沒有預覽功能'); return null; },
    canHandle: function (p) { return !!vfs.stat(p); },
    handleOpen: function (p, o) { openQlWindow(p, o && o.via); return true; },
    canOpen: function () { return 0; }       // never listed in 「開啟檔案」: the Windows lab has no Quick Look
  });
})(window.LAB);
