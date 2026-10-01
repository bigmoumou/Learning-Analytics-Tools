#!/usr/bin/env bash
# 開一支新影片：建立製作資料夾、網站上的影片資料夾，並在週次頁加上這支影片的段落。
#
# 用法：tools/new-video.sh <週次> <NN-slug> <影片標題>
#   例：tools/new-video.sh 4 01-relative-path "相對路徑的起點"
#
# 會建立：
#   ../製作/weekNN/NN-slug/{source,previews,audio,qa,out,assets}   做影片用的 HTML/CSS/JS 和素材（不公開）
#   weeks/weekNN/video/NN-slug/                                    網站上的影片檔（tools/publish-video.sh 產生）
#   weeks/weekNN/index.html                                        這週還沒有頁面時，從 tools/template/week.html.tmpl 建立
# 並在週次頁的「其他週次」前面加上這支影片的段落（tools/template/video-section.html.tmpl）。
# 頁面裡標「待填」的地方要再補；node tools/check.mjs 會提醒還沒填的。
set -euo pipefail
shopt -u patsub_replacement 2>/dev/null || true  # 讓 ${var//pattern/取代} 的 & 保持原字

usage="用法：tools/new-video.sh <週次 3–16> <NN-slug，例如 01-relative-path> <影片標題>"
week="${1:?$usage}"
slug="${2:?$usage}"
title="${3:?$usage}"
[[ "$week" =~ ^[0-9]+$ ]] && [ "$week" -ge 3 ] && [ "$week" -le 16 ] || { echo "週次要是 3 到 16：$week" >&2; exit 1; }
[[ "$slug" =~ ^[0-9]{2}-[a-z0-9-]+$ ]] || { echo "slug 要是「兩位數字-英文小寫」，例如 01-relative-path：$slug" >&2; exit 1; }

repo="$(cd "$(dirname "$0")/.." && pwd)"
w2=$(printf '%02d' "$week")
num="${slug%%-*}"
page="$repo/weeks/week$w2/index.html"

work="$repo/../製作/week$w2/$slug"
mkdir -p "$work"/{source,previews,audio,qa,out,assets}
mkdir -p "$repo/weeks/week$w2/video/$slug"

if [ ! -f "$page" ]; then
  tpl=$(cat "$repo/tools/template/week.html.tmpl")
  tpl="${tpl//\{\{WEEK2\}\}/$w2}"
  tpl="${tpl//\{\{WEEK\}\}/$week}"
  printf '%s\n' "$tpl" > "$page"
  echo "建立了週次頁：weeks/week$w2/index.html"
fi

if grep -q "id=\"$slug\"" "$page"; then
  echo "週次頁已經有 $slug 的段落，沒有再加"
else
  t="${title//&/&amp;}"; t="${t//</&lt;}"; t="${t//>/&gt;}"
  section=$(cat "$repo/tools/template/video-section.html.tmpl")
  section="${section//\{\{SLUG\}\}/$slug}"
  section="${section//\{\{NUM\}\}/$num}"
  section="${section//\{\{TITLE\}\}/$t}"
  tmp="$page.section.tmp"
  printf '%s\n\n' "$section" > "$tmp"
  awk -v f="$tmp" '/<nav class="pager"/ && !done { while ((getline l < f) > 0) print l; done = 1 } { print }' "$page" > "$page.new"
  rm -f "$tmp"
  grep -q "id=\"$slug\"" "$page.new" || { rm -f "$page.new"; echo "週次頁裡找不到 <nav class=\"pager\">，沒有加段落" >&2; exit 1; }
  mv "$page.new" "$page"
  echo "週次頁加上了影片 $num 的段落：$title"
fi

cat <<EOF

接下來：
  1. 在 製作/week$w2/$slug/ 做影片（opus-video），成品放在 out/final.mp4
  2. tools/publish-video.sh "../製作/week$w2/$slug/out/final.mp4" weeks/week$w2/video/$slug [封面秒數]
  3. 補完 weeks/week$w2/index.html 裡「待填」的地方（含简中、英文、越南文翻譯）和片段時間
  4. 這週第一次開放時，在 assets/course.js 的 WEEKS 加上 $week（i18n 三種語言都要有）
  5. node tools/check.mjs，通過再 commit、push
EOF
