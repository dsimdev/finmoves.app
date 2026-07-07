import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  doc,
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import { trackWrite } from "@/lib/sync-status";
import { Movimiento } from "@/types";

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
}

export async function actualizarMovimiento(
  userId: string,
  movimientoId: string,
  data: Partial<Movimiento>
): Promise<void> {
  const ref = doc(db, `users/${userId}/movimientos/${movimientoId}`);
  await trackWrite(updateDoc(ref, data));
  await marcarFullSync(userId);
}

export async function eliminarMovimiento(
  userId: string,
  movimientoId: string
): Promise<void> {
  const ref = doc(db, `users/${userId}/movimientos/${movimientoId}`);
  await trackWrite(deleteDoc(ref));
  await marcarFullSync(userId);
}
