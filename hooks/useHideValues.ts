"use client";

import { useState, useEffect } from "react";

const KEY = "finmoves_hide";

// Estado compartido (vía localStorage) para ocultar montos sensibles en toda la app.
export function useHideValues() {
  const [oculto, setOculto] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(KEY) === "1";
  });

  // Sincroniza si cambia en otra pestaña
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setOculto(e.newValue === "1");
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const toggle = () =>
    setOculto((o) => {
      const n = !o;
      try { localStorage.setItem(KEY, n ? "1" : "0"); } catch {}
      return n;
    });

  return { oculto, toggle };
}
