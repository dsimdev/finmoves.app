import { describe, it, expect } from "vitest";
import { simularMeta } from "@/utils/simulador-meta";

// El simulador trabaja en la unidad que le pasan: pesos para la meta propia, dólares para la
// FX. Los casos usan números redondos; la fórmula es ceil(faltante / ritmo).

describe("simularMeta", () => {
  it("proyecta los períodos base y con el extra", () => {
    // Faltan 600.000, ritmo 100.000/período → 6. Con +50.000 → 150.000 → 4.
    const r = simularMeta(600000, 100000, 50000);
    expect(r.periodosBase).toBe(6);
    expect(r.periodosSimulado).toBe(4);
    expect(r.periodosMenos).toBe(2);
    expect(r.yaLlega).toBe(false);
  });

  it("sin extra, base y simulado coinciden", () => {
    const r = simularMeta(600000, 100000, 0);
    expect(r.periodosBase).toBe(6);
    expect(r.periodosSimulado).toBe(6);
    expect(r.periodosMenos).toBe(0);
  });

  it("redondea hacia arriba (un período incompleto igual cuenta)", () => {
    // 250.000 / 100.000 = 2,5 → 3.
    expect(simularMeta(250000, 100000, 0).periodosBase).toBe(3);
  });

  it("meta ya alcanzada = 0 períodos", () => {
    const r = simularMeta(0, 100000, 0);
    expect(r.periodosBase).toBe(0);
    expect(r.periodosSimulado).toBe(0);
    expect(r.yaLlega).toBe(true);
  });

  it("con el extra se alcanza en el mismo período (yaLlega)", () => {
    // Faltan 50.000; con +60.000 de ritmo, un período basta.
    const r = simularMeta(50000, 0, 60000);
    expect(r.periodosSimulado).toBe(1);
    // yaLlega es 0 períodos exactos; acá tarda 1, así que no.
    expect(r.yaLlega).toBe(false);
  });

  it("sin ritmo base no llega, pero el extra puede destrabarlo", () => {
    // Ritmo 0 (no ahorrás nada) → base null (nunca). Con +100.000 → sí proyecta.
    const r = simularMeta(300000, 0, 100000);
    expect(r.periodosBase).toBeNull();
    expect(r.periodosSimulado).toBe(3);
    // No hay "X períodos antes" medible: antes era infinito.
    expect(r.periodosMenos).toBeNull();
  });

  it("ritmo negativo (vendés más de lo que juntás) cuenta como no llegar", () => {
    const r = simularMeta(300000, -20000, 0);
    expect(r.periodosBase).toBeNull();
    expect(r.periodosSimulado).toBeNull();
  });

  it("un extra que no cambia el redondeo no adelanta períodos", () => {
    // 300.000 / 100.000 = 3. Con +10.000 → 300.000/110.000 = 2,7 → 3. Igual.
    const r = simularMeta(300000, 100000, 10000);
    expect(r.periodosBase).toBe(3);
    expect(r.periodosSimulado).toBe(3);
    expect(r.periodosMenos).toBe(0);
  });

  it("funciona igual con unidades chicas (meta FX en dólares)", () => {
    // Faltan 900 USD, ritmo 100 USD/período → 9. Con +50 → 150 → 6.
    const r = simularMeta(900, 100, 50);
    expect(r.periodosBase).toBe(9);
    expect(r.periodosSimulado).toBe(6);
    expect(r.periodosMenos).toBe(3);
  });
});
