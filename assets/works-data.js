/* 作品集的資料：練習分類和每件作品。
   - 作品由 tools/add-works.mjs 匯入時自動加進來，通常不用手改；分類的標題、翻譯可以手改。
   - code 是遮蔽後的學號（網址和資料夾名稱），label 是畫面上顯示的樣子；完整學號不放進這個 repo。
   - 每件作品在 works/<分類>/<code>/，縮圖在 works/<分類>/_thumbs/<code>.jpg。 */
window.WORKS = [
  {
    "slug": "class-01",
    "title": "第一次課堂練習",
    "week": 3,
    "i18n": {
      "zh-Hans": {
        "title": "第一次课堂练习"
      },
      "en": {
        "title": "Class Exercise 1"
      },
      "vi": {
        "title": "Bài tập trên lớp 1"
      }
    },
    "items": []
  }
];
