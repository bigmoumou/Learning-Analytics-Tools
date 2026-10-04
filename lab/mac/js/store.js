/* store.js [PORTABLE] — LAB.store, key "lab-mac:v1" (DESIGN §3.4). The ONLY file that touches localStorage. */
(function (LAB) {
  'use strict';

  var KEY = 'lab-mac:v1';
  var domains = new Map();          // name -> {serialize, restore, reset, migrate}
  var state = { v: 1, rev: 0, ui: {} };
  var timer = null;
  var quotaToasted = false;
  var lastSeenRev = 0;
  var dirty = false;                // something changed since the last successful save
  var BOOT_AT = Date.now();
  function rid() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }
  var SELF = rid();                 // this document (one page load)
  var TAB = null;                   // this browser tab: survives F5, is not shared with other tabs
  try { TAB = window.sessionStorage.getItem('lab-mac:tab'); if (!TAB) { TAB = rid(); window.sessionStorage.setItem('lab-mac:tab', TAB); } } catch (e) { TAB = null; }
  var loadedDoc = null;             // the document that wrote the data we loaded (our predecessor on a reload)

  var store = {
    available: true,
    frozen: false,
    readOnly: false,
    noticeText: null,
    KEY: KEY
  };

  function storageGet(k) {
    try { return window.localStorage.getItem(k); } catch (e) { return null; }
  }
  function storageSet(k, v) { window.localStorage.setItem(k, v); }
  function storageRemove(k) { try { window.localStorage.removeItem(k); } catch (e) { /* ignore */ } }

  // probe availability once at startup
  (function probe() {
    try {
      var t = '__lab_probe__';
      window.localStorage.setItem(t, '1');
      window.localStorage.removeItem(t);
      store.available = true;
    } catch (e) { store.available = false; }
  })();

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
    schedule();
  };

  function schedule() {
    if (store.frozen || store.readOnly) return;
    dirty = true;
    if (timer) clearTimeout(timer);
    timer = setTimeout(function () {
      timer = null;
      if (document.hidden) return;      // the visibilitychange/pagehide handler saves once
      store.save();
    }, 400);
  }
  store.markDirty = schedule;

  function collect() {
    var out = { v: 1, rev: 0, ui: state.ui, d: SELF };
    if (TAB) out.t = TAB;
    domains.forEach(function (def, name) {
      try { out[name] = def.serialize(); } catch (e) { console.error('[store] serialize ' + name + ' failed', e); }
    });
    return out;
  }

  store.save = function (force) {
    if (store.frozen) return;
    if (store.readOnly && !force) return;
    if (store.readOnly) return;
    var obj = collect();
    obj.rev = lastSeenRev + 1;
    var text;
    try { text = JSON.stringify(obj); } catch (e) { console.error('[store] stringify failed', e); return; }
    if (!store.available) { lastSeenRev = obj.rev; dirty = false; return; }
    try {
      storageSet(KEY, text);
      lastSeenRev = obj.rev;
      state.rev = obj.rev;
      dirty = false;
    } catch (e) {
      if (!quotaToasted && LAB.ui && LAB.ui.toast) {
        quotaToasted = true;
        LAB.ui.toast('儲存空間滿了，這次的進度沒有存下來');
      }
    }
  };

  /* load(opts): opts.skip = boot from the seed without reading (used by ?reset=1) */
  store.load = function (opts) {
    opts = opts || {};
    var parsed = null;
    if (!opts.skip && store.available) {
      var raw = storageGet(KEY);
      if (raw) {
        try { parsed = JSON.parse(raw); if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object'); }
        catch (e) {
          parsed = null;
          try { storageSet(KEY + ':bak', raw); } catch (e2) { /* ignore */ }
        }
      }
    }
    if (parsed) {
      lastSeenRev = typeof parsed.rev === 'number' ? parsed.rev : 0;
      state.rev = lastSeenRev;
      loadedDoc = typeof parsed.d === 'string' ? parsed.d : null;
      state.ui = parsed.ui && typeof parsed.ui === 'object' && !Array.isArray(parsed.ui) ? parsed.ui : {};
    } else {
      state.ui = {};
    }
    var fromV = parsed && typeof parsed.v === 'number' ? parsed.v : 1;
    domains.forEach(function (def, name) {
      var slice = parsed ? parsed[name] : undefined;
      try {
        if (slice !== undefined && def.migrate && fromV < 1) slice = def.migrate(slice, fromV);
        def.restore(slice);
      } catch (e) {
        console.warn('[store] domain "' + name + '" could not be restored and was reset', e);
        try { def.reset(); } catch (e2) { console.error('[store] reset of ' + name + ' failed', e2); }
      }
    });
    if (!store.available) store.notice('這個瀏覽器不能儲存進度：關掉這一頁後，進度會消失。');
  };

  store.reset = function (scope) {
    scope = scope || 'all';
    if (scope === 'all') {
      store.frozen = true;
      if (timer) { clearTimeout(timer); timer = null; }
      storageRemove(KEY);
      LAB.bus.emit('store:reset', { scope: 'all' });
      location.reload();
      return;
    }
    var def = domains.get(scope);
    if (def) {
      try { def.reset(); } catch (e) { console.error('[store] reset ' + scope + ' failed', e); }
    }
    LAB.bus.emit('store:reset', { scope: scope });
    store.save();
  };

  store.notice = function (text) {
    store.noticeText = text || null;
    LAB.bus.emit('store:notice', { text: store.noticeText });
  };

  /* ---- two-tab protection (rev) ----
     A plain reload must not look like a second tab: the old page's last writes (visibilitychange / pagehide) can reach
     the new page as storage events. Every write carries the writing document (d) and tab (t); a write by this very
     document is ignored, and so is a write by the previous page of this same tab (or the page whose data we loaded)
     during the first seconds after load. Only a different tab that writes counts as a conflict. */
  window.addEventListener('storage', function (e) {
    if (e.key !== KEY || store.frozen || store.readOnly) return;
    var nv = null;
    try { nv = e.newValue ? JSON.parse(e.newValue) : null; } catch (err) { nv = null; }
    if (!nv || typeof nv.rev !== 'number') return;
    if (nv.d === SELF) return;
    if (Date.now() - BOOT_AT < 3000 && ((TAB && nv.t === TAB) || (loadedDoc && nv.d === loadedDoc))) {
      if (nv.rev > lastSeenRev) lastSeenRev = nv.rev;
      return;
    }
    if (nv.rev > lastSeenRev) {
      store.readOnly = true;
      if (timer) { clearTimeout(timer); timer = null; }
      LAB.bus.emit('store:conflict', {});
      store.notice('另一個分頁改過進度了，這個分頁不再儲存。請只留一個分頁。');
    }
  });

  function finalSave() {
    if (store.frozen || store.readOnly) return;
    if (timer) { clearTimeout(timer); timer = null; }
    if (!dirty) return;               // nothing changed: do not bump the revision for nothing
    store.save();
  }
  document.addEventListener('visibilitychange', function () { if (document.hidden) finalSave(); });
  window.addEventListener('pagehide', finalSave);

  /* ---- keep the autosave honest: events that change persisted state schedule a save ---- */
  var DIRTY_RE = /^(fs:|codex:|term:|mission|finder:|editor:|code:|store:reset)/;
  LAB.bus.on('*', function (name) { if (DIRTY_RE.test(name)) schedule(); });

  /* ---- the bus tail is a domain of its own (DESIGN §3.3) ---- */
  store.register('bus', {
    serialize: function () { return LAB.bus.exportTail(); },
    restore: function (json) { if (json === undefined) return; LAB.bus.importTail(json); },
    reset: function () { LAB.bus.clearHistory(); }
  });

  LAB.store = store;

  /* restore runs at ready priority 10 (before any app init); boot.js decides {skip} for ?reset=1 */
  LAB.ready(function () {
    store.load({ skip: !!store.skipLoad });
    if (store.skipLoad) { store.skipLoad = false; }
  }, 10);
})(window.LAB);
