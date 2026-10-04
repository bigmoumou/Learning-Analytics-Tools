# 練習用的 Mac（lab/mac）

這是「學習分析工具」課程的練習環境：一台在瀏覽器裡執行的**模擬 Mac**，讓學生練習每週的內容（Week 3：終端機、Finder，把資料夾拖進 Codex 並和它對話）。
它不是影片，是真的可以操作的假系統；沒有後端，全部在前端執行，進度只存在這個瀏覽器的 `localStorage`。

macOS 與 Finder 是 Apple Inc. 的商標，Codex 是 OpenAI 的商標。這個練習是獨立的教學模擬，與兩家公司都沒有關係。

## 外觀與素材

- 桌布是 `img/wallpaper.jpg`，用 CSS `background-size: cover` 鋪滿：「Lake Tahoe, United States (Unsplash).jpg」，Clara Marie 攝，CC0，取自 Wikimedia Commons（`https://commons.wikimedia.org/wiki/File:Lake_Tahoe,_United_States_(Unsplash).jpg`）。「關於這個練習」視窗也有同樣的署名。圖檔載入失敗時，會露出 CSS 畫的藍色漸層，不會變成黑畫面。
- 外觀對照站主自己的 Mac 截圖：選單列透明、白字、最左邊是自己畫的蘋果形圖示（不是 Apple 的圖檔），右邊是輸入法 `注`、Wi-Fi、搜尋、控制中心與日期時間；終端機視窗是白色標題列加深藍灰色內容區；視窗圓角、紅黃綠按鈕的大小與間距照 macOS Tahoe 的樣子。
- 所有圖示（Dock、桌面、選單列）都是自己畫的 SVG，只是看起來像，沒有使用 Apple、Microsoft 或 OpenAI 的圖檔。

## 怎麼開

在課程網站的根目錄用任何靜態伺服器開，例如：

```
python -m http.server 8810
```

然後開 `http://localhost:8810/lab/mac/index.html`。直接用 `file://` 開也能執行（沒有用 ES module）。

## 網址參數（測試用）

| 參數 | 作用 |
|---|---|
| `?reset=1` | 清掉進度，從起始狀態開始（一次性，網址會自動拿掉這個參數） |
| `?welcome=0` | 不顯示第一次的歡迎視窗 |
| `?mission=<id>` | 直接開始那個任務（一次性） |
| `?now=2026-10-04T10:12:00` | 把時鐘的起點移到那個時間（之後照常走） |
| `?debug=1` | 開 `LAB.debug`，在 console 記錄事件，檢查視窗關掉後有沒有留下監聽器 |
| `?perf=low\|high` | 強制低效能模式（關掉 `backdrop-filter` 等）或一般模式 |

## 結構

- `index.html`：頁面骨架（假的 Mac 畫面佔滿整頁，任務卡是浮在左上角的液態玻璃卡片）。
- `css/`：`base`（變數、版面）、`shell`（選單列、Dock、桌面、Spotlight）、`window`（視窗外框）、`mission`（液態玻璃任務卡、歡迎畫面），以及各程式自己的 CSS。
- `js/`：全部掛在一個全域 `window.LAB` 底下，不用 ES module，也不用建置。`lab.js`（工具、事件匯流排）、`store.js`（localStorage）、`vfs.js` + `seed.js`（假檔案系統）、`wm.js`（視窗）、`apps.js`、`menu.js`、`dnd.js`（拖放）、`desktop.js`（桌面、Dock、Spotlight）、`missions.js`（任務引擎與任務卡）、`boot.js`。
- 標成 `[PORTABLE]` 的檔案與 Mac 外觀無關，之後做 Windows 版時可以直接共用。

設計規格見 `DESIGN.md`。

Copyright © 2026 JUNHAO CHEN・程式碼 MIT・內容 CC BY-NC-SA 4.0
