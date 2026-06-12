import { Categoria, MedioPago, OrigenAhorro } from "@/types";

// Config inicial GENÉRICA para usuarios nuevos (sin datos personales).
// Se usa tanto al crear la cuenta (server) como al primer fetch (cliente).
export const TEMPLATE_CONFIG = {
  categorias: [
    { nombre: "Comida", tipo: "Gasto", activa: true },
    { nombre: "Transporte", tipo: "Gasto", activa: true },
    { nombre: "Servicios", tipo: "Gasto", activa: true },
    { nombre: "Salud", tipo: "Gasto", activa: true },
    { nombre: "Ocio", tipo: "Gasto", activa: true },
    { nombre: "Otros", tipo: "Gasto", activa: true },
    { nombre: "Sueldo", tipo: "Ingreso", activa: true },
    { nombre: "Ahorros", tipo: "Ingreso", activa: true },
  ] as Categoria[],
  mediosPago: [
    { nombre: "Efectivo", activo: true },
    { nombre: "Débito", activo: true },
    { nombre: "Tarjeta", activo: true },
  ] as MedioPago[],
  tipos: [
    { nombre: "Gasto", activo: true },
    { nombre: "Ingreso", activo: true },
    { nombre: "Move", activo: true },
    { nombre: "CompraUSD", activo: true },
  ],
  origenesAhorro: [
    { nombre: "Aguinaldo", activo: true },
    { nombre: "Bono", activo: true },
    { nombre: "Intereses", activo: true },
  ] as OrigenAhorro[],
  meta: {
    usdMensual: 0,
    tipoCambioRef: "blue" as const,
    onboardingCompleto: false,
  },
};
