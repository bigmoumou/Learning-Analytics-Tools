/* menu.js [SKIN] — LAB.menu: menu bar (left side), pop-up menus, context menus (DESIGN §2.2, §3.9). */
(function (LAB) {
  'use strict';

  var h = LAB.util.h;
  var menu = {};
  var registry = new Map();          // appId -> fn() -> [{label, items}]
  var leftEl = null;
  var stack = [];                    // open popups: {el, level, items, itemEls}
  var barTitles = [];                // title buttons of the current bar
  var openIndex = -1;                // which bar title is open (-1 = none / context menu)
  var offModal = null;
  var prevFocus = null;
  var onCloseCb = null;
  var lastSig = '';
  var subTimer = null;

  menu.register = function (appId, fn) { registry.set(appId, fn); };

  /* The glyph at the far left of the menu bar: our own drawing of a plain apple (body, bite, leaf), not Apple's artwork file.
     It opens the practice menu (about, shortcuts, progress code, reset). */
  LAB.icons.add('apple-mark', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="2.4 2.4 19.2 19.2">' +
    '<path fill="currentColor" d="M12 8.5C11 7.7 9.4 7.3 8 7.9C5.6 8.9 4.4 11.7 5 14.7C5.6 17.7 7.6 21 9.6 21C10.6 21 11.2 20.4 12 20.4C12.8 20.4 13.4 21 14.5 21C16.1 21 17.7 18.6 18.8 16.2C17.4 15.5 16.3 14.2 16.3 12.6C16.3 11.1 17.1 9.9 18.2 9.2C17.3 7.9 15.9 7.2 14.5 7.3C13.6 7.4 12.7 8.1 12 8.5ZM12.7 6.4C12.7 5 13.6 3.6 15.1 3C15.2 4.5 14.3 6 12.7 6.4Z"/></svg>');

  function overlays() { return document.getElementById('lab-overlays'); }
  function evalFlag(v, dflt) {
    if (typeof v === 'function') { try { return !!v(); } catch (e) { return dflt; } }
    return v === undefined ? dflt : !!v;
  }

  /* shared 視窗 menu body, apps may reuse it (english=true for Codex) */
  menu.windowMenu = function (english) {
    var front = LAB.wm.frontmostApp();
    var focused = LAB.wm.focused();
    var items = [
      { label: english ? 'Minimize' : '最小化', shortcut: '⌘M', enabled: !!focused, action: function () { if (focused) focused.minimize(); } },
      { label: english ? 'Zoom' : '縮放', enabled: !!focused, action: function () { if (focused) focused.zoom(); } },
      { separator: true },
      { label: english ? 'Bring All to Front' : '將所有視窗移到最前', enabled: false }
    ];
    var ws = LAB.wm.byApp(front);
    if (ws.length) {
      items.push({ separator: true });
      ws.slice().reverse().forEach(function (w) {
        items.push({ label: w.getTitle() || '（未命名）', checked: focused === w, action: function () { w.focus(); } });
      });
    }
    return items;
  };

  function appName(appId) {
    var def = LAB.apps.get(appId);
    return def ? def.title : appId;
  }
  function appNameMenu(appId) {
    var name = appName(appId);
    var finder = appId === 'finder';
    return [
      { label: '關於 ' + name, action: function () { LAB.apps.launch('about', { tab: 'about' }); } },
      { separator: true },
      { label: '設定⋯', enabled: false },
      { separator: true },
      { label: '隱藏 ' + name, shortcut: '⌘H', action: function () { LAB.wm.hideApp(appId); } },
      { label: '隱藏其他', enabled: false },
      { label: '全部顯示', enabled: false },
      { separator: true },
      { label: '結束 ' + name, shortcut: '⌘Q', enabled: !finder, action: function () { LAB.apps.quit(appId); } }
    ];
  }
  function practiceMenu() {
    return [
      { label: '關於這個練習…', action: function () { LAB.apps.launch('about', { tab: 'about' }); } },
      { label: '快速鍵一覽…', action: function () { LAB.apps.launch('about', { tab: 'keys' }); } },
      { label: '進度代碼…', action: function () { LAB.apps.launch('about', { tab: 'progress' }); } },
      { label: '重設全部…', action: function () {
        LAB.ui.confirm(null, { title: '要重設全部嗎？', text: '這會清除你在這個練習裡建立的檔案、對話和任務進度，無法復原。', ok: '重設', cancel: '取消', danger: true })
          .then(function (ok) { if (ok) LAB.store.reset('all'); });
      } },
      { separator: true },
      { label: '回到課程 Week 3', action: function () { window.location.href = '../../weeks/week03/'; } }
    ];
  }

  function currentMenus() {
    var front = LAB.wm.frontmostApp();
    var fn = registry.get(front);
    var list = [];
    if (fn) { try { list = fn() || []; } catch (e) { console.error(e); list = []; } }
    return { front: front, name: appName(front), menus: list };
  }

  /* ------------------------------------------------------------ bar */
  menu.mount = function (el) {
    leftEl = el;
    el.setAttribute('role', 'menubar');
    el.setAttribute('aria-label', '選單列');
    menu.refresh(true);
  };

  menu.refresh = function (force) {
    if (!leftEl) return;
    var cm = currentMenus();
    var sig = cm.front + '|' + cm.name + '|' + cm.menus.map(function (m) { return m.label; }).join(',');
    if (!force && sig === lastSig) return;
    lastSig = sig;
    if (openIndex >= 0) menu.closeAll();
    leftEl.textContent = '';
    barTitles = [];
    var titles = [];
    titles.push({ kind: 'practice', node: h('span', { class: 'lab-mb-mark', 'aria-hidden': 'true' }), label: '練習', aria: '練習選單', cls: 'lab-mb-markbtn' });
    titles[0].node.innerHTML = LAB.icons.get('apple-mark', { size: 18 });
    titles.push({ kind: 'app', label: cm.name, cls: 'lab-mb-app' });
    cm.menus.forEach(function (m, i) { titles.push({ kind: 'menu', index: i, label: m.label, cls: 'lab-mb-menu' }); });
    titles.forEach(function (t, idx) {
      var btn = h('button', {
        type: 'button', class: 'lab-mb-title ' + (t.cls || ''), role: 'menuitem', 'aria-haspopup': 'menu', 'aria-expanded': 'false',
        'aria-label': t.aria || t.label, dataset: { lab: 'menu-title', menu: t.kind === 'menu' ? String(t.index) : t.kind },
        on: {
          click: function (e) { e.stopPropagation(); if (openIndex === idx) menu.closeAll(); else openBar(idx); },
          mouseenter: function () { if (openIndex >= 0 && openIndex !== idx) openBar(idx); }
        }
      }, t.node || t.label);
      barTitles.push({ btn: btn, spec: t });
      leftEl.appendChild(btn);
    });
  };

  function itemsFor(idx) {
    var t = barTitles[idx].spec;
    var front = LAB.wm.frontmostApp();
    if (t.kind === 'practice') return practiceMenu();
    if (t.kind === 'app') return appNameMenu(front);
    var cm = currentMenus();
    return (cm.menus[t.index] && cm.menus[t.index].items) || [];
  }

  function openBar(idx) {
    closePopups();
    if (idx < 0 || idx >= barTitles.length) return;
    if (openIndex < 0) prevFocus = document.activeElement;
    openIndex = idx;
    barTitles.forEach(function (b, i) { b.btn.setAttribute('aria-expanded', i === idx ? 'true' : 'false'); b.btn.classList.toggle('is-open', i === idx); });
    var r = LAB.stage.rectOf(barTitles[idx].btn);
    showPopup(itemsFor(idx), r.x, r.y + r.h, 0);
    attachGlobal();
  }

  /* ---------------------------------------------------------- popups */
  function closePopups() {
    if (subTimer) { clearTimeout(subTimer); subTimer = null; }
    stack.forEach(function (p) { if (p.el.parentNode) p.el.parentNode.removeChild(p.el); });
    stack = [];
  }

  menu.closeAll = function () {
    var was = stack.length > 0 || openIndex >= 0;
    closePopups();
    barTitles.forEach(function (b) { b.btn.setAttribute('aria-expanded', 'false'); b.btn.classList.remove('is-open'); });
    openIndex = -1;
    detachGlobal();
    if (was) {
      try { if (prevFocus && prevFocus.focus && document.contains(prevFocus)) prevFocus.focus(); } catch (e) { /* ignore */ }
      var cb = onCloseCb; onCloseCb = null;
      if (cb) { try { cb(); } catch (e2) { console.error(e2); } }
    }
    prevFocus = null;
  };
  menu.isOpen = function () { return stack.length > 0; };

  function showPopup(items, x, y, level, parentItemEl) {
    // close deeper levels first
    while (stack.length > level) { var p = stack.pop(); if (p.el.parentNode) p.el.parentNode.removeChild(p.el); }
    var itemEls = [];
    var el = h('div', { class: 'lab-menu' + (level ? ' is-sub' : ''), role: 'menu', tabindex: '-1' });
    items.forEach(function (it) {
      if (it.separator) { el.appendChild(h('div', { class: 'lab-mi-sep', role: 'separator' })); return; }
      var enabled = evalFlag(it.enabled, true) && !(it.submenu && !it.submenu.length);
      var checked = evalFlag(it.checked, false);
      var row = h('div', {
        class: 'lab-mi' + (enabled ? '' : ' is-disabled') + (it.submenu ? ' has-sub' : ''), role: 'menuitem', tabindex: '-1',
        'aria-disabled': enabled ? null : 'true', dataset: { lab: 'menu-item' }
      },
        h('span', { class: 'lab-mi-check', 'aria-hidden': 'true' }, checked ? '✓' : ''),
        h('span', { class: 'lab-mi-label' }, it.label),
        it.shortcut ? h('span', { class: 'lab-mi-sc' }, it.shortcut) : null,
        it.submenu ? h('span', { class: 'lab-mi-arrow', 'aria-hidden': 'true' }, '›') : null
      );
      var rec = { el: row, item: it, enabled: enabled };
      itemEls.push(rec);
      row.addEventListener('mouseenter', function () {
        highlight(level, rec);
        if (subTimer) { clearTimeout(subTimer); subTimer = null; }
        if (it.submenu && enabled) {
          subTimer = setTimeout(function () { openSub(level, rec); }, 120);
        } else {
          while (stack.length > level + 1) { var q = stack.pop(); if (q.el.parentNode) q.el.parentNode.removeChild(q.el); }
        }
      });
      row.addEventListener('click', function (e) {
        e.stopPropagation();
        if (!enabled) return;
        if (it.submenu) { openSub(level, rec); return; }
        run(it);
      });
      el.appendChild(row);
    });
    var host = overlays();
    host.appendChild(el);
    // position and keep inside the stage
    var st = LAB.stage;
    var w = el.offsetWidth, hh = el.offsetHeight;
    var nx = Math.max(4, Math.min(x, st.w - w - 4));
    var ny = Math.max(LAB.stage.menubarH, Math.min(y, st.h - hh - 4));
    if (parentItemEl && x + w > st.w - 4) {
      // flip the submenu to the left of its parent
      var pr = LAB.stage.rectOf(parentItemEl);
      nx = Math.max(4, pr.x - w + 4);
    }
    el.style.left = nx + 'px'; el.style.top = ny + 'px';
    stack.push({ el: el, level: level, items: items, itemEls: itemEls, hl: -1 });
    if (!offModal) offModal = LAB.keys.modal(onMenuKey);
    if (level === 0) { try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); } }
    return stack[stack.length - 1];
  }

  function highlight(level, rec) {
    var p = stack[level];
    if (!p) return;
    p.itemEls.forEach(function (r, i) {
      var on = r === rec;
      r.el.classList.toggle('is-hl', on);
      if (on) p.hl = i;
    });
  }

  function openSub(level, rec) {
    var p = stack[level];
    if (!p || !rec.item.submenu) return;
    var r = LAB.stage.rectOf(rec.el);
    var pr = LAB.stage.rectOf(p.el);
    showPopup(rec.item.submenu, pr.x + pr.w - 4, r.y - 5, level + 1, rec.el);
  }

  function run(it) {
    menu.closeAll();
    if (it.action) {
      // run after the menu is gone so focus is back where it was
      setTimeout(function () { try { it.action(); } catch (e) { console.error(e); } }, 0);
    }
  }

  menu.contextMenu = function (x, y, items, o) {
    menu.closeAll();
    prevFocus = document.activeElement;
    onCloseCb = (o && o.onClose) || null;
    openIndex = -1;
    showPopup(items, x, y, 0);
    attachGlobal();
  };

  /* keyboard (modal layer) */
  function moveHl(p, dir) {
    var n = p.itemEls.length;
    if (!n) return;
    var i = p.hl;
    for (var k = 0; k < n; k++) {
      i = (i + dir + n) % n;
      if (i < 0) i = n - 1;
      if (p.itemEls[i].enabled) { highlight(stack.indexOf(p), p.itemEls[i]); return; }
    }
  }
  function onMenuKey(e) {
    if (!stack.length) return false;
    var p = stack[stack.length - 1];
    var level = stack.length - 1;
    switch (e.key) {
      case 'Escape':
        if (level > 0) { var q = stack.pop(); if (q.el.parentNode) q.el.parentNode.removeChild(q.el); }
        else menu.closeAll();
        return true;
      case 'ArrowDown': moveHl(p, 1); return true;
      case 'ArrowUp': moveHl(p, -1); return true;
      case 'ArrowRight':
        if (p.hl >= 0 && p.itemEls[p.hl].item.submenu && p.itemEls[p.hl].enabled) { openSub(level, p.itemEls[p.hl]); var sp = stack[stack.length - 1]; moveHl(sp, 1); return true; }
        if (openIndex >= 0) { openBar((openIndex + 1) % barTitles.length); return true; }
        return true;
      case 'ArrowLeft':
        if (level > 0) { var q2 = stack.pop(); if (q2.el.parentNode) q2.el.parentNode.removeChild(q2.el); return true; }
        if (openIndex >= 0) { openBar((openIndex - 1 + barTitles.length) % barTitles.length); return true; }
        return true;
      case 'Enter':
      case ' ':
        if (LAB.ui.isImeEnter(e)) return true;
        if (p.hl >= 0 && p.itemEls[p.hl].enabled) {
          var rec = p.itemEls[p.hl];
          if (rec.item.submenu) { openSub(level, rec); var sp2 = stack[stack.length - 1]; moveHl(sp2, 1); }
          else run(rec.item);
        }
        return true;
      default:
        return e.key === 'Tab';
    }
  }

  /* click away / resize */
  function onDocDown(e) {
    if (!stack.length) return;
    var t = e.target;
    if (t.closest && (t.closest('.lab-menu') || t.closest('.lab-mb-title'))) return;
    menu.closeAll();
  }
  var globalOn = false;
  function attachGlobal() {
    if (globalOn) return;
    globalOn = true;
    window.addEventListener('pointerdown', onDocDown, true);
  }
  function detachGlobal() {
    if (!globalOn) return;
    globalOn = false;
    window.removeEventListener('pointerdown', onDocDown, true);
    if (offModal) { offModal(); offModal = null; }
  }
  window.addEventListener('blur', function () { if (stack.length) menu.closeAll(); });
  LAB.bus.on('stage:resize', function () { if (stack.length) menu.closeAll(); });
  LAB.bus.on('apps:changed', function () { menu.refresh(); });
  LAB.bus.on('win:title', function () { /* the 視窗 menu is rebuilt every time it opens */ });

  /* placeholder menus declared by apps.js (it loads before this file); real apps register later and replace them */
  if (LAB.apps && LAB.apps._phMenus) {
    Object.keys(LAB.apps._phMenus).forEach(function (id) { registry.set(id, LAB.apps._phMenus[id]); });
  }

  LAB.menu = menu;
})(window.LAB);
