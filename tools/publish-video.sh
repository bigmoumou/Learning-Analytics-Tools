#!/usr/bin/env bash
# 把做好的影片放上網站：壓成網頁用的大小，切成 HLS 小段，擷取封面和縮圖。
#
# 用法：tools/publish-video.sh <成品 mp4> <影片資料夾> [封面秒數]
#   例：tools/publish-video.sh ../製作/week04/01-relative-path/out/final.mp4 weeks/week04/video/01-relative-path 12
#
# 產生（影片資料夾裡）：
#   hls/index.m3u8、hls/init.mp4、hls/segNN.m4s   H.264 CRF 23、每 8 秒一個關鍵影格、每段 8 秒
#   poster.jpg（1920×1080）、thumb.jpg（800×450）  給了封面秒數，或原本沒有封面時才產生；預設取影片 30% 的位置
#
# 先寫到暫存資料夾，全部成功才換上去，失敗時原本的影片不會壞。
# ffmpeg：先用 FFMPEG 環境變數，再找 PATH，最後找 opus-video conda 環境裡的那一份。
set -euo pipefail

src="${1:?用法：tools/publish-video.sh <成品 mp4> <影片資料夾> [封面秒數]}"
dest="${2:?用法：tools/publish-video.sh <成品 mp4> <影片資料夾> [封面秒數]}"
poster_at="${3:-}"
[ -f "$src" ] || { echo "找不到影片：$src" >&2; exit 1; }

conda_bin="/c/Users/bigmoumou/anaconda3/envs/opus-video/Library/bin"
if [ -n "${FFMPEG:-}" ]; then ffmpeg="$FFMPEG"
elif command -v ffmpeg >/dev/null 2>&1; then ffmpeg="ffmpeg"
elif [ -x "$conda_bin/ffmpeg.exe" ]; then ffmpeg="$conda_bin/ffmpeg.exe"
else echo "找不到 ffmpeg，請用 FFMPEG=... 指定" >&2; exit 1
fi
ffprobe="${ffmpeg%ffmpeg*}ffprobe${ffmpeg##*ffmpeg}"
[ "$ffmpeg" = "ffmpeg" ] && ffprobe="ffprobe"

duration=$("$ffprobe" -v error -show_entries format=duration -of csv=p=0 "$src")
mkdir -p "$dest"
tmp="$dest/.publish-tmp"
rm -rf "$tmp"
mkdir -p "$tmp/hls"
trap 'rm -rf "$tmp"' EXIT

echo "壓縮並切段（$(printf '%.0f' "$duration") 秒）……"
"$ffmpeg" -v error -y -i "$src" \
  -c:v libx264 -preset slow -crf 23 -pix_fmt yuv420p -profile:v high \
  -force_key_frames "expr:gte(t,n_forced*8)" -sc_threshold 0 \
  -c:a aac -b:a 128k \
  -f hls -hls_time 8 -hls_playlist_type vod \
  -hls_segment_type fmp4 -hls_fmp4_init_filename init.mp4 \
  -hls_segment_filename "$tmp/hls/seg%02d.m4s" "$tmp/hls/index.m3u8"

if [ -n "$poster_at" ] || [ ! -f "$dest/poster.jpg" ]; then
  at="${poster_at:-$(awk -v d="$duration" 'BEGIN { printf "%.2f", d * 0.3 }')}"
  echo "擷取 ${at} 秒的畫面當封面……"
  "$ffmpeg" -v error -y -ss "$at" -i "$src" -frames:v 1 -vf "scale=1920:1080" -q:v 3 "$tmp/poster.jpg"
  "$ffmpeg" -v error -y -i "$tmp/poster.jpg" -vf "scale=800:450" -q:v 4 "$tmp/thumb.jpg"
fi

# 單檔不能超過 Cloudflare Pages 的 25 MiB
for f in "$tmp"/hls/* "$tmp"/*.jpg; do
  [ -f "$f" ] || continue
  if [ "$(wc -c < "$f")" -ge $((25 * 1024 * 1024)) ]; then echo "$(basename "$f") 超過 25 MiB，沒有放上去" >&2; exit 1; fi
done

rm -rf "$dest/hls"
mv "$tmp/hls" "$dest/hls"
for f in poster.jpg thumb.jpg; do [ -f "$tmp/$f" ] && mv -f "$tmp/$f" "$dest/$f"; done

secs=$(printf '%.0f' "$duration")
echo "完成：$dest"
echo "  HLS $(ls "$dest/hls" | wc -l) 個檔案，共 $(du -sh "$dest/hls" | cut -f1)"
echo "  長度 $((secs / 60)) 分 $(printf '%02d' $((secs % 60))) 秒（寫進週次頁的說明和 assets/course.js 的 meta）"
