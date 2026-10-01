/* ==========================================================================
   週次頁共用：播放影片、片段按鈕、#t= 連結
   - 一支影片一個 <section class="unit" id="NN-slug">，裡面放
     <video data-hls="video/NN-slug/hls/index.m3u8"> 和片段 <ol class="chapters">（button[data-t]）。
   - 網站放在 Cloudflare Pages，它不支援 Range 請求，mp4 無法跳轉，所以影片一律切成 HLS 小段
     （tools/publish-video.sh）。hls.js 在 assets/vendor/，要在這個檔案之前載入。
   - 網址 #t=秒數 跳到第一支影片的那個時間；#NN-slug&t=秒數 跳到指定的那一支。
   ========================================================================== */
(function () {
  "use strict";

  const vids = Array.from(document.querySelectorAll("video[data-hls]"));

  function attach(vid) {
    const src = new URL(vid.dataset.hls, location.href).href;
    const Hls = window.Hls;
    if (Hls && Hls.isSupported()) {
      const hls = new Hls();
      let recovered = false;
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (!data.fatal) return;
        if (data.type === Hls.ErrorTypes.MEDIA_ERROR && !recovered) {
          recovered = true;
          hls.recoverMediaError();
          return;
        }
        hls.destroy();
        failed(vid);
      });
      hls.loadSource(src);
      hls.attachMedia(vid);
    } else if (vid.canPlayType("application/vnd.apple.mpegurl")) {
      // Safari 原生支援 HLS
      vid.addEventListener("error", () => failed(vid), { once: true });
      vid.src = src;
    } else {
      failed(vid);
    }
  }

  // 播不了時直接在畫面上說明，不讓學生對著黑畫面
  function failed(vid) {
    const box = vid.closest(".player") || vid.parentNode;
    if (box.querySelector(".video-error")) return;
    const p = document.createElement("p");
    p.className = "video-error";
    p.textContent = "影片載入失敗。請重新整理頁面；還是不行的話，換一個瀏覽器（Chrome、Edge、Safari）試試。";
    box.append(p);
  }

  function seek(vid, t, play) {
    const go = () => {
      vid.currentTime = t;
      if (play) vid.play().catch(() => {});
    };
    if (vid.readyState >= 1) go();
    else vid.addEventListener("loadedmetadata", go, { once: true });
  }

  function chapters(unit, vid) {
    const btns = Array.from(unit.querySelectorAll(".chapters button[data-t]"));
    const starts = btns.map((b) => Number(b.dataset.t));
    const mark = () => {
      let i = 0;
      starts.forEach((s, k) => { if (vid.currentTime + 0.05 >= s) i = k; });
      btns.forEach((b, k) => b.setAttribute("aria-current", k === i ? "true" : "false"));
    };
    btns.forEach((b) => b.addEventListener("click", () => seek(vid, Number(b.dataset.t), true)));
    vid.addEventListener("timeupdate", mark);
    vid.addEventListener("seeked", mark);
    mark();
  }

  vids.forEach((vid) => {
    attach(vid);
    chapters(vid.closest(".unit") || document, vid);
    // 一次只播一支
    vid.addEventListener("play", () => vids.forEach((v) => { if (v !== vid) v.pause(); }));
  });

  const m = location.hash.match(/^#(?:([\w-]+)&)?t=(\d+(?:\.\d+)?)$/);
  if (m) {
    const unit = m[1] ? document.getElementById(m[1]) : null;
    const vid = unit ? unit.querySelector("video[data-hls]") : vids[0];
    if (vid) {
      seek(vid, Number(m[2]), false);
      if (unit) unit.scrollIntoView();
    }
  }
})();
