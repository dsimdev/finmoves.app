"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useSwipeNav } from "@/hooks/useSwipeNav";

// Posición de scroll por tab (se restaura al volver, como una app nativa con bottom-nav).
const scrollStore = new Map<string, number>();

/** Swipe horizontal entre pestañas (ViewPager-like) + scroll restaurado por tab. */
export function SwipeNav({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const containerRef = useRef<HTMLDivElement>(null);
  const dirRef = useRef<0 | 1 | -1>(0);
  useSwipeNav(containerRef, dirRef);

  // Restaurar scroll al entrar; guardar el de la tab que se deja (cubre swipe y botones).
  useEffect(() => {
    const y = scrollStore.get(pathname) ?? 0;
    requestAnimationFrame(() => window.scrollTo(0, y));
    return () => { scrollStore.set(pathname, window.scrollY); };
  }, [pathname]);

  // La dirección solo aplica al primer render tras el swipe; después vuelve a 0 para que
  // una navegación por botón use el fade neutro.
  const dir = dirRef.current;
  useEffect(() => {
    const id = setTimeout(() => { dirRef.current = 0; }, 300);
    return () => clearTimeout(id);
  }, [pathname]);

  const anim = dir === 1 ? "slideInRight" : dir === -1 ? "slideInLeft" : "tabFade";
  return (
    <div key={pathname} ref={containerRef}
      style={{ animation: `${anim} 240ms cubic-bezier(0.22, 0.61, 0.36, 1) both`, willChange: "transform" }}>
      {children}
    </div>
  );
}
