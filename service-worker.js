const CACHE_NAME = 'retroradtv-v3-134';
const APP_FILES = [
  './',
  './index.html',
  './preset-defaults.js?v=3.0.134',
  './style.css?v=3.0.92',
  './app.js?v=3.0.134',
  './onboarding.js?v=3.0.115',
  './assets/station-logos/name-69ee6685de85.svg',
  './assets/station-logos/name-c791f4a53328.svg',
  './assets/station-logos/name-81aaf4cdbf83.svg',
  './assets/station-logos/name-c20f85670f1e.svg',
  './assets/station-logos/name-19acb7409004.svg',
  './assets/station-logos/name-fe1707630aac.svg',
  './assets/station-logos/name-dbdac3490321.svg',
  './assets/station-logos/name-e8a33b02fd00.svg',
  './assets/station-logos/name-ccf9b695182e.svg',
  './assets/station-logos/name-476936e9d8d2.svg',
  './assets/station-logos/name-6a5acd6003a5.svg',
  './assets/station-logos/name-2ffc6138d2af.svg',
  './assets/station-logos/name-d8d4f0eb67ad.svg',
  './assets/station-logos/name-9bfe55632cdb.svg',
  './assets/station-logos/name-4467af9042dd.svg',
  './assets/station-logos/name-d79f2f38b21f.svg',
  './assets/station-logos/name-65a382c97fa2.svg',
  './assets/station-logos/name-bfc94c35b6e7.svg',
  './assets/station-logos/name-25b4631e18ab.svg',
  './assets/station-logos/name-46b7cfd9417e.svg',
  './assets/station-logos/name-67b3506c3cfe.svg',
  './assets/station-logos/name-6a80ab8cecee.svg',
  './assets/station-logos/name-357253c90520.svg',
  './assets/station-logos/name-cacfcdcec03e.svg',
  './assets/station-logos/name-b8ae6bbc5109.svg',
  './assets/station-logos/name-1b4c548e55c9.svg',
  './assets/station-logos/name-7eb103a430df.svg',
  './assets/station-logos/name-eaf8dd2ac337.svg',
  './assets/station-logos/name-d041fa89fbc9.svg',
  './assets/station-logos/name-9721c888a760.svg',
  './assets/station-logos/name-f03f96be1e51.svg',
  './assets/station-logos/name-8a3f0fb0d858.svg',
  './assets/station-logos/name-b44defd81f7c.svg',
  './assets/station-logos/name-5e9d22f2b75a.svg',
  './assets/station-logos/name-1e12289104e3.svg',
  './assets/station-logos/name-0146f7520331.svg',
  './assets/station-logos/name-7e69375817b8.svg',
  './assets/station-logos/name-7022fbeb1893.svg',
  './assets/station-logos/name-ce8183ba0c11.svg',
  './assets/station-logos/name-93d621b2d6c0.svg',
  './assets/station-logos/name-cad424e976ad.svg',
  './assets/station-logos/name-84ec09b4370f.svg',
  './assets/station-logos/name-a9a53e2e1e1e.svg',
  './assets/station-logos/name-f31d3c2619fa.svg',
  './assets/station-logos/name-40c77d421927.svg',
  './assets/station-logos/name-e237b1d8c055.svg',
  './assets/station-logos/name-f9cf424793c9.svg',
  './assets/station-logos/name-8aed321f2164.svg',
  './assets/station-logos/name-49371679e38e.svg',
  './assets/station-logos/name-0eacd31fa04e.svg',
  './assets/station-logos/name-3df959ae64bb.svg',
  './assets/station-logos/name-4ce973ffed55.svg',
  './assets/station-logos/name-def8e44d0096.svg',
  './assets/station-logos/name-92cc82023eb6.svg',
  './assets/station-logos/name-0d7d940592c0.svg',
  './assets/station-logos/name-a9d4c8459456.svg',
  './assets/station-logos/name-98d5573fc0d1.svg',
  './assets/station-logos/name-7908e5802c98.svg',
  './assets/station-logos/name-42990dad8859.svg',
  './assets/station-logos/name-4e2ce1a7c01e.svg',
  './assets/station-logos/name-94237b6c6390.svg',
  './assets/station-logos/name-862a7fedc7f6.svg',
  './assets/station-logos/name-f540cc4de167.svg',
  './assets/station-logos/name-c9865c8a9bf4.svg',
  './assets/station-logos/name-c3d9cf5f5547.svg',
  './assets/station-logos/name-a9dc74c6fbcd.svg',
  './assets/station-logos/name-914ba0f3a19f.svg',
  './assets/station-logos/name-56f136855204.svg',
  './assets/station-logos/name-0c9ca1fe8a71.svg',
  './assets/station-logos/name-d1cd976d35e6.svg',
  './assets/station-logos/name-2f7e25e789f9.svg',
  './assets/station-logos/name-5fffc3e297f5.svg',
  './assets/station-logos/name-ec2cf9cce7f1.svg',
  './assets/station-logos/name-efdfb160cea5.svg',
  './assets/station-logos/name-daac4c0297eb.svg',
  './assets/station-logos/name-3989889d6f14.svg',
  './assets/station-logos/name-b6599e42fd78.svg',
  './assets/station-logos/name-dd2702db7cab.svg',
  './assets/station-logos/name-52b9dd5af187.svg',
  './assets/station-logos/name-9c17aef163a8.svg',
  './assets/station-logos/name-e7c6f22106de.svg',
  './assets/station-logos/name-7ca1ce4b2827.svg',
  './assets/station-logos/name-8aa5b23e2fca.svg',
  './assets/station-logos/name-1745d5672a90.svg',
  './assets/station-logos/name-40b24f76914a.svg',
  './assets/station-logos/name-29cf2cd7cb7c.svg',
  './assets/station-logos/name-a712f1460629.svg',
  './assets/station-logos/name-7b290bc8be0c.svg',
  './assets/station-logos/name-57a7f07e92ad.svg',
  './assets/station-logos/name-cd4461ef43bf.svg',
  './assets/station-logos/name-81b36c9921e0.svg',
  './assets/station-logos/name-c0917c5556b9.svg',
  './assets/station-logos/name-8a70ac9ba2c3.svg',
  './assets/station-logos/name-1c51f0400562.svg',
  './assets/station-logos/name-42b7fe23a884.svg',
  './assets/station-logos/name-a069f659ab38.svg',
  './assets/station-logos/name-90a0ecdda40c.svg',
  './assets/station-logos/name-ac4803640d5f.svg',
  './assets/station-logos/name-6cc04d145f4f.svg',
  './assets/station-logos/name-b29ebc9b66ae.svg',
  './assets/station-logos/cooltv.svg',
  './manifest.webmanifest',
  './icon.svg',
  './assets/station-logos/coolmag-radio.png',
  './assets/station-logos/sikkim-school-radio.png',
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
