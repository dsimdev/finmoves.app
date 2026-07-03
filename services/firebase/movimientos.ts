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
import { Movimiento } from "@/types";

// El sheet espejo se sincroniza incremental (solo agrega altas nuevas). Editar o
// borrar un movimiento ya sincronizado lo desactualiza → flag para que el próximo
// sync sea completo. Solo el owner tiene sync a Sheets; para el resto no se escribe.
async function marcarFullSync(userId: string): Promise<void> {
  if (userId !== process.env.NEXT_PUBLIC_OWNER_UID) return;
  const ref = doc(db, `users/${userId}/config/syncMeta`);
  await setDoc(ref, { needsFullSync: true }, { merge: true }).catch(() => {});
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

export async function actualizarMovimiento(
  userId: string,
  movimientoId: string,
  data: Partial<Movimiento>
): Promise<void> {
  const ref = doc(db, `users/${userId}/movimientos/${movimientoId}`);
  await updateDoc(ref, data);
  await marcarFullSync(userId);
}

export async function eliminarMovimiento(
  userId: string,
  movimientoId: string
): Promise<void> {
  const ref = doc(db, `users/${userId}/movimientos/${movimientoId}`);
  await deleteDoc(ref);
  await marcarFullSync(userId);
}
