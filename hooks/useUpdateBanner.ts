"use client";

import { useEffect, useState } from "react";

// Compara dos versiones "x.y.z". Devuelve true si `server` trae un salto de
// MAJOR o MINOR respecto de `client` (los cambios grandes que conviene aplicar ya).
// Un salto solo de PATCH devuelve false: se actualiza solo en el próximo arranque
// en frío, sin molestar.
function esMinorOMajor(client: string, server: string): boolean {
  const [a1, b1] = client.split(".").map((n) => parseInt(n, 10) || 0);
  const [a2, b2] = server.split(".").map((n) => parseInt(n, 10) || 0);
  if (a2 > a1) return true;            // major
  if (a2 === a1 && b2 > b1) return true; // minor
  return false;                        // patch o igual
}

// Aviso de actualización. La app se auto-actualiza sola en el próximo arranque en
// frío (sin molestar); este banner solo aparece cuando hay una versión nueva Y
// es minor/major (cambio relevante) o el server la marca como requerida
// (REQUIRE_UPDATE, para un patch crítico). Es persistente: "Actualizar" activa el
// SW nuevo (SKIP_WAITING) y recarga.
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
        if (data?.required || esMinorOMajor(current, serverV)) setShow(true);
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
