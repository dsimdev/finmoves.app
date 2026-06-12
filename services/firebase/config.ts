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

  return snap.data() as ConfigUsuario;
}

export async function crearConfigDefault(userId: string): Promise<void> {
  const ref = doc(db, `users/${userId}/config/meta`);
  await setDoc(ref, TEMPLATE_CONFIG);
}

export async function actualizarTipoCambio(userId: string, tipo: "blue" | "oficial"): Promise<void> {
  const ref = doc(db, `users/${userId}/config/meta`);
  await updateDoc(ref, { "meta.tipoCambioRef": tipo });
}
