/* win.js — LAB.win: Windows paths and names (DESIGN W1). Loaded right after seed.js.
   The VFS stays Unix-pathed inside (/Users/an/Desktop/Project); Windows paths exist only at the edges, through this file.
   Everything that shows or reads a path uses LAB.win; events and missions keep internal paths. */
(function (LAB) {
  'use strict';

  var HOME = '/Users/an';
  var HOST = 'AN-LAPTOP', USER = 'an', LABEL = 'an 的筆電';

  function fold(s) { return String(s).normalize('NFC').toLowerCase(); }
  function isAbs(p) { return typeof p === 'string' && p.charAt(0) === '/'; }

  /* normalise an INTERNAL path without touching the VFS (the VFS may not be built yet when a title is drawn) */
  function norm(p, cwd) {
    if (LAB.vfs && LAB.vfs.normalize) return LAB.vfs.normalize(p, cwd);
    var s = String(p);
    if (s === '~' || s.indexOf('~/') === 0) s = HOME + s.slice(1);
    else if (s.charAt(0) !== '/') s = (cwd || '/') + '/' + s;
    var out = [];
    s.split('/').forEach(function (seg) {
      if (seg === '' || seg === '.') return;
      if (seg === '..') { out.pop(); return; }
      out.push(seg);
    });
    return '/' + out.join('/');
  }
  /* the stored spelling of each existing segment (display should show the real name); the typed spelling for the rest */
  function canon(p, cwd) {
    try { if (LAB.vfs && LAB.vfs.canon) return LAB.vfs.canon(p, cwd); } catch (e) { /* fall through */ }
    return norm(p, cwd);
  }

  /* ---------------------------------------------------------------- internal -> Windows */
  /* '/Users/an/Desktop/Project' -> 'C:\Users\an\Desktop\Project'; '/' -> 'C:\'; '~' is expanded.
     A virtual id ('::home', '::thispc', '::trash', 'recents:') is returned unchanged. */
  function toWin(p) {
    if (p === null || p === undefined) return '';
    var s = String(p);
    if (!(isAbs(s) || s === '~' || s.indexOf('~/') === 0)) return s;
    var c = canon(s);
    if (c === '/') return 'C:\\';
    return 'C:' + c.replace(/\//g, '\\');
  }

  /* ---------------------------------------------------------------- Windows -> internal */
  /* Environment words a PowerShell student may type for the home folder. */
  var HOME_WORDS = /^(?:\$env:USERPROFILE|\$env:HOMEPATH|\$HOME|%USERPROFILE%|%HOMEPATH%)(?=[\\\/]|$)/i;

  /* Names Explorer shows in Chinese. Only used when fromWin is called with {localized:true} (the Explorer address bar). */
  var LOCAL_TO_REAL = { '桌面': 'Desktop', '文件': 'Documents', '下載': 'Downloads', '音樂': 'Music', '圖片': 'Pictures', '影片': 'Videos',
    '我的最愛': 'Favorites', '連結': 'Links', '儲存的遊戲': 'Saved Games', '搜尋': 'Searches', '連絡人': 'Contacts' };

  /* A Windows-ish path a student typed -> the canonical internal path, or null when it is not a path we can map
     (another drive letter, a UNC share, a wildcard or other characters Windows never allows in a path).
     It does NOT check that the target exists: a non-existing tail keeps the typed spelling, like LAB.vfs.canon.
     cwd = the internal folder relative paths start from (default: home).
     Accepts C:\…  c:/…  \… (drive root)  ~  ~\…  ~/…  .\  ..\  .  ..  $HOME\…  %USERPROFILE%\…, forward or back slashes, mixed,
     a trailing slash, surrounding quotes, and is CASE-INSENSITIVE (matches the real child's spelling). */
  function fromWin(str, cwd, opts) {
    if (str === null || str === undefined) return null;
    opts = opts || {};
    var s = String(str).trim();
    if (s.length >= 2 && (s.charAt(0) === '"' || s.charAt(0) === "'") && s.charAt(s.length - 1) === s.charAt(0)) s = s.slice(1, -1).trim();
    if (!s) return null;
    s = s.replace(HOME_WORDS, '~');
    if (/[<>|?*\u0000"]/.test(s)) return null;
    var base = cwd ? norm(cwd) : HOME;
    var p = s.replace(/\\/g, '/');
    var abs;
    var m = /^([A-Za-z]):(.*)$/.exec(p);
    if (m) {
      if (m[1].toUpperCase() !== 'C') return null;            // the practice PC only has a C: drive
      var rest = m[2];
      abs = rest.charAt(0) === '/' ? rest : base + '/' + rest; // 'C:' and 'C:foo' are relative to the current folder (PowerShell)
    } else if (p.indexOf('//') === 0) {
      return null;                                            // \\server\share
    } else if (p.charAt(0) === '/') {
      abs = p;                                                // \Users\an : drive root
    } else if (p === '~' || p.indexOf('~/') === 0) {
      abs = HOME + p.slice(1);
    } else {
      abs = base + '/' + p;
    }
    if (abs.indexOf(':') >= 0) return null;                   // a colon anywhere else is not a legal name
    if (opts.localized) {                                     // Explorer address bar: '桌面' and 'C:\Users\an\桌面' work like the real one
      if (Object.prototype.hasOwnProperty.call(LOCAL_TO_REAL, p)) abs = HOME + '/' + LOCAL_TO_REAL[p];
      else {
        var segs = norm(abs).split('/').filter(function (x) { return x.length; });
        if (segs.length >= 3 && fold(segs[0]) === 'users' && fold(segs[1]) === USER && Object.prototype.hasOwnProperty.call(LOCAL_TO_REAL, segs[2])) {
          segs[2] = LOCAL_TO_REAL[segs[2]];
          abs = '/' + segs.join('/');
        }
      }
    }
    return canon(norm(abs));
  }

  /* ---------------------------------------------------------------- names shown by File Explorer */
  var DISPLAY = { 'desktop': '桌面', 'documents': '文件', 'downloads': '下載', 'music': '音樂', 'pictures': '圖片', 'videos': '影片',
    'favorites': '我的最愛', 'links': '連結', 'saved games': '儲存的遊戲', 'searches': '搜尋', 'contacts': '連絡人' };

  /* What File Explorer shows for a folder: the 12 standard folders of home get their zh-TW names (win-facts §9),
     '/Users' -> 使用者, '/Users/Public' -> 公用, '/' -> 本機磁碟 (C:), the trash -> 資源回收筒; anything else is its real name. */
  function displayName(p) {
    if (p === null || p === undefined) return '';
    var s = String(p);
    if (s === 'recents:') return '最近';
    if (s === '::home') return '首頁';
    if (s === '::thispc') return '本機';
    if (s === '::trash') return '資源回收筒';
    if (s === '::gallery') return '圖庫';
    if (s === '::network') return '網路';
    if (!(isAbs(s) || s === '~' || s.indexOf('~/') === 0)) return s;
    var n = norm(s);
    if (n === '/') return '本機磁碟 (C:)';
    var f = fold(n);
    if (f === '/users') return '使用者';
    if (f === '/users/public') return '公用';
    if (f === fold(HOME + '/.Trash')) return '資源回收筒';
    var segs = n.split('/');
    var name = segs[segs.length - 1];
    if (fold(n.slice(0, n.lastIndexOf('/'))) === fold(HOME) && Object.prototype.hasOwnProperty.call(DISPLAY, fold(name))) return DISPLAY[fold(name)];
    var c = canon(n);
    return c.slice(c.lastIndexOf('/') + 1);
  }

  /* 'C:\Users\an' etc. for the PowerShell prompt (always the full path) */
  function promptPath(cwd) { return toWin(cwd === undefined || cwd === null ? HOME : cwd); }

  /* ---------------------------------------------------------------- dates (win-facts §4.2, §7.1) */
  function two(n) { return (n < 10 ? '0' : '') + n; }
  /* ['2026/10/2', '上午 09:47'] : date yyyy/M/d (no zero padding), time tt hh:mm (12-hour, 上午 / 下午, hour 0 and 12 print 12) */
  function dateParts(ms) {
    var d = new Date(ms);
    var h = d.getHours();
    var h12 = h % 12 === 0 ? 12 : h % 12;
    return [d.getFullYear() + '/' + (d.getMonth() + 1) + '/' + d.getDate(), (h < 12 ? '上午' : '下午') + ' ' + two(h12) + ':' + two(d.getMinutes())];
  }
  /* '2026/10/2  上午 09:47' (TWO spaces between date and time, exactly as Get-ChildItem prints it; padding is the caller's job) */
  function fmtDate(ms) { var p = dateParts(ms); return p[0] + '  ' + p[1]; }
  /* ['上午 09:52', '2026/10/2'] for the two-line taskbar clock */
  function fmtClock(ms) { var p = dateParts(ms); return [p[1], p[0]]; }

  /* ---------------------------------------------------------------- Mode column of Get-ChildItem (extra, optional) */
  var READONLY_DIRS = { 'contacts': 1, 'desktop': 1, 'documents': 1, 'downloads': 1, 'favorites': 1, 'links': 1, 'music': 1, 'onedrive': 1,
    'pictures': 1, 'saved games': 1, 'searches': 1, 'videos': 1 };
  /* 'd-r---' for the 12 standard folders of home (win-facts §4.1), 'd-----' for other folders, '-a----' for files.
     Takes a stat object from LAB.vfs.stat/list or an internal path. */
  function mode(st) {
    if (typeof st === 'string') st = LAB.vfs.stat(st);
    if (!st) return '------';
    if (st.type !== 'dir') return '-a----';
    var p = st.path || '';
    var i = p.lastIndexOf('/');
    if (i > 0 && fold(p.slice(0, i)) === fold(HOME) && READONLY_DIRS[fold(p.slice(i + 1))]) return 'd-r---';
    return 'd-----';
  }

  LAB.win = {
    HOST: HOST, USER: USER, LABEL: LABEL, HOME: HOME,
    toWin: toWin,
    fromWin: fromWin,
    displayName: displayName,
    promptPath: promptPath,
    fmtDate: fmtDate,
    fmtClock: fmtClock,
    dateParts: dateParts,
    mode: mode
  };
})(window.LAB);
