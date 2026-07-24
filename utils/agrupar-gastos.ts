// Agrupa gastos por descripción para el detalle de una categoría.
//
// El detalle listaba un renglón por movimiento: en categorías repetitivas (peajes, café) eso
// era un scroll infinito de la MISMA descripción con fechas distintas. Agrupando, "CAR" pasa a
// ser una línea con su total y cuántas veces fue — que es lo que se quiere saber. La fecha y el
// medio de pago se pierden a propósito: para eso está el filtro de Movimientos.

export type MovAgrupable = {
  descripcion?: string;
  monto: number;
};

export type GastoAgrupado = {
  /** Descripción normalizada para mostrar (la primera forma vista, sin recortar). */
  descripcion: string;
  /** Suma de los montos del grupo. */
  total: number;
  /** Cuántos movimientos entraron. */
  veces: number;
};

/**
 * Agrupa por descripción (sin distinguir mayúsculas ni espacios de más) y ordena por total
 * descendente: lo que más pesa, arriba.
 */
export function agruparGastosPorDescripcion(movs: MovAgrupable[]): GastoAgrupado[] {
  const mapa = new Map<string, GastoAgrupado>();
  for (const m of movs) {
    const visible = (m.descripcion || "").trim() || "—";
    // La clave normaliza para que "Peaje" y "peaje " caigan juntos; se muestra la primera forma.
    const clave = visible.toLowerCase();
    const prev = mapa.get(clave);
    if (prev) {
      prev.total += m.monto;
      prev.veces += 1;
    } else {
      mapa.set(clave, { descripcion: visible, total: m.monto, veces: 1 });
    }
  }
  return [...mapa.values()].sort((a, b) => b.total - a.total);
}
