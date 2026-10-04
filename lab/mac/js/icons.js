/* icons.js [SKIN] — LAB.icons: all icons are original inline SVG (DESIGN §2.3, §0.2). */
(function (LAB) {
  'use strict';

  var reg = Object.create(null);   // name -> {vb, inner, fn}

  /* One hidden-but-rendered sprite holds the gradients (display:none would break url(#id) in some browsers). */
  var SPRITE =
    '<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>' +
    '<linearGradient id="lab-g-folder" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9fd3ff"/><stop offset="1" stop-color="#5aa7ee"/></linearGradient>' +
    '<linearGradient id="lab-g-blue" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5db0ff"/><stop offset="1" stop-color="#1c6fe0"/></linearGradient>' +
    '<linearGradient id="lab-g-code" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3aa0ff"/><stop offset="1" stop-color="#0a5fcf"/></linearGradient>' +
    '<linearGradient id="lab-g-grey" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e9ebef"/><stop offset="1" stop-color="#b9bec8"/></linearGradient>' +
    '<linearGradient id="lab-g-trash" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4f6f8" stop-opacity=".95"/><stop offset="1" stop-color="#c2c8d2" stop-opacity=".92"/></linearGradient>' +
    '</defs></svg>';

  var PAGE = '<path d="M14 4h25l13 13v39a4 4 0 0 1-4 4H14a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4z" fill="#fff" stroke="rgba(0,0,0,.28)" stroke-width="1.2"/>' +
             '<path d="M39 4v10a3 3 0 0 0 3 3h10" fill="#e8e9ec" stroke="rgba(0,0,0,.28)" stroke-width="1.2" stroke-linejoin="round"/>';
  function lines(y0, n, color) {
    var s = '';
    for (var i = 0; i < n; i++) s += '<path d="M18 ' + (y0 + i * 7) + 'h' + (i === n - 1 ? 16 : 28) + '" stroke="' + (color || '#b9bcc4') + '" stroke-width="2.4" stroke-linecap="round"/>';
    return s;
  }
  function labelPage(text, color, w) {
    var x0 = 32 - w / 2;
    return PAGE + '<rect x="' + x0 + '" y="32" width="' + w + '" height="14" rx="3" fill="' + color + '"/>' +
      '<text x="32" y="42.6" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-weight="700" font-size="9.5" fill="#fff">' + text + '</text>' + lines(23, 1, '#b9bcc4').replace('h16', 'h22');
  }
  var FOLDER_BACK = '<path d="M5 14a4 4 0 0 1 4-4h14l5 5h27a4 4 0 0 1 4 4v31a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4z" fill="#4c95dc"/>';
  var FOLDER_FRONT = '<path d="M5 22a4 4 0 0 1 4-4h46a4 4 0 0 1 4 4v28a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4z" fill="url(#lab-g-folder)"/>' +
    '<path d="M5 22a4 4 0 0 1 4-4h46a4 4 0 0 1 4 4" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="1"/>';

  var A = '0 0 64 64';
  var defs = {
    /* ---- app icons ---- */
    'app-finder': [A, '<rect x="4" y="4" width="56" height="56" rx="14" fill="url(#lab-g-blue)"/>' +
      '<rect x="13.5" y="16.5" width="37" height="31" rx="4.5" fill="none" stroke="#fff" stroke-width="3"/>' +
      '<path d="M13.5 25h37" stroke="#fff" stroke-width="3"/>' +
      '<path d="M21 32h8.5l2.5 3.2H43v8H21z" fill="#fff"/>'],
    'app-terminal': [A, '<rect x="4" y="4" width="56" height="56" rx="14" fill="#111"/>' +
      '<rect x="4.5" y="4.5" width="55" height="55" rx="13.5" fill="none" stroke="#3b3b3b"/>' +
      '<path d="M13 37l9 6.2-9 6.2" fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="M27 50h14" stroke="#fff" stroke-width="3.6" stroke-linecap="round"/>'],
    'app-codex': [A, '<rect x="4" y="4" width="56" height="56" rx="18" fill="#2a2a2a"/>' +
      '<rect x="4.5" y="4.5" width="55" height="55" rx="17.5" fill="none" stroke="#4a4a4a"/>' +
      '<path d="M32 15c9.5 0 17 6.2 17 15.8 0 10-6.6 17.4-17.4 17.4C22 48.2 15 41.2 15 32 15 22 22.4 15 32 15z" fill="none" stroke="#e4e4e4" stroke-width="2" stroke-linejoin="round"/>'],
    'app-code': [A, '<rect x="4" y="4" width="56" height="56" rx="14" fill="url(#lab-g-code)"/>' +
      '<path d="M26 21L14 32l12 11" fill="none" stroke="#fff" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="M38 21l12 11-12 11" fill="none" stroke="#fff" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round"/>'],
    'app-textedit': [A, '<path d="M15 4h27l12 12v40a4 4 0 0 1-4 4H15a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4z" fill="#fff" stroke="rgba(0,0,0,.3)"/>' +
      '<path d="M42 4v9a3 3 0 0 0 3 3h9" fill="#e6e7ea" stroke="rgba(0,0,0,.3)" stroke-linejoin="round"/>' +
      '<path d="M19 29h26M19 37h26M19 45h16" stroke="#aab0ba" stroke-width="2.6" stroke-linecap="round"/>'],
    'app-about': [A, '<rect x="4" y="4" width="56" height="56" rx="14" fill="#f6efdc"/>' +
      '<rect x="4.5" y="4.5" width="55" height="55" rx="13.5" fill="none" stroke="rgba(0,0,0,.14)"/>' +
      '<path d="M17 46V38M29 46V30M41 46V20" stroke="#8a5400" stroke-width="7" stroke-linecap="butt"/>'],
    'app-trash-empty': [A, '<path d="M14 18h36l-3 36a4 4 0 0 1-4 3.6H21a4 4 0 0 1-4-3.6z" fill="url(#lab-g-trash)" stroke="rgba(0,0,0,.28)"/>' +
      '<rect x="11" y="12" width="42" height="6" rx="3" fill="#dfe3e9" stroke="rgba(0,0,0,.28)"/>' +
      '<path d="M25 24v26M32 24v26M39 24v26" stroke="rgba(0,0,0,.2)" stroke-width="2" stroke-linecap="round"/>'],
    'app-trash-full': [A, '<path d="M20 14l6-6 6 5 7-5 6 8" fill="#fff" stroke="rgba(0,0,0,.25)" stroke-linejoin="round"/>' +
      '<path d="M14 18h36l-3 36a4 4 0 0 1-4 3.6H21a4 4 0 0 1-4-3.6z" fill="url(#lab-g-trash)" stroke="rgba(0,0,0,.28)"/>' +
      '<rect x="11" y="12" width="42" height="6" rx="3" fill="#dfe3e9" stroke="rgba(0,0,0,.28)"/>' +
      '<path d="M25 24v26M32 24v26M39 24v26" stroke="rgba(0,0,0,.2)" stroke-width="2" stroke-linecap="round"/>'],
    'app-downloads': [A, FOLDER_BACK + FOLDER_FRONT +
      '<path d="M32 26v16M25 36l7 7 7-7" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>'],
    /* ---- file icons ---- */
    'folder': [A, FOLDER_BACK + FOLDER_FRONT],
    'doc': [A, PAGE + lines(24, 4)],
    'md': [A, labelPage('MD', '#6b7280', 24)],
    'txt': [A, PAGE + lines(24, 4) + '<rect x="18" y="45" width="0" height="0"/>'],
    'csv': [A, labelPage('CSV', '#2e9e5b', 30)],
    'pdf': [A, labelPage('PDF', '#d8453c', 30)],
    'docx': [A, labelPage('DOCX', '#2b6fd6', 34)],
    'zip': [A, PAGE + '<path d="M29 4v44" stroke="#c7c9cf" stroke-width="1"/>' +
      '<rect x="27" y="14" width="10" height="3" fill="#8e939e"/><rect x="27" y="20" width="10" height="3" fill="#8e939e"/><rect x="27" y="26" width="10" height="3" fill="#8e939e"/>' +
      '<rect x="26" y="33" width="12" height="9" rx="2" fill="#6b7280"/>' +
      '<text x="32" y="55" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-weight="700" font-size="7.5" fill="#6b7280">ZIP</text>'],
    'app': [A, '<rect x="6" y="6" width="52" height="52" rx="13" fill="url(#lab-g-grey)" stroke="rgba(0,0,0,.25)"/>' +
      '<path d="M20 44l12-24 12 24M25 37h14" fill="none" stroke="#5b6270" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>'],
    'image': [A, PAGE + '<circle cx="24" cy="26" r="4" fill="#f2b84b"/><path d="M14 48l11-12 8 8 6-6 11 10z" fill="#6fb7a5"/>'],
    'unknown': [A, PAGE + '<path d="M26 30a6 6 0 1 1 8 5.6c-1.4.7-2 1.6-2 3" fill="none" stroke="#9aa0ab" stroke-width="2.6" stroke-linecap="round"/><circle cx="32" cy="45" r="1.8" fill="#9aa0ab"/>']
  };

  /* ---- UI glyphs (24 box, 1.6 stroke, currentColor) ---- */
  var G = '0 0 24 24';
  function g(inner) { return [G, '<g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' + inner + '</g>']; }
  var glyphs = {
    'chev-left': '<path d="M14.5 5.5L8 12l6.5 6.5"/>',
    'chev-right': '<path d="M9.5 5.5L16 12l-6.5 6.5"/>',
    'chev-up': '<path d="M5.5 14.5L12 8l6.5 6.5"/>',
    'chev-down': '<path d="M5.5 9.5L12 16l6.5-6.5"/>',
    'search': '<circle cx="10.5" cy="10.5" r="5.5"/><path d="M15 15l5 5"/>',
    'plus': '<path d="M12 5v14M5 12h14"/>',
    'pencil': '<path d="M4 20l1-4.5L16.5 4a2 2 0 0 1 2.8 0l.7.7a2 2 0 0 1 0 2.8L8.5 19z"/><path d="M14.5 6l3.5 3.5"/>',
    'folder-sm': '<path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2.2h7a2 2 0 0 1 2 2v7.8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/>',
    'laptop': '<rect x="5" y="5.5" width="14" height="9.5" rx="1.6"/><path d="M3 18.5h18"/>',
    'check': '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    'x': '<path d="M6 6l12 12M18 6L6 18"/>',
    'send': '<path d="M12 19V6M6.5 11.5L12 6l5.5 5.5"/>',
    'house': '<path d="M4 11l8-6.5 8 6.5M6.5 9.5V19h11V9.5"/>',
    'clock': '<circle cx="12" cy="12" r="8"/><path d="M12 7.5V12l3 2"/>',
    'apps': '<path d="M7 4.5l-2.5 9M10 4.5l-2.5 9M14 5l3.5 8M5.5 18h13"/>',
    'desktop': '<rect x="3.5" y="5" width="17" height="11" rx="1.6"/><path d="M9 20h6M12 16v4"/>',
    'doc-sm': '<path d="M7 3.5h7l4 4v12a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 19.5v-14A1.5 1.5 0 0 1 7.5 4z"/><path d="M14 3.5v4h4"/>',
    'download': '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>',
    'list-view': '<path d="M8 6.5h12M8 12h12M8 17.5h12M4 6.5h.5M4 12h.5M4 17.5h.5"/>',
    'columns-view': '<rect x="4.5" y="5" width="15" height="14" rx="1.5"/><path d="M9.5 5v14M14.5 5v14"/>',
    'gallery-view': '<rect x="4.5" y="5" width="15" height="9" rx="1.2"/><path d="M5 17.5h2.4M9.4 17.5h2.4M13.8 17.5h2.4"/>',
    'icon-view': '<rect x="4.5" y="4.5" width="6" height="6" rx="1"/><rect x="13.5" y="4.5" width="6" height="6" rx="1"/><rect x="4.5" y="13.5" width="6" height="6" rx="1"/><rect x="13.5" y="13.5" width="6" height="6" rx="1"/>',
    'share': '<path d="M12 4v10M8 8l4-4 4 4M6 12v6.5a1.5 1.5 0 0 0 1.5 1.5h9a1.5 1.5 0 0 0 1.5-1.5V12"/>',
    'tag': '<path d="M4 12.5V5.5a1.5 1.5 0 0 1 1.5-1.5h7l7.5 7.5-8.5 8.5z"/><circle cx="8.5" cy="8.5" r="1"/>',
    'gear': '<circle cx="12" cy="12" r="3"/><path d="M12 3.5v2.3M12 18.2v2.3M3.5 12h2.3M18.2 12h2.3M6 6l1.6 1.6M16.4 16.4L18 18M18 6l-1.6 1.6M7.6 16.4L6 18"/>',
    'info': '<circle cx="12" cy="12" r="8"/><path d="M12 11v5M12 8v.2"/>',
    'wifi': '<path d="M3.5 9.5a12 12 0 0 1 17 0M6.5 12.8a8 8 0 0 1 11 0M9.4 16a4 4 0 0 1 5.2 0"/><circle cx="12" cy="19" r=".8" fill="currentColor"/>',
    'battery': '<rect x="3" y="8" width="16" height="8" rx="2.2"/><path d="M21 11v2"/><rect x="5" y="10" width="9" height="4" rx="1" fill="currentColor" stroke="none"/>',
    'control-center': '<rect x="4" y="5" width="16" height="5" rx="2.5"/><circle cx="16.5" cy="7.5" r="1.4" fill="currentColor" stroke="none"/><rect x="4" y="14" width="16" height="5" rx="2.5"/><circle cx="7.5" cy="16.5" r="1.4" fill="currentColor" stroke="none"/>',
    'ime': '<rect x="3.5" y="6" width="17" height="12" rx="2"/><path d="M7 14.5l2.2-5 2.2 5M7.8 13h2.8"/><path d="M14.5 10h3M16 10v4.5"/>',
    'sort-asc': '<path d="M6 14l6-6 6 6"/>',
    'sort-desc': '<path d="M6 10l6 6 6-6"/>',
    'mark': '<path d="M6 17.5v-3M12 17.5v-7M18 17.5V5.5" stroke-width="3.2" stroke-linecap="butt"/><path d="M3.5 21h17" stroke-width="1.5" stroke-linecap="round"/>'
  };
  Object.keys(glyphs).forEach(function (k) { defs[k] = g(glyphs[k]); });
  Object.keys(defs).forEach(function (k) { reg[k] = { vb: defs[k][0], inner: defs[k][1] }; });

  function svgFor(entry, size, cls) {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + entry.vb + '" width="' + size + '" height="' + size + '"' +
      (cls ? ' class="' + cls + '"' : '') + ' aria-hidden="true" focusable="false">' + entry.inner + '</svg>';
  }

  var icons = {
    get: function (name, opts) {
      opts = opts || {};
      var size = opts.size || 24, cls = opts.cls || '';
      var e = reg[name] || reg.unknown;
      if (e.fn) { var out = e.fn(opts); return typeof out === 'string' ? out : svgFor(reg.unknown, size, cls); }
      return svgFor(e, size, cls);
    },
    el: function (name, opts) {
      var wrap = document.createElement('span');
      wrap.className = 'lab-ico';
      wrap.innerHTML = icons.get(name, opts);   // static strings only (DESIGN §0.5)
      return wrap.firstChild;
    },
    add: function (name, svgStringOrFn) {
      if (reg[name]) return;
      if (typeof svgStringOrFn === 'function') { reg[name] = { vb: A, inner: '', fn: svgStringOrFn }; return; }
      var s = String(svgStringOrFn);
      var vb = (/viewBox="([^"]+)"/.exec(s) || [])[1] || A;
      var inner = s.replace(/^\s*<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
      reg[name] = { vb: vb, inner: inner };
    },
    has: function (name) { return !!reg[name]; },
    forNode: function (st) {
      if (!st) return 'unknown';
      if (st.type === 'dir' || st.kind === 'folder') return 'folder';
      if (st.kind === 'app') return 'app';
      var m = /\.([^./]+)$/.exec(st.name || '');
      var ext = m ? m[1].toLowerCase() : '';
      if (ext === 'md') return 'md';
      if (ext === 'csv') return 'csv';
      if (ext === 'txt' || ext === 'log') return 'txt';
      if (ext === 'zip' || st.kind === 'zip') return 'zip';
      if (ext === 'pdf') return 'pdf';
      if (ext === 'docx' || ext === 'doc') return 'docx';
      if (ext === 'png' || ext === 'jpg' || ext === 'jpeg' || ext === 'gif' || ext === 'heic' || ext === 'webp') return 'image';
      if (st.kind === 'text') return 'doc';
      return 'unknown';
    }
  };
  LAB.icons = icons;

  function mountSprite() {
    if (document.getElementById('lab-sprite')) return;
    var d = document.createElement('div');
    d.id = 'lab-sprite';
    d.setAttribute('aria-hidden', 'true');
    d.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    d.innerHTML = SPRITE;
    document.body.insertBefore(d, document.body.firstChild);
  }
  if (document.body) mountSprite(); else document.addEventListener('DOMContentLoaded', mountSprite);
})(window.LAB);
