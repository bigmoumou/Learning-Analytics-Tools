/* icons.js [SKIN] — LAB.icons: all icons are original inline SVG (DESIGN §2.3, §0.2).
   Round 6: every tile shares one macOS-26 squircle with a glass sheen, the folder / trash / document icons are redrawn with real depth,
   and get() renames the ids inside each SVG so no copy depends on another copy being in the page (a first copy inside a hidden panel
   used to break the gradients of the visible ones in some browsers). */
(function (LAB) {
  'use strict';

  var reg = Object.create(null);   // name -> {vb, inner, rx, fn}

  /* One hidden-but-rendered sprite holds the gradients (display:none would break url(#id) in some browsers). */
  var SPRITE =
    '<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>' +
    '<linearGradient id="lab-g-folder" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9fd3ff"/><stop offset="1" stop-color="#5aa7ee"/></linearGradient>' +
    '<linearGradient id="lab-g-blue" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5db0ff"/><stop offset="1" stop-color="#1c6fe0"/></linearGradient>' +
    '<linearGradient id="lab-g-code" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3aa0ff"/><stop offset="1" stop-color="#0a5fcf"/></linearGradient>' +
    '<linearGradient id="lab-g-grey" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e9ebef"/><stop offset="1" stop-color="#b9bec8"/></linearGradient>' +
    '<linearGradient id="lab-g-trash" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4f6f8" stop-opacity=".95"/><stop offset="1" stop-color="#c2c8d2" stop-opacity=".92"/></linearGradient>' +
    '</defs></svg>';

  var A = '0 0 64 64', K = '0 0 1024 1024';
  var defs = {
    /* ---- the first-round app tiles that were already good (Finder, Terminal, Codex, Code, TextEdit): kept as drawn ---- */
    'app-finder': ["0 0 1024 1024", "<defs><linearGradient id=\"lab-i-finder-b\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"1\"><stop offset=\"0\" stop-color=\"#00c9ff\"/><stop offset=\".37\" stop-color=\"#00a8ff\"/><stop offset=\".68\" stop-color=\"#0185ff\"/><stop offset=\"1\" stop-color=\"#006fff\"/></linearGradient><linearGradient id=\"lab-i-finder-f\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"1\"><stop offset=\"0\" stop-color=\"#fff\"/><stop offset=\".36\" stop-color=\"#e3f7ff\"/><stop offset=\".6\" stop-color=\"#c6effd\"/><stop offset=\".74\" stop-color=\"#a9dafc\"/><stop offset=\"1\" stop-color=\"#86c5fa\"/></linearGradient><linearGradient id=\"lab-i-finder-h\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"1\"><stop offset=\"0\" stop-color=\"#fff\" stop-opacity=\".05\"/><stop offset=\".3\" stop-color=\"#fff\" stop-opacity=\"0\"/></linearGradient><linearGradient id=\"lab-i-finder-r\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"1\"><stop offset=\"0\" stop-color=\"#fff\" stop-opacity=\".14\"/><stop offset=\".25\" stop-color=\"#fff\" stop-opacity=\".08\"/><stop offset=\".8\" stop-color=\"#fff\" stop-opacity=\"0\"/><stop offset=\"1\" stop-color=\"#fff\" stop-opacity=\".1\"/></linearGradient><clipPath id=\"lab-i-finder-c\"><path d=\"M659.2 64C764.5 64 817.1 64 857.4 84.5A188 188 0 0 1 939.5 166.6C960 206.9 960 259.5 960 364.8L960 659.2C960 764.5 960 817.1 939.5 857.4A188 188 0 0 1 857.4 939.5C817.1 960 764.5 960 659.2 960L364.8 960C259.5 960 206.9 960 166.6 939.5A188 188 0 0 1 84.5 857.4C64 817.1 64 764.5 64 659.2L64 364.8C64 259.5 64 206.9 84.5 166.6A188 188 0 0 1 166.6 84.5C206.9 64 259.5 64 364.8 64Z\"/></clipPath></defs><path d=\"M659.2 64C764.5 64 817.1 64 857.4 84.5A188 188 0 0 1 939.5 166.6C960 206.9 960 259.5 960 364.8L960 659.2C960 764.5 960 817.1 939.5 857.4A188 188 0 0 1 857.4 939.5C817.1 960 764.5 960 659.2 960L364.8 960C259.5 960 206.9 960 166.6 939.5A188 188 0 0 1 84.5 857.4C64 817.1 64 764.5 64 659.2L64 364.8C64 259.5 64 206.9 84.5 166.6A188 188 0 0 1 166.6 84.5C206.9 64 259.5 64 364.8 64Z\" fill=\"url(#lab-i-finder-b)\"/><g transform=\"matrix(3.5 0 0 3.5 -41 -128.5)\"><path d=\"M184 73H230C252 73 261 84 261 108V250C261 276 250 286 226 286H182C164 286 157 277 157 260V199Q157 196 150 196L137 196C129 196 126 190 127 183C128 172 133 160 137 150C143 136 148 118 152 102C155 90 159 80 168 75Q176 73 186 73Z\" fill=\"none\" stroke=\"#c8f4ff\" stroke-opacity=\".3\" stroke-width=\"2.5\" stroke-linejoin=\"round\"/><path d=\"M184 73H230C252 73 261 84 261 108V250C261 276 250 286 226 286H182C164 286 157 277 157 260V199Q157 196 150 196L137 196C129 196 126 190 127 183C128 172 133 160 137 150C143 136 148 118 152 102C155 90 159 80 168 75Q176 73 186 73Z\" fill=\"url(#lab-i-finder-f)\"/><rect x=\"92.9\" y=\"129\" width=\"6.2\" height=\"23\" rx=\"3.1\" fill=\"#0a2038\"/><rect x=\"201.9\" y=\"129\" width=\"6.2\" height=\"23\" rx=\"3.1\" fill=\"#0a2038\"/><path d=\"M78 220C100 245 125 255 155 254C185 253 210 240 224 218\" fill=\"none\" stroke=\"#0a2a4d\" stroke-width=\"5.6\" stroke-linecap=\"round\"/></g><path d=\"M659.2 64C764.5 64 817.1 64 857.4 84.5A188 188 0 0 1 939.5 166.6C960 206.9 960 259.5 960 364.8L960 659.2C960 764.5 960 817.1 939.5 857.4A188 188 0 0 1 857.4 939.5C817.1 960 764.5 960 659.2 960L364.8 960C259.5 960 206.9 960 166.6 939.5A188 188 0 0 1 84.5 857.4C64 817.1 64 764.5 64 659.2L64 364.8C64 259.5 64 206.9 84.5 166.6A188 188 0 0 1 166.6 84.5C206.9 64 259.5 64 364.8 64Z\" fill=\"url(#lab-i-finder-h)\"/><path d=\"M659.2 64C764.5 64 817.1 64 857.4 84.5A188 188 0 0 1 939.5 166.6C960 206.9 960 259.5 960 364.8L960 659.2C960 764.5 960 817.1 939.5 857.4A188 188 0 0 1 857.4 939.5C817.1 960 764.5 960 659.2 960L364.8 960C259.5 960 206.9 960 166.6 939.5A188 188 0 0 1 84.5 857.4C64 817.1 64 764.5 64 659.2L64 364.8C64 259.5 64 206.9 84.5 166.6A188 188 0 0 1 166.6 84.5C206.9 64 259.5 64 364.8 64Z\" fill=\"none\" stroke=\"url(#lab-i-finder-r)\" stroke-width=\"6\" clip-path=\"url(#lab-i-finder-c)\"/>"],
    'app-terminal': ["0 0 1024 1024", "<defs><linearGradient id=\"lab-i-terminal-b\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"1\"><stop offset=\"0\" stop-color=\"#322f30\"/><stop offset=\".5\" stop-color=\"#272324\"/><stop offset=\"1\" stop-color=\"#1a1718\"/></linearGradient><linearGradient id=\"lab-i-terminal-r\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"1\"><stop offset=\"0\" stop-color=\"#b8b8bc\" stop-opacity=\".55\"/><stop offset=\".35\" stop-color=\"#808084\" stop-opacity=\".25\"/><stop offset=\"1\" stop-color=\"#6a6a6e\" stop-opacity=\".06\"/></linearGradient><path id=\"lab-i-terminal-s\" d=\"M972 512C972 578 971 665 969 710C968 755 965 761 962 782C958 802 954 818 948 833C943 849 937 861 930 873C922 885 914 896 905 905C896 914 885 922 873 930C861 937 849 943 833 948C818 954 802 958 782 962C761 965 755 968 710 969C665 971 578 972 512 972C446 972 359 971 314 969C269 968 263 965 242 962C222 958 206 954 191 948C175 943 163 937 151 930C139 922 128 914 119 905C110 896 102 885 94 873C87 861 81 849 76 833C70 818 66 802 62 782C59 761 56 755 55 710C53 665 52 578 52 512C52 446 53 359 55 314C56 269 59 263 62 242C66 222 70 206 76 191C81 175 87 163 94 151C102 139 110 128 119 119C128 110 139 102 151 94C163 87 175 81 191 76C206 70 222 66 242 62C263 59 269 56 314 55C359 53 446 52 512 52C578 52 665 53 710 55C755 56 761 59 782 62C802 66 818 70 833 76C849 81 861 87 873 94C885 102 896 110 905 119C914 128 922 139 930 151C937 163 943 175 948 191C954 206 958 222 962 242C965 263 968 269 969 314C971 359 972 446 972 512Z\"/></defs><use href=\"#lab-i-terminal-s\" fill=\"url(#lab-i-terminal-b)\"/><use href=\"#lab-i-terminal-s\" fill=\"none\" stroke=\"url(#lab-i-terminal-r)\" stroke-width=\"9\"/><path d=\"M240 252L392 352 240 452\" fill=\"none\" stroke=\"#fff\" stroke-width=\"37\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><rect x=\"410\" y=\"502\" width=\"216\" height=\"44\" rx=\"10\" fill=\"#acacaf\"/>"],
    'app-codex': ["0 0 1024 1024", "<defs><linearGradient id=\"lab-i-codex-bg\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"1\"><stop offset=\"0\" stop-color=\"#212123\"/><stop offset=\"1\" stop-color=\"#19191b\"/></linearGradient><linearGradient id=\"lab-i-codex-cl\" gradientUnits=\"userSpaceOnUse\" x1=\"0\" y1=\"110\" x2=\"0\" y2=\"895\"><stop offset=\"0\" stop-color=\"#c9a6f6\"/><stop offset=\".3\" stop-color=\"#9a92f8\"/><stop offset=\".52\" stop-color=\"#6074fb\"/><stop offset=\"1\" stop-color=\"#2d34f2\"/></linearGradient><radialGradient id=\"lab-i-codex-rim\" gradientUnits=\"userSpaceOnUse\" cx=\"516\" cy=\"525\" r=\"410\"><stop offset=\".6\" stop-color=\"#2326e0\" stop-opacity=\"0\"/><stop offset=\"1\" stop-color=\"#2326e0\" stop-opacity=\".85\"/></radialGradient><radialGradient id=\"lab-i-codex-hi\" gradientUnits=\"userSpaceOnUse\" cx=\"520\" cy=\"235\" r=\"280\"><stop offset=\"0\" stop-color=\"#f0c4ee\" stop-opacity=\".72\"/><stop offset=\"1\" stop-color=\"#f0c4ee\" stop-opacity=\"0\"/></radialGradient><radialGradient id=\"lab-i-codex-lo\" gradientUnits=\"userSpaceOnUse\" cx=\"500\" cy=\"740\" r=\"280\"><stop offset=\"0\" stop-color=\"#4a6cff\" stop-opacity=\".4\"/><stop offset=\"1\" stop-color=\"#4a6cff\" stop-opacity=\"0\"/></radialGradient><linearGradient id=\"lab-i-codex-sh\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"1\"><stop offset=\"0\" stop-color=\"#fff\" stop-opacity=\".07\"/><stop offset=\".25\" stop-color=\"#fff\" stop-opacity=\"0\"/></linearGradient><clipPath id=\"lab-i-codex-clip\"><circle cx=\"516\" cy=\"269\" r=\"164\"/><circle cx=\"706\" cy=\"346\" r=\"158\"/><circle cx=\"761\" cy=\"557\" r=\"160\"/><circle cx=\"631\" cy=\"722\" r=\"158\"/><circle cx=\"428\" cy=\"724\" r=\"162\"/><circle cx=\"282\" cy=\"581\" r=\"158\"/><circle cx=\"295\" cy=\"388\" r=\"160\"/><circle cx=\"516\" cy=\"505\" r=\"356\"/></clipPath></defs><rect x=\"8\" y=\"8\" width=\"1008\" height=\"1008\" rx=\"228\" fill=\"url(#lab-i-codex-bg)\"/><rect x=\"8\" y=\"8\" width=\"1008\" height=\"1008\" rx=\"228\" fill=\"url(#lab-i-codex-sh)\"/><g clip-path=\"url(#lab-i-codex-clip)\"><rect x=\"90\" y=\"90\" width=\"850\" height=\"850\" fill=\"url(#lab-i-codex-cl)\"/><rect x=\"90\" y=\"90\" width=\"850\" height=\"850\" fill=\"url(#lab-i-codex-rim)\"/><rect x=\"90\" y=\"90\" width=\"850\" height=\"450\" fill=\"url(#lab-i-codex-hi)\"/><rect x=\"90\" y=\"500\" width=\"850\" height=\"440\" fill=\"url(#lab-i-codex-lo)\"/></g><path d=\"M350 388L428 498L350 608\" fill=\"none\" stroke=\"#eef0ff\" stroke-opacity=\".88\" stroke-width=\"46\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M545 618H705\" fill=\"none\" stroke=\"#eef0ff\" stroke-opacity=\".88\" stroke-width=\"46\" stroke-linecap=\"round\"/>"],
    'app-code': ["0 0 1024 1024", "<defs><linearGradient id=\"lab-i-code-bg\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"1\"><stop offset=\"0\" stop-color=\"#fff\"/><stop offset=\".72\" stop-color=\"#fff\"/><stop offset=\"1\" stop-color=\"#f6f7f9\"/></linearGradient><linearGradient id=\"lab-i-code-a\" x1=\"0\" y1=\"0\" x2=\"1\" y2=\"1\"><stop offset=\"0\" stop-color=\"#0b82d6\"/><stop offset=\"1\" stop-color=\"#0a6fc3\"/></linearGradient><linearGradient id=\"lab-i-code-b\" x1=\"0\" y1=\"1\" x2=\"1\" y2=\"0\"><stop offset=\"0\" stop-color=\"#0a70c4\"/><stop offset=\"1\" stop-color=\"#0963b4\"/></linearGradient><linearGradient id=\"lab-i-code-r\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"1\"><stop offset=\"0\" stop-color=\"#2fa6ff\"/><stop offset=\"1\" stop-color=\"#2090ec\"/></linearGradient></defs><path d=\"M960 512L959 667L957 721L953 761L948 793L941 820L933 843L923 864L911 882L897 897L882 911L864 923L843 933L820 941L793 948L761 953L721 957L667 959L512 960L357 959L303 957L263 953L231 948L204 941L181 933L160 923L142 911L127 897L113 882L101 864L91 843L83 820L76 793L71 761L67 721L65 667L64 512L65 357L67 303L71 263L76 231L83 204L91 181L101 160L113 142L127 127L142 113L160 101L181 91L204 83L231 76L263 71L303 67L357 65L512 64L667 65L721 67L761 71L793 76L820 83L843 91L864 101L882 113L897 127L911 142L923 160L933 181L941 204L948 231L953 263L957 303L959 357Z\" fill=\"url(#lab-i-code-bg)\"/><path d=\"M958 512L958 667L956 721L952 760L947 792L940 819L931 842L921 863L910 880L896 896L880 910L863 921L842 931L819 940L792 947L760 952L721 956L667 958L512 958L357 958L303 956L264 952L232 947L205 940L182 931L161 921L144 910L128 896L114 880L103 863L93 842L84 819L77 792L72 760L68 721L66 667L66 512L66 357L68 303L72 264L77 232L84 205L93 182L103 161L114 144L128 128L144 114L161 103L182 93L205 84L232 77L264 72L303 68L357 66L512 66L667 66L721 68L760 72L792 77L819 84L842 93L863 103L880 114L896 128L910 144L921 161L931 182L940 205L947 232L952 264L956 303L958 357Z\" fill=\"none\" stroke=\"#000\" stroke-opacity=\".08\" stroke-width=\"3\"/><path d=\"M264 650L643 338L643 245L217 593Z\" fill=\"url(#lab-i-code-b)\" stroke=\"url(#lab-i-code-b)\" stroke-width=\"63.5\" stroke-linejoin=\"round\"/><path d=\"M217 410L643 758L643 665L264 353Z\" fill=\"url(#lab-i-code-a)\" stroke=\"url(#lab-i-code-a)\" stroke-width=\"63.5\" stroke-linejoin=\"round\"/><path d=\"M671 237L812 307L812 755L671 819Z\" fill=\"url(#lab-i-code-r)\" stroke=\"url(#lab-i-code-r)\" stroke-width=\"38.1\" stroke-linejoin=\"round\"/>"],
    'app-textedit': ["0 0 1024 1024", "<defs>\n<linearGradient id=\"lab-i-textedit-p\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"1\"><stop offset=\"0\" stop-color=\"#fff\"/><stop offset=\"1\" stop-color=\"#e4e8ef\"/></linearGradient>\n<linearGradient id=\"lab-i-textedit-e\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"1\"><stop offset=\".88\" stop-color=\"#000\" stop-opacity=\"0\"/><stop offset=\"1\" stop-color=\"#000\" stop-opacity=\".06\"/></linearGradient>\n<linearGradient id=\"lab-i-textedit-l\" gradientUnits=\"userSpaceOnUse\" x1=\"56\" y1=\"0\" x2=\"968\" y2=\"0\"><stop offset=\"0\" stop-color=\"#dfe4ee\" stop-opacity=\"0\"/><stop offset=\".2\" stop-color=\"#dfe4ee\"/><stop offset=\".8\" stop-color=\"#dfe4ee\"/><stop offset=\"1\" stop-color=\"#dfe4ee\" stop-opacity=\"0\"/></linearGradient>\n<linearGradient id=\"lab-i-textedit-h\" gradientUnits=\"userSpaceOnUse\" x1=\"281\" y1=\"0\" x2=\"743\" y2=\"0\"><stop offset=\"0\" stop-color=\"#fff\" stop-opacity=\"0\"/><stop offset=\".25\" stop-color=\"#fff\" stop-opacity=\".95\"/><stop offset=\".75\" stop-color=\"#fff\" stop-opacity=\".95\"/><stop offset=\"1\" stop-color=\"#fff\" stop-opacity=\"0\"/></linearGradient>\n<linearGradient id=\"lab-i-textedit-b\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"1\"><stop offset=\"0\" stop-color=\"#666b78\"/><stop offset=\".18\" stop-color=\"#3a3e48\"/><stop offset=\".55\" stop-color=\"#16181d\"/><stop offset=\"1\" stop-color=\"#050608\"/></linearGradient>\n<linearGradient id=\"lab-i-textedit-s\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"1\"><stop offset=\"0\" stop-color=\"#f7f8fa\"/><stop offset=\".45\" stop-color=\"#b9bdc6\"/><stop offset=\"1\" stop-color=\"#7f8491\"/></linearGradient>\n<linearGradient id=\"lab-i-textedit-n\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"1\"><stop offset=\"0\" stop-color=\"#ffe9a8\"/><stop offset=\".5\" stop-color=\"#e0b254\"/><stop offset=\"1\" stop-color=\"#c48d2c\"/></linearGradient>\n<clipPath id=\"lab-i-textedit-c\"><path d=\"M281 56H743C896 56 968 128 968 281V743C968 896 896 968 743 968H281C128 968 56 896 56 743V281C56 128 128 56 281 56Z\"/></clipPath>\n<filter id=\"lab-i-textedit-f\" x=\"-20%\" y=\"-20%\" width=\"140%\" height=\"140%\"><feGaussianBlur stdDeviation=\"10\"/></filter>\n</defs>\n<path d=\"M281 56H743C896 56 968 128 968 281V743C968 896 896 968 743 968H281C128 968 56 896 56 743V281C56 128 128 56 281 56Z\" fill=\"url(#lab-i-textedit-p)\"/>\n<g clip-path=\"url(#lab-i-textedit-c)\">\n<g transform=\"rotate(-4 512 512)\" stroke=\"url(#lab-i-textedit-l)\" stroke-width=\"9\" stroke-linecap=\"round\" fill=\"none\"><path d=\"M-60 250H1100\"/><path d=\"M-60 380H1100\"/><path d=\"M-60 510H1100\"/><path d=\"M-60 640H1100\"/><path d=\"M-60 770H1100\"/><path d=\"M-60 900H1100\"/></g>\n<rect x=\"56\" y=\"56\" width=\"912\" height=\"912\" fill=\"url(#lab-i-textedit-e)\"/>\n</g>\n<path d=\"M281 56H743C896 56 968 128 968 281V743C968 896 896 968 743 968H281C128 968 56 896 56 743V281C56 128 128 56 281 56Z\" fill=\"none\" stroke=\"#000\" stroke-opacity=\".10\" stroke-width=\"3\"/>\n<path d=\"M281 60H743\" stroke=\"url(#lab-i-textedit-h)\" stroke-width=\"6\" stroke-linecap=\"round\"/>\n<g transform=\"translate(206 794) rotate(-43) scale(1.36)\">\n <g filter=\"url(#lab-i-textedit-f)\" opacity=\".28\" transform=\"translate(6 18)\"><path d=\"M-30 0L190 -42H640V48H190Z\" fill=\"#000\"/></g>\n <path d=\"M-30 0C40 -10 130 -36 190 -42Q234 -46 238 -30V30Q234 46 190 42C130 36 40 10 -30 0Z\" fill=\"url(#lab-i-textedit-n)\"/>\n <path d=\"M-30 0C40 10 130 36 190 42Q234 46 238 30\" fill=\"none\" stroke=\"#8a5f1c\" stroke-width=\"4\" stroke-linecap=\"round\"/>\n <path d=\"M-26 -2C42 -12 130 -37 190 -43\" fill=\"none\" stroke=\"#fff\" stroke-opacity=\".5\" stroke-width=\"4\" stroke-linecap=\"round\"/>\n <path d=\"M-22 0H146\" stroke=\"#6e4a12\" stroke-width=\"3.5\" stroke-linecap=\"round\"/>\n <circle cx=\"150\" cy=\"0\" r=\"8\" fill=\"#5a3d0e\"/>\n <path d=\"M240 -43L300 -49V49L240 43Z\" fill=\"url(#lab-i-textedit-b)\"/>\n <rect x=\"296\" y=\"-52\" width=\"30\" height=\"104\" rx=\"6\" fill=\"url(#lab-i-textedit-s)\" stroke=\"#5a5f6b\" stroke-opacity=\".5\" stroke-width=\"2\"/>\n <rect x=\"340\" y=\"-52\" width=\"12\" height=\"104\" rx=\"5\" fill=\"url(#lab-i-textedit-s)\" stroke=\"#5a5f6b\" stroke-opacity=\".5\" stroke-width=\"2\"/>\n <path d=\"M352 -50H610Q640 -50 640 -22V22Q640 50 610 50H352Z\" fill=\"url(#lab-i-textedit-b)\"/>\n <rect x=\"440\" y=\"-51\" width=\"14\" height=\"102\" fill=\"url(#lab-i-textedit-s)\"/>\n <path d=\"M628 -30Q634 -12 634 0\" stroke=\"#fff\" stroke-opacity=\".22\" stroke-width=\"5\" stroke-linecap=\"round\" fill=\"none\"/><path d=\"M366 -38H620\" stroke=\"#fff\" stroke-opacity=\".38\" stroke-width=\"7\" stroke-linecap=\"round\"/><path d=\"M364 42H616\" stroke=\"#8a93a6\" stroke-opacity=\".45\" stroke-width=\"5\" stroke-linecap=\"round\"/>\n</g>"]
  };

  /* ================================================================== round 6: shared helpers ================================================================== */
  function fx(n) { return String(Math.round(n * 10) / 10); }
  function hexMix(hex, to, t) {                 // blend #rrggbb towards grey level `to` (0 black, 255 white) by t
    var n = parseInt(hex.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255];
    return '#' + c.map(function (v) { var r = Math.round(v + (to - v) * t); return (r < 16 ? '0' : '') + r.toString(16); }).join('');
  }
  function lighten(hex, t) { return hexMix(hex, 255, t); }
  function darken(hex, t) { return hexMix(hex, 0, t); }
  /* linear gradient: stops [[offset, colour, opacity?]], dir [x1,y1,x2,y2,userSpace?] (default top to bottom on the shape) */
  function lg(id, stops, d) {
    d = d || [0, 0, 0, 1];
    return '<linearGradient id="' + id + '" x1="' + d[0] + '" y1="' + d[1] + '" x2="' + d[2] + '" y2="' + d[3] + '"' + (d[4] ? ' gradientUnits="userSpaceOnUse"' : '') + '>' +
      stops.map(function (s) { return '<stop offset="' + s[0] + '" stop-color="' + s[1] + '"' + (s[2] != null ? ' stop-opacity="' + s[2] + '"' : '') + '/>'; }).join('') + '</linearGradient>';
  }
  function blur(id, sd, pad) {
    pad = pad || 30;
    return '<filter id="' + id + '" x="-' + pad + '%" y="-' + pad + '%" width="' + (100 + 2 * pad) + '%" height="' + (100 + 2 * pad) + '%"><feGaussianBlur stdDeviation="' + sd + '"/></filter>';
  }
  function rnd(seed) { var s = seed; return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }

  /* the macOS-style tile: a superellipse (n = 5, continuous corners like the real icons) drawn as one smooth closed curve, 64..960 on the 1024 grid */
  function squircle(x0, y0, s, n) {
    var c = x0 + s / 2, a = s / 2, N = 64, P = [], i, t, ct, st;
    for (i = 0; i < N; i++) {
      t = (i / N) * 2 * Math.PI; ct = Math.cos(t); st = Math.sin(t);
      P.push([c + a * (ct < 0 ? -1 : 1) * Math.pow(Math.abs(ct), 2 / n), c + a * (st < 0 ? -1 : 1) * Math.pow(Math.abs(st), 2 / n)]);
    }
    var d = 'M' + fx(P[0][0]) + ' ' + fx(P[0][1]);
    for (i = 0; i < N; i++) {
      var p0 = P[(i + N - 1) % N], p1 = P[i], p2 = P[(i + 1) % N], p3 = P[(i + 2) % N];
      d += 'C' + fx(p1[0] + (p2[0] - p0[0]) / 6) + ' ' + fx(p1[1] + (p2[1] - p0[1]) / 6) + ' ' +
        fx(p2[0] - (p3[0] - p1[0]) / 6) + ' ' + fx(p2[1] - (p3[1] - p1[1]) / 6) + ' ' + fx(p2[0]) + ' ' + fx(p2[1]);
    }
    return d + 'Z';
  }
  var SQ = squircle(64, 64, 896, 5);

  /* Tile = squircle with a vertical gradient, the art, then the glass sheen shared by every round-5/6 tile:
     a soft top highlight that fades out, a 1-px light rim on the inside edge (bright at the top, faint at the bottom) and a dark hairline. */
  function tile(id, c0, c1, art, o) {
    o = o || {};
    var p = 'lab-i-' + id;
    return '<defs><path id="' + p + '-s" d="' + SQ + '"/><clipPath id="' + p + '-q"><use href="#' + p + '-s"/></clipPath>' +
      lg(p + '-b', [[0, c0], [1, c1]]) +
      lg(p + '-h', [[0, '#fff', o.hi || 0.30], [0.6, '#fff', 0.05], [1, '#fff', 0]]) +
      lg(p + '-r', [[0, '#fff', 0.78], [0.3, '#fff', 0.14], [0.72, '#fff', 0.04], [1, '#fff', 0.34]]) +
      '</defs>' +
      '<use href="#' + p + '-s" fill="url(#' + p + '-b)"/>' + art +
      '<g clip-path="url(#' + p + '-q)"><path d="M64 64H960V420Q512 560 64 420Z" fill="url(#' + p + '-h)"/>' +
      '<use href="#' + p + '-s" fill="none" stroke="url(#' + p + '-r)" stroke-width="12"/></g>' +
      '<use href="#' + p + '-s" fill="none" stroke="#000" stroke-opacity=".15" stroke-width="3"/>';
  }

  function gearPath(cx, cy, ro, rr, teeth, hole) {
    var step = (Math.PI * 2) / teeth, d = '';
    for (var i = 0; i < teeth; i++) {
      var a = i * step - Math.PI / 2;
      var p = [[rr, a - step * 0.30], [ro, a - step * 0.16], [ro, a + step * 0.16], [rr, a + step * 0.30]];
      for (var k = 0; k < 4; k++) d += (i === 0 && k === 0 ? 'M' : 'L') + (cx + p[k][0] * Math.cos(p[k][1])).toFixed(1) + ' ' + (cy + p[k][0] * Math.sin(p[k][1])).toFixed(1);
    }
    return d + 'Z M' + (cx + hole) + ' ' + cy + 'a' + hole + ' ' + hole + ' 0 1 0 ' + (-2 * hole) + ' 0a' + hole + ' ' + hole + ' 0 1 0 ' + (2 * hole) + ' 0Z';
  }

  /* ================================================================== system app tiles ================================================================== */
  /* 系統設定: a brushed-steel gear on a pale grey tile */
  defs['app-settings'] = [K, tile('set', '#eef0f3', '#aab0bb',
    '<defs>' + lg('lab-i-set-g', [[0, '#a3a9b4'], [0.5, '#7b818c'], [1, '#4d535e']]) + lg('lab-i-set-e', [[0, '#fff', 0.75], [0.5, '#fff', 0]]) +
    '<path id="lab-i-set-p" d="' + gearPath(512, 512, 338, 270, 12, 120) + '" fill-rule="evenodd"/>' + blur('lab-i-set-f', 14) + '</defs>' +
    '<use href="#lab-i-set-p" transform="translate(0 20)" fill="#1a2030" fill-opacity=".30" fill-rule="evenodd" filter="url(#lab-i-set-f)"/>' +
    '<use href="#lab-i-set-p" fill="url(#lab-i-set-g)" fill-rule="evenodd"/>' +
    '<use href="#lab-i-set-p" fill="none" stroke="url(#lab-i-set-e)" stroke-width="8" stroke-linejoin="round"/>' +
    '<circle cx="512" cy="512" r="212" fill="none" stroke="#000" stroke-opacity=".16" stroke-width="10"/><circle cx="512" cy="518" r="212" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="6"/>' +
    '<circle cx="512" cy="512" r="124" fill="none" stroke="#2d323b" stroke-opacity=".5" stroke-width="12"/>')];

  /* 計算機: dark body, glassy display, three grey columns and an orange one */
  var calcKeys = '';
  (function () {
    for (var r = 0; r < 4; r++) for (var c = 0; c < 4; c++) {
      calcKeys += '<rect x="' + (160 + c * 182) + '" y="' + (386 + r * 128) + '" width="158" height="108" rx="32" fill="url(#lab-i-calc-k' + (c === 3 ? 2 : (r === 0 ? 0 : 1)) + ')"/>';
    }
  })();
  defs['app-calculator'] = [K, tile('calc', '#58585e', '#18181a',
    '<defs>' + lg('lab-i-calc-k0', [[0, '#c2c2c8'], [1, '#98989e']]) + lg('lab-i-calc-k1', [[0, '#85858b'], [1, '#5e5e64']]) + lg('lab-i-calc-k2', [[0, '#ffb23d'], [1, '#ff8a00']]) +
    lg('lab-i-calc-d', [[0, '#0a0a0b'], [1, '#1b1b1e']]) + '</defs>' +
    '<rect x="160" y="150" width="704" height="206" rx="42" fill="url(#lab-i-calc-d)"/><rect x="161.500" y="151.500" width="701" height="203" rx="40.500" fill="none" stroke="#fff" stroke-opacity=".16" stroke-width="3"/>' +
    '<ellipse cx="772" cy="256" rx="36" ry="54" fill="none" stroke="#fff" stroke-width="24"/>' + calcKeys)];

  /* 活動監視器: a black screen with a red and a green trace */
  defs['app-activity'] = [K, tile('act', '#44464d', '#0e0f12',
    '<defs>' + lg('lab-i-act-g', [[0, '#050607'], [1, '#14171c']]) + blur('lab-i-act-f', 10) + '</defs>' +
    '<rect x="140" y="160" width="744" height="704" rx="56" fill="url(#lab-i-act-g)"/><rect x="141.500" y="161.500" width="741" height="701" rx="54.500" fill="none" stroke="#fff" stroke-opacity=".14" stroke-width="3"/>' +
    '<path d="M140 392H884M140 512H884M140 632H884M140 752H884M326 160V864M512 160V864M698 160V864" stroke="#fff" stroke-opacity=".07" stroke-width="4"/>' +
    '<path d="M170 740H290L350 600L420 760L500 430L580 700L640 600H720L854 520" fill="none" stroke="#ff453a" stroke-width="26" stroke-linecap="round" stroke-linejoin="round" stroke-opacity=".55" filter="url(#lab-i-act-f)"/>' +
    '<path d="M170 560H280L340 440L410 650L490 320L570 600L650 470H740L854 380" fill="none" stroke="#30d158" stroke-width="30" stroke-linecap="round" stroke-linejoin="round" stroke-opacity=".5" filter="url(#lab-i-act-f)"/>' +
    '<path d="M170 740H290L350 600L420 760L500 430L580 700L640 600H720L854 520" fill="none" stroke="#ff5a4f" stroke-width="22" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M170 560H280L340 440L410 650L490 320L570 600L650 470H740L854 380" fill="none" stroke="#3be06a" stroke-width="24" stroke-linecap="round" stroke-linejoin="round"/>')];

  /* Safari-like compass (our own drawing): silver bezel, azure dial with 60 ticks, a coral/white needle on a 40-degree slant */
  var ticks = '';
  (function () {
    for (var i = 0; i < 60; i++) {
      var a = (i / 60) * 2 * Math.PI, c15 = i % 15 === 0, c5 = i % 5 === 0, r0 = c15 ? 262 : (c5 ? 280 : 304), r1 = 332;
      ticks += '<path d="M' + fx(512 + r0 * Math.cos(a)) + ' ' + fx(512 + r0 * Math.sin(a)) + 'L' + fx(512 + r1 * Math.cos(a)) + ' ' + fx(512 + r1 * Math.sin(a)) + '" stroke="#fff" stroke-opacity="' + (c5 ? '.95' : '.6') + '" stroke-width="' + (c15 ? 16 : (c5 ? 11 : 6)) + '" stroke-linecap="round"/>';
    }
  })();
  defs['app-safari'] = [K, tile('saf', '#ffffff', '#d9e3f1',
    '<defs>' + lg('lab-i-saf-o', [[0, '#ffffff'], [1, '#aeb8c8']]) + lg('lab-i-saf-i', [[0, '#9aa5b8'], [1, '#f6f8fb']]) + lg('lab-i-saf-d', [[0, '#69d4fc'], [0.55, '#2b8cf2'], [1, '#0d58dd']]) +
    '<radialGradient id="lab-i-saf-l" cx=".36" cy=".24" r=".7"><stop offset="0" stop-color="#fff" stop-opacity=".5"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>' +
    lg('lab-i-saf-n', [[0, '#ff7a6c'], [1, '#e1352b']], [0, 0, 1, 0]) + lg('lab-i-saf-w', [[0, '#ffffff'], [1, '#cfd8e6']], [0, 0, 1, 0]) + blur('lab-i-saf-f', 11) + '</defs>' +
    '<circle cx="512" cy="522" r="408" fill="#0b2f6b" fill-opacity=".18" filter="url(#lab-i-saf-f)"/>' +
    '<circle cx="512" cy="512" r="404" fill="url(#lab-i-saf-o)"/><circle cx="512" cy="512" r="374" fill="url(#lab-i-saf-i)"/>' +
    '<circle cx="512" cy="512" r="358" fill="url(#lab-i-saf-d)"/><circle cx="512" cy="512" r="358" fill="url(#lab-i-saf-l)"/>' + ticks +
    '<g transform="rotate(42 512 512)"><path d="M512 232L586 512H438Z" transform="translate(0 16)" fill="#000" fill-opacity=".28" filter="url(#lab-i-saf-f)"/>' +
    '<path d="M512 792L586 512H438Z" transform="translate(0 16)" fill="#000" fill-opacity=".22" filter="url(#lab-i-saf-f)"/>' +
    '<path d="M512 232L586 512H512Z" fill="#ff6a5c"/><path d="M512 232L438 512H512Z" fill="#e8392e"/>' +
    '<path d="M512 792L586 512H512Z" fill="#f4f7fb"/><path d="M512 792L438 512H512Z" fill="#cdd6e4"/></g>' +
    '<circle cx="512" cy="512" r="30" fill="#fff"/><circle cx="512" cy="512" r="30" fill="none" stroke="#000" stroke-opacity=".25" stroke-width="4"/><circle cx="512" cy="512" r="10" fill="#e8392e"/>')];

  /* 預覽程式: a photo print with a magnifier */
  defs['app-preview'] = [K, tile('pv', '#a2d9ff', '#3a86e4',
    '<defs><clipPath id="lab-i-pv-c"><rect x="196" y="196" width="470" height="570" rx="34"/></clipPath>' + lg('lab-i-pv-sky', [[0, '#a8dcff'], [1, '#e3f4ff']]) +
    lg('lab-i-pv-h1', [[0, '#8fd0a8'], [1, '#5fae7e']]) + lg('lab-i-pv-h2', [[0, '#5ab187'], [1, '#378a63']]) + lg('lab-i-pv-sun', [[0, '#fff1a8'], [1, '#ffc73e']]) +
    lg('lab-i-pv-m', [[0, '#5d6472'], [1, '#2a2e37']]) + blur('lab-i-pv-f', 12) + '</defs>' +
    '<g transform="rotate(-7 426 480)"><rect x="196" y="212" width="470" height="570" rx="34" fill="#0a2d63" fill-opacity=".32" filter="url(#lab-i-pv-f)"/>' +
    '<rect x="196" y="196" width="470" height="570" rx="34" fill="#fff"/><g clip-path="url(#lab-i-pv-c)">' +
    '<rect x="228" y="228" width="406" height="336" rx="14" fill="url(#lab-i-pv-sky)"/>' +
    '<path d="M228 564V462L338 372L432 466L506 404L634 516V564Z" fill="url(#lab-i-pv-h1)"/><path d="M228 564V510L318 450L408 520L480 478L634 548V564Z" fill="url(#lab-i-pv-h2)"/>' +
    '<circle cx="548" cy="320" r="42" fill="url(#lab-i-pv-sun)"/><rect x="228" y="604" width="262" height="22" rx="11" fill="#cfd4dc"/><rect x="228" y="650" width="190" height="22" rx="11" fill="#dfe3e9"/></g></g>' +
    '<path d="M752 752L858 858" stroke="#10151f" stroke-opacity=".3" stroke-width="64" stroke-linecap="round" transform="translate(0 12)" filter="url(#lab-i-pv-f)"/>' +
    '<path d="M752 752L858 858" stroke="url(#lab-i-pv-m)" stroke-width="60" stroke-linecap="round"/>' +
    '<circle cx="640" cy="640" r="158" fill="#cfe9ff" fill-opacity=".42"/><circle cx="640" cy="640" r="158" fill="none" stroke="url(#lab-i-pv-m)" stroke-width="44"/>' +
    '<path d="M552 592A104 104 0 0 1 626 546" fill="none" stroke="#fff" stroke-opacity=".8" stroke-width="16" stroke-linecap="round"/>')];

  /* 啟動台 / 應用程式: nine coloured keys on a light tile */
  var lpKeys = '', lpDefs = '';
  (function () {
    var cols = ['#ff5f57', '#febc2e', '#28c840', '#0a84ff', '#bf5af2', '#ff9f0a', '#64d2ff', '#30d158', '#ff375f'];
    for (var i = 0; i < 9; i++) {
      lpDefs += lg('lab-i-lp-k' + i, [[0, lighten(cols[i], 0.28)], [1, darken(cols[i], 0.06)]]);
      lpKeys += '<rect x="' + (217 + (i % 3) * 210) + '" y="' + (217 + Math.floor(i / 3) * 210) + '" width="170" height="170" rx="46" fill="url(#lab-i-lp-k' + i + ')"/>';
    }
  })();
  defs['app-launchpad'] = [K, tile('lp', '#f3f5f8', '#b3b9c4', '<defs>' + lpDefs + '</defs>' + lpKeys)];

  /* 強制結束 */
  defs['app-forcequit'] = [K, tile('fq', '#ff8a7e', '#cf2d27',
    '<defs>' + blur('lab-i-fq-f', 10) + '</defs><path d="M330 330L694 694M694 330L330 694" stroke="#5a0b08" stroke-opacity=".35" stroke-width="88" stroke-linecap="round" transform="translate(0 14)" filter="url(#lab-i-fq-f)"/>' +
    '<path d="M330 330L694 694M694 330L330 694" stroke="#fff" stroke-width="86" stroke-linecap="round"/>')];

  /* 關於這個練習: cream tile with the three-bar course mark */
  defs['app-about'] = [K, tile('about', '#fbf5e4', '#eadfc0',
    '<defs>' + lg('lab-i-about-m', [[0, '#a86300'], [1, '#7d4700']]) + '</defs>' +
    '<path d="M296 736V620M512 736V472M728 736V312" stroke="url(#lab-i-about-m)" stroke-width="112" stroke-linecap="butt"/>', { hi: 0.4 })];

  /* the generic application icon (an "A" on a pale tile) */
  defs['app'] = [K, tile('gen', '#f4f6f9', '#b6bcc8',
    '<defs>' + lg('lab-i-gen-m', [[0, '#7c8493'], [1, '#4a515e']]) + '</defs>' +
    '<path d="M300 742L512 282L724 742M382 594H642" fill="none" stroke="url(#lab-i-gen-m)" stroke-width="64" stroke-linecap="round" stroke-linejoin="round"/>')];

  /* ================================================================== folders ================================================================== */
  /* Two plates, as before (back plate with the tab, front plate a little wider): the back plate is a darker blue that fades into the shadow
     the front plate casts on it, both top edges carry a light rim, and a soft shadow sits underneath. `glyph` is drawn on the front plate. */
  function folder(p, glyph, sm) {
    var back = 'M86 307V281Q86 251 116 251H318C351 251 359 304 392 304H874Q908 304 908 338V470H86Z';
    var backTop = 'M86 340V281Q86 251 116 251H318C351 251 359 304 392 304H874Q908 304 908 338V345';
    var front = 'M128 369H896Q954 369 954 427V872Q954 930 896 930H128Q70 930 70 872V427Q70 369 128 369Z';
    var frontTop = 'M70 440V427Q70 369 128 369H896Q954 369 954 427V440';
    return '<defs><path id="' + p + '-b" d="' + back + '"/><path id="' + p + '-f" d="' + front + '"/>' +
      '<clipPath id="' + p + '-cb"><use href="#' + p + '-b"/></clipPath><clipPath id="' + p + '-cf"><use href="#' + p + '-f"/></clipPath>' +
      lg(p + '-gb', [[0, '#6bcbf8'], [0.42, '#3ea4e8'], [1, '#2379c6']], [0, 251, 0, 372, 1]) +
      lg(p + '-gf', [[0, '#8fdbfe'], [0.1, '#70caf9'], [0.6, '#4fb2ef'], [1, '#3799e0']], [0, 369, 0, 930, 1]) +
      lg(p + '-gl', [[0, '#fff', 0.85], [1, '#fff', 0]], [0, 369, 0, 440, 1]) +
      lg(p + '-gk', [[0, '#fff', 0.55], [1, '#fff', 0]], [0, 251, 0, 330, 1]) +
      lg(p + '-gd', [[0, '#1c6cb8', 0], [1, '#1c6cb8', 0.5]], [0, 820, 0, 930, 1]) +
      (sm ? '' : blur(p + '-sb', 22) + blur(p + '-sc', 9)) + '</defs>' +
      '<g transform="translate(0 -70)">' +
      (sm ? '<use href="#' + p + '-f" transform="translate(0 26)" fill="#06305f" fill-opacity=".26"/>' :
        '<use href="#' + p + '-f" transform="translate(0 30)" fill="#06305f" fill-opacity=".34" filter="url(#' + p + '-sb)"/>' +
        '<use href="#' + p + '-f" transform="translate(0 10)" fill="#06305f" fill-opacity=".30" filter="url(#' + p + '-sc)"/>') +
      '<path d="' + back + '" fill="url(#' + p + '-gb)"/>' +
      '<g clip-path="url(#' + p + '-cb)">' + (sm ? '<use href="#' + p + '-f" transform="translate(0 -10)" fill="#07366b" fill-opacity=".4"/>' : '<use href="#' + p + '-f" transform="translate(0 -14)" fill="#07366b" fill-opacity=".55" filter="url(#' + p + '-sc)"/>') +
      '<path d="' + backTop + '" fill="none" stroke="url(#' + p + '-gk)" stroke-width="12" stroke-linejoin="round"/></g>' +
      '<path d="' + front + '" fill="url(#' + p + '-gf)"/>' +
      '<g clip-path="url(#' + p + '-cf)"><path d="' + frontTop + '" fill="none" stroke="url(#' + p + '-gl)" stroke-width="12"/>' +
      '<rect x="70" y="820" width="884" height="110" fill="url(#' + p + '-gd)"/></g>' +
      '<use href="#' + p + '-f" fill="none" stroke="#1d6fba" stroke-opacity=".4" stroke-width="3"/>' +
      (glyph || '') + '</g>';
  }
  defs['folder'] = [K, folder('lab-i-folder'), folder('lab-i-folder', '', true)];
  /* 下載項目: the same folder with a circled down arrow on the front plate */
  defs['app-downloads'] = [K, folder('lab-i-dl',
    '<defs>' + blur('lab-i-dl-gs', 7, 40) + '</defs>' +
    '<g fill="none" stroke="#0a3f7c" stroke-opacity=".38" stroke-width="40" stroke-linecap="round" stroke-linejoin="round" transform="translate(0 10)" filter="url(#lab-i-dl-gs)"><circle cx="512" cy="655" r="148"/><path d="M512 590V705M458 655L512 709L566 655"/></g>' +
    '<g fill="none" stroke="#f4fbff" stroke-opacity=".94" stroke-width="38" stroke-linecap="round" stroke-linejoin="round"><circle cx="512" cy="655" r="148"/><path d="M512 590V705M458 655L512 709L566 655"/></g>')];

  /* ================================================================== trash: a wire-mesh metal bin ================================================================== */
  function crumple(cx, cy, r, seed, flat) {         // a ball of crumpled paper: jagged outline, creases between three inner points, facets lit from the upper left
    var R = rnd(seed), n = 9, pts = [], inner = [], out = '', i, j, a;
    for (i = 0; i < n; i++) { a = (i / n) * 2 * Math.PI + (R() - 0.5) * 0.5; var rad = r * (0.66 + R() * 0.42); pts.push([cx + rad * Math.cos(a) * 1.1, cy + rad * Math.sin(a) * 0.95]); }
    for (i = 0; i < 3; i++) inner.push([cx + (R() - 0.5) * r * 0.75, cy + (R() - 0.5) * r * 0.6]);
    function shade(x, y) {
      var dx = x - cx, dy = y - cy, d = Math.sqrt(dx * dx + dy * dy) || 1, lit = -(dx * 0.7 + dy * 0.7) / d;
      var g = Math.round(Math.max(206, Math.min(255, 236 + lit * 20 + (R() - 0.5) * 16)));
      return 'rgb(' + g + ',' + g + ',' + Math.min(255, g + 4) + ')';
    }
    var d0 = 'M' + pts.map(function (q) { return fx(q[0]) + ' ' + fx(q[1]); }).join('L') + 'Z';
    out += '<path d="' + d0 + '" fill="#e2e5ea"/>';
    for (i = 0; i < n; i++) {
      var p0 = pts[i], p1 = pts[(i + 1) % n], mx = (p0[0] + p1[0]) / 2, my = (p0[1] + p1[1]) / 2, best = 0, bd = 1e9;
      for (j = 0; j < 3; j++) { var dd = Math.pow(inner[j][0] - mx, 2) + Math.pow(inner[j][1] - my, 2); if (dd < bd) { bd = dd; best = j; } }
      var q = inner[best];
      out += '<path d="M' + fx(p0[0]) + ' ' + fx(p0[1]) + 'L' + fx(p1[0]) + ' ' + fx(p1[1]) + 'L' + fx(q[0]) + ' ' + fx(q[1]) + 'Z" fill="' + shade((p0[0] + p1[0] + q[0]) / 3, (p0[1] + p1[1] + q[1]) / 3) + '"/>';
    }
    out += '<path d="M' + inner.map(function (q) { return fx(q[0]) + ' ' + fx(q[1]); }).join('L') + 'Z" fill="' + shade(cx, cy) + '"/>';
    return '<g stroke="#a9b1be" stroke-opacity=".6" stroke-width="2.4" stroke-linejoin="round">' + out + '</g>' +
      '<path d="' + d0 + '" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="3" stroke-linejoin="round"/>';
  }
  function trash(full, sm) {
    var p = 'lab-i-' + (full ? 'trashf' : 'trashe'), i, k, nr = sm ? 3 : 5, nk = sm ? 4 : 8, ww = sm ? 22 : 11;
    var body = 'M190 258L272 906A240 54 0 0 0 752 906L834 258A322 68 0 0 1 190 258Z';
    var ring = 'M172 258A340 80 0 1 0 852 258A340 80 0 1 0 172 258ZM206 258A306 58 0 1 0 818 258A306 58 0 1 0 206 258Z';
    var wires = '';
    for (i = -nr; i <= nr; i++) {                     // ribs: straight lines from the top rim to the foot, bunched towards the sides like a cylinder
      var th = (i / nr) * (Math.PI / 2) * 0.92, s = Math.sin(th), co = Math.cos(th);
      wires += 'M' + fx(512 + 322 * s) + ' ' + fx(258 + 68 * co) + 'L' + fx(512 + 240 * s) + ' ' + fx(906 + 54 * co);
    }
    for (k = 1; k <= nk; k++) {                      // rings: the front half of an ellipse at each height
      var t = k / (nk + 1), rx = 322 - t * 82, ry = 68 - t * 14, y = 258 + t * 648;
      wires += 'M' + fx(512 - rx) + ' ' + fx(y) + 'A' + fx(rx) + ' ' + fx(ry) + ' 0 0 0 ' + fx(512 + rx) + ' ' + fx(y);
    }
    var back = '';
    for (i = -5; i <= 5; i++) { var tb = (i / 5) * (Math.PI / 2) * 0.92, sb = Math.sin(tb), cb = Math.cos(tb); back += 'M' + fx(512 + 322 * sb) + ' ' + fx(258 - 68 * cb) + 'L' + fx(512 + 304 * sb) + ' ' + fx(330 - 68 * cb); }
    back += 'M200 232Q512 168 824 232M212 262Q512 204 812 262';
    var s = '<defs><path id="' + p + '-bd" d="' + body + '"/><path id="' + p + '-rg" d="' + ring + '" fill-rule="evenodd"/>' +
      '<clipPath id="' + p + '-cb"><use href="#' + p + '-bd"/></clipPath>' +
      '<clipPath id="' + p + '-cw"><ellipse cx="512" cy="258" rx="304" ry="56"/></clipPath>' +
      '<clipPath id="' + p + '-cr"><rect x="0" y="258" width="1024" height="200"/></clipPath>' +
      '<clipPath id="' + p + '-co"><path d="M0 0H1024V258H818A306 58 0 0 1 206 258H0Z"/></clipPath>' +
      lg(p + '-gi', [[0, '#2b2e33'], [1, '#585c64']]) +
      lg(p + '-gh', [[0, '#40444a', 0.88], [1, '#7a7e87', 0.84]]) +
      lg(p + '-gw', [[0, '#8d929b'], [0.2, '#f6f7f9'], [0.5, '#cdd0d6'], [0.82, '#9ca1aa'], [1, '#70757e']], [190, 0, 834, 0, 1]) +
      lg(p + '-gr', [[0, '#7c818a'], [0.22, '#f8f9fb'], [0.55, '#c6cad1'], [1, '#6c717a']], [172, 0, 852, 0, 1]) +
      lg(p + '-gc', [[0, '#000', 0.34], [0.14, '#000', 0.04], [0.28, '#fff', 0.16], [0.55, '#fff', 0], [0.86, '#000', 0.1], [1, '#000', 0.4]], [0, 0, 1, 0]) +
      lg(p + '-gf', [[0, '#e7e9ed'], [1, '#8a8f98']], [0, 840, 0, 970, 1]) +
      blur(p + '-bl', 14) + blur(p + '-ps', 7, 40) + '</defs>' +
      '<ellipse cx="512" cy="948" rx="290" ry="40" fill="#000" fill-opacity=".34" filter="url(#' + p + '-bl)"/>' +
      '<ellipse cx="512" cy="258" rx="306" ry="58" fill="url(#' + p + '-gi)"/>' +
      '<g clip-path="url(#' + p + '-cw)" fill="none" stroke="#c9ced6" stroke-opacity=".34" stroke-width="7" stroke-linecap="round"><path d="' + back + '"/></g>' +
      '<use href="#' + p + '-rg" fill="url(#' + p + '-gr)"/>' +
      '<use href="#' + p + '-bd" fill="url(#' + p + '-gh)"/>' +
      '<g clip-path="url(#' + p + '-cb)"><path d="' + wires + '" fill="none" stroke="#14171b" stroke-opacity=".4" stroke-width="' + (ww + 1) + '" transform="translate(3.500 5)"/>' +
      '<path d="' + wires + '" fill="none" stroke="url(#' + p + '-gw)" stroke-width="' + ww + '" stroke-linecap="round"/>' +
      '<use href="#' + p + '-bd" fill="url(#' + p + '-gc)"/></g>' +
      '<path d="M272 906A240 54 0 0 0 752 906" fill="none" stroke="url(#' + p + '-gf)" stroke-width="30" stroke-linecap="round"/>' +
      '<path d="M283 893A229 48 0 0 0 741 893" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="5" stroke-linecap="round"/>';
    if (full) {
      s += '<g clip-path="url(#' + p + '-co)">' +
        '<g filter="url(#' + p + '-ps)" opacity=".5" transform="translate(0 18)">' + crumple(404, 190, 112, 11).replace(/fill="[^"]+"/g, 'fill="#101820"').replace(/stroke="[^"]+"/g, '') + '</g>' +
        crumple(404, 190, 112, 11) +
        '<g filter="url(#' + p + '-ps)" opacity=".5" transform="translate(0 18)">' + crumple(618, 150, 124, 23).replace(/fill="[^"]+"/g, 'fill="#101820"').replace(/stroke="[^"]+"/g, '') + '</g>' +
        crumple(618, 150, 124, 23) +
        '<g filter="url(#' + p + '-ps)" opacity=".5" transform="translate(0 18)">' + crumple(522, 268, 104, 37).replace(/fill="[^"]+"/g, 'fill="#101820"').replace(/stroke="[^"]+"/g, '') + '</g>' +
        crumple(522, 268, 104, 37) + '</g>' +
        '<g clip-path="url(#' + p + '-cr)"><use href="#' + p + '-rg" fill="url(#' + p + '-gr)"/></g>';
    }
    s += '<path d="M206 258A306 58 0 0 0 818 258" fill="none" stroke="#000" stroke-opacity=".25" stroke-width="4" transform="translate(0 2)"/>' +
      '<path d="M172 258A340 80 0 0 0 852 258" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="5" transform="translate(0 -2)"/>';
    return s;
  }
  defs['app-trash-empty'] = [K, trash(false), trash(false, true)];
  defs['app-trash-full'] = [K, trash(true), trash(true, true)];

  /* ================================================================== documents (64 box) ================================================================== */
  /* A white page with a folded top-right corner, a soft shadow and a type label under the content. Every type has its own content
     (lines, table, heading, ribbon, zipper) and colour, so they still differ at 16 px where the label is only a smudge. */
  var PG = 'M13.5 3H40L54 17V57.5A3.5 3.5 0 0 1 50.5 61H13.5A3.5 3.5 0 0 1 10 57.5V6.5A3.5 3.5 0 0 1 13.5 3Z';
  var FOLD = 'M40 3V13.5A3.5 3.5 0 0 0 43.5 17H54Z';
  function tl(y, w, c, x, sm) { return '<path d="M' + (x || 17) + ' ' + y + 'h' + w + '" stroke="' + (c || '#c6cad4') + '" stroke-width="' + (sm ? 3.2 : 2.4) + '" stroke-linecap="round"/>'; }
  function label(txt, color, w, sm) {
    if (sm) return '<rect x="' + fx(32 - w / 2) + '" y="48.500" width="' + w + '" height="5.200" rx="2" fill="' + color + '"/>';   // ≤ 24 px: the letters would only be a smudge, so a bar in the type colour
    return '<text x="32" y="53.400" text-anchor="middle" textLength="' + w + '" lengthAdjust="spacingAndGlyphs" font-family="Helvetica Neue,Helvetica,Arial,sans-serif" font-weight="700" font-size="10.200" fill="' + color + '">' + txt + '</text>';
  }
  /* One page. `sm` is the variant for 24 px and below: a firmer outline, thicker lines, no letters. */
  function page(p, content, o, sm) {
    o = o || {};
    var ec = sm ? '#4a5368" stroke-opacity=".62" stroke-width="1.500' : '#59627a" stroke-opacity=".42" stroke-width=".900';
    return '<defs>' + lg(p + '-pg', [[0, '#ffffff'], [1, '#eaedf2']]) + lg(p + '-fl', [[0, '#ffffff'], [1, '#bcc3d0']], [0, 0, 1, 1]) + (sm ? '' : blur(p + '-sh', 1.5, 30)) + '</defs>' +
      (sm ? '<path d="' + PG + '" transform="translate(0 1.800)" fill="#18233a" fill-opacity=".2"/>' : '<path d="' + PG + '" transform="translate(0 2)" fill="#18233a" fill-opacity=".34" filter="url(#' + p + '-sh)"/>') +
      '<path d="' + PG + '" fill="url(#' + p + '-pg)" stroke="' + ec + '"/>' +
      (sm ? '' : '<path d="M11.200 6.600A2.400 2.400 0 0 1 13.500 4.200H39.500" fill="none" stroke="#fff" stroke-opacity=".9" stroke-width=".8" stroke-linecap="round"/>') +
      content +
      '<path d="' + FOLD + '" fill="url(#' + p + '-fl)" stroke="' + ec + '" stroke-linejoin="round"/>' +
      (o.label ? label(o.label, o.color, o.w, sm) : '');
  }
  /* build one document icon: fn(sm) returns the content for the normal (false) or the small (true) variant */
  function docIcon(name, fn, label, color, w) {
    var p = 'lab-i-' + name;
    defs[name] = [A, page(p, fn(false), { label: label, color: color, w: w }, false), page(p, fn(true), { label: label, color: color, w: w }, true)];
  }
  var TXT_G = '#6f7684';
  docIcon('doc', function (s) { return s ? tl(25, 28, 0, 0, 1) + tl(33, 30, 0, 0, 1) + tl(41, 22, 0, 0, 1) + tl(49, 16, 0, 0, 1) : tl(24, 28) + tl(30, 30) + tl(36, 26) + tl(42, 30) + tl(48, 17); });
  docIcon('txt', function (s) { return s ? tl(25, 28, 0, 0, 1) + tl(33, 30, 0, 0, 1) + tl(41, 22, 0, 0, 1) : tl(23, 29) + tl(29, 30) + tl(35, 25) + tl(41, 28); }, 'TXT', TXT_G, 20);
  docIcon('md', function (s) {
    return s ? '<path d="M17 24h16" stroke="#3f4857" stroke-width="4.400" stroke-linecap="round"/>' + tl(33, 30, 0, 0, 1) + tl(41, 22, 0, 0, 1)
      : '<path d="M17 22.500h15" stroke="#3f4857" stroke-width="3.400" stroke-linecap="round"/>' + tl(29, 30) + tl(34.500, 24) +
        '<circle cx="18.200" cy="40.200" r="1.500" fill="#8b93a1"/><path d="M22 40.200h15" stroke="#c6cad4" stroke-width="2.400" stroke-linecap="round"/>';
  }, 'MD', '#4a5363', 17);
  docIcon('csv', function (s) {
    return '<rect x="16.500" y="21" width="31" height="21.500" rx="2" fill="#fff" stroke="#' + (s ? '8d95a3' : 'b5bcc8') + '" stroke-width="' + (s ? 1.4 : 0.9) + '"/>' +
      '<path d="M16.500 23A2 2 0 0 1 18.500 21H45.500A2 2 0 0 1 47.500 23V27.500H16.500Z" fill="#2fa862"/>' +
      '<path d="M16.500 33H47.500M16.500 38H47.500M26.800 27V42.500M37.200 27V42.500" stroke="#' + (s ? '8d95a3' : 'b5bcc8') + '" stroke-width="' + (s ? 1.4 : 0.9) + '"/>';
  }, 'CSV', '#25904f', 22);
  docIcon('docx', function (s) {
    return s ? '<path d="M17 24h20" stroke="#2f72dd" stroke-width="4.400" stroke-linecap="round"/>' + tl(33, 30, 0, 0, 1) + tl(41, 22, 0, 0, 1)
      : '<path d="M17 22.500h20" stroke="#2f72dd" stroke-width="3.600" stroke-linecap="round"/>' + tl(29, 30) + tl(34.500, 30) + tl(40, 22);
  }, 'DOCX', '#2563c7', 29);
  docIcon('pdf', function (s) {
    return '<defs>' + lg('lab-i-pdf-r', [[0, '#ff6a5e'], [1, '#d83428']]) + '</defs><path d="M17 3H28V' + (s ? 21 : 19.500) + 'L22.500 ' + (s ? 16.800 : 15.600) + 'L17 ' + (s ? 21 : 19.500) + 'Z" fill="url(#lab-i-pdf-r)"/>' +
      (s ? tl(33, 30, 0, 0, 1) + tl(41, 22, 0, 0, 1) : tl(26.500, 30) + tl(32, 26) + tl(37.500, 30) + tl(43, 20));
  }, 'PDF', '#d13a2e', 22);
  (function () {
    function zipper(s) {
      var teeth = '', y;
      for (var i = 0; i < 9; i++) { y = 5 + i * 3.1; teeth += '<rect x="' + (i % 2 ? 32.2 : 28.4) + '" y="' + fx(y) + '" width="' + (s ? 3.6 : 3) + '" height="2.200" rx=".5" fill="#8d94a1"/>'; }
      return '<path d="M32 3V33" stroke="#d3d7df" stroke-width="1"/>' + teeth + '<defs>' + lg('lab-i-zip-s', [[0, '#9aa1ae'], [1, '#626978']]) + '</defs>' +
        '<rect x="27.200" y="31.500" width="9.600" height="8.400" rx="2.400" fill="url(#lab-i-zip-s)"/><rect x="29.400" y="38.500" width="5.200" height="5.200" rx="1.600" fill="#7a8190"/><circle cx="32" cy="41.100" r="1.100" fill="#e9ebef"/>';
    }
    docIcon('zip', zipper, 'ZIP', '#6b7282', 20);
  })();
  /* a small landscape in a photo print */
  function photo(sm) {
    var ec = sm ? '#4a5368" stroke-opacity=".62" stroke-width="1.500' : '#59627a" stroke-opacity=".42" stroke-width=".900';
    return '<defs>' + lg('lab-i-img-s', [[0, '#8ecbff'], [1, '#e6f5ff']]) + lg('lab-i-img-a', [[0, '#8dcfa6'], [1, '#62b184']]) + lg('lab-i-img-b', [[0, '#55ac86'], [1, '#34845f']]) +
      lg('lab-i-img-u', [[0, '#fff3ae'], [1, '#ffc440']]) + (sm ? '' : blur('lab-i-img-sh', 1.6, 30)) + '<clipPath id="lab-i-img-c"><rect x="11.500" y="16.500" width="41" height="31" rx="1.400"/></clipPath></defs>' +
      (sm ? '<rect x="6.500" y="12" width="51" height="40" rx="3" transform="translate(0 1.800)" fill="#18233a" fill-opacity=".2"/>' : '<rect x="6.500" y="12" width="51" height="40" rx="3" transform="translate(0 2.200)" fill="#18233a" fill-opacity=".36" filter="url(#lab-i-img-sh)"/>') +
      '<rect x="6.500" y="12" width="51" height="40" rx="3" fill="#fff" stroke="' + ec + '"/>' +
      '<g clip-path="url(#lab-i-img-c)"><rect x="11.500" y="16.500" width="41" height="31" fill="url(#lab-i-img-s)"/>' +
      (sm ? '' : '<ellipse cx="22" cy="23" rx="6" ry="2.200" fill="#fff" fill-opacity=".85"/><ellipse cx="26" cy="21.600" rx="4" ry="2" fill="#fff" fill-opacity=".85"/>') +
      '<circle cx="43.500" cy="24" r="' + (sm ? 5.400 : 4.600) + '" fill="url(#lab-i-img-u)"/>' +
      '<path d="M11.500 47.500V37L21 29.500L30 38L36.500 33L52.500 44.500V47.500Z" fill="url(#lab-i-img-a)"/><path d="M11.500 47.500V42L19 37L28 43.500L38 36.500L52.500 46V47.500Z" fill="url(#lab-i-img-b)"/></g>' +
      '<rect x="11.500" y="16.500" width="41" height="31" rx="1.400" fill="none" stroke="#000" stroke-opacity=".16" stroke-width=".7"/>';
  }
  defs['image'] = [A, photo(false), photo(true)];
  /* an unknown file type is a blank page, like the real generic icon */
  defs['unknown'] = [A, page('lab-i-unk', '', {}, false), page('lab-i-unk', '', {}, true)];

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

  Object.keys(defs).forEach(function (k) { reg[k] = { vb: defs[k][0], inner: defs[k][1], small: defs[k][2] }; });

  /* Size normalisation: the Codex (8..1016) and Terminal (52..972) tiles of round 1 were drawn larger than the squircle
     (64..960) of Finder and VS Code, so side by side in the Dock they looked bigger. Scale their art about the centre onto
     the same 896-unit squircle; the drawings themselves are untouched. */
  var NORM = { 'app-codex': 0.889, 'app-terminal': 0.974 };
  Object.keys(NORM).forEach(function (k) {
    if (!reg[k]) return;
    var s = NORM[k], t = (512 * (1 - s)).toFixed(2);
    reg[k].inner = '<g transform="translate(' + t + ' ' + t + ') scale(' + s + ')">' + reg[k].inner + '</g>';
  });

  /* Every copy of an icon gets its own ids (gradients, clips, filters), so a copy never relies on another copy that may sit
     in a hidden panel. prep() lists the ids of one icon once; svgFor() renames them with a fresh counter on every call. */
  var uid = 0;
  function prep(e) {
    var ids = [], m, re = / id="([^"]+)"/g, all = e.inner + (e.small || '');
    while ((m = re.exec(all))) ids.push(m[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    if (ids.length) e.rx = new RegExp('(id="|url\\(#|href="#)(' + ids.join('|') + ')(?=["\\)])', 'g');
    return e;
  }
  function svgFor(entry, size, cls) {
    var inner = (entry.small && size <= 28) ? entry.small : entry.inner;   // documents and the trash have a simpler variant for small sizes
    if (entry.rx) { var n = ++uid; inner = inner.replace(entry.rx, '$1$2-' + n); }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + entry.vb + '" width="' + size + '" height="' + size + '"' +
      (cls ? ' class="' + cls + '"' : '') + ' aria-hidden="true" focusable="false">' + inner + '</svg>';
  }
  Object.keys(reg).forEach(function (k) { prep(reg[k]); });

  /* the stub .app files in /Applications show the icon of the app they open (Finder list, desktop, Spotlight) */
  var APP_ICON = {
    'codex.app': 'app-codex', 'code.app': 'app-code', '文字編輯.app': 'app-textedit', '終端機.app': 'app-terminal',
    'safari.app': 'app-safari', '系統設定.app': 'app-settings', '計算機.app': 'app-calculator', '活動監視器.app': 'app-activity', '預覽程式.app': 'app-preview'
  };

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
      reg[name] = prep({ vb: vb, inner: inner });
    },
    has: function (name) { return !!reg[name]; },
    forNode: function (st) {
      if (!st) return 'unknown';
      if (st.type === 'dir' || st.kind === 'folder') return 'folder';
      if (st.kind === 'app') return APP_ICON[String(st.name || '').toLowerCase()] || 'app';
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
