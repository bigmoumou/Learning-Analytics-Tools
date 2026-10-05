/* textedit.js — 文字編輯 (TextEdit) and Quick Look (DESIGN §4.3.1, §4.3.2). Owner EDITORS.
   Registers apps 'textedit' (replaces the CORE placeholder) and 'quicklook' (a non-Dock helper), plus LAB.textedit and LAB.quicklook.
   User data (file names, file contents) only ever goes through textContent or textarea.value, never innerHTML (§0.5). */
(function (LAB) {
  'use strict';

  var h = LAB.util.h;
  var vfs = LAB.vfs;
  var HOME = vfs.HOME;
  var DESKTOP = HOME + '/Desktop';
  var TRASH = HOME + '/.Trash';
  var TEXT_EXT = { '.md': 1, '.txt': 1, '.csv': 1, '.json': 1, '.log': 1 };
  var QL_MAX_LINES = 200;

  /* ------------------------------------------------------------ helpers */
  function normNl(s) { return String(s).replace(/\r\n?/g, '\n'); }
  function toast(t) { LAB.ui.toast(t); }
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

  function saveFailure(win, name, text, e) {
    var code = e && e.code;
    if (code === 'ENOSPC') {
      if (vfs.limits && vfs.utf8len(text) > vfs.limits.maxFile) return sheet(win, '這個檔案太大了：練習版每個檔案最多 200 KB。', '沒有儲存任何內容。');
      return sheet(win, '練習用的 Mac 儲存空間滿了。', '請刪除一些檔案再試一次。沒有儲存任何內容。');
    }
    return sheet(win, '無法儲存「' + name + '」。', code ? vfs.errText(code) : '發生了未知的錯誤。');
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

  /* ============================================================ TextEdit */
  var ctls = new Map();          // winId -> controller
  function activeCtl() {
    var w = LAB.wm.focused();
    return w && w.appId === 'textedit' ? (ctls.get(w.id) || null) : null;
  }
  function untitledName() {
    var used = {};
    ctls.forEach(function (c) { if (!c.state.path) used[c.state.name] = true; });
    if (!used['未命名']) return '未命名';
    for (var i = 2; i < 999; i++) { if (!used['未命名 ' + i]) return '未命名 ' + i; }
    return '未命名';
  }

  function createWindow(path) {
    var S = { path: path || null, saved: '', dirty: false, deleted: false, name: path ? '' : untitledName(), asking: false, changedOnDisk: false };
    var ta = h('textarea', {
      class: 'te-text', dataset: { lab: 'te-text' }, spellcheck: 'false', autocomplete: 'off', autocorrect: 'off', autocapitalize: 'off',
      'aria-label': '文件內容'
    });
    if (S.path) { try { ta.value = normNl(vfs.readFile(S.path, { by: 'editor' })); } catch (e) { ta.value = ''; } }
    S.saved = ta.value;
    var root = h('div', { class: 'te-root' }, ta);

    function titleOf() {
      var base = S.path ? vfs.basename(S.path) : S.name;
      if (S.deleted) return base + ' — 已被刪除';
      if (S.dirty) return base + ' — 已編輯';
      return base;
    }
    var win = LAB.wm.open({
      appId: 'textedit', title: titleOf(), width: 560, height: 420, bar: 'plain', theme: 'light', content: root,
      icon: 'app-textedit', minW: 320, minH: 200, onClose: onClose
    });

    function refresh() {
      S.dirty = ta.value !== S.saved;
      win.state.path = S.path || '';
      win.state.dirty = S.dirty;
      var t = titleOf();
      if (win.getTitle() !== t) win.setTitle(t);
    }

    function writeTo(p, text) {
      try { vfs.writeFile(p, text, { by: 'editor' }); }
      catch (e) { saveFailure(win, vfs.basename(p), text, e); return false; }
      S.path = p; S.saved = text; S.deleted = false; S.changedOnDisk = false;
      refresh();
      LAB.bus.emit('editor:save', { path: p, appId: 'textedit' });
      return true;
    }
    function saveAs() {
      return LAB.ui.prompt(win, { title: '儲存為', text: '儲存位置：桌面', value: 'untitled.txt', ok: '儲存', cancel: '取消' }).then(function (name) {
        if (name === null || name === undefined) return false;
        name = String(name).trim();
        if (!name) return false;
        if (!/\.[^./]+$/.test(name)) name += '.txt';
        try { vfs.checkName(name); }
        catch (e) { return sheet(win, '這個檔案名稱不能用。', '名稱不能是空的，也不能包含「/」。').then(function () { return false; }); }
        var dest = vfs.join(DESKTOP, name);
        if (vfs.isDir(dest)) return sheet(win, '已經有一個名稱為「' + name + '」的檔案夾存在於此位置。', '請換一個名稱。').then(function () { return false; });
        var go = function () {
          var ok = writeTo(vfs.canon(dest), ta.value);
          return ok;
        };
        if (vfs.exists(dest)) {
          return LAB.ui.confirm(win, { title: '「' + name + '」已經存在。您要取代它嗎？', text: '桌面上已有同名的檔案，取代後無法復原。', ok: '取代', cancel: '取消' })
            .then(function (yes) { return yes ? go() : false; });
        }
        return go();
      });
    }
    function save() {
      if (!S.path) return saveAs();
      if (S.changedOnDisk && vfs.exists(S.path)) {
        // like the real TextEdit: someone else (here: Codex or the Terminal) rewrote the file after it was opened
        var base = vfs.basename(S.path);
        return LAB.ui.alert(win, {
          title: '「' + base + '」在你打開它之後，被其他程式改過了。',
          text: '要用你現在的版本取代它，還是放棄你的更動、重新讀取磁碟上的內容？',
          buttons: [
            { label: '取消', value: 'cancel', cancel: true },
            { label: '重新讀取', value: 'revert' },
            { label: '取代', value: 'overwrite', 'default': true }
          ]
        }).then(function (v) {
          if (v === 'overwrite') return writeTo(S.path, ta.value);
          if (v === 'revert') {
            var text = '';
            try { text = normNl(vfs.readFile(S.path)); } catch (err) { return false; }
            ta.value = text; S.saved = text; S.changedOnDisk = false;
            refresh();
          }
          return false;
        });
      }
      return Promise.resolve(writeTo(S.path, ta.value));
    }

    function onClose() {
      if (!S.dirty) return true;
      if (S.asking) return false;
      S.asking = true;
      var base = S.path ? vfs.basename(S.path) : S.name;
      LAB.ui.alert(win, {
        title: '要儲存對「' + base + '」所做的更動嗎？', text: '如果不儲存，你的更動將會遺失。',
        buttons: [{ label: '不要儲存', value: 'discard' }, { label: '取消', value: 'cancel', cancel: true }, { label: '儲存', value: 'save', 'default': true }]
      }).then(function (v) {
        S.asking = false;
        if (v === 'save') { save().then(function (ok) { if (ok) win.close(true); }); }
        else if (v === 'discard') win.close(true);
      });
      return false;
    }

    /* the file changed (or moved) on disk */
    function onFs(e) {
      if (!S.path) return;
      if ((e.op === 'move' || e.op === 'rename') && e.from && vfs.isUnder(S.path, e.from)) {
        S.path = e.path + S.path.slice(e.from.length);
        S.deleted = !!e.trashed || vfs.isUnder(S.path, TRASH);
        refresh();
        return;
      }
      if (!vfs.exists(S.path)) { if (!S.deleted) { S.deleted = true; refresh(); } return; }
      if (S.deleted) { S.deleted = false; refresh(); }
      if (S.dirty) {                                         // keep what the student typed, but remember the file changed underneath
        try { if (normNl(vfs.readFile(S.path)) !== S.saved) S.changedOnDisk = true; } catch (err0) { /* ignore */ }
        return;
      }
      var st = vfs.stat(S.path);
      if (!st || st.kind !== 'text') return;
      var text = '';
      try { text = normNl(vfs.readFile(S.path)); } catch (err) { return; }
      if (text !== ta.value) {
        var top = ta.scrollTop;
        ta.value = text;
        S.saved = ta.value;
        ta.scrollTop = top;
        refresh();
      }
    }

    function exec(cmd) {
      try { ta.focus({ preventScroll: true }); } catch (e) { ta.focus(); }
      try { document.execCommand(cmd); } catch (e2) { /* ignore */ }
    }

    var ctl = {
      win: win, ta: ta, state: S, save: save, exec: exec,
      selectAll: function () { ta.focus({ preventScroll: true }); ta.select(); },
      paste: function () { ta.focus({ preventScroll: true }); pasteText(ta); }
    };
    ctls.set(win.id, ctl);
    win.own(function () { ctls.delete(win.id); });
    win.own(LAB.bus.on('fs:change', onFs));
    win.on('focus', function () { try { ta.focus({ preventScroll: true }); } catch (e) { /* ignore */ } });
    // when another window (or the desktop) takes over, let go of the keyboard so Finder shortcuts such as Space and Return work again
    win.on('blur', function () { if (document.activeElement === ta) ta.blur(); });

    ta.addEventListener('input', refresh);
    ta.addEventListener('keydown', function (e) {
      if (e.key === 'Tab' && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey && !LAB.ui.isImeEnter(e)) {
        e.preventDefault();
        insertText(ta, '\t');
      }
    });
    ta.addEventListener('paste', function (e) {
      e.preventDefault();
      var t = LAB.clipboard.forPaste(e);
      if (t) insertText(ta, normNl(t));
    });

    refresh();
    if (S.path) { try { ta.setSelectionRange(0, 0); } catch (e) { /* ignore */ } }
    try { ta.focus({ preventScroll: true }); } catch (e3) { ta.focus(); }
    return win;
  }

  function findWin(path) {
    var list = LAB.wm.byApp('textedit');
    for (var i = list.length - 1; i >= 0; i--) {
      var p = list[i].state.path;
      if (p && vfs.same(p, path)) return list[i];
    }
    return null;
  }

  function openFile(path, via) {
    var p = vfs.canon(path);
    var st = vfs.stat(p);
    if (!st) { toast('找不到這個檔案'); return null; }
    if (st.type !== 'file' || st.kind !== 'text') { toast('文字編輯打不開這種檔案（練習版）'); return null; }
    var win = findWin(p);
    if (win) win.focus(); else win = createWindow(p);
    LAB.bus.emit('editor:open', { path: p, appId: 'textedit', winId: win.id, via: via || 'open' });
    return win;
  }

  LAB.textedit = {
    openFile: openFile,
    newWindow: function () { return createWindow(null); },
    windows: function () { return LAB.wm.byApp('textedit').map(function (w) { return { winId: w.id, path: w.state.path || '' }; }); }
  };

  LAB.apps.register('textedit', {
    title: '文字編輯', en: 'TextEdit', aliases: ['textedit', 'text'], icon: 'app-textedit', dock: true,
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

  /* ---- keys: the app-scoped handler only runs while 文字編輯 is frontmost (ui.js routing) ---- */
  LAB.keys.on('mod+s', function () {
    var c = activeCtl();
    if (!c) return false;
    c.save();
  }, { scope: 'textedit' });

  /* ---- menus (§2.2, §4.3.1) ---- */
  LAB.menu.register('textedit', function () {
    var c = activeCtl();
    var has = !!c;
    var off = function (label, sc) { return { label: label, shortcut: sc, enabled: false }; };
    return [
      { label: '檔案', items: [
        { label: '新增', shortcut: '⌘N', action: function () { createWindow(null); } },
        off('打開⋯', '⌘O'),
        { separator: true },
        { label: '關閉', shortcut: '⌘W', enabled: has, action: function () { if (c) c.win.close(); } },
        { label: '儲存', shortcut: '⌘S', enabled: has, action: function () { if (c) c.save(); } }
      ] },
      { label: '編輯', items: [
        { label: '還原', shortcut: '⌘Z', enabled: has, action: function () { if (c) c.exec('undo'); } },
        { label: '重做', shortcut: '⇧⌘Z', enabled: has, action: function () { if (c) c.exec('redo'); } },
        { separator: true },
        { label: '剪下', shortcut: '⌘X', enabled: has, action: function () { if (c) c.exec('cut'); } },
        { label: '拷貝', shortcut: '⌘C', enabled: has, action: function () { if (c) c.exec('copy'); } },
        { label: '貼上', shortcut: '⌘V', enabled: has, action: function () { if (c) c.paste(); } },
        { separator: true },
        { label: '全選', shortcut: '⌘A', enabled: has, action: function () { if (c) c.selectAll(); } }
      ] },
      { label: '格式', items: [off('字體'), off('文字'), { separator: true }, off('製作純文字', '⇧⌘T')] },
      { label: '顯示方式', items: [off('顯示標尺', '⌘R'), off('放大'), off('縮小')] },
      { label: '視窗', items: LAB.menu.windowMenu(false) },
      { label: '輔助說明', items: [{ label: '關於這個練習', action: function () { LAB.apps.launch('about', { tab: 'about' }); } }] }
    ];
  });

  /* ============================================================ Quick Look */
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
    ql.el.setAttribute('aria-label', '快速查看：' + qlTitle(p));
  }

  function qlShow(path) {
    var p = vfs.canon(path);
    if (!vfs.exists(p)) { toast('找不到這個項目'); return; }
    if (ql) { qlFill(p); return; }
    var host = document.getElementById('lab-overlays');
    if (!host) return;
    var xBtn = h('button', { type: 'button', class: 'te-ql-x', 'aria-label': '關閉快速查看', dataset: { lab: 'ql-close' }, on: { click: function () { qlHide(); } } }, LAB.icons.el('x', { size: 11 }));
    var titleEl = h('div', { class: 'te-ql-title' });
    var bodyEl = h('div', { class: 'te-ql-body' });
    var el = h('div', { class: 'te-ql', role: 'dialog', dataset: { lab: 'ql' } }, h('div', { class: 'te-ql-bar' }, xBtn, titleEl), bodyEl);
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

  /* the open Quick Look follows the Finder selection, like the real one */
  LAB.bus.on('finder:select', function (e) {
    if (!ql || !e) return;
    var paths = e.paths || [];
    if (!paths.length) { qlHide(); return; }
    if (paths.length === 1 && !vfs.same(paths[0], ql.path) && vfs.exists(paths[0])) qlFill(vfs.canon(paths[0]));
  });

  /* switching to another app (for example the double-click that opens TextEdit) puts the preview away */
  LAB.bus.on('app:frontmost', function (e) { if (ql && e && e.appId !== 'finder') qlHide(); });

  LAB.quicklook = {
    show: qlShow,
    hide: qlHide,
    toggle: function (path) { if (ql) qlHide(); else if (path) qlShow(path); },
    isOpen: function () { return !!ql; },
    path: function () { return ql ? ql.path : ''; }
  };

  /* window form: the default app for docx, pdf, zip and other files that have no editor */
  function openQlWindow(path, via) {
    var p = vfs.canon(path);
    var st = vfs.stat(p);
    if (!st) { toast('找不到這個項目'); return null; }
    var name = qlTitle(p);
    var existing = null;
    LAB.wm.byApp('quicklook').forEach(function (w) { if (w.state.path && vfs.same(w.state.path, p)) existing = w; });
    var win = existing;
    if (win) win.focus();
    else {
      win = LAB.wm.open({
        appId: 'quicklook', title: name, width: 520, height: 380, bar: 'plain', theme: 'light', icon: 'doc', minW: 320, minH: 220,
        content: h('div', { class: 'te-qlwin', dataset: { lab: 'ql-window' } }, previewBody(p))
      });
      win.state.path = p;
      win.state.dirty = false;
    }
    LAB.bus.emit('editor:open', { path: p, appId: 'quicklook', winId: win.id, via: via || 'open' });
    return win;
  }

  LAB.apps.register('quicklook', {
    title: '快速查看', en: 'Quick Look', aliases: [], icon: 'doc', dock: false,
    open: function (args) { if (args && args.path) return openQlWindow(args.path, args.via); toast('請從 Finder 選一個檔案，按空白鍵快速查看'); return null; },
    canHandle: function (p) { return !!vfs.stat(p); },
    handleOpen: function (p, o) { return !!openQlWindow(p, o && o.via); },
    canOpen: function (st) { return st && st.type === 'file' ? 5 : 0; }
  });

  /* the window form of Quick Look also closes with Esc or Space (the overlay form is handled by qlKey above) */
  function closeFrontQlWindow() {
    var w = LAB.wm.focused();
    if (!w || w.appId !== 'quicklook') return false;
    w.close();
    return true;
  }
  LAB.keys.on('escape', closeFrontQlWindow, { scope: 'quicklook' });
  LAB.keys.on('space', closeFrontQlWindow, { scope: 'quicklook' });

  LAB.menu.register('quicklook', function () {
    return [{ label: '視窗', items: LAB.menu.windowMenu(false) }];
  });
})(window.LAB);
