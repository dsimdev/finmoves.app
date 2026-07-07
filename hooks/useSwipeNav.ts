"use client";

import { useEffect, type RefObject } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAppPrefs } from "@/hooks/useAppPrefs";
import { isModalOpen } from "@/hooks/useModalBack";

// Orden de navegación: debe coincidir con BottomNav.
const ORDER = ["/", "/movements", "/investments", "/reports", "/settings"] as const;

/**
 * Swipe horizontal entre pestañas estilo ViewPager: el contenido de la tab actual
 * SIGUE EL DEDO durante el arrastre y, al soltar pasado el umbral, sale y la tab
 * destino entra deslizando desde el lado correcto (la dirección la aplica SwipeNav vía
 * `dirRef`). Como cada tab es una ruta distinta (solo la activa está montada), la tab
 * destino no se ve hasta el commit — es lo máximo sin un rewrite single-route.
 *
 * Respeta orden y tabs ocultas, ignora gestos dentro de [data-no-swipe] o de algo con
 * scroll horizontal, los bordes (back-gesture iOS) y los modales abiertos.
 */
export function useSwipeNav(
  containerRef: RefObject<HTMLDivElement | null>,
  dirRef: RefObject<0 | 1 | -1>,
) {
  const router = useRouter();
  const pathname = usePathname();
  const { showReportes, showAhorros } = useAppPrefs();

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const tabs = ORDER.filter((href) => {
      if (href === "/reports" && !showReportes) return false;
      if (href === "/investments" && !showAhorros) return false;
      return true;
    });
    const idx = tabs.indexOf(pathname as (typeof ORDER)[number]);
    if (idx === -1) return;

    const W = () => window.innerWidth;
    const target = (dx: number): string | null => {
      if (dx < 0 && idx < tabs.length - 1) return tabs[idx + 1];
      if (dx > 0 && idx > 0) return tabs[idx - 1];
      return null;
    };

    // ¿El gesto arranca dentro de algo scrolleable en horizontal? Entonces es para ESE
    // elemento (gráfico/carrusel/chips), no para cambiar de tab.
    const enScrollHorizontal = (node: HTMLElement | null): boolean => {
      let n: HTMLElement | null = node;
      while (n && n !== document.body) {
        if (n.scrollWidth > n.clientWidth + 4) {
          const ox = getComputedStyle(n).overflowX;
          if (ox === "auto" || ox === "scroll") return true;
        }
        n = n.parentElement;
      }
      return false;
    };

    let startX = 0, startY = 0, dx = 0;
    let mode: "none" | "h" | "v" = "none";
    let active = false;

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1 || isModalOpen()) return;
      const t = e.touches[0];
      const tg = e.target as HTMLElement | null;
      if (tg?.closest("[data-no-swipe]") || enScrollHorizontal(tg)) return;
      if (t.clientX < 24 || t.clientX > W() - 24) return; // bordes
      startX = t.clientX; startY = t.clientY; dx = 0; mode = "none"; active = true;
    };

    const onMove = (e: TouchEvent) => {
      if (!active || mode === "v") return;
      const t = e.touches[0];
      const ddx = t.clientX - startX, ddy = t.clientY - startY;
      if (mode === "none") {
        if (Math.abs(ddx) < 8 && Math.abs(ddy) < 8) return;
        mode = Math.abs(ddx) > Math.abs(ddy) ? "h" : "v";
        if (mode === "v") return; // gesto vertical → dejar el scroll nativo
      }
      e.preventDefault(); // lock horizontal: frena el scroll vertical mientras arrastramos
      dx = ddx;
      const tx = target(dx) ? dx : dx * 0.28; // resistencia si no hay tab de ese lado
      el.style.transition = "none";
      el.style.transform = `translateX(${tx}px)`;
    };

    const onEnd = () => {
      if (!active) return;
      active = false;
      if (mode !== "h") return;
      const tgt = target(dx);
      if (tgt && Math.abs(dx) > W() * 0.28) {
        dirRef.current = dx < 0 ? 1 : -1; // 1 = entra desde la derecha, -1 desde la izquierda
        el.style.transition = "transform 0.2s ease-out";
        el.style.transform = `translateX(${dx < 0 ? -W() : W()}px)`;
        setTimeout(() => router.replace(tgt), 190);
      } else {
        el.style.transition = "transform 0.25s cubic-bezier(0.22,0.61,0.36,1)";
        el.style.transform = "translateX(0)";
      }
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd, { passive: true });
    el.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, [router, pathname, showReportes, showAhorros, containerRef, dirRef]);
}
