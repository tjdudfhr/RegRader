#!/bin/bash
# 소개 영상 · PDF · 표지 이미지를 다시 만들어 docs/intro/ 에 넣는다.
# 먼저 open-slide 작업 폴더에서 슬라이드 서버를 켜 둔다 (npm run dev → http://localhost:5173).
set -euo pipefail
cd "$(dirname "$0")"

node render.cjs
ffmpeg -y -loglevel error -framerate 30 -i frames/f%05d.jpg \
  -vf "fade=t=in:st=0:d=0.5,fade=t=out:st=76.2:d=0.8,scale=in_range=pc:out_range=tv,format=yuv420p" \
  -c:v libx264 -preset slow -crf 20 -tune animation \
  -color_range tv -colorspace bt709 -color_primaries bt709 -color_trc bt709 \
  -movflags +faststart -an regrader-intro.mp4
node pdf.cjs

mkdir -p ../../docs/intro
cp regrader-intro.mp4 regrader-intro.pdf ../../docs/intro/
cp frames/f00265.jpg ../../docs/intro/poster.jpg
rm -rf frames regrader-intro.mp4 regrader-intro.pdf
echo "docs/intro/ 갱신 완료"
