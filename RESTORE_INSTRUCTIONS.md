# 🔄 복원 지침서

## 현재 백업된 버전들

### ✅ index_icon_restored_backup.html (최신 - 아이콘 복원 완료)
- **날짜**: 2025년 8월 19일 04:32
- **상태**: 모든 이모지 아이콘 복원 완료
- **기능**: 
  - 분기별 표시 시스템 (🌱☀️🍂❄️)
  - 업무별 필터링 (🛡️🌱👥🏛️💰🔒📋)
  - 200개 법령 데이터 정상 로딩
  - 팝업 모달 시스템

### 복원 방법
```bash
cd /tmp/law-watch/docs
cp index_icon_restored_backup.html index.html
```

## Git 복원
현재 main 브랜치의 최신 커밋(ba947de)이 아이콘 복원 완료 상태입니다.

```bash
git log --oneline -3
# ba947de feat: 아이콘 시스템 복원 - 기하학적 도형에서 이모지로 완전 되돌림
```

## 서버 재시작
```bash
cd /tmp/law-watch
pm2 restart law-watch-dashboard
```

현재 서버: https://8005-ir24ls853s5xc9h78r1sn-6532622b.e2b.dev