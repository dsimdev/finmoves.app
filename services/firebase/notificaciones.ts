import { collection, deleteDoc, doc, getDocs, orderBy, query, updateDoc, writeBatch } from "firebase/firestore";
import { db } from "./firebase";

// Tipos de aviso que persistimos para el panel in-app (bandeja). El destino (`dest`)
// es el deep-link al que navega el tap; lo escribe el backend al enviar el push.
export type NotifTipo =
  | "dolar" | "version" | "recurrente" | "sueldo" | "carga"
  | "meta" | "recordatorio" | "permiso" | "sync" | "baja";

export interface Notificacion {
  id: string;
  tipo: NotifTipo;
  title: string;
  body: string;
  dest: string;      // deep-link (ej. "/investments", "/movements?recurrente=<id>")
  createdAt: number;
  leida: boolean;
}

export async function listarNotificaciones(uid: string): Promise<Notificacion[]> {
  const q = query(collection(db, `users/${uid}/notificaciones`), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Notificacion, "id">) }));
}

export async function marcarLeida(uid: string, id: string): Promise<void> {
  await updateDoc(doc(db, `users/${uid}/notificaciones/${id}`), { leida: true });
}

export async function eliminarNotificacion(uid: string, id: string): Promise<void> {
  await deleteDoc(doc(db, `users/${uid}/notificaciones/${id}`));
}

export async function marcarTodasLeidas(uid: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const batch = writeBatch(db);
  for (const id of ids) batch.update(doc(db, `users/${uid}/notificaciones/${id}`), { leida: true });
  await batch.commit();
}
