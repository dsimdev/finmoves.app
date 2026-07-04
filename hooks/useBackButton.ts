"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { isModalOpen } from "@/hooks/useModalBack";

// Tabs raíz (deben coincidir con BottomNav).
const ROOT = ["/", "/movements", "/investments", "/reports", "/settings"];
const HOME = "/";

// Botón "atrás" estilo nativo (Android):
//  - Modal abierto → lo cierra (lo maneja useModalBack).
//  - Subpágina (ej. Config › Cuenta) → back natural a su tab padre.
//  - Tab raíz que NO es Inicio → va a Inicio.
//  - Inicio → doble-back para salir: primer atrás muestra el aviso; el segundo en ~2s
//    cierra la app (agota el historial).
//
// Mecánica: se mantiene un "trap" (entrada extra) arriba mientras estás en una tab raíz,
// para poder capturar el back (sin él, Android cierra la PWA sin avisar). Al capturarlo,
// se decide la navegación y se re-arma el trap.
//
// NOTA: la navegación mixta (tabs con replace, subpáginas con push) puede dejar residuos
// en el historial; si al salir hace falta un back de más tras pasear por varias tabs, se
// afina acá. Requiere prueba en Android real. Nunca deja atrapado (el back siempre avanza).
export function useBackButton(): boolean {
  const pathname = usePathname();
  const router = useRouter();
  const pathRef = useRef(pathname);
  useEffect(() => { pathRef.current = pathname; }, [pathname]);

  const [hint, setHint] = useState(false);
  const armedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Asegura el trap arriba al entrar a una tab raíz. Se empuja SIEMPRE (no se confía en
  // history.state, que persiste en la entrada al reabrir la PWA con launch navigate-existing
  // y hacía que el back saliera sin capturar). Trade-off: tras pasear por varias tabs puede
  // quedar residuo en el historial (salir necesita algún back de más); se afina después.
  useEffect(() => {
    if (typeof window === "undefined" || !ROOT.includes(pathname)) return;
    // Preservar el state del router de Next: sin esto, el back no dispara popstate
    // (Next se confunde) y la app cierra sin capturar. Con esto el trap sí funciona.
    window.history.pushState({ ...window.history.state, __fmTrap: true }, "");
  }, [pathname]);

  useEffect(() => {
    const onPop = () => {
      if (isModalOpen()) return;              // el modal maneja su propio back
      const path = pathRef.current;
      if (!ROOT.includes(path)) return;       // subpágina → back natural

      if (path !== HOME) {                     // tab raíz que no es Inicio → ir a Inicio
        router.replace(HOME);
        return;
      }

      // Inicio → doble-back para salir.
      if (armedRef.current) {                  // segundo atrás dentro de la ventana → salir
        armedRef.current = false;
        if (timerRef.current) clearTimeout(timerRef.current);
        setHint(false);
        window.history.back();                 // agota el historial → cierra la PWA
        return;
      }
      armedRef.current = true;
      window.history.pushState({ ...window.history.state, __fmTrap: true }, ""); // re-armar: quedarse
      setHint(true);
      navigator.vibrate?.(8);
      timerRef.current = setTimeout(() => { armedRef.current = false; setHint(false); }, 2000);
    };

    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [router]);

  return hint;
}
