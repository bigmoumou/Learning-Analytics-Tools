/* sysapps.js — round 5 (SYS-WIN, SPEC §6): the Windows 11 system features and the five new apps.
   Shell side (used by desktop.js, wm.js, apps.js through the guarded LAB.sys.* calls): the shared settings state (light/dark, wallpaper, brightness,
   night light, volume, Wi-Fi ...), Quick Settings, the notification centre with the calendar, the Run dialog, the Win+X menu, sleep / power,
   Task View. Apps: settings 設定, calculator 小算盤, taskmgr 工作管理員, edge Microsoft Edge, photos 相片 (each registered with LAB.apps).
   Everything is drawn by us (own SVG icons), fake data only (SPEC §1), no network. Nothing here runs on a timer unless the thing it updates is on screen. */
(function (LAB) {
  'use strict';

  var h = LAB.util.h;
  var HOME = '/Users/an';
  var sys = LAB.sys = LAB.sys || {};

  /* ===================================================================== small helpers */
  function toast(t) { LAB.ui.toast(t); }
  function reduced() {
    try { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  }
  function iconBox(name, size, cls) {
    var s = h('span', { class: cls || 'lab-ico-box', 'aria-hidden': 'true' });
    s.innerHTML = LAB.icons.get(name, { size: size });          // static icon markup only
    return s;
  }
  function stageNode() { return document.getElementById('lab-stage'); }
  function winPath(p) { return (LAB.win && LAB.win.toWin) ? LAB.win.toWin(p) : p; }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function noToast() { toast('練習版沒有這個功能'); }
  function openApp(id, args) { return LAB.apps.launch(id, args); }
  /* a bus listener that dies with the window (the ?debug=1 leak check) */
  function onWin(win, name, fn) { win.own(LAB.bus.on(name, fn)); }
  function bindTimer(win, fn, ms) {                       // setInterval that is stopped by win.own when the window closes
    var t = setInterval(fn, ms);
    win.own(function () { clearInterval(t); });
    return t;
  }

  /* ===================================================================== the fake computer (SPEC §1): one place for every number */
  sys.info = {
    HOST: 'AN-LAPTOP', USER: 'an', LABEL: 'an 的筆電',
    OS: 'Windows 11 家用版', OS_EN: 'Windows 11 Home', VERSION: '25H2', BUILD: '26200.6584', INSTALLED: '2026/9/1',
    EXPERIENCE: 'Windows Feature Experience Pack 1000.26100.275.0',
    CPU: 'Intel(R) Core(TM) Ultra 5 125U', CPU_SPEED: '1.30 GHz', CORES: 12, THREADS: 14,
    RAM: '16.0 GB', RAM_AVAIL: '15.6 GB', SYSTEM_TYPE: '64 位元作業系統，x64 型處理器',
    DEVICE_ID: '3B7E1A52-0C94-4F6D-9A21-5D8E47C0B3F9', PRODUCT_ID: '00342-21088-71203-AAOEM',
    WIFI: 'NTNU-Classroom', IP: '10.20.31.57', MASK: '255.255.255.0', GATEWAY: '10.20.31.1', DNS: '10.20.0.53', MAC: 'A4-6B-B6-3C-71-E2',
    ADAPTER: 'Intel(R) Wi-Fi 6E AX211 160MHz',
    DISK: '本機磁碟 (C:)', DISK_TOTAL_GB: 475, DISK_FREE_GB: 301,
    PS_VERSION: '5.1.26100.6584'
  };

  /* ===================================================================== settings state and its real effects */
  var DEF = {
    mode: 'custom', winMode: 'dark', appMode: 'light',      // 色彩：淺色 / 深色 / 自訂 (Windows 模式 + 應用程式模式)
    wall: 'bloom', solid: null,                              // 背景
    brightness: 100, night: false, nightStrength: 50,        // 顯示器
    volume: 40, wifi: true, bluetooth: false, airplane: false, saver: false, trans: true
  };
  var st = {};
  Object.keys(DEF).forEach(function (k) { st[k] = DEF[k]; });
  sys.state = st;
  sys.get = function (k) { return st[k]; };

  var WALLS = [
    { id: 'bloom', name: 'Bloom', url: 'img/wallpaper.jpg', pos: '72% 50%', bg: '#d6e0f5' },
    { id: 'glow', name: 'Glow', url: 'img/wall/glow.jpg', pos: 'center', bg: '#0b0e30' },
    { id: 'dunes', name: 'Dunes', url: 'img/wall/dunes.jpg', pos: 'center', bg: '#e9b48a' }
  ];
  var SOLIDS = ['#0078d4', '#2d7d9a', '#498205', '#ca5010', '#c239b3', '#5c2e91', '#4c4a48', '#1f1f1f'];
  sys.walls = WALLS;
  sys.solids = SOLIDS;
  function wallById(id) { for (var i = 0; i < WALLS.length; i++) if (WALLS[i].id === id) return WALLS[i]; return WALLS[0]; }

  function applyMode() {
    var r = document.documentElement;
    r.setAttribute('data-win-mode', st.winMode);
    r.setAttribute('data-app-mode', st.appMode);
  }
  function applyWall() {
    var el = document.getElementById('lab-wall');
    if (!el) return;
    if (st.solid) { el.style.backgroundImage = 'none'; el.style.backgroundColor = st.solid; return; }
    var w = wallById(st.wall);
    el.style.backgroundImage = 'url("' + w.url + '")';
    el.style.backgroundPosition = w.pos;
    el.style.backgroundColor = w.bg;
  }
  var dimEl = null, nightEl = null;
  function ensureFx() {
    var stg = stageNode();
    if (!stg || dimEl) return;
    nightEl = h('div', { id: 'lab-night', 'aria-hidden': 'true' });
    dimEl = h('div', { id: 'lab-dim', 'aria-hidden': 'true' });
    stg.appendChild(nightEl); stg.appendChild(dimEl);
  }
  /* brightness really dims the screen (a black veil, 100 % = none, 0 % = 62 %); night light really warms it (an orange multiply layer) */
  function applyDisplay() {
    ensureFx();
    if (!dimEl) return;
    dimEl.style.opacity = ((100 - st.brightness) / 100 * 0.62).toFixed(3);
    nightEl.style.opacity = st.night ? (0.22 + st.nightStrength / 100 * 0.5).toFixed(3) : '0';
    document.documentElement.setAttribute('data-night', st.night ? 'on' : 'off');
  }
  function applyTrans() { document.documentElement.setAttribute('data-trans', st.trans ? 'on' : 'off'); }
  function applyKey(k) {
    if (k === 'winMode' || k === 'appMode') applyMode();
    else if (k === 'wall' || k === 'solid') applyWall();
    else if (k === 'brightness' || k === 'night' || k === 'nightStrength') applyDisplay();
    else if (k === 'trans') applyTrans();
  }
  sys.set = function (k, v) {
    if (!(k in DEF) || st[k] === v) return;
    st[k] = v;
    applyKey(k);
    LAB.bus.emit('sys:change', { key: k, value: v });
    if (k === 'airplane' && v) { sys.set('wifi', false); sys.set('bluetooth', false); }
    if (k === 'wifi' && v && st.airplane) sys.set('airplane', false);
    if (k === 'bluetooth' && v && st.airplane) sys.set('airplane', false);
  };
  /* 色彩 > 選擇您的模式: 淺色 = Windows and apps light, 深色 = both dark, 自訂 = keep the two separate choices (default: Windows dark, apps light) */
  sys.setMode = function (choice) {
    if (choice === 'light') { st.mode = 'light'; sys.set('winMode', 'light'); sys.set('appMode', 'light'); }
    else if (choice === 'dark') { st.mode = 'dark'; sys.set('winMode', 'dark'); sys.set('appMode', 'dark'); }
    else { st.mode = 'custom'; }
    LAB.bus.emit('sys:change', { key: 'mode', value: st.mode });
  };
  sys.setWall = function (id) { st.solid = null; sys.set('wall', id); applyWall(); LAB.bus.emit('sys:change', { key: 'wall', value: id }); };
  sys.setSolid = function (c) { st.solid = c; applyWall(); LAB.bus.emit('sys:change', { key: 'solid', value: c }); };

  /* ===================================================================== fake photos (SPEC §6: Pictures) */
  var IMG_EXT = { '.jpg': 1, '.jpeg': 1, '.png': 1, '.gif': 1, '.webp': 1, '.bmp': 1 };
  function isImagePath(p) { return !!IMG_EXT[LAB.vfs.extname(p).toLowerCase()]; }
  sys.isImage = isImagePath;
  sys.imageUrl = function (p) { return LAB.seed && LAB.seed.imageUrl ? LAB.seed.imageUrl(p) : null; };      // by name, then (a renamed copy) by size

  /* ===================================================================== processes (SPEC §1): one table for Task Manager (and Get-Process) */
  /* fixed PIDs; CPU % moves a little with every query (a seeded generator, so a visit always sees the same sequence) */
  var seedState = 20261002;
  function rnd() {                               // mulberry32
    seedState = (seedState + 0x6D2B79F5) | 0;
    var t = Math.imul(seedState ^ (seedState >>> 15), 1 | seedState);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function jit(base, amp) { return Math.max(0, base + (rnd() - 0.5) * 2 * amp); }

  /* [pid, exe, 處理程序 tab name, user, MB, cpu %, group] — 'bg' = 背景處理程序, 'win' = Windows 處理程序 */
  var SYSPROC = [
    [4, 'System', '系統', 'SYSTEM', 0.1, 0.3, 'win'],
    [124, 'Registry', 'Registry', 'SYSTEM', 62.4, 0, 'win'],
    [388, 'smss.exe', 'Windows 工作階段管理員', 'SYSTEM', 1.1, 0, 'win'],
    [560, 'csrss.exe', '用戶端伺服器執行階段處理序', 'SYSTEM', 2.4, 0.1, 'win'],
    [640, 'wininit.exe', 'Windows 啟動應用程式', 'SYSTEM', 1.3, 0, 'win'],
    [648, 'csrss.exe', '用戶端伺服器執行階段處理序', 'SYSTEM', 3.8, 0.1, 'win'],
    [700, 'winlogon.exe', 'Windows 登入應用程式', 'SYSTEM', 3.2, 0, 'win'],
    [720, 'services.exe', '服務和控制器應用程式', 'SYSTEM', 8.1, 0, 'win'],
    [744, 'lsass.exe', 'Local Security Authority Process', 'SYSTEM', 18.6, 0, 'win'],
    [868, 'svchost.exe', '服務主機: DCOM 伺服器處理序啟動器', 'SYSTEM', 24.3, 0, 'win'],
    [932, 'svchost.exe', '服務主機: 遠端程序呼叫', 'NETWORK SERVICE', 11.9, 0, 'win'],
    [1020, 'dwm.exe', '桌面視窗管理員', 'DWM-1', 96.5, 0.8, 'win'],
    [1040, 'svchost.exe', '服務主機: 本機系統', 'SYSTEM', 31.2, 0.1, 'win'],
    [1112, 'svchost.exe', '服務主機: 網路服務', 'NETWORK SERVICE', 17.4, 0.1, 'win'],
    [1196, 'svchost.exe', '服務主機: 本機服務', 'LOCAL SERVICE', 14.7, 0, 'win'],
    [1356, 'svchost.exe', '服務主機: Windows 事件記錄', 'LOCAL SERVICE', 9.8, 0, 'win'],
    [1568, 'svchost.exe', '服務主機: 系統事件通知服務', 'SYSTEM', 8.2, 0, 'win'],
    [2208, 'spoolsv.exe', '多工緩衝處理器子系統應用程式', 'SYSTEM', 6.9, 0, 'win'],
    [2860, 'Memory Compression', 'Memory Compression', 'SYSTEM', 214.0, 0, 'win'],
    [3012, 'sihost.exe', '殼層基礎結構主機', 'an', 12.6, 0, 'win'],
    [3548, 'MsMpEng.exe', 'Antimalware Service Executable', 'SYSTEM', 188.4, 0.6, 'win'],
    [3856, 'taskhostw.exe', 'Windows 工作主機處理序', 'an', 7.4, 0, 'win'],
    [4120, 'WmiPrvSE.exe', 'WMI Provider Host', 'NETWORK SERVICE', 11.1, 0, 'win'],
    [4896, 'ctfmon.exe', 'CTF 載入器', 'an', 15.3, 0, 'bg'],
    [5320, 'RuntimeBroker.exe', '執行階段代理程式', 'an', 22.8, 0, 'bg'],
    [5560, 'StartMenuExperienceHost.exe', '開始', 'an', 48.7, 0, 'bg'],
    [5684, 'SearchHost.exe', '搜尋', 'an', 61.2, 0, 'bg'],
    [6012, 'RuntimeBroker.exe', '執行階段代理程式', 'an', 9.6, 0, 'bg'],
    [6144, 'TextInputHost.exe', '文字輸入應用程式', 'an', 31.0, 0, 'bg'],
    [6420, 'ShellExperienceHost.exe', 'Windows Shell Experience 主機', 'an', 17.2, 0, 'bg'],
    [6612, 'SecurityHealthSystray.exe', 'Windows 安全性通知圖示', 'an', 2.4, 0, 'bg'],
    [7040, 'OneDrive.exe', 'Microsoft OneDrive', 'an', 78.5, 0.1, 'bg']
  ];
  /* the apps (appId -> processes). The first process is the one the 處理程序 tab shows; the rest belong to it. */
  var APPPROC = {
    finder: { title: 'Windows 檔案總管', procs: [[5124, 'explorer.exe', 96.4, 0.4, 'Windows 檔案總管']] },
    terminal: { title: '終端機', procs: [[9120, 'WindowsTerminal.exe', 74.2, 0.3, '終端機'], [9412, 'powershell.exe', 62.8, 0.1, 'Windows PowerShell'], [9344, 'OpenConsole.exe', 9.4, 0, '終端機']] },
    codex: { title: 'Codex', procs: [[10244, 'Codex.exe', 238.6, 1.2, 'Codex'], [10300, 'Codex.exe', 96.2, 0.2, 'Codex (GPU)']] },
    code: { title: 'Visual Studio Code', procs: [[11020, 'Code.exe', 181.5, 0.8, 'Visual Studio Code'], [11072, 'Code.exe', 74.3, 0.2, 'Visual Studio Code (GPU)'], [11136, 'Code.exe', 121.8, 0.4, 'Visual Studio Code (Renderer)']] },
    textedit: { title: '記事本', procs: [[12060, 'Notepad.exe', 29.4, 0.1, '記事本']] },
    edge: { title: 'Microsoft Edge', procs: [[13412, 'msedge.exe', 152.3, 0.6, 'Microsoft Edge'], [13480, 'msedge.exe', 62.4, 0.2, 'Microsoft Edge (GPU)'], [13524, 'msedge.exe', 88.1, 0.3, 'Microsoft Edge (Renderer)']] },
    settings: { title: '設定', procs: [[14040, 'SystemSettings.exe', 42.7, 0.1, '設定']] },
    calculator: { title: '小算盤', procs: [[14516, 'CalculatorApp.exe', 21.5, 0, '小算盤']] },
    taskmgr: { title: '工作管理員', procs: [[15004, 'Taskmgr.exe', 36.8, 0.9, '工作管理員']] },
    photos: { title: '相片', procs: [[15520, 'Microsoft.Photos.exe', 88.6, 0.1, '相片']] }
  };
  sys.APPPROC = APPPROC;

  function winList(appId) {
    return LAB.wm.byApp(appId).map(function (w) { return { id: w.id, title: w.getTitle() || APPPROC[appId].title, minimized: w.isMinimized() }; });
  }

  /* [{pid, exe, name, title, desc, user, group:'apps'|'bg'|'win', kind:'app'|'sys', appId, main, cpu, mem, disk, net, windows:[{id,title}], status}] */
  sys.processes = function () {
    var out = [];
    Object.keys(APPPROC).forEach(function (appId) {
      var ap = APPPROC[appId];
      var wl = winList(appId);
      if (appId !== 'finder' && !wl.length) return;      // an app with no window is not running (explorer.exe always is)
      var extra = Math.max(0, wl.length - 1);
      ap.procs.forEach(function (p, i) {
        out.push({
          pid: p[0], exe: p[1], name: p[1].replace(/\.exe$/i, ''), title: i === 0 ? ap.title : p[4], desc: p[4], user: 'an',
          group: i === 0 ? (appId === 'finder' && !wl.length ? 'bg' : 'apps') : 'child', kind: 'app', appId: appId, main: i === 0,
          cpu: jit(p[3] * (1 + extra * 0.3), p[3] * 0.6 + 0.05), mem: p[2] + extra * (i === 0 ? 14 : 4) + rnd() * 1.2,
          disk: jit(i === 0 ? 0.05 : 0, 0.04), net: 0, windows: i === 0 ? wl : [],
          status: wl.length && wl.every(function (w) { return w.minimized; }) ? '已暫停' : ''
        });
      });
    });
    SYSPROC.forEach(function (p) {
      out.push({
        pid: p[0], exe: p[1], name: p[1].replace(/\.exe$/i, ''), title: p[2], desc: p[2], user: p[3], group: p[6], kind: 'sys', appId: null, main: true,
        cpu: jit(p[5], p[5] * 0.7 + 0.05), mem: p[4] + rnd() * 0.8, disk: jit(p[1] === 'System' ? 0.1 : 0, 0.05), net: p[1] === 'msedge.exe' ? 0.1 : 0, windows: [], status: ''
      });
    });
    out.sort(function (a, b) { return a.pid - b.pid; });
    return out;
  };
  /* machine totals for the Task Manager headers and the 效能 graphs (CPU %, used memory GB of 16.0, disk %, network Kbps) */
  sys.perf = function (list) {
    list = list || sys.processes();
    var cpu = 0, mem = 0;
    list.forEach(function (p) { cpu += p.cpu; mem += p.mem; });
    var apps = LAB.wm.all().length;
    cpu = clamp(cpu + 2.5 + apps * 0.3, 1, 99);
    var usedGB = 4.9 + mem / 1024 * 0.55;
    return { cpu: cpu, memGB: usedGB, memPct: usedGB / 16 * 100, disk: jit(1.2, 1), netSend: jit(2.1, 1.4), netRecv: jit(14, 9), procs: list.length, threads: 2310 + list.length * 7 };
  };
  var APP_BY_EXE = {};
  Object.keys(APPPROC).forEach(function (id) { APPPROC[id].procs.forEach(function (p) { APP_BY_EXE[p[1].toLowerCase()] = id; }); });
  sys.closeApp = function (appId) {
    var ws = LAB.wm.byApp(appId).slice();
    ws.forEach(function (w) { LAB.wm.close(w.id, { force: true }); });
    if (appId !== 'finder' && LAB.apps.isRunning(appId)) { try { LAB.apps.quit(appId, { force: true }); } catch (e) { console.error(e); } }
    return ws.length;
  };
  /* 結束工作 / Stop-Process / taskkill: a pid (number or digits), a name (with or without .exe, any case) or an app id.
     An app's window really closes (no question asked, like the real thing); a Windows process is refused. -> {ok, reason?, appId?, closed?} */
  sys.killProcess = function (spec) {
    var s = String(spec).trim().toLowerCase();
    var list = sys.processes(), p = null, i;
    if (/^\d+$/.test(s)) { for (i = 0; i < list.length; i++) if (list[i].pid === +s) { p = list[i]; break; } }
    else {
      var nm = s.replace(/\.exe$/, '');
      for (i = 0; i < list.length && !p; i++) if (list[i].name.toLowerCase() === nm || list[i].appId === s) p = list[i];
    }
    if (!p) return { ok: false, reason: 'notfound' };
    if (p.kind !== 'app') return { ok: false, reason: 'protected', pid: p.pid, name: p.exe };
    var n = sys.closeApp(p.appId);
    LAB.bus.emit('sys:kill', { pid: p.pid, exe: p.exe, appId: p.appId, closed: n });
    return { ok: true, appId: p.appId, pid: p.pid, closed: n };
  };

  /* ===================================================================== notifications (shared by the clock flyout) */
  var notifs = [
    { id: 'n1', app: 'Windows 安全性', when: '剛剛', title: '快速掃描完成', text: '沒有發現威脅。', icon: 'shield' },
    { id: 'n2', app: 'Windows Update', when: '昨天', title: '您的裝置是最新狀態', text: '已安裝 2026-09 累積更新，不需要重新啟動。', icon: 'restart' }
  ];
  sys.notifications = notifs;

  /* ===================================================================== shared controls (Windows 11 look; styled in sysapps.css) */
  function slider(val, onInput, label, min, max) {
    var el = h('input', { type: 'range', class: 'lab-sx-range', min: String(min === undefined ? 0 : min), max: String(max === undefined ? 100 : max), value: String(val), 'aria-label': label || '' });
    function paint() { el.style.setProperty('--p', ((el.value - el.min) / (el.max - el.min) * 100) + '%'); }
    el.addEventListener('input', function () { paint(); onInput(+el.value); });
    el.paint = paint;
    paint();
    return el;
  }
  function toggle(on, onChange, label, hook) {
    var b = h('button', { type: 'button', class: 'lab-sx-switch' + (on ? ' is-on' : ''), role: 'switch', 'aria-checked': on ? 'true' : 'false', 'aria-label': label || '', dataset: hook ? { lab: hook } : null },
      h('span', { class: 'lab-sx-knob' }));
    b.addEventListener('click', function () { b.set(!b.classList.contains('is-on')); onChange(b.classList.contains('is-on')); });
    b.set = function (v) { b.classList.toggle('is-on', !!v); b.setAttribute('aria-checked', v ? 'true' : 'false'); };
    return b;
  }
  /* run fn on every sys:change while `root` is in the page. It unhooks itself on the first event after `root` has left, and sooner when someone calls
     root._labOff() (the flyout code does when it closes) or the current Settings page is replaced (watchBag), so no listener outlives its window. */
  var watchBag = null;
  function watch(root, fn) {
    var off = LAB.bus.on('sys:change', function (d) {
      if (!root.isConnected) { off(); return; }
      fn(d);
    });
    if (watchBag) watchBag.push(off);
    var prev = root._labOff;
    root._labOff = function () { if (prev) prev(); off(); };
    return off;
  }
  sys.ui = { slider: slider, toggle: toggle, watch: watch, iconBox: iconBox };

  /* ===================================================================== Quick Settings (click the network / speaker area) */
  sys.quickSettings = function () {
    var tilesBox = h('div', { class: 'lab-qsx-tiles' });
    var defs = [
      { key: 'wifi', icon: 'wifi', label: 'Wi-Fi', sub: function (on) { return on ? sys.info.WIFI : '已關閉'; }, chev: true },
      { key: 'bluetooth', icon: 'bluetooth', label: '藍牙', sub: function (on) { return on ? '未連線' : '已關閉'; }, chev: true },
      { key: 'airplane', icon: 'airplane', label: '飛航模式', sub: function (on) { return on ? '開啟' : '關閉'; } },
      { key: 'saver', icon: 'battery-saver', label: '省電模式', sub: function (on) { return on ? '開啟' : '關閉'; } },
      { key: 'night', icon: 'moon', label: '夜間光線', sub: function (on) { return on ? '開啟' : '關閉'; } },
      { key: 'access', icon: 'accessibility', label: '協助工具', sub: function () { return ''; }, fixed: true }
    ];
    var recs = defs.map(function (d) {
      var sub = h('span', { class: 'lab-qsx-sub' });
      var b = h('button', { type: 'button', class: 'lab-qsx-tile', dataset: { lab: 'qs-tile', key: d.key }, 'aria-pressed': 'false' },
        iconBox(d.icon, 20, 'lab-qsx-ico'),
        h('span', { class: 'lab-qsx-txt' }, h('span', { class: 'lab-qsx-label' }, d.label), sub));
      if (d.chev) b.appendChild(iconBox('chev-right', 12, 'lab-qsx-chev'));
      function paint() {
        var on = d.fixed ? false : !!st[d.key];
        b.classList.toggle('is-on', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
        sub.textContent = d.sub(on);
        sub.style.display = sub.textContent ? '' : 'none';
      }
      b.addEventListener('click', function () {
        if (d.fixed) { toast('練習版沒有協助工具的快速設定'); return; }
        sys.set(d.key, !st[d.key]);
      });
      paint();
      tilesBox.appendChild(b);
      return paint;
    });
    var bright = slider(st.brightness, function (v) { sys.set('brightness', v); }, '亮度');
    bright.dataset.lab = 'qs-brightness';
    var vol = slider(st.volume, function (v) { sys.set('volume', v); }, '音量');
    vol.dataset.lab = 'qs-volume';
    var volIco = iconBox('speaker', 20, 'lab-qsx-ico');
    var gear = h('button', { type: 'button', class: 'lab-qsx-gear', 'aria-label': '所有設定', 'data-tip': '所有設定' }, iconBox('gear', 16));
    gear.addEventListener('click', function () { if (LAB.desktop && LAB.desktop.closeFlyout) LAB.desktop.closeFlyout(); openApp('settings'); });
    var root = h('div', { class: 'lab-qsx', dataset: { lab: 'quick-settings' } },
      tilesBox,
      h('div', { class: 'lab-qsx-row' }, iconBox('sun', 20, 'lab-qsx-ico'), bright),
      h('div', { class: 'lab-qsx-row' }, volIco, vol),
      h('div', { class: 'lab-qsx-foot' }, h('span', { class: 'lab-qsx-batt' }, iconBox('battery', 18), h('span', null, '100%')), gear));
    watch(root, function (d) {
      recs.forEach(function (p) { p(); });
      if (d.key === 'brightness' && +bright.value !== st.brightness) { bright.value = st.brightness; bright.paint(); }
      if (d.key === 'volume' && +vol.value !== st.volume) { vol.value = st.volume; vol.paint(); }
    });
    return root;
  };

  /* ===================================================================== notification centre + calendar (click the clock) */
  var focusSession = { minutes: 25, endAt: 0 };
  var ZH_DAY = ['日', '一', '二', '三', '四', '五', '六'];
  sys.notificationCenter = function () {
    var now = LAB.clock.now(), today = { y: now.getFullYear(), m: now.getMonth(), d: now.getDate() };
    var view = { y: today.y, m: today.m }, calOpen = LAB.stage.dockTop() >= 700;     // a short screen starts with the calendar folded, like Windows when it is short of room

    var notifBox = h('div', { class: 'lab-nc-notifs' });
    var clearBtn = h('button', { type: 'button', class: 'lab-nc-clear', dataset: { lab: 'nc-clear' } }, '全部清除');
    function paintNotifs() {
      notifBox.textContent = '';
      clearBtn.style.visibility = notifs.length ? '' : 'hidden';
      if (!notifs.length) { notifBox.appendChild(h('div', { class: 'lab-nc-empty' }, '沒有新通知')); return; }
      notifs.slice().forEach(function (n) {
        var x = h('button', { type: 'button', class: 'lab-nc-x', 'aria-label': '關閉通知' }, iconBox('x', 12));
        x.addEventListener('click', function () { var i = notifs.indexOf(n); if (i >= 0) notifs.splice(i, 1); paintNotifs(); });
        notifBox.appendChild(h('div', { class: 'lab-nc-item', dataset: { lab: 'nc-item' } },
          h('div', { class: 'lab-nc-ihead' }, iconBox(n.icon, 14, 'lab-nc-iico'), h('span', { class: 'lab-nc-iapp' }, n.app), h('span', { class: 'lab-nc-iwhen' }, n.when), x),
          h('div', { class: 'lab-nc-ititle' }, n.title), h('div', { class: 'lab-nc-itext' }, n.text)));
      });
    }
    clearBtn.addEventListener('click', function () { notifs.length = 0; paintNotifs(); });
    paintNotifs();

    var calBox = h('div', { class: 'lab-nc-calbody' });
    var monthLabel = h('div', { class: 'lab-nc-month' });
    function paintCal() {
      calBox.textContent = '';
      monthLabel.textContent = view.y + '年' + (view.m + 1) + '月';
      var grid = h('div', { class: 'lab-cal-grid lab-nc-grid', dataset: { lab: 'calendar-grid' } });
      ZH_DAY.forEach(function (dn) { grid.appendChild(h('div', { class: 'lab-cal-dow' }, dn)); });
      var first = new Date(view.y, view.m, 1).getDay(), dim = new Date(view.y, view.m + 1, 0).getDate(), prevDim = new Date(view.y, view.m, 0).getDate();
      for (var i = 0; i < 42; i++) {
        var n = i - first + 1, cls = 'lab-cal-day';
        if (n < 1) { n = prevDim + n; cls += ' is-dim'; }
        else if (n > dim) { n = n - dim; cls += ' is-dim'; }
        else if (view.y === today.y && view.m === today.m && n === today.d) cls += ' is-today';
        grid.appendChild(h('div', { class: cls }, String(n)));
      }
      calBox.appendChild(grid);
    }
    function moveMonth(dm) {
      var d = new Date(view.y, view.m + dm, 1);
      view.y = d.getFullYear(); view.m = d.getMonth();
      paintCal();
    }
    var up = h('button', { type: 'button', class: 'lab-nc-nav', 'aria-label': '上個月' }, iconBox('chev-up', 14));
    var dn = h('button', { type: 'button', class: 'lab-nc-nav', 'aria-label': '下個月' }, iconBox('chev-down', 14));
    up.addEventListener('click', function () { moveMonth(-1); });
    dn.addEventListener('click', function () { moveMonth(1); });
    paintCal();
    var calWrap = h('div', { class: 'lab-nc-calwrap' },
      h('div', { class: 'lab-nc-calhead' }, monthLabel, up, dn), calBox);
    var toggleCal = h('button', { type: 'button', class: 'lab-nc-datebtn', 'aria-expanded': 'true', dataset: { lab: 'nc-date' } },
      h('span', { class: 'lab-nc-date' }, (today.m + 1) + '月' + today.d + '日 星期' + ZH_DAY[now.getDay()]), iconBox('chev-up', 14, 'lab-nc-datechev'));
    function paintCalOpen() {
      calWrap.style.display = calOpen ? '' : 'none';
      toggleCal.setAttribute('aria-expanded', calOpen ? 'true' : 'false');
      toggleCal.classList.toggle('is-closed', !calOpen);
    }
    toggleCal.addEventListener('click', function () { calOpen = !calOpen; paintCalOpen(); });
    paintCalOpen();

    /* 專注 (focus session): minutes picker + start; counts down only while this panel is on screen */
    var focusBox = h('div', { class: 'lab-nc-focus', dataset: { lab: 'nc-focus' } });
    var focusTimer = null;
    function stopFocusTimer() { if (focusTimer) { clearInterval(focusTimer); focusTimer = null; } }
    function paintFocus() {
      focusBox.textContent = '';
      var running = focusSession.endAt > Date.now();
      if (focusSession.endAt && !running) { focusSession.endAt = 0; }
      if (running) {
        var left = Math.max(0, Math.round((focusSession.endAt - Date.now()) / 1000));
        var tt = h('span', { class: 'lab-nc-ftime', dataset: { lab: 'nc-focus-time' } }, pad2(Math.floor(left / 60)) + ':' + pad2(left % 60));
        var stop = h('button', { type: 'button', class: 'lab-nc-fbtn' }, '停止專注');
        stop.addEventListener('click', function () { focusSession.endAt = 0; stopFocusTimer(); paintFocus(); });
        focusBox.appendChild(h('div', { class: 'lab-nc-fhead' }, '專注工作階段'));
        focusBox.appendChild(h('div', { class: 'lab-nc-frow' }, tt, stop));
        stopFocusTimer();
        focusTimer = setInterval(function () {
          if (!focusBox.isConnected) { stopFocusTimer(); return; }
          var l = Math.round((focusSession.endAt - Date.now()) / 1000);
          if (l <= 0) { focusSession.endAt = 0; stopFocusTimer(); toast('專注時間結束，休息一下吧'); paintFocus(); return; }
          tt.textContent = pad2(Math.floor(l / 60)) + ':' + pad2(l % 60);
        }, 1000);
        return;
      }
      var minus = h('button', { type: 'button', class: 'lab-nc-step', 'aria-label': '減少 5 分鐘' }, iconBox('minus', 12));
      var plus = h('button', { type: 'button', class: 'lab-nc-step', 'aria-label': '增加 5 分鐘' }, iconBox('plus', 12));
      var mins = h('span', { class: 'lab-nc-fmin', dataset: { lab: 'nc-focus-min' } }, String(focusSession.minutes));
      minus.addEventListener('click', function () { focusSession.minutes = clamp(focusSession.minutes - 5, 5, 240); mins.textContent = String(focusSession.minutes); });
      plus.addEventListener('click', function () { focusSession.minutes = clamp(focusSession.minutes + 5, 5, 240); mins.textContent = String(focusSession.minutes); });
      var go = h('button', { type: 'button', class: 'lab-nc-fgo', dataset: { lab: 'nc-focus-start' } }, '開始專注工作階段');
      go.addEventListener('click', function () { focusSession.endAt = Date.now() + focusSession.minutes * 60000; paintFocus(); });
      focusBox.appendChild(h('div', { class: 'lab-nc-fhead' }, '專注'));
      focusBox.appendChild(h('div', { class: 'lab-nc-frow' }, minus, h('span', { class: 'lab-nc-fval' }, mins, h('span', null, ' 分鐘')), plus, go));
    }
    paintFocus();

    var nc = h('div', { class: 'lab-nc', dataset: { lab: 'notification-center' } },
      h('div', { class: 'lab-nc-top' }, h('span', { class: 'lab-nc-title' }, '通知'), clearBtn),
      notifBox,
      h('div', { class: 'lab-nc-bottom' }, toggleCal, calWrap, focusBox));
    nc.style.maxHeight = Math.max(260, LAB.stage.dockTop() - 24 - 32) + 'px';        // the flyout sits on the taskbar: never taller than the room above it
    return nc;
  };

  /* ===================================================================== 執行 (Win+X > 執行) */
  var runHistory = [];
  var runEl = null;
  var KNOWN_NO_APP = { mspaint: 1, snippingtool: 1, wordpad: 1, charmap: 1, regedit: 1, msinfo32: 1, mstsc: 1, resmon: 1, perfmon: 1, cleanmgr: 1, dxdiag: 1, osk: 1, magnify: 1, narrator: 1,
    'services.msc': 1, 'devmgmt.msc': 1, 'eventvwr': 1, 'eventvwr.msc': 1, 'diskmgmt.msc': 1, 'compmgmt.msc': 1, 'taskschd.msc': 1, 'gpedit.msc': 1, 'lusrmgr.msc': 1 };
  var RUN_MAP = {
    notepad: 'textedit', cmd: 'terminal', powershell: 'terminal', powershell_ise: 'terminal', wt: 'terminal', explorer: 'finder', calc: 'calculator', taskmgr: 'taskmgr',
    code: 'code', msedge: 'edge', microsoftedge: 'edge', 'ms-settings:': 'settings', 'ms-photos:': 'photos', control: 'settings', 'ncpa.cpl': 'settings', 'main.cpl': 'settings', 'appwiz.cpl': 'settings'
  };
  /* what 執行 does with a line; returns {ok, kind} (ok=false: Windows could not find it). `exec` false = just classify (tests) */
  sys.runCommand = function (text, exec) {
    var raw = String(text || '').trim();
    if (!raw) return { ok: false, kind: 'empty' };
    var t = raw.replace(/^"([\s\S]*)"$/, '$1').trim(), low = t.toLowerCase(), cmd = low.replace(/\.exe$/, '');
    var go = exec !== false;
    function app(id, args, kind) { if (go) openApp(id, args); return { ok: true, kind: kind || 'app', appId: id }; }
    // a program name followed by something to open: `notepad notes.txt`, `explorer C:\Users\an\Documents`, `cmd /k dir` (the arguments only matter for the first two)
    var sp = /^("[^"]+"|\S+)\s+([\s\S]+)$/.exec(t);
    if (sp) {
      var head = sp[1].replace(/"/g, '').toLowerCase().replace(/\.exe$/, ''), rest = sp[2].trim().replace(/^"([\s\S]*)"$/, '$1');
      if (RUN_MAP[head] === 'finder' || RUN_MAP[head] === 'textedit' || RUN_MAP[head] === 'code') {
        var tp = LAB.win && LAB.win.fromWin ? LAB.win.fromWin(rest, HOME, { localized: true }) : null;
        if (tp && LAB.vfs.exists(tp)) {
          if (go) { if (RUN_MAP[head] === 'finder' && LAB.vfs.isDir(tp)) openApp('finder', { path: tp, via: 'run' }); else LAB.apps.openPath(tp, { via: 'run', appId: RUN_MAP[head] === 'finder' ? undefined : RUN_MAP[head] }); }
          return { ok: true, kind: 'path', path: tp, appId: RUN_MAP[head] };
        }
        return { ok: false, kind: 'missing', text: raw };
      }
      if (RUN_MAP[head] === 'terminal') return app('terminal');
    }
    if (/^ms-settings:/.test(low)) {
      var pg = { 'ms-settings:display': 'system/display', 'ms-settings:about': 'system/about', 'ms-settings:personalization-background': 'personalization/background', 'ms-settings:colors': 'personalization/colors',
        'ms-settings:network-wifi': 'network/wifi', 'ms-settings:bluetooth': 'bluetooth', 'ms-settings:nightlight': 'system/nightlight', 'ms-settings:sound': 'system/sound', 'ms-settings:windowsupdate': 'update' };
      return app('settings', { page: pg[low] || 'system' }, 'settings');
    }
    if (low === 'winver') { if (go) sys.openWinver(); return { ok: true, kind: 'winver' }; }
    if (RUN_MAP[cmd]) return app(RUN_MAP[cmd], cmd === 'control' ? { page: 'system' } : undefined);
    if (KNOWN_NO_APP[cmd] || KNOWN_NO_APP[low]) { if (go) toast('練習版沒有安裝這個程式'); return { ok: true, kind: 'stub' }; }
    if (low === '.' || low === '~' || /^%userprofile%$/.test(low)) { if (go) openApp('finder', { path: HOME, via: 'run' }); return { ok: true, kind: 'folder', path: HOME }; }
    if (/^(https?:\/\/|www\.)/i.test(t) || /^[a-z0-9-]+(\.[a-z0-9-]+)*\.(com|org|net|edu|tw|io|gov|info)(\/\S*)?$/i.test(t)) return app('edge', { url: /^https?:/i.test(t) ? t : 'https://' + t }, 'url');
    if (/[\\\/:~%]/.test(t) && LAB.win && LAB.win.fromWin) {
      var p = LAB.win.fromWin(t, HOME, { localized: true });
      if (p && LAB.vfs.exists(p)) {
        if (go) { var stp = LAB.vfs.stat(p); if (stp.type === 'dir') openApp('finder', { path: p, via: 'run' }); else LAB.desktop.openItem(p, 'run'); }
        return { ok: true, kind: 'path', path: p };
      }
    }
    return { ok: false, kind: 'missing', text: raw };
  };
  sys.openWinver = function () {
    var i = sys.info;
    LAB.ui.alert(null, { title: '關於 Windows', text: 'Microsoft Windows\n版本 ' + i.VERSION + '（OS 組建 ' + i.BUILD + '）\n© Microsoft Corporation. 著作權所有，並保留一切權利。\n\n這是練習用的電腦，不是真的 Windows。\n授權給：' + i.USER,
      buttons: [{ label: '確定', value: true, 'default': true }] });
  };
  sys.closeRun = function () {
    if (!runEl) return;
    var r = runEl; runEl = null;
    if (r.el.parentNode) r.el.parentNode.removeChild(r.el);
    if (r.off) r.off();
  };
  sys.openRun = function (prefill) {
    if (runEl) { runEl.input.focus(); runEl.input.select(); return; }
    var host = document.getElementById('lab-overlays');
    if (!host) return;
    if (LAB.menu) LAB.menu.closeAll();
    if (LAB.desktop) { if (LAB.desktop.closeStart) LAB.desktop.closeStart(); if (LAB.desktop.closeSpotlight) LAB.desktop.closeSpotlight(); }
    var input = h('input', { type: 'text', class: 'lab-run-input', 'aria-label': '開啟', spellcheck: 'false', autocomplete: 'off', dataset: { lab: 'run-input' } });
    var ok = h('button', { type: 'button', class: 'lab-run-btn is-default', dataset: { lab: 'run-ok' } }, '確定');
    var cancel = h('button', { type: 'button', class: 'lab-run-btn', dataset: { lab: 'run-cancel' } }, '取消');
    var browse = h('button', { type: 'button', class: 'lab-run-btn', dataset: { lab: 'run-browse' } }, '瀏覽(B)...');
    var close = h('button', { type: 'button', class: 'lab-run-x', 'aria-label': '關閉' }, iconBox('x', 12));
    var caret = h('button', { type: 'button', class: 'lab-run-caret', 'aria-label': '歷程記錄', tabindex: '-1' }, iconBox('chev-down', 12));
    var list = h('div', { class: 'lab-run-list', hidden: true });
    var el = h('div', { class: 'lab-run', role: 'dialog', 'aria-label': '執行', dataset: { lab: 'run-dialog' } },
      h('div', { class: 'lab-run-bar' }, iconBox('app-run', 16), h('span', { class: 'lab-run-title' }, '執行'), close),
      h('div', { class: 'lab-run-body' },
        h('div', { class: 'lab-run-intro' }, iconBox('app-run', 32, 'lab-run-ico'), h('p', null, 'Windows 會依據您輸入的名稱，為您開啟程式、資料夾、文件或網際網路資源。')),
        h('div', { class: 'lab-run-field' }, h('label', null, '開啟(O):'), h('div', { class: 'lab-run-combo' }, input, caret, list)),
        h('div', { class: 'lab-run-btns' }, ok, cancel, browse)));
    host.appendChild(el);
    runEl = { el: el, input: input, off: null };
    function refreshOk() { ok.disabled = !input.value.trim(); }
    function submit() {
      var v = input.value;
      if (!v.trim()) return;
      var r = sys.runCommand(v, true);
      if (r.ok) {
        if (runHistory.indexOf(v.trim()) < 0) runHistory.unshift(v.trim());
        LAB.bus.emit('run:exec', { text: v.trim(), kind: r.kind, appId: r.appId || null });
        sys.closeRun();
      } else {
        LAB.ui.alert(null, { title: v.trim(), text: 'Windows 找不到 \'' + v.trim() + '\'。請確定您輸入的名稱正確，然後再試一次。', buttons: [{ label: '確定', value: true, 'default': true }] })
          .then(function () { if (runEl) { runEl.input.focus(); runEl.input.select(); } });
      }
    }
    input.addEventListener('input', refreshOk);
    input.addEventListener('keydown', function (e) {
      e.stopPropagation();
      if (LAB.ui.isImeEnter(e)) return;
      if (e.key === 'Enter') { e.preventDefault(); submit(); }
      else if (e.key === 'Escape') { e.preventDefault(); sys.closeRun(); }
    });
    ok.addEventListener('click', submit);
    cancel.addEventListener('click', sys.closeRun);
    close.addEventListener('click', sys.closeRun);
    browse.addEventListener('click', function () { toast('練習版沒有瀏覽視窗，請直接輸入名稱或路徑'); });
    caret.addEventListener('click', function () {
      list.textContent = '';
      if (!runHistory.length) { list.hidden = true; return; }
      runHistory.slice(0, 6).forEach(function (t) {
        var it = h('div', { class: 'lab-run-opt' }, t);
        it.addEventListener('click', function () { input.value = t; list.hidden = true; refreshOk(); input.focus(); });
        list.appendChild(it);
      });
      list.hidden = !list.hidden;
    });
    runEl.off = LAB.keys.modal(function (e) {
      if (!runEl) return false;
      if (e.key === 'Escape' && !LAB.ui.isImeEnter(e)) { sys.closeRun(); return true; }
      return false;
    });
    if (typeof prefill === 'string') input.value = prefill;
    refreshOk();
    setTimeout(function () { input.focus(); input.select(); }, 0);
  };

  /* ===================================================================== sleep and power */
  var sleepRec = null;
  sys.sleep = function () {
    var stg = stageNode();
    if (sleepRec || !stg) return;
    if (LAB.menu) LAB.menu.closeAll();
    if (LAB.desktop) { if (LAB.desktop.closeStart) LAB.desktop.closeStart(); if (LAB.desktop.closeSpotlight) LAB.desktop.closeSpotlight(); if (LAB.desktop.closeFlyout) LAB.desktop.closeFlyout(); }
    sys.closeRun();
    var hint = h('div', { class: 'lab-sleep-hint' }, '按任意鍵或點一下，讓電腦醒來');
    var el = h('div', { class: 'lab-sleep', role: 'dialog', 'aria-label': '電腦睡眠中', dataset: { lab: 'sleep' } }, hint);
    stg.appendChild(el);
    requestAnimationFrame(function () { el.classList.add('is-in'); });
    var armed = false, armT = setTimeout(function () { armed = true; hint.classList.add('is-in'); }, 700);
    function wake() {
      if (!armed || !sleepRec) return;
      var r = sleepRec; sleepRec = null;
      clearTimeout(armT);
      r.offKeys(); window.removeEventListener('pointerdown', wake, true);
      el.classList.remove('is-in');
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, reduced() ? 0 : 260);
      LAB.bus.emit('sys:wake', {});
    }
    sleepRec = { el: el, offKeys: LAB.keys.modal(function (e) { wake(); return true; }) };
    window.addEventListener('pointerdown', wake, true);
    LAB.bus.emit('sys:sleep', {});
  };
  sys.isAsleep = function () { return !!sleepRec; };
  /* 關機 / 重新啟動 / 登出: all leave the practice (LAB.remote.disconnect asks first when there is progress) */
  sys.power = function (action) {
    if (action === 'sleep') { sys.sleep(); return; }
    LAB.bus.emit('sys:power', { action: action });
    if (LAB.desktop && LAB.desktop.disconnect) LAB.desktop.disconnect();
    else if (LAB.remote && LAB.remote.disconnect) LAB.remote.disconnect();
  };
  /* the 睡眠 / 關機 / 重新啟動 popup of the Start menu's power button and the 關機或登出 submenu of Win+X */
  sys.powerItems = function () {
    return [
      { label: '睡眠', icon: 'sleep', action: function () { sys.power('sleep'); } },
      { label: '關機', icon: 'power', action: function () { sys.power('shutdown'); } },
      { label: '重新啟動', icon: 'restart', action: function () { sys.power('restart'); } }
    ];
  };

  /* ===================================================================== Win+X (right-click Start) */
  sys.winX = function (x, y) {
    var dark = st.winMode === 'dark';
    function tool(name) { return function () { toast('練習版沒有「' + name + '」'); }; }
    var items = [
      { label: '已安裝的應用程式', accel: 'f', icon: 'apps', action: function () { openApp('settings', { page: 'apps/installed' }); } },
      { label: '電源選項', accel: 'o', icon: 'battery', action: tool('電源選項') },
      { label: '事件檢視器', accel: 'v', icon: 'doc-sm', action: tool('事件檢視器') },
      { label: '系統', accel: 'y', icon: 'laptop', action: function () { openApp('settings', { page: 'system/about' }); } },
      { label: '裝置管理員', accel: 'm', icon: 'fl-details', action: tool('裝置管理員') },
      { label: '網路連線', accel: 'w', icon: 'wifi', action: function () { openApp('settings', { page: 'network' }); } },
      { label: '磁碟管理', accel: 'k', icon: 'fl-view', action: tool('磁碟管理') },
      { label: '電腦管理', accel: 'g', icon: 'gear', action: tool('電腦管理') },
      { label: '終端機', accel: 'i', icon: 'app-terminal', action: function () { openApp('terminal'); } },
      { label: '終端機 (系統管理員)', accel: 'a', icon: 'app-terminal', action: function () { toast('練習版沒有系統管理員模式，已用一般終端機開啟'); openApp('terminal'); } },
      { separator: true },
      { label: '工作管理員', accel: 't', icon: 'app-taskmgr', action: function () { openApp('taskmgr'); } },
      { label: '設定', accel: 'n', icon: 'app-settings', action: function () { openApp('settings'); } },
      { label: '檔案總管', accel: 'e', icon: 'app-finder', action: function () { openApp('finder'); } },
      { label: '搜尋', accel: 's', icon: 'search', action: function () { LAB.desktop.openSpotlight(); } },
      { label: '執行', accel: 'r', icon: 'app-run', action: function () { sys.openRun(); } },
      { separator: true },
      { label: '關機或登出', accel: 'u', icon: 'power', submenu: [
        { label: '登出', icon: 'signout', action: function () { sys.power('signout'); } },
        { label: '睡眠', icon: 'sleep', action: function () { sys.power('sleep'); } },
        { label: '關機', icon: 'power', action: function () { sys.power('shutdown'); } },
        { label: '重新啟動', icon: 'restart', action: function () { sys.power('restart'); } }
      ] },
      { label: '桌面', accel: 'd', icon: 'desktop', action: function () { if (LAB.desktop && LAB.desktop.showDesktop) LAB.desktop.showDesktop(); } }
    ];
    LAB.menu.contextMenu(x, y, items, { dark: dark ? true : false, cls: 'is-winx' });
  };

  /* ===================================================================== Task View (the taskbar button): every window shrinks into a card */
  var tv = null;
  function tvClose(keep) {
    if (!tv) return;
    var t = tv; tv = null;
    t.offKeys();
    window.removeEventListener('pointerdown', t.onDock, true);
    t.offs.forEach(function (f) { f(); });
    t.items.forEach(function (it) {
      var w = it.win;
      if (w.closed) return;
      w.el.style.transform = '';
      w.el.classList.remove('is-tv');
      w.el.style.transformOrigin = '';
      if (it.wasMin && w !== keep) w.el.hidden = true;
    });
    var stg = stageNode();
    if (stg) stg.classList.remove('is-taskview');
    t.box.classList.remove('is-in');
    var gone = function () { if (t.box.parentNode) t.box.parentNode.removeChild(t.box); if (t.scrim.parentNode) t.scrim.parentNode.removeChild(t.scrim); };
    if (reduced()) gone(); else setTimeout(gone, 200);
    t.scrim.classList.remove('is-in');
    if (keep && !keep.closed) LAB.wm.focus(keep.id);
    LAB.bus.emit('taskview:close', { picked: keep ? keep.id : null });
  }
  function tvLayout() {
    var items = tv.items.filter(function (it) { return !it.win.closed; });
    var ar = LAB.stage.zoomRect();
    var top = 44, bottom = LAB.stage.dockTop() - 24;
    var X = ar.x + 8, W = Math.max(200, ar.w - 16), Y = top, H = Math.max(120, bottom - top);
    var n = items.length;
    tv.empty.style.display = n ? 'none' : '';
    if (!n) return;
    var cols = Math.max(1, Math.min(n, Math.ceil(Math.sqrt(n * W / H))));
    var rows = Math.ceil(n / cols);
    var cw = W / cols, ch = H / rows;
    items.forEach(function (it, i) {
      var c = i % cols, r = Math.floor(i / cols);
      var inRow = (r === rows - 1) ? n - r * cols : cols;
      var off = (cols - inRow) * cw / 2;
      var rc = it.win.getRect();
      var labelH = 30, pad = 16;
      var s = Math.min((cw - pad * 2) / rc.w, (ch - pad - labelH) / rc.h, 0.7);
      var w = rc.w * s, hh = rc.h * s;
      var cx = X + off + c * cw + cw / 2, cy = Y + r * ch + labelH + (ch - labelH - pad) / 2;
      it.tx = cx - w / 2; it.ty = cy - hh / 2; it.w = w; it.h = hh;
      it.win.el.style.transformOrigin = '0 0';
      it.win.el.style.transform = 'translate(' + (it.tx - rc.x) + 'px,' + (it.ty - rc.y) + 'px) scale(' + s + ')';
      it.card.style.left = it.tx + 'px'; it.card.style.top = it.ty + 'px'; it.card.style.width = w + 'px'; it.card.style.height = hh + 'px';
      it.label.style.left = it.tx + 'px'; it.label.style.top = (it.ty - 28) + 'px'; it.label.style.width = Math.max(w, 120) + 'px';
    });
    items.forEach(function (it, i) { it.card.classList.toggle('is-hl', i === tv.index); });
  }
  function tvOpen() {
    if (tv) return;
    var host = document.getElementById('lab-overlays'), stg = stageNode(), winsLayer = document.getElementById('lab-windows');
    if (!host || !stg || !winsLayer) return;
    if (LAB.menu) LAB.menu.closeAll();
    if (LAB.desktop) { ['closeStart', 'closeSpotlight', 'closeFlyout'].forEach(function (f) { if (LAB.desktop[f]) LAB.desktop[f](); }); }
    var wins = LAB.wm.all().filter(function (w) { return !w.closed; }).reverse();        // the front window first
    var scrim = h('div', { class: 'lab-tv-scrim', 'aria-hidden': 'true' });
    stg.insertBefore(scrim, winsLayer);
    var box = h('div', { class: 'lab-tv', role: 'dialog', 'aria-label': '工作檢視', dataset: { lab: 'taskview' } });
    var empty = h('div', { class: 'lab-tv-empty' }, '沒有開啟的視窗');
    box.appendChild(empty);
    host.appendChild(box);
    tv = { box: box, scrim: scrim, empty: empty, items: [], index: -1, offs: [], offKeys: null, onDock: null };
    wins.forEach(function (w) {
      var close = h('button', { type: 'button', class: 'lab-tv-x', 'aria-label': '關閉 ' + (w.getTitle() || ''), dataset: { lab: 'tv-close', win: w.id } }, iconBox('x', 12));
      var label = h('div', { class: 'lab-tv-label' }, iconBox(w.icon || 'app-' + w.appId, 16, 'lab-tv-ico'), h('span', { class: 'lab-tv-title' }, w.getTitle() || w.appId), close);
      var card = h('div', { class: 'lab-tv-card', role: 'button', tabindex: '0', 'aria-label': w.getTitle() || w.appId, dataset: { lab: 'tv-card', win: w.id, app: w.appId } });
      var it = { win: w, card: card, label: label, wasMin: w.isMinimized() };
      card.addEventListener('click', function () { tvClose(w); });
      card.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tvClose(w); } });
      close.addEventListener('click', function (e) {
        e.stopPropagation();
        if (w.close() === false) return;
        tv.items.splice(tv.items.indexOf(it), 1);
        if (card.parentNode) card.parentNode.removeChild(card);
        if (label.parentNode) label.parentNode.removeChild(label);
        tv.index = -1;
        tvLayout();
      });
      if (w.isMinimized()) { w.el.hidden = false; w.el.classList.remove('is-minimizing'); }
      w.el.classList.add('is-tv');
      box.appendChild(card); box.appendChild(label);
      tv.items.push(it);
    });
    stg.classList.add('is-taskview');
    // the cards are placed one frame later, so the windows glide from where they are
    requestAnimationFrame(function () { if (!tv) return; scrim.classList.add('is-in'); box.classList.add('is-in'); tvLayout(); });
    box.addEventListener('pointerdown', function (e) { if (e.target === box || e.target === empty) tvClose(null); });
    tv.offKeys = LAB.keys.modal(function (e) {
      if (!tv) return false;
      if (e.key === 'Escape') { tvClose(null); return true; }
      var n = tv.items.length;
      if (!n) return false;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'Tab') { tv.index = (tv.index + (e.shiftKey && e.key === 'Tab' ? -1 : 1) + n) % n; tvLayout(); return true; }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { tv.index = (tv.index - 1 + n) % n; tvLayout(); return true; }
      if (e.key === 'Enter') { if (tv.index >= 0) tvClose(tv.items[tv.index].win); return true; }
      return false;
    });
    tv.onDock = function (e) {
      var t = e.target;
      if (!t.closest || !t.closest('#lab-dock')) return;
      if (t.closest('[data-lab=taskview-button]')) return;
      tvClose(null);
    };
    window.addEventListener('pointerdown', tv.onDock, true);
    tv.offs.push(LAB.bus.on('stage:resize', function () { tvClose(null); }));
    tv.offs.push(LAB.bus.on('win:open', function () { tvClose(null); }));
    LAB.bus.emit('taskview:open', { count: wins.length });
  }
  sys.taskView = {
    open: tvOpen, close: function () { tvClose(null); }, isOpen: function () { return !!tv; },
    toggle: function () { if (tv) tvClose(null); else tvOpen(); }
  };

  /* ===================================================================== 設定 (app id: settings) */
  var sxCtl = null;      // {win, go(page)} of the open Settings window
  var NAV = [
    { id: 'system', title: '系統', icon: 'laptop' },
    { id: 'bluetooth', title: '藍牙與裝置', icon: 'bluetooth' },
    { id: 'network', title: '網路和網際網路', icon: 'wifi' },
    { id: 'personalization', title: '個人化', icon: 'fl-personalize' },
    { id: 'apps', title: '應用程式', icon: 'apps' },
    { id: 'accounts', title: '帳戶', icon: 'user' },
    { id: 'time', title: '時間與語言', icon: 'globe' },
    { id: 'gaming', title: '遊戲', icon: 'gamepad' },
    { id: 'accessibility', title: '協助工具', icon: 'accessibility' },
    { id: 'privacy', title: '隱私權與安全性', icon: 'shield' },
    { id: 'update', title: 'Windows Update', icon: 'restart' }
  ];
  var PAGE_TITLE = {
    'system/display': ['系統', '顯示器'], 'system/nightlight': ['系統', '顯示器', '夜間光線'], 'system/sound': ['系統', '音效'], 'system/about': ['系統', '關於'],
    'network/wifi': ['網路和網際網路', 'Wi-Fi'], 'personalization/background': ['個人化', '背景'], 'personalization/colors': ['個人化', '色彩'],
    'apps/installed': ['應用程式', '已安裝的應用程式']
  };
  /* what the search box finds: [text it matches, page, label shown] */
  var SX_INDEX = [
    ['顯示器 亮度 解析度 縮放 螢幕', 'system/display', '顯示器', '系統'], ['夜間光線 夜間模式 護眼 暖色', 'system/nightlight', '夜間光線', '系統 › 顯示器'],
    ['音效 音量 喇叭 聲音', 'system/sound', '音效', '系統'], ['關於 裝置名稱 處理器 規格 版本 組建 windows', 'system/about', '關於', '系統'],
    ['背景 桌布 桌面背景 wallpaper', 'personalization/background', '背景', '個人化'], ['色彩 深色 淺色 深色模式 淺色模式 mode', 'personalization/colors', '色彩', '個人化'],
    ['wi-fi wifi 無線 網路', 'network/wifi', 'Wi-Fi', '網路和網際網路'], ['藍牙 bluetooth', 'bluetooth', '藍牙與裝置', ''], ['已安裝的應用程式 應用程式', 'apps/installed', '已安裝的應用程式', '應用程式'],
    ['windows update 更新', 'update', 'Windows Update', ''], ['個人化', 'personalization', '個人化', ''], ['帳戶', 'accounts', '帳戶', ''], ['時間 語言 日期', 'time', '時間與語言', '']
  ];

  function openSettings(args) {
    var want = (args && args.page) || 'system';
    if (sxCtl && sxCtl.win && !sxCtl.win.closed) { sxCtl.go(want); sxCtl.win.focus(); return sxCtl.win; }

    var cur = 'system', hist = [];
    var main = h('div', { class: 'sx-main' });
    var crumb = h('div', { class: 'sx-crumb', dataset: { lab: 'st-crumb' } });
    var pageBox = h('div', { class: 'sx-page', dataset: { lab: 'st-page' } });
    var navList = h('div', { class: 'sx-navlist', role: 'navigation', 'aria-label': '設定類別' });
    var navBtns = {};
    NAV.forEach(function (n) {
      var b = h('button', { type: 'button', class: 'sx-navitem', dataset: { lab: 'st-nav', page: n.id } }, iconBox(n.icon, 18, 'sx-navico'), h('span', null, n.title));
      b.addEventListener('click', function () { go(n.id); });
      navBtns[n.id] = b;
      navList.appendChild(b);
    });
    var searchIn = h('input', { type: 'text', class: 'sx-search-in', placeholder: '尋找設定', 'aria-label': '尋找設定', spellcheck: 'false', autocomplete: 'off', dataset: { lab: 'st-search' } });
    var searchRes = h('div', { class: 'sx-search-res', hidden: true });
    var searchBox = h('div', { class: 'sx-search' }, iconBox('search', 16, 'sx-search-ico'), searchIn, searchRes);
    var user = h('div', { class: 'sx-user' }, h('span', { class: 'sx-avatar' }, iconBox('user', 30)), h('div', { class: 'sx-user-txt' }, h('div', { class: 'sx-user-name' }, 'an'), h('div', { class: 'sx-user-sub' }, '本機帳戶')));
    var nav = h('div', { class: 'sx-nav' }, user, searchBox, navList);
    var root = h('div', { class: 'sx sx-settings', dataset: { lab: 'settings' } }, nav, main);
    main.appendChild(crumb); main.appendChild(pageBox);

    var back = h('button', { type: 'button', class: 'sx-back', 'aria-label': '返回', disabled: true, dataset: { lab: 'st-back' } }, iconBox('back-arrow', 14));
    var bar = h('div', { class: 'sx-tbar' }, back, iconBox('app-settings', 16, 'sx-tbar-ico'), h('span', { class: 'sx-tbar-title' }, '設定'));
    var win = LAB.wm.open({
      appId: 'settings', title: '設定', width: 960, height: 660, minW: 460, minH: 400, theme: 'light', titlebar: 'custom', titlebarHeight: 32, singleton: 'settings',
      icon: 'app-settings', content: root, titlebarContent: bar
    });
    win.el.classList.add('sx-win');
    sxCtl = { win: win, go: go };
    win.on('close', function () { if (sxCtl && sxCtl.win === win) sxCtl = null; });

    function top(page) { return page.split('/')[0]; }
    function crumbOf(page) {
      return PAGE_TITLE[page] || [(NAV.filter(function (n) { return n.id === page; })[0] || { title: page }).title];
    }
    function go(page, noPush) {
      if (!pageDefs[page] && !NAV.some(function (n) { return n.id === page; })) page = 'system';
      if (!noPush && page !== cur) hist.push(cur);
      cur = page;
      render();
      back.disabled = !hist.length;
      LAB.bus.emit('settings:page', { page: page });
    }
    back.addEventListener('click', function () { if (hist.length) go(hist.pop(), true); });
    var pageBag = [];
    win.own(function () { pageBag.forEach(function (f) { f(); }); pageBag = []; });
    function render() {
      pageBag.forEach(function (f) { f(); });          // the watchers of the page that is being replaced
      pageBag = []; watchBag = pageBag;
      var tt = crumbOf(cur), parts = [];
      tt.forEach(function (t, i) {
        if (i === tt.length - 1) parts.push(h('span', { class: 'sx-crumb-cur' }, t));
        else {
          var target = i === 0 ? top(cur) : tt.slice(0, i + 1).join('/');
          var link = h('button', { type: 'button', class: 'sx-crumb-link' }, t);
          (function (idx) { link.addEventListener('click', function () { go(idx === 0 ? top(cur) : cur.split('/').slice(0, idx + 1).join('/')); }); })(i);
          parts.push(link); parts.push(iconBox('chev-right', 14, 'sx-crumb-sep'));
        }
      });
      crumb.textContent = '';
      parts.forEach(function (p) { crumb.appendChild(p); });
      pageBox.textContent = '';
      var def = pageDefs[cur] || pageDefs[top(cur)] || pageDefs.system;
      var ctx = { go: go, win: win, root: root, page: cur };
      var nodes = def(ctx);
      watchBag = null;
      (Array.isArray(nodes) ? nodes : [nodes]).forEach(function (n) { if (n) pageBox.appendChild(n); });
      pageBox.scrollTop = 0;
      Object.keys(navBtns).forEach(function (k) { navBtns[k].classList.toggle('is-on', k === top(cur)); navBtns[k].setAttribute('aria-current', k === top(cur) ? 'page' : 'false'); });
    }

    /* search */
    function paintSearch() {
      var q = searchIn.value.trim().toLowerCase();
      searchRes.textContent = '';
      if (!q) { searchRes.hidden = true; return; }
      var hits = SX_INDEX.filter(function (e) { return e[0].toLowerCase().indexOf(q) >= 0 || e[2].toLowerCase().indexOf(q) >= 0; }).slice(0, 6);
      if (!hits.length) searchRes.appendChild(h('div', { class: 'sx-search-none' }, '找不到「' + searchIn.value.trim() + '」的設定'));
      hits.forEach(function (e) {
        var it = h('button', { type: 'button', class: 'sx-search-opt', dataset: { lab: 'st-search-result', page: e[1] } }, h('span', { class: 'sx-search-t' }, e[2]), e[3] ? h('span', { class: 'sx-search-s' }, e[3]) : null);
        it.addEventListener('click', function () { searchIn.value = ''; searchRes.hidden = true; go(e[1]); });
        searchRes.appendChild(it);
      });
      searchRes.hidden = false;
    }
    searchIn.addEventListener('input', paintSearch);
    searchIn.addEventListener('keydown', function (e) {
      e.stopPropagation();
      if (LAB.ui.isImeEnter(e)) return;
      if (e.key === 'Enter') { var f = searchRes.querySelector('.sx-search-opt'); if (f) f.click(); }
      else if (e.key === 'Escape') { searchIn.value = ''; paintSearch(); }
    });
    searchIn.addEventListener('blur', function () { setTimeout(function () { searchRes.hidden = true; }, 160); });

    go(want, true);
    return win;
  }

  /* ---- Settings pages: each takes ctx {go, win, root} and returns nodes ---- */
  function sxRow(o) {
    var tag = o.onClick ? 'button' : 'div';
    var kids = [];
    if (o.icon) kids.push(iconBox(o.icon, 20, 'sx-row-ico'));
    kids.push(h('div', { class: 'sx-row-txt' }, h('div', { class: 'sx-row-title' }, o.title), o.desc ? h('div', { class: 'sx-row-desc' }, o.desc) : null));
    if (o.right) kids.push(h('div', { class: 'sx-row-right' }, o.right));
    if (o.chev) kids.push(iconBox('chev-right', 12, 'sx-row-chev'));
    var attrs = { class: 'sx-row' + (o.onClick ? ' is-click' : '') + (o.cls ? ' ' + o.cls : '') };
    if (tag === 'button') attrs.type = 'button';
    if (o.hook) attrs.dataset = { lab: o.hook };
    var el = h(tag, attrs, kids);
    if (o.onClick) el.addEventListener('click', o.onClick);
    return el;
  }
  function sxSection(title) { return h('div', { class: 'sx-section' }, title); }
  function sxSelect(opts, value, onChange, hook, label) {
    var sel = h('select', { class: 'sx-select', 'aria-label': label || '', dataset: hook ? { lab: hook } : null });
    opts.forEach(function (o) { var op = h('option', { value: o[0] }, o[1]); if (o[0] === value) op.selected = true; sel.appendChild(op); });
    sel.addEventListener('change', function () { onChange(sel.value, sel); });
    sel.addEventListener('keydown', function (e) { e.stopPropagation(); });
    return sel;
  }
  function sxButton(text, onClick, cls, hook) {
    var b = h('button', { type: 'button', class: 'sx-btn' + (cls ? ' ' + cls : ''), dataset: hook ? { lab: hook } : null }, text);
    b.addEventListener('click', onClick);
    return b;
  }
  function sxStub(text) { return function () { toast(text || '練習版沒有這個設定頁面'); }; }
  function sxFaux(rows) {                   // rows of a page that is only a picture: [title, desc]
    return rows.map(function (r) { return sxRow({ title: r[0], desc: r[1], chev: true, onClick: sxStub() }); });
  }
  /* a tiny picture of the desktop: the wallpaper, a taskbar in the Windows mode and a window in the app mode (updates when the mode or wallpaper changes) */
  function previewMock() {
    var mock = h('div', { class: 'sx-prev', dataset: { lab: 'st-preview' } },
      h('div', { class: 'sx-prev-win' }, h('div', { class: 'sx-prev-bar' }), h('div', { class: 'sx-prev-l1' }), h('div', { class: 'sx-prev-l2' }), h('div', { class: 'sx-prev-l3' })),
      h('div', { class: 'sx-prev-tb' }, h('i'), h('i'), h('i'), h('i')));
    function paint() {
      var w = wallById(st.wall);
      mock.style.backgroundColor = st.solid || w.bg;
      mock.style.backgroundImage = st.solid ? 'none' : 'url("' + w.url + '")';
      mock.style.backgroundPosition = w.pos;
      mock.setAttribute('data-win', st.winMode); mock.setAttribute('data-app', st.appMode);
    }
    paint();
    watch(mock, paint);
    return mock;
  }
  function copyText(btn, text) {
    LAB.clipboard.setText(text);
    var old = btn.textContent;
    btn.textContent = '已複製';
    setTimeout(function () { btn.textContent = old; }, 1600);
  }

  var pageDefs = {};
  pageDefs.system = function (c) {
    var i = sys.info;
    var hero = h('div', { class: 'sx-hero' },
      iconBox('dev-laptop', 96, 'sx-hero-ico'),
      h('div', { class: 'sx-hero-txt' }, h('div', { class: 'sx-hero-name' }, i.HOST), h('div', { class: 'sx-hero-sub' }, i.CPU), h('button', { type: 'button', class: 'sx-link', on: { click: sxStub('練習版不能重新命名這台電腦') } }, '重新命名')),
      h('div', { class: 'sx-hero-tiles' },
        h('button', { type: 'button', class: 'sx-tile', on: { click: function () { c.go('network/wifi'); } } }, iconBox('wifi', 20, 'sx-tile-ico'), h('div', null, h('div', { class: 'sx-tile-t' }, 'Wi-Fi'), h('div', { class: 'sx-tile-s' }, st.wifi ? i.WIFI : '已關閉'))),
        h('button', { type: 'button', class: 'sx-tile', on: { click: function () { c.go('update'); } } }, iconBox('restart', 20, 'sx-tile-ico'), h('div', null, h('div', { class: 'sx-tile-t' }, 'Windows Update'), h('div', { class: 'sx-tile-s' }, '您是最新狀態')))));
    return [hero,
      sxRow({ icon: 'fl-display', title: '顯示器', desc: '亮度、夜間光線、顯示器描述檔', chev: true, onClick: function () { c.go('system/display'); }, hook: 'st-row-display' }),
      sxRow({ icon: 'speaker', title: '音效', desc: '音量、輸出和輸入', chev: true, onClick: function () { c.go('system/sound'); }, hook: 'st-row-sound' }),
      sxRow({ icon: 'bell', title: '通知', desc: '應用程式和系統的警示', chev: true, onClick: sxStub() }),
      sxRow({ icon: 'clock', title: '專注', desc: '通知、自動規則', chev: true, onClick: sxStub() }),
      sxRow({ icon: 'battery', title: '電源', desc: '螢幕、睡眠、電源模式', chev: true, onClick: sxStub() }),
      sxRow({ icon: 'fl-view', title: '儲存體', desc: '儲存空間、磁碟機、設定規則', chev: true, onClick: sxStub() }),
      sxRow({ icon: 'fl-prompt', title: '遠端桌面', desc: '從另一台裝置連線到這台電腦', chev: true, onClick: sxStub() }),
      sxRow({ icon: 'fl-copy', title: '剪貼簿', desc: '剪下和複製歷程記錄、同步、清除', chev: true, onClick: sxStub() }),
      sxRow({ icon: 'info', title: '關於', desc: '裝置規格、重新命名電腦、Windows 規格', chev: true, onClick: function () { c.go('system/about'); }, hook: 'st-row-about' })];
  };
  pageDefs['system/display'] = function (c) {
    var bright = slider(st.brightness, function (v) { sys.set('brightness', v); }, '亮度');
    bright.dataset.lab = 'st-brightness';
    var brightVal = h('span', { class: 'sx-val' }, String(st.brightness));
    bright.addEventListener('input', function () { brightVal.textContent = bright.value; });
    var nightSw = toggle(st.night, function (v) { sys.set('night', v); }, '夜間光線', 'st-night-switch');
    var page = h('div', { class: 'sx-wrap' });
    page.appendChild(sxSection('亮度和色彩'));
    page.appendChild(sxRow({ icon: 'sun', title: '亮度', desc: '變更內建顯示器的亮度', right: h('div', { class: 'sx-slide' }, bright, brightVal) }));
    page.appendChild(sxRow({ icon: 'moon', title: '夜間光線', desc: '使用較暖的色彩，幫助您的眼睛放鬆', right: h('div', { class: 'sx-slide' }, h('span', { class: 'sx-val' }, st.night ? '開啟' : '關閉'), nightSw), chev: true,
      onClick: function (e) { if (e.target.closest && e.target.closest('.lab-sx-switch')) return; c.go('system/nightlight'); }, hook: 'st-row-night' }));
    page.appendChild(sxSection('縮放與版面配置'));
    function fixed(name) { return function (v, sel) { sel.value = name; toast('練習版的畫面大小固定，不能變更'); }; }
    page.appendChild(sxRow({ icon: 'fl-view', title: '縮放', desc: '變更文字、應用程式和其他項目的大小', right: sxSelect([['100', '100% (建議)'], ['125', '125%'], ['150', '150%']], '100', fixed('100'), null, '縮放') }));
    page.appendChild(sxRow({ icon: 'desktop', title: '顯示器解析度', desc: '調整解析度以符合已連線的顯示器', right: sxSelect([['1920', '1920 × 1200 (建議)'], ['1600', '1600 × 1000']], '1920', fixed('1920'), null, '解析度') }));
    page.appendChild(sxRow({ icon: 'rotate', title: '螢幕方向', desc: '', right: sxSelect([['land', '橫向']], 'land', function () {}, null, '方向') }));
    watch(page, function (d) {
      if (d.key === 'brightness' && +bright.value !== st.brightness) { bright.value = st.brightness; bright.paint(); brightVal.textContent = String(st.brightness); }
      if (d.key === 'night') { nightSw.set(st.night); }
    });
    return page;
  };
  pageDefs['system/nightlight'] = function () {
    var page = h('div', { class: 'sx-wrap' });
    var statusTxt = h('div', { class: 'sx-row-desc', dataset: { lab: 'st-night-status' } });
    var btn = sxButton('', function () { sys.set('night', !st.night); }, 'is-accent', 'st-night-btn');
    var strength = slider(st.nightStrength, function (v) { sys.set('nightStrength', v); }, '強度');
    strength.dataset.lab = 'st-night-strength';
    function paint() {
      btn.textContent = st.night ? '立即關閉' : '立即開啟';
      statusTxt.textContent = st.night ? '夜間光線目前開啟，螢幕偏暖。' : '夜間光線目前關閉。';
    }
    paint();
    page.appendChild(sxRow({ icon: 'moon', title: '夜間光線', desc: '', right: btn, cls: 'is-tall' }));
    page.lastChild.querySelector('.sx-row-txt').appendChild(statusTxt);
    page.appendChild(sxRow({ title: '強度', right: h('div', { class: 'sx-slide' }, strength) }));
    var sched = toggle(false, function () { toast('練習版的夜間光線不會依時間自動開關'); }, '排程夜間光線');
    page.appendChild(sxRow({ title: '排程夜間光線', right: h('div', { class: 'sx-slide' }, h('span', { class: 'sx-val' }, '關閉'), sched) }));
    watch(page, function () { paint(); });
    return page;
  };
  pageDefs['system/sound'] = function () {
    var vol = slider(st.volume, function (v) { sys.set('volume', v); valTxt.textContent = String(v); }, '音量');
    vol.dataset.lab = 'st-volume';
    var valTxt = h('span', { class: 'sx-val' }, String(st.volume));
    var page = h('div', { class: 'sx-wrap' });
    page.appendChild(sxSection('輸出'));
    page.appendChild(sxRow({ icon: 'speaker', title: '選擇要在何處播放音效', desc: '', right: sxSelect([['spk', '喇叭 (Realtek(R) Audio)']], 'spk', function () {}, null, '輸出裝置') }));
    page.appendChild(sxRow({ icon: 'speaker', title: '音量', desc: '', right: h('div', { class: 'sx-slide' }, vol, valTxt) }));
    page.appendChild(sxSection('輸入'));
    page.appendChild(sxRow({ icon: 'fl-prompt', title: '選擇用於說話或錄音的裝置', desc: '', right: sxSelect([['mic', '麥克風陣列 (Realtek(R) Audio)']], 'mic', function () {}, null, '輸入裝置') }));
    watch(page, function (d) { if (d.key === 'volume' && +vol.value !== st.volume) { vol.value = st.volume; vol.paint(); valTxt.textContent = String(st.volume); } });
    return page;
  };
  pageDefs['system/about'] = function () {
    var i = sys.info;
    var dev = [['裝置名稱', i.HOST], ['處理器', i.CPU + '   ' + i.CPU_SPEED], ['已安裝的 RAM', i.RAM + ' (' + i.RAM_AVAIL + ' 可用)'], ['裝置識別碼', i.DEVICE_ID], ['產品識別碼', i.PRODUCT_ID],
      ['系統類型', i.SYSTEM_TYPE], ['手寫筆和觸控', '此顯示器不提供手寫筆或觸控輸入']];
    var winSpec = [['版本', i.OS], ['版本', i.VERSION], ['安裝於', i.INSTALLED], ['OS 組建', i.BUILD], ['體驗', i.EXPERIENCE]];
    function block(title, rows, hook) {
      var cp = sxButton('複製', function () { copyText(cp, rows.map(function (r) { return r[0] + '\t' + r[1]; }).join('\n')); }, '', hook);
      var tbl = h('div', { class: 'sx-kv', dataset: { lab: hook + '-table' } });
      rows.forEach(function (r) { tbl.appendChild(h('div', { class: 'sx-kv-k' }, r[0])); tbl.appendChild(h('div', { class: 'sx-kv-v' }, r[1])); });
      return h('div', { class: 'sx-block' }, h('div', { class: 'sx-block-head' }, h('div', { class: 'sx-block-title' }, title), cp), tbl);
    }
    var hero = h('div', { class: 'sx-hero is-about' },
      iconBox('dev-laptop', 72, 'sx-hero-ico'),
      h('div', { class: 'sx-hero-txt' }, h('div', { class: 'sx-hero-name' }, i.HOST), h('div', { class: 'sx-hero-sub' }, i.LABEL)),
      sxButton('重新命名', sxStub('練習版不能重新命名這台電腦'), '', 'st-rename'));
    return [hero, block('裝置規格', dev, 'st-copy-device'), block('Windows 規格', winSpec, 'st-copy-windows'),
      sxRow({ icon: 'fl-link', title: '相關連結', desc: '網域或工作群組　系統保護　進階系統設定', cls: 'is-plain' })];
  };
  pageDefs.bluetooth = function () {
    var sw = toggle(st.bluetooth, function (v) { sys.set('bluetooth', v); paint(); }, '藍牙', 'st-bt-switch');
    var state = h('span', { class: 'sx-val' });
    var list = h('div', { class: 'sx-devs' });
    function paint() {
      state.textContent = st.bluetooth ? '開啟' : '關閉';
      list.textContent = '';
      list.appendChild(h('div', { class: 'sx-row-desc sx-pad' }, st.bluetooth ? '沒有已配對的裝置。' : '藍牙已關閉。'));
    }
    paint();
    var page = h('div', { class: 'sx-wrap' });
    page.appendChild(sxRow({ icon: 'bluetooth', title: '藍牙', desc: '探索並配對 Bluetooth 裝置', right: h('div', { class: 'sx-slide' }, state, sw), cls: 'is-tall' }));
    page.appendChild(sxSection('裝置'));
    page.appendChild(list);
    page.appendChild(sxRow({ icon: 'plus', title: '新增裝置', desc: '藍牙、無線顯示器、基座、其他', right: sxButton('新增裝置', sxStub('練習版找不到附近的裝置'), 'is-accent'), cls: 'is-tall' }));
    page.appendChild(sxSection('其他'));
    sxFaux([['滑鼠', '按鈕、滑鼠指標速度、捲動'], ['觸控板', '點選、手勢、捲動、縮放'], ['輸入', '文字建議、自動更正'], ['USB', 'USB 連線和通知'], ['自動播放', '抽取式磁碟機和記憶卡的預設值']]).forEach(function (r) { page.appendChild(r); });
    watch(page, function (d) { if (d.key === 'bluetooth') { sw.set(st.bluetooth); paint(); } });
    return page;
  };
  pageDefs.network = function (c) {
    var i = sys.info;
    var wsw = toggle(st.wifi, function (v) { sys.set('wifi', v); }, 'Wi-Fi', 'st-wifi-switch');
    var asw = toggle(st.airplane, function (v) { sys.set('airplane', v); }, '飛航模式', 'st-airplane-switch');
    var hero = h('div', { class: 'sx-hero is-net' }, iconBox('wifi', 40, 'sx-hero-ico'),
      h('div', { class: 'sx-hero-txt' }, h('div', { class: 'sx-hero-name is-sm', dataset: { lab: 'st-net-name' } }, st.wifi ? i.WIFI : 'Wi-Fi 已關閉'), h('div', { class: 'sx-hero-sub' }, st.wifi ? '已連線，安全' : '開啟 Wi-Fi 來連線')));
    var page = h('div', { class: 'sx-wrap' });
    page.appendChild(hero);
    page.appendChild(sxRow({ icon: 'wifi', title: 'Wi-Fi', desc: '連線、已知網路、輔助網路', right: h('div', { class: 'sx-slide' }, h('span', { class: 'sx-val' }, st.wifi ? '開啟' : '關閉'), wsw), chev: true,
      onClick: function (e) { if (e.target.closest && e.target.closest('.lab-sx-switch')) return; c.go('network/wifi'); }, hook: 'st-row-wifi' }));
    page.appendChild(sxRow({ icon: 'fl-display', title: '乙太網路', desc: '驗證、IP 和 DNS 設定、計量付費連線', right: h('span', { class: 'sx-val' }, '未連線'), chev: true, onClick: sxStub() }));
    page.appendChild(sxRow({ icon: 'lock', title: 'VPN', desc: '新增、連線、管理', chev: true, onClick: sxStub() }));
    page.appendChild(sxRow({ icon: 'airplane', title: '飛航模式', desc: '停止所有無線通訊', right: h('div', { class: 'sx-slide' }, h('span', { class: 'sx-val' }, st.airplane ? '開啟' : '關閉'), asw) }));
    page.appendChild(sxRow({ icon: 'globe', title: 'Proxy', desc: '用於 Wi-Fi 和乙太網路連線的 Proxy 伺服器', chev: true, onClick: sxStub() }));
    page.appendChild(sxRow({ icon: 'fl-more-opts', title: '進階網路設定', desc: '檢視所有網路介面卡、網路重設', chev: true, onClick: sxStub() }));
    watch(page, function (d) { if (d.key === 'wifi' || d.key === 'airplane') { c.go(c.page, true); } });
    return page;
  };
  pageDefs['network/wifi'] = function () {
    var i = sys.info;
    var sw = toggle(st.wifi, function (v) { sys.set('wifi', v); }, 'Wi-Fi', 'st-wifi-switch');
    var page = h('div', { class: 'sx-wrap' });
    page.appendChild(sxRow({ icon: 'wifi', title: 'Wi-Fi', desc: '', right: h('div', { class: 'sx-slide' }, h('span', { class: 'sx-val' }, st.wifi ? '開啟' : '關閉'), sw), cls: 'is-tall' }));
    if (st.wifi) {
      page.appendChild(sxSection('目前的連線'));
      page.appendChild(sxRow({ icon: 'wifi', title: i.WIFI, desc: '已連線，安全', right: sxButton('中斷連線', sxStub('練習版的 Wi-Fi 連線不能中斷，請用快速設定的 Wi-Fi 開關'), ''), cls: 'is-tall' }));
      var rows = [['SSID', i.WIFI], ['通訊協定', 'Wi-Fi 6 (802.11ax)'], ['安全性類型', 'WPA2-Personal'], ['網路頻帶', '5 GHz'], ['網路通道', '36'], ['連結速度 (接收/傳輸)', '866/866 (Mbps)'],
        ['IPv4 位址', i.IP], ['IPv4 DNS 伺服器', i.DNS + ' (未加密)'], ['製造商', 'Intel Corporation'], ['描述', i.ADAPTER], ['驅動程式版本', '23.60.0.9'], ['實體位址 (MAC)', i.MAC]];
      var cp = sxButton('複製', function () { copyText(cp, rows.map(function (r) { return r[0] + ': ' + r[1]; }).join('\n')); }, '');
      var tbl = h('div', { class: 'sx-kv', dataset: { lab: 'st-wifi-props' } });
      rows.forEach(function (r) { tbl.appendChild(h('div', { class: 'sx-kv-k' }, r[0])); tbl.appendChild(h('div', { class: 'sx-kv-v' }, r[1])); });
      page.appendChild(h('div', { class: 'sx-block' }, h('div', { class: 'sx-block-head' }, h('div', { class: 'sx-block-title' }, 'Wi-Fi 內容'), cp), tbl));
    } else page.appendChild(h('div', { class: 'sx-row-desc sx-pad' }, 'Wi-Fi 已關閉，目前沒有網路連線。'));
    watch(page, function (d) { if (d.key === 'wifi') { sw.set(st.wifi); if (sxCtl) sxCtl.go('network/wifi', true); } });
    return page;
  };
  pageDefs.personalization = function (c) {
    return [previewMock(),
      sxRow({ icon: 'gallery', title: '背景', desc: '背景圖片、純色', chev: true, onClick: function () { c.go('personalization/background'); }, hook: 'st-row-background' }),
      sxRow({ icon: 'fl-personalize', title: '色彩', desc: '強調色、深色或淺色模式', chev: true, onClick: function () { c.go('personalization/colors'); }, hook: 'st-row-colors' }),
      sxRow({ icon: 'desktop', title: '主題', desc: '安裝、建立、管理', chev: true, onClick: sxStub() }),
      sxRow({ icon: 'lock', title: '鎖定畫面', desc: '鎖定畫面影像、應用程式和動畫', chev: true, onClick: sxStub() }),
      sxRow({ icon: 'apps', title: '開始', desc: '最近使用的應用程式和項目、資料夾', chev: true, onClick: sxStub() }),
      sxRow({ icon: 'fl-details', title: '工作列', desc: '工作列行為、系統釘選', chev: true, onClick: sxStub() }),
      sxRow({ icon: 'fl-rename', title: '字型', desc: '安裝、管理', chev: true, onClick: sxStub() })];
  };
  pageDefs['personalization/background'] = function () {
    var page = h('div', { class: 'sx-wrap' });
    var gridBox = h('div', { class: 'sx-wallbox' });
    var kind = st.solid ? 'solid' : 'pic';
    function paintGrid() {
      gridBox.textContent = '';
      if (kind === 'pic') {
        var g = h('div', { class: 'sx-wallgrid' });
        WALLS.forEach(function (w) {
          var on = !st.solid && st.wall === w.id;
          var b = h('button', { type: 'button', class: 'sx-wall' + (on ? ' is-on' : ''), 'aria-label': w.name, 'aria-pressed': on ? 'true' : 'false', dataset: { lab: 'st-wall', wall: w.id } },
            h('span', { class: 'sx-wall-img', style: { backgroundImage: 'url("' + w.url + '")', backgroundColor: w.bg } }), h('span', { class: 'sx-wall-name' }, w.name));
          if (on) b.appendChild(iconBox('check', 14, 'sx-wall-check'));
          b.addEventListener('click', function () { sys.setWall(w.id); paintGrid(); });
          g.appendChild(b);
        });
        gridBox.appendChild(h('div', { class: 'sx-sub' }, '最近的影像'));
        gridBox.appendChild(g);
      } else {
        var s = h('div', { class: 'sx-swatches' });
        SOLIDS.forEach(function (c) {
          var on = st.solid === c;
          var b = h('button', { type: 'button', class: 'sx-swatch' + (on ? ' is-on' : ''), 'aria-label': c, style: { backgroundColor: c }, dataset: { lab: 'st-solid', color: c } });
          b.addEventListener('click', function () { sys.setSolid(c); paintGrid(); });
          s.appendChild(b);
        });
        gridBox.appendChild(h('div', { class: 'sx-sub' }, '選擇背景色彩'));
        gridBox.appendChild(s);
      }
    }
    var sel = sxSelect([['pic', '圖片'], ['solid', '純色'], ['show', '投影片']], kind, function (v, el) {
      if (v === 'show') { el.value = kind; toast('練習版沒有投影片背景'); return; }
      kind = v;
      if (v === 'solid' && !st.solid) sys.setSolid(SOLIDS[0]);
      if (v === 'pic' && st.solid) sys.setWall(st.wall);
      paintGrid();
    }, 'st-wall-kind', '個人化您的背景');
    page.appendChild(previewMock());
    page.appendChild(sxRow({ icon: 'gallery', title: '個人化您的背景', desc: '圖片、純色或投影片放映可以套用到桌面背景', right: sel, cls: 'is-tall' }));
    page.appendChild(gridBox);
    paintGrid();
    watch(page, function (d) { if (d.key === 'wall' || d.key === 'solid') { paintGrid(); } });
    return page;
  };
  pageDefs['personalization/colors'] = function (c) {
    var page = h('div', { class: 'sx-wrap' });
    var extra = h('div', { class: 'sx-extra' });
    function paintExtra() {
      extra.textContent = '';
      if (st.mode !== 'custom') return;
      extra.appendChild(sxRow({ title: '選擇您的預設 Windows 模式', desc: '', right: sxSelect([['light', '淺色'], ['dark', '深色']], st.winMode, function (v) { sys.set('winMode', v); }, 'st-winmode', '預設 Windows 模式') }));
      extra.appendChild(sxRow({ title: '選擇您的預設應用程式模式', desc: '', right: sxSelect([['light', '淺色'], ['dark', '深色']], st.appMode, function (v) { sys.set('appMode', v); }, 'st-appmode', '預設應用程式模式') }));
    }
    var modeSel = sxSelect([['light', '淺色'], ['dark', '深色'], ['custom', '自訂']], st.mode, function (v) { sys.setMode(v); paintExtra(); }, 'st-mode', '選擇您的模式');
    var transSw = toggle(st.trans, function (v) { sys.set('trans', v); }, '透明效果', 'st-trans-switch');
    page.appendChild(previewMock());
    page.appendChild(sxRow({ icon: 'fl-personalize', title: '選擇您的模式', desc: '選擇 Windows 和應用程式的色彩', right: modeSel, cls: 'is-tall' }));
    page.appendChild(extra);
    page.appendChild(sxRow({ icon: 'fl-view', title: '透明效果', desc: '視窗和表面會顯得半透明', right: h('div', { class: 'sx-slide' }, h('span', { class: 'sx-val' }, st.trans ? '開啟' : '關閉'), transSw) }));
    paintExtra();
    watch(page, function (d) {
      if (d.key === 'mode' || d.key === 'winMode' || d.key === 'appMode') { modeSel.value = st.mode; paintExtra(); }
      if (d.key === 'trans') { transSw.set(st.trans); }
    });
    return page;
  };
  pageDefs.apps = function (c) {
    return [sxRow({ icon: 'apps', title: '已安裝的應用程式', desc: '搜尋、排序和篩選、解除安裝', chev: true, onClick: function () { c.go('apps/installed'); }, hook: 'st-row-installed' }),
      sxRow({ icon: 'fl-open', title: '預設應用程式', desc: '檔案和連結類型的預設值', chev: true, onClick: sxStub() }),
      sxRow({ icon: 'fl-more-opts', title: '進階應用程式設定', desc: '選擇取得應用程式的位置', chev: true, onClick: sxStub() }),
      sxRow({ icon: 'rocket', title: '啟動', desc: '登入時自動啟動的應用程式', chev: true, onClick: sxStub() })];
  };
  pageDefs['apps/installed'] = function () {
    var ver = { finder: ['檔案總管', 'Microsoft Corporation', '—'], terminal: ['終端機', 'Microsoft Corporation', '1.24.2'], codex: ['Codex', 'OpenAI', '1.0.52'], code: ['Visual Studio Code', 'Microsoft Corporation', '1.104.0'],
      textedit: ['記事本', 'Microsoft Corporation', '11.2508.38.0'], edge: ['Microsoft Edge', 'Microsoft Corporation', '140.0.3485.54'], settings: ['設定', 'Microsoft Corporation', '—'],
      calculator: ['小算盤', 'Microsoft Corporation', '11.2508.4.0'], taskmgr: ['工作管理員', 'Microsoft Corporation', '—'], photos: ['相片', 'Microsoft Corporation', '2025.11090.20010.0'] };
    var page = h('div', { class: 'sx-wrap' });
    page.appendChild(sxSection('應用程式清單'));
    Object.keys(ver).forEach(function (id) {
      var v = ver[id];
      var def = LAB.apps.get(id);
      page.appendChild(sxRow({ icon: (def && def.icon) || 'app-' + id, title: v[0], desc: v[1] + (v[2] !== '—' ? '　' + v[2] : ''), right: h('span', { class: 'sx-val' }, '—'), cls: 'is-app' }));
    });
    return page;
  };
  pageDefs.accounts = function () {
    return [h('div', { class: 'sx-hero is-net' }, h('span', { class: 'sx-avatar is-big' }, iconBox('user', 44)),
      h('div', { class: 'sx-hero-txt' }, h('div', { class: 'sx-hero-name is-sm' }, 'an'), h('div', { class: 'sx-hero-sub' }, '本機帳戶　系統管理員'))),
      sxRow({ icon: 'user', title: '您的資訊', desc: '帳戶、相片、設定', chev: true, onClick: sxStub() }),
      sxRow({ icon: 'lock', title: '登入選項', desc: 'Windows Hello、PIN、密碼', chev: true, onClick: sxStub() }),
      sxRow({ icon: 'fl-link', title: '其他使用者', desc: '新增、管理這台電腦的帳戶', chev: true, onClick: sxStub() })];
  };
  pageDefs.time = function () {
    var d = LAB.clock.now();
    var zhd = ['日', '一', '二', '三', '四', '五', '六'];
    return [sxRow({ icon: 'clock', title: '日期和時間', desc: d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日 星期' + zhd[d.getDay()] + '　' + (d.getHours() < 12 ? '上午' : '下午') + ' ' + pad2(d.getHours() % 12 || 12) + ':' + pad2(d.getMinutes()) + '　(UTC+08:00) 台北', chev: true, onClick: sxStub() }),
      sxRow({ icon: 'globe', title: '語言與地區', desc: 'Windows 顯示語言：中文 (繁體，台灣)　地區：台灣', chev: true, onClick: sxStub() }),
      sxRow({ icon: 'ime', title: '輸入', desc: '輸入法：注音；按 Shift 切換中／英', chev: true, onClick: sxStub() })];
  };
  pageDefs.gaming = function () { return sxFaux([['Xbox Game Bar', '用控制器開啟 Game Bar'], ['擷取', '螢幕擷取、錄製']]); };
  pageDefs.accessibility = function () { return sxFaux([['文字大小', '文字大小'], ['滑鼠指標和觸控', '指標色彩、大小'], ['朗讀程式', '螢幕閱讀器'], ['色彩濾鏡', '色盲濾鏡']]); };
  pageDefs.privacy = function () { return sxFaux([['Windows 安全性', '病毒防護、保護帳戶、防火牆'], ['尋找我的裝置', '追蹤您的裝置'], ['位置', '位置服務、應用程式存取']]); };
  pageDefs.update = function () {
    var i = sys.info;
    var check = sxButton('檢查更新', function () { toast('練習版不會真的下載更新，您的裝置已是最新狀態'); }, 'is-accent');
    return [h('div', { class: 'sx-hero is-net' }, iconBox('restart', 40, 'sx-hero-ico'),
      h('div', { class: 'sx-hero-txt' }, h('div', { class: 'sx-hero-name is-sm' }, '您是最新狀態'), h('div', { class: 'sx-hero-sub' }, '上次檢查時間：今天，上午 09:30')), check),
      sxRow({ icon: 'clock', title: '暫停更新', desc: '暫停 1 週', right: sxButton('暫停 1 週', sxStub('練習版沒有更新可以暫停'), ''), cls: 'is-tall' }),
      sxRow({ icon: 'history', title: '更新記錄', desc: '2026-09 累積更新 (' + i.BUILD + ')，安裝於 2026/9/28', chev: true, onClick: sxStub() }),
      sxRow({ icon: 'fl-more-opts', title: '進階選項', desc: '傳遞最佳化、選擇性更新', chev: true, onClick: sxStub() })];
  };

  LAB.apps.register('settings', {
    title: '設定', en: 'Settings', aliases: ['settings', 'setting', 'ms-settings', '設定'], icon: 'app-settings', dock: false,
    open: function (args) { return openSettings(args || {}); },
    canHandle: function () { return false; }
  });
  sys.openSettings = function (page) { return openApp('settings', { page: page || 'system' }); };

  /* ===================================================================== 小算盤 (app id: calculator) — standard mode, evaluates like Windows Calculator */
  var CALC_SYM = { '+': '+', '-': '−', '*': '×', '/': '÷' };
  function calcClean(x) { return Number(Number(x).toPrecision(15)); }
  function calcGroup(intStr) { return intStr.replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  /* a number for the display: up to 16 digits, thousands separators, exponent form for very large / small values */
  function calcFmt(x) {
    if (typeof x === 'string') {                    // the string being typed keeps its trailing zeros and point
      var neg = x.charAt(0) === '-', body = neg ? x.slice(1) : x, p = body.split('.');
      return (neg ? '-' : '') + calcGroup(p[0]) + (p.length > 1 ? '.' + p[1] : '');
    }
    var r = calcClean(x);
    if (r === 0) return '0';
    var a = Math.abs(r);
    if (a >= 1e16 || a < 1e-9) return Number(r.toPrecision(16)).toExponential().replace(/e([+-])(\d)$/, 'e$1$2');
    var s = a >= 1e-6 ? String(a) : a.toFixed(18);
    if (/e/.test(s)) s = a.toFixed(18);
    if (s.indexOf('.') >= 0) s = s.replace(/0+$/, '').replace(/\.$/, '');
    var q = s.split('.');
    return (r < 0 ? '-' : '') + calcGroup(q[0]) + (q.length > 1 ? '.' + q[1] : '');
  }
  function calcNew() { return { cur: '0', acc: null, op: null, expr: '', fresh: true, justEq: false, err: '', lastOp: null, lastArg: null, mem: null, hist: [] }; }
  function calcApply(a, op, b) {
    if (op === '+') return a + b;
    if (op === '-') return a - b;
    if (op === '*') return a * b;
    if (b === 0) return a === 0 ? { err: '結果未定義' } : { err: '無法除以零' };
    return a / b;
  }
  /* S = state, k = key; returns nothing, S is updated (the pure engine, also used by the tests through sys.calc) */
  function calcPress(S, k) {
    if (S.err && k !== 'c' && k !== 'ce') return;
    var v;
    function setVal(r) { S.cur = String(calcClean(r)); }
    function fail(msg) { S.err = msg; S.acc = null; S.op = null; S.fresh = true; S.justEq = false; }
    if (/^[0-9]$/.test(k)) {
      if (S.justEq && S.fresh) { S.expr = ''; S.justEq = false; S.lastOp = null; }
      if (S.fresh) { S.cur = k; S.fresh = false; }
      else if (S.cur === '0') S.cur = k;
      else if (S.cur.replace(/[-.]/g, '').length < 16) S.cur += k;
      return;
    }
    if (k === '.') {
      if (S.justEq && S.fresh) { S.expr = ''; S.justEq = false; S.lastOp = null; }
      if (S.fresh) { S.cur = '0.'; S.fresh = false; }
      else if (S.cur.indexOf('.') < 0) S.cur += '.';
      return;
    }
    if (k === '+' || k === '-' || k === '*' || k === '/') {
      var sym = CALC_SYM[k];
      if (S.op && S.fresh && !S.justEq) { S.op = k; S.expr = S.expr.replace(/\S$/, sym); return; }
      var curN = parseFloat(S.cur);
      if (S.op && !S.fresh) {
        var r = calcApply(S.acc, S.op, curN);
        if (typeof r === 'object') { fail(r.err); return; }
        S.acc = calcClean(r); S.cur = String(S.acc);
      } else S.acc = curN;
      S.expr = calcFmt(S.acc) + ' ' + sym;
      S.op = k; S.fresh = true; S.justEq = false;
      return;
    }
    if (k === '=') {
      var a, b, op;
      if (S.op) { a = S.acc; op = S.op; b = S.fresh ? S.acc : parseFloat(S.cur); }
      else if (S.lastOp && S.justEq) { a = parseFloat(S.cur); op = S.lastOp; b = S.lastArg; }
      else { S.expr = calcFmt(parseFloat(S.cur)) + ' ='; S.justEq = true; S.fresh = true; return; }
      var res = calcApply(a, op, b);
      if (typeof res === 'object') { S.expr = calcFmt(a) + ' ' + CALC_SYM[op] + ' ' + calcFmt(b) + ' ='; fail(res.err); return; }
      res = calcClean(res);
      S.expr = calcFmt(a) + ' ' + CALC_SYM[op] + ' ' + calcFmt(b) + ' =';
      S.hist.push({ expr: S.expr, result: calcFmt(res), value: res });
      if (S.hist.length > 40) S.hist.shift();
      S.lastOp = op; S.lastArg = b; S.acc = null; S.op = null; S.cur = String(res); S.fresh = true; S.justEq = true;
      return;
    }
    if (k === 'pct') {
      if (S.op) { v = calcClean(S.acc * parseFloat(S.cur) / 100); S.cur = String(v); S.expr = calcFmt(S.acc) + ' ' + CALC_SYM[S.op] + ' ' + calcFmt(v); S.fresh = false; }
      else { S.cur = '0'; S.expr = '0'; S.fresh = true; }
      return;
    }
    if (k === 'neg') {
      if (S.cur === '0' || S.cur === '0.') return;
      S.cur = S.cur.charAt(0) === '-' ? S.cur.slice(1) : '-' + S.cur;
      return;
    }
    if (k === 'recip' || k === 'sqr' || k === 'sqrt') {
      v = parseFloat(S.cur);
      var label = k === 'recip' ? '1/(' + calcFmt(v) + ')' : k === 'sqr' ? 'sqr(' + calcFmt(v) + ')' : '√(' + calcFmt(v) + ')';
      var out;
      if (k === 'recip') { if (v === 0) { S.expr = label; fail('無法除以零'); return; } out = 1 / v; }
      else if (k === 'sqr') out = v * v;
      else { if (v < 0) { S.expr = label; fail('輸入無效'); return; } out = Math.sqrt(v); }
      setVal(out);
      S.expr = (S.op ? calcFmt(S.acc) + ' ' + CALC_SYM[S.op] + ' ' : '') + label;
      S.fresh = false; S.justEq = false;
      return;
    }
    if (k === 'ce') { S.cur = '0'; S.err = ''; S.fresh = false; if (S.justEq) { S.expr = ''; S.justEq = false; } return; }
    if (k === 'c') { S.cur = '0'; S.acc = null; S.op = null; S.expr = ''; S.fresh = true; S.justEq = false; S.err = ''; S.lastOp = null; return; }
    if (k === 'back') {
      if (S.fresh || S.justEq) { if (S.justEq) S.expr = ''; return; }
      S.cur = S.cur.slice(0, -1);
      if (S.cur === '' || S.cur === '-') S.cur = '0';
      return;
    }
    if (k === 'ms') { S.mem = parseFloat(S.cur); S.fresh = true; return; }
    if (k === 'mc') { S.mem = null; return; }
    if (k === 'mr') { if (S.mem !== null) { setVal(S.mem); S.fresh = false; } return; }
    if (k === 'mplus') { S.mem = calcClean((S.mem || 0) + parseFloat(S.cur)); S.fresh = true; return; }
    if (k === 'mminus') { S.mem = calcClean((S.mem || 0) - parseFloat(S.cur)); S.fresh = true; return; }
  }
  /* for tests and for anyone who wants the arithmetic: sys.calc.run(['1','+','2','=']) -> '3' */
  sys.calc = { fmt: calcFmt, press: calcPress, create: calcNew, run: function (keys) { var S = calcNew(); keys.forEach(function (k) { calcPress(S, k); }); return S.err || calcFmt(S.cur); } };

  var CALC_KEYS = [
    [['pct', '%', 'op'], ['ce', 'CE', 'op'], ['c', 'C', 'op'], ['back', null, 'op']],
    [['recip', '1/x', 'op'], ['sqr', 'x²', 'op'], ['sqrt', null, 'op'], ['/', '÷', 'op']],
    [['7', '7', 'num'], ['8', '8', 'num'], ['9', '9', 'num'], ['*', '×', 'op']],
    [['4', '4', 'num'], ['5', '5', 'num'], ['6', '6', 'num'], ['-', '−', 'op']],
    [['1', '1', 'num'], ['2', '2', 'num'], ['3', '3', 'num'], ['+', '+', 'op']],
    [['neg', '+/−', 'num'], ['0', '0', 'num'], ['.', '.', 'num'], ['=', '=', 'eq']]
  ];
  var CALC_KEYMAP = { '0': '0', '1': '1', '2': '2', '3': '3', '4': '4', '5': '5', '6': '6', '7': '7', '8': '8', '9': '9', '.': '.', ',': '.', '+': '+', '-': '-', '*': '*', '/': '/', 'Enter': '=', '=': '=',
    'Escape': 'c', 'Delete': 'ce', 'Backspace': 'back', '%': 'pct', 'r': 'recip', 'R': 'recip', '@': 'sqrt', 'q': 'sqr', 'Q': 'sqr', 'F9': 'neg' };

  function openCalculator() {
    var S = calcNew();
    var exprEl = h('div', { class: 'calc-expr', dataset: { lab: 'calc-expr' } });
    var resEl = h('div', { class: 'calc-result', dataset: { lab: 'calc-display' }, 'aria-live': 'polite' });
    var memBtns = {};
    var memRow = h('div', { class: 'calc-mem' });
    [['mc', 'MC'], ['mr', 'MR'], ['mplus', 'M+'], ['mminus', 'M−'], ['ms', 'MS'], ['mlist', 'M˅']].forEach(function (m) {
      var b = h('button', { type: 'button', class: 'calc-mbtn', tabindex: '-1', dataset: { lab: 'calc-key', key: m[0] } }, m[1]);
      b.addEventListener('click', function () { if (m[0] === 'mlist') { toast(S.mem === null ? '記憶體中沒有東西' : '記憶體：' + calcFmt(S.mem)); return; } press(m[0]); });
      memBtns[m[0]] = b; memRow.appendChild(b);
    });
    var keyEls = {};
    var grid = h('div', { class: 'calc-keys' });
    CALC_KEYS.forEach(function (row) {
      row.forEach(function (k) {
        var b = h('button', { type: 'button', class: 'calc-key is-' + k[2], tabindex: '-1', dataset: { lab: 'calc-key', key: k[0] }, 'aria-label': ({ back: '退格', sqrt: '平方根', pct: '百分比', ce: '清除輸入', c: '清除', neg: '正負號' })[k[0]] || k[1] });
        if (k[0] === 'back') b.appendChild(iconBox('backspace', 18));
        else if (k[0] === 'sqrt') b.appendChild(iconBox('calc-sqrt', 18));
        else b.textContent = k[1];
        b.addEventListener('click', function () { press(k[0]); });
        keyEls[k[0]] = b; grid.appendChild(b);
      });
    });
    var histList = h('div', { class: 'calc-hlist' });
    var histPane = h('div', { class: 'calc-hist', hidden: true, dataset: { lab: 'calc-history' } },
      h('div', { class: 'calc-hhead' }, h('span', null, '歷程記錄'), (function () { var c = h('button', { type: 'button', class: 'calc-hclear', 'aria-label': '清除歷程記錄' }, iconBox('fl-delete', 16)); c.addEventListener('click', function () { S.hist.length = 0; paintHist(); }); return c; })()),
      histList);
    function paintHist() {
      histList.textContent = '';
      if (!S.hist.length) { histList.appendChild(h('div', { class: 'calc-hempty' }, '尚無歷程記錄')); return; }
      S.hist.slice().reverse().forEach(function (e) {
        var it = h('button', { type: 'button', class: 'calc-hitem', tabindex: '-1' }, h('span', { class: 'calc-hexpr' }, e.expr), h('span', { class: 'calc-hres' }, e.result));
        it.addEventListener('click', function () { S.cur = String(e.value); S.fresh = true; S.justEq = true; S.op = null; S.acc = null; S.expr = ''; histPane.hidden = true; paint(); });
        histList.appendChild(it);
      });
    }
    var hamb = h('button', { type: 'button', class: 'calc-icon', 'aria-label': '開啟導覽', tabindex: '-1', dataset: { lab: 'calc-menu' } }, iconBox('hamburger', 18));
    var hbtn = h('button', { type: 'button', class: 'calc-icon', 'aria-label': '歷程記錄', tabindex: '-1', dataset: { lab: 'calc-history-btn' } }, iconBox('history', 18));
    var top = h('div', { class: 'calc-top' }, hamb, h('span', { class: 'calc-mode' }, '標準'), hbtn);
    var root = h('div', { class: 'sx sx-calc', tabindex: '0', dataset: { lab: 'calculator' } },
      top, h('div', { class: 'calc-disp' }, exprEl, resEl), memRow, grid, histPane);

    function paint() {
      var txt = S.err || (S.fresh ? calcFmt(parseFloat(S.cur)) : calcFmt(S.cur));
      resEl.textContent = txt;
      var n = txt.length;
      resEl.className = 'calc-result' + (n > 17 ? ' is-xs' : n > 13 ? ' is-sm' : n > 10 ? ' is-md' : '') + (S.err ? ' is-err' : '');
      exprEl.textContent = S.expr;
      memBtns.mc.disabled = memBtns.mr.disabled = memBtns.mlist.disabled = S.mem === null;
      Object.keys(keyEls).forEach(function (kk) { keyEls[kk].disabled = !!S.err && kk !== 'c' && kk !== 'ce' && kk !== '=' ? true : false; });
      ['mplus', 'mminus', 'ms'].forEach(function (m) { memBtns[m].disabled = !!S.err; });
    }
    function press(k) { calcPress(S, k); paint(); if (!histPane.hidden) paintHist(); }
    var win = LAB.wm.open({ appId: 'calculator', title: '小算盤', width: 336, height: 548, minW: 320, minH: 470, theme: 'light', icon: 'app-calc', content: root, singleton: 'calculator' });
    win.el.classList.add('sx-win');
    win.state.calc = S;
    hamb.addEventListener('click', function () {
      var r = LAB.stage.rectOf(hamb);
      LAB.menu.contextMenu(r.x, r.y + r.h + 4, [
        { label: '計算機', enabled: false },
        { label: '標準', checked: true, icon: 'fl-view' },
        { label: '科學', action: function () { toast('練習版只有標準模式'); } },
        { label: '繪圖', action: function () { toast('練習版只有標準模式'); } },
        { label: '程式設計人員', action: function () { toast('練習版只有標準模式'); } },
        { label: '日期計算', action: function () { toast('練習版只有標準模式'); } }
      ], { dark: document.documentElement.getAttribute('data-app-mode') === 'dark' ? true : false });
    });
    hbtn.addEventListener('click', function () { histPane.hidden = !histPane.hidden; if (!histPane.hidden) paintHist(); });
    root.addEventListener('mousedown', function (e) { if (!e.target.closest('input')) setTimeout(function () { root.focus({ preventScroll: true }); }, 0); });
    root.addEventListener('keydown', function (e) {
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      var k = CALC_KEYMAP[e.key];
      if (!k) return;
      e.preventDefault(); e.stopPropagation();
      var b = keyEls[k];
      if (b) { b.classList.add('is-press'); setTimeout(function () { b.classList.remove('is-press'); }, 90); }
      press(k);
    });
    paint();
    setTimeout(function () { root.focus({ preventScroll: true }); }, 0);
    return win;
  }
  LAB.apps.register('calculator', {
    title: '小算盤', en: 'Calculator', aliases: ['calculator', 'calc', '小算盤', '計算機'], icon: 'app-calc', dock: false,
    open: function () { return openCalculator(); },
    canHandle: function () { return false; }
  });

  /* ===================================================================== 工作管理員 (app id: taskmgr) */
  var TM_SERVICES = [
    ['AudioEndpointBuilder', 1040, 'Windows 音訊端點建立器', '執行中', 'LocalSystemNetworkRestricted'], ['Audiosrv', 1196, 'Windows 音訊', '執行中', 'LocalServiceNetworkRestricted'],
    ['BFE', 1196, '基本篩選引擎', '執行中', 'LocalServiceNoNetworkFirewall'], ['BITS', 1040, '背景智慧型傳送服務', '執行中', 'netsvcs'], ['BthAvctpSvc', 1196, 'AVCTP 服務', '執行中', 'LocalService'],
    ['Dhcp', 1196, 'DHCP 用戶端', '執行中', 'LocalServiceNetworkRestricted'], ['Dnscache', 1112, 'DNS 用戶端', '執行中', 'NetworkService'], ['EventLog', 1356, 'Windows 事件記錄檔', '執行中', 'LocalServiceNetworkRestricted'],
    ['LanmanWorkstation', 1112, '工作站', '執行中', 'NetworkService'], ['mpssvc', 1196, 'Windows Defender 防火牆', '執行中', 'LocalServiceNoNetworkFirewall'], ['Spooler', 2208, '列印多工緩衝處理器', '執行中', ''],
    ['Themes', 1040, '佈景主題', '執行中', 'netsvcs'], ['WlanSvc', 1040, 'WLAN AutoConfig', '執行中', 'LocalSystemNetworkRestricted'], ['WSearch', 3120, 'Windows Search', '執行中', ''],
    ['wuauserv', 0, 'Windows Update', '已停止', 'netsvcs'], ['Fax', 0, '傳真', '已停止', ''], ['XblAuthManager', 0, 'Xbox Live 驗證管理員', '已停止', 'netsvcs']
  ];
  var TM_STARTUP = [['Microsoft OneDrive', 'Microsoft Corporation', '已啟用', '中'], ['Windows 安全性通知圖示', 'Microsoft Corporation', '已啟用', '低'], ['Microsoft Edge', 'Microsoft Corporation', '已停用', '無'], ['Codex', 'OpenAI', '已停用', '無']];
  var TM_NAV = [
    ['processes', '處理程序', 'table'], ['performance', '效能', 'pulse'], ['history', '應用程式歷程記錄', 'history'], ['startup', '啟動應用程式', 'rocket'],
    ['users', '使用者', 'user'], ['details', '詳細資料', 'list-view'], ['services', '服務', 'gear']
  ];
  function tmMB(n) { return n >= 1000 ? (n / 1024).toFixed(1) + ' GB' : n.toFixed(1) + ' MB'; }
  function tmPct(n) { return (n < 10 ? n.toFixed(1) : String(Math.round(n))) + '%'; }
  function tmSvgPath(arr, w, hgt, max) {
    var n = arr.length, d = '';
    for (var i = 0; i < n; i++) {
      var x = (i / (n - 1)) * w, y = hgt - clamp(arr[i] / max, 0, 1) * (hgt - 1) - 0.5;
      d += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
    }
    return d;
  }
  function tmWalk(len, start, lo, hi, step) {            // a small random walk (the seeded generator), for the first 60 points of every graph
    var a = [], v = start;
    for (var i = 0; i < len; i++) { v = clamp(v + (rnd() - 0.5) * step, lo, hi); a.push(v); }
    return a;
  }

  function openTaskMgr(args) {
    var page = (args && args.page) || 'processes';
    var sel = null, expanded = {}, collapsedGroups = { win: false }, sort = { key: null, dir: 1 };
    var perfSel = 'cpu', timer = null, ticks = 0;
    var pf0 = sys.perf();      // the graphs start from where the machine is now, so they join up with the live values
    var series = { cpu: tmWalk(60, pf0.cpu, 1, 40, 4), mem: tmWalk(60, pf0.memPct, pf0.memPct - 3, pf0.memPct + 3, 0.5), disk: tmWalk(60, pf0.disk, 0, 8, 2.2), net: tmWalk(60, pf0.netRecv, 0, 40, 9) };
    var boot = new Date(2026, 9, 2, 8, 58, 0).getTime();

    var navBox = h('div', { class: 'tk-nav', role: 'navigation', 'aria-label': '工作管理員' });
    var hamb = h('button', { type: 'button', class: 'tk-hamb', 'aria-label': '展開或摺疊導覽', dataset: { lab: 'tk-hamb' } }, iconBox('hamburger', 18));
    navBox.appendChild(hamb);
    var navBtns = {};
    TM_NAV.forEach(function (n) {
      var b = h('button', { type: 'button', class: 'tk-navitem', dataset: { lab: 'tk-nav', page: n[0] }, title: n[1] }, iconBox(n[2], 18, 'tk-navico'), h('span', { class: 'tk-navtxt' }, n[1]));
      b.addEventListener('click', function () { go(n[0]); });
      navBtns[n[0]] = b; navBox.appendChild(b);
    });
    navBox.appendChild(h('div', { class: 'tk-navgap' }));
    var setBtn = h('button', { type: 'button', class: 'tk-navitem', title: '設定' }, iconBox('gear', 18, 'tk-navico'), h('span', { class: 'tk-navtxt' }, '設定'));
    setBtn.addEventListener('click', function () { toast('練習版的工作管理員沒有設定'); });
    navBox.appendChild(setBtn);

    var title = h('div', { class: 'tk-title', dataset: { lab: 'tk-title' } });
    var runBtn = h('button', { type: 'button', class: 'tk-tbtn', dataset: { lab: 'tk-run' } }, iconBox('run-arrow', 14), h('span', null, '執行新工作'));
    var endBtn = h('button', { type: 'button', class: 'tk-tbtn', dataset: { lab: 'tk-end' }, disabled: true }, iconBox('x', 14), h('span', null, '結束工作'));
    var effBtn = h('button', { type: 'button', class: 'tk-tbtn', disabled: true }, iconBox('battery-saver', 14), h('span', null, '效率模式'));
    var searchIn = h('input', { type: 'text', class: 'tk-search', placeholder: '輸入名稱、發行者或 PID 以進行搜尋', 'aria-label': '搜尋', spellcheck: 'false', dataset: { lab: 'tk-search' } });
    searchIn.addEventListener('keydown', function (e) { e.stopPropagation(); });
    searchIn.addEventListener('input', function () { if (page === 'processes' || page === 'details') renderPage(true); });
    var head = h('div', { class: 'tk-head' }, title, h('div', { class: 'tk-tools' }, searchIn, runBtn, endBtn, effBtn));
    var body = h('div', { class: 'tk-body', dataset: { lab: 'tk-body' } });
    var main = h('div', { class: 'tk-main' }, head, body);
    var root = h('div', { class: 'sx sx-tm', dataset: { lab: 'taskmgr' } }, navBox, main);
    var win = LAB.wm.open({ appId: 'taskmgr', title: '工作管理員', width: 940, height: 600, minW: 640, minH: 400, theme: 'light', icon: 'app-taskmgr', content: root, singleton: 'taskmgr' });
    win.el.classList.add('sx-win');
    tmCtl = { win: win, go: go };
    win.on('close', function () { if (tmCtl && tmCtl.win === win) tmCtl = null; });

    // the navigation folds by itself in a narrow window (container query); the hamburger forces it open or closed
    hamb.addEventListener('click', function () {
      var collapsed = root.classList.contains('is-closed') || (!root.classList.contains('is-open') && root.clientWidth <= 780);
      root.classList.toggle('is-open', collapsed); root.classList.toggle('is-closed', !collapsed);
    });
    runBtn.addEventListener('click', function () { sys.openRun(); });
    endBtn.addEventListener('click', endSelected);

    /* ---- selection and ending a task ---- */
    function setSel(k) { sel = k; paintSel(); }
    function paintSel() {
      var rows = body.querySelectorAll('.tk-item');
      for (var i = 0; i < rows.length; i++) rows[i].classList.toggle('is-sel', rows[i].dataset.key === sel);
      endBtn.disabled = !sel;
    }
    function selInfo() {
      if (!sel) return null;
      var m = /^(p|w):(.+)$/.exec(sel);
      if (!m) return null;
      if (m[1] === 'w') return { kind: 'win', id: m[2] };
      var pid = +m[2], list = sys.processes(), p = null;
      for (var i = 0; i < list.length; i++) if (list[i].pid === pid) p = list[i];
      return p ? { kind: 'proc', p: p } : null;
    }
    function endSelected() {
      var s = selInfo();
      if (!s) return;
      endInfo(s);
    }
    function endInfo(s) {
      if (s.kind === 'win') { LAB.wm.close(s.id, { force: true }); sel = null; if (!win.closed) renderPage(true); return; }
      var r = sys.killProcess(s.p.pid);
      if (!r.ok) {
        LAB.ui.alert(win, { title: '無法結束這個程序', text: '「' + s.p.exe + '」是 Windows 需要的程序。練習版和真的電腦一樣，不讓您結束它（結束後電腦可能會當機）。', buttons: [{ label: '確定', value: true, 'default': true }] });
        return;
      }
      sel = null;
      if (!win.closed) renderPage(true);
    }

    /* ---- the 處理程序 table ---- */
    function sortList(arr) {
      if (!sort.key) { return arr.slice().sort(function (a, b) { return String(a.title).localeCompare(String(b.title), 'zh-Hant'); }); }
      return arr.slice().sort(function (a, b) {
        var x = a[sort.key], y = b[sort.key];
        if (sort.key === 'name') return sort.dir * String(a.title).localeCompare(String(b.title), 'zh-Hant');
        return sort.dir * (y - x);                         // numbers: biggest first, a second click on the header flips it
      });
    }
    function th(label, value, key, cls) {
      var b = h('button', { type: 'button', class: 'tk-th' + (cls ? ' ' + cls : '') + (key && sort.key === key ? ' is-sorted' : ''), dataset: { lab: 'tk-th', col: key || '' } },
        h('span', { class: 'tk-th-v' }, value || ''), h('span', { class: 'tk-th-l' }, label));
      if (key) b.addEventListener('click', function () {
        if (sort.key === key) sort.dir = -sort.dir; else { sort.key = key; sort.dir = key === 'name' ? 1 : 1; }
        renderPage(true);
      });
      return b;
    }
    function heat(el, v, scale) { el.style.background = v > 0 ? 'rgba(var(--tm-heat),' + clamp(v / scale, 0, 1).toFixed(2) + ')' : ''; }
    function rowMenu(e, key) {
      e.preventDefault(); e.stopPropagation();
      setSel(key);
      var s = selInfo();
      if (!s) return;
      var p = LAB.stage.toStage(e.clientX, e.clientY);
      var items = [];
      var hasWins = s.kind === 'proc' && s.p.windows && s.p.windows.length;
      var dark = document.documentElement.getAttribute('data-app-mode') === 'dark';
      if (hasWins) items.push({ label: expanded[s.p.pid] ? '摺疊' : '展開', action: function () { expanded[s.p.pid] = !expanded[s.p.pid]; renderPage(true); } });
      if ((s.kind === 'proc' && s.p.appId && s.p.main) || s.kind === 'win') items.push({ label: '切換到', action: function () {
        var w = s.kind === 'win' ? LAB.wm.get(s.id) : LAB.wm.lastFocused(s.p.appId) || LAB.wm.byApp(s.p.appId)[0];
        if (w) LAB.wm.focus(w.id);
      } });
      items.push({ label: '結束工作', icon: 'x', action: function () { endInfo(s); }, danger: false });
      items.push({ separator: true });
      items.push({ label: '資源值', submenu: [{ label: '記憶體', action: noToast }, { label: '磁碟', action: noToast }, { label: '網路', action: noToast }] });
      items.push({ label: '提供意見反應', action: noToast });
      items.push({ label: '效率模式', enabled: false });
      items.push({ label: '建立傾印檔案', enabled: false });
      items.push({ separator: true });
      items.push({ label: '移至詳細資料', action: function () { if (s.kind === 'proc') { sel = 'p:' + s.p.pid; go('details'); } } });
      items.push({ label: '開啟檔案位置', action: noToast });
      items.push({ label: '線上搜尋', action: noToast });
      items.push({ label: '內容', action: noToast });
      LAB.menu.contextMenu(p.x, p.y, items, { dark: dark });
    }
    function nameCell(chev, icon, text, indent) {
      var c = h('div', { class: 'tk-c tk-c-name' }, h('span', { class: 'tk-indent', style: { width: (indent || 0) * 18 + 'px' } }), chev || h('span', { class: 'tk-chev-sp' }), icon ? iconBox(icon, 16, 'tk-ico') : null, h('span', { class: 'tk-name-t' }, text));
      return c;
    }
    function renderProcesses() {
      var list = sys.processes(), perf = sys.perf(list);
      var q = searchIn.value.trim().toLowerCase();
      function match(p) { return !q || (p.title + ' ' + p.exe + ' ' + p.pid).toLowerCase().indexOf(q) >= 0; }
      var net = (perf.netSend + perf.netRecv) / 1000;
      var cols = h('div', { class: 'tk-cols tk-grid tk-proc' },
        th('名稱', '', 'name', 'is-name'), th('狀態', '', null), th('CPU', Math.round(perf.cpu) + '%', 'cpu'), th('記憶體', Math.round(perf.memPct) + '%', 'mem'),
        th('磁碟', Math.round(perf.disk) + '%', 'disk'), th('網路', net.toFixed(1) + ' Mbps', 'net'));
      var rows = h('div', { class: 'tk-rows' });
      var groups = [['apps', '應用程式'], ['bg', '背景處理程序'], ['win', 'Windows 處理程序']];
      groups.forEach(function (g) {
        var items = sortList(list.filter(function (p) { return p.group === g[0] && match(p); }));
        if (!items.length && g[0] === 'apps' && !q) { /* an empty group still shows its header */ }
        var open = !collapsedGroups[g[0]];
        var gh = h('div', { class: 'tk-grp', dataset: { lab: 'tk-group', group: g[0] } }, iconBox(open ? 'chev-down' : 'chev-right', 12, 'tk-gchev'), h('span', null, g[1] + ' (' + items.length + ')'));
        gh.addEventListener('click', function () { collapsedGroups[g[0]] = !collapsedGroups[g[0]]; renderPage(true); });
        rows.appendChild(gh);
        if (!open) return;
        items.forEach(function (p) {
          var key = 'p:' + p.pid;
          var hasW = p.windows && p.windows.length;
          var chev = null;
          if (hasW) {
            chev = h('button', { type: 'button', class: 'tk-chev', 'aria-label': expanded[p.pid] ? '摺疊' : '展開', tabindex: '-1' }, iconBox(expanded[p.pid] ? 'chev-down' : 'chev-right', 10));
            chev.addEventListener('click', function (e) { e.stopPropagation(); expanded[p.pid] = !expanded[p.pid]; renderPage(true); });
          }
          var ic = p.kind === 'app' ? (LAB.apps.get(p.appId) && LAB.apps.get(p.appId).icon) || 'app-' + p.appId : 'app';
          var row = h('div', { class: 'tk-row tk-grid tk-proc tk-item' + (p.kind === 'app' ? ' is-app' : ''), dataset: { lab: 'tk-row', key: key, pid: String(p.pid), kind: p.kind, app: p.appId || '', group: p.group } },
            nameCell(chev, ic, p.title, 0), h('div', { class: 'tk-c tk-c-status' }, p.status), h('div', { class: 'tk-c tk-c-num' }, tmPct(p.cpu)), h('div', { class: 'tk-c tk-c-num' }, tmMB(p.mem)),
            h('div', { class: 'tk-c tk-c-num' }, p.disk.toFixed(1) + ' MB/秒'), h('div', { class: 'tk-c tk-c-num' }, p.net.toFixed(1) + ' Mbps'));
          heat(row.children[2], p.cpu, 40); heat(row.children[3], p.mem, 700); heat(row.children[4], p.disk, 3); heat(row.children[5], p.net, 4);
          row.addEventListener('pointerdown', function (e) { if (e.button === 0 && !e.target.closest('.tk-chev')) setSel(key); });
          row.addEventListener('contextmenu', function (e) { rowMenu(e, key); });
          row.addEventListener('dblclick', function () { if (hasW) { expanded[p.pid] = !expanded[p.pid]; renderPage(true); } });
          rows.appendChild(row);
          if (hasW && expanded[p.pid]) {
            p.windows.forEach(function (w) {
              var wk = 'w:' + w.id;
              var wr = h('div', { class: 'tk-row tk-grid tk-proc tk-item is-win', dataset: { lab: 'tk-row', key: wk, kind: 'win', win: w.id } },
                nameCell(null, null, w.title, 1), h('div', { class: 'tk-c tk-c-status' }, w.minimized ? '已最小化' : ''), h('div', { class: 'tk-c' }), h('div', { class: 'tk-c' }), h('div', { class: 'tk-c' }), h('div', { class: 'tk-c' }));
              wr.addEventListener('pointerdown', function (e) { if (e.button === 0) setSel(wk); });
              wr.addEventListener('contextmenu', function (e) { rowMenu(e, wk); });
              rows.appendChild(wr);
            });
          }
        });
      });
      return [cols, rows];
    }

    /* ---- 詳細資料 ---- */
    function renderDetails() {
      var list = sys.processes();
      var q = searchIn.value.trim().toLowerCase();
      list = list.filter(function (p) { return !q || (p.exe + ' ' + p.pid + ' ' + p.desc).toLowerCase().indexOf(q) >= 0; });
      list.sort(function (a, b) { return a.exe.toLowerCase() < b.exe.toLowerCase() ? -1 : a.exe.toLowerCase() > b.exe.toLowerCase() ? 1 : a.pid - b.pid; });
      var cols = h('div', { class: 'tk-cols tk-grid tk-det' }, ['名稱', 'PID', '狀態', '使用者名稱', 'CPU', '記憶體 (使用中的私人工作集)', '描述'].map(function (t, i) { return h('div', { class: 'tk-th2' + (i === 1 || i >= 4 && i < 6 ? ' is-num' : '') }, t); }));
      var rows = h('div', { class: 'tk-rows' });
      list.forEach(function (p) {
        var key = 'p:' + p.pid;
        var ic = p.kind === 'app' ? (LAB.apps.get(p.appId) && LAB.apps.get(p.appId).icon) || 'app-' + p.appId : 'app';
        var row = h('div', { class: 'tk-row tk-grid tk-det tk-item', dataset: { lab: 'tk-row', key: key, pid: String(p.pid), kind: p.kind, app: p.appId || '' } },
          h('div', { class: 'tk-c tk-c-name' }, iconBox(ic, 16, 'tk-ico'), h('span', { class: 'tk-name-t' }, p.exe)), h('div', { class: 'tk-c tk-c-num' }, String(p.pid)), h('div', { class: 'tk-c' }, '執行中'),
          h('div', { class: 'tk-c' }, p.user), h('div', { class: 'tk-c tk-c-num' }, pad2(Math.round(p.cpu))), h('div', { class: 'tk-c tk-c-num' }, Math.round(p.mem * 1024).toLocaleString('en-US') + ' K'), h('div', { class: 'tk-c' }, p.desc));
        row.addEventListener('pointerdown', function (e) { if (e.button === 0) setSel(key); });
        row.addEventListener('contextmenu', function (e) {
          e.preventDefault(); e.stopPropagation(); setSel(key);
          var s = selInfo(), pt = LAB.stage.toStage(e.clientX, e.clientY);
          LAB.menu.contextMenu(pt.x, pt.y, [
            { label: '結束工作', icon: 'x', action: function () { if (s) endInfo(s); } }, { label: '結束處理程序樹', action: function () { if (s) endInfo(s); } },
            { separator: true }, { label: '設定優先順序', submenu: [{ label: '一般', checked: true }, { label: '高於一般', action: noToast }, { label: '低於一般', action: noToast }] },
            { label: '開啟檔案位置', action: noToast }, { label: '內容', action: noToast }], { dark: document.documentElement.getAttribute('data-app-mode') === 'dark' });
        });
        rows.appendChild(row);
      });
      return [cols, rows];
    }

    /* ---- small static tables (使用者, 服務, 啟動, 歷程記錄) ---- */
    function plainTable(headers, rowsData, tplCols) {
      var cols = h('div', { class: 'tk-cols tk-grid', style: { gridTemplateColumns: tplCols } }, headers.map(function (t) { return h('div', { class: 'tk-th2' }, t); }));
      var rows = h('div', { class: 'tk-rows' });
      rowsData.forEach(function (r) {
        var row = h('div', { class: 'tk-row tk-grid', style: { gridTemplateColumns: tplCols } }, r.map(function (c) { return h('div', { class: 'tk-c' }, String(c)); }));
        rows.appendChild(row);
      });
      return [cols, rows];
    }

    /* ---- 效能 ---- */
    var PERF = {
      cpu: { name: 'CPU', sub: function () { return tmPct(series.cpu[59]) + '　' + (1.1 + series.cpu[59] / 100 * 2.6).toFixed(2) + ' GHz'; }, big: 'CPU', model: sys.info.CPU, label: '60 秒期間的使用率 %', max: 100, key: 'cpu' },
      mem: { name: '記憶體', sub: function () { return (series.mem[59] / 100 * 16).toFixed(1) + '/16.0 GB (' + Math.round(series.mem[59]) + '%)'; }, big: '記憶體', model: '16.0 GB', label: '記憶體使用量', max: 100, key: 'mem' },
      disk: { name: '磁碟 0 (C:)', sub: function () { return 'SSD (NVMe)　' + Math.round(series.disk[59]) + '%'; }, big: '磁碟 0 (C:)', model: 'NVMe 512GB SSD', label: '使用中時間', max: 100, key: 'disk' },
      net: { name: 'Wi-Fi', sub: function () { return sys.info.WIFI + '　傳送: ' + (series.net[59] / 10).toFixed(1) + '　接收: ' + (series.net[59]).toFixed(1) + ' Kbps'; }, big: 'Wi-Fi', model: sys.info.ADAPTER, label: '輸送量', max: 100, key: 'net' }
    };
    var perfEls = null;
    function stat(label, value, cls) { return h('div', { class: 'tk-stat ' + (cls || '') }, h('div', { class: 'tk-stat-l' }, label), h('div', { class: 'tk-stat-v' }, value)); }
    function perfStats(kind, perf) {
      var up = Math.floor((LAB.clock.ms() - boot) / 1000);
      var d = Math.floor(up / 86400), hh = Math.floor(up % 86400 / 3600), mm = Math.floor(up % 3600 / 60), ss = up % 60;
      if (kind === 'cpu') return [
        [['使用率', Math.round(series.cpu[59]) + '%'], ['速度', (1.1 + series.cpu[59] / 100 * 2.6).toFixed(2) + ' GHz'], ['處理程序', String(perf.procs)], ['執行緒', perf.threads.toLocaleString('en-US')], ['控制代碼', '61,842'], ['運作時間', d + ':' + pad2(hh) + ':' + pad2(mm) + ':' + pad2(ss)]],
        [['基本速度', '1.30 GHz'], ['插槽', '1'], ['核心', String(sys.info.CORES)], ['邏輯處理器', String(sys.info.THREADS)], ['虛擬化', '已啟用'], ['L1 快取', '1.1 MB'], ['L2 快取', '14.0 MB'], ['L3 快取', '12.0 MB']]];
      if (kind === 'mem') {
        var used = series.mem[59] / 100 * 16;
        return [[['使用中 (已壓縮)', used.toFixed(1) + ' GB (0.4 GB)'], ['可用', (16 - used - 0.4).toFixed(1) + ' GB'], ['已認可', (used + 2.6).toFixed(1) + '/21.1 GB'], ['快取', (2.4).toFixed(1) + ' GB'], ['分頁集區', '0.5 GB'], ['非分頁集區', '0.4 GB']],
          [['速度', '7467 MT/s'], ['已使用的插槽', '2/2'], ['外形規格', 'Row of chips'], ['硬體保留', '0.5 GB']]];
      }
      if (kind === 'disk') return [[['使用中時間', Math.round(series.disk[59]) + '%'], ['平均回應時間', '0.4 毫秒'], ['讀取速度', '0 KB/秒'], ['寫入速度', '24 KB/秒']],
        [['容量', sys.info.DISK_TOTAL_GB + ' GB'], ['可用', sys.info.DISK_FREE_GB + ' GB'], ['系統磁碟', '是'], ['分頁檔案', '是'], ['類型', 'SSD (NVMe)']]];
      return [[['傳送', (series.net[59] / 10).toFixed(1) + ' Kbps'], ['接收', series.net[59].toFixed(1) + ' Kbps']],
        [['介面卡名稱', 'Wi-Fi'], ['SSID', sys.info.WIFI], ['連線類型', '802.11ax'], ['IPv4 位址', sys.info.IP], ['IPv6 位址', 'fe80::7c2a:4f3e:91b5:1d60%12']]];
    }
    function renderPerf() {
      var left = h('div', { class: 'tk-pleft' });
      var items = {};
      Object.keys(PERF).forEach(function (k) {
        var P = PERF[k];
        var svg = '<svg viewBox="0 0 84 44" preserveAspectRatio="none" aria-hidden="true"><path class="tk-mini-area" d=""/><path class="tk-mini-line" d=""/></svg>';
        var b = h('button', { type: 'button', class: 'tk-pitem' + (perfSel === k ? ' is-on' : ''), dataset: { lab: 'tk-perf-item', kind: k } }, h('span', { class: 'tk-mini' }), h('span', { class: 'tk-ptxt' }, h('span', { class: 'tk-pname' }, P.name), h('span', { class: 'tk-psub' }, P.sub())));
        b.firstChild.innerHTML = svg;
        b.addEventListener('click', function () { perfSel = k; renderPage(true); });
        items[k] = b; left.appendChild(b);
      });
      var P2 = PERF[perfSel];
      var ph = h('div', { class: 'tk-phead' }, h('div', { class: 'tk-pbig' }, P2.big), h('div', { class: 'tk-pmodel' }, P2.model));
      var graph = h('div', { class: 'tk-graph', dataset: { lab: 'tk-graph' } });
      graph.innerHTML = '<svg viewBox="0 0 600 240" preserveAspectRatio="none" aria-hidden="true"><g class="tk-grid-lines"></g><path class="tk-area" d=""/><path class="tk-line" d=""/></svg>';
      var g = graph.querySelector('.tk-grid-lines'), lines = '';
      for (var i = 1; i < 10; i++) lines += '<path d="M0 ' + (i * 24) + 'H600"/>';
      for (var j = 1; j < 10; j++) lines += '<path d="M' + (j * 60) + ' 0V240"/>';
      g.innerHTML = lines;
      var glab = h('div', { class: 'tk-glab' }, h('span', null, P2.label), h('span', null, '100%'));
      var gbot = h('div', { class: 'tk-glab is-bot' }, h('span', null, '60 秒'), h('span', null, '0'));
      var stats = h('div', { class: 'tk-stats', dataset: { lab: 'tk-stats' } });
      var right = h('div', { class: 'tk-pright' }, ph, glab, graph, gbot, stats);
      perfEls = { items: items, graph: graph, stats: stats };
      paintPerf();
      return [h('div', { class: 'tk-perf' }, left, right)];
    }
    function paintPerf() {
      if (!perfEls) return;
      var perf = sys.perf();
      Object.keys(PERF).forEach(function (k) {
        var it = perfEls.items[k];
        if (!it || !it.isConnected) return;
        var P = PERF[k], arr = series[P.key];
        it.querySelector('.tk-mini-line').setAttribute('d', tmSvgPath(arr, 84, 44, 100));
        it.querySelector('.tk-mini-area').setAttribute('d', tmSvgPath(arr, 84, 44, 100) + 'L84 44L0 44Z');
        it.querySelector('.tk-psub').textContent = P.sub();
      });
      var arr = series[PERF[perfSel].key];
      perfEls.graph.querySelector('.tk-line').setAttribute('d', tmSvgPath(arr, 600, 240, 100));
      perfEls.graph.querySelector('.tk-area').setAttribute('d', tmSvgPath(arr, 600, 240, 100) + 'L600 240L0 240Z');
      var st2 = perfStats(perfSel, perf);
      perfEls.stats.textContent = '';
      st2.forEach(function (col, ci) {
        var c = h('div', { class: 'tk-stcol' + (ci === 1 ? ' is-list' : '') });
        col.forEach(function (s) { c.appendChild(stat(s[0], s[1], '')); });
        perfEls.stats.appendChild(c);
      });
    }
    function perfStep() {
      var perf = sys.perf();
      series.cpu.push(clamp(perf.cpu + (rnd() - 0.5) * 5, 0.5, 100)); series.cpu.shift();
      series.mem.push(clamp(perf.memPct + (rnd() - 0.5) * 0.4, 5, 95)); series.mem.shift();
      series.disk.push(clamp(perf.disk + (rnd() < 0.1 ? rnd() * 12 : 0), 0, 100)); series.disk.shift();
      series.net.push(clamp(perf.netRecv + (rnd() - 0.4) * 6, 0, 100)); series.net.shift();
      paintPerf();
    }

    /* ---- page switching and the timer (runs only while the window is on screen and the page changes by itself) ---- */
    function renderPage(keepScroll) {
      var sc = body.querySelector('.tk-rows') ? body.querySelector('.tk-rows').scrollTop : 0;
      var t = TM_NAV.filter(function (n) { return n[0] === page; })[0];
      title.textContent = t ? t[1] : '工作管理員';
      body.textContent = '';
      body.classList.toggle('is-perf', page === 'performance');
      var nodes = [];
      searchIn.style.visibility = (page === 'processes' || page === 'details') ? '' : 'hidden';
      endBtn.style.display = (page === 'processes' || page === 'details') ? '' : 'none';
      effBtn.style.display = page === 'processes' ? '' : 'none';
      if (page === 'processes') nodes = renderProcesses();
      else if (page === 'details') nodes = renderDetails();
      else if (page === 'performance') nodes = renderPerf();
      else if (page === 'services') nodes = plainTable(['名稱', 'PID', '描述', '狀態', '群組'], TM_SERVICES.map(function (s) { return [s[0], s[1] || '', s[2], s[3], s[4]]; }), '180px 70px 1fr 90px 220px');
      else if (page === 'startup') nodes = plainTable(['名稱', '發行者', '狀態', '啟動影響'], TM_STARTUP, '1fr 200px 120px 120px');
      else if (page === 'users') {
        var pf = sys.perf();
        nodes = plainTable(['使用者', '狀態', 'CPU', '記憶體'], [['an (AN-LAPTOP\\an)', '', Math.round(pf.cpu) + '%', Math.round(pf.memGB * 1024 * 0.8) + ' MB']], '1fr 120px 100px 120px');
      } else nodes = plainTable(['名稱', 'CPU 時間', '網路', '計量付費網路', '非計量付費網路'], [['Microsoft Edge', '0:00:41', '0.6 MB', '0 MB', '0.6 MB'], ['Codex', '0:01:12', '0.1 MB', '0 MB', '0.1 MB'], ['相片', '0:00:07', '0 MB', '0 MB', '0 MB'], ['設定', '0:00:05', '0 MB', '0 MB', '0 MB']], '1fr 120px 120px 150px 150px');
      nodes.forEach(function (n) { body.appendChild(n); });
      var rows = body.querySelector('.tk-rows');
      if (rows && keepScroll) rows.scrollTop = sc;
      Object.keys(navBtns).forEach(function (k) { navBtns[k].classList.toggle('is-on', k === page); navBtns[k].setAttribute('aria-current', k === page ? 'page' : 'false'); });
      paintSel();
      syncTimer();
    }
    function go(p) {
      if (p !== 'processes' && p !== 'details') { /* selection belongs to the tables */ }
      page = p;
      renderPage(false);
      LAB.bus.emit('taskmgr:page', { page: p });
    }
    function wantsTimer() { return !win.closed && !win.isMinimized() && (page === 'processes' || page === 'details' || page === 'performance'); }
    function tick() {
      if (!wantsTimer() || document.hidden) return;
      ticks++;
      if (page === 'performance') perfStep();
      else if (ticks % 2 === 0) renderPage(true);
    }
    function syncTimer() {
      if (wantsTimer()) { if (!timer) timer = setInterval(tick, 1000); }
      else if (timer) { clearInterval(timer); timer = null; }
    }
    win.own(function () { if (timer) { clearInterval(timer); timer = null; } });
    onWin(win, 'win:minimize', function (d) { if (d.id === win.id) syncTimer(); });
    onWin(win, 'win:restore', function (d) { if (d.id === win.id) syncTimer(); });
    // Delete ends the selected task; the arrows walk the table
    root.addEventListener('keydown', function (e) {
      if (e.target.tagName === 'INPUT') return;
      if (e.key === 'Delete' && sel && (page === 'processes' || page === 'details')) { e.preventDefault(); endSelected(); }
      else if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && (page === 'processes' || page === 'details')) {
        var rows = [].slice.call(body.querySelectorAll('.tk-item'));
        if (!rows.length) return;
        var i = rows.findIndex(function (r) { return r.dataset.key === sel; });
        i = clamp(i + (e.key === 'ArrowDown' ? 1 : -1), 0, rows.length - 1);
        setSel(rows[i].dataset.key); rows[i].scrollIntoView({ block: 'nearest' });
        e.preventDefault();
      }
    });
    root.tabIndex = 0;
    renderPage(false);
    return win;
  }
  var tmCtl = null;
  LAB.apps.register('taskmgr', {
    title: '工作管理員', en: 'Task Manager', aliases: ['taskmgr', 'task manager', 'taskmgr.exe', '工作管理員'], icon: 'app-taskmgr', dock: false,
    open: function (args) {
      if (tmCtl && tmCtl.win && !tmCtl.win.closed) { if (args && args.page) tmCtl.go(args.page); tmCtl.win.focus(); return tmCtl.win; }
      return openTaskMgr(args || {});
    },
    canHandle: function () { return false; }
  });

  /* ===================================================================== Microsoft Edge (app id: edge) — offline page, example.com, fake PDF pages */
  var EDGE_PDF = {
    'syllabus.pdf': { title: '學習分析工具　課程大綱', sub: '國立臺灣師範大學　2026 年秋季班',
      pages: [[['h', '課程簡介'], ['p', '這門課帶大家用電腦把學習留下來的資料整理起來、看出意思。不需要寫程式的背景，從資料夾、終端機一路練到請 Codex 幫忙整理報告。'], ['h', '每週進度'],
        ['li', 'Week 1　什麼是學習分析'], ['li', 'Week 2　資料長什麼樣子：欄位、列、缺漏值'], ['li', 'Week 3　終端機入門：ls、cd、mv、tar'], ['li', 'Week 4　把成績表整理乾淨'], ['li', 'Week 5　請 Codex 幫忙畫圖']],
        [['h', '評分方式'], ['li', '課堂練習　40%'], ['li', '期中作業　30%'], ['li', '期末小專題　30%'], ['h', '注意事項'], ['p', '課堂使用的資料都是假資料。作業請存在自己的資料夾，並依課堂說明命名。']]] },
    'resume.pdf': { title: '個人履歷（範例）', sub: 'an',
      pages: [[['h', '基本資料'], ['p', '姓名：an　　聯絡信箱：an@example.com'], ['h', '學歷'], ['li', '國立臺灣師範大學　學習分析課程　修課中'], ['h', '技能'], ['li', '資料整理（Excel、CSV）'], ['li', '終端機基本操作']]] },
    '*': { title: null, sub: '練習版的 PDF 閱讀器',
      pages: [[['p', '這是練習用的電腦裡的示範頁面，內容是假的。'], ['p', '真的 PDF 閱讀器會在這裡顯示檔案的文字和圖片；練習版只畫出標題和幾行字，讓您知道檔案「開起來了」。']]] }
  };

  function edgeParse(input) {
    var raw = String(input || '').trim();
    if (!raw) return { kind: 'newtab', url: '', host: '' };
    var url = raw;
    if (/^file:\/\//i.test(raw)) {
      var fp = LAB.win && LAB.win.fromWin ? LAB.win.fromWin(raw.replace(/^file:\/\/\/?/i, '').replace(/\//g, '\\'), HOME) : null;
      if (fp && /\.pdf$/i.test(fp)) return { kind: 'pdf', url: 'file:///' + winPath(fp).replace(/\\/g, '/'), host: '', path: fp };
      return { kind: 'offline', url: raw, host: '' };
    }
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) {
      if (/^[^\s\/]+\.[a-z]{2,}(\/\S*)?$/i.test(raw) || /^localhost(:\d+)?(\/\S*)?$/i.test(raw)) url = 'https://' + raw;
      else return { kind: 'offline', url: 'https://www.bing.com/search?q=' + encodeURIComponent(raw), host: 'www.bing.com' };
    }
    var m = /^[a-z][a-z0-9+.-]*:\/\/([^\/?#:]+)/i.exec(url);
    var host = m ? m[1].toLowerCase() : '';
    var bare = host.replace(/^www\./, '');
    if (/^(example\.com|example\.org|example\.net)$/.test(bare)) return { kind: 'example', url: url.replace(/^http:/i, 'https:') + (/^[a-z]+:\/\/[^\/]+$/i.test(url) ? '/' : ''), host: host };
    return { kind: 'offline', url: url + (/^[a-z]+:\/\/[^\/]+$/i.test(url) ? '/' : ''), host: host };
  }
  function edgeFav(kind) { return kind === 'pdf' ? 'pdf' : kind === 'example' ? 'globe' : kind === 'offline' ? 'offline-art' : 'app-edge'; }

  var edgeCtl = null;      // {win, open(args)}
  function openEdge(args) {
    args = args || {};
    if (edgeCtl && edgeCtl.win && !edgeCtl.win.closed) { edgeCtl.open(args); edgeCtl.win.focus(); return edgeCtl.win; }

    var tabs = [], activeId = null, seq = 0;
    var tabStrip = h('div', { class: 'ed-tabstrip', dataset: { lab: 'ed-tabs' } });
    var newBtn = h('button', { type: 'button', class: 'ed-newtab', 'aria-label': '新索引標籤', dataset: { lab: 'ed-new-tab' } }, iconBox('plus', 14));
    var strip = h('div', { class: 'ed-strip' }, tabStrip, newBtn);
    var back = h('button', { type: 'button', class: 'ed-btn', 'aria-label': '返回', disabled: true, dataset: { lab: 'ed-back' } }, iconBox('fl-back', 16));
    var fwd = h('button', { type: 'button', class: 'ed-btn', 'aria-label': '往前', disabled: true, dataset: { lab: 'ed-forward' } }, iconBox('fl-forward', 16));
    var reload = h('button', { type: 'button', class: 'ed-btn', 'aria-label': '重新整理', dataset: { lab: 'ed-reload' } }, iconBox('fl-refresh', 16));
    var homeBtn = h('button', { type: 'button', class: 'ed-btn', 'aria-label': '首頁', dataset: { lab: 'ed-home' } }, iconBox('house', 16));
    var lockIco = iconBox('lock', 14, 'ed-lock');
    var addr = h('input', { type: 'text', class: 'ed-addr', 'aria-label': '網址列', spellcheck: 'false', autocomplete: 'off', dataset: { lab: 'ed-address' } });
    var starBtn = h('button', { type: 'button', class: 'ed-btn is-sm', 'aria-label': '將此頁面加入我的最愛', tabindex: '-1' }, iconBox('star', 15));
    var addrBox = h('div', { class: 'ed-addrbox' }, lockIco, addr, starBtn);
    var avatar = h('button', { type: 'button', class: 'ed-btn ed-profile', 'aria-label': 'an（個人）', tabindex: '-1' }, h('span', { class: 'ed-avatar' }, 'an'));
    var more = h('button', { type: 'button', class: 'ed-btn', 'aria-label': '設定及其他', dataset: { lab: 'ed-menu' } }, iconBox('edge-more', 16));
    var toolbar = h('div', { class: 'ed-toolbar' }, back, fwd, reload, homeBtn, addrBox, avatar, more);
    var view = h('div', { class: 'ed-view', dataset: { lab: 'ed-view' } });
    var root = h('div', { class: 'sx sx-edge', dataset: { lab: 'edge' } }, toolbar, view);

    var win = LAB.wm.open({ appId: 'edge', title: 'Microsoft Edge', width: 1000, height: 640, minW: 520, minH: 360, theme: 'light', titlebar: 'custom', titlebarHeight: 40, singleton: 'edge',
      icon: 'app-edge', content: root, titlebarContent: strip });
    win.el.classList.add('sx-win');
    edgeCtl = { win: win, open: handleArgs };
    win.on('close', function () { if (edgeCtl && edgeCtl.win === win) edgeCtl = null; });

    function cur() { for (var i = 0; i < tabs.length; i++) if (tabs[i].id === activeId) return tabs[i]; return null; }
    function newTab(input) {
      var t = { id: ++seq, hist: [], idx: -1, page: null };
      tabs.push(t);
      activeId = t.id;
      navigate(t, input || '', true);
      return t;
    }
    function navigate(t, input, push) {
      var p = typeof input === 'string' ? edgeParse(input) : input;
      if (push !== false) { t.hist = t.hist.slice(0, t.idx + 1); t.hist.push(p); t.idx = t.hist.length - 1; }
      t.page = p;
      if (t.id === activeId) show(); else paintTabs();
      LAB.bus.emit('edge:navigate', { kind: p.kind, url: p.url, host: p.host || '' });
    }
    function titleOf(p) {
      if (p.kind === 'newtab') return '新索引標籤';
      if (p.kind === 'example') return 'Example Domain';
      if (p.kind === 'pdf') return LAB.vfs.basename(p.path);
      return p.host || '沒有網際網路';
    }
    function paintTabs() {
      tabStrip.textContent = '';
      tabs.forEach(function (t) {
        var p = t.page || { kind: 'newtab' };
        var x = h('button', { type: 'button', class: 'ed-tab-x', 'aria-label': '關閉索引標籤', tabindex: '-1', dataset: { lab: 'ed-tab-close' } }, iconBox('x', 10));
        var tab = h('div', { class: 'ed-tab' + (t.id === activeId ? ' is-on' : ''), role: 'tab', 'aria-selected': t.id === activeId ? 'true' : 'false', 'data-nodrag': '1', dataset: { lab: 'ed-tab', tab: t.id, kind: p.kind } },
          iconBox(edgeFav(p.kind), 14, 'ed-fav'), h('span', { class: 'ed-tab-t' }, titleOf(p)), x);
        tab.addEventListener('pointerdown', function (e) { if (!e.target.closest('.ed-tab-x') && t.id !== activeId) { activeId = t.id; show(); } });
        x.addEventListener('click', function (e) { e.stopPropagation(); closeTab(t.id); });
        tabStrip.appendChild(tab);
      });
      tabStrip.classList.toggle('is-many', tabs.length > 4);
    }
    function closeTab(id) {
      if (tabs.length <= 1) { win.close(); return; }
      var i = tabs.findIndex(function (t) { return t.id === id; });
      tabs.splice(i, 1);
      if (activeId === id) activeId = tabs[Math.min(i, tabs.length - 1)].id;
      show();
    }
    function show() {
      var t = cur();
      if (!t) return;
      var p = t.page;
      paintTabs();
      addr.value = p.kind === 'newtab' ? '' : (p.kind === 'pdf' ? p.url : p.url);
      addr.placeholder = '搜尋或輸入網址';
      lockIco.style.display = p.kind === 'example' ? '' : 'none';
      lockIco.parentNode.classList.toggle('is-insecure', false);
      back.disabled = t.idx <= 0; fwd.disabled = t.idx >= t.hist.length - 1;
      win.setTitle(titleOf(p) + ' - Microsoft Edge');
      view.textContent = '';
      view.className = 'ed-view is-' + p.kind;
      view.dataset.kind = p.kind;
      if (p.kind === 'newtab') view.appendChild(pageNewTab());
      else if (p.kind === 'example') view.appendChild(pageExample());
      else if (p.kind === 'pdf') view.appendChild(pagePdf(p.path));
      else view.appendChild(pageOffline(p));
      view.scrollTop = 0;
    }

    /* ---- pages ---- */
    function pageNewTab() {
      var q = h('input', { type: 'text', class: 'ed-nt-in', placeholder: '搜尋或輸入網址', 'aria-label': '搜尋或輸入網址', spellcheck: 'false', dataset: { lab: 'ed-newtab-input' } });
      q.addEventListener('keydown', function (e) { e.stopPropagation(); if (LAB.ui.isImeEnter(e)) return; if (e.key === 'Enter' && q.value.trim()) navigate(cur(), q.value); });
      var ex = h('button', { type: 'button', class: 'ed-nt-link' }, 'example.com');
      ex.addEventListener('click', function () { navigate(cur(), 'https://example.com/'); });
      return h('div', { class: 'ed-nt' },
        h('div', { class: 'ed-nt-box' }, iconBox('search', 18, 'ed-nt-ico'), q),
        h('div', { class: 'ed-nt-note' }, '這是練習用的瀏覽器，不能真的上網。可以試試：', ex));
    }
    function pageOffline(p) {
      var again = h('button', { type: 'button', class: 'ed-offline-btn', dataset: { lab: 'ed-retry' } }, '重新整理');
      again.addEventListener('click', function () { navigate(cur(), cur().page, false); });
      var ex = h('a', { class: 'ed-offline-link', href: '#', dataset: { lab: 'ed-goto-example' } }, 'example.com');
      ex.addEventListener('click', function (e) { e.preventDefault(); navigate(cur(), 'https://example.com/'); });
      return h('div', { class: 'ed-offline', dataset: { lab: 'ed-offline' } },
        h('div', { class: 'ed-offline-in' },
          iconBox('offline-art', 72, 'ed-offline-art'),
          h('h1', null, '沒有網際網路'),
          h('p', { class: 'ed-offline-lead' }, '請試試以下做法：'),
          h('ul', null, h('li', null, '檢查網路纜線、數據機和路由器'), h('li', null, '重新連線到 Wi-Fi 網路')),
          h('p', { class: 'ed-offline-code' }, 'ERR_INTERNET_DISCONNECTED'),
          h('div', { class: 'ed-offline-note', dataset: { lab: 'ed-offline-note' } },
            h('p', null, '這是練習用的電腦，不能真的上網，所以' + (p.host ? '「' + p.host + '」' : '這個網址') + '打不開。'),
            h('p', null, '想看看網頁長什麼樣子，可以打開 ', ex, '。')),
          h('div', { class: 'ed-offline-foot' }, again)));
    }
    function pageExample() {
      var more = h('a', { href: '#', class: 'ex-link', dataset: { lab: 'ed-example-more' } }, 'More information...');
      more.addEventListener('click', function (e) { e.preventDefault(); navigate(cur(), 'https://www.iana.org/domains/example'); });
      return h('div', { class: 'ex-body', dataset: { lab: 'ed-example' } },
        h('div', { class: 'ex-box' }, h('h1', null, 'Example Domain'),
          h('p', null, 'This domain is for use in illustrative examples in documents. You may use this domain in literature without prior coordination or asking for permission.'),
          h('p', null, more)));
    }
    function pagePdf(path) {
      var nm = LAB.vfs.basename(path), def = EDGE_PDF[nm.toLowerCase()] || EDGE_PDF['*'];
      var title = def.title || nm.replace(/\.pdf$/i, '');
      var zoom = 100, pageNo = 1;
      var pagesBox = h('div', { class: 'pdf-pages', dataset: { lab: 'pdf-pages' } });
      var pageEls = [];
      def.pages.forEach(function (blocks, i) {
        var kids = [];
        if (i === 0) { kids.push(h('div', { class: 'pdf-title' }, title)); if (def.sub) kids.push(h('div', { class: 'pdf-sub' }, def.sub)); }
        var ul = null;
        blocks.forEach(function (b) {
          if (b[0] === 'li') { if (!ul) { ul = h('ul', { class: 'pdf-ul' }); kids.push(ul); } ul.appendChild(h('li', null, b[1])); return; }
          ul = null;
          kids.push(h(b[0] === 'h' ? 'div' : 'p', { class: b[0] === 'h' ? 'pdf-h' : 'pdf-p' }, b[1]));
        });
        var pg = h('div', { class: 'pdf-page', dataset: { lab: 'pdf-page', n: i + 1 } }, kids, h('div', { class: 'pdf-num' }, String(i + 1)));
        pageEls.push(pg); pagesBox.appendChild(pg);
      });
      var zTxt = h('span', { class: 'pdf-z' }, '100%');
      function setZoom(z) { zoom = clamp(z, 50, 300); pagesBox.style.setProperty('--z', String(zoom / 100)); zTxt.textContent = zoom + '%'; }
      var pn = h('input', { type: 'text', class: 'pdf-pn', value: '1', 'aria-label': '頁碼' });
      pn.addEventListener('keydown', function (e) { e.stopPropagation(); if (e.key === 'Enter') { var n = clamp(parseInt(pn.value, 10) || 1, 1, def.pages.length); pageNo = n; pageEls[n - 1].scrollIntoView({ block: 'start' }); } });
      var tools = h('div', { class: 'pdf-tools' },
        h('span', { class: 'pdf-name' }, nm), h('span', { class: 'pdf-sp' }),
        pn, h('span', { class: 'pdf-of' }, '/ ' + def.pages.length), h('span', { class: 'pdf-sep' }),
        (function () { var b = h('button', { type: 'button', class: 'pdf-btn', 'aria-label': '縮小' }, iconBox('zoom-out', 16)); b.addEventListener('click', function () { setZoom(zoom - 25); }); return b; })(),
        zTxt,
        (function () { var b = h('button', { type: 'button', class: 'pdf-btn', 'aria-label': '放大' }, iconBox('zoom-in', 16)); b.addEventListener('click', function () { setZoom(zoom + 25); }); return b; })(),
        (function () { var b = h('button', { type: 'button', class: 'pdf-btn', 'aria-label': '符合頁面' }, iconBox('fit', 16)); b.addEventListener('click', function () { setZoom(100); }); return b; })());
      var scroller = h('div', { class: 'pdf-scroll' }, pagesBox);
      scroller.addEventListener('scroll', function () {
        var top = scroller.getBoundingClientRect().top, best = 1;
        pageEls.forEach(function (pg, i) { if (pg.getBoundingClientRect().top - top < scroller.clientHeight * 0.4) best = i + 1; });
        if (best !== pageNo) { pageNo = best; pn.value = String(best); }
      });
      return h('div', { class: 'pdf', dataset: { lab: 'edge-pdf', file: nm } }, tools, scroller);
    }

    /* ---- address bar and buttons ---- */
    addr.addEventListener('focus', function () { setTimeout(function () { addr.select(); }, 0); });
    addr.addEventListener('keydown', function (e) {
      e.stopPropagation();
      if (LAB.ui.isImeEnter(e)) return;
      if (e.key === 'Enter') { e.preventDefault(); var t = cur(); if (t) navigate(t, addr.value); addr.blur(); }
      else if (e.key === 'Escape') { var t2 = cur(); if (t2) addr.value = t2.page.kind === 'newtab' ? '' : t2.page.url; addr.blur(); }
    });
    back.addEventListener('click', function () { var t = cur(); if (t && t.idx > 0) { t.idx--; navigate(t, t.hist[t.idx], false); } });
    fwd.addEventListener('click', function () { var t = cur(); if (t && t.idx < t.hist.length - 1) { t.idx++; navigate(t, t.hist[t.idx], false); } });
    reload.addEventListener('click', function () { var t = cur(); if (t) navigate(t, t.page, false); });
    homeBtn.addEventListener('click', function () { var t = cur(); if (t) navigate(t, ''); });
    newBtn.addEventListener('click', function () { newTab(''); addr.focus(); });
    starBtn.addEventListener('click', function () { toast('練習版沒有「我的最愛」'); });
    avatar.addEventListener('click', function () { toast('練習版沒有個人設定檔'); });
    more.addEventListener('click', function () {
      var r = LAB.stage.rectOf(more), dark = document.documentElement.getAttribute('data-app-mode') === 'dark';
      LAB.menu.contextMenu(r.x + r.w - 260, r.y + r.h + 4, [
        { label: '新增索引標籤', shortcut: 'Ctrl+T', action: function () { newTab(''); } },
        { label: '新增視窗', shortcut: 'Ctrl+N', action: noToast }, { separator: true },
        { label: '我的最愛', action: noToast }, { label: '歷程記錄', action: noToast }, { label: '下載', action: noToast }, { separator: true },
        { label: '列印', action: noToast }, { label: '設定', action: noToast },
        { label: '關閉 Microsoft Edge', action: function () { win.close(); } }], { dark: dark });
    });

    function handleArgs(a) {
      a = a || {};
      var t = cur();
      var target = a.path || a.pdf ? 'file:///' + winPath(a.path || a.pdf).replace(/\\/g, '/') : a.url;
      if (!target) { if (!t) newTab(''); return; }
      if (t && t.page && t.page.kind === 'newtab' && t.hist.length <= 1) navigate(t, target); else newTab(target);
    }
    // shortcuts while Edge is the front window
    win.own(LAB.keys.on('mod+t', function () { newTab(''); addr.focus(); }, { scope: 'edge' }));
    win.own(LAB.keys.on('mod+l', function () { addr.focus(); }, { scope: 'edge' }));
    win.own(LAB.keys.on('mod+w', function () { if (tabs.length > 1) { closeTab(activeId); return true; } return false; }, { scope: 'edge' }));
    win.own(LAB.keys.on('alt+arrowleft', function () { back.click(); }, { scope: 'edge' }));
    win.own(LAB.keys.on('alt+arrowright', function () { fwd.click(); }, { scope: 'edge' }));

    if (!args.url && !args.path && !args.pdf) newTab(''); else { newTab(''); handleArgs(args); }
    return win;
  }
  LAB.apps.register('edge', {
    title: 'Microsoft Edge', en: 'Microsoft Edge', aliases: ['edge', 'microsoft edge', 'msedge', 'browser', '瀏覽器'], icon: 'app-edge', dock: false,
    open: function (args) { return openEdge(args); },
    canHandle: function (p) { var s = LAB.vfs.stat(p); return !!s && s.type !== 'dir' && /\.pdf$/i.test(s.name); },
    handleOpen: function (p) { openEdge({ path: p }); return true; },
    canOpen: function (st) { return st.type !== 'dir' && /\.pdf$/i.test(st.name) ? 30 : 0; }
  });
  sys.edge = { open: function (url) { return openApp('edge', { url: url }); }, parse: edgeParse };

  /* ===================================================================== 相片 (app id: photos) — a gallery of Pictures and a viewer for png / jpg */
  var phCtl = null;
  function photoFiles(dir) {
    var out = [];
    try {
      LAB.vfs.visible(LAB.vfs.list(dir)).forEach(function (s) { if (s.type === 'file' && isImagePath(s.path)) out.push(s); });
    } catch (e) { /* a folder that is gone */ }
    out.sort(function (a, b) { return b.mtime - a.mtime; });
    return out;
  }
  function openPhotos(args) {
    args = args || {};
    if (phCtl && phCtl.win && !phCtl.win.closed) { phCtl.open(args); phCtl.win.focus(); return phCtl.win; }
    var dir = HOME + '/Pictures', mode = 'gallery', path = null, zoom = 1, rot = 0, px = 0, py = 0, info = false, fromGallery = true;
    var root = h('div', { class: 'sx sx-photos', tabindex: '0', dataset: { lab: 'photos' } });
    var win = LAB.wm.open({ appId: 'photos', title: '相片', width: 940, height: 620, minW: 520, minH: 360, theme: 'light', icon: 'app-photos', content: root, singleton: 'photos' });
    win.el.classList.add('sx-win');
    phCtl = { win: win, open: handleArgs };
    win.on('close', function () { if (phCtl && phCtl.win === win) phCtl = null; });

    function list() { return photoFiles(dir); }
    function fmtDate(ms) {
      var d = new Date(ms);
      return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日';
    }
    function thumb(s, big) {
      var url = sys.imageUrl(s.path);
      var el = h('button', { type: 'button', class: 'ph-thumb', 'aria-label': s.name, dataset: { lab: 'ph-thumb', path: s.path } });
      if (url) el.appendChild(h('img', { src: url, alt: s.name, loading: 'lazy', draggable: 'false' }));
      else el.appendChild(h('span', { class: 'ph-noimg' }, iconBox('image', 40)));
      el.addEventListener('click', function () { showViewer(s.path, true); });
      return el;
    }
    function showGallery() {
      mode = 'gallery'; path = null;
      win.setTitle('相片');
      root.textContent = '';
      root.className = 'sx sx-photos is-gallery';
      var files = list();
      var head = h('div', { class: 'ph-ghead' }, h('div', { class: 'ph-gtitle' }, '圖庫'), h('div', { class: 'ph-gsub' }, files.length + ' 張相片　' + winPath(dir)));
      var body = h('div', { class: 'ph-gbody', dataset: { lab: 'ph-gallery' } });
      if (!files.length) body.appendChild(h('div', { class: 'ph-empty' }, '這個資料夾裡沒有相片。把 png 或 jpg 檔放進「圖片」資料夾，就會出現在這裡。'));
      var groups = [], byKey = {};
      files.forEach(function (s) {
        var d = new Date(s.mtime), k = d.getFullYear() + '-' + d.getMonth();
        if (!byKey[k]) { byKey[k] = { label: d.getFullYear() + '年' + (d.getMonth() + 1) + '月', items: [] }; groups.push(byKey[k]); }
        byKey[k].items.push(s);
      });
      groups.forEach(function (g) {
        body.appendChild(h('div', { class: 'ph-month' }, g.label));
        var grid = h('div', { class: 'ph-grid' });
        g.items.forEach(function (s) { grid.appendChild(thumb(s)); });
        body.appendChild(grid);
      });
      root.appendChild(head); root.appendChild(body);
    }
    function showViewer(p, gal) {
      if (!LAB.vfs.exists(p)) { toast('找不到這張相片'); showGallery(); return; }
      mode = 'viewer'; path = p; fromGallery = gal !== false && dir === LAB.vfs.dirname(p);
      zoom = 1; rot = 0; px = 0; py = 0;
      dir = LAB.vfs.dirname(p);
      renderViewer();
    }
    function renderViewer() {
      var files = list();
      var idx = files.findIndex(function (s) { return s.path === path; });
      var st1 = LAB.vfs.stat(path);
      var url = sys.imageUrl(path);
      win.setTitle(st1.name + ' - 相片');
      root.textContent = '';
      root.className = 'sx sx-photos is-viewer';
      var zTxt = h('span', { class: 'ph-ztxt', dataset: { lab: 'ph-zoom' } }, Math.round(zoom * 100) + '%');
      var img = url ? h('img', { class: 'ph-img', src: url, alt: st1.name, draggable: 'false', dataset: { lab: 'ph-image' } }) : null;
      var stageEl2 = h('div', { class: 'ph-stage', dataset: { lab: 'ph-stage' } });
      if (img) stageEl2.appendChild(img); else stageEl2.appendChild(h('div', { class: 'ph-noimg is-big' }, iconBox('image', 64), h('div', null, '練習版沒有這張相片的內容')));
      function apply() {
        if (img) img.style.transform = 'translate(' + px + 'px,' + py + 'px) rotate(' + rot + 'deg) scale(' + zoom + ')';
        zTxt.textContent = Math.round(zoom * 100) + '%';
      }
      function setZoom(z) { zoom = clamp(z, 0.25, 6); if (zoom <= 1) { px = 0; py = 0; } apply(); }
      function nav(d) {
        var f = list();
        if (f.length < 2) return;
        var i = f.findIndex(function (s) { return s.path === path; });
        showViewer(f[(i + d + f.length) % f.length].path, fromGallery);
      }
      function mk(icon, label, fn, hook) { var b = h('button', { type: 'button', class: 'ph-tbtn', 'aria-label': label, 'data-tip': label, dataset: { lab: hook || '' } }, iconBox(icon, 16)); b.addEventListener('click', fn); return b; }
      var backB = h('button', { type: 'button', class: 'ph-tbtn ph-back', 'aria-label': '返回圖庫', dataset: { lab: 'ph-back' } }, iconBox('back-arrow', 16));
      backB.addEventListener('click', showGallery);
      var infoBtn = mk('info', '資訊', function () { info = !info; renderViewer(); }, 'ph-info');
      var delBtn = mk('fl-delete', '刪除', function () {
        var f = list(), i = f.findIndex(function (s) { return s.path === path; });
        try { LAB.vfs.trash(path, { by: 'photos' }); } catch (e) { LAB.ui.vfsFail(win, e, '無法刪除這張相片', path); return; }
        var rest = list();
        if (rest.length) showViewer(rest[Math.min(i, rest.length - 1)].path, fromGallery); else showGallery();
        toast('已移到資源回收筒');
      }, 'ph-delete');
      var bar = h('div', { class: 'ph-bar' }, backB, h('span', { class: 'ph-fname' }, st1.name), h('span', { class: 'ph-sp' }),
        mk('zoom-out', '縮小', function () { setZoom(zoom / 1.25); }, 'ph-zoom-out'), zTxt, mk('zoom-in', '放大', function () { setZoom(zoom * 1.25); }, 'ph-zoom-in'),
        mk('fit', '符合視窗', function () { zoom = 1; px = 0; py = 0; apply(); }, 'ph-fit'), mk('rotate', '旋轉', function () { rot = (rot + 90) % 360; apply(); }, 'ph-rotate'), delBtn, infoBtn);
      var view = h('div', { class: 'ph-view' }, stageEl2);
      if (files.length > 1) {
        var pv = h('button', { type: 'button', class: 'ph-arrow is-prev', 'aria-label': '上一張', dataset: { lab: 'ph-prev' } }, iconBox('chev-left', 22));
        var nx = h('button', { type: 'button', class: 'ph-arrow is-next', 'aria-label': '下一張', dataset: { lab: 'ph-next' } }, iconBox('chev-right', 22));
        pv.addEventListener('click', function () { nav(-1); }); nx.addEventListener('click', function () { nav(1); });
        view.appendChild(pv); view.appendChild(nx);
      }
      if (img) {
        stageEl2.addEventListener('wheel', function (e) { e.preventDefault(); setZoom(zoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12)); }, { passive: false });
        stageEl2.addEventListener('dblclick', function () { if (zoom > 1.01) { zoom = 1; px = 0; py = 0; } else zoom = 2; apply(); });
        stageEl2.addEventListener('pointerdown', function (e) {
          if (zoom <= 1 || e.button !== 0) return;
          var sx = e.clientX, sy = e.clientY, ox = px, oy = py, pid = e.pointerId;
          stageEl2.classList.add('is-pan');
          function mv(ev) { if (ev.pointerId !== pid) return; px = ox + (ev.clientX - sx) / LAB.stage.scale; py = oy + (ev.clientY - sy) / LAB.stage.scale; apply(); }
          function up(ev) { if (ev.pointerId !== pid) return; window.removeEventListener('pointermove', mv, true); window.removeEventListener('pointerup', up, true); stageEl2.classList.remove('is-pan'); }
          window.addEventListener('pointermove', mv, true); window.addEventListener('pointerup', up, true);
        });
        img.addEventListener('load', function () { var d = root.querySelector('[data-lab=ph-dim]'); if (d) d.textContent = img.naturalWidth + ' × ' + img.naturalHeight; });
      }
      var wrap = h('div', { class: 'ph-row' }, view);
      if (info) {
        wrap.appendChild(h('div', { class: 'ph-info', dataset: { lab: 'ph-info-panel' } },
          h('div', { class: 'ph-info-h' }, '資訊'),
          h('div', { class: 'ph-kv' }, h('span', null, '檔案名稱'), h('b', null, st1.name)),
          h('div', { class: 'ph-kv' }, h('span', null, '日期'), h('b', null, fmtDate(st1.mtime))),
          h('div', { class: 'ph-kv' }, h('span', null, '大小'), h('b', null, (st1.size / 1024).toFixed(1) + ' KB')),
          h('div', { class: 'ph-kv' }, h('span', null, '尺寸'), h('b', { dataset: { lab: 'ph-dim' } }, img && img.naturalWidth ? img.naturalWidth + ' × ' + img.naturalHeight : '—')),
          h('div', { class: 'ph-kv' }, h('span', null, '位置'), h('b', null, winPath(st1.path)))));
      }
      root.appendChild(bar); root.appendChild(wrap);
      apply();
      root.focus({ preventScroll: true });
    }
    root.addEventListener('keydown', function (e) {
      if (mode !== 'viewer') return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); var b = root.querySelector('[data-lab=ph-prev]'); if (b) b.click(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); var b2 = root.querySelector('[data-lab=ph-next]'); if (b2) b2.click(); }
      else if (e.key === '+' || e.key === '=') { e.preventDefault(); root.querySelector('[data-lab=ph-zoom-in]').click(); }
      else if (e.key === '-') { e.preventDefault(); root.querySelector('[data-lab=ph-zoom-out]').click(); }
      else if (e.key === '0') { e.preventDefault(); root.querySelector('[data-lab=ph-fit]').click(); }
      else if (e.key === 'Escape') { e.preventDefault(); showGallery(); }
      else if (e.key === 'Delete') { e.preventDefault(); root.querySelector('[data-lab=ph-delete]').click(); }
    });
    var refreshT = null;
    onWin(win, 'fs:change', function () {
      clearTimeout(refreshT);
      refreshT = setTimeout(function () {
        if (win.closed) return;
        if (mode === 'gallery') showGallery();
        else if (!LAB.vfs.exists(path)) showGallery();
      }, 150);
    });
    win.own(function () { clearTimeout(refreshT); });
    function handleArgs(a) {
      a = a || {};
      if (a.path && LAB.vfs.exists(a.path)) showViewer(LAB.vfs.canon(a.path), true);
      else if (mode === 'viewer' && !a.path) { /* already open */ }
      else showGallery();
    }
    if (args.path && LAB.vfs.exists(args.path)) showViewer(LAB.vfs.canon(args.path), true); else showGallery();
    return win;
  }
  LAB.apps.register('photos', {
    title: '相片', en: 'Photos', aliases: ['photos', 'photo', '相片', '照片'], icon: 'app-photos', dock: false,
    open: function (args) { return openPhotos(args); },
    canHandle: function (p) { var s = LAB.vfs.stat(p); return !!s && s.type === 'file' && isImagePath(p); },
    handleOpen: function (p) { openPhotos({ path: p }); return true; },
    canOpen: function (st) { return st.type === 'file' && IMG_EXT[LAB.vfs.extname(st.name).toLowerCase()] ? 40 : 0; }
  });

  /* ===================================================================== boot: the first paint of the settings state */
  LAB.ready(function () {
    applyMode(); applyDisplay(); applyTrans();       // the wallpaper stays the CSS one (img/wallpaper.jpg) until the student changes it
  }, 36);
})(window.LAB);
