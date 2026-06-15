"use client";

import { useEffect, useState } from "react";

// Aviso de actualización. Aparece cuando el server reporta una versión distinta de
// la que corre el cliente (cualquier actualización). Es persistente: "Actualizar"
// activa el SW nuevo (SKIP_WAITING) y recarga.
export function useUpdateBanner() {
  const [show, setShow] = useState(false);
  const current = process.env.NEXT_PUBLIC_APP_VERSION ?? "";

  useEffect(() => {
    if (typeof window === "undefined" || !current) return;
    let cancelled = false;

    const check = async () => {
      try {
        const res = await fetch("/api/app-version", { cache: "no-store" });
        const data = await res.json();
        const serverV = data?.version as string | undefined;
        if (cancelled || !serverV || serverV === current) return;
        setShow(true); // cualquier versión nueva → mostrar banner
      } catch { /* sin red: no mostramos nada */ }
    };

    check();
    const onVisible = () => { if (document.visibilityState === "visible") check(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { cancelled = true; document.removeEventListener("visibilitychange", onVisible); };
  }, [current]);

  const update = async () => {
    try {
      const reg = await navigator.serviceWorker?.getRegistration();
      if (reg?.waiting) {
        // Recargar una sola vez cuando el SW nuevo tome control.
        navigator.serviceWorker.addEventListener("controllerchange", () => window.location.reload(), { once: true });
        reg.waiting.postMessage({ type: "SKIP_WAITING" });
        return;
      }
    } catch { /* cae al reload directo */ }
    window.location.reload();
  };

  return { show, update };
}
