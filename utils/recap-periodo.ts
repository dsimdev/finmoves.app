import type { PeriodoResumen } from "@/utils/periodo";
import { kpisPeriodo, comparativaCategorias } from "@/utils/reportes";

// Recap de un período que cerró: el resumen extendido que se muestra en Reportes cuando
// abrís el período siguiente. NO recalcula nada propio — compone lo que ya existe
// (kpisPeriodo, comparativaCategorias) para que el recap y el resto de Reportes no puedan
// divergir. Puro y testeable.

export interface RecapMetrica {
  /** Variación % contra el período anterior. null si no hay con qué comparar. */
  deltaPct: number | null;
  /** true si subir es "bueno" (ahorro): define el color en la UI. */
  subirEsBueno?: boolean;
}

export interface RecapPeriodo {
  periodoId: string;
  gastado: number;
  ahorrado: number;
  disponibleArrastrado: number;
  sueldo: number;
  cantMovimientos: number;
  promedioPorMovimiento: number;
  diaMayorGasto: { fecha: string; monto: number } | null;
  diasConGasto: number;
  /**
   * Categoría cuyo gasto más subió en PESOS respecto del período anterior. Se mide en pesos y
   * no en % a propósito: cuando una categoría casi no tenía gasto antes, el % se dispara a
   * cifras absurdas (48.000.000%) que no dicen nada. El delta en pesos siempre es legible.
   */
  categoriaQueMasSubio: { categoria: string; deltaMonto: number; deltaPct: number | null } | null;
  gastadoVs: RecapMetrica;
  ahorradoVs: RecapMetrica;
}

const variacion = (actual: number, anterior: number): number | null =>
  anterior > 0 ? Math.round((actual / anterior - 1) * 100) : null;

/**
 * Arma el recap del período `cerrado`, comparándolo con `anterior` (el previo, para los deltas).
 *
 * @param cerrado   el período que terminó
 * @param anterior  el período inmediatamente anterior (o null si es el primero)
 */
export function recapPeriodo(cerrado: PeriodoResumen, anterior: PeriodoResumen | null): RecapPeriodo {
  const k = kpisPeriodo(cerrado);
  const cantMov = cerrado.movimientos.length;

  // Categoría que más subió: se toma de la comparativa por categoría ya existente, quedándose
  // con el mayor delta positivo (algo que gastaste bastante más que el período pasado).
  let categoriaQueMasSubio: RecapPeriodo["categoriaQueMasSubio"] = null;
  if (anterior) {
    // Se ordena por cuánto AUMENTÓ en pesos (actual − anterior), no por %. El % acompaña como
    // dato secundario y solo si es razonable: sobre una base minúscula no se muestra.
    const subas = comparativaCategorias(cerrado, anterior)
      .map((c) => ({ ...c, subaMonto: c.actual - c.anterior }))
      .filter((c) => c.subaMonto > 0)
      .sort((a, b) => b.subaMonto - a.subaMonto);
    if (subas.length > 0) {
      const s = subas[0];
      // El % solo si hay base real para calcularlo (sin ella el "%" no significa nada). Se
      // redondea a entero: el problema era el 48.500516908% con quince decimales.
      const pct = s.anterior > 0 && s.deltaPct != null ? Math.round(s.deltaPct) : null;
      categoriaQueMasSubio = { categoria: s.categoria, deltaMonto: Math.round(s.subaMonto), deltaPct: pct };
    }
  }

  return {
    periodoId: cerrado.periodoId,
    gastado: cerrado.gastadoPuro,
    ahorrado: cerrado.moveAhorros,
    disponibleArrastrado: cerrado.disponible,
    sueldo: cerrado.sueldo,
    cantMovimientos: cantMov,
    promedioPorMovimiento: k.cantGastos > 0 ? Math.round(cerrado.gastadoPuro / k.cantGastos) : 0,
    diaMayorGasto: k.diaMayorGasto,
    diasConGasto: k.diasConGasto,
    categoriaQueMasSubio,
    gastadoVs: { deltaPct: anterior ? variacion(cerrado.gastadoPuro, anterior.gastadoPuro) : null },
    ahorradoVs: { deltaPct: anterior ? variacion(cerrado.moveAhorros, anterior.moveAhorros) : null, subirEsBueno: true },
  };
}

/**
 * ¿Hay que ofrecer el recap del último período cerrado? Se ofrece hasta que se vea UNA vez:
 * cuando abrís un período nuevo hay un recap del que cerró, y queda disponible hasta que lo
 * mirás (`visto` = periodoId del último recap ya visto). Como una notificación: visto → se va.
 * `periodos` viene del más nuevo al más viejo. Devuelve el recap del cerrado, o null.
 */
export function recapDisponible(periodos: PeriodoResumen[], visto: string | undefined): RecapPeriodo | null {
  if (periodos.length < 2) return null; // hace falta el cerrado + el que lo precede
  const cerrado = periodos[1];
  if (cerrado.periodoId === visto) return null; // ya lo viste
  const anterior = periodos[2] ?? null;
  return recapPeriodo(cerrado, anterior);
}
