const CACHE = 'drone-photo-mapper-v2';
const ASSETS = ['./', './index.html', './app.js', './core.js', './manifest.webmanifest', './icon.svg'];
self.addEventListener('install', event => {
    event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
});
self.addEventListener('activate', event => {
    event.waitUntil(caches.keys().then(keys => Promise.all(
        keys.filter(key => key.startsWith('drone-photo-mapper-') && key !== CACHE).map(key => caches.delete(key))
    )).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;
    const url = new URL(event.request.url);
    const local = url.origin === self.location.origin && ASSETS.some(asset => new URL(asset, self.registration.scope).href === url.href);
    const library = ['unpkg.com', 'cdnjs.cloudflare.com'].includes(url.hostname);
    // Consultas de endereço e tiles de mapas não são armazenados em massa.
    if (!local && !library) return;
    event.respondWith(fetch(event.request).then(async response => {
        if (response.ok || response.type === 'opaque') {
            const cache = await caches.open(CACHE);
            await cache.put(event.request, response.clone());
        }
        return response;
    }).catch(async () => {
        const cached = await caches.match(event.request, { cacheName: CACHE });
        return cached || Response.error();
    }));
});
