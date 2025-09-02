# RegRader Version Information

## Current Version: v1.0-stable
**Date**: 2025-09-02
**Status**: ✅ Stable - All features working

## Core Features
1. **법령 모니터링 대시보드**
   - 259개 법령 데이터 표시
   - 분기별 필터링 (Q1: 119건, Q2: 61건, Q3: 64건, Q4: 15건)
   - 직무별 카테고리 분류
   - 시행일 기준 정렬

2. **이메일 발송 시스템**
   - EmailJS 통합 (service_7tdd8dh, template_tu71wgt)
   - 다중 수신자 지원
   - 팝업 창 인터페이스
   - 템플릿별 발송 (전체/분기별)
   - 수신자 주소 localStorage 저장

3. **데이터 내보내기**
   - Excel 다운로드 기능
   - 분기별 데이터 필터링

## File Structure
```
/home/user/webapp/
├── docs/
│   ├── index.html          # 메인 대시보드
│   ├── email_popup.html    # 이메일 발송 팝업
│   ├── email_scheduler_pro.html  # 이메일 스케줄러
│   ├── index.json          # 법령 데이터 (259개)
│   ├── base_laws_207.json  # 기본 법령 데이터
│   ├── quarterly_details.json  # 분기별 상세 데이터
│   ├── 2025_laws_complete.xlsx  # Excel 원본 데이터
│   ├── emailjs_backup_config.js  # EmailJS 백업 설정
│   └── backup_files/       # 백업 및 테스트 파일 보관
├── server.js               # Express 서버
├── package.json            # Node.js 의존성
├── ecosystem.config.js     # PM2 설정
├── supervisord.conf        # Supervisor 설정
└── VERSION_INFO.md         # 버전 정보 (이 파일)
```

## Important Notes
- **GitHub Pages URL**: https://tjdudfhr.github.io/RegRader/
- **Git Tag**: v1.0-stable
- **EmailJS Public Key**: Nt6PrPKpsL1ruZEIH
- **PM2 Process**: law-watch (port 4800)

## Recovery Instructions
문제 발생 시 이 버전으로 복구하려면:
```bash
git checkout v1.0-stable
```

## Known Working Configuration
- Node.js 서버: PM2로 관리
- 포트: 4800
- 모든 기능 정상 작동 확인됨