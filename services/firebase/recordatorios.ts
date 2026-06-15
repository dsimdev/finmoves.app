import { collection, addDoc, deleteDoc, doc, getDocs } from "firebase/firestore";
import { db } from "./firebase";

// Recordatorio puntual del usuario: la cron lo manda como push cuando llega la fecha.
export interface Recordatorio {
  id: string;
  texto: string;
  fecha: string;      // YYYY-MM-DD
}

export async function listarRecordatorios(uid: string): Promise<Recordatorio[]> {
  const snap = await getDocs(collection(db, `users/${uid}/recordatorios`));
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<Recordatorio, "id">) }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
}

export async function crearRecordatorio(uid: string, texto: string, fecha: string): Promise<string> {
  const ref = await addDoc(collection(db, `users/${uid}/recordatorios`), {
    texto, fecha, createdAt: Date.now(),
  });
  return ref.id;
}

export async function eliminarRecordatorio(uid: string, id: string): Promise<void> {
  await deleteDoc(doc(db, `users/${uid}/recordatorios/${id}`));
}
