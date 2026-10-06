/* finder.js [SKIN] — 檔案總管 (File Explorer, Windows 11 with tabs) for the Windows practice PC (DESIGN W4, M§4.1, M§3.13).
   App id stays `finder`, hooks stay `fd-*`, events stay `finder:*` and carry INTERNAL (Unix) paths; Windows paths and names appear only on screen,
   through LAB.win (W1). Virtual places are ids that start with a colon: '::home' (首頁), '::thispc' (本機), '::trash' (資源回收筒).
   Every window-scoped bus listener, drop target and key handler goes through win.own (M§3.6). File names are DATA: DOM is built with h()/textContent only. */
(function (LAB) {
  'use strict';

  var h = LAB.util.h;
  var HOME = LAB.vfs.HOME;
  var TRASH = HOME + '/.Trash';                 // the folder behind 資源回收筒 (LAB.vfs.trash puts deleted items here)
  var RECENTS = 'recents:';                      // old Mac id; shown as 首頁
  var V_HOME = '::home', V_PC = '::thispc', V_TRASH = '::trash', V_GAL = '::gallery', V_NET = '::network';
  var QUICK = ['Desktop', 'Downloads', 'Documents', 'Pictures', 'Music', 'Videos'];     // 快速存取, in the order of the navigation pane
  var instances = new Map();                     // winId -> inst
  var delTimes = new Map();                      // trash path -> ms of the deletion (this visit)
  var openedRecent = [];                         // files opened in this visit, newest first (they float to the top of 最近)
  var BAD_CHARS = /[\\\/:*?"<>|]/;

  /* ------------------------------------------------------------ own glyphs (original art, drawn here, no vendor files)
     fd-i-*  = thin 20 px line glyphs for the command bar and menus (currentColor)
     fd-n-*  = small coloured 16 px glyphs of the navigation pane and the 首頁 / 本機 tiles */
  function line(inner, w) { return '<svg viewBox="0 0 20 20"><g fill="none" stroke="currentColor" stroke-width="' + (w || 1.15) + '" stroke-linecap="round" stroke-linejoin="round">' + inner + '</g></svg>'; }
  function col(inner) { return '<svg viewBox="0 0 16 16">' + inner + '</svg>'; }
  var GLYPHS = {
    'fd-i-new': line('<path d="M10 4v12M4 10h12"/>', 1.3),
    'fd-i-cut': line('<circle cx="6" cy="15" r="2.2"/><circle cx="14" cy="15" r="2.2"/><path d="M7.4 13.2 13 3.5M12.6 13.2 7 3.5"/>'),
    'fd-i-copy': line('<rect x="7.5" y="7.5" width="9" height="9.5" rx="1.6"/><path d="M12.5 7.5V5.2a1.7 1.7 0 0 0-1.7-1.7H5.2a1.7 1.7 0 0 0-1.7 1.7v5.6a1.7 1.7 0 0 0 1.7 1.7h2.3"/>'),
    'fd-i-paste': line('<path d="M7 4.5H5.7A1.7 1.7 0 0 0 4 6.2v9.1A1.7 1.7 0 0 0 5.7 17h8.6a1.7 1.7 0 0 0 1.7-1.7V6.2a1.7 1.7 0 0 0-1.7-1.7H13"/><rect x="7" y="3" width="6" height="3.2" rx="1.2"/>'),
    'fd-i-rename': line('<rect x="2.5" y="6.5" width="15" height="7" rx="1.6"/><path d="M10 3.8v12.4M8.2 3.8h3.6M8.2 16.2h3.6"/>'),
    'fd-i-share': line('<path d="M10 12.5V3.5M6.6 6.7 10 3.4l3.4 3.3M4.5 10.5v4.8A1.7 1.7 0 0 0 6.2 17h7.6a1.7 1.7 0 0 0 1.7-1.7v-4.8"/>'),
    'fd-i-delete': line('<path d="M3.5 5.5h13M8 5.5V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.5M5 5.5l.8 10a1.5 1.5 0 0 0 1.5 1.4h5.4a1.5 1.5 0 0 0 1.5-1.4l.8-10M8.3 8.5v5.5M11.7 8.5v5.5"/>'),
    'fd-i-restore': line('<path d="M4 8.5h8a4 4 0 0 1 0 8H7M7.5 5 4 8.5 7.5 12"/>'),
    'fd-i-sort': line('<path d="M6 16V4M3.5 6.5 6 4l2.5 2.5M14 4v12M11.5 13.5 14 16l2.5-2.5"/>'),
    'fd-i-view': line('<rect x="3" y="3.5" width="14" height="13" rx="1.8"/><path d="M3 8h14M8 8v8.5"/>'),
    'fd-i-more': '<svg viewBox="0 0 20 20"><g fill="currentColor"><circle cx="4.5" cy="10" r="1.2"/><circle cx="10" cy="10" r="1.2"/><circle cx="15.5" cy="10" r="1.2"/></g></svg>',
    'fd-i-pane': line('<rect x="3" y="3.5" width="14" height="13" rx="1.8"/><path d="M12 3.5v13"/>'),
    'fd-i-back': line('<path d="M16 10H4.5M9 5.5 4.5 10 9 14.5"/>', 1.3),
    'fd-i-fwd': line('<path d="M4 10h11.5M11 5.5l4.5 4.5-4.5 4.5"/>', 1.3),
    'fd-i-up': line('<path d="M10 16V4.5M5.5 9 10 4.5 14.5 9"/>', 1.3),
    'fd-i-refresh': line('<path d="M16 9.5A6 6 0 1 0 14.3 14M16 4.5v5h-5"/>', 1.2),
    'fd-i-search': line('<circle cx="8.5" cy="8.5" r="4.8"/><path d="M12.2 12.2 17 17"/>', 1.2),
    'fd-i-chev-r': line('<path d="M7.5 4.5 13 10l-5.5 5.5"/>', 1.3),
    'fd-i-chev-d': line('<path d="M4.5 7.5 10 13l5.5-5.5"/>', 1.3),
    'fd-i-close': line('<path d="M5.5 5.5l9 9M14.5 5.5l-9 9"/>', 1.2),
    'fd-i-plus': line('<path d="M10 4.5v11M4.5 10h11"/>', 1.2),
    'fd-i-list': line('<path d="M4 5.5h12M4 10h12M4 14.5h12"/>', 1.3),
    'fd-i-grid': line('<rect x="3.5" y="3.5" width="5.5" height="5.5" rx="1"/><rect x="11" y="3.5" width="5.5" height="5.5" rx="1"/><rect x="3.5" y="11" width="5.5" height="5.5" rx="1"/><rect x="11" y="11" width="5.5" height="5.5" rx="1"/>'),
    'fd-i-terminal': line('<rect x="3" y="4" width="14" height="12" rx="2"/><path d="M6.5 8.5 9 10.5 6.5 12.5M10.5 13h3.5"/>'),
    'fd-i-open': line('<path d="M8.5 4H5.2A1.7 1.7 0 0 0 3.5 5.7v9.1A1.7 1.7 0 0 0 5.2 16.5h9.1a1.7 1.7 0 0 0 1.7-1.7V11.5M11.5 3.5H16.5V8.5M16.2 3.8 9 11"/>'),
    'fd-i-info': line('<circle cx="10" cy="10" r="6.5"/><path d="M10 9v4.5M10 6.6v.2"/>'),
    'fd-i-path': line('<rect x="2.5" y="5.5" width="15" height="9" rx="1.8"/><path d="M5.5 10h2.2M9.5 10h5M9.8 8v4"/>'),
    'fd-i-tiles': line('<rect x="3" y="4" width="5" height="5" rx="1"/><path d="M10.5 5h6.5M10.5 8h4"/><rect x="3" y="11" width="5" height="5" rx="1"/><path d="M10.5 12h6.5M10.5 15h4"/>'),
    'fd-i-content': line('<rect x="3" y="3.5" width="4.5" height="4.5" rx="1"/><path d="M10 4.5h7M10 7h4.5"/><rect x="3" y="12" width="4.5" height="4.5" rx="1"/><path d="M10 13h7M10 15.5h4.5"/>'),
    'fd-i-extract': line('<path d="M2.8 6A1.6 1.6 0 0 1 4.4 4.4h3.3l1.5 1.7h6.4A1.6 1.6 0 0 1 17.2 7.7v6.9a1.6 1.6 0 0 1-1.6 1.6H4.4a1.6 1.6 0 0 1-1.6-1.6z"/><path d="M10 8.4v5M7.9 11.5 10 13.6l2.1-2.1"/>'),
    'fd-i-select': line('<rect x="3.5" y="3.5" width="13" height="13" rx="1.8" stroke-dasharray="2.4 2"/><path d="M7 10.2l2.2 2.2L13.2 8"/>'),
    'fd-n-home': col('<path d="M8 1.5 1.2 7.6l.9 1L8 3.4l5.9 5.2.9-1z" fill="#3b82c8"/><path d="M3.2 8.6v4.9c0 .6.4 1 1 1h2.3v-4h3v4h2.3c.6 0 1-.4 1-1V8.6L8 4.6z" fill="#9aa6b8"/>'),
    'fd-n-gallery': col('<rect x="1.5" y="2.5" width="13" height="11" rx="1.6" fill="#4aa3f0"/><circle cx="11.2" cy="6" r="1.3" fill="#fff6c2"/><path d="M1.5 12 5.6 7.4l3 3.2 2-1.9 3.9 3.8v.5a1.6 1.6 0 0 1-1.6 1.6H3.1a1.6 1.6 0 0 1-1.6-1.6z" fill="#1e63c9"/>'),
    'fd-n-desktop': col('<rect x="1.5" y="3" width="13" height="9" rx="1.4" fill="#3d9be0"/><rect x="1.5" y="3" width="13" height="2.2" rx="1" fill="#1f73bd"/><rect x="4.5" y="13" width="7" height="1.2" rx=".6" fill="#8a8f98"/>'),
    'fd-n-downloads': col('<path d="M8 2v7.4M4.9 6.6 8 9.7l3.1-3.1" fill="none" stroke="#1d9a5b" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/><path d="M2.6 12.8h10.8" stroke="#1d9a5b" stroke-width="1.9" stroke-linecap="round"/>'),
    'fd-n-documents': col('<path d="M3.7 1.8h5.6l3 3V13a1.2 1.2 0 0 1-1.2 1.2H3.7A1.2 1.2 0 0 1 2.5 13V3a1.2 1.2 0 0 1 1.2-1.2z" fill="#f2f4f7" stroke="#8a95a5" stroke-width=".9"/><path d="M9.3 1.8v3h3" fill="#d8dde5" stroke="#8a95a5" stroke-width=".9" stroke-linejoin="round"/><path d="M4.8 7.4h5.8M4.8 9.6h5.8M4.8 11.8h3.6" stroke="#6c7a8c" stroke-width=".9"/>'),
    'fd-n-pictures': col('<rect x="1.5" y="2.5" width="13" height="11" rx="1.6" fill="#dff0ff" stroke="#4aa3f0"/><circle cx="11.2" cy="6" r="1.2" fill="#f5b500"/><path d="M2 12.4 5.6 8l2.8 3 2-1.8 3.6 3.4" fill="none" stroke="#2c9a5b" stroke-width="1.3" stroke-linejoin="round"/>'),
    'fd-n-music': col('<path d="M6.2 11.6V3.4l6.3-1.4v8" fill="none" stroke="#d6453d" stroke-width="1.5" stroke-linejoin="round"/><ellipse cx="4.7" cy="11.8" rx="1.9" ry="1.6" fill="#d6453d"/><ellipse cx="11" cy="10.2" rx="1.9" ry="1.6" fill="#d6453d"/>'),
    'fd-n-videos': col('<rect x="1.5" y="3" width="13" height="10" rx="1.8" fill="#8b5cd6"/><path d="M6.6 5.9v4.2l3.6-2.1z" fill="#fff"/>'),
    'fd-n-thispc': col('<rect x="1.8" y="2.5" width="12.4" height="8.4" rx="1.2" fill="#4aa3f0" stroke="#1f73bd"/><path d="M5.5 13.6h5M8 10.9v2.7" stroke="#7a8190" stroke-width="1.2" stroke-linecap="round"/>'),
    'fd-n-drive': col('<rect x="1.3" y="5.2" width="13.4" height="6.2" rx="1.2" fill="#d6dae1" stroke="#8b94a3" stroke-width=".8"/><rect x="2.6" y="9" width="10.8" height="1.3" rx=".5" fill="#aab2bf"/><g fill="#2b8cff"><rect x="3.2" y="6.4" width="1.2" height="1.2"/><rect x="4.7" y="6.4" width="1.2" height="1.2"/><rect x="3.2" y="7.9" width="1.2" height="1.2"/><rect x="4.7" y="7.9" width="1.2" height="1.2"/></g>'),
    'fd-n-network': col('<circle cx="8" cy="8" r="6.2" fill="#e8f3ff" stroke="#2f7fd0"/><path d="M1.9 8h12.2M8 1.8c2.2 1.9 2.2 10.5 0 12.4M8 1.8c-2.2 1.9-2.2 10.5 0 12.4" fill="none" stroke="#2f7fd0" stroke-width=".9"/>'),
    'fd-n-trash': col('<path d="M3.3 4.8h9.4M6.3 4.8V3.3c0-.4.3-.7.7-.7h2c.4 0 .7.3.7.7v1.5M4.4 4.8l.6 8.4c.1.6.5 1 1.1 1h3.8c.6 0 1-.4 1.1-1l.6-8.4" fill="#e3e7ed" stroke="#7a8494" stroke-linejoin="round"/>'),
    'fd-n-trash-full': col('<path d="M5 4.6 5.8 2.2l1.2.4.7-1.4 1.3.6-.1 2.6" fill="#fff" stroke="#9aa3b2" stroke-width=".8" stroke-linejoin="round"/><path d="M3.3 4.8h9.4M6.3 4.8V3.3c0-.4.3-.7.7-.7h2c.4 0 .7.3.7.7v1.5M4.4 4.8l.6 8.4c.1.6.5 1 1.1 1h3.8c.6 0 1-.4 1.1-1l.6-8.4" fill="#e3e7ed" stroke="#7a8494" stroke-linejoin="round"/>'),
    'fd-n-pin': '<svg viewBox="0 0 12 12"><path d="M4.3 1.2h3.4l-.4 2.6 1.6 1.6v.8H6.5v3.6L6 10.4l-.5-.6V6.2H3.1v-.8l1.6-1.6z" fill="none" stroke="currentColor" stroke-width=".85" stroke-linejoin="round"/></svg>'
  };
  Object.keys(GLYPHS).forEach(function (k) { LAB.icons.add(k, GLYPHS[k]); });
  function gl(name, size) { return LAB.icons.get(name, { size: size || 16 }); }
  /* the 16 px glyph of one of the six quick-access folders */
  var QUICK_GLYPH = { desktop: 'fd-n-desktop', downloads: 'fd-n-downloads', documents: 'fd-n-documents', pictures: 'fd-n-pictures', music: 'fd-n-music', videos: 'fd-n-videos' };

  /* ------------------------------------------------------------------ names, dates, sizes (Windows 11 zh-TW) */
  function toWin(p) {
    if (LAB.win && LAB.win.toWin) return LAB.win.toWin(p);
    return p === '/' ? 'C:\\' : 'C:' + String(p).replace(/\//g, '\\');
  }
  function dname(p) {
    if (LAB.win && LAB.win.displayName) return LAB.win.displayName(p);
    return LAB.vfs.displayName(p);
  }
  /* '2026/10/2 上午 09:47' (File Explorer uses one space; Get-ChildItem prints two) */
  function fmtDate(ms) {
    if (LAB.win && LAB.win.dateParts) return LAB.win.dateParts(ms).join(' ');
    var d = new Date(ms), hr = d.getHours(), h12 = hr % 12 === 0 ? 12 : hr % 12;
    return d.getFullYear() + '/' + (d.getMonth() + 1) + '/' + d.getDate() + ' ' + (hr < 12 ? '上午' : '下午') + ' ' + (h12 < 10 ? '0' : '') + h12 + ':' + (d.getMinutes() < 10 ? '0' : '') + d.getMinutes();
  }
  /* details column: sizes in KB rounded UP, like the real Explorer (1301 bytes -> 2 KB); folders show nothing */
  function kbCell(bytes) { return Math.max(1, Math.ceil((Number(bytes) || 0) / 1024)).toLocaleString('en-US') + ' KB'; }
  /* status bar: 1.27 KB, 12.3 MB */
  function exactSize(b) {
    b = Number(b) || 0;
    if (b < 1024) return b + ' 位元組';
    var u = ['KB', 'MB', 'GB'], v = b, i = -1;
    do { v = v / 1024; i++; } while (v >= 1024 && i < u.length - 1);
    return (v < 10 ? v.toFixed(2) : v < 100 ? v.toFixed(1) : String(Math.round(v))) + ' ' + u[i];       // three digits like Windows: 4.00 KB, 12.3 KB, 123 KB
  }
  var TYPES = {
    '.md': 'Markdown 原始檔', '.txt': '文字文件', '.log': '文字文件', '.csv': 'Microsoft Excel 逗點分隔值檔案', '.docx': 'Microsoft Word 文件',
    '.doc': 'Microsoft Word 97 - 2003 文件', '.pdf': 'Adobe Acrobat Document', '.xlsx': 'Microsoft Excel 工作表', '.pptx': 'Microsoft PowerPoint 簡報',
    '.json': 'JSON 檔案', '.py': 'Python File', '.js': 'JavaScript 檔案', '.html': 'HTML 文件', '.png': 'PNG 檔案', '.jpg': 'JPG 檔案', '.jpeg': 'JPEG 檔案'
  };
  function kindLabel(st) {
    if (st.type === 'dir') return '檔案資料夾';
    var ext = LAB.vfs.extname(st.name).toLowerCase();
    if (st.kind === 'zip' || ext === '.zip') return '壓縮的 (zipped) 資料夾';
    if (st.kind === 'app' || ext === '.exe') return '應用程式';
    if (TYPES[ext]) return TYPES[ext];
    if (!ext) return '檔案';
    return ext.slice(1).toUpperCase() + ' 檔案';
  }

  /* ------------------------------------------------------------------ sizes and long dates (the 內容 dialog, the panes) */
  function utf8Len(s) {
    var n = 0;
    s = String(s || '');
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      if (c < 0x80) n += 1;
      else if (c < 0x800) n += 2;
      else if (c >= 0xD800 && c <= 0xDBFF && i + 1 < s.length) { n += 4; i++; }
      else n += 3;
    }
    return n;
  }
  function commas(n) { return Number(n).toLocaleString('en-US'); }
  /* '1.27 KB (1,301 位元組)', the way the 內容 dialog prints a size; under 1 KB it is '361 位元組 (361 位元組)' like Windows does */
  function sizeLong(b) { b = Number(b) || 0; return exactSize(b) + ' (' + commas(b) + ' 位元組)'; }
  function diskBytes(b) { b = Number(b) || 0; return b <= 0 ? 0 : Math.ceil(b / 4096) * 4096; }     // 4 KB clusters
  function hash32(s) {
    var x = 2166136261;
    s = String(s);
    for (var i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); }
    return x >>> 0;
  }
  /* '2026年10月2日，上午 09:47:12'. Seeded files were all saved on a whole minute, so a stable per-file second is added (a guess about real zh-TW wording: marked in the notes). */
  function longDate(ms, withTime, seed) {
    var d = new Date(ms), hr = d.getHours(), h12 = hr % 12 === 0 ? 12 : hr % 12;
    var s = d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日';
    if (!withTime) return s;
    var sec = d.getSeconds() || (hash32(seed || ms) % 58) + 1;
    function two(n) { return (n < 10 ? '0' : '') + n; }
    return s + '，' + (hr < 12 ? '上午' : '下午') + ' ' + two(h12) + ':' + two(d.getMinutes()) + ':' + two(sec);
  }

  /* ------------------------------------------------------------------ sorting: natural, case-insensitive; Latin before Chinese */
  var COLL = null;
  try { COLL = new Intl.Collator(['zh-Hant-TW', 'zh-TW'], { numeric: true, sensitivity: 'base' }); } catch (e) { COLL = null; }
  function isHanStart(t) { var c = t.codePointAt(0); return c !== undefined && c >= 0x2E80; }
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

  /* two-line label of the large icons with a middle ellipsis for very long names (the full name stays in aria-label) */
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
    if (LAB.util.displayWidth(name) <= 30) return name;
    var cps = Array.from(name);
    return takeWidth(cps, 15, false) + '…' + takeWidth(cps, 12, true);
  }

  /* ------------------------------------------------------------------ pictures: thumbnails
     A picture shows its real pixels when the practice PC has them (LAB.seed.imageUrl(name) of SYS-WIN, LAB.vfs.imageUrl(path), or a data: URL / SVG
     markup as the file's content); otherwise it gets a small landscape drawn here from the file name (our own art, always the same for the same name). */
  var IMG_EXT = { '.png': 1, '.jpg': 1, '.jpeg': 1, '.gif': 1, '.bmp': 1, '.webp': 1, '.svg': 1 };
  function isImage(st) { return !!st && st.type === 'file' && IMG_EXT[LAB.vfs.extname(st.name).toLowerCase()] === 1; }
  var SKIES = [
    ['#79c0f2', '#fde7bd', '#fff4c9', '#7aa9c7', '#4f8f86', '#2f5d4c'],
    ['#2b3a78', '#f5a46a', '#ffe0a3', '#6d5a91', '#4b3f78', '#2a2650'],
    ['#9fd3f5', '#eaf6ff', '#ffffff', '#8fb8d6', '#5f9aa8', '#3d6f78'],
    ['#f2b36d', '#fde9c9', '#fff3d6', '#c98f5b', '#9c6a46', '#654232'],
    ['#8cc7b4', '#e6f3df', '#fffbe0', '#78a98a', '#4f8a5f', '#2d5e3d'],
    ['#14203d', '#40599b', '#f2f0d8', '#31456f', '#223357', '#141f3a']
  ];
  var landCache = Object.create(null);
  function landscape(seed) {
    if (landCache[seed]) return landCache[seed];
    var r = hash32(seed);
    function rnd() { r = (Math.imul(r, 1664525) + 1013904223) >>> 0; return r / 4294967296; }
    var P = SKIES[hash32(seed + '#') % SKIES.length];
    function hill(base, amp, col) {
      var y = base + rnd() * 24, p = 'M0 ' + y.toFixed(0);
      for (var x = 0; x < 400; x += 100) p += ' C' + (x + 30) + ' ' + (y - amp * rnd()).toFixed(0) + ',' + (x + 70) + ' ' + (y + amp * rnd()).toFixed(0) + ',' + (x + 100) + ' ' + (base + rnd() * 24).toFixed(0);
      return '<path d="' + p + ' V300 H0Z" fill="' + col + '"/>';
    }
    var sx = 60 + rnd() * 280, sy = 50 + rnd() * 50;
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + P[0] + '"/><stop offset="1" stop-color="' + P[1] + '"/></linearGradient></defs>' +
      '<rect width="400" height="300" fill="url(#s)"/><circle cx="' + sx.toFixed(0) + '" cy="' + sy.toFixed(0) + '" r="' + (16 + rnd() * 14).toFixed(0) + '" fill="' + P[2] + '" opacity=".92"/>' +
      hill(150, 40, P[3]) + hill(190, 34, P[4]) + hill(236, 26, P[5]) + '</svg>';
    var uri = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    landCache[seed] = uri;
    return uri;
  }
  var imgCache = Object.create(null);
  function imageSrc(st) {
    var key = st.path + '|' + st.mtime + '|' + st.size;
    if (imgCache[key]) return imgCache[key];
    var src = '', c = '';
    try { if (LAB.seed && LAB.seed.imageUrl) src = LAB.seed.imageUrl(st.name) || ''; } catch (e0) { src = ''; }      // SYS-WIN: the drawn photos of Pictures (name based, so a copy shows it too)
    try { if (!src && LAB.vfs.imageUrl) src = LAB.vfs.imageUrl(st.path) || ''; } catch (e) { src = ''; }
    if (!src && st.size < 400 * 1024) {
      try { c = LAB.vfs.readFile(st.path); } catch (e2) { c = ''; }
      if (typeof c === 'string') {
        if (c.indexOf('data:image/') === 0) src = c;
        else if (/^\s*<svg[\s>]/i.test(c)) src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(c);
      }
    }
    if (!src) src = landscape(st.name);
    imgCache[key] = src;
    return src;
  }
  /* <img> of a picture, `box` px wide (4:3) */
  function thumbEl(st, box) {
    var im = h('img', { class: 'fd-th', alt: '', draggable: 'false', src: imageSrc(st) });
    im.style.width = box + 'px'; im.style.height = Math.round(box * 0.75) + 'px';
    return im;
  }

  /* ------------------------------------------------------------------ zip folders
     A .zip is browsed like a read-only folder (Windows 11). A place inside one is written as the zip file's internal path, then the path inside
     it: '/Users/an/Downloads/week3.zip' (the top) or '/Users/an/Downloads/week3.zip/week3' (a folder in it). toWin() turns that into
     C:\Users\an\Downloads\week3.zip\week3, which is what the real address bar shows. The entries come from LAB.vfs.zipList (TERM-WIN's API);
     before it exists the older LAB.vfs.zipEntries is used, so browsing works either way. */
  function zipPathGate(p) { return /\.zip(\/|$)/i.test(p); }
  function zipLocOf(p) {
    if (!p || typeof p !== 'string' || p.charAt(0) !== '/' || !zipPathGate(p)) return null;
    var parts = p.split('/').filter(Boolean), cur = '';
    for (var i = 0; i < parts.length; i++) {
      cur += '/' + parts[i];
      var st = LAB.vfs.stat(cur);
      if (!st) return null;
      if (st.type === 'dir') continue;
      if (st.kind === 'zip') return { zip: st.path, inner: parts.slice(i + 1).join('/'), st: st };
      return null;
    }
    return null;
  }
  var zipCache = { key: '', info: null };
  function zipInfo(zipPath) {
    var st = LAB.vfs.stat(zipPath);
    if (!st || st.type !== 'file' || st.kind !== 'zip') return null;
    var key = st.path + '|' + st.mtime + '|' + st.size;
    if (zipCache.key === key && zipCache.info) return zipCache.info;
    var raw = null, list = null;
    try { raw = LAB.vfs.zipEntries ? LAB.vfs.zipEntries(st.path) : null; } catch (e) { raw = null; }
    try { list = LAB.vfs.zipList ? LAB.vfs.zipList(st.path) : null; } catch (e2) { list = null; }
    if (list && !Array.isArray(list) && list.entries) list = list.entries;
    var src = Array.isArray(list) ? list : raw;
    if (!src) return null;
    var byName = {};
    (raw || []).forEach(function (z) { byName[z.name] = z; });
    var entries = [], rawTotal = 0;
    src.forEach(function (en) {
      var rw = byName[en.name];
      var isDir = en.type === 'dir';
      var size = isDir ? 0 : (en.size !== undefined ? en.size : (rw ? utf8Len(rw.content) : 0));
      rawTotal += size;
      entries.push({ name: en.name, type: isDir ? 'dir' : 'file', size: size, mtime: en.mtime || (rw && rw.mtime) || st.mtime });
    });
    // 壓縮大小: the practice zip does not really deflate, so each file gets a stable share of the archive's real size
    var overhead = 22 + entries.length * 100;
    var f = rawTotal > 0 ? Math.max(0.2, Math.min(0.95, (st.size - overhead) / rawTotal)) : 1;
    entries.forEach(function (en) {
      if (en.type === 'dir') { en.csize = 0; return; }
      var jit = 1 + ((hash32(en.name) % 13) - 6) / 100;
      en.csize = Math.max(1, Math.min(en.size, Math.round(en.size * f * jit)));
    });
    var info = { st: st, entries: entries };
    zipCache = { key: key, info: info };
    return info;
  }
  function zipHasDir(info, inner) {
    if (!inner) return true;
    var pre = inner + '/';
    return info.entries.some(function (en) { var nm = en.name; return nm === pre || nm.indexOf(pre) === 0; });
  }
  function zipStatOf(info, relName, en, isDir) {
    var base = relName.replace(/\/$/, '');
    var nm = base.slice(base.lastIndexOf('/') + 1);
    var mt = en && en.mtime ? en.mtime : info.st.mtime;
    return {
      path: info.st.path + '/' + base, name: nm, type: isDir ? 'dir' : 'file', kind: isDir ? 'folder' : 'text', size: isDir ? 0 : (en ? en.size : 0),
      csize: isDir ? 0 : (en ? en.csize : 0), mtime: mt, ctime: mt, dot: false, hidden: false, zipEntry: true, zipPath: info.st.path
    };
  }
  /* the entries directly inside `inner` ('' = the top of the archive) */
  function zipChildren(info, inner) {
    var pre = inner ? inner + '/' : '';
    var kids = new Map();
    info.entries.forEach(function (en) {
      var nm = en.name.replace(/\/$/, '');
      if (pre && nm.indexOf(pre) !== 0) return;
      var rest = nm.slice(pre.length);
      if (!rest) return;
      var i = rest.indexOf('/');
      if (i >= 0) {
        var d = rest.slice(0, i);
        if (!kids.has(d)) kids.set(d, zipStatOf(info, pre + d, null, true));
      } else if (en.type === 'dir') kids.set(rest, zipStatOf(info, pre + rest, en, true));
      else kids.set(rest, zipStatOf(info, pre + rest, en, false));
    });
    return Array.from(kids.values());
  }
  /* every entry below `inner`, flat (a search inside a zip) */
  function zipAll(info, inner) {
    var pre = inner ? inner + '/' : '', out = [], seen = {};
    info.entries.forEach(function (en) {
      var nm = en.name.replace(/\/$/, '');
      if (pre && nm.indexOf(pre) !== 0) return;
      if (nm === inner) return;
      var parts = nm.split('/'), acc = '';
      for (var i = 0; i < parts.length - 1; i++) {
        acc += (acc ? '/' : '') + parts[i];
        if (acc.length >= pre.length && !seen[acc] && acc !== inner) { seen[acc] = 1; out.push(zipStatOf(info, acc, null, true)); }
      }
      if (!seen[nm]) { seen[nm] = 1; out.push(zipStatOf(info, nm, en, en.type === 'dir')); }
    });
    return out;
  }
  function zipEntryStat(loc) {
    var info = zipInfo(loc.zip);
    if (!info || !loc.inner) return null;
    var want = loc.inner.toLowerCase(), found = null;
    info.entries.forEach(function (en) {
      var nm = en.name.replace(/\/$/, '');
      if (nm.toLowerCase() === want && !found) found = zipStatOf(info, nm, en, en.type === 'dir');
    });
    if (!found && zipHasDir(info, loc.inner)) found = zipStatOf(info, loc.inner, null, true);
    return found;
  }
  /* the three calls of TERM-WIN's zip API, guarded: a PC that does not have one yet still works (compressing says so, the others fall back) */
  function zipExtractCall(zipPath, destDir, o) {
    if (LAB.vfs.zipExtract) { var r = LAB.vfs.zipExtract(zipPath, destDir, o); return r && r.ok === undefined ? { ok: true, created: r } : r; }
    if (LAB.vfs.extractZip) { var c = LAB.vfs.extractZip(zipPath, destDir, o); return { ok: true, created: c || [] }; }
    return null;
  }

  /* ------------------------------------------------------------------ places */
  function isVirt(p) { return typeof p === 'string' && (p.charAt(0) === ':' || p === RECENTS); }
  function kindOfPath(p) { return p === V_HOME ? 'home' : p === V_PC ? 'pc' : p === V_TRASH ? 'trash' : (zipLocOf(p) ? 'zip' : 'dir'); }
  /* the id a location is kept under: virtual ids as they are ('recents:' and unknown colon ids become 首頁), real paths canonical */
  function normLoc(p) {
    if (p === undefined || p === null || p === '') return null;
    if (p === V_HOME || p === V_PC || p === V_TRASH) return p;
    if (isVirt(p)) return V_HOME;
    var c = LAB.vfs.canon(p);
    return LAB.vfs.same(c, TRASH) ? V_TRASH : c;      // the folder behind the Recycle Bin is shown as 資源回收筒
  }
  function labelOf(st) { return st.type === 'dir' ? dname(st.path) : st.name; }
  function sameDir(a, b) { return LAB.vfs.same(a, b); }
  function isTrashDir(p) { return !isVirt(p) && LAB.vfs.same(p, TRASH); }
  function underTrash(p) { return !isVirt(p) && LAB.vfs.isUnder(p, TRASH); }
  function trashCount() { try { return LAB.vfs.list(TRASH).length; } catch (e) { return 0; } }
  function userDir(name) { return LAB.vfs.canon(HOME + '/' + name); }
  function stat(p) {
    if (isVirt(p)) return null;
    var s = LAB.vfs.stat(p);
    if (s) return s;
    var zl = zipLocOf(p);                       // an entry inside a zip: a made-up stat (read-only)
    return zl && zl.inner ? zipEntryStat(zl) : null;
  }
  /* a place a window can stand in: a virtual place, a folder, or a folder inside a zip */
  function validLoc(p) {
    if (isVirt(p)) return true;
    if (LAB.vfs.isDir(p)) return true;
    var zl = zipLocOf(p);
    if (!zl) return false;
    var info = zipInfo(zl.zip);
    return !!info && (!zl.inner || zipHasDir(info, zl.inner));
  }

  /* 最近: files opened in this visit first, then the newest files under home (hidden ones such as .Trash are skipped) */
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
    var first = [], seen = new Set();
    openedRecent.forEach(function (p) {
      var s = stat(p);
      if (s && s.type === 'file' && !s.hidden && !seen.has(s.path)) { seen.add(s.path); first.push(s); }
    });
    return first.concat(out.filter(function (s) { return !seen.has(s.path); })).slice(0, 12);
  }
  LAB.bus.on('finder:open', function (d) {
    if (!d || !d.path || d.kind === 'folder' || d.kind === 'missing') return;
    var i = openedRecent.indexOf(d.path);
    if (i >= 0) openedRecent.splice(i, 1);
    openedRecent.unshift(d.path);
  });
  LAB.bus.on('fs:change', function (d) {                      // remember when an item went to the 資源回收筒
    if (d && d.trashed && d.path && d.op !== 'remove') delTimes.set(d.path, LAB.clock.ms());
  });
  function delTime(st) { return delTimes.get(st.path) || st.mtime; }

  /* finder:navigate 'via' is one of this fixed set (M§3.3 + 'address' for the typed address bar); callers such as Search or the Terminal pass their own name, which maps to 'open' */
  var VIAS = { sidebar: 1, pathbar: 1, back: 1, forward: 1, up: 1, open: 1, goto: 1, desktop: 1, dock: 1, initial: 1, address: 1 };
  function normVia(v, dflt) { return VIAS[v] === 1 ? v : dflt; }
  function tx(e) { return LAB.stage.toStage(e.clientX, e.clientY); }
  function below(el) { var r = LAB.stage.rectOf(el); return { x: r.x, y: r.y + r.h + 2 }; }

  /* open a folder in the Terminal (「在終端中開啟」, the real Windows Terminal string): the Terminal's own API when it has one, else a launch with a start folder */
  function openTerminalAt(path) {
    if (LAB.terminal && typeof LAB.terminal.openAt === 'function') { LAB.terminal.openAt(path); return; }
    LAB.apps.launch('terminal', { cwd: path });
  }
  function notInstalled(st) {
    var ext = LAB.vfs.extname(st.name).toLowerCase();
    if (ext === '.docx' || ext === '.doc') LAB.ui.toast('練習版沒有安裝 Word');
    else if (ext === '.pdf') LAB.ui.toast('練習版沒有安裝 PDF 閱讀器');
    else LAB.ui.toast('練習版沒有可以開啟這個檔案的程式');
  }
  /* a file in a folder window: a real .zip is browsed like a folder (the window does that itself; this is the fallback), a .zip that is not an archive
     says so, the apps without a Windows counterpart (Quick Look) -> a toast; the rest through openPath */
  function openFileFromExplorer(st) {
    var ext = LAB.vfs.extname(st.name).toLowerCase();
    if (st.kind === 'zip') { open({ path: st.path, via: 'open' }); return; }
    if (ext === '.zip') { LAB.ui.toast('這個壓縮的 (zipped) 資料夾無效，打不開'); return; }
    var def = LAB.apps.defaultFor(st.path);
    if (def === 'quicklook' || def === 'archive') { notInstalled(st); return; }
    LAB.apps.openPath(st.path, { via: 'finder' });
  }

  /* make sure a name is legal in Windows: trim, no trailing dots or spaces */
  function cleanName(s) { return String(s).replace(/^\s+/, '').replace(/[\s.]+$/, ''); }

  function clipSet(paths, op) {
    LAB.clipboard.setPaths(paths, op);
    LAB.clipboard.text = paths.map(toWin).join('\n');       // pasting into the Terminal wants Windows paths
    instances.forEach(function (i) { i.markCut(); });
  }
  function clipClear() {
    LAB.clipboard.paths = []; LAB.clipboard.op = 'copy';
    instances.forEach(function (i) { i.markCut(); });
  }

  /* ================================================================ 快速存取 pins (shared by every window, like the real one) */
  var pinned = null;               // internal paths, in the order shown
  function pinList() {
    if (!pinned) pinned = QUICK.map(userDir);
    return pinned.filter(function (p) { return LAB.vfs.isDir(p); });
  }
  function isPinned(p) { return !isVirt(p) && pinList().some(function (q) { return LAB.vfs.same(q, p); }); }
  function pinGlyph(p) {
    var st = LAB.vfs.stat(p);
    if (st && LAB.vfs.same(LAB.vfs.dirname(st.path), HOME) && QUICK_GLYPH[st.name.toLowerCase()]) return QUICK_GLYPH[st.name.toLowerCase()];
    return 'folder';
  }
  function setPinned(p, on) {
    var c = LAB.vfs.canon(p);
    pinList();
    pinned = pinned.filter(function (q) { return !LAB.vfs.same(q, c); });
    if (on) pinned.push(c);
    instances.forEach(function (i) { i.refreshNav(); });
  }

  /* ================================================================ dialogs (module level: the windows and the public API both use them) */
  function modalHost(win) { return win && win.el && win.el.parentNode ? win.el : document.getElementById('lab-overlays'); }
  /* a ContentDialog-like panel on a window (or on the stage when there is no window). o = {cls, label, cancelValue, onEnter, build(panel, api)} */
  function openModal(win, o) {
    var attached = !!(win && win.el && win.el.parentNode);
    var panel = h('div', { class: 'lab-sheet fd-dlg ' + (o.cls || ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': o.label || '' });
    panel.classList.add(attached ? 'is-attached' : 'is-centered');
    var scrim = h('div', { class: 'lab-sheet-scrim ' + (attached ? 'is-window' : 'is-stage') }, panel);
    var prev = document.activeElement;
    var done = false, offModal = null, offClose = null, resolveFn = null;
    var promise = new Promise(function (res) { resolveFn = res; });
    var api = {
      panel: panel, scrim: scrim, promise: promise,
      close: function (val) {
        if (done) return;
        done = true;
        if (offModal) offModal();
        if (offClose) offClose();
        scrim.classList.remove('is-in');
        setTimeout(function () { if (scrim.parentNode) scrim.parentNode.removeChild(scrim); }, 160);
        try { if (prev && prev.focus && document.contains(prev)) prev.focus(); } catch (e) { /* ignore */ }
        resolveFn(val === undefined ? null : val);
      }
    };
    o.build(panel, api);
    modalHost(win).appendChild(scrim);
    requestAnimationFrame(function () { scrim.classList.add('is-in'); });
    offModal = LAB.keys.modal(function (e) {
      if (LAB.ui.isImeEnter(e)) return false;
      if (e.key === 'Tab') {
        var f = [].slice.call(panel.querySelectorAll('input,button,[tabindex="0"]')).filter(function (x) { return !x.disabled && x.offsetParent !== null; });
        if (!f.length) return true;
        var i = f.indexOf(document.activeElement);
        f[e.shiftKey ? (i <= 0 ? f.length - 1 : i - 1) : (i === f.length - 1 ? 0 : i + 1)].focus();
        return true;
      }
      if (e.key === 'Escape') { api.close(o.cancelValue); return true; }
      if (e.key === 'Enter' && o.onEnter) {
        var t = document.activeElement;
        if (t && t.tagName === 'BUTTON' && !t.classList.contains('is-default')) return false;
        o.onEnter(e);
        return true;
      }
      return false;
    });
    if (win && win.on) offClose = win.on('close', function () { api.close(o.cancelValue); });
    return api;
  }
  function dbtn(label, cls, hook, fn) {
    var b = h('button', { type: 'button', class: 'fd-dbtn' + (cls ? ' ' + cls : ''), dataset: hook ? { lab: hook } : null }, label);
    if (fn) b.addEventListener('click', fn);
    return b;
  }

  /* 瀏覽資料夾: a small tree of the practice PC's folders; resolves the chosen internal path, or null */
  function pickFolder(win, start) {
    var sel = LAB.vfs.canon(start || HOME);
    var openSet = new Set(['/']);
    (function () { var cur = ''; sel.split('/').filter(Boolean).forEach(function (pt) { cur += '/' + pt; openSet.add(cur); }); })();
    var treeEl = null;
    var m = openModal(win, {
      cls: 'fd-pick', label: '瀏覽資料夾', cancelValue: null,
      onEnter: function () { m.close(sel); },
      build: function (panel, api) {
        treeEl = h('div', { class: 'fd-pick-tree', role: 'tree', tabindex: '0', dataset: { lab: 'fd-pick-tree' } });
        panel.appendChild(h('div', { class: 'fd-wiz-bar' }, h('span', { class: 'fd-wiz-title' }, '瀏覽資料夾')));
        panel.appendChild(h('div', { class: 'fd-pick-body' }, h('div', { class: 'fd-pick-hint' }, '選取要解壓縮到的目的地資料夾。'), treeEl));
        panel.appendChild(h('div', { class: 'fd-dbtns' },
          dbtn('確定', 'is-default', 'fd-pick-ok', function () { api.close(sel); }),
          dbtn('取消', '', 'fd-pick-cancel', function () { api.close(null); })));
      }
    });
    function draw() {
      treeEl.textContent = '';
      (function add(p, depth) {
        var kids = [];
        try { kids = LAB.vfs.list(p).filter(function (s) { return s.type === 'dir' && !s.hidden; }); } catch (e) { kids = []; }
        var isOpen = openSet.has(p);
        var row = h('div', { class: 'fd-pick-row' + (LAB.vfs.same(p, sel) ? ' is-sel' : ''), role: 'treeitem', 'aria-selected': LAB.vfs.same(p, sel) ? 'true' : 'false', dataset: { lab: 'fd-pick-row', path: p } });
        row.style.paddingLeft = (6 + depth * 16) + 'px';
        var chev = h('span', { class: 'fd-pick-chev' + (kids.length ? '' : ' is-none') + (isOpen ? ' is-open' : ''), 'aria-hidden': 'true' });
        chev.innerHTML = gl('fd-i-chev-r', 10);
        var ico = h('span', { class: 'fd-pick-ico', 'aria-hidden': 'true' });
        ico.innerHTML = LAB.icons.get(p === '/' ? 'fd-n-drive' : 'folder', { size: 16 });
        row.appendChild(chev); row.appendChild(ico); row.appendChild(h('span', { class: 'fd-pick-t' }, dname(p)));
        chev.addEventListener('click', function (e) { e.stopPropagation(); if (openSet.has(p)) openSet.delete(p); else openSet.add(p); draw(); });
        row.addEventListener('click', function () { sel = p; draw(); });
        row.addEventListener('dblclick', function () { if (openSet.has(p)) openSet.delete(p); else openSet.add(p); draw(); });
        treeEl.appendChild(row);
        if (isOpen) {
          kids.sort(function (a, b) { return cmpStr(a.name, b.name); });
          kids.forEach(function (k) { add(k.path, depth + 1); });
        }
      })('/', 0);
      var cur = treeEl.querySelector('.is-sel');
      if (cur && (cur.offsetTop < treeEl.scrollTop || cur.offsetTop + 26 > treeEl.scrollTop + treeEl.clientHeight)) treeEl.scrollTop = Math.max(0, cur.offsetTop - 90);
    }
    draw();
    return m.promise;
  }

  /* ---------------- 解壓縮 (the extraction itself, and the wizard around it) */
  var NO_WRITE = ['/', '/Users', '/Windows', '/Program Files', '/Program Files (x86)'];       // Windows asks for an administrator here
  /* the one top-level folder a zip holds ('' when it holds several things, or loose files) */
  function zipTopFolder(info) {
    var roots = {}, n = 0, only = '';
    info.entries.forEach(function (en) {
      var seg = en.name.split('/').filter(Boolean)[0];
      if (seg && !roots[seg]) { roots[seg] = 1; n++; only = seg; }
    });
    if (n !== 1) return '';
    var isDir = info.entries.some(function (en) { return en.type === 'dir' && en.name.replace(/\/$/, '') === only; });
    var kids = info.entries.some(function (en) { return en.name.replace(/\/$/, '').indexOf(only + '/') === 0; });
    return isDir || kids ? only : '';
  }
  /* Where the files really land for a chosen destination folder. A zip that holds ONE folder named like the destination is unpacked beside it,
     so week3.zip -> Project\week3 gives Project\week3\README.md (the same files `tar -xvf week3.zip` leaves in Project) and not week3\week3\README.md.
     Real Windows nests it twice; this is a deliberate simplification (see the notes) that keeps the tar mission's file checks true after the wizard. */
  function extractTarget(info, dest) {
    var top = zipTopFolder(info);
    return top && LAB.vfs.basename(dest).toLowerCase() === top.toLowerCase() ? LAB.vfs.dirname(dest) : dest;
  }
  function conflictCount(zipPath, dest) {
    var info = zipInfo(zipPath);
    if (!info) return 0;
    var target = extractTarget(info, LAB.vfs.canon(dest)), n = 0;
    info.entries.forEach(function (en) { if (en.type === 'file' && LAB.vfs.isFile(LAB.vfs.join(target, en.name))) n++; });
    return n;
  }
  /* extract `zipPath` for the destination folder `dest` (which may not exist yet): {ok, dest, target, created} or {ok:false, error} */
  function doExtract(zipPath, dest, o) {
    o = o || {};
    var info = zipInfo(zipPath);
    if (!info) return { ok: false, error: 'EINVAL' };
    dest = LAB.vfs.canon(dest);
    for (var i = 0; i < NO_WRITE.length; i++) if (LAB.vfs.same(dest, NO_WRITE[i])) return { ok: false, error: 'EACCES' };
    var target = extractTarget(info, dest);
    if (LAB.vfs.exists(target) && !LAB.vfs.isDir(target)) return { ok: false, error: 'ENOTDIR' };
    var r = null, opts = { by: 'finder' };
    if (o.skipExisting) {                           // 略過這些檔案: the entries whose file is already there are left out (zipExtract takes a filter on the entry names)
      var skip = {};
      info.entries.forEach(function (en) { if (en.type === 'file' && LAB.vfs.isFile(LAB.vfs.join(target, en.name))) skip[en.name] = 1; });
      opts.filter = function (nm) { return !skip[nm]; };
    }
    try { r = zipExtractCall(zipPath, target, opts); } catch (e) { return { ok: false, error: (e && e.code) || 'EINVAL' }; }
    if (!r || r.ok === false) return { ok: false, error: (r && r.error) || 'EINVAL' };
    return { ok: true, dest: dest, target: target, created: r.created || [] };
  }
  function extractFailed(win, res, name) {
    if (res && res.error === 'EACCES') {
      return LAB.ui.alert(win, { title: '目的地資料夾存取被拒', text: '您需要系統管理員權限，才能把檔案解壓縮到這個資料夾。練習用的電腦沒有系統管理員帳戶，請換一個資料夾。', buttons: [{ label: '確定', value: true, 'default': true }] });
    }
    return LAB.ui.alert(win, { title: '解壓縮失敗', text: '無法解壓縮「' + name + '」' + (res && res.error ? '（' + LAB.vfs.errText(res.error) + '）' : '') + '。', buttons: [{ label: '確定', value: true, 'default': true }] });
  }
  /* the little 「正在解壓縮」 progress dialog; the files are written when it finishes, so 取消 really cancels */
  function extractProgress(win, zst, destName, n) {
    var m = openModal(win, {
      cls: 'fd-copydlg', label: '正在解壓縮', cancelValue: 'cancel',
      build: function (panel, api) {
        panel.appendChild(h('div', { class: 'fd-wiz-bar' }, h('span', { class: 'fd-wiz-title' }, '正在解壓縮')));
        panel.appendChild(h('div', { class: 'fd-copy-body' },
          h('div', { class: 'fd-copy-t' }, '正在解壓縮 ' + n + ' 個項目'),
          h('div', { class: 'fd-copy-s' }, '從 ' + zst.name + ' 到 ' + destName),
          h('div', { class: 'fd-copy-bar', 'aria-hidden': 'true' }, h('i')),
          h('div', { class: 'fd-copy-s' }, '正在計算剩餘時間…')));
        panel.appendChild(h('div', { class: 'fd-dbtns' }, dbtn('取消', '', 'fd-extract-stop', function () { api.close('cancel'); })));
      }
    });
    var timer = setTimeout(function () { m.close('done'); }, 800);
    return m.promise.then(function (v) { clearTimeout(timer); return v === 'done'; });
  }
  /* 解壓縮壓縮的 (zipped) 資料夾: choose a destination (default: a folder named like the zip, beside it), 完成時顯示解壓縮的檔案 */
  function extractWizard(zipPath, win, o) {
    o = o || {};
    var zst = LAB.vfs.stat(zipPath);
    if (!zst || zst.kind !== 'zip' || !zipInfo(zst.path)) { LAB.ui.toast('這個壓縮的 (zipped) 資料夾無效，打不開'); return Promise.resolve(null); }
    if (!LAB.vfs.zipExtract && !LAB.vfs.extractZip) { LAB.ui.toast('練習版還沒有解壓縮功能'); return Promise.resolve(null); }
    var folder = zst.name.replace(/\.zip$/i, '') || zst.name;
    var defDest = o.dest ? LAB.vfs.canon(o.dest) : LAB.vfs.join(LAB.vfs.dirname(zst.path), folder);
    var inEl = null, chk = null, busy = false;
    function go(api) {
      if (busy) return;
      var txt = inEl.value.trim();
      var dest = txt && LAB.win && LAB.win.fromWin ? LAB.win.fromWin(txt, LAB.vfs.dirname(zst.path), { localized: true }) : null;
      var parent = dest ? LAB.vfs.dirname(dest) : null;
      if (!dest || (LAB.vfs.exists(dest) && !LAB.vfs.isDir(dest)) || !LAB.vfs.isDir(LAB.vfs.exists(dest) ? dest : parent)) {
        busy = true;
        LAB.ui.alert(win, { title: '解壓縮壓縮的 (zipped) 資料夾', text: '找不到這個目的地：「' + txt + '」。請檢查路徑，然後再試一次。', buttons: [{ label: '確定', value: true, 'default': true }] }).then(function () { busy = false; inEl.focus(); inEl.select(); });
        return;
      }
      var show = chk.checked;
      for (var i = 0; i < NO_WRITE.length; i++) {
        if (LAB.vfs.same(dest, NO_WRITE[i])) { busy = true; extractFailed(win, { error: 'EACCES' }, zst.name).then(function () { busy = false; inEl.focus(); }); return; }
      }
      var n = conflictCount(zst.path, dest);
      function proceed(skip) {
        api.close('go');
        var info = zipInfo(zst.path);
        extractProgress(win, zst, dname(dest), info ? info.entries.length : 0).then(function (ok) {
          if (!ok) { finish({ ok: false, canceled: true }); return; }
          var res = doExtract(zst.path, dest, { skipExisting: skip });
          if (!res.ok) { extractFailed(win, res, zst.name).then(function () { finish(res); }); return; }
          if (show) open({ path: res.dest, via: 'open', fresh: true });
          finish(res);
        });
      }
      if (n) {
        busy = true;
        LAB.ui.alert(win, {
          title: '取代或略過檔案', text: '目的地已經有 ' + n + ' 個名稱相同的檔案。要取代它們，還是略過？',
          buttons: [{ label: '取代目的地中的檔案', value: 'replace', 'default': true }, { label: '略過這些檔案', value: 'skip' }, { label: '取消', value: null, cancel: true }]
        }).then(function (v) { busy = false; if (v === 'replace') proceed(false); else if (v === 'skip') proceed(true); });
        return;
      }
      proceed(false);
    }
    var finish = null;
    var result = new Promise(function (res) { finish = res; });
    var m = openModal(win, {
      cls: 'fd-wiz', label: '解壓縮壓縮的 (zipped) 資料夾', cancelValue: null,
      onEnter: function () { go(m); },
      build: function (panel, api) {
        var ico = h('span', { class: 'fd-wiz-ico', 'aria-hidden': 'true' });
        ico.innerHTML = LAB.icons.get('zip', { size: 16 });
        var x = h('button', { type: 'button', class: 'fd-wiz-x', 'aria-label': '關閉', dataset: { lab: 'fd-extract-cancel-x' } });
        x.innerHTML = gl('fd-i-close', 12);
        x.addEventListener('click', function () { api.close(null); });
        panel.dataset.lab = 'fd-extract-wizard';
        inEl = h('input', { type: 'text', class: 'fd-wiz-in', 'aria-label': '檔案將解壓縮到這個資料夾', spellcheck: 'false', autocomplete: 'off', dataset: { lab: 'fd-extract-dest' } });
        inEl.value = toWin(defDest);
        chk = h('input', { type: 'checkbox', id: 'fd-wiz-chk-' + (++wizSeq), dataset: { lab: 'fd-extract-show' } });
        chk.checked = o.show !== false;
        var browse = dbtn('瀏覽…', '', 'fd-extract-browse', function () {
          var cur = LAB.win && LAB.win.fromWin ? LAB.win.fromWin(inEl.value, LAB.vfs.dirname(zst.path), { localized: true }) : null;
          pickFolder(win, cur && LAB.vfs.isDir(cur) ? cur : LAB.vfs.dirname(zst.path)).then(function (p) { if (p) inEl.value = toWin(p); inEl.focus(); });
        });
        panel.appendChild(h('div', { class: 'fd-wiz-bar' }, ico, h('span', { class: 'fd-wiz-title' }, '解壓縮壓縮的 (zipped) 資料夾'), x));
        panel.appendChild(h('div', { class: 'fd-wiz-body' },
          h('div', { class: 'fd-wiz-h' }, '選取目的地並解壓縮檔案'),
          h('div', { class: 'fd-wiz-l' }, '檔案將解壓縮到這個資料夾:'),
          h('div', { class: 'fd-wiz-row' }, inEl, browse),
          h('label', { class: 'fd-wiz-chk' }, chk, h('span', null, '完成時顯示解壓縮的檔案'))));
        panel.appendChild(h('div', { class: 'fd-dbtns' },
          dbtn('解壓縮', 'is-default', 'fd-extract-go', function () { go(api); }),
          dbtn('取消', '', 'fd-extract-cancel', function () { api.close(null); })));
        setTimeout(function () { inEl.focus(); inEl.select(); }, 30);
      }
    });
    m.promise.then(function (v) { if (v !== 'go') finish(null); });
    return result;
  }
  var wizSeq = 0;

  /* ---------------- 壓縮成 ZIP 檔案: the new zip sits beside the first item and is named after it (Windows names it after the item you clicked) */
  function compressPaths(paths, o) {
    o = o || {};
    var list = (paths || []).map(function (p) { return stat(p); }).filter(function (s) { return s && !s.zipEntry && !underTrash(s.path); });
    if (!list.length) return null;
    if (!LAB.vfs.zipCreate) { LAB.ui.toast('練習版還沒有壓縮功能'); return null; }
    var first = list[0];
    var dest = o.dest ? LAB.vfs.canon(o.dest) : null;
    if (!dest) {
      var dir = LAB.vfs.dirname(first.path);
      var base = first.type === 'dir' ? first.name : (first.name.replace(/\.[^.]*$/, '') || first.name);
      dest = LAB.vfs.join(dir, LAB.vfs.uniqueName(dir, base, '.zip'));
    }
    var r;
    try { r = LAB.vfs.zipCreate(list.map(function (s) { return s.path; }), dest, { by: 'finder' }); }
    catch (e) { LAB.ui.vfsFail(o.win || null, e, '無法壓縮這些項目（' + LAB.vfs.errText(e && e.code) + '）', dest); return null; }
    if (!r || r.ok === false) {                     // zipCreate answers {ok:false, error} (it does not throw)
      var code = r && r.error;
      if (code === 'EACCES') LAB.ui.vfsFail(o.win || null, { code: 'EACCES' }, '', dest);
      else if (code === 'ENOSPC' || code === 'ETOOBIG') LAB.ui.toast('這些項目太大，練習用的電腦壓縮不了');
      else LAB.ui.toast('無法壓縮這些項目');
      return null;
    }
    var made = r.path || dest;
    LAB.undo.push('壓縮「' + first.name + '」', function () { try { LAB.vfs.remove(made, { by: 'finder' }); } catch (e2) { /* already gone */ } });
    return { ok: true, path: made, entries: r.entries };
  }

  /* ---------------- 內容: the Windows properties dialog (一般 is real; 安全性, 詳細資料, 以前的版本 are screens only) */
  var propsZ = 20;
  function openWithName(st) {
    if (st.type === 'dir') return '';
    if (st.kind === 'zip') return 'Windows 檔案總管';
    var id = LAB.apps.defaultFor(st.path);
    var def = id && id !== 'quicklook' && id !== 'archive' ? LAB.apps.get(id) : null;
    return def && def.title ? def.title : '（沒有指定的程式）';
  }
  function countBelow(path) {
    var files = 0, dirs = 0, bytes = 0;
    try {
      LAB.vfs.walk(path, function (s, depth) {
        if (depth === 0) return;
        if (s.type === 'dir') dirs++; else { files++; bytes += s.size; }
      });
    } catch (e) { /* ignore */ }
    return { files: files, dirs: dirs, bytes: bytes };
  }
  function openProps(paths, win) {
    var sts = (paths || []).map(function (p) { return stat(p); }).filter(Boolean);
    if (!sts.length) return null;
    var one = sts.length === 1 ? sts[0] : null;
    var layer = document.getElementById('lab-overlays');
    var fresh = {};                                     // what the student changed (applied by 確定 / 套用)
    var title = one ? labelOf(one) + ' 內容' : '內容';
    var nameIn = null, roChk = null, hidChk = null, applyBtn = null, selPrincipal = 'SYSTEM';

    function row(label, node, cls) {
      return h('div', { class: 'fd-pr-row' + (cls ? ' ' + cls : '') }, h('div', { class: 'fd-pr-k' }, label), h('div', { class: 'fd-pr-v' }, node));
    }
    function hr() { return h('div', { class: 'fd-pr-hr', role: 'separator' }); }

    function paneGeneral() {
      var el = h('div', { class: 'fd-pr-pane', role: 'tabpanel', dataset: { pane: 'general' } });
      var big = h('span', { class: 'fd-pr-ico', 'aria-hidden': 'true' });
      big.innerHTML = LAB.icons.get(one ? LAB.icons.forNode(one) : 'doc', { size: 32 });
      var kinds = {}, fileN = 0, dirN = 0, bytes = 0;
      sts.forEach(function (s) {
        kinds[s.type === 'dir' ? '檔案資料夾' : kindLabel(s)] = 1;
        if (s.type === 'dir') { var c = countBelow(s.path); fileN += c.files; dirN += 1 + c.dirs; bytes += c.bytes; }
        else { fileN++; bytes += s.size; }
      });
      if (one && one.type === 'dir') { dirN -= 1; }
      var head = h('div', { class: 'fd-pr-head' }, big);
      if (one) {
        nameIn = h('input', { type: 'text', class: 'fd-pr-name', 'aria-label': '名稱', spellcheck: 'false', autocomplete: 'off', dataset: { lab: 'fd-props-name' } });
        nameIn.value = one.name;
        if (one.zipEntry || underTrash(one.path)) nameIn.readOnly = true;
        nameIn.addEventListener('input', function () { fresh.name = nameIn.value; applyBtn.disabled = false; });
        head.appendChild(nameIn);
      } else head.appendChild(h('div', { class: 'fd-pr-multi' }, sts.length + ' 個項目'));
      el.appendChild(head);
      el.appendChild(hr());
      var kindNames = Object.keys(kinds);
      if (one) {
        var ext = one.type === 'dir' ? '' : LAB.vfs.extname(one.name);
        el.appendChild(row(one.type === 'dir' ? '類型:' : '檔案類型:', kindLabel(one) + (ext ? ' (' + ext.toLowerCase() + ')' : '')));
        if (one.type !== 'dir') {
          var ow = h('div', { class: 'fd-pr-open' }, h('span', null, openWithName(one)), dbtn('變更(C)…', 'is-small', 'fd-props-change', function () { LAB.ui.toast('練習版沒有「開啟檔案的程式」設定'); }));
          el.appendChild(row('開啟檔案的程式:', ow));
        }
      } else el.appendChild(row('類型:', kindNames.length === 1 ? kindNames[0] : '多種類型'));
      var dirs = {};
      sts.forEach(function (s) { dirs[toWin(LAB.vfs.dirname(s.path))] = 1; });
      var dirKeys = Object.keys(dirs);
      el.appendChild(hr());
      el.appendChild(row('位置:', (one ? '' : '全部在 ') + (dirKeys.length === 1 ? dirKeys[0] : '多個位置'), 'is-path'));
      el.appendChild(row('大小:', sizeLong(bytes)));
      var disk = 0;
      sts.forEach(function (s) {
        if (s.type === 'dir') { try { LAB.vfs.walk(s.path, function (x) { if (x.type === 'file') disk += diskBytes(x.size); }); } catch (e) { /* ignore */ } }
        else disk += diskBytes(s.size);
      });
      el.appendChild(row('磁碟大小:', sizeLong(disk)));
      if (sts.some(function (s) { return s.type === 'dir'; })) el.appendChild(row('內容:', fileN + ' 個檔案，' + dirN + ' 個資料夾'));
      if (one) {
        el.appendChild(hr());
        el.appendChild(row('建立日期:', longDate(one.ctime || one.mtime, true, one.path)));
        if (one.type !== 'dir') {
          el.appendChild(row('修改日期:', longDate(one.mtime, true, one.path)));
          el.appendChild(row('存取日期:', longDate(LAB.clock.ms(), false)));
        }
      }
      el.appendChild(hr());
      var anyDir = sts.some(function (s) { return s.type === 'dir'; });
      var std = one && LAB.win && LAB.win.mode && LAB.win.mode(one).charAt(2) === 'r';
      roChk = h('input', { type: 'checkbox', id: 'fd-pr-ro', dataset: { lab: 'fd-props-readonly' } });
      if (std) roChk.indeterminate = true;
      hidChk = h('input', { type: 'checkbox', id: 'fd-pr-hid', dataset: { lab: 'fd-props-hidden' } });
      hidChk.checked = sts.every(function (s) { return !!s.hidden; });
      [roChk, hidChk].forEach(function (c) { c.addEventListener('change', function () { fresh.attr = true; applyBtn.disabled = false; }); });
      var adv = dbtn('進階(D)…', 'is-small', 'fd-props-adv', function () { LAB.ui.toast('練習版沒有進階屬性'); });
      el.appendChild(row('屬性:', h('div', { class: 'fd-pr-attr' },
        h('label', { class: 'fd-pr-chk' }, roChk, h('span', null, anyDir ? '唯讀 (僅適用於資料夾中的檔案)(R)' : '唯讀(R)')),
        h('label', { class: 'fd-pr-chk' }, hidChk, h('span', null, '隱藏(H)')), adv), 'is-attrs'));
      return el;
    }

    function paneSecurity() {
      var el = h('div', { class: 'fd-pr-pane', role: 'tabpanel', dataset: { pane: 'security' } });
      el.appendChild(row('物件名稱:', one ? toWin(one.path) : '多個項目', 'is-path'));
      el.appendChild(h('div', { class: 'fd-pr-cap' }, '群組或使用者名稱(G):'));
      var who = ['SYSTEM', 'an (AN-LAPTOP\\an)', 'Administrators (AN-LAPTOP\\Administrators)'];
      var list = h('div', { class: 'fd-pr-list', role: 'listbox' });
      var permLbl = h('div', { class: 'fd-pr-cap' }, 'SYSTEM 的權限(P)');
      who.forEach(function (w, i) {
        var li = h('div', { class: 'fd-pr-li' + (i === 0 ? ' is-on' : ''), role: 'option', tabindex: '0' }, w);
        li.addEventListener('click', function () {
          [].forEach.call(list.children, function (c) { c.classList.remove('is-on'); });
          li.classList.add('is-on');
          permLbl.textContent = w.split(' (')[0] + ' 的權限(P)';
        });
        list.appendChild(li);
      });
      el.appendChild(list);
      el.appendChild(h('div', { class: 'fd-pr-line' }, h('span', null, '若要變更權限，請按一下 [編輯]。'), dbtn('編輯(E)…', 'is-small', 'fd-props-edit', function () { LAB.ui.toast('練習版不能變更權限'); })));
      el.appendChild(h('div', { class: 'fd-pr-perm-h' }, permLbl, h('span', null, '允許'), h('span', null, '拒絕')));
      var perms = ['完全控制', '修改', '讀取和執行'];
      if (sts.some(function (s) { return s.type === 'dir'; })) perms.push('列出資料夾內容');
      perms.push('讀取', '寫入');
      var tbl = h('div', { class: 'fd-pr-perm' });
      perms.forEach(function (p) { tbl.appendChild(h('div', { class: 'fd-pr-perm-r' }, h('span', null, p), h('span', { class: 'fd-pr-ck' }, '✓'), h('span', null, ''))); });
      el.appendChild(tbl);
      el.appendChild(h('div', { class: 'fd-pr-line' }, h('span', null, '如需特殊權限或進階設定，請按一下 [進階]。'), dbtn('進階(V)', 'is-small', 'fd-props-adv2', function () { LAB.ui.toast('練習版沒有進階安全性設定'); })));
      return el;
    }

    function paneDetails() {
      var el = h('div', { class: 'fd-pr-pane', role: 'tabpanel', dataset: { pane: 'details' } });
      var tbl = h('div', { class: 'fd-pr-dt' });
      function g(t) { tbl.appendChild(h('div', { class: 'fd-pr-dg' }, t)); }
      function r(k, v) { tbl.appendChild(h('div', { class: 'fd-pr-dr' }, h('span', { class: 'fd-pr-dk' }, k), h('span', { class: 'fd-pr-dv' }, v))); }
      if (one) {
        var ext = one.type === 'dir' ? '' : LAB.vfs.extname(one.name);
        g('說明');
        r('名稱', one.name);
        r('項目類型', kindLabel(one));
        if (ext) r('檔案副檔名', ext.toLowerCase());
        g('檔案');
        r('資料夾路徑', toWin(LAB.vfs.dirname(one.path)));
        r('建立日期', fmtDate(one.ctime || one.mtime));
        r('修改日期', fmtDate(one.mtime));
        if (one.type !== 'dir') r('大小', exactSize(one.size));
        r('屬性', one.type === 'dir' ? 'D' : 'A');
        r('可用性', '僅存在於這部電腦');
        r('離線狀態', '線上');
        g('來源');
        r('擁有者', 'AN-LAPTOP\\an');
        r('電腦', 'AN-LAPTOP (這部電腦)');
      } else { g('檔案'); r('項目', sts.length + ' 個項目'); r('位置', '多個位置'); }
      el.appendChild(tbl);
      return el;
    }

    function paneVersions() {
      var el = h('div', { class: 'fd-pr-pane', role: 'tabpanel', dataset: { pane: 'versions' } });
      el.appendChild(h('div', { class: 'fd-pr-note' }, '先前的版本來自檔案記錄或還原點。先前的版本可讓您還原意外修改或刪除的檔案。'));
      el.appendChild(h('div', { class: 'fd-pr-vt' }, h('div', { class: 'fd-pr-vh' }, h('span', null, '檔案版本'), h('span', null, '修改日期')), h('div', { class: 'fd-pr-ve' }, '沒有可用的先前版本。')));
      el.appendChild(h('div', { class: 'fd-pr-vb' }, dbtn('開啟(O)', 'is-small', null, null), dbtn('還原(R)…', 'is-small', null, null)));
      [].forEach.call(el.querySelectorAll('.fd-pr-vb button'), function (b) { b.disabled = true; });
      return el;
    }

    var TABS = [['general', '一般', paneGeneral], ['security', '安全性', paneSecurity], ['details', '詳細資料', paneDetails], ['versions', '以前的版本', paneVersions]];
    var panes = {};
    var ico = h('span', { class: 'fd-pr-bico', 'aria-hidden': 'true' });
    ico.innerHTML = LAB.icons.get(one ? LAB.icons.forNode(one) : 'folder', { size: 16 });
    var xBtn = h('button', { type: 'button', class: 'fd-pr-x', 'aria-label': '關閉', dataset: { lab: 'fd-props-close' } });
    xBtn.innerHTML = gl('fd-i-close', 12);
    var bar = h('div', { class: 'fd-pr-bar', dataset: { drag: '1' } }, ico, h('span', { class: 'fd-pr-title' }, title), xBtn);
    var tabEls = [];
    var tabsEl = h('div', { class: 'fd-pr-tabs', role: 'tablist' });
    var body = h('div', { class: 'fd-pr-body' });
    function showTab(id) {
      TABS.forEach(function (t, i) {
        var on = t[0] === id;
        tabEls[i].classList.toggle('is-on', on);
        tabEls[i].setAttribute('aria-selected', on ? 'true' : 'false');
        if (!panes[t[0]]) panes[t[0]] = t[2]();
        if (on) { body.textContent = ''; body.appendChild(panes[t[0]]); }
      });
    }
    TABS.forEach(function (t) {
      var b = h('button', { type: 'button', class: 'fd-pr-tab', role: 'tab', dataset: { lab: 'fd-props-tab', tab: t[0] } }, t[1]);
      b.addEventListener('click', function () { showTab(t[0]); });
      tabEls.push(b); tabsEl.appendChild(b);
    });
    var okBtn = dbtn('確定', 'is-default', 'fd-props-ok', null);
    var noBtn = dbtn('取消', '', 'fd-props-cancel', null);
    applyBtn = dbtn('套用(A)', '', 'fd-props-apply', null);
    applyBtn.disabled = true;
    var panel = h('div', { class: 'fd-props', role: 'dialog', 'aria-label': title, tabindex: '-1', dataset: { lab: 'fd-props' } },
      bar, h('div', { class: 'fd-pr-frame' }, tabsEl, body), h('div', { class: 'fd-pr-btns' }, okBtn, noBtn, applyBtn));
    var closed = false;
    function close() {
      if (closed) return;
      closed = true;
      if (offWin) offWin();
      if (panel.parentNode) panel.parentNode.removeChild(panel);
      propsOpen = propsOpen.filter(function (x) { return x.panel !== panel; });
    }
    function apply() {
      var ok = true;
      if (one && fresh.name !== undefined && fresh.name !== one.name) {
        var nm = cleanName(fresh.name);
        if (!nm || BAD_CHARS.test(nm)) { LAB.ui.toast('檔案名稱不可包含下列任何字元：\\ / : * ? " < > |'); return false; }
        if (nm !== one.name) {
          try {
            var np = LAB.vfs.rename(one.path, nm, { by: 'finder' });
            var oldName = one.name, oldPath = np;
            LAB.undo.push('重新命名「' + oldName + '」', function () { LAB.vfs.rename(oldPath, oldName, { by: 'finder' }); });
            one = stat(np) || one; sts[0] = one; title = labelOf(one) + ' 內容';
            panel.querySelector('.fd-pr-title').textContent = title;
          } catch (e) {
            ok = false;
            if (e.code === 'EEXIST') LAB.ui.toast('已經有相同名稱的檔案或資料夾存在。請指定其他名稱。');
            else if (e.code === 'EPROTECTED') LAB.ui.vfsFail(null, e, '', one.path);
            else LAB.ui.toast('這個名稱不能用');
          }
        }
      }
      if (fresh.attr) LAB.ui.toast('練習版不會真的變更檔案屬性');
      if (ok) { fresh = {}; applyBtn.disabled = true; }
      return ok;
    }
    okBtn.addEventListener('click', function () { if (apply()) close(); });
    noBtn.addEventListener('click', close);
    xBtn.addEventListener('click', close);
    applyBtn.addEventListener('click', apply);
    panel.addEventListener('keydown', function (e) {
      e.stopPropagation();
      if (LAB.ui.isImeEnter(e)) return;
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === 'Enter' && !(e.target && e.target.tagName === 'BUTTON' && e.target !== okBtn)) { e.preventDefault(); if (apply()) close(); }
    });
    panel.addEventListener('pointerdown', function () { panel.style.zIndex = String(++propsZ); });
    // dragging by the title bar (stage pixels, so a scaled stage still follows the pointer)
    bar.addEventListener('pointerdown', function (e) {
      if (e.button !== 0 || (e.target.closest && e.target.closest('button'))) return;
      var p0 = LAB.stage.toStage(e.clientX, e.clientY), x0 = parseFloat(panel.style.left) || 0, y0 = parseFloat(panel.style.top) || 0, pid = e.pointerId;
      function move(ev) {
        if (ev.pointerId !== pid) return;
        var p = LAB.stage.toStage(ev.clientX, ev.clientY);
        panel.style.left = Math.max(-300, Math.min(LAB.stage.w - 60, x0 + p.x - p0.x)) + 'px';
        panel.style.top = Math.max(0, Math.min(LAB.stage.h - 80, y0 + p.y - p0.y)) + 'px';
      }
      function up(ev) {
        if (ev.pointerId !== pid) return;
        window.removeEventListener('pointermove', move, true); window.removeEventListener('pointerup', up, true); window.removeEventListener('pointercancel', up, true);
      }
      window.addEventListener('pointermove', move, true); window.addEventListener('pointerup', up, true); window.addEventListener('pointercancel', up, true);
    });
    panel.style.zIndex = String(++propsZ);
    layer.appendChild(panel);
    // centred over the window it came from (else the stage), kept above the taskbar
    var pw = panel.offsetWidth || 408, ph = panel.offsetHeight || 520;
    var r0 = win && win.getRect ? win.getRect() : { x: 0, y: 0, w: LAB.stage.w, h: LAB.stage.h };
    var offs = (propsOpen.length % 5) * 24;
    panel.style.left = Math.round(Math.max(8, Math.min(LAB.stage.w - pw - 8, r0.x + (r0.w - pw) / 2 + offs))) + 'px';
    panel.style.top = Math.round(Math.max(8, Math.min((LAB.stage.dockTop ? LAB.stage.dockTop() : LAB.stage.h - 60) - ph - 8, r0.y + (r0.h - ph) / 2 + offs))) + 'px';
    var offWin = win && win.on ? win.on('close', close) : null;
    propsOpen.push({ panel: panel, close: close });
    showTab('general');
    setTimeout(function () { okBtn.focus(); }, 20);
    return { close: close, el: panel };
  }
  var propsOpen = [];

  /* ================================================================ one File Explorer window */
  /* the columns a folder's details view can show (the right-click menu of the header picks them); widths in px, name is the stretchy one */
  var COLCAT = {
    name:  { t: '名稱', w: 180 },
    date:  { t: '修改日期', w: 152 },
    ctime: { t: '建立日期', w: 152 },
    atime: { t: '存取日期', w: 152 },
    kind:  { t: '類型', w: 204 },
    size:  { t: '大小', w: 80, r: 1 },
    attr:  { t: '屬性', w: 72 },
    ext:   { t: '副檔名', w: 84 }
  };
  var COL_ORDER = ['name', 'date', 'ctime', 'atime', 'kind', 'size', 'attr', 'ext'];
  var DEFAULT_COLS = ['name', 'date', 'kind', 'size'];
  var COLDEFS = {
    trash:  [{ k: 'name', t: '名稱', w: 'minmax(160px, 1fr)' }, { k: 'orig', t: '原始位置', w: 'minmax(140px, 220px)' }, { k: 'deleted', t: '刪除日期', w: '152px' }, { k: 'size', t: '大小', w: '80px', r: 1 }, { k: 'kind', t: '項目類型', w: '190px' }],
    recent: [{ k: 'name', t: '名稱', w: 'minmax(180px, 1fr)' }, { k: 'where', t: '位置', w: 'minmax(140px, 240px)' }, { k: 'date', t: '修改日期', w: '152px' }],
    // inside a zip: 名稱 類型 壓縮大小 密碼保護 大小 比例 修改日期 (the real order of Windows 11)
    zip:    [{ k: 'name', t: '名稱', w: 'minmax(140px, 1fr)' }, { k: 'kind', t: '類型', w: '132px' }, { k: 'csize', t: '壓縮大小', w: '80px', r: 1 }, { k: 'pwd', t: '密碼保護', w: '70px' }, { k: 'size', t: '大小', w: '72px', r: 1 }, { k: 'ratio', t: '比例', w: '56px', r: 1 }, { k: 'date', t: '修改日期', w: '144px' }]
  };
  /* the view modes of 檢視: 'icon' (大圖示) and 'list' (詳細資料) keep their old names (finder:view {mode}, the status-bar buttons, the missions' hooks) */
  var MODES = {
    xl:      { label: '超大圖示', kind: 'grid', ico: 144, cell: 176, key: '1' },
    icon:    { label: '大圖示', kind: 'grid', ico: 72, cell: 112, key: '2' },
    md:      { label: '中圖示', kind: 'grid', ico: 48, cell: 96, key: '3' },
    sm:      { label: '小圖示', kind: 'small', ico: 16, key: '4' },
    plist:   { label: '清單', kind: 'small', ico: 16, key: '5' },
    list:    { label: '詳細資料', kind: 'details', key: '6' },
    tiles:   { label: '並排', kind: 'tiles', ico: 48, key: '7' },
    content: { label: '內容', kind: 'content', ico: 32, key: '8' }
  };
  var MODE_ORDER = ['xl', 'icon', 'md', 'sm', 'plist', 'list', 'tiles', 'content'];
  var ADDR_NAMES = { '首頁': V_HOME, '快速存取': V_HOME, 'home': V_HOME, '本機': V_PC, '我的電腦': V_PC, 'this pc': V_PC, '資源回收筒': V_TRASH, 'recycle bin': V_TRASH };

  var PANE_MEMORY = { which: '' };     // '' | 'preview' | 'details': the pane the student last turned on is what the next window starts with (Windows remembers it)

  function createFinder(startPath, via, opts) {
    opts = opts || {};
    startPath = normLoc(startPath) || V_HOME;
    var S = {
      path: startPath, hist: [startPath], hi: 0,
      mode: 'list', sort: { key: 'name', dir: 1 }, sortTouched: false, colsSel: DEFAULT_COLS.slice(), colW: {}, group: '',
      sel: new Set(), anchor: null, filter: '', showHidden: false, showNav: true, pane: PANE_MEMORY.which,
      navExp: new Set(), homeFold: {},
      renaming: null, order: [], rendered: false, sheet: null,
      pendingSel: opts.select ? opts.select.slice() : null, topCount: 0,
      addrEditing: false, addrBusy: false, silentSel: false
    };
    var items = new Map();            // path -> rec
    var win = null;
    var renderTimer = null, pendingFlush = false, disposed = false;
    var host = null, wrapEl = null, headEl = null, emptyEl = null, hostKey = '';
    var tabs = [{}], tabIdx = 0, tabSeq = 1;
    var TAB_KEYS = ['path', 'hist', 'hi', 'mode', 'sort', 'sortTouched', 'colsSel', 'colW', 'group', 'sel', 'anchor', 'filter'];

    /* ---------- DOM skeleton ---------- */
    function ibtn(cls, hook, label, icon, size) {
      var b = h('button', { type: 'button', class: cls, 'aria-label': label, title: label, dataset: { lab: hook } });
      b.innerHTML = gl(icon, size || 16);
      return b;
    }
    var tabsEl = h('div', { class: 'fd-tabs', role: 'tablist', 'aria-label': '索引標籤', dataset: { lab: 'fd-tabs' } });

    var backBtn = ibtn('fd-nb', 'fd-back', '返回 (Alt+←)', 'fd-i-back'); backBtn.disabled = true;
    var fwdBtn = ibtn('fd-nb', 'fd-forward', '下一頁 (Alt+→)', 'fd-i-fwd'); fwdBtn.disabled = true;
    var upBtn = ibtn('fd-nb', 'fd-up', '向上 (Alt+↑)', 'fd-i-up');
    var refreshBtn = ibtn('fd-addr-btn', 'fd-refresh', '重新整理', 'fd-i-refresh', 15);
    var crumbsEl = h('div', { class: 'fd-crumbs', dataset: { lab: 'fd-pathbar' } });
    var addrIn = h('input', { type: 'text', class: 'fd-addr-in', 'aria-label': '網址列', spellcheck: 'false', autocomplete: 'off', dataset: { lab: 'fd-address' } });
    var progEl = h('i', { class: 'fd-prog', 'aria-hidden': 'true' });          // the green search progress that sweeps across the address bar
    var addrBox = h('div', { class: 'fd-addrbox' }, progEl, crumbsEl, addrIn, refreshBtn);
    var searchIn = h('input', { type: 'text', class: 'fd-search-in', placeholder: '搜尋', 'aria-label': '搜尋', spellcheck: 'false', autocomplete: 'off', dataset: { lab: 'fd-search' } });
    var searchIco = h('span', { class: 'fd-search-ico', 'aria-hidden': 'true' });
    searchIco.innerHTML = gl('fd-i-search', 15);
    var addrRow = h('div', { class: 'fd-addr' }, h('div', { class: 'fd-navbtns' }, backBtn, fwdBtn, upBtn), addrBox, h('div', { class: 'fd-searchbox' }, searchIn, searchIco));

    var cmdEl = h('div', { class: 'fd-cmd', role: 'toolbar', 'aria-label': '命令列', dataset: { lab: 'fd-cmdbar' } });
    var navEl = h('nav', { class: 'fd-nav', 'aria-label': '瀏覽窗格', dataset: { lab: 'fd-nav' } });
    var scrollEl = h('div', { class: 'fd-scroll', role: 'listbox', 'aria-multiselectable': 'true', 'aria-label': '檔案列表', tabindex: '-1', dataset: { lab: 'fd-scroll' } });
    var statusTxt = h('div', { class: 'fd-status-txt' });
    var viewListBtn = h('button', { type: 'button', class: 'fd-vt is-on', 'aria-label': '詳細資料', title: '詳細資料 (Ctrl+Shift+6)', 'aria-pressed': 'true', dataset: { lab: 'fd-view-list' } });
    var viewIconBtn = h('button', { type: 'button', class: 'fd-vt', 'aria-label': '大圖示', title: '大圖示 (Ctrl+Shift+2)', 'aria-pressed': 'false', dataset: { lab: 'fd-view-icon' } });
    viewListBtn.innerHTML = gl('fd-i-list', 16);
    viewIconBtn.innerHTML = gl('fd-i-grid', 16);
    var viewTog = h('div', { class: 'fd-vtog', role: 'group', 'aria-label': '檢視' }, viewListBtn, viewIconBtn);
    var statusEl = h('div', { class: 'fd-status', role: 'status', dataset: { lab: 'fd-status' } }, statusTxt, viewTog);
    var paneEl = h('aside', { class: 'fd-pane', hidden: true, 'aria-label': '窗格', dataset: { lab: 'fd-pane' } });      // 預覽窗格 / 詳細資料窗格
    var root = h('div', { class: 'fd-root' },
      addrRow, cmdEl,
      h('div', { class: 'fd-body' }, navEl, h('div', { class: 'fd-main' }, h('div', { class: 'fd-mainrow' }, scrollEl, paneEl), statusEl)));

    /* ---------- tabs (the title bar) ---------- */
    function tabIconName(path) {
      var k = kindOfPath(path);
      if (k === 'home') return 'fd-n-home';
      if (k === 'pc') return 'fd-n-thispc';
      if (k === 'trash') return trashCount() ? 'fd-n-trash-full' : 'fd-n-trash';
      if (k === 'zip') return 'zip';
      return 'folder';
    }
    function snapTab() {
      var t = tabs[tabIdx];
      TAB_KEYS.forEach(function (k) { t[k] = S[k]; });
      t.scroll = scrollEl.scrollTop;
    }
    function loadTab(t) {
      TAB_KEYS.forEach(function (k) { S[k] = t[k]; });
      searchIn.value = S.filter;
      if (win) win.state.path = S.path;
    }
    function renderTabs() {
      tabsEl.textContent = '';
      tabs.forEach(function (t, i) {
        var path = i === tabIdx ? S.path : t.path;
        var label = dname(path);
        var ico = h('span', { class: 'fd-tab-ico', 'aria-hidden': 'true' });
        ico.innerHTML = gl(tabIconName(path), 16);
        var x = h('button', { type: 'button', class: 'fd-tab-x', 'aria-label': '關閉索引標籤', title: '關閉索引標籤', dataset: { lab: 'fd-tab-close' } });
        x.innerHTML = gl('fd-i-close', 12);
        var tab = h('div', { class: 'fd-tab' + (i === tabIdx ? ' is-on' : ''), role: 'tab', 'aria-selected': i === tabIdx ? 'true' : 'false', tabindex: '-1', title: label, dataset: { lab: 'fd-tab', nodrag: '1', path: isVirt(path) ? path : path } },
          ico, h('span', { class: 'fd-tab-t' }, label), x);
        tab.addEventListener('click', function () { switchTab(i); });
        tab.addEventListener('dblclick', function (e) { e.stopPropagation(); });
        tab.addEventListener('auxclick', function (e) { if (e.button === 1) { e.preventDefault(); closeTab(i); } });
        x.addEventListener('click', function (e) { e.stopPropagation(); closeTab(i); });
        x.addEventListener('dblclick', function (e) { e.stopPropagation(); });
        tabsEl.appendChild(tab);
      });
      var plus = h('button', { type: 'button', class: 'fd-tab-new', 'aria-label': '新增索引標籤 (Ctrl+T)', title: '新增索引標籤 (Ctrl+T)', dataset: { lab: 'fd-tab-new' } });
      plus.innerHTML = gl('fd-i-plus', 16);
      plus.addEventListener('click', function () { newTab(V_HOME); });
      plus.addEventListener('dblclick', function (e) { e.stopPropagation(); });
      tabsEl.appendChild(plus);
    }
    function switchTab(i) {
      if (i === tabIdx || !tabs[i]) return;
      cancelEdits();
      snapTab();
      tabIdx = i;
      loadTab(tabs[i]);
      hostKey = ''; clearItems();
      render();
      scrollEl.scrollTop = tabs[i].scroll || 0;
      updateChrome();
    }
    function newTab(path) {
      cancelEdits();
      snapTab();
      var p = normLoc(path) || V_HOME;
      tabs.push({ path: p, hist: [p], hi: 0, mode: 'list', sort: { key: 'name', dir: 1 }, sortTouched: false, colsSel: DEFAULT_COLS.slice(), colW: {}, group: '', sel: new Set(), anchor: null, filter: '', scroll: 0 });
      tabIdx = tabs.length - 1;
      loadTab(tabs[tabIdx]);
      tabSeq++;
      hostKey = ''; clearItems();
      render();
      updateChrome();
      LAB.bus.emit('finder:navigate', { winId: win.id, path: S.path, via: 'initial' });
    }
    function closeTab(i) {
      if (tabs.length <= 1) { win.close(); return; }
      cancelEdits();
      var wasOn = i === tabIdx;
      if (!wasOn) snapTab();
      tabs.splice(i, 1);
      if (wasOn) {
        tabIdx = Math.min(i, tabs.length - 1);
        loadTab(tabs[tabIdx]);
        hostKey = ''; clearItems();
        render();
        scrollEl.scrollTop = tabs[tabIdx].scroll || 0;
      } else if (i < tabIdx) tabIdx--;
      updateChrome();
    }
    function cancelEdits() {
      if (S.renaming) { var r = S.renaming; var rec = items.get(r); if (rec && rec.cancelRename) rec.cancelRename(); }
      if (S.addrEditing) endAddressEdit(false);
    }

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
      updateCmdState();
      // a selection the program made (a new folder, a rename) is silent; the next deliberate click on it still counts as a click by the student
      if (o.silent) S.silentSel = true;
      else if (!same || o.force) { S.silentSel = false; LAB.bus.emit('finder:select', { winId: win ? win.id : null, paths: orderedSel() }); }
    }
    function selectRange(toPath) {
      var a = S.order.indexOf(S.anchor), b = S.order.indexOf(toPath);
      if (a < 0) { setSel([toPath]); S.anchor = toPath; return; }
      var lo = Math.min(a, b), hi = Math.max(a, b);
      setSel(S.order.slice(lo, hi + 1));
    }
    function markCut() {
      var cut = LAB.clipboard.op === 'cut' ? (LAB.clipboard.paths || []) : [];
      items.forEach(function (rec, p) { rec.el.classList.toggle('is-cut', cut.indexOf(p) >= 0); });
    }

    /* ---------- location kind ---------- */
    function realDir() { return !isVirt(S.path) && LAB.vfs.isDir(S.path); }
    function inTrashView() { return S.path === V_TRASH; }
    function inZip() { return kindOfPath(S.path) === 'zip'; }
    /* the shape of the main area: a search from 首頁 or 本機 shows a flat list of results like a folder does; a zip is listed like a folder (read-only) */
    function shape() {
      var k = kindOfPath(S.path);
      if (S.filter && (k === 'home' || k === 'pc')) return 'dir';
      return k === 'zip' ? 'dir' : k;
    }
    function searchBase() { return S.path === V_HOME ? HOME : S.path === V_PC ? '/' : S.path === V_TRASH ? TRASH : S.path; }
    function colsKey() { return inTrashView() ? 'trash' : inZip() ? 'zip' : (S.filter ? 'search' : 'dir'); }
    /* the columns of the current details view: the chosen ones (right-click a header), with the widths the student dragged */
    function widthOf(c) {
      var w = S.colW[c.k];
      return w ? w + 'px' : c.w;
    }
    function curCols(variantCols) {
      var k = variantCols || colsKey(), base;
      if (k === 'recent') return COLDEFS.recent;
      if (k === 'dir' || k === 'search') {
        var srch = k === 'search';        // a result list leaves room for 資料夾路徑: narrower name and type columns
        base = S.colsSel.map(function (key) {
          var c = COLCAT[key];
          return { k: key, t: c.t, w: key === 'name' ? 'minmax(' + (srch ? 130 : c.w) + 'px, 1fr)' : (srch && key === 'kind' ? 150 : c.w) + 'px', r: c.r };
        });
        if (srch) base.push({ k: 'where', t: '資料夾路徑', w: 'minmax(170px, 1.4fr)' });
      } else base = COLDEFS[k];
      return base.map(function (c) { return { k: c.k, t: c.t, r: c.r, w: widthOf(c) }; });
    }
    function modeKind() { return (MODES[S.mode] || MODES.list).kind; }
    function attrText(st) {
      var a = '';
      if (LAB.win && LAB.win.mode && !st.zipEntry && LAB.win.mode(st).charAt(2) === 'r') a += 'R';
      if (st.hidden) a += 'H';
      return a + (st.type === 'dir' ? 'D' : 'A');
    }
    function extOf(st) { return st.type === 'dir' ? '' : LAB.vfs.extname(st.name).toLowerCase(); }
    function ratioOf(st) { return st.type === 'dir' || !st.size ? 0 : (1 - (st.csize || 0) / st.size); }

    /* ---------- listing ---------- */
    function effSort() { return S.sort; }
    /* 群組依據: which group an item falls in (rank = the order of the groups, label = what the group header says) */
    var GROUPS = { name: '名稱', date: '修改日期', kind: '類型', size: '大小' };
    var DATE_GROUPS = ['今天', '昨天', '本週稍早', '上週', '本月稍早', '上個月', '今年稍早', '很久以前'];       // wording of the zh-TW date groups is from memory (notes)
    var SIZE_GROUPS = ['空白 (0 KB)', '極小 (0 - 10 KB)', '小 (10 - 100 KB)', '中 (100 KB - 1 MB)', '大 (1 - 16 MB)', '特大 (16 - 128 MB)', '巨大 (大於 128 MB)'];
    function dayNum(d) { return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000); }
    function groupOf(st) {
      if (S.group === 'name') {
        var c = labelOf(st).charAt(0).toUpperCase();
        if (/[A-Z]/.test(c)) return { key: c, rank: c.charCodeAt(0) - 60 };
        if (/[0-9]/.test(c)) return { key: '0 - 9', rank: 1 };
        return { key: '其他', rank: 1000 };
      }
      if (S.group === 'date') {
        var now = LAB.clock.now(), d = new Date(st.mtime), dn = dayNum(d), tn = dayNum(now), i;
        var weekStart = tn - now.getDay();                         // weeks start on Sunday (zh-TW)
        if (dn >= tn) i = 0;
        else if (dn === tn - 1) i = 1;
        else if (dn >= weekStart) i = 2;
        else if (dn >= weekStart - 7) i = 3;
        else if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) i = 4;
        else if ((d.getFullYear() * 12 + d.getMonth()) === (now.getFullYear() * 12 + now.getMonth() - 1)) i = 5;
        else if (d.getFullYear() === now.getFullYear()) i = 6;
        else i = 7;
        return { key: DATE_GROUPS[i], rank: i };
      }
      if (S.group === 'size') {
        var b = st.type === 'dir' ? 0 : st.size, j;
        j = b === 0 ? 0 : b <= 10 * 1024 ? 1 : b <= 100 * 1024 ? 2 : b <= 1024 * 1024 ? 3 : b <= 16 * 1024 * 1024 ? 4 : b <= 128 * 1024 * 1024 ? 5 : 6;
        return { key: SIZE_GROUPS[j], rank: j };
      }
      var kd = kindLabel(st);                                      // 類型
      return { key: kd, rank: 0 };
    }
    function grouping() { return !!S.group && S.mode !== 'plist' && !inTrashView() && shape() === 'dir'; }
    function sortList(list, folderFirst) {
      var k = S.sort.key, d = S.sort.dir, gp = grouping();
      list.sort(function (a, b) {
        if (gp) {
          var ga = groupOf(a), gb = groupOf(b);
          if (ga.rank !== gb.rank) return ga.rank - gb.rank;
          if (ga.key !== gb.key) return cmpStr(ga.key, gb.key);
        }
        if (folderFirst && a.type !== b.type) return a.type === 'dir' ? -1 : 1;
        var r = 0;
        if (k === 'date' || k === 'atime') r = a.mtime - b.mtime;
        else if (k === 'ctime') r = (a.ctime || a.mtime) - (b.ctime || b.mtime);
        else if (k === 'attr') r = cmpStr(attrText(a), attrText(b));
        else if (k === 'ext') r = cmpStr(extOf(a), extOf(b));
        else if (k === 'csize') r = (a.csize || 0) - (b.csize || 0);
        else if (k === 'ratio') r = ratioOf(a) - ratioOf(b);
        else if (k === 'size') r = (a.type === 'dir' ? -1 : a.size) - (b.type === 'dir' ? -1 : b.size);
        else if (k === 'kind') r = cmpStr(kindLabel(a), kindLabel(b));
        else if (k === 'where') r = cmpStr(LAB.vfs.dirname(a.path), LAB.vfs.dirname(b.path));
        else if (k === 'orig') r = cmpStr(origDir(a), origDir(b));
        else if (k === 'deleted') r = delTime(a) - delTime(b);
        else r = cmpStr(labelOf(a), labelOf(b));
        r = r * d;
        if (r === 0) r = cmpStr(labelOf(a), labelOf(b));
        if (r === 0) r = a.path < b.path ? -1 : a.path > b.path ? 1 : 0;
        return r;
      });
      return list;
    }
    function origDir(st) {
      var o = LAB.vfs.trashOrigin ? LAB.vfs.trashOrigin(st.path) : '';
      return o ? toWin(LAB.vfs.dirname(o)) : '';
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
      if (inZip()) {
        var zl = zipLocOf(S.path), info = zl ? zipInfo(zl.zip) : null;
        if (!info) return rows;
        var zs = S.filter ? zipAll(info, zl.inner).filter(matchesFilter) : zipChildren(info, zl.inner);
        sortList(zs, true).forEach(function (st) { rows.push({ st: st }); });
        return rows;
      }
      if (inTrashView()) {
        var tl = dirEntries(TRASH);
        if (S.filter) tl = tl.filter(matchesFilter);
        sortList(tl, false).forEach(function (st) { rows.push({ st: st }); });
        return rows;
      }
      if (S.filter) {
        // like the real search: matches anywhere below this folder, shown as one flat list (the 資源回收筒 is not searched)
        var found = [];
        (function walk(dir, depth) {
          dirEntries(dir).forEach(function (st) {
            if (found.length >= 300 || isTrashDir(st.path)) return;
            if (matchesFilter(st)) found.push(st);
            if (st.type === 'dir' && depth < 8) walk(st.path, depth + 1);
          });
        })(searchBase(), 0);
        sortList(found, true).forEach(function (st) { rows.push({ st: st }); });
        return rows;
      }
      sortList(dirEntries(S.path), true).forEach(function (st) { rows.push({ st: st }); });
      return rows;
    }

    /* ---------- container (details list / large icons / 首頁 / 本機) ---------- */
    function disposeItem(rec) { rec.offs.forEach(function (f) { try { f(); } catch (e) { /* ignore */ } }); rec.offs = []; }
    function clearItems() {
      items.forEach(function (rec) { disposeItem(rec); if (rec.el.parentNode) rec.el.parentNode.removeChild(rec.el); });
      items.clear();
    }
    function viewKey() {
      var sh = shape();
      if (sh === 'home' || sh === 'pc') return sh;
      return modeKind() === 'details' ? 'list:' + colsKey() : 'g-' + S.mode;
    }
    function isGridKey() { return hostKey.indexOf('g-') === 0; }
    function gridTemplate(cols) { return cols.map(function (c) { return c.w; }).join(' '); }
    function colsMin(cols) { var t = 8; cols.forEach(function (c) { var m = /(\d+)px/.exec(c.w); t += m ? +m[1] : 100; }); return t; }
    /* the widths changed (a drag on a header border): every row follows */
    function applyCols() {
      if (!headEl || !host || host.dataset.mode !== 'list') return;
      var cols = curCols(), t = gridTemplate(cols);
      headEl.style.setProperty('--fd-cols', t);
      host.style.setProperty('--fd-cols', t);
      items.forEach(function (rec) { if (rec.variant === 'row') rec.el.style.setProperty('--fd-cols', t); });
      if (wrapEl) wrapEl.style.minWidth = colsMin(cols) + 'px';
    }
    function wireResize(rz, cell, key) {
      rz.addEventListener('click', function (e) { e.stopPropagation(); });
      rz.addEventListener('dblclick', function (e) { e.stopPropagation(); delete S.colW[key]; applyCols(); });      // double-click: back to the default width
      rz.addEventListener('pointerdown', function (e) {
        if (e.button !== 0) return;
        e.preventDefault(); e.stopPropagation();
        var sc = LAB.stage.scale || 1, x0 = tx(e).x, w0 = cell.getBoundingClientRect().width / sc, pid = e.pointerId;
        function move(ev) {
          if (ev.pointerId !== pid) return;
          S.colW[key] = Math.max(44, Math.round(w0 + tx(ev).x - x0));
          applyCols();
        }
        function up(ev) {
          if (ev.pointerId !== pid) return;
          window.removeEventListener('pointermove', move, true);
          window.removeEventListener('pointerup', up, true);
          window.removeEventListener('pointercancel', up, true);
        }
        window.addEventListener('pointermove', move, true);
        window.addEventListener('pointerup', up, true);
        window.addEventListener('pointercancel', up, true);
      });
    }
    function buildHead(cols, sortable) {
      var hd = h('div', { class: 'fd-listhead', role: 'row' });
      hd.style.setProperty('--fd-cols', gridTemplate(cols));
      cols.forEach(function (c) {
        var cell = h(sortable ? 'button' : 'div', { class: 'fd-hc fd-h-' + c.k + (c.r ? ' is-r' : ''), dataset: { col: c.k, lab: 'fd-col' } },
          h('span', { class: 'fd-hc-t' }, c.t), h('span', { class: 'fd-hc-s', 'aria-hidden': 'true' }));
        if (sortable) {
          cell.type = 'button';
          cell.addEventListener('click', function () { sortBy(c.k); });
          var rz = h('span', { class: 'fd-hc-rz', 'aria-hidden': 'true', dataset: { lab: 'fd-col-resize', col: c.k } });
          wireResize(rz, cell, c.k);
          cell.appendChild(rz);
        }
        hd.appendChild(cell);
      });
      if (sortable) hd.addEventListener('contextmenu', function (e) {
        e.preventDefault(); e.stopPropagation();
        var p = tx(e);
        LAB.menu.contextMenu(p.x, p.y, columnItems());
      });
      return hd;
    }
    function ensureContainer() {
      var key = viewKey();
      if (host && hostKey === key) return;
      clearItems();
      scrollEl.textContent = '';
      host = wrapEl = headEl = emptyEl = null;
      hostKey = key;
      if (key === 'home' || key === 'pc') {
        wrapEl = h('div', { class: 'fd-view fd-' + key });
        host = wrapEl;
      } else if (key.indexOf('g-') === 0) {
        host = h('div', { class: 'fd-grid', dataset: { mode: S.mode, kind: modeKind() } });
        emptyEl = h('div', { class: 'fd-empty', hidden: true });
        wrapEl = h('div', { class: 'fd-view' }, host, emptyEl);
      } else {
        var cols = curCols();
        headEl = buildHead(cols, true);
        host = h('div', { class: 'fd-rows', dataset: { mode: 'list' } });
        host.style.setProperty('--fd-cols', gridTemplate(cols));
        emptyEl = h('div', { class: 'fd-empty', hidden: true });
        wrapEl = h('div', { class: 'fd-view fd-list' }, headEl, host, emptyEl);
        wrapEl.style.minWidth = colsMin(cols) + 'px';
      }
      scrollEl.appendChild(wrapEl);
      S.rendered = false;
    }
    function updateHead() {
      if (!headEl || host.dataset.mode !== 'list') return;
      var cells = headEl.children;
      for (var i = 0; i < cells.length; i++) {
        var c = cells[i], on = c.dataset.col === S.sort.key;
        c.classList.toggle('is-sorted', on);
        c.setAttribute('aria-sort', on ? (S.sort.dir > 0 ? 'ascending' : 'descending') : 'none');
        c.querySelector('.fd-hc-s').innerHTML = on ? gl(S.sort.dir > 0 ? 'fd-i-chev-d' : 'fd-i-chev-d', 10) : '';
        c.classList.toggle('is-desc', on && S.sort.dir < 0);
      }
    }
    function sortBy(key, dir) {
      if (dir) S.sort = { key: key, dir: dir };
      else if (S.sort.key === key) S.sort = { key: key, dir: -S.sort.dir };
      else S.sort = { key: key, dir: key === 'date' || key === 'deleted' || key === 'ctime' || key === 'atime' ? -1 : 1 };
      S.sortTouched = true;
      render();
      updateCmdState();
    }
    /* show / hide a details column (the name always stays); the rows are rebuilt because their cells change */
    function setColumns(list) {
      S.colsSel = COL_ORDER.filter(function (k) { return k === 'name' || list.indexOf(k) >= 0; });
      hostKey = '';
      render();
      updateChrome();
    }
    function toggleColumn(key) {
      var cur = S.colsSel.slice(), i = cur.indexOf(key);
      if (i >= 0) cur.splice(i, 1); else cur.push(key);
      setColumns(cur);
    }
    /* right-click on a column header */
    function columnItems() {
      var editable = colsKey() === 'dir' || colsKey() === 'search';
      var out = [];
      if (editable) {
        COL_ORDER.slice(0, 6).forEach(function (k) {
          out.push({ label: COLCAT[k].t, checked: S.colsSel.indexOf(k) >= 0, enabled: k !== 'name', action: function () { toggleColumn(k); } });
        });
        out.push({ separator: true });
        out.push({ label: '其他…', action: function () { chooseColumns(); } });
        out.push({ separator: true });
      }
      out.push({ label: '調整所有資料行的大小以適合', action: function () { S.colW = {}; applyCols(); } });
      return out;
    }
    /* 選擇詳細資料: every column of the list, with a check box */
    function chooseColumns() {
      var boxes = {};
      var m = openModal(win, {
        cls: 'fd-colsdlg', label: '選擇詳細資料', cancelValue: null,
        onEnter: function () { done(); },
        build: function (panel, api) {
          var list = h('div', { class: 'fd-cols-list', dataset: { lab: 'fd-cols-list' } });
          COL_ORDER.forEach(function (k) {
            var cb = h('input', { type: 'checkbox', dataset: { lab: 'fd-cols-box', col: k } });
            cb.checked = S.colsSel.indexOf(k) >= 0;
            if (k === 'name') cb.disabled = true;
            boxes[k] = cb;
            list.appendChild(h('label', { class: 'fd-cols-row' }, cb, h('span', null, COLCAT[k].t)));
          });
          panel.appendChild(h('div', { class: 'fd-wiz-bar' }, h('span', { class: 'fd-wiz-title' }, '選擇詳細資料')));
          panel.appendChild(h('div', { class: 'fd-pick-body' }, h('div', { class: 'fd-pick-hint' }, '選取要顯示在這個資料夾詳細資料檢視中的項目。'), list));
          panel.appendChild(h('div', { class: 'fd-dbtns' },
            dbtn('確定', 'is-default', 'fd-cols-ok', function () { done(); }),
            dbtn('取消', '', 'fd-cols-cancel', function () { api.close(null); })));
        }
      });
      function done() {
        var list = COL_ORDER.filter(function (k) { return boxes[k] && boxes[k].checked; });
        m.close(list);
        setColumns(list);
      }
    }

    /* ---------- items ---------- */
    function itemAccept(rec, pl, mods) { return acceptInto(pl, rec.st.path, mods); }

    function iconNameFor(st, variant) {
      return variant === 'tile' ? pinGlyph(st.path) : variant === 'drive' ? 'fd-n-drive' : LAB.icons.forNode(st);
    }
    function icoPx(variant) {
      if (variant === 'icon') return (MODES[S.mode] || MODES.icon).ico;
      return variant === 'ttile' ? 48 : variant === 'crow' ? 32 : variant === 'tile' ? 36 : variant === 'drive' ? 44 : 16;
    }
    var THUMB_VARIANTS = { icon: 1, ttile: 1, crow: 1, row: 1, small: 1 };
    /* the icon of an item: a thumbnail for a picture (also a tiny one in the details list, like Windows), else our SVG for the file type */
    function fillIcon(rec, st) {
      var variant = rec.variant;
      var thumb = THUMB_VARIANTS[variant] === 1 && isImage(st) && !st.zipEntry;
      var key = thumb ? 'img|' + st.path + '|' + st.mtime + '|' + st.size : iconNameFor(st, variant);
      if (rec.icon === key) return;
      rec.icon = key;
      rec.icoEl.textContent = '';
      var px = icoPx(variant);
      if (thumb) { rec.icoEl.appendChild(thumbEl(st, px)); rec.icoEl.classList.add('has-th'); }
      else { rec.icoEl.innerHTML = LAB.icons.get(key, { size: px }); rec.icoEl.classList.remove('has-th'); }
    }
    /* the second line of a 快速存取 tile: where the pinned folder lives */
    function tileSub(st) { return LAB.vfs.same(LAB.vfs.dirname(st.path), HOME) ? '本機' : dname(LAB.vfs.dirname(st.path)); }

    /* variant: 'row' (details list, 最近), 'icon' (超大 / 大 / 中圖示), 'small' (小圖示, 清單), 'ttile' (並排), 'crow' (內容), 'tile' (快速存取), 'drive' (本機磁碟) */
    function makeItem(st, variant, colsKey2) {
      var el = h('div', { class: 'fd-item ' + (variant === 'row' ? 'fd-row' : 'fd-' + variant), role: 'option', 'aria-selected': 'false', dataset: { lab: 'fd-item', path: st.path } });
      var rec = { el: el, st: st, icon: '', offs: [], nameEl: null, variant: variant, cells: {}, cols: null, subs: [] };
      if (variant === 'icon') {
        var ico = h('div', { class: 'fd-ico', 'aria-hidden': 'true' });
        var nm = h('div', { class: 'fd-name' }, h('span', { class: 'fd-name-t' }));
        el.appendChild(ico); el.appendChild(nm);
        rec.icoEl = ico; rec.nameEl = nm.firstChild; rec.nameBox = nm;
      } else if (variant === 'small') {
        var sico = h('span', { class: 'fd-sico', 'aria-hidden': 'true' });
        var sn = h('span', { class: 'fd-name-t' });
        el.appendChild(sico); el.appendChild(sn);
        rec.icoEl = sico; rec.nameEl = sn; rec.nameBox = el;
      } else if (variant === 'ttile') {
        var xico = h('div', { class: 'fd-xico', 'aria-hidden': 'true' });
        var xn = h('span', { class: 'fd-name-t' }), x1 = h('span', { class: 'fd-xsub' }), x2 = h('span', { class: 'fd-xsub' });
        var xbox = h('div', { class: 'fd-xbox' }, xn, x1, x2);
        el.appendChild(xico); el.appendChild(xbox);
        rec.icoEl = xico; rec.nameEl = xn; rec.nameBox = xbox; rec.subs = [x1, x2];
      } else if (variant === 'crow') {
        var cico = h('div', { class: 'fd-cico', 'aria-hidden': 'true' });
        var cn = h('span', { class: 'fd-name-t' }), cs = h('span', { class: 'fd-csub' });
        var cbox = h('div', { class: 'fd-cbox' }, cn, cs);
        el.appendChild(cico); el.appendChild(cbox);
        rec.icoEl = cico; rec.nameEl = cn; rec.nameBox = cbox; rec.subs = [cs];
      } else if (variant === 'tile') {
        var tico = h('div', { class: 'fd-tico', 'aria-hidden': 'true' });
        var tn = h('span', { class: 'fd-name-t' });
        var ts = h('span', { class: 'fd-tsub' }, h('span', { class: 'fd-tsub-pin', 'aria-hidden': 'true' }), h('span', null, tileSub(st)));
        ts.firstChild.innerHTML = gl('fd-n-pin', 11);
        var tbox = h('div', { class: 'fd-tbox' }, tn, ts);
        el.appendChild(tico); el.appendChild(tbox);
        rec.icoEl = tico; rec.nameEl = tn; rec.nameBox = tbox; rec.subs = [ts.lastChild];
      } else if (variant === 'drive') {
        var dico = h('div', { class: 'fd-dico', 'aria-hidden': 'true' });
        var dn = h('span', { class: 'fd-name-t' });
        var bar = h('div', { class: 'fd-dbar', 'aria-hidden': 'true' }, h('i'));
        var dsub = h('span', { class: 'fd-dsub' }, '198 GB 可用，共 237 GB');
        bar.firstChild.style.width = '16.5%';
        var dbox = h('div', { class: 'fd-dbox' }, dn, bar, dsub);
        el.appendChild(dico); el.appendChild(dbox);
        rec.icoEl = dico; rec.nameEl = dn; rec.nameBox = dbox;
      } else {
        var cols = curCols(colsKey2);
        rec.cols = cols;
        el.style.setProperty('--fd-cols', gridTemplate(cols));
        var rico = h('span', { class: 'fd-rico', 'aria-hidden': 'true' });
        var nt = h('span', { class: 'fd-name-t' });
        cols.forEach(function (c) {
          if (c.k === 'name') {
            var c0 = h('div', { class: 'fd-c fd-c-name' }, rico, nt);
            el.appendChild(c0);
            rec.nameBox = c0;
          } else {
            var cell = h('div', { class: 'fd-c fd-c-' + c.k + (c.r ? ' is-r' : '') });
            el.appendChild(cell);
            rec.cells[c.k] = cell;
          }
        });
        rec.icoEl = rico; rec.nameEl = nt;
      }
      fillIcon(rec, st);

      rec.offs.push(LAB.dnd.source(el, function () {
        if (rec.st.zipEntry) return null;                 // an entry of a zip cannot be dragged out (a zip is read-only here)
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
          setSel([rec.st.path], { force: S.silentSel });
        }
      }));
      el.addEventListener('dblclick', function (e) {
        e.stopPropagation();
        if (S.renaming) return;
        openItem(rec.st.path);
      });
      if (st.type === 'dir' && !st.zipEntry && !underTrash(st.path)) {
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

    function setText(el, t) { if (el.textContent !== t) el.textContent = t; }
    function cellText(key, st) {
      switch (key) {
        case 'date': return fmtDate(st.mtime);
        case 'ctime': return fmtDate(st.ctime || st.mtime);
        case 'atime': return fmtDate(st.mtime);
        case 'kind': return kindLabel(st);
        case 'size': return st.type === 'dir' ? '' : kbCell(st.size);
        case 'csize': return st.type === 'dir' ? '' : kbCell(st.csize);
        case 'pwd': return st.type === 'dir' ? '' : '否';
        case 'ratio': return st.type === 'dir' || !st.size ? '' : Math.round(ratioOf(st) * 100) + '%';
        case 'attr': return attrText(st);
        case 'ext': return extOf(st);
        case 'where': return toWin(LAB.vfs.dirname(st.path));
        case 'orig': return origDir(st);
        case 'deleted': return fmtDate(delTime(st));
        default: return '';
      }
    }
    function updateItem(rec, st) {
      var variant = rec.variant;
      rec.st = st;
      fillIcon(rec, st);
      if (S.renaming !== st.path) {
        var label = variant === 'icon' ? shortName(labelOf(st)) : labelOf(st);
        setText(rec.nameEl, label);
      }
      rec.el.setAttribute('aria-label', labelOf(st));
      rec.el.classList.toggle('is-dim', !!st.hidden);
      if (variant === 'row') {
        Object.keys(rec.cells).forEach(function (k) {
          setText(rec.cells[k], cellText(k, st));
          if (k === 'where' || k === 'orig') rec.cells[k].title = rec.cells[k].textContent;        // the whole path as a tooltip, like Explorer
        });
      } else if (variant === 'ttile') {
        setText(rec.subs[0], kindLabel(st));
        setText(rec.subs[1], st.type === 'dir' ? '' : exactSize(st.size));
      } else if (variant === 'crow') {
        setText(rec.subs[0], kindLabel(st) + '　修改日期: ' + fmtDate(st.mtime) + (st.type === 'dir' ? '' : '　大小: ' + kbCell(st.size)));
      } else if (variant === 'tile') {
        setText(rec.subs[0], tileSub(st));
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
      if (!validLoc(S.path)) {
        var q = S.path;
        while (q !== '/' && !validLoc(q)) q = LAB.vfs.dirname(q);
        navigate(q, 'up');
        return;
      }
      ensureContainer();
      var sh = shape();
      if (sh === 'home') renderHome();
      else if (sh === 'pc') renderPc();
      else renderFolder();
      var keepSel = Array.from(S.sel).filter(function (p) { return items.has(p); });
      if (S.pendingSel) {
        var ps = S.pendingSel.filter(function (p) { return items.has(p); });
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
      markCut();
      updateHead();
      layoutGrid();
      updateStatus();
      updateDynamicChrome();
      S.rendered = true;
    }
    /* 清單 flows down a column first: the number of rows follows the height of the area */
    function layoutGrid() {
      if (!host || S.mode !== 'plist' || !isGridKey()) return;
      var rows = Math.max(1, Math.floor(((scrollEl.clientHeight || 300) - 16) / 24));
      if (host.style.getPropertyValue('--rows') !== String(rows)) host.style.setProperty('--rows', String(rows));
    }
    function renderFolder() {
      var rows = buildRows();
      S.order = rows.map(function (r) { return r.st.path; });
      S.topCount = rows.length;
      var seen = new Set(S.order);
      Array.from(items.keys()).forEach(function (p) {
        var rec = items.get(p);
        var keep = seen.has(p) || (S.renaming === p && LAB.vfs.exists(p));
        var typeChanged = seen.has(p) && rec.st.type !== (rows[S.order.indexOf(p)].st.type);
        if (!keep || typeChanged) removeItem(p);
      });
      var mk = modeKind();
      var variant = mk === 'grid' ? 'icon' : mk === 'small' ? 'small' : mk === 'tiles' ? 'ttile' : mk === 'content' ? 'crow' : 'row';
      // 群組依據: group headers sit between the items (they are rebuilt every time; the items are reconciled by path as before)
      Array.prototype.slice.call(host.children).forEach(function (el) { if (el.classList.contains('fd-grp')) host.removeChild(el); });
      var gOn = grouping(), counts = {}, lastG = null, pos = 0;
      if (gOn) rows.forEach(function (r) { r.g = groupOf(r.st); counts[r.g.key] = (counts[r.g.key] || 0) + 1; });
      rows.forEach(function (r) {
        var st = r.st;
        var rec = items.get(st.path);
        if (!rec) {
          rec = makeItem(st, variant, colsKey());
          items.set(st.path, rec);
          if (S.rendered) rec.el.classList.add('is-new');
        }
        updateItem(rec, st);
        if (gOn && r.g.key !== lastG) {
          lastG = r.g.key;
          host.insertBefore(h('div', { class: 'fd-grp', role: 'presentation', dataset: { lab: 'fd-group', group: r.g.key } },
            h('span', { class: 'fd-grp-t' }, r.g.key + ' (' + counts[r.g.key] + ')'), h('span', { class: 'fd-grp-l', 'aria-hidden': 'true' })), host.children[pos] || null);
          pos++;
        }
        var at = host.children[pos];
        if (at !== rec.el) host.insertBefore(rec.el, at || null);
        pos++;
      });
      if (emptyEl) {
        emptyEl.hidden = rows.length > 0;
        emptyEl.textContent = S.filter ? '沒有符合搜尋條件的項目。' : (inZip() ? '這個壓縮的 (zipped) 資料夾是空的。' : '這個資料夾是空的。');
      }
    }
    function section(key, title, count, body) {
      var folded = !!S.homeFold[key];
      var chev = h('span', { class: 'fd-sec-chev', 'aria-hidden': 'true' });
      chev.innerHTML = gl('fd-i-chev-d', 12);
      var hd = h('button', { type: 'button', class: 'fd-sec-h' + (folded ? ' is-folded' : ''), 'aria-expanded': folded ? 'false' : 'true', dataset: { lab: 'fd-section', section: key } }, chev, h('span', null, title + (count !== null ? ' (' + count + ')' : '')));
      hd.addEventListener('click', function () { S.homeFold[key] = !S.homeFold[key]; render(); });
      body.hidden = folded;
      return h('section', { class: 'fd-sec' }, hd, body);
    }
    /* 首頁: 快速存取 (six folders as tiles) and 最近 (a short list) */
    function renderHome() {
      clearItems();
      wrapEl.textContent = '';
      var quick = [];
      pinList().forEach(function (p) { var s = stat(p); if (s && s.type === 'dir') quick.push(s); });
      var recent = recentsList();
      var tiles = h('div', { class: 'fd-tiles' });
      quick.forEach(function (st) {
        var rec = makeItem(st, 'tile');
        items.set(st.path, rec); updateItem(rec, st);
        tiles.appendChild(rec.el);
      });
      wrapEl.appendChild(section('quick', '快速存取', null, tiles));
      var list = h('div', { class: 'fd-list fd-recent' });
      var hd = buildHead(COLDEFS.recent, false);
      var rows = h('div', { class: 'fd-rows' });
      rows.style.setProperty('--fd-cols', gridTemplate(COLDEFS.recent));
      recent.forEach(function (st) {
        var rec = makeItem(st, 'row', 'recent');
        items.set(st.path, rec); updateItem(rec, st);
        rows.appendChild(rec.el);
      });
      list.appendChild(hd); list.appendChild(rows);
      if (!recent.length) list.appendChild(h('div', { class: 'fd-empty is-inline' }, '最近沒有開啟過任何檔案。'));
      wrapEl.appendChild(section('recent', '最近', null, list));
      S.order = quick.map(function (s) { return s.path; }).concat(recent.map(function (s) { return s.path; }));
      S.topCount = S.order.length;
    }
    function renderPc() {
      clearItems();
      wrapEl.textContent = '';
      var st = stat('/');
      var tiles = h('div', { class: 'fd-drives' });
      if (st) {
        var rec = makeItem(st, 'drive');
        items.set(st.path, rec); updateItem(rec, st);
        tiles.appendChild(rec.el);
      }
      wrapEl.appendChild(section('drives', '裝置和磁碟機', 1, tiles));
      S.order = st ? [st.path] : [];
      S.topCount = S.order.length;
    }

    function ensureVisible(el) {
      var sc = LAB.stage.scale || 1;
      var r = el.getBoundingClientRect(), s = scrollEl.getBoundingClientRect();
      var headH = headEl ? headEl.offsetHeight * sc : 0;
      if (r.top < s.top + headH) scrollEl.scrollTop -= (s.top + headH - r.top) / sc + 2;
      else if (r.bottom > s.bottom) scrollEl.scrollTop += (r.bottom - s.bottom) / sc + 2;
    }

    /* ---------- chrome ---------- */
    var pathTargets = [];
    function addrIconName() {
      var k = kindOfPath(S.path);
      return k === 'dir' ? 'folder' : tabIconName(S.path);
    }
    function segsFor(path) {
      var k = kindOfPath(path);
      if (k === 'home') return [{ path: V_HOME, label: dname(V_HOME) }];
      if (k === 'pc') return [{ path: V_PC, label: dname(V_PC) }];
      if (k === 'trash') return [{ path: V_TRASH, label: dname(V_TRASH) }];
      var segs = [{ path: V_PC, label: dname(V_PC) }, { path: '/', label: dname('/') }];
      if (path === '/') return segs;
      var parts = path.split('/').filter(Boolean), cur = '';
      parts.forEach(function (pt) { cur += '/' + pt; segs.push({ path: cur, label: dname(cur) }); });
      return segs;
    }
    var crumbSegs = [], crumbEll = null;
    function buildCrumbs() {
      pathTargets.forEach(function (f) { f(); });
      pathTargets = [];
      crumbsEl.textContent = '';
      crumbSegs = [];
      var lead = h('span', { class: 'fd-crumb-ico', 'aria-hidden': 'true' });
      if (S.filter) {
        // while a search runs the address bar says where it looks, like Explorer does
        lead.innerHTML = gl('fd-i-search', 15);
        crumbsEl.appendChild(lead);
        crumbsEl.appendChild(h('span', { class: 'fd-crumb-search', dataset: { lab: 'fd-pathbar-search' } }, '搜尋結果 在 ' + dname(searchBase())));
        crumbEll = null;
        return;
      }
      lead.innerHTML = gl(addrIconName(), 16);
      crumbsEl.appendChild(lead);
      crumbEll = h('button', { type: 'button', class: 'fd-ps fd-ell', hidden: true, 'aria-label': '顯示前面的路徑', title: '顯示前面的路徑', dataset: { lab: 'fd-pathbar-more' } }, '…');
      crumbEll.addEventListener('click', function (e) {
        e.stopPropagation();
        var hid = crumbSegs.filter(function (c) { return c.btn.hidden; });
        var p = below(crumbEll);
        LAB.menu.contextMenu(p.x, p.y, hid.map(function (c) { return { label: c.seg.label, action: function () { navigate(c.seg.path, 'pathbar'); } }; }));
      });
      crumbsEl.appendChild(crumbEll);
      var segs = segsFor(S.path);
      segs.forEach(function (sg, i) {
        var chev = h('span', { class: 'fd-psep', 'aria-hidden': 'true' });
        chev.innerHTML = gl('fd-i-chev-r', 10);
        crumbsEl.appendChild(chev);
        var b = h('button', { type: 'button', class: 'fd-ps' + (i === segs.length - 1 ? ' is-last' : ''), dataset: { lab: 'fd-pathbar-seg', path: sg.path } }, h('span', null, sg.label));
        b.addEventListener('click', function (e) { e.stopPropagation(); navigate(sg.path, 'pathbar'); });
        crumbsEl.appendChild(b);
        crumbSegs.push({ chev: chev, btn: b, seg: sg });
        if (!isVirt(sg.path)) {
          pathTargets.push(LAB.dnd.target(b, {
            id: 'finder:' + win.id + ':pathbar:' + sg.path,
            accept: function (pl, mods) { return acceptInto(pl, sg.path, mods); },
            enter: function () { b.classList.add('is-drop'); },
            leave: function () { b.classList.remove('is-drop'); },
            drop: function (pl, ctx) { b.classList.remove('is-drop'); transferInto(pl.paths, sg.path, ctx.mode === 'copy' ? 'copy' : 'move'); }
          }));
        }
      });
      layoutCrumbs();
    }
    /* a path that is too long for the bar folds its first folders into a 「…」 button (a menu), like the real address bar */
    function layoutCrumbs() {
      if (!crumbSegs.length || !crumbEll) return;
      crumbSegs.forEach(function (c) { c.chev.hidden = false; c.btn.hidden = false; });
      crumbEll.hidden = true;
      var n = 0;
      while (crumbsEl.scrollWidth > crumbsEl.clientWidth + 1 && n < crumbSegs.length - 1) {
        crumbSegs[n].chev.hidden = true; crumbSegs[n].btn.hidden = true; crumbEll.hidden = false; n++;
      }
    }
    function updateDynamicChrome() {
      var name = dname(S.path);
      var title = name + ' - 檔案總管';
      if (win && win.getTitle() !== title) win.setTitle(title);
      if (win) win.state.path = S.path;
      var ph = '搜尋 ' + name;
      if (searchIn.placeholder !== ph) searchIn.placeholder = ph;
      renderTabs();
    }
    function updateChrome() {
      buildCrumbs();
      backBtn.disabled = S.hi <= 0;
      fwdBtn.disabled = S.hi >= S.hist.length - 1;
      upBtn.disabled = !canGoUp();
      buildNav(false);
      buildCmd();
      var k = kindOfPath(S.path);
      var showToggle = shape() === 'dir' || k === 'trash';
      viewTog.hidden = !showToggle;
      viewListBtn.classList.toggle('is-on', S.mode === 'list');
      viewIconBtn.classList.toggle('is-on', S.mode === 'icon');
      viewListBtn.setAttribute('aria-pressed', S.mode === 'list' ? 'true' : 'false');
      viewIconBtn.setAttribute('aria-pressed', S.mode === 'icon' ? 'true' : 'false');
      root.classList.toggle('no-nav', !S.showNav);
      updateDynamicChrome();
      updateCmdState();
      updatePane();
    }
    function updateStatus() {
      statusTxt.textContent = '';
      var total = S.topCount, n = S.sel.size;
      statusTxt.appendChild(h('span', null, total + ' 個項目'));
      if (n) {
        statusTxt.appendChild(h('span', { class: 'fd-status-sep', 'aria-hidden': 'true' }));
        statusTxt.appendChild(h('span', null, '已選取 ' + n + ' 個項目'));
        var bytes = 0, allFiles = true;
        S.sel.forEach(function (p) { var s = stat(p); if (!s) return; if (s.type === 'dir') allFiles = false; else bytes += s.size; });
        if (allFiles && !inTrashView()) statusTxt.appendChild(h('span', { class: 'fd-status-size' }, exactSize(bytes)));
      }
      updatePane();
    }

    /* ---------- 預覽窗格 (Alt+P) and 詳細資料窗格 (Alt+Shift+P): one slot at the right, the same selection ---------- */
    var paneSig = '';
    function paneSel() {
      var s = orderedSel();
      return s.length === 1 ? stat(s[0]) : null;
    }
    function textPreview(st) {
      var txt = '';
      if (st.zipEntry) {
        var zl = zipLocOf(st.path), z = zl ? LAB.vfs.zipEntries && LAB.vfs.zipEntries(zl.zip) : null;
        (z || []).forEach(function (en) { if (en.name === zl.inner) txt = en.content || ''; });
      } else { try { txt = LAB.vfs.readFile(st.path); } catch (e) { txt = ''; } }
      return String(txt).split('\n').slice(0, 40).join('\n').slice(0, 2400);
    }
    function isTextLike(st) { return st.type === 'file' && /^\.(md|txt|csv|json|log)$/i.test(LAB.vfs.extname(st.name)); }
    function paneRow(k, v) { return h('div', { class: 'fd-pane-r' }, h('div', { class: 'fd-pane-k' }, k), h('div', { class: 'fd-pane-v' }, v)); }
    function updatePane() {
      var which = S.pane;
      paneEl.hidden = !which;
      root.classList.toggle('has-pane', !!which);
      if (!which) { paneSig = ''; paneEl.textContent = ''; return; }
      var st = paneSel(), multi = S.sel.size > 1;
      var sig = which + '|' + (st ? st.path + '|' + st.mtime + '|' + st.size : multi ? 'multi' + S.sel.size : 'none:' + S.path + ':' + S.topCount) + '|' + S.filter;
      if (sig === paneSig) return;
      paneSig = sig;
      paneEl.dataset.pane = which;
      paneEl.textContent = '';
      if (which === 'preview') {
        var box = h('div', { class: 'fd-pv', dataset: { lab: 'fd-preview' } });
        if (!st) box.appendChild(h('div', { class: 'fd-pv-empty' }, multi ? '無法預覽多個項目。' : '選取要預覽的檔案。'));
        else if (isImage(st) && !st.zipEntry) { box.classList.add('is-img'); box.appendChild(h('img', { class: 'fd-pv-img', alt: '', draggable: 'false', src: imageSrc(st) })); }
        else if (isTextLike(st)) { box.classList.add('is-text'); box.appendChild(h('pre', { class: 'fd-pv-txt' }, textPreview(st))); }
        else box.appendChild(h('div', { class: 'fd-pv-empty' }, '沒有可用的預覽。'));
        paneEl.appendChild(box);
        return;
      }
      var dbox = h('div', { class: 'fd-dp', dataset: { lab: 'fd-details-pane' } });
      if (multi) { dbox.appendChild(h('div', { class: 'fd-dp-name' }, '已選取 ' + S.sel.size + ' 個項目')); paneEl.appendChild(dbox); return; }
      var shown = st, big = h('div', { class: 'fd-dp-ico', 'aria-hidden': 'true' });
      if (!shown) {                                  // nothing selected: the folder itself
        var cur = isVirt(S.path) ? null : stat(S.path);
        big.innerHTML = LAB.icons.get(cur ? iconNameFor(cur, 'row') : tabIconName(S.path), { size: 64 });
        dbox.appendChild(big);
        dbox.appendChild(h('div', { class: 'fd-dp-name' }, dname(S.path)));
        dbox.appendChild(h('div', { class: 'fd-dp-type' }, cur ? kindLabel(cur) : ''));
        dbox.appendChild(h('div', { class: 'fd-dp-hr' }));
        dbox.appendChild(paneRow('項目', S.topCount + ' 個項目'));
      } else {
        if (isImage(shown) && !shown.zipEntry) { big.classList.add('is-th'); big.appendChild(thumbEl(shown, 150)); }
        else big.innerHTML = LAB.icons.get(iconNameFor(shown, 'row'), { size: 64 });
        dbox.appendChild(big);
        dbox.appendChild(h('div', { class: 'fd-dp-name' }, shown.name));
        dbox.appendChild(h('div', { class: 'fd-dp-type' }, kindLabel(shown)));
        dbox.appendChild(h('div', { class: 'fd-dp-hr' }));
        dbox.appendChild(paneRow('修改日期', fmtDate(shown.mtime)));
        if (shown.type !== 'dir') dbox.appendChild(paneRow('大小', exactSize(shown.size)));
        dbox.appendChild(paneRow('建立日期', fmtDate(shown.ctime || shown.mtime)));
        if (!shown.zipEntry) dbox.appendChild(paneRow('位置', toWin(LAB.vfs.dirname(shown.path))));
      }
      paneEl.appendChild(dbox);
    }
    function setPane(which) {
      S.pane = S.pane === which ? '' : which;
      PANE_MEMORY.which = S.pane;
      paneSig = '';
      updatePane();
      updateCmdState();
      layoutGrid();
    }

    /* ---------- navigation pane ---------- */
    var navRecs = [], navOffs = [], navSig = '';
    function hasKidDirs(p) {
      try { return LAB.vfs.list(p).some(function (s) { return s.type === 'dir' && !s.hidden; }); } catch (e) { return false; }
    }
    function navDefs() {
      var out = [];
      out.push({ key: 'home', path: V_HOME, label: dname(V_HOME), icon: 'fd-n-home' });
      out.push({ key: 'gal', path: V_GAL, label: dname(V_GAL), icon: 'fd-n-gallery', inert: true });
      out.push({ sep: true, key: 's1' });
      pinList().forEach(function (p) {
        out.push({ key: 'q' + p, path: p, label: dname(p), icon: pinGlyph(p), pin: true });
      });
      out.push({ sep: true, key: 's2' });
      var pcOpen = S.navExp.has(V_PC);
      out.push({ key: 'pc' + (pcOpen ? '+' : '-'), path: V_PC, label: dname(V_PC), icon: 'fd-n-thispc', exp: pcOpen ? 'open' : 'closed', toggle: V_PC });
      if (pcOpen) {
        (function addTree(p, depth) {
          var open = S.navExp.has(p), kids = hasKidDirs(p);
          out.push({ key: 't' + p + (kids ? (open ? '+' : '-') : '.'), path: p, label: dname(p), icon: p === '/' ? 'fd-n-drive' : 'folder', depth: depth, exp: kids ? (open ? 'open' : 'closed') : 'none', toggle: p, tree: true });
          if (open && kids) {
            var dirs = [];
            try { dirs = LAB.vfs.list(p).filter(function (s) { return s.type === 'dir' && !s.hidden; }); } catch (e) { dirs = []; }
            dirs.sort(function (a, b) { return cmpStr(labelOf(a), labelOf(b)); });
            dirs.forEach(function (d) { addTree(d.path, depth + 1); });
          }
        })('/', 1);
      }
      out.push({ key: 'net', path: V_NET, label: dname(V_NET), icon: 'fd-n-network', inert: true, exp: 'closed-inert' });
      return out;
    }
    function buildNav(force) {
      var defs = navDefs();
      var sig = defs.map(function (d) { return d.key + ':' + d.label; }).join('|');
      if (!force && sig === navSig) { updateNavCur(); return; }
      navSig = sig;
      navOffs.forEach(function (f) { try { f(); } catch (e) { /* ignore */ } });
      navOffs = []; navRecs = [];
      var navTop = navEl.scrollTop;
      navEl.textContent = '';
      defs.forEach(function (d) {
        if (d.sep) { navEl.appendChild(h('div', { class: 'fd-nav-sep', role: 'separator' })); return; }
        var btn = h('button', { type: 'button', class: 'fd-nav-item' + (d.inert ? ' is-inert' : ''), dataset: { lab: 'fd-sidebar-item', path: d.path } });
        if (d.depth) btn.style.setProperty('--d', String(d.depth));
        var exp = h('span', { class: 'fd-nav-exp' + (d.exp && d.exp !== 'none' ? '' : ' is-none'), 'aria-hidden': 'true' });
        if (d.exp && d.exp !== 'none') { exp.innerHTML = gl('fd-i-chev-r', 10); if (d.exp === 'open') exp.classList.add('is-open'); }
        var ico = h('span', { class: 'fd-nav-ico', 'aria-hidden': 'true' });
        ico.innerHTML = gl(d.icon, 16);
        btn.appendChild(exp); btn.appendChild(ico);
        btn.appendChild(h('span', { class: 'fd-nav-txt' }, d.label));
        if (d.pin) { var pin = h('span', { class: 'fd-nav-pin', 'aria-hidden': 'true' }); pin.innerHTML = gl('fd-n-pin', 11); btn.appendChild(pin); }
        if (d.inert) {
          btn.setAttribute('aria-disabled', 'true');
          btn.addEventListener('click', function () { LAB.ui.toast(d.path === V_GAL ? '練習版沒有圖庫' : '練習版沒有網路位置'); });
        } else {
          btn.addEventListener('click', function () { navigate(d.path, 'sidebar'); });
        }
        if (d.toggle && d.exp && d.exp !== 'none' && d.exp !== 'closed-inert') {
          exp.addEventListener('click', function (e) {
            e.stopPropagation();
            if (S.navExp.has(d.toggle)) S.navExp.delete(d.toggle); else S.navExp.add(d.toggle);
            buildNav(false);
          });
          exp.addEventListener('dblclick', function (e) { e.stopPropagation(); });
          exp.dataset.lab = 'fd-nav-expander';
        }
        btn.addEventListener('dblclick', function (e) {
          if (d.toggle && d.exp && d.exp !== 'none' && d.exp !== 'closed-inert') {
            if (S.navExp.has(d.toggle)) S.navExp.delete(d.toggle); else S.navExp.add(d.toggle);
            buildNav(false);
          }
        });
        if (!d.inert) btn.addEventListener('contextmenu', function (e) {
          e.preventDefault(); e.stopPropagation();
          var p = tx(e);
          navMenu(d.path, d.pin, p.x, p.y);
        });
        navEl.appendChild(btn);
        navRecs.push({ btn: btn, path: d.path });
        if (!isVirt(d.path)) {
          navOffs.push(LAB.dnd.target(btn, {
            id: 'finder:' + win.id + ':sidebar:' + d.path,
            accept: function (pl, mods) { return acceptInto(pl, d.path, mods); },
            enter: function () { btn.classList.add('is-drop'); },
            leave: function () { btn.classList.remove('is-drop'); },
            drop: function (pl, ctx) { btn.classList.remove('is-drop'); transferInto(pl.paths, d.path, ctx.mode === 'copy' ? 'copy' : 'move'); }
          }));
        }
      });
      navEl.scrollTop = navTop;
      updateNavCur();
    }
    function updateNavCur() {
      navRecs.forEach(function (r) {
        var cur = isVirt(r.path) ? r.path === S.path : (!isVirt(S.path) && LAB.vfs.same(r.path, S.path));
        r.btn.classList.toggle('is-cur', cur);
        if (cur) r.btn.setAttribute('aria-current', 'page'); else r.btn.removeAttribute('aria-current');
      });
    }

    /* ---------- command bar ---------- */
    var cmdKey = '', cmdBtns = {};
    function cb(id, o) {
      var b = h('button', { type: 'button', class: 'fd-cb' + (o.text ? ' has-text' : '') + (o.menu ? ' has-menu' : ''), 'aria-label': o.label, title: o.tip || o.label, dataset: { lab: o.hook || ('fd-cmd-' + id) } });
      var i = h('span', { class: 'fd-cb-i', 'aria-hidden': 'true' });
      i.innerHTML = gl(o.icon, 18);
      b.appendChild(i);
      if (o.text) b.appendChild(h('span', { class: 'fd-cb-t' }, o.text));
      if (o.menu) { var c = h('span', { class: 'fd-cb-c', 'aria-hidden': 'true' }); c.innerHTML = gl('fd-i-chev-d', 9); b.appendChild(c); }
      b.addEventListener('click', function () { if (b.disabled) return; o.run(b); });
      b.addEventListener('dblclick', function (e) { e.stopPropagation(); });
      cmdBtns[id] = b;
      return b;
    }
    function csep() { return h('div', { class: 'fd-cb-sep', 'aria-hidden': 'true' }); }
    function buildCmd() {
      var k = kindOfPath(S.path) === 'trash' ? 'trash' : 'dir';
      if (k === cmdKey) return;
      cmdKey = k;
      cmdBtns = {};
      cmdEl.textContent = '';
      if (k === 'trash') {
        cmdEl.appendChild(cb('empty', { icon: 'fd-i-delete', text: '清空資源回收筒', label: '清空資源回收筒', hook: 'fd-empty-trash', run: function () { emptyTrash(); } }));
        cmdEl.appendChild(cb('restoreall', { icon: 'fd-i-restore', text: '還原所有項目', label: '還原所有項目', hook: 'fd-restore-all', run: function () { restoreAll(); } }));
        cmdEl.appendChild(cb('restore', { icon: 'fd-i-restore', text: '還原選取的項目', label: '還原選取的項目', hook: 'fd-restore', run: function () { putBackSel(orderedSel()); } }));
        cmdEl.appendChild(csep());
        cmdEl.appendChild(cb('sort', { icon: 'fd-i-sort', text: '排序', menu: true, label: '排序', hook: 'fd-sort', run: function (b) { var p = below(b); LAB.menu.contextMenu(p.x, p.y, sortItems()); } }));
        cmdEl.appendChild(cb('view', { icon: 'fd-i-view', text: '檢視', menu: true, label: '檢視', hook: 'fd-view', run: function (b) { var p = below(b); LAB.menu.contextMenu(p.x, p.y, viewItems()); } }));
        cmdEl.appendChild(h('div', { class: 'fd-cb-fill' }));
        return;
      }
      cmdEl.appendChild(cb('new', { icon: 'fd-i-new', text: '新增', menu: true, label: '新增', hook: 'fd-new', run: function (b) { var p = below(b); LAB.menu.contextMenu(p.x, p.y, newItems()); } }));
      cmdEl.appendChild(csep());
      cmdEl.appendChild(cb('cut', { icon: 'fd-i-cut', label: '剪下', tip: '剪下 (Ctrl+X)', run: function () { cutSel(); } }));
      cmdEl.appendChild(cb('copy', { icon: 'fd-i-copy', label: '複製', tip: '複製 (Ctrl+C)', run: function () { copySel(); } }));
      cmdEl.appendChild(cb('paste', { icon: 'fd-i-paste', label: '貼上', tip: '貼上 (Ctrl+V)', run: function () { paste(); } }));
      cmdEl.appendChild(cb('rename', { icon: 'fd-i-rename', label: '重新命名', tip: '重新命名 (F2)', run: function () { var s = orderedSel(); if (s.length === 1) startRename(s[0]); } }));
      cmdEl.appendChild(cb('share', { icon: 'fd-i-share', label: '分享', tip: '分享', run: function () { LAB.ui.toast('練習版沒有分享功能'); } }));
      cmdEl.appendChild(cb('delete', { icon: 'fd-i-delete', label: '刪除', tip: '刪除 (Delete)', run: function () { trashSel(); } }));
      cmdEl.appendChild(csep());
      cmdEl.appendChild(cb('sort', { icon: 'fd-i-sort', text: '排序', menu: true, label: '排序', hook: 'fd-sort', run: function (b) { var p = below(b); LAB.menu.contextMenu(p.x, p.y, sortItems()); } }));
      cmdEl.appendChild(cb('view', { icon: 'fd-i-view', text: '檢視', menu: true, label: '檢視', hook: 'fd-view', run: function (b) { var p = below(b); LAB.menu.contextMenu(p.x, p.y, viewItems()); } }));
      // 全部解壓縮 shows itself inside a zip and when exactly one zip is selected (the contextual command of Windows 11)
      cmdEl.appendChild(cb('extract', { icon: 'fd-i-extract', text: '全部解壓縮', label: '全部解壓縮', hook: 'fd-extract-all', run: function () { extractSelected(); } }));
      cmdEl.appendChild(cb('more', { icon: 'fd-i-more', label: '查看更多', tip: '查看更多', hook: 'fd-more', run: function (b) { var p = below(b); LAB.menu.contextMenu(p.x, p.y, moreItems()); } }));
      cmdEl.appendChild(h('div', { class: 'fd-cb-fill' }));
      cmdEl.appendChild(cb('details', { icon: 'fd-i-pane', text: '詳細資料', label: '詳細資料窗格', tip: '詳細資料窗格 (Alt+Shift+P)', run: function () { setPane('details'); } }));
    }
    /* the zip that 全部解壓縮 would unpack: the one being browsed, or the single zip file selected in a folder */
    function extractTarget0() {
      var zl = inZip() ? zipLocOf(S.path) : null;
      if (zl) return zl.zip;
      var s = orderedSel();
      if (s.length === 1) { var st = stat(s[0]); if (st && st.type === 'file' && st.kind === 'zip' && !st.zipEntry) return st.path; }
      return null;
    }
    function extractSelected() {
      var z = extractTarget0();
      if (z) extractWizard(z, win);
    }
    function updateCmdState() {
      if (!cmdBtns) return;
      var real = realDir() && !S.filter;
      var n = S.sel.size;
      var inT = inTrashView();
      function dis(id, off) { if (cmdBtns[id]) cmdBtns[id].disabled = !!off; }
      if (inT) {
        dis('empty', trashCount() === 0);
        dis('restoreall', trashCount() === 0);
        dis('restore', n === 0);
        return;
      }
      dis('new', !real);
      dis('cut', n === 0 || !realDir());
      dis('copy', n === 0 || inZip());
      dis('paste', !(realDir() && (LAB.clipboard.paths || []).length > 0));
      dis('rename', n !== 1 || !realDir());
      dis('delete', n === 0 || inZip());
      dis('sort', shape() !== 'dir');
      dis('view', shape() !== 'dir');
      if (cmdBtns.extract) cmdBtns.extract.hidden = !extractTarget0();
      if (cmdBtns.details) cmdBtns.details.classList.toggle('is-on', S.pane === 'details');
    }

    /* ---------- dropdown / context menu contents ---------- */
    function newItems() {
      return [
        { label: '資料夾', icon: 'folder', action: function () { newFolder(); } },
        { label: '文字文件', icon: 'txt', action: function () { newTextFile(); } }
      ];
    }
    function sortItems() {
      var cols = inTrashView()
        ? [['name', '名稱'], ['orig', '原始位置'], ['deleted', '刪除日期'], ['size', '大小'], ['kind', '項目類型']]
        : inZip() ? [['name', '名稱'], ['kind', '類型'], ['csize', '壓縮大小'], ['size', '大小'], ['ratio', '比例'], ['date', '修改日期']]
        : S.colsSel.map(function (k) { return [k, COLCAT[k].t]; });
      var out = cols.map(function (c) { return { label: c[1], checked: S.sort.key === c[0], action: function () { sortBy(c[0], S.sort.key === c[0] ? S.sort.dir : (c[0] === 'date' || c[0] === 'deleted' || c[0] === 'ctime' || c[0] === 'atime' ? -1 : 1)); } }; });
      out.push({ separator: true });
      out.push({ label: '遞增', checked: S.sort.dir > 0, action: function () { sortBy(S.sort.key, 1); } });
      out.push({ label: '遞減', checked: S.sort.dir < 0, action: function () { sortBy(S.sort.key, -1); } });
      if (!inTrashView() && shape() === 'dir') {
        out.push({ separator: true });
        var gs = [{ label: '(無)', checked: !S.group, action: function () { setGroup(''); } }];
        Object.keys(GROUPS).forEach(function (g) { gs.push({ label: GROUPS[g], checked: S.group === g, action: function () { setGroup(g); } }); });
        out.push({ label: '群組依據', submenu: gs });
      }
      return out;
    }
    function setGroup(g) {
      S.group = g;
      render();
      updateChrome();
    }
    var MODE_ICON = { xl: 'fd-i-grid', icon: 'fd-i-grid', md: 'fd-i-grid', sm: 'fd-i-list', plist: 'fd-i-list', list: 'fd-i-list', tiles: 'fd-i-tiles', content: 'fd-i-content' };
    function viewItems() {
      var out = MODE_ORDER.map(function (m) {
        return { label: MODES[m].label, icon: MODE_ICON[m], shortcut: 'Ctrl+Shift+' + MODES[m].key, checked: S.mode === m, action: function () { setMode(m); } };
      });
      out.push({ separator: true });
      out.push({ label: '顯示', submenu: [
        { label: '瀏覽窗格', checked: S.showNav, action: function () { S.showNav = !S.showNav; updateChrome(); } },
        { label: '預覽窗格', shortcut: 'Alt+P', checked: S.pane === 'preview', action: function () { setPane('preview'); } },
        { label: '詳細資料窗格', shortcut: 'Alt+Shift+P', checked: S.pane === 'details', action: function () { setPane('details'); } },
        { separator: true },
        { label: '隱藏的項目', checked: S.showHidden, action: function () { S.showHidden = !S.showHidden; render(); } }
      ] });
      return out;
    }
    function moreItems() {
      var any = S.order.length > 0;
      var sel = orderedSel(), real = sel.filter(function (p) { var s = stat(p); return s && !s.zipEntry && !underTrash(p); });
      var out = [
        { label: '全選', shortcut: 'Ctrl+A', enabled: any, action: function () { setSel(S.order.slice()); S.anchor = S.order[0] || null; } },
        { label: '全部不選', enabled: S.sel.size > 0, action: function () { setSel([]); } },
        { label: '反向選取', enabled: any, action: function () { setSel(S.order.filter(function (p) { return !S.sel.has(p); })); } }
      ];
      if (real.length) {
        out.push({ separator: true });
        out.push({ label: '壓縮成 ZIP 檔案', icon: 'zip', action: function () { compressSel(real); } });
        out.push({ label: '複製路徑', icon: 'fd-i-path', shortcut: 'Ctrl+Shift+C', action: function () { copyAsPath(real); } });
        out.push({ label: '內容', icon: 'fd-i-info', shortcut: 'Alt+Enter', action: function () { showProps(real); } });
      }
      return out;
    }
    /* right-click on an item of the navigation pane */
    function navMenu(path, pinnedItem, x, y) {
      var items2 = [{ label: '開啟', icon: 'fd-i-open', action: function () { navigate(path, 'sidebar'); } },
        { label: '在新分頁中開啟', action: function () { newTab(path); } },
        { label: '在新視窗中開啟', action: function () { open({ path: path, via: 'open', fresh: true }); } }];
      if (!isVirt(path)) {
        items2.push({ separator: true });
        items2.push(isPinned(path)
          ? { label: '從快速存取取消釘選', icon: 'fd-n-pin', action: function () { setPinned(path, false); } }
          : { label: '釘選到快速存取', icon: 'fd-n-pin', action: function () { setPinned(path, true); } });
        items2.push({ label: '在終端中開啟', icon: 'fd-i-terminal', action: function () { openTerminalAt(path); } });
        items2.push({ separator: true });
        items2.push({ label: '內容', icon: 'fd-i-info', shortcut: 'Alt+Enter', action: function () { showProps([path]); } });
      }
      var p = { x: x, y: y };
      LAB.menu.contextMenu(p.x, p.y, items2);
    }
    function showProps(paths) {
      var ps = (paths || orderedSel()).filter(function (p) { return !isVirt(p) && stat(p); });
      if (!ps.length && !isVirt(S.path) && stat(S.path)) ps = [S.path];
      if (ps.length) openProps(ps, win);
    }
    function compressSel(paths) {
      var res = compressPaths(paths, { win: win });
      if (!res) return;
      var dir = LAB.vfs.dirname(res.path);
      if (realDir() && sameDir(dir, S.path)) {
        render();
        S.anchor = res.path;
        setSel([res.path], { silent: true });
        var rec = items.get(res.path);
        if (rec) ensureVisible(rec.el);
        startRename(res.path);                     // Windows lets you name the new zip right away
      }
    }
    function openWithItems(path) {
      return LAB.apps.openWith(path).filter(function (o) { return o.appId !== 'finder'; }).map(function (o) {
        var def = LAB.apps.get(o.appId);
        var it = { label: o.label, action: function () { LAB.apps.openPath(path, { appId: o.appId, via: 'finder' }); } };
        if (def && def.icon && LAB.icons.has(def.icon)) it.icon = def.icon;
        return it;
      });
    }
    function itemMenu(path, x, y) {
      var st = stat(path);
      if (!st) return;
      var paths = S.sel.has(path) ? orderedSel() : [path];
      var multi = paths.length > 1;
      var inTrash = underTrash(path);
      var list;
      if (st.zipEntry) {                           // an entry inside a zip: read-only
        LAB.menu.contextMenu(x, y, [
          { label: '開啟', icon: 'fd-i-open', shortcut: 'Enter', action: function () { paths.forEach(function (p) { openItem(p); }); } },
          { label: '全部解壓縮…', icon: 'fd-i-extract', action: function () { extractSelected(); } },
          { separator: true },
          { label: '內容', icon: 'fd-i-info', shortcut: 'Alt+Enter', action: function () { showProps(paths); } }
        ]);
        return;
      }
      if (inTrash) {
        list = [
          { label: multi ? '還原選取的項目' : '還原', icon: 'fd-i-restore', action: function () { putBackSel(paths); } },
          { label: '刪除', icon: 'fd-i-delete', shortcut: 'Delete', action: function () { deleteForever(paths); } },
          { separator: true },
          { label: '內容', icon: 'fd-i-info', shortcut: 'Alt+Enter', action: function () { showProps(paths); } }
        ];
        LAB.menu.contextMenu(x, y, list);
        return;
      }
      var ow = multi ? [] : openWithItems(path);
      var isZipFile = !multi && st.type === 'file' && st.kind === 'zip';
      list = [
        { iconRow: [
          { icon: 'fd-i-cut', label: '剪下', shortcut: 'Ctrl+X', action: function () { cutPaths(paths); } },
          { icon: 'fd-i-copy', label: '複製', shortcut: 'Ctrl+C', action: function () { copyPaths(paths); } },
          { icon: 'fd-i-rename', label: '重新命名', shortcut: 'F2', enabled: !multi, action: function () { startRename(path); } },
          { icon: 'fd-i-delete', label: '刪除', shortcut: 'Delete', action: function () { trashPaths(paths); } }
        ] },
        { label: '開啟', icon: 'fd-i-open', shortcut: 'Enter', action: function () { paths.forEach(function (p) { openItem(p); }); } }
      ];
      if (!multi && st.type === 'dir') {
        list.push({ label: '在新分頁中開啟', action: function () { newTab(path); } });
        list.push({ label: '在新視窗中開啟', action: function () { open({ path: path, via: 'open', fresh: true }); } });
      }
      if (!multi) list.push({ label: '開啟檔案', icon: 'fd-i-open', enabled: ow.length > 0, submenu: ow });
      if (!multi && st.type === 'dir') {
        list.push(isPinned(path)
          ? { label: '從快速存取取消釘選', icon: 'fd-n-pin', action: function () { setPinned(path, false); } }
          : { label: '釘選到快速存取', icon: 'fd-n-pin', action: function () { setPinned(path, true); } });
      }
      if (isZipFile) list.push({ label: '全部解壓縮…', icon: 'fd-i-extract', action: function () { extractWizard(st.path, win); } });
      list.push({ label: '壓縮成 ZIP 檔案', icon: 'zip', action: function () { compressSel(multi ? [path].concat(paths.filter(function (p) { return p !== path; })) : [path]); } });
      if (!multi && st.type === 'dir') list.push({ label: '在終端中開啟', icon: 'fd-i-terminal', action: function () { openTerminalAt(path); } });
      list.push({ separator: true });
      list.push({ label: '複製路徑', icon: 'fd-i-path', shortcut: 'Ctrl+Shift+C', action: function () { copyAsPath(paths); } });
      list.push({ label: '內容', icon: 'fd-i-info', shortcut: 'Alt+Enter', action: function () { showProps(paths); } });
      list.push({ separator: true });
      list.push({ label: '顯示其他選項', shortcut: 'Shift+F10', action: function () { LAB.ui.toast('練習版沒有完整的右鍵選單'); } });
      LAB.menu.contextMenu(x, y, list);
    }
    function emptyMenu(x, y) {
      if (inTrashView()) {
        LAB.menu.contextMenu(x, y, [
          { label: '排序方式', icon: 'fd-i-sort', submenu: sortItems() },
          { label: '檢視', icon: 'fd-i-view', submenu: viewItems() },
          { separator: true },
          { label: '清空資源回收筒', icon: 'fd-i-delete', enabled: trashCount() > 0, action: function () { emptyTrash(); } },
          { label: '還原所有項目', icon: 'fd-i-restore', enabled: trashCount() > 0, action: function () { restoreAll(); } }
        ]);
        return;
      }
      var can = realDir() && !S.filter;
      if (inZip()) {
        LAB.menu.contextMenu(x, y, [
          { label: '檢視', icon: 'fd-i-view', submenu: viewItems() },
          { label: '排序方式', icon: 'fd-i-sort', submenu: sortItems() },
          { label: '重新整理', icon: 'fd-i-refresh', action: function () { refresh(); } },
          { separator: true },
          { label: '全部解壓縮…', icon: 'fd-i-extract', action: function () { extractSelected(); } }
        ]);
        return;
      }
      if (shape() !== 'dir' && !can) {
        LAB.menu.contextMenu(x, y, [
          { label: '重新整理', icon: 'fd-i-refresh', action: function () { refresh(); } }
        ]);
        return;
      }
      LAB.menu.contextMenu(x, y, [
        { label: '檢視', icon: 'fd-i-view', submenu: viewItems() },
        { label: '排序方式', icon: 'fd-i-sort', submenu: sortItems() },
        { label: '重新整理', icon: 'fd-i-refresh', action: function () { refresh(); } },
        { separator: true },
        { label: '貼上', icon: 'fd-i-paste', shortcut: 'Ctrl+V', enabled: can && (LAB.clipboard.paths || []).length > 0, action: function () { paste(); } },
        { separator: true },
        { label: '新增', icon: 'fd-i-new', enabled: can, submenu: newItems() },
        { separator: true },
        { label: '在終端中開啟', icon: 'fd-i-terminal', enabled: can, action: function () { openTerminalAt(S.path); } },
        { label: '內容', icon: 'fd-i-info', shortcut: 'Alt+Enter', enabled: can, action: function () { showProps([S.path]); } },
        { separator: true },
        { label: '顯示其他選項', shortcut: 'Shift+F10', action: function () { LAB.ui.toast('練習版沒有完整的右鍵選單'); } }
      ]);
    }

    /* ---------- navigation ---------- */
    function canGoUp() { return !isVirt(S.path) ? true : false; }
    function navigate(path, how, o) {
      o = o || {};
      var p = normLoc(path);
      if (p === null) return false;
      if (!validLoc(p)) return false;
      cancelEdits();
      var same = p === S.path;
      if (!o.noPush && !same) {
        S.hist = S.hist.slice(0, S.hi + 1);
        S.hist.push(p);
        S.hi = S.hist.length - 1;
      }
      if (!same) {
        S.path = p;
        S.filter = '';
        searchIn.value = '';
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
    /* ↑ : a folder goes to its parent; C:\ goes to 本機; 本機, 首頁 and 資源回收筒 have no parent in this practice PC (it stays) */
    function goUp() {
      if (S.path === V_HOME || S.path === V_TRASH) return false;
      if (S.path === V_PC) return false;
      if (S.path === '/') return navigate(V_PC, 'up');
      return navigate(LAB.vfs.dirname(S.path), 'up');
    }
    function refresh() { render(); updateChrome(); }
    function setMode(m) {
      if (S.mode === m) return;
      S.mode = m;
      render();
      updateChrome();
      LAB.bus.emit('finder:view', { winId: win.id, mode: m });
    }

    function openItem(path) {
      var st = stat(path);
      if (!st) return;
      if (underTrash(st.path)) { LAB.ui.toast('請先還原這個項目，才能開啟它'); return; }
      if (st.type === 'dir') { navigate(st.path, 'open'); return; }
      if (st.zipEntry) { LAB.ui.toast('練習版：請先按「全部解壓縮」，再開啟壓縮檔裡的檔案'); return; }
      if (st.kind === 'zip') {                        // a zip opens like a folder (Windows 11)
        if (navigate(st.path, 'open')) LAB.bus.emit('finder:open', { path: st.path, kind: 'zip', via: 'finder' });
        return;
      }
      openFileFromExplorer(st);
    }
    function openSelection() { orderedSel().forEach(openItem); }

    /* ---------- address bar: breadcrumb <-> text ---------- */
    function editAddress() {
      if (S.addrEditing) return;
      S.addrEditing = true;
      root.classList.add('is-addr-edit');
      addrIn.value = isVirt(S.path) ? dname(S.path) : toWin(S.path);
      addrIn.focus();
      addrIn.select();
    }
    function endAddressEdit(refocus) {
      if (!S.addrEditing) return;
      S.addrEditing = false;
      S.addrBusy = false;
      root.classList.remove('is-addr-edit');
      if (refocus && document.activeElement === addrIn) addrIn.blur();
    }
    function commitAddress() {
      var txt = addrIn.value.trim();
      if (!txt) { endAddressEdit(true); return; }
      var low = txt.toLowerCase();
      var target = ADDR_NAMES[low] || ADDR_NAMES[txt];
      if (target) { endAddressEdit(true); navigate(target, 'address'); return; }
      var base = isVirt(S.path) ? HOME : S.path;
      var p = (LAB.win && LAB.win.fromWin) ? LAB.win.fromWin(txt, base, { localized: true }) : LAB.vfs.canon(txt.replace(/^[A-Za-z]:/, '').replace(/\\/g, '/'), base);   // the fallback is only for a page without js/win.js
      if (p && LAB.vfs.isDir(p)) { endAddressEdit(true); navigate(p, 'address'); return; }
      if (p && LAB.vfs.isFile(p)) { endAddressEdit(true); openItem(p); return; }
      if (p && zipLocOf(p) && validLoc(p)) { endAddressEdit(true); navigate(p, 'address'); return; }     // C:\…\week3.zip\week3
      S.addrBusy = true;
      LAB.ui.alert(win, {
        title: '檔案總管',
        text: 'Windows 找不到「' + txt + '」。請檢查拼字，然後再試一次。',
        buttons: [{ label: '確定', value: true, 'default': true }]
      }).then(function () {
        S.addrBusy = false;
        if (S.addrEditing) { addrIn.focus(); addrIn.select(); }
      });
    }
    addrBox.addEventListener('click', function (e) {
      if (S.addrEditing) return;
      if (e.target.closest && (e.target.closest('.fd-ps') || e.target.closest('.fd-addr-btn'))) return;
      editAddress();
    });
    addrIn.addEventListener('keydown', function (e) {
      e.stopPropagation();
      if (LAB.ui.isImeEnter(e)) return;
      if (e.key === 'Enter') { e.preventDefault(); commitAddress(); }
      else if (e.key === 'Escape') { e.preventDefault(); endAddressEdit(true); }
    });
    addrIn.addEventListener('blur', function () { if (S.addrEditing && !S.addrBusy) endAddressEdit(false); });
    addrIn.addEventListener('pointerdown', function (e) { e.stopPropagation(); });

    /* ---------- drag and drop into this window ---------- */
    var NO_DROP = ['/', '/Users', '/Windows', '/Program Files', '/Program Files (x86)'];       // Windows asks for an administrator here
    function acceptInto(pl, dest, mods) {
      if (!pl || pl.kind !== 'fs' || !pl.paths || !pl.paths.length) return false;
      if (isVirt(dest) && dest !== V_TRASH) return false;
      var toTrash = dest === V_TRASH || (!isVirt(dest) && isTrashDir(dest));
      if (dest === V_TRASH) dest = TRASH;
      if (!LAB.vfs.isDir(dest)) return false;
      for (var n = 0; n < NO_DROP.length; n++) if (LAB.vfs.same(dest, NO_DROP[n])) return false;
      var allSameParent = true;
      for (var i = 0; i < pl.paths.length; i++) {
        var p = pl.paths[i];
        var st = LAB.vfs.stat(p);
        if (!st) return false;
        if (st.type === 'dir' && (LAB.vfs.same(p, dest) || LAB.vfs.isUnder(dest, p))) return false;
        if (!sameDir(LAB.vfs.dirname(st.path), dest)) allSameParent = false;
      }
      if (toTrash) {
        if (mods && (mods.mode === 'copy' || mods.ctrlKey)) return false;
        return allSameParent ? false : 'move';
      }
      if (allSameParent) return false;
      return (mods && (mods.altKey || mods.ctrlKey || mods.mode === 'copy')) ? 'copy' : 'move';
    }

    function transferInto(paths, destDir, mode) {
      var vfs = LAB.vfs;
      if (destDir === V_TRASH) destDir = TRASH;
      var i = 0;
      function next() {
        if (i >= paths.length) return Promise.resolve();
        var src = paths[i++];
        var st = vfs.stat(src);
        if (!st) return next();
        if (isTrashDir(destDir)) {
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
          var isDir = st.type === 'dir';
          return LAB.ui.alert(win, {
            title: '取代或略過檔案',
            text: '目的地「' + dname(destDir) + '」已經有一個名稱為「' + st.name + '」的' + (isDir ? '資料夾' : '檔案') + '。要取代它、兩個都保留，還是略過？',
            buttons: [
              { label: '取代', value: 'replace', 'default': true },
              { label: '兩個都保留', value: 'both' },
              { label: '略過', value: 'stop', cancel: true }
            ]
          }).then(function (v) {
            if (v === 'stop' || v === null) { return next(); }
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
    function newItemBase() {
      if (!realDir()) { LAB.ui.toast('這裡不能新增項目'); return false; }
      if (S.filter) { S.filter = ''; searchIn.value = ''; render(); }
      return true;
    }
    function newFolder() {
      if (!newItemBase()) return;
      var name = LAB.vfs.uniqueName(S.path, '新增資料夾');
      var p = LAB.vfs.join(S.path, name);
      try { LAB.vfs.mkdir(p, { by: 'finder' }); } catch (e) { LAB.ui.vfsFail(win, e, '無法新增資料夾', p); return; }
      render();
      S.anchor = p;
      setSel([p], { silent: true });         // the automatic selection is not a click by the student (mission 1 step 6 waits for one)
      var rec = items.get(p);
      if (rec) ensureVisible(rec.el);
      startRename(p);
    }
    function newTextFile() {
      if (!newItemBase()) return;
      var name = LAB.vfs.uniqueName(S.path, '新增文字文件', '.txt');
      var p = LAB.vfs.join(S.path, name);
      try { LAB.vfs.writeFile(p, '', { by: 'finder' }); } catch (e) { LAB.ui.vfsFail(win, e, '無法新增文字文件', p); return; }
      render();
      S.anchor = p;
      setSel([p], { silent: true });
      var rec = items.get(p);
      if (rec) ensureVisible(rec.el);
      startRename(p);
    }
    function trashPaths(paths) {
      if (inZip()) { LAB.ui.toast('練習版：壓縮的 (zipped) 資料夾是唯讀的，裡面的檔案不能刪除'); return; }
      var done = [];
      paths.forEach(function (p) {
        if (underTrash(p)) return;
        try { done.push({ name: LAB.vfs.basename(p), dest: LAB.vfs.trash(p, { by: 'finder' }) }); }
        catch (e) { LAB.ui.vfsFail(win, e, '無法刪除', p); }
      });
      if (done.length) {
        LAB.undo.push('刪除「' + done[0].name + '」' + (done.length > 1 ? '等 ' + done.length + ' 個項目' : ''), function () {
          done.forEach(function (d) { try { LAB.vfs.putBack(d.dest, { by: 'finder' }); } catch (e) { /* already gone */ } });
        });
        setSel([]); render();
      }
    }
    function trashSel() {
      var ps = orderedSel();
      if (!ps.length) return;
      if (inTrashView()) { deleteForever(ps); return; }
      trashPaths(ps);
    }
    /* permanent deletion of what is already in the 資源回收筒 (it asks, like Windows) */
    function deleteForever(paths) {
      var ps = paths.filter(underTrash);
      if (!ps.length) return;
      LAB.ui.confirm(win, {
        title: ps.length > 1 ? '要永久刪除這 ' + ps.length + ' 個項目嗎？' : '要永久刪除這個項目嗎？',
        ok: '是', cancel: '否'
      }).then(function (ok) {
        if (!ok) return;
        ps.forEach(function (p) { try { LAB.vfs.remove(p, { by: 'finder', recursive: true, force: true }); } catch (e) { LAB.ui.toast('無法刪除（' + LAB.vfs.errText(e.code) + '）'); } });
        setSel([]); render();
      });
    }
    function emptyTrash() {
      var n = trashCount();
      if (!n) return;
      LAB.ui.confirm(win, { title: '要永久刪除這 ' + n + ' 個項目嗎？', ok: '是', cancel: '否' }).then(function (ok) {
        if (!ok) return;
        try { LAB.vfs.emptyTrash({ by: 'finder' }); } catch (e) { LAB.ui.toast('無法清空資源回收筒'); }
        setSel([]); render();
      });
    }
    function putBackSel(paths) {
      var back = [];
      paths.forEach(function (p) {
        if (!underTrash(p)) return;
        try { back.push(LAB.vfs.putBack(p, { by: 'finder' })); } catch (e) { LAB.ui.toast('無法還原這個項目（' + LAB.vfs.errText(e.code) + '）'); }
      });
      if (back.length) { setSel([]); render(); }
    }
    function restoreAll() { putBackSel(dirEntries(TRASH).map(function (s) { return s.path; })); }
    function cutPaths(ps) { if (ps.length && !inZip()) clipSet(ps, 'cut'); }
    function copyPaths(ps) {
      if (!ps.length) return;
      if (inZip()) { LAB.ui.toast('練習版：請用「全部解壓縮」把壓縮檔裡的檔案取出來'); return; }      // a zip is read-only here, and copying out of it is the wizard's job
      clipSet(ps, 'copy');
    }
    function cutSel() { cutPaths(orderedSel()); }
    function copySel() { copyPaths(orderedSel()); }
    /* 複製路徑: "C:\Users\an\Desktop\Project" with the quotes, one path per line */
    function copyAsPath(ps) {
      if (!ps.length) return;
      LAB.clipboard.setText(ps.map(function (p) { return '"' + toWin(p) + '"'; }).join('\n'));
    }
    function paste() {
      if (!realDir()) return;
      var src = (LAB.clipboard.paths || []).filter(function (p) { return LAB.vfs.exists(p); });
      if (!src.length) return;
      var dir = S.path;
      if (LAB.clipboard.op === 'cut') {
        transferInto(src, dir, 'move').then(function () { clipClear(); });
        return;
      }
      var inPlace = src.filter(function (p) { return sameDir(LAB.vfs.dirname(p), dir); });
      var other = src.filter(function (p) { return !sameDir(LAB.vfs.dirname(p), dir); });
      inPlace.forEach(function (p) {
        var st = LAB.vfs.stat(p);
        var ext = st.type === 'file' ? LAB.vfs.extname(st.name) : '';
        var base = ext ? st.name.slice(0, st.name.length - ext.length) : st.name;
        try { LAB.vfs.copy(st.path, LAB.vfs.join(dir, LAB.vfs.uniqueName(dir, base + ' - 複製', ext)), { by: 'finder', recursive: true }); } catch (e) { LAB.ui.toast('無法貼上（' + LAB.vfs.errText(e.code) + '）'); }
      });
      if (other.length) transferInto(other, dir, 'copy');
      else render();
    }

    /* ---------- rename ---------- */
    var bubble = null;
    var bubbleTimer = null;
    function hideBubble() { clearTimeout(bubbleTimer); if (bubble && bubble.parentNode) bubble.parentNode.removeChild(bubble); bubble = null; }
    function startRename(path) {
      if (S.renaming || S.sheet) return;
      if (isVirt(path)) return;
      path = LAB.vfs.canon(path);
      var rec = items.get(path);
      if (!rec) { render(); rec = items.get(path); }
      if (!rec || !(rec.variant === 'row' || rec.variant === 'icon' || rec.variant === 'small' || rec.variant === 'ttile' || rec.variant === 'crow')) return;
      var st = LAB.vfs.stat(path);
      if (!st || underTrash(path)) return;
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
      function teardown() {
        S.renaming = null;
        hideBubble();
        if (input.parentNode) input.parentNode.removeChild(input);
        rec.nameEl.style.display = '';
        rec.el.classList.remove('is-renaming');
        rec.cancelRename = null;
      }
      function finish(commit) {
        if (done) return;
        var val = input.value;
        if (commit && BAD_CHARS.test(val)) {      // Windows keeps the box open and explains
          showBubble();
          return;
        }
        done = true;
        teardown();
        if (commit) applyRename(path, val);
        else render();
      }
      function showBubble() {
        hideBubble();
        bubble = h('div', { class: 'fd-bubble', role: 'alert' }, '檔案名稱不可包含下列任何字元：', h('br'), '\\ / : * ? " < > |');
        rec.el.appendChild(bubble);
        bubbleTimer = setTimeout(hideBubble, 4000);
        input.focus();
      }
      rec.cancelRename = function () { finish(false); };
      input.addEventListener('keydown', function (e) {
        e.stopPropagation();
        if (LAB.ui.isImeEnter(e)) return;
        if (e.key === 'Enter') { e.preventDefault(); finish(true); }
        else if (e.key === 'Escape') { e.preventDefault(); finish(false); }
        else if (BAD_CHARS.test(e.key) && e.key.length === 1 && !e.ctrlKey && !e.metaKey) { e.preventDefault(); showBubble(); }
      });
      input.addEventListener('blur', function () {
        if (done) return;
        if (BAD_CHARS.test(input.value)) finish(false); else finish(true);
      });
      input.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
      input.addEventListener('dblclick', function (e) { e.stopPropagation(); });
    }
    function applyRename(oldPath, typed) {
      var st = LAB.vfs.stat(oldPath);
      if (!st) { render(); return; }
      var name = cleanName(typed);
      if (name === '' || name === st.name) { render(); return; }
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
          if (e.code === 'EEXIST') LAB.ui.alert(win, { title: st.type === 'dir' ? '重新命名資料夾' : '重新命名檔案', text: '已經有相同名稱的檔案或資料夾存在。請指定其他名稱。', buttons: [{ label: '確定', value: true, 'default': true }] });
          else if (e.code === 'ENAMETOOLONG') LAB.ui.toast('這個名稱太長了');
          else if (e.code === 'EPROTECTED') LAB.ui.vfsFail(win, e, '', oldPath);
          else LAB.ui.toast('這個名稱不能用');
        }
      }
      if (oldExt && newExt.toLowerCase() !== oldExt.toLowerCase()) {
        LAB.ui.alert(win, {
          title: '重新命名',
          text: '如果您變更檔案名稱的副檔名，檔案可能會無法使用。您確定要變更嗎？',
          buttons: [
            { label: '否', value: 'keep', cancel: true },
            { label: '是', value: 'use', 'default': true }
          ]
        }).then(function (v) {
          if (v === 'use') commit(name);
          else commit(name.slice(0, name.length - newExt.length) + oldExt);
        });
        return;
      }
      commit(name);
    }

    /* ---------- pointer wiring ---------- */
    backBtn.addEventListener('click', goBack);
    fwdBtn.addEventListener('click', goForward);
    upBtn.addEventListener('click', goUp);
    refreshBtn.addEventListener('click', function (e) { e.stopPropagation(); refresh(); });
    viewListBtn.addEventListener('click', function () { setMode('list'); });
    viewIconBtn.addEventListener('click', function () { setMode('icon'); });
    /* the green bar that sweeps across the address bar while a search runs (the results themselves are already there: the practice PC searches at once) */
    function sweepProgress() {
      progEl.classList.remove('is-run');
      if (!S.filter) return;
      void progEl.offsetWidth;                       // restart the animation
      progEl.classList.add('is-run');
    }
    progEl.addEventListener('animationend', function () { progEl.classList.remove('is-run'); });
    searchIn.addEventListener('input', function () {
      S.filter = searchIn.value.trim().toLowerCase();
      render();
      updateChrome();
      sweepProgress();
    });
    searchIn.addEventListener('keydown', function (e) {
      if (LAB.ui.isImeEnter(e)) return;
      if (e.key === 'Escape') {
        e.stopPropagation();
        if (searchIn.value) { searchIn.value = ''; S.filter = ''; render(); updateChrome(); e.preventDefault(); }
        else searchIn.blur();
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
      if (t.closest && (t.closest('.fd-item') || t.closest('.fd-listhead') || t.closest('.fd-sec-h') || t.closest('input'))) return;
      // the thin scrollbar belongs to the scroller, not to the "empty area"
      var p = tx(e), r = LAB.stage.rectOf(scrollEl);
      if (p.x - r.x > scrollEl.clientWidth || p.y - r.y > scrollEl.clientHeight) return;
      var additive = e.metaKey || e.ctrlKey || e.shiftKey;
      if (!additive) setSel([]);
      if ((isGridKey() || hostKey.indexOf('list:') === 0) && host) startRubber(e, additive);
    });

    function startRubber(e0, additive) {
      var pid = e0.pointerId;
      var base = additive ? new Set(S.sel) : new Set();
      var s0 = tx(e0);
      var g0 = LAB.stage.rectOf(host);
      var sx = s0.x - g0.x, sy = s0.y - g0.y;        // start in host (content) coordinates
      var band = null;
      function recompute(ev) {
        var p = tx(ev);
        var g = LAB.stage.rectOf(host);
        var cx = p.x - g.x, cy = p.y - g.y;
        if (!band) {
          if (Math.abs(cx - sx) < 4 && Math.abs(cy - sy) < 4) return;
          band = h('div', { class: 'fd-rubber' });
          host.appendChild(band);
        }
        var x = Math.min(sx, cx), y = Math.min(sy, cy), w = Math.abs(cx - sx), hh = Math.abs(cy - sy);
        band.style.left = x + 'px'; band.style.top = y + 'px'; band.style.width = w + 'px'; band.style.height = hh + 'px';
        var hit = new Set(base);
        items.forEach(function (rec, path) {
          var el = rec.el;
          var ix = el.offsetLeft + 6, iy = el.offsetTop + 3, iw = el.offsetWidth - 12, ih = el.offsetHeight - 6;
          if (ix < x + w && ix + iw > x && iy < y + hh && iy + ih > y) hit.add(path);
        });
        setSel(Array.from(hit));
      }
      function move(ev) {
        if (ev.pointerId !== pid) return;
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
    /* how the arrow keys move: 'list' (up / down), 'rowgrid' (icons, tiles: rows first), 'colflow' (清單: columns first, so ↑↓ step 1 and ←→ jump a column) */
    function navKind() {
      if (!isGridKey()) return 'list';
      if (S.mode === 'plist') return 'colflow';
      if (S.mode === 'content') return 'list';
      return 'rowgrid';
    }
    function cols() {
      if (navKind() !== 'rowgrid' || !host || !host.children.length) return 1;
      var its = host.querySelectorAll(':scope > .fd-item');
      if (!its.length) return 1;
      var top = its[0].offsetTop, n = 0;
      for (var i = 0; i < its.length; i++) { if (its[i].offsetTop === top) n++; else break; }
      return Math.max(1, n);
    }
    function moveSel(dir, extend) {
      var order = S.order;
      if (!order.length) return;
      var cur = null;
      var sel = orderedSel();
      if (sel.length) cur = (S.anchor && S.sel.has(S.anchor) && !extend) ? S.anchor : sel[sel.length - 1];
      var idx = cur === null ? -1 : order.indexOf(cur);
      var next, nk = navKind();
      if (idx < 0) next = (dir === 'down' || dir === 'right') ? 0 : order.length - 1;
      else if (nk === 'rowgrid') {
        var c = cols();
        next = idx + (dir === 'left' ? -1 : dir === 'right' ? 1 : dir === 'up' ? -c : c);
      } else if (nk === 'colflow') {
        var rws = parseInt(host.style.getPropertyValue('--rows'), 10) || 10;
        next = idx + (dir === 'left' ? -rws : dir === 'right' ? rws : dir === 'up' ? -1 : 1);
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
    function jumpTo(i, extend) {
      if (!S.order.length) return;
      var np = S.order[Math.max(0, Math.min(S.order.length - 1, i))];
      if (extend) { if (!S.anchor || !S.sel.has(S.anchor)) S.anchor = np; selectRange(np); }
      else { S.anchor = np; setSel([np]); }
      var rec = items.get(np);
      if (rec) ensureVisible(rec.el);
    }
    function blocked() { return !!(S.renaming || S.sheet || S.addrEditing || (LAB.keys.hasModal && LAB.keys.hasModal())); }     // a dialog or a menu is open: the window's keys wait
    var keyQueue = [];
    function key(spec, fn) { keyQueue.push([spec, fn]); }
    function installKey(spec, fn) {
      win.own(LAB.keys.on(spec, function (e) {
        if (!win.isFocused() || blocked()) return false;
        var ae = document.activeElement;
        if (ae && ae !== document.body && (ae.closest('.fd-nav') || ae.closest('.fd-cmd') || ae.closest('.fd-addr') || ae.closest('.fd-tabs')) && /^(enter|space)$/.test(String(spec))) return false;
        return fn(e);
      }, { scope: 'finder' }));
    }
    key('enter', function () { if (!S.sel.size) return false; openSelection(); });
    key('mod+a', function () { setSel(S.order.slice()); S.anchor = S.order[0] || null; });
    key('mod+c', function () { if (!S.sel.size) return false; copySel(); });
    key('mod+x', function () { if (!S.sel.size || !realDir()) return false; cutSel(); });
    key('mod+v', function () { if (!(LAB.clipboard.paths || []).length) return false; paste(); });
    key('mod+shift+c', function () { if (!S.sel.size) return false; copyAsPath(orderedSel()); });
    key('delete', function () { if (!S.sel.size) return false; trashSel(); });
    key('shift+delete', function () {
      if (inZip()) { LAB.ui.toast('練習版：壓縮的 (zipped) 資料夾是唯讀的，裡面的檔案不能刪除'); return; }
      var ps = orderedSel().filter(function (p) { return !underTrash(p); });
      if (!ps.length) { if (S.sel.size) { deleteForever(orderedSel()); return; } return false; }
      LAB.ui.confirm(win, { title: ps.length > 1 ? '要永久刪除這 ' + ps.length + ' 個項目嗎？' : '要永久刪除這個項目嗎？', ok: '是', cancel: '否' }).then(function (ok) {
        if (!ok) return;
        ps.forEach(function (p) { try { LAB.vfs.remove(p, { by: 'finder', recursive: true, force: true }); } catch (e) { LAB.ui.vfsFail(win, e, '無法刪除', p); } });
        setSel([]); render();
      });
    });
    key('mod+shift+n', function () { newFolder(); });
    key('mod+t', function () { newTab(V_HOME); });
    key('mod+w', function () { closeTab(tabIdx); });
    key('mod+l', function () { editAddress(); });
    key('alt+d', function () { editAddress(); });
    key('mod+e', function () { searchIn.focus(); searchIn.select(); });
    key('mod+f', function () { searchIn.focus(); searchIn.select(); });
    key('alt+arrowleft', function () { goBack(); });
    key('alt+arrowright', function () { goForward(); });
    key('alt+arrowup', function () { goUp(); });
    key('backspace', function () { goBack(); });
    MODE_ORDER.forEach(function (m) { key('mod+shift+' + MODES[m].key, function () { setMode(m); }); });
    key('alt+p', function () { setPane('preview'); });
    key('alt+shift+p', function () { setPane('details'); });
    key('alt+enter', function () { var s = orderedSel(); if (s.length) showProps(s); else if (realDir()) showProps([S.path]); else return false; });
    key('mod+shift+tab', function () { if (tabs.length > 1) switchTab((tabIdx - 1 + tabs.length) % tabs.length); else return false; });
    key('mod+tab', function () { if (tabs.length > 1) switchTab((tabIdx + 1) % tabs.length); else return false; });
    key('arrowup', function (e) { moveSel('up', e.shiftKey); });
    key('arrowdown', function (e) { moveSel('down', e.shiftKey); });
    key('arrowleft', function (e) { if (navKind() === 'list' && hostKey !== 'home' && hostKey !== 'pc') return false; moveSel('left', e.shiftKey); });
    key('arrowright', function (e) { if (navKind() === 'list' && hostKey !== 'home' && hostKey !== 'pc') return false; moveSel('right', e.shiftKey); });
    key('shift+arrowup', function () { moveSel('up', true); });
    key('shift+arrowdown', function () { moveSel('down', true); });
    key('shift+arrowleft', function () { if (navKind() === 'list') return false; moveSel('left', true); });
    key('shift+arrowright', function () { if (navKind() === 'list') return false; moveSel('right', true); });
    key('home', function () { jumpTo(0, false); });
    key('end', function () { jumpTo(S.order.length - 1, false); });
    key('shift+home', function () { jumpTo(0, true); });
    key('shift+end', function () { jumpTo(S.order.length - 1, true); });

    /* F2 (rename) and type-ahead: F-keys never reach the router (ui.js leaves them to the browser), so this window listens itself */
    var taBuf = '', taTimer = null;
    function onRawKey(e) {
      if (!win || !win.isFocused() || blocked()) return;
      if (LAB.keys.hasModal && LAB.keys.hasModal()) return;
      var t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (LAB.ui.isImeEnter(e)) return;
      if (e.key === 'F2') {
        var s = orderedSel();
        if (s.length === 1 && realDir()) { e.preventDefault(); startRename(s[0]); }
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey || !e.key || e.key.length !== 1 || e.key === ' ') return;
      taBuf += e.key.toLowerCase();
      clearTimeout(taTimer);
      taTimer = setTimeout(function () { taBuf = ''; }, 800);
      var start = 0;
      var cur = orderedSel();
      var same = taBuf.length > 1 && taBuf.split('').every(function (c) { return c === taBuf.charAt(0); });
      var q = same ? taBuf.charAt(0) : taBuf;
      if (cur.length && (taBuf.length === 1 || same)) start = S.order.indexOf(cur[cur.length - 1]) + 1;
      for (var k = 0; k < S.order.length; k++) {
        var p = S.order[(start + k) % S.order.length];
        var rec = items.get(p);
        var nm = rec ? labelOf(rec.st).toLowerCase() : '';
        if (nm.indexOf(q) === 0) { S.anchor = p; setSel([p]); if (rec) ensureVisible(rec.el); break; }
      }
    }
    window.addEventListener('keydown', onRawKey, true);

    /* ---------- adapt to the window width ---------- */
    function fit() {
      var w = root.clientWidth || 0;
      root.classList.toggle('is-narrow', w > 0 && w < 760);
      root.classList.toggle('is-tiny', w > 0 && w < 620);
      layoutCrumbs();
      layoutGrid();
    }

    /* ---------- the window ---------- */
    win = LAB.wm.open({
      appId: 'finder', title: dname(startPath) + ' - 檔案總管', width: 920, height: 580, minW: 520, minH: 340,
      titlebar: 'custom', titlebarHeight: 40, captionHeight: 32, titlebarContent: tabsEl, theme: 'light', content: root, icon: 'app-finder'
    });
    win.state.path = startPath;
    keyQueue.forEach(function (k) { installKey(k[0], k[1]); });
    var inst = {
      win: win, S: S, navigate: navigate, render: render, setSel: setSel, startRename: startRename, newFolder: newFolder, newTextFile: newTextFile,
      openSelection: openSelection, trashSel: trashSel, copySel: copySel, cutSel: cutSel, paste: paste, putBackSel: putBackSel,
      goBack: goBack, goForward: goForward, goUp: goUp, setMode: setMode, orderedSel: orderedSel, copyAsPath: copyAsPath,
      realDir: realDir, items: items, scrollEl: scrollEl, searchInput: searchIn, markCut: markCut, editAddress: editAddress,
      newTab: newTab, closeTab: closeTab, switchTab: switchTab, tabCount: function () { return tabs.length; },
      toggleHidden: function () { S.showHidden = !S.showHidden; render(); },
      open: function (p) { return openItem(p); },
      refreshNav: function () { buildNav(true); if (S.path === V_HOME) render(); updateNavCur(); },
      setPane: setPane, setColumns: setColumns, setGroup: setGroup, sortBy: sortBy, compressSel: compressSel, showProps: showProps, extractSelected: extractSelected
    };
    instances.set(win.id, inst);
    win.own(function () {
      disposed = true;
      if (renderTimer) { clearTimeout(renderTimer); renderTimer = null; }
      if (S.sheet) S.sheet.close(true);
      window.removeEventListener('keydown', onRawKey, true);
      clearTimeout(taTimer);
      clearItems();
      pathTargets.forEach(function (f) { f(); });
      pathTargets = [];
      navOffs.forEach(function (f) { try { f(); } catch (e) { /* ignore */ } });
      navOffs = [];
      instances.delete(win.id);
    });

    // live updates
    win.own(LAB.bus.on('fs:change', scheduleRender));
    win.own(LAB.bus.on('dnd:drop', function () { if (pendingFlush) { pendingFlush = false; scheduleRender(); } }));
    win.own(LAB.bus.on('dnd:cancel', function () { if (pendingFlush) { pendingFlush = false; scheduleRender(); } }));
    win.own(win.on('resize', fit));
    if (window.ResizeObserver) {
      try { var ro = new ResizeObserver(function () { fit(); }); ro.observe(root); win.own(function () { ro.disconnect(); }); } catch (e) { /* ignore */ }
    }

    function scheduleRender() {
      if (disposed || renderTimer) return;
      renderTimer = setTimeout(function () {
        renderTimer = null;
        if (LAB.dnd.active()) { pendingFlush = true; return; }
        render();
        updateChrome();
      }, 100);
    }

    // drop target: the view (current folder)
    win.own(LAB.dnd.target(scrollEl, {
      id: 'finder:' + win.id + ':view',
      accept: function (pl, mods) { return acceptInto(pl, S.path === V_TRASH ? V_TRASH : S.path, mods); },
      enter: function () { scrollEl.classList.add('is-drop'); },
      leave: function () { scrollEl.classList.remove('is-drop'); },
      drop: function (pl, ctx) { scrollEl.classList.remove('is-drop'); transferInto(pl.paths, S.path, ctx.mode === 'copy' ? 'copy' : 'move'); }
    }));

    buildNav(true);
    render();
    S.pendingSel = null;
    updateChrome();
    fit();
    LAB.bus.emit('finder:navigate', { winId: win.id, path: startPath, via: via || 'initial' });
    return inst;
  }

  /* ========================================================= app + public API */
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

  /* where a new window starts: 首頁 (like the taskbar button of the real File Explorer), or the folder asked for (a file -> its folder) */
  function normPath(path, zipOk) {
    if (path === undefined || path === null || path === '') return V_HOME;
    if (path === V_HOME || path === V_PC || path === V_TRASH) return path;
    if (isVirt(path)) return V_HOME;
    var p = LAB.vfs.canon(path);
    if (LAB.vfs.same(p, TRASH)) return V_TRASH;
    if (LAB.vfs.isDir(p)) return p;
    if (zipOk !== false && zipLocOf(p) && validLoc(p)) return p;       // a .zip (or a folder inside one) is a place to stand in
    while (p !== '/' && !LAB.vfs.isDir(p)) p = LAB.vfs.dirname(p);
    return LAB.vfs.isDir(p) ? p : V_HOME;
  }

  function open(args) {
    args = args || {};
    var path = normPath(args.path, args.reveal !== true);
    if (!args.fresh && (args.reuse || args.via === 'dock')) {
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

  function frontFinderWin() { var f = LAB.wm.focused(); return f && f.appId === 'finder' && instances.has(f.id) ? f : null; }
  LAB.finder = {
    open: open,                      // open({path, via, reuse, select, fresh, reveal}): a .zip path (or a folder inside a zip) opens INSIDE the zip, unless reveal:true
    reveal: reveal,
    windows: windows,
    state: function (winId) {
      var inst = instances.get(winId);
      if (!inst) return null;
      var S = inst.S;
      return {
        path: S.path, mode: S.mode, sel: inst.orderedSel(), order: S.order.slice(), hist: S.hist.slice(), hi: S.hi, filter: S.filter, showHidden: S.showHidden, tabs: inst.tabCount(),
        pane: S.pane, cols: S.colsSel.slice(), sort: { key: S.sort.key, dir: S.sort.dir }, group: S.group, zip: kindOfPath(S.path) === 'zip'
      };
    },
    /* ---- round 5: zip folders, the extraction wizard, compressing, properties (other apps call these) ---- */
    openZip: function (zipPath, o) {                   // browse INTO a zip like a folder; o = {inner:'week3', via, fresh}
      o = o || {};
      var p = LAB.vfs.canon(zipPath);
      var loc = o.inner ? p + '/' + String(o.inner).replace(/^\/+|\/+$/g, '') : p;
      if (!zipLocOf(loc) || !validLoc(loc)) { LAB.ui.toast('這個壓縮的 (zipped) 資料夾無效，打不開'); return null; }
      return open({ path: loc, via: o.via || 'open', fresh: !!o.fresh, reuse: !o.fresh });
    },
    extractAll: function (zipPath, o) {                // the 解壓縮 wizard (asks for the destination); o = {win, dest, show}; resolves {ok, dest, …} or null when cancelled
      o = o || {};
      return extractWizard(LAB.vfs.canon(zipPath), o.win || frontFinderWin(), o);
    },
    extractTo: function (zipPath, destDir) { return doExtract(LAB.vfs.canon(zipPath), destDir); },      // no dialogs: {ok, dest, target, created}
    compress: function (paths, o) { return compressPaths(paths, o); },            // 壓縮成 ZIP 檔案 without a window: {ok, path, entries} or null
    properties: function (paths, o) { return openProps(paths, (o && o.win) || frontFinderWin()); },     // the 內容 dialog
    isZipLocation: function (p) { return !!zipLocOf(LAB.vfs.canon(p)); }
  };

  LAB.apps.register('finder', {
    title: '檔案總管', en: 'File Explorer', aliases: ['finder', 'explorer', 'file explorer', '檔案總管', '檔案', '資料夾'], icon: 'app-finder', dock: true,
    open: open,
    newWindow: function () {
      var f = activeInst();
      return open({ path: f ? f.S.path : undefined, fresh: true });
    },
    canHandle: function (p) { return isVirt(p) || !!LAB.vfs.stat(p); },
    handleOpen: function (p, o) {
      var via = (o && o.via) || 'open';
      if (isVirt(p)) { open({ path: p, via: via, reuse: true }); return true; }
      var st = LAB.vfs.stat(p);
      if (!st) return false;
      if (st.type === 'dir') {
        var np = normPath(st.path);
        var ex = findAt(np);
        if (ex) {
          ex.win.focus();
          LAB.bus.emit('finder:navigate', { winId: ex.win.id, path: np, via: 'open' });
        } else createFinder(np, normVia(via, 'open'), {});
        return true;
      }
      if (st.kind === 'zip') {                             // a zip opens like a folder
        var zp = normPath(st.path);
        var exz = findAt(zp);
        if (exz) {
          exz.win.focus();
          LAB.bus.emit('finder:navigate', { winId: exz.win.id, path: zp, via: 'open' });
        } else createFinder(zp, normVia(via, 'open'), {});
        return true;
      }
      reveal(st.path);
      return true;
    },
    canOpen: function (st) { return st.type === 'dir' ? 10 : (st.kind === 'zip' ? 5 : 0); }
  });
})(window.LAB);
