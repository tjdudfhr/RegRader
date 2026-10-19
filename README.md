# RegRader - 법규 개정 모니터링 (포스코퓨처엠)

국가법령정보센터의 개정 가운데 **당사 적용법규에 해당하는 것만** 매일 골라 분석하고, 담당자에게 알립니다.
같은 법규가 한 해에 여러 번 개정되면 시행일별로 따로 집계합니다.

## 접속

- 메인: https://tjdudfhr.github.io/RegRader/ (화면 잠금 비밀번호)
- 기업별 적용법규 검색: 사이드바 맨 위 버튼 (https://tjdudfhr.github.io/RegRader/pro/)
- 시스템 소개 영상 · 설명자료 PDF: 사이드바 '안내 › 시스템 소개'

## 2026-10-20 스냅샷

- 적용법규 **958개** = 법령 254 · 행정규칙 669 · 자치법규 35 (포항 · 광양 · 세종 조례)
- 올해 당사 개정 **690건** (법령 446 · 행정규칙 238 · 자치법규 6) — 시행완료 662 · 30일 내 10 · 이후 18
- 벌칙 · 과태료 · 의무 변경 70건, 실질 개정 484 · 타법개정 206
- 국가법령정보센터 전체: 현행 · 올해 시행 2,777건 · 시행예정 284건

## 화면

| 메뉴 | 내용 |
|---|---|
| 종합 현황 · 분기별 · 직무별 | 시행 현황, 월별 · 분기별 · 직무별 차트, 벌칙 · 과태료 · 의무 변경, 법령 종류별 반영할 곳 |
| 적용법규 | 법령 계열(법률 → 시행령 → 시행규칙 → 행정규칙) + 지자체별 자치법규, 엑셀 |
| 법령 상세 | **실무 판단**(회사가 할 일 · 대상 · 기준 · 바뀐 숫자 · 조문 전후), 제재 조문, 개정 취지, 원문 링크 |
| 대응 현황 | 직무 담당자가 개정마다 검토 · 조치 기록 (로그인, Supabase) |
| 시행 임박 · 업데이트 내역 | D-day 순 목록, 매일 바뀐 개정 기록 |
| 보고서 · 메일 | 임원 보고 PPT · Excel, 메일로 공유(바로 보내기), 매월 1일 직무 담당자 자동 알림 |

## 매일 자동 갱신 (맥, 07:00)

launchd `com.regrader.update` → `scripts/auto_update.sh` (국가법령정보센터가 해외 IP를 막아 국내 맥에서 돈다)

1. `scripts/refresh_laws.py` — 법령 개정 수집 → 적용법규와 대조 → `docs/index.json` · `m0~m7.json` · `meta.json`
   - `admin_rules.py` 행정규칙 · `ordinances.py` 자치법규(`scripts/ordin_scope.json`) 개정을 같은 목록에 합침
   - `amend_details.py` 개정문 분석(벌칙 · 과태료 · 의무) · `amend_actions.py` 실무 판단(신구법 비교 → 할 일)
2. `scripts/site_check.py` — 올리기 전 화면 점검 (멈추면 올리지 않고 `docs/health.json`만 올림)
3. `scripts/pro_publish.sh` — 기업별 적용법규 검색 자료(`pro-data` 브랜치)
4. GitHub `daily-check.yml` (08:20) — `health.json` · 사이트 점검, 문제 있으면 메일

## 데이터 원칙

1. 제목이 같아도 시행일이 다르면 **다른 이벤트** (고유키: 법령명 + 시행일 + 개정유형)
2. 같은 날 일부개정과 타법개정이 같이 있으면 **둘 다 유지**
3. `effectiveDate < 오늘` → 시행완료, 오늘 시행분은 '30일 내'(D-DAY)로 센다
4. 매칭 키: 공백 · 가운데점을 제거한 법령명. 부분일치/유사도 검색 없음
5. 자치법규는 사업장 소재 지자체 조례 중 근거 법령이 적용법규이고 회사에 의무 · 과태료 · 부담금을 지우는 것만

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
