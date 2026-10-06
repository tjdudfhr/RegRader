#!/bin/bash
# 소개 영상(내레이션 · 배경음악 · 자막) · PDF · 표지 이미지를 다시 만들어 docs/intro/ 에 넣는다.
# 먼저 open-slide 작업 폴더에서 슬라이드 서버를 켜 둔다 (npm run dev → http://localhost:5173).
# 입력: narration.json(대본), voice/s01..s11.mp3(음성), music.mp3(배경음악)
set -euo pipefail
cd "$(dirname "$0")"

python3 mix.py plan    # 음성 길이 → 페이지 시간(timing.json)
node render.cjs        # 프레임
python3 mix.py audio   # audio.m4a · captions.vtt

TOTAL=$(python3 -c "import json; print(json.load(open('timing.json'))['total'])")
FADE=$(python3 -c "print(round($TOTAL - 0.8, 2))")
POSTER=$(python3 -c "import json; t = json.load(open('timing.json')); print(round(t['pages'][0]['dur'] * 30) - 5)")

ffmpeg -y -loglevel error -framerate 30 -i frames/f%05d.jpg -i audio.m4a -i captions.vtt \
  -map 0:v -map 1:a -map 2:s \
  -vf "fade=t=in:st=0:d=0.5,fade=t=out:st=${FADE}:d=0.8,scale=in_range=pc:out_range=tv,format=yuv420p" \
  -c:v libx264 -preset slow -crf 20 -tune animation \
  -color_range tv -colorspace bt709 -color_primaries bt709 -color_trc bt709 \
  -c:a copy -c:s mov_text -metadata:s:s:0 language=kor -metadata:s:a:0 language=kor \
  -movflags +faststart regrader-intro.mp4
node pdf.cjs

mkdir -p ../../docs/intro
cp regrader-intro.mp4 regrader-intro.pdf ../../docs/intro/
cp captions.vtt ../../docs/intro/regrader-intro.ko.vtt
cp "frames/f$(printf %05d "$POSTER").jpg" ../../docs/intro/poster.jpg
# 시스템 소개 탭의 '총 n분 n초' 표시도 새 길이로
python3 - "$TOTAL" <<'PY'
import re, sys
sec = int(float(sys.argv[1]))  # 플레이어처럼 초 아래는 버린다
p = '../../docs/index.html'
s = open(p, encoding='utf-8').read()
s = re.sub(r'(<b class="rr-intro-len">)[^<]*(</b>)', rf'\g<1>{sec // 60}분 {sec % 60}초\g<2>', s)
open(p, 'w', encoding='utf-8').write(s)
PY
rm -rf frames regrader-intro.mp4 regrader-intro.pdf audio.m4a captions.vtt
echo "docs/intro/ 갱신 완료 (${TOTAL}s)"
