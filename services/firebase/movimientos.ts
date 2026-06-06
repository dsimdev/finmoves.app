import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import { Movimiento } from "@/types";

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
}

export async function eliminarMovimiento(
  userId: string,
  movimientoId: string
): Promise<void> {
  const ref = doc(db, `users/${userId}/movimientos/${movimientoId}`);
  await deleteDoc(ref);
}
