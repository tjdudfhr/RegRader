# ⚠️ 중요: 절대 삭제/수정 금지 파일

## 🔴 핵심 데이터 파일 (수정 금지)

### 1. 기본 법규 데이터
- **`docs/base_laws_207.json`** - 207개 당사 기본 적용법규
- **절대 수정 금지** - 회사 정책에 따른 고정 데이터

### 2. 매칭 결과 데이터  
- **`docs/index.json`** - 259개 매칭 결과
- **자동 업데이트 금지** - 수동 검증 후에만 수정

### 3. 웹페이지
- **`docs/index.html`** - 메인 대시보드
- **신중히 수정** - 3개 탭 구조 유지 필수

## 📁 백업 위치

- `backups/2025-08-29_final/` - 최종 안정 버전 백업
- `backups/webapp_backup_20250829_final.tar.gz` - 압축 백업
- `core_data/` - 핵심 데이터 및 코드 정리본

## 🛡️ 보호 설정

1. **GitHub CODEOWNERS** 설정됨 - 수동 승인 필요
2. **GitHub Actions** 설정됨 - 자동 업데이트 차단
3. **PM2 서비스** - ecosystem.config.js로 관리

## 📊 현재 데이터 구조

```
2,809개 수집 법령 (국가법령정보센터)
    ↓ 100% 매칭
207개 기본 법규 → 259개 매칭 결과
    ↓
- 124개 유니크 법령 (59.9% 매칭률)
- 일부 법령은 여러 시행일자 보유
```

## ⚡ 서비스 재시작 명령

```bash
# PM2 서비스 재시작
pm2 restart law-watch

# 또는 완전 재시작
pm2 delete law-watch
pm2 start ecosystem.config.js
```

---
**Last Updated**: 2025-08-29
**Version**: FINAL PRODUCTION
**DO NOT DELETE THIS FILE**