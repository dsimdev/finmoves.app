"use client";

import { useEffect, useState } from "react";

// Aviso de actualización OBLIGATORIA. La app se auto-actualiza sola en el próximo
// arranque en frío (sin molestar); este banner solo aparece cuando el server
// reporta `required: true` (release con cambios incompatibles, ver lib/app-version)
// Y la versión del server difiere de la que corre el cliente. Es persistente
// (sin descartar): "Actualizar" activa el SW nuevo (SKIP_WAITING) y recarga.
export function useUpdateBanner() {
  const [show, setShow] = useState(false);
  const current = process.env.NEXT_PUBLIC_APP_VERSION ?? "";

  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;

    const check = async () => {
      try {
        const res = await fetch("/api/app-version", { cache: "no-store" });
        const data = await res.json();
        if (!cancelled && data?.required && data?.version && data.version !== current) {
          setShow(true);
        }
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
