# 練習用的 Mac (lab/mac) — DESIGN CONTRACT

Status: v1 contract, revised after review (see §12 「Changes after review」). Every builder follows this file. If something here is wrong or missing, tell the orchestrator; do not silently diverge. Section numbers are referenced by builders ("see §4.2").

Teacher: JUNHAO CHEN (NTNU, 學習分析工具). Audience: non-CS students. Purpose: a fake-but-convincing, fully interactive macOS desktop in the browser, front-end only (no backend), where students practise each week's content through guided missions or free play. v1 = whole virtual Mac + Week 3 missions. A Windows skin comes later, so the portable logic is kept apart from the Mac look (§0.4).

---

## 0. Ground rules

### 0.1 Hard constraints (checked by tools/check.mjs and by the owner)

- Plain HTML, CSS, JS. No build step, no npm, no external JS library (vanilla only). Fonts may load from Google Fonts (same link as weeks/week03/index.html).
- Scripts are plain `<script src>` files that share ONE global namespace `window.LAB`. No ES modules, no `import`, no `type="module"` (so the page also works from `file://`). ES2019 syntax at most: no `?.`, `??`, `??=`, `||=`, `replaceAll`, `.at(`, `structuredClone`, `Object.hasOwn`, top-level await (enforced by the grep lint in §7, because school Chromebooks and older Safari are in the audience). Each file is an IIFE: `(function (LAB) { 'use strict'; ... })(window.LAB);`
- `lab/mac/index.html` must:
  1. contain the github.io redirect `<script>` copied verbatim from `weeks/week03/index.html` `<head>` (the text `location.hostname.endsWith("github.io")` must appear);
  2. load `../../assets/i18n-strings.js` then `../../assets/i18n.js` in `<head>`, no `defer`, before any other script (paths are `../../assets/…` because the file is at depth `lab/mac/`);
  3. contain the text `Copyright © 2026 JUNHAO CHEN` (put it in the footer of the left rail and in the About window);
  4. NOT load `assets/week.css` or `assets/course.js` (the lab has its own CSS; i18n.js only adds a language menu if `#themeBtn` exists, and the lab has no `#themeBtn`, so it stays inert). The lab is zh-Hant only in v1; do not use `data-i18n`/`data-ui` attributes (so check #8 has nothing to verify).
  5. have `<html lang="zh-Hant">`, viewport meta `width=device-width, initial-scale=1, viewport-fit=cover`;
  6. have `<meta name="robots" content="noindex">` (the lab stays unlinked and unindexed until the owner decides to link it from `course.js`) and an inline `data:` favicon, `<link rel="icon" href="data:image/svg+xml,…">` drawing the course mark, so `/favicon.ico` never 404s;
  7. keep `<html lang>` at `zh-Hant`: `i18n.js` is loaded because check.mjs demands it, and its `initial()` may set `<html lang>` from `?lang=` or `localStorage['site-lang']`; the lab ignores both. `boot.js` (which runs after i18n's DOMContentLoaded handler) forces `document.documentElement.lang = 'zh-Hant'`, and the Codex window root carries `lang="en"`. `?lang=` has no effect in the lab.
- Every local `href`/`src` must exist (check.mjs verifies; `data:` URIs are skipped by it). Every file < 25 MiB (keep the whole lab < 1 MB).
- Compatibility rules: `height:100vh; height:100dvh` (the first line is for Chrome < 108); every `backdrop-filter` is paired with `-webkit-backdrop-filter`; no CSS or JS feature newer than the ES2019 line above; the page must work from `file://` and with `localStorage` blocked (the lab does not use it, §18).
- Run `node tools/check.mjs` from the repo root; it must pass before the owner is told it is ready.
- Do NOT commit, do NOT push, do NOT touch anything outside `lab/mac/`. Temp scripts/screenshots go in the scratchpad, never in the repo.

### 0.2 Legal / content rules

- Imitate macOS look and behaviour but copy no Apple artwork: no Apple logo (menu-bar left glyph is the course mark, §2.2), no Apple wallpapers, no Apple icon images, no SF fonts. All icons are original inline SVG/CSS (§2.3). Same for Codex/OpenAI: draw an original mark; keep the real UI strings in English (New chat, Recents, No chats, Trust folder, Do anything, This computer, Worked for …).
- Trademarks and trade dress: macOS, Finder, Spotlight, Dock, Terminal are named only nominatively (they are what the student will meet on a real Mac). Icons are simple original art, and Finder's icon in particular is NOT the well-known two-faced split square (§2.3). Fonts are referenced by name only. About window and README carry: 「macOS 與 Finder 是 Apple Inc. 的商標，Codex 是 OpenAI 的商標。這個練習是獨立的教學模擬，與兩家公司都沒有關係。」
- No real student names or IDs anywhere. The fictional user is 小安, account `an`, home `/Users/an`, computer name `MacBook-Air`. CSV ids are fake (`A001`…).
- Traditional Chinese (Taiwan usage: 資料夾 not 文件夾, 檔案, 程式, 影片, 軟體, 滑鼠, 視窗) for every Chinese string. Commands, file names, paths stay English. The Codex app chrome stays English (its replies are Chinese because the student types Chinese).
- Our own chrome (mission rail, hints, welcome, notices, toasts) must NOT look like AI product UI: no glow, no gradient cards, no pill chips with icons, no emoji, no round numbered badges, no dashed boxes. Calm editorial type, 1px hairlines, one amber accent. Motion is gentle: 150–300 ms ease, never a fast spin; `prefers-reduced-motion` turns animations off. No whoosh/riser sounds; sound is off and not built in v1 (`LAB.sfx` is a no-op function).

### 0.3 Decisions already taken (do not re-open)

| Topic | Decision |
|---|---|
| Missions | Guided missions + free play. Steps auto-check from events/state; hints on request; progress lives in memory for the visit only (§18). |
| Terminal look | LIGHT, the real default "Basic" profile (as the fact-checked supplement video), host `MacBook-Air`, title `an — -zsh — 80×24`, non-blinking block cursor. (Video 01's dark `an@Mac Project %` terminal is NOT used.) |
| Prompt | `an@MacBook-Air ~ % ` (zsh `%n@%m %1~ %# `). |
| First line | The very first Terminal window ever opened on a fresh state prints `Last login: Fri Oct  2 09:41:07 on ttys000` (two spaces before the 2). Later windows print the real previous-window open time and the next tty number (`ttys001`, …). |
| Desktop mode | Fluid: the desktop fills the available area; if the area is smaller than 1024×640 the whole stage is scaled down (§2.1). |
| Themes | macOS parts are LIGHT (Finder, Terminal, TextEdit, menus); Codex and Code are DARK apps (as in the videos). Menu bar is light text on translucent dark (the wallpaper is dark). Dock is light translucent. |
| Codex model string | `GPT-6.1 Sol  High` (two spaces) bottom-right of the composer; only `+` at bottom-left. No "Full access", no permission modes. |
| Finder default new window | Opens at the home folder (`an`). Folder display names follow zh-TW Finder: 桌面, 文件, 下載項目, 電影, 音樂, 圖片, 公共, 資源庫, 應用程式, 使用者 (the owner verifies the list against a real zh-TW Mac before release, §7). The Terminal always shows the English names. |
| ls dates | English month names (`Oct  4 10:12`), as in the videos. |
| Case handling | Path lookup is case-insensitive but case-preserving (APFS). The prompt/`pwd` show the case as TYPED (`cd desktop` → prompt `desktop`), exactly like zsh. |
| Zip | `Downloads/week3.zip` exists at start and is NOT pre-extracted. Extraction (Terminal `unzip` or Finder double-click) creates `week3/`. |
| Orphan chat landing folder | A Codex chat started with top "New chat" (no project) writes relative paths under `/Users/an/Documents` (always; deterministic). |
| Quick Look/other | Space in Finder = Quick Look overlay. No Launchpad, no Notification Center content, no Control Center behaviour (cosmetic popovers only). |
| File names in Finder | v1 Finder always shows FULL names with extensions (`week3.zip`, `README.md`), so a zip and the folder extracted from it are never both called `week3`. A real Mac hides `.zip` by default; M3 step 8 says so once. |
| Reload | Nothing is restored; every load is a new computer from the seed (§18). Back / Forward from the course page reloads too (`pageshow` with `persisted`). |
| Lab-only text | Any message that does not exist on a real Mac is Traditional Chinese and says it comes from the practice (「練習版」), so students never learn a false fact about the real Terminal. |
| Opening Spotlight | The magnifier in the menu bar is the documented way. ⌘Space / Ctrl+Space also work when the browser lets the key through, but the real OS often takes them first (§6.4). |

### 0.4 Portability (Windows skin later)

Every file is tagged in §1:
- `[PORTABLE]` — OS-neutral logic (bus, store, vfs core, dnd engine, apps registry, mission engine, codex intent logic, shell parser). May later move to `lab/shared/` unchanged. Contains no Mac-only strings except through the named constants it exports.
- `[SKIN]` — Mac look (CSS, menu bar, dock, window chrome, Finder visuals, Mac menu definitions). A Windows skin replaces these.
Keep the tags honest: do not hard-code zh-TW Mac menu text inside a `[PORTABLE]` file.

### 0.5 Conventions

- CSS class prefix per owner: `lab-` (core/shell), `fd-` Finder, `tm-` Terminal, `cx-` Codex, `te-` TextEdit/QuickLook, `cd-` Code, `ab-` About. IDs only for the fixed shell containers in §2.1.
- DOM hooks for tests/missions: interactive things carry `data-lab="<name>"`; file items additionally carry `data-path="<canonical absolute path>"`. Required names are listed in §10.
- All colours/sizes come from CSS custom properties defined in `css/base.css` (§2.4). No hard-coded colours in app CSS except Terminal/Codex/Code theme palettes, which are declared as variables at the top of their own CSS file.
- Every module registers its per-visit state with `LAB.store.register` (§3.4) and its startup work with `LAB.ready` (§3.2). Registration calls (`store.register`, `apps.register`, `menu.register`, `missions.register`) run at script-evaluation time, never inside a `LAB.ready` callback (§1.1). Since §18 nothing is written to web storage: `LAB.store` only keeps state in memory and removes what older versions left behind.
- Data safety (user-controlled strings): file names, file contents, Codex replies that echo the student's text, and everything restored from storage are DATA. Never put them through `innerHTML`/`insertAdjacentHTML`/`outerHTML`; build DOM with `LAB.util.h` / `textContent` / `setAttribute`. `LAB.icons.get` returns static strings and may be assigned with innerHTML, nothing else may. VFS children and every lookup keyed by a user-supplied name use `Map` (never plain objects: a file called `__proto__` or `constructor` must be an ordinary file, §3.5).
- Window-scoped disposal: everything a window registers on a global (`LAB.bus.on`, `LAB.dnd.source/target`, `LAB.keys.on`, `LAB.wm` listeners, timers) goes through `win.own(disposeFn)` (§3.6) so closing the window tears it down. Under `?debug=1`, `LAB.debug.listeners()` returns the bus listener count per event and a console assertion fires if any window-scoped listener survives after all windows are closed.
- Query-string debug switches (handled by CORE `boot.js`, the only place that reads them): `?reset=1` (no effect since §18, every visit boots from the seed; it is only stripped from the address), `?welcome=0` (no mission sheets at all, §18.2), `?intro=0` (no start and completion sheets, the first sheet stays, §18.2), `?mission=<id>` (start that mission), `?now=2026-10-04T10:12:00` (clock OFFSET: `LAB.clock.now()` starts at that moment and keeps ticking; it is never frozen, because event order uses `seq`, §3.3), `?debug=1` (exposes `LAB.debug`, logs bus events to console), `?perf=low|high` (force the performance mode, §2.10). `reset` and `mission` are one-shot: after handling them boot.js removes them from the address with `history.replaceState`, so a later reload does not repeat them. `?lang=` is ignored (§0.1 item 7).

---

## 1. File layout and load order

```
lab/mac/
  DESIGN.md                this file
  README.md                what this is, how to run it, trademark note (§0.2)   CORE
  index.html               [SKIN shell page]            owner: CORE
  css/
    base.css               tokens, reset, fonts, page+rail layout, stage      CORE
    shell.css              wallpaper, desktop icons, menu bar, dock, menus,
                           spotlight, toast, alert sheets, dnd ghost           CORE
    window.css             window chrome (traffic lights, resize, shadows)     CORE
    mission.css            rail, mission card, welcome, phone notice           CORE
    finder.css             .fd-*                                               FINDER
    terminal.css           .tm-*                                               TERMINAL
    codex.css              .cx-*                                               CODEX
    editors.css            .te-* .cd-* .ab-*                                   EDITORS
  js/
    lab.js                 [PORTABLE] namespace, util, clock, bus, clipboard, boot/ready   CORE
    icons.js               [SKIN] LAB.icons + all base SVG                      CORE
    store.js               [PORTABLE] LAB.store                                 CORE
    vfs.js                 [PORTABLE] LAB.vfs (core)                            CORE
    seed.js                [SKIN-ish data] seed tree for /Users/an + LAB.seed accessor   CORE
    ui.js                  [SKIN] LAB.ui toast/alert/confirm, LAB.keys          CORE
    wm.js                  [SKIN] LAB.wm                                        CORE
    apps.js                [PORTABLE] LAB.apps registry + openPath logic        CORE
    menu.js                [SKIN] LAB.menu (menu bar, context menus)            CORE
    dnd.js                 [PORTABLE] LAB.dnd                                   CORE
    desktop.js             [SKIN] stage scaling, wallpaper, desktop icons,
                           dock, spotlight, phone notice                        CORE
    missions.js            [PORTABLE] LAB.missions engine + rail/card UI        CORE
    finder.js              [SKIN] Finder app (+ LAB.finder)                     FINDER
    terminal.js            [PORTABLE shell + SKIN window] LAB.shell, Terminal   TERMINAL
    codex.js               [PORTABLE logic + SKIN view] LAB.codex, Codex app    CODEX
    textedit.js            TextEdit app + LAB.quicklook                         EDITORS
    code.js                Code app                                             EDITORS
    about.js               About/Help window                                    EDITORS
    missions-week3.js      Week 3 mission data + free-play tips                 MISSIONS-WEEK3
    boot.js                [PORTABLE] startup order, query flags, lang lock     CORE
```

`index.html` loads, in this exact order, as plain `<script src="js/….js"></script>` tags at the end of `<body>` (no `defer`, no `async`):
`lab.js, icons.js, store.js, vfs.js, seed.js, ui.js, wm.js, apps.js, menu.js, dnd.js, desktop.js, missions.js, finder.js, terminal.js, codex.js, textedit.js, code.js, about.js, missions-week3.js, boot.js`.
CSS in `<head>` after the Google Fonts link: `base.css, shell.css, window.css, mission.css, finder.css, terminal.css, codex.css, editors.css`.

CORE writes `index.html` listing ALL files above from the start. A file that does not exist yet only produces a console 404; nothing may crash because an app file is missing (`LAB.apps.launch` of an unregistered app shows the toast 「這個程式還沒安裝（練習版）」). Each builder creates only the files it owns (§11).

### 1.1 Load-order rules

1. `LAB.store.register`, `LAB.apps.register`, `LAB.menu.register`, `LAB.missions.register`, `LAB.codex.registerIntent` and `LAB.icons.add` run when the script is evaluated. They never sit inside a `LAB.ready` callback, because store restore runs at ready-priority 10, before any app init.
2. `LAB.ready(fn)` called after `LAB.boot.run` has already executed schedules `fn` on the next microtask (it is never lost and never synchronous).
3. `js/boot.js` is the only caller of `LAB.boot.run` (lab.js defines it, boot.js calls it); no other file calls it.
4. `LAB.apps.register(id, def)` with an id that already exists replaces the definition in place and emits `apps:changed {id}`. The Dock (built at priority 30 from `LAB.apps.all()`) listens to it and swaps the icon and label, so the CORE placeholder app is replaced cleanly by the real app file.
5. `desktop.js` reads the registry at ready-time (priority 30), after every file has registered, never at its own eval time.

Fonts (Google Fonts, one `<link>`): `Noto Sans TC:400;500;700;900` and `JetBrains Mono:400;700`. CSS variables: `--lab-font-ui: "Noto Sans TC","PingFang TC","Microsoft JhengHei",system-ui,sans-serif;` and `--lab-font-mono: Menlo,"DejaVu Sans Mono","JetBrains Mono",Consolas,"Noto Sans TC",monospace;`. No font files in the repo. Pixel maths that depends on font metrics (Terminal columns, §4.2.1) waits for `document.fonts.load('13px "JetBrains Mono"')` / `document.fonts.ready` and re-measures on `document.fonts` `loadingdone`.

---

## 2. Shell design (CORE)

### 2.1 Page layout and stage

```
<body>
  <div id="lab-root">
    <aside id="lab-rail" aria-label="任務卡">…mission rail (§6)…</aside>
    <main id="lab-screen">
      <div id="lab-stage" role="application" aria-label="練習用的 Mac 桌面">   // the fake Mac screen
        <canvas id="lab-wall" aria-hidden="true">
        <div id="lab-desktop">        // desktop icons (live from ~/Desktop); bottom layer, receives empty-desktop clicks and rubber-band
        <div id="lab-windows">        // all app windows; own stacking context
        <div id="lab-menubar">
        <div id="lab-dock">
        <div id="lab-overlays">       // menus, spotlight, alert sheets, toasts
        <div id="lab-dnd">            // drag ghost
      </div>
    </main>
  </div>
  <div id="lab-modal-root"></div>      // welcome, phone notice (above everything)
</body>
```

- `#lab-root` is `display:flex; height:100vh; height:100dvh`. `#lab-screen` takes the rest (`flex:1; min-width:0; position:relative; overflow:hidden`).
- Layers: `#lab-windows`, `#lab-overlays` and `#lab-dnd` are `position:absolute; inset:0; pointer-events:none`, and their children (windows, menus, sheets, toasts) re-enable `pointer-events:auto`; otherwise these full-stage layers would swallow clicks and rubber-banding meant for the desktop. `#lab-desktop` is the only full-stage layer with `pointer-events:auto` (it is the bottom layer). `#lab-windows` creates its own stacking context (`isolation:isolate; z-index:2`); windows inside it are ordered by a plain integer counter (§3.6), so no renormalisation is needed. Dock (900), menu bar (1000), overlays and dnd sit above it (§2.4).
- Rail modes (`ui.railMode`, stored). The rail NEVER makes the stage jump on its own:
  - `pinned`: 320 px in the flow; the stage is the rest. Default when `innerWidth >= 1366`.
  - `drawer` (default below 1366 px, i.e. most school laptops and 1280×720 windows): a 44 px strip stays in the flow and shows the vertical text 「第 N / M 步」 and a `›` button. Clicking the strip or the button opens the full 320 px rail as an OVERLAY drawer above the left part of the stage (the stage is NOT resized, so scale and windows do not move). The drawer closes on Esc, on a click anywhere in the stage, or on its 「收起」 button; it has a 「固定在左邊」 link that switches to `pinned` (the stage then resizes, see the resize rule below). When a step completes while the drawer is closed, the strip text changes (e.g. 「第 3 / 6 步」), nothing else moves.
- Stage logical size: `availW × availH` = size of `#lab-screen`. Minimum design size 1024×640. `scale = min(1, availW/1024, availH/640)`; the stage element is given `width = availW/scale; height = availH/scale` and `transform: scale(scale); transform-origin: 0 0` ONLY when `scale < 1` (at scale 1 use `transform:none`, so there is no needless containing block, blurry text or extra compositing layer). `LAB.stage = { w, h, scale, toStage(clientX, clientY) → {x,y} }` (recomputed on resize, `rAF`-throttled, emits `stage:resize`). ALL pointer maths in wm/dnd/finder use `LAB.stage.toStage` (never raw clientX deltas). `getBoundingClientRect()` values must be divided by `scale` when compared with stage coordinates.
- Safe resize (on every `stage:resize`, including pinning/unpinning the rail): (1) `wm` re-clamps every window into `workArea()` (a window larger than the work area is shrunk to fit, never below its `minW/minH`; minimised windows are untouched); (2) desktop icons re-flow into the new column height; (3) the Dock re-centres; (4) open menus and the Spotlight panel close.
- Region constants (stage px): `MENUBAR_H = 28`, `DOCK_H = 76` (icon 52 + padding; the dock floats 8 px above the bottom), `DESKTOP_ICON_COL_W = 110` (icons column at the right edge). Exported as `LAB.stage.menubarH`, `LAB.stage.dockH`, `LAB.stage.workArea()` → `{x:0, y:28, w:stage.w, h:stage.h-28}`; `LAB.stage.spawnArea()` → `{x:24, y:44, w:stage.w-24-130, h:stage.h-44-DOCK_H-12}` (new windows are placed inside spawnArea so they do not cover the desktop icons or the dock); `LAB.stage.zoomRect()` → `{x:24, y:40, w:stage.w-48, h:stage.h-40-96}` (the green light fills the work area minus the Dock with a 24 px side margin; it deliberately covers the icon column).
- Phone / small screens: see §6.3.

### 2.2 Menu bar `[SKIN]` (js/menu.js + js/desktop.js)

- Height 28 px, translucent (`rgba(18,20,32,.42)` + `backdrop-filter: blur(20px) saturate(1.4)` with the `-webkit-` twin; both removed under `data-perf=low`, §2.10), text `#fff`, font 13 px (500; app name 700).
- Left to right: course-mark glyph (menu "練習") → frontmost app name (bold) → that app's menus. Right cluster (right to left): clock, control-centre glyph (popover with two inert sliders), Spotlight magnifier (click = open Spotlight), battery glyph, Wi-Fi glyph, input-source box showing `ABC` (cosmetic; clicking toggles to `注` and back and shows toast 「提醒：在終端機輸入指令前，輸入法要用英文（ABC）」 — purely cosmetic, does not change input behaviour).
- Course-mark glyph = three ascending bars in a 14×14 box (original). Its menu 「練習」: 關於這個練習…, 快速鍵一覽…, 進度代碼…(opens About › 進度, §4.3.4), 重設全部…(confirm sheet 「要重設全部嗎？」), separator, 回到課程 Week 3 (link `../../weeks/week03/`).
- Clock: `10月4日 週日 上午10:12` (month + day + 週X + 上午/下午 + 12-hour without leading zero; noon = 下午12:xx; midnight = 上午12:xx). Updates every 15 s from `LAB.clock.now()`. Click = popover 「沒有通知」.
- Per-app menus (frontmost app, via `LAB.menu.register(appId, fn)`, §3.9). App-name menu is generated by core: 關於 {name}, separator, 設定⋯ (disabled), separator, 隱藏 {name} (⌘H), 隱藏其他 (disabled), 全部顯示 (disabled), separator, 結束 {name} (⌘Q). Remaining menus per app:
  - Finder: 檔案, 編輯, 顯示方式, 前往, 視窗, 輔助說明
  - 終端機: 殼層, 編輯, 顯示方式, 視窗, 輔助說明
  - Codex (English): File, Edit, View, Window, Help
  - Code: 檔案, 編輯, 檢視, 前往, 視窗, 說明
  - 文字編輯: 檔案, 編輯, 格式, 顯示方式, 視窗, 輔助說明
  - 關於這個練習: (name menu only) + 視窗
  Menus whose items are not implemented still open and show items greyed out (the real feel matters), but every item listed in §4 for that app must work.
- Menu behaviour: click title opens; while open, hovering another title switches; Esc / click away closes; items show shortcut glyphs on the right (⌘ ⇧ ⌥ ⌃); disabled items grey; separators; submenu opens on hover after 120 ms; highlighted item = accent-blue background with white text. Menus are keyboard-navigable with ↑/↓/Return/Esc and carry `role=menubar / menu / menuitem` (§6.5).

### 2.3 Icons `[SKIN]` (js/icons.js)

All original inline SVG strings, `viewBox` 0 0 64 64 for app/file icons, 0 0 24 24 for UI glyphs, `currentColor` for glyphs. Do not imitate Apple's exact icon art: simple shapes only.

Required names (CORE ships all of these so apps need not wait):
- App icons (64 box). The Dock icons must be told apart at a glance by SHAPE and GLYPH, not by colour alone, because missions name apps by label and students mix up Terminal/Codex and Code/Codex: `app-finder` (blue rounded square with a simple folder-in-window glyph; NOT the split two-faced square), `app-terminal` (near-black `#111` rounded square with a white `>_` at the LOWER-LEFT only), `app-codex` (dark `#2a2a2a` squircle with ONLY a thin light outline of a soft blob in the middle: no `>_` and no text; also used as the empty-state logo, scalable to 34 px), `app-code` (blue rounded square with angle-bracket strokes `‹ ›`, nothing else), `app-textedit` (white page, folded corner, three grey lines), `app-about` (cream rounded square with the three-bar course mark), `app-trash-empty`, `app-trash-full`, `app-downloads` (folder with a down arrow).
- File icons (64 box): `folder` (blue gradient `#9fd3ff → #5aa7ee`, tab `#4c95dc`), `doc` (white page), `md`, `txt`, `csv`, `pdf`, `docx`, `zip` (page with zipper strip), `app`, `image`, `unknown`. Small variants are the same SVG at smaller size; extension labels are drawn as tiny text in the SVG (`MD`, `CSV`, `PDF`, `DOCX`, `ZIP`).
- UI glyphs (24 box, 1.6 stroke): `chev-left chev-right chev-up chev-down search plus pencil folder-sm laptop check x send house clock apps desktop doc-sm download list-view icon-view share tag gear info wifi battery control-center ime sort-asc sort-desc mark` (mark = course mark).
- API: `LAB.icons.get(name, {size=24, cls=''}) → string` (returns the `<svg …>` markup), `LAB.icons.el(name, opts) → HTMLElement`, `LAB.icons.add(name, svgStringOrFn)` (apps may add their own in their own file; an existing name is never overwritten), `LAB.icons.forNode(statObj) → icon name` (folder / md / csv / txt / zip / pdf / docx / app / doc / unknown by extension and type).

### 2.4 CSS tokens (css/base.css)

```
:root {
  /* page + rail (editorial, like the course site; NOT the Mac) */
  --lab-bg:#ebe9e4; --lab-ink:#111; --lab-ink-2:#4a4843; --lab-ink-3:#5f5c55;   /* ink-3 >= 5:1 on bg */
  --lab-line:rgba(17,17,17,.14); --lab-accent:#8a5400;   /* amber text >= 5:1 on bg */ --lab-ease:cubic-bezier(.2,.7,.2,1);
  /* mac light */
  --mac-win-bg:#fff; --mac-bar:#ececec; --mac-bar-line:#d4d4d4; --mac-text:#1d1d1f; --mac-text-2:#6e6e73;
  --mac-sidebar:rgba(246,246,246,.92); --mac-hair:rgba(0,0,0,.12); --mac-accent:#0a6cff;
  --mac-sel:rgba(10,108,255,.14); --mac-sel-strong:#0a6cff; --mac-sel-inactive:rgba(0,0,0,.10);
  --mac-red:#ff5f57; --mac-yellow:#febc2e; --mac-green:#28c840; --mac-light-off:#d4d4d4;
  --mac-radius:12px; --mac-shadow-on:0 22px 60px rgba(0,0,0,.35),0 0 0 .5px rgba(0,0,0,.35);
  --mac-shadow-off:0 8px 24px rgba(0,0,0,.22),0 0 0 .5px rgba(0,0,0,.25);
  /* z scale (stage). #lab-windows is one stacking context at --z-windows; the window counter inside it is a plain integer */
  --z-desktop:1; --z-windows:2; --z-dock:900; --z-menubar:1000; --z-menu:1100;
  --z-spotlight:1200; --z-toast:1300; --z-dnd:2000;
}
@media (prefers-color-scheme: dark){ :root:not([data-theme="light"]){ /* page+rail only */
  --lab-bg:#070707; --lab-ink:#f1efe9; --lab-ink-2:#b9b6ae; --lab-ink-3:#85827b;
  --lab-line:rgba(241,239,233,.16); --lab-accent:#f0b545; } }   /* dark ink-3 #85827b is already >= 5:1 on #070707 */
```
Only the page and rail follow dark mode; the fake Mac stays as specified in §0.3.

Scrollbars: a Windows classic 17 px bar would break the illusion inside Finder lists and Terminal, so every scroller INSIDE the fake Mac is styled as a thin overlay bar: `scrollbar-width:thin; scrollbar-color: rgba(0,0,0,.28) transparent` plus `::-webkit-scrollbar{width:8px;height:8px}` with a rounded thumb that is transparent while idle and fades in (150 ms) while the pointer is over the scroller or it scrolls (a `scroll` listener toggles `.lab-scrolling` for 900 ms). Dark apps (Codex, Code) use a light thumb. The page rail uses the normal browser scrollbar.

Sizes (stage px, near 1:1 with a 1440×900 Mac): UI text 13 px, small 11 px, title-bar 28 px (plain) or 52 px (unified toolbar), traffic lights 12 px / gap 8 / left inset 13, Finder row 24 px, Dock icon 52 px, desktop icon 64 px + 12 px label.

### 2.5 Wallpaper (js/desktop.js)

Original, drawn in code, no image file: dark navy→indigo base gradient (`#0a0f2e → #16205a → #2a1a5e`), five wide soft "silk ribbon" bands (blues/violets/pink-peach highlights) built from wavy-edged polygons with wide soft gradients. No `ctx.filter` (unsupported in Safari and slow elsewhere): the softness comes from drawing at QUARTER resolution (`stage.w/4 × stage.h/4`, upscaled by the browser with `image-rendering:auto`, which is itself a blur). Render ONCE into `#lab-wall`, seeded PRNG (no `Math.random`), light grain ±3 per channel added at half resolution on a second small canvas. Redraw only on `stage:resize` (debounced 300 ms). Keep the lower-left and the right icon column calm (no bright bands under the icon column).

### 2.6 Desktop icons `[SKIN]` (js/desktop.js)

- Live view of `/Users/an/Desktop` (entries with `!stat.hidden`, §3.5). Cells 96×100, laid out top-right going downward then to the left, ordered by name (codepoint order). New items take the next free cell; there is no manual layout persistence in v1.
- Icon 64 px + label (12 px, white, text-shadow `0 1px 3px rgba(0,0,0,.8)`, up to 2 lines, middle-ellipsis). Click = select (selected: icon gets a translucent rounded square, label gets a blue pill). Rubber-band selection on empty desktop. Double-click = `LAB.apps.openPath(path)`. Return = rename (inline editor, base name preselected, Esc cancels, Return commits; Return/Esc are ignored while `LAB.ui.isImeEnter(e)`, §3.8; name conflicts → alert sheet, §3.8; the row being renamed is never re-rendered, §3.10 rule 8). ⌘↓ opens, ⌘⌫ moves to Trash.
- Right-click on an item: 打開, 打開方式 ▸ (apps from `LAB.apps.openWith(path)`), separator, 移到垃圾桶, 取得資訊 (disabled), 重新命名, 壓縮「x」(disabled), 複製, separator, 拷貝「x」(disabled), 將「x」拷貝為路徑名稱 (`LAB.clipboard.setText(absolutePath)`, §3.1; the Terminal's paste uses it). Right-click on empty desktop: 新增檔案夾 (creates `未命名檔案夾`, then `未命名檔案夾 2`, … in rename mode), separator, 取得資訊 (disabled), 更改桌面背景⋯ (disabled), 排序方式 ▸ (disabled).
- Desktop is a drop target `desktop` (§3.10): files dragged from a Finder window are MOVED into `~/Desktop` (⌥ held = copy). Desktop icons are drag sources.
- Click on empty desktop: deselect icons, make Finder frontmost (menu bar becomes Finder's) without raising any window; all windows then look inactive but keep their stacking.

### 2.7 Dock `[SKIN]` (js/desktop.js)

- Floating translucent rounded bar centred at the bottom (8 px above the edge), icon 52 px, gap 8 px, light translucent (`rgba(255,255,255,.28)` + blur 24 px, 1 px `rgba(255,255,255,.35)` border, radius 20). Hover magnification: neighbours scale with a bell curve up to 1.4×, capped, transform only (no layout), disabled under `prefers-reduced-motion`.
- Items, left to right: Finder, 終端機, Codex, Code, 文字編輯 | divider | 下載項目 (stack icon; click opens Finder at `~/Downloads`; is also a drop target = move) | minimised-window thumbnails (small, with app badge) | 垃圾桶 (`app-trash-empty` / `app-trash-full`, click opens Finder at `~/.Trash` with title 垃圾桶; drop target = move to trash; right-click 清倒垃圾桶 → confirm sheet 「確定要永久清除垃圾桶中的項目嗎？您無法復原此動作。」 buttons 清倒垃圾桶 / 取消 (Cancel default)).
- Running apps show a 4 px dot under the icon. Hover shows a rounded label above the icon: exactly the app `title` of §3.7 (`Finder`, `終端機`, `Codex`, `Code`, `文字編輯`); missions refer to apps by these labels, never by icon colour. The Dock bar uses `-webkit-backdrop-filter` too and is re-centred on `stage:resize`. Items have `role="button"`, `aria-label` = app name, `data-lab="dock-item" data-app="<id>"`.
- Click rules: not running → launch (2–3 gentle 6 px bounces ≈ 700 ms, then open window); running with visible windows → activate and raise its last-focused window; hidden (⌘H) → unhide; only minimised windows → restore the most recent one; running with no windows → `app.open()` a new window.
- Right-click menu on an app: app name (disabled bold), its open windows (click to focus), separator, 選項 ▸ (disabled), 在 Finder 中顯示 (disabled), 隱藏, 結束 (running only), and 新增視窗 for Finder/終端機.
- A file/folder dropped on an app's dock icon: icon gets a rounded highlight when `LAB.apps.get(id).canHandle(path)` (a PURE test, §3.7) is true for every path; the drop then calls `handleOpen(path, {via:'dock'})` (side effects only here) (Codex: folder → project flow; Code: folder → open folder; TextEdit: file → open; Terminal: types the path; Finder: navigates to the folder). Otherwise rejects.

### 2.8 Spotlight `[SKIN]` (js/desktop.js)

Opened by the menu-bar magnifier (the documented way; missions use it) or by ⌘Space / Ctrl+Space as undocumented extras (the real OS and the browser may take those keys first, §6.4). Centred panel (width 640, radius 16, light translucent), `role=dialog` with one `role=combobox` field `搜尋` and a `role=listbox` of results (§6.5). Results (max 8) grouped 應用程式 / 檔案夾 / 文件: apps matched by id, English name and zh name (typing `terminal` finds 終端機; also `finder`, `codex`, `code`, `textedit`/`文字編輯`, `about`); files/folders matched by case-insensitive substring over the VFS tree under `/Users/an` (skipping `hidden` entries, Library and .Trash). ↑/↓ moves, Return opens (apps launch, files via `openPath`), Esc closes. Emits `shell:spotlight {open}`. IME composition is respected (do not search on keydown while composing; Return/Esc use `LAB.ui.isImeEnter(e)`). Focus returns to the previously focused element on close.

### 2.9 Window rules, alerts, toasts
Window rules: §3.6. Alerts and toasts: §3.8.

### 2.10 Performance mode `[SKIN]` (css/base.css, js/desktop.js)

School laptops have integrated GPUs; many `backdrop-filter` surfaces over a transformed stage, large soft shadows and permanent compositor layers make dragging stutter.
- `html[data-perf=low]` is set by `desktop.js` when ANY of: `navigator.hardwareConcurrency <= 4`; `navigator.deviceMemory <= 4` (when the browser reports it; unknown is not low); `matchMedia('(prefers-reduced-transparency: reduce)')`; or a drag probe (the first 20 `pointermove` frames of the first window drag average > 24 ms between frames). `?perf=low|high` forces it. The probe sets the flag at most once per session and never un-sets it.
- Under `data-perf=low`: menu bar, Dock, menus, Spotlight, sheets and Finder sidebar drop `backdrop-filter` and use a solid translucent colour of similar value; window shadows become `0 4px 12px rgba(0,0,0,.28)`; Dock magnification is off; fades are 100 ms.
- Always: the heavy shadow `--mac-shadow-on` is used only by the focused window (inactive windows use the light one); no permanent `will-change` (`will-change: transform` is added to a window only while it is being dragged or resized and removed on release); `.lab-win-body` has `contain: layout paint` (resize handles live on `.lab-win` and are not clipped); the wallpaper is drawn once at quarter resolution (§2.5).

---

## 3. Core contracts (exact signatures)

All APIs are properties of `window.LAB`. `type Path = string` (absolute, normalised). `type Win = object` (§3.6). All callbacks are tolerant of being called before the DOM exists only where stated.

### 3.1 Utilities `LAB.util`, `LAB.clock`, `LAB.clipboard` (js/lab.js)

```
LAB.util.h(tag, attrs?, ...children) → HTMLElement      // attrs: class, dataset:{}, style:{}, on:{click:fn}, any other → setAttribute; children: Node|string|array|null; strings become text nodes (never HTML)
LAB.util.esc(str) → string                              // HTML-escape (only for the rare static template; user data never goes through innerHTML, §0.5)
LAB.util.uid(prefix='id') → string                      // 'w1','w2'… per prefix counter
LAB.util.clamp(n, lo, hi); LAB.util.debounce(fn, ms); LAB.util.raf(fn) → cancelFn
LAB.util.charWidth(codePoint) → 0|1|2                   // terminal columns of one code point (rules below)
LAB.util.displayWidth(str) → number                     // sum of charWidth over code points (iterate with for…of, not UTF-16 units)
LAB.util.sleep(ms) → Promise
LAB.util.once(fn)
LAB.util.fmt.clockMenubar(date) → '10月4日 週日 上午10:12'
LAB.util.fmt.finderDate(ms) → '今天 上午10:12' | '昨天 下午3:20' | '2026年9月28日 上午9:58'
LAB.util.fmt.lsDate(ms) → 'Oct  4 10:12' (<6 months old) | 'Oct  4  2025'
LAB.util.fmt.lastLogin(ms) → 'Fri Oct  2 09:41:07'     // day-of-month padded with a space to width 2
LAB.util.fmt.size(bytes) → '54 位元組' | '1 KB' | '3.4 MB'   // decimal units; 0 → '0 位元組'; folders show '--' (Finder decides)
LAB.clock.now() → Date          // real time, or real time shifted by the ?now= offset (it keeps ticking, never frozen)
LAB.clock.ms() → number
```
`charWidth` rules (the ONE definition, shared by `ls` columns, Terminal rendering, cursor and selection): combining and zero-width code points (U+0300–036F, U+200B–200F, U+20D0–20FF, U+FE00–FE0F) = 0; East Asian Wide/Fullwidth = 2: U+1100–115F, U+2E80–303E (this includes the ideographic space U+3000 and 「」、。), U+3041–33FF, U+3400–4DBF, U+4E00–9FFF, U+A000–A4CF, U+AC00–D7A3, U+F900–FAFF, U+FE30–FE6F, U+FF00–FF60 (fullwidth forms such as ，！？：), U+FFE0–FFE6, U+1F300–1F64F, U+1F900–1F9FF, U+20000–3FFFD; everything else = 1 (half-width katakana U+FF61–FF9F stay 1).

#### 3.1.1 `LAB.clipboard` (js/lab.js)
One place for the in-page clipboard (file paths from Finder, text from 「拷貝為路徑名稱」, copy from fake apps). `navigator.clipboard` is undefined on `file://`, can reject outside a gesture, and the native `paste` event reads the OS clipboard, so a path copied inside the lab would otherwise not paste.
```
LAB.clipboard = { text:'', paths:[], op:'copy' }
LAB.clipboard.setText(t)            // stores t, marks it newer than any native copy, and writes it to the real clipboard (Clipboard API, then the `execCommand('copy')` fallback) and RETURNS a `Promise<boolean>`: true only when something was really copied (§14)
LAB.clipboard.setPaths(paths, op)   // Finder 拷貝/剪下 of files (op 'copy'); also stores text = absolute paths joined by newline
LAB.clipboard.forPaste(e)           // for a native `paste` event: returns LAB.clipboard.text when the lab's last setText/setPaths is NEWER than the last native copy/cut event seen on the page, otherwise e.clipboardData.getData('text/plain')
```
lab.js installs capture `copy`/`cut` listeners on `document` that record "native copy happened now" (so a later ⌘C in the Terminal selection wins over an older lab copy). Terminal paste (§4.2.2), Finder paste and TextEdit/Code paste all read through `forPaste` where they handle `paste` themselves.

### 3.2 Boot (js/lab.js + js/boot.js)

```
LAB.ready(fn, priority=50)   // fn runs once after DOM ready AND all scripts loaded; lower priority runs first; called after boot already ran → next microtask (§1.1)
LAB.boot.run()               // defined in lab.js, called ONLY by boot.js on DOMContentLoaded; runs LAB.ready callbacks in priority order
```
Priority bands: 10 store restore, 20 vfs, 30 shell (stage/wm/menubar/dock/desktop), 40 apps init (each app registers menus/handlers), 60 codex/terminal restore, 80 missions, 90 first-run welcome/phone notice. Boot order is fixed by boot.js; app files only call `LAB.ready` for init that needs the DOM. boot.js, in order: (1) parse the query flags (§0.5; `reset=1` freezes the store, removes the key, then boots from the seed), (2) force `<html lang="zh-Hant">` after i18n.js's own handler has run (§0.1 item 7), (3) `LAB.boot.run()`, (4) strip one-shot parameters with `history.replaceState`.

### 3.3 `LAB.bus` and event names (js/lab.js)

```
LAB.bus.on(name, fn) → offFn          // name may be '*' (fn receives (name, payload))
LAB.bus.once(name, fn) → offFn
LAB.bus.off(name, fn)
LAB.bus.emit(name, payload={})        // synchronous and re-entrant; each handler in try/catch (errors → console.error, never thrown)
LAB.bus.history                       // ring buffer (max 300) of {seq, t, name, data}
LAB.bus.seq() → number                // last sequence number issued
LAB.bus.find(name, pred?, sinceSeq=0) → entry|null     // newest history entry with entry.seq > sinceSeq whose data satisfies pred
LAB.bus.seen(name, pred?, sinceSeq=0) → data|null      // same, returns entry.data
LAB.bus.listeners() → {name: count}   // debug
```
`seq` is a strictly increasing integer (first event = 1) assigned inside `emit` BEFORE any handler runs, so event order is exact even when the clock is offset by `?now=` and when many events share a millisecond. `t` is only for display. Mission checks and the engine compare `seq`, never `t`. A trimmed tail of the history (last 80 entries whose names are `term:run`, `finder:navigate`, `finder:open`, `editor:open`, `editor:save`, `code:folder`, `dnd:drop`, `codex:*`; `out` cut to 600 chars) is persisted in store domain `bus`, and `seq` resumes from the persisted maximum, so an event-only step does not lose its evidence on reload. Payload objects must be plain data (no DOM nodes) so history stays serialisable. `emit` stamps nothing on payloads.

Event catalogue (name → payload fields). `by` ∈ `'finder'|'desktop'|'terminal'|'codex'|'editor'|'dock'|'system'`. Anything done by a mission `prepare` or by `LAB.seed.restore` uses `by:'system'`.

| Event | Payload |
|---|---|
| `app:launch` | `{appId}` (first window of a not-running app) |
| `app:quit` | `{appId}` |
| `app:frontmost` | `{appId}` |
| `apps:changed` | `{id}` (an app definition was registered or replaced, §1.1) |
| `win:open` | `{id, appId, title}` |
| `win:close` | `{id, appId}` |
| `win:focus` | `{id, appId}` |
| `win:minimize` / `win:restore` | `{id, appId}` |
| `win:zoom` | `{id, appId, zoomed}` |
| `win:move` / `win:resize` | `{id, appId, rect:{x,y,w,h}}` (once at the END of a drag/resize, not per frame) |
| `stage:resize` | `{w, h, scale}` |
| `fs:change` | `{op, path, from?, kind:'file'|'dir', by, trashed?}` where `op` ∈ `create write mkdir remove move rename copy touch`; for `move`/`rename`/`copy`: `path` = new location, `from` = old/source |
| `fs:read` | `{path, by}` — only emitted when `by` is passed and not `'system'` |
| `finder:navigate` | `{winId, path, via}` `via` ∈ `sidebar pathbar back forward up open goto desktop dock initial` (`path` is the canonical folder path; the virtual folder uses the literal `'recents:'`, which is NOT an absolute path: `LAB.vfs.same('recents:', anything)` is false, §3.5) |
| `finder:select` | `{winId, paths}` |
| `finder:open` | `{path, kind, via}` — emitted by `LAB.apps.openPath` ONLY (single emitter; Finder, desktop, Spotlight and Terminal call `openPath`), once per call, before app resolution; `via` ∈ `finder desktop spotlight terminal dock codex menu open` |
| `finder:view` | `{winId, mode:'icon'|'list'}` |
| `desktop:select` | `{paths}` |
| `term:run` | `{winId, line, name, args, cwd, cwdAfter, status, out, cmds}` — one event per whole line, emitted after the line finished (after a `sleep`, after a `session.prompt` exchange). `line` = the full source (continuation lines joined by `\n`). `name`/`args`/`cwd` = the FIRST simple command; `cwdAfter` = cwd at the end of the line; `status` = status of the last command; `out` = all text printed by the line. `cmds` = `[{name, args, cwd, cwdAfter, status, out}]`, ONE ENTRY PER SIMPLE COMMAND THAT ACTUALLY RAN (a command skipped by `&&`/`||` has no entry; each element of a pipeline has an entry), with `cwd` tracked per command so `cd Desktop && pwd` gives `[{cd, cwd:~, cwdAfter:Desktop}, {pwd, cwd:Desktop}]`. `args` are POST-PARSE words: quotes removed, `~`, `$VAR` and globs expanded, backslash escapes resolved. Empty lines emit nothing. Missions use `api.termCmd` (§5.1) and never read the top-level fields for compound lines. |
| `term:cwd` | `{winId, cwd, from}` |
| `term:drop` | `{winId, paths, text}` (paths dropped onto Terminal; `text` = what was typed) |
| `term:exit` | `{winId}` |
| `dnd:start` | `{payload}` |
| `dnd:drop` | `{payload, targetId, accepted:boolean, mode}` |
| `dnd:cancel` | `{payload}` |
| `codex:trust-prompt` | `{path}` (Trust modal shown) |
| `codex:trust` | `{path}` (Trust folder clicked) |
| `codex:trust-cancel` | `{path}` |
| `codex:project` | `{path, name}` (project row exists / was selected via drop or programmatic add) |
| `codex:select-project` | `{path}` (user clicked a project row, EVERY click, even when that project is already selected, or its "+" → a project draft chat is active) |
| `codex:new-chat` | `{chatId, projectPath|null}` (user clicked top New chat → `null`; project "+" → path) |
| `codex:send` | `{chatId, projectPath|null, text}` |
| `codex:reply` | `{chatId, projectPath|null, intent, files:[Path], text}` (after the whole scripted reply finished, even if the window was closed or another chat selected meanwhile; `files` = absolute paths created or edited in this reply) |
| `editor:open` | `{path, appId:'textedit'|'code'|'quicklook', winId}` — emitted EVERY time a document is opened or re-focused through `openPath`/Open With/double-click, even if it was already open |
| `editor:save` | `{path, appId}` |
| `code:folder` | `{path}` (Code opened a folder in its explorer) |
| `shell:spotlight` | `{open:boolean}` |
| `store:reset` | `{scope}` |
| `mission:start` | `{missionId}` |
| `mission:step` | `{missionId, stepId, index, skipped?}` (a step became done) |
| `mission:complete` | `{missionId}` |
| `mission:reset` | `{missionId}` |

`mission:*` events are ignored by the mission engine itself (no feedback loop, §5.1).

### 3.4 `LAB.store` (js/store.js) — in memory only (rewritten in §18)

Nothing is saved between visits. `LAB.store` keeps the small shared UI state (`ui.railMode`, `ui.welcomeSeen`, `ui.cardPos`, …) in a plain object and lets every module register a domain (`vfs`, `codex`, `term`, `bus`, `missions`) so that boot and `reset(scope)` can start or reset them from the seed. It never touches `localStorage` for the lab state. Open windows and the Terminal screen were never part of it (§0.3).
```
LAB.store.register(domain, {serialize()→json, restore(json|undefined), reset(), migrate?})   // serialize/migrate are no longer called; kept so modules do not change
LAB.store.get(path, dflt)        // dot path into the in-memory object, e.g. get('ui.railMode', 'drawer')
LAB.store.set(path, value)       // in memory only
LAB.store.markDirty()            // no-op (modules still call it)
LAB.store.load()                 // at boot (ready priority 10): ui = {}, every domain gets restore(undefined) = its seed
LAB.store.reset(scope='all')     // 'all' emits store:reset and reloads the page; 'vfs'|'missions'|'codex'|'term' reset that domain in place and emit store:reset
LAB.store.notice(text|null)      // one quiet line in the rail footer and the About window; nothing sets it any more
LAB.store.clearLegacy()          // removes localStorage "lab-mac:v1" and "lab-mac:v1:bak" and sessionStorage "lab-mac:tab"; runs once when store.js is evaluated
```
Removed with §18: `store.available`, `store.frozen`, `store.readOnly`, `store.save`, the `storage` listener (two-tab `rev` conflict, `store:conflict`), the `pagehide` / `visibilitychange` final save, the quota toast and the 「這個瀏覽器不能儲存進度」 notice. The phone-notice choice (sessionStorage `lab-phone-ok`) is separate and stays.

### 3.5 `LAB.vfs` (js/vfs.js + js/seed.js)

In-memory tree, Unix paths, home `/Users/an`. External JSON node (§ persistence): dir `{t:'d', m, c:{name:node}}`, file `{t:'f', m, x:content, s?, b?:1, k?, z?}`. In memory: `{type:'dir', mtime, ctime, kids}` where `kids` is a `Map` keyed by `fold(name) = name.normalize('NFC').toLowerCase()` with value `{name, node}` (so lookup is case-insensitive and case-preserving, exact-case match wins on a tie, and a file named `__proto__`, `constructor` or `hasOwnProperty` is just a file); `{type:'file', mtime, ctime, size, content:string|null, binary?:true, kind?:'zip'|'app', zip?:[…]}`. `size` of a text file = UTF-8 byte length of `content`.

Names: case-preserving, never empty, never `.` or `..`, no `/` and no NUL, at most 255 UTF-8 bytes. EVERY mutation (create, mkdir, rename, move, copy, extract, trash collision names) calls `LAB.vfs.checkName(name)` which throws `VfsError('EINVAL')` or `VfsError('ENAMETOOLONG')`.

Two derived flags on `stat` (they are different things, do not conflate):
- `dot` = the name starts with `.` (what `ls` hides).
- `hidden` = `dot` OR the folder is `/Users/an/Library` (what Finder and the desktop hide; ⇧⌘. shows them). `Library` is therefore listed by `ls` (as on a real Mac and in the supplement transcript) but not shown in Finder.

```
LAB.vfs.HOME = '/Users/an'
// path helpers (pure)
LAB.vfs.normalize(path, cwd='/') → Path      // expands leading '~'/'~/', resolves '.' '..', collapses '//', strips trailing '/', keeps typed case
LAB.vfs.canon(path, cwd='/') → Path          // normalize + replaces each segment by the stored case when it exists (case-insensitive match); non-existing tail keeps typed case. A virtual id that is not an absolute path ('recents:') is returned unchanged.
LAB.vfs.join(...parts) → Path;  basename(p); dirname(p); extname(p) → '.md'|''
LAB.vfs.same(a, b, cwd?) → boolean           // false when either side is not an absolute path (virtual ids); otherwise canon(a) === canon(b)
LAB.vfs.isUnder(path, dir) → boolean
LAB.vfs.displayName(path) → string           // Finder name: '/Users/an/Desktop' → '桌面', '/Users/an/Movies' → '電影', '/Users/an' → 'an', '/Users' → '使用者', '/' → 'Macintosh HD', '.Trash' → '垃圾桶'; otherwise basename
LAB.vfs.checkName(name)                      // throws EINVAL / ENAMETOOLONG
// queries
LAB.vfs.exists(p); isDir(p); isFile(p)
LAB.vfs.stat(p) → {path, name, type:'dir'|'file', kind:'folder'|'text'|'zip'|'binary'|'app', size, mtime, ctime, dot, hidden, count?} | null    // count = number of entries for dirs
LAB.vfs.list(p) → stat[]                     // ALL entries incl. dot and hidden, sorted by name in UTF-16 code-unit order (uppercase before lowercase, like BSD ls); throws VfsError. Callers filter: `ls` keeps `!dot` (unless -a/-A), Finder/desktop/Spotlight keep `!hidden`.
LAB.vfs.visible(statList) → stat[]           // helper: filter(!hidden)
LAB.vfs.readFile(p, {by}) → string           // throws EISDIR/ENOENT; emits fs:read when by && by!=='system'; binary files return '' (callers check stat.kind)
LAB.vfs.walk(p, fn(stat, depth))
// mutations (each emits exactly one fs:change per affected top-level op)
LAB.vfs.writeFile(p, content, {by='system', append=false}) → {created:boolean}     // parent must exist (ENOENT); updates mtime; > 200 KB per file or > 1.2 MB total → ENOSPC
LAB.vfs.mkdir(p, {by, parents=false})
LAB.vfs.touch(p, {by})
LAB.vfs.remove(p, {by, recursive=false, force=false})                                 // permanent
LAB.vfs.trash(p, {by}) → Path (new location in /Users/an/.Trash; collisions → 'name 2')
LAB.vfs.emptyTrash({by})
LAB.vfs.move(from, to, {by, overwrite=true}) → finalPath   // if `to` is an existing dir → moves INTO it keeping the name; moving a dir into itself → EINVAL; silently renames when `to` does not exist (mv semantics)
LAB.vfs.rename(p, newName, {by}) → Path
LAB.vfs.copy(from, to, {by, recursive=false}) → finalPath
LAB.vfs.uniqueName(dir, base, ext='') → string     // 'x'→'x 2'→'x 3'; folders '未命名檔案夾', '未命名檔案夾 2'; copies 'x 拷貝', 'x 拷貝 2'
LAB.vfs.extractZip(zipPath, destDir, {by}) → [{path, type, mtime}]   // creates entries in destDir (Terminal unzip semantics); entries keep THEIR archive mtimes (Oct 2 09:00), not the run time
LAB.vfs.extractFinder(zipPath, {by}) → Path                      // Archive Utility: creates a sibling folder named after the zip ('week3'; if taken 'week3 2'); same mtime rule
// persistence and instances
LAB.vfs.seed()          // rebuild the initial tree (§4.0)
LAB.vfs.toJSON() / LAB.vfs.load(json)   // compact: dir {t:'d',m,c:{…}}, file {t:'f',m,x:content,s?,b?:1,k?,z?}
LAB.vfs.reset()         // seed() + emit fs:change {op:'create', path:'/Users/an', kind:'dir', by:'system'} once
LAB.vfs.batch(fn)       // runs fn; events emitted during it are still emitted individually (consumers must debounce); kept for symmetry
LAB.vfs.create(json?)   // factory: a NEW independent instance with the same API (default: the seed, or `load(json)`); `LAB.vfs` itself is the default instance. Used by unit tests (scratch trees) and by `LAB.shell.newSession({vfs})`
class LAB.vfs.VfsError extends Error { code:'ENOENT'|'EEXIST'|'ENOTDIR'|'EISDIR'|'ENOTEMPTY'|'EINVAL'|'EACCES'|'ENAMETOOLONG'|'ENOSPC', path }
LAB.vfs.errText(code) → 'No such file or directory' | 'File exists' | 'Not a directory' | 'Is a directory' | 'Directory not empty' | 'Invalid argument' | 'Permission denied' | 'File name too long' | 'No space left on device'
```
Rules: `move`/`rename`/`copy` onto an existing FILE overwrite silently (callers that need a prompt, i.e. Finder drag, check `exists` first and ask via an alert sheet). `/Users/an/Library` is `hidden` but listable. Mission checks use `LAB.vfs.canon` and `exists`. Zip entry format (`node.zip`, the `z` field in JSON): `[{name, type:'dir'|'file', content, mtime}]` with names relative to the archive root and a trailing `/` on directories, e.g. `{name:'week3/', type:'dir', mtime}`, `{name:'week3/README.md', type:'file', content, mtime}`.

Persistence and validation: the whole tree is serialised (a few KB). `LAB.vfs.load(json)` VALIDATES before accepting: types are `d`/`f` only, depth ≤ 40, every name passes `checkName`, text content is a string within the caps, `m` is a finite number, `z` entries are well-formed; an invalid subtree is replaced by the seed's node at the same path (or dropped when the seed has none) rather than failing the whole tree; if the root itself is unusable it falls back to `seed()`. After a load the skeleton (`/Applications`, `/Users/an` and its eight standard folders `Desktop Documents Downloads Library Movies Music Pictures Public`, `.Trash`) is recreated from the seed when missing. Tampered `localStorage` therefore cannot create script-bearing names or prototype pollution (names are only ever used as Map keys and `textContent`).

`LAB.seed` (js/seed.js) — the restore API missions use (§5.1 `api.ensureSeed`):
```
LAB.seed.tree() → fresh deep copy of the complete seed JSON
LAB.seed.nodeAt(path) → deep copy of the seed node at that path (compact JSON form) | null
LAB.seed.restore(path, {overwrite=false}) → boolean   // writes the seed node (creating missing parents) into LAB.vfs with by:'system'; if something already exists at path it does nothing unless overwrite:true (a dir is then removed and rebuilt from the seed); returns whether it wrote
```
Seed files are exactly the content in §4.0 (so `AGENTS.md`, `data/*.csv`, `week3.zip` and the Project folder can always be put back).

### 3.6 `LAB.wm` (js/wm.js) — window manager `[SKIN]`

```
LAB.wm.open(opts) → Win
  opts: { appId, title, width, height, x?, y?, minW=320, minH=200, resizable=true,
          bar:'plain'|'unified'|'hidden',      // plain 28px; unified 52px (toolbar slot); hidden = transparent drag strip 40px, lights overlaid (Codex)
          theme:'light'|'dark',               // chrome tint (dark for Codex/Code)
          content: HTMLElement,               // appended into win.body
          toolbar?: HTMLElement,              // unified: placed right of the lights
          singleton?: string,                 // if a window with this key exists → focus and return it
          onClose?: (win)=>boolean|void,      // return false to veto (e.g. unsaved changes)
          icon?: string }                     // dock thumbnail icon name
LAB.wm.get(id) → Win|null;  LAB.wm.all() → Win[] (z-order bottom→top);  LAB.wm.byApp(appId) → Win[]
LAB.wm.focused() → Win|null;  LAB.wm.frontmostApp() → appId|'finder'
LAB.wm.focus(id); LAB.wm.close(id, {force}); LAB.wm.minimize(id); LAB.wm.restore(id); LAB.wm.zoom(id)
LAB.wm.hideApp(appId); LAB.wm.showApp(appId); LAB.wm.isHidden(appId)
LAB.wm.cycle(appId?)     // ⌘` : next window of the frontmost app
LAB.wm.spawnRect(w, h) → {x,y}   // cascaded (+26,+26 per existing window of the same app), clamped into LAB.stage.spawnArea()
Win = { id, appId, el, body, titleEl,
        setTitle(text), getRect()→{x,y,w,h}, setRect({x,y,w,h}),
        focus(), close(force), minimize(), restore(), zoom(),
        isFocused(), isMinimized(), isZoomed(),
        on(evt, fn) → off,      // evt: 'focus'|'blur'|'resize'|'move'|'close'|'zoom'
        own(disposeFn) → disposeFn,   // register teardown work; ALL disposers run (in reverse order, each in try/catch) when the window closes
        state: {} }             // scratch for the app; documents windows expose state.path (current document path, '' when none) and state.dirty so missions can ask "which file does this window show" (§5.1)
```
Behaviour:
- DOM: `.lab-win[data-lab="win"][data-app][data-win]` containing `.lab-win-bar` (traffic lights `.lab-tl` with three `<button data-lab="tl-close|tl-min|tl-zoom">`, `.lab-win-title`, toolbar slot), `.lab-win-body`, eight resize handles. Windows live inside `#lab-windows` (own stacking context, §2.1).
- Z-order: a plain integer counter inside `#lab-windows` (`z = ++counter`; no renormalisation, the layer is its own stacking context). `mousedown` (capture) anywhere in a window focuses and raises it, then the event continues to the control under the cursor (click-through). Focusing emits `win:focus`, `app:frontmost` if the app changed, and updates the menu bar.
- Inactive window: lights `--mac-light-off`, title at 50% opacity, `--mac-shadow-off`. Lights show glyphs (✕, −, ⤢ drawn in SVG) when the pointer is over the group; they colour on hover even when inactive.
- Drag by the bar (not by buttons/inputs; for unified bars also by empty toolbar areas, `data-drag` attribute marks draggable regions): 3 px movement threshold; clamp so the title bar stays below the menu bar (y ≥ 28) and ≥ 40 px stays visible horizontally; may go partly off the bottom. Dragging uses `transform: translate3d` (with `will-change: transform` only for the drag), committing `left/top` on release; emits `win:move` once on release.
- Resize: 5 px edge zones, 10 px corners, correct resize cursors; per-window `minW/minH`; `'resize'` event and `win:resize` once on release; windows never shrink below min. Terminal recomputes cols/rows on resize.
- Close (red) / ⌘W: calls `onClose`; a veto keeps the window; otherwise runs every `win.own` disposer, removes the DOM, emits `win:close`. Closing the last window never quits the app. Minimise (yellow) / ⌘M: scale-down 0.94 + fade (250 ms) then hidden; a thumbnail appears in the Dock (right section); clicking restores. Zoom (green) / double-click on the bar: toggles between the previous rect and `LAB.stage.zoomRect()` (§2.1; there is no full-screen mode). ⌘H hides the app (`hideApp`), the Dock click shows it.
- `LAB.wm.open` emits `win:open`; if the app had no windows, the registry (§3.7) emits `app:launch` first.
- Resource rule: every window-scoped `LAB.bus.on`, `LAB.dnd.source/target`, `LAB.keys.on`, interval or `requestAnimationFrame` loop is registered through `win.own(...)`, so a long class session does not accumulate listeners on detached DOM (checked under `?debug=1`, §0.5).

### 3.7 `LAB.apps` (js/apps.js)

```
LAB.apps.register(id, def)       // eval-time call; an existing id is REPLACED in place and `apps:changed {id}` is emitted (§1.1)
  def: { title,               // zh display name (menu bar app name, dock label): 'Finder', '終端機', 'Codex', 'Code', '文字編輯', '關於這個練習'
         en?: string,          // English name for Spotlight
         aliases?: string[],   // Spotlight keywords (lowercase)
         icon: string,         // LAB.icons name
         dock?: boolean,       // appears in the Dock's left group
         open(args?) → Win,    // opens a NEW window (or focuses a singleton) and returns it
         canHandle?(path) → boolean,           // PURE (no side effects, no DOM changes): can this app take that path? Used by drop targets' `accept()`, which runs on every pointermove
         handleOpen?(path, {via}) → boolean,   // open a file/folder with this app (side effects live here and only here); return false if it cannot
         canOpen?(stat) → number,              // 0 = no, higher = better; ONLY orders the Open With submenu (it never decides the default app)
         quit?() }             // optional cleanup
LAB.apps.get(id) → def|null;  LAB.apps.all() → def[]
LAB.apps.launch(id, args?) → Win|null      // handles running state, bounce animation, app:launch, app:frontmost; unregistered id → toast 「這個程式還沒安裝（練習版）」
LAB.apps.isRunning(id) → boolean;  LAB.apps.running() → id[]
LAB.apps.quit(id)                           // closes all windows (force), emits app:quit, removes dock dot
LAB.apps.openPath(path, {appId?, via='open'}) → boolean
   // emits finder:open {path, kind, via} exactly once (the single emitter, §3.3), then resolves the app:
   //   explicit appId → that app's handleOpen; otherwise defaultFor(path)
LAB.apps.openWith(path) → [{appId, label}]  // apps whose canOpen(stat) > 0, best first; Finder's 打開方式 submenu uses it
LAB.apps.defaultFor(path) → appId           // EXPLICIT table, not canOpen: directory → finder; `.zip` → 'archive' (extractFinder, then select the result in Finder); `.md .txt .csv .json .log` → textedit; `.app` → launch that app; anything else (docx, pdf, …) → quicklook
```
`canOpen` values: Finder dir 10; Codex dir 20; Code dir 20 and text files 15 (below TextEdit's 20, so the 打開方式 list shows TextEdit first for `.md`); TextEdit `.md .txt .csv .json .log` 20 and other text 10; Quick Look any file 5. `canHandle`: Codex dir; Code dir or text file; TextEdit text file; Terminal anything; Finder dir (file → its parent).
Default seed apps: `finder, terminal, codex, code, textedit, about`; `quicklook` is a non-dock helper registered by textedit.js. `/Applications` contains stub `.app` nodes for `Codex`, `Code`, `文字編輯`, `終端機` (kind `app`, double-click launches the matching app; Terminal's real path `/System/Applications/Utilities/終端機.app` is not modelled).

### 3.8 `LAB.ui`, `LAB.keys` (js/ui.js)

```
LAB.ui.toast(text, {ms=3200}) → void        // small bottom-centre card in #lab-overlays (z-toast), `role=status`; stacks max 2; fades 200 ms
LAB.ui.alert(win|null, {title, text?, buttons:[{label, value, default?, cancel?, danger?}]}) → Promise<value>
   // mac alert sheet attached to the window's title bar (slides down 200 ms), or a centred panel if win is null; `role=alertdialog aria-modal=true`, labelled by its title; Return = default button, Esc = cancel button; focus is trapped inside and returns to the previously focused element on close; dims the window slightly
LAB.ui.confirm(win|null, {title, text, ok='好', cancel='取消', danger=false}) → Promise<boolean>
LAB.ui.prompt(win|null, {title, text?, value='', ok='好', cancel='取消'}) → Promise<string|null>   // used for 「儲存」 name field in TextEdit
LAB.ui.contextMenu(x, y, items)   // alias of LAB.menu.contextMenu (stage coords)
LAB.ui.isImeEnter(e) → boolean    // true when this keydown must NOT be treated as Enter/Esc: e.isComposing || e.keyCode === 229 || (performance.now() - lastCompositionEnd < 30). Safari delivers the committing Enter as a keydown with isComposing=false right after compositionend; `lastCompositionEnd` is recorded by one global capture `compositionend` listener.
LAB.keys.mod(e) → boolean         // true when (e.metaKey || e.ctrlKey) — Ctrl stands in for Cmd on Windows keyboards, subject to the Terminal rule below
LAB.keys.on(spec, fn, {scope}) → offFn   // spec like 'mod+shift+g', 'mod+space', 'escape'; scope 'global' or an appId (fires only when that app is frontmost)
```
EVERY handler that treats Enter or Esc as "commit"/"cancel" in a text field MUST start with `if (LAB.ui.isImeEnter(e)) return;`. This covers Finder rename and search, Go-to-folder, desktop rename, Spotlight, the TextEdit save prompt, the Codex composer and the Terminal input (the missions make students type 練習 with a Chinese input method).

A single capture-phase `keydown` listener on `window` routes: (1) open menu/spotlight/sheet gets Esc/Return/arrows first; (2) if the event target is a real `<input>/<textarea>/[contenteditable]` of a fake app, let it receive the event natively and only intercept registered app shortcuts that do not conflict with editing; (3) else dispatch to the frontmost app's `LAB.keys.on` scopes; (4) global shortcuts (§6.4). Ignore keys while `LAB.ui.isImeEnter(e)`. Never `preventDefault` F5/F11/F12/Ctrl+R/Ctrl+Shift+I.

**Terminal rule.** When the frontmost app is Terminal and the event has `e.ctrlKey && !e.metaKey`, the router SKIPS the Ctrl-as-Cmd mapping for every app and global shortcut, with two exceptions: Ctrl+Space (Spotlight) and the Terminal's own copy-with-selection case (Ctrl+C when text is selected). Otherwise Ctrl+W (delete word), Ctrl+H, Ctrl+M, Ctrl+N, Ctrl+Q, Ctrl+A and friends would close, hide or quit the Terminal window instead of editing the line. Real ⌘ (metaKey) still works. Browser-reserved keys (Ctrl/Cmd+W/T/N/Q, Ctrl+Tab) cannot be relied upon, and on Windows Chrome Ctrl+W/Ctrl+T/Ctrl+N belong to the browser and cannot be intercepted at all: every command that has such a shortcut also has a menu item and a Dock action, and the 「快速鍵」 tab says so (§6.4).

### 3.9 `LAB.menu` (js/menu.js) `[SKIN]`

```
LAB.menu.register(appId, fn)         // eval-time call; fn() → [{label, items:[Item]}] evaluated each time a menu opens (so enabled/checked are live)
Item = {label, shortcut?:'⌘N', action?(), enabled?=true|fn, checked?, separator?, submenu?:Item[]}
LAB.menu.contextMenu(x, y, items:Item[], {onClose?})    // x,y in stage coordinates; keeps the menu inside the stage; closes on Esc/click away/action; `role=menu` with `role=menuitem` children, focus moves into the menu and returns on close
LAB.menu.closeAll()
LAB.menu.refresh()                    // re-render menu bar titles for the frontmost app
```

### 3.10 `LAB.dnd` (js/dnd.js) `[PORTABLE]` — pointer-based drag and drop

Never use HTML5 `draggable`/`dataTransfer`. Everything lives in one document (no iframes).

```
LAB.dnd.source(el, getPayload, opts?) → disposeFn
   // el: the draggable element (Finder item, desktop icon, Code explorer row). getPayload(e) → Payload | null (null = not draggable now). It is called when the movement threshold is CROSSED (not at pointerdown), so the owner's selection is already up to date.
   // opts: { threshold=4, onPressSelect?(e), onClickSelect?(e) }
   //   onPressSelect: owner selects the pressed item at pointerdown ONLY when it is not already selected (so pressing an unselected item while others are selected drags that item alone);
   //   onClickSelect: owner's deselect-others logic for an already-selected item, called at pointerup when no drag happened (so multi-select drags work)
Payload = { kind:'fs', paths:[Path,…], from:'finder'|'desktop'|'code'|…, label:string, iconName:string }
LAB.dnd.target(el, spec) → disposeFn
   spec = { id: string,                              // e.g. 'desktop', 'finder:w3:folder:/Users/an/Desktop', 'dock:trash', 'terminal:w5', 'codex:w7'
            accept(payload, mods) → false | 'move'|'copy'|'link',     // PURE: runs on every pointermove, no side effects
            enter?(payload, mode), leave?(), over?(payload, mode, pt),
            drop(payload, ctx) }                      // ctx = {x, y, altKey, metaKey, shiftKey, mode}; all side effects live here
LAB.dnd.active() → Payload|null
LAB.dnd.cancel()
```
Engine rules (implementation recipe, follow exactly):
1. Sources get `draggable=false`, `user-select:none`, `-webkit-user-drag:none`, `touch-action:none`; `dragstart` is `preventDefault`ed.
2. `pointerdown` (button 0, `isPrimary`) records the start point, calls `onPressSelect` when given, and does NOT start a drag. It must NEVER `preventDefault` the pointerdown: that would suppress the compatibility `mousedown` which `wm` uses to focus and raise the window under the cursor. Attach `pointermove/pointerup/pointercancel/keydown(Esc)/blur/visibilitychange` listeners to `window` (not to the element: re-renders destroy elements); remove them on end.
3. After ≥ 4 px movement (stage px) call `getPayload(e)` (null cancels quietly), then create the ghost in `#lab-dnd`. `#lab-dnd` lives inside the transformed stage, so the ghost is `position:absolute` (NOT `fixed`: a transformed ancestor makes `fixed` relative to the stage, which drifts away from the pointer under the rail offset or scale < 1) and is placed with `transform: translate(x, y)` in STAGE coordinates from `LAB.stage.toStage(clientX, clientY)`; `pointer-events:none; z-index: var(--z-dnd)`; `will-change: transform` only while dragging. Translucent copy of the icon + label (opacity .7); several paths → stacked icons with a red count badge; set `body.lab-dragging` (cursor grabbing, no text selection). Emit `dnd:start`. Windows must not change focus because of the drag.
4. On each `pointermove` (rAF-throttled): FIRST, `if (e.buttons === 0)` treat it as a lost `pointerup` (the button was released outside the browser window, where no pointerup is delivered) and finish the drag exactly as rule 5 does, at the last known pointer position; then move the ghost; hit-test with `document.elementsFromPoint(clientX, clientY)` (the ghost is `pointer-events:none`). Walk the list top-down. Determine the topmost "zone" = first `.lab-win` ancestor, or `#lab-dock`, or `#lab-desktop`, or `#lab-menubar`. Only targets INSIDE that zone are considered (a window occludes everything below it). Inside the zone walk up from each element to the nearest ancestor registered with `LAB.dnd.target`; call `accept(payload, mods)`; the first target that accepts wins; otherwise try the next ancestor, then the next element in the list (still inside the zone). Toggle `enter/leave` on change. The ghost badge: `copy` → green `+` (circle `#34c759`, 2 px white ring, 16 px); `link` → small curved-arrow; `move` → none. Holding ⌥ (Alt) turns an accepted `move` into `copy` (target must still accept `'copy'`).
5. `pointerup`: RE-RESOLVE the target at the release coordinates (do not trust the last enter/leave: a re-render may have disposed that element mid-drag). If a target accepts → `drop(payload, ctx)` then emit `dnd:drop {payload, targetId, accepted:true, mode}`; else animate the ghost back to its origin (250 ms) and emit `dnd:cancel`. Esc, blur, visibility change, `pointercancel` all cancel. Ignore secondary pointers by `pointerId`.
6. Edge scroll: when within 24 px of a scrollable ancestor's edge, scroll it.
7. Click vs drag: if the threshold was never crossed nothing happens and normal click/dblclick handling in the owner proceeds. Owners do their deselect work in `onClickSelect` (pointerup, no drag), never at `pointerdown` of an already-selected item.
8. Re-rendering while dragging: Finder, Code explorer and the desktop pause their `fs:change` re-render while `LAB.dnd.active()` is non-null and flush ONCE after `dnd:drop`/`dnd:cancel`. Their lists are reconciled by KEY (`data-path`), reusing DOM nodes, and an element that is currently an inline rename editor is never re-rendered or replaced (otherwise a live edit would be destroyed by a 100 ms `fs:change` debounce). Drop targets disposed by a re-render are why rule 5 re-resolves.
9. Drop target ids and who registers them (all registered through `win.own` when window-scoped):
   - Finder window (FINDER): `finder:<winId>:view` (move/copy into the current folder; rejects dropping onto the same parent), `finder:<winId>:folder:<path>` for every folder item and `finder:<winId>:sidebar:<path>` / `finder:<winId>:pathbar:<path>` (move). Dropping a folder into itself or its descendant is rejected.
   - Desktop (CORE): `desktop` (move into `~/Desktop`) and `desktop:folder:<path>` for folder icons.
   - Dock (CORE): `dock:trash` (move to trash), `dock:downloads` (move into Downloads), `dock:app:<appId>` (`accept` = `def.canHandle(path)` for every path, returning `'link'`; `drop` calls `handleOpen(path, {via:'dock'})` for the first path).
   - Terminal (TERMINAL): `terminal:<winId>` over the whole window; accept → `'copy'` badge; drop types the escaped path(s) into the command line (§4.2.5).
   - Codex (CODEX): `codex:<winId>:sidebar` and `codex:<winId>:main`. Accept only when every path is a directory (sidebar) / a directory or file (main). Both return `'copy'` so the ghost shows the green `+` as in the videos, and the drop never changes the filesystem (the desktop icon stays; it is a reference, not a move). Highlight: sidebar gets an inset 3 px `#3b82f6` outline + 10% blue fill; main gets the same fill without the outline.
   - Code (EDITORS): `code:<winId>` (folder → open as explorer root; file → open it).
   The payload `paths` are canonical absolute paths.

### 3.11 `LAB.codex` intent API (js/codex.js) `[PORTABLE logic]`

```
LAB.codex.state() → readonly snapshot {projects:[{path,name,chatIds}], chats:[{id,title,projectPath|null,messages:[{role,text,steps?,files?:[Path]}],createdAt,draft?}], activeChatId}
LAB.codex.addProject(path, {trust=true, select=true}) → project     // programmatic (mission prepare); emits codex:project
LAB.codex.removeProject(path, {chats='remove'})                     // programmatic (mission prepare). chats:'remove' (default) also deletes that project's chats from the sidebar and from storage; chats:'keep' turns them into orphan chats (projectPath null) listed under Recents
LAB.codex.activeChat() → chat|null
LAB.codex.workingDir(chat) → Path       // chat.projectPath || '/Users/an/Documents'
LAB.codex.registerIntent(def, {priority=0})   // eval-time call; higher first; ties by registration order
   def = { id: string,
           test(text, ctx) → boolean,           // text normalised: NFKC, trimmed, lower-cased, spaces collapsed; ctx = {chat, project, cwd, rawText}
           run(ctx) → void|Promise }            // see below
   run ctx: { text, rawText, chat, project, cwd,
              read(rel) → string|null,           // reads cwd/rel; adds a step line 'Read rel'; emits fs:read by 'codex'; null if missing (and no step line)
              write(rel, content) → {created},    // creates parent dirs; step line 'Created rel' or 'Edited rel'; emits fs:change by 'codex'
              mkdir(rel), exists(rel), list(rel) → stat[],
              step(text),                          // extra grey step line
              say(text),                           // appends assistant text (markdown-lite: `code`, newlines; rendered with textContent/DOM nodes, never innerHTML)
              abs(rel) → Path }
LAB.codex.intents → registered list (debug)
LAB.codex.resetChats()                  // restores the seed chats and deletes every other chat (project chats included)
```
Ownership of a reply: the CHAT object owns the in-flight reply (its timers, steps, VFS side effects and the final `codex:reply` emit); the Codex window only subscribes to render it. Closing the window or selecting another chat mid-reply does not stop it: the files are still written and `codex:reply` is still emitted; reopening the chat shows the finished messages. A reload drops an unfinished reply. Every assistant message stores `files` (absolute paths) so `list_paths` still works after a reload.
Intent catalogue and exact behaviour: §4.4.5.

### 3.12 `LAB.missions` (js/missions.js engine + rail UI) — schema in §5

```
LAB.missions.register(mission)            // eval-time call; missions-week3.js calls this for each mission
LAB.missions.list() → mission[];  get(id)
LAB.missions.start(id) / reset(id) / complete(id)?(internal) / current() → mission|null
LAB.missions.progress(id) → {started, done, steps:{stepId:ms}, doneAt}
LAB.missions.setFreePlay(bool);  isFreePlay()
LAB.missions.freePlayTips = []            // strings set by missions-week3.js
LAB.missions.render()                     // rail UI refresh (engine calls it itself)
LAB.missions.progressCode() → string      // §5.4
LAB.missions.importProgressCode(str) → {ok, message, summary}   // §5.4
```

### 3.13 Finder / Terminal / Editors public hooks

```
LAB.finder.open({path, via='initial'}) → Win           // new window at path (or focus an existing window already at path when opts.reuse)
LAB.finder.reveal(path)                                  // open the parent folder and select the item
LAB.finder.windows() → [{winId, path}]
LAB.shell.run(line, session) → {out, status, cwdAfter, effects, name, args, cmds}   // synchronous and pure over session.vfs; §4.2.3
LAB.shell.newSession({cwd, tty, cols, vfs=LAB.vfs}) → session
LAB.quicklook.show(path)/hide()/toggle(path)             // EDITORS
LAB.textedit.openFile(path) → Win;  LAB.code.openFolder(path) → Win
```

---

## 4. Apps

### 4.0 Initial file system (js/seed.js)

Mtimes are fixed local dates of the fiction; "today" files created at runtime use the real clock. Format `YYYY-MM-DD HH:MM`. Sizes in bytes (binary files have `content:null, binary:true`).

```
/
├─ Applications/            (2026-09-01)  Codex.app, Code.app, 文字編輯.app, 終端機.app   [kind:'app' stub nodes, size 0]
└─ Users/
   └─ an/                   (2026-10-02 09:41)
      ├─ Desktop/           (2026-09-28 10:12)
      │   └─ Project/       (2026-09-28 10:12)
      │       ├─ data/      (2026-09-28 09:58)
      │       │   ├─ A.csv, B.csv, C.csv   (2026-09-28 09:58)  real class files (below)
      │       ├─ AGENTS.md  (2026-09-28 10:12)
      │       └─ 筆記.docx  (2026-09-25 15:40) binary, 18432 bytes
      ├─ Documents/         (2026-09-21 16:05)
      │   ├─ 期中報告.docx  (2026-09-21 16:05) binary, 24576 bytes
      │   └─ 履歷.pdf       (2026-09-12 11:30) binary, 120834 bytes
      ├─ Downloads/         (2026-10-02 09:30)
      │   ├─ syllabus.pdf   (2026-09-15 08:30) binary, 204311 bytes
      │   └─ week3.zip      (2026-10-02 09:30) kind:'zip', size 1301, zip entries below
      ├─ Library/           (empty dir; `hidden` for Finder, but `ls` lists it because it is not a dotfile, §3.5)
      ├─ Movies/ Music/ Pictures/ Public/   (empty dirs, 2026-09-01)
      ├─ .Trash/            (empty dir)
      ├─ .zsh_sessions/     (empty dir)
      └─ .CFUserTextEncoding  (file, content `0x0:2:0`, no newline, 7 bytes)
```
`Project/AGENTS.md` content (exact, trailing newline, 71 bytes):
```
# 專案規則
- 報告用繁體中文
- 輸出的檔案放在 output/
```
`week3.zip` entries (also the content of `Project/week3` after extraction), in this order: `week3/` (dir), `week3/README.md`, `week3/A.csv`, `week3/B.csv`, `week3/C.csv`. Stored on the node as `zip:[{name, type:'dir'|'file', content, mtime}]` (names relative to the archive root, a trailing `/` on dirs, §3.5); every entry's `mtime` is `2026-10-02 09:00`, and extraction (Terminal `unzip` or Finder) KEEPS those mtimes, so `ls -l` after unzipping shows `Oct  2 09:00`, not the time of the run. All files UTF-8, LF line endings, trailing newline.

`README.md` (361 bytes, exact):
```
# Week 3 終端機小練習素材

這份壓縮檔是「終端機介紹」小練習用的，裡面的成績都是假資料。

- A.csv、B.csv、C.csv：A、B、C 三個班的小考成績，每班 40 位學生
- 欄位：student_id（假學號）、score（0 到 100 分）

看得到這個檔案，代表你已經用 cd、ls、mv、unzip 把包裹拆開了。
```
CSV files: first line `student_id,score`, then 40 rows `A001,61` … (id = class letter + 3-digit number 001–040; letters `A`,`B`,`C` per file). Scores in order for rows 001–040:
- A: 61,86,64,75,76,90,74,100,76,100,84,81,52,67,80,68,62,60,83,91,85,51,78,91,51,82,75,73,92,68,70,100,87,95,73,74,78,67,80,78 (340 bytes)
- B: 87,72,64,71,76,78,66,82,76,66,80,74,74,73,76,80,90,73,56,68,84,72,80,69,70,57,64,85,74,71,75,68,73,82,70,98,57,83,80,81 (337 bytes)
- C: 100,80,86,100,82,72,65,74,60,84,79,68,60,71,71,72,66,82,92,66,71,68,82,72,72,80,60,66,69,57,71,61,75,100,91,74,96,75,87,63 (340 bytes)
`Project/data/*.csv` are copies of exactly these three files. (Verified against `weeks/week03/files/week3.zip` on 2026-10-04.)

State to restore for a clean start: `LAB.vfs.reset()`. Missions restore only the paths they need through `LAB.seed.restore(path, {overwrite})` / `api.ensureSeed` (§3.5, §5.1), so a student who renamed or deleted `Project`, `Project/data`, `AGENTS.md` or `week3.zip` can always get them back; the seed content is exactly the text of this section.

### 4.1 Finder — js/finder.js, css/finder.css (owner FINDER)

Registered as `finder`, dock, `canOpen(dir)=10`, `canHandle(dir)=true` (for a file: its parent folder). Every window-scoped `bus.on`, drop target and key handler is registered through `win.own` (§3.6). Window: `bar:'unified'`, default 860×520 (clamped), min 560×320, theme light. Multiple windows allowed. Cascade via `wm.spawnRect`.

Layout (top→bottom, left→right):
- Unified title/toolbar (52 px): lights; back/forward chevrons (disabled grey when no history; per-window history stack, `via:'back'|'forward'`); current folder title (icon + `vfs.displayName`); right side: view switcher (圖示 / 列表, segmented; ⌘1/⌘2), search field 「搜尋」 (filters current folder by substring while typing; Esc clears (ignored while an IME composition is open); no deep search).
- Sidebar (180 px, `--mac-sidebar`): section 「喜好項目」: AirDrop (inert, greyed), 最近項目 (virtual `recents:` = 30 most recently modified `!hidden` files under home excluding Library and .Trash, newest first, column 「位置」 shown instead of nothing; `recents:` is a virtual id, not an absolute path, so `LAB.vfs.same('recents:', x)` is false and no mission compares against it), 應用程式 (`/Applications`), 桌面, 文件, 下載項目, then home (`an`, house icon). Section 「位置」: Macintosh HD (`/`), 垃圾桶 (`~/.Trash`). Selected item = rounded translucent highlight. Sidebar items are drop targets (move).
- Main area, icon view: grid of 64 px icons with labels (≤2 lines, middle-ellipsis), cell ≈ 96×92. List view: columns 名稱 | 修改日期 | 大小 | 種類; header click sorts (chevron shows direction; sort state per window); zebra rows (24 px); folders have disclosure triangles that expand in place (→ right, ← left, ⌥→ not required); folder size `--`.
- Path bar (24 px, bottom): `Macintosh HD › 使用者 › an › 桌面 › Project` using display names + small folder icons; click a segment = navigate (`via:'pathbar'`); double-click not needed. Status bar above it: `4 個項目` or `已選擇 1 個項目（共 4 個）`.
- Date column uses `LAB.util.fmt.finderDate`; size column `LAB.util.fmt.size`. File and folder names are always shown in full with their extensions in v1 (§0.3). Kind strings: 檔案夾, ZIP 封存檔, Markdown 文件, 純文字文件, CSV 文件, PDF 文件, Microsoft Word 文件 (`.docx`), 應用程式, 文件 (other).
- Sorting default: name, ascending, case-insensitive and numeric-aware (`file2` before `file10`) — this deliberately differs from `ls`. Entries with `stat.hidden` (dotfiles and `Library`) are not shown (⇧⌘. toggles; they then appear greyed). Finder filters on `hidden`, never on `dot` (§3.5).

Interaction:
- Click selects (blue pill label when window active, grey when inactive); ⇧-click range (list/icon order); ⌘/Ctrl-click toggles; rubber-band in icon view; ⌘A select all; click on empty area deselects. Double-click or ⌘↓ opens: folder → navigate in the same window (`via:'open'`); file → `LAB.apps.openPath(path, {via:'finder'})` (that call emits `finder:open`; Finder never emits it itself); `.zip` double-click → Archive Utility: `vfs.extractFinder` (fs:change by `'finder'`), then select the new folder; app → launch. ⌘↑ goes up (`via:'up'`). Return = rename (inline editor, base name preselected excluding extension, Return commits, Esc cancels, both ignored while `LAB.ui.isImeEnter(e)`; changing extension asks an alert sheet 「您確定要將副檔名從「.txt」變更為「.md」嗎？」 buttons 使用 .md / 保留 .txt; name conflict → alert 「已經有一個名稱為「x」的項目存在於此位置。」 buttons 好). Space = Quick Look (`LAB.quicklook.toggle`), Esc closes it. ⌘⇧N new folder (`未命名檔案夾`, rename mode). ⌘D duplicate (`x 拷貝`). ⌘⌫ move to Trash. ⌘[ ⌘] back/forward. ⌘⇧G 前往檔案夾 sheet (text field accepts `~/Desktop`, absolute paths, Return navigates `via:'goto'`; invalid → shake + text 「找不到這個檔案夾」). ⌘⇧H home, ⌘⇧D desktop, ⌘⇧O documents, ⌘⌥L downloads, ⌘⇧A applications, ⌥⌘C copy path of selection (also context-menu 將「x」拷貝為路徑名稱 with ⌥ held, always shown here).
- Right-click on an item: 打開, 打開方式 ▸ (from `LAB.apps.openWith`; for folders includes Codex and Code, for `.md/.txt/.csv` textedit and code), separator, 移到垃圾桶, 取得資訊 (disabled), 重新命名, 壓縮「x」(disabled), 複製, 製作替身 (disabled), 快速查看「x」, separator, 拷貝「x」, 將「x」拷貝為路徑名稱, separator, 服務 ▸ 在檔案夾位置新增終端機視窗 (folders only; opens Terminal with `cwd` = that folder). Empty area: 新增檔案夾, 取得資訊 (disabled), 貼上項目 (enabled after 拷貝), 顯示檢視選項 (disabled). 拷貝/貼上 of files uses `LAB.clipboard.setPaths(paths, 'copy')` and `LAB.clipboard.paths` (§3.1.1); the path commands (⌥⌘C, 將「x」拷貝為路徑名稱) use `LAB.clipboard.setText`.
- Drag: items are `LAB.dnd.source` with payload `{kind:'fs', paths:<selection>, from:'finder'}` and `onPressSelect`/`onClickSelect` (§3.10: press selects an unselected item at once; deselecting the others waits for pointerup); drop rules per §3.10. Dropping into a folder with a name collision → alert sheet 「已經有一個名稱為「x」的項目存在於此位置。您要用正在移動的項目取代它嗎？」 buttons 保留兩者 / 停止 / 取代 (⌥ drag = copy).
- Live updates: listens to `fs:change`; re-renders affected open windows after a 100 ms debounce, new items fade in (150 ms). The re-render RECONCILES by `data-path` (existing DOM nodes are reused, not replaced), is paused while `LAB.dnd.active()` (one flush after `dnd:drop`/`dnd:cancel`), and never touches the row that is currently an inline rename editor. A folder that was deleted/moved while shown: the window navigates to the nearest existing parent.
- Emits `finder:navigate` (every location change incl. initial with `via:'initial'`, and when opened by `open .` with `via:'open'`), `finder:select`, `finder:view`. (`finder:open` belongs to `LAB.apps.openPath`, §3.3.)
- `handleOpen(path, {via})`: folder → if a Finder window already shows exactly that folder → focus it (emit `finder:navigate` with via `'open'` anyway); else new window at path. File → opens the parent folder window and selects the file.
- Menus (`LAB.menu.register('finder', …)`): 檔案 {新增 Finder 視窗 ⌘N, 新增檔案夾 ⇧⌘N, 打開 ⌘O, 關閉視窗 ⌘W, 取得資訊 (disabled), 重新命名, 複製 ⌘D, 快速查看 (Space), 移到垃圾桶 ⌘⌫}, 編輯 {拷貝 ⌘C, 貼上項目 ⌘V, 全選 ⌘A}, 顯示方式 {為圖示 ⌘1, 為列表 ⌘2, 為直欄 (disabled), 為圖庫 (disabled), 顯示路徑列 (checked, toggles), 顯示狀態列 (checked)}, 前往 {返回 ⌘[, 下一頁 ⌘], 上層檔案夾 ⌘↑, separator, 最近項目, 文件 ⇧⌘O, 桌面 ⇧⌘D, 下載項目 ⌥⌘L, an ⇧⌘H, 應用程式 ⇧⌘A, separator, 前往檔案夾⋯ ⇧⌘G}, 視窗 {最小化 ⌘M, 縮放, 將所有視窗移到最前 (disabled), + list of open windows}, 輔助說明 {關於這個練習}.
- Trash window: path `~/.Trash`, title 垃圾桶, toolbar shows 「清倒」 button (confirm sheet as in Dock).

### 4.2 Terminal — js/terminal.js, css/terminal.css (owner TERMINAL)

Registered as `terminal` (title 終端機, aliases `terminal`, `shell`, `zsh`), dock. `canHandle(path)` is always true. `handleOpen(path)` (Dock drop, `open -a 終端機 <dir>`) opens a NEW window whose `cwd` is that folder (for a file: its parent folder), same as Finder's 服務 ▸ 新增位於檔案夾位置的終端機視窗. Every window-scoped subscription and drop target goes through `win.own` (§3.6).

#### 4.2.1 Window
`bar:'plain'`, theme light (Terminal's own palette), default 80×24 characters, min 40×8. Title `<folder> — -zsh — <cols>×<rows>` where folder = last path component of cwd as typed (`~`/home → `an`, `/` → `/`); title updates on every `cd` and on resize. Content area: white `#fff`, text `#000`, padding 6 px, mono `--lab-font-mono`, font-size 13 px, line-height 1.25, selection `#b3d7ff`, block cursor grey `#7f7f7f` solid (hollow when the window is inactive). `data-lab="term-screen"`.

First line(s) on open: `Last login: <date> on ttysNNN` (§0.3) then the prompt. Tab/ttys: first window `ttys000`; every further window increments (persisted counter). The `Last login` date of window N>1 = open time of window N-1 (persisted in `term.lastLogin`).

**Cell grid and CJK width.** The screen is a character grid. The cell width `cw` is measured from a hidden span of ten `0` characters in the terminal font AFTER `document.fonts.load('13px "JetBrains Mono"')` has resolved (and on `document.fonts.ready`), and measured AGAIN on `document.fonts` `loadingdone`, on every font-size change and on every window resize (a measurement taken before the web font arrives is wrong); `cols = floor(contentWidth / cw)`, `rows = floor(contentHeight / lineHeight)`. In the fallback fonts a CJK glyph is about 1.67 columns wide, not 2, so every code point with `LAB.util.charWidth(cp) === 2` is rendered as `<span class="tm-w" style="display:inline-block;width:2ch">` (glyph centred in the two-column cell) and zero-width marks are attached to the previous cell. Wrapping, cursor and selection positions are computed in COLUMNS from `charWidth`, never from DOM text width. Consequently `ls` output containing `筆記.docx`, `練習`, `未命名檔案夾`, and the title `80×24` line up exactly.

Rendering: a scrollback array of text lines (plus one style flag for reverse-video `%`), plus the live prompt line (prompt text + editable buffer + cursor). DOM rows, wrap at `cols`, virtual scrollback capped at 2000 lines, auto-scroll to bottom on output and on typing. Mouse selection + ⌘C copy, double/triple click word/line select (native browser selection is fine; the screen div is `user-select:text`, everything else none).

**Input element.** A real `<textarea class="tm-input" data-lab="term-input" aria-label="終端機輸入">`, 1×1 px, transparent text and caret, but NOT `display:none` and NOT off-screen: it is absolutely positioned at the cursor cell (re-positioned after every render) with the same font-size and line-height as the screen, so the IME candidate window appears next to the cursor instead of at a page corner. It is focused whenever the Terminal window is key (re-focus on mousedown in the screen) and receives `keydown`, `input`, `paste`, `compositionstart/update/end`. IME: while composing, show the composition string inline underlined at the cursor; insert on `compositionend` (this deliberately reproduces "Chinese IME turns `cd` into 注音"). The Enter handler starts with `if (LAB.ui.isImeEnter(e)) return;` (§3.8): picking a zhuyin candidate with Enter must never run the line.

#### 4.2.2 Line editor and keys
Prompt expansion: `an@MacBook-Air <dir> % ` where dir = `~` when the logical cwd is EXACTLY `/Users/an` (case-sensitive string compare: after `cd /users/an` the cwd is `/users/an` and the prompt shows `an`, not `~`); `/` at root; otherwise the last path component of the logical cwd; then a trailing space.
Keys: ←/→, Home/Ctrl+A, End/Ctrl+E, ⌥←/⌥→ by word, Backspace (delete), Delete, Ctrl+K kill to end, Ctrl+U kill whole line when cursor at end else to start, Ctrl+W AND Alt+Backspace delete previous word (Alt+Backspace is the alternative for Windows Chrome, where Ctrl+W closes the browser tab and cannot be intercepted), ↑/↓ history (the unfinished line is kept), Enter runs, Ctrl+L clears screen (scrollback kept: just scroll), ⌘K clears everything (screen + scrollback, prompt at top), Ctrl+C prints `^C` on the current line then a new prompt (discards the typed line; also interrupts a running `sleep` and any `session.prompt`), Ctrl+D on an empty line runs the `exit` behaviour (or, while a `session.prompt` with `onEof` is active, calls `onEof`), Ctrl+D with text does nothing, Tab completion (below). Key repeat honoured.
Ctrl handling: per the Terminal rule of §3.8 the global router does not turn Ctrl into Cmd while Terminal is frontmost; the Terminal itself handles its Ctrl keys, plus the Windows-keyboard conveniences Ctrl+V (paste) and Ctrl+C (copy when a text selection exists, otherwise `^C`).
Paste: ⌘V/Ctrl+V → the native `paste` event, read through `LAB.clipboard.forPaste(e)` (§3.1.1) so a path copied inside the lab pastes. Multi-line text is inserted with newlines replaced by spaces and is NOT auto-run (deliberate low-fidelity decision: a real zsh would run each line). ⌘C copies the selection.

Tab completion (stock macOS zsh, case-sensitive): completes command names (from the supported list) when completing the first word, otherwise file names relative to the cwd (or typed directory prefix). Single match: completes and appends a space for files or `/` for directories (no space after `/`); spaces in names are backslash-escaped. Several matches: first Tab inserts the longest common prefix; if nothing to add (or on the next Tab) print the candidates in `ls`-style columns under the line and re-show the prompt with the buffer; further Tabs cycle. `cd` + Tab completes directories only (deliberate low-fidelity decision: kinder to beginners than stock zsh).

Other deliberate low-fidelity decisions (do not "fix"): `man x` prints `No manual entry for x`; `vi`/`nano` print nothing and return; `cd -` with no previous directory is a silent no-op; no job control (`&`, `fg`, `bg`); no history expansion.

#### 4.2.3 Shell core (`LAB.shell`, pure over `session.vfs`)
```
LAB.shell.newSession({cwd='/Users/an', tty, cols=80, vfs=LAB.vfs}) → session   // {cwd, oldpwd:null, env:{HOME,USER,SHELL,PWD,HOSTNAME}, status:0, history:[], cols, vfs, prompt:null, pending:null, alive:true, id}
LAB.shell.run(line, session) → { out:string, status:number, cwdAfter:Path, effects:[…], name, args, cmds }   // SYNCHRONOUS; same shape as the term:run payload minus winId/line (§3.3)
LAB.shell.complete(buffer, cursor, session) → {replacement, candidates:[…]}
LAB.shell.commands → { name: fn(args, ctx) → {out?, status?, effects?} }   // registry; later weeks add commands
```
`out` contains stdout and stderr interleaved (same colour). zsh `PROMPT_EOL_MARK`: if `out` is non-empty and does not end with `\n`, the renderer prints a reverse-video `%` then a line break before the next prompt. The Terminal emits `term:run` and `term:cwd` after each non-empty line; `LAB.shell.run` itself emits nothing (so it can be unit-tested against a scratch VFS made with `LAB.vfs.create(json)`).

**State across lines and time.** `run` is synchronous but a command can ask the renderer to keep the session open:
- `effect {type:'sleep', ms}` (the `sleep` command; cap 10 s): the RENDERER owns the timer; input is blocked until it ends; Ctrl+C cancels it (prints `^C`, that command's status 130). The line's `term:run` is emitted when the sleep ends or is cancelled.
- `effect {type:'continue', ps2}`: the source is unfinished (open quote, trailing backslash). `run` keeps the partial source in `session.pending` and returns no output; the renderer shows `ps2` (`dquote> `, `quote> ` or `> `) and the next `run(line)` appends the line (joined with `\n`) and re-tokenises; when the source is complete it executes. Ctrl+C clears `pending`. `term:run.line` is the whole joined source.
- `session.prompt = {text, onLine(line) → {out, status, effects}, onEof?() → {out, status, effects}}`: set by a command that needs more input (the `unzip` overwrite question; `cat`/`wc`/`head`/`tail` with no file operand and no pipe, where `text` is `''`). While `session.prompt` is set, `run(line)` routes the line to `onLine` and returns its result; `onLine` may set `session.prompt` again (re-ask) or `null` (done). The renderer shows `text` as the prompt, calls `onEof` on Ctrl+D, and clears it on Ctrl+C. The command's `term:run` is emitted once the whole exchange has finished, with the accumulated `out`. Effect `{type:'prompt', text}` is informational for the renderer.
- Other effects: `{type:'open', …}`, `{type:'clear'}`, `{type:'exit'}`.

**Lexer and parser.** A real tokenizer runs over the whole source BEFORE any splitting and produces `{word, parts, quoted}` and `{op}` items, so quoting is respected everywhere (`echo "a;b"` prints `a;b`). Operators recognised: `;  &&  ||  |  >  >>`; also `<`, `&`, `;;` only to give a message. Supported: `;`; `&&` (right side skipped when the left status ≠ 0); `||` (right side skipped when the left status is 0); `|` (the right side may be `wc`, `head`, `tail`, `cat`; other commands simply ignore their input); `>` and `>>` to a file; single quotes literal; double quotes expand `$VAR` and `$?` (not `~`); backslash escapes the next character (`My\ Folder` works); a backslash at the very end of a line continues on the next line (`> `); `~` expands at the start of a word; `$HOME $PWD $USER $SHELL $?` expand in any word; globs `*`, `?`, `[…]` expand against the directory part of the pattern (no match → `zsh: no matches found: <pattern>`, status 1; quoted patterns are literal). `#` is an ORDINARY character (macOS zsh has `interactive_comments` off: `echo hi # x` prints `hi # x`; a line that starts with `#` gives `zsh: command not found: #`). An unclosed quote shows the continuation prompt `dquote> ` / `quote> ` until closed; Ctrl+C aborts. Words are separated by ASCII whitespace only: a full-width space (U+3000) stays inside the word, so `cd　Desktop` fails with `zsh: command not found: cd　Desktop` (the real trap taught in the video).
Defined messages for everything else (nothing is executed, status 1, so students are never left with silence): `$(…)`, backticks, `<`, `&`, `{a,b}` brace lists, `2>` and `&>`, and history expansion at the start of a word (`!!`, `!ls`, `!3`) print `（練習版還沒有做這種寫法：<token>）`; a malformed operator (a line that starts with `;` or `|`, `;;`, `> ` without a file name, a trailing `|`) prints ``zsh: parse error near `<op>'`` (or ``near `\n'`` at end of line).

**Command lookup, three tiers.** (1) Supported commands (§4.2.4). (2) Commands that exist on a real Mac but are NOT simulated: `grep egrep find chmod chown ln diff sort uniq cut file du df env export alias unalias ps kill killall curl ssh scp tar zip gzip less more top sed awk tee xargs say ping source set type test` print `<name>: 這個指令真的 Mac 上有，但練習版還沒做`, status 1 (so the lab never claims a real command does not exist). (3) Only things a fresh Mac really lacks, or the special cases, give `zsh: command not found: <name>` (status 127): `python3`, `python`, `node`, `npm`, `brew`, `codex`, `code`, `pip`, `tree`, `wget`, and any unknown word. `git` prints `xcode-select: note: No developer tools were found, requesting install.`; `sudo <anything>` prints `sudo: this practice Mac does not allow sudo` (lab-only message, status 1).
Command-word edge cases: a word containing `/` that does not exist → `zsh: no such file or directory: <word>`; a word containing `/` that is a directory or a non-executable file (`/Users`, `./Project`, `Desktop/`, `./A.csv`) → `zsh: permission denied: <word>`; a BARE name without `/` (`Desktop`, `A.csv`) that is not a command → `zsh: command not found: <word>`.
Flags: each supported command implements only the flags listed in §4.2.4. Any other letter that appears in the REAL command's usage line is accepted and ignored; a letter the real command does not have prints `<cmd>: illegal option -- <letter>` and the real usage line, status 1. `cat`, `wc`, `head`, `tail` with no file operand and no pipe enter stdin mode (a `session.prompt` with `text:''`): `cat` echoes each line, `wc`/`head`/`tail` collect lines and print at Ctrl+D; Ctrl+C leaves with `^C`.

#### 4.2.4 Commands and EXACT outputs
Paths in messages are printed as typed by the student unless noted. "silent" = prints nothing, status 0. Status shown only when non-zero.

| Command | Behaviour / output |
|---|---|
| `pwd` | Logical cwd, e.g. `/Users/an/Desktop` |
| `cd` / `cd ~` | silent; home. `cd -` → prints the old directory abbreviated with `~` (e.g. `~/Desktop`); with no old dir: silent no-op (low-fidelity decision). `cd ..` at `/` stays. Errors: `cd: no such file or directory: X` · `cd: not a directory: X` · `cd: permission denied: X` · two args that don't match: `cd: string not in pwd: <first>` · three or more args: `cd: too many arguments`. `cd "My Folder"`/`cd My\ Folder` work. Case-insensitive lookup; cwd keeps typed case. |
| `ls [-aAlh1FrtRdS] [paths…]` | see ls rules below |
| `mkdir [-pv] [-m mode] dir…` | silent (`-v` prints the created path, `-m` accepted and ignored). Errors: `mkdir: x: File exists` · `mkdir: a/b: No such file or directory` · no operand: `usage: mkdir [-pv] [-m mode] directory ...` |
| `touch file…` | create empty file or update mtime; silent; `touch: nodir/x: No such file or directory`; no operand: `usage: touch [-A [-][[hh]mm]SS] [-achm] [-r file] [-t [[CC]YY]MMDDhhmm[.SS]] file ...` |
| `cat [-n] file…` | contents exactly; missing `cat: x: No such file or directory`; dir `cat: x: Is a directory`; (no trailing newline → `%` mark); no operand → stdin mode |
| `echo [-n] args…` | joined by single spaces + newline; zsh interprets `\n` etc. by default; `$HOME`→`/Users/an`, `~`→`/Users/an` |
| `clear` | clears screen (effect `clear`) |
| `cp [-rRv] src… dst` | silent (`-v` prints `a -> b`); overwrites files silently; dir without -r: `cp: d is a directory (not copied).`; missing `cp: a: No such file or directory`; same file `cp: a and a are identical (not copied).`; usage lines on no operand: `usage: cp [-R [-H | -L | -P]] [-fi | -n] [-aclpSsvXx] source_file target_file` ⏎ `       cp [-R [-H | -L | -P]] [-fi | -n] [-aclpSsvXx] source_file ... target_directory` |
| `mv [-v] src… dst` | silent. Into existing dir keeps name; to a non-existing name silently renames (the "typo trap": `mv week3.zip ~/Desktop/Projet` renames the zip, no error); overwrites existing file silently. Errors: `mv: rename a to b: No such file or directory` · `mv: a and a are identical` · one operand: `usage: mv [-f | -i | -n] [-hv] source target` ⏎ `       mv [-f | -i | -n] [-v] source ... directory` |
| `rm [-rRfidv] x…` | silent, permanent (`-i` accepted, no prompt in v1; `-v` prints the removed path). `rm: x: No such file or directory` (suppressed by -f) · directory without -r: `rm: x: is a directory` · `rm -r`/`-rf` ok · no operand: `usage: rm [-f | -i] [-dIPRrvWx] file ...` ⏎ `       unlink [--] file`. `rm` on `.` or `..` always prints `rm: "." and ".." may not be removed`. Protection (checked on the arguments AFTER glob expansion, so `rm -rf ~/*` is covered): the paths `/`, `/Users`, `/Applications`, the home folder and its eight standard folders (`Desktop Documents Downloads Library Movies Music Pictures Public`) are never removed: `/` prints `rm: "/" may not be removed`, the others print `rm: refusing to remove "<arg>" (practice Mac protects this folder)` (lab-only text); other arguments of the same line are still processed. |
| `rmdir d` | silent; `rmdir: d: Directory not empty` · `rmdir: nodir: No such file or directory` · `rmdir: file: Not a directory` |
| `open [-a App] [-R] target` | no output; effects: `open .`/folder → Finder window at that folder (reuse a window already showing it, else new; `finder:navigate via:'open'`); file → default app (through `LAB.apps.openPath(path,{via:'terminal'})`); `open -a Codex <dir>` / `open -a Code <dir>` → that app's `handleOpen`; `open -R file` → `LAB.finder.reveal`. `open nofile` → `The file /Users/an/nofile does not exist.` (absolute path of what was typed, resolved against cwd). `open -a Nope` → `Unable to find application named 'Nope'`. No args: prints `Usage: open [-e] [-t] [-f] [-W] [-R] [-n] [-g] [-h] [-s <partial SDK name>][-b <bundle identifier>] [-a <application>] [-u URL] [--args arguments] [filenames] [--args arguments]`. |
| `unzip [-oq] [-d dir] [-l] zip` | extracts into the CURRENT directory (not next to the zip), or into `dir` (created) with `-d`. Entries keep their archive mtimes. Output for `week3.zip` (exact, note the spaces): `Archive:  week3.zip` ⏎ `   creating: week3/` ⏎ `  inflating: week3/README.md` ⏎ `  inflating: week3/A.csv` ⏎ `  inflating: week3/B.csv` ⏎ `  inflating: week3/C.csv`. The `.zip` stays. `-q` prints nothing; `-o` overwrites without asking; `-l` lists without extracting: `Archive:  week3.zip` ⏎ `  Length      Date    Time    Name` ⏎ `---------  ---------- -----   ----` ⏎ one row per entry `%9d  10-02-2026 09:00   <name>` ⏎ `---------                     -------` ⏎ `%9d                     5 files` (total of the sizes). Missing: `unzip:  cannot find or open wek3.zip, wek3.zip.zip or wek3.zip.ZIP.` (status 9). Not a zip: `unzip:  cannot find zipfile directory in one of x or x.zip, and cannot find x.ZIP, period.` If `week3/` entries already exist: prints `Archive:  week3.zip` then `replace week3/README.md? [y]es, [n]o, [A]ll, [N]one, [r]ename: ` and waits for a line (`session.prompt`): `A`→overwrite all, `N`→skip all, `y`/`n` per file, anything else re-asks. |
| `history` | `    1  ls` (event number right-aligned to width 5, two spaces, command), whole persisted history this session list |
| `whoami` | `an` |
| `hostname` | `MacBook-Air.local` |
| `date` | `Sun Oct  4 10:12:03 CST 2026` form (English), from `LAB.clock` |
| `uname` | `Darwin` |
| `which cmd` | builtins (`cd pwd echo history exit which`) → `<cmd>: shell built-in command`; commands in `/bin` (`ls cat cp mv rm mkdir rmdir sleep date hostname`) → `/bin/<cmd>`; commands in `/usr/bin` (`touch open unzip wc head tail clear whoami uname man vi nano`) → `/usr/bin/<cmd>`; tier-2 names print their real-Mac path or `<cmd>: 這個指令真的 Mac 上有，但練習版還沒做`; unknown → `<cmd> not found` |
| `wc [-lwc] [file]` | `       3       3      12 file` (three right-aligned width-8 numbers: lines, words, bytes, then name); stdin form without name |
| `head`/`tail [-n N] file` | first/last N (default 10) lines (also `-N`) |
| `exit` | prints `Saving session...` ⏎ `...copying shared history...` ⏎ `...saving history...truncating history files...` ⏎ `...completed.` ⏎ ⏎ `[Process completed]`, the window closes about 0.7 s later (Terminal's default for a clean exit, §14), and the session is dead until the window closes (typing does nothing) |
| `sleep n` | effect `sleep` (n seconds, cap 10), Ctrl+C interrupts with `^C`; `sleep abc` → `usage: sleep seconds` |
| `man x`, `vi`, `nano` | not implemented: `man` prints `No manual entry for x`; `vi/nano` print nothing and return (so students aren't trapped) |

Optional stretch (not required for v1, cheap if time allows): `grep [-inc] pattern file…` and `find . -name 'pattern'` with literal/glob matching; until then they are tier-2 commands.

`ls` rules (exact):
- The listing is `vfs.list(dir).filter(s => !s.dot)` (dotfiles hidden, but `Library` is NOT a dotfile, so the home listing shows it, exactly like the supplement transcript). Finder's own `hidden` flag is irrelevant to `ls`.
- Default (stdout is the terminal): multi-column, column-major (down, then across), no colours, no type suffixes. Display width of a name = `LAB.util.displayWidth` (CJK = 2). `colw = (maxWidth + 8) & ~7` (round up to a multiple of 8 strictly greater than the longest name); `numcols = max(1, floor(termCols / colw))`; `numrows = ceil(n / numcols)`; `numcols = ceil(n / numrows)`; entry `i` goes to column `floor(i / numrows)`, row `i % numrows`; each cell padded with spaces to `colw` except the last column of a row (no trailing padding). Empty directory prints nothing.
- Sorting: UTF-16 code-unit order (uppercase before lowercase, digits before letters, dotfiles first when shown, CJK by code point). `-r` reverses, `-t` sorts by mtime newest first, `-S` by size largest first.
- `ls -1` or when piped: one name per line. `-a`: adds `.` and `..` and dotfiles; `-A`: dotfiles without `.`/`..`; `-F` appends `/` to dirs; `-h` with `-l`; `-d` lists the directory itself instead of its contents; `-R` lists recursively with `dir:` headers (blank line between).
- `-l`: first line `total N` (N = sum over entries of `ceil(size/4096) * 8`, folders 0: APFS allocates 4 KiB blocks, so a 340-byte CSV counts 8), then per entry `drwxr-xr-x  N an  staff  SIZE Oct  4 10:12 name` with perms `drwxr-xr-x` (dirs) / `-rw-r--r--` (files), link count right-aligned (dirs: 2 + number of subfolders, files 1), owner `an`, group `staff` (padded to the widest), size right-aligned (folders: 64 + 32 × entries; files: byte size), date `LAB.util.fmt.lsDate`. No `@` marker in v1 (two spaces separate the permission string from the link count, as on a real Mac for files without extended attributes).
- `ls dir` lists that directory; `ls file` prints the name; several dir args print `dir:` headers separated by a blank line. Errors: `ls: Projet: No such file or directory` (status 1). Globs expand before `ls` sees them. Illegal letter: `ls: illegal option -- z` ⏎ `usage: ls [-@ABCFGHILOPRSTUWXabcdefghiklmnopqrstuvwxy1%,] [--color=when] [-D format] [file ...]`.
- Home listing at start (verified against the supplement transcript): `Desktop         Downloads       Movies          Pictures` ⏎ `Documents       Library         Music           Public`.

Transcript that MUST be reproduced byte for byte (Terminal supplement practice; each line is what the user types after the prompt):
```
an@MacBook-Air ~ % ls
Desktop         Downloads       Movies          Pictures
Documents       Library         Music           Public
an@MacBook-Air ~ % cd Desktop
an@MacBook-Air Desktop % ls
Project
an@MacBook-Air Desktop % cd Project
an@MacBook-Air Project % ls
an@MacBook-Air Project % cd ..
an@MacBook-Air Desktop % cd ~
an@MacBook-Air ~ % cd Downloads
an@MacBook-Air Downloads % ls
syllabus.pdf    week3.zip
an@MacBook-Air Downloads % mv week3.zip ~/Desktop/Project
an@MacBook-Air Downloads % ls
syllabus.pdf
an@MacBook-Air Downloads % cd ~/Desktop/Project
an@MacBook-Air Project % ls
week3.zip
an@MacBook-Air Project % unzip week3.zip
Archive:  week3.zip
   creating: week3/
  inflating: week3/README.md
  inflating: week3/A.csv
  inflating: week3/B.csv
  inflating: week3/C.csv
an@MacBook-Air Project % ls
week3           week3.zip
an@MacBook-Air Project % mv week3.zip ..
an@MacBook-Air Project % ls
week3
an@MacBook-Air Project % cd ..
an@MacBook-Air Desktop % ls
Project         week3.zip
```
NOTE: this transcript assumes the supplement's EMPTY Project folder. In the lab, Project is not empty at start (§4.0), so `ls` in Project shows `AGENTS.md  data  筆記.docx` (UTF-16 order: `AGENTS.md`, `data`, `筆記.docx`, laid out with the rules above). The terminal builder verifies the transcript with a unit test that builds a scratch VFS with `LAB.vfs.create(json)` (seed with `Project` emptied) and runs it through `LAB.shell.newSession({vfs})`, so the singleton `LAB.vfs` is never touched.

#### 4.2.5 Drag and drop into Terminal
`LAB.dnd.target` id `terminal:<winId>` over the whole window. Accept any payload → `'copy'`. Drop: for each path insert at the cursor the shell-escaped absolute path, separated by single spaces, followed by one trailing space; the text is typed (not run). Escape = backslash before every character that is not in `[A-Za-z0-9_./~+@:,%=-]` and not a CJK character (CJK is NOT escaped, like macOS). Example: `/Users/an/Desktop/Project ` . Emit `term:drop {winId, paths, text}`. The window gets focus. Also `⌘V` of a path copied with 「拷貝為路徑名稱」 types it the same way (via `LAB.clipboard.forPaste`).

#### 4.2.6 Menus and window behaviour
Menus: 殼層 {新增視窗 ⌘N, 新增分頁 (disabled), 關閉視窗 ⌘W}, 編輯 {拷貝 ⌘C, 貼上 ⌘V, 全選 ⌘A, 清除至開頭 ⌘K}, 顯示方式 {放大 ⌘+, 縮小 ⌘− (font 11–20 px; both trigger a re-measure of `cw`)}, 視窗 {最小化 ⌘M, 縮放, window list}, 輔助說明 {關於這個練習}. History persists in `term.history` (max 200). Closing the window discards the session (nothing else persists). A new window opened from Finder's 服務 menu or `open -a 終端機 <dir>` starts in that folder.

### 4.3 TextEdit, Quick Look, Code, About — js/textedit.js, js/code.js, js/about.js, css/editors.css (owner EDITORS)

#### 4.3.1 文字編輯 (`textedit`)
Dock icon. `canOpen`: `.md .txt .csv .json .log` = 20, any text file = 10. Window `bar:'plain'`, 560×420, light, plain white `<textarea class="te-text" data-lab="te-text">` in mono-ish UI font 14 px (not rendered markdown), spell-check off. Title = file name (`README.md`); when dirty: `README.md — 已編輯`. ⌘S/Ctrl+S saves via `LAB.vfs.writeFile(path, text, {by:'editor'})` and emits `editor:save`. 檔案 menu: 新增 ⌘N (Untitled; ⌘S then shows `LAB.ui.prompt` 「儲存為」 with name field, saved in `~/Desktop`), 打開⋯ (disabled), 儲存 ⌘S, 關閉 ⌘W; 編輯: 還原 ⌘Z (use native), 拷貝, 貼上, 全選; 格式/顯示方式 items present but disabled except 視窗 menu. Closing a dirty window asks the alert 「要儲存對「x」所做的更動嗎？」 buttons 儲存 (default) / 取消 / 不要儲存. If the file changes on disk (fs:change from another app) and the window is not dirty it reloads silently; if dirty it keeps the text. A file that no longer exists shows a title suffix — 已被刪除. Opening a path emits `editor:open {path, appId:'textedit', winId}` every time (if a window for that path exists, focus it and still emit). `textedit.openFile(path)`. CSV files are shown as plain text. The window keeps `win.state.path` and `win.state.dirty` current (§3.6) so a mission can tell which file a window shows (a student who simply looks at the already-open window again is credited through `win:focus` + `state.path`, §5.3 M7 step 3). A save above the 200 KB file cap (or past the total cap, §3.5) fails with the sheet 「這個檔案太大了：練習版每個檔案最多 200 KB。」 and writes nothing. The 「儲存為」 prompt and every Enter/Esc use `LAB.ui.isImeEnter`.

#### 4.3.2 Quick Look (`quicklook`, not in Dock)
`LAB.quicklook.show(path)` opens a light window-like panel over the stage (centred 520×380, title = file name, close ×, Esc/Space closes): text/csv/md → the text in mono 12 px (read-only, first 200 lines); folder → big folder icon + name + 「N 個項目」; other binary (docx, pdf, zip, app) → large icon, name, and the line 「練習版不支援預覽這種檔案」. It is also the default app for binary files (`openPath` of a docx/pdf opens it as a regular window of app `quicklook` with title = file name, and emits `editor:open {appId:'quicklook'}`). The Space-bar overlay form emits no editor event.

#### 4.3.3 Code (`code`, title `Code`, aliases `vscode`, `code`)
Dock icon. `canOpen`: dir 20, text file 15 (below TextEdit's 20, so 打開方式 lists TextEdit first for `.md`); `canHandle`: dir or text file. `win.state.path` = the active tab's path ('' when none). Window `bar:'plain'` dark (`#1f1f1f` editor, `#181818` side/activity/status, borders `#2b2b2b`, accent `#0078d4`, text `#cccccc`), 960×620, min 640×420, Dark-Modern-like. Layout: activity bar (48 px; icons: explorer (active), search, git, run, extensions — only explorer works; others show the toast-less no-op), explorer sidebar (240 px, header `EXPLORER`, folder name in caps `PROJECT` with a tree), tab strip (36 px, tab = file icon + name, `×` close, dirty dot), editor with line numbers (gutter `#6e7681`), status bar (22 px, `#181818`, left blue remote box `><`, right `Ln 3, Col 1   UTF-8   LF   Markdown`).
- Opening a folder: `LAB.code.openFolder(path)`, `handleOpen(dir)`, drop target `code:<winId>` (folder → root), 打開方式 ▸ Code, Terminal `open -a Code .`. Emits `code:folder`. With no folder the explorer shows the empty state: `You have not yet opened a folder.` and a button-looking line `Open Folder` which says (toast) 「請把資料夾拖進這個視窗，或在 Finder 對資料夾按右鍵 › 打開方式 › Code」.
- Tree: folders first then files, each group in case-insensitive name order; row 22 px; click on file opens it in a tab (single click = open and activate; no preview mode); click on folder toggles; the tree watches `fs:change` (100 ms debounce; paused while `LAB.dnd.active()`, reconciled by `data-path`, §3.10 rule 8) and refreshes live (this is the "four windows see the same folder" effect: new files appear within ~0.3 s). Tree rows are `LAB.dnd.source`s (payload path) so students can drag from Code to Terminal.
- Editor: a `<textarea>` with a line-number gutter (monospace 13 px). Editable (plain text, no highlighting except markdown heading lines `#` coloured `#569cd6` via an overlay is NOT required in v1). ⌘S/Ctrl+S saves (`by:'editor'`, event `editor:save`); dirty dot on the tab; external changes reload when not dirty. Binary/unsupported files show, centred, English text `The file is not displayed in the text editor because it is either binary or uses an unsupported text encoding.` (docx, pdf, zip). Opening a file emits `editor:open {path, appId:'code'}` every time.
- Menus (Chinese): 檔案 {新增文字檔案 (disabled), 打開資料夾⋯ (toast as above), 儲存 ⌘S, 關閉編輯器 ⌘W}, 編輯 {復原, 剪下, 拷貝, 貼上, 全選}, 檢視 {探索 (toggle sidebar)}, 前往, 執行, 視窗, 說明 (all others disabled).

#### 4.3.4 關於這個練習 (`about`)
Not in Dock; opened from the 「練習」 menu, Spotlight (`about`) and the Help menus. Window 520×480, light, four tabs (editorial text, no icons): 「關於」 (what this is; 「這是練習用的模擬環境，不是真的 Mac，也不是真的 AI。」; one line that every visit is a fresh computer (§18); version `v1`; the trademark sentence of §0.2; `Copyright © 2026 JUNHAO CHEN・程式碼 MIT・內容 CC BY-NC-SA 4.0`), 「快速鍵」 (the table in §6.4), 「終端機指令」 (the command list from §4.2.4 with one-line zh descriptions), 「進度」 (the progress code of §5.4 in a read-only text box with a 「複製」 link; the line 「要給老師看這次完成了哪些任務，複製這串進度代碼。」; a text field with a 「匯入」 button that calls `LAB.missions.importProgressCode` and shows its summary, introduced by 「如果你有之前複製的進度代碼，可以貼在這裡看內容（只在這次有效，重新整理就會消失）：」), plus a text button 「重設全部」 (confirm sheet 「要重設全部嗎？」 / 「這會清除你在這個練習裡建立的檔案、對話和任務進度，無法復原。」 buttons 重設 (danger) / 取消 → `LAB.store.reset('all')`). No storage statement and no shared-computer line: nothing is stored (§18.1).

### 4.4 Codex — js/codex.js, css/codex.css (owner CODEX)

Registered `codex` (title `Codex`, aliases `codex`, `chatgpt`), dock, `canOpen(dir)=20`, `canHandle(path)` = directory (pure), `handleOpen(dir, {via})` = the project flow (§4.4.2); files → insert `@name` in the composer. The window root carries `lang="en"` (§0.1 item 7). Window: `bar:'hidden'` (lights overlaid at top-left over the sidebar, drag strip 40 px), theme dark, default `min(900, spawnArea.w) × min(620, spawnArea.h)`, min 720×480. The whole UI language is English.

Palette (variables at top of codex.css): app bg `#1f1f1f`, sidebar bg `#181818` + 1 px `#262626` right border, selected row `#2c2c2c`, text `#e2e2e2`, muted `#8a8a8a`, disabled `#6f6f6f`, icons `#bdbdbd`, unread dot `#3b82f6`, user bubble `#303030` (radius 14), inline code bg `#2f2f2f` (radius 4), project chip bg `#2a2a2a` (radius 7, 24 px high, 13 px text), composer bg `#2a2a2a` border 1 px `#3a3a3a` radius 16 placeholder `#8a8a8a` meta 11–12 px `#a0a0a0`, modal bg `#2a2a2a` radius 16 title `#f2f2f2` path `#bdbdbd` mono body `#d0d0d0`, primary button bg `#f2f2f2` text `#111` (pill, radius 15), secondary 1 px `#4a4a4a` border text `#e6e6e6`.

#### 4.4.1 Layout
- Sidebar (240 px): row 1 `New chat` (pencil icon, `data-lab="cx-new-chat"`). 16 px gap. Projects block: for each project a row = folder icon + project name (`data-lab="cx-project" data-path`), with `+` (new chat in project) and a chevron appearing on hover; under it either grey `No chats` (when the project has no chats) or its chats as indented rows. Section label `Recents` (11 px, `#8a8a8a`) then the orphan chats (no project), newest first. Selected chat row `#2c2c2c`. Sidebar is the primary drop zone (§3.10).
- Main: header row (only when a chat has a title): small folder icon (only for project chats) + title (15 px bold). Empty state: logo (`app-codex` glyph, 34 px) above `What should we work on in <u>Project</u>?` (18 px; project name has a dotted underline `#8a8a8a`, offset 4) for a project chat, or `What should we work on?` for an orphan chat. Conversation: user bubble right-aligned; assistant block left-aligned: step lines (grey 13 px, check icon, e.g. `Read AGENTS.md`, `Created output/report.md`, `Edited AGENTS.md`), reply text (14.5 px, line-height 1.6, inline code in mono pill bg, paths in mono), a fold line `Worked for 3s ›` (static). Messages area scrolls; auto-scroll to bottom while streaming.
- Project chip row just above the composer ONLY for project chats: chip 1 = folder icon + `Project` (bg `#2a2a2a`), chip 2 = laptop icon + `This computer` (plain, no bg). Orphan chats have no chip row (this difference is the whole teaching point). `data-lab="cx-chips"`.
- Composer: auto-growing textarea, placeholder `Do anything` (`data-lab="cx-composer"`), bottom-left `+`, bottom-right `GPT-6.1 Sol  High` and a round send button (`send` icon) that appears when the textarea is non-empty. Enter sends, Shift+Enter newline, never send while `LAB.ui.isImeEnter(e)` (the student types Chinese here). Disabled while a reply is running (placeholder stays).

#### 4.4.2 Folder drop → Trust modal → project (exact flow)
1. A directory path arrives (drag onto sidebar/main, Dock icon, Finder 打開方式 ▸ Codex, `open -a Codex <dir>`). If it is already a project → select it (draft chat in it), emit `codex:select-project`; no modal. Otherwise emit `codex:trust-prompt {path}` and show the modal centred over the main area (backdrop dims only the main area; sidebar stays visible; modal width 440).
2. Modal (`role=alertdialog aria-modal=true`, focus trapped, focus returns to the previous element on close) (verbatim): small ✕ top-right (= Cancel). Title `Trust this folder?`. Path line (mono) = the real path, e.g. `/Users/an/Desktop/Project`. Body `ChatGPT can read, edit, and execute files here. Folder settings can also run code automatically, even without a model request. Continue only if you trust these files.` Buttons: `Trust folder` (primary, default, focused; Enter) and `Cancel` (Esc). Shadow `0 14px 40px rgba(0,0,0,.55)` + inset 1 px `rgba(255,255,255,.06)`.
3. Trust folder → close modal, emit `codex:trust {path}`, add the project (name = basename), emit `codex:project`, select it with a fresh draft project chat (main shows `What should we work on in Project?`, chip row visible), sidebar shows project row + `No chats`. Cancel → close, emit `codex:trust-cancel`, nothing added.
4. The desktop/Finder item never moves (drop is a reference).

#### 4.4.3 Chats
- Top `New chat` → draft orphan chat (title `New chat`, not listed in the sidebar until the first message is sent), emit `codex:new-chat {chatId, projectPath:null}`; main shows `What should we work on?`, no chips.
- Click a project row → select that project's existing draft or create one (no sidebar row yet), emit `codex:select-project {path}` ON EVERY CLICK, even when that project is already selected (M5 step 1 follows M4, where it is); the `+` button on the row = always a fresh project draft and emits `codex:new-chat {projectPath}` too. Clicking a chat row opens it (read/continue).
- Sending the first message makes the chat appear (title from the intent: `寫報告` for report, `AGENTS.md` for agents, `列出檔案` for list, `專案規則` for ask_rules, otherwise the first 12 characters of the prompt), under its project or under Recents.
- Seed Recents (orphans, each with two canned messages so they open sensibly): `英文信件潤稿` (user: 「幫我把這封英文信改得更有禮貌」 / assistant: 「可以，請把信的內容貼給我。」), `整理課堂筆記` (user: 「幫我整理這堂課的筆記」 / assistant: 「好，請把筆記貼過來，我會幫你分段。」). A blue unread dot is shown on `整理課堂筆記` until opened.
- Persistence: projects, chats and messages (each assistant message with its `files` as absolute paths) are saved via `LAB.store` (domain `codex`); an in-flight reply is answered again after a reload, and the active chat / a pending Trust prompt come back (§14). The chat object owns an in-flight reply (§3.11): it keeps running and still emits `codex:reply` if the window is closed or another chat is selected. `LAB.codex.resetChats()` restores the seed.

#### 4.4.4 Reply engine (timing)
On send: user bubble appears at once; composer clears and is disabled. At +300 ms a status line `Working…` (three dots fading in sequence, 1.2 s cycle, no spinner) appears. The matched intent's `run` collects steps and text; steps are revealed one by one every 450 ms (each with a check mark after 250 ms) and side effects on the VFS happen exactly when their step line appears (so open Finder/Code/Terminal windows see changes live, `by:'codex'`). The final text streams at 45 characters/second but never longer than 2.2 s in total (faster for long text), then the fold line `Worked for Ns` (N = elapsed seconds, at least 2) is added, the composer re-enables, and `codex:reply {chatId, projectPath, intent, files, text}` is emitted. Whole reply ≤ ~5 s. The status line text is `Working…` (English, as the real UI).

#### 4.4.5 Intents (checked in this order; first `test` that passes wins; text is normalised NFKC + lower-case + spaces collapsed)

Matching rules for ALL intents: CJK keywords match as substrings; ASCII keywords and verbs match only on word boundaries (`\badd\b`, so `address` does not count as `add`). Quotes, file names and rule text are extracted from `ctx.rawText` (the original string), never from the lower-cased normalised text.

| id (priority) | Matches | Behaviour |
|---|---|---|
| `write_agents` (90) | contains `agents.md` AND a write verb (CJK `加`, `寫`, `新增`, `加入`, `更新`, `改` by substring; ASCII `add`, `write`, `update`, `append` by word boundary) | Target `cwd/AGENTS.md`. New rule text = the first 「…」 / "…" quoted string in the prompt; else the text after `加入`/`加上`/`寫進`/`新增` trimmed of `到 AGENTS.md`/`進 AGENTS.md`; if the prompt mentions `圖表` or `figures` and no quote is found → `圖表存到 figures/`. If AGENTS.md exists: read it (step `Read AGENTS.md`), append `- <rule>` on a new line unless an identical line exists, step `Edited AGENTS.md`; reply 「已把這條規則加進 AGENTS.md：」 + newline + `- <rule>`. If it does not exist: create it with the three-heading template from video 02 (`# 這個專案在做什麼` / `# 希望 AI 怎麼幫忙` / `# 有哪些事情不要做`) containing the rule under 希望 AI 怎麼幫忙, step `Created AGENTS.md`, reply 「這個資料夾裡還沒有 AGENTS.md，我幫你建立了一份，並加進這條規則。」 plus, for an orphan chat, 「（注意：這個對話不在專案裡，所以檔案放在 {cwd}。）」. |
| `ask_rules` (80) | question about rules/memory: contains `規則`, `遵守`, `agents`, `記得`, `rules`, or `你知道這個專案` AND no write verb | Project chat: `read('AGENTS.md')`; if present reply 「我讀了 AGENTS.md，目前有這些規則：」 + the bullet lines (without `#` headings) + newline + 「我會照這些做。」; if absent 「這個專案裡沒有 AGENTS.md，所以我沒有額外的規則。」 Orphan chat: reply 「這個對話不在任何專案底下，我看不到專案裡的 AGENTS.md，所以不知道它的規則。要用專案的規則，請先在專案底下開對話。」 (no file reads). |
| `list_paths` (75) | `完整路徑`, `full path`, `路徑`, `放在哪`, `在哪裡` with `列出`/`告訴我`/`哪` | Reply 「新增：」 + newline + one absolute path per line for every file created/edited in THIS chat so far (from earlier reply `files`); none → 「這個對話還沒有新增任何檔案。」 |
| `write_report` (70) | contains (`報告` or `report`) AND a write verb (CJK `寫`, `做`, `產生`, `建立`, `生成`, `幫我` by substring; ASCII `write`, `create`, `make` by word boundary) | Relative target = first token matching `[\w./\u4e00-\u9fff-]+\.(md|txt)` in the prompt, default `output/report.md`. Project chat: steps `Read AGENTS.md` (if present), `Read data/A.csv`, `data/B.csv`, `data/C.csv` (those that exist under `cwd/data`), then `Created output/report.md` (or `Edited` when it already existed). Report content (Traditional Chinese Markdown, real numbers computed from the CSVs: per class count, mean (1 decimal), min, max, count ≥ 60): `# 成績報告`, then sections `## 資料來源`, `## 各班統計` (a Markdown table), `## 觀察` (two generated sentences naming the highest-mean class). Reply 「已建立 output/report.md」 (or 「已更新 output/report.md（原本的內容被取代了）」) followed on a new line by 「照 AGENTS.md：報告用繁體中文，輸出放在 output/。」 when AGENTS.md was read. Orphan chat (`cwd` = Documents, no data): no reads, content = `# 報告` + `這個對話不在專案裡，我沒有找到你的資料檔，所以這份報告只有範例內容。` + a short placeholder section; reply 「已建立 output/report.md」 only (deliberately WITHOUT the full path). The file is created at `cwd/<relative>` creating `output/` as needed. |
| `make_folder` (60) | `建立`/`新增`/`mkdir`/`create` AND (`資料夾`/`folder`/`目錄`) | Name = first 「…」 quote or first ASCII token after the word, default `figures`; `mkdir` step `Created <name>/`; reply 「已建立資料夾 <name>/」. |
| `summarize_data` (55) | (`統計`, `平均`, `分析`, `摘要`, `成績`, `csv`, `看一下資料`) | Project: read the CSVs under `cwd/data` (or `cwd` if none there) and reply with a small plain-text table of count/mean/min/max per file; orphan or none found: 「我在這個資料夾（{cwd}）裡沒有找到 CSV 檔。」 |
| `list_files` (50) | `列出` / `有哪些檔案` / `目前有什麼` / `ls` / `list files` | Reply the top-level entries of `cwd` (dirs with trailing `/`), one per line, preceded by 「{cwd} 裡有：」. |
| `where_am_i` (45) | `在哪`, `哪個資料夾`, `目前.*位置`, `工作資料夾`, `pwd`, `cwd` | Project chat: 「目前的工作資料夾是 {cwd}。」 Orphan: 「這個對話沒有專案，所以我暫時使用 {cwd}。」 |
| `greet` (10) | `你好`, `哈囉`, `hello`, `hi`, `嗨` | 「你好！我是練習版的 Codex。你可以請我寫報告、列出檔案、改 AGENTS.md。」 |
| fallback (0) | anything else | 「這個練習版的 Codex 只聽得懂幾種請求，例如：」 ⏎ `• 幫我寫一份報告到 output/report.md` ⏎ `• 列出你新增的檔案完整路徑` ⏎ `• 把「圖表存到 figures/」加進 AGENTS.md` ⏎ `• 你目前遵守哪些規則？` ⏎ 「（這是教學用的模擬，不是真的 AI。）」 — intent id `fallback`, no files. |

Replies never include clickable paths: absolute paths are plain selectable mono text (the student must find them in Finder). `LAB.codex.registerIntent` lets later weeks add intents (e.g. Firenze homework).

Menus (English): File {New Chat ⌘N, Open Folder… (toast 「這個練習請用拖曳：把資料夾拖進 Codex」), Close Window ⌘W}, Edit {Cut, Copy, Paste, Select All}, View, Window {Minimize ⌘M, Zoom}, Help {About this practice}.

---

## 5. Missions

### 5.1 Schema (js/missions-week3.js calls `LAB.missions.register`)

```js
LAB.missions.register({
  id: 'w3-01-desktop',            // unique, stable (stored in progress)
  week: 3, order: 1,
  title: '認識桌面與 Finder',
  minutes: 6,                      // shown as 「約 6 分鐘」
  tag: '補充教材',                  // optional rail label (M2, M3 only: 「Week 3 補充 1」)
  map: '…',                        // optional one calm line, shown as a collapsible 「地圖」 in the rail (M2, M3)
  resetsFiles: true,               // the rail then says 「開始這個任務會把相關檔案恢復到起始狀態。」
  intro: '一句到三句，Traditional Chinese',
  prepare(api) { /* idempotent; runs on the FIRST start and on explicit reset (not when merely switching back) */ },
  steps: [
    { id: 's1',
      text: '…',                   // GOAL in words (three-layer rule below); imperative, ≤ 60 chars where possible
      hint: '…',                   // PATTERN and meaning (shown when 「提示」 is clicked); never just the answer
      answer: '…',                 // the full command / exact action (shown after 「直接告訴我答案」)
      check(ev, api) { return boolean; },   // ev = the queued event {name, data}, or null (state poll / replay)
      onDone(api, ev) { /* optional: api.state.x = … */ },
      optional: false,             // true = skippable (§ engine rule 4)
      replay: 'mission',           // optional: this step's api.seen/termSeen default to history since mission start and it is also tried with ev=null when it becomes current
      where: '/Users/an/Desktop',  // optional: the folder the student is expected to be in, used only by the "stuck" nudge
      trap(ev, api) { return null; } }       // optional: returns one quiet line for a known beginner mistake, or null
  ],
  outro: '完成後顯示的一兩句話'
});
```

**Three-layer wording rule.** For every step: `text` = the goal in words; `hint` = the pattern and its meaning; `answer` = the full command or exact clicks. The full command appears in `text` ONLY the first time that command is used anywhere in the missions (the first `cd`, `ls`, `pwd`, `mkdir`, `open .`, `mv`, `unzip`); later steps are phrased as goals so the student has to BUILD the command or the address (`mv 東西 地方`, `~/Desktop/Project`, `..`), which is the real skill. A level-1 hint must never equal the answer.

**Inline marks** in every mission string (intro, text, hint, answer, outro, trap lines), parsed by the rail into DOM nodes, never innerHTML: `` `code` `` = mono text, selectable; `[[sentence]]` = a sentence the student must type into Codex: shown in mono, selectable, followed by a small text link 「複製」 (`data-lab="rail-copy"`, `LAB.clipboard.setText`), because typing long Chinese through an IME is a barrier. Hints that carry a `[[…]]` sentence say 「可以複製上面這句，貼到輸入框」.

**`api`** passed to `prepare`/`check`/`onDone`/`trap`:
```
api.vfs, api.wm, api.codex (= LAB.codex), api.state (mission scratch object, persisted)
api.canon(path) → LAB.vfs.canon;  api.exists(path);  api.read(path) → string|null
api.resolve(cwd, p) → canonical absolute path of p resolved against cwd (LAB.vfs.canon(p, cwd))
api.same(a, b)                               // LAB.vfs.same (false for virtual ids)
api.seen(name, pred?, {since}) → data|null   // newest matching bus entry with seq > startSeq; since:'step' (default: the seq when this step became current) | 'mission' (the seq at mission start); a step with replay:'mission' defaults to 'mission'
api.termCmd(ev, pred) → cmd|null             // if ev is a term:run, the first entry of ev.data.cmds with pred(c, ev.data) true (cmds, §3.3: per simple command with its own cwd/cwdAfter/status/out); compound lines like `cd Desktop && pwd` therefore work
api.termSeen(pred, {since}) → cmd|null       // the same search over term:run history (honours since / replay)
api.lsDir(c) → Path                          // the directory an `ls` entry listed: its first non-flag arg resolved against c.cwd, else c.cwd
api.win(appId) → Win[]  (LAB.wm.byApp);  a document window's api.win(...)[i].state.path is the file it shows
api.finderAt(path) → boolean                 // any Finder window currently showing that folder
api.ensureSeed(path, {overwrite=false})      // LAB.seed.restore (by:'system'); creates the seeded node when missing
api.remove(path)                             // permanent removal, by:'system', no error when missing
api.HOME = '/Users/an', api.DESKTOP = '/Users/an/Desktop', api.DOWNLOADS = '/Users/an/Downloads', api.DOCUMENTS = '/Users/an/Documents', api.PROJECT = '/Users/an/Desktop/Project'
```

**Engine rules.**
1. *Queue, no recursion.* The engine subscribes to `*`, ignores every `mission:*` event and every event emitted while `prepare` is running, and pushes the rest on a FIFO queue that one loop drains. `prepare`, `onDone` and the engine's own emits can therefore never re-enter the evaluator. Order and "since" use `LAB.bus` `seq` (§3.3), never wall-clock time; the current step's start `seq` is persisted, and the persisted bus tail (§3.3) survives a reload.
2. *Evaluation.* For each queued event: take the first undone step and run `check(ev, api)`. If true: mark it done (timestamp), emit `mission:step`, run `onDone`, set the next step's start `seq`, then immediately try the NEXT undone step with `ev = null`, repeating until one fails. `check` with `ev = null` must return false unless it can be decided from state (or from history because of `replay:'mission'`). A step already satisfied by state therefore completes without a new event; an event-only step needs the event after its start (or `replay:'mission'`: "run it any time since the mission started").
3. *Loose checks.* Checks accept every natural way of doing the thing (via `api.termCmd` the compound lines, any directory when the folder does not matter, `sidebar`/`pathbar`/`back`/`up` navigation, a state fallback when the event could have been missed). A step must never be failable by doing something reasonable in the wrong order.
4. *Optional steps.* If the first undone step is `optional`, the steps after it up to and including the first non-optional one are ALSO tried against each event; if a later step passes, the optional steps before it are marked done with `skipped:true` (`mission:step {skipped:true}`). The rail shows a text link 「略過這一步」 (`data-lab="rail-skip"`) under an optional current step; skipped steps count as done in the progress line.
5. *Prepare runs once.* `prepare(api)` runs on the FIRST `start` of a mission (no `startedAt` yet) and on `reset(id)` (「重來這個任務」). Switching to a mission that is already started or finished NEVER re-runs `prepare` (it would delete the student's files and Codex state). `prepare` runs with `preparing = true`, all VFS mutations use `by:'system'`, and the engine takes each step's start `seq` AFTER it finishes. Prepares restore seeded content through `api.ensureSeed`, so a missing `Project`, `data/`, `AGENTS.md` or `week3.zip` is put back instead of leaving the mission impossible.
6. *Completion.* When every non-optional step is done (an optional step still open at that moment, such as M5 step 8, stays listed as 「選做」 and does not block): mark the mission done, emit `mission:complete`, show the outro in the rail. `reset(id)` clears step timestamps, hints and `state`, then runs `prepare`.
7. *Errors.* A throwing `check`/`trap` is caught and treated as false/null.
8. *Nudges (one quiet line under the current step, replaced as events arrive, removed when the step is done).* Priority: (a) `step.trap(ev, api)`; (b) built-in, immediate, from the newest `term:run` since the step started: if some cmd has status 127 and its `name` contains a non-ASCII character or U+3000 → 「看起來輸入法是中文，或是空格是全形。切到英文（ABC）再打一次。」; if the status is non-zero and `out` matches /no such file or directory/i → 「印出 no such file or directory，多半是拼錯字，或你人不在預期的資料夾。看提示字元，再用 ls 看看。」; (c) after 60 s on the same step with a non-matching `term:run` since the step started → 「這一步需要在 {資料夾} 裡輸入，先看提示字元最後一個字。」 where {資料夾} = the basename of `step.where` (`~` when it is HOME), or, without `where`, 「先看提示字元最後一個字，確認你人在哪個資料夾。」. The 「提示」 link also gets its amber underline after 60 s (§6.1).
9. *Accessibility.* The rail has an `aria-live="polite"` region that announces 「第 N 步完成」 and the nudge text (§6.5).

Persisted (domain `missions`): `{ current, freePlay, missions:{id:{startedAt, doneAt, startSeq, stepStart:{stepId:seq}, steps:{stepId:ms}, skipped:{stepId:1}, hints:{stepId:0|1|2}, state:{…}}} }`.

### 5.2 Event payload quick reference used by checks
`finder:navigate {winId,path,via}`; `finder:select {winId,paths}`; `term:run {name,args,cwd,cwdAfter,status,out,cmds:[{name,args,cwd,cwdAfter,status,out}]}` (use `api.termCmd`); `fs:change {op,path,from,kind,by}`; `editor:open {path,appId}`; `win:focus {id,appId}`; `dnd:drop {payload,targetId,accepted,mode}`; `codex:trust-prompt {path}`; `codex:trust {path}`; `codex:select-project {path}`; `codex:new-chat {chatId,projectPath}`; `codex:reply {chatId,projectPath,intent,files,text}`; `win:open {appId}`; `code:folder {path}`. `canon` is applied to every path before comparison. `PROJECT = /Users/an/Desktop/Project`.

### 5.3 The seven Week 3 missions (exact Traditional Chinese)

Common: Mission titles appear as 「第 N 個任務」 + title in the rail. Wording conventions for ALL mission text: the Mac key is 「Return」 (the parenthetical 「（Windows 鍵盤是 Enter）」 is added at its first mention in M1 and M2 and in the welcome panel); mouse words are 「點一下」 and 「點兩下」 (never 雙擊 or 連點兩下); 「命名為」 (never 取名為); `Command` is written 「Command」 (Windows keyboards: Ctrl, explained in the welcome panel). The map vocabulary of the supplement video is used consistently: **~ = 社區** (`/Users/an`, formal name 家目錄), **Downloads = 管理室**, **Desktop = 中庭**, **Desktop/Project = 家**, **`..` = 往外一層**. 「家」 ALWAYS means the Project folder; ~ is never called 家. Apps are named by their Dock label, never by colour: 「終端機」, 「Codex」 (not Code), 「Code（就是影片裡的 VS Code）」, 「文字編輯」.

**M1 `w3-01-desktop` 認識桌面與 Finder（約 6 分鐘）**
intro: 「這是一台練習用的 Mac。先認識最常用的兩個地方：桌面，和用來看檔案的 Finder。」 resetsFiles: true.
prepare: `api.remove(DESKTOP+'/練習')`.
1. text 「點 Dock 最左邊的 Finder，打開一個視窗。」 hint 「螢幕最下面那一排叫 Dock，第一個圖示就是 Finder。」 answer 「點一下 Dock 上的 Finder。」 check: `ev.name==='win:open' && ev.data.appId==='finder'` OR `api.win('finder').length>0`.
2. text 「在 Finder 左邊的側邊欄點「桌面」。」 hint 「側邊欄在視窗左邊，找到寫著「桌面」的那一列。」 answer 「點側邊欄的「桌面」。」 check: `api.seen('finder:navigate', d=>api.same(d.path,DESKTOP))` OR `api.finderAt(DESKTOP)`.
3. text 「在桌面上點兩下 Project 資料夾，打開它。」 hint 「要連續點兩下，點一下只是選取。桌面的 Project 圖示在螢幕右上角，也可以在 Finder 視窗裡點兩下。」 answer 「點兩下 Project。」 check: `ev` is `finder:navigate` with `same(d.path, PROJECT)`, or `api.finderAt(PROJECT)`.
4. text 「看視窗最下面的路徑列，再點其中的「桌面」，回到上一層。」 hint 「路徑列從左到右，就是這個資料夾的完整位置：Macintosh HD › 使用者 › an › 桌面 › Project，也就是 /Users/an/Desktop/Project。」 answer 「點路徑列的「桌面」（或側邊欄的「桌面」，或左上角的返回鍵）。」 check: `ev.name==='finder:navigate' && same(d.path,DESKTOP) && ['pathbar','back','up','sidebar'].includes(d.via)`, or (state, `ev === null`) `api.finderAt(DESKTOP)`.
5. text 「在桌面空白處按右鍵，選「新增檔案夾」（macOS 選單裡資料夾叫「檔案夾」），命名為「練習」，按 Return（Windows 鍵盤是 Enter）。」 hint 「如果找不到空白處，先把 Finder 視窗拖開或最小化。筆電觸控板：用兩指點一下就是右鍵。新增後名字會變成可以直接輸入的狀態；要先把輸入法切到中文，才打得出「練習」。」 answer 「右鍵 → 新增檔案夾 → 輸入 練習 → Return。」 check: `api.exists(DESKTOP+'/練習')` (state).
6. text 「在 Finder 的桌面裡找到「練習」，點它一下：它和桌面上的圖示是同一個東西。」 hint 「Finder 視窗要停在「桌面」；如果不在，點側邊欄的「桌面」。」 answer 「Finder → 側邊欄「桌面」→ 點「練習」。」 check: `api.seen('finder:select', d=>d.paths.some(p=>api.same(p, DESKTOP+'/練習')))`.
outro: 「做得好。桌面上的東西，其實都是 /Users/an/Desktop 這個資料夾裡的檔案。」

**M2 `w3-02-terminal` 用終端機走路（約 12 分鐘）** tag 「補充教材」
map: 「~ 社區（/Users/an）· Downloads 管理室 · Desktop 中庭 · Desktop/Project 家 · .. 往外一層」
intro: 「終端機是用打字叫電腦做事的視窗。這一關練習五個指令：pwd、ls、cd、mkdir、open。」 resetsFiles: true.
prepare: `api.remove(PROJECT+'/figures')`.
1. text 「點 Dock 上的「終端機」（滑鼠移過去會顯示名字）。也可以點右上角選單列的放大鏡，輸入 `terminal`，按 Return（Windows 鍵盤是 Enter）。」 hint 「終端機的圖示是黑底，左下角有 `>_`。打指令前，輸入法先切到英文（ABC）。Command＋空白鍵可能被真正的電腦拿去用，Windows 鍵盤的 Ctrl＋空白鍵也常是切換輸入法，所以請用點的。」 answer 「點一下 Dock 上的「終端機」。」 check: `win:open` with `appId==='terminal'` OR `api.win('terminal').length>0`.
2. text 「輸入 `ls`，按 Return：看看這裡有什麼。」 hint 「ls 是「看一圈」。打完要按 Return 才會執行。」 answer 「輸入：`ls`」 replay: 'mission'. check: `api.termCmd(ev, c=>c.name==='ls' && c.status===0)` (any folder: the check does not depend on where the window is).
3. text 「輸入 `cd Desktop`，再輸入 `pwd`。注意提示字元最後面的字變成什麼？」 hint 「cd 是走路，後面接要去的資料夾名字；pwd 會印出你現在的完整位置。你在哪裡，提示字元的最後一個字會告訴你。」 answer 「`cd Desktop`，Return；`pwd`，Return。提示字元從 ~ 變成 Desktop，pwd 印出 /Users/an/Desktop。」 where: HOME. replay: 'mission'. check: `api.termCmd(ev, c=>c.name==='pwd' && c.status===0 && api.same(c.cwd, DESKTOP))`.
4. text 「走進 Project，用 ls 看看裡面有什麼。」 hint 「cd 後面接資料夾名字，ls 看一圈。Project 裡會看到 AGENTS.md、data 和 筆記.docx。」 answer 「`cd Project`，Return；`ls`，Return。」 where: DESKTOP. replay: 'mission'. check: `api.termCmd(ev, c=>c.name==='ls' && c.status===0 && api.same(api.lsDir(c), PROJECT))`.
5. text 「用 `cd ..` 回到上一層，看看提示字元變成什麼。」 hint 「兩個點 .. 代表「往外一層」。從 Project 往外一層，就回到 Desktop。」 answer 「輸入：`cd ..`」 where: PROJECT. replay: 'mission'. check: `api.termCmd(ev, c=>c.name==='cd' && c.args[0]==='..' && api.same(c.cwdAfter, DESKTOP))`.
6. text 「用 `cd ~` 一步回到「社區」，不管你現在在哪裡都可以。」 hint 「~ 代表你的「社區」，也就是 /Users/an（正式名稱是家目錄）。回到社區後，提示字元會變成 ~。」 answer 「輸入：`cd ~`」 replay: 'mission'. check: `api.termCmd(ev, c=>c.name==='cd' && api.same(c.cwdAfter, HOME))`.
7. text 「走到 Project，輸入 `mkdir figures`，新增一個叫 figures 的資料夾。」 hint 「mkdir 後面接新資料夾的名字，而且要在 Project 裡輸入：先用 cd 加上地址走到 Project（~ 是社區，Desktop 是中庭，Project 是家），打完用 ls 確認它出現了。」 answer 「`cd ~/Desktop/Project`，Return；`mkdir figures`，Return；`ls`，Return。」 where: PROJECT. replay: 'mission'. check: `api.exists(PROJECT+'/figures') && api.termSeen(c=>c.name==='mkdir' && c.status===0)` (state + history, since mission).
8. text 「輸入 `open .`（open 空白 點），用 Finder 打開這個資料夾，確認 figures 在裡面。」 hint 「那個點代表「這裡」；open 後面接地址，就會用 Finder 打開它。」 answer 「在 Project 裡輸入：`open .`」 where: PROJECT. replay: 'mission'. check: `api.termCmd(ev, c=>c.name==='open' && c.status===0 && c.args[0] && api.same(api.resolve(c.cwd, c.args[0]), PROJECT))`.
outro: 「終端機和 Finder 看的是同一個資料夾：你在終端機新增的東西，Finder 馬上就看得到。（mkdir 和 open 是影片 01「四個窗口看同一個資料夾」那一幕會用到的指令，所以也放在這一關。）」

**M3 `w3-03-unzip` 拆包裹：week3.zip（約 12 分鐘）** tag 「補充教材」
map: 同 M2。
intro: 「老師給你一個壓縮檔 week3.zip，它在「下載項目」（終端機裡叫 Downloads，社區裡的管理室）。把它搬進 Project（你的家），拆開來，再把包裝紙收到中庭。地圖：~ 社區（/Users/an）· Downloads 管理室 · Desktop 中庭 · Desktop/Project 家 · .. 往外一層。」 resetsFiles: true.
prepare (first start / reset only): `api.ensureSeed(DESKTOP+'/Project')`, `api.ensureSeed(DOWNLOADS+'/week3.zip', {overwrite:true})`; `api.remove` `PROJECT+'/week3'`, `PROJECT+'/week3.zip'`, `DESKTOP+'/week3.zip'`; and remove any zip-kind node of the seed size (1301 bytes) sitting directly in Desktop or Project under another name (a renamed copy left by the "typo trap").
1. text 「先回到社區：`cd ~`（不管你現在在哪裡都可以）。」 hint 「提示字元最後一個字會變成 ~。如果你剛才停在 Project，提示字元會寫 Project；打指令前先看一下提示字元。」 answer 「輸入：`cd ~`」 where: HOME. check: `api.termCmd(ev, c=>c.name==='cd' && api.same(c.cwdAfter, HOME))`.
2. text 「走進 Downloads，看看裡面有什麼。」 hint 「cd 後面接資料夾名字，ls 看一圈。下載項目在終端機裡叫 Downloads。」 answer 「`cd Downloads`，Return；`ls`，Return。」 where: HOME. replay: 'mission'. check: `api.termCmd(ev, c=>c.name==='ls' && c.status===0 && api.same(api.lsDir(c), DOWNLOADS))`.
3. text 「把 week3.zip 搬進 Project：`mv week3.zip ~/Desktop/Project`」 hint 「mv 東西 地方。week3.zip 是要搬的東西；地方是一串地址：~ 是社區，Desktop 是中庭，Project 是家，用 / 隔開。沒有印出任何字，就是成功了。」 answer 「輸入：`mv week3.zip ~/Desktop/Project`」 where: DOWNLOADS. check: `api.exists(PROJECT+'/week3.zip') && !api.exists(DOWNLOADS+'/week3.zip')`. trap: when the current step is this one, `week3.zip` is missing from both Downloads and Project, and a zip-kind node under another name sits directly in Desktop or Project → 「week3.zip 被改名成「{name}」了：mv 的目的地不存在時，會直接把東西改名。用 `mv {name} week3.zip` 改回來，再試一次。」
4. text 「再 ls 一次看 Downloads：week3.zip 還在嗎？」 hint 「mv 是搬走，不是複製。」 answer 「在 Downloads 輸入：`ls`（或在別處輸入 `ls ~/Downloads`）。syllabus.pdf 還在，week3.zip 不見了。」 where: DOWNLOADS. replay: 'mission'. check: `api.termCmd(ev, c=>c.name==='ls' && c.status===0 && api.same(api.lsDir(c), DOWNLOADS) && !/week3\.zip/.test(c.out))`.
5. text 「用一整串地址走到 Project，再 ls 確認包裹到了。」 hint 「cd 後面接地址：~ 是社區，Desktop 是中庭，Project 是家，用 / 隔開。ls 會看到 week3.zip（還有 Project 原本的東西）。」 answer 「`cd ~/Desktop/Project`，Return；`ls`，Return。」 where: DOWNLOADS. replay: 'mission'. check: `api.termCmd(ev, c=>c.name==='ls' && c.status===0 && api.same(api.lsDir(c), PROJECT) && /week3\.zip/.test(c.out))`.
6. text 「拆包裹：輸入 `unzip week3.zip`，再 `ls` 看看多了什麼。」 hint 「unzip 後面接要拆的檔案。它會把東西拆在現在這個資料夾，多出一個叫 week3 的資料夾。」 answer 「`unzip week3.zip`，Return；`ls`，Return。」 where: PROJECT. replay: 'mission'. check: `api.exists(PROJECT+'/week3/README.md') && api.termSeen(c=>c.name==='ls' && c.status===0 && api.same(api.lsDir(c), PROJECT) && /(^|\s)week3(\s|$)/.test(c.out))` (ls pads names with spaces, so the standalone word `week3` can only appear after the unzip; `week3.zip` alone does not match).
7. text 「把包裝紙 week3.zip 放到家門外。」 hint 「mv 東西 地方；家門外是往外一層，怎麼寫？」 answer 「輸入：`mv week3.zip ..`（.. 就是往外一層，也就是 Desktop）」 where: PROJECT. check: `api.exists(DESKTOP+'/week3.zip') && !api.exists(PROJECT+'/week3.zip') && api.exists(PROJECT+'/week3/A.csv')`.
8. text 「用 Finder 打開 Project 裡的 week3，點兩下 README.md，看看裡面寫什麼。」 hint 「README.md 會用「文字編輯」打開。（真正的 Mac 預設會把 .zip 藏起來，只顯示 week3；練習版把副檔名都顯示出來，所以你看得到 week3.zip。）」 answer 「Finder → 桌面 → Project → week3 → 點兩下 README.md。」 check: `editor:open` with `same(path, PROJECT+'/week3/README.md')`.
outro: 「cd 是走路、ls 是看一圈、mv 是搬東西、unzip 是拆包裹。記得：mv 是搬走，不是複製。這就是用終端機整理檔案的基本功。」

**M4 `w3-04-project` 把資料夾交給 Codex（約 5 分鐘）**
intro: 「Codex 以「一個資料夾」為工作單位。先把桌面上的 Project 資料夾交給它。」 resetsFiles: true (開始時會把 Codex 裡 Project 的專案與對話清掉，重新來過).
prepare (first start / reset only): `api.codex.removeProject(PROJECT, {chats:'remove'})` so the trust prompt appears and no stale project chats survive; the rail note for this mission reads 「開始這個任務會把 Codex 裡 Project 的專案和對話恢復到起始狀態。」
1. text 「點 Dock 上的「Codex」（滑鼠移過去會顯示名字；是 Codex，不是 Code）。」 hint 「Codex 的圖示是深色底，中間只有一個線條畫的輪廓；黑底、左下角有 `>_` 的是終端機。」 answer 「點一下 Dock 上的「Codex」。」 check: `win:open` with `appId==='codex'` OR `api.win('codex').length>0`.
2. text 「把桌面上的 Project 資料夾，拖進 Codex 左邊的側邊欄。」 hint 「按住 Project 圖示不放，拖到 Codex 左邊那一欄，看到側邊欄亮起藍框再放開。放開後桌面上的 Project 還在，這是正常的：只是告訴 Codex 它在哪裡。如果 Codex 蓋住了桌面圖示，先把視窗往左拖開一點，或從 Finder 視窗裡拖。」 answer 「Project 圖示 → 按住拖 → 放進 Codex 側邊欄。（也可以：Finder 對 Project 按右鍵 → 打開方式 → Codex。）」 check: `codex:trust-prompt` with `same(path, PROJECT)`, OR a `dnd:drop` with `accepted` whose `targetId` starts with `codex:` and whose `payload.paths` contains PROJECT, OR (state) `api.codex.state().projects` contains PROJECT.
3. text 「看到「Trust this folder?」：這是在問你信不信任這個資料夾。按 Trust folder。」 hint 「Trust folder 是讓 Codex 可以在這個資料夾裡讀檔、改檔、執行指令。只信任你自己的資料夾。」 answer 「點白色的 Trust folder。」 check: `codex:trust` with `same(path,PROJECT)`, OR (state) `api.codex.state().projects` contains PROJECT.
4. text 「到 Finder 看看它在電腦裡的真實位置：打開桌面的 Project，看視窗最下面的路徑列。」 hint 「Macintosh HD › 使用者 › an › 桌面 › Project 就是它真實的位置，也就是 /Users/an/Desktop/Project。」 answer 「點兩下桌面上的 Project 資料夾。」 check: `finder:navigate` with `same(path,PROJECT)` (event, since this step started).
outro: 「記住：Codex 說的「專案」，就是電腦裡真的存在的那個資料夾。拖進去不是搬走，Project 還在桌面上。」

**M5 `w3-05-in-project` 在專案裡請 Codex 做事（約 10 分鐘）**
intro: 「在專案底下開對話，Codex 做出來的東西會放進這個資料夾。我們來驗證：它做的檔案，在其他視窗也看得到。」 resetsFiles: true.
prepare (first start / reset only): `api.ensureSeed(PROJECT)`, `api.ensureSeed(PROJECT+'/data')`, `LAB.codex.addProject(PROJECT, {trust:true, select:false})` if missing; `api.remove(PROJECT+'/output')`, `api.remove(PROJECT+'/charts')`.
1. text 「在 Codex 側邊欄點一下 Project，確認輸入框上方有「Project」這個標籤。」 hint 「點 Project 這一列（不是最上面的 New chat）。」 answer 「點側邊欄的 Project。」 check: `codex:select-project` with `same(path,PROJECT)` (event; every row click emits it).
2. text 「請 Codex 寫報告：[[幫我寫一份報告到 output/report.md]]，按 Return。」 hint 「可以複製上面這句，貼到輸入框。等它出現 Created output/report.md 就是做完了。」 answer 「把「幫我寫一份報告到 output/report.md」貼到輸入框，按 Return。」 check: `codex:reply` with `intent==='write_report'` and `same(projectPath,PROJECT)`.
3. text 「真實位置 = 專案資料夾 + output/report.md。到 Finder 找到它，看路徑列是不是這樣。」 hint 「先打開 Project，再往下找 output。路徑列會寫 Macintosh HD › 使用者 › an › 桌面 › Project › output。」 answer 「Finder → 桌面 → Project → output。」 check: `finder:navigate` with `same(path, PROJECT+'/output')`.
4. text 「點兩下 report.md，用文字編輯讀它。」 hint 「裡面有各班的平均分數，是 Codex 讀了 data 裡的 CSV 算出來的。」 answer 「在 output 資料夾裡點兩下 report.md。」 check: `editor:open` with `same(path, PROJECT+'/output/report.md')`.
5. (optional) text 「（選做）在終端機走到 Project，看看 output 裡有什麼。」 hint 「先用地址走到 Project，再用 ls 看 output。想看檔案內容，可以試 `cat output/report.md`。」 answer 「`cd ~/Desktop/Project`，Return；`ls output`，Return。」 where: HOME. check: `api.termCmd(ev, c=>c.name==='ls' && c.status===0 && api.same(api.lsDir(c), PROJECT+'/output') && /report\.md/.test(c.out))`.
6. text 「用 Code（就是影片裡的 VS Code）打開 Project 資料夾。」 hint 「資料夾可以拖到 Code 的視窗或 Dock 圖示上，也可以在 Finder 用右鍵的「打開方式」選 Code（不是 Codex）。」 answer 「Finder 對 Project 按右鍵 → 打開方式 → Code。」 replay: 'mission'. check: `code:folder` with `same(path,PROJECT)`.
7. text 「在 Code 左邊的檔案列表點開 output，再點 report.md。」 hint 「左邊那一欄叫 EXPLORER，像 Finder 的側邊欄。」 answer 「EXPLORER → output → report.md。」 check: `editor:open` with `appId==='code'` and `same(path, PROJECT+'/output/report.md')`.
8. (optional) text 「（選做）在終端機的 Project 裡新增一個叫 charts 的資料夾，同時看 Code 左邊和 Finder：它會自己出現。」 hint 「mkdir 後面接資料夾名字。Finder 和 Code 都不用重新整理。」 answer 「在 Project 裡輸入：`mkdir charts`」 where: PROJECT. replay: 'mission'. check: `api.exists(PROJECT+'/charts') && api.termSeen(c=>c.name==='mkdir' && c.status===0)`.
outro: 「Codex、Finder、終端機、Code，四個視窗看的是同一個資料夾；檔案不在聊天室裡，而是真的存在硬碟上。「output/report.md」是相對路徑，從對話所在的資料夾算起。」

**M6 `w3-06-orphan` New chat 的陷阱（約 8 分鐘）**
intro: 「按最上面的 New chat 開出來的對話，不屬於任何專案。同一句話，檔案會放到哪裡？」 resetsFiles: true.
prepare (first start / reset only): `api.ensureSeed(PROJECT)`, `api.ensureSeed(PROJECT+'/data')`, ensure Project is a Codex project; `api.remove(DOCUMENTS+'/output')` AND `api.remove(PROJECT+'/output')` (so M5's file cannot blur the contrast in step 5).
1. text 「按 Codex 最上面的 New chat。注意：輸入框上方沒有 Project 標籤。」 hint 「主畫面只問 What should we work on?，沒有專案名稱。」 answer 「點側邊欄最上面的 New chat。」 check: `codex:new-chat` with `projectPath===null`.
2. text 「輸入同一句話：[[幫我寫一份報告到 output/report.md]]」 hint 「整句照打（或複製貼上），和上一個任務一模一樣。等它做完，側邊欄的 Recents 會出現這個對話：它不在 Project 底下。」 answer 「輸入「幫我寫一份報告到 output/report.md」，按 Return。」 check: `codex:reply` with `intent==='write_report'` and `projectPath===null`.
3. text 「它說「已建立 output/report.md」，可是在哪？請問它：[[列出你新增的檔案完整路徑]]」 hint 「在同一個對話裡接著問。可以複製上面這句。」 answer 「輸入「列出你新增的檔案完整路徑」，按 Return。」 check: `codex:reply` with `intent==='list_paths'` and `projectPath===null`.
4. text 「照它給的路徑，在 Finder 找到這個檔案。」 hint 「路徑裡的 Documents，在 Finder 叫「文件」；一層一層往下找 output。」 answer 「路徑是 /Users/an/Documents/output/report.md：Finder → 側邊欄「文件」→ output。」 check: `finder:navigate` with `same(path, DOCUMENTS+'/output')`.
5. text 「改在專案底下重做：點側邊欄的 Project，再輸入一次同一句話。」 hint 「這次輸入框上方會有 Project 標籤，檔案會寫進 Project 底下的 output。」 answer 「點 Project → 輸入「幫我寫一份報告到 output/report.md」→ Return。」 check: `codex:reply` with `intent==='write_report'` and `same(projectPath,PROJECT)` (event, after step 4).
6. text 「到 Finder 打開 Project 裡的 output，看到 report.md：這次它在專案裡。」 hint 「Finder → 桌面 → Project → output。」 answer 「點兩下桌面的 Project，再點兩下 output。」 check: `finder:navigate` with `same(path, PROJECT+'/output')` (event, after step 5).
outro: 「開始任務之前，先確保是在正確的專案內輸入，也要記得真實的專案資料夾在電腦的哪裡。這次剛好放在「文件」，換一個對話它可能放到別處，所以一定要知道它在哪。」

**M7 `w3-07-agents` AGENTS.md：給專案的長期記憶（約 8 分鐘）**
intro: 「每個專案資料夾都該有一份 AGENTS.md，Codex 每次對話都會先讀它。我們來改它，看看新對話是不是真的記得。」 resetsFiles: true.
prepare (first start / reset only): `api.ensureSeed(PROJECT)`; ensure Project is a Codex project; `api.ensureSeed(PROJECT+'/AGENTS.md', {overwrite:true})` when the file is missing or already contains `figures/` (so the seed text of §4.0 is back).
1. text 「用文字編輯或 Code 打開 Project 裡的 AGENTS.md，看它現在有哪些規則。」 hint 「在 Finder 的 Project 裡，點兩下 AGENTS.md。」 answer 「Finder → 桌面 → Project → 點兩下 AGENTS.md。」 check: `editor:open` with `same(path, PROJECT+'/AGENTS.md')`.
2. text 「在 Codex 點 Project 那一列，開新對話，輸入：[[把「圖表存到 figures/」加進 AGENTS.md]]」 hint 「要用專案底下的對話（輸入框上方有 Project 標籤），不是 New chat。可以複製上面這句。」 answer 「點 Project 那一列，輸入整句，按 Return。」 check: `codex:reply` with `intent==='write_agents'`, `same(projectPath,PROJECT)` and `api.read(PROJECT+'/AGENTS.md')` contains `figures/`. onDone: `api.state.agentsChat = ev.data.chatId`.
3. text 「回到 AGENTS.md 的視窗，看它是不是多了一行；沒看到的話，再打開一次。」 hint 「已經打開的視窗點一下就能看；找不到視窗的話，在 Finder 再點兩下 AGENTS.md。」 answer 「點一下 AGENTS.md 的視窗（或在 Finder 再點兩下它），最後一行是「- 圖表存到 figures/」。」 check (events after step 2 only): `editor:open` with `same(path, PROJECT+'/AGENTS.md')`, OR a `win:focus` whose window (`api.win('textedit').concat(api.win('code'))` matched by `id`) has `state.path` equal to `PROJECT+'/AGENTS.md'`.
4. text 「在 Project 底下再開一個全新的對話，問：[[你目前遵守哪些規則？]]」 hint 「把滑鼠移到 Project 那一列，右邊會出現「+」；一定要開新對話，不要接著剛剛那個。新對話的短期記憶是空的，但 AGENTS.md 每次都會帶入。」 answer 「點 Project 那一列右邊的 +，輸入「你目前遵守哪些規則？」，Return。」 check: `codex:reply` with `intent==='ask_rules'`, `same(projectPath,PROJECT)` and `d.chatId !== api.state.agentsChat`. Reply must list `圖表存到 figures/`. trap: when a `codex:reply` with `intent==='ask_rules'` and `chatId === api.state.agentsChat` arrives since this step started → 「這是同一個對話。請開一個新的。」
5. text 「對照看看：按 New chat（沒有專案），問同一句話。」 hint 「這個對話看不到專案裡的 AGENTS.md。」 answer 「點最上面的 New chat，輸入「你目前遵守哪些規則？」，Return。」 check: `codex:reply` with `intent==='ask_rules'` and `projectPath===null`.
outro: 「重要的事寫進 AGENTS.md，每個專案裡的新對話都會記得；不在專案裡的對話，什麼也看不到。完整的 AGENTS.md 通常有三個段落：這個專案在做什麼、希望 AI 怎麼幫忙、有哪些事情不要做（影片 02 示範過）；練習版的只有一段，你可以自己把它補完整。」

`LAB.missions.freePlayTips` (strings): 「在桌面新增檔案夾，再把它拖進 Finder 視窗裡。」「在終端機試試 cp、rm、cat，看看會發生什麼事。」「在 Finder 對檔案按空白鍵，快速查看內容。」「請 Codex 列出目前資料夾裡有哪些檔案。」「打錯指令看看，終端機會怎麼回你。」 Mission order is recommended, not enforced; the list lets the student start any mission. M2 and M3 are supplementary (補充教材): M4–M7 can be started without them (the rail says so, §6.1); the only terminal steps inside M4–M7 are optional (M5 steps 5 and 8).

### 5.4 Progress code (teacher evidence for this visit)

`LAB.missions.progressCode()` returns `LABv1.` + base64 (`btoa`) of the ASCII JSON `{"m":{"<missionId>":<doneAtSeconds>|0,…},"t":<generatedAtSeconds>}`: every STARTED mission id, with the completion time in Unix seconds, or `0` when started but not finished. It contains no file names, chat text or personal data. It is shown in the 「進度」 tab of the About window (§4.3.4) and as a text link 「進度代碼」 in the rail footer that toggles a small read-only line. `LAB.missions.importProgressCode(str)` validates the prefix, base64 and JSON shape and returns `{ok, message, summary}`; `summary` is the readable list 「第 1 個任務　完成　2026-10-04 10:31」…; on success the listed missions that are not done locally are marked done (`doneAt` set, steps not filled in), within this visit (nothing is kept afterwards, §18); a teacher can paste a student's code to read the summary (importing only affects the local browser). The code is evidence, not security: students can forge it, and the teacher's own judgement and the weekly homework remain the real assessment.

---

## 6. Mission rail, first run, small screens, keys

### 6.1 Rail (`#lab-rail`, css/mission.css, js/missions.js)
Left column. In `pinned` mode it sits in the flow; in `drawer` mode (default below 1366 px) a 44 px strip stays in the flow and the full rail opens as an overlay that does not resize the stage (§2.1). Page theme tokens (§2.4, contrast-checked). Typography: Noto Sans TC, body 14 px/1.7, small caps label 11 px letter-spacing .06em, step numerals in JetBrains Mono. No boxes, no cards with shadows, no chips; sections separated by 1 px hairlines. Rail text is `user-select:text` (prompts and commands can be copied).

Top→bottom:
1. Header: small link 「← Week 3」 (to `../../weeks/week03/`), the label 「練習用的 Mac」, and the layout control: pinned → `‹` (switch to drawer); drawer open → 「收起」 and 「固定在左邊」.
2. Mission list disclosure 「任務清單」 (collapsed to the current title by default, shows 7 rows `01 認識桌面與 Finder`; a done mission gets a small check `✓` in amber instead of the numeral; clicking a row switches to that mission with no confirmation and WITHOUT re-running its `prepare`, §5.1 rule 5; progress is kept per mission). Rows 02 and 03 carry the plain small-caps text 「補充教材」 at the right edge (text only, no box). Under the list one muted sentence: 「第 2、3 個任務是 Week 3 補充 1（終端機）。第 4 到 7 個任務不用先做它們，可以直接開始。」
3. Current mission: eyebrow 「第 N 個任務 · 約 X 分鐘」 (for M2 and M3 add 「 · Week 3 補充 1」), title (22 px, 700), intro paragraph; a muted one-liner 「開始這個任務會把相關檔案恢復到起始狀態。」 when `resetsFiles`; for missions with `map`, a disclosure 「地圖」 that reveals the map line (社區 / 管理室 / 中庭 / 家).
4. Steps: each = numeral `01` (amber mono) + text; done step: numeral replaced by `✓`, text colour `--lab-ink-3`; current step: 2 px amber rule on the left, text `--lab-ink`; later steps muted; an optional step reads 「（選做）」 and shows a text link 「略過這一步」. Inline marks of §5.1 render `` `code` `` as mono and `[[…]]` as mono plus the text link 「複製」. Under the current step: text link 「提示」 → reveals the hint paragraph (italic-free, `--lab-ink-2`) and then a second link 「直接告訴我答案」 → reveals the answer. After 60 s without progress on the same step the 「提示」 link gets an amber underline (nothing else changes). Under the step also: the one-line nudge of §5.1 rule 8 (`data-lab="rail-nudge"`, small, `--lab-ink-2`, no icon, no box), and a visually hidden `aria-live="polite"` region (`data-lab="rail-live"`) that announces 「第 N 步完成」 and the nudge text.
5. Footer of the mission: a 2 px progress line (amber fill) with 「已完成 2 / 6 步」 (skipped optional steps count), text links 「重來這個任務」 (resets steps and runs `prepare`), 「自由練習」 (toggles free play: the step list is replaced by the tips list with the note 「想做什麼就做什麼，隨時可以回到任務」), 「進度代碼」 (§5.4), 「重設全部」 (confirm sheet then `LAB.store.reset('all')`).
6. When a mission completes: outro paragraph and a text button 「下一個任務 →」 (1 px hairline border, no fill).
7. Page footer in the rail: `Copyright © 2026 JUNHAO CHEN` and the line 「每次進來都是一台全新的電腦。重新整理或離開這一頁，這次的進度就不會留下。」 (§18).

Collapsed (drawer mode, closed): the 44 px strip shows `›` and vertical text 「第 2 / 6 步」; when a step completes only that text changes. Step completion: the numeral cross-fades to `✓` over 300 ms and the line animates (no confetti, no sound). `data-lab="rail"`, steps `data-lab="step" data-step="s1" data-done="true|false"`.

### 6.2 First-run welcome (`#lab-modal-root`, shown when `ui.welcomeSeen` is false)
**Superseded by §18.2 (2026-10-04): the plain welcome panel is gone. The first thing after the connecting screen is now the first mission sheet (mission title, intro, first step, a short note, 「開始任務」 / 「自由練習」). The text below is the old welcome.**
Plain centred panel on a dimmed page, no icons. Title 「歡迎來到練習用的 Mac」. Body: 「這不是真的 Mac，是在瀏覽器裡執行的模擬環境。你可以放心亂點、亂打指令，弄壞了隨時可以重來，不會影響你自己的電腦。建議先看過 Week 3 的影片。」「左邊是任務卡：照著步驟做，做對了會自動打勾；卡住了可以按「提示」。也可以選「自由練習」，自己隨便玩。」「用 Windows 鍵盤時，Command 請用 Ctrl，Return 就是 Enter。」「每次進來都是一台全新的電腦，任務從第 1 個開始。重新整理或離開這一頁，這次的進度就不會留下。」 (§18) Buttons (text-style, 1 px border): 「開始第一個任務」 (primary, amber underline) and 「自由練習」. Esc = 自由練習. Sets `ui.welcomeSeen` for this visit only, so the welcome shows on every visit and every reload. `role=dialog aria-modal=true`, focus trapped, focus returns to the page on close.

### 6.3 Phone / small-screen notice (`desktop.js`)
Show when `matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 768` OR `window.innerWidth < 760`. Full-page calm notice: title 「請用電腦開啟」, text 「這個練習需要滑鼠和鍵盤，手機畫面太小，操作會很吃力。建議改用電腦的瀏覽器開啟。」, text button 「仍要繼續（不建議）」 (remember in `sessionStorage` try/catch). If they continue: the rail starts in `drawer` mode closed, the stage is scaled by the §2.1 rule with a minimum scale of 0.4, touch works through pointer events (`touch-action:none` on drag handles; a 500 ms long press = right click), page zoom/scroll disabled over the stage, a one-line note 「建議把手機橫放」 under the notice. A small 「全螢幕」 text button (hidden where `requestFullscreen` is missing) sits at the stage's top-right corner on desktop browsers only.

### 6.4 Keyboard shortcuts (Cmd on Mac keyboards; Ctrl is accepted as Cmd on Windows keyboards where it does not clash)

| Shortcut | Action |
|---|---|
| Menu-bar magnifier | Spotlight (the documented way) |
| ⌘Space / Ctrl+Space | Spotlight, as an extra: the real OS usually takes ⌘Space first, and on Windows keyboards Ctrl+Space is often the input-method switch, so it may never reach the page |
| ⌘Q | quit frontmost app (browser may reserve it; also menu 結束) |
| ⌘W | close window (browser may reserve; also red light) |
| ⌘M | minimise |
| ⌘H | hide app |
| ⌘` | next window of the app |
| ⌘N | new window (Finder/Terminal/Codex chat) |
| Esc | closes menu / Spotlight / sheet / Quick Look / drag |
| Finder: ⌘A, ⌘[ ⌘], ⌘↑, ⌘↓, ⌘⇧N, ⌘⇧G, ⌘⇧H/D/O/A, ⌥⌘L, ⌘D, ⌘⌫, Space, Return, ⌘1/⌘2 | per §4.1 |
| Terminal: ⌘K, ⌘C, ⌘V, Ctrl+C, Ctrl+D, Ctrl+L, Ctrl+W / Alt+Backspace, Tab, ↑/↓ | per §4.2.2; in Terminal a plain Ctrl key is never turned into Cmd (§3.8) |
| TextEdit / Code: ⌘S | save |

The 關於 window's 「快速鍵」 tab prints this table, with the note 「在 Windows 鍵盤上，Command 可以用 Ctrl 代替（終端機裡除外）。⌘Space 常被真正的電腦先拿去用，Ctrl＋空白鍵在 Windows 鍵盤上常是切換輸入法，所以請點選單列右上角的放大鏡。Ctrl+W、Ctrl+T、Ctrl+N 是瀏覽器的快速鍵，請用視窗左上角的按鈕或選單。」

### 6.5 Accessibility and polish
Visible focus rings in our chrome (`:focus-visible` amber 2 px); Dock buttons and rail controls are real `<button>`s; `aria-label`s on icon-only controls; reduced-motion respected; text selection disabled on chrome only (rail text stays selectable). Respect the 16 px side gutter on the rail at narrow widths. Everything must work at 1024×640 stage size and render crisply when scaled.
Roles and live regions: `#lab-stage` has `role=application` and `aria-label="練習用的 Mac 桌面"`, `#lab-rail` has `aria-label="任務卡"`; the rail's `aria-live="polite"` region announces step completion and nudges (§6.1); toasts are `role=status`; alert sheets and the Codex Trust modal are `role=alertdialog aria-modal=true` with a focus trap and focus returned to the previous element on close; the Spotlight panel is `role=dialog` with a `role=combobox` input and a `role=listbox` of results; menus are `role=menubar/menu/menuitem`; the Terminal's input has `aria-label="終端機輸入"`; the welcome and phone notice are `role=dialog`.
Contrast: rail text colours meet 4.5:1 on their background at 14 px (amber `#8a5400` and ink-3 `#5f5c55` on `#ebe9e4` are about 5:1; the dark-mode tokens were already above 4.5:1).

---

## 7. Test plan (each builder writes their own Playwright checks in the scratchpad; the final integrator runs all)

Serve: `cd C:/Users/bigmoumou/Desktop/師大教材/Learning-Analytics-Tools-lab && bash ~/.claude/skills/opus-video/scripts/ov python -m http.server 8810`, open `http://localhost:8810/lab/mac/index.html?welcome=0`. Run tests with `bash ~/.claude/skills/opus-video/scripts/ov python <script>.py`, `chromium.launch(channel="msedge", headless=True)`. Test scripts and screenshots live in the scratchpad dir, never in the repo.

Smoke flows that must pass before hand-over: (1) page loads with no console errors (network errors from Google Fonts being blocked in the test environment are filtered out; `/favicon.ico` cannot 404 because of the inline `data:` favicon, §0.1); (2) open Finder via Dock, navigate to Project via sidebar/path bar/double-click, rename/new folder/trash; (3) Terminal reproduces §4.2.4 transcript (unit test of `LAB.shell.run` against a scratch VFS) and live typing; (4) drag Project icon onto Codex sidebar → Trust modal text matches §4.4.2 → Trust → project row; (5) project chat report → file at `Project/output/report.md`, Finder window already open shows it within 1 s; (6) orphan chat → `/Users/an/Documents/output/report.md`; (7) AGENTS.md flow; (8) drag Finder item onto Terminal types the escaped path; (9) all seven missions can be completed in order by scripted actions (events), reset works; (10) reload keeps VFS, chats and progress; `?reset=1` clears and the parameter disappears from the address, and a second reload keeps the new state; the rail's 「重設全部」 really clears (no write-back from `pagehide`); (11) `node tools/check.mjs` passes; (12) compound lines credit missions: `cd Desktop && pwd`, `cd ~/Desktop/Project; ls`, `unzip week3.zip && ls` complete the matching M2/M3 steps through `cmds`; a student who types `ls` before the step is current is still credited where `replay:'mission'` is set; the optional M5 steps can be skipped and a later step auto-skips them; switching back to a finished mission does NOT re-run its `prepare`; the nudges of §5.1 rule 8 appear (full-width space, misspelling, the `Projet` typo trap); (13) drag: with the rail pinned and the stage scaled to 0.7 the ghost stays under the pointer, releasing outside the browser window ends the drag, pressing an unselected item while two others are selected drags only that item, a `fs:change` during a drag does not break the drop or an open rename; (14) clipboard: 拷貝為路徑名稱 then ⌘V in Terminal types the path (also on `file://`); (15) storage: two tabs → the older stops saving and shows the notice; a `QuotaExceededError` toasts once; unavailable storage shows the notice and everything still works; a corrupted `vfs` slice resets only the VFS, not the progress; (16) Terminal: CJK alignment of `ls` in a home with `練習` and `筆記.docx` both before and after the web font loads; Enter right after `compositionend` does not run the line; Ctrl+W/Ctrl+A edit the line and never close the window; sleep + Ctrl+C; the `unzip` overwrite prompt and the `dquote>` continuation; (17) progress code round-trip (`progressCode` → `importProgressCode`); (18) performance flag: `?perf=low` removes every `backdrop-filter`; (19) `?debug=1`: after opening and closing every app, `LAB.debug.listeners()` shows no window-scoped listeners; (20) the owner checks the zh-TW folder labels (桌面, 文件, 下載項目, 電影, 音樂, 圖片, 公共, 資源庫) against a real zh-TW Mac.

Compatibility lint (scratchpad script, run before hand-over): fail on any match in `lab/mac/js/*.js` of `?.` after an identifier or `)`, `??`, `replaceAll`, `.at(`, `structuredClone`, `Object.hasOwn`, `||=`, `&&=` (review ternaries such as `a ?.5 : 1` by hand), and on `100dvh` that is not preceded by a `100vh` fallback line in `lab/mac/css/*.css`, and on a `backdrop-filter` without its `-webkit-backdrop-filter` twin.


---

## 8. Non-goals for v1 (do not build)

Windows skin; Launchpad; real full-screen mode; Mission Control/Spaces; Notification Center content; real Control Center; `.DS_Store` files; column and gallery views in Finder; tabs in Terminal; syntax highlighting in Code; real Markdown rendering; real network/Web; sound; Firenze homework intents (the intent registry makes them an easy later addition); multi-language UI (zh-Hant only); restoring open windows after a reload; merging progress between two tabs (the older tab just stops saving, §3.4); any server or account for progress.

---

## 9. Windows-skin readiness notes (informational)
`LAB.vfs` is Unix-pathed; a Windows skin will add a path adapter (`C:\Users\an\…`) in front of it rather than change the core. `LAB.codex` logic, `LAB.dnd`, `LAB.missions`, `LAB.shell` parser are portable; PowerShell would be a second `LAB.shell` command table with its own prompt (`PS C:\Users\an> `).

---

## 10. Required `data-lab` hooks (for tests and missions)

`rail`, `step` (+ `data-step`, `data-done`), `hint-link`, `dock-item` (+ `data-app`), `menubar`, `menu-title`, `win` (+ `data-app`, `data-win`), `tl-close tl-min tl-zoom`, `desktop-icon` (+ `data-path`), `fd-item` (+ `data-path`), `fd-sidebar-item` (+ `data-path`), `fd-pathbar-seg` (+ `data-path`), `fd-back`, `fd-forward`, `fd-search`, `fd-view-icon`, `fd-view-list`, `term-screen`, `term-input`, `cx-new-chat`, `cx-project` (+ `data-path`), `cx-chat` (+ `data-chat`), `cx-composer`, `cx-send`, `cx-chips`, `cx-modal-trust`, `cx-modal-cancel`, `cx-messages`, `te-text`, `cd-explorer-row` (+ `data-path`), `cd-tab`, `cd-editor`, `spotlight-input`, `spotlight-result`, `sheet-button` (+ `data-value`), `toast`, and the rail's `rail-live`, `rail-nudge`, `rail-copy`, `rail-skip`, `rail-map`, `rail-pin`, `rail-code`.

---

## 11. Build plan and file ownership

Rule: a file has exactly ONE owner; nobody edits another builder's file. Cross-file needs go through the contracts above (`LAB.*` APIs, events, `data-lab` hooks). If a contract is missing something, ask the orchestrator to amend this DESIGN.md.

**Phase 0 — CORE (must finish first; everything else builds on it).** Owner CORE.
Files: `README.md, index.html, css/base.css, css/shell.css, css/window.css, css/mission.css, js/lab.js, js/icons.js, js/store.js, js/vfs.js, js/seed.js, js/ui.js, js/wm.js, js/apps.js, js/menu.js, js/dnd.js, js/desktop.js, js/missions.js, js/boot.js`.
Deliver: stage scaling, wallpaper, menu bar with menus, Dock, desktop icons and context menus, Spotlight, window manager, alert sheets/toasts, `LAB.keys`, store, VFS with seed and persistence, bus, apps registry, dnd engine, mission engine + rail UI + welcome + phone notice, plus `LAB.clipboard` (§3.1.1), the store rules of §3.4 (frozen reset, per-domain restore, two-tab conflict, quota, notice), the pinned/drawer rail and safe resize (§2.1), performance mode (§2.10), `LAB.seed` (§3.5), the progress code (§5.4), the compatibility lint (§7) and `README.md` (what this is, how to run it, the trademark sentence). To let phase-1 builders work in parallel, CORE first lands (within its first pass) a working shell with the full `LAB.*` API surface and a placeholder app registered for each of `finder, terminal, codex, code, textedit, about` that opens an empty titled window — placeholder apps live inside `js/apps.js` under the id and are REPLACED (skipped) when the real app file calls `LAB.apps.register` with the same id (later registration wins). CORE also writes a minimal Playwright smoke script (scratchpad) proving windows, dock, dnd between two placeholder windows, vfs persistence.

**Phase 1 — in parallel after CORE's first pass.**
- **FINDER**: `js/finder.js`, `css/finder.css`. Everything in §4.1; `LAB.finder` API; Trash window; Quick Look call (uses `LAB.quicklook` if present).
- **TERMINAL**: `js/terminal.js`, `css/terminal.css`. §4.2 incl. `LAB.shell` with unit-test hook `LAB.shell.run` (pure; testable without DOM), completion, IME handling, drop target, menus, `Last login` logic via `store` domain `term`.
- **CODEX**: `js/codex.js`, `css/codex.css`. §4.4 incl. `LAB.codex` API, intents, Trust modal, seed chats, persistence domain `codex`, drop targets, `registerIntent`.
- **EDITORS**: `js/textedit.js`, `js/code.js`, `js/about.js`, `css/editors.css`. §4.3 incl. `LAB.quicklook`, `LAB.textedit`, `LAB.code`; emits `editor:*`/`code:folder`.
- **MISSIONS-WEEK3**: `js/missions-week3.js` only. §5.3 verbatim (text, hints, answers, checks, prepare, outro, free-play tips). It may only use the public APIs/events listed here. It also writes a scripted Playwright walk-through (scratchpad) that completes M1–M7 by real clicks/typing once all apps exist.

**Phase 2 — integration (orchestrator or CORE).** Run `node tools/check.mjs`; run all smoke flows (§7); fix cross-app issues by filing them to the owning builder; take screenshots at 1440×900 and 1024×640; verify no console errors; verify nothing outside `lab/mac/` changed (`git status` in the worktree shows only `lab/mac/**`); no commit, no push. The owner then tries it locally on port 8810 before anything goes live.

Definition of done per builder: the owned files exist, load without console errors in the order of §1, implement every behaviour of the cited sections, expose the listed `LAB.*` members and `data-lab` hooks, register every window-scoped listener, drop target and key handler through `win.own`, pass the compatibility lint of §7, and survive a reload (state restored) and `?reset=1`.

---

## 12. Changes after review

This revision resolves the review issues. Section references are to this file.

Missions (§5.3, §6.1)
- M2 gains `cd ..` (step 5) and `cd ~` (step 6); M3 begins with `cd ~` as its own step and a hint about reading the prompt (「Project」 vs 「~」), so a student who continues from M2 no longer gets `cd: no such file or directory: Downloads`.
- Three-layer wording rule (§5.1): text = goal, hint = pattern, answer = command; the full command appears in `text` only the first time it is used. M3 steps 2–7 and M5 steps rewritten as goals; the supplement's grey notes (week3.zip = 要搬的東西, ~ = 社區, Desktop = 中庭, Project = 家) sit in the M3 `mv` hint.
- Vocabulary aligned with the supplement: ~ = 社區, Downloads = 管理室, Desktop = 中庭, Desktop/Project = 家, `..` = 往外一層. 「你的家」 for `~` removed; a 「地圖」 disclosure in the rail and a line in the M3 intro.
- Dead ends removed: M2 step 2 accepts any successful `ls`; M1 step 4 also accepts sidebar/state; optional steps with auto-skip; `replay:'mission'` for idempotent steps; quiet nudges (full-width space, no such file or directory, 60 s wrong-folder, per-step `trap`); the false comment in M2 step 2 deleted.
- Prompt-reading step in M2 step 3; hints about switching the input method to ABC; Terminal is opened from the Dock or the menu-bar magnifier (⌘Space / Ctrl+Space demoted to undocumented extras and explained, §2.8, §6.4).
- Dock icons redrawn to differ by glyph (Terminal `>_` lower-left, Codex outline only, §2.3); missions name apps by label: 「Codex（不是 Code）」, 「Code（就是影片裡的 VS Code）」.
- Relative path made explicit in M5 step 3 and the M5 outro; M6 step 4 hint no longer gives the path (answer layer only); M6 outro explains why 「文件」.
- M6 `prepare` also removes `Project/output`; new M6 step 6 (see the file in Project); Recents hint.
- M5 step 6 split into 6 (open the folder in Code) and 7 (open the file); `cat` replaced by `ls output` (optional); new optional step 8 `mkdir charts` shows the change in Code and Finder.
- M7: a nudge when the reply is in the same chat; the 「+」 hover hint; step 3 credited by `editor:open` OR `win:focus` on a window whose `state.path` is AGENTS.md; outro mentions the three-section AGENTS.md.
- M4: `prepare` uses `removeProject(path, {chats:'remove'})` plus a rail note; steps 2–3 also pass when the project already exists or the drop happened; hint that the desktop icon stays; right-click alternative in the answer layer; outro.
- M3: new step 4 (is week3.zip still in Downloads: mv moves), the unzip step needs a standalone `week3` word in a later `ls`, the `Projet` typo trap line, extension note in step 8, prepare removes renamed zip copies.
- Minutes: M2 and M3 about 12; M2 intro says five commands and the outro explains why `mkdir`/`open` are there; M2 and M3 are tagged 補充教材 (「Week 3 補充 1」) and the rail says M4–M7 need neither.
- Wording: 「Return」 (with 「Windows 鍵盤是 Enter」 at first mention and in the welcome), 點一下/點兩下, 命名為, 檔案夾 explained; touchpad right-click hint; welcome adds 「建議先看過 Week 3 的影片」 and the shared-computer reminder; long Chinese prompts get a click-to-copy link (`[[…]]`).
- M1 gets a path-bar reading in step 4 and a new step 6 (the folder also appears in Finder's 桌面).

Engine and contracts (§3, §5.1)
- `term:run` carries `cmds` (one entry per simple command, per-command cwd/cwdAfter, post-parse args) and missions use `api.termCmd`/`api.termSeen`/`api.lsDir`, so compound lines work (§3.3).
- Events ordered by a monotonic `seq` (not time); `?now=` is an offset, not a freeze; a trimmed history tail is persisted; the engine queues events (no re-entry) and ignores `mission:*` and prepare-time events; `prepare` runs only on first start and explicit reset; `LAB.seed` + `api.ensureSeed` restore seeded files.
- `LAB.store`: frozen reset that `pagehide` cannot undo, one-shot `?reset`/`?mission` stripped from the URL, per-domain restore and `migrate`, two-tab `rev` conflict, size caps and quota handling, unavailable-storage notice, shared-PC reminder, windows deliberately not restored (§0.3, §3.4). (Superseded by §18: nothing is stored any more; the frozen reset, `rev` conflict, quota and unavailable-storage handling were removed.)
- Progress code for the teacher and for carrying progress between machines (§5.4); `noindex` until the lab is linked (§0.1).

Shell (§4.2)
- Real tokenizer; supported syntax listed; defined messages for `$(…)`, backticks, `<`, `&`, braces, history expansion and malformed operators; `session.prompt`, `session.pending`, `sleep`/`continue` effects, stdin mode; unclosed quotes and the `unzip` question handled in the renderer protocol.
- Three tiers of commands (supported / real-but-not-simulated with a lab-only line / truly absent); per-command flag rules with real `illegal option` errors; added `ls -r -t -R -d -S` and `unzip -d -l -o -q`; command-word errors for `/` words and `cd` with too many arguments.
- Output fidelity: APFS-style `ls -l` blocks, `which` path table, archive mtimes preserved on extraction, `rm` protections after glob expansion and for `.`/`..`; prompt `~` collapse compares the cwd case-sensitively.
- Columns: every width-2 character is a 2ch span, font metrics re-measured after the web font loads, one `charWidth` definition (§3.1); IME-safe input element and `LAB.ui.isImeEnter` for every Enter/Esc handler; Terminal Ctrl keys are never mapped to Cmd (plus Alt+Backspace); `LAB.clipboard` contract.

VFS, apps, shell chrome (§2, §3)
- `dot` vs `hidden` split (`ls` shows Library, Finder does not); `Map`-backed children, name validation, caps, validated `load` with per-subtree seed fallback, `LAB.vfs.create` and `newSession({vfs})`, zip entry format, `same()` false for virtual ids; Finder shows full names with extensions; Movies displays as 電影.
- Rail: pinned or overlay drawer (never resizes the stage unasked); safe stage resize rules; layers with `pointer-events:none`; `#lab-windows` own stacking context with a plain z counter; `zoomRect`.
- Drag and drop: ghost positioned in stage coordinates; `getPayload` at threshold; press-select/click-deselect split; no `preventDefault` on pointerdown; lost-pointerup detection; target resolved at pointerup; re-render paused and keyed during a drag; `canHandle` (pure) for drop `accept`; explicit default-app table with `canOpen` only ordering Open With; single `finder:open` emitter; `win:move`/`win:resize` events; `win.own` cleanup and a debug listener check.
- Performance mode, quarter-resolution wallpaper, lighter shadows (§2.10); accessibility roles, live region, focus handling and contrast tokens (§2.4, §6.5); thin overlay scrollbars.
- Codex: the chat owns an in-flight reply; `select-project` on every click; assistant `files` persisted; quotes from `rawText`; ASCII verbs match on word boundaries.
- Compatibility lint, `100vh` fallback, `-webkit-backdrop-filter`, inline favicon; `<html lang>` locked to `zh-Hant`; original Finder icon, trademark sentence in About and README; documented low-fidelity decisions (§4.2.2).

Where the review text was adapted rather than copied
- `#` is NOT a comment in the Terminal (macOS zsh has `interactive_comments` off), so the lab prints what zsh prints.
- The reviewer's M3 step 1 sentence is split into `cd ~` (step 1) and a goal-style step 2, to keep the three-layer rule.
- No `editor:reload` event: the M7 step 3 credit uses `win:focus` + `win.state.path` instead.
- The collapsed rail became an overlay drawer (a collapsed strip with step text was rejected as too narrow).

## 13. Integration pass (2026-10-04): decisions on the builders' open questions

All seven Week 3 missions were played end to end by `lab_e2e.py` (real pointer clicks and drags, real typing, an IME-style insert for Chinese). Decisions taken during that pass; they override the text above where they differ.

- **Quick Look.** The window form (a docx or pdf opened by double-click) also closes with Esc and Space (`LAB.keys.on(..., {scope:'quicklook'})` in textedit.js). Space on a Finder item shows the overlay and emits `ql:show` / `ql:hide`, not `editor:open`; no mission uses Quick Look, so nothing credits it.
- **⌘Q asks.** `LAB.apps.quit(id, {force})` now sends every window through its own `onClose`, so an edited TextEdit or Code window shows the 「要儲存…嗎？」 sheet. The first window that vetoes stops the quit and the app keeps running (⌘Q again continues). `{force:true}` closes without asking. It returns `true` when the app really quit.
- **Code menu bar.** §2.2 is authoritative: 檔案, 編輯, 檢視, 前往, 視窗, 說明 (no 執行).
- **Terminal input focus.** The Terminal's hidden textarea releases focus when another window takes over, so Finder keys (Space, Return) work right after typing in the Terminal (covered by the e2e).
- **AirDrop** in the Finder sidebar stays inert with the toast 「AirDrop 在練習版裡不能用」. The extension-change sheet keeps its one extra explanatory line (it is on the real sheet too).
- **「Last login」** shows the current window's tty (`ttys000` for the very first window with the fixed 2026-10-02 text, later windows the previous open time and the next tty).
- **Codex.** `files` in `codex:reply` also lists folders made by `make_folder`; a click on a project row while a project chat is open switches to that project's draft (still emits `codex:select-project`); a file dropped on the Codex main area inserts `@name `; the sidebar rejects files.
- **M3.** The intro already carries the map line, so M3 has no second 「地圖」 disclosure (M2 keeps it). The `mv week3.zip Projet` typo trap also covers the common case of a student who is still in Downloads (the renamed zip then sits in Downloads); `prepare` removes renamed copies in Downloads, Desktop and Project, then restores `Downloads/week3.zip`.
- **Rail.** Choosing a mission from the list collapses the list, so the steps are not pushed below the fold; a new mission starts at the top of the card and, whenever the state changes, the current step is scrolled into view.
- **About › 終端機指令** matches `LAB.shell.commands` (every listed command exists); `cd ~` is described with the same words as the missions (社區, 家目錄).

## 14. Second review round (2026-10-04): fixes after the e2e / realism / robustness / teacher review

These decisions override the text above where they differ. Each one has a check in `lab_fix.py` (scratchpad) and the old e2e still passes.

**Store (§3.4)** (superseded by §18: the store is memory-only now; the bullets below describe the removed save logic)
- Every write carries `d` (the writing document) and `t` (a tab id kept in `sessionStorage`, so it survives F5 and is not shared with other tabs). A `storage` event from this very document is ignored, and so is one from the previous page of the same tab, or from the page whose data was loaded, during the first 3 s after load: those are the old page's `visibilitychange` / `pagehide` saves, not a second tab. Only a different tab that writes makes this tab read-only. (Removed in §18 together with all saving.)
- `finalSave` writes only when something changed (`dirty`), so a reload without edits no longer bumps the revision.
- Never link students to `?reset=1`.

**Rail and layout (§2.1, §6.1)**
- Starting a mission (welcome button, list, 「下一個任務」, `?mission=`) opens the drawer when the rail is in drawer mode (`revealRail`). A click on the Mac folds it again; the strip shows a vertical 「任務卡」 label above the step counter.
- The rail mode is re-evaluated on window `resize` (a stored user choice still wins), so shrinking or zooming the browser after load gives the drawer; windows are re-clamped by the existing stage rule.
- 「全螢幕」 is a link in the rail footer (`LAB.layout.canFullscreen/toggleFullscreen`), no longer a control floating on the wallpaper.
- `stage.zoomRect` = `{x:0, y:28, w:stage.w, h:stage.h-28-84}` (edge to edge below the menu bar, down to just above the Dock).

**Look (§2)**
- The fake Mac uses `--mac-font` (`-apple-system`, `BlinkMacSystemFont`, `"PingFang TC"`, then Noto Sans TC; nothing is shipped); the rail and Terminal / Code / Codex keep their own fonts. Menu-bar titles are weight 400, only the app name is bold.
- Terminal default font size 12 px (Cmd +/- as before).
- Wallpaper: half-resolution art, 14 feather layers, grain ±1, and an original teal / green / amber palette (not Apple's blue-violet).
- Inactive traffic lights in dark windows are dark grey. A desktop icon label turns grey while a window is key (`#lab-desktop.is-key`).
- Dock: at most 6 minimized thumbnails, the rest collapse into a 「+N」 stack with a menu; a thumbnail is a small sketch of the window (its own bar colour, three lines). The menu-bar course mark is 16 px with a baseline (bars standing on a line, not a signal icon).
- The Google Fonts stylesheet loads with `media="print" onload="this.media='all'"`; every `inset:0` has `top/right/bottom/left` fallbacks.
- Finder toolbar shows four view buttons; columns and gallery are disabled with a tooltip.

**VFS (§3.5)**
- Folders macOS needs (`/`, `/Users`, `/Applications`, `~`, `~/.Trash`, Desktop, Documents, Downloads, Library, Movies, Music, Pictures, Public) cannot be trashed, removed, renamed or moved unless `by === 'system'` (`EPROTECTED`, `LAB.vfs.isProtected`). Finder, desktop and Dock show a sheet (`LAB.ui.vfsFail`). Nothing but `system` may create anything directly in `/`, `/Users` or `/Applications` (`EACCES`; also for `unzip -d /`).
- `trash` remembers where an item came from (`trashFrom`, persisted as `o`); `LAB.vfs.putBack(path)` and 「放回原處」 in the Trash window use it. `LAB.undo` (ui.js) is a small stack for Finder / desktop moves, renames and trashing: ⌘Z / Ctrl+Z and 編輯 › 還原.
- Finder search lists matches anywhere below the current folder (flat, up to 300, the trash is skipped). 前往檔案夾 with a file path shows the folder with the file selected. A newly created folder or a rename keeps the item selected without emitting `finder:select` (the student's click is what mission 1 step 6 waits for).

**Terminal (§4.2)**
- `man` prints a short real-looking page for ls, cd, pwd, mv, cp, rm, mkdir, cat, unzip, open, touch, man (and a one-line stub for other known commands); unknown names still say `No manual entry for x`. `PATH` is set; `history -c` clears; empty-string operands give `No such file or directory` for touch / cat / ls and a redirect; the `unzip` overwrite question answers a wrong reply with `error:  invalid response [ls]` and asks again. A prompt on screen emits `term:prompt` `{winId, text}` (not persisted). `exit` closes the window about 0.7 s later.

**Codex (§4.4)**
- `write_report` takes only the ASCII `…/name.md|txt` path (no space after Chinese needed) and recognises more verbs (產出, 輸出, 整理, 放, 想要, 請 …) and a bare 「報告」; `write_agents` needs a quoted rule or an add phrase (「照 AGENTS.md 寫一份報告」 is a report); `ask_rules` does not take 「建立資料夾「AGENTS.md」」; `list_paths` and `list_files` understand more ways to ask. Failed file actions say why in Chinese (`errZh`), never raw `ENOTDIR: /Users/…`.
- Persistence: an in-flight request is stored (`resume`) and answered again after the reload (`resumeReplies`, ready priority 60); the active chat (or the draft of the active project) and an unanswered Trust prompt are restored. `LAB.codex.pendingTrust()` exposes the prompt. The composer pastes from the lab clipboard. The 「Worked for Ns」 row folds the tool lines.
- Deliberately unchanged: the orphan chat's reply and step lines show the relative path (mission 6 step 3 exists to make the student ask for the full path); the Trust text keeps 「ChatGPT can read, edit, and execute…」 because that is the wording of the real dialog in the course videos (BRIEF-app.md).

**TextEdit (§4.3.1)**
- If the file changes on disk (Codex, Terminal) while the buffer has unsaved edits, ⌘S asks 「在你打開它之後，被其他程式改過了」 with 取消 / 重新讀取 / 取代.

**Missions (§5)**
- `m.needs` (array of paths): when one is missing the rail says it is gone and how to get it back (⌘Z, drag it back, 重來這個任務). Every mission declares `needs: [PROJECT]`. `ensureBase` (Desktop, Project, data, AGENTS.md) runs in the `prepare` of M1 to M6 (M7 restores AGENTS.md itself).
- Traps: M1 s5 (another folder name), M2 s3 (`cd Desktop` while not in ~), M2 s7 (`mkdir figures` in the wrong folder; `prepare` removes `~/figures`), M3 s3 (renamed or deleted zip, also in ~), M3 s5 to s8 (the `unzip` overwrite question), M3 s7 (zip moved to ~ or back to Downloads), M4 s3 (the Trust prompt vanished), M5 s1/s2, M7 s1/s2/s4 (a Codex reply written from New chat). `prepare` of M3 also removes `Downloads/week3` (what a Finder double-click leaves) and renamed zip copies in ~.
- M3: s1 is `replay:'mission'` and is also credited by a `cd` into Downloads; s3 is credited when the zip is in Project or already unzipped there; M3 has the collapsible 「地圖」 again and a shorter intro (§13's note that it has none no longer holds). M7 s2, s4 are `replay:'mission'`.
- The rail renders traps through the inline renderer; an optional step shows 「（選做）」 once and a skipped optional step shows 「–」; the 「複製」 link says 「已複製」 only when the copy really worked; the progress code ignores timestamps outside 2001 to tomorrow; the welcome sheet swallows ⌘/Ctrl shortcuts (reload and dev keys still work).
- Wording: 視窗 (not 窗口) in the lab; the Week 3 page itself still says 窗口 in two places (outside `lab/mac`).


## 15. Changes after the owner's own Mac screenshots (L2, 2026-10-04)

These supersede the matching lines above (§0.2 apple/course mark, §0.3 Terminal look and Themes, §2.2, §2.5, §4.2). References: `製作/lab-mac/ref-ui/*.png`.

- **Wallpaper.** The CC0 photo `img/wallpaper.jpg` ("Lake Tahoe, United States (Unsplash).jpg", Clara Marie, Wikimedia Commons) replaces the generated canvas art. `#lab-wall` is a `div` painted by CSS (`background-size: cover`); the layers under the photo (a soft blue tint at the top for the menu bar, then a blue gradient) are the fallback if the file fails to load. Credited in the About window and `README.md`.
- **Menu bar.** Transparent over the wallpaper (only a faint shade at the top), white text, no blur. Far left is an original apple-shaped SVG glyph (`apple-mark`, drawn in `menu.js`, not Apple's artwork); it still opens the practice menu. Right cluster: input badge (white rounded box, starts as 注, a click flips it to A), Wi-Fi, search, control centre, then the clock "10月4日週日 下午6:51" (no space between 日 and 週). No battery. Menus are exact zh-TW: Finder: 檔案 編輯 顯示方式 前往 視窗 輔助說明; 終端機: Shell 編輯 顯示方式 視窗 輔助說明; Code: 檔案 編輯 選取項目 檢視 移至 執行 終端機 視窗 說明 (several items disabled); Codex stays English.
- **Terminal.** White title bar (no hairline), leading-aligned title with a small folder icon: "an — -zsh — 80×24" (columns×rows follow the window size); body navy-grey `#232c3a`, text `#f2f2f2`, selection `#44577a`, cursor block `#8f9398`; padding 8 px; mono stack `"SF Mono", SFMono-Regular, Menlo, "JetBrains Mono", …`. The prompt and the first line are unchanged.
- **Window chrome.** Corner radius 20 px (`--mac-radius`), plain title bar 32 px (`--mac-bar-h`), traffic lights 13 px with an 11 px gap, colours sampled from the reference.
- **Desktop icon labels.** White, bold (700), soft two-layer shadow, two-line clamp.

## 16. The mission card floats as Liquid Glass (owner's request, 2026-10-04)

Supersedes the side rail in §2.1 and §6 (the behaviour and every `data-lab` hook stay; only the layout and look change).

- **Layout.** The fake Mac fills the whole page. `#lab-rail` now sits inside `#lab-screen`, after `#lab-stage`, so the card stays visible in fullscreen and its backdrop is the Mac. It is page chrome, not part of the Mac: it is not scaled with the stage, and it sits above windows (z 50) but under the menu bar, the Dock, menus and drag ghosts. Position: 12 px from the left, 10 px under the menu bar (`--lab-mb`, set by `layoutStage`); width `clamp(268px, 27vw, 340px)`.
- **Look.** `.lab-glass` (mission.css): white tint .74→.62 (muted text `--lab-ink-3` is #4a4a51 and undone steps use `--lab-ink-2` #34343a, so text keeps about 4.5:1 over the lake and over dark windows), `backdrop-filter: blur(26px) saturate(1.9) brightness(1.05)`, a 1.5 px rim that is brightest top-left and bottom-right (masked gradient in `::before`), inset top highlight and edge glow, soft drop shadow, 22 px corners. The current step sits on a lighter patch (like a selected row in a Mac list). Inside, the type and amber accent stay as before; the card always uses light tokens, even when the page is in dark mode. `html[data-perf=low]` and `prefers-reduced-transparency` get plain frosted white with no blur. No SVG displacement (refraction) filter: it only works in Chromium and is costly behind a blinking terminal.
- **Modes.** `pinned` (default at 1366 px and wider): the card stays open; 「收起」 switches to `drawer`. `drawer`: the card folds into a 188 px glass pill 「任務卡｜第 N / M 步」 (「任務卡｜選一個任務」 before a mission is chosen) (`.lab-rail-vert` keeps the step count for the tests). A click on the pill opens the card in place; a click on the Mac folds it again; 「釘住」 pins it. The card header (「收起」 / 「釘住」) is sticky and the scroll area fades at its bottom edge, so a short card still shows its controls and tells the student it scrolls. New and zoomed windows start right of the open card (also when the drawer is open and the app is opened from the keyboard) and stop above the Dock (`stage.dockTop()`). The pill's dot only changes opacity, so the pill keeps its width. Notes (nudges, 「做好了。下一步…」) are 188 px glass cards under the pill. The face change (card ↔ pill) animates once, .22 s scale-and-fade; re-renders do not replay it.
- **Windows keep clear of the card.** `stage.reserveLeft()` measures the card (pinned) or the pill (drawer) and returns the stage x just right of it. `spawnArea()` and `zoomRect()` start there, so a new or zoomed window never opens under the card. A new window wider than that room first gets narrower (not below its `minW`); if it still does not fit (drawer mode on a ~1024 px screen, e.g. Codex), it opens below the pill instead (`stage.belowCard()`), keeping the desktop icon column clear. Windows can still be dragged under the card.
- **Dock.** When the Dock reaches under the card's column (narrow screens), the open card stops 10 px above it (`--lab-card-bottom`, measured in `updateCardRoom()`, re-measured when the Dock bar resizes).
- **Welcome.** The first-run welcome is the same glass, on a light scrim; its buttons are capsules (primary dark), with the Mac's blue focus ring.
- **Tests.** The 1024×640 variant no longer expects a scaled stage (the Mac now gets the full width); it checks drawer mode and a full-width stage instead. `製作/lab-mac/tests/glass_shots.py` takes the card screenshots (1440, 1366, 1024, phone).

## 17. Second owner round (2026-10-04 evening): clearer liquid glass, dragging, connecting screen, green checks

Supersedes the "Look" bullet of §16.

- **Liquid glass.** The owner found the frosted card not real enough and not see-through enough, and pointed to lucasromerodb's liquid-glass-effect-macos (CodePen and freefrontend). `.lab-glass` now has three layers under the content:
  - `::before` is the backdrop, blurred only 3 px (4 px on the text-heavy card and the welcome). In Chromium (`html.lab-lg`, set in `<head>` from `navigator.userAgentData`) it is bent by an SVG displacement filter: fractal noise, blurred, then `feDisplacementMap`. The filters are in index.html: `#lab-lg` (scale 90) for the pill and notes, `#lab-lg-calm` (scale 70) for the card and welcome. Other browsers get a 9 px blur with no bending.
  - `::after` is the white tint plus inner edge highlights: `inset 2px 2px 1px` and `inset -1px -1px 1px 1px`.
  - The element itself only casts the soft shadow.
  - Tint: pill and notes .3, card .4, welcome .46. The card and welcome add a faint white text halo so dark text stays readable over trees.
  - `data-perf=low` and `prefers-reduced-transparency` drop the blur and bending and use a .95 tint.
- **Dragging.** The card is dragged by its title row; the pill is dragged by itself, and a click under 5 px still opens it.
  - The spot is saved in `ui.cardPos`, in page px from the top-left of `#lab-screen`. The card is kept inside the screen and re-clamped on resize and on the card↔pill switch. Dropped within 32 px of the left edge it snaps to it. Double-clicking the title row resets it (`LAB.layout.resetCardPos()`).
  - While dragging, the card lifts (scale 1.02, deeper shadow). The click that ends a drag is swallowed for 120 ms.
  - A card dragged more than 48 px away from the left edge no longer reserves a column for windows (`reserveLeft()` returns 0, `belowCard()` returns null).
- **Connecting screen** (`js/connect.js`, markup in index.html, CSS in mission.css). Every visit starts with about 2.5 s of a dark remote-desktop connecting screen. It shows an original laptop line glyph, 「正在連線到 an 的 MacBook Air」 and `MacBook-Air.local`, then a progress bar and status lines: 正在建立安全連線… → 正在驗證身分… → 正在準備遠端桌面… → 已連線. At 1.95 s it fades while the desktop under it sharpens (`html.lab-connecting #lab-stage` is blurred and dimmed until then), and it emits `connect:done`. `?connect=0` and `?welcome=0` skip it; `<head>` decides before the first paint. The tests, poster and production check use `connect=0`.
- **Wi-Fi joining.** The menu-bar Wi-Fi glyph is a dot (`wf0`) and three arcs (`wf1`–`wf3`). `.is-joining` dims them and lights them in turn from the dot outward. It plays for 2.6 s after `connect:done`, then every 4–9 minutes for 2–3.5 s (`LAB.desktop.wifiJoin(ms)`).
- **Green checks.** A ticked step shows a macOS-green circle check in the number column. A fresh tick (under 1.2 s) pops in (scale), draws its tick, and its row glows green once. The age is passed as a negative `animation-delay` (`--lab-age`), so a re-render continues the animation instead of replaying it. Done missions in the list and the 「做好了」 note also use the green check.
- **Folder icon.** Two plates only (back with tab + front), like the real one; the viewBox moved up 70 so it sits centred.
- **Tests.** `製作/lab-mac/tests/features_e2e.py` (23 checks) covers the connecting screen, Wi-Fi, dragging card and pill, green checks and the folder. `lab_e2e.py` (177) still passes.

## 18. Nothing is kept between visits (owner's request, 2026-10-04)

Owner: 「進到 mac 後，任務不要存 cache 每次都要重來」. Decision: the practice Mac keeps nothing. Every page load, a reload included, is a brand-new computer.

### 18.1 Fresh every visit

- **Seed every time.** Files, terminal history and ttys counter, Codex projects and chats, the bus tail, mission progress (current mission, free play, steps, hints) and the UI state (`ui.railMode`, `ui.welcomeSeen`, `ui.cardPos`) start from the seed on every load. The first sheet (§18.2) therefore shows on every visit (`?welcome=0` still skips it); a restore from the back/forward cache (`pageshow` with `persisted`, in `boot.js`) reloads the page, so Back and Forward also give a new computer and the first mission is the starting point. The card position and mode are not remembered either; a drag only lasts while the page stays open.
- **`js/store.js`** keeps the same surface (`register`, `get`, `set`, `markDirty`, `reset`, `notice`, `load`) but works in memory only, see §3.4. Nothing in the lab calls `localStorage.setItem`. When the script is evaluated it removes what older versions saved: `localStorage["lab-mac:v1"]`, `localStorage["lab-mac:v1:bak"]` and `sessionStorage["lab-mac:tab"]`. `sessionStorage["lab-phone-ok"]` (the choice made on the phone notice) stays.
- **Removed:** the two-tab conflict logic and `store:conflict`, the final save on `pagehide` / `visibilitychange`, the quota toast, `store.available` / `frozen` / `readOnly` / `save`, and the 「這個瀏覽器不能儲存進度」 notice. The `?reset=1` flag does nothing now except being stripped from the address.
- **「重設全部」** still restarts everything: `store.reset('all')` emits `store:reset` and reloads the page, which builds the same fresh computer a plain reload does.
- **Progress code.** 「進度代碼」 stays, and now means what was finished in THIS visit, for the teacher: 「要給老師看這次完成了哪些任務，複製這串進度代碼。」 Importing a code still works, within the visit only.
- **Texts rewritten.** First sheet note: see §18.2; card footer 「每次進來都是一台全新的電腦。重新整理或離開這一頁，這次的進度就不會留下。」; About window 「關於」 and 「進度」 tabs; the unit intro of `weeks/week03/index.html` in zh-Hant, zh-Hans, en and vi; `docs/維護說明.md`, `README.md`, `lab/mac/README.md`.
- **Tests.** `lab_e2e.py` (extras): no `lab-mac:*` key in `localStorage` after a full run; old leftovers are removed on the next load; after a reload files, AGENTS.md, Codex, mission progress and the progress code are back to the seed. `features_e2e.py`: a dropped card is back home after a reload, the welcome shows again, no `lab-mac:v1` after boot.

### 18.2 Mission sheets (owner: 「要明顯跳出任務」)

Owner's second request of the round: a mission must pop up clearly. A large glass sheet in the middle of the Mac announces each mission, and another one marks each finished mission. It replaces the old plain welcome panel (§6.2 is superseded). All of it lives in `js/missions.js` (the section "mission sheet"), `css/mission.css` ("mission sheets") and the `data-lab` hooks below.

- **Look.** The same Liquid Glass as the card: `lab-glass lab-glass-calm` (§16, §17), tint .66 (a lighter tint turned grey and hard to read over a dark Terminal window), radius 26 px, about 460 px wide, on a light scrim `rgba(0,0,0,.18)`. Light tokens like the card but a little darker for the glass (ink `#1d1d1f`, ink-3 `#3a3a40`, amber `#6b3f00`), the Mac's blue focus ring, no icons, no chips. Content, top to bottom: amber eyebrow 「第 N 個任務 · 約 M 分鐘」 (the card's wording) (plus 「 · Week 3 補充 1」 for the supplement missions, same rule as the card); the mission title at 26 px bold; the mission intro (same inline formatter as the card); a hairline and the step to begin with (「第一步」 + plain step text; 「目前這一步」 when the mission is already under way); then the buttons. `role=dialog aria-modal=true`, `aria-labelledby` the title; the page behind takes no keys while a sheet is open (`LAB.keys.modal`): every plain key is swallowed too (Space acts on the focused button; arrows, letters, Delete never reach the Mac), and Ctrl/Cmd/Alt combos are swallowed except F-keys, reload (also Shift), dev tools, zoom (`=`, `+`, `-`, `0`), find, address bar and print, which the Mac does not bind. In fullscreen the sheet is moved into the fullscreen element (and back) so it is drawn.
- **Three kinds, one function (`openSheet`).** Only one sheet exists at a time.
  1. `first` (hooks `welcome-start`, `welcome-free`; the class `lab-welcome` is kept on it): appears right after `connect:done` (so after the connecting screen), or after 「仍要繼續」 on the phone notice (`phone:continue`). It announces mission 1 and adds a muted note: 「這台 Mac 弄壞了隨時可以重來；但重新整理頁面會讓一切從頭開始，所以請不要中途重新整理。卡住了可以按任務卡上的「提示」。用 Windows 鍵盤時，Command 用 Ctrl，Return 就是 Enter。」 It announces `missions.current()` when there is one (so `?mission=<id>` is honoured), otherwise mission 1 Buttons: primary dark capsule 「開始任務」 (starts mission 1) and 「自由練習」 (free play). Focus starts on 「開始任務」; Enter = start; Esc = 自由練習; Tab stays inside the sheet.
  2. `start` (hook `msheet-start`, button 「開始任務」): shown by the UI paths that start a mission, i.e. a row of the card's mission list and the card's 「下一個任務 →」. The mission is already current (`missions.start` ran first), so the sheet is only the announcement; Enter and Esc both close it the same way. No welcome note.
  3. `done` (hooks `msheet-next`, `msheet-stay`, `msheet-close`, `msheet-check`): bus `mission:complete` (not in free play) waits 0.9 s so the last green check is seen on the card, then shows a 44 px green check (same `#2fb34f`, same pop and draw as the step checks, started a moment after the sheet appears), 「任務 N 完成」, the mission outro, and 「下一個：任務 N+1 · 標題」 with the primary 「開始下一個任務」 (starts it and flies into the card, no second sheet) and 「先留在這裡」 (Esc; Enter does the primary). The next mission offered is the next one NOT yet finished (forward only), so finishing 4 after 5 does not offer 5; with none left after it the sheet has only 「關閉」. When every mission is finished: 「Week 3 的任務全部完成」, the outro, a note that 「進度代碼」 in the card shows what was finished, and one button 「關閉」. When no unfinished mission follows but others are not done, the title stays 「任務 N 完成」 and the note says 「還有任務沒做完，可以從任務卡的「任務清單」繼續。…」. A completion sheet ignores Enter / Space (and key repeats) in its first 600 ms, because the student may still be typing the next command. The card keeps its own outro and 「下一個任務 →」 for students who stay. When the timer fires it re-checks that the mission is still current and done, and that no other sheet is open.
- **Sheets are UI, not engine.** They are opened by the click handlers (list row, `rail-next`, the sheet buttons) and by `connect:done` / `mission:complete`, never inside `missions.start`. A test or tool calling `LAB.missions.start()` therefore never gets a sheet. `LAB.missions.sheetOpen()` returns the kind of the open sheet or `null`.
- **Flying into the card (FLIP, Web Animations API).** Starting closes the sheet like this: the sheet stops being a dialog and the scrim stops taking clicks at once; in drawer mode the card is opened first (`revealRail`); the panel's rectangle and the open card's on-screen rectangle (wherever it was dragged to) are measured; the panel moves its centre onto the card's centre and scales by `min(1, card.w/panel.w, card.h/panel.h)` in 460 ms with `cubic-bezier(.25,.75,.3,1)` (ease-out), stays opaque until the last part and fades out at the end, while the scrim fades and the card is held at 30 % from the first frame (its content already shows the new mission). At 70 % of the flight, while the sheet is still fading, the card does one bump (scale 1 → 1.025 → 1, 350 ms, centre origin) and comes back to full opacity. Only transforms and opacity are animated, so nothing in the layout jumps. Closing without starting (自由練習, 先留在這裡, 關閉) is a 220 ms fade.
- **Reduced motion.** `prefers-reduced-motion: reduce`: no entrance animation, no flight, no bump, no check pop; the sheet only fades out in 160 ms.
- **Switches.** `?welcome=0` suppresses every sheet (and skips the connecting screen, as before). New `?intro=0` suppresses the `start` and `done` sheets but not the `first` one. `boot.js` sets `LAB.missions.skipWelcome` and `LAB.missions.skipIntro`. The end-to-end main flow loads `?reset=1&debug=1&connect=0&intro=0`: it clicks 「開始任務」 on the first sheet and then drives the missions through the card with no later sheet in the way.
- **Hooks.** `msheet` (the panel, with `data-kind`), `welcome-start`, `welcome-free`, `msheet-start`, `msheet-next`, `msheet-stay`, `msheet-close`, `msheet-step`, `msheet-check`, `msheet-outro`; the copy links inside a sheet use `sheet-copy` instead of `rail-copy`. Classes: `.lab-msheet-scrim`, `.lab-msheet`, `.lab-ms-*`.
- **Tests.** `lab_e2e.py` main flow uses `&intro=0` (186 checks). `features_e2e.py` (79 checks) covers: no sheet during the connecting screen and the first sheet right after `connect:done` with mission 1's title, eyebrow, first step, note and buttons; focus, Tab and swallowed shortcuts; the mid-flight transform and the bump; no sheet from `LAB.missions.start()`; the start sheet from the list and from 「下一個任務 →」 (Esc and Enter); the completion sheet after the pause with the green check, next and stay; the last-mission sheet; Esc and Enter on the first sheet; `?welcome=0` and `?intro=0`; reduced motion; the narrow-screen drawer. `sheet_shots.py` writes screenshots to `製作/lab-mac/screenshots/sheets/` (1440×900 and 1024×640: first sheet, fly-in frames at 140, 280 and 400 ms with the animations paused, start sheet, completion sheet). `製作/lab-mac/poster/make_poster.py` waits until the sheet is gone before it shoots the laptop picture.
