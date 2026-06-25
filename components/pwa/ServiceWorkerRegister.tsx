"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    let reg: ServiceWorkerRegistration | null = null;

    // Al abrir/enfocar la app, las notificaciones se dan por vistas: limpiar el
    // badge del ícono y reiniciar el contador que lleva el SW en IndexedDB.
    const clearBadge = () => {
      const nav = navigator as Navigator & { clearAppBadge?: () => Promise<void> };
      nav.clearAppBadge?.().catch(() => {});
      navigator.serviceWorker.controller?.postMessage({ type: "CLEAR_BADGE" });
    };

    const onLoad = async () => {
      try {
        reg = await navigator.serviceWorker.register("/sw.js");

        clearBadge();

        // Buscar actualizaciones periódicamente y al volver a foco. Sin banner:
        // el SW nuevo queda en espera y se activa solo en el próximo arranque
        // en frío (cuando se cierran todas las ventanas de la app).
        const check = () => reg?.update().catch(() => {});
        const id = setInterval(check, 60_000);
        const onVisible = () => { if (document.visibilityState === "visible") { check(); clearBadge(); } };
        document.addEventListener("visibilitychange", onVisible);

        // Sin reload en `controllerchange`: el SW nuevo se activa solo en el próximo
        // arranque en frío. Recargar acá interrumpía el desbloqueo por huella y tapaba
        // el aviso de novedades antes de que llegue a mostrarse.

        return () => { clearInterval(id); document.removeEventListener("visibilitychange", onVisible); };
      } catch (err) {
        console.error("SW registration failed:", err);
      }
    };

    window.addEventListener("load", onLoad);
    return () => window.removeEventListener("load", onLoad);
  }, []);

  return null;
}
