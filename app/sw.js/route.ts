import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// El service worker se sirve desde aquí (no desde /public) para inyectar la versión
// del build. Así cada deploy produce un sw.js distinto → el navegador detecta la
// actualización, instala el SW nuevo y lo deja "en espera" (sin activarse solo).
// La app muestra el banner y, al confirmar, le manda SKIP_WAITING para activarlo.
export function GET() {
  const version = process.env.NEXT_PUBLIC_APP_VERSION ?? "0";

  const sw = `
const VERSION = ${JSON.stringify(version)};
const CACHE = "finmoves-" + VERSION;
const PRECACHE = [
  "/", "/login", "/offline", "/manifest.json",
  "/favicon.png", "/logo5-cropped.png",
  "/icon-192.png", "/icon-512.png", "/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  // addAll falla entero si un recurso 404ea; cacheamos best-effort uno por uno.
  event.waitUntil(caches.open(CACHE).then((c) =>
    Promise.all(PRECACHE.map((u) => c.add(u).catch(() => {})))
  ));
  // NO skipWaiting: el SW nuevo queda en espera hasta que el usuario confirme.
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Navigation preload: arranca la request de navegación en paralelo al SW.
      if (self.registration.navigationPreload) {
        try { await self.registration.navigationPreload.enable(); } catch (e) {}
      }
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

// ── Contador de notificaciones sin leer (Badging API) ──────────────────────────
// Persistido en IndexedDB porque el SW se reinicia entre pushes y perdería una
// variable en memoria. getAppBadge no existe, así que llevamos el conteo nosotros.
function badgeDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("finmoves-badge", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("kv");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
function badgeGet(db) {
  return new Promise((resolve) => {
    const tx = db.transaction("kv", "readonly").objectStore("kv").get("count");
    tx.onsuccess = () => resolve(tx.result || 0);
    tx.onerror = () => resolve(0);
  });
}
function badgePut(db, n) {
  return new Promise((resolve) => {
    const tx = db.transaction("kv", "readwrite").objectStore("kv").put(n, "count");
    tx.onsuccess = () => resolve();
    tx.onerror = () => resolve();
  });
}
async function bumpBadge() {
  try {
    const db = await badgeDB();
    const n = (await badgeGet(db)) + 1;
    await badgePut(db, n);
    if (self.navigator && self.navigator.setAppBadge) await self.navigator.setAppBadge(n);
  } catch (e) {}
}
async function resetBadge() {
  try {
    const db = await badgeDB();
    await badgePut(db, 0);
    if (self.navigator && self.navigator.clearAppBadge) await self.navigator.clearAppBadge();
  } catch (e) {}
}

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
  if (event.data && event.data.type === "CLEAR_BADGE") event.waitUntil(resetBadge());
});

self.addEventListener("push", (event) => {
  let data = { title: "FinMoves", body: "", tag: "finmoves", url: "/" };
  try { if (event.data) data = Object.assign(data, event.data.json()); } catch (e) {}
  event.waitUntil(
    Promise.all([
      self.registration.showNotification(data.title, {
        body: data.body,
        tag: data.tag,
        icon: "/favicon.png",
        badge: "/favicon.png",
        data: { url: data.url || "/" },
      }),
      bumpBadge(),
    ])
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) { if ("focus" in c) { c.navigate(url); return c.focus(); } }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api")) return;
  if (url.pathname === "/sw.js") return;

  // Assets inmutables (hash en el nombre) → cache-first, sin revalidar.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(req).then((cached) => cached || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req.url, copy));
        return res;
      }))
    );
    return;
  }

  // Next.js RSC (Server Component Responses): detectar por URL o cabecera.
  // No se cachean, para evitar servir componentes viejos durante transiciones.
  const isRSC = url.pathname.startsWith("/_next/data/") || req.headers.get("next-router-state-tree");
  if (isRSC) {
    event.respondWith(
      fetch(req)
        .then((res) => res)
        .catch(() => caches.match(req))
    );
    return;
  }

  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          // Usar la respuesta del navigation preload si está disponible.
          const preload = await event.preloadResponse;
          const res = preload || await fetch(req);
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req.url, copy));
          return res;
        } catch (e) {
          return (await caches.match(req)) || (await caches.match("/")) || (await caches.match("/offline"));
        }
      })()
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return res; })
        .catch(() => cached);
      return cached || network;
    })
  );
});
`.trim();

  return new NextResponse(sw, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Service-Worker-Allowed": "/",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
