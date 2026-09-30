/* ==========================================================================
   影片教學頁共用：影片以 HLS 播放
   - 網站放在 Cloudflare Pages，它不支援 Range 請求，mp4 無法跳轉，所以影片切成 HLS 小段
     （tools/make-hls.sh 產生 hls/index.m3u8）。
   - 用法：<video data-hls="hls/index.m3u8">（相對於這一頁），<source> 放 mp4 當備援；
     先載入 hls.js，再載入這個檔案，兩者都要在頁面自己的影片程式之前。
   ========================================================================== */
(function () {
  "use strict";

  // HLS 播不了：拿掉 src，讓瀏覽器改用 <source> 裡的 mp4
  function fallback(vid) {
    vid.removeAttribute("src");
    vid.load();
  }

  document.querySelectorAll("video[data-hls]").forEach((vid) => {
    const src = new URL(vid.dataset.hls, location.href).href;
    const Hls = window.Hls;
    if (Hls && Hls.isSupported()) {
      const hls = new Hls();
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          hls.destroy();
          fallback(vid);
        }
      });
      hls.loadSource(src);
      hls.attachMedia(vid);
    } else if (vid.canPlayType("application/vnd.apple.mpegurl")) {
      // Safari 原生支援 HLS
      vid.addEventListener("error", () => fallback(vid), { once: true });
      vid.src = src;
    }
  });
})();
