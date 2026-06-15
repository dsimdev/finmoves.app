import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import { ConfigUsuario } from "@/types";
import { TEMPLATE_CONFIG } from "@/lib/default-config";

export async function obtenerConfig(userId: string): Promise<ConfigUsuario> {
  const ref = doc(db, `users/${userId}/config/meta`);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    // Crear config por defecto si no existe
    await crearConfigDefault(userId);
    return TEMPLATE_CONFIG;
  }

  const config = snap.data() as ConfigUsuario;

  // Los permisos viven en un doc aparte (`config/permisos`), read-only para el
  // cliente: solo el dueño los escribe vía Admin SDK. Se inyectan en meta.permisos
  // —sobrescribiendo cualquier valor local— para que el resto de la app los lea igual
  // y el usuario no pueda auto-activárselos tocando meta.
  const permisosSnap = await getDoc(doc(db, `users/${userId}/config/permisos`)).catch(() => null);
  config.meta = {
    ...config.meta,
    permisos: (permisosSnap?.exists() ? permisosSnap.data() : {}) as ConfigUsuario["meta"]["permisos"],
  };

  return config;
}

export async function crearConfigDefault(userId: string): Promise<void> {
  const ref = doc(db, `users/${userId}/config/meta`);
  await setDoc(ref, TEMPLATE_CONFIG);
}

export async function actualizarTipoCambio(userId: string, tipo: "blue" | "oficial"): Promise<void> {
  const ref = doc(db, `users/${userId}/config/meta`);
  await updateDoc(ref, { "meta.tipoCambioRef": tipo });
}
