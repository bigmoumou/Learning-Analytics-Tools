/* missions.js [PORTABLE engine + page-theme rail UI] — LAB.missions (DESIGN §3.12, §5, §6.1, §6.2). */
(function (LAB) {
  'use strict';

  var h = LAB.util.h;
  var registry = [];                         // missions, sorted by week/order
  var data = { current: null, freePlay: false, missions: {} };
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
  var ui = { listOpen: false, mapOpen: false, codeOpen: false, copied: null };
  var welcomeShown = false;
  var missions = {};

  missions.freePlayTips = [];

  /* ------------------------------------------------------------ registry */
  missions.register = function (m) {
    var i;
    for (i = 0; i < registry.length; i++) { if (registry[i].id === m.id) { registry.splice(i, 1); break; } }
    registry.push(m);
    registry.sort(function (a, b) { return (a.week - b.week) || (a.order - b.order); });
    if (LAB.boot && LAB.boot.isBooted()) render();
  };
  missions.list = function () { return registry.slice(); };
  missions.get = function (id) {
    for (var i = 0; i < registry.length; i++) if (registry[i].id === id) return registry[i];
    return null;
  };
  missions.current = function () { return data.current ? missions.get(data.current) : null; };
  missions.isFreePlay = function () { return !!data.freePlay; };
  missions.setFreePlay = function (b) { data.freePlay = !!b; touch(); render(); };
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
    serialize: function () { return { current: data.current, freePlay: data.freePlay, missions: data.missions }; },
    restore: function (json) {
      data = { current: null, freePlay: false, missions: {} };
      if (json === undefined) return;
      if (!isObj(json)) throw new Error('bad missions slice');
      data.freePlay = !!json.freePlay;
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
    reset: function () { data = { current: null, freePlay: false, missions: {} }; nudge = { stepId: null, text: '' }; }
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
        if (cmds[i].status === 127 && NONASCII.test(String(cmds[i].name || ''))) return '看起來輸入法是中文，或是空格是全形。切到英文（ABC）再打一次。';
      }
      for (var k = 0; k < cmds.length; k++) {
        if (cmds[k].status && /no such file or directory/i.test(String(cmds[k].out || ''))) return '印出 no such file or directory，多半是拼錯字，或你人不在預期的資料夾。看提示字元，再用 ls 看看。';
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
      return '「' + name + '」不在原本的位置了。如果是剛剛不小心拖走或丟進垃圾桶，按 Ctrl+Z（Mac 用 Command+Z）還原，或把它拖回桌面；也可以按下面的「重來這個任務」，它會放回來。';
    }
    return '';
  }
  function whereNudge(step) {
    var w = step.where;
    if (!w) return '先看提示字元最後一個字，確認你人在哪個資料夾。';
    var name = LAB.vfs.canon(w) === LAB.vfs.HOME ? '~' : LAB.vfs.basename(w);
    return '這一步需要在 ' + name + ' 裡輸入，先看提示字元最後一個字。';
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
    peek = { id: id, text: text };
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
    data.freePlay = false;
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
  missions.progressCode = function () {
    var obj = { m: {}, t: Math.floor(LAB.clock.ms() / 1000) };
    registry.forEach(function (m) {
      var r = data.missions[m.id];
      if (r && r.startedAt) obj.m[m.id] = r.doneAt ? Math.floor(r.doneAt / 1000) : 0;
    });
    return 'LABv1.' + btoa(JSON.stringify(obj));
  };
  missions.importProgressCode = function (str) {
    str = String(str || '').trim();
    if (str.indexOf('LABv1.') !== 0) return { ok: false, message: '這不是進度代碼（要以 LABv1. 開頭）。', summary: '' };
    var obj;
    try { obj = JSON.parse(atob(str.slice(6))); } catch (e) { return { ok: false, message: '進度代碼讀不懂，請確認有完整複製。', summary: '' }; }
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
  function inline(str) {
    var out = [];
    var re = /\[\[([\s\S]+?)\]\]|`([^`]+)`/g, last = 0, m;
    str = String(str);
    while ((m = re.exec(str)) !== null) {
      if (m.index > last) out.push(document.createTextNode(str.slice(last, m.index)));
      if (m[1] !== undefined) {
        var sentence = m[1];
        var link = h('button', { type: 'button', class: 'lab-linkbtn lab-copy', dataset: { lab: 'rail-copy' }, 'data-fk': 'copy:' + sentence.slice(0, 8) }, ui.copied === sentence ? '已複製' : '複製');
        link.addEventListener('click', function (s, el) {
          return function () {
            LAB.clipboard.setText(s).then(function (ok) {
              ui.copied = ok ? s : null;
              el.textContent = ok ? '已複製' : '沒複製成功：請自己選取左邊這句，按 Ctrl+C（Mac 用 Command+C）';
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
      data.current, data.freePlay, LAB.layout ? LAB.layout.railMode() : '', LAB.layout ? LAB.layout.isDrawerOpen() : false,
      ui.listOpen, ui.mapOpen, ui.codeOpen, ui.copied,
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
    if (mode === 'drawer' && !open && m && r && !data.freePlay) {
      var ci = firstUndone(m, r);
      if (nudge.text && ci >= 0 && nudge.stepId === m.steps[ci].id && nudgeKey() !== nudgeShut) { bubbleText = nudge.text; bubbleKind = 'nudge'; }
      else if (peek && ci >= 0) { bubbleText = peek.text; bubbleKind = 'ok'; }
    }
    var attn = !!(mode === 'drawer' && !open && m && r && !data.freePlay && (bubbleText || r.doneAt));
    var curStepText = '';
    if (m && r && !r.doneAt && firstUndone(m, r) >= 0) curStepText = plain(m.steps[firstUndone(m, r)].text);
    // which face of the card is showing: the full card or the pill. Only a change between them animates (render rebuilds the card often)
    var face = (mode === 'drawer' && !open) ? 'pill' : 'card';
    var entering = lastFace !== null && lastFace !== face;
    lastFace = face;
    var strip = h('button', { type: 'button', class: 'lab-rail-strip lab-glass' + (attn ? ' is-attn' : '') + (entering && face === 'pill' ? ' is-entering' : ''),
      'aria-label': '展開任務卡' + (curStepText ? '。目前這一步：' + curStepText : ''), title: curStepText || null,
      'data-lab': 'rail-strip', 'data-fk': 'strip' },
      h('span', { class: 'lab-rail-chev', 'aria-hidden': 'true' }, '›'),
      h('span', { class: 'lab-rail-dot', 'aria-hidden': 'true' }),
      h('span', { class: 'lab-rail-tag' }, '任務卡'), h('span', { class: 'lab-rail-vert' }, stripText()));
    strip.addEventListener('click', function () { LAB.layout.openDrawer(); });
    var bubble = null;
    if (bubbleText) {
      var bmain = h('button', { type: 'button', class: 'lab-peek-main', 'data-fk': 'peek', 'aria-label': '打開任務卡。' + bubbleText },
        h('span', { class: 'lab-peek-eyebrow' }, bubbleKind === 'nudge' ? '提醒' : '做好了'),
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
    if (mode === 'pinned') ctl.push(link('收起', 'pin', function () { LAB.layout.setRailMode('drawer'); }, { 'data-lab': 'rail-pin', title: '收成左上角的小膠囊，點一下再打開' }));
    else {
      ctl.push(link('收起', 'close', function () { LAB.layout.closeDrawer(); }, { 'data-lab': 'rail-close' }));
      ctl.push(link('釘住', 'pin', function () { LAB.layout.setRailMode('pinned'); }, { 'data-lab': 'rail-pin', title: '一直開著，點 Mac 時不收起' }));
    }
    var head = h('div', { class: 'lab-rail-head' },
      h('a', { class: 'lab-rail-link', href: '../../weeks/week03/' }, '← Week 3'),
      h('span', { class: 'lab-rail-label' }, '練習用的 Mac'),
      h('span', { class: 'lab-rail-ctl' }, ctl));

    // the header is the card's own title row (outside the scroller): 收起 / 釘住 stay reachable and nothing scrolls under it
    var parts = [];

    // mission list
    if (registry.length) {
      var curTitle = m ? missions.list().indexOf(m) + 1 : 0;
      var disc = h('button', { type: 'button', class: 'lab-disc', 'aria-expanded': ui.listOpen ? 'true' : 'false', 'data-fk': 'list', dataset: { lab: 'rail-list-toggle' } },
        h('span', { class: 'lab-disc-t' }, '任務清單'),
        h('span', { class: 'lab-disc-cur' }, m ? pad2(curTitle) + ' ' + m.title : '還沒選任務'),
        h('span', { class: 'lab-disc-chev', 'aria-hidden': 'true' }, ui.listOpen ? '–' : '+'));
      disc.addEventListener('click', function () { ui.listOpen = !ui.listOpen; render(true); });
      var sec = h('div', { class: 'lab-sec lab-sec-list' }, disc);
      if (ui.listOpen || !m) {
        var list = h('ul', { class: 'lab-mlist' });
        registry.forEach(function (x, i) {
          var xr = data.missions[x.id];
          var isDone = !!(xr && xr.doneAt);
          var row = h('button', { type: 'button', class: 'lab-mrow' + (m && m.id === x.id ? ' is-cur' : ''), 'data-fk': 'row:' + x.id, dataset: { lab: 'rail-mission', id: x.id } },
            h('span', { class: 'lab-num' + (isDone ? ' is-check' : '') }, isDone ? '✓' : pad2(i + 1)),
            h('span', { class: 'lab-mt' }, x.title),
            x.tag ? h('span', { class: 'lab-mtag' }, '補充教材') : null);
          row.addEventListener('click', function () { ui.listOpen = false; missions.start(x.id); render(true); });
          list.appendChild(h('li', null, row));
        });
        sec.appendChild(list);
        sec.appendChild(h('p', { class: 'lab-muted' }, '第 2、3 個任務是 Week 3 補充 1（終端機）。第 4 到 7 個任務不用先做它們，可以直接開始。'));
      }
      parts.push(sec);
    }

    // current mission
    if (m && r) {
      var idx = missions.list().indexOf(m);
      var eyebrow = '第 ' + (idx + 1) + ' 個任務' + (m.minutes ? ' · 約 ' + m.minutes + ' 分鐘' : '') + (m.tag ? ' · Week 3 補充 1' : '');
      var cur = h('div', { class: 'lab-sec lab-sec-cur' },
        h('div', { class: 'lab-eyebrow' }, eyebrow),
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

      if (data.freePlay) {
        var tips = h('ul', { class: 'lab-tips' });
        missions.freePlayTips.forEach(function (t) { tips.appendChild(h('li', null, inline(t))); });
        parts.push(h('div', { class: 'lab-sec' }, h('p', { class: 'lab-muted' }, '想做什麼就做什麼，隨時可以回到任務'), tips));
      } else {
        var curIdx = firstUndone(m, r);
        var steps = h('ol', { class: 'lab-steps' });
        m.steps.forEach(function (st, i) {
          var done = !!r.steps[st.id];
          var skipped = done && !!r.skipped[st.id];
          var isCur = i === curIdx;
          var li = h('li', {
            class: 'lab-step' + (done ? ' is-done' : '') + (skipped ? ' is-skipped' : '') + (isCur ? ' is-current' : ''),
            dataset: { lab: 'step', step: st.id, done: done ? 'true' : 'false', skipped: skipped ? 'true' : 'false' }
          },
            h('span', { class: 'lab-num' + (done && !skipped ? ' is-check' : '') + (skipped ? ' is-skip' : '') }, skipped ? '–' : (done ? '✓' : pad2(i + 1))),
            h('div', { class: 'lab-step-body' },
              h('div', { class: 'lab-step-text' }, inline(st.text), st.optional && (!done || skipped) ? h('span', { class: 'lab-opt' }, skipped ? '（選做，略過了）' : '（選做）') : null)));
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
      var prog = h('div', { class: 'lab-sec lab-sec-foot' },
        h('div', { class: 'lab-prog', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(total), 'aria-valuenow': String(dn), 'aria-label': '任務進度' },
          h('div', { class: 'lab-prog-fill', style: { width: (total ? Math.round(dn / total * 100) : 0) + '%' } })),
        h('div', { class: 'lab-prog-text' }, '已完成 ' + dn + ' / ' + total + ' 步'));
      if (r.doneAt) {
        prog.appendChild(h('p', { class: 'lab-outro', dataset: { lab: 'rail-outro' } }, inline(m.outro || '這個任務完成了。')));
        var nx = nextMission(m);
        if (nx) {
          var nb = h('button', { type: 'button', class: 'lab-nextbtn', 'data-fk': 'next', dataset: { lab: 'rail-next' } }, '下一個任務 →');
          nb.addEventListener('click', function () { missions.start(nx.id); });
          prog.appendChild(nb);
        }
      }
      parts.push(prog);
    } else if (!registry.length) {
      parts.push(h('div', { class: 'lab-sec' }, h('p', { class: 'lab-muted' }, '目前還沒有任務。你可以先自由練習。'),
        missions.freePlayTips.length ? h('ul', { class: 'lab-tips' }, missions.freePlayTips.map(function (t) { return h('li', null, inline(t)); })) : null));
    }

    // links
    var links = h('div', { class: 'lab-foot-links' });
    if (m) {
      links.appendChild(link('重來這個任務', 'redo', function () { missions.reset(m.id); }, { 'data-lab': 'rail-redo' }));
      links.appendChild(link(data.freePlay ? '回到任務' : '自由練習', 'free', function () { missions.setFreePlay(!data.freePlay); }, { 'data-lab': 'rail-free' }));
    } else if (registry.length) {
      links.appendChild(link('自由練習', 'free', function () { missions.setFreePlay(!data.freePlay); }, { 'data-lab': 'rail-free' }));
    }
    if (LAB.layout && LAB.layout.canFullscreen && LAB.layout.canFullscreen()) {
      links.appendChild(link('全螢幕', 'fullscreen', function () { LAB.layout.toggleFullscreen(); }, { 'data-lab': 'rail-fullscreen', title: '把練習用的 Mac 放大到整個螢幕；按 Esc 離開' }));
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
      parts.push(h('div', { class: 'lab-sec' }, cl, h('p', { class: 'lab-muted' }, '換電腦或交給老師時，複製這串進度代碼。')));
    }

    // page footer
    var foot = h('div', { class: 'lab-page-foot' },
      h('div', null, 'Copyright © 2026 JUNHAO CHEN'),
      LAB.store.noticeText ? h('div', { class: 'lab-store-notice', dataset: { lab: 'rail-notice' } }, LAB.store.noticeText) : null,
      h('div', { class: 'lab-muted' }, '如果是學校的共用電腦，用完請按「重設全部」。'));
    parts.push(foot);

    var scroll = h('div', { class: 'lab-rail-scroll' }, parts);
    var bodyEl = h('div', { class: 'lab-rail-body lab-glass' + (entering && face === 'card' ? ' is-entering' : ''), 'aria-hidden': (mode === 'drawer' && !open) ? 'true' : null }, head, scroll);
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

  LAB.bus.on('mission:complete', function () { clearPeek(); outroPending = true; revealRail(); });
  LAB.bus.on('rail:layout', function () { render(true); });
  LAB.bus.on('store:notice', function () { render(true); });
  LAB.bus.on('store:reset', function () { nudge = { stepId: null, text: '' }; clearPeek(); nudgeShut = ''; render(true); });

  /* ---------------------------------------------------------------- welcome */
  function showWelcome() {
    if (welcomeShown || LAB.store.get('ui.welcomeSeen', false) || missions.skipWelcome) return;
    var root = document.getElementById('lab-modal-root');
    if (!root) return;
    welcomeShown = true;
    var prev = document.activeElement;
    var first = registry[0];
    function close(startFirst) {
      LAB.store.set('ui.welcomeSeen', true);
      off();
      if (scrim.parentNode) scrim.parentNode.removeChild(scrim);
      if (startFirst && first) missions.start(first.id); else missions.setFreePlay(true);
      try { if (prev && prev.focus && document.contains(prev)) prev.focus(); } catch (e) { /* ignore */ }
    }
    var startBtn = h('button', { type: 'button', class: 'lab-textbtn is-primary', dataset: { lab: 'welcome-start' } }, '開始第一個任務');
    var freeBtn = h('button', { type: 'button', class: 'lab-textbtn', dataset: { lab: 'welcome-free' } }, '自由練習');
    startBtn.addEventListener('click', function () { close(true); });
    freeBtn.addEventListener('click', function () { close(false); });
    var panel = h('div', { class: 'lab-welcome lab-glass', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'lab-welcome-t' },
      h('h1', { id: 'lab-welcome-t' }, '歡迎來到練習用的 Mac'),
      h('p', null, '這不是真的 Mac，是在瀏覽器裡執行的模擬環境。你可以放心亂點、亂打指令，弄壞了隨時可以重來，不會影響你自己的電腦。建議先看過 Week 3 的影片。'),
      h('p', null, '左上角那張半透明的任務卡（螢幕窄時會縮成一顆小膠囊，點一下就展開）是這次的任務：照著步驟做，做對了會自動打勾；卡住了可以按「提示」。也可以選「自由練習」，自己隨便玩。'),
      h('p', null, '用 Windows 鍵盤時，Command 請用 Ctrl，Return 就是 Enter。'),
      h('p', null, '你的進度只存在這個瀏覽器裡。如果是學校的共用電腦，用完請按「重設全部」。'),
      LAB.store.available ? null : h('p', { class: 'lab-store-notice' }, '這個瀏覽器不能儲存進度，關掉這一頁後進度會消失。'),
      h('div', { class: 'lab-welcome-btns' }, registry.length ? startBtn : null, freeBtn));
    var scrim = h('div', { class: 'lab-welcome-scrim' }, panel);
    root.appendChild(scrim);
    var off = LAB.keys.modal(function (e) {
      if (e.key === 'Escape') { close(false); return true; }
      // the Mac behind the welcome sheet must not react (⌘N, ⌃Space, ⇧⌘G …); the browser's own reload / dev keys still work
      if (e.metaKey || e.ctrlKey || e.altKey) {
        if (/^F\d+$/.test(e.key) || (e.shiftKey && /^[ijcIJC]$/.test(e.key)) || (!e.shiftKey && !e.altKey && /^[rR]$/.test(e.key))) return false;
        return true;
      }
      if (e.key === 'Tab') {
        var f = [].slice.call(panel.querySelectorAll('button'));
        var i = f.indexOf(document.activeElement);
        var n = e.shiftKey ? (i <= 0 ? f.length - 1 : i - 1) : (i === f.length - 1 ? 0 : i + 1);
        f[n].focus();
        return true;
      }
      return false;
    });
    (registry.length ? startBtn : freeBtn).focus();
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
        if (i >= 0 && !data.freePlay) {
          var step = m.steps[i];
          var t0 = stepStartMs[m.id + '/' + step.id];
          if (t0 && Date.now() - t0 >= 60000 && !nudge.text) {
            var start = r.stepStart[step.id] || r.startSeq || 0;
            if (LAB.bus.find('term:run', null, start)) { nudge = { stepId: step.id, text: whereNudge(step) }; announce(nudge.text); }
          }
        }
        render();
      }, 5000);
    }
  }, 80);

  LAB.ready(function () {
    var m = missions.current();
    if (m) { startStepClock(m, rec(m.id)); }
    if (missions.pendingStart) { missions.start(missions.pendingStart); missions.pendingStart = null; }
    render(true);
  }, 85);

  LAB.ready(function () {
    if (LAB.desktop && LAB.desktop.phoneBlocked) { LAB.bus.once('phone:continue', showWelcome); }
    else showWelcome();
  }, 95);

  LAB.missions = missions;
})(window.LAB);
