import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
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

  // Migración meta única (USD, sobre reserva FX) → metaFX. Solo en memoria; se persiste
  // cuando el usuario guarde desde Configuración. Deriva metaFX de los campos viejos si aún
  // no existe. metaPropia arranca vacía (la define el usuario). No pisa lo que ya haya.
  if (!config.meta.metaFX && config.meta.metaMonto && config.meta.metaMonto > 0) {
    config.meta.metaFX = {
      monto: config.meta.metaMonto,
      fecha: config.meta.metaFecha,
      moneda: config.meta.metaMoneda ?? "USD",
    };
  }

  return config;
}

export async function crearConfigDefault(userId: string): Promise<void> {
  const ref = doc(db, `users/${userId}/config/meta`);
  await setDoc(ref, TEMPLATE_CONFIG);
}

// Materializa el doc del usuario (users/{uid}) con createdAt si aún no existe.
// El árbol del usuario vive en subcolecciones, así que este doc "padre" no se
// creaba y figuraba como fantasma. Se llama al iniciar sesión (email y Google).
export async function ensureUserDoc(uid: string): Promise<void> {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, { createdAt: serverTimestamp() }, { merge: true });
  }
}

export async function actualizarTipoCambio(userId: string, tipo: "blue" | "oficial"): Promise<void> {
  const ref = doc(db, `users/${userId}/config/meta`);
  await updateDoc(ref, { "meta.tipoCambioRef": tipo });
}
