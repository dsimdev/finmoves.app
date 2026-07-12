"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

// Posición de scroll por tab (se restaura al volver, como una app nativa con bottom-nav).
const scrollStore = new Map<string, number>();

/** Scroll restaurado por tab + fade de transición. El swipe horizontal entre pestañas
 *  se ELIMINÓ a propósito (v2.74.0): chocaba con los gestos por fila (swipe-eliminar)
 *  y trababa mejoras de feeling native. No volver a agregarlo sin decisión del usuario. */
export function SwipeNav({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Restaurar scroll al entrar; guardar el de la tab que se deja (cubre swipe y botones).
  // Sin transforms en el contenedor: no rompe los `position: fixed` ni promueve una capa
  // GPU permanente (eso descolocaba el FAB/los modals y consumía batería).
  useEffect(() => {
    const y = scrollStore.get(pathname) ?? 0;
    requestAnimationFrame(() => window.scrollTo(0, y));
    return () => { scrollStore.set(pathname, window.scrollY); };
  }, [pathname]);

  return (
    <div key={pathname} style={{ animation: "tabFade 220ms ease-out" }}>
      {children}
    </div>
  );
}
