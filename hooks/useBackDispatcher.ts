"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { dispatcherActive, anyModalOpen, closeTopModal, HOME } from "@/lib/back-dispatcher";

// Dueño único del botón "atrás", montado 1 vez (en BackExitToast, dentro del layout
// de tabs). Patrón nativo Android: modal → cerrar; subpágina → volver al padre;
// tab ≠ Inicio → ir a Inicio; en Inicio → 1er back muestra toast, 2do cierra la app.
//
// Usa la Navigation API (Chromium / Android Chrome): el evento `navigate` de un
// traverse se dispara ANTES del back y es cancelable → `preventDefault()` lo frena
// sin rellenar history a ciegas. (Los ~7 intentos previos con `popstate` fallaron
// porque ese evento llega DESPUÉS, ya consumado, y pelea con el listener interno de
// Next.) Donde no hay Navigation API (iOS Safari / Firefox) no hace nada: back nativo.
//
// El único caso que necesita una entrada extra es el cierre en Inicio (ningún API
// evita que la PWA cierre con el history agotado): mantenemos un "backroom" debajo
// mientras estamos en un tab raíz, así el back es un traverse interceptable. En Inicio
// el 1er back muestra el toast y deja pasar al backroom (quedamos en el borde); el 2do
// back ya no dispara evento (borde) → la PWA cierra.

const ROOT_TABS = ["/", "/movements", "/investments", "/reports", "/settings"];
const EXIT_WINDOW_MS = 2000;

function isRootTab(path: string) {
  return ROOT_TABS.includes(path);
}

type NavEntry = { index: number; url: string | null };
type NavigateEvt = Event & {
  navigationType: "push" | "replace" | "reload" | "traverse";
  destination: { index: number; url: string };
  cancelable: boolean;
};
type NavigationApi = {
  currentEntry: NavEntry | null;
  canGoBack: boolean;
  addEventListener: (t: string, cb: (e: Event) => void) => void;
  removeEventListener: (t: string, cb: (e: Event) => void) => void;
};

function getNav(): NavigationApi | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { navigation?: NavigationApi }).navigation ?? null;
}

export function useBackDispatcher(onExitHint: () => void) {
  const router = useRouter();
  const onHint = useRef(onExitHint);
  useEffect(() => { onHint.current = onExitHint; });

  useEffect(() => {
    if (!dispatcherActive()) return;
    const nav = getNav();
    if (!nav) return;

    let exitArmedUntil = 0;

    // Garantiza un "backroom" debajo cuando estamos en un tab raíz, para que el back
    // sea un traverse interceptable y no un cierre directo. Se saltea durante la
    // ventana de salida (así el borde queda alcanzable y la PWA puede cerrar).
    const ensureBackroom = () => {
      if (!isRootTab(window.location.pathname)) return;
      if (nav.canGoBack) return;
      if (Date.now() < exitArmedUntil) return;
      window.history.pushState({ __fmRoom: 1 }, "", window.location.href);
    };

    const onNavigate = (evt: Event) => {
      const e = evt as NavigateEvt;
      if (e.navigationType !== "traverse") return;
      const cur = nav.currentEntry;
      if (!cur || typeof e.destination?.index !== "number") return;
      if (e.destination.index >= cur.index) return; // solo hacia atrás

      // OJO: Chrome hace los traverses cancelables solo con activación de usuario
      // reciente (haber tocado la página). Un back "en frío" llega con
      // cancelable=false: no se puede frenar, pero SÍ se puede reaccionar.
      const path = window.location.pathname;
      const cancel = () => { if (e.cancelable) { e.preventDefault(); return true; } return false; };

      // 1) Modal abierto → cerrarlo. Si no se pudo frenar el traverse, cae al
      //    backroom (misma URL, invisible) y lo re-armamos.
      if (anyModalOpen()) {
        closeTopModal();
        if (!cancel()) setTimeout(ensureBackroom, 0);
        return;
      }

      // 2) Subpágina → dejar pasar (traverse natural al padre).
      if (!isRootTab(path)) return;

      // 3) Tab ≠ Inicio → ir a Inicio. Si no se pudo frenar, el traverse cae al
      //    backroom y el replace corre igual después: terminamos en Inicio.
      if (path !== HOME) {
        cancel();
        setTimeout(() => router.replace(HOME), 0);
        return;
      }

      // 4) Inicio → 1er back: toast y dejar pasar al backroom (quedamos en el borde);
      //    el próximo back cierra la app. Acá nunca cancelamos, así que funciona
      //    igual con cancelable=false.
      onHint.current();
      exitArmedUntil = Date.now() + EXIT_WINDOW_MS;
      setTimeout(ensureBackroom, EXIT_WINDOW_MS + 50);
    };

    const onEntryChange = () => ensureBackroom();

    nav.addEventListener("navigate", onNavigate);
    nav.addEventListener("currententrychange", onEntryChange);
    ensureBackroom();

    return () => {
      nav.removeEventListener("navigate", onNavigate);
      nav.removeEventListener("currententrychange", onEntryChange);
    };
  }, [router]);
}
