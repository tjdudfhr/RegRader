# RegRader 소개 자료

사이트의 **안내 › 시스템 소개** 탭(`docs/intro/`)에 올라간 설명 영상과 PDF의 원본이다.

- `slides/regrader-intro/index.tsx` — 11장짜리 슬라이드 ([open-slide](https://www.npmjs.com/package/@open-slide/core) 형식, 발표자 노트 포함)
- `render/` — 슬라이드를 영상(MP4) · PDF · 표지 이미지로 만드는 스크립트

숫자는 2026-10-05 데이터 기준으로 슬라이드에 적혀 있다. 레이더의 점은 그날의 개정 660건(`EV_RAW`)이다.

## 슬라이드 보기

open-slide 작업 폴더의 `slides/` 아래에 `regrader-intro` 폴더를 복사한 뒤 그 폴더에서 실행한다.

```bash
npm run dev
```

`http://localhost:5173/s/regrader-intro` 를 열고 `F` 를 누르면 발표 모드.

## 영상 · PDF 다시 만들기

슬라이드 서버를 켜 둔 상태에서 실행한다. Playwright(Chrome)와 ffmpeg 가 필요하다.

```bash
bash intro-deck/render/make.sh
```

화면을 녹화하지 않고, 시간을 1/30초씩 넘기며 프레임을 한 장씩 찍는다 (77초, 2,310프레임).
결과는 `docs/intro/regrader-intro.mp4`, `regrader-intro.pdf`, `poster.jpg` 에 덮어쓴다.
