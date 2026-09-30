# Learning-Analytics-Tools

Learning Analytics Tools Implementation Applications (NTNU) 課程教材網站。

網站：https://bigmoumou.github.io/Learning-Analytics-Tools/

每週（Week 3 – Week 16）都有兩種教材：

- **影片教學**：一支短影片，先建立直覺。
- **網頁教學**：互動網頁，文字說明搭配可以動手操作的示範和小測驗。

## 結構

```
index.html              課程入口：Week 3–16 的週次卡片
assets/
  site.css              入口、每週總覽、影片頁共用的樣式
  course.js             課程資料（每週標題、狀態、連結）和共用行為
weeks/
  week03/
    index.html          Week 3 總覽：學習目標、建議順序、各 section 介紹
    lesson/             網頁教學（index.html、css/、js/）
    video/              影片教學（index.html、report-journey.mp4、poster.jpg、thumb.jpg）
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
     thumb: "weeks/week04/video/thumb.jpg",
     web: "網頁教學・約 NN 分鐘",
     video: "影片教學・N 分 NN 秒",
   },
   ```

4. commit、push 到 `main`，GitHub Pages 會自動更新（約 1 分鐘）。

影片建議先壓縮並加上 `-movflags +faststart`，讓網頁可以邊下載邊播放。單一檔案要小於 100 MB（GitHub 的上限）。

## 本機預覽

直接用瀏覽器打開 `index.html` 就可以看。
