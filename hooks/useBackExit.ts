"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { isModalOpen } from "@/hooks/useModalBack";

// Tabs raíz (deben coincidir con BottomNav): solo ahí el "atrás" saldría de la app.
const ROOT = ["/", "/movements", "/investments", "/reports", "/settings"];

// Doble-back para salir (estilo Android nativo): en una tab raíz, el primer "atrás"
// muestra un aviso y se queda; el segundo dentro de ~2s cierra la app.
//
// Cómo funciona: se "ceba" una entrada trampa en el historial para poder capturar el
// primer back (sin ella, Android cierra la PWA sin avisar). Al capturarlo, se re-ceba
// la trampa (el usuario se queda) y se arma una ventana; si vuelve a tocar atrás dentro
// de la ventana, se hace `history.back()` real → la app se cierra.
//
// Garantías: nunca deja al usuario atrapado (el segundo back SIEMPRE sale). Los modales
// siguen manejando su propio "atrás" (isModalOpen corta acá). En subpáginas (settings/*)
// el back navega normal (no arma nada). iOS standalone no tiene back físico → inocuo.
//
// NOTA: por la navegación mixta (tabs con replace, subpáginas con push, modales) esto
// puede mostrar el aviso al volver de una subpágina a su tab; nunca traba. Verificar en
// un Android real y ajustar la ventana si hace falta.
export function useBackExit(): boolean {
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  useEffect(() => { pathRef.current = pathname; }, [pathname]);

  const [hint, setHint] = useState(false);

  useEffect(() => {
    // Preservar el state de Next al cebar la trampa (mismo URL, no navega).
    window.history.pushState({ ...window.history.state, fmExit: true }, "");

    let armed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const onPop = () => {
      if (isModalOpen()) return;                 // el modal maneja su propio back
      if (!ROOT.includes(pathRef.current)) return; // subpágina → navegación normal
      if (armed) {                               // segundo back → salir de verdad
        armed = false;
        if (timer) clearTimeout(timer);
        setHint(false);
        window.history.back();
        return;
      }
      armed = true;
      window.history.pushState({ ...window.history.state, fmExit: true }, ""); // re-cebar
      setHint(true);
      navigator.vibrate?.(8);
      timer = setTimeout(() => { armed = false; setHint(false); }, 2000);
    };

    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      if (timer) clearTimeout(timer);
    };
  }, []);

  return hint;
}
