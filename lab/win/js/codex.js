/* codex.js — LAB.codex (portable logic: projects, chats, reply engine, intents) + the Codex app window (skin).
   DESIGN M§3.11 (intent API), M§4.4 (app), M§3.10 (drop targets) + W6 (Windows chrome, Windows paths). The real Codex UI language is English; our replies are Chinese.
   Every path the student can read goes through toWin (LAB.win.toWin): the Trust dialog, project tooltips, and the replies that name a folder or a file.
   The model, the events and the files keep INTERNAL paths (/Users/an/...); relative paths in step lines stay as the real app prints them (output/report.md). */
(function (LAB) {
  'use strict';

  var h = LAB.util.h;
  var vfs = LAB.vfs;
  var HOME = vfs.HOME;
  var DOCS = HOME + '/Documents';
  var MAX_TEXT = 20000;

  /* internal path -> what Windows shows; LAB.win is looked up at call time, the fallback only covers a half-loaded page */
  function toWin(p) {
    if (p === null || p === undefined) return '';
    if (LAB.win && LAB.win.toWin) return LAB.win.toWin(p);
    var s = String(p);
    return s.charAt(0) === '/' ? 'C:' + (s === '/' ? '\\' : s.replace(/\//g, '\\')) : s;
  }

  /* ====================================================================== */
  /*  MODEL  (no DOM in this part)                                          */
  /* ====================================================================== */
  var M = {
    projects: [],          // [{path, name}]
    chats: [],             // chat objects (drafts included, see below)
    activeId: null,
    nextN: 1,
    nextOrder: 1,
    pendingTrust: null,    // path whose Trust modal is showing
    composer: {},          // chatId -> text typed but not sent (memory only)
    collapsed: {},         // project path -> true
    listeners: []
  };
  /* chat = {id, title, projectPath|null, messages:[{role,text,steps?,files?,elapsed?}], createdAt, order,
             draft:boolean, unread:boolean, busy:boolean, pending:null|{status,steps:[{text,done}],text,startedAt}, timers:[], removed:boolean} */

  function onModel(fn) {
    M.listeners.push(fn);
    return function () { var i = M.listeners.indexOf(fn); if (i >= 0) M.listeners.splice(i, 1); };
  }
  function notify(kind) {
    M.listeners.slice().forEach(function (fn) { try { fn(kind); } catch (e) { console.error('[codex] view update failed', e); } });
  }
  function dirty() { if (LAB.store && LAB.store.markDirty) LAB.store.markDirty(); }
  /* a student-readable reason for a failed file action (never raw "ENOTDIR: /Users/..." text) */
  var ERR_ZH = {
    ENOTDIR: '這個路徑中間有一個是檔案，不是資料夾', ENOENT: '找不到這個位置', EEXIST: '已經有同名的項目', EISDIR: '這個名稱是資料夾',
    EACCES: '這個位置不能寫入', EPROTECTED: '這是系統用的檔案夾，不能改', ENOSPC: '練習用的空間滿了', ENAMETOOLONG: '名稱太長', EINVAL: '這個名稱或路徑不能用'
  };
  function errZh(e) {
    if (e && e.code && ERR_ZH[e.code]) return ERR_ZH[e.code];
    var m = e && e.message ? String(e.message) : '';
    return /[^\x00-\x7f]/.test(m) ? m : '發生了預料之外的錯誤';
  }
  function emit(name, payload) { return LAB.bus.emit(name, payload); }

  function samePath(a, b) {
    if (!a && !b) return true;
    if (!a || !b) return false;
    return vfs.same(a, b);
  }
  function findChat(id) {
    for (var i = 0; i < M.chats.length; i++) if (M.chats[i].id === id) return M.chats[i];
    return null;
  }
  function findProject(path) {
    for (var i = 0; i < M.projects.length; i++) if (samePath(M.projects[i].path, path)) return M.projects[i];
    return null;
  }
  function newId() { return 'c' + (M.nextN++); }
  function mkChat(projectPath, draft) {
    return {
      id: newId(), title: 'New chat', projectPath: projectPath || null, messages: [], createdAt: LAB.clock.ms(),
      order: draft ? 0 : M.nextOrder++, draft: !!draft, unread: false, busy: false, pending: null, timers: [], removed: false
    };
  }
  function cancelTimers(chat) {
    chat.timers.forEach(function (t) { clearTimeout(t); });
    chat.timers.length = 0;
  }
  function chatsOf(path) {
    return M.chats.filter(function (c) { return !c.draft && samePath(c.projectPath, path); }).sort(function (a, b) { return b.order - a.order; });
  }
  function orphans() {
    return M.chats.filter(function (c) { return !c.draft && !c.projectPath; }).sort(function (a, b) { return b.order - a.order; });
  }
  function activeChat() { return M.activeId ? findChat(M.activeId) : null; }
  function workingDir(chat) { return (chat && chat.projectPath) || DOCS; }

  function pruneDrafts() {
    M.chats = M.chats.filter(function (c) { return !(c.draft && c.id !== M.activeId && !M.composer[c.id]); });
  }
  function setActive(id) {
    M.activeId = id;
    var c = findChat(id);
    if (c) c.unread = false;
    pruneDrafts();
  }
  function draftFor(projectPath) {
    for (var i = 0; i < M.chats.length; i++) {
      var c = M.chats[i];
      if (c.draft && samePath(c.projectPath, projectPath)) return c;
    }
    var d = mkChat(projectPath, true);
    M.chats.push(d);
    return d;
  }
  function ensureActive() {
    if (activeChat()) return;
    var d = draftFor(null);
    M.activeId = d.id;
  }

  function seedChats() {
    function at(y, mo, d, hh, mm) { return new Date(y, mo - 1, d, hh, mm, 0).getTime(); }
    return [
      { id: 'seed-2', title: '英文信件潤稿', projectPath: null, createdAt: at(2026, 9, 30, 21, 10), order: 1, draft: false, unread: false, busy: false, pending: null, timers: [], removed: false,
        messages: [{ role: 'user', text: '幫我把這封英文信改得更有禮貌' }, { role: 'assistant', text: '可以，請把信的內容貼給我。', steps: [], files: [] }] },
      { id: 'seed-1', title: '整理課堂筆記', projectPath: null, createdAt: at(2026, 10, 2, 9, 50), order: 2, draft: false, unread: true, busy: false, pending: null, timers: [], removed: false,
        messages: [{ role: 'user', text: '幫我整理這堂課的筆記' }, { role: 'assistant', text: '好，請把筆記貼過來，我會幫你分段。', steps: [], files: [] }] }
    ];
  }
  function resetModel() {
    M.chats.forEach(function (c) { c.removed = true; cancelTimers(c); });
    M.projects = [];
    M.chats = seedChats();
    M.activeId = null;
    M.nextN = 1;
    M.nextOrder = 3;
    M.pendingTrust = null;
    M.composer = {};
    M.collapsed = {};
  }
  resetModel();

  /* ---------------------------------------------------------------- store */
  function cleanStr(v, max) { return typeof v === 'string' ? v.slice(0, max) : ''; }
  function isObj(v) { return v && typeof v === 'object' && !Array.isArray(v); }

  LAB.store.register('codex', {
    serialize: function () {
      var chats = [];
      M.chats.forEach(function (c) {
        if (c.draft) return;
        var msgs = c.messages.slice();
        // an unfinished reply: the request is kept and answered again after the reload (see resumeReplies)
        var resume = !!(c.busy && msgs.length && msgs[msgs.length - 1].role === 'user');
        if (!msgs.length) return;
        chats.push({
          id: c.id, title: c.title, projectPath: c.projectPath, createdAt: c.createdAt, order: c.order, unread: !!c.unread, resume: resume || undefined,
          messages: msgs.map(function (m) {
            var o = { role: m.role, text: m.text };
            if (m.steps && m.steps.length) o.steps = m.steps.slice();
            if (m.files && m.files.length) o.files = m.files.slice();
            if (m.elapsed) o.elapsed = m.elapsed;
            return o;
          })
        });
      });
      var act = activeChat();
      return {
        v: 1, projects: M.projects.map(function (p) { return { path: p.path, name: p.name }; }), chats: chats, nextN: M.nextN, nextOrder: M.nextOrder,
        active: act && !act.draft ? act.id : undefined,
        activeProject: act && act.draft && act.projectPath ? act.projectPath : undefined,
        trust: M.pendingTrust || undefined
      };
    },
    restore: function (json) {
      if (json === undefined) { resetModel(); return; }
      if (!isObj(json)) throw new Error('bad codex slice');
      resetModel();
      M.chats = [];
      var seenId = {};
      var maxN = 0, maxOrder = 0;
      if (Array.isArray(json.projects)) {
        json.projects.slice(0, 100).forEach(function (p) {
          if (!isObj(p) || typeof p.path !== 'string' || p.path.charAt(0) !== '/') return;
          var path = vfs.canon(p.path);
          if (findProject(path)) return;
          M.projects.push({ path: path, name: cleanStr(p.name, 255) || vfs.basename(path) });
        });
      }
      if (Array.isArray(json.chats)) {
        json.chats.slice(0, 300).forEach(function (c) {
          if (!isObj(c) || typeof c.id !== 'string' || !/^[A-Za-z0-9_-]{1,40}$/.test(c.id) || seenId[c.id] || !Array.isArray(c.messages)) return;
          var msgs = [];
          c.messages.slice(0, 400).forEach(function (m) {
            if (!isObj(m) || (m.role !== 'user' && m.role !== 'assistant') || typeof m.text !== 'string') return;
            var o = { role: m.role, text: m.text.slice(0, MAX_TEXT) };
            if (m.role === 'assistant') {
              o.steps = Array.isArray(m.steps) ? m.steps.filter(function (s) { return typeof s === 'string'; }).slice(0, 40).map(function (s) { return s.slice(0, 300); }) : [];
              o.files = Array.isArray(m.files) ? m.files.filter(function (s) { return typeof s === 'string' && s.charAt(0) === '/'; }).slice(0, 80) : [];
              if (typeof m.elapsed === 'number' && isFinite(m.elapsed)) o.elapsed = Math.max(0, Math.min(3600, Math.round(m.elapsed)));
            }
            msgs.push(o);
          });
          if (!msgs.length) return;
          var pp = typeof c.projectPath === 'string' && c.projectPath.charAt(0) === '/' ? vfs.canon(c.projectPath) : null;
          if (pp && !findProject(pp)) pp = null;      // its project is gone: the chat becomes an orphan
          var order = typeof c.order === 'number' && isFinite(c.order) ? c.order : 0;
          seenId[c.id] = true;
          var m1 = /^c(\d+)$/.exec(c.id);
          if (m1) maxN = Math.max(maxN, parseInt(m1[1], 10));
          maxOrder = Math.max(maxOrder, order);
          M.chats.push({
            id: c.id, title: cleanStr(c.title, 120) || 'New chat', projectPath: pp, messages: msgs,
            createdAt: typeof c.createdAt === 'number' ? c.createdAt : 0, order: order, draft: false, unread: !!c.unread,
            busy: false, pending: null, timers: [], removed: false, resume: c.resume === true && msgs[msgs.length - 1].role === 'user'
          });
        });
      }
      if (!M.chats.length && !Array.isArray(json.chats)) M.chats = seedChats();
      // back to the chat (or the project) the student was in, and to an unanswered Trust prompt
      if (typeof json.active === 'string' && findChat(json.active)) M.activeId = json.active;
      else if (typeof json.activeProject === 'string' && findProject(vfs.canon(json.activeProject))) M.activeId = draftFor(vfs.canon(json.activeProject)).id;
      if (typeof json.trust === 'string' && json.trust.charAt(0) === '/' && vfs.isDir(json.trust) && !findProject(vfs.canon(json.trust))) M.pendingTrust = vfs.canon(json.trust);
      M.nextN = Math.max(maxN + 1, typeof json.nextN === 'number' ? Math.min(json.nextN, 1e6) : 1);
      M.nextOrder = Math.max(maxOrder + 1, typeof json.nextOrder === 'number' ? Math.min(json.nextOrder, 1e6) : 1, 3);
    },
    reset: function () { resetModel(); notify('all'); }
  });

  /* ====================================================================== */
  /*  INTENT ENGINE                                                         */
  /* ====================================================================== */
  var intentList = [];
  var intentSeq = 0;
  var api = {};

  function escRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function norm(s) { return String(s).normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim(); }
  /* ASCII keywords match on word boundaries; anything with a CJK character matches as a substring (§4.4.5) */
  function kw(t, k) {
    if (/[^\x00-\x7f]/.test(k)) return t.indexOf(k) >= 0;
    return new RegExp('(^|[^a-z0-9_])' + escRe(k) + '($|[^a-z0-9_])').test(t);
  }
  function anyKw(t, list) { for (var i = 0; i < list.length; i++) if (kw(t, list[i])) return true; return false; }

  api.registerIntent = function (def, opts) {
    var item = { def: def, priority: (opts && typeof opts.priority === 'number') ? opts.priority : 0, i: intentSeq++ };
    intentList.push(item);
    intentList.sort(function (a, b) { return b.priority - a.priority || a.i - b.i; });
    api.intents.length = 0;
    intentList.forEach(function (x) { api.intents.push(x.def); });
    return function () {
      var k = intentList.indexOf(item);
      if (k >= 0) intentList.splice(k, 1);
      api.intents.length = 0;
      intentList.forEach(function (x) { api.intents.push(x.def); });
    };
  };
  api.intents = [];

  function pickIntent(text, rawText, chat, project, cwd) {
    var ctx = { chat: chat, project: project, cwd: cwd, rawText: rawText };
    for (var i = 0; i < intentList.length; i++) {
      var d = intentList[i].def, ok = false;
      try { ok = !!d.test(text, ctx); } catch (e) { console.error('[codex] intent test failed', d.id, e); }
      if (ok) return d;
    }
    return null;
  }

  /* The recording context: reads happen now (so run() can use them), everything with a side effect or a visible step is
     queued and replayed on the reply timeline (§4.4.4: a side effect happens exactly when its step line appears). */
  function makeCtx(chat, project, text, rawText) {
    var cwd = workingDir(chat);
    var shadow = new Map();        // folded abs path -> string content | {dir:true}
    var actions = [], texts = [], files = [];
    function fold(p) { return String(p).normalize('NFC').toLowerCase(); }
    function abs(rel) { return vfs.canon(rel, cwd); }
    function guard(p) { if (!vfs.isUnder(p, cwd)) throw new Error('這個路徑在工作資料夾外面：' + toWin(p)); return p; }
    function display(p) { return vfs.isUnder(p, cwd) && fold(p) !== fold(cwd) ? p.slice(cwd.length + (cwd === '/' ? 0 : 1)) : p; }
    function pushFile(p) { if (files.indexOf(p) < 0) files.push(p); }
    var ctx = {
      text: text, rawText: rawText, chat: chat, project: project, cwd: cwd,
      abs: abs,
      exists: function (rel) { var p = abs(rel); return shadow.has(fold(p)) || vfs.exists(p); },
      read: function (rel) {
        var p = guard(abs(rel)), k = fold(p);
        var content = null;
        if (shadow.has(k)) { var sv = shadow.get(k); if (typeof sv === 'string') content = sv; }
        else if (vfs.isFile(p)) { content = vfs.readFile(p); }
        if (content === null) return null;
        actions.push({ type: 'step', text: 'Read ' + display(p), apply: function () { try { vfs.readFile(p, { by: 'codex' }); } catch (e) { /* the file may have gone meanwhile */ } } });
        return content;
      },
      write: function (rel, content) {
        var p = guard(abs(rel)), k = fold(p);
        if (vfs.isDir(p)) throw new Error('這個名稱已經是資料夾：' + display(p));
        var existed = shadow.has(k) ? typeof shadow.get(k) === 'string' : vfs.isFile(p);
        content = String(content);
        shadow.set(k, content);
        pushFile(p);
        actions.push({
          type: 'step', text: (existed ? 'Edited ' : 'Created ') + display(p),
          apply: function () {
            var dir = vfs.dirname(p);
            if (!vfs.exists(dir)) vfs.mkdir(dir, { by: 'codex', parents: true });
            vfs.writeFile(p, content, { by: 'codex' });
          }
        });
        return { created: !existed };
      },
      mkdir: function (rel) {
        var p = guard(abs(rel)), k = fold(p);
        if (shadow.has(k) || vfs.exists(p)) return { created: false };
        shadow.set(k, { dir: true });
        pushFile(p);
        actions.push({ type: 'step', text: 'Created ' + display(p) + '/', apply: function () { vfs.mkdir(p, { by: 'codex', parents: true }); } });
        return { created: true };
      },
      list: function (rel) {
        try { return vfs.list(abs(rel === undefined ? '.' : rel)); } catch (e) { return []; }
      },
      step: function (t) { actions.push({ type: 'step', text: String(t) }); },
      say: function (t) { texts.push(String(t)); }
    };
    return { ctx: ctx, actions: actions, texts: texts, files: files };
  }

  /* ---- the reply timeline (owned by the chat, not the window, §3.11) ---- */
  function T(chat, ms, fn) {
    var id = setTimeout(function () {
      var i = chat.timers.indexOf(id);
      if (i >= 0) chat.timers.splice(i, 1);
      if (chat.removed) return;
      try { fn(); } catch (e) { console.error('[codex] reply step failed', e); }
    }, ms);
    chat.timers.push(id);
  }

  function runReply(chat, intent, rawText, text) {
    var project = chat.projectPath ? findProject(chat.projectPath) : null;
    var rec = makeCtx(chat, project, text, rawText);
    var started = chat.pending.startedAt;

    function play() {
      if (chat.removed) return;
      var steps = rec.actions.filter(function (a) { return a.type === 'step'; });
      var full = rec.texts.join('\n');
      if (full.length > MAX_TEXT) full = full.slice(0, MAX_TEXT);
      var interval = Math.min(450, Math.floor(2700 / Math.max(1, steps.length)));
      T(chat, 300, function () { chat.pending.status = 'working'; notify('pending'); });
      var t = 700;
      steps.forEach(function (a, i) {
        T(chat, t + i * interval, function () {
          var s = { text: a.text, done: false };
          chat.pending.steps.push(s);
          try { if (a.apply) a.apply(); }
          catch (e) { rec.texts.push('（「' + a.text + '」沒有做成：' + errZh(e) + '）'); full = rec.texts.join('\n'); }
          notify('pending');
          T(chat, 250, function () { s.done = true; notify('pending'); });
        });
      });
      var textAt = steps.length ? t + (steps.length - 1) * interval + 450 : t;
      T(chat, textAt, function () { stream(full); });
    }

    function stream(full) {
      var chars = Array.from(full);
      var total = chars.length;
      if (!total) { finish(full); return; }
      var dur = Math.min(2200, (total / 45) * 1000);
      var tick = 50;
      var n = Math.max(1, Math.ceil(dur / tick));
      var per = Math.ceil(total / n);
      var shown = 0;
      (function step() {
        shown = Math.min(total, shown + per);
        chat.pending.status = null;
        chat.pending.text = chars.slice(0, shown).join('');
        notify('pending');
        if (shown >= total) T(chat, 150, function () { finish(full); });
        else T(chat, tick, step);
      })();
    }

    function finish(full) {
      var elapsed = Math.max(2, Math.round((LAB.clock.ms() - started) / 1000));
      var msg = { role: 'assistant', text: full, steps: chat.pending.steps.map(function (s) { return s.text; }), files: rec.files.slice(), elapsed: elapsed };
      chat.messages.push(msg);
      chat.pending = null;
      chat.busy = false;
      if (M.activeId !== chat.id) chat.unread = true;
      notify('all');
      dirty();
      emit('codex:reply', { chatId: chat.id, projectPath: chat.projectPath, intent: intent.id, files: msg.files.slice(), text: full });
      notify('focus-if-idle');
    }

    var run;
    try { run = intent.run(rec.ctx); }
    catch (e) { rec.ctx.say('（這個動作沒有做成：' + errZh(e) + '）'); play(); return; }
    Promise.resolve(run).then(play, function (e) {
      rec.ctx.say('（這個動作沒有做成：' + errZh(e) + '）');
      play();
    });
  }

  function titleFor(intent, rawText) {
    var id = intent ? intent.id : '';
    if (id === 'write_report') return '寫報告';
    if (id === 'write_agents') return 'AGENTS.md';
    if (id === 'list_files') return '列出檔案';
    if (id === 'ask_rules') return '專案規則';
    return Array.from(String(rawText).replace(/\s+/g, ' ').trim()).slice(0, 12).join('') || 'New chat';
  }

  function send(chat, rawIn) {
    var rawText = String(rawIn === undefined || rawIn === null ? '' : rawIn).replace(/^\s+|\s+$/g, '');
    if (!rawText || !chat || chat.busy || chat.removed) return false;
    if (rawText.length > MAX_TEXT) rawText = rawText.slice(0, MAX_TEXT);
    var project = chat.projectPath ? findProject(chat.projectPath) : null;
    var text = norm(rawText);
    var intent = pickIntent(text, rawText, chat, project, workingDir(chat)) || FALLBACK;
    chat.messages.push({ role: 'user', text: rawText });
    if (chat.draft) {
      chat.draft = false;
      chat.title = titleFor(intent, rawText);
      chat.order = M.nextOrder++;
      chat.createdAt = LAB.clock.ms();
    }
    delete M.composer[chat.id];
    chat.busy = true;
    chat.pending = { status: null, steps: [], text: '', startedAt: LAB.clock.ms() };
    emit('codex:send', { chatId: chat.id, projectPath: chat.projectPath, text: rawText });
    notify('all');
    dirty();
    runReply(chat, intent, rawText, text);
    return true;
  }

  /* After a reload: a request that was still being answered is answered again (the files it wrote before the reload are kept) */
  function resumeReplies() {
    M.chats.slice().forEach(function (c) {
      if (!c.resume) return;
      delete c.resume;
      var last = c.messages[c.messages.length - 1];
      if (!last || last.role !== 'user') return;
      var project = c.projectPath ? findProject(c.projectPath) : null;
      var text = norm(last.text);
      var intent = pickIntent(text, last.text, c, project, workingDir(c)) || FALLBACK;
      c.busy = true;
      c.pending = { status: null, steps: [], text: '', startedAt: LAB.clock.ms() };
      runReply(c, intent, last.text, text);
    });
  }

  /* ====================================================================== */
  /*  BUILT-IN INTENTS (§4.4.5)                                             */
  /* ====================================================================== */
  var WRITE_CJK = ['加', '寫', '新增', '加入', '更新', '改'];
  var WRITE_ASCII = ['add', 'write', 'update', 'append'];
  function hasWriteVerb(t) {
    for (var i = 0; i < WRITE_CJK.length; i++) if (t.indexOf(WRITE_CJK[i]) >= 0) return true;
    return anyKw(t, WRITE_ASCII);
  }
  function trimStr(s) { return String(s).replace(/^\s+|\s+$/g, ''); }
  function firstQuote(raw) {
    var m = /[「『“"]([^」』”"\n]+)[」』”"]/.exec(raw);
    return m ? trimStr(m[1]) : '';
  }
  function unique(arr) { var out = []; arr.forEach(function (x) { if (out.indexOf(x) < 0) out.push(x); }); return out; }
  function rel2(p, cwd) { return vfs.isUnder(p, cwd) && p !== cwd ? p.slice(cwd.length + 1) : p; }

  function csvStats(text) {
    var lines = String(text).split(/\r?\n/).filter(function (l) { return trimStr(l) !== ''; });
    if (lines.length < 2) return null;
    var head = lines[0].split(',').map(trimStr);
    var si = head.indexOf('score');
    if (si < 0) si = head.length > 1 ? 1 : 0;
    var n = 0, sum = 0, min = Infinity, max = -Infinity, pass = 0;
    for (var i = 1; i < lines.length; i++) {
      var v = parseFloat(lines[i].split(',')[si]);
      if (!isFinite(v)) continue;
      n++; sum += v; if (v < min) min = v; if (v > max) max = v; if (v >= 60) pass++;
    }
    if (!n) return null;
    return { n: n, mean: sum / n, min: min, max: max, pass: pass };
  }
  function f1(x) { return (Math.round(x * 10) / 10).toFixed(1); }
  function classLabel(file) {
    var base = file.replace(/\.csv$/i, '');
    return /^[A-Za-z]$/.test(base) ? base.toUpperCase() + ' 班' : base;
  }
  /* the csv files a project chat works on: data/*.csv, else the csv files directly in the folder */
  function findCsvs(ctx) {
    function pick(dir) {
      return ctx.list(dir).filter(function (s) { return s.type === 'file' && s.kind === 'text' && /\.csv$/i.test(s.name); })
        .map(function (s) { return dir === '.' ? s.name : dir + '/' + s.name; });
    }
    var a = pick('data');
    return a.length ? a : pick('.');
  }
  function loadStats(ctx) {
    var out = [];
    findCsvs(ctx).forEach(function (rel) {
      var txt = ctx.read(rel);
      var st = txt === null ? null : csvStats(txt);
      if (st) out.push({ rel: rel, name: rel.split('/').pop(), label: classLabel(rel.split('/').pop()), st: st });
    });
    return out;
  }

  api.registerIntent({
    id: 'write_agents',
    test: function (t, ctx) {
      if (!(kw(t, 'agents.md') && hasWriteVerb(t))) return false;
      var raw = ctx && ctx.rawText ? ctx.rawText : t;
      return !!firstQuote(raw) || /加入|加進|加到|加上|新增|追加|寫進|寫入|圖表|figures|\b(?:add|append|update)\b/.test(t);
    },
    run: function (ctx) {
      var raw = ctx.rawText;
      var rule = firstQuote(raw);
      if (!rule) {
        if (/圖表|figures/i.test(raw)) rule = '圖表存到 figures/';
        else {
          var m = /(?:加入|加上|加進|寫進|寫入|新增)[：:\s]*([^\n]+)$/.exec(raw);
          rule = m ? m[1] : '';
          rule = rule.replace(/\s*(?:到|進|裡面?|中)?\s*agents\.md.*$/i, '').replace(/[。.!！?？\s]+$/, '');
          rule = trimStr(rule);
        }
      }
      rule = trimStr(String(rule).replace(/\s+/g, ' '));
      if (!rule) { ctx.say('請把要加的規則用「」框起來，例如：把「圖表存到 figures/」加進 AGENTS.md'); return; }
      var line = '- ' + rule;
      if (ctx.exists('AGENTS.md')) {
        var cur = ctx.read('AGENTS.md') || '';
        var have = cur.split(/\r?\n/).map(trimStr);
        if (have.indexOf(line) >= 0) { ctx.say('AGENTS.md 裡已經有這條規則了：\n' + line); return; }
        ctx.write('AGENTS.md', cur + (cur && !/\n$/.test(cur) ? '\n' : '') + line + '\n');
        ctx.say('已把這條規則加進 AGENTS.md：\n' + line);
      } else {
        ctx.write('AGENTS.md', '# 這個專案在做什麼\n\n# 希望 AI 怎麼幫忙\n' + line + '\n\n# 有哪些事情不要做\n');
        ctx.say('這個資料夾裡還沒有 AGENTS.md，我幫你建立了一份，並加進這條規則。' +
          (ctx.project ? '' : '\n（注意：這個對話不在專案裡，所以檔案放在 ' + toWin(ctx.cwd) + '。）'));
      }
    }
  }, { priority: 90 });

  api.registerIntent({
    id: 'ask_rules',
    test: function (t) {
      if ((t.indexOf('資料夾') >= 0 || t.indexOf('目錄') >= 0 || kw(t, 'folder')) && (t.indexOf('建立') >= 0 || t.indexOf('新增') >= 0 || kw(t, 'mkdir') || kw(t, 'create'))) return false;
      return (t.indexOf('規則') >= 0 || t.indexOf('遵守') >= 0 || t.indexOf('記得') >= 0 || t.indexOf('你知道這個專案') >= 0 || kw(t, 'agents') || kw(t, 'rules')) && !hasWriteVerb(t);
    },
    run: function (ctx) {
      if (!ctx.project) {
        ctx.say('這個對話不在任何專案底下，我看不到專案裡的 AGENTS.md，所以不知道它的規則。要用專案的規則，請先在專案底下開對話。');
        return;
      }
      var cur = ctx.read('AGENTS.md');
      if (cur === null) { ctx.say('這個專案裡沒有 AGENTS.md，所以我沒有額外的規則。'); return; }
      var rules = cur.split(/\r?\n/).map(trimStr).filter(function (l) { return l && l.charAt(0) !== '#'; });
      if (!rules.length) { ctx.say('我讀了 AGENTS.md，但裡面還沒有寫任何規則。'); return; }
      ctx.say('我讀了 AGENTS.md，目前有這些規則：\n' + rules.join('\n') + '\n我會照這些做。');
    }
  }, { priority: 80 });

  api.registerIntent({
    id: 'list_paths',
    test: function (t) {
      var pathWord = t.indexOf('完整路徑') >= 0 || t.indexOf('路徑') >= 0 || t.indexOf('放在哪') >= 0 || t.indexOf('在哪裡') >= 0 || t.indexOf('位置') >= 0 || kw(t, 'full path') || kw(t, 'path');
      if (pathWord && (t.indexOf('列出') >= 0 || t.indexOf('告訴我') >= 0 || t.indexOf('哪') >= 0 || t.indexOf('是什麼') >= 0 || t.indexOf('是多少') >= 0 || t.indexOf('給我') >= 0 || t.indexOf('顯示') >= 0 || anyKw(t, ['what', 'where', 'show', 'list', 'tell']))) return true;
      // 「你剛剛建立了哪些檔案」「what files did you create」
      var madeWord = /剛|建立|新增|產生|做了|寫了|\bcreat(?:e|ed)\b|\bmade\b|\bwrote\b|\badded\b|\bnew\b/.test(t);
      var fileWord = t.indexOf('檔案') >= 0 || /\bfiles?\b/.test(t);
      return madeWord && fileWord && (t.indexOf('哪') >= 0 || t.indexOf('什麼') >= 0 || /\b(what|which|where|list)\b/.test(t));
    },
    run: function (ctx) {
      var all = [];
      ctx.chat.messages.forEach(function (m) { if (m.role === 'assistant' && m.files) all = all.concat(m.files); });
      all = unique(all);
      ctx.say(all.length ? '新增：\n' + all.map(toWin).join('\n') : '這個對話還沒有新增任何檔案。');
    }
  }, { priority: 75 });

  api.registerIntent({
    id: 'write_report',
    test: function (t) {
      var topic = t.indexOf('報告') >= 0 || kw(t, 'report');
      if (!topic) return false;
      // a bare 「報告」/「一份報告」/「report」 is a request too
      if (/^(請|幫我|我要|我想要|給我)?\s*(一份|一個)?\s*(成績|資料)?\s*(報告|report)[。.!！\s]*$/.test(t)) return true;
      var verb = ['寫', '做', '產生', '建立', '生成', '幫我', '產出', '輸出', '出一', '出份', '整理', '放', '存', '製作', '撰', '給我', '想要', '我要', '請'].some(function (k) { return t.indexOf(k) >= 0; }) ||
        anyKw(t, ['write', 'create', 'make', 'generate', 'produce', 'save', 'put']);
      return verb;
    },
    run: function (ctx) {
      var raw = ctx.rawText;
      var target = 'output/report.md';
      // only the ASCII path counts: 「幫我寫一份報告到output/report.md」 (no space after the Chinese) still means output/report.md
      var m = /(?:^|[^A-Za-z0-9_.\/-])((?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+\.(?:md|txt))(?![A-Za-z0-9_])/.exec(raw);
      if (m && m[1].length < 120) target = m[1];
      target = target.replace(/^(\.\/)+/, '');
      if (/^\//.test(target) || /(^|\/)\.\.(\/|$)/.test(target) || target.charAt(target.length - 1) === '/') target = 'output/report.md';

      var agentsRead = false, stats = [];
      if (ctx.project) {
        agentsRead = ctx.read('AGENTS.md') !== null;
        stats = loadStats(ctx);
      }
      var body;
      if (stats.length) {
        var out = ['# 成績報告', '', '## 資料來源'];
        stats.forEach(function (s) { out.push('- ' + s.rel + '（' + s.st.n + ' 筆）'); });
        out.push('', '## 各班統計', '', '| 班級 | 人數 | 平均 | 最低 | 最高 | 60 分以上 |', '| --- | --- | --- | --- | --- | --- |');
        var total = 0, pass = 0, hi = stats[0], lo = stats[0];
        stats.forEach(function (s) {
          out.push('| ' + s.label + ' | ' + s.st.n + ' | ' + f1(s.st.mean) + ' | ' + s.st.min + ' | ' + s.st.max + ' | ' + s.st.pass + ' |');
          total += s.st.n; pass += s.st.pass;
          if (s.st.mean > hi.st.mean) hi = s;
          if (s.st.mean < lo.st.mean) lo = s;
        });
        out.push('', '## 觀察', '');
        if (stats.length > 1) out.push('- 平均分數最高的是 ' + hi.label + '（' + f1(hi.st.mean) + ' 分），最低的是 ' + lo.label + '（' + f1(lo.st.mean) + ' 分）。');
        else out.push('- 只有一份資料：' + hi.label + '，平均 ' + f1(hi.st.mean) + ' 分。');
        out.push('- 全部 ' + total + ' 位學生裡，有 ' + pass + ' 位達到 60 分以上（' + Math.round(pass / total * 100) + '%）。');
        body = out.join('\n') + '\n';
      } else {
        body = '# 報告\n\n' +
          (ctx.project ? '這個專案資料夾裡沒有找到 data 裡的資料檔，所以這份報告只有範例內容。' : '這個對話不在專案裡，我沒有找到你的資料檔，所以這份報告只有範例內容。') +
          '\n\n## 範例段落\n- 這裡可以放資料來源\n- 這裡可以放統計結果\n- 這裡可以放你的觀察\n';
      }
      var r = ctx.write(target, body);
      ctx.say((r.created ? '已建立 ' + target : '已更新 ' + target + '（原本的內容被取代了）') +
        (agentsRead ? '\n照 AGENTS.md：報告用繁體中文，輸出放在 output/。' : ''));
    }
  }, { priority: 70 });

  api.registerIntent({
    id: 'make_folder',
    test: function (t) {
      return (t.indexOf('建立') >= 0 || t.indexOf('新增') >= 0 || kw(t, 'mkdir') || kw(t, 'create')) &&
        (t.indexOf('資料夾') >= 0 || t.indexOf('目錄') >= 0 || kw(t, 'folder'));
    },
    run: function (ctx) {
      var raw = ctx.rawText;
      var name = firstQuote(raw);
      if (!name) {
        var cut = raw.search(/資料夾|目錄|folder|mkdir|create|建立|新增/i);
        var rest = cut >= 0 ? raw.slice(cut) : raw;
        var m = /[A-Za-z0-9_][A-Za-z0-9_.\-/]*/.exec(rest.replace(/^(?:資料夾|目錄|folder|mkdir|create|建立|新增)/i, '')) || /[A-Za-z0-9_][A-Za-z0-9_.\-/]*/.exec(raw);
        name = m ? m[0] : '';
      }
      name = name.replace(/^(\.\/)+/, '').replace(/\/+$/, '');
      if (!name || /^\//.test(name) || /(^|\/)\.\.(\/|$)/.test(name)) name = 'figures';
      if (ctx.exists(name)) { ctx.say(name + '/ 已經存在，我沒有改動它。'); return; }
      ctx.mkdir(name);
      ctx.say('已建立資料夾 ' + name + '/');
    }
  }, { priority: 60 });

  api.registerIntent({
    id: 'summarize_data',
    test: function (t) { return ['統計', '平均', '分析', '摘要', '成績', '看一下資料'].some(function (k) { return t.indexOf(k) >= 0; }) || kw(t, 'csv'); },
    run: function (ctx) {
      var stats = loadStats(ctx);
      if (!stats.length) { ctx.say('我在這個資料夾（' + toWin(ctx.cwd) + '）裡沒有找到 CSV 檔。'); return; }
      var w = 0;
      stats.forEach(function (s) { w = Math.max(w, s.name.length); });
      w = Math.max(w, 4) + 2;
      function pad(s, n) { s = String(s); while (s.length < n) s += ' '; return s; }
      var lines = [pad('file', w) + pad('count', 7) + pad('mean', 7) + pad('min', 6) + 'max'];
      stats.forEach(function (s) { lines.push(pad(s.name, w) + pad(s.st.n, 7) + pad(f1(s.st.mean), 7) + pad(s.st.min, 6) + s.st.max); });
      ctx.say('我讀了 ' + stats.length + ' 個 CSV 檔，每一檔的統計如下：\n```\n' + lines.join('\n') + '\n```');
    }
  }, { priority: 55 });

  api.registerIntent({
    id: 'list_files',
    test: function (t) {
      return t.indexOf('列出') >= 0 || t.indexOf('有哪些檔案') >= 0 || t.indexOf('目前有什麼') >= 0 || kw(t, 'ls') || kw(t, 'list files') ||
        ((t.indexOf('有什麼') >= 0 || t.indexOf('有哪些') >= 0 || t.indexOf('裡面') >= 0) && (t.indexOf('檔案') >= 0 || t.indexOf('資料夾') >= 0 || t.indexOf('目錄') >= 0 || kw(t, 'folder') || kw(t, 'files'))) ||
        /(what|which) files/.test(t);
    },
    run: function (ctx) {
      var items = vfs.visible(ctx.list('.'));
      ctx.step('Listed ' + (vfs.basename(ctx.cwd) || '/') + '/');
      if (!items.length) { ctx.say(toWin(ctx.cwd) + ' 裡面目前是空的。'); return; }
      ctx.say(toWin(ctx.cwd) + ' 裡有：\n' + items.map(function (s) { return s.name + (s.type === 'dir' ? '/' : ''); }).join('\n'));
    }
  }, { priority: 50 });

  api.registerIntent({
    id: 'where_am_i',
    test: function (t) {
      return t.indexOf('在哪') >= 0 || t.indexOf('哪個資料夾') >= 0 || /目前.*位置/.test(t) || t.indexOf('工作資料夾') >= 0 || kw(t, 'pwd') || kw(t, 'cwd');
    },
    run: function (ctx) {
      ctx.say(ctx.project ? '目前的工作資料夾是 ' + toWin(ctx.cwd) + '。' : '這個對話沒有專案，所以我暫時使用 ' + toWin(ctx.cwd) + '。');
    }
  }, { priority: 45 });

  api.registerIntent({
    id: 'greet',
    test: function (t) { return t.indexOf('你好') >= 0 || t.indexOf('哈囉') >= 0 || t.indexOf('嗨') >= 0 || kw(t, 'hello') || kw(t, 'hi'); },
    run: function (ctx) { ctx.say('你好！我是練習版的 Codex。你可以請我寫報告、列出檔案、改 AGENTS.md。'); }
  }, { priority: 10 });

  /* fallback: priority -1 so that intents registered later with priority 0 still come before it (same behaviour as "0" for everything in §4.4.5) */
  var FALLBACK = {
    id: 'fallback',
    test: function () { return true; },
    run: function (ctx) {
      ctx.say('這個練習版的 Codex 只聽得懂幾種請求，例如：\n• 幫我寫一份報告到 output/report.md\n• 列出你新增的檔案完整路徑\n• 把「圖表存到 figures/」加進 AGENTS.md\n• 你目前遵守哪些規則？\n（這是教學用的模擬，不是真的 AI。）');
    }
  };
  api.registerIntent(FALLBACK, { priority: -1 });

  /* ====================================================================== */
  /*  PUBLIC API (§3.11)                                                    */
  /* ====================================================================== */
  function clone(x) { return JSON.parse(JSON.stringify(x)); }

  api.state = function () {
    return {
      projects: M.projects.map(function (p) { return { path: p.path, name: p.name, chatIds: chatsOf(p.path).map(function (c) { return c.id; }) }; }),
      chats: M.chats.map(function (c) {
        var o = { id: c.id, title: c.title, projectPath: c.projectPath, messages: clone(c.messages), createdAt: c.createdAt };
        if (c.draft) o.draft = true;
        return o;
      }),
      activeChatId: M.activeId
    };
  };
  api.activeChat = function () { var c = activeChat(); return c ? clone({ id: c.id, title: c.title, projectPath: c.projectPath, messages: c.messages, createdAt: c.createdAt, draft: c.draft }) : null; };
  api.workingDir = function (chat) { return workingDir(chat); };
  api.pendingTrust = function () { return M.pendingTrust; };

  function addProjectInternal(path) {
    var p = findProject(path);
    if (p) return { project: p, created: false };
    p = { path: path, name: vfs.basename(path) };
    M.projects.push(p);
    return { project: p, created: true };
  }
  api.addProject = function (path, o) {
    o = o || {};
    var p = vfs.canon(path);
    var trust = o.trust !== false, select = o.select !== false;
    if (!trust && !findProject(p)) { projectFlow(p); return null; }
    var r = addProjectInternal(p);
    if (select) { var d = draftFor(p); setActive(d.id); }
    emit('codex:project', { path: r.project.path, name: r.project.name });
    notify('all');
    dirty();
    return { path: r.project.path, name: r.project.name, chatIds: chatsOf(r.project.path).map(function (c) { return c.id; }) };
  };
  api.removeProject = function (path, o) {
    var keep = o && o.chats === 'keep';
    var p = vfs.canon(path);
    M.projects = M.projects.filter(function (x) { return !samePath(x.path, p); });
    var kept = [];
    M.chats.forEach(function (c) {
      if (!samePath(c.projectPath, p)) { kept.push(c); return; }
      if (keep && !c.draft) { c.projectPath = null; kept.push(c); return; }
      c.removed = true; cancelTimers(c); delete M.composer[c.id];
    });
    M.chats = kept;
    if (M.activeId && !findChat(M.activeId)) M.activeId = null;
    if (M.pendingTrust && samePath(M.pendingTrust, p)) M.pendingTrust = null;
    delete M.collapsed[p];
    ensureActive();
    notify('all');
    notify('trust');
    dirty();
  };
  api.resetChats = function () {
    M.chats.forEach(function (c) { c.removed = true; cancelTimers(c); });
    M.chats = seedChats();
    M.nextOrder = Math.max(M.nextOrder, 3);
    M.composer = {};
    M.activeId = null;
    ensureActive();
    notify('all');
    dirty();
  };
  /* extras for tests and later weeks */
  api.newChat = function (projectPath) { openWindow(); uiNewChat(projectPath ? vfs.canon(projectPath) : null); };
  api.selectProject = function (path) { openWindow(); uiSelectProject(vfs.canon(path)); };
  api.sendMessage = function (text) { ensureActive(); return send(activeChat(), text); };
  api.openFolder = function (path, via) { openWindow(); return projectFlow(vfs.canon(path), via); };

  LAB.codex = api;

  /* ====================================================================== */
  /*  USER FLOWS (shared by the view and by programmatic callers)           */
  /* ====================================================================== */
  function uiNewChat(projectPath) {
    if (M.pendingTrust) return;
    var c = draftFor(projectPath);
    setActive(c.id);
    emit('codex:new-chat', { chatId: c.id, projectPath: projectPath });
    if (projectPath) emit('codex:select-project', { path: projectPath });
    notify('all');
    notify('focus');
  }
  function uiSelectProject(path) {
    if (M.pendingTrust) return;
    var p = findProject(path);
    if (!p) return;
    var c = draftFor(p.path);
    setActive(c.id);
    emit('codex:select-project', { path: p.path });
    notify('all');
    notify('focus');
  }
  function uiSelectChat(id) {
    if (M.pendingTrust) return;
    if (!findChat(id)) return;
    setActive(id);
    notify('all');
    notify('focus');
  }
  function projectFlow(path) {
    var p = vfs.canon(path);
    if (!vfs.isDir(p)) return false;
    var ex = findProject(p);
    if (ex) { uiSelectProject(ex.path); return true; }
    if (M.pendingTrust) return false;
    M.pendingTrust = p;
    emit('codex:trust-prompt', { path: p });
    notify('trust');
    return true;
  }
  function trustFolder() {
    var p = M.pendingTrust;
    if (!p) return;
    M.pendingTrust = null;
    emit('codex:trust', { path: p });
    var r = addProjectInternal(p);
    emit('codex:project', { path: r.project.path, name: r.project.name });
    var d = draftFor(r.project.path);
    setActive(d.id);
    notify('all');
    notify('trust');
    notify('focus');
    dirty();
  }
  function cancelTrust() {
    var p = M.pendingTrust;
    if (!p) return;
    M.pendingTrust = null;
    emit('codex:trust-cancel', { path: p });
    notify('trust');
    notify('focus');
  }
  function insertMention(names) {
    ensureActive();
    var c = activeChat();
    if (!c || c.busy) return;
    var cur = M.composer[c.id] || '';
    names.forEach(function (n) { cur += (cur && !/\s$/.test(cur) ? ' ' : '') + '@' + n + ' '; });
    M.composer[c.id] = cur;
    notify('composer');
    notify('focus');
  }
  function handlePaths(paths, onlyDirs) {
    var dirs = [], files = [];
    paths.forEach(function (p) { if (vfs.isDir(p)) dirs.push(p); else if (!onlyDirs && vfs.exists(p)) files.push(vfs.basename(p)); });
    if (files.length) insertMention(files);
    if (dirs.length) projectFlow(dirs[0]);
  }

  /* ====================================================================== */
  /*  VIEW                                                                  */
  /* ====================================================================== */
  var curView = null;

  function icon(name, size) { return LAB.icons.el(name, { size: size || 16 }); }

  /* original soft-blob logo drawn as an outline (no square), used for the empty state */
  LAB.icons.add('cx-logo', '<svg viewBox="0 0 64 64"><path d="M32 8c13 0 23 8.4 23 21.4C55 43 46 53 31.6 53 18.4 53 9 43.6 9 31 9 17.4 19 8 32 8z" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round"/></svg>');

  /* ---- markdown-lite: `code`, newlines, "- " bullets, ``` blocks, absolute paths in mono; DOM nodes only (§0.5) ---- */
  var PATH_RE = /(?:[A-Za-z]:\\|\/(?:Users|Applications|Library|System|private|tmp|var)\/)[^\s,;，。、：；！？）)」』"'`<>]+/g;
  function plainWithPaths(parent, s) {
    var last = 0, m;
    PATH_RE.lastIndex = 0;
    while ((m = PATH_RE.exec(s))) {
      var p = m[0], tail = '';
      var tm = /[.]+$/.exec(p);
      if (tm) { tail = tm[0]; p = p.slice(0, p.length - tail.length); }
      if (m.index > last) parent.appendChild(document.createTextNode(s.slice(last, m.index)));
      parent.appendChild(h('span', { class: 'cx-path' }, p));
      if (tail) parent.appendChild(document.createTextNode(tail));
      last = m.index + m[0].length;
    }
    if (last < s.length) parent.appendChild(document.createTextNode(s.slice(last)));
  }
  function inlineInto(parent, s) {
    var parts = s.split('`');
    if (parts.length % 2 === 0) { plainWithPaths(parent, s); return; }
    parts.forEach(function (part, i) {
      if (!part) return;
      if (i % 2 === 1) parent.appendChild(h('code', null, part)); else plainWithPaths(parent, part);
    });
  }
  function richInto(el, text) {
    el.textContent = '';
    var lines = String(text).split('\n');
    var fence = null;
    lines.forEach(function (ln) {
      if (/^```/.test(ln)) {
        if (fence === null) { fence = []; return; }
        el.appendChild(h('div', { class: 'cx-pre' }, fence.join('\n')));
        fence = null;
        return;
      }
      if (fence !== null) { fence.push(ln); return; }
      if (ln === '') { el.appendChild(h('div', { class: 'cx-gap2' })); return; }
      var d = h('div', { class: 'cx-p' });
      var bm = /^\s*(?:-|•)\s+(.*)$/.exec(ln);
      if (bm) { d.className = 'cx-li'; inlineInto(d, bm[1]); }
      else inlineInto(d, ln);
      el.appendChild(d);
    });
    if (fence !== null) el.appendChild(h('div', { class: 'cx-pre' }, fence.join('\n')));
  }

  function openWindow() {
    var ex = LAB.wm.byApp('codex')[0];
    if (ex) { ex.focus(); return ex; }
    var sa = (LAB.stage && LAB.stage.spawnArea) ? LAB.stage.spawnArea() : { w: 900, h: 620 };
    var root = h('div', { class: 'cx-root', lang: 'en', dataset: { lab: 'cx-root' } });
    var win = LAB.wm.open({
      appId: 'codex', title: 'Codex', width: Math.min(900, sa.w), height: Math.min(620, sa.h), minW: 720, minH: 440,
      theme: 'dark', content: root, singleton: 'codex', icon: 'app-codex'
    });
    initView(win, root);
    return win;
  }

  function initView(win, root) {
    var view = {};
    var shownChatId = null, renderedSig = null, pendingChatId = null, textShown = '', prevFocus = null, offModal = null, trustEl = null;

    /* ---------- skeleton ---------- */
    var sideEl = h('nav', { class: 'cx-side', 'aria-label': 'Chats', dataset: { lab: 'cx-sidebar' } });
    var mainEl = h('section', { class: 'cx-main', dataset: { lab: 'cx-main' } });
    var headEl = h('div', { class: 'cx-head' });
    var bodyEl = h('div', { class: 'cx-body', dataset: { lab: 'cx-messages' } });
    var emptyEl = h('div', { class: 'cx-empty' });
    var msgsEl = h('div', { class: 'cx-msgs' });
    var stepsEl = h('div', { class: 'cx-steps' });
    var statusEl = h('div', { class: 'cx-status', dataset: { lab: 'cx-status' }, title: 'Working…' },
      h('span', null, 'Working'), h('span', { class: 'cx-dots', 'aria-hidden': 'true' }, h('span', null, '.'), h('span', null, '.'), h('span', null, '.')));
    var ptextEl = h('div', { class: 'cx-text' });
    var pendingEl = h('div', { class: 'cx-msg cx-asst cx-pending', hidden: true }, stepsEl, statusEl, ptextEl);
    bodyEl.appendChild(emptyEl); bodyEl.appendChild(msgsEl); bodyEl.appendChild(pendingEl);

    var chipsEl = h('div', { class: 'cx-chips', dataset: { lab: 'cx-chips' } });
    var ta = h('textarea', { class: 'cx-ta', rows: '1', placeholder: 'Do anything', 'aria-label': 'Message Codex', spellcheck: 'false', autocomplete: 'off', dataset: { lab: 'cx-composer' } });
    var plusBtn = h('button', { type: 'button', class: 'cx-comp-plus', 'aria-label': 'Add files and more',
      on: { click: function () { LAB.ui.toast('練習版沒有這個功能：把檔案或資料夾拖進 Codex 視窗就可以了'); } } }, icon('plus', 16));
    var meta = h('span', { class: 'cx-meta' }, 'GPT-6.1 Sol  High');
    var sendBtn = h('button', { type: 'button', class: 'cx-send', 'aria-label': 'Send', hidden: true, dataset: { lab: 'cx-send' }, on: { click: doSend } }, icon('send', 16));
    var compEl = h('div', { class: 'cx-comp' }, ta, h('div', { class: 'cx-comp-row' }, plusBtn, h('span', { class: 'cx-grow' }), meta, sendBtn));
    var footEl = h('div', { class: 'cx-foot' }, h('div', { class: 'cx-foot-in' }, chipsEl, compEl));
    mainEl.appendChild(headEl); mainEl.appendChild(bodyEl); mainEl.appendChild(footEl);
    root.appendChild(sideEl); root.appendChild(mainEl);

    /* ---------- composer ---------- */
    function autosize() {
      ta.style.height = 'auto';
      ta.style.height = Math.min(160, Math.max(24, ta.scrollHeight)) + 'px';
    }
    function updateSend() {
      var c = activeChat();
      sendBtn.hidden = !(ta.value.replace(/\s/g, '').length) || !!(c && c.busy);
    }
    function doSend() {
      var c = activeChat();
      if (!c || c.busy || M.pendingTrust) return;
      var v = ta.value;
      if (!v.replace(/\s/g, '').length) return;
      if (send(c, v)) { ta.value = ''; autosize(); updateSend(); }
    }
    ta.addEventListener('input', function () {
      var c = activeChat();
      if (c) M.composer[c.id] = ta.value;
      autosize(); updateSend();
    });
    ta.addEventListener('paste', function (e) {
      // the lab clipboard (「複製」 in the mission card, Finder 拷貝) wins when it is newer than the system one
      var s = LAB.clipboard.forPaste(e);
      e.preventDefault();
      if (!s) return;
      try { ta.setRangeText(s, ta.selectionStart, ta.selectionEnd, 'end'); } catch (err) { ta.value += s; }
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    });
    ta.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' || e.shiftKey) return;
      if (LAB.ui.isImeEnter(e)) return;          // picking an IME candidate with Return must never send (§3.8)
      e.preventDefault();
      doSend();
    });
    function focusComposer() {
      if (M.pendingTrust || !win.isFocused() || ta.disabled) return;
      try { ta.focus({ preventScroll: true }); } catch (e) { ta.focus(); }
    }
    function syncComposerText() {
      var c = activeChat();
      ta.value = c ? (M.composer[c.id] || '') : '';
      autosize(); updateSend();
    }

    /* ---------- sidebar ---------- */
    function renderSidebar() {
      var act = activeChat();
      var ae = document.activeElement, fk = null;
      if (ae && ae !== document.body && sideEl.contains(ae) && ae.getAttribute) fk = ae.getAttribute('data-key');
      var st = sideEl.scrollTop;
      sideEl.textContent = '';
      sideEl.appendChild(h('button', { type: 'button', class: 'cx-row cx-newchat', dataset: { lab: 'cx-new-chat', key: 'new' }, on: { click: function () { uiNewChat(null); } } },
        icon('pencil', 16), h('span', { class: 'cx-name' }, 'New chat')));
      sideEl.appendChild(h('div', { class: 'cx-gapl' }));

      function chatRow(c, indent) {
        var sel = !!act && act.id === c.id;
        return h('button', {
          type: 'button', class: 'cx-row cx-chat' + (indent ? ' is-indent' : '') + (sel ? ' is-sel' : ''), title: c.title,
          dataset: { lab: 'cx-chat', chat: c.id, key: 'c:' + c.id }, on: { click: function () { uiSelectChat(c.id); } }
        }, h('span', { class: 'cx-name' }, c.title), c.unread ? h('span', { class: 'cx-udot', role: 'img', 'aria-label': 'Unread' }) : null, c.busy ? h('span', { class: 'cx-busy', 'aria-label': 'Working' }) : null);
      }
      M.projects.forEach(function (p) {
        var chats = chatsOf(p.path);
        var collapsed = !!M.collapsed[p.path];
        var sel = !!act && act.draft && samePath(act.projectPath, p.path);
        sideEl.appendChild(h('div', { class: 'cx-prow' },
          h('button', {
            type: 'button', class: 'cx-row cx-project' + (sel ? ' is-sel' : ''), title: toWin(p.path),
            dataset: { lab: 'cx-project', path: p.path, key: 'p:' + p.path }, on: { click: function () { uiSelectProject(p.path); } }
          }, icon('folder-sm', 16), h('span', { class: 'cx-name' }, p.name)),
          h('button', {
            type: 'button', class: 'cx-ico-btn cx-chev', 'aria-label': (collapsed ? 'Expand ' : 'Collapse ') + p.name, dataset: { key: 'v:' + p.path },
            on: { click: function (e) { e.stopPropagation(); M.collapsed[p.path] = !collapsed; renderSidebar(); } }
          }, icon(collapsed ? 'chev-right' : 'chev-down', 14)),
          h('button', {
            type: 'button', class: 'cx-ico-btn cx-plus', 'aria-label': 'New chat in ' + p.name, dataset: { lab: 'cx-project-plus', path: p.path, key: 'n:' + p.path },
            on: { click: function (e) { e.stopPropagation(); uiNewChat(p.path); } }
          }, icon('plus', 15))));
        if (!collapsed) {
          if (!chats.length) sideEl.appendChild(h('div', { class: 'cx-none' }, 'No chats'));
          chats.forEach(function (c) { sideEl.appendChild(chatRow(c, true)); });
        }
      });
      sideEl.appendChild(h('div', { class: 'cx-sec' }, 'Recents'));
      orphans().forEach(function (c) { sideEl.appendChild(chatRow(c, false)); });
      sideEl.scrollTop = st;
      if (fk) {
        var again = sideEl.querySelector('[data-key="' + fk.replace(/(["\\])/g, '\\$1') + '"]');
        if (again) { try { again.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
      }
    }

    /* ---------- main area ---------- */
    function stepNode(text, done) {
      var m = /^(\S+)\s+([\s\S]*)$/.exec(text);
      var label = m ? [h('span', { class: 'cx-sv' }, m[1]), ' ', h('span', { class: 'cx-sf' }, m[2])] : text;
      return h('div', { class: 'cx-step' + (done ? ' is-done' : '') }, h('span', { class: 'cx-chk' }, icon('check', 13)), h('span', { class: 'cx-sl' }, label));
    }
    function msgNode(m) {
      if (m.role === 'user') return h('div', { class: 'cx-msg cx-user-row' }, h('div', { class: 'cx-user' }, m.text));
      var box = h('div', { class: 'cx-msg cx-asst' });
      (m.steps || []).forEach(function (s) { box.appendChild(stepNode(s, true)); });
      var t = h('div', { class: 'cx-text' });
      richInto(t, m.text);
      box.appendChild(t);
      if (m.elapsed) {
        var fold = h('button', { type: 'button', class: 'cx-fold', 'aria-expanded': 'true', dataset: { lab: 'cx-fold' } }, h('span', null, 'Worked for ' + m.elapsed + 's'), icon('chev-right', 12));
        fold.addEventListener('click', function () {
          var folded = box.classList.toggle('is-folded');
          fold.setAttribute('aria-expanded', folded ? 'false' : 'true');
        });
        box.appendChild(fold);
      }
      return box;
    }
    function nearBottom() { return bodyEl.scrollHeight - bodyEl.scrollTop - bodyEl.clientHeight < 90; }
    function toBottom() { bodyEl.scrollTop = bodyEl.scrollHeight; }

    function syncPending() {
      var c = activeChat(), p = c && c.pending;
      if (!p) { pendingEl.hidden = true; stepsEl.textContent = ''; ptextEl.textContent = ''; textShown = ''; pendingChatId = null; return; }
      var near = nearBottom() || pendingChatId !== c.id;
      if (pendingChatId !== c.id) { stepsEl.textContent = ''; ptextEl.textContent = ''; textShown = ''; pendingChatId = c.id; }
      pendingEl.hidden = false;
      while (stepsEl.children.length < p.steps.length) stepsEl.appendChild(stepNode(p.steps[stepsEl.children.length].text, false));
      for (var i = 0; i < p.steps.length; i++) stepsEl.children[i].classList.toggle('is-done', !!p.steps[i].done);
      statusEl.hidden = !(p.status === 'working' && !p.text);
      ptextEl.hidden = !p.text;
      if (p.text !== textShown) { richInto(ptextEl, p.text); textShown = p.text; }
      if (near) toBottom();
    }

    function syncMain() {
      ensureActive();
      var c = activeChat();
      var proj = c.projectPath ? findProject(c.projectPath) : null;
      var pname = proj ? proj.name : (c.projectPath ? vfs.basename(c.projectPath) : '');
      // header: only when the chat has a title
      headEl.hidden = !!c.draft || (!c.messages.length && !c.busy);
      if (!headEl.hidden) {
        headEl.textContent = '';
        if (c.projectPath) headEl.appendChild(icon('folder-sm', 15));
        headEl.appendChild(h('span', { class: 'cx-title' }, c.title));
      }
      // messages / empty state
      var sig = c.id + ':' + c.messages.length;
      var chatChanged = shownChatId !== c.id;
      if (sig !== renderedSig) {
        var grew = !chatChanged && renderedSig !== null;
        msgsEl.textContent = '';
        c.messages.forEach(function (m) { msgsEl.appendChild(msgNode(m)); });
        renderedSig = sig;
        if (grew || chatChanged) setTimeout(toBottom, 0);
      }
      var showEmpty = !c.messages.length && !c.busy;
      emptyEl.hidden = !showEmpty;
      if (showEmpty) {
        emptyEl.textContent = '';
        var q = h('div', { class: 'cx-q' });
        if (c.projectPath) { q.appendChild(document.createTextNode('What should we work on in ')); q.appendChild(h('u', null, pname)); q.appendChild(document.createTextNode('?')); }
        else q.textContent = 'What should we work on?';
        emptyEl.appendChild(h('span', { class: 'cx-logo' }, icon('cx-logo', 34)));
        emptyEl.appendChild(q);
      }
      syncPending();
      // chips: only for project chats (the whole teaching point of M6)
      chipsEl.hidden = !c.projectPath;
      chipsEl.textContent = '';
      if (c.projectPath) {
        chipsEl.appendChild(h('span', { class: 'cx-chip', title: toWin(c.projectPath) }, icon('folder-sm', 13), h('span', null, pname)));
        chipsEl.appendChild(h('span', { class: 'cx-chip plain' }, icon('laptop', 13), h('span', null, 'This computer')));
      }
      // composer
      if (shownChatId !== c.id) { ta.value = M.composer[c.id] || ''; shownChatId = c.id; }
      var wasDisabled = ta.disabled;
      ta.disabled = !!c.busy;
      compEl.classList.toggle('is-busy', !!c.busy);
      if (wasDisabled && !c.busy) setTimeout(focusComposer, 0);
      autosize(); updateSend();
    }

    /* ---------- Trust modal (§4.4.2) ---------- */
    function syncTrust() {
      var path = M.pendingTrust;
      if (path && !trustEl) showTrust(path);
      else if (!path && trustEl) closeTrust();
      else if (path && trustEl && trustEl.getAttribute('data-path') !== path) { closeTrust(true); showTrust(path); }
    }
    function showTrust(path) {
      prevFocus = document.activeElement;
      var tid = 'cx-trust-t' + win.id;
      var xBtn = h('button', { type: 'button', class: 'cx-modal-x', 'aria-label': 'Cancel', dataset: { lab: 'cx-modal-x' }, on: { click: cancelTrust } }, icon('x', 14));
      var yBtn = h('button', { type: 'button', class: 'cx-btn cx-btn-pri', dataset: { lab: 'cx-modal-trust' }, on: { click: trustFolder } }, 'Trust folder');
      var nBtn = h('button', { type: 'button', class: 'cx-btn cx-btn-sec', dataset: { lab: 'cx-modal-cancel' }, on: { click: cancelTrust } }, 'Cancel');
      var dlg = h('div', { class: 'cx-modal', role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': tid, dataset: { lab: 'cx-modal' } },
        xBtn,
        h('div', { class: 'cx-modal-t', id: tid }, 'Trust this folder?'),
        h('div', { class: 'cx-modal-p' }, toWin(path)),
        h('div', { class: 'cx-modal-d' }, 'ChatGPT can read, edit, and execute files here. Folder settings can also run code automatically, even without a model request. Continue only if you trust these files.'),
        yBtn, nBtn);
      trustEl = h('div', { class: 'cx-scrim', 'data-path': path }, dlg);
      mainEl.appendChild(trustEl);
      offModal = LAB.keys.modal(function (e) {
        if (!M.pendingTrust || !win.isFocused()) return false;
        if (e.key === 'Tab') {
          var f = [xBtn, yBtn, nBtn];
          var i = f.indexOf(document.activeElement);
          var n = e.shiftKey ? (i <= 0 ? f.length - 1 : i - 1) : (i === f.length - 1 ? 0 : i + 1);
          f[n].focus();
          return true;
        }
        if (LAB.ui.isImeEnter(e)) return false;
        if (e.key === 'Escape') { cancelTrust(); return true; }
        if (e.key === 'Enter') {
          var a = document.activeElement;
          if (a === xBtn || a === nBtn) return false;      // the focused button clicks itself
          trustFolder();
          return true;
        }
        return false;
      });
      setTimeout(function () { if (trustEl) yBtn.focus(); }, 0);
    }
    function closeTrust(keepFocus) {
      if (offModal) { offModal(); offModal = null; }
      if (trustEl && trustEl.parentNode) trustEl.parentNode.removeChild(trustEl);
      trustEl = null;
      if (keepFocus) return;
      var pf = prevFocus; prevFocus = null;
      setTimeout(function () {
        if (pf && pf !== document.body && document.contains(pf) && !ta.disabled) { try { pf.focus({ preventScroll: true }); return; } catch (e) { /* fall through */ } }
        focusComposer();
      }, 0);
    }
    win.own(function () { if (offModal) { offModal(); offModal = null; } trustEl = null; });

    /* ---------- drop targets (§3.10 rule 9): sidebar and main, both show the green + ---------- */
    function addDrop(el, kind) {
      var onlyDirs = kind === 'sidebar';
      win.own(LAB.dnd.target(el, {
        id: 'codex:' + win.id + ':' + kind,
        accept: function (pl) {
          if (!pl || pl.kind !== 'fs' || !pl.paths || !pl.paths.length || M.pendingTrust) return false;
          for (var i = 0; i < pl.paths.length; i++) {
            if (onlyDirs ? !vfs.isDir(pl.paths[i]) : !vfs.exists(pl.paths[i])) return false;
          }
          return 'copy';
        },
        enter: function () { el.classList.add('is-drop'); },
        leave: function () { el.classList.remove('is-drop'); },
        drop: function (pl) {
          el.classList.remove('is-drop');
          win.focus();
          handlePaths(pl.paths, onlyDirs);       // a reference only: nothing is moved or copied in the file system (§4.4.2 item 4)
        }
      }));
    }
    addDrop(sideEl, 'sidebar');
    addDrop(mainEl, 'main');

    /* ---------- wiring ---------- */
    win.own(onModel(function (kind) {
      if (kind === 'pending') { syncPending(); return; }
      if (kind === 'trust') { syncTrust(); return; }
      if (kind === 'composer') { syncComposerText(); return; }
      if (kind === 'focus') { setTimeout(focusComposer, 0); return; }
      if (kind === 'focus-if-idle') { if (win.isFocused() && !M.pendingTrust) setTimeout(focusComposer, 0); return; }
      renderSidebar();
      syncMain();
    }));
    win.own(win.on('focus', function () { setTimeout(focusComposer, 0); }));
    win.own(win.on('resize', function () { autosize(); }));
    win.own(function () { M.pendingTrust = null; if (curView === view) curView = null; });   // closing the window drops an unanswered prompt silently

    view.win = win; view.ta = ta; view.focusComposer = focusComposer;
    curView = view;
    ensureActive();
    renderSidebar();
    syncMain();
    syncTrust();
    focusComposer();
    return view;
  }

  /* ====================================================================== */
  /*  APP REGISTRATION (Windows has no menu bar: the chat actions live in the window)  */
  /* ====================================================================== */
  LAB.apps.register('codex', {
    title: 'Codex', en: 'Codex', aliases: ['codex', 'chatgpt'], icon: 'app-codex', dock: true,
    open: function () { return openWindow(); },
    newWindow: function () { openWindow(); uiNewChat(null); },
    canHandle: function (p) { return vfs.isDir(p); },                 // PURE (§3.7)
    handleOpen: function (p) {
      var cp = vfs.canon(p);
      var st = vfs.stat(cp);
      if (!st) return false;
      openWindow();
      if (st.type === 'dir') projectFlow(cp); else insertMention([st.name]);
      return true;
    },
    canOpen: function (st) { return st && st.type === 'dir' ? 20 : 0; },
    quit: function () { M.pendingTrust = null; }
  });

  // a reply that was interrupted by a reload is answered again once everything is restored
  LAB.ready(function () { resumeReplies(); }, 60);
})(window.LAB);
