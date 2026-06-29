"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAppPrefs } from "@/hooks/useAppPrefs";
import { isModalOpen } from "@/hooks/useModalBack";

// Orden de navegación: debe coincidir con BottomNav.
const ORDER = ["/", "/movements", "/investments", "/reports", "/settings"] as const;

/**
 * Swipe horizontal para cambiar de pestaña respetando el orden del nav y las
 * pestañas ocultas. Ignora gestos que empiezan dentro de un [data-no-swipe]
 * (carruseles, chips scrolleables, visor de comprobantes, hoja de carga) y los
 * que arrancan pegados al borde izquierdo (back gesture de iOS).
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
    if (idx === -1) return; // no estamos en una pestaña conocida

    let startX = 0;
    let startY = 0;
    let tracking = false;

    // ¿El gesto arranca dentro de algo scrolleable horizontalmente (gráficos,
    // carruseles, chips)? Si sí, el swipe es para ESE elemento, no para cambiar tab.
    const enScrollHorizontal = (el: HTMLElement | null): boolean => {
      let node: HTMLElement | null = el;
      while (node && node !== document.body) {
        if (node.scrollWidth > node.clientWidth + 4) {
          const ox = getComputedStyle(node).overflowX;
          if (ox === "auto" || ox === "scroll") return true;
        }
        node = node.parentElement;
      }
      return false;
    };

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      if (isModalOpen()) return; // con un modal abierto no se cambia de sección
      const t = e.touches[0];
      const target = e.target as HTMLElement | null;
      if (target?.closest("[data-no-swipe]")) return;
      if (enScrollHorizontal(target)) return; // carrusel/gráfico → no cambiar de tab
      if (t.clientX < 24 || t.clientX > window.innerWidth - 24) return; // bordes
      startX = t.clientX;
      startY = t.clientY;
      tracking = true;
    };

    const onEnd = (e: TouchEvent) => {
      if (!tracking) return;
      tracking = false;
      const t = e.changedTouches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      if (Math.abs(dx) < 80 || Math.abs(dx) < Math.abs(dy) * 2) return;
      // replace (no push): así "atrás" no recorre el historial de pestañas, sale de la app.
      if (dx < 0 && idx < tabs.length - 1) router.replace(tabs[idx + 1]);
      else if (dx > 0 && idx > 0) router.replace(tabs[idx - 1]);
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchend", onEnd);
    };
  }, [router, pathname, showReportes, showAhorros]);
}
