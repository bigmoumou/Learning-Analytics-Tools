// Cloudflare Pages Function，只在 Cloudflare 上執行，GitHub Pages 會忽略它。
//
// Cloudflare Pages 的靜態檔案不支援 Range 請求（永遠回 200 和整個檔案），
// 瀏覽器因此無法跳到影片還沒下載到的位置（片段列表、#t= 連結都會失效）。
// 這裡替 /weeks/ 底下的 mp4 補上 206 Partial Content，其他請求原樣交給靜態檔案。

export async function onRequest({ request, next }) {
  const range = request.headers.get("Range");
  if (request.method !== "GET" || !range || !new URL(request.url).pathname.endsWith(".mp4")) {
    return next();
  }

  const res = await next();
  const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
  // 已經是 206（平台哪天支援了）、錯誤、多段或看不懂的 Range：原樣回傳
  if (res.status !== 200 || !m || (m[1] === "" && m[2] === "")) return res;

  // 靜態檔案有時以 chunked 傳回、沒有 Content-Length，這時先整個讀進來量長度（單檔上限 25 MiB）
  let size = Number(res.headers.get("Content-Length"));
  let body = res.body;
  if (!size) {
    const buf = await res.arrayBuffer();
    size = buf.byteLength;
    body = new Blob([buf]).stream();
  }
  if (!size) return new Response(null, { status: 416, headers: { "Content-Range": "bytes */0" } });

  let start, end;
  if (m[1] === "") {
    start = Math.max(0, size - Number(m[2])); // bytes=-N：最後 N 個位元組
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === "" ? size - 1 : Math.min(Number(m[2]), size - 1);
  }
  if (start >= size || start > end) {
    await body.cancel();
    return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
  }

  const headers = new Headers(res.headers);
  headers.set("Accept-Ranges", "bytes");
  headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
  return new Response(slice(body, start, end), { status: 206, headers });
}

// 從檔案串流裡只轉送第 start 到 end 個位元組（含），轉送完就停止讀取
function slice(body, start, end) {
  const { readable, writable } = new FixedLengthStream(end - start + 1);
  (async () => {
    const reader = body.getReader();
    const writer = writable.getWriter();
    let pos = 0;
    try {
      while (pos <= end) {
        const { done, value } = await reader.read();
        if (done) break;
        const a = Math.max(start - pos, 0);
        const b = Math.min(end + 1 - pos, value.length);
        if (a < b) await writer.write(value.subarray(a, b));
        pos += value.length;
      }
      await writer.close();
    } catch (err) {
      await writer.abort(err);
    } finally {
      reader.cancel().catch(() => {});
    }
  })();
  return readable;
}
