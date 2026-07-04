"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { doubleBackEnabled, anyModalOpen, closeTopModal, dbgLog, HOME } from "@/lib/back-dispatcher";

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

// Mutar el history DENTRO del handler de popstate es frágil (el browser está en
// medio de su propia traversía y Next tiene su propio listener de popstate). Diferir
// a un tick posterior evita esa pelea — fue lo que hacía que en Inicio el back saliera
// sin emitir popstate ni mostrar el toast.
function defer(fn: () => void) {
  setTimeout(fn, 0);
}

// Empuja el trap preservando el state de Next (sin el spread, el popstate no dispara
// por el bailout del router y la app sale sin toast).
function armTrap() {
  if (trapArmed()) {
    dbgLog(`arm skip (ya armado) len=${window.history.length}`);
    return;
  }
  window.history.pushState({ ...window.history.state, __fmTrap: true }, "");
  dbgLog(`arm push len=${window.history.length} nowArmed=${trapArmed()}`);
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
    dbgLog(`path=${pathname} root=${isRootTab(pathname)} state.__fmTrap=${trapArmed()}`);
    if (isRootTab(pathname)) armTrap();
  }, [pathname]);

  useEffect(() => {
    if (!doubleBackEnabled()) return;

    dbgLog(`MOUNT path=${window.location.pathname} len=${window.history.length}`);

    const onPop = () => {
      const armed = trapArmed();
      const modal = anyModalOpen();
      const path = window.location.pathname;
      dbgLog(`POP len=${window.history.length} armed=${armed} modal=${modal} path=${path}`);

      // 1) Modal abierto → el back lo cierra, y re-armamos el trap.
      if (modal) {
        dbgLog("  -> cierro modal");
        closeTopModal();
        defer(armTrap);
        return;
      }

      // 2) Aterrizamos sobre un trap → back in-app (subpágina → padre). No tocar.
      if (armed) {
        dbgLog("  -> in-app back (sobre trap), no-op");
        return;
      }

      // 3) Consumimos el trap → back de salida.
      if (path !== HOME) {
        // Tab ≠ Inicio → ir a Inicio. El efecto de pathname re-arma el trap allá.
        dbgLog("  -> replace(HOME)");
        defer(() => router.replace(HOME));
        return;
      }

      // 4) En Inicio → doble-back para salir.
      const now = Date.now();
      if (now - lastBack.current < EXIT_WINDOW_MS) {
        dbgLog("  -> 2do back: SALIR (history.back)");
        defer(() => window.history.back());
        return;
      }
      dbgLog("  -> 1er back: toast + re-arm");
      lastBack.current = now;
      onHint.current();
      defer(armTrap);
    };

    const onHide = () => dbgLog(`PAGEHIDE len=${window.history.length} armed=${trapArmed()} path=${window.location.pathname}`);
    const onShow = (e: PageTransitionEvent) => dbgLog(`PAGESHOW persisted=${e.persisted} len=${window.history.length}`);

    window.addEventListener("popstate", onPop);
    window.addEventListener("pagehide", onHide);
    window.addEventListener("pageshow", onShow);
    if (isRootTab(window.location.pathname)) armTrap();
    return () => {
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("pagehide", onHide);
      window.removeEventListener("pageshow", onShow);
    };
  }, [router]);
}
