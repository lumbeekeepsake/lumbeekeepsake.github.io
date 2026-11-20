// Lumbee Keepsake offline support.
//   App files (/_expo/..., /assets/..., icons) have a fingerprint in their
//   name, so once saved they never change: served from the cache first.
//   The page itself, and the photo list / places from GitHub: fetched fresh
//   when online, with the last saved copy used when offline.
//   Photos from GitHub: cache first (an approved photo never changes).
//   Map tiles are not saved (the tile services ask apps not to stockpile them).
// mwpi9kto is replaced by tools/web/build.mjs on every build, which retires
// the previous build's saved files.
const CACHE = "lk-mwpi9kto";
const SHELL = ["/", "/manifest.webmanifest", "/icons/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const save = (req, res) => {
  if (res && res.ok) {
    const copy = res.clone();
    caches.open(CACHE).then((c) => c.put(req, copy));
  }
  return res;
};
const cacheFirst = (req) => caches.match(req).then((hit) => hit || fetch(req).then((res) => save(req, res)));
const networkFirst = (req) => fetch(req).then((res) => save(req, res)).catch(() => caches.match(req));

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    if (req.mode === "navigate") {
      event.respondWith(networkFirst(req).then((res) => res || caches.match("/")));
    } else if (/^\/(_expo|assets|icons)\//.test(url.pathname)) {
      event.respondWith(cacheFirst(req));
    } else {
      event.respondWith(networkFirst(req));
    }
    return;
  }

  if (url.hostname === "raw.githubusercontent.com") {
    event.respondWith(/\/photos\/[^/]+$/.test(url.pathname) ? cacheFirst(req) : networkFirst(req));
  }
  // Everything else (map tiles, outside links) goes straight to the network.
});
