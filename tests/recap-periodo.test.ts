import { describe, it, expect } from "vitest";
import { recapPeriodo, recapDisponible } from "@/utils/recap-periodo";
import type { PeriodoResumen } from "@/utils/periodo";
import type { Movimiento } from "@/types";

const gasto = (categoria: string, monto: number, fecha: string): Movimiento => ({
  id: `${categoria}-${monto}-${fecha}`, periodoId: "01/06/2026", descripcion: "",
  timestampCarga: new Date(), fecha, tipo: "Gasto", categoria, monto,
  medioPago: "Débito", observaciones: "", userId: "u",
});

const periodo = (over: Partial<PeriodoResumen> & { periodoId: string; movimientos: Movimiento[] }): PeriodoResumen => ({
  sueldo: 0, extras: 0, total: 0, gastado: 0, gastadoPuro: 0, ahorros: 0, resto: 0,
  disponible: 0, moveDisponible: 0, moveAhorros: 0, pct: 0, ...over,
});

describe("recapPeriodo", () => {
  it("arma las métricas base del período que cerró", () => {
    const cerrado = periodo({
      periodoId: "01/06/2026", sueldo: 500000, gastadoPuro: 120000, moveAhorros: 80000,
      disponible: 30000,
      movimientos: [gasto("Comida", 100000, "2026-06-10"), gasto("Ocio", 20000, "2026-06-12")],
    });
    const r = recapPeriodo(cerrado, null);
    expect(r.gastado).toBe(120000);
    expect(r.ahorrado).toBe(80000);
    expect(r.disponibleArrastrado).toBe(30000);
    expect(r.cantMovimientos).toBe(2);
    expect(r.promedioPorMovimiento).toBe(60000); // 120000 / 2 gastos
    expect(r.diaMayorGasto).toEqual({ fecha: "2026-06-10", monto: 100000 });
  });

  it("sin período anterior no hay deltas ni categoría que subió", () => {
    const r = recapPeriodo(periodo({ periodoId: "01/06/2026", gastadoPuro: 100, movimientos: [gasto("X", 100, "2026-06-01")] }), null);
    expect(r.gastadoVs.deltaPct).toBeNull();
    expect(r.ahorradoVs.deltaPct).toBeNull();
    expect(r.categoriaQueMasSubio).toBeNull();
  });

  it("calcula los deltas contra el período anterior", () => {
    const anterior = periodo({ periodoId: "01/05/2026", gastadoPuro: 100000, moveAhorros: 50000, movimientos: [] });
    const cerrado = periodo({ periodoId: "01/06/2026", gastadoPuro: 120000, moveAhorros: 40000, movimientos: [] });
    const r = recapPeriodo(cerrado, anterior);
    expect(r.gastadoVs.deltaPct).toBe(20);   // gastaste 20% más
    expect(r.ahorradoVs.deltaPct).toBe(-20); // ahorraste 20% menos
    expect(r.ahorradoVs.subirEsBueno).toBe(true);
  });

  it("detecta la categoría que más subió", () => {
    const anterior = periodo({
      periodoId: "01/05/2026", gastadoPuro: 30000,
      movimientos: [gasto("Comida", 20000, "2026-05-05"), gasto("Ocio", 10000, "2026-05-06")],
    });
    const cerrado = periodo({
      periodoId: "01/06/2026", gastadoPuro: 70000,
      // Ocio pasó de 10k a 50k (+400%); Comida de 20k a 20k (0%).
      movimientos: [gasto("Comida", 20000, "2026-06-05"), gasto("Ocio", 50000, "2026-06-06")],
    });
    const r = recapPeriodo(cerrado, anterior);
    expect(r.categoriaQueMasSubio?.categoria).toBe("Ocio");
    expect(r.categoriaQueMasSubio?.deltaMonto).toBe(40000); // subió de 10k a 50k
    expect(r.categoriaQueMasSubio?.deltaPct).toBe(400);      // base real → % se muestra, entero
  });

  it("el % se muestra redondeado cuando es razonable", () => {
    // Comida sube de 100.000 a 148.500 → +48% (era el caso del '48.500516%').
    const anterior = periodo({ periodoId: "01/05/2026", gastadoPuro: 100000, movimientos: [gasto("Comida", 100000, "2026-05-05")] });
    const cerrado = periodo({ periodoId: "01/06/2026", gastadoPuro: 148500, movimientos: [gasto("Comida", 148500, "2026-06-05")] });
    const r = recapPeriodo(cerrado, anterior);
    expect(r.categoriaQueMasSubio?.deltaMonto).toBe(48500);
    expect(r.categoriaQueMasSubio?.deltaPct).toBe(49); // entero, no 48.5005169...
  });

  it("una categoría nueva (base cero) no muestra % absurdo", () => {
    const anterior = periodo({ periodoId: "01/05/2026", gastadoPuro: 0, movimientos: [] });
    const cerrado = periodo({ periodoId: "01/06/2026", gastadoPuro: 30000, movimientos: [gasto("Nueva", 30000, "2026-06-05")] });
    const r = recapPeriodo(cerrado, anterior);
    expect(r.categoriaQueMasSubio?.deltaMonto).toBe(30000);
    expect(r.categoriaQueMasSubio?.deltaPct).toBeNull(); // sin base, no hay % que mostrar
  });

  it("no divide por cero si no hubo gastos", () => {
    const r = recapPeriodo(periodo({ periodoId: "01/06/2026", gastadoPuro: 0, movimientos: [] }), null);
    expect(r.promedioPorMovimiento).toBe(0);
    expect(r.gastadoVs.deltaPct).toBeNull();
  });
});

describe("recapDisponible — hasta que se vea", () => {
  const p = (id: string) => periodo({ periodoId: id, gastadoPuro: 1000, movimientos: [] });

  it("ofrece el recap del período que cerró si todavía no se vio", () => {
    const r = recapDisponible([p("05/06/2026"), p("01/05/2026")], undefined);
    expect(r).not.toBeNull();
    expect(r?.periodoId).toBe("01/05/2026"); // el recap es del período que CERRÓ
  });

  it("no lo ofrece si ya se vio ese mismo período", () => {
    expect(recapDisponible([p("05/06/2026"), p("01/05/2026")], "01/05/2026")).toBeNull();
  });

  it("al cerrar OTRO período, el recap nuevo vuelve a aparecer aunque el viejo estuviera visto", () => {
    // Ya vi el recap de 01/05, pero ahora cerró 05/06 → hay uno nuevo.
    const r = recapDisponible([p("10/07/2026"), p("05/06/2026"), p("01/05/2026")], "01/05/2026");
    expect(r?.periodoId).toBe("05/06/2026");
  });

  it("no lo ofrece si solo hay un período (nunca cerraste uno)", () => {
    expect(recapDisponible([p("01/06/2026")], undefined)).toBeNull();
  });

  it("el recap compara el cerrado con el previo cuando existe", () => {
    const periodos = [p("05/06/2026"), periodo({ periodoId: "01/05/2026", gastadoPuro: 200, movimientos: [] }), periodo({ periodoId: "01/04/2026", gastadoPuro: 100, movimientos: [] })];
    const r = recapDisponible(periodos, undefined);
    expect(r?.gastadoVs.deltaPct).toBe(100); // 200 vs 100 = +100%
  });
});
