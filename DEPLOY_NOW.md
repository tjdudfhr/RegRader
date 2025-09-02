# 🚀 지금 바로 무료 배포하기! (5분 소요)

## 🔥 가장 빠른 방법: Vercel (완전 무료)

### 1단계: Vercel 가입 (1분)
1. https://vercel.com 접속
2. **"Sign Up"** 클릭
3. **"Continue with GitHub"** 클릭 (GitHub 계정으로 로그인)

### 2단계: 프로젝트 배포 (3분)
1. Vercel 대시보드에서 **"Import Project"** 클릭
2. **GitHub 저장소 선택**: `tjdudfhr/RegRader` 선택
3. **Configure Project**:
   - Framework Preset: **Other** 선택
   - Root Directory: **`docs`** 입력
   - Build Command: 비워두기
   - Output Directory: 비워두기
4. **"Deploy"** 클릭!

### 3단계: 완료! (1분)
- 자동으로 URL 생성됨: `https://regrader-당신아이디.vercel.app`
- 이제 이 URL로 접속하면 앱 설치 가능!

---

## 🎯 또 다른 방법: Netlify (역시 무료)

### 1단계: Netlify 가입
1. https://netlify.com 접속
2. **"Sign up"** → **"GitHub"** 로그인

### 2단계: 배포
1. **"Import from Git"** 클릭
2. GitHub 연결 → `RegRader` 저장소 선택
3. 설정:
   - Base directory: `docs`
   - Build command: 비워두기
   - Publish directory: `docs`
4. **"Deploy site"** 클릭!

### 3단계: 완료!
- URL 생성: `https://amazing-site-abc123.netlify.app`
- 커스텀 도메인 설정 가능 (무료)

---

## 📱 GitHub Pages로 배포 (가장 간단!)

### 1단계: GitHub 저장소 설정
1. GitHub에서 `RegRader` 저장소 열기
2. **Settings** 탭 클릭
3. 왼쪽 메뉴에서 **Pages** 클릭

### 2단계: Pages 활성화
1. Source: **Deploy from a branch** 선택
2. Branch: **main** 선택
3. Folder: **/docs** 선택
4. **Save** 클릭

### 3단계: 완료!
- 5분 후 접속 가능: `https://tjdudfhr.github.io/RegRader/`
- 완전 무료, 추가 설정 불필요!

---

## ⚡ 지금 당장 해야 할 일:

### **옵션 1: GitHub Pages (가장 쉬움)**
1. GitHub 저장소 → Settings → Pages
2. Source를 main 브랜치, /docs 폴더로 설정
3. 5분 기다리기
4. `https://tjdudfhr.github.io/RegRader/` 접속!

### **옵션 2: Vercel (가장 빠름)**
1. vercel.com 가입 (GitHub 로그인)
2. Import → RegRader 선택
3. Root Directory를 `docs`로 설정
4. Deploy 클릭!

---

## 🎉 배포 후 앱 설치:

1. **배포된 URL로 스마트폰 접속**
2. **Chrome/Safari 메뉴 → "홈 화면에 추가"**
3. **완료! 앱 아이콘 생성됨**

---

## 💡 문제 해결:

### Service Worker 오류가 나면?
`service-worker.js` 파일의 경로를 수정:
```javascript
// 상대 경로로 변경
navigator.serviceWorker.register('./service-worker.js')
```

### 아이콘이 안 보이면?
`manifest.json`의 아이콘 경로 수정:
```json
"icons": [
  {
    "src": "./icon-192.png",  // ./ 추가
    "sizes": "192x192"
  }
]
```

---

## 🚨 긴급 해결책:

**지금 바로 GitHub Pages 켜세요!**
1. https://github.com/tjdudfhr/RegRader/settings/pages
2. Source → main → /docs → Save
3. 5분 후 https://tjdudfhr.github.io/RegRader/ 접속
4. 끝!

이제 진짜 작동하는 링크가 생깁니다! 💪