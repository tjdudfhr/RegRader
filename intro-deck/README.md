# RegRader 소개 자료

사이트의 **안내 › 시스템 소개** 탭(`docs/intro/`)에 올라간 설명 영상과 PDF의 원본이다.

- `slides/regrader-intro/index.tsx` — 14장짜리 슬라이드 ([open-slide](https://www.npmjs.com/package/@open-slide/core) 형식, 발표자 노트 포함)
  - 1–10쪽: 시스템 소개, 11–13쪽: 사용법(실제 사이트 화면 위에서 커서 · 강조 · 확대), 14쪽: 마무리
  - `assets/use-*.jpg` 사용법 화면 (2026-10-05 데이터 시점 사이트)
- `render/` — 슬라이드를 영상(MP4) · PDF · 표지 이미지로 만드는 스크립트
  - `narration.json` 내레이션 대본 (`say` 는 음성용, `caption` 은 자막용), 합니다체
  - `voice/s01..s14.mp3` 페이지별 음성 (Microsoft 신경망 음성 `ko-KR-HyunsuMultilingualNeural`, edge-tts)
  - `music.mp3` 배경음악 (Glif · Lyria 3). 영상보다 짧으면 도입부를 건너뛰고 6초 크로스페이드로 한 번 더 잇는다
  - `capture.cjs` 사용법 화면 캡처, `mix.py` 페이지 시간 · 믹스 · 자막, `render.cjs` 프레임, `pdf.cjs` PDF, `make.sh` 전체

숫자는 2026-10-05 데이터 기준으로 슬라이드에 적혀 있다. 레이더의 점은 그날의 개정 660건(`EV_RAW`)이다.

## 슬라이드 보기

open-slide 작업 폴더의 `slides/` 아래에 `regrader-intro` 폴더를 복사한 뒤 그 폴더에서 실행한다.

```bash
npm run dev
```

`http://localhost:5173/s/regrader-intro` 를 열고 `F` 를 누르면 발표 모드.

## 음성 다시 만들기

대본(`narration.json`)을 고쳤으면 해당 페이지 음성을 다시 만든다.

```bash
pip install edge-tts
edge-tts --voice ko-KR-HyunsuMultilingualNeural --text "대본" --write-media intro-deck/render/voice/s01.mp3
```

## 영상 · PDF 다시 만들기

슬라이드 서버를 켜 둔 상태에서 실행한다. Playwright(Chrome)와 ffmpeg 가 필요하다.

```bash
bash intro-deck/render/make.sh
```

음성 길이로 페이지 시간을 정하고(`mix.py plan`), 화면을 녹화하지 않고 시간을 1/30초씩 넘기며 프레임을 한 장씩 찍는다.
음악은 목소리보다 약 14 LU 낮게 깔고 목소리가 나올 때 더 낮춘다. 전체 음량은 -16 LUFS.
결과는 `docs/intro/` 의 `regrader-intro.mp4`(자막 포함), `regrader-intro.ko.vtt`, `regrader-intro.pdf`, `poster.jpg` 에 덮어쓴다.

사용법 페이지(11–13쪽)의 화면 움직임은 슬라이드 파일의 `U1`–`U3` 에 시간(초)으로 적혀 있고, `k` 로 내레이션 길이에 맞춰 늘린다.

Playwright 가 전역에 없으면 `PLAYWRIGHT=<playwright 모듈 경로>` 를 붙여 실행한다.
