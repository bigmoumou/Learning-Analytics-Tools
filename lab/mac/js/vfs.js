/* vfs.js [PORTABLE] — LAB.vfs: in-memory Unix-style tree for the fake Mac (DESIGN §3.5). */
(function (LAB) {
  'use strict';

  var HOME = '/Users/an';
  var MAX_FILE = 200 * 1024;
  var MAX_TOTAL = 1200 * 1024;
  var MAX_DEPTH = 40;
  var STD_FOLDERS = ['Desktop', 'Documents', 'Downloads', 'Library', 'Movies', 'Music', 'Pictures', 'Public'];

  var ERR_TEXT = {
    ENOENT: 'No such file or directory', EEXIST: 'File exists', ENOTDIR: 'Not a directory', EISDIR: 'Is a directory',
    ENOTEMPTY: 'Directory not empty', EINVAL: 'Invalid argument', EACCES: 'Permission denied',
    ENAMETOOLONG: 'File name too long', ENOSPC: 'No space left on device',
    EPROTECTED: 'Operation not permitted'
  };

  class VfsError extends Error {
    constructor(code, path) {
      super(code + ': ' + (path === undefined ? '' : path));
      this.name = 'VfsError';
      this.code = code;
      this.path = path;
    }
  }

  /* ------------------------------------------------------- pure helpers */
  function utf8len(str) {
    var n = 0;
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      if (c < 0x80) n += 1;
      else if (c < 0x800) n += 2;
      else if (c >= 0xD800 && c <= 0xDBFF && i + 1 < str.length) { n += 4; i++; }
      else n += 3;
    }
    return n;
  }
  function fold(name) { return String(name).normalize('NFC').toLowerCase(); }
  function isVirtual(p) { return /^[a-z][a-z0-9]*:$/i.test(String(p)); }
  /* a zip entry as stored on a node: {name, type, content, mtime}; a binary file inside an archive (a docx, a pdf) also
     carries `bin` = its size in bytes (content is then '') so a zip of a folder round-trips them (round 5) */
  function zcopy(z) {
    var e = { name: z.name, type: z.type, content: z.type === 'file' ? (z.content || '') : '', mtime: z.mtime };
    if (z.type === 'file' && isFinite(z.bin) && z.bin >= 0) e.bin = z.bin;
    return e;
  }

  function normalize(path, cwd) {
    path = String(path);
    if (path === '~' || path.indexOf('~/') === 0) path = HOME + path.slice(1);
    else if (path.charAt(0) !== '/') {
      cwd = cwd || '/';
      if (cwd === '~' || cwd.indexOf('~/') === 0) cwd = HOME + cwd.slice(1);
      path = cwd + '/' + path;
    }
    var out = [], parts = path.split('/');
    for (var i = 0; i < parts.length; i++) {
      var s = parts[i];
      if (s === '' || s === '.') continue;
      if (s === '..') { out.pop(); continue; }
      out.push(s);
    }
    return '/' + out.join('/');
  }
  function join() {
    var parts = [];
    for (var i = 0; i < arguments.length; i++) if (arguments[i] !== '' && arguments[i] !== undefined) parts.push(arguments[i]);
    return normalize(parts.join('/'));
  }
  function basename(p) { p = normalize(p); if (p === '/') return '/'; return p.slice(p.lastIndexOf('/') + 1); }
  function dirname(p) { p = normalize(p); if (p === '/') return '/'; var i = p.lastIndexOf('/'); return i <= 0 ? '/' : p.slice(0, i); }
  function extname(p) {
    var b = basename(p), i = b.lastIndexOf('.');
    return i > 0 ? b.slice(i) : '';
  }
  function isUnder(path, dir) {
    var p = fold(normalize(path)), d = fold(normalize(dir));
    if (d === '/') return true;
    return p === d || p.indexOf(d + '/') === 0;
  }
  function checkName(name) {
    if (typeof name !== 'string' || name === '' || name === '.' || name === '..' || name.indexOf('/') >= 0 || name.indexOf('\u0000') >= 0) throw new VfsError('EINVAL', name);
    if (utf8len(name) > 255) throw new VfsError('ENAMETOOLONG', name);
  }
  var DISPLAY = {};
  DISPLAY[HOME + '/Desktop'] = '桌面'; DISPLAY[HOME + '/Documents'] = '文件'; DISPLAY[HOME + '/Downloads'] = '下載項目';
  DISPLAY[HOME + '/Movies'] = '電影'; DISPLAY[HOME + '/Music'] = '音樂'; DISPLAY[HOME + '/Pictures'] = '圖片';
  DISPLAY[HOME + '/Public'] = '公共'; DISPLAY[HOME + '/Library'] = '資源庫'; DISPLAY[HOME + '/.Trash'] = '垃圾桶';
  DISPLAY['/Applications'] = '應用程式'; DISPLAY['/Users'] = '使用者'; DISPLAY['/'] = 'Macintosh HD'; DISPLAY[HOME] = 'an';
  function displayName(path) {
    if (isVirtual(path)) return path === 'recents:' ? '最近項目' : path;
    var p = normalize(path);
    if (Object.prototype.hasOwnProperty.call(DISPLAY, p)) return DISPLAY[p];
    return basename(p);
  }

  function errText(code) { return ERR_TEXT[code] || String(code); }

  /* ----------------------------------------------------- the factory */
  function create(json, opts) {
    opts = opts || {};
    var emitOn = !!opts.emit;
    var root = null;
    var inst = {};

    function emit(name, payload) { if (emitOn) LAB.bus.emit(name, payload); }
    function nowMs() { return LAB.clock ? LAB.clock.ms() : Date.now(); }
    /* folders macOS itself needs: Finder, the Desktop and the Terminal may not delete, rename or move them
       (only 'system' = the practice's own reset code may). Nothing may be created directly in / or /Users. */
    var PROTECTED = ['/', '/Users', '/Applications', HOME, HOME + '/.Trash'].concat(STD_FOLDERS.map(function (n) { return HOME + '/' + n; }));
    var NO_CREATE_IN = ['/', '/Users', '/Applications'];
    function isProtected(p) {
      var c;
      try { c = inst.canon(p); } catch (e) { return false; }
      for (var i = 0; i < PROTECTED.length; i++) if (PROTECTED[i] === c) return true;
      return false;
    }
    function guardSource(p, by) {
      if (by === 'system') return;
      if (isProtected(p)) throw new VfsError('EPROTECTED', p);
    }
    function guardCreate(p, by) {
      if (by === 'system') return;
      var c = inst.canon(p);
      if (c !== '/' && NO_CREATE_IN.indexOf(dirname(c)) >= 0) throw new VfsError('EACCES', p);
    }
    function mkDir(m) { return { type: 'dir', mtime: m, ctime: m, kids: new Map() }; }
    function mkFile(m, content) {
      return { type: 'file', mtime: m, ctime: m, size: utf8len(content), content: content };
    }
    function R() {
      if (!root) { if (json !== undefined && json !== null) inst.load(json); else inst.seed(); }
      return root;
    }

    /* walk by (folded) segments; returns {node,parent,name} or null */
    function lookup(path) {
      var p = normalize(path);
      var cur = R();
      if (p === '/') return { node: cur, parent: null, name: '', path: '/' };
      var segs = p.split('/'), parent = null, name = '', i, canonParts = [];
      for (i = 1; i < segs.length; i++) {
        if (cur.type !== 'dir') return null;
        var ent = cur.kids.get(fold(segs[i]));
        if (!ent) return null;
        parent = cur; name = ent.name; cur = ent.node; canonParts.push(ent.name);
      }
      return { node: cur, parent: parent, name: name, path: '/' + canonParts.join('/') };
    }
    function need(path) {
      var p = normalize(path);
      var l = lookup(p);
      if (l) return l;
      // distinguish ENOTDIR (a file in the middle) from ENOENT
      var segs = p.split('/'), cur = R();
      for (var i = 1; i < segs.length; i++) {
        if (cur.type !== 'dir') throw new VfsError('ENOTDIR', path);
        var ent = cur.kids.get(fold(segs[i]));
        if (!ent) throw new VfsError('ENOENT', path);
        cur = ent.node;
      }
      throw new VfsError('ENOENT', path);
    }
    function needDir(path) {
      var l = need(path);
      if (l.node.type !== 'dir') throw new VfsError('ENOTDIR', path);
      return l;
    }

    function totalText() {
      var total = 0;
      (function rec(n) {
        if (n.type === 'dir') n.kids.forEach(function (e) { rec(e.node); });
        else if (n.content) total += n.size;
      })(R());
      return total;
    }

    function addKid(parentNode, name, node) {
      parentNode.kids.set(fold(name), { name: name, node: node });
      parentNode.mtime = nowMs();
    }
    function delKid(parentNode, name) {
      parentNode.kids.delete(fold(name));
      parentNode.mtime = nowMs();
    }

    /* ----- queries ----- */
    function makeStat(canonPath, name, node) {
      var dot = name.charAt(0) === '.';
      var st = {
        path: canonPath, name: name, type: node.type, kind: 'text', size: 0,
        mtime: node.mtime, ctime: node.ctime, dot: dot, hidden: dot || canonPath === HOME + '/Library'
      };
      if (node.type === 'dir') { st.kind = 'folder'; st.size = 0; st.count = node.kids.size; }
      else {
        st.size = node.size;
        st.kind = node.kind === 'zip' ? 'zip' : node.kind === 'app' ? 'app' : node.binary ? 'binary' : 'text';
      }
      return st;
    }
    inst.exists = function (p) { if (isVirtual(p)) return false; return !!lookup(p); };
    inst.isDir = function (p) { var l = isVirtual(p) ? null : lookup(p); return !!l && l.node.type === 'dir'; };
    inst.isFile = function (p) { var l = isVirtual(p) ? null : lookup(p); return !!l && l.node.type === 'file'; };
    inst.stat = function (p) {
      if (isVirtual(p)) return null;
      var l = lookup(p);
      if (!l) return null;
      return makeStat(l.path, l.name || '/', l.node);
    };
    inst.canon = function (path, cwd) {
      if (isVirtual(path)) return path;
      var p = normalize(path, cwd);
      if (p === '/') return '/';
      var segs = p.split('/'), cur = R(), out = [];
      for (var i = 1; i < segs.length; i++) {
        var ent = cur && cur.type === 'dir' ? cur.kids.get(fold(segs[i])) : null;
        if (ent) { out.push(ent.name); cur = ent.node; }
        else { out.push(segs[i]); cur = null; }
      }
      return '/' + out.join('/');
    };
    inst.same = function (a, b, cwd) {
      if (isVirtual(a) || isVirtual(b)) return false;
      return inst.canon(a, cwd) === inst.canon(b, cwd);
    };
    inst.list = function (p) {
      var l = needDir(p);
      var out = [];
      l.node.kids.forEach(function (ent) { out.push(makeStat(join(l.path, ent.name), ent.name, ent.node)); });
      out.sort(function (a, b) { return a.name < b.name ? -1 : a.name > b.name ? 1 : 0; });
      return out;
    };
    inst.visible = function (list) { return list.filter(function (s) { return !s.hidden; }); };
    inst.readFile = function (p, o) {
      o = o || {};
      var l = need(p);
      if (l.node.type === 'dir') throw new VfsError('EISDIR', p);
      if (o.by && o.by !== 'system') emit('fs:read', { path: l.path, by: o.by });
      return l.node.content === null || l.node.content === undefined ? '' : l.node.content;
    };
    inst.zipEntries = function (p) {
      var l = need(p);
      if (l.node.type === 'dir' || !l.node.zip) return null;
      return l.node.zip.map(zcopy);
    };
    inst.walk = function (p, fn) {
      var l = need(p);
      (function rec(path, name, node, depth) {
        fn(makeStat(path, name, node), depth);
        if (node.type === 'dir') {
          var kids = [];
          node.kids.forEach(function (e) { kids.push(e); });
          kids.sort(function (a, b) { return a.name < b.name ? -1 : a.name > b.name ? 1 : 0; });
          kids.forEach(function (e) { rec(join(path, e.name), e.name, e.node, depth + 1); });
        }
      })(l.path, l.name || '/', l.node, 0);
    };
    inst.uniqueName = function (dir, base, ext) {
      ext = ext || '';
      var l = lookup(dir);
      var has = function (n) { return !!(l && l.node.type === 'dir' && l.node.kids.get(fold(n))); };
      var name = base + ext;
      if (!has(name)) return name;
      for (var n = 2; n < 10000; n++) { name = base + ' ' + n + ext; if (!has(name)) return name; }
      return base + ' ' + Date.now() + ext;
    };

    /* ----- internal (silent) writers ----- */
    function putFileSilent(p, content, mtime) {
      var pl = needDir(dirname(p));
      var name = basename(p);
      checkName(name);
      var ex = pl.node.kids.get(fold(name));
      var node = mkFile(mtime, content);
      if (ex) {
        if (ex.node.type === 'dir') throw new VfsError('EISDIR', p);
        node.ctime = ex.node.ctime;
        pl.node.kids.set(fold(name), { name: ex.name, node: node });
      } else pl.node.kids.set(fold(name), { name: name, node: node });
      return { created: !ex, path: join(pl.path, ex ? ex.name : name) };
    }
    /* a binary file (no text content, only a size), used when a zip entry carries `bin` */
    function putBinarySilent(p, size, mtime) {
      var pl = needDir(dirname(p));
      var name = basename(p);
      checkName(name);
      var ex = pl.node.kids.get(fold(name));
      var node = { type: 'file', mtime: mtime, ctime: mtime, size: size, content: null, binary: true };
      if (ex) {
        if (ex.node.type === 'dir') throw new VfsError('EISDIR', p);
        node.ctime = ex.node.ctime;
        pl.node.kids.set(fold(name), { name: ex.name, node: node });
      } else pl.node.kids.set(fold(name), { name: name, node: node });
      return { created: !ex, path: join(pl.path, ex ? ex.name : name) };
    }
    function mkdirpSilent(p, mtime) {
      var segs = normalize(p).split('/'), cur = R(), created = false, path = '';
      for (var i = 1; i < segs.length; i++) {
        var ent = cur.kids.get(fold(segs[i]));
        if (!ent) {
          checkName(segs[i]);
          var d = mkDir(mtime);
          cur.kids.set(fold(segs[i]), { name: segs[i], node: d });
          cur = d; created = true; path += '/' + segs[i];
        } else {
          if (ent.node.type !== 'dir') throw new VfsError('ENOTDIR', p);
          cur = ent.node; path += '/' + ent.name;
        }
      }
      return created;
    }

    /* ----- mutations ----- */
    inst.writeFile = function (p, content, o) {
      o = o || {};
      var by = o.by || 'system';
      content = content === null || content === undefined ? '' : String(content);
      var pn = normalize(p);
      if (pn === '/') throw new VfsError('EISDIR', p);
      var pl = needDir(dirname(pn));
      var name = basename(pn);
      checkName(name);
      var ex = pl.node.kids.get(fold(name));
      if (ex && ex.node.type === 'dir') throw new VfsError('EISDIR', p);
      if (!ex) guardCreate(pn, by);
      if (o.append && ex && ex.node.content) content = ex.node.content + content;
      var size = utf8len(content);
      if (size > MAX_FILE) throw new VfsError('ENOSPC', p);
      var old = ex && ex.node.content ? ex.node.size : 0;
      if (totalText() - old + size > MAX_TOTAL) throw new VfsError('ENOSPC', p);
      var now = nowMs();
      if (ex) {
        var n = ex.node;
        n.content = content; n.size = size; n.mtime = now;
        delete n.binary; delete n.zip; delete n.kind;
        pl.node.mtime = now;
      } else {
        addKid(pl.node, name, mkFile(now, content));
      }
      var cp = join(pl.path, ex ? ex.name : name);
      emit('fs:change', { op: ex ? 'write' : 'create', path: cp, kind: 'file', by: by });
      return { created: !ex };
    };
    inst.mkdir = function (p, o) {
      o = o || {};
      var by = o.by || 'system';
      var pn = normalize(p);
      var existing = lookup(pn);
      if (existing) {
        if (o.parents && existing.node.type === 'dir') return;
        throw new VfsError('EEXIST', p);
      }
      if (!o.parents) guardCreate(pn, by);
      else {
        // mkdir -p: the first folder it would create must be allowed
        var segsP = pn.split('/'), accP = '';
        for (var gi = 1; gi < segsP.length; gi++) { accP += '/' + segsP[gi]; if (!lookup(accP)) { guardCreate(accP, by); break; } }
      }
      if (!o.parents) {
        var par = lookup(dirname(pn));
        if (!par) { need(dirname(pn)); }
        if (par.node.type !== 'dir') throw new VfsError('ENOTDIR', p);
        checkName(basename(pn));
        addKid(par.node, basename(pn), mkDir(nowMs()));
      } else {
        mkdirpSilent(pn, nowMs());
      }
      emit('fs:change', { op: 'mkdir', path: inst.canon(pn), kind: 'dir', by: by });
    };
    inst.touch = function (p, o) {
      o = o || {};
      var by = o.by || 'system';
      var l = lookup(p);
      if (l) { l.node.mtime = nowMs(); emit('fs:change', { op: 'touch', path: l.path, kind: l.node.type === 'dir' ? 'dir' : 'file', by: by }); return; }
      inst.writeFile(p, '', { by: by });
    };
    inst.remove = function (p, o) {
      o = o || {};
      var by = o.by || 'system';
      var pn = normalize(p);
      var l = lookup(pn);
      if (!l) { if (o.force) return; need(pn); }
      if (pn === '/') throw new VfsError('EINVAL', p);
      guardSource(pn, by);
      if (l.node.type === 'dir' && l.node.kids.size > 0 && !o.recursive) throw new VfsError('ENOTEMPTY', p);
      var kind = l.node.type === 'dir' ? 'dir' : 'file';
      delKid(l.parent, l.name);
      emit('fs:change', { op: 'remove', path: l.path, kind: kind, by: by });
    };
    inst.trash = function (p, o) {
      o = o || {};
      var by = o.by || 'system';
      var l = need(p);
      guardSource(l.path, by);
      var trash = HOME + '/.Trash';
      if (!lookup(trash)) mkdirpSilent(trash, nowMs());
      var base = l.name, ext = '';
      if (l.node.type === 'file') { ext = extname(base); if (ext) base = base.slice(0, base.length - ext.length); }
      var dest = join(trash, inst.uniqueName(trash, base, ext));
      var kind = l.node.type === 'dir' ? 'dir' : 'file';
      var from = l.path;
      moveCore(l, dest, true);
      l.node.trashFrom = from;          // remembered for the 「放回原處」 menu item
      emit('fs:change', { op: 'move', path: dest, from: from, kind: kind, by: by, trashed: true });
      return dest;
    };
    /* where a trashed item came from ('' when unknown) */
    inst.trashOrigin = function (p) {
      var l = isVirtual(p) ? null : lookup(p);
      return l && l.node.trashFrom ? String(l.node.trashFrom) : '';
    };
    /* 「放回原處」: back to where it came from (or to the Desktop when that folder is gone) */
    inst.putBack = function (p, o) {
      o = o || {};
      var l = need(p);
      var from = l.node.trashFrom ? String(l.node.trashFrom) : '';
      var dir = from ? dirname(from) : HOME + '/Desktop';
      var dl = lookup(dir);
      if (!dl || dl.node.type !== 'dir') dir = HOME + '/Desktop';
      var base = from ? basename(from) : l.name, ext = '';
      var ex = lookup(join(dir, base));
      if (ex && ex.node !== l.node) {
        if (l.node.type === 'file') { ext = extname(base); if (ext) base = base.slice(0, base.length - ext.length); }
        base = inst.uniqueName(dir, base, ext) ;
        ext = '';
      }
      return inst.move(l.path, join(dir, base + ext), { by: o.by || 'finder', overwrite: false });
    };
    inst.emptyTrash = function (o) {
      o = o || {};
      var l = lookup(HOME + '/.Trash');
      if (!l) return;
      l.node.kids.clear();
      l.node.mtime = nowMs();
      emit('fs:change', { op: 'remove', path: l.path, kind: 'dir', by: o.by || 'system', trashed: true });
    };

    function destFor(srcL, srcCanon, to) {
      var tn = normalize(to);
      var tl = lookup(tn);
      var parentL, name, existing = null;
      if (tl && tl.node.type === 'dir' && tl.node !== srcL.node) {
        parentL = tl; name = srcL.name;
      } else if (tl) {
        // an existing file (replace it), or the same node (case-only rename)
        parentL = { node: tl.parent, path: dirname(tl.path) };
        name = tl.node === srcL.node ? basename(tn) : tl.name;
      } else {
        var pl = needDir(dirname(tn));
        parentL = pl; name = basename(tn);
      }
      checkName(name);
      if (srcL.node.type === 'dir') {
        var finalParent = fold(parentL.path);
        var sp = fold(srcCanon);
        if (finalParent === sp || finalParent.indexOf(sp + '/') === 0) throw new VfsError('EINVAL', to);
      }
      var ex = parentL.node.kids.get(fold(name));
      if (ex && ex.node !== srcL.node) existing = ex;
      return { parentL: parentL, name: name, existing: existing };
    }

    function moveCore(srcL, to, overwrite) {
      var d = destFor(srcL, srcL.path, to);
      if (d.existing) {
        if (!overwrite) throw new VfsError('EEXIST', to);
        if (d.existing.node.type === 'dir' && d.existing.node.kids.size > 0) throw new VfsError('ENOTEMPTY', to);
        if (d.existing.node.type === 'dir' && srcL.node.type !== 'dir') throw new VfsError('EISDIR', to);
        if (d.existing.node.type !== 'dir' && srcL.node.type === 'dir') throw new VfsError('ENOTDIR', to);
      }
      var now = nowMs();
      srcL.parent.kids.delete(fold(srcL.name));
      srcL.parent.mtime = now;
      if (d.existing) d.parentL.node.kids.delete(fold(d.existing.name));
      d.parentL.node.kids.set(fold(d.name), { name: d.name, node: srcL.node });
      d.parentL.node.mtime = now;
      delete srcL.node.trashFrom;
      return join(d.parentL.path, d.name);
    }

    inst.move = function (from, to, o) {
      o = o || {};
      var by = o.by || 'system';
      var overwrite = o.overwrite !== false;
      var l = need(from);
      if (l.path === '/') throw new VfsError('EINVAL', from);
      guardSource(l.path, by);
      var kind = l.node.type === 'dir' ? 'dir' : 'file';
      var fromCanon = l.path;
      guardCreate(join(destFor(l, l.path, to).parentL.path, 'x'), by);
      var finalPath = moveCore(l, to, overwrite);
      emit('fs:change', { op: 'move', path: finalPath, from: fromCanon, kind: kind, by: by });
      return finalPath;
    };
    inst.rename = function (p, newName, o) {
      o = o || {};
      var by = o.by || 'system';
      checkName(newName);
      var l = need(p);
      if (l.path === '/') throw new VfsError('EINVAL', p);
      guardSource(l.path, by);
      var dir = dirname(l.path);
      var ex = l.parent.kids.get(fold(newName));
      if (ex && ex.node !== l.node) throw new VfsError('EEXIST', newName);
      var kind = l.node.type === 'dir' ? 'dir' : 'file';
      var from = l.path;
      l.parent.kids.delete(fold(l.name));
      l.parent.kids.set(fold(newName), { name: newName, node: l.node });
      l.parent.mtime = nowMs();
      var np = join(dir, newName);
      emit('fs:change', { op: 'rename', path: np, from: from, kind: kind, by: by });
      return np;
    };

    function cloneNode(n, now) {
      if (n.type === 'dir') {
        var d = mkDir(now);
        n.kids.forEach(function (e) { d.kids.set(fold(e.name), { name: e.name, node: cloneNode(e.node, now) }); });
        return d;
      }
      var f = { type: 'file', mtime: now, ctime: now, size: n.size, content: n.content };
      if (n.binary) f.binary = true;
      if (n.kind) f.kind = n.kind;
      if (n.zip) f.zip = n.zip.map(zcopy);
      return f;
    }
    function textSize(n) {
      var t = 0;
      (function rec(x) { if (x.type === 'dir') x.kids.forEach(function (e) { rec(e.node); }); else if (x.content) t += x.size; })(n);
      return t;
    }
    inst.copy = function (from, to, o) {
      o = o || {};
      var by = o.by || 'system';
      var l = need(from);
      if (l.node.type === 'dir' && !o.recursive) throw new VfsError('EISDIR', from);
      var d = destFor(l, l.path, to);
      guardCreate(join(d.parentL.path, 'x'), by);
      if (d.existing) {
        if (d.existing.node.type === 'dir' && l.node.type !== 'dir') throw new VfsError('EISDIR', to);
        if (d.existing.node.type !== 'dir' && l.node.type === 'dir') throw new VfsError('ENOTDIR', to);
        if (d.existing.node.type === 'dir' && d.existing.node.kids.size > 0) throw new VfsError('ENOTEMPTY', to);
      }
      var now = nowMs();
      var copyNode = cloneNode(l.node, now);
      var oldSize = d.existing ? textSize(d.existing.node) : 0;
      if (totalText() - oldSize + textSize(copyNode) > MAX_TOTAL) throw new VfsError('ENOSPC', to);
      if (d.existing) d.parentL.node.kids.delete(fold(d.existing.name));
      addKid(d.parentL.node, d.name, copyNode);
      var finalPath = join(d.parentL.path, d.name);
      emit('fs:change', { op: 'copy', path: finalPath, from: l.path, kind: l.node.type === 'dir' ? 'dir' : 'file', by: by });
      return finalPath;
    };

    /* ----- zip ----- */
    function entryParts(entryName) { return entryName.split('/').filter(function (s) { return s.length; }); }
    function extractInto(zipL, destDir, o) {
      var zip = zipL.node.zip;
      if (!zip) throw new VfsError('EINVAL', zipL.path);
      var res = [];
      var strip = o.strip || '';
      zip.forEach(function (en) {
        var parts = entryParts(en.name);
        if (strip) { if (parts[0] !== strip) return; parts = parts.slice(1); }
        if (!parts.length) return;
        var rel = parts.join('/');
        if (o.filter && o.filter(en.name) === false) return;
        var full = join(destDir, rel);
        if (en.type === 'dir') {
          mkdirpSilent(full, en.mtime);
          res.push({ path: inst.canon(full), type: 'dir', mtime: en.mtime, rel: rel });
        } else {
          mkdirpSilent(dirname(full), en.mtime);
          var pf = en.bin !== undefined ? putBinarySilent(full, en.bin, en.mtime) : putFileSilent(full, en.content || '', en.mtime);
          res.push({ path: pf.path, type: 'file', mtime: en.mtime, rel: rel, created: pf.created });
        }
      });
      return res;
    }
    inst.extractZip = function (zipPath, destDir, o) {
      o = o || {};
      var by = o.by || 'system';
      var zl = need(zipPath);
      if (zl.node.type === 'dir' || !zl.node.zip) throw new VfsError('EINVAL', zipPath);
      if (!lookup(destDir)) { guardCreate(destDir, by); mkdirpSilent(destDir, nowMs()); }
      var dl = needDir(destDir);
      // unzipping straight into / or /Users would put new files next to the system folders
      if (NO_CREATE_IN.indexOf(dl.path) >= 0 && by !== 'system') throw new VfsError('EACCES', destDir);
      var res = extractInto(zl, dl.path, { filter: o.filter });
      var seen = {};
      res.forEach(function (r) {
        var top = r.rel.split('/')[0];
        if (seen[top]) return;
        seen[top] = true;
        var tp = join(dl.path, top);
        var st = lookup(tp);
        emit('fs:change', { op: 'create', path: st ? st.path : tp, kind: st && st.node.type === 'dir' ? 'dir' : 'file', by: by });
      });
      dl.node.mtime = nowMs();
      return res.map(function (r) { return { path: r.path, type: r.type, mtime: r.mtime }; });
    };
    inst.extractFinder = function (zipPath, o) {
      o = o || {};
      var by = o.by || 'system';
      var zl = need(zipPath);
      if (zl.node.type === 'dir' || !zl.node.zip) throw new VfsError('EINVAL', zipPath);
      var dir = dirname(zl.path);
      var base = zl.name.replace(/\.[^.]*$/, '') || zl.name;
      var folder = inst.uniqueName(dir, base, '');
      var dest = join(dir, folder);
      var roots = {};
      zl.node.zip.forEach(function (en) { var p = entryParts(en.name); if (p.length) roots[p[0]] = true; });
      var rootNames = Object.keys(roots);
      var strip = '';
      if (rootNames.length === 1) {
        var only = rootNames[0];
        var hasChildren = zl.node.zip.some(function (en) { return entryParts(en.name).length > 1; });
        var rootIsDir = zl.node.zip.some(function (en) { return en.type === 'dir' && entryParts(en.name).length === 1 && entryParts(en.name)[0] === only; });
        if (hasChildren || rootIsDir) strip = only;
      }
      var parentL = needDir(dir);
      checkName(folder);
      var d = mkDir(nowMs());
      addKid(parentL.node, folder, d);
      extractInto(zl, dest, { strip: strip });
      emit('fs:change', { op: 'create', path: dest, kind: 'dir', by: by });
      return dest;
    };

    /* ----- zip API for Finder and the Terminal (round 5, SPEC §2) -----
       zipCreate(srcPaths[], destZipPath, {by, names?}) -> {ok, path, entries}   (on failure {ok:false, error:<code>, path})
         The archive node has the same shape as the seed's week3.zip (kind 'zip', zip:[{name,type,content,mtime}]), so `unzip`, `tar` and
         Archive Utility all read it. Every source goes in at the top level under its own name (`names[i]` overrides the top name:
         the Terminal passes the path as typed); folders are walked in name order, a binary file keeps its size (entry.bin).
       zipList(zipPath) -> [{name, type, size}] | null (null: not an archive)
       zipExtract(zipPath, destDir, {by}) -> {ok, created:[Path]}   (Terminal `unzip` semantics: entries land inside destDir) */
    var ZIP_MAX_ENTRIES = 500, ZIP_MAX_BYTES = 400 * 1024;
    inst.zipCreate = function (srcPaths, destZip, o) {
      o = o || {};
      var by = o.by || 'system';
      var srcs = Array.isArray(srcPaths) ? srcPaths : [srcPaths];
      var dn;
      try { dn = normalize(destZip); } catch (e0) { return { ok: false, error: 'EINVAL', path: destZip }; }
      if (!srcs.length || dn === '/') return { ok: false, error: 'EINVAL', path: destZip };
      var entries = [], total = 0, bad = null;
      var destL = lookup(dn);
      function addTree(node, name, nodePath) {
        if (bad) return;
        if (entries.length >= ZIP_MAX_ENTRIES) { bad = { error: 'ENOSPC', path: nodePath }; return; }
        if (destL && destL.node === node) return;                       // never pack the archive into itself
        if (node.type === 'dir') {
          entries.push({ name: name + '/', type: 'dir', content: '', mtime: node.mtime });
          if (o.shallow) return;                                          // `zip` without -r: just the folder itself
          var kids = [];
          node.kids.forEach(function (e) { kids.push(e); });
          kids.sort(function (a, b) { return a.name < b.name ? -1 : a.name > b.name ? 1 : 0; });
          kids.forEach(function (e) { addTree(e.node, name + '/' + e.name, join(nodePath, e.name)); });
          return;
        }
        var ent = { name: name, type: 'file', content: node.binary || node.content === null || node.content === undefined ? '' : node.content, mtime: node.mtime };
        if (node.binary || node.kind === 'zip' || node.kind === 'app') ent.bin = node.size || 0;
        else total += utf8len(ent.content);
        if (total > ZIP_MAX_BYTES) { bad = { error: 'ENOSPC', path: nodePath }; return; }
        entries.push(ent);
      }
      for (var i = 0; i < srcs.length; i++) {
        var sl = lookup(srcs[i]);
        if (!sl) return { ok: false, error: 'ENOENT', path: srcs[i] };
        var top = (o.names && o.names[i]) ? String(o.names[i]).replace(/\/+$/, '') : (sl.path === '/' ? 'Macintosh HD' : sl.name);
        addTree(sl.node, top, sl.path);
        if (bad) return { ok: false, error: bad.error, path: bad.path };
      }
      if (!entries.length) return { ok: false, error: 'EINVAL', path: destZip };
      var pl;
      try { pl = needDir(dirname(dn)); } catch (e1) { return { ok: false, error: e1.code || 'ENOENT', path: destZip }; }
      var name = basename(dn);
      try { checkName(name); } catch (e2) { return { ok: false, error: e2.code || 'EINVAL', path: destZip }; }
      var ex = pl.node.kids.get(fold(name));
      if (ex && ex.node.type === 'dir') return { ok: false, error: 'EISDIR', path: destZip };
      if (!ex) { try { guardCreate(dn, by); } catch (e3) { return { ok: false, error: e3.code || 'EACCES', path: destZip }; } }
      var raw = 0;
      entries.forEach(function (en) { if (en.type === 'file') { raw += en.bin !== undefined ? en.bin : utf8len(en.content); } });
      var size = Math.max(22, Math.round(raw * 0.62) + 98 * entries.length + 22);
      var now = nowMs();
      var node = { type: 'file', mtime: now, ctime: ex ? ex.node.ctime : now, size: size, content: null, binary: true, kind: 'zip', zip: entries };
      if (ex) { pl.node.kids.set(fold(name), { name: ex.name, node: node }); pl.node.mtime = now; }
      else addKid(pl.node, name, node);
      var finalPath = join(pl.path, ex ? ex.name : name);
      emit('fs:change', { op: ex ? 'write' : 'create', path: finalPath, kind: 'file', by: by });
      return {
        ok: true, path: finalPath,
        entries: entries.map(function (en) { return { name: en.name, type: en.type, size: en.type === 'dir' ? 0 : (en.bin !== undefined ? en.bin : utf8len(en.content)) }; })
      };
    };
    inst.zipList = function (zipPath) {
      var l = isVirtual(zipPath) ? null : lookup(zipPath);
      if (!l || l.node.type === 'dir' || !l.node.zip) return null;
      return l.node.zip.map(function (en) {
        return { name: en.name, type: en.type, size: en.type === 'dir' ? 0 : (en.bin !== undefined ? en.bin : utf8len(en.content || '')) };
      });
    };
    inst.zipExtract = function (zipPath, destDir, o) {
      o = o || {};
      try {
        var res = inst.extractZip(zipPath, destDir, { by: o.by || 'system', filter: o.filter });
        return { ok: true, created: res.map(function (r) { return r.path; }) };
      } catch (e) {
        return { ok: false, error: (e && e.code) || 'EINVAL', created: [] };
      }
    };

    /* ----- persistence ----- */
    function toJson(node) {
      if (node.type === 'dir') {
        var c = Object.create(null);   // a file called __proto__ must stay an ordinary own key
        node.kids.forEach(function (e) { c[e.name] = toJson(e.node); });
        var dj = { t: 'd', m: node.mtime, c: c };
        if (node.trashFrom) dj.o = node.trashFrom;
        return dj;
      }
      var j = { t: 'f', m: node.mtime };
      if (node.trashFrom) j.o = node.trashFrom;
      if (node.content !== null && node.content !== undefined) j.x = node.content;
      if (node.binary) j.b = 1;
      if (node.binary || node.kind) j.s = node.size;
      if (node.kind) j.k = node.kind;
      if (node.zip) j.z = node.zip.map(zcopy);
      return j;
    }
    inst.toJSON = function () { return toJson(R()); };

    function validZip(z) {
      if (!Array.isArray(z) || z.length > 500) return false;
      for (var i = 0; i < z.length; i++) {
        var e = z[i];
        if (!e || typeof e.name !== 'string' || (e.type !== 'dir' && e.type !== 'file') || !isFinite(e.mtime)) return false;
        if (e.type === 'file' && typeof e.content !== 'string') return false;
        var parts = e.name.split('/');
        for (var k = 0; k < parts.length; k++) { if (parts[k] === '..' || parts[k] === '.' || parts[k].indexOf('\u0000') >= 0) return false; }
      }
      return true;
    }

    /* returns a node, or null when the subtree is unusable; children that fail are replaced by the seed's node at the same path */
    function build(j, path, depth) {
      if (!j || typeof j !== 'object' || depth > MAX_DEPTH) return null;
      if (!isFinite(j.m)) return null;
      if (j.t === 'd') {
        if (!j.c || typeof j.c !== 'object' || Array.isArray(j.c)) return null;
        var d = mkDir(j.m);
        if (typeof j.o === 'string') d.trashFrom = j.o;
        Object.keys(j.c).forEach(function (name) {
          try { checkName(name); } catch (e) { return; }
          if (d.kids.has(fold(name))) return;
          var cp = join(path, name);
          var child = build(j.c[name], cp, depth + 1);
          if (!child && LAB.seed) {
            var sj = LAB.seed.nodeAt(cp);
            if (sj) child = build(sj, cp, depth + 1);
          }
          if (child) d.kids.set(fold(name), { name: name, node: child });
        });
        return d;
      }
      if (j.t === 'f') {
        var f;
        if (j.b === 1) {
          if (!isFinite(j.s) || j.s < 0) return null;
          f = { type: 'file', mtime: j.m, ctime: j.m, size: j.s, content: null, binary: true };
        } else {
          if (typeof j.x !== 'string') return null;
          var sz = utf8len(j.x);
          if (sz > MAX_FILE) return null;
          f = { type: 'file', mtime: j.m, ctime: j.m, size: sz, content: j.x };
          if (j.k === 'app') f.size = isFinite(j.s) ? j.s : 0;
        }
        if (j.k === 'zip' || j.k === 'app') f.kind = j.k;
        else if (j.k !== undefined) return null;
        if (j.z !== undefined) {
          if (!validZip(j.z)) return null;
          f.zip = j.z.map(zcopy);
        }
        if (typeof j.o === 'string') f.trashFrom = j.o;
        return f;
      }
      return null;
    }
    function ensureSkeleton() {
      var now = nowMs();
      var need2 = ['/Applications', '/Users', HOME].concat(STD_FOLDERS.map(function (n) { return HOME + '/' + n; }), [HOME + '/.Trash']);
      need2.forEach(function (p) {
        if (lookup(p)) return;
        var sj = LAB.seed ? LAB.seed.nodeAt(p) : null;
        try { mkdirpSilent(p, sj ? sj.m : now); } catch (e) { /* a file is in the way: leave it */ }
      });
    }
    inst.load = function (j) {
      var r = null;
      try { r = build(j, '/', 0); } catch (e) { r = null; }
      if (!r || r.type !== 'dir') { inst.seed(); return; }
      root = r;
      ensureSkeleton();
    };
    inst.seed = function () {
      var t = LAB.seed ? LAB.seed.tree() : { t: 'd', m: Date.now(), c: {} };
      root = build(t, '/', 0) || mkDir(Date.now());
      ensureSkeleton();
    };
    inst.reset = function () {
      inst.seed();
      emit('fs:change', { op: 'create', path: HOME, kind: 'dir', by: 'system' });
    };
    inst.putJson = function (p, j, o) {
      o = o || {};
      var pn = normalize(p);
      var pl = needDir(dirname(pn));
      var name = basename(pn);
      checkName(name);
      var node = build(j, pn, 0);
      if (!node) throw new VfsError('EINVAL', p);
      var ex = pl.node.kids.get(fold(name));
      if (ex) pl.node.kids.delete(fold(name));
      addKid(pl.node, name, node);
      emit('fs:change', { op: 'create', path: join(pl.path, name), kind: node.type === 'dir' ? 'dir' : 'file', by: o.by || 'system' });
    };
    inst.batch = function (fn) { return fn(); };
    inst.totalBytes = totalText;

    // statics reachable from every instance
    inst.HOME = HOME;
    inst.normalize = normalize; inst.join = join; inst.basename = basename; inst.dirname = dirname; inst.extname = extname;
    inst.isUnder = isUnder; inst.displayName = displayName; inst.checkName = checkName; inst.errText = errText;
    inst.isVirtual = isVirtual; inst.utf8len = utf8len; inst.isProtected = isProtected;
    inst.VfsError = VfsError;
    inst.create = create;
    inst.limits = { maxFile: MAX_FILE, maxTotal: MAX_TOTAL };
    return inst;
  }

  LAB.vfs = create(undefined, { emit: true });

  LAB.store.register('vfs', {
    serialize: function () { return LAB.vfs.toJSON(); },
    restore: function (j) { if (j === undefined || j === null) LAB.vfs.seed(); else LAB.vfs.load(j); },
    reset: function () { LAB.vfs.reset(); }
  });
})(window.LAB);
