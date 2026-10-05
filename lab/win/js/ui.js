/* ui.js [SKIN] — LAB.ui (toast, Fluent dialogs, confirm, prompt, IME helper) and LAB.keys (shortcut router). M§3.8, DESIGN W3.
   Windows: Ctrl is the command key (LAB.keys.mod = ctrl or meta); toasts look like Windows notifications at the bottom right above the taskbar;
   alerts are ContentDialogs (white, 8 px radius, a #f3f3f3 footer band with the buttons). */
(function (LAB) {
  'use strict';

  var h = LAB.util.h;
  var ui = {};
  var keys = {};

  /* -------------------------------------------------------------- IME helper */
  var lastCompositionEnd = -1000;
  window.addEventListener('compositionend', function () { lastCompositionEnd = performance.now(); }, true);
  ui.isImeEnter = function (e) {
    return !!(e.isComposing || e.keyCode === 229 || (performance.now() - lastCompositionEnd < 30));
  };

  function overlays() { return document.getElementById('lab-overlays'); }
  function reducedMotion() {
    try { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  }

  /* ------------------------------------------------------------------- toast
     A Windows notification: a small dark card at the bottom right above the taskbar, newest at the bottom. The muted caption
     「練習用的電腦」 is drawn by CSS (::before), so the element's text is exactly the message. */
  var toasts = [];
  ui.toast = function (text, o) {
    o = o || {};
    var host = overlays();
    if (!host) return;
    var box = host.querySelector('.lab-toasts');
    if (!box) { box = h('div', { class: 'lab-toasts' }); host.appendChild(box); }
    var el = h('div', { class: 'lab-toast', role: 'status', dataset: { lab: 'toast' } }, String(text));
    box.appendChild(el);
    toasts.push(el);
    while (toasts.length > 2) { var old = toasts.shift(); if (old.parentNode) old.parentNode.removeChild(old); }
    requestAnimationFrame(function () { el.classList.add('is-in'); });
    var ms = o.ms || 3600;
    setTimeout(function () {
      el.classList.remove('is-in');
      setTimeout(function () {
        if (el.parentNode) el.parentNode.removeChild(el);
        var i = toasts.indexOf(el);
        if (i >= 0) toasts.splice(i, 1);
      }, 220);
    }, ms);
  };

  /* ------------------------------------------------------------ key routing */
  var handlers = [];
  var modalStack = [];

  function parseSpec(spec) {
    var parts = String(spec).toLowerCase().split('+');
    var o = { mod: false, shift: false, alt: false, ctrl: false, key: '' };
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      if (p === 'mod' || p === 'cmd' || p === 'meta') o.mod = true;
      else if (p === 'shift') o.shift = true;
      else if (p === 'alt' || p === 'opt') o.alt = true;
      else if (p === 'ctrl') o.ctrl = true;
      else o.key = p === '' ? '+' : p;
    }
    return o;
  }
  var CODE_KEYS = { Backquote: '`', BracketLeft: '[', BracketRight: ']', Period: '.', Comma: ',', Minus: '-', Equal: '=', Slash: '/', Backslash: '\\', Semicolon: ';', Quote: "'" };
  function keyName(e) {
    var k = e.key || '';
    if (k.length === 1 && /[a-zA-Z0-9]/.test(k)) return k.toLowerCase();
    if (e.code) {
      var m = /^Key([A-Z])$/.exec(e.code);
      if (m) return m[1].toLowerCase();
      m = /^Digit(\d)$/.exec(e.code);
      if (m) return m[1];
      if (CODE_KEYS[e.code]) return CODE_KEYS[e.code];
    }
    k = k.toLowerCase();
    if (k === ' ') return 'space';
    if (k === 'esc') return 'escape';
    return k;
  }
  keys.mod = function (e) { return !!(e.metaKey || e.ctrlKey); };
  keys.keyName = keyName;
  keys.on = function (spec, fn, o) {
    var item = { spec: parseSpec(spec), fn: fn, scope: (o && o.scope) || 'global' };
    handlers.push(item);
    return function () { var i = handlers.indexOf(item); if (i >= 0) handlers.splice(i, 1); };
  };
  /* A modal layer (menu, spotlight, sheet, quick look): fn(e) returns true when it consumed the key. The top layer sees keys first. */
  keys.modal = function (fn) {
    modalStack.push(fn);
    return function () { var i = modalStack.indexOf(fn); if (i >= 0) modalStack.splice(i, 1); };
  };
  keys.hasModal = function () { return modalStack.length > 0; };

  function isEditable(t) {
    if (!t || !t.tagName) return false;
    var tag = t.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable === true;
  }
  var EDIT_KEYS = { a: 1, c: 1, v: 1, x: 1, z: 1, y: 1 };

  function matches(item, e, modActive, kn) {
    var s = item.spec;
    if (s.key !== kn) return false;
    if (s.mod !== modActive) return false;
    if (s.shift !== !!e.shiftKey) return false;
    if (s.alt !== !!e.altKey) return false;
    if (s.ctrl !== (!!e.ctrlKey && !modActive)) return false;
    if (!s.mod && !s.ctrl && e.ctrlKey && !modActive) return false;
    return true;
  }

  function onKeyDown(e) {
    // modal layers first (they handle Esc/Return/arrows/Tab themselves)
    if (modalStack.length) {
      var top = modalStack[modalStack.length - 1];
      var consumed = false;
      try { consumed = !!top(e); } catch (err) { console.error(err); }
      if (consumed) { e.preventDefault(); e.stopPropagation(); return; }
      // a modal layer swallows everything that is not editing input
      if (!isEditable(e.target) && (e.key === 'Escape' || e.key === 'Enter')) return;
    }
    if (ui.isImeEnter(e)) return;
    var kn = keyName(e);
    // never touch the browser's own dev/reload keys (F5 reload, F11 full screen, F12 tools ...); F2 (rename), F3, F4, F6 reach the apps
    if (/^f\d+$/.test(kn) && !/^f(2|3|4|6)$/.test(kn)) return;
    if ((e.ctrlKey || e.metaKey) && kn === 'r' && !e.altKey) return;
    if (e.ctrlKey && e.shiftKey && (kn === 'i' || kn === 'j' || kn === 'c')) return;

    var front = LAB.wm ? LAB.wm.frontmostApp() : 'finder';
    var ctrlOnly = !!e.ctrlKey && !e.metaKey;
    var spaceExc = ctrlOnly && kn === 'space';
    var skipCtrl = front === 'terminal' && ctrlOnly && !spaceExc;      // DESIGN §3.8 Terminal rule
    var modActive = !!e.metaKey || (!!e.ctrlKey && !skipCtrl);
    if (skipCtrl) return;                                              // the Terminal edits the line itself

    var editable = isEditable(e.target);
    if (editable && (!modActive || EDIT_KEYS[kn]) && !spaceExc) return;

    var i, item;
    for (i = 0; i < handlers.length; i++) {
      item = handlers[i];
      if (item.scope === 'global' || item.scope !== front) continue;
      if (matches(item, e, modActive, kn)) {
        var r = item.fn(e);
        if (r !== false) { e.preventDefault(); e.stopPropagation(); return; }
      }
    }
    for (i = 0; i < handlers.length; i++) {
      item = handlers[i];
      if (item.scope !== 'global') continue;
      if (matches(item, e, modActive, kn)) {
        var r2 = item.fn(e);
        if (r2 !== false) { e.preventDefault(); e.stopPropagation(); return; }
      }
    }
  }
  window.addEventListener('keydown', onKeyDown, true);

  LAB.ready(function () {
    // global shortcuts (W3: Ctrl is the command key; the browser keeps Ctrl+W / Ctrl+T / Ctrl+N / Alt+F4 for itself on most PCs, so every one of
    // these also has a button: the caption buttons, the taskbar and its menus)
    keys.on('mod+space', function () { if (LAB.desktop) LAB.desktop.toggleSpotlight(); });
    keys.on('mod+escape', function () { if (LAB.desktop && LAB.desktop.toggleStart) LAB.desktop.toggleStart(); else return false; });
    keys.on('mod+w', function () {
      var w = LAB.wm.focused();
      if (!w) return false;
      LAB.wm.close(w.id);
    });
    keys.on('alt+f4', function () {
      var w = LAB.wm.focused();
      if (!w) return false;
      LAB.wm.close(w.id);
    });
    keys.on('mod+m', function () {
      var w = LAB.wm.focused();
      if (!w) return false;
      LAB.wm.minimize(w.id);
    });
    keys.on('mod+z', function () { if (!LAB.undo.peek()) return false; LAB.undo.run(); }, { scope: 'finder' });
    keys.on('mod+n', function () {
      var a = LAB.wm.frontmostApp();
      var def = LAB.apps.get(a);
      if (!def) return false;
      if (typeof def.newWindow === 'function') def.newWindow();
      else if (a === 'finder' || a === 'terminal') def.open({});
      else return false;
    });
  }, 40);

  /* ---------------------------------------------------------- alert sheets */
  var sheetCounter = 0;

  ui.alert = function (win, spec) {
    return new Promise(function (resolve) {
      var buttons = (spec.buttons && spec.buttons.length) ? spec.buttons : [{ label: '確定', value: true, 'default': true }];
      var prev = document.activeElement;
      var attached = win && win.el && win.el.parentNode;
      var host = attached ? win.el : overlays();
      var titleId = 'lab-sheet-t' + (++sheetCounter);
      var inputEl = null;
      var done = false;
      var offModal = null, offClose = null;

      // Windows puts the default (primary) button first and the cancel button last; callers list them in the Mac order (cancel first, default last)
      var shown = buttons.slice();
      if (shown.length > 1) {
        var defB = null, canB = null, restB = [];
        shown.forEach(function (b) { if (b['default'] && !defB) defB = b; else if (b.cancel && !canB) canB = b; else restB.push(b); });
        shown = (defB ? [defB] : []).concat(restB, canB ? [canB] : []);
      }
      var btnEls = shown.map(function (b) {
        return h('button', {
          type: 'button', class: 'lab-sheet-btn' + (b['default'] ? ' is-default' : '') + (b.danger ? ' is-danger' : ''),
          dataset: { lab: 'sheet-button', value: String(b.value) },
          on: { click: function () { finish(b); } }
        }, b.label);
      });
      if (spec.input) {
        inputEl = h('input', { type: 'text', class: 'lab-sheet-input', 'aria-label': spec.title || '', dataset: { lab: 'sheet-input' }, spellcheck: 'false', autocomplete: 'off' });
        inputEl.value = spec.input.value || '';
      }
      var panel = h('div', { class: 'lab-sheet', role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': titleId },
        h('div', { class: 'lab-sheet-title', id: titleId }, spec.title || ''),
        spec.text ? h('div', { class: 'lab-sheet-text' }, spec.text) : null,
        inputEl,
        h('div', { class: 'lab-sheet-btns' }, btnEls)
      );
      var scrim = h('div', { class: 'lab-sheet-scrim' + (attached ? ' is-window' : ' is-stage') }, panel);
      if (attached) panel.classList.add('is-attached'); else panel.classList.add('is-centered');
      host.appendChild(scrim);
      requestAnimationFrame(function () { scrim.classList.add('is-in'); });

      function defaultBtn() { for (var i = 0; i < buttons.length; i++) if (buttons[i]['default']) return buttons[i]; return buttons[buttons.length - 1]; }
      function cancelBtn() { for (var i = 0; i < buttons.length; i++) if (buttons[i].cancel) return buttons[i]; return null; }

      function finish(b) {
        if (done) return;
        done = true;
        if (offModal) offModal();
        if (offClose) offClose();
        scrim.classList.remove('is-in');
        var val = b ? b.value : null;
        var inputVal = inputEl ? inputEl.value : null;
        setTimeout(function () { if (scrim.parentNode) scrim.parentNode.removeChild(scrim); }, reducedMotion() ? 0 : 160);
        try { if (prev && prev.focus && document.contains(prev)) prev.focus(); } catch (e) { /* ignore */ }
        resolve(spec.input ? { value: val, text: inputVal } : val);
      }

      offModal = keys.modal(function (e) {
        if (e.key === 'Tab') {
          var f = [].slice.call(panel.querySelectorAll('input,button'));
          if (!f.length) return true;
          var i = f.indexOf(document.activeElement);
          var n = e.shiftKey ? (i <= 0 ? f.length - 1 : i - 1) : (i === f.length - 1 ? 0 : i + 1);
          f[n].focus();
          return true;
        }
        if (ui.isImeEnter(e)) return false;
        if (e.key === 'Escape') { var c = cancelBtn(); finish(c); return true; }
        if (e.key === 'Enter') {
          var t = document.activeElement;
          if (t && t.tagName === 'BUTTON' && panel.contains(t) && !t.classList.contains('is-default')) return false;   // let the focused button click
          finish(defaultBtn());
          return true;
        }
        return false;
      });
      if (win && win.on) offClose = win.on('close', function () { finish(cancelBtn()); });

      // focus: the input if any, else the default button
      setTimeout(function () {
        if (inputEl) { inputEl.focus(); inputEl.select(); }
        else {
          var di = shown.indexOf(defaultBtn());
          if (btnEls[di]) btnEls[di].focus();
        }
      }, 0);
    });
  };

  ui.confirm = function (win, o) {
    return ui.alert(win, {
      title: o.title, text: o.text,
      buttons: [
        { label: o.cancel || '取消', value: false, cancel: true },
        { label: o.ok || '確定', value: true, 'default': true, danger: !!o.danger }
      ]
    }).then(function (v) { return v === true; });
  };

  ui.prompt = function (win, o) {
    return ui.alert(win, {
      title: o.title, text: o.text, input: { value: o.value || '' },
      buttons: [
        { label: o.cancel || '取消', value: 'cancel', cancel: true },
        { label: o.ok || '確定', value: 'ok', 'default': true }
      ]
    }).then(function (r) { return r && r.value === 'ok' ? r.text : null; });
  };

  /* A tiny undo stack for Finder / desktop file moves (Ctrl+Z). */
  LAB.undo = (function () {
    var stack = [];
    return {
      push: function (label, fn) { stack.push({ label: label, fn: fn }); if (stack.length > 30) stack.shift(); },
      peek: function () { return stack.length ? stack[stack.length - 1] : null; },
      run: function () {
        var e = stack.pop();
        if (!e) return false;
        try { e.fn(); } catch (err) { ui.toast('這個動作沒辦法還原'); }
        return true;
      },
      clear: function () { stack.length = 0; }
    };
  })();

  /* A file operation was refused. The folders Windows needs (桌面、文件、下載 …) get a dialog like the real one; anything else is a short toast. */
  ui.vfsFail = function (win, e, fallbackText, path) {
    var code = e && e.code;
    if (code === 'EPROTECTED') {
      var p = path || (e && e.path) || '';
      var name = (LAB.win && LAB.win.displayName) ? LAB.win.displayName(p) : LAB.vfs.displayName(p);
      ui.alert(win, {
        title: '資料夾存取被拒',
        text: '「' + name + '」是 Windows 需要的資料夾，不能刪除、改名或搬走。練習用的電腦和真的 Windows 一樣，會保護系統用的資料夾。',
        buttons: [{ label: '確定', value: true, 'default': true }]
      });
      return;
    }
    if (code === 'EACCES') { ui.toast('這裡不能新增東西（沒有權限）'); return; }
    ui.toast(fallbackText || '這個操作沒有成功');
  };

  ui.contextMenu = function (x, y, items, opts) { return LAB.menu.contextMenu(x, y, items, opts); };

  LAB.ui = ui;
  LAB.keys = keys;
})(window.LAB);
