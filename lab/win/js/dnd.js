/* dnd.js [PORTABLE] — LAB.dnd: pointer-based drag and drop (DESIGN §3.10). No HTML5 draggable/dataTransfer. */
(function (LAB) {
  'use strict';

  var h = LAB.util.h;
  var targets = new Map();       // element -> spec
  var activeDrag = null;         // the running drag
  var dnd = {};

  function layer() { return document.getElementById('lab-dnd'); }

  dnd.active = function () { return activeDrag ? activeDrag.payload : null; };
  dnd.cancel = function () { if (activeDrag) activeDrag.cancel(); };

  /* ---------------------------------------------------------- sources */
  dnd.source = function (el, getPayload, opts) {
    opts = opts || {};
    var threshold = opts.threshold || 4;
    el.draggable = false;
    el.style.userSelect = 'none';
    el.style.webkitUserSelect = 'none';
    el.style.webkitUserDrag = 'none';
    el.style.touchAction = 'none';
    el.classList.add('lab-dnd-src');
    function onDragStart(e) { e.preventDefault(); }
    el.addEventListener('dragstart', onDragStart);

    function onDown(e) {
      if (e.button !== 0 || e.isPrimary === false) return;
      if (activeDrag) return;
      if (e.target.closest && e.target.closest('input, textarea, [contenteditable="true"]')) return;
      // NEVER preventDefault here: the compatibility mousedown focuses the window under the cursor (wm.js)
      var start = { x: e.clientX, y: e.clientY };
      var pid = e.pointerId;
      var dragging = false;
      var origEvent = e;
      if (opts.onPressSelect) { try { opts.onPressSelect(e); } catch (err) { console.error(err); } }

      function cleanup() {
        window.removeEventListener('pointermove', onMove, true);
        window.removeEventListener('pointerup', onUp, true);
        window.removeEventListener('pointercancel', onCancel, true);
        window.removeEventListener('keydown', onKey, true);
        window.removeEventListener('blur', onCancel);
        document.removeEventListener('visibilitychange', onCancel);
      }
      function onMove(ev) {
        if (ev.pointerId !== pid) return;
        if (!dragging) {
          var sc = LAB.stage.scale || 1;
          var dx = (ev.clientX - start.x) / sc, dy = (ev.clientY - start.y) / sc;
          if (Math.sqrt(dx * dx + dy * dy) < threshold) return;
          var payload = null;
          try { payload = getPayload(ev); } catch (err) { console.error(err); }
          if (!payload) { cleanup(); return; }
          dragging = true;
          activeDrag = createDrag(payload, ev, cleanup);
        }
        activeDrag.move(ev);
      }
      function onUp(ev) {
        if (ev.pointerId !== pid) return;
        cleanup();
        if (dragging && activeDrag) { activeDrag.release(ev); return; }
        if (opts.onClickSelect) { try { opts.onClickSelect(origEvent); } catch (err) { console.error(err); } }
      }
      function onCancel() {
        cleanup();
        if (dragging && activeDrag) activeDrag.cancel();
      }
      function onKey(ev) {
        if (ev.key === 'Escape') { if (dragging && activeDrag) { ev.preventDefault(); ev.stopPropagation(); } onCancel(); }
      }
      window.addEventListener('pointermove', onMove, true);
      window.addEventListener('pointerup', onUp, true);
      window.addEventListener('pointercancel', onCancel, true);
      window.addEventListener('keydown', onKey, true);
      window.addEventListener('blur', onCancel);
      document.addEventListener('visibilitychange', onCancel);
    }
    el.addEventListener('pointerdown', onDown);
    return function () {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('dragstart', onDragStart);
    };
  };

  /* ---------------------------------------------------------- targets */
  dnd.target = function (el, spec) {
    targets.set(el, spec);
    return function () { if (targets.get(el) === spec) targets.delete(el); };
  };
  dnd.targetCount = function () { return targets.size; };

  /* ------------------------------------------------------------ ghost */
  function buildGhost(payload) {
    var paths = payload.paths || [];
    var g = h('div', { class: 'lab-ghost' });
    var icons = h('div', { class: 'lab-ghost-icons' });
    var n = Math.min(3, Math.max(1, paths.length));
    for (var i = n - 1; i >= 0; i--) {
      var ic = LAB.icons.el(payload.iconName || 'unknown', { size: 48 });
      ic.style.position = i === 0 ? 'relative' : 'absolute';
      ic.style.left = (i * 5) + 'px'; ic.style.top = (i * 4) + 'px';
      icons.appendChild(ic);
    }
    g.appendChild(icons);
    if (payload.label) g.appendChild(h('div', { class: 'lab-ghost-label' }, payload.label));
    if (paths.length > 1) g.appendChild(h('div', { class: 'lab-ghost-count' }, String(paths.length)));
    var badge = h('div', { class: 'lab-ghost-badge' });
    g.appendChild(badge);
    return { el: g, badge: badge };
  }

  function zoneOf(elList) {
    for (var i = 0; i < elList.length; i++) {
      var e = elList[i];
      var win = e.closest ? e.closest('.lab-win') : null;
      if (win) return win;
      if (e.id === 'lab-dock' || (e.closest && e.closest('#lab-dock'))) return document.getElementById('lab-dock');
      if (e.id === 'lab-menubar' || (e.closest && e.closest('#lab-menubar'))) return document.getElementById('lab-menubar');
      if (e.id === 'lab-desktop' || (e.closest && e.closest('#lab-desktop'))) return document.getElementById('lab-desktop');
      // overlays (menus, sheets, ghost) and the stage chrome do not form a zone; keep looking underneath
    }
    return null;
  }

  function resolveTarget(payload, x, y, mods) {
    var list = document.elementsFromPoint(x, y);
    var zone = zoneOf(list);
    if (!zone) return null;
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      if (!zone.contains(e)) continue;
      var node = e;
      while (node && node !== zone.parentNode) {
        var spec = targets.get(node);
        if (spec) {
          var mode = false;
          try { mode = spec.accept(payload, mods); } catch (err) { console.error(err); mode = false; }
          if (mode) {
            if (mode === 'move' && mods.altKey) {
              var m2 = false;
              try { m2 = spec.accept(payload, { altKey: mods.altKey, metaKey: mods.metaKey, shiftKey: mods.shiftKey, ctrlKey: mods.ctrlKey, mode: 'copy' }); } catch (err2) { m2 = false; }
              if (m2) mode = 'copy';
            }
            return { spec: spec, el: node, mode: mode, list: list };
          }
        }
        if (node === zone) break;
        node = node.parentNode;
      }
    }
    return null;
  }

  function scrollableAncestor(node) {
    while (node && node !== document.body) {
      if (node.nodeType === 1) {
        var cs = getComputedStyle(node);
        if ((/(auto|scroll)/.test(cs.overflowY) && node.scrollHeight > node.clientHeight + 1) || (/(auto|scroll)/.test(cs.overflowX) && node.scrollWidth > node.clientWidth + 1)) return node;
      }
      node = node.parentNode;
    }
    return null;
  }

  /* ------------------------------------------------------------- drag */
  function createDrag(payload, firstEv, cleanupFn) {
    var ghost = buildGhost(payload);
    var ghostEl = ghost.el;
    var host = layer();
    host.appendChild(ghostEl);
    ghostEl.style.willChange = 'transform';
    document.body.classList.add('lab-dragging');
    var lastEv = firstEv;
    var origin = LAB.stage.toStage(firstEv.clientX, firstEv.clientY);
    var current = null;           // {spec, mode}
    var rafId = 0;
    var ended = false;
    var self = { payload: payload };

    LAB.bus.emit('dnd:start', { payload: payload });

    function modsOf(ev) { return { altKey: !!ev.altKey, metaKey: !!ev.metaKey, shiftKey: !!ev.shiftKey, ctrlKey: !!ev.ctrlKey }; }

    function place(ev) {
      var p = LAB.stage.toStage(ev.clientX, ev.clientY);
      ghostEl.style.transform = 'translate(' + (p.x - 42) + 'px,' + (p.y - 24) + 'px)';
    }

    function setBadge(mode) {
      ghost.badge.className = 'lab-ghost-badge' + (mode === 'copy' ? ' is-copy' : mode === 'link' ? ' is-link' : '');
      ghost.badge.textContent = mode === 'copy' ? '+' : mode === 'link' ? '↪' : '';
    }

    function update(ev) {
      var r = resolveTarget(payload, ev.clientX, ev.clientY, modsOf(ev));
      var sameSpec = r && current && r.spec === current.spec;
      if (!sameSpec) {
        if (current && current.spec.leave) { try { current.spec.leave(); } catch (e) { console.error(e); } }
        current = r ? { spec: r.spec, mode: r.mode } : null;
        if (current && current.spec.enter) { try { current.spec.enter(payload, current.mode); } catch (e2) { console.error(e2); } }
      } else if (current.mode !== r.mode) {
        current.mode = r.mode;
      }
      setBadge(current ? current.mode : null);
      if (current && current.spec.over) {
        try { current.spec.over(payload, current.mode, LAB.stage.toStage(ev.clientX, ev.clientY)); } catch (e3) { console.error(e3); }
      }
      edgeScroll(ev, r ? r.list : null);
    }

    function edgeScroll(ev, list) {
      if (!list || !list.length) return;
      var sc = null;
      for (var i = 0; i < list.length; i++) { sc = scrollableAncestor(list[i]); if (sc) break; }
      if (!sc) return;
      var rc = sc.getBoundingClientRect();
      var m = 24, step = 12;
      if (ev.clientY < rc.top + m) sc.scrollTop -= step;
      else if (ev.clientY > rc.bottom - m) sc.scrollTop += step;
      if (ev.clientX < rc.left + m) sc.scrollLeft -= step;
      else if (ev.clientX > rc.right - m) sc.scrollLeft += step;
    }

    function finishCommon() {
      ended = true;
      if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
      document.body.classList.remove('lab-dragging');
      if (current && current.spec.leave) { try { current.spec.leave(); } catch (e) { console.error(e); } }
      current = null;
      activeDrag = null;
      cleanupFn();
    }

    self.move = function (ev) {
      if (ended) return;
      // a lost pointerup (released outside the window): finish as if released here
      if (ev.buttons === 0 && ev.pointerType === 'mouse') { self.release(ev); return; }
      lastEv = ev;
      place(ev);
      if (!rafId) {
        rafId = requestAnimationFrame(function () { rafId = 0; if (!ended) update(lastEv); });
      }
    };

    self.release = function (ev) {
      if (ended) return;
      var ev2 = ev || lastEv;
      var mods = modsOf(ev2);
      if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
      // re-resolve at the release point (a re-render may have disposed the element mid-drag)
      var r = resolveTarget(payload, ev2.clientX, ev2.clientY, mods);
      var x = LAB.stage.toStage(ev2.clientX, ev2.clientY);
      finishCommon();
      if (r) {
        try { r.spec.drop(payload, { x: x.x, y: x.y, altKey: mods.altKey, metaKey: mods.metaKey, shiftKey: mods.shiftKey, mode: r.mode }); }
        catch (err) { console.error('[dnd] drop failed', err); }
        LAB.bus.emit('dnd:drop', { payload: payload, targetId: r.spec.id, accepted: true, mode: r.mode });
        removeGhost(false);
      } else {
        LAB.bus.emit('dnd:cancel', { payload: payload });
        removeGhost(true);
      }
    };

    self.cancel = function () {
      if (ended) return;
      finishCommon();
      LAB.bus.emit('dnd:cancel', { payload: payload });
      removeGhost(true);
    };

    function removeGhost(animateBack) {
      var reduced = false;
      try { reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { /* ignore */ }
      if (animateBack && !reduced) {
        ghostEl.style.transition = 'transform 250ms ease, opacity 250ms ease';
        ghostEl.style.transform = 'translate(' + (origin.x - 42) + 'px,' + (origin.y - 24) + 'px)';
        ghostEl.style.opacity = '0';
        setTimeout(function () { if (ghostEl.parentNode) ghostEl.parentNode.removeChild(ghostEl); }, 260);
      } else if (ghostEl.parentNode) ghostEl.parentNode.removeChild(ghostEl);
    }

    place(firstEv);
    return self;
  }

  LAB.dnd = dnd;
})(window.LAB);
