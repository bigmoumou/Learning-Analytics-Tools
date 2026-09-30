/* ==========================================================================
   影片教學頁共用：影片以 HLS 從 Cloudflare Pages 播放
   - GitHub Pages 在台灣只有約 50 KB/s，影片會一直卡。Cloudflare Pages 會從同一個 repo
     自動部署一份（MIRROR），台北機房約 15 MB/s。
   - Cloudflare Pages 不支援 Range 請求，mp4 無法跳轉，所以影片切成 HLS 小段
     （tools/make-hls.sh 產生 hls/index.m3u8）。
   - 用法：<video data-hls="hls/index.m3u8">（相對於這一頁），<source> 放 mp4 當備援；
     先載入 hls.js，再載入這個檔案，兩者都要在頁面自己的影片程式之前。
   - 在 github.io 上改從 MIRROR 讀；在 pages.dev 或本機預覽時讀同一個網站的檔案。
   ========================================================================== */
(function () {
  "use strict";

  const MIRROR = "https://learning-analytics-tools.pages.dev/";

  function hlsUrl(vid) {
    const url = new URL(vid.dataset.hls, location.href).href;
    if (!location.hostname.endsWith("github.io")) return url;
    const root = new URL((document.body && document.body.dataset.root) || "./", location.href).href;
    return url.startsWith(root) ? MIRROR + url.slice(root.length) : url;
  }

  // HLS 播不了：拿掉 src，讓瀏覽器改用 <source> 裡的 mp4
  function fallback(vid) {
    vid.removeAttribute("src");
    vid.load();
  }

  document.querySelectorAll("video[data-hls]").forEach((vid) => {
    const src = hlsUrl(vid);
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
