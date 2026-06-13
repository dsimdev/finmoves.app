"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    let reg: ServiceWorkerRegistration | null = null;

    const onLoad = async () => {
      try {
        reg = await navigator.serviceWorker.register("/sw.js");

        // Buscar actualizaciones periódicamente y al volver a foco. Sin banner:
        // el SW nuevo queda en espera y se activa solo en el próximo arranque
        // en frío (cuando se cierran todas las ventanas de la app).
        const check = () => reg?.update().catch(() => {});
        const id = setInterval(check, 60_000);
        const onVisible = () => { if (document.visibilityState === "visible") check(); };
        document.addEventListener("visibilitychange", onVisible);

        // Cuando el SW nuevo toma control (tras SKIP_WAITING), recargar una sola vez.
        let reloaded = false;
        navigator.serviceWorker.addEventListener("controllerchange", () => {
          if (reloaded) return;
          reloaded = true;
          window.location.reload();
        });

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
