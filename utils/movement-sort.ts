import type { Movimiento } from "@/types";

// Orden y filtros de la lista de movimientos. Extraídos de la página para que la vista de
// tabla (desktop) y la lista (móvil) ordenen EXACTAMENTE igual: si divergen, el mismo
// período se ve distinto según el dispositivo.

/** Los movimientos de reserva que no tocan el disponible no son parte del período. */
const TIPOS_SOLO_RESERVA = ["GastoUSD", "GastoEUR", "IngresoUSD", "IngresoEUR"];

export const esDelPeriodo = (m: Movimiento): boolean => !TIPOS_SOLO_RESERVA.includes(m.tipo);

const esSueldo = (m: Movimiento): boolean => m.tipo === "Ingreso" && m.categoria === "Sueldo";

/**
 * Orden cronológico inverso: fecha del evento, luego instante de carga. Ante el mismo
 * instante (apertura de período, donde varios movimientos se crean juntos) el Sueldo va
 * último: es el ancla del período y debe quedar abajo de todo, igual en todos los devices.
 */
export function compararMovimientos(a: Movimiento, b: Movimiento): number {
  const d = b.fecha.localeCompare(a.fecha);
  if (d !== 0) return d;
  const tt = b.timestampCarga.getTime() - a.timestampCarga.getTime();
  if (tt !== 0) return tt;
  const aS = esSueldo(a), bS = esSueldo(b);
  if (aS && !bS) return 1;
  if (bS && !aS) return -1;
  return 0;
}

export type ColumnaOrden = "fecha" | "monto" | "categoria" | "descripcion" | "medioPago";
export type DireccionOrden = "asc" | "desc";

/**
 * Orden por columna (tabla de desktop). `fecha` delega en el orden cronológico canónico
 * para no divergir del móvil; el resto compara el campo y usa la fecha como desempate,
 * así dos gastos de la misma categoría siguen saliendo del más nuevo al más viejo.
 */
export function ordenarPor(movs: Movimiento[], col: ColumnaOrden, dir: DireccionOrden): Movimiento[] {
  // `desc` es el orden natural de cada columna: fecha más nueva, monto más alto, A→Z.
  const factor = dir === "desc" ? 1 : -1;

  // Todos los comparadores devuelven el orden DESCENDENTE de su columna; el signo lo
  // aplica `factor` una sola vez. Para texto eso es Z→A, así que se invierte localeCompare
  // (que es A→Z por naturaleza).
  const porColumna = (a: Movimiento, b: Movimiento): number => {
    if (col === "fecha") return compararMovimientos(a, b);
    if (col === "monto") return b.monto - a.monto;
    const va = (a[col] ?? "").toString().toLowerCase();
    const vb = (b[col] ?? "").toString().toLowerCase();
    return -va.localeCompare(vb);
  };

  return [...movs].sort((a, b) => {
    const d = porColumna(a, b);
    // Empate → desempata por fecha, SIN invertir: dentro de una misma categoría siempre
    // se lee del más nuevo al más viejo, ordenes la columna como la ordenes.
    return d !== 0 ? d * factor : compararMovimientos(a, b);
  });
}
