/* ═══════════════════════════════════════════════════════════════════════
   Service worker — the whole series, available with no network.

   Same shape as the options series: precache every page and the engine on
   install, serve from the cache afterwards, and the whole thing works with no
   network. PRECACHE must list every live page — a page missing from it is the
   one page that fails on a train, and nothing will tell you.

   Three strategies, and the split matters:

   · Navigations (opening a page) are network-first with a cache fallback, so
     a fresh deploy is picked up the moment the phone has signal, and the
     cached copy answers instantly when it does not.
   · Same-origin assets are cache-first, because lab.js and lab.css are
     versioned by the cache name — if they change, CACHE changes, and the old
     cache is deleted on activate.
   · Google Fonts are stale-while-revalidate against a separate cache that
     survives version bumps. Font files never change and re-downloading 200KB
     of Fraunces on every deploy would be rude.

   Bump CACHE whenever a page or an asset changes. build.py does not touch
   this file — the inlined dist/ copies are meant to be opened from disk and
   register nothing.
   ═══════════════════════════════════════════════════════════════════════ */
const CACHE = "chance-visually-v10";
const FONTS = "chance-visually-fonts";

/* Every URL is relative, so the worker works at / on a dev server and at
   /options-visually/ on Pages without a build step knowing the difference. */
const PRECACHE = [
  "./",
  "index.html",
  "odds.html",
  "ev.html",
  "shape.html",
  "dist.html",
  "sample.html",
  "bayes.html",
  "corr.html",
  "tails.html",
  "bet.html",
  "assets/lab.css",
  "assets/mobile.css",
  "assets/lab.js",
  "assets/stats.js",
  "assets/pwa.js",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/maskable-192.png",
  "icons/maskable-512.png",
  "icons/apple-touch-icon.png"
];

const isFont = url =>
  url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";

/* Firing 26 requests at once is enough to make some servers drop connections,
   and a dropped precache is the worst kind of failure here: the worker still
   activates, the reader is told the series is saved, and two pages are not.
   So: small batches, one retry each, and a truthful report at the end. */
async function precache(cache, urls, batch) {
  const missing = [];
  for (let i = 0; i < urls.length; i += batch) {
    const slice = urls.slice(i, i + batch);
    await Promise.all(slice.map(async u => {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const res = await fetch(new Request(u, { cache: "reload" }));
          if (!res.ok) throw new Error("HTTP " + res.status);
          await cache.put(u, res);
          return;
        } catch (err) {
          if (attempt) missing.push(u + " (" + err.message + ")");
        }
      }
    }));
  }
  return missing;
}

self.addEventListener("install", e => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const missing = await precache(cache, PRECACHE, 4);
    if (missing.length) console.warn("[sw] not precached:", missing);
    /* remembered so pwa.js can decide whether it may honestly say "offline" */
    self.__precacheMissing = missing.length;
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter(k => k !== CACHE && k !== FONTS)
      .map(k => caches.delete(k)));
    if (self.registration.navigationPreload) {
      await self.registration.navigationPreload.enable();
    }
    await self.clients.claim();
  })());
});

self.addEventListener("message", e => {
  if (e.data === "skip-waiting") { self.skipWaiting(); return; }

  /* "is the whole series actually here?" — asked by pwa.js before it claims
     anything about offline, and again on later visits so that gaps left by a
     bad connection heal instead of persisting silently. */
  if (e.data === "offline-status") {
    e.waitUntil((async () => {
      const cache = await caches.open(CACHE);
      let missing = [];
      for (const u of PRECACHE) if (!(await cache.match(u))) missing.push(u);
      if (missing.length) missing = await precache(cache, missing, 4);
      const port = e.ports && e.ports[0];
      const payload = { type: "offline-status", total: PRECACHE.length,
        pages: PRECACHE.filter(u => u.endsWith(".html")).length,
        missing: missing.length, complete: missing.length === 0 };
      if (port) port.postMessage(payload);
      else (await self.clients.matchAll()).forEach(c => c.postMessage(payload));
    })());
  }
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  /* fonts — serve what we have, refresh in the background */
  if (isFont(url)) {
    e.respondWith((async () => {
      const cache = await caches.open(FONTS);
      const hit = await cache.match(req);
      const net = fetch(req).then(res => {
        /* an opaque response still caches and still renders */
        if (res && (res.ok || res.type === "opaque")) cache.put(req, res.clone());
        return res;
      }).catch(() => null);
      return hit || (await net) || Response.error();
    })());
    return;
  }

  if (url.origin !== self.location.origin) return;

  /* navigations — network first, so a deploy lands as soon as there is signal */
  if (req.mode === "navigate") {
    e.respondWith((async () => {
      try {
        const preload = await e.preloadResponse;
        const res = preload || await fetch(req);
        const cache = await caches.open(CACHE);
        cache.put(req, res.clone());
        return res;
      } catch (err) {
        const cache = await caches.open(CACHE);
        return (await cache.match(req)) ||
               (await cache.match(new URL("index.html", self.location).href)) ||
               (await cache.match("index.html")) ||
               new Response(
                 "<!doctype html><meta charset=utf-8><title>Offline</title>" +
                 "<style>body{font:16px/1.6 system-ui;margin:12vh auto;max-width:32ch;" +
                 "padding:0 24px;background:#F4F1E8;color:#1A1714}</style>" +
                 "<h1>Not cached yet</h1><p>Open this page once with a connection " +
                 "and it will be available offline from then on.</p>",
                 { headers: { "Content-Type": "text/html; charset=utf-8" } });
      }
    })());
    return;
  }

  /* everything else same-origin — cache first */
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res.ok) cache.put(req, res.clone());
      return res;
    } catch (err) {
      return Response.error();
    }
  })());
});
