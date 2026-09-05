/* Airwaves service worker — precache everything so the site works with no signal */

const V = 'airwaves-v1';

const SHELL = [
  './',
  'index.html',
  'assets/styles.css',
  'assets/app.js',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
  'data/regions.json',
  'data/r/nationwide.json',
  'data/r/bay-area.json',
  'data/r/south-bay.json',
  'data/r/central-coast.json',
  'data/r/sierra.json',
  'data/r/socal.json',
  'data/r/san-diego.json',
  'data/r/desert-southwest.json',
  'data/r/yellowstone.json',
  'data/r/nyc.json',
  'data/r/dc.json',
  'data/r/pnw.json'
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(V);
    // Add individually so one 404 cannot abort the whole install.
    await Promise.all(SHELL.map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => {})));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== V).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  e.respondWith((async () => {
    const c = await caches.open(V);
    const hit = await c.match(req, { ignoreSearch: true });

    // Serve cached copy immediately, then refresh it quietly in the background.
    if (hit) {
      fetch(req).then(res => { if (res && res.ok) c.put(req, res.clone()); }).catch(() => {});
      return hit;
    }

    try {
      const res = await fetch(req);
      if (res && res.ok) c.put(req, res.clone());
      return res;
    } catch (err) {
      const fallback = await c.match('index.html');
      if (fallback && req.mode === 'navigate') return fallback;
      return new Response('Offline', { status: 503, statusText: 'Offline' });
    }
  })());
});
