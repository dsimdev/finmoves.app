import type { Movimiento } from "@/types";

// Reglas de la selección múltiple de movimientos. Puras y testeables: la pantalla solo pinta.
//
// El sueldo que abre un período es el ANCLA (define su fecha) y no se puede borrar — la misma
// regla que aplica el modal de detalle. En selección múltiple eso importa el doble: un borrado
// en lote no puede llevárselo por delante sin que se note.

/** ¿Este movimiento es el sueldo que ancla un período? */
export const esAncla = (m: Movimiento, movimientos: Movimiento[]): boolean => {
  if (m.tipo !== "Ingreso" || m.categoria !== "Sueldo") return false;
  // Ancla = el sueldo más viejo de su período (el que lo abrió). Si hubiera varios sueldos
  // en el mismo período, los posteriores sí se pueden borrar.
  const delPeriodo = movimientos.filter(
    (x) => x.periodoId === m.periodoId && x.tipo === "Ingreso" && x.categoria === "Sueldo"
  );
  if (delPeriodo.length === 0) return false;
  const primero = delPeriodo.reduce((a, b) =>
    a.fecha < b.fecha || (a.fecha === b.fecha && a.timestampCarga <= b.timestampCarga) ? a : b
  );
  return primero.id === m.id;
};

/** Los que de verdad se pueden borrar de una selección (descarta anclas). */
export const borrables = (ids: string[], movimientos: Movimiento[]): Movimiento[] => {
  const sel = new Set(ids);
  return movimientos.filter((m) => sel.has(m.id) && !esAncla(m, movimientos));
};

/**
 * Los que pueden cambiar de categoría. Se excluyen los tipos cuya categoría es estructural
 * (Move, RESTO y las operaciones de divisa): reasignarles una categoría de gasto rompería
 * cómo los lee el cálculo del período.
 */
export const recategorizables = (ids: string[], movimientos: Movimiento[]): Movimiento[] => {
  const sel = new Set(ids);
  return movimientos.filter((m) => {
    if (!sel.has(m.id)) return false;
    if (m.tipo !== "Gasto" && m.tipo !== "Ingreso") return false; // Move / FX quedan afuera
    if (m.categoria === "RESTO") return false;                    // arrastre de período
    if (esAncla(m, movimientos)) return false;                    // el sueldo ancla no se toca
    return true;
  });
};

/** Alterna un id dentro de la selección. */
export const toggleId = (ids: string[], id: string): string[] =>
  ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
