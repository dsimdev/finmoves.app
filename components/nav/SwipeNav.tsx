"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useSwipeNav } from "@/hooks/useSwipeNav";

// Posición de scroll por tab (se restaura al volver, como una app nativa con bottom-nav).
const scrollStore = new Map<string, number>();

/** Swipe horizontal entre pestañas + scroll restaurado por tab. */
export function SwipeNav({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  useSwipeNav();

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
