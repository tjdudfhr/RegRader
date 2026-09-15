# RegRader - 법령 모니터링 대시보드

2026년 시행 법령을 **개정 이벤트 단위**로 모니터링합니다.  
같은 법령이 한 해에 여러 번 개정되면 시행일별로 따로 집계합니다.

## 접속

- 메인: https://tjdudfhr.github.io/RegRader/
- Watch (D-30 / 복수개정 / 변경감지): https://tjdudfhr.github.io/RegRader/watch.html

## 2026-09-15 갱신 스냅샷

- 국가법령정보센터 OpenAPI 재수집
- 기본 적용법규 207개와 법령명 완전일치
- **개정 이벤트 320건 / 법령 131개**
- 이미 시행된 개정 263건 + 앞으로 시행될 개정 57건
- 이미 한 번 이상 시행됐고, 오해 추가 개정도 남은 법령 **31개**
- 고유키: `법령명 + 시행일 + 개정유형` (중복 0)

분기: Q1 130 · Q2 73 · Q3 85 · Q4 32  
유형: 일부개정 187 · 타법개정 133

## 데이터 원칙

1. 제목이 같아도 시행일이 다르면 **다른 이벤트**
2. 같은 날 일부개정과 타법개정이 같이 있으면 **둘 다 유지**
3. `effectiveDate <= 기준일` → 시행완료(현행), 이후 → 시행예정
4. 각 이벤트에 같은 법령의 오해 타임라인(`timeline`)을 붙임

## 자동 갱신

`.github/workflows/weekly-refresh.yml`
- 매주 월요일 07:00 KST
- `scripts/refresh_laws.py`가 OpenAPI 수집 후 `docs/index.json` 갱신
- 직전 스냅샷은 `docs/previous_index.json`으로 옮겨 Watch 변경감지에 사용
- OC는 저장소 Secrets `LAW_OC` 사용 (없으면 코드 기본값)

수동 실행: Actions → Weekly law refresh → Run workflow
