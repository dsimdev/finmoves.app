import { collection, deleteDoc, doc, getDocs, setDoc } from "firebase/firestore";
import { db } from "./firebase";

// Movimiento recurrente: template que se repite cada período. La cron recuerda por
// push cuando el período actual todavía no tiene un movimiento que matchee. NO crea
// movimientos solo (el usuario confirma desde la app).
export interface Recurrente {
  id: string;
  descripcion: string;
  categoria: string;
  tipo: "Gasto" | "Ingreso";
  observaciones?: string;
  monto: number;
  activo: boolean;
  createdAt: number;
}

// Id determinístico por tipo+categoría+descripción+observación → marcar/desmarcar es
// idempotente (no duplica) y dos cargas con misma descripción pero distinta observación
// (ej. "Steam·eso+" vs "Steam·eso pass") son recurrentes independientes. Se sanea para
// que sea un doc id válido de Firestore.
function slug(tipo: string, categoria: string, descripcion: string, observaciones: string): string {
  return `${tipo}__${categoria}__${descripcion || "_"}__${observaciones || "_"}`.replace(/[/.#$[\]]/g, "-").slice(0, 250);
}

export async function listarRecurrentes(uid: string): Promise<Recurrente[]> {
  const snap = await getDocs(collection(db, `users/${uid}/recurrentes`));
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<Recurrente, "id">) }))
    .sort((a, b) => a.descripcion.localeCompare(b.descripcion));
}

export async function upsertRecurrente(
  uid: string,
  r: { descripcion: string; categoria: string; tipo: "Gasto" | "Ingreso"; observaciones?: string; monto: number }
): Promise<void> {
  const obs = (r.observaciones || "").trim();
  const id = slug(r.tipo, r.categoria, r.descripcion, obs);
  await setDoc(doc(db, `users/${uid}/recurrentes/${id}`), { ...r, observaciones: obs, activo: true, createdAt: Date.now() }, { merge: true });
}

export async function setRecurrenteActivo(uid: string, id: string, activo: boolean): Promise<void> {
  await setDoc(doc(db, `users/${uid}/recurrentes/${id}`), { activo }, { merge: true });
}

export async function eliminarRecurrente(uid: string, id: string): Promise<void> {
  await deleteDoc(doc(db, `users/${uid}/recurrentes/${id}`));
}
