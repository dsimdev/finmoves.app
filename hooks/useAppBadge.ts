"use client";

import { useEffect } from "react";

// Muestra un contador en el ícono de la app instalada (Badging API).
// Si el valor es 0/null o el navegador no lo soporta, limpia el badge.
export function useAppBadge(count: number | null | undefined) {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("setAppBadge" in navigator)) return;
    const nav = navigator as Navigator & {
      setAppBadge: (count?: number) => Promise<void>;
      clearAppBadge: () => Promise<void>;
    };
    if (count && count > 0) nav.setAppBadge(count).catch(() => {});
    else nav.clearAppBadge().catch(() => {});
  }, [count]);
}
