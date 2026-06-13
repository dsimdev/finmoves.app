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

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("push", (event) => {
  let data = { title: "FinMoves", body: "", tag: "finmoves", url: "/" };
  try { if (event.data) data = Object.assign(data, event.data.json()); } catch (e) {}
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      tag: data.tag,
      icon: "/favicon.png",
      badge: "/favicon.png",
      data: { url: data.url || "/" },
    })
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

  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          // Usar la respuesta del navigation preload si está disponible.
          const preload = await event.preloadResponse;
          const res = preload || await fetch(req);
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
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
