// Offline cache: the app shell is fetched fresh when online, models and textures are kept once downloaded.
const CACHE = 'hanuman-mission-v5';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (req.headers.has('range') || /\.(mp3|ogg|m4a)($|\?)/.test(req.url)) return;      // sound goes straight to the network: a phone asks for it in pieces
  const heavy = /\/(assets|ui)\/.*\.(glb|jpg|png|webp|woff2)$/.test(req.url);
  e.respondWith(caches.open(CACHE).then(async cache => {
    const hit = await cache.match(req);
    if (heavy && hit) return hit;
    try {
      const res = await fetch(req);
      if (res.ok) cache.put(req, res.clone());
      return res;
    } catch (err) {
      if (hit) return hit;
      throw err;
    }
  }));
});
// The first visit loads before this worker is in control: the page then sends the list of files it used.
self.addEventListener('message', e => {
  const urls = e.data && e.data.cache;
  if (Array.isArray(urls)) e.waitUntil(caches.open(CACHE).then(c => Promise.all(urls.map(u => c.add(u).catch(() => null)))));
});
