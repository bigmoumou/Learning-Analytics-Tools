/* 作品集的資料：練習分類和每件作品。
   - 作品由 tools/add-works.mjs 匯入時自動加進來，通常不用手改；分類的標題、翻譯可以手改。
   - code 是遮蔽後的學號（網址和資料夾名稱），label 是畫面上顯示的樣子；完整學號不放進這個 repo。
   - 每件作品在 works/<分類>/<code>/，縮圖在 works/<分類>/_thumbs/<code>.jpg。
   - stars（可省略，1–3）：老師推薦的星數，手動加；頁面上有星的排在最前面，星多的在前，同星數照原本順序。重新匯入不會清掉。
   - was（可省略）：代號改過的作品留下舊代號；舊網址 ?s=舊代號 會自動換成新的（資料夾網址另由 _redirects 轉）。 */
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
        "code": "41xxxx25o",
        "label": "41••••25O"
      },
      {
        "code": "41xxxx25h",
        "label": "41••••25H",
        "stars": 1,
        "was": [
          "41xxxxx5h"
        ]
      },
      {
        "code": "41xxxx37l",
        "label": "41••••37L"
      },
      {
        "code": "41xxxx35l",
        "label": "41••••35L"
      },
      {
        "code": "41xxxx01s",
        "label": "41••••01S",
        "was": [
          "41xxxxx1s"
        ]
      },
      {
        "code": "41xxxx43o",
        "label": "41••••43O"
      },
      {
        "code": "41xxxx16h",
        "label": "41••••16H"
      },
      {
        "code": "41xxxx08l",
        "label": "41••••08L"
      },
      {
        "code": "41xxxx33l",
        "label": "41••••33L",
        "stars": 1,
        "was": [
          "41xxxxx3l"
        ]
      },
      {
        "code": "41xxxx05h",
        "label": "41••••05H"
      },
      {
        "code": "41xxxx10h",
        "label": "41••••10H"
      },
      {
        "code": "41xxxx44h",
        "label": "41••••44H",
        "stars": 1
      },
      {
        "code": "41xxxx31e",
        "label": "41••••31E"
      },
      {
        "code": "41xxx002e",
        "label": "41•••002E"
      },
      {
        "code": "41xxxx06e",
        "label": "41••••06E",
        "stars": 1
      },
      {
        "code": "41xxxx09e",
        "label": "41••••09E",
        "stars": 1
      },
      {
        "code": "41xxxx04e",
        "label": "41••••04E"
      },
      {
        "code": "41xxxx16l",
        "label": "41••••16L",
        "stars": 1
      },
      {
        "code": "41xxxx13h",
        "label": "41••••13H",
        "stars": 1
      },
      {
        "code": "41xxxx38h",
        "label": "41••••38H",
        "stars": 2
      },
      {
        "code": "41xxxx40h",
        "label": "41••••40H",
        "stars": 1
      },
      {
        "code": "41xxxx30h",
        "label": "41••••30H"
      },
      {
        "code": "41xxxx02e",
        "label": "41••••02E",
        "stars": 1,
        "was": [
          "41xxxxx2e"
        ]
      },
      {
        "code": "41xxxx28l",
        "label": "41••••28L"
      },
      {
        "code": "41xxxx09h",
        "label": "41••••09H"
      },
      {
        "code": "41xxxx15h",
        "label": "41••••15H",
        "stars": 1
      },
      {
        "code": "41xxxx29h",
        "label": "41••••29H"
      },
      {
        "code": "41xxxx02h",
        "label": "41••••02H"
      },
      {
        "code": "41xxxx33h",
        "label": "41••••33H"
      }
    ]
  }
];
