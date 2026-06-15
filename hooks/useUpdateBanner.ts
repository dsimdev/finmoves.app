"use client";

import { useEffect, useState } from "react";

// Aviso de actualización: aparece cuando hay un service worker NUEVO en espera
// (cada deploy genera un sw.js distinto → queda "waiting"). El banner es
// persistente (sin descartar): solo se va cuando el usuario toca "Actualizar",
// que activa el SW nuevo (SKIP_WAITING) y recarga la app con la última versión.
// No se muestra en la primera instalación (no hay controller previo).
export function useUpdateBanner() {
  const [show, setShow] = useState(false);
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    let cancelled = false;

    const flag = (sw: ServiceWorker | null) => {
      if (cancelled || !sw) return;
      // controller presente = ya había una versión instalada → es una actualización real
      if (!navigator.serviceWorker.controller) return;
      setWaiting(sw);
      setShow(true);
    };

    navigator.serviceWorker.getRegistration().then((reg) => {
      if (!reg || cancelled) return;
      flag(reg.waiting);
      reg.addEventListener("updatefound", () => {
        const sw = reg.installing;
        if (!sw) return;
        sw.addEventListener("statechange", () => {
          if (sw.state === "installed") flag(sw);
        });
      });
    });

    return () => { cancelled = true; };
  }, []);

  const update = () => {
    if (!waiting) { window.location.reload(); return; }
    // Recargar una sola vez cuando el SW nuevo tome control.
    navigator.serviceWorker.addEventListener("controllerchange", () => window.location.reload(), { once: true });
    waiting.postMessage({ type: "SKIP_WAITING" });
  };

  return { show, update };
}
