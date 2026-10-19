// Self-destructing service worker.
//
// Early builds of this app (commit "PWA") registered /service-worker.js with
// a cache-first fetch handler (cache "inside-invoice-v1" holding "/" and
// "/index.html"). Devices that installed the PWA back then still receive
// that cached HTML forever: the unregister script inside the current
// index.html never arrives, and this URL used to answer with the SPA's HTML
// fallback, which can never install as an update — a permanent zombie that
// blocked every deploy from reaching installed users.
//
// Publishing this valid script lets the browser's background update check
// succeed (the bytes differ): it activates immediately, deletes every cache,
// and unregisters itself. The next launch goes straight to the network.
// It intentionally has NO fetch handler — nothing is ever served from cache.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.map((name) => caches.delete(name)));
      await self.registration.unregister();
    })()
  );
});
