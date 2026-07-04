import { describe, it, expect } from "vitest";
import { reservaFX, calcularReserva, tiposReserva } from "@/utils/reserva";
import type { Movimiento } from "@/types";

// Fixture mínimo de Movimiento (solo lo que consumen las funciones importa).
function mov(p: Partial<Movimiento>): Movimiento {
  return {
    id: "x", timestampCarga: new Date("2026-01-01"), fecha: "2026-01-01",
    tipo: "Gasto", categoria: "", descripcion: "", monto: 0, medioPago: "",
    observaciones: "", periodoId: "1/1/2026", userId: "u",
    ...p,
  };
}

describe("tiposReserva", () => {
  it("mapea los tipos por moneda", () => {
    expect(tiposReserva("USD")).toEqual({ compra: "CompraUSD", gasto: "GastoUSD", venta: "VentaUSD", ingreso: "IngresoUSD" });
    expect(tiposReserva("EUR").compra).toBe("CompraEUR");
  });
});

describe("reservaFX", () => {
  it("suma compras/ingresos y resta gastos/ventas", () => {
    const movs = [
      mov({ tipo: "CompraUSD", cantidadUSD: 100 }),
      mov({ tipo: "IngresoUSD", cantidadUSD: 50 }),
      mov({ tipo: "GastoUSD", cantidadUSD: 30 }),
      mov({ tipo: "VentaUSD", cantidadUSD: 20 }),
    ];
    expect(reservaFX(movs, "USD")).toBe(100); // 100 + 50 - 30 - 20
  });
  it("respeta el saldo base", () => {
    expect(reservaFX([mov({ tipo: "CompraUSD", cantidadUSD: 10 })], "USD", 40)).toBe(50);
  });
  it("ignora movimientos de otra moneda", () => {
    const movs = [mov({ tipo: "CompraUSD", cantidadUSD: 100 }), mov({ tipo: "CompraEUR", cantidadUSD: 999 })];
    expect(reservaFX(movs, "USD")).toBe(100);
  });
  it("ignora movimientos sin cantidadUSD", () => {
    expect(reservaFX([mov({ tipo: "CompraUSD" })], "USD")).toBe(0);
  });
});

describe("calcularReserva (costo promedio móvil)", () => {
  it("compra y venta parcial mantienen el promedio", () => {
    const movs = [
      mov({ tipo: "CompraUSD", cantidadUSD: 100, monto: 100_000, timestampCarga: new Date("2026-01-01") }),
      mov({ tipo: "GastoUSD", cantidadUSD: 40, monto: 0, timestampCarga: new Date("2026-01-02") }),
    ];
    const r = calcularReserva(movs, "USD");
    expect(r.total).toBe(60);
    expect(r.costoTotalARS).toBe(60_000);
    expect(r.costoPromedio).toBe(1_000);
  });
  it("ingreso en divisa suma a costo 0 y baja el promedio", () => {
    const movs = [
      mov({ tipo: "CompraUSD", cantidadUSD: 100, monto: 100_000, timestampCarga: new Date("2026-01-01") }),
      mov({ tipo: "IngresoUSD", cantidadUSD: 100, monto: 0, timestampCarga: new Date("2026-01-02") }),
    ];
    const r = calcularReserva(movs, "USD");
    expect(r.total).toBe(200);
    expect(r.costoTotalARS).toBe(100_000);
    expect(r.costoPromedio).toBe(500);
  });
  it("procesa en orden cronológico aunque lleguen desordenados", () => {
    const movs = [
      mov({ tipo: "GastoUSD", cantidadUSD: 40, timestampCarga: new Date("2026-01-02") }),
      mov({ tipo: "CompraUSD", cantidadUSD: 100, monto: 100_000, timestampCarga: new Date("2026-01-01") }),
    ];
    expect(calcularReserva(movs, "USD").total).toBe(60);
  });
});
