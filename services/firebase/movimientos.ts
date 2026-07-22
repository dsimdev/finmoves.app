import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  doc,
  increment,
  writeBatch,
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import { trackWrite } from "@/lib/sync-status";
import { Movimiento } from "@/types";

// Contador de mutaciones por usuario (config/meta.movsRevision). El cliente lo compara
// con el que tiene cacheado para saber si sus movimientos cambiaron en OTRO dispositivo
// —incluye ediciones puras, que el chequeo por `count` no detecta (mismo total de docs).
// config/meta ya se lee 1×/sesión, así que la comparación no cuesta lecturas extra.
async function bumpRevision(userId: string): Promise<void> {
  const ref = doc(db, `users/${userId}/config/meta`);
  await setDoc(ref, { movsRevision: increment(1) }, { merge: true }).catch(() => {});
}

// El sheet espejo se sincroniza incremental (solo agrega altas nuevas). Editar o
// borrar un movimiento ya sincronizado lo desactualiza → flag para que el próximo
// sync sea completo. Solo el owner tiene sync a Sheets; para el resto no se escribe.
async function marcarFullSync(userId: string): Promise<void> {
  if (userId !== process.env.NEXT_PUBLIC_OWNER_UID) return;
  const ref = doc(db, `users/${userId}/config/syncMeta`);
  // No debe romper el alta/edición si falla, pero tampoco quedar en silencio: si el
  // flag no se setea, el sheet no re-espeja y arrastra el dato viejo. Reintenta 1 vez
  // y loguea si igual falla (queda visible para diagnosticar drift del espejo).
  try {
    await setDoc(ref, { needsFullSync: true }, { merge: true });
  } catch (e) {
    console.warn("[marcarFullSync] reintentando marcar full sync", e);
    await setDoc(ref, { needsFullSync: true }, { merge: true })
      .catch((e2) => console.error("[marcarFullSync] no se pudo marcar full sync (sheet puede quedar desactualizado hasta el próximo sync manual)", e2));
  }
}

export async function crearMovimiento(
  userId: string,
  data: Omit<Movimiento, "id">
): Promise<string> {
  const ref = collection(db, `users/${userId}/movimientos`);
  const docRef = await addDoc(ref, {
    ...data,
    timestampCarga: Timestamp.fromDate(data.timestampCarga),
  });
  return docRef.id;
}

// Id de movimiento generado en el cliente (para alta optimista: mostramos el item con
// su id definitivo antes de que el server confirme el write).
export function nuevoMovimientoId(userId: string): string {
  return doc(collection(db, `users/${userId}/movimientos`)).id;
}

// Alta con id pre-generado (par de nuevoMovimientoId). No espera el ack del server más
// allá de lo que hace Firestore; con persistencia local el write queda encolado y
// sincroniza solo. La promesa rechaza si el write es inválido (rollback en el caller).
export async function crearMovimientoConId(
  userId: string,
  id: string,
  data: Omit<Movimiento, "id">
): Promise<void> {
  await trackWrite(setDoc(doc(db, `users/${userId}/movimientos/${id}`), {
    ...data,
    timestampCarga: Timestamp.fromDate(data.timestampCarga),
  }));
  await bumpRevision(userId);
}

export async function actualizarMovimiento(
  userId: string,
  movimientoId: string,
  data: Partial<Movimiento>
): Promise<void> {
  const ref = doc(db, `users/${userId}/movimientos/${movimientoId}`);
  await trackWrite(updateDoc(ref, data));
  await marcarFullSync(userId);
  await bumpRevision(userId);
}

export async function eliminarMovimiento(
  userId: string,
  movimientoId: string
): Promise<void> {
  const ref = doc(db, `users/${userId}/movimientos/${movimientoId}`);
  await trackWrite(deleteDoc(ref));
  await marcarFullSync(userId);
  await bumpRevision(userId);
}

// ── Operaciones en lote (selección múltiple) ─────────────────────────────────
// Un writeBatch en vez de N llamadas sueltas: además de ser atómico, marca el full-sync y
// sube la revisión UNA sola vez. De a uno, borrar 10 movimientos costaba 30 escrituras
// (delete + syncMeta + revision por cada uno); así son 12.
// Firestore admite 500 operaciones por batch; los lotes más grandes se parten.
const BATCH_MAX = 500;

async function enLotes(ids: string[], op: (batch: ReturnType<typeof writeBatch>, id: string) => void, userId: string): Promise<void> {
  for (let i = 0; i < ids.length; i += BATCH_MAX) {
    const batch = writeBatch(db);
    for (const id of ids.slice(i, i + BATCH_MAX)) op(batch, id);
    await trackWrite(batch.commit());
  }
  await marcarFullSync(userId);
  await bumpRevision(userId);
}

/** Borra varios movimientos de una. */
export async function eliminarMovimientos(userId: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await enLotes(ids, (batch, id) => batch.delete(doc(db, `users/${userId}/movimientos/${id}`)), userId);
}

/** Reasigna la categoría de varios movimientos de una. */
export async function recategorizarMovimientos(userId: string, ids: string[], categoria: string): Promise<void> {
  if (ids.length === 0) return;
  await enLotes(ids, (batch, id) => batch.update(doc(db, `users/${userId}/movimientos/${id}`), { categoria }), userId);
}

/**
 * Re-crea movimientos borrados con su MISMO id (deshacer de un borrado en lote). Escribe el
 * doc completo, así el movimiento vuelve idéntico —id incluido— y las referencias que lo
 * apuntaban (comprobante, recurrente) siguen valiendo.
 */
export async function restaurarMovimientos(userId: string, movs: Movimiento[]): Promise<void> {
  if (movs.length === 0) return;
  for (let i = 0; i < movs.length; i += BATCH_MAX) {
    const batch = writeBatch(db);
    for (const { id, ...data } of movs.slice(i, i + BATCH_MAX)) {
      batch.set(doc(db, `users/${userId}/movimientos/${id}`), {
        ...data,
        timestampCarga: Timestamp.fromDate(data.timestampCarga),
      });
    }
    await trackWrite(batch.commit());
  }
  await marcarFullSync(userId);
  await bumpRevision(userId);
}
