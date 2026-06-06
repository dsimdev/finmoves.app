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

// Gastos por fecha del evento (no de carga), en orden cronológico
export function gastosPorFecha(movs: Movimiento[], totalGastado: number): Distribucion[] {
  const dist = distribucion(movs, (m) => m.fecha, totalGastado);
  return dist.sort((a, b) => a.nombre.localeCompare(b.nombre));
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

export function serieTendencia(periodos: PeriodoResumen[]): PuntoTendencia[] {
  // periodos viene ordenado desc (más reciente primero) → invertir a cronológico
  const cron = [...periodos].reverse();
  let acum = 0;
  return cron.map((p) => {
    acum = p.ahorros > 0 ? acum + p.ahorros : 0; // mismo criterio carry-forward que el Resumen
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
