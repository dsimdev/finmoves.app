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

// "D/M/YYYY" → Date
export function parsePeriodoId(s: string): Date {
  const [d, m, y] = s.split("/").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

const DIA_MS = 86_400_000;

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
}

export function kpisPeriodo(p: PeriodoResumen): KpisPeriodo {
  const porFechaMonto = new Map<string, number>();
  const porFechaCant = new Map<string, number>();
  let cantGastos = 0;
  let cantIngresos = 0;

  for (const m of p.movimientos) {
    porFechaCant.set(m.fecha, (porFechaCant.get(m.fecha) ?? 0) + 1);
    if (esGasto(m)) {
      cantGastos++;
      porFechaMonto.set(m.fecha, (porFechaMonto.get(m.fecha) ?? 0) + m.monto);
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
    promedioDiario: diasConGasto > 0 ? p.gastado / diasConGasto : 0,
  };
}

// ── Top gastos individuales del período ──────────────────────────────────────
export function topGastos(movs: Movimiento[], n = 5): Movimiento[] {
  return movs
    .filter(esGasto)
    .sort((a, b) => b.monto - a.monto)
    .slice(0, n);
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
  const gastadoPorDia = p.gastado / dias;
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
      const deltaPct = b > 0 ? Math.round(((a - b) / b) * 100) : null;
      return { categoria, actual: a, anterior: b, deltaPct };
    })
    .sort((x, y) => y.actual - x.actual);
}

// ── Tendencias: serie por período (más viejo → más nuevo) ────────────────────
export interface PuntoTendencia {
  periodoId: string;
  sueldo: number;
  gastado: number;
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
    if (i >= startIdx) acum = Math.max(0, acum + p.ahorros - p.moveTotal);
    return {
      periodoId: p.periodoId,
      sueldo: p.sueldo,
      gastado: p.gastado,
      disponible: p.disponible,
      total: p.total,
      ahorros: p.ahorros,
      ahorrosAcum: acum,
    };
  });
}

// ── Estadísticas avanzadas ────────────────────────────────────────────────────

export function medioPagoMasUsadoCount(movs: Movimiento[]): { nombre: string; count: number } | null {
  const counts = new Map<string, number>();
  for (const m of movs) {
    if (!esGasto(m)) continue;
    const k = m.medioPago || "—";
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  if (counts.size === 0) return null;
  const [nombre, count] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]!;
  return { nombre, count };
}

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

export function promedioAhorroPeriodo(periodos: PeriodoResumen[]): number {
  const con = periodos.filter((p) => p.ahorros > 0);
  return con.length > 0 ? con.reduce((s, p) => s + p.ahorros, 0) / con.length : 0;
}

export function evolucionSueldo(
  periodos: PeriodoResumen[]
): { ultimo: number; anterior: number | null; delta: number; deltaPct: number | null; esVacaciones: boolean } | null {
  if (periodos.length < 2) return null;
  const ultimo = periodos[0]!.sueldo;
  const maxSueldo = Math.max(...periodos.map((p) => p.sueldo));
  const esVac = (s: number) => s < maxSueldo * 0.5;
  const esVacaciones = esVac(ultimo);
  // Referencia: período anterior más reciente que no sea vacaciones ni tenga el mismo sueldo
  const refPeriodo = periodos.slice(1).find((p) => !esVac(p.sueldo) && p.sueldo !== ultimo);
  const anterior = refPeriodo?.sueldo ?? null;
  const delta = anterior !== null ? ultimo - anterior : 0;
  const deltaPct = anterior ? Math.round((delta / anterior) * 100) : null;
  return { ultimo, anterior, delta, deltaPct, esVacaciones };
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

export function gastoPromedioHistorico(serie: PuntoTendencia[]): number {
  if (serie.length === 0) return 0;
  return serie.reduce((s, p) => s + p.gastado, 0) / serie.length;
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

export function ritmoAhorroActual(serie: PuntoTendencia[]): number {
  if (serie.length < 2) return 0;
  const ultimos = serie.slice(-3);
  return ultimos.reduce((s, p) => s + p.ahorros, 0) / ultimos.length;
}

export function progresoMetaUSD(ahorrosAcumARS: number, metaUSD: number, cotizacionBlue: number): number {
  const metaEnARS = metaUSD * cotizacionBlue;
  return Math.round((ahorrosAcumARS / metaEnARS) * 100);
}

export function periodosParaMetaUSD(serie: PuntoTendencia[], metaUSD: number, cotizacionBlue: number): number | null {
  const metaEnARS = metaUSD * cotizacionBlue;
  return periodosParaMetaARS(serie, metaEnARS);
}

export function consistenciaAhorro(periodos: PeriodoResumen[], metaPorPeriodo: number): { cumplidos: number; total: number } {
  const cumplidos = periodos.filter((p) => p.ahorros >= metaPorPeriodo).length;
  return { cumplidos, total: periodos.length };
}

export interface AhorroVsProyectado {
  periodoId: string;
  real: number;
  esperado: number;
  delta: number;
}

export function ahorrosVsProyectados(
  serie: PuntoTendencia[],
  metaPorPeriodo: number
): AhorroVsProyectado[] {
  return serie.map((p, i) => {
    const esperado = metaPorPeriodo * (i + 1);
    const real = p.ahorrosAcum;
    return {
      periodoId: p.periodoId,
      real,
      esperado,
      delta: real - esperado,
    };
  });
}

export interface Insight {
  texto: string;
  valor?: number; // monetary value — rendered with money(), use "{n}" placeholder in texto
  tipo: "good" | "warn" | "info";
}

export function generarInsights(periodos: PeriodoResumen[], serie: PuntoTendencia[]): Insight[] {
  const result: Insight[] = [];
  if (periodos.length === 0 || serie.length === 0) return result;

  const actual = periodos[0]!;
  const ant = periodos[1];
  const sp = (s: string) => { const [d, m] = s.split("/"); return `${d}/${m}`; };

  // Categoría más cara del período actual
  const cats = new Map<string, number>();
  for (const m of actual.movimientos) if (esGasto(m)) cats.set(m.categoria, (cats.get(m.categoria) ?? 0) + m.monto);
  const topCat = [...cats.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topCat) {
    const pct = actual.gastado > 0 ? Math.round((topCat[1] / actual.gastado) * 100) : 0;
    result.push({ texto: `Categoría más cara: ${topCat[0]} — ${pct}% del gasto`, tipo: pct > 40 ? "warn" : "info" });
  }

  // Gasto vs período anterior
  if (ant && ant.gastado > 0) {
    const delta = Math.round(((actual.gastado - ant.gastado) / ant.gastado) * 100);
    if (delta > 10) result.push({ texto: `Gastaste ${delta}% más que el período anterior`, tipo: "warn" });
    else if (delta < -10) result.push({ texto: `Gastaste ${Math.abs(delta)}% menos que el período anterior`, tipo: "good" });
  }

  // Tendencia ahorros últimos 3 períodos
  if (serie.length >= 3) {
    const [a, b, c] = serie.slice(-3) as [PuntoTendencia, PuntoTendencia, PuntoTendencia];
    if (b.ahorros > a.ahorros && c.ahorros > b.ahorros) result.push({ texto: "Ahorros en alza 3 períodos seguidos", tipo: "good" });
    else if (b.ahorros < a.ahorros && c.ahorros < b.ahorros) result.push({ texto: "Ahorros en baja 3 períodos seguidos", tipo: "warn" });
  }

  // Mejor ahorro histórico
  if (serie.length > 1) {
    const mejor = [...serie].sort((a, b) => b.ahorros - a.ahorros)[0]!;
    result.push({ texto: `Mejor ahorro: período ${sp(mejor.periodoId)} — {n}`, valor: mejor.ahorros, tipo: "info" });
  }

  // Disponible promedio al cierre
  const promedioDisp = serie.reduce((s, p) => s + p.disponible, 0) / serie.length;
  if (promedioDisp >= 0) {
    result.push({ texto: "Disponible promedio al cierre: {n}", valor: promedioDisp, tipo: "good" });
  } else {
    result.push({ texto: "Déficit promedio al cierre: {n}", valor: Math.abs(promedioDisp), tipo: "warn" });
  }

  // % períodos con ahorro positivo
  const conAhorros = serie.filter((s) => s.ahorros > 0).length;
  const pctAh = Math.round((conAhorros / serie.length) * 100);
  result.push({
    texto: `Ahorraste en ${pctAh}% de tus períodos (${conAhorros}/${serie.length})`,
    tipo: pctAh >= 75 ? "good" : pctAh >= 50 ? "info" : "warn",
  });

  return result.slice(0, 6);
}
