# RegRader - 법령 모니터링 대시보드

2025년 시행 법령 모니터링 및 관리 시스템

## 📊 핵심 데이터 현황

- **2025년 전체 개정 법규**: 2,971개
- **당사 적용 기본 법규**: 207개  
- **2025년 매칭된 법규**: **276개** ✅

### 분기별 분포
- Q1 (1-3월): 134개
- Q2 (4-6월): 61개
- Q3 (7-9월): 67개  
- Q4 (10-12월): 14개

## 🗂️ 파일 구조

```
RegRader/
├── docs/                      # GitHub Pages 디렉토리
│   ├── index.html             # 메인 대시보드
│   ├── index.json             # 276개 법령 데이터 (핵심)
│   ├── base_laws_207.json     # 기본 207개 법령 목록
│   ├── matched_index_2025.json # 2025년 매칭 결과
│   └── manifest.json          # PWA 설정
├── law_watch_server.js        # Express 서버 (포트 3000)
├── ecosystem.config.js        # PM2 설정
└── package.json              # 의존성

```

## 🌐 접속 주소

- **GitHub Pages**: https://tjdudfhr.github.io/RegRader/
- **로컬 서버**: http://localhost:3000

## 🚀 실행 방법

```bash
# PM2로 서버 실행
pm2 start ecosystem.config.js

# 서버 상태 확인
pm2 status

# 로그 확인
pm2 logs law-watch --nostream
```

## 📧 이메일 알림 시스템

- EmailJS 통합
- 다중 수신자 지원
- 분기별 법령 변경사항 알림
- Excel 다운로드 기능

## 🔄 데이터 업데이트 정책

1. **index.json**: 276개 법령의 메인 데이터 파일
2. 모든 변경사항은 이 파일을 기준으로 함
3. 법령명과 시행일이 같아도 각각 고유 ID를 가진 개별 법령

## ⚠️ 주의사항

- 법인세법(2025-01-01) 같이 동일 법령명/시행일이어도 여러 개의 개별 법령일 수 있음
- 각 법령은 고유 ID (matched_1 ~ matched_276)로 구분
- 데이터 수정 시 276개 법령 수 유지 필수

## 📅 최종 업데이트

- 2025년 9월 4일
- 버전: 2.0 Final
- 총 276개 법령 확정