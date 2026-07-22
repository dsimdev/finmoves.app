// "Te dura X días" y "podés gastar $X por día": a tu ritmo de gasto, cuánto aguanta el
// disponible y cuánto se puede gastar de acá al cierre. Responde la pregunta que uno le hace
// a Inicio — "¿llego a fin de período?" — en vez de describir el pasado. Puro y testeable.
//
// La duración del período NO se asume en 30 días: los períodos son días de cobro y no
// necesariamente mensuales. Se mide de los períodos reales (ver duracionMedianaPeriodos) y
// solo se cae a 30 cuando todavía no hay historial del cual sacarla.

/** Duración por defecto cuando no hay períodos previos para medir. */
export const DIAS_PERIODO_FALLBACK = 30;

/**
 * Duración típica de los períodos, en días, medida de las distancias reales entre períodos
 * consecutivos. Mediana y no promedio: un período atípico (cobro adelantado, carga tardía)
 * corre el promedio pero no la mediana — mismo criterio que estadisticasPeriodos.
 *
 * @param iniciosDesc  fechas de inicio de cada período, del más NUEVO al más viejo
 */
export function duracionMedianaPeriodos(iniciosDesc: Date[]): number {
  const dias: number[] = [];
  // Distancia entre cada período y el anterior (la lista viene del más nuevo al más viejo).
  for (let i = 0; i < iniciosDesc.length - 1; i++) {
    const d = Math.round((iniciosDesc[i].getTime() - iniciosDesc[i + 1].getTime()) / 86_400_000);
    if (d > 0) dias.push(d);
  }
  if (dias.length === 0) return DIAS_PERIODO_FALLBACK;

  const orden = [...dias].sort((a, b) => a - b);
  const mid = Math.floor(orden.length / 2);
  const mediana = orden.length % 2 ? orden[mid] : (orden[mid - 1] + orden[mid]) / 2;
  return Math.max(1, Math.round(mediana));
}

export interface DuracionDisponible {
  /** Días que aguanta el disponible al ritmo actual. null si no hay ritmo para proyectar. */
  dias: number | null;
  /** Días que faltan para cerrar el período (0 si ya se pasó). */
  diasRestantes: number;
  /** true si el disponible llega al cierre del período. */
  llega: boolean;
  /**
   * Cuánto se puede gastar por día para que el disponible cubra lo que falta del período.
   * null si el período ya cerró (no hay días entre los que repartir).
   */
  porDiaSugerido: number | null;
}

/**
 * @param disponible         plata que queda en el período
 * @param gastadoPuro        gastado hasta ahora (solo tipo Gasto)
 * @param diasTranscurridos  días desde que abrió el período (≥1)
 * @param diasPeriodo        duración típica del período (de duracionMedianaPeriodos)
 */
export function duracionDisponible(
  disponible: number,
  gastadoPuro: number,
  diasTranscurridos: number,
  diasPeriodo: number = DIAS_PERIODO_FALLBACK
): DuracionDisponible {
  const diasRestantes = Math.max(0, diasPeriodo - diasTranscurridos);
  // Cuánto se puede gastar por día de acá al cierre. Se reparte lo que queda entre los días
  // que faltan; sin días por delante (período cerrado) o en rojo, no hay sugerencia.
  const porDiaSugerido = diasRestantes > 0 && disponible > 0 ? disponible / diasRestantes : null;

  // Sin gasto todavía no hay ritmo que proyectar: el dato no existe (≠ "dura 0 días").
  if (gastadoPuro <= 0 || diasTranscurridos < 1) {
    return { dias: null, diasRestantes, llega: true, porDiaSugerido };
  }
  // Sin plata, no hay nada que durar.
  if (disponible <= 0) {
    return { dias: 0, diasRestantes, llega: false, porDiaSugerido };
  }

  const porDia = gastadoPuro / diasTranscurridos;
  const dias = Math.floor(disponible / porDia);
  return { dias, diasRestantes, llega: dias >= diasRestantes, porDiaSugerido };
}
