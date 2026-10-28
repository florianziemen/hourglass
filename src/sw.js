// Service worker template. The build (see vite.config.ts) replaces the two
// placeholders with a content hash and the list of all files in dist/.
const VERSION = "__VERSION__";
const PRECACHE = __PRECACHE__;
const CACHE = `hourglass-${VERSION}`;

// Precache the whole app on install so it works offline right after the first visit.
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        cache.addAll(PRECACHE.map((p) => new Request(p, { cache: "reload" }))),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("hourglass-") && k !== CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// Cache-first: every file is versioned by the cache name, and a new deployment
// installs a new worker (sw.js changes whenever any file changes).
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin)
    return;
  e.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const key = req.mode === "navigate" ? "./" : req;
      const hit = await cache.match(key, {
        ignoreSearch: true,
        ignoreVary: true,
      });
      return hit ?? fetch(req);
    })(),
  );
});
