import { doc, getDoc, setDoc, deleteDoc } from "firebase/firestore";
import { db } from "./firebase";

// periodoId format "D/M/YYYY" has slashes — not valid as Firestore doc IDs
const safeId = (periodoId: string) => periodoId.replace(/\//g, "_");

export async function obtenerPresupuesto(
  userId: string,
  periodoId: string
): Promise<Record<string, number> | null> {
  const ref = doc(db, `users/${userId}/presupuestos/${safeId(periodoId)}`);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return (snap.data() as { categorias: Record<string, number> }).categorias ?? null;
}

export async function guardarPresupuesto(
  userId: string,
  periodoId: string,
  categorias: Record<string, number>
): Promise<void> {
  const ref = doc(db, `users/${userId}/presupuestos/${safeId(periodoId)}`);
  await setDoc(ref, { categorias });
}

export async function eliminarPresupuesto(
  userId: string,
  periodoId: string
): Promise<void> {
  const ref = doc(db, `users/${userId}/presupuestos/${safeId(periodoId)}`);
  await deleteDoc(ref);
}
