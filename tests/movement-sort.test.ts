import { describe, it, expect } from "vitest";
import { compararMovimientos, ordenarPor, esDelPeriodo } from "@/utils/movement-sort";
import type { Movimiento } from "@/types";

const mov = (o: Partial<Movimiento>): Movimiento => ({
  id: Math.random().toString(36).slice(2), timestampCarga: new Date("2026-07-01T12:00:00Z"),
  fecha: "2026-07-01", tipo: "Gasto", categoria: "Auto", descripcion: "", monto: 0,
  medioPago: "Débito", observaciones: "", periodoId: "1/7/2026", userId: "u", ...o,
});

describe("esDelPeriodo", () => {
  it("excluye los movimientos que sólo mueven la reserva", () => {
    expect(esDelPeriodo(mov({ tipo: "GastoUSD" }))).toBe(false);
    expect(esDelPeriodo(mov({ tipo: "IngresoEUR" }))).toBe(false);
  });

  it("incluye gastos, ingresos, moves y compra/venta de divisa", () => {
    for (const tipo of ["Gasto", "Ingreso", "Move", "CompraUSD", "VentaEUR"]) {
      expect(esDelPeriodo(mov({ tipo: tipo as Movimiento["tipo"] }))).toBe(true);
    }
  });
});

describe("compararMovimientos (orden canónico, compartido móvil/desktop)", () => {
  it("la fecha más nueva va primero", () => {
    const viejo = mov({ fecha: "2026-07-01" });
    const nuevo = mov({ fecha: "2026-07-05" });
    expect([viejo, nuevo].sort(compararMovimientos)[0]).toBe(nuevo);
  });

  it("misma fecha: desempata por instante de carga (el último cargado primero)", () => {
    const antes = mov({ fecha: "2026-07-01", timestampCarga: new Date("2026-07-01T10:00:00Z") });
    const despues = mov({ fecha: "2026-07-01", timestampCarga: new Date("2026-07-01T18:00:00Z") });
    expect([antes, despues].sort(compararMovimientos)[0]).toBe(despues);
  });

  it("mismo instante: el Sueldo queda ÚLTIMO (es el ancla del período)", () => {
    // Al abrir período se crean varios movimientos con el mismo timestamp; el orden tiene
    // que ser determinístico entre dispositivos o la lista "salta" al sincronizar.
    const t = new Date("2026-07-01T12:00:00Z");
    const sueldo = mov({ tipo: "Ingreso", categoria: "Sueldo", timestampCarga: t });
    const gasto = mov({ tipo: "Gasto", timestampCarga: t });
    expect([sueldo, gasto].sort(compararMovimientos)).toEqual([gasto, sueldo]);
    // Y el resultado no depende del orden de entrada.
    expect([gasto, sueldo].sort(compararMovimientos)).toEqual([gasto, sueldo]);
  });
});

describe("ordenarPor (tabla de desktop)", () => {
  const a = mov({ fecha: "2026-07-03", monto: 500, categoria: "Auto", descripcion: "Nafta" });
  const b = mov({ fecha: "2026-07-01", monto: 1500, categoria: "Comida", descripcion: "Bar" });
  const c = mov({ fecha: "2026-07-02", monto: 100, categoria: "Auto", descripcion: "Peaje" });

  it("monto desc: del más caro al más barato", () => {
    expect(ordenarPor([a, b, c], "monto", "desc").map((m) => m.monto)).toEqual([1500, 500, 100]);
  });

  it("monto asc invierte", () => {
    expect(ordenarPor([a, b, c], "monto", "asc").map((m) => m.monto)).toEqual([100, 500, 1500]);
  });

  it("categoría asc es A→Z", () => {
    expect(ordenarPor([b, a], "categoria", "asc").map((m) => m.categoria)).toEqual(["Auto", "Comida"]);
  });

  it("categoría desc es Z→A", () => {
    expect(ordenarPor([a, b], "categoria", "desc").map((m) => m.categoria)).toEqual(["Comida", "Auto"]);
  });

  it("dentro de una misma categoría siempre se lee del más nuevo al más viejo", () => {
    // a y c son ambos "Auto": ordenar por categoría no debe alterar su orden cronológico.
    const r = ordenarPor([c, a, b], "categoria", "asc");
    expect(r.map((m) => m.descripcion)).toEqual(["Nafta", "Peaje", "Bar"]); // 3/7, 2/7, luego Comida
  });

  it("fecha desc coincide con el orden canónico del móvil", () => {
    expect(ordenarPor([b, c, a], "fecha", "desc")).toEqual([a, c, b]);
  });

  it("no muta el array original", () => {
    const arr = [a, b, c];
    ordenarPor(arr, "monto", "asc");
    expect(arr).toEqual([a, b, c]);
  });
});
