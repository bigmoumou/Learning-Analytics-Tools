/* terminal.js [SKIN] — 終端機 on the practice Windows PC (DESIGN W5): Windows Terminal running Windows PowerShell 5.1 (zh-TW).
   Part A: LAB.shell — a PowerShell emulation, pure over session.vfs (lexer, parser, parameter binding, the red error records,
           commands, Tab completion). No DOM in here, so it can be unit-tested against a scratch VFS made with LAB.vfs.create(json).
   Part B: the Windows Terminal window (tab strip as title bar, cell-grid renderer, PSReadLine-style line editor, IME, drag and drop).
   Ground truth: win-facts.md §2–§6. Everything the facts do not show (error texts of cd/ls/mkdir/rm/cp/Rename-Item/parameter errors,
   `ls -l`, the `&&` parse error, tar.exe messages, Get-History and Get-Date layouts) was captured from a real Windows PowerShell 5.1
   with the zh-TW UI culture while writing this file; see notes/TERMINAL.md.

   Round 6 split: this file is the eager core (everything the Week 3 missions use: the line parser and evaluator, the renderer, parameter binding,
   ls cd pwd mkdir mv cp rm cat echo tar explorer ... with their exact outputs and errors, and the window). The long list of other commands
   (pipeline cmdlets, CSV, system, network, winget, python, git ...) is js/terminal-cmds.js, fetched when the first Terminal window opens.
   See notes/WIN-TERM6.md in the course folder (製作/lab-round6/notes). */
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
  defCmd({ id: 'whoami', canon: 'whoami', native: true, name: 'whoami', run: cmdWhoami }, ['whoami']);
  defCmd({ id: 'hostname', canon: 'hostname', native: true, name: 'hostname', run: cmdHostname }, ['hostname']);
  defCmd({ id: 'tar', canon: 'tar', native: true, name: 'tar', run: cmdTar }, ['tar']);
  defCmd({ id: 'explorer', canon: 'open', native: true, name: 'explorer', run: cmdExplorer }, ['explorer']);
  defCmd({ id: 'invoke', canon: 'open', spec: SPEC.invoke, run: cmdInvoke }, ['Invoke-Item', 'ii']);
  defCmd({ id: 'start', canon: 'open', spec: SPEC.start, run: cmdStart }, ['Start-Process', 'saps', 'start']);
  defCmd({ id: 'code', canon: 'code', native: true, name: 'code', run: cmdCode }, ['code', 'code.cmd']);
  defCmd({ id: 'notepad', canon: 'notepad', native: true, name: 'notepad', run: cmdNotepad }, ['notepad']);
  var NATIVE_EXE = { tar: 1, whoami: 1, hostname: 1, explorer: 1, notepad: 1, code: 1, help: 0 };

  /* a path as Select-String / a file item prints it: relative to the current folder when it is inside it */
  function relPathText(s, disp) {
    var cwd = dispCwd(s);
    var pre = cwd.charAt(cwd.length - 1) === '\\' ? cwd : cwd + '\\';
    return fold(disp).indexOf(fold(pre)) === 0 ? disp.slice(pre.length) : disp;
  }

  /* ---- Round 5 — Remove-Item: the real PowerShell question (texts read from the zh-TW resources of Windows PowerShell 5.1) */
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

  /* the session that is running (strOf of a file item shows a path relative to its folder) */
  var CUR = { session: null };

  /* names that exist only after `winget install` (git) or always (python: the Store stub); terminal-cmds.js fills the table */
  var DYNAMIC = {};

  /* the names Tab completes for the first word of a statement, with their real spelling (cmdlets as written in the help, aliases and programs in lower case).
     Built from the table at load, and again when terminal-cmds.js has added its commands. */
  var COMPLETE_NAMES = [];
  function rebuildCompleteNames() {
    var seen = {};
    COMPLETE_NAMES.length = 0;
    function add(n) { var l = n.toLowerCase(); if (!seen[l]) { seen[l] = 1; COMPLETE_NAMES.push(n); } }
    Object.keys(CMDS).forEach(function (k) {
      var d = CMDS[k];
      if (d.tier2 || k.indexOf('.') > 0 && !/\.exe$/.test(k)) return;
      if (d.spec && d.spec.name.toLowerCase() === k) add(d.spec.name); else add(k);
    });
    ['git', 'cd..'].forEach(add);
  }
  rebuildCompleteNames();

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

  /* ------------------------------------------------------------ names that only terminal-cmds.js has
     LAZY_SET: every command word (lower case) that the library defines. Until the library has arrived, or if it never does, they answer with one lab line
     instead of "not recognised" (the lab must not teach that they do not exist). tests/WIN-TERM6.py checks that this list is the library's own. */
  /* a leading * marks a program that also answers to name.exe and to its full path (ping.exe, C:\Windows\System32\ipconfig.exe) */
  var LAZY_WORDS = (
    '% ? attrib bash *calc chkdsk cleanmgr clip *cmd compare-object compress-archive convertfrom-csv convertfrom-json convertto-csv convertto-json ' +
    'curl *curl.exe diff diskpart epcsv expand-archive export-csv *find *findstr fl foreach foreach-object format format-list format-table format-wide ' +
    'ft fw gal gcb gcm get-alias get-ciminstance get-clipboard get-command get-computerinfo get-culture get-date get-disk get-eventlog ' +
    'get-executionpolicy get-filehash get-help get-job get-member get-netadapter get-netipaddress get-process get-psdrive get-random get-service ' +
    'get-timezone get-unique get-uptime get-variable get-volume get-wmiobject gin git git.exe gm gps group group-object gsv gu *help icacls import-csv ' +
    'invoke-restmethod invoke-webrequest *ipconfig ipcsv irm iwr join-path kill *man measure measure-object more msinfo32 mspaint nal net netstat ' +
    'new-alias new-object *nslookup oh out-file out-host out-null out-string *ping pip powershell ps python python.exe python3 python3.exe read-host ' +
    'reg regedit remove-variable resolve-path restart-service robocopy rvpa sal sc.exe scb schtasks scp select select-object select-string set-alias ' +
    'set-clipboard set-executionpolicy set-variable sfc shutdown sls sort sort-object split-path spps ssh start-job start-service stop-process ' +
    'stop-service *systeminfo takeown *taskkill *tasklist *taskmgr tee tee-object test-connection *tracert *tree *tree.com wget where where-object ' +
    '*where.exe *winget wmic write-debug write-error write-information write-verbose write-warning wsl wt xcopy'
  );
  var LAZY_SET = Object.create(null);
  LAZY_WORDS.split(' ').forEach(function (n) { if (n.charAt(0) === '*') LAZY_SET[n.slice(1)] = 2; else if (n) LAZY_SET[n] = 1; });
  function isLazyName(nameL) {
    if (LAZY_SET[nameL]) return true;
    var m = /^(?:.*[\\\/])?([^\\\/]+)\.(?:exe|cmd)$/.exec(nameL);
    return !!m && LAZY_SET[m[1]] === 2;
  }
  var NOT_LOADED = { id: 'tier2', canon: 'unknown', tier2: true, notloaded: true, name: '' };
  var NOT_LOADED_TEXT = '這個指令練習版還沒載入，請重新整理後再試\n';

  /* does this line use a command that only the library has? (a command word we cannot read before running counts as yes) */
  function wordNeedsLibrary(w) {
    if (!w || w.k === 'param') return false;
    if (w.parts && w.parts.length === 1 && w.parts[0].k === 'lit') return isLazyName(String(w.parts[0].s).toLowerCase());
    return !!(w.parts && w.parts.length);
  }
  function nodeNeedsLibrary(n, budget) {
    if (!n || typeof n !== 'object') return false;
    if (budget.n-- <= 0) return true;
    if (Array.isArray(n)) { for (var i = 0; i < n.length; i++) if (nodeNeedsLibrary(n[i], budget)) return true; return false; }
    if (Array.isArray(n.words) && n.words.length && wordNeedsLibrary(n.words[0])) return true;
    for (var k in n) if (hasOwn.call(n, k) && n[k] && typeof n[k] === 'object' && nodeNeedsLibrary(n[k], budget)) return true;
    return false;
  }
  function needsLibrary(line, session) {
    if (session && session.prompt) return false;                       // the answer to a question a running command asked
    var src = String(line);
    if (session && session.pending !== null) src = session.pending + '\n' + src;
    var lx = lex(src);
    if (lx.incomplete || lx.parseError || lx.unsupported) return false;  // the core prints those itself
    return nodeNeedsLibrary(lx.stmts, { n: 20000 });
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
    if (!LAB.shell.library && isLazyName(nameL)) return { def: NOT_LOADED };      // the library is not here (yet)
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
            if (def.tier2) { ctx.native(def.notloaded ? NOT_LOADED_TEXT : ctx.name + ': 這個指令真的 Windows 上有，但練習版還沒做\n'); status = 1; }
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

  /* ------------------------------------------------------------ the command library (js/terminal-cmds.js)
     Everything the missions need is in this file. The long list of other commands is a second file that is fetched when the first Terminal window opens,
     so the desktop stays light. A line typed before it has arrived waits for it (at most 6 s; Ctrl+C gives up); if it never arrives the commands of this
     file still work and the others answer 「這個指令練習版還沒載入，請重新整理後再試」. */
  var lib = { state: 'idle', cbs: [], src: 'js/terminal-cmds.js' };
  try {
    var curScript = document.currentScript;
    if (curScript && curScript.src) lib.src = curScript.src.replace(/terminal\.js(\?[^#]*)?(#.*)?$/, 'terminal-cmds.js$1');
  } catch (eSrc) { /* keep the relative address */ }
  function loadLibrary(cb) {
    if (LAB.shell && LAB.shell.library && lib.state !== 'ready') lib.state = 'ready';
    if (lib.state === 'ready' || lib.state === 'failed') { if (cb) cb(lib.state === 'ready'); return; }
    if (cb) lib.cbs.push(cb);
    if (lib.state === 'loading') return;
    lib.state = 'loading';
    var timer = 0;
    function done(ok) {
      if (lib.state !== 'loading') return;
      lib.state = ok ? 'ready' : 'failed';
      clearTimeout(timer);
      var list = lib.cbs.slice();
      lib.cbs.length = 0;
      list.forEach(function (f) { try { f(ok); } catch (e) { console.error('[terminal] library callback', e); } });
    }
    timer = setTimeout(function () { done(false); }, 6000);
    var el = document.createElement('script');
    el.src = lib.src;
    el.async = true;
    el.onload = function () { done(!!(LAB.shell && LAB.shell.library)); };
    el.onerror = function () { done(false); };
    (document.head || document.documentElement).appendChild(el);
  }

  LAB.shell = {
    newSession: newSession, run: run, resume: resume, cancel: cancel, complete: complete,
    commands: CMDS, lex: lex, quotePath: quotePath, escape: quotePath, errorText: errorText, resolvePath: resolvePath, wrap: wrapCells, dispCwd: dispCwd,
    tableText: tableText, KEEP_TYPED_CASE: KEEP_TYPED_CASE,
    needsLibrary: needsLibrary,
    load: function () { return new Promise(function (res) { loadLibrary(res); }); },
    libraryState: function () { if (LAB.shell.library) lib.state = 'ready'; return lib.state; },     // (a file that arrives after the 6 s counts as ready)
    libraryNames: function () { return Object.keys(LAZY_SET); },        // the command words only terminal-cmds.js defines (tests compare them with the real ones)
    library: false, api: null
  };

  /* =====================================================================
     PART B — persisted state and the Windows Terminal window
     ===================================================================== */

  /* ↑ recalls what was typed in earlier windows (PSReadLine keeps one history file); Get-History is per window (session.hist) */
  var termState = { history: [], lastLogin: null, ttyCount: 0, installed: { git: false, python: false }, gitConfig: { name: '', email: '' } };
  var MAX_HISTORY = 200;
  /* what terminal-cmds.js takes from this file (it reads LAB.shell.api once, when it is loaded) */
  LAB.shell.api = {
    CMDS: CMDS, DAY_EN: DAY_EN, DYNAMIC: DYNAMIC, HOST: HOST, PSHash: PSHash, PSObj: PSObj, SPEC: SPEC, SPECIAL_VIEWS: SPECIAL_VIEWS, T_ARR: T_ARR,
    T_CUSTOM: T_CUSTOM, T_STR: T_STR, USER: USER, blockTruthy: blockTruthy, commas: commas, dH12: dH12, dLongTime: dLongTime, dTT: dTT,
    dateParts: dateParts, defCmd: defCmd, dispCwd: dispCwd, displayWidth: displayWidth, ellipsize: ellipsize, errorText: errorText,
    expandPath: expandPath, failPathNotFound: failPathNotFound, fileDir: fileDir, fileNamesFor: fileNamesFor, fileProps: fileProps,
    flattenForRender: flattenForRender, formatDate: formatDate, genericTable: genericTable, getMember: getMember, hasOwn: hasOwn, hasWild: hasWild,
    hasWildChars: hasWildChars, invokeBlock: invokeBlock, isBlock: isBlock, isDate: isDate, isFileObj: isFileObj, isHash: isHash,
    isHiddenItem: isHiddenItem, isObj: isObj, isTrash: isTrash, joinDisp: joinDisp, listText: listText, makeCmpTest: makeCmpTest, mapVfs: mapVfs,
    mkDate: mkDate, mkObj: mkObj, namedCol: namedCol, netRegex: netRegex, ntfsCmp: ntfsCmp, numStr: numStr, padL: padL, padR: padR,
    parentDisp: parentDisp, parseDateStr: parseDateStr, pathArgs: pathArgs, propNames: propNames, psCompare: psCompare, psEquals: psEquals,
    reEsc: reEsc, rebuildCompleteNames: rebuildCompleteNames, relPathText: relPathText, renderObjs: renderObjs, resolvePath: resolvePath,
    roundEven: roundEven, rtrim: rtrim, setVar: setVar, shortType: shortType, splitSegs: splitSegs, strCmp: strCmp, strOf: strOf, sw: sw,
    tableLinesOf: tableLinesOf, termState: termState, toBool: toBool, toNum: toNum, two: two, typeNameOf: typeNameOf, ufmtDate: ufmtDate,
    unroll: unroll, unwrapOut: unwrapOut, val: val, wildRegex: wildRegex, winOfSegs: winOfSegs
  };
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
    var busy = false, dead = false, composing = false, userSized = false, selfSizing = false, waitingLib = false, waitTok = 0;
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
      if (!busy && !waitingLib) {
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
      if (busy || dead || waitingLib) return;
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
    function editable() { return !busy && !dead && !waitingLib; }

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
      if (busy || dead || waitingLib) return;
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
      if (lib.state === 'ready' || lib.state === 'failed' || !needsLibrary(line, session)) { handleResult(LAB.shell.run(line, session)); return; }
      // the command library is still on its way: wait for it (Ctrl+C gives up)
      var tok = ++waitTok;                 // (a line given up with Ctrl+C must not run when a later wait ends)
      waitingLib = true;
      renderLive();
      loadLibrary(function () {
        if (tok !== waitTok || !waitingLib || closed) return;
        waitingLib = false;
        handleResult(LAB.shell.run(line, session));
      });
    }
    function interrupt() {
      if (dead) return;
      if (waitingLib) { waitingLib = false; waitTok++; commitLine([['^C', '']]); showPrompt(); return; }
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
      if (busy || waitingLib) {
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
      typed: function () { return buf.join(''); }, isBusy: function () { return busy || waitingLib; }, isDead: function () { return dead; },
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

    loadLibrary();                         // the long list of commands comes in the background (a line typed meanwhile waits for it)
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

