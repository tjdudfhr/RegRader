# RegRader - 법령 모니터링 대시보드

2026년 시행 법령을 **개정 이벤트 단위**로 모니터링합니다.  
같은 법령이 한 해에 여러 번 개정되면 시행일별로 따로 집계합니다.

## 접속

- 메인: https://tjdudfhr.github.io/RegRader/
- Watch (D-30 / 복수개정 / 변경감지): https://tjdudfhr.github.io/RegRader/watch.html

## 2026-09-15 갱신 스냅샷

- 국가법령정보센터 OpenAPI 재수집
- 기본 적용법규 207개와 법령명 **완전일치** (띄어쓰기·가운데점만 정규화)
- **개정 이벤트 331건 / 법령 137개**
- 이미 시행된 개정 273건 + 앞으로 시행될 개정 58건
- 이미 한 번 이상 시행됐고, 오해 추가 개정도 남은 법령 **31개**
- 고유키: `법령명 + 시행일 + 개정유형` (중복 0)
- 207개 밖 법령 0건. 제정·폐지 없음.

분기: Q1 133 · Q2 79 · Q3 86 · Q4 33  
유형: 일부개정 194 · 타법개정 137

띄어쓰기 표기 차이로 추가된 11건: 재활용촉진법(법/시행령/시행규칙), 잔류성오염물질 관리법 시행령, 파견근로자보호법, 대리점거래공정화법.

## 데이터 원칙

1. 제목이 같아도 시행일이 다르면 **다른 이벤트**
2. 같은 날 일부개정과 타법개정이 같이 있으면 **둘 다 유지**
3. `effectiveDate <= 기준일` → 시행완료(현행), 이후 → 시행예정
4. 각 이벤트에 같은 법령의 오해 타임라인(`timeline`)을 붙임
5. 매칭 키: 공백·가운데점을 제거한 법령명. 부분일치/유사도 검색 없음

## 자동 갱신

`.github/workflows/weekly-refresh.yml`
- 매주 월요일 07:00 KST
- `scripts/refresh_laws.py`가 OpenAPI 수집 후 `docs/index.json` + `docs/m0.json`~`m7.json` 갱신
- 직전 스냅샷은 `docs/previous_index.json`으로 옮겨 Watch 변경감지에 사용
- OC는 저장소 Secrets `LAW_OC` 사용 (없으면 코드 기본값)

수동 실행: Actions → Weekly law refresh → Run workflow

## 기업별 적용법규 (RegRader Pro · `pro/`)

화면의 **기업별 적용법규** 탭. 회사 이름으로 공공데이터 · DART 를 조회해 현행 법률 전부를 적용 · 미적용으로 판정하고,
그 회사 적용법규로 이 RegRader 와 같은 분기별 · 직무별 모니터링을 만든다.

- Pro 는 법제처 · DART 를 조회하는 로컬 서버다 (국내 인터넷 PC): `cd pro && python3 server.py` → http://127.0.0.1:8787
- 판정 결과의 **RegRader로 보내기** → 이 저장소에 커밋된 `scripts/refresh_laws.py` 를 그대로 돌려 회사별 데이터를 만든다
  (결과는 `pro/out/regrader/<회사>/`, 저장소에 넣지 않는다). 보낸 회사 목록은 http://127.0.0.1:8787/rr/
- 탭은 그 PC 의 Pro 화면으로 연결만 한다. 공개 사이트가 PC 의 데이터를 읽지 않는다 (CORS 를 열지 않음)
- `pro/` 는 git subtree 다 (원본: 비공개 저장소 `tjdudfhr/regrader-pro`). 최신으로:
  `git subtree pull --prefix=pro https://github.com/tjdudfhr/regrader-pro.git main --squash`
- 처음 쓸 때: 회사 찾기 자료 준비와 OpenDART 인증키 설정 — `pro/README.md`
