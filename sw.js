const CACHE_VERSION = 'eipsc-v3';
const PRECACHE = [
  './', 'index.html', 'manifest.json',
  'styles.css?v=20261019b', 'app.js?v=20261019a',
  'map.html', 'weak.html', 'weak.js?v=20261019b',
  'data/cards.json', 'data/weak.md',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_VERSION).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const cacheFirst = (request) =>
  caches.open(CACHE_VERSION).then((cache) =>
    cache.match(request).then((cached) => cached || fetch(request).then((res) => {
      if (res.ok || res.type === 'opaque') cache.put(request, res.clone());
      return res;
    }))
  );

// 카드·요약 데이터: 네트워크 우선(새 내용 반영), 오프라인이면 캐시
const networkFirst = (request) =>
  caches.open(CACHE_VERSION).then((cache) =>
    fetch(request).then((res) => {
      if (res.ok) cache.put(request, res.clone());
      return res;
    }).catch(() => cache.match(request, { ignoreSearch: true }))
  );

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match(request, { ignoreSearch: true }).then((r) => r || caches.match('./'))));
    return;
  }
  if (url.origin === self.location.origin && (url.pathname.endsWith('/data/cards.json') || url.pathname.endsWith('/data/weak.md'))) {
    event.respondWith(networkFirst(request));
    return;
  }
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(cacheFirst(request));
    return;
  }
  if (url.origin === self.location.origin) { event.respondWith(cacheFirst(request)); return; }
});
