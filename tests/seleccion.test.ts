import { describe, it, expect } from "vitest";
import { esAncla, borrables, recategorizables, toggleId } from "@/utils/seleccion";
import type { Movimiento } from "@/types";

const mov = (id: string, over: Partial<Movimiento> = {}): Movimiento => ({
  id, periodoId: "01/07/2026", descripcion: "x",
  timestampCarga: new Date("2026-07-01T10:00:00Z"), fecha: "2026-07-01",
  tipo: "Gasto", categoria: "Varios", monto: 100, medioPago: "Débito",
  observaciones: "", userId: "u", ...over,
});

const sueldo = (id: string, over: Partial<Movimiento> = {}) =>
  mov(id, { tipo: "Ingreso", categoria: "Sueldo", monto: 500000, ...over });

describe("esAncla", () => {
  it("el sueldo que abre el período es ancla", () => {
    const movs = [sueldo("s1"), mov("g1")];
    expect(esAncla(movs[0], movs)).toBe(true);
    expect(esAncla(movs[1], movs)).toBe(false);
  });

  it("un ingreso que no es Sueldo nunca es ancla", () => {
    const movs = [mov("i1", { tipo: "Ingreso", categoria: "Ahorros" })];
    expect(esAncla(movs[0], movs)).toBe(false);
  });

  it("con dos sueldos en el período, solo el primero es ancla", () => {
    const movs = [
      sueldo("s1", { fecha: "2026-07-01" }),
      sueldo("s2", { fecha: "2026-07-15" }), // aguinaldo, medio sueldo, etc.
    ];
    expect(esAncla(movs[0], movs)).toBe(true);
    expect(esAncla(movs[1], movs)).toBe(false);
  });

  it("el sueldo de OTRO período no interfiere", () => {
    const movs = [
      sueldo("s1", { periodoId: "01/07/2026" }),
      sueldo("s2", { periodoId: "01/08/2026", fecha: "2026-08-01" }),
    ];
    // Cada uno ancla su propio período.
    expect(esAncla(movs[0], movs)).toBe(true);
    expect(esAncla(movs[1], movs)).toBe(true);
  });
});

describe("borrables", () => {
  it("saca el sueldo ancla de la selección", () => {
    const movs = [sueldo("s1"), mov("g1"), mov("g2")];
    expect(borrables(["s1", "g1", "g2"], movs).map((m) => m.id)).toEqual(["g1", "g2"]);
  });

  it("seleccionar SOLO el ancla no deja nada para borrar", () => {
    const movs = [sueldo("s1"), mov("g1")];
    expect(borrables(["s1"], movs)).toEqual([]);
  });

  it("ignora ids que no están en la lista", () => {
    const movs = [mov("g1")];
    expect(borrables(["g1", "fantasma"], movs).map((m) => m.id)).toEqual(["g1"]);
  });
});

describe("recategorizables", () => {
  it("acepta gastos e ingresos comunes", () => {
    const movs = [mov("g1"), mov("i1", { tipo: "Ingreso", categoria: "Ahorros" })];
    expect(recategorizables(["g1", "i1"], movs).map((m) => m.id)).toEqual(["g1", "i1"]);
  });

  it("excluye Move y operaciones de divisa (su categoría es estructural)", () => {
    const movs = [
      mov("mv", { tipo: "Move", categoria: "Move", direccionMove: "aAhorro" }),
      mov("fx", { tipo: "CompraUSD", categoria: "Dólares" }),
      mov("g1"),
    ];
    expect(recategorizables(["mv", "fx", "g1"], movs).map((m) => m.id)).toEqual(["g1"]);
  });

  it("excluye el RESTO (arrastre de período)", () => {
    const movs = [mov("r", { tipo: "Ingreso", categoria: "RESTO" }), mov("g1")];
    expect(recategorizables(["r", "g1"], movs).map((m) => m.id)).toEqual(["g1"]);
  });

  it("excluye el sueldo ancla", () => {
    const movs = [sueldo("s1"), mov("g1")];
    expect(recategorizables(["s1", "g1"], movs).map((m) => m.id)).toEqual(["g1"]);
  });
});

describe("toggleId", () => {
  it("agrega y saca", () => {
    expect(toggleId([], "a")).toEqual(["a"]);
    expect(toggleId(["a", "b"], "a")).toEqual(["b"]);
    expect(toggleId(["a"], "b")).toEqual(["a", "b"]);
  });
});
