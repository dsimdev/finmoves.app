"use client";

import { useCallback, useSyncExternalStore } from "react";

// Media query como estado de React. `useSyncExternalStore` en vez de useState+useEffect:
// evita el flash de un render con el valor equivocado y no necesita efecto de montaje.
// En el servidor devuelve `false` (no hay viewport): la app se pinta móvil-first y ajusta
// al hidratar, que es el orden correcto para no romper el SSR.

export function useMediaQuery(query: string): boolean {
  // subscribe y getSnapshot memoizados por query: si cambiaran de identidad en cada render,
  // useSyncExternalStore se re-suscribiría en bucle.
  const subscribe = useCallback((onChange: () => void) => {
    const mql = window.matchMedia(query);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);

  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

/** Desktop = donde la app deja de ser una columna y puede mostrar tableros. */
export const useIsDesktop = () => useMediaQuery("(min-width: 1200px)");
