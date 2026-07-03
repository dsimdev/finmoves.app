import { Movimiento } from "@/types";
import { PeriodoResumen } from "./periodo";

export interface Distribucion {
  nombre: string;
  monto: number;
  pct: number;
}

export function esGasto(m: Movimiento): boolean {
  return m.tipo === "Gasto" || m.tipo === "CompraUSD";
}

// Gasto "puro": excluye compras de divisa, que disparan promedios/desvíos/proyecciones.
// Se usa solo en cálculos estadísticos; los totales y el detalle por categoría usan esGasto.
export function esGastoPuro(m: Movimiento): boolean {
  return m.tipo === "Gasto";
}

// "D/M/YYYY" → Date
export function parsePeriodoId(s: string): Date {
  const [d, m, y] = s.split("/").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

const DIA_MS = 86_400_000;

// Mediana del gasto por período y "variación" (coef. de variación = desvío/promedio).
// La mediana resiste outliers (un período atípico no la mueve). El CV resume qué
// tan regular es tu gasto entre períodos: bajo = parejo, alto = irregular.
export function estadisticasPeriodos(periodos: PeriodoResumen[]): { mediana: number; desvio: number; cv: number } | null {
  const vals = periodos.map((p) => p.gastadoPuro).filter((v) => v > 0);
  if (vals.length === 0) return null;
  const sorted = [...vals].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const mediana = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  const media = vals.reduce((s, v) => s + v, 0) / vals.length;
  const varianza = vals.reduce((s, v) => s + (v - media) ** 2, 0) / vals.length;
  const desvio = Math.sqrt(varianza);
  const cv = media > 0 ? Math.round((desvio / media) * 100) : 0;
  return { mediana: Math.round(mediana), desvio: Math.round(desvio), cv };
}

// ── Distribuciones (sobre el gasto del período) ──────────────────────────────
function distribucion(
  movs: Movimiento[],
  keyFn: (m: Movimiento) => string,
  totalGastado: number
): Distribucion[] {
  const mapa = new Map<string, number>();
  for (const m of movs) {
    if (!esGasto(m)) continue;
    const k = keyFn(m) || "—";
    mapa.set(k, (mapa.get(k) ?? 0) + m.monto);
  }
  return Array.from(mapa.entries())
    .map(([nombre, monto]) => ({
      nombre,
      monto,
      pct: totalGastado > 0 ? Math.round((monto / totalGastado) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.monto - a.monto);
}

export const gastosPorMedioPago = (movs: Movimiento[], totalGastado: number) =>
  distribucion(movs, (m) => m.medioPago, totalGastado);

export const gastosPorDescripcion = (movs: Movimiento[], totalGastado: number, topN = 12) =>
  distribucion(movs, (m) => m.descripcion, totalGastado).slice(0, topN);

// Gastos por fecha del evento (no de carga), más reciente primero
export function gastosPorFecha(movs: Movimiento[], totalGastado: number): Distribucion[] {
  const dist = distribucion(movs, (m) => m.fecha, totalGastado);
  return dist.sort((a, b) => {
    const parseDate = (s: string) => {
      if (s.includes("-")) return new Date(s).getTime();
      const [d, m, y] = s.split("/").map(Number);
      return new Date(y, m - 1, d).getTime();
    };
    return parseDate(b.nombre) - parseDate(a.nombre);
  });
}

// ── KPIs del período ─────────────────────────────────────────────────────────
export interface KpisPeriodo {
  diaMayorGasto: { fecha: string; monto: number } | null;
  diaMasMovimientos: { fecha: string; cant: number } | null;
  cantGastos: number;
  cantIngresos: number;
  promedioDiario: number;
  diasConGasto: number;
}

export function kpisPeriodo(p: PeriodoResumen): KpisPeriodo {
  const porFechaMonto = new Map<string, number>();
  const porFechaCant = new Map<string, number>();
  let cantGastos = 0;
  let cantIngresos = 0;
  let gastoPuro = 0; // suma de tipo Gasto, para el promedio diario sin divisa

  for (const m of p.movimientos) {
    porFechaCant.set(m.fecha, (porFechaCant.get(m.fecha) ?? 0) + 1);
    if (esGasto(m)) {
      cantGastos++;
      // Día pico y promedio diario: solo gasto puro (sin compras de divisa).
      if (esGastoPuro(m)) {
        gastoPuro += m.monto;
        porFechaMonto.set(m.fecha, (porFechaMonto.get(m.fecha) ?? 0) + m.monto);
      }
    } else if (m.tipo === "Ingreso") {
      cantIngresos++;
    }
  }

  const diaMayorGasto = [...porFechaMonto.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;
  const diaMasMov = [...porFechaCant.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;
  const diasConGasto = porFechaMonto.size;

  return {
    diaMayorGasto: diaMayorGasto ? { fecha: diaMayorGasto[0], monto: diaMayorGasto[1] } : null,
    diaMasMovimientos: diaMasMov ? { fecha: diaMasMov[0], cant: diaMasMov[1] } : null,
    cantGastos,
    cantIngresos,
    promedioDiario: diasConGasto > 0 ? gastoPuro / diasConGasto : 0,
    diasConGasto,
  };
}

// ── Ritmo de gasto (burn rate) ───────────────────────────────────────────────
export interface RitmoGasto {
  diasTranscurridos: number;
  gastadoPorDia: number;
  proyeccionCierre: number; // proyección a 30 días de período
  enCurso: boolean;
}

// inicio = parsePeriodoId(periodoId); fin = inicio del período más nuevo (o null si es el actual)
export function ritmoGasto(p: PeriodoResumen, finPeriodo: Date | null, hoy = new Date()): RitmoGasto {
  const inicio = parsePeriodoId(p.periodoId);
  const enCurso = finPeriodo === null;
  const corte = enCurso ? hoy : finPeriodo;
  const dias = Math.max(1, Math.round((corte.getTime() - inicio.getTime()) / DIA_MS));
  const gastadoPorDia = p.gastadoPuro / dias;
  return {
    diasTranscurridos: dias,
    gastadoPorDia,
    proyeccionCierre: gastadoPorDia * 30,
    enCurso,
  };
}

// ── Comparativa de categorías vs período anterior ────────────────────────────
export interface DeltaCategoria {
  categoria: string;
  actual: number;
  anterior: number;
  deltaPct: number | null; // null si no había gasto antes
}

export function comparativaCategorias(
  actual: PeriodoResumen,
  anterior: PeriodoResumen | undefined
): DeltaCategoria[] {
  const sumar = (movs: Movimiento[]) => {
    const m = new Map<string, number>();
    for (const mv of movs) if (esGasto(mv)) m.set(mv.categoria, (m.get(mv.categoria) ?? 0) + mv.monto);
    return m;
  };
  const act = sumar(actual.movimientos);
  const ant = anterior ? sumar(anterior.movimientos) : new Map<string, number>();
  const cats = new Set([...act.keys(), ...ant.keys()]);

  return [...cats]
    .map((categoria) => {
      const a = act.get(categoria) ?? 0;
      const b = ant.get(categoria) ?? 0;
      const deltaPct = b > 0 ? ((a - b) / b) * 100 : null;
      return { categoria, actual: a, anterior: b, deltaPct };
    })
    .sort((x, y) => y.actual - x.actual);
}

// ── Tendencias: serie por período (más viejo → más nuevo) ────────────────────
export interface PuntoTendencia {
  periodoId: string;
  sueldo: number;
  gastado: number;
  gastadoPuro: number;
  disponible: number;
  total: number;
  ahorros: number;
  ahorrosAcum: number;
}

export function serieTendencia(periodos: PeriodoResumen[], seedPeriodoId?: string): PuntoTendencia[] {
  const cron = [...periodos].reverse();
  // Si hay seed guardado, anclar desde ese período para que la ventana crezca hacia adelante.
  // Si no hay seed aún (primera vez), usar los últimos 2 como baseline provisional.
  let startIdx: number;
  if (seedPeriodoId) {
    const idx = cron.findIndex((p) => p.periodoId === seedPeriodoId);
    startIdx = idx >= 0 ? idx : Math.max(0, cron.length - 2);
  } else {
    startIdx = Math.max(0, cron.length - 2);
  }
  let acum = 0;
  return cron.map((p, i) => {
    const ahorrosDelPeriodo = p.ahorros + p.moveAhorros;
    if (i >= startIdx) acum = Math.max(0, acum + ahorrosDelPeriodo - p.moveDisponible);
    return {
      periodoId: p.periodoId,
      sueldo: p.sueldo,
      gastado: p.gastado,
      gastadoPuro: p.gastadoPuro,
      disponible: p.disponible,
      total: p.total,
      ahorros: ahorrosDelPeriodo,
      ahorrosAcum: acum,
    };
  });
}

// ── Estadísticas avanzadas ────────────────────────────────────────────────────

export function diasSinGastos(
  movs: Movimiento[],
  startDate: Date,
  endDate: Date
): { sinGasto: number; total: number } {
  const daysWithGasto = new Set<string>();
  for (const m of movs) if (esGasto(m)) daysWithGasto.add(m.fecha);
  const total = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / DIA_MS));
  return { sinGasto: Math.max(0, total - daysWithGasto.size), total };
}

export function mejorPeriodo(periodos: PeriodoResumen[]): PeriodoResumen | null {
  if (periodos.length === 0) return null;
  return periodos.reduce((b, p) => p.pct < b.pct ? p : b);
}

export function peorPeriodo(periodos: PeriodoResumen[]): PeriodoResumen | null {
  if (periodos.length === 0) return null;
  return periodos.reduce((w, p) => p.pct > w.pct ? p : w);
}

export function historialSueldo(
  periodos: PeriodoResumen[]
): { cuando: string; de: number; a: number; pct: number }[] {
  if (periodos.length < 2) return [];
  const maxSueldo = Math.max(...periodos.map((p) => p.sueldo));
  const esVac = (s: number) => s < maxSueldo * 0.5;
  const nonVac = periodos.filter((p) => !esVac(p.sueldo));
  if (nonVac.length < 2) return [];
  // Niveles salariales distintos en orden cronológico (oldest first)
  const chron = [...nonVac].reverse();
  const levels: { sueldo: number; periodoId: string }[] = [];
  for (const p of chron) {
    if (levels.length === 0 || levels[levels.length - 1].sueldo !== p.sueldo) {
      levels.push({ sueldo: p.sueldo, periodoId: p.periodoId });
    }
  }
  if (levels.length < 2) return [];
  // Eventos de aumento (newest first), solo subidas
  const events: { cuando: string; de: number; a: number; pct: number }[] = [];
  for (let i = levels.length - 1; i >= 1; i--) {
    const de = levels[i - 1].sueldo;
    const a = levels[i].sueldo;
    if (a > de) events.push({ cuando: levels[i].periodoId, de, a, pct: Math.round(((a - de) / de) * 100) });
  }
  return events;
}

export function proyectarAhorros(serie: PuntoTendencia[], nPeriodos: number): number {
  if (serie.length === 0) return 0;
  const ultimos = serie.slice(-Math.min(2, serie.length));
  const promedio = ultimos.reduce((s, p) => s + p.ahorros, 0) / ultimos.length;
  return serie[serie.length - 1]!.ahorrosAcum + Math.max(0, promedio) * nPeriodos;
}

export function periodosParaMetaARS(serie: PuntoTendencia[], metaARS: number): number | null {
  if (serie.length === 0) return null;
  const acumActual = serie[serie.length - 1]!.ahorrosAcum;
  if (acumActual >= metaARS) return 0;
  const ultimos = serie.slice(-Math.min(3, serie.length));
  const promedio = ultimos.reduce((s, p) => s + p.ahorros, 0) / ultimos.length;
  if (promedio <= 0) return null;
  return Math.ceil((metaARS - acumActual) / promedio);
}

// ── Estadísticas de metas de ahorro ──────────────────────────────────────

export function progresoMetaUSD(ahorrosAcumARS: number, metaUSD: number, cotizacionBlue: number): number {
  const metaEnARS = metaUSD * cotizacionBlue;
  return Math.round((ahorrosAcumARS / metaEnARS) * 100);
}

export function periodosParaMetaUSD(serie: PuntoTendencia[], metaUSD: number, cotizacionBlue: number): number | null {
  const metaEnARS = metaUSD * cotizacionBlue;
  return periodosParaMetaARS(serie, metaEnARS);
}
