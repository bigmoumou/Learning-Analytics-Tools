/* finder.js [SKIN] — Finder app (DESIGN §4.1) and LAB.finder (§3.13).
   Replaces the CORE placeholder: LAB.apps.register('finder', …) with the same id wins (§1.1).
   Every window-scoped bus listener, drop target and key handler goes through win.own (§3.6). File names are DATA: DOM is built with h()/textContent only. */
(function (LAB) {
  'use strict';

  var h = LAB.util.h;
  var HOME = LAB.vfs.HOME;
  var TRASH = HOME + '/.Trash';
  var RECENTS = 'recents:';
  var instances = new Map();          // winId -> inst

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
  function isTrash(p) { return p !== RECENTS && LAB.vfs.same(p, TRASH); }
  function underTrash(p) { return p !== RECENTS && LAB.vfs.isUnder(p, TRASH); }
  function trashCount() { try { return LAB.vfs.list(TRASH).length; } catch (e) { return 0; } }

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
      sel: new Set(), anchor: null, filter: '', expanded: new Set(),
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
    // a real Finder has four views; the practice Mac only implements the first two
    var viewColBtn = h('button', { type: 'button', class: 'fd-vb', 'aria-label': '直欄（練習版沒有）', title: '直欄（練習版沒有這個檢視）', disabled: true, dataset: { lab: 'fd-view-columns' } });
    var viewGalBtn = h('button', { type: 'button', class: 'fd-vb', 'aria-label': '圖庫（練習版沒有）', title: '圖庫（練習版沒有這個檢視）', disabled: true, dataset: { lab: 'fd-view-gallery' } });
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
    var root = h('div', { class: 'fd-root' },
      h('div', { class: 'fd-body' }, sidebarEl, h('div', { class: 'fd-main' }, scrollEl)),
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

    /* ---------- selection ---------- */
    function orderedSel() { return S.order.filter(function (p) { return S.sel.has(p); }); }
    function applySel() {
      items.forEach(function (rec, p) {
        var on = S.sel.has(p);
        rec.el.classList.toggle('is-sel', on);
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
      if (!same && !o.silent) LAB.bus.emit('finder:select', { winId: win ? win.id : null, paths: orderedSel() });
    }
    function selectRange(toPath) {
      var a = S.order.indexOf(S.anchor), b = S.order.indexOf(toPath);
      if (a < 0) { setSel([toPath]); S.anchor = toPath; return; }
      var lo = Math.min(a, b), hi = Math.max(a, b);
      setSel(S.order.slice(lo, hi + 1));
    }

    /* ---------- listing ---------- */
    function effSort() { return (S.path === RECENTS && !S.sortTouched) ? { key: 'date', dir: -1 } : S.sort; }
    function sortList(list) {
      var es = effSort();
      var k = es.key, d = es.dir;
      list.sort(function (a, b) {
        var r = 0;
        if (k === 'date') r = a.mtime - b.mtime;
        else if (k === 'size') r = (a.type === 'dir' ? -1 : a.size) - (b.type === 'dir' ? -1 : b.size);
        else if (k === 'kind') r = cmpStr(kindLabel(a), kindLabel(b));
        else if (k === 'where') r = cmpStr(LAB.vfs.dirname(a.path), LAB.vfs.dirname(b.path));
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
    function buildRows() {
      var rows = [];
      if (S.path === RECENTS) {
        var rl = recentsList();
        if (S.filter) rl = rl.filter(matchesFilter);
        sortList(rl).forEach(function (st) { rows.push({ st: st, depth: 0 }); });
        return rows;
      }
      if (S.filter) {
        // like the real search: matches anywhere below this folder, shown as one flat list (the trash is not searched)
        var found = [];
        (function walk(dir, depth) {
          dirEntries(dir).forEach(function (st) {
            if (found.length >= 300 || isTrash(st.path)) return;
            if (matchesFilter(st)) found.push(st);
            if (st.type === 'dir' && depth < 8) walk(st.path, depth + 1);
          });
        })(S.path, 0);
        sortList(found).forEach(function (st) { rows.push({ st: st, depth: 0 }); });
        return rows;
      }
      (function add(dir, depth) {
        var list = dirEntries(dir);
        if (depth === 0 && S.filter) list = list.filter(matchesFilter);
        sortList(list).forEach(function (st) {
          rows.push({ st: st, depth: depth });
          if (S.mode === 'list' && st.type === 'dir' && S.expanded.has(st.path) && !S.filter && depth < 10) add(st.path, depth + 1);
        });
      })(S.path, 0);
      return rows;
    }

    /* ---------- container (icon grid / list) ---------- */
    function disposeItem(rec) { rec.offs.forEach(function (f) { try { f(); } catch (e) { /* ignore */ } }); rec.offs = []; }
    function clearItems() {
      items.forEach(function (rec) { disposeItem(rec); if (rec.el.parentNode) rec.el.parentNode.removeChild(rec.el); });
      items.clear();
    }
    function ensureContainer() {
      var want = S.mode;
      if (host && host.dataset.mode === want) return;
      clearItems();
      scrollEl.textContent = '';
      gridEl = listEl = headEl = null;
      if (want === 'icon') {
        gridEl = h('div', { class: 'fd-grid', dataset: { mode: 'icon' } });
        host = gridEl;
        scrollEl.appendChild(gridEl);
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
      listEl.classList.toggle('is-recents', S.path === RECENTS);
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

    /* ---------- items ---------- */
    function itemAccept(rec, pl, mods) { return acceptInto(pl, rec.st.path, mods); }

    function makeItem(st) {
      var icon = S.mode === 'icon';
      var iconName = LAB.icons.forNode(st);
      var el = h('div', { class: 'fd-item ' + (icon ? 'fd-icon' : 'fd-row'), role: 'option', 'aria-selected': 'false', dataset: { lab: 'fd-item', path: st.path } });
      var rec = { el: el, st: st, icon: iconName, offs: [], nameEl: null, mode: S.mode, cells: {} };
      if (icon) {
        var ico = h('div', { class: 'fd-ico', 'aria-hidden': 'true' });
        ico.innerHTML = LAB.icons.get(iconName, { size: 60 });
        var nm = h('div', { class: 'fd-name' }, h('span', { class: 'fd-name-t' }));
        el.appendChild(ico); el.appendChild(nm);
        rec.icoEl = ico; rec.nameEl = nm.firstChild; rec.nameBox = nm;
      } else {
        var disc = h('span', { class: 'fd-disc', 'aria-hidden': 'true' });
        var rico = h('span', { class: 'fd-rico', 'aria-hidden': 'true' });
        rico.innerHTML = LAB.icons.get(iconName, { size: 18 });
        var nt = h('span', { class: 'fd-name-t' });
        var c0 = h('div', { class: 'fd-c fd-c-name' }, disc, rico, nt);
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

    function updateItem(rec, st, row, idx) {
      var icon = rec.mode === 'icon';
      rec.st = st;
      var iname = LAB.icons.forNode(st);
      if (rec.icon !== iname) {
        rec.icon = iname;
        rec.icoEl.innerHTML = LAB.icons.get(iname, { size: icon ? 60 : 18 });
      }
      var renamingThis = S.renaming === st.path;
      if (!renamingThis) {
        var label = icon ? shortName(labelOf(st)) : labelOf(st);
        if (rec.nameEl.textContent !== label) rec.nameEl.textContent = label;
      }
      rec.el.setAttribute('aria-label', labelOf(st));
      rec.el.classList.toggle('is-dim', !!st.hidden);
      rec.el.classList.toggle('is-odd', idx % 2 === 1);
      if (!icon) {
        rec.el.style.setProperty('--depth', String(row.depth));
        rec.disc.classList.toggle('has-kids', st.type === 'dir' && st.count > 0 && S.path !== RECENTS);
        rec.disc.classList.toggle('is-open', S.expanded.has(st.path));
        var dt = LAB.util.fmt.finderDate(st.mtime);
        if (rec.cells.date.textContent !== dt) rec.cells.date.textContent = dt;
        var sz = st.type === 'dir' ? '--' : LAB.util.fmt.size(st.size);
        if (rec.cells.size.textContent !== sz) rec.cells.size.textContent = sz;
        var kd = kindLabel(st);
        if (rec.cells.kind.textContent !== kd) rec.cells.kind.textContent = kd;
        var wh = S.path === RECENTS ? LAB.vfs.displayName(LAB.vfs.dirname(st.path)) : '';
        if (rec.cells.where.textContent !== wh) rec.cells.where.textContent = wh;
      }
    }

    function removeItem(p) {
      var rec = items.get(p);
      if (!rec) return;
      disposeItem(rec);
      if (rec.el.parentNode) rec.el.parentNode.removeChild(rec.el);
      items.delete(p);
    }

    /* ---------- render (reconcile by data-path) ---------- */
    function render() {
      if (disposed || !win) return;
      if (renderTimer) { clearTimeout(renderTimer); renderTimer = null; }
      if (S.path !== RECENTS && !LAB.vfs.isDir(S.path)) {
        var q = S.path;
        while (q !== '/' && !LAB.vfs.isDir(q)) q = LAB.vfs.dirname(q);
        navigate(q, 'up');
        return;
      }
      ensureContainer();
      var rows = buildRows();
      S.order = rows.map(function (r) { return r.st.path; });
      S.topCount = rows.filter(function (r) { return r.depth === 0; }).length;
      var seen = new Set();
      rows.forEach(function (r) { seen.add(r.st.path); });
      Array.from(items.keys()).forEach(function (p) {
        var rec = items.get(p);
        var keep = seen.has(p) || (S.renaming === p && LAB.vfs.exists(p));
        var typeChanged = seen.has(p) && rec.st.type !== (rows[S.order.indexOf(p)].st.type);
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
      // selection: drop paths that no longer exist, then apply a pending selection (reveal / new folder)
      var keepSel = Array.from(S.sel).filter(function (p) { return seen.has(p); });
      if (S.pendingSel) {
        var ps = S.pendingSel.filter(function (p) { return seen.has(p); });
        if (ps.length) {
          S.pendingSel = null;
          keepSel = ps;
          S.anchor = ps[0];
          setSel(ps);
          var rc = items.get(ps[0]);
          if (rc) ensureVisible(rc.el);
        }
      }
      if (keepSel.length !== S.sel.size) setSel(keepSel, { silent: true });
      else applySel();
      updateHead();
      updateStatus();
      updateDynamicChrome();
      S.rendered = true;
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
      var r = el.getBoundingClientRect(), s = scrollEl.getBoundingClientRect();
      var headH = (S.mode === 'list' ? 22 : 0) * sc;
      if (r.top < s.top + headH) scrollEl.scrollTop -= (s.top + headH - r.top) / sc + 2;
      else if (r.bottom > s.bottom) scrollEl.scrollTop += (r.bottom - s.bottom) / sc + 2;
    }

    /* ---------- chrome ---------- */
    function titleIconFor(path) {
      if (path === RECENTS) return 'clock';
      if (isTrash(path)) return trashCount() ? 'app-trash-full' : 'app-trash-empty';
      if (path === '/') return 'fd-hdd';
      return 'folder';
    }
    function updateDynamicChrome() {
      var name = LAB.vfs.displayName(S.path);
      var iname = 'folder';
      try { iname = titleIconFor(S.path); } catch (e) { iname = 'folder'; }
      titleIco.innerHTML = LAB.icons.get(iname, { size: 17 });
      if (titleTxt.textContent !== name) titleTxt.textContent = name;
      if (win && win.getTitle() !== name) win.setTitle(name);
      trashBtn.hidden = !isTrash(S.path);
      trashBtn.disabled = !isTrash(S.path) || trashCount() === 0;
    }
    function segsFor(path) {
      if (path === RECENTS) return [];
      var segs = [{ path: '/', label: LAB.vfs.displayName('/') }];
      if (path === '/') return segs;
      var parts = path.split('/').filter(Boolean), cur = '';
      parts.forEach(function (pt) { cur += '/' + pt; segs.push({ path: cur, label: LAB.vfs.displayName(cur) }); });
      return segs;
    }
    function buildPathbar() {
      pathEl.textContent = '';
      pathEl.classList.remove('is-clipped');
      var segs = segsFor(S.path);
      segs.forEach(function (sg, i) {
        if (i) pathEl.appendChild(h('span', { class: 'fd-psep', 'aria-hidden': 'true' }, '›'));
        var ico = h('span', { class: 'fd-ps-ico', 'aria-hidden': 'true' });
        ico.innerHTML = LAB.icons.get(i === 0 ? 'fd-hdd' : 'folder', { size: 14 });
        var b = h('button', { type: 'button', class: 'fd-ps' + (i === segs.length - 1 ? ' is-last' : ''), dataset: { lab: 'fd-pathbar-seg', path: sg.path } }, ico, h('span', null, sg.label));
        b.addEventListener('click', function () { navigate(sg.path, 'pathbar'); });
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
    var pathTargets = [];
    function updateChrome() {
      pathTargets.forEach(function (f) { f(); });
      pathTargets = [];
      buildPathbar();
      backBtn.disabled = S.hi <= 0;
      fwdBtn.disabled = S.hi >= S.hist.length - 1;
      sideRecs.forEach(function (r) {
        if (!r.path) return;
        var cur = S.path === RECENTS ? r.path === RECENTS : (r.path !== RECENTS && LAB.vfs.same(r.path, S.path));
        r.btn.classList.toggle('is-cur', cur);
        if (cur) r.btn.setAttribute('aria-current', 'page'); else r.btn.removeAttribute('aria-current');
      });
      viewIconBtn.classList.toggle('is-on', S.mode === 'icon');
      viewListBtn.classList.toggle('is-on', S.mode === 'list');
      viewIconBtn.setAttribute('aria-pressed', S.mode === 'icon' ? 'true' : 'false');
      viewListBtn.setAttribute('aria-pressed', S.mode === 'list' ? 'true' : 'false');
      root.classList.toggle('no-path', !S.showPath);
      root.classList.toggle('no-status', !S.showStatus);
      updateDynamicChrome();
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
      var p = path === RECENTS ? RECENTS : LAB.vfs.canon(path);
      if (p !== RECENTS && !LAB.vfs.isDir(p)) return false;
      var same = p === S.path;
      if (!o.noPush && !same) {
        S.hist = S.hist.slice(0, S.hi + 1);
        S.hist.push(p);
        S.hi = S.hist.length - 1;
      }
      if (!same) {
        S.path = p;
        S.filter = '';
        searchInput.value = '';
        S.expanded = new Set();
        S.sel = new Set();
        S.anchor = null;
        S.rendered = false;
        scrollEl.scrollTop = 0;
        if (win) win.state.path = p;
        render();
      }
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
      if (S.path === RECENTS || S.path === '/') return false;
      return navigate(LAB.vfs.dirname(S.path), 'up');
    }
    function setMode(m) {
      if (S.mode === m) return;
      S.mode = m;
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
      if (dest === RECENTS || !LAB.vfs.isDir(dest)) return false;
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
    function realDir() { return S.path !== RECENTS && LAB.vfs.isDir(S.path); }
    function newFolder() {
      if (!realDir()) { LAB.ui.toast('這裡不能新增檔案夾'); return; }
      if (S.filter) { S.filter = ''; searchInput.value = ''; }
      var name = LAB.vfs.uniqueName(S.path, '未命名檔案夾');
      var p = LAB.vfs.join(S.path, name);
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
      var dir = S.path;
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
      var st = LAB.vfs.stat(oldPath);
      if (!st) { render(); return; }
      var name = String(typed).replace(/\//g, ':');
      if (name.trim() === '' || name === st.name) { render(); return; }
      var oldExt = st.type === 'file' ? LAB.vfs.extname(st.name) : '';
      var newExt = st.type === 'file' ? LAB.vfs.extname(name) : '';
      function commit(finalName) {
        try {
          var np = LAB.vfs.rename(oldPath, finalName, { by: 'finder' });
          LAB.undo.push('重新命名「' + st.name + '」', function () { LAB.vfs.rename(np, st.name, { by: 'finder' }); });
          render();
          S.anchor = np;
          setSel([np], { silent: true });      // keeping the renamed item selected is not a new click
          var rc = items.get(np);
          if (rc) ensureVisible(rc.el);
        } catch (e) {
          render();
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
          var base = S.path === RECENTS ? HOME : S.path;
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
        { label: multi ? '快速查看 ' + paths.length + ' 個項目' : '快速查看「' + name + '」', action: function () { quickLook(paths[0]); } },
        { separator: true },
        { label: multi ? '拷貝 ' + paths.length + ' 個項目' : '拷貝「' + name + '」', action: function () { LAB.clipboard.setPaths(paths, 'copy'); } }
      ] : [
        { label: '打開', action: function () { paths.forEach(openItem); } },
        { label: '打開方式', enabled: !multi && ow.length > 0, submenu: ow.map(function (o) { return { label: o.label, action: function () { LAB.apps.openPath(path, { appId: o.appId, via: 'finder' }); } }; }) },
        { separator: true },
        { label: '移到垃圾桶', shortcut: '⌘⌫', enabled: !inTrash, action: function () { trashPaths(paths); } },
        { label: '取得資訊', enabled: false },
        { label: '重新命名', enabled: !multi && !inTrash, action: function () { startRename(path); } },
        { label: multi ? '壓縮 ' + paths.length + ' 個項目' : '壓縮「' + name + '」', enabled: false },
        { label: '複製', enabled: !inTrash, action: function () { duplicateSel(); } },
        { label: '製作替身', enabled: false },
        { label: multi ? '快速查看 ' + paths.length + ' 個項目' : '快速查看「' + name + '」', action: function () { quickLook(paths[0]); } },
        { separator: true },
        { label: multi ? '拷貝 ' + paths.length + ' 個項目' : '拷貝「' + name + '」', action: function () { LAB.clipboard.setPaths(paths, 'copy'); } },
        { label: multi ? '將 ' + paths.length + ' 個項目拷貝為路徑名稱' : '將「' + name + '」拷貝為路徑名稱', action: function () { LAB.clipboard.setText(paths.join('\n')); } }
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
        { label: '取得資訊', enabled: false },
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
    trashBtn.addEventListener('click', function () { if (LAB.desktop && LAB.desktop.confirmEmptyTrash) LAB.desktop.confirmEmptyTrash(); });
    searchInput.addEventListener('input', function () {
      S.filter = searchInput.value.trim().toLowerCase();
      render();
    });
    searchInput.addEventListener('keydown', function (e) {
      if (LAB.ui.isImeEnter(e)) return;
      if (e.key === 'Escape') {
        e.stopPropagation();
        if (searchInput.value) { searchInput.value = ''; S.filter = ''; render(); e.preventDefault(); }
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
      if (t.closest && (t.closest('.fd-item') || t.closest('.fd-listhead') || t.closest('input'))) return;
      // the thin scrollbar belongs to the scroller, not to the "empty area"
      var p = tx(e), r = LAB.stage.rectOf(scrollEl);
      if (p.x - r.x > scrollEl.clientWidth || p.y - r.y > scrollEl.clientHeight) return;
      var additive = e.metaKey || e.ctrlKey || e.shiftKey;
      if (!additive) setSel([]);
      if (S.mode === 'icon' && gridEl) startRubber(e, additive);
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
      if (S.mode !== 'icon' || !gridEl || !gridEl.children.length) return 1;
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
      else if (S.mode === 'icon') {
        var c = cols();
        next = idx + (dir === 'left' ? -1 : dir === 'right' ? 1 : dir === 'up' ? -c : c);
      } else next = idx + (dir === 'up' ? -1 : dir === 'down' ? 1 : 0);
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
    key('arrowleft', function () {
      if (S.mode === 'list') {
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
      if (S.mode === 'list') {
        var p = orderedSel()[0];
        var st = p && LAB.vfs.stat(p);
        if (st && st.type === 'dir' && S.path !== RECENTS) {
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
      pathTargets.forEach(function (f) { f(); });
      pathTargets = [];
      instances.delete(win.id);
    });

    // live updates
    win.own(LAB.bus.on('fs:change', scheduleRender));
    win.own(LAB.bus.on('dnd:drop', function () { if (pendingFlush) { pendingFlush = false; scheduleRender(); } }));
    win.own(LAB.bus.on('dnd:cancel', function () { if (pendingFlush) { pendingFlush = false; scheduleRender(); } }));

    // drop targets: the view (current folder) and every sidebar item
    var viewTarget = {
      id: 'finder:' + win.id + ':view',
      accept: function (pl, mods) { return acceptInto(pl, S.path, mods); },
      enter: function () { scrollEl.classList.add('is-drop'); },
      leave: function () { scrollEl.classList.remove('is-drop'); },
      drop: function (pl, ctx) { scrollEl.classList.remove('is-drop'); transferInto(pl.paths, S.path, ctx.mode === 'copy' ? 'copy' : 'move'); }
    };
    win.own(LAB.dnd.target(scrollEl, viewTarget));
    sideRecs.forEach(function (r) {
      if (!r.path) return;
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
    if (w && w.appId === 'finder' && instances.has(w.id)) return instances.get(w.id);
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
    if (path === RECENTS) return RECENTS;
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
      if (inst.S.filter) { inst.S.filter = ''; inst.searchInput.value = ''; }
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
      return { path: S.path, mode: S.mode, sel: inst.orderedSel(), order: S.order.slice(), hist: S.hist.slice(), hi: S.hi, filter: S.filter, showHidden: S.showHidden };
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
  LAB.menu.register('finder', function () {
    var inst = activeInst();
    var has = !!inst;
    var hasSel = has && inst.S.sel.size > 0;
    var oneSel = has && inst.S.sel.size === 1;
    var real = has && inst.realDir();
    return [
      { label: '檔案', items: [
        { label: '新增 Finder 視窗', shortcut: '⌘N', action: function () { open({}); } },
        { label: '新增檔案夾', shortcut: '⇧⌘N', enabled: real, action: function () { inst.newFolder(); } },
        { label: '打開', shortcut: '⌘O', enabled: hasSel, action: function () { inst.openSelection(); } },
        { label: '關閉視窗', shortcut: '⌘W', enabled: has, action: function () { inst.win.close(); } },
        { separator: true },
        { label: '取得資訊', enabled: false },
        { label: '重新命名', enabled: oneSel, action: function () { inst.startRename(inst.orderedSel()[0]); } },
        { label: '複製', shortcut: '⌘D', enabled: hasSel, action: function () { inst.duplicateSel(); } },
        { label: '快速查看', shortcut: '空白鍵', enabled: hasSel, action: function () { inst.quickLook(inst.orderedSel()[0]); } },
        { label: '移到垃圾桶', shortcut: '⌘⌫', enabled: hasSel, action: function () { inst.trashSel(); } }
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
        { label: '為直欄', shortcut: '⌘3', enabled: false },
        { label: '為圖庫', shortcut: '⌘4', enabled: false },
        { separator: true },
        { label: '顯示路徑列', enabled: has, checked: has && inst.S.showPath, action: function () { inst.togglePathbar(); } },
        { label: '顯示狀態列', enabled: has, checked: has && inst.S.showStatus, action: function () { inst.toggleStatus(); } }
      ] },
      { label: '前往', items: [
        { label: '返回', shortcut: '⌘[', enabled: has && inst.S.hi > 0, action: function () { inst.goBack(); } },
        { label: '下一頁', shortcut: '⌘]', enabled: has && inst.S.hi < inst.S.hist.length - 1, action: function () { inst.goForward(); } },
        { label: '上層檔案夾', shortcut: '⌘↑', enabled: real && inst.S.path !== '/', action: function () { inst.goUp(); } },
        { separator: true },
        { label: '最近項目', action: function () { goTo(RECENTS, 'goto'); } },
        { label: LAB.vfs.displayName(HOME + '/Documents'), shortcut: '⇧⌘O', action: function () { goTo(HOME + '/Documents', 'goto'); } },
        { label: LAB.vfs.displayName(HOME + '/Desktop'), shortcut: '⇧⌘D', action: function () { goTo(HOME + '/Desktop', 'goto'); } },
        { label: LAB.vfs.displayName(HOME + '/Downloads'), shortcut: '⌥⌘L', action: function () { goTo(HOME + '/Downloads', 'goto'); } },
        { label: LAB.vfs.displayName(HOME), shortcut: '⇧⌘H', action: function () { goTo(HOME, 'goto'); } },
        { label: LAB.vfs.displayName('/Applications'), shortcut: '⇧⌘A', action: function () { goTo('/Applications', 'goto'); } },
        { separator: true },
        { label: '前往檔案夾⋯', shortcut: '⇧⌘G', action: function () {
          var i2 = activeInst();
          if (!i2) { var w = open({}); i2 = instances.get(w.id); }
          i2.showGoto();
        } }
      ] },
      { label: '視窗', items: LAB.menu.windowMenu(false) },
      { label: '輔助說明', items: [
        { label: '關於這個練習', action: function () { LAB.apps.launch('about', { tab: 'about' }); } }
      ] }
    ];
  });
})(window.LAB);
