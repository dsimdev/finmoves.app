// Registro central del botón "atrás" para el doble-back-para-salir (Opción A).
// Todo esto vive detrás del flag localStorage `fmDoubleBack` (default OFF). Con el
// flag ON, los modales se REGISTRAN acá en vez de empujar history; el único que
// toca history/popstate es hooks/useBackDispatcher.ts. Ese fue el fix que mató las
// peleas entre listeners que rompieron prod en v2.59.x.

export const HOME = "/";

export function doubleBackEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem("fmDoubleBack") === "1";
  } catch {
    return false;
  }
}

// --- Log de diagnóstico (persistido en localStorage para sobrevivir al cierre de la
// PWA: al reabrir vemos qué pasó en el último back). Lo consume BackDebugHud. ---
const LOG_KEY = "fmDBLog";
let logLines: string[] = [];
if (typeof window !== "undefined") {
  try { logLines = JSON.parse(localStorage.getItem(LOG_KEY) || "[]"); } catch { logLines = []; }
}

export function dbgLog(msg: string) {
  if (typeof window === "undefined") return;
  const t = new Date().toISOString().slice(11, 23);
  logLines = [`${t}  ${msg}`, ...logLines].slice(0, 24);
  try { localStorage.setItem(LOG_KEY, JSON.stringify(logLines)); } catch { /* ignore */ }
}

export function getDbgLog(): string[] {
  if (typeof window !== "undefined") {
    try { return JSON.parse(localStorage.getItem(LOG_KEY) || "[]"); } catch { /* ignore */ }
  }
  return logLines;
}

export function clearDbgLog() {
  logLines = [];
  try { localStorage.removeItem(LOG_KEY); } catch { /* ignore */ }
}

// Pila LIFO de cierres de modales abiertos. Cada modal (con flag ON) se registra al
// abrir y se desregistra al desmontar. NO empujan una entrada de history.
type Handler = () => void;
const modalStack: Handler[] = [];

// Registra un cierre y devuelve la función para desregistrarlo (idempotente).
export function pushModalHandler(fn: Handler): () => void {
  modalStack.push(fn);
  return () => {
    const i = modalStack.lastIndexOf(fn);
    if (i !== -1) modalStack.splice(i, 1);
  };
}

export function anyModalOpen(): boolean {
  return modalStack.length > 0;
}

// Cierra el modal de más arriba llamando su callback. NO lo saca de la pila: de eso
// se encarga el desregistro del propio modal al desmontarse (única fuente de verdad).
export function closeTopModal(): boolean {
  const fn = modalStack[modalStack.length - 1];
  if (fn) {
    fn();
    return true;
  }
  return false;
}
