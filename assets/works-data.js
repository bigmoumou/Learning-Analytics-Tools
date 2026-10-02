/* 作品集的資料：練習分類和每件作品。
   - 作品由 tools/add-works.mjs 匯入時自動加進來，通常不用手改；分類的標題、翻譯可以手改。
   - code 是遮蔽後的學號（網址和資料夾名稱），label 是畫面上顯示的樣子；完整學號不放進這個 repo。
   - 每件作品在 works/<分類>/<code>/，縮圖在 works/<分類>/_thumbs/<code>.jpg。
   - stars（可省略，1–3）：老師推薦的星數，手動加；頁面上有星的排在最前面，星多的在前，同星數照原本順序。重新匯入不會清掉。 */
window.WORKS = [
  {
    "slug": "hw1",
    "title": "HW1",
    "week": 4,
    "i18n": {
      "zh-Hans": {
        "title": "HW1"
      },
      "en": {
        "title": "HW1"
      },
      "vi": {
        "title": "HW1"
      }
    },
    "items": [
      {
        "code": "41xxxxx5h",
        "label": "41•••••5H",
        "stars": 1
      },
      {
        "code": "41xxxxx1s",
        "label": "41•••••1S"
      },
      {
        "code": "41xxxxx2e",
        "label": "41•••••2E"
      },
      {
        "code": "41xxxx15h",
        "label": "41••••15H",
        "stars": 2
      }
    ]
  }
];
