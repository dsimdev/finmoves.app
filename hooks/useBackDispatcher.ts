"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { doubleBackEnabled, anyModalOpen, closeTopModal, dbgLog, HOME } from "@/lib/back-dispatcher";

// Dueño único del botón "atrás" cuando el flag `fmDoubleBack` está ON, montado 1 vez
// (en BackExitToast, dentro del layout de tabs). Patrón nativo Android: modal →
// cerrar; subpágina → volver al padre; tab ≠ Inicio → ir a Inicio; en Inicio → 1er
// back muestra toast, 2do cierra la app.
//
// A diferencia de los ~7 intentos con `popstate` (que llegaba TARDE, ya consumado, y
// peleaba con el listener interno de Next), usamos la **Navigation API** (Chromium /
// Android Chrome): el evento `navigate` de un traverse se dispara ANTES y es
// cancelable → `preventDefault()` frena el back sin rellenar history a ciegas.
//
// El único caso que sí necesita una entrada extra es el cierre en Inicio (ningún API
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
    if (!doubleBackEnabled()) return;
    const nav = getNav();
    if (!nav) { dbgLog("Navigation API NO disponible → back nativo"); return; }

    let exitArmedUntil = 0;

    // Garantiza un "backroom" debajo cuando estamos en un tab raíz, para que el back
    // sea un traverse interceptable y no un cierre directo. Se saltea durante la
    // ventana de salida (así el borde queda alcanzable y la PWA puede cerrar).
    const ensureBackroom = () => {
      if (!isRootTab(window.location.pathname)) return;
      if (nav.canGoBack) return;
      if (Date.now() < exitArmedUntil) return;
      window.history.pushState({ __fmRoom: 1 }, "", window.location.href);
      dbgLog(`backroom+ idx=${nav.currentEntry?.index} canGoBack=${nav.canGoBack}`);
    };

    const onNavigate = (evt: Event) => {
      const e = evt as NavigateEvt;
      if (e.navigationType !== "traverse") return;
      const cur = nav.currentEntry;
      if (!cur || typeof e.destination?.index !== "number") return;
      if (e.destination.index >= cur.index) return; // solo hacia atrás
      if (!e.cancelable) return;

      const path = window.location.pathname;
      dbgLog(`BACK from=${path} idx ${cur.index}->${e.destination.index} modal=${anyModalOpen()}`);

      // 1) Modal abierto → frenar el back y cerrarlo.
      if (anyModalOpen()) {
        e.preventDefault();
        dbgLog("  -> cierro modal");
        closeTopModal();
        return;
      }

      // 2) Subpágina → dejar pasar (traverse natural al padre).
      if (!isRootTab(path)) {
        dbgLog("  -> subpágina: dejo pasar (→ padre)");
        return;
      }

      // 3) Tab ≠ Inicio → frenar e ir a Inicio.
      if (path !== HOME) {
        e.preventDefault();
        dbgLog("  -> replace(HOME)");
        setTimeout(() => router.replace(HOME), 0);
        return;
      }

      // 4) Inicio → 1er back: toast y dejar pasar al backroom (quedamos en el borde);
      //    el próximo back cierra la app.
      dbgLog("  -> Inicio: toast + salgo en el próximo back");
      onHint.current();
      exitArmedUntil = Date.now() + EXIT_WINDOW_MS;
      setTimeout(ensureBackroom, EXIT_WINDOW_MS + 50);
      // sin preventDefault → el traverse procede al backroom
    };

    const onEntryChange = () => ensureBackroom();

    nav.addEventListener("navigate", onNavigate);
    nav.addEventListener("currententrychange", onEntryChange);
    ensureBackroom();
    dbgLog(`MOUNT navapi path=${window.location.pathname} canGoBack=${nav.canGoBack}`);

    return () => {
      nav.removeEventListener("navigate", onNavigate);
      nav.removeEventListener("currententrychange", onEntryChange);
    };
  }, [router]);
}
