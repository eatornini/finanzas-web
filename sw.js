// Service worker de la app shell. Sin build: no hay lista de bundles con
// hash para precachear, así que los assets de src/** se van cacheando solos
// a medida que se piden (cache-first, con red de respaldo).
const CACHE_NAME = "finanzas-v1";
const PRECACHE = [
  "./",
  "index.html",
  "app.css",
  "manifest.webmanifest",
  "assets/icons/icono.svg",
  "src/main.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((nombres) => Promise.all(nombres.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          caches.open(CACHE_NAME).then((cache) => cache.put(request, res.clone()));
          return res;
        })
        .catch(() => caches.match(request).then((r) => r || caches.match("index.html")))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((res) => {
          if (res.ok) caches.open(CACHE_NAME).then((cache) => cache.put(request, res.clone()));
          return res;
        })
    )
  );
});
