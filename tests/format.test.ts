import { describe, it, expect } from "vitest";
import { abbr, shortPer, sinAño, periodoAnio, colorPct, colorPctDim, deltaColor, deltaMag } from "@/components/reports/format";

describe("abbr", () => {
  it("millones con 1 decimal", () => {
    expect(abbr(1_500_000)).toBe("$1.5M");
    expect(abbr(2_000_000)).toBe("$2.0M");
  });
  it("miles redondeados", () => {
    expect(abbr(2_400)).toBe("$2k");
    expect(abbr(2_500)).toBe("$3k"); // Math.round(2.5) = 3
  });
  it("menos de mil", () => {
    expect(abbr(999)).toBe("$999");
    expect(abbr(0)).toBe("$0");
  });
});

describe("colorPct (escala anclada al 100% del ingreso)", () => {
  it("verde hasta 90 inclusive", () => {
    expect(colorPct(0)).toBe("var(--green)");
    expect(colorPct(90)).toBe("var(--green)");
  });
  it("amarillo 90–105", () => {
    expect(colorPct(91)).toBe("var(--yellow)");
    expect(colorPct(105)).toBe("var(--yellow)");
  });
  it("rojo solo pasando el ingreso (>105)", () => {
    expect(colorPct(106)).toBe("var(--red)");
  });
  it("colorPctDim espeja los umbrales", () => {
    expect(colorPctDim(50)).toBe("var(--green-dim)");
    expect(colorPctDim(100)).toBe("var(--yellow-dim)");
    expect(colorPctDim(120)).toBe("var(--red-dim)");
  });
});

describe("deltaMag (tratamiento del cero)", () => {
  it("0 real queda 0", () => {
    expect(deltaMag(0)).toBe(0);
  });
  it("casi-cero muestra decimales", () => {
    expect(deltaMag(0.67)).toBe(0.67);
    expect(deltaMag(0.5)).toBe(0.5);
  });
  it(">=1 redondea a entero", () => {
    expect(deltaMag(5.4)).toBe(5);
    expect(deltaMag(-3.6)).toBe(-4);
  });
});

describe("deltaColor", () => {
  it("0 real → color de texto", () => {
    expect(deltaColor(0, true)).toBe("var(--text)");
    expect(deltaColor(0, false)).toBe("var(--text)");
  });
  it("upIsGood: positivo verde, negativo rojo", () => {
    expect(deltaColor(5, true)).toBe("var(--green)");
    expect(deltaColor(-5, true)).toBe("var(--red)");
  });
  it("upIsBad (ej. gasto/inflación): positivo rojo, negativo verde", () => {
    expect(deltaColor(5, false)).toBe("var(--red)");
    expect(deltaColor(-5, false)).toBe("var(--green)");
  });
});

describe("helpers de período/fecha", () => {
  it("periodoAnio saca el año o '??'", () => {
    expect(periodoAnio("30/8/2026")).toBe("2026");
    expect(periodoAnio("basura")).toBe("??");
  });
  it("shortPer deja día/mes", () => {
    expect(shortPer("30/8/2026")).toBe("30/8");
  });
  it("sinAño con fecha ISO y con barras", () => {
    expect(sinAño("2026-08-30")).toBe("30/08");
    expect(sinAño("30/8/2026")).toBe("30/8");
  });
});
