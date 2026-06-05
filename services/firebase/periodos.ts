import {
  collection,
  addDoc,
  updateDoc,
  doc,
  query,
  where,
  orderBy,
  getDocs,
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import { Periodo } from "@/types";

export async function crearPeriodo(
  userId: string,
  data: Omit<Periodo, "id">
): Promise<string> {
  const ref = collection(db, `users/${userId}/periodos`);
  const docRef = await addDoc(ref, {
    ...data,
    inicio: Timestamp.fromDate(data.inicio),
    fin: data.fin ? Timestamp.fromDate(data.fin) : null,
  });
  return docRef.id;
}

export async function obtenerPeriodos(userId: string): Promise<Periodo[]> {
  const ref = collection(db, `users/${userId}/periodos`);
  const q = query(ref, orderBy("inicio", "desc"));

  const snap = await getDocs(q);
  return snap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    inicio: (doc.data().inicio as Timestamp).toDate(),
    fin: doc.data().fin ? (doc.data().fin as Timestamp).toDate() : null,
  } as Periodo));
}

export async function obtenerPeriodoActivo(userId: string): Promise<Periodo | null> {
  const ref = collection(db, `users/${userId}/periodos`);
  const q = query(ref, where("estado", "==", "activo"));

  const snap = await getDocs(q);
  if (snap.empty) return null;

  const doc = snap.docs[0];
  return {
    id: doc.id,
    ...doc.data(),
    inicio: (doc.data().inicio as Timestamp).toDate(),
    fin: doc.data().fin ? (doc.data().fin as Timestamp).toDate() : null,
  } as Periodo;
}

export async function actualizarPeriodo(
  userId: string,
  periodoId: string,
  data: Partial<Periodo>
): Promise<void> {
  const ref = doc(db, `users/${userId}/periodos/${periodoId}`);
  const updateData = { ...data };
  if (updateData.inicio) updateData.inicio = Timestamp.fromDate(updateData.inicio) as any;
  if (updateData.fin) updateData.fin = Timestamp.fromDate(updateData.fin) as any;
  await updateDoc(ref, updateData);
}

export async function asignarPeriodoId(
  timestampCarga: Date,
  periodos: Periodo[]
): Promise<string> {
  const periodo = periodos
    .filter((p) => p.inicio <= timestampCarga)
    .sort((a, b) => b.inicio.getTime() - a.inicio.getTime())[0];
  return periodo?.id ?? "";
}

export async function cerrarPeriodoYAbrir(
  userId: string,
  periodoActualId: string,
  nuevoSueldo: number
): Promise<string> {
  const ahora = new Date();

  // Cerrar período actual
  await actualizarPeriodo(userId, periodoActualId, {
    fin: ahora,
    estado: "cerrado" as any,
  });

  // Crear nuevo período
  const nuevoPeriodoId = await crearPeriodo(userId, {
    inicio: ahora,
    fin: null,
    sueldo: nuevoSueldo,
    estado: "activo",
    resto: 0,
  });

  return nuevoPeriodoId;
}
