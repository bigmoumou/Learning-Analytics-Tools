/* terminal.js [PORTABLE shell + SKIN window] — LAB.shell (zsh emulation, pure over session.vfs) and the 終端機 app. DESIGN §4.2.
   Part A: LAB.shell (lexer, parser, expansion, commands, completion).  Part B: the Terminal window (renderer, line editor, IME, drag and drop, menus). */
(function (LAB) {
  'use strict';

  var h = LAB.util.h;
  var charWidth = LAB.util.charWidth;
  var displayWidth = LAB.util.displayWidth;
  var HOME = LAB.vfs.HOME;
  var hasOwn = Object.prototype.hasOwnProperty;

  /* =====================================================================
     PART A — LAB.shell
     ===================================================================== */

  function pad(s, n, left) {
    s = String(s);
    var w = displayWidth(s);
    if (w >= n) return s;
    var sp = new Array(n - w + 1).join(' ');
    return left ? sp + s : s + sp;
  }
  function p2(n) { return (n < 10 ? '0' : '') + n; }

  var SAFE_RE = /[A-Za-z0-9_.\/~+@:,%=-]/;
  /* shell-escape one path for typing into the command line (DESIGN §4.2.5): CJK stays as it is, like macOS */
  function shellEscape(str) {
    var out = '';
    for (var ch of String(str)) {
      var cp = ch.codePointAt(0);
      if (SAFE_RE.test(ch) || charWidth(cp) === 2) out += ch; else out += '\\' + ch;
    }
    return out;
  }

  /* ------------------------------------------------------------------ lexer */
  function wordEnd(src, i) {
    while (i < src.length && ' \t\r\n;&|<>'.indexOf(src.charAt(i)) < 0) i++;
    return i;
  }
  /* the text of a `$(...)` starting at i, balanced; falls back to the rest of the word */
  function dollarParen(src, i) {
    var depth = 0, j = i + 1;
    for (; j < src.length; j++) {
      var c = src.charAt(j);
      if (c === '(') depth++;
      else if (c === ')') { depth--; if (depth === 0) return src.slice(i, j + 1); }
    }
    return src.slice(i, wordEnd(src, i));
  }
  /* read a `$` expansion at src[i]: {k:'var',name,len} | {k:'lit'} | {k:'unsupported',token} */
  function readDollar(src, i) {
    var nx = src.charAt(i + 1);
    if (nx === '(') return { k: 'unsupported', token: dollarParen(src, i) };
    if (nx === '{') {
      var close = src.indexOf('}', i + 2);
      if (close < 0) return { k: 'lit' };
      var nm = src.slice(i + 2, close);
      if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(nm)) return { k: 'var', name: nm, len: close + 1 - i };
      return { k: 'unsupported', token: src.slice(i, close + 1) };
    }
    if (nx === '?') return { k: 'var', name: '?', len: 2 };
    if (/[A-Za-z_]/.test(nx)) {
      var j = i + 1;
      while (j < src.length && /[A-Za-z0-9_]/.test(src.charAt(j))) j++;
      return { k: 'var', name: src.slice(i + 1, j), len: j - i };
    }
    if (/[0-9]/.test(nx)) return { k: 'var', name: nx, len: 2 };
    return { k: 'lit' };
  }

  /* lex(src) -> {tokens, incomplete:ps2|null, unsupported:token|null, parseError:token|null}
     tokens: {t:'word', parts:[{k:'lit',s,q,tilde?}|{k:'var',name,q}], raw} and {t:'op', op} (op: ; nl && || | > >>)
     q: 0 unquoted, 1 single quotes, 2 double quotes, 3 backslash escape */
  function lex(src) {
    var toks = [];
    var res = { tokens: toks, incomplete: null, unsupported: null, parseError: null };
    var i = 0, n = src.length;
    var parts = null, wordStart = 0;

    function startWord() { if (!parts) { parts = []; wordStart = i; } }
    function endWord() {
      if (parts) { toks.push({ t: 'word', parts: parts, raw: src.slice(wordStart, i) }); parts = null; }
    }
    function addLit(s, q) {
      startWord();
      var last = parts[parts.length - 1];
      if (last && last.k === 'lit' && last.q === q && !last.tilde) last.s += s;
      else parts.push({ k: 'lit', s: s, q: q });
    }

    while (i < n) {
      var c = src.charAt(i);
      if (c === ' ' || c === '\t' || c === '\r') { endWord(); i++; continue; }
      if (c === '\n') { endWord(); toks.push({ t: 'op', op: 'nl' }); i++; continue; }

      if (c === '\\') {
        if (i + 1 >= n) { res.incomplete = '> '; return res; }
        var nx = src.charAt(i + 1);
        if (nx === '\n') { i += 2; continue; }               // line continuation: the word carries on
        var ecp = src.codePointAt(i + 1), el = ecp > 0xFFFF ? 2 : 1;
        addLit(src.substr(i + 1, el), 3);
        i += 1 + el;
        continue;
      }

      if (c === "'") {
        var j = src.indexOf("'", i + 1);
        if (j < 0) { res.incomplete = 'quote> '; return res; }
        startWord();
        parts.push({ k: 'lit', s: src.slice(i + 1, j), q: 1 });
        i = j + 1;
        continue;
      }

      if (c === '"') {
        startWord();
        i++;
        var buf = '', closed = false, pushed = false;
        var flush = function () { if (buf !== '') { parts.push({ k: 'lit', s: buf, q: 2 }); buf = ''; pushed = true; } };
        while (i < n) {
          var d = src.charAt(i);
          if (d === '"') { closed = true; i++; break; }
          if (d === '\\') {
            if (i + 1 >= n) break;
            var e2 = src.charAt(i + 1);
            if (e2 === '$' || e2 === '`' || e2 === '"' || e2 === '\\') { buf += e2; i += 2; continue; }
            if (e2 === '\n') { i += 2; continue; }
            buf += '\\'; i++; continue;
          }
          if (d === '`') {
            var k2 = src.indexOf('`', i + 1);
            res.unsupported = k2 < 0 ? '`' : src.slice(i, k2 + 1);
            return res;
          }
          if (d === '$') {
            var dv = readDollar(src, i);
            if (dv.k === 'unsupported') { res.unsupported = dv.token; return res; }
            if (dv.k === 'var') { flush(); parts.push({ k: 'var', name: dv.name, q: 2 }); pushed = true; i += dv.len; continue; }
            buf += '$'; i++; continue;
          }
          var dcp = src.codePointAt(i), dl = dcp > 0xFFFF ? 2 : 1;
          buf += src.substr(i, dl); i += dl;
        }
        if (!closed) { res.incomplete = 'dquote> '; return res; }
        flush();
        if (!pushed) parts.push({ k: 'lit', s: '', q: 2 });
        continue;
      }

      if (c === '`') {
        var kb = src.indexOf('`', i + 1);
        res.unsupported = kb < 0 ? '`' : src.slice(i, kb + 1);
        return res;
      }

      if (c === '$') {
        var uv = readDollar(src, i);
        if (uv.k === 'unsupported') { res.unsupported = uv.token; return res; }
        if (uv.k === 'var') { startWord(); parts.push({ k: 'var', name: uv.name, q: 0 }); i += uv.len; continue; }
        addLit('$', 0); i++; continue;
      }

      if (c === ';' || c === '&' || c === '|' || c === '<' || c === '>') {
        if (c === '>' && parts && parts.length === 1 && parts[0].k === 'lit' && parts[0].s === '2' && parts[0].q === 0 && wordStart === i - 1) {
          res.unsupported = '2>'; return res;
        }
        endWord();
        var two = src.substr(i, 2);
        if (two === '&&') { toks.push({ t: 'op', op: '&&' }); i += 2; continue; }
        if (two === '||') { toks.push({ t: 'op', op: '||' }); i += 2; continue; }
        if (two === ';;') { res.parseError = ';;'; return res; }
        if (two === '>>') { toks.push({ t: 'op', op: '>>' }); i += 2; continue; }
        if (two === '&>') { res.unsupported = '&>'; return res; }
        if (c === '&') { res.unsupported = '&'; return res; }
        if (c === '<') { res.unsupported = '<'; return res; }
        toks.push({ t: 'op', op: c });
        i++;
        continue;
      }

      if (c === '(' || c === ')') { res.parseError = c; return res; }

      if (c === '{') {
        var we = wordEnd(src, i);
        var close = src.indexOf('}', i + 1);
        if (close > 0 && close < we) {
          var inner = src.slice(i + 1, close);
          if (inner.indexOf(',') >= 0) { res.unsupported = src.slice(i, close + 1); return res; }
        }
      }

      if (c === '!' && !parts) {
        var after = src.charAt(i + 1);
        if (after !== '' && after !== ' ' && after !== '\t' && after !== '\n' && after !== '=') {
          res.unsupported = src.slice(i, wordEnd(src, i));
          return res;
        }
      }

      if (c === '~' && !parts) {
        var tn = src.charAt(i + 1);
        if (tn === '' || tn === '/' || tn === ' ' || tn === '\t' || tn === '\n' || tn === ';' || tn === '&' || tn === '|' || tn === '>' || tn === '<') {
          startWord();
          parts.push({ k: 'lit', s: '~', q: 0, tilde: true });
          i++;
          continue;
        }
      }

      var cp = src.codePointAt(i), cl = cp > 0xFFFF ? 2 : 1;
      addLit(src.substr(i, cl), 0);
      i += cl;
    }
    endWord();
    return res;
  }

  /* ----------------------------------------------------------------- parser */
  function opText(t) {
    if (!t) return '\\n';
    if (t.t === 'word') return t.raw;
    return t.op === 'nl' ? '\\n' : t.op;
  }
  /* parse(tokens) -> {items:[{conn, pipe:[{words, redirs}]}]} | {error:'<token>'} */
  function parse(toks) {
    var items = [];
    var i = 0, conn = null;
    function skipNl() { while (i < toks.length && toks[i].t === 'op' && toks[i].op === 'nl') i++; }
    skipNl();
    while (i < toks.length) {
      var pipe = [];
      for (;;) {
        var cmd = { words: [], redirs: [] };
        while (i < toks.length) {
          var t = toks[i];
          if (t.t === 'word') { cmd.words.push(t); i++; continue; }
          if (t.op === '>' || t.op === '>>') {
            var tg = toks[i + 1];
            if (!tg) return { error: '\\n' };
            if (tg.t === 'op') return { error: opText(tg) };
            cmd.redirs.push({ op: t.op, target: tg });
            i += 2;
            continue;
          }
          break;
        }
        if (!cmd.words.length && !cmd.redirs.length) return { error: i < toks.length ? opText(toks[i]) : '\\n' };
        pipe.push(cmd);
        if (i < toks.length && toks[i].t === 'op' && toks[i].op === '|') {
          i++; skipNl();
          if (i >= toks.length) return { error: '\\n' };
          continue;
        }
        break;
      }
      items.push({ conn: conn, pipe: pipe });
      if (i >= toks.length) break;
      var op = toks[i].op;
      i++;
      if (op === '&&' || op === '||') {
        conn = op; skipNl();
        if (i >= toks.length) return { error: '\\n' };
      } else { conn = ';'; skipNl(); }
    }
    return { items: items };
  }

  /* -------------------------------------------------------------- expansion */
  function globTokens(segs) {
    var toks = [];
    segs.forEach(function (sg) {
      var s = sg.s, i = 0;
      while (i < s.length) {
        var ch = s.charAt(i);
        if (ch === '/') { toks.push({ c: 'sep' }); i++; continue; }
        if (sg.g && ch === '*') { toks.push({ c: 'any' }); i++; continue; }
        if (sg.g && ch === '?') { toks.push({ c: 'one' }); i++; continue; }
        if (sg.g && ch === '[') {
          var j = i + 1, neg = false;
          if (s.charAt(j) === '!' || s.charAt(j) === '^') { neg = true; j++; }
          var start = j, close = -1;
          while (j < s.length) {
            if (s.charAt(j) === ']' && j > start) { close = j; break; }
            j++;
          }
          if (close < 0) { toks.push({ c: 'lit', v: '[' }); i++; continue; }
          var body = s.slice(start, close), items = [], k = 0;
          while (k < body.length) {
            if (body.charAt(k + 1) === '-' && k + 2 < body.length) { items.push([body.charAt(k), body.charAt(k + 2)]); k += 3; }
            else { items.push([body.charAt(k), body.charAt(k)]); k++; }
          }
          toks.push({ c: 'cls', neg: neg, items: items });
          i = close + 1;
          continue;
        }
        toks.push({ c: 'lit', v: ch });
        i++;
      }
    });
    return toks;
  }
  function reEsc(s) { return s.replace(/[\\^$.*+?()[\]{}|\/-]/g, '\\$&'); }
  function segRegex(seg) {
    var re = '^';
    seg.forEach(function (t) {
      if (t.c === 'lit') re += reEsc(t.v);
      else if (t.c === 'any') re += '[\\s\\S]*';
      else if (t.c === 'one') re += '[\\s\\S]';
      else if (t.c === 'cls') {
        re += '[' + (t.neg ? '^' : '');
        t.items.forEach(function (it) { re += reEsc(it[0]) + (it[0] === it[1] ? '' : '-' + reEsc(it[1])); });
        re += ']';
      }
    });
    return new RegExp(re + '$');
  }
  function hasGlobChars(segs) {
    for (var i = 0; i < segs.length; i++) if (segs[i].g && /[*?\[]/.test(segs[i].s)) return true;
    return false;
  }
  function globExpand(segs, session) {
    var vfs = session.vfs;
    var toks = globTokens(segs);
    var parts = [[]];
    toks.forEach(function (t) { if (t.c === 'sep') parts.push([]); else parts[parts.length - 1].push(t); });
    var abs = parts.length > 1 && parts[0].length === 0;
    var results = [];
    function rec(prefix, baseAbs, idx) {
      if (idx >= parts.length) return;
      var seg = parts[idx];
      var last = idx === parts.length - 1;
      if (seg.length === 0) {
        if (last) { if (vfs.isDir(baseAbs)) results.push(prefix); return; }
        rec(prefix, baseAbs, idx + 1);
        return;
      }
      var isLit = seg.every(function (t) { return t.c === 'lit'; });
      if (isLit) {
        var name = seg.map(function (t) { return t.v; }).join('');
        var next = vfs.join(baseAbs, name);
        if (!vfs.exists(next)) return;
        if (last) results.push(prefix + name);
        else if (vfs.isDir(next)) rec(prefix + name + '/', next, idx + 1);
        return;
      }
      var entries;
      try { entries = vfs.list(baseAbs); } catch (e) { return; }
      var re = segRegex(seg);
      var dotStart = seg[0].c === 'lit' && seg[0].v === '.';
      entries.forEach(function (st) {
        if (st.name.charAt(0) === '.' && !dotStart) return;
        if (!re.test(st.name.normalize('NFC'))) return;
        if (!last && st.type !== 'dir') return;
        if (last) results.push(prefix + st.name);
        else rec(prefix + st.name + '/', st.path, idx + 1);
      });
    }
    if (abs) rec('/', '/', 1); else rec('', vfs.normalize(session.cwd), 0);
    results.sort(function (a, b) { return a < b ? -1 : a > b ? 1 : 0; });
    return results;
  }

  /* expandWord -> {words:[…]} | {error:'zsh: no matches found: …'} */
  function expandWord(tok, session) {
    var env = session.env;
    var segs = [], anyQuoted = false, anyText = false;
    tok.parts.forEach(function (p, idx) {
      if (p.k === 'var') {
        var v = p.name === '?' ? String(session.status) : (hasOwn.call(env, p.name) ? String(env[p.name]) : '');
        segs.push({ s: v, g: false });
        if (p.q) anyQuoted = true;
        if (v !== '') anyText = true;
      } else if (p.tilde && idx === 0) {
        segs.push({ s: env.HOME + p.s.slice(1), g: false });
        anyText = true;
      } else if (p.q === 0) {
        segs.push({ s: p.s, g: true });
        if (p.s !== '') anyText = true;
      } else {
        segs.push({ s: p.s, g: false });
        anyQuoted = true;
        anyText = true;
      }
    });
    var joined = segs.map(function (s) { return s.s; }).join('');
    if (hasGlobChars(segs)) {
      var found = globExpand(segs, session);
      if (!found.length) return { error: 'zsh: no matches found: ' + tok.raw };
      return { words: found };
    }
    if (joined === '' && !anyQuoted) return { words: [] };
    if (!anyText && !anyQuoted) return { words: [] };
    return { words: [joined] };
  }

  /* ------------------------------------------------------------ path helpers */
  function resolvePath(session, p) {
    p = String(p);
    if (p.charAt(0) === '~') p = './' + p;     // a literal ~ (quoted) is just a name
    return session.vfs.normalize(p, session.cwd);
  }
  function abbrevHome(session, p) {
    var home = session.env.HOME;
    if (p === home) return '~';
    if (p.indexOf(home + '/') === 0) return '~' + p.slice(home.length);
    return p;
  }
  function errLine(prefix, arg, code, vfs) { return prefix + ': ' + arg + ': ' + vfs.errText(code) + '\n'; }

  var PROTECTED_STD = ['Desktop', 'Documents', 'Downloads', 'Library', 'Movies', 'Music', 'Pictures', 'Public'];
  /* '' when fine, else 'root' | 'protected' */
  function protectedKind(session, abs) {
    var vfs = session.vfs;
    var c = vfs.canon(abs);
    if (c === '/') return 'root';
    var list = ['/Users', '/Applications', session.env.HOME].concat(PROTECTED_STD.map(function (n) { return session.env.HOME + '/' + n; }));
    for (var i = 0; i < list.length; i++) if (vfs.canon(list[i]) === c) return 'protected';
    return '';
  }

  /* ------------------------------------------------------ option parsing */
  var USAGE = {
    ls: ['usage: ls [-@ABCFGHILOPRSTUWXabcdefghiklmnopqrstuvwxy1%,] [--color=when] [-D format] [file ...]'],
    mkdir: ['usage: mkdir [-pv] [-m mode] directory ...'],
    touch: ['usage: touch [-A [-][[hh]mm]SS] [-achm] [-r file] [-t [[CC]YY]MMDDhhmm[.SS]] file ...'],
    cat: ['usage: cat [-belnstuv] [file ...]'],
    cp: ['usage: cp [-R [-H | -L | -P]] [-fi | -n] [-aclpSsvXx] source_file target_file', '       cp [-R [-H | -L | -P]] [-fi | -n] [-aclpSsvXx] source_file ... target_directory'],
    mv: ['usage: mv [-f | -i | -n] [-hv] source target', '       mv [-f | -i | -n] [-v] source ... directory'],
    rm: ['usage: rm [-f | -i] [-dIPRrvWx] file ...', '       unlink [--] file'],
    rmdir: ['usage: rmdir [-p] directory ...'],
    wc: ['usage: wc [-Lclmw] [file ...]'],
    head: ['usage: head [-n count | -c bytes] [file ...]'],
    tail: ['usage: tail [-r] [-q] [-c # | -n #] [file ...]'],
    pwd: ['usage: pwd [-L | -P]'],
    sleep: ['usage: sleep seconds']
  };
  var LETTERS = {
    ls: '@ABCFGHILOPRSTUWXabcdefghiklmnopqrstuvwxy1%,', mkdir: 'pvm', touch: 'AacfhmrtT', cat: 'belnstuv', cp: 'RHLPfinaclpSsvXxr',
    mv: 'finhv', rm: 'fiIdPRrvWx', rmdir: 'p', wc: 'Lclmw', head: 'nc', tail: 'FfrqbCcn', pwd: 'LP'
  };
  var WITHARG = { mkdir: 'm', touch: 'Art', head: 'nc', tail: 'bcn' };

  /* parseOpts(name, args) -> {flags:{}, vals:{}, rest:[], error:string|null}   (stops at the first operand, like BSD getopt) */
  function parseOpts(name, args) {
    var letters = LETTERS[name] || '', withArg = WITHARG[name] || '';
    var flags = {}, vals = {}, i = 0;
    function fail(msg) {
      return { flags: flags, vals: vals, rest: [], error: msg + '\n' + (USAGE[name] || []).join('\n') + '\n' };
    }
    for (; i < args.length; i++) {
      var a = args[i];
      if (a === '--') { i++; break; }
      if (a.charAt(0) !== '-' || a === '-') break;
      if (a.charAt(1) === '-') {
        if (name === 'ls' && a.indexOf('--color') === 0) continue;
        return fail(name + ': unrecognized option `' + a + "'");
      }
      for (var k = 1; k < a.length; k++) {
        var ch = a.charAt(k);
        if (letters.indexOf(ch) < 0) return fail(name + ': illegal option -- ' + ch);
        flags[ch] = true;
        if (withArg.indexOf(ch) >= 0) {
          var rest = a.slice(k + 1);
          if (rest) { vals[ch] = rest; }
          else if (i + 1 < args.length) { i++; vals[ch] = args[i]; }
          else return fail(name + ': option requires an argument -- ' + ch);
          break;
        }
      }
    }
    return { flags: flags, vals: vals, rest: args.slice(i), error: null };
  }
  function usageResult(ctx, name) {
    ctx.err((USAGE[name] || []).join('\n') + '\n');
    return 1;
  }

  /* ------------------------------------------------------------------ ls */
  function humanSize(n) {
    if (n < 1024) return n + 'B';
    var units = ['K', 'M', 'G', 'T'], v = n, i = -1;
    do { v /= 1024; i++; } while (v >= 1024 && i < units.length - 1);
    var s = v < 10 ? (Math.round(v * 10) / 10).toFixed(1) : String(Math.round(v));
    return s + units[i];
  }
  function columns(names, cols) {
    if (!names.length) return '';
    var maxW = 0;
    names.forEach(function (nm) { var w = displayWidth(nm); if (w > maxW) maxW = w; });
    var colw = (maxW + 8) & ~7;
    var numcols = Math.max(1, Math.floor(cols / colw));
    var numrows = Math.ceil(names.length / numcols);
    numcols = Math.ceil(names.length / numrows);
    var out = '';
    for (var r = 0; r < numrows; r++) {
      var line = '';
      for (var c = 0; c < numcols; c++) {
        var idx = c * numrows + r;
        if (idx >= names.length) break;
        var nm = names[idx];
        var more = (c + 1) * numrows + r < names.length;
        line += more ? pad(nm, colw) : nm;
      }
      out += line + '\n';
    }
    return out;
  }

  function lsCommand(args, ctx) {
    var s = ctx.session, vfs = s.vfs;
    var o = parseOpts('ls', args);
    if (o.error) { ctx.err(o.error); return 1; }
    var F = o.flags;
    var ops = o.rest.length ? o.rest : ['.'];
    var status = 0;
    var long = !!F.l;
    var oneCol = !!F['1'] || !ctx.tty;
    var showAll = !!(F.a || F.A);

    function sortList(list) {
      var l = list.slice();
      l.sort(function (a, b) {
        var r = 0;
        if (F.t) r = b.st.mtime - a.st.mtime;
        else if (F.S) r = b.st.size - a.st.size;
        if (r === 0) r = a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
        return r;
      });
      if (F.r) l.reverse();
      return l;
    }
    function subdirCount(path) {
      var n = 0;
      try { vfs.list(path).forEach(function (x) { if (x.type === 'dir') n++; }); } catch (e) { n = 0; }
      return n;
    }
    function label(e) { return e.name + (F.F && e.st.type === 'dir' ? '/' : ''); }
    function format(entries, withTotal) {
      if (!entries.length) return '';
      if (long) {
        var rows = entries.map(function (e) {
          var st = e.st, isDir = st.type === 'dir';
          return {
            perm: (isDir ? 'd' : '-') + (isDir ? 'rwxr-xr-x' : 'rw-r--r--'),
            nlink: String(isDir ? 2 + subdirCount(st.path) : 1),
            size: F.h ? humanSize(isDir ? 64 + 32 * (st.count || 0) : st.size) : String(isDir ? 64 + 32 * (st.count || 0) : st.size),
            date: LAB.util.fmt.lsDate(st.mtime), name: label(e), blocks: isDir ? 0 : Math.ceil(st.size / 4096) * 8
          };
        });
        var wl = 0, ws = 0, total = 0;
        rows.forEach(function (r) { wl = Math.max(wl, r.nlink.length); ws = Math.max(ws, r.size.length); total += r.blocks; });
        var out = withTotal ? 'total ' + total + '\n' : '';
        rows.forEach(function (r) {
          out += r.perm + '  ' + pad(r.nlink, wl, true) + ' an  staff  ' + pad(r.size, ws, true) + ' ' + r.date + ' ' + r.name + '\n';
        });
        return out;
      }
      var names = entries.map(label);
      if (oneCol) return names.join('\n') + '\n';
      return columns(names, s.cols || 80);
    }
    function listDir(arg, path, header, first) {
      if (!first) ctx.out('\n');
      if (header) ctx.out(arg + ':\n');
      var list;
      try { list = vfs.list(path); } catch (e) { ctx.err(errLine('ls', arg, e.code || 'EACCES', vfs)); status = 1; return; }
      var entries = list.filter(function (st) { return showAll || !st.dot; }).map(function (st) { return { name: st.name, st: st }; });
      if (F.a) {
        var self = vfs.stat(path), par = vfs.stat(vfs.dirname(path));
        entries.push({ name: '.', st: self }, { name: '..', st: par || self });
      }
      entries = sortList(entries);
      ctx.out(format(entries, true));
      if (F.R) {
        entries.forEach(function (e) {
          if (e.st.type !== 'dir' || e.name === '.' || e.name === '..') return;
          listDir((arg === '/' ? '' : arg) + (arg.slice(-1) === '/' ? '' : '/') + e.name, e.st.path, true, false);
        });
      }
    }

    var files = [], dirs = [];
    ops.forEach(function (arg) {
      var st = arg === '' ? null : vfs.stat(resolvePath(s, arg));
      if (!st) { ctx.err('ls: ' + arg + ': No such file or directory\n'); status = 1; return; }
      if (st.type === 'dir' && !F.d) dirs.push({ arg: arg, name: arg, st: st });
      else files.push({ arg: arg, name: arg, st: st });
    });
    files = sortList(files);
    dirs = sortList(dirs);
    if (files.length) ctx.out(format(files, false));
    var header = ops.length > 1 || !!F.R;
    dirs.forEach(function (d, i) { listDir(d.arg, d.st.path, header, !files.length && i === 0); });
    return status;
  }

  /* ------------------------------------------------------ small commands */
  var commands = Object.create(null);

  commands.pwd = function (args, ctx) {
    var o = parseOpts('pwd', args);
    if (o.error) { ctx.err(o.error); return 1; }
    ctx.out(ctx.session.cwd + '\n');
    return 0;
  };

  commands.cd = function (args, ctx) {
    var s = ctx.session, vfs = s.vfs;
    var a = args.slice();
    while (a.length && (a[0] === '-L' || a[0] === '-P' || a[0] === '--')) a.shift();
    if (a.length > 2) { ctx.err('cd: too many arguments\n'); return 1; }
    var target, typed, printNew = false;
    if (a.length === 2) {
      if (s.cwd.indexOf(a[0]) < 0) { ctx.err('cd: string not in pwd: ' + a[0] + '\n'); return 1; }
      var at = s.cwd.indexOf(a[0]);
      target = s.cwd.slice(0, at) + a[1] + s.cwd.slice(at + a[0].length);
      typed = target; printNew = true;
    } else if (a.length === 0) { target = s.env.HOME; typed = '~'; }
    else if (a[0] === '-') {
      if (s.oldpwd === null) return 0;
      target = s.oldpwd; typed = '-'; printNew = true;
    } else { target = resolvePath(s, a[0]); typed = a[0]; }
    target = vfs.normalize(target, s.cwd);
    var st = vfs.stat(target);
    if (!st) {
      // a regular file in the middle of the path means "not a directory"
      var segs = target.split('/').filter(function (x) { return x.length; }), cur = '', mid = false;
      for (var i = 0; i < segs.length - 1; i++) { cur += '/' + segs[i]; if (vfs.isFile(cur)) { mid = true; break; } }
      ctx.err('cd: ' + (mid ? 'not a directory' : 'no such file or directory') + ': ' + typed + '\n');
      return 1;
    }
    if (st.type !== 'dir') { ctx.err('cd: not a directory: ' + typed + '\n'); return 1; }
    s.oldpwd = s.cwd;
    s.cwd = target;
    s.env.PWD = target;
    if (printNew) ctx.out(abbrevHome(s, target) + '\n');
    return 0;
  };
  commands.ls = lsCommand;

  commands.mkdir = function (args, ctx) {
    var s = ctx.session, vfs = s.vfs;
    var o = parseOpts('mkdir', args);
    if (o.error) { ctx.err(o.error); return 1; }
    if (!o.rest.length) return usageResult(ctx, 'mkdir');
    var status = 0;
    o.rest.forEach(function (arg) {
      var abs = resolvePath(s, arg);
      try {
        if (o.flags.p) {
          // -p: every missing directory is created; -v reports each one, shortest first
          var segs = abs.split('/').filter(function (x) { return x.length; }), cur = '';
          var created = [];
          for (var i = 0; i < segs.length; i++) {
            cur += '/' + segs[i];
            if (!vfs.exists(cur)) created.push(i);
          }
          if (!created.length) { if (vfs.isFile(abs)) throw new vfs.VfsError('ENOTDIR', arg); return; }
          vfs.mkdir(abs, { by: 'terminal', parents: true });
          if (o.flags.v) {
            var typed = arg.replace(/\/+$/, '').split('/').filter(function (x) { return x.length; });
            var plainTyped = typed.indexOf('.') < 0 && typed.indexOf('..') < 0;
            var offset = segs.length - typed.length;
            created.forEach(function (idx) {
              var ti = idx - offset;
              if (plainTyped && ti >= 0) ctx.out((arg.charAt(0) === '/' ? '/' : '') + typed.slice(0, ti + 1).join('/') + '\n');
              else ctx.out('/' + segs.slice(0, idx + 1).join('/') + '\n');
            });
          }
        } else {
          vfs.mkdir(abs, { by: 'terminal' });
          if (o.flags.v) ctx.out(arg + '\n');
        }
      } catch (e) {
        ctx.err(errLine('mkdir', arg, e.code || 'EINVAL', vfs));
        status = 1;
      }
    });
    return status;
  };

  commands.touch = function (args, ctx) {
    var s = ctx.session, vfs = s.vfs;
    var o = parseOpts('touch', args);
    if (o.error) { ctx.err(o.error); return 1; }
    if (!o.rest.length) return usageResult(ctx, 'touch');
    var status = 0;
    o.rest.forEach(function (arg) {
      if (arg === '') { ctx.err(errLine('touch', arg, 'ENOENT', vfs)); status = 1; return; }
      try {
        var abs = resolvePath(s, arg);
        if (o.flags.c && !vfs.exists(abs)) return;
        vfs.touch(abs, { by: 'terminal' });
      } catch (e) { ctx.err(errLine('touch', arg, e.code || 'EINVAL', vfs)); status = 1; }
    });
    return status;
  };

  /* readers shared by cat / wc / head / tail: files, or stdin (a pipe, or typed lines until Ctrl+D) */
  function* readStdinLines(ctx, onLine) {
    var all = '';
    for (;;) {
      var line = yield { prompt: '' };
      if (line === null) break;
      all += line + '\n';
      if (onLine) onLine(line);
    }
    return all;
  }
  function catText(vfs, name, abs, ctx) {
    if (name === '') { ctx.err('cat: : No such file or directory\n'); return null; }
    var st = vfs.stat(abs);
    if (!st) { ctx.err('cat: ' + name + ': No such file or directory\n'); return null; }
    if (st.type === 'dir') { ctx.err('cat: ' + name + ': Is a directory\n'); return null; }
    if (st.kind === 'binary' || st.kind === 'zip' || st.kind === 'app') return '（練習版：這是二進位檔案，內容不顯示）\n';
    return vfs.readFile(abs, { by: 'terminal' });
  }

  commands.cat = function* (args, ctx) {
    var s = ctx.session, vfs = s.vfs;
    var o = parseOpts('cat', args);
    if (o.error) { ctx.err(o.error); return 1; }
    var num = !!o.flags.n, nb = !!o.flags.b, ln = 0;
    function numbered(text) {
      if (!num && !nb) return text;
      var lines = text.split('\n'), endsNl = text.slice(-1) === '\n';
      if (endsNl) lines.pop();
      var out = lines.map(function (l) {
        if (nb && l === '') return '';
        ln++;
        return pad(String(ln), 6, true) + '\t' + l;
      }).join('\n');
      return out + (endsNl ? '\n' : '');
    }
    var files = o.rest.filter(function (f) { return f !== '-'; });
    if (!files.length) {
      if (ctx.stdin !== null) { ctx.out(numbered(ctx.stdin)); return 0; }
      yield* readStdinLines(ctx, function (line) { ctx.out(numbered(line + '\n')); });
      return 0;
    }
    var status = 0;
    files.forEach(function (f) {
      var t = catText(vfs, f, resolvePath(s, f), ctx);
      if (t === null) { status = 1; return; }
      ctx.out(numbered(t));
    });
    return status;
  };

  function echoEscapes(str) {
    var out = '';
    for (var i = 0; i < str.length; i++) {
      var c = str.charAt(i);
      if (c !== '\\' || i + 1 >= str.length) { out += c; continue; }
      var n = str.charAt(++i);
      switch (n) {
        case 'n': out += '\n'; break;
        case 't': out += '\t'; break;
        case 'r': out += '\r'; break;
        case 'a': out += '\x07'; break;
        case 'b': out += '\b'; break;
        case 'f': out += '\f'; break;
        case 'v': out += '\v'; break;
        case 'e': case 'E': out += '\x1b'; break;
        case '\\': out += '\\'; break;
        case 'c': return { text: out, stop: true };
        case '0': {
          var m = /^[0-7]{1,3}/.exec(str.slice(i + 1));
          if (m) { out += String.fromCharCode(parseInt(m[0], 8)); i += m[0].length; } else out += '\0';
          break;
        }
        case 'x': {
          var hx = /^[0-9a-fA-F]{1,2}/.exec(str.slice(i + 1));
          if (hx) { out += String.fromCharCode(parseInt(hx[0], 16)); i += hx[0].length; } else out += '\\x';
          break;
        }
        default: out += '\\' + n;
      }
    }
    return { text: out, stop: false };
  }
  commands.echo = function (args, ctx) {
    var i = 0, noNl = false, interp = true;
    while (i < args.length && /^-[neE]+$/.test(args[i])) {
      var f = args[i].slice(1);
      if (f.indexOf('n') >= 0) noNl = true;
      if (f.indexOf('E') >= 0) interp = false;
      if (f.indexOf('e') >= 0) interp = true;
      i++;
    }
    var text = args.slice(i).join(' '), stop = false;
    if (interp) { var r = echoEscapes(text); text = r.text; stop = r.stop; }
    ctx.out(text + (noNl || stop ? '' : '\n'));
    return 0;
  };

  commands.clear = function (args, ctx) { ctx.effect({ type: 'clear' }); return 0; };

  /* ------------------------------------------------------------- cp, mv, rm */
  commands.cp = function (args, ctx) {
    var s = ctx.session, vfs = s.vfs;
    var o = parseOpts('cp', args);
    if (o.error) { ctx.err(o.error); return 1; }
    if (o.rest.length < 2) return usageResult(ctx, 'cp');
    var recursive = !!(o.flags.R || o.flags.r);
    var srcs = o.rest.slice(0, -1), dstArg = o.rest[o.rest.length - 1];
    var dst = resolvePath(s, dstArg);
    var dstIsDir = vfs.isDir(dst);
    if (srcs.length > 1 && !dstIsDir) { ctx.err('cp: ' + dstArg + ' is not a directory\n'); return 1; }
    var status = 0;
    srcs.forEach(function (arg) {
      var abs = resolvePath(s, arg);
      var st = vfs.stat(abs);
      if (!st) { ctx.err('cp: ' + arg + ': No such file or directory\n'); status = 1; return; }
      var finalDst = dstIsDir ? vfs.join(dst, st.name) : dst;
      if (vfs.canon(abs) === vfs.canon(finalDst)) {
        ctx.err('cp: ' + arg + ' and ' + (dstIsDir ? dstArg.replace(/\/+$/, '') + '/' + st.name : dstArg) + ' are identical (not copied).\n');
        status = 1; return;
      }
      if (st.type === 'dir' && !recursive) { ctx.err('cp: ' + arg + ' is a directory (not copied).\n'); status = 1; return; }
      try {
        var made = vfs.copy(abs, dst, { by: 'terminal', recursive: recursive });
        if (o.flags.v) {
          var shown = dstIsDir ? dstArg.replace(/\/+$/, '') + '/' + st.name : dstArg;
          ctx.out(arg + ' -> ' + shown + '\n');
          if (st.type === 'dir') {
            vfs.walk(made, function (cs, depth) {
              if (depth === 0) return;
              var rel = cs.path.slice(made.length);
              ctx.out(arg.replace(/\/+$/, '') + rel + ' -> ' + shown + rel + '\n');
            });
          }
        }
      } catch (e) {
        var code = e.code || 'EINVAL';
        if (code === 'ENOENT') ctx.err('cp: ' + dstArg + ': No such file or directory\n');
        else if (code === 'EINVAL' && st.type === 'dir') ctx.err('cp: cannot copy a directory, ' + arg + ', into itself, ' + dstArg + '/' + st.name + '\n');
        else ctx.err('cp: ' + dstArg + ': ' + vfs.errText(code) + '\n');
        status = 1;
      }
    });
    return status;
  };

  commands.mv = function (args, ctx) {
    var s = ctx.session, vfs = s.vfs;
    var o = parseOpts('mv', args);
    if (o.error) { ctx.err(o.error); return 1; }
    if (o.rest.length < 2) return usageResult(ctx, 'mv');
    var srcs = o.rest.slice(0, -1), dstArg = o.rest[o.rest.length - 1];
    var dst = resolvePath(s, dstArg);
    var dstIsDir = vfs.isDir(dst);
    if (srcs.length > 1 && !dstIsDir) { ctx.err('mv: ' + dstArg + ' is not a directory\n'); return 1; }
    var status = 0;
    srcs.forEach(function (arg) {
      var abs = resolvePath(s, arg);
      var st = vfs.stat(abs);
      var shownTo = dstIsDir ? dstArg.replace(/\/+$/, '') + '/' + (st ? st.name : vfs.basename(abs)) : dstArg;
      if (!st) { ctx.err('mv: rename ' + arg + ' to ' + shownTo + ': No such file or directory\n'); status = 1; return; }
      var pk = protectedKind(s, abs);
      if (pk) { ctx.err('mv: refusing to move "' + arg + '" (practice Mac protects this folder)\n'); status = 1; return; }
      var finalDst = dstIsDir ? vfs.join(dst, st.name) : dst;
      if (vfs.normalize(finalDst) === st.path) { ctx.err('mv: ' + arg + ' and ' + shownTo + ' are identical\n'); status = 1; return; }
      try {
        vfs.move(abs, dst, { by: 'terminal' });
        if (o.flags.v) ctx.out(arg + ' -> ' + shownTo + '\n');
      } catch (e) {
        ctx.err('mv: rename ' + arg + ' to ' + shownTo + ': ' + vfs.errText(e.code || 'EINVAL') + '\n');
        status = 1;
      }
    });
    return status;
  };

  commands.rm = function (args, ctx) {
    var s = ctx.session, vfs = s.vfs;
    var o = parseOpts('rm', args);
    if (o.error) { ctx.err(o.error); return 1; }
    if (!o.rest.length) { if (o.flags.f) return 0; return usageResult(ctx, 'rm'); }
    var recursive = !!(o.flags.r || o.flags.R);
    var status = 0;
    o.rest.forEach(function (arg) {
      var last = arg.replace(/\/+$/, '').split('/').pop();
      if (last === '.' || last === '..') { ctx.err('rm: "." and ".." may not be removed\n'); status = 1; return; }
      var abs = resolvePath(s, arg);
      var pk = protectedKind(s, abs);
      if (pk === 'root') { ctx.err('rm: "/" may not be removed\n'); status = 1; return; }
      if (pk) { ctx.err('rm: refusing to remove "' + arg + '" (practice Mac protects this folder)\n'); status = 1; return; }
      var st = vfs.stat(abs);
      if (!st) { if (!o.flags.f) { ctx.err('rm: ' + arg + ': No such file or directory\n'); status = 1; } return; }
      if (st.type === 'dir' && !recursive) {
        if (o.flags.d) {
          try { vfs.remove(abs, { by: 'terminal' }); if (o.flags.v) ctx.out(arg + '\n'); }
          catch (e) { ctx.err('rm: ' + arg + ': ' + vfs.errText(e.code || 'ENOTEMPTY') + '\n'); status = 1; }
        } else { ctx.err('rm: ' + arg + ': is a directory\n'); status = 1; }
        return;
      }
      try {
        if (o.flags.v) {
          var list = [];
          if (st.type === 'dir') vfs.walk(abs, function (cs, depth) { list.push({ rel: cs.path.slice(st.path.length), depth: depth }); });
          list.reverse().forEach(function (e) { ctx.out(arg.replace(/\/+$/, '') + e.rel + '\n'); });
          if (st.type !== 'dir') ctx.out(arg + '\n');
        }
        vfs.remove(abs, { by: 'terminal', recursive: true });
      } catch (e2) { ctx.err('rm: ' + arg + ': ' + vfs.errText(e2.code || 'EINVAL') + '\n'); status = 1; }
    });
    return status;
  };

  commands.rmdir = function (args, ctx) {
    var s = ctx.session, vfs = s.vfs;
    var o = parseOpts('rmdir', args);
    if (o.error) { ctx.err(o.error); return 1; }
    if (!o.rest.length) return usageResult(ctx, 'rmdir');
    var status = 0;
    o.rest.forEach(function (arg) {
      var abs = resolvePath(s, arg);
      var st = vfs.stat(abs);
      if (!st) { ctx.err('rmdir: ' + arg + ': No such file or directory\n'); status = 1; return; }
      if (st.type !== 'dir') { ctx.err('rmdir: ' + arg + ': Not a directory\n'); status = 1; return; }
      if (protectedKind(s, abs)) { ctx.err('rmdir: refusing to remove "' + arg + '" (practice Mac protects this folder)\n'); status = 1; return; }
      try { vfs.remove(abs, { by: 'terminal' }); }
      catch (e) { ctx.err('rmdir: ' + arg + ': ' + vfs.errText(e.code || 'EINVAL') + '\n'); status = 1; }
    });
    return status;
  };

  /* ------------------------------------------------ wc / head / tail */
  function utf8len(s) { return LAB.vfs.utf8len(s); }
  function countText(text) {
    var words = text.split(/\s+/).filter(function (x) { return x.length; }).length;
    var lines = 0;
    for (var i = 0; i < text.length; i++) if (text.charAt(i) === '\n') lines++;
    var chars = 0;
    for (var ch of text) chars++;
    return { l: lines, w: words, c: utf8len(text), m: chars };
  }
  commands.wc = function* (args, ctx) {
    var s = ctx.session, vfs = s.vfs;
    var o = parseOpts('wc', args);
    if (o.error) { ctx.err(o.error); return 1; }
    var show = { l: !!o.flags.l, w: !!o.flags.w, c: !!o.flags.c, m: !!o.flags.m };
    if (!show.l && !show.w && !show.c && !show.m) { show.l = show.w = show.c = true; }
    function fmt(c, name) {
      var t = '';
      if (show.l) t += pad(c.l, 8, true);
      if (show.w) t += pad(c.w, 8, true);
      if (show.m) t += pad(c.m, 8, true);
      if (show.c && !show.m) t += pad(c.c, 8, true);
      return t + (name ? ' ' + name : '') + '\n';
    }
    if (!o.rest.length) {
      var text = ctx.stdin;
      if (text === null) text = yield* readStdinLines(ctx);
      ctx.out(fmt(countText(text), ''));
      return 0;
    }
    var total = { l: 0, w: 0, c: 0, m: 0 }, status = 0, okN = 0;
    o.rest.forEach(function (f) {
      var abs = resolvePath(s, f), st = vfs.stat(abs);
      if (!st) { ctx.err('wc: ' + f + ': open: No such file or directory\n'); status = 1; return; }
      if (st.type === 'dir') { ctx.err('wc: ' + f + ': read: Is a directory\n'); status = 1; return; }
      var t = st.kind === 'text' ? vfs.readFile(abs, { by: 'terminal' }) : '';
      var c = countText(t);
      if (st.kind !== 'text') { c.c = st.size; }
      total.l += c.l; total.w += c.w; total.c += c.c; total.m += c.m; okN++;
      ctx.out(fmt(c, f));
    });
    if (okN > 1) ctx.out(fmt(total, 'total'));
    return status;
  };

  function headTail(which) {
    return function* (args, ctx) {
      var s = ctx.session, vfs = s.vfs;
      var n = 10, i = 0, usageLines = USAGE[which];
      function bad(msg) { ctx.err(msg + '\n' + usageLines.join('\n') + '\n'); return 1; }
      for (; i < args.length; i++) {
        var a = args[i];
        if (a === '--') { i++; break; }
        if (a.charAt(0) !== '-' || a === '-') break;
        if (/^-\d+$/.test(a)) { n = parseInt(a.slice(1), 10); continue; }
        if (a.charAt(1) === 'n' || a.charAt(1) === 'c') {
          var v = a.length > 2 ? a.slice(2) : args[++i];
          if (v === undefined || !/^\d+$/.test(v)) return bad(which + ': illegal ' + (a.charAt(1) === 'n' ? 'line' : 'byte') + ' count -- ' + (v === undefined ? '' : v));
          n = parseInt(v, 10);
          continue;
        }
        var ch = a.charAt(1);
        if (LETTERS[which].indexOf(ch) < 0) return bad(which + ': illegal option -- ' + ch);
      }
      var files = args.slice(i);
      function pick(text) {
        var lines = text.match(/[^\n]*\n|[^\n]+$/g) || [];
        return (which === 'head' ? lines.slice(0, n) : (n === 0 ? [] : lines.slice(-n))).join('');
      }
      if (!files.length) {
        var text = ctx.stdin;
        if (text === null) text = yield* readStdinLines(ctx);
        ctx.out(pick(text));
        return 0;
      }
      var status = 0, first = true;
      files.forEach(function (f) {
        var abs = resolvePath(s, f), st = vfs.stat(abs);
        if (!st) { ctx.err(which + ': ' + f + ': No such file or directory\n'); status = 1; return; }
        if (st.type === 'dir') { ctx.err(which + ': ' + f + ': Is a directory\n'); status = 1; return; }
        var t = st.kind === 'text' ? vfs.readFile(abs, { by: 'terminal' }) : '（練習版：這是二進位檔案，內容不顯示）\n';
        if (files.length > 1) { ctx.out((first ? '' : '\n') + '==> ' + f + ' <==\n'); }
        first = false;
        ctx.out(pick(t));
      });
      return status;
    };
  }
  commands.head = headTail('head');
  commands.tail = headTail('tail');

  /* -------------------------------------------------- simple info commands */
  commands.whoami = function (a, ctx) { ctx.out('an\n'); return 0; };
  commands.hostname = function (a, ctx) { ctx.out('MacBook-Air.local\n'); return 0; };
  commands.date = function (a, ctx) { ctx.out(LAB.util.fmt.dateLine(LAB.clock.ms()) + '\n'); return 0; };
  commands.uname = function (args, ctx) {
    var flags = args.join('').replace(/-/g, '');
    if (flags.indexOf('a') >= 0) ctx.out('Darwin MacBook-Air.local 25.0.0 Darwin Kernel Version 25.0.0: Tue Sep  2 20:04:23 PDT 2025; root:xnu-12377.1.9~3/RELEASE_ARM64_T8132 arm64\n');
    else if (flags.indexOf('m') >= 0) ctx.out('arm64\n');
    else if (flags.indexOf('r') >= 0) ctx.out('25.0.0\n');
    else if (flags.indexOf('n') >= 0) ctx.out('MacBook-Air.local\n');
    else ctx.out('Darwin\n');
    return 0;
  };
  commands['true'] = function () { return 0; };
  commands['false'] = function () { return 1; };
  commands.history = function (args, ctx) {
    var hs = ctx.session.history, start = 0;
    if (args[0] === '-c') { hs.length = 0; return 0; }
    var m = args.length && /^-?(\d+)$/.exec(args[0]);
    if (m) start = Math.max(0, hs.length - parseInt(m[1], 10));
    for (var i = start; i < hs.length; i++) ctx.out(pad(String(i + 1), 5, true) + '  ' + hs[i] + '\n');
    return 0;
  };
  commands.exit = function (args, ctx) {
    ctx.out('Saving session...\n...copying shared history...\n...saving history...truncating history files...\n...completed.\n\n[Process completed]\n');
    ctx.session.alive = false;
    ctx.effect({ type: 'exit' });
    return 0;
  };
  commands.sleep = function* (args, ctx) {
    var a = args[0];
    if (args.length < 1 || !/^(\d+\.?\d*|\.\d+)$/.test(a)) { ctx.err('usage: sleep seconds\n'); return 1; }
    var ms = Math.min(parseFloat(a), 10) * 1000;
    ctx.effect({ type: 'sleep', ms: ms });
    yield { sleep: ms };
    return 0;
  };
  /* ------------------------------------------------------------ man */
  /* A short, true-to-life manual page for the commands the course teaches; the rest says what the real Mac would do. */
  var MAN = {
    ls: { name: 'ls \u2013 list directory contents', syn: ['ls [-ABCFGHILOPRSTUWabcdefghiklmnopqrstuvwxy1%,] [--color=when] [-D format] [file ...]'],
      desc: ['For each operand that names a file of a type other than directory, ls displays its name as well as any requested, associated information. For each operand that names a directory, ls displays the names of the files it contains.', 'If no operands are given, the contents of the current directory are displayed.'] },
    cd: { name: 'cd \u2013 change the working directory (shell builtin)', syn: ['cd [dir]'], sec: 'BUILTIN', desc: ['Change the current directory to dir. With no argument, cd goes to your home directory (~). cd .. goes up one level, and cd - goes back to the previous directory.'] },
    pwd: { name: 'pwd \u2013 return working directory name', syn: ['pwd [-L | -P]'], desc: ['The pwd utility writes the absolute pathname of the current working directory to the standard output.'] },
    mv: { name: 'mv \u2013 move files', syn: ['mv [-f | -i | -n] [-hv] source target', 'mv [-f | -i | -n] [-v] source ... directory'], desc: ['In its first form, the mv utility renames the file named by the source operand to the destination path named by the target operand. In its second form, mv moves each file named by a source operand to a destination file in the existing directory named by the directory operand.'] },
    cp: { name: 'cp \u2013 copy files', syn: ['cp [-R [-H | -L | -P]] [-fi | -n] [-aclpSsvXx] source_file target_file', 'cp [-R [-H | -L | -P]] [-fi | -n] [-aclpSsvXx] source_file ... target_directory'], desc: ['In the first synopsis form, the cp utility copies the contents of the source_file to the target_file. In the second synopsis form, the contents of each named source_file is copied to the destination target_directory.'] },
    rm: { name: 'rm \u2013 remove directory entries', syn: ['rm [-dfiPRrvWx] file ...'], desc: ['The rm utility attempts to remove the non-directory type files specified on the command line. There is no trash can: a file removed with rm is gone.'] },
    mkdir: { name: 'mkdir \u2013 make directories', syn: ['mkdir [-pv] [-m mode] directory_name ...'], desc: ['The mkdir command creates the directories named as operands, in the order specified.'] },
    cat: { name: 'cat \u2013 concatenate and print files', syn: ['cat [-belnstuv] [file ...]'], desc: ['The cat utility reads files sequentially, writing them to the standard output.'] },
    unzip: { name: 'unzip \u2013 list, test and extract compressed files in a ZIP archive', syn: ['unzip [-Z] [-opts[modifiers]] file[.zip] [list] [-x xlist] [-d exdir]'], desc: ['unzip will list, test, or extract files from a ZIP archive. The default behavior is to extract into the current directory.'] },
    open: { name: 'open \u2013 open files and directories', syn: ['open [-e] [-t] [-f] [-W] [-R] [-n] [-g] [-h] [-s <partial SDK name>][-b <bundle identifier>] [-a <application>] [filenames] [--args arguments]'], desc: ['The open command opens a file (or a directory or URL), just as if you had double-clicked the file\'s icon.'] },
    touch: { name: 'touch \u2013 change file access and modification times', syn: ['touch [-A [-][[hh]mm]SS] [-achm] [-r file] [-t [[CC]YY]MMDDhhmm[.SS]] file ...'], desc: ['The touch utility sets the modification and access times of files. If any file does not exist, it is created with default permissions.'] },
    man: { name: 'man \u2013 format and display the on-line manual pages', syn: ['man [-adho] [-t | -w] [-M manpath] [-P pager] [-S mansect] [-m arch[:machine]] [-p [eprtv]] [mansect] page ...'], desc: ['The man utility finds and displays online manual documentation pages.'] }
  };
  var MAN_OTHER = ['grep', 'find', 'echo', 'head', 'tail', 'wc', 'chmod', 'curl', 'tar', 'zip', 'sort', 'sed', 'awk', 'less', 'ssh', 'diff', 'date', 'clear', 'kill', 'history', 'exit', 'which', 'whoami', 'uname', 'ps', 'df', 'du'];
  function manCenter(left, mid, right) {
    var w = 80, gap1 = Math.max(1, Math.floor((w - left.length - mid.length - right.length) / 2));
    var gap2 = Math.max(1, w - left.length - mid.length - right.length - gap1);
    return left + new Array(gap1 + 1).join(' ') + mid + new Array(gap2 + 1).join(' ') + right;
  }
  function manWrap(text, indent, width) {
    var words = String(text).split(' '), lines = [], cur = '';
    words.forEach(function (w) {
      if ((cur + ' ' + w).length > width - indent && cur) { lines.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w;
    });
    if (cur) lines.push(cur);
    var pad5 = new Array(indent + 1).join(' ');
    return lines.map(function (l) { return pad5 + l; }).join('\n');
  }
  commands.man = function (args, ctx) {
    var names = args.filter(function (a) { return a.charAt(0) !== '-' && !/^\d+$/.test(a); });
    if (!names.length) { ctx.err('What manual page do you want?\nFor example, try \'man man\'.\n'); return 1; }
    var status = 0;
    names.forEach(function (n) {
      var pg = MAN[n];
      var known = pg || MAN_OTHER.indexOf(n) >= 0 || (typeof commands[n] === 'function' && n !== 'man');
      if (!known) { ctx.err('No manual entry for ' + n + '\n'); status = 1; return; }
      var up = n.toUpperCase();
      var sec = pg && pg.sec ? pg.sec : '1';
      var sect = pg && pg.sec === 'BUILTIN' ? 'BUILTIN(1)' : up + '(1)';
      var head = manCenter(sect, sec === 'BUILTIN' ? 'General Commands Manual' : 'General Commands Manual', sect);
      var out = [head, '', 'NAME'];
      if (pg) {
        out.push('     ' + pg.name, '', 'SYNOPSIS');
        pg.syn.forEach(function (l) { out.push('     ' + l); });
        out.push('', 'DESCRIPTION');
        pg.desc.forEach(function (d, i) { if (i) out.push(''); out.push(manWrap(d, 5, 80)); });
      } else {
        out.push('     ' + n + ' \u2013 (\u9019\u500b\u6307\u4ee4\u5728\u771f\u7684 Mac \u4e0a\u6709\u5b8c\u6574\u7684\u8aaa\u660e\u9801)');
      }
      out.push('', '\uff08\u7df4\u7fd2\u7248\u53ea\u653e\u958b\u982d\u3002\u771f\u7684 Mac \u6703\u7528 q \u96e2\u958b\u8aaa\u660e\u9801\uff0c\u9019\u88e1\u4e0d\u9700\u8981\u3002\uff09', '');
      ctx.out(out.join('\n') + '\n');
    });
    return status;
  };
  commands.vi = function () { return 0; };
  commands.nano = function () { return 0; };
  commands.vim = function () { return 0; };

  /* ------------------------------------------------------------ which */
  var BUILTINS = ['cd', 'pwd', 'echo', 'history', 'exit', 'which', 'true', 'false', 'export', 'alias', 'unalias', 'kill', 'source', 'set', 'type', 'test', 'printf', 'jobs', 'fg', 'bg', 'wait', 'read', 'local', 'unset', 'eval', 'exec', 'trap', 'umask', 'ulimit', 'time'];
  var IN_BIN = ['ls', 'cat', 'cp', 'mv', 'rm', 'mkdir', 'rmdir', 'sleep', 'date', 'hostname', 'chmod', 'ln', 'df', 'ps'];
  var IN_USRBIN = ['touch', 'open', 'unzip', 'wc', 'head', 'tail', 'clear', 'whoami', 'uname', 'man', 'vi', 'nano', 'vim', 'grep', 'egrep', 'find', 'diff', 'sort', 'uniq', 'cut', 'file', 'du', 'env', 'killall', 'curl', 'ssh', 'scp', 'tar', 'zip', 'gzip', 'less', 'more', 'top', 'sed', 'awk', 'tee', 'xargs', 'say', 'cal', 'tr', 'rev', 'basename', 'dirname', 'stat', 'mktemp', 'nl', 'od', 'xxd', 'cmp', 'readlink'];
  var IN_OTHER = { chown: '/usr/sbin/chown', ping: '/sbin/ping', realpath: '/bin/realpath' };
  commands.which = function (args, ctx) {
    var status = 0;
    args.forEach(function (n) {
      if (n.charAt(0) === '-') return;
      if (BUILTINS.indexOf(n) >= 0) ctx.out(n + ': shell built-in command\n');
      else if (IN_BIN.indexOf(n) >= 0) ctx.out('/bin/' + n + '\n');
      else if (IN_USRBIN.indexOf(n) >= 0) ctx.out('/usr/bin/' + n + '\n');
      else if (hasOwn.call(IN_OTHER, n)) ctx.out(IN_OTHER[n] + '\n');
      else { ctx.out(n + ' not found\n'); status = 1; }
    });
    return status;
  };

  /* ------------------------------------------------------------- open */
  var KNOWN_MAC_APPS = ['safari', 'preview', 'notes', 'mail', 'calendar', 'messages', 'photos', 'music', 'maps', 'system settings', 'system preferences', 'google chrome', 'chrome', 'firefox', 'microsoft word', 'word', 'excel', 'powerpoint', 'numbers', 'pages', 'keynote', 'facetime', 'reminders', 'contacts', 'calculator', 'textedit'];
  function findApp(name) {
    var want = String(name).toLowerCase().replace(/\.app$/, '').trim();
    var found = null;
    if (!LAB.apps) return null;
    LAB.apps.all().forEach(function (def) {
      if (found || def.id === 'about') return;
      var names = [def.id, def.title, def.en].concat(def.aliases || []);
      for (var i = 0; i < names.length; i++) {
        if (names[i] && String(names[i]).toLowerCase() === want) { found = def.id; return; }
      }
    });
    return found;
  }
  var OPEN_USAGE = 'Usage: open [-e] [-t] [-f] [-W] [-R] [-n] [-g] [-h] [-s <partial SDK name>][-b <bundle identifier>] [-a <application>] [-u URL] [--args arguments] [filenames] [--args arguments]\n';
  commands.open = function (args, ctx) {
    var s = ctx.session, vfs = s.vfs;
    var appName = null, reveal = false, targets = [];
    if (!args.length) { ctx.err(OPEN_USAGE); return 1; }
    for (var i = 0; i < args.length; i++) {
      var a = args[i];
      if (a === '--args') break;
      if (a === '-a') { appName = args[++i]; if (appName === undefined) { ctx.err(OPEN_USAGE); return 1; } continue; }
      if (a === '-R') { reveal = true; continue; }
      if (a === '-b' || a === '-u' || a === '-s') { i++; continue; }
      if (a.charAt(0) === '-' && a.length > 1 && /^-[etfWngh]+$/.test(a)) continue;
      targets.push(a);
    }
    var appId = null;
    if (appName !== null) {
      appId = findApp(appName);
      if (!appId) {
        if (KNOWN_MAC_APPS.indexOf(String(appName).toLowerCase().replace(/\.app$/, '')) >= 0) ctx.err('（練習版沒有安裝「' + appName + '」）\n');
        else ctx.err("Unable to find application named '" + appName + "'\n");
        return 1;
      }
    }
    if (!targets.length) {
      if (appId) { ctx.effect({ type: 'launch', appId: appId }); return 0; }
      ctx.err(OPEN_USAGE); return 1;
    }
    var status = 0;
    targets.forEach(function (t) {
      if (/^[a-z][a-z0-9+.-]*:\/\//i.test(t)) { ctx.err('（練習版沒有瀏覽器，不能打開網址）\n'); status = 1; return; }
      var abs = resolvePath(s, t);
      if (!vfs.exists(abs)) { ctx.err('The file ' + abs + ' does not exist.\n'); status = 1; return; }
      var canon = vfs.canon(abs);
      if (reveal) ctx.effect({ type: 'reveal', path: canon });
      else ctx.effect({ type: 'open', path: canon, appId: appId || undefined });
    });
    return status;
  };

  /* ------------------------------------------------------------ unzip */
  function zipDate(ms) {
    var d = new Date(ms);
    return p2(d.getMonth() + 1) + '-' + p2(d.getDate()) + '-' + d.getFullYear() + ' ' + p2(d.getHours()) + ':' + p2(d.getMinutes());
  }
  commands.unzip = function* (args, ctx) {
    var s = ctx.session, vfs = s.vfs;
    var flags = {}, dirArg = null, names = [];
    for (var i = 0; i < args.length; i++) {
      var a = args[i];
      if (a === '-x') { break; }
      if (a.charAt(0) === '-' && a.length > 1) {
        for (var k = 1; k < a.length; k++) {
          var ch = a.charAt(k);
          if (ch === 'd') { var rest = a.slice(k + 1); dirArg = rest !== '' ? rest : args[++i]; break; }
          flags[ch] = true;
        }
        continue;
      }
      names.push(a);
    }
    if (!names.length) {
      ctx.err('Usage: unzip [-Z] [-opts[modifiers]] file[.zip] [list] [-x xlist] [-d exdir]\n（練習版只顯示簡短說明）\n');
      return 1;
    }
    var zname = names[0], found = null;
    [zname, zname + '.zip', zname + '.ZIP'].forEach(function (c) { if (!found && vfs.isFile(resolvePath(s, c))) found = c; });
    if (!found) { ctx.err('unzip:  cannot find or open ' + zname + ', ' + zname + '.zip or ' + zname + '.ZIP.\n'); return 9; }
    var zpath = resolvePath(s, found);
    var entries = vfs.zipEntries(zpath);
    if (!entries) { ctx.err('unzip:  cannot find zipfile directory in one of ' + zname + ' or ' + zname + '.zip, and cannot find ' + zname + '.ZIP, period.\n'); return 9; }

    if (flags.l) {
      var out = 'Archive:  ' + found + '\n  Length      Date    Time    Name\n---------  ---------- -----   ----\n';
      var total = 0;
      entries.forEach(function (en) {
        var len = en.type === 'dir' ? 0 : utf8len(en.content || '');
        total += len;
        out += pad(String(len), 9, true) + '  ' + zipDate(en.mtime) + '   ' + en.name + '\n';
      });
      out += '---------                     -------\n' + pad(String(total), 9, true) + '                     ' + entries.length + ' file' + (entries.length === 1 ? '' : 's') + '\n';
      ctx.out(out);
      return 0;
    }

    var quiet = !!flags.q;
    var dest = dirArg !== null ? resolvePath(s, dirArg) : s.cwd;
    var shownDir = dirArg !== null ? dirArg.replace(/\/+$/, '') + '/' : '';
    if (!quiet) ctx.out('Archive:  ' + found + '\n');
    if (dirArg !== null && !vfs.exists(dest) && !quiet) ctx.out('   creating: ' + shownDir + '\n');
    if (dirArg !== null && vfs.isFile(dest)) { ctx.err('unzip:  cannot create extraction directory: ' + dirArg + '\n'); return 1; }

    function line(en, existedDir) {
      if (quiet) return;
      if (en.type === 'dir') { if (!existedDir) ctx.out('   creating: ' + shownDir + en.name + '\n'); }
      else ctx.out('  inflating: ' + shownDir + en.name + '\n');
    }
    function targetOf(en) { return vfs.join(dest, en.name.replace(/\/+$/, '')); }
    var conflicts = entries.filter(function (en) { return en.type === 'file' && vfs.exists(targetOf(en)); });
    var status = 0;

    if (!conflicts.length || flags.o) {
      var existedDirs = {};
      entries.forEach(function (en) { if (en.type === 'dir') existedDirs[en.name] = vfs.isDir(targetOf(en)); });
      try { vfs.extractZip(zpath, dest, { by: 'terminal' }); }
      catch (e) { ctx.err('unzip:  ' + vfs.errText(e.code || 'EINVAL') + '\n'); return 1; }
      entries.forEach(function (en) { line(en, existedDirs[en.name]); });
      return 0;
    }
    if (flags.n) {
      var skipSet = {};
      conflicts.forEach(function (en) { skipSet[en.name] = true; });
      var existedD = {};
      entries.forEach(function (en) { if (en.type === 'dir') existedD[en.name] = vfs.isDir(targetOf(en)); });
      vfs.extractZip(zpath, dest, { by: 'terminal', filter: function (nm) { return !skipSet[nm]; } });
      entries.forEach(function (en) { if (!skipSet[en.name]) line(en, existedD[en.name]); });
      return 0;
    }
    // some files already exist: ask, file by file (the renderer shows each question as a prompt)
    var mode = null;
    for (var ei = 0; ei < entries.length; ei++) {
      var en = entries[ei];
      var existedDir = en.type === 'dir' && vfs.isDir(targetOf(en));
      var doIt = true, renameTo = null;
      if (en.type === 'file' && vfs.exists(targetOf(en))) {
        if (mode === 'none') doIt = false;
        else if (mode !== 'all') {
          for (;;) {
            var ans = yield { prompt: 'replace ' + shownDir + en.name + '? [y]es, [n]o, [A]ll, [N]one, [r]ename: ' };
            if (ans === null) { ctx.out('(EOF or read error, treating as "[N]one" ...)\n'); mode = 'none'; doIt = false; break; }
            var c0 = String(ans).replace(/^\s+/, '').charAt(0);
            if (c0 === 'A') { mode = 'all'; break; }
            if (c0 === 'N') { mode = 'none'; doIt = false; break; }
            if (c0 === 'y' || c0 === 'Y') break;
            if (c0 === 'n') { doIt = false; break; }
            if (c0 === 'r' || c0 === 'R') {
              var nn = yield { prompt: 'new name: ' };
              if (nn === null || String(nn).trim() === '') { doIt = false; break; }
              renameTo = String(nn).trim();
              break;
            }
            ctx.err('error:  invalid response [' + String(ans).replace(/^\s+/, '').split(/\s/)[0] + ']\n');
          }
        }
      }
      if (!doIt) continue;
      if (renameTo !== null) {
        try {
          var target = resolvePath(s, renameTo);
          vfs.writeFile(target, en.content || '', { by: 'terminal' });
          if (!quiet) ctx.out('  inflating: ' + renameTo + '\n');
        } catch (e2) { ctx.err('unzip:  cannot create ' + renameTo + '\n'); status = 1; }
        continue;
      }
      var wanted = en.name;
      try { vfs.extractZip(zpath, dest, { by: 'terminal', filter: function (nm) { return nm === wanted; } }); }
      catch (e3) { ctx.err('unzip:  ' + vfs.errText(e3.code || 'EINVAL') + '\n'); status = 1; continue; }
      line(en, existedDir);
    }
    return status;
  };

  /* ---------------------------------------------- commands that only talk */
  var TIER2 = ['grep', 'egrep', 'find', 'chmod', 'chown', 'ln', 'diff', 'sort', 'uniq', 'cut', 'file', 'du', 'df', 'env', 'export', 'alias', 'unalias', 'ps', 'kill', 'killall', 'curl', 'ssh', 'scp', 'tar', 'zip', 'gzip', 'less', 'more', 'top', 'sed', 'awk', 'tee', 'xargs', 'say', 'ping', 'source', 'set', 'type', 'test', 'printf', 'cal', 'tr', 'rev', 'basename', 'dirname', 'readlink', 'realpath', 'stat', 'mktemp', 'nl', 'od', 'xxd', 'cmp', 'jobs', 'fg', 'bg', 'wait', 'read', 'local', 'unset', 'eval', 'exec', 'trap', 'umask', 'ulimit', 'time'];
  var TIER3 = ['python3', 'python', 'node', 'npm', 'brew', 'codex', 'code', 'pip', 'tree', 'wget'];

  /* resolveCommand(name, session) -> {fn} | {msg, status} */
  function resolveCommand(name, session) {
    if (hasOwn.call(commands, name)) return { fn: commands[name] };
    if (name.indexOf('/') >= 0) {
      var m = /^\/(?:usr\/)?(?:s?bin)\/([^\/]+)$/.exec(name);
      if (m && hasOwn.call(commands, m[1])) return { fn: commands[m[1]] };
      var abs = resolvePath(session, name);
      if (session.vfs.exists(abs)) return { msg: 'zsh: permission denied: ' + name, status: 126 };
      return { msg: 'zsh: no such file or directory: ' + name, status: 127 };
    }
    if (name === 'sudo') return { msg: 'sudo: this practice Mac does not allow sudo', status: 1 };
    if (name === 'git') return { msg: 'xcode-select: note: No developer tools were found, requesting install.', status: 1 };
    if (TIER2.indexOf(name) >= 0) return { msg: name + ': 這個指令真的 Mac 上有，但練習版還沒做', status: 1 };
    return { msg: 'zsh: command not found: ' + name, status: 127 };
  }

  /* ------------------------------------------------------------- executor */
  function newJob(src, session) {
    return {
      src: src, cwd0: session.cwd, cmds: [], current: null, totalOut: '', stepOut: '', stream: [], effects: [],
      print: function (s) {
        if (!s) return;
        this.totalOut += s; this.stepOut += s;
        var l = this.stream;
        if (typeof l[l.length - 1] === 'string') l[l.length - 1] += s; else l.push(s);
      },
      pushEffect: function (e) { this.effects.push(e); this.stream.push(e); }
    };
  }

  function* execSimple(cmd, session, job, opt) {
    var vfs = session.vfs;
    var args = [], wi;
    for (wi = 0; wi < cmd.words.length; wi++) {
      var ex = expandWord(cmd.words[wi], session);
      if (ex.error) {
        var failEntry = { name: cmd.words[0].raw, args: [], cwd: session.cwd, cwdAfter: session.cwd, status: 1, out: ex.error + '\n' };
        job.cmds.push(failEntry);
        job.print(ex.error + '\n');
        return 1;
      }
      args = args.concat(ex.words);
    }
    // redirect targets
    var redirs = [];
    for (var ri = 0; ri < cmd.redirs.length; ri++) {
      var rx = expandWord(cmd.redirs[ri].target, session);
      if (rx.error) { job.print(rx.error + '\n'); return 1; }
      if (rx.words.length !== 1) { job.print('zsh: ambiguous redirect\n'); return 1; }
      redirs.push({ op: cmd.redirs[ri].op, path: rx.words[0] });
    }
    // plain NAME=value assignments
    if (cmd.words.length && cmd.words.every(function (w) { return /^[A-Za-z_][A-Za-z0-9_]*=/.test(w.raw); })) {
      args.forEach(function (a) { var eq = a.indexOf('='); session.env[a.slice(0, eq)] = a.slice(eq + 1); });
      return 0;
    }
    var redirOut = redirs.length ? redirs[redirs.length - 1] : null;

    function writeRedirects(text) {
      redirs.forEach(function (r, idx) {
        if (r.path === '') { job.print('zsh: no such file or directory: \n'); return; }
        var abs = resolvePath(session, r.path);
        try {
          var isLast = idx === redirs.length - 1;
          if (vfs.isDir(abs)) throw new vfs.VfsError('EISDIR', r.path);
          vfs.writeFile(abs, isLast ? text : '', { by: 'terminal', append: r.op === '>>' });
        } catch (e) {
          var code = e.code || 'EINVAL';
          var msg = code === 'ENOENT' ? 'no such file or directory' : code === 'EISDIR' ? 'is a directory' : code === 'ENOTDIR' ? 'not a directory' : vfs.errText(code).toLowerCase();
          job.print('zsh: ' + msg + ': ' + r.path + '\n');
        }
      });
    }

    if (!args.length) { if (redirs.length) writeRedirects(''); return 0; }

    var name = args[0], cargs = args.slice(1);
    var entry = { name: name, args: cargs, cwd: session.cwd, cwdAfter: session.cwd, status: 0, out: '' };
    job.cmds.push(entry);
    job.current = entry;
    var toTty = !!opt.tty && !redirOut;
    var buf = '';
    var ctx = {
      session: session, vfs: vfs, name: name, args: cargs, stdin: opt.stdin, tty: toTty,
      out: function (s) { if (!s) return; entry.out += s; if (toTty) job.print(s); else buf += s; },
      err: function (s) { if (!s) return; entry.out += s; job.print(s); },
      effect: function (e) { job.pushEffect(e); },
      abs: function (p) { return resolvePath(session, p); }
    };
    var status = 0;
    try {
      var rc = resolveCommand(name, session);
      if (rc.fn) {
        var r = rc.fn(cargs, ctx);
        if (r && typeof r.next === 'function') r = yield* r;
        if (typeof r === 'number') status = r;
        else if (r && typeof r === 'object') {
          if (r.out) ctx.out(r.out);
          if (r.err) ctx.err(r.err);
          if (r.effects) r.effects.forEach(function (e) { job.pushEffect(e); });
          status = r.status || 0;
        }
      } else {
        ctx.err(rc.msg + '\n');
        status = rc.status;
      }
    } finally {
      entry.cwdAfter = session.cwd;
      if (redirs.length) writeRedirects(buf);
    }
    entry.status = status;
    session.status = status;
    return { status: status, stdout: buf };
  }

  function* execPipeline(pipe, session, job) {
    var input = null, status = 0;
    for (var i = 0; i < pipe.length; i++) {
      var isLast = i === pipe.length - 1;
      var r = yield* execSimple(pipe[i], session, job, { stdin: input, tty: isLast });
      if (typeof r === 'number') { status = r; input = ''; }
      else { status = r.status; input = r.stdout; }
      session.status = status;
    }
    return status;
  }

  function* execAst(ast, session, job) {
    var last = session.status;
    for (var i = 0; i < ast.items.length; i++) {
      var it = ast.items[i];
      if (it.conn === '&&' && last !== 0) continue;
      if (it.conn === '||' && last === 0) continue;
      last = yield* execPipeline(it.pipe, session, job);
      session.status = last;
    }
    return last;
  }

  /* ------------------------------------------------------ session and run */
  var sessionCounter = 0;
  function newSession(o) {
    o = o || {};
    var cwd = o.cwd || HOME;
    return {
      id: 's' + (++sessionCounter), cwd: cwd, oldpwd: null,
      env: { HOME: HOME, USER: 'an', SHELL: '/bin/zsh', PATH: '/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin', PWD: cwd, HOSTNAME: 'MacBook-Air.local', HOST: 'MacBook-Air.local', LOGNAME: 'an' },
      status: 0, history: [], cols: o.cols || 80, tty: o.tty === undefined ? 0 : o.tty, vfs: o.vfs || LAB.vfs,
      prompt: null, pending: null, ps2: null, alive: true, gen: null, job: null, sleeping: null
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
      job.print('zsh: 練習版的終端機出錯了：' + (e && e.message ? e.message : e) + '\n');
      session.status = 1;
      r = { done: true };
    }
    if (!r.done) {
      var v = r.value || {};
      if (v.prompt !== undefined) {
        session.prompt = {
          text: v.prompt,
          onLine: function (line) { return advance(session, String(line)); },
          onEof: function () { return advance(session, null); }
        };
        job.pushEffect({ type: 'prompt', text: v.prompt });
      } else if (v.sleep !== undefined) {
        session.sleeping = { ms: v.sleep };
      }
      return stepResult(session, job, false);
    }
    session.gen = null; session.job = null; session.sleeping = null; session.prompt = null;
    return stepResult(session, job, true);
  }

  function run(line, session) {
    if (!session.alive) return emptyResult(session);
    if (session.prompt) return session.prompt.onLine(line);
    if (session.sleeping) return emptyResult(session);
    var src = String(line);
    if (session.pending !== null) src = session.pending + '\n' + src;
    var lx = lex(src);
    if (lx.incomplete) {
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
    session.history.push(src);
    var job = newJob(src, session);
    var msg = null;
    if (lx.unsupported) msg = '（練習版還沒有做這種寫法：' + lx.unsupported + '）';
    else if (lx.parseError) msg = "zsh: parse error near `" + lx.parseError + "'";
    var ast = null;
    if (!msg) {
      ast = parse(lx.tokens);
      if (ast.error !== undefined) msg = "zsh: parse error near `" + ast.error + "'";
    }
    if (msg) {
      job.print(msg + '\n');
      session.status = 1;
      return stepResult(session, job, true);
    }
    if (!ast.items.length) return emptyResult(session);
    session.job = job;
    session.gen = execAst(ast, session, job);
    return advance(session, undefined);
  }

  /* the renderer's sleep timer ended */
  function resume(session) {
    if (!session.gen) return null;
    session.sleeping = null;
    return advance(session, undefined);
  }
  /* Ctrl+C while something is running (sleep, a question, stdin mode) or an unfinished line */
  function cancel(session) {
    if (session.gen) {
      var job = session.job;
      if (job.current) job.current.status = 130;
      session.status = 130;
      job.stepOut = ''; job.effects = []; job.stream = [];
      try { session.gen.return(); } catch (e) { /* ignore */ }
      session.gen = null; session.job = null; session.sleeping = null; session.prompt = null;
      return stepResult(session, job, true);
    }
    if (session.pending !== null) { session.pending = null; session.ps2 = null; }
    return null;
  }

  /* ----------------------------------------------------------- completion */
  /* what the word under the cursor is (text before the cursor only) */
  function scanForComplete(text) {
    var cur = null, quote = null, afterOp = true, cmdName = null;
    function begin(i) { cur = { start: i, plain: '', quote: null, cmd: afterOp, cmdName: afterOp ? null : cmdName }; }
    function end() {
      if (!cur) return;
      if (cur.cmd) cmdName = cur.plain;
      afterOp = false;
      cur = null;
    }
    for (var i = 0; i < text.length; i++) {
      var c = text.charAt(i);
      if (quote) {
        if (c === quote) { quote = null; continue; }
        if (quote === '"' && c === '\\' && i + 1 < text.length) { cur.plain += text.charAt(i + 1); i++; continue; }
        cur.plain += c;
        continue;
      }
      if (c === '\\') {
        if (!cur) begin(i);
        if (i + 1 < text.length) { cur.plain += text.charAt(i + 1); i++; }
        continue;
      }
      if (c === "'" || c === '"') { if (!cur) begin(i); quote = c; cur.quote = c; continue; }
      if (c === ' ' || c === '\t') { end(); continue; }
      if (c === ';' || c === '|' || c === '&' || c === '\n') { end(); afterOp = true; cmdName = null; continue; }
      if (c === '>' || c === '<') { end(); afterOp = false; cmdName = 'redirect'; continue; }
      if (!cur) begin(i);
      cur.plain += c;
    }
    if (!cur) { cur = { start: text.length, plain: '', quote: null, cmd: afterOp, cmdName: afterOp ? null : cmdName }; }
    return cur;
  }

  function commonPrefix(list) {
    if (!list.length) return '';
    var p = list[0];
    for (var i = 1; i < list.length; i++) {
      var s = list[i], j = 0;
      while (j < p.length && j < s.length && p.charAt(j) === s.charAt(j)) j++;
      p = p.slice(0, j);
    }
    return p;
  }

  /* complete(buffer, cursor, session) -> {start, end, replacement, candidates:[display…], items:[{display, replacement}], single} */
  function complete(buffer, cursor, session) {
    var none = { start: cursor, end: cursor, replacement: '', candidates: [], items: [], single: false };
    var sc = scanForComplete(buffer.slice(0, cursor));
    var vfs = session.vfs;
    var found = [];          // {name, dir}
    var typedDir = '', suffixSpace = ' ';
    if (sc.cmd && sc.plain.indexOf('/') < 0) {
      if (sc.plain === '') return none;
      Object.keys(commands).sort().forEach(function (n) { if (n.indexOf(sc.plain) === 0) found.push({ name: n, dir: false }); });
    } else {
      var plain = sc.plain, slash = plain.lastIndexOf('/');
      typedDir = slash >= 0 ? plain.slice(0, slash + 1) : '';
      var base = plain.slice(slash + 1);
      var lookup;
      if (typedDir === '') lookup = session.cwd;
      else if (typedDir.charAt(0) === '~' && !sc.quote) lookup = vfs.normalize(session.env.HOME + typedDir.slice(1), session.cwd);
      else lookup = vfs.normalize(typedDir, session.cwd);
      var list = [];
      try { list = vfs.list(lookup); } catch (e) { list = []; }
      var dirsOnly = sc.cmdName === 'cd';
      list.forEach(function (st) {
        if (st.name.indexOf(base) !== 0) return;
        if (st.dot && base.charAt(0) !== '.') return;
        if (dirsOnly && st.type !== 'dir') return;
        found.push({ name: st.name, dir: st.type === 'dir' });
      });
    }
    if (!found.length) return none;
    function render(name) { return sc.quote ? typedDir + name : shellEscape(typedDir) + shellEscape(name); }
    function closeQ() { return sc.quote || ''; }
    var items = found.map(function (f) {
      var suffix = f.dir ? '/' : (sc.cmd && sc.plain.indexOf('/') < 0 ? ' ' : ' ');
      var rep = sc.quote ? sc.quote + render(f.name) + (f.dir ? '/' : closeQ() + suffix) : render(f.name) + suffix;
      if (sc.quote && f.dir) rep = sc.quote + render(f.name) + '/';
      return { display: f.name + (f.dir ? '/' : ''), replacement: rep };
    });
    var res = { start: sc.start, end: cursor, candidates: items.map(function (x) { return x.display; }), items: items, single: found.length === 1 };
    if (res.single) { res.replacement = items[0].replacement; return res; }
    var lcp = commonPrefix(found.map(function (f) { return f.name; }));
    res.replacement = (sc.quote ? sc.quote + typedDir + lcp : shellEscape(typedDir) + shellEscape(lcp));
    return res;
  }

  LAB.shell = {
    newSession: newSession, run: run, resume: resume, cancel: cancel, complete: complete,
    commands: commands, escape: shellEscape, columns: columns, lex: lex, parse: parse, findApp: findApp
  };

  /* =====================================================================
     PART B — persisted state and the Terminal window
     ===================================================================== */

  var termState = { history: [], lastLogin: null, ttyCount: 0 };
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
      if (j.lastLogin && typeof j.lastLogin === 'object' && isFinite(j.lastLogin.ms) && isFinite(j.lastLogin.tty) && j.lastLogin.tty >= 0) {
        termState.lastLogin = { ms: Number(j.lastLogin.ms), tty: Math.floor(Number(j.lastLogin.tty)) };
      }
      if (isFinite(j.ttyCount) && j.ttyCount >= 0 && j.ttyCount < 100000) termState.ttyCount = Math.floor(Number(j.ttyCount));
    },
    reset: function () { termState.history.length = 0; termState.lastLogin = null; termState.ttyCount = 0; }
  });

  var PAD = 6;
  var FS_DEFAULT = 12, FS_MIN = 11, FS_MAX = 20;
  var instances = new Map();       // winId -> terminal instance

  function stageScale() { return (LAB.stage && LAB.stage.scale) || 1; }

  /* a logical line of text -> rows of {text} wrapped at `cols` columns (CJK counts 2, marks 0) */
  function wrapText(text, cols, markLast) {
    var rows = [], row = '', col = 0, lastCp = 0;
    for (var ch of text) {
      var w = charWidth(ch.codePointAt(0));
      if (w === 0) { row += ch; continue; }
      if (col + w > cols && col > 0) { rows.push(row); row = ''; col = 0; }
      row += ch; col += w;
    }
    rows.push(row);
    return rows;
  }

  function expandTabs(existing, add) {
    var out = '', col = displayWidth(existing);
    for (var ch of add) {
      var cp = ch.codePointAt(0);
      if (ch === '\t') { var n = 8 - (col % 8); out += new Array(n + 1).join(' '); col += n; }
      else if (cp < 0x20 || cp === 0x7f) continue;
      else { out += ch; col += charWidth(cp); }
    }
    return out;
  }

  /* build the DOM of one row string: narrow runs are plain text, wide characters get a 2ch cell */
  function fillRow(el, str, markLastEol) {
    var frag = document.createDocumentFragment();
    var run = '';
    function flush() { if (run) { frag.appendChild(document.createTextNode(run)); run = ''; } }
    var chars = Array.from(str);
    for (var i = 0; i < chars.length; i++) {
      var ch = chars[i], cp = ch.codePointAt(0), w = charWidth(cp);
      var isMark = markLastEol && i === chars.length - 1;
      if (isMark) { flush(); frag.appendChild(h('span', { class: 'tm-eol' }, ch)); continue; }
      if (w === 2) {
        flush();
        var span = h('span', { class: 'tm-w' }, ch);
        // attach following zero-width marks to this cell
        while (i + 1 < chars.length && charWidth(chars[i + 1].codePointAt(0)) === 0) { span.appendChild(document.createTextNode(chars[i + 1])); i++; }
        frag.appendChild(span);
      } else run += ch;
    }
    flush();
    el.appendChild(frag);
  }

  function pad3(n) { return n < 10 ? '00' + n : n < 100 ? '0' + n : String(n); }

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
    var session = LAB.shell.newSession({ cwd: startCwd, tty: tty, cols: 80 });
    session.history = termState.history;

    // ---- state
    var fs = FS_DEFAULT, cw = FS_DEFAULT * 0.6, lh = Math.round(FS_DEFAULT * 1.25 * 4) / 4;
    var cols = 80, rows = 24;
    var hist = [];                    // {text, mark, el}
    var partial = '';                 // unfinished output line
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

    // ---- measuring and fitting
    function measure() {
      probe.style.fontSize = fs + 'px';
      var w = probe.getBoundingClientRect().width / stageScale() / 100;
      if (w > 0.5) cw = w;
      lh = Math.round(fs * 1.25 * 4) / 4;
      screen.style.setProperty('--tm-lh', lh + 'px');
      screen.style.fontSize = fs + 'px';
      ta.style.fontSize = fs + 'px';
      ta.style.lineHeight = lh + 'px';
      ta.style.height = lh + 'px';
    }
    function chrome() {
      return { w: win.el.offsetWidth - screen.clientWidth, h: win.el.offsetHeight - root.clientHeight };
    }
    function updateMinSize() {
      var c = chrome();
      win.minW = Math.ceil(40 * cw) + 2 * PAD + c.w;
      win.minH = Math.ceil(8 * lh) + 2 * PAD + c.h;
    }
    function sizeTo80x24() {
      var c = chrome();
      selfSizing = true;
      try { win.setRect({ w: Math.ceil(80 * cw) + 2 * PAD + c.w, h: Math.ceil(24 * lh) + 2 * PAD + c.h }); } finally { selfSizing = false; }
    }
    function dirLabel() {
      var c = session.cwd;
      if (c === session.env.HOME) return '~';
      if (c === '/') return '/';
      return c.slice(c.lastIndexOf('/') + 1);
    }
    function titleFolder() {
      var l = dirLabel();
      return l === '~' ? 'an' : l;
    }
    function updateTitle() {
      if (!win) return;
      var t = titleFolder() + ' — -zsh — ' + cols + '×' + rows;
      if (win.getTitle() !== t) win.setTitle(t);
      win.state.cwd = session.cwd;
    }
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
      if (changed) { updateTitle(); renderLive(); }
    }

    // ---- history lines
    function buildLine(item) {
      var el = item.el || h('div', { class: 'tm-line' });
      el.textContent = '';
      var text = item.text + (item.mark ? '%' : '');
      var rs = wrapText(text, cols);
      for (var i = 0; i < rs.length; i++) {
        var r = h('div', { class: 'tm-row' });
        fillRow(r, rs[i], !!item.mark && i === rs.length - 1);
        el.appendChild(r);
      }
      item.el = el;
      return el;
    }
    function rewrap() {
      histEl.textContent = '';
      hist.forEach(function (it) { histEl.appendChild(buildLine(it)); });
    }
    function commitLine(text, mark) {
      var it = { text: text, mark: !!mark, el: null };
      hist.push(it);
      histEl.appendChild(buildLine(it));
      while (hist.length > 2000) {
        var old = hist.shift();
        if (old.el && old.el.parentNode) old.el.parentNode.removeChild(old.el);
        if (clearAnchor !== null) clearAnchor = Math.max(0, clearAnchor - 1);
      }
    }
    function printText(s) {
      if (!s) return;
      s = String(s).replace(/\r\n/g, '\n').replace(/\r/g, '');
      var chunks = s.split('\n');
      for (var i = 0; i < chunks.length; i++) {
        partial += expandTabs(partial, chunks[i]);
        if (i < chunks.length - 1) { commitLine(partial, false); partial = ''; }
      }
    }
    function flushPartial() {
      if (partial !== '') { commitLine(partial, true); partial = ''; }
    }
    function clearAll() {
      hist = [];
      histEl.textContent = '';
      partial = '';
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
      if (session.pending !== null) return session.ps2 || '> ';
      return 'an@MacBook-Air ' + dirLabel() + ' % ';
    }
    function pushUnits(units, str, cls) {
      for (var ch of str) {
        var w = charWidth(ch.codePointAt(0));
        if (w === 0) { if (units.length) units[units.length - 1].ch += ch; continue; }
        units.push({ ch: ch, w: w, cls: cls });
      }
    }
    function renderLive() {
      liveEl.textContent = '';
      if (closed) return;
      if (dead) { ta.style.display = 'none'; afterRender(); return; }
      ta.style.display = '';
      var units = [];
      var curIdx = -1;
      if (!busy) {
        pushUnits(units, promptStr(), 'p');
        for (var i = 0; i <= buf.length; i++) {
          if (i === cur) { if (comp) pushUnits(units, comp, 'c'); curIdx = units.length; }
          if (i < buf.length) pushUnits(units, buf[i], 'b');
        }
      }
      var rowsArr = [[]], col = 0, pos = [];
      units.forEach(function (u) {
        if (col + u.w > cols && col > 0) { rowsArr.push([]); col = 0; }
        pos.push({ r: rowsArr.length - 1, c: col });
        rowsArr[rowsArr.length - 1].push(u);
        col += u.w;
      });
      var cr = rowsArr.length - 1, cc = col;
      if (curIdx >= 0 && curIdx < units.length) { cr = pos[curIdx].r; cc = pos[curIdx].c; }
      else if (curIdx >= 0 && col >= cols) { rowsArr.push([]); cr = rowsArr.length - 1; cc = 0; }
      var gi = 0;
      rowsArr.forEach(function (ru, rIdx) {
        var rowEl = h('div', { class: 'tm-row' });
        var run = '', runCls = '';
        function flush() {
          if (!run) return;
          if (runCls === 'c') rowEl.appendChild(h('span', { class: 'tm-comp' }, run));
          else rowEl.appendChild(document.createTextNode(run));
          run = '';
        }
        ru.forEach(function (u) {
          var isCur = curIdx >= 0 && gi === curIdx;
          gi++;
          if (isCur || u.w === 2) {
            flush();
            var cls = (isCur ? 'tm-cursor ' : '') + (u.w === 2 ? 'tm-w ' : '') + (u.cls === 'c' ? 'tm-comp' : '');
            rowEl.appendChild(h('span', { class: cls.trim() }, u.ch));
            return;
          }
          if (runCls !== u.cls) { flush(); runCls = u.cls; }
          run += u.ch;
        });
        flush();
        if (curIdx >= 0 && rIdx === cr && cc >= 0 && curIdx >= units.length) rowEl.appendChild(h('span', { class: 'tm-cursor' }, ' '));
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
      while (j < buf.length && buf[j] === ' ') j++;
      while (j < buf.length && buf[j] !== ' ') j++;
      return j;
    }
    function editable() { return !busy && !dead; }

    // ---- running lines
    function openEffect(e) {
      try {
        if (e.type === 'open') LAB.apps.openPath(e.path, { appId: e.appId, via: 'terminal' });
        else if (e.type === 'launch') LAB.apps.launch(e.appId, null, { bounce: false });
        else if (e.type === 'reveal') {
          if (LAB.finder && LAB.finder.reveal) LAB.finder.reveal(e.path);
          else LAB.apps.openFolder(vfs.dirname(e.path), 'open');
        }
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
        if (typeof it === 'string') { printText(it); continue; }
        if (it.type === 'clear') clearAll();
        else if (it.type === 'exit') { dead = true; }
        else if (it.type === 'sleep') sleepMs = it.ms;
        else if (it.type === 'open' || it.type === 'launch' || it.type === 'reveal') openEffect(it);
      }
      while (termState.history.length > MAX_HISTORY) termState.history.shift();
      if (res.event) {
        var ev = res.event;
        LAB.bus.emit('term:run', {
          winId: win.id, line: ev.line, name: ev.name, args: ev.args, cwd: ev.cwd, cwdAfter: ev.cwdAfter,
          status: ev.status, out: ev.out, cmds: ev.cmds.map(function (c) {
            return { name: c.name, args: c.args.slice(), cwd: c.cwd, cwdAfter: c.cwdAfter, status: c.status, out: c.out };
          })
        });
        if (session.cwd !== lastCwd) {
          LAB.bus.emit('term:cwd', { winId: win.id, cwd: session.cwd, from: lastCwd });
          lastCwd = session.cwd;
        }
        if (dead) LAB.bus.emit('term:exit', { winId: win.id });
      }
      updateTitle();
      if (!res.done && session.prompt && session.prompt.text) LAB.bus.emit('term:prompt', { winId: win.id, text: session.prompt.text });
      if (dead) {
        // like Terminal's default: the window closes after a clean exit (a moment later, so the goodbye text can be read)
        setTimeout(function () { if (!closed) { try { win.close(); } catch (e) { /* ignore */ } } }, 700);
      }
      if (!res.done && sleepMs !== null) { startSleep(sleepMs); return; }
      showPrompt();
    }
    function submit() {
      if (busy || dead) return;
      var line = buf.join('');
      commitLine(promptStr() + line, false);
      buf = []; cur = 0; comp = ''; histPos = -1; stash = null; tabState = null;
      handleResult(LAB.shell.run(line, session));
    }
    function interrupt() {
      if (dead) return;
      if (busy) {
        clearTimeout(sleepTimer); sleepTimer = 0; busy = false;
        commitLine('^C', false);
        handleResult(LAB.shell.cancel(session));
        return;
      }
      commitLine(promptStr() + buf.join('') + '^C', false);
      buf = []; cur = 0; comp = '';
      if (session.gen) { handleResult(LAB.shell.cancel(session)); return; }
      if (session.pending !== null) LAB.shell.cancel(session);
      showPrompt();
    }
    function eof() {
      if (busy || dead) return;
      if (buf.length) return;
      if (session.prompt) { handleResult(session.prompt.onEof()); return; }
      if (session.pending !== null) { commitLine(promptStr(), false); LAB.shell.cancel(session); showPrompt(); return; }
      commitLine(promptStr() + 'exit', false);
      handleResult(LAB.shell.run('exit', session));
    }

    // ---- Tab
    function doTab() {
      if (!editable() || session.prompt) return;
      var text = buf.join('');
      if (tabState && tabState.items) {
        // later Tabs cycle through the listed candidates
        tabState.idx = (tabState.idx + 1) % tabState.items.length;
        var rep = tabState.items[tabState.idx].replacement;
        var before = buf.slice(0, tabState.start), tail = buf.slice(tabState.end);
        var insert = Array.from(rep);
        buf = before.concat(insert, tail);
        cur = before.length + insert.length;
        tabState.end = cur;
        renderLive();
        return;
      }
      var cursorStr = buf.slice(0, cur).join('').length;
      var res = LAB.shell.complete(text, cursorStr, session);
      if (!res.candidates.length) return;
      var word = text.slice(res.start, cursorStr);
      var startIdx = Array.from(text.slice(0, res.start)).length;
      if (res.single || res.replacement.length > word.length) {
        var ins = Array.from(res.replacement);
        var wordLen = Array.from(word).length;
        buf = buf.slice(0, startIdx).concat(ins, buf.slice(startIdx + wordLen));
        cur = startIdx + ins.length;
        renderLive();
        return;
      }
      // nothing to add: list the candidates under the line, then the prompt comes back with the same text
      commitLine(promptStr() + text, false);
      printText(columns(res.candidates, cols));
      flushPartial();
      tabState = { items: res.items, idx: -1, start: startIdx, end: cur };
      renderLive();
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
      var meta = e.metaKey, ctrl = e.ctrlKey && !e.metaKey, alt = e.altKey;
      var k = key.length === 1 ? key.toLowerCase() : key;
      if (key !== 'Tab') tabState = null;
      var copyCombo = (meta || ctrl) && k === 'c' && !alt;
      var pasteCombo = (meta || ctrl) && k === 'v' && !alt;

      if (document.activeElement !== ta) {
        if (copyCombo && selectionText()) return;                  // native copy of the selected text
        var s0 = window.getSelection();
        if (s0 && !s0.isCollapsed && !(meta && k === 'a')) s0.removeAllRanges();
        focusInput();
        if (key.length === 1 && !meta && !ctrl && !alt && editable()) { insertText(key); e.preventDefault(); return; }
      }

      if (copyCombo) {
        if (selectionText()) { copySelection(); e.preventDefault(); return; }
        if (ctrl) { interrupt(); e.preventDefault(); }
        return;
      }
      if (pasteCombo) return;                                      // the paste event does the work
      if (meta) {
        if (k === 'k') { clearAll(); e.preventDefault(); return; }
        if (k === 'a') { selectAll(); e.preventDefault(); return; }
        if (key === '=' || key === '+') { setFontSize(fs + 1); e.preventDefault(); return; }
        if (key === '-' || key === '_') { setFontSize(fs - 1); e.preventDefault(); return; }
        return;
      }
      if (dead) { if (key === 'PageUp' || key === 'PageDown') return; e.preventDefault(); return; }
      if (busy) {
        if (ctrl && k === 'c') { interrupt(); e.preventDefault(); return; }
        if (key.length === 1 || key === 'Enter' || key === 'Backspace' || key === 'Tab') e.preventDefault();
        return;
      }
      if (ctrl) {
        // Windows-keyboard habits that cost nothing: Ctrl+Backspace and Ctrl+arrows work on words
        if (key === 'Backspace') { deleteWord(); e.preventDefault(); return; }
        if (key === 'ArrowLeft') { cur = wordLeftIdx(); renderLive(); e.preventDefault(); return; }
        if (key === 'ArrowRight') { cur = wordRightIdx(); renderLive(); e.preventDefault(); return; }
        var handled = true;
        switch (k) {
          case 'a': cur = 0; renderLive(); break;
          case 'e': cur = buf.length; renderLive(); break;
          case 'b': if (cur > 0) { cur--; renderLive(); } break;
          case 'f': if (cur < buf.length) { cur++; renderLive(); } break;
          case 'h': if (cur > 0) { buf.splice(cur - 1, 1); cur--; tabState = null; renderLive(); } break;
          case 'k': buf.splice(cur); tabState = null; renderLive(); break;
          case 'u':
            if (cur >= buf.length) { buf = []; cur = 0; } else { buf.splice(0, cur); cur = 0; }
            tabState = null; renderLive(); break;
          case 'w': deleteWord(); break;
          case 'l': clearScreen(); break;
          case 'c': interrupt(); break;
          case 'd': eof(); break;
          case 'p': if (!session.prompt && session.pending === null) histPrev(); break;
          case 'n': if (!session.prompt && session.pending === null) histNext(); break;
          default: handled = false;
        }
        if (handled || (key.length === 1)) e.preventDefault();
        return;
      }
      if (alt) {
        if (key === 'Backspace') { deleteWord(); e.preventDefault(); return; }
        if (key === 'ArrowLeft' || k === 'b') { cur = wordLeftIdx(); renderLive(); e.preventDefault(); return; }
        if (key === 'ArrowRight' || k === 'f') { cur = wordRightIdx(); renderLive(); e.preventDefault(); return; }
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
        case 'Tab': e.preventDefault(); doTab(); return;
        case 'PageUp': e.preventDefault(); screen.scrollTop -= screen.clientHeight - 2 * lh; return;
        case 'PageDown': e.preventDefault(); screen.scrollTop += screen.clientHeight - 2 * lh; return;
        case 'Escape': return;
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
      pasteText(LAB.clipboard.forPaste(e));
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
    screen.addEventListener('contextmenu', function (e) {
      e.preventDefault();
      var pt = LAB.stage.toStage(e.clientX, e.clientY);
      var hasSel = !!selectionText();
      LAB.menu.contextMenu(pt.x, pt.y, [
        { label: '拷貝', enabled: hasSel, action: copySelection },
        { label: '貼上', action: function () { focusInput(); pasteFromMenu(); } },
        { separator: true },
        { label: '全選', action: selectAll },
        { label: '清除至開頭', action: clearAll }
      ]);
    });
    screen.addEventListener('scroll', function () {
      screen.classList.add('lab-scrolling');
      clearTimeout(screen._scT);
      screen._scT = setTimeout(function () { screen.classList.remove('lab-scrolling'); }, 900);
    });

    // ---- window
    win = LAB.wm.open({
      appId: 'terminal', title: 'an — -zsh — 80×24', width: 660, height: 440, bar: 'plain', theme: 'light',
      content: root, minW: 320, minH: 160, icon: 'app-terminal'
    });
    win.state.cwd = session.cwd;

    var inst = {
      win: win, session: session,
      cols: function () { return cols; }, rows: function () { return rows; },
      copy: copySelection, paste: pasteFromMenu, selectAll: selectAll, clearAll: clearAll,
      zoom: function (d) { setFontSize(fs + d); }, insert: insertText, focus: focusInput,
      typed: function () { return buf.join(''); }, isBusy: function () { return busy; }, isDead: function () { return dead; },
      fontSize: function () { return fs; }
    };
    instances.set(win.id, inst);
    win.own(function () { instances.delete(win.id); });

    measure();
    updateMinSize();
    sizeTo80x24();
    fit();

    // first line
    var loginLine;
    if (termState.lastLogin === null) loginLine = 'Last login: Fri Oct  2 09:41:07 on ttys' + pad3(tty);
    else loginLine = 'Last login: ' + LAB.util.fmt.lastLogin(termState.lastLogin.ms) + ' on ttys' + pad3(tty);
    termState.lastLogin = { ms: LAB.clock.ms(), tty: tty };
    termState.ttyCount = tty + 1;
    LAB.store.markDirty();
    commitLine(loginLine, false);
    showPrompt();
    updateTitle();

    // fonts arrive late: measure again, and keep the 80×24 size until the student resizes the window
    function remeasure() {
      if (closed) return;
      measure(); updateMinSize();
      if (!userSized) sizeTo80x24();
      fit(); renderLive();
    }
    if (document.fonts) {
      try { document.fonts.load('12px "JetBrains Mono"').then(remeasure, function () {}); } catch (e) { /* ignored */ }
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
    win.own(win.on('resize', function () { if (!selfSizing) userSized = true; fit(); }));
    win.own(win.on('focus', function () { focusInput(); }));
    win.own(function () {
      closed = true;
      if (sleepTimer) { clearTimeout(sleepTimer); sleepTimer = 0; }
      clearTimeout(screen._scT);
      if (session.gen) { try { session.gen.return(); } catch (e) { /* ignore */ } }
    });

    // drag and drop: paths typed at the cursor, never run (DESIGN §4.2.5)
    win.own(LAB.dnd.target(win.el, {
      id: 'terminal:' + win.id,
      accept: function (pl) { return pl && pl.paths && pl.paths.length ? 'copy' : false; },
      drop: function (pl) {
        var text = pl.paths.map(shellEscape).join(' ') + ' ';
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

  LAB.menu.register('terminal', function () {
    var t = currentTerminal();
    return [
      { label: '殼層', items: [
        { label: '新增視窗', shortcut: '⌘N', action: function () { createTerminal({}); } },
        { label: '新增分頁', shortcut: '⌘T', enabled: false },
        { separator: true },
        { label: '關閉視窗', shortcut: '⌘W', enabled: !!t, action: function () { if (t) t.win.close(); } }
      ] },
      { label: '編輯', items: [
        { label: '拷貝', shortcut: '⌘C', enabled: !!t, action: function () { if (t) t.copy(); } },
        { label: '貼上', shortcut: '⌘V', enabled: !!t, action: function () { if (t) t.paste(); } },
        { label: '全選', shortcut: '⌘A', enabled: !!t, action: function () { if (t) t.selectAll(); } },
        { separator: true },
        { label: '清除至開頭', shortcut: '⌘K', enabled: !!t, action: function () { if (t) t.clearAll(); } }
      ] },
      { label: '顯示方式', items: [
        { label: '放大', shortcut: '⌘+', enabled: !!t && t.fontSize() < FS_MAX, action: function () { if (t) t.zoom(1); } },
        { label: '縮小', shortcut: '⌘−', enabled: !!t && t.fontSize() > FS_MIN, action: function () { if (t) t.zoom(-1); } }
      ] },
      { label: '視窗', items: LAB.menu.windowMenu(false) },
      { label: '輔助說明', items: [
        { label: '關於這個練習', action: function () { LAB.apps.launch('about', { tab: 'about' }); } }
      ] }
    ];
  });

  LAB.apps.register('terminal', {
    title: '終端機', en: 'Terminal', aliases: ['terminal', 'shell', 'zsh'], icon: 'app-terminal', dock: true,
    open: function (a) { return createTerminal(a).win; },
    newWindow: function () { return createTerminal({}).win; },
    canHandle: function () { return true; },
    handleOpen: function (path) {
      var st = LAB.vfs.stat(path);
      var dir = !st ? HOME : (st.type === 'dir' ? st.path : LAB.vfs.dirname(st.path));
      createTerminal({ cwd: dir });
      return true;
    }
  });

  LAB.terminal = { instances: instances, current: currentTerminal, open: function (a) { return createTerminal(a); }, state: termState };
})(window.LAB);
