// Registro central del botón "atrás" (patrón nativo Android: modal → cerrar,
// subpágina → padre, tab ≠ Inicio → Inicio, Inicio → doble-back para salir).
//
// Activo solo donde existe la Navigation API (Chromium / Android Chrome): ahí los
// modales se REGISTRAN acá en vez de empujar history, y el único que escucha
// navegación es hooks/useBackDispatcher.ts (un solo dueño, sin peleas de listeners —
// lo que rompió prod en v2.59.x). Sin Navigation API (iOS Safari / Firefox) todo esto
// queda inerte y rige el comportamiento clásico de useModalBack + back nativo.

export const HOME = "/";

export function dispatcherActive(): boolean {
  if (typeof window === "undefined") return false;
  return "navigation" in window;
}

// Pila LIFO de cierres de modales abiertos. Cada modal se registra al abrir y se
// desregistra al desmontar. NO empujan una entrada de history.
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
