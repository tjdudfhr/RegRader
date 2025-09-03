# 🔒 모바일 버전 복구 가이드 (v2.1-mobile-stable)

## ✅ 현재 모바일 버전 상태
- **버전**: v2.1-mobile-stable
- **백업 날짜**: 2025-09-02
- **상태**: 완벽 작동 중
- **특징**: 
  - 모바일 자동 리다이렉션 작동 ✅
  - PC와 동일한 팝업 내용 ✅
  - 259개 법령 상세 데이터 포함 ✅

## 🚨 문제 발생 시 즉시 복구 방법

### 방법 1: Git 태그로 복구 (가장 빠름)
```bash
# 현재 변경사항 저장
git stash

# 안정 버전으로 복구
git checkout v2.1-mobile-stable

# 또는 특정 파일만 복구
git checkout v2.1-mobile-stable -- docs/mobile_v2.html docs/index.html
```

### 방법 2: 백업 파일로 복구
```bash
# 백업 파일 압축 해제
tar -xzf backup_mobile_stable_*.tar.gz

# 파일이 docs 폴더에 복구됨
```

### 방법 3: 수동 복구 (핵심 코드)

#### 1. index.html의 모바일 리다이렉션 코드
```javascript
<!-- 모바일 기기 감지 및 자동 리다이렉션 -->
<script>
    (function() {
        var isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        var isSmallScreen = window.innerWidth <= 768;
        
        if ((isMobile || isSmallScreen) && !window.location.pathname.includes('mobile')) {
            window.location.href = './mobile_v2.html';
        }
    })();
</script>
```

#### 2. 중요 파일 경로 설정
- 모든 JSON 파일: `./index.json`, `./base_laws_207.json`
- 모든 HTML 파일: `./mobile_v2.html`, `./index.html`
- Service Worker: `./service-worker.js`
- Manifest: `./manifest.json`

## 📋 체크리스트

### 모바일 접속 안 될 때 확인사항:
- [ ] mobile_v2.html이 /docs 폴더에 있는가?
- [ ] index.html에 모바일 리다이렉션 코드가 있는가?
- [ ] 모든 경로가 상대경로(./)로 되어 있는가?
- [ ] GitHub Pages가 /docs 폴더로 설정되어 있는가?

### 팝업 내용이 다를 때:
- [ ] generateAmendmentReason 함수가 PC와 동일한가?
- [ ] generateAmendmentContent 함수가 PC와 동일한가?
- [ ] generateAmendmentArticles 함수가 있는가?
- [ ] getDetailedLawType 함수가 있는가?

## 🔧 PM2 서버 관련

### 로컬 테스트 서버
```bash
# 상태 확인
pm2 status

# 재시작
pm2 restart law-watch

# 로그 확인
pm2 logs law-watch --nostream

# 포트 확인 (3000번이 맞음)
```

### 서비스 URL
- 로컬: http://localhost:3000
- 샌드박스: https://3000-[sandbox-id].e2b.dev

## 🌐 GitHub Pages 배포

### 설정 확인
1. Settings → Pages
2. Source: Deploy from a branch
3. Branch: main
4. Folder: /docs
5. URL: https://tjdudfhr.github.io/RegRader/

### 배포 후 대기
- 첫 배포: 10분
- 업데이트: 2-3분

## ⚠️ 절대 하지 말아야 할 것

1. **mobile_v2.html 삭제 금지**
2. **모바일 리다이렉션 코드 제거 금지**
3. **절대경로(/) 사용 금지 - 항상 상대경로(./) 사용**
4. **docs 폴더 외부에 파일 두지 않기**

## 📞 긴급 복구 명령어

```bash
# 완전 복구 원라이너
git checkout v2.1-mobile-stable -- docs/mobile_v2.html docs/index.html && git commit -m "Emergency: restore stable mobile version" && git push origin main
```

## 💾 백업 파일 목록
- `backup_mobile_stable_20250902_*.tar.gz` - 전체 백업
- Git 태그: `v2.1-mobile-stable`
- GitHub 커밋: 최신 푸시된 버전

---

**중요**: 이 파일을 삭제하지 마세요! 모바일 버전 복구의 핵심 가이드입니다.