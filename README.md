# Learning-Analytics-Tools

Learning Analytics Tools Implementation Applications (NTNU) 課程教材網站。

網站：https://learning-analytics-tools.pages.dev/

網站放在 Cloudflare Pages，push 到 `main` 就會自動部署。GitHub Pages 在台灣只有約 50 KB/s，影片會卡，
所以不再用它當網址；它仍然開著，只負責把舊網址 https://bigmoumou.github.io/Learning-Analytics-Tools/
轉到 Cloudflare 上的同一頁（每一頁 `<head>` 最前面的轉址程式，加上 `404.html`）。

每週（Week 3 – Week 16）只有一頁：標題，接著每支影片一段（影片、片段、幾則重點），不再往下分頁。
一週通常有兩支以上的影片。網站有四種語言：繁中（預設）、简中、English、Tiếng Việt（見下面「多語系」）。

## 結構

```
index.html              課程首頁：全螢幕膠捲，片頭 + Week 3–16 各一格，點已開放的畫格進入
404.html                找不到頁面；也負責把 github.io 上不存在的舊網址轉到 Cloudflare
_redirects              Cloudflare 轉址：搬走或拿掉的舊網址轉到新的位置
assets/
  home.css, home.js     首頁的樣式和膠捲（原生 WebGL2，不用函式庫；膠捲停住時不重畫）；
                        不支援 WebGL2 時改顯示週次清單
  week.css              每週頁面和 404 的樣式（和首頁同一套風格）
  course.js             課程資料（每週標題、狀態、連結、圖片、各語言翻譯）和共用行為（主題切換、上一週／下一週）
  i18n.js               多語系：決定語言、語言選單、把頁面文字換成選的語言
  i18n-strings.js       全站共用的介面文字（四種語言）
  video.js              每週頁面共用：播放 HLS、片段按鈕、#t= 連結、一次只播一支
  vendor/               hls.js 1.6.15（Apache-2.0，授權在 hls.LICENSE.txt）
weeks/
  week03/
    index.html          Week 3 的頁面：每支影片一個 <section class="unit" id="NN-slug">
    video/
      01-report-journey/  hls/（index.m3u8、init.mp4、segNN.m4s）、poster.jpg、thumb.jpg
tools/                  不會出現在網頁上的工具（Cloudflare 也會部署，但沒有頁面連過去）
  new-video.sh          開一支新影片：製作資料夾、影片資料夾、週次頁的段落
  publish-video.sh      把做好的影片壓縮、切成 HLS，擷取封面和縮圖
  check.mjs             推上去之前的檢查
  template/             週次頁和影片段落的範本
```

做影片用的 HTML/CSS/JS、音訊和成品不放進這個 repo，放在旁邊的 `製作/`，名稱和網站上的影片資料夾一樣：

```
師大教材/
  Learning-Analytics-Tools/       這個 repo（只放要公開的東西）
  製作/
    week03/
      01-report-journey/          opus-video 專案：brief.md、source/、hf/、audio/、qa/、out/final.mp4
```

純 HTML、CSS、JavaScript，不需要建置步驟。

## 新增一支影片

```bash
tools/new-video.sh 4 01-relative-path "相對路徑的起點"
```

1. 上面這行會建立 `製作/week04/01-relative-path/`、`weeks/week04/video/01-relative-path/`，
   這週還沒有頁面時從範本建立 `weeks/week04/index.html`，並在頁面上加一段這支影片。
   slug 用「兩位數字-英文小寫」：數字是這週的第幾支，英文描述主題。
2. 在 `製作/week04/01-relative-path/` 做影片，成品放在 `out/final.mp4`。
3. 放上網站：

   ```bash
   tools/publish-video.sh "../製作/week04/01-relative-path/out/final.mp4" weeks/week04/video/01-relative-path 12
   ```

   最後的 `12` 是封面取第幾秒的畫面（可省略：已有封面時不動，沒有時取 30% 的位置）。
   影片會重新壓縮（H.264 CRF 23），每 8 秒一個關鍵影格，切成 8 秒一段的 HLS。
4. 補完週次頁裡「待填」的地方：標題、說明、片段時間（`data-t` 是秒數）、重點，以及每一處的
   简中、英文、越南文翻譯（`data-zh-hans`、`data-en`、`data-vi`）。重點寫短句就好，不要加小標題。
5. 這週第一次開放時，在 `assets/course.js` 的 `WEEKS` 加上這一週（`i18n` 三種語言都要有）：

   ```js
   4: {
     status: "ready",
     title: "這週的標題",
     summary: "一兩句話的摘要",
     href: "weeks/week04/",
     thumb: "weeks/week04/video/01-relative-path/thumb.jpg",   // 清單用的小圖（800×450）
     still: "weeks/week04/video/01-relative-path/poster.jpg",  // 膠捲畫格用的大圖（1920×1080）
     meta: "2 支影片・共 3 分鐘",                                // 首頁顯示的一行說明
     i18n: {
       "zh-Hans": { title: "…", summary: "…", meta: "2 个视频・共 3 分钟" },
       en: { title: "…", summary: "…", meta: "2 videos · 3 min" },
       vi: { title: "…", summary: "…", meta: "2 video · 3 phút" },
     },
   },
   ```

   首頁膠捲會自動把這一格從「準備中」換成影片封面，開場也會停在最新開放的一週。
6. `node tools/check.mjs`，沒有錯誤再 commit、push 到 `main`（Cloudflare Pages 約 1 分鐘更新）。

## 影片

- 網站只放 HLS，不放 mp4：Cloudflare Pages 不支援 Range 請求，mp4 放上去無法跳轉；而且同一支影片存兩份，
  14 週下來會超過 GitHub Pages 1 GB 的上限。mp4 留在 `製作/` 裡。
- 每個檔案都要小於 25 MiB（Cloudflare Pages 的上限，超過時整個部署會失敗）。`publish-video.sh` 和 `check.mjs` 都會檢查。
- 週次頁先載入 `assets/vendor/hls.light.min.js`，再載入 `assets/video.js`（範本已經寫好）。
- 連結到影片的某個時間：`weeks/week04/#t=30` 是第一支影片的 30 秒，`weeks/week04/#02-find-files&t=30` 是指定的那一支。
- 影片確定了再 commit：重新渲染過的舊版本會一直留在 git 歷史裡，讓 repo 越來越大。
- `publish-video.sh` 會自己找 ffmpeg（PATH，或 opus-video conda 環境裡的那一份）；要指定時用 `FFMPEG=...`。

## 多語系

繁中（預設）、简中、English、Tiếng Việt。右上角的語言選單由 `assets/i18n.js` 自動加上，選了會記住；
網址加 `?lang=zh-Hans`、`?lang=en`、`?lang=vi` 可以直接指定（分享連結用）。第一次來的人一律是繁中（不看瀏覽器語言）。

- 繁中直接寫在 HTML 裡（沒有 JavaScript 也看得到），其他語言這樣標：
  - 全站共用的文字（頁尾、翻頁、首頁按鈕……）：`data-ui="key"`，屬性用 `data-ui-attr="aria-label:key"`，
    文字在 `assets/i18n-strings.js`。
  - 這一頁自己的內容（標題、片段、重點）：加 `data-i18n`，翻譯直接寫在 `data-zh-hans`、`data-en`、`data-vi`
    （可以含 `<strong>`、`<code>`；引號用「“ ”」，不要用 `"`）。屬性（例如 meta description）用 `data-i18n-attr="content"`。
  - 首頁和翻頁用的週次標題、摘要、meta：`assets/course.js` 的 `WEEKS[n].i18n`。
- 每一頁的 `<head>` 要先載入 `i18n-strings.js`、`i18n.js`（不要 defer），範本已經寫好。
- 簡中會自動改用 Noto Sans SC 字型（選到時才載入）。
- 影片畫面裡的字是繁中；非繁中時，週次頁標題下會有一行說明（`video.note`）。
- `tools/check.mjs` 會檢查：每個 `data-i18n` 元素三種翻譯都有、`data-ui` 的 key 都存在、
  四種語言的介面文字一樣齊、已開放的週次在 `WEEKS` 裡有三種語言。

## 版權

Copyright © 2026 JUNHAO CHEN・版權所有。授權說明和第三方元件見 [LICENSE](LICENSE)。

每一頁都要有版權聲明（頁尾的 `Copyright © 2026 JUNHAO CHEN・版權所有`，以及 `<head>` 的
`author`、`copyright` meta），範本已經寫好；`tools/check.mjs` 會檢查。

## 本機預覽

在 repo 資料夾開一個本機伺服器，再用瀏覽器打開 http://localhost:8000/：

```bash
python -m http.server 8000
```

直接雙擊 `index.html` 也看得到，但瀏覽器的安全限制會讓首頁膠捲裡的影片封面圖和週次頁的影片顯示不出來。
