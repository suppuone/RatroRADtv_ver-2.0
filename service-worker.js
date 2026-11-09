const CACHE_NAME = 'retroradtv-v3-107';
const APP_FILES = [
  './',
  './index.html',
  './preset-defaults.js?v=3.0.104',
  './style.css?v=3.0.92',
  './app.js?v=3.0.104',
  './manifest.webmanifest',
  './icon.svg',
  './assets/station-logos/coolmag-radio.png',
  './data/radio-presets.json',
  './data/tv-presets.json',
  './data/app-settings.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith('retroradtv-v3-') && key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request).then(cached => cached || (request.mode==='navigate'?caches.match('./index.html'):Response.error())))
  );
});
