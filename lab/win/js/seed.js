/* seed.js — the initial file system of 小安's Windows PC (DESIGN W2, win-facts §4.1 / §9) and LAB.seed (restore API for missions, M§3.5).
   Unix-pathed inside: C:\Users\an is /Users/an. The dates are those of the 補充 2 video, so `ls ~` matches it. */
(function (LAB) {
  'use strict';

  function T(str) {            // 'YYYY-MM-DD HH:MM' (fixed local date of the fiction) -> ms
    var m = /^(\d{4})-(\d\d)-(\d\d) (\d\d):(\d\d)$/.exec(str);
    return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], 0, 0).getTime();
  }
  function D(m, c) { return { t: 'd', m: T(m), c: c || {} }; }
  function F(m, x) { return { t: 'f', m: T(m), x: x }; }
  function BIN(m, size) { return { t: 'f', m: T(m), b: 1, s: size }; }

  var README = '# Week 3 終端機小練習素材\n\n' +
    '這份壓縮檔是「終端機介紹」小練習用的，裡面的成績都是假資料。\n\n' +
    '- A.csv、B.csv、C.csv：A、B、C 三個班的小考成績，每班 40 位學生\n' +
    '- 欄位：student_id（假學號）、score（0 到 100 分）\n\n' +
    '看得到這個檔案，代表你已經用 cd、ls、mv、tar 把包裹拆開了。\n';

  var SCORES = {
    A: [61, 86, 64, 75, 76, 90, 74, 100, 76, 100, 84, 81, 52, 67, 80, 68, 62, 60, 83, 91, 85, 51, 78, 91, 51, 82, 75, 73, 92, 68, 70, 100, 87, 95, 73, 74, 78, 67, 80, 78],
    B: [87, 72, 64, 71, 76, 78, 66, 82, 76, 66, 80, 74, 74, 73, 76, 80, 90, 73, 56, 68, 84, 72, 80, 69, 70, 57, 64, 85, 74, 71, 75, 68, 73, 82, 70, 98, 57, 83, 80, 81],
    C: [100, 80, 86, 100, 82, 72, 65, 74, 60, 84, 79, 68, 60, 71, 71, 72, 66, 82, 92, 66, 71, 68, 82, 72, 72, 80, 60, 66, 69, 57, 71, 61, 75, 100, 91, 74, 96, 75, 87, 63]
  };
  function csv(letter) {
    var s = 'student_id,score\n';
    SCORES[letter].forEach(function (v, i) {
      var n = i + 1;
      s += letter + (n < 10 ? '00' : '0') + n + ',' + v + '\n';
    });
    return s;
  }

  var AGENTS = '# 專案規則\n- 報告用繁體中文\n- 輸出的檔案放在 output/\n';

  /* Round 5 (SYS-WIN): 3 fake photos in Pictures and a 課堂筆記 folder in Documents. They sit where no mission looks.
     The photos are drawn by code (製作/lab-round5/scratch/SYS-WIN/draw_assets.py) and live in img/photos/ (each under 100 KB); the VFS node is a
     plain binary file of the same size, and LAB.seed.imageUrl(path) maps a file name to the picture (Photos, Explorer thumbnails). */
  var PHOTO_URL = {
    'lake-view.jpg': 'img/photos/lake-view.jpg',
    'sunset-hills.jpg': 'img/photos/sunset-hills.jpg',
    'pine-forest.jpg': 'img/photos/pine-forest.jpg'
  };
  var PHOTO_SIZE = { 60884: 'img/photos/lake-view.jpg', 41276: 'img/photos/sunset-hills.jpg', 61596: 'img/photos/pine-forest.jpg' };   // a renamed copy is still known by its size
  var NOTES_1 = 'Week 1 課堂筆記\n\n' +
    '- 學習分析：把學習過程留下的資料整理起來，看出學生哪裡卡住\n' +
    '- 資料要先整理再分析：欄位名稱、缺漏值、重複的列\n' +
    '- 今天的作業：把成績表開起來，數一數有幾位學生\n';
  var NOTES_2 = 'Week 2 課堂筆記\n\n' +
    '- 平均數、中位數、最高分、最低分\n' +
    '- 看分布比看平均更重要：兩個班平均一樣，分數的散開程度可能差很多\n' +
    '- 下週：用終端機（PowerShell）一次處理好幾個檔案\n';

  function zipEntries() {
    var m = T('2026-10-02 09:00');
    return [
      { name: 'week3/', type: 'dir', content: '', mtime: m },
      { name: 'week3/README.md', type: 'file', content: README, mtime: m },
      { name: 'week3/A.csv', type: 'file', content: csv('A'), mtime: m },
      { name: 'week3/B.csv', type: 'file', content: csv('B'), mtime: m },
      { name: 'week3/C.csv', type: 'file', content: csv('C'), mtime: m }
    ];
  }

  function build() {
    // the 10 standard folders nobody touched: all created in the same minute when the account was made (win-facts §4.3)
    var stub = function () { return D('2026-09-07 11:42', {}); };
    return D('2026-09-01 08:00', {
      'Program Files': D('2026-09-01 08:00', {}),
      'Program Files (x86)': D('2026-09-01 08:00', {}),
      'Users': D('2026-09-07 11:42', {
        'an': D('2026-10-02 09:41', {
          'Contacts': stub(),
          'Desktop': D('2026-10-02 09:31', {                          // 小安 made Project at 09:31
            'Project': D('2026-10-02 09:31', {
              'data': D('2026-09-28 09:58', {
                'A.csv': F('2026-09-28 09:58', csv('A')),
                'B.csv': F('2026-09-28 09:58', csv('B')),
                'C.csv': F('2026-09-28 09:58', csv('C'))
              }),
              'AGENTS.md': F('2026-09-28 10:12', AGENTS),
              'notes.docx': BIN('2026-09-25 15:40', 18432)
            })
          }),
          'Documents': D('2026-09-07 11:42', {
            'midterm-report.docx': BIN('2026-09-21 16:05', 24576),
            'resume.pdf': BIN('2026-09-12 11:30', 120834),
            '課堂筆記': D('2026-09-23 17:10', {
              'week1-notes.txt': F('2026-09-16 17:10', NOTES_1),
              'week2-notes.txt': F('2026-09-23 17:10', NOTES_2)
            })
          }),
          'Downloads': D('2026-10-02 09:47', {                        // week3.zip finished downloading at 09:47
            'syllabus.pdf': BIN('2026-09-14 14:08', 218904),
            'week3.zip': { t: 'f', m: T('2026-10-02 09:47'), b: 1, k: 'zip', s: 1301, z: zipEntries() }
          }),
          'Favorites': stub(),
          'Links': stub(),
          'Music': stub(),
          'OneDrive': stub(),
          'Pictures': D('2026-09-07 11:42', {        // the folder keeps the shared 09-07 11:42 stamp (win-facts §4.3, `ls ~` byte for byte)
            'lake-view.jpg': BIN('2026-09-13 15:22', 60884),
            'pine-forest.jpg': BIN('2026-09-20 09:48', 61596),
            'sunset-hills.jpg': BIN('2026-09-27 18:05', 41276)
          }),
          'Saved Games': stub(),
          'Searches': stub(),
          'Videos': stub(),
          '.Trash': D('2026-09-07 11:42', {})                        // backs 資源回收筒; a dot-name, so `ls` does not list it
        }),
        'Public': D('2026-09-07 11:42', {})
      }),
      'Windows': D('2026-09-01 08:00', { 'System32': D('2026-09-01 08:00', {}) })
    });
  }

  function split(path) {
    return String(path).split('/').filter(function (s) { return s.length; });
  }
  function foldName(n) { return String(n).normalize('NFC').toLowerCase(); }

  /* case-insensitive walk through the compact JSON */
  function walkJson(root, path) {
    var cur = root;
    var parts = split(path);
    for (var i = 0; i < parts.length; i++) {
      if (!cur || cur.t !== 'd') return null;
      var want = foldName(parts[i]), next = null;
      var keys = Object.keys(cur.c);
      for (var j = 0; j < keys.length; j++) {
        if (foldName(keys[j]) === want) { next = cur.c[keys[j]]; break; }
      }
      if (!next) return null;
      cur = next;
    }
    return cur;
  }

  LAB.seed = {
    /* the picture behind a fake photo: file name or internal path (plus the byte size, when the caller has it) -> 'img/photos/xxx.jpg' relative to
       the page, or null. Name first (a moved copy keeps its name); then the size, which a renamed copy keeps ("lake-view - 複製.jpg"). A path that
       starts with / is looked up in the VFS for its size when no size is given. */
    imageUrl: function (pathOrName, size) {
      var s = String(pathOrName || '');
      var n = s.split(/[\\/]/).pop().toLowerCase();
      if (Object.prototype.hasOwnProperty.call(PHOTO_URL, n)) return PHOTO_URL[n];
      if (size === undefined && s.charAt(0) === '/' && LAB.vfs && LAB.vfs.stat) {
        var st = LAB.vfs.stat(s);
        if (st && st.type === 'file' && st.kind === 'binary') size = st.size;
      }
      return size !== undefined && Object.prototype.hasOwnProperty.call(PHOTO_SIZE, size) ? PHOTO_SIZE[size] : null;
    },
    tree: function () { return build(); },
    nodeAt: function (path) {
      return walkJson(build(), LAB.vfs ? LAB.vfs.normalize(path) : path);
    },
    /* put the seeded node at `path` back (missions' api.ensureSeed). Returns whether it wrote. */
    restore: function (path, opts) {
      opts = opts || {};
      var vfs = LAB.vfs;
      var p = vfs.normalize(path);
      var node = walkJson(build(), p);
      if (!node) return false;
      if (vfs.exists(p)) {
        if (!opts.overwrite) return false;
        try { vfs.remove(p, { by: 'system', recursive: true, force: true }); } catch (e) { return false; }
      }
      var parent = vfs.dirname(p);
      if (!vfs.exists(parent)) {
        try { vfs.mkdir(parent, { by: 'system', parents: true }); } catch (e2) { return false; }
      }
      try { vfs.putJson(p, node, { by: 'system' }); } catch (e3) { console.warn('[seed] restore failed', p, e3); return false; }
      return true;
    }
  };
})(window.LAB);
