import { describe, it, expect } from "vitest";
import { esTipoFX, monedaDeTipo, fxFlags, num, calcularFX, afectaDisponible } from "@/utils/movement-fx";

describe("esTipoFX / monedaDeTipo", () => {
  it("reconoce los 8 tipos FX", () => {
    for (const t of ["CompraUSD", "GastoUSD", "VentaUSD", "IngresoUSD", "CompraEUR", "GastoEUR", "VentaEUR", "IngresoEUR"]) {
      expect(esTipoFX(t)).toBe(true);
    }
  });

  it("los tipos normales no son FX", () => {
    expect(esTipoFX("Gasto")).toBe(false);
    expect(esTipoFX("Ingreso")).toBe(false);
    expect(esTipoFX("Move")).toBe(false);
  });

  it("la moneda sale del sufijo del tipo", () => {
    expect(monedaDeTipo("VentaEUR")).toBe("EUR");
    expect(monedaDeTipo("VentaUSD")).toBe("USD");
  });
});

describe("fxFlags", () => {
  it("Compra y Venta necesitan cotización (mueven pesos)", () => {
    expect(fxFlags("CompraUSD").esCompraOVenta).toBe(true);
    expect(fxFlags("VentaEUR").esCompraOVenta).toBe(true);
  });

  it("Gasto e Ingreso FX son sólo-cantidad (no tocan disponible)", () => {
    expect(fxFlags("GastoUSD").esSoloCantidad).toBe(true);
    expect(fxFlags("IngresoEUR").esSoloCantidad).toBe(true);
    expect(fxFlags("GastoUSD").esCompraOVenta).toBe(false);
  });

  it("un tipo no-FX no activa ninguna rama", () => {
    const f = fxFlags("Gasto");
    expect(f).toEqual({ esFX: false, esCompraOVenta: false, esSoloCantidad: false, moneda: "USD" });
  });
});

describe("afectaDisponible (qué entra en los reportes del período)", () => {
  it("Compra y Venta de divisa SÍ: mueven pesos del disponible", () => {
    expect(afectaDisponible("CompraUSD")).toBe(true);
    expect(afectaDisponible("VentaEUR")).toBe(true);
  });

  it("Ingreso y Gasto FX NO: sólo mueven la reserva, sin pasar por pesos", () => {
    // Regresión: aparecían en el donut de Movimientos de Reportes ensuciando el conteo.
    expect(afectaDisponible("IngresoUSD")).toBe(false);
    expect(afectaDisponible("GastoUSD")).toBe(false);
    expect(afectaDisponible("IngresoEUR")).toBe(false);
    expect(afectaDisponible("GastoEUR")).toBe(false);
  });

  it("los tipos normales siempre cuentan", () => {
    for (const t of ["Gasto", "Ingreso", "Move"]) expect(afectaDisponible(t)).toBe(true);
  });
});

describe("num (blindaje contra NaN)", () => {
  it("campo vacío o basura → 0, nunca NaN", () => {
    // Regresión: un input borrado persistía NaN en Firestore y rompía todos los KPIs.
    expect(num("")).toBe(0);
    expect(num("abc")).toBe(0);
    expect(num(undefined)).toBe(0);
    expect(num(null)).toBe(0);
    expect(num(NaN)).toBe(0);
  });

  it("parsea normales y decimales", () => {
    expect(num("1500")).toBe(1500);
    expect(num("1500.75")).toBe(1500.75);
    expect(num(1500)).toBe(1500);
  });
});

describe("calcularFX", () => {
  it("modo USD: la cantidad es lo tipeado, ARS se deriva por la cotización", () => {
    expect(calcularFX({ tipo: "CompraUSD", modoCarga: "USD", cantidadFX: "100", montoARS: "", cotizacion: 1200 }))
      .toEqual({ cantidad: 100, ars: 120_000 });
  });

  it("modo ARS: los pesos son lo tipeado, la cantidad se deriva", () => {
    expect(calcularFX({ tipo: "CompraUSD", modoCarga: "ARS", cantidadFX: "", montoARS: "120000", cotizacion: 1200 }))
      .toEqual({ cantidad: 100, ars: 120_000 });
  });

  it("los dos modos son consistentes entre sí (ida y vuelta)", () => {
    const porUSD = calcularFX({ tipo: "VentaEUR", modoCarga: "USD", cantidadFX: "50", montoARS: "", cotizacion: 1300 });
    const porARS = calcularFX({ tipo: "VentaEUR", modoCarga: "ARS", cantidadFX: "", montoARS: String(porUSD.ars), cotizacion: 1300 });
    expect(porARS.cantidad).toBeCloseTo(porUSD.cantidad);
  });

  it("Gasto/Ingreso FX: cantidad sí, ARS siempre 0 (no tocan el disponible)", () => {
    expect(calcularFX({ tipo: "GastoUSD", modoCarga: "USD", cantidadFX: "40", montoARS: "999", cotizacion: 1200 }))
      .toEqual({ cantidad: 40, ars: 0 });
    expect(calcularFX({ tipo: "IngresoEUR", modoCarga: "ARS", cantidadFX: "40", montoARS: "999", cotizacion: 1200 }))
      .toEqual({ cantidad: 40, ars: 0 });
  });

  it("cotización 0 en modo ARS → 0, no Infinity ni NaN", () => {
    // Si la API de cotización falla, el form no debe persistir Infinity.
    const r = calcularFX({ tipo: "CompraUSD", modoCarga: "ARS", cantidadFX: "", montoARS: "120000", cotizacion: 0 });
    expect(r.cantidad).toBe(0);
    expect(Number.isFinite(r.cantidad)).toBe(true);
  });

  it("campos vacíos no producen NaN en ninguna rama", () => {
    for (const modo of ["USD", "ARS"] as const) {
      const r = calcularFX({ tipo: "CompraEUR", modoCarga: modo, cantidadFX: "", montoARS: "", cotizacion: 1200 });
      expect(Number.isFinite(r.cantidad)).toBe(true);
      expect(Number.isFinite(r.ars)).toBe(true);
    }
  });

  it("tipo no-FX devuelve ceros (el form usa el monto común)", () => {
    expect(calcularFX({ tipo: "Gasto", modoCarga: "USD", cantidadFX: "100", montoARS: "100", cotizacion: 1200 }))
      .toEqual({ cantidad: 0, ars: 0 });
  });
});
