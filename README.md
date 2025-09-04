# RegRader - 법령 모니터링 대시보드

2025년 시행 법령 모니터링 및 관리 시스템

## 📊 핵심 데이터 현황

- **2025년 전체 개정 법규**: 2,971개
- **당사 적용 기본 법규**: 207개  
- **2025년 매칭된 법규**: **276개** ✅
- **개정유형**: 일부개정(207개), 타법개정(69개)

### 분기별 분포
- Q1 (1-3월): 134개
- Q2 (4-6월): 61개
- Q3 (7-9월): 67개  
- Q4 (10-12월): 14개

## 🗂️ 파일 구조

```
RegRader/
├── docs/                      # GitHub Pages 배포 디렉토리
│   ├── index.html             # 메인 대시보드
│   ├── index.json             # 276개 법령 데이터 (핵심)
│   ├── mobile_v2.html         # 모바일 최적화 버전
│   ├── base_laws_207.json     # 기본 207개 법령 목록
│   ├── matched_index_2025.json # 2025년 매칭 결과
│   └── manifest.json          # PWA 설정
├── law_watch_server.js        # Express 서버 (포트 3000)
├── ecosystem.config.js        # PM2 설정
└── package.json              # 의존성
```

## 🌐 접속 주소

- **Production (GitHub Pages)**: https://tjdudfhr.github.io/RegRader/
- **Mobile Version**: https://tjdudfhr.github.io/RegRader/mobile_v2.html
- **Local Server**: http://localhost:3000

## 🚀 실행 방법

```bash
# 의존성 설치
npm install

# PM2로 서버 실행
pm2 start ecosystem.config.js

# 서버 상태 확인
pm2 status

# 로그 확인
pm2 logs law-watch --nostream

# 서버 재시작
pm2 restart all
```

## ✨ 주요 기능

### 📱 반응형 디자인
- Desktop/Tablet/Mobile 최적화
- PWA (Progressive Web App) 지원
- 오프라인 모드 지원

### 📧 이메일 알림 시스템
- EmailJS 통합 (Service ID: service_7tdd8dh)
- 다중 수신자 지원
- 분기별 법령 변경사항 알림
- Excel 다운로드 기능

### 🔍 검색 및 필터링
- 8대 카테고리별 분류 (인사노무, 공정거래, 정보보호 등)
- 시행 날짜별 정렬
- 주무부처별 필터링
- 개정유형별 구분 (일부개정/타법개정/제정/전부개정)

### 📊 데이터 동기화
- **통합 개정유형 시스템**: 한 곳에서 수정시 모든 화면 자동 반영
- 실시간 카운트다운 타이머
- 분기별 통계 자동 집계

## 🔄 최근 업데이트

### v2.1 (2025-09-04)
- ✅ 개정유형 통합 연동 시스템 구축
- ✅ 데이터 불일치 문제 해결 (감염병 법령 내용 수정)
- ✅ 시행예정 음수 표시 버그 수정
- ✅ 불필요한 백업 파일 정리 (114개 → 54개 파일)

## ⚙️ 기술 스택

- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)
- **Backend**: Node.js, Express
- **Process Manager**: PM2
- **Email Service**: EmailJS
- **Deployment**: GitHub Pages
- **Data Format**: JSON

## 📝 개발 가이드

### 데이터 수정 방법
1. `docs/index.json` 파일 수정
2. `amendmentType` 필드로 개정유형 지정
3. Git commit 후 push → 자동 배포

### 개정유형 변경시
- `index.json`의 `amendments[0].amendmentType` 수정
- 모든 화면에 자동 반영 (리스트, 상세보기, 팝업)

## ⚠️ 주의사항

- 법령 총 개수는 276개 유지 필수
- 동일 법령명/시행일이어도 개별 ID로 관리
- 각 법령은 고유 ID (matched_1 ~ matched_276) 보유

## 📅 프로젝트 정보

- **최종 업데이트**: 2025년 9월 4일
- **버전**: 2.1
- **총 법령 수**: 276개 확정
- **Repository**: https://github.com/tjdudfhr/RegRader