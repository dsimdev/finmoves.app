import { collection, addDoc, deleteDoc, doc, getDocs, updateDoc } from "firebase/firestore";
import { db } from "./firebase";

// Recordatorio del usuario: la cron lo manda como push cuando llega la fecha. Puntual (se
// borra al avisar) o repetible (vuelve el mismo día de cada mes; la cron le avanza la fecha).
export interface Recordatorio {
  id: string;
  texto: string;
  fecha: string;      // YYYY-MM-DD — la PRÓXIMA vez que avisa
  /** Repetir todos los meses el mismo día. Ausente = puntual (comportamiento histórico). */
  repetir?: boolean;
  /** Día elegido (1-31). Sostiene el "31" cuando un mes no lo tiene (ver utils/recordatorio-repeat). */
  diaOriginal?: number;
}

export async function listarRecordatorios(uid: string): Promise<Recordatorio[]> {
  const snap = await getDocs(collection(db, `users/${uid}/recordatorios`));
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<Recordatorio, "id">) }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
}

export async function crearRecordatorio(uid: string, texto: string, fecha: string, repetir = false): Promise<string> {
  const ref = await addDoc(collection(db, `users/${uid}/recordatorios`), {
    texto, fecha, createdAt: Date.now(),
    // diaOriginal solo tiene sentido si repite; se guarda al crear para no perder el día
    // elegido cuando un mes corto obligue a recortar la fecha.
    ...(repetir ? { repetir: true, diaOriginal: Number(fecha.split("-")[2]) } : {}),
  });
  return ref.id;
}

/** Enciende o apaga la repetición de un recordatorio ya creado. */
export async function setRepetir(uid: string, id: string, repetir: boolean, fecha: string): Promise<void> {
  await updateDoc(doc(db, `users/${uid}/recordatorios/${id}`), {
    repetir,
    ...(repetir ? { diaOriginal: Number(fecha.split("-")[2]) } : {}),
  });
}

export async function eliminarRecordatorio(uid: string, id: string): Promise<void> {
  await deleteDoc(doc(db, `users/${uid}/recordatorios/${id}`));
}
