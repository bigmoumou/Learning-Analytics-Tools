// 匯入學生作品到作品集：
//   node tools/add-works.mjs <分類代號> <學生作品資料夾> [--title "HW1"] [--week 4]
//   例：node tools/add-works.mjs hw1 "../製作/works/hw1/收到的作品"
//
// <學生作品資料夾> 裡每位學生一個資料夾或一個 .zip，名稱以學號開頭（例如 41000000A、41000000A_姓名.zip）。
// 每份作品要有 index.html；只有一個 .html 時會自動補一個 index.html 轉過去；包了一層資料夾也找得到。
//
// 會做的事：
//   1. 學號遮蔽成代號：只留前 2 碼和後 2 碼（41000000A → 41•••••0A，網址和資料夾用 41xxxxx0a）；
//      遮完和別人一樣時，多露出一碼，直到分得開。學號 → 代號的對照表存在 repo 外面
//      （../製作/works/<分類>/ids.json），完整學號不會進到這個公開的 repo。之後重新匯入同一位，代號不變。
//   2. 作品原封不動複製到 works/<分類>/<代號>/（略過 __MACOSX、.DS_Store、.git、node_modules 這類檔案）。
//   3. 檢查：單一檔案 25 MiB 以上（Cloudflare Pages 的上限，這份不匯入）、一份超過 15 MB、
//      寫死的本機路徑（C:\Users\…、file:///）、找不到的本機檔案（網站上大小寫要完全一樣）、
//      檔案裡出現完整學號（個資）、用到的外部網站。
//   4. 用無頭瀏覽器（Edge 或 Chrome）打開每份作品截圖，存成 works/<分類>/_thumbs/<代號>.jpg（640×400）。
//   5. 更新 assets/works-data.js；分類還不存在時建立它（要給 --title）和 works/<分類>/index.html。
// 跑完看一下報告，用本機伺服器打開 works/ 確認，再 node tools/check.mjs、commit、push。
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import vm from "node:vm";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MAX_FILE = 25 * 1024 * 1024;
const BIG_WORK = 15 * 1024 * 1024;
const JUNK = new Set(["__MACOSX", ".DS_Store", "Thumbs.db", "desktop.ini", ".git", "node_modules", ".vscode", ".idea"]);
const TEXT = new Set([".html", ".htm", ".css", ".js", ".mjs", ".json", ".md", ".txt", ".csv", ".svg", ".xml"]);

/* ---------- 參數 ---------- */
const usage = '用法：node tools/add-works.mjs <分類代號> <學生作品資料夾> [--title "HW1"] [--week 4]';
const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); if (i < 0) return null; const v = args[i + 1]; args.splice(i, 2); return v; };
const title = opt("--title");
const week = opt("--week");
const [slug, inputDir] = args;
if (!slug || !inputDir) { console.error(usage); process.exit(1); }
if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) { console.error(`分類代號要是英文小寫、數字和連字號，例如 class-01：${slug}`); process.exit(1); }
const input = path.resolve(inputDir);
if (!fs.existsSync(input) || !fs.statSync(input).isDirectory()) { console.error(`找不到學生作品資料夾：${input}`); process.exit(1); }

/* ---------- 讀資料 ---------- */
const dataPath = path.join(ROOT, "assets/works-data.js");
const ctx = { window: {} };
vm.runInNewContext(fs.readFileSync(dataPath, "utf8"), ctx);
const WORKS = ctx.window.WORKS || [];
let cat = WORKS.find((c) => c.slug === slug);
if (!cat) {
  if (!title) { console.error(`作品集還沒有「${slug}」這個分類，第一次匯入要加 --title "分類名稱"`); process.exit(1); }
  cat = { slug, title, i18n: { "zh-Hans": { title: "待填" }, en: { title: "待填" }, vi: { title: "待填" } }, items: [] };
  if (week) cat.week = Number(week);
  WORKS.push(cat);
  console.log(`新的分類：${slug}「${title}」（assets/works-data.js 裡的簡中、英文、越南文標題要補）`);
} else {
  if (title) cat.title = title;
  if (week) cat.week = Number(week);
}
const catDir = path.join(ROOT, "works", slug);
const privDir = process.env.WORKS_PRIVATE_DIR ? path.resolve(process.env.WORKS_PRIVATE_DIR, slug) : path.resolve(ROOT, "..", "製作", "works", slug);
const idsPath = path.join(privDir, "ids.json");
const ids = fs.existsSync(idsPath) ? JSON.parse(fs.readFileSync(idsPath, "utf8")) : {};

/* ---------- 學號 → 遮蔽後的代號 ---------- */
function mask(id, taken) {
  const up = id.toUpperCase();
  if (up.length <= 4) return { label: up, code: up.toLowerCase() };
  for (let tail = 2; tail <= up.length - 2; tail++) {
    const label = up.slice(0, 2) + "•".repeat(up.length - 2 - tail) + up.slice(-tail);
    const code = label.replace(/•/g, "x").toLowerCase();
    if (!taken.has(code)) return { label, code };
  }
  return { label: up, code: up.toLowerCase() };
}
const labelOf = (code, id) => {
  const up = id.toUpperCase();
  return [...code].map((ch, i) => (ch === "x" && up[i] !== "X" ? "•" : up[i])).join("");
};

/* ---------- 檔案工具 ---------- */
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (JUNK.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}
function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    if (JUNK.has(e.name)) continue;
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) copyDir(s, d); else fs.copyFileSync(s, d);
  }
}
// 網站上（Cloudflare）檔名大小寫要完全一樣；Windows 不分大小寫，所以一段一段比對
function existsExact(base, relPath) {
  let cur = base;
  for (const part of relPath.split("/").filter((p) => p && p !== ".")) {
    if (part === "..") { cur = path.dirname(cur); continue; }
    let names;
    try { names = fs.readdirSync(cur); } catch (e) { return false; }
    if (!names.includes(part)) return false;
    cur = path.join(cur, part);
  }
  try { const st = fs.statSync(cur); return st.isFile() || fs.existsSync(path.join(cur, "index.html")); } catch (e) { return false; }
}
// 找作品的起點：有 index.html 的那一層；包了一層資料夾就往下找
function findSite(dir) {
  const names = fs.readdirSync(dir).filter((n) => !JUNK.has(n));
  if (names.includes("index.html")) return { dir, entry: "index.html" };
  const lower = names.find((n) => n.toLowerCase() === "index.html" || n.toLowerCase() === "index.htm");
  if (lower) return { dir, entry: lower };
  const htmls = names.filter((n) => /\.html?$/i.test(n));
  const dirs = names.filter((n) => fs.statSync(path.join(dir, n)).isDirectory());
  if (!htmls.length && dirs.length === 1) return findSite(path.join(dir, dirs[0]));
  if (htmls.length === 1) return { dir, entry: htmls[0] };
  return null;
}

/* ---------- 讀進每位學生 ---------- */
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "lat-works-"));
const students = [];
const report = [];
for (const name of fs.readdirSync(input).sort()) {
  if (JUNK.has(name) || name.startsWith(".")) continue;
  const p = path.join(input, name);
  const isZip = /\.zip$/i.test(name) && fs.statSync(p).isFile();
  if (!isZip && !fs.statSync(p).isDirectory()) continue;
  const m = name.match(/^[A-Za-z0-9]+/);
  const id = m && /\d{4,}/.test(m[0]) ? m[0].toUpperCase() : null;
  if (!id) { report.push({ name, errors: ["名稱要以學號開頭（例如 41000000A 或 41000000A_姓名）"] }); continue; }
  let dir = p;
  if (isZip) {
    dir = path.join(tmpRoot, id);
    fs.mkdirSync(dir, { recursive: true });
    // Windows 用系統內建的 tar（bsdtar，會解 zip）；Git Bash 的 tar 會把 C: 當成網路位址
    const tar = process.platform === "win32" && fs.existsSync("C:/Windows/System32/tar.exe") ? "C:/Windows/System32/tar.exe" : "tar";
    const r = spawnSync(tar, ["-xf", p, "-C", dir]);
    if (r.status !== 0) { report.push({ name, id, errors: [`解壓縮失敗：${String(r.stderr || "").trim()}`] }); continue; }
  }
  if (students.some((s) => s.id === id)) { report.push({ name, id, errors: ["同一個學號出現兩次，這份略過"] }); continue; }
  const site = findSite(dir);
  if (!site) { report.push({ name, id, errors: ["找不到 index.html（也不是只有一個 .html）"] }); continue; }
  students.push({ name, id, site });
}

const taken = new Set(Object.values(ids));
for (const it of cat.items) taken.add(it.code);
fs.mkdirSync(path.join(catDir, "_thumbs"), { recursive: true });
const imported = [];
for (const s of students) {
  const r = { name: s.name, id: s.id, errors: [], warnings: [], info: [] };
  report.push(r);
  let code = ids[s.id];
  if (!code) { code = mask(s.id, taken).code; taken.add(code); }
  const label = labelOf(code, s.id);
  r.code = code; r.label = label;
  const dst = path.join(catDir, code);
  fs.rmSync(dst, { recursive: true, force: true });
  copyDir(s.site.dir, dst);
  if (s.site.entry !== "index.html") {
    const entry = s.site.entry;
    if (entry.toLowerCase() === "index.html") {
      fs.renameSync(path.join(dst, entry), path.join(dst, "index.html"));
      r.warnings.push(`首頁檔名是「${entry}」，已改成 index.html`);
    } else {
      fs.writeFileSync(path.join(dst, "index.html"), `<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=${encodeURI(entry)}"><a href="${encodeURI(entry)}">${entry}</a>\n`);
      r.warnings.push(`沒有 index.html，補了一個轉到「${entry}」`);
    }
  }
  // 檢查
  const files = walk(dst);
  let total = 0;
  const hosts = new Set();
  const missing = new Set();
  const local = new Set();
  const idHits = new Set();
  const idRe = new RegExp(s.id.replace(/[^A-Za-z0-9]/g, ""), "i");
  for (const f of files) {
    const size = fs.statSync(f).size;
    const relf = path.relative(dst, f).split(path.sep).join("/");
    total += size;
    if (size >= MAX_FILE) r.errors.push(`${relf} 有 ${(size / 1048576).toFixed(1)} MiB，超過 Cloudflare Pages 單檔 25 MiB 的上限`);
    const ext = path.extname(f).toLowerCase();
    if (!TEXT.has(ext) || size > 5 * 1024 * 1024) continue;
    const text = fs.readFileSync(f, "utf8");
    if (idRe.test(text)) idHits.add(relf);
    if (/[A-Za-z]:[\\/](?:Users|Documents|Desktop)|file:\/\/\/|\/Users\/[^/\s"']+\//i.test(text) && /\.(html?|css|m?js)$/.test(ext)) local.add(relf);
    const refs = [];
    if (/\.html?$/.test(ext)) for (const m of text.matchAll(/\s(?:href|src)\s*=\s*["']([^"']+)["']/gi)) refs.push(m[1]);
    if (ext === ".css" || /\.html?$/.test(ext)) for (const m of text.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)) refs.push(m[1]);
    for (const ref of refs) {
      const v = ref.trim();
      if (/^(https?:)?\/\//i.test(v)) { try { hosts.add(new URL(v, "https://x/").hostname); } catch (e) { /* 略過 */ } continue; }
      if (/^(data:|mailto:|tel:|javascript:|#|\{|\$)/i.test(v) || v.includes("${")) continue;
      const clean = decodeURI(v.split("#")[0].split("?")[0]);
      if (!clean || clean.startsWith("/")) { if (clean.startsWith("/")) missing.add(`${relf} → ${v}（開頭的 / 在作品集裡會指到網站根目錄）`); continue; }
      const relDir = path.dirname(relf) === "." ? "" : path.dirname(relf) + "/";
      if (!existsExact(dst, relDir + clean)) missing.add(`${relf} → ${v}`);
    }
  }
  if (total > BIG_WORK) r.warnings.push(`整份有 ${(total / 1048576).toFixed(1)} MB，偏大（圖片可以縮小）`);
  for (const f of local) r.warnings.push(`${f} 裡有寫死的本機路徑（C:\\Users\\… 或 file:///），放上網站後會找不到`);
  for (const m of missing) r.warnings.push(`找不到檔案：${m}`);
  if (idHits.size) r.warnings.push(`檔案裡出現完整學號（個資）：${[...idHits].join("、")}`);
  if (hosts.size) r.info.push(`用到外部網站：${[...hosts].join("、")}`);
  if (r.errors.length) { fs.rmSync(dst, { recursive: true, force: true }); continue; }
  ids[s.id] = code;
  const old = cat.items.find((it) => it.code === code);
  if (old) old.label = label; else cat.items.push({ code, label });
  imported.push(r);
}
// 照學號排（完整學號只在不公開的對照表裡）；對照表裡沒有的排最後
const idOf = Object.fromEntries(Object.entries(ids).map(([id, code]) => [code, id]));
cat.items.sort((a, b) => (idOf[a.code] || "~" + a.code).localeCompare(idOf[b.code] || "~" + b.code, "en", { numeric: true }));

/* ---------- 截縮圖 ---------- */
const MIME = { ".html": "text/html; charset=utf-8", ".htm": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".svg": "image/svg+xml", ".webp": "image/webp", ".ico": "image/x-icon",
  ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf", ".mp4": "video/mp4", ".webm": "video/webm", ".mp3": "audio/mpeg", ".wav": "audio/wav",
  ".txt": "text/plain; charset=utf-8", ".md": "text/plain; charset=utf-8", ".csv": "text/plain; charset=utf-8" };
function findBrowser() {
  const c = [process.env.BROWSER,
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"];
  return c.find((p) => p && fs.existsSync(p)) || null;
}
function findFfmpeg() {
  if (process.env.FFMPEG) return process.env.FFMPEG;
  if (spawnSync("ffmpeg", ["-version"]).status === 0) return "ffmpeg";
  const conda = "C:/Users/bigmoumou/anaconda3/envs/opus-video/Library/bin/ffmpeg.exe";
  return fs.existsSync(conda) ? conda : null;
}
const run = (cmd, argv, ms) => new Promise((resolve) => {
  const p = spawn(cmd, argv, { stdio: "ignore" });
  const timer = setTimeout(() => p.kill(), ms);
  p.on("exit", (code) => { clearTimeout(timer); resolve(code); });
  p.on("error", () => { clearTimeout(timer); resolve(-1); });
});
async function thumbs(list) {
  if (!list.length) return;
  const browser = findBrowser(), ffmpeg = findFfmpeg();
  if (!browser || !ffmpeg) {
    for (const r of list) r.warnings.push(`沒有截到縮圖：找不到${!browser ? "瀏覽器（用 BROWSER=... 指定 Edge 或 Chrome）" : "ffmpeg（用 FFMPEG=... 指定）"}`);
    return;
  }
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    let f = path.join(ROOT, p);
    if (!f.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html");
    if (!fs.existsSync(f)) { res.writeHead(404).end(); return; }
    res.writeHead(200, { "Content-Type": MIME[path.extname(f).toLowerCase()] || "application/octet-stream" });
    fs.createReadStream(f).pipe(res);
  });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  const port = server.address().port;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "lat-shot-"));
  for (const r of list) {
    const png = path.join(tmpRoot, `${r.code}.png`);
    const url = `http://127.0.0.1:${port}/works/${slug}/${r.code}/`;
    await run(browser, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--mute-audio", "--no-first-run", "--no-default-browser-check",
      `--user-data-dir=${profile}`, "--window-size=1280,800", "--virtual-time-budget=5000", `--screenshot=${png}`, url], 60000);
    const jpg = path.join(catDir, "_thumbs", `${r.code}.jpg`);
    if (!fs.existsSync(png)) { r.warnings.push("沒有截到縮圖（瀏覽器打不開這份作品）"); continue; }
    const code = await run(ffmpeg, ["-v", "error", "-y", "-i", png, "-vf", "scale=640:400:flags=lanczos", "-q:v", "4", jpg], 60000);
    if (code !== 0) r.warnings.push("縮圖轉檔失敗");
  }
  server.close();
  fs.rmSync(profile, { recursive: true, force: true });
}
await thumbs(imported);

/* ---------- 寫回 ---------- */
const header = `/* 作品集的資料：練習分類和每件作品。
   - 作品由 tools/add-works.mjs 匯入時自動加進來，通常不用手改；分類的標題、翻譯可以手改。
   - code 是遮蔽後的學號（網址和資料夾名稱），label 是畫面上顯示的樣子；完整學號不放進這個 repo。
   - 每件作品在 works/<分類>/<code>/，縮圖在 works/<分類>/_thumbs/<code>.jpg。 */
`;
fs.writeFileSync(dataPath, header + "window.WORKS = " + JSON.stringify(WORKS, null, 2) + ";\n");
fs.mkdirSync(privDir, { recursive: true });
fs.writeFileSync(idsPath, JSON.stringify(ids, null, 2) + "\n");
const pagePath = path.join(catDir, "index.html");
if (!fs.existsSync(pagePath)) {
  const tpl = fs.readFileSync(path.join(ROOT, "tools/template/works.html.tmpl"), "utf8");
  fs.writeFileSync(pagePath, tpl.replace(/\{\{ROOT\}\}/g, "../../").replace("{{CAT}}", ` data-cat="${slug}"`));
  console.log(`建立了 works/${slug}/index.html`);
}
fs.rmSync(tmpRoot, { recursive: true, force: true });

/* ---------- 報告 ---------- */
console.log(`\n「${cat.title}」（works/${slug}/）：這次匯入 ${imported.length} 份，分類裡共 ${cat.items.length} 份。`);
for (const r of report) {
  const head = r.code ? `${r.label}（${r.name}）` : r.name;
  if (r.errors && r.errors.length) { console.log(`✗ ${head}：沒有匯入`); r.errors.forEach((e) => console.log(`    錯誤：${e}`)); continue; }
  console.log(`✓ ${head}`);
  (r.warnings || []).forEach((w) => console.log(`    提醒：${w}`));
  (r.info || []).forEach((w) => console.log(`    說明：${w}`));
}
console.log(`\n學號對照表（不公開）：${idsPath}`);
console.log("接下來：本機開 python -m http.server 8000 看 http://localhost:8000/works/，沒問題再 node tools/check.mjs、commit、push。");
