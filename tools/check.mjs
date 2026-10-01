// 推上 main 之前的檢查：node tools/check.mjs
// 有「錯誤」時結束代碼是 1，不要推；「提醒」不擋，但要看過。
//
// 檢查項目：
//   1. 每個檔案都小於 25 MiB（Cloudflare Pages 的上限，超過時整個部署會失敗）
//   2. 每個 .html 都有 github.io 轉址程式（舊網址才轉得過來）和版權聲明
//   3. HTML 裡的本機連結（href、src、poster、data-hls）都找得到檔案
//   4. HLS 播放清單（.m3u8）列出的小段都在
//   5. assets/course.js 的 WEEKS 裡的 href、thumb、still 都找得到
//   6. 每個影片資料夾（weeks/weekNN/video/NN-slug/）都有 hls/index.m3u8、poster.jpg、thumb.jpg，而且週次頁有用到
//   7. _redirects 轉去的目的地存在
//   8. 提醒：weeks/ 裡不該有 mp4（只放 HLS）、頁面裡還有「待填」、總容量接近 GitHub Pages 的 1 GB
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MAX_FILE = 25 * 1024 * 1024;
const BUDGET = 800 * 1024 * 1024;
const SKIP_DIRS = new Set([".git", "node_modules", ".wrangler"]);
const REDIRECT_MARK = 'location.hostname.endsWith("github.io")';
const COPYRIGHT = "Copyright © 2026 JUNHAO CHEN";

const errors = [];
const warnings = [];
const rel = (p) => path.relative(ROOT, p).split(path.sep).join("/");
const error = (msg) => errors.push(msg);
const warn = (msg) => warnings.push(msg);

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

// 網址 → 檔案；資料夾網址找 index.html
function resolveRef(fromFile, ref) {
  const clean = decodeURI(ref.split("#")[0].split("?")[0]);
  if (!clean) return null;
  const abs = clean.startsWith("/") ? path.join(ROOT, clean) : path.resolve(path.dirname(fromFile), clean);
  return clean.endsWith("/") ? path.join(abs, "index.html") : abs;
}
const exists = (p) => {
  try {
    const s = fs.statSync(p);
    return s.isFile() || (s.isDirectory() && fs.existsSync(path.join(p, "index.html")));
  } catch (e) {
    return false;
  }
};

const files = walk(ROOT);
const published = files.filter((f) => !rel(f).startsWith("tools/"));

// 1. 檔案大小
let total = 0;
for (const f of published) {
  const size = fs.statSync(f).size;
  total += size;
  if (size >= MAX_FILE) error(`${rel(f)} 有 ${(size / 1048576).toFixed(1)} MiB，超過 Cloudflare Pages 單檔 25 MiB 的上限`);
}

// 2、3、4. 頁面
const playlists = new Set();
const pages = published.filter((f) => f.endsWith(".html"));
for (const page of pages) {
  const html = fs.readFileSync(page, "utf8");
  if (!html.includes(REDIRECT_MARK)) error(`${rel(page)} 少了 github.io 轉址程式（從 weeks/week03/index.html 的 <head> 複製）`);
  if (!html.includes(COPYRIGHT)) error(`${rel(page)} 少了版權聲明「${COPYRIGHT}」（從 weeks/week03/index.html 的頁尾複製）`);
  if (html.includes("待填")) warn(`${rel(page)} 還有「待填」的地方`);
  for (const m of html.matchAll(/\s(href|src|poster|data-hls)="([^"]*)"/g)) {
    const ref = m[2];
    if (/^(https?:|mailto:|data:|javascript:|#)/.test(ref) || ref === "") continue;
    const target = resolveRef(page, ref);
    if (target && !exists(target)) error(`${rel(page)}：${m[1]}="${ref}" 找不到檔案`);
    if (m[1] === "data-hls" && target) playlists.add(target);
  }
}
for (const pl of playlists) {
  if (!fs.existsSync(pl)) continue;
  const text = fs.readFileSync(pl, "utf8");
  const parts = text.split(/\r?\n/).filter((l) => l && !l.startsWith("#"));
  for (const m of text.matchAll(/URI="([^"]+)"/g)) parts.push(m[1]);
  for (const part of parts) {
    if (!fs.existsSync(path.resolve(path.dirname(pl), part))) error(`${rel(pl)} 列出的 ${part} 不存在`);
  }
}

// 5. 課程資料
const course = fs.readFileSync(path.join(ROOT, "assets/course.js"), "utf8");
for (const m of course.matchAll(/\b(href|thumb|still): "([^"]+)"/g)) {
  if (!exists(path.join(ROOT, m[2]))) error(`assets/course.js 的 ${m[1]}: "${m[2]}" 找不到`);
}

// 6. 影片資料夾
const weeksDir = path.join(ROOT, "weeks");
for (const week of fs.existsSync(weeksDir) ? fs.readdirSync(weeksDir) : []) {
  const videoDir = path.join(weeksDir, week, "video");
  if (!fs.existsSync(videoDir)) continue;
  const pagePath = path.join(weeksDir, week, "index.html");
  const pageHtml = fs.existsSync(pagePath) ? fs.readFileSync(pagePath, "utf8") : "";
  for (const slug of fs.readdirSync(videoDir)) {
    const d = path.join(videoDir, slug);
    if (!fs.statSync(d).isDirectory()) continue;
    if (!/^\d{2}-[a-z0-9-]+$/.test(slug)) warn(`weeks/${week}/video/${slug}：資料夾名稱建議是「兩位數字-英文小寫」，例如 02-relative-path`);
    for (const need of ["hls/index.m3u8", "poster.jpg", "thumb.jpg"]) {
      if (!fs.existsSync(path.join(d, need))) error(`weeks/${week}/video/${slug}/ 少了 ${need}（用 tools/publish-video.sh 產生）`);
    }
    if (!pageHtml.includes(`video/${slug}/hls/index.m3u8`)) warn(`weeks/${week}/index.html 沒有用到 video/${slug}/`);
  }
}

// 7. 轉址目的地
const redirectsPath = path.join(ROOT, "_redirects");
if (fs.existsSync(redirectsPath)) {
  for (const line of fs.readFileSync(redirectsPath, "utf8").split(/\r?\n/)) {
    const cols = line.trim().split(/\s+/);
    if (!line.trim() || line.trim().startsWith("#") || cols.length < 2) continue;
    const dest = cols[1];
    if (/^https?:/.test(dest)) continue;
    const target = dest.includes(":splat") ? path.join(ROOT, dest.split(":splat")[0]) : resolveRef(path.join(ROOT, "x"), dest);
    if (dest.includes(":splat") ? !fs.existsSync(target) : !exists(target)) error(`_redirects：${cols[0]} 轉去的 ${dest} 不存在`);
  }
}

// 8. 其他提醒
for (const f of published) {
  if (rel(f).startsWith("weeks/") && f.endsWith(".mp4") && path.basename(path.dirname(f)) !== "hls") {
    warn(`${rel(f)}：mp4 不放進 repo（留在 製作/ 裡），網站只用 HLS`);
  }
}
if (total > BUDGET) warn(`網站總共 ${(total / 1048576).toFixed(0)} MB，接近 GitHub Pages 1 GB 的上限`);

console.log(`檢查了 ${published.length} 個檔案、${pages.length} 個頁面、${playlists.size} 支影片；網站總共 ${(total / 1048576).toFixed(1)} MB。`);
for (const w of warnings) console.log(`提醒：${w}`);
for (const e of errors) console.log(`錯誤：${e}`);
if (errors.length) {
  console.log(`\n有 ${errors.length} 個錯誤，先修好再推。`);
  process.exit(1);
}
console.log(warnings.length ? "\n沒有錯誤（有提醒，請看一下）。" : "\n全部通過。");
