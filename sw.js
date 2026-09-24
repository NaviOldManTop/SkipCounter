// Offline support: serve from cache instantly, refresh the cache in the background.
// Bump CACHE when the asset list changes.
const CACHE = 'skipcount-v7';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './ics.js',
  './update.js',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  // cache: 'reload' bypasses the HTTP cache (GitHub Pages sends max-age=600).
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS.map((url) => new Request(url, { cache: 'reload' })))),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const key = request.mode === 'navigate' ? './index.html' : request;
      const cached = await cache.match(key, { ignoreSearch: true });
      // no-cache: revalidate with the server so a stale HTTP-cached copy can't overwrite a fresh one.
      const network = fetch(request, { cache: 'no-cache' })
        .then((response) => {
          if (response.ok) cache.put(key, response.clone());
          return response;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
