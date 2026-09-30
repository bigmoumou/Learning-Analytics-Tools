# Learning-Analytics-Tools

Learning Analytics Tools Implementation Applications (NTNU) 課程教材網站。

網站：https://bigmoumou.github.io/Learning-Analytics-Tools/

同一個 repo 也會自動部署到 Cloudflare Pages：https://learning-analytics-tools.pages.dev/ 。
GitHub Pages 在台灣只有約 50 KB/s，影片會卡，所以影片一律從 Cloudflare 播放（見下面「影片」）。

每週（Week 3 – Week 16）都有兩種教材：

- **影片教學**：一支短影片，先建立直覺。
- **網頁教學**：互動網頁，文字說明搭配可以動手操作的示範和小測驗。

## 結構

```
index.html              課程首頁：全螢幕膠捲，片頭 + Week 3–16 各一格，點已開放的畫格進入
assets/
  home.css, home.js     首頁的樣式和膠捲（原生 WebGL2，不用函式庫；膠捲停住時不重畫）；
                        不支援 WebGL2 時改顯示週次清單
  site.css              每週總覽、影片頁共用的樣式
  course.js             課程資料（每週標題、狀態、連結、圖片）和共用行為（主題切換、上一週／下一週）
  video.js              影片頁共用：用 hls.js 從 Cloudflare Pages 播放 HLS，失敗時退回 mp4
tools/
  make-hls.sh           把 mp4 切成 HLS 小段
weeks/
  week03/
    index.html          Week 3 總覽：學習目標、建議順序、各 section 介紹
    lesson/             網頁教學（index.html、css/、js/）
    video/              影片教學（index.html、report-journey.mp4、hls/、poster.jpg、thumb.jpg）
```

純 HTML、CSS、JavaScript，不需要建置步驟。

## 新增一週

1. 複製 `weeks/week03/`，改名成 `weeks/weekNN/`（例如 `week04`）。
2. 換掉 `lesson/`、`video/` 的內容，並修改 `weeks/weekNN/index.html` 的標題、學習目標、section 介紹和 `data-week`。
3. 在 `assets/course.js` 的 `WEEKS` 加上這一週：

   ```js
   4: {
     status: "ready",
     title: "這週的標題",
     summary: "一兩句話的摘要",
     href: "weeks/week04/",
     thumb: "weeks/week04/video/thumb.jpg",   // 清單用的小圖（800×450）
     still: "weeks/week04/video/poster.jpg",  // 膠捲畫格用的大圖（1920×1080）
     web: "網頁教學・約 NN 分鐘",
     video: "影片教學・N 分 NN 秒",
   },
   ```

   首頁膠捲會自動把這一格從「準備中」換成影片封面，開場也會停在最新開放的一週。

4. 產生影片的 HLS 小段（見下面「影片」）。
5. commit、push 到 `main`，GitHub Pages 和 Cloudflare Pages 都會自動更新（約 1 分鐘）。

## 影片

影片頁的 `<video>` 用 `data-hls="hls/index.m3u8"` 指向 HLS，`assets/video.js` 在 github.io 上會改從
Cloudflare Pages 讀同一個路徑。Cloudflare Pages 不支援 Range 請求，直接放 mp4 會無法跳轉，所以要切成小段：

```bash
tools/make-hls.sh weeks/week04/video/影片.mp4
```

- 不重新壓縮，切點在關鍵影格上；請維持 x264 預設的關鍵影格間隔（30 fps 約 8 秒一段）。
- mp4 仍然留在 `video/`，當 HLS 播不了時的備援和下載連結。
- 每個檔案都要小於 25 MiB（Cloudflare Pages 的上限，超過時整個部署會失敗）。
- 影片頁要照 Week 3 的順序載入 hls.js（cdnjs，含 integrity）和 `assets/video.js`，放在頁面自己的影片程式之前。

## 本機預覽

在 repo 資料夾開一個本機伺服器，再用瀏覽器打開 http://localhost:8000/：

```bash
python -m http.server 8000
```

直接雙擊 `index.html` 也看得到，但瀏覽器的安全限制會讓首頁膠捲裡的影片封面圖顯示不出來。
