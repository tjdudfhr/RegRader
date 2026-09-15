const CACHE_NAME = 'regrader-v6-events';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) => Promise.all(names.map((n) => caches.delete(n)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = event.request.url;
  if (event.request.method !== 'GET') return;

  if (url.includes('index.html') || url.endsWith('/RegRader/') || url.endsWith('/RegRader')) {
    event.respondWith((async () => {
      const res = await fetch(event.request, { cache: 'no-store' });
      const text = await res.text();
      if (text.includes('event-boot.js')) return new Response(text, { headers: res.headers });
      const injected = text.replace('</body>', '<script src="./event-boot.js"></script></body>');
      return new Response(injected, {
        status: res.status,
        headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }
      });
    })());
    return;
  }

  if (url.includes('index.json') || url.includes('events_') || url.includes('event-boot.js') || url.includes('watch.html') || url.includes('summaries.json') || url.includes('sum_') || url.includes('extra11') || /\/m[0-7]\.json/.test(url) || url.includes('previous_index')) {
    event.respondWith(fetch(event.request, { cache: 'no-store' }));
  }
});
