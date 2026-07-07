"use client";

import { useEffect, useState } from "react";

// Aviso de actualización. Aparece cuando el server reporta una versión MINOR/MAJOR
// distinta (cambios relevantes) o cuando el server la marca como obligatoria
// (REQUIRE_UPDATE). Los patches solos NO muestran banner: se actualizan en el próximo
// arranque en frío. Es persistente: "Actualizar" activa el SW nuevo y recarga.
function esMinorOMajor(current: string, server: string): boolean {
  const [cMaj, cMin] = current.split(".").map(Number);
  const [sMaj, sMin] = server.split(".").map(Number);
  if (Number.isNaN(sMaj) || Number.isNaN(cMaj)) return true; // ante la duda, avisar
  if (sMaj !== cMaj) return true;
  return sMin !== cMin;
}

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
        // Patch solo → esperar al próximo arranque; minor/major u obligatoria → avisar.
        if (data?.required === true || esMinorOMajor(current, serverV)) setShow(true);
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
