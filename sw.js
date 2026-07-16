// Service Worker der Roadtrip-Karte: macht Seite + Karten-Kacheln offline nutzbar.
// Seite (Shell): network-first mit Cache-Fallback. Kacheln: cache-first.
const SHELL = 'vc-shell-v1';
const TILES = 'vc-tiles-v1';

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(SHELL).then(c => c.addAll(['./'])).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== SHELL && k !== TILES).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Karten-Kacheln: cache-first; Cache-Schluessel unabhaengig von der CDN-Subdomain
  if (url.hostname.endsWith('basemaps.cartocdn.com')) {
    const key = 'https://a.basemaps.cartocdn.com' + url.pathname;
    e.respondWith(
      caches.open(TILES).then(async c => {
        const hit = await c.match(key);
        if (hit) return hit;
        const res = await fetch(e.request);
        if (res && (res.ok || res.type === 'opaque')) c.put(key, res.clone());
        return res;
      }).catch(() => new Response('', { status: 503 }))
    );
    return;
  }

  // Die Seite selbst: frisch vom Netz, offline aus dem Cache
  if (e.request.mode === 'navigate') {
    e.respondWith(
      // no-cache: immer beim Server revalidieren, sonst klebt der Browser-HTTP-Cache
      fetch(e.request.url, { cache: 'no-cache' }).then(res => {
        const copy = res.clone();
        caches.open(SHELL).then(c => c.put('./', copy));
        return res;
      }).catch(() => caches.match('./'))
    );
  }
});
