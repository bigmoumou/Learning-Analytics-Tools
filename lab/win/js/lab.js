/* lab.js [PORTABLE] — namespace, util, clock, clipboard, bus, ready/boot, debug. See DESIGN.md §3.1–3.3. */
window.LAB = window.LAB || {};
(function (LAB) {
  'use strict';

  /* ------------------------------------------------------------------ util */
  var uidCounters = Object.create(null);

  function isPlainAttrs(a) {
    return a && typeof a === 'object' && !Array.isArray(a) && !(typeof Node !== 'undefined' && a instanceof Node);
  }

  function appendChild(el, c) {
    if (c === null || c === undefined || c === false) return;
    if (Array.isArray(c)) { for (var i = 0; i < c.length; i++) appendChild(el, c[i]); return; }
    if (typeof Node !== 'undefined' && c instanceof Node) { el.appendChild(c); return; }
    el.appendChild(document.createTextNode(String(c)));
  }

  /* h(tag, attrs?, ...children): strings become text nodes, never HTML (DESIGN §0.5). */
  function h(tag, attrs) {
    var el = document.createElement(tag);
    var start = 1;
    if (isPlainAttrs(attrs)) {
      start = 2;
      for (var k in attrs) {
        if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
        var v = attrs[k];
        if (v === null || v === undefined || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'dataset') { for (var d in v) { if (v[d] !== null && v[d] !== undefined) el.dataset[d] = String(v[d]); } }
        else if (k === 'style') {
          if (typeof v === 'string') el.style.cssText = v;
          else for (var s in v) { if (s.indexOf('--') === 0) el.style.setProperty(s, v[s]); else el.style[s] = v[s]; }
        }
        else if (k === 'on') { for (var ev in v) el.addEventListener(ev, v[ev]); }
        else if (k === 'text') el.textContent = v;
        else el.setAttribute(k, v === true ? '' : String(v));
      }
    }
    for (var i = start; i < arguments.length; i++) appendChild(el, arguments[i]);
    return el;
  }

  function esc(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function uid(prefix) {
    prefix = prefix || 'id';
    uidCounters[prefix] = (uidCounters[prefix] || 0) + 1;
    return prefix + uidCounters[prefix];
  }
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
  function debounce(fn, ms) {
    var t = null;
    var f = function () {
      var self = this, args = arguments;
      if (t) clearTimeout(t);
      t = setTimeout(function () { t = null; fn.apply(self, args); }, ms);
    };
    f.cancel = function () { if (t) clearTimeout(t); t = null; };
    return f;
  }
  function raf(fn) {
    var id = requestAnimationFrame(fn);
    return function () { cancelAnimationFrame(id); };
  }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function once(fn) {
    var done = false, val;
    return function () { if (done) return val; done = true; val = fn.apply(this, arguments); return val; };
  }

  /* The ONE definition of terminal column width (DESIGN §3.1). */
  function charWidth(cp) {
    if ((cp >= 0x0300 && cp <= 0x036F) || (cp >= 0x200B && cp <= 0x200F) || (cp >= 0x20D0 && cp <= 0x20FF) || (cp >= 0xFE00 && cp <= 0xFE0F)) return 0;
    if ((cp >= 0x1100 && cp <= 0x115F) ||
        (cp >= 0x2E80 && cp <= 0x303E) ||
        (cp >= 0x3041 && cp <= 0x33FF) ||
        (cp >= 0x3400 && cp <= 0x4DBF) ||
        (cp >= 0x4E00 && cp <= 0x9FFF) ||
        (cp >= 0xA000 && cp <= 0xA4CF) ||
        (cp >= 0xAC00 && cp <= 0xD7A3) ||
        (cp >= 0xF900 && cp <= 0xFAFF) ||
        (cp >= 0xFE30 && cp <= 0xFE6F) ||
        (cp >= 0xFF00 && cp <= 0xFF60) ||
        (cp >= 0xFFE0 && cp <= 0xFFE6) ||
        (cp >= 0x1F300 && cp <= 0x1F64F) ||
        (cp >= 0x1F900 && cp <= 0x1F9FF) ||
        (cp >= 0x20000 && cp <= 0x3FFFD)) return 2;
    return 1;
  }
  function displayWidth(str) {
    var w = 0;
    for (var ch of String(str)) w += charWidth(ch.codePointAt(0));
    return w;
  }

  var EN_MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var EN_DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var ZH_DAY = ['日', '一', '二', '三', '四', '五', '六'];
  function p2(n) { return (n < 10 ? '0' : '') + n; }
  function sp2(n) { return (n < 10 ? ' ' : '') + n; }
  function ampm(d) { return d.getHours() < 12 ? '上午' : '下午'; }
  function h12(d) { var h = d.getHours() % 12; return h === 0 ? 12 : h; }
  function sameDay(a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }

  var fmt = {
    clockMenubar: function (d) {
      return (d.getMonth() + 1) + '月' + d.getDate() + '日週' + ZH_DAY[d.getDay()] + ' ' + ampm(d) + h12(d) + ':' + p2(d.getMinutes());
    },
    finderDate: function (ms) {
      var d = new Date(ms), now = LAB.clock.now();
      var t = ampm(d) + h12(d) + ':' + p2(d.getMinutes());
      if (sameDay(d, now)) return '今天 ' + t;
      var y = new Date(now.getTime() - 86400000);
      if (sameDay(d, y)) return '昨天 ' + t;
      return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + t;
    },
    lsDate: function (ms) {
      var d = new Date(ms), now = LAB.clock.now().getTime();
      var age = now - ms;
      var base = EN_MON[d.getMonth()] + ' ' + sp2(d.getDate());
      if (age > 182 * 86400000 || age < -3600000) return base + '  ' + d.getFullYear();
      return base + ' ' + p2(d.getHours()) + ':' + p2(d.getMinutes());
    },
    lastLogin: function (ms) {
      var d = new Date(ms);
      return EN_DAY[d.getDay()] + ' ' + EN_MON[d.getMonth()] + ' ' + sp2(d.getDate()) + ' ' + p2(d.getHours()) + ':' + p2(d.getMinutes()) + ':' + p2(d.getSeconds());
    },
    dateLine: function (ms) { /* `date` command: Sun Oct  4 10:12:03 CST 2026 */
      var d = new Date(ms);
      return EN_DAY[d.getDay()] + ' ' + EN_MON[d.getMonth()] + ' ' + sp2(d.getDate()) + ' ' + p2(d.getHours()) + ':' + p2(d.getMinutes()) + ':' + p2(d.getSeconds()) + ' CST ' + d.getFullYear();
    },
    size: function (bytes) {
      bytes = Number(bytes) || 0;
      if (bytes < 1000) return bytes + ' 位元組';
      var units = ['KB', 'MB', 'GB'], v = bytes, i = -1;
      do { v = v / 1000; i++; } while (v >= 1000 && i < units.length - 1);
      var s = v < 10 ? (Math.round(v * 10) / 10).toString() : String(Math.round(v));
      return s + ' ' + units[i];
    }
  };

  LAB.util = {
    h: h, esc: esc, uid: uid, clamp: clamp, debounce: debounce, raf: raf, sleep: sleep, once: once,
    charWidth: charWidth, displayWidth: displayWidth, fmt: fmt
  };

  /* ----------------------------------------------------------------- clock */
  var clockOffset = 0;
  LAB.clock = {
    now: function () { return new Date(Date.now() + clockOffset); },
    ms: function () { return Date.now() + clockOffset; },
    /* ?now=2026-10-04T10:12:00 — an OFFSET, the clock keeps ticking (DESIGN §0.5) */
    setOffsetFromISO: function (str) {
      var t = new Date(str).getTime();
      if (isFinite(t)) clockOffset = t - Date.now();
    }
  };

  /* ------------------------------------------------------------- clipboard */
  var lastLabCopy = 0, lastNativeCopy = 0, stampCounter = 0;
  function stamp() { stampCounter++; return Date.now() * 1000 + (stampCounter % 1000); }
  /* Put text on the real clipboard. Resolves true only when something was really copied: the async Clipboard API first,
     then the old execCommand('copy') path (file://, plain http and some in-app browsers refuse the first). */
  function osCopy(text) {
    function viaExec() {
      var ok = false, prev = document.activeElement, ta = null;
      try {
        ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.setAttribute('aria-hidden', 'true');
        ta.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0';
        document.body.appendChild(ta);
        ta.select();
        try { ta.setSelectionRange(0, text.length); } catch (e0) { /* ignore */ }
        ok = !!document.execCommand('copy');
      } catch (e) { ok = false; }
      if (ta && ta.parentNode) ta.parentNode.removeChild(ta);
      try { if (prev && prev.focus && document.contains(prev)) prev.focus({ preventScroll: true }); } catch (e2) { /* ignore */ }
      return ok;
    }
    return new Promise(function (resolve) {
      var done = false;
      function finish(v) { if (!done) { done = true; resolve(v); } }
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(function () { finish(true); }, function () { finish(viaExec()); });
          return;
        }
      } catch (e) { /* fall through */ }
      finish(viaExec());
    });
  }
  LAB.clipboard = {
    text: '', paths: [], op: 'copy',
    /* returns a Promise<boolean>: did the text reach the real clipboard? (lab paste works either way) */
    setText: function (t) {
      this.text = String(t);
      this.paths = [];
      lastLabCopy = stamp();
      var p = osCopy(this.text);
      p.then(function () { lastLabCopy = stamp(); });
      return p;
    },
    setPaths: function (paths, op) {
      this.paths = (paths || []).slice();
      this.op = op || 'copy';
      this.text = this.paths.join('\n');
      lastLabCopy = stamp();
      var p = osCopy(this.text);
      p.then(function () { lastLabCopy = stamp(); });
      return p;
    },
    forPaste: function (e) {
      var native = '';
      try { native = (e && e.clipboardData && e.clipboardData.getData('text/plain')) || ''; } catch (err) { native = ''; }
      if (lastLabCopy && lastLabCopy > lastNativeCopy && this.text) return this.text;
      return native;
    }
  };
  function noteNativeCopy() { lastNativeCopy = stamp(); }
  document.addEventListener('copy', noteNativeCopy, true);
  document.addEventListener('cut', noteNativeCopy, true);

  /* ------------------------------------------------------------------- bus */
  var listeners = new Map();
  var seqCounter = 0;
  var history = [];
  var PERSIST_RE = /^(term:run|finder:navigate|finder:open|editor:open|editor:save|code:folder|dnd:drop|codex:.*)$/;

  function addListener(name, fn) {
    var arr = listeners.get(name);
    if (!arr) { arr = []; listeners.set(name, arr); }
    arr.push(fn);
  }
  var bus = {
    history: history,
    on: function (name, fn) {
      addListener(name, fn);
      return function () { bus.off(name, fn); };
    },
    once: function (name, fn) {
      var off = bus.on(name, function () { off(); return fn.apply(this, arguments); });
      return off;
    },
    off: function (name, fn) {
      var arr = listeners.get(name);
      if (!arr) return;
      var i = arr.indexOf(fn);
      if (i >= 0) { arr = arr.slice(); arr.splice(i, 1); if (arr.length) listeners.set(name, arr); else listeners.delete(name); }
    },
    emit: function (name, payload) {
      if (payload === undefined) payload = {};
      seqCounter++;
      var entry = { seq: seqCounter, t: LAB.clock.ms(), name: name, data: payload };
      history.push(entry);
      if (history.length > 300) history.splice(0, history.length - 300);
      if (LAB.debug && LAB.debug.logBus) { try { console.debug('[bus]', entry.seq, name, payload); } catch (e) { /* ignore */ } }
      var arr = listeners.get(name), i;
      if (arr) {
        arr = arr.slice();
        for (i = 0; i < arr.length; i++) { try { arr[i](payload, name); } catch (e) { console.error('[bus] handler for ' + name + ' failed', e); } }
      }
      var all = listeners.get('*');
      if (all) {
        all = all.slice();
        for (i = 0; i < all.length; i++) { try { all[i](name, payload); } catch (e2) { console.error('[bus] * handler failed', e2); } }
      }
      return entry;
    },
    seq: function () { return seqCounter; },
    find: function (name, pred, sinceSeq) {
      sinceSeq = sinceSeq || 0;
      for (var i = history.length - 1; i >= 0; i--) {
        var e = history[i];
        if (e.seq <= sinceSeq) break;
        if (e.name !== name) continue;
        var ok = true;
        if (pred) { try { ok = !!pred(e.data); } catch (err) { ok = false; } }
        if (ok) return e;
      }
      return null;
    },
    seen: function (name, pred, sinceSeq) {
      var e = bus.find(name, pred, sinceSeq);
      return e ? e.data : null;
    },
    listeners: function () {
      var o = {};
      listeners.forEach(function (arr, k) { o[k] = arr.length; });
      return o;
    },
    /* persisted tail (DESIGN §3.3): last 80 entries of the names evidence steps need; `out` cut to 600 chars */
    exportTail: function () {
      function cut(v, depth) {
        if (depth > 6) return null;
        if (Array.isArray(v)) return v.map(function (x) { return cut(x, depth + 1); });
        if (v && typeof v === 'object') {
          var o = {};
          for (var k in v) {
            if (!Object.prototype.hasOwnProperty.call(v, k)) continue;
            if (k === 'out' && typeof v[k] === 'string') o[k] = v[k].slice(0, 600);
            else o[k] = cut(v[k], depth + 1);
          }
          return o;
        }
        return v;
      }
      var tail = history.filter(function (e) { return PERSIST_RE.test(e.name); }).slice(-80);
      return { seq: seqCounter, tail: tail.map(function (e) { return { seq: e.seq, t: e.t, name: e.name, data: cut(e.data, 0) }; }) };
    },
    importTail: function (json) {
      if (!json || typeof json !== 'object' || !Array.isArray(json.tail)) throw new Error('bad bus slice');
      var maxSeq = typeof json.seq === 'number' ? json.seq : 0;
      var out = [];
      json.tail.forEach(function (e) {
        if (e && typeof e.seq === 'number' && typeof e.name === 'string') {
          out.push({ seq: e.seq, t: Number(e.t) || 0, name: e.name, data: e.data && typeof e.data === 'object' ? e.data : {} });
          if (e.seq > maxSeq) maxSeq = e.seq;
        }
      });
      history.length = 0;
      out.forEach(function (e) { history.push(e); });
      seqCounter = Math.max(seqCounter, maxSeq);
    },
    clearHistory: function () { history.length = 0; }
  };
  LAB.bus = bus;

  /* ------------------------------------------------------------ ready/boot */
  var readyQ = [], booted = false, readyIndex = 0, running = false;
  LAB.ready = function (fn, priority) {
    if (booted) {
      Promise.resolve().then(function () { try { fn(); } catch (e) { console.error('[ready]', e); } });
      return;
    }
    readyQ.push({ fn: fn, pri: priority === undefined ? 50 : priority, i: readyIndex++ });
  };
  LAB.boot = {
    started: false,
    run: function () {
      if (running || booted) return;
      running = true;
      LAB.boot.started = true;
      while (readyQ.length) {
        readyQ.sort(function (a, b) { return a.pri - b.pri || a.i - b.i; });
        var item = readyQ.shift();
        try { item.fn(); } catch (e) { console.error('[boot] a ready callback failed', e); }
      }
      booted = true;
      running = false;
      if (LAB.debug && LAB.debug.snapshotBaseline) LAB.debug.snapshotBaseline();
    },
    isBooted: function () { return booted; }
  };

  /* LAB.sfx(name) — the practice Mac's two sounds, made on the spot with Web Audio (no audio files, DESIGN §19.5):
       'step'     a step was ticked: two short glass chimes, E6 then B6 75 ms later
       'mission'  a mission was finished: C6 E6 G6 C7, the last one rings a little longer
     Soft sine bells (a faint octave above), 6 ms attack, exponential decay, through a 6 kHz low-pass. Nothing else exists on
     purpose: no swish, no riser, no noise, no pitch sweep, no reverb tail.
     The AudioContext is created / resumed by the visitor's first pointerdown or keydown (browsers keep sound shut before that).
     LAB.sfx.enabled (true; ?sound=0 and the card's 「聲音」 link turn it off, memory only) and LAB.sfx.last =
     {name, at, played} (the last sound asked for, for tests; played = false when the browser had not unlocked audio yet). */
  (function () {
    var ctx = null, master = null, unlocked = false, lastAt = 0;

    function ensure() {
      if (!unlocked) return null;
      if (!ctx) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
        var lp = ctx.createBiquadFilter();
        lp.type = 'lowpass'; lp.frequency.value = 6000; lp.Q.value = 0.7;
        master = ctx.createGain();
        master.gain.value = 1;
        master.connect(lp); lp.connect(ctx.destination);
      }
      if (ctx.state === 'suspended') { try { ctx.resume(); } catch (e) { /* ignore */ } }
      return ctx;
    }
    function unlock() {
      unlocked = true;
      window.removeEventListener('pointerdown', unlock, true);
      window.removeEventListener('keydown', unlock, true);
      try { ensure(); } catch (e) { /* ignore */ }
    }
    window.addEventListener('pointerdown', unlock, true);
    window.addEventListener('keydown', unlock, true);

    /* one soft bell: a sine at freq plus a faint sine one octave up, 6 ms in, then an exponential fade over dur seconds */
    function bell(c, t, freq, peak, dur) {
      var env = c.createGain();
      env.gain.setValueAtTime(0.0001, t);
      env.gain.linearRampToValueAtTime(peak, t + 0.006);
      env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      env.connect(master);
      var o1 = c.createOscillator(), o2 = c.createOscillator(), g2 = c.createGain();
      o1.type = 'sine'; o1.frequency.value = freq;
      o2.type = 'sine'; o2.frequency.value = freq * 2;
      g2.gain.value = 0.12;
      o1.connect(env); o2.connect(g2); g2.connect(env);
      o1.start(t); o2.start(t);
      o1.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
      o1.onended = function () { try { env.disconnect(); g2.disconnect(); } catch (e) { /* ignore */ } };
    }

    function play(name) {
      var c = ensure();
      if (!c || c.state !== 'running') return false;
      var t = c.currentTime + 0.01;
      if (name === 'step') {
        bell(c, t, 1318.5, 0.10, 0.45);
        bell(c, t + 0.075, 1975.5, 0.10, 0.45);
      } else {
        bell(c, t, 1046.5, 0.09, 0.55);
        bell(c, t + 0.09, 1318.5, 0.09, 0.55);
        bell(c, t + 0.18, 1568, 0.09, 0.6);
        bell(c, t + 0.30, 2093, 0.09, 0.9);
      }
      return true;
    }

    var sfx = function (name) {
      if (!sfx.enabled || (name !== 'step' && name !== 'mission')) return false;
      var now = Date.now();
      // two steps ticked in the same instant make one chime, never two on top of each other (a finished mission always rings)
      if (name === 'step' && now - lastAt < 160) return false;
      lastAt = now;
      var played = false;
      try { played = play(name); } catch (e) { played = false; }
      sfx.last = { name: name, at: now, played: played };
      return played;
    };
    sfx.enabled = true;
    sfx.last = null;
    LAB.sfx = sfx;
  })();

  /* A minimal perf holder; desktop.js fills it in (§2.10). wm.js calls LAB.perf.probe. */
  LAB.perf = LAB.perf || { low: false, probe: function () {} };
})(window.LAB);
