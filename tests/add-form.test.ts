import { describe, it, expect } from "vitest";
import { estadoInicial, estadoReseteado, estadoParcheado, hoyISO } from "@/components/movements/useAddForm";

// Transiciones del form de alta. Son puras a propósito: el modal las compone dentro de
// setState, y así los bordes se testean sin montar React ni DOM.

describe("estadoInicial", () => {
  it("defaults del alta, con la fecha en hoy", () => {
    const s = estadoInicial();
    expect(s.tipo).toBe("Gasto");
    expect(s.medioPago).toBe("Mercado Pago");
    expect(s.modoCarga).toBe("USD");
    expect(s.moveDir).toBe("aDisponible");
    expect(s.monto).toBe("");
    expect(s.repetir).toBe(false);
    expect(s.fecha).toBe(hoyISO());
  });
});

describe("estadoReseteado", () => {
  it("limpia los campos cargados", () => {
    const sucio = estadoParcheado(estadoInicial(), {
      categoria: "Auto", monto: "900", observaciones: "x", repetir: true,
      cantidadUSD: "50", cotizManual: "1200", abreNuevoPeriodo: true, origenAhorro: "Bono",
    });
    const s = estadoReseteado(sucio);
    expect(s).toMatchObject({
      categoria: "", monto: "", observaciones: "", repetir: false,
      cantidadUSD: "", cotizManual: "", abreNuevoPeriodo: false, origenAhorro: "",
    });
  });

  it("CONSERVA tipo y medio de pago", () => {
    // El reset viejo del modal tampoco los tocaba: el tipo lo fija el efecto de apertura
    // justo después (pisarlo lo haría parpadear a "Gasto") y el medio se mantiene entre
    // altas seguidas a propósito.
    const prev = estadoParcheado(estadoInicial(), { tipo: "Ingreso", medioPago: "Efectivo", monto: "500" });
    const s = estadoReseteado(prev);
    expect(s.tipo).toBe("Ingreso");
    expect(s.medioPago).toBe("Efectivo");
    expect(s.monto).toBe("");
  });

  it("la fecha vuelve a hoy", () => {
    const prev = estadoParcheado(estadoInicial(), { fecha: "2020-01-01" });
    expect(estadoReseteado(prev).fecha).toBe(hoyISO());
  });
});

describe("apertura del modal: reset seguido de parche (mismo tick)", () => {
  it("el prefill del recurrente gana sobre el reset", () => {
    // El efecto de apertura hace resetAdd() y después setAddFields({...}). React batchea
    // ambos updates; el parche tiene que ver el estado ya reseteado y pisarlo.
    const sucio = estadoParcheado(estadoInicial(), { categoria: "Viejo", monto: "999", descripcion: "anterior" });
    const s = estadoParcheado(estadoReseteado(sucio), {
      tipo: "Gasto", categoria: "Servicios", descripcion: "Steam", observaciones: "eso+",
    });
    expect(s).toMatchObject({ categoria: "Servicios", descripcion: "Steam", observaciones: "eso+" });
    expect(s.monto).toBe(""); // el monto del alta anterior NO sobrevive
  });

  it("modo reserva: el tipo del parche sobrevive al reset", () => {
    const s = estadoParcheado(estadoReseteado(estadoInicial()), { tipo: "CompraEUR" });
    expect(s.tipo).toBe("CompraEUR");
  });

  it("sin períodos: arranca en Ingreso/Sueldo", () => {
    const s = estadoParcheado(estadoReseteado(estadoInicial()), { tipo: "Ingreso", categoria: "Sueldo" });
    expect(s).toMatchObject({ tipo: "Ingreso", categoria: "Sueldo" });
  });
});

describe("estadoParcheado", () => {
  it("toca sólo los campos del parche", () => {
    const prev = estadoParcheado(estadoInicial(), { categoria: "Auto" });
    const s = estadoParcheado(prev, { monto: "1500" });
    expect(s.monto).toBe("1500");
    expect(s.categoria).toBe("Auto");
  });

  it("no muta el estado anterior", () => {
    const prev = estadoInicial();
    estadoParcheado(prev, { monto: "1500" });
    expect(prev.monto).toBe("");
  });
});
