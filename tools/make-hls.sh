#!/usr/bin/env bash
# 把影片教學的 mp4 切成 HLS 小段，放到同一層的 hls/（index.m3u8、init.mp4、segNN.m4s）。
# 不重新壓縮（-c copy），切點落在關鍵影格上；x264 預設每 250 格一個關鍵影格，30 fps 約 8 秒一段。
#
# 用法：tools/make-hls.sh weeks/week04/video/影片.mp4
# ffmpeg 不在 PATH 時用 FFMPEG 指定，例如
#   FFMPEG=/c/Users/bigmoumou/anaconda3/envs/opus-video/Library/bin/ffmpeg.exe tools/make-hls.sh ...
set -euo pipefail

mp4="${1:?用法：tools/make-hls.sh weeks/weekNN/video/影片.mp4}"
cd "$(dirname "$mp4")"
rm -rf hls
mkdir hls
"${FFMPEG:-ffmpeg}" -v error -y -i "$(basename "$mp4")" -c copy -f hls \
  -hls_time 8 -hls_playlist_type vod \
  -hls_segment_type fmp4 -hls_fmp4_init_filename init.mp4 \
  -hls_segment_filename "hls/seg%02d.m4s" hls/index.m3u8
ls -l hls
