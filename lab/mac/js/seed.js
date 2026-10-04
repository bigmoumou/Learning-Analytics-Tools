/* seed.js — the initial file system of 小安's Mac (DESIGN §4.0) and LAB.seed (restore API for missions, §3.5). */
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
    '看得到這個檔案，代表你已經用 cd、ls、mv、unzip 把包裹拆開了。\n';

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
    var appStub = function (m) { return { t: 'f', m: T(m), x: '', s: 0, k: 'app' }; };
    return D('2026-09-01 08:00', {
      'Applications': D('2026-09-01 08:00', {
        'Codex.app': appStub('2026-09-01 08:00'),
        'Code.app': appStub('2026-09-01 08:00'),
        '文字編輯.app': appStub('2026-09-01 08:00'),
        '終端機.app': appStub('2026-09-01 08:00')
      }),
      'Users': D('2026-09-01 08:00', {
        'an': D('2026-10-02 09:41', {
          'Desktop': D('2026-09-28 10:12', {
            'Project': D('2026-09-28 10:12', {
              'data': D('2026-09-28 09:58', {
                'A.csv': F('2026-09-28 09:58', csv('A')),
                'B.csv': F('2026-09-28 09:58', csv('B')),
                'C.csv': F('2026-09-28 09:58', csv('C'))
              }),
              'AGENTS.md': F('2026-09-28 10:12', AGENTS),
              '筆記.docx': BIN('2026-09-25 15:40', 18432)
            })
          }),
          'Documents': D('2026-09-21 16:05', {
            '期中報告.docx': BIN('2026-09-21 16:05', 24576),
            '履歷.pdf': BIN('2026-09-12 11:30', 120834)
          }),
          'Downloads': D('2026-10-02 09:30', {
            'syllabus.pdf': BIN('2026-09-15 08:30', 204311),
            'week3.zip': { t: 'f', m: T('2026-10-02 09:30'), b: 1, k: 'zip', s: 1301, z: zipEntries() }
          }),
          'Library': D('2026-09-01 08:00', {}),
          'Movies': D('2026-09-01 08:00', {}),
          'Music': D('2026-09-01 08:00', {}),
          'Pictures': D('2026-09-01 08:00', {}),
          'Public': D('2026-09-01 08:00', {}),
          '.Trash': D('2026-09-01 08:00', {}),
          '.zsh_sessions': D('2026-09-01 08:00', {}),
          '.CFUserTextEncoding': F('2026-09-01 08:00', '0x0:2:0')
        })
      })
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
