/* terminal-cmds.js — the long list of commands for the Terminal (round 5, SPEC §3). Loaded by terminal.js when the first Terminal window opens.
   Everything here is fake data over the practice file system; nothing touches the network. Commands are plain functions (or generators when
   they wait: ping, yes, tail -f, a question) added to LAB.shell.commands. The pieces they share (parseOpts, resolvePath, colours …) come from LAB.shell.api. */
(function (LAB) {
  'use strict';

  var S = LAB.shell, A = S.api, commands = S.commands, sys = S.sys, procs = S.procs;
  var h = A.h, pad = A.pad, p2 = A.p2, sgr = A.sgr, ESC = A.ESC, strip = A.stripAnsi;
  var resolvePath = A.resolvePath, parseOpts = A.parseOpts, usageResult = A.usageResult, USAGE = A.USAGE, LETTERS = A.LETTERS, WITHARG = A.WITHARG;
  var displayWidth = LAB.util.displayWidth, charWidth = LAB.util.charWidth;
  var hasOwn = Object.prototype.hasOwnProperty;
  var HOME = LAB.vfs.HOME;
  var utf8len = A.utf8len;

  function def(name, fn) { commands[name] = fn; }
  function splitLines(text) {
    if (text === '' || text === null || text === undefined) return [];
    var a = String(text).split('\n');
    if (a[a.length - 1] === '') a.pop();
    return a;
  }
  function joinLines(lines) { return lines.length ? lines.join('\n') + '\n' : ''; }
  function textOf(vfs, abs) { var st = vfs.stat(abs); return st && st.type === 'file' && st.kind === 'text' ? vfs.readFile(abs, { by: 'terminal' }) : null; }
  function cmpStr(a, b) { return a < b ? -1 : a > b ? 1 : 0; }
  var BINARY_NOTE = '（練習版：這是二進位檔案，內容不顯示）\n';

  /* the inputs of a filter command: each file operand (or `-`), or stdin, or typed lines until Ctrl+D.
     -> {inputs:[{name, text, binary, abs, stdin}], status}; errors are printed like the real command does */
  function* gather(ctx, files, cmd, o) {
    o = o || {};
    var s = ctx.session, vfs = s.vfs, inputs = [], status = 0;
    if (!files.length) {
      var text = ctx.stdin;
      if (text === null) text = yield* A.readStdinLines(ctx);
      return { inputs: [{ name: '(standard input)', text: text, stdin: true }], status: 0 };
    }
    for (var i = 0; i < files.length; i++) {
      var f = files[i];
      if (f === '-') {
        var t2 = ctx.stdin;
        if (t2 === null) t2 = yield* A.readStdinLines(ctx);
        inputs.push({ name: '(standard input)', text: t2, stdin: true });
        continue;
      }
      var abs = resolvePath(s, f), st = f === '' ? null : vfs.stat(abs);
      if (!st) { if (!o.quiet) ctx.err(cmd + ': ' + f + ': No such file or directory\n'); status = 2; continue; }
      if (st.type === 'dir') { if (!o.dirOk) { if (!o.quiet) ctx.err(cmd + ': ' + f + ': Is a directory\n'); status = o.dirStatus === undefined ? 1 : o.dirStatus; continue; } inputs.push({ name: f, dir: true, abs: abs, st: st }); continue; }
      inputs.push({ name: f, text: st.kind === 'text' ? vfs.readFile(abs, { by: 'terminal' }) : '', binary: st.kind !== 'text', abs: abs, st: st });
    }
    return { inputs: inputs, status: status };
  }

  /* ------------------------------------------------------------- patterns */
  var POSIX_CLASS = { alpha: 'A-Za-z', digit: '0-9', alnum: 'A-Za-z0-9', upper: 'A-Z', lower: 'a-z', space: '\\s', blank: ' \\t', punct: '!-\\/:-@\\[-`{-~', xdigit: '0-9A-Fa-f', word: '\\w' };
  function posixClasses(p) { return p.replace(/\[:([a-z]+):\]/g, function (m, n) { return hasOwn.call(POSIX_CLASS, n) ? POSIX_CLASS[n] : m; }); }
  function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&'); }
  /* grep patterns -> RegExp source: -F literal, -E extended, otherwise basic (\( \) \{ \} \| mean groups, bare ( ) { } | + ? are plain) */
  function grepSource(pat, mode) {
    if (mode === 'F') return escRe(pat);
    var p = posixClasses(pat);
    if (mode === 'E') return p;
    var out = '', i = 0;
    while (i < p.length) {
      var c = p.charAt(i);
      if (c === '\\' && i + 1 < p.length) {
        var n = p.charAt(i + 1);
        if ('(){}|+?'.indexOf(n) >= 0) out += n; else out += '\\' + n;
        i += 2; continue;
      }
      if (c === '[') { var j = p.indexOf(']', i + 2); if (j > 0) { out += p.slice(i, j + 1); i = j + 1; continue; } }
      if ('(){}|+?'.indexOf(c) >= 0) { out += '\\' + c; i++; continue; }
      out += c; i++;
    }
    return out;
  }
  function globToRegex(g) {
    var re = '^';
    for (var i = 0; i < g.length; i++) {
      var c = g.charAt(i);
      if (c === '*') re += '.*';
      else if (c === '?') re += '.';
      else if (c === '[') { var j = g.indexOf(']', i + 1); if (j > 0) { re += '[' + g.slice(i + 1, j).replace(/^!/, '^') + ']'; i = j; } else re += '\\['; }
      else re += escRe(c);
    }
    return new RegExp(re + '$');
  }

  /* ----------------------------------------------------------------- grep */
  USAGE.grep = ['usage: grep [-abcdDEFGHhIiJLlMmnOopqRSsUVvwXxZz] [-A num] [-B num] [-C[num]]', '\t[-e pattern] [-f file] [--binary-files=value] [--color=when]', '\t[--context[=num]] [--directories=action] [--label] [--line-buffered]', '\t[--null] [pattern] [file ...]'];
  LETTERS.grep = 'abcdDEFGHhIiJLlMmnOopqRrSsUVvwXxZzABCefp';
  WITHARG.grep = 'ABCDefm';
  def('grep', function* (args, ctx) {
    var s = ctx.session, vfs = s.vfs;
    var F = {}, pats = [], rest = [], ctxA = 0, ctxB = 0, color = ctx.tty, incl = [], excl = [], i = 0, maxCount = Infinity;
    function usage() { ctx.err(USAGE.grep.join('\n') + '\n'); return 2; }
    for (; i < args.length; i++) {
      var a = args[i];
      if (a === '--') { i++; break; }
      if (a.charAt(0) !== '-' || a === '-') { rest.push(a); continue; }
      if (a.indexOf('--') === 0) {
        var m = /^--([a-z-]+)(?:=(.*))?$/.exec(a);
        if (!m) return usage();
        var long = m[1], val = m[2];
        if (long === 'color' || long === 'colour') { color = val === undefined ? ctx.tty : (val === 'always' || (val === 'auto' && ctx.tty)); }
        else if (long === 'include') incl.push(val);
        else if (long === 'exclude') excl.push(val);
        else if (long === 'ignore-case') F.i = true;
        else if (long === 'line-number') F.n = true;
        else if (long === 'recursive') F.r = true;
        else if (long === 'count') F.c = true;
        else if (long === 'invert-match') F.v = true;
        else if (long === 'files-with-matches') F.l = true;
        else if (long === 'word-regexp') F.w = true;
        else if (long === 'extended-regexp') F.E = true;
        else if (long === 'fixed-strings') F.F = true;
        else if (long === 'only-matching') F.o = true;
        else if (long === 'quiet') F.q = true;
        else if (long === 'no-filename') F.h = true;
        else if (long === 'with-filename') F.H = true;
        else if (long === 'binary-files' || long === 'line-buffered' || long === 'null') { /* accepted */ }
        else { ctx.err('grep: unrecognized option `' + a + "'\n" + USAGE.grep.join('\n') + '\n'); return 2; }
        continue;
      }
      for (var k = 1; k < a.length; k++) {
        var ch = a.charAt(k);
        if (LETTERS.grep.indexOf(ch) < 0) { ctx.err('grep: invalid option -- ' + ch + '\n' + USAGE.grep.join('\n') + '\n'); return 2; }
        if (/[0-9]/.test(ch)) { ctxA = ctxB = parseInt(a.slice(k), 10) || 0; break; }
        if (WITHARG.grep.indexOf(ch) >= 0) {
          var rem = a.slice(k + 1), v;
          if (rem !== '') v = rem; else if (i + 1 < args.length) v = args[++i]; else { ctx.err('grep: option requires an argument -- ' + ch + '\n' + USAGE.grep.join('\n') + '\n'); return 2; }
          if (ch === 'e') pats.push(v);
          else if (ch === 'A') ctxA = parseInt(v, 10) || 0;
          else if (ch === 'B') ctxB = parseInt(v, 10) || 0;
          else if (ch === 'C') { ctxA = ctxB = parseInt(v, 10) || 0; }
          else if (ch === 'm') maxCount = parseInt(v, 10);
          break;
        }
        F[ch] = true;
      }
    }
    rest = rest.concat(args.slice(i));
    if (!pats.length) { if (!rest.length) return usage(); pats.push(rest.shift()); }
    if (F.R) F.r = true;
    var src = pats.map(function (p) { return '(?:' + grepSource(p, F.F ? 'F' : F.E ? 'E' : 'G') + ')'; }).join('|');
    if (F.x) src = '^(?:' + src + ')$';
    var wordMode = !!F.w && !F.x;                           // -w is checked by hand: older Safari has no look-behind in regular expressions
    var re;
    try { re = new RegExp(src, F.i ? 'giu' : 'gu'); }
    catch (e) {
      try { re = new RegExp(src, F.i ? 'gi' : 'g'); }
      catch (e2) {
        var msg = String(e2.message);
        ctx.err('grep: ' + (/group/i.test(msg) ? 'parentheses not balanced' : /character class|Unterminated/i.test(msg) ? 'brackets ([ ]) not balanced' : /nothing to repeat/i.test(msg) ? 'repetition-operator operand invalid' : 'invalid regular expression') + '\n');
        return 2;
      }
    }
    var WORDCH = /[A-Za-z0-9_]/;
    /* every match in a line: [{index, text}] (with -w only those that stand alone as a word) */
    function matchesIn(line) {
      var res = [], mm;
      re.lastIndex = 0;
      while ((mm = re.exec(line)) !== null) {
        if (mm[0] === '') { re.lastIndex++; continue; }
        var before = mm.index > 0 ? line.charAt(mm.index - 1) : '', after = line.charAt(mm.index + mm[0].length);
        if (wordMode && ((before && WORDCH.test(before)) || (after && WORDCH.test(after)))) { re.lastIndex = mm.index + 1; continue; }
        res.push({ index: mm.index, text: mm[0] });
      }
      return res;
    }
    // the files: operands, or every file below the folders with -r
    var targets = [], status = 1, errored = false, expandedDirs = false;
    function addTree(abs, shown) {
      var st = vfs.stat(abs);
      if (!st) return;
      if (st.type === 'dir') {
        vfs.list(abs).forEach(function (c) { addTree(c.path, shown === '' ? c.name : (shown.slice(-1) === '/' ? shown : shown + '/') + c.name); });
      } else targets.push({ shown: shown, abs: abs, st: st });
    }
    var operands = rest.slice();
    if (!operands.length && F.r) operands = [''];
    if (!operands.length) {
      var g = yield* gather(ctx, [], 'grep');
      targets.push({ shown: '(standard input)', text: g.inputs[0].text, stdin: true });
    } else {
      for (var oi = 0; oi < operands.length; oi++) {
        var op = operands[oi];
        if (op === '-') { var t0 = ctx.stdin === null ? '' : ctx.stdin; targets.push({ shown: '(standard input)', text: t0, stdin: true }); continue; }
        var abs = op === '' ? s.cwd : resolvePath(s, op), st = vfs.stat(abs);
        if (!st) { if (!F.s) ctx.err('grep: ' + op + ': No such file or directory\n'); errored = true; continue; }
        if (st.type === 'dir') {
          if (F.r) { expandedDirs = true; addTree(abs, op === '' ? '' : op.replace(/\/+$/, '')); }
          else { if (!F.s) ctx.err('grep: ' + op + ': Is a directory\n'); }
          continue;
        }
        targets.push({ shown: op, abs: abs, st: st });
      }
    }
    var showName = !!F.H || (!F.h && (targets.length > 1 || expandedDirs));
    var anyMatch = false, outBuf = '';
    function C(code, t) { return color ? sgr(code, t) : t; }
    function emit(t) { outBuf += t; if (outBuf.length > 4000) { ctx.out(outBuf); outBuf = ''; } }
    for (var ti = 0; ti < targets.length; ti++) {
      var tg = targets[ti];
      if (incl.length && !incl.some(function (g2) { return globToRegex(g2).test(vfs.basename(tg.shown || '')); })) continue;
      if (excl.length && excl.some(function (g3) { return globToRegex(g3).test(vfs.basename(tg.shown || '')); })) continue;
      var text = tg.stdin ? tg.text : (tg.st.kind === 'text' ? vfs.readFile(tg.abs, { by: 'terminal' }) : null);
      if (text === null) {
        if (F.c || F.l || F.L || F.q) { /* counted below as zero or a match */ }
        // a binary file: grep only says whether it matches (practice files have no text to look into)
        if (!F.q && !F.s) { /* nothing to match against */ }
        continue;
      }
      var lines = splitLines(text);
      var count = 0, lastPrinted = -1, printedAny = false;
      var matchedIdx = [];
      for (var li = 0; li < lines.length; li++) {
        var hit = matchesIn(lines[li]).length > 0;
        if (F.v) hit = !hit;
        if (hit && count < maxCount) { count++; matchedIdx.push(li); }
      }
      if (count > 0) { anyMatch = true; status = 0; }
      if (F.q) { if (anyMatch) { outBuf = ''; return 0; } continue; }
      if (F.l) { if (count > 0) emit(C('35', tg.shown) + '\n'); continue; }
      if (F.L) { if (count === 0) emit(C('35', tg.shown) + '\n'); continue; }
      if (F.c) { emit((showName ? C('35', tg.shown) + C('36', ':') : '') + count + '\n'); continue; }
      var want = {}, ctxLine = {};
      matchedIdx.forEach(function (ix) {
        want[ix] = true;
        for (var b = Math.max(0, ix - ctxB); b < ix; b++) if (!want[b]) ctxLine[b] = true;
        for (var a2 = ix + 1; a2 <= Math.min(lines.length - 1, ix + ctxA); a2++) if (!want[a2]) ctxLine[a2] = true;
      });
      var hasCtx = ctxA > 0 || ctxB > 0;
      for (var ln = 0; ln < lines.length; ln++) {
        var isMatch = !!want[ln], isCtx = !isMatch && !!ctxLine[ln];
        if (!isMatch && !isCtx) continue;
        if (hasCtx && printedAny && ln > lastPrinted + 1) emit(C('36', '--') + '\n');
        printedAny = true; lastPrinted = ln;
        if (F.o && isMatch && !F.v) {
          matchesIn(lines[ln]).forEach(function (mt) {
            emit((showName ? C('35', tg.shown) + C('36', ':') : '') + (F.n ? C('32', String(ln + 1)) + C('36', ':') : '') + C('1;31', mt.text) + '\n');
          });
          continue;
        }
        var sepCh = isMatch ? ':' : '-';
        var body = lines[ln];
        if (color && isMatch && !F.v) {
          var res = '', pos = 0;
          matchesIn(body).forEach(function (m3) {
            res += body.slice(pos, m3.index) + sgr('1;31', m3.text);
            pos = m3.index + m3.text.length;
          });
          body = res + body.slice(pos);
        }
        emit((showName ? C('35', tg.shown) + C('36', sepCh) : '') + (F.n ? C('32', String(ln + 1)) + C('36', sepCh) : '') + body + '\n');
      }
    }
    if (outBuf) ctx.out(outBuf);
    return errored ? 2 : status;
  });
  def('egrep', function (args, ctx) { return commands.grep(['-E'].concat(args), ctx); });
  def('fgrep', function (args, ctx) { return commands.grep(['-F'].concat(args), ctx); });

  /* ----------------------------------------------------------------- sort */
  USAGE.sort = ['usage: sort [-bcCdfghiRMmnrsuVz] [-kPOS1[,POS2] ... ] [+POS1 [-POS2]] [-S memsize] [-T tmpdir] [-t separator] [-o outfile] [--batch-size size] [--files0-from file] [--heapsort] [--mergesort] [--radixsort] [--qsort] [--mmap]', '\t[--parallel thread_no]', '\t[--human-numeric-sort] [--version-sort] [--random-sort [--random-source file]]', '\t[--compress-program program] [file ...]'];
  LETTERS.sort = 'bcCdfghiRMmnrsuVzkSTtoy';
  WITHARG.sort = 'kSTto';
  function keyFields(line, sep) {
    return sep === null ? line.split(/\s+/).filter(function (x, i) { return !(i === 0 && x === ''); }) : line.split(sep);
  }
  function numPrefix(str) {
    var m = /^\s*([+-]?(?:\d+\.?\d*|\.\d+))/.exec(str);
    return m ? parseFloat(m[1]) : 0;
  }
  def('sort', function* (args, ctx) {
    var s = ctx.session, vfs = s.vfs;
    var F = {}, keys = [], sep = null, outFile = null, i = 0;
    for (; i < args.length; i++) {
      var a = args[i];
      if (a === '--') { i++; break; }
      if (a.charAt(0) !== '-' || a === '-') break;
      if (a.indexOf('--') === 0) { if (a === '--reverse') F.r = true; else if (a === '--numeric-sort') F.n = true; else if (a === '--unique') F.u = true; continue; }
      for (var k = 1; k < a.length; k++) {
        var ch = a.charAt(k);
        if (LETTERS.sort.indexOf(ch) < 0) { ctx.err('sort: invalid option -- ' + ch + '\n' + USAGE.sort.join('\n') + '\n'); return 2; }
        if (WITHARG.sort.indexOf(ch) >= 0) {
          var rem = a.slice(k + 1), v;
          if (rem !== '') v = rem; else if (i + 1 < args.length) v = args[++i]; else { ctx.err('sort: option requires an argument -- ' + ch + '\n' + USAGE.sort.join('\n') + '\n'); return 2; }
          if (ch === 'k') {
            var km = /^(\d+)(?:\.\d+)?(?:([bdfgiMnrh]+))?(?:,(\d+)(?:\.\d+)?([bdfgiMnrh]*))?$/.exec(v);
            if (!km) { ctx.err('sort: invalid field specification `' + v + "'\n"); return 2; }
            keys.push({ from: parseInt(km[1], 10), to: km[3] ? parseInt(km[3], 10) : null, n: /n|g|h/.test((km[2] || '') + (km[4] || '')), r: /r/.test((km[2] || '') + (km[4] || '')), f: /f/.test((km[2] || '') + (km[4] || '')) });
          } else if (ch === 't') sep = v === '\\t' ? '\t' : v.charAt(0);
          else if (ch === 'o') outFile = v;
          break;
        }
        F[ch] = true;
      }
    }
    var files = args.slice(i);
    var g = yield* gather(ctx, files, 'sort');
    var lines = [];
    g.inputs.forEach(function (inp) { if (inp.text) lines = lines.concat(splitLines(inp.text)); });
    var coll = new Intl.Collator('en', { numeric: false, sensitivity: 'variant', caseFirst: 'lower' });
    function keyOf(line, kd) {
      var fields = keyFields(line, sep);
      var from = kd.from - 1, to = kd.to === null ? fields.length : kd.to;
      var part = fields.slice(from, to).join(sep === null ? ' ' : sep);
      return part;
    }
    function compare(a, b) {
      var r = 0;
      if (keys.length) {
        for (var q = 0; q < keys.length && r === 0; q++) {
          var kd = keys[q], ka = keyOf(a, kd), kb = keyOf(b, kd);
          if (kd.n || F.n || F.h || F.g) r = numPrefix(ka) - numPrefix(kb);
          else if (kd.f || F.f) r = coll.compare(ka.toLowerCase(), kb.toLowerCase());
          else r = coll.compare(ka, kb);
          if (kd.r) r = -r;
        }
      } else if (F.n || F.h || F.g) r = numPrefix(a) - numPrefix(b);
      else if (F.f) r = coll.compare(a.toLowerCase(), b.toLowerCase());
      else if (F.d) r = coll.compare(a.replace(/[^A-Za-z0-9 ]/g, ''), b.replace(/[^A-Za-z0-9 ]/g, ''));
      else r = coll.compare(a, b);
      return r;
    }
    var idx = lines.map(function (l, n) { return { l: l, n: n }; });
    idx.sort(function (x, y) {
      var r = compare(x.l, y.l);
      if (r === 0 && !F.s) r = coll.compare(x.l, y.l);
      if (F.r) r = -r;
      if (r === 0) r = x.n - y.n;
      return r;
    });
    var result = idx.map(function (x) { return x.l; });
    if (F.u) result = result.filter(function (l, n) { return n === 0 || compare(l, result[n - 1]) !== 0; });
    var textOut = joinLines(result);
    if (outFile !== null) {
      try { vfs.writeFile(resolvePath(s, outFile), textOut, { by: 'terminal' }); } catch (e) { ctx.err('sort: ' + outFile + ': ' + vfs.errText(e.code || 'EINVAL') + '\n'); return 2; }
    } else ctx.out(textOut);
    return g.status;
  });

  /* ----------------------------------------------------------------- uniq */
  USAGE.uniq = ['usage: uniq [-cdiu] [-D[septype]] [-f fields] [-s chars] [input [output]]'];
  LETTERS.uniq = 'cdDiufs';
  WITHARG.uniq = 'fs';
  def('uniq', function* (args, ctx) {
    var o = parseOpts('uniq', args);
    if (o.error) { ctx.err(o.error); return 1; }
    var g = yield* gather(ctx, o.rest.slice(0, 1), 'uniq');
    var lines = [];
    g.inputs.forEach(function (inp) { if (inp.text) lines = lines.concat(splitLines(inp.text)); });
    var F = o.flags, groups = [];
    function norm(l) { return F.i ? l.toLowerCase() : l; }
    lines.forEach(function (l) {
      var last = groups[groups.length - 1];
      if (last && norm(last.l) === norm(l)) last.n++; else groups.push({ l: l, n: 1 });
    });
    var res = '';
    groups.forEach(function (gr) {
      if (F.d && gr.n < 2) return;
      if (F.u && gr.n > 1) return;
      res += (F.c ? pad(String(gr.n), 4, true) + ' ' : '') + gr.l + '\n';
    });
    ctx.out(res);
    return g.status;
  });

  /* ------------------------------------------------------------------ cut */
  USAGE.cut = ['usage: cut -b list [-n] [file ...]', '       cut -c list [file ...]', '       cut -f list [-s] [-w | -d delim] [file ...]'];
  function parseList(spec) {
    var ranges = [];
    var parts = String(spec).split(',');
    for (var i = 0; i < parts.length; i++) {
      var m = /^(\d*)(-?)(\d*)$/.exec(parts[i]);
      if (!m || (m[1] === '' && m[3] === '' ) || (m[2] === '' && m[3] !== '')) return null;
      var from = m[1] === '' ? 1 : parseInt(m[1], 10), to = m[2] === '' ? from : (m[3] === '' ? Infinity : parseInt(m[3], 10));
      if (from < 1 || to < from) return null;
      ranges.push([from, to]);
    }
    return ranges;
  }
  function inRanges(n, ranges) { for (var i = 0; i < ranges.length; i++) if (n >= ranges[i][0] && n <= ranges[i][1]) return true; return false; }
  def('cut', function* (args, ctx) {
    var mode = null, list = null, delim = '\t', suppress = false, i = 0;
    for (; i < args.length; i++) {
      var a = args[i];
      if (a === '--') { i++; break; }
      if (a.charAt(0) !== '-' || a === '-') break;
      var ch = a.charAt(1), rest = a.slice(2);
      if (ch === 'f' || ch === 'c' || ch === 'b') { mode = ch; list = rest !== '' ? rest : args[++i]; }
      else if (ch === 'd') { delim = rest !== '' ? rest : args[++i]; if (delim === undefined) { ctx.err('cut: option requires an argument -- d\n' + USAGE.cut.join('\n') + '\n'); return 1; } }
      else if (ch === 's') suppress = true;
      else if (ch === 'n' || ch === 'w') { /* accepted */ }
      else { ctx.err('cut: illegal option -- ' + ch + '\n' + USAGE.cut.join('\n') + '\n'); return 1; }
    }
    if (mode === null || list === undefined || list === null) { ctx.err(USAGE.cut.join('\n') + '\n'); return 1; }
    var ranges = parseList(list);
    if (!ranges) { ctx.err('cut: [-' + mode + '] list: illegal list value\n'); return 1; }
    if (delim.length !== 1 && Array.from(delim).length !== 1) { ctx.err('cut: the delimiter must be a single character\n' + USAGE.cut.join('\n') + '\n'); return 1; }
    var g = yield* gather(ctx, args.slice(i), 'cut');
    var out = '';
    g.inputs.forEach(function (inp) {
      splitLines(inp.text || '').forEach(function (line) {
        if (mode === 'f') {
          if (line.indexOf(delim) < 0) { if (!suppress) out += line + '\n'; return; }
          var fields = line.split(delim), pick = [];
          fields.forEach(function (f, n) { if (inRanges(n + 1, ranges)) pick.push(f); });
          out += pick.join(delim) + '\n';
        } else {
          var chars = Array.from(line), res = '';
          chars.forEach(function (c, n) { if (inRanges(n + 1, ranges)) res += c; });
          out += res + '\n';
        }
      });
    });
    ctx.out(out);
    return g.status;
  });

  /* ------------------------------------------------------------------- tr */
  USAGE.tr = ['usage: tr [-Ccsu] string1 string2', '       tr [-Ccu] -d string1', '       tr [-Ccu] -s string1', '       tr [-Ccu] -ds string1 string2'];
  function trSet(str) {
    var out = [], i = 0, chars = Array.from(str);
    function esc(c, nx) { return c === 'n' ? '\n' : c === 't' ? '\t' : c === 'r' ? '\r' : c === '\\' ? '\\' : c; }
    while (i < chars.length) {
      var c = chars[i];
      if (c === '[' && chars[i + 1] === ':') {
        var close = chars.indexOf(']', i);
        var name = chars.slice(i + 2, close - 1).join('');
        var cls = { lower: 'abcdefghijklmnopqrstuvwxyz', upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', digit: '0123456789', alpha: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', space: ' \t\n\r\f\v', alnum: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', punct: '!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~' };
        if (close > 0 && cls[name]) { out = out.concat(Array.from(cls[name])); i = close + 1; continue; }
      }
      if (c === '\\' && i + 1 < chars.length) { c = esc(chars[i + 1]); i++; }
      if (chars[i + 1] === '-' && i + 2 < chars.length) {
        var end = chars[i + 2] === '\\' && i + 3 < chars.length ? esc(chars[i + 3]) : chars[i + 2];
        var a = c.codePointAt(0), b = end.codePointAt(0);
        if (b < a) return null;
        for (var cp = a; cp <= b; cp++) out.push(String.fromCodePoint(cp));
        i += (chars[i + 2] === '\\' ? 4 : 3);
        continue;
      }
      out.push(c); i++;
    }
    return out;
  }
  def('tr', function* (args, ctx) {
    var F = {}, i = 0;
    for (; i < args.length; i++) {
      var a = args[i];
      if (a === '--') { i++; break; }
      if (a.charAt(0) !== '-' || a.length < 2) break;
      for (var k = 1; k < a.length; k++) {
        if ('Ccdsu'.indexOf(a.charAt(k)) < 0) { ctx.err('tr: illegal option -- ' + a.charAt(k) + '\n' + USAGE.tr.join('\n') + '\n'); return 1; }
        F[a.charAt(k)] = true;
      }
    }
    var sets = args.slice(i);
    if (!sets.length || (!F.d && !F.s && sets.length < 2) || sets.length > 2 || (F.d && !F.s && sets.length > 1)) { ctx.err(USAGE.tr.join('\n') + '\n'); return 1; }
    var s1 = trSet(sets[0]), s2 = sets[1] !== undefined ? trSet(sets[1]) : null;
    if (!s1 || (sets[1] !== undefined && !s2)) { ctx.err('tr: invalid range\n'); return 1; }
    if (F.c || F.C) {
      var all = [];
      for (var cp = 0; cp < 256; cp++) { var chh = String.fromCharCode(cp); if (s1.indexOf(chh) < 0) all.push(chh); }
      s1 = all;
    }
    var text = ctx.stdin;
    if (text === null) text = yield* A.readStdinLines(ctx);
    var res = '', last = null;
    for (var ch of text) {
      var idx = s1.indexOf(ch), out = ch;
      if (idx >= 0) {
        if (F.d) out = null;
        else if (s2 && s2.length) out = idx < s2.length ? s2[idx] : s2[s2.length - 1];
      }
      if (out === null) continue;
      if (F.s) {
        var inSq = s2 && s2.length ? s2.indexOf(out) >= 0 : s1.indexOf(out) >= 0;
        if (inSq && last === out) continue;
      }
      res += out; last = out;
    }
    ctx.out(res);
    return 0;
  });

  /* ----------------------------------------------------------------- find */
  def('find', function* (args, ctx) {
    var s = ctx.session, vfs = s.vfs;
    var starts = [], i = 0;
    var FIND_USAGE = 'usage: find [-H | -L | -P] [-EXdsx] [-f path] path ... [expression]\n       find [-H | -L | -P] [-EXdsx] -f path [path ...] [expression]\n';
    while (i < args.length && args[i].charAt(0) === '-' && /^-[HLPEXdsx]+$/.test(args[i])) i++;
    while (i < args.length && args[i].charAt(0) !== '-' && args[i] !== '!' && args[i] !== '(') { starts.push(args[i]); i++; }
    if (!starts.length) starts.push('.');
    var tests = [], actions = [], maxDepth = Infinity, minDepth = 0, deleteIt = false, hasAction = false, execSpec = null, negate = false, print0 = false;
    function bad(msg) { ctx.err('find: ' + msg + '\n'); return 1; }
    for (; i < args.length; i++) {
      var a = args[i], v;
      var needArg = function () { if (i + 1 >= args.length) return null; return args[++i]; };
      if (a === '!' || a === '-not') { negate = !negate; continue; }
      if (a === '-a' || a === '-and') continue;
      if (a === '-o' || a === '-or') return bad('-o: 這個練習版的 find 只支援「而且」的條件');
      if (a === '-name' || a === '-iname') {
        v = needArg(); if (v === null) return bad(a + ': requires additional arguments');
        var re = new RegExp(globToRegex(v).source, a === '-iname' ? 'i' : '');
        (function (re2, ng) { tests.push(function (e) { return re2.test(e.name) !== ng; }); })(re, negate); negate = false; continue;
      }
      if (a === '-type') {
        v = needArg(); if (v === null) return bad('-type: requires additional arguments');
        if ('fdl'.indexOf(v) < 0 || v.length !== 1) return bad('-type: ' + v + ': unknown type');
        (function (t, ng) { tests.push(function (e) { var isLink = A.attrsOf(vfs).links.has(e.st.path); var k = isLink ? 'l' : e.st.type === 'dir' ? 'd' : 'f'; return (k === t) !== ng; }); })(v, negate); negate = false; continue;
      }
      if (a === '-maxdepth') { v = needArg(); if (v === null || !/^\d+$/.test(v)) return bad('-maxdepth: ' + (v === null ? 'requires additional arguments' : v + ': not a number')); maxDepth = parseInt(v, 10); continue; }
      if (a === '-mindepth') { v = needArg(); if (v === null || !/^\d+$/.test(v)) return bad('-mindepth: ' + (v === null ? 'requires additional arguments' : v + ': not a number')); minDepth = parseInt(v, 10); continue; }
      if (a === '-size') {
        v = needArg(); var sm = v === null ? null : /^([+-]?)(\d+)([ckMGb]?)$/.exec(v);
        if (!sm) return bad('-size: ' + (v === null ? 'requires additional arguments' : v + ': illegal trailing character'));
        var unit = { c: 1, k: 1024, M: 1048576, G: 1073741824, b: 512, '': 512 }[sm[3]], want = parseInt(sm[2], 10);
        (function (cmp, w, u, ng) { tests.push(function (e) { var n = Math.ceil((e.st.type === 'dir' ? 0 : e.st.size) / u); var ok = cmp === '+' ? n > w : cmp === '-' ? n < w : n === w; return ok !== ng; }); })(sm[1], want, unit, negate); negate = false; continue;
      }
      if (a === '-empty') { (function (ng) { tests.push(function (e) { var ok = e.st.type === 'dir' ? (e.st.count || 0) === 0 : e.st.size === 0; return ok !== ng; }); })(negate); negate = false; continue; }
      if (a === '-print') { hasAction = true; continue; }
      if (a === '-print0') { hasAction = true; print0 = true; continue; }
      if (a === '-delete') { deleteIt = true; hasAction = true; continue; }
      if (a === '-exec') {
        var cmdArgs = [];
        for (i++; i < args.length && args[i] !== ';' && args[i] !== '+'; i++) cmdArgs.push(args[i]);
        if (i >= args.length) return bad('-exec: no terminating ";" or "+"');
        execSpec = cmdArgs; hasAction = true; continue;
      }
      if (a === '-newer' || a === '-mtime' || a === '-user' || a === '-perm' || a === '-regex') return bad(a + ': 這個選項練習版的 find 還沒做');
      ctx.err('find: unknown primary or operator: ' + a.replace(/^-/, '') + '\n');
      return 1;
    }
    var status = 0, outText = '';
    var records = [];
    function walk(abs, shown, depth) {
      var st = vfs.stat(abs);
      if (!st) return;
      records.push({ shown: shown, abs: abs, st: st, name: depth === 0 ? vfs.basename(abs) : st.name, depth: depth });
      if (st.type === 'dir' && depth < maxDepth && !A.attrsOf(vfs).links.has(st.path)) {
        vfs.list(abs).forEach(function (c) { walk(c.path, (shown.slice(-1) === '/' ? shown : shown + '/') + c.name, depth + 1); });
      }
    }
    starts.forEach(function (st0) {
      var abs = resolvePath(s, st0);
      if (!vfs.stat(abs)) { ctx.err('find: ' + st0 + ': No such file or directory\n'); status = 1; return; }
      walk(abs, st0, 0);
    });
    for (var ri = 0; ri < records.length; ri++) {
      var e = records[ri];
      if (e.depth < minDepth) continue;
      if (!tests.every(function (t) { return t(e); })) continue;
      if (deleteIt) {
        try { if (A.protectedKind(s, e.abs)) { ctx.err('find: ' + e.shown + ': Operation not permitted\n'); status = 1; continue; } vfs.remove(e.abs, { by: 'terminal', recursive: true, force: true }); } catch (er) { /* already gone */ }
        continue;
      }
      if (execSpec) {
        var cargs = execSpec.map(function (x) { return x.split('{}').join(e.shown); });
        var r = yield* A.runCommand(cargs[0], cargs.slice(1), s, ctx.job, { stdin: null, tty: ctx.tty, errMode: 'tty' });
        if (!ctx.tty && r.stdout) ctx.out(r.stdout);
        if (r.status) status = 1;
        continue;
      }
      outText += e.shown + (print0 ? '\0' : '\n');
      if (outText.length > 3000) { ctx.out(outText); outText = ''; }
    }
    if (outText) ctx.out(outText);
    return status;
  });

  /* ------------------------------------------------------------- du, df */
  USAGE.du = ['usage: du [-Aclnx] [-H | -L | -P] [-g | -h | -k | -m] [-a | -s | -d depth] [-B blocksize] [-I mask] [-t threshold] [file ...]'];
  LETTERS.du = 'AclnxHLPghkmasdBIt';
  WITHARG.du = 'dBIt';
  function diskBytes(st) { return st.type === 'dir' ? 0 : (st.size === 0 ? 0 : Math.ceil(st.size / 4096) * 4096); }
  def('du', function (args, ctx) {
    var s = ctx.session, vfs = s.vfs;
    var o = parseOpts('du', args);
    if (o.error) { ctx.err(o.error); return 1; }
    var F = o.flags, depthMax = F.d ? parseInt(o.vals.d, 10) : Infinity;
    if (F.d && !isFinite(depthMax)) { ctx.err('du: invalid argument ' + o.vals.d + '\n'); return 1; }
    var ops = o.rest.length ? o.rest : ['.'], status = 0, grand = 0;
    function fmt(bytes) {
      if (F.h) return A.humanSize(bytes);
      if (F.k) return String(Math.ceil(bytes / 1024));
      if (F.m) return String(Math.ceil(bytes / 1048576));
      if (F.g) return String(Math.ceil(bytes / 1073741824));
      return String(Math.ceil(bytes / 512));
    }
    function size(abs, shown, depth, lines) {
      var st = vfs.stat(abs), total = diskBytes(st);
      if (st.type === 'dir') {
        vfs.list(abs).forEach(function (c) { total += size(c.path, (shown.slice(-1) === '/' ? shown : shown + '/') + c.name, depth + 1, lines); });
        if (!F.s && depth <= depthMax) lines.push(fmt(total) + '\t' + shown);
      } else if (F.a && !F.s && depth <= depthMax) lines.push(fmt(total) + '\t' + shown);
      return total;
    }
    ops.forEach(function (op) {
      var abs = resolvePath(s, op), st = vfs.stat(abs);
      if (!st) { ctx.err('du: ' + op + ': No such file or directory\n'); status = 1; return; }
      var lines = [], total = size(abs, op, 0, lines);
      if (F.s || st.type !== 'dir') lines.push(fmt(total) + '\t' + op);
      ctx.out(lines.join('\n') + '\n');
      grand += total;
    });
    if (F.c && ops.length) ctx.out(fmt(grand) + '\ttotal\n');
    return status;
  });

  USAGE.df = ['usage: df [-b | -H | -h | -k | -m | -g | -P] [-ailn] [-T type] [-t] [filesystem | file ...]'];
  LETTERS.df = 'bHhkmgPailnTt';
  var DISK_TOTAL = 494380000000, DISK_FREE = 312600000000;
  function dfRows() {
    var GiB = 1073741824, total = Math.round(DISK_TOTAL), free = Math.round(DISK_FREE);
    var sysUsed = 11.2 * GiB, vm = 6 * GiB, pre = 6.9 * GiB, upd = 5.1 * 1048576;
    var data = total - free - sysUsed - vm - pre - upd;
    return [
      { fs: '/dev/disk3s1s1', size: total, used: sysUsed, avail: free, iused: 453000, ifree: 3200000000, mount: '/' },
      { fs: 'devfs', size: 215 * 1024, used: 215 * 1024, avail: 0, iused: 745, ifree: 0, mount: '/dev' },
      { fs: '/dev/disk3s6', size: total, used: vm, avail: free, iused: 6, ifree: 3200000000, mount: '/System/Volumes/VM' },
      { fs: '/dev/disk3s2', size: total, used: pre, avail: free, iused: 864, ifree: 3200000000, mount: '/System/Volumes/Preboot' },
      { fs: '/dev/disk3s4', size: total, used: upd, avail: free, iused: 55, ifree: 3200000000, mount: '/System/Volumes/Update' },
      { fs: '/dev/disk1s2', size: 500 * 1048576, used: 6 * 1048576, avail: 479 * 1048576, iused: 1, ifree: 4900000, mount: '/System/Volumes/xarts' },
      { fs: '/dev/disk1s1', size: 500 * 1048576, used: 5.5 * 1048576, avail: 479 * 1048576, iused: 32, ifree: 4900000, mount: '/System/Volumes/iSCPreboot' },
      { fs: '/dev/disk1s3', size: 500 * 1048576, used: 1.7 * 1048576, avail: 479 * 1048576, iused: 61, ifree: 4900000, mount: '/System/Volumes/Hardware' },
      { fs: '/dev/disk3s5', size: total, used: data, avail: free, iused: 1600000, ifree: 3200000000, mount: '/System/Volumes/Data' },
      { fs: 'map auto_home', size: 0, used: 0, avail: 0, iused: 0, ifree: 0, mount: '/System/Volumes/Data/home', auto: true }
    ];
  }
  function human1024(n) {
    if (n < 1024) return Math.round(n) + 'Bi';
    var units = ['Ki', 'Mi', 'Gi', 'Ti'], v = n, i = -1;
    do { v /= 1024; i++; } while (v >= 1024 && i < units.length - 1);
    return (v < 10 ? (Math.round(v * 10) / 10).toFixed(1) : String(Math.round(v))) + units[i];
  }
  function humanCount(n) {
    if (n < 1000) return String(Math.round(n));
    if (n < 1e6) return Math.round(n / 1000) + 'k';
    if (n < 1e9) return (n / 1e6 < 10 ? (Math.round(n / 1e5) / 10).toFixed(1) : Math.round(n / 1e6)) + 'M';
    return (Math.round(n / 1e8) / 10).toFixed(1) + 'G';
  }
  def('df', function (args, ctx) {
    var o = parseOpts('df', args);
    if (o.error) { ctx.err(o.error); return 1; }
    var F = o.flags, rows = dfRows();
    if (o.rest.length) {
      var s = ctx.session, bad = false;
      o.rest.forEach(function (op) { if (!s.vfs.exists(resolvePath(s, op))) { ctx.err('df: ' + op + ': No such file or directory\n'); bad = true; } });
      if (bad) return 1;
      var wantRoot = o.rest.every(function (op) { return resolvePath(s, op) === '/'; });
      rows = rows.filter(function (r) { return r.mount === (wantRoot ? '/' : '/System/Volumes/Data'); });
    }
    var unit = F.h ? 0 : F.k ? 1024 : F.m ? 1048576 : F.g ? 1073741824 : 512;
    function num(n) { return F.h ? human1024(n) : String(Math.ceil(n / unit)); }
    var head = F.h ? ['Filesystem', 'Size', 'Used', 'Avail', 'Capacity', 'iused', 'ifree', '%iused', 'Mounted on'] : ['Filesystem', (unit === 512 ? '512-blocks' : unit === 1024 ? '1024-blocks' : unit === 1048576 ? '1M-blocks' : '1G-blocks'), 'Used', 'Available', 'Capacity', 'iused', 'ifree', '%iused', 'Mounted on'];
    var table = rows.map(function (r) {
      var cap = r.size + 0 === 0 ? '100%' : Math.round(r.used / (r.used + r.avail) * 100) + '%';
      var ip = r.iused + r.ifree === 0 ? '-' : Math.round(r.iused / (r.iused + r.ifree) * 100) + '%';
      return [r.fs, num(r.size), num(r.used), num(r.avail), r.auto ? '100%' : cap, F.h ? humanCount(r.iused) : String(r.iused), F.h ? humanCount(r.ifree) : String(r.ifree), r.auto ? '100%' : ip, r.mount];
    });
    var w = [0, 0, 0, 0, 0, 0, 0, 0];
    [head].concat(table).forEach(function (r) { for (var c = 0; c < 8; c++) w[c] = Math.max(w[c], r[c].length); });
    function line(r) {
      var t = pad(r[0], w[0]);
      for (var c = 1; c < 8; c++) t += ' ' + pad(r[c], w[c], true);
      return t + '  ' + r[8];
    }
    ctx.out(line(head) + '\n' + table.map(line).join('\n') + '\n');
    return 0;
  });

  /* ------------------------------------------------------ file, stat */
  function inodeOf(path) { var n = 0; for (var i = 0; i < path.length; i++) n = (n * 31 + path.charCodeAt(i)) % 90000000; return 12000000 + n; }
  function fileKind(st, text, vfs) {
    if (st.type === 'dir') return 'directory';
    var ext = vfs.extname(st.name).toLowerCase();
    if (st.kind === 'zip' || ext === '.zip') return 'Zip archive data, at least v2.0 to extract, compression method=deflate';
    if (ext === '.tgz' || ext === '.gz') return 'gzip compressed data, from Unix';
    if (st.kind === 'app') return 'directory';
    if (ext === '.pdf') return 'PDF document, version 1.4, 1 page(s)';
    if (ext === '.docx') return 'Microsoft Word 2007+';
    if (ext === '.xlsx') return 'Microsoft Excel 2007+';
    if (ext === '.pptx') return 'Microsoft PowerPoint 2007+';
    if (ext === '.png') return 'PNG image data, 1280 x 800, 8-bit/color RGBA, non-interlaced';
    if (ext === '.jpg' || ext === '.jpeg') return 'JPEG image data, JFIF standard 1.01, aspect ratio, density 1x1, segment length 16, baseline, precision 8, 1280x800, components 3';
    if (st.kind !== 'text') return 'data';
    if (st.size === 0) return 'empty';
    if (/^#!\s*\/(usr\/)?bin\/(env\s+)?(ba|z)?sh/.test(text)) return 'a /bin/' + (/zsh/.test(text.split('\n')[0]) ? 'zsh' : 'sh') + ' script text executable, ' + (/[^\x00-\x7f]/.test(text) ? 'Unicode text, UTF-8 text' : 'ASCII text');
    if (/^#!\s*\/usr\/bin\/(env\s+)?python/.test(text)) return 'Python script text executable, ASCII text';
    var nonAscii = /[^\x00-\x7f]/.test(text), crlf = text.indexOf('\r\n') >= 0;
    var base = ext === '.csv' && !nonAscii ? 'CSV text' : (nonAscii ? 'Unicode text, UTF-8 text' : 'ASCII text');
    if (ext === '.json' && !nonAscii) base = 'JSON text data';
    if (ext === '.html' || ext === '.htm') base = 'HTML document text';
    return base + (crlf ? ', with CRLF line terminators' : '') + (text.slice(-1) !== '\n' ? ', with no line terminators' : '');
  }
  def('file', function (args, ctx) {
    var s = ctx.session, vfs = s.vfs, F = {}, files = [], i = 0;
    for (; i < args.length; i++) {
      var a = args[i];
      if (a === '--') { i++; break; }
      if (a.charAt(0) !== '-' || a === '-') break;
      if (a === '--mime-type' || a === '--mime') { F.i = true; continue; }
      if (a === '--brief') { F.b = true; continue; }
      for (var k = 1; k < a.length; k++) {
        if ('bchiklLNnprsvzZ0'.indexOf(a.charAt(k)) < 0) { ctx.err('file: invalid option -- ' + a.charAt(k) + '\nusage: file [-bchiklLNnprsvzZ0] [--apple] [--extension] [--mime-encoding]\n            [--mime-type] [-e testname] [-F separator] [-f namefile]\n            [-m magicfiles] file ...\n       file -C [-m magicfiles]\n       file [--help]\n'); return 1; }
        F[a.charAt(k)] = true;
      }
    }
    files = args.slice(i);
    if (!files.length) { ctx.err('usage: file [-bchiklLNnprsvzZ0] [--apple] [--extension] [--mime-encoding]\n            [--mime-type] [-e testname] [-F separator] [-f namefile]\n            [-m magicfiles] file ...\n       file -C [-m magicfiles]\n       file [--help]\n'); return 1; }
    var status = 0, w = 0;
    files.forEach(function (f) { w = Math.max(w, displayWidth(f)); });
    files.forEach(function (f) {
      var abs = resolvePath(s, f, true), st = vfs.stat(abs);
      var label = F.b ? '' : f + ': ';
      if (!st) { ctx.out(label + 'cannot open `' + f + "' (No such file or directory)\n"); status = 1; return; }
      var lk = A.attrsOf(vfs).links;
      if (lk.has(st.path)) { ctx.out(label + 'symbolic link to ' + lk.get(st.path) + '\n'); return; }
      var text = st.kind === 'text' ? vfs.readFile(abs, { by: 'terminal' }) : '';
      if (F.i) {
        var mime = st.type === 'dir' ? 'inode/directory; charset=binary' : (st.kind === 'zip' ? 'application/zip; charset=binary' : st.kind === 'text' ? (st.size === 0 ? 'inode/x-empty; charset=binary' : 'text/plain; charset=' + (/[^\x00-\x7f]/.test(text) ? 'utf-8' : 'us-ascii')) : 'application/octet-stream; charset=binary');
        ctx.out(label + mime + '\n');
        return;
      }
      ctx.out(label + fileKind(st, text, vfs) + '\n');
    });
    return status;
  });

  USAGE.stat = ['usage: stat [-FLnq] [-f format | -l | -r | -s | -x] [-t timefmt] [file ...]'];
  LETTERS.stat = 'FLnqflrsxt';
  WITHARG.stat = 'ft';
  function statTime(ms) {
    var d = new Date(ms), M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], D = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return { short: M[d.getMonth()] + ' ' + (d.getDate() < 10 ? ' ' : '') + d.getDate() + ' ' + p2(d.getHours()) + ':' + p2(d.getMinutes()) + ':' + p2(d.getSeconds()) + ' ' + d.getFullYear(),
      long: D[d.getDay()] + ' ' + M[d.getMonth()] + ' ' + (d.getDate() < 10 ? ' ' : '') + d.getDate() + ' ' + p2(d.getHours()) + ':' + p2(d.getMinutes()) + ':' + p2(d.getSeconds()) + ' ' + d.getFullYear() };
  }
  def('stat', function (args, ctx) {
    var s = ctx.session, vfs = s.vfs;
    var o = parseOpts('stat', args);
    if (o.error) { ctx.err(o.error); return 1; }
    if (!o.rest.length) { ctx.err(USAGE.stat.join('\n') + '\n'); return 1; }
    var status = 0;
    o.rest.forEach(function (f) {
      var abs = resolvePath(s, f, true), st = vfs.stat(abs);
      if (!st) { ctx.err('stat: ' + f + ': stat: No such file or directory\n'); status = 1; return; }
      var attrs = A.attrsOf(vfs), lk = attrs.links.has(st.path), mode = A.modeOf(vfs, st);
      var isDir = st.type === 'dir', size = lk ? attrs.links.get(st.path).length : (isDir ? 64 + 32 * (st.count || 0) : st.size);
      var perm = A.modeString(mode, lk ? 'link' : isDir ? 'dir' : 'file');
      var tm = statTime(st.mtime), tb = statTime(st.ctime || st.mtime), ino = inodeOf(st.path);
      var nlink = isDir ? 2 + (vfs.list(st.path).filter(function (x) { return x.type === 'dir'; }).length) : 1;
      var blocks = isDir ? 0 : Math.ceil(st.size / 4096) * 8;
      if (o.flags.x) {
        ctx.out('  File: "' + f + '"\n  Size: ' + pad(String(size), 12) + 'FileType: ' + (lk ? 'Symbolic Link' : isDir ? 'Directory' : 'Regular File') + '\n  Mode: (' + ('0' + (mode & 511).toString(8)) + '/' + perm + ')         Uid: ( ' + ' 501/      an)  Gid: ( ' + '  20/   staff)\nDevice: 1,16   Inode: ' + pad(String(ino), 11) + ' Links: ' + nlink + '\nAccess: ' + tm.long + '\nModify: ' + tm.long + '\nChange: ' + tm.long + '\n Birth: ' + tb.long + '\n');
        return;
      }
      if (o.vals.f !== undefined) {
        var fmtS = o.vals.f.replace(/%(S[amcB]|[a-zA-Z%])/g, function (m, c) {
          switch (c) {
            case 'N': return f; case 'z': return String(size); case 'p': return (mode & 511).toString(8); case 'Sp': return perm;
            case 'u': return '501'; case 'Su': return 'an'; case 'g': return '20'; case 'Sg': return 'staff'; case 'i': return String(ino);
            case 'l': return String(nlink); case 'b': return String(blocks); case 'Sm': return tm.short; case 'Sa': return tm.short; case 'Sc': return tm.short; case 'SB': return tb.short;
            case 'm': return String(Math.floor(st.mtime / 1000)); case 'a': return String(Math.floor(st.mtime / 1000)); case 'T': return lk ? '@' : isDir ? '/' : (mode & 73 ? '*' : ''); case '%': return '%';
            default: return m;
          }
        });
        ctx.out(fmtS + '\n');
        return;
      }
      if (o.flags.s) { ctx.out('st_dev=16777234 st_ino=' + ino + ' st_mode=' + ((isDir ? 16384 : lk ? 40960 : 32768) | (mode & 511)).toString(8) + ' st_nlink=' + nlink + ' st_uid=501 st_gid=20 st_rdev=0 st_size=' + size + ' st_atime=' + Math.floor(st.mtime / 1000) + ' st_mtime=' + Math.floor(st.mtime / 1000) + ' st_ctime=' + Math.floor(st.mtime / 1000) + ' st_birthtime=' + Math.floor((st.ctime || st.mtime) / 1000) + ' st_blksize=4096 st_blocks=' + blocks + ' st_flags=0\n'); return; }
      ctx.out('16777234 ' + ino + ' ' + perm + ' ' + nlink + ' an staff 0 ' + size + ' "' + tm.short + '" "' + tm.short + '" "' + tm.short + '" "' + tb.short + '" 4096 ' + blocks + ' 0 ' + f + (lk ? ' -> ' + attrs.links.get(st.path) : '') + '\n');
    });
    return status;
  });

  /* ------------------------------------------------ basename, dirname, realpath */
  def('basename', function (args, ctx) {
    var list = args.filter(function (a) { return a !== '--'; });
    var multi = false, suffix = null;
    if (list[0] === '-a') { multi = true; list.shift(); }
    if (list[0] === '-s') { suffix = list[1]; multi = true; list = list.slice(2); }
    if (!list.length) { ctx.err('usage: basename string [suffix]\n       basename [-a] [-s suffix] string [...]\n'); return 1; }
    if (!multi && list.length > 2) { ctx.err('usage: basename string [suffix]\n       basename [-a] [-s suffix] string [...]\n'); return 1; }
    if (!multi && list.length === 2) { suffix = list[1]; list = [list[0]]; }
    list.forEach(function (p) {
      var b = p.replace(/\/+$/, '');
      b = b === '' ? (p === '' ? '' : '/') : b.slice(b.lastIndexOf('/') + 1);
      if (suffix && b !== suffix && b.slice(-suffix.length) === suffix) b = b.slice(0, b.length - suffix.length);
      ctx.out(b + '\n');
    });
    return 0;
  });
  def('dirname', function (args, ctx) {
    var list = args.filter(function (a) { return a !== '--'; });
    if (!list.length) { ctx.err('usage: dirname string [...]\n'); return 1; }
    list.forEach(function (p) {
      var t = p.replace(/\/+$/, '');
      if (t === '') { ctx.out((p === '' ? '.' : '/') + '\n'); return; }
      var i = t.lastIndexOf('/');
      if (i < 0) ctx.out('.\n'); else { var d = t.slice(0, i).replace(/\/+$/, ''); ctx.out((d === '' ? '/' : d) + '\n'); }
    });
    return 0;
  });
  def('realpath', function (args, ctx) {
    var s = ctx.session, vfs = s.vfs, quiet = false, status = 0;
    var list = args.filter(function (a) { if (a === '-q') { quiet = true; return false; } return a !== '--'; });
    if (!list.length) list = ['.'];
    list.forEach(function (p) {
      var abs = resolvePath(s, p);
      if (!vfs.exists(abs)) { if (!quiet) ctx.err('realpath: ' + p + ': No such file or directory\n'); status = 1; return; }
      ctx.out(vfs.canon(abs) + '\n');
    });
    return status;
  });

  /* ------------------------------------------------------ ln, readlink, chmod */
  USAGE.ln = ['usage: ln [-Ffhinsv] source_file [target_file]', '       ln [-Ffhinsv] source_file ... target_dir', '       link source_file target_file'];
  LETTERS.ln = 'Ffhinsv';
  def('ln', function (args, ctx) {
    var s = ctx.session, vfs = s.vfs;
    var o = parseOpts('ln', args);
    if (o.error) { ctx.err(o.error); return 1; }
    if (!o.rest.length) { ctx.err(USAGE.ln.join('\n') + '\n'); return 1; }
    var srcs, dstArg;
    if (o.rest.length === 1) { srcs = [o.rest[0]]; dstArg = '.'; } else { srcs = o.rest.slice(0, -1); dstArg = o.rest[o.rest.length - 1]; }
    var dst = resolvePath(s, dstArg, true), dstIsDir = vfs.isDir(dst);
    if (srcs.length > 1 && !dstIsDir) { ctx.err('ln: ' + dstArg + ': Not a directory\n'); return 1; }
    var status = 0, attrs = A.attrsOf(vfs);
    srcs.forEach(function (src) {
      var name = src.replace(/\/+$/, '').split('/').pop() || src;
      var linkPath = dstIsDir ? vfs.join(dst, name) : dst;
      var shown = dstIsDir ? dstArg.replace(/\/+$/, '') + '/' + name : dstArg;
      if (vfs.exists(linkPath)) {
        if (!o.flags.f) { ctx.err('ln: ' + shown + ': File exists\n'); status = 1; return; }
        try { vfs.remove(linkPath, { by: 'terminal', recursive: true }); } catch (e0) { /* ignore */ }
      }
      try {
        if (o.flags.s) {
          vfs.writeFile(linkPath, '', { by: 'terminal' });
          attrs.links.set(vfs.canon(linkPath), src);
        } else {
          var abs = resolvePath(s, src), st = vfs.stat(abs);
          if (!st) { ctx.err('ln: ' + src + ': No such file or directory\n'); status = 1; return; }
          if (st.type === 'dir') { ctx.err('ln: ' + src + ': Is a directory\n'); status = 1; return; }
          vfs.copy(abs, linkPath, { by: 'terminal' });          // a hard link shares the content: here a copy is as close as the practice gets
        }
        if (o.flags.v) ctx.out(shown + ' -> ' + src + '\n');
      } catch (e) { ctx.err('ln: ' + shown + ': ' + vfs.errText(e.code || 'EINVAL') + '\n'); status = 1; }
    });
    return status;
  });
  def('readlink', function (args, ctx) {
    var s = ctx.session, vfs = s.vfs, status = 1;
    var list = args.filter(function (a) { return a.charAt(0) !== '-'; });
    if (!list.length) { ctx.err('usage: readlink [-fn] [file ...]\n'); return 1; }
    var f = args.indexOf('-f') >= 0;
    list.forEach(function (p) {
      var abs = resolvePath(s, p, !f), links = A.attrsOf(vfs).links;
      if (f) { if (vfs.exists(abs)) { ctx.out(vfs.canon(abs) + '\n'); status = 0; } return; }
      var c = vfs.canon(abs);
      if (links.has(c)) { ctx.out(links.get(c) + '\n'); status = 0; }
    });
    return status;
  });

  USAGE.chmod = ['usage: chmod [-fhv] [-R [-H | -L | -P]] [-a | +a | =a  [i][# [ n]]] mode|entry file ...', '       chmod [-fhv] [-R [-H | -L | -P]] [-E | -C | -N | -i | -I] file ...'];
  /* mode: octal (755) or symbolic (u+x, a=rw, go-w, +x, comma lists) -> function(oldMode) -> newMode, or null */
  function parseMode(spec) {
    if (/^[0-7]{1,4}$/.test(spec)) { var n = parseInt(spec, 8) & 511; return function () { return n; }; }
    var clauses = spec.split(','), fns = [];
    for (var i = 0; i < clauses.length; i++) {
      var m = /^([ugoa]*)([-+=])([rwxXst]*)$/.exec(clauses[i]);
      if (!m) return null;
      var who = m[1] || 'a', bits = 0;
      var perm = { r: 4, w: 2, x: 1, X: 1, s: 0, t: 0 };
      for (var k = 0; k < m[3].length; k++) bits |= perm[m[3].charAt(k)];
      var mask = 0;
      if (who.indexOf('a') >= 0 || who.indexOf('u') >= 0) mask |= bits << 6;
      if (who.indexOf('a') >= 0 || who.indexOf('g') >= 0) mask |= bits << 3;
      if (who.indexOf('a') >= 0 || who.indexOf('o') >= 0) mask |= bits;
      (function (op, mk, wh) {
        fns.push(function (old) {
          if (op === '+') return old | mk;
          if (op === '-') return old & ~mk;
          var clear = 0;
          if (wh.indexOf('a') >= 0 || wh.indexOf('u') >= 0) clear |= 448;
          if (wh.indexOf('a') >= 0 || wh.indexOf('g') >= 0) clear |= 56;
          if (wh.indexOf('a') >= 0 || wh.indexOf('o') >= 0) clear |= 7;
          return (old & ~clear) | mk;
        });
      })(m[2], mask, who);
    }
    return function (old) { var v = old; fns.forEach(function (f) { v = f(v); }); return v & 511; };
  }
  def('chmod', function (args, ctx) {
    var s = ctx.session, vfs = s.vfs, F = {}, i = 0;
    for (; i < args.length; i++) {
      var a = args[i];
      if (a === '--') { i++; break; }
      if (/^-[fhvRHLP]+$/.test(a)) { for (var k = 1; k < a.length; k++) F[a.charAt(k)] = true; continue; }
      break;
    }
    var spec = args[i], files = args.slice(i + 1);
    if (spec === undefined || !files.length) { ctx.err(USAGE.chmod.join('\n') + '\n'); return 1; }
    var fn = parseMode(spec);
    if (!fn) { ctx.err('chmod: Invalid file mode: ' + spec + '\n'); return 1; }
    var status = 0, attrs = A.attrsOf(vfs);
    function apply(abs, shown) {
      var st = vfs.stat(abs);
      if (!st) return;
      attrs.modes.set(st.path, fn(A.modeOf(vfs, st)));
      if (F.v) ctx.out(shown + ': ' + A.modeString(attrs.modes.get(st.path), st.type === 'dir' ? 'dir' : 'file') + '\n');
      if (F.R && st.type === 'dir') vfs.list(abs).forEach(function (c) { apply(c.path, shown + '/' + c.name); });
    }
    files.forEach(function (f) {
      var abs = resolvePath(s, f);
      if (!vfs.exists(abs)) { if (!F.f) ctx.err('chmod: ' + f + ': No such file or directory\n'); status = 1; return; }
      apply(abs, f);
    });
    return status;
  });

  /* ----------------------------------------------------------------- diff */
  function lcsDiff(a, b) {
    // classic LCS table; practice files are small
    var n = a.length, m = b.length, i, j;
    var t = [];
    for (i = 0; i <= n; i++) { t.push(new Array(m + 1)); t[i][m] = 0; }
    for (j = 0; j <= m; j++) t[n][j] = 0;
    for (i = n - 1; i >= 0; i--) for (j = m - 1; j >= 0; j--) t[i][j] = a[i] === b[j] ? t[i + 1][j + 1] + 1 : Math.max(t[i + 1][j], t[i][j + 1]);
    var ops = [];
    i = 0; j = 0;
    while (i < n && j < m) {
      if (a[i] === b[j]) { ops.push({ t: '=', a: i, b: j }); i++; j++; }
      else if (t[i + 1][j] >= t[i][j + 1]) { ops.push({ t: '-', a: i }); i++; }
      else { ops.push({ t: '+', b: j }); j++; }
    }
    while (i < n) { ops.push({ t: '-', a: i }); i++; }
    while (j < m) { ops.push({ t: '+', b: j }); j++; }
    return ops;
  }
  function diffTime(ms) { var d = new Date(ms); return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()) + ' ' + p2(d.getHours()) + ':' + p2(d.getMinutes()) + ':' + p2(d.getSeconds()) + '.000000000 +0800'; }
  USAGE.diff = ['usage: diff [-aBbdilpTtw] [-c | -e | -f | -n | -q | -u] [--ignore-case]', '            [--no-ignore-case] [--normal] [--strip-trailing-cr] [--tabsize]', '            [-I pattern] [-F pattern] [-L label] file1 file2'];
  def('diff', function (args, ctx) {
    var s = ctx.session, vfs = s.vfs, F = {}, files = [];
    args.forEach(function (a) {
      if (a.charAt(0) === '-' && a.length > 1 && a.indexOf('--') !== 0) { for (var k = 1; k < a.length; k++) F[a.charAt(k)] = true; }
      else if (a.indexOf('--') === 0) { if (a === '--brief') F.q = true; else if (a === '--unified') F.u = true; else if (a === '--ignore-case') F.i = true; }
      else files.push(a);
    });
    if (files.length !== 2) { ctx.err(USAGE.diff.join('\n') + '\n'); return 2; }
    var pa = resolvePath(s, files[0]), pb = resolvePath(s, files[1]), sa = vfs.stat(pa), sb = vfs.stat(pb);
    if (!sa) { ctx.err('diff: ' + files[0] + ': No such file or directory\n'); return 2; }
    if (!sb) { ctx.err('diff: ' + files[1] + ': No such file or directory\n'); return 2; }
    if (sa.type === 'dir' && sb.type === 'dir') {
      var la = vfs.list(pa), lb = vfs.list(pb), names = {}, status = 0;
      la.forEach(function (x) { names[x.name] = names[x.name] || {}; names[x.name].a = x; });
      lb.forEach(function (x) { names[x.name] = names[x.name] || {}; names[x.name].b = x; });
      Object.keys(names).sort().forEach(function (nm) {
        var e = names[nm];
        if (!e.a) { ctx.out('Only in ' + files[1] + ': ' + nm + '\n'); status = 1; }
        else if (!e.b) { ctx.out('Only in ' + files[0] + ': ' + nm + '\n'); status = 1; }
        else if (e.a.type === 'dir' && e.b.type === 'dir') ctx.out('Common subdirectories: ' + files[0] + '/' + nm + ' and ' + files[1] + '/' + nm + '\n');
        else if (e.a.type === 'file' && e.b.type === 'file') {
          var ta = textOf(vfs, e.a.path), tb = textOf(vfs, e.b.path);
          if (ta !== tb) { ctx.out('diff ' + files[0] + '/' + nm + ' ' + files[1] + '/' + nm + '\n'); status = 1; }
        }
      });
      return status;
    }
    if (sa.type === 'dir' || sb.type === 'dir') { ctx.err('diff: ' + (sa.type === 'dir' ? files[0] : files[1]) + ': Is a directory\n'); return 2; }
    var ta2 = textOf(vfs, pa), tb2 = textOf(vfs, pb);
    if (ta2 === null || tb2 === null) { if (sa.size === sb.size && sa.kind === sb.kind) return 0; ctx.out('Binary files ' + files[0] + ' and ' + files[1] + ' differ\n'); return 1; }
    if (ta2 === tb2) return 0;
    if (F.q) { ctx.out('Files ' + files[0] + ' and ' + files[1] + ' differ\n'); return 1; }
    var A1 = splitLines(ta2), B1 = splitLines(tb2);
    if (A1.length * B1.length > 4000000) { ctx.err('diff: 檔案太大，練習版比不了\n'); return 2; }
    var cmpA = F.i ? A1.map(function (x) { return x.toLowerCase(); }) : A1, cmpB = F.i ? B1.map(function (x) { return x.toLowerCase(); }) : B1;
    var ops = lcsDiff(cmpA, cmpB);
    if (!ops.some(function (o) { return o.t !== '='; })) return 0;
    var out = '';
    if (F.u || F.c) {
      var ctxN = 3, hunks = [], cur = null;
      ops.forEach(function (op, idx) {
        if (op.t === '=') return;
        if (cur && idx - cur.end <= ctxN * 2) cur.end = idx; else { cur = { start: idx, end: idx }; hunks.push(cur); }
      });
      out += '--- ' + files[0] + '\t' + diffTime(sa.mtime) + '\n+++ ' + files[1] + '\t' + diffTime(sb.mtime) + '\n';
      hunks.forEach(function (hk) {
        var from = Math.max(0, hk.start - ctxN), to = Math.min(ops.length - 1, hk.end + ctxN);
        var aStart = null, bStart = null, aCount = 0, bCount = 0, body = '';
        for (var q = from; q <= to; q++) {
          var op = ops[q];
          if (op.t !== '+') { if (aStart === null) aStart = op.a + 1; aCount++; }
          if (op.t !== '-') { if (bStart === null) bStart = op.b + 1; bCount++; }
          body += (op.t === '=' ? ' ' + A1[op.a] : op.t === '-' ? '-' + A1[op.a] : '+' + B1[op.b]) + '\n';
        }
        if (aStart === null) aStart = (ops[from].a !== undefined ? ops[from].a : 0);
        if (bStart === null) bStart = (ops[from].b !== undefined ? ops[from].b : 0);
        out += '@@ -' + (aCount ? aStart : aStart - 1 < 0 ? 0 : aStart - 1) + (aCount === 1 ? '' : ',' + aCount) + ' +' + (bCount ? bStart : bStart - 1 < 0 ? 0 : bStart - 1) + (bCount === 1 ? '' : ',' + bCount) + ' @@\n' + body;
      });
      ctx.out(out);
      return 1;
    }
    // the normal format: 3c3, 4a5,6, 2d1
    var i = 0;
    while (i < ops.length) {
      if (ops[i].t === '=') { i++; continue; }
      var j = i, dels = [], adds = [];
      while (j < ops.length && ops[j].t !== '=') { if (ops[j].t === '-') dels.push(ops[j].a); else adds.push(ops[j].b); j++; }
      function range(list) { return list.length === 1 ? String(list[0] + 1) : (list[0] + 1) + ',' + (list[list.length - 1] + 1); }
      var before = ops.slice(0, i).filter(function (o) { return o.t !== '+'; }).length, beforeB = ops.slice(0, i).filter(function (o) { return o.t !== '-'; }).length;
      if (dels.length && adds.length) out += range(dels) + 'c' + range(adds) + '\n';
      else if (dels.length) out += range(dels) + 'd' + beforeB + '\n';
      else out += before + 'a' + range(adds) + '\n';
      dels.forEach(function (x) { out += '< ' + A1[x] + '\n'; });
      if (dels.length && adds.length) out += '---\n';
      adds.forEach(function (x) { out += '> ' + B1[x] + '\n'; });
      i = j;
    }
    ctx.out(out);
    return 1;
  });

  /* ------------------------------------------------------------ tee, xargs */
  USAGE.tee = ['usage: tee [-ai] [file ...]'];
  def('tee', function* (args, ctx) {
    var s = ctx.session, vfs = s.vfs, append = false, files = [];
    args.forEach(function (a) { if (a === '-a') append = true; else if (a === '-i') { /* ignore interrupts: accepted */ } else if (a.charAt(0) === '-' && a.length > 1 && a !== '--') { ctx.err('tee: illegal option -- ' + a.charAt(1) + '\n' + USAGE.tee.join('\n') + '\n'); files = null; } else if (a !== '--' && files) files.push(a); });
    if (files === null) return 1;
    var text = ctx.stdin, status = 0;
    if (text === null) {
      // typed lines: tee shows each one as it is entered
      var all = '';
      for (;;) { var line = yield { prompt: '' }; if (line === null) break; all += line + '\n'; ctx.out(line + '\n'); }
      text = all;
    } else ctx.out(text);
    files.forEach(function (f) {
      try { vfs.writeFile(resolvePath(s, f), text, { by: 'terminal', append: append }); }
      catch (e) { ctx.err('tee: ' + f + ': ' + vfs.errText(e.code || 'EINVAL') + '\n'); status = 1; }
    });
    return status;
  });

  USAGE.xargs = ['usage: xargs [-0opt] [-E eofstr] [-I replstr [-R replacements] [-S replsize]]', '             [-J replstr] [-L number] [-n number [-x]] [-P maxprocs] [-s size]', '             [utility [argument ...]]'];
  def('xargs', function* (args, ctx) {
    var s = ctx.session, nPer = 0, repl = null, nul = false, i = 0, trace = false;
    for (; i < args.length; i++) {
      var a = args[i];
      if (a === '--') { i++; break; }
      if (a.charAt(0) !== '-' || a.length < 2) break;
      var ch = a.charAt(1), rest = a.slice(2);
      if (ch === 'n') { nPer = parseInt(rest !== '' ? rest : args[++i], 10) || 0; }
      else if (ch === 'I') { repl = rest !== '' ? rest : args[++i]; }
      else if (ch === '0') nul = true;
      else if (ch === 't') trace = true;
      else if (ch === 'r' || ch === 'p' || ch === 'o' || ch === 'x') { /* accepted */ }
      else if (ch === 'L' || ch === 'P' || ch === 's' || ch === 'E' || ch === 'J') { if (rest === '') i++; }
      else { ctx.err('xargs: illegal option -- ' + ch + '\n' + USAGE.xargs.join('\n') + '\n'); return 1; }
    }
    var cmd = args.slice(i);
    if (!cmd.length) cmd = ['echo'];
    var text = ctx.stdin;
    if (text === null) text = yield* A.readStdinLines(ctx);
    var items;
    if (nul) items = text.split('\0').filter(function (x) { return x !== ''; });
    else if (repl !== null) items = splitLines(text);
    else {
      items = [];
      var re = /"([^"]*)"|'([^']*)'|((?:\\.|\S)+)/g, m;
      while ((m = re.exec(text)) !== null) items.push(m[1] !== undefined ? m[1] : m[2] !== undefined ? m[2] : m[3].replace(/\\(.)/g, '$1'));
    }
    if (!items.length) return 0;
    var batches = [];
    if (repl !== null) batches = items.map(function (it) { return cmd.map(function (c) { return c.split(repl).join(it); }); });
    else if (nPer > 0) { for (var b = 0; b < items.length; b += nPer) batches.push(cmd.concat(items.slice(b, b + nPer))); }
    else batches = [cmd.concat(items)];
    var status = 0;
    for (var bi = 0; bi < batches.length; bi++) {
      var full = batches[bi];
      if (trace) ctx.err(full.join(' ') + '\n');
      var r = yield* A.runCommand(full[0], full.slice(1), s, ctx.job, { stdin: null, tty: ctx.tty, errMode: 'tty' });
      if (!ctx.tty && r.stdout) ctx.out(r.stdout);
      if (r.status === 127) { status = 127; break; }
      if (r.status) status = 123;
    }
    return status;
  });

  /* ============================================================ archives */
  function zipPct(content) {
    var n = utf8len(content || '');
    if (n < 24) return 0;
    var words = (content.match(/\S+/g) || []);
    var uniq = {}; words.forEach(function (w) { uniq[w] = 1; });
    var ratio = words.length ? Object.keys(uniq).length / words.length : 1;
    return Math.max(3, Math.min(86, Math.round((1 - ratio) * 70 + 22 + (n % 7))));
  }
  /* the name an archive entry gets: the path as typed, without ./ and ../ (what zip and tar store) */
  function entryName(typed) {
    var parts = String(typed).split('/').filter(function (p) { return p !== '' && p !== '.' && p !== '..'; });
    return parts.join('/');
  }

  USAGE.zip = ['Copyright (c) 1990-2008 Info-ZIP - Type \'zip "-L"\' for software license.', 'Zip 3.0 (July 5th 2008). Usage:', 'zip [-options] [-b path] [-t mmddyyyy] [-n suffixes] [zipfile list] [-xi list]', '  The default action is to add or replace zipfile entries from list, which', '  can include the special name - to compress standard input.', '  If zipfile and list are omitted, zip compresses stdin to stdout.', '  -f   freshen: only changed files  -u   update: only changed or new files', '  -d   delete entries in zipfile    -m   move into zipfile (delete OS files)', '  -r   recurse into directories     -j   junk (don\'t record) directory names', '  -0   store only                   -l   convert LF to CR LF (-ll CR LF to LF)', '  -1   compress faster              -9   compress better', '  -q   quiet operation              -v   verbose operation/print version info', '  -c   add one-line comments        -z   add zipfile comment', '  -@   read names from stdin        -o   make zipfile as old as latest entry', '  -x   exclude the following names  -i   include only the following names', '  -F   fix zipfile (-FF try harder) -D   do not add directory entries', '  -A   adjust self-extracting exe   -J   junk zipfile prefix (unzipsfx)', '  -T   test zipfile integrity       -X   eXclude eXtra file attributes', '  -y   store symbolic links as the link instead of the referenced file', '  -e   encrypt                      -n   don\'t compress these suffixes', '  -h2  show more help'];
  def('zip', function (args, ctx) {
    var s = ctx.session, vfs = s.vfs, F = {}, rest = [], i = 0, excl = [];
    for (; i < args.length; i++) {
      var a = args[i];
      if (a === '--') { i++; break; }
      if (a === '-x') { excl = args.slice(i + 1); break; }
      if (a.charAt(0) === '-' && a.length > 1 && /^-[a-zA-Z0-9@]+$/.test(a)) { for (var k = 1; k < a.length; k++) F[a.charAt(k)] = true; continue; }
      rest.push(a);
    }
    if (!rest.length) { ctx.out(USAGE.zip.join('\n') + '\n'); return 0; }
    var archive = rest[0], files = rest.slice(1);
    if (archive.indexOf('.') < 0 || archive.slice(-1) === '/') archive += '.zip';
    if (!files.length) { ctx.err('\nzip error: Nothing to do! (' + archive + ')\n'); return 15; }
    var srcs = [], names = [], shown = [], missing = 0;
    files.forEach(function (f) {
      if (excl.some(function (g) { return globToRegex(g).test(f); })) return;
      var abs = resolvePath(s, f), st = vfs.stat(abs);
      if (!st) { ctx.err('\tzip warning: name not matched: ' + f + '\n'); missing++; return; }
      srcs.push(abs);
      names.push(F.j ? st.name : (entryName(f) || st.name));
      shown.push(f);
    });
    if (!srcs.length) { ctx.err('\nzip error: Nothing to do! (' + archive + ')\n'); return 12; }
    var dest = resolvePath(s, archive);
    var res = vfs.zipCreate(srcs, dest, { by: 'terminal', names: names, shallow: !F.r });
    if (!res.ok) {
      ctx.err('\nzip error: ' + (res.error === 'ENOSPC' ? 'Out of memory (練習版放不下這麼多檔案)' : 'Could not create output file (' + archive + ')') + '\n');
      return 15;
    }
    if (!F.q) {
      var ents = vfs.zipEntries(res.path) || [];
      ents.forEach(function (e) {
        if (F.j && e.type === 'dir') return;
        var stored = e.type === 'dir' || (!e.bin && utf8len(e.content) < 24) || F['0'];
        var pct = stored ? 0 : (e.bin !== undefined ? 8 : zipPct(e.content));
        ctx.out('  adding: ' + e.name + ' (' + (stored ? 'stored 0%' : 'deflated ' + pct + '%') + ')\n');
      });
    }
    return missing ? 12 : 0;
  });

  USAGE.tar = ['usage:'];
  def('tar', function (args, ctx) {
    var s = ctx.session, vfs = s.vfs;
    if (args[0] === '--version') { ctx.out('bsdtar 3.5.3 - libarchive 3.7.4 zlib/1.2.12 liblzma/5.4.3 bz2lib/1.0.8\n'); return 0; }
    var mode = null, verbose = false, file = null, dir = null, i = 0, members = [];
    var list = args.slice();
    // old style: `tar czf out.tgz dir` (letters without a dash)
    if (list.length && list[0].charAt(0) !== '-' && /^[cxtrufzjJvpkPaAC]+$/.test(list[0])) list[0] = '-' + list[0];
    for (; i < list.length; i++) {
      var a = list[i];
      if (a === '--') { i++; break; }
      if (a.charAt(0) !== '-' || a.length < 2) break;
      if (a.indexOf('--') === 0) {
        if (a === '--create') mode = 'c'; else if (a === '--extract' || a === '--get') mode = 'x'; else if (a === '--list') mode = 't'; else if (a === '--verbose') verbose = true;
        else if (a === '--file') file = list[++i]; else if (a.indexOf('--file=') === 0) file = a.slice(7);
        else if (a === '--directory') dir = list[++i]; else if (a.indexOf('--gzip') === 0 || a === '--bzip2' || a === '--xz') { /* accepted */ }
        else { ctx.err('tar: Option ' + a + ' is not supported\nUsage:\n  List:    tar -tf <archive-filename>\n  Extract: tar -xf <archive-filename>\n  Create:  tar -cf <archive-filename> [filenames...]\n  Help:    tar --help\n'); return 1; }
        continue;
      }
      for (var k = 1; k < a.length; k++) {
        var ch = a.charAt(k);
        if (ch === 'c' || ch === 'x' || ch === 't' || ch === 'r' || ch === 'u') mode = ch;
        else if (ch === 'v') verbose = true;
        else if (ch === 'f') { var rem = a.slice(k + 1); file = rem !== '' ? rem : list[++i]; break; }
        else if (ch === 'C') { var rem2 = a.slice(k + 1); dir = rem2 !== '' ? rem2 : list[++i]; break; }
        else if ('zjJpkPaAOmoU'.indexOf(ch) >= 0) { /* accepted */ }
        else { ctx.err('tar: Option -' + ch + ' is not supported\nUsage:\n  List:    tar -tf <archive-filename>\n  Extract: tar -xf <archive-filename>\n  Create:  tar -cf <archive-filename> [filenames...]\n  Help:    tar --help\n'); return 1; }
      }
    }
    members = list.slice(i);
    if (!mode) { ctx.err('tar: Must specify one of -c, -r, -t, -u, -x\n'); return 1; }
    if (file === null || file === undefined) { ctx.err('tar: no archive specified\n'); return 1; }
    var base = dir ? resolvePath(s, dir) : s.cwd;
    if (dir && !vfs.isDir(base)) { ctx.err('tar: could not chdir to \'' + dir + '\'\n'); return 1; }
    function inBase(p) { return vfs.normalize(p, base); }
    if (mode === 'c' || mode === 'r' || mode === 'u') {
      if (!members.length) { ctx.err('tar: no files or directories specified\n'); return 1; }
      var srcs = [], names = [], bad = 0;
      members.forEach(function (m) {
        var abs = vfs.normalize(m, base), st = vfs.stat(abs);
        if (!st) { ctx.err('tar: ' + m + ': Cannot stat: No such file or directory\n'); bad++; return; }
        srcs.push(abs); names.push(entryName(m) || st.name);
      });
      if (!srcs.length) { ctx.err('tar: Error exiting with failure status due to previous errors\n'); return 1; }
      var res = vfs.zipCreate(srcs, vfs.normalize(file, s.cwd), { by: 'terminal', names: names });
      if (!res.ok) { ctx.err('tar: Cannot open ' + file + ': ' + vfs.errText(res.error) + '\ntar: Error exit delayed from previous errors.\n'); return 1; }
      if (verbose) (vfs.zipEntries(res.path) || []).forEach(function (e) { ctx.err('a ' + e.name.replace(/\/$/, '') + '\n'); });
      return bad ? 1 : 0;
    }
    var zp = resolvePath(s, file), zst = vfs.stat(zp);
    if (!zst) { ctx.err('tar: Error opening archive: Failed to open \'' + file + '\'\n'); return 1; }
    var ents = zst.type === 'file' ? vfs.zipEntries(zp) : null;
    if (!ents) { ctx.err('tar: Unrecognized archive format\ntar: Error exit delayed from previous errors.\n'); return 1; }
    if (mode === 't') {
      ents.forEach(function (e) {
        if (members.length && !members.some(function (m) { return e.name.replace(/\/$/, '') === m.replace(/\/$/, '') || e.name.indexOf(m.replace(/\/$/, '') + '/') === 0; })) return;
        if (verbose) {
          var size = e.type === 'dir' ? 0 : (e.bin !== undefined ? e.bin : utf8len(e.content));
          ctx.out((e.type === 'dir' ? 'drwxr-xr-x' : '-rw-r--r--') + '  0 an     staff ' + pad(String(size), 7, true) + ' ' + LAB.util.fmt.lsDate(e.mtime) + ' ' + e.name + '\n');
        } else ctx.out(e.name + '\n');
      });
      return 0;
    }
    var want = members.map(function (m) { return m.replace(/\/$/, ''); });
    var filter = want.length ? function (nm) { var t = nm.replace(/\/$/, ''); return want.some(function (m) { return t === m || t.indexOf(m + '/') === 0 || m.indexOf(t + '/') === 0; }); } : undefined;
    var r = vfs.zipExtract(zp, base, { by: 'terminal', filter: filter });
    if (!r.ok) { ctx.err('tar: Cannot extract: ' + vfs.errText(r.error) + '\ntar: Error exit delayed from previous errors.\n'); return 1; }
    if (verbose) ents.forEach(function (e) { if (!filter || filter(e.name)) ctx.err('x ' + e.name.replace(/\/$/, '') + '\n'); });
    return 0;
  });

  /* ========================================== clipboard, speech, editors */
  def('pbcopy', function* (args, ctx) {
    var text = ctx.stdin;
    if (text === null) text = yield* A.readStdinLines(ctx);
    LAB.clipboard.setText(text);
    return 0;
  });
  def('pbpaste', function (args, ctx) {
    ctx.out(LAB.clipboard.text || '');
    return 0;
  });
  def('say', function (args, ctx) {
    var words = args.filter(function (a) { return a.charAt(0) !== '-' || a === '-'; });
    var vi = args.indexOf('-v');
    if (vi >= 0) { words = args.filter(function (a, n) { return a.charAt(0) !== '-' && n !== vi + 1; }); }
    if (!words.length && ctx.stdin !== null) words = [ctx.stdin.replace(/\s+$/, '')];
    if (!words.length) { ctx.err('usage: say [-v voice] [-r rate] [-o outfile [audio format options]] [-f file | string ...]\n'); return 1; }
    ctx.out('（練習版的 say 不會發出聲音；真的 Mac 會把「' + words.join(' ') + '」唸出來）\n');
    return 0;
  });
  def('code', function (args, ctx) {
    var s = ctx.session, vfs = s.vfs, targets = args.filter(function (a) { return a.charAt(0) !== '-'; });
    if (!targets.length) { ctx.effect({ type: 'launch', appId: 'code' }); return 0; }
    var status = 0;
    targets.forEach(function (t) {
      var abs = resolvePath(s, t);
      if (!vfs.exists(abs)) {
        // like the real `code newfile.txt`: it opens an empty window for a file that does not exist yet; here it just opens Code
        ctx.effect({ type: 'launch', appId: 'code' });
        return;
      }
      ctx.effect({ type: 'open', path: vfs.canon(abs), appId: 'code' });
    });
    return status;
  });
  def('codex', function (args, ctx) {
    ctx.out('（練習版）這台練習電腦的 Codex 是 Dock 上的 Codex App，不是終端機指令。請點 Dock 的 Codex，再把資料夾拖進去。\n');
    return 0;
  });
  def('mdfind', function (args, ctx) {
    var s = ctx.session, vfs = s.vfs, only = null, term = [], i = 0;
    for (; i < args.length; i++) {
      if (args[i] === '-onlyin') { only = args[++i]; continue; }
      if (args[i] === '-name') { term.push(args[++i]); continue; }
      if (args[i].charAt(0) === '-' && args[i] !== '-') continue;
      term.push(args[i]);
    }
    if (!term.length) { ctx.err('Usage: mdfind [-live] [-count] [-onlyin directory] [-name fileName] [-literal] [-interpret] query\n'); return 1; }
    var q = term.join(' ').toLowerCase(), base = only ? resolvePath(s, only) : '/Users/an', out = [];
    try {
      vfs.walk(base, function (st, depth) {
        if (depth === 0 || st.path.indexOf('/.Trash') >= 0 || st.path.indexOf('/Library') === HOME.length) return;
        if (st.name.toLowerCase().indexOf(q) >= 0) out.push(st.path);
      });
    } catch (e) { return 0; }
    if (out.length) ctx.out(out.join('\n') + '\n');
    return 0;
  });

  /* ------------------------------------------------- sh, bash, zsh, scripts */
  function shellCommand(name) {
    return function* (args, ctx) {
      var s = ctx.session, vfs = s.vfs;
      var i = 0, cmdText = null;
      while (i < args.length && args[i].charAt(0) === '-' && args[i] !== '-') {
        if (args[i] === '-c') { cmdText = args[i + 1]; i += 2; break; }
        i++;
      }
      if (cmdText !== null) {
        if (cmdText === undefined) { ctx.err(name + ': -c: option requires an argument\n'); return 2; }
        return yield* ctx.runLine(cmdText);
      }
      if (i < args.length) {
        var abs = resolvePath(s, args[i]), st = vfs.stat(abs);
        if (!st) { ctx.err(name + ': ' + args[i] + ': No such file or directory\n'); return 127; }
        if (st.type === 'dir') { ctx.err(name + ': ' + args[i] + ': Is a directory\n'); return 126; }
        if (st.kind !== 'text') { ctx.err(name + ': ' + args[i] + ': cannot execute binary file\n'); return 126; }
        var text = vfs.readFile(abs, { by: 'terminal' });
        var saved = {};
        for (var k = 0; k < 9; k++) saved[k] = hasOwn.call(s.env, String(k)) ? s.env[String(k)] : undefined;
        s.env['0'] = args[i];
        args.slice(i + 1).forEach(function (a, idx) { if (idx < 9) s.env[String(idx + 1)] = a; });
        try { return yield* ctx.runLine(text.replace(/^#!.*\n?/, '')); }
        finally { Object.keys(saved).forEach(function (kk) { if (saved[kk] === undefined) delete s.env[kk]; else s.env[kk] = saved[kk]; }); }
      }
      if (ctx.stdin !== null) return yield* ctx.runLine(ctx.stdin);
      if (name === 'bash' || name === 'sh') ctx.out('The default interactive shell is now zsh.\nTo update your account to use zsh, please run `chsh -s /bin/zsh`.\nFor more details, please visit https://support.apple.com/kb/HT208050.\n');
      ctx.out('（練習版不能再開一層殼層；要離開請直接用目前這個視窗）\n');
      return 0;
    };
  }
  def('sh', shellCommand('sh'));
  def('bash', shellCommand('bash'));
  def('zsh', shellCommand('zsh'));

  /* ------------------------------------------------------------ test, [ */
  function testExpr(ctx, args) {
    var s = ctx.session, vfs = s.vfs, p = 0;
    function fail(m) { throw new Error(m); }
    function fileOf(x) { return resolvePath(s, x); }
    function unary(op, v) {
      var abs, st;
      switch (op) {
        case '-z': return v === '';
        case '-n': return v !== '';
        case '-e': return vfs.exists(fileOf(v));
        case '-f': st = vfs.stat(fileOf(v)); return !!st && st.type === 'file';
        case '-d': return vfs.isDir(fileOf(v));
        case '-s': st = vfs.stat(fileOf(v)); return !!st && (st.type === 'dir' || st.size > 0);
        case '-r': case '-w': return vfs.exists(fileOf(v));
        case '-x': st = vfs.stat(fileOf(v)); return !!st && (A.modeOf(vfs, st) & 73) !== 0;
        case '-L': return A.attrsOf(vfs).links.has(vfs.canon(fileOf(v)));
        default: fail('unknown condition: ' + op);
      }
      return false;
    }
    var UN = { '-z': 1, '-n': 1, '-e': 1, '-f': 1, '-d': 1, '-s': 1, '-r': 1, '-w': 1, '-x': 1, '-L': 1 };
    var BIN = { '=': 1, '==': 1, '!=': 1, '-eq': 1, '-ne': 1, '-lt': 1, '-le': 1, '-gt': 1, '-ge': 1, '<': 1, '>': 1 };
    function num(x) { if (!/^-?\d+$/.test(x)) fail('integer expression expected: ' + x); return parseInt(x, 10); }
    function primary() {
      var t = args[p];
      if (t === undefined) fail('argument expected');
      if (t === '(') { p++; var v = orE(); if (args[p] !== ')') fail("')' expected"); p++; return v; }
      if (UN[t] && p + 1 < args.length && !(BIN[args[p + 1]] && p + 2 < args.length)) { p += 2; return unary(t, args[p - 1]); }
      if (p + 2 < args.length + 0 && BIN[args[p + 1]]) {
        var a = args[p], op = args[p + 1], b = args[p + 2];
        p += 3;
        switch (op) {
          case '=': case '==': return a === b;
          case '!=': return a !== b;
          case '<': return a < b;
          case '>': return a > b;
          case '-eq': return num(a) === num(b);
          case '-ne': return num(a) !== num(b);
          case '-lt': return num(a) < num(b);
          case '-le': return num(a) <= num(b);
          case '-gt': return num(a) > num(b);
          case '-ge': return num(a) >= num(b);
        }
      }
      p++;
      return t !== '';
    }
    function notE() { if (args[p] === '!') { p++; return !notE(); } return primary(); }
    function andE() { var v = notE(); while (args[p] === '-a') { p++; var r = notE(); v = v && r; } return v; }
    function orE() { var v = andE(); while (args[p] === '-o') { p++; var r = andE(); v = v || r; } return v; }
    if (!args.length) return false;
    var res = orE();
    if (p < args.length) fail('too many arguments');
    return res;
  }
  def('test', function (args, ctx) {
    try { return testExpr(ctx, args) ? 0 : 1; } catch (e) { ctx.err('test: ' + e.message + '\n'); return 2; }
  });
  def('[', function (args, ctx) {
    if (args[args.length - 1] !== ']') { ctx.err("[: ']' expected\n"); return 2; }
    try { return testExpr(ctx, args.slice(0, -1)) ? 0 : 1; } catch (e) { ctx.err('[: ' + e.message + '\n'); return 2; }
  });

  /* ------------------------------------------------------------- printf */
  function printfEscapes(str, forB) {
    var out = '';
    for (var i = 0; i < str.length; i++) {
      var c = str.charAt(i);
      if (c !== '\\' || i + 1 >= str.length) { out += c; continue; }
      var n = str.charAt(++i);
      switch (n) {
        case 'n': out += '\n'; break; case 't': out += '\t'; break; case 'r': out += '\r'; break; case 'a': out += '\x07'; break;
        case 'b': out += '\b'; break; case 'f': out += '\f'; break; case 'v': out += '\v'; break; case '\\': out += '\\'; break;
        case '"': out += '"'; break; case "'": out += "'"; break;
        case 'c': if (forB) return out; out += '\\c'; break;
        case 'x': { var hx = /^[0-9a-fA-F]{1,2}/.exec(str.slice(i + 1)); if (hx) { out += String.fromCharCode(parseInt(hx[0], 16)); i += hx[0].length; } else out += '\\x'; break; }
        default:
          if (/[0-7]/.test(n)) { var oc = /^[0-7]{1,3}/.exec(str.slice(i)); out += String.fromCharCode(parseInt(oc[0], 8)); i += oc[0].length - 1; }
          else out += '\\' + n;
      }
    }
    return out;
  }
  function printfFormat(fmt, args) {
    var out = '', ai = 0, round = 0, usedArg;
    do {
      usedArg = false;
      var re = /%([-+ 0#]*)(\d+|\*)?(?:\.(\d+))?([diufFeEgGsScxXob%])|\\./g;
      var last = 0, m;
      var text = '';
      while ((m = re.exec(fmt)) !== null) {
        text += printfEscapes(fmt.slice(last, m.index));
        last = re.lastIndex;
        if (m[0].charAt(0) === '\\') { text += printfEscapes(m[0]); continue; }
        var conv = m[4];
        if (conv === '%') { text += '%'; continue; }
        var width = m[2] === '*' ? parseInt(args[ai++], 10) || 0 : (m[2] ? parseInt(m[2], 10) : 0);
        var prec = m[3] !== undefined ? parseInt(m[3], 10) : null;
        var arg = ai < args.length ? args[ai++] : null;
        if (arg !== null) usedArg = true;
        var flags = m[1] || '', body;
        if (conv === 's' || conv === 'S') { body = arg === null ? '' : String(arg); if (prec !== null) body = Array.from(body).slice(0, prec).join(''); }
        else if (conv === 'b') body = arg === null ? '' : printfEscapes(String(arg), true);
        else if (conv === 'c') body = arg === null ? '' : Array.from(String(arg))[0] || '';
        else {
          var nv = arg === null ? 0 : (/^0[xX]/.test(arg) ? parseInt(arg, 16) : parseFloat(arg));
          if (isNaN(nv)) nv = 0;
          if (conv === 'd' || conv === 'i' || conv === 'u') { body = String(Math.trunc(nv)); if (prec !== null) while (body.replace('-', '').length < prec) body = body.replace(/^(-?)/, '$10'); }
          else if (conv === 'f' || conv === 'F') body = nv.toFixed(prec === null ? 6 : prec);
          else if (conv === 'e' || conv === 'E') { body = nv.toExponential(prec === null ? 6 : prec).replace(/e([+-])(\d)$/, 'e$10$2'); if (conv === 'E') body = body.toUpperCase(); }
          else if (conv === 'g' || conv === 'G') body = String(parseFloat(nv.toPrecision(prec === null ? 6 : (prec || 1))));
          else if (conv === 'x') body = Math.trunc(nv).toString(16);
          else if (conv === 'X') body = Math.trunc(nv).toString(16).toUpperCase();
          else if (conv === 'o') body = Math.trunc(nv).toString(8);
          if ((conv === 'd' || conv === 'i' || conv === 'f' || conv === 'F' || conv === 'e' || conv === 'g') && flags.indexOf('+') >= 0 && nv >= 0) body = '+' + body;
          else if ((conv === 'd' || conv === 'i' || conv === 'f') && flags.indexOf(' ') >= 0 && nv >= 0) body = ' ' + body;
        }
        if (width && displayWidth(body) < width) {
          var fillN = width - displayWidth(body);
          if (flags.indexOf('-') >= 0) body += new Array(fillN + 1).join(' ');
          else if (flags.indexOf('0') >= 0 && conv !== 's' && conv !== 'c' && conv !== 'b') { var sign = /^[+-]/.test(body) ? body.charAt(0) : ''; body = sign + new Array(fillN + 1).join('0') + body.slice(sign.length); }
          else body = new Array(fillN + 1).join(' ') + body;
        }
        text += body;
      }
      text += printfEscapes(fmt.slice(last));
      out += text;
      round++;
    } while (ai < args.length && usedArg && round < 1000);
    return out;
  }
  def('printf', function (args, ctx) {
    if (!args.length) { ctx.err('printf: not enough arguments\n'); return 1; }
    var list = args[0] === '--' ? args.slice(1) : args;
    ctx.out(printfFormat(list[0], list.slice(1)));
    return 0;
  });

  /* ------------------------------------------------- seq, expr, bc, yes */
  USAGE.seq = ['usage: seq [-w] [-f format] [-s string] [-t string] [first [incr]] last'];
  def('seq', function (args, ctx) {
    var sepS = '\n', fmt = null, wide = false, nums = [], i = 0, term = '\n';
    for (; i < args.length; i++) {
      var a = args[i];
      if (a === '-w') wide = true;
      else if (a === '-s') sepS = printfEscapes(args[++i] || '');
      else if (a === '-t') term = printfEscapes(args[++i] || '');
      else if (a === '-f') fmt = args[++i];
      else if (/^-[0-9.]/.test(a) || a.charAt(0) !== '-') nums.push(a);
      else { ctx.err('seq: illegal option -- ' + a.charAt(1) + '\n' + USAGE.seq.join('\n') + '\n'); return 1; }
    }
    if (!nums.length || nums.length > 3) { ctx.err(USAGE.seq.join('\n') + '\n'); return 1; }
    var vals = nums.map(parseFloat);
    if (vals.some(isNaN)) { ctx.err('seq: invalid floating point argument: ' + nums[vals.findIndex(isNaN)] + '\n'); return 1; }
    var first = nums.length === 1 ? 1 : vals[0], last = vals[nums.length - 1], inc = nums.length === 3 ? vals[1] : (first <= last ? 1 : -1);
    if (inc === 0 || (inc > 0 && first > last) || (inc < 0 && first < last)) { if (inc === 0) { ctx.err('seq: zero increment\n'); return 1; } return 0; }
    var dec = 0; nums.forEach(function (x) { var d = (x.split('.')[1] || '').length; if (d > dec) dec = d; });
    var out = [], count = 0;
    for (var v = first; inc > 0 ? v <= last + 1e-9 : v >= last - 1e-9; v += inc) {
      if (++count > 100000) break;
      var t = dec ? v.toFixed(dec) : String(Math.round(v));
      out.push(t);
    }
    if (wide) { var w = 0; out.forEach(function (x) { w = Math.max(w, x.length); }); out = out.map(function (x) { var neg = x.charAt(0) === '-'; var b = neg ? x.slice(1) : x; while (b.length < w - (neg ? 1 : 0)) b = '0' + b; return (neg ? '-' : '') + b; }); }
    if (fmt) out = out.map(function (x) { return printfFormat(fmt, [x]); });
    ctx.out(out.join(sepS) + (fmt ? '' : term));
    return 0;
  });
  function exprNumStr(v) { return String(Math.abs(v) < 1e15 ? Math.round(v * 1e10) / 1e10 : v); }
  def('expr', function (args, ctx) {
    if (!args.length) { ctx.err('usage: expr expression\n'); return 2; }
    if (args[0] === 'length' && args.length === 2) { ctx.out(Array.from(args[1]).length + '\n'); return Array.from(args[1]).length ? 0 : 1; }
    if (args[0] === 'substr' && args.length === 4) { var sub = Array.from(args[1]).slice(parseInt(args[2], 10) - 1, parseInt(args[2], 10) - 1 + parseInt(args[3], 10)).join(''); ctx.out(sub + '\n'); return sub ? 0 : 1; }
    if (args.length === 3 && args[1] === ':') {
      var re; try { re = new RegExp('^(?:' + args[2] + ')'); } catch (e0) { ctx.err('expr: syntax error\n'); return 2; }
      var mm = re.exec(args[0]);
      ctx.out((mm ? mm[0].length : 0) + '\n');
      return mm && mm[0].length ? 0 : 1;
    }
    try {
      var v = A.calcEval(args.join(' '), { get: function () { return '0'; } });
      ctx.out(exprNumStr(v) + '\n');
      return v === 0 ? 1 : 0;
    } catch (e) {
      ctx.err('expr: ' + (e.message === 'division by zero' ? 'division by zero' : 'syntax error') + '\n');
      return 2;
    }
  });
  var BC_BANNER = 'bc 1.06\nCopyright 1991-1994, 1997, 1998, 2000 Free Software Foundation, Inc.\nThis is free software with ABSOLUTELY NO WARRANTY.\nFor details type `warranty\'. \n';
  function bcSession(scale0, mathLib) {
    var st = { vars: Object.create(null), scale: scale0 || 0 };
    function fmtNum(v, isDiv) {
      if (!isFinite(v)) return '0';
      var sc = st.scale, txt;
      if (Number.isInteger(v) && !isDiv) txt = String(v);
      else {
        var p = Math.pow(10, sc);
        var t = Math.trunc(v * p + (v < 0 ? -1e-9 : 1e-9)) / p;
        txt = sc > 0 ? t.toFixed(sc) : String(Math.trunc(v));
      }
      return txt.replace(/^(-?)0\./, '$1.');
    }
    var fns = { sqrt: Math.sqrt, s: Math.sin, c: Math.cos, l: Math.log, e: Math.exp, a: Math.atan, length: function (x) { return String(Math.abs(x)).replace('.', '').length; } };
    st.line = function (src) {
      var out = '';
      var stmts = src.split(/[;\n]/);
      for (var i = 0; i < stmts.length; i++) {
        var t = stmts[i].trim();
        if (!t) continue;
        if (t === 'quit' || t === 'halt') return { out: out, quit: true };
        var m = /^([A-Za-z_][A-Za-z0-9_]*)\s*=(?!=)\s*(.+)$/.exec(t);
        try {
          if (m) {
            var v = A.calcEval(m[2], { get: function (n) { return String(st.vars[n] || 0); }, scale: st.scale, caret: true, fns: fns });
            if (m[1] === 'scale') st.scale = Math.max(0, Math.floor(v)); else st.vars[m[1]] = v;
          } else if (t === 'scale') out += st.scale + '\n';
          else {
            var r = A.calcEval(t, { get: function (n) { return n === 'scale' ? String(st.scale) : String(st.vars[n] || 0); }, scale: st.scale, caret: true, fns: fns });
            out += fmtNum(r, /\//.test(t)) + '\n';
          }
        } catch (e) { out += (e.message === 'division by zero' ? 'Runtime error (func=(main), adr=3): Divide by zero' : '(standard_in) 1: syntax error') + '\n'; }
      }
      return { out: out, quit: false };
    };
    return st;
  }
  def('bc', function* (args, ctx) {
    var l = args.indexOf('-l') >= 0, q = args.indexOf('-q') >= 0 || args.indexOf('-l') >= 0 && false;
    var st = bcSession(l ? 20 : 0);
    var files = args.filter(function (a) { return a.charAt(0) !== '-'; });
    if (ctx.stdin !== null) {
      var res = st.line(ctx.stdin);
      ctx.out(res.out);
      return 0;
    }
    if (files.length) {
      var txt = '';
      files.forEach(function (f) { var t = textOf(ctx.session.vfs, resolvePath(ctx.session, f)); if (t !== null) txt += t + '\n'; });
      ctx.out(st.line(txt).out);
    }
    if (!q) ctx.out(BC_BANNER);
    for (;;) {
      var line = yield { prompt: '' };
      if (line === null) break;
      var r = st.line(line);
      ctx.out(r.out);
      if (r.quit) break;
    }
    return 0;
  });
  def('yes', function* (args, ctx) {
    var word = args.length ? args.join(' ') : 'y';
    if (!ctx.tty) { var piped = ''; for (var i = 0; i < 4000; i++) piped += word + '\n'; ctx.out(piped); return 0; }
    var chunk = '';
    for (var k = 0; k < 40; k++) chunk += word + '\n';
    for (;;) {
      ctx.out(chunk);
      yield { sleep: 40 };
    }
  });

  /* --------------------------------------------- which, type, command, env */
  var BUILTIN_NAMES = ['cd', 'pwd', 'echo', 'history', 'exit', 'export', 'alias', 'unalias', 'unset', 'set', 'source', '.', 'eval', 'test', '[', 'printf', 'kill', 'true', 'false', 'type', 'which', 'whence', 'command', 'builtin', 'read', 'jobs', 'fg', 'bg', 'wait', 'exec', 'trap', 'umask', 'ulimit', 'local', 'pushd', 'popd', 'dirs', 'hash', 'let', 'return', 'shift', 'typeset', 'declare'];
  var P_BIN = ['cat', 'chmod', 'cp', 'date', 'dd', 'df', 'domainname', 'ed', 'expr', 'hostname', 'kill', 'ksh', 'launchctl', 'link', 'ln', 'ls', 'mkdir', 'mv', 'pax', 'ps', 'pwd', 'realpath', 'rm', 'rmdir', 'sh', 'sleep', 'stty', 'sync', 'test', 'unlink', 'wait4path', 'zsh', 'bash', 'csh', 'dash', 'tcsh', 'echo', '['];
  var P_USRBIN = ['awk', 'basename', 'bc', 'cal', 'clear', 'cmp', 'curl', 'cut', 'diff', 'dirname', 'du', 'env', 'file', 'find', 'git', 'grep', 'egrep', 'fgrep', 'gzip', 'head', 'id', 'killall', 'less', 'man', 'mdfind', 'mktemp', 'more', 'nano', 'nl', 'nslookup', 'od', 'open', 'pbcopy', 'pbpaste', 'printf', 'python3', 'readlink', 'rev', 'say', 'scp', 'sed', 'seq', 'sort', 'ssh', 'stat', 'sudo', 'sw_vers', 'tail', 'tar', 'tee', 'top', 'touch', 'tr', 'uname', 'uniq', 'unzip', 'uptime', 'vi', 'vim', 'wc', 'whoami', 'xargs', 'xattr', 'xcode-select', 'xxd', 'yes', 'zip', 'which'];
  var P_OTHER = { ifconfig: '/sbin/ifconfig', ping: '/sbin/ping', ipconfig: '/usr/sbin/ipconfig', networksetup: '/usr/sbin/networksetup', sysctl: '/usr/sbin/sysctl', system_profiler: '/usr/sbin/system_profiler', traceroute: '/usr/sbin/traceroute', chown: '/usr/sbin/chown', diskutil: '/usr/sbin/diskutil', netstat: '/usr/sbin/netstat' };
  function pathOf(name) {
    if (hasOwn.call(P_OTHER, name)) return P_OTHER[name];
    if (P_BIN.indexOf(name) >= 0) return '/bin/' + name;
    if (P_USRBIN.indexOf(name) >= 0) return '/usr/bin/' + name;
    return null;
  }
  def('which', function (args, ctx) {
    var al = ctx.session.aliases, status = 0, all = false;
    args.forEach(function (n) {
      if (n === '-a') { all = true; return; }
      if (n.charAt(0) === '-') return;
      if (hasOwn.call(al, n)) { ctx.out(n + ': aliased to ' + al[n] + '\n'); if (!all) return; }
      if (BUILTIN_NAMES.indexOf(n) >= 0) { ctx.out(n + ': shell built-in command\n'); if (!all) return; }
      var p = pathOf(n);
      if (p) ctx.out(p + '\n');
      else if (!hasOwn.call(al, n) && BUILTIN_NAMES.indexOf(n) < 0) { ctx.out(n + ' not found\n'); status = 1; }
    });
    return status;
  });
  def('whence', function (args, ctx) {
    var al = ctx.session.aliases, status = 0, verbose = args.indexOf('-v') >= 0;
    args.forEach(function (n) {
      if (n.charAt(0) === '-') return;
      if (hasOwn.call(al, n)) ctx.out(verbose ? n + ' is an alias for ' + al[n] + '\n' : al[n] + '\n');
      else if (BUILTIN_NAMES.indexOf(n) >= 0) ctx.out(verbose ? n + ' is a shell builtin\n' : n + '\n');
      else if (pathOf(n)) ctx.out(verbose ? n + ' is ' + pathOf(n) + '\n' : pathOf(n) + '\n');
      else { if (verbose) ctx.out(n + ' not found\n'); status = 1; }
    });
    return status;
  });
  def('type', function (args, ctx) {
    var al = ctx.session.aliases, status = 0;
    args.forEach(function (n) {
      if (n.charAt(0) === '-') return;
      if (hasOwn.call(al, n)) ctx.out(n + ' is an alias for ' + al[n] + '\n');
      else if (BUILTIN_NAMES.indexOf(n) >= 0) ctx.out(n + ' is a shell builtin\n');
      else if (pathOf(n)) ctx.out(n + ' is ' + pathOf(n) + '\n');
      else { ctx.out(n + ' not found\n'); status = 1; }
    });
    return status;
  });
  def('whereis', function (args, ctx) {
    var status = 1;
    args.forEach(function (n) { if (n.charAt(0) === '-') return; var p = pathOf(n); if (p) { ctx.out(p + '\n'); status = 0; } });
    return status;
  });
  def('command', function* (args, ctx) {
    var al = ctx.session.aliases;
    if (args[0] === '-v' || args[0] === '-V') {
      var verbose = args[0] === '-V', status = 0;
      args.slice(1).forEach(function (n) {
        if (hasOwn.call(al, n)) ctx.out(verbose ? n + ' is an alias for ' + al[n] + '\n' : 'alias ' + n + "='" + al[n] + "'\n");
        else if (BUILTIN_NAMES.indexOf(n) >= 0) ctx.out(verbose ? n + ' is a shell builtin\n' : n + '\n');
        else if (pathOf(n)) ctx.out(verbose ? n + ' is ' + pathOf(n) + '\n' : pathOf(n) + '\n');
        else { if (verbose) ctx.out(n + ' not found\n'); status = 1; }
      });
      return status;
    }
    if (!args.length) return 0;
    var r = yield* A.runCommand(args[0], args.slice(1), ctx.session, ctx.job, { stdin: ctx.stdin, tty: ctx.tty, errMode: 'tty' });
    if (!ctx.tty && r.stdout) ctx.out(r.stdout);
    return r.status;
  });
  def('builtin', function* (args, ctx) {
    if (!args.length) return 0;
    var r = yield* A.runCommand(args[0], args.slice(1), ctx.session, ctx.job, { stdin: ctx.stdin, tty: ctx.tty, errMode: 'tty' });
    if (!ctx.tty && r.stdout) ctx.out(r.stdout);
    return r.status;
  });
  function envLines(s) {
    var order = ['TERM_PROGRAM', 'SHELL', 'TERM', 'TMPDIR', 'TERM_PROGRAM_VERSION', 'TERM_SESSION_ID', 'USER', 'SSH_AUTH_SOCK', '__CF_USER_TEXT_ENCODING', 'XPC_FLAGS', 'XPC_SERVICE_NAME', 'PATH', 'PWD', 'LANG', 'HOME', 'LOGNAME', 'LC_CTYPE'];
    var keys = Object.keys(s.env).filter(function (k) { return s.exported.has(k); });
    keys.sort(function (a, b) { var x = order.indexOf(a), y = order.indexOf(b); if (x < 0) x = 99; if (y < 0) y = 99; return x - y || (a < b ? -1 : 1); });
    var res = keys.map(function (k) { return k + '=' + s.env[k]; });
    if (s.oldpwd !== null) res.push('OLDPWD=' + s.oldpwd);
    res.push('_=/usr/bin/env');
    return res;
  }
  def('env', function* (args, ctx) {
    var s = ctx.session, i = 0, set = [];
    while (i < args.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(args[i])) { set.push(args[i]); i++; }
    if (i < args.length && args[i] === '-i') i++;
    if (i >= args.length) { ctx.out(envLines(s).join('\n') + '\n'); return 0; }
    var saved = {};
    set.forEach(function (a) { var eq = a.indexOf('='), k = a.slice(0, eq); saved[k] = hasOwn.call(s.env, k) ? { v: s.env[k] } : null; s.env[k] = a.slice(eq + 1); });
    try {
      var r = yield* A.runCommand(args[i], args.slice(i + 1), s, ctx.job, { stdin: ctx.stdin, tty: ctx.tty, errMode: 'tty' });
      if (!ctx.tty && r.stdout) ctx.out(r.stdout);
      return r.status;
    } finally { Object.keys(saved).forEach(function (k) { if (saved[k]) s.env[k] = saved[k].v; else delete s.env[k]; }); }
  });
  def('printenv', function (args, ctx) {
    var s = ctx.session;
    if (!args.length) { ctx.out(envLines(s).filter(function (l) { return l.indexOf('_=') !== 0; }).join('\n') + '\n'); return 0; }
    var status = 0;
    args.forEach(function (n) { if (hasOwn.call(s.env, n) && s.exported.has(n)) ctx.out(s.env[n] + '\n'); else status = 1; });
    return status;
  });

  /* --------------------------------------------------------------- help */
  def('help', function (args, ctx) {
    ctx.out('練習版 zsh 可以用的指令（真的 Mac 上還有更多）。想看某個指令怎麼用，輸入 man 指令名稱，例如 man ls。\n\n' +
      '  走路和看：  pwd  cd  ls  open  file  stat  du  df  find  mdfind\n' +
      '  檔案：      mkdir  rmdir  touch  cp  mv  rm  ln  chmod  zip  unzip  tar  pbcopy  pbpaste\n' +
      '  看內容：    cat  head  tail  less  more  wc  grep  diff  sort  uniq  cut  tr  tee  xargs\n' +
      '  編輯：      nano  code  open -a 文字編輯 檔案\n' +
      '  算一算：    echo  printf  seq  expr  bc  python3（先裝命令列開發人員工具）\n' +
      '  系統：      date  cal  uptime  whoami  id  hostname  uname  sw_vers  sysctl  system_profiler  ps  top  kill  killall\n' +
      '  網路：      ifconfig  ipconfig  networksetup  ping  curl  nslookup  traceroute（練習版沒有網路，結果是假的）\n' +
      '  殼層：      alias  export  history  which  type  man  clear  exit  sleep  true  false  yes  source\n' +
      '  版本控制：  git（先裝命令列開發人員工具）\n' +
      '\n快速鍵：Tab 補完、↑↓ 找以前打過的指令、Ctrl+R 搜尋歷史、Ctrl+C 中斷、Ctrl+A / Ctrl+E 跳到行首 / 行尾、Ctrl+U / Ctrl+K 刪掉前面 / 後面、Ctrl+L 清畫面。\n');
    return 0;
  });

  /* ================================================================ system (SPEC §1: one fake MacBook Air, the same everywhere) */
  var EN_MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var EN_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var BOOT_MS = LAB.clock.ms() - ((2 * 24 + 14) * 3600 + 3 * 60) * 1000;      // the Mac has been on for 2 days, 14 hours, 3 minutes
  function ms() { return LAB.clock.ms(); }

  /* strftime for `date +FORMAT` */
  function strftime(fmt, d, utc) {
    var f = utc ? { Y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate(), H: d.getUTCHours(), M: d.getUTCMinutes(), S: d.getUTCSeconds(), w: d.getUTCDay() }
                : { Y: d.getFullYear(), m: d.getMonth(), d: d.getDate(), H: d.getHours(), M: d.getMinutes(), S: d.getSeconds(), w: d.getDay() };
    function yday() { var start = Date.UTC(f.Y, 0, 0), cur = Date.UTC(f.Y, f.m, f.d); return Math.round((cur - start) / 86400000); }
    function h12() { var x = f.H % 12; return x === 0 ? 12 : x; }
    return fmt.replace(/%([-_0^#]?)([a-zA-Z%])/g, function (m, flag, c) {
      var v;
      switch (c) {
        case 'Y': v = String(f.Y); break; case 'y': v = p2(f.Y % 100); break; case 'C': v = p2(Math.floor(f.Y / 100)); break;
        case 'm': v = p2(f.m + 1); break; case 'd': v = p2(f.d); break; case 'e': v = (f.d < 10 ? ' ' : '') + f.d; break;
        case 'H': v = p2(f.H); break; case 'I': v = p2(h12()); break; case 'k': v = (f.H < 10 ? ' ' : '') + f.H; break; case 'l': v = (h12() < 10 ? ' ' : '') + h12(); break;
        case 'M': v = p2(f.M); break; case 'S': v = p2(f.S); break; case 'p': v = f.H < 12 ? 'AM' : 'PM'; break;
        case 'a': v = EN_DAYS[f.w].slice(0, 3); break; case 'A': v = EN_DAYS[f.w]; break;
        case 'b': case 'h': v = EN_MON[f.m].slice(0, 3); break; case 'B': v = EN_MON[f.m]; break;
        case 'j': v = ('00' + yday()).slice(-3); break; case 'u': v = String(f.w === 0 ? 7 : f.w); break; case 'w': v = String(f.w); break;
        case 'Z': v = utc ? 'UTC' : 'CST'; break; case 'z': v = utc ? '+0000' : '+0800'; break;
        case 's': v = String(Math.floor(d.getTime() / 1000)); break; case 'n': v = '\n'; break; case 't': v = '\t'; break; case '%': v = '%'; break;
        case 'F': v = f.Y + '-' + p2(f.m + 1) + '-' + p2(f.d); break; case 'T': v = p2(f.H) + ':' + p2(f.M) + ':' + p2(f.S); break;
        case 'R': v = p2(f.H) + ':' + p2(f.M); break; case 'D': v = p2(f.m + 1) + '/' + p2(f.d) + '/' + p2(f.Y % 100); break;
        case 'r': v = p2(h12()) + ':' + p2(f.M) + ':' + p2(f.S) + ' ' + (f.H < 12 ? 'AM' : 'PM'); break;
        case 'c': v = EN_DAYS[f.w].slice(0, 3) + ' ' + EN_MON[f.m].slice(0, 3) + ' ' + (f.d < 10 ? ' ' : '') + f.d + ' ' + p2(f.H) + ':' + p2(f.M) + ':' + p2(f.S) + ' ' + f.Y; break;
        case 'x': v = p2(f.m + 1) + '/' + p2(f.d) + '/' + p2(f.Y % 100); break; case 'X': v = p2(f.H) + ':' + p2(f.M) + ':' + p2(f.S); break;
        default: return m;
      }
      if (flag === '-') v = v.replace(/^[0 ]+(?=.)/, ''); else if (flag === '_') v = v.replace(/^0/, ' '); else if (flag === '^') v = v.toUpperCase();
      return v;
    });
  }
  USAGE.date = ['usage: date [-jnRu] [-I[date|hours|minutes|seconds]] [-f input_fmt]', '            [-r seconds | -r file] [-v[+|-]val[y|m|w|d|H|M|S]]', '            [[[[mm]dd]HH]MM[[cc]yy][.SS] | new_date] [+output_fmt]'];
  def('date', function (args, ctx) {
    var d = new Date(ms()), utc = false, fmt = null, i = 0;
    for (; i < args.length; i++) {
      var a = args[i];
      if (a === '-u') { utc = true; continue; }
      if (a === '-j' || a === '-n') continue;
      if (a === '-R') { fmt = '%a, %d %b %Y %H:%M:%S %z'; continue; }
      if (a.indexOf('-I') === 0) { fmt = a === '-Idate' || a === '-I' ? '%F' : '%FT%T%z'; continue; }
      if (a === '-r') {
        var v = args[++i], secs = /^\d+$/.test(v || '') ? parseInt(v, 10) : null;
        if (secs !== null) d = new Date(secs * 1000);
        else { var st = ctx.session.vfs.stat(resolvePath(ctx.session, v || '')); if (!st) { ctx.err('date: ' + v + ': No such file or directory\n'); return 1; } d = new Date(st.mtime); }
        continue;
      }
      if (a.indexOf('-v') === 0) {
        var adj = a.length > 2 ? a.slice(2) : args[++i], m = /^([+-]?)(\d+)([ymwdHMS])$/.exec(adj || '');
        if (!m) { ctx.err('date: illegal time format\n' + USAGE.date.join('\n') + '\n'); return 1; }
        var n = (m[1] === '-' ? -1 : 1) * parseInt(m[2], 10);
        if (m[3] === 'y') d.setFullYear(d.getFullYear() + n); else if (m[3] === 'm') d.setMonth(d.getMonth() + n); else if (m[3] === 'w') d.setDate(d.getDate() + 7 * n);
        else if (m[3] === 'd') d.setDate(d.getDate() + n); else if (m[3] === 'H') d.setHours(d.getHours() + n); else if (m[3] === 'M') d.setMinutes(d.getMinutes() + n); else d.setSeconds(d.getSeconds() + n);
        continue;
      }
      if (a.charAt(0) === '+') { fmt = a.slice(1); continue; }
      if (a.charAt(0) === '-' && a.length > 1) { ctx.err('date: illegal option -- ' + a.charAt(1) + '\n' + USAGE.date.join('\n') + '\n'); return 1; }
      ctx.err('date: 這台練習電腦不能改時間（sudo date 也不行）\n');
      return 1;
    }
    ctx.out(strftime(fmt === null ? '%a %b %e %H:%M:%S %Z %Y' : fmt, d, utc) + '\n');
    return 0;
  });

  /* cal: one month is 7 columns of 3 characters (20 wide); today is shown in reverse video on the screen */
  function monthLines(year, month, today, color) {
    var title = EN_MON[month] + ' ' + year;
    var lines = [pad('', Math.max(0, Math.floor((20 - title.length) / 2))) + title];
    lines.push('Su Mo Tu We Th Fr Sa');
    var first = new Date(year, month, 1).getDay(), days = new Date(year, month + 1, 0).getDate();
    var row = new Array(first + 1).join('   ');
    for (var d = 1; d <= days; d++) {
      var cell = (d < 10 ? ' ' : '') + d;
      if (today && today.y === year && today.m === month && today.d === d) cell = color ? sgr('7', cell) : cell;
      row += cell;
      if ((first + d) % 7 === 0 || d === days) { lines.push(row); row = ''; } else row += ' ';
    }
    while (lines.length < 8) lines.push('');
    return lines;
  }
  def('cal', function (args, ctx) {
    var now = new Date(ms()), today = { y: now.getFullYear(), m: now.getMonth(), d: now.getDate() };
    var nums = [], F = {};
    args.forEach(function (a) { if (/^-[3yjh]+$/.test(a)) { for (var k = 1; k < a.length; k++) F[a.charAt(k)] = true; } else if (/^\d+$/.test(a)) nums.push(parseInt(a, 10)); else nums.push(a); });
    var year = today.y, month = today.m, wholeYear = !!F.y;
    if (nums.length === 1) { if (typeof nums[0] !== 'number') { ctx.err('cal: illegal month value: use 1-12\n'); return 1; } year = nums[0]; wholeYear = true; }
    else if (nums.length === 2) {
      var mo = nums[0];
      if (typeof mo === 'string') {
        var mi = EN_MON.findIndex(function (x) { return x.toLowerCase().indexOf(mo.toLowerCase()) === 0 && mo.length >= 3; });
        if (mi < 0) { ctx.err('cal: illegal month value: use 1-12\n'); return 1; }
        month = mi;
      } else { if (mo < 1 || mo > 12) { ctx.err('cal: illegal month value: use 1-12\n'); return 1; } month = mo - 1; }
      year = nums[1];
    } else if (nums.length > 2) { ctx.err('usage: cal [-3hjy] [-A months] [-B months] [[month] year]\n'); return 1; }
    if (typeof year !== 'number' || year < 1 || year > 9999) { ctx.err('cal: illegal year value: use 1-9999\n'); return 1; }
    var color = ctx.tty;
    function block(list) {
      // several months side by side, two spaces apart
      var out = '';
      for (var r = 0; r < 8; r++) {
        var line = list.map(function (m) { var t = m[r] || ''; return pad(t, 20 + (t.indexOf(ESC) >= 0 ? t.length - strip(t).length : 0)); }).join('  ');
        out += line.replace(/\s+$/, '') + '\n';
      }
      return out.replace(/\n+$/, '\n');
    }
    if (wholeYear) {
      var t = String(year), res = pad('', Math.floor((62 - t.length) / 2)) + t + '\n\n';
      for (var row = 0; row < 4; row++) {
        res += block([0, 1, 2].map(function (c) { return monthLines(year, row * 3 + c, today, color); }));
        if (row < 3) res += '\n';
      }
      ctx.out(res);
    } else if (F['3']) {
      var prev = new Date(year, month - 1, 1), next = new Date(year, month + 1, 1);
      ctx.out(block([monthLines(prev.getFullYear(), prev.getMonth(), today, color), monthLines(year, month, today, color), monthLines(next.getFullYear(), next.getMonth(), today, color)]));
    } else {
      var ls = monthLines(year, month, today, color);
      ctx.out(ls.map(function (l) { return l.replace(/\s+$/, ''); }).join('\n').replace(/\n+$/, '') + '\n');
    }
    return 0;
  });

  def('uptime', function (args, ctx) {
    var up = Math.floor((ms() - BOOT_MS) / 60000), days = Math.floor(up / 1440), hh = Math.floor((up % 1440) / 60), mm = up % 60;
    var d = new Date(ms());
    var load = ctx.session.rng, l1 = (1.6 + load() * 1).toFixed(2), l2 = (1.8 + load() * 0.9).toFixed(2), l3 = (1.9 + load() * 0.8).toFixed(2);
    ctx.out(' ' + d.getHours() + ':' + p2(d.getMinutes()) + '  up ' + (days ? days + ' day' + (days === 1 ? '' : 's') + ', ' : '') + hh + ':' + p2(mm) + ', 2 users, load averages: ' + l1 + ' ' + l2 + ' ' + l3 + '\n');
    return 0;
  });

  def('whoami', function (args, ctx) { ctx.out('an\n'); return 0; });
  def('hostname', function (args, ctx) { ctx.out(args.indexOf('-s') >= 0 ? 'MacBook-Air\n' : 'MacBook-Air.local\n'); return 0; });
  var GROUPS = '20(staff),12(everyone),61(localaccounts),79(_appserverusr),80(admin),81(_appserveradm),98(_lpadmin),701(com.apple.sharepoint.group.1),33(_appstore),100(_lpoperator),204(_developer),250(_analyticsusers),395(com.apple.access_ftp),398(com.apple.access_screensharing),399(com.apple.access_ssh),400(com.apple.access_remote_ae)';
  def('id', function (args, ctx) {
    var f = args.join('');
    if (f.indexOf('-un') >= 0 || f === '-n' || f === '-u-n') { ctx.out('an\n'); return 0; }
    if (f.indexOf('-u') >= 0 && f.indexOf('n') < 0) { ctx.out('501\n'); return 0; }
    if (f.indexOf('-gn') >= 0) { ctx.out('staff\n'); return 0; }
    if (f.indexOf('-g') >= 0) { ctx.out('20\n'); return 0; }
    if (f.indexOf('-Gn') >= 0) { ctx.out(GROUPS.split(',').map(function (g) { return g.replace(/^\d+\(|\)$/g, ''); }).join(' ') + '\n'); return 0; }
    if (f.indexOf('-G') >= 0) { ctx.out(GROUPS.split(',').map(function (g) { return g.replace(/\(.*$/, ''); }).join(' ') + '\n'); return 0; }
    ctx.out('uid=501(an) gid=20(staff) groups=' + GROUPS + '\n');
    return 0;
  });
  var KERNEL = 'Darwin Kernel Version 25.0.0: Mon Aug 25 21:17:51 PDT 2025; root:xnu-12377.1.9~2/RELEASE_ARM64_T8122';
  USAGE.uname = ['usage: uname [-aimnprsv]'];
  def('uname', function (args, ctx) {
    var F = {};
    for (var i = 0; i < args.length; i++) {
      var a = args[i];
      if (a.charAt(0) !== '-' || a.length < 2) { ctx.err('usage: uname [-aimnprsv]\n'); return 1; }
      for (var k = 1; k < a.length; k++) {
        if ('aimnprsv'.indexOf(a.charAt(k)) < 0) { ctx.err('uname: illegal option -- ' + a.charAt(k) + '\nusage: uname [-aimnprsv]\n'); return 1; }
        F[a.charAt(k)] = true;
      }
    }
    var parts = [];
    if (F.a) { parts = ['Darwin', 'MacBook-Air.local', '25.0.0', KERNEL, 'arm64']; }
    else {
      if (F.s) parts.push('Darwin'); if (F.n) parts.push('MacBook-Air.local'); if (F.r) parts.push('25.0.0'); if (F.v) parts.push(KERNEL);
      if (F.m) parts.push('arm64'); if (F.p) parts.push('arm'); if (F.i) parts.push('arm64');
      if (!parts.length) parts = ['Darwin'];
    }
    ctx.out(parts.join(' ') + '\n');
    return 0;
  });
  def('sw_vers', function (args, ctx) {
    var tbl = { '--productName': ['ProductName', 'macOS'], '--productVersion': ['ProductVersion', '26.0.1'], '--buildVersion': ['BuildVersion', '25A362'], '-productName': ['ProductName', 'macOS'], '-productVersion': ['ProductVersion', '26.0.1'], '-buildVersion': ['BuildVersion', '25A362'] };
    if (args.length && hasOwn.call(tbl, args[0])) { ctx.out(tbl[args[0]][1] + '\n'); return 0; }
    if (args.length) { ctx.err('sw_vers: unrecognized option `' + args[0] + "'\nUsage: sw_vers [--productName|--productVersion|--buildVersion]\n"); return 1; }
    ctx.out('ProductName:\t\tmacOS\nProductVersion:\t\t26.0.1\nBuildVersion:\t\t25A362\n');
    return 0;
  });
  var SYSCTL = {
    'hw.memsize': '17179869184', 'hw.ncpu': '8', 'hw.physicalcpu': '8', 'hw.logicalcpu': '8', 'hw.model': 'Mac15,12', 'hw.machine': 'arm64', 'hw.pagesize': '16384',
    'hw.cpufamily': '2276100000', 'hw.optional.arm64': '1', 'machdep.cpu.brand_string': 'Apple M3', 'machdep.cpu.core_count': '8', 'machdep.cpu.thread_count': '8',
    'kern.ostype': 'Darwin', 'kern.osrelease': '25.0.0', 'kern.osversion': '25A362', 'kern.osproductversion': '26.0.1', 'kern.hostname': 'MacBook-Air.local', 'kern.version': KERNEL,
    'kern.boottime': '{ sec = ' + Math.floor(BOOT_MS / 1000) + ', usec = 0 } ' + new Date(BOOT_MS).toString().replace(/ GMT.*$/, ''), 'kern.maxproc': '8000', 'kern.maxfiles': '276480',
    'vm.swapusage': 'total = 0.00M  used = 0.00M  free = 0.00M  (encrypted)', 'hw.memsize_usable': '16777216000', 'hw.ncpu_max': '8', 'user.cs_path': '/usr/bin:/bin:/usr/sbin:/sbin'
  };
  def('sysctl', function (args, ctx) {
    var names = [], quiet = false, all = false;
    args.forEach(function (a) { if (a === '-n') quiet = true; else if (a === '-a' || a === '-A') all = true; else if (a.charAt(0) !== '-') names.push(a); });
    if (all || !names.length) { Object.keys(SYSCTL).sort().forEach(function (k) { ctx.out(k + ': ' + SYSCTL[k] + '\n'); }); return 0; }
    var status = 0;
    names.forEach(function (n) {
      var key = n.indexOf('=') > 0 ? n.slice(0, n.indexOf('=')) : n;
      if (n.indexOf('=') > 0) { ctx.err('sysctl: ' + key + ': Operation not permitted (需要 sudo；練習版不能改系統設定)\n'); status = 1; return; }
      if (!hasOwn.call(SYSCTL, key)) { ctx.err("sysctl: unknown oid '" + key + "'\n"); status = 1; return; }
      ctx.out(quiet ? SYSCTL[key] + '\n' : key + ': ' + SYSCTL[key] + '\n');
    });
    return status;
  });
  var SP_HW = 'Hardware:\n\n    Hardware Overview:\n\n      Model Name: MacBook Air\n      Model Identifier: Mac15,12\n      Model Number: MRXV3TA/A\n      Chip: Apple M3\n      Total Number of Cores: 8 (4 performance and 4 efficiency)\n      Memory: 16 GB\n      System Firmware Version: 13822.1.2\n      OS Loader Version: 13822.1.2\n      Serial Number (system): C02ZL4BAN1MX\n      Hardware UUID: 9F3C2A71-5B8E-4D06-A1C4-7E2D90B63F18\n      Provisioning UDID: 00008122-001A3C4D2E81002E\n      Activation Lock Status: Enabled\n\n';
  var SP_SW = 'Software:\n\n    System Software Overview:\n\n      System Version: macOS 26.0.1 (25A362)\n      Kernel Version: Darwin 25.0.0\n      Boot Volume: Macintosh HD\n      Boot Mode: Normal\n      Computer Name: an 的 MacBook Air\n      User Name: an (an)\n      Secure Virtual Memory: Enabled\n      System Integrity Protection: Enabled\n      Time since boot: 2 days, 14 hours, 3 minutes\n\n';
  var SP_NET = 'Network:\n\n    Wi-Fi:\n\n      Type: AirPort\n      Hardware: AirPort\n      BSD Device Name: en0\n      IPv4 Addresses: 10.20.31.57\n      IPv4:\n          AdditionalRoutes:\n              Destination Address: 10.20.31.57\n          Addresses: 10.20.31.57\n          Router: 10.20.31.1\n          Subnet Masks: 255.255.255.0\n      DNS:\n          Server Addresses: 10.20.0.53\n      Proxies:\n          Exceptions List: *.local, 169.254/16\n\n';
  def('system_profiler', function* (args, ctx) {
    var types = args.filter(function (a) { return a.charAt(0) !== '-'; });
    if (args.indexOf('-listDataTypes') >= 0) { ctx.out('Available Datatypes:\nSPHardwareDataType\nSPNetworkDataType\nSPSoftwareDataType\n'); return 0; }
    yield { sleep: 350 };
    var table = { SPHardwareDataType: SP_HW, SPSoftwareDataType: SP_SW, SPNetworkDataType: SP_NET };
    if (!types.length) { ctx.out(SP_HW + SP_NET + SP_SW); return 0; }
    var bad = null;
    types.forEach(function (t) { if (hasOwn.call(table, t)) ctx.out(table[t]); else bad = t; });
    if (bad) { ctx.err('system_profiler: 練習版只做 SPHardwareDataType、SPSoftwareDataType、SPNetworkDataType\n'); return 1; }
    return 0;
  });
  def('xcode-select', function (args, ctx) {
    var a = args[0];
    if (a === '--install' || a === '-install') {
      if (sys.devTools) { ctx.err('xcode-select: error: command line tools are already installed, use "Software Update" in System Settings to install updates\n'); return 1; }
      ctx.err('xcode-select: note: install requested for command line developer tools\n');
      ctx.effect({ type: 'clt', name: 'xcode-select' });
      return 0;
    }
    if (a === '-p' || a === '--print-path') {
      if (sys.devTools) { ctx.out('/Library/Developer/CommandLineTools\n'); return 0; }
      ctx.err('xcode-select: error: unable to get active developer directory, use `sudo xcode-select --switch path/to/Xcode.app` to set one (or see `man xcode-select`)\n');
      return 2;
    }
    if (a === '--version' || a === '-v') { ctx.out('xcode-select version 2416.\n'); return 0; }
    ctx.err('Usage: xcode-select [options]\n\nPrint or change the path to the active developer directory. This directory\ncontrols which tools are used for the Xcode command line tools (for example,\nxcodebuild) as well as the BSD development commands (such as cc and make).\n\nOptions:\n  -h, --help                  print this help message and exit\n  -p, --print-path            print the path of the active developer directory\n  -s <path>, --switch <path>  set the path for the active developer directory\n  --install                   open a dialog for installation of the command line developer tools\n  -v, --version               print the xcode-select version\n  -r, --reset                 reset to the default command line tools path\n');
    return a ? 1 : 0;
  });

  /* ----------------------------------------------------------- ps, top, kill */
  function cpuTime(row) {
    if (row.name === 'login') return '0:00.04';
    if (row.name === '-zsh') return '0:00.' + p2(10 + row.pid % 40);
    var t = (row.pid * 37 % 6000) / 100 + (row.cpu || 0) * 3, m = Math.floor(t / 60), s = (t % 60).toFixed(2);
    return m + ':' + (parseFloat(s) < 10 ? '0' : '') + s;
  }
  function ttyShort(t) { return t === '??' ? '??' : t.replace(/^tty/, ''); }
  function memPct(row) { return (row.rssKB / 16777216 * 100).toFixed(1); }
  function startedOf(row) { return row.pid < 400 ? 'Wed09AM' : row.pid < 1000 ? 'Wed10AM' : ' 9:52AM'; }
  USAGE.ps = ['usage: ps [-AaCcEefhjlMmrSTvwXx] [-O fmt | -o fmt] [-G gid[,gid...]]', '          [-g grp[,grp...]] [-u [uid,uid...]]', '          [-p pid[,pid...]] [-t tty[,tty...]] [-U user[,user...]]', '       ps [-L]'];
  def('ps', function (args, ctx) {
    var s = ctx.session, rows = procs.list(), F = {}, pidList = null, i = 0, flagStr = '';
    for (; i < args.length; i++) {
      var a = args[i];
      if (a === '-p' || a === '-o' || a === '-O' || a === '-t' || a === '-u' || a === '-U') { if (a === '-p') pidList = String(args[i + 1] || '').split(',').map(Number); i++; continue; }
      if (a.charAt(0) === '-' || /^[a-zA-Z]+$/.test(a)) { var b = a.replace(/^-/, ''); for (var k = 0; k < b.length; k++) { if ('AaCcEefhjlMmrSTvwXxuL'.indexOf(b.charAt(k)) < 0) { ctx.err('ps: illegal option -- ' + b.charAt(k) + '\n' + USAGE.ps.join('\n') + '\n'); return 1; } F[b.charAt(k)] = true; } continue; }
      if (/^\d+$/.test(a)) { pidList = (pidList || []).concat([parseInt(a, 10)]); continue; }
    }
    var myTty = 'ttys' + (s.tty < 10 ? '00' : s.tty < 100 ? '0' : '') + s.tty;
    var self = { pid: 6000 + Math.floor(s.rng() * 700), ppid: s.pid, user: 'an', name: 'ps', command: 'ps' + (args.length ? ' ' + args.join(' ') : ''), tty: myTty, cpu: 0, memMB: 3, rssKB: 3200, vszKB: 410000000, threads: 1 };
    var all = F.A || F.e || F.a && F.x || F.x && F.u || F.u && F.a;
    function sel() {
      if (pidList) return rows.filter(function (r) { return pidList.indexOf(r.pid) >= 0; });
      if (all || F.a || F.x || F.u) return rows.concat([self]);
      return rows.filter(function (r) { return r.tty === myTty; }).concat([self]);
    }
    var list = sel().sort(function (x, y) { return x.pid - y.pid; });
    function fmtTime(r) { return r === self ? '0:00.00' : cpuTime(r); }
    function ucmd(r) { return r === self ? r.command : (F.c ? r.name : (r.name === 'login' ? 'login -pf an' : r.command)); }
    if (F.u) {
      var rowsOut = ['USER             PID  %CPU %MEM      VSZ    RSS   TT  STAT STARTED      TIME COMMAND'];
      list.forEach(function (r) {
        rowsOut.push(pad(r.user, 16) + ' ' + pad(String(r.pid), 5, true) + ' ' + pad(r.cpu.toFixed(1), 5, true) + ' ' + pad(memPct(r), 4, true) + ' ' + pad(String(r.vszKB), 8, true) + ' ' + pad(String(r.rssKB), 6, true) + ' ' + pad(ttyShort(r.tty), 4, true) + '  ' + pad(r.state, 4) + ' ' + pad(r === self ? ' 9:52AM' : startedOf(r), 7, true) + ' ' + pad(fmtTime(r), 9, true) + ' ' + ucmd(r));
      });
      rowsOut[0] = pad('USER', 16) + ' ' + pad('PID', 5, true) + '  %CPU %MEM      VSZ    RSS   TT  STAT STARTED      TIME COMMAND';
      ctx.out(rowsOut.join('\n') + '\n');
      return 0;
    }
    if (F.f || F.l) {
      var uid = { root: '    0', an: '  501', _windowserver: '   88' };
      var out2 = ['  UID   PID  PPID   C STIME   TTY           TIME CMD'];
      list.forEach(function (r) {
        out2.push((uid[r.user] || '  501') + ' ' + pad(String(r.pid), 5, true) + ' ' + pad(String(r.ppid), 5, true) + ' ' + pad(String(Math.round(r.cpu)), 3, true) + ' ' + pad(r === self ? ' 9:52AM' : startedOf(r).replace(/^Wed(\d\d)AM$/, '$1:00AM'), 7, true) + ' ' + pad(r.tty, 8) + pad(fmtTime(r), 9, true) + ' ' + ucmd(r));
      });
      ctx.out(out2.join('\n') + '\n');
      return 0;
    }
    var out3 = ['  PID TTY           TIME CMD'];
    list.forEach(function (r) { out3.push(pad(String(r.pid), 5, true) + ' ' + pad(r.tty, 8) + pad(fmtTime(r), 10, true) + ' ' + ucmd(r)); });
    ctx.out(out3.join('\n') + '\n');
    return 0;
  });

  /* top: a full-screen program (updates every second; q leaves) and `top -l N` which prints N samples and ends */
  function topFrame(ctx, cols, rowsN, sortKey, limit) {
    var list = procs.list();
    list.forEach(function (r) { r.cpuNow = r.cpu; });
    var total = list.length + 388, running = 2 + (ctx.session.rng() < .4 ? 1 : 0);
    var d = new Date(ms()), user = (4 + ctx.session.rng() * 5).toFixed(2), sysp = (5 + ctx.session.rng() * 5).toFixed(2), idle = (100 - user - sysp).toFixed(2);
    var head = [
      'Processes: ' + total + ' total, ' + running + ' running, ' + (total - running) + ' sleeping, ' + (list.reduce(function (a, r) { return a + r.threads; }, 0) + 1500) + ' threads' + pad('', 0),
      'Load Avg: 2.14, 2.31, 2.45  CPU usage: ' + user + '% user, ' + sysp + '% sys, ' + idle + '% idle  SharedLibs: 482M resident, 98M data, 41M linkedit.',
      'MemRegions: 168812 total, 4813M resident, 213M private, 2112M shared. PhysMem: 12G used (2112M wired, 1881M compressor), 3856M unused.',
      'VM: 242T vsize, 4306M framework vsize, 0(0) swapins, 0(0) swapouts. Networks: packets: 1231234/1G in, 912312/412M out.',
      'Disks: 812312/12G read, 412312/8G written.', ''
    ];
    var clock = p2(d.getHours()) + ':' + p2(d.getMinutes()) + ':' + p2(d.getSeconds());
    head[0] = head[0] + new Array(Math.max(2, cols - head[0].length - clock.length + 1)).join(' ') + clock;
    // one column list builds both the header and the rows, so they always line up
    var COLS = [['PID', 6, 0], ['COMMAND', 16, 0], ['%CPU', 5, 1], ['TIME', 8, 0], ['#TH', 5, 0], ['#WQ', 4, 0], ['#PORTS', 6, 0], ['MEM', 6, 0], ['PURG', 6, 0], ['CMPRS', 6, 0], ['PGRP', 5, 0], ['PPID', 5, 0], ['STATE', 8, 0], ['BOOSTS', 9, 0], ['%CPU_ME', 7, 1], ['%CPU_OTHRS', 10, 1], ['UID', 4, 0]];
    function topRow(cells) { return COLS.map(function (c, n) { return pad(String(cells[n]), c[1], !!c[2]); }).join(' ').replace(/\s+$/, ''); }
    var colHead = topRow(COLS.map(function (c) { return c[0]; }));
    list.sort(function (x, y) { return sortKey === 'pid' ? y.pid - x.pid : y.cpuNow - x.cpuNow || x.pid - y.pid; });
    var lines = head.map(function (l) { return l.slice(0, cols); });
    lines.push(sgr('7', pad(colHead.slice(0, cols), cols)));
    var room = limit || Math.max(0, rowsN - lines.length);
    list.slice(0, room).forEach(function (r) {
      var nm = r.name.length > 16 ? r.name.slice(0, 16) : r.name;
      var t = cpuTime(r).replace(/^(\d+):/, function (m, a) { return pad(a, 2, true).replace(' ', '0') + ':'; });
      var line = topRow([r.pid, nm, r.cpuNow.toFixed(1), t, r.threads, Math.max(1, r.threads >> 1), r.threads * 9 + 40, r.memMB + 'M', '0B', '0B', r.pid, r.ppid, 'sleeping', '*0[1]', r.cpuNow.toFixed(1), '0.0', r.user === 'root' ? '0' : r.user === '_windowserver' ? '88' : '501']);
      lines.push(line.slice(0, cols));
    });
    return lines;
  }
  USAGE.top = ['usage: top [-a | -d | -e | -c <mode>]', '           [-F | -f]', '           [-h]', '           [-i <interval>]', '           [-l <samples>]', '           [-ncols <columns>]', '           [-o <key>] [-O <secondaryKey>]', '           [-R | -r]', '           [-S]', '           [-s <delay>]', '           [-n <nprocs>]', '           [-stats <key(s)>]', '           [-pid <processid>]', '           [-user <username>]', '           [-U <username>]', '           [-u]'];
  def('top', function* (args, ctx) {
    var logs = 0, limit = 0, sortKey = 'cpu', i = 0;
    for (; i < args.length; i++) {
      var a = args[i];
      if (a === '-l') logs = parseInt(args[++i], 10) || 1;
      else if (a === '-n') limit = parseInt(args[++i], 10) || 0;
      else if (a === '-o') sortKey = String(args[++i] || 'cpu').replace(/^[-+]/, '');
      else if (a === '-s' || a === '-i' || a === '-stats' || a === '-pid' || a === '-user' || a === '-U' || a === '-O' || a === '-ncols' || a === '-c') i++;
      else if (a.charAt(0) === '-' && a.length > 1 && /^-[aderRSuFfh]+$/.test(a)) { /* accepted */ }
      else if (a.charAt(0) === '-') { ctx.err('invalid argument/option - ' + a + '\n' + USAGE.top.join('\n') + '\n'); return 1; }
    }
    if (logs || !ctx.tty) {
      var samples = logs || 1;
      for (var n = 0; n < samples; n++) {
        ctx.out(topFrame(ctx, 100, 60, sortKey, limit || 20).map(strip).join('\n') + '\n');
        if (n < samples - 1) { ctx.out('\n'); yield { sleep: 1000 }; }
      }
      return 0;
    }
    var status = yield {
      app: {
        name: 'top', lines: [],
        start: function (api) { this.refresh(api); api.setTick(1000); },
        refresh: function (api) { this.lines = topFrame(ctx, api.cols(), api.rows(), sortKey, limit); },
        tick: function (api) { this.refresh(api); },
        resize: function (api) { this.refresh(api); },
        render: function (api) { return { rows: this.lines }; },
        key: function (k, api) { if (k.key === 'q' || k.key === 'Q' || (k.ctrl && k.k === 'c')) api.exit(0); else if (k.key === 'o') { sortKey = sortKey === 'cpu' ? 'pid' : 'cpu'; this.refresh(api); } }
      }
    };
    return status || 0;
  });

  var SIGNALS = ['HUP', 'INT', 'QUIT', 'ILL', 'TRAP', 'ABRT', 'EMT', 'FPE', 'KILL', 'BUS', 'SEGV', 'SYS', 'PIPE', 'ALRM', 'TERM', 'URG', 'STOP', 'TSTP', 'CONT', 'CHLD', 'TTIN', 'TTOU', 'IO', 'XCPU', 'XFSZ', 'VTALRM', 'PROF', 'WINCH', 'INFO', 'USR1', 'USR2'];
  def('kill', function (args, ctx) {
    var list = args.slice(), sig = 'TERM';
    if (list[0] === '-l') { ctx.out(SIGNALS.map(function (x, n) { return (n + 1) + ') SIG' + x; }).join('\n') + '\n'); return 0; }
    if (list[0] === '-s' && list.length > 1) { sig = list[1].replace(/^SIG/, ''); list = list.slice(2); }
    else if (/^-(\d+|[A-Za-z]+)$/.test(list[0] || '') && list.length > 1) { sig = list[0].slice(1).replace(/^SIG/, ''); list = list.slice(1); }
    if (!list.length) { ctx.err('usage: kill [-s signal_name] pid ...\n       kill -l [exit_status]\n       kill -signal_name pid ...\n       kill -signal_number pid ...\n'); return 1; }
    var status = 0;
    list.forEach(function (p) {
      if (!/^\d+$/.test(p)) { ctx.err('kill: illegal pid: ' + p + '\n'); status = 1; return; }
      var pid = parseInt(p, 10), r = procs.kill(pid);
      if (!r.ok) { ctx.err('kill: kill ' + pid + ' failed: ' + r.error + '\n'); status = 1; }
    });
    return status;
  });
  def('killall', function (args, ctx) {
    var names = args.filter(function (a) { return a.charAt(0) !== '-'; });
    if (!names.length) { ctx.err('usage: killall [-delmsvz] [-help] [-SIGNAL] [-u user] [-t tty] [-c procname] [-y procname] [procname ...]\n'); return 1; }
    var status = 0;
    names.forEach(function (n) {
      var found = procs.byName(n).filter(function (r) { return r.user === 'an'; });
      if (!found.length) { ctx.err('No matching processes belonging to you were found\n'); status = 1; return; }
      found.forEach(function (r) { procs.kill(r.pid); });
    });
    return status;
  });

  /* ================================================================ network (fake: nothing leaves this page, SPEC §1) */
  var NET = { ip: '10.20.31.57', mask: '255.255.255.0', router: '10.20.31.1', dns: '10.20.0.53', mac: 'a4:83:e7:2c:91:5e', ssid: 'NTNU-Classroom' };
  var HOSTS = { 'example.com': '93.184.215.14', 'www.example.com': '93.184.215.14', 'google.com': '142.250.196.110', 'www.google.com': '142.250.196.100', 'github.com': '20.205.243.166', 'www.github.com': '20.205.243.166',
    'ntnu.edu.tw': '140.122.64.41', 'www.ntnu.edu.tw': '140.122.64.41', 'openai.com': '104.18.33.45', 'chatgpt.com': '104.18.32.47', 'apple.com': '17.253.144.10', 'wikipedia.org': '208.80.153.224', 'localhost': '127.0.0.1', 'macbook-air.local': NET.ip, 'macbook-air': NET.ip };
  function resolveHost(name) {
    var n = String(name).toLowerCase().replace(/\.$/, '');
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(n)) return n;
    if (hasOwn.call(HOSTS, n)) return HOSTS[n];
    if (n.indexOf('.') < 0 || /[^a-z0-9.-]/.test(n)) return null;
    var hsh = 0; for (var i = 0; i < n.length; i++) hsh = (hsh * 33 + n.charCodeAt(i)) % 250;
    return '203.0.113.' + (hsh + 2);
  }
  function hostOf(arg) {
    var m = /^(?:[a-z][a-z0-9+.-]*:\/\/)?(?:[^@\/]*@)?([^\/:?#]+)/i.exec(arg);
    return m ? m[1] : arg;
  }
  var IFCONFIG = {
    lo0: 'lo0: flags=8049<UP,LOOPBACK,RUNNING,MULTICAST> mtu 16384\n\toptions=1203<RXCSUM,TXCSUM,TXSTATUS,SW_TIMESTAMP>\n\tinet 127.0.0.1 netmask 0xff000000\n\tinet6 ::1 prefixlen 128 \n\tinet6 fe80::1%lo0 prefixlen 64 scopeid 0x1 \n\tnd6 options=201<PERFORMNUD,DAD>\n',
    en0: 'en0: flags=8863<UP,BROADCAST,SMART,RUNNING,SIMPLEX,MULTICAST> mtu 1500\n\toptions=6460<TSO4,TSO6,CHANNEL_IO,PARTIAL_CSUM,ZEROINVERT_CSUM>\n\tether ' + NET.mac + ' \n\tinet6 fe80::1c3a:7f2:b6d1:4e9a%en0 prefixlen 64 secured scopeid 0xc \n\tinet 10.20.31.57 netmask 0xffffff00 broadcast 10.20.31.255\n\tnd6 options=201<PERFORMNUD,DAD>\n\tmedia: autoselect\n\tstatus: active\n',
    awdl0: 'awdl0: flags=8943<UP,BROADCAST,RUNNING,PROMISC,SIMPLEX,MULTICAST> mtu 1500\n\toptions=6460<TSO4,TSO6,CHANNEL_IO,PARTIAL_CSUM,ZEROINVERT_CSUM>\n\tether 7a:5b:c3:81:0e:4d \n\tinet6 fe80::785b:c3ff:fe81:e4d%awdl0 prefixlen 64 scopeid 0xe \n\tnd6 options=201<PERFORMNUD,DAD>\n\tmedia: autoselect (<unknown type>)\n\tstatus: inactive\n'
  };
  def('ifconfig', function (args, ctx) {
    var names = args.filter(function (a) { return a.charAt(0) !== '-'; });
    if (!names.length) { ctx.out(IFCONFIG.lo0 + IFCONFIG.awdl0 + IFCONFIG.en0); return 0; }
    var n = names[0];
    if (!hasOwn.call(IFCONFIG, n)) { ctx.err('ifconfig: interface ' + n + ' does not exist\n'); return 1; }
    ctx.out(IFCONFIG[n]);
    return 0;
  });
  def('ipconfig', function (args, ctx) {
    var a = args[0], ifn = args[1];
    if (a === 'getifaddr') { if (ifn === 'en0') { ctx.out(NET.ip + '\n'); return 0; } return 1; }
    if (a === 'getoption' && ifn === 'en0') {
      var tb = { subnet_mask: NET.mask, router: NET.router, domain_name_server: NET.dns, domain_name: 'local' };
      if (tb[args[2]]) { ctx.out(tb[args[2]] + '\n'); return 0; }
      return 1;
    }
    if (a === 'getsummary' && ifn === 'en0') { ctx.out('<dictionary> {\n  Hardware : Wi-Fi\n  InterfaceType : IEEE80211\n  LinkStatusActive : TRUE\n  NetworkID : ' + NET.ssid + '\n  Router : ' + NET.router + '\n  SSID : ' + NET.ssid + '\n}\n'); return 0; }
    ctx.err('Usage: ipconfig <command> <args>\n  ipconfig getifaddr en0\n');
    return 1;
  });
  def('networksetup', function (args, ctx) {
    var a = args[0];
    if (a === '-getairportnetwork') { ctx.out('Current Wi-Fi Network: ' + NET.ssid + '\n'); return 0; }
    if (a === '-getairportpower') { ctx.out('Wi-Fi Power (en0): On\n'); return 0; }
    if (a === '-listallhardwareports') { ctx.out('\nHardware Port: Wi-Fi\nDevice: en0\nEthernet Address: ' + NET.mac + '\n\nHardware Port: Thunderbolt Bridge\nDevice: bridge0\nEthernet Address: 36:ab:cd:12:34:00\n\nVLAN Configuration\n===\n'); return 0; }
    if (a === '-listallnetworkservices') { ctx.out('An asterisk (*) denotes that a network service is disabled.\nWi-Fi\nThunderbolt Bridge\n'); return 0; }
    if (a === '-getdnsservers') { ctx.out(NET.dns + '\n'); return 0; }
    if (a === '-getinfo') { ctx.out('DHCP Configuration\nIP address: ' + NET.ip + '\nSubnet mask: ' + NET.mask + '\nRouter: ' + NET.router + '\nClient ID: \nIPv6: Automatic\nIPv6 IP address: none\nIPv6 Router: none\nWi-Fi ID: ' + NET.mac + '\n'); return 0; }
    if (a && a.indexOf('-set') === 0) { ctx.err('You must be root to change this setting（練習版不能改網路設定）\n'); return 14; }
    ctx.err('networksetup 練習版只做查詢：-getairportnetwork en0、-listallhardwareports、-getinfo Wi-Fi、-getdnsservers Wi-Fi\n');
    return a ? 1 : 0;
  });

  USAGE.ping = ['usage: ping [-AaDdfnoQqRrv] [-b boundif] [-c count] [-G sweepmaxsize] [-g sweepminsize] [-h sweepincrsize] [-i wait] [-k trafficclass] [-l preload] [-M mask | time] [-m ttl] [-p pattern] [-S src_addr] [-s packetsize] [-t timeout][-W waittime] [-z tos] host', '       ping [-AaDdfLnoQqRrv] [-c count] [-I iface] [-i wait] [-l preload] [-M mask | time] [-m ttl] [-p pattern] [-S src_addr] [-s packetsize] [-T ttl] [-t timeout] [-W waittime] [-z tos] mcast-group'];
  def('ping', function* (args, ctx) {
    var count = Infinity, host = null, interval = 1000, size = 56, i = 0;
    for (; i < args.length; i++) {
      var a = args[i];
      if (a === '-c') { count = parseInt(args[++i], 10); if (!(count > 0)) { ctx.err('ping: invalid count of packets to transmit: \'' + args[i] + '\'\n'); return 64; } }
      else if (a === '-i') { interval = Math.max(200, parseFloat(args[++i]) * 1000 || 1000); }
      else if (a === '-s') size = parseInt(args[++i], 10) || 56;
      else if (a === '-t' || a === '-W' || a === '-m' || a === '-b' || a === '-S' || a === '-p' || a === '-M' || a === '-k' || a === '-l' || a === '-z' || a === '-I') i++;
      else if (a.charAt(0) === '-' && a.length > 1) { /* flags like -n -q -o -D accepted */ }
      else host = a;
    }
    if (host === null) { ctx.err(USAGE.ping.join('\n') + '\n'); return 64; }
    var ip = resolveHost(host);
    if (ip === null) { ctx.err('ping: cannot resolve ' + host + ': Unknown host\n'); return 68; }
    var local = ip === '127.0.0.1', lan = ip === NET.router || ip === NET.ip;
    ctx.out('PING ' + host + ' (' + ip + '): ' + size + ' data bytes\n');
    var sent = 0, got = 0, times = [], rng = ctx.session.rng, printed = false;
    function stats() {
      if (printed) return;
      printed = true;
      var loss = sent ? ((sent - got) / sent * 100).toFixed(1) : '0.0';
      ctx.out('\n--- ' + host + ' ping statistics ---\n' + sent + ' packets transmitted, ' + got + ' packets received, ' + loss + '% packet loss\n');
      if (times.length) {
        var min = Math.min.apply(null, times), max = Math.max.apply(null, times), avg = times.reduce(function (x, y) { return x + y; }, 0) / times.length;
        var sd = Math.sqrt(times.reduce(function (x, y) { return x + (y - avg) * (y - avg); }, 0) / times.length);
        ctx.out('round-trip min/avg/max/stddev = ' + min.toFixed(3) + '/' + avg.toFixed(3) + '/' + max.toFixed(3) + '/' + sd.toFixed(3) + ' ms\n');
      }
    }
    try {
      while (sent < count) {
        var t = local ? 0.04 + rng() * 0.03 : lan ? 2 + rng() * 2.2 : 12 + rng() * 6;
        yield { sleep: sent === 0 ? 120 : interval };
        sent++; got++;
        times.push(t);
        ctx.out((size + 8) + ' bytes from ' + ip + ': icmp_seq=' + (sent - 1) + ' ttl=' + (local || lan ? 64 : 56) + ' time=' + t.toFixed(3) + ' ms\n');
      }
    } finally { stats(); }
    return 0;
  });

  var EXAMPLE_HTML = '<!doctype html>\n<html>\n<head>\n    <title>Example Domain</title>\n\n    <meta charset="utf-8" />\n    <meta http-equiv="Content-type" content="text/html; charset=utf-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1" />\n    <style type="text/css">\n    body {\n        background-color: #f0f0f2;\n        margin: 0;\n        padding: 0;\n        font-family: -apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", "Open Sans", "Helvetica Neue", Helvetica, Arial, sans-serif;\n        \n    }\n    div {\n        width: 600px;\n        margin: 5em auto;\n        padding: 2em;\n        background-color: #fdfdff;\n        border-radius: 0.5em;\n        box-shadow: 2px 3px 7px 2px rgba(0,0,0,0.02);\n    }\n    a:link, a:visited {\n        color: #38488f;\n        text-decoration: none;\n    }\n    @media (max-width: 700px) {\n        div {\n            margin: 0 auto;\n            width: auto;\n        }\n    }\n    </style>    \n</head>\n\n<body>\n<div>\n    <h1>Example Domain</h1>\n    <p>This domain is for use in illustrative examples in documents. You may use this\n    domain in literature without prior coordination or asking for permission.</p>\n    <p><a href="https://www.iana.org/domains/example">More information...</a></p>\n</div>\n</body>\n</html>\n';
  var OFFLINE_HTML = '<!doctype html>\n<html lang="zh-Hant">\n<head><meta charset="utf-8"><title>練習版瀏覽器</title></head>\n<body>\n<h1>這台練習電腦不能上網</h1>\n<p>你看到的是練習版放在這裡的假網頁，不是真的網站。</p>\n</body>\n</html>\n';
  USAGE.curl = ['curl: try \'curl --help\' or \'curl --manual\' for more information'];
  def('curl', function* (args, ctx) {
    var s = ctx.session, vfs = s.vfs;
    var F = {}, url = null, outFile = null, i = 0, headers = false, verbose = false;
    for (; i < args.length; i++) {
      var a = args[i];
      if (a === '-o' || a === '--output') { outFile = args[++i]; continue; }
      if (a === '-H' || a === '--header' || a === '-X' || a === '--request' || a === '-d' || a === '--data' || a === '-u' || a === '--user' || a === '-A' || a === '--user-agent' || a === '-e' || a === '-m' || a === '--max-time' || a === '-w' || a === '-b' || a === '-c' || a === '-T' || a === '-F') { i++; continue; }
      if (a === '--url') { url = args[++i]; continue; }
      if (a.charAt(0) === '-' && a.length > 1) {
        if (a.indexOf('--') === 0) { if (a === '--silent') F.s = true; else if (a === '--head') headers = true; else if (a === '--location') F.L = true; else if (a === '--remote-name') F.O = true; else if (a === '--verbose') verbose = true; else if (a === '--include') F.i = true; continue; }
        for (var k = 1; k < a.length; k++) {
          var ch = a.charAt(k);
          if (ch === 'I') headers = true; else if (ch === 'v') verbose = true; else if (ch === 's') F.s = true; else if (ch === 'S') F.S = true; else if (ch === 'O') F.O = true; else if (ch === 'L') F.L = true; else if (ch === 'i') F.i = true;
          else if (ch === 'o') { outFile = args[++i]; break; }
        }
        continue;
      }
      if (url === null) url = a;
    }
    if (url === null) { ctx.err('curl: no URL specified!\ncurl: try \'curl --help\' or \'curl --manual\' for more information\n'); return 2; }
    var host = hostOf(url), ip = resolveHost(host);
    if (ip === null) { ctx.err('curl: (6) Could not resolve host: ' + host + '\n'); return 6; }
    yield { sleep: 140 };
    var isExample = /^(www\.)?example\.(com|org|net)$/i.test(host);
    var body = isExample ? EXAMPLE_HTML : OFFLINE_HTML;
    var d = new Date(ms());
    var hdr = 'HTTP/2 200 \r\ncontent-type: text/html\r\netag: "84238dfc8092e5d9c0dac8ef93371a07:1736799080.121134"\r\nlast-modified: Mon, 13 Jan 2025 20:11:20 GMT\r\ncache-control: max-age=2562\r\ndate: ' + strftime('%a, %d %b %Y %H:%M:%S GMT', d, true) + '\r\nalpn: h3\r\ncontent-length: ' + utf8len(body) + '\r\n\r\n';
    if (verbose && !F.s) ctx.err('* Host ' + host + ':443 was resolved.\n* IPv4: ' + ip + '\n*   Trying ' + ip + ':443...\n* Connected to ' + host + ' (' + ip + ') port 443\n> GET / HTTP/2\n> Host: ' + host + '\n> User-Agent: curl/8.7.1\n> Accept: */*\n>\n< HTTP/2 200\n< content-type: text/html\n<\n');
    if (headers) { ctx.out(hdr.replace(/\r\n/g, '\n').replace(/\n\n$/, '\n\n').replace(/\n$/, '\n')); return 0; }
    var target = outFile;
    if (F.O) {
      var path = url.replace(/^[a-z][a-z0-9+.-]*:\/\/[^\/]*/i, '').replace(/[?#].*$/, '');
      target = path.slice(path.lastIndexOf('/') + 1);
      if (!target) { ctx.err('curl: Remote file name has no length!\n\ncurl: (23) Failure writing output to the destination\n'); return 23; }
    }
    if (target !== null && target !== undefined) {
      var size = utf8len(body);
      if (!F.s) {
        ctx.err('  % Total    % Received % Xferd  Average Speed   Time    Time     Time  Current\n                                 Dload  Upload   Total   Spent    Left  Speed\n100 ' + pad(String(size), 5, true) + '  100 ' + pad(String(size), 5, true) + '    0     0  ' + pad(String(Math.round(size * 7.2)), 6, true) + '      0 --:--:-- --:--:-- --:--:-- ' + pad(String(Math.round(size * 7.4)), 6, true) + '\n');
      }
      try { vfs.writeFile(resolvePath(s, target), body, { by: 'terminal' }); }
      catch (e) { ctx.err('curl: (23) Failure writing output to destination\n'); return 23; }
      return 0;
    }
    ctx.out((F.i ? hdr.replace(/\r\n/g, '\n') : '') + body);
    return 0;
  });
  def('nslookup', function (args, ctx) {
    var host = args.filter(function (a) { return a.charAt(0) !== '-'; })[0];
    if (!host) { ctx.out('> '); return 0; }
    var ip = resolveHost(host);
    if (ip === null) { ctx.out('Server:\t\t' + NET.dns + '\nAddress:\t' + NET.dns + '#53\n\n** server can\'t find ' + host + ': NXDOMAIN\n\n'); return 1; }
    ctx.out('Server:\t\t' + NET.dns + '\nAddress:\t' + NET.dns + '#53\n\nNon-authoritative answer:\nName:\t' + host + '\nAddress: ' + ip + '\n\n');
    return 0;
  });
  var HOPS = [['10.20.31.1', 2.1], ['10.20.0.1', 2.9], ['140.122.255.1', 3.4], ['163.28.120.1', 4.8], ['211.72.108.2', 6.3], ['203.69.138.9', 8.7], ['220.128.7.34', 10.9]];
  def('traceroute', function* (args, ctx) {
    var host = args.filter(function (a) { return a.charAt(0) !== '-'; })[0];
    if (!host) { ctx.err('Version 1.4a12+Darwin\nUsage: traceroute [-adeFInrSvx] [-A as_server] [-f first_ttl] [-g gateway] [-i iface]\n\t[-M first_ttl] [-m max_ttl] [-P proto] [-p port] [-q nqueries] [-s src_addr]\n\t[-t tos] [-w waittime] [-z pausemsecs] host [packetlen]\n'); return 64; }
    var ip = resolveHost(host);
    if (ip === null) { ctx.err('traceroute: unknown host ' + host + '\n'); return 68; }
    ctx.out('traceroute to ' + host + ' (' + ip + '), 64 hops max, 52 byte packets\n');
    var rng = ctx.session.rng;
    for (var n = 0; n < HOPS.length + 1; n++) {
      yield { sleep: 160 };
      var hop = n < HOPS.length ? HOPS[n] : [ip, 13.6];
      var t = [0, 1, 2].map(function () { return (hop[1] + (rng() - .5) * 1.2).toFixed(3); });
      ctx.out(pad(String(n + 1), 2, true) + '  ' + hop[0] + ' (' + hop[0] + ')  ' + t[0] + ' ms  ' + t[1] + ' ms  ' + t[2] + ' ms\n');
    }
    return 0;
  });

  /* ================================================== full-screen programs: less, more, man, nano */
  /* a string cut by screen columns: the part from column `from` up to (not including) `to` */
  function sliceCols(str, from, to) {
    var out = '', col = 0;
    for (var ch of str) {
      var w = charWidth(ch.codePointAt(0));
      if (col >= from && col + w <= to) out += ch;
      col += w;
      if (col >= to) break;
    }
    return out;
  }
  function wrapPlain(str, cols) {
    if (str === '') return [''];
    if (str.indexOf(ESC) >= 0) return [str];
    var rows = [], cur = '', w = 0;
    for (var ch of str) {
      var cw = charWidth(ch.codePointAt(0));
      if (cw === 0) { cur += ch; continue; }
      if (w + cw > cols) { rows.push(cur); cur = ''; w = 0; }
      cur += ch; w += cw;
    }
    rows.push(cur);
    return rows;
  }
  var REV = ESC + '[7m', REV_OFF = ESC + '[27m';

  /* the pager: o = {mode: 'less' | 'more' | 'man', lines: [...], label}; returns the app definition */
  function pagerApp(o) {
    var rowsAll = [], top = 0, input = null, msg = '', pattern = null, lastDir = '/', pendingColon = false, lastApi = null;
    function build(cols) {
      rowsAll = [];
      o.lines.forEach(function (l) { rowsAll = rowsAll.concat(wrapPlain(l, cols)); });
    }
    function height(api) { return Math.max(1, api.rows() - 1); }
    function maxTop(api) { return Math.max(0, rowsAll.length - height(api)); }
    function go(n, api) { top = Math.max(0, Math.min(maxTop(api), n)); }
    function percent(api) { return rowsAll.length ? Math.min(100, Math.round((top + height(api)) / rowsAll.length * 100)) : 100; }
    function find(dir, api, from) {
      if (!pattern) return false;
      var n = rowsAll.length, start = from === undefined ? top + (dir > 0 ? 1 : -1) : from;
      for (var k = 0; k < n; k++) {
        var i = ((start + dir * k) % n + n) % n;
        pattern.lastIndex = 0;
        if (pattern.test(strip(rowsAll[i]))) { go(i, api); return true; }
      }
      return false;
    }
    function compile(text) {
      try { return new RegExp(text, /[A-Z]/.test(text) ? 'g' : 'gi'); }
      catch (e) { try { return new RegExp(escRe(text), 'gi'); } catch (e2) { return null; } }
    }
    function startSearch(dir) { input = { dir: dir, text: '' }; msg = ''; }
    var def = {
      name: o.mode,
      start: function (api) { lastApi = api; build(api.cols()); go(0, api); },
      resize: function (api) { build(api.cols()); go(top, api); },
      wheel: function (dy, api) { go(top + (dy > 0 ? 3 : -3), api); },
      render: function (api) {
        var hh = height(api), out = [];
        for (var i = 0; i < hh; i++) {
          var src = rowsAll[top + i];
          if (src === undefined) { out.push(o.mode === 'more' ? '' : '~'); continue; }
          if (pattern && src.indexOf(ESC) < 0) {
            pattern.lastIndex = 0;
            src = src.replace(pattern, function (m) { return m === '' ? m : REV + m + REV_OFF; });
          }
          out.push(src);
        }
        var atEnd = top >= maxTop(api), bar;
        if (input) bar = (input.dir === '/' ? '/' : '?') + input.text;
        else if (msg) bar = REV + msg + REV_OFF;
        else if (o.mode === 'more') bar = REV + '--More--(' + percent(api) + '%)' + REV_OFF;
        else if (o.mode === 'man') bar = atEnd ? REV + '(END)' + REV_OFF : REV + 'Manual page ' + o.label + ' line ' + (top + 1) + ' (press h for help or q to quit)' + REV_OFF;
        else bar = atEnd ? REV + '(END)' + REV_OFF : ':';
        out.push(bar);
        var cur = input ? { r: hh, c: 1 + displayWidth(input.text) } : (pendingColon ? { r: hh, c: 1 } : null);
        if (pendingColon) out[hh] = ':';
        return { rows: out, cursor: cur };
      },
      key: function (k, api) {
        var hh = height(api), key = k.key;
        if (input) {
          if (key === 'Escape' || (k.ctrl && (k.k === 'c' || k.k === 'g'))) { input = null; return; }
          if (key === 'Enter') {
            var dir = input.dir === '/' ? 1 : -1, text = input.text;
            input = null;
            if (text !== '') { pattern = compile(text); lastDir = dir > 0 ? '/' : '?'; }
            if (!pattern) return;
            if (!find(dir, api)) msg = 'Pattern not found  (press RETURN)';
            return;
          }
          if (key === 'Backspace') { if (input.text === '') input = null; else input.text = Array.from(input.text).slice(0, -1).join(''); return; }
          if (key.length === 1 && !k.ctrl && !k.alt) input.text += key;
          return;
        }
        if (msg) { msg = ''; if (key === 'Enter' || key === ' ') return; }
        if (pendingColon) { pendingColon = false; if (key === 'q' || key === 'Q') api.exit(0); return; }
        if (k.ctrl && k.k === 'c') { if (o.mode === 'more') api.exit(0); return; }
        var atEnd = top >= maxTop(api);
        if (key === 'q' || key === 'Q') { api.exit(0); return; }
        if (key === ':') { pendingColon = true; return; }
        if (key === 'Z') return;
        if (key === ' ' || key === 'f' || key === 'PageDown' || (k.ctrl && (k.k === 'f' || k.k === 'v')) || key === 'z') {
          if (o.mode === 'more' && atEnd) { api.exit(0); return; }
          go(top + hh, api); return;
        }
        if (key === 'b' || key === 'PageUp' || (k.ctrl && k.k === 'b') || key === 'w') { go(top - hh, api); return; }
        if (key === 'Enter' || key === 'j' || key === 'e' || key === 'ArrowDown' || (k.ctrl && (k.k === 'n' || k.k === 'e' || k.k === 'j'))) {
          if (o.mode === 'more' && atEnd) { api.exit(0); return; }
          go(top + 1, api); return;
        }
        if (key === 'k' || key === 'y' || key === 'ArrowUp' || (k.ctrl && (k.k === 'p' || k.k === 'y'))) { go(top - 1, api); return; }
        if (key === 'd' || (k.ctrl && k.k === 'd')) { go(top + Math.floor(hh / 2), api); return; }
        if (key === 'u' || (k.ctrl && k.k === 'u')) { go(top - Math.floor(hh / 2), api); return; }
        if (key === 'g' || key === 'Home' || key === '<') { go(0, api); return; }
        if (key === 'G' || key === 'End' || key === '>') { go(maxTop(api), api); return; }
        if (key === '/') { startSearch('/'); return; }
        if (key === '?') { startSearch('?'); return; }
        if (key === 'n') { if (!pattern) { msg = 'No previous regular expression'; return; } if (!find(lastDir === '/' ? 1 : -1, api)) msg = 'Pattern not found  (press RETURN)'; return; }
        if (key === 'N') { if (!pattern) { msg = 'No previous regular expression'; return; } if (!find(lastDir === '/' ? -1 : 1, api)) msg = 'Pattern not found  (press RETURN)'; return; }
        if (key === 'h' || key === 'H') { msg = '練習版：空白鍵 下一頁 · b 上一頁 · j k 一行 · g G 開頭結尾 · / 搜尋 · q 離開'; return; }
        if (key === 'Escape') { pattern = null; return; }
      },
      shown: function () { return lastApi ? rowsAll.slice(0, Math.min(rowsAll.length, top + height(lastApi))) : []; }
    };
    return def;
  }

  /* less / more: a file, or what comes through a pipe */
  function pagerCommand(mode) {
    return function* (args, ctx) {
      var s = ctx.session, vfs = s.vfs, files = args.filter(function (a) { return a.charAt(0) !== '-' || a === '-'; });
      var text, label = '';
      if (!files.length) {
        if (ctx.stdin === null) { ctx.err('Missing filename ("' + mode + ' --help" for help)\n'); return 1; }
        text = ctx.stdin;
      } else {
        var f = files[0], abs = resolvePath(s, f), st = vfs.stat(abs);
        if (!st) { ctx.err(f + ': No such file or directory\n'); return 1; }
        if (st.type === 'dir') { ctx.err('*** ' + f + ': Is a directory ***\n'); return 1; }
        if (st.kind !== 'text') { ctx.err('"' + f + '" may be a binary file.  See it anyway? （練習版不顯示二進位檔案）\n'); return 1; }
        text = vfs.readFile(abs, { by: 'terminal' });
        label = f;
      }
      var lines = text === '' ? [] : text.replace(/\n$/, '').split('\n');
      if (!ctx.tty) { ctx.out(text); return 0; }
      var def = pagerApp({ mode: mode, lines: lines, label: label });
      var res = yield { app: def };
      if (mode === 'more') { var shown = def.shown(); if (shown.length) ctx.out(shown.join('\n') + '\n'); }
      return res || 0;
    };
  }
  def('less', pagerCommand('less'));
  def('more', pagerCommand('more'));
  def('most', function (args, ctx) { return commands.less(args, ctx); });

  /* ------------------------------------------------------------ man pages */
  /* name, one-line description, synopsis lines, description paragraphs (\n = new paragraph), options [flag, text], extra sections [title, text] */
  var MAN_PAGES = {};
  function man(name, sec, desc, syn, text, opts, extra) { MAN_PAGES[name] = { sec: sec, desc: desc, syn: syn, text: text, opts: opts || [], extra: extra || [] }; }
  var DEF_SEE = 'The practice Mac only shows the start of each manual page.';

  man('ls', '1', 'list directory contents', ['ls [-ABCFGHILOPRSTUWabcdefghiklmnopqrstuvwxy1%,] [--color=when] [-D format] [file ...]'],
    'For each operand that names a file of a type other than directory, ls displays its name as well as any requested, associated information.  For each operand that names a directory, ls displays the names of files contained within that directory, as well as any requested, associated information.\nIf no operands are given, the contents of the current directory are displayed.  If more than one operand is given, non-directory operands are displayed first; directory and non-directory operands are sorted separately and in lexicographical order.',
    [['-a', 'Include directory entries whose names begin with a dot (‘.’).'], ['-A', 'List all entries except for . and ...  Always set for the super-user.'], ['-F', 'Display a slash (‘/’) immediately after each pathname that is a directory, an asterisk (‘*’) after each that is executable, an at sign (‘@’) after each symbolic link.'], ['-G', 'Enable colorized output.'], ['-h', 'When used with the -l option, use unit suffixes: Byte, Kilobyte, Megabyte, Gigabyte, Terabyte and Petabyte in order to reduce the number of digits to four or fewer using base 2 for sizes.'], ['-l', '(The lowercase letter “ell”.)  List files in the long format.'], ['-R', 'Recursively list subdirectories encountered.'], ['-r', 'Reverse the order of the sort to get reverse lexicographical order or the oldest entries first (or largest files last, if combined with sort by size).'], ['-S', 'Sort files by size, largest first.'], ['-t', 'Sort by descending time modified (most recently modified first).'], ['-1', '(The numeric digit “one”.)  Force output to be one entry per line.']]);
  man('cd', '1', 'change the working directory (shell builtin)', ['cd [-L|-P] [dir]', 'cd old new', 'cd -'],
    'Change the current directory to dir.  With no argument, cd goes to your home directory (~).\ncd .. goes up one level, and cd - goes back to the previous directory.  cd is built into the shell, so it has no manual page of its own on the real Mac (the text here comes from the zsh builtins).');
  man('pwd', '1', 'return working directory name', ['pwd [-L | -P]'], 'The pwd utility writes the absolute pathname of the current working directory to the standard output.',
    [['-L', 'Display the logical current working directory.'], ['-P', 'Display the physical current working directory (all symbolic links resolved).']]);
  man('mkdir', '1', 'make directories', ['mkdir [-pv] [-m mode] directory_name ...'], 'The mkdir utility creates the directories named as operands, in the order specified, using mode rwxrwxrwx (0777) as modified by the current umask.',
    [['-m', 'Set the file permission bits of the final created directory to the specified mode.'], ['-p', 'Create intermediate directories as required.  If this option is not specified, the full path prefix of each operand must already exist.'], ['-v', 'Be verbose when creating directories, listing them as they are created.']]);
  man('rmdir', '1', 'remove directories', ['rmdir [-p] directory ...'], 'The rmdir utility removes the directory entry specified by each directory argument, provided it is empty.', [['-p', 'Each directory argument is treated as a pathname of which all components will be removed, if they are empty, starting with the last most component.']]);
  man('touch', '1', 'change file access and modification times', ['touch [-A [-][[hh]mm]SS] [-achm] [-r file] [-t [[CC]YY]MMDDhhmm[.SS]] file ...'], 'The touch utility sets the modification and access times of files.  If any file does not exist, it is created with default permissions.',
    [['-c', 'Do not create the file if it does not exist.'], ['-m', 'Change the modification time of the file.'], ['-r', 'Use the access and modifications times from the specified file instead of the current time of day.']]);
  man('cp', '1', 'copy files', ['cp [-R [-H | -L | -P]] [-fi | -n] [-aclpSsvXx] source_file target_file', 'cp [-R [-H | -L | -P]] [-fi | -n] [-aclpSsvXx] source_file ... target_directory'],
    'In the first synopsis form, the cp utility copies the contents of the source_file to the target_file.  In the second synopsis form, the contents of each named source_file is copied to the destination target_directory.  The names of the files themselves are not changed.',
    [['-i', 'Cause cp to write a prompt to the standard error output before copying a file that would overwrite an existing file.'], ['-n', 'Do not overwrite an existing file.'], ['-R', 'If source_file designates a directory, cp copies the directory and the entire subtree connected at that point.'], ['-v', 'Cause cp to be verbose, showing files as they are copied.']]);
  man('mv', '1', 'move files', ['mv [-f | -i | -n] [-hv] source target', 'mv [-f | -i | -n] [-v] source ... directory'],
    'In its first form, the mv utility renames the file named by the source operand to the destination path named by the target operand.  In its second form, mv moves each file named by a source operand to a destination file in the existing directory named by the directory operand.  If the destination does not exist, the source is simply renamed.',
    [['-f', 'Do not prompt for confirmation before overwriting the destination path.'], ['-i', 'Cause mv to write a prompt to standard error before moving a file that would overwrite an existing file.'], ['-n', 'Do not overwrite an existing file.'], ['-v', 'Cause mv to be verbose, showing files after they are moved.']]);
  man('rm', '1', 'remove directory entries', ['rm [-dfiIPRrvWx] file ...', 'unlink [--] file'], 'The rm utility attempts to remove the non-directory type files specified on the command line.  There is no Trash: a file removed with rm is gone.',
    [['-d', 'Attempt to remove directories as well as other types of files.'], ['-f', 'Attempt to remove the files without prompting for confirmation, regardless of the file’s permissions.  If the file does not exist, do not display a diagnostic message or modify the exit status to reflect an error.'], ['-i', 'Request confirmation before attempting to remove each file, regardless of the file’s permissions.'], ['-R', 'Attempt to remove the file hierarchy rooted in each file argument.  The -R option implies the -d option.'], ['-r', 'Equivalent to -R.'], ['-v', 'Be verbose when deleting files, showing them as they are removed.']]);
  man('cat', '1', 'concatenate and print files', ['cat [-belnstuv] [file ...]'], 'The cat utility reads files sequentially, writing them to the standard output.  The file operands are processed in command-line order.  If file is a single dash (‘-’) or absent, cat reads from the standard input.',
    [['-b', 'Number the non-blank output lines, starting at 1.'], ['-n', 'Number the output lines, starting at 1.'], ['-s', 'Squeeze multiple adjacent empty lines, causing the output to be single spaced.']]);
  man('head', '1', 'display first lines of a file', ['head [-n count | -c bytes] [file ...]'], 'This filter displays the first count lines or bytes of each of the specified files, or of the standard input if no files are specified.  If count is omitted it defaults to 10.', [['-n', 'Display the first count lines.'], ['-c', 'Display the first bytes.']]);
  man('tail', '1', 'display the last part of a file', ['tail [-r] [-q] [-c # | -n #] [file ...]', 'tail -f [-q] [-n #] file'], 'The tail utility displays the contents of file or, by default, its standard input, to the standard output.  The display begins at a byte, line or 512-byte block location in the input.',
    [['-f', 'Do not stop when end-of-file is reached, but rather to wait for additional data to be appended to the input.  Press Control-C to stop.'], ['-n', 'The location is number lines.'], ['-r', 'The -r option causes the input to be displayed in reverse order, by line.']]);
  man('wc', '1', 'word, line, character, and byte count', ['wc [-Lclmw] [file ...]'], 'The wc utility displays the number of lines, words, and bytes contained in each input file, or standard input (if no file is specified) to the standard output.  A line is defined as a string of characters delimited by a ⟨newline⟩ character.',
    [['-c', 'The number of bytes in each input file is written to the standard output.'], ['-l', 'The number of lines in each input file is written to the standard output.'], ['-m', 'The number of characters in each input file is written to the standard output.'], ['-w', 'The number of words in each input file is written to the standard output.']]);
  man('grep', '1', 'file pattern searcher', ['grep [-abcdDEFGHhIiJLlMmnOopqRSsUVvwXxZz] [-A num] [-B num] [-C[num]] [-e pattern] [-f file] [--binary-files=value] [--color=when] [--context[=num]] [--directories=action] [--label] [--line-buffered] [--null] [pattern] [file ...]'],
    'The grep utility searches any given input files, selecting lines that match one or more patterns.  By default, a pattern matches an input line if the regular expression (RE) in the pattern matches the input line without its trailing newline.  An empty expression matches every line.',
    [['-c', 'Only a count of selected lines is written to standard output.'], ['-E', 'Interpret pattern as an extended regular expression (i.e., force grep to behave as egrep).'], ['-i', 'Perform case insensitive matching.'], ['-l', 'Only the names of files containing selected lines are written to standard output.'], ['-n', 'Each output line is preceded by its relative line number in the file, starting at line 1.'], ['-r', 'Recursively search subdirectories listed.'], ['-v', 'Selected lines are those not matching any of the specified patterns.'], ['-w', 'The expression is searched for as a word (as if surrounded by ‘[[:<:]]’ and ‘[[:>:]]’).']]);
  man('find', '1', 'walk a file hierarchy', ['find [-H | -L | -P] [-EXdsx] [-f path] path ... [expression]', 'find [-H | -L | -P] [-EXdsx] -f path [path ...] [expression]'], 'The find utility recursively descends the directory tree for each path listed, evaluating an expression (composed of the “primaries” and “operands” listed below) in terms of each file in the tree.',
    [['-name', 'True if the last component of the pathname being examined matches pattern.  Special shell pattern matching characters (“[”, “]”, “*”, and “?”) may be used as part of pattern.'], ['-iname', 'Like -name, but the match is case insensitive.'], ['-type', 'True if the file is of the specified type: f (regular file), d (directory), l (symbolic link).'], ['-maxdepth', 'Do not descend more than n levels of directories below the starting points.'], ['-size', 'True if the file’s size, rounded up, in 512-byte blocks is n.  With c, k, M, G suffix the size is in bytes, kilobytes and so on.']]);
  man('sort', '1', 'sort or merge records (lines) of text and binary files', ['sort [-bcCdfghiRMmnrsuVz] [-k field1[,field2]] [-S memsize] [-T dir] [-t char] [-o output] [file ...]'], 'The sort utility sorts text and binary files by lines.  A line is a record separated from the subsequent record by a newline.  By default, sort uses the whole line as the key.',
    [['-n', 'Sort fields numerically by arithmetic value.'], ['-r', 'Sort in reverse order.'], ['-t', 'Use char as a field separator character.'], ['-k', 'Define a restricted sort key that has the starting position field1, and optional ending position field2 of a key field.'], ['-u', 'Unique keys.  Suppress all lines that have a key that is equal to an already processed one.']]);
  man('uniq', '1', 'report or filter out repeated lines in a file', ['uniq [-cdiu] [-D[septype]] [-f fields] [-s chars] [input [output]]'], 'The uniq utility reads the specified input file comparing adjacent lines, and writes a copy of each unique input line to the output.  Repeated lines in the input will not be detected if they are not adjacent, so it may be necessary to sort the files first.',
    [['-c', 'Precede each output line with the count of the number of times the line occurred in the input, followed by a single space.'], ['-d', 'Only output lines that are repeated in the input.'], ['-u', 'Only output lines that are not repeated in the input.']]);
  man('cut', '1', 'cut out selected portions of each line of a file', ['cut -b list [-n] [file ...]', 'cut -c list [file ...]', 'cut -f list [-s] [-w | -d delim] [file ...]'], 'The cut utility selects portions of each line (as specified by list) from each file (or the standard input by default), and writes them to the standard output.',
    [['-c', 'The list specifies character positions.'], ['-d', 'Use delim as the field delimiter character instead of the tab character.'], ['-f', 'The list specifies fields, separated in the input by the field delimiter character (see the -d option).']]);
  man('tr', '1', 'translate characters', ['tr [-Ccsu] string1 string2', 'tr [-Ccu] -d string1', 'tr [-Ccu] -s string1'], 'The tr utility copies the standard input to the standard output with substitution or deletion of selected characters.', [['-d', 'The -d option causes characters to be deleted from the input.'], ['-s', 'The -s option squeezes multiple occurrences of the characters listed in the last operand into a single instance.']]);
  man('diff', '1', 'compare files line by line', ['diff [-abdipTtw] [-c | -e | -f | -n | -q | -u] file1 file2'], 'The diff utility compares the contents of file1 and file2 and writes to the standard output the list of changes necessary to convert one file into the other.  No output is produced if the files are identical.', [['-q', 'Report only whether the files differ, not the details of the differences.'], ['-u', 'Produce a unified diff with three lines of context.']]);
  man('chmod', '1', 'change file modes or Access Control Lists', ['chmod [-fhv] [-R [-H | -L | -P]] mode file ...'], 'The chmod utility modifies the file mode bits of the listed files as specified by the mode operand.  Modes may be absolute (an octal number such as 755) or symbolic (such as u+x).',
    [['-R', 'Change the modes of the file hierarchies rooted in the files, instead of just the files themselves.'], ['-v', 'Cause chmod to be verbose, showing filenames as the mode is modified.']], [['EXAMPLES', 'chmod +x script.sh     make a file executable\nchmod 644 notes.txt    owner read/write, everybody else read']]);
  man('ln', '1', 'make links', ['ln [-Ffhinsv] source_file [target_file]', 'ln [-Ffhinsv] source_file ... target_dir'], 'The ln utility creates a new directory entry (linked file) which has the same modes as the original file.  With -s the link is a symbolic link: a small file that holds the path of the target.', [['-s', 'Create a symbolic link.'], ['-f', 'If the target file already exists, then unlink it so that the link may occur.']]);
  man('du', '1', 'display disk usage statistics', ['du [-Aclnx] [-H | -L | -P] [-g | -h | -k | -m] [-a | -s | -d depth] [-B blocksize] [-I mask] [-t threshold] [file ...]'], 'The du utility displays the file system block usage for each file argument and for each directory in the file hierarchy rooted in each directory argument.', [['-h', '“Human-readable” output.  Use unit suffixes: Byte, Kilobyte, Megabyte, Gigabyte, Terabyte and Petabyte.'], ['-s', 'Display an entry for each specified file.'], ['-d', 'Display an entry for all files and directories depth directories deep.']]);
  man('df', '1', 'display free disk space', ['df [-b | -H | -h | -k | -m | -g | -P] [-ailn] [-T type] [filesystem | file ...]'], 'The df utility displays statistics about the amount of free disk space on the specified mounted file system or on the file system of which file is a part.', [['-h', '“Human-readable” output.  Use unit suffixes: Byte, Kilobyte, Megabyte, Gigabyte, Terabyte and Petabyte.']]);
  man('file', '1', 'determine file type', ['file [-bchiklLNnprsvzZ0] file ...'], 'The file utility tests each argument in an attempt to classify it.  There are three sets of tests, performed in this order: filesystem tests, magic tests, and language tests.', [['-b', 'Do not prepend filenames to output lines (brief mode).'], ['-i', 'Output mime type strings rather than the more traditional human readable ones.']]);
  man('stat', '1', 'display file status', ['stat [-FLnq] [-f format | -l | -r | -s | -x] [-t timefmt] [file ...]'], 'The stat utility displays information about the file pointed to by file.', [['-x', 'Display information in a more verbose way as known from some Linux distributions.'], ['-f', 'Display information using the specified format.']]);
  man('open', '1', 'open files and directories', ['open [-e] [-t] [-f] [-W] [-R] [-n] [-g] [-h] [-s <partial SDK name>][-b <bundle identifier>] [-a <application>] [filenames] [--args arguments]'], 'The open command opens a file (or a directory or URL), just as if you had double-clicked the file’s icon.  If no application name is specified, the default application as determined via LaunchServices is used to open the specified files.',
    [['-a', 'Opens with the specified application.'], ['-R', 'Reveals the file(s) in the Finder.'], ['-e', 'Opens with TextEdit.']], [['EXAMPLES', 'open .                  open the current folder in Finder\nopen -a Safari https://example.com\nopen -R notes.txt       show the file in Finder']]);
  man('unzip', '1', 'list, test and extract compressed files in a ZIP archive', ['unzip [-Z] [-opts[modifiers]] file[.zip] [list] [-x xlist] [-d exdir]'], 'unzip will list, test, or extract files from a ZIP archive, commonly found on MS-DOS systems.  The default behavior is to extract into the current directory (and subdirectories below it) all files from the specified ZIP archive.', [['-d', 'An optional directory to which to extract files.'], ['-l', 'List archive files (short format).'], ['-o', 'Overwrite existing files without prompting.'], ['-q', 'Perform operations quietly.']]);
  man('zip', '1', 'package and compress (archive) files', ['zip [-options] [-b path] [-t mmddyyyy] [-n suffixes] [zipfile list] [-xi list]'], 'zip is a compression and file packaging utility for Unix, VMS, MSDOS, OS/2, Windows 9x/NT/XP, Minix, Atari and Macintosh.  The default action is to add or replace zipfile entries from list.', [['-r', 'Travel the directory structure recursively.'], ['-q', 'Quiet mode; eliminate informational messages and comment prompts.'], ['-j', 'Store just the name of a saved file (junk the path).']]);
  man('tar', '1', 'manipulate tape archives', ['tar [-]c [options] [files | directories]', 'tar [-]x [options] [patterns]', 'tar [-]t [options] [patterns]'], 'tar creates and manipulates streaming archive files.  This implementation can extract from tar, pax, cpio, zip, jar, ar, xar, rpm, 7-zip, and ISO 9660 cdrom images and can create tar, pax, cpio, ar, zip, 7-zip, and shar archives.',
    [['-c', 'Create a new archive containing the specified items.'], ['-x', 'Extract to disk from the archive.'], ['-t', 'List archive contents to stdout.'], ['-f', 'Read the archive from or write the archive to the specified file.'], ['-z', 'Compress the resulting archive with gzip(1).'], ['-v', 'Produce verbose output.'], ['-C', 'In c and r mode, this changes the directory before adding the following files.  In x mode, change directories after opening the archive but before extracting entries from the archive.']]);
  man('echo', '1', 'write arguments to the standard output', ['echo [-n] [string ...]'], 'The echo utility writes any specified operands, separated by single blank (‘ ’) characters and followed by a newline (‘\\n’) character, to the standard output.', [['-n', 'Do not print the trailing newline character.']]);
  man('printf', '1', 'formatted output', ['printf format [arguments ...]'], 'The printf utility formats and prints its arguments, after the first, under control of the format.  The format is a character string which contains three types of objects: plain characters, which are simply copied to standard output, character escape sequences, and format specifications.', [], [['EXAMPLES', 'printf "%s has %d points\\n" Ann 90']]);
  man('date', '1', 'display or set date and time', ['date [-jnRu] [-I[date|hours|minutes|seconds]] [-f input_fmt] [-r seconds | -r file] [-v[+|-]val[y|m|w|d|H|M|S]] [[[[mm]dd]HH]MM[[cc]yy][.SS] | new_date] [+output_fmt]'], 'When invoked without arguments, the date utility displays the current date and time.  An operand with a leading plus (‘+’) sign signals a user-defined format string which specifies the format in which to display the date and time.', [['-u', 'Display or set the date in UTC (Coordinated Universal) time.']], [['EXAMPLES', 'date +%Y-%m-%d          2026-10-02\ndate +"%H:%M"          09:52']]);
  man('cal', '1', 'displays a calendar and the date of Easter', ['cal [-3hjy] [-A months] [-B months] [[month] year]'], 'The cal utility displays a simple calendar in traditional format and ncal offers an alternative layout, more options and the date of Easter.  The new format is a little cramped but it makes a year fit on a 25x80 terminal.', [['-3', 'Display the previous, current and next month surrounding today.'], ['-y', 'Display a calendar for the current year.']]);
  man('ps', '1', 'process status', ['ps [-AaCcEefhjlMmrSTvwXx] [-O fmt | -o fmt] [-G gid[,gid...]] [-g grp[,grp...]] [-u [uid,uid...]] [-p pid[,pid...]] [-t tty[,tty...]] [-U user[,user...]]'], 'The ps utility displays a header line, followed by lines containing information about all of your processes that have controlling terminals.', [['-A', 'Display information about other users’ processes, including those without controlling terminals.'], ['-a', 'Display information about other users’ processes as well as your own.'], ['-x', 'When displaying processes matched by other options, include processes which do not have a controlling terminal.'], ['-u', 'Display the processes belonging to the specified usernames.']], [['EXAMPLES', 'ps aux          every process, with CPU and memory\nps aux | grep Finder']]);
  man('top', '1', 'display sorted information about processes', ['top [-a | -d | -e | -c mode] [-l samples] [-n nprocs] [-o key] [-s delay]'], 'The top program periodically displays a sorted list of system processes.  The default sorting key is pid, but other keys can be used instead.  Press q to leave.', [['-l', 'Use logging mode and display samples samples, even if standard output is a terminal.  0 is treated as infinity.'], ['-n', 'Only display up to nprocs processes.'], ['-o', 'Order the process display by sorting on key in descending order.']]);
  man('kill', '1', 'terminate or signal a process', ['kill [-s signal_name] pid ...', 'kill -l [exit_status]'], 'The kill utility sends a signal to the processes specified by the pid operand(s).  Only the super-user may send signals to other users’ processes.', [['-s', 'A symbolic signal name specifying the signal to be sent instead of the default TERM.'], ['-9', 'Send KILL: the process cannot ignore it.']]);
  man('killall', '1', 'kill processes by name', ['killall [-delmsvz] [-help] [-SIGNAL] [-u user] [-t tty] [-c procname] [-y procname] [procname ...]'], 'The killall utility kills a process or a group of processes based on its name.  By default, it sends a TERM signal to all processes with a real UID identical to the caller.', [['-v', 'Be more verbose about what will be done.']]);
  man('curl', '1', 'transfer a URL', ['curl [options / URLs]'], 'curl is a tool for transferring data from or to a server using URLs.  This practice Mac has no network, so curl shows you made-up pages: the real example.com page, and a short “practice browser” page for every other address.', [['-I', 'Fetch the headers only.'], ['-o', 'Write output to file instead of stdout.'], ['-O', 'Write output to a local file named like the remote file we get.'], ['-s', 'Silent or quiet mode.  Do not show progress meter or error messages.'], ['-L', 'Follow redirects.']]);
  man('ping', '8', 'send ICMP ECHO_REQUEST packets to network hosts', ['ping [-AaDdfnoQqRrv] [-c count] [-i wait] [-s packetsize] [-t timeout] host'], 'The ping utility uses the ICMP protocol’s mandatory ECHO_REQUEST datagram to elicit an ICMP ECHO_RESPONSE from a host or gateway.  Press Control-C to stop.', [['-c', 'Stop after sending (and receiving) count ECHO_RESPONSE packets.'], ['-i', 'Wait wait seconds between sending each packet.  The default is to wait for one second between each packet.']]);
  man('ifconfig', '8', 'configure network interface parameters', ['ifconfig [-L] [-m] [-r] [-v] interface [create] [address_family] [address [dest_address]] [parameters]'], 'The ifconfig utility is used to assign an address to a network interface and/or configure network interface parameters.  The practice Mac shows the same Wi-Fi interface (en0) every time.');
  man('nslookup', '1', 'query Internet name servers interactively', ['nslookup [-option] [name | -] [server]'], 'Nslookup is a program to query Internet domain name servers.');
  man('traceroute', '8', 'print the route packets take to network host', ['traceroute [-adeFISdnrvx] [-A as_server] [-f first_ttl] [-g gateway] [-i iface] [-M first_ttl] [-m max_ttl] [-P proto] [-p port] [-q nqueries] [-s src_addr] [-t tos] [-w waittime] host [packetlen]'], 'The Internet is a large and complex aggregation of network hardware, connected together by gateways.  Tracking the route one’s packets follow (or finding the miscreant gateway that’s discarding your packets) can be difficult.');
  man('sleep', '1', 'suspend execution for an interval of time', ['sleep seconds'], 'The sleep command suspends execution for a minimum of seconds.  Press Control-C to stop it early.');
  man('which', '1', 'locate a program file in the user’s path', ['which [-as] program ...'], 'The which utility takes a list of command names and searches the path for each executable file that would be run had these commands actually been invoked.', [['-a', 'List all instances of executables found (instead of just the first one of each).']]);
  man('man', '1', 'format and display the on-line manual pages', ['man [-adho] [-t | -w] [-M manpath] [-P pager] [-S mansect] [-m arch[:machine]] [-p [eprtv]] [mansect] page ...'], 'The man utility finds and displays online manual documentation pages.  Press Space for the next page, b for the previous page, / to search, and q to leave.');
  man('less', '1', 'opposite of more', ['less [options] file ...'], 'Less is a program similar to more(1), but which allows backward movement in the file as well as forward movement.', [['SPACE', 'Scroll forward one page.'], ['b', 'Scroll backward one page.'], ['/pattern', 'Search forward for the pattern.'], ['q', 'Exit.']]);
  man('more', '1', 'file perusal filter for crt viewing', ['more [-dlfpcsu] [-num] [+/pattern] [+linenum] [file ...]'], 'more is a filter for paging through text one screenful at a time.  Press Space for the next screenful and q to quit.');
  man('nano', '1', 'Nano’s ANOther editor, inspired by Pico', ['nano [OPTIONS] [[+LINE,COLUMN] FILE]...'], 'nano is a small, free and friendly editor.  The shortcuts are shown at the bottom of the screen: ^ means the Control key.  ^O saves (WriteOut), ^X exits, ^K cuts a line, ^U pastes it back, ^W searches.');
  man('zsh', '1', 'the Z shell', ['zsh [ options ] [ command_file [ argument ... ] ]'], 'Zsh is a UNIX command interpreter (shell) usable as an interactive login shell and as a shell script command processor.  Of the standard shells, zsh most closely resembles ksh but includes many enhancements.', [], [['PIPES AND REDIRECTION', 'cmd1 | cmd2    send the output of cmd1 to cmd2\ncmd > file     write the output to a file (replacing it)\ncmd >> file    add the output to the end of a file\ncmd 2> file    write the error messages to a file\ncmd && cmd2    run cmd2 only if cmd worked\ncmd || cmd2    run cmd2 only if cmd failed']]);
  man('history', '1', 'list the commands you typed (zsh builtin)', ['history [-c] [n]'], 'Without arguments, history lists the command history with event numbers.  history -c clears it.  !! repeats the last command, !n repeats event n.  Press Control-R to search the history.');
  man('alias', '1', 'define or list command aliases (zsh builtin)', ['alias [name[=value] ...]'], 'alias with no arguments prints the list of aliases.  alias ll="ls -l" makes ll mean ls -l in this window.  unalias removes one.');
  man('export', '1', 'set environment variables (zsh builtin)', ['export [name[=value] ...]'], 'export marks variables to be passed to the commands you run.  export NAME=value sets one; export with no arguments lists them all.');
  man('env', '1', 'set environment and execute command, or print environment', ['env [-0iv] [-P altpath] [-S string] [-u name] [name=value ...] [utility [argument ...]]'], 'The env utility executes another utility after modifying the environment as specified on the command line.  If no utility is specified, env prints the current environment.');
  man('xargs', '1', 'construct argument list(s) and execute utility', ['xargs [-0opt] [-E eofstr] [-I replstr] [-n number] [utility [argument ...]]'], 'The xargs utility reads space, tab, newline and end-of-file delimited strings from the standard input and executes utility with the strings as arguments.', [['-n', 'Set the maximum number of arguments taken from standard input for each invocation of utility.'], ['-I', 'Execute utility for each input line, replacing one or more occurrences of replstr in up to replacements arguments to utility with the entire line of input.']]);
  man('tee', '1', 'pipe fitting', ['tee [-ai] [file ...]'], 'The tee utility copies standard input to standard output, making a copy in zero or more files.', [['-a', 'Append the output to the files.']]);
  man('basename', '1', 'return filename or directory portion of pathname', ['basename string [suffix]'], 'The basename utility deletes any prefix ending with the last slash (‘/’) character present in string, and a suffix, if given.');
  man('dirname', '1', 'return directory portion of pathname', ['dirname string [...]'], 'The dirname utility deletes the filename portion, beginning with the last slash (‘/’) character, from string, and writes the result to the standard output.');
  man('realpath', '1', 'return the canonicalized absolute pathname', ['realpath [-q] [path ...]'], 'The realpath utility resolves all symbolic links, extra “/” characters and references to /./ and /../ in path, and writes the resulting absolute pathname to the standard output.');
  man('whoami', '1', 'display effective user id', ['whoami'], 'The whoami utility has been obsoleted by the id(1) utility, and is equivalent to “id -un”.  The command “id -p” is suggested for normal interactive use.');
  man('id', '1', 'return user identity', ['id [user]', 'id -G [-n] [user]', 'id -g [-nr] [user]', 'id -u [-nr] [user]'], 'The id utility displays the user and group names and numeric IDs, of the calling process, to the standard output.');
  man('hostname', '1', 'set or print name of current host system', ['hostname [-fs] [name-of-host]'], 'The hostname utility prints the name of the current host.', [['-s', 'Trim off any domain information from the printed name.']]);
  man('uname', '1', 'display information about the system', ['uname [-amnprsv]'], 'The uname utility writes symbols representing one or more system characteristics to the standard output.', [['-a', 'Behave as though all of the options -mnrsv were specified.'], ['-s', 'Write the name of the operating system implementation.']]);
  man('uptime', '1', 'show how long system has been running', ['uptime'], 'The uptime utility displays the current time, the length of time the system has been up, the number of users, and the load average of the system over the last 1, 5, and 15 minutes.');
  man('sw_vers', '1', 'print macOS version information', ['sw_vers [-productName | -productVersion | -buildVersion]'], 'sw_vers prints version information about the macOS operating system.');
  man('sysctl', '8', 'get or set kernel state', ['sysctl [-bdehiNnoqx] name[=value] ...', 'sysctl [-bdehNnoqx] -a'], 'The sysctl utility retrieves kernel state and allows processes with appropriate privilege to set kernel state.', [['-n', 'Show only variable values, not their names.'], ['-a', 'List all the currently available non-opaque values.']]);
  man('system_profiler', '8', 'reports system hardware and software configuration', ['system_profiler [-listDataTypes] [-xml] [dataType1 ... dataTypeN]'], 'system_profiler reports on the hardware and software configuration of the system.');
  man('pbcopy', '1', 'provide copying and pasting to the pasteboard (the Clipboard) from command line', ['pbcopy [-help] [-pboard {general | ruler | find | font}]'], 'pbcopy takes the standard input and places it in the specified pasteboard.  If no pasteboard is specified, the general pasteboard will be used by default.');
  man('pbpaste', '1', 'provide copying and pasting to the pasteboard (the Clipboard) from command line', ['pbpaste [-help] [-pboard {general | ruler | find | font}]'], 'pbpaste removes the data from the pasteboard and writes it to the standard output.');
  man('say', '1', 'Convert text to audible speech', ['say [-v voice] [-r rate] [-o outfile] [-f file | string ...]'], 'This tool uses the Speech Synthesis manager to convert input text to audible speech and either play it through the sound output device chosen in System Settings or save it to an AIFF file.  The practice Mac makes no sound.');
  man('git', '1', 'the stupid content tracker', ['git [-v | --version] [-h | --help] [-C <path>] [-c <name>=<value>] <command> [<args>]'], 'Git is a fast, scalable, distributed revision control system with an unusually rich command set that provides both high-level operations and full access to internals.  The commands this practice supports are init, status, add, commit, log, branch, diff and config.', [], [['EXAMPLES', 'git init\ngit add .\ngit commit -m "first commit"\ngit log --oneline']]);
  man('python3', '1', 'an interpreted, interactive, object-oriented programming language', ['python3 [-c command | -m module-name | script | -] [args]'], 'Python is an interpreted, interactive, object-oriented programming language that combines remarkable power with very clear syntax.  The practice python3 can only print and calculate (and it needs the command line developer tools first).', [], [['EXAMPLES', 'python3                  start the interactive prompt (>>>); exit() leaves\npython3 hello.py        run a file that only uses print and calculations']]);
  man('sudo', '8', 'execute a command as another user', ['sudo [-AbEHnPS] [-C num] [-D directory] [-g group] [-h host] [-p prompt] [-u user] [VAR=value] [-i | -s] [command [arg ...]]'], 'sudo allows a permitted user to execute a command as the superuser or another user.  The practice Mac does not allow sudo.');
  man('clear', '1', 'clear the terminal screen', ['clear'], 'clear clears your screen if this is possible, including its scrollback buffer.  (Control-L clears the screen but keeps the scrollback.)');
  man('yes', '1', 'be repetitively affirmative', ['yes [expletive]'], 'The yes utility outputs expletive, or, by default, “y”, forever.  Press Control-C to stop.');
  man('seq', '1', 'print sequences of numbers', ['seq [-w] [-f format] [-s string] [-t string] [first [incr]] last'], 'The seq command prints a sequence of numbers, one per line.', [['-s', 'Use string to separate numbers.'], ['-w', 'Equalize the widths of all numbers by padding with zeros as necessary.']]);
  man('expr', '1', 'evaluate expression', ['expr expression'], 'The expr utility evaluates expression and writes the result on standard output.  Arguments must be separate words: expr 2 + 3.  Write \\* for multiplication.');
  man('bc', '1', 'arbitrary-precision arithmetic language and calculator', ['bc [-ilqsw] [file ...]'], 'bc is a language that supports arbitrary precision numbers with interactive execution of statements.  Type quit to leave.  scale=2 sets the number of decimal places.');
  man('networksetup', '8', 'configuration tool for network settings in System Settings', ['networksetup -getairportnetwork device', 'networksetup -listallhardwareports'], 'networksetup is a configuration tool for network settings.  The practice Mac only answers questions.');
  man('ipconfig', '8', 'view and control IP configuration state', ['ipconfig getifaddr interface'], 'The ipconfig command is used to view and control the IP configuration of the system.');
  man('xcode-select', '1', 'Manages the active developer directory for Xcode and BSD tools', ['xcode-select --install', 'xcode-select --print-path'], 'xcode-select controls the location of the developer directory used by xcrun, xcodebuild, cc, and other Xcode and BSD development tools.  The first time you run git or python3 on a new Mac, a dialog offers to install the command line developer tools.');
  man('mdfind', '1', 'finds files matching a given query', ['mdfind [-live] [-count] [-onlyin directory] [-name file] query'], 'The mdfind command consults the central metadata store and returns a list of files that match the given metadata query.');
  man('source', '1', 'read and run commands from a file (zsh builtin)', ['source file'], 'Read commands from file and execute them in the current shell.');
  man('test', '1', 'condition evaluation utility', ['test expression', '[ expression ]'], 'The test utility evaluates the expression and, if it evaluates to true, returns a zero (true) exit status; otherwise it returns 1 (false).', [['-f file', 'True if file exists and is a regular file.'], ['-d file', 'True if file exists and is a directory.'], ['-e file', 'True if file exists (regardless of type).']]);
  man('sh', '1', 'command interpreter (shell)', ['sh [-c command] [file]'], 'sh is the standard command interpreter for the system.');
  man('bash', '1', 'GNU Bourne-Again SHell', ['bash [options] [command_string | file]'], 'Bash is an sh-compatible command language interpreter that executes commands read from the standard input or from a file.');
  man('code', '1', 'open files and folders in Visual Studio Code', ['code [path ...]'], 'In the practice Mac, code opens the Code app on the folder or file you name.  (On a real Mac the code command exists after you choose “Install code command in PATH” in Code.)');
  man('codex', '1', 'the Codex app', ['codex'], 'In the practice Mac, Codex is the app in the Dock: drag a folder onto it to start working there.');
  man('ssh', '1', 'OpenSSH remote login client', ['ssh [-46AaCfGgKkMNnqsTtVvXxYy] [-B bind_interface] [-b bind_address] [-c cipher_spec] [-D [bind_address:]port] [-E log_file] [-e escape_char] [-F configfile] [-I pkcs11] [-i identity_file] [-J destination] [-L address] [-l login_name] [-m mac_spec] [-O ctl_cmd] [-o option] [-p port] [-Q query_option] [-R address] [-S ctl_path] [-W host:port] [-w local_tun[:remote_tun]] destination [command [argument ...]]'], 'ssh (SSH client) is a program for logging into a remote machine and for executing commands on a remote machine.  The practice Mac has no network.');
  man('sed', '1', 'stream editor', ['sed [-Ealnru] command [-I extension] [-i extension] [file ...]'], 'The sed utility reads the specified files, or the standard input if no files are specified, modifying the input as specified by a list of commands.');
  man('awk', '1', 'pattern-directed scanning and processing language', ['awk [-F fs | --csv] [-v var=value] [prog | -f progfile] [file ...]'], 'awk scans each input file for lines that match any of a set of patterns specified in prog.');
  man('chown', '8', 'change file owner and group', ['chown [-fhv] [-R [-H | -L | -P]] [owner][:group] file ...'], 'The chown utility changes the user ID and/or the group ID of the specified files.');
  man('mktemp', '1', 'make temporary file name (unique)', ['mktemp [-d] [-q] [-t prefix] [-u] template ...'], 'The mktemp utility creates a temporary file or directory, safely, and prints its name.');
  man('ssh-keygen', '1', 'OpenSSH authentication key utility', ['ssh-keygen [-t type] [-f output_keyfile]'], 'ssh-keygen generates, manages and converts authentication keys for ssh.');
  var MAN_ALIAS = { '[': 'test', fgrep: 'grep', egrep: 'grep', link: 'ln', unlink: 'rm', view: 'less', pico: 'nano', ncal: 'cal', killall5: 'killall', zshbuiltins: 'zsh', whence: 'which', type: 'which', fc: 'history', unalias: 'alias', printenv: 'env', gzip: 'tar', python: 'python3', whereis: 'which', command: 'zsh', builtin: 'zsh', read: 'zsh', set: 'zsh' };
  function manLines(name, cols) {
    var key = hasOwn.call(MAN_PAGES, name) ? name : MAN_ALIAS[name];
    var pg = key ? MAN_PAGES[key] : null;
    if (!pg) return null;
    var w = Math.min(78, Math.max(40, cols));
    var title = name.toUpperCase() + '(' + pg.sec + ')';
    var center = pg.sec === '8' ? 'System Manager’s Manual' : 'General Commands Manual';
    var gap1 = Math.max(1, Math.floor((w - title.length * 2 - center.length) / 2)), gap2 = Math.max(1, w - title.length * 2 - center.length - gap1);
    var out = [title + new Array(gap1 + 1).join(' ') + center + new Array(gap2 + 1).join(' ') + title, ''];
    function wrap(text, indent, hang) {
      var res = [], words = text.split(/\s+/).filter(Boolean), cur = '', limit = w - indent;
      words.forEach(function (wd) {
        if ((cur ? cur.length + 1 : 0) + wd.length > limit && cur) { res.push(cur); cur = wd; } else cur = cur ? cur + ' ' + wd : wd;
      });
      if (cur) res.push(cur);
      var padS = new Array(indent + 1).join(' ');
      return res.map(function (l) { return padS + l; });
    }
    function head(t) { out.push(sgr('1', t)); }
    head('NAME');
    out.push('     ' + sgr('1', name) + ' – ' + pg.desc, '');
    head('SYNOPSIS');
    pg.syn.forEach(function (l) { wrap(l, 5).forEach(function (x, n) { out.push(n === 0 ? '     ' + sgr('1', x.trim().split(' ')[0]) + x.trim().slice(x.trim().split(' ')[0].length) : x.replace(/^ {5}/, '           ')); }); });
    out.push('');
    head('DESCRIPTION');
    pg.text.split('\n').forEach(function (para, n) { if (n) out.push(''); wrap(para, 5).forEach(function (x) { out.push(x); }); });
    if (pg.opts.length) {
      out.push('', '     The following options are available:', '');
      pg.opts.forEach(function (op) {
        var tag = op[0], tl = tag.length;
        var lines = wrap(op[1], 13);
        var first = lines.length ? lines[0].slice(13) : '';
        if (tl <= 7) out.push('     ' + sgr('1', tag) + new Array(8 - tl + 1).join(' ') + first);
        else { out.push('     ' + sgr('1', tag)); if (lines.length) out.push(lines[0]); }
        for (var i = 1; i < lines.length; i++) out.push(lines[i]);
        out.push('');
      });
      out.pop();
    }
    pg.extra.forEach(function (ex) {
      out.push('');
      head(ex[0]);
      ex[1].split('\n').forEach(function (l) { out.push('     ' + l); });
    });
    out.push('', '     ' + DEF_SEE.replace('practice Mac', '練習版'), '');
    var d = new Date(ms());
    var foot = 'macOS 26.0', mid = EN_MON[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
    var g1 = Math.max(1, Math.floor((w - foot.length * 2 - mid.length) / 2)), g2 = Math.max(1, w - foot.length * 2 - mid.length - g1);
    out.push(foot + new Array(g1 + 1).join(' ') + mid + new Array(g2 + 1).join(' ') + foot);
    return out;
  }
  def('man', function* (args, ctx) {
    var names = args.filter(function (a) { return a.charAt(0) !== '-' && !/^\d+$/.test(a); });
    if (!names.length) { ctx.err('What manual page do you want?\nFor example, try \'man man\'.\n'); return 1; }
    var status = 0, pages = [];
    names.forEach(function (n) {
      var cols = ctx.session.cols || 80, ls = manLines(n, cols);
      if (!ls) { ctx.err('No manual entry for ' + n + '\n'); status = 1; return; }
      var pg = MAN_PAGES[hasOwn.call(MAN_PAGES, n) ? n : MAN_ALIAS[n]];
      pages.push({ name: n, lines: ls, label: n + '(' + pg.sec + ')' });
    });
    for (var i = 0; i < pages.length; i++) {
      var pgi = pages[i];
      if (!ctx.tty) { ctx.out(pgi.lines.map(strip).join('\n') + '\n'); continue; }
      yield { app: pagerApp({ mode: 'man', lines: pgi.lines, label: pgi.label }) };
    }
    return status;
  });
  def('apropos', function (args, ctx) {
    var q = (args[0] || '').toLowerCase();
    if (!q) { ctx.err('usage: apropos [-ls] [-C file] [-M path] [-m path] [-S arch] [-s section] keyword ...\n'); return 1; }
    var found = Object.keys(MAN_PAGES).filter(function (k) { return k.indexOf(q) >= 0 || MAN_PAGES[k].desc.toLowerCase().indexOf(q) >= 0; }).sort();
    if (!found.length) { ctx.out(args[0] + ': nothing appropriate\n'); return 1; }
    found.forEach(function (k) { ctx.out(pad(k + '(' + MAN_PAGES[k].sec + ')', 24) + '- ' + MAN_PAGES[k].desc + '\n'); });
    return 0;
  });

  /* ------------------------------------------------------------------ nano */
  var NANO_KEYS1 = [['^G', 'Get Help'], ['^O', 'WriteOut'], ['^R', 'Read File'], ['^Y', 'Prev Page'], ['^K', 'Cut Text'], ['^C', 'Cur Pos']];
  var NANO_KEYS2 = [['^X', 'Exit'], ['^J', 'Justify'], ['^W', 'Where Is'], ['^V', 'Next Page'], ['^U', 'UnCut Text'], ['^T', 'To Spell']];
  function nanoApp(ctx, typed, abs, srcLines, isNew) {
    var s = ctx.session, vfs = s.vfs;
    var lines = srcLines.length ? srcLines.slice() : [''];
    var row = 0, col = 0, top = 0, left = 0, modified = false, cutBuf = [], lastWasCut = false, prompt = null, searchText = '';
    var msg = isNew ? '[ New File ]' : '[ Read ' + srcLines.length + ' line' + (srcLines.length === 1 ? '' : 's') + ' ]';
    var name = typed, curAbs = abs, lastCols = 80;
    function lineLen(r) { return Array.from(lines[r]).length; }
    function dispCol(r, c) { var w = 0, cps = Array.from(lines[r]); for (var i = 0; i < c && i < cps.length; i++) w += charWidth(cps[i].codePointAt(0)) || 0; return w; }
    function clampCol() { var n = lineLen(row); if (col > n) col = n; if (col < 0) col = 0; }
    function insert(str) {
      var cps = Array.from(lines[row]), add = Array.from(str);
      cps.splice.apply(cps, [col, 0].concat(add));
      lines[row] = cps.join('');
      col += add.length; modified = true; lastWasCut = false;
    }
    function newline() {
      var cps = Array.from(lines[row]);
      lines.splice(row + 1, 0, cps.slice(col).join(''));
      lines[row] = cps.slice(0, col).join('');
      row++; col = 0; modified = true; lastWasCut = false;
    }
    function backspace() {
      if (col > 0) { var cps = Array.from(lines[row]); cps.splice(col - 1, 1); lines[row] = cps.join(''); col--; modified = true; }
      else if (row > 0) { var prevLen = lineLen(row - 1); lines[row - 1] += lines[row]; lines.splice(row, 1); row--; col = prevLen; modified = true; }
      lastWasCut = false;
    }
    function del() {
      var cps = Array.from(lines[row]);
      if (col < cps.length) { cps.splice(col, 1); lines[row] = cps.join(''); modified = true; }
      else if (row < lines.length - 1) { lines[row] += lines[row + 1]; lines.splice(row + 1, 1); modified = true; }
      lastWasCut = false;
    }
    function save(fileName, api, thenExit) {
      var target = resolvePath(s, fileName);
      try {
        if (vfs.isDir(target)) throw new vfs.VfsError('EISDIR', fileName);
        vfs.writeFile(target, lines.join('\n') + '\n', { by: 'terminal' });
        name = fileName; curAbs = target; modified = false;
        msg = '[ Wrote ' + lines.length + ' line' + (lines.length === 1 ? '' : 's') + ' ]';
        if (thenExit) api.exit(0);
      } catch (e) {
        msg = '[ Error writing ' + fileName + ': ' + (e.code === 'EISDIR' ? 'Is a directory' : vfs.errText(e.code || 'EINVAL')) + ' ]';
      }
    }
    function find() {
      if (!searchText) return;
      var n = lines.length;
      for (var k = 0; k <= n; k++) {
        var r = (row + k) % n, plain = lines[r];
        var from = k === 0 ? Array.from(plain).slice(0, col + 1).join('').length : 0;
        var idx = k === n ? plain.indexOf(searchText) : plain.indexOf(searchText, from);
        if (idx >= 0) {
          if (row + k >= n) msg = '[ Search Wrapped ]';
          row = r; col = Array.from(plain.slice(0, idx)).length;
          return;
        }
      }
      msg = '[ "' + searchText + '" not found ]';
    }
    function barCell(pairs, i, cellW) {
      var p = pairs[i], text = p[1];
      return sgr('7', p[0]) + ' ' + pad(text, Math.max(0, cellW - 3));
    }
    function shortcutRows(cols) {
      var cellW = Math.floor(cols / 6);
      var a = '', b = '';
      var k1 = prompt ? (prompt.kind === 'exitq' ? [[' Y', 'Yes']] : [['^G', 'Get Help'], ['M-D', 'DOS Format'], ['M-A', 'Append'], ['M-B', 'Backup File']]) : NANO_KEYS1;
      var k2 = prompt ? (prompt.kind === 'exitq' ? [[' N', 'No'], ['^C', 'Cancel']] : [['^C', 'Cancel'], ['M-M', 'Mac Format'], ['M-P', 'Prepend'], ['^T', 'To Files']]) : NANO_KEYS2;
      if (prompt && prompt.kind === 'exitq') {
        a = sgr('7', ' Y') + ' Yes';
        b = sgr('7', ' N') + ' No           ' + sgr('7', '^C') + ' Cancel';
        return [a, b];
      }
      var cw = prompt ? Math.floor(cols / 4) : cellW;
      k1.forEach(function (p, i) { a += barCell(k1, i, cw); });
      k2.forEach(function (p, i) { b += barCell(k2, i, cw); });
      return [a, b];
    }
    function fixView(api) {
      var textH = Math.max(1, api.rows() - 4), cols = api.cols();
      if (row < top) top = row;
      if (row >= top + textH) top = row - textH + 1;
      var dc = dispCol(row, col);
      if (dc < left) left = Math.max(0, dc - Math.floor(cols / 2));
      if (dc >= left + cols - 1) left = dc - Math.floor(cols / 2);
      if (left < 0) left = 0;
    }
    var def = {
      name: 'nano',
      start: function (api) { lastCols = api.cols(); },
      resize: function (api) { lastCols = api.cols(); },
      render: function (api) {
        var R = api.rows(), C = api.cols(), textH = Math.max(1, R - 4);
        fixView(api);
        var out = [];
        var title = '  GNU nano 2.0.6', fname = isNew && !curAbs ? 'New Buffer' : (name ? 'File: ' + name : 'New Buffer');
        var mod = modified ? 'Modified' : '';
        var mid = Math.max(displayWidth(title) + 1, Math.floor((C - displayWidth(fname)) / 2));
        var bar = title + new Array(Math.max(1, mid - displayWidth(title) + 1)).join(' ') + fname;
        bar += new Array(Math.max(1, C - displayWidth(bar) - displayWidth(mod) - 2 + 1)).join(' ') + mod + '  ';
        out.push(sgr('7', pad(sliceCols(bar, 0, C), C)));
        for (var i = 0; i < textH; i++) {
          var ln = lines[top + i];
          if (ln === undefined) { out.push(''); continue; }
          var shown = sliceCols(ln, left, left + C);
          if (displayWidth(ln) > left + C) shown = sliceCols(ln, left, left + C - 1) + '$';
          if (left > 0 && shown) shown = '$' + sliceCols(shown, 1, C);
          out.push(shown);
        }
        var cursor;
        if (prompt) {
          var label = prompt.kind === 'write' ? 'File Name to Write: ' : prompt.kind === 'search' ? 'Search: ' : 'Save modified buffer (ANSWERING "No" WILL DESTROY CHANGES) ? ';
          out.push(label + (prompt.kind === 'exitq' ? '' : prompt.text));
          cursor = { r: textH + 1, c: displayWidth(label) + (prompt.kind === 'exitq' ? 0 : displayWidth(prompt.text)) };
        } else {
          if (msg) { var m = ' ' + msg + ' '; out.push(new Array(Math.max(0, Math.floor((C - displayWidth(m)) / 2)) + 1).join(' ') + sgr('7', msg)); }
          else out.push('');
          cursor = { r: 1 + row - top, c: dispCol(row, col) - left };
        }
        shortcutRows(C).forEach(function (r) { out.push(r); });
        return { rows: out, cursor: cursor };
      },
      text: function (str, api) { if (prompt) { if (prompt.kind !== 'exitq') prompt.text += str.replace(/[\r\n]+/g, ' '); return; } msg = ''; insert(str.replace(/\r\n?/g, '\n').split('\n').join(' ')); },
      key: function (k, api) {
        var key = k.key;
        if (prompt) {
          if (key === 'Escape' || (k.ctrl && k.k === 'c')) { prompt = null; msg = '[ Cancelled ]'; return; }
          if (prompt.kind === 'exitq') {
            if (key === 'y' || key === 'Y') { prompt = { kind: 'write', text: name || '', exit: true }; return; }
            if (key === 'n' || key === 'N') { api.exit(0); return; }
            return;
          }
          if (key === 'Enter') {
            var p = prompt; prompt = null;
            if (p.kind === 'write') { if (p.text.trim() === '') { msg = '[ Cancelled ]'; return; } save(p.text.trim(), api, p.exit); }
            else if (p.kind === 'search') { if (p.text !== '') searchText = p.text; find(); }
            return;
          }
          if (key === 'Backspace') { prompt.text = Array.from(prompt.text).slice(0, -1).join(''); return; }
          if (key.length === 1 && !k.ctrl && !k.alt) prompt.text += key;
          return;
        }
        msg = '';
        if (k.ctrl) {
          switch (k.k) {
            case 'x':
              if (!modified) { api.exit(0); return; }
              prompt = { kind: 'exitq', text: '' }; return;
            case 'o': prompt = { kind: 'write', text: name || '' }; return;
            case 'k': { var cutLine = lines[row]; if (!lastWasCut) cutBuf = []; cutBuf.push(cutLine); if (lines.length > 1) { lines.splice(row, 1); if (row >= lines.length) row = lines.length - 1; } else lines[0] = ''; col = 0; modified = true; lastWasCut = true; return; }
            case 'u': if (cutBuf.length) { lines.splice.apply(lines, [row, 0].concat(cutBuf)); row += cutBuf.length; col = 0; modified = true; } lastWasCut = false; return;
            case 'w': prompt = { kind: 'search', text: '' }; return;
            case 'c': {
              var chars = 0, total = 0; lines.forEach(function (l, i) { total += Array.from(l).length + 1; if (i < row) chars += Array.from(l).length + 1; });
              chars += col + 1;
              msg = '[ line ' + (row + 1) + '/' + lines.length + ' (' + Math.round((row + 1) / lines.length * 100) + '%), col ' + (col + 1) + '/' + (lineLen(row) + 1) + ' (' + Math.round((col + 1) / (lineLen(row) + 1) * 100) + '%), char ' + chars + '/' + total + ' (' + Math.round(chars / total * 100) + '%) ]'; return;
            }
            case 'a': col = 0; return;
            case 'e': col = lineLen(row); return;
            case 'b': if (col > 0) col--; else if (row > 0) { row--; col = lineLen(row); } return;
            case 'f': if (col < lineLen(row)) col++; else if (row < lines.length - 1) { row++; col = 0; } return;
            case 'p': if (row > 0) { row--; clampCol(); } return;
            case 'n': if (row < lines.length - 1) { row++; clampCol(); } return;
            case 'd': del(); return;
            case 'h': backspace(); return;
            case 'y': row = Math.max(0, row - (api.rows() - 4)); clampCol(); return;
            case 'v': row = Math.min(lines.length - 1, row + (api.rows() - 4)); clampCol(); return;
            case 'g': msg = '[ 練習版沒有說明畫面；畫面下方的 ^ 是 Control 鍵 ]'; return;
            case 'j': msg = '[ 練習版沒有「對齊」功能 ]'; return;
            case 'r': msg = '[ 練習版沒有「讀入檔案」功能 ]'; return;
            case 't': msg = '[ 練習版沒有拼字檢查 ]'; return;
            case 'l': return;
            default: return;
          }
        }
        if (k.alt) return;
        switch (key) {
          case 'ArrowLeft': if (col > 0) col--; else if (row > 0) { row--; col = lineLen(row); } return;
          case 'ArrowRight': if (col < lineLen(row)) col++; else if (row < lines.length - 1) { row++; col = 0; } return;
          case 'ArrowUp': if (row > 0) { row--; clampCol(); } return;
          case 'ArrowDown': if (row < lines.length - 1) { row++; clampCol(); } return;
          case 'Home': col = 0; return;
          case 'End': col = lineLen(row); return;
          case 'PageUp': row = Math.max(0, row - (api.rows() - 4)); clampCol(); return;
          case 'PageDown': row = Math.min(lines.length - 1, row + (api.rows() - 4)); clampCol(); return;
          case 'Enter': newline(); return;
          case 'Backspace': backspace(); return;
          case 'Delete': del(); return;
          case 'Tab': insert('    '); return;
          case 'Escape': return;
          default: if (key.length === 1) insert(key);
        }
      }
    };
    return def;
  }
  def('nano', function* (args, ctx) {
    var s = ctx.session, vfs = s.vfs, files = args.filter(function (a) { return a.charAt(0) !== '-' && a.charAt(0) !== '+'; });
    if (args.indexOf('--version') >= 0 || args.indexOf('-V') >= 0) { ctx.out(' GNU nano version 2.0.6 (compiled 13:01:28, Apr  5 2024)\n Email: nano@nano-editor.org\tWeb: http://www.nano-editor.org/\n Compiled options: --disable-nls --enable-color --enable-extra --enable-multibuffer --enable-nanorc --enable-utf8\n'); return 0; }
    if (!ctx.tty) { ctx.err('Received SIGHUP or SIGTERM\n'); return 1; }
    var typed = files[0] || '', abs = typed ? resolvePath(s, typed) : null, src = [], isNew = true;
    if (abs) {
      var st = vfs.stat(abs);
      if (st && st.type === 'dir') { ctx.err('Error reading ' + typed + ': Is a directory\n'); return 1; }
      if (st) {
        isNew = false;
        var text = st.kind === 'text' ? vfs.readFile(abs, { by: 'terminal' }) : '';
        src = text === '' ? [] : text.replace(/\n$/, '').split('\n');
      }
    }
    var st2 = yield { app: nanoApp(ctx, typed, isNew ? null : abs, src, isNew) };
    return st2 || 0;
  });

  /* ============================================================ git, python3 (they need the command line developer tools first) */
  /* A new Mac has /usr/bin/git and /usr/bin/python3 as stubs: the first run asks to install the tools (SPEC §1). */
  function needDevTools(ctx, name) {
    ctx.err('xcode-select: note: No developer tools were found, requesting install.\n');
    ctx.effect({ type: 'clt', name: name });
    return 1;
  }

  /* ------------------------------------------------------------------ git */
  /* Each repository's state (index, commits, branches) is kept here, keyed by its folder; the files themselves are the real ones in the
     practice file tree, and `.git` is a real (hidden) folder so `ls -a` shows it. */
  function hash40(str) {
    var out = '', a = 5381, b = 52711;
    for (var r = 0; r < 5; r++) {
      for (var i = 0; i < str.length; i++) { a = (a * 33 + str.charCodeAt(i) + r) % 4294967291; b = (b * 31 + str.charCodeAt(i) * (r + 1)) % 4294967279; }
      out += ('00000000' + (a >>> 0).toString(16)).slice(-4) + ('00000000' + (b >>> 0).toString(16)).slice(-4);
    }
    return out.slice(0, 40);
  }
  function gitRoot(s) {
    var vfs = s.vfs, p = s.cwd;
    for (;;) {
      if (vfs.isDir(vfs.join(p, '.git'))) return p;
      if (p === '/') return null;
      p = vfs.dirname(p);
    }
  }
  function repoOf(root) {
    var r = sys.gitRepos.get(root);
    if (!r) { r = { branch: 'main', branches: Object.create(null), commits: Object.create(null), index: {}, headTree: {} }; r.branches.main = null; sys.gitRepos.set(root, r); }
    return r;
  }
  function ignoreMatcher(vfs, root) {
    var t = vfs.exists(vfs.join(root, '.gitignore')) ? textOf(vfs, vfs.join(root, '.gitignore')) : null;
    var pats = splitLines(t || '').map(function (l) { return l.trim(); }).filter(function (l) { return l && l.charAt(0) !== '#'; });
    return function (rel, isDir) {
      return pats.some(function (p) {
        var dirOnly = p.slice(-1) === '/', g = p.replace(/\/$/, '').replace(/^\//, '');
        if (dirOnly && !isDir && rel.indexOf(g + '/') !== 0 && rel.indexOf('/' + g + '/') < 0) return false;
        var re = globToRegex(g);
        return rel.split('/').some(function (part) { return re.test(part); }) || re.test(rel);
      });
    };
  }
  /* the working tree: relative path -> content (binary files by size) */
  function workTree(vfs, root) {
    var out = {}, ign = ignoreMatcher(vfs, root);
    (function rec(dir, rel) {
      vfs.list(dir).forEach(function (st) {
        if (st.name === '.git' || st.name === '.DS_Store') return;
        var r = rel ? rel + '/' + st.name : st.name;
        if (ign(r, st.type === 'dir')) return;
        if (st.type === 'dir') rec(st.path, r);
        else out[r] = st.kind === 'text' ? vfs.readFile(st.path, { by: 'system' }) : '\u0000binary:' + st.size;
      });
    })(root, '');
    return out;
  }
  function nlines(text) { return text.indexOf('\u0000binary:') === 0 ? 0 : splitLines(text).length; }
  function gitChanges(repo, wt) {
    var staged = [], unstaged = [], untracked = [], idx = repo.index, head = repo.headTree, k;
    for (k in idx) { if (!hasOwn.call(head, k)) staged.push(['new file', k]); else if (head[k] !== idx[k]) staged.push(['modified', k]); }
    for (k in head) if (!hasOwn.call(idx, k)) staged.push(['deleted', k]);
    for (k in idx) { if (!hasOwn.call(wt, k)) unstaged.push(['deleted', k]); else if (wt[k] !== idx[k]) unstaged.push(['modified', k]); }
    for (k in wt) if (!hasOwn.call(idx, k)) untracked.push(k);
    function byName(a, b) { return cmpStr(a[1], b[1]); }
    staged.sort(byName); unstaged.sort(byName); untracked.sort();
    // an untracked folder is shown as one line
    var shown = [], seen = {};
    untracked.forEach(function (p) {
      var top = p.indexOf('/') >= 0 ? p.slice(0, p.indexOf('/') + 1) : p;
      var tracked = Object.keys(idx).some(function (t) { return t.indexOf(top) === 0 && top.slice(-1) === '/'; });
      var name = tracked ? p : top;
      if (!seen[name]) { seen[name] = 1; shown.push(name); }
    });
    return { staged: staged, unstaged: unstaged, untracked: shown };
  }
  function shortHash(id) { return id.slice(0, 7); }
  function gitDate(ms0) { return strftime('%a %b %e %H:%M:%S %Y +0800', new Date(ms0), false).replace(/ +/g, ' '); }
  function who() { var n = sys.gitConfig['user.name'], e = sys.gitConfig['user.email']; return n && e ? n + ' <' + e + '>' : null; }
  function hunksOf(a, b) {
    var ops = lcsDiff(a, b), ctxN = 3, hunks = [], cur = null, out = '';
    ops.forEach(function (op, idx) { if (op.t === '=') return; if (cur && idx - cur.end <= ctxN * 2) cur.end = idx; else { cur = { start: idx, end: idx }; hunks.push(cur); } });
    hunks.forEach(function (hk) {
      var from = Math.max(0, hk.start - ctxN), to = Math.min(ops.length - 1, hk.end + ctxN), aS = null, bS = null, aC = 0, bC = 0, body = '';
      for (var q = from; q <= to; q++) {
        var op = ops[q];
        if (op.t !== '+') { if (aS === null) aS = op.a + 1; aC++; }
        if (op.t !== '-') { if (bS === null) bS = op.b + 1; bC++; }
        body += (op.t === '=' ? ' ' + a[op.a] : op.t === '-' ? '-' + a[op.a] : '+' + b[op.b]) + '\n';
      }
      out += '@@ -' + (aS === null ? 0 : aS) + (aC === 1 ? '' : ',' + aC) + ' +' + (bS === null ? 0 : bS) + (bC === 1 ? '' : ',' + bC) + ' @@\n' + body;
    });
    return { text: out, adds: ops.filter(function (o) { return o.t === '+'; }).length, dels: ops.filter(function (o) { return o.t === '-'; }).length };
  }

  var GIT_USAGE = 'usage: git [-v | --version] [-h | --help] [-C <path>] [-c <name>=<value>]\n           <command> [<args>]\n\nThe commands this practice supports: init, status, add, commit, log, branch, checkout, switch, diff, config\n';
  def('git', function (args, ctx) {
    if (!sys.devTools) return needDevTools(ctx, 'git');
    var s = ctx.session, vfs = s.vfs, color = ctx.tty;
    function C(code, t) { return color ? sgr(code, t) : t; }
    var sub = args[0], rest = args.slice(1);
    if (sub === undefined || sub === '-h' || sub === '--help' || sub === 'help') { ctx.out(GIT_USAGE); return sub === undefined ? 1 : 0; }
    if (sub === '--version' || sub === '-v' || sub === 'version') { ctx.out('git version 2.50.1 (Apple Git-155)\n'); return 0; }
    if (sub === 'config') {
      var list = rest.filter(function (a) { return a !== '--global' && a !== '--local' && a !== '--system'; });
      if (list[0] === '--list' || list[0] === '-l') { Object.keys(sys.gitConfig).sort().forEach(function (k) { ctx.out(k + '=' + sys.gitConfig[k] + '\n'); }); return 0; }
      if (list[0] === '--get' || list[0] === '--unset') list.shift();
      if (!list.length) { ctx.err('usage: git config [<options>]\n'); return 129; }
      if (list.length === 1) { if (hasOwn.call(sys.gitConfig, list[0])) { ctx.out(sys.gitConfig[list[0]] + '\n'); return 0; } return 1; }
      sys.gitConfig[list[0]] = list.slice(1).join(' ');
      return 0;
    }
    if (sub === 'init') {
      var dirArg = rest.filter(function (a) { return a.charAt(0) !== '-'; })[0];
      var base = dirArg ? resolvePath(s, dirArg) : s.cwd;
      try { if (!vfs.exists(base)) vfs.mkdir(base, { by: 'terminal', parents: true }); } catch (e0) { ctx.err('fatal: cannot mkdir ' + dirArg + ': ' + vfs.errText(e0.code || 'EINVAL') + '\n'); return 128; }
      var g = vfs.join(base, '.git'), again = vfs.isDir(g);
      if (!again) {
        try {
          vfs.mkdir(g, { by: 'terminal' });
          vfs.writeFile(vfs.join(g, 'HEAD'), 'ref: refs/heads/main\n', { by: 'terminal' });
          vfs.writeFile(vfs.join(g, 'config'), '[core]\n\trepositoryformatversion = 0\n\tfilemode = true\n\tbare = false\n\tlogallrefupdates = true\n\tignorecase = true\n\tprecomposeunicode = true\n', { by: 'terminal' });
          vfs.writeFile(vfs.join(g, 'description'), 'Unnamed repository; edit this file \'description\' to name the repository.\n', { by: 'terminal' });
          ['hooks', 'info', 'objects', 'refs'].forEach(function (d) { vfs.mkdir(vfs.join(g, d), { by: 'terminal' }); });
        } catch (e1) { ctx.err('fatal: ' + vfs.errText(e1.code || 'EINVAL') + '\n'); return 128; }
        sys.gitRepos.set(base, null); sys.gitRepos.delete(base);
        repoOf(base);
      }
      ctx.out((again ? 'Reinitialized existing' : 'Initialized empty') + ' Git repository in ' + vfs.canon(g) + '/\n');
      return 0;
    }
    if (sub === 'clone') {
      var url = rest.filter(function (a) { return a.charAt(0) !== '-'; })[0];
      if (!url) { ctx.err('fatal: You must specify a repository to clone.\n'); return 129; }
      var nm = (rest.filter(function (a) { return a.charAt(0) !== '-'; })[1]) || url.replace(/\/+$/, '').split('/').pop().replace(/\.git$/, '') || 'repo';
      var dest = resolvePath(s, nm);
      if (vfs.exists(dest)) { ctx.err("fatal: destination path '" + nm + "' already exists and is not an empty directory.\n"); return 128; }
      try {
        vfs.mkdir(dest, { by: 'terminal' });
        vfs.mkdir(vfs.join(dest, '.git'), { by: 'terminal' });
        vfs.writeFile(vfs.join(dest, '.git', 'HEAD'), 'ref: refs/heads/main\n', { by: 'terminal' });
        vfs.writeFile(vfs.join(dest, 'README.md'), '# ' + nm + '\n\n這是練習版假的下載內容。\n', { by: 'terminal' });
      } catch (e2) { ctx.err('fatal: ' + vfs.errText(e2.code || 'EINVAL') + '\n'); return 128; }
      var rp = repoOf(dest), tree = { 'README.md': vfs.readFile(vfs.join(dest, 'README.md'), { by: 'system' }) };
      var cid = hash40('clone' + nm);
      rp.commits[cid] = { id: cid, msg: 'Initial commit', time: LAB.clock.ms(), parent: null, tree: tree, author: 'Practice <practice@example.com>' };
      rp.branches.main = cid; rp.headTree = tree; rp.index = JSON.parse(JSON.stringify(tree));
      ctx.out("Cloning into '" + nm + "'...\n（練習版沒有網路，這是假的下載，資料夾裡只有一個 README.md）\n");
      return 0;
    }
    var root = gitRoot(s);
    if (!root) { ctx.err('fatal: not a git repository (or any of the parent directories): .git\n'); return 128; }
    var repo = repoOf(root), wt = workTree(vfs, root);
    function relOf(p) { var abs = resolvePath(s, p); return abs === root ? '' : abs.slice(root.length + 1); }

    if (sub === 'status') {
      var ch = gitChanges(repo, wt), headId = repo.branches[repo.branch];
      if (rest.indexOf('-s') >= 0 || rest.indexOf('--short') >= 0) {
        var shortOut = '';
        var map = {};
        ch.staged.forEach(function (c) { map[c[1]] = (c[0] === 'new file' ? 'A' : c[0] === 'deleted' ? 'D' : 'M') + ' '; });
        ch.unstaged.forEach(function (c) { var cur = map[c[1]] || '  '; map[c[1]] = cur.charAt(0) + (c[0] === 'deleted' ? 'D' : 'M'); });
        Object.keys(map).sort().forEach(function (k) { shortOut += map[k] + ' ' + k + '\n'; });
        ch.untracked.forEach(function (u) { shortOut += '?? ' + u + '\n'; });
        ctx.out(shortOut);
        return 0;
      }
      var out = 'On branch ' + repo.branch + '\n';
      if (!headId) out += '\nNo commits yet\n\n';
      // every section ends with an empty line, as git prints it
      if (ch.staged.length) {
        out += 'Changes to be committed:\n  (use "git ' + (headId ? 'restore --staged' : 'rm --cached') + ' <file>..." to unstage)\n';
        ch.staged.forEach(function (c) { out += '\t' + C('32', pad(c[0] + ':', 12) + c[1]) + '\n'; });
        out += '\n';
      }
      if (ch.unstaged.length) {
        out += 'Changes not staged for commit:\n  (use "git add <file>..." to update what will be committed)\n  (use "git restore <file>..." to discard changes in working directory)\n';
        ch.unstaged.forEach(function (c) { out += '\t' + C('31', pad(c[0] + ':', 12) + c[1]) + '\n'; });
        out += '\n';
      }
      if (ch.untracked.length) {
        out += 'Untracked files:\n  (use "git add <file>..." to include in what will be committed)\n';
        ch.untracked.forEach(function (u) { out += '\t' + C('31', u) + '\n'; });
        out += '\n';
      }
      if (!ch.staged.length && !ch.unstaged.length && !ch.untracked.length) out += headId ? 'nothing to commit, working tree clean\n' : 'nothing to commit (create/copy files and use "git add" to track)\n';
      else if (!ch.staged.length) out += (ch.unstaged.length ? 'no changes added to commit (use "git add" and/or "git commit -a")' : 'nothing added to commit but untracked files present (use "git add" to track)') + '\n';
      ctx.out(out);
      return 0;
    }
    if (sub === 'add') {
      var paths = rest.filter(function (a) { return a.charAt(0) !== '-'; }), all = rest.indexOf('-A') >= 0 || rest.indexOf('--all') >= 0;
      if (!paths.length && !all) { ctx.err("Nothing specified, nothing added.\nhint: Maybe you wanted to say 'git add .'?\n"); return 0; }
      if (all && !paths.length) paths = ['.'];
      var bad = false;
      paths.forEach(function (p) {
        var abs = resolvePath(s, p), rel = relOf(p);
        if (!vfs.exists(abs) && !Object.keys(repo.index).some(function (k) { return k === rel || k.indexOf(rel + '/') === 0; })) { ctx.err("fatal: pathspec '" + p + "' did not match any files\n"); bad = true; return; }
        var prefix = rel === '' ? '' : rel;
        Object.keys(wt).forEach(function (k) { if (prefix === '' || k === prefix || k.indexOf(prefix + '/') === 0) repo.index[k] = wt[k]; });
        Object.keys(repo.index).forEach(function (k) { if (!hasOwn.call(wt, k) && (prefix === '' || k === prefix || k.indexOf(prefix + '/') === 0)) delete repo.index[k]; });
      });
      return bad ? 128 : 0;
    }
    if (sub === 'commit') {
      var mi = rest.indexOf('-m'), msg = null;
      rest.forEach(function (a, n) { if (a === '-m') msg = rest[n + 1]; else if (a.indexOf('-m') === 0 && a.length > 2 && a.charAt(2) !== '-') msg = a.slice(2); else if (a.indexOf('--message=') === 0) msg = a.slice(10); });
      if (rest.indexOf('-a') >= 0 || rest.indexOf('-am') >= 0) { Object.keys(repo.index).forEach(function (k) { if (hasOwn.call(wt, k)) repo.index[k] = wt[k]; else delete repo.index[k]; }); }
      var amIdx = rest.indexOf('-am');
      if (amIdx >= 0) msg = rest[amIdx + 1];
      var ch2 = gitChanges(repo, wt);
      if (!ch2.staged.length) {
        ctx.out('On branch ' + repo.branch + '\n' + (ch2.untracked.length ? 'Untracked files:\n  (use "git add <file>..." to include in what will be committed)\n' + ch2.untracked.map(function (u) { return '\t' + u + '\n'; }).join('') + '\nnothing added to commit but untracked files present (use "git add" to track)\n' : (ch2.unstaged.length ? 'no changes added to commit (use "git add" and/or "git commit -a")\n' : 'nothing to commit, working tree clean\n')));
        return 1;
      }
      if (msg === null || msg === undefined || msg === '') { ctx.err('（練習版）git commit 要加訊息：git commit -m "你的訊息"\n'); return 1; }
      var who1 = who();
      if (!who1) {
        ctx.err('Author identity unknown\n\n*** Please tell me who you are.\n\nRun\n\n  git config --global user.email "you@example.com"\n  git config --global user.name "Your Name"\n\nto set your account\'s default identity.\nOmit --global to set the identity only in this repository.\n\nfatal: unable to auto-detect email address (got \'an@MacBook-Air.(none)\')\n');
        return 128;
      }
      var parent = repo.branches[repo.branch], tree1 = JSON.parse(JSON.stringify(repo.index));
      var id = hash40(root + msg + LAB.clock.ms() + Object.keys(repo.commits).length);
      var adds = 0, files = ch2.staged.length, mode = '';
      ch2.staged.forEach(function (c) {
        var oldT = hasOwn.call(repo.headTree, c[1]) ? repo.headTree[c[1]] : '', newT = hasOwn.call(tree1, c[1]) ? tree1[c[1]] : '';
        var d = hunksOf(splitLines(oldT), splitLines(newT)); adds += d.adds; mode += c[0] === 'new file' ? ' create mode 100644 ' + c[1] + '\n' : c[0] === 'deleted' ? ' delete mode 100644 ' + c[1] + '\n' : '';
        if (c[0] === 'deleted') adds -= 0;
      });
      var dels = 0;
      ch2.staged.forEach(function (c) { var oldT = hasOwn.call(repo.headTree, c[1]) ? repo.headTree[c[1]] : '', newT = hasOwn.call(tree1, c[1]) ? tree1[c[1]] : ''; dels += hunksOf(splitLines(oldT), splitLines(newT)).dels; });
      repo.commits[id] = { id: id, msg: msg, time: LAB.clock.ms(), parent: parent, tree: tree1, author: who1 };
      repo.branches[repo.branch] = id; repo.headTree = tree1;
      ctx.out('[' + repo.branch + (parent ? '' : ' (root-commit)') + ' ' + shortHash(id) + '] ' + msg + '\n ' + files + ' file' + (files === 1 ? '' : 's') + ' changed' + (adds ? ', ' + adds + ' insertion' + (adds === 1 ? '' : 's') + '(+)' : '') + (dels ? ', ' + dels + ' deletion' + (dels === 1 ? '' : 's') + '(-)' : '') + '\n' + mode);
      return 0;
    }
    if (sub === 'log') {
      var head = repo.branches[repo.branch];
      if (!head) { ctx.err("fatal: your current branch '" + repo.branch + "' does not have any commits yet\n"); return 128; }
      var one = rest.indexOf('--oneline') >= 0, limit = Infinity;
      rest.forEach(function (a, n) { if (a === '-n') limit = parseInt(rest[n + 1], 10); else if (/^-\d+$/.test(a)) limit = parseInt(a.slice(1), 10); else if (a.indexOf('-n') === 0 && /^\d+$/.test(a.slice(2))) limit = parseInt(a.slice(2), 10); });
      var chain = [], cid2 = head;
      while (cid2 && chain.length < limit) { chain.push(repo.commits[cid2]); cid2 = repo.commits[cid2].parent; }
      var lines = [];
      chain.forEach(function (c, n) {
        var deco = n === 0 ? ' (' + C('1;36', 'HEAD -> ') + C('1;32', repo.branch) + ')' : '';
        var others = Object.keys(repo.branches).filter(function (b) { return b !== repo.branch && repo.branches[b] === c.id; });
        if (others.length) deco = deco ? deco.slice(0, -1) + ', ' + others.join(', ') + ')' : ' (' + others.join(', ') + ')';
        if (one) lines.push(C('33', shortHash(c.id)) + deco + ' ' + c.msg);
        else lines.push(C('33', 'commit ' + c.id) + deco + '\nAuthor: ' + c.author + '\nDate:   ' + gitDate(c.time) + '\n\n    ' + c.msg + '\n');
      });
      ctx.out(lines.join('\n') + '\n');
      return 0;
    }
    if (sub === 'branch') {
      var names = rest.filter(function (a) { return a.charAt(0) !== '-'; });
      if (rest.indexOf('-d') >= 0 || rest.indexOf('-D') >= 0) {
        var bn = names[0];
        if (!bn || !hasOwn.call(repo.branches, bn)) { ctx.err("error: branch '" + bn + "' not found.\n"); return 1; }
        if (bn === repo.branch) { ctx.err("error: Cannot delete branch '" + bn + "' checked out at '" + root + "'\n"); return 1; }
        ctx.out("Deleted branch " + bn + " (was " + shortHash(repo.branches[bn] || '0000000') + ").\n");
        delete repo.branches[bn];
        return 0;
      }
      if (names.length) {
        if (!repo.branches[repo.branch]) { ctx.err('fatal: not a valid object name: \'' + repo.branch + '\'\n'); return 128; }
        if (hasOwn.call(repo.branches, names[0])) { ctx.err("fatal: a branch named '" + names[0] + "' already exists\n"); return 128; }
        repo.branches[names[0]] = repo.branches[repo.branch];
        return 0;
      }
      if (!repo.branches[repo.branch]) return 0;
      Object.keys(repo.branches).sort().forEach(function (b) { ctx.out((b === repo.branch ? '* ' + C('32', b) : '  ' + b) + '\n'); });
      return 0;
    }
    if (sub === 'checkout' || sub === 'switch') {
      var create = rest.indexOf('-b') >= 0 || rest.indexOf('-c') >= 0 || rest.indexOf('-B') >= 0, target = rest.filter(function (a) { return a.charAt(0) !== '-'; })[0];
      if (!target) { ctx.err('fatal: missing branch name\n'); return 128; }
      if (create) {
        if (hasOwn.call(repo.branches, target)) { ctx.err("fatal: a branch named '" + target + "' already exists\n"); return 128; }
        repo.branches[target] = repo.branches[repo.branch];
        repo.branch = target;
        ctx.out("Switched to a new branch '" + target + "'\n");
        return 0;
      }
      if (!hasOwn.call(repo.branches, target)) { ctx.err((sub === 'switch' ? 'fatal: invalid reference: ' : "error: pathspec '" + target + "' did not match any file(s) known to git") + (sub === 'switch' ? target : '') + '\n'); return sub === 'switch' ? 128 : 1; }
      if (target === repo.branch) { ctx.out("Already on '" + target + "'\n"); return 0; }
      var cur = gitChanges(repo, wt);
      if (cur.staged.length || cur.unstaged.length) { ctx.err('error: Your local changes would be overwritten by checkout.\nPlease commit your changes or stash them before you switch branches.\nAborting\n'); return 1; }
      var tid = repo.branches[target], ttree = tid ? repo.commits[tid].tree : {};
      Object.keys(repo.headTree).forEach(function (k) { if (!hasOwn.call(ttree, k)) { try { vfs.remove(vfs.join(root, k), { by: 'terminal' }); } catch (e3) { /* gone */ } } });
      Object.keys(ttree).forEach(function (k) { try { vfs.mkdir(vfs.dirname(vfs.join(root, k)), { by: 'terminal', parents: true }); vfs.writeFile(vfs.join(root, k), ttree[k], { by: 'terminal' }); } catch (e4) { /* skip */ } });
      repo.branch = target; repo.headTree = JSON.parse(JSON.stringify(ttree)); repo.index = JSON.parse(JSON.stringify(ttree));
      ctx.out("Switched to branch '" + target + "'\n");
      return 0;
    }
    if (sub === 'diff') {
      var staged = rest.indexOf('--staged') >= 0 || rest.indexOf('--cached') >= 0, stat = rest.indexOf('--stat') >= 0;
      var from = staged ? repo.headTree : repo.index, to = staged ? repo.index : wt, names2 = {}, k2;
      for (k2 in from) names2[k2] = 1; for (k2 in to) names2[k2] = 1;
      var diffOut = '', files2 = [], totA = 0, totD = 0;
      Object.keys(names2).sort().forEach(function (k) {
        var a = hasOwn.call(from, k) ? from[k] : null, b = hasOwn.call(to, k) ? to[k] : null;
        if (!staged && a === null) return;                       // untracked files are not part of git diff
        if (a === b) return;
        var d = hunksOf(splitLines(a || ''), splitLines(b || ''));
        totA += d.adds; totD += d.dels;
        files2.push({ name: k, adds: d.adds, dels: d.dels });
        diffOut += C('1', 'diff --git a/' + k + ' b/' + k) + '\n' + (a === null ? 'new file mode 100644\n' : b === null ? 'deleted file mode 100644\n' : '') + 'index ' + hash40('a' + k + (a || '')).slice(0, 7) + '..' + hash40('b' + k + (b || '')).slice(0, 7) + (a !== null && b !== null ? ' 100644' : '') + '\n' + C('1', '--- ' + (a === null ? '/dev/null' : 'a/' + k)) + '\n' + C('1', '+++ ' + (b === null ? '/dev/null' : 'b/' + k)) + '\n' + d.text.replace(/^(@@.*)$/gm, function (m) { return C('36', m); });
      });
      if (stat) {
        if (!files2.length) return 0;
        var w = 0; files2.forEach(function (f) { w = Math.max(w, f.name.length); });
        var so = '';
        var nw = String(Math.max.apply(null, files2.map(function (f) { return f.adds + f.dels; }))).length;
        files2.forEach(function (f) { so += ' ' + pad(f.name, w) + ' | ' + pad(String(f.adds + f.dels), nw, true) + ' ' + new Array(f.adds + 1).join('+') + new Array(f.dels + 1).join('-') + '\n'; });
        so += ' ' + files2.length + ' file' + (files2.length === 1 ? '' : 's') + ' changed' + (totA ? ', ' + totA + ' insertion' + (totA === 1 ? '' : 's') + '(+)' : '') + (totD ? ', ' + totD + ' deletion' + (totD === 1 ? '' : 's') + '(-)' : '') + '\n';
        ctx.out(so);
        return 0;
      }
      ctx.out(diffOut);
      return 0;
    }
    ctx.err("git: '" + sub + "' is not a git command. See 'git --help'.\n（練習版的 git 只做：init status add commit log branch checkout switch diff config）\n");
    return 1;
  });

  /* ------------------------------------------------------------- python3 */
  /* A very small Python: numbers, strings, lists, variables, calculations, print(), a few built-in functions and math.
     Anything else (if, for, def …) answers with the practice line. Floats are boxed as {f: x} so 3.0 stays a float. */
  var PY_SORRY = '練習版的 Python 只會 print 和算式';
  var PY_BANNER = 'Python 3.9.6 (default, Mar 29 2024, 10:10:28) \n[Clang 15.0.0 (clang-1500.3.9.4)] on darwin\nType "help", "copyright", "credits" or "license" for more information.\n';
  function PyErr(kind, msg) { this.kind = kind; this.msg = msg; }
  function pyF(x) { return { f: x }; }
  function isF(v) { return v !== null && typeof v === 'object' && !Array.isArray(v) && 'f' in v; }
  function pyNum(v) { if (isF(v)) return v.f; if (typeof v === 'number') return v; if (v === true) return 1; if (v === false) return 0; throw new PyErr('TypeError', 'unsupported operand type(s)'); }
  function pyTypeName(v) { return isF(v) ? 'float' : typeof v === 'number' ? 'int' : typeof v === 'string' ? 'str' : typeof v === 'boolean' ? 'bool' : v === null ? 'NoneType' : Array.isArray(v) ? 'list' : 'object'; }
  function pyRepr(v) {
    if (isF(v)) { var x = v.f; if (x === Infinity) return 'inf'; if (x === -Infinity) return '-inf'; if (isNaN(x)) return 'nan'; var t = String(x); return /^-?\d+$/.test(t) ? t + '.0' : t.replace('e+', 'e+').replace(/e(-?)(\d)$/, 'e$10$2'); }
    if (typeof v === 'string') return v.indexOf("'") >= 0 && v.indexOf('"') < 0 ? '"' + v + '"' : "'" + v.replace(/'/g, "\\'") + "'";
    if (v === true) return 'True'; if (v === false) return 'False'; if (v === null) return 'None';
    if (Array.isArray(v)) return '[' + v.map(pyRepr).join(', ') + ']';
    return String(v);
  }
  function pyStr(v) { return typeof v === 'string' ? v : pyRepr(v); }
  function pyTokens(src) {
    var toks = [], i = 0, m;
    while (i < src.length) {
      var c = src.charAt(i);
      if (/\s/.test(c)) { i++; continue; }
      if (c === '#') break;
      if ((m = /^[fF]?(?:"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/.exec(src.slice(i)))) {
        var raw = m[0], isFs = /^[fF]/.test(raw), body = raw.replace(/^[fF]/, '');
        toks.push({ t: isFs ? 'fstr' : 'str', v: body.slice(1, -1).replace(/\\(n|t|\\|'|")/g, function (a, ch) { return ch === 'n' ? '\n' : ch === 't' ? '\t' : ch; }) });
        i += raw.length; continue;
      }
      if ((m = /^(\d+\.\d*|\.\d+|\d+)([eE][+-]?\d+)?/.exec(src.slice(i)))) { toks.push({ t: 'num', v: m[0], f: /[.eE]/.test(m[0]) }); i += m[0].length; continue; }
      if ((m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i)))) { toks.push({ t: 'name', v: m[0] }); i += m[0].length; continue; }
      if ((m = /^(\*\*|\/\/|==|!=|<=|>=|\+=|-=|\*=|\/=|[-+*\/%<>=()\[\],.:])/.exec(src.slice(i)))) { toks.push({ t: 'op', v: m[0] }); i += m[0].length; continue; }
      throw new PyErr('SyntaxError', 'invalid syntax');
    }
    return toks;
  }
  function pyEval(toks, env, out) {
    var p = 0;
    function peek() { return toks[p]; }
    function isOp(v) { return toks[p] && toks[p].t === 'op' && toks[p].v === v; }
    function isName(v) { return toks[p] && toks[p].t === 'name' && toks[p].v === v; }
    function expect(v) { if (!isOp(v)) throw new PyErr('SyntaxError', 'invalid syntax'); p++; }
    function truthy(v) { return isF(v) ? v.f !== 0 : Array.isArray(v) ? v.length > 0 : !!v; }
    function arith(op, a, b) {
      if (op === '+' && typeof a === 'string' && typeof b === 'string') return a + b;
      if (op === '+' && Array.isArray(a) && Array.isArray(b)) return a.concat(b);
      if (op === '*' && typeof a === 'string' && typeof b === 'number') return new Array(Math.max(0, b) + 1).join(a);
      if (op === '*' && typeof a === 'number' && typeof b === 'string') return new Array(Math.max(0, a) + 1).join(b);
      if (typeof a === 'string' || typeof b === 'string' || Array.isArray(a) || Array.isArray(b)) throw new PyErr('TypeError', "unsupported operand type(s) for " + op + ": '" + pyTypeName(a) + "' and '" + pyTypeName(b) + "'");
      var x = pyNum(a), y = pyNum(b), fl = isF(a) || isF(b);
      switch (op) {
        case '+': return fl ? pyF(x + y) : x + y;
        case '-': return fl ? pyF(x - y) : x - y;
        case '*': return fl ? pyF(x * y) : x * y;
        case '/': if (y === 0) throw new PyErr('ZeroDivisionError', 'division by zero'); return pyF(x / y);
        case '//': if (y === 0) throw new PyErr('ZeroDivisionError', 'integer division or modulo by zero'); return fl ? pyF(Math.floor(x / y)) : Math.floor(x / y);
        case '%': if (y === 0) throw new PyErr('ZeroDivisionError', 'integer division or modulo by zero'); { var r = x - Math.floor(x / y) * y; return fl ? pyF(r) : r; }
        case '**': { var pw = Math.pow(x, y); return (fl || y < 0) ? pyF(pw) : pw; }
      }
      throw new PyErr('SyntaxError', 'invalid syntax');
    }
    function cmpVals(a, b) { return typeof a === 'string' && typeof b === 'string' ? (a < b ? -1 : a > b ? 1 : 0) : pyNum(a) - pyNum(b); }
    function eq(a, b) { if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every(function (x, i) { return eq(x, b[i]); }); if (typeof a === 'string' || typeof b === 'string' || a === null || b === null) return a === b; return pyNum(a) === pyNum(b); }
    var BUILTIN = {
      len: function (a) { if (typeof a[0] === 'string' || Array.isArray(a[0])) return Array.from(a[0]).length; throw new PyErr('TypeError', "object of type '" + pyTypeName(a[0]) + "' has no len()"); },
      int: function (a) { var v = a[0]; if (typeof v === 'string') { if (!/^\s*[+-]?\d+\s*$/.test(v)) throw new PyErr('ValueError', "invalid literal for int() with base 10: " + pyRepr(v)); return parseInt(v, 10); } return Math.trunc(pyNum(v)); },
      float: function (a) { var v = a[0]; if (typeof v === 'string') { if (isNaN(parseFloat(v))) throw new PyErr('ValueError', 'could not convert string to float: ' + pyRepr(v)); return pyF(parseFloat(v)); } return pyF(pyNum(v)); },
      str: function (a) { return a.length ? pyStr(a[0]) : ''; },
      abs: function (a) { return isF(a[0]) ? pyF(Math.abs(a[0].f)) : Math.abs(pyNum(a[0])); },
      round: function (a) { var x = pyNum(a[0]); if (a.length > 1) { var f = Math.pow(10, a[1]); return pyF(Math.round(x * f) / f); } var rr = Math.round(x); if (Math.abs(x % 1) === 0.5 && rr % 2 !== 0) rr -= 1; return rr; },
      max: function (a) { var l = a.length === 1 && Array.isArray(a[0]) ? a[0] : a; return l.reduce(function (m, x) { return cmpVals(x, m) > 0 ? x : m; }); },
      min: function (a) { var l = a.length === 1 && Array.isArray(a[0]) ? a[0] : a; return l.reduce(function (m, x) { return cmpVals(x, m) < 0 ? x : m; }); },
      sum: function (a) { return a[0].reduce(function (t, x) { return arith('+', t, x); }, 0); },
      range: function (a) { var from = a.length > 1 ? a[0] : 0, to = a.length > 1 ? a[1] : a[0], st = a.length > 2 ? a[2] : 1, r = []; for (var v = from; st > 0 ? v < to : v > to; v += st) { r.push(v); if (r.length > 100000) break; } return r; },
      sorted: function (a) { return a[0].slice().sort(cmpVals); },
      list: function (a) { return a.length ? (typeof a[0] === 'string' ? Array.from(a[0]) : a[0].slice()) : []; },
      type: function (a) { return "<class '" + pyTypeName(a[0]) + "'>"; },
      bool: function (a) { return a.length ? truthy(a[0]) : false; }
    };
    var MATH = { pi: pyF(Math.PI), e: pyF(Math.E), sqrt: function (a) { if (pyNum(a[0]) < 0) throw new PyErr('ValueError', 'math domain error'); return pyF(Math.sqrt(pyNum(a[0]))); }, floor: function (a) { return Math.floor(pyNum(a[0])); }, ceil: function (a) { return Math.ceil(pyNum(a[0])); }, sin: function (a) { return pyF(Math.sin(pyNum(a[0]))); }, cos: function (a) { return pyF(Math.cos(pyNum(a[0]))); }, log: function (a) { return pyF(Math.log(pyNum(a[0]))); }, pow: function (a) { return pyF(Math.pow(pyNum(a[0]), pyNum(a[1]))); } };
    var STRM = {
      upper: function (s) { return s.toUpperCase(); }, lower: function (s) { return s.toLowerCase(); }, title: function (s) { return s.replace(/\w\S*/g, function (w) { return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(); }); },
      strip: function (s) { return s.trim(); }, split: function (s, a) { return a.length ? s.split(a[0]) : s.split(/\s+/).filter(Boolean); }, replace: function (s, a) { return s.split(a[0]).join(a[1]); },
      startswith: function (s, a) { return s.indexOf(a[0]) === 0; }, endswith: function (s, a) { return s.slice(-a[0].length) === a[0]; }, join: function (s, a) { return a[0].map(pyStr).join(s); }
    };
    function callArgs() { var args = []; expect('('); if (!isOp(')')) { for (;;) { args.push(orE()); if (isOp(',')) { p++; continue; } break; } } expect(')'); return args; }
    function atom() {
      var t = peek();
      if (!t) throw new PyErr('SyntaxError', 'invalid syntax');
      if (t.t === 'num') { p++; return t.f ? pyF(parseFloat(t.v)) : parseInt(t.v, 10); }
      if (t.t === 'str') { p++; return t.v; }
      if (t.t === 'fstr') { p++; return t.v.replace(/\{([^{}]*)\}/g, function (m, ex) { return pyStr(pyEval(pyTokens(ex), env, out)); }); }
      if (t.t === 'op' && t.v === '(') { p++; var v = orE(); expect(')'); return v; }
      if (t.t === 'op' && t.v === '[') { p++; var l = []; if (!isOp(']')) { for (;;) { l.push(orE()); if (isOp(',')) { p++; if (isOp(']')) break; continue; } break; } } expect(']'); return l; }
      if (t.t === 'name') {
        p++;
        if (t.v === 'True') return true; if (t.v === 'False') return false; if (t.v === 'None') return null;
        if (t.v === 'math' && isOp('.') && env.__math) {
          p++; var mn = peek(); p++;
          if (!mn || !hasOwn.call(MATH, mn.v)) throw new PyErr('AttributeError', "module 'math' has no attribute '" + (mn ? mn.v : '') + "'");
          if (typeof MATH[mn.v] === 'function') return MATH[mn.v](callArgs());
          return MATH[mn.v];
        }
        if (t.t === 'name' && isOp('(')) {
          var args = callArgs();
          if (t.v === 'print') { out.push(args.map(pyStr).join(' ')); return null; }
          if (hasOwn.call(BUILTIN, t.v)) return BUILTIN[t.v](args);
          if (hasOwn.call(env, t.v)) throw new PyErr('TypeError', "'" + pyTypeName(env[t.v]) + "' object is not callable");
          throw new PyErr('NameError', "name '" + t.v + "' is not defined");
        }
        if (!hasOwn.call(env, t.v)) throw new PyErr('NameError', "name '" + t.v + "' is not defined");
        return env[t.v];
      }
      throw new PyErr('SyntaxError', 'invalid syntax');
    }
    function postfix() {
      var v = atom();
      for (;;) {
        if (isOp('.') && typeof v === 'string') {
          p++; var mn = peek(); p++;
          if (!mn || !hasOwn.call(STRM, mn.v)) throw new PyErr('AttributeError', "'str' object has no attribute '" + (mn ? mn.v : '') + "'");
          v = STRM[mn.v](v, callArgs());
        } else if (isOp('[')) {
          p++; var ix = orE(); expect(']');
          var seq = typeof v === 'string' ? Array.from(v) : v;
          if (!Array.isArray(seq)) throw new PyErr('TypeError', "'" + pyTypeName(v) + "' object is not subscriptable");
          var n = pyNum(ix); if (n < 0) n += seq.length;
          if (n < 0 || n >= seq.length) throw new PyErr('IndexError', (typeof v === 'string' ? 'string' : 'list') + ' index out of range');
          v = seq[n];
        } else return v;
      }
    }
    function unary() {
      if (isOp('-')) { p++; var v = unary(); return isF(v) ? pyF(-v.f) : -pyNum(v); }
      if (isOp('+')) { p++; return unary(); }
      return pw();
    }
    function pw() { var b = postfix(); if (isOp('**')) { p++; return arith('**', b, unary()); } return b; }
    function mul() { var a = unary(); for (;;) { var t = peek(); if (t && t.t === 'op' && (t.v === '*' || t.v === '/' || t.v === '//' || t.v === '%')) { p++; a = arith(t.v, a, unary()); } else return a; } }
    function add() { var a = mul(); for (;;) { var t = peek(); if (t && t.t === 'op' && (t.v === '+' || t.v === '-')) { p++; a = arith(t.v, a, mul()); } else return a; } }
    function cmp() {
      var a = add(), t = peek();
      while (t && ((t.t === 'op' && /^(==|!=|<=|>=|<|>)$/.test(t.v)) || (t.t === 'name' && t.v === 'in'))) {
        p++; var b = add(), r;
        if (t.v === 'in') r = (typeof b === 'string' ? b.indexOf(a) >= 0 : b.some(function (x) { return eq(x, a); }));
        else if (t.v === '==') r = eq(a, b); else if (t.v === '!=') r = !eq(a, b);
        else { var c = cmpVals(a, b); r = t.v === '<' ? c < 0 : t.v === '>' ? c > 0 : t.v === '<=' ? c <= 0 : c >= 0; }
        a = r; t = peek();
      }
      return a;
    }
    function notE() { if (isName('not')) { p++; return !truthy(notE()); } return cmp(); }
    function andE() { var a = notE(); while (isName('and')) { p++; var b = notE(); a = truthy(a) ? b : a; } return a; }
    function orE() { var a = andE(); while (isName('or')) { p++; var b = andE(); a = truthy(a) ? a : b; } return a; }
    function tuple() { var v = orE(); if (isOp(',')) { var l = [v]; while (isOp(',')) { p++; if (p >= toks.length) break; l.push(orE()); } return l; } return v; }
    var res = tuple();
    if (p < toks.length) throw new PyErr('SyntaxError', 'invalid syntax');
    return res;
  }
  /* one line of Python: {out:[lines], value, hasValue} or throws PyErr */
  function pyLine(line, env) {
    var out = [];
    var src = line.replace(/\s+$/, '');
    if (/^\s*(if|elif|else|for|while|def|class|with|try|except|finally|lambda|return|from|del|pass|break|continue|global|assert|raise|async|await)\b/.test(src)) throw new PyErr('Sorry', PY_SORRY);
    if (/^\s+\S/.test(src)) throw new PyErr('IndentationError', 'unexpected indent');
    if (src.trim() === '') return { out: out, hasValue: false };
    var m = /^import\s+(\w+)\s*$/.exec(src);
    if (m) { if (m[1] === 'math') { env.__math = true; return { out: out, hasValue: false }; } throw new PyErr('ModuleNotFoundError', "No module named '" + m[1] + "'"); }
    var toks = pyTokens(src);
    var asg = toks.length > 2 && toks[0].t === 'name' && toks[1].t === 'op' && /^(=|\+=|-=|\*=|\/=)$/.test(toks[1].v);
    if (asg) {
      var v = pyEval(toks.slice(2), env, out), name = toks[0].v;
      if (toks[1].v !== '=') {
        if (!hasOwn.call(env, name)) throw new PyErr('NameError', "name '" + name + "' is not defined");
        var cur = env[name], opn = toks[1].v.charAt(0);
        var xs = typeof cur === 'string' && opn === '+' ? cur + v : (function () { var a = pyNum(cur), b = pyNum(v); var fl = isF(cur) || isF(v) || opn === '/'; var r = opn === '+' ? a + b : opn === '-' ? a - b : opn === '*' ? a * b : a / b; return fl ? pyF(r) : r; })();
        v = xs;
      }
      env[name] = v;
      return { out: out, hasValue: false };
    }
    var val = pyEval(toks, env, out);
    return { out: out, value: val, hasValue: val !== null };
  }
  function pyTrace(e, where, lineNo) {
    if (e instanceof PyErr) {
      if (e.kind === 'Sorry') return PY_SORRY + '\n';
      if (e.kind === 'SyntaxError' || e.kind === 'IndentationError') return '  File "' + where + '", line ' + lineNo + '\n' + e.kind + ': ' + e.msg + '\n';
      return 'Traceback (most recent call last):\n  File "' + where + '", line ' + lineNo + ', in <module>\n' + e.kind + ': ' + e.msg + '\n';
    }
    return 'Traceback (most recent call last):\n  File "' + where + '", line ' + lineNo + ', in <module>\nRuntimeError: ' + (e && e.message) + '\n';
  }
  function pyAlias(name) {
    def(name, function* (args, ctx) {
      if (!sys.devTools) return needDevTools(ctx, name);
      var s = ctx.session, vfs = s.vfs, env = Object.create(null);
      if (args[0] === '--version' || args[0] === '-V') { ctx.out('Python 3.9.6\n'); return 0; }
      var runLines = function (text, where, echoValues) {
        var lines = text.split('\n'), status = 0;
        for (var i = 0; i < lines.length; i++) {
          try {
            var r = pyLine(lines[i], env);
            if (r.out.length) ctx.out(r.out.join('\n') + '\n');
            if (echoValues && r.hasValue) ctx.out(pyRepr(r.value) + '\n');
          } catch (e) { ctx.err(pyTrace(e, where, i + 1)); return 1; }
        }
        return status;
      };
      if (args[0] === '-c') { return runLines(args[1] || '', '<string>', false); }
      if (args.length && args[0].charAt(0) !== '-') {
        var abs = resolvePath(s, args[0]), st = vfs.stat(abs);
        if (!st) { ctx.err('python3: can\'t open file \'' + vfs.canon(abs) + '\': [Errno 2] No such file or directory\n'); return 2; }
        if (st.type === 'dir') { ctx.err('python3: can\'t find \'__main__\' module in \'' + vfs.canon(abs) + '\'\n'); return 1; }
        return runLines(st.kind === 'text' ? vfs.readFile(abs, { by: 'terminal' }) : '', args[0], false);
      }
      if (ctx.stdin !== null) return runLines(ctx.stdin, '<stdin>', false);
      ctx.out(PY_BANNER);
      for (;;) {
        var line = yield { prompt: '>>> ' };
        if (line === null) { ctx.out('\n'); break; }
        var t = line.trim();
        if (t === 'exit()' || t === 'quit()') break;
        if (t === 'exit' || t === 'quit') { ctx.out('Use ' + t + '() or Ctrl-D (i.e. EOF) to exit\n'); continue; }
        try {
          var r = pyLine(line, env);
          if (r.out.length) ctx.out(r.out.join('\n') + '\n');
          if (r.hasValue) ctx.out(pyRepr(r.value) + '\n');
        } catch (e) { ctx.out(pyTrace(e, '<stdin>', 1)); }
      }
      return 0;
    });
  }
  pyAlias('python3');

  LAB.shell.library = true;
})(window.LAB);
