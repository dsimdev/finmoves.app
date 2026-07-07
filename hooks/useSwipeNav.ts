"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAppPrefs } from "@/hooks/useAppPrefs";
import { isModalOpen } from "@/hooks/useModalBack";

// Orden de navegación: debe coincidir con BottomNav.
const ORDER = ["/", "/movements", "/investments", "/reports", "/settings"] as const;

// ¿El gesto arranca dentro de algo scrolleable en horizontal (gráfico/carrusel/chips)?
// Entonces es para ESE elemento, no para cambiar de tab.
function enScrollHorizontal(node: HTMLElement | null): boolean {
  let n: HTMLElement | null = node;
  while (n && n !== document.body) {
    if (n.scrollWidth > n.clientWidth + 4) {
      const ox = getComputedStyle(n).overflowX;
      if (ox === "auto" || ox === "scroll") return true;
    }
    n = n.parentElement;
  }
  return false;
}

/**
 * Swipe horizontal entre pestañas: se decide al soltar. NO seguimos el dedo con un
 * transform en el contenedor a propósito — eso lo convertía en containing-block y
 * descolocaba los `position: fixed` (FAB, modals) además de forzar una capa GPU
 * permanente que consumía batería. Respeta orden, tabs ocultas, [data-no-swipe],
 * scroll horizontal, bordes (back-gesture iOS) y modales abiertos.
 */
export function useSwipeNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { showReportes, showAhorros } = useAppPrefs();

  useEffect(() => {
    const tabs = ORDER.filter((href) => {
      if (href === "/reports" && !showReportes) return false;
      if (href === "/investments" && !showAhorros) return false;
      return true;
    });
    const idx = tabs.indexOf(pathname as (typeof ORDER)[number]);
    if (idx === -1) return;

    let startX = 0, startY = 0, tracking = false;

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1 || isModalOpen()) return;
      const t = e.touches[0];
      const tg = e.target as HTMLElement | null;
      if (tg?.closest("[data-no-swipe]") || enScrollHorizontal(tg)) return;
      if (t.clientX < 24 || t.clientX > window.innerWidth - 24) return; // bordes
      startX = t.clientX; startY = t.clientY; tracking = true;
    };

    const onEnd = (e: TouchEvent) => {
      if (!tracking) return;
      tracking = false;
      const t = e.changedTouches[0];
      const dx = t.clientX - startX, dy = t.clientY - startY;
      if (Math.abs(dx) < 80 || Math.abs(dx) < Math.abs(dy) * 2) return; // no fue swipe lateral
      const tgt = dx < 0
        ? (idx < tabs.length - 1 ? tabs[idx + 1] : null)
        : (idx > 0 ? tabs[idx - 1] : null);
      if (tgt) router.replace(tgt);
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchend", onEnd);
    };
  }, [router, pathname, showReportes, showAhorros]);
}
