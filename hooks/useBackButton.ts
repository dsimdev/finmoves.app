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

  // Asegura el trap arriba en cada tab raíz.
  useEffect(() => {
    if (typeof window === "undefined" || !ROOT.includes(pathname)) return;
    const st = window.history.state as { __fmTrap?: boolean } | null;
    if (!st?.__fmTrap) window.history.pushState({ __fmTrap: true }, "");
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
      window.history.pushState({ __fmTrap: true }, ""); // re-armar: quedarse
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
