import { describe, it, expect } from "vitest";
import { agruparPorPeriodo, gastosPorCategoria, formatARS } from "@/utils/periodo";
import type { Movimiento } from "@/types";

function mov(p: Partial<Movimiento>): Movimiento {
  return {
    id: Math.random().toString(36).slice(2), timestampCarga: new Date("2026-08-30"),
    fecha: "2026-08-30", tipo: "Gasto", categoria: "", descripcion: "", monto: 0,
    medioPago: "", observaciones: "", periodoId: "30/8/2026", userId: "u",
    ...p,
  };
}

describe("agruparPorPeriodo", () => {
  it("calcula sueldo, gastado, gastadoPuro, total, pct y disponible", () => {
    const movs = [
      mov({ tipo: "Ingreso", categoria: "Sueldo", monto: 100_000 }),
      mov({ tipo: "Gasto", categoria: "Comida", monto: 30_000 }),
      mov({ tipo: "CompraUSD", categoria: "CompraUSD", monto: 20_000 }),
    ];
    const [p] = agruparPorPeriodo(movs);
    expect(p.sueldo).toBe(100_000);
    expect(p.gastado).toBe(50_000);       // gasto + compra FX
    expect(p.gastadoPuro).toBe(30_000);   // solo Gasto
    expect(p.total).toBe(100_000);
    expect(p.pct).toBe(50);
    expect(p.disponible).toBe(50_000);
  });

  it("moves: aAhorro resta del disponible, aDisponible suma al total", () => {
    const movs = [
      mov({ tipo: "Ingreso", categoria: "Sueldo", monto: 100_000 }),
      mov({ tipo: "Move", direccionMove: "aAhorro", categoria: "Ahorro", monto: 20_000 }),
      mov({ tipo: "Move", direccionMove: "aDisponible", categoria: "Retiro", monto: 5_000 }),
    ];
    const [p] = agruparPorPeriodo(movs);
    expect(p.moveAhorros).toBe(20_000);
    expect(p.moveDisponible).toBe(5_000);
    expect(p.total).toBe(105_000);                 // sueldo + moveDisponible
    expect(p.disponible).toBe(105_000 - 20_000);   // total - gastado(0) - moveAhorros
  });

  it("ordena períodos del más reciente al más viejo", () => {
    const movs = [
      mov({ periodoId: "30/8/2026", tipo: "Gasto", monto: 1 }),
      mov({ periodoId: "30/9/2026", tipo: "Gasto", monto: 1 }),
    ];
    const ps = agruparPorPeriodo(movs);
    expect(ps.map((p) => p.periodoId)).toEqual(["30/9/2026", "30/8/2026"]);
  });
});

describe("gastosPorCategoria", () => {
  it("agrupa Gasto+CompraUSD, calcula % y ordena desc", () => {
    const movs = [
      mov({ tipo: "Gasto", categoria: "Comida", monto: 30_000 }),
      mov({ tipo: "Gasto", categoria: "Comida", monto: 10_000 }),
      mov({ tipo: "CompraUSD", categoria: "USD", monto: 20_000 }),
    ];
    const cats = gastosPorCategoria(movs, 60_000);
    expect(cats).toEqual([
      { categoria: "Comida", monto: 40_000, pct: 67 },
      { categoria: "USD", monto: 20_000, pct: 33 },
    ]);
  });
  it("pct 0 si no hay total", () => {
    expect(gastosPorCategoria([mov({ tipo: "Gasto", categoria: "X", monto: 100 })], 0)[0].pct).toBe(0);
  });
});

describe("formatARS", () => {
  it("formatea en es-AR con 2 decimales", () => {
    expect(formatARS(1234.5)).toBe("$1.234,50");
    expect(formatARS(1000)).toBe("$1.000,00");
    expect(formatARS(0)).toBe("$0,00");
  });
});
