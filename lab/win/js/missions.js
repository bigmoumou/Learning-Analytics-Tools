/* missions.js [PORTABLE engine + page-theme rail UI] — LAB.missions (DESIGN §3.12, §5, §6.1, §19).
   lab/win: the engine is the Mac one; the card (top-RIGHT acrylic), the sheets (ContentDialogs), the cue colours and the card's words
   are the Windows ones (DESIGN W8). */
(function (LAB) {
  'use strict';

  var h = LAB.util.h;
  var registry = [];                         // missions, sorted by week/order
  var data = { current: null, missions: {} };
  var preparing = false;
  var queue = [];
  var draining = false;
  var nudge = { stepId: null, text: '' };
  var peek = null;                           // {id, text}: short "step done, next is ..." bubble next to the closed drawer strip
  var peekSeq = 0, peekTimer = null;
  var outroPending = false;                  // a mission just finished: scroll the card down to the outro and the next-mission button
  var nudgeShut = '';                        // key of a nudge whose bubble the student closed
  var stepStartMs = {};                      // in memory only: when a step became current
  var lastSig = '';
  var tickTimer = null;
  var rail = null, liveEl = null;
  var lastFace = null;                       // 'card' or 'pill' at the last render
  var justDone = {};                         // 'mission/step' → when it was ticked (memory only): its green check pops in once
  var lastStepAt = 0;                        // when a step was last ticked (memory only): the pill hops, the count pops
  var progAnim = {};                         // missionId → {from, to, at}: the progress line grows and a light sweeps over it (§19.5)
  var enter = { key: '', at: 0 };            // the step that became current last: its row bounces in (at = 0: it waits for a sheet to go)

  /* the green check for a ticked step. A step ticked under a second ago animates; because render() rebuilds the card,
     the animation is started at its current age (negative delay) so a re-render continues it instead of replaying it.
     burst: eight small dots fly out from its centre (green and amber, §19.5) */
  var POP_MS = 1200;
  var BURST_COLORS = ['#0f7b0f', '#005fb8'];             // Windows green and the accent
  function greenCheck(at, burst) {
    var age = at ? Date.now() - at : Infinity;
    var fresh = age < POP_MS;
    var span = h('span', { class: 'lab-check' + (fresh ? ' is-new' : ''), 'aria-hidden': 'true' });
    span.innerHTML = '<svg viewBox="0 0 20 20" width="18" height="18"><circle cx="10" cy="10" r="9"/><path d="M5.6 10.4l2.9 2.9 5.9-6.1"/></svg>';
    if (fresh) span.style.setProperty('--lab-age', (-age) + 'ms');
    if (burst && age < 700) {
      for (var k = 0; k < 8; k++) {
        var a = k * Math.PI / 4 + Math.PI / 8, d = k % 2 ? 15 : 21;
        var dot = h('i', { class: 'lab-burst-dot' });
        dot.style.setProperty('--dx', (Math.cos(a) * d).toFixed(1) + 'px');
        dot.style.setProperty('--dy', (Math.sin(a) * d).toFixed(1) + 'px');
        dot.style.background = BURST_COLORS[k % 2];
        span.appendChild(dot);
      }
    }
    return span;
  }
  var ui = { mapOpen: false, codeOpen: false, copied: null };
  var welcomeShown = false;                  // the first sheet has been shown (or is about to be)
  var missions = {};

  /* ------------------------------------------------------------ registry */
  missions.register = function (m) {
    var i;
    for (i = 0; i < registry.length; i++) { if (registry[i].id === m.id) { registry.splice(i, 1); break; } }
    registry.push(m);
    registry.sort(function (a, b) { return (a.week - b.week) || (a.order - b.order); });
    if (LAB.boot && LAB.boot.isBooted()) render();
  };
  missions.list = function () { return registry.slice(); };
  /* the missions grouped for the picker: [{name, ids:[...]}], in the order each group first appears; a mission without
     `group` goes in a group named '' (shown without a heading) */
  missions.groups = function () {
    var out = [], at = {};
    registry.forEach(function (m) {
      var g = typeof m.group === 'string' ? m.group : '';
      if (!Object.prototype.hasOwnProperty.call(at, g)) { at[g] = out.length; out.push({ name: g, ids: [] }); }
      out[at[g]].ids.push(m.id);
    });
    return out;
  };
  missions.get = function (id) {
    for (var i = 0; i < registry.length; i++) if (registry[i].id === id) return registry[i];
    return null;
  };
  missions.current = function () { return data.current ? missions.get(data.current) : null; };
  missions.progress = function (id) {
    var r = data.missions[id];
    if (!r) return { started: false, done: false, steps: {}, doneAt: 0 };
    var steps = {};
    Object.keys(r.steps).forEach(function (k) { steps[k] = r.steps[k]; });
    return { started: !!r.startedAt, done: !!r.doneAt, steps: steps, doneAt: r.doneAt || 0 };
  };

  function touch() { LAB.store.markDirty(); }

  function newRec() {
    return { startedAt: 0, doneAt: 0, startSeq: 0, stepStart: {}, steps: {}, skipped: {}, hints: {}, state: {} };
  }
  function rec(id) {
    if (!Object.prototype.hasOwnProperty.call(data.missions, id)) data.missions[id] = newRec();
    return data.missions[id];
  }

  /* --------------------------------------------------------- persistence */
  function isObj(v) { return v && typeof v === 'object' && !Array.isArray(v); }
  function cleanMap(src, valid) {
    var out = {};
    if (!isObj(src)) return out;
    Object.keys(src).forEach(function (k) { if (k !== '__proto__' && valid(src[k])) out[k] = src[k]; });
    return out;
  }
  LAB.store.register('missions', {
    serialize: function () { return { current: data.current, missions: data.missions }; },
    restore: function (json) {
      data = { current: null, missions: {} };            // a freePlay field in an older slice is ignored
      if (json === undefined) return;
      if (!isObj(json)) throw new Error('bad missions slice');
      var src = isObj(json.missions) ? json.missions : {};
      registry.forEach(function (m) {
        if (!Object.prototype.hasOwnProperty.call(src, m.id)) return;
        var r = src[m.id];
        if (!isObj(r)) return;
        var out = newRec();
        out.startedAt = Number(r.startedAt) || 0;
        out.doneAt = Number(r.doneAt) || 0;
        out.startSeq = Number(r.startSeq) || 0;
        out.stepStart = cleanMap(r.stepStart, function (v) { return typeof v === 'number'; });
        out.steps = cleanMap(r.steps, function (v) { return typeof v === 'number'; });
        out.skipped = cleanMap(r.skipped, function (v) { return v === 1; });
        out.hints = cleanMap(r.hints, function (v) { return v === 0 || v === 1 || v === 2; });
        out.state = isObj(r.state) ? r.state : {};
        data.missions[m.id] = out;
      });
      if (typeof json.current === 'string' && missions.get(json.current)) data.current = json.current;
    },
    reset: function () { data = { current: null, missions: {} }; nudge = { stepId: null, text: '' }; }
  });

  /* ----------------------------------------------------------------- api */
  var ctxStep = null;       // step whose check is running (for api.seen defaults)
  var ctxRec = null;

  function sinceFor(opt) {
    var since = opt && opt.since;
    var r = ctxRec;
    if (!r) return 0;
    if (since === undefined) since = (ctxStep && ctxStep.replay === 'mission') ? 'mission' : 'step';
    if (since === 'mission') return r.startSeq || 0;
    return (ctxStep && r.stepStart[ctxStep.id]) || r.startSeq || 0;
  }
  function isFlag(a) { return typeof a === 'string' && a.length > 1 && a.charAt(0) === '-'; }

  var api = {
    HOME: '/Users/an', DESKTOP: '/Users/an/Desktop', DOWNLOADS: '/Users/an/Downloads', DOCUMENTS: '/Users/an/Documents', PROJECT: '/Users/an/Desktop/Project',
    get vfs() { return LAB.vfs; },
    get wm() { return LAB.wm; },
    get codex() { return LAB.codex; },
    get state() { return ctxRec ? ctxRec.state : {}; },
    canon: function (p) { return LAB.vfs.canon(p); },
    exists: function (p) { return LAB.vfs.exists(p); },
    read: function (p) { try { return LAB.vfs.readFile(p, { by: 'system' }); } catch (e) { return null; } },
    resolve: function (cwd, p) { return LAB.vfs.canon(p, cwd); },
    same: function (a, b) { return LAB.vfs.same(a, b); },
    seen: function (name, pred, opt) { return LAB.bus.seen(name, pred, sinceFor(opt)); },
    termCmd: function (ev, pred) {
      if (!ev || ev.name !== 'term:run' || !ev.data) return null;
      var cmds = ev.data.cmds || [];
      for (var i = 0; i < cmds.length; i++) { var ok = false; try { ok = !!pred(cmds[i], ev.data); } catch (e) { ok = false; } if (ok) return cmds[i]; }
      return null;
    },
    termSeen: function (pred, opt) {
      var since = sinceFor(opt);
      var hist = LAB.bus.history;
      for (var i = hist.length - 1; i >= 0; i--) {
        var e = hist[i];
        if (e.seq <= since) break;
        if (e.name !== 'term:run') continue;
        var cmds = (e.data && e.data.cmds) || [];
        for (var k = 0; k < cmds.length; k++) { var ok = false; try { ok = !!pred(cmds[k], e.data); } catch (err) { ok = false; } if (ok) return cmds[k]; }
      }
      return null;
    },
    lsDir: function (c) {
      var args = c.args || [];
      for (var i = 0; i < args.length; i++) { if (!isFlag(args[i])) return LAB.vfs.canon(args[i], c.cwd); }
      return LAB.vfs.canon(c.cwd, '/');
    },
    win: function (appId) { return LAB.wm.byApp(appId); },
    finderAt: function (path) {
      if (!LAB.finder || !LAB.finder.windows) return false;
      return LAB.finder.windows().some(function (w) { return LAB.vfs.same(w.path, path); });
    },
    ensureSeed: function (path, o) { return LAB.seed.restore(path, o); },
    remove: function (path) { try { LAB.vfs.remove(path, { by: 'system', recursive: true, force: true }); } catch (e) { /* missing is fine */ } }
  };
  missions.api = api;

  function withCtx(m, r, step, fn) {
    var ps = ctxStep, pr = ctxRec;
    ctxStep = step; ctxRec = r;
    try { return fn(); } finally { ctxStep = ps; ctxRec = pr; }
  }
  function safeCheck(m, r, step, ev) {
    try { return !!withCtx(m, r, step, function () { return step.check(ev, api); }); }
    catch (e) { console.warn('[missions] check failed', m.id, step.id, e); return false; }
  }

  /* -------------------------------------------------------------- engine */
  function firstUndone(m, r) {
    for (var i = 0; i < m.steps.length; i++) if (!r.steps[m.steps[i].id]) return i;
    return -1;
  }
  function doneCount(m, r) {
    var n = 0;
    m.steps.forEach(function (s) { if (r.steps[s.id]) n++; });
    return n;
  }
  function allRequiredDone(m, r) {
    return m.steps.every(function (s) { return s.optional || r.steps[s.id]; });
  }
  function startStepClock(m, r) {
    var i = firstUndone(m, r);
    if (i < 0) return;
    var id = m.steps[i].id;
    if (r.stepStart[id] === undefined) r.stepStart[id] = LAB.bus.seq();
    if (!stepStartMs[m.id + '/' + id]) stepStartMs[m.id + '/' + id] = Date.now();
  }
  function announce(text) {
    if (!liveEl) return;
    liveEl.textContent = '';
    setTimeout(function () { if (liveEl) liveEl.textContent = text; }, 30);
  }

  function markDone(m, r, i, skipped, ev) {
    var step = m.steps[i];
    r.steps[step.id] = LAB.clock.ms();
    if (skipped) r.skipped[step.id] = 1;
    else { justDone[m.id + '/' + step.id] = Date.now(); lastStepAt = Date.now(); }
    if (nudge.stepId === step.id) nudge = { stepId: null, text: '' };
    var payload = { missionId: m.id, stepId: step.id, index: i };
    if (skipped) payload.skipped = true;
    LAB.bus.emit('mission:step', payload);
    if (!skipped && step.onDone) {
      try { withCtx(m, r, step, function () { step.onDone(api, ev); }); } catch (e) { console.warn('[missions] onDone failed', e); }
    }
    startStepClock(m, r);
    announce('第 ' + (i + 1) + ' 步完成');
    if (!r.doneAt && allRequiredDone(m, r)) {
      r.doneAt = LAB.clock.ms();
      LAB.bus.emit('mission:complete', { missionId: m.id });
    }
    touch();
  }

  function tryAdvance(m, r, ev) {
    var progressed = false;
    for (var guard = 0; guard < 60; guard++) {
      var idx = firstUndone(m, r);
      if (idx < 0) break;
      var cand = [idx];
      if (m.steps[idx].optional) {
        for (var j = idx + 1; j < m.steps.length; j++) {
          if (r.steps[m.steps[j].id]) continue;
          cand.push(j);
          if (!m.steps[j].optional) break;
        }
      }
      var hit = -1;
      for (var c = 0; c < cand.length; c++) { if (safeCheck(m, r, m.steps[cand[c]], ev)) { hit = cand[c]; break; } }
      if (hit < 0) break;
      for (var s = 0; s < cand.length; s++) { if (cand[s] === hit) break; markDone(m, r, cand[s], true, ev); }
      markDone(m, r, hit, false, ev);
      progressed = true;
      ev = null;
    }
    return progressed;
  }

  var NONASCII = /[^\u0000-\u007f]|　/;
  function computeNudge(m, r, ev) {
    var idx = firstUndone(m, r);
    if (idx < 0) return '';
    var step = m.steps[idx];
    var start = r.stepStart[step.id] || r.startSeq || 0;
    var t = null;
    if (ev && step.trap) {
      try { t = withCtx(m, r, step, function () { return step.trap(ev, api); }); } catch (e) { t = null; }
      if (t) return String(t);
    }
    var run = LAB.bus.find('term:run', null, start);
    if (run && run.data) {
      var cmds = run.data.cmds || [];
      for (var i = 0; i < cmds.length; i++) {
        // Windows: an unknown command is status 1 (the Mac used 127), so any failed command with a non-ASCII name counts
        if (cmds[i].status && NONASCII.test(String(cmds[i].name || ''))) return '看起來輸入法是中文，或是空格是全形。把工作列右下角的「中」切成「英」（按一下 Shift），再打一次。';
      }
      for (var k = 0; k < cmds.length; k++) {
        // PowerShell (zh-TW) says 找不到 '…' 路徑，因為它不存在。 (win-facts §5.1); the Mac said no such file or directory
        if (cmds[k].status && /找不到[\s\S]*?路徑，因為它不存在|no such file or directory/i.test(String(cmds[k].out || ''))) return '印出「找不到…路徑，因為它不存在」，多半是拼錯字，或你人不在預期的資料夾。看提示字元，再用 ls 看看。';
      }
    }
    // the student ran ahead: a later step is already satisfied while this one still waits
    if (ev && ev.name === 'term:run') {
      for (var j = idx + 1; j < m.steps.length; j++) {
        if (m.steps[j].optional || r.steps[m.steps[j].id]) continue;
        if (safeCheck(m, r, m.steps[j], ev)) return '你先做了後面的步驟，不過卡片要照順序打勾。回到第 ' + (idx + 1) + ' 步：' + step.text;
      }
    }
    return '';
  }
  /* a mission can declare files it cannot go on without (m.needs): Project dragged into a Finder window, trashed or renamed away */
  function needsNudge(m) {
    if (!m.needs || !m.needs.length) return '';
    for (var i = 0; i < m.needs.length; i++) {
      var p = m.needs[i];
      if (LAB.vfs.exists(p)) continue;
      var name = LAB.vfs.basename(p);
      return '「' + name + '」不在原本的位置了。如果是剛剛不小心拖走或丟進資源回收筒，按 Ctrl+Z 還原，或把它拖回桌面；也可以按下面的「重來這個任務」，它會放回來。';
    }
    return '';
  }
  function whereNudge(step) {
    var w = step.where;
    if (!w) return '先看提示字元最後面的資料夾名稱，確認你人在哪個資料夾。';
    var name = LAB.vfs.canon(w) === LAB.vfs.HOME ? '~' : LAB.vfs.basename(w);
    return '這一步需要在 ' + name + ' 裡輸入，先看提示字元最後面的資料夾名稱。';
  }

  function evaluate(item) {
    var m = missions.current();
    if (!m) return;
    var r = rec(m.id);
    if (!r.startedAt) return;
    var ev = { name: item.name, data: item.data };
    var before = firstUndone(m, r);
    var progressed = tryAdvance(m, r, ev);
    var idx = firstUndone(m, r);
    if (progressed && idx >= 0) setPeek('第 ' + idx + ' 步完成。下一步：' + plain(m.steps[idx].text));
    else if (idx < 0) clearPeek();
    if (idx >= 0) {
      var t = computeNudge(m, r, ev);
      var fromNeeds = false;
      if (!t) { t = needsNudge(m); fromNeeds = !!t; }
      var stepId = m.steps[idx].id;
      if (t && ev.name === 'term:run') nudgeShut = '';
      if (t) { if (nudge.text !== t || nudge.stepId !== stepId) { nudge = { stepId: stepId, text: t, needs: fromNeeds }; announce(t); } }
      else if (ev.name === 'term:run' || nudge.stepId !== stepId || nudge.needs) nudge = { stepId: stepId, text: '' };
    } else nudge = { stepId: null, text: '' };
    if (before !== idx || true) render();
  }

  /* closed drawer (viewport narrower than 1366 px): say it on the strip, or the student never sees a tick or a nudge */
  function plain(str) { return String(str).replace(/\[\[([\s\S]+?)\]\]/g, '$1').replace(/`([^`]+)`/g, '$1'); }
  function clearPeek() { peek = null; if (peekTimer) { clearTimeout(peekTimer); peekTimer = null; } }
  function setPeek(text) {
    var id = ++peekSeq;
    peek = { id: id, text: text, at: Date.now() };
    if (peekTimer) clearTimeout(peekTimer);
    peekTimer = setTimeout(function () { if (peek && peek.id === id) { peek = null; render(); } }, 9000);
  }
  function nudgeKey() { return nudge.text ? nudge.stepId + '|' + nudge.text : ''; }

  function drain() {
    if (draining) return;
    draining = true;
    try { while (queue.length) evaluate(queue.shift()); }
    finally { draining = false; }
  }

  LAB.bus.on('*', function (name, payload) {
    cueSoon();                                  // something happened on the Mac: the thing a step points at may have moved, opened or closed
    if (name.indexOf('mission:') === 0) return;
    if (preparing) return;
    if (!data.current) return;
    var seq = LAB.bus.seq();
    var hist = LAB.bus.history;
    for (var i = hist.length - 1; i >= 0 && i >= hist.length - 6; i--) { if (hist[i].name === name && hist[i].data === payload) { seq = hist[i].seq; break; } }
    queue.push({ name: name, data: payload, seq: seq });
    drain();
  });

  /* ------------------------------------------------------ start / reset */
  function runPrepare(m, r) {
    preparing = true;
    r.startedAt = LAB.clock.ms();
    try { withCtx(m, r, null, function () { if (m.prepare) m.prepare(api); }); }
    catch (e) { console.warn('[missions] prepare failed', m.id, e); }
    finally { preparing = false; }
    r.startSeq = LAB.bus.seq();
    startStepClock(m, r);
  }

  missions.start = function (id) {
    var m = missions.get(id);
    if (!m) return false;
    var r = rec(id);
    data.current = id;
    nudge = { stepId: null, text: '' };
    clearPeek(); nudgeShut = '';
    var first = !r.startedAt;
    if (first) runPrepare(m, r); else startStepClock(m, r);
    LAB.bus.emit('mission:start', { missionId: id });
    // steps that state (or replay history) already satisfies complete at once
    tryAdvance(m, r, null);
    ui.copied = null;
    touch();
    render();
    revealRail();
    return true;
  };
  /* Below 1366 px the card is a drawer that starts closed: open it when a mission starts, or the student sees a bare desktop.
     (Clicking the Mac folds it away again; the strip keeps saying 「任務卡」.) */
  function revealRail() {
    try { if (LAB.layout && LAB.layout.railMode() === 'drawer' && !LAB.layout.isDrawerOpen()) LAB.layout.openDrawer(); } catch (e) { /* ignore */ }
  }
  missions.reset = function (id) {
    var m = missions.get(id);
    if (!m) return false;
    var r = newRec();
    data.missions[id] = r;
    stepStartMs = {};
    nudge = { stepId: null, text: '' };
    clearPeek(); nudgeShut = '';
    if (data.current !== id) data.current = id;
    runPrepare(m, r);
    LAB.bus.emit('mission:reset', { missionId: id });
    tryAdvance(m, r, null);
    touch();
    render();
    return true;
  };

  /* ---------------------------------------------------------- progress code */
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function stamp(ms) {
    var d = new Date(ms);
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }
  // Windows codes start with LABw1. (boot.js sets LAB.progressPrefix) so a teacher can tell them from the Mac's LABv1.; a LABv1. code is still read
  function codePrefix() { return LAB.progressPrefix || 'LABw1.'; }
  missions.progressCode = function () {
    var obj = { m: {}, t: Math.floor(LAB.clock.ms() / 1000) };
    registry.forEach(function (m) {
      var r = data.missions[m.id];
      if (r && r.startedAt) obj.m[m.id] = r.doneAt ? Math.floor(r.doneAt / 1000) : 0;
    });
    return codePrefix() + btoa(JSON.stringify(obj));
  };
  missions.importProgressCode = function (str) {
    str = String(str || '').trim();
    var pre = str.indexOf(codePrefix()) === 0 ? codePrefix() : (str.indexOf('LABv1.') === 0 ? 'LABv1.' : '');
    if (!pre) return { ok: false, message: '這不是進度代碼（要以 ' + codePrefix() + ' 開頭）。', summary: '' };
    var obj;
    try { obj = JSON.parse(atob(str.slice(pre.length))); } catch (e) { return { ok: false, message: '進度代碼讀不懂，請確認有完整複製。', summary: '' }; }
    if (!isObj(obj) || !isObj(obj.m)) return { ok: false, message: '進度代碼的格式不對。', summary: '' };
    var lines = [], changed = 0;
    registry.forEach(function (m, idx) {
      if (!Object.prototype.hasOwnProperty.call(obj.m, m.id)) return;
      var v = obj.m[m.id];
      if (typeof v !== 'number' || !isFinite(v) || Math.floor(v) !== v) return;
      // 0 = started, not finished; otherwise a real moment between 2001 and tomorrow (a forged or damaged code is ignored)
      if (v !== 0 && (v < 1e9 || v > Math.floor(LAB.clock.ms() / 1000) + 86400)) return;
      var label = '第 ' + (idx + 1) + ' 個任務';
      if (v > 0) {
        lines.push(label + '　完成　' + stamp(v * 1000));
        var r = rec(m.id);
        if (!r.doneAt) { r.doneAt = v * 1000; if (!r.startedAt) r.startedAt = v * 1000; changed++; }
      } else lines.push(label + '　已開始，還沒完成');
    });
    touch();
    render();
    var summary = lines.join('\n');
    if (!lines.length) return { ok: true, message: '這個代碼裡沒有認得的任務。', summary: '' };
    return { ok: true, message: changed ? '已匯入，已完成的任務會顯示為完成。' : '已讀取（沒有需要更新的任務）。', summary: summary };
  };

  /* ================================================================= UI */
  function inline(str, labHook) {
    var out = [];
    var re = /\[\[([\s\S]+?)\]\]|`([^`]+)`/g, last = 0, m;
    str = String(str);
    while ((m = re.exec(str)) !== null) {
      if (m.index > last) out.push(document.createTextNode(str.slice(last, m.index)));
      if (m[1] !== undefined) {
        var sentence = m[1];
        var link = h('button', { type: 'button', class: 'lab-linkbtn lab-copy', dataset: { lab: labHook || 'rail-copy' }, 'data-fk': 'copy:' + sentence.slice(0, 8) }, ui.copied === sentence ? '已複製' : '複製');
        link.addEventListener('click', function (s, el) {
          return function () {
            LAB.clipboard.setText(s).then(function (ok) {
              ui.copied = ok ? s : null;
              el.textContent = ok ? '已複製' : '沒複製成功：請自己選取旁邊這句，按 Ctrl+C';
            });
          };
        }(sentence, link));
        out.push(h('span', { class: 'lab-copyline' }, h('span', { class: 'lab-mono' }, sentence), ' ', link));
      } else out.push(h('span', { class: 'lab-mono' }, m[2]));
      last = re.lastIndex;
    }
    if (last < str.length) out.push(document.createTextNode(str.slice(last)));
    return out;
  }

  function nextMission(m) {
    var i = registry.indexOf(m);
    return i >= 0 && i + 1 < registry.length ? registry[i + 1] : null;
  }

  function stripText() {
    var m = missions.current();
    if (!m) return '選一個任務';
    var r = rec(m.id);
    if (r.doneAt) return '任務完成';
    var total = m.steps.length;
    return '第 ' + Math.min(doneCount(m, r) + 1, total) + ' / ' + total + ' 步';
  }

  function hintReady(m, r) {
    var i = firstUndone(m, r);
    if (i < 0) return false;
    var t = stepStartMs[m.id + '/' + m.steps[i].id];
    return !!t && Date.now() - t >= 60000;
  }

  function signature() {
    var m = missions.current();
    var r = m ? rec(m.id) : null;
    return JSON.stringify([
      data.current, LAB.layout ? LAB.layout.railMode() : '', LAB.layout ? LAB.layout.isDrawerOpen() : false,
      ui.mapOpen, ui.codeOpen, ui.copied, !!(LAB.sfx && LAB.sfx.enabled),
      r ? [r.steps, r.skipped, r.hints, r.doneAt, m ? hintReady(m, r) : false] : null,
      nudge, peek && peek.id, nudgeShut, registry.length, LAB.store.noticeText, registry.map(function (x) { var q = data.missions[x.id]; return q ? [q.doneAt, q.startedAt ? 1 : 0] : 0; })
    ]);
  }

  function link(label, fk, fn, attrs) {
    var a = h('button', Object.assign({ type: 'button', class: 'lab-linkbtn', 'data-fk': fk }, attrs || {}), label);
    a.addEventListener('click', fn);
    return a;
  }

  function render(force) {
    if (!rail) return;
    var sig = signature();
    if (!force && sig === lastSig) { updateStrip(); return; }
    lastSig = sig;
    var activeKey = null;
    if (document.activeElement && rail.contains(document.activeElement)) activeKey = document.activeElement.getAttribute('data-fk');
    var scroller = rail.querySelector('.lab-rail-scroll');
    var scrollTop = scroller ? scroller.scrollTop : 0;

    var m = missions.current();
    var r = m ? rec(m.id) : null;
    var mode = LAB.layout.railMode();
    var open = LAB.layout.isDrawerOpen();

    // strip (drawer mode, closed)
    var bubbleText = '', bubbleKind = '';
    if (mode === 'drawer' && !open && m && r) {
      var ci = firstUndone(m, r);
      if (nudge.text && ci >= 0 && nudge.stepId === m.steps[ci].id && nudgeKey() !== nudgeShut) { bubbleText = nudge.text; bubbleKind = 'nudge'; }
      else if (peek && ci >= 0) { bubbleText = peek.text; bubbleKind = 'ok'; }
    }
    var attn = !!(mode === 'drawer' && !open && m && r && (bubbleText || r.doneAt));
    var curStepText = '';
    if (m && r && !r.doneAt && firstUndone(m, r) >= 0) curStepText = plain(m.steps[firstUndone(m, r)].text);
    // which face of the card is showing: the full card or the pill. Only a change between them animates (render rebuilds the card often)
    var face = (mode === 'drawer' && !open) ? 'pill' : 'card';
    var entering = lastFace !== null && lastFace !== face;
    lastFace = face;
    // a step was just ticked while only the pill shows: its dot flashes green and the pill hops twice (a re-render continues it, --lab-age)
    var stepAge = Date.now() - lastStepAt;
    var stepped = face === 'pill' && lastStepAt && stepAge < 900;
    var strip = h('button', { type: 'button', class: 'lab-rail-strip lab-glass' + (attn ? ' is-attn' : '') + (entering && face === 'pill' ? ' is-entering' : '') + (stepped ? ' is-stepped' : ''),
      'aria-label': '展開任務卡' + (curStepText ? '。目前這一步：' + curStepText : ''), title: curStepText || null,
      'data-lab': 'rail-strip', 'data-fk': 'strip' },
      h('span', { class: 'lab-rail-chev', 'aria-hidden': 'true' }, '›'),
      h('span', { class: 'lab-rail-dot', 'aria-hidden': 'true' }),
      h('span', { class: 'lab-rail-tag' }, '任務卡'), h('span', { class: 'lab-rail-vert' }, stripText()));
    if (stepped) strip.style.setProperty('--lab-age', (-stepAge) + 'ms');
    // before a mission is chosen the pill opens the picker (§19.2); afterwards it opens the card
    strip.addEventListener('click', function () {
      if (!missions.current() && registry.length && !sheetBusy()) openPicker({});
      else LAB.layout.openDrawer();
    });
    var bubble = null;
    if (bubbleText) {
      var bmain = h('button', { type: 'button', class: 'lab-peek-main', 'data-fk': 'peek', 'aria-label': '打開任務卡。' + bubbleText },
        h('span', { class: 'lab-peek-eyebrow' }, bubbleKind === 'nudge' ? '提醒' : [greenCheck(peek && peek.at), '做好了']),
        h('span', { class: 'lab-peek-text' }, bubbleText));
      bmain.addEventListener('click', function () { LAB.layout.openDrawer(); });
      bubble = h('div', { class: 'lab-peek lab-glass is-' + bubbleKind, dataset: { lab: 'rail-peek', kind: bubbleKind } }, bmain);
      if (bubbleKind === 'nudge') {
        var bx = h('button', { type: 'button', class: 'lab-peek-x', 'aria-label': '先關掉這個提醒', 'data-fk': 'peekx' }, '×');
        bx.addEventListener('click', function () { nudgeShut = nudgeKey(); render(true); });
        bubble.appendChild(bx);
      }
    }

    // header
    // pinned: the card stays open. Drawer: it folds into the pill whenever the student clicks the Mac
    var ctl = [];
    if (mode === 'pinned') ctl.push(link('收起', 'pin', function () { LAB.layout.setRailMode('drawer'); }, { 'data-lab': 'rail-pin', title: '收成右上角的小卡片，點一下再打開' }));
    else {
      ctl.push(link('收起', 'close', function () { LAB.layout.closeDrawer(); }, { 'data-lab': 'rail-close' }));
      ctl.push(link('釘住', 'pin', function () { LAB.layout.setRailMode('pinned'); }, { 'data-lab': 'rail-pin', title: '一直開著，點桌面時不收起' }));
    }
    // the title row is the handle for dragging the card (a double click puts it back in the top-right corner)
    var head = h('div', { class: 'lab-rail-head', title: '按住拖曳可以移動任務卡；連點兩下回到右上角' },
      h('a', { class: 'lab-rail-link', href: '../../weeks/week03/' }, '← Week 3'),
      h('span', { class: 'lab-rail-label' }, '練習用的電腦'),
      h('span', { class: 'lab-rail-ctl' }, ctl));

    // the header is the card's own title row (outside the scroller): 收起 / 釘住 stay reachable and nothing scrolls under it
    var parts = [];

    // the mission picker button (the list of missions lives in the picker sheet, §19.2)
    if (registry.length) {
      var pickBtn = h('button', { type: 'button', class: 'lab-pickrow', 'aria-haspopup': 'dialog', 'data-fk': 'pick', dataset: { lab: 'rail-pick' } },
        h('span', { class: 'lab-pickrow-n' }, m ? '任務 ' + (registry.indexOf(m) + 1) + ' / ' + registry.length : '還沒選任務'),
        h('span', { class: 'lab-pickrow-dot', 'aria-hidden': 'true' }, ' · '),
        h('span', { class: 'lab-pickrow-go' }, m ? '換任務' : '選一個任務'));
      pickBtn.addEventListener('click', function () { if (!sheetBusy()) openPicker({}); });
      parts.push(h('div', { class: 'lab-sec lab-sec-list' }, pickBtn));
    }

    // current mission
    if (m && r) {
      var cur = h('div', { class: 'lab-sec lab-sec-cur' },
        h('div', { class: 'lab-eyebrow' }, sheetEyebrow(m)),
        h('h2', { class: 'lab-mtitle' }, m.title),
        h('p', { class: 'lab-intro' }, inline(m.intro || '')));
      if (m.resetsFiles) cur.appendChild(h('p', { class: 'lab-muted' }, '開始這個任務會把相關檔案恢復到起始狀態。'));
      if (m.map) {
        var md = h('button', { type: 'button', class: 'lab-disc lab-disc-sm', 'aria-expanded': ui.mapOpen ? 'true' : 'false', 'data-fk': 'map', dataset: { lab: 'rail-map' } },
          h('span', { class: 'lab-disc-t' }, '地圖'), h('span', { class: 'lab-disc-chev', 'aria-hidden': 'true' }, ui.mapOpen ? '–' : '+'));
        md.addEventListener('click', function () { ui.mapOpen = !ui.mapOpen; render(true); });
        cur.appendChild(md);
        if (ui.mapOpen) cur.appendChild(h('p', { class: 'lab-mapline' }, inline(m.map)));
      }
      parts.push(cur);

      {
        var curIdx = firstUndone(m, r);
        // the step that just became current bounces in (§19.4); it waits while a sheet is still on screen
        var curKey = curIdx >= 0 ? m.id + '/' + m.steps[curIdx].id : '';
        if (curKey !== enter.key) enter = { key: curKey, at: 0 };
        if (curKey && !enter.at && !sheet && !firstPending) enter.at = Date.now();
        var enterAge = enter.at ? Date.now() - enter.at : Infinity;
        var steps = h('ol', { class: 'lab-steps' });
        m.steps.forEach(function (st, i) {
          var done = !!r.steps[st.id];
          var skipped = done && !!r.skipped[st.id];
          var isCur = i === curIdx;
          var tickedAt = done && !skipped ? justDone[m.id + '/' + st.id] : 0;
          var li = h('li', {
            class: 'lab-step' + (done ? ' is-done' : '') + (skipped ? ' is-skipped' : '') + (isCur ? ' is-current' : '') +
              (tickedAt && Date.now() - tickedAt < POP_MS ? ' is-justdone' : '') +
              (isCur && enterAge < 900 ? ' is-enter' : '') + (isCur && curKey && !enter.at ? ' is-waiting' : ''),
            dataset: { lab: 'step', step: st.id, done: done ? 'true' : 'false', skipped: skipped ? 'true' : 'false' }
          },
            h('span', { class: 'lab-num' + (done && !skipped ? ' is-check' : '') + (skipped ? ' is-skip' : '') }, skipped ? '–' : (done ? greenCheck(tickedAt, true) : pad2(i + 1))),
            h('div', { class: 'lab-step-body' },
              h('div', { class: 'lab-step-text' }, inline(st.text), st.optional && (!done || skipped) ? h('span', { class: 'lab-opt' }, skipped ? '（選做，略過了）' : '（選做）') : null)));
          if (isCur && enterAge < 900) li.style.setProperty('--lab-age', (-enterAge) + 'ms');
          if (isCur) {
            var body = li.querySelector('.lab-step-body');
            var level = r.hints[st.id] || 0;
            var bar = h('div', { class: 'lab-hintbar' });
            var hl = link('提示', 'hint', function () { r.hints[st.id] = Math.max(1, r.hints[st.id] || 0); touch(); render(true); },
              { 'data-lab': 'hint-link', class: 'lab-linkbtn' + (hintReady(m, r) && level === 0 ? ' is-ready' : '') });
            bar.appendChild(hl);
            if (st.optional) bar.appendChild(link('略過這一步', 'skip', function () { markDone(m, r, i, true, null); nudge = { stepId: null, text: '' }; render(true); },
              { 'data-lab': 'rail-skip' }));
            body.appendChild(bar);
            if (level >= 1) {
              body.appendChild(h('p', { class: 'lab-hinttext', dataset: { lab: 'rail-hint' } }, inline(st.hint || '')));
              if (level < 2) body.appendChild(link('直接告訴我答案', 'answer', function () { r.hints[st.id] = 2; touch(); render(true); }, { 'data-lab': 'rail-answer-link' }));
            }
            if (level >= 2) body.appendChild(h('p', { class: 'lab-answertext', dataset: { lab: 'rail-answer' } }, inline(st.answer || '')));
            if (nudge.text && nudge.stepId === st.id) body.appendChild(h('p', { class: 'lab-nudge', dataset: { lab: 'rail-nudge' } }, inline(nudge.text)));
          }
          steps.appendChild(li);
        });
        parts.push(h('div', { class: 'lab-sec lab-sec-steps' }, steps));
      }

      // progress + footer links
      var total = m.steps.length, dn = doneCount(m, r);
      // the line grows to its new length and a light sweeps over it; the count pops (§19.5). A re-render continues both (--lab-age)
      var frac = total ? dn / total : 0;
      var pa = progAnim[m.id];
      if (!pa) pa = progAnim[m.id] = { from: frac, to: frac, at: 0 };
      if (pa.to !== frac) { pa.from = pa.to; pa.to = frac; pa.at = frac > pa.from ? Date.now() : 0; }
      var pAge = pa.at ? Date.now() - pa.at : Infinity;
      var growing = pAge < 900;
      var fill = h('div', { class: 'lab-prog-fill' + (growing ? ' is-grow' : '') });
      fill.style.setProperty('--to', String(frac));
      fill.style.setProperty('--from', String(growing ? pa.from : frac));
      var progEl = h('div', { class: 'lab-prog', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(total), 'aria-valuenow': String(dn), 'aria-label': '任務進度' }, fill);
      var countN = h('span', { class: 'lab-prog-n' + (pAge < 600 ? ' is-pop' : '') }, String(dn));
      if (growing) {
        var sweep = h('i', { class: 'lab-prog-sweep', 'aria-hidden': 'true' });
        progEl.appendChild(sweep);
        progEl.style.setProperty('--lab-age', (-pAge) + 'ms');
        countN.style.setProperty('--lab-age', (-pAge) + 'ms');
      }
      var prog = h('div', { class: 'lab-sec lab-sec-foot' }, progEl,
        h('div', { class: 'lab-prog-text' }, '已完成 ', countN, ' / ' + total + ' 步'));
      if (r.doneAt) {
        prog.appendChild(h('p', { class: 'lab-outro', dataset: { lab: 'rail-outro' } }, inline(m.outro || '這個任務完成了。')));
        var nx = nextMission(m);
        if (nx) {
          var nb = h('button', { type: 'button', class: 'lab-nextbtn', 'data-fk': 'next', dataset: { lab: 'rail-next' } }, '下一個任務 →');
          nb.addEventListener('click', function () {
            if (sheetBusy()) return;
            // with ?intro=0 / ?welcome=0 the mission just starts; otherwise its start page opens (and starts it on 「開始任務」)
            if (missions.skipIntro || missions.skipWelcome) missions.start(nx.id);
            else openPicker({ id: nx.id });
          });
          prog.appendChild(nb);
        }
      }
      parts.push(prog);
    } else if (!registry.length) {
      parts.push(h('div', { class: 'lab-sec' }, h('p', { class: 'lab-muted' }, '目前還沒有任務。')));
    }

    // links
    var links = h('div', { class: 'lab-foot-links' });
    if (m) links.appendChild(link('重來這個任務', 'redo', function () { missions.reset(m.id); }, { 'data-lab': 'rail-redo' }));
    var soundOn = !!(LAB.sfx && LAB.sfx.enabled);
    links.appendChild(link('聲音：' + (soundOn ? '開' : '關'), 'sound', function () {
      LAB.sfx.enabled = !LAB.sfx.enabled;
      if (LAB.sfx.enabled) LAB.sfx('step');              // a tick to hear what it sounds like
      render(true);
    }, { 'data-lab': 'rail-sound', 'aria-pressed': soundOn ? 'true' : 'false', title: '步驟完成和任務完成時的提示音；只在這次造訪有效' }));
    if (LAB.layout && LAB.layout.canFullscreen && LAB.layout.canFullscreen()) {
      links.appendChild(link('全螢幕', 'fullscreen', function () { LAB.layout.toggleFullscreen(); }, { 'data-lab': 'rail-fullscreen', title: '把練習用的電腦放大到整個螢幕；按 Esc 離開' }));
    }
    links.appendChild(link('進度代碼', 'code', function () { ui.codeOpen = !ui.codeOpen; render(true); }, { 'data-lab': 'rail-code-toggle' }));
    links.appendChild(link('重設全部', 'resetall', function () {
      LAB.ui.confirm(null, { title: '要重設全部嗎？', text: '這會清除你在這個練習裡建立的檔案、對話和任務進度，無法復原。', ok: '重設', cancel: '取消', danger: true })
        .then(function (ok) { if (ok) LAB.store.reset('all'); });
    }, { 'data-lab': 'rail-reset-all' }));
    parts.push(h('div', { class: 'lab-sec lab-sec-links' }, links));
    if (ui.codeOpen) {
      var codeVal = missions.progressCode();
      var cl = h('div', { class: 'lab-codeline' },
        h('input', { type: 'text', class: 'lab-codeinput', readonly: 'readonly', value: codeVal, 'aria-label': '進度代碼', dataset: { lab: 'rail-code' } }),
        link('複製', 'codecopy', function () { LAB.clipboard.setText(codeVal); }));
      parts.push(h('div', { class: 'lab-sec' }, cl, h('p', { class: 'lab-muted' }, '要給老師看這次完成了哪些任務，複製這串進度代碼。')));
    }

    // page footer
    var foot = h('div', { class: 'lab-page-foot' },
      h('div', null, 'Copyright © 2026 JUNHAO CHEN'),
      LAB.store.noticeText ? h('div', { class: 'lab-store-notice', dataset: { lab: 'rail-notice' } }, LAB.store.noticeText) : null,
      h('div', { class: 'lab-muted' }, '每次進來都是一台全新的電腦。重新整理或離開這一頁，這次的進度就不會留下。'));
    parts.push(foot);

    var scroll = h('div', { class: 'lab-rail-scroll' }, parts);
    var bodyEl = h('div', { class: 'lab-rail-body lab-glass lab-glass-calm' + (entering && face === 'card' ? ' is-entering' : ''), 'aria-hidden': (mode === 'drawer' && !open) ? 'true' : null }, head, scroll);
    if (mode === 'drawer' && !open) bodyEl.setAttribute('inert', '');
    rail.textContent = '';
    rail.appendChild(strip);
    if (bubble) rail.appendChild(bubble);
    rail.appendChild(bodyEl);
    if (liveEl) rail.appendChild(liveEl);
    scroll.scrollTop = scrollTop;
    keepStepInView(scroll, m ? m.id : null);
    if (outroPending) {
      var outro = scroll.querySelector('[data-lab="rail-next"]') || scroll.querySelector('[data-lab="rail-outro"]');
      if (outro && scroll.clientHeight) {
        var sr2 = scroll.getBoundingClientRect(), or2 = outro.getBoundingClientRect();
        var sc2 = sr2.height && scroll.offsetHeight ? sr2.height / scroll.offsetHeight : 1;
        var bottom2 = (or2.bottom - sr2.top) / sc2 + scroll.scrollTop;
        if (bottom2 > scroll.clientHeight - 16) scroll.scrollTop = bottom2 - scroll.clientHeight + 24;
        outroPending = false;
      } else if (!m || !r || !r.doneAt) outroPending = false;
    }
    if (activeKey) {
      var again = rail.querySelector('[data-fk="' + activeKey.replace(/"/g, '\\"') + '"]');
      if (again) { try { again.focus({ preventScroll: true }); } catch (e) { again.focus(); } }
    }
    cueSoon();
  }
  /* A new mission starts at the top of the card; otherwise the current step is kept inside the visible part of the card
     (the mission list and the intro above it are tall, so without this the step would sit below the fold). */
  var lastScrollMission = null;
  function keepStepInView(scroll, missionId) {
    if (missionId !== lastScrollMission) {
      lastScrollMission = missionId;
      scroll.scrollTop = 0;
    }
    var cur = scroll.querySelector('[data-lab="step"][data-done="false"]');
    if (!cur || !scroll.clientHeight) return;
    var sr = scroll.getBoundingClientRect();
    var cr = cur.getBoundingClientRect();
    var scale = sr.height && scroll.offsetHeight ? sr.height / scroll.offsetHeight : 1;
    var top = (cr.top - sr.top) / scale + scroll.scrollTop;      // step top inside the scrolled content
    var bottom = (cr.bottom - sr.top) / scale + scroll.scrollTop;
    var view = scroll.clientHeight;
    if (top < scroll.scrollTop + 8) scroll.scrollTop = Math.max(0, top - 16);
    else if (bottom > scroll.scrollTop + view - 8) scroll.scrollTop = Math.min(top - 16, bottom - view + 24);
  }
  function updateStrip() {
    var v = rail && rail.querySelector('.lab-rail-vert');
    if (v) v.textContent = stripText();
  }
  missions.render = function () { render(); };

  LAB.bus.on('mission:step', function (p) { if (p && !p.skipped && LAB.sfx) LAB.sfx('step'); });      // a step ticked (a skipped one is not a success)
  LAB.bus.on('mission:complete', function (p) { clearPeek(); outroPending = true; revealRail(); scheduleDoneSheet(p && p.missionId); });
  LAB.bus.on('rail:layout', function () { render(true); });
  LAB.bus.on('store:notice', function () { render(true); });
  LAB.bus.on('store:reset', function () { nudge = { stepId: null, text: '' }; clearPeek(); nudgeShut = ''; render(true); });

  /* ----------------------------------------------------- mission sheets (DESIGN §18.2, §19.2) */
  /* A large ContentDialog in the middle of the PC (white, 8 px, a grey footer band; the card's acrylic is only for the card). Two kinds:
       'pick'  the mission picker (§19.2): the list of missions by group, and, in the same sheet, a mission's start page
               (「← 選別的任務」 goes back). Opens after the connecting screen, from the card (「換任務」), from the pill
               before a mission is chosen and from the completion sheet (「選其他任務」).
       'done'  a mission just finished (「開始下一個任務」 / 「選其他任務」) with paper confetti
     Starting closes the sheet by flying it into the card (FLIP), then the card does one small bump. The sheets live in the
     UI handlers, never in missions.start(), so tests and tools that call start() programmatically never see one.
     ?welcome=0 suppresses every automatic sheet (a click on the card's 「換任務」 still opens the picker, and picking starts at once);
     ?intro=0 suppresses the start page and the completion sheet (picking starts at once) but not the first picker. */
  var sheet = null;                          // the sheet on screen: {kind, scrim, panel, view, spec, primary, off, prev, closing, swapping}
  var firstPending = false;                  // the first sheet is still waiting for the connecting screen / phone notice
  var SHEET_FLY_MS = 460;

  function reducedMotion() {
    try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; }
  }
  missions.sheetOpen = function () { return sheet && !sheet.closing ? sheet.kind : null; };
  function sheetBusy() { return !!(sheet && !sheet.closing); }      // a sheet that is already flying away does not block the next one

  /* where the sheet should land: the open card (or, if only the pill is showing, the pill), in viewport px */
  function cardTarget() {
    if (!rail) return null;
    var els = [rail.querySelector('.lab-rail-body'), rail.querySelector('.lab-rail-strip')];
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (!el) continue;
      var r = el.getBoundingClientRect();
      var vis = true;
      try { vis = window.getComputedStyle(el).visibility !== 'hidden'; } catch (e) { /* ignore */ }
      if (vis && r.width > 8 && r.height > 8) return { el: el, rect: r };
    }
    return null;
  }
  /* the card waits a little dimmed while the sheet flies in, then lights up with one small bump (render() rebuilds the card,
     so it is looked up again). Plain fades when the visitor asked for less motion. */
  function landedBump(wasDimmed) {
    if (reducedMotion()) return;
    var t = cardTarget();
    if (!t || !t.el.animate) return;
    var from = wasDimmed ? 0.3 : 1;
    try {
      t.el.animate([
        { transform: 'scale(1)', transformOrigin: '50% 50%', opacity: from },
        { transform: 'scale(1.025)', transformOrigin: '50% 50%', opacity: 1, offset: 0.4 },
        { transform: 'scale(1)', transformOrigin: '50% 50%', opacity: 1 }
      ], { duration: 350, easing: 'cubic-bezier(.3, .7, .3, 1)' });
    } catch (e) { /* ignore */ }
  }

  /* close the sheet. how: 'fly' = into the card (the mission is already current), 'fade' = just away */
  function closeSheet(how) {
    var s = sheet;
    if (!s || s.closing) return;
    s.closing = true;
    if (s.stopConfetti) s.stopConfetti();
    if (s.off) s.off();
    var panel = s.panel, scrim = s.scrim;
    panel.removeAttribute('role'); panel.removeAttribute('aria-modal');
    panel.setAttribute('aria-hidden', 'true'); panel.setAttribute('inert', '');
    scrim.classList.add('is-leaving');
    panel.style.animation = 'none';
    scrim.style.animation = 'none';
    try { if (s.prev && s.prev.focus && document.contains(s.prev)) s.prev.focus(); } catch (e) { /* ignore */ }
    var reduced = reducedMotion();
    var ms = reduced ? 160 : (how === 'fly' ? SHEET_FLY_MS : 220);
    var flew = false, dimAnim = null;
    var bumped = false;
    function bump() {                                  // the card lights up while the sheet is still fading into it
      if (bumped) return;
      bumped = true;
      if (dimAnim) { try { dimAnim.cancel(); } catch (e) { /* ignore */ } }
      if (flew) landedBump(!!dimAnim);
    }
    function finish() {
      if (s.finished) return;
      s.finished = true;
      if (scrim.parentNode) scrim.parentNode.removeChild(scrim);
      if (sheet === s) sheet = null;
      bump();
      sheetGone();
    }
    if (!panel.animate) { flew = how === 'fly'; finish(); return; }
    var panelAnim;
    if (how === 'fly' && !reduced) {
      // Make sure the card is open (narrow screens: the drawer), then aim at the card's rectangle on screen.
      revealRail();
      var tgt = cardTarget();
      if (tgt) {
        var p = panel.getBoundingClientRect(), c = tgt.rect;
        var sc = Math.min(1, c.width / p.width, c.height / p.height);
        var dx = (c.left + c.width / 2) - (p.left + p.width / 2);
        var dy = (c.top + c.height / 2) - (p.top + p.height / 2);
        flew = true;
        // the card already shows the new mission: keep it dim behind the sheet
        try { dimAnim = tgt.el.animate([{ opacity: 0.3 }, { opacity: 0.3 }], { duration: ms, fill: 'forwards' }); } catch (e2) { dimAnim = null; }
        // the position is eased (fast, then settling); the sheet stays solid until it is nearly there, then fades into the card
        panelAnim = panel.animate([
          { transform: 'translate(0px, 0px) scale(1)', opacity: 1 },
          { opacity: 1, offset: 0.88 },
          { transform: 'translate(' + dx + 'px, ' + dy + 'px) scale(' + sc + ')', opacity: 0 }
        ], { duration: ms, easing: 'cubic-bezier(.25, .75, .3, 1)', fill: 'forwards' });
        // its text fades out in the first third of the flight, so only the glass flies into the card (no double text over the card)
        [].forEach.call(panel.children, function (ch) {
          try { ch.animate([{ opacity: 1 }, { opacity: 0 }], { duration: Math.round(ms * 0.32), easing: 'ease-out', fill: 'forwards' }); } catch (e3) { /* ignore */ }
        });
      }
    }
    if (!panelAnim) {
      if (how === 'fly') flew = !reduced;
      panelAnim = panel.animate([{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: reduced ? 'scale(1)' : 'scale(.985)' }], { duration: ms, easing: 'ease-out', fill: 'forwards' });
    }
    scrim.animate([{ backgroundColor: 'rgba(0, 0, 0, .3)' }, { backgroundColor: 'rgba(0, 0, 0, 0)' }], { duration: Math.min(ms, 360), delay: reduced ? 0 : 40, easing: 'ease-out', fill: 'forwards' });
    panelAnim.onfinish = finish;
    if (flew && !reduced) setTimeout(bump, Math.round(ms * 0.7));
    setTimeout(finish, ms + 250);            // background tabs do not run animations
  }

  function nowMs() { return (window.performance && performance.now) ? performance.now() : Date.now(); }
  /* In fullscreen only the fullscreen element (the Mac's screen) is drawn, so the sheet has to live inside it then. */
  function sheetHost() { return document.fullscreenElement || document.getElementById('lab-modal-root'); }
  document.addEventListener('fullscreenchange', function () {
    if (!sheet || sheet.closing || sheet.finished) return;
    var host = sheetHost();
    if (!host || sheet.scrim.parentNode === host) return;
    host.appendChild(sheet.scrim);                       // moving the node drops focus
    focusView(sheet);
  });

  /* a sheet is gone for good: a step that was waiting for it may bounce in now, and the cues start again */
  function sheetGone() {
    cueBase = Date.now();
    if (enter.key && !enter.at) setTimeout(function () { if (!sheet) render(true); }, 120);
    cueSoon();
  }

  /* ---- one sheet, several views. A view is {kind, nodes, buttons, esc} (the completion sheet) or a picker view
     {kind:'pick', pick:true, view:'list'|'start', head, body, note, buttons, esc, arrows, first} (§19.2).
     A button is {label, lab, also, primary, text, run}: `also` wraps the label in a span that carries a second data-lab
     (the first picker's primary button answers to pick-start and to welcome-start). */
  function mkButton(b) {
    var el = h('button', { type: 'button', class: 'lab-ms-btn' + (b.primary ? ' is-primary' : '') + (b.text ? ' is-text' : ''), dataset: { lab: b.lab } });
    if (b.also) el.appendChild(h('span', { dataset: { lab: b.also } }, b.label)); else el.textContent = b.label;
    el.addEventListener('click', function () { if (sheet && !sheet.closing && !sheet.swapping && sheet.panel.contains(el)) b.run(); });
    return el;
  }

  /* put a view into the sheet's panel (replacing the one that is there) */
  function mountView(s, spec) {
    var btns = (spec.buttons || []).map(mkButton);
    var primary = null;
    (spec.buttons || []).forEach(function (b, i) { if (b.primary && !primary) primary = btns[i]; });
    var btnBox = btns.length ? h('div', { class: 'lab-ms-btns' }, btns) : null;
    var nodes;
    // a ContentDialog: the content on top; the buttons sit in a grey footer band, right-aligned (the first picker's reminder is above the band)
    if (spec.pick) {
      nodes = [spec.head, h('div', { class: 'lab-pk-scroll' }, spec.body), spec.note ? h('div', { class: 'lab-pk-notebox' }, spec.note) : null,
        h('div', { class: 'lab-ms-foot lab-pk-foot' }, btnBox)];
    } else {
      nodes = [h('div', { class: 'lab-ms-body' }, spec.nodes || []), btnBox ? h('div', { class: 'lab-ms-foot' }, btnBox) : null];
    }
    var view = h('div', { class: 'lab-ms-view', dataset: { view: spec.view || '' } }, nodes);
    if (s.view && s.view.parentNode === s.panel) s.panel.replaceChild(view, s.view); else s.panel.appendChild(view);
    s.view = view; s.spec = spec; s.primary = primary; s.viewAt = nowMs(); s.kind = spec.kind;
    s.focusEl = spec.focus || primary || btns[0] || null;
    var p = s.panel;
    p.setAttribute('data-kind', spec.kind);
    p.setAttribute('data-view', spec.view || '');
    if (spec.first) p.setAttribute('data-first', 'true'); else p.removeAttribute('data-first');
    p.classList.toggle('is-pick', !!spec.pick);
    p.classList.toggle('lab-welcome', !!spec.first);
  }
  function focusView(s) {
    var f = s.focusEl;
    if (f && document.contains(f)) { try { f.focus(); } catch (e) { /* ignore */ } }
  }

  /* swap the view in place: the old one fades out (80 ms), the new one fades in (100 ms) while the panel changes to its new
     size. No sliding. Without animations (reduced motion, slow computers) it is just a swap. */
  function swapView(s, spec) {
    if (!s || s !== sheet || s.closing || s.swapping) return;
    var panel = s.panel, old = s.view;
    if (reducedMotion() || !panel.animate || !old || !old.animate || (LAB.perf && LAB.perf.low)) { mountView(s, spec); focusView(s); return; }
    s.swapping = true;
    var w0 = panel.offsetWidth, h0 = panel.offsetHeight, swapped = false;
    function swap() {
      if (swapped) return;
      swapped = true;
      s.swapping = false;
      if (s.closing || sheet !== s) return;
      if (s.stopConfetti) s.stopConfetti();
      mountView(s, spec);
      var w1 = panel.offsetWidth, h1 = panel.offsetHeight;
      focusView(s);
      try {
        s.view.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 100, easing: 'ease-out' });
        if (Math.abs(w1 - w0) > 1 || Math.abs(h1 - h0) > 1) {
          panel.animate([{ width: w0 + 'px', height: h0 + 'px' }, { width: w1 + 'px', height: h1 + 'px' }], { duration: 100, easing: 'ease-out' });
        }
      } catch (e) { /* ignore */ }
    }
    try { old.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 80, easing: 'ease-out', fill: 'forwards' }).onfinish = swap; } catch (e2) { swap(); }
    setTimeout(swap, 180);                      // background tabs do not run animations
  }

  /* the keys of an open sheet. The Mac behind it must not react (⌘N, ⌃Space, ⇧⌘G …); the browser's own keys still work
     (reload, dev tools, zoom, find, address bar, print: the Mac binds none of them) */
  function tooSoon(s, e) {
    // a completion sheet pops up while the student may still be typing: Enter / Space in its first moments are theirs, not an answer
    return s.kind === 'done' && (e.repeat || nowMs() - s.viewAt < 600);
  }
  function focusRow(rows, n) {
    rows.forEach(function (rw, i) { rw.setAttribute('tabindex', i === n ? '0' : '-1'); });
    try { rows[n].focus(); } catch (e) { /* ignore */ }
  }
  function sheetKey(s, e) {
    var panel = s.panel;
    if (s.closing) return true;
    if (e.key === 'Escape') { if (!s.swapping && s.spec.esc) s.spec.esc(); return true; }
    if (e.key === 'Enter') {
      if (LAB.ui && LAB.ui.isImeEnter && LAB.ui.isImeEnter(e)) return false;
      var t = document.activeElement;
      // a focused row, back link or text button takes the key itself
      if (t && t.tagName === 'BUTTON' && panel.contains(t) && t !== s.primary) return false;
      if (s.swapping || tooSoon(s, e)) return true;
      if (s.primary) s.primary.click();
      return true;
    }
    if (e.metaKey || e.ctrlKey || e.altKey) {
      if (/^F\d+$/.test(e.key) || (e.shiftKey && /^[ijcIJC]$/.test(e.key)) || (!e.altKey && /^[rR]$/.test(e.key))) return false;
      if (!e.altKey && (/^[=+\-0]$/.test(e.key) || (!e.shiftKey && /^[flpFLP]$/.test(e.key)))) return false;
      return true;
    }
    if (/^F\d+$/.test(e.key)) return false;
    if (e.key === 'Tab') {
      var f = [].slice.call(panel.querySelectorAll('button')).filter(function (b) { return b.getAttribute('tabindex') !== '-1' && !b.disabled; });
      if (!f.length) return true;
      var i = f.indexOf(document.activeElement);
      var n = e.shiftKey ? (i <= 0 ? f.length - 1 : i - 1) : (i === f.length - 1 ? 0 : i + 1);
      f[n].focus();
      return true;
    }
    // the picker: ↑ / ↓ (and Home / End) move between the rows
    if (s.spec.arrows && (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Home' || e.key === 'End')) {
      var rows = [].slice.call(panel.querySelectorAll('[data-lab="pick-row"]'));
      if (rows.length && !s.swapping) {
        var at = rows.indexOf(document.activeElement), to;
        if (at < 0) {
          to = 0;
          rows.forEach(function (rw, k) { if (rw.getAttribute('tabindex') === '0') to = k; });
        } else if (e.key === 'Home') to = 0;
        else if (e.key === 'End') to = rows.length - 1;
        else to = Math.max(0, Math.min(rows.length - 1, at + (e.key === 'ArrowDown' ? 1 : -1)));
        focusRow(rows, to);
      }
      return true;
    }
    // Space acts on the focused button (as in any dialog); every other plain key stops here, so Space no longer opens Quick Look
    // and the arrow keys no longer move the Finder selection behind the sheet. The sheet has no text field.
    if (e.key === ' ') {
      var tb = document.activeElement;
      if (tb && tb.tagName === 'BUTTON' && panel.contains(tb) && !s.swapping && !tooSoon(s, e)) tb.click();
      return true;
    }
    return true;
  }

  /* open a sheet with its first view */
  function openSheet(spec) {
    if (!document.getElementById('lab-modal-root') || sheetBusy()) return false;
    var prev = document.activeElement;
    var panel = h('div', { class: 'lab-msheet', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'lab-msheet-t', dataset: { lab: 'msheet', kind: spec.kind } });
    var scrim = h('div', { class: 'lab-msheet-scrim' }, panel);
    sheetHost().appendChild(scrim);
    var s = { kind: spec.kind, scrim: scrim, panel: panel, view: null, spec: null, primary: null, focusEl: null, viewAt: 0, off: null,
      prev: prev, closing: false, finished: false, swapping: false, stopConfetti: null };
    sheet = s;
    mountView(s, spec);
    s.off = LAB.keys.modal(function (e) { return sheetKey(s, e); });
    focusView(s);
    cueSoon();
    return true;
  }

  /* ------------------------------------------------------------ the picker (§19.2) */
  function sheetEyebrow(m) {
    var idx = registry.indexOf(m);
    return '第 ' + (idx + 1) + ' 個任務' + (m.minutes ? ' · 約 ' + m.minutes + ' 分鐘' : '') + (m.tag ? ' · ' + (/Week/.test(m.tag) ? m.tag : 'Week 3 補充 1') : '');
  }
  /* eyebrow, title, intro and the step to begin with: the start page of a mission */
  function announceNodes(m) {
    var r = data.missions[m.id];
    var i = r ? firstUndone(m, r) : 0;
    var nodes = [
      h('div', { class: 'lab-ms-eyebrow' }, sheetEyebrow(m)),
      h('h1', { class: 'lab-ms-title', id: 'lab-msheet-t' }, m.title),
      h('p', { class: 'lab-ms-intro' }, inline(m.intro || '', 'sheet-copy'))
    ];
    if (i >= 0 && m.steps[i]) {
      nodes.push(h('div', { class: 'lab-ms-step', dataset: { lab: 'msheet-step' } },
        h('div', { class: 'lab-ms-steplabel' }, i === 0 ? '第一步' : '目前這一步'),
        h('p', { class: 'lab-ms-steptext' }, plain(m.steps[i].text))));
    }
    return nodes;
  }
  var FIRST_NOTE = '這台電腦弄壞了隨時可以重來；但重新整理頁面會讓一切從頭開始，所以請不要中途重新整理。卡住了可以按任務卡上的「提示」。';

  function isDoneM(x) { var q = data.missions[x.id]; return !!(q && q.doneAt); }
  function firstUnfinished() {
    for (var i = 0; i < registry.length; i++) if (!isDoneM(registry[i])) return registry[i];
    return null;
  }
  function pickMeta(x) {
    var q = data.missions[x.id], parts = [];
    if (data.current === x.id) parts.push('目前');
    if (q && q.doneAt) parts.push('完成');
    else if (q && q.startedAt) parts.push('第 ' + Math.min(doneCount(x, q) + 1, x.steps.length) + ' / ' + x.steps.length + ' 步');
    else if (x.minutes) parts.push('約 ' + x.minutes + ' 分鐘');
    return parts.join(' · ');
  }
  /* start a mission from a sheet and fly the sheet into the card */
  function startFromSheet(id) { missions.start(id); closeSheet('fly'); }

  /* the list view: missions by group, one button row each, the start button at the bottom */
  function pickListSpec(o) {
    o = o || {};
    var cur = missions.current(), next = firstUnfinished(), first = !!o.first;
    var head = h('div', { class: 'lab-pk-head' },
      h('h1', { class: 'lab-ms-title', id: 'lab-msheet-t' }, '選一個任務'),
      h('p', { class: 'lab-pk-sub' }, '可以從任何一個開始；第一次來，建議照順序。'));
    var rows = [], byId = {}, body = [];
    missions.groups().forEach(function (g) {
      var box = h('div', { class: 'lab-pk-group', role: 'group', 'aria-label': g.name || null });
      if (g.name) box.appendChild(h('div', { class: 'lab-pk-gname' }, g.name));
      g.ids.forEach(function (id) {
        var x = missions.get(id), done = isDoneM(x);
        var row = h('button', { type: 'button', class: 'lab-pk-row' + (data.current === id ? ' is-cur' : '') + (done ? ' is-done' : ''), tabindex: '-1', 'aria-current': data.current === id ? 'true' : null, dataset: { lab: 'pick-row', mission: id } },
          h('span', { class: 'lab-pk-num' }, done ? greenCheck(0) : pad2(registry.indexOf(x) + 1)),
          h('span', { class: 'lab-pk-title' }, x.title),
          h('span', { class: 'lab-pk-meta' }, pickMeta(x)));
        row.addEventListener('click', function () {
          if (!sheet || sheet.closing || sheet.swapping) return;
          // ?intro=0 / ?welcome=0: no start page, the mission just starts
          if (missions.skipIntro || missions.skipWelcome) startFromSheet(id);
          else swapView(sheet, startViewSpec(x, { first: first }));
        });
        rows.push(row); byId[id] = row; box.appendChild(row);
      });
      body.push(box);
    });
    // focus starts on the current mission (unless it is finished), else on the first unfinished one
    var fx = (o.focusId && byId[o.focusId]) || (cur && !isDoneM(cur) && byId[cur.id]) || (next && byId[next.id]) || (cur && byId[cur.id]) || rows[0] || null;
    rows.forEach(function (rw) { rw.setAttribute('tabindex', rw === fx ? '0' : '-1'); });
    var buttons = [];
    if (next) buttons.push({ label: '開始：第 ' + (registry.indexOf(next) + 1) + ' 個任務 · ' + next.title, lab: 'pick-start', also: first ? 'welcome-start' : null, primary: true, run: function () { startFromSheet(next.id); } });
    else buttons.push({ label: '關閉', lab: 'pick-close', primary: true, run: function () { closeSheet('fade'); } });
    if (cur && next) buttons.push({ label: '關閉', lab: 'pick-close', text: true, run: function () { closeSheet('fade'); } });
    return {
      kind: 'pick', pick: true, view: 'list', first: first, arrows: true, head: head, body: body, buttons: buttons, focus: fx,
      note: first ? h('p', { class: 'lab-ms-note' }, FIRST_NOTE) : null,
      // Esc closes the picker, unless no mission has been chosen yet: then there is nothing to go back to
      esc: function () { if (missions.current()) closeSheet('fade'); }
    };
  }
  /* the start page of one mission, in the same sheet: 「← 選別的任務」 goes back to the list */
  function startViewSpec(m, o) {
    o = o || {};
    var first = !!o.first;
    function back() { swapView(sheet, pickListSpec({ first: first, focusId: m.id })); }
    var backBtn = h('button', { type: 'button', class: 'lab-ms-back', dataset: { lab: 'msheet-back' } }, '← 選別的任務');
    backBtn.addEventListener('click', function () { if (sheet && !sheet.closing && !sheet.swapping) back(); });
    return {
      kind: 'pick', pick: true, view: 'start', first: first, head: h('div', { class: 'lab-pk-head is-start' }, backBtn),
      body: announceNodes(m),
      buttons: [{ label: '開始任務', lab: 'msheet-start', also: first ? 'welcome-start' : null, primary: true, run: function () { startFromSheet(m.id); } }],
      note: first ? h('p', { class: 'lab-ms-note' }, FIRST_NOTE) : null,
      esc: back
    };
  }
  /* open the picker: its list, or (o.id) a mission's start page. false if a sheet is already open */
  function openPicker(o) {
    o = o || {};
    if (!registry.length || sheetBusy()) return false;
    var m = o.id ? missions.get(o.id) : null;
    return openSheet(m ? startViewSpec(m, { first: o.first }) : pickListSpec({ first: o.first }));
  }
  missions.pick = function () { return openPicker({}); };

  /* the first thing after the connecting screen: the picker, with the old reminder under it */
  function showFirstSheet() {
    firstPending = false;
    if (missions.skipWelcome || welcomeShown || !registry.length || sheetBusy()) return;
    welcomeShown = true;
    var cur = missions.current();                       // ?mission=<id> has already made that mission current: open on its start page
    openPicker({ first: true, id: cur ? cur.id : null });
  }

  /* ----------------------------------------------------- the completion sheet + confetti */
  /* a mission just finished: let the last green check be seen, then offer the next one */
  function scheduleDoneSheet(id) {
    setTimeout(function () {
      var m = missions.get(id), r = m && data.missions[id];
      if (!m || !r || !r.doneAt || data.current !== id) return;
      // no sheet with ?intro=0 / ?welcome=0: the sound alone
      if (missions.skipWelcome || missions.skipIntro) { if (LAB.sfx) LAB.sfx('mission'); return; }
      if (sheetBusy() || firstPending) return;
      showDoneSheet(m);
    }, 900);
  }
  function showDoneSheet(m) {
    var idx = registry.indexOf(m);
    var allDone = registry.every(isDoneM);
    // the next mission after this one that is not finished yet (missions can be done in any order)
    var nx = null, k;
    for (k = idx + 1; k < registry.length && !nx; k++) if (!isDoneM(registry[k])) nx = registry[k];
    var check = greenCheck(Date.now() + 200);          // pops in a moment after the sheet, so it is seen
    var nodes = [
      h('div', { class: 'lab-ms-check', dataset: { lab: 'msheet-check' } }, check),
      h('h1', { class: 'lab-ms-title', id: 'lab-msheet-t' }, allDone ? 'Week 3 的任務全部完成' : '任務 ' + (idx + 1) + ' 完成'),
      h('p', { class: 'lab-ms-intro', dataset: { lab: 'msheet-outro' } }, inline(m.outro || '這個任務完成了。', 'sheet-copy'))
    ];
    function toPicker() { swapView(sheet, pickListSpec({})); }
    var buttons;
    if (nx) {
      nodes.push(h('div', { class: 'lab-ms-step', dataset: { lab: 'msheet-next-info' } },
        h('p', { class: 'lab-ms-steptext is-next' }, h('span', { class: 'lab-ms-steplabel' }, '下一個：'), '任務 ' + (registry.indexOf(nx) + 1) + ' · ' + nx.title)));
      buttons = [
        { label: '開始下一個任務', lab: 'msheet-next', primary: true, run: function () { startFromSheet(nx.id); } },
        { label: '選其他任務', lab: 'msheet-pick', text: true, run: toPicker }
      ];
    } else {
      nodes.push(h('p', { class: 'lab-ms-note' }, allDone
        ? '想知道這次做完了哪些任務，點任務卡最下面的「進度代碼」，複製那串字給老師看就可以。'
        : '還有任務沒做完，可以按「選其他任務」繼續。想給老師看做完了哪些，點任務卡下方的「進度代碼」複製那串字。'));
      buttons = [
        { label: '關閉', lab: 'msheet-close', primary: true, run: function () { closeSheet('fade'); } },
        { label: allDone ? '再選一個任務' : '選其他任務', lab: 'msheet-pick', text: true, run: toPicker }
      ];
    }
    if (openSheet({ kind: 'done', nodes: nodes, buttons: buttons, esc: function () { closeSheet('fade'); } })) {
      if (LAB.sfx) LAB.sfx('mission');
      startConfetti(sheet, check);
    }
  }

  /* Paper confetti on the completion sheet (§19.5): about 60 paper rectangles (8x13 px) fan up out of the big green check, fall under
     gravity, sway and turn slowly (a paper flips, it does not spin) and fade out by 1.9 s. One canvas over the sheet, no pointer
     events, drawn by a requestAnimationFrame loop that exists only for those 1.9 s. None with reduced motion. */
  var CONFETTI = ['#005fb8', '#0f7b0f', '#4cc2ff', '#ffb900', '#f7630c'];      // accent, green, sky, Windows gold, orange
  var CONFETTI_MS = 1900;
  function startConfetti(s, anchor) {
    if (!s || reducedMotion() || !anchor) return;
    var cv = document.createElement('canvas');
    var cx = cv.getContext && cv.getContext('2d');
    if (!cx) return;
    cv.className = 'lab-confetti';
    cv.setAttribute('aria-hidden', 'true');
    var low = !!(LAB.perf && LAB.perf.low);
    var raf = 0, timer = 0, stopped = false;
    function stop() {
      if (stopped) return;
      stopped = true;
      if (raf) cancelAnimationFrame(raf);
      if (timer) clearTimeout(timer);
      if (cv.parentNode) cv.parentNode.removeChild(cv);
      if (s.stopConfetti === stop) s.stopConfetti = null;
    }
    s.stopConfetti = stop;
    timer = setTimeout(function () {                    // starts with the check's pop
      timer = 0;
      if (stopped || s.closing || !document.contains(anchor)) { stop(); return; }
      var W = Math.max(1, s.scrim.clientWidth), H = Math.max(1, s.scrim.clientHeight);
      var dpr = low ? 1 : Math.min(window.devicePixelRatio || 1, 1.5);
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      s.scrim.appendChild(cv);
      cx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var ar = anchor.getBoundingClientRect(), sr = s.scrim.getBoundingClientRect();
      var ox = ar.left - sr.left + ar.width / 2, oy = ar.top - sr.top + ar.height / 2;
      var n = low ? 24 : 60, ps = [], i;
      for (i = 0; i < n; i++) {
        var ang = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.8;        // a fan, 36 degrees to each side of straight up
        var sp = 560 + Math.random() * 560;
        ps.push({ vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, x: ox, y: oy, c: CONFETTI[i % CONFETTI.length],
          ph: Math.random() * 6.28, flip: 1.6 + Math.random() * 1.8, tilt: (Math.random() - 0.5) * 0.9 });
      }
      var t0 = 0, last = 0;
      function frame(ts) {
        raf = 0;
        if (stopped) return;
        if (!t0) { t0 = ts; last = ts; }
        var t = (ts - t0) / 1000, dt = Math.min(0.05, (ts - last) / 1000);
        last = ts;
        if (t >= CONFETTI_MS / 1000) { stop(); return; }
        cx.clearRect(0, 0, W, H);
        var alpha = t < 1.4 ? 1 : Math.max(0, 1 - (t - 1.4) / 0.5);
        cx.globalAlpha = alpha;
        for (var k = 0; k < ps.length; k++) {
          var p = ps[k];
          p.vy += 760 * dt;                                                    // gravity
          p.vx -= p.vx * 2.6 * dt; p.vy -= p.vy * 2.0 * dt;                    // paper is slowed by the air: it hangs, then drifts down
          p.x += p.vx * dt; p.y += p.vy * dt;
          cx.save();
          cx.translate(p.x + Math.sin(t * 2.4 + p.ph) * 7, p.y);              // sways
          cx.rotate(p.tilt + Math.sin(t * 1.6 + p.ph) * 0.35);
          cx.scale(1, Math.cos(t * p.flip + p.ph));                           // turns over slowly
          cx.fillStyle = p.c;
          cx.beginPath();
          if (cx.roundRect) cx.roundRect(-4, -6.5, 8, 13, 1.5); else cx.rect(-4, -6.5, 8, 13);
          cx.fill();
          cx.restore();
        }
        raf = requestAnimationFrame(frame);
      }
      raf = requestAnimationFrame(frame);
    }, 200);
  }

  /* ============================================================ cues (§19.4) */
  /* Cues point at what to do: the step's `target` (a selector, an array of selectors, or function(api) → element) gets the
     taskbar's attention flash (a taskbar button) or a ring that follows the element (anything else). Plus the step's row bouncing
     in, the number hopping when a step has stood still for 15 s, the 「提示」 link wiggling at 60 s. All of it waits while a
     sheet is open or the card is dragged, and is still (colour only) with prefers-reduced-motion. */
  var cueEl = null, cueDock = null, cueTimer = null, cueQueued = false, cueRect = '';
  var cueBase = 0;                                      // the idle clock counts from here at the earliest (after a sheet closed)
  var idleKey = '', idleK = -1, idleWiggled = false;

  function cuePaused() {
    if (sheet || firstPending || document.hidden) return true;
    return !!(rail && rail.classList.contains('is-dragging'));
  }
  /* the current step's target element, or null */
  function stepTarget() {
    var m = missions.current();
    var r = m && data.missions[m.id];
    if (!m || !r || !r.startedAt || r.doneAt) return null;
    var i = firstUndone(m, r);
    var t = i >= 0 ? m.steps[i].target : null;
    if (!t) return null;
    var list = Array.isArray(t) ? t : [t], out = null;
    for (var k = 0; k < list.length && !out; k++) {
      var c = list[k], el = null, label = '';
      try {
        if (typeof c === 'function') { el = withCtx(m, r, m.steps[i], function () { return c(api); }); label = el && el.getAttribute ? (el.getAttribute('data-lab') || el.tagName.toLowerCase()) : ''; }
        else if (typeof c === 'string') { el = document.querySelector(c); label = c; }
      } catch (e) { el = null; }
      if (el && el.nodeType === 1) {
        var rc = el.getBoundingClientRect();
        if (rc.width > 0 && rc.height > 0) out = { el: el, label: label };
      }
    }
    return out;
  }
  /* on screen and not covered by a window, a menu or the card: the middle of its visible part is the element itself */
  function cueVisible(el, rc) {
    var scr = document.getElementById('lab-screen');
    if (!scr) return false;
    var sr = scr.getBoundingClientRect();
    var l = Math.max(rc.left, sr.left), r2 = Math.min(rc.right, sr.right), t = Math.max(rc.top, sr.top), b = Math.min(rc.bottom, sr.bottom);
    if (r2 - l < 2 || b - t < 2) return false;
    var top = document.elementFromPoint((l + r2) / 2, (t + b) / 2);
    return !!top && (el === top || el.contains(top) || top.contains(el));
  }
  /* typing into the Terminal that already has the focus needs no pointing at */
  function termTyping(el) {
    var inp = el.closest ? el.closest('[data-lab="term-input"]') : null;
    if (!inp) return false;
    var win = inp.closest('.lab-win'), f = LAB.wm && LAB.wm.focused && LAB.wm.focused();
    return !!(win && f && f.el === win);
  }
  function drawRing(el, rc, label) {
    var scr = document.getElementById('lab-screen');
    if (!cueEl) {
      cueEl = h('div', { class: 'lab-cue', 'aria-hidden': 'true', dataset: { lab: 'cue-ring' } }, h('i', { class: 'lab-cue-wave' }));
      cueEl.hidden = true;
      scr.appendChild(cueEl);
    } else if (cueEl.parentNode !== scr) scr.appendChild(cueEl);
    var sr = scr.getBoundingClientRect(), pad = 6;                  // 4 px of air and the 2 px line
    var x = Math.round(rc.left - sr.left - pad), y = Math.round(rc.top - sr.top - pad);
    var w = Math.round(rc.width + pad * 2), hh = Math.round(rc.height + pad * 2);
    var key = x + ',' + y + ',' + w + ',' + hh;
    if (key !== cueRect) {                                          // the element moved or resized: only then touch the DOM
      cueRect = key;
      cueEl.style.width = w + 'px'; cueEl.style.height = hh + 'px';
      cueEl.style.transform = 'translate(' + x + 'px, ' + y + 'px)';
      cueEl.style.setProperty('--cue-grow', (1 + Math.min(0.18, Math.max(0.04, 28 / Math.max(w, hh)))).toFixed(3));   // 1.18 for icons and rows; a big window spreads by about 28 px, not 18 %
      var br = 0;
      try { br = parseFloat(window.getComputedStyle(el).borderTopLeftRadius) || 0; } catch (e) { br = 0; }
      cueEl.style.borderRadius = Math.max(8, Math.min(22, br + pad)) + 'px';
    }
    if (cueEl.getAttribute('data-target') !== label) cueEl.setAttribute('data-target', label);
    if (cueEl.hidden) cueEl.hidden = false;
  }
  function cueUpdate() {
    var want = null;
    if (!cuePaused()) { try { want = stepTarget(); } catch (e) { want = null; } }
    // a taskbar button (the Dock of the Mac lab): its tile flashes in the accent (CSS: lab-dock-attn); with reduced motion it just stays lit
    var dockEl = want && want.el.closest ? want.el.closest('.lab-dock-item, [data-lab="dock-item"]') : null;
    if (cueDock && cueDock !== dockEl) { cueDock.classList.remove('lab-dock-attn'); cueDock = null; }
    if (dockEl && cueDock !== dockEl) { dockEl.classList.add('lab-dock-attn'); cueDock = dockEl; }
    var ring = false;
    if (want && !dockEl) {
      var rc = want.el.getBoundingClientRect();
      if (cueVisible(want.el, rc) && !termTyping(want.el)) { ring = true; drawRing(want.el, rc, want.label); }
    }
    if (!ring && cueEl && !cueEl.hidden) { cueEl.hidden = true; cueRect = ''; }
    // follow the element only while there is one to follow: bus events, window moves, scrolling and this light check every 400 ms
    if (want && !cueTimer) cueTimer = setInterval(cueUpdate, 400);
    else if (!want && cueTimer) { clearInterval(cueTimer); cueTimer = null; }
  }
  function cueSoon() {
    if (cueQueued) return;
    cueQueued = true;
    setTimeout(function () { cueQueued = false; cueUpdate(); }, 60);
  }
  window.addEventListener('resize', cueSoon);
  window.addEventListener('pointerup', cueSoon, true);          // a window was dragged or resized, the card was dropped
  document.addEventListener('scroll', cueSoon, true);
  document.addEventListener('visibilitychange', cueSoon);       // the tab is back: the cues were waiting

  /* a step that stands still: the number hops twice at 15 s and again every 8 s; at 60 s the 「提示」 link gets its underline
     (render) and wiggles once. Checked once a second, nothing runs when the step is fresh. */
  function cardVisible() {
    var b = rail && rail.querySelector('.lab-rail-body');
    return !!(b && !b.hasAttribute('inert') && b.getBoundingClientRect().width > 8);
  }
  function idleTick() {
    if (cuePaused() || !rail) return;
    var m = missions.current();
    if (!m) return;
    var r = rec(m.id), i = firstUndone(m, r);
    if (i < 0 || !r.startedAt) return;
    var step = m.steps[i], t0 = stepStartMs[m.id + '/' + step.id];
    if (!t0) return;
    var base = Math.max(t0, cueBase), idle = (Date.now() - base) / 1000;
    var key = m.id + '/' + step.id + '@' + base;
    if (key !== idleKey) { idleKey = key; idleK = -1; idleWiggled = false; }
    var k = idle >= 15 ? Math.floor((idle - 15) / 8) : -1;
    var calm = reducedMotion() || !cardVisible();
    if (k > idleK) {
      idleK = k;
      var num = rail.querySelector('.lab-step.is-current .lab-num');
      if (!calm && num && num.animate) {
        try {
          num.animate([
            { transform: 'translateY(0)', easing: 'ease-out' }, { transform: 'translateY(-5px)', offset: 0.22, easing: 'ease-in' },
            { transform: 'translateY(0)', offset: 0.46, easing: 'ease-out' }, { transform: 'translateY(-5px)', offset: 0.68, easing: 'ease-in' },
            { transform: 'translateY(0)' }
          ], { duration: 640 });
        } catch (e) { /* ignore */ }
      }
    }
    if (idle >= 60 && !idleWiggled) {
      idleWiggled = true;
      render();                                          // the 「提示」 link gets its amber underline (hintReady)
      var hl = rail.querySelector('[data-lab="hint-link"]');
      if (!calm && hl && hl.animate && !(r.hints[step.id] > 0)) {
        try { hl.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-3px)', offset: 0.25 }, { transform: 'translateX(3px)', offset: 0.6 }, { transform: 'translateX(0)' }], { duration: 480, easing: 'ease-in-out' }); } catch (e2) { /* ignore */ }
      }
    }
  }

  /* ----------------------------------------------------------------- boot */
  LAB.ready(function () {
    rail = document.getElementById('lab-rail');
    if (!rail) return;
    liveEl = h('div', { class: 'lab-sr', 'aria-live': 'polite', role: 'status', dataset: { lab: 'rail-live' } });
    render(true);
    if (!tickTimer) {
      tickTimer = setInterval(function () {
        var m = missions.current();
        if (!m) return;
        var r = rec(m.id);
        var i = firstUndone(m, r);
        if (i >= 0) {
          var step = m.steps[i];
          var t0 = stepStartMs[m.id + '/' + step.id];
          if (t0 && Date.now() - t0 >= 60000 && !nudge.text) {
            var start = r.stepStart[step.id] || r.startSeq || 0;
            if (LAB.bus.find('term:run', null, start)) { nudge = { stepId: step.id, text: whereNudge(step) }; announce(nudge.text); }
          }
        }
        render();
      }, 5000);
      setInterval(idleTick, 1000);
    }
  }, 80);

  LAB.ready(function () {
    var m = missions.current();
    if (m) { startStepClock(m, rec(m.id)); }
    if (missions.pendingStart) { missions.start(missions.pendingStart); missions.pendingStart = null; }
    render(true);
  }, 85);

  /* the first sheet comes after the connecting screen (connect:done), and after 「仍要繼續」 on a phone */
  LAB.ready(function () {
    if (missions.skipWelcome || !registry.length) return;
    var waitConnect = true, waitPhone = !!(LAB.desktop && LAB.desktop.phoneBlocked);
    firstPending = true;
    function go() { if (!waitConnect && !waitPhone) showFirstSheet(); }
    LAB.bus.once('connect:done', function () { waitConnect = false; go(); });
    if (waitPhone) LAB.bus.once('phone:continue', function () { waitPhone = false; go(); });
  }, 95);

  LAB.missions = missions;
})(window.LAB);
