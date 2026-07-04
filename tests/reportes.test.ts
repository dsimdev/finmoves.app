import { describe, it, expect } from "vitest";
import { parsePeriodoId, estadisticasPeriodos, ritmoGasto } from "@/utils/reportes";
import type { PeriodoResumen } from "@/utils/periodo";

function periodo(p: Partial<PeriodoResumen>): PeriodoResumen {
  return {
    periodoId: "1/1/2026", sueldo: 0, extras: 0, total: 0, gastado: 0, gastadoPuro: 0,
    ahorros: 0, resto: 0, disponible: 0, moveDisponible: 0, moveAhorros: 0, pct: 0,
    movimientos: [], ...p,
  };
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
