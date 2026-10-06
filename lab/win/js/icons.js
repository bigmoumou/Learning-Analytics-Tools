/* icons.js [SKIN] — LAB.icons: every icon is our own inline SVG, drawn to read like Windows 11 / the apps (DESIGN W3, W0.1: no vendor artwork).
   Round 6: the whole set redrawn in the Windows 11 (Fluent) manner: translucent glass, soft top light, thin bright rims, a quiet contact shadow.
   App and file icons: viewBox 0 0 64 64 (the Codex and VS Code art use a 1024 grid). UI glyphs: 0 0 24 24, currentColor, 1.5 stroke.
   Gradients live in ONE always-rendered sprite (a gradient inside a display:none subtree would not paint, and duplicate ids would pick the hidden one),
   the icon markup only refers to them, which also keeps every icon small. Gradients use userSpaceOnUse in the icon's own 64 grid.
   Sizes: an entry may carry a third item, a simpler drawing used up to 20 px (Windows draws its 16 px icons by hand too).
   API (unchanged from the Mac): get(name,{size,cls}) -> markup, el(name,opts), add(name, svg|fn), has(name), forNode(stat); names() lists the registry. */
(function (LAB) {
  'use strict';

  var reg = Object.create(null);   // name -> {vb, inner, sm, fn}
  var DEFS = '';                   // every gradient of this file, mounted once as the sprite

  function stops(a) {
    var s = '';
    for (var i = 0; i < a.length; i++) s += '<stop offset="' + a[i][0] + '" stop-color="' + a[i][1] + '"' + (a[i][2] != null ? ' stop-opacity="' + a[i][2] + '"' : '') + '/>';
    return s;
  }
  /* linear gradient in the icon's own user space (x1,y1 -> x2,y2); returns the paint url */
  function lin(id, x1, y1, x2, y2, st) {
    DEFS += '<linearGradient id="lab-w-' + id + '" gradientUnits="userSpaceOnUse" x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '">' + stops(st) + '</linearGradient>';
    return 'url(#lab-w-' + id + ')';
  }
  /* radial gradient in user space (centre cx,cy, radius r, optional focus) */
  function rad(id, cx, cy, r, st, fx, fy) {
    DEFS += '<radialGradient id="lab-w-' + id + '" gradientUnits="userSpaceOnUse" cx="' + cx + '" cy="' + cy + '" r="' + r + '"' + (fx != null ? ' fx="' + fx + '" fy="' + fy + '"' : '') + '>' + stops(st) + '</radialGradient>';
    return 'url(#lab-w-' + id + ')';
  }
  /* the quiet contact shadow under a standing icon: an ellipse filled with a bounding-box radial gradient */
  DEFS += '<radialGradient id="lab-w-gsh"><stop offset="0" stop-color="#000" stop-opacity=".30"/><stop offset=".55" stop-color="#000" stop-opacity=".13"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>';
  function ground(cx, cy, rx, ry) { return '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + rx + '" ry="' + ry + '" fill="url(#lab-w-gsh)"/>'; }
  function f1(n) { return Math.round(n * 100) / 100; }

  var A = '0 0 64 64';
  var FONT = 'font-family="Segoe UI,Helvetica,Arial,sans-serif" font-weight="700"';

  /* ================================================================ folders (Windows 11: a deeper gold back plate with a tab, a lighter front, a little thickness) */
  var FO_BACK = lin('fo-b', 0, 9, 0, 54, [[0, '#f6bc2a'], [1, '#cf8c05']]);
  var FO_FRONT = lin('fo-f', 0, 22, 0, 54, [[0, '#ffe896'], [0.5, '#ffd150'], [1, '#fcbb26']]);
  var FO_GLOSS = lin('fo-g', 0, 22, 0, 34, [[0, '#fff', 0.5], [1, '#fff', 0]]);
  var FO_BACK_D = 'M4 13.5a4 4 0 0 1 4-4h13.6c1.5 0 2.9.7 3.9 1.8l2.3 2.6c.7.8 1.7 1.3 2.9 1.3H56a4 4 0 0 1 4 4V50a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z';
  var FO_FRONT_D = 'M4 26a4 4 0 0 1 4-4h48a4 4 0 0 1 4 4v24a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z';
  function folderBack() {
    return ground(32, 55.6, 25, 2.4) +
      '<path d="' + FO_BACK_D + '" fill="' + FO_BACK + '"/>' +
      '<path d="M8 10.2h13.6c1.3 0 2.5.5 3.4 1.4" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="1" stroke-linecap="round"/>';
  }
  function folderFront() {
    return '<path d="' + FO_FRONT_D + '" fill="' + FO_FRONT + '"/>' +
      '<path d="' + FO_FRONT_D + '" fill="' + FO_GLOSS + '"/>' +
      '<path d="M4 47.6h56V50a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z" fill="#c47a00" opacity=".2"/>' +
      '<path d="M8.2 22.7h47.6" fill="none" stroke="#fff" stroke-opacity=".85" stroke-width="1.2" stroke-linecap="round"/>';
  }
  var FOLDER = folderBack() + folderFront();
  /* a thin white sheet for a folder that shows its contents */
  var SHEET = lin('fo-p', 0, 12, 0, 30, [[0, '#ffffff'], [1, '#e3e9f2']]);

  /* ================================================================ file pages (Windows 11: white page, folded corner, thin grey edge, a coloured tag for the type) */
  var PG_FILL = lin('pg', 0, 4, 0, 60, [[0, '#ffffff'], [1, '#eef1f6']]);
  var PG_FOLD = lin('pgf', 38, 4, 50, 18, [[0, '#ffffff'], [1, '#cfd5df']]);
  var PG_D = 'M12 8a4 4 0 0 1 4-4h22l14 14v38a4 4 0 0 1-4 4H16a4 4 0 0 1-4-4z';
  function pageBase() {
    return ground(32, 59.6, 18, 2.2) +
      '<path d="' + PG_D + '" fill="' + PG_FILL + '" stroke="#a2acbb" stroke-width="1.1"/>' +
      '<path d="M13.2 9a3 3 0 0 1 3-3.1H37" fill="none" stroke="#fff" stroke-width="1"/>' +
      '<path d="M38 4v10a4 4 0 0 0 4 4h10z" fill="' + PG_FOLD + '" stroke="#a2acbb" stroke-width="1.1" stroke-linejoin="round"/>';
  }
  function bars(y0, n, color, w, step) {
    var s = '';
    for (var i = 0; i < n; i++) s += '<path d="M18 ' + (y0 + i * (step || 6.5)) + 'h' + (i === n - 1 ? (w || 28) * 0.55 : (w || 28)) + '" stroke="' + color + '" stroke-width="2.6" stroke-linecap="round"/>';
    return s;
  }
  /* the type tag: a rounded colour band with the letters (a lighter top for the glass look) */
  function tag(id, c1, c2, text, w, y) {
    var x = 32 - w / 2, g = lin(id, 0, y, 0, y + 15, [[0, c1], [1, c2]]);
    return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="15" rx="3.5" fill="' + g + '"/>' +
      '<path d="M' + (x + 3.5) + ' ' + (y + 0.8) + 'h' + (w - 7) + '" stroke="#fff" stroke-opacity=".35" stroke-width="1" stroke-linecap="round"/>' +
      '<text x="32" y="' + (y + 11) + '" text-anchor="middle" ' + FONT + ' font-size="9.6" letter-spacing=".3" fill="#fff">' + text + '</text>';
  }
  /* 16-px page: the page outline plus one bold coloured block; Windows 11 reads these by colour */
  function pageSm(color1, color2, id, extra) {
    var g = lin(id, 0, 28, 0, 50, [[0, color1], [1, color2]]);
    return '<path d="' + PG_D + '" fill="' + PG_FILL + '" stroke="#8793a7" stroke-width="2.600"/>' +
      '<path d="M38 4v10a4 4 0 0 0 4 4h10z" fill="#d6dce6" stroke="#8793a7" stroke-width="2.600" stroke-linejoin="round"/>' +
      (id ? '<rect x="17" y="30" width="30" height="19" rx="3.5" fill="' + g + '"/>' : '') + (extra || '');
  }

  /* ================================================================ the glass Recycle Bin (translucent bin, blue recycling arrows, paper when full) */
  function recycleArrows(cx, cy, R, w, fill) {
    var P = [], i, s = '';
    for (i = 0; i < 3; i++) {
      var a = -Math.PI / 2 + i * 2 * Math.PI / 3;
      P.push([cx + R * Math.cos(a), cy + R * Math.sin(a)]);
    }
    function mix(p, q, t) { return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]; }
    function pt(p) { return f1(p[0]) + ' ' + f1(p[1]); }
    for (i = 0; i < 3; i++) {
      var prev = P[(i + 2) % 3], V = P[i], next = P[(i + 1) % 3];
      var S = mix(prev, V, 0.6), dIn = [V[0] - prev[0], V[1] - prev[1]], dOut = [next[0] - V[0], next[1] - V[1]];
      var lIn = Math.sqrt(dIn[0] * dIn[0] + dIn[1] * dIn[1]), lOut = Math.sqrt(dOut[0] * dOut[0] + dOut[1] * dOut[1]);
      var uIn = [dIn[0] / lIn, dIn[1] / lIn], uOut = [dOut[0] / lOut, dOut[1] / lOut];
      var r = w * 1.1;
      var Aa = [V[0] - uIn[0] * r, V[1] - uIn[1] * r], Bb = [V[0] + uOut[0] * r, V[1] + uOut[1] * r];
      var hl = w * 2.0, hw = w * 1.45;
      var tip = [V[0] + uOut[0] * lOut * 0.42, V[1] + uOut[1] * lOut * 0.42];
      var base = [tip[0] - uOut[0] * hl, tip[1] - uOut[1] * hl];
      var perp = [-uOut[1], uOut[0]];
      s += '<path d="M' + pt(S) + 'L' + pt(Aa) + 'Q' + pt(V) + ' ' + pt(Bb) + 'L' + pt(base) + '" fill="none" stroke="' + fill + '" stroke-width="' + w + '" stroke-linecap="round" stroke-linejoin="round"/>' +
        '<path d="M' + pt(tip) + 'L' + pt([base[0] + perp[0] * hw, base[1] + perp[1] * hw]) + 'L' + pt([base[0] - perp[0] * hw, base[1] - perp[1] * hw]) + 'z" fill="' + fill + '" stroke="' + fill + '" stroke-width=".7" stroke-linejoin="round"/>';
    }
    return s;
  }
  var RB_GLASS = lin('rb-gl', 11, 0, 53, 0, [[0, '#ffffff', 0.9], [0.1, '#e6f1fd', 0.6], [0.5, '#aecdf0', 0.46], [0.9, '#e6f1fd', 0.62], [1, '#ffffff', 0.92]]);
  var RB_TINT = lin('rb-tint', 0, 16, 0, 57, [[0, '#8fbbea', 0], [0.5, '#78aae3', 0.2], [1, '#3f7fd4', 0.56]]);
  var RB_EDGE = lin('rb-edge', 0, 14, 0, 57, [[0, '#ffffff', 1], [0.45, '#d6e7f9', 0.95], [1, '#6f9fd6', 0.95]]);
  var RB_WALL = lin('rb-wall', 0, 10, 0, 20, [[0, '#5f8fc4', 0.7], [1, '#b7d3ef', 0.45]]);
  var RB_ARROW = lin('rb-ar', 0, 24, 0, 48, [[0, '#4fb4ff'], [1, '#1763d4']]);
  var RB_BODY = 'M11 15L15.2 52.4A4.6 4.6 0 0 0 19.8 56.4H44.2A4.6 4.6 0 0 0 48.8 52.4L53 15A21 4.8 0 0 1 11 15z';
  function binGlass() {
    return ground(32, 58, 19, 2.2) +
      '<ellipse cx="32" cy="15" rx="21" ry="4.8" fill="' + RB_WALL + '"/>' +
      '<path d="M11 15A21 4.8 0 0 1 53 15" fill="none" stroke="#fff" stroke-opacity=".9" stroke-width="1.2"/>';
  }
  function binFront() {
    return '<path d="' + RB_BODY + '" fill="' + RB_GLASS + '"/>' +
      '<path d="' + RB_BODY + '" fill="' + RB_TINT + '"/>' +
      '<path d="M18.5 22.5l1.9 27M43.2 22.5l-1.4 27" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="2" stroke-linecap="round"/>' +
      '<path d="M26 22.2l.6 28M37.6 22.2l-.5 28" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="1" stroke-linecap="round"/>' +
      '<path d="' + RB_BODY + '" fill="none" stroke="#2f65b0" stroke-opacity=".5" stroke-width="2.4" stroke-linejoin="round"/>' +
      '<path d="' + RB_BODY + '" fill="none" stroke="' + RB_EDGE + '" stroke-width="1.5" stroke-linejoin="round"/>' +
      '<path d="M15.6 49.6h32.800l-.3 2.800A4.600 4.600 0 0 1 43.600 56.400H20.400A4.600 4.600 0 0 1 15.900 52.400z" fill="#2f6fc4" opacity=".24"/>' +
      '<path d="M12.2 17.2A19.6 3.6 0 0 0 51.8 17.2" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="1"/>' +
      '<path d="M17 54.2h30" stroke="#3b78c9" stroke-opacity=".28" stroke-width="1.4" stroke-linecap="round"/>' +
      recycleArrows(32, 38.4, 14.2, 2.8, RB_ARROW);
  }
  function paper(x, y, w, h, rot, rx, ry, tone) {
    return '<g transform="rotate(' + rot + ' ' + rx + ' ' + ry + ')"><rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="1.4" fill="' + tone + '" stroke="#aeb9c9" stroke-width=".9"/>' +
      '<path d="M' + (x + 3.5) + ' ' + (y + 6) + 'h' + (w - 7) + 'M' + (x + 3.5) + ' ' + (y + 10.5) + 'h' + (w - 7) + 'M' + (x + 3.5) + ' ' + (y + 15) + 'h' + (w - 12) + '" stroke="#c4ccd9" stroke-width="1.4" stroke-linecap="round"/></g>';
  }
  var BIN_EMPTY = binGlass() + binFront();
  var BIN_FULL = binGlass() +
    paper(15, 2.5, 19, 24, -14, 24, 14, '#ffffff') + paper(31, 1, 19.5, 24.5, 10, 41, 14, '#f4f7fb') + paper(23, 4.5, 18, 22, -2, 32, 16, '#fbfcfe') +
    binFront();
  /* 16 px: no ribs or inner light, a heavier arrow */
  var BIN_SM_BODY = 'M10.5 14.5L14.6 52A5 5 0 0 0 19.6 56.5H44.4A5 5 0 0 0 49.4 52L53.5 14.5A21.5 5.4 0 0 1 10.5 14.5z';
  function binSm(full) {
    return ground(32, 58, 19, 2) +
      '<ellipse cx="32" cy="14.5" rx="21.5" ry="5.4" fill="' + RB_WALL + '"/>' +
      (full ? paper(15, 1, 19, 22, -14, 24, 14, '#ffffff') + paper(30, -1, 20, 23, 11, 41, 14, '#f1f5fa') : '') +
      '<path d="' + BIN_SM_BODY + '" fill="' + RB_GLASS + '"/><path d="' + BIN_SM_BODY + '" fill="' + RB_TINT + '"/>' +
      '<path d="' + BIN_SM_BODY + '" fill="none" stroke="#5f93d0" stroke-width="2.4" stroke-linejoin="round"/>' +
      '<path d="M10.5 14.5A21.5 5.4 0 0 1 53.5 14.5" fill="none" stroke="#5f93d0" stroke-width="2.2"/>' +
      recycleArrows(32, 37.8, 13.4, 3.7, RB_ARROW);
  }

  /* ================================================================ gear (Settings) */
  function gearPath(cx, cy, ro, ri, n, bw, tw) {
    var d = '', i;
    function pt(r, ang) { return f1(cx + r * Math.cos(ang)) + ' ' + f1(cy + r * Math.sin(ang)); }
    for (i = 0; i < n; i++) {
      var a = -Math.PI / 2 + i * 2 * Math.PI / n;
      d += (i ? 'A' + ri + ' ' + ri + ' 0 0 1 ' + pt(ri, a - bw) : 'M' + pt(ri, a - bw)) + 'L' + pt(ro, a - tw) + 'L' + pt(ro, a + tw) + 'L' + pt(ri, a + bw);
    }
    return d + 'A' + ri + ' ' + ri + ' 0 0 1 ' + pt(ri, -Math.PI / 2 - bw) + 'z';
  }

  /* the little photo scene used by Photos, Gallery and the picture file: sky, sun, two hills */
  function scene(x, y, w, h, r, id) {
    var sky = lin(id + '-s', 0, y, 0, y + h, [[0, '#a6e0ff'], [1, '#4aa3f2']]);
    var cid = 'lab-w-' + id + '-c';
    DEFS += '<clipPath id="' + cid + '"><rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + r + '"/></clipPath>';
    var hill1 = lin(id + '-h1', 0, y + h * 0.5, 0, y + h, [[0, '#5fd0a2'], [1, '#2a9d6d']]);
    var hill2 = lin(id + '-h2', 0, y + h * 0.6, 0, y + h, [[0, '#2f9a73'], [1, '#17704f']]);
    return '<g clip-path="url(#' + cid + ')"><rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="' + sky + '"/>' +
      '<circle cx="' + f1(x + w * 0.72) + '" cy="' + f1(y + h * 0.3) + '" r="' + f1(h * 0.12) + '" fill="#fff6c4"/>' +
      '<path d="M' + x + ' ' + f1(y + h * 0.78) + 'L' + f1(x + w * 0.3) + ' ' + f1(y + h * 0.44) + 'L' + f1(x + w * 0.52) + ' ' + f1(y + h * 0.66) + 'L' + f1(x + w * 0.7) + ' ' + f1(y + h * 0.5) + 'L' + (x + w) + ' ' + f1(y + h * 0.8) + 'V' + (y + h) + 'H' + x + 'z" fill="' + hill1 + '"/>' +
      '<path d="M' + x + ' ' + f1(y + h * 0.9) + 'C' + f1(x + w * 0.25) + ' ' + f1(y + h * 0.7) + ' ' + f1(x + w * 0.45) + ' ' + f1(y + h * 0.76) + ' ' + f1(x + w * 0.62) + ' ' + f1(y + h * 0.88) + 'C' + f1(x + w * 0.78) + ' ' + f1(y + h * 0.78) + ' ' + f1(x + w * 0.92) + ' ' + f1(y + h * 0.8) + ' ' + (x + w) + ' ' + f1(y + h * 0.86) + 'V' + (y + h) + 'H' + x + 'z" fill="' + hill2 + '"/></g>';
  }

  var defs = {
    /* ================= app icons ================= */
    /* File Explorer: a yellow folder with a blue band across the bottom of the front */
    'app-finder': [A, (function () {
      var blue = lin('fe-u', 0, 41, 0, 54, [[0, '#62bcff'], [1, '#1b72dc']]);
      return folderBack() +
        '<rect x="9" y="15.4" width="46" height="14" rx="2" fill="' + SHEET + '" stroke="#cfd7e3" stroke-width=".8"/>' +
        '<path d="' + FO_FRONT_D + '" fill="' + FO_FRONT + '"/><path d="' + FO_FRONT_D + '" fill="' + FO_GLOSS + '"/>' +
        '<path d="M8.2 22.7h47.6" fill="none" stroke="#fff" stroke-opacity=".85" stroke-width="1.2" stroke-linecap="round"/>' +
        '<path d="M4 43.2Q32 38.6 60 43.2V50a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z" fill="' + blue + '"/>' +
        '<path d="M4.4 43.4Q32 38.9 59.6 43.4" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="1"/>';
    })()],
    /* Windows Terminal: a dark window in a light frame, a blue strip along the top, a white >_ at the lower left */
    'app-terminal': [A, (function () {
      var fr = lin('tm-f', 0, 7, 0, 56, [[0, '#fbfcfd'], [1, '#c3c8d1']]);
      var body = lin('tm-b', 0, 11, 0, 53, [[0, '#33363c'], [1, '#0f1013']]);
      var strip = lin('tm-t', 0, 10.5, 0, 19, [[0, '#6cc3ff'], [1, '#2c86e4']]);
      return ground(32, 58, 25, 2.2) +
        '<rect x="3" y="7" width="58" height="49" rx="8" fill="' + fr + '"/>' +
        '<rect x="3.5" y="7.5" width="57" height="48" rx="7.5" fill="none" stroke="#000" stroke-opacity=".22"/>' +
        '<rect x="6.5" y="10.5" width="51" height="42" rx="5" fill="' + body + '"/>' +
        '<path d="M6.5 15.5a5 5 0 0 1 5-5h40a5 5 0 0 1 5 5V19h-50z" fill="' + strip + '"/>' +
        '<path d="M7 19.4h50" stroke="#fff" stroke-opacity=".28"/>' +
        '<path d="M7 31.5Q32 26 57 33v-13.6H7z" fill="#fff" opacity=".05"/>' +
        '<path d="M15.5 27.5l10 7.2-10 7.2" fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/>' +
        '<path d="M30 43.6h14" fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round"/>';
    })(), (function () {
      return '<rect x="3" y="7" width="58" height="49" rx="8" fill="#d6dae1" stroke="#8d95a3" stroke-width="2"/><rect x="7" y="11" width="50" height="41" rx="4.5" fill="#15161a"/>' +
        '<path d="M7 15.5a4.5 4.5 0 0 1 4.5-4.5h41a4.5 4.5 0 0 1 4.5 4.5V20H7z" fill="#3f93ea"/>' +
        '<path d="M15 27.5l10.5 7.5L15 42.500" fill="none" stroke="#fff" stroke-width="4.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M30 44h15" fill="none" stroke="#fff" stroke-width="4.4" stroke-linecap="round"/>';
    })()],
    /* Codex: as on the Mac */
    'app-codex': ["0 0 1024 1024", "<defs><linearGradient id=\"lab-i-codex-bg\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"1\"><stop offset=\"0\" stop-color=\"#212123\"/><stop offset=\"1\" stop-color=\"#19191b\"/></linearGradient><linearGradient id=\"lab-i-codex-cl\" gradientUnits=\"userSpaceOnUse\" x1=\"0\" y1=\"110\" x2=\"0\" y2=\"895\"><stop offset=\"0\" stop-color=\"#c9a6f6\"/><stop offset=\".3\" stop-color=\"#9a92f8\"/><stop offset=\".52\" stop-color=\"#6074fb\"/><stop offset=\"1\" stop-color=\"#2d34f2\"/></linearGradient><radialGradient id=\"lab-i-codex-rim\" gradientUnits=\"userSpaceOnUse\" cx=\"516\" cy=\"525\" r=\"410\"><stop offset=\".6\" stop-color=\"#2326e0\" stop-opacity=\"0\"/><stop offset=\"1\" stop-color=\"#2326e0\" stop-opacity=\".85\"/></radialGradient><radialGradient id=\"lab-i-codex-hi\" gradientUnits=\"userSpaceOnUse\" cx=\"520\" cy=\"235\" r=\"280\"><stop offset=\"0\" stop-color=\"#f0c4ee\" stop-opacity=\".72\"/><stop offset=\"1\" stop-color=\"#f0c4ee\" stop-opacity=\"0\"/></radialGradient><radialGradient id=\"lab-i-codex-lo\" gradientUnits=\"userSpaceOnUse\" cx=\"500\" cy=\"740\" r=\"280\"><stop offset=\"0\" stop-color=\"#4a6cff\" stop-opacity=\".4\"/><stop offset=\"1\" stop-color=\"#4a6cff\" stop-opacity=\"0\"/></radialGradient><linearGradient id=\"lab-i-codex-sh\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"1\"><stop offset=\"0\" stop-color=\"#fff\" stop-opacity=\".07\"/><stop offset=\".25\" stop-color=\"#fff\" stop-opacity=\"0\"/></linearGradient><clipPath id=\"lab-i-codex-clip\"><circle cx=\"516\" cy=\"269\" r=\"164\"/><circle cx=\"706\" cy=\"346\" r=\"158\"/><circle cx=\"761\" cy=\"557\" r=\"160\"/><circle cx=\"631\" cy=\"722\" r=\"158\"/><circle cx=\"428\" cy=\"724\" r=\"162\"/><circle cx=\"282\" cy=\"581\" r=\"158\"/><circle cx=\"295\" cy=\"388\" r=\"160\"/><circle cx=\"516\" cy=\"505\" r=\"356\"/></clipPath></defs><rect x=\"8\" y=\"8\" width=\"1008\" height=\"1008\" rx=\"228\" fill=\"url(#lab-i-codex-bg)\"/><rect x=\"8\" y=\"8\" width=\"1008\" height=\"1008\" rx=\"228\" fill=\"url(#lab-i-codex-sh)\"/><g clip-path=\"url(#lab-i-codex-clip)\"><rect x=\"90\" y=\"90\" width=\"850\" height=\"850\" fill=\"url(#lab-i-codex-cl)\"/><rect x=\"90\" y=\"90\" width=\"850\" height=\"850\" fill=\"url(#lab-i-codex-rim)\"/><rect x=\"90\" y=\"90\" width=\"850\" height=\"450\" fill=\"url(#lab-i-codex-hi)\"/><rect x=\"90\" y=\"500\" width=\"850\" height=\"440\" fill=\"url(#lab-i-codex-lo)\"/></g><path d=\"M350 388L428 498L350 608\" fill=\"none\" stroke=\"#eef0ff\" stroke-opacity=\".88\" stroke-width=\"46\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M545 618H705\" fill=\"none\" stroke=\"#eef0ff\" stroke-opacity=\".88\" stroke-width=\"46\" stroke-linecap=\"round\"/>"],
    /* Visual Studio Code: the blue ribbon (no tile behind it, as on Windows) */
    'app-code': ['158 175 700 700', '<defs><linearGradient id="lab-w-vs-a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1f9cf0"/><stop offset="1" stop-color="#0a6fc3"/></linearGradient>' +
      '<linearGradient id="lab-w-vs-b" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#0a6cbd"/><stop offset="1" stop-color="#0963b4"/></linearGradient>' +
      '<linearGradient id="lab-w-vs-r" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#35aaff"/><stop offset="1" stop-color="#1b8ae6"/></linearGradient></defs>' +
      '<path d="M264 650L643 338L643 245L217 593Z" fill="url(#lab-w-vs-b)" stroke="url(#lab-w-vs-b)" stroke-width="63.5" stroke-linejoin="round"/>' +
      '<path d="M217 410L643 758L643 665L264 353Z" fill="url(#lab-w-vs-a)" stroke="url(#lab-w-vs-a)" stroke-width="63.5" stroke-linejoin="round"/>' +
      '<path d="M671 237L812 307L812 755L671 819Z" fill="url(#lab-w-vs-r)" stroke="url(#lab-w-vs-r)" stroke-width="38.1" stroke-linejoin="round"/>'],
    /* Notepad: a blue notepad with a white ruled page and binder rings along the top */
    'app-textedit': [A, (function () {
      var cover = lin('np-c', 0, 6, 0, 58, [[0, '#5cbaff'], [1, '#1566cc']]);
      var pg = lin('np-p', 0, 14, 0, 56, [[0, '#ffffff'], [1, '#e9eff8']]);
      var ring = lin('np-r', 0, 3, 0, 13, [[0, '#ffffff'], [1, '#c9d3e2']]);
      var rings = '';
      [18, 27, 36, 45].forEach(function (x) { rings += '<rect x="' + (x - 1.7) + '" y="3.2" width="3.4" height="10" rx="1.7" fill="' + ring + '" stroke="#42618f" stroke-width=".9"/>'; });
      return ground(32, 60.2, 20, 2) +
        '<rect x="9" y="6" width="46" height="52" rx="6" fill="' + cover + '"/>' +
        '<rect x="9.5" y="6.5" width="45" height="51" rx="5.5" fill="none" stroke="#fff" stroke-opacity=".35"/>' +
        '<rect x="13.5" y="14" width="37" height="41" rx="3" fill="' + pg + '"/>' +
        '<path d="M13.5 17a3 3 0 0 1 3-3h31a3 3 0 0 1 3 3v2h-37z" fill="#000" opacity=".07"/>' + rings +
        '<path d="M18.5 25h27M18.5 31.500h27M18.5 38h27M18.5 44.500h17" stroke="#a9b6cb" stroke-width="2.3" stroke-linecap="round"/>' +
        '<g transform="rotate(38 47 47)"><rect x="44" y="33" width="6" height="21" rx="1.4" fill="#f7ae2a"/><rect x="44" y="33" width="6" height="3.600" rx="1.4" fill="#e65a72"/><path d="M44 54h6l-3 5z" fill="#f3d6a6"/><path d="M47 59l-1.100-2.200h2.200z" fill="#3b3b3b"/><path d="M44.800 37v16" stroke="#fff" stroke-opacity=".5" stroke-width="1"/></g>';
    })(), (function () {
      return '<rect x="8" y="5" width="48" height="54" rx="6" fill="#2a7bdc" stroke="#1a5ab0" stroke-width="2"/><rect x="13" y="15" width="38" height="39" rx="3" fill="#fff"/>' +
        '<path d="M18 24h28M18 32h28M18 40h20" stroke="#8798b4" stroke-width="3.400" stroke-linecap="round"/>' +
        '<g fill="#f3f6fb" stroke="#35557f" stroke-width="1.400"><rect x="16" y="2.500" width="4.500" height="11" rx="2.200"/><rect x="29.700" y="2.500" width="4.500" height="11" rx="2.200"/><rect x="43.500" y="2.500" width="4.500" height="11" rx="2.200"/></g>';
    })()],
    'app-about': [A, (function () {
      var bg = lin('ab-b', 0, 4, 0, 60, [[0, '#fbf3df'], [1, '#ecdcb6']]);
      var bar = lin('ab-r', 0, 18, 0, 48, [[0, '#b46d00'], [1, '#7c4a00']]);
      return ground(32, 61, 22, 1.8) +
        '<rect x="4" y="4" width="56" height="56" rx="14" fill="' + bg + '"/>' +
        '<rect x="4.5" y="4.5" width="55" height="55" rx="13.5" fill="none" stroke="#000" stroke-opacity=".14"/>' +
        '<path d="M5 17.500a12.500 12.500 0 0 1 12.500-12.500h29a12.500 12.500 0 0 1 12.500 12.500" fill="none" stroke="#fff" stroke-opacity=".8"/>' +
        '<g fill="' + bar + '"><rect x="13.500" y="36" width="8" height="12" rx="2"/><rect x="25.500" y="27" width="8" height="21" rx="2"/><rect x="37.500" y="17" width="8" height="31" rx="2"/></g>';
    })()],
    /* Recycle Bin: a translucent glass bin with blue recycling arrows; the full one has paper in it */
    'app-trash-empty': [A, BIN_EMPTY, binSm(false)],
    'app-trash-full': [A, BIN_FULL, binSm(true)],
    'app-downloads': [A, (function () {
      var ar = lin('dl-a', 0, 28, 0, 48, [[0, '#4fb4ff'], [1, '#1668d6']]);
      return FOLDER +
        '<path d="M28.500 28.500h7V37h5.200L32 46 23.300 37h5.200z" fill="' + ar + '" stroke="#fff" stroke-opacity=".7" stroke-width="1" stroke-linejoin="round"/>';
    })()],

    /* ================= Start decor apps (toast only) and Terminal's tab icon ================= */
    'app-powershell': [A, (function () {
      var bg = lin('ps-b', 0, 8, 0, 56, [[0, '#3f8fe6'], [1, '#12439a']]);
      return ground(32, 58, 25, 2) +
        '<rect x="3.500" y="8" width="57" height="48" rx="8" fill="' + bg + '"/>' +
        '<rect x="4" y="8.500" width="56" height="47" rx="7.500" fill="none" stroke="#fff" stroke-opacity=".35"/>' +
        '<path d="M16 24.500l12.500 9.500L16 43.500" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>' +
        '<path d="M33 45h15" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"/>';
    })()],
    /* Settings: a blue-grey metal gear with a hole and a bevelled hub */
    'app-settings': [A, (function () {
      var gm = lin('st-g', 8, 6, 56, 58, [[0, '#cfdcf0'], [0.45, '#91a4c0'], [1, '#566a8a']]);
      var hub = lin('st-h', 0, 18, 0, 46, [[0, '#5d6c84'], [1, '#dbe4f1']]);
      return ground(32, 60.5, 22, 2) +
        '<path d="' + gearPath(32, 32, 29, 22, 8, 0.21, 0.135) + 'M32 21.500a10.500 10.500 0 1 0 .01 0z" fill="' + gm + '" fill-rule="evenodd" stroke="' + gm + '" stroke-width="1.200" stroke-linejoin="round"/>' +
        '<path d="' + gearPath(32, 32, 28.200, 22, 8, 0.21, 0.135) + '" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="1" stroke-linejoin="round" transform="translate(-.4 -.5)"/>' +
        '<circle cx="32" cy="32" r="10.500" fill="none" stroke="' + hub + '" stroke-width="1.800"/>';
    })(), (function () {
      return '<path d="' + gearPath(32, 32, 30, 22, 8, 0.23, 0.15) + 'M32 21a11 11 0 1 0 .01 0z" fill="#6c7b93" fill-rule="evenodd" stroke="#6c7b93" stroke-width="1.600" stroke-linejoin="round"/>';
    })()],
    'app-photos': [A, (function () {
      var bg = lin('ph-b', 0, 6, 0, 58, [[0, '#a8e1ff'], [1, '#2f86e6']]);
      var m1 = lin('ph-m1', 0, 28, 0, 58, [[0, '#6cb2fa'], [1, '#2f6fda']]);
      var m2 = lin('ph-m2', 0, 36, 0, 58, [[0, '#3f82ea'], [1, '#1b49b8']]);
      return ground(32, 60.8, 22, 1.8) +
        '<rect x="5" y="6" width="54" height="52" rx="12" fill="' + bg + '"/>' +
        '<defs><clipPath id="lab-w-ph-c"><rect x="5" y="6" width="54" height="52" rx="12"/></clipPath></defs>' +
        '<g clip-path="url(#lab-w-ph-c)"><circle cx="43.500" cy="21" r="6.400" fill="#fff8cc"/>' +
        '<path d="M5 48l14.500-17.500L32 44l9-8.500L59 52v6H5z" fill="' + m1 + '"/>' +
        '<path d="M5 54l11-8 8 5.500 9.500-8.500 8 6 17.500 7V58H5z" fill="' + m2 + '"/>' +
        '<path d="M5 6h54v14C42 16 20 14 5 22z" fill="#fff" opacity=".2"/></g>' +
        '<rect x="5.500" y="6.500" width="53" height="51" rx="11.500" fill="none" stroke="#fff" stroke-opacity=".5"/>';
    })()],
    'app-calc': [A, (function () {
      var body = lin('ca-b', 0, 3, 0, 61, [[0, '#707989'], [1, '#2e343f']]);
      var disp = lin('ca-d', 0, 8, 0, 21, [[0, '#d9eeff'], [1, '#84c3f2']]);
      var key = lin('ca-k', 0, 25, 0, 57, [[0, '#f6f8fb'], [1, '#c6cdd9']]);
      var op = lin('ca-o', 0, 25, 0, 57, [[0, '#aab4c4'], [1, '#6c788c']]);
      var eq = lin('ca-e', 0, 49.500, 0, 56, [[0, '#6bd0ff'], [1, '#1a8ad9']]);
      var keys = '', r, c, xs = [16, 27.500, 39], ys = [25.500, 33.500, 41.500];
      for (r = 0; r < 3; r++) for (c = 0; c < 3; c++) keys += '<rect x="' + xs[c] + '" y="' + ys[r] + '" width="9" height="6.500" rx="2" fill="' + (c === 2 ? op : key) + '"/>';
      return ground(32, 61.800, 20, 1.600) +
        '<rect x="11" y="3" width="42" height="57" rx="7.500" fill="' + body + '"/>' +
        '<rect x="11.500" y="3.500" width="41" height="56" rx="7" fill="none" stroke="#fff" stroke-opacity=".28"/>' +
        '<rect x="16" y="8" width="32" height="13" rx="3" fill="' + disp + '"/>' +
        '<path d="M16 10.500A2.500 2.500 0 0 1 18.500 8h27a2.500 2.500 0 0 1 2.500 2.500V13H16z" fill="#fff" opacity=".35"/>' +
        '<path d="M30 17.200h14" stroke="#3b6b96" stroke-width="2.200" stroke-linecap="round" opacity=".7"/>' +
        keys +
        '<rect x="16" y="49.500" width="20.500" height="6.500" rx="2" fill="' + key + '"/><rect x="39" y="49.500" width="9" height="6.500" rx="2" fill="' + eq + '"/>';
    })()],
    /* a browser of our own design (not the vendor logo): a blue sphere with flowing teal-green swells and a pale crest */
    'app-edge': [A, (function () {
      var sph = lin('ed-s', 10, 6, 54, 58, [[0, '#4fc3ff'], [0.55, '#1b86e6'], [1, '#0a4fb8']]);
      var w1 = lin('ed-w1', 0, 28, 0, 58, [[0, '#6fe3b6'], [1, '#17a37a']]);
      var w2 = lin('ed-w2', 0, 36, 0, 58, [[0, '#2fc8a2'], [1, '#0a7f86']]);
      var hl = rad('ed-h', 22, 16, 30, [[0, '#fff', 0.5], [1, '#fff', 0]]);
      return ground(32, 60.4, 20, 2) +
        '<circle cx="32" cy="32" r="27.500" fill="' + sph + '"/>' +
        '<defs><clipPath id="lab-w-ed-c"><circle cx="32" cy="32" r="27.500"/></clipPath></defs>' +
        '<g clip-path="url(#lab-w-ed-c)">' +
        '<path d="M2 36.500C10 30 18 31 25 35.500s14 5.500 20-.5c4-4 9-4.500 17-1.500V62H2z" fill="' + w1 + '"/>' +
        '<path d="M2 36.500C10 30 18 31 25 35.500s14 5.500 20-.5c4-4 9-4.500 17-1.500" fill="none" stroke="#e9fff5" stroke-opacity=".75" stroke-width="1.400"/>' +
        '<path d="M2 47C12 41 20 43 28 47.500s16 4 22-1.500c4-3.500 8-4 12-3V62H2z" fill="' + w2 + '"/>' +
        '<path d="M2 47C12 41 20 43 28 47.500s16 4 22-1.500c4-3.500 8-4 12-3" fill="none" stroke="#c8fff0" stroke-opacity=".6" stroke-width="1.200"/>' +
        '<path d="M10 22C16 11 28 6.500 39 9.500" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="2.600" stroke-linecap="round"/></g>' +
        '<circle cx="32" cy="32" r="27.500" fill="' + hl + '"/>' +
        '<circle cx="32" cy="32" r="27.200" fill="none" stroke="#fff" stroke-opacity=".35"/>';
    })()],
    /* Task Manager: a light window, a blue title band, a dark graph with a green line over a soft fill, two usage bars */
    'app-taskmgr': [A, (function () {
      var tb = lin('tm2-t', 0, 8, 0, 18, [[0, '#58b0f8'], [1, '#1b6fd2']]);
      var win = lin('tm2-w', 0, 8, 0, 56, [[0, '#ffffff'], [1, '#e8eef6']]);
      var gr = lin('tm2-g', 0, 22, 0, 43, [[0, '#26384a'], [1, '#141d28']]);
      var fill = lin('tm2-f', 0, 26, 0, 40, [[0, '#4be28a', 0.45], [1, '#4be28a', 0]]);
      return ground(32, 58.5, 25, 2) +
        '<rect x="5" y="8" width="54" height="48" rx="6" fill="' + win + '" stroke="#a6b4c7" stroke-width="1"/>' +
        '<path d="M5 14a6 6 0 0 1 6-6h42a6 6 0 0 1 6 6v4H5z" fill="' + tb + '"/>' +
        '<g fill="#fff" fill-opacity=".85"><circle cx="11" cy="13" r="1.200"/><circle cx="15" cy="13" r="1.200"/></g>' +
        '<rect x="10" y="22" width="44" height="21" rx="2.500" fill="' + gr + '"/>' +
        '<path d="M10 28.500h44M10 33.500h44M10 38.500h44M21 22v21M32 22v21M43 22v21" stroke="#fff" stroke-opacity=".08"/>' +
        '<path d="M11.500 39l7-6 5 3.500 6-10.500 5 7.500 4.500-4.500 7.500 2.500V43h-35z" fill="' + fill + '"/>' +
        '<path d="M11.500 39l7-6 5 3.500 6-10.500 5 7.500 4.500-4.500 7.500 2.500" fill="none" stroke="#5cf09a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
        '<rect x="10" y="47" width="44" height="3.800" rx="1.900" fill="#d3dce8"/><rect x="10" y="47" width="27" height="3.800" rx="1.900" fill="#2f86e8"/>';
    })()],
    /* the Run dialog (Win+X > 執行): a small window with a right arrow */
    'app-run': [A, (function () {
      var tb = lin('rn-t', 0, 12, 0, 22, [[0, '#4aa4f4'], [1, '#2275db']]);
      var win = lin('rn-w', 0, 12, 0, 52, [[0, '#ffffff'], [1, '#e9eff7']]);
      return ground(32, 54.600, 24, 2) +
        '<rect x="6" y="12" width="52" height="40" rx="5.500" fill="' + win + '" stroke="#a6b4c7" stroke-width="1"/>' +
        '<path d="M6 17.500a5.500 5.500 0 0 1 5.500-5.500h41A5.500 5.500 0 0 1 58 17.500V22H6z" fill="' + tb + '"/>' +
        '<rect x="12" y="28" width="40" height="11" rx="2.500" fill="#fff" stroke="#c0cad8"/><path d="M16 33.500h13" stroke="#7a8aa2" stroke-width="2.200" stroke-linecap="round"/>' +
        '<path d="M40 43l6.500 4.500L40 52" fill="none" stroke="#2275db" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>';
    })()],
    /* a laptop, big (Settings: the device card) */
    'dev-laptop': [A, (function () {
      var lid = lin('lp-l', 0, 9, 0, 40, [[0, '#454c5b'], [1, '#2a303b']]);
      var scr = lin('lp-s', 0, 12, 0, 37, [[0, '#7fcbff'], [0.6, '#2f8bef'], [1, '#1456c4']]);
      var base = lin('lp-b', 0, 42, 0, 51, [[0, '#d6dce6'], [1, '#9ba5b5']]);
      return ground(32, 52.400, 29, 2.200) +
        '<rect x="11" y="9" width="42" height="31" rx="3.500" fill="' + lid + '"/>' +
        '<rect x="13.500" y="11.500" width="37" height="26" rx="1.600" fill="' + scr + '"/>' +
        '<path d="M13.500 33l11-8.500 8.500 5 6.500-4.500 11 7.500v2a1.600 1.600 0 0 1-1.600 1.500H15.100A1.600 1.600 0 0 1 13.500 35z" fill="#fff" opacity=".22"/>' +
        '<path d="M13.500 11.500h37v8c-14-4-26-3-37 2.500z" fill="#fff" opacity=".16"/>' +
        '<path d="M4 42h56l-2.500 6.300a3.500 3.500 0 0 1-3.300 2.200H9.800a3.500 3.500 0 0 1-3.300-2.200z" fill="' + base + '"/>' +
        '<path d="M4.600 42.300h54.800" stroke="#fff" stroke-opacity=".8"/><rect x="26" y="42" width="12" height="2.600" rx="1.300" fill="#7e8899" opacity=".7"/>';
    })()],
    /* the offline picture of the Edge error page (currentColor strokes, so it follows light / dark) */
    'offline-art': ['0 0 64 64', '<g fill="none" stroke="currentColor" stroke-width="2.600" stroke-linecap="round" stroke-linejoin="round"><path d="M10 28.500a31 31 0 0 1 44 0M17 35.500a21 21 0 0 1 30 0M24.500 42.500a10.500 10.500 0 0 1 15 0"/><circle cx="32" cy="49.500" r="1.400" fill="currentColor"/><path d="M11 11l42 42"/></g>'],

    /* ================= file icons ================= */
    'folder': [A, FOLDER],
    /* open folder: a sheet shows behind a front panel that has swung open to the right */
    'folder-open': [A, (function () {
      var fr = lin('fo-o', 0, 26, 0, 54, [[0, '#ffe896'], [0.5, '#ffd150'], [1, '#fcbb26']]);
      var gl = lin('fo-og', 0, 26, 0, 38, [[0, '#fff', 0.5], [1, '#fff', 0]]);
      var d = 'M11.500 29a3.200 3.200 0 0 1 3.100-3H58a3 3 0 0 1 2.900 3.800l-5.200 21.700a4 4 0 0 1-3.900 3H8a4 4 0 0 1-3.900-4.900z';
      return folderBack() +
        '<rect x="10" y="13" width="41" height="26" rx="2" fill="' + SHEET + '" stroke="#cdd5e1" stroke-width=".9"/>' +
        '<path d="M15 20h28M15 25h28" stroke="#d4dae4" stroke-width="1.800" stroke-linecap="round"/>' +
        '<path d="' + d + '" fill="' + fr + '"/><path d="' + d + '" fill="' + gl + '"/>' +
        '<path d="M15 26.800h42" stroke="#fff" stroke-opacity=".85" stroke-width="1.200" stroke-linecap="round"/>';
    })()],
    /* zip folder: the folder with a zipper down the middle of the front */
    'zip': [A, (function () {
      var strip = lin('zp-s', 0, 22, 0, 54, [[0, '#ffffff'], [1, '#c4ccd8']]);
      var pull = lin('zp-p', 0, 42, 0, 53, [[0, '#a9b2c1'], [1, '#6a7587']]);
      var teeth = '', i;
      for (i = 0; i < 6; i++) teeth += '<rect x="' + (i % 2 ? 32 : 28.600) + '" y="' + (23.500 + i * 3.600) + '" width="3.400" height="2.200" rx=".5" fill="#7b8698"/>';
      return FOLDER +
        '<rect x="27.500" y="22.500" width="9" height="22.500" fill="' + strip + '" stroke="#8d97a8" stroke-width=".8"/>' + teeth +
        '<rect x="28" y="42" width="8" height="10.500" rx="2.500" fill="' + pull + '" stroke="#5e6879" stroke-width=".8"/><rect x="30.300" y="45" width="3.400" height="4.200" rx="1.500" fill="#e8edf4"/>';
    })(), (function () {
      return folderBack() + folderFront() + '<rect x="27" y="22" width="10" height="32" fill="#fff" stroke="#6a7587" stroke-width="2.200"/><rect x="26" y="40" width="12" height="13" rx="3" fill="#5d6779"/>';
    })()],
    'doc': [A, pageBase() + bars(25, 4, '#b3bbc8') , pageSm('#aab4c3', '#aab4c3', '', '<path d="M18 26h28M18 34h28M18 42h18" stroke="#8c97a8" stroke-width="3.600" stroke-linecap="round"/>')],
    'txt': [A, pageBase() + bars(24, 5, '#b3bbc8', 28, 6.200), pageSm('#aab4c3', '#aab4c3', '', '<path d="M18 26h28M18 34h28M18 42h18" stroke="#8c97a8" stroke-width="3.600" stroke-linecap="round"/>')],
    'md': [A, pageBase() + '<path d="M18 24.500h13" stroke="#6c7c93" stroke-width="3.400" stroke-linecap="round"/><path d="M18 31.500h28M18 36.500h20" stroke="#b3bbc8" stroke-width="2.400" stroke-linecap="round"/>' + tag('md-t', '#6d7f98', '#3e4c60', 'MD', 28, 40.500), pageSm('#6d7f98', '#3e4c60', 'md-s', '<path d="M18 21h14" stroke="#7a8aa0" stroke-width="3.400" stroke-linecap="round"/>')],
    'csv': [A, pageBase() + (function () {
      var hd = lin('cv-h', 0, 22, 0, 27, [[0, '#35b872'], [1, '#1b8f50']]);
      return '<rect x="18" y="22" width="28" height="15" rx="2" fill="#fff" stroke="#9fd3b6" stroke-width="1"/><path d="M20 22h24a2 2 0 0 1 2 2v2.500H18V24a2 2 0 0 1 2-2z" fill="' + hd + '"/>' +
        '<path d="M18 31.500h28M18 36.500v0M27.300 22v15M36.700 22v15M18 32h28" stroke="#a9d9bf" stroke-width="1"/>';
    })() + tag('cv-t', '#35b872', '#157f45', 'CSV', 32, 40.500), pageSm('#35b872', '#157f45', 'cv-s', '<path d="M17 38h30M32 30v19" stroke="#fff" stroke-opacity=".7" stroke-width="2"/>')],
    'pdf': [A, pageBase() + '<path d="M18 24.500h13" stroke="#e0554a" stroke-width="3.400" stroke-linecap="round"/><path d="M18 31.500h28M18 36.500h20" stroke="#e8b2ad" stroke-width="2.400" stroke-linecap="round"/>' + tag('pd-t', '#f1665a', '#c52a1e', 'PDF', 32, 40.500), pageSm('#f1665a', '#c52a1e', 'pd-s', '<path d="M18 21h14" stroke="#e0554a" stroke-width="3.400" stroke-linecap="round"/>')],
    'docx': [A, pageBase() + '<path d="M18 24.500h13" stroke="#2f78e0" stroke-width="3.400" stroke-linecap="round"/><path d="M18 31.500h28M18 36.500h20" stroke="#a9c8f2" stroke-width="2.400" stroke-linecap="round"/>' + tag('dx-t', '#4a95f0', '#1b5ac2', 'DOCX', 36, 40.500), pageSm('#4a95f0', '#1b5ac2', 'dx-s', '<path d="M18 21h14" stroke="#2f78e0" stroke-width="3.400" stroke-linecap="round"/>')],
    /* an application (.exe): a small window with a blue title bar */
    'app': [A, (function () {
      var tb = lin('ap-t', 0, 9, 0, 21, [[0, '#58b2fa'], [1, '#2073d9']]);
      var win = lin('ap-w', 0, 9, 0, 55, [[0, '#ffffff'], [1, '#e8eef6']]);
      return ground(32, 57.500, 24, 2) +
        '<rect x="6" y="9" width="52" height="46" rx="6" fill="' + win + '" stroke="#a9b6c8" stroke-width="1"/>' +
        '<path d="M6 15a6 6 0 0 1 6-6h40a6 6 0 0 1 6 6v6H6z" fill="' + tb + '"/>' +
        '<g fill="#fff" fill-opacity=".9"><circle cx="12.500" cy="15" r="1.400"/><circle cx="17.500" cy="15" r="1.400"/></g>' +
        '<rect x="12" y="27" width="18" height="21" rx="3" fill="#cfdcf0"/><rect x="12" y="27" width="18" height="21" rx="3" fill="none" stroke="#9db3d4" stroke-width=".8"/>' +
        '<path d="M36 30h16M36 37h16M36 44h10" stroke="#b3bdcc" stroke-width="2.600" stroke-linecap="round"/>';
    })(), '<rect x="5" y="9" width="54" height="46" rx="6" fill="#fff" stroke="#8f9db3" stroke-width="2"/><path d="M5 15a6 6 0 0 1 6-6h42a6 6 0 0 1 6 6v8H5z" fill="#2b7fe0"/><rect x="11" y="30" width="19" height="18" rx="3" fill="#bfd0ea"/><path d="M36 33h17M36 41h17" stroke="#8f9db3" stroke-width="3.400" stroke-linecap="round"/>'],
    /* a picture file (jpg, png...): a small photo with a white border, a sun and two hills */
    'image': [A, (function () {
      return ground(32, 57.500, 24, 2) +
        '<g transform="rotate(-3 32 32)"><rect x="6" y="10" width="52" height="42" rx="5" fill="#fff" stroke="#b9c3d1" stroke-width="1"/>' +
        scene(9.500, 13.500, 45, 35, 2.800, 'im') +
        '<rect x="9.500" y="13.500" width="45" height="35" rx="2.800" fill="none" stroke="#000" stroke-opacity=".12"/></g>';
    })(), '<rect x="4" y="9" width="56" height="46" rx="6" fill="#fff" stroke="#8f9db3" stroke-width="2"/>' + scene(9, 14, 46, 36, 3, 'im2')],
    /* a source or script file (py, js, json, html, ps1...): a page with indented lines and a teal </> tag */
    'code': [A, pageBase() + '<path d="M18 24.500h12M22 30.500h16M22 36h9" stroke="#8fd0cb" stroke-width="2.400" stroke-linecap="round"/>' + tag('co-t', '#37b9b0', '#137a75', '&lt;/&gt;', 30, 40.500), pageSm('#37b9b0', '#137a75', 'co-s', '<path d="M18 21h12" stroke="#3aa8a0" stroke-width="3.400" stroke-linecap="round"/>')],
    'unknown': [A, pageBase(), pageSm('#aab4c3', '#aab4c3', '', '')],

    /* ================= computer places (Explorer navigation) ================= */
    'this-pc': [A, (function () {
      var bez = lin('pc-b', 0, 7, 0, 45, [[0, '#4d5565'], [1, '#262b35']]);
      var scr = lin('pc-s', 0, 11, 0, 41, [[0, '#8ad2ff'], [0.55, '#2f8cf0'], [1, '#1252c2']]);
      var stand = lin('pc-n', 0, 45, 0, 51, [[0, '#b9c1cd'], [1, '#8a94a4']]);
      var foot = lin('pc-f', 0, 50, 0, 55, [[0, '#d9dee6'], [1, '#aab3c0']]);
      return ground(32, 55.600, 22, 1.900) +
        '<rect x="5" y="7" width="54" height="38" rx="4.500" fill="' + bez + '"/>' +
        '<rect x="8" y="10" width="48" height="32" rx="2" fill="' + scr + '"/>' +
        '<path d="M8 33.500c8-9 16-12 27-6 8 4.200 14 3.600 21-1.500V40a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2z" fill="#fff" opacity=".2"/>' +
        '<path d="M8 12a2 2 0 0 1 2-2h44a2 2 0 0 1 2 2v6C40 14.500 22 14 8 22z" fill="#fff" opacity=".16"/>' +
        '<path d="M26 45h12l1.500 6h-15z" fill="' + stand + '"/><rect x="17" y="50.500" width="30" height="4.200" rx="2.100" fill="' + foot + '"/>' +
        '<rect x="5.400" y="7.400" width="53.200" height="37.200" rx="4.100" fill="none" stroke="#fff" stroke-opacity=".22"/>';
    })(), '<rect x="4" y="8" width="56" height="38" rx="5" fill="#3b4352" stroke="#2b3240" stroke-width="1"/><rect x="8" y="12" width="48" height="30" rx="2" fill="#3f93ee"/><path d="M26 46h12l2 6H24z" fill="#8f99a8"/><rect x="16" y="51" width="32" height="5" rx="2.500" fill="#aab3c0"/>'],
    /* a local disk: a flat drive with a blue Windows-style emblem, a status light and a slot */
    'drive-c': [A, (function () {
      var top = lin('dr-t', 0, 24, 0, 38, [[0, '#f1f4f8'], [1, '#d3d9e2']]);
      var front = lin('dr-f', 0, 37, 0, 54, [[0, '#cfd6e0'], [1, '#98a2b2']]);
      var em = lin('dr-e', 0, 41, 0, 50, [[0, '#62bdff'], [1, '#1b73dc']]);
      return ground(32, 55.800, 26, 2.200) +
        '<path d="M12.500 22h39a4 4 0 0 1 3.700 2.500L60 37v12a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V37l4.800-12.500A4 4 0 0 1 12.500 22z" fill="' + top + '" stroke="#8f99a9" stroke-width="1"/>' +
        '<path d="M4.500 37h55V49a4.500 4.500 0 0 1-4.500 4.500H9A4.500 4.500 0 0 1 4.500 49z" fill="' + front + '"/>' +
        '<path d="M4.500 37.300h55" stroke="#fff" stroke-opacity=".7"/>' +
        '<g fill="' + em + '"><rect x="11" y="41.500" width="4.200" height="3.800" rx=".6"/><rect x="16.200" y="41.500" width="4.200" height="3.800" rx=".6"/><rect x="11" y="46.300" width="4.200" height="3.800" rx=".6"/><rect x="16.200" y="46.300" width="4.200" height="3.800" rx=".6"/></g>' +
        '<rect x="38" y="43.500" width="15" height="4.200" rx="2.100" fill="#6a7587" opacity=".75"/><circle cx="34" cy="45.600" r="1.700" fill="#44d17a"/>';
    })()],
    'network': [A, (function () {
      var sph = lin('nw-s', 8, 6, 56, 58, [[0, '#7fd0ff'], [0.55, '#2c88ee'], [1, '#0f4fb8']]);
      var hl = rad('nw-h', 22, 18, 26, [[0, '#fff', 0.5], [1, '#fff', 0]]);
      return ground(32, 58.600, 20, 2) +
        '<circle cx="32" cy="32" r="25.500" fill="' + sph + '"/>' +
        '<g fill="none" stroke="#fff" stroke-opacity=".62" stroke-width="1.500"><ellipse cx="32" cy="32" rx="10.500" ry="25.500"/><path d="M6.500 32h51M10 20h44M10 44h44"/></g>' +
        '<path d="M14 24c4-3 7-2 9 1s6 3 8 0 5-3 4 1-4 6-9 6-8-2-12-8z" fill="#fff" opacity=".18"/>' +
        '<circle cx="32" cy="32" r="25.500" fill="' + hl + '"/><circle cx="32" cy="32" r="25.200" fill="none" stroke="#fff" stroke-opacity=".35"/>';
    })()],
    'home': [A, (function () {
      var roof = lin('hm-r', 0, 6, 0, 32, [[0, '#59b2ff'], [1, '#1f73dc']]);
      var body = lin('hm-b', 0, 24, 0, 56, [[0, '#f2f5fa'], [1, '#cfd8e6']]);
      var door = lin('hm-d', 0, 36, 0, 56, [[0, '#4a9bf0'], [1, '#2368c9']]);
      return ground(32, 57.500, 22, 2) +
        '<path d="M32 9L9 28.500v22a4.500 4.500 0 0 0 4.500 4.500h37a4.500 4.500 0 0 0 4.500-4.500v-22z" fill="' + body + '" stroke="#a9b6c9" stroke-width="1"/>' +
        '<path d="M32 4.500L3.500 29l3.700 4.300L32 12l24.800 21.300 3.700-4.300z" fill="' + roof + '" stroke="#1a5fbf" stroke-opacity=".6" stroke-width=".8" stroke-linejoin="round"/>' +
        '<path d="M32 6L6 28.200" stroke="#fff" stroke-opacity=".5" stroke-width="1.200" stroke-linecap="round"/>' +
        '<rect x="25.500" y="36" width="13" height="19" rx="2.500" fill="' + door + '"/><circle cx="35.500" cy="46" r="1" fill="#fff" opacity=".85"/>';
    })()],
    'gallery': [A, (function () {
      return ground(32, 57.600, 24, 2) +
        '<g transform="rotate(-6 32 32)"><rect x="8" y="9" width="40" height="32" rx="4.500" fill="#fff" stroke="#b9c3d1" stroke-width="1"/>' + scene(10.500, 11.500, 35, 27, 2.800, 'ga1') + '</g>' +
        '<g transform="rotate(4 32 32)"><rect x="14" y="17" width="44" height="36" rx="5" fill="#fff" stroke="#b9c3d1" stroke-width="1"/>' + scene(16.800, 19.800, 38.400, 30.400, 3, 'ga2') + '</g>';
    })()],
    'pin': [A, (function () {
      var hd = lin('pn-h', 0, 8, 0, 32, [[0, '#a6afbd'], [1, '#6f7886']]);
      return '<path d="M24 8h16l-2 14c4 2.400 7 6 7 10H19c0-4 3-7.600 7-10z" fill="' + hd + '"/><path d="M26 10h12" stroke="#fff" stroke-opacity=".45" stroke-width="1.200" stroke-linecap="round"/><path d="M32 32v23" stroke="#6b7480" stroke-width="3" stroke-linecap="round"/>';
    })()]
  };


  /* ================================================================ the nav-pane / tile glyphs of File Explorer (finder.js registers its own flat ones; the name that is here first wins) */
  defs['fd-n-desktop'] = [A, (function () {
    var scr = lin('nd-s', 0, 9, 0, 45, [[0, '#6fc3ff'], [1, '#1f72dc']]);
    var inner = lin('nd-i', 0, 14, 0, 42, [[0, '#d6efff'], [1, '#8cc8f6']]);
    return '<rect x="5" y="9" width="54" height="37" rx="6" fill="' + scr + '"/><rect x="9.500" y="13.500" width="45" height="28" rx="2.500" fill="' + inner + '"/>' +
      '<path d="M5 15a6 6 0 0 1 6-6h42a6 6 0 0 1 6 6v1H5z" fill="#fff" opacity=".25"/><path d="M24 50h16" stroke="#7b8799" stroke-width="3.400" stroke-linecap="round"/>';
  })()];
  defs['fd-n-downloads'] = [A, (function () {
    var g = lin('ndl-g', 0, 6, 0, 56, [[0, '#4fd68d'], [1, '#12924f']]);
    return '<path d="M26 8h12v22h8.500L32 46 17.500 30H26z" fill="' + g + '" stroke="#0d7a42" stroke-opacity=".5" stroke-linejoin="round"/><path d="M10 54h44" stroke="' + g + '" stroke-width="6.500" stroke-linecap="round"/>' +
      '<path d="M28 10v20" stroke="#fff" stroke-opacity=".4" stroke-width="1.400" stroke-linecap="round"/>';
  })()];
  defs['fd-n-documents'] = [A, (function () {
    var g = lin('ndc-g', 0, 4, 0, 60, [[0, '#ffffff'], [1, '#dde4ee']]);
    return '<path d="M13 8a4 4 0 0 1 4-4h20l14 14v38a4 4 0 0 1-4 4H17a4 4 0 0 1-4-4z" fill="' + g + '" stroke="#8793a6" stroke-width="2"/>' +
      '<path d="M37 4v10a4 4 0 0 0 4 4h10z" fill="#cfd8e6" stroke="#8793a6" stroke-width="2" stroke-linejoin="round"/>' +
      '<path d="M20 28h24M20 36h24M20 44h14" stroke="#5f86bd" stroke-width="3.400" stroke-linecap="round"/>';
  })()];
  defs['fd-n-pictures'] = [A, '<rect x="5" y="9" width="54" height="46" rx="7" fill="#fff"/>' + scene(7, 11, 50, 42, 5.500, 'np') + '<rect x="7" y="11" width="50" height="42" rx="5.500" fill="none" stroke="#1d5eb8" stroke-opacity=".4"/>'];
  defs['fd-n-music'] = [A, (function () {
    var g = lin('nm-g', 0, 6, 0, 58, [[0, '#ff8a4c'], [1, '#e0363a']]);
    return '<path d="M24 46V14l28-6v34" fill="none" stroke="' + g + '" stroke-width="5.500" stroke-linejoin="round" stroke-linecap="round"/><ellipse cx="17" cy="47" rx="9" ry="7.500" fill="' + g + '"/><ellipse cx="45" cy="42" rx="9" ry="7.500" fill="' + g + '"/>' +
      '<path d="M24 20l28-6" stroke="' + g + '" stroke-width="5.500" stroke-linecap="round"/>';
  })()];
  defs['fd-n-videos'] = [A, (function () {
    var g = lin('nv-g', 0, 8, 0, 56, [[0, '#a77df0'], [1, '#6a3fcb']]);
    return '<rect x="5" y="10" width="54" height="44" rx="9" fill="' + g + '"/><path d="M5 19a9 9 0 0 1 9-9h36a9 9 0 0 1 9 9v1H5z" fill="#fff" opacity=".2"/><path d="M26 22l16 10-16 10z" fill="#fff" stroke="#fff" stroke-width="3" stroke-linejoin="round"/>';
  })()];

  /* ---- UI glyphs (24 box, currentColor, 1.5 stroke) ---- */
  var G = '0 0 24 24';
  function g(inner, w) { return [G, '<g fill="none" stroke="currentColor" stroke-width="' + (w || 1.5) + '" stroke-linecap="round" stroke-linejoin="round">' + inner + '</g>']; }
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
    'apps': '<rect x="4.5" y="4.5" width="6" height="6" rx="1"/><rect x="13.5" y="4.5" width="6" height="6" rx="1"/><rect x="4.5" y="13.5" width="6" height="6" rx="1"/><rect x="13.5" y="13.5" width="6" height="6" rx="1"/>',
    'desktop': '<rect x="3.5" y="5" width="17" height="11" rx="1.6"/><path d="M9 20h6M12 16v4"/>',
    'doc-sm': '<path d="M7 3.5h7l4 4v12a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 19.5v-14A1.5 1.5 0 0 1 7.5 4z"/><path d="M14 3.5v4h4"/>',
    'download': '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>',
    'list-view': '<path d="M8 6.5h12M8 12h12M8 17.5h12M4 6.5h.5M4 12h.5M4 17.5h.5"/>',
    'columns-view': '<rect x="4.5" y="5" width="15" height="14" rx="1.5"/><path d="M9.5 5v14M14.5 5v14"/>',
    'gallery-view': '<rect x="4.5" y="5" width="15" height="9" rx="1.2"/><path d="M5 17.5h2.4M9.4 17.5h2.4M13.8 17.5h2.4"/>',
    'icon-view': '<rect x="4.5" y="4.5" width="6" height="6" rx="1"/><rect x="13.5" y="4.5" width="6" height="6" rx="1"/><rect x="4.5" y="13.5" width="6" height="6" rx="1"/><rect x="13.5" y="13.5" width="6" height="6" rx="1"/>',
    'share': '<path d="M12 4v10M8 8l4-4 4 4M6 12v6.5a1.5 1.5 0 0 0 1.5 1.5h9a1.5 1.5 0 0 0 1.5-1.5V12"/>',
    'tag': '<path d="M4 12.5V5.5a1.5 1.5 0 0 1 1.5-1.5h7l7.5 7.5-8.5 8.5z"/><circle cx="8.5" cy="8.5" r="1"/>',
    'gear': '<path d="' + gearPath(12, 12, 9.4, 7.3, 8, 0.27, 0.18) + '"/><circle cx="12" cy="12" r="2.8"/>',
    'info': '<circle cx="12" cy="12" r="8"/><path d="M12 11v5M12 8v.2"/>',
    'wifi': '<path d="M3.5 9.5a12 12 0 0 1 17 0M6.5 12.8a8 8 0 0 1 11 0M9.4 16a4 4 0 0 1 5.2 0"/><circle cx="12" cy="19" r=".8" fill="currentColor"/>',
    'battery': '<rect x="3" y="8" width="16" height="8" rx="2.2"/><path d="M21 11v2"/><rect x="5" y="10" width="9" height="4" rx="1" fill="currentColor" stroke="none"/>',
    'control-center': '<rect x="4" y="5" width="16" height="5" rx="2.5"/><circle cx="16.5" cy="7.5" r="1.4" fill="currentColor" stroke="none"/><rect x="4" y="14" width="16" height="5" rx="2.5"/><circle cx="7.5" cy="16.5" r="1.4" fill="currentColor" stroke="none"/>',
    'ime': '<rect x="3.5" y="6" width="17" height="12" rx="2"/><path d="M7 14.5l2.2-5 2.2 5M7.8 13h2.8"/><path d="M14.5 10h3M16 10v4.5"/>',
    'sort-asc': '<path d="M6 14l6-6 6 6"/>',
    'sort-desc': '<path d="M6 10l6 6 6-6"/>',
    'mark': '<path d="M6 17.5v-3M12 17.5v-7M18 17.5V5.5" stroke-width="3.2" stroke-linecap="butt"/><path d="M3.5 21h17" stroke-width="1.5" stroke-linecap="round"/>',

    /* Round 5 (system features and the new apps): quick settings, power, Settings navigation, Task Manager, Photos, Edge, Calculator */
    'minus': '<path d="M5 12h14"/>',
    'sun': '<circle cx="12" cy="12" r="3.6"/><path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6 6l1.4 1.4M16.6 16.6L18 18M18 6l-1.4 1.4M7.4 16.6L6 18"/>',
    'moon': '<path d="M19.500 14.500A8 8 0 1 1 9.500 4.500a6.500 6.500 0 0 0 10 10z"/>',
    'bluetooth': '<path d="M6.500 8l11 8-5.500 4.500v-17L17.500 8l-11 8"/>',
    'airplane': '<path d="M12 3.500c.9 0 1.500.9 1.500 2v4.200l7 4.300v2l-7-2v3.700l2 1.500V20l-3.500-1-3.500 1v-1.800l2-1.500v-3.700l-7 2v-2l7-4.300V5.500c0-1.100.6-2 1.500-2z"/>',
    'battery-saver': '<rect x="3" y="8" width="16" height="8" rx="2.200"/><path d="M21 11v2"/><path d="M8.500 12.200c1.500-2 3.500-2 5-.2M8.500 12.200c1.200 1.600 3 1.800 5-.2"/>',
    'accessibility': '<circle cx="12" cy="12" r="8.500"/><circle cx="12" cy="7.800" r="1.100" fill="currentColor"/><path d="M7.800 10.600h8.400M12 10.600v3.400M9.600 17.600l2.400-3.600 2.400 3.600"/>',
    'hamburger': '<path d="M4 7h16M4 12h16M4 17h16"/>',
    'history': '<path d="M4.800 12a7.200 7.200 0 1 0 2.300-5.300M4.600 5v3.800h3.800M12 8.200V12l2.600 1.600"/>',
    'backspace': '<path d="M9 6h10a1.500 1.500 0 0 1 1.500 1.500v9A1.500 1.500 0 0 1 19 18H9l-5-6z"/><path d="M12.500 9.500l5 5M17.500 9.500l-5 5"/>',
    'lock': '<rect x="6" y="10.500" width="12" height="9" rx="2"/><path d="M8.500 10.500V8a3.500 3.500 0 0 1 7 0v2.500"/>',
    'signout': '<path d="M10 5H6.500A1.500 1.500 0 0 0 5 6.500v11A1.500 1.500 0 0 0 6.500 19H10M14 8l4 4-4 4M18 12H9"/>',
    'bell': '<path d="M6.500 16.500h11l-1.400-2V10a4.100 4.100 0 0 0-8.200 0v4.500zM10 19a2 2 0 0 0 4 0"/>',
    'star': '<path d="M12 4l2.400 5 5.400.7-4 3.800 1 5.400-4.800-2.700-4.800 2.700 1-5.400-4-3.800 5.400-.7z"/>',
    'globe': '<circle cx="12" cy="12" r="8.500"/><path d="M3.500 12h17M12 3.500c-3.200 3.200-3.200 13.800 0 17M12 3.500c3.200 3.200 3.200 13.800 0 17"/>',
    'shield': '<path d="M12 3.500l7 2.500v5.500c0 4.200-3 7.500-7 9-4-1.500-7-4.800-7-9V6z"/>',
    'gamepad': '<path d="M7.500 8h9a4 4 0 0 1 4 4.300l-.7 3.200a2.400 2.400 0 0 1-4 1.300L14 15H10l-2.300 1.800a2.400 2.400 0 0 1-4-1.300L3 12.300A4 4 0 0 1 7.500 8z"/><path d="M8 10.500v3M6.500 12h3M15.500 11h.1M17.500 13h.1"/>',
    'pulse': '<path d="M3 13h4l2.500-6 4 11 2.500-5H21"/>',
    'rocket': '<path d="M12 3c3 2 4.500 5 4.500 8.500L12 16l-4.500-4.500C7.500 8 9 5 12 3z"/><path d="M9.500 18l-1.500 3M14.500 18l1.500 3M12 9.500v.1"/>',
    'table': '<rect x="4.500" y="5" width="15" height="14" rx="1.800"/><path d="M4.500 10h15M10 10v9"/>',
    'rotate': '<path d="M19 12a7 7 0 1 1-2.200-5.100M19.500 4.500V9H15"/>',
    'zoom-in': '<circle cx="10.500" cy="10.500" r="5.500"/><path d="M15 15l5 5M8 10.500h5M10.500 8v5"/>',
    'zoom-out': '<circle cx="10.500" cy="10.500" r="5.500"/><path d="M15 15l5 5M8 10.500h5"/>',
    'fit': '<path d="M4.500 9V5.500H8M19.500 9V5.500H16M4.500 15v3.500H8M19.500 15v3.500H16"/>',
    'back-arrow': '<path d="M19 12H5.500M11 6l-6 6 6 6"/>',
    'run-arrow': '<path d="M5 12h13M13 6l6 6-6 6"/>',
    'calc-sqrt': '<path d="M4 13l2.500-1.500L9.500 18 14 5h6"/>',
    'edge-more': '<circle cx="5.500" cy="12" r="1.200" fill="currentColor"/><circle cx="12" cy="12" r="1.200" fill="currentColor"/><circle cx="18.500" cy="12" r="1.200" fill="currentColor"/>',
    'sleep': '<path d="M18.500 14.200A7 7 0 1 1 9.800 5.500a5.800 5.800 0 0 0 8.700 8.700z"/><path d="M14.500 4.500h3.500l-3.500 4h3.500"/>',
    'restart': '<path d="M19 12a7 7 0 1 1-2.200-5.100M19.500 4.500V9H15"/>',

    /* Windows 11 taskbar / tray / Start */
    'search-tb': '<circle cx="10.2" cy="10.2" r="5.8"/><path d="M14.6 14.6l5.4 5.4"/>',
    'task-view': '<rect x="3.5" y="7" width="12.5" height="9.5" rx="2" fill="currentColor" fill-opacity=".12"/><path d="M8 7V6a2 2 0 0 1 2-2h8.5a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2H16"/>',
    'tray-chevron': '<path d="M6 14.5l6-6 6 6"/>',
    'speaker': '<path d="M4 9.5h3.2L12 5.8v12.4l-4.8-3.7H4z" fill="currentColor"/><path d="M15.3 9a4.2 4.2 0 0 1 0 6M17.8 6.6a7.6 7.6 0 0 1 0 10.8"/>',
    'power': '<path d="M12 3.8v7.4"/><path d="M7.2 6.6a7.2 7.2 0 1 0 9.6 0"/>',
    'user': '<circle cx="12" cy="8.6" r="3.6"/><path d="M4.6 20c.9-3.6 3.8-5.4 7.4-5.4s6.5 1.8 7.4 5.4"/>',

    /* Fluent-style command-bar and menu glyphs (File Explorer, context menus) */
    'fl-back': '<path d="M19 12H5.5M11 6l-6 6 6 6"/>',
    'fl-forward': '<path d="M5 12h13.5M13 6l6 6-6 6"/>',
    'fl-up': '<path d="M12 19V5.5M6 11l6-6 6 6"/>',
    'fl-refresh': '<path d="M19.2 12.2a7.2 7.2 0 1 1-2.2-5.2"/><path d="M19.4 4.6v4.2h-4.2"/>',
    'fl-cut': '<circle cx="7" cy="17.5" r="2.6"/><circle cx="17" cy="17.5" r="2.6"/><path d="M8.7 15.5L17 4M15.3 15.5L7 4"/>',
    'fl-copy': '<rect x="8.5" y="8.5" width="11" height="12" rx="2"/><path d="M15.5 8.5V6.5a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h2"/>',
    'fl-paste': '<rect x="5" y="5.5" width="14" height="15.5" rx="2"/><rect x="9" y="3" width="6" height="4" rx="1.5"/>',
    'fl-rename': '<rect x="3.5" y="8.5" width="17" height="7" rx="1.5"/><path d="M8 5.5v13M6 5.5h4M6 18.5h4"/>',
    'fl-delete': '<path d="M5 7h14M9.5 7V5h5v2M7 7l.9 12.2a1 1 0 0 0 1 .8h6.2a1 1 0 0 0 1-.8L17 7M10.5 10.8v5M13.5 10.8v5"/>',
    'fl-sort': '<path d="M8 5v14M4.8 15.8L8 19l3.2-3.2"/><path d="M16 19V5M12.8 8.2L16 5l3.2 3.2"/>',
    'fl-view': '<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M4 10h16M10 10v9"/>',
    'fl-more': '<circle cx="5.5" cy="12" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="18.5" cy="12" r="1.2" fill="currentColor"/>',
    'fl-new': '<path d="M12 5v14M5 12h14"/>',
    'fl-details': '<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M14.5 5v14"/>',
    'fl-prompt': '<rect x="3.5" y="5" width="17" height="14" rx="2"/><path d="M7.5 10l3 2.5-3 2.5M12.5 15h4"/>',
    'fl-folder-new': '<path d="M3.5 7.5a2 2 0 0 1 2-2h3.8l2 2.2h7.2a2 2 0 0 1 2 2v7.8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/><path d="M12 10.5v5M9.5 13h5"/>',
    'fl-doc-new': '<path d="M7 3.5h7l4 4v12a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 19.5v-14A1.5 1.5 0 0 1 7.5 4z"/><path d="M14 3.5v4h4M12 11v5M9.5 13.5h5"/>',
    'fl-display': '<rect x="3.5" y="5" width="17" height="11" rx="1.6"/><path d="M9 20h6M12 16v4"/>',
    'fl-personalize': '<path d="M12 4a8 8 0 1 0 0 16c1.4 0 2-1 1.5-2-.6-1.2.1-2.4 1.5-2.4H17a3.5 3.5 0 0 0 3.5-3.5C20.5 7 16.8 4 12 4z"/><circle cx="8" cy="11" r="1" fill="currentColor"/><circle cx="12" cy="8" r="1" fill="currentColor"/><circle cx="16" cy="9.4" r="1" fill="currentColor"/>',
    'fl-open': '<path d="M13 4.5h6.5V11M19.5 4.5L11 13M17 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 5 18.5v-9A1.5 1.5 0 0 1 6.5 8H11"/>',
    'fl-link': '<path d="M10 14a3.6 3.6 0 0 0 5 0l3-3a3.6 3.6 0 0 0-5-5l-.8.8"/><path d="M14 10a3.6 3.6 0 0 0-5 0l-3 3a3.6 3.6 0 0 0 5 5l.8-.8"/>',
    'fl-props': '<rect x="4" y="4" width="16" height="16" rx="2.5"/><path d="M8 9h8M8 12.5h8M8 16h5"/>',
    'fl-more-opts': '<path d="M4.5 8.5h10M17 8.5h2.5M4.5 15.5h2.5M9.5 15.5h10"/><circle cx="15.5" cy="8.5" r="1.8"/><circle cx="8" cy="15.5" r="1.8"/>',
    'fl-select-all': '<rect x="4" y="4" width="16" height="16" rx="2.5" stroke-dasharray="2.4 2.2"/><path d="M8.5 12.2l2.6 2.6 4.6-5"/>',
    'fl-check': '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    'fl-pin': '<path d="M9 4.5h6l-.8 5.2c1.9 1 3.3 2.700 3.300 4.300H6.500c0-1.600 1.400-3.300 3.300-4.300z"/><path d="M12 14v6"/>',
    'fl-recycle': recycleArrows(12, 13, 8.8, 1.3, 'currentColor'),

    /* quick-access folders in the Explorer navigation pane (small, coloured) */
  };
  Object.keys(glyphs).forEach(function (k) { defs[k] = Array.isArray(glyphs[k]) ? glyphs[k] : g(glyphs[k]); });

  /* a gradient inside an icon's own <defs> is moved into the sprite, so every icon paints even when the first copy sits in a hidden window */
  function hoist(inner) {
    return inner.replace(/<defs>([\s\S]*?)<\/defs>/g, function (m, d) { DEFS += d; return ''; });
  }
  Object.keys(defs).forEach(function (k) {
    var e = defs[k];
    reg[k] = { vb: e[0], inner: hoist(e[1]), sm: e[2] ? hoist(e[2]) : null };
  });

  /* the same drawing under a second name (the old Mac-era names, the Explorer nav-pane names, the file type names) */
  function alias(to, from) { if (reg[from] && !reg[to]) reg[to] = reg[from]; }
  alias('fd-n-home', 'home'); alias('fd-n-gallery', 'gallery'); alias('fd-n-thispc', 'this-pc'); alias('fd-n-drive', 'drive-c'); alias('fd-n-network', 'network');
  alias('fd-n-trash', 'app-trash-empty'); alias('fd-n-trash-full', 'app-trash-full');
  alias('qa-desktop', 'fd-n-desktop'); alias('qa-downloads', 'fd-n-downloads'); alias('qa-documents', 'fd-n-documents');
  alias('qa-pictures', 'fd-n-pictures'); alias('qa-music', 'fd-n-music'); alias('qa-videos', 'fd-n-videos');
  alias('exe', 'app'); alias('jpg', 'image'); alias('png', 'image');

  /* the tiny flat picture at the right end of the taskbar search box (a sun over two hills; our own drawing) */
  reg['search-art'] = { vb: '0 0 24 24', inner: '<circle cx="8.5" cy="8.5" r="3.3" fill="#f6c453"/><path d="M2 21c3-6.4 6.200-8.600 9.500-8.600 2.400 0 4.200 1.200 5.600 3 .9-1.200 2.800-2.200 4.900-2.200V21z" fill="#63aee0"/><path d="M2 21c2.600-3.400 5.200-5 8.200-5 2.200 0 4 .9 5.500 2.600L22 21z" fill="#3a82bd"/>', sm: null };

  /* The Windows Start logo: four panes, each lit a little differently (lighter at the top left), thin gaps. */
  reg['start'] = (function () {
    var a = lin('sl-a', 2.600, 2.600, 11.300, 11.300, [[0, '#86dcff'], [1, '#34a8f5']]);
    var b = lin('sl-b', 12.700, 2.600, 21.400, 11.300, [[0, '#62c9fd'], [1, '#1b8ceb']]);
    var c = lin('sl-c', 2.600, 12.700, 11.300, 21.400, [[0, '#4fb7f8'], [1, '#117ee3']]);
    var d = lin('sl-d', 12.700, 12.700, 21.400, 21.400, [[0, '#3aa3f2'], [1, '#0a64d1']]);
    return { vb: '0 0 24 24', sm: null, inner:
      '<rect x="2.600" y="2.600" width="8.700" height="8.700" rx=".6" fill="' + a + '"/><rect x="12.700" y="2.600" width="8.700" height="8.700" rx="1" fill="' + b + '"/>' +
      '<rect x="2.600" y="12.700" width="8.700" height="8.700" rx=".6" fill="' + c + '"/><rect x="12.700" y="12.700" width="8.700" height="8.700" rx=".6" fill="' + d + '"/>' +
      '<path d="M3.700 3.700h6.500M13.800 3.700h6.500" stroke="#fff" stroke-opacity=".35" stroke-width=".7" stroke-linecap="round"/>' };
  })();

  /* Size normalisation: Codex was drawn on a 1024 grid with the squircle at 8..1016, so it looked larger than the other tiles; scale about the centre. */
  var NORM = { 'app-codex': 0.889 };
  Object.keys(NORM).forEach(function (k) {
    if (!reg[k]) return;
    var s = NORM[k], t = (512 * (1 - s)).toFixed(2);
    reg[k].inner = '<g transform="translate(' + t + ' ' + t + ') scale(' + s + ')">' + reg[k].inner + '</g>';
  });

  function svgFor(entry, size, cls) {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + entry.vb + '" width="' + size + '" height="' + size + '"' +
      (cls ? ' class="' + cls + '"' : '') + ' aria-hidden="true" focusable="false">' + ((entry.sm && size <= 20) ? entry.sm : entry.inner) + '</svg>';
  }

  var CODE_EXT = ['py', 'js', 'mjs', 'ts', 'json', 'html', 'htm', 'css', 'sh', 'ps1', 'bat', 'cmd', 'yml', 'yaml', 'xml', 'ipynb', 'toml', 'ini'];
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
      wrap.innerHTML = icons.get(name, opts);   // static strings only (M§0.5)
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
    names: function () { return Object.keys(reg); },
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
      if (ext === 'exe' || ext === 'msi') return 'app';
      if (CODE_EXT.indexOf(ext) >= 0) return 'code';
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
    d.innerHTML = '<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>' + DEFS + '</defs></svg>';
    document.body.insertBefore(d, document.body.firstChild);
  }
  if (document.body) mountSprite(); else document.addEventListener('DOMContentLoaded', mountSprite);
})(window.LAB);
