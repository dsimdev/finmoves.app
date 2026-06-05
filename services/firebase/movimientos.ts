import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  getDocs,
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

export async function obtenerMovimientos(
  userId: string,
  periodoId?: string
): Promise<Movimiento[]> {
  const ref = collection(db, `users/${userId}/movimientos`);
  let q = query(ref, orderBy("timestampCarga", "desc"));

  if (periodoId) {
    q = query(
      ref,
      where("periodoId", "==", periodoId),
      orderBy("timestampCarga", "desc")
    );
  }

  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    ...d.data(),
    id: d.id,
    timestampCarga: (d.data().timestampCarga as Timestamp).toDate(),
  } as Movimiento));
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
