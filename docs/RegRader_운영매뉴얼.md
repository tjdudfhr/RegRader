# RegRader 운영 매뉴얼

포스코퓨처엠 법규 개정 모니터링 시스템 · 2026년 10월 20일 기준

> 운영자용 문서입니다. 공개 저장소(`docs/RegRader_운영매뉴얼.md`)에 있으므로 비밀번호 · 앱 비밀번호 · OpenDART 키 같은 비밀값은 적지 않고, 있는 곳만 적었습니다.
> 이전 판(2026년 3월, 연초 수작업 갱신 방식)은 더 이상 맞지 않습니다. 지금은 매일 자동으로 갱신됩니다.

---

## 목차

1. 한눈에 보기
2. 화면 구성
3. 적용법규 범위와 기준
4. 매일 자동으로 도는 것
5. 운영자 점검표
6. 문제가 생겼을 때
7. 자주 하는 작업
8. 연도 전환 (1월 1일)
9. 기업별 적용법규 검색 (RegRader Pro)
10. 메일 · 알림
11. 소개자료 (발표 PPT · 소개 영상) 최신화
12. 맥을 바꾸거나 오래 비울 때
13. 파일 · 위치 지도
14. 하지 말아야 할 것
15. Claude Code 에 맡길 때

---

## 1. 한눈에 보기

### 무엇을 하는 시스템인가

국가법령정보센터(law.go.kr)에 올라오는 개정 가운데 **당사 적용법규에 해당하는 것만** 매일 골라냅니다.
골라낸 개정마다 무엇이 바뀌었는지(벌칙 · 과태료 · 의무), 회사가 할 일이 무엇인지(실무 판단)를 정리해 보여 주고,
직무 담당자가 검토 · 조치를 기록하고, 메일로 알립니다.

| 항목 | 내용 |
|---|---|
| 주소 | https://tjdudfhr.github.io/RegRader/ (화면 잠금 비밀번호) |
| 기업별 적용법규 검색 | https://tjdudfhr.github.io/RegRader/pro/ (사이드바 맨 위 버튼) |
| 저장소 | GitHub `tjdudfhr/RegRader` (공개) · Pro 원본 `tjdudfhr/regrader-pro` (비공개) |
| 갱신 | 매일 07:00, 운영자 맥에서 자동 |
| 비용 | 0원 (GitHub Pages · Supabase 무료 · Google Apps Script · 공공데이터) |

### 오늘 숫자 (2026-10-20)

| 구분 | 수 |
|---|---|
| 적용법규 | **958개** = 법령 254 · 행정규칙 669 · 자치법규 35 |
| 법령 계열 | 84개 (법률 → 시행령 → 시행규칙 → 행정규칙) |
| 올해 당사 개정 | **690건** = 법령 446 · 행정규칙 238 · 자치법규 6 |
| 시행 시기 | 시행완료 662 · 30일 내 10 · 이후 18 |
| 개정 성격 | 실질 개정 484 · 타법개정 206 |
| 벌칙 · 과태료 · 의무 변경 | 70건 |
| 실무 판단 (법령 개정 446건) | 회사가 할 일 있음 68 · 기준 확인 13 · 정비뿐 365 |

### 전체 흐름

```
 [운영자 맥 · 매일 07:00]                                    [GitHub]
  국가법령정보센터 Open API ──► 수집 · 대조 · 분석 ──► 화면 점검 ──► main 브랜치 docs/ ──► GitHub Pages (사이트)
                                                     └► Pro 자료 ──► pro-data 브랜치 ──► 기업별 적용법규 검색
 [GitHub Actions · 08:20]  오늘 갱신 성공했는지 · 사이트가 멈추지 않는지 점검 → 문제 있으면 알림 메일
 [Supabase]                대응 현황(담당자 · 검토 · 조치 기록), 로그인
 [Google Apps Script]      메일 '바로 보내기' 중계, 매월 1일 담당자 알림
```

**국가법령정보센터는 해외 IP 를 막습니다.** 그래서 수집은 GitHub 서버가 아니라 국내에 있는 운영자 맥에서 돕니다.
맥이 꺼져 있으면 그날은 갱신되지 않습니다(사이트는 어제 데이터로 계속 보입니다).

---

## 2. 화면 구성

### 처음 화면 (2026-10-21)

비밀번호를 넣고 들어오면 대시보드 대신 처음 화면이 먼저 보입니다 (`docs/landing.js`).
- 왼쪽: 회사 이름 · 한 줄 소개 · [시작하기](→ 종합 현황) · [소개 영상] · 바로 가기 6개 / 오른쪽: 레이더 (올해 개정 하나하나가 점, 주황 = 벌칙 · 과태료 · 의무 변경, 초록 테 = 시행 예정)
- 브라우저 창(탭)마다 한 번만 보입니다. 왼쪽 위 로고를 누르면 다시 열립니다
- 주소에 `#watch` 같은 탭이 붙은 바로 가기 링크, 회사별 화면에서는 보이지 않습니다. 주소 뒤에 `?landing` 을 붙이면 언제든 보입니다

### 사이드바

| 메뉴 | 내용 |
|---|---|
| 기업별 적용법규 검색 (맨 위 버튼) | 회사 이름으로 적용법규를 판정 → 그 회사용 RegRader 화면 (9장) |
| **현황** · 종합 현황 | 시행 현황 카드, 월별 · 직무별 차트, 벌칙 · 과태료 · 의무 변경, 법령 종류별 반영할 곳 |
| 분기별 개정 현황 | 분기 카드 → 월별 목록, 분기 분석, 분기 보고서 PPT |
| 직무별 개정 현황 | 8개 직무별 개정, 개정 성격 · 제재 · 대응 도넛, 다가오는 시행 |
| 적용법규 | 계열 보기(법률 → 시행령 → 시행규칙 → 행정규칙) · 지자체별 자치법규 · 목록 보기, [+ 법규 추가] |
| **알림 · 기록** · 대응 현황 | 담당자가 개정마다 상태 · 영향도 · 조치 · 기한 기록 (로그인 필요) |
| 시행 임박 | D-day 순 목록, 시행 전 준비 사항 |
| 업데이트 내역 | 매일 무엇이 새로 잡혔고 빠졌는지 (`docs/changelog.json`) |
| **안내** · 시스템 소개 | 소개 영상(6분 7초) · 설명자료 PDF |

앱 바(위쪽 어두운 띠): 첫 줄은 **포스코퓨처엠**, 둘째 줄은 지금 화면 제목입니다. 오른쪽에 ✉ 메일, 보고서(PPT · 엑셀) 버튼이 있습니다.
지난 연도 자료가 보관되면 연도 선택 메뉴가 생깁니다(2027년부터).

### 법령 상세 (목록에서 법령을 누르면 오른쪽에 열림)

| 구역 | 내용 |
|---|---|
| 대응 | 대응 현황 기록 (로그인 시) |
| **실무 판단** | 회사가 할 일 · 대상 · 조건부 할 일 · 기준 확인 · 당사 비해당 · 바뀐 숫자 · 반영할 곳, 조문별 변경 전 · 후 |
| 적용 근거 | 자치법규: 근거 법령 · 지자체 · 담당부서 |
| 제재 · 의무 / 제재 조문 | 벌칙 · 과태료 · 과징금 · 행정처분 · 의무 조문 개정 |
| 개정 취지 · 주요 내용 · 개정 조항 · 신구 대조 | 법제처 제개정이유와 개정문 |
| 같은 계열 | 같은 법률의 시행령 · 시행규칙 · 행정규칙 |

**실무 판단 읽는 법**

- 회사가 할 일: 바뀐 조문에 회사(사업주 · 사업자 등)가 해야 하는 일이 새로 생기거나 달라진 것
- 당사 해당 · 조건부: 대상 조건에 숫자 기준이 있으면 당사 사실(상시 근로자 2,722명, `docs/company_facts.json`)에 대 봅니다. 위임된 기준(예: "대통령령으로 정하는 수")은 올해 시행령에서 찾아 채웁니다
- 기준 확인: 회사 의무는 아니지만 금액 · 기한 · 인원 같은 숫자나 제재가 바뀐 것
- 정비뿐: 행정기관 조문이거나 용어 · 인용 조문 정비만 있는 개정
- 근거는 모두 법제처 신구법 비교 원문입니다. 판단이 애매하면 표시하지 않습니다

### 화면에서 만드는 파일

| 파일 | 어디서 |
|---|---|
| 임원 보고 PPT (보고 요약 → 개정 현황 → 사규 · 업무 반영 포인트 → 중점 관리 → 향후 시행 → 대응 현황 → 별첨) | 보고서 버튼, 분기별 화면 |
| 개정 목록 엑셀 · 적용법규 목록 엑셀 · 분기 엑셀 · 대응 현황 엑셀 | 보고서 버튼, 각 화면 |

모두 누르는 순간 그날 데이터로 브라우저에서 만듭니다. 파일 이름에 데이터 날짜(`_YYYYMMDD`)가 붙습니다.

---

## 3. 적용법규 범위와 기준

### 기준

**적용법규 = 법이 회사를 직접 구속하고, 회사가 그 법 때문에 무언가를 해야 하는 법**
(신고 · 선임 · 설치 · 교육 · 보고 · 공시 · 납부 · 관리체계. 금지 규정이라도 회사가 통제를 갖춰야 하면 포함)

### 세 종류

| 종류 | 수 | 원본 파일 | 범위를 정하는 방법 |
|---|---|---|---|
| 법령 (법률 · 시행령 · 시행규칙) | 254 | `docs/base_laws_207.json` | 운영자가 정한 목록. 직무 8개 중 하나로 분류 |
| 행정규칙 (고시 · 훈령 · 예규 · 공고) | 669 | `scripts/admrul_scope.py` | 법령체계도로 적용법규에 공식 연결된 행정규칙 중, 당사 사업(공장 건설 → 생산 → 판매 + 회사 공통)과 무관한 것을 뺌 |
| 자치법규 (조례 · 규칙) | 35 | `scripts/ordin_scope.json` | 포항시 11 · 광양시 11 · 세종특별자치시 13. 근거 법령이 적용법규이고 회사에 의무 · 과태료 · 부담금을 지우는 것만 |

- 파일 이름 `base_laws_207.json` 은 여러 화면이 참조해서 그대로 둡니다(지금은 254개).
- 법령 직무별: 환경 76 · 안전 53 · 인사노무 43 · 재무회계 26 · 정보보호 21 · 공정거래 17 · 지식재산권 10 · 지배구조 8
- 행정규칙 중 회사 준수사항과 거리가 먼 150개는 '참고'로 계열 화면에 흐리게 접어 두고 건수에는 넣지 않습니다.
- 자치법규 검토: 6개 지자체 조례 4,683건 → 후보 → 운영자 확정 35개 (2026-10-19). 경상북도 도 조례 · 구미시 · 전남광주통합특별시 도 조례는 넣지 않기로 결정했습니다.

### 집계 원칙

1. 같은 법이라도 시행일이 다르면 **다른 개정**으로 셉니다 (고유키: 법령명 + 시행일 + 개정구분)
2. 같은 날 일부개정과 타법개정이 같이 있으면 둘 다 셉니다
3. 시행일이 오늘보다 앞이면 시행완료, 오늘 시행분은 '30일 내'(D-DAY)
4. 법령 대조는 공백 · 가운데점을 지운 법령명이 같을 때만 (부분일치 · 유사도 없음)
5. 모든 화면 · 다운로드의 숫자는 같아야 합니다

---

## 4. 매일 자동으로 도는 것

### 시간표

| 시각 | 무엇 | 어디서 | 로그 |
|---|---|---|---|
| 매일 07:00 | 법령 수집 · 분석 · 화면 점검 · 사이트 반영 | 맥 (launchd `com.regrader.update` → `scripts/auto_update.sh`) | `~/Library/Logs/RegRader-update.log` |
| 07:00 갱신 직후 | 기업별 적용법규 검색 자료 | 맥 (`scripts/pro_publish.sh`) | `~/Library/Logs/RegRader-pro.log` |
| 매일 08:20 | 오늘 갱신 성공 여부 · 공개 사이트 점검 | GitHub Actions `daily-check.yml` | GitHub Actions 화면 |
| 10분마다 | 적용법규 추가 요청 처리 | 맥 (launchd `com.regrader.requests` → `scripts/process_requests.sh`) | `~/Library/Logs/RegRader-requests.log` |
| 매월 1일 08:00 | 직무 담당자 알림 메일 (다음 달 시행분) | Google Apps Script `monthlyNotify` | Apps Script 실행 기록 |

맥이 잠자기 상태였다면 깨어날 때 07:00 작업이 실행됩니다. 전원이 꺼져 있었다면 그날은 건너뜁니다.

### 07:00 갱신 단계 (`auto_update.sh`)

1. 다른 작업과 겹치지 않게 잠금(`/tmp/regrader.lock`)을 잡고 GitHub 최신본을 받습니다
2. `scripts/refresh_laws.py` (실패하면 1분 뒤 다시, 최대 3번)
   - 국가법령정보센터에서 올해 시행 법령을 받아 적용법규와 대조 → `docs/m0~m7.json` · `index.json` · `meta.json`
   - `law_families.py` 법령 계열 (적용법규가 바뀌었거나 30일이 지났을 때만)
   - `admin_rules.py` 행정규칙 개정 · `ordinances.py` 자치법규 개정 → 같은 목록에 합침
   - `amend_details.py` 개정문 분석 (벌칙 · 과태료 · 과징금 · 처분 · 의무 · 조문 신설 · 삭제)
   - `amend_actions.py` 실무 판단 (신구법 비교 → 할 일 · 대상 · 바뀐 숫자) → `amend_actions.json` · `oan/`
   - 업데이트 내역 기록 (`changelog.json`)
3. `scripts/site_check.py` 화면 점검: 크롬으로 오늘 데이터를 넣은 사이트를 열어 멈추지 않는지 확인
   - 멈추면 오늘 데이터를 버리고 올리지 않습니다 (사이트는 어제 데이터 그대로)
4. `docs/health.json` 에 결과(날짜 · 시각 · 성공 여부 · 단계 · 이유 · 건수)를 쓰고 GitHub 에 올립니다
5. `scripts/pro_publish.sh` 기업별 적용법규 검색 자료 → `pro-data` 브랜치 (실패해도 1~4는 그대로 유지)

분석 결과는 개정마다 한 번만 만들고 쌓아 둡니다. 법령 본문은 맥의 `~/Library/Caches/RegRader/` 에 보관합니다(약 2.2GB, 지워도 다시 받습니다).

### 08:20 점검 (`daily-check.yml` → `scripts/daily_watch.py`)

다음 중 하나라도 해당하면 GitHub 이 저장소 주인에게 **실패 알림 메일**을 보냅니다.

- `health.json` 날짜가 오늘이 아님 (맥이 꺼져 있었거나 07:00 작업이 안 돔)
- 오늘 갱신이 실패함 (법제처 무응답 · 화면 점검 실패)
- 기업별 검색 자료 갱신이 실패함
- 공개 사이트가 데이터를 불러오지 못하거나 멈춤

한국어 알림 메일을 따로 받으려면 저장소 비밀값 `RR_MAIL_USER` · `RR_MAIL_PASS`(Gmail 앱 비밀번호) · `RR_MAIL_TO` 를 운영자가 직접 넣습니다(지금은 넣지 않았고, GitHub 기본 실패 메일로 알림을 받습니다).
알림이 오는지 시험: GitHub → Actions → 'RegRader 매일 점검' → Run workflow → '알림 메일 시험' 체크.

---

## 5. 운영자 점검표

### 평소

| 언제 | 할 일 |
|---|---|
| 아침 | 알림 메일이 없으면 할 일 없음. 사이트 사이드바 아래 '매일 07:00 자동 수집', 업데이트 내역에 오늘 날짜가 있는지 정도만 |
| 매주 | 업데이트 내역에서 새로 잡힌 개정 훑어보기 · 대응 현황 미검토 건 확인 |
| 매월 1일 | 담당자 알림 메일이 나갔는지 (총괄에게 전체 요약 한 통이 옵니다) |
| 분기 | 분기 보고서 PPT · 엑셀 · 적용법규 추가 · 정리 검토 · (선택) 기업별 검색용 공공데이터 새로 받기 |
| 1월 1일 | 8장 연도 전환 확인 |

### 알림 메일이 왔을 때

1. `docs/health.json` 의 이유를 봅니다 (사이트 주소 뒤에 `health.json` 을 붙여 열어도 됩니다)
2. 아래 6장 표에서 원인을 찾아 조치합니다
3. 대부분은 **갱신을 한 번 더 돌리면** 해결됩니다

```bash
launchctl kickstart gui/$(id -u)/com.regrader.update
```

(07:00 작업과 똑같이 돕니다. 진행 상황은 `tail -f ~/Library/Logs/RegRader-update.log`, 10~20분 걸립니다)

---

## 6. 문제가 생겼을 때

| 증상 | 원인 | 조치 |
|---|---|---|
| 알림: 오늘 갱신 기록 없음 | 07:00에 맥이 꺼져 있었음 | 맥을 켜고 위 `kickstart` 명령 |
| 알림: 오늘 갱신 기록 없음 (맥은 켜져 있었음) | 저장소에 커밋하지 않은 수정이 있어 갱신 첫 단계(`git pull`)가 멈춤 | `cd ~/RegRader-autoupdate && git status` → 고친 파일을 커밋하거나 되돌린 뒤 `kickstart`. 로그 마지막 줄에 "unstaged changes" |
| 알림: 법령 수집 실패 | 법제처(law.go.kr) 응답 지연 · 점검 | 한두 시간 뒤 `kickstart`. 사이트는 어제 데이터로 정상 |
| 알림: 화면 점검 실패 | 오늘 데이터 중 한 건이 화면을 멈추게 함 (2026-10-17 사례) | 데이터는 올라가지 않아 사이트는 안전. 코드 수정 필요 → Claude Code 에 `/tmp/regrader_check.log` 와 함께 요청 |
| 알림: Pro 자료 실패 | 법제처 응답 지연 (대부분) | `kickstart` 로 전체 재실행. 로그 `~/Library/Logs/RegRader-pro.log` |
| 사이트가 예전 화면 | 브라우저가 화면 파일을 최대 10분 보관 | 잠금 화면 스크립트가 새 화면을 감지해 한 번 새로 엽니다. 그래도 같으면 ⌘+Shift+R |
| 적용법규 화면에 "⚠ 법령명 확인 필요 N개" | 법제처에서 법령 이름이 바뀌었거나 폐지됨 | 7.2 참고 |
| [+ 법규 추가] 요청이 반영 안 됨 | 맥 꺼짐 · 요청자가 저장소 쓰기 권한 없음 · 법령명을 못 찾음 | GitHub Issue 의 댓글에 이유가 남습니다. 로그 `~/Library/Logs/RegRader-requests.log` |
| 메일 '바로 보내기' 실패 | 로그인 안 함 · 하루 100명 한도 · 구글 일시 오류 | 대응 현황에 로그인 후 다시. 'Unexpected token <' 류는 일시 오류이니 받은편지함부터 확인 (중복 발송 주의) |
| 대응 현황 로그인 안 됨 | members 에 없는 이메일 · 메일 링크 만료 | 총괄이 담당자 관리에서 등록, 비밀번호 로그인 사용 (7.5) |
| 월간 알림 미발송 | Apps Script 권한 · Supabase 통로 오류 | 총괄에게 실패 메일이 갑니다. Apps Script 편집기에서 `previewMonthly` 실행해 원인 확인 |
| 갱신이 계속 "잠금을 얻지 못함" | 비정상 종료로 남은 잠금 | 60분 지나면 자동 정리. 급하면 `rmdir /tmp/regrader.lock` |

### 로그 보는 법

```bash
tail -40 ~/Library/Logs/RegRader-update.log      # 매일 갱신
tail -40 ~/Library/Logs/RegRader-pro.log         # 기업별 검색 자료
tail -40 /tmp/regrader_refresh.log               # 마지막 수집 상세
tail -5  /tmp/regrader_check.log                 # 마지막 화면 점검
cat ~/RegRader-autoupdate/docs/health.json       # 오늘 결과
```

---

## 7. 자주 하는 작업

### 7.1 적용법규 추가 (법령)

**화면에서** (권장): 적용법규 → [+ 법규 추가] → 법령명 · 직무 입력 (시행령 · 시행규칙도 함께) → GitHub 요청 화면에서 Submit
→ 10분 안에 맥이 법제처에서 정식 명칭을 확인해 `base_laws_207.json` 에 넣고 올해 개정을 수집합니다.

- GitHub 에 로그인한, 저장소 쓰기 권한이 있는 사람의 요청만 받습니다
- 약칭(예: 중대재해처벌법)도 찾아 줍니다. 못 찾거나 후보가 여럿이면 요청 댓글에 후보를 남깁니다
- 새로 들어온 법의 개정은 업데이트 내역에 '적용법규 추가'로 따로 기록됩니다 (신규 개정과 섞이지 않음)
- 새 법률 계열이면 적용법규 분석의 '사업 단계별' 분류(`docs/registry-analytics.js` 의 `STAGE_OF`)에도 넣어야 정확합니다 (없으면 직무로 '회사 공통' 처리)

### 7.2 적용법규 빼기 · 이름이 바뀐 법

화면 버튼은 없습니다. `docs/base_laws_207.json` 에서 고쳐 커밋한 뒤, 업데이트 내역에 이유가 남도록 환경변수를 붙여 갱신을 한 번 돌립니다
(갱신 스크립트가 수집 · 화면 점검 · 올리기까지 합니다).

```bash
cd ~/RegRader-autoupdate
git add docs/base_laws_207.json && git commit -m "적용법규: ○○법 이름 변경"
# 이름이 바뀐 법
RR_BASE_RENAMED='[{"from":"옛 이름","to":"새 이름","category":"환경"}]' bash scripts/auto_update.sh
# 뺀 법 (폐지 등)
RR_BASE_REMOVED='[{"title":"법령명","category":"환경","reason":"폐지"}]' bash scripts/auto_update.sh
```

시행령 · 시행규칙도 같이 바뀌었는지 확인합니다.

### 7.3 행정규칙 빼기 · 되살리기

`scripts/admrul_scope.py`

- `EXCLUDE` (행정규칙ID → 사유 코드): 뺀 것 · `KEEP`: 남긴 것 · `RULES`: 앞으로 새로 연결되는 행정규칙에 쓰는 이름 규칙
- `PROMOTE`: '참고'로 접힐 이름이지만 당사 사업장 지역이라 적용법규로 올린 것

```bash
cd ~/RegRader-autoupdate
/usr/bin/python3 scripts/admrul_scope.py --apply       # 후보 · 계열 목록에 바로 반영 (네트워크 없이)
git add scripts/admrul_scope.py docs/admrul_candidates.json docs/admrul_index.json && git commit -m "행정규칙 범위: ○○ 제외"
bash scripts/auto_update.sh                            # 개정 목록 · 건수 반영
# 되살린 것이 있으면 앞에 붙여서: RR_SCOPE_RESTORED='[행정규칙ID,...]' bash scripts/auto_update.sh  ('적용 범위 조정'으로 기록)
```

뺀 행정규칙의 개정은 '삭제'가 아니라 업데이트 내역에 '적용 범위 조정'으로 기록됩니다.

### 7.4 자치법규(조례) 추가 · 빼기

`scripts/ordin_scope.json` 의 `items` 에 한 줄씩 있습니다: `id`(자치법규ID) · `name` · `org`(지자체) · `kind`(조례/규칙) · `basis`(근거 법령) · `job`(직무) · `why`(넣은 이유).

- 고친 뒤 **바로 커밋**합니다(`git add scripts/ordin_scope.json && git commit -m "…"`). 다음 07:00 갱신에 반영되고, 바로 보려면 `kickstart`
- 새로 넣은 조례는 업데이트 내역에 '자치법규 편입'으로 기록됩니다
- 다른 지자체로 넓힐 때 쓰는 기관 코드: 포항시 5020000 · 세종 5690000 · 경상북도 6470000 · 구미시 5080000, 광양시는 기관명 '전남광주통합특별시 광양시'로 찾습니다
- 사업장이 생기거나 없어지면 그 지자체 조례를 다시 검토합니다

### 7.5 담당자 관리 (대응 현황)

- 대응 현황 → 담당자 관리 (총괄만 보임): 이름 · 이메일 · 직무 등록, 직무별 지정, 총괄 지정
- 역할: 총괄(admin)은 전체, 담당자(member)는 자기 직무 개정만 고칠 수 있습니다. 바꾼 기록은 자동으로 남고 지울 수 없습니다
- 로그인: 비밀번호(기본) 또는 메일 링크. Supabase 무료 메일은 잘 안 갈 수 있어서, 담당자 계정은
  Supabase 대시보드 → Authentication → Users → Add user (임시 비밀번호 · Auto Confirm)로 만들어 주는 것이 확실합니다
- 같은 담당자 목록이 메일 창의 '직무 담당자 불러오기'와 매월 알림 받는 사람으로 쓰입니다
- 대응 상태: 미검토 → 검토중 → 조치필요 → 조치완료 · 해당없음, 영향도 상 · 중 · 하

### 7.6 화면 잠금 비밀번호 바꾸기

비밀번호 원문은 어디에도 적지 않고 SHA-256 해시만 `docs/gate.js` 의 `HASH` 에 둡니다.

```bash
read -s P; printf '%s' "$P" | shasum -a 256; unset P     # 새 비밀번호 입력(화면에 안 보임) → 해시 출력
```

1. 나온 64자리 값을 `docs/gate.js` 의 `HASH` 에 넣고, `index.html` · `watch.html` · `history.html` 의 `gate.js?v=` 값을 올립니다
2. 커밋 → 기업별 화면 사본 다시 만들기(`docs/pro/site/gate.js` 도 바뀌어야 함) → 올리기 (7.9)
3. 이미 들어와 있던 브라우저도 다음 접속 때 새 비밀번호를 묻습니다

> 화면 잠금일 뿐입니다. 공개 저장소의 자료(json)와 코드는 주소를 알면 받을 수 있습니다. 내부 자료(대응 상태 · 담당자 이메일)는 저장소에 넣지 않고 Supabase 에만 둡니다.

### 7.7 메일 중계 · 월간 알림 코드 바꾸기

`scripts/mail_relay.gs` 를 고쳤으면 Google Apps Script 에도 붙여 넣어야 반영됩니다.

1. script.google.com → RegRader 메일 프로젝트 → 코드 전부 바꿔 붙여 넣기 → 저장
2. 배포 → 배포 관리 → 수정(연필) → 버전 '새 버전' → 배포 (웹 앱 주소는 그대로)
3. 확인: 편집기에서 `previewMonthly` 실행 → 다음 1일에 나갈 메일이 운영자에게만 옵니다

> 마지막 반영: 2026-10-20 (자치법규 원문 링크 `ordinInfoP.do?ordinSeq=`). 비밀값 · 매월 예약은 코드를 바꿔 넣어도 그대로라 `setupMonthly` 를 다시 돌릴 필요는 없습니다.

### 7.8 당사 사실 고치기 (실무 판단 기준)

`docs/company_facts.json` 의 `headcount`(상시 근로자 수, 지금 2,722명 · 국민연금 가입자 기준)를 고치면
"상시 근로자 N명 이상" 같은 대상 조건 판정이 바뀝니다. 고친 뒤 `scripts/amend_actions.py` 의 `VERSION` 을 1 올리고 두 파일을 커밋하면 다음 갱신 때 전체를 다시 판정합니다.

### 7.9 화면 코드를 고친 뒤 올리기

```bash
cd ~/RegRader-autoupdate
# 1) 고친 파일의 ?v= 값을 index.html (watch · history 도 해당하면) 에서 올린다 → 브라우저가 새 파일을 받는다
/usr/bin/python3 scripts/site_check.py --dir docs        # 2) 화면 점검: '화면 정상' 이어야 한다
git add <고친 파일> && git commit -m "..."                 # 3) 커밋 (아래 두 파일은 넣지 않는다)
cd ~/regrader-pro && python3 -m engine.static_site web ~/RegRader-autoupdate/docs/pro   # 4) 기업별 화면 사본 다시 만들기
cd ~/RegRader-autoupdate && git add docs/pro && git commit -m "회사 화면 사본 갱신"
git fetch -q origin && git merge-base --is-ancestor origin/main HEAD && git push -q origin HEAD:main   # 5) 올리기
```

- 4)는 회사 화면에도 같은 변경이 있어야 할 때만 (사본은 커밋된 RegRader 를 기준으로 만듭니다)
- GitHub Pages 반영까지 1~2분

---

## 8. 연도 전환 (1월 1일)

자동입니다. 해가 바뀐 뒤 첫 갱신(1월 1일 07:00)에서

- 작년 데이터를 `docs/archive/<작년>/` 에 보관하고 앱 바에 연도 선택이 생깁니다 (`?year=2026` 으로도 열림)
- 올해 개정을 새로 셉니다. 업데이트 내역에는 '연도 전환' 한 건만 남습니다
- 12월에는 다음 해 시행분(앞으로 60일)을 `docs/upcoming_next.json` 에 미리 모아 시행 임박 · 30일 내 칸이 연말에도 끊기지 않습니다
- 행정규칙은 작년 7월 이후 발령분부터, 자치법규는 올해 시행분부터 새로 셉니다

**1월 1일 확인표**

- [ ] 알림 메일 없음 · `health.json` 날짜가 1월 1일
- [ ] 연도 선택에 작년이 보이고, 작년 화면 숫자가 12월 31일과 같음
- [ ] 올해 화면에 1월 1일 시행 개정이 잡힘 (1월 1일은 개정이 많은 날)
- [ ] 업데이트 내역 '연도 전환' 한 건
- [ ] 소개 영상 · 발표자료의 숫자는 자동으로 바뀌지 않음 → 필요하면 11장

---

## 9. 기업별 적용법규 검색 (RegRader Pro)

### 무엇인가

회사 이름을 넣으면 공공데이터(국민연금 가입 사업장 · 등록공장 · 인허가) · 한국거래소 · DART 공개 자료로 회사 정보를 채우고,
현행 법률 전부를 그 회사에 적용 · 미적용으로 판정해 **그 회사용 RegRader 화면**(직무 9개 = 8개 + 기타)을 만듭니다.
서버 없이 방문자 브라우저에서 돌고(판정 엔진을 브라우저용 파이썬으로 실행), 결과는 그 브라우저에만 저장됩니다.

| 항목 | 위치 |
|---|---|
| 화면 | 사이드바 맨 위 버튼 → 오른쪽에 열림 · 'RegRader로 보내기'를 누르면 새 탭에 회사 화면 (`docs/pro/site/?company=…`) |
| 회사 찾기 범위 | 국민연금 가입자 30명 이상 법인 + 상장사 (약 4.9만 곳). 개인사업자 제외, 그 밖의 회사는 직접 입력 |
| 매일 자료 | `pro-data` 브랜치 (기록 없이 덮어씀): 법제처 자료 묶음 · 전체 법률 수집 결과 · 회사 찾기 자료(30일마다) |
| 원본 코드 | 맥 `~/regrader-pro` (비공개 저장소 `tjdudfhr/regrader-pro`) → 공개 저장소 `pro/` 에 subtree 로 들어감 |
| 비밀값 | OpenDART 키: `~/regrader-pro/.env` (공유 · 커밋 금지) |

### 운영

- 매일 07:00 갱신 뒤 자동 (`pro_publish.sh` → `python3 -m engine.static_site daily`)
- 회사 찾기 원자료(국민연금 등, 약 1.3GB)는 자동으로 새로 받지 않습니다. 마지막으로 받은 날: 2026-10-10~11. 분기에 한 번 정도 새로 받으면 좋습니다
  ```bash
  cd ~/regrader-pro && python3 -m engine.datasets download && python3 -m engine.companydb build
  ```
- Pro 코드를 고쳤을 때: `~/regrader-pro` 커밋 · push → RegRader 에서
  `git subtree pull --prefix=pro https://github.com/tjdudfhr/regrader-pro.git main --squash` → **바로 push** → 7.9의 4)~5)
  (subtree 합친 커밋을 push 하기 전에 07:00 갱신의 `git pull --rebase` 가 돌면 충돌합니다. 07:00 전후는 피하세요)
- 판정 점검: `cd ~/regrader-pro && python3 -m engine.selfcheck` · 포스코퓨처엠 목록과 비교 `python3 -m engine.benchmark …` (README 참고)
- 회사 찾기 점검: `python3 -m engine.searchcheck` (상장사 · 대형 회사 · 짧은 검색어) · `node engine/searchcheck_web.cjs web/static-api.js out/static/companies/index.json` (브라우저판, 회사 4.9만 곳을 자기 이름으로 찾기 — 2026-10-20 3위 안 99.3%)
- 회사 이름 · 상장 연결 (2026-10-20): 화면 이름은 국민연금 사업장 이름에서 '임직원 · 본사 · (직장) · 총무과' 같은 꼬리말을 뗀 것, 상장사는 DART 정식 회사명. 상장사는 DART 사업자등록번호로 그 법인에 연결한다
- 맥 서버판(DART 실시간 조회): `cd ~/regrader-pro && python3 server.py` → http://127.0.0.1:8787

---

## 10. 메일 · 알림

| 종류 | 언제 · 누구에게 | 설정 위치 |
|---|---|---|
| 메일로 공유 (✉) | 운영자가 범위(30일 이내 · 시행예정 · 분기 · 올해 전체) · 직무를 골라 보냄 | `docs/mail-ui.js` |
| └ 메일 앱으로 작성 | 표 본문을 복사하고 메일 앱을 엶 → 본문에 붙여 넣기 | 로그인 필요 없음 |
| └ 바로 보내기 | 사이트에서 바로 발송 (운영자 Gmail 명의, 회신은 보낸 사람에게) | Apps Script 웹 앱 · 대응 현황 로그인 구성원만 |
| 매월 담당자 알림 | 매월 1일 08시 · 직무 담당자: 다음 달 시행분 + 지난 알림 뒤 새로 잡힌 이번 달분, 대응 상태 함께 · 총괄: 전체 요약 | `scripts/mail_relay.gs` · Supabase |
| 갱신 실패 알림 | 08:20 · 저장소 주인 | `daily-check.yml` |

- 한도: 개인 Gmail 은 하루 받는 사람 100명, 한 번에 30명, 본문 200KB (사이트가 150KB 안으로 줄여 보내고 넘는 부분은 사이트 링크로 대신)
- 매월 알림은 담당자 · 대응 상태를 Supabase 의 비밀 통로(`notify_data`)로 읽습니다. 비밀값은 Apps Script 프로젝트 속성에만 있습니다
- 첫 정기 발송: 2026-11-01 08:00 (12월 시행분)

---

## 11. 소개자료 (발표 PPT · 소개 영상) 최신화

화면 숫자는 매일 바뀌지만 **소개자료의 숫자 · 화면 캡처는 자동으로 바뀌지 않습니다.** 지금 자료는 2026-10-20 기준입니다.

| 자료 | 원본 | 사이트 게시 |
|---|---|---|
| 대회 발표자료 (26쪽 PPT · PDF) | `~/RegRader-ppt-src/` (`build.js` · `capture.cjs` · `img/`) | 시스템 소개 → 설명자료 PDF (`docs/intro/regrader-slides.pdf`) |
| 소개 영상 (19쪽 · 6분 7초 · 내레이션 · 자막) | `~/my-deck/slides/regrader-intro/index.tsx` (사본: 저장소 `intro-deck/`) | 시스템 소개 → 영상 (`docs/intro/regrader-intro.mp4`) |

- 영상 숫자 · 레이더 점 · 시행 임박 일정은 슬라이드 코드에 직접 적혀 있어 데이터와 함께 고칩니다
- 내레이션은 무료 음성(edge-tts `ko-KR-HyunsuMultilingualNeural`), 문장은 합니다체
- 공개 자료에는 실제 담당자 이름 · 이메일 대신 예시(kim@company.com 등)를 씁니다
- 파일을 바꾸면 `index.html` 의 `?v=` 를 올려야 방문자가 새 파일을 봅니다
- 화면 캡처 도구(`intro-deck/render/capture*.cjs`, `~/RegRader-ppt-src/capture.cjs`)는 처음 화면을 건너뛰도록 되어 있습니다 (`sessionStorage rr-landing-seen`)
- 손이 많이 가므로 Claude Code 에 "소개자료를 오늘 기준으로 최신화해줘"라고 맡기는 것을 권장합니다

---

## 12. 맥을 바꾸거나 오래 비울 때

### 오래 비울 때 (휴가 · 출장)

- 맥을 켜 두고 잠자기만 하게 둡니다 (깨어날 때 갱신이 돕니다). 전원을 끄면 그 기간은 갱신이 멈춥니다
- 원하면 시스템 설정 → 에너지(배터리) → 일정에서 매일 06:55 깨우기를 켤 수 있습니다
- 다녀와서 한 번 `kickstart` 하면 밀린 개정이 한꺼번에 잡힙니다 (매일 기록은 그날 하루치로 남습니다)

### 맥을 바꿀 때 옮길 것

| 무엇 | 위치 |
|---|---|
| RegRader 작업 폴더 | `~/RegRader-autoupdate` (git clone 으로 새로 받아도 됨) |
| Pro 작업 폴더 | `~/regrader-pro` 전체 (`data/` 회사 자료 · `.env` OpenDART 키는 git 에 없음) |
| 자동 실행 설정 | `~/Library/LaunchAgents/com.regrader.update.plist` · `com.regrader.requests.plist` → 복사 후 `launchctl load` |
| GitHub 로그인 | `gh auth login` (push · 요청 처리에 필요) |
| 프로그램 | 파이썬 3 + `requests`, Google Chrome (화면 점검용), git |
| 소개자료 원본 | `~/RegRader-ppt-src` · `~/my-deck` |
| 캐시 | `~/Library/Caches/RegRader` (옮기지 않아도 됨, 첫 갱신이 오래 걸릴 뿐) |

국내 IP 에서 돌아야 합니다 (해외 · 일부 VPN 에서는 법제처가 막습니다).

---

## 13. 파일 · 위치 지도

### 저장소 `~/RegRader-autoupdate`

| 파일 | 역할 |
|---|---|
| `scripts/auto_update.sh` | 매일 갱신 전체 순서 |
| `scripts/refresh_laws.py` | 법령 수집 · 대조 · 집계 · 업데이트 내역 · 연도 전환 |
| `scripts/law_families.py` | 법령 계열 (법령체계도) → `docs/law_families.json` · `admrul_candidates.json` |
| `scripts/admin_rules.py` · `admrul_scope.py` | 행정규칙 개정 · 적용 범위 |
| `scripts/ordinances.py` · `ordin_scope.json` | 자치법규 개정 · 대상 35개 |
| `scripts/amend_details.py` | 개정문 분석 (제재 · 의무) |
| `scripts/amend_actions.py` | 실무 판단 |
| `scripts/radar_data.py` | 처음 화면 레이더 점 → `docs/radar.json` (몇 KB, 매일 갱신 마지막에) |
| `scripts/site_check.py` · `daily_watch.py` | 화면 점검 · 08:20 점검 |
| `scripts/process_requests.sh` · `process_law_requests.py` | 적용법규 추가 요청 처리 |
| `scripts/pro_publish.sh` | 기업별 검색 자료 |
| `scripts/mail_relay.gs` | 메일 중계 · 매월 알림 (Apps Script 에 붙여 넣는 원본) |
| `scripts/supabase_tracker.sql` | 대응 현황 표 · 권한 (Supabase SQL Editor 에서 실행한 원본) |
| `docs/` | 사이트 전체 (GitHub Pages) |
| `pro/` | 기업별 검색 원본 사본 (subtree, 직접 고치지 않음) |
| `intro-deck/` | 소개 영상 원본 사본 · 렌더 스크립트 |

### 사이트 데이터 `docs/`

| 파일 | 내용 |
|---|---|
| `base_laws_207.json` | 적용법규(법령) 목록 — **운영자가 관리하는 원본** |
| `m0.json`~`m7.json` · `index.json` | 올해 개정 목록 (직무별로 나눔) |
| `meta.json` | 기준일 · 건수 · 법제처 전체 건수 |
| `changelog.json` | 업데이트 내역 |
| `law_families.json` · `admrul_index.json` · `ordin_index.json` | 계열 · 행정규칙 · 자치법규 목록 |
| `amend_flags.json` · `amend_details.json` | 제재 · 의무 분석 |
| `amend_actions.json` · `oan/` | 실무 판단 요약 · 조문별 변경 전후 |
| `company_facts.json` | 당사 사실 (상시 근로자 수) |
| `upcoming_next.json` · `archive/` | 연말 다음 해 시행분 · 지난 연도 보관 |
| `health.json` | 오늘 갱신 결과 |
| `landing.js` · `radar.json` | 처음 화면 · 그 레이더 점 |
| `gate.js` | 화면 잠금 (비밀번호 해시) |
| `intro/` | 소개 영상 · 자막 · 설명자료 PDF |

### 바깥 서비스

| 서비스 | 용도 | 관리 |
|---|---|---|
| 국가법령정보센터 Open API | 법령 · 행정규칙 · 자치법규 · 신구법 | 신청 아이디(OC)는 스크립트에 들어 있음 |
| GitHub (`tjdudfhr`) | 저장소 · Pages · Actions · 요청(Issue) | gh 로그인 |
| Supabase (`gzlyjwvounwdubdvwjen`) | 대응 현황 · 로그인 · 담당자 | supabase.com 대시보드 |
| Google Apps Script | 메일 바로 보내기 · 매월 알림 | 운영자 구글 계정 |
| 공공데이터포털 · 지방행정 인허가 · KRX · DART | 기업별 검색 회사 자료 | 키 없음 (OpenDART 만 키) |

---

## 14. 하지 말아야 할 것

- 비밀번호 · Gmail 앱 비밀번호 · OpenDART 키 · Apps Script 비밀값을 저장소 · 문서 · 메신저에 적지 않기
- 담당자 이메일 · 대응 상태 같은 내부 자료를 저장소(`docs/`)에 넣지 않기 — 저장소는 공개입니다
- 저장소 파일을 고친 채 커밋하지 않고 두지 않기 — 다음 07:00 갱신이 첫 단계에서 멈춥니다 (커밋하지 않은 새 파일은 괜찮음)
- `pro/` 폴더를 직접 고치지 않기 (원본은 `~/regrader-pro`)
- subtree 를 합친 커밋을 올리지 않은 채 두지 않기 (07:00 갱신과 충돌)
- 화면 점검(`site_check.py`)을 건너뛰고 올리지 않기
- 데이터 파일(`m*.json` 등)을 손으로 고치지 않기 — 다음 날 갱신이 덮어씁니다. 원본(`base_laws_207.json` · `admrul_scope.py` · `ordin_scope.json`)을 고칩니다
- 유료 서비스 붙이지 않기 (지금 구조는 모두 무료)

---

## 15. Claude Code 에 맡길 때

이 시스템은 Claude Code 와 함께 만들었습니다. 맥의 Claude Code 에 이렇게 말하면 됩니다.

| 상황 | 이렇게 |
|---|---|
| 알림 메일이 옴 | "RegRader 오늘 갱신 실패 알림이 왔어. 확인하고 다시 돌려줘" |
| 법 추가 · 빼기 | "적용법규에 ○○법 추가해줘 (직무: 환경)" / "○○법은 폐지됐어, 빼줘" |
| 조례 | "광양시 ○○ 조례도 넣어줘" |
| 행정규칙 | "○○ 고시는 우리 회사랑 상관없어, 빼줘" |
| 화면 고치기 | "○○ 화면에서 □□가 이상해" (화면 캡처를 같이 주면 빠릅니다) |
| 소개자료 | "PPT랑 소개 영상을 오늘 기준으로 최신화해줘" |
| 연말 | "1월 1일 연도 전환 잘 됐는지 확인해줘" |

---

*2026-10-20 개정 — 매일 자동 갱신 · 행정규칙 · 자치법규 · 실무 판단 · 대응 현황 · 메일 알림 · 기업별 적용법규 검색 반영. 이전 판(2026-03)은 연초 수작업 갱신 기준.*
