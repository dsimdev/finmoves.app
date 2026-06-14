"use client";

import { useEffect, useState } from "react";
import { parseChangelogVersions, releasesSince, UPDATE_BANNER_THRESHOLD } from "@/lib/changelog-versions";

const LS_KEY = "finmoves.lastSeenVersion";

// Muestra el aviso de novedades solo cuando pasaron >= 5 versiones desde la
// última que el usuario vio. No actualiza "lo visto" hasta que el banner se
// abre/cierra, así la cuenta se acumula entre parches en vez de resetearse.
export function useUpdateBanner() {
  const [show, setShow] = useState(false);
  const current = process.env.NEXT_PUBLIC_APP_VERSION ?? "";

  useEffect(() => {
    if (!current) return;
    const lastSeen = localStorage.getItem(LS_KEY);
    // Instalación nueva: marcar visto y no molestar.
    if (!lastSeen) { localStorage.setItem(LS_KEY, current); return; }
    if (lastSeen === current) return;

    let cancel = false;
    (async () => {
      try {
        const res = await fetch("/api/changelog");
        const versions = parseChangelogVersions(await res.text());
        if (!cancel && releasesSince(versions, lastSeen, current) >= UPDATE_BANNER_THRESHOLD) {
          setShow(true);
        }
        // Si son menos de 5, NO tocamos lastSeen → se acumula para la próxima.
      } catch { /* sin red: no mostramos nada */ }
    })();
    return () => { cancel = true; };
  }, [current]);

  const dismiss = () => {
    localStorage.setItem(LS_KEY, current);
    setShow(false);
  };

  return { show, dismiss };
}
