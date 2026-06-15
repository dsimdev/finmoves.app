"use client";

import { useEffect } from "react";

// Bloquea el scroll del fondo mientras `active` sea true (modal abierto).
// Usa un contador en el body para componer varios locks sin pisarse.
export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active || typeof document === "undefined") return;
    const body = document.body;
    const n = Number(body.dataset.scrollLocks ?? "0") + 1;
    body.dataset.scrollLocks = String(n);
    if (n === 1) body.style.overflow = "hidden";
    return () => {
      const left = Number(body.dataset.scrollLocks ?? "1") - 1;
      body.dataset.scrollLocks = String(Math.max(0, left));
      if (left <= 0) body.style.overflow = "";
    };
  }, [active]);
}
