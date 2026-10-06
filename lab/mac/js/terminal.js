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

  /* colour: commands print ANSI SGR codes (only when stdout is the screen); events and pipes get the plain text */
  var ESC = '\x1b';
  var ANSI_RE = /\x1b\[[0-9;?]*[A-Za-z]/g;
  function stripAnsi(s) { return String(s).replace(ANSI_RE, ''); }
  function sgr(code, text) { return ESC + '[' + code + 'm' + text + ESC + '[0m'; }
  /* a small seeded generator (mulberry32): "random" numbers that are the same every visit */
  function makeRng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* arithmetic for $(( )), expr and bc: + - * / % ** (also ^ when opts.caret), parentheses, comparisons, && || !, variables.
     Integers divide like integers (zsh) unless opts.scale is set (bc) or a decimal point shows up. Throws Error('division by zero' | 'syntax error'). */
  function calcEval(src, opts) {
    opts = opts || {};
    var s = String(src), i = 0;
    function ws() { while (i < s.length && /\s/.test(s.charAt(i))) i++; }
    function fail(m) { throw new Error(m || 'syntax error'); }
    function num(x) { return x; }
    function primary() {
      ws();
      var c = s.charAt(i);
      if (c === '(') { i++; var v = lor(); ws(); if (s.charAt(i) !== ')') fail(); i++; return v; }
      var mh = /^0[xX][0-9a-fA-F]+/.exec(s.slice(i));
      if (mh) { i += mh[0].length; return parseInt(mh[0], 16); }
      var m = /^(\d+\.?\d*|\.\d+)/.exec(s.slice(i));
      if (m) { i += m[0].length; return num(parseFloat(m[0])); }
      var mv = /^[$]?([A-Za-z_][A-Za-z0-9_]*)/.exec(s.slice(i));
      if (mv) {
        i += mv[0].length;
        if (opts.fns && hasOwn.call(opts.fns, mv[1]) && s.charAt(i) === '(') {          // a function call such as sqrt(2) (bc)
          i++;
          var fa = lor(); ws();
          if (s.charAt(i) !== ')') fail();
          i++;
          return opts.fns[mv[1]](fa);
        }
        var raw = opts.get ? opts.get(mv[1]) : ''; var nv = parseFloat(raw); return isFinite(nv) ? nv : 0;
      }
      fail();
    }
    function unary() {
      ws();
      var c = s.charAt(i);
      if (c === '-') { i++; return -unary(); }
      if (c === '+') { i++; return unary(); }
      if (c === '!') { i++; return unary() ? 0 : 1; }
      return power();
    }
    function power() {
      var b = primary();
      ws();
      if (s.substr(i, 2) === '**' || (opts.caret && s.charAt(i) === '^')) {
        i += s.charAt(i) === '^' ? 1 : 2;
        var e = unary();
        return Math.pow(b, e);
      }
      return b;
    }
    function mul() {
      var a = unary();
      for (;;) {
        ws();
        var c = s.charAt(i);
        if (c === '*' && s.charAt(i + 1) !== '*') { i++; a = a * unary(); }
        else if (c === '/') {
          i++; var d = unary();
          if (d === 0) throw new Error('division by zero');
          if (opts.scale !== undefined) { var f = Math.pow(10, opts.scale); a = Math.trunc(a / d * f) / f; }
          else a = (Number.isInteger(a) && Number.isInteger(d) && !opts.float) ? Math.trunc(a / d) : a / d;
        } else if (c === '%') { i++; var dm = unary(); if (dm === 0) throw new Error('division by zero'); a = a % dm; }
        else return a;
      }
    }
    function add() {
      var a = mul();
      for (;;) {
        ws();
        var c = s.charAt(i);
        if (c === '+') { i++; a = a + mul(); }
        else if (c === '-') { i++; a = a - mul(); }
        else return a;
      }
    }
    function cmp() {
      var a = add();
      for (;;) {
        ws();
        var t2 = s.substr(i, 2), c = s.charAt(i);
        if (t2 === '<=') { i += 2; a = a <= add() ? 1 : 0; }
        else if (t2 === '>=') { i += 2; a = a >= add() ? 1 : 0; }
        else if (t2 === '==') { i += 2; a = a === add() ? 1 : 0; }
        else if (t2 === '!=') { i += 2; a = a !== add() ? 1 : 0; }
        else if (c === '<') { i++; a = a < add() ? 1 : 0; }
        else if (c === '>') { i++; a = a > add() ? 1 : 0; }
        else return a;
      }
    }
    function land() { var a = cmp(); for (;;) { ws(); if (s.substr(i, 2) === '&&') { i += 2; var b = cmp(); a = (a && b) ? 1 : 0; } else return a; } }
    function lor() { var a = land(); for (;;) { ws(); if (s.substr(i, 2) === '||') { i += 2; var b = land(); a = (a || b) ? 1 : 0; } else return a; } }
    var v = lor();
    ws();
    if (i < s.length) fail();
    return v;
  }

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
  /* the text of a `$(...)` starting at i (src[i] === '$', src[i+1] === '('), balanced and quote-aware: {src, end} | null */
  function dollarParen(src, i) {
    var depth = 0, j = i + 1, q = null;
    for (; j < src.length; j++) {
      var c = src.charAt(j);
      if (q) { if (c === q) q = null; else if (c === '\\' && q === '"') j++; continue; }
      if (c === "'" || c === '"') { q = c; continue; }
      if (c === '\\') { j++; continue; }
      if (c === '(') depth++;
      else if (c === ')') { depth--; if (depth === 0) return { src: src.slice(i + 2, j), end: j + 1 }; }
    }
    return null;
  }
  /* read a `$` expansion at src[i]: {k:'var',name,len,mod?} | {k:'sub',src,len} | {k:'lit'} | {k:'unsupported',token} */
  function readDollar(src, i) {
    var nx = src.charAt(i + 1);
    if (nx === '(') {
      if (src.charAt(i + 2) === '(') {                                  // $(( arithmetic ))
        var ad = 0;
        for (var aj = i + 3; aj < src.length; aj++) {
          var ac = src.charAt(aj);
          if (ac === '(') ad++;
          else if (ac === ')') { if (ad === 0 && src.charAt(aj + 1) === ')') return { k: 'arith', src: src.slice(i + 3, aj), len: aj + 2 - i }; ad--; }
        }
        return { k: 'unsupported', token: src.slice(i, Math.min(src.length, wordEnd(src, i))) };
      }
      var dp = dollarParen(src, i);
      if (!dp) return { k: 'unsupported', token: src.slice(i, wordEnd(src, i)) };
      return { k: 'sub', src: dp.src, len: dp.end - i };
    }
    if (nx === '{') {
      var close = src.indexOf('}', i + 2);
      if (close < 0) return { k: 'lit' };
      var nm = src.slice(i + 2, close);
      if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(nm)) return { k: 'var', name: nm, len: close + 1 - i };
      var m1 = /^([A-Za-z_][A-Za-z0-9_]*):?-(.*)$/.exec(nm);
      if (m1) return { k: 'var', name: m1[1], len: close + 1 - i, mod: { op: '-', arg: m1[2], colon: nm.indexOf(':-') > 0 } };
      var m2 = /^#([A-Za-z_][A-Za-z0-9_]*)$/.exec(nm);
      if (m2) return { k: 'var', name: m2[1], len: close + 1 - i, mod: { op: '#' } };
      return { k: 'unsupported', token: src.slice(i, close + 1) };
    }
    if (nx === '?') return { k: 'var', name: '?', len: 2 };
    if (nx === '$') return { k: 'var', name: '$', len: 2 };
    if (nx === '#') return { k: 'var', name: '#', len: 2 };
    if (/[A-Za-z_]/.test(nx)) {
      var j = i + 1;
      while (j < src.length && /[A-Za-z0-9_]/.test(src.charAt(j))) j++;
      return { k: 'var', name: src.slice(i + 1, j), len: j - i };
    }
    if (/[0-9]/.test(nx)) return { k: 'var', name: nx, len: 2 };
    return { k: 'lit' };
  }

  /* lex(src) -> {tokens, incomplete:ps2|null, unsupported:token|null, parseError:token|null}
     tokens: {t:'word', parts:[{k:'lit',s,q,tilde?}|{k:'var',name,q,mod?}|{k:'sub',src,q}], raw} and {t:'op', op, fd?, from?, to?}
     op: ; nl && || | > >> < <<< &> &>> dup   (fd = the file descriptor the redirect belongs to: 0 stdin, 1 stdout, 2 stderr)
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
    /* a lone digit word right before a redirect operator is the file descriptor (`2>`, `1>>`, `0<`) */
    function takeFd(def) {
      if (parts && parts.length === 1 && parts[0].k === 'lit' && parts[0].q === 0 && /^[0-2]$/.test(parts[0].s) && wordStart === i - 1) {
        var fd = parseInt(parts[0].s, 10);
        parts = null;
        return fd;
      }
      return def;
    }
    function pushSub(code, q, len) {
      startWord();
      parts.push({ k: 'sub', src: code, q: q });
      i += len;
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
            if (k2 < 0) { res.incomplete = 'bquote> '; return res; }
            flush(); parts.push({ k: 'sub', src: src.slice(i + 1, k2), q: 2 }); pushed = true; i = k2 + 1;
            continue;
          }
          if (d === '$') {
            var dv = readDollar(src, i);
            if (dv.k === 'unsupported') { res.unsupported = dv.token; return res; }
            if (dv.k === 'var') { flush(); parts.push({ k: 'var', name: dv.name, q: 2, mod: dv.mod }); pushed = true; i += dv.len; continue; }
            if (dv.k === 'sub') { flush(); parts.push({ k: 'sub', src: dv.src, q: 2 }); pushed = true; i += dv.len; continue; }
            if (dv.k === 'arith') { flush(); parts.push({ k: 'sub', arith: true, src: dv.src, q: 2 }); pushed = true; i += dv.len; continue; }
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
        if (kb < 0) { res.incomplete = 'bquote> '; return res; }
        pushSub(src.slice(i + 1, kb), 0, kb + 1 - i);
        continue;
      }

      if (c === '$') {
        var uv = readDollar(src, i);
        if (uv.k === 'unsupported') { res.unsupported = uv.token; return res; }
        if (uv.k === 'var') { startWord(); parts.push({ k: 'var', name: uv.name, q: 0, mod: uv.mod }); i += uv.len; continue; }
        if (uv.k === 'sub') { pushSub(uv.src, 0, uv.len); continue; }
        if (uv.k === 'arith') { startWord(); parts.push({ k: 'sub', arith: true, src: uv.src, q: 0 }); i += uv.len; continue; }
        addLit('$', 0); i++; continue;
      }

      if (c === '<') {
        var fd0 = takeFd(0);
        endWord();
        if (src.substr(i, 3) === '<<<') { toks.push({ t: 'op', op: '<<<', fd: 0 }); i += 3; continue; }
        if (src.substr(i, 2) === '<<') { res.unsupported = '<<'; return res; }
        if (src.charAt(i + 1) === '(') { res.unsupported = '<(' ; return res; }
        toks.push({ t: 'op', op: '<', fd: fd0 });
        i++;
        continue;
      }

      if (c === '>') {
        var fd1 = takeFd(1);
        endWord();
        if (src.charAt(i + 1) === '&') {
          var tgt = src.charAt(i + 2);
          if (/[0-2]/.test(tgt) && !/[A-Za-z0-9_.\/~-]/.test(src.charAt(i + 3))) { toks.push({ t: 'op', op: 'dup', from: fd1, to: parseInt(tgt, 10) }); i += 3; continue; }
          if (tgt === '-') { toks.push({ t: 'op', op: 'dup', from: fd1, to: -1 }); i += 3; continue; }
          // `>& file` means stdout and stderr into the file
          toks.push({ t: 'op', op: '&>', fd: 1 }); i += 2; continue;
        }
        if (src.charAt(i + 1) === '>') { toks.push({ t: 'op', op: '>>', fd: fd1 }); i += 2; continue; }
        if (src.charAt(i + 1) === '(') { res.unsupported = '>('; return res; }
        toks.push({ t: 'op', op: '>', fd: fd1 });
        i++;
        continue;
      }

      if (c === ';' || c === '&' || c === '|') {
        endWord();
        var two = src.substr(i, 2);
        if (two === '&&') { toks.push({ t: 'op', op: '&&' }); i += 2; continue; }
        if (two === '||') { toks.push({ t: 'op', op: '||' }); i += 2; continue; }
        if (two === ';;') { res.parseError = ';;'; return res; }
        if (two === '&>') {
          if (src.substr(i, 3) === '&>>') { toks.push({ t: 'op', op: '&>>', fd: 1 }); i += 3; continue; }
          toks.push({ t: 'op', op: '&>', fd: 1 }); i += 2; continue;
        }
        if (two === '|&') { toks.push({ t: 'op', op: '|' }); toks.push({ t: 'op', op: 'dup', from: 2, to: 1, pipeErr: true }); i += 2; continue; }
        if (c === '&') { res.unsupported = '&'; return res; }
        toks.push({ t: 'op', op: c });
        i++;
        continue;
      }

      if (c === '(' || c === ')') { res.parseError = c; return res; }

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
  /* parse(tokens) -> {items:[{conn, pipe:[{words, redirs, dups}]}]} | {error:'<token>'}
     redirs: [{op, fd, target}]   dups: [{from, to}] (`2>&1`) */
  function parse(toks) {
    var items = [];
    var i = 0, conn = null;
    function skipNl() { while (i < toks.length && toks[i].t === 'op' && toks[i].op === 'nl') i++; }
    skipNl();
    while (i < toks.length) {
      var pipe = [];
      for (;;) {
        var cmd = { words: [], redirs: [], dups: [] };
        while (i < toks.length) {
          var t = toks[i];
          if (t.t === 'word') { cmd.words.push(t); i++; continue; }
          if (t.op === 'dup') { cmd.dups.push({ from: t.from, to: t.to }); i++; continue; }
          if (t.op === '>' || t.op === '>>' || t.op === '<' || t.op === '<<<' || t.op === '&>' || t.op === '&>>') {
            var tg = toks[i + 1];
            if (!tg) return { error: '\\n' };
            if (tg.t === 'op') return { error: opText(tg) };
            cmd.redirs.push({ op: t.op, fd: t.fd, target: tg });
            i += 2;
            continue;
          }
          break;
        }
        if (!cmd.words.length && !cmd.redirs.length && !cmd.dups.length) return { error: i < toks.length ? opText(toks[i]) : '\\n' };
        pipe.push(cmd);
        if (i < toks.length && toks[i].t === 'op' && toks[i].op === '|') {
          i++; skipNl();
          if (i >= toks.length) return { error: '\\n' };
          // `cmd |& next`: the lexer left a dup token right after the bar: it belongs to the command before it
          if (toks[i].t === 'op' && toks[i].op === 'dup' && toks[i].pipeErr) { cmd.dups.push({ from: 2, to: 1 }); i++; }
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
    for (var i = 0; i < segs.length; i++) if (segs[i].g && (/[*?]/.test(segs[i].s) || /\[[^\]]+\]/.test(segs[i].s))) return true;     // a lone [ is just a character ([ -d x ])
    return false;
  }
  function globExpand(segs, session) {
    var vfs = session.vfs;
    var toks = globTokens(segs);
    var parts = [[]];
    toks.forEach(function (t) { if (t.c === 'sep') parts.push([]); else parts[parts.length - 1].push(t); });
    var abs = parts.length > 1 && parts[0].length === 0;
    var results = [];
    var guard = 0;
    function rec(prefix, baseAbs, idx) {
      if (idx >= parts.length || ++guard > 4000) return;
      var seg = parts[idx];
      var last = idx === parts.length - 1;
      if (seg.length === 0) {
        if (last) { if (vfs.isDir(baseAbs)) results.push(prefix); return; }
        rec(prefix, baseAbs, idx + 1);
        return;
      }
      // zsh's `**/`: zero or more folders in between
      if (seg.length === 2 && seg[0].c === 'any' && seg[1].c === 'any' && !last) {
        rec(prefix, baseAbs, idx + 1);
        var subs;
        try { subs = vfs.list(baseAbs); } catch (e0) { return; }
        subs.forEach(function (st) { if (st.type === 'dir' && st.name.charAt(0) !== '.') rec(prefix + st.name + '/', st.path, idx); });
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
    var uniq = {};
    results = results.filter(function (r) { if (uniq[r]) return false; uniq[r] = 1; return true; });
    results.sort(function (a, b) { return a < b ? -1 : a > b ? 1 : 0; });
    return results;
  }

  /* brace expansion of ONE unquoted literal: a{1,2}b -> [a1b, a2b]; {1..3}, {a..c}, {01..10}, {1..10..2}; {x} stays as it is */
  function braceExpandStr(s, depth) {
    depth = depth || 0;
    if (depth > 6) return [s];
    var open = -1, i, level = 0, close = -1;
    for (i = 0; i < s.length; i++) {
      if (s.charAt(i) === '\\') { i++; continue; }
      if (s.charAt(i) === '{') { if (level === 0) open = i; level++; }
      else if (s.charAt(i) === '}' && level > 0) {
        level--;
        if (level === 0) {
          close = i;
          var inner = s.slice(open + 1, close);
          var alts = braceAlts(inner);
          if (alts) {
            var pre = s.slice(0, open), post = s.slice(close + 1), out = [];
            alts.forEach(function (a) { out = out.concat(braceExpandStr(pre + a + post, depth + 1)); });
            return out;
          }
          // not a brace list: keep looking after this group
          open = -1;
        }
      }
    }
    return [s];
  }
  function braceAlts(inner) {
    var m = /^(-?\d+)\.\.(-?\d+)(?:\.\.(-?\d+))?$/.exec(inner);
    if (m) {
      var a = parseInt(m[1], 10), b = parseInt(m[2], 10), st = m[3] ? Math.abs(parseInt(m[3], 10)) || 1 : 1;
      var padW = (/^-?0\d/.test(m[1]) || /^-?0\d/.test(m[2])) ? Math.max(m[1].length, m[2].length) : 0;
      var res = [];
      if (Math.abs(b - a) / st > 500) return null;
      if (a <= b) for (var x = a; x <= b; x += st) res.push(padW ? padNum(x, padW) : String(x));
      else for (var y = a; y >= b; y -= st) res.push(padW ? padNum(y, padW) : String(y));
      return res;
    }
    var mc = /^([A-Za-z])\.\.([A-Za-z])$/.exec(inner);
    if (mc) {
      var c1 = mc[1].charCodeAt(0), c2 = mc[2].charCodeAt(0), r2 = [];
      if (c1 <= c2) for (var p = c1; p <= c2; p++) r2.push(String.fromCharCode(p));
      else for (var q = c1; q >= c2; q--) r2.push(String.fromCharCode(q));
      return r2;
    }
    // comma list at the top level
    var lvl = 0, cur = '', list = [], has = false;
    for (var k = 0; k < inner.length; k++) {
      var ch = inner.charAt(k);
      if (ch === '\\') { cur += ch + (inner.charAt(k + 1) || ''); k++; continue; }
      if (ch === '{') lvl++;
      if (ch === '}') lvl--;
      if (ch === ',' && lvl === 0) { list.push(cur); cur = ''; has = true; continue; }
      cur += ch;
    }
    list.push(cur);
    return has ? list : null;
  }
  function padNum(x, w) {
    var neg = x < 0, s = String(Math.abs(x));
    while (s.length < (neg ? w - 1 : w)) s = '0' + s;
    return (neg ? '-' : '') + s;
  }
  /* parts -> every variant after brace expansion (unquoted literal parts only) */
  function braceVariants(parts) {
    var has = parts.some(function (p) { return p.k === 'lit' && p.q === 0 && !p.tilde && p.s.indexOf('{') >= 0 && p.s.indexOf('}') > p.s.indexOf('{'); });
    if (!has) return [parts];
    var variants = [[]];
    parts.forEach(function (p) {
      if (p.k === 'lit' && p.q === 0 && !p.tilde && p.s.indexOf('{') >= 0) {
        var alts = braceExpandStr(p.s);
        var next = [];
        variants.forEach(function (v) { alts.forEach(function (a) { next.push(v.concat([{ k: 'lit', s: a, q: 0 }])); }); });
        variants = next;
      } else variants = variants.map(function (v) { return v.concat([p]); });
    });
    return variants.length > 600 ? [parts] : variants;
  }

  function varValue(session, p) {
    var env = session.env, name = p.name, v;
    if (name === '?') v = String(session.status);
    else if (name === '$') v = String(session.pid || 5001);
    else if (name === '#') v = '0';
    else if (name === '0') v = hasOwn.call(env, '0') ? String(env['0']) : '-zsh';
    else if (name === 'RANDOM') v = String(Math.floor(session.rng() * 32768));
    else if (name === 'SECONDS') v = String(Math.floor((LAB.clock.ms() - (session.startMs || LAB.clock.ms())) / 1000));
    else if (name === 'LINENO') v = '1';
    else v = hasOwn.call(env, name) ? String(env[name]) : '';
    var m = p.mod;
    if (m) {
      if (m.op === '-') { if (v === '' && (m.colon || !hasOwn.call(env, name))) v = m.arg; }
      else if (m.op === '#') v = String(Array.from(v).length);
    }
    return v;
  }

  /* expandWord(tok, session, job) -> {words:[…]} | {error:'zsh: no matches found: …'}   job collects the commands a `$(…)` ran */
  function expandWord(tok, session, job) {
    var out = [];
    var variants = braceVariants(tok.parts);
    for (var vi = 0; vi < variants.length; vi++) {
      var parts = variants[vi];
      var cur = [], started = false;
      var finish = function () {
        if (!started) { cur = []; return null; }
        var segs = cur; cur = []; started = false;
        var rawWord = segs.map(function (s) { return s.s; }).join('');
        if (hasGlobChars(segs)) {
          var found = globExpand(segs, session);
          if (!found.length) return { error: 'zsh: no matches found: ' + (variants.length === 1 && out.length === 0 ? tok.raw : rawWord) };
          found.forEach(function (f) { out.push(f); });
          return null;
        }
        out.push(rawWord);
        return null;
      };
      for (var pi = 0; pi < parts.length; pi++) {
        var p = parts[pi];
        if (p.k === 'var') {
          var v = varValue(session, p);
          if (v !== '' || p.q) { cur.push({ s: v, g: false }); started = true; }
        } else if (p.k === 'sub') {
          var sv = p.arith ? arithValue(p.src, session, job) : runSubstitution(p.src, session, job);
          if (p.q) { cur.push({ s: sv, g: false }); started = true; }
          else {
            var pieces = sv.split(/\s+/).filter(function (x) { return x.length; });
            if (sv.length && /^\s/.test(sv) && started) { var e0 = finish(); if (e0) return e0; }
            for (var si = 0; si < pieces.length; si++) {
              if (si > 0) { var e1 = finish(); if (e1) return e1; }
              cur.push({ s: pieces[si], g: false }); started = true;
            }
            if (sv.length && /\s$/.test(sv) && started) { var e2 = finish(); if (e2) return e2; }
          }
        } else if (p.tilde && pi === 0) {
          cur.push({ s: session.env.HOME + p.s.slice(1), g: false }); started = true;
        } else if (p.q === 0) {
          cur.push({ s: p.s, g: true });
          if (p.s !== '') started = true;
        } else {
          cur.push({ s: p.s, g: false }); started = true;
        }
      }
      var ef = finish();
      if (ef) return ef;
    }
    return { words: out };
  }

  /* ------------------------------------------------------------ path helpers */
  /* The file tree has no permissions and no symbolic links, so `chmod` and `ln -s` keep them beside it: one small table per tree,
     keyed by the canonical path. Moves, copies and removals made through the default tree keep the table in step (see fs:change below). */
  function attrsOf(vfs) {
    if (!vfs.__termAttrs) Object.defineProperty(vfs, '__termAttrs', { value: { modes: new Map(), links: new Map() }, enumerable: false });
    return vfs.__termAttrs;
  }
  function modeOf(vfs, st) {
    var a = attrsOf(vfs);
    if (a.links.has(st.path)) return 493;                     // 0755: a link shows lrwxr-xr-x
    if (a.modes.has(st.path)) return a.modes.get(st.path);
    return st.type === 'dir' || st.kind === 'app' ? 493 : 420;   // 0755 / 0644
  }
  function modeString(mode, type) {
    var s = type === 'dir' ? 'd' : type === 'link' ? 'l' : '-';
    var r = ['r', 'w', 'x'];
    for (var i = 0; i < 9; i++) s += (mode & (256 >> i)) ? r[i % 3] : '-';
    return s;
  }
  function followLinks(vfs, abs, noFollow, links) {
    for (var round = 0; round < 8; round++) {
      var segs = abs.split('/').filter(function (x) { return x.length; }), cur = '', changed = false;
      for (var i = 0; i < segs.length; i++) {
        cur += '/' + segs[i];
        var key = vfs.canon(cur);
        if (links.has(key) && !(noFollow && i === segs.length - 1)) {
          var tgt = links.get(key);
          var resolved = tgt.charAt(0) === '/' ? tgt : vfs.dirname(key) + '/' + tgt;
          abs = vfs.normalize(resolved + '/' + segs.slice(i + 1).join('/'));
          changed = true;
          break;
        }
      }
      if (!changed) break;
    }
    return abs;
  }
  /* an operand as typed -> absolute path (symbolic links followed; noFollow keeps the last one, for rm, mv, ls -l, readlink) */
  function resolvePath(session, p, noFollow) {
    p = String(p);
    if (p.charAt(0) === '~') p = './' + p;     // a literal ~ (quoted) is just a name
    var abs = session.vfs.normalize(p, session.cwd);
    var links = attrsOf(session.vfs).links;
    return links.size ? followLinks(session.vfs, abs, noFollow, links) : abs;
  }
  LAB.bus.on('fs:change', function (d) {
    var a = LAB.vfs.__termAttrs;
    if (!a || (!a.modes.size && !a.links.size)) return;
    function under(k, p) { return k === p || k.indexOf(p + '/') === 0; }
    [a.modes, a.links].forEach(function (map) {
      var keys = Array.from(map.keys());
      keys.forEach(function (k) {
        if (d.op === 'remove' && under(k, d.path)) map.delete(k);
        else if ((d.op === 'move' || d.op === 'rename') && d.from && under(k, d.from)) { var v = map.get(k); map.delete(k); map.set(d.path + k.slice(d.from.length), v); }
        else if (d.op === 'copy' && d.from && under(k, d.from)) map.set(d.path + k.slice(d.from.length), map.get(k));
      });
    });
  });
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
  /* names in columns, down then across (BSD ls). deco(i) may return an SGR code for name i; widths always use the plain names */
  function columns(names, cols, deco) {
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
        var code = deco ? deco(idx) : '';
        var shown = code ? sgr(code, nm) : nm;
        line += more ? shown + new Array(Math.max(0, colw - displayWidth(nm)) + 1).join(' ') : shown;
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
    var color = !!F.G && ctx.tty;
    var attrs = attrsOf(vfs);

    function isLink(st) { return attrs.links.has(st.path); }
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
    function kindOf(e) { return isLink(e.st) ? 'link' : e.st.type === 'dir' ? 'dir' : 'file'; }
    function isExec(e) { return e.st.type !== 'dir' && !isLink(e.st) && (modeOf(vfs, e.st) & 73) !== 0; }
    function label(e) {
      var k = kindOf(e);
      var suffix = F.F ? (k === 'dir' ? '/' : k === 'link' ? '@' : isExec(e) ? '*' : '') : (F.p && k === 'dir' ? '/' : '');
      return e.name + suffix;
    }
    function colorOf(e) {
      if (!color) return '';
      var k = kindOf(e);
      return k === 'dir' ? '34' : k === 'link' ? '35' : isExec(e) ? '31' : '';
    }
    function format(entries, withTotal) {
      if (!entries.length) return '';
      if (long) {
        var rows = entries.map(function (e) {
          var st = e.st, isDir = st.type === 'dir', lk = isLink(st);
          var rawSize = lk ? attrs.links.get(st.path).length : (isDir ? 64 + 32 * (st.count || 0) : st.size);
          var nm = label(e), code = colorOf(e);
          return {
            perm: modeString(modeOf(vfs, st), lk ? 'link' : isDir ? 'dir' : 'file'),
            nlink: String(isDir ? 2 + subdirCount(st.path) : 1),
            size: F.h ? humanSize(rawSize) : String(rawSize),
            date: LAB.util.fmt.lsDate(st.mtime), name: (code ? sgr(code, nm) : nm) + (lk ? ' -> ' + attrs.links.get(st.path) : ''),
            blocks: isDir || lk ? 0 : Math.ceil(st.size / 4096) * 8
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
      if (oneCol) return entries.map(function (e, i) { var c = colorOf(e); return c ? sgr(c, names[i]) : names[i]; }).join('\n') + '\n';
      return columns(names, s.cols || 80, function (i) { return colorOf(entries[i]); });
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
          if (e.st.type !== 'dir' || e.name === '.' || e.name === '..' || isLink(e.st)) return;
          listDir((arg === '/' ? '' : arg) + (arg.slice(-1) === '/' ? '' : '/') + e.name, e.st.path, true, false);
        });
      }
    }

    var files = [], dirs = [];
    ops.forEach(function (arg) {
      var abs = arg === '' ? null : resolvePath(s, arg, long || !!F.d);
      var st = abs === null ? null : vfs.stat(abs);
      if (!st) { ctx.err('ls: ' + arg + ': No such file or directory\n'); status = 1; return; }
      var lk = abs !== null && attrs.links.has(vfs.canon(abs));
      if (st.type === 'dir' && !F.d && !lk) dirs.push({ arg: arg, name: arg, st: st });
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
    s.env.OLDPWD = s.oldpwd;
    s.exported.add('OLDPWD');
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
  /* a yes/no question on the terminal (cp -i, mv -i, rm -i): only a reply that starts with y or Y says yes */
  function* askYes(text) {
    var a = yield { prompt: text };
    return a !== null && /^\s*[yY]/.test(String(a));
  }

  commands.cp = function* (args, ctx) {
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
    for (var si = 0; si < srcs.length; si++) {
      var arg = srcs[si];
      var abs = resolvePath(s, arg);
      var st = vfs.stat(abs);
      if (!st) { ctx.err('cp: ' + arg + ': No such file or directory\n'); status = 1; continue; }
      var finalDst = dstIsDir ? vfs.join(dst, st.name) : dst;
      var shown = dstIsDir ? dstArg.replace(/\/+$/, '') + '/' + st.name : dstArg;
      if (vfs.canon(abs) === vfs.canon(finalDst)) {
        ctx.err('cp: ' + arg + ' and ' + shown + ' are identical (not copied).\n');
        status = 1; continue;
      }
      if (st.type === 'dir' && !recursive) { ctx.err('cp: ' + arg + ' is a directory (not copied).\n'); status = 1; continue; }
      if (vfs.exists(finalDst) && !(st.type === 'dir' && vfs.isDir(finalDst))) {
        if (o.flags.n) continue;
        if (o.flags.i && !(yield* askYes('overwrite ' + shown + '? (y/n [n]) '))) continue;
      }
      try {
        var made = vfs.copy(abs, dst, { by: 'terminal', recursive: recursive });
        if (o.flags.v) {
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
    }
    return status;
  };

  commands.mv = function* (args, ctx) {
    var s = ctx.session, vfs = s.vfs;
    var o = parseOpts('mv', args);
    if (o.error) { ctx.err(o.error); return 1; }
    if (o.rest.length < 2) return usageResult(ctx, 'mv');
    var srcs = o.rest.slice(0, -1), dstArg = o.rest[o.rest.length - 1];
    var dst = resolvePath(s, dstArg);
    var dstIsDir = vfs.isDir(dst);
    if (srcs.length > 1 && !dstIsDir) { ctx.err('mv: ' + dstArg + ' is not a directory\n'); return 1; }
    var status = 0;
    for (var si = 0; si < srcs.length; si++) {
      var arg = srcs[si];
      var abs = resolvePath(s, arg, true);
      var st = vfs.stat(abs);
      var shownTo = dstIsDir ? dstArg.replace(/\/+$/, '') + '/' + (st ? st.name : vfs.basename(abs)) : dstArg;
      if (!st) { ctx.err('mv: rename ' + arg + ' to ' + shownTo + ': No such file or directory\n'); status = 1; continue; }
      var pk = protectedKind(s, abs);
      if (pk) { ctx.err('mv: refusing to move "' + arg + '" (practice Mac protects this folder)\n'); status = 1; continue; }
      var finalDst = dstIsDir ? vfs.join(dst, st.name) : dst;
      if (vfs.normalize(finalDst) === st.path) { ctx.err('mv: ' + arg + ' and ' + shownTo + ' are identical\n'); status = 1; continue; }
      if (vfs.exists(finalDst) && vfs.canon(finalDst) !== st.path) {
        if (o.flags.n) continue;
        if (o.flags.i && !o.flags.f && !(yield* askYes('overwrite ' + shownTo + '? (y/n [n]) '))) continue;
      }
      try {
        vfs.move(abs, dst, { by: 'terminal' });
        if (o.flags.v) ctx.out(arg + ' -> ' + shownTo + '\n');
      } catch (e) {
        ctx.err('mv: rename ' + arg + ' to ' + shownTo + ': ' + vfs.errText(e.code || 'EINVAL') + '\n');
        status = 1;
      }
    }
    return status;
  };

  commands.rm = function* (args, ctx) {
    var s = ctx.session, vfs = s.vfs;
    var o = parseOpts('rm', args);
    if (o.error) { ctx.err(o.error); return 1; }
    if (!o.rest.length) { if (o.flags.f) return 0; return usageResult(ctx, 'rm'); }
    var recursive = !!(o.flags.r || o.flags.R);
    var ask = !!o.flags.i && !o.flags.f;
    var status = 0;
    for (var ri = 0; ri < o.rest.length; ri++) {
      var arg = o.rest[ri];
      var last = arg.replace(/\/+$/, '').split('/').pop();
      if (last === '.' || last === '..') { ctx.err('rm: "." and ".." may not be removed\n'); status = 1; continue; }
      var abs = resolvePath(s, arg, true);
      var pk = protectedKind(s, abs);
      if (pk === 'root') { ctx.err('rm: "/" may not be removed\n'); status = 1; continue; }
      if (pk) { ctx.err('rm: refusing to remove "' + arg + '" (practice Mac protects this folder)\n'); status = 1; continue; }
      var st = vfs.stat(abs);
      if (!st) { if (!o.flags.f) { ctx.err('rm: ' + arg + ': No such file or directory\n'); status = 1; } continue; }
      if (st.type === 'dir' && !recursive) {
        if (o.flags.d) {
          if (ask && !(yield* askYes('remove ' + arg + '? '))) continue;
          try { vfs.remove(abs, { by: 'terminal' }); if (o.flags.v) ctx.out(arg + '\n'); }
          catch (e) { ctx.err('rm: ' + arg + ': ' + vfs.errText(e.code || 'ENOTEMPTY') + '\n'); status = 1; }
        } else { ctx.err('rm: ' + arg + ': is a directory\n'); status = 1; }
        continue;
      }
      try {
        if (ask) {
          // rm -i: every file is asked about; for a folder -ri asks about the folder, then each thing inside it, then the folder itself
          var nodes = [];
          if (st.type === 'dir') vfs.walk(abs, function (cs, depth) { nodes.push({ rel: cs.path.slice(st.path.length), path: cs.path, dir: cs.type === 'dir' }); });
          else nodes.push({ rel: '', path: abs, dir: false });
          if (st.type === 'dir' && !(yield* askYes('examine files in directory ' + arg + '? '))) continue;
          var shownBase = arg.replace(/\/+$/, '');
          var skipped = false;
          nodes.reverse();
          for (var ni = 0; ni < nodes.length; ni++) {
            var nd = nodes[ni];
            if (nd.rel === '' && st.type === 'dir') {
              if (skipped) continue;
              if (!(yield* askYes('remove ' + shownBase + '? '))) continue;
              vfs.remove(nd.path, { by: 'terminal', recursive: true });
              if (o.flags.v) ctx.out(shownBase + '\n');
              continue;
            }
            if (!(yield* askYes('remove ' + shownBase + nd.rel + '? '))) { skipped = true; continue; }
            if (vfs.exists(nd.path)) vfs.remove(nd.path, { by: 'terminal', recursive: true });
            if (o.flags.v) ctx.out(shownBase + nd.rel + '\n');
          }
          continue;
        }
        if (o.flags.v) {
          var list = [];
          if (st.type === 'dir') vfs.walk(abs, function (cs, depth) { list.push({ rel: cs.path.slice(st.path.length), depth: depth }); });
          list.reverse().forEach(function (e) { ctx.out(arg.replace(/\/+$/, '') + e.rel + '\n'); });
          if (st.type !== 'dir') ctx.out(arg + '\n');
        }
        vfs.remove(abs, { by: 'terminal', recursive: true });
      } catch (e2) { ctx.err('rm: ' + arg + ': ' + vfs.errText(e2.code || 'EINVAL') + '\n'); status = 1; }
    }
    return status;
  };

  commands.rmdir = function (args, ctx) {
    var s = ctx.session, vfs = s.vfs;
    var o = parseOpts('rmdir', args);
    if (o.error) { ctx.err(o.error); return 1; }
    if (!o.rest.length) return usageResult(ctx, 'rmdir');
    var status = 0;
    o.rest.forEach(function (arg) {
      var abs = resolvePath(s, arg, true);
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
      var n = 10, i = 0, usageLines = USAGE[which], follow = false;
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
        if (which === 'tail' && (a.indexOf('f') > 0 || a.indexOf('F') > 0)) follow = true;
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
      // tail -f: keep watching the (single) file until Ctrl+C; whatever is appended meanwhile is printed
      if (follow && files.length === 1 && status === 0) {
        var fabs = resolvePath(s, files[0]);
        var seen = vfs.stat(fabs) && vfs.stat(fabs).kind === 'text' ? vfs.readFile(fabs, { by: 'terminal' }) : '';
        for (;;) {
          yield { sleep: 1000 };
          var now = vfs.stat(fabs) && vfs.stat(fabs).kind === 'text' ? vfs.readFile(fabs, { by: 'terminal' }) : seen;
          if (now !== seen) { ctx.out(now.indexOf(seen) === 0 ? now.slice(seen.length) : now); seen = now; }
        }
      }
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
    if (flags.indexOf('a') >= 0) ctx.out('Darwin MacBook-Air.local 25.0.0 Darwin Kernel Version 25.0.0: Mon Aug 25 21:17:51 PDT 2025; root:xnu-12377.1.9~2/RELEASE_ARM64_T8122 arm64\n');
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
    yield { sleep: ms };
    return 0;
  };
  /* ------------------------------------------------------ builtins that change the shell */
  function quoteAliasValue(v) { return /^[A-Za-z0-9_.\/-]+$/.test(v) ? v : "'" + v.replace(/'/g, "'\\''") + "'"; }
  commands.alias = function (args, ctx) {
    var al = ctx.session.aliases;
    var list = args.filter(function (a) { return a !== '--'; });
    if (!list.length) { Object.keys(al).sort().forEach(function (k) { ctx.out(k + '=' + quoteAliasValue(al[k]) + '\n'); }); return 0; }
    var status = 0;
    list.forEach(function (a) {
      var eq = a.indexOf('=');
      if (eq < 0) { if (hasOwn.call(al, a)) ctx.out(a + '=' + quoteAliasValue(al[a]) + '\n'); else status = 1; return; }
      var nm = a.slice(0, eq);
      if (!nm || /[\s=\/$`'"|&;<>()]/.test(nm)) { ctx.err('alias: invalid alias name: ' + nm + '\n'); status = 1; return; }
      al[nm] = a.slice(eq + 1);
    });
    return status;
  };
  commands.unalias = function (args, ctx) {
    var al = ctx.session.aliases, status = 0;
    var list = args.filter(function (a) { return a !== '--'; });
    if (!list.length) { ctx.err('unalias: not enough arguments\n'); return 1; }
    list.forEach(function (a) {
      if (a === '-a') { Object.keys(al).forEach(function (k) { delete al[k]; }); return; }
      if (hasOwn.call(al, a)) delete al[a]; else { ctx.err('unalias: no such hash table element: ' + a + '\n'); status = 1; }
    });
    return status;
  };
  commands['export'] = function (args, ctx) {
    var s = ctx.session;
    var list = args.filter(function (a) { return a !== '--' && !/^-[pnf]+$/.test(a); });
    if (!list.length) {
      Object.keys(s.env).filter(function (k) { return s.exported.has(k); }).sort().forEach(function (k) { ctx.out(k + '=' + s.env[k] + '\n'); });
      return 0;
    }
    var status = 0;
    list.forEach(function (a) {
      var eq = a.indexOf('='), nm = eq < 0 ? a : a.slice(0, eq);
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(nm)) { ctx.err('export: not valid in this context: ' + a + '\n'); status = 1; return; }
      if (eq >= 0) s.env[nm] = a.slice(eq + 1); else if (!hasOwn.call(s.env, nm)) s.env[nm] = '';
      s.exported.add(nm);
    });
    return status;
  };
  commands.unset = function (args, ctx) {
    var s = ctx.session;
    args.forEach(function (a) { if (a.charAt(0) === '-') return; delete s.env[a]; s.exported.delete(a); });
    return 0;
  };
  commands.set = function (args, ctx) {
    var s = ctx.session;
    if (args.length) return 0;                                  // set -x, set -e … are accepted and ignored
    Object.keys(s.env).sort().forEach(function (k) { ctx.out(k + '=' + s.env[k] + '\n'); });
    return 0;
  };
  commands.source = function* (args, ctx) {
    if (!args.length) { ctx.err('source: not enough arguments\n'); return 1; }
    var s = ctx.session, abs = resolvePath(s, args[0]), st = s.vfs.stat(abs);
    if (!st) { ctx.err('source: no such file or directory: ' + args[0] + '\n'); return 1; }
    if (st.type === 'dir') { ctx.err('source: ' + args[0] + ': Is a directory\n'); return 1; }
    if (st.kind !== 'text') { ctx.err('source: ' + args[0] + ': 這是二進位檔案，練習版不能執行\n'); return 1; }
    return yield* ctx.runLine(s.vfs.readFile(abs, { by: 'terminal' }));
  };
  commands['.'] = commands.source;
  commands.eval = function* (args, ctx) {
    if (!args.length) return 0;
    return yield* ctx.runLine(args.join(' '));
  };

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
  var KNOWN_MAC_APPS = ['safari', 'preview', 'notes', 'mail', 'calendar', 'messages', 'photos', 'music', 'maps', 'system settings', 'system preferences', 'google chrome', 'chrome', 'firefox', 'microsoft word', 'word', 'excel', 'powerpoint', 'numbers', 'pages', 'keynote', 'facetime', 'reminders', 'contacts', 'calculator', 'textedit', 'activity monitor'];
  /* names a student types for the apps the practice Mac got in round 5 (the apps register their own titles too) */
  var APP_NAMES = { 'safari': 'safari', 'system settings': 'settings', 'system preferences': 'settings', '系統設定': 'settings', 'calculator': 'calculator', '計算機': 'calculator',
    'activity monitor': 'activity', '活動監視器': 'activity', 'preview': 'preview', '預覽程式': 'preview', 'terminal': 'terminal', '終端機': 'terminal' };
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
    if (!found && hasOwn.call(APP_NAMES, want) && LAB.apps.get(APP_NAMES[want])) found = APP_NAMES[want];
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
      if (a === '-u') { if (args[i + 1] !== undefined) targets.push(args[i + 1]); i++; continue; }
      if (a === '-b' || a === '-s') { i++; continue; }
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
      if (/^[a-z][a-z0-9+.-]*:\/\//i.test(t) || /^mailto:/i.test(t)) {
        // a web address goes to Safari (the practice browser: it has no network, SPEC §1)
        var web = appId || 'safari';
        if (LAB.apps && LAB.apps.get(web) && (web === 'safari' || appId)) ctx.effect({ type: 'launch', appId: web, args: { url: t } });
        else { ctx.err('（練習版沒有瀏覽器，不能打開網址）\n'); status = 1; }
        return;
      }
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
  /* real Mac commands the practice does not simulate: a short lab-only line, never "command not found" (the lab must not teach that they do not exist) */
  /* (the first names are the ones terminal-cmds.js adds: until that file has arrived, or if it never does, they answer with the same lab line) */
  var TIER2 = ['grep', 'egrep', 'fgrep', 'find', 'chmod', 'ln', 'readlink', 'diff', 'sort', 'uniq', 'cut', 'tr', 'file', 'stat', 'du', 'df', 'basename', 'dirname', 'realpath', 'tee', 'xargs', 'zip', 'tar',
    'less', 'more', 'nano', 'man', 'pbcopy', 'pbpaste', 'say', 'code', 'codex', 'mdfind', 'sh', 'bash', 'zsh', 'test', '[', 'printf', 'seq', 'expr', 'bc', 'yes', 'whereis', 'type', 'whence', 'command', 'env', 'printenv', 'help',
    'cal', 'uptime', 'id', 'sw_vers', 'sysctl', 'system_profiler', 'xcode-select', 'ps', 'top', 'kill', 'killall', 'ifconfig', 'ipconfig', 'networksetup', 'ping', 'curl', 'nslookup', 'traceroute', 'python3',
    'chown', 'ssh', 'scp', 'gzip', 'gunzip', 'sed', 'awk', 'ping6', 'netstat', 'lsof', 'rev', 'mktemp', 'nl', 'od', 'xxd', 'cmp', 'jobs', 'fg', 'bg', 'wait', 'read', 'local', 'exec', 'trap', 'umask', 'ulimit',
    'diskutil', 'defaults', 'osascript', 'screencapture', 'launchctl', 'pmset', 'caffeinate', 'softwareupdate', 'vim', 'vi', 'emacs', 'perl', 'ruby', 'make', 'clang', 'gcc', 'cc', 'swift', 'rsync', 'ftp', 'telnet', 'nc', 'dig', 'host', 'whois', 'last', 'who', 'w', 'groups', 'passwd', 'su', 'crontab', 'at', 'nohup', 'nice', 'renice', 'strings', 'hexdump', 'shasum', 'md5', 'openssl', 'base64', 'cksum', 'column', 'fold', 'paste', 'comm', 'join', 'split', 'expand', 'unexpand', 'tac', 'lipo', 'otool', 'ditto', 'plutil', 'sqlite3', 'ps2pdf', 'time'];
  var TIER3 = ['node', 'npm', 'npx', 'brew', 'pip', 'pip3', 'tree', 'wget', 'python', 'conda', 'java', 'go', 'cargo', 'rustc', 'docker', 'code-insiders'];

  /* what ./script.sh does: a file with the execute permission is run line by line (the #! line is only a comment) */
  function scriptRunner(abs, typed) {
    return function* (args, ctx) {
      var s = ctx.session, vfs = s.vfs;
      var text = vfs.readFile(abs, { by: 'terminal' });
      var saved = {};
      for (var k = 0; k < 9; k++) saved[k] = hasOwn.call(s.env, String(k)) ? s.env[String(k)] : undefined;
      s.env['0'] = typed;
      args.forEach(function (a, idx) { if (idx < 9) s.env[String(idx + 1)] = a; });
      try { return yield* ctx.runLine(text.replace(/^#!.*\n?/, '')); }
      finally { Object.keys(saved).forEach(function (k) { if (saved[k] === undefined) delete s.env[k]; else s.env[k] = saved[k]; }); }
    };
  }

  /* resolveCommand(name, session) -> {fn} | {msg, status} */
  function resolveCommand(name, session) {
    if (hasOwn.call(commands, name)) return { fn: commands[name] };
    if (name.indexOf('/') >= 0) {
      var m = /^\/(?:usr\/)?(?:s?bin)\/([^\/]+)$/.exec(name);
      if (m && hasOwn.call(commands, m[1])) return { fn: commands[m[1]] };
      var abs = resolvePath(session, name);
      var st = session.vfs.stat(abs);
      if (st) {
        if (st.type === 'file' && st.kind === 'text' && (modeOf(session.vfs, st) & 73) !== 0) return { fn: scriptRunner(abs, name) };
        return { msg: 'zsh: permission denied: ' + name, status: 126 };
      }
      return { msg: 'zsh: no such file or directory: ' + name, status: 127 };
    }
    if (name === 'sudo') return { msg: 'sudo: this practice Mac does not allow sudo', status: 1 };
    if (name === 'git') return { msg: 'xcode-select: note: No developer tools were found, requesting install.', status: 1 };
    if (TIER2.indexOf(name) >= 0) return { msg: name + ': 這個指令真的 Mac 上有，但練習版還沒做', status: 1 };
    return { msg: 'zsh: command not found: ' + name, status: 127 };
  }

  /* ------------------------------------------------------------- executor */
  var OUT_CAP = 120000;
  function newJob(src, session) {
    return {
      src: src, cwd0: session.cwd, cmds: [], current: null, totalOut: '', stepOut: '', stream: [], effects: [], pendingSub: null,
      /* text for the screen; the copy kept for events and tests has no colour codes */
      print: function (s) {
        if (!s) return;
        var plain = stripAnsi(s);
        if (this.totalOut.length < OUT_CAP) this.totalOut += plain;
        this.stepOut += plain;
        var l = this.stream;
        if (typeof l[l.length - 1] === 'string') l[l.length - 1] += s; else l.push(s);
      },
      /* screen only (an expanded `!!` is shown, but it is not output of the line) */
      echo: function (s) {
        var l = this.stream;
        if (typeof l[l.length - 1] === 'string') l[l.length - 1] += s; else l.push(s);
      },
      pushEffect: function (e) { this.effects.push(e); this.stream.push(e); }
    };
  }
  function addEntryOut(entry, s) { if (entry.out.length < OUT_CAP) entry.out += s; }

  var COMPOUND = ['for', 'while', 'until', 'if', 'case', 'select', 'function', 'foreach', 'repeat', 'time', 'coproc', '{', '}', '[[', 'do', 'done', 'then', 'fi', 'esac', 'elif', 'else'];
  function assignName(tok) {
    var p0 = tok.parts[0];
    if (!p0 || p0.k !== 'lit' || p0.q !== 0) return null;
    var m = /^([A-Za-z_][A-Za-z0-9_]*)=/.exec(p0.s);
    return m ? m[1] : null;
  }
  /* the value of `NAME=value`: no splitting, no globbing */
  function assignValue(tok, nameLen, session, job) {
    var out = '';
    tok.parts.forEach(function (p, idx) {
      if (p.k === 'var') out += varValue(session, p);
      else if (p.k === 'sub') out += p.arith ? arithValue(p.src, session, job) : runSubstitution(p.src, session, job);
      else if (idx === 0) { var rest = p.s.slice(nameLen + 1); out += (rest.charAt(0) === '~' && (rest.length === 1 || rest.charAt(1) === '/')) ? session.env.HOME + rest.slice(1) : rest; }
      else out += p.s;
    });
    return out;
  }

  /* `$((1+2))`: the text may use $VAR and bare names; a mistake prints zsh's message and gives 0 */
  function arithValue(src, session, job) {
    try {
      var v = calcEval(src.replace(/\$\{?([A-Za-z_][A-Za-z0-9_]*)\}?/g, '$1'), { get: function (n) { return hasOwn.call(session.env, n) ? session.env[n] : '0'; } });
      return String(Math.abs(v) < 1e15 ? Math.round(v * 1e10) / 1e10 : v);
    } catch (e) {
      job.print(e.message === 'division by zero' ? 'zsh: division by zero\n' : 'zsh: bad math expression: ' + src + '\n');
      return '0';
    }
  }

  /* `$(…)` and backticks: run the text as a line and hand back what it printed (trailing newlines cut). The commands it ran are
     queued in job.pendingSub and join the line's cmds[] right after the command that used them. */
  function runSubstitution(src, session, job) {
    var lx = lex(src);
    if (lx.incomplete || lx.unsupported || lx.parseError) { job.print('zsh: parse error in command substitution\n'); return ''; }
    var ast = parse(lx.tokens);
    if (ast.error !== undefined || !ast.items.length) return '';
    var sub = newJob(src, session);
    var cwd = session.cwd, old = session.oldpwd, pwd = session.env.PWD, st = session.status;
    var cap = { capture: true, out: '' };
    var gen = execAst(ast, session, sub, cap);
    var r = gen.next(), guard = 0;
    while (!r.done && guard++ < 3000) {
      var v = r.value || {};
      r = gen.next(v.prompt !== undefined ? null : undefined);       // nobody to ask: end of input
    }
    session.cwd = cwd; session.oldpwd = old; session.env.PWD = pwd; session.status = st;
    sub.stream.forEach(function (it) { if (typeof it === 'string') job.print(it); else job.pushEffect(it); });
    job.pendingSub = (job.pendingSub || []).concat(sub.cmds);
    return cap.out.replace(/\n+$/, '');
  }

  function failEntry(job, session, cmd, text) {
    var e = { name: cmd.words.length ? cmd.words[0].raw : '', args: [], cwd: session.cwd, cwdAfter: session.cwd, status: 1, out: text };
    job.cmds.push(e);
    job.print(text);
    return 1;
  }

  function* execSimple(cmd, session, job, opt) {
    var vfs = session.vfs;
    var ai = 0, wi;
    while (ai < cmd.words.length && assignName(cmd.words[ai])) ai++;
    var pre = [];
    for (wi = 0; wi < ai; wi++) {
      var nm = assignName(cmd.words[wi]);
      pre.push({ name: nm, value: assignValue(cmd.words[wi], nm.length, session, job) });
    }
    var args = [];
    for (wi = ai; wi < cmd.words.length; wi++) {
      var ex = expandWord(cmd.words[wi], session, job);
      if (ex.error) return failEntry(job, session, cmd, ex.error + '\n');
      args = args.concat(ex.words);
    }
    // redirect targets
    var redirs = [];
    for (var ri = 0; ri < cmd.redirs.length; ri++) {
      var rd = cmd.redirs[ri];
      if (rd.op === '<<<') {
        var hs = expandWord(rd.target, session, job);
        if (hs.error) { job.print(hs.error + '\n'); return 1; }
        redirs.push({ op: rd.op, fd: 0, text: hs.words.join(' ') + '\n' });
        continue;
      }
      var rx = expandWord(rd.target, session, job);
      if (rx.error) { job.print(rx.error + '\n'); return 1; }
      if (rx.words.length !== 1) { job.print('zsh: ambiguous redirect\n'); return 1; }
      redirs.push({ op: rd.op, fd: rd.fd, path: rx.words[0] });
    }
    var mergeErr = cmd.dups.some(function (d) { return d.from === 2 && d.to === 1; });
    var outToErr = cmd.dups.some(function (d) { return d.from === 1 && d.to === 2; });
    var stdoutR = [], stderrR = [], stdinR = null;
    redirs.forEach(function (r) {
      if (r.op === '<' || r.op === '<<<') stdinR = r;
      else if (r.op === '&>' || r.op === '&>>') { stdoutR.push(r); stderrR.push(r); }
      else if (r.fd === 2) stderrR.push(r);
      else stdoutR.push(r);
    });

    function writeTo(r, text) {
      if (r.path === '/dev/null' || r.path === '/dev/stdout' || r.path === '/dev/stderr' || r.path === '/dev/tty') {
        if (r.path !== '/dev/null') job.print(text);
        return;
      }
      if (r.path === '') { job.print('zsh: no such file or directory: \n'); return; }
      var abs = resolvePath(session, r.path);
      try {
        if (vfs.isDir(abs)) throw new vfs.VfsError('EISDIR', r.path);
        vfs.writeFile(abs, text, { by: 'terminal', append: r.op === '>>' || r.op === '&>>' });
      } catch (e) {
        var code = e.code || 'EINVAL';
        var msg = code === 'ENOENT' ? 'no such file or directory' : code === 'EISDIR' ? 'is a directory' : code === 'ENOTDIR' ? 'not a directory' : vfs.errText(code).toLowerCase();
        job.print('zsh: ' + msg + ': ' + r.path + '\n');
      }
    }
    function writeAll(list, text) {
      list.forEach(function (r, idx) { writeTo(r, idx === list.length - 1 ? text : ''); });
    }

    if (!args.length) {
      if (pre.length) pre.forEach(function (a) { session.env[a.name] = a.value; });
      writeAll(stdoutR, '');
      return 0;
    }

    var name = args[0], cargs = args.slice(1);
    if (cmd.words[ai] && cmd.words[ai].parts.length === 1 && cmd.words[ai].parts[0].q === 0 && COMPOUND.indexOf(name) >= 0) {
      return failEntry(job, session, cmd, '（練習版還沒有做這種寫法：' + name + '）\n');
    }
    // stdin: `< file` or `<<< text`
    var stdin = opt.stdin;
    if (stdinR) {
      if (stdinR.text !== undefined) stdin = stdinR.text;
      else if (stdinR.path === '/dev/null') stdin = '';
      else {
        var sp = resolvePath(session, stdinR.path), sst = vfs.stat(sp);
        if (!sst) { job.print('zsh: no such file or directory: ' + stdinR.path + '\n'); return 1; }
        if (sst.type === 'dir') { job.print('zsh: is a directory: ' + stdinR.path + '\n'); return 1; }
        stdin = sst.kind === 'text' ? vfs.readFile(sp, { by: 'terminal' }) : '';
      }
    }
    // NAME=value command: the variables only live as long as the command
    var saved = null;
    if (pre.length) {
      saved = {};
      pre.forEach(function (a) {
        saved[a.name] = hasOwn.call(session.env, a.name) ? { v: session.env[a.name], x: session.exported.has(a.name) } : null;
        session.env[a.name] = a.value;
        session.exported.add(a.name);                      // the command sees it in its environment
      });
    }
    var res;
    try {
      res = yield* runCommand(name, cargs, session, job, {
        stdin: stdin, tty: !!opt.tty && !stdoutR.length && !outToErr,
        errMode: mergeErr ? 'stdout' : (stderrR.length ? 'file' : 'tty'), outToErr: outToErr, capture: opt.capture
      });
    } finally {
      if (saved) Object.keys(saved).forEach(function (k) {
        if (saved[k]) { session.env[k] = saved[k].v; if (!saved[k].x) session.exported.delete(k); }
        else { delete session.env[k]; session.exported.delete(k); }
      });
    }
    var stdout = res.stdout, errText = res.errText;
    if (stdoutR.length) {
      if (opt.capture) opt.capture.out = opt.capture.out.slice(0, opt.capture.out.length - res.stdout.length);
      var both = stderrR.some(function (r) { return r.op === '&>' || r.op === '&>>'; });
      writeAll(stdoutR, stdout + (both ? errText : ''));
      stdout = '';
    }
    var fileErr = stderrR.filter(function (r) { return r.op !== '&>' && r.op !== '&>>'; });
    if (fileErr.length) writeAll(fileErr, errText);
    return { status: res.status, stdout: stdout };
  }

  /* one resolved command: name + arguments (also used by xargs, which builds its own argument lists) */
  function* runCommand(name, cargs, session, job, io) {
    var vfs = session.vfs;
    var entry = { name: name, args: cargs, cwd: session.cwd, cwdAfter: session.cwd, status: 0, out: '' };
    job.cmds.push(entry);
    if (job.pendingSub) { job.cmds.push.apply(job.cmds, job.pendingSub); job.pendingSub = null; }
    job.current = entry;
    var toTty = !!io.tty;
    var buf = '', errBuf = '';
    var ctx = {
      session: session, vfs: vfs, name: name, args: cargs, stdin: io.stdin === undefined ? null : io.stdin, tty: toTty, job: job,
      out: function (s) {
        if (!s) return;
        if (io.outToErr) { ctx.err(s); return; }
        if (toTty) { addEntryOut(entry, stripAnsi(s)); job.print(s); }
        else { var p = stripAnsi(s); addEntryOut(entry, p); buf += p; }
      },
      err: function (s) {
        if (!s) return;
        addEntryOut(entry, stripAnsi(s));
        if (io.errMode === 'stdout') { if (toTty) job.print(s); else buf += stripAnsi(s); }
        else if (io.errMode === 'file') errBuf += stripAnsi(s);
        else job.print(s);
      },
      effect: function (e) { job.pushEffect(e); },
      abs: function (p) { return resolvePath(session, p); },
      /* run another line in this shell (source, sh -c, scripts, eval); its commands join the line's cmds[] */
      runLine: function (src) { return execSource(src, session, job, ctx); }
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
        if (rc.effect) job.pushEffect(rc.effect);
      }
    } finally {
      entry.cwdAfter = session.cwd;
    }
    entry.status = status;
    session.status = status;
    if (io.capture) io.capture.out += buf;
    return { status: status, stdout: buf, errText: errBuf };
  }

  /* run source text (a script, `source`, `sh -c`) with the same job */
  function* execSource(src, session, job, ctx) {
    var lx = lex(src);
    if (lx.incomplete) { ctx.err('zsh: parse error: unmatched quote\n'); return 1; }
    if (lx.unsupported || lx.parseError) { ctx.err(lx.unsupported ? '（練習版還沒有做這種寫法：' + lx.unsupported + '）\n' : "zsh: parse error near `" + lx.parseError + "'\n"); return 1; }
    var ast = parse(lx.tokens);
    if (ast.error !== undefined) { ctx.err("zsh: parse error near `" + ast.error + "'\n"); return 1; }
    return yield* execAst(ast, session, job, null);
  }

  function* execPipeline(pipe, session, job, opt) {
    var input = null, status = 0;
    for (var i = 0; i < pipe.length; i++) {
      var isLast = i === pipe.length - 1;
      var cap = isLast && opt && opt.capture ? opt : null;
      var r = yield* execSimple(pipe[i], session, job, { stdin: input, tty: isLast && !cap, capture: cap });
      if (typeof r === 'number') { status = r; input = ''; }
      else { status = r.status; input = r.stdout; }
      session.status = status;
    }
    return status;
  }

  function* execAst(ast, session, job, opt) {
    var last = session.status;
    for (var i = 0; i < ast.items.length; i++) {
      var it = ast.items[i];
      if (it.conn === '&&' && last !== 0) continue;
      if (it.conn === '||' && last === 0) continue;
      last = yield* execPipeline(it.pipe, session, job, opt);
      session.status = last;
    }
    return last;
  }

  /* ------------------------------------------------------ aliases, history */
  function expandAliases(toks, session) {
    var al = session.aliases;
    if (!al) return toks;
    var any = false;
    for (var k in al) { any = true; break; }
    if (!any) return toks;
    function plainName(tok) {
      return tok.t === 'word' && tok.parts.length === 1 && tok.parts[0].k === 'lit' && tok.parts[0].q === 0 && !tok.parts[0].tilde ? tok.parts[0].s : null;
    }
    function expandWordTok(tok, used, depth) {
      var nm = plainName(tok);
      if (nm === null || !hasOwn.call(al, nm) || used.indexOf(nm) >= 0 || depth > 6) return [tok];
      var sub = lex(al[nm]);
      if (sub.incomplete || sub.unsupported || sub.parseError || !sub.tokens.length) return [tok];
      var res = sub.tokens.slice();
      // the first word of the replacement may itself be an alias (but never the same one again)
      if (res[0].t === 'word') res = expandWordTok(res[0], used.concat([nm]), depth + 1).concat(res.slice(1));
      return res;
    }
    var out = [], cmdPos = true, skipTarget = false;
    toks.forEach(function (t) {
      if (t.t === 'op') {
        out.push(t);
        if (t.op === ';' || t.op === 'nl' || t.op === '&&' || t.op === '||' || t.op === '|') cmdPos = true;
        else if (t.op === '>' || t.op === '>>' || t.op === '<' || t.op === '<<<' || t.op === '&>' || t.op === '&>>') skipTarget = true;
        return;
      }
      if (skipTarget) { skipTarget = false; out.push(t); return; }
      if (cmdPos) {
        if (assignName(t)) { out.push(t); return; }
        var ex = expandWordTok(t, [], 0);
        ex.forEach(function (x) { out.push(x); });
        cmdPos = false;
        return;
      }
      out.push(t);
    });
    return out;
  }

  /* !! !$ !^ !* !n !-n !str (zsh expands these before it reads the line, and shows the result) -> {line, changed} | {error} */
  function expandHistory(src, session) {
    if (src.indexOf('!') < 0) return { line: src, changed: false };
    var hist = session.history, out = '', i = 0, changed = false, inSingle = false;
    function lastWords() { var h = hist.length ? hist[hist.length - 1] : ''; var lx = lex(h); return lx.tokens.filter(function (t) { return t.t === 'word'; }).map(function (t) { return t.raw; }); }
    while (i < src.length) {
      var c = src.charAt(i);
      if (c === '\\' && i + 1 < src.length) { out += c + src.charAt(i + 1); i += 2; continue; }
      if (c === "'") { inSingle = !inSingle; out += c; i++; continue; }
      if (c !== '!' || inSingle) { out += c; i++; continue; }
      var rest = src.slice(i + 1), m;
      var rep = null, used = 1;
      if (rest.charAt(0) === '!') { if (!hist.length) return { error: 'zsh: event not found: !' }; rep = hist[hist.length - 1]; used = 2; }
      else if (rest.charAt(0) === '$') { var w = lastWords(); if (!hist.length) return { error: 'zsh: event not found: !$' }; rep = w.length ? w[w.length - 1] : ''; used = 2; }
      else if (rest.charAt(0) === '^') { var w2 = lastWords(); rep = w2.length > 1 ? w2[1] : ''; used = 2; }
      else if (rest.charAt(0) === '*') { var w3 = lastWords(); rep = w3.slice(1).join(' '); used = 2; }
      else if ((m = /^-(\d+)/.exec(rest))) { var k = hist.length - parseInt(m[1], 10); if (k < 0 || k >= hist.length) return { error: 'zsh: event not found: -' + m[1] }; rep = hist[k]; used = 1 + m[0].length; }
      else if ((m = /^(\d+)/.exec(rest))) { var n = parseInt(m[1], 10) - 1; if (n < 0 || n >= hist.length) return { error: 'zsh: event not found: ' + m[1] }; rep = hist[n]; used = 1 + m[0].length; }
      else if ((m = /^([A-Za-z_.\/][^\s;&|<>()"']*)/.exec(rest))) {
        var found = null;
        for (var h2 = hist.length - 1; h2 >= 0; h2--) if (hist[h2].indexOf(m[1]) === 0) { found = hist[h2]; break; }
        if (found === null) return { error: 'zsh: event not found: ' + m[1] };
        rep = found; used = 1 + m[0].length;
      }
      if (rep === null) { out += c; i++; continue; }
      out += rep; i += used; changed = true;
    }
    return { line: out, changed: changed };
  }

  /* ------------------------------------------------------ session and run */
  var sessionCounter = 0;
  var DEFAULT_PATH = '/usr/local/bin:/System/Cryptexes/App/usr/bin:/usr/bin:/bin:/usr/sbin:/sbin:/var/run/com.apple.security.cryptexd/codex.system/bootstrap/usr/local/bin:/var/run/com.apple.security.cryptexd/codex.system/bootstrap/usr/bin:/var/run/com.apple.security.cryptexd/codex.system/bootstrap/usr/appleinternal/bin';
  function newSession(o) {
    o = o || {};
    var cwd = o.cwd || HOME;
    var tty = o.tty === undefined ? 0 : o.tty;
    var al = Object.create(null);
    al['run-help'] = 'man';
    al['which-command'] = 'whence';
    var s = {
      id: 's' + (++sessionCounter), cwd: cwd, oldpwd: null,
      env: {
        HOME: HOME, USER: 'an', SHELL: '/bin/zsh', PATH: DEFAULT_PATH, PWD: cwd, HOSTNAME: 'MacBook-Air.local', HOST: 'MacBook-Air.local', LOGNAME: 'an',
        TERM: 'xterm-256color', TERM_PROGRAM: 'Apple_Terminal', TERM_PROGRAM_VERSION: '455', TERM_SESSION_ID: 'A1B2C3D4-5E6F-4A7B-8C9D-0E1F2A3B4C5D',
        LANG: 'zh_TW.UTF-8', TMPDIR: '/var/folders/zz/zyxvpxvq6csfxvn_n0000000000000/T/', XPC_FLAGS: '0x0', XPC_SERVICE_NAME: '0',
        SSH_AUTH_SOCK: '/private/tmp/com.apple.launchd.9xKq3vB2tm/Listeners', __CF_USER_TEXT_ENCODING: '0x1F5:0x0:0x0', LC_CTYPE: 'zh_TW.UTF-8'
      },
      exported: null,
      status: 0, history: [], cols: o.cols || 80, tty: tty, vfs: o.vfs || LAB.vfs,
      prompt: null, pending: null, ps2: null, alive: true, gen: null, job: null, sleeping: null, appActive: null,
      aliases: al, rng: makeRng(20261002 + sessionCounter * 7), pid: 5001 + tty * 10, startMs: LAB.clock.ms()
    };
    s.exported = new Set(['HOME', 'USER', 'SHELL', 'PATH', 'PWD', 'LOGNAME', 'TERM', 'TERM_PROGRAM', 'TERM_PROGRAM_VERSION', 'TERM_SESSION_ID', 'LANG', 'TMPDIR', 'XPC_FLAGS', 'XPC_SERVICE_NAME', 'SSH_AUTH_SOCK', '__CF_USER_TEXT_ENCODING', 'LC_CTYPE']);
    return s;
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

  function advance(session, input, first) {
    var job = session.job;
    if (!first) { job.stepOut = ''; job.effects = []; job.stream = []; }
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
        job.pushEffect({ type: 'sleep', ms: v.sleep });
      } else if (v.app) {
        session.appActive = v.app;
        job.pushEffect({ type: 'app', app: v.app });
      }
      return stepResult(session, job, false);
    }
    session.gen = null; session.job = null; session.sleeping = null; session.prompt = null; session.appActive = null;
    return stepResult(session, job, true);
  }

  function run(line, session) {
    if (!session.alive) return emptyResult(session);
    if (session.prompt) return session.prompt.onLine(line);
    if (session.sleeping || session.appActive) return emptyResult(session);
    var src = String(line), echo = false;
    if (session.pending !== null) src = session.pending + '\n' + src;
    else if (src.indexOf('!') >= 0) {
      var he = expandHistory(src, session);
      if (he.error) {
        var jh = newJob(src, session);
        jh.print(he.error + '\n');
        session.status = 1;
        return stepResult(session, jh, true);
      }
      if (he.changed) { src = he.line; echo = true; }
    }
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
    if (echo) job.echo(src + '\n');
    var msg = null;
    if (lx.unsupported) msg = '（練習版還沒有做這種寫法：' + lx.unsupported + '）';
    else if (lx.parseError) msg = "zsh: parse error near `" + lx.parseError + "'";
    var ast = null;
    if (!msg) {
      ast = parse(expandAliases(lx.tokens, session));
      if (ast.error !== undefined) msg = "zsh: parse error near `" + ast.error + "'";
    }
    if (msg) {
      job.print(msg + '\n');
      session.status = 1;
      return stepResult(session, job, true);
    }
    if (!ast.items.length) return emptyResult(session);
    session.job = job;
    session.gen = execAst(ast, session, job, null);
    return advance(session, undefined, true);
  }

  /* the renderer's sleep timer ended, or a full-screen program finished (value = what it returned) */
  function resume(session, value) {
    if (!session.gen) return null;
    session.sleeping = null; session.appActive = null;
    return advance(session, value);
  }
  /* Ctrl+C while something is running (sleep, a question, stdin mode) or an unfinished line */
  function cancel(session) {
    if (session.gen) {
      var job = session.job;
      if (job.current) job.current.status = 130;
      session.status = 130;
      job.stepOut = ''; job.effects = []; job.stream = [];
      try { session.gen.return(); } catch (e) { /* ignore */ }
      session.gen = null; session.job = null; session.sleeping = null; session.prompt = null; session.appActive = null;
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
      var seenName = {};
      Object.keys(commands).concat(Object.keys(session.aliases || {})).sort().forEach(function (n) {
        if (n.indexOf(sc.plain) !== 0 || seenName[n] || !/^[A-Za-z]/.test(n)) return;
        seenName[n] = true;
        found.push({ name: n, dir: false });
      });
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
      var dirsOnly = sc.cmdName === 'cd' || sc.cmdName === 'rmdir';
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

  /* ------------------------------------------------------------------ processes
     ps, top, kill and killall read the same fake process table (SPEC §1): the apps that are really open, plus system processes.
     PIDs never change; CPU % wobbles a little on every query, from a seeded generator, so it is the same sequence every visit.
     LAB.procs is also meant for the Activity Monitor (SYS-MAC): list() and kill(pid) are its whole interface. */
  var SYS_PROCS = [
    // pid, ppid, user, name, path, cpu%, memMB, threads
    [1, 0, 'root', 'launchd', '/sbin/launchd', 0.5, 17, 4],
    [87, 1, 'root', 'logd', '/usr/libexec/logd', 0.4, 14, 3],
    [91, 1, 'root', 'fseventsd', '/System/Library/Frameworks/CoreServices.framework/Versions/A/Frameworks/FSEvents.framework/Versions/A/Support/fseventsd', 0.2, 12, 6],
    [96, 1, 'root', 'configd', '/usr/libexec/configd', 0.3, 21, 8],
    [98, 1, 'root', 'powerd', '/usr/libexec/powerd', 0.1, 9, 3],
    [112, 1, 'root', 'mds', '/System/Library/Frameworks/CoreServices.framework/Versions/A/Frameworks/Metadata.framework/Versions/A/Support/mds', 1.3, 120, 8],
    [140, 1, '_windowserver', 'WindowServer', '/System/Library/PrivateFrameworks/SkyLight.framework/Resources/WindowServer', 6.2, 310, 14],
    [142, 1, 'an', 'loginwindow', '/System/Library/CoreServices/loginwindow.app/Contents/MacOS/loginwindow', 0.1, 66, 5],
    [301, 1, 'an', 'cfprefsd', '/usr/sbin/cfprefsd', 0.1, 11, 4],
    [305, 1, 'an', 'distnoted', '/usr/sbin/distnoted', 0.0, 8, 2],
    [352, 1, 'an', 'Dock', '/System/Library/CoreServices/Dock.app/Contents/MacOS/Dock', 0.6, 104, 6],
    [354, 1, 'an', 'SystemUIServer', '/System/Library/CoreServices/SystemUIServer.app/Contents/MacOS/SystemUIServer', 0.2, 72, 5],
    [358, 1, 'an', 'ControlCenter', '/System/Library/CoreServices/ControlCenter.app/Contents/MacOS/ControlCenter', 0.2, 88, 6],
    [362, 1, 'an', 'Spotlight', '/System/Library/CoreServices/Spotlight.app/Contents/MacOS/Spotlight', 0.2, 96, 7],
    [366, 1, 'an', 'NotificationCenter', '/System/Library/CoreServices/NotificationCenter.app/Contents/MacOS/NotificationCenter', 0.1, 58, 4],
    [371, 1, 'an', 'usernoted', '/usr/sbin/usernoted', 0.0, 13, 3],
    [412, 1, 'root', 'airportd', '/usr/libexec/airportd', 0.1, 17, 5],
    [418, 1, 'root', 'bluetoothd', '/usr/sbin/bluetoothd', 0.1, 14, 4],
    [425, 1, 'root', 'coreaudiod', '/usr/sbin/coreaudiod', 0.2, 16, 5],
    [433, 1, 'root', 'mds_stores', '/System/Library/Frameworks/CoreServices.framework/Versions/A/Frameworks/Metadata.framework/Versions/A/Support/mds_stores', 0.2, 55, 5]
  ];
  var APP_PROCS = {
    finder: [411, 'Finder', '/System/Library/CoreServices/Finder.app/Contents/MacOS/Finder', 0.6, 168, 12],
    terminal: [1120, 'Terminal', '/System/Applications/Utilities/Terminal.app/Contents/MacOS/Terminal', 0.9, 112, 9],
    codex: [1180, 'Codex', '/Applications/Codex.app/Contents/MacOS/Codex', 2.4, 340, 28],
    code: [1240, 'Code', '/Applications/Code.app/Contents/MacOS/Electron', 3.1, 520, 36],
    textedit: [1301, 'TextEdit', '/System/Applications/TextEdit.app/Contents/MacOS/TextEdit', 0.1, 74, 5],
    safari: [1360, 'Safari', '/Applications/Safari.app/Contents/MacOS/Safari', 1.8, 310, 22],
    settings: [1412, 'System Settings', '/System/Applications/System Settings.app/Contents/MacOS/System Settings', 0.2, 96, 7],
    calculator: [1466, 'Calculator', '/System/Applications/Calculator.app/Contents/MacOS/Calculator', 0.0, 48, 4],
    activity: [1520, 'Activity Monitor', '/System/Applications/Utilities/Activity Monitor.app/Contents/MacOS/Activity Monitor', 1.1, 88, 6],
    preview: [1578, 'Preview', '/System/Applications/Preview.app/Contents/MacOS/Preview', 0.2, 82, 6]
  };
  var procRng = makeRng(20261002);
  function procRow(a, appId, tty) {
    var base = a[5];
    return {
      pid: a[0], ppid: a[1], user: a[2], name: a[3], command: a[4], appId: appId || null, tty: tty || '??',
      cpu: base === 0 ? 0 : Math.round(base * (0.7 + 0.6 * procRng()) * 10) / 10,
      memMB: a[6], rssKB: a[6] * 1024, vszKB: 4200000 + a[6] * 3100, threads: a[7],
      state: 'S'
    };
  }
  function terminalTtys() {
    var out = [];
    try {
      if (LAB.terminal && LAB.terminal.instances) LAB.terminal.instances.forEach(function (inst) { out.push({ tty: inst.session.tty, win: inst.win }); });
    } catch (e) { /* the Terminal is not ready */ }
    out.sort(function (a, b) { return a.tty - b.tty; });
    return out;
  }
  var procs = {
    /* every process, sorted by PID: system ones, the apps that are open, and a `login` + `-zsh` pair for every Terminal window */
    list: function () {
      var rows = [];
      SYS_PROCS.forEach(function (a) { rows.push(procRow(a, null)); });
      var running = (LAB.apps && LAB.apps.running) ? LAB.apps.running() : ['finder'];
      Object.keys(APP_PROCS).forEach(function (id) {
        if (id !== 'finder' && running.indexOf(id) < 0) return;
        var a = APP_PROCS[id];
        rows.push(procRow([a[0], 1, 'an', a[1], a[2], a[3], a[4], a[5]], id));
      });
      terminalTtys().forEach(function (t) {
        var tt = 'ttys' + (t.tty < 10 ? '00' : t.tty < 100 ? '0' : '') + t.tty;
        var lp = 5000 + t.tty * 10;
        rows.push(procRow([lp, 1120, 'root', 'login', '/usr/bin/login', 0.0, 7, 2], null, tt));
        rows.push(procRow([lp + 1, lp, 'an', '-zsh', '-zsh', 0.1, 11, 2], null, tt));
      });
      rows.sort(function (x, y) { return x.pid - y.pid; });
      return rows;
    },
    find: function (pid) {
      var l = procs.list();
      for (var i = 0; i < l.length; i++) if (l[i].pid === pid) return l[i];
      return null;
    },
    /* end a process: an app's PID quits that app, a shell's PID closes its window; system processes refuse */
    kill: function (pid) {
      var row = procs.find(pid);
      if (!row) return { ok: false, error: 'no such process' };
      if (row.appId) {
        if (row.appId === 'finder') {
          var paths = [];
          try { if (LAB.finder && LAB.finder.windows) paths = LAB.finder.windows().map(function (w) { return w.path; }); } catch (e0) { /* ignore */ }
          LAB.wm.byApp('finder').slice().forEach(function (w) { w.close(true); });
          // Finder starts again by itself, with the windows it had
          setTimeout(function () { paths.forEach(function (p) { try { LAB.finder.open({ path: p, via: 'open' }); } catch (e1) { /* ignore */ } }); }, 900);
          return { ok: true };
        }
        LAB.apps.quit(row.appId, { force: true });
        return { ok: true };
      }
      if (row.name === '-zsh') {
        var t = terminalTtys().filter(function (x) { return 5001 + x.tty * 10 === pid; })[0];
        if (t) { setTimeout(function () { try { t.win.close(true); } catch (e2) { /* ignore */ } }, 50); return { ok: true, self: true }; }
      }
      if (row.name === 'Dock' || row.name === 'SystemUIServer' || row.name === 'ControlCenter' || row.name === 'Spotlight') return { ok: true };   // they restart at once
      return { ok: false, error: 'operation not permitted' };
    },
    /* every process whose name matches (case-insensitive, also the zh-TW name of the app) */
    byName: function (name) {
      var want = String(name).toLowerCase();
      return procs.list().filter(function (r) {
        if (String(r.name).toLowerCase() === want) return true;
        var def = r.appId && LAB.apps && LAB.apps.get(r.appId);
        return !!def && [def.title, def.en].some(function (n) { return n && String(n).toLowerCase() === want; });
      });
    }
  };
  LAB.procs = LAB.procs || procs;
  /* ------------------------------------------------ the command library (js/terminal-cmds.js)
     Everything the missions need lives in this file. The long list of other commands (grep, git, man, top …) is a second file that
     is fetched when the first Terminal window opens, so the desktop stays light. A line typed before it has arrived waits for it (at most
     6 s); if it never arrives the commands above still work and the rest answer with the usual lab line. */
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

  /* what the library file needs from this one, and the state that every Terminal window shares (the real Mac is one computer) */
  var sysState = { devTools: false, installing: false, gitConfig: Object.create(null), gitRepos: new Map(), clip: '' };

  LAB.shell = {
    newSession: newSession, run: run, resume: resume, cancel: cancel, complete: complete,
    commands: commands, escape: shellEscape, columns: columns, lex: lex, parse: parse, findApp: findApp,
    load: function () { return new Promise(function (res) { loadLibrary(res); }); },
    libraryState: function () { return lib.state; },
    library: false, sys: sysState, procs: procs,
    api: {
      h: h, pad: pad, p2: p2, sgr: sgr, ESC: ESC, stripAnsi: stripAnsi, makeRng: makeRng, calcEval: calcEval, columns: columns, humanSize: humanSize,
      parseOpts: parseOpts, usageResult: usageResult, USAGE: USAGE, LETTERS: LETTERS, WITHARG: WITHARG,
      resolvePath: resolvePath, abbrevHome: abbrevHome, errLine: errLine, protectedKind: protectedKind, attrsOf: attrsOf, modeOf: modeOf, modeString: modeString,
      readStdinLines: readStdinLines, catText: catText, countText: countText, utf8len: utf8len, askYes: askYes, shellEscape: shellEscape,
      resolveCommand: resolveCommand, runCommand: runCommand, execSource: execSource, lex: lex, parse: parse,
      BUILTINS: BUILTINS, TIER2: TIER2, TIER3: TIER3, APP_NAMES: APP_NAMES, KNOWN_MAC_APPS: KNOWN_MAC_APPS, DEFAULT_PATH: DEFAULT_PATH, PROTECTED_STD: PROTECTED_STD
    }
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

  var PAD = 8;
  var FS_DEFAULT = 12, FS_MIN = 11, FS_MAX = 20;
  var LH = 1.4;                    // line height as a multiple of the font size (owner, 2026-10-05: 1.25 felt cramped)
  var instances = new Map();       // winId -> terminal instance

  function stageScale() { return (LAB.stage && LAB.stage.scale) || 1; }

  /* ---- text on the screen: a logical line is plain text plus colour spans {s, e, c} (code-point indexes, c = CSS classes) ---- */
  function newLine() { return { text: '', n: 0, spans: [] }; }
  function newStyle() { return { b: 0, u: 0, r: 0, fg: -1, bg: -1 }; }
  function styleClass(st) {
    var c = '';
    if (st.b) c += ' tm-b';
    if (st.u) c += ' tm-u';
    if (st.r) c += ' tm-r';
    if (st.fg >= 0) c += ' tm-f' + st.fg;
    if (st.bg >= 0) c += ' tm-g' + st.bg;
    return c.slice(1);
  }
  /* SGR codes: reset, bold, underline, reverse, 30-37 / 90-97 text colours, 40-47 / 100-107 backgrounds (256 and RGB colours are skipped) */
  function applySgr(st, params) {
    var ps = params === '' ? [0] : params.split(';').map(function (x) { return x === '' ? 0 : parseInt(x, 10); });
    for (var i = 0; i < ps.length; i++) {
      var p = ps[i];
      if (p === 0) { st.b = 0; st.u = 0; st.r = 0; st.fg = -1; st.bg = -1; }
      else if (p === 1) st.b = 1;
      else if (p === 4) st.u = 1;
      else if (p === 7) st.r = 1;
      else if (p === 22) st.b = 0;
      else if (p === 24) st.u = 0;
      else if (p === 27) st.r = 0;
      else if (p >= 30 && p <= 37) st.fg = p - 30;
      else if (p === 39) st.fg = -1;
      else if (p >= 40 && p <= 47) st.bg = p - 40;
      else if (p === 49) st.bg = -1;
      else if (p >= 90 && p <= 97) st.fg = p - 90 + 8;
      else if (p >= 100 && p <= 107) st.bg = p - 100 + 8;
      else if (p === 38 || p === 48) { if (ps[i + 1] === 5) i += 2; else if (ps[i + 1] === 2) i += 4; }
    }
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

  /* add a piece of text (no newline, colour codes allowed) to a logical line; `st` is the colour state, which carries over */
  function feedLine(line, str, st) {
    var re = /\x1b\[([0-9;?]*)([A-Za-z])/g, last = 0, m;
    function addPlain(t) {
      if (!t) return;
      t = expandTabs(line.text, t);
      if (!t) return;
      var cnt = Array.from(t).length, cls = styleClass(st);
      if (cls) {
        var ls = line.spans[line.spans.length - 1];
        if (ls && ls.e === line.n && ls.c === cls) ls.e += cnt; else line.spans.push({ s: line.n, e: line.n + cnt, c: cls });
      }
      line.text += t; line.n += cnt;
    }
    while ((m = re.exec(str))) {
      addPlain(str.slice(last, m.index));
      last = re.lastIndex;
      if (m[2] === 'm') applySgr(st, m[1]);
    }
    addPlain(str.slice(last));
  }

  /* code points -> row ranges [from, to) wrapped at `cols` columns (CJK counts 2, marks 0) */
  function wrapRanges(cps, cols) {
    var rows = [], a = 0, col = 0;
    for (var i = 0; i < cps.length; i++) {
      var w = charWidth(cps[i].codePointAt(0));
      if (w === 0) continue;
      if (col + w > cols && col > 0) { rows.push([a, i]); a = i; col = 0; }
      col += w;
    }
    rows.push([a, cps.length]);
    return rows;
  }

  /* build the DOM of one row: narrow runs are plain text (or a colour span), wide characters get a 2ch cell;
     markLast = the last character is zsh's reverse-video %, curIdx = the cell that holds the cursor */
  function fillRow(el, cps, a, b, spans, markLast, curIdx) {
    var frag = document.createDocumentFragment();
    var run = '', runCls = '', si = 0;
    function flush() {
      if (!run) return;
      if (runCls) frag.appendChild(h('span', { class: runCls }, run)); else frag.appendChild(document.createTextNode(run));
      run = '';
    }
    function clsAt(i) {
      while (si < spans.length && spans[si].e <= i) si++;
      return si < spans.length && spans[si].s <= i ? spans[si].c : '';
    }
    for (var i = a; i < b; i++) {
      var ch = cps[i], w = charWidth(ch.codePointAt(0)), cls = clsAt(i);
      if (markLast && i === b - 1) { flush(); runCls = ''; frag.appendChild(h('span', { class: 'tm-eol' }, ch)); continue; }
      if (w === 2 || i === curIdx) {
        flush(); runCls = '';
        var span = h('span', { class: ((i === curIdx ? 'tm-cursor ' : '') + (w === 2 ? 'tm-w ' : '') + cls).trim() }, ch);
        while (w === 2 && i + 1 < b && charWidth(cps[i + 1].codePointAt(0)) === 0) { span.appendChild(document.createTextNode(cps[i + 1])); i++; }
        frag.appendChild(span);
        continue;
      }
      if (cls !== runCls) { flush(); runCls = cls; }
      run += ch;
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
    var fs = FS_DEFAULT, cw = FS_DEFAULT * 0.6, lh = Math.round(FS_DEFAULT * LH * 4) / 4;
    var cols = 80, rows = 24;
    var hist = [];                    // {text, spans, mark, el}
    var partial = newLine();          // unfinished output line
    var ansi = newStyle();            // colour state of the output, kept between prints
    var buf = [], cur = 0, comp = '';
    var histPos = -1, stash = null;
    var tabState = null;
    var rs = null;                    // Ctrl+R: {query, idx, saved, failed}
    var app = null;                   // a full-screen program (less, man, nano, top): {def, api, timer, cache}
    var waitingLib = false;
    var waitTok = 0;                  // which wait is current: Ctrl+C and every new wait bump it, so a given-up line never runs later
    var busy = false, dead = false, composing = false, userSized = false, selfSizing = false;
    var sleepTimer = 0, clearAnchor = null, closed = false;
    var lastCwd = session.cwd;
    var win = null;

    // ---- DOM
    var histEl = h('div', { class: 'tm-hist' });
    var liveEl = h('div', { class: 'tm-live' });
    var spacerEl = h('div', { class: 'tm-spacer' });
    var altEl = h('div', { class: 'tm-alt', dataset: { lab: 'term-alt' } });
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
      lh = Math.round(fs * LH * 4) / 4;
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
      var wasCols = cols, wasRows = rows;
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
      if (app && (nc !== wasCols || nr !== wasRows)) {
        if (app.def.resize) { try { app.def.resize(app.api); } catch (eR) { console.error('[terminal] app resize', eR); } }
        buildAltRows();
        renderApp();
      }
    }

    // ---- history lines
    function buildLine(item) {
      var el = item.el || h('div', { class: 'tm-line' });
      el.textContent = '';
      var cps = Array.from(item.text + (item.mark ? '%' : ''));
      var ranges = wrapRanges(cps, cols);
      for (var i = 0; i < ranges.length; i++) {
        var r = h('div', { class: 'tm-row' });
        fillRow(r, cps, ranges[i][0], ranges[i][1], item.spans || [], !!item.mark && i === ranges.length - 1, -1);
        el.appendChild(r);
      }
      item.el = el;
      return el;
    }
    function rewrap() {
      histEl.textContent = '';
      hist.forEach(function (it) { histEl.appendChild(buildLine(it)); });
    }
    /* a finished line of the screen: a plain string, or a {text, spans} line */
    function commitLine(line, mark) {
      var it = typeof line === 'string' ? { text: line, spans: [], mark: !!mark, el: null } : { text: line.text, spans: line.spans, mark: !!mark, el: null };
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
        feedLine(partial, chunks[i], ansi);
        if (i < chunks.length - 1) { commitLine(partial, false); partial = newLine(); }
      }
    }
    function flushPartial() {
      if (partial.n > 0) { commitLine(partial, true); partial = newLine(); }
      ansi = newStyle();
    }
    function clearAll() {
      hist = [];
      histEl.textContent = '';
      partial = newLine();
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
      if (closed || app) return;
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
      if (rs) {                                   // Ctrl+R: zsh shows the search line under the command line
        var rsRow = h('div', { class: 'tm-row' });
        var rcps = Array.from((rs.failed ? 'failed ' : '') + 'bck-i-search: ' + rs.query + '_');
        fillRow(rsRow, rcps, 0, rcps.length, [], false, -1);
        liveEl.appendChild(rsRow);
      }
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
      if (app) {                                     // IME text and paste reach a full-screen program as text
        try { if (app.def.text) app.def.text(String(str), app.api); } catch (eT) { console.error('[terminal] app text', eT); }
        renderApp();
        return;
      }
      if (busy || dead || waitingLib) return;
      if (rs) rs = null;
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
        else if (e.type === 'launch') LAB.apps.launch(e.appId, e.args || null, { bounce: false });
        else if (e.type === 'reveal') {
          if (LAB.finder && LAB.finder.reveal) LAB.finder.reveal(e.path);
          else LAB.apps.openFolder(vfs.dirname(e.path), 'open');
        }
      } catch (err) { console.error('[terminal] effect failed', err); }
    }

    /* the first `git` or `python3` on a fresh Mac: a system dialog asks to install the command line developer tools (SPEC §1).
       Install → a progress panel for about 3 s → "installed". Nothing is really downloaded. */
    function showClt(name) {
      if (sysState.installing || sysState.devTools) return;
      LAB.bus.emit('term:clt', { winId: win.id, state: 'ask', name: name });
      LAB.ui.alert(null, {
        title: '「' + name + '」指令需要命令列開發人員工具。',
        text: '要現在安裝這些工具嗎？',
        buttons: [{ label: '取消', value: 'cancel', cancel: true }, { label: '安裝', value: 'install', 'default': true }]
      }).then(function (v) {
        if (v !== 'install') { LAB.bus.emit('term:clt', { winId: win.id, state: 'cancel', name: name }); return; }
        fakeInstall(name);
      });
    }
    function fakeInstall(name) {
      var host = document.getElementById('lab-overlays');
      var total = sysState.cltMs || 3000;
      sysState.installing = true;
      LAB.bus.emit('term:clt', { winId: win.id, state: 'installing', name: name });
      var fill = h('div', { class: 'tm-clt-fill' });
      var left = h('div', { class: 'lab-sheet-text tm-clt-left' }, '剩餘時間：約 ' + Math.ceil(total / 1000) + ' 秒');
      var panel = h('div', { class: 'lab-sheet is-centered tm-clt', role: 'dialog', 'aria-modal': 'true', 'aria-label': '正在安裝命令列開發人員工具', dataset: { lab: 'clt-progress' } },
        h('div', { class: 'lab-sheet-title' }, '正在下載軟體…'), left, h('div', { class: 'tm-clt-bar' }, fill));
      var scrim = h('div', { class: 'lab-sheet-scrim is-stage' }, panel);
      var t0 = Date.now(), tick = 0;
      if (host) {
        host.appendChild(scrim);
        requestAnimationFrame(function () {
          scrim.classList.add('is-in');
          fill.style.transitionDuration = total + 'ms';
          fill.style.transform = 'scaleX(1)';
        });
        tick = setInterval(function () {
          var secs = Math.max(1, Math.ceil((total - (Date.now() - t0)) / 1000));
          left.textContent = '剩餘時間：約 ' + secs + ' 秒';
        }, 500);
      }
      setTimeout(function () {
        clearInterval(tick);
        if (scrim.parentNode) scrim.parentNode.removeChild(scrim);
        sysState.installing = false;
        sysState.devTools = true;
        LAB.bus.emit('term:clt', { winId: win.id, state: 'done', name: name });
        LAB.ui.alert(null, {
          title: '軟體已安裝。', text: '命令列開發人員工具已經安裝好了，現在可以使用 git 和 python3。',
          buttons: [{ label: '完成', value: true, 'default': true }]
        });
      }, total);
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
      var sleepMs = null, appDef = null;
      var stream = res.stream || [];
      for (var i = 0; i < stream.length; i++) {
        var it = stream[i];
        if (typeof it === 'string') { printText(it); continue; }
        if (it.type === 'clear') clearAll();
        else if (it.type === 'exit') { dead = true; }
        else if (it.type === 'sleep') sleepMs = it.ms;
        else if (it.type === 'app') appDef = it.app;
        else if (it.type === 'clt') showClt(it.name);
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
      if (!res.done && appDef) { flushPartial(); enterApp(appDef); return; }
      if (!res.done && sleepMs !== null) { startSleep(sleepMs); return; }
      showPrompt();
    }

    /* does this line use a command that only the second file (the command library) has? */
    function needsLibrary(line) {
      if (session.prompt) return false;
      var src = session.pending !== null ? session.pending + '\n' + line : line;
      if (src.indexOf('!') >= 0 || src.indexOf('$(') >= 0 || src.indexOf('`') >= 0) return true;
      var lx = LAB.shell.lex(src);
      if (lx.incomplete || lx.unsupported || lx.parseError) return false;
      var cmdPos = true, skip = false;
      for (var i = 0; i < lx.tokens.length; i++) {
        var t = lx.tokens[i];
        if (t.t === 'op') {
          if (t.op === ';' || t.op === 'nl' || t.op === '&&' || t.op === '||' || t.op === '|') cmdPos = true;
          else if (t.op !== 'dup') skip = true;
          continue;
        }
        if (skip) { skip = false; continue; }
        if (!cmdPos) continue;
        if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(t.raw)) continue;
        cmdPos = false;
        var p = t.parts.length === 1 && t.parts[0].k === 'lit' && t.parts[0].q === 0 ? t.parts[0].s : null;
        if (p === null) return true;
        if (p.indexOf('/') >= 0 || p === '') continue;
        if (session.aliases && session.aliases[p] !== undefined && p !== 'run-help' && p !== 'which-command') return true;
        if (!Object.prototype.hasOwnProperty.call(commands, p)) return true;
      }
      return false;
    }
    function runNow(line) { handleResult(LAB.shell.run(line, session)); }
    function submit() {
      if (busy || dead || app || waitingLib) return;
      var line = buf.join('');
      commitLine(promptStr() + line, false);
      buf = []; cur = 0; comp = ''; histPos = -1; stash = null; tabState = null; rs = null;
      if (lib.state === 'ready' || lib.state === 'failed' || !needsLibrary(line)) { runNow(line); return; }
      // the command library is still on its way: wait for it (Ctrl+C gives up)
      var tok = ++waitTok;
      waitingLib = true;
      renderLive();
      loadLibrary(function () {
        if (tok !== waitTok || !waitingLib || closed) return;
        waitingLib = false;
        runNow(line);
      });
    }
    function interrupt() {
      if (dead) return;
      rs = null;
      if (waitingLib) { waitingLib = false; waitTok++; commitLine('^C', false); showPrompt(); return; }
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

    // ---- full-screen programs (less, man, nano, top): the screen is replaced, and comes back when the program ends
    function buildAltRows() {
      altEl.textContent = '';
      for (var r = 0; r < rows; r++) altEl.appendChild(h('div', { class: 'tm-row' }));
      if (app) app.cache = [];
    }
    function renderApp() {
      if (!app || closed) return;
      var out;
      try { out = app.def.render(app.api) || { rows: [] }; }
      catch (e) { console.error('[terminal] app render', e); out = { rows: ['（練習版的全螢幕程式出錯了，按 q 或 Ctrl+C 離開）'] }; }
      var cr = out.cursor || null;
      var kids = altEl.children;
      for (var r = 0; r < rows && r < kids.length; r++) {
        var str = r < out.rows.length ? String(out.rows[r]) : '';
        var curCol = cr && cr.r === r ? cr.c : -1;
        var key = str + '\u0001' + curCol;
        if (app.cache[r] === key) continue;
        app.cache[r] = key;
        var el = kids[r];
        el.textContent = '';
        var ln = newLine();
        feedLine(ln, str, newStyle());
        var cps = Array.from(ln.text), end = cps.length, col = 0, curIdx = -1, i;
        for (i = 0; i < cps.length; i++) {
          var w = charWidth(cps[i].codePointAt(0));
          if (w === 0) continue;
          if (col + w > cols) { end = i; break; }
          if (col === curCol && curIdx < 0) curIdx = i;
          col += w;
        }
        if (curCol >= 0 && curIdx < 0) {
          // the cursor sits after the text: pad with spaces up to it
          while (col < curCol && col < cols - 1) { cps.splice(end, 0, ' '); end++; col++; }
          cps.splice(end, 0, ' ');
          curIdx = end; end++;
        }
        fillRow(el, cps, 0, Math.min(end, cps.length), ln.spans, false, curIdx);
      }
      if (cr) { ta.style.left = (PAD + cr.c * cw) + 'px'; ta.style.top = (altEl.offsetTop + cr.r * lh) + 'px'; }
    }
    function setAppTick(ms) {
      if (!app) return;
      if (app.timer) { clearInterval(app.timer); app.timer = 0; }
      if (ms > 0) {
        app.timer = setInterval(function () {
          if (!app || closed || document.hidden || win.isMinimized()) return;     // nothing moves while nobody can see it
          try { if (app.def.tick) app.def.tick(app.api); } catch (e) { console.error('[terminal] app tick', e); }
          renderApp();
        }, ms);
      }
    }
    function enterApp(def) {
      if (app) return;
      var api = {
        cols: function () { return cols; }, rows: function () { return rows; }, session: session, win: win,
        redraw: function () { renderApp(); }, exit: function (status) { exitApp(status); }, setTick: setAppTick,
        copy: function (t) { LAB.clipboard.setText(t); }
      };
      app = { def: def, api: api, timer: 0, cache: [] };
      busy = false; rs = null;
      screen.classList.add('tm-alt-on');
      screen.insertBefore(altEl, ta);
      buildAltRows();
      screen.scrollTop = 0;
      try { if (def.start) def.start(api); } catch (e) { console.error('[terminal] app start', e); }
      renderApp();
      focusInput();
      LAB.bus.emit('term:app', { winId: win.id, name: def.name || '', state: 'enter' });
    }
    function exitApp(status) {
      if (!app) return;
      var a = app;
      if (a.timer) clearInterval(a.timer);
      try { if (a.def.stop) a.def.stop(a.api); } catch (e) { console.error('[terminal] app stop', e); }
      app = null;
      screen.classList.remove('tm-alt-on');
      if (altEl.parentNode) altEl.parentNode.removeChild(altEl);
      LAB.bus.emit('term:app', { winId: win.id, name: a.def.name || '', state: 'exit' });
      renderLive();
      handleResult(LAB.shell.resume(session, status));
    }

    // ---- Ctrl+R: search the history backwards (a small version of zsh's incremental search)
    function rsFind(from) {
      var hs = termState.history;
      if (rs.query === '') return -1;
      for (var i = Math.min(from, hs.length - 1); i >= 0; i--) if (hs[i].indexOf(rs.query) >= 0) return i;
      return -1;
    }
    function rsShow(i) {
      if (i >= 0) {
        rs.idx = i; rs.failed = false;
        buf = Array.from(termState.history[i].replace(/[\r\n]+/g, ' '));
        cur = buf.length;
      } else rs.failed = rs.query !== '';
      renderLive();
    }
    function rsStart() {
      if (session.prompt || session.pending !== null || !editable()) return;
      rs = { query: '', idx: termState.history.length, saved: buf.join(''), failed: false };
      renderLive();
    }
    function rsCancel() {
      buf = Array.from(rs.saved); cur = buf.length;
      rs = null;
      renderLive();
    }
    function rsAccept(runIt) {
      rs = null;
      renderLive();
      if (runIt) submit();
    }
    /* a key while the search is open: true when it was used up */
    function rsKey(e, key, k, ctrl, meta, alt) {
      if (meta) return false;
      if (ctrl && k === 'r') { rsShow(rsFind(rs.idx - 1)); e.preventDefault(); return true; }
      if ((ctrl && (k === 'g' || k === 'c')) || key === 'Escape') { rsCancel(); e.preventDefault(); return true; }
      if (key === 'Enter') { if (LAB.ui.isImeEnter(e)) return true; e.preventDefault(); rsAccept(true); return true; }
      if (key === 'Backspace') {
        e.preventDefault();
        rs.query = rs.query.slice(0, -1);
        if (rs.query === '') { rs.failed = false; buf = Array.from(rs.saved); cur = buf.length; renderLive(); }
        else rsShow(rsFind(termState.history.length - 1));
        return true;
      }
      if (key.length === 1 && !ctrl && !alt) {
        e.preventDefault();
        rs.query += key;
        rsShow(rsFind(Math.min(rs.idx, termState.history.length - 1)));
        return true;
      }
      if (key === 'Shift' || key === 'Process' || key === 'Dead') return true;
      rsAccept(false);                                           // any other key: keep the line that was found and carry on editing
      return false;
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
        if (!app) { if (ctrl) { interrupt(); e.preventDefault(); } return; }
      }
      if (pasteCombo) return;                                      // the paste event does the work
      if (waitingLib) { e.preventDefault(); return; }
      if (rs && !app) { if (rsKey(e, key, k, ctrl, meta, alt)) return; }
      if (meta) {
        if (k === 'k') { clearAll(); e.preventDefault(); return; }
        if (k === 'a') { selectAll(); e.preventDefault(); return; }
        if (key === '=' || key === '+') { setFontSize(fs + 1); e.preventDefault(); return; }
        if (key === '-' || key === '_') { setFontSize(fs - 1); e.preventDefault(); return; }
        return;
      }
      if (dead) { if (key === 'PageUp' || key === 'PageDown') return; e.preventDefault(); return; }
      if (app) {
        e.preventDefault();
        try { app.def.key({ key: key, k: k, ctrl: ctrl, alt: alt, shift: e.shiftKey }, app.api); } catch (eK) { console.error('[terminal] app key', eK); }
        renderApp();
        return;
      }
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
          case 'r': rsStart(); break;
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

    screen.addEventListener('wheel', function (e) {
      if (!app || !app.def.wheel) return;
      e.preventDefault();
      try { app.def.wheel(e.deltaY, app.api); } catch (eW) { console.error('[terminal] app wheel', eW); }
      renderApp();
    }, { passive: false });

    // ---- window
    win = LAB.wm.open({
      appId: 'terminal', title: 'an — -zsh — 80×24', width: 660, height: 440, bar: 'plain', theme: 'light',
      content: root, minW: 320, minH: 160, icon: 'app-terminal'
    });
    win.state.cwd = session.cwd;
    // small folder icon in front of the title (CSS ::before reads --ticon); the icon is our own static SVG
    try { win.titleEl.style.setProperty('--ticon', 'url("data:image/svg+xml,' + encodeURIComponent(LAB.icons.get('folder', { size: 32 })) + '")'); } catch (eIco) { /* the icon is cosmetic */ }

    var inst = {
      win: win, session: session,
      cols: function () { return cols; }, rows: function () { return rows; },
      copy: copySelection, paste: pasteFromMenu, selectAll: selectAll, clearAll: clearAll,
      zoom: function (d) { setFontSize(fs + d); }, insert: insertText, focus: focusInput,
      typed: function () { return buf.join(''); }, isBusy: function () { return busy; }, isDead: function () { return dead; },
      appName: function () { return app ? (app.def.name || 'app') : ''; }, searching: function () { return rs ? rs.query : null; },
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
      if (app && app.timer) { clearInterval(app.timer); app.timer = 0; }
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

  LAB.menu.register('terminal', function () {
    var t = currentTerminal();
    return [
      { label: 'Shell', items: [
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
