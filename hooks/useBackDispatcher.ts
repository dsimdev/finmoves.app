"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { doubleBackEnabled, anyModalOpen, closeTopModal, HOME } from "@/lib/back-dispatcher";

// Único dueño del botón "atrás" cuando el flag `fmDoubleBack` está ON. Se monta una
// sola vez (en el layout de tabs, vía BackExitToast). Implementa el patrón nativo de
// Android: modal → cerrar; subpágina → volver al padre; tab ≠ Inicio → ir a Inicio;
// en Inicio → doble-back para salir.
//
// Mecánica del "trap": mientras estamos en un tab raíz, mantenemos una entrada extra
// de history marcada con __fmTrap arriba de todo. En cada popstate miramos el estado
// DESPUÉS del pop:
//  - aterrizamos SOBRE un trap (state.__fmTrap truthy) → fue un back in-app
//    (subpágina → padre). Next ya renderizó; no hacemos nada.
//  - consumimos el trap (aterrizamos en entrada real, falsy) → back "de salida":
//    modal → cerrar; tab ≠ Inicio → replace(HOME); Inicio → doble-back.
// Los modales (flag ON) NO empujan history: se registran en el dispatcher. Por eso
// un solo listener alcanza y no hay peleas (el bug que rompió prod en v2.59.x).

const ROOT_TABS = ["/", "/movements", "/investments", "/reports", "/settings"];
const EXIT_WINDOW_MS = 2000;

function isRootTab(path: string) {
  return ROOT_TABS.includes(path);
}

function trapArmed() {
  return !!(window.history.state as { __fmTrap?: boolean } | null)?.__fmTrap;
}

// Empuja el trap preservando el state de Next (sin el spread, el popstate no dispara
// por el bailout del router y la app sale sin toast).
function armTrap() {
  if (trapArmed()) return;
  window.history.pushState({ ...window.history.state, __fmTrap: true }, "");
}

export function useBackDispatcher(onExitHint: () => void) {
  const router = useRouter();
  const pathname = usePathname();
  const lastBack = useRef(0);
  const onHint = useRef(onExitHint);
  useEffect(() => { onHint.current = onExitHint; });

  // Re-armar el trap al aterrizar en un tab raíz. Los tabs navegan con `replace`, que
  // se come el trap; las subpáginas NO llevan trap (su back debe volver al padre).
  useEffect(() => {
    if (!doubleBackEnabled()) return;
    if (isRootTab(pathname)) armTrap();
  }, [pathname]);

  useEffect(() => {
    if (!doubleBackEnabled()) return;

    const onPop = () => {
      // 1) Modal abierto → el back lo cierra, y re-armamos el trap.
      if (anyModalOpen()) {
        closeTopModal();
        armTrap();
        return;
      }

      // 2) Aterrizamos sobre un trap → back in-app (subpágina → padre). No tocar.
      if (trapArmed()) return;

      // 3) Consumimos el trap → back de salida.
      const path = window.location.pathname;
      if (path !== HOME) {
        // Tab ≠ Inicio → ir a Inicio. El efecto de pathname re-arma el trap allá.
        router.replace(HOME);
        return;
      }

      // 4) En Inicio → doble-back para salir.
      const now = Date.now();
      if (now - lastBack.current < EXIT_WINDOW_MS) {
        // Segundo back dentro de la ventana: dejamos salir. No re-armamos → el back
        // agota el historial y Android cierra la PWA.
        window.history.back();
        return;
      }
      lastBack.current = now;
      onHint.current();
      armTrap();
    };

    window.addEventListener("popstate", onPop);
    if (isRootTab(window.location.pathname)) armTrap();
    return () => window.removeEventListener("popstate", onPop);
  }, [router]);
}
