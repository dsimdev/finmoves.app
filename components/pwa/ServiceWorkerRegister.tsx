"use client";

import { useEffect } from "react";
import { useSwUpdate } from "@/hooks/useSwUpdate";

export function ServiceWorkerRegister() {
  const setWaiting = useSwUpdate((s) => s.setWaiting);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    let reg: ServiceWorkerRegistration | null = null;

    const onLoad = async () => {
      try {
        reg = await navigator.serviceWorker.register("/sw.js");

        // Si ya hay un SW esperando al cargar, avisar de una.
        if (reg.waiting && navigator.serviceWorker.controller) setWaiting(reg.waiting);

        // Cuando aparece un SW nuevo, esperar a que termine de instalarse.
        reg.addEventListener("updatefound", () => {
          const nw = reg!.installing;
          if (!nw) return;
          nw.addEventListener("statechange", () => {
            if (nw.state === "installed" && navigator.serviceWorker.controller) {
              setWaiting(nw);
            }
          });
        });

        // Buscar actualizaciones cada 60s y al volver a foco.
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
  }, [setWaiting]);

  return null;
}
