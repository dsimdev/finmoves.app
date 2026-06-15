import { collection, addDoc, deleteDoc, doc, getDocs, updateDoc, increment } from "firebase/firestore";
import { db } from "./firebase";

// Plantilla de gasto frecuente: precarga el form de alta con un toque.
export interface Plantilla {
  id: string;
  nombre: string;        // etiqueta (= descripción del gasto)
  categoria: string;
  monto: number;
  medioPago: string;
  observaciones?: string;
  usageCount?: number;
}

export async function listarPlantillas(uid: string): Promise<Plantilla[]> {
  const snap = await getDocs(collection(db, `users/${uid}/plantillas`));
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<Plantilla, "id">) }))
    .sort((a, b) => (b.usageCount ?? 0) - (a.usageCount ?? 0));
}

export async function usarPlantilla(uid: string, id: string): Promise<void> {
  await updateDoc(doc(db, `users/${uid}/plantillas/${id}`), { usageCount: increment(1) });
}

export async function crearPlantilla(uid: string, p: Omit<Plantilla, "id">): Promise<string> {
  const ref = await addDoc(collection(db, `users/${uid}/plantillas`), { ...p, createdAt: Date.now() });
  return ref.id;
}

export async function eliminarPlantilla(uid: string, id: string): Promise<void> {
  await deleteDoc(doc(db, `users/${uid}/plantillas/${id}`));
}
