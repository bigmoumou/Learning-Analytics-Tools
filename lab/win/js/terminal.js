/* terminal.js [SKIN] — 終端機 on the practice Windows PC (DESIGN W5): Windows Terminal running Windows PowerShell 5.1 (zh-TW).
   Part A: LAB.shell — a PowerShell emulation, pure over session.vfs (lexer, parser, parameter binding, the red error records,
           commands, Tab completion). No DOM in here, so it can be unit-tested against a scratch VFS made with LAB.vfs.create(json).
   Part B: the Windows Terminal window (tab strip as title bar, cell-grid renderer, PSReadLine-style line editor, IME, drag and drop).
   Ground truth: win-facts.md §2–§6. Everything the facts do not show (error texts of cd/ls/mkdir/rm/cp/Rename-Item/parameter errors,
   `ls -l`, the `&&` parse error, tar.exe messages, Get-History and Get-Date layouts) was captured from a real Windows PowerShell 5.1
   with the zh-TW UI culture while writing this file; see notes/TERMINAL.md. */
(function (LAB) {
  'use strict';

  var h = LAB.util.h;
  var charWidth = LAB.util.charWidth;
  var displayWidth = LAB.util.displayWidth;
  var HOME = LAB.vfs.HOME;
  var hasOwn = Object.prototype.hasOwnProperty;
  var HOST = 'AN-LAPTOP', USER = 'an';
  /* Real Windows PowerShell 5.1 keeps the case the student TYPED in the prompt and in `目錄:` (cd c:\USERS shows PS C:\USERS>),
     while the names listed by ls are always the stored spelling. Set to false to show the stored spelling everywhere. */
  var KEEP_TYPED_CASE = true;
  var NS = 'Microsoft.PowerShell.Commands.';

  /* =====================================================================
     PART A — LAB.shell (PowerShell 5.1, zh-TW)
     ===================================================================== */

  /* ------------------------------------------------------------ small helpers */
  function spaces(n) { return n > 0 ? new Array(Math.floor(n) + 1).join(' ') : ''; }
  function padL(s, n) { s = String(s); return spaces(n - displayWidth(s)) + s; }
  function padR(s, n) { s = String(s); return s + spaces(n - displayWidth(s)); }
  function two(n) { return n < 10 ? '0' + n : String(n); }
  function fold(s) { return String(s).normalize('NFC').toLowerCase(); }
  function upper(s) { return String(s).normalize('NFC').toUpperCase(); }
  /* NTFS order: compare the upper-cased code units (so digits < letters and `_` after the capitals) */
  function ntfsCmp(a, b) { var x = upper(a), y = upper(b); return x < y ? -1 : x > y ? 1 : 0; }
  function reEsc(s) { return s.replace(/[\\^$.*+?()[\]{}|\/-]/g, '\\$&'); }

  /* a string cut into rows of at most `width` columns (CJK = 2, marks = 0); the first row may have its own width */
  function wrapCells(text, width, firstWidth) {
    var rows = [], row = '', col = 0, lim = firstWidth || width;
    for (var ch of String(text)) {
      var w = charWidth(ch.codePointAt(0));
      if (w && col + w > lim && col > 0) { rows.push(row); row = ''; col = 0; lim = width; }
      row += ch; col += w;
    }
    rows.push(row);
    return rows;
  }

  /* ['2026/10/2', '上午 09:47'] */
  function dateParts(ms) {
    if (LAB.win && LAB.win.dateParts) return LAB.win.dateParts(ms);
    var d = new Date(ms), hh = d.getHours(), h12 = hh % 12 === 0 ? 12 : hh % 12;
    return [d.getFullYear() + '/' + (d.getMonth() + 1) + '/' + d.getDate(), (hh < 12 ? '上午' : '下午') + ' ' + two(h12) + ':' + two(d.getMinutes())];
  }
  var RO_DIRS = { contacts: 1, desktop: 1, documents: 1, downloads: 1, favorites: 1, links: 1, music: 1, onedrive: 1, pictures: 1, 'saved games': 1, searches: 1, videos: 1 };
  /* Get-ChildItem Mode column: 'd-r---' for the 12 standard folders of the home folder, 'd-----' other folders, '-a----' files */
  function modeOf(st) {
    if (LAB.win && LAB.win.mode) return LAB.win.mode(st);
    if (st.type !== 'dir') return '-a----';
    var p = st.path || '', i = p.lastIndexOf('/');
    return i > 0 && fold(p.slice(0, i)) === fold(HOME) && RO_DIRS[fold(p.slice(i + 1))] ? 'd-r---' : 'd-----';
  }
  /* the practice PC's own leftovers that real Windows does not show (the backing folder of 資源回收筒) */
  function isTrash(st) { return st.name === '.Trash'; }

  /* ------------------------------------------------------------ paths: typed text -> internal path + the Windows text to show */
  function splitSegs(abs) { return String(abs).split('/').filter(function (x) { return x.length; }); }
  function winOfSegs(segs) { return 'C:\\' + segs.join('\\'); }
  function hasWild(s) { return /[*?\[]/.test(s); }
  function joinDisp(dir, name) { return dir.charAt(dir.length - 1) === '\\' ? dir + name : dir + '\\' + name; }
  function childName(vfs, parentAbs, name) { var st = vfs.stat(vfs.join(parentAbs, name)); return st ? st.name : null; }

  /* keep session.shown (the display segments of the cwd) in step with the real folder names */
  function syncShown(session) {
    var segs = splitSegs(session.cwd);
    if (!session.shown || session.shown.length !== segs.length) session.shown = segs.slice();
    return session.shown;
  }
  function dispCwd(session) {
    syncShown(session);
    return winOfSegs(KEEP_TYPED_CASE ? session.shown : splitSegs(session.cwd));
  }
  function setCwd(session, r) {
    session.cwd = r.abs;
    session.shown = (KEEP_TYPED_CASE ? r.shown : r.segs).slice();
    session.env.PWD = r.abs;
  }

  /* resolvePath(session, typed) -> {abs, disp, segs, shown, raw} | {err:'drive'|'unc', ...}
     Windows rules: / and \ both work, case-insensitive, ~ and ~\x are the home folder, C: and C:\x, \x is the drive root,
     C:x is relative to the current folder, trailing separators are ignored. Names that do not exist keep the typed spelling. */
  function resolvePath(session, typed) {
    var vfs = session.vfs;
    var raw = String(typed);
    var s = raw.replace(/\//g, '\\');
    var rest = s, base = 'cwd';
    var m = /^([A-Za-z]):(.*)$/.exec(s);
    if (m) {
      if (m[1].toUpperCase() !== 'C') return { err: 'drive', drive: m[1], disp: raw, raw: raw };
      rest = m[2];
      base = rest.charAt(0) === '\\' ? 'root' : 'cwd';
    } else if (s.indexOf('\\\\') === 0) {
      return { err: 'unc', disp: raw, raw: raw };
    } else if (s.charAt(0) === '\\') {
      base = 'root';
    } else if (s === '~' || s.indexOf('~\\') === 0) {
      base = 'home'; rest = s.slice(1);
    }
    var segs, shown;
    if (base === 'root') { segs = []; shown = []; }
    else if (base === 'home') { segs = splitSegs(vfs.canon(HOME)); shown = segs.slice(); }
    else { segs = splitSegs(session.cwd); shown = syncShown(session).slice(); }
    rest.split('\\').forEach(function (p) {
      if (p === '' || p === '.') return;
      if (p === '..') { segs.pop(); shown.pop(); return; }
      var parent = '/' + segs.join('/');
      var real = hasWild(p) ? null : childName(vfs, parent, p);
      segs.push(real || p);
      shown.push(p);
    });
    var shownOut = KEEP_TYPED_CASE ? shown : segs.slice();
    return { abs: '/' + segs.join('/'), segs: segs, shown: shownOut, disp: winOfSegs(shownOut), raw: raw };
  }

  function wildRegex(pat) {
    var re = '^', i = 0;
    while (i < pat.length) {
      var c = pat.charAt(i);
      if (c === '*') re += '[\\s\\S]*';
      else if (c === '?') re += '[\\s\\S]';
      else if (c === '[') {
        var j = pat.indexOf(']', i + 2);
        if (j < 0) re += '\\[';
        else { re += '[' + pat.slice(i + 1, j).replace(/\\/g, '\\\\') + ']'; i = j; }
      } else re += reEsc(c);
      i++;
    }
    return new RegExp(re + '$', 'i');
  }

  /* expandPath(session, typed, literal) -> {items:[{abs,disp,st}], miss:null|{disp,kind}, wild:bool}
     A wildcard in the last segment lists the matching names of that folder (no match = no items, and no error for ls). */
  function expandPath(session, typed, literal) {
    var vfs = session.vfs;
    var raw = String(typed);
    var norm = raw.replace(/\//g, '\\');
    var li = norm.lastIndexOf('\\');
    var last = li < 0 ? norm : norm.slice(li + 1);
    if (!literal && hasWild(last)) {
      var dirTyped = li < 0 ? '.' : norm.slice(0, li + 1);
      var dr = resolvePath(session, dirTyped);
      if (dr.err) return { items: [], miss: { disp: dr.disp, kind: dr.err, drive: dr.drive }, wild: true };
      var dst = vfs.stat(dr.abs);
      if (!dst || dst.type !== 'dir') return { items: [], miss: { disp: joinDisp(dr.disp, last), kind: 'path' }, wild: true };
      var re = wildRegex(last), items = [];
      vfs.list(dr.abs).forEach(function (st) {
        if (isTrash(st) || !re.test(st.name)) return;
        items.push({ abs: st.path, disp: joinDisp(dr.disp, st.name), st: st });
      });
      items.sort(function (a, b) { return (a.st.type === b.st.type ? 0 : a.st.type === 'dir' ? -1 : 1) || ntfsCmp(a.st.name, b.st.name); });
      return { items: items, miss: null, wild: true, none: !items.length, disp: joinDisp(dr.disp, last) };
    }
    var r = resolvePath(session, raw);
    if (r.err) return { items: [], miss: { disp: r.disp, kind: r.err, drive: r.drive }, wild: false };
    var st = vfs.stat(r.abs);
    if (!st || isTrash(st)) return { items: [], miss: { disp: r.disp, kind: 'path' }, wild: false, resolved: r };
    return { items: [{ abs: st.path, disp: r.disp, st: st }], miss: null, wild: false, resolved: r };
  }

  /* ------------------------------------------------------------ error records (the red text) */
  function ellipsize(s) { s = String(s); return s.length > 40 ? s.slice(0, 15) + '...' + s.slice(-15) : s; }
  /* the physical line of the source that holds index `at`, and the 1-based line number and column */
  function linePos(src, at) {
    var before = src.slice(0, at), nl = before.lastIndexOf('\n');
    var lineNo = before.split('\n').length;
    var start = nl + 1, end = src.indexOf('\n', at);
    if (end < 0) end = src.length;
    return { line: lineNo, col: at - start + 1, text: src.slice(start, end) };
  }
  /* errorText(o, cols) -> the lines PowerShell prints for one ErrorRecord (without the trailing newline of the last line).
     o: {head, msg, src, start, len, cat, target, ttype, activity, reason, fq, parse, noPos} ; wraps at the window width − 2 like the real console:
     the message wraps without an indent, CategoryInfo / FullyQualifiedErrorId wrap with a 3-space indent (win-facts §5). */
  function errorText(o, cols) {
    var width = Math.max(20, (cols || 120) - 2);
    var lines = [];
    function pushMsg(text) { String(text).split('\n').forEach(function (part) { wrapCells(part, width).forEach(function (r) { lines.push(r); }); }); }
    function pushHang(text) { wrapCells(text, width - 3, width).forEach(function (r, i) { lines.push(i ? '   ' + r : r); }); }
    if (!o.parse) pushMsg((o.head ? o.head + ' : ' : '') + o.msg);
    if (o.src !== undefined && !o.noPos) {
      var pos = linePos(o.src, o.start || 0);
      lines.push('位於 線路:' + pos.line + ' 字元:' + pos.col);
      lines.push('+ ' + pos.text);
      var len = Math.max(1, Math.min(o.len || 1, pos.text.length - pos.col + 1));
      lines.push('+ ' + spaces(pos.col - 1) + new Array(len + 1).join('~'));
    }
    if (o.parse) pushMsg(o.msg);
    var cat = o.parse ? 'ParserError' : (o.cat || 'NotSpecified');
    var sep = (cat === 'InvalidArgument' || cat === 'InvalidOperation') ? '，' : ', ';
    var target = o.parse ? '' : (o.target || '');
    var info = cat + ': (' + ellipsize(target) + ':' + (target ? (o.ttype || 'String') : '') + ') [' + ellipsize(o.parse ? '' : (o.activity || '')) + ']' + sep + ellipsize(o.parse ? 'ParentContainsErrorRecordException' : (o.reason || ''));
    pushHang('    + CategoryInfo          : ' + info);
    pushHang('    + FullyQualifiedErrorId : ' + (o.parse ? o.fq : o.fq));
    lines.push('');
    return lines.join('\n') + '\n';
  }

  /* =====================================================================
     A2 — values of the object pipeline (round 5): PSObj / PSHash / dates / blocks, conversions, operators, members, methods.
     The model is deliberately small: JS null, boolean, number, string, array, and the few object kinds below.
     ===================================================================== */
  var T_CUSTOM = 'System.Management.Automation.PSCustomObject';

  /* PSObj: a typed bag of ordered properties. `o` adds hidden members: fmt (default view name), str (ToString), file (a File Explorer item) */
  function PSObj(type, pairs, o) {
    this.psobj = true;
    this.type = type || T_CUSTOM;
    this.p = [];
    if (pairs) for (var i = 0; i < pairs.length; i++) this.p.push({ n: pairs[i][0], v: pairs[i][1] });
    if (o) for (var k in o) if (hasOwn.call(o, k)) this[k] = o[k];
  }
  PSObj.prototype.find = function (name) {
    var l = String(name).toLowerCase();
    for (var i = 0; i < this.p.length; i++) if (this.p[i].n.toLowerCase() === l) return this.p[i];
    return null;
  };
  PSObj.prototype.get = function (name) { var e = this.find(name); return e ? e.v : undefined; };
  PSObj.prototype.set = function (name, v) { var e = this.find(name); if (e) e.v = v; else this.p.push({ n: name, v: v }); };
  PSObj.prototype.names = function () { return this.p.map(function (e) { return e.n; }); };
  function isObj(v) { return v instanceof PSObj; }
  function mkObj(pairs, type, o) { return new PSObj(type || T_CUSTOM, pairs, o); }

  /* PSHash: an ordered hashtable with case-insensitive string keys */
  function PSHash(pairs, ordered) {
    this.pshash = true; this.keys = []; this.m = Object.create(null); this.ordered = !!ordered;
    if (pairs) for (var i = 0; i < pairs.length; i++) this.set(pairs[i][0], pairs[i][1]);
  }
  PSHash.prototype.set = function (k, v) { var lc = String(k).toLowerCase(); if (!(lc in this.m)) this.keys.push(k); this.m[lc] = v; };
  PSHash.prototype.has = function (k) { return String(k).toLowerCase() in this.m; };
  PSHash.prototype.get = function (k) { var lc = String(k).toLowerCase(); return lc in this.m ? this.m[lc] : null; };
  PSHash.prototype.del = function (k) {
    var lc = String(k).toLowerCase();
    if (!(lc in this.m)) return;
    delete this.m[lc];
    this.keys = this.keys.filter(function (x) { return String(x).toLowerCase() !== lc; });
  };
  function isHash(v) { return v instanceof PSHash; }

  function mkDate(ms) { return { psdate: true, ms: ms }; }
  function isDate(v) { return !!v && typeof v === 'object' && v.psdate === true; }
  function mkSpan(ms) { return { psspan: true, ms: ms }; }
  function isSpan(v) { return !!v && typeof v === 'object' && v.psspan === true; }
  function isBlock(v) { return !!v && typeof v === 'object' && v.psblock === true; }
  /* an error thrown by the evaluator: o is an errorText record (head msg cat target ttype activity reason fq start len) */
  function psErr(o) { var e = new Error(o.msg || 'ps error'); e.ps = o; return e; }
  function isPSError(e) { return !!e && !!e.ps; }

  /* ---- numbers */
  function numStr(n) {
    if (n === Infinity) return '∞';
    if (n === -Infinity) return '-∞';
    if (n !== n) return 'NaN';
    if (Math.floor(n) === n && Math.abs(n) < 1e15) return String(n === 0 ? 0 : n);
    var s = String(Number(n.toPrecision(15)));
    if (/e/.test(s)) s = s.replace(/e([+-])(\d+)/, function (m0, sg, d) { return 'E' + sg + (d.length < 2 ? '0' + d : d); });
    return s;
  }
  function commas(intStr) { return intStr.replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  /* .NET style fixed formatting with thousands separators: N2 -> 1,234.50 */
  function fmtN(n, dec, group) {
    var neg = n < 0, s = Math.abs(n).toFixed(dec), parts = s.split('.');
    return (neg && Number(s) !== 0 ? '-' : '') + (group ? commas(parts[0]) : parts[0]) + (parts[1] ? '.' + parts[1] : '');
  }

  /* ---- dates (zh-TW culture: yyyy/M/d, tt hh:mm:ss, 上午 / 下午) */
  var DAY_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var DAY_ZH = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  var DAY_ZH_S = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
  var MON_ZH = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
  var MON_ZH_S = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
  function dH12(d) { var h = d.getHours() % 12; return h === 0 ? 12 : h; }
  function dTT(d) { return d.getHours() < 12 ? '上午' : '下午'; }
  function dShortDate(d) { return d.getFullYear() + '/' + (d.getMonth() + 1) + '/' + d.getDate(); }
  function dLongDate(d) { return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日'; }
  function dShortTime(d) { return dTT(d) + ' ' + two(dH12(d)) + ':' + two(d.getMinutes()); }
  function dLongTime(d) { return dShortTime(d) + ':' + two(d.getSeconds()); }
  function tzOffsetStr() { return '+08:00'; }          // the practice PC is in Taipei
  /* DateTime.ToString(format): standard one-letter formats and custom patterns */
  function formatDate(ms, f) {
    var d = new Date(ms);
    f = f === undefined || f === null ? '' : String(f);
    if (f === '') return dShortDate(d) + ' ' + dLongTime(d);
    if (f.length === 1) {
      switch (f) {
        case 'd': return dShortDate(d);
        case 'D': return dLongDate(d);
        case 'f': return dLongDate(d) + ' ' + dShortTime(d);
        case 'F': return dLongDate(d) + ' ' + dLongTime(d);
        case 'g': return dShortDate(d) + ' ' + dShortTime(d);
        case 'G': return dShortDate(d) + ' ' + dLongTime(d);
        case 't': return dShortTime(d);
        case 'T': return dLongTime(d);
        case 'm': case 'M': return (d.getMonth() + 1) + '月' + d.getDate() + '日';
        case 'y': case 'Y': return d.getFullYear() + '年' + (d.getMonth() + 1) + '月';
        case 's': return d.getFullYear() + '-' + two(d.getMonth() + 1) + '-' + two(d.getDate()) + 'T' + two(d.getHours()) + ':' + two(d.getMinutes()) + ':' + two(d.getSeconds());
        case 'u': return d.getFullYear() + '-' + two(d.getMonth() + 1) + '-' + two(d.getDate()) + ' ' + two(d.getHours()) + ':' + two(d.getMinutes()) + ':' + two(d.getSeconds()) + 'Z';
        case 'o': case 'O': return d.getFullYear() + '-' + two(d.getMonth() + 1) + '-' + two(d.getDate()) + 'T' + two(d.getHours()) + ':' + two(d.getMinutes()) + ':' + two(d.getSeconds()) + '.' + String(1000 + d.getMilliseconds()).slice(1) + '0000' + tzOffsetStr();
        default: break;
      }
    }
    var out = '', i = 0;
    while (i < f.length) {
      var c = f.charAt(i), run = 1;
      if (c === "'" || c === '"') { var j = f.indexOf(c, i + 1); if (j < 0) j = f.length; out += f.slice(i + 1, j); i = j + 1; continue; }
      if (c === '\\') { out += f.charAt(i + 1); i += 2; continue; }
      while (f.charAt(i + run) === c) run++;
      switch (c) {
        case 'y': out += run >= 4 ? String(10000 + d.getFullYear()).slice(1) : (run === 3 ? String(d.getFullYear()) : (run === 2 ? two(d.getFullYear() % 100) : String(d.getFullYear() % 100))); break;
        case 'M': out += run >= 4 ? MON_ZH[d.getMonth()] : (run === 3 ? MON_ZH_S[d.getMonth()] : (run === 2 ? two(d.getMonth() + 1) : String(d.getMonth() + 1))); break;
        case 'd': out += run >= 4 ? DAY_ZH[d.getDay()] : (run === 3 ? DAY_ZH_S[d.getDay()] : (run === 2 ? two(d.getDate()) : String(d.getDate()))); break;
        case 'H': out += run >= 2 ? two(d.getHours()) : String(d.getHours()); break;
        case 'h': out += run >= 2 ? two(dH12(d)) : String(dH12(d)); break;
        case 'm': out += run >= 2 ? two(d.getMinutes()) : String(d.getMinutes()); break;
        case 's': out += run >= 2 ? two(d.getSeconds()) : String(d.getSeconds()); break;
        case 'f': out += String(1000 + d.getMilliseconds()).slice(1).slice(0, Math.min(run, 3)) + (run > 3 ? new Array(run - 2).join('0') : ''); break;
        case 't': out += run >= 2 ? dTT(d) : dTT(d).charAt(0); break;
        case 'z': out += run >= 3 ? tzOffsetStr() : (run === 2 ? '+08' : '+8'); break;
        case 'K': out += tzOffsetStr(); break;
        case '/': out += '/'; run = 1; break;
        case ':': out += ':'; run = 1; break;
        default: out += new Array(run + 1).join(c);
      }
      i += run;
    }
    return out;
  }
  /* Get-Date -UFormat (strftime style) */
  function ufmtDate(ms, f) {
    var d = new Date(ms);
    return String(f).replace(/%([A-Za-z%])/g, function (m0, c) {
      switch (c) {
        case 'Y': return String(d.getFullYear());
        case 'y': return two(d.getFullYear() % 100);
        case 'm': return two(d.getMonth() + 1);
        case 'd': return two(d.getDate());
        case 'e': return (d.getDate() < 10 ? ' ' : '') + d.getDate();
        case 'H': return two(d.getHours());
        case 'I': return two(dH12(d));
        case 'M': return two(d.getMinutes());
        case 'S': return two(d.getSeconds());
        case 'p': return d.getHours() < 12 ? 'AM' : 'PM';
        case 'A': return DAY_ZH[d.getDay()];
        case 'a': return DAY_ZH_S[d.getDay()];
        case 'B': return MON_ZH[d.getMonth()];
        case 'b': return MON_ZH_S[d.getMonth()];
        case 'j': { var s0 = new Date(d.getFullYear(), 0, 0); var dd = Math.floor((d - s0) / 86400000); return String(1000 + dd).slice(1); }
        case 'Z': return '+08';
        case 'F': return d.getFullYear() + '-' + two(d.getMonth() + 1) + '-' + two(d.getDate());
        case 'T': return two(d.getHours()) + ':' + two(d.getMinutes()) + ':' + two(d.getSeconds());
        case '%': return '%';
        default: return m0;
      }
    });
  }
  /* '2026-10-01', '2026/10/1 09:30', '2026/10/1 上午 09:30:00' ... -> ms or null */
  function parseDateStr(s) {
    s = String(s).trim();
    var m = /^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})(?:[T\s]+(?:(上午|下午)\s*)?(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(s);
    if (!m) {
      var m2 = /^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/.exec(s);
      if (m2) m = [null, m2[3], m2[1], m2[2]];
    }
    if (!m) return null;
    var hh = m[5] === undefined ? 0 : +m[5];
    if (m[4] === '下午' && hh < 12) hh += 12;
    if (m[4] === '上午' && hh === 12) hh = 0;
    var d = new Date(+m[1], +m[2] - 1, +m[3], hh, m[6] === undefined ? 0 : +m[6], m[7] === undefined ? 0 : +m[7], 0);
    return isFinite(d.getTime()) && d.getMonth() === +m[2] - 1 ? d.getTime() : null;
  }

  /* ---- strings of values */
  function objStr(o) {
    if (typeof o.str === 'function') return o.str(o);
    if (o.file) return CUR.session ? relPathText(CUR.session, o.file.disp) : o.file.disp;
    if (o.type === T_CUSTOM || o.custom) return '@{' + o.p.map(function (e) { return e.n + '=' + strOf(e.v); }).join('; ') + '}';
    return o.type;
  }
  function strOf(v) {
    if (v === null || v === undefined) return '';
    if (v === true) return 'True';
    if (v === false) return 'False';
    if (typeof v === 'number') return numStr(v);
    if (typeof v === 'string') return v;
    if (Array.isArray(v)) return v.map(strOf).join(' ');
    if (typeof v === 'object') {
      if (v.t === 'pathinfo') return v.path;
      if (v.psdate) return formatDate(v.ms, '');
      if (v.psobj) return objStr(v);
      if (v.pshash) return 'System.Collections.Hashtable';
      if (v.psblock) return v.src;
      if (v.psspan) return spanStr(v.ms);
      if (v.pstype) return v.pstype.name;
    }
    return String(v);
  }
  function spanStr(ms) {
    var neg = ms < 0, a = Math.abs(ms), d = Math.floor(a / 86400000), h = Math.floor(a / 3600000) % 24, m = Math.floor(a / 60000) % 60, s = Math.floor(a / 1000) % 60, f = Math.round(a % 1000);
    return (neg ? '-' : '') + (d ? d + '.' : '') + two(h) + ':' + two(m) + ':' + two(s) + (f ? '.' + String(1000 + f).slice(1) + '0000' : '');
  }
  /* a value inside a table cell or a Format-List line: collections show their first four elements (the $FormatEnumerationLimit) */
  function cellStr(v) {
    if (Array.isArray(v)) {
      var shown = v.slice(0, 4).map(function (x) { return Array.isArray(x) ? cellStr(x) : strOf(x); }).join(', ');
      return '{' + shown + (v.length > 4 ? '...' : '') + '}';
    }
    if (isHash(v)) return '{' + v.keys.slice(0, 4).map(function (k) { return '[' + strOf(k) + ', ' + strOf(v.get(k)) + ']'; }).join(', ') + (v.keys.length > 4 ? '...' : '') + '}';
    return strOf(v);
  }
  function typeNameOf(v) {
    if (v === null || v === undefined) return null;
    if (typeof v === 'string') return 'System.String';
    if (typeof v === 'number') return Math.floor(v) === v && Math.abs(v) < 2147483648 ? 'System.Int32' : (Math.floor(v) === v ? 'System.Int64' : 'System.Double');
    if (typeof v === 'boolean') return 'System.Boolean';
    if (Array.isArray(v)) return 'System.Object[]';
    if (isDate(v)) return 'System.DateTime';
    if (isSpan(v)) return 'System.TimeSpan';
    if (isHash(v)) return 'System.Collections.Hashtable';
    if (isBlock(v)) return 'System.Management.Automation.ScriptBlock';
    if (isObj(v)) return v.file ? (v.file.st.type === 'dir' ? 'System.IO.DirectoryInfo' : 'System.IO.FileInfo') : v.type;
    return 'System.Object';
  }
  function shortType(full) { return full ? full.replace(/^.*\./, '') : ''; }

  /* ---- conversions */
  function toNum(v) {
    if (typeof v === 'number') return v;
    if (v === null || v === undefined) return 0;
    if (v === true) return 1;
    if (v === false) return 0;
    if (typeof v === 'string') {
      var t = v.trim();
      if (t === '') return 0;
      if (/^[-+]?0x[0-9a-f]+$/i.test(t)) return parseInt(t, 16);
      if (/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(t)) return parseFloat(t);
      return null;
    }
    if (Array.isArray(v) && v.length === 1) return toNum(v[0]);
    if (isDate(v)) return v.ms;
    return null;
  }
  function toBool(v) {
    if (v === null || v === undefined) return false;
    if (typeof v === 'boolean') return v;
    if (typeof v === 'number') return v !== 0;
    if (typeof v === 'string') return v.length > 0;
    if (Array.isArray(v)) return v.length === 0 ? false : (v.length === 1 ? toBool(v[0]) : true);
    return true;
  }
  /* banker's rounding, as .NET does for [int]2.5 */
  function roundEven(x) {
    var r = Math.round(x);
    if (Math.abs(x % 1) === 0.5 && r % 2 !== 0) r -= 1;
    return r;
  }
  function castErr(v, typeName, why, fq) {
    return psErr({ msg: '無法將 "' + strOf(v) + '" 值轉換為 "' + typeName + '" 型別。錯誤: "' + why + '"', cat: 'InvalidArgument', target: '', activity: '', reason: 'RuntimeException', fq: fq || 'InvalidCastParseTargetInvocation', sepFull: true });
  }
  var CAST_INT = { int: 'System.Int32', int32: 'System.Int32', long: 'System.Int64', int64: 'System.Int64', int16: 'System.Int16', short: 'System.Int16', byte: 'System.Byte', uint32: 'System.UInt32', uint64: 'System.UInt64', uint16: 'System.UInt16', sbyte: 'System.SByte' };
  var CAST_FLOAT = { double: 'System.Double', float: 'System.Single', single: 'System.Single', decimal: 'System.Decimal' };
  /* [type]value */
  function castTo(typeName, v) {
    var t = String(typeName).toLowerCase().replace(/^system\./, '');
    if (hasOwn.call(CAST_INT, t)) {
      var full = CAST_INT[t];
      if (typeof v === 'string') {
        var tv = v.trim(), nn = tv === '' ? 0 : (/^[-+]?\d+(\.\d+)?$/.test(tv) || /^[-+]?0x[0-9a-f]+$/i.test(tv) ? toNum(tv) : null);
        if (nn === null) throw castErr(v, full, '輸入字串格式不正確。', 'InvalidCastFromStringToInteger');
        return roundEven(nn);
      }
      var n = toNum(v);
      if (n === null) throw psErr({ msg: '無法將值 "' + strOf(v) + '" 轉換為型別 "' + full + '"。錯誤: "無法將型別 "' + typeNameOf(v) + '" 的值轉換成型別 "' + full + '"。"', cat: 'InvalidArgument', target: '', activity: '', reason: 'RuntimeException', fq: 'ConvertToFinalInvalidCastException' });
      return roundEven(n);
    }
    if (hasOwn.call(CAST_FLOAT, t)) {
      if (typeof v === 'string') {
        var tv2 = v.trim(), n2 = tv2 === '' ? 0 : (/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(tv2) ? parseFloat(tv2) : null);
        if (n2 === null) throw castErr(v, CAST_FLOAT[t], '輸入字串格式不正確。', 'InvalidCastFromStringToDouble');
        return n2;
      }
      var n3 = toNum(v);
      if (n3 === null) throw castErr(v, CAST_FLOAT[t], '無法轉換', 'ConvertToFinalInvalidCastException');
      return n3;
    }
    switch (t) {
      case 'string': return Array.isArray(v) ? v.map(strOf).join(' ') : strOf(v);
      case 'bool': case 'boolean': return toBool(v);
      case 'char': return typeof v === 'number' ? String.fromCharCode(v) : strOf(v).charAt(0);
      case 'datetime': {
        if (isDate(v)) return v;
        var ms = typeof v === 'string' ? parseDateStr(v) : null;
        if (ms === null) throw castErr(v, 'System.DateTime', '字串未被辨識為有效的 DateTime。', 'InvalidCastParseTargetInvocationWithFormatProvider');
        return mkDate(ms);
      }
      case 'array': case 'object[]': return Array.isArray(v) ? v : (v === null || v === undefined ? [] : [v]);
      case 'object': return v;
      case 'pscustomobject': case 'psobject':
        if (isHash(v)) return new PSObj(T_CUSTOM, v.keys.map(function (k) { return [k, v.get(k)]; }));
        return v;
      case 'hashtable': return v;
      case 'ordered': return v;
      case 'regex': return strOf(v);
      case 'version': {
        var vm = /^(\d+)\.(\d+)(?:\.(\d+))?(?:\.(\d+))?$/.exec(strOf(v));
        if (!vm) throw castErr(v, 'System.Version', '版本字串部分的數目不正確。', 'InvalidCastParseTargetInvocation');
        return versionObj(strOf(v));
      }
      case 'timespan': return isSpan(v) ? v : mkSpan((toNum(v) || 0) * 1000);
      default:
        throw psErr({ msg: '找不到型別 [' + typeName + ']。', cat: 'InvalidOperation', target: '', activity: '', reason: 'RuntimeException', fq: 'TypeNotFound' });
    }
  }
  function versionObj(text) {
    var a = text.split('.');
    return new PSObj('System.Version', [['Major', +a[0] || 0], ['Minor', a.length > 1 ? +a[1] : -1], ['Build', a.length > 2 ? +a[2] : -1], ['Revision', a.length > 3 ? +a[3] : -1]],
      { str: function () { return text; }, fmt: 'version' });
  }

  /* ---- comparison and operators (PowerShell: the type of the LEFT operand decides) */
  var collator = null;
  function strCmp(a, b) {
    a = String(a); b = String(b);
    try { if (!collator) collator = new Intl.Collator('zh-TW', { sensitivity: 'accent', usage: 'sort' }); return collator.compare(a, b); }
    catch (e) { var x = a.toLowerCase(), y = b.toLowerCase(); return x < y ? -1 : x > y ? 1 : 0; }
  }
  function strEqCI(a, b) { return String(a).toLowerCase() === String(b).toLowerCase(); }
  /* three-way compare used by -lt -gt and Sort-Object; returns -1 / 0 / 1 */
  function psCompare(a, b, caseSens) {
    if (a === null || a === undefined) return (b === null || b === undefined) ? 0 : -1;
    if (b === null || b === undefined) return 1;
    if (typeof a === 'number') { var nb = toNum(b); if (nb !== null) return a < nb ? -1 : a > nb ? 1 : 0; }
    if (isDate(a) && isDate(b)) return a.ms < b.ms ? -1 : a.ms > b.ms ? 1 : 0;
    if (typeof a === 'boolean' && typeof b === 'boolean') return a === b ? 0 : (a ? 1 : -1);
    var sa = strOf(a), sb = strOf(b);
    if (caseSens) return sa < sb ? -1 : sa > sb ? 1 : 0;
    return strCmp(sa, sb);
  }
  function psEquals(a, b, caseSens) {
    if (a === null || a === undefined) return b === null || b === undefined;
    if (b === null || b === undefined) return false;
    if (typeof a === 'number') { var nb = typeof b === 'string' && b.trim() === '' ? null : toNum(b); return nb !== null && a === nb; }
    if (typeof a === 'boolean') return a === toBool(b);
    if (typeof a === 'string') { var sb = strOf(b); return caseSens ? a === sb : strEqCI(a, sb); }
    if (isDate(a)) return isDate(b) && a.ms === b.ms;
    return a === b;
  }
  /* -like wildcard (the same wildcard as paths: * ? [a-z]) */
  function likeTest(s, pat, caseSens) {
    var re = wildRegex(String(pat));
    if (caseSens) re = new RegExp(re.source, '');
    return re.test(String(s));
  }
  /* a .NET regular expression -> JS (inline (?i) flags and a few classes) */
  function netRegex(pat, caseSens, extraFlags) {
    var flags = (caseSens ? '' : 'i') + (extraFlags || '');
    var p = String(pat);
    var inl = /^\(\?([imsx]+)\)/.exec(p);
    if (inl) { p = p.slice(inl[0].length); if (inl[1].indexOf('i') >= 0 && flags.indexOf('i') < 0) flags += 'i'; if (inl[1].indexOf('s') >= 0) flags += 's'; }
    try { return new RegExp(p, flags); }
    catch (e) {
      throw psErr({ msg: '無法剖析規則運算式 "' + pat + '" - ' + String(e.message).replace(/^Invalid regular expression: /, '') + '。', cat: 'InvalidOperation', target: '', activity: '', reason: 'RuntimeException', fq: 'InvalidRegularExpression' });
    }
  }

  /* ---- arithmetic */
  function divZero() { return psErr({ msg: '嘗試以零除。', cat: 'NotSpecified', target: '', activity: '', reason: 'RuntimeException', fq: 'RuntimeException' }); }
  function addValues(a, b) {
    if (Array.isArray(a)) return a.concat(Array.isArray(b) ? b : [b]);
    if (typeof a === 'string') return a + strOf(b);
    if (a === null || a === undefined) return Array.isArray(b) ? b : b;
    if (isDate(a) && isSpan(b)) return mkDate(a.ms + b.ms);
    if (isSpan(a) && isSpan(b)) return mkSpan(a.ms + b.ms);
    if (isHash(a) && isHash(b)) { var h = new PSHash(a.keys.map(function (k) { return [k, a.get(k)]; })); b.keys.forEach(function (k) { h.set(k, b.get(k)); }); return h; }
    var x = toNum(a), y = toNum(b);
    if (x === null) throw psErr({ msg: '找不到 "op_Addition" 的方法。', cat: 'InvalidOperation', target: '', activity: '', reason: 'RuntimeException', fq: 'OperatorFailed' });
    if (y === null) throw castErr(b, typeNameOf(a) || 'System.Int32', '輸入字串格式不正確。', 'InvalidCastFromStringToInteger');
    return x + y;
  }
  function binArith(op, a, b) {
    switch (op) {
      case '+': return addValues(a, b);
      case '-':
        if (isDate(a) && isDate(b)) return mkSpan(a.ms - b.ms);
        if (isDate(a) && isSpan(b)) return mkDate(a.ms - b.ms);
        if (isSpan(a) && isSpan(b)) return mkSpan(a.ms - b.ms);
        var x = toNum(a), y = toNum(b);
        if (x === null || y === null) throw psErr({ msg: '無法對 "' + typeNameOf(a) + '" 與 "' + typeNameOf(b) + '" 做 "-" 運算。', cat: 'InvalidOperation', target: '', activity: '', reason: 'RuntimeException', fq: 'OperatorFailed' });
        return x - y;
      case '*':
        if (typeof a === 'string') { var cnt = toNum(b); return cnt === null || cnt < 0 ? '' : new Array(Math.floor(cnt) + 1).join(a); }
        if (Array.isArray(a)) { var c2 = toNum(b) || 0, outA = []; for (var q = 0; q < c2; q++) outA = outA.concat(a); return outA; }
        var m1 = toNum(a), m2 = toNum(b);
        if (m1 === null || m2 === null) throw castErr(m1 === null ? a : b, 'System.Int32', '輸入字串格式不正確。', 'InvalidCastFromStringToInteger');
        return m1 * m2;
      case '/': {
        var d1 = toNum(a), d2 = toNum(b);
        if (d1 === null || d2 === null) throw castErr(d1 === null ? a : b, 'System.Int32', '輸入字串格式不正確。', 'InvalidCastFromStringToInteger');
        if (d2 === 0) throw divZero();
        return d1 / d2;
      }
      case '%': {
        var r1 = toNum(a), r2 = toNum(b);
        if (r1 === null || r2 === null) throw castErr(r1 === null ? a : b, 'System.Int32', '輸入字串格式不正確。', 'InvalidCastFromStringToInteger');
        if (r2 === 0) throw divZero();
        return r1 % r2;
      }
    }
    return null;
  }
  /* the -f operator: "{0:N2} {1,5}" */
  function formatOp(fmt, args) {
    return String(fmt).replace(/\{\{|\}\}|\{(\d+)(?:,(-?\d+))?(?::([^}]*))?\}/g, function (m0, idx, width, spec) {
      if (m0 === '{{') return '{';
      if (m0 === '}}') return '}';
      var v = args[+idx], s;
      if (v === undefined) throw psErr({ msg: '輸入字串格式不正確。', cat: 'InvalidOperation', target: '', activity: '', reason: 'RuntimeException', fq: 'FormatError' });
      if (spec !== undefined && spec !== '') s = formatWithSpec(v, spec); else s = strOf(v);
      if (width !== undefined) { var w = +width; s = w >= 0 ? padL(s, w) : padR(s, -w); }
      return s;
    });
  }
  function formatWithSpec(v, spec) {
    if (isDate(v)) return formatDate(v.ms, spec);
    var n = toNum(v);
    var m = /^([NnFfPpDdXxEeCcGg])(\d*)$/.exec(spec);
    if (n !== null && m) {
      var dec = m[2] === '' ? null : +m[2];
      switch (m[1].toUpperCase()) {
        case 'N': return fmtN(n, dec === null ? 2 : dec, true);
        case 'F': return fmtN(n, dec === null ? 2 : dec, false);
        case 'P': return fmtN(n * 100, dec === null ? 2 : dec, true) + '%';
        case 'D': return String(Math.trunc(n)).replace(/^(-?)(\d+)$/, function (m0, sg, ds) { return sg + (dec ? new Array(Math.max(0, dec - ds.length + 1)).join('0') : '') + ds; });
        case 'X': { var hx = Math.trunc(n).toString(16); hx = m[1] === 'x' ? hx : hx.toUpperCase(); return dec ? new Array(Math.max(0, dec - hx.length + 1)).join('0') + hx : hx; }
        case 'E': return n.toExponential(dec === null ? 6 : dec).replace(/e([+-])(\d+)/, function (m0, sg, d) { return 'E' + sg + (d.length < 3 ? new Array(4 - d.length).join('0') + d : d); });
        case 'C': return '$' + fmtN(n, dec === null ? 2 : dec, true);
        case 'G': return numStr(n);
      }
    }
    if (n !== null && /[0#]/.test(spec)) return formatCustomNumber(n, spec);
    return strOf(v);
  }
  /* custom numeric patterns: 0.00 / #,##0 / 00 / 0.# / 0% */
  function formatCustomNumber(n, spec) {
    var pct = spec.indexOf('%') >= 0;
    if (pct) n = n * 100;
    var parts = spec.replace('%', '').split('.');
    var intPat = parts[0], decPat = parts[1] || '';
    var minDec = (decPat.match(/0/g) || []).length, maxDec = decPat.length;
    var s = Math.abs(n).toFixed(maxDec);
    var ip = s.split('.')[0], dp = s.split('.')[1] || '';
    while (dp.length > minDec && /0$/.test(dp)) dp = dp.slice(0, -1);
    var minInt = (intPat.replace(/,/g, '').match(/0/g) || []).length;
    while (ip.length < minInt) ip = '0' + ip;
    if (intPat.indexOf(',') >= 0) ip = commas(ip);
    return (n < 0 && Number(s) !== 0 ? '-' : '') + ip + (dp ? '.' + dp : '') + (pct ? '%' : '');
  }

  /* ---- unrolling: what the pipeline does to an array (one level) */
  function unroll(v) { return Array.isArray(v) ? v : [v]; }

  /* ---- members of values */
  function enumerateValue(v) {
    if (v === null || v === undefined) return [];
    if (Array.isArray(v)) return v;
    if (isHash(v)) return [v];
    return [v];
  }

  /* ------------------------------------------------------------ lexer and parser
     lex(src) -> {stmts, incomplete:ps2|null, unsupported:token|null, parseError:{msg,fq,start,len}|null}
     A statement is {kind:'pipe', pipes:[{cmds:[stage]}]} (always ONE stage per pipe element) or one of
       {kind:'assign', target, op, rhs}  {kind:'if', clauses, elseBody}  {kind:'foreach', name, list, body}  {kind:'for', init, cond, step, body}
       {kind:'while', cond, body}  {kind:'function', name, params, body}  {kind:'try', body, catches, fin}  {kind:'jump', what, value}
     A stage is a command {words, redirs, start, end, callOp?} or an expression {expr, redirs, start, end} or a block call {block, ...}.
     A word token: {k:'word', parts, text, start, end, quoted, arr?}; parts: {k:'lit', s} | {k:'var', name} | {k:'x', ast}; `ast` of a part is an expression node.
     A param token: {k:'param', name, value?, text, start, end}.
     Expression nodes carry s (start) and e (end) offsets into the typed line, so a runtime error can point at them with ~~~. */
  var ABORT = { abort: true };
  var WORD_OP_RE = /^-(?:([ci]?)(eq|ne|gt|ge|lt|le|like|notlike|match|notmatch|replace|contains|notcontains|in|notin|split|join)|(is|isnot|as|and|or|xor|not|band|bor|bxor|bnot|shl|shr|f))(?![A-Za-z0-9_])/i;
  var STMT_KEYWORDS = { 'if': 1, 'foreach': 1, 'for': 1, 'while': 1, 'function': 1, 'try': 1, 'return': 1, 'break': 1, 'continue': 1, 'filter': 1, 'switch': 1, 'do': 1, 'trap': 1, 'class': 1, 'param': 1, 'throw': 1, 'exit': 0 };

  function lex(src) {
    var n = src.length, i = 0;
    var res = { stmts: [], incomplete: null, unsupported: null, parseError: null };
    var cs = [null];                              // the closers we are inside of: null at the top, ')' or '}' in a group
    function top() { return cs[cs.length - 1]; }
    function atCloser() { var t = top(); return t !== null && src.charAt(i) === t; }
    function perr(msg, fq, at, len) { res.parseError = { msg: msg, fq: fq, start: at, len: len || 1 }; throw ABORT; }
    function more() { res.incomplete = '>> '; throw ABORT; }
    function unsupp(text) { res.unsupported = text; throw ABORT; }
    function unexpected(tok, at, len) { perr("表達式或陳述式中包含未預期的語彙基元 '" + tok + "'。", 'UnexpectedToken', at, len || tok.length); }
    function isWordEnd(c) { return c === ' ' || c === '\t' || c === '\r' || c === '\n' || c === ';' || c === '|' || c === '&' || c === '<' || c === '>' || c === '(' || c === ')' || c === '{' || c === '}'; }
    function skipSpaces() { while (i < n && (src.charAt(i) === ' ' || src.charAt(i) === '\t' || src.charAt(i) === '\r')) i++; }
    /* spaces, newlines and comments (inside brackets a line break is just white space) */
    function skipWsNl() {
      for (;;) {
        var c = src.charAt(i);
        if (c === ' ' || c === '\t' || c === '\r' || c === '\n') { i++; continue; }
        if (c === '#') { while (i < n && src.charAt(i) !== '\n') i++; continue; }
        break;
      }
    }
    function skipSeps() {
      for (;;) {
        var c = src.charAt(i);
        if (c === ' ' || c === '\t' || c === '\r' || c === '\n' || c === ';') { i++; continue; }
        if (c === '#') { while (i < n && src.charAt(i) !== '\n') i++; continue; }
        break;
      }
    }
    function isIdStart(c) { return /[A-Za-z_]/.test(c); }
    function isIdChar(c) { return /[A-Za-z0-9_]/.test(c); }

    /* $name, ${name}, $env:NAME, $? ; returns {name, end} or null for a lone $ */
    function readVar(at) {
      var c = src.charAt(at + 1);
      if (c === '{') { var close = src.indexOf('}', at + 2); if (close < 0) more(); return { name: src.slice(at + 2, close), end: close + 1 }; }
      if (c === '?' || c === '$' || c === '^') return { name: c, end: at + 2 };
      var m = /^(?:[A-Za-z_][A-Za-z0-9_]*:)?[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(at + 1, at + 80));
      if (!m) return null;
      return { name: m[0], end: at + 1 + m[0].length };
    }

    /* ---- statements */
    function statementsUntil(cl) {
      var list = [];
      cs.push(cl);
      for (;;) {
        skipSeps();
        if (i >= n) { if (cl) more(); break; }
        var c = src.charAt(i);
        if (cl && c === cl) { i++; break; }
        if (c === ')' || c === '}') unexpected(c, i);
        var st = parseStatement();
        if (st) list.push(st);
      }
      cs.pop();
      return list;
    }
    /* the statements of a ( ... ) body: i is just after the ( */
    function parenBody() { return statementsUntil(')'); }
    /* the statements of a { ... } body: i is just after the { */
    function braceBody() { return statementsUntil('}'); }

    function endOfStatement() {
      skipSpaces();
      var c = src.charAt(i);
      return i >= n || c === '\n' || c === ';' || c === '#' || atCloser();
    }
    function readKeywordWord() { var m = /^[A-Za-z]+/.exec(src.slice(i, i + 12)); return m ? m[0].toLowerCase() : ''; }

    function parseStatement() {
      skipSpaces();
      var startI = i, c = src.charAt(i);
      if (c === '#') { while (i < n && src.charAt(i) !== '\n') i++; return null; }
      var kw = readKeywordWord();
      if (kw && hasOwn.call(STMT_KEYWORDS, kw) && STMT_KEYWORDS[kw] && !isIdChar(src.charAt(i + kw.length)) && src.charAt(i + kw.length) !== '-' && src.charAt(i + kw.length) !== '.') {
        var st = parseKeyword(kw, startI);
        if (st) return st;
        i = startI;
      }
      if (c === '$') {
        var save = i;
        var tgt = tryAssignTarget();
        if (tgt) return tgt;
        i = save;
      }
      return parsePipeline();
    }

    /* $x = ..., $x.a += ..., $a[0] = ..., $env:Path += ... */
    function tryAssignTarget() {
      var startI = i;
      var v = readVar(i);
      if (!v) return null;
      var node = { t: 'var', name: v.name, s: startI, e: v.end };
      i = v.end;
      node = postfixChain(node, false);
      skipSpaces();
      var m = /^(\+|-|\*|\/|%)?=(?!=)/.exec(src.slice(i, i + 3));
      if (!m) return null;
      var opAt = i;
      i += m[0].length;
      skipSpaces();
      if (i >= n || src.charAt(i) === '\n') more();
      var rhs = parseStatement();
      if (!rhs) more();
      return { kind: 'assign', target: node, op: m[1] ? m[1] + '=' : '=', rhs: rhs, start: startI, end: i, opAt: opAt };
    }

    function parseKeyword(kw, startI) {
      i += kw.length;
      skipSpaces();
      function expectChar(ch) { skipWsNl(); if (i >= n) more(); if (src.charAt(i) !== ch) unexpected(src.charAt(i), i, 1); i++; }
      function body() { skipWsNl(); if (i >= n) more(); if (src.charAt(i) !== '{') unexpected(src.charAt(i), i, 1); i++; return braceBody(); }
      switch (kw) {
        case 'if': {
          var clauses = [], elseBody = null;
          expectChar('('); var cond = parenBody(); var b0 = body();
          clauses.push({ cond: cond, body: b0 });
          for (;;) {
            var save = i; skipWsNl();
            var k2 = readKeywordWord();
            if (k2 === 'elseif') { i += 6; expectChar('('); var c2 = parenBody(); clauses.push({ cond: c2, body: body() }); continue; }
            if (k2 === 'else') { i += 4; elseBody = body(); break; }
            i = save; break;
          }
          return { kind: 'if', clauses: clauses, elseBody: elseBody, start: startI, end: i };
        }
        case 'foreach': {
          expectChar('(');
          skipWsNl();
          if (src.charAt(i) !== '$') unexpected(src.charAt(i) || '(', i, 1);
          var v = readVar(i); if (!v) unexpected('$', i, 1);
          i = v.end; skipWsNl();
          if (src.slice(i, i + 2).toLowerCase() !== 'in') unexpected(src.charAt(i) || ')', i, 1);
          i += 2;
          var list = parenBody();
          return { kind: 'foreach', name: v.name, list: list, body: body(), start: startI, end: i };
        }
        case 'for': {
          expectChar('(');
          cs.push(')');
          var init = null, cond = null, step = null;
          skipWsNl(); if (src.charAt(i) !== ';') init = parseStatement();
          skipWsNl(); if (src.charAt(i) === ';') i++;
          skipWsNl(); if (src.charAt(i) !== ';') cond = parseStatement();
          skipWsNl(); if (src.charAt(i) === ';') i++;
          skipWsNl(); if (src.charAt(i) !== ')') step = parseStatement();
          skipWsNl(); if (i >= n) more();
          if (src.charAt(i) !== ')') unexpected(src.charAt(i), i, 1);
          i++; cs.pop();
          return { kind: 'for', init: init, cond: cond, step: step, body: body(), start: startI, end: i };
        }
        case 'while': {
          expectChar('('); var wc = parenBody();
          return { kind: 'while', cond: wc, body: body(), start: startI, end: i };
        }
        case 'function': {
          skipSpaces();
          var nm = /^[A-Za-z_][\w-]*/.exec(src.slice(i, i + 80));
          if (!nm) return null;
          i += nm[0].length; skipWsNl();
          var params = [];
          if (src.charAt(i) === '(') {
            i++;
            var pm = /^[^)]*/.exec(src.slice(i))[0];
            i += pm.length;
            if (src.charAt(i) !== ')') more();
            i++;
            pm.split(',').forEach(function (p) { var q = /\$([A-Za-z_]\w*)/.exec(p); if (q) params.push(q[1]); });
            skipWsNl();
          }
          return { kind: 'function', name: nm[0], params: params, body: body(), start: startI, end: i };
        }
        case 'try': {
          var tb = body(), catches = [], fin = null;
          for (;;) {
            var s2 = i; skipWsNl();
            var k3 = readKeywordWord();
            if (k3 === 'catch') { i += 5; catches.push(body()); continue; }
            if (k3 === 'finally') { i += 7; fin = body(); break; }
            i = s2; break;
          }
          return { kind: 'try', body: tb, catches: catches, fin: fin, start: startI, end: i };
        }
        case 'return': case 'break': case 'continue': case 'throw': {
          var val = null;
          if (!endOfStatement() && (kw === 'return' || kw === 'throw')) val = parseStatement();
          return { kind: 'jump', what: kw, value: val, start: startI, end: i };
        }
        default:
          unsupp(kw);
      }
      return null;
    }

    function parsePipeline() {
      var stmt = { kind: 'pipe', pipes: [], start: i, end: i };
      for (;;) {
        var stage = parseStage();
        stmt.pipes.push({ cmds: [stage] });
        stmt.end = i;
        skipSpaces();
        var c = src.charAt(i);
        if (c === '|') {
          if (src.charAt(i + 1) === '|') perr("在這個版本中 '||' 語彙基元不是有效的陳述式分隔符號。", 'InvalidEndOfLine', i, 2);
          i++;
          // a trailing | continues on the next line
          var k = i; while (k < n && /[ \t\r]/.test(src.charAt(k))) k++;
          if (k >= n) more();
          if (src.charAt(k) === '\n') { i = k; skipWsNl(); if (i >= n) more(); }
          skipSpaces();
          var nc = src.charAt(i);
          if (nc === '|' || nc === ';' || i >= n || atCloser()) perr('不允許空管道元素。', 'EmptyPipeElement', i - 1, 1);
          continue;
        }
        if (c === '&' && src.charAt(i + 1) === '&') perr("在這個版本中 '&&' 語彙基元不是有效的陳述式分隔符號。", 'InvalidEndOfLine', i, 2);
        break;
      }
      return stmt;
    }

    /* does the text at i start an expression (not a command)? */
    function startsExpression() {
      var c = src.charAt(i), c1 = src.charAt(i + 1);
      if (c === '$' || c === '"' || c === "'" || c === '(' || c === '!' || c === '{') return true;
      if (c === '-' && /^-(?:not|bnot|split|join)(?![A-Za-z0-9_])/i.test(src.slice(i, i + 8))) return true;
      if (c === '@') return c1 === '(' || c1 === '{';
      if (c === '[') return /^\[[A-Za-z][\w.\[\],\s]*\]/.test(src.slice(i, i + 80));
      if (/[0-9]/.test(c)) return true;
      if ((c === '-' || c === '+' || c === '.') && (/[0-9]/.test(c1) || (c1 === '.' && /[0-9]/.test(src.charAt(i + 2))) || (c !== '.' && (c1 === '$' || c1 === '(')))) return true;
      return false;
    }

    function parseStage() {
      skipSpaces();
      if (i >= n || src.charAt(i) === '\n') more();
      var startI = i;
      if (startsExpression()) {
        var node = ex(false);
        var st = { expr: node, redirs: [], start: startI, end: i };
        parseRedirs(st);
        if (!endOfStageOk()) unexpected(peekWord(), i, peekWord().length);
        st.end = i;
        return st;
      }
      return parseCommand();
    }
    function peekWord() {
      var j = i;
      while (j < n && !isWordEnd(src.charAt(j))) j++;
      return j > i ? src.slice(i, j) : src.charAt(i);
    }
    function endOfStageOk() {
      skipSpaces();
      var c = src.charAt(i);
      return i >= n || c === '\n' || c === ';' || c === '|' || c === '#' || atCloser() || (c === '&' && src.charAt(i + 1) === '&');
    }
    function parseRedirs(stage) {
      for (;;) {
        skipSpaces();
        var m = /^(\d|\*)?>(>)?(&(\d))?/.exec(src.slice(i, i + 6));
        if (!m || (m[1] !== undefined && i > 0 && !/[ \t\n;|]/.test(src.charAt(i - 1)) && false)) break;
        var opAt = i, op = m[2] ? '>>' : '>', stream = m[1] === undefined ? 1 : (m[1] === '*' ? '*' : +m[1]);
        i += m[0].length;
        if (m[3]) { stage.redirs.push({ op: op, stream: stream, merge: +m[4], target: null }); continue; }
        skipSpaces();
        if (i >= n || src.charAt(i) === '\n' || src.charAt(i) === ';' || src.charAt(i) === '|') perr('重新導向運算子後面遺失檔案規格。', 'MissingFileSpecification', opAt, op.length);
        var tg = readWordToken();
        stage.redirs.push({ op: op, stream: stream, merge: 0, target: tg });
        stage.end = i;
      }
    }

    function parseCommand() {
      var startI = i;
      var cmd = { words: [], redirs: [], start: startI, end: startI };
      for (;;) {
        skipSpaces();
        if (i >= n) break;
        var c = src.charAt(i);
        if (c === '\n' || c === ';') break;
        if (c === '#') { while (i < n && src.charAt(i) !== '\n') i++; break; }
        if (c === '|') break;
        if (atCloser()) break;
        if (c === '&') {
          if (src.charAt(i + 1) === '&') break;
          // the call operator: & 'C:\x\tar.exe' args  (only at the start of a command)
          if (!cmd.words.length && !cmd.callOp) {
            var k2 = i + 1; while (k2 < n && /[ \t]/.test(src.charAt(k2))) k2++;
            if (k2 < n && src.charAt(k2) !== '\n' && src.charAt(k2) !== ';') { i = k2; cmd.callOp = true; continue; }
          }
          perr('不允許使用 & 符號字元。& 運算子已保留供未來使用; 請使用雙引號將 & 符號括住 ("&") 以將它當作字串的一部分來傳遞。', 'AmpersandNotAllowed', i, 1);
        }
        if (c === '<') perr("'<' 運算子保留供未來使用。", 'RedirectionNotSupported', i, 1);
        if (c === ')' || c === '}') unexpected(c, i);
        if (/^(?:\d|\*)?>/.test(src.slice(i, i + 2)) && (src.charAt(i) === '>' || i === 0 || /[ \t\n;|]/.test(src.charAt(i - 1)))) { parseRedirs(cmd); cmd.end = i; continue; }
        var isParam = cmd.words.length > 0 && /^-[A-Za-z?]/.test(src.slice(i, i + 2));
        if (isParam) {
          var pm = /^-([A-Za-z?][A-Za-z0-9_?]*)(:?)/.exec(src.slice(i));
          var pStart = i;
          i += pm[0].length - (pm[2] ? 1 : 0);
          var ptok = { k: 'param', name: pm[1], text: src.slice(pStart, i), start: pStart, end: i };
          if (pm[2] && src.charAt(i) === ':') {
            i++;
            if (i < n && !isWordEnd(src.charAt(i))) {
              var vt = readWordToken();
              ptok.value = vt; ptok.end = i; ptok.text = src.slice(pStart, i);
            } else if (src.charAt(i) === '(' || src.charAt(i) === '{') {
              var vt2 = readWordToken();
              ptok.value = vt2; ptok.end = i; ptok.text = src.slice(pStart, i);
            } else { ptok.end = i; ptok.text = src.slice(pStart, i); }
          }
          cmd.words.push(ptok); cmd.end = ptok.end;
          continue;
        }
        var w = readWordToken();
        if (w.parts.length === 0 && !w.isNull && !w.arr && !w.quoted) { i++; continue; }      // a stray character that is nothing (defensive)
        cmd.words.push(w); cmd.end = w.end;
      }
      if (!cmd.words.length && !cmd.redirs.length) {
        if (cmd.callOp) more();
        perr('不允許空管道元素。', 'EmptyPipeElement', startI, 1);
      }
      // `& { ... }`
      if (cmd.callOp && cmd.words.length === 1 && cmd.words[0].parts.length === 1 && cmd.words[0].parts[0].k === 'x' && cmd.words[0].parts[0].ast.t === 'block') {
        return { block: cmd.words[0].parts[0].ast, redirs: cmd.redirs, start: cmd.start, end: cmd.end };
      }
      return cmd;
    }

    /* the text of a double-quoted string starting at the quote; returns {parts, end} */
    function readDQ(at) {
      var parts = [], buf = '', j = at + 1, closed = false;
      var map = { n: '\n', t: '\t', r: '\r', '0': '\0', a: '\x07', b: '\b', f: '\f', v: '\v' };
      while (j < n) {
        var d = src.charAt(j);
        if (d === '"') { if (src.charAt(j + 1) === '"') { buf += '"'; j += 2; continue; } closed = true; break; }
        if (d === '`') {
          if (j + 1 >= n) break;
          var nx = src.charAt(j + 1);
          buf += hasOwn.call(map, nx) ? map[nx] : nx; j += 2; continue;
        }
        if (d === '$') {
          if (src.charAt(j + 1) === '(') {
            if (buf !== '') { parts.push({ k: 'lit', s: buf }); buf = ''; }
            var sv = i, ss = j;
            i = j + 2;
            var stmts = parenBody();
            j = i; i = sv;
            parts.push({ k: 'x', ast: { t: 'sub', stmts: stmts, s: ss, e: j } });
            continue;
          }
          var dv = readVar(j);
          if (dv) {
            if (buf !== '') { parts.push({ k: 'lit', s: buf }); buf = ''; }
            parts.push({ k: 'var', name: dv.name }); j = dv.end; continue;
          }
        }
        buf += d; j++;
      }
      if (!closed) more();
      if (buf !== '' || !parts.length) parts.push({ k: 'lit', s: buf });
      return { parts: parts, end: j + 1 };
    }
    function readSQ(at) {
      var s1 = '', j = at + 1, closed = false;
      while (j < n) {
        if (src.charAt(j) === "'") { if (src.charAt(j + 1) === "'") { s1 += "'"; j += 2; continue; } closed = true; break; }
        s1 += src.charAt(j); j++;
      }
      if (!closed) more();
      return { s: s1, end: j + 1 };
    }

    /* one comma-free element of an argument: bare text, quotes, $variables, (groups), {blocks}; returns {parts, text, quoted} */
    function readElement() {
      var parts = [], quoted = false, startI = i, lit = '';
      function flush() { if (lit !== '') { parts.push({ k: 'lit', s: lit }); lit = ''; } }
      var c0 = src.charAt(i);
      if (c0 === '(' || c0 === '{' || (c0 === '@' && (src.charAt(i + 1) === '(' || src.charAt(i + 1) === '{')) || (c0 === '$' && src.charAt(i + 1) === '(')) {
        var node = postfixChain(primary(), false);
        parts.push({ k: 'x', ast: node });
      }
      while (i < n) {
        var c = src.charAt(i);
        if (c === ',' || isWordEnd(c)) break;
        if (c === '`') {
          if (i + 1 >= n) more();
          var e = src.charAt(i + 1);
          if (e === '\n') { i += 2; continue; }
          lit += e; i += 2; quoted = true; continue;
        }
        if (c === "'") { var sq = readSQ(i); lit += sq.s; i = sq.end; quoted = true; continue; }
        if (c === '"') {
          flush();
          var dq = readDQ(i);
          dq.parts.forEach(function (p) { parts.push(p); });
          i = dq.end; quoted = true; continue;
        }
        if (c === '$') {
          if (src.charAt(i + 1) === '(') { flush(); parts.push({ k: 'x', ast: postfixChain(primary(), false) }); continue; }
          var v = readVar(i);
          if (v) {
            flush();
            var nx2 = src.charAt(v.end);
            if ((nx2 === '.' && /[A-Za-z_$"'(]/.test(src.charAt(v.end + 1))) || nx2 === '[') {
              var vs = i;
              i = v.end;
              parts.push({ k: 'x', ast: postfixChain({ t: 'var', name: v.name, s: vs, e: v.end }, false) });
            } else { parts.push({ k: 'var', name: v.name }); i = v.end; }
            continue;
          }
        }
        lit += c; i++;
      }
      flush();
      return { parts: parts, text: src.slice(startI, i), quoted: quoted };
    }
    /* a whole argument: element (, element)* ; returns the token */
    function readWordToken() {
      var startI = i;
      var c = src.charAt(i);
      if (c === '{' ) {
        var bn = primary();
        var bt = { k: 'word', parts: [{ k: 'x', ast: bn }], text: src.slice(startI, i), start: startI, end: i, quoted: false };
        return bt;
      }
      var first = readElement();
      var tk = { k: 'word', parts: first.parts, text: first.text, start: startI, end: i, quoted: first.quoted };
      // a, b, c  (spaces around the commas are allowed)
      var save = i;
      skipSpaces();
      if (src.charAt(i) === ',') {
        var arr = [{ parts: first.parts, text: first.text }];
        while (src.charAt(i) === ',') {
          i++; skipSpaces();
          if (i >= n || src.charAt(i) === '\n') more();
          if (isWordEnd(src.charAt(i)) && src.charAt(i) !== '(' && src.charAt(i) !== '{') more();
          var el = readElement();
          arr.push({ parts: el.parts, text: el.text });
          save = i;
          skipSpaces();
        }
        i = save;
        tk.arr = arr; tk.end = i; tk.text = src.slice(startI, i);
      } else i = save;
      return tk;
    }

    /* ---- expressions */
    function node(t, s, e, extra) { var o = { t: t, s: s, e: e }; if (extra) for (var k in extra) o[k] = extra[k]; return o; }
    function wordOpAt() {
      var m = WORD_OP_RE.exec(src.slice(i, i + 16));
      if (!m) return null;
      return { op: (m[2] || m[3]).toLowerCase(), cs: m[1] === 'c', len: m[0].length };
    }
    function ex(noComma) { return pOr(noComma); }
    function binLoop(next, ops, noComma) {
      var l = next(noComma);
      for (;;) {
        skipSpaces();
        var o = ops(), s0 = i;
        if (!o) return l;
        i += o.len;
        skipWsNlIfOperand();
        var r = next(noComma);
        l = node('bin', l.s, r.e, { op: o.op, cs: !!o.cs, l: l, r: r });
      }
    }
    /* after a binary operator the right operand may be on the next line */
    function skipWsNlIfOperand() {
      skipSpaces();
      if (i >= n) more();
      if (src.charAt(i) === '\n') { skipWsNl(); if (i >= n) more(); }
    }
    function pOr(nc) { return binLoop(pAnd, function () { var o = wordOpAt(); return o && (o.op === 'or' || o.op === 'xor') ? o : null; }, nc); }
    function pAnd(nc) { return binLoop(pBit, function () { var o = wordOpAt(); return o && o.op === 'and' ? o : null; }, nc); }
    function pBit(nc) { return binLoop(pCmp, function () { var o = wordOpAt(); return o && /^(band|bor|bxor|shl|shr)$/.test(o.op) ? o : null; }, nc); }
    var CMP_OPS = /^(eq|ne|gt|ge|lt|le|like|notlike|match|notmatch|replace|contains|notcontains|in|notin|is|isnot|as|split|join)$/;
    function pCmp(nc) { return binLoop(pAdd, function () { var o = wordOpAt(); return o && CMP_OPS.test(o.op) ? o : null; }, nc); }
    function pAdd(nc) {
      return binLoop(pMul, function () {
        var c = src.charAt(i), c1 = src.charAt(i + 1);
        if (c === '+' && c1 !== '+' && c1 !== '=') return { op: '+', len: 1 };
        if (c === '-' && c1 !== '-' && c1 !== '=' && !WORD_OP_RE.test(src.slice(i, i + 16))) return { op: '-', len: 1 };
        return null;
      }, nc);
    }
    function pMul(nc) {
      return binLoop(pFmt, function () {
        var c = src.charAt(i), c1 = src.charAt(i + 1);
        if ((c === '*' || c === '/' || c === '%') && c1 !== '=') return { op: c, len: 1 };
        return null;
      }, nc);
    }
    function pFmt(nc) { return binLoop(pRange, function () { var o = wordOpAt(); return o && o.op === 'f' ? o : null; }, nc); }
    function pRange(nc) {
      var l = pComma(nc);
      skipSpaces();
      if (src.charAt(i) === '.' && src.charAt(i + 1) === '.') {
        i += 2; skipWsNlIfOperand();
        var r = pComma(nc);
        return node('range', l.s, r.e, { l: l, r: r });
      }
      return l;
    }
    function pComma(nc) {
      var first = pUnary(nc);
      if (nc) return first;
      skipSpaces();
      if (src.charAt(i) !== ',') return first;
      var items = [first];
      while (src.charAt(i) === ',') {
        i++; skipWsNlIfOperand();
        items.push(pUnary(nc));
        skipSpaces();
      }
      return node('comma', first.s, items[items.length - 1].e, { items: items });
    }
    function pUnary(nc) {
      skipSpaces();
      var s0 = i, c = src.charAt(i), c1 = src.charAt(i + 1);
      if (c === ',') { i++; var u0 = pUnary(nc); return node('comma', s0, u0.e, { items: [u0] }); }
      if (c === '!') { i++; var u1 = pUnary(nc); return node('un', s0, u1.e, { op: '!', e1: u1 }); }
      if (c === '+' && c1 === '+') { i += 2; var t1 = postfixChain(primary(), nc); return node('inc', s0, t1.e, { op: '++', prefix: true, target: t1 }); }
      if (c === '-' && c1 === '-') { i += 2; var t2 = postfixChain(primary(), nc); return node('inc', s0, t2.e, { op: '--', prefix: true, target: t2 }); }
      if (c === '-' || c === '+') {
        var wo = WORD_OP_RE.exec(src.slice(i, i + 16));
        if (wo) {
          var wop = (wo[2] || wo[3]).toLowerCase();
          if (wop === 'not' || wop === 'bnot' || wop === 'split' || wop === 'join') { i += wo[0].length; var u2 = pUnary(nc); return node('un', s0, u2.e, { op: wop, e1: u2, cs: wo[1] === 'c' }); }
        }
        if (/[0-9.]/.test(c1) && c === '-') {
          // a negative number literal
          var save = i; i++;
          var lit = tryNumber();
          if (lit) { lit.s = s0; lit.v = -lit.v; return postfixChain(lit, nc); }
          i = save;
        }
        i++;
        var u3 = pUnary(nc);
        return node('un', s0, u3.e, { op: c, e1: u3 });
      }
      if (c === '[') {
        var tm = /^\[([A-Za-z_][\w.]*(?:\[\])?)\]/.exec(src.slice(i, i + 80));
        if (tm) {
          var tn = tm[1];
          i += tm[0].length;
          if (src.charAt(i) === ':' && src.charAt(i + 1) === ':') return postfixChain(node('type', s0, i, { name: tn }), nc);
          skipSpaces();
          var tc = src.charAt(i);
          if (i >= n || tc === '\n' || tc === ')' || tc === ']' || tc === '}' || tc === ';' || tc === '|' || tc === ',' || WORD_OP_RE.test(src.slice(i, i + 16))) return node('type', s0, i, { name: tn });
          var operand = pUnary(nc);
          return node('cast', s0, operand.e, { type: tn, e1: operand });
        }
      }
      return postfixChain(primary(), nc);
    }
    function tryNumber() {
      var m = /^(0x[0-9a-fA-F]+|(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)(kb|mb|gb|tb|pb)?(?![A-Za-z0-9_])/i.exec(src.slice(i, i + 40));
      if (!m) return null;
      var s0 = i, v = /^0x/i.test(m[1]) ? parseInt(m[1], 16) : parseFloat(m[1]);
      if (m[2]) v *= Math.pow(1024, { kb: 1, mb: 2, gb: 3, tb: 4, pb: 5 }[m[2].toLowerCase()]);
      // `1..5`: the first dot belongs to the range operator
      if (/^\d+\.$/.test(m[1]) && src.charAt(i + m[0].length) === '.') { m[0] = m[0].slice(0, -1); v = parseFloat(m[1]); }
      i += m[0].length;
      return node('num', s0, i, { v: v });
    }
    /* postfix: .member  .Method(args)  [index]  ::static  ++ -- */
    function postfixChain(base, nc) {
      var cur = base;
      for (;;) {
        var c = src.charAt(i), c1 = src.charAt(i + 1);
        if (c === '.' && c1 !== '.' && !/\s/.test(c1) && c1 !== '') {
          i++;
          var nameNode = readMemberName();
          if (src.charAt(i) === '(') { var args = readArgs(); cur = node('call', cur.s, i, { target: cur, name: nameNode, args: args }); }
          else cur = node('mem', cur.s, i, { target: cur, name: nameNode });
          continue;
        }
        if (c === ':' && c1 === ':') {
          i += 2;
          var nm2 = readMemberName();
          if (src.charAt(i) === '(') { var args2 = readArgs(); cur = node('call', cur.s, i, { target: cur, name: nm2, args: args2, stat: true }); }
          else cur = node('mem', cur.s, i, { target: cur, name: nm2, stat: true });
          continue;
        }
        if (c === '[') {
          i++; skipWsNl();
          var idx = ex(false);
          skipWsNl();
          if (i >= n) more();
          if (src.charAt(i) !== ']') unexpected(src.charAt(i), i, 1);
          i++;
          cur = node('idx', cur.s, i, { target: cur, index: idx });
          continue;
        }
        if ((c === '+' && c1 === '+') || (c === '-' && c1 === '-')) {
          // postfix ++ / -- only directly after a variable or member
          if (cur.t === 'var' || cur.t === 'mem' || cur.t === 'idx') { i += 2; cur = node('inc', cur.s, i, { op: c + c, prefix: false, target: cur }); continue; }
        }
        break;
      }
      return cur;
    }
    function readMemberName() {
      var c = src.charAt(i);
      if (c === '"' || c === "'") {
        if (c === "'") { var sq = readSQ(i); var s0 = i; i = sq.end; return node('str', s0, i, { v: sq.s }); }
        var dq = readDQ(i), s1 = i; i = dq.end;
        return node('estr', s1, i, { parts: dq.parts });
      }
      if (c === '$') { var v = readVar(i); if (v) { var s2 = i; i = v.end; return node('var', s2, i, { name: v.name }); } }
      if (c === '(') { var s3 = i; i++; var body = parenBody(); return node('sub', s3, i, { stmts: body }); }
      var m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i, i + 80));
      if (!m) { unexpected(c || '.', i, 1); }
      var s4 = i; i += m[0].length;
      return node('str', s4, i, { v: m[0], bare: true });
    }
    function readArgs() {
      // i is at (
      i++;
      var args = [];
      skipWsNl();
      if (src.charAt(i) === ')') { i++; return args; }
      for (;;) {
        skipWsNl();
        if (i >= n) more();
        args.push(ex(true));
        skipWsNl();
        if (i >= n) more();
        var c = src.charAt(i);
        if (c === ',') { i++; continue; }
        if (c === ')') { i++; break; }
        unexpected(c, i, 1);
      }
      return args;
    }
    function primary() {
      skipSpaces();
      if (i >= n) more();
      var s0 = i, c = src.charAt(i), c1 = src.charAt(i + 1);
      if (c === '$') {
        if (c1 === '(') { i += 2; var body = parenBody(); return node('sub', s0, i, { stmts: body, dollar: true }); }
        var v = readVar(i);
        if (!v) unexpected('$', i, 1);
        i = v.end;
        return node('var', s0, i, { name: v.name });
      }
      if (c === '@') {
        if (c1 === '(') { i += 2; var b2 = parenBody(); return node('arr', s0, i, { stmts: b2 }); }
        if (c1 === '{') { i += 2; return parseHash(s0); }
        if (c1 === '"' || c1 === "'") unsupp('@' + c1);
        unexpected('@', i, 1);
      }
      if (c === '(') { i++; var b3 = parenBody(); return node('sub', s0, i, { stmts: b3 }); }
      if (c === '{') {
        i++;
        var inner = i;
        var b4 = braceBody();
        return node('block', s0, i, { stmts: b4, src: src.slice(s0 + 1, i - 1) });
      }
      if (c === "'") { var sq = readSQ(i); i = sq.end; return node('str', s0, i, { v: sq.s }); }
      if (c === '"') { var dq = readDQ(i); i = dq.end; return node('estr', s0, i, { parts: dq.parts }); }
      if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(c1))) { var nn = tryNumber(); if (nn) return nn; }
      if (c === '[') {
        var tm = /^\[([A-Za-z_][\w.]*(?:\[\])?)\]/.exec(src.slice(i, i + 80));
        if (tm) { i += tm[0].length; return node('type', s0, i, { name: tm[1] }); }
      }
      // a bare word where a value was expected
      var w = peekWord();
      unexpected(w, i, Math.max(1, w.length));
      return null;
    }
    /* @{ a = 1; b = 2 } : i is just after @{ */
    function parseHash(s0) {
      var pairs = [];
      cs.push('}');
      for (;;) {
        skipSeps();
        if (i >= n) more();
        if (src.charAt(i) === '}') { i++; break; }
        // key: a bare word, a string or a number
        var kn, c = src.charAt(i);
        if (c === '"' || c === "'" || c === '$') kn = primary();
        else {
          var km = /^[^\s=;}]+/.exec(src.slice(i));
          if (!km) unexpected(c, i, 1);
          kn = node('str', i, i + km[0].length, { v: km[0] });
          i += km[0].length;
        }
        skipSpaces();
        if (src.charAt(i) !== '=') { if (i >= n) more(); unexpected(src.charAt(i) || '}', i, 1); }
        i++;
        skipWsNl();
        if (i >= n) more();
        var val = parseStatement();
        if (!val) more();
        pairs.push([kn, val]);
      }
      cs.pop();
      return node('hash', s0, i, { pairs: pairs });
    }

    try {
      res.stmts = statementsUntil(null);
    } catch (e) {
      if (e !== ABORT) throw e;
      res.stmts = [];
    }
    return res;
  }

  /* ------------------------------------------------------------ parameter specs and binding
     Real PowerShell resolves -f to -Filter / -Force, -a to the dynamic file-system parameters, and so on. The tables below are
     ordered like the real cmdlets so the "ambiguous" lists read the same (Remove-Item: -Filter -Force, Move-Item: -Force -Filter). */
  var T_STR = 'System.String', T_ARR = 'System.String[]';
  function sw(n, al) { return { n: n, sw: true, al: al || [] }; }
  function val(n, o) { o = o || {}; o.n = n; o.al = o.al || []; return o; }
  var COMMON = [
    { n: 'Verbose', sw: true, al: ['vb'] }, { n: 'Debug', sw: true, al: ['db'] },
    { n: 'ErrorAction', al: ['ea'], type: 'System.Management.Automation.ActionPreference', common: true },
    { n: 'WarningAction', al: ['wa'], type: 'System.Management.Automation.ActionPreference', common: true },
    { n: 'InformationAction', al: ['infa'], type: 'System.Management.Automation.ActionPreference', common: true },
    { n: 'ErrorVariable', al: ['ev'], type: T_STR, common: true }, { n: 'WarningVariable', al: ['wv'], type: T_STR, common: true },
    { n: 'InformationVariable', al: ['iv'], type: T_STR, common: true }, { n: 'OutVariable', al: ['ov'], type: T_STR, common: true },
    { n: 'OutBuffer', al: ['ob'], type: 'System.Int32', common: true }, { n: 'PipelineVariable', al: ['pv'], type: T_STR, common: true }
  ];
  var RISK = [sw('WhatIf', ['wi']), sw('Confirm', ['cf'])];

  var SPEC = {};
  SPEC.ls = { name: 'Get-ChildItem', cls: NS + 'GetChildItemCommand', exact: { d: 'Depth' }, params: [
    val('Path', { pos: 0, arr: true, type: T_ARR }), val('LiteralPath', { arr: true, type: T_ARR, al: ['PSPath'] }), val('Filter', { pos: 1, type: T_STR }),
    val('Include', { arr: true, type: T_ARR }), val('Exclude', { arr: true, type: T_ARR }), sw('Recurse', ['s']), val('Depth', { type: 'System.UInt32' }),
    sw('Force'), sw('Name'), sw('UseTransaction', ['usetx']),
    val('Attributes', { dyn: true, type: 'System.Management.Automation.FlagsExpression`1[System.IO.FileAttributes]' }),
    { n: 'Directory', sw: true, al: ['ad'], dyn: true }, { n: 'File', sw: true, al: ['af'], dyn: true }, { n: 'Hidden', sw: true, al: ['ah'], dyn: true },
    { n: 'ReadOnly', sw: true, al: ['ar'], dyn: true }, { n: 'System', sw: true, al: ['as'], dyn: true }] };
  SPEC.gi = { name: 'Get-Item', cls: NS + 'GetItemCommand', params: [
    val('Path', { pos: 0, arr: true, type: T_ARR, mand: true, pipe: true }), val('LiteralPath', { arr: true, type: T_ARR, al: ['PSPath'] }), val('Filter', { type: T_STR }),
    val('Include', { arr: true, type: T_ARR }), val('Exclude', { arr: true, type: T_ARR }), sw('Force'), sw('UseTransaction', ['usetx'])] };
  SPEC.cd = { name: 'Set-Location', cls: NS + 'SetLocationCommand', params: [
    val('Path', { pos: 0, arr: true, type: T_STR }), val('LiteralPath', { type: T_STR, al: ['PSPath'] }), sw('PassThru'), val('StackName', { type: T_STR }), sw('UseTransaction', ['usetx'])] };
  SPEC.pwd = { name: 'Get-Location', cls: NS + 'GetLocationCommand', params: [
    val('PSProvider', { arr: true, type: T_ARR }), val('PSDrive', { arr: true, type: T_ARR }), sw('Stack'), val('StackName', { arr: true, type: T_ARR }), sw('UseTransaction', ['usetx'])] };
  SPEC.pushd = { name: 'Push-Location', cls: NS + 'PushLocationCommand', params: [
    val('Path', { pos: 0, type: T_STR }), val('LiteralPath', { type: T_STR, al: ['PSPath'] }), sw('PassThru'), val('StackName', { type: T_STR }), sw('UseTransaction', ['usetx'])] };
  SPEC.popd = { name: 'Pop-Location', cls: NS + 'PopLocationCommand', params: [sw('PassThru'), val('StackName', { type: T_STR }), sw('UseTransaction', ['usetx'])] };
  SPEC.mkdir = { name: 'mkdir', cls: 'mkdir', risk: true, exact: { p: 'Path', v: 'Value' }, params: [
    val('Path', { pos: 0, arr: true, type: T_ARR, mand: true, mandUnless: 'Name' }), val('Name', { type: T_STR }), val('Value', { type: 'System.Object' }), sw('Force'),
    val('Credential', { type: 'System.Management.Automation.PSCredential' })] };
  SPEC.ni = { name: 'New-Item', cls: NS + 'NewItemCommand', risk: true, params: [
    val('Path', { pos: 0, arr: true, type: T_ARR, mand: true, pipe: true }), val('Name', { type: T_STR }), val('ItemType', { pos: 1, type: T_STR, al: ['Type'] }),
    val('Value', { pos: 2, type: 'System.Object' }), sw('Force'), val('Credential', { type: 'System.Management.Automation.PSCredential' }), sw('UseTransaction', ['usetx'])] };
  SPEC.mv = { name: 'Move-Item', cls: NS + 'MoveItemCommand', risk: true, params: [
    val('Path', { pos: 0, arr: true, type: T_ARR, mand: true, pipe: true }), val('LiteralPath', { arr: true, type: T_ARR, al: ['PSPath'] }), val('Destination', { pos: 1, type: T_STR }),
    sw('Force'), val('Filter', { type: T_STR }), val('Include', { arr: true, type: T_ARR }), val('Exclude', { arr: true, type: T_ARR }), sw('PassThru'),
    val('Credential', { type: 'System.Management.Automation.PSCredential' }), sw('UseTransaction', ['usetx'])] };
  SPEC.cp = { name: 'Copy-Item', cls: NS + 'CopyItemCommand', risk: true, params: [
    val('Path', { pos: 0, arr: true, type: T_ARR, mand: true, pipe: true }), val('LiteralPath', { arr: true, type: T_ARR, al: ['PSPath'] }), val('Destination', { pos: 1, type: T_STR }),
    sw('Container'), sw('Force'), val('Filter', { type: T_STR }), val('Include', { arr: true, type: T_ARR }), val('Exclude', { arr: true, type: T_ARR }), sw('Recurse'), sw('PassThru'),
    val('Credential', { type: 'System.Management.Automation.PSCredential' }), val('FromSession', { type: 'System.Management.Automation.Runspaces.PSSession' }),
    val('ToSession', { type: 'System.Management.Automation.Runspaces.PSSession' }), sw('UseTransaction', ['usetx'])] };
  SPEC.rm = { name: 'Remove-Item', cls: NS + 'RemoveItemCommand', risk: true, params: [
    val('Path', { pos: 0, arr: true, type: T_ARR, mand: true, pipe: true }), val('LiteralPath', { arr: true, type: T_ARR, al: ['PSPath'] }), val('Filter', { type: T_STR }),
    val('Include', { arr: true, type: T_ARR }), val('Exclude', { arr: true, type: T_ARR }), sw('Recurse'), sw('Force'),
    val('Credential', { type: 'System.Management.Automation.PSCredential' }), sw('UseTransaction', ['usetx']), val('Stream', { dyn: true, type: T_ARR, arr: true })] };
  SPEC.ren = { name: 'Rename-Item', cls: NS + 'RenameItemCommand', risk: true, params: [
    val('Path', { pos: 0, type: T_STR, mand: true }), val('LiteralPath', { type: T_STR, al: ['PSPath'] }), val('NewName', { pos: 1, type: T_STR, mand: true }), sw('Force'), sw('PassThru'),
    val('Credential', { type: 'System.Management.Automation.PSCredential' }), sw('UseTransaction', ['usetx'])] };
  SPEC.cat = { name: 'Get-Content', cls: NS + 'GetContentCommand', params: [
    val('Path', { pos: 0, arr: true, type: T_ARR, mand: true, pipe: true }), val('LiteralPath', { arr: true, type: T_ARR, al: ['PSPath'] }), val('ReadCount', { type: 'System.Int64' }),
    val('TotalCount', { type: 'System.Int64', al: ['First', 'Head'] }), val('Tail', { type: 'System.Int32', al: ['Last'] }), val('Filter', { type: T_STR }),
    val('Include', { arr: true, type: T_ARR }), val('Exclude', { arr: true, type: T_ARR }), sw('Force'), val('Credential', { type: 'System.Management.Automation.PSCredential' }),
    val('Delimiter', { type: T_STR }), sw('Wait'), sw('Raw'), val('Encoding', { type: T_STR }), sw('UseTransaction', ['usetx'])] };
  SPEC.echo = { name: 'Write-Output', cls: NS + 'WriteOutputCommand', params: [val('InputObject', { pos: 0, arr: true, rest: true, raw: true, mand: true, pipe: true, type: 'System.Object[]' }), sw('NoEnumerate')] };
  SPEC.host = { name: 'Write-Host', cls: NS + 'WriteHostCommand', params: [val('Object', { pos: 0, arr: true, rest: true, raw: true, type: 'System.Object' }), sw('NoNewline'),
    val('Separator', { type: 'System.Object' }), val('ForegroundColor', { type: 'System.ConsoleColor' }), val('BackgroundColor', { type: 'System.ConsoleColor' })] };
  SPEC.history = { name: 'Get-History', cls: NS + 'GetHistoryCommand', params: [val('Id', { pos: 0, arr: true, type: 'System.Int64[]' }), val('Count', { pos: 1, type: 'System.Int32' })] };
  SPEC.date = { name: 'Get-Date', cls: NS + 'GetDateCommand', params: [val('Date', { pos: 0, type: 'System.DateTime' }), val('Format', { type: T_STR }), val('UFormat', { type: T_STR }), sw('DisplayHint')] };
  SPEC.sleep = { name: 'Start-Sleep', cls: NS + 'StartSleepCommand', params: [val('Seconds', { pos: 0, type: 'System.Int32' }), val('Milliseconds', { type: 'System.Int32', al: ['ms'] })] };
  SPEC.testpath = { name: 'Test-Path', cls: NS + 'TestPathCommand', params: [val('Path', { pos: 0, arr: true, type: T_ARR, mand: true, pipe: true }), val('LiteralPath', { arr: true, type: T_ARR, al: ['PSPath'] }), val('Filter', { type: T_STR }),
    val('Include', { arr: true, type: T_ARR }), val('Exclude', { arr: true, type: T_ARR }), val('PathType', { type: T_STR }), sw('IsValid')] };
  SPEC.setcontent = { name: 'Set-Content', cls: NS + 'SetContentCommand', risk: true, params: [val('Path', { pos: 0, arr: true, type: T_ARR, mand: true, pipe: true }), val('Value', { pos: 1, arr: true, type: 'System.Object[]', mand: true, pipe: true }),
    val('LiteralPath', { arr: true, type: T_ARR, al: ['PSPath'] }), sw('Force'), sw('NoNewline')] };
  SPEC.addcontent = { name: 'Add-Content', cls: NS + 'AddContentCommand', risk: true, params: SPEC.setcontent.params };
  SPEC.expand = { name: 'Expand-Archive', cls: 'Expand-Archive', risk: true, params: [val('Path', { pos: 0, type: T_STR, mand: true }), val('LiteralPath', { type: T_STR, al: ['PSPath'] }),
    val('DestinationPath', { pos: 1, type: T_STR }), sw('Force')] };
  SPEC.invoke = { name: 'Invoke-Item', cls: NS + 'InvokeItemCommand', risk: true, params: [val('Path', { pos: 0, arr: true, type: T_ARR, mand: true, pipe: true }), val('LiteralPath', { arr: true, type: T_ARR, al: ['PSPath'] }),
    val('Filter', { type: T_STR }), val('Include', { arr: true, type: T_ARR }), val('Exclude', { arr: true, type: T_ARR }), val('Credential', { type: 'System.Management.Automation.PSCredential' })] };
  SPEC.start = { name: 'Start-Process', cls: NS + 'StartProcessCommand', params: [val('FilePath', { pos: 0, type: T_STR, mand: true }), val('ArgumentList', { pos: 1, arr: true, type: T_ARR, al: ['Args'] }),
    val('WorkingDirectory', { type: T_STR }), sw('Wait'), sw('PassThru'), val('Verb', { type: T_STR }), val('WindowStyle', { type: T_STR })] };

  function paramList(spec) { return spec.params.concat(spec.risk ? RISK : [], COMMON); }
  /* resolveParam(spec, typedName) -> {p} | {err:'ambiguous', list:[names]} | {err:'none'} */
  function resolveParam(spec, name) {
    var t = name.toLowerCase();
    var all = paramList(spec), i;
    for (i = 0; i < all.length; i++) {
      var p = all[i];
      if (p.n.toLowerCase() === t) return { p: p };
      for (var a = 0; a < p.al.length; a++) if (p.al[a].toLowerCase() === t) return { p: p };
    }
    if (spec.exact && hasOwn.call(spec.exact, t)) {
      for (i = 0; i < all.length; i++) if (all[i].n === spec.exact[t]) return { p: all[i] };
    }
    function prefixMatches(list) {
      var byName = list.filter(function (p) { return p.n.toLowerCase().indexOf(t) === 0; });
      var byAlias = list.filter(function (p) { return byName.indexOf(p) < 0 && p.al.some(function (al) { return al.toLowerCase().indexOf(t) === 0; }); });
      return byName.concat(byAlias);
    }
    var m = prefixMatches(all.filter(function (p) { return !p.dyn; }));
    if (!m.length) m = prefixMatches(all.filter(function (p) { return p.dyn; }));
    if (m.length === 1) return { p: m[0] };
    if (m.length > 1) return { err: 'ambiguous', list: m.map(function (p) { return p.n; }) };
    return { err: 'none' };
  }

  /* ------------------------------------------------------------ variables, environment */
  var ENVV = { USERNAME: USER, USERPROFILE: 'C:\\Users\\' + USER, HOMEPATH: '\\Users\\' + USER, HOMEDRIVE: 'C:', COMPUTERNAME: HOST, USERDOMAIN: HOST, OS: 'Windows_NT',
    SYSTEMROOT: 'C:\\WINDOWS', WINDIR: 'C:\\WINDOWS', SYSTEMDRIVE: 'C:', TEMP: 'C:\\Users\\' + USER + '\\AppData\\Local\\Temp', TMP: 'C:\\Users\\' + USER + '\\AppData\\Local\\Temp',
    APPDATA: 'C:\\Users\\' + USER + '\\AppData\\Roaming', LOCALAPPDATA: 'C:\\Users\\' + USER + '\\AppData\\Local', PROGRAMFILES: 'C:\\Program Files', 'PROGRAMFILES(X86)': 'C:\\Program Files (x86)',
    PROGRAMDATA: 'C:\\ProgramData', PUBLIC: 'C:\\Users\\Public', PROCESSOR_ARCHITECTURE: 'AMD64', NUMBER_OF_PROCESSORS: '12', PROCESSOR_IDENTIFIER: 'Intel64 Family 6 Model 170 Stepping 4, GenuineIntel',
    COMSPEC: 'C:\\WINDOWS\\system32\\cmd.exe', PATHEXT: '.COM;.EXE;.BAT;.CMD;.VBS;.VBE;.JS;.JSE;.WSF;.WSH;.MSC;.CPL', LOGONSERVER: '\\\\' + HOST, SESSIONNAME: 'Console',
    PATH: 'C:\\WINDOWS\\system32;C:\\WINDOWS;C:\\WINDOWS\\System32\\Wbem;C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\;C:\\WINDOWS\\System32\\OpenSSH\\;C:\\Users\\' + USER + '\\AppData\\Local\\Microsoft\\WindowsApps',
    PSMODULEPATH: 'C:\\Users\\' + USER + '\\Documents\\WindowsPowerShell\\Modules;C:\\Program Files\\WindowsPowerShell\\Modules;C:\\WINDOWS\\system32\\WindowsPowerShell\\v1.0\\Modules' };
  var SCOPE_RE = /^(global|script|local|private):/i;
  function psVersionTable() {
    return new PSHash([['PSVersion', versionObj('5.1.26100.6584')], ['PSEdition', 'Desktop'], ['PSCompatibleVersions', [versionObj('1.0'), versionObj('2.0'), versionObj('3.0'), versionObj('4.0'), versionObj('5.0'), versionObj('5.1.26100.6584')]],
      ['BuildVersion', versionObj('10.0.26100.6584')], ['CLRVersion', versionObj('4.0.30319.42000')], ['WSManStackVersion', versionObj('3.0')], ['PSRemotingProtocolVersion', versionObj('2.3')], ['SerializationVersion', versionObj('1.1.0.1')]]);
  }
  function pathInfoObj(session) {
    var p = dispCwd(session);
    return new PSObj('System.Management.Automation.PathInfo', [['Drive', 'C'], ['Provider', 'Microsoft.PowerShell.Core\\FileSystem'], ['ProviderPath', p], ['Path', p]], { str: function () { return p; }, fmt: 'path1' });
  }
  function getVar(session, name) {
    var n = String(name).replace(SCOPE_RE, ''), l = n.toLowerCase();
    if (l.indexOf('env:') === 0) { var k = n.slice(4).toUpperCase(); var ev0 = session.envv; return ev0 && hasOwn.call(ev0, k) ? ev0[k] : null; }
    if (l === 'true') return true;
    if (l === 'false') return false;
    if (l === 'null') return null;
    if (l === '_' || l === 'psitem') return session.item === undefined ? null : session.item;
    if (l === 'pwd') return pathInfoObj(session);
    if (l === 'home') return 'C:\\Users\\' + USER;
    if (session.vars && hasOwn.call(session.vars, l)) return session.vars[l];
    if (l === '?') return session.status === 0;
    if (l === 'pid') return 4128;
    if (l === 'psversiontable') return psVersionTable();
    if (l === 'host') return new PSObj('System.Management.Automation.Internal.Host.InternalHost', [['Name', 'ConsoleHost'], ['Version', versionObj('5.1.26100.6584')]], { str: function () { return 'System.Management.Automation.Internal.Host.InternalHost'; }, fmt: 'table' });
    if (l === 'erroractionpreference') return 'Continue';
    if (l === 'verbosepreference' || l === 'debugpreference') return 'SilentlyContinue';
    if (l === 'warningpreference') return 'Continue';
    if (l === 'progresspreference') return 'Continue';
    if (l === 'lastexitcode') return session.lastExit === undefined ? null : session.lastExit;
    if (l === 'pshome') return 'C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0';
    if (l === 'psscriptroot' || l === 'pscommandpath') return '';
    if (l === 'args') return session.args || [];
    if (l === 'input') return session.inputObjs || [];
    if (l === 'ofs') return ' ';
    if (l === 'maximumhistorycount') return 4096;
    if (l === 'error') return session.errors ? session.errors.slice().reverse() : [];
    return null;
  }
  function setVar(session, name, value) {
    var n = String(name).replace(SCOPE_RE, ''), l = n.toLowerCase();
    if (l.indexOf('env:') === 0) {
      var k = n.slice(4).toUpperCase();
      if (value === null || value === undefined) delete session.envv[k]; else session.envv[k] = strOf(value);
      return;
    }
    if (l === 'true' || l === 'false' || l === 'null' || l === '_' || l === 'pwd' || l === 'home') {
      throw psErr({ msg: "無法覆寫變數 " + n + "，因為它是唯讀或常數。", cat: 'WriteError', target: n, ttype: 'String', activity: '', reason: 'SessionStateUnauthorizedAccessException', fq: 'VariableNotWritable' });
    }
    if (!hasOwn.call(session.vars, l)) (session.varCase || (session.varCase = {}))[l] = n;          // Tab completion shows the name as it was first written
    session.vars[l] = value;
  }

  /* ------------------------------------------------------------ a synchronous driver for nested evaluation (blocks, groups) */
  function runSync(gen) {
    var r = gen.next(), guard = 0;
    while (!r.done) { if (++guard > 200000) break; r = gen.next(); }
    return r.value;
  }
  /* run statements and collect their output objects; PS errors raised by an expression propagate when opts.propagate */
  function runSub(stmts, S, opts) {
    var objs = [];
    runSync(execStmts(stmts, S, S.job, { collect: objs, propagate: !opts || opts.propagate !== false }));
    return objs;
  }
  function unwrapOut(arr) { return arr.length === 0 ? null : (arr.length === 1 ? arr[0] : arr); }
  /* invoke a script block with $_ = item; returns the array of its output */
  function invokeBlock(b, S, item, opts) {
    var saved = S.item;
    S.item = item;
    try { return runSub(b.stmts, S, opts || { propagate: false }); } finally { S.item = saved; }
  }
  function blockTruthy(outs) { return outs.length === 0 ? false : (outs.length === 1 ? toBool(outs[0]) : true); }

  /* ------------------------------------------------------------ expression evaluator */
  function memberName(n, S) {
    var nm = n.name;
    if (nm.t === 'str') return nm.v;
    return strOf(ev(nm, S));
  }
  function withPos(e, n) {
    if (isPSError(e) && e.ps.start === undefined) { e.ps.start = n.s; e.ps.len = Math.max(1, n.e - n.s); }
    return e;
  }
  function isOfType(v, name) {
    var t = String(name).toLowerCase().replace(/^system\./, '');
    switch (t) {
      case 'int': case 'int32': return typeof v === 'number' && Math.floor(v) === v && Math.abs(v) < 2147483648;
      case 'long': case 'int64': return typeof v === 'number' && Math.floor(v) === v;
      case 'double': case 'float': case 'single': case 'decimal': return typeof v === 'number';
      case 'string': return typeof v === 'string';
      case 'bool': case 'boolean': return typeof v === 'boolean';
      case 'array': case 'object[]': return Array.isArray(v);
      case 'hashtable': return isHash(v);
      case 'datetime': return isDate(v);
      case 'timespan': return isSpan(v);
      case 'scriptblock': return isBlock(v);
      case 'pscustomobject': case 'psobject': return isObj(v) || (v !== null && v !== undefined);
      case 'char': return typeof v === 'string' && v.length === 1;
      case 'object': return v !== null && v !== undefined;
      case 'io.fileinfo': case 'system.io.fileinfo': return isObj(v) && !!v.file && v.file.st.type !== 'dir';
      case 'io.directoryinfo': case 'system.io.directoryinfo': return isObj(v) && !!v.file && v.file.st.type === 'dir';
      default: return false;
    }
  }
  function ev(n, S) {
    try { return evNode(n, S); } catch (e) { throw withPos(e, n); }
  }
  function evNode(n, S) {
    switch (n.t) {
      case 'num': return n.v;
      case 'str': return n.v;
      case 'estr': return expandParts(n.parts, S);
      case 'var': return getVar(S, n.name);
      case 'arr': return runSub(n.stmts, S);
      case 'sub': return unwrapOut(runSub(n.stmts, S));
      case 'block': return { psblock: true, stmts: n.stmts, src: n.src, s: n.s, e: n.e };
      case 'comma': return n.items.map(function (x) { return ev(x, S); });
      case 'range': return evRange(ev(n.l, S), ev(n.r, S));
      case 'type': return { pstype: { name: n.name } };
      case 'cast': return castTo(n.type, ev(n.e1, S));
      case 'hash': {
        var h = new PSHash(null);
        n.pairs.forEach(function (kv) { var k = ev(kv[0], S); h.set(k === null || k === undefined ? '' : strOf(k), unwrapOut(runSub([kv[1]], S))); });
        return h;
      }
      case 'un': return evUnary(n, S);
      case 'bin': return evBinary(n, S);
      case 'idx': return indexValue(ev(n.target, S), ev(n.index, S), n);
      case 'mem': return evMember(n, S);
      case 'call': return evCall(n, S);
      case 'inc': {
        var cur = n.target.t === 'var' ? getVar(S, n.target.name) : ev(n.target, S);
        var nv = binArith(n.op === '++' ? '+' : '-', cur === null || cur === undefined ? 0 : cur, 1);
        assignTo(n.target, nv, S);
        return n.prefix ? nv : (cur === undefined ? null : cur);
      }
      default: return null;
    }
  }
  function expandParts(parts, S) {
    var s = '';
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      if (p.k === 'lit') s += p.s;
      else if (p.k === 'var') s += strOf(getVar(S, p.name));
      else s += strOf(ev(p.ast, S));
    }
    return s;
  }
  function evRange(a, b) {
    var x = toNum(a), y = toNum(b);
    if (x === null || y === null) throw castErr(x === null ? a : b, 'System.Int32', '輸入字串格式不正確。', 'InvalidCastFromStringToInteger');
    x = Math.trunc(x); y = Math.trunc(y);
    var out = [];
    if (Math.abs(y - x) > 1000000) throw psErr({ msg: '範圍太大。', cat: 'InvalidOperation', target: '', activity: '', reason: 'RuntimeException', fq: 'RangeTooLarge' });
    if (x <= y) for (var i = x; i <= y; i++) out.push(i); else for (var j = x; j >= y; j--) out.push(j);
    return out;
  }
  function evUnary(n, S) {
    var v = ev(n.e1, S);
    switch (n.op) {
      case '!': case 'not': return !toBool(v);
      case '-': { var x = toNum(v); if (x === null) throw castErr(v, 'System.Int32', '輸入字串格式不正確。', 'InvalidCastFromStringToInteger'); return -x; }
      case '+': { var y = toNum(v); if (y === null) throw castErr(v, 'System.Int32', '輸入字串格式不正確。', 'InvalidCastFromStringToInteger'); return y; }
      case 'bnot': return ~(toNum(v) || 0);
      case 'split': return strOf(v).trim() === '' ? [] : strOf(v).trim().split(/\s+/);
      case 'join': return unroll(v).map(strOf).join('');
    }
    return null;
  }
  function evBinary(n, S) {
    var op = n.op;
    if (op === 'and') { var a1 = ev(n.l, S); return toBool(a1) ? toBool(ev(n.r, S)) : false; }
    if (op === 'or') { var a2 = ev(n.l, S); return toBool(a2) ? true : toBool(ev(n.r, S)); }
    var l = ev(n.l, S), r = ev(n.r, S), cs = !!n.cs;
    switch (op) {
      case 'xor': return toBool(l) !== toBool(r);
      case '+': case '-': case '*': case '/': case '%': return binArith(op, l, r);
      case 'f': return formatOp(strOf(l), unroll(r));
      case 'band': return (toNum(l) || 0) & (toNum(r) || 0);
      case 'bor': return (toNum(l) || 0) | (toNum(r) || 0);
      case 'bxor': return (toNum(l) || 0) ^ (toNum(r) || 0);
      case 'shl': return (toNum(l) || 0) << (toNum(r) || 0);
      case 'shr': return (toNum(l) || 0) >> (toNum(r) || 0);
      case 'join': return unroll(l).map(strOf).join(strOf(r));
      case 'split': {
        var re = netRegex(strOf(r), cs, 'g'), out = [];
        unroll(l).forEach(function (x) { strOf(x).split(re).forEach(function (p) { out.push(p); }); });
        return out;
      }
      case 'replace': {
        var pat = Array.isArray(r) ? r[0] : r, rep = Array.isArray(r) ? (r.length > 1 ? r[1] : '') : '';
        var rx = netRegex(strOf(pat), cs, 'g');
        var one = function (x) { return strOf(x).replace(rx, strOf(rep).replace(/\$\{(\w+)\}/g, '$<$1>')); };
        return Array.isArray(l) ? l.map(one) : one(l);
      }
      case 'contains': return unroll(l).some(function (x) { return psEquals(x, r, cs); });
      case 'notcontains': return !unroll(l).some(function (x) { return psEquals(x, r, cs); });
      case 'in': return unroll(r).some(function (x) { return psEquals(x, l, cs); });
      case 'notin': return !unroll(r).some(function (x) { return psEquals(x, l, cs); });
      case 'is': return r && r.pstype ? isOfType(l, r.pstype.name) : false;
      case 'isnot': return r && r.pstype ? !isOfType(l, r.pstype.name) : true;
      case 'as': try { return r && r.pstype ? castTo(r.pstype.name, l) : null; } catch (e) { return null; }
    }
    // comparison operators: an array on the left is filtered
    var test = makeCmpTest(op, r, cs, S, Array.isArray(l));
    if (!test) return null;
    if (Array.isArray(l)) return l.filter(test);
    return test(l);
  }
  /* the test function of a comparison operator (-eq -ne -gt -ge -lt -le -like -notlike -match -notmatch) against the right operand r */
  function makeCmpTest(op, r, cs, S, leftIsArray) {
    switch (op) {
      case 'eq': return function (x) { return psEquals(x, r, cs); };
      case 'ne': return function (x) { return !psEquals(x, r, cs); };
      case 'gt': return function (x) { return psCompare(x, r, cs) > 0; };
      case 'ge': return function (x) { return psCompare(x, r, cs) >= 0; };
      case 'lt': return function (x) { return psCompare(x, r, cs) < 0; };
      case 'le': return function (x) { return psCompare(x, r, cs) <= 0; };
      case 'like': return function (x) { return likeTest(strOf(x), strOf(r), cs); };
      case 'notlike': return function (x) { return !likeTest(strOf(x), strOf(r), cs); };
      case 'contains': return function (x) { return unroll(x).some(function (y) { return psEquals(y, r, cs); }); };
      case 'notcontains': return function (x) { return !unroll(x).some(function (y) { return psEquals(y, r, cs); }); };
      case 'in': return function (x) { return unroll(r).some(function (y) { return psEquals(y, x, cs); }); };
      case 'notin': return function (x) { return !unroll(r).some(function (y) { return psEquals(y, x, cs); }); };
      case 'is': return function (x) { return r && r.pstype ? isOfType(x, r.pstype.name) : false; };
      case 'isnot': return function (x) { return r && r.pstype ? !isOfType(x, r.pstype.name) : true; };
      case 'match': case 'notmatch': {
        var mre = netRegex(strOf(r), cs);
        var want = op === 'match';
        return function (x) {
          var m = mre.exec(strOf(x));
          if (m && want && !leftIsArray && S) setMatches(S, m);
          return want ? !!m : !m;
        };
      }
    }
    return null;
  }
  function setMatches(S, m) {
    var h = new PSHash(null);
    for (var i = 0; i < m.length; i++) h.set(String(i), m[i] === undefined ? '' : m[i]);
    if (m.groups) Object.keys(m.groups).forEach(function (k) { h.set(k, m.groups[k]); });
    S.vars.matches = h;
  }
  function indexValue(t, ix, n) {
    if (t === null || t === undefined) throw psErr({ msg: '無法對 Null 值的運算式進行索引。', cat: 'InvalidOperation', target: '', activity: '', reason: 'RuntimeException', fq: 'NullArrayIndex' });
    if (isHash(t)) {
      if (Array.isArray(ix)) return ix.map(function (k) { return t.get(strOf(k)); });
      return t.get(strOf(ix));
    }
    if (typeof t === 'string' && !Array.isArray(ix)) {
      var i0 = toNum(ix); if (i0 === null) return null;
      if (i0 < 0) i0 += t.length;
      return i0 >= 0 && i0 < t.length ? t.charAt(i0) : null;
    }
    var arr = Array.isArray(t) ? t : [t];
    if (Array.isArray(ix)) return ix.map(function (k) { return indexValue(arr, k, n); });
    var i = toNum(ix);
    if (i === null) return null;
    i = Math.trunc(i);
    if (i < 0) i += arr.length;
    return i >= 0 && i < arr.length ? arr[i] : null;
  }

  /* ---- members */
  function typeInfoObj(v) {
    var full = typeNameOf(v) || 'System.Object';
    var shortName = shortType(full);
    var base = typeof v === 'string' || typeof v === 'object' ? 'System.Object' : 'System.ValueType';
    if (Array.isArray(v)) base = 'System.Array';
    var o = new PSObj('System.RuntimeType', [['IsPublic', true], ['IsSerial', true], ['Name', shortName], ['BaseType', base], ['FullName', full]], { fmt: 'type', str: function () { return full; } });
    return o;
  }
  var DATE_PROPS = {
    year: function (d) { return d.getFullYear(); }, month: function (d) { return d.getMonth() + 1; }, day: function (d) { return d.getDate(); },
    hour: function (d) { return d.getHours(); }, minute: function (d) { return d.getMinutes(); }, second: function (d) { return d.getSeconds(); },
    millisecond: function (d) { return d.getMilliseconds(); }, dayofweek: function (d) { return DAY_EN[d.getDay()]; },
    dayofyear: function (d) { return Math.floor((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - new Date(d.getFullYear(), 0, 1)) / 86400000) + 1; },
    date: function (d) { return mkDate(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()); },
    timeofday: function (d) { return mkSpan(((d.getHours() * 60 + d.getMinutes()) * 60 + d.getSeconds()) * 1000 + d.getMilliseconds()); },
    ticks: function (d) { return (d.getTime() + 62135596800000) * 10000; }, kind: function () { return 'Local'; }
  };
  var SPAN_PROPS = {
    days: function (ms) { return Math.trunc(ms / 86400000); }, hours: function (ms) { return Math.trunc(ms / 3600000) % 24; }, minutes: function (ms) { return Math.trunc(ms / 60000) % 60; },
    seconds: function (ms) { return Math.trunc(ms / 1000) % 60; }, milliseconds: function (ms) { return Math.trunc(ms % 1000); },
    totaldays: function (ms) { return ms / 86400000; }, totalhours: function (ms) { return ms / 3600000; }, totalminutes: function (ms) { return ms / 60000; },
    totalseconds: function (ms) { return ms / 1000; }, totalmilliseconds: function (ms) { return ms; }, ticks: function (ms) { return ms * 10000; }
  };
  function getMember(v, name, S) {
    var l = String(name).toLowerCase();
    if (v === null || v === undefined) return null;
    if (Array.isArray(v)) {
      if (l === 'count' || l === 'length') return v.length;
      if (l === 'rank') return 1;
      var out = [];
      v.forEach(function (x) { var r = getMember(x, name, S); if (r !== null && r !== undefined) { if (Array.isArray(r)) r.forEach(function (y) { out.push(y); }); else out.push(r); } });
      return out.length ? out : null;
    }
    if (typeof v === 'string') return l === 'length' ? v.length : null;
    if (typeof v === 'number' || typeof v === 'boolean') return null;
    if (isDate(v)) { var d = new Date(v.ms); return hasOwn.call(DATE_PROPS, l) ? DATE_PROPS[l](d) : null; }
    if (isSpan(v)) return hasOwn.call(SPAN_PROPS, l) ? SPAN_PROPS[l](v.ms) : null;
    if (isHash(v)) {
      if (v.has(name)) return v.get(name);
      if (l === 'keys') return v.keys.slice();
      if (l === 'values') return v.keys.map(function (k) { return v.get(k); });
      if (l === 'count') return v.keys.length;
      return null;
    }
    if (isObj(v)) {
      if (v.file) return fileMember(v, l);
      var e = v.find(name);
      return e ? e.v : null;
    }
    return null;
  }
  function setMember(obj, name, value, node) {
    if (isHash(obj)) { obj.set(name, value); return; }
    if (isObj(obj) && !obj.file) { obj.set(name, value); return; }
    throw psErr({ msg: "在這個物件上找不到屬性 '" + name + "'。請確認該屬性存在，而且可以設定。", cat: 'InvalidOperation', target: '', activity: '', reason: 'RuntimeException', fq: 'PropertyAssignmentException' });
  }
  function assignTo(target, value, S, op) {
    var v = value;
    if (op && op !== '=') {
      var cur = target.t === 'var' ? getVar(S, target.name) : ev(target, S);
      v = binArith(op.charAt(0), cur === undefined ? null : cur, value);
    }
    if (target.t === 'var') { setVar(S, target.name, v); return; }
    if (target.t === 'mem') {
      var obj = ev(target.target, S);
      if (obj === null || obj === undefined) throw psErr({ msg: '無法在 Null 值的運算式上設定屬性。', cat: 'InvalidOperation', target: '', activity: '', reason: 'RuntimeException', fq: 'PropertyNotFound' });
      setMember(obj, memberName(target, S), v, target);
      return;
    }
    if (target.t === 'idx') {
      var coll = ev(target.target, S), ix = ev(target.index, S);
      if (isHash(coll)) { coll.set(strOf(ix), v); return; }
      if (Array.isArray(coll)) {
        var i = toNum(ix);
        if (i === null || i < 0 || i >= coll.length) throw psErr({ msg: '索引超出陣列的界限。', cat: 'InvalidOperation', target: '', activity: '', reason: 'RuntimeException', fq: 'ArrayAssignmentFailed' });
        coll[Math.trunc(i)] = v; return;
      }
      throw psErr({ msg: '無法對這個物件進行索引指派。', cat: 'InvalidOperation', target: '', activity: '', reason: 'RuntimeException', fq: 'NullArrayIndex' });
    }
    throw psErr({ msg: '指派運算式的左側無效。', cat: 'ParserError', target: '', activity: '', reason: 'RuntimeException', fq: 'InvalidLeftHandSide' });
  }
  function evMember(n, S) {
    var nm = memberName(n, S);
    if (n.stat) {
      var tv = ev(n.target, S);
      var tn = tv && tv.pstype ? tv.pstype.name : null;
      var tbl = tn ? staticTable(tn) : null;
      if (tbl && hasOwn.call(tbl.props, nm.toLowerCase())) { var pv = tbl.props[nm.toLowerCase()]; return typeof pv === 'function' ? pv(S) : pv; }
      throw psErr({ msg: "在這個型別 [" + (tn || '?') + "] 上找不到靜態屬性 '" + nm + "'。", cat: 'InvalidOperation', target: '', activity: '', reason: 'RuntimeException', fq: 'PropertyNotFound' });
    }
    var obj = ev(n.target, S);
    var mv = getMember(obj, nm, S);
    // PowerShell 3+: .Count and .Length of a single object (that has neither) are 1
    if ((mv === null || mv === undefined) && obj !== null && obj !== undefined && !Array.isArray(obj) && /^(count|length)$/i.test(nm)) return 1;
    return mv;
  }
  function evCall(n, S) {
    var nm = memberName(n, S);
    var args = n.args.map(function (a) { return ev(a, S); });
    if (n.stat) {
      var tv = ev(n.target, S);
      var tn = tv && tv.pstype ? tv.pstype.name : null;
      var tbl = tn ? staticTable(tn) : null;
      if (tbl && hasOwn.call(tbl.methods, nm.toLowerCase())) return tbl.methods[nm.toLowerCase()](args, S);
      throw psErr({ msg: "找不到 [" + (tn || '?') + "] 的靜態方法 '" + nm + "'。", cat: 'InvalidOperation', target: '', activity: '', reason: 'RuntimeException', fq: 'MethodNotFound' });
    }
    var obj = ev(n.target, S);
    return callMethod(obj, nm, args, S, n);
  }
  function noMethod(obj, nm) {
    return psErr({ msg: '方法引動過程失敗，因為 [' + (typeNameOf(obj) || 'System.Object') + "] 未包含名為 '" + nm + "' 的方法。", cat: 'InvalidOperation', target: '', activity: '', reason: 'RuntimeException', fq: 'MethodNotFound' });
  }
  function charList(v) { return Array.isArray(v) ? v.map(strOf).join('') : strOf(v); }
  var STR_METHODS = {
    toupper: function (s) { return s.toUpperCase(); }, tolower: function (s) { return s.toLowerCase(); }, toupperinvariant: function (s) { return s.toUpperCase(); }, tolowerinvariant: function (s) { return s.toLowerCase(); },
    trim: function (s, a) { if (!a.length) return s.replace(/^\s+|\s+$/g, ''); var set = charList(a); var b = 0, e = s.length; while (b < e && set.indexOf(s.charAt(b)) >= 0) b++; while (e > b && set.indexOf(s.charAt(e - 1)) >= 0) e--; return s.slice(b, e); },
    trimstart: function (s, a) { if (!a.length) return s.replace(/^\s+/, ''); var set = charList(a); var b = 0; while (b < s.length && set.indexOf(s.charAt(b)) >= 0) b++; return s.slice(b); },
    trimend: function (s, a) { if (!a.length) return s.replace(/\s+$/, ''); var set = charList(a); var e = s.length; while (e > 0 && set.indexOf(s.charAt(e - 1)) >= 0) e--; return s.slice(0, e); },
    substring: function (s, a) {
      var st = toNum(a[0]); var ln = a.length > 1 ? toNum(a[1]) : s.length - st;
      if (st < 0 || st > s.length) throw psErr({ msg: '以 "' + a.length + '" 引數呼叫 "Substring" 時發生例外狀況: "startIndex 不可小於零，或大於字串的長度。', cat: 'NotSpecified', target: '', activity: '', reason: 'MethodInvocationException', fq: 'ArgumentOutOfRangeException' });
      if (ln < 0 || st + ln > s.length) throw psErr({ msg: '以 "' + a.length + '" 引數呼叫 "Substring" 時發生例外狀況: "索引和長度必須參考字串內的位置。', cat: 'NotSpecified', target: '', activity: '', reason: 'MethodInvocationException', fq: 'ArgumentOutOfRangeException' });
      return s.substr(st, ln);
    },
    replace: function (s, a) { var from = strOf(a[0]), to = a.length > 1 ? strOf(a[1]) : ''; if (from === '') throw psErr({ msg: '以 "2" 引數呼叫 "Replace" 時發生例外狀況: "字串的長度不能為零。', cat: 'NotSpecified', target: '', activity: '', reason: 'MethodInvocationException', fq: 'ArgumentException' }); return s.split(from).join(to); },
    split: function (s, a) {
      if (!a.length) return s.split(/\s+/);
      var seps = Array.isArray(a[0]) ? a[0].map(strOf) : [strOf(a[0])];
      var parts = [s];
      seps.forEach(function (sp) { var next = []; parts.forEach(function (p) { p.split(sp).forEach(function (q) { next.push(q); }); }); parts = next; });
      return parts;
    },
    contains: function (s, a) { return s.indexOf(strOf(a[0])) >= 0; },
    startswith: function (s, a) { return s.toLowerCase().indexOf(strOf(a[0]).toLowerCase()) === 0 && true; },
    endswith: function (s, a) { var t = strOf(a[0]); return s.length >= t.length && s.slice(s.length - t.length).toLowerCase() === t.toLowerCase(); },
    indexof: function (s, a) { return s.indexOf(strOf(a[0])); }, lastindexof: function (s, a) { return s.lastIndexOf(strOf(a[0])); },
    padleft: function (s, a) { var w = toNum(a[0]), c = a.length > 1 ? strOf(a[1]) : ' '; while (displayWidth(s) < w) s = c + s; return s; },
    padright: function (s, a) { var w = toNum(a[0]), c = a.length > 1 ? strOf(a[1]) : ' '; while (displayWidth(s) < w) s = s + c; return s; },
    insert: function (s, a) { var i = toNum(a[0]); return s.slice(0, i) + strOf(a[1]) + s.slice(i); },
    remove: function (s, a) { var i = toNum(a[0]); return a.length > 1 ? s.slice(0, i) + s.slice(i + toNum(a[1])) : s.slice(0, i); },
    tochararray: function (s) { return Array.from(s); }, tostring: function (s) { return s; }, length: null,
    equals: function (s, a) { return s === strOf(a[0]); }, compareto: function (s, a) { return strCmp(s, strOf(a[0])); },
    normalize: function (s) { return s.normalize(); }, clone: function (s) { return s; }, gettype: null, gethashcode: function (s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; }
  };
  function callMethod(obj, nm, args, S, node) {
    var l = nm.toLowerCase();
    if (obj === null || obj === undefined) throw psErr({ msg: '不可在值為 Null 的運算式上呼叫方法。', cat: 'InvalidOperation', target: '', activity: '', reason: 'RuntimeException', fq: 'InvokeMethodOnNull' });
    if (l === 'gettype') return typeInfoObj(obj);
    if (l === 'tostring' && args.length === 0 && !isDate(obj) && typeof obj !== 'number') return strOf(obj);
    if (l === 'equals' && !Array.isArray(obj)) return psEquals(obj, args[0], false);
    if (l === 'gethashcode') return STR_METHODS.gethashcode(strOf(obj));
    if (typeof obj === 'string') {
      if (hasOwn.call(STR_METHODS, l) && STR_METHODS[l]) return STR_METHODS[l](obj, args);
      throw noMethod(obj, nm);
    }
    if (typeof obj === 'number') {
      if (l === 'tostring') return args.length ? formatWithSpec(obj, strOf(args[0])) : numStr(obj);
      if (l === 'compareto') return psCompare(obj, args[0]);
      throw noMethod(obj, nm);
    }
    if (typeof obj === 'boolean') { if (l === 'tostring') return strOf(obj); throw noMethod(obj, nm); }
    if (Array.isArray(obj)) {
      switch (l) {
        case 'contains': return obj.some(function (x) { return psEquals(x, args[0], false); });
        case 'indexof': for (var i = 0; i < obj.length; i++) if (psEquals(obj[i], args[0], false)) return i; return -1;
        case 'where': return obj.filter(function (x) { return blockTruthy(invokeBlock(args[0], S, x)); });
        case 'foreach': { var o = []; obj.forEach(function (x) { invokeBlock(args[0], S, x).forEach(function (y) { o.push(y); }); }); return o; }
        case 'tostring': return strOf(obj);
        case 'getenumerator': return obj;
        case 'clone': return obj.slice();
        case 'getlength': case 'getupperbound': return obj.length;
        case 'add': case 'remove': case 'removeat': case 'insert': case 'clear':
          throw psErr({ msg: '例外狀況呼叫 "' + nm + '" 的引數為 "' + args.length + '": "集合的大小是固定的。', cat: 'NotSpecified', target: '', activity: '', reason: 'MethodInvocationException', fq: 'NotSupportedException' });
      }
      throw noMethod(obj, nm);
    }
    if (isDate(obj)) {
      var d = new Date(obj.ms);
      switch (l) {
        case 'tostring': return args.length ? formatDate(obj.ms, strOf(args[0])) : formatDate(obj.ms, '');
        case 'addyears': { var y = new Date(d); y.setFullYear(y.getFullYear() + toNum(args[0])); return mkDate(y.getTime()); }
        case 'addmonths': { var m = new Date(d); m.setMonth(m.getMonth() + toNum(args[0])); return mkDate(m.getTime()); }
        case 'adddays': return mkDate(obj.ms + toNum(args[0]) * 86400000);
        case 'addhours': return mkDate(obj.ms + toNum(args[0]) * 3600000);
        case 'addminutes': return mkDate(obj.ms + toNum(args[0]) * 60000);
        case 'addseconds': return mkDate(obj.ms + toNum(args[0]) * 1000);
        case 'addmilliseconds': return mkDate(obj.ms + toNum(args[0]));
        case 'toshortdatestring': return dShortDate(d);
        case 'tolongdatestring': return dLongDate(d);
        case 'toshorttimestring': return dShortTime(d);
        case 'tolongtimestring': return dLongTime(d);
        case 'touniversaltime': return mkDate(obj.ms - 8 * 3600000);
        case 'tolocaltime': return obj;
        case 'subtract': return isDate(args[0]) ? mkSpan(obj.ms - args[0].ms) : mkDate(obj.ms - (args[0] ? args[0].ms : 0));
        case 'compareto': return psCompare(obj, args[0]);
      }
      throw noMethod(obj, nm);
    }
    if (isSpan(obj)) { if (l === 'tostring') return spanStr(obj.ms); throw noMethod(obj, nm); }
    if (isHash(obj)) {
      switch (l) {
        case 'containskey': return obj.has(strOf(args[0]));
        case 'containsvalue': return obj.keys.some(function (k) { return psEquals(obj.get(k), args[0], false); });
        case 'add': if (obj.has(strOf(args[0]))) throw psErr({ msg: '例外狀況呼叫 "Add" 的引數為 "2": "已經新增具有相同索引鍵的項目。', cat: 'NotSpecified', target: '', activity: '', reason: 'MethodInvocationException', fq: 'ArgumentException' }); obj.set(strOf(args[0]), args[1]); return null;
        case 'remove': obj.del(strOf(args[0])); return null;
        case 'clear': obj.keys = []; obj.m = Object.create(null); return null;
        case 'tostring': return 'System.Collections.Hashtable';
        case 'getenumerator': return obj.keys.map(function (k) { return mkObj([['Name', k], ['Value', obj.get(k)]], 'System.Collections.DictionaryEntry'); });
      }
      throw noMethod(obj, nm);
    }
    if (isBlock(obj)) {
      if (l === 'invoke' || l === 'invokereturnasis') { var res = invokeBlock(obj, S, S.item, { propagate: true }); return res.length === 1 ? res[0] : res; }
      throw noMethod(obj, nm);
    }
    if (isObj(obj)) {
      if (obj.file) {
        if (l === 'delete') { try { S.vfs.remove(obj.file.st.path, { by: 'terminal', recursive: false }); } catch (e) { throw psErr({ msg: '例外狀況呼叫 "Delete" 的引數為 "0": "' + (e && e.code === 'ENOTEMPTY' ? '目錄不是空的。' : '拒絕存取路徑。') + '"', cat: 'NotSpecified', target: '', activity: '', reason: 'MethodInvocationException', fq: 'IOException' }); } return null; }
        if (l === 'tostring') return obj.file.disp;
      }
      if (l === 'tostring') return objStr(obj);
    }
    throw noMethod(obj, nm);
  }

  /* ---- static members: [math]::Round, [DateTime]::Now ... */
  function num1(a) { var x = toNum(a); if (x === null) throw castErr(a, 'System.Double', '輸入字串格式不正確。', 'InvalidCastFromStringToDouble'); return x; }
  var STATICS = {
    math: {
      props: { pi: Math.PI, e: Math.E },
      methods: {
        round: function (a) { var x = num1(a[0]), d = a.length > 1 ? toNum(a[1]) : 0; var f = Math.pow(10, d); return roundEven(x * f) / f; },
        floor: function (a) { return Math.floor(num1(a[0])); }, ceiling: function (a) { return Math.ceil(num1(a[0])); }, truncate: function (a) { return Math.trunc(num1(a[0])); },
        abs: function (a) { return Math.abs(num1(a[0])); }, max: function (a) { return Math.max(num1(a[0]), num1(a[1])); }, min: function (a) { return Math.min(num1(a[0]), num1(a[1])); },
        sqrt: function (a) { return Math.sqrt(num1(a[0])); }, pow: function (a) { return Math.pow(num1(a[0]), num1(a[1])); }, sign: function (a) { return Math.sign(num1(a[0])); },
        log: function (a) { return a.length > 1 ? Math.log(num1(a[0])) / Math.log(num1(a[1])) : Math.log(num1(a[0])); }, log10: function (a) { return Math.log10(num1(a[0])); }, exp: function (a) { return Math.exp(num1(a[0])); },
        sin: function (a) { return Math.sin(num1(a[0])); }, cos: function (a) { return Math.cos(num1(a[0])); }, tan: function (a) { return Math.tan(num1(a[0])); }
      }
    },
    datetime: {
      props: { now: function () { return mkDate(LAB.clock.ms()); }, today: function () { var d = new Date(LAB.clock.ms()); return mkDate(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()); }, utcnow: function () { return mkDate(LAB.clock.ms() - 8 * 3600000); }, minvalue: mkDate(new Date(1, 0, 1).getTime()) },
      methods: {
        parse: function (a) { var ms = parseDateStr(strOf(a[0])); if (ms === null) throw castErr(a[0], 'System.DateTime', '字串未被辨識為有效的 DateTime。', 'InvalidCastParseTargetInvocationWithFormatProvider'); return mkDate(ms); },
        daysinmonth: function (a) { return new Date(toNum(a[0]), toNum(a[1]), 0).getDate(); },
        isleapyear: function (a) { var y = toNum(a[0]); return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0; }
      }
    },
    environment: {
      props: { newline: '\r\n', username: USER, machinename: HOST, currentdirectory: function (S) { return dispCwd(S); }, osversion: mkObj([['Platform', 'Win32NT'], ['ServicePack', ''], ['Version', versionObj('10.0.26200.0')], ['VersionString', 'Microsoft Windows NT 10.0.26200.0']], 'System.OperatingSystem', { str: function () { return 'Microsoft Windows NT 10.0.26200.0'; } }), is64bitoperatingsystem: true, processorcount: 12, tickcount: function () { return Math.floor(performance.now()); } },
      methods: {
        getfolderpath: function (a) {
          var k = strOf(a[0]).toLowerCase(), base = 'C:\\Users\\' + USER;
          var map = { desktop: base + '\\Desktop', desktopdirectory: base + '\\Desktop', mydocuments: base + '\\Documents', personal: base + '\\Documents', mypictures: base + '\\Pictures', mymusic: base + '\\Music', myvideos: base + '\\Videos',
            userprofile: base, applicationdata: base + '\\AppData\\Roaming', localapplicationdata: base + '\\AppData\\Local', programfiles: 'C:\\Program Files', windows: 'C:\\WINDOWS', system: 'C:\\WINDOWS\\system32', favorites: base + '\\Favorites' };
          return hasOwn.call(map, k) ? map[k] : '';
        },
        getenvironmentvariable: function (a, S) { var k = strOf(a[0]).toUpperCase(); return S.envv && hasOwn.call(S.envv, k) ? S.envv[k] : null; },
        exit: function () { return null; }
      }
    },
    string: {
      props: { empty: '' },
      methods: {
        join: function (a) { var rest = a.length === 2 && Array.isArray(a[1]) ? a[1] : a.slice(1); return rest.map(strOf).join(strOf(a[0])); },
        isnullorempty: function (a) { return a[0] === null || a[0] === undefined || strOf(a[0]) === ''; },
        isnullorwhitespace: function (a) { return a[0] === null || a[0] === undefined || strOf(a[0]).trim() === ''; },
        concat: function (a) { return a.map(strOf).join(''); },
        format: function (a) { return formatOp(strOf(a[0]), a.slice(1)); }, compare: function (a) { return strCmp(strOf(a[0]), strOf(a[1])); }
      }
    },
    convert: {
      props: {},
      methods: {
        toint32: function (a) { return castTo('int', a[0]); }, toint64: function (a) { return castTo('long', a[0]); }, todouble: function (a) { return castTo('double', a[0]); },
        tostring: function (a) { return strOf(a[0]); }, toboolean: function (a) { return toBool(a[0]); }, todatetime: function (a) { return castTo('datetime', a[0]); }
      }
    },
    path: {
      props: {},
      methods: {
        getfilename: function (a) { var s = strOf(a[0]); return s.slice(Math.max(s.lastIndexOf('\\'), s.lastIndexOf('/')) + 1); },
        getfilenamewithoutextension: function (a) { var s = strOf(a[0]); s = s.slice(Math.max(s.lastIndexOf('\\'), s.lastIndexOf('/')) + 1); var d = s.lastIndexOf('.'); return d > 0 ? s.slice(0, d) : s; },
        getextension: function (a) { var s = strOf(a[0]); s = s.slice(Math.max(s.lastIndexOf('\\'), s.lastIndexOf('/')) + 1); var d = s.lastIndexOf('.'); return d >= 0 ? s.slice(d) : ''; },
        getdirectoryname: function (a) { var s = strOf(a[0]); var i = Math.max(s.lastIndexOf('\\'), s.lastIndexOf('/')); return i < 0 ? '' : s.slice(0, i); },
        combine: function (a) { var out = ''; a.forEach(function (x) { x = strOf(x); out = out === '' || /^[A-Za-z]:\\|^\\/.test(x) ? x : joinDisp(out, x); }); return out; },
        getfullpath: function (a, S) { var r = resolvePath(S, strOf(a[0])); return r.disp; }, gettempath: function () { return 'C:\\Users\\' + USER + '\\AppData\\Local\\Temp\\'; }
      }
    },
    file: {
      props: {},
      methods: {
        exists: function (a, S) { var r = resolvePath(procSession(S), strOf(a[0])); var st = r.err ? null : S.vfs.stat(r.abs); return !!st && st.type !== 'dir'; },
        readalltext: function (a, S) { return netRead(a[0], S, 'ReadAllText'); },
        readalllines: function (a, S) { return netRead(a[0], S, 'ReadAllLines').replace(/\r\n/g, '\n').replace(/\n$/, '').split('\n'); },
        writealltext: function (a, S) { netWrite(a[0], strOf(a[1]), S, false); return null; },
        appendalltext: function (a, S) { netWrite(a[0], strOf(a[1]), S, true); return null; },
        delete: function (a, S) { var r = resolvePath(procSession(S), strOf(a[0])); try { S.vfs.remove(r.abs, { by: 'terminal', force: true }); } catch (e) { /* ignore */ } return null; }
      }
    },
    directory: {
      props: {},
      methods: {
        exists: function (a, S) { var r = resolvePath(procSession(S), strOf(a[0])); return !r.err && S.vfs.isDir(r.abs); },
        getcurrentdirectory: function (a, S) { return dispCwd(S); }
      }
    },
    guid: { props: {}, methods: { newguid: function () { var h = function (n) { var s = ''; for (var i = 0; i < n; i++) s += Math.floor(Math.random() * 16).toString(16); return s; }; return h(8) + '-' + h(4) + '-4' + h(3) + '-a' + h(3) + '-' + h(12); } } },
    int: { props: { maxvalue: 2147483647, minvalue: -2147483648 }, methods: { parse: function (a) { return castTo('int', a[0]); }, tryparse: function () { return false; } } },
    double: { props: { maxvalue: 1.7976931348623157e308, minvalue: -1.7976931348623157e308, positiveinfinity: Infinity, negativeinfinity: -Infinity, nan: NaN }, methods: { parse: function (a) { return castTo('double', a[0]); } } },
    regex: {
      props: {},
      methods: {
        match: function (a) { var m = netRegex(strOf(a[1]), true).exec(strOf(a[0])); return m ? mkObj([['Success', true], ['Value', m[0]], ['Index', m.index], ['Length', m[0].length]], 'System.Text.RegularExpressions.Match', { str: function () { return m[0]; }, fmt: 'table' }) : mkObj([['Success', false], ['Value', ''], ['Index', 0], ['Length', 0]], 'System.Text.RegularExpressions.Match', { str: function () { return ''; }, fmt: 'table' }); },
        ismatch: function (a) { return netRegex(strOf(a[1]), true).test(strOf(a[0])); },
        replace: function (a) { return strOf(a[0]).replace(netRegex(strOf(a[1]), true, 'g'), strOf(a[2])); },
        split: function (a) { return strOf(a[0]).split(netRegex(strOf(a[1]), true, 'g')); },
        escape: function (a) { return strOf(a[0]).replace(/[\\^$.*+?()[\]{}|#\s]/g, '\\$&'); }
      }
    },
    array: { props: {}, methods: { reverse: function (a) { if (Array.isArray(a[0])) a[0].reverse(); return null; }, indexof: function (a) { var arr = unroll(a[0]); for (var i = 0; i < arr.length; i++) if (psEquals(arr[i], a[1], false)) return i; return -1; } } },
    bool: { props: {}, methods: { parse: function (a) { var s = strOf(a[0]).toLowerCase(); if (s === 'true') return true; if (s === 'false') return false; throw castErr(a[0], 'System.Boolean', '字串未被辨識為有效的 Boolean。', 'InvalidCastParseTargetInvocation'); } } },
    char: { props: {}, methods: { isdigit: function (a) { return /^\d$/.test(strOf(a[0]).charAt(0)); }, isletter: function (a) { return /^[A-Za-z\u00c0-\uffff]$/.test(strOf(a[0]).charAt(0)); }, toupper: function (a) { return strOf(a[0]).toUpperCase(); }, tolower: function (a) { return strOf(a[0]).toLowerCase(); } } }
  };
  var STATIC_ALIAS = { 'system.math': 'math', 'system.datetime': 'datetime', 'system.environment': 'environment', 'system.string': 'string', 'system.convert': 'convert', 'io.path': 'path', 'system.io.path': 'path',
    'io.file': 'file', 'system.io.file': 'file', 'io.directory': 'directory', 'system.io.directory': 'directory', 'system.guid': 'guid', 'int32': 'int', 'system.int32': 'int', 'system.double': 'double',
    'system.text.regularexpressions.regex': 'regex', 'system.array': 'array', 'system.boolean': 'bool', 'boolean': 'bool', 'system.char': 'char', 'single': 'double', 'long': 'int', 'int64': 'int', 'decimal': 'double' };
  function staticTable(name) {
    var l = String(name).toLowerCase();
    if (hasOwn.call(STATIC_ALIAS, l)) l = STATIC_ALIAS[l];
    return hasOwn.call(STATICS, l) ? STATICS[l] : null;
  }
  function procSession(S) { return { vfs: S.vfs, cwd: S.procCwd || HOME, shown: splitSegs(S.procCwd || HOME) }; }
  function netRead(path, S, method) {
    var r = resolvePath(procSession(S), strOf(path)), st = r.err ? null : S.vfs.stat(r.abs);
    if (!st || st.type === 'dir') throw psErr({ msg: '以 "1" 引數呼叫 "' + method + '" 時發生例外狀況: "找不到檔案 \'' + r.disp + '\'。"', cat: 'NotSpecified', target: '', activity: '', reason: 'MethodInvocationException', fq: 'FileNotFoundException' });
    return S.vfs.readFile(st.path, { by: 'terminal' });
  }
  function netWrite(path, text, S, append) {
    var r = resolvePath(procSession(S), strOf(path));
    try { S.vfs.writeFile(r.abs, text, { by: 'terminal', append: append }); }
    catch (e) { throw psErr({ msg: '以 "2" 引數呼叫 "WriteAllText" 時發生例外狀況: "找不到路徑 \'' + r.disp + '\' 的一部分。"', cat: 'NotSpecified', target: '', activity: '', reason: 'MethodInvocationException', fq: 'DirectoryNotFoundException' }); }
  }

  /* ------------------------------------------------------------ file items (the objects Get-ChildItem / Get-Item / New-Item return) */
  var UTC_SHIFT = 8 * 3600000;                         // the practice PC is in Taipei (UTC+8)
  function fileObj(st, disp) {
    return new PSObj(st.type === 'dir' ? 'System.IO.DirectoryInfo' : 'System.IO.FileInfo', [], { file: { st: st, disp: disp }, fmt: 'file' });
  }
  function isFileObj(v) { return v instanceof PSObj && !!v.file; }
  function fileDir(o) { return parentDisp(o.file.disp); }
  /* all properties of an item, in the order Select-Object * / Format-List * shows them (captured from real PowerShell 5.1) */
  function fileProps(o) {
    if (o.cache) return o.cache;
    var st = o.file.st, disp = o.file.disp, isDir = st.type === 'dir', parent = parentDisp(disp), nm = st.name;
    var ext = '', dot = nm.lastIndexOf('.');
    if (!isDir && dot > 0) ext = nm.slice(dot);
    var base = isDir ? nm : (dot > 0 ? nm.slice(0, dot) : nm);
    var ro = modeOf(st).charAt(2) === 'r';
    var attrs = isDir ? (ro ? 'ReadOnly, Directory' : 'Directory') : (ro ? 'ReadOnly, Archive' : 'Archive');
    var ctime = st.ctime || st.mtime;
    var pairs = [['PSPath', 'Microsoft.PowerShell.Core\\FileSystem::' + disp], ['PSParentPath', 'Microsoft.PowerShell.Core\\FileSystem::' + parent], ['PSChildName', nm], ['PSDrive', 'C'],
      ['PSProvider', 'Microsoft.PowerShell.Core\\FileSystem'], ['PSIsContainer', isDir], ['Mode', modeOf(st)]];
    if (!isDir) pairs.push(['VersionInfo', 'File:             ' + disp + '\nInternalName:     \nOriginalFilename: \nFileVersion:      \nFileDescription:  \nProduct:          \nProductVersion:   \nDebug:            False\nPatched:          False\nPreRelease:       False\nPrivateBuild:     False\nSpecialBuild:     False\nLanguage:         \n']);
    pairs.push(['BaseName', base], ['Target', []], ['LinkType', null], ['Name', nm]);
    if (!isDir) pairs.push(['Length', st.size], ['DirectoryName', parent], ['Directory', parent], ['IsReadOnly', ro]);
    else pairs.push(['FullName', disp], ['Parent', shortParent(parent)]);
    if (!isDir) pairs.push(['Exists', true], ['FullName', disp]); else pairs.push(['Exists', true], ['Root', 'C:\\']);
    pairs.push(['Extension', ext], ['CreationTime', mkDate(ctime)], ['CreationTimeUtc', mkDate(ctime - UTC_SHIFT)], ['LastAccessTime', mkDate(st.mtime)], ['LastAccessTimeUtc', mkDate(st.mtime - UTC_SHIFT)],
      ['LastWriteTime', mkDate(st.mtime)], ['LastWriteTimeUtc', mkDate(st.mtime - UTC_SHIFT)], ['Attributes', attrs]);
    o.cache = pairs;
    return pairs;
  }
  function shortParent(p) { var i = p.lastIndexOf('\\'); return i < 0 || p.length <= 3 ? p : p.slice(i + 1); }
  function fileMember(o, lname) {
    var ps = fileProps(o);
    for (var i = 0; i < ps.length; i++) if (ps[i][0].toLowerCase() === lname) return ps[i][1];
    if (lname === 'psiscontainer') return o.file.st.type === 'dir';
    return null;
  }
  function fileNamesFor(o) { return fileProps(o).map(function (p) { return p[0]; }); }
  /* the names of the properties an object has (for Select-Object *, Format-List *, wildcards) */
  function propNames(v) {
    if (isObj(v)) return v.file ? fileNamesFor(v) : v.names();
    if (isHash(v)) return v.keys.map(strOf);
    if (isDate(v)) return ['DisplayHint', 'DateTime', 'Date', 'Day', 'DayOfWeek', 'DayOfYear', 'Hour', 'Kind', 'Millisecond', 'Minute', 'Month', 'Second', 'Ticks', 'TimeOfDay', 'Year'];
    if (isSpan(v)) return ['Days', 'Hours', 'Milliseconds', 'Minutes', 'Seconds', 'Ticks', 'TotalDays', 'TotalHours', 'TotalMilliseconds', 'TotalMinutes', 'TotalSeconds'];
    if (typeof v === 'string') return ['Length'];
    return [];
  }

  /* ------------------------------------------------------------ rendering (Out-Default): objects -> the text PowerShell prints */
  function rtrim(s) { return s.replace(/\s+$/, ''); }
  function isNumeric(v) { return typeof v === 'number'; }
  /* a table of strings: cols = [{h, cells[], right}] ; shrinks to `width` columns like Format-Table does (cells cut with ...) */
  function tableLinesOf(cols, width, opt) {
    opt = opt || {};
    var sep = opt.sep === undefined ? 1 : opt.sep, w = cols.map(function (c) { return Math.max(displayWidth(c.h), Math.max.apply(null, [0].concat(c.cells.map(displayWidth)))); });
    var total = w.reduce(function (a, b) { return a + b; }, 0) + sep * (cols.length - 1);
    var limit = Math.max(20, (width || 120) - 1);
    var guard = 0;
    while (total > limit && guard++ < 500) {
      var mi = 0; for (var q = 1; q < w.length; q++) if (w[q] > w[mi]) mi = q;
      if (w[mi] <= 4) break;
      w[mi]--; total--;
    }
    function fit(s, wd) {
      if (displayWidth(s) <= wd) return s;
      var out = '', cw0 = 0, room = Math.max(0, wd - 3);
      for (var ch of s) { var c1 = charWidth(ch.codePointAt(0)); if (cw0 + c1 > room) break; out += ch; cw0 += c1; }
      return out + '...';
    }
    var gap = new Array(sep + 1).join(' ');
    function line(vals, dashes) {
      var parts = cols.map(function (c, i) {
        var t = dashes ? new Array(displayWidth(c.h) + 1).join('-') : fit(vals[i], w[i]);
        return c.right ? padL(t, w[i]) : padR(t, w[i]);
      });
      return rtrim(parts.join(gap));
    }
    var lines = [];
    if (!opt.noHeader) { lines.push(line(cols.map(function (c) { return c.h; })), line(null, true)); }
    var rows = cols.length ? cols[0].cells.length : 0;
    for (var r = 0; r < rows; r++) lines.push(line(cols.map(function (c) { return c.cells[r]; })));
    return lines;
  }
  /* a column / line descriptor: a property name, or {h: label, fn: item -> value} for a calculated property */
  function namedCol(nm) { return { h: nm, fixed: true, fn: function (it) { return getMember(it, nm, null); } }; }
  function colsOf(names) { return names.map(function (n) { return typeof n === 'string' ? namedCol(n) : n; }); }
  function genericTable(items, names, width, opt) {
    var cols = colsOf(names || propNames(items[0])).map(function (c) {
      var vals = items.map(c.fn);
      return { h: c.h, right: isNumeric(vals[0]), cells: vals.map(cellStr) };
    });
    var lines = tableLinesOf(cols, width, opt);
    return '\n' + lines.join('\n') + '\n\n\n';
  }
  /* Format-List: two blank lines, the records separated by one blank line, then three blank lines (captured from Windows PowerShell 5.1) */
  function listText(items, names, width) {
    var recs = [];
    items.forEach(function (it) {
      var cols = colsOf(names || propNames(it));
      cols = cols.filter(function (c) {
        if (isObj(it) && it.file && c.fixed) return fileNamesFor(it).some(function (x) { return x.toLowerCase() === c.h.toLowerCase(); });
        return true;
      });
      if (!cols.length) return;
      var lw = Math.max.apply(null, cols.map(function (c) { return displayWidth(c.h); }));
      var lines = [];
      cols.forEach(function (c) {
        var text = cellStr(c.fn(it));
        var wrapped = [];
        text.split('\n').forEach(function (sg) { wrapCells(sg, Math.max(10, width - lw - 3)).forEach(function (r) { wrapped.push(r); }); });
        wrapped.forEach(function (r, i) { lines.push(rtrim(i === 0 ? padR(c.h, lw) + ' : ' + r : new Array(lw + 4).join(' ') + r)); });
      });
      recs.push(lines.join('\n'));
    });
    return recs.length ? '\n\n' + recs.join('\n\n') + '\n\n\n\n' : '';
  }
  function hasWildChars(s) { return /[*?\[]/.test(s); }
  function flattenForRender(objs) {
    var out = [];
    (function rec(a) { a.forEach(function (x) { if (Array.isArray(x)) rec(x); else if (x !== null && x !== undefined) out.push(x); }); })(objs);
    return out;
  }
  /* which printing rule an item follows; consecutive items of the same class are printed together */
  function renderClass(v) {
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return 'text';
    if (isHash(v)) return 'hash';
    if (isDate(v)) return 'date';
    if (isSpan(v)) return 'span';
    if (isBlock(v)) return 'text';
    if (isObj(v)) {
      if (v.file) return 'file';
      if (v.fmt === 'formatted') return 'formatted';
      if (v.fmt) return v.fmt + (v.fmt === 'table' || v.fmt === 'type' ? ':' + v.names().join('|') : '');
      return 'gen:' + v.names().join('|');
    }
    if (v && v.t === 'pathinfo') return 'text';
    return 'text';
  }
  function renderObjs(objs, S, width) {
    var items = flattenForRender(objs);
    width = width || (S && S.cols) || 120;
    var out = '', i = 0;
    while (i < items.length) {
      var cl = renderClass(items[i]), j = i;
      while (j < items.length && renderClass(items[j]) === cl) j++;
      out += renderGroup(cl, items.slice(i, j), S, width);
      i = j;
    }
    return out;
  }
  function renderGroup(cl, group, S, width) {
    var first = group[0];
    if (cl === 'text') return group.map(function (x) { return strOf(x) + '\n'; }).join('');
    if (cl === 'file') {
      var groups = [];
      group.forEach(function (o) {
        var d = fileDir(o), g = groups[groups.length - 1];
        if (!g || g.dir !== d) { g = { dir: d, items: [] }; groups.push(g); }
        g.items.push(o.file.st);
      });
      return tableText(groups);
    }
    if (cl === 'formatted') return group.map(function (o) { return o.text; }).join('');
    if (cl === 'hash') return group.map(function (h) {
      if (!h.keys.length) return '';
      return '\n' + hashLines(h, width).join('\n') + '\n\n\n';
    }).join('');
    if (cl === 'date') return group.map(function (d) { return '\n' + formatDate(d.ms, 'F') + '\n\n\n'; }).join('');
    if (cl === 'span') return listText(group.map(function (sp) {
      return mkObj([['Days', SPAN_PROPS.days(sp.ms)], ['Hours', SPAN_PROPS.hours(sp.ms)], ['Minutes', SPAN_PROPS.minutes(sp.ms)], ['Seconds', SPAN_PROPS.seconds(sp.ms)], ['Milliseconds', SPAN_PROPS.milliseconds(sp.ms)], ['Ticks', SPAN_PROPS.ticks(sp.ms)],
        ['TotalDays', SPAN_PROPS.totaldays(sp.ms)], ['TotalHours', SPAN_PROPS.totalhours(sp.ms)], ['TotalMinutes', SPAN_PROPS.totalminutes(sp.ms)], ['TotalSeconds', SPAN_PROPS.totalseconds(sp.ms)], ['TotalMilliseconds', SPAN_PROPS.totalmilliseconds(sp.ms)]]);
    }), null, width);
    var fmt = cl.split(':')[0].replace(/^gen$/, '');
    if (cl.indexOf('gen:') === 0) return group.length && propNames(first).length > 4 ? listText(group, null, width) : (propNames(first).length ? genericTable(group, null, width) : '');
    var special = hasOwn.call(SPECIAL_VIEWS, fmt) ? SPECIAL_VIEWS[fmt] : null;
    if (special) return special(group, S, width);
    if (fmt === 'table' || fmt === 'type') return genericTable(group, fmt === 'type' ? ['IsPublic', 'IsSerial', 'Name', 'BaseType'] : null, width);
    return group.map(function (x) { return strOf(x) + '\n'; }).join('');
  }
  /* the Name / Value table of a hashtable: Name is 30 columns wide (the view's fixed width) */
  function hashLines(h, width) {
    var nameW = 30, lines = ['Name' + new Array(nameW - 3).join(' ') + ' Value', '----' + new Array(nameW - 3).join(' ') + ' -----'];
    h.keys.forEach(function (k) {
      var nm = strOf(k), val = cellStr(h.get(k));
      lines.push(rtrim((displayWidth(nm) > nameW ? wrapCells(nm, nameW)[0] : padR(nm, nameW)) + ' ' + val));
    });
    return lines;
  }
  /* views that PowerShell defines for a type (columns, widths and alignment as captured from Windows PowerShell 5.1 zh-TW) */
  var SPECIAL_VIEWS = {
    path1: function (group) {
      var cells = group.map(function (o) { return strOf(o.get('Path')); });
      var w = Math.max(4, Math.max.apply(null, cells.map(displayWidth)));
      return '\nPath\n----\n' + cells.join('\n') + '\n\n\n';
    },
    process: function (group, S, width) {
      var lines = ['Handles  NPM(K)    PM(K)      WS(K)     CPU(s)     Id  SI ProcessName', '-------  ------    -----      -----     ------     --  -- -----------'];
      group.forEach(function (o) {
        var cpu = o.get('CPU');
        lines.push(padL(String(o.get('Handles')), 7) + padL(String(o.get('NPM')), 9) + padL(String(o.get('PM')), 10) + padL(String(o.get('WS')), 11) + padL(cpu === null || cpu === undefined ? '' : fmtN(cpu, 2, true), 11) +
          padL(String(o.get('Id')), 7) + padL(String(o.get('SI')), 4) + ' ' + o.get('ProcessName'));
      });
      return '\n' + lines.join('\n') + '\n\n\n';
    },
    service: function (group, S, width) {
      var lines = ['Status   Name               DisplayName', '------   ----               -----------'];
      group.forEach(function (o) {
        var nm = String(o.get('Name'));
        if (displayWidth(nm) > 18) nm = nm.slice(0, 15) + '...';
        var dn = strOf(o.get('DisplayName'));
        var room = (width || 120) - 28;
        if (displayWidth(dn) > room) { var cut = ''; var cw1 = 0; for (var ch of dn) { var c1 = charWidth(ch.codePointAt(0)); if (cw1 + c1 > room - 3) break; cut += ch; cw1 += c1; } dn = cut + '...'; }
        lines.push(padR(String(o.get('Status')), 8) + ' ' + padR(nm, 18) + ' ' + dn);
      });
      return '\n' + lines.join('\n') + '\n\n\n';
    },
    group: function (group, S, width) {
      var noEl = group[0].noElement;
      var lines = noEl ? ['Count Name                     ', '----- ----                     '] : ['Count Name                      Group', '----- ----                      -----'];
      group.forEach(function (o) {
        var nm = strOf(o.get('Name')), line = padL(String(o.get('Count')), 5) + ' ' + padR(nm, 25);
        if (!noEl) {
          var room = (width || 120) - 33, g = cellStr(o.get('Group'));
          if (displayWidth(g) > room) g = g.slice(0, Math.max(0, room - 3)) + '...';
          line += ' ' + g;
        }
        lines.push(rtrim(line));
      });
      return '\n' + lines.map(rtrim).join('\n') + '\n\n\n';
    },
    history: function (group) {
      var w = Math.max(4, String(group[group.length - 1].get('Id')).length + 2);
      var lines = ['', padL('Id', w) + ' CommandLine', padL('--', w) + ' -----------'];
      group.forEach(function (o) { lines.push(padL(String(o.get('Id')), w) + ' ' + o.get('CommandLine')); });
      lines.push('', '');
      return lines.map(function (l) { return l + '\n'; }).join('');
    },
    match: function (group) { return '\n' + group.map(function (o) { return strOf(o) + '\n'; }).join('') + '\n\n'; },
    version: function (group) {
      var names = group[0].names();
      var cols = names.map(function (nm) { return { h: nm, right: false, cells: group.map(function (g) { return strOf(g.get(nm)); }) }; });
      return '\n' + tableLinesOf(cols, 120, { sep: 2 }).join('\n') + '\n\n\n';
    },
    command: function (group, S, width) {
      var lines = ['CommandType     Name                                               Version    Source', '-----------     ----                                               -------    ------'];
      group.forEach(function (o) {
        var nm = strOf(o.find('DisplayName') ? o.get('DisplayName') : o.get('Name'));
        if (displayWidth(nm) > 50) nm = nm.slice(0, 47) + '...';
        lines.push(rtrim(padR(strOf(o.get('CommandType')), 15) + ' ' + padR(nm, 50) + ' ' + padR(strOf(o.get('Version')), 10) + ' ' + strOf(o.get('Source'))));
      });
      return '\n' + lines.join('\n') + '\n\n\n';
    },
    wide: function (group) { return group.map(function (x) { return strOf(x) + '\n'; }).join(''); },
    member: function (group, S, width) {
      var out = '', i = 0;
      while (i < group.length) {
        var tn = group[i].get('TypeName'), part = [];
        while (i < group.length && group[i].get('TypeName') === tn) part.push(group[i++]);
        var cols = ['Name', 'MemberType', 'Definition'].map(function (h) { return { h: h, right: false, cells: part.map(function (o) { return strOf(o.get(h)); }) }; });
        out += '\n\n   TypeName: ' + tn + '\n\n' + tableLinesOf(cols, width || 120).join('\n') + '\n\n\n';
      }
      return out;
    }
  };

  /* ------------------------------------------------------------ values of words */
  function partValue(p, S) {
    if (p.k === 'lit') return p.s;
    if (p.k === 'var') return getVar(S, p.name);
    return ev(p.ast, S);
  }
  /* the value of one element (parts): a lone variable or expression keeps its type, anything else is text */
  function partsValue(parts, session) {
    if (parts.length === 1 && parts[0].k !== 'lit') return partValue(parts[0], session);
    var s = '';
    parts.forEach(function (p) { s += p.k === 'lit' ? p.s : strOf(partValue(p, session)); });
    return s;
  }
  /* a word token -> string | null | boolean | object | array */
  var NUM_WORD = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?$/;
  function numWord(el, quoted) {
    return !quoted && el.parts.length === 1 && el.parts[0].k === 'lit' && NUM_WORD.test(el.parts[0].s) ? parseFloat(el.parts[0].s) : undefined;
  }
  /* typed: the receiver wants values, not text (Write-Output, script blocks, functions): an unquoted 12 is the number 12 */
  function tokValue(tok, session, typed) {
    if (tok.arr) return tok.arr.map(function (el) { var nv = typed ? numWord(el, false) : undefined; return nv !== undefined ? nv : partsValue(el.parts, session); });
    if (tok.quoted && tok.parts.length === 1 && tok.parts[0].k !== 'lit') return strOf(partValue(tok.parts[0], session));
    if (typed) { var n1 = numWord(tok, tok.quoted); if (n1 !== undefined) return n1; }
    return partsValue(tok.parts, session);
  }
  function toStringList(v) {
    if (v === null || v === undefined) return [null];
    if (Array.isArray(v)) return v.map(function (x) { return x === null ? null : strOf(x); });
    return [strOf(v)];
  }

  /* bindArgs(ctx, spec, words) -> {ok, p:{Name: value}} ; reports the one PowerShell error and returns ok:false */
  function bindArgs(ctx, spec, words) {
    var session = ctx.session, named = {}, positional = [], i;
    function paramErr(tok, kind, extra) {
      var o = { head: spec.name, cat: 'InvalidArgument', target: '', activity: spec.name, reason: 'ParameterBindingException', tokStart: tok.start, tokLen: tok.end - tok.start };
      if (kind === 'none') { o.msg = "找不到符合參數名稱 '" + tok.name + "' 的參數。"; o.fq = 'NamedParameterNotFound,' + spec.cls; }
      else if (kind === 'ambiguous') { o.msg = "參數無法處理，因為 '" + tok.name + "' 參數名稱不明確。可能符合的項目包括:  " + extra.map(function (n) { return '-' + n; }).join(' ') + '。'; o.fq = 'AmbiguousParameter,' + spec.cls; }
      else if (kind === 'missing') { o.msg = "遺失 '" + extra.n + "' 參數的引數。請指定一個 '" + (extra.type || T_STR) + "' 型別的參數，然後再試一次。"; o.fq = 'MissingArgument,' + spec.cls; }
      ctx.fail(o);
      return { ok: false };
    }
    /* a number parameter that gets text that is not a number: the real ParameterBindingArgumentTransformationException */
    function numErr(P, v, vt) {
      var m = /^System\.(Int16|Int32|Int64|Double|Single|Byte|UInt32|UInt64)(\[\])?$/.exec(P.type || '');
      if (!m || P.raw || P.sw) return null;
      var vals = Array.isArray(v) ? v : [v];
      for (var k = 0; k < vals.length; k++) {
        var x = vals[k];
        if (x === null || x === undefined || typeof x !== 'string') continue;
        if (!NUM_WORD.test(x.trim())) {
          ctx.fail({ head: spec.name, msg: "無法處理參數 '" + P.n + "' 的引數轉換。無法將 \"" + x + "\" 值轉換為 \"System." + m[1] + "\" 型別。錯誤: \"輸入字串格式不正確。\"", cat: 'InvalidData', target: '', activity: spec.name,
            reason: 'ParameterBindingArgumentTransformationException', fq: 'ParameterArgumentTransformationError,' + spec.cls, tokStart: vt.start, tokLen: vt.end - vt.start });
          return { ok: false };
        }
      }
      return null;
    }
    for (i = 0; i < words.length; i++) {
      var tok = words[i];
      if (tok.k === 'param') {
        var rp = resolveParam(spec, tok.name);
        if (rp.err === 'ambiguous') return paramErr(tok, 'ambiguous', rp.list);
        if (rp.err) return paramErr(tok, 'none');
        var P = rp.p;
        if (P.sw) {
          var bv = true;
          if (tok.value) { var sv = strOf(tokValue(tok.value, session)).toLowerCase(); bv = !(sv === 'false' || sv === '0' || sv === ''); }
          named[P.n] = bv;
          continue;
        }
        var vt = tok.value || null;
        if (!vt) {
          var nx = words[i + 1];
          if (!nx || nx.k === 'param') return paramErr(tok, 'missing', P);
          vt = nx; i++;
        }
        var v = tokValue(vt, session, P.raw);
        named[P.n] = bindValue(P, v);
        var ne1 = numErr(P, named[P.n], vt);
        if (ne1) return ne1;
        continue;
      }
      positional.push(tok);
    }
    // positional parameters go to the unbound parameters that have a position, in order
    var slots = spec.params.filter(function (p) { return p.pos !== undefined && !hasOwn.call(named, p.n); }).sort(function (a, b) { return a.pos - b.pos; });
    for (i = 0; i < positional.length; i++) {
      var slot = slots[i] || (slots.length && slots[slots.length - 1].rest ? slots[slots.length - 1] : null);
      var ptok = positional[i], pv = tokValue(ptok, session, slot && slot.raw);
      if (!slot) {
        ctx.fail({ head: spec.name, msg: "找不到接受引數 '" + strOf(pv === null ? '' : (Array.isArray(pv) ? pv[0] : pv)) + "' 的位置參數。", cat: 'InvalidArgument', target: '', activity: spec.name,
          reason: 'ParameterBindingException', fq: 'PositionalParameterNotFound,' + spec.cls });
        return { ok: false };
      }
      if (slot.rest) {
        if (!named[slot.n]) named[slot.n] = [];
        if (slot.raw) { unroll(pv).forEach(function (x) { named[slot.n].push(x); }); continue; }
        toStringList(pv).forEach(function (x) { named[slot.n].push(x); });
        if (pv && typeof pv === 'object' && !Array.isArray(pv)) named[slot.n][named[slot.n].length - 1] = pv;
        if (pv === true || pv === false) named[slot.n][named[slot.n].length - 1] = pv;
        continue;
      }
      named[slot.n] = bindValue(slot, pv);
      var ne2 = numErr(slot, named[slot.n], ptok);
      if (ne2) return ne2;
    }
    // mandatory parameters (Path may be replaced by LiteralPath)
    for (i = 0; i < spec.params.length; i++) {
      var mp = spec.params[i];
      if (mp.mand && !hasOwn.call(named, mp.n) && !(mp.n === 'Path' && hasOwn.call(named, 'LiteralPath')) && !(mp.mandUnless && [].concat(mp.mandUnless).some(function (mu) { return hasOwn.call(named, mu); })) && !(mp.pipe && ctx.hasInput)) {
        ctx.fail({ head: spec.name, msg: '無法處理命令，因為至少遺失了一個必要參數:  ' + mp.n + '。', cat: 'InvalidArgument', target: '', activity: spec.name,
          reason: 'ParameterBindingException', fq: 'MissingMandatoryParameter,' + spec.cls });
        return { ok: false };
      }
    }
    if (hasOwn.call(named, 'ErrorAction')) {
      var ea = strOf(named.ErrorAction).toLowerCase();
      if (ea === 'silentlycontinue' || ea === 'ignore' || ea === '0' || ea === '4') ctx.silent = true;
      if (ea === 'stop' || ea === '2') ctx.errorStop = true;
    }
    return { ok: true, p: named };
  }
  /* the value a parameter receives: text by default (paths, names), the raw object for parameters flagged raw (script blocks, hashtables, objects) */
  function bindValue(P, v) {
    if (P.raw) return P.arr ? (Array.isArray(v) ? v : (v === null || v === undefined ? [] : [v])) : v;
    if (P.arr) return toStringList(v);
    return Array.isArray(v) ? strOf(v[0]) : (v === null ? null : strOf(v));
  }
  function firstPath(v) { return Array.isArray(v) ? v[0] : v; }
  /* the typed paths a file command works on: its -Path / -LiteralPath, or the objects of the pipeline (file items, strings, anything with a Path or FullName) */
  function pathArgs(ctx, arr) {
    if (arr && arr.length) return arr;
    if (!ctx.hasInput) return arr || [];
    var out = [];
    ctx.input.forEach(function (o) {
      if (typeof o === 'string') out.push(o);
      else if (isObj(o) && o.file) out.push(o.file.disp);
      else if (isObj(o)) { var pv = o.get('FullName'); if (pv === undefined) pv = o.get('Path'); if (pv === undefined) pv = o.get('PSPath'); if (pv !== undefined && pv !== null) out.push(strOf(pv)); }
    });
    return out;
  }
  /* .git is hidden on Windows (git sets the attribute), so Get-ChildItem needs -Force to show it */
  function isHiddenItem(st) { return st.name === '.git'; }

  /* ------------------------------------------------------------ the table that Get-ChildItem / mkdir / New-Item print */
  /* groups: [{dir:'C:\\Users\\an', items:[stat…]}] -> the lines of Format-Table: 2 blank lines, `    目錄: dir`, 2 blank lines, header, dashes, rows; then 2 blank lines at the very end */
  function tableText(groups) {
    var lines = [], any = false;
    groups.forEach(function (g) {
      if (!g.items.length) return;
      any = true;
      lines.push('', '', '    目錄: ' + g.dir, '', '');
      lines.push(padR('Mode', 7) + ' ' + padL('LastWriteTime', 26) + ' ' + padL('Length', 14) + ' Name');
      lines.push(padR('----', 7) + ' ' + padL('-------------', 26) + ' ' + padL('------', 14) + ' ----');
      g.items.forEach(function (st) {
        var dp = dateParts(st.mtime);
        var cell = padL(dp[0], 10) + '  ' + dp[1];
        lines.push(padR(modeOf(st), 7) + ' ' + padL(cell, 26) + ' ' + padL(st.type === 'dir' ? '' : String(st.size), 14) + ' ' + st.name);
      });
    });
    if (!any) return '';
    lines.push('', '');
    return lines.map(function (l) { return l + '\n'; }).join('');
  }
  /* a one-column table (Get-Location, a $PWD value): blank, header, dashes, value, 2 blank lines */
  function pathTableText(path) {
    return '\nPath\n----\n' + path + '\n\n\n';
  }
  function dirsFirst(a, b) { return (a.type === b.type ? 0 : a.type === 'dir' ? -1 : 1) || ntfsCmp(a.name, b.name); }
  function parentDisp(disp) {
    var i = disp.lastIndexOf('\\');
    var p = i <= 2 ? disp.slice(0, 3) : disp.slice(0, i);
    return p.length === 2 ? p + '\\' : p;
  }

  /* ------------------------------------------------------------ errors every file command shares */
  function failPathNotFound(ctx, miss) {
    var sp = ctx.spec || { name: ctx.name, cls: NS + 'GetItemCommand' };          // a native command (explorer, code) has no cmdlet spec
    if (miss.kind === 'drive') {
      return ctx.fail({ msg: "找不到磁碟機。名為 '" + miss.drive + "' 的磁碟機不存在。", cat: 'ObjectNotFound', target: miss.drive, activity: sp.name, reason: 'DriveNotFoundException', fq: 'DriveNotFound,' + sp.cls });
    }
    return ctx.fail({ msg: "找不到 '" + miss.disp + "' 路徑，因為它不存在。", cat: 'ObjectNotFound', target: miss.disp, activity: sp.name, reason: 'ItemNotFoundException', fq: 'PathNotFound,' + sp.cls });
  }
  function failDenied(ctx, disp, fqPrefix) {
    return ctx.fail({ msg: "拒絕存取路徑 '" + disp + "'。", cat: 'PermissionDenied', target: disp, activity: ctx.spec.name, reason: 'UnauthorizedAccessException', fq: fqPrefix + ',' + ctx.spec.cls });
  }
  var PRACTICE_NOTE = '（練習版：';

  /* ------------------------------------------------------------ commands */
  var CMDS = {};                 // lower-case name (cmdlet, alias, function, exe) -> def
  function defCmd(def, names) {
    names.forEach(function (n) { CMDS[n.toLowerCase()] = def; });
    return def;
  }
  function out2(ctx, text) { ctx.out(text); }

  /* ---- Get-ChildItem */
  function cmdLs(ctx) {
    var s = ctx.session, vfs = s.vfs, P = ctx.p, status = 0;
    var literal = hasOwn.call(P, 'LiteralPath');
    var paths = literal ? P.LiteralPath : (P.Path || ['.']);
    var recurse = !!P.Recurse || P.Depth !== undefined, maxDepth = P.Depth !== undefined ? Number(P.Depth) : Infinity;
    var filter = P.Filter ? wildRegex(String(P.Filter)) : null;
    var inc = P.Include ? P.Include.filter(Boolean).map(wildRegex) : null, exc = P.Exclude ? P.Exclude.filter(Boolean).map(wildRegex) : null;
    var items = [], names = [];
    function addItem(dir, st, rel) {
      items.push(fileObj(st, joinDisp(dir, st.name)));
      names.push(rel);
    }
    function keep(st, useInc) {
      if (P.Directory && st.type !== 'dir') return false;
      if (P.File && st.type === 'dir') return false;
      if (P.Hidden || P.System) return false;                         // nothing in the practice PC is hidden or a system file
      if (P.ReadOnly && modeOf(st).charAt(2) !== 'r') return false;
      if (filter && !filter.test(st.name)) return false;
      if (inc && useInc && !inc.some(function (re) { return re.test(st.name); })) return false;
      if (exc && exc.some(function (re) { return re.test(st.name); })) return false;
      return true;
    }
    function walk(dirAbs, dirDisp, level, rel, useInc) {
      var kids = vfs.list(dirAbs).filter(function (st) { return !isTrash(st) && (P.Force || !isHiddenItem(st)); }).sort(dirsFirst);
      kids.forEach(function (st) { if (keep(st, useInc)) addItem(dirDisp, st, rel + st.name); });
      if (recurse && level < maxDepth) kids.forEach(function (st) { if (st.type === 'dir') walk(st.path, joinDisp(dirDisp, st.name), level + 1, rel + st.name + '\\', useInc); });
    }
    paths.forEach(function (arg) {
      if (arg === null) return;
      var ex = expandPath(s, arg, literal);
      if (ex.miss) { status = 1; failPathNotFound(ctx, ex.miss); return; }
      if (ex.wild && !ex.items.length) return;                        // a wildcard that matches nothing prints nothing
      var trailingWild = ex.wild && /[\\\/]?\*$/.test(arg);
      ex.items.forEach(function (it) {
        if (it.st.type === 'dir') {
          if (inc && !recurse && !ex.wild) return;                    // -Include does nothing without -Recurse or a wildcard path (real behaviour)
          walk(it.st.path, it.disp, 0, '', true);
        } else if (keep(it.st, false)) addItem(parentDisp(it.disp), it.st, it.st.name);
      });
    });
    if (P.Name) ctx.emit(names);
    else ctx.emit(items);
    return status;
  }
  /* ---- Get-Item */
  function cmdGi(ctx) {
    var s = ctx.session, P = ctx.p, status = 0;
    var literal = hasOwn.call(P, 'LiteralPath');
    pathArgs(ctx, literal ? P.LiteralPath : P.Path).forEach(function (arg) {
      if (arg === null) return;
      var ex = expandPath(s, arg, literal);
      if (ex.miss) { status = 1; failPathNotFound(ctx, ex.miss); return; }
      ex.items.forEach(function (it) { ctx.emit(fileObj(it.st, it.disp)); });
    });
    return status;
  }
  /* ---- Set-Location */
  function cmdCd(ctx) {
    var s = ctx.session, P = ctx.p, vfs = s.vfs;
    var arg = hasOwn.call(P, 'LiteralPath') ? P.LiteralPath : (P.Path ? firstPath(P.Path) : undefined);
    if (arg === undefined || arg === null) return 0;                                           // `cd` alone stays where it is (win-facts §5.5)
    var r;
    if (hasWild(arg.replace(/\//g, '\\').split('\\').pop()) && !hasOwn.call(P, 'LiteralPath')) {
      // cd Desk* : fine when exactly one folder matches
      var ex = expandPath(s, arg, false);
      var dirs = ex.items.filter(function (it) { return it.st.type === 'dir'; });
      if (dirs.length !== 1) return failPathNotFound(ctx, ex.miss || { disp: ex.disp || arg, kind: 'path' });
      var dsegs = splitSegs(dirs[0].abs);
      r = { abs: dirs[0].abs, segs: dsegs, shown: KEEP_TYPED_CASE ? dirs[0].disp.slice(3).split('\\').filter(Boolean) : dsegs, disp: dirs[0].disp };
    } else r = resolvePath(s, arg);
    if (r.err) return failPathNotFound(ctx, { kind: r.err, disp: r.disp, drive: r.drive });
    var st = vfs.stat(r.abs);
    if (!st || isTrash(st)) {
      // -LiteralPath names the path as typed, a plain path names the full path (both captured from the real cmdlet)
      if (hasOwn.call(P, 'LiteralPath')) return ctx.fail({ msg: "找不到 '" + arg + "' 路徑，因為它不存在。", cat: 'ObjectNotFound', target: arg, activity: ctx.spec.name, reason: 'ItemNotFoundException', fq: 'PathNotFound,' + ctx.spec.cls });
      return failPathNotFound(ctx, { kind: 'path', disp: r.disp });
    }
    if (st.type !== 'dir') {
      // a file: real PowerShell names the path as typed
      return ctx.fail({ msg: "找不到 '" + arg + "' 路徑，因為它不存在。", cat: 'ObjectNotFound', target: arg, activity: ctx.spec.name, reason: 'ItemNotFoundException', fq: 'PathNotFound,' + ctx.spec.cls });
    }
    setCwd(s, r);
    if (P.PassThru) ctx.emit(pathInfoObj(s));
    return 0;
  }
  function cmdPushd(ctx) {
    var s = ctx.session, P = ctx.p;
    var arg = hasOwn.call(P, 'LiteralPath') ? P.LiteralPath : P.Path;
    var from = { abs: s.cwd, shown: syncShown(s).slice() };
    if (arg !== undefined && arg !== null) {
      var r = resolvePath(s, arg);
      if (r.err) return failPathNotFound(ctx, { kind: r.err, disp: r.disp, drive: r.drive });
      var st = s.vfs.stat(r.abs);
      if (!st || st.type !== 'dir') return failPathNotFound(ctx, { kind: 'path', disp: r.disp });
      s.stack.push(from);
      setCwd(s, r);
    } else s.stack.push(from);
    return 0;
  }
  function cmdPopd(ctx) {
    var s = ctx.session;
    if (!s.stack.length) return 0;
    var back = s.stack.pop();
    s.cwd = back.abs; s.shown = back.shown; s.env.PWD = back.abs;
    return 0;
  }
  function cmdPwd(ctx) { ctx.emit(pathInfoObj(ctx.session)); return 0; }

  /* ---- mkdir / New-Item */
  function badName(name) { return /[<>|?*"]/.test(name) || name.indexOf(':') >= 0; }
  function createItems(ctx, isDir, targets, value) {
    var s = ctx.session, vfs = s.vfs, status = 0, P = ctx.p;
    targets.forEach(function (t) {
      if (t === null) return;
      var r = resolvePath(s, t.typed);
      if (r.err) { status = 1; failPathNotFound(ctx, { kind: r.err, disp: r.disp, drive: r.drive }); return; }
      var lastSeg = r.segs[r.segs.length - 1] || '';
      if (badName(lastSeg) || r.segs.some(badName)) {
        status = 1;
        ctx.fail({ msg: '路徑中有不合法的字元。', cat: 'InvalidArgument', target: r.disp, activity: 'New-Item', reason: 'ArgumentException', fq: 'CreateDirectoryArgumentError,' + NS + 'NewItemCommand' });
        return;
      }
      var existing = vfs.stat(r.abs);
      if (existing) {
        if (isDir && P.Force && existing.type === 'dir') { addGroup(r.disp, existing); return; }
        status = 1;
        if (isDir || existing.type === 'dir') ctx.fail({ msg: '具有指定名稱 ' + r.disp + ' 的項目已經存在。', cat: 'ResourceExists', target: r.disp, activity: 'New-Item', reason: 'IOException', fq: 'DirectoryExist,' + NS + 'NewItemCommand' });
        else if (P.Force) { try { vfs.writeFile(r.abs, value || '', { by: 'terminal' }); addGroup(r.disp, vfs.stat(r.abs)); status = 0; } catch (e0) { status = mapVfs(ctx, e0, r.disp, 'New-Item'); } }
        else ctx.fail({ msg: "檔案 '" + r.disp + "' 已經存在。", cat: 'WriteError', target: r.disp, activity: 'New-Item', reason: 'IOException', fq: 'NewItemIOError,' + NS + 'NewItemCommand' });
        return;
      }
      try {
        if (isDir) vfs.mkdir(r.abs, { by: 'terminal', parents: true });
        else {
          var parent = vfs.dirname(r.abs);
          if (!vfs.isDir(parent)) throw new vfs.VfsError('ENOENT', r.abs);
          vfs.writeFile(r.abs, value || '', { by: 'terminal' });
        }
        addGroup(r.disp, vfs.stat(r.abs));
      } catch (e) { status = mapVfs(ctx, e, r.disp, 'New-Item'); }
    });
    function addGroup(disp, st) { ctx.emit(fileObj(st, disp)); }
    return status;
  }
  /* turn a VfsError into the matching PowerShell error */
  function mapVfs(ctx, e, disp, cmdlet, fqBase) {
    var code = e && e.code ? e.code : 'EINVAL';
    var cls = ctx.spec.cls;
    if (code === 'EACCES' || code === 'EPROTECTED') {
      ctx.fail({ msg: "拒絕存取路徑 '" + disp + "'。", cat: 'PermissionDenied', target: disp, activity: cmdlet, reason: 'UnauthorizedAccessException', fq: (fqBase || 'CreateDirectoryUnauthorizedAccessError') + ',' + cls });
    } else if (code === 'ENOENT' || code === 'ENOTDIR') {
      ctx.fail({ msg: "找不到路徑 '" + disp + "' 的一部分。", cat: 'NotSpecified', target: '', activity: cmdlet, reason: 'DirectoryNotFoundException', fq: 'System.IO.DirectoryNotFoundException,' + cls });
    } else if (code === 'ENOSPC') {
      ctx.fail({ msg: '磁碟空間不足。', cat: 'WriteError', target: disp, activity: cmdlet, reason: 'IOException', fq: 'WriteError,' + cls });
    } else {
      ctx.fail({ msg: '無法完成這個動作 (' + disp + ')。', cat: 'WriteError', target: disp, activity: cmdlet, reason: 'IOException', fq: 'WriteError,' + cls });
    }
    return 1;
  }
  function cmdMkdir(ctx) {
    var P = ctx.p, s = ctx.session, targets = [];
    var bases = P.Path || ['.'];
    if (P.Name) bases.forEach(function (b) { targets.push({ typed: joinTyped(b, P.Name) }); });
    else bases.forEach(function (b) { targets.push({ typed: b }); });
    return createItems(ctx, true, targets, '');
  }
  function joinTyped(a, b) { return a === null || a === '' ? b : (/[\\\/]$/.test(a) ? a + b : a + '\\' + b); }
  function cmdNi(ctx) {
    var P = ctx.p, targets = [];
    var isDir = P.ItemType !== undefined && P.ItemType !== null && /^d(ir(ectory)?)?$/i.test(String(P.ItemType));
    var bases = P.Path || ['.'];
    if (P.Name) bases.forEach(function (b) { targets.push({ typed: joinTyped(b, P.Name) }); });
    else bases.forEach(function (b) { targets.push({ typed: b }); });
    var value = P.Value === undefined || P.Value === null ? '' : strOf(P.Value);
    return createItems(ctx, isDir, targets, value);
  }

  /* ---- Move-Item */
  function underPath(abs, dir) { var a = fold(abs), d = fold(dir); return d === '/' || a === d || a.indexOf(d + '/') === 0; }
  function cmdMv(ctx) {
    var s = ctx.session, vfs = s.vfs, P = ctx.p, status = 0;
    var literal = hasOwn.call(P, 'LiteralPath');
    var srcs = pathArgs(ctx, literal ? P.LiteralPath : P.Path);
    var destTyped = P.Destination !== undefined && P.Destination !== null ? P.Destination : '.';
    var dst = resolvePath(s, destTyped);
    if (dst.err) return failPathNotFound(ctx, { kind: dst.err, disp: dst.disp, drive: dst.drive });
    var dstSt = vfs.stat(dst.abs);
    var items = [];
    srcs.forEach(function (arg) {
      if (arg === null) return;
      var ex = expandPath(s, arg, literal);
      if (ex.miss) { status = 1; failPathNotFound(ctx, ex.miss); return; }
      ex.items.forEach(function (it) { items.push(it); });
    });
    items.forEach(function (it) {
      var st = it.st, target, targetDisp, destIsFile = false;
      if (dstSt && dstSt.type === 'dir') {
        target = vfs.join(dst.abs, st.name); targetDisp = joinDisp(dst.disp, st.name);
        if (st.type === 'dir' && underPath(dst.abs, st.path)) {
          status = 1;
          ctx.fail({ msg: '目的地路徑不可以是來源的子目錄: ' + targetDisp + '。', cat: 'InvalidArgument', target: targetDisp, activity: 'Move-Item', reason: 'IOException', fq: 'MoveItemArgumentError,' + ctx.spec.cls });
          return;
        }
      } else if (dstSt) {
        target = dstSt.path; targetDisp = dst.disp; destIsFile = true;
      } else {
        var parent = vfs.dirname(dst.abs);
        if (!vfs.isDir(parent)) {
          status = 1;
          ctx.fail({ msg: '找不到路徑的一部分。', cat: 'WriteError', target: it.disp, ttype: st.type === 'dir' ? 'DirectoryInfo' : 'FileInfo', activity: 'Move-Item', reason: 'DirectoryNotFoundException',
            fq: (st.type === 'dir' ? 'MoveDirectoryItemIOError,' : 'MoveFileInfoItemIOError,') + ctx.spec.cls });
          return;
        }
        target = dst.abs; targetDisp = dst.disp;          // a destination that does not exist: the item is RENAMED to it (win-facts §5.3)
      }
      if (fold(target) === fold(st.path) && target === st.path) return;      // onto itself: silent
      var exist = vfs.stat(target);
      if (exist && fold(exist.path) !== fold(st.path)) {
        if (!P.Force || exist.type === 'dir') {
          status = 1;
          ctx.fail({ msg: '當檔案已存在時，無法建立該檔案。' + (destIsFile ? '\n' : ''), cat: 'WriteError', target: it.disp, ttype: st.type === 'dir' ? 'DirectoryInfo' : 'FileInfo', activity: 'Move-Item', reason: 'IOException',
            fq: (st.type === 'dir' ? 'MoveDirectoryItemIOError,' : 'MoveFileInfoItemIOError,') + ctx.spec.cls });
          return;
        }
      }
      if (underPath(s.cwd, st.path) && st.type === 'dir') {
        status = 1;
        ctx.fail({ msg: "無法移動 '" + it.disp + "' 的項目，因為它正在使用中。", cat: 'InvalidOperation', target: '', activity: 'Move-Item', reason: 'PSInvalidOperationException', fq: 'InvalidOperation,' + ctx.spec.cls });
        return;
      }
      try {
        vfs.move(st.path, target, { by: 'terminal', overwrite: !!P.Force });
      } catch (e) { status = mapVfs(ctx, e, it.disp, 'Move-Item', 'MoveItemUnauthorizedAccessError'); }
    });
    return status;
  }

  /* ---- Copy-Item */
  function copyTree(vfs, srcAbs, dstAbs) {
    // merge srcAbs into dstAbs (created when missing); files overwrite silently
    if (!vfs.exists(dstAbs)) vfs.mkdir(dstAbs, { by: 'terminal' });
    vfs.list(srcAbs).forEach(function (kid) {
      var to = vfs.join(dstAbs, kid.name);
      if (kid.type === 'dir') copyTree(vfs, kid.path, to);
      else vfs.copy(kid.path, to, { by: 'terminal' });
    });
  }
  function cmdCp(ctx) {
    var s = ctx.session, vfs = s.vfs, P = ctx.p, status = 0;
    var literal = hasOwn.call(P, 'LiteralPath');
    var srcs = pathArgs(ctx, literal ? P.LiteralPath : P.Path);
    var destTyped = P.Destination !== undefined && P.Destination !== null ? P.Destination : '.';
    var dst = resolvePath(s, destTyped);
    if (dst.err) return failPathNotFound(ctx, { kind: dst.err, disp: dst.disp, drive: dst.drive });
    var dstSt = vfs.stat(dst.abs);
    var items = [];
    srcs.forEach(function (arg) {
      if (arg === null) return;
      var ex = expandPath(s, arg, literal);
      if (ex.miss) { status = 1; failPathNotFound(ctx, ex.miss); return; }
      ex.items.forEach(function (it) { items.push(it); });
    });
    items.forEach(function (it) {
      var st = it.st, target, targetDisp;
      if (dstSt && dstSt.type === 'dir') { target = vfs.join(dst.abs, st.name); targetDisp = joinDisp(dst.disp, st.name); }
      else if (dstSt) { target = dstSt.path; targetDisp = dst.disp; }
      else {
        var parent = vfs.dirname(dst.abs);
        if (!vfs.isDir(parent)) {
          status = 1;
          ctx.fail({ msg: "找不到路徑 '" + dst.disp + "' 的一部分。", cat: 'NotSpecified', target: '', activity: 'Copy-Item', reason: 'DirectoryNotFoundException', fq: 'System.IO.DirectoryNotFoundException,' + ctx.spec.cls });
          return;
        }
        target = dst.abs; targetDisp = dst.disp;
      }
      if (fold(target) === fold(st.path)) {
        status = 1;
        ctx.fail({ msg: '無法以項目 ' + it.disp + ' 本身覆寫它自己。', cat: 'WriteError', target: it.disp, activity: 'Copy-Item', reason: 'IOException', fq: 'CopyError,' + ctx.spec.cls });
        return;
      }
      try {
        if (st.type === 'dir') {
          if (underPath(target, st.path)) {
            status = 1;
            ctx.fail({ msg: '指定的路徑、檔名，或是兩者都太長。完整的檔名必須少於 260 個字元，並且目錄名稱必須少於 248 個字元。', cat: 'WriteError', target: targetDisp, activity: 'Copy-Item', reason: 'PathTooLongException', fq: 'CreateDirectoryIOError,' + ctx.spec.cls });
            return;
          }
          if (P.Recurse) copyTree(vfs, st.path, target);
          else if (!vfs.exists(target)) vfs.mkdir(target, { by: 'terminal' });       // without -Recurse only the (empty) folder is copied, as in real PowerShell
        } else {
          var tst = vfs.stat(target);
          if (tst && tst.type === 'dir') throw new vfs.VfsError('EISDIR', target);
          vfs.copy(st.path, target, { by: 'terminal' });
        }
      } catch (e) { status = mapVfs(ctx, e, targetDisp, 'Copy-Item', 'CopyItemUnauthorizedAccessError'); }
    });
    return status;
  }

  /* ---- Rename-Item */
  function cmdRen(ctx) {
    var s = ctx.session, vfs = s.vfs, P = ctx.p;
    var arg = hasOwn.call(P, 'LiteralPath') ? P.LiteralPath : P.Path;
    var ex = expandPath(s, arg, hasOwn.call(P, 'LiteralPath'));
    if (ex.miss || !ex.items.length) {
      return ctx.fail({ msg: "無法重新命名，因為位於 '" + arg + "' 的項目不存在。", cat: 'InvalidOperation', target: '', activity: 'Rename-Item', reason: 'PSInvalidOperationException', fq: 'InvalidOperation,' + ctx.spec.cls });
    }
    var it = ex.items[0], nn = P.NewName === null ? '' : String(P.NewName);
    if (/[\\\/]/.test(nn)) {
      return ctx.fail({ msg: '無法重新命名指定的目標，因為它代表路徑或裝置名稱。', cat: 'InvalidArgument', target: '', activity: 'Rename-Item', reason: 'PSArgumentException', fq: 'Argument,' + ctx.spec.cls });
    }
    var clash = vfs.stat(vfs.join(vfs.dirname(it.st.path), nn));
    if (clash && fold(clash.path) !== fold(it.st.path)) {
      return ctx.fail({ msg: '當檔案已存在時，無法建立該檔案。\n', cat: 'WriteError', target: it.disp, activity: 'Rename-Item', reason: 'IOException', fq: 'RenameItemIOError,' + ctx.spec.cls });
    }
    if (badName(nn)) return ctx.fail({ msg: '路徑中有不合法的字元。', cat: 'InvalidArgument', target: it.disp, activity: 'Rename-Item', reason: 'ArgumentException', fq: 'RenameItemArgumentError,' + ctx.spec.cls });
    try { vfs.rename(it.st.path, nn, { by: 'terminal' }); }
    catch (e) { return mapVfs(ctx, e, it.disp, 'Rename-Item', 'RenameItemUnauthorizedAccessError'); }
    return 0;
  }

  /* ---- Get-Content */
  var BINARY_NOTE = '（練習版：這是二進位檔案，內容不顯示）';
  function cmdCat(ctx) {
    var s = ctx.session, vfs = s.vfs, P = ctx.p, status = 0;
    var literal = hasOwn.call(P, 'LiteralPath');
    var total = P.TotalCount !== undefined ? Number(P.TotalCount) : null, tail = P.Tail !== undefined ? Number(P.Tail) : null;
    var waits = [];
    pathArgs(ctx, literal ? P.LiteralPath : P.Path).forEach(function (arg) {
      if (arg === null) return;
      var ex = expandPath(s, arg, literal);
      if (ex.miss || (ex.wild && !ex.items.length)) { status = 1; failPathNotFound(ctx, ex.miss || { kind: 'path', disp: ex.disp || arg }); return; }
      ex.items.forEach(function (it) {
        var st = it.st;
        if (st.type === 'dir') { status = 1; failDenied(ctx, it.disp, 'GetContentReaderUnauthorizedAccessError'); return; }
        var text;
        if (st.kind === 'binary' || st.kind === 'zip' || st.kind === 'app') text = BINARY_NOTE + '\n';
        else text = vfs.readFile(st.path, { by: 'terminal' });
        waits.push({ path: st.path, len: text.length });
        if (P.Raw) { ctx.emitOne(text); return; }
        var lines = text.replace(/\r\n/g, '\n').split('\n');
        if (lines.length && lines[lines.length - 1] === '') lines.pop();
        if (tail !== null) lines = lines.slice(Math.max(0, lines.length - tail));
        if (total !== null) lines = lines.slice(0, total);
        lines.forEach(function (l) { ctx.emitOne(l); });
      });
    });
    if (P.Wait && waits.length && !status) return catWait(ctx, waits);
    return status;
  }
  /* Get-Content -Wait: print what is appended to the file until Ctrl+C (like tail -f) */
  function* catWait(ctx, waits) {
    var vfs = ctx.session.vfs;
    var shown = waits.map(function (w) { return w.len; });
    flushNow(ctx);
    for (var guard = 0; guard < 100000; guard++) {
      yield { sleep: 800 };
      waits.forEach(function (w, i) {
        var st = vfs.stat(w.path);
        if (!st || st.type === 'dir') return;
        var text;
        try { text = vfs.readFile(st.path, { by: 'terminal' }); } catch (e) { return; }
        if (text.length > shown[i]) {
          var add = text.slice(shown[i]).replace(/\r\n/g, '\n').replace(/\n$/, '');
          shown[i] = text.length;
          add.split('\n').forEach(function (l) { ctx.host(l + '\n'); });
        } else if (text.length < shown[i]) shown[i] = text.length;
      });
    }
    return 0;
  }
  /* print the objects the command has emitted so far, right now (for commands that wait) */
  function flushNow(ctx) {
    if (!ctx.objs.length) return;
    var text = renderObjs(ctx.objs, ctx.session, ctx.cols);
    ctx.objs = [];
    ctx.host(text);
  }
  /* ---- Set-Content / Add-Content (small) */
  function cmdSetContent(append) {
    return function (ctx) {
      var s = ctx.session, vfs = s.vfs, P = ctx.p, status = 0;
      var arr = (hasOwn.call(P, 'LiteralPath') ? P.LiteralPath : P.Path), vals = (P.Value || (ctx.hasInput ? ctx.input : [])).map(strOf);
      var text = vals.join('\n') + (P.NoNewline ? '' : '\n');
      arr.forEach(function (arg) {
        if (arg === null) return;
        var r = resolvePath(s, arg);
        if (r.err) { status = 1; failPathNotFound(ctx, { kind: r.err, disp: r.disp, drive: r.drive }); return; }
        try { vfs.writeFile(r.abs, text, { by: 'terminal', append: append }); } catch (e) { status = mapVfs(ctx, e, r.disp, ctx.spec.name, 'GetContentWriterUnauthorizedAccessError'); }
      });
      return status;
    };
  }
  function cmdTestPath(ctx) {
    var s = ctx.session, P = ctx.p, res = true;
    var arr = pathArgs(ctx, hasOwn.call(P, 'LiteralPath') ? P.LiteralPath : P.Path);
    arr.forEach(function (arg) {
      if (arg === null) { res = false; return; }
      var ex = expandPath(s, arg, hasOwn.call(P, 'LiteralPath'));
      if (ex.miss || !ex.items.length) res = false;
      else if (P.PathType) {
        var pt = String(P.PathType).toLowerCase();
        if (/^l/.test(pt) && ex.items.some(function (it) { return it.st.type === 'dir'; })) res = false;
        if (/^c/.test(pt) && ex.items.some(function (it) { return it.st.type !== 'dir'; })) res = false;
      }
    });
    ctx.emitOne(res);
    return 0;
  }

  /* ---- echo, Write-Host, values */
  function cmdEcho(ctx) {
    var P = ctx.p;
    if (P.InputObject && P.InputObject.length) { if (P.NoEnumerate) P.InputObject.forEach(function (x) { ctx.emitOne(x); }); else ctx.emit(P.InputObject); }
    else if (ctx.hasInput) ctx.emit(ctx.input);
    return 0;
  }
  function cmdHost(ctx) {
    var P = ctx.p, items = (P.Object || []).map(function (x) { return Array.isArray(x) ? x.map(strOf).join(' ') : strOf(x); });
    if (!P.Object && ctx.hasInput) items = ctx.input.map(strOf);
    var sepv = P.Separator === undefined ? ' ' : strOf(P.Separator);
    var fg = P.ForegroundColor ? String(P.ForegroundColor).toLowerCase() : '';
    if (/^(black|darkblue|darkgreen|darkcyan|darkred|darkmagenta|darkyellow|gray|darkgray|blue|green|cyan|red|magenta|yellow|white)$/.test(fg)) ctx.hostCls(items.join(sepv) + (P.NoNewline ? '' : '\n'), 'fg-' + fg);
    else ctx.host(items.join(sepv) + (P.NoNewline ? '' : '\n'));
    return 0;
  }
  function cmdClear(ctx) { ctx.effect({ type: 'clear' }); return 0; }
  function cmdExit(ctx) { ctx.session.alive = false; ctx.effect({ type: 'exit' }); return 0; }

  /* ---- Get-History */
  function cmdHistory(ctx) {
    var hs = ctx.session.hist, P = ctx.p, list = hs.slice();
    if (P.Id) { var ids = P.Id.map(Number); list = list.filter(function (e) { return ids.indexOf(e.id) >= 0; }); }
    if (P.Count !== undefined) list = list.slice(Math.max(0, list.length - Number(P.Count)));
    list.forEach(function (e) {
      ctx.emitOne(new PSObj('Microsoft.PowerShell.Commands.HistoryInfo', [['Id', e.id], ['CommandLine', e.line], ['ExecutionStatus', 'Completed'], ['StartExecutionTime', mkDate(e.t || LAB.clock.ms())], ['EndExecutionTime', mkDate(e.t || LAB.clock.ms())]], { fmt: 'history' }));
    });
    return 0;
  }
  function cmdSleep(ctx) {
    var P = ctx.p, ms = 0;
    if (P.Milliseconds !== undefined) ms = Number(P.Milliseconds); else if (P.Seconds !== undefined) ms = Number(P.Seconds) * 1000;
    ms = Math.max(0, Math.min(isFinite(ms) ? ms : 0, 10000));
    if (ms > 0) { ctx.effect({ type: 'sleep', ms: ms }); ctx.sleepMs = ms; }
    return 0;
  }

  /* ---- natives: whoami, hostname */
  function cmdWhoami(ctx) { ctx.out(HOST.toLowerCase() + '\\' + USER + '\n'); return 0; }
  function cmdHostname(ctx) { ctx.out(HOST + '\n'); return 0; }

  /* ---- help */
  var HELP_TEXT = [
    '',
    '練習用的 PowerShell 可以用這些指令（大小寫都可以）：',
    '',
    '  看和走        ls (dir)、cd、pwd、tree、tree /f',
    '  檔案          mkdir、mv、cp、rm、cat、New-Item、Set-Content、Add-Content、Rename-Item、Test-Path',
    '  壓縮          tar -xvf <壓縮檔>、Compress-Archive、Expand-Archive',
    '  管線          ls | Sort-Object Length、Where-Object { $_.Length -gt 1000 }、Select-Object、',
    '                Measure-Object、Group-Object、ForEach-Object',
    '  表格和檔案    Format-Table、Format-List、Out-File、Select-String、Import-Csv、Export-Csv、ConvertTo-Json',
    '  變數和算式    $a = 3、1+2*3、"Hi $env:USERNAME"、$PSVersionTable',
    '  系統          Get-Date、Get-Process、Stop-Process、Get-Service、Get-ComputerInfo、systeminfo、hostname、whoami',
    '  網路          ipconfig、ping、Test-Connection、nslookup、tracert、curl、Invoke-RestMethod',
    '  打開          explorer .、code .、notepad <檔案>、Start-Process（記事本、網址…）',
    '  套件          winget install Git.Git、winget install Python.Python.3.12',
    '  說明          Get-Help <指令> [-Examples]、Get-Command、Get-Alias、history、cls、exit',
    '',
    '打指令之前，輸入法要切成英文（按一下 Shift，工作列的 中 會變成 英）。',
    'Tab 可以補完指令、參數和檔名；Ctrl+C 可以中斷正在跑的指令。',
    ''
  ].join('\n') + '\n';
  var HELP_ONE = {
    'get-childitem': 'ls（dir）：列出資料夾裡的東西。-Force 連隱藏的也列出，-Recurse 連裡面的資料夾也列出。',
    'set-location': 'cd：走到另一個資料夾。cd .. 往外一層，cd ~ 回到家，路徑有空格要加引號：cd "Saved Games"。',
    'get-location': 'pwd：顯示現在所在的資料夾。',
    'mkdir': 'mkdir：建立新資料夾，並列出它。',
    'move-item': 'mv：搬移東西。mv 東西 資料夾 是搬進去；目的地不存在時，會直接改名。',
    'copy-item': 'cp：複製東西。複製資料夾要加 -Recurse。',
    'remove-item': 'rm：刪除東西。沒有資源回收筒，刪了就沒了；資料夾要加 -Recurse。',
    'get-content': 'cat：顯示檔案的內容。',
    'tar': 'tar：-x 解開、-v 把每個檔案列出來、-f 指定檔案。tar -xvf week3.zip',
    'explorer': 'explorer .：用檔案總管打開這個資料夾。'
  };
  function cmdHelp(ctx) {
    var args = ctx.rawArgs.map(String), a = args.filter(function (x) { return x.charAt(0) !== '-'; })[0];
    if (!a) { ctx.out(HELP_TEXT); return 0; }
    var p = { Name: a };
    args.forEach(function (x) { if (/^-ex/i.test(x)) p.Examples = true; if (/^-on/i.test(x)) p.Online = true; });
    ctx.p = p;
    return cmdGetHelp(ctx);
  }

  /* ---- tar.exe (bsdtar on Windows) */
  var TAR_USAGE = 'Usage:\n  List:    tar.exe -tf <archive-filename>\n  Extract: tar.exe -xf <archive-filename>\n  Create:  tar.exe -cf <archive-filename> [filenames...]\n  Help:    tar.exe --help\n';
  function cmdTar(ctx) {
    var s = ctx.session, vfs = s.vfs, args = ctx.rawArgs, i = 0;
    var mode = null, verbose = false, file = null, dirC = null, members = [], needArg = null;
    function bad(text, usage) { ctx.native(text + '\n' + (usage ? TAR_USAGE : '')); return 1; }
    // the old style without a dash: tar xvf week3.zip
    var flagWords = [];
    if (args.length && /^[A-Za-z]+$/.test(args[0])) flagWords.push(args[0]);
    var rest = flagWords.length ? args.slice(1) : args;
    var tokens = [];
    if (flagWords.length) tokens.push('-' + flagWords[0]);
    rest.forEach(function (a) { tokens.push(a); });
    for (i = 0; i < tokens.length; i++) {
      var a = tokens[i];
      if (a.indexOf('--') === 0) {
        if (a === '--extract' || a === '--get') mode = 'x'; else if (a === '--list') mode = 't'; else if (a === '--verbose') verbose = true;
        else if (a === '--file') { file = tokens[++i]; if (file === undefined) return bad('tar.exe: Option --file requires an argument', true); }
        else return bad('tar.exe: Option ' + a + ' is not supported', true);
        continue;
      }
      if (a.charAt(0) === '-' && a.length > 1) {
        for (var k = 1; k < a.length; k++) {
          var ch = a.charAt(k);
          if (ch === 'x' || ch === 't' || ch === 'c' || ch === 'r' || ch === 'u') mode = mode || ch;
          else if (ch === 'v') verbose = true;
          else if (ch === 'f') { file = tokens[++i]; if (file === undefined) return bad('tar.exe: Option -f requires an argument', true); }
          else if (ch === 'C') { dirC = tokens[++i]; if (dirC === undefined) return bad('tar.exe: Option -C requires an argument', true); }
          // other letters (z, p, k, ...) are accepted and ignored, as the real tar.exe does for most of them
        }
        continue;
      }
      members.push(a);
    }
    if (!mode) { ctx.native('tar.exe: Must specify one of -c, -r, -t, -u, -x\n'); return 1; }
    if (mode === 'c' || mode === 'r' || mode === 'u') {
      if (!members.length && mode === 'c') { ctx.native('tar.exe: no files or directories specified\n'); return 1; }
      ctx.native(PRACTICE_NOTE + '練習版的 tar 只做解開（-x）和列出（-t）。）\n'); return 1;
    }
    var shownFile = file === null ? '\\\\.\\tape0' : file;
    // tar.exe does not expand ~ : only PowerShell cmdlets do (a real trap, win-facts §5.3)
    var zr = file === null ? null : resolvePath(s, file);
    var zst = zr && !zr.err ? vfs.stat(zr.abs) : null;
    if (!zst) { ctx.native("tar.exe: Error opening archive: Failed to open '" + shownFile + "'\n"); return 1; }
    if (zst.type === 'dir') { ctx.native("tar.exe: Error opening archive: Error reading '" + shownFile + "'\n"); return 1; }
    var entries = zst.kind === 'zip' ? vfs.zipEntries(zst.path) : null;
    if (!entries) { ctx.native('tar.exe: Error opening archive: Unrecognized archive format\n'); return 1; }
    var wanted = members.length ? members : null;
    function selected(en) {
      if (!wanted) return true;
      return wanted.some(function (m) { var mm = m.replace(/\\/g, '/').replace(/\/+$/, ''); var nn = en.name.replace(/\/+$/, ''); return nn === mm || nn.indexOf(mm + '/') === 0; });
    }
    var status = 0;
    if (wanted) {
      wanted.forEach(function (m) {
        var mm = m.replace(/\\/g, '/').replace(/\/+$/, '');
        if (!entries.some(function (en) { var nn = en.name.replace(/\/+$/, ''); return nn === mm || nn.indexOf(mm + '/') === 0; })) { ctx.native('tar.exe: ' + m + ': Not found in archive\n'); status = 1; }
      });
    }
    if (mode === 't') {
      var listing = entries.filter(selected).map(function (en) { return en.name; }).join('\n');
      if (listing) ctx.out(listing + '\n');
      if (status) ctx.native('tar.exe: Error exit delayed from previous errors\n');
      return status;
    }
    // -x
    var dest = s.cwd;
    if (dirC !== null) {
      var dr = resolvePath(s, dirC);
      if (dr.err || !vfs.isDir(dr.abs)) { ctx.native("tar.exe: could not chdir to '" + dirC + "'\n"); return 1; }
      dest = dr.abs;
    }
    try { vfs.extractZip(zst.path, dest, { by: 'terminal', filter: wanted ? function (nm) { return selected({ name: nm }); } : undefined }); }
    catch (e) { ctx.native('tar.exe: ' + (e && e.code === 'EACCES' ? "Can't create '" + dest + "'" : 'Error exit delayed from previous errors') + '\n'); return 1; }
    if (verbose) ctx.native(entries.filter(selected).map(function (en) { return 'x ' + en.name; }).join('\n') + '\n');
    if (status) ctx.native('tar.exe: Error exit delayed from previous errors\n');
    return status;
  }

  /* ---- Expand-Archive (bonus) */
  function cmdExpand(ctx) {
    var s = ctx.session, vfs = s.vfs, P = ctx.p;
    var arg = hasOwn.call(P, 'LiteralPath') ? P.LiteralPath : P.Path;
    var zr = resolvePath(s, arg);
    var zst = zr.err ? null : vfs.stat(zr.abs);
    if (!zst || zst.type === 'dir') {
      return ctx.fail({ msg: "路徑 '" + arg + "' 不存在或不是有效的檔案系統路徑。", cat: 'InvalidArgument', target: arg, activity: 'Expand-Archive', reason: 'InvalidOperationException', fq: 'ArchiveCmdletPathNotFound,Expand-Archive' });
    }
    var ext = vfs.extname(zst.name).toLowerCase();
    if (ext !== '.zip') {
      return ctx.fail({ msg: ext + ' 不是支援的保存檔案格式。.zip 是唯一支援的保存檔案格式。', cat: 'InvalidArgument', target: ext, activity: 'Expand-Archive', reason: 'IOException', fq: 'NotSupportedArchiveFileExtension,Expand-Archive' });
    }
    var entries = zst.kind === 'zip' ? vfs.zipEntries(zst.path) : null;
    if (!entries) {
      // the real text (the module path and the clipped source line are constants of Windows PowerShell 5.1)
      ctx.err('New-Object : 以 "3" 引數呼叫 ".ctor" 時發生例外狀況: "中央目錄損毀。"\n' +
        '位於 C:\\WINDOWS\\system32\\WindowsPowerShell\\v1.0\\Modules\\Microsoft.PowerShell.Archive\\Microsoft.PowerShell.Archive.psm1:1014 字元:23\n' +
        '+ ... ipArchive = New-Object -TypeName System.IO.Compression.ZipArchive -Ar ...\n' +
        '+                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~\n' +
        '    + CategoryInfo          : InvalidOperation: (:) [New-Object]，MethodInvocationException\n' +
        '    + FullyQualifiedErrorId : ConstructorInvokedThrowException,Microsoft.PowerShell.Commands.NewObjectCommand\n\n');
      return 1;
    }
    if (P.DestinationPath === undefined || P.DestinationPath === null) {
      // real PowerShell asks 「DestinationPath:」 here; the practice PC reports the missing parameter instead
      return ctx.fail({ msg: '無法處理命令，因為至少遺失了一個必要參數:  DestinationPath。', cat: 'InvalidArgument', target: '', activity: 'Expand-Archive', reason: 'ParameterBindingException', fq: 'MissingMandatoryParameter,Expand-Archive' });
    }
    var dr = resolvePath(s, P.DestinationPath);
    if (dr.err) return failPathNotFound(ctx, { kind: dr.err, disp: dr.disp, drive: dr.drive });
    if (!P.Force) {
      var clash = entries.filter(function (en) { return en.type === 'file' && vfs.exists(vfs.join(dr.abs, en.name)); })[0];
      if (clash) {
        var cd = joinDisp(dr.disp, clash.name.replace(/\//g, '\\')), zd = zr.disp;
        ctx.err(PSMSG_EXPAND(zd, cd));
        return 1;
      }
    }
    try { vfs.extractZip(zst.path, dr.abs, { by: 'terminal' }); } catch (e) { return mapVfs(ctx, e, dr.disp, 'Expand-Archive'); }
    return 0;
  }
  /* the real (long) text of Expand-Archive when a file already exists; the module path is a constant of Windows PowerShell 5.1 */
  function PSMSG_EXPAND(zipDisp, fileDisp) {
    var cols = 120;
    var msg = 'ExpandArchiveHelper : 擴充保存檔案 \'' + zipDisp + '\' 內容時無法建立檔案 \'' + fileDisp + '\'，因為檔案 \'' + fileDisp + '\' 已經存在。如果您想要在擴充保存檔案時覆寫現有的目錄 \'' + fileDisp + '\' 內容，請使用 -Force 參數。';
    return msg + '\n位於 C:\\WINDOWS\\system32\\WindowsPowerShell\\v1.0\\Modules\\Microsoft.PowerShell.Archive\\Microsoft.PowerShell.Archive.psm1:407 字元:17\n' +
      '+ ...             ExpandArchiveHelper $resolvedSourcePaths $resolvedDestina ...\n' +
      '+                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~\n' +
      '    + CategoryInfo          : InvalidOperation: (' + ellipsize(fileDisp) + ':String) [Write-Error]，IOException\n' +
      '    + FullyQualifiedErrorId : ExpandArchiveFileExists,ExpandArchiveHelper\n\n';
  }

  /* ---- opening things: explorer, ii, start, code, notepad */
  function openTargets(ctx, typedList, opt) {
    var s = ctx.session, status = 0;
    typedList.forEach(function (arg) {
      if (arg === null) return;
      if (/^[a-z][a-z0-9+.-]*:\/\//i.test(arg)) { ctx.effect({ type: 'url', url: arg }); return; }
      if (/^ms-settings:/i.test(arg)) { ctx.effect({ type: 'launch', appId: 'settings' }); return; }
      var ex = expandPath(s, arg, false);
      if (ex.miss || !ex.items.length) {
        if (opt.silentMissing) { ctx.effect({ type: 'open', path: HOME + '/Documents', appId: opt.appId }); status = 1; return; }
        if (opt.launchIfMissing) { ctx.effect({ type: 'launch', appId: opt.appId }); return; }          // `code nofile.txt` just opens the editor
        status = 1; failPathNotFound(ctx, ex.miss || { kind: 'path', disp: arg }); return;
      }
      ex.items.forEach(function (it) { ctx.effect({ type: 'open', path: it.abs, appId: opt.appId }); });
    });
    return status;
  }
  function cmdExplorer(ctx) {
    var args = ctx.rawArgs.filter(function (a) { return !/^\/(e|n|root|select)/i.test(a) && a !== ''; });
    if (!args.length) { ctx.effect({ type: 'open', path: HOME }); return 0; }
    return openTargets(ctx, args.map(function (a) { return a.replace(/^"|"$/g, ''); }), { silentMissing: true, appId: 'finder' }) && 0;
  }
  function cmdInvoke(ctx) { return openTargets(ctx, pathArgs(ctx, ctx.p.Path || []), {}); }
  var START_PROGRAMS = { notepad: 'textedit', 'notepad.exe': 'textedit', code: 'code', 'code.cmd': 'code', explorer: 'finder', 'explorer.exe': 'finder', wt: 'terminal', 'wt.exe': 'terminal', calc: 'calculator', 'calc.exe': 'calculator', calculator: 'calculator',
    taskmgr: 'taskmgr', 'taskmgr.exe': 'taskmgr', msedge: 'edge', 'msedge.exe': 'edge', edge: 'edge', 'microsoft-edge:': 'edge', photos: 'photos', 'microsoft.photos:': 'photos', winver: 'about' };
  function cmdStart(ctx) {
    var P = ctx.p, fp = P.FilePath;
    if (fp === null || fp === undefined) return 0;
    var prog = String(fp).toLowerCase();
    var extra = (P.ArgumentList || []).filter(Boolean);
    if (hasOwn.call(START_PROGRAMS, prog)) {
      var appId = START_PROGRAMS[prog];
      if (!extra.length) { ctx.effect({ type: 'launch', appId: appId }); return 0; }
      return openTargets(ctx, extra, { appId: appId });
    }
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(String(fp)) || /^ms-settings:/i.test(String(fp))) return openTargets(ctx, [fp], {});
    var ex = expandPath(ctx.session, String(fp), false);
    if (!ex.miss && ex.items.length) return openTargets(ctx, [fp], {});
    // not a path and not a program of this PC: the real Start-Process error
    return ctx.fail({ msg: '無法執行這個命令，因為發生錯誤: 系統找不到指定的檔案。。', cat: 'InvalidOperation', target: '', activity: 'Start-Process', reason: 'InvalidOperationException', fq: 'InvalidOperationException,' + NS + 'StartProcessCommand' });
  }
  function cmdCode(ctx) {
    var args = ctx.rawArgs.filter(function (a) { return a.charAt(0) !== '-'; });
    if (!args.length) { ctx.effect({ type: 'launch', appId: 'code' }); return 0; }
    return openTargets(ctx, args, { appId: 'code', launchIfMissing: true });
  }
  function cmdNotepad(ctx) {
    var args = ctx.rawArgs.filter(function (a) { return a.charAt(0) !== '/'; });
    if (!args.length) { ctx.effect({ type: 'launch', appId: 'textedit' }); return 0; }
    var s = ctx.session, status = 0;
    args.forEach(function (arg) {
      var r = resolvePath(s, arg);
      if (r.err) { ctx.effect({ type: 'launch', appId: 'textedit' }); return; }
      var st = s.vfs.stat(r.abs);
      if (st && st.type !== 'dir') ctx.effect({ type: 'open', path: st.path, appId: 'textedit' });
      else ctx.effect({ type: 'launch', appId: 'textedit' });       // a name that does not exist: Notepad opens (and would offer to create it)
    });
    return status;
  }

  /* ---- the command table.
     `canon` is the word the missions check (DESIGN W5): one of ls cd pwd mkdir mv cp rm cat echo clear tar unzip open code notepad whoami hostname history exit help unknown.
     Commands that have no word of their own there (Get-Item, Get-Date, Test-Path, Set-Content, Expand-Archive, New-Item for a file ...) are 'unknown' with their real status;
     Rename-Item counts as 'mv' (it is a move), Push-/Pop-Location as 'cd' (they change the folder). A typed `unzip` is 'unzip' with status 1. */
  defCmd({ id: 'ls', canon: 'ls', spec: SPEC.ls, run: cmdLs }, ['Get-ChildItem', 'gci', 'ls', 'dir']);
  defCmd({ id: 'gi', canon: 'unknown', spec: SPEC.gi, run: cmdGi }, ['Get-Item', 'gi']);
  defCmd({ id: 'cd', canon: 'cd', spec: SPEC.cd, run: cmdCd }, ['Set-Location', 'sl', 'cd', 'chdir']);
  defCmd({ id: 'pwd', canon: 'pwd', spec: SPEC.pwd, run: cmdPwd }, ['Get-Location', 'gl', 'pwd']);
  defCmd({ id: 'pushd', canon: 'cd', spec: SPEC.pushd, run: cmdPushd }, ['Push-Location', 'pushd']);
  defCmd({ id: 'popd', canon: 'cd', spec: SPEC.popd, run: cmdPopd }, ['Pop-Location', 'popd']);
  defCmd({ id: 'mkdir', canon: 'mkdir', spec: SPEC.mkdir, run: cmdMkdir }, ['mkdir', 'md']);
  defCmd({ id: 'ni', canon: 'mkdir', spec: SPEC.ni, run: cmdNi, canonOf: function (ctx) { return ctx.p && ctx.p.ItemType && /^d/i.test(ctx.p.ItemType) ? 'mkdir' : 'unknown'; } }, ['New-Item', 'ni']);
  defCmd({ id: 'mv', canon: 'mv', spec: SPEC.mv, run: cmdMv }, ['Move-Item', 'mi', 'mv', 'move']);
  defCmd({ id: 'cp', canon: 'cp', spec: SPEC.cp, run: cmdCp }, ['Copy-Item', 'cpi', 'cp', 'copy']);
  defCmd({ id: 'rm', canon: 'rm', spec: SPEC.rm, run: cmdRm }, ['Remove-Item', 'ri', 'rm', 'rmdir', 'rd', 'del', 'erase']);
  defCmd({ id: 'ren', canon: 'mv', spec: SPEC.ren, run: cmdRen }, ['Rename-Item', 'rni', 'ren']);
  defCmd({ id: 'cat', canon: 'cat', spec: SPEC.cat, run: cmdCat }, ['Get-Content', 'gc', 'cat', 'type']);
  defCmd({ id: 'echo', canon: 'echo', spec: SPEC.echo, run: cmdEcho }, ['Write-Output', 'echo', 'write']);
  defCmd({ id: 'host', canon: 'echo', spec: SPEC.host, run: cmdHost }, ['Write-Host']);
  defCmd({ id: 'clear', canon: 'clear', noargs: true, name: 'Clear-Host', run: cmdClear }, ['Clear-Host', 'cls', 'clear']);
  defCmd({ id: 'history', canon: 'history', spec: SPEC.history, run: cmdHistory }, ['Get-History', 'ghy', 'h', 'history']);
  defCmd({ id: 'sleep', canon: 'unknown', spec: SPEC.sleep, run: cmdSleep }, ['Start-Sleep', 'sleep']);
  defCmd({ id: 'testpath', canon: 'unknown', spec: SPEC.testpath, run: cmdTestPath }, ['Test-Path']);
  defCmd({ id: 'setcontent', canon: 'unknown', spec: SPEC.setcontent, run: cmdSetContent(false) }, ['Set-Content', 'sc']);
  defCmd({ id: 'addcontent', canon: 'unknown', spec: SPEC.addcontent, run: cmdSetContent(true) }, ['Add-Content', 'ac']);
  defCmd({ id: 'exit', canon: 'exit', native: true, name: 'exit', run: cmdExit }, ['exit']);
  defCmd({ id: 'help', canon: 'help', native: true, name: 'help', run: cmdHelp }, ['help', 'man', 'Get-Help']);
  defCmd({ id: 'whoami', canon: 'whoami', native: true, name: 'whoami', run: cmdWhoami }, ['whoami']);
  defCmd({ id: 'hostname', canon: 'hostname', native: true, name: 'hostname', run: cmdHostname }, ['hostname']);
  defCmd({ id: 'tar', canon: 'tar', native: true, name: 'tar', run: cmdTar }, ['tar']);
  defCmd({ id: 'expand', canon: 'unknown', spec: SPEC.expand, run: cmdExpand }, ['Expand-Archive']);
  defCmd({ id: 'explorer', canon: 'open', native: true, name: 'explorer', run: cmdExplorer }, ['explorer']);
  defCmd({ id: 'invoke', canon: 'open', spec: SPEC.invoke, run: cmdInvoke }, ['Invoke-Item', 'ii']);
  defCmd({ id: 'start', canon: 'open', spec: SPEC.start, run: cmdStart }, ['Start-Process', 'saps', 'start']);
  defCmd({ id: 'code', canon: 'code', native: true, name: 'code', run: cmdCode }, ['code', 'code.cmd']);
  defCmd({ id: 'notepad', canon: 'notepad', native: true, name: 'notepad', run: cmdNotepad }, ['notepad']);
  var NATIVE_EXE = { tar: 1, whoami: 1, hostname: 1, explorer: 1, notepad: 1, code: 1, help: 0 };

  /* ====================================================================================================================
     Round 5 — the object-pipeline cmdlets: Sort / Where / Select / Measure / Group / ForEach / Format-* / Out-* / Select-String / CSV / JSON.
     Every cmdlet reads ctx.input (the objects of the previous stage, or its own -InputObject) and ctx.emit()s objects; the last stage is
     rendered by renderObjs (Out-Default). Parameter tables follow the real cmdlets of Windows PowerShell 5.1 closely enough for -Abbreviations.
     ==================================================================================================================== */
  var T_OBJ = 'System.Object';
  var OP_PARAMS = ['EQ', 'CEQ', 'NE', 'CNE', 'GT', 'CGT', 'LT', 'CLT', 'GE', 'CGE', 'LE', 'CLE', 'Like', 'CLike', 'NotLike', 'CNotLike', 'Match', 'CMatch', 'NotMatch', 'CNotMatch', 'Contains', 'CContains', 'NotContains', 'CNotContains', 'In', 'CIn', 'NotIn', 'CNotIn', 'Is', 'IsNot'];
  var CORE = 'Microsoft.PowerShell.Commands.';
  SPEC.sort = { name: 'Sort-Object', cls: CORE + 'SortObjectCommand', params: [val('Property', { pos: 0, arr: true, raw: true, type: 'System.Object[]' }), sw('Descending'), sw('Unique'), val('InputObject', { raw: true, type: T_OBJ, pipe: true }),
    val('Culture', { type: T_STR }), sw('CaseSensitive')] };
  SPEC.where = { name: 'Where-Object', cls: CORE + 'WhereObjectCommand', params: [val('FilterScript', { pos: 0, raw: true, type: 'System.Management.Automation.ScriptBlock' }), val('Property', { raw: true, type: T_STR }),
    val('Value', { pos: 1, raw: true, type: T_OBJ }), val('InputObject', { raw: true, type: T_OBJ, pipe: true })].concat(OP_PARAMS.map(function (n) { return val(n, { raw: true, type: T_OBJ }); })) };
  SPEC.select = { name: 'Select-Object', cls: CORE + 'SelectObjectCommand', params: [val('InputObject', { raw: true, type: T_OBJ, pipe: true }), val('Property', { pos: 0, arr: true, raw: true, type: 'System.Object[]' }),
    val('ExcludeProperty', { arr: true, type: T_ARR }), val('ExpandProperty', { type: T_STR }), sw('Unique'), val('Last', { type: 'System.Int32' }), val('First', { type: 'System.Int32' }), val('Skip', { type: 'System.Int32' }),
    val('SkipLast', { type: 'System.Int32' }), sw('Wait'), val('Index', { arr: true, type: 'System.Int32[]' })] };
  SPEC.measure = { name: 'Measure-Object', cls: CORE + 'MeasureObjectCommand', params: [val('InputObject', { raw: true, type: T_OBJ, pipe: true }), val('Property', { pos: 0, arr: true, type: T_ARR }),
    sw('Sum'), sw('Average'), sw('Maximum'), sw('Minimum'), sw('Line'), sw('Word'), sw('Character'), sw('IgnoreWhiteSpace'), sw('AllStats')] };
  SPEC.group = { name: 'Group-Object', cls: CORE + 'GroupObjectCommand', params: [val('NoElement', { type: 'System.Boolean' }), val('AsHashTable', { type: 'System.Boolean' }), sw('AsString'),
    val('InputObject', { raw: true, type: T_OBJ, pipe: true }), val('Property', { pos: 0, arr: true, raw: true, type: 'System.Object[]' }), val('Culture', { type: T_STR }), sw('CaseSensitive')] };
  SPEC.group.params[0] = sw('NoElement'); SPEC.group.params[1] = sw('AsHashTable');
  SPEC.foreach = { name: 'ForEach-Object', cls: CORE + 'ForEachObjectCommand', params: [val('InputObject', { raw: true, type: T_OBJ, pipe: true }), val('Begin', { raw: true, type: 'System.Management.Automation.ScriptBlock' }),
    val('Process', { pos: 0, arr: true, raw: true, type: 'System.Management.Automation.ScriptBlock[]' }), val('End', { raw: true, type: 'System.Management.Automation.ScriptBlock' }),
    val('RemainingScripts', { arr: true, raw: true, type: 'System.Management.Automation.ScriptBlock[]' }), val('MemberName', { type: T_STR }), val('ArgumentList', { arr: true, raw: true, type: T_ARR, al: ['Args'] })] };
  SPEC.ft = { name: 'Format-Table', cls: CORE + 'FormatTableCommand', params: [sw('AutoSize'), sw('HideTableHeaders'), sw('Wrap'), val('Property', { pos: 0, arr: true, raw: true, type: 'System.Object[]' }), val('GroupBy', { raw: true, type: T_OBJ }),
    val('View', { type: T_STR }), sw('ShowError'), sw('DisplayError'), sw('Force'), val('Expand', { type: T_STR }), val('InputObject', { raw: true, type: T_OBJ, pipe: true })] };
  SPEC.fl = { name: 'Format-List', cls: CORE + 'FormatListCommand', params: [val('Property', { pos: 0, arr: true, raw: true, type: 'System.Object[]' }), val('GroupBy', { raw: true, type: T_OBJ }), val('View', { type: T_STR }),
    sw('ShowError'), sw('DisplayError'), sw('Force'), val('Expand', { type: T_STR }), val('InputObject', { raw: true, type: T_OBJ, pipe: true })] };
  SPEC.fw = { name: 'Format-Wide', cls: CORE + 'FormatWideCommand', params: [val('Property', { pos: 0, raw: true, type: T_OBJ }), sw('AutoSize'), val('Column', { type: 'System.Int32' }), val('GroupBy', { raw: true, type: T_OBJ }),
    val('View', { type: T_STR }), sw('ShowError'), sw('DisplayError'), sw('Force'), val('Expand', { type: T_STR }), val('InputObject', { raw: true, type: T_OBJ, pipe: true })] };
  SPEC.outfile = { name: 'Out-File', cls: CORE + 'OutFileCommand', risk: true, params: [val('FilePath', { pos: 0, mand: true, type: T_STR, al: ['Path'] }), val('LiteralPath', { type: T_STR, al: ['PSPath'] }), val('Encoding', { pos: 1, type: T_STR }),
    sw('Append'), sw('Force'), sw('NoClobber', ['NoOverwrite']), val('Width', { type: 'System.Int32' }), sw('NoNewline'), val('InputObject', { raw: true, type: T_OBJ, pipe: true })] };
  SPEC.outstring = { name: 'Out-String', cls: CORE + 'OutStringCommand', params: [sw('Stream'), val('Width', { type: 'System.Int32' }), val('InputObject', { raw: true, type: T_OBJ, pipe: true })] };
  SPEC.outhost = { name: 'Out-Host', cls: CORE + 'OutHostCommand', params: [sw('Paging'), val('InputObject', { raw: true, type: T_OBJ, pipe: true })] };
  SPEC.outnull = { name: 'Out-Null', cls: CORE + 'OutNullCommand', params: [val('InputObject', { raw: true, type: T_OBJ, pipe: true })] };
  SPEC.sls = { name: 'Select-String', cls: CORE + 'SelectStringCommand', params: [val('Pattern', { pos: 0, arr: true, type: T_ARR, mand: true }), val('Path', { pos: 1, arr: true, type: T_ARR }), val('LiteralPath', { arr: true, type: T_ARR }),
    val('InputObject', { raw: true, type: T_OBJ, pipe: true }), sw('SimpleMatch'), sw('CaseSensitive'), sw('Quiet'), sw('List'), val('Include', { arr: true, type: T_ARR }), val('Exclude', { arr: true, type: T_ARR }), sw('NotMatch'),
    sw('AllMatches'), val('Encoding', { type: T_STR }), val('Context', { arr: true, type: 'System.Int32[]' })] };
  SPEC.ipcsv = { name: 'Import-Csv', cls: CORE + 'ImportCsvCommand', params: [val('Delimiter', { pos: 1, type: 'System.Char' }), val('Path', { pos: 0, arr: true, type: T_ARR, pipe: true, mand: true }), val('LiteralPath', { arr: true, type: T_ARR, al: ['PSPath'] }),
    sw('UseCulture'), val('Header', { arr: true, type: T_ARR }), val('Encoding', { type: T_STR })] };
  SPEC.epcsv = { name: 'Export-Csv', cls: CORE + 'ExportCsvCommand', risk: true, params: [val('InputObject', { raw: true, type: T_OBJ, pipe: true }), val('Path', { pos: 0, type: T_STR }), val('LiteralPath', { type: T_STR, al: ['PSPath'] }),
    sw('Force'), sw('NoClobber'), val('Encoding', { type: T_STR }), sw('Append'), val('Delimiter', { pos: 1, type: 'System.Char' }), sw('UseCulture'), sw('NoTypeInformation')] };
  SPEC.tocsv = { name: 'ConvertTo-Csv', cls: CORE + 'ConvertToCsvCommand', params: [val('InputObject', { raw: true, type: T_OBJ, pipe: true }), val('Delimiter', { pos: 1, type: 'System.Char' }), sw('UseCulture'), sw('NoTypeInformation')] };
  SPEC.fromcsv = { name: 'ConvertFrom-Csv', cls: CORE + 'ConvertFromCsvCommand', params: [val('InputObject', { raw: true, type: T_OBJ, pipe: true }), val('Delimiter', { pos: 1, type: 'System.Char' }), sw('UseCulture'), val('Header', { arr: true, type: T_ARR })] };
  SPEC.tojson = { name: 'ConvertTo-Json', cls: CORE + 'ConvertToJsonCommand', params: [val('InputObject', { pos: 0, raw: true, type: T_OBJ, pipe: true }), val('Depth', { type: 'System.Int32' }), sw('Compress')] };
  SPEC.fromjson = { name: 'ConvertFrom-Json', cls: CORE + 'ConvertFromJsonCommand', params: [val('InputObject', { pos: 0, raw: true, type: T_OBJ, pipe: true, mand: true })] };
  SPEC.tee = { name: 'Tee-Object', cls: CORE + 'TeeObjectCommand', params: [val('InputObject', { raw: true, type: T_OBJ, pipe: true }), val('FilePath', { pos: 0, type: T_STR, al: ['Path'] }), val('LiteralPath', { type: T_STR }), sw('Append'), val('Variable', { type: T_STR })] };
  SPEC.gm = { name: 'Get-Member', cls: CORE + 'GetMemberCommand', params: [val('InputObject', { raw: true, type: T_OBJ, pipe: true }), val('Name', { pos: 0, arr: true, type: T_ARR }), val('MemberType', { type: T_STR }), val('View', { type: T_STR }), sw('Static'), sw('Force')] };
  SPEC.unique = { name: 'Get-Unique', cls: CORE + 'GetUniqueCommand', params: [val('InputObject', { raw: true, type: T_OBJ, pipe: true }), sw('AsString'), sw('OnType')] };
  SPEC.random = { name: 'Get-Random', cls: CORE + 'GetRandomCommand', params: [val('Maximum', { pos: 0, raw: true, type: T_OBJ }), val('Minimum', { pos: 1, raw: true, type: T_OBJ }), val('InputObject', { raw: true, type: T_OBJ, pipe: true }),
    val('Count', { type: 'System.Int32' }), val('SetSeed', { type: 'System.Int32' })] };
  SPEC.writewarn = { name: 'Write-Warning', cls: CORE + 'WriteWarningCommand', params: [val('Message', { pos: 0, mand: true, type: T_STR, al: ['Msg'] })] };
  SPEC.writeerr = { name: 'Write-Error', cls: CORE + 'WriteErrorCommand', params: [val('Message', { pos: 0, mand: true, type: T_STR, al: ['Msg'] }), val('Category', { type: T_STR }), val('ErrorId', { type: T_STR }), val('TargetObject', { raw: true, type: T_OBJ })] };
  SPEC.readhost = { name: 'Read-Host', cls: CORE + 'ReadHostCommand', params: [val('Prompt', { pos: 0, raw: true, type: T_OBJ }), sw('AsSecureString')] };
  SPEC.setalias = { name: 'Set-Alias', cls: CORE + 'SetAliasCommand', params: [val('Name', { pos: 0, mand: true, type: T_STR }), val('Value', { pos: 1, mand: true, type: T_STR }), val('Description', { type: T_STR }), val('Option', { type: T_STR }), sw('PassThru'), val('Scope', { type: T_STR }), sw('Force')] };
  SPEC.clip = { name: 'Set-Clipboard', cls: CORE + 'SetClipboardCommand', params: [val('Value', { pos: 0, arr: true, raw: true, type: T_ARR, pipe: true }), sw('Append'), sw('AsHtml')] };
  SPEC.getclip = { name: 'Get-Clipboard', cls: CORE + 'GetClipboardCommand', params: [sw('Raw'), val('Format', { type: T_STR })] };

  function inputItems(ctx) {
    var P = ctx.p || {};
    if (ctx.hasInput) return ctx.input;
    if (P.InputObject !== undefined && P.InputObject !== null) return unroll(P.InputObject);
    return [];
  }
  function S_(ctx) { return ctx.session; }
  function evalSpecValue(spec, item, S) {
    if (isBlock(spec)) return unwrapOut(invokeBlock(spec, S, item));
    return getMember(item, strOf(spec), S);
  }
  /* a calculated property: @{Name='x'; Expression={...}} (n / l / label and e / expression are accepted) */
  function hashCol(h, S) {
    var lab = null, ex = null;
    ['Name', 'Label', 'n', 'l'].forEach(function (k) { if (lab === null && h.has(k)) lab = strOf(h.get(k)); });
    ['Expression', 'e'].forEach(function (k) { if (ex === null && h.has(k)) ex = h.get(k); });
    if (ex === null) return null;
    var width = h.has('Width') ? toNum(h.get('Width')) : null;
    if (lab === null) lab = isBlock(ex) ? ex.src.trim() : strOf(ex);
    return { h: lab, fn: function (it) { return evalSpecValue(ex, it, S); }, calc: true, ex: ex };
  }
  /* property specs (names, wildcards, blocks, hashtables) -> column descriptors, wildcards expanded against the items */
  function specCols(specs, items, S) {
    var cols = [];
    unroll(specs).forEach(function (sp) {
      if (isHash(sp)) { var hc = hashCol(sp, S); if (hc) cols.push(hc); return; }
      if (isBlock(sp)) { cols.push({ h: sp.src.trim(), fn: function (it) { return evalSpecValue(sp, it, S); } }); return; }
      var nm = strOf(sp);
      if (hasWildChars(nm)) {
        var re = wildRegex(nm), seen = {};
        items.forEach(function (it) { propNames(it).forEach(function (pn) { var lc = pn.toLowerCase(); if (re.test(pn) && !seen[lc]) { seen[lc] = 1; cols.push(namedCol(pn)); } }); });
        return;
      }
      // the label keeps the spelling of the property when the object has it
      var label = nm;
      for (var i = 0; i < items.length; i++) { var pn2 = propNames(items[i]).filter(function (x) { return x.toLowerCase() === nm.toLowerCase(); })[0]; if (pn2) { label = pn2; break; } }
      cols.push(namedCol(label));
    });
    return cols;
  }
  function selectedType(it) { return 'Selected.' + (typeNameOf(it) || T_OBJ); }

  /* ---- Sort-Object */
  function cmdSort(ctx) {
    var P = ctx.p, S = S_(ctx), items = inputItems(ctx).slice();
    var cs = !!P.CaseSensitive, desc = !!P.Descending;
    var keys = [];
    unroll(P.Property === undefined ? [] : P.Property).forEach(function (sp) {
      if (isHash(sp)) {
        var ex = sp.has('Expression') ? sp.get('Expression') : (sp.has('e') ? sp.get('e') : null);
        var d = sp.has('Descending') ? toBool(sp.get('Descending')) : (sp.has('Ascending') ? !toBool(sp.get('Ascending')) : null);
        if (ex !== null) keys.push({ get: function (it) { return evalSpecValue(ex, it, S); }, desc: d });
        return;
      }
      if (isBlock(sp)) { keys.push({ get: function (it) { return evalSpecValue(sp, it, S); }, desc: null }); return; }
      var nm = strOf(sp);
      if (hasWildChars(nm)) { items.length && propNames(items[0]).filter(function (x) { return wildRegex(nm).test(x); }).forEach(function (x) { keys.push({ get: function (it) { return getMember(it, x, S); }, desc: null }); }); return; }
      keys.push({ get: function (it) { return getMember(it, nm, S); }, desc: null });
    });
    var dec = items.map(function (it, i) { return { it: it, i: i, k: keys.length ? keys.map(function (k) { return k.get(it); }) : [it] }; });
    dec.sort(function (a, b) {
      for (var j = 0; j < a.k.length; j++) {
        var c = psCompare(a.k[j], b.k[j], cs);
        if (c) { var dj = keys.length && keys[j].desc !== null ? keys[j].desc : desc; return dj ? -c : c; }
      }
      return a.i - b.i;
    });
    var out = dec;
    if (P.Unique) {
      out = [];
      dec.forEach(function (d) { var last = out[out.length - 1]; if (last && last.k.every(function (kv, j) { return psEquals(kv, d.k[j], cs); })) return; out.push(d); });
    }
    ctx.emit(out.map(function (d) { return d.it; }));
    return 0;
  }

  /* ---- Where-Object */
  function cmdWhere(ctx) {
    var P = ctx.p, S = S_(ctx), items = inputItems(ctx);
    var fs = P.FilterScript;
    if (isBlock(fs)) {
      items.forEach(function (it) { if (blockTruthy(invokeBlock(fs, S, it))) ctx.emitOne(it); });
      return 0;
    }
    var prop = P.Property !== undefined ? strOf(P.Property) : (fs === undefined ? null : strOf(fs));
    if (prop === null) return 0;
    var op = null, rv = null, cs = false;
    for (var i = 0; i < OP_PARAMS.length; i++) {
      var n = OP_PARAMS[i];
      if (hasOwn.call(P, n)) { op = n; rv = P[n] === true ? P.Value : P[n]; break; }
    }
    items.forEach(function (it) {
      var lv = getMember(it, prop, S);
      if (op === null) { if (toBool(lv)) ctx.emitOne(it); return; }
      var o = op.toLowerCase(); cs = false;
      if (o.charAt(0) === 'c' && o !== 'contains' && o !== 'cnotcontains' && o !== 'cin' || /^c(contains|notcontains|in|notin)$/.test(o)) { cs = true; o = o.slice(1); }
      if (o === 'isnot' || o === 'is') rv = { pstype: { name: strOf(rv).replace(/^\[|\]$/g, '') } };
      var test = makeCmpTest(o, rv, cs, S, false);
      if (test && test(lv)) ctx.emitOne(it);
    });
    return 0;
  }

  /* ---- Select-Object */
  function cmdSelect(ctx) {
    var P = ctx.p, S = S_(ctx), items = inputItems(ctx).slice(), status = 0;
    if (P.Skip !== undefined) items = items.slice(Math.max(0, Number(P.Skip)));
    if (P.SkipLast !== undefined) items = items.slice(0, Math.max(0, items.length - Number(P.SkipLast)));
    if (P.First !== undefined) items = items.slice(0, Math.max(0, Number(P.First)));
    if (P.Last !== undefined) items = items.slice(Math.max(0, items.length - Number(P.Last)));
    if (P.Index) { var ix = P.Index.map(Number); items = items.filter(function (x, i) { return ix.indexOf(i) >= 0; }); }
    if (P.ExpandProperty !== undefined) {
      var pn = String(P.ExpandProperty);
      items.forEach(function (it) {
        var has = isObj(it) ? (it.file ? fileNamesFor(it).some(function (x) { return x.toLowerCase() === pn.toLowerCase(); }) : !!it.find(pn)) : (isHash(it) ? it.has(pn) : propNames(it).some(function (x) { return x.toLowerCase() === pn.toLowerCase(); }));
        var v = getMember(it, pn, S);
        if (!has || (v === null && !has)) {
          status = 1;
          ctx.fail({ msg: '找不到 "' + pn + '" 屬性。', cat: 'InvalidArgument', target: strOf(it), ttype: 'PSObject', activity: 'Select-Object', reason: 'PSArgumentException', fq: 'ExpandPropertyNotFound,' + CORE + 'SelectObjectCommand', head: 'Select-Object', start: ctx.cmd.start, len: ctx.cmd.end - ctx.cmd.start });
          return;
        }
        if (Array.isArray(v)) v.forEach(function (x) { ctx.emitOne(x); }); else ctx.emitOne(v);
      });
      return status;
    }
    if (P.Property === undefined) {
      if (P.Unique) { var seenU = []; items = items.filter(function (it) { var k = strOf(it); if (seenU.indexOf(k) >= 0) return false; seenU.push(k); return true; }); }
      ctx.emit(items);
      return 0;
    }
    var cols = specCols(P.Property, items, S);
    var excl = (P.ExcludeProperty || []).map(function (x) { return String(x).toLowerCase(); });
    cols = cols.filter(function (c) { return excl.indexOf(c.h.toLowerCase()) < 0; });
    var outs = items.map(function (it) {
      var o = new PSObj(selectedType(it), cols.map(function (c) { return [c.h, c.fn(it)]; }), { custom: true });
      return o;
    });
    if (P.Unique) { var seen = []; outs = outs.filter(function (o) { var k = o.p.map(function (e) { return strOf(e.v); }).join('\u0001'); if (seen.indexOf(k) >= 0) return false; seen.push(k); return true; }); }
    ctx.emit(outs);
    return 0;
  }

  /* ---- Measure-Object */
  function cmdMeasure(ctx) {
    var P = ctx.p, S = S_(ctx), items = inputItems(ctx), status = 0;
    var text = P.Line || P.Word || P.Character;
    if (text) {
      var lines = 0, words = 0, chars = 0;
      items.forEach(function (it) {
        var s = strOf(it);
        s.replace(/\r\n/g, '\n').split('\n').forEach(function (ln, i, arr) {
          if (i === arr.length - 1 && ln === '' && arr.length > 1) return;
          if (P.IgnoreWhiteSpace && ln.trim() === '') return;
          lines++;
          var w = ln.trim() === '' ? [] : ln.trim().split(/\s+/);
          words += w.length;
          chars += P.IgnoreWhiteSpace ? ln.replace(/\s/g, '').length : ln.length;
        });
      });
      ctx.emitOne(new PSObj('Microsoft.PowerShell.Commands.TextMeasureInfo', [['Lines', P.Line ? lines : null], ['Words', P.Word ? words : null], ['Characters', P.Character ? chars : null], ['Property', null]]));
      return 0;
    }
    var props = P.Property || [null];
    props.forEach(function (pn) {
      var vals = [], count = 0;
      items.forEach(function (it) {
        var v = pn === null ? it : getMember(it, pn, S);
        if (pn !== null && (v === null || v === undefined)) return;
        count++;
        vals.push(v);
      });
      var wantSum = P.Sum || P.AllStats, wantAvg = P.Average || P.AllStats, wantMax = P.Maximum || P.AllStats, wantMin = P.Minimum || P.AllStats;
      var res = { Count: count, Average: null, Sum: null, Maximum: null, Minimum: null };
      if (wantSum || wantAvg || wantMax || wantMin) {
        var nums = [], bad = null;
        vals.forEach(function (v) { var n = typeof v === 'number' ? v : (typeof v === 'string' || typeof v === 'boolean' ? toNum(v) : (isDate(v) ? v.ms : null)); if (n === null) { if (bad === null) bad = v; } else nums.push(n); });
        if (bad !== null && (wantSum || wantAvg)) {
          status = 1;
          ctx.fail({ msg: '輸入物件 "' + strOf(bad) + '" 不是數值。', cat: 'InvalidType', target: strOf(bad), ttype: typeNameOf(bad) ? shortType(typeNameOf(bad)) : 'String', activity: 'Measure-Object', reason: 'PSInvalidOperationException', fq: 'NonNumericInputObject,' + CORE + 'MeasureObjectCommand', head: 'Measure-Object', start: ctx.cmd.start, len: ctx.cmd.end - ctx.cmd.start });
        }
        var sum = nums.reduce(function (a, b) { return a + b; }, 0);
        if (wantSum && nums.length) res.Sum = sum;
        if (wantAvg && nums.length) res.Average = sum / nums.length;
        if (wantMax && vals.length) res.Maximum = nums.length ? Math.max.apply(null, nums) : vals.slice().sort(function (a, b) { return psCompare(b, a); })[0];
        if (wantMin && vals.length) res.Minimum = nums.length ? Math.min.apply(null, nums) : vals.slice().sort(function (a, b) { return psCompare(a, b); })[0];
      }
      ctx.emitOne(new PSObj('Microsoft.PowerShell.Commands.GenericMeasureInfo', [['Count', res.Count], ['Average', res.Average], ['Sum', res.Sum], ['Maximum', res.Maximum], ['Minimum', res.Minimum], ['Property', pn]]));
    });
    return status;
  }

  /* ---- Group-Object */
  function cmdGroup(ctx) {
    var P = ctx.p, S = S_(ctx), items = inputItems(ctx);
    var specs = P.Property === undefined ? [] : unroll(P.Property);
    var cs = !!P.CaseSensitive, order = [], map = Object.create(null);
    items.forEach(function (it) {
      var key = specs.length ? specs.map(function (sp) { return strOf(evalSpecValue(isHash(sp) ? (sp.get('Expression') || sp.get('e')) : sp, it, S)); }).join(', ') : strOf(it);
      var k = cs ? key : key.toLowerCase();
      if (!map[k]) { map[k] = { name: key, items: [] }; order.push(k); }
      map[k].items.push(it);
    });
    if (P.AsHashTable) {
      var h = new PSHash(null);
      order.forEach(function (k) { h.set(map[k].name, P.AsString || true ? (map[k].items.length === 1 ? map[k].items[0] : map[k].items) : map[k].items); });
      ctx.emitOne(h);
      return 0;
    }
    order.forEach(function (k) {
      var g = map[k];
      var o = new PSObj('Microsoft.PowerShell.Commands.GroupInfo', [['Count', g.items.length], ['Name', g.name], ['Group', P.NoElement ? null : g.items]], { fmt: 'group', noElement: !!P.NoElement });
      ctx.emitOne(o);
    });
    return 0;
  }

  /* ---- ForEach-Object */
  function cmdForEach(ctx) {
    var P = ctx.p, S = S_(ctx), items = inputItems(ctx), status = 0;
    var procs = P.Process === undefined ? [] : unroll(P.Process);
    if (P.MemberName !== undefined) procs = [P.MemberName];
    var begin = P.Begin, end = P.End, blocks = procs.filter(isBlock);
    if (blocks.length === 0 && procs.length && !isBlock(procs[0])) {
      // ForEach-Object Name  /  -MemberName Name
      var mn = strOf(procs[0]);
      items.forEach(function (it) { var v = getMember(it, mn, S); if (v !== null && v !== undefined) ctx.emit(v); });
      return 0;
    }
    if (isBlock(begin)) ctx.emit(invokeBlock(begin, S, null));
    var proc = blocks.length ? blocks[0] : null;
    if (blocks.length > 1 && !isBlock(end)) { end = blocks[blocks.length - 1]; }
    items.forEach(function (it) { if (proc) ctx.emit(invokeBlock(proc, S, it)); });
    if (isBlock(end)) ctx.emit(invokeBlock(end, S, null));
    return status;
  }

  /* ---- Format-Table / Format-List / Format-Wide / Out-String / Out-File / Out-Host / Out-Null */
  function formattedObj(text) { return new PSObj('Microsoft.PowerShell.Commands.Internal.Format.FormatEndData', [], { fmt: 'formatted', text: text }); }
  function isDefaultFormatted(items) { return items.length && isObj(items[0]) && items[0].fmt && items[0].fmt !== 'table'; }
  function cmdFormatTable(ctx) {
    var P = ctx.p, S = S_(ctx), items = flattenForRender(inputItems(ctx)), width = ctx.cols;
    if (!items.length) return 0;
    if (P.Property === undefined) {
      var first = items[0];
      if (isFileObj(first) || (isObj(first) && first.fmt && first.fmt !== 'table') || typeof first !== 'object') { ctx.emitOne(formattedObj(renderObjs(items, S, width))); return 0; }
      ctx.emitOne(formattedObj(genericTable(items, null, width, { noHeader: !!P.HideTableHeaders })));
      return 0;
    }
    var cols = specCols(P.Property, items, S);
    ctx.emitOne(formattedObj(genericTable(items, cols, width, { noHeader: !!P.HideTableHeaders })));
    return 0;
  }
  function fileListText(items, width, names) {
    var DEF = ['Name', 'Length', 'CreationTime', 'LastWriteTime', 'LastAccessTime', 'Mode', 'LinkType', 'Target', 'VersionInfo'];
    var out = '', i = 0;
    while (i < items.length) {
      var d = fileDir(items[i]), j = i;
      while (j < items.length && fileDir(items[j]) === d) j++;
      var grp = items.slice(i, j);
      var body = listText(grp, names || DEF, width);
      out += '\n\n    目錄: ' + d + '\n\n\n' + body.replace(/^\n\n/, '');
      i = j;
    }
    return out;
  }
  function cmdFormatList(ctx) {
    var P = ctx.p, S = S_(ctx), items = flattenForRender(inputItems(ctx)), width = ctx.cols;
    if (!items.length) return 0;
    var names = P.Property === undefined ? null : specCols(P.Property, items, S);
    if (items.every(isFileObj)) { ctx.emitOne(formattedObj(names ? listText(items, names, width) : fileListText(items, width, null))); return 0; }
    if (isHash(items[0])) { items = items.map(function (h) { return new PSObj(T_CUSTOM, h.keys.map(function (k) { return [k, h.get(k)]; })); }); }
    if (typeof items[0] !== 'object') { ctx.emitOne(formattedObj(items.map(function (x) { return strOf(x) + '\n'; }).join(''))); return 0; }
    ctx.emitOne(formattedObj(listText(items, names, width)));
    return 0;
  }
  function cmdFormatWide(ctx) {
    var P = ctx.p, S = S_(ctx), items = flattenForRender(inputItems(ctx)), width = ctx.cols;
    if (!items.length) return 0;
    var pn = P.Property === undefined ? null : strOf(P.Property);
    var cells = items.map(function (it) { return strOf(pn === null ? (isObj(it) && it.file ? it.file.st.name : (isObj(it) && it.find('Name') ? it.get('Name') : it)) : getMember(it, pn, S)); });
    var cw = Math.max.apply(null, cells.map(displayWidth)) + 2;
    var cols = P.Column ? Number(P.Column) : Math.max(1, Math.floor(width / cw));
    var lines = [];
    for (var i = 0; i < cells.length; i += cols) lines.push(rtrim(cells.slice(i, i + cols).map(function (c) { return padR(c, cw); }).join('')));
    ctx.emitOne(formattedObj('\n' + lines.join('\n') + '\n\n\n'));
    return 0;
  }
  function cmdOutString(ctx) {
    var P = ctx.p, items = inputItems(ctx), text = renderObjs(items, S_(ctx), P.Width ? Number(P.Width) : 120);
    if (P.Stream) { text.replace(/\r?\n$/, '').split('\n').forEach(function (l) { ctx.emitOne(l); }); return 0; }
    ctx.emitOne(text);
    return 0;
  }
  function cmdOutHost(ctx) {
    var text = renderObjs(inputItems(ctx), S_(ctx), ctx.cols);
    ctx.host(text);
    return 0;
  }
  function cmdOutNull() { return 0; }
  /* write rendered text to a typed path; reports the PowerShell error and returns false when it cannot */
  function writeToPath(ctx, typed, text, append, cmdlet) {
    var s = ctx.session, r = resolvePath(s, typed);
    if (r.err) { failPathNotFound(ctx, { kind: r.err, disp: r.disp, drive: r.drive }); return false; }
    if (s.vfs.isDir(r.abs)) { ctx.fail({ msg: "拒絕存取路徑 '" + r.disp + "'。", cat: 'PermissionDenied', target: r.disp, activity: cmdlet, reason: 'UnauthorizedAccessException', fq: 'FileOpenFailure,' + CORE + 'OutFileCommand' }); return false; }
    try { s.vfs.writeFile(r.abs, text, { by: 'terminal', append: append }); }
    catch (e) { mapVfs(ctx, e, r.disp, cmdlet, 'FileOpenFailure'); return false; }
    return true;
  }
  function cmdOutFile(ctx) {
    var P = ctx.p, s = S_(ctx), typed = hasOwn.call(P, 'LiteralPath') ? P.LiteralPath : P.FilePath;
    var text = renderObjs(inputItems(ctx), s, P.Width ? Number(P.Width) : 120);
    var r = resolvePath(s, typed);
    if (P.NoClobber && !r.err && s.vfs.exists(r.abs) && !P.Append) {
      return ctx.fail({ msg: "檔案 '" + r.disp + "' 已經存在。", cat: 'ResourceExists', target: r.disp, activity: 'Out-File', reason: 'IOException', fq: 'NoClobber,' + CORE + 'OutFileCommand' });
    }
    return writeToPath(ctx, typed, P.NoNewline ? text.replace(/\n$/, '') : text, !!P.Append, 'Out-File') ? 0 : 1;
  }
  function cmdTee(ctx) {
    var P = ctx.p, items = inputItems(ctx), s = S_(ctx);
    if (P.Variable) setVar(s, P.Variable, items.length === 1 ? items[0] : items);
    var typed = hasOwn.call(P, 'LiteralPath') ? P.LiteralPath : P.FilePath;
    if (typed !== undefined && typed !== null) { if (!writeToPath(ctx, typed, renderObjs(items, s, 120), !!P.Append, 'Tee-Object')) return 1; }
    ctx.emit(items);
    return 0;
  }

  /* ---- Select-String (grep) */
  function relPathText(s, disp) {
    var cwd = dispCwd(s);
    var pre = cwd.charAt(cwd.length - 1) === '\\' ? cwd : cwd + '\\';
    return fold(disp).indexOf(fold(pre)) === 0 ? disp.slice(pre.length) : disp;
  }
  function matchObj(pathDisp, lineNo, line, pat, ctxLines, matches, ci, s) {
    var rel = pathDisp === null ? null : relPathText(s, pathDisp);
    var o = new PSObj('Microsoft.PowerShell.Commands.MatchInfo', [['IgnoreCase', ci], ['LineNumber', lineNo], ['Line', line], ['Filename', pathDisp === null ? 'InputStream' : pathDisp.slice(pathDisp.lastIndexOf('\\') + 1)],
      ['Path', pathDisp === null ? 'InputStream' : pathDisp], ['Pattern', pat], ['Context', null], ['Matches', matches]], { fmt: 'match' });
    o.str = function () {
      var base = rel === null ? line : rel + ':' + lineNo + ':' + line;
      if (!ctxLines) return base;
      var out = [];
      ctxLines.before.forEach(function (c) { out.push('  ' + (rel === null ? c.text : rel + ':' + c.no + ':' + c.text)); });
      out.push('> ' + base);
      ctxLines.after.forEach(function (c) { out.push('  ' + (rel === null ? c.text : rel + ':' + c.no + ':' + c.text)); });
      return out.join('\n');
    };
    return o;
  }
  function cmdSls(ctx) {
    var P = ctx.p, s = S_(ctx), vfs = s.vfs, status = 0;
    var pats = P.Pattern.filter(function (x) { return x !== null; });
    var ci = !P.CaseSensitive;
    var res = pats.map(function (p) { return P.SimpleMatch ? new RegExp(reEsc(p), ci ? 'i' : '') : netRegex(p, !ci, P.AllMatches ? 'g' : ''); });
    var cx = P.Context ? { before: Number(P.Context[0]), after: Number(P.Context.length > 1 ? P.Context[1] : P.Context[0]) } : null;
    var out = [];
    function scan(lines, pathDisp) {
      var any = false;
      for (var i = 0; i < lines.length; i++) {
        var line = lines[i], ms = null;
        res.forEach(function (re) { re.lastIndex = 0; var m = re.exec(line); if (m && !ms) ms = m; });
        var hit = !!ms;
        if (P.NotMatch) hit = !hit;
        if (!hit) continue;
        any = true;
        var matches = ms && !P.NotMatch ? [mkObj([['Value', ms[0]], ['Index', ms.index], ['Length', ms[0].length]], 'System.Text.RegularExpressions.Match', { str: function () { return ms[0]; }, fmt: 'table' })] : [];
        var cl = null;
        if (cx) {
          cl = { before: [], after: [] };
          for (var b = Math.max(0, i - cx.before); b < i; b++) cl.before.push({ no: b + 1, text: lines[b] });
          for (var a = i + 1; a <= Math.min(lines.length - 1, i + cx.after); a++) cl.after.push({ no: a + 1, text: lines[a] });
        }
        out.push(matchObj(pathDisp, i + 1, line, pats[0], cl, matches, ci, s));
        if (P.List) break;
      }
      return any;
    }
    function splitLines(text) { var l = String(text).replace(/\r\n/g, '\n').split('\n'); if (l.length && l[l.length - 1] === '') l.pop(); return l; }
    var literal = hasOwn.call(P, 'LiteralPath');
    var paths = literal ? P.LiteralPath : P.Path;
    if (paths && paths.length) {
      paths.forEach(function (arg) {
        if (arg === null) return;
        var ex = expandPath(s, arg, literal);
        if (ex.miss) { status = 1; failPathNotFound(ctx, ex.miss); return; }
        ex.items.forEach(function (it) {
          if (it.st.type === 'dir') { status = 1; ctx.fail({ msg: "拒絕存取路徑 '" + it.disp + "'。", cat: 'PermissionDenied', target: it.disp, activity: 'Select-String', reason: 'UnauthorizedAccessException', fq: 'ProcessingFile,' + CORE + 'SelectStringCommand' }); return; }
          if (it.st.kind === 'binary' || it.st.kind === 'zip' || it.st.kind === 'app') return;
          scan(splitLines(vfs.readFile(it.st.path, { by: 'terminal' })), it.disp);
        });
      });
    } else if (ctx.hasInput || P.InputObject !== undefined) {
      var inp = inputItems(ctx);
      inp.forEach(function (o) {
        if (isObj(o) && o.file) { if (o.file.st.type !== 'dir') scan(splitLines(vfs.readFile(o.file.st.path, { by: 'terminal' })), o.file.disp); return; }
        String(strOf(o)).split(/\r?\n/).forEach(function (ln) { scan([ln], null); });
      });
      // line numbers of pipeline input restart at 1 for every object: PowerShell numbers them per object too
    } else {
      return ctx.fail({ msg: '無法處理命令，因為至少遺失了一個必要參數:  Path。', cat: 'InvalidArgument', target: '', activity: 'Select-String', reason: 'ParameterBindingException', fq: 'MissingMandatoryParameter,' + CORE + 'SelectStringCommand' });
    }
    if (P.Quiet) { ctx.emitOne(out.length > 0); return status; }
    ctx.emit(out);
    return status;
  }

  /* ---- CSV and JSON */
  function parseCsv(text, delim, header) {
    var rows = [], row = [], cell = '', inQ = false, i = 0, n = text.length, sawAny = false;
    delim = delim || ',';
    while (i < n) {
      var c = text.charAt(i);
      if (inQ) {
        if (c === '"') { if (text.charAt(i + 1) === '"') { cell += '"'; i += 2; continue; } inQ = false; i++; continue; }
        cell += c; i++; continue;
      }
      if (c === '"' && cell === '') { inQ = true; sawAny = true; i++; continue; }
      if (c === delim) { row.push(cell); cell = ''; sawAny = true; i++; continue; }
      if (c === '\r') { i++; continue; }
      if (c === '\n') { if (sawAny || cell !== '') { row.push(cell); rows.push(row); } row = []; cell = ''; sawAny = false; i++; continue; }
      cell += c; sawAny = true; i++;
    }
    if (sawAny || cell !== '') { row.push(cell); rows.push(row); }
    if (rows.length && /^#TYPE /i.test(rows[0][0] || '')) rows.shift();
    var head = header ? header.slice() : (rows.length ? rows.shift() : []);
    var objs = rows.map(function (r) { return new PSObj(T_CUSTOM, head.map(function (h, k) { return [h === '' ? 'H' + (k + 1) : h, k < r.length ? r[k] : null]; }), { custom: true }); });
    return objs;
  }
  function csvQuote(v) { return v === null || v === undefined ? '' : '"' + strOf(v).replace(/"/g, '""') + '"'; }
  function csvLines(items, delim, noType) {
    var lines = [];
    if (!items.length) return lines;
    var first = items[0];
    var names = isHash(first) ? first.keys.map(strOf) : propNames(first);
    if (isObj(first) && first.file) names = ['PSPath', 'PSParentPath', 'PSChildName', 'PSDrive', 'PSProvider', 'PSIsContainer', 'Mode', 'BaseName', 'Target', 'LinkType', 'Name', 'Length', 'DirectoryName', 'Directory', 'IsReadOnly', 'Exists', 'FullName', 'Extension', 'CreationTime', 'CreationTimeUtc', 'LastAccessTime', 'LastAccessTimeUtc', 'LastWriteTime', 'LastWriteTimeUtc', 'Attributes'];
    if (!noType) lines.push('#TYPE ' + (isObj(first) && first.file ? (first.file.st.type === 'dir' ? 'System.IO.DirectoryInfo' : 'System.IO.FileInfo') : (typeNameOf(first) || T_OBJ)));
    lines.push(names.map(function (nm) { return '"' + nm.replace(/"/g, '""') + '"'; }).join(delim));
    items.forEach(function (it) { lines.push(names.map(function (nm) { var v = getMember(it, nm, null); return csvQuote(Array.isArray(v) ? strOf(v) : v); }).join(delim)); });
    return lines;
  }
  function cmdImportCsv(ctx) {
    var P = ctx.p, s = S_(ctx), status = 0;
    var literal = hasOwn.call(P, 'LiteralPath');
    var delim = P.Delimiter ? String(P.Delimiter).charAt(0) : ',';
    pathArgs(ctx, literal ? P.LiteralPath : P.Path).forEach(function (arg) {
      if (arg === null) return;
      var ex = expandPath(s, arg, literal);
      if (ex.miss || !ex.items.length) {
        status = 1;
        ctx.fail({ msg: "找不到檔案 '" + (ex.resolved ? ex.resolved.disp : (ex.miss ? ex.miss.disp : arg)) + "'。", cat: 'OpenError', target: '', activity: 'Import-Csv', reason: 'FileNotFoundException', fq: 'FileOpenFailure,' + CORE + 'ImportCsvCommand' });
        return;
      }
      ex.items.forEach(function (it) {
        if (it.st.type === 'dir') { status = 1; ctx.fail({ msg: "拒絕存取路徑 '" + it.disp + "'。", cat: 'PermissionDenied', target: it.disp, activity: 'Import-Csv', reason: 'UnauthorizedAccessException', fq: 'FileOpenFailure,' + CORE + 'ImportCsvCommand' }); return; }
        var text = it.st.kind === 'binary' || it.st.kind === 'zip' || it.st.kind === 'app' ? '' : s.vfs.readFile(it.st.path, { by: 'terminal' });
        ctx.emit(parseCsv(text, delim, P.Header ? P.Header.map(strOf) : null));
      });
    });
    return status;
  }
  function cmdExportCsv(ctx) {
    var P = ctx.p, s = S_(ctx), items = inputItems(ctx);
    var typed = hasOwn.call(P, 'LiteralPath') ? P.LiteralPath : P.Path;
    if (typed === undefined || typed === null) {
      return ctx.fail({ msg: '無法處理命令，因為至少遺失了一個必要參數:  Path。', cat: 'InvalidArgument', target: '', activity: 'Export-Csv', reason: 'ParameterBindingException', fq: 'MissingMandatoryParameter,' + CORE + 'ExportCsvCommand' });
    }
    var delim = P.Delimiter ? String(P.Delimiter).charAt(0) : ',';
    var r = resolvePath(s, typed);
    if (P.NoClobber && !r.err && s.vfs.exists(r.abs) && !P.Append) return ctx.fail({ msg: "檔案 '" + r.disp + "' 已經存在。", cat: 'ResourceExists', target: r.disp, activity: 'Export-Csv', reason: 'IOException', fq: 'NoClobber,' + CORE + 'ExportCsvCommand' });
    var lines = csvLines(items, delim, !!P.NoTypeInformation || !!P.Append);
    if (P.Append && !r.err && s.vfs.exists(r.abs) && lines.length) lines.shift();       // the header is already in the file
    return writeToPath(ctx, typed, lines.length ? lines.join('\r\n') + '\r\n' : '', !!P.Append, 'Export-Csv') ? 0 : 1;
  }
  function cmdToCsv(ctx) {
    var P = ctx.p, items = inputItems(ctx);
    csvLines(items, P.Delimiter ? String(P.Delimiter).charAt(0) : ',', !!P.NoTypeInformation).forEach(function (l) { ctx.emitOne(l); });
    return 0;
  }
  function cmdFromCsv(ctx) {
    var P = ctx.p, items = inputItems(ctx);
    ctx.emit(parseCsv(items.map(strOf).join('\n'), P.Delimiter ? String(P.Delimiter).charAt(0) : ',', P.Header ? P.Header.map(strOf) : null));
    return 0;
  }
  function jsonStr(s) {
    return '"' + String(s).replace(/[\\"\u0000-\u001f<>&'\u2028\u2029]/g, function (c) {
      var map = { '"': '\\"', '\\': '\\\\', '\b': '\\b', '\f': '\\f', '\n': '\\n', '\r': '\\r', '\t': '\\t' };
      if (hasOwn.call(map, c)) return map[c];
      return '\\u' + ('0000' + c.charCodeAt(0).toString(16)).slice(-4);
    }) + '"';
  }
  /* PowerShell 5.1 ConvertTo-Json: four-space indent, two spaces after the colon, depth 2 by default */
  function toJson(v, depth, maxDepth, compress, indent) {
    var nl = compress ? '' : '\n', pad = function (n) { return compress ? '' : new Array(n * 4 + 1).join(' '); }, colon = compress ? ':' : ':  ';
    if (v === null || v === undefined) return 'null';
    if (typeof v === 'boolean') return v ? 'true' : 'false';
    if (typeof v === 'number') return numStr(v);
    if (typeof v === 'string') return jsonStr(v);
    if (isDate(v)) return '"\\/Date(' + (v.ms) + ')\\/"';
    if (depth > maxDepth) return jsonStr(strOf(v));
    if (Array.isArray(v)) {
      if (!v.length) return '[]';
      return '[' + nl + v.map(function (x) { return pad(indent + 1) + toJson(x, depth + 1, maxDepth, compress, indent + 1); }).join(',' + nl) + nl + pad(indent) + ']';
    }
    var pairs = null;
    if (isHash(v)) pairs = v.keys.map(function (k) { return [strOf(k), v.get(k)]; });
    else if (isObj(v)) pairs = v.file ? fileProps(v).map(function (p) { return [p[0], p[1]]; }) : v.p.map(function (e) { return [e.n, e.v]; });
    if (pairs) {
      if (!pairs.length) return '{}';
      return '{' + nl + pairs.map(function (kv) { return pad(indent + 1) + jsonStr(kv[0]) + colon + toJson(kv[1], depth + 1, maxDepth, compress, indent + 1); }).join(',' + nl) + nl + pad(indent) + '}';
    }
    return jsonStr(strOf(v));
  }
  function cmdToJson(ctx) {
    var P = ctx.p, items = inputItems(ctx);
    if (P.InputObject !== undefined && !ctx.hasInput && !Array.isArray(P.InputObject) ) items = [P.InputObject];
    var v = items.length === 1 && !(P.InputObject !== undefined && Array.isArray(P.InputObject)) ? items[0] : items;
    if (!items.length && (P.InputObject === undefined || P.InputObject === null)) { ctx.emitOne('null'); return 0; }
    ctx.emitOne(toJson(v, 0, P.Depth !== undefined ? Number(P.Depth) : 2, !!P.Compress, 0));
    return 0;
  }
  function fromJsonValue(j) {
    if (j === null || typeof j !== 'object') return j;
    if (Array.isArray(j)) return j.map(fromJsonValue);
    return new PSObj(T_CUSTOM, Object.keys(j).map(function (k) { return [k, fromJsonValue(j[k])]; }), { custom: true });
  }
  function cmdFromJson(ctx) {
    var P = ctx.p, text = inputItems(ctx).map(strOf).join('\n');
    if (!ctx.hasInput && P.InputObject !== undefined) text = unroll(P.InputObject).map(strOf).join('\n');
    var j;
    try { j = JSON.parse(text); }
    catch (e) { return ctx.fail({ msg: '無法剖析 JSON 內容 (' + String(e.message).replace(/\n/g, ' ') + ')。', cat: 'InvalidOperation', target: '', activity: 'ConvertFrom-Json', reason: 'ArgumentException', fq: 'System.ArgumentException,' + CORE + 'ConvertFromJsonCommand' }); }
    var v = fromJsonValue(j);
    ctx.emit(v);
    return 0;
  }

  /* ---- Get-Member (short) */
  var BASE_METHODS = [['Equals', 'Method', 'bool Equals(System.Object obj)'], ['GetHashCode', 'Method', 'int GetHashCode()'], ['GetType', 'Method', 'type GetType()'], ['ToString', 'Method', 'string ToString()']];
  function cmdGetMember(ctx) {
    var items = inputItems(ctx), P = ctx.p;
    var groups = [], seen = {};
    items.forEach(function (it) {
      var tn = typeNameOf(it) || T_OBJ;
      if (seen[tn]) return;
      seen[tn] = 1;
      var rows = BASE_METHODS.map(function (m) { return [m[0], m[1], m[2]]; });
      if (isObj(it) && !it.file && it.type === T_CUSTOM) tn = T_CUSTOM;
      if (typeof it === 'string') { rows.push(['Contains', 'Method', 'bool Contains(string value)'], ['Replace', 'Method', 'string Replace(char oldChar, char newChar)'], ['Split', 'Method', 'string[] Split(Params char[] separator)'], ['Substring', 'Method', 'string Substring(int startIndex)'],
        ['ToLower', 'Method', 'string ToLower()'], ['ToUpper', 'Method', 'string ToUpper()'], ['Trim', 'Method', 'string Trim()'], ['Length', 'Property', 'int Length {get;}']); }
      else if (isObj(it)) {
        propNames(it).forEach(function (nm) {
          var v = getMember(it, nm, null);
          var t = v === null || v === undefined ? 'object' : (typeof v === 'string' ? 'string' : (typeof v === 'number' ? (Math.floor(v) === v ? 'int' : 'double') : (typeof v === 'boolean' ? 'bool' : (isDate(v) ? 'datetime' : (Array.isArray(v) ? 'Object[]' : 'System.Object')))));
          rows.push([nm, it.file ? 'Property' : 'NoteProperty', it.file ? t + ' ' + nm + ' {get;set;}' : t + ' ' + nm + '=' + (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' ? strOf(v) : strOf(v))]);
        });
      } else if (typeof it === 'number') { rows.push(['CompareTo', 'Method', 'int CompareTo(System.Object value)'], ['ToString', 'Method', 'string ToString()']); }
      rows.sort(function (a, b) { return a[1] === b[1] || (a[1] !== 'NoteProperty' && b[1] !== 'NoteProperty') ? strCmp(a[0], b[0]) : (a[1] === 'NoteProperty' ? 1 : -1); });
      if (P.Name && P.Name.length) rows = rows.filter(function (r) { return P.Name.some(function (n) { return wildRegex(n).test(r[0]); }); });
      if (P.MemberType) {
        var want = String(P.MemberType).toLowerCase().split(/\s*,\s*/);
        rows = rows.filter(function (r) {
          var t = r[1].toLowerCase();
          return want.some(function (w) { return w === 'all' || w === t || (w === 'properties' && /property$/.test(t)) || (w === 'methods' && t === 'method'); });
        });
      }
      rows.forEach(function (r) { groups.push(new PSObj('Microsoft.PowerShell.Commands.MemberDefinition', [['TypeName', tn], ['Name', r[0]], ['MemberType', r[1]], ['Definition', r[2]]], { fmt: 'member' })); });
    });
    if (!items.length) return ctx.fail({ msg: '您必須指定一個物件給 Get-Member Cmdlet。', cat: 'CloseError', target: '', activity: 'Get-Member', reason: 'InvalidOperationException', fq: 'NoObjectInGetMember,' + CORE + 'GetMemberCommand' });
    ctx.emit(groups);
    return 0;
  }
  function cmdGetUnique(ctx) { var items = inputItems(ctx), out = []; items.forEach(function (it) { if (!out.length || strOf(out[out.length - 1]) !== strOf(it)) out.push(it); }); ctx.emit(out); return 0; }
  function cmdGetRandom(ctx) {
    var P = ctx.p, items = inputItems(ctx);
    if (items.length || (P.InputObject !== undefined && Array.isArray(P.InputObject))) {
      var pool = items.length ? items : unroll(P.InputObject), n = P.Count !== undefined ? Number(P.Count) : 1, out = [], copy = pool.slice();
      for (var i = 0; i < n && copy.length; i++) out.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]);
      ctx.emit(out); return 0;
    }
    var hi = P.Maximum !== undefined ? toNum(P.Maximum) : 2147483647, lo = P.Minimum !== undefined ? toNum(P.Minimum) : 0;
    if (P.Maximum !== undefined && Array.isArray(P.Maximum)) { ctx.emitOne(P.Maximum[Math.floor(Math.random() * P.Maximum.length)]); return 0; }
    var count = P.Count !== undefined ? Number(P.Count) : 1;
    for (var k = 0; k < count; k++) ctx.emitOne(lo + Math.floor(Math.random() * (hi - lo)));
    return 0;
  }
  function cmdWriteWarn(ctx) { ctx.warn('警告: ' + ctx.p.Message + '\n'); return 0; }
  function cmdWriteErr(ctx) {
    var P = ctx.p;
    ctx.err(errorText({ head: ctx.src.slice(ctx.cmd.start, ctx.cmd.end), msg: P.Message, cat: P.Category || 'NotSpecified', target: P.TargetObject === undefined ? '' : strOf(P.TargetObject), activity: 'Write-Error', reason: 'WriteErrorException', fq: (P.ErrorId ? P.ErrorId + ',' : '') + CORE + 'WriteErrorException',
      src: ctx.src, start: ctx.cmd.start, len: Math.max(1, ctx.cmd.end - ctx.cmd.start) }, ctx.cols));
    return 1;
  }
  function* cmdReadHost(ctx) {
    var P = ctx.p;
    var prompt = P.Prompt === undefined || P.Prompt === null ? '' : strOf(unroll(P.Prompt)[0]) + ': ';
    var ans = yield { prompt: { text: prompt, kind: 'readhost' } };
    ctx.emitOne(ans === undefined ? '' : ans);
    return 0;
  }
  function cmdSetAlias(ctx) {
    var P = ctx.p, s = S_(ctx), tgt = String(P.Value).toLowerCase();
    if (!hasOwn.call(CMDS, tgt) && !hasOwn.call(s.aliases, tgt)) {
      // an alias to a name PowerShell cannot find still gets created; it fails when it is used
    }
    s.aliases[String(P.Name).toLowerCase()] = String(P.Value);
    if (P.PassThru) ctx.emitOne(aliasObj(P.Name, P.Value));
    return 0;
  }
  function cmdClip(ctx) {
    var P = ctx.p, items = ctx.hasInput ? ctx.input : unroll(P.Value === undefined ? [] : P.Value);
    var text = renderObjs(items, S_(ctx), 120).replace(/\n+$/, '');
    try { LAB.clipboard.setText(text); } catch (e) { /* the clipboard is the page's own */ }
    return 0;
  }
  function cmdGetClip(ctx) {
    var t = '';
    try { t = LAB.clipboard.text || ''; } catch (e) { t = ''; }
    if (t) { if (ctx.p.Raw) ctx.emitOne(t); else t.replace(/\r?\n$/, '').split(/\r?\n/).forEach(function (l) { ctx.emitOne(l); }); }
    return 0;
  }

  defCmd({ id: 'sort', canon: 'pipe', spec: SPEC.sort, run: cmdSort, nopaths: true }, ['Sort-Object', 'sort']);
  defCmd({ id: 'where', canon: 'pipe', spec: SPEC.where, run: cmdWhere, nopaths: true }, ['Where-Object', 'where', '?']);
  defCmd({ id: 'select', canon: 'pipe', spec: SPEC.select, run: cmdSelect, nopaths: true }, ['Select-Object', 'select']);
  defCmd({ id: 'measure', canon: 'pipe', spec: SPEC.measure, run: cmdMeasure, nopaths: true }, ['Measure-Object', 'measure']);
  defCmd({ id: 'group', canon: 'pipe', spec: SPEC.group, run: cmdGroup, nopaths: true }, ['Group-Object', 'group']);
  defCmd({ id: 'foreach', canon: 'pipe', spec: SPEC.foreach, run: cmdForEach, nopaths: true }, ['ForEach-Object', 'foreach', '%']);
  defCmd({ id: 'ft', canon: 'pipe', spec: SPEC.ft, run: cmdFormatTable, nopaths: true }, ['Format-Table', 'ft']);
  defCmd({ id: 'fl', canon: 'pipe', spec: SPEC.fl, run: cmdFormatList, nopaths: true }, ['Format-List', 'fl']);
  defCmd({ id: 'fw', canon: 'pipe', spec: SPEC.fw, run: cmdFormatWide, nopaths: true }, ['Format-Wide', 'fw']);
  defCmd({ id: 'outfile', canon: 'file', spec: SPEC.outfile, run: cmdOutFile }, ['Out-File']);
  defCmd({ id: 'outstring', canon: 'pipe', spec: SPEC.outstring, run: cmdOutString, nopaths: true }, ['Out-String']);
  defCmd({ id: 'outhost', canon: 'pipe', spec: SPEC.outhost, run: cmdOutHost, nopaths: true }, ['Out-Host', 'oh']);
  defCmd({ id: 'outnull', canon: 'pipe', spec: SPEC.outnull, run: cmdOutNull, nopaths: true }, ['Out-Null']);
  defCmd({ id: 'sls', canon: 'pipe', spec: SPEC.sls, run: cmdSls, nopaths: true }, ['Select-String', 'sls']);
  defCmd({ id: 'ipcsv', canon: 'csv', spec: SPEC.ipcsv, run: cmdImportCsv }, ['Import-Csv', 'ipcsv']);
  defCmd({ id: 'epcsv', canon: 'csv', spec: SPEC.epcsv, run: cmdExportCsv }, ['Export-Csv', 'epcsv']);
  defCmd({ id: 'tocsv', canon: 'csv', spec: SPEC.tocsv, run: cmdToCsv, nopaths: true }, ['ConvertTo-Csv']);
  defCmd({ id: 'fromcsv', canon: 'csv', spec: SPEC.fromcsv, run: cmdFromCsv, nopaths: true }, ['ConvertFrom-Csv']);
  defCmd({ id: 'tojson', canon: 'csv', spec: SPEC.tojson, run: cmdToJson, nopaths: true }, ['ConvertTo-Json']);
  defCmd({ id: 'fromjson', canon: 'csv', spec: SPEC.fromjson, run: cmdFromJson, nopaths: true }, ['ConvertFrom-Json']);
  defCmd({ id: 'tee', canon: 'pipe', spec: SPEC.tee, run: cmdTee }, ['Tee-Object', 'tee']);
  defCmd({ id: 'gm', canon: 'pipe', spec: SPEC.gm, run: cmdGetMember, nopaths: true }, ['Get-Member', 'gm']);
  defCmd({ id: 'unique', canon: 'pipe', spec: SPEC.unique, run: cmdGetUnique, nopaths: true }, ['Get-Unique', 'gu']);
  defCmd({ id: 'random', canon: 'pipe', spec: SPEC.random, run: cmdGetRandom, nopaths: true }, ['Get-Random']);
  defCmd({ id: 'writewarn', canon: 'echo', spec: SPEC.writewarn, run: cmdWriteWarn, nopaths: true }, ['Write-Warning']);
  defCmd({ id: 'writeerr', canon: 'echo', spec: SPEC.writeerr, run: cmdWriteErr, nopaths: true }, ['Write-Error']);
  defCmd({ id: 'readhost', canon: 'echo', spec: SPEC.readhost, run: cmdReadHost, nopaths: true }, ['Read-Host']);
  defCmd({ id: 'setalias', canon: 'var', spec: SPEC.setalias, run: cmdSetAlias, nopaths: true }, ['Set-Alias', 'sal', 'New-Alias', 'nal']);
  defCmd({ id: 'clip', canon: 'pipe', spec: SPEC.clip, run: cmdClip, nopaths: true }, ['Set-Clipboard', 'scb', 'clip']);
  defCmd({ id: 'getclip', canon: 'pipe', spec: SPEC.getclip, run: cmdGetClip, nopaths: true }, ['Get-Clipboard', 'gcb']);
  defCmd({ id: 'nothing', canon: 'echo', noargs: true, name: 'Write-Verbose', run: function () { return 0; }, nopaths: true }, ['Write-Verbose', 'Write-Debug', 'Write-Information']);

  /* ====================================================================================================================
     Round 5 — file cmdlets: Remove-Item with the real confirmation prompt, Resolve-Path, Split-Path, Join-Path, Get-FileHash,
     Compress-Archive, tree, cmd /c dir, where.exe
     ==================================================================================================================== */
  /* ---- Remove-Item: the real PowerShell question (texts read from the zh-TW resources of Windows PowerShell 5.1) */
  var CONFIRM_LINE = '[Y] 是(Y)  [A] 全部皆是(A)  [N] 否(N)  [L] 全部皆否(L)  [S] 暫停(S)  [?] 說明 (預設值為 "Y"): ';
  var CONFIRM_HELP = ['Y - 僅繼續進行此作業的下一步。', 'A - 繼續進行此作業的所有步驟。', 'N - 略過這項作業並繼續進行下一項作業。', 'L - 略過這項作業及所有後續作業。', 'S - 暫停目前的管線並且返回命令提示字元。輸入 "exit" 可恢復執行管線。'];
  /* asks the question; returns 'y' or 'n'. state.all remembers an [A] or [L] answer for the next items of the same command */
  function* askConfirm(ctx, message, state) {
    if (state.all === 'a') return 'y';
    if (state.all === 'l') return 'n';
    ctx.host('\n確認\n' + message + '\n');
    for (;;) {
      var ans = yield { prompt: { text: CONFIRM_LINE, kind: 'confirm' } };
      if (ans === undefined) { ctx.record(CONFIRM_LINE + '\n'); return 'n'; }          // nobody can answer (a nested block): skip, do not delete
      ctx.record(CONFIRM_LINE + ans + '\n');
      var a = String(ans).trim().toLowerCase();
      if (a === '' || a === 'y' || a === 'yes' || a === '是') return 'y';
      if (a === 'a' || a === '全部皆是') { state.all = 'a'; return 'y'; }
      if (a === 'n' || a === 'no' || a === '否') return 'n';
      if (a === 'l' || a === '全部皆否') { state.all = 'l'; return 'n'; }
      if (a === 's' || a === '暫停') { ctx.host('（練習版沒有「暫停」，請選 Y、A、N 或 L。）\n'); continue; }
      if (a === '?') { ctx.host(CONFIRM_HELP.join('\n') + '\n'); continue; }
      // anything else: PowerShell asks again
    }
  }
  function whatIfLines(ctx, vfs, abs, disp, recurse) {
    var st = vfs.stat(abs);
    if (st.type === 'dir' && recurse) vfs.list(abs).filter(function (k) { return !isTrash(k); }).forEach(function (k) { whatIfLines(ctx, vfs, k.path, joinDisp(disp, k.name), true); });
    ctx.host('WhatIf: 正在目標 "' + disp + '" 上執行 "' + (st.type === 'dir' ? '移除目錄' : '移除檔案') + '" 操作。\n');
  }
  function* cmdRm(ctx) {
    var s = ctx.session, vfs = s.vfs, P = ctx.p, status = 0, state = { all: null };
    var literal = hasOwn.call(P, 'LiteralPath');
    var srcs = pathArgs(ctx, literal ? P.LiteralPath : P.Path);
    var filter = P.Filter ? wildRegex(String(P.Filter)) : null;
    var inc = P.Include ? P.Include.filter(Boolean).map(wildRegex) : null, exc = P.Exclude ? P.Exclude.filter(Boolean).map(wildRegex) : null;
    for (var ai = 0; ai < srcs.length; ai++) {
      var arg = srcs[ai];
      if (arg === null) continue;
      var ex = expandPath(s, arg, literal);
      if (ex.miss || (ex.wild && !ex.items.length)) { status = 1; failPathNotFound(ctx, ex.miss || { kind: 'path', disp: ex.disp || arg }); continue; }
      for (var ii = 0; ii < ex.items.length; ii++) {
        var it = ex.items[ii], st = it.st;
        if (filter && !filter.test(st.name)) continue;
        if (inc && !inc.some(function (re) { return re.test(st.name); })) continue;
        if (exc && exc.some(function (re) { return re.test(st.name); })) continue;
        if (st.type === 'dir' && underPath(s.cwd, st.path)) {
          status = 1;
          ctx.fail({ msg: "無法移除 '" + it.disp + "' 的項目，因為它正在使用中。", cat: 'InvalidOperation', target: '', activity: 'Remove-Item', reason: 'PSInvalidOperationException', fq: 'InvalidOperation,' + ctx.spec.cls });
          continue;
        }
        if (P.WhatIf) { whatIfLines(ctx, vfs, st.path, it.disp, !!P.Recurse || st.type !== 'dir' || !st.count); continue; }
        var isDir = st.type === 'dir', hasKids = isDir && st.count > 0;
        if (P.Confirm) {
          var a1 = yield* askConfirm(ctx, '確定要執行此動作?\n正在目標 "' + it.disp + '" 上執行 "' + (isDir ? '移除目錄' : '移除檔案') + '" 操作。', state);
          if (a1 === 'n') continue;
        }
        if (hasKids && !P.Recurse) {
          var a2 = yield* askConfirm(ctx, '位於 ' + it.disp + ' 的項目有子系，而且沒有指定 Recurse 參數。如果繼續進行，所有子系將會與讓項目一起移除。確定要繼續嗎?', state);
          if (a2 === 'n') continue;
        }
        try { vfs.remove(st.path, { by: 'terminal', recursive: true }); }
        catch (e) { status = mapVfs(ctx, e, it.disp, 'Remove-Item', 'RemoveItemUnauthorizedAccessError'); }
      }
    }
    return status;
  }

  /* ---- Resolve-Path / Split-Path / Join-Path / Test-Path -PathType */
  SPEC.resolve = { name: 'Resolve-Path', cls: CORE + 'ResolvePathCommand', params: [val('Path', { pos: 0, arr: true, type: T_ARR, mand: true, pipe: true }), val('LiteralPath', { arr: true, type: T_ARR, al: ['PSPath'] }),
    sw('Relative'), val('Credential', { type: 'System.Management.Automation.PSCredential' }), sw('UseTransaction', ['usetx'])] };
  SPEC.split = { name: 'Split-Path', cls: CORE + 'SplitPathCommand', params: [val('Path', { pos: 0, arr: true, type: T_ARR, mand: true, pipe: true }), val('LiteralPath', { arr: true, type: T_ARR, al: ['PSPath'] }), sw('Qualifier'), sw('NoQualifier'),
    sw('Parent'), sw('Leaf'), sw('Resolve'), sw('IsAbsolute'), val('Credential', { type: 'System.Management.Automation.PSCredential' })] };
  SPEC.join = { name: 'Join-Path', cls: CORE + 'JoinPathCommand', params: [val('Path', { pos: 0, arr: true, type: T_ARR, mand: true, pipe: true }), val('ChildPath', { pos: 1, mand: true, type: T_STR }), val('AdditionalChildPath', { pos: 2, arr: true, type: T_ARR, rest: true }),
    sw('Resolve'), val('Credential', { type: 'System.Management.Automation.PSCredential' })] };
  function cmdResolve(ctx) {
    var s = ctx.session, P = ctx.p, status = 0, literal = hasOwn.call(P, 'LiteralPath');
    pathArgs(ctx, literal ? P.LiteralPath : P.Path).forEach(function (arg) {
      if (arg === null) return;
      var ex = expandPath(s, arg, literal);
      if (ex.miss || (ex.wild && !ex.items.length)) { status = 1; failPathNotFound(ctx, ex.miss || { kind: 'path', disp: ex.disp || arg }); return; }
      ex.items.forEach(function (it) {
        var shown = P.Relative ? '.\\' + relPathText(s, it.disp) : it.disp;
        ctx.emitOne(new PSObj('System.Management.Automation.PathInfo', [['Drive', 'C'], ['Provider', 'Microsoft.PowerShell.Core\\FileSystem'], ['ProviderPath', it.disp], ['Path', shown]], { str: function () { return shown; }, fmt: 'path1' }));
      });
    });
    return status;
  }
  function cmdSplit(ctx) {
    var P = ctx.p, literal = hasOwn.call(P, 'LiteralPath');
    pathArgs(ctx, literal ? P.LiteralPath : P.Path).forEach(function (arg) {
      if (arg === null) return;
      var norm = String(arg), q = /^[A-Za-z]:/.exec(norm);
      var qual = q ? q[0] : '', rest = q ? norm.slice(2) : norm;
      var trimmed = rest.length > 1 ? rest.replace(/[\\\/]+$/, '') : rest;
      var i = Math.max(trimmed.lastIndexOf('\\'), trimmed.lastIndexOf('/'));
      var parent = i < 0 ? '' : (i === 0 ? trimmed.charAt(0) : trimmed.slice(0, i));
      var leaf = i < 0 ? trimmed : trimmed.slice(i + 1);
      if (P.IsAbsolute) { ctx.emitOne(/^[A-Za-z]:[\\\/]/.test(norm) || /^\\\\/.test(norm)); return; }
      if (P.Qualifier) { if (qual) ctx.emitOne(qual); return; }
      if (P.NoQualifier) { ctx.emitOne(rest); return; }
      if (P.Leaf) { ctx.emitOne(leaf); return; }
      var par = qual + parent;
      if (qual && parent === '') par = qual + (rest.charAt(0) === '\\' || rest.charAt(0) === '/' ? '\\' : '');
      ctx.emitOne(par);
    });
    return 0;
  }
  function cmdJoin(ctx) {
    var P = ctx.p, kids = [P.ChildPath].concat(P.AdditionalChildPath || []);
    pathArgs(ctx, P.Path).forEach(function (base) {
      var cur = base === null ? '' : String(base);
      kids.forEach(function (k) {
        if (k === null) return;
        var c = String(k).replace(/^[\\\/]+/, '');
        cur = cur === '' ? c : (/[\\\/]$/.test(cur) ? cur + c : cur + '\\' + c);
      });
      if (P.Resolve) { var r = resolvePath(ctx.session, cur); if (r.err || !ctx.session.vfs.exists(r.abs)) { failPathNotFound(ctx, { kind: 'path', disp: r.disp || cur }); return; } }
      ctx.emitOne(cur);
    });
    return 0;
  }

  /* ---- Get-FileHash: SHA-256 is real, the other algorithms are deterministic fakes of the right length */
  SPEC.hash = { name: 'Get-FileHash', cls: 'Get-FileHash', params: [val('Path', { pos: 0, arr: true, type: T_ARR, mand: true, pipe: true }), val('LiteralPath', { arr: true, type: T_ARR, al: ['PSPath'] }),
    val('InputStream', { type: 'System.IO.Stream' }), val('Algorithm', { pos: 1, type: T_STR })] };
  function utf8Bytes(str) {
    var out = [];
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
      else if (c >= 0xd800 && c <= 0xdbff && i + 1 < str.length) { var cp = 0x10000 + ((c & 0x3ff) << 10) + (str.charCodeAt(++i) & 0x3ff); out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63)); }
      else out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
    return out;
  }
  var SHA_K = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
  function sha256Hex(bytes) {
    var h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    var msg = bytes.slice(), bitLen = bytes.length * 8;
    msg.push(0x80);
    while (msg.length % 64 !== 56) msg.push(0);
    var hiLen = Math.floor(bitLen / 4294967296), loLen = bitLen >>> 0;
    msg.push((hiLen >>> 24) & 255, (hiLen >>> 16) & 255, (hiLen >>> 8) & 255, hiLen & 255, (loLen >>> 24) & 255, (loLen >>> 16) & 255, (loLen >>> 8) & 255, loLen & 255);
    function rotr(x, n) { return (x >>> n) | (x << (32 - n)); }
    for (var off = 0; off < msg.length; off += 64) {
      var w = new Array(64), i;
      for (i = 0; i < 16; i++) w[i] = ((msg[off + 4 * i] << 24) | (msg[off + 4 * i + 1] << 16) | (msg[off + 4 * i + 2] << 8) | msg[off + 4 * i + 3]) >>> 0;
      for (i = 16; i < 64; i++) {
        var s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3), s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
      }
      var a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], hh = h[7];
      for (i = 0; i < 64; i++) {
        var S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25), ch = (e & f) ^ (~e & g), t1 = (hh + S1 + ch + SHA_K[i] + w[i]) >>> 0;
        var S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22), mj = (a & b) ^ (a & c) ^ (b & c), t2 = (S0 + mj) >>> 0;
        hh = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
      }
      h[0] = (h[0] + a) >>> 0; h[1] = (h[1] + b) >>> 0; h[2] = (h[2] + c) >>> 0; h[3] = (h[3] + d) >>> 0; h[4] = (h[4] + e) >>> 0; h[5] = (h[5] + f) >>> 0; h[6] = (h[6] + g) >>> 0; h[7] = (h[7] + hh) >>> 0;
    }
    return h.map(function (x) { return ('00000000' + x.toString(16)).slice(-8); }).join('').toUpperCase();
  }
  function hashFor(alg, bytes) {
    var a = String(alg).toUpperCase();
    if (a === 'SHA256') return sha256Hex(bytes);
    var len = { MD5: 32, SHA1: 40, SHA384: 96, SHA512: 128, RIPEMD160: 40, MACTRIPLEDES: 16 }[a];
    var out = '', k = 1;
    while (out.length < len) { out += sha256Hex(bytes.concat([k++])); }
    return out.slice(0, len);
  }
  function cmdHash(ctx) {
    var s = ctx.session, P = ctx.p, status = 0, literal = hasOwn.call(P, 'LiteralPath');
    var alg = P.Algorithm === undefined || P.Algorithm === null ? 'SHA256' : String(P.Algorithm);
    var ok = { SHA1: 'SHA1', SHA256: 'SHA256', SHA384: 'SHA384', SHA512: 'SHA512', MACTRIPLEDES: 'MACTripleDES', MD5: 'MD5', RIPEMD160: 'RIPEMD160' }[alg.toUpperCase()];
    if (!ok) {
      return ctx.fail({ msg: "無法驗證 Algorithm 參數的引數。引數 \"" + alg + "\" 不屬於 \"SHA1, SHA256, SHA384, SHA512, MACTripleDES, MD5, RIPEMD160\" 組。請提供屬於該組的引數，然後再試一次此命令。", cat: 'InvalidData', target: alg, ttype: 'String', activity: 'Get-FileHash', reason: 'ParameterBindingValidationException', fq: 'ParameterArgumentValidationError,Get-FileHash' });
    }
    pathArgs(ctx, literal ? P.LiteralPath : P.Path).forEach(function (arg) {
      if (arg === null) return;
      var ex = expandPath(s, arg, literal);
      if (ex.miss || (ex.wild && !ex.items.length)) { status = 1; failPathNotFound(ctx, ex.miss || { kind: 'path', disp: ex.disp || arg }); return; }
      ex.items.forEach(function (it) {
        if (it.st.type === 'dir') { status = 1; ctx.fail({ msg: "拒絕存取路徑 '" + it.disp + "'。", cat: 'PermissionDenied', target: it.disp, activity: 'Get-FileHash', reason: 'UnauthorizedAccessException', fq: 'FileReadError,Get-FileHash' }); return; }
        var bytes = it.st.kind === 'binary' || it.st.kind === 'zip' || it.st.kind === 'app' ? utf8Bytes(it.st.name + ':' + it.st.size) : utf8Bytes(s.vfs.readFile(it.st.path, { by: 'terminal' }));
        ctx.emitOne(new PSObj('Microsoft.Powershell.Utility.FileHash', [['Algorithm', ok], ['Hash', hashFor(ok, bytes)], ['Path', it.disp]], { fmt: 'filehash' }));
      });
    });
    return status;
  }
  SPECIAL_VIEWS.filehash = function (group, S, width) {
    var room = Math.max(10, (width || 120) - 88);
    var lines = ['Algorithm       Hash                                                                   Path', '---------       ----                                                                   ----'];
    group.forEach(function (o) {
      var p = strOf(o.get('Path'));
      if (displayWidth(p) > room) p = p.slice(0, Math.max(0, room - 3)) + '...';
      lines.push(rtrim(padR(strOf(o.get('Algorithm')), 15) + ' ' + padR(strOf(o.get('Hash')), 71) + ' ' + p));
    });
    return '\n' + lines.join('\n') + '\n\n\n';
  };

  /* ---- Compress-Archive */
  SPEC.compress = { name: 'Compress-Archive', cls: 'Compress-Archive', params: [val('Path', { pos: 0, arr: true, type: T_ARR, mand: true, pipe: true }), val('LiteralPath', { arr: true, type: T_ARR, al: ['PSPath'] }),
    val('DestinationPath', { pos: 1, mand: true, type: T_STR }), val('CompressionLevel', { type: T_STR }), sw('Update'), sw('Force')] };
  function cmdCompress(ctx) {
    var s = ctx.session, vfs = s.vfs, P = ctx.p, literal = hasOwn.call(P, 'LiteralPath');
    var srcs = [], status = 0;
    var args = pathArgs(ctx, literal ? P.LiteralPath : P.Path);
    for (var i = 0; i < args.length; i++) {
      var arg = args[i];
      if (arg === null) continue;
      var ex = expandPath(s, arg, literal);
      if (ex.miss || !ex.items.length) {
        return ctx.fail({ msg: "路徑 '" + arg + "' 不存在或不是有效的檔案系統路徑。", cat: 'InvalidArgument', target: arg, activity: 'Compress-Archive', reason: 'InvalidOperationException', fq: 'ArchiveCmdletPathNotFound,Compress-Archive' });
      }
      ex.items.forEach(function (it) { srcs.push(it.abs); });
    }
    var destTyped = String(P.DestinationPath);
    if (!/\.zip$/i.test(destTyped)) destTyped += '.zip';
    var dr = resolvePath(s, destTyped);
    if (dr.err) return failPathNotFound(ctx, { kind: dr.err, disp: dr.disp, drive: dr.drive });
    var exists = vfs.exists(dr.abs);
    if (exists && !P.Update && !P.Force) {
      return ctx.fail({ msg: '保存檔案 ' + dr.disp + ' 已存在。請使用 -Update 參數來更新現有的保存檔案，或使用 -Force 參數來覆寫現有的保存檔案。', cat: 'InvalidArgument', target: dr.disp, activity: 'Compress-Archive', reason: 'IOException', fq: 'ArchiveFileExists,Compress-Archive' });
    }
    if (!vfs.isDir(vfs.dirname(dr.abs))) return failPathNotFound(ctx, { kind: 'path', disp: parentDisp(dr.disp) });
    if (!vfs.zipCreate) return ctx.fail({ msg: '練習版還沒有壓縮功能。', cat: 'NotImplemented', target: '', activity: 'Compress-Archive', reason: 'NotImplementedException', fq: 'NotImplemented,Compress-Archive' });
    var r = vfs.zipCreate(srcs, dr.abs, { by: 'terminal', overwrite: true, merge: !!P.Update && exists });
    if (!r.ok) {
      status = 1;
      ctx.fail({ msg: r.error === 'ENOSPC' ? '磁碟空間不足。' : "拒絕存取路徑 '" + dr.disp + "'。", cat: 'WriteError', target: dr.disp, activity: 'Compress-Archive', reason: 'IOException', fq: 'ArchiveCmdletWriteError,Compress-Archive' });
    }
    return status;
  }

  /* ---- tree (cmd's tree.com, zh-TW; box characters as the real one prints them in code page 950) */
  var VOL_SERIAL = '9E4C-7A21';
  function cmdTree(ctx) {
    var s = ctx.session, vfs = s.vfs, args = ctx.rawArgs.map(String), showFiles = false, ascii = false, target = null;
    args.forEach(function (a) {
      if (/^\/f$/i.test(a)) showFiles = true;
      else if (/^\/a$/i.test(a)) ascii = true;
      else if (/^[\/-]\?$/.test(a)) target = '?';
      else target = a;
    });
    if (target === '?') {
      ctx.out('以圖形顯示磁碟機或路徑的資料夾結構。\n\nTREE [磁碟機:][路徑] [/F] [/A]\n\n   /F   顯示每個資料夾中的檔案名稱。\n   /A   使用 ASCII 字元，而不使用擴充字元。\n');
      return 0;
    }
    var r = target === null ? { abs: s.cwd, disp: null } : resolvePath(s, target);
    ctx.out('列出資料夾 PATH\n磁碟區序號為 ' + VOL_SERIAL + '\n');
    if (r.err || !vfs.isDir(r.abs)) {
      var shownName = target === null ? '' : (r.disp || target).toUpperCase();
      ctx.out(shownName + '\n無效的路徑 - ' + shownName.replace(/^[A-Za-z]:/, '') + '\n子資料夾不存在 \n\n');
      return 1;
    }
    var rootLine = target === null ? 'C:.' : r.disp.toUpperCase();
    ctx.out(rootLine + '\n');
    var T = ascii ? { mid: '+---', last: '\\---', bar: '|   ', gap: '    ' } : { mid: '├─', last: '└─', bar: '│  ', gap: '    ' };
    var lines = [], anyDir = false;
    function walk(abs, prefix) {
      var kids = vfs.list(abs).filter(function (k) { return !isTrash(k); });
      var dirs = kids.filter(function (k) { return k.type === 'dir'; }).sort(function (a, b) { return ntfsCmp(a.name, b.name); });
      var files = kids.filter(function (k) { return k.type !== 'dir'; }).sort(function (a, b) { return ntfsCmp(a.name, b.name); });
      if (showFiles && files.length) {
        var ind = prefix + (dirs.length ? T.bar : T.gap);
        files.forEach(function (f) { lines.push(ind + f.name); });
        lines.push(ind);
      }
      dirs.forEach(function (d, i) {
        var last = i === dirs.length - 1;
        anyDir = true;
        lines.push(prefix + (last ? T.last : T.mid) + d.name);
        walk(d.path, prefix + (last ? T.gap : T.bar));
      });
    }
    walk(r.abs, '');
    if (!anyDir && !showFiles) { ctx.out('子資料夾不存在 \n\n'); return 0; }
    if (!anyDir && showFiles) { lines.push('子資料夾不存在 ', ''); }
    ctx.out(lines.join('\n') + (lines.length ? '\n' : ''));
    return 0;
  }

  /* ---- cmd /c dir and friends */
  function dirDate(ms) { var d = new Date(ms), p = dateParts(ms); return d.getFullYear() + '/' + two(d.getMonth() + 1) + '/' + two(d.getDate()) + '  ' + p[1]; }
  function groupDigits(n) { return commas(String(n)); }
  var DISK_FREE = 323191947264;           // 301 GB free of 475 GB (SPEC section 1)
  function cmdDir(ctx, argv) {
    var s = ctx.session, vfs = s.vfs, bare = false, onlyDirs = false, target = null, recurse = false;
    argv.forEach(function (a) {
      if (/^\/b$/i.test(a)) bare = true;
      else if (/^\/a:?d?$/i.test(a)) { if (/d$/i.test(a)) onlyDirs = true; }
      else if (/^\/s$/i.test(a)) recurse = true;
      else if (a.charAt(0) === '/') { /* other switches are accepted and ignored */ }
      else target = a.replace(/^"|"$/g, '');
    });
    var dirTyped = target === null ? '.' : target, pattern = null;
    var rr = resolvePath(s, dirTyped);
    if (!rr.err && !vfs.exists(rr.abs) && hasWild(dirTyped.replace(/\//g, '\\').split('\\').pop())) {
      var last = dirTyped.replace(/\//g, '\\').split('\\').pop();
      pattern = wildRegex(last);
      var cut = dirTyped.slice(0, dirTyped.length - last.length);
      rr = resolvePath(s, cut === '' ? '.' : cut);
    }
    var st = rr.err ? null : vfs.stat(rr.abs);
    if (st && st.type !== 'dir') { pattern = new RegExp('^' + reEsc(st.name) + '$', 'i'); rr = resolvePath(s, parentDisp(rr.disp)); st = vfs.stat(rr.abs); }
    var head = ' 磁碟區 C 中的磁碟沒有標籤。\n 磁碟區序號:  ' + VOL_SERIAL + '\n\n';
    if (!st) {
      if (!bare) ctx.out(head + ' ' + (rr.err ? rr.disp : rr.disp) + ' 的目錄\n\n');
      ctx.native('找不到檔案\n');
      return 1;
    }
    var kids = vfs.list(rr.abs).filter(function (k) { return !isTrash(k) && !isHiddenItem(k); });
    if (pattern) kids = kids.filter(function (k) { return pattern.test(k.name); });
    if (onlyDirs) kids = kids.filter(function (k) { return k.type === 'dir'; });
    kids.sort(function (a, b) { return ntfsCmp(a.name, b.name); });
    if (bare) {
      if (!kids.length) { ctx.native('找不到檔案\n'); return 1; }
      ctx.out(kids.map(function (k) { return k.name; }).join('\n') + '\n');
      return 0;
    }
    var out = head + ' ' + rr.disp + ' 的目錄\n\n';
    if (!kids.length && pattern) { ctx.out(out); ctx.native('找不到檔案\n'); return 1; }
    var rows = [];
    if (!pattern && rr.abs !== '/') {
      rows.push(dirDate(st.mtime) + '    <DIR>          .');
      rows.push(dirDate(st.mtime) + '    <DIR>          ..');
    }
    var nFiles = 0, nDirs = rr.abs !== '/' && !pattern ? 2 : 0, total = 0;
    kids.forEach(function (k) {
      if (k.type === 'dir') { nDirs++; rows.push(dirDate(k.mtime) + '    ' + padR('<DIR>', 14) + ' ' + k.name); }
      else { nFiles++; total += k.size; rows.push(dirDate(k.mtime) + '    ' + padL(groupDigits(k.size), 14) + ' ' + k.name); }
    });
    out += rows.join('\n') + (rows.length ? '\n' : '');
    out += padL(String(nFiles), 16) + ' 個檔案' + padL(groupDigits(total), 16) + ' 位元組\n';
    out += padL(String(nDirs), 16) + ' 個目錄' + padL(groupDigits(DISK_FREE), 17) + ' 位元組可用\n';
    ctx.out(out);
    return 0;
  }
  function cmdCmd(ctx) {
    var args = ctx.rawArgs.map(String), i = 0, line = null;
    while (i < args.length && /^\/[a-z]$/i.test(args[i]) && !/^\/[ck]$/i.test(args[i])) i++;
    if (i < args.length && /^\/[ck]$/i.test(args[i])) line = args.slice(i + 1).join(' ');
    if (line === null) {
      ctx.native('練習版的 cmd 一次只能執行一個指令，請用 cmd /c <指令>，例如 cmd /c dir。\n');
      return 1;
    }
    line = line.trim();
    var m = /^("[^"]*"|\S+)\s*(.*)$/.exec(line);
    if (!m) return 0;
    var word = m[1].replace(/^"|"$/g, ''), rest = m[2];
    function splitArgs(t) { var out = [], re = /"([^"]*)"|(\S+)/g, mm; while ((mm = re.exec(t))) out.push(mm[1] !== undefined ? mm[1] : mm[2]); return out; }
    var lw = word.toLowerCase();
    switch (lw) {
      case 'dir': return cmdDir(ctx, splitArgs(rest));
      case 'echo': {
        var env = ctx.session.envv;
        ctx.out(rest.replace(/%([^%]+)%/g, function (m0, n) { var k = n.toUpperCase(); return hasOwn.call(env, k) ? env[k] : m0; }) + '\n');
        return 0;
      }
      case 'ver': ctx.out('\nMicrosoft Windows [版本 10.0.26200.6584]\n'); return 0;
      case 'hostname': ctx.out(HOST + '\n'); return 0;
      case 'whoami': ctx.out(HOST.toLowerCase() + '\\' + USER + '\n'); return 0;
      case 'cls': ctx.effect({ type: 'clear' }); return 0;
      case 'type': {
        var tr = resolvePath(ctx.session, rest.replace(/^"|"$/g, '')), tst = tr.err ? null : ctx.session.vfs.stat(tr.abs);
        if (!tst || tst.type === 'dir') { ctx.native('系統找不到指定的檔案。\n'); return 1; }
        var txt = ctx.session.vfs.readFile(tst.path, { by: 'terminal' });
        ctx.out(txt.replace(/\r?\n$/, '') + '\n');
        return 0;
      }
      case 'cd': case 'chdir':
        if (!rest) { ctx.out(dispCwd(ctx.session) + '\n'); return 0; }
        ctx.native('練習版的 cmd /c 不會改變 PowerShell 所在的資料夾，請用 cd。\n'); return 0;
      case 'exit': return 0;
      default:
        ctx.native("'" + word + "' 不是內部或外部命令、可執行的程式或批次檔。\n");
        return 1;
    }
  }

  /* ---- where.exe */
  var WHERE_PATHS = { notepad: ['C:\\Windows\\System32\\notepad.exe', 'C:\\Windows\\notepad.exe'], cmd: ['C:\\Windows\\System32\\cmd.exe'], powershell: ['C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe'],
    tar: ['C:\\Windows\\System32\\tar.exe'], ping: ['C:\\Windows\\System32\\PING.EXE'], ipconfig: ['C:\\Windows\\System32\\ipconfig.exe'], whoami: ['C:\\Windows\\System32\\whoami.exe'], hostname: ['C:\\Windows\\System32\\HOSTNAME.EXE'],
    tree: ['C:\\Windows\\System32\\tree.com'], calc: ['C:\\Windows\\System32\\calc.exe'], taskmgr: ['C:\\Windows\\System32\\Taskmgr.exe'], explorer: ['C:\\Windows\\explorer.exe'], curl: ['C:\\Windows\\System32\\curl.exe'],
    find: ['C:\\Windows\\System32\\find.exe'], findstr: ['C:\\Windows\\System32\\findstr.exe'], sort: ['C:\\Windows\\System32\\sort.exe'], more: ['C:\\Windows\\System32\\more.com'], where: ['C:\\Windows\\System32\\where.exe'],
    nslookup: ['C:\\Windows\\System32\\nslookup.exe'], tracert: ['C:\\Windows\\System32\\TRACERT.EXE'], systeminfo: ['C:\\Windows\\System32\\systeminfo.exe'], tasklist: ['C:\\Windows\\System32\\tasklist.exe'],
    taskkill: ['C:\\Windows\\System32\\taskkill.exe'], winget: ['C:\\Users\\' + USER + '\\AppData\\Local\\Microsoft\\WindowsApps\\winget.exe'], msedge: ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'],
    code: ['C:\\Users\\' + USER + '\\AppData\\Local\\Programs\\Microsoft VS Code\\bin\\code.cmd', 'C:\\Users\\' + USER + '\\AppData\\Local\\Programs\\Microsoft VS Code\\bin\\code'] };
  function whereTable(S) {
    var t = {};
    Object.keys(WHERE_PATHS).forEach(function (k) { t[k] = WHERE_PATHS[k]; });
    t.python = ['C:\\Users\\' + USER + '\\AppData\\Local\\Microsoft\\WindowsApps\\python.exe'];
    t.python3 = ['C:\\Users\\' + USER + '\\AppData\\Local\\Microsoft\\WindowsApps\\python3.exe'];
    if (termState.installed.python) { t.python = ['C:\\Users\\' + USER + '\\AppData\\Local\\Programs\\Python\\Python312\\python.exe', t.python[0]]; t.pip = ['C:\\Users\\' + USER + '\\AppData\\Local\\Programs\\Python\\Python312\\Scripts\\pip.exe']; }
    if (termState.installed.git) { t.git = ['C:\\Program Files\\Git\\cmd\\git.exe']; }
    return t;
  }
  function cmdWhereExe(ctx) {
    var args = ctx.rawArgs.map(String).filter(function (a) { return a.charAt(0) !== '/'; }), tbl = whereTable(ctx.session), status = 0;
    if (!args.length) { ctx.native('錯誤: 指定的引數不足。\n輸入 "WHERE /?" 以取得使用方式。\n'); return 2; }
    args.forEach(function (a) {
      var key = a.toLowerCase().replace(/\.(exe|com|cmd|bat)$/, '');
      if (hasOwn.call(tbl, key)) ctx.out(tbl[key].join('\n') + '\n');
      else { status = 1; ctx.native('資訊: 找不到提供模式的檔案。\n'); }
    });
    return status;
  }
  defCmd({ id: 'wherexe', canon: 'file', native: true, name: 'where.exe', run: cmdWhereExe, nopaths: true }, ['where.exe']);
  /* findstr / find: the text filters every Windows tutorial uses after a pipe (`ipconfig | findstr IPv4`) or on a file. Literal strings (space = OR) unless /R. */
  function textLinesOf(text) { var l = String(text).replace(/\r\n/g, '\n').split('\n'); if (l.length && l[l.length - 1] === '') l.pop(); return l; }
  function cmdFindstr(ctx) {
    var args = ctx.rawArgs.map(String), f = {}, pats = [], files = [], i, a;
    for (i = 0; i < args.length; i++) {
      a = args[i];
      if (/^\/c:/i.test(a)) { pats.push(a.slice(3)); f.c = true; continue; }
      if (/^\/f:/i.test(a) || /^\/g:/i.test(a) || /^\/d:/i.test(a) || /^\/a:/i.test(a) || /^\/off/i.test(a)) continue;
      if (a.charAt(0) === '/' && a.length > 1) { a.slice(1).toLowerCase().split('').forEach(function (ch) { f[ch] = true; }); continue; }
      if (!pats.length && !f.c) { a.split(/ +/).forEach(function (w) { if (w) pats.push(w); }); continue; }
      files.push(a);
    }
    if (!pats.length) { ctx.native('FINDSTR: 沒有指定搜尋字串。\n'); return 2; }
    var res = pats.map(function (w) {
      var src = f.r ? w : reEsc(w);
      if (f.x) src = '^(?:' + src + ')$'; else if (f.b) src = '^(?:' + src + ')';
      try { return new RegExp(src, f.i ? 'i' : ''); } catch (e) { return new RegExp(reEsc(w), f.i ? 'i' : ''); }
    });
    var out = [], status = 1, vfs = ctx.session.vfs;
    function scan(lines, prefix) {
      lines.forEach(function (line, n) {
        var hit = res.some(function (re) { return re.test(line); });
        if (f.v) hit = !hit;
        if (!hit) return;
        status = 0;
        out.push((prefix ? prefix + ':' : '') + (f.n ? (n + 1) + ':' : '') + line);
      });
    }
    if (files.length) {
      var many = files.length > 1 || f.s;
      files.forEach(function (arg) {
        var ex = expandPath(ctx.session, arg, false);
        if (ex.miss || !ex.items.length) { ctx.native('FINDSTR: 無法開啟 ' + arg + '\n'); return; }
        ex.items.forEach(function (it) {
          if (it.st.type === 'dir') { ctx.native('FINDSTR: 無法開啟 ' + it.disp + '\n'); return; }
          scan(textLinesOf(vfs.readFile(it.st.path, { by: 'terminal' })), many ? it.st.name : '');
        });
      });
    } else if (ctx.hasInput) {
      var lines = [];
      ctx.input.forEach(function (o) { textLinesOf(strOf(o)).forEach(function (l) { lines.push(l); }); });
      scan(lines, '');
    }
    if (out.length) ctx.out(out.join('\n') + '\n');
    return status;
  }
  function cmdFind(ctx) {
    var args = ctx.rawArgs.map(String), f = {}, str = null, files = [];
    args.forEach(function (a) {
      if (a.charAt(0) === '/' && a.length > 1) { f[a.slice(1).toLowerCase()] = true; return; }
      if (str === null) str = a; else files.push(a);
    });
    if (str === null) { ctx.native('FIND: 參數格式不正確\n'); return 2; }
    var re = new RegExp(reEsc(str), f.i ? 'i' : ''), status = 1, vfs = ctx.session.vfs, out = [];
    function scan(lines, title) {
      var hits = [];
      lines.forEach(function (line, n) { var h = re.test(line); if (f.v) h = !h; if (h) hits.push((f.n ? '[' + (n + 1) + ']' : '') + line); });
      if (hits.length) status = 0;
      if (f.c) { out.push(title ? '---------- ' + title + ': ' + hits.length : String(hits.length)); return; }
      if (title) out.push('', '---------- ' + title);
      hits.forEach(function (h) { out.push(h); });
    }
    if (files.length) files.forEach(function (arg) {
      var ex = expandPath(ctx.session, arg, false);
      if (ex.miss || !ex.items.length) { ctx.native('File not found - ' + arg.toUpperCase() + '\n'); return; }
      ex.items.forEach(function (it) { scan(textLinesOf(vfs.readFile(it.st.path, { by: 'terminal' })), it.st.name.toUpperCase()); });
    });
    else if (ctx.hasInput) {
      var lines = [];
      ctx.input.forEach(function (o) { textLinesOf(strOf(o)).forEach(function (l) { lines.push(l); }); });
      scan(lines, '');
    }
    if (out.length) ctx.out(out.join('\n') + '\n');
    return status;
  }
  defCmd({ id: 'findstr', canon: 'pipe', native: true, name: 'findstr', run: cmdFindstr, nopaths: true }, ['findstr']);
  defCmd({ id: 'find', canon: 'pipe', native: true, name: 'find', run: cmdFind, nopaths: true }, ['find']);
  defCmd({ id: 'cmd', canon: 'sys', native: true, name: 'cmd', run: cmdCmd, nopaths: true }, ['cmd']);
  defCmd({ id: 'tree', canon: 'file', native: true, name: 'tree', run: cmdTree, nopaths: true }, ['tree', 'tree.com']);
  defCmd({ id: 'resolve', canon: 'file', spec: SPEC.resolve, run: cmdResolve }, ['Resolve-Path', 'rvpa']);
  defCmd({ id: 'split', canon: 'file', spec: SPEC.split, run: cmdSplit, nopaths: true }, ['Split-Path']);
  defCmd({ id: 'join', canon: 'file', spec: SPEC.join, run: cmdJoin, nopaths: true }, ['Join-Path']);
  defCmd({ id: 'hash', canon: 'file', spec: SPEC.hash, run: cmdHash }, ['Get-FileHash']);
  defCmd({ id: 'compress', canon: 'file', spec: SPEC.compress, run: cmdCompress }, ['Compress-Archive']);

  /* ====================================================================================================================
     Round 5 — system cmdlets and programs: Get-Date, Get-Process / Stop-Process / tasklist / taskkill, Get-Service, Get-ComputerInfo / systeminfo,
     Get-Command / Get-Alias / Get-Help. Everything here is fake data that follows SPEC section 1 (user an, AN-LAPTOP, Windows 11 25H2 build 26200.6584).
     ==================================================================================================================== */
  var CUR = { session: null };         // the session that is running (strOf of a file item shows a path relative to its folder)

  /* ---- Get-Date */
  SPEC.date = { name: 'Get-Date', cls: CORE + 'GetDateCommand', params: [val('Date', { pos: 0, raw: true, type: 'System.DateTime', pipe: true }), val('Year', { type: 'System.Int32' }), val('Month', { type: 'System.Int32' }), val('Day', { type: 'System.Int32' }),
    val('Hour', { type: 'System.Int32' }), val('Minute', { type: 'System.Int32' }), val('Second', { type: 'System.Int32' }), val('Millisecond', { type: 'System.Int32' }), val('DisplayHint', { type: T_STR }),
    val('Format', { type: T_STR }), val('UFormat', { type: T_STR })] };
  function cmdGetDate(ctx) {
    var P = ctx.p, ms = LAB.clock.ms();
    if (P.Date !== undefined && P.Date !== null) {
      var dv = unroll(P.Date)[0];
      if (isDate(dv)) ms = dv.ms;
      else { var pm = parseDateStr(strOf(dv)); if (pm === null) return ctx.fail({ msg: '無法將 "' + strOf(dv) + '" 值轉換為 "System.DateTime" 型別。錯誤: "字串未被辨識為有效的 DateTime。"', cat: 'InvalidArgument', target: '', activity: 'Get-Date', reason: 'ParameterBindingArgumentTransformationException', fq: 'ParameterArgumentTransformationError,' + CORE + 'GetDateCommand', tokStart: ctx.cmd.start, tokLen: ctx.cmd.end - ctx.cmd.start }); ms = pm; }
    }
    var d = new Date(ms);
    ['Year', 'Month', 'Day', 'Hour', 'Minute', 'Second', 'Millisecond'].forEach(function (k) {
      if (P[k] === undefined) return;
      var v = Number(P[k]);
      if (k === 'Year') d.setFullYear(v); else if (k === 'Month') d.setMonth(v - 1); else if (k === 'Day') d.setDate(v); else if (k === 'Hour') d.setHours(v);
      else if (k === 'Minute') d.setMinutes(v); else if (k === 'Second') d.setSeconds(v); else d.setMilliseconds(v);
    });
    ms = d.getTime();
    if (P.Format !== undefined) { ctx.emitOne(formatDate(ms, P.Format === null ? '' : P.Format)); return 0; }
    if (P.UFormat !== undefined) { ctx.emitOne(ufmtDate(ms, P.UFormat === null ? '' : P.UFormat)); return 0; }
    ctx.emitOne(mkDate(ms));
    return 0;
  }

  /* ---- processes: the system ones are fixed; the apps that are really open in the lab are added with fixed PIDs */
  var SYS_PROCS = [
    ['Idle', 0, 0, 0, 60, 8, null, 0, 0], ['System', 4, 3562, 0, 192, 11204, null, 0, 0.002], ['Registry', 124, 0, 0, 5748, 108684, null, 0, 0], ['smss', 640, 53, 3, 1104, 1456, null, 0, 0],
    ['csrss', 884, 658, 22, 2020, 5972, null, 0, 0.01], ['csrss', 980, 784, 25, 2488, 6240, null, 1, 0.01], ['wininit', 1016, 177, 12, 1384, 6560, null, 0, 0], ['winlogon', 1044, 316, 13, 2764, 12544, null, 1, 0],
    ['services', 1100, 705, 21, 7324, 14624, null, 0, 0.004], ['lsass', 1128, 1624, 33, 10412, 28460, null, 0, 0.01], ['svchost', 1304, 1822, 38, 21408, 40216, null, 0, 0.006], ['fontdrvhost', 1332, 52, 6, 1788, 5456, 0.14, 1, 0],
    ['svchost', 1380, 1155, 24, 12644, 25100, null, 0, 0.003], ['dwm', 1520, 1402, 42, 86340, 118400, 188.06, 1, 0.12], ['svchost', 1612, 592, 17, 6212, 14756, null, 0, 0.002], ['svchost', 1904, 424, 14, 4560, 11920, null, 0, 0.001],
    ['svchost', 2088, 305, 13, 3548, 8508, null, 0, 0.001], ['svchost', 2320, 411, 16, 4408, 10140, null, 0, 0.002], ['MsMpEng', 2956, 1230, 62, 218012, 164200, null, 0, 0.05], ['spoolsv', 3140, 410, 14, 6312, 12480, null, 0, 0],
    ['sihost', 3568, 531, 24, 5360, 25344, 1.27, 1, 0], ['svchost', 3624, 410, 20, 5280, 22008, 2.88, 1, 0.001], ['taskhostw', 3780, 270, 14, 3896, 17884, 1.02, 1, 0], ['ctfmon', 4204, 487, 21, 4780, 22624, 3.11, 1, 0.002],
    ['explorer', 5276, 3450, 105, 61248, 143612, 74.38, 1, 0.03], ['StartMenuExperienceHost', 5644, 678, 28, 24968, 59108, 3.5, 1, 0], ['SearchHost', 5788, 1034, 49, 112460, 171500, 21.31, 1, 0.004], ['RuntimeBroker', 5936, 391, 19, 5424, 28264, 0.94, 1, 0],
    ['RuntimeBroker', 6120, 318, 14, 3936, 23648, 0.39, 1, 0], ['TextInputHost', 6408, 622, 30, 18576, 49984, 4.67, 1, 0.001], ['ShellExperienceHost', 6584, 541, 29, 16988, 52452, 1.62, 1, 0], ['SecurityHealthSystray', 6992, 176, 9, 1976, 9144, 0.17, 1, 0],
    ['SecurityHealthService', 7104, 612, 12, 4096, 12048, null, 0, 0], ['OneDrive', 7412, 891, 41, 52084, 98724, 12.94, 1, 0.002], ['RuntimeBroker', 7660, 280, 12, 2640, 17420, 0.28, 1, 0]];
  /* app id -> [process name, [extra helper process names], first pid, handles, npm, pm, ws, cpu per second, path, company] */
  var APP_PROCS = {
    terminal: ['WindowsTerminal', ['OpenConsole'], 10440, 1015, 42, 118820, 152340, 0.02, 'C:\\Program Files\\WindowsApps\\Microsoft.WindowsTerminal_1.24.12741.0_x64__8wekyb3d8bbwe\\WindowsTerminal.exe', 'Microsoft Corporation'],
    codex: ['Codex', ['Codex', 'Codex'], 11200, 702, 38, 212440, 284100, 0.03, 'C:\\Users\\' + USER + '\\AppData\\Local\\Programs\\Codex\\Codex.exe', 'OpenAI'],
    code: ['Code', ['Code', 'Code', 'Code'], 12480, 640, 36, 189420, 241560, 0.025, 'C:\\Users\\' + USER + '\\AppData\\Local\\Programs\\Microsoft VS Code\\Code.exe', 'Microsoft Corporation'],
    textedit: ['Notepad', [], 9876, 388, 20, 21520, 62440, 0.004, 'C:\\Program Files\\WindowsApps\\Microsoft.WindowsNotepad_11.2509.14.0_x64__8wekyb3d8bbwe\\Notepad\\Notepad.exe', 'Microsoft Corporation'],
    edge: ['msedge', ['msedge', 'msedge', 'msedge'], 13800, 520, 28, 98210, 164800, 0.03, 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'Microsoft Corporation'],
    settings: ['SystemSettings', [], 8820, 744, 31, 41120, 88640, 0.002, 'C:\\Windows\\ImmersiveControlPanel\\SystemSettings.exe', 'Microsoft Corporation'],
    calculator: ['CalculatorApp', [], 9250, 372, 17, 17480, 52320, 0.001, 'C:\\Program Files\\WindowsApps\\Microsoft.WindowsCalculator_11.2508.4.0_x64__8wekyb3d8bbwe\\CalculatorApp.exe', 'Microsoft Corporation'],
    taskmgr: ['Taskmgr', [], 7440, 612, 26, 31860, 74920, 0.01, 'C:\\WINDOWS\\system32\\Taskmgr.exe', 'Microsoft Corporation'],
    photos: ['Microsoft.Photos', [], 12960, 704, 33, 91240, 158700, 0.008, 'C:\\Program Files\\WindowsApps\\Microsoft.Windows.Photos_2025.11090.22001.0_x64__8wekyb3d8bbwe\\Microsoft.Photos.exe', 'Microsoft Corporation']
  };
  function jitter(seed, bucket) { var x = Math.sin(seed * 12.9898 + bucket * 78.233) * 43758.5453; return x - Math.floor(x); }
  /* the process list of the practice PC right now: [{name, id, handles, npm, pm, ws, cpu, si, title, path, company, app, protect}] sorted like Get-Process */
  function localProcessList(S) {
    var now = LAB.clock.ms(), t0 = new Date(2026, 9, 2, 9, 52, 0).getTime(), secs = Math.max(0, (now - t0) / 1000), bucket = Math.floor(now / 3000);
    var list = [];
    function add(r) { list.push(r); }
    SYS_PROCS.forEach(function (p) {
      var j = jitter(p[1], bucket), hasCpu = p[6] !== null;
      add({ name: p[0], id: p[1], handles: p[2] + Math.floor(j * 6), npm: p[3], pm: p[4] + Math.floor(j * 48), ws: p[5] + Math.floor(j * 160), cpu: hasCpu ? p[6] + secs * p[8] + j * 0.3 : null, si: p[7], title: '', path: '', protect: true });
    });
    var wins = [];
    try { wins = LAB.wm && LAB.wm.all ? LAB.wm.all() : []; } catch (e) { wins = []; }
    var byApp = {};
    wins.forEach(function (w) { if (w.appId && hasOwn.call(APP_PROCS, w.appId)) (byApp[w.appId] = byApp[w.appId] || []).push(w); });
    Object.keys(byApp).forEach(function (appId) {
      var info = APP_PROCS[appId], ws = byApp[appId];
      var count = appId === 'terminal' ? ws.length : 1;
      for (var k = 0; k < count; k++) {
        var win = ws[k] || ws[0], title = '';
        try { title = win.getTitle ? win.getTitle() : ''; } catch (e) { title = ''; }
        var pid = info[2] + 4 * k, j = jitter(pid, bucket);
        add({ name: info[0], id: pid, handles: info[3] + Math.floor(j * 8), npm: info[4], pm: info[5] + Math.floor(j * 300), ws: info[6] + Math.floor(j * 500), cpu: 4.5 + k + secs * info[7] + j * 0.4, si: 1, title: title, path: info[8], company: info[9], app: appId });
        if (appId === 'terminal') {
          add({ name: 'powershell', id: 8200 + 4 * k, handles: 612 + Math.floor(j * 10), npm: 31, pm: 66240, ws: 82440 + Math.floor(j * 300), cpu: 1.2 + secs * 0.004 + j * 0.2, si: 1, title: '', path: 'C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe', company: 'Microsoft Corporation', app: 'terminal', child: true });
          add({ name: 'OpenConsole', id: 9100 + 4 * k, handles: 172, npm: 11, pm: 3480, ws: 11820, cpu: 0.2 + j * 0.05, si: 1, title: '', path: '', app: 'terminal', child: true });
        }
      }
      // helper processes of the bigger apps (Code, Edge, Codex have several)
      if (appId !== 'terminal') info[1].forEach(function (nm, h) {
        var pid2 = info[2] + 4 + 4 * h, j2 = jitter(pid2, bucket);
        add({ name: nm, id: pid2, handles: 260 + Math.floor(j2 * 30), npm: 18, pm: 44200 + Math.floor(j2 * 500), ws: 78400 + Math.floor(j2 * 900), cpu: 0.8 + h * 0.3 + secs * info[7] * 0.4, si: 1, title: '', path: info[8], company: info[9], app: appId, child: true });
      });
    });
    var explorerRow = list.filter(function (r) { return r.name === 'explorer'; })[0];
    if (explorerRow) {
      explorerRow.app = 'finder';
      var fw = wins.filter(function (w) { return w.appId === 'finder'; });
      try { explorerRow.title = fw.length && fw[fw.length - 1].getTitle ? fw[fw.length - 1].getTitle() : ''; } catch (e) { /* none */ }
      explorerRow.path = 'C:\\WINDOWS\\explorer.exe';
    }
    list.sort(function (a, b) { return ntfsCmp(a.name, b.name) || a.id - b.id; });
    return list;
  }
  /* LAB.sys.processes() is the one table of the PC (Task Manager reads it too): same names, same fixed PIDs. Guarded: without it the local table above is used. */
  function sysProcesses() {
    try { var sp = LAB.sys && typeof LAB.sys.processes === 'function' ? LAB.sys.processes() : null; return Array.isArray(sp) && sp.length ? sp : null; } catch (e) { return null; }
  }
  function processList(S) {
    var sp = sysProcesses();
    if (!sp) return localProcessList(S);
    var now = LAB.clock.ms(), t0 = new Date(2026, 9, 2, 9, 52, 0).getTime(), secs = Math.max(0, (now - t0) / 1000);
    var list = [{ name: 'Idle', id: 0, handles: 0, npm: 0, pm: 0, ws: 8, cpu: 0, si: 0, title: '', path: '', protect: true }];
    sp.forEach(function (p) {
      var info = p.appId && hasOwn.call(APP_PROCS, p.appId) ? APP_PROCS[p.appId] : null, mine = p.user === 'an';
      var ws = Math.max(8, Math.round((p.mem || 0) * 1024)), win0 = p.windows && p.windows.length ? p.windows[0] : null;
      var j = jitter(p.pid, 3), pct = (p.cpu || 0) / 100;
      var r = { name: p.name, id: p.pid, handles: info ? (p.main ? info[3] : 260) + Math.floor(j * 40) : 120 + (p.pid % 640), npm: info ? (p.main ? info[4] : 16) : 5 + (p.pid % 38),
        pm: Math.round(ws * (0.55 + 0.2 * j)), ws: ws, cpu: (mine || info) ? 0.3 + (p.pid % 29) / 4 + secs * pct + j * 0.2 : null, si: mine ? 1 : 0,
        title: win0 && p.main ? win0.title : '', path: info ? info[8] : (p.name === 'System' || p.name === 'Registry' || p.name === 'Memory Compression' ? '' : 'C:\\WINDOWS\\System32\\' + p.exe),
        company: info ? info[9] : (p.name === 'System' ? null : 'Microsoft Corporation'), protect: p.kind !== 'app', sysPid: p.pid };
      if (p.appId) r.app = p.appId;
      if (p.group === 'child') r.child = true;
      if (p.appId === 'finder') r.path = 'C:\\WINDOWS\\explorer.exe';
      if (p.name === 'powershell') r.path = 'C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
      if (p.name === 'OpenConsole') r.path = '';
      list.push(r);
    });
    list.sort(function (a, b) { return ntfsCmp(a.name, b.name) || a.id - b.id; });
    return list;
  }
  function procObj(r) {
    return new PSObj('System.Diagnostics.Process', [['Handles', r.handles], ['NPM', r.npm], ['PM', r.pm], ['WS', r.ws], ['CPU', r.cpu === null ? null : Math.round(r.cpu * 100) / 100], ['Id', r.id], ['SI', r.si], ['ProcessName', r.name],
      ['Name', r.name], ['MainWindowTitle', r.title || ''], ['Path', r.path || null], ['Company', r.company || null], ['Responding', true], ['StartTime', mkDate(new Date(2026, 9, 2, 8, 31, 0).getTime() + r.id * 100)]], { fmt: 'process', str: function () { return 'System.Diagnostics.Process (' + r.name + ')'; }, proc: r });
  }
  SPEC.gps = { name: 'Get-Process', cls: CORE + 'GetProcessCommand', params: [val('Name', { pos: 0, arr: true, type: T_ARR, al: ['ProcessName'] }), val('Id', { arr: true, type: 'System.Int32[]', al: ['PID'] }), val('InputObject', { arr: true, raw: true, type: 'System.Diagnostics.Process[]' }),
    sw('IncludeUserName'), sw('FileVersionInfo'), sw('Module'), val('ComputerName', { arr: true, type: T_ARR, al: ['Cn'] })] };
  function noProcessErr(ctx, what, cmdName, cls) {
    return ctx.fail({ msg: '找不到名稱為 "' + what + '" 的處理序。請確認該處理序名稱，然後再呼叫一次 Cmdlet。', cat: 'ObjectNotFound', target: what, ttype: 'String', activity: cmdName, reason: 'ProcessCommandException', fq: 'NoProcessFoundForGivenName,' + CORE + cls });
  }
  function cmdGetProcess(ctx) {
    var P = ctx.p, list = processList(ctx.session), status = 0, out = [];
    if (P.Name) {
      P.Name.forEach(function (n) {
        if (n === null) return;
        var re = wildRegex(String(n).replace(/\.exe$/i, ''));
        var hit = list.filter(function (r) { return re.test(r.name); });
        if (!hit.length) { status = 1; noProcessErr(ctx, n, 'Get-Process', 'GetProcessCommand'); return; }
        hit.forEach(function (r) { if (out.indexOf(r) < 0) out.push(r); });
      });
    } else if (P.Id) {
      P.Id.forEach(function (n) {
        var hit = list.filter(function (r) { return r.id === Number(n); });
        if (!hit.length) { status = 1; ctx.fail({ msg: '找不到識別碼為 ' + n + ' 的處理序。請確認處理序識別碼，然後再呼叫一次 Cmdlet。', cat: 'ObjectNotFound', target: String(n), ttype: 'Int32', activity: 'Get-Process', reason: 'ProcessCommandException', fq: 'NoProcessFoundForGivenId,' + CORE + 'GetProcessCommand' }); return; }
        out.push(hit[0]);
      });
    } else out = list;
    ctx.emit(out.map(procObj));
    return status;
  }
  /* Stop-Process: closes the windows of the app for real; system processes refuse like a normal user's PowerShell does */
  SPEC.spps = { name: 'Stop-Process', cls: CORE + 'StopProcessCommand', risk: true, params: [val('Id', { pos: 0, mand: true, arr: true, type: 'System.Int32[]', pipe: true }), val('Name', { arr: true, type: T_ARR, al: ['ProcessName'], mand: true, pipe: true }),
    val('InputObject', { arr: true, raw: true, type: 'System.Diagnostics.Process[]', mand: true, pipe: true }), sw('PassThru'), sw('Force')] };
  SPEC.spps.params[0].mandUnless = ['Name', 'InputObject']; SPEC.spps.params[1].mandUnless = ['Id', 'InputObject']; SPEC.spps.params[2].mandUnless = ['Id', 'Name'];
  function killRow(ctx, r, status) {
    if (!r.app) {
      ctx.fail({ msg: '無法停止處理序 "' + r.name + ' (' + r.id + ')"，因為發生錯誤 "拒絕存取。"。', cat: 'CloseError', target: 'System.Diagnostics.Process (' + r.name + ')', ttype: 'Process', activity: 'Stop-Process', reason: 'ProcessCommandException', fq: 'CouldNotStopProcess,' + CORE + 'StopProcessCommand' });
      return 1;
    }
    ctx.effect({ type: 'kill', appId: r.app, pid: r.id });
    return status;
  }
  function cmdStopProcess(ctx) {
    var P = ctx.p, list = processList(ctx.session), status = 0, hit = [];
    function addRow(r) { if (hit.indexOf(r) < 0) hit.push(r); }
    if (P.Name) {
      P.Name.forEach(function (n) {
        if (n === null) return;
        var re = wildRegex(String(n).replace(/\.exe$/i, ''));
        var m = list.filter(function (r) { return re.test(r.name); });
        if (!m.length) { status = 1; noProcessErr(ctx, n, 'Stop-Process', 'StopProcessCommand'); return; }
        m.forEach(addRow);
      });
    }
    var ids = P.Id ? P.Id.map(Number) : [];
    if (ctx.hasInput && !P.Name && !P.Id) {
      ctx.input.forEach(function (o) { if (isObj(o) && o.proc) ids.push(o.proc.id); else if (typeof o === 'number') ids.push(o); });
    }
    if (P.InputObject) unroll(P.InputObject).forEach(function (o) { if (isObj(o) && o.proc) ids.push(o.proc.id); });
    ids.forEach(function (id) {
      var m = list.filter(function (r) { return r.id === id; });
      if (!m.length) { status = 1; ctx.fail({ msg: '找不到識別碼為 ' + id + ' 的處理序。', cat: 'ObjectNotFound', target: String(id), ttype: 'Int32', activity: 'Stop-Process', reason: 'ProcessCommandException', fq: 'NoProcessFoundForGivenId,' + CORE + 'StopProcessCommand' }); return; }
      addRow(m[0]);
    });
    var killedApps = {};
    hit.forEach(function (r) {
      if (P.WhatIf) { ctx.host('WhatIf: 正在目標 "' + r.name + ' (' + r.id + ')" 上執行 "Stop-Process" 操作。\n'); return; }
      if (r.app && killedApps[r.app]) return;
      var st = killRow(ctx, r, 0);
      if (st) status = 1; else if (r.app) killedApps[r.app] = 1;
      if (!st && P.PassThru) ctx.emitOne(procObj(r));
    });
    return status;
  }
  /* tasklist / taskkill (zh-TW) */
  function imageName(r) { return /^(Idle)$/.test(r.name) ? 'System Idle Process' : (r.name === 'System' || r.name === 'Registry' || /^Secure System$/.test(r.name) ? r.name : r.name + '.exe'); }
  function cmdTasklist(ctx) {
    var args = ctx.rawArgs.map(String), list = processList(ctx.session), noHeader = false, fmt = 'table', filters = [];
    for (var i = 0; i < args.length; i++) {
      var a = args[i].toLowerCase();
      if (a === '/nh') noHeader = true;
      else if (a === '/fo') fmt = String(args[++i] || 'table').toLowerCase();
      else if (a === '/fi') { var m = /^\s*(\w+)\s+(eq|ne)\s+(.*)$/i.exec(String(args[++i] || '')); if (m) filters.push({ k: m[1].toLowerCase(), op: m[2].toLowerCase(), v: m[3].replace(/^"|"$/g, '').trim() }); }
    }
    var rows = list.map(function (r) { return { img: imageName(r), id: r.id, sess: r.si ? 'Console' : 'Services', no: r.si, mem: r.ws }; });
    rows.unshift({ img: 'System Idle Process', id: 0, sess: 'Services', no: 0, mem: 8 });
    rows = rows.filter(function (r, i, arr) { return !(r.img === 'System Idle Process' && i > 0 && arr[0].img === r.img && arr.indexOf(r) !== 0); });
    rows.sort(function (a, b) { return a.id - b.id; });
    filters.forEach(function (f) {
      rows = rows.filter(function (r) {
        var v = f.k === 'imagename' ? r.img : (f.k === 'pid' ? String(r.id) : (f.k === 'sessionname' ? r.sess : null));
        if (v === null) return true;
        var eq = wildRegex(f.v).test(v);
        return f.op === 'eq' ? eq : !eq;
      });
    });
    if (!rows.length) { ctx.out('資訊: 沒有執行中的工作符合指定的準則。\n'); return 0; }
    if (fmt === 'csv') {
      ctx.out((noHeader ? '' : '"映像名稱","PID","工作階段名稱","工作階段 #","RAM使用量"\n') + rows.map(function (r) { return '"' + r.img + '","' + r.id + '","' + r.sess + '","' + r.no + '","' + groupDigits(r.mem) + ' K"'; }).join('\n') + '\n');
      return 0;
    }
    var lines = [];
    if (!noHeader) lines.push('', padR('映像名稱', 25) + ' ' + padL('PID', 8) + ' ' + padR('工作階段名稱', 16) + ' ' + padL('工作階段 #', 11) + ' ' + padL('RAM使用量', 12), '========================= ======== ================ =========== ============');
    rows.forEach(function (r) { lines.push(padR(r.img, 25) + ' ' + padL(String(r.id), 8) + ' ' + padR(r.sess, 16) + ' ' + padL(String(r.no), 11) + ' ' + padL(groupDigits(r.mem) + ' K', 12)); });
    ctx.out(lines.join('\n') + '\n');
    return 0;
  }
  function cmdTaskkill(ctx) {
    var args = ctx.rawArgs.map(String), list = processList(ctx.session), names = [], pids = [], force = false;
    for (var i = 0; i < args.length; i++) {
      var a = args[i].toLowerCase();
      if (a === '/im') names.push(String(args[++i] || '')); else if (a === '/pid') pids.push(Number(args[++i])); else if (a === '/f') force = true;
    }
    if (!names.length && !pids.length) { ctx.native('錯誤: 指定的引數不足。\n輸入 "TASKKILL /?" 以取得使用方式。\n'); return 1; }
    var status = 0, killed = {};
    names.forEach(function (n) {
      var key = n.toLowerCase().replace(/\.exe$/, ''), re = wildRegex(key);
      var m = list.filter(function (r) { return re.test(r.name.toLowerCase()); });
      if (!m.length) { status = 128; ctx.native('錯誤: 找不到處理程序 "' + n + '"。\n'); return; }
      m.forEach(function (r) { status = killTarget(ctx, r, force, killed) || status; });
    });
    pids.forEach(function (id) {
      var m = list.filter(function (r) { return r.id === id; });
      if (!m.length) { status = 128; ctx.native('錯誤: 找不到處理程序 "' + id + '"。\n'); return; }
      status = killTarget(ctx, m[0], force, killed) || status;
    });
    return status;
  }
  function killTarget(ctx, r, force, killed) {
    if (!r.app) { ctx.native('錯誤: 無法終止 PID 為 ' + r.id + ' 的處理程序。\n原因: 拒絕存取。\n'); return 1; }
    if (!killed[r.app]) { killed[r.app] = 1; ctx.effect({ type: 'kill', appId: r.app, pid: r.id }); }
    ctx.out(force ? '成功: 已終止處理程序 "' + imageName(r) + '"，其 PID 為 ' + r.id + '。\n' : '成功: 已將終止訊號傳送給處理程序 "' + imageName(r) + '"，其 PID 為 ' + r.id + '。\n');
    return 0;
  }

  /* ---- services (a short, believable list) */
  var SERVICES = [['AppXSvc', 'AppX Deployment Service (AppXSVC)', 'Running'], ['AudioEndpointBuilder', 'Windows 音訊端點建立器', 'Running'], ['Audiosrv', 'Windows 音訊', 'Running'], ['BFE', 'Base Filtering Engine', 'Running'],
    ['BITS', '背景智慧型傳送服務', 'Stopped'], ['BrokerInfrastructure', 'Background Tasks Infrastructure Service', 'Running'], ['BthAvctpSvc', 'AVCTP 服務', 'Running'], ['bthserv', '藍牙支援服務', 'Running'], ['CDPSvc', 'Connected Devices Platform Service', 'Running'],
    ['CryptSvc', 'Cryptographic Services', 'Running'], ['DcomLaunch', 'DCOM Server Process Launcher', 'Running'], ['Dhcp', 'DHCP Client', 'Running'], ['DiagTrack', 'Connected User Experiences and Telemetry', 'Running'], ['Dnscache', 'DNS Client', 'Running'],
    ['EventLog', 'Windows Event Log', 'Running'], ['EventSystem', 'COM+ Event System', 'Running'], ['FontCache', 'Windows Font Cache Service', 'Running'], ['LanmanServer', 'Server', 'Running'], ['LanmanWorkstation', 'Workstation', 'Running'],
    ['mpssvc', 'Windows Defender Firewall', 'Running'], ['NlaSvc', 'Network Location Awareness', 'Running'], ['PlugPlay', 'Plug and Play', 'Running'], ['Power', 'Power', 'Running'], ['ProfSvc', 'User Profile Service', 'Running'],
    ['RpcSs', 'Remote Procedure Call (RPC)', 'Running'], ['SamSs', 'Security Accounts Manager', 'Running'], ['Schedule', 'Task Scheduler', 'Running'], ['SecurityHealthService', 'Windows 安全性服務', 'Running'], ['Spooler', 'Print Spooler', 'Running'],
    ['SysMain', 'SysMain', 'Running'], ['TimeBrokerSvc', 'Time Broker', 'Running'], ['UserManager', 'User Manager', 'Running'], ['Wcmsvc', 'Windows Connection Manager', 'Running'], ['WdiServiceHost', 'Diagnostic Service Host', 'Stopped'],
    ['WinDefend', 'Microsoft Defender Antivirus Service', 'Running'], ['Winmgmt', 'Windows Management Instrumentation', 'Running'], ['WlanSvc', 'WLAN AutoConfig', 'Running'], ['wscsvc', 'Security Center', 'Running'], ['wuauserv', 'Windows Update', 'Stopped']];
  SPEC.gsv = { name: 'Get-Service', cls: CORE + 'GetServiceCommand', params: [val('Name', { pos: 0, arr: true, type: T_ARR, al: ['ServiceName'] }), val('DisplayName', { arr: true, type: T_ARR }), val('Include', { arr: true, type: T_ARR }),
    val('Exclude', { arr: true, type: T_ARR }), sw('DependentServices', ['DS']), sw('RequiredServices', ['SDO', 'ServicesDependedOn']), val('InputObject', { arr: true, raw: true, type: T_OBJ })] };
  function svcObj(r) {
    return new PSObj('System.ServiceProcess.ServiceController', [['Status', r[2]], ['Name', r[0]], ['DisplayName', r[1]], ['ServiceName', r[0]], ['CanStop', r[2] === 'Running'], ['StartType', r[2] === 'Running' ? 'Automatic' : 'Manual']], { fmt: 'service' });
  }
  function cmdGetService(ctx) {
    var P = ctx.p, status = 0, out = [];
    if (P.Name) {
      P.Name.forEach(function (n) {
        var re = wildRegex(String(n)), hit = SERVICES.filter(function (r) { return re.test(r[0]); });
        if (!hit.length && !hasWild(String(n))) { status = 1; ctx.fail({ msg: "找不到任何服務名稱為 '" + n + "' 的服務。", cat: 'ObjectNotFound', target: String(n), ttype: 'String', activity: 'Get-Service', reason: 'ServiceCommandException', fq: 'NoServiceFoundForGivenName,' + CORE + 'GetServiceCommand' }); return; }
        hit.forEach(function (r) { if (out.indexOf(r) < 0) out.push(r); });
      });
    } else if (P.DisplayName) {
      P.DisplayName.forEach(function (n) {
        var re = wildRegex(String(n)), hit = SERVICES.filter(function (r) { return re.test(r[1]); });
        if (!hit.length && !hasWild(String(n))) { status = 1; ctx.fail({ msg: "找不到任何顯示名稱為 '" + n + "' 的服務。", cat: 'ObjectNotFound', target: String(n), ttype: 'String', activity: 'Get-Service', reason: 'ServiceCommandException', fq: 'NoServiceFoundForGivenDisplayName,' + CORE + 'GetServiceCommand' }); return; }
        hit.forEach(function (r) { if (out.indexOf(r) < 0) out.push(r); });
      });
    } else out = SERVICES.slice();
    out.sort(function (a, b) { return ntfsCmp(a[0], b[0]); });
    ctx.emit(out.map(svcObj));
    return status;
  }

  /* ---- Get-ComputerInfo and systeminfo (simplified: the real ones print a hundred more lines) */
  var HW = { vendor: 'LENOVO', model: '83DR', mem: 16 * 1024 * 1024 * 1024, serial: 'PF4Y7K2A', bios: 'LENOVO N3CN28WW, 2025/6/12' };
  Object.defineProperty(HW, 'cpu', { enumerable: true, get: function () { return sysInfo('CPU', 'Intel(R) Core(TM) Ultra 5 125U'); } });
  /* 原始安裝日期 follows LAB.sys.info.INSTALLED (2026/9/1) */
  function installMs() {
    var m = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(String(sysInfo('INSTALLED', '')));
    return m ? new Date(+m[1], +m[2] - 1, +m[3], 11, 42, 9).getTime() : new Date(2026, 8, 7, 11, 42, 9).getTime();
  }
  function usableMB() { var m = /^([\d.]+)\s*GB/i.exec(String(sysInfo('RAM_AVAIL', ''))); return m ? Math.round(parseFloat(m[1]) * 1024) : 15694; }
  SPEC.gci2 = { name: 'Get-ComputerInfo', cls: CORE + 'GetComputerInfoCommand', params: [val('Property', { pos: 0, arr: true, type: T_ARR })] };
  function cmdGetComputerInfo(ctx) {
    var P = ctx.p;
    var pairs = [['WindowsBuildLabEx', '26100.1.amd64fre.ge_release.240331-1435'], ['WindowsCurrentVersion', '6.3'], ['WindowsEditionId', 'Core'], ['WindowsInstallationType', 'Client'], ['WindowsInstallDateFromRegistry', mkDate(installMs())],
      ['WindowsProductName', 'Windows 10 Home'], ['WindowsRegisteredOwner', USER], ['WindowsSystemRoot', 'C:\\WINDOWS'], ['WindowsVersion', '2009'], ['OSDisplayVersion', '25H2'], ['BiosManufacturer', HW.vendor], ['BiosVersion', HW.bios],
      ['CsDNSHostName', HOST], ['CsDomain', 'WORKGROUP'], ['CsManufacturer', HW.vendor], ['CsModel', HW.model], ['CsName', HOST], ['CsNumberOfLogicalProcessors', 14], ['CsNumberOfProcessors', 1], ['CsProcessors', [HW.cpu]],
      ['CsTotalPhysicalMemory', HW.mem], ['CsUserName', HOST + '\\' + USER], ['OsName', 'Microsoft Windows 11 家用版'], ['OsType', 'WINNT'], ['OsVersion', '10.0.26200'], ['OsBuildNumber', '26200'], ['OsSystemDrive', 'C:'],
      ['OsWindowsDirectory', 'C:\\WINDOWS'], ['OsLocale', 'zh-TW'], ['OsLocalDateTime', mkDate(LAB.clock.ms())], ['OsLastBootUpTime', mkDate(new Date(2026, 9, 2, 8, 31, 25).getTime())], ['OsArchitecture', '64 位元'], ['OsLanguage', 'zh-TW'],
      ['KeyboardLayout', 'zh-TW'], ['TimeZone', '(UTC+08:00) 台北'], ['PowerPlatformRole', 'Mobile']];
    if (P.Property) {
      var want = P.Property.map(function (x) { return String(x).toLowerCase(); }), sel = pairs.filter(function (kv) { return want.some(function (w) { return wildRegex(w).test(kv[0]); }); });
      ctx.emitOne(new PSObj('Microsoft.PowerShell.Commands.ComputerInfo', sel, { custom: true }));
      return 0;
    }
    ctx.emitOne(new PSObj('Microsoft.PowerShell.Commands.ComputerInfo', pairs, { custom: true }));
    return 0;
  }
  function cmdSysteminfo(ctx) {
    var dt = function (ms) { var d = new Date(ms); return d.getFullYear() + '/' + (d.getMonth() + 1) + '/' + d.getDate() + ', ' + dTT(d) + ' ' + two(dH12(d)) + ':' + two(d.getMinutes()) + ':' + two(d.getSeconds()); };
    var rows = [['主機名稱:', HOST], ['作業系統名稱:', 'Microsoft Windows 11 家用版'], ['OS 版本:', '10.0.26200 N/A 組建 26200'], ['作業系統製造商:', 'Microsoft Corporation'], ['作業系統設定:', '獨立工作站'],
      ['作業系統組建類型:', 'Multiprocessor Free'], ['註冊的擁有者:', USER], ['註冊公司:', 'N/A'], ['產品識別碼:', sysInfo('PRODUCT_ID', '00342-35588-11237-AAOEM')], ['原始安裝日期:', dt(installMs())],
      ['系統開機時間:', dt(new Date(2026, 9, 2, 8, 31, 25).getTime())], ['系統製造商:', HW.vendor], ['系統型號:', HW.model], ['系統類型:', 'x64-based PC']];
    var lines = [''];
    function row(label, val) { lines.push(padR(label, 22) + val); }
    rows.forEach(function (r) { row(r[0], r[1]); });
    lines.push(padR('處理器:', 22) + '已安裝 1 處理器。', padR('', 22) + '[01]: Intel64 Family 6 Model 170 Stepping 4 GenuineIntel ~1300 Mhz');
    [['BIOS 版本:', HW.bios], ['Windows 目錄:', 'C:\\WINDOWS'], ['系統目錄:', 'C:\\WINDOWS\\system32'], ['開機裝置:', '\\Device\\HarddiskVolume1'], ['系統地區設定:', 'zh-tw;中文 (台灣)'], ['輸入法地區設定:', 'zh-tw;中文 (台灣)'],
      ['時區:', '(UTC+08:00) 台北'], ['實體記憶體總計:', groupDigits(usableMB()) + ' MB'], ['可用實體記憶體:', '6,512 MB'], ['虛擬記憶體: 大小上限:', '17,742 MB'], ['虛擬記憶體: 可用:', '7,901 MB'], ['虛擬記憶體: 使用中:', '9,841 MB'],
      ['分頁檔位置:', 'C:\\pagefile.sys'], ['網域:', 'WORKGROUP'], ['登入伺服器:', '\\\\' + HOST]].forEach(function (r) {
      if (r[0].indexOf('虛擬記憶體') === 0) lines.push(padR(r[0], 22 - (displayWidth(r[0]) > 20 ? 0 : 0)) + r[1]); else row(r[0], r[1]);
    });
    lines.push(padR('Hotfix:', 22) + '已安裝 2 Hotfix。', padR('', 22) + '[01]: KB5066835', padR('', 22) + '[02]: KB5065426',
      padR('網路卡:', 22) + '已安裝 2 NIC。', padR('', 22) + '[01]: ' + NET.adapter, padR('', 28) + padR('連線名稱:', 20) + 'Wi-Fi', padR('', 28) + padR('DHCP 已啟用:', 20) + '是', padR('', 28) + padR('DHCP 伺服器:', 20) + NET.gw,
      padR('', 28) + 'IP 位址', padR('', 28) + '[01]: ' + NET.ip, padR('', 28) + '[02]: fe80::7c3e:9a1d:5b42:8e6f', padR('', 22) + '[02]: Bluetooth Device (Personal Area Network)', padR('', 28) + padR('連線名稱:', 20) + '藍牙網路連線', padR('', 28) + padR('狀態:', 20) + '媒體已中斷連線');
    lines.push(padR('Hyper-V 需求:', 22) + 'VM 監視器模式延伸: 是', padR('', 22) + '韌體中已啟用虛擬化: 是', padR('', 22) + '第二層位址轉譯: 是', padR('', 22) + '資料執行防止可用: 是');
    ctx.out(lines.join('\n') + '\n');
    return 0;
  }

  /* ---- Get-Command / Get-Alias */
  var ALIAS_RAW = '%=ForEach-Object;?=Where-Object;ac=Add-Content;asnp=Add-PSSnapin;cat=Get-Content;cd=Set-Location;CFS=ConvertFrom-String,3.1.0.0,Microsoft.PowerShell.Utility;chdir=Set-Location;clc=Clear-Content;clear=Clear-Host;clhy=Clear-History;cli=Clear-Item;clp=Clear-ItemProperty;cls=Clear-Host;clv=Clear-Variable;cnsn=Connect-PSSession;compare=Compare-Object;copy=Copy-Item;cp=Copy-Item;cpi=Copy-Item;cpp=Copy-ItemProperty;curl=Invoke-WebRequest;cvpa=Convert-Path;dbp=Disable-PSBreakpoint;del=Remove-Item;diff=Compare-Object;dir=Get-ChildItem;dnsn=Disconnect-PSSession;ebp=Enable-PSBreakpoint;echo=Write-Output;epal=Export-Alias;epcsv=Export-Csv;epsn=Export-PSSession;erase=Remove-Item;etsn=Enter-PSSession;exsn=Exit-PSSession;fc=Format-Custom;fhx=Format-Hex,3.1.0.0,Microsoft.PowerShell.Utility;fl=Format-List;foreach=ForEach-Object;ft=Format-Table;fw=Format-Wide;gal=Get-Alias;gbp=Get-PSBreakpoint;gc=Get-Content;gcb=Get-Clipboard,3.1.0.0,Microsoft.PowerShell.Management;gci=Get-ChildItem;gcm=Get-Command;gcs=Get-PSCallStack;gdr=Get-PSDrive;ghy=Get-History;gi=Get-Item;gin=Get-ComputerInfo,3.1.0.0,Microsoft.PowerShell.Management;gjb=Get-Job;gl=Get-Location;gm=Get-Member;gmo=Get-Module;gp=Get-ItemProperty;gps=Get-Process;gpv=Get-ItemPropertyValue;group=Group-Object;gsn=Get-PSSession;gsnp=Get-PSSnapin;gsv=Get-Service;gtz=Get-TimeZone,3.1.0.0,Microsoft.PowerShell.Management;gu=Get-Unique;gv=Get-Variable;gwmi=Get-WmiObject;h=Get-History;history=Get-History;icm=Invoke-Command;iex=Invoke-Expression;ihy=Invoke-History;ii=Invoke-Item;ipal=Import-Alias;ipcsv=Import-Csv;ipmo=Import-Module;ipsn=Import-PSSession;irm=Invoke-RestMethod;ise=powershell_ise.exe;iwmi=Invoke-WmiMethod;iwr=Invoke-WebRequest;kill=Stop-Process;lp=Out-Printer;ls=Get-ChildItem;man=help;md=mkdir;measure=Measure-Object;mi=Move-Item;mount=New-PSDrive;move=Move-Item;mp=Move-ItemProperty;mv=Move-Item;nal=New-Alias;ndr=New-PSDrive;ni=New-Item;nmo=New-Module;npssc=New-PSSessionConfigurationFile;nsn=New-PSSession;nv=New-Variable;ogv=Out-GridView;oh=Out-Host;popd=Pop-Location;ps=Get-Process;pushd=Push-Location;pwd=Get-Location;r=Invoke-History;rbp=Remove-PSBreakpoint;rcjb=Receive-Job;rcsn=Receive-PSSession;rd=Remove-Item;rdr=Remove-PSDrive;ren=Rename-Item;ri=Remove-Item;rjb=Remove-Job;rm=Remove-Item;rmdir=Remove-Item;rmo=Remove-Module;rni=Rename-Item;rnp=Rename-ItemProperty;rp=Remove-ItemProperty;rsn=Remove-PSSession;rsnp=Remove-PSSnapin;rujb=Resume-Job;rv=Remove-Variable;rvpa=Resolve-Path;rwmi=Remove-WmiObject;sajb=Start-Job;sal=Set-Alias;saps=Start-Process;sasv=Start-Service;sbp=Set-PSBreakpoint;sc=Set-Content;scb=Set-Clipboard,3.1.0.0,Microsoft.PowerShell.Management;select=Select-Object;set=Set-Variable;shcm=Show-Command;si=Set-Item;sl=Set-Location;sleep=Start-Sleep;sls=Select-String;sort=Sort-Object;sp=Set-ItemProperty;spjb=Stop-Job;spps=Stop-Process;spsv=Stop-Service;start=Start-Process;stz=Set-TimeZone,3.1.0.0,Microsoft.PowerShell.Management;sujb=Suspend-Job;sv=Set-Variable;swmi=Set-WmiInstance;tee=Tee-Object;trcm=Trace-Command;type=Get-Content;wget=Invoke-WebRequest;where=Where-Object;wjb=Wait-Job;write=Write-Output';
  var ALIASES = {};            // lower-case alias -> {name, def, version, source}
  ALIAS_RAW.split(';').forEach(function (e) {
    var p = e.split('=');
    if (p.length < 2) return;
    var rest = p.slice(1).join('=').split(',');
    ALIASES[p[0].toLowerCase()] = { name: p[0], def: rest[0], version: rest[1] || '', source: rest[2] || '' };
  });
  var CMDLET_MODULE = (function () {
    var m = {};
    function put(mod, ver, names) { names.split(' ').forEach(function (n) { m[n.toLowerCase()] = { module: mod, version: ver }; }); }
    put('Microsoft.PowerShell.Management', '3.1.0.0', 'Get-ChildItem Get-Item Set-Location Get-Location Push-Location Pop-Location New-Item Move-Item Copy-Item Remove-Item Rename-Item Get-Content Set-Content Add-Content Test-Path Resolve-Path Split-Path Join-Path Get-Process Stop-Process Start-Process Get-Service Get-ComputerInfo Invoke-Item Test-Connection Get-Clipboard Set-Clipboard Clear-Host');
    put('Microsoft.PowerShell.Utility', '3.1.0.0', 'Sort-Object Select-Object Measure-Object Group-Object Format-Table Format-List Format-Wide Out-File Out-String Select-String Import-Csv Export-Csv ConvertTo-Csv ConvertFrom-Csv ConvertTo-Json ConvertFrom-Json Tee-Object Get-Member Get-Unique Get-Random Write-Output Write-Host Write-Warning Write-Error Write-Verbose Write-Debug Write-Information Read-Host Get-Date Start-Sleep Get-FileHash Invoke-WebRequest Invoke-RestMethod Get-Alias Set-Alias New-Alias Get-Variable Set-Variable');
    put('Microsoft.PowerShell.Core', '3.0.0.0', 'Get-Command Get-Help Get-History ForEach-Object Where-Object Out-Host Out-Null');
    put('Microsoft.PowerShell.Archive', '1.0.1.0', 'Compress-Archive Expand-Archive');
    return m;
  })();
  var NATIVE_NAMES = ['ipconfig', 'ping', 'nslookup', 'tracert', 'systeminfo', 'tasklist', 'taskkill', 'tar', 'whoami', 'hostname', 'tree', 'cmd', 'curl', 'calc', 'taskmgr', 'notepad', 'explorer', 'where', 'powershell', 'winget', 'code', 'git', 'python', 'msedge'];
  function nativePath(name, S) {
    var t = whereTable(S), key = name.toLowerCase();
    if (!hasOwn.call(t, key)) return null;
    var p = t[key][0];
    return p.replace(/^C:\\Windows\\/, 'C:\\WINDOWS\\').replace(/^C:\\WINDOWS\\System32/, 'C:\\WINDOWS\\system32');
  }
  function cmdInfoObj(type, name, version, source, extra) {
    var o = new PSObj('System.Management.Automation.CommandInfo', [['CommandType', type], ['Name', name], ['Version', version], ['Source', source]], { fmt: 'command' });
    if (extra) for (var k in extra) o[k] = extra[k];
    return o;
  }
  function aliasObj(name, def) {
    var o = new PSObj('System.Management.Automation.AliasInfo', [['CommandType', 'Alias'], ['Name', name], ['Definition', def], ['ResolvedCommandName', def], ['Version', ''], ['Source', ''], ['DisplayName', name + ' -> ' + def]], { fmt: 'command', str: function () { return name; } });
    return o;
  }
  SPEC.gcm = { name: 'Get-Command', cls: CORE + 'GetCommandCommand', params: [val('Name', { pos: 0, arr: true, type: T_ARR }), val('Module', { arr: true, type: T_ARR }), sw('ListImported'), val('Verb', { arr: true, type: T_ARR }), val('Noun', { arr: true, type: T_ARR }),
    val('CommandType', { type: T_STR, al: ['Type'] }), sw('All'), sw('Syntax'), val('TotalCount', { type: 'System.Int32' })] };
  function allCommandInfos(S) {
    var out = [];
    Object.keys(ALIASES).forEach(function (k) { var a = ALIASES[k]; out.push(Object.assign(aliasObj(a.name, a.def), {})); });
    Object.keys(S.aliases || {}).forEach(function (k) { out.push(aliasObj(k, S.aliases[k])); });
    var seen = {};
    Object.keys(CMDS).forEach(function (k) {
      var d = CMDS[k];
      if (!d.spec || seen[d.spec.name]) return;
      seen[d.spec.name] = 1;
      var info = CMDLET_MODULE[d.spec.name.toLowerCase()];
      if (!info) return;
      out.push(cmdInfoObj(info.module === 'Microsoft.PowerShell.Archive' ? 'Function' : 'Cmdlet', d.spec.name, info.version, info.module));
    });
    NATIVE_NAMES.forEach(function (n) {
      var p = nativePath(n, S);
      if (!p) return;
      var base = p.slice(p.lastIndexOf('\\') + 1);
      out.push(cmdInfoObj('Application', base, '10.0.26100.6584', p));
    });
    return out;
  }
  function cmdGetCommand(ctx) {
    var P = ctx.p, S = ctx.session, status = 0, all = allCommandInfos(S);
    var types = P.CommandType ? String(P.CommandType).toLowerCase().split(',') : null;
    var names = P.Name ? P.Name : null, out = [];
    if (!names) names = ['*'];
    names.forEach(function (n) {
      if (n === null) return;
      var re = wildRegex(String(n));
      var hit = all.filter(function (o) { return re.test(strOf(o.get('Name'))) || (o.get('CommandType') === 'Application' && re.test(strOf(o.get('Name')).replace(/\.(exe|com|cmd)$/i, ''))); });
      if (types) hit = hit.filter(function (o) { return types.indexOf(String(o.get('CommandType')).toLowerCase()) >= 0; });
      if (!hit.length && !hasWild(String(n)) && !P.ListImported) {
        status = 1;
        ctx.fail({ msg: "無法辨識 '" + n + "' 詞彙是否為 Cmdlet、函數、指令檔或可執行程式的名稱。請檢查名稱拼字是否正確，如果包含路徑的話，請確認路徑是否正確，然後再試一次。", cat: 'ObjectNotFound', target: String(n), ttype: 'String', activity: 'Get-Command', reason: 'CommandNotFoundException', fq: 'CommandNotFoundException,' + CORE + 'GetCommandCommand' });
        return;
      }
      hit.forEach(function (o) { if (out.indexOf(o) < 0) out.push(o); });
    });
    var rank = { Alias: 0, Function: 1, Cmdlet: 2, Application: 3 };
    out.sort(function (a, b) { return (rank[a.get('CommandType')] - rank[b.get('CommandType')]) || ntfsCmp(strOf(a.get('Name')), strOf(b.get('Name'))); });
    if (P.TotalCount !== undefined) out = out.slice(0, Number(P.TotalCount));
    ctx.emit(out);
    return status;
  }
  SPEC.gal = { name: 'Get-Alias', cls: CORE + 'GetAliasCommand', params: [val('Name', { pos: 0, arr: true, type: T_ARR }), val('Exclude', { arr: true, type: T_ARR }), val('Scope', { type: T_STR }), val('Definition', { arr: true, type: T_ARR })] };
  function cmdGetAlias(ctx) {
    var P = ctx.p, S = ctx.session, status = 0, rows = [];
    Object.keys(ALIASES).forEach(function (k) { rows.push(ALIASES[k]); });
    Object.keys(S.aliases).forEach(function (k) { rows.push({ name: k, def: S.aliases[k], version: '', source: '' }); });
    rows.sort(function (a, b) { return ntfsCmp(a.name, b.name); });
    var out = rows;
    if (P.Definition) { var dres = P.Definition.map(function (d) { return wildRegex(String(d)); }); out = rows.filter(function (r) { return dres.some(function (re) { return re.test(r.def); }); }); }
    else if (P.Name) {
      out = [];
      P.Name.forEach(function (n) {
        var re = wildRegex(String(n)), hit = rows.filter(function (r) { return re.test(r.name); });
        if (!hit.length && !hasWild(String(n))) { status = 1; ctx.fail({ msg: "因為具有 name '" + n + "' 的別名不存在，所以這個命令找不到相符的別名。", cat: 'ObjectNotFound', target: String(n), ttype: 'String', activity: 'Get-Alias', reason: 'ItemNotFoundException', fq: 'ItemNotFoundException,' + CORE + 'GetAliasCommand' }); return; }
        hit.forEach(function (r) { out.push(r); });
      });
    }
    ctx.emit(out.map(function (r) { var o = aliasObj(r.name, r.def); if (r.version) { o.set('Version', r.version); o.set('Source', r.source); } return o; }));
    return status;
  }

  /* ---- Get-Help (the form Windows PowerShell 5.1 prints when no help files are installed, plus our own -Examples) */
  var TYPE_SHORT = { 'System.String[]': 'string[]', 'System.String': 'string', 'System.Int32': 'int', 'System.Int64': 'long', 'System.UInt32': 'uint32', 'System.Object': 'Object', 'System.Object[]': 'Object[]', 'System.Boolean': 'bool', 'System.DateTime': 'datetime',
    'System.Char': 'char', 'System.Int32[]': 'int[]', 'System.Management.Automation.ScriptBlock': 'scriptblock', 'System.Management.Automation.ScriptBlock[]': 'scriptblock[]', 'System.Management.Automation.PSCredential': 'pscredential' };
  function typeShortName(t) { return t ? (hasOwn.call(TYPE_SHORT, t) ? TYPE_SHORT[t] : t.replace(/^.*\./, '')) : 'string'; }
  function syntaxOf(spec) {
    var ps = spec.params.filter(function (p) { return !p.dyn; });
    var pos = ps.filter(function (p) { return p.pos !== undefined && !p.sw; }).sort(function (a, b) { return a.pos - b.pos; });
    var named = ps.filter(function (p) { return p.pos === undefined || p.sw; });
    var parts = [];
    pos.forEach(function (p) { parts.push(p.mand ? '[-' + p.n + '] <' + typeShortName(p.type) + '>' : '[[-' + p.n + '] <' + typeShortName(p.type) + '>]'); });
    named.forEach(function (p) {
      if (p.sw) parts.push('[-' + p.n + ']');
      else parts.push(p.mand ? '-' + p.n + ' <' + typeShortName(p.type) + '>' : '[-' + p.n + ' <' + typeShortName(p.type) + '>]');
    });
    if (spec.risk) parts.push('[-WhatIf]', '[-Confirm]');
    return spec.name + ' ' + parts.join(' ') + '  [<CommonParameters>]';
  }
  var HELP_LINK = { 'get-childitem': 113308, 'get-content': 113310, 'get-date': 113313, 'get-item': 113319, 'get-location': 113321, 'get-process': 113324, 'get-service': 113332, 'set-location': 113397, 'new-item': 113353, 'remove-item': 113373,
    'copy-item': 113292, 'move-item': 113350, 'rename-item': 113382, 'select-object': 113387, 'sort-object': 113403, 'where-object': 113423, 'foreach-object': 113300, 'measure-object': 113349, 'group-object': 113338, 'import-csv': 113341,
    'export-csv': 113299, 'format-table': 113303, 'format-list': 113302, 'out-file': 113363, 'select-string': 113388, 'test-path': 113418, 'start-process': 113422, 'stop-process': 113412, 'get-command': 113309, 'get-help': 113316, 'get-alias': 113306, 'get-history': 113317 };
  var HELP_EXAMPLES = {
    'get-childitem': [['Get-ChildItem', '列出現在這個資料夾裡的東西（也可以寫成 ls、dir）。'], ['Get-ChildItem -Recurse -Filter *.csv', '連裡面的資料夾也找，只列出 .csv 檔。'], ['Get-ChildItem -Name', '只列出名字，不要表格。']],
    'set-location': [['Set-Location ~\\Desktop', '走到桌面（也可以寫成 cd）。'], ['Set-Location ..', '往外走一層。']],
    'get-content': [['Get-Content notes.txt', '顯示檔案內容（也可以寫成 cat）。'], ['Get-Content data\\A.csv -Head 5', '只看前 5 行。'], ['Get-Content notes.txt -Tail 3', '只看最後 3 行。']],
    'copy-item': [['Copy-Item notes.txt backup.txt', '複製一個檔案。'], ['Copy-Item data data2 -Recurse', '連同裡面的東西一起複製整個資料夾。']],
    'move-item': [['Move-Item week3.zip ~\\Desktop\\Project', '把檔案搬到另一個資料夾；目的地不存在時會變成改名。']],
    'remove-item': [['Remove-Item notes.txt', '刪除檔案（不會進資源回收筒）。'], ['Remove-Item data -Recurse', '刪除資料夾和裡面所有東西。']],
    'new-item': [['New-Item notes.txt -ItemType File', '建立空的文字檔。'], ['New-Item figures -ItemType Directory', '建立資料夾（也可以寫成 mkdir）。']],
    'get-date': [['Get-Date', '顯示現在的日期和時間。'], ['Get-Date -Format "yyyy-MM-dd"', '只顯示 2026-10-02 這種格式。']],
    'sort-object': [['Import-Csv data\\A.csv | Sort-Object score', '把成績依 score 排序（注意：CSV 讀進來都是文字，100 會排在 61 前面）。'], ['ls | Sort-Object Length -Descending', '依檔案大小從大排到小。']],
    'where-object': [['ls | Where-Object { $_.Length -gt 1000 }', '只留下大於 1000 位元組的檔案。'], ['Import-Csv data\\A.csv | Where-Object { [int]$_.score -ge 90 }', '先把 score 轉成數字再比，只留 90 分以上。']],
    'select-object': [['ls | Select-Object Name, Length', '只挑出 Name 和 Length 兩欄。'], ['Import-Csv data\\A.csv | Select-Object -Last 3', '只看最後 3 筆。']],
    'measure-object': [['Import-Csv data\\A.csv | Measure-Object score -Average', '算 score 的平均。'], ['Get-Content notes.txt | Measure-Object -Line -Word -Character', '算行數、字數、字元數。']],
    'group-object': [['ls | Group-Object Extension', '依副檔名分組，數每一組有幾個。']],
    'foreach-object': [['1..5 | ForEach-Object { $_ * 2 }', '每個數字乘以 2。'], ['ls | ForEach-Object { $_.Name }', '只印出每個檔案的名字。']],
    'select-string': [['Select-String -Path *.csv -Pattern "A00"', '在 .csv 檔裡找含有 A00 的行（類似 grep）。']],
    'import-csv': [['Import-Csv data\\A.csv', '把 CSV 讀進來，每一行變成一個物件。']],
    'export-csv': [['ls | Select-Object Name, Length | Export-Csv files.csv -NoTypeInformation', '把檔案清單存成 CSV。']],
    'get-process': [['Get-Process', '列出現在的處理序（程式）。'], ['Get-Process notepad', '只看記事本。']],
    'stop-process': [['Stop-Process -Name notepad', '把記事本關掉。']],
    'get-service': [['Get-Service', '列出 Windows 的服務。']],
    'out-file': [['ls | Out-File list.txt', '把 ls 的結果存成檔案（和 ls > list.txt 一樣）。']],
    'test-path': [['Test-Path notes.txt', '檢查檔案存不存在，回答 True 或 False。']],
    'start-process': [['Start-Process notepad', '開啟記事本。'], ['Start-Process https://example.com', '用 Edge 開網址。']],
    'compress-archive': [['Compress-Archive -Path data -DestinationPath data.zip', '把 data 資料夾壓縮成 data.zip。']],
    'expand-archive': [['Expand-Archive week3.zip -DestinationPath out', '把 zip 解壓縮到 out 資料夾。']],
    'get-filehash': [['Get-FileHash week3.zip', '算檔案的 SHA256 雜湊值（內容一樣，值就一樣）。']]
  };
  SPEC.gethelp = { name: 'Get-Help', cls: CORE + 'GetHelpCommand', params: [val('Name', { pos: 0, type: T_STR }), val('Path', { type: T_STR }), val('Category', { arr: true, type: T_ARR }), val('Component', { arr: true, type: T_ARR }),
    val('Functionality', { arr: true, type: T_ARR }), val('Role', { arr: true, type: T_ARR }), sw('Detailed'), sw('Full'), sw('Examples'), val('Parameter', { type: T_STR }), sw('Online'), sw('ShowWindow')] };
  function resolveHelpName(name, S) {
    var l = String(name).toLowerCase();
    if (hasOwn.call(ALIASES, l)) l = ALIASES[l].def.toLowerCase();
    if (S.aliases && hasOwn.call(S.aliases, l)) l = String(S.aliases[l]).toLowerCase();
    var d = hasOwn.call(CMDS, l) ? CMDS[l] : null;
    return d && d.spec ? d : null;
  }
  function aliasesOfCmdlet(full) { var out = []; Object.keys(ALIASES).forEach(function (k) { if (ALIASES[k].def.toLowerCase() === full.toLowerCase()) out.push(ALIASES[k].name); }); return out.sort(function (a, b) { return a.length - b.length || (a < b ? -1 : 1); }); }
  function cmdGetHelp(ctx) {
    var P = ctx.p, S = ctx.session;
    if (P.Name === undefined || P.Name === null) { ctx.out(HELP_TEXT); return 0; }
    var d = resolveHelpName(P.Name, S);
    if (!d && hasOwn.call(HELP_ONE, String(P.Name).toLowerCase())) { ctx.out('\n' + HELP_ONE[String(P.Name).toLowerCase()] + '\n\n'); return 0; }
    if (!d) {
      return ctx.fail({ msg: 'Get-Help 在此工作階段的說明檔中找不到 ' + P.Name + '。若要下載更新的說明主題，請輸入: "Update-Help"。若要線上取得說明，請搜尋 TechNet Library (網址為 https:/go.microsoft.com/fwlink/?LinkID=107116) 中的說明主題。',
        cat: 'ResourceUnavailable', target: '', activity: 'Get-Help', reason: 'HelpNotFoundException', fq: 'HelpNotFound,' + CORE + 'GetHelpCommand' });
    }
    var spec = d.spec, nm = spec.name, key = nm.toLowerCase();
    if (P.Online) {
      var url = 'https://learn.microsoft.com/powershell/module/' + (CMDLET_MODULE[key] ? CMDLET_MODULE[key].module.toLowerCase() : 'microsoft.powershell.core') + '/' + key;
      ctx.effect({ type: 'url', url: url });
      return 0;
    }
    var link = hasOwn.call(HELP_LINK, key) ? HELP_LINK[key] : 113316, al = aliasesOfCmdlet(nm);
    var lines = [''];
    lines.push('名稱', '    ' + nm, '    ');
    if (P.Examples && hasOwn.call(HELP_EXAMPLES, key)) {
      lines.push('範例');
      HELP_EXAMPLES[key].forEach(function (ex, i) {
        lines.push('    -------------------------- 範例 ' + (i + 1) + ' --------------------------', '', '    PS C:\\>' + ex[0], '    ', '    ' + ex[1], '    ');
      });
      lines.push('');
      ctx.out(lines.join('\n') + '\n');
      return 0;
    }
    lines.push('語法', '    ' + syntaxOf(spec), '    ', '');
    lines.push('別名', '    ' + (al.length ? al.join('\n    ') : '無'), '    ', '');
    lines.push('註解', '    Get-Help 在此電腦上找不到此 cmdlet 的說明檔案。它只顯示部分說明。', '        -- 若要下載並安裝包含此 cmdlet 之模組的說明檔案，請使用 Update-Help。',
      '        -- 若要線上檢視此 cmdlet 的說明主題，請輸入: "Get-Help ' + nm + ' -Online" 或', '           移至 https://go.microsoft.com/fwlink/?LinkID=' + link + '。');
    if (hasOwn.call(HELP_EXAMPLES, key)) lines.push('        -- 這個練習版另外附了範例，請輸入: "Get-Help ' + nm + ' -Examples"。');
    ctx.out(lines.join('\n') + '\n\n\n\n');
    return 0;
  }

  defCmd({ id: 'date', canon: 'unknown', spec: SPEC.date, run: cmdGetDate, nopaths: true }, ['Get-Date']);
  defCmd({ id: 'gps', canon: 'sys', spec: SPEC.gps, run: cmdGetProcess, nopaths: true }, ['Get-Process', 'gps', 'ps']);
  defCmd({ id: 'spps', canon: 'sys', spec: SPEC.spps, run: cmdStopProcess, nopaths: true }, ['Stop-Process', 'spps', 'kill']);
  defCmd({ id: 'gsv', canon: 'sys', spec: SPEC.gsv, run: cmdGetService, nopaths: true }, ['Get-Service', 'gsv']);
  defCmd({ id: 'gcinfo', canon: 'sys', spec: SPEC.gci2, run: cmdGetComputerInfo, nopaths: true }, ['Get-ComputerInfo', 'gin']);
  defCmd({ id: 'systeminfo', canon: 'sys', native: true, name: 'systeminfo', run: cmdSysteminfo, nopaths: true }, ['systeminfo']);
  defCmd({ id: 'tasklist', canon: 'sys', native: true, name: 'tasklist', run: cmdTasklist, nopaths: true }, ['tasklist']);
  defCmd({ id: 'taskkill', canon: 'sys', native: true, name: 'taskkill', run: cmdTaskkill, nopaths: true }, ['taskkill']);
  defCmd({ id: 'gcm', canon: 'help', spec: SPEC.gcm, run: cmdGetCommand, nopaths: true }, ['Get-Command', 'gcm']);
  defCmd({ id: 'gal', canon: 'help', spec: SPEC.gal, run: cmdGetAlias, nopaths: true }, ['Get-Alias', 'gal']);
  defCmd({ id: 'help', canon: 'help', spec: SPEC.gethelp, run: cmdGetHelp, nopaths: true }, ['Get-Help']);
  defCmd({ id: 'helpfn', canon: 'help', native: true, name: 'help', run: cmdHelp, nopaths: true }, ['help', 'man']);

  /* ====================================================================================================================
     Round 5 — network (all fake, nothing leaves the page): ipconfig, ping, Test-Connection, nslookup, tracert, Invoke-WebRequest / curl,
     Invoke-RestMethod, winget. Numbers follow SPEC section 1: Wi-Fi NTNU-Classroom, IPv4 10.20.31.57 / 255.255.255.0 / gateway 10.20.31.1 / DNS 10.20.0.53.
     ==================================================================================================================== */
  function sysInfo(key, dflt) {
    try { var i = LAB.sys && LAB.sys.info; if (i && i[key] !== undefined && i[key] !== null && i[key] !== '') return i[key]; } catch (e) { /* fall back */ }
    return dflt;
  }
  function macPlus(mac, n, firstXor) {
    var b = String(mac).split('-');
    if (b.length !== 6) return mac;
    var last = (parseInt(b[5], 16) + n) & 255;
    b[5] = ('0' + last.toString(16)).slice(-2).toUpperCase();
    if (firstXor) b[0] = ('0' + (parseInt(b[0], 16) ^ firstXor).toString(16)).slice(-2).toUpperCase();
    return b.join('-');
  }
  var NET = { ipv6: 'fe80::7c3e:9a1d:5b42:8e6f%12' };
  [['ip', 'IP', '10.20.31.57'], ['mask', 'MASK', '255.255.255.0'], ['gw', 'GATEWAY', '10.20.31.1'], ['dns', 'DNS', '10.20.0.53'], ['mac', 'MAC', 'A4-6B-B6-3E-91-C2'], ['adapter', 'ADAPTER', 'Intel(R) Wi-Fi 6E AX211 160MHz']].forEach(function (k) {
    Object.defineProperty(NET, k[0], { enumerable: true, get: function () { return sysInfo(k[1], k[2]); } });
  });
  function ipLine(label, value) { return '   ' + label + (value === undefined ? '' : value); }
  var L_ = {
    dnsSuffix: '連線特定 DNS 尾碼 . . . . . . . . : ', media: '媒體狀態 . . . . . . . . . . . . .: ', desc: '描述 . . . . . . . . . . . . . . .: ', mac: '實體位址 . . . . . . . . . . . . .: ',
    dhcp: 'DHCP 已啟用 . . . . . . . . . . . : ', auto: '自動設定啟用 . . . . . . . . . . .: ', ll6: '連結-本機 IPv6 位址 . . . . . . . : ', ip4: 'IPv4 位址 . . . . . . . . . . . . : ',
    mask: '子網路遮罩 . . . . . . . . . . . .: ', lease1: '租用取得 . . . . . . . . . . . . .: ', lease2: '租用到期 . . . . . . . . . . . . .: ', gw: '預設閘道 . . . . . . . . . . . . .: ',
    dhcpSrv: 'DHCP 伺服器 . . . . . . . . . . . : ', iaid: 'DHCPv6 IAID . . . . . . . . . . . : ', duid: 'DHCPv6 用戶端 DUID. . . . . . . . : ', dnsSrv: 'DNS 伺服器 . . . . . . . . . . . .: ', netbios: 'NetBIOS over Tcpip . . . . . . . .: '
  };
  function longDate(ms) { var d = new Date(ms); return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + dLongTime(d); }
  function cmdIpconfig(ctx) {
    var args = ctx.rawArgs.map(function (a) { return String(a).toLowerCase(); }), all = args.indexOf('/all') >= 0;
    if (args.indexOf('/?') >= 0 || args.indexOf('-?') >= 0) {
      ctx.out('\n使用方式:\n    ipconfig [/allcompartments] [/? | /all |\n                                 /renew [adapter] | /release [adapter] |\n                                 /renew6 [adapter] | /release6 [adapter] |\n                                 /flushdns | /displaydns | /registerdns |\n                                 /showclassid adapter |\n                                 /setclassid adapter [classid] |\n                                 /showclassid6 adapter |\n                                 /setclassid6 adapter [classid] ]\n\n其中\n    adapter             連線名稱\n                       (允許萬用字元 * 和 ?，請參閱範例)\n');
      return 0;
    }
    if (args.indexOf('/flushdns') >= 0) { ctx.out('\nWindows IP 設定\n\n已成功清除 DNS 解析程式快取。\n'); return 0; }
    if (args.indexOf('/release') >= 0 || args.indexOf('/renew') >= 0) { ctx.native('\n作業失敗: 練習版的電腦不能重新取得 IP 位址。\n'); return 1; }
    var lines = ['', 'Windows IP 設定', ''];
    if (all) {
      lines.push(ipLine('主機名稱 . . . . . . . . . . . . .: ' + HOST), ipLine('主要 DNS 尾碼  . . . . . . . . . .: '), ipLine('節點類型 . . . . . . . . . . . . .: 混合式'), ipLine('IP 路由啟用 . . . . . . . . . . . : 否'), ipLine('WINS Proxy 啟用 . . . . . . . . . : 否'));
    }
    function down(name, kind, descr, mac) {
      lines.push('', kind + ' ' + name + ':', '');
      lines.push(ipLine(L_.media + '媒體已中斷連線'), ipLine(L_.dnsSuffix));
      if (all) lines.push(ipLine(L_.desc + descr), ipLine(L_.mac + mac), ipLine(L_.dhcp + '是'), ipLine(L_.auto + '是'));
    }
    down('區域連線* 1', '無線區域網路介面卡', 'Microsoft Wi-Fi Direct Virtual Adapter', macPlus(NET.mac, 1));
    down('區域連線* 2', '無線區域網路介面卡', 'Microsoft Wi-Fi Direct Virtual Adapter #2', macPlus(NET.mac, 0, 2));
    lines.push('', '無線區域網路介面卡 Wi-Fi:', '');
    lines.push(ipLine(L_.dnsSuffix));
    if (all) lines.push(ipLine(L_.desc + NET.adapter), ipLine(L_.mac + NET.mac), ipLine(L_.dhcp + '是'), ipLine(L_.auto + '是'));
    lines.push(ipLine(L_.ll6 + NET.ipv6 + (all ? '(偏好選項) ' : '')), ipLine(L_.ip4 + NET.ip + (all ? '(偏好選項) ' : '')), ipLine(L_.mask + NET.mask));
    if (all) lines.push(ipLine(L_.lease1 + longDate(new Date(2026, 9, 2, 8, 41, 7).getTime())), ipLine(L_.lease2 + longDate(new Date(2026, 9, 2, 10, 41, 6).getTime())));
    lines.push(ipLine(L_.gw + NET.gw));
    if (all) lines.push(ipLine(L_.dhcpSrv + NET.gw), ipLine(L_.iaid + '110520244'), ipLine(L_.duid + '00-01-00-01-30-8F-4C-21-' + NET.mac), ipLine(L_.dnsSrv + NET.dns), ipLine(L_.netbios + '啟用'));
    lines.push('', '乙太網路卡 藍牙網路連線:', '');
    lines.push(ipLine(L_.media + '媒體已中斷連線'), ipLine(L_.dnsSuffix));
    if (all) lines.push(ipLine(L_.desc + 'Bluetooth Device (Personal Area Network)'), ipLine(L_.mac + macPlus(NET.mac, 4)), ipLine(L_.dhcp + '是'), ipLine(L_.auto + '是'));
    ctx.out(lines.join('\n') + '\n');
    return 0;
  }

  /* ---- fake name resolution and latency */
  var KNOWN_HOSTS = { 'example.com': '93.184.216.34', 'www.example.com': '93.184.216.34', 'google.com': '142.250.185.78', 'www.google.com': '142.250.185.100', 'github.com': '20.27.177.113', 'ntnu.edu.tw': '140.122.64.22',
    'www.ntnu.edu.tw': '140.122.64.22', 'openai.com': '104.18.33.45', 'microsoft.com': '20.70.246.20', 'python.org': '151.101.0.223', 'www.python.org': '151.101.0.223', 'baidu.com': '110.242.68.66' };
  function hashIp(name) {
    var h = 5381;
    for (var i = 0; i < name.length; i++) h = ((h * 33) ^ name.charCodeAt(i)) >>> 0;
    return [93 + (h % 120), 1 + ((h >>> 8) % 250), 1 + ((h >>> 16) % 250), 1 + ((h >>> 24) % 250)].join('.');
  }
  /* -> {name, ip, ttl, ms (base latency), kind:'loop'|'lan'|'wan'|'dead'} or null when the name does not exist */
  function resolveHost(host) {
    var h = String(host).toLowerCase().replace(/\.$/, '');
    if (h === 'localhost') return { name: HOST, ip: '::1', ttl: 128, ms: 0, kind: 'loop6' };
    if (h === '127.0.0.1' || h === HOST.toLowerCase() || h === NET.ip) return { name: null, ip: h === HOST.toLowerCase() ? NET.ip : h, ttl: 128, ms: 0, kind: 'loop' };
    if (h === NET.gw) return { name: null, ip: h, ttl: 64, ms: 2, kind: 'lan' };
    if (h === NET.dns) return { name: null, ip: h, ttl: 64, ms: 3, kind: 'lan' };
    var m = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(h);
    if (m) {
      var a = +m[1], b = +m[2];
      if (+m[1] > 255 || +m[2] > 255 || +m[3] > 255 || +m[4] > 255) return null;
      if (a === 10 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b < 32) || a === 169) return { name: null, ip: h, ttl: 0, ms: 0, kind: 'dead' };
      return { name: null, ip: h, ttl: 117, ms: 13, kind: 'wan' };
    }
    if (hasOwn.call(KNOWN_HOSTS, h)) return { name: h, ip: KNOWN_HOSTS[h], ttl: 117, ms: 13, kind: 'wan' };
    if (h.indexOf('.') > 0 && /^[a-z0-9.-]+$/.test(h) && !/\.(invalid|test|example|localhost)$/.test(h)) return { name: h, ip: hashIp(h), ttl: 117, ms: 13, kind: 'wan' };
    return null;
  }
  function pingMs(r, i) { if (r.kind === 'loop' || r.kind === 'loop6') return 0; return r.ms + Math.floor(jitter(i + 7, r.ip.length * 13 + i) * (r.kind === 'wan' ? 5 : 2)); }
  function msText(ms, sep) { return ms === 0 ? '<1' + sep : ms + sep; }
  function* cmdPing(ctx) {
    var args = ctx.rawArgs.map(String), count = 4, forever = false, size = 32, wait = 4000, target = null;
    for (var i = 0; i < args.length; i++) {
      var a = args[i], al = a.toLowerCase();
      if (al === '-t' || al === '/t') forever = true;
      else if (al === '-n' || al === '/n') { var nv = args[++i]; if (!/^\d+$/.test(String(nv)) || +nv < 1 || +nv > 4294967295) { ctx.native('選項 -n 的值不正確，有效範圍是從 1 到 4294967295。\n'); return 1; } count = Math.min(100, +nv); }
      else if (al === '-l' || al === '/l') { var lv = args[++i]; if (!/^\d+$/.test(String(lv)) || +lv > 65500) { ctx.native('選項 -l 的值不正確，有效範圍是從 0 到 65500。\n'); return 1; } size = +lv; }
      else if (al === '-w' || al === '/w') wait = parseInt(args[++i], 10) || 4000;
      else if (al === '-i' || al === '-v' || al === '-s' || al === '-r' || al === '-j' || al === '-k' || al === '-S'.toLowerCase() || al === '-c') i++;
      else if (/^[-\/]\?$/.test(a)) { target = '?'; }
      else if (al === '-a' || al === '-f' || al === '-4' || al === '-6' || al === '-r' || al === '-p' || al === '/a' || al === '/f') { /* accepted */ }
      else if (a.charAt(0) === '-' && a.length > 1 && /^-[A-Za-z]$/.test(a)) { ctx.native('不正確的選項 ' + a + '。\n'); return 1; }
      else target = a;
    }
    if (target === '?') {
      ctx.out('\n使用方式: ping [-t] [-a] [-n count] [-l size] [-f] [-i TTL] [-v TOS]\n            [-r count] [-s count] [[-j host-list] | [-k host-list]]\n            [-w timeout] [-R] [-S srcaddr] [-c compartment] [-p]\n            [-4] [-6] target_name\n\n選項:\n    -t             Ping 指定的主機，直到停止。\n                   若要查看統計資料並繼續，請按 Control-Break;\n                   若要停止，請按 Control-C。\n    -a             將位址解析為主機名稱。\n    -n count       要傳送的回應要求數目。\n    -l size        傳送緩衝區大小。\n    -w timeout     每個回覆的等候逾時 (單位為毫秒)。\n    -4             強制使用 IPv4。\n    -6             強制使用 IPv6。\n');
      return 0;
    }
    if (target === null) { ctx.out('\n使用方式: ping [-t] [-a] [-n count] [-l size] [-f] [-i TTL] [-v TOS]\n            [-r count] [-s count] [[-j host-list] | [-k host-list]]\n            [-w timeout] [-R] [-S srcaddr] [-c compartment] [-p]\n            [-4] [-6] target_name\n'); return 1; }
    var r = resolveHost(target);
    if (!r) { ctx.out('Ping 要求找不到主機 ' + target + '。請檢查名稱，然候再試一次。\n'); return 1; }
    var shown = r.kind === 'loop6' ? 'Ping ' + r.name + ' [::1]' : (r.name && r.name !== r.ip ? 'Ping ' + target + ' [' + r.ip + ']' : 'Ping ' + r.ip);
    ctx.out('\n' + shown + ' (使用 ' + size + ' 位元組的資料):\n');
    var sent = 0, got = 0, times = [], done = false;
    try {
      while (sent < count || forever) {
        if (sent > 0) yield { sleep: r.kind === 'dead' ? 600 : 1000 };
        sent++;
        if (r.kind === 'dead') { ctx.out('要求等候逾時。\n'); continue; }
        var ms = pingMs(r, sent);
        got++; times.push(ms);
        if (r.kind === 'loop6') ctx.out('回覆自 ::1: 時間<1ms\n');
        else ctx.out('回覆自 ' + r.ip + ': 位元組=' + size + ' 時間' + (ms === 0 ? '<1ms' : '=' + ms + 'ms') + ' TTL=' + r.ttl + '\n');
      }
      done = true;
    } finally {
      var lost = sent - got;
      var stat = '\n' + r.ip + ' 的 Ping 統計資料:\n    封包: 已傳送 = ' + sent + '，已收到 = ' + got + ', 已遺失 = ' + lost + ' (' + Math.round(lost * 100 / Math.max(1, sent)) + '% 遺失)，\n';
      if (got) stat += '大約的來回時間 (毫秒):\n    最小值 = ' + Math.min.apply(null, times) + 'ms，最大值 = ' + Math.max.apply(null, times) + 'ms，平均 = ' + Math.round(times.reduce(function (x, y) { return x + y; }, 0) / got) + 'ms\n';
      ctx.out(stat);
      if (!done) ctx.out('Control-C\n');
    }
    return got ? 0 : 1;
  }

  SPEC.testconn = { name: 'Test-Connection', cls: CORE + 'TestConnectionCommand', params: [val('ComputerName', { pos: 0, mand: true, arr: true, type: T_ARR, al: ['CN', 'IPAddress', '__SERVER', 'Server', 'Destination'] }), val('Count', { type: 'System.Int32' }),
    val('BufferSize', { type: 'System.Int32', al: ['Size', 'Bytes', 'BS'] }), sw('Quiet'), val('Delay', { type: 'System.Int32' }), val('TimeToLive', { type: 'System.Int32', al: ['TTL'] }), sw('AsJob'), val('Source', { arr: true, type: T_ARR })] };
  function* cmdTestConnection(ctx) {
    var P = ctx.p, count = P.Count !== undefined ? Number(P.Count) : 4, status = 0, all = true;
    for (var ti = 0; ti < P.ComputerName.length; ti++) {
      var target = P.ComputerName[ti], r = resolveHost(target);
      if (!r) {
        status = 1;
        if (P.Quiet) { ctx.emitOne(false); continue; }
        ctx.fail({ msg: "測試與 '" + target + "' 電腦的連線失敗: 無法識別這台主機。", cat: 'ResourceUnavailable', target: target, ttype: 'String', activity: 'Test-Connection', reason: 'PingException', fq: 'TestConnectionException,' + CORE + 'TestConnectionCommand' });
        continue;
      }
      var oks = 0, rows = [];
      for (var i = 0; i < count; i++) {
        if (i > 0) yield { sleep: 600 };
        if (r.kind === 'dead') {
          continue;
        }
        oks++;
        rows.push(new PSObj('System.Management.ManagementObject#root\\cimv2\\Win32_PingStatus', [['Source', HOST], ['Destination', target], ['IPV4Address', r.ip.indexOf(':') >= 0 ? '127.0.0.1' : r.ip], ['IPV6Address', ''], ['Bytes', P.BufferSize ? Number(P.BufferSize) : 32], ['Time(ms)', pingMs(r, i + 1)]], { fmt: 'pingstatus' }));
      }
      if (P.Quiet) { ctx.emitOne(oks > 0); continue; }
      if (!oks) {
        status = 1;
        ctx.fail({ msg: "測試與 '" + target + "' 電腦的連線失敗: 要求等候逾時。", cat: 'ResourceUnavailable', target: target, ttype: 'String', activity: 'Test-Connection', reason: 'PingException', fq: 'TestConnectionException,' + CORE + 'TestConnectionCommand' });
        continue;
      }
      ctx.emit(rows);
    }
    return status;
  }
  SPECIAL_VIEWS.pingstatus = function (group) {
    var lines = ['Source        Destination     IPV4Address      IPV6Address                              Bytes    Time(ms) ', '------        -----------     -----------      -----------                              -----    -------- '];
    group.forEach(function (o) { lines.push(rtrim(padR(strOf(o.get('Source')), 14) + padR(strOf(o.get('Destination')), 16) + padR(strOf(o.get('IPV4Address')), 17) + padR(strOf(o.get('IPV6Address')), 41) + padR(strOf(o.get('Bytes')), 9) + strOf(o.get('Time(ms)')))); });
    return '\n' + lines.join('\n') + '\n\n\n';
  };

  function cmdNslookup(ctx) {
    var args = ctx.rawArgs.map(String).filter(function (a) { return a.charAt(0) !== '-' && a.charAt(0) !== '/'; });
    if (!args.length) { ctx.native('練習版的 nslookup 只能一次查一個名稱，例如 nslookup example.com。\n'); return 1; }
    var name = args[0], r = resolveHost(name);
    ctx.out('伺服器:  UnKnown\nAddress:  ' + NET.dns + '\n\n');
    if (!r || (r.kind === 'dead')) { ctx.native('*** UnKnown 找不到 ' + name + ': Non-existent domain\n'); return 1; }
    if (r.kind === 'loop6' || r.kind === 'loop') { ctx.out('名稱:    localhost\nAddresses:  ::1\n\t  127.0.0.1\n\n'); return 0; }
    if (!r.name) { ctx.out('名稱:    ' + (r.ip === NET.gw ? 'gateway.local' : 'host.local') + '\nAddress:  ' + r.ip + '\n\n'); return 0; }
    ctx.out('未經授權的回答:\n名稱:    ' + r.name + '\nAddress:  ' + r.ip + '\n\n');
    return 0;
  }

  function* cmdTracert(ctx) {
    var args = ctx.rawArgs.map(String), noName = false, maxHops = 30, target = null;
    for (var i = 0; i < args.length; i++) {
      var al = args[i].toLowerCase();
      if (al === '-d') noName = true; else if (al === '-h') maxHops = parseInt(args[++i], 10) || 30; else if (al === '-w' || al === '-j' || al === '-s' || al === '-R'.toLowerCase()) i++; else if (args[i].charAt(0) !== '-') target = args[i];
    }
    if (target === null) { ctx.out('\n使用方式: tracert [-d] [-h maximum_hops] [-j host-list] [-w timeout]\n               [-R] [-S srcaddr] [-4] [-6] target_name\n'); return 1; }
    var r = resolveHost(target);
    if (!r) { ctx.out('無法解析目標系統名稱 ' + target + '。\n'); return 1; }
    var named = r.name && r.name !== r.ip && !noName;
    ctx.out('\n' + (named ? '在上限 ' + maxHops + ' 個躍點上\n追蹤 ' + target + ' [' + r.ip + '] 的路由:\n' : '在上限 ' + maxHops + ' 個躍點上追蹤 ' + r.ip + ' 的路由\n') + '\n');
    var hops = r.kind === 'loop' || r.kind === 'loop6' ? [[0, r.ip]] : (r.kind === 'lan' ? [[2, r.ip]] : [[2, NET.gw], [3, '10.20.0.1'], [5, '203.64.100.1'], [7, '203.64.100.9'], [9, '211.72.10.1'], [null, null], [12, '168.95.0.1'], [r.ms + 1, r.ip]]);
    for (var h = 0; h < hops.length && h < maxHops; h++) {
      yield { sleep: 350 };
      var hp = hops[h], n = h + 1;
      if (hp[0] === null) { ctx.out(padL(String(n), 3) + '     *        *        *     要求等候逾時。\n'); continue; }
      var t = [0, 1, 2].map(function (k) { var v = hp[0] === 0 ? 0 : Math.max(1, hp[0] + Math.floor(jitter(n * 3 + k, n) * 3) - 1); return padL(v === 0 ? '<1 ms' : v + ' ms', 9); });
      ctx.out(padL(String(n), 3) + t.join('') + '  ' + hp[1] + ' \n');
    }
    ctx.out('\n追蹤完成。\n');
    return 0;
  }

  /* ---- web: Invoke-WebRequest (curl), Invoke-RestMethod, curl.exe */
  var EXAMPLE_HTML = '<!doctype html>\n<html>\n<head>\n    <title>Example Domain</title>\n\n    <meta charset="utf-8" />\n    <meta http-equiv="Content-type" content="text/html; charset=utf-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1" />\n' +
    '    <style type="text/css">\n    body {\n        background-color: #f0f0f2;\n        margin: 0;\n        padding: 0;\n        font-family: -apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", "Open Sans", "Helvetica Neue", Helvetica, Arial, sans-serif;\n        \n    }\n' +
    '    div {\n        width: 600px;\n        margin: 5em auto;\n        padding: 2em;\n        background-color: #fdfdff;\n        border-radius: 0.5em;\n        box-shadow: 2px 3px 7px 2px rgba(0,0,0,0.02);\n    }\n    a:link, a:visited {\n        color: #38488f;\n        text-decoration: none;\n    }\n    @media (max-width: 700px) {\n        div {\n            margin: 0 auto;\n            width: auto;\n        }\n    }\n    </style>    \n</head>\n\n' +
    '<body>\n<div>\n    <h1>Example Domain</h1>\n    <p>This domain is for use in illustrative examples in documents. You may use this\n    domain in literature without prior coordination or asking for permission.</p>\n    <p><a href="https://www.iana.org/domains/example">More information...</a></p>\n</div>\n</body>\n</html>\n';
  function offlineHtml(url) {
    return '<!doctype html>\n<html>\n<head>\n    <meta charset="utf-8" />\n    <title>練習版範例網頁</title>\n</head>\n<body>\n    <h1>練習版範例網頁</h1>\n    <p>這台練習用的電腦不能上網，這是固定的假回應。</p>\n    <p>網址：' + url + '</p>\n</body>\n</html>\n';
  }
  function parseUrl(raw) {
    var u = String(raw).trim();
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(u)) u = 'http://' + u;
    var m = /^([a-z][a-z0-9+.-]*):\/\/([^\/?#:]*)(?::(\d+))?([^?#]*)(\?[^#]*)?/i.exec(u);
    if (!m) return null;
    return { url: u, scheme: m[1].toLowerCase(), host: m[2].toLowerCase(), path: m[4] || '/' };
  }
  function fakeWeb(url) {
    var pu = parseUrl(url);
    if (!pu) return null;
    var body = /(^|\.)example\.com$/.test(pu.host) ? EXAMPLE_HTML : offlineHtml(pu.url);
    var bytes = utf8Bytes(body).length;
    var isExample = /(^|\.)example\.com$/.test(pu.host);
    var headers = new PSHash([['Content-Length', String(bytes)], ['Cache-Control', 'max-age=604800'], ['Content-Type', 'text/html; charset=UTF-8'], ['Date', 'Fri, 02 Oct 2026 01:52:' + two(Math.floor(jitter(bytes, 3) * 59)) + ' GMT'], ['ETag', '"3147526947+ident"'], ['Server', 'ECS (sed/58A1)'], ['Accept-Ranges', 'bytes']]);
    return { pu: pu, body: body, bytes: bytes, isExample: isExample, headers: headers };
  }
  function webErr(ctx, activity, name, host) {
    return ctx.fail({ msg: '無法解析遠端名稱: \'' + host + '\'', cat: 'InvalidOperation', target: 'System.Net.HttpWebRequest', ttype: 'HttpWebRequest', activity: 'Invoke-WebRequest', reason: 'WebException', fq: 'WebCmdletWebResponseException,' + CORE + 'InvokeWebRequestCommand', head: name });
  }
  SPEC.iwr = { name: 'Invoke-WebRequest', cls: CORE + 'InvokeWebRequestCommand', params: [sw('UseBasicParsing'), val('Uri', { pos: 0, mand: true, type: T_STR }), val('Method', { type: T_STR }), val('Headers', { raw: true, type: T_OBJ }), val('Body', { raw: true, type: T_OBJ }),
    val('OutFile', { type: T_STR }), sw('PassThru'), val('ContentType', { type: T_STR }), val('TimeoutSec', { type: 'System.Int32' }), sw('UseDefaultCredentials'), val('UserAgent', { type: T_STR }), val('MaximumRedirection', { type: 'System.Int32' })] };
  function* cmdIwr(ctx) {
    var P = ctx.p, web = fakeWeb(P.Uri);
    yield { sleep: 350 };
    if (!web || (!resolveHost(web.pu.host) && web.pu.host !== '')) {
      return webErr(ctx, 'Invoke-WebRequest', ctx.name, web ? web.pu.host : P.Uri);
    }
    if (P.OutFile) {
      if (!writeToPath(ctx, P.OutFile, web.body, false, 'Invoke-WebRequest')) return 1;
      if (P.PassThru) ctx.emitOne(webResponseObj(web, !!P.UseBasicParsing));
      return 0;
    }
    ctx.emitOne(webResponseObj(web, !!P.UseBasicParsing));
    return 0;
  }
  function webResponseObj(web, basic) {
    var raw = 'HTTP/1.1 200 OK\r\n' + web.headers.keys.map(function (k) { return k + ': ' + web.headers.get(k); }).join('\r\n') + '\r\n\r\n' + web.body;
    var links = web.isExample ? [mkObj([['innerHTML', 'More information...'], ['innerText', 'More information...'], ['outerHTML', '<a href="https://www.iana.org/domains/example">More information...</a>'], ['outerText', 'More information...'], ['tagName', 'A'], ['href', 'https://www.iana.org/domains/example']], T_CUSTOM, { custom: true })] : [];
    var props = [['StatusCode', 200], ['StatusDescription', 'OK'], ['Content', web.body], ['RawContent', raw], ['Headers', web.headers]];
    if (!basic) props.push(['Images', []], ['InputFields', []], ['Links', links], ['ParsedHtml', 'mshtml.HTMLDocumentClass']);
    props.push(['RawContentLength', web.bytes]);
    if (!basic) props.push(['RelatedLinks', []]);
    return new PSObj(basic ? 'Microsoft.PowerShell.Commands.BasicHtmlWebResponseObject' : 'Microsoft.PowerShell.Commands.HtmlWebResponseObject', props, { custom: true, web: web });
  }
  SPEC.irm = { name: 'Invoke-RestMethod', cls: CORE + 'InvokeRestMethodCommand', params: [val('Uri', { pos: 0, mand: true, type: T_STR }), val('Method', { type: T_STR }), val('Headers', { raw: true, type: T_OBJ }), val('Body', { raw: true, type: T_OBJ }),
    val('OutFile', { type: T_STR }), val('ContentType', { type: T_STR }), val('TimeoutSec', { type: 'System.Int32' }), val('UserAgent', { type: T_STR })] };
  function* cmdIrm(ctx) {
    var P = ctx.p, web = fakeWeb(P.Uri);
    yield { sleep: 350 };
    if (!web || !resolveHost(web.pu.host)) return ctx.fail({ msg: '無法解析遠端名稱: \'' + (web ? web.pu.host : P.Uri) + '\'', cat: 'InvalidOperation', target: 'System.Net.HttpWebRequest', ttype: 'HttpWebRequest', activity: 'Invoke-RestMethod', reason: 'WebException', fq: 'WebCmdletWebResponseException,' + CORE + 'InvokeRestMethodCommand' });
    if (P.OutFile) { return writeToPath(ctx, P.OutFile, web.body, false, 'Invoke-RestMethod') ? 0 : 1; }
    if (web.isExample) ctx.emitOne(web.body);
    else ctx.emitOne(new PSObj(T_CUSTOM, [['ok', true], ['message', '練習版的固定回應'], ['url', web.pu.url], ['source', 'practice-pc']], { custom: true }));
    return 0;
  }
  function* cmdCurlExe(ctx) {
    var args = ctx.rawArgs.map(String), url = null, head = false, silent = false, outFile = null, remoteName = false, verbose = false;
    for (var i = 0; i < args.length; i++) {
      var a = args[i];
      if (a === '-I' || a === '--head') head = true; else if (a === '-s' || a === '--silent') silent = true; else if (a === '-o' || a === '--output') outFile = args[++i]; else if (a === '-O') remoteName = true;
      else if (a === '-L' || a === '--location' || a === '-k' || a === '-i' || a === '-f' || a === '-S') { /* accepted */ } else if (a === '-H' || a === '-X' || a === '-d' || a === '-A' || a === '--data') i++;
      else if (a === '-v') verbose = true;
      else if (/^--?[A-Za-z]/.test(a)) { /* unknown flags are ignored */ } else url = a;
    }
    if (url === null) { ctx.native('curl: try \'curl --help\' or \'curl --manual\' for more information\n'); return 2; }
    var web = fakeWeb(url);
    yield { sleep: 350 };
    if (!web || !resolveHost(web.pu.host)) { ctx.native('curl: (6) Could not resolve host: ' + (web ? web.pu.host : url) + '\n'); return 6; }
    var hdr = 'HTTP/1.1 200 OK\r\n' + web.headers.keys.map(function (k) { return k + ': ' + web.headers.get(k); }).join('\r\n') + '\r\n';
    if (head) { ctx.out(hdr.replace(/\r\n/g, '\n') + '\n'); return 0; }
    if (outFile || remoteName) {
      var fname = outFile || (web.pu.path.split('/').pop() || 'index.html');
      if (!writeToPath(ctx, fname, web.body, false, 'curl')) return 23;
      if (!silent) ctx.native('  % Total    % Received % Xferd  Average Speed   Time    Time     Time  Current\n                                 Dload  Upload   Total   Spent    Left  Speed\n100 ' + padL(String(web.bytes), 5) + '  100 ' + padL(String(web.bytes), 5) + '    0     0  ' + padL(String(web.bytes * 70), 6) + '      0 --:--:-- --:--:-- --:--:-- ' + padL(String(web.bytes * 72), 6) + '\n');
      return 0;
    }
    ctx.out(web.body);
    return 0;
  }

  /* ---- winget */
  var PACKAGES = { 'git.git': { name: 'Git', id: 'Git.Git', ver: '2.51.0', url: 'https://github.com/git-for-windows/git/releases/download/v2.51.0.windows.1/Git-2.51.0-64-bit.exe', mb: '65.4', key: 'git' },
    'python.python.3.12': { name: 'Python 3.12', id: 'Python.Python.3.12', ver: '3.12.10', url: 'https://www.python.org/ftp/python/3.12.10/python-3.12.10-amd64.exe', mb: '25.7', key: 'python' } };
  function findPackage(q) {
    var l = String(q).toLowerCase();
    if (hasOwn.call(PACKAGES, l)) return PACKAGES[l];
    if (l === 'git') return PACKAGES['git.git'];
    if (l === 'python' || l === 'python3' || l === 'python.python.3' || l === 'python.python.3.12') return PACKAGES['python.python.3.12'];
    return null;
  }
  var WINGET_VER = 'v1.29.380';
  function* cmdWinget(ctx) {
    var args = ctx.rawArgs.map(String), sub = args[0] ? args[0].toLowerCase() : '';
    if (sub === '--version' || sub === '-v') { ctx.out(WINGET_VER + '\n'); return 0; }
    if (sub === '' || sub === '--help' || sub === '-?') {
      ctx.out('Windows 封裝管理員 ' + WINGET_VER + '\nCopyright (c) Microsoft Corporation. 著作權所有，並保留一切權利。\n\nWindows 封裝管理員命令列公用程式可讓您從命令列安裝應用程式和其他封裝。\n\n使用方式: winget [<命令>] [<選項>]\n\n下列命令可用:\n  install    安裝指定的封裝\n  show       顯示封裝的相關資訊\n  search     搜尋封裝的基本資訊\n  list       顯示已安裝的封裝\n  upgrade    顯示並執行可用的升級\n  uninstall  解除安裝指定的封裝\n\n如需特定命令的詳細資訊，請將說明引數傳遞給命令。 [-?]\n');
      return 0;
    }
    var rest = args.slice(1), query = null;
    for (var i = 0; i < rest.length; i++) {
      var a = rest[i], al = a.toLowerCase();
      if (al === '--id' || al === '--name' || al === '-q' || al === '--query') query = rest[++i];
      else if (al === '-s' || al === '--source' || al === '-v' || al === '--version' || al === '--scope' || al === '-l' || al === '--location') i++;
      else if (a.charAt(0) !== '-') query = query === null ? a : query;
    }
    if (sub === 'list' || sub === 'ls') {
      var rows = [['Windows Terminal', 'Microsoft.WindowsTerminal', '1.24.12741.0', 'winget'], ['Microsoft Edge', 'Microsoft.Edge', '141.0.3537.57', 'winget'], ['Visual Studio Code', 'Microsoft.VisualStudioCode', '1.104.3', 'winget']];
      if (termState.installed.git) rows.push(['Git', 'Git.Git', PACKAGES['git.git'].ver, 'winget']);
      if (termState.installed.python) rows.push(['Python 3.12', 'Python.Python.3.12', PACKAGES['python.python.3.12'].ver, 'winget']);
      var cols = [{ h: '名稱', cells: rows.map(function (r) { return r[0]; }), right: false }, { h: '識別碼', cells: rows.map(function (r) { return r[1]; }), right: false }, { h: '版本', cells: rows.map(function (r) { return r[2]; }), right: false }, { h: '來源', cells: rows.map(function (r) { return r[3]; }), right: false }];
      var lines = tableLinesOf(cols, ctx.cols);
      lines.splice(1, 1, new Array(Math.min(ctx.cols - 1, Math.max.apply(null, lines.map(displayWidth))) + 1).join('-'));
      ctx.out(lines.join('\n') + '\n');
      return 0;
    }
    if (sub === 'search' || sub === 'show') {
      var pk = query ? findPackage(query) : null;
      if (!pk) { ctx.out('找不到符合輸入準則的封裝。\n'); return 1; }
      if (sub === 'show') { ctx.out('找到 ' + pk.name + ' [' + pk.id + ']\n版本: ' + pk.ver + '\n發行者: ' + (pk.key === 'git' ? 'The Git Development Community' : 'Python Software Foundation') + '\n'); return 0; }
      var c2 = [{ h: '名稱', cells: [pk.name], right: false }, { h: '識別碼', cells: [pk.id], right: false }, { h: '版本', cells: [pk.ver], right: false }, { h: '來源', cells: ['winget'], right: false }];
      var l2 = tableLinesOf(c2, ctx.cols);
      l2.splice(1, 1, new Array(Math.min(ctx.cols - 1, Math.max.apply(null, l2.map(displayWidth))) + 1).join('-'));
      ctx.out(l2.join('\n') + '\n');
      return 0;
    }
    if (sub === 'install' || sub === 'add') {
      var pkg = query ? findPackage(query) : null;
      if (!query) { ctx.native('必須提供要安裝的封裝名稱或識別碼。\n'); return 1; }
      if (!pkg) { ctx.out('找不到符合輸入準則的封裝。\n'); return 1; }
      if (termState.installed[pkg.key]) { ctx.out('已安裝現有的封裝。正在嘗試升級已安裝的封裝...\n找不到可用的升級。\n'); return 0; }
      ctx.out('找到 ' + pkg.name + ' [' + pkg.id + '] 版本 ' + pkg.ver + '\n此應用程式由其擁有者授權予您。\nMicrosoft 不負責，也不會授予第三方封裝的任何授權。\n正在下載 ' + pkg.url + '\n');
      yield { sleep: 1100 };
      ctx.out('  ██████████████████████████████  ' + pkg.mb + ' MB / ' + pkg.mb + ' MB\n已成功驗證安裝程式雜湊\n正在開始安裝封裝...\n');
      yield { sleep: 1300 };
      termState.installed[pkg.key] = true;
      ctx.out('已成功安裝\n');
      return 0;
    }
    if (sub === 'uninstall' || sub === 'remove' || sub === 'rm') {
      var pk2 = query ? findPackage(query) : null;
      if (!pk2 || !termState.installed[pk2.key]) { ctx.out('找不到與輸入準則相符的已安裝封裝。\n'); return 1; }
      ctx.out('找到 ' + pk2.name + ' [' + pk2.id + ']\n正在開始解除安裝封裝...\n');
      yield { sleep: 900 };
      termState.installed[pk2.key] = false;
      ctx.out('已成功解除安裝\n');
      return 0;
    }
    if (sub === 'upgrade' || sub === 'update') { ctx.out('找不到可用的升級。\n'); return 0; }
    ctx.native('練習版的 winget 只做 install、list、search、show、uninstall。\n');
    return 1;
  }

  defCmd({ id: 'ipconfig', canon: 'net', native: true, name: 'ipconfig', run: cmdIpconfig, nopaths: true }, ['ipconfig']);
  defCmd({ id: 'ping', canon: 'net', native: true, name: 'ping', run: cmdPing, nopaths: true }, ['ping']);
  defCmd({ id: 'testconn', canon: 'net', spec: SPEC.testconn, run: cmdTestConnection, nopaths: true }, ['Test-Connection']);
  defCmd({ id: 'nslookup', canon: 'net', native: true, name: 'nslookup', run: cmdNslookup, nopaths: true }, ['nslookup']);
  defCmd({ id: 'tracert', canon: 'net', native: true, name: 'tracert', run: cmdTracert, nopaths: true }, ['tracert']);
  defCmd({ id: 'iwr', canon: 'net', spec: SPEC.iwr, run: cmdIwr, nopaths: true }, ['Invoke-WebRequest', 'iwr', 'curl', 'wget']);
  defCmd({ id: 'irm', canon: 'net', spec: SPEC.irm, run: cmdIrm, nopaths: true }, ['Invoke-RestMethod', 'irm']);
  defCmd({ id: 'curlexe', canon: 'net', native: true, name: 'curl.exe', run: cmdCurlExe, nopaths: true }, ['curl.exe']);
  defCmd({ id: 'winget', canon: 'pkg', native: true, name: 'winget', run: cmdWinget, nopaths: true }, ['winget']);

  /* ====================================================================================================================
     Round 5 — a fresh PC: python is only the Microsoft Store stub and git is not installed until `winget install` runs (SPEC section 1).
     After that: a small git (init, status, add, commit, log, branch, switch, diff, config) that works on the real files of the VFS,
     and a small python (REPL, -c, scripts that only print and calculate).
     ==================================================================================================================== */
  var STORE_MSG = 'Python was not found; run without arguments to install from the Microsoft Store, or disable this shortcut from Settings > Apps > Advanced app settings > App execution aliases.';
  var PY_VER = '3.12.10';

  /* ---- python: expressions, print(), variables */
  function PyFloat(v) { this.pyfloat = true; this.v = v; }
  function isPyFloat(x) { return x instanceof PyFloat; }
  function pyErrObj(kind, msg) { var e = new Error(msg); e.pyerr = { kind: kind, msg: msg }; return e; }
  function pyTokens(src) {
    var toks = [], i = 0, n = src.length, m;
    while (i < n) {
      var c = src.charAt(i);
      if (c === ' ' || c === '\t') { i++; continue; }
      if (c === '#') break;
      if ((m = /^(?:\d+\.\d*(?:[eE][-+]?\d+)?|\.\d+(?:[eE][-+]?\d+)?|\d+[eE][-+]?\d+|\d[\d_]*)/.exec(src.slice(i)))) { toks.push({ t: 'num', v: m[0].replace(/_/g, ''), at: i }); i += m[0].length; continue; }
      if (/[A-Za-z_]/.test(c) || c.charCodeAt(0) > 127 && !/[\u3000-\u303f\uff00-\uffef]/.test(c)) {
        m = /^[A-Za-z_\u0080-\uffff][\w\u0080-\uffff]*/.exec(src.slice(i));
        // an f-string / r-string prefix
        if (/^[fFrRbBuU]{1,2}$/.test(m[0]) && /["']/.test(src.charAt(i + m[0].length))) { var pre = m[0].toLowerCase(); i += m[0].length; var q0 = src.charAt(i), j0 = i + 1, s0 = ''; while (j0 < n && src.charAt(j0) !== q0) { if (src.charAt(j0) === '\\' && pre.indexOf('r') < 0) { var e0 = src.charAt(j0 + 1); s0 += e0 === 'n' ? '\n' : (e0 === 't' ? '\t' : e0); j0 += 2; continue; } s0 += src.charAt(j0++); } if (j0 >= n) throw pyErrObj('SyntaxError', 'unterminated string literal (detected at line 1)'); toks.push({ t: 'str', v: s0, f: pre.indexOf('f') >= 0, at: i }); i = j0 + 1; continue; }
        toks.push({ t: 'name', v: m[0], at: i }); i += m[0].length; continue;
      }
      if (c === '"' || c === "'") {
        var q = c, j = i + 1, s = '';
        while (j < n && src.charAt(j) !== q) { if (src.charAt(j) === '\\') { var e = src.charAt(j + 1); s += e === 'n' ? '\n' : (e === 't' ? '\t' : (e === '\\' ? '\\' : e)); j += 2; continue; } s += src.charAt(j++); }
        if (j >= n) throw pyErrObj('SyntaxError', 'unterminated string literal (detected at line 1)');
        toks.push({ t: 'str', v: s, at: i }); i = j + 1; continue;
      }
      if ((m = /^(\*\*=|\/\/=|\*\*|\/\/|==|!=|<=|>=|\+=|-=|\*=|\/=|%=|[-+*\/%()<>=,.\[\]:{}])/.exec(src.slice(i)))) { toks.push({ t: 'op', v: m[0], at: i }); i += m[0].length; continue; }
      throw pyErrObj('SyntaxError', 'invalid character \'' + c + '\' (U+' + ('0000' + c.charCodeAt(0).toString(16).toUpperCase()).slice(-4) + ')');
    }
    return toks;
  }
  function pyStr(v) {
    if (v === null || v === undefined) return 'None';
    if (v === true) return 'True';
    if (v === false) return 'False';
    if (isPyFloat(v)) { var x = v.v; if (x === Infinity) return 'inf'; if (x === -Infinity) return '-inf'; if (x !== x) return 'nan'; var s = String(x); if (/e/.test(s)) s = s.replace(/e([+-])(\d)$/, 'e$10$2'); return Number.isInteger(x) && Math.abs(x) < 1e16 ? x.toFixed(1) : s; }
    if (typeof v === 'number') return String(v);
    if (typeof v === 'string') return v;
    if (Array.isArray(v)) return '[' + v.map(pyRepr).join(', ') + ']';
    if (v && v.tuple) return '(' + v.tuple.map(pyRepr).join(', ') + (v.tuple.length === 1 ? ',' : '') + ')';
    return String(v);
  }
  function pyRepr(v) { return typeof v === 'string' ? (v.indexOf("'") >= 0 && v.indexOf('"') < 0 ? '"' + v + '"' : "'" + v.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n') + "'") : pyStr(v); }
  function pyNum(v) { return isPyFloat(v) ? v.v : (typeof v === 'boolean' ? (v ? 1 : 0) : v); }
  function pyIsNum(v) { return typeof v === 'number' || isPyFloat(v) || typeof v === 'boolean'; }
  function pyTrue(v) { return !(v === null || v === false || v === 0 || v === '' || (isPyFloat(v) && v.v === 0) || (Array.isArray(v) && !v.length)); }
  function pyTypeName(v) { return v === null ? 'NoneType' : (typeof v === 'string' ? 'str' : (typeof v === 'boolean' ? 'bool' : (isPyFloat(v) ? 'float' : (typeof v === 'number' ? 'int' : (Array.isArray(v) ? 'list' : (v && v.tuple ? 'tuple' : 'object')))))); }
  function pyEvalLine(src, env, out) {
    var toks = pyTokens(src), p = 0;
    function peek() { return toks[p]; }
    function isOp(v) { return toks[p] && toks[p].t === 'op' && toks[p].v === v; }
    function isName(v) { return toks[p] && toks[p].t === 'name' && toks[p].v === v; }
    function syntax() { throw pyErrObj('SyntaxError', 'invalid syntax'); }
    function expect(v) { if (!isOp(v)) syntax(); p++; }
    function mk(v) { return v; }
    function numResult(isF, x) { return isF ? new PyFloat(x) : x; }
    function arith(op, a, b) {
      if (op === '+') { if (typeof a === 'string' && typeof b === 'string') return a + b; if (Array.isArray(a) && Array.isArray(b)) return a.concat(b); }
      if (op === '*') { if (typeof a === 'string' && typeof b === 'number') return new Array(Math.max(0, b) + 1).join(a); if (typeof b === 'string' && typeof a === 'number') return new Array(Math.max(0, a) + 1).join(b); if (Array.isArray(a) && typeof b === 'number') { var r0 = []; for (var k = 0; k < b; k++) r0 = r0.concat(a); return r0; } }
      if (!pyIsNum(a) || !pyIsNum(b)) throw pyErrObj('TypeError', "unsupported operand type(s) for " + op + ": '" + pyTypeName(a) + "' and '" + pyTypeName(b) + "'");
      var x = pyNum(a), y = pyNum(b), f = isPyFloat(a) || isPyFloat(b);
      switch (op) {
        case '+': return numResult(f, x + y); case '-': return numResult(f, x - y); case '*': return numResult(f, x * y);
        case '/': if (y === 0) throw pyErrObj('ZeroDivisionError', 'division by zero'); return new PyFloat(x / y);
        case '//': if (y === 0) throw pyErrObj('ZeroDivisionError', f ? 'float floor division by zero' : 'integer division or modulo by zero'); return numResult(f, Math.floor(x / y));
        case '%': if (y === 0) throw pyErrObj('ZeroDivisionError', f ? 'float modulo' : 'integer modulo by zero'); return numResult(f, x - Math.floor(x / y) * y);
        case '**': { var rr = Math.pow(x, y); return numResult(f || y < 0, rr); }
      }
      return null;
    }
    function cmp(op, a, b) {
      if (op === '==') return pyEq(a, b); if (op === '!=') return !pyEq(a, b);
      var x = pyIsNum(a) ? pyNum(a) : a, y = pyIsNum(b) ? pyNum(b) : b;
      if ((typeof x === 'number') !== (typeof y === 'number') && !(typeof x === 'string' && typeof y === 'string')) throw pyErrObj('TypeError', "'" + op + "' not supported between instances of '" + pyTypeName(a) + "' and '" + pyTypeName(b) + "'");
      return op === '<' ? x < y : op === '>' ? x > y : op === '<=' ? x <= y : x >= y;
    }
    function pyEq(a, b) { if (pyIsNum(a) && pyIsNum(b)) return pyNum(a) === pyNum(b); if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every(function (x, i) { return pyEq(x, b[i]); }); return a === b; }
    function expr() { return orE(); }
    function orE() { var l = andE(); while (isName('or')) { p++; var r = andE(); l = pyTrue(l) ? l : r; } return l; }
    function andE() { var l = notE(); while (isName('and')) { p++; var r = notE(); l = pyTrue(l) ? r : l; } return l; }
    function notE() { if (isName('not')) { p++; return !pyTrue(notE()); } return cmpE(); }
    function cmpE() {
      var l = addE();
      for (;;) {
        var t = peek();
        if (t && t.t === 'op' && /^(==|!=|<=|>=|<|>)$/.test(t.v)) { p++; l = cmp(t.v, l, addE()); continue; }
        if (isName('in')) { p++; var c = addE(); l = typeof c === 'string' ? c.indexOf(l) >= 0 : (Array.isArray(c) && c.some(function (x) { return pyEq(x, l); })); continue; }
        if (isName('is')) { p++; var neg = false; if (isName('not')) { p++; neg = true; } var r = addE(); l = (l === r) !== neg; continue; }
        return l;
      }
    }
    function addE() { var l = mulE(); while (isOp('+') || isOp('-')) { var op = toks[p++].v; l = arith(op, l, mulE()); } return l; }
    function mulE() { var l = unE(); while (isOp('*') || isOp('/') || isOp('//') || isOp('%')) { var op = toks[p++].v; l = arith(op, l, unE()); } return l; }
    function unE() { if (isOp('-')) { p++; var v = unE(); if (!pyIsNum(v)) throw pyErrObj('TypeError', "bad operand type for unary -: '" + pyTypeName(v) + "'"); return isPyFloat(v) ? new PyFloat(-v.v) : -pyNum(v); } if (isOp('+')) { p++; return unE(); } return powE(); }
    function powE() { var b = postE(); if (isOp('**')) { p++; var e = unE(); return arith('**', b, e); } return b; }
    function postE() {
      var v = atom();
      for (;;) {
        if (isOp('(')) { p++; var args = []; if (!isOp(')')) { for (;;) { args.push(expr()); if (isOp(',')) { p++; if (isOp(')')) break; continue; } break; } } expect(')'); v = callPy(v, args); continue; }
        if (isOp('[')) { p++; var ix = expr(); expect(']'); v = pyIndex(v, ix); continue; }
        if (isOp('.')) { p++; var nm = peek(); if (!nm || nm.t !== 'name') syntax(); p++; v = { bound: v, name: nm.v }; continue; }
        return v;
      }
    }
    function pyIndex(v, ix) {
      if (typeof ix !== 'number') throw pyErrObj('TypeError', 'indices must be integers or slices, not ' + pyTypeName(ix));
      var arr = typeof v === 'string' ? v : (Array.isArray(v) ? v : (v && v.tuple ? v.tuple : null));
      if (arr === null) throw pyErrObj('TypeError', "'" + pyTypeName(v) + "' object is not subscriptable");
      var k = ix < 0 ? ix + arr.length : ix;
      if (k < 0 || k >= arr.length) throw pyErrObj('IndexError', (typeof v === 'string' ? 'string' : (Array.isArray(v) ? 'list' : 'tuple')) + ' index out of range');
      return typeof v === 'string' ? v.charAt(k) : arr[k];
    }
    function atom() {
      var t = peek();
      if (!t) syntax();
      if (t.t === 'num') { p++; return /[.eE]/.test(t.v) ? new PyFloat(parseFloat(t.v)) : parseInt(t.v, 10); }
      if (t.t === 'str') {
        p++;
        var s = t.v;
        if (t.f) s = s.replace(/\{\{|\}\}|\{([^{}]*)\}/g, function (m0, inner) { if (m0 === '{{') return '{'; if (m0 === '}}') return '}'; var name = inner.split(':')[0].trim(); var spec = inner.indexOf(':') >= 0 ? inner.slice(inner.indexOf(':') + 1) : ''; var val = pyEvalLine(name, env, out).value; return fmtSpec(val, spec); });
        while (peek() && peek().t === 'str') { s += peek().v; p++; }
        return s;
      }
      if (t.t === 'name') {
        p++;
        if (t.v === 'True') return true; if (t.v === 'False') return false; if (t.v === 'None') return null;
        if (hasOwn.call(env.vars, t.v)) return env.vars[t.v];
        if (hasOwn.call(PY_BUILTINS, t.v)) return { builtin: t.v };
        throw pyErrObj('NameError', "name '" + t.v + "' is not defined");
      }
      if (isOp('(')) {
        p++;
        if (isOp(')')) { p++; return { tuple: [] }; }
        var first = expr();
        if (isOp(',')) { var items = [first]; while (isOp(',')) { p++; if (isOp(')')) break; items.push(expr()); } expect(')'); return { tuple: items }; }
        expect(')');
        return first;
      }
      if (isOp('[')) { p++; var list = []; if (!isOp(']')) { for (;;) { list.push(expr()); if (isOp(',')) { p++; if (isOp(']')) break; continue; } break; } } expect(']'); return list; }
      syntax();
      return null;
    }
    function fmtSpec(v, spec) {
      var m = /^(?:\.(\d+))?([fdsx%]?)$/.exec(spec || '');
      if (!spec) return pyStr(v);
      if (!m) return pyStr(v);
      var num = pyNum(v);
      if (m[2] === 'f' || (m[1] !== undefined && m[2] === '')) return Number(num).toFixed(m[1] === undefined ? 6 : +m[1]);
      if (m[2] === '%') return (num * 100).toFixed(m[1] === undefined ? 6 : +m[1]) + '%';
      return pyStr(v);
    }
    function callPy(f, args) {
      if (f && f.bound !== undefined) return pyMethod(f.bound, f.name, args);
      if (f && f.builtin) return PY_BUILTINS[f.builtin](args, env, out);
      throw pyErrObj('TypeError', "'" + pyTypeName(f) + "' object is not callable");
    }
    function pyMethod(o, name, args) {
      if (typeof o === 'string') {
        switch (name) {
          case 'upper': return o.toUpperCase(); case 'lower': return o.toLowerCase(); case 'strip': return o.trim(); case 'title': return o.replace(/\w\S*/g, function (w) { return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(); });
          case 'replace': return o.split(pyStr(args[0])).join(pyStr(args[1])); case 'split': return args.length ? o.split(pyStr(args[0])) : o.trim().split(/\s+/);
          case 'startswith': return o.indexOf(pyStr(args[0])) === 0; case 'endswith': return o.slice(o.length - pyStr(args[0]).length) === pyStr(args[0]);
          case 'join': return (Array.isArray(args[0]) ? args[0] : []).map(pyStr).join(o); case 'format': { var k = 0; return o.replace(/\{\}/g, function () { return pyStr(args[k++]); }); }
        }
      }
      if (Array.isArray(o)) { if (name === 'append') { o.push(args[0]); return null; } if (name === 'pop') return o.pop(); if (name === 'sort') { o.sort(function (a, b) { return pyNum(a) < pyNum(b) ? -1 : pyNum(a) > pyNum(b) ? 1 : 0; }); return null; } if (name === 'reverse') { o.reverse(); return null; } }
      throw pyErrObj('AttributeError', "'" + pyTypeName(o) + "' object has no attribute '" + name + "'");
    }
    var PY_BUILTINS = {
      print: function (args, e, o) { var sep = ' ', end = '\n', list = []; args.forEach(function (a) { list.push(a); }); o.push(list.map(pyStr).join(sep) + end); return null; },
      len: function (a) { var v = a[0]; if (typeof v === 'string' || Array.isArray(v)) return v.length; if (v && v.tuple) return v.tuple.length; throw pyErrObj('TypeError', "object of type '" + pyTypeName(v) + "' has no len()"); },
      str: function (a) { return a.length ? pyStr(a[0]) : ''; }, repr: function (a) { return pyRepr(a[0]); },
      int: function (a) { var v = a[0]; if (typeof v === 'string') { if (!/^\s*[-+]?\d+\s*$/.test(v)) throw pyErrObj('ValueError', "invalid literal for int() with base 10: " + pyRepr(v)); return parseInt(v, 10); } return Math.trunc(pyNum(v)); },
      float: function (a) { var v = a[0]; if (typeof v === 'string') { if (!/^\s*[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?\s*$/.test(v)) throw pyErrObj('ValueError', 'could not convert string to float: ' + pyRepr(v)); return new PyFloat(parseFloat(v)); } return new PyFloat(pyNum(v)); },
      round: function (a) { var x = pyNum(a[0]); if (a.length > 1) { var f = Math.pow(10, a[1]); return new PyFloat(roundEven(x * f) / f); } return roundEven(x); },
      abs: function (a) { var v = a[0]; return isPyFloat(v) ? new PyFloat(Math.abs(v.v)) : Math.abs(pyNum(v)); },
      max: function (a) { var l = a.length === 1 && Array.isArray(a[0]) ? a[0] : a; return l.reduce(function (m, x) { return pyNum(x) > pyNum(m) ? x : m; }); },
      min: function (a) { var l = a.length === 1 && Array.isArray(a[0]) ? a[0] : a; return l.reduce(function (m, x) { return pyNum(x) < pyNum(m) ? x : m; }); },
      sum: function (a) { var l = a[0] || [], f = l.some(isPyFloat), t = l.reduce(function (s, x) { return s + pyNum(x); }, 0); return f ? new PyFloat(t) : t; },
      sorted: function (a) { return a[0].slice().sort(function (x, y) { return pyNum(x) < pyNum(y) ? -1 : pyNum(x) > pyNum(y) ? 1 : 0; }); },
      range: function (a) { var s = 0, e = pyNum(a[0]), st = 1; if (a.length > 1) { s = pyNum(a[0]); e = pyNum(a[1]); } if (a.length > 2) st = pyNum(a[2]); var r = []; for (var i = s; st > 0 ? i < e : i > e; i += st) { r.push(i); if (r.length > 100000) break; } return r; },
      list: function (a) { var v = a[0]; return v === undefined ? [] : (typeof v === 'string' ? Array.from(v) : (v && v.tuple ? v.tuple.slice() : v.slice())); },
      type: function (a) { return { cls: pyTypeName(a[0]) }; },
      bool: function (a) { return pyTrue(a[0]); },
      input: function () { throw pyErrObj('EOFError', 'EOF when reading a line'); },
      exit: function () { throw { pyexit: true }; }, quit: function () { throw { pyexit: true }; }
    };
    // a statement: name = expr, name += expr, or an expression
    if (toks.length >= 2 && toks[0].t === 'name' && toks[1].t === 'op' && /^(=|\+=|-=|\*=|\/=|\/\/=|%=|\*\*=)$/.test(toks[1].v) && !(toks[1].v === '=' && toks[2] && toks[2].v === '=')) {
      var nm = toks[0].v, op = toks[1].v;
      p = 2;
      var v = expr();
      if (p < toks.length) syntax();
      if (op !== '=') { if (!hasOwn.call(env.vars, nm)) throw pyErrObj('NameError', "name '" + nm + "' is not defined"); v = arith(op.slice(0, -1), env.vars[nm], v); }
      env.vars[nm] = v;
      return { value: undefined, assigned: true };
    }
    if (!toks.length) return { value: undefined, empty: true };
    var val = expr();
    if (p < toks.length) syntax();
    return { value: val };
  }
  function pyReport(ctx, e, where, lineText, lineNo) {
    if (e && e.pyexit) return 'exit';
    if (!e || !e.pyerr) throw e;
    var err = e.pyerr;
    if (err.kind === 'SyntaxError') ctx.err('  File "' + where + '", line ' + lineNo + '\n    ' + lineText.trim() + '\n    ' + '^'.repeat(Math.max(1, Math.min(lineText.trim().length, 1))) + '\nSyntaxError: ' + err.msg + '\n');
    else ctx.err('Traceback (most recent call last):\n  File "' + where + '", line ' + lineNo + (where === '<stdin>' ? ', in <module>\n' : ', in <module>\n') + err.kind + ': ' + err.msg + '\n');
    return 'error';
  }
  var PY_ONLY = '練習版的 Python 只會 print 和算式。\n';
  function* cmdPython(ctx) {
    var s = ctx.session, args = ctx.rawArgs.map(String);
    if (!termState.installed.python) { ctx.native(STORE_MSG + '\n'); s.lastExit = 9009; return 1; }
    var env = { vars: Object.create(null) };
    if (args[0] === '--version' || args[0] === '-V') { ctx.out('Python ' + PY_VER + '\n'); return 0; }
    if (args[0] === '-m') {
      if (args[1] === 'pip' && /^(--version|-V)$/.test(args[2] || '')) { ctx.out('pip 25.0.1 from C:\\Users\\' + USER + '\\AppData\\Local\\Programs\\Python\\Python312\\Lib\\site-packages\\pip (python 3.12)\n'); return 0; }
      ctx.native('C:\\Users\\' + USER + '\\AppData\\Local\\Programs\\Python\\Python312\\python.exe: No module named ' + (args[1] || '') + '\n'); return 1;
    }
    function runLines(lines, where) {
      var outBuf = [];
      for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        if (/^\s*(#.*)?$/.test(line)) continue;
        if (/^\s*(import|from|def|class|for|while|if|elif|else|try|with|return|lambda|global|del)\b/.test(line) || /^\s/.test(line)) { flush(); ctx.err(PY_ONLY); return 1; }
        try { var r = pyEvalLine(line, env, outBuf); flush(); if (where === '<stdin>' && !r.assigned && !r.empty && r.value !== undefined && r.value !== null) ctx.out(pyRepr(r.value) + '\n'); }
        catch (e) { flush(); var what = pyReport(ctx, e, where, line, i + 1); if (what === 'exit') return 'exit'; return 1; }
      }
      flush();
      return 0;
      function flush() { if (outBuf.length) { ctx.out(outBuf.join('')); outBuf.length = 0; } }
    }
    if (args[0] === '-c') { var rc = runLines(String(args[1] === undefined ? '' : args[1]).split(/;\s*|\n/), '<string>'); return rc === 'exit' ? 0 : rc; }
    if (args.length && args[0].charAt(0) !== '-') {
      var fr = resolvePath(s, args[0]), fst = fr.err ? null : s.vfs.stat(fr.abs);
      if (!fst || fst.type === 'dir') { ctx.native('C:\\Users\\' + USER + '\\AppData\\Local\\Programs\\Python\\Python312\\python.exe: can\'t open file \'' + (fr.disp || args[0]) + '\': [Errno 2] No such file or directory\n'); return 2; }
      var text = s.vfs.readFile(fst.path, { by: 'terminal' });
      var rcc = runLines(text.replace(/\r\n/g, '\n').split('\n'), fr.disp);
      return rcc === 'exit' ? 0 : rcc;
    }
    // the interactive REPL
    ctx.out('Python ' + PY_VER + ' (tags/v3.12.10:0cc8128, Apr  8 2025, 12:21:36) [MSC v.1943 64 bit (AMD64)] on win32\nType "help", "copyright", "credits" or "license" for more information.\n');
    for (;;) {
      var ans = yield { prompt: { text: '>>> ', kind: 'python' } };
      if (ans === undefined) return 0;
      var t = String(ans).trim();
      if (t === 'exit' || t === 'quit') { ctx.out('Use ' + t + '() or Ctrl-Z plus Return to exit\n'); continue; }
      if (t === '\u001a' || t === '^Z') return 0;
      var r2 = runLines([ans], '<stdin>');
      if (r2 === 'exit') return 0;
    }
  }

  /* ---- git: a repository kept in .git/ of the VFS (HEAD, config and refs are real small files; the history is one JSON file) */
  var GIT_VER = '2.51.0.windows.1';
  function gitRoot(S) {
    var p = S.cwd;
    for (;;) {
      if (S.vfs.isDir(S.vfs.join(p, '.git'))) return p;
      if (p === '/') return null;
      p = S.vfs.dirname(p);
    }
  }
  function gitLoad(S, root) {
    var f = S.vfs.join(root, '.git/lab-state.json');
    try { return JSON.parse(S.vfs.readFile(f, { by: 'system' })); } catch (e) { return { head: 'master', branches: { master: null }, commits: {}, index: {} }; }
  }
  function gitSave(S, root, st) {
    var vfs = S.vfs;
    vfs.writeFile(vfs.join(root, '.git/lab-state.json'), JSON.stringify(st), { by: 'system' });
    vfs.writeFile(vfs.join(root, '.git/HEAD'), 'ref: refs/heads/' + st.head + '\n', { by: 'system' });
    if (!vfs.exists(vfs.join(root, '.git/refs/heads'))) vfs.mkdir(vfs.join(root, '.git/refs/heads'), { by: 'system', parents: true });
    Object.keys(st.branches).forEach(function (b) { if (st.branches[b]) vfs.writeFile(vfs.join(root, '.git/refs/heads/' + b), st.branches[b] + '\n', { by: 'system' }); });
  }
  function gitWorking(S, root) {
    var out = {}, vfs = S.vfs;
    (function walk(dir, rel) {
      vfs.list(dir).forEach(function (k) {
        if (k.name === '.git' || isTrash(k)) return;
        var rp = rel ? rel + '/' + k.name : k.name;
        if (k.type === 'dir') walk(k.path, rp);
        else out[rp] = k.kind === 'binary' || k.kind === 'zip' || k.kind === 'app' ? { c: null, s: k.size } : { c: vfs.readFile(k.path, { by: 'system' }), s: k.size };
      });
    })(root, '');
    return out;
  }
  function sameFile(a, b) { return !!a && !!b && a.c === b.c && a.s === b.s; }
  function gitHeadTree(st) { var id = st.branches[st.head]; return id && st.commits[id] ? st.commits[id].tree : {}; }
  function fakeHash(text) { var h = 5381, out = ''; for (var k = 0; k < 5; k++) { for (var i = 0; i < text.length; i++) h = ((h * 33) ^ text.charCodeAt(i) ^ k) >>> 0; out += ('00000000' + h.toString(16)).slice(-8); } return out; }
  function lineCount(c) { return c === null ? 0 : (c === '' ? 0 : c.replace(/\r\n/g, '\n').replace(/\n$/, '').split('\n').length); }
  function diffLines(a, b) {
    var x = a === null || a === '' ? [] : a.replace(/\r\n/g, '\n').replace(/\n$/, '').split('\n'), y = b === null || b === '' ? [] : b.replace(/\r\n/g, '\n').replace(/\n$/, '').split('\n');
    var n = x.length, m = y.length, L = [], i, j;
    for (i = 0; i <= n; i++) { L.push(new Array(m + 1).fill(0)); }
    for (i = n - 1; i >= 0; i--) for (j = m - 1; j >= 0; j--) L[i][j] = x[i] === y[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    var ops = []; i = 0; j = 0;
    while (i < n && j < m) { if (x[i] === y[j]) { ops.push([' ', x[i]]); i++; j++; } else if (L[i + 1][j] >= L[i][j + 1]) { ops.push(['-', x[i]]); i++; } else { ops.push(['+', y[j]]); j++; } }
    while (i < n) ops.push(['-', x[i++]]); while (j < m) ops.push(['+', y[j++]]);
    return ops;
  }
  function gitStatusLists(st, work) {
    var head = gitHeadTree(st), idx = st.index, staged = [], unstaged = [], untracked = [];
    Object.keys(idx).forEach(function (p) { if (!head[p]) staged.push(['new file', p]); else if (!sameFile(idx[p], head[p])) staged.push(['modified', p]); });
    Object.keys(head).forEach(function (p) { if (!idx[p]) staged.push(['deleted', p]); });
    Object.keys(idx).forEach(function (p) { if (!work[p]) unstaged.push(['deleted', p]); else if (!sameFile(work[p], idx[p])) unstaged.push(['modified', p]); });
    Object.keys(work).forEach(function (p) { if (!idx[p]) untracked.push(p); });
    function srt(a) { return a.sort(function (x, y) { var a1 = typeof x === 'string' ? x : x[1], b1 = typeof y === 'string' ? y : y[1]; return a1 < b1 ? -1 : a1 > b1 ? 1 : 0; }); }
    return { staged: srt(staged), unstaged: srt(unstaged), untracked: srt(untracked) };
  }
  function collapseUntracked(list, tracked) {
    var out = [], seen = {};
    list.forEach(function (p) {
      var parts = p.split('/'), shown = p;
      for (var k = 1; k < parts.length; k++) { var dir = parts.slice(0, k).join('/') + '/'; if (!Object.keys(tracked).some(function (t) { return t.indexOf(dir) === 0; })) { shown = dir; break; } }
      if (!seen[shown]) { seen[shown] = 1; out.push(shown); }
    });
    return out;
  }
  function gitIdentity(ctx) { var c = termState.gitConfig; return c.name && c.email ? c : null; }
  function cmdGit(ctx) {
    var s = ctx.session, vfs = s.vfs, args = ctx.rawArgs.map(String), sub = args[0] || '';
    if (!sub || sub === '--help' || sub === 'help' || sub === '-h') {
      ctx.out('usage: git [-v | --version] [-h | --help] [-C <path>] [-c <name>=<value>]\n           [--exec-path[=<path>]] [--html-path] [--man-path] [--info-path]\n           [-p | --paginate | -P | --no-pager] [--no-replace-objects] [--no-lazy-fetch]\n           [--no-optional-locks] [--no-advice] [--bare] [--git-dir=<path>]\n           [--work-tree=<path>] [--namespace=<name>] [--config-env=<name>=<envvar>]\n           <command> [<args>]\n\nThese are common Git commands used in various situations:\n\nstart a working area (see also: git help tutorial)\n   clone     Clone a repository into a new directory\n   init      Create an empty Git repository or reinitialize an existing one\n\nwork on the current change (see also: git help everyday)\n   add       Add file contents to the index\n\nexamine the history and state (see also: git help revisions)\n   diff      Show changes between commits, commit and working tree, etc\n   log       Show commit logs\n   status    Show the working tree status\n\ngrow, mark and tweak your common history\n   branch    List, create, or delete branches\n   commit    Record changes to the repository\n   switch    Switch branches\n');
      return sub ? 0 : 1;
    }
    if (sub === '--version' || sub === 'version') { ctx.out('git version ' + GIT_VER + '\n'); return 0; }
    var rest = args.slice(1);
    if (sub === 'config') {
      var g = rest.filter(function (a) { return a !== '--global' && a !== '--local' && a !== '--system'; });
      if (g[0] === '--list' || g[0] === '-l') { var cf = termState.gitConfig; var lines = []; if (cf.name) lines.push('user.name=' + cf.name); if (cf.email) lines.push('user.email=' + cf.email); lines.push('core.autocrlf=true'); ctx.out(lines.join('\n') + '\n'); return 0; }
      if (g.length === 1) { var key = g[0].toLowerCase(), v = key === 'user.name' ? termState.gitConfig.name : (key === 'user.email' ? termState.gitConfig.email : null); if (v) { ctx.out(v + '\n'); return 0; } return 1; }
      if (g.length >= 2) { var k2 = g[0].toLowerCase(); if (k2 === 'user.name') termState.gitConfig.name = g[1]; else if (k2 === 'user.email') termState.gitConfig.email = g[1]; return 0; }
      return 1;
    }
    if (sub === 'init') {
      var tdir = s.cwd;
      if (rest[0] && rest[0].charAt(0) !== '-') { var rr = resolvePath(s, rest[0]); if (rr.err) { ctx.native('fatal: cannot mkdir ' + rest[0] + ': No such file or directory\n'); return 128; } tdir = rr.abs; if (!vfs.exists(tdir)) vfs.mkdir(tdir, { by: 'terminal', parents: true }); }
      var again = vfs.isDir(vfs.join(tdir, '.git'));
      if (!again) {
        vfs.mkdir(vfs.join(tdir, '.git'), { by: 'system' });
        vfs.writeFile(vfs.join(tdir, '.git/config'), '[core]\n\trepositoryformatversion = 0\n\tfilemode = false\n\tbare = false\n\tlogallrefupdates = true\n\tignorecase = true\n', { by: 'system' });
        vfs.writeFile(vfs.join(tdir, '.git/description'), 'Unnamed repository; edit this file \'description\' to name the repository.\n', { by: 'system' });
        gitSave(s, tdir, { head: 'master', branches: { master: null }, commits: {}, index: {} });
        ctx.native("hint: Using 'master' as the name for the initial branch. This default branch name\nhint: is subject to change. To configure the initial branch name to use in all\nhint: of your new repositories, which will suppress this warning, call:\nhint:\nhint: \tgit config --global init.defaultBranch <name>\nhint:\nhint: Names commonly chosen instead of 'master' are 'main', 'trunk' and\nhint: 'development'. The just-created branch can be renamed via this command:\nhint:\nhint: \tgit branch -m <name>\n");
      }
      ctx.out((again ? 'Reinitialized existing' : 'Initialized empty') + ' Git repository in ' + winPath(vfs.join(tdir, '.git')).replace(/\\/g, '/') + '/\n');
      return 0;
    }
    if (sub === 'clone') { ctx.native("Cloning into '" + (rest[rest.length - 1] || 'repo').replace(/^.*[\/\\]/, '').replace(/\.git$/, '') + "'...\nfatal: unable to access '" + (rest[0] || '') + "': Could not resolve host: " + ((rest[0] || '').replace(/^https?:\/\//, '').split('/')[0]) + '\n'); return 128; }
    var root = gitRoot(s);
    if (!root) { ctx.native('fatal: not a git repository (or any of the parent directories): .git\n'); return 128; }
    var st = gitLoad(s, root), work = gitWorking(s, root);
    function save() { gitSave(s, root, st); }
    if (sub === 'status') {
      var short = rest.indexOf('-s') >= 0 || rest.indexOf('--short') >= 0, L = gitStatusLists(st, work), out = [];
      var untr = collapseUntracked(L.untracked, st.index);
      if (short) {
        var rows = {};
        L.staged.forEach(function (e) { rows[e[1]] = [e[0] === 'new file' ? 'A' : (e[0] === 'deleted' ? 'D' : 'M'), ' ']; });
        L.unstaged.forEach(function (e) { var r = rows[e[1]] || [' ', ' ']; r[1] = e[0] === 'deleted' ? 'D' : 'M'; rows[e[1]] = r; });
        Object.keys(rows).sort().forEach(function (p) { out.push(rows[p].join('') + ' ' + p); });
        untr.forEach(function (p) { out.push('?? ' + p); });
        if (out.length) ctx.out(out.join('\n') + '\n');
        return 0;
      }
      out.push('On branch ' + st.head);
      if (!st.branches[st.head]) out.push('', 'No commits yet');
      if (L.staged.length) { out.push('', 'Changes to be committed:', st.branches[st.head] ? '  (use "git restore --staged <file>..." to unstage)' : '  (use "git rm --cached <file>..." to unstage)'); L.staged.forEach(function (e) { out.push('\t' + padR(e[0] + ':', 12) + e[1]); }); }
      if (L.unstaged.length) { out.push('', 'Changes not staged for commit:', '  (use "git add <file>..." to update what will be committed)', '  (use "git restore <file>..." to discard changes in working directory)'); L.unstaged.forEach(function (e) { out.push('\t' + padR(e[0] + ':', 12) + e[1]); }); }
      if (untr.length) { out.push('', 'Untracked files:', '  (use "git add <file>..." to include in what will be committed)'); untr.forEach(function (p) { out.push('\t' + p); }); }
      out.push('');
      if (!L.staged.length && !L.unstaged.length) out.push(untr.length ? 'nothing added to commit but untracked files present (use "git add" to track)' : (st.branches[st.head] ? 'nothing to commit, working tree clean' : 'nothing to commit (create/copy files and use "git add" to track)'));
      else if (!L.staged.length) out.push('no changes added to commit (use "git add" and/or "git commit -a")');
      ctx.out(out.join('\n') + '\n');
      return 0;
    }
    if (sub === 'add') {
      var specs = rest.filter(function (a) { return a.charAt(0) !== '-'; }), all = rest.indexOf('-A') >= 0 || rest.indexOf('--all') >= 0;
      if (!specs.length && !all) { ctx.out('Nothing specified, nothing added.\nhint: Maybe you wanted to say \'git add .\'?\nhint: Disable this message with "git config set advice.addEmptyPathspec false"\n'); return 0; }
      var relCwd = s.cwd === root ? '' : s.cwd.slice(root.length + 1) + '/';
      var matched = 0;
      (all ? ['.'] : specs).forEach(function (sp) {
        var pre = sp === '.' ? relCwd : (relCwd + sp.replace(/\\/g, '/').replace(/^\.\//, '')).replace(/\/$/, '');
        var wild = hasWild(pre) ? wildRegex(pre) : null;
        Object.keys(work).forEach(function (p) { if (sp === '.' ? (relCwd === '' || p.indexOf(relCwd) === 0) : (wild ? wild.test(p) : (p === pre || p.indexOf(pre + '/') === 0))) { st.index[p] = work[p]; matched++; } });
        Object.keys(st.index).forEach(function (p) { if (!work[p] && (sp === '.' || p === pre || p.indexOf(pre + '/') === 0)) { delete st.index[p]; matched++; } });
        if (sp !== '.' && !matched) { ctx.native("fatal: pathspec '" + sp + "' did not match any files\n"); }
      });
      save();
      return matched || all || specs[0] === '.' ? 0 : 128;
    }
    if (sub === 'commit') {
      var mi = rest.indexOf('-m'), msg = null, auto = rest.indexOf('-a') >= 0 || rest.indexOf('-am') >= 0;
      rest.forEach(function (a, i) { if (a === '-m' || a === '-am') msg = rest[i + 1]; else if (/^-m./.test(a)) msg = a.slice(2); else if (/^--message=/.test(a)) msg = a.slice(10); });
      var id0 = gitIdentity(ctx);
      if (!id0) { ctx.native('Author identity unknown\n\n*** Please tell me who you are.\n\nRun\n\n  git config --global user.email "you@example.com"\n  git config --global user.name "Your Name"\n\nto set your account\'s default identity.\nOmit --global to set the identity only in this repository.\n\nfatal: unable to auto-detect email address (got \'' + USER + '@' + HOST + '.(none)\')\n'); return 128; }
      if (msg === null || msg === undefined) { ctx.native('Aborting commit due to empty commit message.\n'); return 1; }
      if (auto) { Object.keys(st.index).forEach(function (p) { if (work[p]) st.index[p] = work[p]; else delete st.index[p]; }); }
      var head = gitHeadTree(st), changed = [], ins = 0, del = 0, created = [];
      Object.keys(st.index).forEach(function (p) { if (!head[p]) { changed.push(p); created.push(p); ins += lineCount(st.index[p].c); } else if (!sameFile(st.index[p], head[p])) { changed.push(p); diffLines(head[p].c, st.index[p].c).forEach(function (o) { if (o[0] === '+') ins++; else if (o[0] === '-') del++; }); } });
      Object.keys(head).forEach(function (p) { if (!st.index[p]) { changed.push(p); del += lineCount(head[p].c); } });
      if (!changed.length) {
        var L2 = gitStatusLists(st, work), u2 = collapseUntracked(L2.untracked, st.index), o2 = ['On branch ' + st.head];
        if (!st.branches[st.head]) o2.push('', 'Initial commit');
        if (L2.unstaged.length) { o2.push('', 'Changes not staged for commit:', '  (use "git add <file>..." to update what will be committed)', '  (use "git restore <file>..." to discard changes in working directory)'); L2.unstaged.forEach(function (e) { o2.push('\t' + padR(e[0] + ':', 12) + e[1]); }); }
        if (u2.length) { o2.push('', 'Untracked files:', '  (use "git add <file>..." to include in what will be committed)'); u2.forEach(function (p) { o2.push('\t' + p); }); }
        o2.push('', L2.unstaged.length ? 'no changes added to commit (use "git add" and/or "git commit -a")' : (u2.length ? 'nothing added to commit but untracked files present (use "git add" to track)' : (st.branches[st.head] ? 'nothing to commit, working tree clean' : 'nothing to commit (create/copy files and use "git add" to track)')));
        ctx.out(o2.join('\n') + '\n');
        return 1;
      }
      var tree = JSON.parse(JSON.stringify(st.index)), parent = st.branches[st.head] || null;
      var id = fakeHash(JSON.stringify(tree) + msg + (parent || '') + LAB.clock.ms());
      st.commits[id] = { id: id, parent: parent, msg: msg, name: id0.name, email: id0.email, ts: LAB.clock.ms(), tree: tree };
      st.branches[st.head] = id;
      save();
      ctx.out('[' + st.head + (parent ? '' : ' (root-commit)') + ' ' + id.slice(0, 7) + '] ' + msg + '\n ' + changed.length + ' file' + (changed.length === 1 ? '' : 's') + ' changed' + (ins ? ', ' + ins + ' insertion' + (ins === 1 ? '' : 's') + '(+)' : '') + (del ? ', ' + del + ' deletion' + (del === 1 ? '' : 's') + '(-)' : '') + '\n' +
        created.sort().map(function (p) { return ' create mode 100644 ' + p + '\n'; }).join(''));
      return 0;
    }
    if (sub === 'log') {
      var one = rest.indexOf('--oneline') >= 0, nlim = null;
      rest.forEach(function (a, i) { if (/^-\d+$/.test(a)) nlim = +a.slice(1); else if (a === '-n') nlim = +rest[i + 1]; });
      var cid = st.branches[st.head];
      if (!cid) { ctx.native("fatal: your current branch '" + st.head + "' does not have any commits yet\n"); return 128; }
      var logs = [], cnt = 0;
      while (cid && st.commits[cid] && (nlim === null || cnt < nlim)) {
        var cm = st.commits[cid], refs = [];
        if (cnt === 0) refs.push('HEAD -> ' + st.head);
        Object.keys(st.branches).forEach(function (b) { if (st.branches[b] === cid && !(cnt === 0 && b === st.head)) refs.push(b); });
        var rtxt = refs.length ? ' (' + refs.join(', ') + ')' : '';
        if (one) logs.push(cid.slice(0, 7) + rtxt + ' ' + cm.msg);
        else { var dd = new Date(cm.ts); logs.push('commit ' + cid + rtxt + '\nAuthor: ' + cm.name + ' <' + cm.email + '>\nDate:   ' + DAY_EN[dd.getDay()].slice(0, 3) + ' ' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][dd.getMonth()] + ' ' + dd.getDate() + ' ' + two(dd.getHours()) + ':' + two(dd.getMinutes()) + ':' + two(dd.getSeconds()) + ' ' + dd.getFullYear() + ' +0800\n\n    ' + cm.msg + '\n'); }
        cid = cm.parent; cnt++;
      }
      ctx.out(logs.join(one ? '\n' : '\n') + '\n');
      return 0;
    }
    if (sub === 'branch') {
      var names = rest.filter(function (a) { return a.charAt(0) !== '-'; });
      if (names.length && rest.indexOf('-d') < 0 && rest.indexOf('-D') < 0) {
        if (!st.branches[st.head]) { ctx.native('fatal: not a valid object name: \'' + st.head + '\'\n'); return 128; }
        if (hasOwn.call(st.branches, names[0])) { ctx.native("fatal: a branch named '" + names[0] + "' already exists\n"); return 128; }
        st.branches[names[0]] = st.branches[st.head]; save(); return 0;
      }
      if (names.length && (rest.indexOf('-d') >= 0 || rest.indexOf('-D') >= 0)) {
        if (!hasOwn.call(st.branches, names[0])) { ctx.native("error: branch '" + names[0] + "' not found.\n"); return 1; }
        if (names[0] === st.head) { ctx.native("error: cannot delete branch '" + names[0] + "' used by worktree at '" + winPath(root).replace(/\\/g, '/') + "'\n"); return 1; }
        var gone = st.branches[names[0]]; delete st.branches[names[0]]; save(); ctx.out("Deleted branch " + names[0] + ' (was ' + String(gone).slice(0, 7) + ').\n'); return 0;
      }
      var bl = Object.keys(st.branches).sort();
      if (!st.branches[st.head]) bl = [st.head];
      ctx.out(bl.map(function (b) { return (b === st.head ? '* ' : '  ') + b; }).join('\n') + '\n');
      return 0;
    }
    if (sub === 'switch' || sub === 'checkout') {
      var create = rest.indexOf('-c') >= 0 || rest.indexOf('-b') >= 0 || rest.indexOf('-C') >= 0;
      var target = rest.filter(function (a) { return a.charAt(0) !== '-'; })[0];
      if (!target) { ctx.native('fatal: missing branch or commit argument\n'); return 128; }
      if (create) {
        if (hasOwn.call(st.branches, target)) { ctx.native("fatal: a branch named '" + target + "' already exists\n"); return 128; }
        st.branches[target] = st.branches[st.head]; st.head = target; save(); ctx.native("Switched to a new branch '" + target + "'\n"); return 0;
      }
      if (!hasOwn.call(st.branches, target)) { ctx.native("fatal: invalid reference: " + target + '\n'); return 128; }
      if (target === st.head) { ctx.native("Already on '" + target + "'\n"); return 0; }
      var cur = gitHeadTree(st), L3 = gitStatusLists(st, work);
      if (L3.unstaged.length || L3.staged.length) { ctx.native('error: Your local changes to the following files would be overwritten by checkout:\n' + L3.unstaged.concat(L3.staged).map(function (e) { return '\t' + e[1]; }).join('\n') + '\nPlease commit your changes or stash them before you switch branches.\nAborting\n'); return 1; }
      st.head = target;
      var nt = gitHeadTree(st);
      Object.keys(cur).forEach(function (p) { if (!nt[p]) { try { vfs.remove(vfs.join(root, p), { by: 'system', force: true }); } catch (e) { /* ignore */ } } });
      Object.keys(nt).forEach(function (p) { if (nt[p].c !== null) { var full = vfs.join(root, p); vfs.mkdir(vfs.dirname(full), { by: 'system', parents: true }); vfs.writeFile(full, nt[p].c, { by: 'system' }); } });
      st.index = JSON.parse(JSON.stringify(nt));
      save();
      ctx.native("Switched to branch '" + target + "'\n");
      return 0;
    }
    if (sub === 'diff') {
      var stat = rest.indexOf('--stat') >= 0, staged = rest.indexOf('--staged') >= 0 || rest.indexOf('--cached') >= 0;
      var base = staged ? gitHeadTree(st) : st.index, cmpTo = staged ? st.index : work, paths = {};
      Object.keys(base).forEach(function (p) { paths[p] = 1; }); Object.keys(cmpTo).forEach(function (p) { if (staged || base[p]) paths[p] = 1; });
      var files = Object.keys(paths).sort().filter(function (p) { return !sameFile(base[p], cmpTo[p]); });
      if (!files.length) return 0;
      if (stat) {
        var wmax = Math.max.apply(null, files.map(function (p) { return displayWidth(p); })), tin = 0, tdel = 0, rowsS = [];
        files.forEach(function (p) { var a = 0, d = 0; diffLines(base[p] ? base[p].c : '', cmpTo[p] ? cmpTo[p].c : '').forEach(function (o) { if (o[0] === '+') a++; else if (o[0] === '-') d++; }); tin += a; tdel += d; rowsS.push([p, a, d]); });
        ctx.out(rowsS.map(function (r) { return ' ' + padR(r[0], wmax) + ' | ' + padL(String(r[1] + r[2]), String(Math.max.apply(null, rowsS.map(function (x) { return x[1] + x[2]; }))).length) + ' ' + new Array(r[1] + 1).join('+') + new Array(r[2] + 1).join('-'); }).join('\n') + '\n ' + files.length + ' file' + (files.length === 1 ? '' : 's') + ' changed' + (tin ? ', ' + tin + ' insertion' + (tin === 1 ? '' : 's') + '(+)' : '') + (tdel ? ', ' + tdel + ' deletion' + (tdel === 1 ? '' : 's') + '(-)' : '') + '\n');
        return 0;
      }
      var text = [];
      files.forEach(function (p) {
        var ops = diffLines(base[p] ? base[p].c : '', cmpTo[p] ? cmpTo[p].c : '');
        text.push('diff --git a/' + p + ' b/' + p);
        if (!base[p]) text.push('new file mode 100644'); else if (!cmpTo[p]) text.push('deleted file mode 100644');
        text.push('index ' + fakeHash(p + (base[p] ? base[p].c : '')).slice(0, 7) + '..' + fakeHash(p + (cmpTo[p] ? cmpTo[p].c : '')).slice(0, 7) + (base[p] && cmpTo[p] ? ' 100644' : ''), '--- ' + (base[p] ? 'a/' + p : '/dev/null'), '+++ ' + (cmpTo[p] ? 'b/' + p : '/dev/null'));
        var first = -1, last = -1;
        ops.forEach(function (o, i) { if (o[0] !== ' ') { if (first < 0) first = i; last = i; } });
        var from = Math.max(0, first - 3), to = Math.min(ops.length - 1, last + 3), oldN = 0, newN = 0, oldStart = 1, newStart = 1;
        for (var i = 0; i < from; i++) { oldStart++; newStart++; }
        var body = [];
        for (var k = from; k <= to; k++) { var o = ops[k]; body.push(o[0] + o[1]); if (o[0] !== '+') oldN++; if (o[0] !== '-') newN++; }
        text.push('@@ -' + oldStart + ',' + oldN + ' +' + newStart + ',' + newN + ' @@');
        body.forEach(function (b) { text.push(b); });
      });
      ctx.out(text.join('\n') + '\n');
      return 0;
    }
    if (sub === 'remote') { return 0; }
    if (sub === 'push' || sub === 'pull' || sub === 'fetch') { ctx.native(sub === 'push' ? 'fatal: No configured push destination.\nEither specify the URL from the command-line or configure a remote repository using\n\n    git remote add <name> <url>\n\nand then push using the remote name\n\n    git push <name>\n' : 'fatal: No remote repository specified.  Please, specify either a URL or a\nremote name from which new revisions should be fetched.\n'); return 1; }
    if (!/^(add|am|archive|bisect|blame|branch|bundle|checkout|cherry-pick|clean|clone|commit|config|describe|diff|fetch|format-patch|gc|grep|init|log|maintenance|merge|mv|notes|pull|push|rebase|reflog|remote|reset|restore|revert|rm|shortlog|show|sparse-checkout|stash|status|submodule|switch|tag|worktree|help|version)$/.test(sub)) {
      ctx.native("git: '" + sub + "' is not a git command. See 'git --help'.\n");
      return 1;
    }
    ctx.native('（練習版的 git 還沒有 ' + sub + ' 這個指令）\n');
    return 1;
  }
  function winPath(internal) { return LAB.win && LAB.win.toWin ? LAB.win.toWin(internal) : winOfSegs(splitSegs(internal)); }

  /* names that exist only after `winget install` (git) or always (python: the Store stub) */
  var DYNAMIC = {
    git: { avail: function () { return !!termState.installed.git; }, def: { id: 'git', canon: 'git', native: true, name: 'git', run: cmdGit, nopaths: true } },
    'git.exe': { avail: function () { return !!termState.installed.git; }, def: { id: 'git', canon: 'git', native: true, name: 'git', run: cmdGit, nopaths: true } },
    python: { avail: function () { return true; }, def: { id: 'python', canon: 'python', native: true, name: 'python', run: cmdPython, nopaths: true } },
    'python.exe': { avail: function () { return true; }, def: { id: 'python', canon: 'python', native: true, name: 'python', run: cmdPython, nopaths: true } },
    python3: { avail: function () { return true; }, def: { id: 'python', canon: 'python', native: true, name: 'python3', run: cmdPython, nopaths: true } },
    'python3.exe': { avail: function () { return true; }, def: { id: 'python', canon: 'python', native: true, name: 'python3', run: cmdPython, nopaths: true } },
    pip: { avail: function () { return !!termState.installed.python; }, def: { id: 'pip', canon: 'python', native: true, name: 'pip', run: function (ctx) { ctx.out('pip 25.0.1 from C:\\Users\\' + USER + '\\AppData\\Local\\Programs\\Python\\Python312\\Lib\\site-packages\\pip (python 3.12)\n'); return 0; }, nopaths: true } }
  };

  /* ---- Start-Process and the small Windows programs that open an app of the practice PC */
  function cmdCalc(ctx) { ctx.effect({ type: 'launch', appId: 'calculator' }); return 0; }
  function cmdTaskmgr(ctx) { ctx.effect({ type: 'launch', appId: 'taskmgr' }); return 0; }
  defCmd({ id: 'calc', canon: 'open', native: true, name: 'calc', run: cmdCalc, nopaths: true }, ['calc']);
  defCmd({ id: 'taskmgr', canon: 'open', native: true, name: 'taskmgr', run: cmdTaskmgr, nopaths: true }, ['taskmgr']);

  /* commands that exist in real Windows but are not simulated: say so instead of claiming they do not exist.
     (ping, ipconfig, tree, cmd /c, curl, winget ... are simulated since round 5; `ver`, `time` and the other cmd built-ins are not PowerShell commands at all) */
  var TIER2 = ['powershell', 'wt', 'more', 'ssh', 'scp', 'xcopy', 'robocopy', 'attrib', 'net', 'netstat', 'reg', 'regedit', 'shutdown', 'mspaint', 'sfc', 'chkdsk', 'msinfo32', 'cleanmgr', 'diskpart', 'format',
    'icacls', 'takeown', 'wmic', 'schtasks', 'sc.exe', 'bash', 'wsl', 'new-object', 'compare-object', 'diff', 'start-job', 'get-job', 'get-uptime', 'get-variable', 'set-variable', 'remove-variable', 'get-volume', 'get-disk',
    'get-psdrive', 'get-timezone', 'get-culture', 'get-netipaddress', 'get-netadapter', 'start-service', 'stop-service', 'restart-service', 'set-executionpolicy', 'get-executionpolicy', 'get-eventlog', 'get-wmiobject', 'get-ciminstance'];
  TIER2.forEach(function (n) { if (!hasOwn.call(CMDS, n)) CMDS[n] = { id: 'tier2', canon: 'unknown', tier2: true, name: n }; });

  /* the names Tab completes for the first word of a statement, with their real spelling (cmdlets as written in the help, aliases and programs in lower case) */
  var COMPLETE_NAMES = [];
  (function () {
    var seen = {};
    function add(n) { var l = n.toLowerCase(); if (!seen[l]) { seen[l] = 1; COMPLETE_NAMES.push(n); } }
    Object.keys(CMDS).forEach(function (k) {
      var d = CMDS[k];
      if (d.tier2 || k.indexOf('.') > 0 && !/\.exe$/.test(k)) return;
      if (d.spec && d.spec.name.toLowerCase() === k) add(d.spec.name); else add(k);
    });
    ['git', 'cd..'].forEach(add);
  })();

  /* ------------------------------------------------------------ executor */
  function newJob(src, session) {
    return {
      src: src, cwd0: session.cwd, cmds: [], current: null, totalOut: '', stepOut: '', stream: [], effects: [],
      print: function (s) {
        if (!s) return;
        this.totalOut += s; this.stepOut += s;
        var l = this.stream;
        if (typeof l[l.length - 1] === 'string') l[l.length - 1] += s; else l.push(s);
      },
      printErr: function (s) {
        if (!s) return;
        this.totalOut += s; this.stepOut += s;
        var l = this.stream, last = l[l.length - 1];
        if (last && typeof last === 'object' && last.err !== undefined) last.err += s; else l.push({ err: s });
      },
      /* text in another colour class (warnings) */
      printCls: function (s, cls) {
        if (!s) return;
        this.totalOut += s; this.stepOut += s;
        var l = this.stream, last = l[l.length - 1];
        if (last && typeof last === 'object' && last.cls === cls) last.text += s; else l.push({ cls: cls, text: s });
      },
      pushEffect: function (e) { this.effects.push(e); this.stream.push(e); }
    };
  }

  function lookupCommand(nameL, session) {
    if (session.aliases && hasOwn.call(session.aliases, nameL)) {
      var tgt = String(session.aliases[nameL]).toLowerCase();
      if (hasOwn.call(CMDS, tgt)) return { def: CMDS[tgt] };
    }
    if (session.funcs && hasOwn.call(session.funcs, nameL)) return { fn: session.funcs[nameL] };
    if (hasOwn.call(CMDS, nameL)) return { def: CMDS[nameL] };
    if (nameL === 'cd..') return { def: CMDS.cd, fixedPath: '..' };
    if (nameL === 'cd\\') return { def: CMDS.cd, fixedPath: '\\' };
    var m = /^(.*[\\\/])?([^\\\/]+)\.(?:exe|cmd)$/.exec(nameL);
    if (m && hasOwn.call(CMDS, m[2]) && CMDS[m[2]].native) {
      if (!m[1]) return { def: CMDS[m[2]] };
      if (/^c:[\\\/]windows[\\\/]system32[\\\/]$/.test(m[1]) || /^c:[\\\/]windows[\\\/]$/.test(m[1]) || /^\.?[\\\/]$/.test(m[1])) return { def: CMDS[m[2]] };
    }
    if (hasOwn.call(DYNAMIC, nameL) && DYNAMIC[nameL].avail()) return { def: DYNAMIC[nameL].def };
    return null;
  }
  function isJump(e) { return !!e && typeof e === 'object' && e.jump !== undefined; }

  /* the single expression of a statement list like ( 1,2,3 ) or @( 5 ): evaluated directly, so an array stays an array */
  function directExpr(stmts) {
    if (stmts.length !== 1) return null;
    var st = stmts[0];
    if (st.kind !== 'pipe' || st.pipes.length !== 1) return null;
    var stage = st.pipes[0].cmds[0];
    if (!stage.expr || (stage.redirs && stage.redirs.length) || stage.expr.t === 'inc') return null;
    return stage.expr;
  }

  function* execStmts(stmts, session, job, opt) {
    opt = opt || {};
    var last = session.status;
    for (var i = 0; i < stmts.length; i++) {
      var st = stmts[i];
      try {
        last = yield* execStmt(st, session, job, opt);
      } catch (e) {
        if (isJump(e)) throw e;
        if (isPSError(e)) {
          if (opt.propagate) throw e;
          pushError(session, e.ps);
          job.printErr(looseErrorText(e, job, session, st));
          last = 1;
          session.status = 1;
          if (e.ps && e.ps.fatal) return 1;              // throw / -ErrorAction Stop: the rest of the line does not run
          continue;
        }
        throw e;
      }
      session.status = last;
    }
    return last;
  }

  function* execStmt(st, session, job, opt) {
    switch (st.kind) {
      case 'pipe': return yield* execPipeline(st, session, job, opt);
      case 'assign': return yield* execAssign(st, session, job, opt);
      case 'if': {
        for (var c = 0; c < st.clauses.length; c++) {
          if (truthyOf(st.clauses[c].cond, session)) return yield* execStmts(st.clauses[c].body, session, job, opt);
        }
        if (st.elseBody) return yield* execStmts(st.elseBody, session, job, opt);
        return session.status;
      }
      case 'foreach': {
        var items = enumerateValue(valueOfStmts(st.list, session));
        var guard = 0;
        for (var i = 0; i < items.length && guard++ < 100000; i++) {
          setVar(session, st.name, items[i]);
          try { yield* execStmts(st.body, session, job, opt); }
          catch (e) { if (isJump(e) && e.jump === 'break') break; if (isJump(e) && e.jump === 'continue') continue; throw e; }
        }
        return session.status;
      }
      case 'for': {
        var sink = [];
        if (st.init) yield* execStmts([st.init], session, job, { collect: sink, propagate: true });
        var g2 = 0;
        while (g2++ < 100000 && (!st.cond || truthyOf([st.cond], session))) {
          try { yield* execStmts(st.body, session, job, opt); }
          catch (e) { if (isJump(e) && e.jump === 'break') break; if (!(isJump(e) && e.jump === 'continue')) throw e; }
          if (st.step) yield* execStmts([st.step], session, job, { collect: sink, propagate: true });
        }
        return session.status;
      }
      case 'while': {
        var g3 = 0;
        while (g3++ < 100000 && truthyOf(st.cond, session)) {
          try { yield* execStmts(st.body, session, job, opt); }
          catch (e) { if (isJump(e) && e.jump === 'break') break; if (!(isJump(e) && e.jump === 'continue')) throw e; }
        }
        return session.status;
      }
      case 'function': session.funcs[st.name.toLowerCase()] = { name: st.name, params: st.params, body: st.body }; return session.status;
      case 'try': {
        try {
          yield* execStmts(st.body, session, job, { collect: opt.collect, propagate: true });
        } catch (e) {
          if (isJump(e)) throw e;
          if (!isPSError(e)) throw e;
          if (st.catches.length) {
            var saved = session.item;
            session.item = errorRecord(e);
            try { yield* execStmts(st.catches[0], session, job, opt); } finally { session.item = saved; }
          }
        } finally {
          if (st.fin) yield* execStmts(st.fin, session, job, opt);
        }
        return session.status;
      }
      case 'jump': {
        var val = st.value ? valueOfStmts([st.value], session) : null;
        if (st.what === 'throw') throw psErr({ msg: st.value ? strOf(val) : '發生了一個到達 throw 陳述式的例外狀況。', cat: 'OperationStopped', target: strOf(val), ttype: 'String', activity: '', reason: 'RuntimeException', fq: st.value ? strOf(val) : 'ScriptHalted', start: st.start, len: Math.max(1, st.end - st.start), fatal: true });
        throw { jump: st.what, value: val };
      }
    }
    return session.status;
  }
  /* the red text of an error raised outside a command stage (an `if (1/0)` condition, an assignment) */
  function looseErrorText(e, job, session, st) {
    var o = e.ps;
    o.src = job.src;
    if (o.start === undefined) { o.start = st.start; o.len = Math.max(1, st.end - st.start); }
    if (o.head === undefined) o.head = '';
    return errorText(o, session.cols || 120);
  }
  function valueOfStmts(stmts, session) {
    var d = directExpr(stmts);
    if (d) return ev(d, session);
    return unwrapOut(runSub(stmts, session));
  }
  function truthyOf(stmts, session) {
    var d = directExpr(stmts);
    if (d) return toBool(ev(d, session));
    return blockTruthy(runSub(stmts, session));
  }
  function errorRecord(e) {
    var o = e.ps || {};
    var ex = mkObj([['Message', o.msg || ''], ['HResult', -2146233087]], 'System.Management.Automation.RuntimeException', { str: function () { return o.msg || ''; }, fmt: 'table' });
    return mkObj([['Exception', ex], ['TargetObject', o.target || null], ['CategoryInfo', (o.cat || 'NotSpecified')], ['FullyQualifiedErrorId', o.fq || '']], 'System.Management.Automation.ErrorRecord', { str: function () { return o.msg || ''; }, fmt: 'table' });
  }

  function* execAssign(st, session, job, opt) {
    var src = job.src;
    var entry = { name: src.slice(st.start, st.opAt).trim().toLowerCase(), args: [], cwd: session.cwd, cwdAfter: session.cwd, status: 0, out: '', canon: 'var', paths: [] };
    job.cmds.push(entry);
    job.current = entry;
    var status = 0;
    try {
      var d = directExpr([st.rhs]);
      var v;
      if (d) v = ev(d, session);
      else {
        var objs = [];
        yield* execStmts([st.rhs], session, job, { collect: objs, propagate: true });
        v = unwrapOut(objs);
        if (st.rhs.kind === 'pipe' && st.rhs.pipes.length === 1 && st.rhs.pipes[0].cmds[0].words && objs.length === 0) v = null;
      }
      assignTo(st.target, v, session, st.op);
    } catch (e) {
      if (!isPSError(e)) throw e;
      status = 1;
      if (opt.propagate) { entry.status = 1; session.status = 1; throw e; }
      var text = looseErrorText(e, job, session, st);
      entry.out += text;
      job.printErr(text);
    }
    entry.status = status;
    session.status = status;
    return status;
  }

  function* execPipeline(st, session, job, opt) {
    var input = null, status = 0, n = st.pipes.length;
    for (var k = 0; k < n; k++) {
      var stage = st.pipes[k].cmds[0], isLast = k === n - 1;
      var so = { input: input, last: isLast, collect: isLast ? (opt.collect || null) : [], propagate: !!opt.propagate, stageNo: k, nstages: n, objs: [] };
      status = yield* execStage(stage, session, job, so);
      input = so.objs;
    }
    return status;
  }

  /* run one stage of a pipeline: a command, an expression, or & { block } */
  function* execStage(stage, session, job, so) {
    var vfs = session.vfs, src = job.src;
    CUR.session = session;
    var isCmd = !!stage.words, isExpr = !!stage.expr;
    var words = stage.words || [], first = words[0];
    var entry = { name: '', args: [], cwd: session.cwd, cwdAfter: session.cwd, status: 0, out: '', canon: 'unknown', paths: [] };
    job.cmds.push(entry);
    job.current = entry;

    // redirections: > file, >> file, 2> file, 2>&1, *> file, > $null
    var redirOut = null, errRedir = null, errToOut = false, redirs = [], buf = '', errBuf = '';
    (stage.redirs || []).forEach(function (r) {
      if (r.merge) { if (r.stream === 2 || r.stream === '*') errToOut = true; return; }
      var tv = tokValue(r.target, session);
      var path = tv === null || tv === undefined ? null : strOf(tv);
      var disc = path === null || path === '' || /^nul$/i.test(path);
      var rec = { op: r.op, path: disc ? null : path, stream: r.stream };
      if (r.stream === 2 || r.stream === '*') errRedir = rec;
      if (r.stream === 1 || r.stream === '*') { redirOut = rec; redirs.push(rec); }
    });
    var hostOut = so.collect === null && !redirOut;      // printed straight to the screen

    var ctx = {
      session: session, vfs: vfs, src: src, cmd: stage, cols: session.cols || 120, silent: false, name: '', spec: null, p: null, rawArgs: [], sleepMs: 0,
      input: so.input, isLast: so.last, objs: [], so: so, errorStop: false, hasInput: so.input !== null && so.input !== undefined && so.stageNo > 0,
      emit: function (o) {
        if (Array.isArray(o)) { for (var i = 0; i < o.length; i++) if (o[i] !== null && o[i] !== undefined) ctx.objs.push(o[i]); }
        else if (o !== null && o !== undefined) ctx.objs.push(o);
      },
      emitOne: function (o) { if (o !== null && o !== undefined) ctx.objs.push(o); },
      /* text a native program prints: lines become string objects in a pipeline, plain text on the screen */
      out: function (s) {
        if (!s) return;
        if (so.collect !== null || redirOut) {
          if (so.collect !== null && !redirOut) { var ls = s.replace(/\r?\n$/, '').split(/\r?\n/); ls.forEach(function (l) { ctx.objs.push(l); }); return; }
          buf += s; return;
        }
        entry.out += s; job.print(s);
      },
      host: function (s) { if (!s) return; entry.out += s; job.print(s); },
      record: function (s) { if (!s) return; entry.out += s; job.totalOut += s; },
      warn: function (s) { if (!s) return; entry.out += s; job.printCls(s, 'warn'); },
      hostCls: function (s, cls) { if (!s) return; entry.out += s; job.printCls(s, cls); },
      err: function (s) {
        if (!s) return;
        if (errRedir) { if (errRedir.path !== null) errBuf += s; return; }
        if (errToOut && redirOut) { buf += s; return; }
        if (errToOut && so.collect !== null) { s.replace(/\r?\n$/, '').split(/\r?\n/).forEach(function (l) { ctx.objs.push(l); }); return; }
        entry.out += s; job.printErr(s);
      },
      native: function (s) { ctx.out(s); },
      effect: function (e) { job.pushEffect(e); },
      fail: function (o) {
        o.src = src;
        if (o.start === undefined) o.start = o.tokStart !== undefined ? o.tokStart : stage.start;
        if (o.len === undefined) o.len = o.tokLen !== undefined ? o.tokLen : Math.max(1, stage.end - stage.start);
        if (o.head === undefined) o.head = ctx.name;
        if (ctx.errorStop || errorActionStop(session)) { o.fatal = true; throw psErr(o); }          // -ErrorAction Stop ends the whole line, like a script-terminating error
        pushError(session, o);
        if (!ctx.silent && !errorActionSilent(session)) ctx.err(errorText(o, ctx.cols));
        return 1;
      }
    };

    var status = 0, cancelled = true, pending = null, ran = false;
    function printStageError(e) {
      var o = e.ps;
      o.src = src;
      if (o.start === undefined) { o.start = stage.start; o.len = Math.max(1, stage.end - stage.start); }
      if (o.head === undefined) o.head = '';
      pushError(session, o);
      ctx.err(errorText(o, ctx.cols));
    }
    try {
      if (isExpr) {
        entry.name = src.slice(stage.start, stage.end).trim().toLowerCase(); entry.canon = 'echo';
        var v = ev(stage.expr, session);
        if (stage.expr.t !== 'inc') ctx.emit(v);
      } else if (stage.block) {
        entry.name = '&'; entry.canon = 'echo';
        var bv = ev(stage.block, session);
        var outs = invokeBlock(bv, session, session.item, { propagate: true });
        ctx.emit(outs);
      } else {
        // a command
        var nameV = !first ? '' : (first.k === 'param' ? first.text : tokValue(first, session));
        if (!first) {
          entry.name = '';                    // a bare redirection (`> file`) just makes the empty file
        } else if (isBlock(nameV) && stage.callOp) {
          entry.name = '&'; entry.canon = 'echo';
          ctx.emit(invokeBlock(nameV, session, session.item, { propagate: true }));
        } else {
          ctx.name = first.k === 'param' ? first.text : strOf(nameV);
          var nameL = ctx.name.toLowerCase();
          entry.name = nameL;
          // the typed words (without the command), as PowerShell hands them on
          ctx.rawArgs = [];
          words.slice(1).forEach(function (t) {
            var tv = t.k === 'param' ? t.text + (t.value ? ':' + strOf(tokValue(t.value, session)) : '') : tokValue(t, session);
            if (t.k === 'word' && t.arr) entry.args.push(strOf(tv).split(' ').join(','));
            else entry.args.push(strOf(tv));
            if (t.k === 'param') { ctx.rawArgs.push(tv); return; }
            if (Array.isArray(tv)) tv.forEach(function (x) { ctx.rawArgs.push(strOf(x)); }); else ctx.rawArgs.push(tv === null || tv === undefined ? '' : strOf(tv));
          });
          var found = lookupCommand(nameL, session);
          if (!found) {
            // a path to something that exists opens it like Explorer does; anything else is "not recognised"
            var isPathy = /[\\\/]/.test(ctx.name) && !hasWild(ctx.name);
            var pr = isPathy ? resolvePath(session, ctx.name) : null;
            var pst = pr && !pr.err ? vfs.stat(pr.abs) : null;
            if (pst && pst.type !== 'dir') { entry.canon = 'open'; ctx.effect({ type: 'open', path: pst.path }); ran = true; }
            else {
              entry.canon = nameL === 'unzip' ? 'unzip' : 'unknown';
              /* a statement-terminating error, like in PowerShell: try/catch catches it, and the next statement of the line still runs */
              throw psErr({ msg: "無法辨識 '" + ctx.name + "' 詞彙是否為 Cmdlet、函數、指令檔或可執行程式的名稱。請檢查名稱拼字是否正確，如果包含路徑的話，請確認路徑是否正確，然後再試一次。",
                cat: 'ObjectNotFound', target: ctx.name, activity: '', reason: 'CommandNotFoundException', fq: 'CommandNotFoundException', head: ctx.name, start: first.start, len: first.end - first.start });
            }
          } else if (found.fn) {
            entry.canon = 'var';
            callUserFunction(found.fn, words.slice(1), session, ctx);
          } else {
            var def = found.def;
            entry.canon = def.canon;
            if (def.tier2) { ctx.native(ctx.name + ': 這個指令真的 Windows 上有，但練習版還沒做\n'); status = 1; }
            else {
              ctx.def = def;
              ctx.spec = def.spec || null;
              var proceed = true;
              if (def.spec) {
                var rest = words.slice(1);
                if (found.fixedPath !== undefined) rest = [{ k: 'word', parts: [{ k: 'lit', s: found.fixedPath }], text: found.fixedPath, start: first.end, end: first.end, quoted: true }].concat(rest);
                var b = bindArgs(ctx, def.spec, rest);
                if (!b.ok) { status = 1; proceed = false; }
                else {
                  ctx.p = b.p;
                  if (def.canonOf) entry.canon = def.canonOf(ctx);
                }
              }
              if (proceed) {
                // the folders / files the command was pointed at, as internal paths (missions use these)
                if (!def.nopaths) {
                  var posWords = ctx.rawArgs.filter(function (a) { return typeof a === 'string' && a.charAt(0) !== '-' && a !== ''; });
                  if (def.id === 'ls' && !posWords.length) entry.paths.push(session.cwd);
                  posWords.forEach(function (a) {
                    if (def.id === 'tar' || def.id === 'echo' || def.id === 'host' || def.id === 'help') return;
                    var r = resolvePath(session, a);
                    if (!r.err) entry.paths.push(r.abs);
                  });
                }
                // the target of a redirection exists (and is emptied) before the command runs, as in PowerShell: ls > o.txt lists o.txt
                redirs.forEach(function (r) {
                  try { var rr0 = r.path === null ? null : resolvePath(session, r.path); if (rr0 && !rr0.err && !vfs.isDir(rr0.abs) && (r.op === '>' || !vfs.exists(rr0.abs))) vfs.writeFile(rr0.abs, '', { by: 'terminal' }); } catch (e0) { /* reported after the run */ }
                });
                var rc = def.run(ctx);
                if (rc && typeof rc.next === 'function') rc = yield* rc;
                if (typeof rc === 'number') status = rc;
                if (ctx.sleepMs) { yield { sleep: ctx.sleepMs }; }
                ran = true;
              }
            }
          }
        }
      }
      cancelled = false;
    } catch (e) {
      cancelled = false;
      if (isPSError(e)) { status = 1; if (so.propagate || (e.ps && e.ps.fatal)) pending = e; else printStageError(e); }
      else if (isJump(e)) pending = e;
      else throw e;
    } finally {
      entry.cwdAfter = session.cwd;
      entry.status = status;
      session.status = status;
      if (!cancelled) {
        // the output objects: to the next stage, to the collector of a nested pipeline, to a file, or to the screen
        if (so.last && so.collect === null || redirOut) {
          var text = renderObjs(ctx.objs, session, ctx.cols);
          if (redirOut) buf += text; else if (text) { entry.out += text; job.print(text); }
          so.objs = [];
        } else {
          so.objs = ctx.objs;
          if (so.last && so.collect) { for (var oi = 0; oi < ctx.objs.length; oi++) so.collect.push(ctx.objs[oi]); }
          if (!(so.last && so.collect)) entry.out += previewText(ctx.objs, session, ctx.cols);
        }
      }
      if (redirs.length || errRedir) {
        var all = redirs.slice();
        if (errRedir && errRedir.path !== null && errRedir !== redirOut) all.push(errRedir);
        all.forEach(function (r) {
          try {
            if (r.path === null) return;
            var rr = resolvePath(session, r.path);
            if (rr.err) throw new Error('drive');
            if (vfs.isDir(rr.abs)) throw new vfs.VfsError('EISDIR', r.path);
            var content = r === redirOut ? buf + (r === errRedir ? errBuf : '') : errBuf;
            vfs.writeFile(rr.abs, content, { by: 'terminal', append: r.op === '>>' });
          } catch (e) {
            var rr2 = resolvePath(session, r.path);
            var denied = e && (e.code === 'EISDIR' || e.code === 'EACCES' || e.code === 'EPROTECTED');
            ctx.err(errorText({ head: 'out-file', msg: denied ? "拒絕存取路徑 '" + rr2.disp + "'。" : "找不到路徑 '" + (rr2.disp || r.path) + "' 的一部分。", cat: denied ? 'PermissionDenied' : 'OpenError', target: rr2.disp || r.path, activity: 'Out-File',
              reason: denied ? 'UnauthorizedAccessException' : 'DirectoryNotFoundException', fq: 'FileOpenFailure,Microsoft.PowerShell.Commands.OutFileCommand', src: src, start: stage.start, len: Math.max(1, stage.end - stage.start) }, ctx.cols));
          }
        });
      }
    }
    if (pending) throw pending;
    entry.status = status;
    session.status = status;
    return status;
  }
  function pushError(session, o) {
    if (!o) return;
    (session.errors || (session.errors = [])).push(errorRecord({ ps: o }));
    if (session.errors.length > 256) session.errors.shift();
  }
  function errorActionSilent(session) {
    var v = session.vars && session.vars.erroractionpreference;
    return typeof v === 'string' && /^(silentlycontinue|ignore)$/i.test(v);
  }
  function errorActionStop(session) {
    var v = session.vars && session.vars.erroractionpreference;
    return typeof v === 'string' && v.toLowerCase() === 'stop';
  }
  /* what a stage that did not print would have printed: the `out` of the pipe stages before the last one */
  function previewText(objs, session, cols) {
    if (!objs || !objs.length) return '';
    try { return renderObjs(objs.slice(0, 300), session, cols); } catch (e) { return ''; }
  }

  /* a function defined with `function Name($a, $b) { ... }` */
  function callUserFunction(fn, argWords, session, ctx) {
    var vals = [];
    argWords.forEach(function (t) {
      if (t.k === 'param') { vals.push(t.text); return; }
      var v = tokValue(t, session, true);
      vals.push(v);
    });
    var savedArgs = session.args, savedVars = {};
    session.args = vals;
    fn.params.forEach(function (p, i) { var k = p.toLowerCase(); savedVars[k] = hasOwn.call(session.vars, k) ? session.vars[k] : undefined; session.vars[k] = i < vals.length ? vals[i] : null; });
    try {
      var objs = [];
      try { runSync(execStmts(fn.body, session, session.job, { collect: objs, propagate: true })); }
      catch (e) { if (isJump(e) && e.jump === 'return') { if (e.value !== null && e.value !== undefined) objs.push(e.value); } else throw e; }
      ctx.emit(objs);
    } finally {
      session.args = savedArgs;
      fn.params.forEach(function (p) { var k = p.toLowerCase(); if (savedVars[k] === undefined) delete session.vars[k]; else session.vars[k] = savedVars[k]; });
    }
  }

  /* ------------------------------------------------------------ session and run */
  var sessionCounter = 0;
  /* the environment of a new window: what winget installed is on the PATH of windows opened afterwards (as on a real PC) */
  function freshEnv() {
    var e = Object.assign({}, ENVV);
    if (termState.installed.git) e.PATH += ';C:\\Program Files\\Git\\cmd';
    if (termState.installed.python) e.PATH += ';C:\\Users\\' + USER + '\\AppData\\Local\\Programs\\Python\\Python312\\Scripts\\;C:\\Users\\' + USER + '\\AppData\\Local\\Programs\\Python\\Python312\\';
    return e;
  }
  function newSession(o) {
    o = o || {};
    var vfs = o.vfs || LAB.vfs;
    var cwd = vfs.canon(o.cwd || HOME);
    return {
      id: 's' + (++sessionCounter), cwd: cwd, shown: splitSegs(cwd), oldpwd: null,
      env: { HOME: HOME, USER: USER, PWD: cwd, HOSTNAME: HOST, COMPUTERNAME: HOST },
      status: 0, history: [], hist: [], histId: 0, stack: [], cols: o.cols || 120, tty: o.tty === undefined ? 0 : o.tty, vfs: vfs,
      prompt: null, pending: null, ps2: null, alive: true, gen: null, job: null, sleeping: null,
      procCwd: cwd, vars: Object.create(null), envv: freshEnv(), item: null, funcs: Object.create(null), aliases: Object.create(null), errors: [], lastExit: null, args: []
    };
  }

  function stepResult(session, job, done) {
    var first = job.cmds[0] || null;
    var res = {
      out: job.stepOut, status: session.status, cwdAfter: session.cwd, effects: job.effects, stream: job.stream,
      name: first ? first.name : '', args: first ? first.args : [], cwd: first ? first.cwd : job.cwd0,
      cmds: job.cmds, done: done, event: null, line: job.src
    };
    if (done) {
      res.event = {
        line: job.src, name: res.name, args: res.args, cwd: res.cwd, cwdAfter: session.cwd,
        status: session.status, out: job.totalOut, cmds: job.cmds
      };
    }
    return res;
  }
  function emptyResult(session) {
    var job = newJob('', session);
    var r = stepResult(session, job, true);
    r.event = null;
    return r;
  }
  function advance(session, input) {
    var job = session.job;
    job.stepOut = ''; job.effects = []; job.stream = [];
    session.prompt = null;
    var r;
    try { r = session.gen.next(input); }
    catch (e) {
      console.error('[shell] internal error', e);
      job.printErr('練習版的 PowerShell 出錯了：' + (e && e.message ? e.message : e) + '\n');
      session.status = 1;
      r = { done: true };
    }
    if (!r.done) {
      var v = r.value || {};
      if (v.sleep !== undefined) { session.sleeping = { ms: v.sleep }; job.pushEffect({ type: 'sleep', ms: v.sleep }); }
      if (v.prompt !== undefined) session.prompt = v.prompt;
      return stepResult(session, job, false);
    }
    session.gen = null; session.job = null; session.sleeping = null; session.prompt = null;
    return stepResult(session, job, true);
  }

  function run(line, session) {
    if (!session.alive) return emptyResult(session);
    if (session.prompt && session.gen) return advance(session, String(line));       // the answer to a question the running command asked (Remove-Item, Read-Host, python)
    if (session.sleeping) return emptyResult(session);
    var src = String(line);
    if (session.pending !== null) src = session.pending + '\n' + src;
    var lx = lex(src);
    if (lx.incomplete && !lx.parseError) {
      session.pending = src;
      session.ps2 = lx.incomplete;
      var jc = newJob(src, session);
      jc.pushEffect({ type: 'continue', ps2: lx.incomplete });
      var rc = stepResult(session, jc, false);
      rc.continued = true;
      return rc;
    }
    session.pending = null; session.ps2 = null;
    if (src.replace(/\s+/g, '') === '') return emptyResult(session);
    var job = newJob(src, session);
    var firstWord = (/^\s*(?:&\s*)?([^\s;|&<>(){}]+)/.exec(src) || [0, ''])[1].toLowerCase();
    if (lx.parseError) {
      var pe = lx.parseError;
      var text = errorText({ parse: true, msg: pe.msg, fq: pe.fq, src: src, start: pe.start, len: pe.len, noPos: pe.noPos }, session.cols);
      job.printErr(text);
      job.cmds.push({ name: firstWord, args: [], cwd: session.cwd, cwdAfter: session.cwd, status: 1, out: text, canon: 'unknown', paths: [], parseError: true });
      session.status = 1;
      return stepResult(session, job, true);
    }
    if (lx.unsupported) {
      var um = '（練習版還沒有做這種寫法：' + lx.unsupported + '）\n';
      job.print(um);
      job.cmds.push({ name: firstWord, args: [], cwd: session.cwd, cwdAfter: session.cwd, status: 1, out: um, canon: 'unknown', paths: [], unsupported: true });
      session.status = 1;
      return stepResult(session, job, true);
    }
    if (!lx.stmts.length) return emptyResult(session);
    session.hist.push({ id: ++session.histId, line: src, t: LAB.clock.ms() });
    session.job = job;
    session.gen = execStmts(lx.stmts, session, job, {});
    return advance(session, undefined);
  }
  function resume(session) {
    if (!session.gen) return null;
    session.sleeping = null;
    return advance(session, undefined);
  }
  /* Ctrl+C while something is running (Start-Sleep) or an unfinished line */
  function cancel(session) {
    if (session.gen) {
      var job = session.job;
      job.stepOut = ''; job.effects = []; job.stream = [];
      try { session.gen.return(); } catch (e) { /* ignore */ }          // runs the command's finally block first ...
      if (job.current) job.current.status = 130;                          // ... so 130 is what stays
      session.status = 130;
      session.gen = null; session.job = null; session.sleeping = null; session.prompt = null;
      return stepResult(session, job, true);
    }
    if (session.pending !== null) { session.pending = null; session.ps2 = null; }
    return null;
  }

  /* ------------------------------------------------------------ Tab completion (PowerShell: the first Tab fills the first match, the next ones cycle) */
  function needsQuote(s) { return /[\s'",;&$@#`(){}\[\]]/.test(s); }
  /* what the word under the cursor is: text before the cursor only */
  function scanForComplete(text) {
    var cur = null, quote = null, atCmd = true, cmdName = null, prevParam = null;
    function begin(i) { cur = { start: i, raw: '', quote: null, isCmd: atCmd, cmdName: atCmd ? null : cmdName }; }
    function end() {
      if (!cur) return;
      if (cur.isCmd) cmdName = cur.raw;
      prevParam = /^-[A-Za-z]/.test(cur.raw) && !cur.quote ? cur.raw : null;
      atCmd = false; cur = null;
    }
    for (var i = 0; i < text.length; i++) {
      var c = text.charAt(i);
      if (quote) {
        if (c === quote) { quote = null; cur.raw += c; continue; }
        cur.raw += c; continue;
      }
      if (c === '"' || c === "'") { if (!cur) begin(i); quote = c; cur.quote = c; cur.raw += c; continue; }
      if (c === '`') { if (!cur) begin(i); cur.raw += c; if (i + 1 < text.length) { cur.raw += text.charAt(i + 1); i++; } continue; }
      if (c === ' ' || c === '\t') { end(); continue; }
      if (c === ';' || c === '|' || c === '&' || c === '{' || c === '(') { end(); atCmd = true; cmdName = null; continue; }
      if (c === '}' || c === ')') { end(); atCmd = false; continue; }
      if (c === '>' || c === '<') { end(); atCmd = false; continue; }
      if (!cur) begin(i);
      cur.raw += c;
    }
    if (!cur) { cur = { start: text.length, raw: '', quote: null, isCmd: atCmd, cmdName: atCmd ? null : cmdName }; }
    cur.prevParam = prevParam;
    return cur;
  }
  function commandOf(name) {
    if (!name) return null;
    var l = name.toLowerCase();
    if (l === 'cd..' || l === 'cd\\') return CMDS.cd;
    return hasOwn.call(CMDS, l) ? CMDS[l] : null;
  }

  /* complete(buffer, cursor, session) -> {start, end, items:[{replacement, display}], single}
     Path completions follow PowerShell: relative names get `.\`, folders end in `\`, names with spaces are put in single quotes. */
  function complete(buffer, cursor, session) {
    var none = { start: cursor, end: cursor, items: [], single: false };
    var sc = scanForComplete(buffer.slice(0, cursor));
    var vfs = session.vfs;
    var raw = sc.raw;
    var q = sc.quote;
    var inner = q ? raw.slice(1) : raw;
    if (q && inner.charAt(inner.length - 1) === q) inner = inner.slice(0, -1);
    // 1. the command name (a $variable at the start of a statement is a variable: step 1b)
    if (sc.isCmd && !/[\\\/]/.test(inner) && inner.charAt(0) !== '$') {
      if (inner === '') return none;
      var low = inner.toLowerCase();
      var names = COMPLETE_NAMES.concat(Object.keys(session.funcs || {}).map(function (k) { return session.funcs[k].name; }), Object.keys(session.aliases || {})).filter(function (n) { return n.toLowerCase().indexOf(low) === 0; }).sort(function (a, b) { return ntfsCmp(a, b); });
      if (!names.length) return none;
      var items0 = names.map(function (n) { return { display: n, replacement: n }; });
      return { start: sc.start, end: cursor, items: items0, single: items0.length === 1 };
    }
    // 1b. a variable ($ or $env:)
    if (!q && /^\$[A-Za-z_:?{]*$/.test(inner)) {
      var vp = inner.slice(1).toLowerCase(), vnames = [];
      if (vp.indexOf('env:') === 0) {
        Object.keys(session.envv).sort(function (a, b) { return ntfsCmp(a, b); }).forEach(function (k) { if (k.toLowerCase().indexOf(vp.slice(4)) === 0) vnames.push('$env:' + k); });
      } else {
        var seenV = {};
        ['_', 'args', 'env:', 'error', 'false', 'HOME', 'Host', 'input', 'null', 'PID', 'PSVersionTable', 'PWD', 'true'].concat(Object.keys(session.vars).map(function (k) { return (session.varCase && session.varCase[k]) || k; })).forEach(function (k) {
          var lk = k.toLowerCase();
          if (!seenV[lk] && lk.indexOf(vp) === 0) { seenV[lk] = 1; vnames.push('$' + k); }
        });
        vnames.sort(function (a, b) { return ntfsCmp(a, b); });
      }
      if (vnames.length) {
        var itemsV = vnames.map(function (v) { return { display: v, replacement: v }; });
        return { start: sc.start, end: cursor, items: itemsV, single: itemsV.length === 1 };
      }
      return none;
    }
    // 2. a parameter name
    if (!sc.isCmd && !q && /^-[A-Za-z]*$/.test(inner)) {
      var cdef = commandOf(sc.cmdName);
      if (cdef && cdef.spec) {
        var pl = paramList(cdef.spec).filter(function (p) { return p.n.toLowerCase().indexOf(inner.slice(1).toLowerCase()) === 0; });
        if (!pl.length) return none;
        var items1 = pl.map(function (p) { return { display: '-' + p.n, replacement: '-' + p.n + ' ' }; });
        return { start: sc.start, end: cursor, items: items1, single: items1.length === 1 };
      }
      return none;
    }
    // 3. a path
    var norm = inner.replace(/\//g, '\\');
    var li = norm.lastIndexOf('\\');
    var dirTyped = li < 0 ? '' : inner.slice(0, li + 1);
    var base = li < 0 ? inner : inner.slice(li + 1);
    var dr = resolvePath(session, dirTyped === '' ? '.' : dirTyped);
    if (dr.err) return none;
    var dst = vfs.stat(dr.abs);
    if (!dst || dst.type !== 'dir') return none;
    var dirsOnly = !sc.isCmd && /^(cd|chdir|sl|set-location|pushd|push-location)$/i.test(sc.cmdName || '');
    var low2 = base.toLowerCase();
    var kids = vfs.list(dr.abs).filter(function (st) { return !isTrash(st) && fold(st.name).indexOf(low2) === 0 && (!dirsOnly || st.type === 'dir'); }).sort(dirsFirst);
    if (!kids.length) return none;
    var prefix = dirTyped;
    if (prefix === '' && !q) prefix = '.\\';
    else if (prefix === '' && q) prefix = '.\\';
    var items = kids.map(function (st) {
      var full = prefix + st.name + (st.type === 'dir' ? '\\' : '');
      var quo = q || (needsQuote(full) ? "'" : '');
      var rep = quo ? quo + (quo === "'" ? full.replace(/'/g, "''") : full) + quo : full;
      return { display: st.name + (st.type === 'dir' ? '\\' : ''), replacement: rep };
    });
    return { start: sc.start, end: cursor, items: items, single: items.length === 1 };
  }

  /* the text typed for a dropped / pasted file: a Windows path, in double quotes when it has spaces */
  function quotePath(internal) {
    var w = LAB.win && LAB.win.toWin ? LAB.win.toWin(internal) : winOfSegs(splitSegs(LAB.vfs.canon(internal)));
    return /\s/.test(w) ? '"' + w + '"' : w;
  }

  LAB.shell = {
    newSession: newSession, run: run, resume: resume, cancel: cancel, complete: complete,
    commands: CMDS, lex: lex, quotePath: quotePath, escape: quotePath, errorText: errorText, resolvePath: resolvePath, wrap: wrapCells, dispCwd: dispCwd,
    tableText: tableText, KEEP_TYPED_CASE: KEEP_TYPED_CASE
  };

  /* =====================================================================
     PART B — persisted state and the Windows Terminal window
     ===================================================================== */

  /* ↑ recalls what was typed in earlier windows (PSReadLine keeps one history file); Get-History is per window (session.hist) */
  var termState = { history: [], lastLogin: null, ttyCount: 0, installed: { git: false, python: false }, gitConfig: { name: '', email: '' } };
  var MAX_HISTORY = 200;
  LAB.store.register('term', {
    serialize: function () {
      return { history: termState.history.slice(-MAX_HISTORY), lastLogin: termState.lastLogin, ttyCount: termState.ttyCount };
    },
    restore: function (j) {
      termState.history.length = 0;
      termState.lastLogin = null;
      termState.ttyCount = 0;
      if (j === undefined || j === null) return;
      if (typeof j !== 'object' || Array.isArray(j)) throw new Error('bad term slice');
      if (Array.isArray(j.history)) {
        j.history.forEach(function (x) { if (typeof x === 'string' && x.length <= 2000) termState.history.push(x); });
        while (termState.history.length > MAX_HISTORY) termState.history.shift();
      }
      if (isFinite(j.ttyCount) && j.ttyCount >= 0 && j.ttyCount < 100000) termState.ttyCount = Math.floor(Number(j.ttyCount));
    },
    reset: function () { termState.history.length = 0; termState.lastLogin = null; termState.ttyCount = 0; termState.installed.git = false; termState.installed.python = false; termState.gitConfig.name = ''; termState.gitConfig.email = ''; }
  });

  var PAD = 8;
  var FS_DEFAULT = 16, FS_MIN = 9, FS_MAX = 32;     // 12 pt = 16 px, Windows Terminal's default
  var LH = 1.19;                                    // line height / font size: 19 px rows at 16 px (Cascadia Mono, facts §2.3)
  var instances = new Map();                        // winId -> terminal instance

  function stageScale() { return (LAB.stage && LAB.stage.scale) || 1; }

  /* the PowerShell icon of the tab (our own drawing) and the tab strip glyphs */
  var PS_ICON = '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><rect x=".5" y="2" width="15" height="12" rx="2.4" fill="#2b6cb8"/><rect x=".5" y="2" width="15" height="12" rx="2.4" fill="none" stroke="#9cc3ee" stroke-opacity=".55"/><path d="M4.3 5.7l3.3 2.3-3.3 2.3" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M8.7 10.7h3" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/></svg>';
  var G_CLOSE = '<svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true"><path d="M1 1l8 8M9 1L1 9" stroke="currentColor" stroke-width="1" stroke-linecap="round" fill="none"/></svg>';
  var G_PLUS = '<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M6 1v10M1 6h10" stroke="currentColor" stroke-width="1" stroke-linecap="round" fill="none"/></svg>';
  var G_CHEV = '<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M2.5 4.5L6 8l3.5-3.5" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>';

  /* ---- styled text: a row is a list of units {ch, w, cls}; a stored line is a list of segments [text, cls] */
  function segsToUnits(segs) {
    var units = [];
    segs.forEach(function (sg) {
      for (var ch of sg[0]) {
        var w = charWidth(ch.codePointAt(0));
        if (w === 0) { if (units.length) units[units.length - 1].ch += ch; continue; }
        units.push({ ch: ch, w: w, cls: sg[1] });
      }
    });
    return units;
  }
  /* cut units into rows of `cols` columns (a wide character never straddles the edge) */
  function unitsToRows(units, cols) {
    var rows = [[]], col = 0;
    units.forEach(function (u) {
      if (col + u.w > cols && col > 0) { rows.push([]); col = 0; }
      rows[rows.length - 1].push(u);
      col += u.w;
    });
    return rows;
  }
  /* the box-drawing characters of `tree` are drawn as lines that touch the cell edges (Windows Terminal does the same), so a column of │ is one unbroken line */
  var BOX = {};
  '─│┌┐└┘├┤┬┴┼'.split('').forEach(function (c) { BOX[c] = c.charCodeAt(0).toString(16); });
  /* DOM of one row: runs of narrow characters are text nodes / spans, wide characters get a two-column cell */
  function fillRow(el, units, cursorAt) {
    var frag = document.createDocumentFragment();
    var run = '', runCls = '';
    function flush() {
      if (!run) return;
      if (runCls) frag.appendChild(h('span', { class: 'tm-c-' + runCls }, run)); else frag.appendChild(document.createTextNode(run));
      run = '';
    }
    for (var i = 0; i < units.length; i++) {
      var u = units[i];
      var cls = u.cls || '';
      if (i === cursorAt) {
        flush();
        frag.appendChild(h('span', { class: 'tm-cur' + (u.w === 2 ? ' tm-w' : '') + (cls ? ' tm-c-' + cls : '') }, u.ch));
        continue;
      }
      if (u.w === 1 && BOX[u.ch] && !cls) {
        flush();
        frag.appendChild(h('span', { class: 'tm-bx tm-bx-' + BOX[u.ch] }, u.ch));
        continue;
      }
      if (u.w === 2 || cls === 'comp') {
        flush();
        frag.appendChild(h('span', { class: (u.w === 2 ? 'tm-w' : '') + (cls ? ' tm-c-' + cls : '') }, u.ch));
        continue;
      }
      if (cls !== runCls) { flush(); runCls = cls; }
      run += u.ch;
    }
    flush();
    el.appendChild(frag);
  }

  /* ---- PSReadLine 2.0 colours of the typed line: command yellow, parameter grey, string cyan, variable green */
  function highlight(chars) {
    var n = chars.length, cls = new Array(n), i = 0, atCmd = true, j;
    for (j = 0; j < n; j++) cls[j] = '';
    function wordEnd(from) { var k = from; while (k < n && ' \t;|><(){}'.indexOf(chars[k]) < 0) k++; return k; }
    var KEYWORD = /^(?:if|elseif|else|foreach|for|while|function|return|try|catch|finally|break|continue|switch|throw)$/i;
    while (i < n) {
      var c = chars[i];
      if (c === ' ' || c === '\t') { i++; continue; }
      if (c === ';') { atCmd = true; i++; continue; }
      if (c === '{' || c === '(') { atCmd = true; i++; continue; }
      if (c === '}' || c === ')') { i++; continue; }
      if (c === '|' || c === '>' || c === '<' || c === '&') { cls[i] = 'par'; if (c === '|') atCmd = true; i++; continue; }
      if (c === '#') { for (j = i; j < n; j++) cls[j] = 'var'; break; }
      if (c === "'" || c === '"') {
        var e = i + 1;
        while (e < n && chars[e] !== c) e++;
        var stop = e < n ? e : n - 1;
        for (j = i; j <= stop; j++) cls[j] = 'str';
        atCmd = false; i = stop + 1; continue;
      }
      var s = i, we = wordEnd(i);
      var word = chars.slice(s, we).join('');
      if (c === '$') {
        var ve = s + 1;
        while (ve < we && /[A-Za-z0-9_:?]/.test(chars[ve])) ve++;
        for (j = s; j < ve; j++) cls[j] = 'var';
      } else if (atCmd) {
        if (KEYWORD.test(word)) { for (j = s; j < we; j++) cls[j] = 'var'; atCmd = /^(?:else|try|finally)$/i.test(word); i = we; continue; }
        if (!/^[-+]?[0-9.]/.test(word)) for (j = s; j < we; j++) cls[j] = 'cmd';
      } else if (/^-[A-Za-z?]/.test(word)) {
        for (j = s; j < we; j++) cls[j] = 'par';
      }
      atCmd = false;
      i = we;
    }
    return cls;
  }

  function pickCells(cw, lh, chromeW, chromeH) {
    var sa = LAB.stage && LAB.stage.spawnArea ? LAB.stage.spawnArea() : { w: 1000, h: 600 };
    var maxCols = Math.floor((sa.w - chromeW - 2 * PAD) / cw), maxRows = Math.floor((sa.h - chromeH - 2 * PAD) / lh);
    var cols = maxCols >= 120 ? 120 : (maxCols >= 100 ? 100 : Math.max(40, maxCols));
    var rows = cols >= 120 && maxRows >= 30 ? 30 : (maxRows >= 26 ? 26 : Math.max(8, maxRows));
    return { cols: cols, rows: rows };
  }

  function createTerminal(args) {
    args = args || {};
    var vfs = LAB.vfs;
    var startCwd = HOME;
    var want = args.cwd || args.path;
    if (want) {
      var wst = vfs.stat(want);
      if (wst) startCwd = wst.type === 'dir' ? wst.path : vfs.dirname(wst.path);
    }
    var tty = termState.ttyCount;
    var session = LAB.shell.newSession({ cwd: startCwd, tty: tty, cols: 120 });

    // ---- state
    var fs = FS_DEFAULT, cw = FS_DEFAULT * 0.586, lh = Math.round(FS_DEFAULT * LH);
    var cols = 120, rows = 30;
    var hist = [];                    // {segs, el}
    var partial = [];                 // the unfinished output line: segments
    var buf = [], cur = 0, comp = '';
    var histPos = -1, stash = null;
    var tabState = null;
    var busy = false, dead = false, composing = false, userSized = false, selfSizing = false;
    var sleepTimer = 0, clearAnchor = null, closed = false;
    var lastCwd = session.cwd;
    var win = null;

    // ---- DOM
    var histEl = h('div', { class: 'tm-hist' });
    var liveEl = h('div', { class: 'tm-live' });
    var spacerEl = h('div', { class: 'tm-spacer' });
    var ta = h('textarea', {
      class: 'tm-input', rows: '1', spellcheck: 'false', autocomplete: 'off', autocapitalize: 'off', autocorrect: 'off',
      'aria-label': '終端機輸入', dataset: { lab: 'term-input' }
    });
    var screen = h('div', { class: 'tm-screen', tabindex: '-1', role: 'group', 'aria-label': '終端機畫面', dataset: { lab: 'term-screen' } },
      histEl, liveEl, spacerEl, ta);
    var probe = h('span', { class: 'tm-probe', 'aria-hidden': 'true' }, new Array(101).join('0'));
    var root = h('div', { class: 'tm-root' }, screen, probe);

    // the tab strip (the title bar): one tab, +, a thin line and the drop-down chevron
    var tabIco = h('span', { class: 'tm-tab-ico', 'aria-hidden': 'true' });
    tabIco.innerHTML = PS_ICON;
    var tabClose = h('button', { type: 'button', class: 'tm-tab-close', 'aria-label': '關閉分頁', title: '關閉分頁', dataset: { lab: 'term-tab-close' } });
    tabClose.innerHTML = G_CLOSE;
    var tab = h('div', { class: 'tm-tab', role: 'tab', 'aria-selected': 'true', dataset: { lab: 'term-tab' } }, tabIco, h('span', { class: 'tm-tab-title' }, 'Windows PowerShell'), tabClose);
    var btnPlus = h('button', { type: 'button', class: 'tm-tabbtn', 'aria-label': '新增分頁', title: '新增分頁 (Ctrl+Shift+T)', dataset: { lab: 'term-new-tab' } });
    btnPlus.innerHTML = G_PLUS;
    var btnDrop = h('button', { type: 'button', class: 'tm-tabbtn tm-drop', 'aria-label': '開啟新分頁下拉式功能表', title: '開啟新分頁下拉式功能表', 'aria-haspopup': 'menu', dataset: { lab: 'term-menu' } });
    btnDrop.innerHTML = G_CHEV;
    var strip = h('div', { class: 'tm-strip', role: 'tablist' }, tab, btnPlus, h('span', { class: 'tm-sep', 'aria-hidden': 'true' }), btnDrop);

    // ---- measuring and fitting
    function measure() {
      probe.style.fontSize = fs + 'px';
      // the advance of one column, in unscaled CSS px. Canvas text metrics ignore the opening animation (the window starts at scale .96,
      // which would make getBoundingClientRect() report 4% too narrow); the DOM probe is the fallback.
      var w = 0;
      try {
        var g = (probe._cv || (probe._cv = document.createElement('canvas'))).getContext('2d');
        g.font = fs + 'px ' + getComputedStyle(probe).fontFamily;
        w = g.measureText(new Array(101).join('0')).width / 100;
      } catch (eM) { w = 0; }
      if (!(w > 0.5)) w = probe.getBoundingClientRect().width / stageScale() / 100;
      if (w > 0.5) cw = w;
      lh = Math.max(10, Math.round(fs * LH));
      root.style.setProperty('--tm-fs', fs + 'px');
      screen.style.setProperty('--tm-lh', lh + 'px');
      screen.style.setProperty('--tm-cx', Math.floor((cw - 1) / 2) + 'px');           // where the box-drawing lines cross the cell (whole pixels: crisp lines)
      screen.style.setProperty('--tm-cy', Math.floor((lh - 1) / 2) + 'px');
      ta.style.lineHeight = lh + 'px';
      ta.style.height = lh + 'px';
    }
    function chrome() {
      return { w: win.el.offsetWidth - screen.clientWidth, h: win.el.offsetHeight - root.clientHeight };
    }
    function updateMinSize() {
      var c = chrome();
      win.minW = Math.ceil(30 * cw) + 2 * PAD + c.w;
      win.minH = Math.ceil(6 * lh) + 2 * PAD + c.h;
    }
    function sizeToCells(c, r) {
      var ch = chrome();
      selfSizing = true;
      try { win.setRect({ w: Math.ceil(c * cw) + 2 * PAD + ch.w, h: Math.ceil(r * lh) + 2 * PAD + ch.h }); } finally { selfSizing = false; }
    }
    function sizeToDefault() { var c = chrome(), p = pickCells(cw, lh, c.w, c.h); sizeToCells(p.cols, p.rows); }
    function fit() {
      if (closed || !win) return;
      var cwid = screen.clientWidth, chei = root.clientHeight;
      if (cwid < 20 || chei < 20) return;
      var nc = Math.max(10, Math.floor((cwid - 2 * PAD) / cw + 0.001));
      var nr = Math.max(2, Math.floor((chei - 2 * PAD) / lh + 0.001));
      // the scroller is a whole number of rows high, so scrolled to the bottom it never shows half a row at the top
      screen.style.bottom = 'auto';
      screen.style.height = (nr * lh) + 'px';
      var changed = nc !== cols || nr !== rows;
      var colsChanged = nc !== cols;
      cols = nc; rows = nr;
      session.cols = cols;
      if (colsChanged) rewrap();
      if (changed) renderLive();
    }

    // ---- history lines
    function buildLine(item) {
      var el = item.el || h('div', { class: 'tm-line' });
      el.textContent = '';
      var rs = unitsToRows(segsToUnits(item.segs), cols);
      for (var i = 0; i < rs.length; i++) {
        var r = h('div', { class: 'tm-row' });
        fillRow(r, rs[i], -1);
        el.appendChild(r);
      }
      item.el = el;
      return el;
    }
    function rewrap() {
      histEl.textContent = '';
      hist.forEach(function (it) { histEl.appendChild(buildLine(it)); });
    }
    function commitLine(segs) {
      var it = { segs: segs, el: null };
      hist.push(it);
      histEl.appendChild(buildLine(it));
      while (hist.length > 2000) {
        var old = hist.shift();
        if (old.el && old.el.parentNode) old.el.parentNode.removeChild(old.el);
        if (clearAnchor !== null) clearAnchor = Math.max(0, clearAnchor - 1);
      }
    }
    function addPartial(text, cls) {
      var last = partial[partial.length - 1];
      if (last && last[1] === cls) last[0] += text; else partial.push([text, cls]);
    }
    function printText(s, cls) {
      if (!s) return;
      s = String(s).replace(/\r\n/g, '\n').replace(/\r/g, '');
      var chunks = s.split('\n');
      for (var i = 0; i < chunks.length; i++) {
        var piece = chunks[i];
        // tabs go to the next multiple of 8 columns
        var lineSoFar = partial.map(function (p) { return p[0]; }).join('');
        var out = '', col = displayWidth(lineSoFar);
        for (var ch of piece) {
          var cp = ch.codePointAt(0);
          if (ch === '\t') { var n = 8 - (col % 8); out += spaces(n); col += n; }
          else if (cp < 0x20 || cp === 0x7f) continue;
          else { out += ch; col += charWidth(cp); }
        }
        if (out) addPartial(out, cls || '');
        if (i < chunks.length - 1) { commitLine(partial.length ? partial : [['', '']]); partial = []; }
      }
    }
    function flushPartial() {
      if (partial.length) { commitLine(partial); partial = []; }
    }
    function clearAll() {
      hist = [];
      histEl.textContent = '';
      partial = [];
      clearAnchor = null;
      renderLive();
    }
    function clearScreen() {          // Ctrl+L: the scrollback stays, the prompt goes to the top
      clearAnchor = hist.length;
      renderLive();
    }

    // ---- live line
    function promptStr() {
      if (session.prompt) return session.prompt.text;
      if (session.pending !== null) return session.ps2 || '>> ';
      return 'PS ' + LAB.shell.dispCwd(session) + '> ';
    }
    function renderLive() {
      liveEl.textContent = '';
      if (closed) return;
      if (dead) { ta.style.display = 'none'; afterRender(); return; }
      ta.style.display = '';
      var units = [];
      var curIdx = -1;
      if (!busy) {
        segsToUnits([[promptStr(), '']]).forEach(function (u) { units.push(u); });
        var hl = highlight(buf);
        for (var i = 0; i <= buf.length; i++) {
          if (i === cur) {
            if (comp) segsToUnits([[comp, 'comp']]).forEach(function (u) { units.push(u); });
            curIdx = units.length;
          }
          if (i < buf.length) {
            var w = charWidth(buf[i].codePointAt(0));
            if (w === 0) { if (units.length) units[units.length - 1].ch += buf[i]; continue; }
            units.push({ ch: buf[i], w: w, cls: hl[i] });
          }
        }
      }
      var rowsArr = unitsToRows(units, cols);
      var cr = rowsArr.length - 1, cc = 0, cellIdx = -1;
      // where is the cursor: inside the units, or just after them (a space cell at the end)
      if (curIdx >= 0) {
        if (curIdx >= units.length) {
          var lastRow = rowsArr[rowsArr.length - 1], used = 0;
          lastRow.forEach(function (u) { used += u.w; });
          if (used >= cols) { rowsArr.push([]); cr = rowsArr.length - 1; cc = 0; }
          else { cr = rowsArr.length - 1; cc = used; }
          rowsArr[cr].push({ ch: ' ', w: 1, cls: '' });
          cellIdx = rowsArr[cr].length - 1;
        } else {
          // find the row that holds unit curIdx
          var seen = 0;
          for (var r = 0; r < rowsArr.length; r++) {
            if (curIdx < seen + rowsArr[r].length) { cr = r; cellIdx = curIdx - seen; break; }
            seen += rowsArr[r].length;
          }
          cc = 0;
          for (var q = 0; q < cellIdx; q++) cc += rowsArr[cr][q].w;
        }
      }
      rowsArr.forEach(function (ru, rIdx) {
        var rowEl = h('div', { class: 'tm-row' });
        fillRow(rowEl, ru, rIdx === cr && curIdx >= 0 ? cellIdx : -1);
        liveEl.appendChild(rowEl);
      });
      liveEl.dataset.curRow = String(cr);
      afterRender();
      ta.style.left = (PAD + cc * cw) + 'px';
      ta.style.top = (liveEl.offsetTop + cr * lh) + 'px';
    }
    function afterRender() {
      if (clearAnchor !== null) {
        var anchorTop = clearAnchor < hist.length && hist[clearAnchor].el ? hist[clearAnchor].el.offsetTop : liveEl.offsetTop;
        var contentAfter = liveEl.offsetTop + liveEl.offsetHeight - anchorTop;
        var view = screen.clientHeight;
        if (contentAfter <= view) {
          spacerEl.style.height = Math.max(0, view - contentAfter) + 'px';
          screen.scrollTop = Math.max(0, anchorTop);
          return;
        }
      }
      spacerEl.style.height = '0px';
      screen.scrollTop = screen.scrollHeight;
    }
    function showPrompt() {
      flushPartial();
      buf = []; cur = 0; comp = '';
      histPos = -1; stash = null; tabState = null;
      renderLive();
    }

    // ---- editing
    function setBuf(text) {
      buf = Array.from(String(text).replace(/[\r\n]+/g, ' '));
      cur = buf.length;
      renderLive();
    }
    function insertText(str) {
      if (busy || dead) return;
      var chars = [];
      for (var ch of String(str)) {
        var cp = ch.codePointAt(0);
        if (ch === '\n' || ch === '\r' || ch === '\t') chars.push(' ');
        else if (cp < 0x20 || cp === 0x7f) continue;
        else chars.push(ch);
      }
      if (!chars.length) return;
      buf.splice.apply(buf, [cur, 0].concat(chars));
      cur += chars.length;
      tabState = null; histPos = -1;
      renderLive();
    }
    function wordLeftIdx() {
      var j = cur;
      while (j > 0 && buf[j - 1] === ' ') j--;
      while (j > 0 && buf[j - 1] !== ' ') j--;
      return j;
    }
    function wordRightIdx() {
      var j = cur;
      while (j < buf.length && buf[j] !== ' ') j++;
      while (j < buf.length && buf[j] === ' ') j++;
      return j;
    }
    function editable() { return !busy && !dead; }

    // ---- running lines
    var DEFAULT_APP = { '.md': 'textedit', '.txt': 'textedit', '.csv': 'textedit', '.json': 'textedit', '.log': 'textedit', '.png': 'photos', '.jpg': 'photos', '.jpeg': 'photos', '.gif': 'photos', '.bmp': 'photos', '.webp': 'photos', '.pdf': 'edge' };
    /* an app the PC may not have yet (the round-5 apps are added by another builder): use it only when it is registered and can open a file */
    function canOpenWith(id) { var d = LAB.apps.get(id); return !!d && typeof d.handleOpen === 'function'; }
    function openUrl(url) {
      if (!LAB.apps.get('edge')) { LAB.ui.toast('練習版沒有安裝 Microsoft Edge'); return; }
      LAB.apps.launch('edge', { url: url }, { bounce: false });
    }
    /* Stop-Process / taskkill: close the windows of the app for real */
    function killApp(appId, pid) {
      function viaSys() {          // the Task Manager's own 結束工作 (also emits sys:kill); guarded: false when LAB.sys is not there
        try { if (LAB.sys && typeof LAB.sys.killProcess === 'function') { var r = LAB.sys.killProcess(pid !== undefined && pid !== null ? pid : appId); return !!(r && r.ok); } } catch (e) { /* fall through */ }
        return false;
      }
      if (appId === 'terminal') { setTimeout(function () { if (!viaSys()) LAB.wm.byApp('terminal').slice().forEach(function (w) { try { w.close(true); } catch (e) { /* ignore */ } }); }, 150); return; }
      if (viaSys()) return;
      if (appId === 'finder') { LAB.wm.byApp('finder').slice().forEach(function (w) { try { w.close(true); } catch (e) { /* ignore */ } }); return; }
      try { LAB.apps.quit(appId, { force: true }); } catch (e) { /* ignore */ }
    }
    function openEffect(e) {
      try {
        if (e.type === 'launch') { LAB.apps.launch(e.appId, null, { bounce: false }); return; }
        if (e.type === 'toast') { LAB.ui.toast(e.text); return; }
        if (e.type === 'url') { openUrl(e.url); return; }
        if (e.type === 'kill') { killApp(e.appId, e.pid); return; }
        if (e.type !== 'open') return;
        var st = vfs.stat(e.path);
        if (!st) return;
        var appId = e.appId;
        if (!appId) {
          if (st.type === 'dir') appId = 'finder';
          else appId = DEFAULT_APP[vfs.extname(st.name).toLowerCase()] || null;
          if (appId && appId !== 'textedit' && !canOpenWith(appId)) appId = null;       // no Photos / Edge yet: the practice toast below
        }
        if (appId) { LAB.apps.openPath(e.path, { appId: appId, via: 'terminal' }); return; }
        // zip folders and Office / PDF files: the practice PC has no viewer (same words as File Explorer)
        LAB.bus.emit('finder:open', { path: st.path, kind: st.kind, via: 'terminal' });
        LAB.ui.toast(st.kind === 'zip' ? '練習版：請在終端機用 tar -xvf 解壓縮' : (/\.pdf$/i.test(st.name) ? '練習版沒有安裝 PDF 閱讀器' : '練習版沒有安裝 Word'));
      } catch (err) { console.error('[terminal] effect failed', err); }
    }
    function startSleep(ms) {
      busy = true;
      renderLive();
      sleepTimer = setTimeout(function () {
        sleepTimer = 0;
        busy = false;
        handleResult(LAB.shell.resume(session));
      }, ms);
    }
    function handleResult(res) {
      if (!res || closed) return;
      var sleepMs = null;
      var stream = res.stream || [];
      for (var i = 0; i < stream.length; i++) {
        var it = stream[i];
        if (typeof it === 'string') { printText(it, ''); continue; }
        if (it.err !== undefined) { printText(it.err, 'err'); continue; }
        if (it.cls !== undefined) { printText(it.text, it.cls); continue; }
        if (it.type === 'clear') clearAll();
        else if (it.type === 'exit') { dead = true; }
        else if (it.type === 'sleep') sleepMs = it.ms;
        else if (it.type === 'open' || it.type === 'launch' || it.type === 'toast' || it.type === 'url' || it.type === 'kill') openEffect(it);
      }
      while (termState.history.length > MAX_HISTORY) termState.history.shift();
      if (res.event) {
        var ev = res.event;
        LAB.bus.emit('term:run', {
          winId: win.id, line: ev.line, name: ev.name, args: ev.args, cwd: ev.cwd, cwdAfter: ev.cwdAfter,
          status: ev.status, out: ev.out, cmds: ev.cmds.map(function (c) {
            return { name: c.name, args: c.args.slice(), cwd: c.cwd, cwdAfter: c.cwdAfter, status: c.status, out: c.out, canon: c.canon, paths: (c.paths || []).slice() };
          })
        });
        if (session.cwd !== lastCwd) {
          LAB.bus.emit('term:cwd', { winId: win.id, cwd: session.cwd, from: lastCwd });
          lastCwd = session.cwd;
        }
        win.state.cwd = session.cwd;
        if (dead) LAB.bus.emit('term:exit', { winId: win.id });
      }
      if (dead) {
        // `exit` closes the tab, and with it the window (Windows Terminal closes on a clean exit); a moment later so the click that sent it settles
        setTimeout(function () { if (!closed) { try { win.close(); } catch (e) { /* ignore */ } } }, 120);
      }
      if (!res.done && sleepMs !== null) { startSleep(sleepMs); return; }
      showPrompt();
    }
    function submit() {
      if (busy || dead) return;
      var line = buf.join('');
      var segs = [[promptStr(), '']];
      var hl = highlight(buf);
      buf.forEach(function (c, i) { var l = segs[segs.length - 1]; if (l[1] === hl[i]) l[0] += c; else segs.push([c, hl[i]]); });
      commitLine(segs);
      buf = []; cur = 0; comp = ''; histPos = -1; stash = null; tabState = null;
      if (line.trim() !== '' && session.pending === null && !session.prompt) {
        var hs = termState.history, at = hs.indexOf(line);
        if (at >= 0) hs.splice(at, 1);                       // PSReadLine does not keep duplicates when you walk back
        hs.push(line);
      }
      handleResult(LAB.shell.run(line, session));
    }
    function interrupt() {
      if (dead) return;
      if (busy) {
        clearTimeout(sleepTimer); sleepTimer = 0; busy = false;
        commitLine([['^C', '']]);
        handleResult(LAB.shell.cancel(session));
        return;
      }
      commitLine([[promptStr() + buf.join('') + '^C', '']]);
      buf = []; cur = 0; comp = '';
      if (session.gen && session.prompt && session.prompt.kind === 'python') { commitLine([['KeyboardInterrupt', '']]); showPrompt(); return; }
      if (session.gen) { handleResult(LAB.shell.cancel(session)); return; }
      if (session.pending !== null) LAB.shell.cancel(session);
      showPrompt();
    }

    // ---- Tab: the first Tab fills the first match, further Tabs cycle (Shift+Tab goes back)
    function doTab(back) {
      if (!editable() || session.prompt) return;
      var text = buf.join('');
      function apply() {
        var it = tabState.items[tabState.idx];
        var before = buf.slice(0, tabState.start), tail = buf.slice(tabState.end);
        var insert = Array.from(it.replacement);
        buf = before.concat(insert, tail);
        cur = before.length + insert.length;
        tabState.end = cur;
        renderLive();
      }
      if (tabState && tabState.items) {
        var n = tabState.items.length;
        tabState.idx = (tabState.idx + (back ? -1 : 1) + n) % n;
        apply();
        return;
      }
      var cursorStr = buf.slice(0, cur).join('').length;
      var res = LAB.shell.complete(text, cursorStr, session);
      if (!res.items.length) return;
      var startIdx = Array.from(text.slice(0, res.start)).length;
      tabState = { items: res.items, idx: back ? res.items.length - 1 : 0, start: startIdx, end: cur };
      apply();
    }

    // ---- selection, copy, paste, zoom
    function selectionText() {
      var sel = window.getSelection ? window.getSelection() : null;
      if (!sel || sel.isCollapsed || !sel.rangeCount) return '';
      var r = sel.getRangeAt(0);
      if (!screen.contains(r.commonAncestorContainer) && r.commonAncestorContainer !== screen) return '';
      return sel.toString();
    }
    function copySelection() {
      var t = selectionText();
      if (!t) return false;
      LAB.clipboard.setText(t);
      return true;
    }
    function pasteText(text) { if (text) insertText(text); }
    function pasteFromMenu() {
      if (LAB.clipboard.paths && LAB.clipboard.paths.length) { pasteText(LAB.clipboard.paths.map(LAB.shell.quotePath).join(' ')); return; }
      if (LAB.clipboard.text) { pasteText(LAB.clipboard.text); return; }
      try {
        if (navigator.clipboard && navigator.clipboard.readText) navigator.clipboard.readText().then(pasteText, function () {});
      } catch (e) { /* ignored */ }
    }
    function selectAll() {
      var sel = window.getSelection();
      if (!sel) return;
      var r = document.createRange();
      r.selectNodeContents(screen);
      sel.removeAllRanges();
      sel.addRange(r);
    }
    function setFontSize(n) {
      n = LAB.util.clamp(n, FS_MIN, FS_MAX);
      if (n === fs) return;
      fs = n;
      measure(); updateMinSize(); fit(); rewrap(); renderLive();
    }
    function focusInput() {
      if (closed || dead) return;
      try { ta.focus({ preventScroll: true }); } catch (e) { ta.focus(); }
    }

    // ---- keyboard
    function onKeyDown(e) {
      if (e.isComposing || e.keyCode === 229) return;
      var key = e.key;
      if (key === 'Control' || key === 'Meta' || key === 'Alt' || key === 'Shift' || key === 'CapsLock' || key === 'OS' || key === 'AltGraph') return;   // a bare modifier must not touch the selection
      var meta = e.metaKey, ctrl = e.ctrlKey && !e.metaKey, alt = e.altKey, shift = e.shiftKey;
      var k = key.length === 1 ? key.toLowerCase() : key;
      if (key !== 'Tab') tabState = null;
      var copyCombo = (meta || ctrl) && k === 'c' && !alt;
      var pasteCombo = (meta || ctrl) && k === 'v' && !alt;

      if (document.activeElement !== ta) {
        if (copyCombo && selectionText()) return;                  // native copy of the selected text
        var s0 = window.getSelection();
        if (s0 && !s0.isCollapsed && !((meta || ctrl) && k === 'a')) s0.removeAllRanges();
        focusInput();
        if (key.length === 1 && !meta && !ctrl && !alt && editable()) { insertText(key); e.preventDefault(); return; }
      }

      if (copyCombo) {
        if (selectionText()) { copySelection(); e.preventDefault(); return; }
        if (ctrl && !shift) { interrupt(); e.preventDefault(); }
        return;
      }
      if (pasteCombo) return;                                      // the paste event does the work
      if (meta) {
        if (k === 'k') { clearAll(); e.preventDefault(); return; }
        if (k === 'a') { selectAll(); e.preventDefault(); return; }
        return;
      }
      // font size, like Windows Terminal: Ctrl+= / Ctrl+- / Ctrl+0
      if (ctrl && !alt && (key === '=' || key === '+')) { setFontSize(fs + 1); e.preventDefault(); return; }
      if (ctrl && !alt && (key === '-' || key === '_')) { setFontSize(fs - 1); e.preventDefault(); return; }
      if (ctrl && !alt && key === '0') { setFontSize(FS_DEFAULT); e.preventDefault(); return; }
      if (ctrl && shift && k === 'a') { selectAll(); e.preventDefault(); return; }
      if (dead) { if (key === 'PageUp' || key === 'PageDown') return; e.preventDefault(); return; }
      if (busy) {
        if (ctrl && k === 'c') { interrupt(); e.preventDefault(); return; }
        if (key.length === 1 || key === 'Enter' || key === 'Backspace' || key === 'Tab') e.preventDefault();
        return;
      }
      if (ctrl) {
        // PSReadLine in Windows mode: Ctrl+Backspace / Ctrl+Delete delete a word, Ctrl+←/→ jump by words, Ctrl+Home / Ctrl+End delete to the ends
        if (key === 'Backspace') { deleteWord(); e.preventDefault(); return; }
        if (key === 'Delete') { var rj = wordRightIdx(); if (rj > cur) { buf.splice(cur, rj - cur); tabState = null; renderLive(); } e.preventDefault(); return; }
        if (key === 'ArrowLeft') { cur = wordLeftIdx(); renderLive(); e.preventDefault(); return; }
        if (key === 'ArrowRight') { cur = wordRightIdx(); renderLive(); e.preventDefault(); return; }
        if (key === 'Home') { buf.splice(0, cur); cur = 0; tabState = null; renderLive(); e.preventDefault(); return; }
        if (key === 'End') { buf.splice(cur); tabState = null; renderLive(); e.preventDefault(); return; }
        var handled = true;
        switch (k) {
          case 'l': clearScreen(); break;
          case 'c': interrupt(); break;
          case 'z': if (session.prompt && session.prompt.kind === 'python') insertText('^Z'); break;
          case 'w': deleteWord(); break;                              // not a Windows binding, but harmless where the browser lets it through
          case 'a': break;
          case 'd': break;
          default: handled = false;
        }
        if (handled || (key.length === 1)) e.preventDefault();
        return;
      }
      if (alt) {
        if (key === 'Backspace') { deleteWord(); e.preventDefault(); return; }
        return;
      }
      switch (key) {
        case 'Enter':
          if (LAB.ui.isImeEnter(e)) return;
          e.preventDefault(); submit(); return;
        case 'Backspace':
          e.preventDefault();
          if (cur > 0) { buf.splice(cur - 1, 1); cur--; tabState = null; renderLive(); }
          return;
        case 'Delete':
          e.preventDefault();
          if (cur < buf.length) { buf.splice(cur, 1); tabState = null; renderLive(); }
          return;
        case 'ArrowLeft': e.preventDefault(); if (cur > 0) { cur--; renderLive(); } return;
        case 'ArrowRight': e.preventDefault(); if (cur < buf.length) { cur++; renderLive(); } return;
        case 'Home': e.preventDefault(); cur = 0; renderLive(); return;
        case 'End': e.preventDefault(); cur = buf.length; renderLive(); return;
        case 'ArrowUp': e.preventDefault(); if (!session.prompt && session.pending === null) histPrev(); return;
        case 'ArrowDown': e.preventDefault(); if (!session.prompt && session.pending === null) histNext(); return;
        case 'Tab': e.preventDefault(); doTab(shift); return;
        case 'PageUp': e.preventDefault(); screen.scrollTop -= screen.clientHeight - 2 * lh; return;
        case 'PageDown': e.preventDefault(); screen.scrollTop += screen.clientHeight - 2 * lh; return;
        case 'Escape':
          // PSReadLine: Esc throws away the whole line
          if (LAB.ui.isImeEnter(e)) return;
          e.preventDefault();
          if (buf.length) { buf = []; cur = 0; tabState = null; renderLive(); }
          return;
        default:
          if (key.length === 1 || key === 'Process' || key === 'Dead') tabState = null;
      }
    }
    function deleteWord() {
      var j = wordLeftIdx();
      if (j < cur) { buf.splice(j, cur - j); cur = j; tabState = null; renderLive(); }
    }
    function histPrev() {
      var hs = termState.history;
      if (!hs.length) return;
      if (histPos === -1) { stash = buf.join(''); histPos = hs.length; }
      if (histPos > 0) { histPos--; setBuf(hs[histPos]); }
    }
    function histNext() {
      var hs = termState.history;
      if (histPos === -1) return;
      histPos++;
      if (histPos >= hs.length) { histPos = -1; var t = stash || ''; stash = null; setBuf(t); }
      else setBuf(hs[histPos]);
    }

    ta.addEventListener('keydown', onKeyDown);
    screen.addEventListener('keydown', function (e) { if (e.target !== ta) onKeyDown(e); });
    ta.addEventListener('input', function () {
      if (composing) return;
      var v = ta.value;
      ta.value = '';
      if (v) insertText(v);
    });
    ta.addEventListener('paste', function (e) {
      e.preventDefault();
      var t = LAB.clipboard.forPaste(e);
      // files copied inside the practice PC paste as their Windows paths (quoted when they have spaces), not as the internal ones
      if (LAB.clipboard.paths && LAB.clipboard.paths.length && t === LAB.clipboard.text) t = LAB.clipboard.paths.map(LAB.shell.quotePath).join(' ');
      pasteText(t);
    });
    ta.addEventListener('compositionstart', function () { composing = true; comp = ''; });
    ta.addEventListener('compositionupdate', function (e) { comp = e.data || ''; renderLive(); });
    ta.addEventListener('compositionend', function (e) {
      composing = false;
      var v = e.data || ta.value || '';
      ta.value = '';
      comp = '';
      if (v) insertText(v); else renderLive();
    });
    ta.addEventListener('blur', function () {
      // a click on the title bar or the window body must not lose the keyboard
      setTimeout(function () {
        if (closed || !win || !win.isFocused()) return;
        var a = document.activeElement;
        if (a && a !== document.body) return;
        if (LAB.keys.hasModal && LAB.keys.hasModal()) return;
        var s = window.getSelection();
        if (s && !s.isCollapsed) return;
        focusInput();
      }, 0);
    });
    screen.addEventListener('mouseup', function () {
      var s = window.getSelection();
      if (!s || s.isCollapsed) focusInput();
    });
    screen.addEventListener('mousedown', function (e) { if (e.button === 2) e.preventDefault(); });      // a right click keeps the selection it is about to copy
    // right-click, as Windows Terminal does by default: copy the selection, or paste when nothing is selected
    screen.addEventListener('contextmenu', function (e) {
      e.preventDefault();
      if (selectionText()) { copySelection(); var s1 = window.getSelection(); if (s1) s1.removeAllRanges(); }
      else { focusInput(); pasteFromMenu(); }
    });
    screen.addEventListener('wheel', function (e) {
      if (!e.ctrlKey) return;
      e.preventDefault();
      setFontSize(fs + (e.deltaY < 0 ? 1 : -1));
    }, { passive: false });
    screen.addEventListener('scroll', function () {
      screen.classList.add('lab-scrolling');
      clearTimeout(screen._scT);
      screen._scT = setTimeout(function () { screen.classList.remove('lab-scrolling'); }, 900);
    });

    // ---- window
    var c0 = pickCells(cw, lh, 24, 40 + 2);
    win = LAB.wm.open({
      appId: 'terminal', title: 'Windows PowerShell', width: Math.ceil(c0.cols * cw) + 2 * PAD + 24, height: Math.ceil(c0.rows * lh) + 2 * PAD + 42,
      titlebar: 'custom', titlebarHeight: 40, captionHeight: 40, theme: 'dark', titlebarContent: strip,
      content: root, minW: 320, minH: 160, icon: 'app-terminal'
    });
    win.state.cwd = session.cwd;

    tabClose.addEventListener('click', function (e) { e.stopPropagation(); win.close(); });
    btnPlus.addEventListener('click', function (e) {
      e.stopPropagation();
      LAB.ui.toast('練習版沒有分頁，已經幫你開了新視窗');
      createTerminal({});
    });
    btnDrop.addEventListener('click', function (e) {
      e.stopPropagation();
      var r = LAB.stage.rectOf(btnDrop);
      if (!LAB.menu || !LAB.menu.contextMenu) return;
      function soon() { LAB.ui.toast('練習版沒有這個功能'); }
      LAB.menu.contextMenu(r.x, r.y + r.h + 2, [
        { label: 'Windows PowerShell', checked: true, action: function () {} },
        { label: '命令提示字元', action: soon },
        { separator: true },
        { label: '設定', shortcut: 'Ctrl+,', action: soon },
        { label: '命令選擇區', shortcut: 'Ctrl+Shift+P', action: soon }
      ], { dark: true });
    });
    tab.addEventListener('mousedown', function () { focusInput(); });

    var inst = {
      win: win, session: session,
      cols: function () { return cols; }, rows: function () { return rows; },
      copy: copySelection, paste: pasteFromMenu, selectAll: selectAll, clearAll: clearAll,
      zoom: function (d) { setFontSize(fs + d); }, insert: insertText, focus: focusInput,
      typed: function () { return buf.join(''); }, isBusy: function () { return busy; }, isDead: function () { return dead; },
      fontSize: function () { return fs; },
      /* type a line and press Enter (for tests and for other builders' code) */
      exec: function (line) { insertText(line); submit(); },
      /* the text of the screen as plain lines (history + the live line), for tests */
      screenText: function () {
        var lines = [];
        histEl.querySelectorAll('.tm-line').forEach(function (ln) {
          var t = '';
          ln.querySelectorAll('.tm-row').forEach(function (r) { t += r.textContent; });
          lines.push(t.replace(/\s+$/, ''));
        });
        liveEl.querySelectorAll('.tm-row').forEach(function (r) { lines.push(r.textContent.replace(/\s+$/, '')); });
        return lines;
      },
      rowTexts: function () {
        var out = [];
        screen.querySelectorAll('.tm-row').forEach(function (r) { out.push(r.textContent.replace(/\s+$/, '')); });
        return out;
      },
      resizeCells: function (c, r) { userSized = true; sizeToCells(c, r); fit(); },
      metrics: function () { return { cw: cw, lh: lh, fs: fs, cols: cols, rows: rows, userSized: userSized }; }
    };
    instances.set(win.id, inst);
    win.own(function () { instances.delete(win.id); });

    measure();
    updateMinSize();
    sizeToDefault();
    fit();

    // the banner of Windows PowerShell 5.1 in zh-TW (win-facts §3.1; the 「Install the latest PowerShell…」 line is left out), a blank line, the prompt
    termState.ttyCount = tty + 1;
    commitLine([['Windows PowerShell', '']]);
    commitLine([['Copyright (C) Microsoft Corporation. All rights reserved.', '']]);
    commitLine([['', '']]);
    showPrompt();

    // fonts arrive late: measure again, and keep the default size until the student resizes the window
    function remeasure() {
      if (closed) return;
      measure(); updateMinSize();
      if (!userSized) sizeToDefault();
      fit(); renderLive();
    }
    if (document.fonts) {
      try { document.fonts.load('16px "Cascadia Mono"').then(remeasure, function () {}); } catch (e) { /* ignored */ }
      if (document.fonts.ready && document.fonts.ready.then) document.fonts.ready.then(remeasure, function () {});
      if (document.fonts.addEventListener) {
        document.fonts.addEventListener('loadingdone', remeasure);
        win.own(function () { document.fonts.removeEventListener('loadingdone', remeasure); });
      }
    }
    if (typeof ResizeObserver !== 'undefined') {
      var ro = new ResizeObserver(function () { fit(); });
      ro.observe(root);
      win.own(function () { ro.disconnect(); });
    }
    setTimeout(remeasure, 320);
    win.own(win.on('resize', function () { if (!selfSizing) userSized = true; fit(); }));
    win.own(win.on('focus', function () { focusInput(); }));
    /* The window manager hands the keyboard focus back WITHOUT a 'focus' event when the window in front is closed or minimized
       (Notepad closed after `ii notes.txt`), and the browser has moved the real focus to the page body by then: take it back,
       and let a key typed at the bare page body reach the prompt (what Windows does: the front window gets the keys). */
    var refocusTimer = 0;
    function ensureFocus() {
      refocusTimer = 0;
      if (closed || dead || !win || !win.isFocused() || win.minimized) return;
      var a = document.activeElement;
      if (a === ta) return;
      if (a && a !== document.body && a !== document.documentElement && (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.isContentEditable)) return;
      if (LAB.keys.hasModal && LAB.keys.hasModal()) return;
      var s = window.getSelection();
      if (s && !s.isCollapsed && screen.contains(s.anchorNode)) return;
      focusInput();
    }
    function soonEnsureFocus() { if (!refocusTimer) refocusTimer = setTimeout(ensureFocus, 0); }
    ['win:close', 'win:minimize', 'win:restore', 'win:focus', 'desktop:focus'].forEach(function (n) { win.own(LAB.bus.on(n, soonEnsureFocus)); });
    function bodyKey(e) {
      if (e.defaultPrevented || closed || dead || !win.isFocused() || win.minimized) return;
      if (e.target !== document.body && e.target !== document.documentElement) return;
      if (LAB.keys.hasModal && LAB.keys.hasModal()) return;
      onKeyDown(e);
    }
    document.addEventListener('keydown', bodyKey);
    win.own(function () { document.removeEventListener('keydown', bodyKey); if (refocusTimer) { clearTimeout(refocusTimer); refocusTimer = 0; } });
    win.own(function () {
      closed = true;
      if (sleepTimer) { clearTimeout(sleepTimer); sleepTimer = 0; }
      clearTimeout(screen._scT);
      if (session.gen) { try { session.gen.return(); } catch (e) { /* ignore */ } }
    });

    // drag and drop: Windows paths typed at the cursor (quoted when they have spaces), never run
    win.own(LAB.dnd.target(win.el, {
      id: 'terminal:' + win.id,
      accept: function (pl) { return pl && pl.paths && pl.paths.length ? 'copy' : false; },
      drop: function (pl) {
        var text = pl.paths.map(LAB.shell.quotePath).join(' ') + ' ';
        win.focus();
        focusInput();
        insertText(text);
        LAB.bus.emit('term:drop', { winId: win.id, paths: pl.paths.slice(), text: text });
      }
    }));

    focusInput();
    setTimeout(focusInput, 30);
    return inst;
  }

  function currentTerminal() {
    var w = LAB.wm.focused();
    if (w && instances.has(w.id)) return instances.get(w.id);
    var lf = LAB.wm.lastFocused('terminal');
    return lf && instances.has(lf.id) ? instances.get(lf.id) : null;
  }

  /* the folder (or the parent folder of a file) a new window starts in */
  function folderOf(path) {
    var st = path ? LAB.vfs.stat(path) : null;
    return !st ? HOME : (st.type === 'dir' ? st.path : LAB.vfs.dirname(st.path));
  }

  LAB.apps.register('terminal', {
    title: '終端機', en: 'Terminal', aliases: ['terminal', 'shell', 'powershell', 'cmd', 'wt', '終端機'], icon: 'app-terminal', dock: true,
    open: function (a) { return createTerminal(a).win; },
    newWindow: function () { return createTerminal({}).win; },
    canHandle: function () { return true; },
    /* File Explorer's 「在終端機中開啟」, the desktop menu and a drop on the taskbar button: a NEW window in that folder */
    handleOpen: function (path) {
      createTerminal({ cwd: folderOf(path) });
      return true;
    }
  });

  /* LAB.terminal — public API
       instances            Map winId -> inst
       current()            the focused (or last focused) terminal instance, or null
       open({cwd|path})     a new window; returns inst
       openAt(path)         a new window whose folder is `path` (a file: its parent folder); returns inst   <- 「在終端機中開啟」
       state                {history, lastLogin, ttyCount}  (history = what ↑ recalls)
     inst: {win, session, cols(), rows(), exec(line), typed(), insert(text), focus(), copy(), paste(), selectAll(), clearAll(), zoom(d), fontSize(),
            screenText(), rowTexts(), resizeCells(c, r), isBusy(), isDead()}
     LAB.apps.launch('terminal', {cwd: '/Users/an/Desktop'}) also opens a new window there. */
  LAB.terminal = {
    instances: instances, current: currentTerminal, state: termState,
    open: function (a) { return createTerminal(a); },
    openAt: function (path) { return createTerminal({ cwd: folderOf(path) }); }
  };
})(window.LAB);

