"use client";

import { useEffect, useRef } from "react";
import { doubleBackEnabled, pushModalHandler, anyModalOpen } from "@/lib/back-dispatcher";

// Hace que el botón "atrás" del navegador/Android cierre el modal abierto en vez de
// salir de la app.
//
// Dos modos, según el flag `fmDoubleBack` (leído al abrir el modal):
//  - OFF (default): comportamiento clásico. Cada modal empuja una entrada al
//    historial; "atrás" la saca y dispara onClose. Si se cierra por botón/backdrop,
//    sacamos esa entrada nosotros (suppress evita contar ese popstate como cierre).
//  - ON: el modal se REGISTRA en lib/back-dispatcher y NO toca history. El único
//    listener de popstate (hooks/useBackDispatcher) lo cierra. Así no hay peleas
//    entre listeners (el bug que rompió prod en v2.59.x).
//
// onClose se guarda en una ref para que el efecto corra SOLO al abrir/cerrar y no en
// cada render (si dependiera de la identidad de onClose se re-montaría en cada render
// y el modal se cerraría solo).
let openCount = 0;
let suppress = false;

export function isModalOpen() {
  return openCount > 0 || anyModalOpen();
}

export function useModalBack(open: boolean, onClose: () => void) {
  const cb = useRef(onClose);
  useEffect(() => { cb.current = onClose; });

  useEffect(() => {
    if (!open) return;

    // Modo dispatcher (flag ON): registrar el cierre y no tocar history.
    if (doubleBackEnabled()) {
      return pushModalHandler(() => cb.current());
    }

    // Modo clásico (flag OFF).
    openCount++;
    window.history.pushState({ fmModal: true }, "");
    const onPop = () => {
      if (suppress) { suppress = false; return; }
      cb.current();
    };
    window.addEventListener("popstate", onPop);
    return () => {
      openCount--;
      window.removeEventListener("popstate", onPop);
      // Cerrado por botón/backdrop (la entrada sigue arriba) → la sacamos sin que
      // ese popstate cuente como un "atrás".
      if (window.history.state?.fmModal) {
        suppress = true;
        window.history.back();
      }
    };
  }, [open]);
}
