import { describe, it, expect } from "vitest";
import { parsePeriodoId, estadisticasPeriodos, ritmoGasto, serieTendencia, inflacionPersonal } from "@/utils/reportes";
import type { PeriodoResumen } from "@/utils/periodo";
import type { Movimiento } from "@/types";

function periodo(p: Partial<PeriodoResumen>): PeriodoResumen {
  return {
    periodoId: "1/1/2026", sueldo: 0, extras: 0, total: 0, gastado: 0, gastadoPuro: 0,
    ahorros: 0, resto: 0, disponible: 0, moveDisponible: 0, moveAhorros: 0, pct: 0,
    movimientos: [], ...p,
  };
}

// Movimientos de Gasto para armar el gasto puro de un período (inflación personal).
function gastos(...montos: number[]): Movimiento[] {
  return montos.map((monto) => ({ tipo: "Gasto", monto } as Movimiento));
}

describe("parsePeriodoId", () => {
  it("parsea D/M/YYYY a Date local", () => {
    const d = parsePeriodoId("30/8/2026");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(7); // agosto = índice 7
    expect(d.getDate()).toBe(30);
  });
});

describe("estadisticasPeriodos", () => {
  it("mediana, desvío y CV del gasto puro", () => {
    const ps = [10_000, 20_000, 30_000].map((g) => periodo({ gastadoPuro: g }));
    expect(estadisticasPeriodos(ps)).toEqual({ mediana: 20_000, desvio: 8165, cv: 41 });
  });
  it("null si no hay gasto positivo", () => {
    expect(estadisticasPeriodos([periodo({ gastadoPuro: 0 })])).toBeNull();
  });
});

describe("ritmoGasto", () => {
  it("período en curso: ritmo diario y proyección a 30 días", () => {
    const p = periodo({ periodoId: "1/1/2026", gastadoPuro: 30_000 });
    const r = ritmoGasto(p, null, new Date(2026, 0, 11)); // 10 días transcurridos
    expect(r.diasTranscurridos).toBe(10);
    expect(r.gastadoPorDia).toBe(3_000);
    expect(r.proyeccionCierre).toBe(90_000);
    expect(r.enCurso).toBe(true);
  });
});

describe("serieTendencia", () => {
  // Entrada en orden descendente (más nuevo primero), como agruparPorPeriodo.
  const P = (id: string, extra: Partial<PeriodoResumen>) => periodo({ periodoId: id, ...extra });

  it("sin seed: acumula desde los últimos 2 períodos", () => {
    const desc = [P("3/1/2026", { moveAhorros: 30 }), P("2/1/2026", { moveAhorros: 50 }), P("1/1/2026", { moveAhorros: 100 })];
    const serie = serieTendencia(desc); // → cron [P1, P2, P3]
    expect(serie.map((s) => s.ahorrosAcum)).toEqual([0, 50, 80]); // P1 fuera de la ventana
  });

  it("con seed: ancla la acumulación desde ese período", () => {
    const desc = [P("3/1/2026", { moveAhorros: 30 }), P("2/1/2026", { moveAhorros: 50 }), P("1/1/2026", { moveAhorros: 100 })];
    const serie = serieTendencia(desc, "1/1/2026");
    expect(serie.map((s) => s.ahorrosAcum)).toEqual([100, 150, 180]);
  });

  it("un retiro mayor al acumulado clampa a 0 (no queda negativo)", () => {
    const desc = [P("2/1/2026", { moveDisponible: 150 }), P("1/1/2026", { moveAhorros: 100 })];
    const serie = serieTendencia(desc, "1/1/2026");
    expect(serie.map((s) => s.ahorrosAcum)).toEqual([100, 0]);
  });
});

describe("inflacionPersonal", () => {
  // Descendente; el primero (en curso) se excluye del cálculo.
  const desc = [
    periodo({ periodoId: "1/3/2026", movimientos: gastos(999_999) }), // en curso: ignorado
    periodo({ periodoId: "1/2/2026", movimientos: gastos(150_000) }),
    periodo({ periodoId: "1/1/2026", movimientos: gastos(100_000) }),
  ];

  it("promedia las variaciones nominales del gasto puro", () => {
    expect(inflacionPersonal(desc)).toBeCloseTo(50); // (150k−100k)/100k
  });

  it("aplica la deflación cuando se pasa (variación real)", () => {
    // Deflactar feb a términos de ene (÷1.5) deja ambos en 100k → 0% real.
    const deflate = (g: number, id: string) => (id === "1/2/2026" ? g / 1.5 : g);
    expect(inflacionPersonal(desc, deflate)).toBeCloseTo(0);
  });

  it("null con menos de 2 períodos completos", () => {
    expect(inflacionPersonal([periodo({ periodoId: "1/2/2026", movimientos: gastos(100_000) })])).toBeNull();
  });
});
