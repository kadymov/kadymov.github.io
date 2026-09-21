const VERSION = '692e176816b97ebd';
const ASSETS = ["./","./icons/apple-touch-icon.png","./icons/icon-192.png","./icons/icon-512.png","./icons/icon.svg","./index.html","./manifest.webmanifest","./src/casework.js","./src/conversations.js","./src/details.js","./src/engine.js","./src/evidence.js","./src/greetings.js","./src/life.js","./src/presentation.js","./src/story.js","./src/world-clock.js","./src/world.js","./web/app.js","./web/input.js","./web/map.js","./web/session.js","./web/storage.js","./web/style.css"];
// Include scope in the cache name so two installations on one host stay separate.
const PREFIX = `section-nine:${self.registration.scope}:`;
const CACHE = PREFIX + VERSION;
const urls = ASSETS.map(asset => new URL(asset, self.registration.scope).href);
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    try { await cache.addAll(urls); } catch (error) { await caches.delete(CACHE); throw error; }
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    await Promise.all((await caches.keys()).filter(key => key.startsWith(PREFIX) && key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener('message', event => {
  if (event.data?.type === 'ACTIVATE_UPDATE') self.skipWaiting();
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (!url.href.startsWith(self.registration.scope)) return;
  const navigation = request.mode === 'navigate';
  const asset = navigation ? new URL('./index.html', self.registration.scope).href : url.href;
  if (!navigation && !urls.includes(asset)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    return await cache.match(asset) || fetch(request);
  })());
});
