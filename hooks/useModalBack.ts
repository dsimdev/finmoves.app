"use client";

import { useEffect, useRef } from "react";

// Hace que el botón "atrás" del navegador/Android cierre el modal abierto en vez de
// salir de la app. Cada modal abierto agrega una entrada al historial; "atrás" la
// saca y dispara onClose. Si el modal se cierra por botón/backdrop, sacamos esa
// entrada nosotros (suppress evita que ese popstate se interprete como cierre).
//
// onClose se guarda en una ref para que el efecto corra SOLO al abrir/cerrar y no en
// cada render (si dependiera de la identidad de onClose se re-montaría en cada render
// y el modal se cerraría solo).
let openCount = 0;
let suppress = false;

export function isModalOpen() {
  return openCount > 0;
}

export function useModalBack(open: boolean, onClose: () => void) {
  const cb = useRef(onClose);
  useEffect(() => { cb.current = onClose; });

  useEffect(() => {
    if (!open) return;
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
