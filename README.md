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

화면의 **기업별 적용법규** 탭 → https://tjdudfhr.github.io/RegRader/pro/
회사 이름으로 공공데이터 · DART 를 조회해 현행 법률 전부를 적용 · 미적용으로 판정하고,
그 회사 적용법규로 이 RegRader 와 같은 분기별 · 직무별 모니터링을 만든다. **서버 없이 브라우저에서 돈다.**

- `docs/pro/` : 브라우저판 (Pro 화면 + 판정 엔진 코드). 엔진(파이썬)을 Pyodide 로 브라우저에서 그대로 돌린다
- `docs/pro/site/?company=<회사>` : 회사 RegRader 화면 (이 화면의 사본 + 직무 '기타'). 결과는 방문자 브라우저에만 저장
- 자료는 `pro-data` 브랜치 (기록 없이 매일 덮어쓰기, raw.githubusercontent.com 에서 받는다)
  · `lawpack.json` 법제처 자료 묶음 · `universe/` 현행 법률 전체로 돌린 RegRader 수집 · `companies/` 회사 찾기 자료(가입자 30명 이상 법인 + 상장사)
  · 매일 07:00 `scripts/auto_update.sh` 가 끝난 뒤 `scripts/pro_publish.sh` 가 만든다 (로그 `~/Library/Logs/RegRader-pro.log`)
- `pro/` 는 git subtree 다 (원본: 비공개 저장소 `tjdudfhr/regrader-pro`). 최신으로:
  `git subtree pull --prefix=pro https://github.com/tjdudfhr/regrader-pro.git main --squash` 뒤 **바로 push** (아래)
  그다음 브라우저판 화면도: `cd ~/regrader-pro && python3 -m engine.static_site web ~/RegRader-autoupdate/docs/pro`
- 주의: subtree 를 합친 커밋이 push 되기 전에 `git pull --rebase` 하면 충돌한다 (auto_update.sh 도 pull --rebase 를 쓴다)
- 서버판(DART 실시간 조회): `cd pro && python3 server.py` → http://127.0.0.1:8787 (회사 찾기 자료 · OpenDART 키 준비는 `pro/README.md`)
