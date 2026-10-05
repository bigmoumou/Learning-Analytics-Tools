/* finder.js [SKIN] — Finder app (DESIGN §4.1) and LAB.finder (§3.13).
   Replaces the CORE placeholder: LAB.apps.register('finder', …) with the same id wins (§1.1).
   Every window-scoped bus listener, drop target and key handler goes through win.own (§3.6). File names are DATA: DOM is built with h()/textContent only.
   Round 5 (SPEC §7): 取得資訊 windows, 壓縮 (LAB.vfs.zipCreate), the column and gallery views, colour tags with the sidebar filter, search with a scope
   bar and 位置, image thumbnails, a fuller 前往 menu. Views: S.mode is icon | list | column | gallery; effMode() is what is really drawn (a search is always a list). */
(function (LAB) {
  'use strict';

  var h = LAB.util.h;
  var HOME = LAB.vfs.HOME;
  var TRASH = HOME + '/.Trash';
  var RECENTS = 'recents:';
  var instances = new Map();          // winId -> inst
  var recentFolders = [];             // folders the student visited, newest first (前往 › 最近使用的檔案夾)

  /* ------------------------------------------------------------ own glyphs (original art) */
  function glyph(inner) { return '<svg viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' + inner + '</g></svg>'; }
  LAB.icons.add('fd-airdrop', glyph('<circle cx="12" cy="12.5" r="1.3" fill="currentColor"/><path d="M8.6 9a4.8 4.8 0 0 1 6.8 0M6 6.4a8.4 8.4 0 0 1 12 0M9.6 16.8l2.4-3 2.4 3z"/>'));
  LAB.icons.add('fd-hdd', glyph('<rect x="3.5" y="7.5" width="17" height="9.5" rx="2.2"/><path d="M3.5 13h17"/><circle cx="17" cy="15.1" r=".7" fill="currentColor" stroke="none"/>'));
  LAB.icons.add('fd-trash', glyph('<path d="M5.5 7h13M9.5 7V5h5v2M7 7l.9 12h8.2L17 7M10.3 10.5v5.5M13.7 10.5v5.5"/>'));

  /* ------------------------------------------------------------------ helpers */
  var COLL = null;
  try { COLL = new Intl.Collator(['zh-Hant-TW', 'zh-TW'], { numeric: true, sensitivity: 'base' }); } catch (e) { COLL = null; }
  /* Latin / digit names first, then Chinese names (zhuyin order), like the Finder in a Chinese system language */
  function isHanStart(t) { var c = t.codePointAt(0); return c >= 0x2E80 && c !== undefined; }
  function cmpStr(a, b) {
    var ha = isHanStart(a) ? 1 : 0, hb = isHanStart(b) ? 1 : 0;
    if (ha !== hb) return ha - hb;
    if (COLL) { var r = COLL.compare(a, b); if (r !== 0) return r; }
    else {
      var la = a.toLowerCase(), lb = b.toLowerCase();
      if (la !== lb) return la < lb ? -1 : 1;
    }
    return a < b ? -1 : a > b ? 1 : 0;
  }

  function kindLabel(st) {
    if (st.type === 'dir') return '檔案夾';
    var ext = LAB.vfs.extname(st.name).toLowerCase();
    if (st.kind === 'zip' || ext === '.zip') return 'ZIP 封存檔';
    if (st.kind === 'app' || ext === '.app') return '應用程式';
    if (ext === '.md') return 'Markdown 文件';
    if (ext === '.txt') return '純文字文件';
    if (ext === '.csv') return 'CSV 文件';
    if (ext === '.pdf') return 'PDF 文件';
    if (ext === '.docx') return 'Microsoft Word 文件';
    if (ext === '.jpg' || ext === '.jpeg') return 'JPEG 圖像';
    if (ext === '.png') return 'PNG 圖像';
    if (ext === '.gif') return 'GIF 圖像';
    if (ext === '.heic') return 'HEIC 圖像';
    return '文件';
  }

  /* two-line icon label with a middle ellipsis for very long names (the full name stays in aria-label) */
  function takeWidth(cps, maxW, fromEnd) {
    var out = [], w = 0, i;
    if (fromEnd) {
      for (i = cps.length - 1; i >= 0; i--) {
        var cw = LAB.util.charWidth(cps[i].codePointAt(0));
        if (w + cw > maxW) break;
        w += cw; out.unshift(cps[i]);
      }
    } else {
      for (i = 0; i < cps.length; i++) {
        var cw2 = LAB.util.charWidth(cps[i].codePointAt(0));
        if (w + cw2 > maxW) break;
        w += cw2; out.push(cps[i]);
      }
    }
    return out.join('');
  }
  function shortName(name) {
    if (LAB.util.displayWidth(name) <= 28) return name;
    var cps = Array.from(name);
    return takeWidth(cps, 14, false) + '…' + takeWidth(cps, 11, true);
  }

  /* what the Finder shows as the name: the standard folders are localised (桌面, 文件 …), everything else keeps its name */
  function labelOf(st) { return st.type === 'dir' ? LAB.vfs.displayName(st.path) : st.name; }
  function sameDir(a, b) { return LAB.vfs.same(a, b); }
  function isTrash(p) { return !isVirt(p) && LAB.vfs.same(p, TRASH); }
  function underTrash(p) { return !isVirt(p) && LAB.vfs.isUnder(p, TRASH); }
  function trashCount() { try { return LAB.vfs.list(TRASH).length; } catch (e) { return 0; } }

  /* ------------------------------------------------------------ virtual places and colour tags (SPEC §7) */
  /* Real macOS colour names and order. The colours are our own flat swatches. */
  var TAGS = [
    { id: 'red', name: '紅色', color: '#ff5b4f' }, { id: 'orange', name: '橙色', color: '#ff9f0a' },
    { id: 'yellow', name: '黃色', color: '#ffd426' }, { id: 'green', name: '綠色', color: '#32c748' },
    { id: 'blue', name: '藍色', color: '#2a8bff' }, { id: 'purple', name: '紫色', color: '#bf5af2' },
    { id: 'gray', name: '灰色', color: '#a2a2a7' }
  ];
  var TAGBY = Object.create(null);
  TAGS.forEach(function (t) { TAGBY[t.id] = t; });
  /* a tag view is a virtual place like 最近項目: its id is 'tagred:' (letters only, so LAB.vfs treats it as a virtual id, §3.5) */
  function tagViewId(id) { return 'tag' + id + ':'; }
  function tagOfView(p) { var m = /^tag([a-z]+):$/.exec(String(p)); return m && TAGBY[m[1]] ? m[1] : null; }
  function isVirt(p) { return p === RECENTS || tagOfView(p) !== null; }

  function noteRecentFolder(p) {
    var i = recentFolders.indexOf(p);
    if (i >= 0) recentFolders.splice(i, 1);
    recentFolders.unshift(p);
    if (recentFolders.length > 10) recentFolders.length = 10;
  }
  var tagMap = new Map();             // canonical path -> [tag id, …] (tags stay with the file when it is moved or renamed, like on a Mac)
  function tagsOf(p) { return tagMap.get(p) || []; }
  function relocateTags(from, to, move) {
    var add = [];
    tagMap.forEach(function (ids, key) {
      if (key === from || key.indexOf(from + '/') === 0) add.push([to + key.slice(from.length), ids.slice(), key]);
    });
    add.forEach(function (a) { tagMap.set(a[0], a[1]); if (move) tagMap.delete(a[2]); });
  }
  function dropTags(p) {
    Array.from(tagMap.keys()).forEach(function (k) { if (k === p || k.indexOf(p + '/') === 0) tagMap.delete(k); });
  }
  LAB.bus.on('fs:change', function (e) {
    if (!e || !tagMap.size) return;
    if ((e.op === 'move' || e.op === 'rename') && e.from) relocateTags(e.from, e.path, true);
    else if (e.op === 'copy' && e.from) relocateTags(e.from, e.path, false);
    else if (e.op === 'remove') dropTags(e.path);
  });
  function tagDot(t) { return h('i', { class: 'fd-tagdot', style: { background: t.color }, title: t.name }); }
  function tagDots(ids) {
    var box = h('span', { class: 'fd-tags', 'aria-hidden': 'true' });
    ids.slice(0, 4).forEach(function (id) { if (TAGBY[id]) box.appendChild(tagDot(TAGBY[id])); });
    return box;
  }
  var refreshers = new Set();         // everything that shows tags and has to redraw when one changes (Finder windows, Info windows)
  function refreshAll() { refreshers.forEach(function (f) { try { f(); } catch (e) { console.error(e); } }); }
  function toggleTag(paths, id) {
    paths = paths.filter(function (p) { return LAB.vfs.exists(p); });
    if (!paths.length || !TAGBY[id]) return;
    var all = paths.every(function (p) { return tagsOf(p).indexOf(id) >= 0; });
    paths.forEach(function (p) {
      var cur = tagsOf(p).slice(), i = cur.indexOf(id);
      if (all) { if (i >= 0) cur.splice(i, 1); } else if (i < 0) cur.push(id);
      if (cur.length) tagMap.set(p, cur); else tagMap.delete(p);
    });
    LAB.bus.emit('finder:tag', { paths: paths.slice(), tag: id, on: !all });
    refreshAll();
  }
  function addTag(paths, id) {
    var ps = paths.filter(function (p) { return LAB.vfs.exists(p); });
    if (ps.length && !ps.every(function (p) { return tagsOf(p).indexOf(id) >= 0; })) toggleTag(ps, id);
  }
  function clearTags(paths) {
    var any = false;
    paths.forEach(function (p) { if (tagMap.delete(p)) any = true; });
    if (any) { LAB.bus.emit('finder:tag', { paths: paths.slice(), tag: null, on: false }); refreshAll(); }
  }
  /* the items of the 標籤 menu: a coloured dot and the name, ticked when every selected item has the tag */
  function tagMenuItems(getPaths) {
    var items = TAGS.map(function (t) {
      return {
        label: h('span', { class: 'fd-tagmenu' }, tagDot(t), t.name),
        checked: function () { var ps = getPaths(); return ps.length > 0 && ps.every(function (p) { return tagsOf(p).indexOf(t.id) >= 0; }); },
        action: function () { toggleTag(getPaths(), t.id); }
      };
    });
    items.push({ separator: true });
    items.push({ label: '移除所有標籤', enabled: function () { return getPaths().some(function (p) { return tagsOf(p).length > 0; }); }, action: function () { clearTags(getPaths()); } });
    return items;
  }
  LAB.store.register('finder-tags', {
    serialize: function () { return null; },
    restore: function () { tagMap.clear(); recentFolders = []; },
    reset: function () { tagMap.clear(); recentFolders = []; refreshAll(); }
  });

  /* 前往 menu entries that have no folder behind them in the practice Mac */
  function goUtilities(navigateFn) {
    var p = '/Applications/Utilities';
    if (LAB.vfs.isDir(p)) navigateFn(p, 'goto');
    else LAB.ui.toast('練習版沒有「工具程式」檔案夾');
  }
  function connectServer() { LAB.ui.toast('練習版不能連接伺服器'); }

  /* ------------------------------------------------------------ text helpers shared by the windows */
  var ZH_DAY = ['日', '一', '二', '三', '四', '五', '六'];
  function longDate(ms) {
    var f = LAB.util.fmt.finderDate(ms);
    if (/^(今天|昨天) /.test(f)) return f;
    var d = new Date(ms), hh = d.getHours() % 12 || 12, mm = d.getMinutes();
    return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日 週' + ZH_DAY[d.getDay()] + ' ' + (d.getHours() < 12 ? '上午' : '下午') + hh + ':' + (mm < 10 ? '0' : '') + mm;
  }
  function sizeLong(bytes) {
    var s = LAB.util.fmt.size(bytes);
    return bytes >= 1000 ? s + '（' + String(Math.round(bytes)).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + ' 位元組）' : s;
  }
  function dirTotals(path) {
    var bytes = 0, n = 0;
    (function rec(p) {
      var list;
      try { list = LAB.vfs.list(p); } catch (e) { return; }
      list.forEach(function (s) {
        if (n >= 5000) return;
        n++;
        if (s.type === 'dir') rec(s.path); else bytes += s.size;
      });
    })(path);
    return { bytes: bytes, items: n };
  }
  /* the folder chain with the names a Finder shows: 桌面 › Project (for the 位置 column of search results) */
  function whereText(path) {
    var dir = LAB.vfs.dirname(path), parts = [], cur = '';
    if (dir === HOME) return LAB.vfs.displayName(HOME);
    var underHome = LAB.vfs.isUnder(dir, HOME);
    var rel = underHome ? dir.slice(HOME.length) : dir;
    rel.split('/').filter(Boolean).forEach(function (seg) {
      cur += '/' + seg;
      parts.push(LAB.vfs.displayName((underHome ? HOME : '') + cur));
    });
    if (!underHome) parts.unshift(LAB.vfs.displayName('/'));
    return parts.join(' › ');
  }
  function placeText(path) {      // 位置: in the Info window, the whole way from the disk
    var dir = LAB.vfs.dirname(path), parts = [LAB.vfs.displayName('/')], cur = '';
    if (dir === '/') return parts[0];
    dir.split('/').filter(Boolean).forEach(function (seg) { cur += '/' + seg; parts.push(LAB.vfs.displayName(cur)); });
    return parts.join(' ▸ ');
  }

  /* ------------------------------------------------------------ image thumbnails */
  var IMG_EXT = /\.(png|jpe?g|gif|webp|bmp|heic)$/i;
  function isImage(st) { return !!st && st.type === 'file' && IMG_EXT.test(st.name); }
  var thumbCache = new Map();
  var badSrc = new Set();             // picture URLs that failed to load: not asked for again
  function hashStr(s) {
    var x = 2166136261;
    for (var i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); }
    return x >>> 0;
  }
  /* A fake photo drawn from the file name: used only for an image file that carries no picture of its own. */
  function sceneSvg(name) {
    var n = hashStr(name), v = n % 3, hue = (n >>> 4) % 360;
    function hsl(dh, s, l) { return 'hsl(' + ((hue + dh) % 360) + ',' + s + '%,' + l + '%)'; }
    var body;
    if (v === 0) {
      body = '<defs><linearGradient id="a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + hsl(200, 45, 34) + '"/><stop offset=".62" stop-color="' + hsl(20, 70, 72) + '"/></linearGradient></defs>' +
        '<rect width="320" height="240" fill="url(#a)"/><circle cx="214" cy="118" r="22" fill="' + hsl(50, 90, 86) + '"/>' +
        '<path d="M0 150L52 108 96 140 150 96 214 146 262 112 320 150V240H0z" fill="' + hsl(210, 30, 28) + '"/>' +
        '<rect y="150" width="320" height="90" fill="' + hsl(205, 40, 40) + '"/><path d="M180 156h68M196 170h40M168 184h92" stroke="' + hsl(40, 80, 80) + '" stroke-width="3" stroke-linecap="round" opacity=".55"/>';
    } else if (v === 1) {
      body = '<rect width="320" height="240" fill="' + hsl(190, 55, 70) + '"/><ellipse cx="90" cy="54" rx="42" ry="13" fill="#fff" opacity=".85"/><ellipse cx="124" cy="62" rx="30" ry="11" fill="#fff" opacity=".8"/><ellipse cx="236" cy="40" rx="36" ry="11" fill="#fff" opacity=".75"/>' +
        '<path d="M0 150Q80 112 170 142T320 126V240H0z" fill="' + hsl(100, 42, 52) + '"/><path d="M0 188Q110 150 210 184T320 170V240H0z" fill="' + hsl(105, 45, 38) + '"/>';
    } else {
      body = '<defs><linearGradient id="a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + hsl(250, 40, 40) + '"/><stop offset="1" stop-color="' + hsl(330, 60, 78) + '"/></linearGradient></defs>' +
        '<rect width="320" height="240" fill="url(#a)"/><path d="M-10 190L110 70 150 112 188 58 330 190z" fill="' + hsl(240, 25, 30) + '"/><path d="M110 70l-24 28 20-7 14 14 14-14 12 8z" fill="#f4f6fb"/><path d="M188 58l-20 26 18-6 12 12 14-12z" fill="#f4f6fb" opacity=".95"/>' +
        '<rect y="190" width="320" height="50" fill="' + hsl(235, 28, 20) + '"/>';
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 240" width="320" height="240">' + body + '</svg>';
  }
  /* picture source for an image file: the seed photo behind it (LAB.seed.imageUrl, found by file name so copies and moves still show it),
     else a data: URI stored in the file, a stored SVG, else a drawn placeholder. It is always shown through <img>, so a file's text can never become markup. */
  function thumbSrc(st) {
    if (!isImage(st)) return null;
    var key = st.path + '|' + st.mtime + '|' + st.size;
    if (thumbCache.has(key)) return thumbCache.get(key);
    var src = null, c = '';
    try {
      if (LAB.seed && typeof LAB.seed.imageUrl === 'function') src = LAB.seed.imageUrl(st.path) || null;      // the three seed photos (img/photos/)
      if (src && badSrc.has(src)) src = null;
    } catch (e0) { src = null; }
    if (!src) {
      try { c = LAB.vfs.readFile(st.path) || ''; } catch (e1) { c = ''; }
      if (/^data:image\/(png|jpe?g|gif|webp|svg\+xml)[;,]/i.test(c) && c.length < 400000) src = c;
      else if (/^\s*<svg[\s>]/i.test(c) && c.length < 200000) src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(c);
    }
    if (!src) src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(sceneSvg(st.name));
    if (thumbCache.size > 80) thumbCache.clear();
    thumbCache.set(key, src);
    return src;
  }

  /* ------------------------------------------------------------ rename (shared by the window and the Info window) */
  /* cb({ok, path}) once it is over: ok = the name changed, path = where the item is now. Conflicts and extension changes ask a sheet on `win`. */
  function renameCore(win, oldPath, typed, cb) {
    var st = LAB.vfs.stat(oldPath);
    if (!st) { cb({ ok: false, path: oldPath }); return; }
    var name = String(typed).replace(/\//g, ':');
    if (name.trim() === '' || name === st.name) { cb({ ok: false, path: oldPath }); return; }
    var oldExt = st.type === 'file' ? LAB.vfs.extname(st.name) : '';
    var newExt = st.type === 'file' ? LAB.vfs.extname(name) : '';
    function commit(finalName) {
      try {
        var np = LAB.vfs.rename(oldPath, finalName, { by: 'finder' });
        LAB.undo.push('重新命名「' + st.name + '」', function () { LAB.vfs.rename(np, st.name, { by: 'finder' }); });
        cb({ ok: true, path: np });
      } catch (e) {
        cb({ ok: false, path: oldPath });
        if (e.code === 'EEXIST') LAB.ui.alert(win, { title: '已經有一個名稱為「' + finalName + '」的項目存在於此位置。', buttons: [{ label: '好', value: true, 'default': true }] });
        else if (e.code === 'ENAMETOOLONG') LAB.ui.toast('這個名稱太長了');
        else if (e.code === 'EPROTECTED') LAB.ui.vfsFail(win, e, '', oldPath);
        else LAB.ui.toast('這個名稱不能用');
      }
    }
    if (oldExt && newExt.toLowerCase() !== oldExt.toLowerCase()) {
      var removing = newExt === '';
      LAB.ui.alert(win, {
        title: removing ? '您確定要移除副檔名「' + oldExt + '」嗎？' : '您確定要將副檔名從「' + oldExt + '」變更為「' + newExt + '」嗎？',
        text: '如果您更改副檔名，這個項目可能會用不同的程式打開。',
        buttons: [
          { label: '保留 ' + oldExt, value: 'keep', cancel: true },
          { label: removing ? '移除' : '使用 ' + newExt, value: 'use', 'default': true }
        ]
      }).then(function (v) {
        if (v === 'use') commit(name);
        else commit(name.slice(0, name.length - newExt.length) + oldExt);
      });
      return;
    }
    commit(name);
  }

  /* ------------------------------------------------------------ 壓縮 (LAB.vfs.zipCreate is written by the Terminal builder; guarded until it exists) */
  function compressPaths(win, paths, done) {
    paths = (paths || []).filter(function (p) { return LAB.vfs.exists(p) && !underTrash(p); });
    if (!paths.length) return false;
    if (typeof LAB.vfs.zipCreate !== 'function') { LAB.ui.toast('壓縮還沒準備好（練習版）'); return false; }
    var dir = LAB.vfs.dirname(paths[0]);
    var st0 = LAB.vfs.stat(paths[0]);
    var base = paths.length === 1 ? st0.name : '封存';        // one item: 「X.zip」; several: 「封存.zip」, 「封存 2.zip」 (like Archive Utility)
    var dest = LAB.vfs.join(dir, LAB.vfs.uniqueName(dir, base, '.zip'));
    function ok(r) {
      if (r && r.ok === false) {
        if (r.error === 'EACCES') LAB.ui.toast('這裡不能新增東西（沒有權限）');
        else if (r.error === 'ENOSPC') LAB.ui.toast('這些項目太大了，練習版壓縮不了');
        else LAB.ui.toast('無法壓縮（' + LAB.vfs.errText(r.error) + '）');
        return;
      }
      var out = (r && r.path) || dest;
      LAB.undo.push('壓縮「' + st0.name + '」' + (paths.length > 1 ? '等 ' + paths.length + ' 個項目' : ''), function () { LAB.vfs.trash(out, { by: 'finder' }); });
      if (done) done(out);
    }
    function bad(e) { LAB.ui.vfsFail(win, e, '無法壓縮這個項目' + (e && e.code ? '（' + LAB.vfs.errText(e.code) + '）' : ''), dest); }
    try {
      var r = LAB.vfs.zipCreate(paths, dest, { by: 'finder' });
      if (r && typeof r.then === 'function') r.then(ok, bad); else ok(r);
    } catch (e) { bad(e); return false; }
    return true;
  }

  /* ------------------------------------------------------------ 取得資訊: one small window per item (appId finder, so the menu bar stays Finder's) */
  var INFO_OPEN = { general: true, more: true, name: true, openwith: false, preview: true, perms: true };
  function openInfo(path) {
    var p0 = LAB.vfs.canon(path);
    var st0 = LAB.vfs.stat(p0);
    if (!st0) { LAB.ui.toast('找不到這個項目'); return null; }
    var cur = { path: p0 };
    var open = Object.assign({}, INFO_OPEN);
    var body = h('div', { class: 'fd-info', dataset: { lab: 'fd-info' } });
    var win = LAB.wm.open({
      appId: 'finder', title: LAB.vfs.displayName(p0) + ' 資訊', width: 284, height: 560, minW: 284, minH: 260,
      bar: 'plain', theme: 'light', content: body, resizable: false, singleton: 'fd-info:' + p0, icon: 'app-finder'
    });
    if (win.state.isInfo) return win;          // the same item was already open: wm focused it
    win.state.isInfo = true; win.state.infoPath = p0;
    var timer = null, imgDims = null;

    function row(label, value, cls) {
      return h('div', { class: 'fd-ir' + (cls ? ' ' + cls : '') }, h('div', { class: 'fd-ir-l' }, label), h('div', { class: 'fd-ir-v' }, value));
    }
    function section(key, title, rows) {
      var hd = h('button', { type: 'button', class: 'fd-ix-h' + (open[key] ? ' is-open' : ''), 'aria-expanded': open[key] ? 'true' : 'false', dataset: { lab: 'fd-info-sec', sec: key } },
        h('span', { class: 'fd-ix-tri', 'aria-hidden': 'true' }), h('span', null, title));
      hd.addEventListener('click', function () { open[key] = !open[key]; build(); });
      var bd = h('div', { class: 'fd-ix-b' }, rows);
      if (!open[key]) bd.hidden = true;
      return h('div', { class: 'fd-ix', dataset: { sec: key } }, hd, bd);
    }
    function tagPicker(path) {
      var btn = h('button', { type: 'button', class: 'fd-ix-tagbtn', dataset: { lab: 'fd-info-tags' } }, tagsOf(path).length ? '' : '新增標籤⋯');
      var ids = tagsOf(path);
      if (ids.length) { btn.appendChild(tagDots(ids)); btn.appendChild(h('span', { class: 'fd-ix-tagnames' }, ids.map(function (i) { return TAGBY[i] ? TAGBY[i].name : ''; }).join('、'))); }
      btn.addEventListener('click', function () {
        var r = LAB.stage.rectOf(btn);
        LAB.menu.contextMenu(r.x, r.y + r.h + 2, tagMenuItems(function () { return [path]; }));
      });
      return btn;
    }

    function build() {
      var path = cur.path;
      var st = LAB.vfs.stat(path);
      if (!st) return;
      var keepTop = body.scrollTop;
      var dir = st.type === 'dir';
      var tot = dir ? dirTotals(path) : null;
      var bytes = dir ? tot.bytes : st.size;
      var image = isImage(st);
      body.textContent = '';
      var ico = h('div', { class: 'fd-ix-ico', 'aria-hidden': 'true' });
      var src = image ? thumbSrc(st) : null;
      if (src) ico.appendChild(h('img', { class: 'fd-thumb', src: src, alt: '', draggable: 'false' }));
      else ico.innerHTML = LAB.icons.get(LAB.icons.forNode(st), { size: 52 });
      var nameStr = LAB.vfs.displayName(path);
      var sizeStr = dir ? (tot.bytes ? LAB.util.fmt.size(tot.bytes) : '0 KB') : LAB.util.fmt.size(st.size);
      body.appendChild(h('div', { class: 'fd-ix-head' }, ico,
        h('div', { class: 'fd-ix-hm' },
          h('div', { class: 'fd-ix-name', dataset: { lab: 'fd-info-name' } }, nameStr),
          h('div', { class: 'fd-ix-sub' }, kindLabel(st) + ' — ' + sizeStr),
          h('div', { class: 'fd-ix-sub' }, '修改日期：' + longDate(st.mtime)))));
      body.appendChild(h('div', { class: 'fd-ix-tagrow' }, tagPicker(path)));

      var gen = [
        row('種類：', kindLabel(st)),
        row('大小：', dir ? sizeLong(bytes) + '，' + tot.items + ' 個項目' : sizeLong(bytes)),
        row('位置：', placeText(path), 'is-wrap'),
        row('建立日期：', longDate(st.ctime || st.mtime)),
        row('修改日期：', longDate(st.mtime))
      ];
      body.appendChild(section('general', '一般資訊：', gen));
      if (image) body.appendChild(section('more', '更多資訊：', [row('尺寸：', imgDims || '—')]));
      var inp = h('input', { type: 'text', class: 'fd-ix-in', 'aria-label': '名稱與副檔名', spellcheck: 'false', autocomplete: 'off', dataset: { lab: 'fd-info-rename' } });
      inp.value = st.name;
      var committing = false;
      function commitName() {
        if (committing) return;
        committing = true;
        renameCore(win, cur.path, inp.value, function (r) {
          committing = false;
          if (r.ok) { cur.path = r.path; win.state.infoPath = r.path; win.setTitle(LAB.vfs.displayName(r.path) + ' 資訊'); }
          build();
        });
      }
      inp.addEventListener('keydown', function (e) {
        e.stopPropagation();
        if (LAB.ui.isImeEnter(e)) return;
        if (e.key === 'Enter') { e.preventDefault(); commitName(); }
        else if (e.key === 'Escape') { e.preventDefault(); inp.value = st.name; inp.blur(); }
      });
      inp.addEventListener('blur', function () { if (inp.value !== st.name) commitName(); });
      var nameRows = [h('div', { class: 'fd-ix-inwrap' }, inp)];
      if (!dir) nameRows.push(h('label', { class: 'fd-ix-chk is-off' }, h('input', { type: 'checkbox', disabled: true, 'aria-label': '隱藏副檔名' }), '隱藏副檔名'));
      body.appendChild(section('name', '名稱與副檔名：', nameRows));
      if (!dir) {
        var defId = LAB.apps.defaultFor(path);
        var defDef = LAB.apps.get(defId);
        var nice = { textedit: '文字編輯', quicklook: '快速查看', archive: '封存工具程式', finder: 'Finder' };
        var appName = nice[defId] || (defDef && defDef.title) || '快速查看';
        var pop = h('button', { type: 'button', class: 'fd-ix-pop', dataset: { lab: 'fd-info-openwith' } }, appName + '（預設）', h('span', { class: 'fd-ix-popc', 'aria-hidden': 'true' }, '⌃'));
        pop.addEventListener('click', function () {
          var r = LAB.stage.rectOf(pop);
          var ow = LAB.apps.openWith(path);
          LAB.menu.contextMenu(r.x, r.y + r.h + 2, ow.map(function (o) { return { label: o.label, action: function () { LAB.ui.toast('練習版不能更改預設的程式'); } }; }));
        });
        body.appendChild(section('openwith', '打開方式：', [pop, h('div', { class: 'fd-ix-note' }, '使用這個程式打開所有這種文件。')]));
      }
      if (image) {
        var big = h('img', { class: 'fd-ix-prev', src: src, alt: '', draggable: 'false' });
        big.addEventListener('load', function () {
          if (!big.naturalWidth) return;
          imgDims = Math.round(big.naturalWidth) + ' × ' + Math.round(big.naturalHeight);
          var v = body.querySelector('.fd-ix[data-sec="more"] .fd-ir-v');
          if (v) v.textContent = imgDims;
        });
        body.appendChild(section('preview', '預覽：', [big]));
      }
      var perms = h('div', { class: 'fd-ix-perm' },
        h('div', { class: 'fd-ix-permhead' }, h('span', null, '名稱'), h('span', null, '權限')),
        h('div', { class: 'fd-ix-permrow' }, h('span', null, 'an（自己）'), h('span', null, '讀與寫')),
        h('div', { class: 'fd-ix-permrow' }, h('span', null, 'staff'), h('span', null, '唯讀')),
        h('div', { class: 'fd-ix-permrow' }, h('span', null, 'everyone'), h('span', null, '唯讀')));
      body.appendChild(section('perms', '共享與權限：', [h('div', { class: 'fd-ix-note is-first' }, '您可以讀取與寫入。'), perms]));
      body.scrollTop = keepTop;
    }

    function refresh() {
      if (win.closed) return;
      if (!LAB.vfs.exists(cur.path)) { win.close(true); return; }
      if (document.activeElement && body.contains(document.activeElement) && document.activeElement.tagName === 'INPUT') return;
      build();
    }
    function onFs(ev) {
      if (!ev) return;
      if ((ev.op === 'rename' || ev.op === 'move') && ev.from && LAB.vfs.same(ev.from, cur.path)) {
        cur.path = ev.path; win.state.infoPath = ev.path;
        win.setTitle(LAB.vfs.displayName(ev.path) + ' 資訊');
      }
      if (timer) clearTimeout(timer);
      timer = setTimeout(function () { timer = null; refresh(); }, 120);
    }
    win.own(LAB.bus.on('fs:change', onFs));
    refreshers.add(refresh);
    win.own(function () { refreshers.delete(refresh); if (timer) clearTimeout(timer); });
    build();
    LAB.bus.emit('finder:info', { path: p0 });
    return win;
  }
  function openInfoFor(paths) {
    var list = (paths || []).filter(function (p) { return LAB.vfs.exists(p); });
    if (!list.length) return;
    var cap = list.slice(0, 5);
    cap.forEach(function (p) { openInfo(p); });
    if (list.length > cap.length) LAB.ui.toast('一次最多打開 5 個資訊視窗');
  }

  /* 30 most recently modified visible files under home (excluding Library and .Trash, which are hidden) */
  function recentsList() {
    var out = [];
    (function rec(dir, depth) {
      var list;
      try { list = LAB.vfs.list(dir); } catch (e) { return; }
      list.forEach(function (st) {
        if (st.hidden) return;
        if (st.type === 'dir') { if (depth < 12) rec(st.path, depth + 1); }
        else out.push(st);
      });
    })(HOME, 0);
    out.sort(function (a, b) { return b.mtime - a.mtime || cmpStr(a.name, b.name); });
    return out.slice(0, 30);
  }

  /* finder:navigate 'via' is one of this fixed set (§3.3); callers such as Spotlight or the Terminal pass their own name, which maps to 'open' */
  var VIAS = { sidebar: 1, pathbar: 1, back: 1, forward: 1, up: 1, open: 1, goto: 1, desktop: 1, dock: 1, initial: 1 };
  function normVia(v, dflt) { return VIAS[v] === 1 ? v : dflt; }
  function tx(e) { return LAB.stage.toStage(e.clientX, e.clientY); }

  /* ================================================================ one Finder window */
  function createFinder(startPath, via, opts) {
    opts = opts || {};
    var S = {
      path: startPath, hist: [startPath], hi: 0,
      mode: 'icon', sort: { key: 'name', dir: 1 }, sortTouched: false,
      sel: new Set(), anchor: null, filter: '', scope: 'mac', chain: [], expanded: new Set(),
      showHidden: false, showPath: true, showStatus: true,
      renaming: null, order: [], rendered: false, sheet: null,
      pendingSel: opts.select ? opts.select.slice() : null, topCount: 0, lastDirSig: ''
    };
    var items = new Map();            // path -> rec
    var win = null;
    var renderTimer = null, pendingFlush = false, disposed = false;
    var host = null, gridEl = null, listEl = null, headEl = null;   // host = element that holds item elements

    /* ---------- DOM skeleton ---------- */
    var backBtn = h('button', { type: 'button', class: 'fd-nb', 'aria-label': '返回', title: '返回', disabled: true, dataset: { lab: 'fd-back' } });
    var fwdBtn = h('button', { type: 'button', class: 'fd-nb', 'aria-label': '下一頁', title: '下一頁', disabled: true, dataset: { lab: 'fd-forward' } });
    backBtn.innerHTML = LAB.icons.get('chev-left', { size: 17 });
    fwdBtn.innerHTML = LAB.icons.get('chev-right', { size: 17 });
    var titleIco = h('span', { class: 'fd-title-ico', 'aria-hidden': 'true' });
    var titleTxt = h('span', { class: 'fd-title-txt' });
    var trashBtn = h('button', { type: 'button', class: 'fd-trashbtn', hidden: true, dataset: { lab: 'fd-empty-trash' } }, '清倒');
    var viewIconBtn = h('button', { type: 'button', class: 'fd-vb is-on', 'aria-label': '圖示', title: '圖示（⌘1）', 'aria-pressed': 'true', dataset: { lab: 'fd-view-icon' } });
    var viewListBtn = h('button', { type: 'button', class: 'fd-vb', 'aria-label': '列表', title: '列表（⌘2）', 'aria-pressed': 'false', dataset: { lab: 'fd-view-list' } });
    viewIconBtn.innerHTML = LAB.icons.get('icon-view', { size: 16 });
    viewListBtn.innerHTML = LAB.icons.get('list-view', { size: 16 });
    var viewColBtn = h('button', { type: 'button', class: 'fd-vb', 'aria-label': '直欄', title: '直欄（⌘3）', 'aria-pressed': 'false', dataset: { lab: 'fd-view-columns' } });
    var viewGalBtn = h('button', { type: 'button', class: 'fd-vb', 'aria-label': '圖庫', title: '圖庫（⌘4）', 'aria-pressed': 'false', dataset: { lab: 'fd-view-gallery' } });
    viewColBtn.innerHTML = LAB.icons.get('columns-view', { size: 16 });
    viewGalBtn.innerHTML = LAB.icons.get('gallery-view', { size: 16 });
    var searchInput = h('input', { type: 'text', class: 'fd-search-in', placeholder: '搜尋', 'aria-label': '搜尋', spellcheck: 'false', autocomplete: 'off', dataset: { lab: 'fd-search' } });
    var searchIco = h('span', { class: 'fd-search-ico', 'aria-hidden': 'true' });
    searchIco.innerHTML = LAB.icons.get('search', { size: 13 });

    var toolbar = h('div', { class: 'fd-tb' },
      h('div', { class: 'fd-navbtns' }, backBtn, fwdBtn),
      h('div', { class: 'fd-title', dataset: { drag: '1' } }, titleIco, titleTxt),
      h('div', { class: 'fd-spacer', dataset: { drag: '1' } }),
      trashBtn,
      h('div', { class: 'fd-seg', role: 'group', 'aria-label': '顯示方式' }, viewIconBtn, viewListBtn, viewColBtn, viewGalBtn),
      h('div', { class: 'fd-search' }, searchIco, searchInput));

    var sidebarEl = h('nav', { class: 'fd-sidebar', 'aria-label': '側邊欄' });
    var scrollEl = h('div', { class: 'fd-scroll', role: 'listbox', 'aria-multiselectable': 'true', 'aria-label': '檔案列表', tabindex: '-1', dataset: { lab: 'fd-scroll' } });
    var statusEl = h('div', { class: 'fd-status', role: 'status', dataset: { lab: 'fd-status' } });
    var pathEl = h('div', { class: 'fd-pathbar', 'aria-label': '路徑列', dataset: { lab: 'fd-pathbar' } });
    // the bar under the toolbar that appears while searching: 搜尋： 這台 Mac / 「目前的檔案夾」
    var scopeMacBtn = h('button', { type: 'button', class: 'fd-scope-b', 'aria-pressed': 'true', dataset: { lab: 'fd-scope-mac' } }, '這台 Mac');
    var scopeDirBtn = h('button', { type: 'button', class: 'fd-scope-b', 'aria-pressed': 'false', dataset: { lab: 'fd-scope-folder' } });
    var scopeEl = h('div', { class: 'fd-scope', hidden: true, role: 'group', 'aria-label': '搜尋範圍', dataset: { lab: 'fd-scope' } },
      h('span', { class: 'fd-scope-l' }, '搜尋：'), scopeMacBtn, scopeDirBtn);
    var root = h('div', { class: 'fd-root' },
      h('div', { class: 'fd-body' }, sidebarEl, h('div', { class: 'fd-main' }, scopeEl, scrollEl)),
      statusEl, pathEl);

    /* sidebar */
    var sideRecs = [];
    function sideItem(def) {
      var btn = h('button', { type: 'button', class: 'fd-side-item' + (def.inert ? ' is-inert' : ''), dataset: { lab: 'fd-sidebar-item', path: def.path || '' } });
      var ico = h('span', { class: 'fd-side-ico', 'aria-hidden': 'true' });
      ico.innerHTML = LAB.icons.get(def.icon, { size: 16 });
      btn.appendChild(ico);
      btn.appendChild(h('span', { class: 'fd-side-txt' }, def.label));
      if (def.inert) { btn.setAttribute('aria-disabled', 'true'); btn.addEventListener('click', function () { LAB.ui.toast('AirDrop 在練習版裡不能用'); }); }
      else btn.addEventListener('click', function () { navigate(def.path, 'sidebar'); });
      sideRecs.push({ btn: btn, path: def.path || null });
      return btn;
    }
    sidebarEl.appendChild(h('div', { class: 'fd-side-sec' }, '喜好項目'));
    [{ label: 'AirDrop', icon: 'fd-airdrop', inert: true },
     { path: RECENTS, label: '最近項目', icon: 'clock' },
     { path: '/Applications', label: LAB.vfs.displayName('/Applications'), icon: 'apps' },
     { path: HOME + '/Desktop', label: LAB.vfs.displayName(HOME + '/Desktop'), icon: 'desktop' },
     { path: HOME + '/Documents', label: LAB.vfs.displayName(HOME + '/Documents'), icon: 'doc-sm' },
     { path: HOME + '/Downloads', label: LAB.vfs.displayName(HOME + '/Downloads'), icon: 'download' },
     { path: HOME, label: LAB.vfs.displayName(HOME), icon: 'house' }].forEach(function (d) { sidebarEl.appendChild(sideItem(d)); });
    sidebarEl.appendChild(h('div', { class: 'fd-side-sec' }, '位置'));
    [{ path: '/', label: 'Macintosh HD', icon: 'fd-hdd' },
     { path: TRASH, label: LAB.vfs.displayName(TRASH), icon: 'fd-trash' }].forEach(function (d) { sidebarEl.appendChild(sideItem(d)); });
    // 標籤: one entry per colour; a click lists everything with that tag (a virtual place like 最近項目), a drop tags the dropped items
    sidebarEl.appendChild(h('div', { class: 'fd-side-sec' }, '標籤'));
    TAGS.forEach(function (t) {
      var vp = tagViewId(t.id);
      var btn = h('button', { type: 'button', class: 'fd-side-item fd-side-tag', dataset: { lab: 'fd-sidebar-tag', tag: t.id, path: vp } },
        h('span', { class: 'fd-side-ico', 'aria-hidden': 'true' }, tagDot(t)),
        h('span', { class: 'fd-side-txt' }, t.name));
      btn.addEventListener('click', function () { navigate(vp, 'sidebar'); });
      sideRecs.push({ btn: btn, path: vp, tag: t.id });
      sidebarEl.appendChild(btn);
    });

    /* ---------- selection ---------- */
    var inRender = false;
    function orderedSel() { return S.order.filter(function (p) { return S.sel.has(p); }); }
    function applySel() {
      items.forEach(function (rec, p) {
        var on = S.sel.has(p);
        rec.el.classList.toggle('is-sel', on);
        rec.el.classList.toggle('is-chain', !on && rec.mode === 'column' && S.chain.indexOf(p) >= 0);
        rec.el.setAttribute('aria-selected', on ? 'true' : 'false');
      });
    }
    function setSel(paths, o) {
      o = o || {};
      var next = new Set(paths);
      var same = next.size === S.sel.size;
      if (same) next.forEach(function (p) { if (!S.sel.has(p)) same = false; });
      S.sel = next;
      applySel();
      updateStatus();
      if (!inRender && !same) {
        var em = effMode();
        if (em === 'column') render();                 // the selection decides which columns and which preview are shown
        else if (em === 'gallery') updateGallery();
        else if (barFollowsSel()) updatePathbar();
      }
      if (!same && !o.silent) LAB.bus.emit('finder:select', { winId: win ? win.id : null, paths: orderedSel() });
    }
    function selectRange(toPath) {
      var a = S.order.indexOf(S.anchor), b = S.order.indexOf(toPath);
      if (a < 0) { setSel([toPath]); S.anchor = toPath; return; }
      var lo = Math.min(a, b), hi = Math.max(a, b);
      setSel(S.order.slice(lo, hi + 1));
    }

    /* ---------- listing ---------- */
    function searching() { return S.filter !== ''; }
    /* search results are always a list with a 位置 column; 最近項目 and the colour views are flat lists of files, so they have no columns */
    function effMode() { return (searching() || (isVirt(S.path) && S.mode === 'column')) ? 'list' : S.mode; }
    function showWhere() { return isVirt(S.path) || searching(); }
    /* the folder new things go into: the one the title names. In the column view that is the selected folder (its contents fill
       the last column) or the last column's folder, not the folder the window was opened on. */
    function curDir() { return (S.mode === 'column' && !searching()) ? titleFolder() : S.path; }
    /* make the folder whose contents are in the last column the active column (so a new item can be selected in it) */
    function adoptTail() {
      if (S.mode !== 'column' || searching()) return;
      var tgt = titleFolder(), act = S.chain.length ? S.chain[S.chain.length - 1] : S.path;
      if (tgt !== act && LAB.vfs.isDir(tgt) && sameDir(LAB.vfs.dirname(tgt), act)) { S.chain = S.chain.concat([tgt]); S.sel = new Set(); }
    }
    function effSort() { return (S.path === RECENTS && !S.sortTouched) ? { key: 'date', dir: -1 } : S.sort; }
    function tagRank(st) {
      var best = 99;
      tagsOf(st.path).forEach(function (id) { for (var i = 0; i < TAGS.length; i++) { if (TAGS[i].id === id && i < best) best = i; } });
      return best;
    }
    function sortList(list) {
      var es = effSort();
      var k = es.key, d = es.dir;
      list.sort(function (a, b) {
        var r = 0;
        if (k === 'date') r = a.mtime - b.mtime;
        else if (k === 'size') r = (a.type === 'dir' ? -1 : a.size) - (b.type === 'dir' ? -1 : b.size);
        else if (k === 'kind') r = cmpStr(kindLabel(a), kindLabel(b));
        else if (k === 'where') r = cmpStr(LAB.vfs.dirname(a.path), LAB.vfs.dirname(b.path));
        else if (k === 'tag') r = tagRank(a) - tagRank(b);
        else r = cmpStr(labelOf(a), labelOf(b));
        r = r * d;
        if (r === 0) r = cmpStr(labelOf(a), labelOf(b));
        if (r === 0) r = a.path < b.path ? -1 : a.path > b.path ? 1 : 0;
        return r;
      });
      return list;
    }
    function dirEntries(path) {
      var list;
      try { list = LAB.vfs.list(path); } catch (e) { return []; }
      if (!S.showHidden) list = list.filter(function (s) { return !s.hidden; });
      return list;
    }
    function matchesFilter(s) { return s.name.toLowerCase().indexOf(S.filter) >= 0 || labelOf(s).toLowerCase().indexOf(S.filter) >= 0; }
    /* like the real search: matches anywhere below the scope (這台 Mac = everything, or the current folder), one flat list; the trash is not searched */
    function searchRows() {
      var found = [];
      var root = (S.scope === 'folder' && !isVirt(S.path)) ? S.path : '/';
      (function walk(dir, depth) {
        dirEntries(dir).forEach(function (st) {
          if (found.length >= 300 || isTrash(st.path)) return;
          if (matchesFilter(st)) found.push(st);
          if (st.type === 'dir' && depth < 10) walk(st.path, depth + 1);
        });
      })(root, 0);
      return sortList(found).map(function (st) { return { st: st, depth: 0 }; });
    }
    function tagRows(id) {
      var list = [];
      tagMap.forEach(function (ids, p) {
        if (ids.indexOf(id) < 0 || underTrash(p)) return;
        var st = LAB.vfs.stat(p);
        if (st && (S.showHidden || !st.hidden)) list.push(st);
      });
      return sortList(list).map(function (st) { return { st: st, depth: 0 }; });
    }
    function buildRows() {
      var rows = [];
      if (searching()) return searchRows();
      if (S.path === RECENTS) {
        sortList(recentsList()).forEach(function (st) { rows.push({ st: st, depth: 0 }); });
        return rows;
      }
      var tg = tagOfView(S.path);
      if (tg) return tagRows(tg);
      (function add(dir, depth) {
        var list = dirEntries(dir);
        sortList(list).forEach(function (st) {
          rows.push({ st: st, depth: depth });
          if (S.mode === 'list' && st.type === 'dir' && S.expanded.has(st.path) && depth < 10) add(st.path, depth + 1);
        });
      })(S.path, 0);
      return rows;
    }
    /* column view: the folders selected so far, each one opening the next column. A step that no longer exists cuts the chain there. */
    function columnDirs() {
      var dirs = [S.path], ch = [];
      for (var i = 0; i < S.chain.length; i++) {
        var c = S.chain[i];
        if (LAB.vfs.isDir(c) && sameDir(LAB.vfs.dirname(c), dirs[dirs.length - 1])) { dirs.push(c); ch.push(c); } else break;
      }
      S.chain = ch;
      return dirs;
    }

    /* ---------- container (icon grid / list / columns / gallery) ---------- */
    var colsEl = null, galEl = null, galStage = null, galInfo = null, galStrip = null, prevEl = null;
    var colEls = [];                      // [{el, off}] one per column (column view)
    function disposeItem(rec) { rec.offs.forEach(function (f) { try { f(); } catch (e) { /* ignore */ } }); rec.offs = []; }
    function clearItems() {
      items.forEach(function (rec) { disposeItem(rec); if (rec.el.parentNode) rec.el.parentNode.removeChild(rec.el); });
      items.clear();
    }
    function disposeCols() {
      colEls.forEach(function (c) { try { c.off(); } catch (e) { /* ignore */ } });
      colEls = [];
      prevEl = null;
    }
    function makeCol(k) {
      var el = h('div', { class: 'fd-col', dataset: { col: String(k) } });
      var off = LAB.dnd.target(el, {
        id: 'finder:' + win.id + ':column:' + k,
        accept: function (pl, mods) { return el.dataset.dir ? acceptInto(pl, el.dataset.dir, mods) : false; },
        enter: function () { el.classList.add('is-drop'); },
        leave: function () { el.classList.remove('is-drop'); },
        drop: function (pl, ctx) { el.classList.remove('is-drop'); transferInto(pl.paths, el.dataset.dir, ctx.mode === 'copy' ? 'copy' : 'move'); }
      });
      return { el: el, off: off };
    }
    function ensureColCount(n) {
      while (colEls.length > n) { var c = colEls.pop(); c.off(); if (c.el.parentNode) c.el.parentNode.removeChild(c.el); }
      while (colEls.length < n) { var nc = makeCol(colEls.length); colsEl.appendChild(nc.el); colEls.push(nc); }
    }
    function ensureContainer() {
      var want = effMode();
      if (host && host.dataset.mode === want) return;
      clearItems();
      disposeCols();
      scrollEl.textContent = '';
      gridEl = listEl = headEl = colsEl = galEl = galStage = galInfo = galStrip = null;
      scrollEl.classList.toggle('is-cols', want === 'column');
      scrollEl.classList.toggle('is-gal', want === 'gallery');
      S.colCount = -1;
      if (want === 'icon') {
        gridEl = h('div', { class: 'fd-grid', dataset: { mode: 'icon' } });
        host = gridEl;
        scrollEl.appendChild(gridEl);
      } else if (want === 'column') {
        colsEl = h('div', { class: 'fd-cols', dataset: { mode: 'column' } });
        host = colsEl;
        scrollEl.appendChild(colsEl);
      } else if (want === 'gallery') {
        galStage = h('div', { class: 'fd-gal-stage', dataset: { lab: 'fd-gallery-stage' } });
        galInfo = h('div', { class: 'fd-gal-info' });
        galStrip = h('div', { class: 'fd-gal-strip', dataset: { mode: 'gallery' } });
        galEl = h('div', { class: 'fd-gal' }, h('div', { class: 'fd-gal-top' }, galStage, galInfo), galStrip);
        host = galStrip;
        scrollEl.appendChild(galEl);
      } else {
        headEl = h('div', { class: 'fd-listhead', role: 'row' });
        var rowsEl = h('div', { class: 'fd-rows', dataset: { mode: 'list' } });
        listEl = h('div', { class: 'fd-list' }, headEl, rowsEl);
        host = rowsEl;
        scrollEl.appendChild(listEl);
        [['name', '名稱'], ['where', '位置'], ['date', '修改日期'], ['size', '大小'], ['kind', '種類']].forEach(function (c) {
          var cell = h('button', { type: 'button', class: 'fd-hc fd-h-' + c[0], dataset: { col: c[0], lab: 'fd-col' } },
            h('span', { class: 'fd-hc-t' }, c[1]), h('span', { class: 'fd-hc-s', 'aria-hidden': 'true' }));
          cell.addEventListener('click', function () { sortBy(c[0]); });
          headEl.appendChild(cell);
        });
      }
      S.rendered = false;
    }
    function updateHead() {
      if (!listEl) return;
      listEl.classList.toggle('is-where', showWhere());
      var es = effSort();
      var cells = headEl.children;
      for (var i = 0; i < cells.length; i++) {
        var c = cells[i], on = c.dataset.col === es.key;
        c.classList.toggle('is-sorted', on);
        c.setAttribute('aria-sort', on ? (es.dir > 0 ? 'ascending' : 'descending') : 'none');
        var s = c.querySelector('.fd-hc-s');
        s.innerHTML = on ? LAB.icons.get(es.dir > 0 ? 'sort-asc' : 'sort-desc', { size: 11 }) : '';
      }
    }
    function sortBy(key) {
      var es = effSort();
      if (es.key === key) S.sort = { key: key, dir: -es.dir };
      else S.sort = { key: key, dir: key === 'date' ? -1 : 1 };
      S.sortTouched = true;
      render();
    }
    function setSortKey(key) {          // 顯示方式 › 排序方式: choose the key without flipping the direction
      S.sort = { key: key, dir: key === 'date' ? -1 : 1 };
      S.sortTouched = true;
      render();
    }

    /* ---------- items ---------- */
    function itemAccept(rec, pl, mods) { return acceptInto(pl, rec.st.path, mods); }

    var MODE_CLS = { icon: 'fd-icon', list: 'fd-row', column: 'fd-crow', gallery: 'fd-gcell' };
    function makeItem(st) {
      var em = effMode();
      var iconName = LAB.icons.forNode(st);
      var el = h('div', { class: 'fd-item ' + MODE_CLS[em], role: 'option', 'aria-selected': 'false', dataset: { lab: 'fd-item', path: st.path } });
      var rec = { el: el, st: st, icon: iconName, iconKey: '', offs: [], nameEl: null, mode: em, cells: {}, tagEl: h('span', { class: 'fd-tags', 'aria-hidden': 'true' }), tagSig: null };
      if (em === 'icon' || em === 'gallery') {
        var ico = h('div', { class: 'fd-ico', 'aria-hidden': 'true' });
        var nt0 = h('span', { class: 'fd-name-t' });
        var nm = h('div', { class: 'fd-name' }, rec.tagEl, nt0);
        el.appendChild(ico); el.appendChild(nm);
        rec.icoEl = ico; rec.nameEl = nt0; rec.nameBox = nm;
      } else if (em === 'column') {
        var cico = h('span', { class: 'fd-rico', 'aria-hidden': 'true' });
        var cnt = h('span', { class: 'fd-name-t' });
        var chev = h('span', { class: 'fd-chev', 'aria-hidden': 'true' });
        chev.innerHTML = LAB.icons.get('chev-right', { size: 11 });
        el.appendChild(cico); el.appendChild(cnt); el.appendChild(rec.tagEl); el.appendChild(chev);
        rec.icoEl = cico; rec.nameEl = cnt; rec.nameBox = el; rec.chev = chev;
      } else {
        var disc = h('span', { class: 'fd-disc', 'aria-hidden': 'true' });
        var rico = h('span', { class: 'fd-rico', 'aria-hidden': 'true' });
        var nt = h('span', { class: 'fd-name-t' });
        var c0 = h('div', { class: 'fd-c fd-c-name' }, disc, rico, nt, rec.tagEl);
        var cw = h('div', { class: 'fd-c fd-c-where' });
        var cd = h('div', { class: 'fd-c fd-c-date' });
        var cs = h('div', { class: 'fd-c fd-c-size' });
        var ck = h('div', { class: 'fd-c fd-c-kind' });
        el.appendChild(c0); el.appendChild(cw); el.appendChild(cd); el.appendChild(cs); el.appendChild(ck);
        rec.icoEl = rico; rec.nameEl = nt; rec.nameBox = c0; rec.disc = disc;
        rec.cells = { where: cw, date: cd, size: cs, kind: ck };
        disc.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
        disc.addEventListener('click', function (e) { e.stopPropagation(); toggleExpand(rec.st.path); });
        disc.addEventListener('dblclick', function (e) { e.stopPropagation(); });
      }

      rec.offs.push(LAB.dnd.source(el, function () {
        var p = rec.st.path;
        var paths = S.sel.has(p) ? orderedSel() : [p];
        return { kind: 'fs', paths: paths, from: 'finder', label: paths.length > 1 ? paths.length + ' 個項目' : labelOf(rec.st), iconName: LAB.icons.forNode(rec.st) };
      }, {
        onPressSelect: function (e) {
          var p = rec.st.path;
          if (S.renaming) return;
          if (rec.mode === 'column') {
            // a click in an earlier column cuts the chain back to that column, then selects there
            var k = -1;
            (S.colDirs || []).forEach(function (d, i) { if (sameDir(d, LAB.vfs.dirname(p))) k = i; });
            if (k >= 0 && k !== S.chain.length) { S.chain = S.colDirs.slice(1, k + 1); S.anchor = p; setSel([p]); return; }
          }
          if (e.shiftKey) { selectRange(p); }
          else if (e.metaKey || e.ctrlKey) {
            var n = new Set(S.sel);
            if (n.has(p)) n.delete(p); else n.add(p);
            S.anchor = p;
            setSel(Array.from(n));
          } else if (!S.sel.has(p)) { S.anchor = p; setSel([p]); }
          else S.anchor = p;
        },
        onClickSelect: function (e) {
          if (e.shiftKey || e.metaKey || e.ctrlKey) return;
          setSel([rec.st.path]);
        }
      }));
      el.addEventListener('dblclick', function (e) {
        e.stopPropagation();
        if (S.renaming) return;
        openItem(rec.st.path);
      });
      if (st.type === 'dir') {
        rec.offs.push(LAB.dnd.target(el, {
          id: 'finder:' + win.id + ':folder:' + st.path,
          accept: function (pl, mods) { return itemAccept(rec, pl, mods); },
          enter: function () { el.classList.add('is-drop'); },
          leave: function () { el.classList.remove('is-drop'); },
          drop: function (pl, ctx) { el.classList.remove('is-drop'); transferInto(pl.paths, rec.st.path, ctx.mode === 'copy' ? 'copy' : 'move'); }
        }));
      }
      return rec;
    }

    /* the icon, or for a picture its thumbnail */
    function paintIcon(rec, st, size) {
      var src = isImage(st) ? thumbSrc(st) : null;
      var iname = LAB.icons.forNode(st);
      var key = (src ? 'img|' + st.mtime + '|' + st.size : iname) + '|' + size;
      if (rec.iconKey === key) return;
      rec.iconKey = key; rec.icon = iname;
      if (src) {
        rec.icoEl.textContent = '';
        var im = h('img', { class: 'fd-thumb', src: src, alt: '', draggable: 'false' });
        im.addEventListener('error', function () { badSrc.add(src); thumbCache.clear(); refreshAll(); });
        rec.icoEl.appendChild(im);
        rec.icoEl.classList.add('has-thumb');
      } else {
        rec.icoEl.classList.remove('has-thumb');
        rec.icoEl.innerHTML = LAB.icons.get(iname, { size: size });
      }
    }

    function updateItem(rec, st, row, idx) {
      var m = rec.mode;
      rec.st = st;
      paintIcon(rec, st, m === 'icon' ? 60 : m === 'gallery' ? 44 : m === 'column' ? 16 : 18);
      var renamingThis = S.renaming === st.path;
      if (!renamingThis) {
        var label = (m === 'icon' || m === 'gallery') ? shortName(labelOf(st)) : labelOf(st);
        if (rec.nameEl.textContent !== label) rec.nameEl.textContent = label;
      }
      rec.el.setAttribute('aria-label', labelOf(st));
      rec.el.classList.toggle('is-dim', !!st.hidden);
      rec.el.classList.toggle('is-odd', idx % 2 === 1);
      var tg = tagsOf(st.path), sig = tg.join(',');
      if (rec.tagSig !== sig) {
        rec.tagSig = sig;
        rec.tagEl.textContent = '';
        tg.slice(0, 4).forEach(function (id) { if (TAGBY[id]) rec.tagEl.appendChild(tagDot(TAGBY[id])); });
        rec.el.classList.toggle('has-tags', tg.length > 0);
      }
      if (m === 'list') {
        rec.el.style.setProperty('--depth', String(row.depth));
        rec.disc.classList.toggle('has-kids', st.type === 'dir' && st.count > 0 && !showWhere());
        rec.disc.classList.toggle('is-open', S.expanded.has(st.path));
        var dt = LAB.util.fmt.finderDate(st.mtime);
        if (rec.cells.date.textContent !== dt) rec.cells.date.textContent = dt;
        var sz = st.type === 'dir' ? '--' : LAB.util.fmt.size(st.size);
        if (rec.cells.size.textContent !== sz) rec.cells.size.textContent = sz;
        var kd = kindLabel(st);
        if (rec.cells.kind.textContent !== kd) rec.cells.kind.textContent = kd;
        var wh = showWhere() ? whereText(st.path) : '';
        if (rec.cells.where.textContent !== wh) rec.cells.where.textContent = wh;
        rec.cells.where.title = showWhere() ? st.path : '';
      } else if (m === 'column') {
        rec.chev.hidden = st.type !== 'dir';
      }
    }

    function removeItem(p) {
      var rec = items.get(p);
      if (!rec) return;
      disposeItem(rec);
      if (rec.el.parentNode) rec.el.parentNode.removeChild(rec.el);
      items.delete(p);
    }

    /* ---------- the preview / information pane (column view, gallery) ---------- */
    function buildPane(st, big) {
      var box = h('div', { class: 'fd-pane' });
      var src = isImage(st) ? thumbSrc(st) : null;
      if (big) {
        var pv = h('div', { class: 'fd-pane-prev' });
        if (src) pv.appendChild(h('img', { class: 'fd-pane-img', src: src, alt: '', draggable: 'false' }));
        else pv.innerHTML = LAB.icons.get(LAB.icons.forNode(st), { size: 96 });
        box.appendChild(pv);
      }
      box.appendChild(h('div', { class: 'fd-pane-name' }, labelOf(st)));
      box.appendChild(h('div', { class: 'fd-pane-sub' }, kindLabel(st) + (st.type === 'dir' ? ' — ' + (st.count || 0) + ' 個項目' : ' — ' + LAB.util.fmt.size(st.size))));
      box.appendChild(h('div', { class: 'fd-pane-sec' }, '資訊'));
      var rows = h('div', { class: 'fd-pane-rows' });
      function pr(l, v) { rows.appendChild(h('div', { class: 'fd-pane-r' }, h('span', { class: 'fd-pane-l' }, l), h('span', { class: 'fd-pane-v' }, v))); return rows.lastChild; }
      pr('建立日期', longDate(st.ctime || st.mtime));
      pr('修改日期', longDate(st.mtime));
      var dimRow = src ? pr('尺寸', '—') : null;
      if (dimRow) {
        var probe = new Image();
        probe.onload = function () { dimRow.lastChild.textContent = Math.round(probe.naturalWidth) + ' × ' + Math.round(probe.naturalHeight); };
        probe.src = src;
      }
      var tg = tagsOf(st.path);
      var tgv = h('span', { class: 'fd-pane-v' });
      if (tg.length) tgv.appendChild(tagDots(tg)); else tgv.textContent = '新增標籤⋯';
      var tgRow = h('div', { class: 'fd-pane-r is-tags' }, h('span', { class: 'fd-pane-l' }, '標籤'), tgv);
      tgRow.addEventListener('click', function () {
        var r = LAB.stage.rectOf(tgRow);
        LAB.menu.contextMenu(r.x + 40, r.y + r.h, tagMenuItems(function () { return [st.path]; }));
      });
      rows.appendChild(tgRow);
      box.appendChild(rows);
      var more = h('button', { type: 'button', class: 'fd-pane-more', dataset: { lab: 'fd-pane-info' } }, '更多⋯');
      more.addEventListener('click', function () { openInfo(st.path); });
      box.appendChild(more);
      return box;
    }
    function updateGallery() {
      if (!galStage) return;
      galStage.textContent = '';
      galInfo.textContent = '';
      var ps = orderedSel();
      if (!ps.length) { galStage.appendChild(h('div', { class: 'fd-gal-empty' }, S.order.length ? '沒有選取的項目' : '沒有項目')); return; }
      if (ps.length > 1) { galStage.appendChild(h('div', { class: 'fd-gal-empty' }, '已選擇 ' + ps.length + ' 個項目')); return; }
      var st = LAB.vfs.stat(ps[0]);
      if (!st) return;
      var src = isImage(st) ? thumbSrc(st) : null;
      if (src) galStage.appendChild(h('img', { class: 'fd-gal-img', src: src, alt: '', draggable: 'false' }));
      else { var ico = h('div', { class: 'fd-gal-ico', 'aria-hidden': 'true' }); ico.innerHTML = LAB.icons.get(LAB.icons.forNode(st), { size: 150 }); galStage.appendChild(ico); }
      galInfo.appendChild(buildPane(st, false));
    }

    /* ---------- render (reconcile by data-path) ---------- */
    function reconcileFlat(rows) {
      var seen = new Set();
      var typeOf = new Map();
      rows.forEach(function (r) { seen.add(r.st.path); typeOf.set(r.st.path, r.st.type); });
      Array.from(items.keys()).forEach(function (p) {
        var rec = items.get(p);
        var keep = seen.has(p) || (S.renaming === p && LAB.vfs.exists(p));
        var typeChanged = seen.has(p) && rec.st.type !== typeOf.get(p);
        if (!keep || typeChanged) removeItem(p);
      });
      rows.forEach(function (r, i) {
        var st = r.st;
        var rec = items.get(st.path);
        if (!rec) {
          rec = makeItem(st);
          items.set(st.path, rec);
          if (S.rendered) rec.el.classList.add('is-new');
        }
        updateItem(rec, st, r, i);
        var at = host.children[i];
        if (at !== rec.el) host.insertBefore(rec.el, at || null);
      });
    }
    function layoutColumns(dirs) {
      var act = dirs[dirs.length - 1];
      var only = S.sel.size === 1 ? Array.from(S.sel)[0] : null;
      var ost = only ? LAB.vfs.stat(only) : null;
      var tail = null, prev = null;
      if (ost && sameDir(LAB.vfs.dirname(ost.path), act)) { if (ost.type === 'dir') tail = ost.path; else prev = ost; }
      var all = dirs.slice();
      if (tail) all.push(tail);
      S.colDirs = all;
      var lists = all.map(function (d) { return sortList(dirEntries(d)); });
      var seen = new Set();
      lists.forEach(function (l) { l.forEach(function (st) { seen.add(st.path); }); });
      Array.from(items.keys()).forEach(function (p) {
        if (!seen.has(p) && !(S.renaming === p && LAB.vfs.exists(p))) removeItem(p);
      });
      if (prevEl && prevEl.parentNode) prevEl.parentNode.removeChild(prevEl);
      prevEl = null;
      ensureColCount(all.length);
      lists.forEach(function (list, k) {
        var colEl = colEls[k].el;
        colEl.dataset.dir = all[k];
        colEl.classList.toggle('is-active', k === dirs.length - 1);
        list.forEach(function (st, i) {
          var rec = items.get(st.path);
          if (rec && rec.st.type !== st.type) { removeItem(st.path); rec = null; }
          if (!rec) {
            rec = makeItem(st);
            items.set(st.path, rec);
            if (S.rendered) rec.el.classList.add('is-new');
          }
          updateItem(rec, st, { depth: 0 }, i);
          var at = colEl.children[i];
          if (at !== rec.el) colEl.insertBefore(rec.el, at || null);
        });
      });
      if (prev) {
        prevEl = h('div', { class: 'fd-colprev', dataset: { lab: 'fd-preview' } }, buildPane(prev, true));
        colsEl.appendChild(prevEl);
      }
      var n = all.length + (prev ? 1 : 0);
      if (n !== S.colCount) {
        // show the newest column, with the left edge on a column boundary (columns are 200 px wide)
        S.colCount = n;
        colsEl.scrollLeft = Math.max(0, Math.ceil((colsEl.scrollWidth - colsEl.clientWidth) / 200) * 200);
      }
    }
    function render() {
      if (disposed || !win) return;
      if (renderTimer) { clearTimeout(renderTimer); renderTimer = null; }
      if (!isVirt(S.path) && !LAB.vfs.isDir(S.path)) {
        var q = S.path;
        while (q !== '/' && !LAB.vfs.isDir(q)) q = LAB.vfs.dirname(q);
        navigate(q, 'up');
        return;
      }
      inRender = true;
      try {
        ensureContainer();
        var em = effMode();
        var dirs = null, rows;
        if (em === 'column') {
          dirs = columnDirs();
          rows = sortList(dirEntries(dirs[dirs.length - 1])).map(function (st) { return { st: st, depth: 0 }; });
        } else rows = buildRows();
        S.order = rows.map(function (r) { return r.st.path; });
        S.topCount = rows.filter(function (r) { return r.depth === 0; }).length;
        if (!dirs) reconcileFlat(rows);
        // selection: drop paths that no longer exist, then apply a pending selection (reveal / new folder)
        var inRows = new Set(S.order);
        var keepSel = Array.from(S.sel).filter(function (p) { return inRows.has(p); });
        var showPath = null;
        if (S.pendingSel) {
          var ps = S.pendingSel.filter(function (p) { return inRows.has(p); });
          if (ps.length) {
            S.pendingSel = null;
            keepSel = ps;
            S.anchor = ps[0];
            setSel(ps);
            showPath = ps[0];
          }
        }
        if (em === 'gallery' && !keepSel.length && S.order.length) { keepSel = [S.order[0]]; S.anchor = keepSel[0]; }   // a gallery always shows something
        if (keepSel.length !== S.sel.size || (em === 'gallery' && !S.sel.size)) setSel(keepSel, { silent: true });
        if (dirs) layoutColumns(dirs);
        if (showPath) { var rc = items.get(showPath); if (rc) ensureVisible(rc.el); }
        applySel();
        updateHead();
        updateStatus();
        updateDynamicChrome();
        updateScope();
        if (em === 'gallery') updateGallery();
        updatePathbar();
        S.rendered = true;
      } finally { inRender = false; }
    }
    function scheduleRender() {
      if (disposed || renderTimer) return;
      renderTimer = setTimeout(function () {
        renderTimer = null;
        if (LAB.dnd.active()) { pendingFlush = true; return; }
        render();
      }, 100);
    }

    function ensureVisible(el) {
      var sc = LAB.stage.scale || 1;
      var r = el.getBoundingClientRect();
      if (el.classList.contains('fd-gcell')) {          // the gallery's film strip scrolls sideways
        var sr = galStrip.getBoundingClientRect();
        if (r.left < sr.left) galStrip.scrollLeft -= (sr.left - r.left) / sc + 8;
        else if (r.right > sr.right) galStrip.scrollLeft += (r.right - sr.right) / sc + 8;
        return;
      }
      var scroller = el.classList.contains('fd-crow') ? el.parentNode : scrollEl;
      var s = scroller.getBoundingClientRect();
      var headH = (el.classList.contains('fd-row') ? 22 : 0) * sc;
      if (r.top < s.top + headH) scroller.scrollTop -= (s.top + headH - r.top) / sc + 2;
      else if (r.bottom > s.bottom) scroller.scrollTop += (r.bottom - s.bottom) / sc + 2;
    }

    /* ---------- chrome ---------- */
    /* what the title, the path bar and the sidebar talk about */
    function titleFolder() {
      if (effMode() === 'column') {
        var only = S.sel.size === 1 ? Array.from(S.sel)[0] : null;
        if (only && LAB.vfs.isDir(only)) return only;
        return S.chain.length ? S.chain[S.chain.length - 1] : S.path;      // the last column's folder
      }
      return S.path;
    }
    function titleName() {
      if (searching()) return '搜尋';
      var tg = tagOfView(S.path);
      if (tg) return TAGBY[tg].name;
      return LAB.vfs.displayName(titleFolder());
    }
    function titleIconFor(path) {
      if (path === RECENTS) return 'clock';
      if (tagOfView(path)) return 'tag';
      if (searching()) return 'search';
      if (isTrash(path)) return trashCount() ? 'app-trash-full' : 'app-trash-empty';
      if (path === '/') return 'fd-hdd';
      return 'folder';
    }
    function updateDynamicChrome() {
      var name = titleName();
      var iname = 'folder';
      try { iname = titleIconFor(effMode() === 'column' ? titleFolder() : S.path); } catch (e) { iname = 'folder'; }
      titleIco.innerHTML = LAB.icons.get(iname, { size: 17 });
      if (titleTxt.textContent !== name) titleTxt.textContent = name;
      if (win && win.getTitle() !== name) win.setTitle(name);
      trashBtn.hidden = !isTrash(S.path);
      trashBtn.disabled = !isTrash(S.path) || trashCount() === 0;
    }
    function updateScope() {
      var on = searching();
      scopeEl.hidden = !on;
      if (!on) return;
      var canFolder = !isVirt(S.path);
      scopeDirBtn.hidden = !canFolder;
      if (canFolder) scopeDirBtn.textContent = '「' + LAB.vfs.displayName(S.path) + '」';
      var folder = canFolder && S.scope === 'folder';
      scopeMacBtn.classList.toggle('is-on', !folder);
      scopeDirBtn.classList.toggle('is-on', folder);
      scopeMacBtn.setAttribute('aria-pressed', folder ? 'false' : 'true');
      scopeDirBtn.setAttribute('aria-pressed', folder ? 'true' : 'false');
    }
    function segsFor(path) {
      if (!path || isVirt(path)) return [];
      var segs = [{ path: '/', label: LAB.vfs.displayName('/') }];
      if (path === '/') return segs;
      var parts = path.split('/').filter(Boolean), cur = '';
      parts.forEach(function (pt) { cur += '/' + pt; segs.push({ path: cur, label: LAB.vfs.displayName(cur) }); });
      return segs;
    }
    /* where the path bar points: the folder, or (in a list of results, tags or columns) the one selected item */
    function barFollowsSel() { return isVirt(S.path) || searching() || effMode() === 'column'; }
    function barPath() {
      var only = S.sel.size === 1 ? Array.from(S.sel)[0] : null;
      if (effMode() === 'column') return only && LAB.vfs.exists(only) ? only : curDir();
      if (isVirt(S.path) || searching()) return only && LAB.vfs.exists(only) ? only : null;
      return S.path;
    }
    var pathTargets = [], barSig = null;
    function buildPathbar() {
      pathTargets.forEach(function (f) { f(); });
      pathTargets = [];
      pathEl.textContent = '';
      pathEl.classList.remove('is-clipped');
      var segs = segsFor(barPath());
      barSig = segs.map(function (s) { return s.path; }).join('|');
      segs.forEach(function (sg, i) {
        if (i) pathEl.appendChild(h('span', { class: 'fd-psep', 'aria-hidden': 'true' }, '›'));
        var ico = h('span', { class: 'fd-ps-ico', 'aria-hidden': 'true' });
        ico.innerHTML = LAB.icons.get(i === 0 ? 'fd-hdd' : (LAB.vfs.isDir(sg.path) ? 'folder' : LAB.icons.forNode(LAB.vfs.stat(sg.path))), { size: 14 });
        var b = h('button', { type: 'button', class: 'fd-ps' + (i === segs.length - 1 ? ' is-last' : ''), dataset: { lab: 'fd-pathbar-seg', path: sg.path } }, ico, h('span', null, sg.label));
        b.addEventListener('click', function () {
          if (LAB.vfs.isDir(sg.path)) navigate(sg.path, 'pathbar');
          else if (LAB.vfs.dirname(sg.path)) { S.pendingSel = [sg.path]; navigate(LAB.vfs.dirname(sg.path), 'pathbar'); S.pendingSel = null; }
        });
        pathEl.appendChild(b);
        pathTargets.push(LAB.dnd.target(b, {
          id: 'finder:' + win.id + ':pathbar:' + sg.path,
          accept: function (pl, mods) { return acceptInto(pl, sg.path, mods); },
          enter: function () { b.classList.add('is-drop'); },
          leave: function () { b.classList.remove('is-drop'); },
          drop: function (pl, ctx) { b.classList.remove('is-drop'); transferInto(pl.paths, sg.path, ctx.mode === 'copy' ? 'copy' : 'move'); }
        }));
      });
      if (pathEl.scrollWidth > pathEl.clientWidth + 1) pathEl.classList.add('is-clipped');
    }
    function updatePathbar() {
      var segs = segsFor(barPath());
      var sig = segs.map(function (s) { return s.path; }).join('|');
      if (sig !== barSig) buildPathbar();
    }
    function updateChrome() {
      buildPathbar();
      backBtn.disabled = S.hi <= 0;
      fwdBtn.disabled = S.hi >= S.hist.length - 1;
      sideRecs.forEach(function (r) {
        if (!r.path) return;
        var cur = isVirt(S.path) ? r.path === S.path : (!isVirt(r.path) && LAB.vfs.same(r.path, S.path));
        r.btn.classList.toggle('is-cur', cur);
        if (cur) r.btn.setAttribute('aria-current', 'page'); else r.btn.removeAttribute('aria-current');
      });
      [[viewIconBtn, 'icon'], [viewListBtn, 'list'], [viewColBtn, 'column'], [viewGalBtn, 'gallery']].forEach(function (b) {
        b[0].classList.toggle('is-on', S.mode === b[1]);
        b[0].setAttribute('aria-pressed', S.mode === b[1] ? 'true' : 'false');
      });
      root.classList.toggle('no-path', !S.showPath);
      root.classList.toggle('no-status', !S.showStatus);
      updateDynamicChrome();
      updateScope();
    }
    function updateStatus() {
      var total = S.topCount;
      var n = S.sel.size;
      var txt = n ? ('已選擇 ' + n + ' 個項目（共 ' + total + ' 個）') : (total + ' 個項目');
      if (statusEl.textContent !== txt) statusEl.textContent = txt;
    }

    /* ---------- navigation ---------- */
    function navigate(path, how, o) {
      o = o || {};
      var p = isVirt(path) ? path : LAB.vfs.canon(path);
      if (!isVirt(p) && !LAB.vfs.isDir(p)) return false;
      var same = p === S.path;
      var wasSearching = searching();
      if (wasSearching) { S.filter = ''; searchInput.value = ''; }
      if (!o.noPush && !same) {
        S.hist = S.hist.slice(0, S.hi + 1);
        S.hist.push(p);
        S.hi = S.hist.length - 1;
      }
      if (!same) {
        S.path = p;
        S.scope = 'mac';
        S.chain = [];
        S.expanded = new Set();
        S.sel = new Set();
        S.anchor = null;
        S.rendered = false;
        scrollEl.scrollTop = 0;
        if (win) win.state.path = p;
        render();
      } else if (wasSearching) render();
      if (!isVirt(p)) noteRecentFolder(p);
      updateChrome();
      LAB.bus.emit('finder:navigate', { winId: win.id, path: p, via: how });
      return true;
    }
    function goBack() {
      while (S.hi > 0) {
        S.hi--;
        if (navigate(S.hist[S.hi], 'back', { noPush: true })) return true;
      }
      return false;
    }
    function goForward() {
      while (S.hi < S.hist.length - 1) {
        S.hi++;
        if (navigate(S.hist[S.hi], 'forward', { noPush: true })) return true;
      }
      return false;
    }
    function goUp() {
      if (effMode() === 'column' && S.chain.length) { colLeft(); return true; }
      if (isVirt(S.path) || S.path === '/') return false;
      return navigate(LAB.vfs.dirname(S.path), 'up');
    }
    function setMode(m) {
      if (S.mode === m) return;
      S.mode = m;
      S.chain = [];
      render();
      updateChrome();
      LAB.bus.emit('finder:view', { winId: win.id, mode: m });
    }
    function toggleExpand(p, force) {
      var on = force === undefined ? !S.expanded.has(p) : !!force;
      if (on) S.expanded.add(p); else S.expanded.delete(p);
      render();
    }

    function openItem(path) {
      var st = LAB.vfs.stat(path);
      if (!st) return;
      if (st.type === 'dir') { navigate(st.path, 'open'); return; }
      LAB.apps.openPath(st.path, { via: 'finder' });
    }
    function openSelection() {
      orderedSel().forEach(openItem);
    }

    /* ---------- drag and drop into this window ---------- */
    function acceptInto(pl, dest, mods) {
      if (!pl || pl.kind !== 'fs' || !pl.paths || !pl.paths.length) return false;
      if (isVirt(dest) || !LAB.vfs.isDir(dest)) return false;
      if (dest === '/' || LAB.vfs.same(dest, '/Applications') || LAB.vfs.same(dest, '/Users')) return false;   // a real Mac asks for an administrator here
      var allSameParent = true;
      for (var i = 0; i < pl.paths.length; i++) {
        var p = pl.paths[i];
        var st = LAB.vfs.stat(p);
        if (!st) return false;
        if (st.type === 'dir' && (LAB.vfs.same(p, dest) || LAB.vfs.isUnder(dest, p))) return false;
        if (!sameDir(LAB.vfs.dirname(st.path), dest)) allSameParent = false;
      }
      if (isTrash(dest)) {
        if (mods && mods.mode === 'copy') return false;
        return allSameParent ? false : 'move';
      }
      if (allSameParent) return false;
      return (mods && (mods.altKey || mods.mode === 'copy')) ? 'copy' : 'move';
    }

    function transferInto(paths, destDir, mode) {
      var vfs = LAB.vfs;
      var i = 0;
      function next() {
        if (i >= paths.length) return Promise.resolve();
        var src = paths[i++];
        var st = vfs.stat(src);
        if (!st) return next();
        if (isTrash(destDir)) {
          trashPaths([st.path]);
          return next();
        }
        if (mode === 'move' && sameDir(vfs.dirname(st.path), destDir)) return next();
        if (st.type === 'dir' && (vfs.same(st.path, destDir) || vfs.isUnder(destDir, st.path))) return next();
        var dest = vfs.join(destDir, st.name);
        var replaced = false;
        function doIt(target, overwrite) {
          try {
            if (mode === 'copy') vfs.copy(st.path, target, { by: 'finder', recursive: true });
            else {
              var from = st.path;
              var to = vfs.move(st.path, target, { by: 'finder', overwrite: overwrite !== false });
              if (overwrite === false || !replaced) LAB.undo.push('移動「' + st.name + '」', function () { vfs.move(to, from, { by: 'finder', overwrite: false }); });
            }
          } catch (e) { LAB.ui.vfsFail(win, e, '這個項目移不過去（' + vfs.errText(e.code) + '）', st.path); }
        }
        if (vfs.exists(dest) && !vfs.same(dest, st.path)) {
          return LAB.ui.alert(win, {
            title: '已經有一個名稱為「' + st.name + '」的項目存在於此位置。您要用正在' + (mode === 'copy' ? '拷貝' : '移動') + '的項目取代它嗎？',
            buttons: [
              { label: '保留兩者', value: 'both' },
              { label: '停止', value: 'stop', cancel: true },
              { label: '取代', value: 'replace', 'default': true }
            ]
          }).then(function (v) {
            if (v === 'stop' || v === null) { i = paths.length; return; }
            if (v === 'both') {
              var ext = st.type === 'file' ? vfs.extname(st.name) : '';
              var base = ext ? st.name.slice(0, st.name.length - ext.length) : st.name;
              doIt(vfs.join(destDir, vfs.uniqueName(destDir, base, ext)), false);
            } else {
              try { vfs.remove(dest, { by: 'finder', recursive: true, force: true }); } catch (e) { /* ignore */ }
              replaced = true;
              doIt(dest, true);
            }
            return next();
          });
        }
        doIt(dest, true);
        return next();
      }
      return next().then(function () { render(); });
    }

    /* ---------- file operations ---------- */
    function realDir() { return !isVirt(S.path) && LAB.vfs.isDir(S.path); }
    function clearSearch() {
      if (!S.filter) return;
      S.filter = ''; S.scope = 'mac'; searchInput.value = '';
      render();
      updateChrome();
    }
    function newFolder() {
      if (!realDir()) { LAB.ui.toast('這裡不能新增檔案夾'); return; }
      clearSearch();
      adoptTail();
      var dir = curDir();
      var name = LAB.vfs.uniqueName(dir, '未命名檔案夾');
      var p = LAB.vfs.join(dir, name);
      try { LAB.vfs.mkdir(p, { by: 'finder' }); } catch (e) { LAB.ui.vfsFail(win, e, '無法新增檔案夾', p); return; }
      render();
      S.anchor = p;
      setSel([p], { silent: true });         // the automatic selection is not a click by the student (mission 1 step 6 waits for one)
      var rec = items.get(p);
      if (rec) ensureVisible(rec.el);
      startRename(p);
    }
    function duplicateSel() {
      var made = [];
      orderedSel().forEach(function (p) {
        var st = LAB.vfs.stat(p);
        if (!st) return;
        var dir = LAB.vfs.dirname(st.path);
        var ext = st.type === 'file' ? LAB.vfs.extname(st.name) : '';
        var base = ext ? st.name.slice(0, st.name.length - ext.length) : st.name;
        var nn = LAB.vfs.uniqueName(dir, base + ' 拷貝', ext);
        try { made.push(LAB.vfs.copy(st.path, LAB.vfs.join(dir, nn), { by: 'finder', recursive: true })); } catch (e) { LAB.ui.toast('無法複製（' + LAB.vfs.errText(e.code) + '）'); }
      });
      render();
      if (made.length) { S.anchor = made[0]; setSel(made); var rc = items.get(made[0]); if (rc) ensureVisible(rc.el); }
    }
    function trashPaths(paths) {
      var done = [];
      paths.forEach(function (p) {
        if (underTrash(p)) return;
        try { done.push({ name: LAB.vfs.basename(p), dest: LAB.vfs.trash(p, { by: 'finder' }) }); }
        catch (e) { LAB.ui.vfsFail(win, e, '無法移到垃圾桶', p); }
      });
      if (done.length) {
        LAB.undo.push('移到垃圾桶「' + done[0].name + '」' + (done.length > 1 ? '等 ' + done.length + ' 個項目' : ''), function () {
          done.forEach(function (d) { try { LAB.vfs.putBack(d.dest, { by: 'finder' }); } catch (e) { /* already gone */ } });
        });
        setSel([]); render();
      }
    }
    function putBackSel(paths) {
      var back = [];
      paths.forEach(function (p) {
        if (!underTrash(p)) return;
        try { back.push(LAB.vfs.putBack(p, { by: 'finder' })); } catch (e) { LAB.ui.toast('放不回去（' + LAB.vfs.errText(e.code) + '）'); }
      });
      if (back.length) { setSel([]); render(); }
    }
    function trashSel() { trashPaths(orderedSel()); }
    function copySel() {
      var ps = orderedSel();
      if (!ps.length) return;
      LAB.clipboard.setPaths(ps, 'copy');
    }
    function copyPathText() {
      var ps = orderedSel();
      if (!ps.length) return;
      LAB.clipboard.setText(ps.join('\n'));
    }
    function paste() {
      if (!realDir()) return;
      var src = (LAB.clipboard.paths || []).filter(function (p) { return LAB.vfs.exists(p); });
      if (!src.length) return;
      adoptTail();
      var dir = curDir();
      var inPlace = src.filter(function (p) { return sameDir(LAB.vfs.dirname(p), dir); });
      var other = src.filter(function (p) { return !sameDir(LAB.vfs.dirname(p), dir); });
      inPlace.forEach(function (p) {
        var st = LAB.vfs.stat(p);
        var ext = st.type === 'file' ? LAB.vfs.extname(st.name) : '';
        var base = ext ? st.name.slice(0, st.name.length - ext.length) : st.name;
        try { LAB.vfs.copy(st.path, LAB.vfs.join(dir, LAB.vfs.uniqueName(dir, base + ' 拷貝', ext)), { by: 'finder', recursive: true }); } catch (e) { LAB.ui.toast('無法貼上（' + LAB.vfs.errText(e.code) + '）'); }
      });
      if (other.length) transferInto(other, dir, 'copy');
      else render();
    }

    /* ---------- rename ---------- */
    function startRename(path) {
      if (S.renaming || S.sheet) return;
      path = LAB.vfs.canon(path);
      var rec = items.get(path);
      if (!rec) { render(); rec = items.get(path); }
      if (!rec) return;
      var st = LAB.vfs.stat(path);
      if (!st) return;
      S.renaming = path;
      setSel([path]);
      var input = h('input', { type: 'text', class: 'fd-edit', 'aria-label': '重新命名', spellcheck: 'false', autocomplete: 'off', dataset: { lab: 'fd-rename' } });
      input.value = st.name;
      rec.nameEl.style.display = 'none';
      rec.nameEl.parentNode.insertBefore(input, rec.nameEl.nextSibling);
      rec.el.classList.add('is-renaming');
      ensureVisible(rec.el);
      input.focus();
      var bl = st.type === 'dir' ? st.name.length : (st.name.lastIndexOf('.') > 0 ? st.name.lastIndexOf('.') : st.name.length);
      try { input.setSelectionRange(0, bl); } catch (e) { /* ignore */ }
      var done = false;
      function finish(commit) {
        if (done) return;
        done = true;
        var val = input.value;
        S.renaming = null;
        if (input.parentNode) input.parentNode.removeChild(input);
        rec.nameEl.style.display = '';
        rec.el.classList.remove('is-renaming');
        if (commit) applyRename(path, val);
        else render();
      }
      input.addEventListener('keydown', function (e) {
        e.stopPropagation();
        if (LAB.ui.isImeEnter(e)) return;
        if (e.key === 'Enter') { e.preventDefault(); finish(true); }
        else if (e.key === 'Escape') { e.preventDefault(); finish(false); }
      });
      input.addEventListener('blur', function () { finish(true); });
      input.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
      input.addEventListener('dblclick', function (e) { e.stopPropagation(); });
    }
    function applyRename(oldPath, typed) {
      renameCore(win, oldPath, typed, function (r) {
        render();
        if (!r.ok) return;
        S.anchor = r.path;
        setSel([r.path], { silent: true });      // keeping the renamed item selected is not a new click
        var rc = items.get(r.path);
        if (rc) ensureVisible(rc.el);
      });
    }

    /* ---------- go to folder sheet ---------- */
    function showGoto() {
      if (S.sheet || S.renaming) return;
      var prev = document.activeElement;
      var input = h('input', { type: 'text', class: 'lab-sheet-input fd-goto-in', 'aria-label': '前往檔案夾', placeholder: '輸入檔案夾的位置', spellcheck: 'false', autocomplete: 'off', dataset: { lab: 'fd-goto-input' } });
      var err = h('div', { class: 'fd-goto-err', role: 'alert' });
      var tid = LAB.util.uid('fd-goto-t');
      var offModal = null, closed = false;
      function close(silent) {
        if (closed) return;
        closed = true;
        S.sheet = null;
        if (offModal) offModal();
        scrim.classList.remove('is-in');
        setTimeout(function () { if (scrim.parentNode) scrim.parentNode.removeChild(scrim); }, 160);
        if (!silent) { try { if (prev && prev.focus && document.contains(prev)) prev.focus(); } catch (e) { /* ignore */ } }
      }
      function submit() {
        var txt = input.value.trim();
        var dest = null;
        if (txt) {
          var base = isVirt(S.path) ? HOME : S.path;
          var cand = LAB.vfs.canon(txt, base);
          if (LAB.vfs.isDir(cand)) dest = cand;
          else if (LAB.vfs.isFile(cand)) {         // a file path: show its folder with the file selected
            dest = LAB.vfs.dirname(cand);
            S.pendingSel = [cand];
          }
        }
        if (!dest) {
          err.textContent = '找不到這個檔案夾';
          panel.classList.remove('fd-shake');
          void panel.offsetWidth;
          panel.classList.add('fd-shake');
          input.focus();
          return;
        }
        close();
        navigate(dest, 'goto');
      }
      var cancelBtn = h('button', { type: 'button', class: 'lab-sheet-btn', dataset: { lab: 'sheet-button', value: 'cancel' }, on: { click: function () { close(); } } }, '取消');
      var goBtn = h('button', { type: 'button', class: 'lab-sheet-btn is-default', dataset: { lab: 'sheet-button', value: 'go' }, on: { click: submit } }, '前往');
      var panel = h('div', { class: 'lab-sheet is-attached', role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': tid },
        h('div', { class: 'lab-sheet-title', id: tid }, '前往檔案夾：'),
        h('div', { class: 'lab-sheet-text' }, '例如 ~/Desktop 或 /Users/an/Documents'),
        input, err, h('div', { class: 'lab-sheet-btns' }, cancelBtn, goBtn));
      var scrim = h('div', { class: 'lab-sheet-scrim is-window' }, panel);
      win.el.appendChild(scrim);
      requestAnimationFrame(function () { scrim.classList.add('is-in'); });
      S.sheet = { close: close };
      input.addEventListener('keydown', function (e) {
        e.stopPropagation();
        if (LAB.ui.isImeEnter(e)) return;
        if (e.key === 'Enter') { e.preventDefault(); submit(); }
      });
      input.addEventListener('input', function () { err.textContent = ''; });
      offModal = LAB.keys.modal(function (e) {
        if (e.key === 'Tab') {
          var f = [].slice.call(panel.querySelectorAll('input,button'));
          var i = f.indexOf(document.activeElement);
          var n = e.shiftKey ? (i <= 0 ? f.length - 1 : i - 1) : (i === f.length - 1 ? 0 : i + 1);
          f[n].focus();
          return true;
        }
        if (e.key === 'Escape') { if (LAB.ui.isImeEnter(e)) return false; close(); return true; }
        return false;
      });
      setTimeout(function () { input.focus(); }, 0);
    }

    /* ---------- menus (right click) ---------- */
    function compressSel(paths) {
      compressPaths(win, paths, function (out) {
        if (LAB.vfs.same(LAB.vfs.dirname(out), curDir()) && !searching()) { S.pendingSel = [out]; render(); S.pendingSel = null; }
        else render();
      });
    }
    function infoSel(paths) { openInfoFor(paths); }
    function itemMenu(path, x, y) {
      var st = LAB.vfs.stat(path);
      if (!st) return;
      var paths = S.sel.has(path) ? orderedSel() : [path];
      var multi = paths.length > 1;
      var name = st.name;
      var ow = LAB.apps.openWith(path);
      var inTrash = underTrash(path);
      var items2 = inTrash ? [
        { label: '放回原處', action: function () { putBackSel(paths); } },
        { separator: true },
        { label: '打開', action: function () { paths.forEach(openItem); } },
        { label: '取得資訊', shortcut: '⌘I', action: function () { infoSel(paths); } },
        { label: multi ? '快速查看 ' + paths.length + ' 個項目' : '快速查看「' + name + '」', action: function () { quickLook(paths[0]); } },
        { separator: true },
        { label: multi ? '拷貝 ' + paths.length + ' 個項目' : '拷貝「' + name + '」', action: function () { LAB.clipboard.setPaths(paths, 'copy'); } }
      ] : [
        { label: '打開', action: function () { paths.forEach(openItem); } },
        { label: '打開方式', enabled: !multi && ow.length > 0, submenu: ow.map(function (o) { return { label: o.label, action: function () { LAB.apps.openPath(path, { appId: o.appId, via: 'finder' }); } }; }) },
        { separator: true },
        { label: '移到垃圾桶', shortcut: '⌘⌫', enabled: !inTrash, action: function () { trashPaths(paths); } },
        { separator: true },
        { label: '取得資訊', shortcut: '⌘I', action: function () { infoSel(paths); } },
        { label: '重新命名', enabled: !multi && !inTrash, action: function () { startRename(path); } },
        { label: multi ? '壓縮 ' + paths.length + ' 個項目' : '壓縮「' + name + '」', action: function () { compressSel(paths); } },
        { label: '複製', enabled: !inTrash, action: function () { duplicateSel(); } },
        { label: '製作替身', enabled: false },
        { label: multi ? '快速查看 ' + paths.length + ' 個項目' : '快速查看「' + name + '」', action: function () { quickLook(paths[0]); } },
        { separator: true },
        { label: multi ? '拷貝 ' + paths.length + ' 個項目' : '拷貝「' + name + '」', action: function () { LAB.clipboard.setPaths(paths, 'copy'); } },
        { label: multi ? '將 ' + paths.length + ' 個項目拷貝為路徑名稱' : '將「' + name + '」拷貝為路徑名稱', action: function () { LAB.clipboard.setText(paths.join('\n')); } },
        { separator: true },
        { label: '標籤', submenu: tagMenuItems(function () { return paths; }) }
      ];
      if (!inTrash && !multi && st.type === 'dir') {
        items2.push({ separator: true });
        items2.push({ label: '服務', submenu: [{ label: '在檔案夾位置新增終端機視窗', action: function () { openTerminalAt(path); } }] });
      }
      LAB.menu.contextMenu(x, y, items2);
    }
    function emptyMenu(x, y) {
      var can = realDir();
      if (isTrash(S.path)) {
        LAB.menu.contextMenu(x, y, [
          { label: '清倒垃圾桶', enabled: trashCount() > 0, action: function () { if (LAB.desktop && LAB.desktop.confirmEmptyTrash) LAB.desktop.confirmEmptyTrash(); } },
          { separator: true },
          { label: '顯示檢視選項', enabled: false }
        ]);
        return;
      }
      LAB.menu.contextMenu(x, y, [
        { label: '新增檔案夾', enabled: can, action: newFolder },
        { separator: true },
        { label: '取得資訊', shortcut: '⌘I', enabled: can, action: function () { infoSel([curDir()]); } },
        { label: '貼上項目', enabled: can && (LAB.clipboard.paths || []).length > 0, action: paste },
        { label: '顯示檢視選項', enabled: false }
      ]);
    }
    function quickLook(path) {
      if (LAB.quicklook && LAB.quicklook.toggle) LAB.quicklook.toggle(path);
      else LAB.ui.toast('快速查看還沒安裝（練習版）');
    }

    /* ---------- pointer wiring ---------- */
    backBtn.addEventListener('click', goBack);
    fwdBtn.addEventListener('click', goForward);
    viewIconBtn.addEventListener('click', function () { setMode('icon'); });
    viewListBtn.addEventListener('click', function () { setMode('list'); });
    viewColBtn.addEventListener('click', function () { setMode('column'); });
    viewGalBtn.addEventListener('click', function () { setMode('gallery'); });
    scopeMacBtn.addEventListener('click', function () { S.scope = 'mac'; render(); });
    scopeDirBtn.addEventListener('click', function () { S.scope = 'folder'; render(); });
    trashBtn.addEventListener('click', function () { if (LAB.desktop && LAB.desktop.confirmEmptyTrash) LAB.desktop.confirmEmptyTrash(); });
    searchInput.addEventListener('input', function () {
      S.filter = searchInput.value.trim().toLowerCase();
      if (!S.filter) S.scope = 'mac';
      render();
    });
    searchInput.addEventListener('keydown', function (e) {
      if (LAB.ui.isImeEnter(e)) return;
      if (e.key === 'Escape') {
        e.stopPropagation();
        if (searchInput.value) { searchInput.value = ''; S.filter = ''; S.scope = 'mac'; render(); e.preventDefault(); }
        else searchInput.blur();
      }
    });

    scrollEl.addEventListener('contextmenu', function (e) {
      var p = tx(e);
      var itemEl = e.target.closest ? e.target.closest('.fd-item') : null;
      if (itemEl) {
        var path = itemEl.dataset.path;
        if (!S.sel.has(path)) { S.anchor = path; setSel([path]); }
        itemMenu(path, p.x, p.y);
      } else {
        if (!(e.metaKey || e.ctrlKey || e.shiftKey)) setSel([]);
        emptyMenu(p.x, p.y);
      }
    });

    scrollEl.addEventListener('pointerdown', function (e) {
      if (e.button !== 0 || e.isPrimary === false) return;
      var t = e.target;
      if (t.closest && (t.closest('.fd-item') || t.closest('.fd-listhead') || t.closest('input') || t.closest('.fd-colprev') || t.closest('.fd-gal-info') || t.closest('.fd-gal-stage'))) return;
      // the thin scrollbar belongs to the scroller, not to the "empty area"
      var p = tx(e), r = LAB.stage.rectOf(scrollEl);
      if (p.x - r.x > scrollEl.clientWidth || p.y - r.y > scrollEl.clientHeight) return;
      var additive = e.metaKey || e.ctrlKey || e.shiftKey;
      if (!additive) setSel([]);
      if (effMode() === 'icon' && gridEl) startRubber(e, additive);
    });

    function startRubber(e0, additive) {
      var pid = e0.pointerId;
      var base = additive ? new Set(S.sel) : new Set();
      var s0 = tx(e0);
      var g0 = LAB.stage.rectOf(gridEl);
      var sx = s0.x - g0.x, sy = s0.y - g0.y;        // start in grid (content) coordinates
      var band = null;
      var lastEv = e0;
      function recompute(ev) {
        var p = tx(ev);
        var g = LAB.stage.rectOf(gridEl);
        var cx = p.x - g.x, cy = p.y - g.y;
        if (!band) {
          if (Math.abs(cx - sx) < 4 && Math.abs(cy - sy) < 4) return;
          band = h('div', { class: 'fd-rubber' });
          gridEl.appendChild(band);
        }
        var x = Math.min(sx, cx), y = Math.min(sy, cy), w = Math.abs(cx - sx), hh = Math.abs(cy - sy);
        band.style.left = x + 'px'; band.style.top = y + 'px'; band.style.width = w + 'px'; band.style.height = hh + 'px';
        var hit = new Set(base);
        items.forEach(function (rec, path) {
          var el = rec.el;
          var ix = el.offsetLeft + 6, iy = el.offsetTop + 4, iw = el.offsetWidth - 12, ih = el.offsetHeight - 8;
          if (ix < x + w && ix + iw > x && iy < y + hh && iy + ih > y) hit.add(path);
        });
        setSel(Array.from(hit));
      }
      function move(ev) {
        if (ev.pointerId !== pid) return;
        lastEv = ev;
        recompute(ev);
        var p = tx(ev), r = LAB.stage.rectOf(scrollEl);
        if (p.y < r.y + 24) scrollEl.scrollTop -= 12;
        else if (p.y > r.y + r.h - 24) scrollEl.scrollTop += 12;
      }
      function up(ev) {
        if (ev.pointerId !== pid) return;
        window.removeEventListener('pointermove', move, true);
        window.removeEventListener('pointerup', up, true);
        window.removeEventListener('pointercancel', up, true);
        if (band && band.parentNode) band.parentNode.removeChild(band);
        if (S.sel.size) S.anchor = orderedSel()[0];
      }
      window.addEventListener('pointermove', move, true);
      window.addEventListener('pointerup', up, true);
      window.addEventListener('pointercancel', up, true);
    }

    /* ---------- keyboard ---------- */
    function cols() {
      if (effMode() !== 'icon' || !gridEl || !gridEl.children.length) return 1;
      var first = gridEl.children[0], top = first.offsetTop, n = 0;
      for (var i = 0; i < gridEl.children.length; i++) { if (gridEl.children[i].offsetTop === top) n++; else break; }
      return Math.max(1, n);
    }
    function moveSel(dir, extend) {
      var order = S.order;
      if (!order.length) return;
      var cur = null;
      var sel = orderedSel();
      if (sel.length) cur = (S.anchor && S.sel.has(S.anchor) && !extend) ? S.anchor : sel[sel.length - 1];
      var idx = cur === null ? -1 : order.indexOf(cur);
      var next;
      if (idx < 0) next = (dir === 'down' || dir === 'right') ? 0 : order.length - 1;
      else if (effMode() === 'icon') {
        var c = cols();
        next = idx + (dir === 'left' ? -1 : dir === 'right' ? 1 : dir === 'up' ? -c : c);
      } else if (effMode() === 'gallery') next = idx + (dir === 'left' || dir === 'up' ? -1 : 1);
      else next = idx + (dir === 'up' ? -1 : dir === 'down' ? 1 : 0);
      next = Math.max(0, Math.min(order.length - 1, next));
      var np = order[next];
      if (extend) {
        if (!S.anchor || !S.sel.has(S.anchor)) S.anchor = cur || np;
        selectRange(np);
      } else { S.anchor = np; setSel([np]); }
      var rec = items.get(np);
      if (rec) ensureVisible(rec.el);
    }
    function blocked() { return !!(S.renaming || S.sheet); }
    var keyQueue = [];
    function key(spec, fn) { keyQueue.push([spec, fn]); }
    function installKey(spec, fn) {
      win.own(LAB.keys.on(spec, function (e) {
        if (!win.isFocused() || blocked()) return false;
        var ae = document.activeElement;
        if (ae && ae !== document.body && (ae.closest('.fd-sidebar') || ae.closest('.fd-tb') || ae.closest('.fd-pathbar')) && /^(enter|space)$/.test(String(spec))) return false;
        return fn(e);
      }, { scope: 'finder' }));
    }
    key('enter', function () { if (S.sel.size !== 1) return false; startRename(orderedSel()[0]); });
    key('space', function () { var ps = orderedSel(); if (!ps.length) return false; quickLook(ps[0]); });
    key('mod+a', function () { setSel(S.order.slice()); S.anchor = S.order[0] || null; });
    key('mod+c', function () { if (!S.sel.size) return false; copySel(); });
    key('mod+v', function () { if (!(LAB.clipboard.paths || []).length) return false; paste(); });
    key('mod+d', function () { if (!S.sel.size) return false; duplicateSel(); });
    key('mod+backspace', function () { if (!S.sel.size) return false; trashSel(); });
    key('mod+o', function () { if (!S.sel.size) return false; openSelection(); });
    key('mod+arrowdown', function () { if (!S.sel.size) return false; openSelection(); });
    key('mod+arrowup', function () { goUp(); });
    key('mod+[', function () { goBack(); });
    key('mod+]', function () { goForward(); });
    key('mod+1', function () { setMode('icon'); });
    key('mod+2', function () { setMode('list'); });
    key('mod+3', function () { setMode('column'); });
    key('mod+4', function () { setMode('gallery'); });
    key('mod+i', function () { infoSel(S.sel.size ? orderedSel() : (realDir() ? [curDir()] : [])); });
    key('mod+alt+i', function () { infoSel(S.sel.size ? orderedSel() : (realDir() ? [curDir()] : [])); });
    key('mod+f', function () { searchInput.focus(); searchInput.select(); });
    key('mod+shift+f', function () { navigate(RECENTS, 'goto'); });
    key('mod+shift+c', function () { navigate('/', 'goto'); });
    key('mod+shift+u', function () { goUtilities(navigate); });
    key('mod+k', function () { connectServer(); });
    key('mod+shift+r', function () { notReal('AirDrop'); });
    key('mod+shift+k', function () { notReal('網路'); });
    key('mod+shift+n', function () { newFolder(); });
    key('mod+shift+g', function () { showGoto(); });
    key('mod+shift+h', function () { navigate(HOME, 'goto'); });
    key('mod+shift+d', function () { navigate(HOME + '/Desktop', 'goto'); });
    key('mod+shift+o', function () { navigate(HOME + '/Documents', 'goto'); });
    key('mod+alt+l', function () { navigate(HOME + '/Downloads', 'goto'); });
    key('mod+shift+a', function () { navigate('/Applications', 'goto'); });
    key('mod+alt+c', function () { if (!S.sel.size) return false; copyPathText(); });
    key('mod+shift+.', function () { S.showHidden = !S.showHidden; render(); });
    key('arrowup', function (e) { moveSel('up', e.shiftKey); });
    key('arrowdown', function (e) { moveSel('down', e.shiftKey); });
    key('shift+arrowup', function () { moveSel('up', true); });
    key('shift+arrowdown', function () { moveSel('down', true); });
    function colRight() {                 // → in the column view: step into the folder that is selected
      var p = orderedSel()[0], st = p && LAB.vfs.stat(p);
      if (!st) { moveSel('down', false); return; }
      if (st.type === 'dir' && S.sel.size === 1) {
        S.chain = S.chain.concat([st.path]);
        var kids = sortList(dirEntries(st.path));
        S.anchor = kids[0] ? kids[0].path : null;
        setSel(kids.length ? [kids[0].path] : []);
      }
    }
    function colLeft() {                  // ← in the column view: back to the folder's own column
      if (!S.chain.length) return;
      var last = S.chain[S.chain.length - 1];
      S.chain = S.chain.slice(0, -1);
      S.anchor = last;
      setSel([last]);
    }
    key('arrowleft', function () {
      if (effMode() === 'column') { colLeft(); return; }
      if (effMode() === 'list' && !searching()) {
        var p = orderedSel()[0];
        if (p && S.expanded.has(p)) { toggleExpand(p, false); return; }
        if (p) {
          var par = LAB.vfs.dirname(p);
          if (S.order.indexOf(par) >= 0) { S.anchor = par; setSel([par]); var r0 = items.get(par); if (r0) ensureVisible(r0.el); }
        }
        return;
      }
      moveSel('left', false);
    });
    key('arrowright', function () {
      if (effMode() === 'column') { colRight(); return; }
      if (effMode() === 'list' && !searching()) {
        var p = orderedSel()[0];
        var st = p && LAB.vfs.stat(p);
        if (st && st.type === 'dir' && !isVirt(S.path)) {
          if (!S.expanded.has(p)) { toggleExpand(p, true); return; }
          var i = S.order.indexOf(p);
          if (i >= 0 && S.order[i + 1] && LAB.vfs.dirname(S.order[i + 1]) === p) { S.anchor = S.order[i + 1]; setSel([S.order[i + 1]]); }
        } else if (!p) moveSel('down', false);
        return;
      }
      moveSel('right', false);
    });

    /* ---------- the window ---------- */
    win = LAB.wm.open({
      appId: 'finder', title: LAB.vfs.displayName(startPath), width: 860, height: 520, minW: 560, minH: 320,
      bar: 'unified', theme: 'light', content: root, toolbar: toolbar, icon: 'app-finder'
    });
    win.state.path = startPath;
    keyQueue.forEach(function (k) { installKey(k[0], k[1]); });
    var inst = {
      win: win, S: S, navigate: navigate, render: render, setSel: setSel, startRename: startRename, newFolder: newFolder,
      openSelection: openSelection, trashSel: trashSel, duplicateSel: duplicateSel, copySel: copySel, paste: paste, showGoto: showGoto,
      putBackSel: putBackSel, goBack: goBack, goForward: goForward, goUp: goUp, setMode: setMode, quickLook: quickLook, orderedSel: orderedSel,
      copyPathText: copyPathText, realDir: realDir, items: items, scrollEl: scrollEl, searchInput: searchInput,
      curDir: curDir, clearSearch: clearSearch, updateChrome: updateChrome, info: infoSel, compress: compressSel, setSortKey: setSortKey, searching: searching,
      toggleHidden: function () { S.showHidden = !S.showHidden; render(); },
      togglePathbar: function () { S.showPath = !S.showPath; updateChrome(); },
      toggleStatus: function () { S.showStatus = !S.showStatus; updateChrome(); }
    };
    instances.set(win.id, inst);
    win.own(function () {
      disposed = true;
      if (renderTimer) { clearTimeout(renderTimer); renderTimer = null; }
      if (S.sheet) S.sheet.close(true);
      clearItems();
      disposeCols();
      pathTargets.forEach(function (f) { f(); });
      pathTargets = [];
      refreshers.delete(render);
      instances.delete(win.id);
    });
    refreshers.add(render);              // a tag was added or removed: redraw the dots

    // live updates
    win.own(LAB.bus.on('fs:change', scheduleRender));
    win.own(LAB.bus.on('dnd:drop', function () { if (pendingFlush) { pendingFlush = false; scheduleRender(); } }));
    win.own(LAB.bus.on('dnd:cancel', function () { if (pendingFlush) { pendingFlush = false; scheduleRender(); } }));

    // drop targets: the view (current folder) and every sidebar item
    var viewTarget = {
      id: 'finder:' + win.id + ':view',
      accept: function (pl, mods) { return searching() ? false : acceptInto(pl, curDir(), mods); },
      enter: function () { scrollEl.classList.add('is-drop'); },
      leave: function () { scrollEl.classList.remove('is-drop'); },
      drop: function (pl, ctx) { scrollEl.classList.remove('is-drop'); transferInto(pl.paths, curDir(), ctx.mode === 'copy' ? 'copy' : 'move'); }
    };
    win.own(LAB.dnd.target(scrollEl, viewTarget));
    sideRecs.forEach(function (r) {
      if (!r.path) return;
      if (r.tag) {                       // dropping files on a colour tags them
        win.own(LAB.dnd.target(r.btn, {
          id: 'finder:' + win.id + ':sidebar:' + r.path,
          accept: function (pl) { return pl && pl.kind === 'fs' && pl.paths && pl.paths.length ? 'link' : false; },
          enter: function () { r.btn.classList.add('is-drop'); },
          leave: function () { r.btn.classList.remove('is-drop'); },
          drop: function (pl) { r.btn.classList.remove('is-drop'); addTag(pl.paths, r.tag); }
        }));
        return;
      }
      win.own(LAB.dnd.target(r.btn, {
        id: 'finder:' + win.id + ':sidebar:' + r.path,
        accept: function (pl, mods) { return acceptInto(pl, r.path, mods); },
        enter: function () { r.btn.classList.add('is-drop'); },
        leave: function () { r.btn.classList.remove('is-drop'); },
        drop: function (pl, ctx) { r.btn.classList.remove('is-drop'); transferInto(pl.paths, r.path, ctx.mode === 'copy' ? 'copy' : 'move'); }
      }));
    });

    render();
    S.pendingSel = null;
    updateChrome();
    LAB.bus.emit('finder:navigate', { winId: win.id, path: startPath, via: via || 'initial' });
    return inst;
  }

  /* ========================================================= app + public API */
  function openTerminalAt(path) {
    var def = LAB.apps.get('terminal');
    if (def && typeof def.handleOpen === 'function') def.handleOpen(path, { via: 'services' });
    else LAB.apps.launch('terminal');
  }

  function activeInst() {
    var w = LAB.wm.focused();
    if (w && w.appId === 'finder') {
      if (instances.has(w.id)) return instances.get(w.id);
      if (w.state && w.state.isInfo) {          // an Info window is in front: the menus keep acting on the Finder window behind it
        var list = LAB.wm.byApp('finder');
        for (var i = list.length - 1; i >= 0; i--) { if (instances.has(list[i].id) && !list[i].minimized) return instances.get(list[i].id); }
      }
    }
    return null;
  }
  function findAt(path) {
    var found = null;
    LAB.wm.byApp('finder').forEach(function (w) {
      var inst = instances.get(w.id);
      if (inst && inst.S.path === path) found = inst;
    });
    return found;
  }

  function normPath(path) {
    if (isVirt(path)) return path;
    var p = LAB.vfs.canon(path || HOME);
    if (LAB.vfs.isDir(p)) return p;
    while (p !== '/' && !LAB.vfs.isDir(p)) p = LAB.vfs.dirname(p);
    return LAB.vfs.isDir(p) ? p : HOME;
  }

  function open(args) {
    args = args || {};
    var path = args.path ? normPath(args.path) : HOME;
    if (args.reuse || args.via === 'dock') {
      var ex = findAt(path);
      if (ex) {
        ex.win.focus();
        LAB.bus.emit('finder:navigate', { winId: ex.win.id, path: path, via: normVia(args.via, 'open') });
        return ex.win;
      }
    }
    return createFinder(path, normVia(args.via, args.via ? 'open' : 'initial'), { select: args.select }).win;
  }

  function reveal(path) {
    var p = LAB.vfs.canon(path);
    if (!LAB.vfs.exists(p)) return null;
    var parent = LAB.vfs.dirname(p);
    var inst = null;
    var f = activeInst();
    if (f && sameDir(f.S.path, parent)) inst = f;
    if (!inst) inst = findAt(parent);
    if (inst) {
      inst.win.focus();
      inst.clearSearch();
      inst.S.chain = [];
      inst.render();
      inst.S.pendingSel = [p];
      inst.render();
      inst.S.pendingSel = null;
      return inst.win;
    }
    return createFinder(parent, 'open', { select: [p] }).win;
  }

  function windows() {
    var out = [];
    LAB.wm.byApp('finder').forEach(function (w) {
      var inst = instances.get(w.id);
      if (inst) out.push({ winId: w.id, path: inst.S.path });
    });
    return out;
  }

  LAB.finder = {
    open: open,
    reveal: reveal,
    windows: windows,
    state: function (winId) {
      var inst = instances.get(winId);
      if (!inst) return null;
      var S = inst.S;
      return {
        path: S.path, mode: S.mode, sel: inst.orderedSel(), order: S.order.slice(), hist: S.hist.slice(), hi: S.hi, filter: S.filter, showHidden: S.showHidden,
        scope: S.scope, chain: S.chain.slice(), searching: inst.searching(), dir: inst.curDir()
      };
    },
    /* round 5 */
    info: openInfoFor,                          // info(paths[]): one Info window per item (at most 5)
    compress: function (paths, win) { return compressPaths(win || null, paths); },
    thumbSrc: function (path) { var st = LAB.vfs.stat(path); return st ? thumbSrc(st) : null; },
    tags: {
      list: function () { return TAGS.map(function (t) { return { id: t.id, name: t.name, color: t.color }; }); },
      get: function (path) { return tagsOf(LAB.vfs.canon(path)).slice(); },
      toggle: function (paths, id) { toggleTag(paths.map(function (p) { return LAB.vfs.canon(p); }), id); },
      clear: function (paths) { clearTags(paths.map(function (p) { return LAB.vfs.canon(p); })); }
    }
  };

  LAB.apps.register('finder', {
    title: 'Finder', en: 'Finder', aliases: ['finder'], icon: 'app-finder', dock: true,
    open: open,
    canHandle: function (p) { return !!LAB.vfs.stat(p); },
    handleOpen: function (p, o) {
      var st = LAB.vfs.stat(p);
      if (!st) return false;
      var via = (o && o.via) || 'open';
      if (st.type === 'dir') {
        var ex = findAt(st.path);
        if (ex) {
          ex.win.focus();
          LAB.bus.emit('finder:navigate', { winId: ex.win.id, path: st.path, via: 'open' });
        } else createFinder(st.path, normVia(via, 'open'), {});
        return true;
      }
      reveal(st.path);
      return true;
    },
    canOpen: function (st) { return st.type === 'dir' ? 10 : 0; }
  });

  /* ------------------------------------------------------------------- menus */
  function goTo(path, how) {
    var inst = activeInst();
    if (inst) inst.navigate(path, how);
    else open({ path: path, via: how });
  }
  function notReal(what) { LAB.ui.toast(what + ' 在練習版裡不能用'); }
  LAB.menu.register('finder', function () {
    var inst = activeInst();
    var has = !!inst;
    var hasSel = has && inst.S.sel.size > 0;
    var oneSel = has && inst.S.sel.size === 1;
    var real = has && inst.realDir();
    var selPaths = has ? inst.orderedSel() : [];
    var selName = oneSel ? LAB.vfs.basename(selPaths[0]) : '';
    var em = has ? (inst.searching() ? 'list' : inst.S.mode) : '';
    var recent = recentFolders.filter(function (p) { return LAB.vfs.isDir(p); }).slice(0, 8);
    return [
      { label: '檔案', items: [
        { label: '新增 Finder 視窗', shortcut: '⌘N', action: function () { open({}); } },
        { label: '新增檔案夾', shortcut: '⇧⌘N', enabled: real, action: function () { inst.newFolder(); } },
        { label: '打開', shortcut: '⌘O', enabled: hasSel, action: function () { inst.openSelection(); } },
        { label: '關閉視窗', shortcut: '⌘W', enabled: has, action: function () { var w = LAB.wm.focused(); if (w && w.appId === 'finder') w.close(); else inst.win.close(); } },
        { separator: true },
        { label: '取得資訊', shortcut: '⌘I', enabled: hasSel || real, action: function () { inst.info(hasSel ? selPaths : [inst.curDir()]); } },
        { label: '重新命名', enabled: oneSel, action: function () { inst.startRename(selPaths[0]); } },
        { label: oneSel ? '壓縮「' + selName + '」' : hasSel ? '壓縮 ' + selPaths.length + ' 個項目' : '壓縮', enabled: hasSel, action: function () { inst.compress(selPaths); } },
        { label: '複製', shortcut: '⌘D', enabled: hasSel, action: function () { inst.duplicateSel(); } },
        { label: '快速查看', shortcut: '空白鍵', enabled: hasSel, action: function () { inst.quickLook(selPaths[0]); } },
        { label: '移到垃圾桶', shortcut: '⌘⌫', enabled: hasSel, action: function () { inst.trashSel(); } },
        { separator: true },
        { label: '尋找', shortcut: '⌘F', enabled: has, action: function () { inst.searchInput.focus(); inst.searchInput.select(); } },
        { label: '標籤', enabled: hasSel, submenu: tagMenuItems(function () { return has ? inst.orderedSel() : []; }) }
      ] },
      { label: '編輯', items: [
        { label: LAB.undo.peek() ? '還原' + LAB.undo.peek().label : '還原', shortcut: '⌘Z', enabled: !!LAB.undo.peek(), action: function () { LAB.undo.run(); } },
        { separator: true },
        { label: '拷貝', shortcut: '⌘C', enabled: hasSel, action: function () { inst.copySel(); } },
        { label: '貼上項目', shortcut: '⌘V', enabled: real && (LAB.clipboard.paths || []).length > 0, action: function () { inst.paste(); } },
        { label: '全選', shortcut: '⌘A', enabled: has, action: function () { inst.setSel(inst.S.order.slice()); } }
      ] },
      { label: '顯示方式', items: [
        { label: '為圖示', shortcut: '⌘1', enabled: has, checked: has && inst.S.mode === 'icon', action: function () { inst.setMode('icon'); } },
        { label: '為列表', shortcut: '⌘2', enabled: has, checked: has && inst.S.mode === 'list', action: function () { inst.setMode('list'); } },
        { label: '為直欄', shortcut: '⌘3', enabled: has, checked: has && inst.S.mode === 'column', action: function () { inst.setMode('column'); } },
        { label: '為圖庫', shortcut: '⌘4', enabled: has, checked: has && inst.S.mode === 'gallery', action: function () { inst.setMode('gallery'); } },
        { separator: true },
        { label: '排序方式', enabled: has && (em === 'icon' || em === 'list' || em === 'gallery' || em === 'column'), submenu: [
          ['name', '名稱'], ['kind', '種類'], ['date', '修改日期'], ['size', '大小'], ['tag', '標籤']
        ].map(function (k) { return { label: k[1], checked: function () { return has && inst.S.sort.key === k[0]; }, action: function () { inst.setSortKey(k[0]); } }; }) },
        { separator: true },
        { label: '顯示路徑列', enabled: has, checked: has && inst.S.showPath, action: function () { inst.togglePathbar(); } },
        { label: '顯示狀態列', enabled: has, checked: has && inst.S.showStatus, action: function () { inst.toggleStatus(); } }
      ] },
      { label: '前往', items: [
        { label: '返回', shortcut: '⌘[', enabled: has && inst.S.hi > 0, action: function () { inst.goBack(); } },
        { label: '下一頁', shortcut: '⌘]', enabled: has && inst.S.hi < inst.S.hist.length - 1, action: function () { inst.goForward(); } },
        { label: '上層檔案夾', shortcut: '⌘↑', enabled: real && inst.S.path !== '/', action: function () { inst.goUp(); } },
        { separator: true },
        { label: '最近項目', shortcut: '⇧⌘F', action: function () { goTo(RECENTS, 'goto'); } },
        { label: LAB.vfs.displayName(HOME + '/Documents'), shortcut: '⇧⌘O', action: function () { goTo(HOME + '/Documents', 'goto'); } },
        { label: LAB.vfs.displayName(HOME + '/Desktop'), shortcut: '⇧⌘D', action: function () { goTo(HOME + '/Desktop', 'goto'); } },
        { label: LAB.vfs.displayName(HOME + '/Downloads'), shortcut: '⌥⌘L', action: function () { goTo(HOME + '/Downloads', 'goto'); } },
        { label: LAB.vfs.displayName(HOME), shortcut: '⇧⌘H', action: function () { goTo(HOME, 'goto'); } },
        { label: '電腦', shortcut: '⇧⌘C', action: function () { goTo('/', 'goto'); } },
        { label: 'AirDrop', shortcut: '⇧⌘R', action: function () { notReal('AirDrop'); } },
        { label: '網路', shortcut: '⇧⌘K', action: function () { notReal('網路'); } },
        { label: LAB.vfs.displayName('/Applications'), shortcut: '⇧⌘A', action: function () { goTo('/Applications', 'goto'); } },
        { label: '工具程式', shortcut: '⇧⌘U', action: function () { goUtilities(goTo); } },
        { separator: true },
        { label: '最近使用的檔案夾', enabled: recent.length > 0, submenu: recent.map(function (p) { return { label: LAB.vfs.displayName(p), action: function () { goTo(p, 'goto'); } }; }) },
        { separator: true },
        { label: '前往檔案夾⋯', shortcut: '⇧⌘G', action: function () {
          var i2 = activeInst();
          if (!i2) { var w = open({}); i2 = instances.get(w.id); }
          i2.showGoto();
        } },
        { label: '連接伺服器⋯', shortcut: '⌘K', action: connectServer }
      ] },
      { label: '視窗', items: LAB.menu.windowMenu(false) },
      { label: '輔助說明', items: [
        { label: '關於這個練習', action: function () { LAB.apps.launch('about', { tab: 'about' }); } }
      ] }
    ];
  });
})(window.LAB);
