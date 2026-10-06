/* menu.js [SKIN] — LAB.menu: Windows 11 context menus (DESIGN W3, M§3.9). There is no menu bar on Windows: `register`, `mount`, `refresh` and
   `windowMenu` stay so older app code loads, but nothing is drawn for them. Context menus are light (dark with {dark:true}),
   8 px radius, 4 px item radius, icons in a left column, a compact icon row (iconRow) like the Windows 11 file menu. */
(function (LAB) {
  'use strict';

  var h = LAB.util.h;
  var menu = {};
  var registry = new Map();          // appId -> fn() -> [{label, items}] (kept for compatibility; no menu bar shows them)
  var stack = [];                    // open popups: {el, level, items, itemEls, hl}
  var offModal = null;
  var prevFocus = null;
  var onCloseCb = null;
  var subTimer = null;
  var darkMenu = false;
  var extraCls = '';              // classes the caller asked for ({cls:'is-winx'}: the compact Win+X look)

  menu.register = function (appId, fn) { registry.set(appId, fn); };
  menu.mount = function () { /* no menu bar on Windows */ };
  menu.refresh = function () { /* no menu bar on Windows */ };

  function overlays() { return document.getElementById('lab-overlays'); }
  function evalFlag(v, dflt) {
    if (typeof v === 'function') { try { return !!v(); } catch (e) { return dflt; } }
    return v === undefined ? dflt : !!v;
  }
  /* Mac key glyphs that slip in from copied code are shown the Windows way */
  function winKeys(s) {
    return String(s || '').replace(/⌘/g, 'Ctrl+').replace(/⇧/g, 'Shift+').replace(/⌥/g, 'Alt+').replace(/⌃/g, 'Ctrl+').replace(/⌫/g, 'Delete').replace(/↩|⏎/g, 'Enter');
  }

  /* shared "視窗" menu body some apps still reuse (inert on Windows, kept so registrations keep working) */
  menu.windowMenu = function (english) {
    var focused = LAB.wm.focused();
    var items = [
      { label: english ? 'Minimize' : '最小化', enabled: !!focused, action: function () { if (focused) focused.minimize(); } },
      { label: english ? 'Maximize' : '最大化', enabled: !!focused, action: function () { if (focused) focused.zoom(); } }
    ];
    var ws = LAB.wm.byApp(LAB.wm.frontmostApp());
    if (ws.length) {
      items.push({ separator: true });
      ws.slice().reverse().forEach(function (w) {
        items.push({ label: w.getTitle() || '（未命名）', checked: focused === w, action: function () { w.focus(); } });
      });
    }
    return items;
  };

  /* ---------------------------------------------------------- popups */
  function closePopups() {
    if (subTimer) { clearTimeout(subTimer); subTimer = null; }
    stack.forEach(function (p) { if (p.el.parentNode) p.el.parentNode.removeChild(p.el); });
    stack = [];
  }

  menu.closeAll = function () {
    var was = stack.length > 0;
    closePopups();
    detachGlobal();
    if (was) {
      try { if (prevFocus && prevFocus.focus && document.contains(prevFocus)) prevFocus.focus(); } catch (e) { /* ignore */ }
      var cb = onCloseCb; onCloseCb = null;
      if (cb) { try { cb(); } catch (e2) { console.error(e2); } }
    }
    prevFocus = null;
  };
  menu.isOpen = function () { return stack.length > 0; };

  function iconNode(name, size) {
    var s = h('span', { class: 'lab-mi-glyph', 'aria-hidden': 'true' });
    s.innerHTML = LAB.icons.get(name, { size: size || 16 });         // static icon markup only
    return s;
  }

  function showPopup(items, x, y, level, parentItemEl) {
    // close deeper levels first
    while (stack.length > level) { var p = stack.pop(); if (p.el.parentNode) p.el.parentNode.removeChild(p.el); }
    var itemEls = [];
    var roomy = extraCls.indexOf('is-winx') >= 0 && LAB.stage && LAB.stage.h >= 800;     // a tall stage gives the Win+X rows their full height
    var el = h('div', { class: 'lab-menu' + (level ? ' is-sub' : '') + (darkMenu ? ' is-dark' : '') + (extraCls ? ' ' + extraCls : '') + (roomy ? ' is-roomy' : ''), role: 'menu', tabindex: '-1' });

    function bindRec(rec, it, enabled, rowNode, lvl) {
      rowNode.addEventListener('mouseenter', function () {
        highlight(lvl, rec);
        if (subTimer) { clearTimeout(subTimer); subTimer = null; }
        if (it.submenu && enabled) subTimer = setTimeout(function () { openSub(lvl, rec); }, 120);
        else { while (stack.length > lvl + 1) { var q = stack.pop(); if (q.el.parentNode) q.el.parentNode.removeChild(q.el); } }
      });
      rowNode.addEventListener('click', function (e) {
        e.stopPropagation();
        if (!enabled) return;
        if (it.submenu) { openSub(lvl, rec); return; }
        run(it);
      });
    }

    items.forEach(function (it) {
      if (it.separator) { el.appendChild(h('div', { class: 'lab-mi-sep', role: 'separator' })); return; }
      if (it.iconRow) {
        // Windows 11 compact menu: a row of icon buttons (剪下 / 複製 / 重新命名 / 刪除)
        var row = h('div', { class: 'lab-mi-iconrow', role: 'presentation' });
        var recs = [];
        it.iconRow.forEach(function (b) {
          var en = evalFlag(b.enabled, true);
          var sc = winKeys(b.shortcut);
          var btn = h('div', {
            class: 'lab-mi-rb' + (en ? '' : ' is-disabled'), role: 'menuitem', tabindex: '-1', 'aria-label': b.label,
            'aria-disabled': en ? null : 'true', 'data-tip': b.label + (sc ? ' (' + sc + ')' : ''), dataset: { lab: 'menu-item' }
          });
          btn.appendChild(iconNode(b.icon || 'fl-more', 18));
          var rec = { el: btn, item: b, enabled: en, row: recs };
          recs.push(rec);
          itemEls.push(rec);
          bindRec(rec, b, en, btn, level);
          row.appendChild(btn);
        });
        el.appendChild(row);
        return;
      }
      var enabled = evalFlag(it.enabled, true) && !(it.submenu && !it.submenu.length);
      var checked = evalFlag(it.checked, false);
      var rowEl = h('div', {
        class: 'lab-mi' + (enabled ? '' : ' is-disabled') + (it.submenu ? ' has-sub' : '') + (it.danger ? ' is-danger' : ''), role: 'menuitem', tabindex: '-1',
        'aria-disabled': enabled ? null : 'true', dataset: { lab: 'menu-item' }
      });
      var lead = h('span', { class: 'lab-mi-lead', 'aria-hidden': 'true' });
      // `radio: true` + checked = the chosen one of a group (icon size, sort key): a round dot instead of the check mark
      if (checked && it.radio) lead.appendChild(h('span', { class: 'lab-mi-dot' }));
      else if (checked) lead.appendChild(iconNode('fl-check', 14));
      else if (it.icon) lead.appendChild(iconNode(it.icon, 16));
      rowEl.appendChild(lead);
      // `accel: 'e'` draws the Windows keyboard accelerator after the label (終端機(I)) and makes that letter work while the menu is open
      rowEl.appendChild(h('span', { class: 'lab-mi-label' }, it.accel ? [it.label, '(', h('u', null, String(it.accel).toUpperCase()), ')'] : it.label));
      if (it.shortcut) rowEl.appendChild(h('span', { class: 'lab-mi-sc' }, winKeys(it.shortcut)));
      if (it.submenu) { var arrow = iconNode('chev-right', 12); arrow.classList.add('lab-mi-arrow'); rowEl.appendChild(arrow); }
      var rec2 = { el: rowEl, item: it, enabled: enabled };
      itemEls.push(rec2);
      bindRec(rec2, it, enabled, rowEl, level);
      el.appendChild(rowEl);
    });

    overlays().appendChild(el);
    // position (stage px) and keep inside the stage: flip up / left when there is no room, like Windows
    var st = LAB.stage;
    var w = el.offsetWidth, hh = el.offsetHeight;
    var maxY = st.dockTop ? st.dockTop() : st.h;
    var nx, ny;
    if (parentItemEl) {
      var pr = LAB.stage.rectOf(parentItemEl);
      var par = LAB.stage.rectOf(stack[level - 1] ? stack[level - 1].el : parentItemEl);
      nx = par.x + par.w - 4;
      if (nx + w > st.w - 4) nx = Math.max(4, par.x - w + 4);
      ny = pr.y - 5;
      if (ny + hh > maxY - 4) ny = Math.max(4, maxY - hh - 4);
    } else {
      nx = x; ny = y;
      if (nx + w > st.w - 4) nx = Math.max(4, x - w);
      if (ny + hh > maxY - 4) {
        // no room below: open upward from the cursor (never over the taskbar); if that does not fit either, slide up just enough
        var up = y - hh;
        ny = up >= 4 ? Math.min(up, maxY - hh - 4) : Math.max(4, maxY - hh - 4);
      }
    }
    el.style.left = Math.round(nx) + 'px'; el.style.top = Math.round(ny) + 'px';
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
    showPopup(rec.item.submenu, 0, 0, level + 1, rec.el);
  }

  function run(it) {
    menu.closeAll();
    if (it.action) {
      // run after the menu is gone so focus is back where it was
      setTimeout(function () { try { it.action(); } catch (e) { console.error(e); } }, 0);
    }
  }

  /* x, y in stage px. o = { onClose, dark } */
  menu.contextMenu = function (x, y, items, o) {
    menu.closeAll();
    prevFocus = document.activeElement;
    onCloseCb = (o && o.onClose) || null;
    // dark: true = dark; dark: 'win' = follows the Windows mode (Settings > 色彩), used by the taskbar's own menus
    darkMenu = o && o.dark === 'win' ? document.documentElement.getAttribute('data-win-mode') !== 'light' : !!(o && o.dark);
    extraCls = (o && o.cls) || '';
    showPopup(items, x, y, 0);
    attachGlobal();
  };

  /* keyboard (modal layer) */
  function moveHl(p, dir) {
    var n = p.itemEls.length;
    if (!n) return;
    var i = p.hl;
    if (i < 0 && dir < 0) i = 0;            // nothing highlighted yet: ArrowUp starts at the last item
    for (var k = 0; k < n; k++) {
      i = (i + dir + n) % n;
      if (p.itemEls[i].enabled) { highlight(stack.indexOf(p), p.itemEls[i]); return; }
    }
  }
  /* Home / End: the first / the last item that can be chosen */
  function moveEdge(p, dir) {
    var n = p.itemEls.length, i = dir > 0 ? 0 : n - 1;
    for (var k = 0; k < n; k++, i += dir) {
      if (p.itemEls[i].enabled) { highlight(stack.indexOf(p), p.itemEls[i]); return; }
    }
  }
  function moveInRow(p, dir) {
    var cur = p.itemEls[p.hl];
    if (!cur || !cur.row) return false;
    var idx = cur.row.indexOf(cur), n = cur.row.length;
    for (var k = 1; k <= n; k++) {
      var nx = cur.row[(idx + dir * k + n * k) % n];
      if (nx.enabled) { highlight(stack.indexOf(p), nx); return true; }
    }
    return true;
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
      case 'Home': moveEdge(p, 1); return true;
      case 'End': moveEdge(p, -1); return true;
      case 'ArrowRight':
        if (moveInRow(p, 1)) return true;
        if (p.hl >= 0 && p.itemEls[p.hl].item.submenu && p.itemEls[p.hl].enabled) { openSub(level, p.itemEls[p.hl]); var sp = stack[stack.length - 1]; moveHl(sp, 1); }
        return true;
      case 'ArrowLeft':
        if (moveInRow(p, -1)) return true;
        if (level > 0) { var q2 = stack.pop(); if (q2.el.parentNode) q2.el.parentNode.removeChild(q2.el); }
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
        if (e.key && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          var ch = e.key.toLowerCase();
          var hit = p.itemEls.filter(function (r) { return r.enabled && r.item.accel && String(r.item.accel).toLowerCase() === ch; })[0];
          if (hit) {
            if (hit.item.submenu) { highlight(level, hit); openSub(level, hit); var sp3 = stack[stack.length - 1]; moveHl(sp3, 1); }
            else run(hit.item);
            return true;
          }
          // no accelerator: the letter moves the highlight to the next item whose name starts with it (like the first-letter jump of a Windows menu)
          var firsts = p.itemEls.filter(function (r) { return r.enabled && !r.row && String(r.item.label || '').toLowerCase().charAt(0) === ch; });
          if (firsts.length) { var at = firsts.indexOf(p.itemEls[p.hl]); highlight(level, firsts[(at + 1) % firsts.length]); return true; }
        }
        return e.key === 'Tab';
    }
  }

  /* click away / resize */
  function onDocDown(e) {
    if (!stack.length) return;
    var t = e.target;
    if (t.closest && t.closest('.lab-menu')) return;
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

  /* placeholder menus declared by apps.js (it loads before this file); real apps register later and replace them */
  if (LAB.apps && LAB.apps._phMenus) {
    Object.keys(LAB.apps._phMenus).forEach(function (id) { registry.set(id, LAB.apps._phMenus[id]); });
  }

  LAB.menu = menu;
})(window.LAB);
