// 같은 사이트 파일(화면 · 자료)은 늘 새로 받는다 (옛 화면이 남지 않게). 외부 라이브러리(차트 · 엑셀 · Pyodide 등 CDN)는
// 브라우저 캐시를 그대로 쓴다 — 예전에는 이것까지 매번 새로 받아(약 2MB, Pro 판정 엔진은 수십 MB) 화면이 늦게 열렸다 (2026-10-21)
const CACHE_NAME = 'regrader-v9-passthrough';
self.addEventListener('install', (e) => e.waitUntil(self.skipWaiting()));
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((names) => Promise.all(names.map((n) => caches.delete(n)))).then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (new URL(event.request.url).origin !== self.location.origin) return;   // 외부 라이브러리 · 자료는 브라우저가 알아서 (캐시 사용)
  event.respondWith(fetch(event.request, { cache: 'no-store' }));
});
