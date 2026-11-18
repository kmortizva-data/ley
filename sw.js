// Service worker: network first, cache as fallback.
// Online you always get the newest files; offline (the gym basement) you get the last copy.

const CACHE = 'ley-v3';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/app.js', 'js/db.js', 'js/evidence.js',
  'js/logic/program.js', 'js/logic/progression.js', 'js/logic/e1rm.js', 'js/logic/nutrition.js',
  'js/ui/util.js', 'js/ui/today.js', 'js/ui/history.js', 'js/ui/progress.js', 'js/ui/charts.js',
  'js/ui/nutrition.js', 'js/ui/settings.js', 'js/ui/exercise.js',
  'js/figure.js', 'js/poses.js', 'js/logic/cues.js', 'data/poses.json',
  // The camera screen, its engine (30 MB) and the photos are cached the first time they are opened.
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
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
  if (request.method !== 'GET' || new URL(request.url).origin !== location.origin) return;
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request, { ignoreSearch: true }).then((hit) => hit ?? caches.match('index.html'))),
  );
});
