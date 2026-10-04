/* store.js [PORTABLE] — LAB.store: the in-memory state of one visit (DESIGN §3.4, §18).
   Nothing is saved between visits: every page load, a reload included, is a brand-new computer built from the seed.
   The module keeps the same API as before (register / get / set / markDirty / reset / notice) so no other file changes,
   but it never writes the lab state anywhere. Its only contact with web storage is to REMOVE what older versions left. */
(function (LAB) {
  'use strict';

  var domains = new Map();          // name -> {serialize, restore, reset, migrate}
  var state = { ui: {} };           // small shared UI state of this visit (railMode, cardPos, …)

  var store = {
    noticeText: null,
    // the keys older versions used; they are only ever removed (never read, never written)
    LEGACY_KEYS: ['lab-mac:v1', 'lab-mac:v1:bak']
  };

  /* Old saved state is dead weight from now on: drop it as early as possible (script evaluation, before any app init).
     The phone-notice choice (sessionStorage "lab-phone-ok") is a different thing and stays. */
  store.clearLegacy = function () {
    store.LEGACY_KEYS.forEach(function (k) { try { window.localStorage.removeItem(k); } catch (e) { /* storage blocked: nothing to remove */ } });
    try { window.sessionStorage.removeItem('lab-mac:tab'); } catch (e2) { /* ignore */ }
  };
  store.clearLegacy();

  store.register = function (domain, def) { domains.set(domain, def); };

  function getPath(obj, path, dflt) {
    var parts = String(path).split('.');
    var cur = obj;
    for (var i = 0; i < parts.length; i++) {
      if (cur === null || cur === undefined || typeof cur !== 'object') return dflt;
      cur = cur[parts[i]];
    }
    return cur === undefined ? dflt : cur;
  }
  store.get = function (path, dflt) {
    var top = String(path).split('.')[0];
    if (domains.has(top)) return dflt;   // domain slices are owned by their module
    return getPath(state, path, dflt);
  };
  store.set = function (path, value) {
    var parts = String(path).split('.');
    var cur = state;
    for (var i = 0; i < parts.length - 1; i++) {
      var k = parts[i];
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') return;
      if (cur[k] === null || typeof cur[k] !== 'object') cur[k] = {};
      cur = cur[k];
    }
    var last = parts[parts.length - 1];
    if (last === '__proto__' || last === 'constructor' || last === 'prototype') return;
    cur[last] = value;
  };

  /* Kept so callers do not change: there is nothing to save any more. */
  store.markDirty = function () { /* in-memory only */ };

  /* Boot: every domain starts from its seed (restore(undefined) is the "nothing saved" path of each module). */
  store.load = function () {
    state.ui = {};
    domains.forEach(function (def, name) {
      try { def.restore(undefined); }
      catch (e) {
        console.warn('[store] domain "' + name + '" could not start and was reset', e);
        try { def.reset(); } catch (e2) { console.error('[store] reset of ' + name + ' failed', e2); }
      }
    });
  };

  /* reset('all') = start a new visit: reload the page, which builds a new computer from the seed. */
  store.reset = function (scope) {
    scope = scope || 'all';
    if (scope === 'all') {
      LAB.bus.emit('store:reset', { scope: 'all' });
      location.reload();
      return;
    }
    var def = domains.get(scope);
    if (def) {
      try { def.reset(); } catch (e) { console.error('[store] reset ' + scope + ' failed', e); }
    }
    LAB.bus.emit('store:reset', { scope: scope });
  };

  store.notice = function (text) {
    store.noticeText = text || null;
    LAB.bus.emit('store:notice', { text: store.noticeText });
  };

  /* ---- the bus tail is a domain of its own (DESIGN §3.3) ---- */
  store.register('bus', {
    serialize: function () { return LAB.bus.exportTail(); },
    restore: function (json) { if (json === undefined) return; LAB.bus.importTail(json); },
    reset: function () { LAB.bus.clearHistory(); }
  });

  LAB.store = store;

  /* runs at ready priority 10, before any app init */
  LAB.ready(function () { store.load(); }, 10);
})(window.LAB);
