/* icons.js [SKIN] — LAB.icons: every icon is our own inline SVG, drawn to read like Windows 11 / the apps (DESIGN W3, W0.1: no vendor artwork).
   App and file icons: viewBox 0 0 64 64 (the Codex and VS Code art use a 1024 grid). UI glyphs: 0 0 24 24, currentColor, 1.5 stroke.
   API (unchanged from the Mac): get(name,{size,cls}) -> markup, el(name,opts), add(name, svg|fn), has(name), forNode(stat). */
(function (LAB) {
  'use strict';

  var reg = Object.create(null);   // name -> {vb, inner, fn}

  /* One hidden-but-rendered sprite for the gradients the old Mac icons shared (display:none would break url(#id) in some browsers). */
  var SPRITE =
    '<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>' +
    '<linearGradient id="lab-g-folder" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe27a"/><stop offset="1" stop-color="#ffc02e"/></linearGradient>' +
    '<linearGradient id="lab-g-blue" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#52b3ff"/><stop offset="1" stop-color="#1f7fe0"/></linearGradient>' +
    '<linearGradient id="lab-g-grey" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#eef0f3"/><stop offset="1" stop-color="#c3c8d0"/></linearGradient>' +
    '</defs></svg>';

  function lg(id, c1, c2, horizontal) {
    return '<linearGradient id="' + id + '" x1="0" y1="0" x2="' + (horizontal ? 1 : 0) + '" y2="' + (horizontal ? 0 : 1) + '"><stop offset="0" stop-color="' + c1 + '"/><stop offset="1" stop-color="' + c2 + '"/></linearGradient>';
  }
  var A = '0 0 64 64';

  /* ---- file pages (Windows 11 look: white page, folded corner, thin grey edge) ---- */
  var PAGE = '<path d="M15 5h22l13 13v38a4 4 0 0 1-4 4H15a4 4 0 0 1-4-4V9a4 4 0 0 1 4-4z" fill="#fff" stroke="#c2c2c2" stroke-width="1.2"/>' +
             '<path d="M37 5v10a3 3 0 0 0 3 3h10z" fill="#e6e6e6" stroke="#c2c2c2" stroke-width="1.2" stroke-linejoin="round"/>';
  function lines(y0, n, color) {
    var s = '';
    for (var i = 0; i < n; i++) s += '<path d="M18 ' + (y0 + i * 7) + 'h' + (i === n - 1 ? 14 : 28) + '" stroke="' + (color || '#b6b6b6') + '" stroke-width="2.4" stroke-linecap="round"/>';
    return s;
  }
  function labelPage(text, color, w) {
    var x0 = 32 - w / 2;
    return PAGE + '<rect x="' + x0 + '" y="33" width="' + w + '" height="15" rx="3" fill="' + color + '"/>' +
      '<text x="32" y="44.2" text-anchor="middle" font-family="Segoe UI,Arial,sans-serif" font-weight="700" font-size="10" fill="#fff">' + text + '</text>' +
      '<path d="M18 25h18" stroke="#b6b6b6" stroke-width="2.4" stroke-linecap="round"/>';
  }
  /* Windows 11 folder: darker back plate with a tab, a flat front panel with a lighter top band */
  var FOLDER_BACK = '<path d="M5 14a4 4 0 0 1 4-4h14c1.6 0 2.8.7 3.8 1.9l1.7 2.1c.7.8 1.5 1.1 2.5 1.1H55a4 4 0 0 1 4 4v29a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4z" fill="#e5a20f"/>';
  var FOLDER_FRONT = '<rect x="5" y="21" width="54" height="32" rx="4" fill="url(#lab-w-fo-f)"/>' +
    '<path d="M5 25a4 4 0 0 1 4-4h46a4 4 0 0 1 4 4v1.5H5z" fill="#ffeaa6"/>';
  var FOLDER_DEFS = '<defs>' + lg('lab-w-fo-f', '#ffd965', '#ffc12c') + '</defs>';

  var defs = {
    /* ================= app icons ================= */
    /* File Explorer: yellow folder with a blue band across the bottom of the front */
    'app-finder': [A, '<defs>' + lg('lab-w-fe-f', '#ffe47f', '#ffc22f') + lg('lab-w-fe-u', '#4ba9f9', '#1b72d6') + '</defs>' +
      '<path d="M5 15a4 4 0 0 1 4-4h14c1.6 0 2.8.7 3.8 1.9l1.7 2.1c.7.8 1.5 1.1 2.5 1.1H55a4 4 0 0 1 4 4v29a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4z" fill="#e0a010"/>' +
      '<rect x="5" y="22" width="54" height="31" rx="4" fill="url(#lab-w-fe-f)"/>' +
      '<path d="M9 22.6h46" stroke="#fff4c8" stroke-width="1.2" stroke-linecap="round" opacity=".8"/>' +
      '<path d="M5 44h54v5a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4z" fill="url(#lab-w-fe-u)"/>'],
    /* Windows Terminal: dark tile in a light frame, a blue strip along the top, white >_ at the lower left */
    'app-terminal': [A, '<rect x="4" y="8" width="56" height="48" rx="7" fill="#e6e6e8"/>' +
      '<rect x="6.5" y="10.5" width="51" height="43" rx="4.6" fill="#1c1c1e"/>' +
      '<path d="M6.5 15.2a4.7 4.7 0 0 1 4.7-4.7h41.6a4.7 4.7 0 0 1 4.7 4.7v3.3h-51z" fill="#3b97e0"/>' +
      '<path d="M16 27.5l9.5 7.2L16 41.9" fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="M30 44h14" fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round"/>'],
    /* Codex: as on the Mac */
    'app-codex': ["0 0 1024 1024", "<defs><linearGradient id=\"lab-i-codex-bg\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"1\"><stop offset=\"0\" stop-color=\"#212123\"/><stop offset=\"1\" stop-color=\"#19191b\"/></linearGradient><linearGradient id=\"lab-i-codex-cl\" gradientUnits=\"userSpaceOnUse\" x1=\"0\" y1=\"110\" x2=\"0\" y2=\"895\"><stop offset=\"0\" stop-color=\"#c9a6f6\"/><stop offset=\".3\" stop-color=\"#9a92f8\"/><stop offset=\".52\" stop-color=\"#6074fb\"/><stop offset=\"1\" stop-color=\"#2d34f2\"/></linearGradient><radialGradient id=\"lab-i-codex-rim\" gradientUnits=\"userSpaceOnUse\" cx=\"516\" cy=\"525\" r=\"410\"><stop offset=\".6\" stop-color=\"#2326e0\" stop-opacity=\"0\"/><stop offset=\"1\" stop-color=\"#2326e0\" stop-opacity=\".85\"/></radialGradient><radialGradient id=\"lab-i-codex-hi\" gradientUnits=\"userSpaceOnUse\" cx=\"520\" cy=\"235\" r=\"280\"><stop offset=\"0\" stop-color=\"#f0c4ee\" stop-opacity=\".72\"/><stop offset=\"1\" stop-color=\"#f0c4ee\" stop-opacity=\"0\"/></radialGradient><radialGradient id=\"lab-i-codex-lo\" gradientUnits=\"userSpaceOnUse\" cx=\"500\" cy=\"740\" r=\"280\"><stop offset=\"0\" stop-color=\"#4a6cff\" stop-opacity=\".4\"/><stop offset=\"1\" stop-color=\"#4a6cff\" stop-opacity=\"0\"/></radialGradient><linearGradient id=\"lab-i-codex-sh\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"1\"><stop offset=\"0\" stop-color=\"#fff\" stop-opacity=\".07\"/><stop offset=\".25\" stop-color=\"#fff\" stop-opacity=\"0\"/></linearGradient><clipPath id=\"lab-i-codex-clip\"><circle cx=\"516\" cy=\"269\" r=\"164\"/><circle cx=\"706\" cy=\"346\" r=\"158\"/><circle cx=\"761\" cy=\"557\" r=\"160\"/><circle cx=\"631\" cy=\"722\" r=\"158\"/><circle cx=\"428\" cy=\"724\" r=\"162\"/><circle cx=\"282\" cy=\"581\" r=\"158\"/><circle cx=\"295\" cy=\"388\" r=\"160\"/><circle cx=\"516\" cy=\"505\" r=\"356\"/></clipPath></defs><rect x=\"8\" y=\"8\" width=\"1008\" height=\"1008\" rx=\"228\" fill=\"url(#lab-i-codex-bg)\"/><rect x=\"8\" y=\"8\" width=\"1008\" height=\"1008\" rx=\"228\" fill=\"url(#lab-i-codex-sh)\"/><g clip-path=\"url(#lab-i-codex-clip)\"><rect x=\"90\" y=\"90\" width=\"850\" height=\"850\" fill=\"url(#lab-i-codex-cl)\"/><rect x=\"90\" y=\"90\" width=\"850\" height=\"850\" fill=\"url(#lab-i-codex-rim)\"/><rect x=\"90\" y=\"90\" width=\"850\" height=\"450\" fill=\"url(#lab-i-codex-hi)\"/><rect x=\"90\" y=\"500\" width=\"850\" height=\"440\" fill=\"url(#lab-i-codex-lo)\"/></g><path d=\"M350 388L428 498L350 608\" fill=\"none\" stroke=\"#eef0ff\" stroke-opacity=\".88\" stroke-width=\"46\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M545 618H705\" fill=\"none\" stroke=\"#eef0ff\" stroke-opacity=\".88\" stroke-width=\"46\" stroke-linecap=\"round\"/>"],
    /* Visual Studio Code: the blue ribbon (no tile behind it, as on Windows) */
    'app-code': ['158 175 700 700', '<defs><linearGradient id="lab-w-vs-a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1f9cf0"/><stop offset="1" stop-color="#0a6fc3"/></linearGradient>' +
      '<linearGradient id="lab-w-vs-b" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#0a6cbd"/><stop offset="1" stop-color="#0963b4"/></linearGradient>' +
      '<linearGradient id="lab-w-vs-r" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#35aaff"/><stop offset="1" stop-color="#1b8ae6"/></linearGradient></defs>' +
      '<path d="M264 650L643 338L643 245L217 593Z" fill="url(#lab-w-vs-b)" stroke="url(#lab-w-vs-b)" stroke-width="63.5" stroke-linejoin="round"/>' +
      '<path d="M217 410L643 758L643 665L264 353Z" fill="url(#lab-w-vs-a)" stroke="url(#lab-w-vs-a)" stroke-width="63.5" stroke-linejoin="round"/>' +
      '<path d="M671 237L812 307L812 755L671 819Z" fill="url(#lab-w-vs-r)" stroke="url(#lab-w-vs-r)" stroke-width="38.1" stroke-linejoin="round"/>'],
    /* Notepad: a blue notepad (binder rings along the top), grey text lines, a small pencil */
    'app-textedit': [A, '<defs>' + lg('lab-w-np-t', '#58b6ff', '#217fe2') + '</defs>' +
      '<rect x="10" y="6" width="42" height="54" rx="5" fill="#fff" stroke="#b5c0cf" stroke-width="1.2"/>' +
      '<path d="M10 11a5 5 0 0 1 5-5h32a5 5 0 0 1 5 5v8H10z" fill="url(#lab-w-np-t)"/>' +
      '<rect x="18" y="3" width="3.4" height="10" rx="1.7" fill="#f5f8fc" stroke="#5f7694" stroke-width="1"/>' +
      '<rect x="29.3" y="3" width="3.4" height="10" rx="1.7" fill="#f5f8fc" stroke="#5f7694" stroke-width="1"/>' +
      '<rect x="40.6" y="3" width="3.4" height="10" rx="1.7" fill="#f5f8fc" stroke="#5f7694" stroke-width="1"/>' +
      '<path d="M17 29h28M17 36h28M17 43h18" stroke="#b3bbc9" stroke-width="2.4" stroke-linecap="round"/>' +
      '<g transform="rotate(38 46 50)"><rect x="43" y="36" width="6" height="22" rx="1.4" fill="#f6a623"/><path d="M43 58h6l-3 5z" fill="#f2d3a0"/><path d="M46 63l-1.1-2.2h2.2z" fill="#444"/><rect x="43" y="36" width="6" height="4" rx="1.4" fill="#e0556a"/></g>'],
    'app-about': [A, '<rect x="4" y="4" width="56" height="56" rx="14" fill="#f6efdc"/>' +
      '<rect x="4.5" y="4.5" width="55" height="55" rx="13.5" fill="none" stroke="rgba(0,0,0,.14)"/>' +
      '<path d="M17 46V38M29 46V30M41 46V20" stroke="#8a5400" stroke-width="7" stroke-linecap="butt"/>'],
    /* Recycle Bin: a clear plastic bin with the green recycling arrows; the full one has paper sticking out */
    'app-trash-empty': [A, '<defs>' + lg('lab-w-rb-b', '#edf3fa', '#b9c9dc') + '</defs>' +
      '<path d="M24 12V9.5A3.5 3.5 0 0 1 27.5 6h9A3.5 3.5 0 0 1 40 9.5V12" fill="none" stroke="#93a6bb" stroke-width="2"/>' +
      '<path d="M13 21h38l-3 34.5a4 4 0 0 1-4 3.5H20a4 4 0 0 1-4-3.5z" fill="url(#lab-w-rb-b)" stroke="#8fa3b9" stroke-width="1.4" stroke-linejoin="round"/>' +
      '<rect x="9" y="13" width="46" height="8" rx="4" fill="#e3ebf5" stroke="#8fa3b9" stroke-width="1.4"/>' +
      '<path d="M25 26l1.3 25M32 26v25M39 26l-1.3 25" stroke="#fff" stroke-opacity=".75" stroke-width="1.6" stroke-linecap="round"/>' +
      '<g fill="none" stroke="#2f9d52" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M31 33.5l3.8 6.4"/><path d="M33.6 43.5H26"/><path d="M25.2 41l3.6-6.2"/></g>' +
      '<g fill="#2f9d52"><path d="M37 36.8l-2.9 1 2-3.3z"/><path d="M27.6 45.8l2.4-2.3.5 3.3z" transform="translate(-1.6 0)"/><path d="M26 33.4l3-1.6-.7 3.4z"/></g>'],
    'app-trash-full': [A, '<defs>' + lg('lab-w-rb-b2', '#edf3fa', '#b9c9dc') + '</defs>' +
      '<g transform="rotate(-9 24 14)"><rect x="14" y="2" width="20" height="24" rx="1.6" fill="#fff" stroke="#b4bcc8" stroke-width="1.1"/><path d="M18 9h12M18 14h12" stroke="#c9ced6" stroke-width="1.6" stroke-linecap="round"/></g>' +
      '<g transform="rotate(10 42 14)"><rect x="30" y="3" width="20" height="24" rx="1.6" fill="#f6f8fb" stroke="#b4bcc8" stroke-width="1.1"/><path d="M34 10h12M34 15h8" stroke="#c9ced6" stroke-width="1.6" stroke-linecap="round"/></g>' +
      '<path d="M13 21h38l-3 34.5a4 4 0 0 1-4 3.5H20a4 4 0 0 1-4-3.5z" fill="url(#lab-w-rb-b2)" stroke="#8fa3b9" stroke-width="1.4" stroke-linejoin="round"/>' +
      '<rect x="9" y="13" width="46" height="8" rx="4" fill="#e3ebf5" stroke="#8fa3b9" stroke-width="1.4"/>' +
      '<path d="M25 26l1.3 25M32 26v25M39 26l-1.3 25" stroke="#fff" stroke-opacity=".75" stroke-width="1.6" stroke-linecap="round"/>' +
      '<g fill="none" stroke="#2f9d52" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M31 33.5l3.8 6.4"/><path d="M33.6 43.5H26"/><path d="M25.2 41l3.6-6.2"/></g>'],
    'app-downloads': [A, FOLDER_DEFS + FOLDER_BACK + FOLDER_FRONT +
      '<path d="M32 28v15M26 38l6 6 6-6" fill="none" stroke="#1f7fe0" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>'],

    /* ================= Start decor apps (toast only) and Terminal's tab icon ================= */
    'app-powershell': [A, '<rect x="4" y="9" width="56" height="46" rx="6" fill="#2573c4"/><path d="M4 15a6 6 0 0 1 6-6h44a6 6 0 0 1 6 6v3H4z" fill="#1d5fa8"/>' +
      '<path d="M17 26l11 8.5L17 43" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M32 45h15" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/>'],
    'app-settings': [A, '<defs>' + lg('lab-w-st-g', '#8a96a8', '#5b6779') + '</defs>' +
      '<g fill="url(#lab-w-st-g)"><circle cx="32" cy="32" r="19"/>' +
      '<rect x="27.5" y="4" width="9" height="14" rx="2.5"/><rect x="27.5" y="46" width="9" height="14" rx="2.5"/><rect x="4" y="27.5" width="14" height="9" rx="2.5"/><rect x="46" y="27.5" width="14" height="9" rx="2.5"/>' +
      '<rect x="27.5" y="4" width="9" height="14" rx="2.5" transform="rotate(45 32 32)"/><rect x="27.5" y="46" width="9" height="14" rx="2.5" transform="rotate(45 32 32)"/><rect x="4" y="27.5" width="14" height="9" rx="2.5" transform="rotate(45 32 32)"/><rect x="46" y="27.5" width="14" height="9" rx="2.5" transform="rotate(45 32 32)"/></g>' +
      '<circle cx="32" cy="32" r="8.5" fill="#eef1f6"/>'],
    'app-photos': [A, '<defs>' + lg('lab-w-ph-s', '#6cc7ff', '#2d86e8') + '</defs>' +
      '<rect x="5" y="9" width="54" height="46" rx="6" fill="url(#lab-w-ph-s)"/><circle cx="22" cy="24" r="5.5" fill="#fff" opacity=".95"/>' +
      '<path d="M5 47l15-15 11 10 9-8 19 17v1a6 6 0 0 1-6 6H11a6 6 0 0 1-6-6z" fill="#1f62c2"/><path d="M31 42l9-8 19 17v-2L40 32z" fill="#3d8cf0" opacity=".6"/>'],
    'app-calc': [A, '<rect x="11" y="4" width="42" height="56" rx="6" fill="#3c4350"/><rect x="16" y="9" width="32" height="13" rx="2.4" fill="#a9d6f6"/>' +
      '<g fill="#e4e8ef"><rect x="16" y="28" width="8" height="7" rx="1.6"/><rect x="28" y="28" width="8" height="7" rx="1.6"/><rect x="40" y="28" width="8" height="7" rx="1.6"/>' +
      '<rect x="16" y="39" width="8" height="7" rx="1.6"/><rect x="28" y="39" width="8" height="7" rx="1.6"/><rect x="40" y="39" width="8" height="7" rx="1.6"/>' +
      '<rect x="16" y="50" width="8" height="6" rx="1.6"/><rect x="28" y="50" width="8" height="6" rx="1.6"/></g><rect x="40" y="50" width="8" height="6" rx="1.6" fill="#4cc2ff"/>'],
    /* Microsoft Edge (round 5): a blue globe with a green wave curling in from the lower left; our own drawing, not the vendor logo */
    'app-edge': [A, '<defs>' + lg('lab-w-ed-b', '#35b8f0', '#0b5fc0') + lg('lab-w-ed-g', '#52dba0', '#14a06b') +
      '<radialGradient id="lab-w-ed-h" cx=".3" cy=".25" r=".7"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>' +
      '<circle cx="32" cy="32" r="27.5" fill="url(#lab-w-ed-b)"/>' +
      '<path d="M5 35.500C6 49 18 59.500 33 59.500c9.500 0 17.500-4 22.500-11-6 5.600-15.500 6.600-21.500 1.200C28 44.400 28 35.800 36 31.400c-9-5-21-1.400-27.500 4z" fill="url(#lab-w-ed-g)"/>' +
      '<path d="M13 22.500C17.500 13 28 8 38 10.500c9.500 2.400 16 10.500 16.500 20.500.1 3-.5 5.600-1.500 8-1-9-8-14.500-16-14.500-10 0-17.500 6.500-20 14.500-3 .500-3.500-8-.5-12.500z" fill="#fff" fill-opacity=".14"/>' +
      '<circle cx="32" cy="32" r="27.500" fill="url(#lab-w-ed-h)"/>'],
    /* Task Manager: a light window, a blue band at the top, a green activity line on a dark graph and two usage bars */
    'app-taskmgr': [A, '<defs>' + lg('lab-w-tm-t', '#4aa6f4', '#1c6fd0') + '</defs>' +
      '<rect x="5" y="8" width="54" height="48" rx="5.500" fill="#f4f7fb" stroke="#a9b6c8" stroke-width="1.200"/>' +
      '<path d="M5 13.500a5.500 5.500 0 0 1 5.500-5.500h43a5.500 5.500 0 0 1 5.500 5.500V18H5z" fill="url(#lab-w-tm-t)"/>' +
      '<rect x="10" y="22" width="44" height="21" rx="2.500" fill="#1d2733"/>' +
      '<path d="M10 33h44M10 27.500h44M10 38.500h44" stroke="#2f3f50" stroke-width=".8"/>' +
      '<path d="M11.500 38.500l7-6 5 3.500 6-10 5 7 4.500-4.500 7.500 2.500" fill="none" stroke="#5fe08a" stroke-width="2.200" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<rect x="10" y="47" width="30" height="3.600" rx="1.800" fill="#c9d3e0"/><rect x="10" y="47" width="19" height="3.600" rx="1.800" fill="#2f86e8"/>'],
    /* the Run dialog (Win+X > 執行): a small window with a right arrow */
    'app-run': [A, '<rect x="6" y="12" width="52" height="40" rx="5" fill="#f7f9fc" stroke="#a9b6c8" stroke-width="1.200"/><path d="M6 17.500a5.500 5.500 0 0 1 5.500-5.500h41A5.500 5.500 0 0 1 58 17.500V22H6z" fill="#2b83e0"/>' +
      '<rect x="12" y="29" width="40" height="11" rx="2" fill="#fff" stroke="#c4cdd9"/><path d="M16 34.500h12" stroke="#7c8aa0" stroke-width="2" stroke-linecap="round"/><path d="M40 43.500l6 4.500-6 4.500" fill="none" stroke="#2b83e0" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>'],
    /* a laptop, big (Settings: the device card) */
    'dev-laptop': [A, '<defs>' + lg('lab-w-lp-s', '#5bb6ff', '#1c6fd8') + '</defs><rect x="11" y="10" width="42" height="29" rx="3.200" fill="#2f3643"/><rect x="13.500" y="12.500" width="37" height="24" rx="1.400" fill="url(#lab-w-lp-s)"/>' +
      '<path d="M13.500 31l10-7 8 5 6-4 12.500 6.500v1.800a1.400 1.400 0 0 1-1.400 1.200H14.900a1.400 1.400 0 0 1-1.400-1.200z" fill="#fff" opacity=".2"/><path d="M4 43.500h56l-3 5.200a3 3 0 0 1-2.600 1.500H9.600a3 3 0 0 1-2.600-1.500z" fill="#b3bcc9"/><rect x="26" y="43.500" width="12" height="2.200" rx="1.100" fill="#8a94a3"/>'],
    /* the offline picture of the Edge error page (currentColor strokes, so it follows light / dark) */
    'offline-art': ['0 0 64 64', '<g fill="none" stroke="currentColor" stroke-width="2.600" stroke-linecap="round" stroke-linejoin="round"><path d="M10 28.500a31 31 0 0 1 44 0M17 35.500a21 21 0 0 1 30 0M24.500 42.500a10.500 10.500 0 0 1 15 0"/><circle cx="32" cy="49.500" r="1.400" fill="currentColor"/><path d="M11 11l42 42"/></g>'],

    /* ================= file icons ================= */
    'folder': [A, FOLDER_DEFS + FOLDER_BACK + FOLDER_FRONT],
    'folder-open': [A, FOLDER_DEFS + FOLDER_BACK +
      '<rect x="11" y="18" width="40" height="20" rx="2" fill="#fff" stroke="#d3d3d3" stroke-width="1"/>' +
      '<path d="M12 28.5a3 3 0 0 1 3-3h45l-6 24.3a4 4 0 0 1-3.9 3.2H10.5a4 4 0 0 1-3.9-4.9z" fill="url(#lab-w-fo-f)"/><path d="M12 28.5a3 3 0 0 1 3-3h45l-.7 2.6H12z" fill="#ffeaa6"/>'],
    'zip': [A, FOLDER_DEFS + FOLDER_BACK + FOLDER_FRONT +
      '<rect x="28.5" y="12" width="7" height="39" rx="1" fill="#7f8794"/>' +
      '<g fill="#fff"><rect x="28.5" y="15" width="3.5" height="3"/><rect x="32" y="21" width="3.5" height="3"/><rect x="28.5" y="27" width="3.5" height="3"/><rect x="32" y="33" width="3.5" height="3"/></g>' +
      '<rect x="27" y="40" width="10" height="10" rx="2.4" fill="#5e6673"/><rect x="30" y="43" width="4" height="4" rx="1" fill="#e9edf3"/>'],
    'doc': [A, PAGE + lines(26, 4)],
    'md': [A, labelPage('MD', '#5b6b80', 26)],
    'txt': [A, PAGE + lines(24, 4)],
    'csv': [A, labelPage('CSV', '#1d7a43', 32)],
    'pdf': [A, labelPage('PDF', '#d4382c', 32)],
    'docx': [A, labelPage('DOCX', '#185abd', 38)],
    'app': [A, '<rect x="6" y="9" width="52" height="46" rx="5" fill="#fff" stroke="#b9c1cc" stroke-width="1.2"/><path d="M6 14a5 5 0 0 1 5-5h42a5 5 0 0 1 5 5v6H6z" fill="#2b83e0"/><rect x="12" y="27" width="18" height="20" rx="2" fill="#dbe5f2"/><path d="M36 30h16M36 37h16M36 44h10" stroke="#b3bbc9" stroke-width="2.4" stroke-linecap="round"/>'],
    'image': [A, PAGE + '<circle cx="25" cy="29" r="3.6" fill="#f2b84b"/><path d="M14 51l11-11 7 7 6-6 12 10z" fill="#5fb59c"/>'],
    'unknown': [A, PAGE + '<path d="M27 30.5a5.5 5.5 0 1 1 7.5 5.2c-1.3.6-2 1.6-2 3" fill="none" stroke="#9aa0ab" stroke-width="2.6" stroke-linecap="round"/><circle cx="32.5" cy="46" r="1.8" fill="#9aa0ab"/>'],

    /* ================= computer places (Explorer navigation) ================= */
    'this-pc': [A, '<defs>' + lg('lab-w-pc-s', '#5fb6ff', '#1d6fd8') + '</defs><rect x="6" y="9" width="52" height="35" rx="3.5" fill="#3a4250"/><rect x="9" y="12" width="46" height="29" rx="1.8" fill="url(#lab-w-pc-s)"/>' +
      '<path d="M9 33l13-9 11 7 8-5 14 8v3.4a1.8 1.8 0 0 1-1.8 1.6H10.8A1.8 1.8 0 0 1 9 38.4z" fill="#fff" opacity=".22"/><path d="M24 44h16l2 8H22z" fill="#8f98a6"/><rect x="16" y="51" width="32" height="4" rx="2" fill="#aeb6c2"/>'],
    'drive-c': [A, '<defs>' + lg('lab-w-dr-f', '#dde2ea', '#aab2bf') + '</defs><path d="M10 25h44l5 12v10a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V37z" fill="url(#lab-w-dr-f)" stroke="#8c95a3" stroke-width="1.2" stroke-linejoin="round"/>' +
      '<path d="M5 37h54" stroke="#8c95a3" stroke-width="1.2"/><rect x="11" y="41" width="9" height="9" rx="1.2" fill="#2d86e8"/><rect x="21.5" y="41" width="9" height="9" rx="1.2" fill="#2d86e8" opacity=".55"/>' +
      '<rect x="40" y="43.5" width="14" height="4" rx="2" fill="#7e8794"/><circle cx="35" cy="45.5" r="1.6" fill="#3cba5f"/>'],
    'network': [A, '<defs>' + lg('lab-w-nw-g', '#5bb4ff', '#1b6fd4') + '</defs><circle cx="32" cy="32" r="24" fill="url(#lab-w-nw-g)"/><g fill="none" stroke="#fff" stroke-opacity=".75" stroke-width="1.8"><ellipse cx="32" cy="32" rx="10" ry="24"/><path d="M8 32h48M12 19h40M12 45h40"/></g>'],
    'home': [A, '<path d="M32 8L4 31h8v21a3 3 0 0 0 3 3h34a3 3 0 0 0 3-3V31h8z" fill="#e8eef7" stroke="#aebcd0" stroke-width="1.4" stroke-linejoin="round"/><path d="M32 8L4 31h7.4L32 14l20.6 17H60z" fill="#3f93ec"/><rect x="26" y="37" width="12" height="18" rx="2" fill="#2d78d4"/>'],
    'gallery': [A, '<defs>' + lg('lab-w-ga-s', '#7fd0ff', '#3b8cf0') + '</defs><rect x="6" y="11" width="52" height="42" rx="5" fill="url(#lab-w-ga-s)"/><circle cx="46" cy="23" r="5" fill="#fff6c2"/><path d="M6 44l14-14 12 11 9-8 17 16v2.5a5 5 0 0 1-5 5H11a5 5 0 0 1-5-5z" fill="#2563c9"/><path d="M6 49l12-9 11 8 10-7 19 10v3a5 5 0 0 1-5 5H11a5 5 0 0 1-5-5z" fill="#1c4fae" opacity=".55"/>'],
    'pin': [A, '<path d="M24 8h16l-2 14c4 2.4 7 6 7 10H19c0-4 3-7.600 7-10z" fill="#8a929e"/><path d="M32 32v23" stroke="#6b7480" stroke-width="3" stroke-linecap="round"/>']
  };

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
    'gear': '<circle cx="12" cy="12" r="3"/><path d="M12 3.5v2.3M12 18.2v2.3M3.5 12h2.3M18.2 12h2.3M6 6l1.6 1.6M16.4 16.4L18 18M18 6l-1.6 1.6M7.6 16.4L6 18"/>',
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
    'task-view': '<rect x="3.5" y="7" width="12.5" height="9.5" rx="2"/><path d="M8 7V6a2 2 0 0 1 2-2h8.5a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2H16"/>',
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
    'fl-recycle': '<path d="M12 5.2l3.6 6.2M16 17.8H8.800M8.200 11.200l3.400-5.800"/><path d="M15.300 9.800l.5 2.200-2.200.1M13.800 18.800l-2.100-1.100 1.400-1.700M7.700 12.300l1.500-1.800 1.600 1.300"/>',

    /* quick-access folders in the Explorer navigation pane (small, coloured) */
    'qa-desktop': ['0 0 24 24', '<rect x="3" y="4.5" width="18" height="12.5" rx="2" fill="#2f86e8"/><rect x="4.5" y="6" width="15" height="9.5" rx="1" fill="#8fd0ff"/><path d="M9 20h6M12 17v3" stroke="#6b7a90" stroke-width="1.6" stroke-linecap="round"/>'],
    'qa-downloads': ['0 0 24 24', '<path d="M12 3.5v11M7 10l5 5 5-5" fill="none" stroke="#2e9e5b" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 19.5h14" stroke="#2e9e5b" stroke-width="2.2" stroke-linecap="round"/>'],
    'qa-documents': ['0 0 24 24', '<path d="M6.5 3h8l4 4v12.500a1.500 1.500 0 0 1-1.500 1.500h-10.500A1.500 1.500 0 0 1 5 19.500v-15A1.500 1.500 0 0 1 6.500 3z" fill="#e9eef6" stroke="#8a99b0" stroke-width="1.100"/><path d="M14.500 3v4h4" fill="#cfd8e6" stroke="#8a99b0" stroke-width="1.100" stroke-linejoin="round"/><path d="M8 11.500h8M8 14.500h8M8 17.500h5" stroke="#6f88b0" stroke-width="1.300" stroke-linecap="round"/>'],
    'qa-pictures': ['0 0 24 24', '<rect x="3" y="4.500" width="18" height="15" rx="2.200" fill="#58b4ff"/><circle cx="16.500" cy="9.500" r="1.800" fill="#fff"/><path d="M3 16.500l5-5 4 3.500 3-2.500 6 5.500v.5a2.200 2.200 0 0 1-2.200 2.200H5.200A2.200 2.200 0 0 1 3 17.500z" fill="#2563c9"/>'],
    'qa-music': ['0 0 24 24', '<path d="M9 17.500V6l10-2v11.500" fill="none" stroke="#e8710a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="6.800" cy="17.500" r="2.800" fill="#e8710a"/><circle cx="16.800" cy="15.500" r="2.800" fill="#e8710a"/>'],
    'qa-videos': ['0 0 24 24', '<rect x="3" y="5" width="18" height="14" rx="2.500" fill="#8a5cd6"/><path d="M10 9l5.500 3-5.500 3z" fill="#fff"/>']
  };
  Object.keys(glyphs).forEach(function (k) { defs[k] = Array.isArray(glyphs[k]) ? glyphs[k] : g(glyphs[k]); });
  Object.keys(defs).forEach(function (k) { reg[k] = { vb: defs[k][0], inner: defs[k][1] }; });

  /* the tiny flat picture at the right end of the taskbar search box (a sun over two hills; our own drawing) */
  reg['search-art'] = { vb: '0 0 24 24', inner: '<circle cx="8.5" cy="8.5" r="3.3" fill="#f6c453"/><path d="M2 21c3-6.4 6.200-8.600 9.500-8.600 2.400 0 4.200 1.200 5.600 3 .9-1.200 2.800-2.200 4.900-2.200V21z" fill="#63aee0"/><path d="M2 21c2.600-3.400 5.200-5 8.200-5 2.200 0 4 .9 5.500 2.600L22 21z" fill="#3a82bd"/>' };

  /* The Windows Start logo: four panes in a blue gradient. Drawn as its own entry because it needs a gradient. */
  reg['start'] = { vb: '0 0 24 24', inner: '<defs><linearGradient id="lab-w-st" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#62cdff"/><stop offset="1" stop-color="#0a6fd8"/></linearGradient></defs>' +
    '<g fill="url(#lab-w-st)"><rect x="2.6" y="2.6" width="8.7" height="8.7" rx="1.2"/><rect x="12.7" y="2.6" width="8.7" height="8.7" rx="1.2"/><rect x="2.6" y="12.7" width="8.7" height="8.7" rx="1.2"/><rect x="12.7" y="12.7" width="8.7" height="8.7" rx="1.2"/></g>' };

  /* Size normalisation: Codex was drawn on a 1024 grid with the squircle at 8..1016, so it looked larger than the other tiles; scale about the centre. */
  var NORM = { 'app-codex': 0.889 };
  Object.keys(NORM).forEach(function (k) {
    if (!reg[k]) return;
    var s = NORM[k], t = (512 * (1 - s)).toFixed(2);
    reg[k].inner = '<g transform="translate(' + t + ' ' + t + ') scale(' + s + ')">' + reg[k].inner + '</g>';
  });

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
