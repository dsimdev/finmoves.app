import { describe, it, expect } from "vitest";
import { montoAutoAhorro, aplicaAutoAhorro } from "@/utils/auto-ahorro";
import type { ConfigUsuario } from "@/types";

// La regla la comparten el modal y la carga rápida de escritorio: si divergieran, el mismo
// gasto ahorraría o no según desde dónde se cargue.

const cfg = (autoAhorro: Partial<NonNullable<ConfigUsuario["meta"]["autoAhorro"]>> | null): ConfigUsuario =>
  ({ meta: autoAhorro ? { autoAhorro: { activo: true, monto: 1000, ...autoAhorro } } : {} }) as ConfigUsuario;

const gasto = { tipo: "Gasto", categoria: "Auto", descripcion: "Nafta", medioPago: "Débito" };

describe("montoAutoAhorro", () => {
  it("aplica al gasto cuando está activo", () => {
    expect(montoAutoAhorro(cfg({}), gasto)).toBe(1000);
  });

  it("no aplica si está apagado, sin monto, o sin config", () => {
    expect(montoAutoAhorro(cfg({ activo: false }), gasto)).toBe(0);
    expect(montoAutoAhorro(cfg({ monto: 0 }), gasto)).toBe(0);
    expect(montoAutoAhorro(cfg(null), gasto)).toBe(0);
    expect(montoAutoAhorro(null, gasto)).toBe(0);
  });

  it("SÓLO aplica a gastos", () => {
    for (const tipo of ["Ingreso", "Move", "CompraUSD"]) {
      expect(montoAutoAhorro(cfg({}), { ...gasto, tipo })).toBe(0);
    }
  });

  it("sin medios configurados aplica a cualquier medio de pago", () => {
    expect(montoAutoAhorro(cfg({ mediosPago: [] }), gasto)).toBe(1000);
    expect(montoAutoAhorro(cfg({ mediosPago: undefined }), gasto)).toBe(1000);
  });

  it("con medios configurados, sólo a los de la lista", () => {
    const c = cfg({ mediosPago: ["Mercado Pago"] });
    expect(montoAutoAhorro(c, { ...gasto, medioPago: "Mercado Pago" })).toBe(1000);
    expect(montoAutoAhorro(c, { ...gasto, medioPago: "Débito" })).toBe(0);
  });

  it("respeta las descripciones excluidas, sin distinguir mayúsculas ni espacios", () => {
    const c = cfg({ omitirDescripciones: ["Alquiler"] });
    expect(montoAutoAhorro(c, { ...gasto, descripcion: "Alquiler" })).toBe(0);
    expect(montoAutoAhorro(c, { ...gasto, descripcion: "  alquiler  " })).toBe(0);
    expect(montoAutoAhorro(c, { ...gasto, descripcion: "Nafta" })).toBe(1000);
  });
});

describe("aplicaAutoAhorro", () => {
  it("es el booleano del monto", () => {
    expect(aplicaAutoAhorro(cfg({}), gasto)).toBe(true);
    expect(aplicaAutoAhorro(cfg({ activo: false }), gasto)).toBe(false);
  });
});
