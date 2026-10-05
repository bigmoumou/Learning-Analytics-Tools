/* apps.js [PORTABLE] — LAB.apps registry, launch/quit, openPath, and tiny PLACEHOLDER apps (DESIGN §3.7, §11 phase 0).
   Placeholders are replaced in place when the real app file calls LAB.apps.register with the same id (later registration wins). */
(function (LAB) {
  'use strict';

  var h = LAB.util.h;
  var reg = new Map();           // id -> def (insertion order = registration order)
  var runningSet = new Set();
  var launching = new Set();
  var apps = {};

  apps.register = function (id, def) {
    var existed = reg.has(id);
    def.id = id;
    reg.set(id, def);
    LAB.bus.emit('apps:changed', { id: id, replaced: existed });
  };
  apps.get = function (id) { return reg.get(id) || null; };
  apps.all = function () { var a = []; reg.forEach(function (d) { a.push(d); }); return a; };
  apps.isRunning = function (id) { return runningSet.has(id); };
  apps.running = function () { return Array.from(runningSet); };

  /* called by wm.open for windows that bypass launch(): marks the app running and emits app:launch once */
  apps._ensureRunning = function (id) {
    launching.delete(id);
    if (runningSet.has(id)) return;
    runningSet.add(id);
    LAB.bus.emit('app:launch', { appId: id });
  };
  apps._markRunning = function (id) { runningSet.add(id); };

  apps.launch = function (id, args, o) {
    o = o || {};
    var def = reg.get(id);
    if (!def) { LAB.ui.toast('這個程式還沒安裝（練習版）'); return null; }
    var wm = LAB.wm;
    if (runningSet.has(id)) {
      if (args) return def.open(args) || null;
      if (wm.isHidden(id)) { wm.showApp(id); return wm.lastFocused(id); }
      var vis = wm.visibleByApp(id);
      if (vis.length) {
        var w = wm.lastFocused(id);
        if (!w || w.minimized) w = vis[vis.length - 1];
        w.focus();
        return w;
      }
      var all = wm.byApp(id);
      if (all.length) { var last = all[all.length - 1]; last.restore(); return last; }
      return def.open(args) || null;
    }
    if (launching.has(id)) return null;
    var doOpen = function () { launching.delete(id); return def.open(args) || null; };
    if (o.bounce) {
      launching.add(id);
      LAB.bus.emit('app:launching', { appId: id });
      setTimeout(doOpen, 560);
      return null;
    }
    return doOpen();
  };

  /* Quit asks like a real Mac: every window goes through its own onClose (so an edited document shows its
     「要儲存…嗎？」 sheet). The first window that vetoes stops the quit and the app keeps running; pressing
     ⌘Q again continues. apps.quit(id, {force:true}) closes everything without asking (tests, reset). */
  apps.quit = function (id, o) {
    if (id === 'finder') return false;
    var def = reg.get(id);
    var force = !!(o && o.force);
    LAB.wm.showApp(id, true);
    var ws = LAB.wm.byApp(id).slice();
    for (var i = 0; i < ws.length; i++) {
      if (ws[i].close(force) === false) return false;
    }
    if (def && def.quit) { try { def.quit(); } catch (e) { console.error(e); } }
    launching.delete(id);
    if (runningSet.delete(id)) LAB.bus.emit('app:quit', { appId: id });
    return true;
  };

  /* ---- path handling ---- */
  var EXT_TEXT = { '.md': 1, '.txt': 1, '.csv': 1, '.json': 1, '.log': 1 };
  var APP_NAME = { 'codex.app': 'codex', 'code.app': 'code', '文字編輯.app': 'textedit', '終端機.app': 'terminal',
    'safari.app': 'safari', '系統設定.app': 'settings', '計算機.app': 'calculator', '活動監視器.app': 'activity', '預覽程式.app': 'preview' };
  var EXT_PREVIEW = { '.pdf': 1, '.png': 1, '.jpg': 1, '.jpeg': 1, '.gif': 1, '.heic': 1, '.webp': 1 };   // 預覽程式 (round 5)
  var BY = { finder: 'finder', desktop: 'desktop', terminal: 'terminal', dock: 'dock', codex: 'codex', spotlight: 'finder', menu: 'finder', open: 'finder' };

  apps.defaultFor = function (path) {
    var st = LAB.vfs.stat(path);
    if (!st) return 'quicklook';
    if (st.type === 'dir') return 'finder';
    var ext = LAB.vfs.extname(st.name).toLowerCase();
    if (ext === '.zip' || st.kind === 'zip') return 'archive';
    if (st.kind === 'app' || ext === '.app') return APP_NAME[st.name.toLowerCase()] || 'quicklook';
    if (EXT_TEXT[ext]) return 'textedit';
    if (EXT_PREVIEW[ext] && reg.get('preview')) return 'preview';
    return 'quicklook';
  };

  apps.openWith = function (path) {
    var st = LAB.vfs.stat(path);
    if (!st) return [];
    var out = [];
    reg.forEach(function (def, id) {
      if (typeof def.canOpen !== 'function') return;
      var s = 0;
      try { s = def.canOpen(st) || 0; } catch (e) { s = 0; }
      if (s > 0) out.push({ appId: id, label: def.title, score: s });
    });
    out.sort(function (a, b) { return b.score - a.score; });
    return out.map(function (x) { return { appId: x.appId, label: x.label }; });
  };

  apps.openFolder = function (path, via) {
    var def = reg.get('finder');
    if (!def) return null;
    return def.open({ path: path, via: via || 'open' }) || null;
  };

  apps.openPath = function (path, o) {
    o = o || {};
    var via = o.via || 'open';
    var vfs = LAB.vfs;
    var p = vfs.canon(path);
    var st = vfs.stat(p);
    LAB.bus.emit('finder:open', { path: p, kind: st ? st.kind : 'missing', via: via });
    if (!st) return false;
    var by = BY[via] || 'finder';
    var id = o.appId || apps.defaultFor(p);
    if (id === 'archive') {
      try {
        var dest = vfs.extractFinder(p, { by: by });
        if (LAB.finder && LAB.finder.reveal) LAB.finder.reveal(dest);
        else apps.openFolder(vfs.dirname(dest), via);
        return true;
      } catch (e) { LAB.ui.toast('這個壓縮檔打不開（練習版）'); return false; }
    }
    var def = reg.get(id);
    if (!def) { LAB.ui.toast('這個程式還沒安裝（練習版）'); return false; }
    if (st.kind === 'app' && !o.appId) { apps.launch(id); return true; }
    if (typeof def.handleOpen !== 'function') { LAB.ui.toast('這個程式打不開這個項目（練習版）'); return false; }
    var r = def.handleOpen(p, { via: via });
    if (r === false) { LAB.ui.toast('這個程式打不開這個項目（練習版）'); return false; }
    return true;
  };

  LAB.apps = apps;

  LAB.ready(function () { apps._markRunning('finder'); }, 25);

  /* =========================================================== placeholders */
  function phWindow(appId, title, w, hh, extra) {
    var content = h('div', { class: 'lab-ph' }, extra && extra.node ? extra.node : h('p', { class: 'lab-ph-note' }, '（這是核心外殼的暫代視窗；正式的程式檔載入後會取代它。）'));
    var win = LAB.wm.open({
      appId: appId, title: title, width: w, height: hh, bar: (extra && extra.bar) || 'plain',
      theme: (extra && extra.theme) || 'light', content: content, icon: 'app-' + appId, minW: 320, minH: 200
    });
    return win;
  }

  apps._phMenus = {};   // menu.js registers these at its own eval time (it loads after this file)
  var MENU_TITLES = {
    finder: ['檔案', '編輯', '顯示方式', '前往', '視窗', '輔助說明'],
    terminal: ['Shell', '編輯', '顯示方式', '視窗', '輔助說明'],
    codex: ['File', 'Edit', 'View', 'Window', 'Help'],
    code: ['檔案', '編輯', '檢視', '前往', '視窗', '說明'],
    textedit: ['檔案', '編輯', '格式', '顯示方式', '視窗', '輔助說明'],
    about: ['視窗']
  };
  function placeholderMenus(appId) {
    return function () {
      return MENU_TITLES[appId].map(function (t) {
        var win = (t === '視窗' || t === 'Window');
        return { label: t, items: win ? LAB.menu.windowMenu(t === 'Window') : [{ label: '（練習版：還沒有項目）', enabled: false }] };
      });
    };
  }

  function dropList(path, win) {
    var box = h('div', { class: 'lab-ph-list', dataset: { lab: 'ph-finder-list' } });
    var title = h('div', { class: 'lab-ph-path' }, LAB.vfs.displayName(path));
    var cur = path;
    function render() {
      box.textContent = '';
      var items = [];
      try { items = LAB.vfs.visible(LAB.vfs.list(cur)); } catch (e) { items = []; }
      title.textContent = LAB.vfs.displayName(cur);
      win.setTitle(LAB.vfs.displayName(cur));
      items.forEach(function (st) {
        var row = h('div', { class: 'lab-ph-row', dataset: { lab: 'fd-item', path: st.path }, tabindex: '0' },
          LAB.icons.el(LAB.icons.forNode(st), { size: 22 }), h('span', null, st.name));
        row.addEventListener('dblclick', function () {
          if (st.type === 'dir') { cur = st.path; LAB.bus.emit('finder:navigate', { winId: win.id, path: cur, via: 'open' }); render(); }
          else LAB.apps.openPath(st.path, { via: 'finder' });
        });
        win.own(LAB.dnd.source(row, function () { return { kind: 'fs', paths: [st.path], from: 'finder', label: st.name, iconName: LAB.icons.forNode(st) }; }));
        box.appendChild(row);
      });
      if (!items.length) box.appendChild(h('p', { class: 'lab-ph-note' }, '（空的）'));
    }
    render();
    win.own(LAB.bus.on('fs:change', function () { if (!LAB.dnd.active()) render(); }));
    win.own(LAB.dnd.target(box, {
      id: 'finder:' + win.id + ':view',
      accept: function (pl) { return pl.kind === 'fs' && pl.from !== 'finder' ? 'move' : false; },
      drop: function (pl) { pl.paths.forEach(function (p) { try { LAB.vfs.move(p, cur, { by: 'finder' }); } catch (e) { /* ignore */ } }); }
    }));
    LAB.bus.emit('finder:navigate', { winId: win.id, path: cur, via: 'initial' });
    return { node: h('div', null, title, box), path: function () { return cur; } };
  }

  apps.register('finder', {
    title: 'Finder', en: 'Finder', aliases: ['finder'], icon: 'app-finder', dock: true, placeholder: true,
    open: function (args) {
      var path = (args && args.path) || LAB.vfs.HOME;
      var holder = { node: null };
      var win = LAB.wm.open({ appId: 'finder', title: LAB.vfs.displayName(path), width: 640, height: 420, bar: 'unified', content: h('div'), icon: 'app-finder', minW: 400, minH: 260 });
      var dl = dropList(path, win);
      win.body.textContent = '';
      win.body.appendChild(h('div', { class: 'lab-ph' }, dl.node));
      holder.node = dl.node;
      return win;
    },
    canHandle: function (p) { return !!LAB.vfs.stat(p); },
    handleOpen: function (p) {
      var st = LAB.vfs.stat(p);
      if (!st) return false;
      var path = st.type === 'dir' ? st.path : LAB.vfs.dirname(st.path);
      apps.get('finder').open({ path: path });
      return true;
    },
    canOpen: function (st) { return st.type === 'dir' ? 10 : 0 }
  });
  apps._phMenus.finder = placeholderMenus('finder');

  apps.register('terminal', {
    title: '終端機', en: 'Terminal', aliases: ['terminal', 'shell', 'zsh'], icon: 'app-terminal', dock: true, placeholder: true,
    open: function () {
      var win = phWindow('terminal', 'an — -zsh — 80×24', 640, 400);
      win.own(LAB.dnd.target(win.el, {
        id: 'terminal:' + win.id,
        accept: function (pl) { return pl.kind === 'fs' ? 'copy' : false; },
        drop: function (pl) { LAB.bus.emit('term:drop', { winId: win.id, paths: pl.paths.slice(), text: pl.paths.join(' ') + ' ' }); }
      }));
      return win;
    },
    canHandle: function () { return true; },
    handleOpen: function () { apps.get('terminal').open({}); return true; }
  });
  apps._phMenus.terminal = placeholderMenus('terminal');

  apps.register('codex', {
    title: 'Codex', en: 'Codex', aliases: ['codex', 'chatgpt'], icon: 'app-codex', dock: true, placeholder: true,
    open: function () {
      var side = h('div', { class: 'lab-ph-zone', dataset: { lab: 'ph-codex-sidebar' } }, 'sidebar（把資料夾拖到這裡）');
      var main = h('div', { class: 'lab-ph-zone', dataset: { lab: 'ph-codex-main' } }, 'main');
      var node = h('div', { class: 'lab-ph-split' }, side, main);
      var win = phWindow('codex', 'Codex', 760, 480, { node: node, bar: 'hidden', theme: 'dark' });
      function acc(pl) { return pl.kind === 'fs' && pl.paths.every(function (p) { return LAB.vfs.isDir(p); }) ? 'copy' : false; }
      function drop(pl) { LAB.bus.emit('codex:trust-prompt', { path: pl.paths[0] }); }
      win.own(LAB.dnd.target(side, { id: 'codex:' + win.id + ':sidebar', accept: acc, drop: drop }));
      win.own(LAB.dnd.target(main, { id: 'codex:' + win.id + ':main', accept: acc, drop: drop }));
      return win;
    },
    canHandle: function (p) { return LAB.vfs.isDir(p); },
    handleOpen: function (p) { LAB.bus.emit('codex:trust-prompt', { path: p }); apps.get('codex').open({}); return true; },
    canOpen: function (st) { return st.type === 'dir' ? 20 : 0; }
  });
  apps._phMenus.codex = placeholderMenus('codex');

  apps.register('code', {
    title: 'Code', en: 'Visual Studio Code', aliases: ['vscode', 'code'], icon: 'app-code', dock: true, placeholder: true,
    open: function () { return phWindow('code', 'Code', 760, 480, { theme: 'dark' }); },
    canHandle: function (p) { var s = LAB.vfs.stat(p); return !!s && (s.type === 'dir' || s.kind === 'text'); },
    handleOpen: function () { apps.get('code').open({}); return true; },
    canOpen: function (st) { return st.type === 'dir' ? 20 : (st.kind === 'text' ? 15 : 0); }
  });
  apps._phMenus.code = placeholderMenus('code');

  apps.register('textedit', {
    title: '文字編輯', en: 'TextEdit', aliases: ['textedit', 'text'], icon: 'app-textedit', dock: true, placeholder: true,
    open: function () { return phWindow('textedit', '未命名', 560, 420); },
    canHandle: function (p) { var s = LAB.vfs.stat(p); return !!s && s.kind === 'text'; },
    handleOpen: function (p) {
      var win = phWindow('textedit', LAB.vfs.basename(p), 560, 420);
      win.state.path = p;
      LAB.bus.emit('editor:open', { path: p, appId: 'textedit', winId: win.id });
      return true;
    },
    canOpen: function (st) { return st.kind === 'text' ? 20 : 0; }
  });
  apps._phMenus.textedit = placeholderMenus('textedit');

  apps.register('about', {
    title: '關於這個練習', en: 'About', aliases: ['about', '關於'], icon: 'app-about', dock: false, placeholder: true,
    open: function () {
      var node = h('div', { class: 'lab-ph-about' },
        h('h2', null, '關於這個練習'),
        h('p', null, '這是練習用的模擬環境，不是真的 Mac，也不是真的 AI。'),
        h('p', { class: 'lab-ph-note' }, 'macOS 與 Finder 是 Apple Inc. 的商標，Codex 是 OpenAI 的商標。這個練習是獨立的教學模擬，與兩家公司都沒有關係。'),
        h('p', { class: 'lab-ph-note' }, 'Copyright © 2026 JUNHAO CHEN・程式碼 MIT・內容 CC BY-NC-SA 4.0'));
      var win = LAB.wm.open({ appId: 'about', title: '關於這個練習', width: 520, height: 400, bar: 'plain', content: h('div', { class: 'lab-ph' }, node), singleton: 'about', minW: 360, minH: 260 });
      return win;
    }
  });
  apps._phMenus.about = placeholderMenus('about');
})(window.LAB);
