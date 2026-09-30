# Learning-Analytics-Tools

Learning Analytics Tools Implementation Applications (NTNU) 課程教材網站。

網站：https://learning-analytics-tools.pages.dev/

網站放在 Cloudflare Pages，push 到 `main` 就會自動部署。GitHub Pages 在台灣只有約 50 KB/s，影片會卡，
所以不再用它當網址；它仍然開著，只負責把舊網址 https://bigmoumou.github.io/Learning-Analytics-Tools/
轉到 Cloudflare 上的同一頁（每一頁 `<head>` 最前面的轉址程式，加上 `404.html`）。

每週（Week 3 – Week 16）只有一頁：一支短影片，加上幾則重點說明，不再往下分頁。

## 結構

```
index.html              課程首頁：全螢幕膠捲，片頭 + Week 3–16 各一格，點已開放的畫格進入
404.html                找不到頁面；也負責把 github.io 上不存在的舊網址轉到 Cloudflare
assets/
  home.css, home.js     首頁的樣式和膠捲（原生 WebGL2，不用函式庫；膠捲停住時不重畫）；
                        不支援 WebGL2 時改顯示週次清單
  week.css              每週頁面和 404 的樣式（和首頁同一套風格）
  course.js             課程資料（每週標題、狀態、連結、圖片）和共用行為（主題切換、上一週／下一週）
  video.js              每週頁面共用：用 hls.js 播放 HLS，失敗時退回 mp4
tools/
  make-hls.sh           把 mp4 切成 HLS 小段
weeks/
  week03/
    index.html          Week 3 的唯一一頁：標題、影片（含片段）、5 則重點
    video/              影片檔（report-journey.mp4、hls/、poster.jpg、thumb.jpg）
_redirects              Cloudflare 轉址：舊的 Week 3 影片頁、網頁教學頁轉到週次頁
```

純 HTML、CSS、JavaScript，不需要建置步驟。

## 新增一週

1. 複製 `weeks/week03/`，改名成 `weeks/weekNN/`（例如 `week04`）。
2. 換掉 `video/` 裡的影片檔，修改 `weeks/weekNN/index.html` 的標題、一句話說明、片段時間、重點和 `data-week`。
   重點寫短句就好，不要加小標題。
   每一頁的 `<head>` 都要保留最前面那段 github.io 轉址程式；新做的頁面從 Week 3 複製過去。
3. 在 `assets/course.js` 的 `WEEKS` 加上這一週：

   ```js
   4: {
     status: "ready",
     title: "這週的標題",
     summary: "一兩句話的摘要",
     href: "weeks/week04/",
     thumb: "weeks/week04/video/thumb.jpg",   // 清單用的小圖（800×450）
     still: "weeks/week04/video/poster.jpg",  // 膠捲畫格用的大圖（1920×1080）
     meta: "影片 N 分 NN 秒・N 則重點",          // 首頁顯示的一行說明
   },
   ```

   首頁膠捲會自動把這一格從「準備中」換成影片封面，開場也會停在最新開放的一週。

4. 產生影片的 HLS 小段（見下面「影片」）。
5. commit、push 到 `main`，Cloudflare Pages 會自動更新（約 1 分鐘）。

## 影片

週次頁的 `<video>` 用 `data-hls="video/hls/index.m3u8"` 指向 HLS，由 `assets/video.js` 播放。
Cloudflare Pages 不支援 Range 請求，直接放 mp4 會無法跳轉，所以要切成小段：

```bash
tools/make-hls.sh weeks/week04/video/影片.mp4
```

- 不重新壓縮，切點在關鍵影格上；請維持 x264 預設的關鍵影格間隔（30 fps 約 8 秒一段）。
- mp4 仍然留在 `video/`，當 HLS 播不了時的備援和下載連結。
- 每個檔案都要小於 25 MiB（Cloudflare Pages 的上限，超過時整個部署會失敗）。
- 週次頁要照 Week 3 的順序載入 hls.js（cdnjs，含 integrity）和 `assets/video.js`，放在頁面自己的影片程式之前。
- 這台電腦的 ffmpeg 不在 PATH，執行時加上
  `FFMPEG=/c/Users/bigmoumou/anaconda3/envs/opus-video/Library/bin/ffmpeg.exe`。

## 本機預覽

在 repo 資料夾開一個本機伺服器，再用瀏覽器打開 http://localhost:8000/：

```bash
python -m http.server 8000
```

直接雙擊 `index.html` 也看得到，但瀏覽器的安全限制會讓首頁膠捲裡的影片封面圖顯示不出來。
