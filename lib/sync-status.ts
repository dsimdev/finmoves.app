// Estado de sincronización a nivel app (sin costo de lecturas Firestore). Contamos los
// writes en vuelo: con persistencia local, un setDoc/updateDoc/deleteDoc no resuelve su
// promesa hasta que el server confirma (o hasta reconectar si estás offline), así que
// "writes pendientes > 0" significa que hay algo todavía sin sincronizar.

let pending = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((f) => f());

// Envuelve la promesa de un write y la contabiliza mientras está en vuelo.
export function trackWrite<T>(p: Promise<T>): Promise<T> {
  pending++;
  emit();
  return p.finally(() => { pending = Math.max(0, pending - 1); emit(); });
}

export function pendingWrites(): number {
  return pending;
}

export function subscribeSync(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
