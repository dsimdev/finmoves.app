import { describe, it, expect } from "vitest";
import { hitosNuevos, hitoAFestejar } from "@/utils/meta-hitos";

describe("hitosNuevos", () => {
  it("devuelve los hitos cruzados que faltan festejar", () => {
    expect(hitosNuevos(50_000, 100_000)).toEqual([50]);
    expect(hitosNuevos(80_000, 100_000)).toEqual([50, 75]);
  });

  it("no repite los ya festejados", () => {
    expect(hitosNuevos(80_000, 100_000, [50])).toEqual([75]);
    expect(hitosNuevos(80_000, 100_000, [50, 75])).toEqual([]);
  });

  it("por debajo del 50% no festeja nada", () => {
    expect(hitosNuevos(49_999, 100_000)).toEqual([]);
  });

  it("pasarse de la meta cuenta como 100", () => {
    expect(hitosNuevos(150_000, 100_000, [50, 75])).toEqual([100]);
  });

  it("meta inválida (0 o negativa) no rompe ni festeja", () => {
    expect(hitosNuevos(10_000, 0)).toEqual([]);
    expect(hitosNuevos(10_000, -5)).toEqual([]);
  });

  it("acumulado negativo (retiros > ahorros) no festeja", () => {
    expect(hitosNuevos(-10_000, 100_000)).toEqual([]);
  });
});

describe("hitoAFestejar", () => {
  it("cruzar varios de una vez muestra SOLO el mayor", () => {
    // De 0 a la meta completa en una carga: se festeja 100, no tres confetis seguidos.
    expect(hitoAFestejar(100_000, 100_000)).toBe(100);
  });

  it("null cuando no hay nada nuevo", () => {
    expect(hitoAFestejar(80_000, 100_000, [50, 75])).toBeNull();
  });
});
