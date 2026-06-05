import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import { ConfigUsuario, Categoria, MedioPago, OrigenAhorro } from "@/types";

const TEMPLATE_CONFIG = {
  categorias: [
    { nombre: "Daily", tipo: "Gasto", activa: true },
    { nombre: "Services", tipo: "Gasto", activa: true },
    { nombre: "Car", tipo: "Gasto", activa: true },
    { nombre: "Health", tipo: "Gasto", activa: true },
    { nombre: "Games", tipo: "Gasto", activa: true },
    { nombre: "Others", tipo: "Gasto", activa: true },
    { nombre: "Loki", tipo: "Gasto", activa: true },
    { nombre: "Extras", tipo: "Ingreso", activa: true },
    { nombre: "Ahorros", tipo: "Ingreso", activa: true },
  ] as Categoria[],
  mediosPago: [
    { nombre: "Mercado Pago", activo: true },
    { nombre: "Débito", activo: true },
    { nombre: "Efectivo", activo: true },
  ] as MedioPago[],
  tipos: [
    { nombre: "Gasto", activo: true },
    { nombre: "Ingreso", activo: true },
    { nombre: "Move", activo: true },
    { nombre: "CompraUSD", activo: true },
  ],
  origenesAhorro: [
    { nombre: "Intereses", activo: true },
    { nombre: "Bono", activo: true },
    { nombre: "Vacaciones", activo: true },
    { nombre: "María", activo: true },
    { nombre: "Osansi", activo: true },
  ] as OrigenAhorro[],
  meta: {
    usdMensual: 400,
    tipoCambioRef: "blue" as const,
  },
};

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

export async function obtenerCategorias(userId: string): Promise<Categoria[]> {
  const config = await obtenerConfig(userId);
  return config.categorias;
}

export async function obtenerMediosPago(userId: string): Promise<MedioPago[]> {
  const config = await obtenerConfig(userId);
  return config.mediosPago;
}

export async function actualizarSaldoUSD(userId: string, saldoUSD: number): Promise<void> {
  const ref = doc(db, `users/${userId}/config/meta`);
  await updateDoc(ref, { "meta.saldoUSD": saldoUSD });
}

export async function actualizarTipoCambio(userId: string, tipo: "blue" | "oficial" | "mep"): Promise<void> {
  const ref = doc(db, `users/${userId}/config/meta`);
  await updateDoc(ref, { "meta.tipoCambioRef": tipo });
}
