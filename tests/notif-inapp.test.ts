import { describe, it, expect } from "vitest";
import { notificacionesPendientes, type EstadoInApp } from "@/utils/notif-inapp";
import type { Movimiento } from "@/types";

// Lo que la campana anota al ABRIR la app, sin mandar push. El dedup usa una marca propia del
// cliente (InAppMeta) para no tocar el baseline del cron.

const base = (over: Partial<EstadoInApp> = {}): EstadoInApp => ({
  meta: {},
  dolarOficial: null,
  appVersion: undefined,
  movimientos: [],
  config: null,
  recurrentes: [],
  recordatorios: [],
  presupuesto: {},
  periodoActual: null,
  diasTranscurridos: 10,
  hoy: "2026-07-21",
  ...over,
});

describe("dólar", () => {
  it("la primera vez solo ancla, no avisa", () => {
    const r = notificacionesPendientes(base({ dolarOficial: 1000 }));
    expect(r.nuevas).toEqual([]);
    expect(r.meta.dolar).toBe(1000);
  });

  it("avisa cuando supera el 3% desde lo último anotado", () => {
    const r = notificacionesPendientes(base({ dolarOficial: 1040, meta: { dolar: 1000 } }));
    expect(r.nuevas).toHaveLength(1);
    expect(r.nuevas[0].tipo).toBe("dolar");
    expect(r.nuevas[0].body).toContain("subió 4.0%");
    expect(r.meta.dolar).toBe(1040); // re-ancla
  });

  it("no avisa por variaciones chicas", () => {
    const r = notificacionesPendientes(base({ dolarOficial: 1020, meta: { dolar: 1000 } }));
    expect(r.nuevas).toEqual([]);
    expect(r.meta.dolar).toBe(1000); // el baseline NO se mueve
  });

  it("detecta también las bajas", () => {
    const r = notificacionesPendientes(base({ dolarOficial: 950, meta: { dolar: 1000 } }));
    expect(r.nuevas[0].body).toContain("bajó 5.0%");
  });
});

describe("versión", () => {
  it("la primera vez solo ancla", () => {
    const r = notificacionesPendientes(base({ appVersion: "2.96.0" }));
    expect(r.nuevas).toEqual([]);
    expect(r.meta.version).toBe("2.96.0");
  });

  it("avisa al cambiar de versión y no repite", () => {
    const r1 = notificacionesPendientes(base({ appVersion: "2.97.0", meta: { version: "2.96.0" } }));
    expect(r1.nuevas.map((n) => n.tipo)).toEqual(["version"]);
    // Con la marca ya actualizada, la próxima apertura no vuelve a anotarla.
    const r2 = notificacionesPendientes(base({ appVersion: "2.97.0", meta: r1.meta }));
    expect(r2.nuevas).toEqual([]);
  });
});

describe("presupuesto", () => {
  const mov = (categoria: string, monto: number): Movimiento => ({
    id: `${categoria}-${monto}`, periodoId: "01/07/2026", descripcion: "",
    timestampCarga: new Date(), fecha: "2026-07-10", tipo: "Gasto",
    categoria, monto, medioPago: "Débito", observaciones: "", userId: "u",
  });

  it("anota las categorías que proyectan pasarse", () => {
    const r = notificacionesPendientes(base({
      presupuesto: { Comida: 10000 },
      periodoActual: { periodoId: "01/07/2026", movimientos: [mov("Comida", 6000)] },
      diasTranscurridos: 10,
    }));
    expect(r.nuevas.map((n) => n.tipo)).toEqual(["presupuesto"]);
    // El dedup se comparte con el cron: va en budgetAvisos, no en la marca del cliente.
    expect(r.budgetAvisos).toEqual({ "01/07/2026": ["Comida"] });
  });

  it("no repite una categoría que el CRON ya avisó (dedup compartido)", () => {
    const r = notificacionesPendientes(base({
      presupuesto: { Comida: 10000 },
      periodoActual: { periodoId: "01/07/2026", movimientos: [mov("Comida", 6000)] },
      diasTranscurridos: 10,
      budgetAvisos: { "01/07/2026": ["Comida"] },
    }));
    expect(r.nuevas).toEqual([]);
  });

  it("separa las ya excedidas de las que van camino a pasarse", () => {
    const r = notificacionesPendientes(base({
      presupuesto: { Comida: 10000, Ocio: 10000 },
      periodoActual: {
        periodoId: "01/07/2026",
        movimientos: [mov("Comida", 12000), mov("Ocio", 4000)], // Comida ya se pasó
      },
      diasTranscurridos: 10,
    }));
    // Dos notificaciones distintas: el hecho consumado y lo que todavía se puede corregir.
    expect(r.nuevas).toHaveLength(2);
    expect(r.nuevas[0].title).toBe("Presupuesto excedido");
    expect(r.nuevas[0].body).toContain("Comida se pasó");
    expect(r.nuevas[1].title).toBe("Presupuesto");
    expect(r.nuevas[1].body).toContain("Ocio");
  });

  it("el detalle lista todas las categorías, el body es de una línea", () => {
    const r = notificacionesPendientes(base({
      presupuesto: { A: 10000, B: 10000, C: 10000 },
      periodoActual: {
        periodoId: "01/07/2026",
        movimientos: [mov("A", 12000), mov("B", 15000), mov("C", 20000)],
      },
      diasTranscurridos: 10,
    }));
    expect(r.nuevas[0].body).toBe("3 categorías ya se pasaron");
    expect(r.nuevas[0].detalle?.split("\n")).toHaveLength(3);
  });
});

describe("recordatorios (solo pre-aviso)", () => {
  it("anota cuando faltan 1..3 días", () => {
    const r = notificacionesPendientes(base({
      recordatorios: [{ id: "r1", texto: "Comprar usd", fecha: "2026-07-23" }], // faltan 2
    }));
    expect(r.nuevas.map((n) => n.tipo)).toEqual(["recordatorio"]);
    expect(r.nuevas[0].body).toBe("en 2 días: Comprar usd");
    expect(r.meta.recordatoriosPre).toEqual(["r1"]);
  });

  it("dice 'mañana' cuando falta uno", () => {
    const r = notificacionesPendientes(base({
      recordatorios: [{ id: "r1", texto: "Pagar seguro", fecha: "2026-07-22" }],
    }));
    expect(r.nuevas[0].body).toBe("mañana: Pagar seguro");
  });

  it("NO anota el día de la fecha: ese aviso es del cron (que además borra el doc)", () => {
    const r = notificacionesPendientes(base({
      recordatorios: [{ id: "r1", texto: "Hoy", fecha: "2026-07-21" }],
    }));
    expect(r.nuevas).toEqual([]);
  });

  it("no repite el pre-aviso en cada apertura", () => {
    const est = base({ recordatorios: [{ id: "r1", texto: "Comprar usd", fecha: "2026-07-23" }] });
    const r1 = notificacionesPendientes(est);
    expect(r1.nuevas).toHaveLength(1);
    const r2 = notificacionesPendientes({ ...est, meta: r1.meta });
    expect(r2.nuevas).toEqual([]);
  });

  it("purga del dedup los recordatorios que ya no existen", () => {
    const r = notificacionesPendientes(base({
      recordatorios: [{ id: "r2", texto: "Nuevo", fecha: "2026-07-23" }],
      meta: { recordatoriosPre: ["viejo-borrado"] },
    }));
    expect(r.meta.recordatoriosPre).toEqual(["r2"]); // el viejo se descartó
  });
});

describe("varios a la vez", () => {
  it("junta lo que corresponda de cada check", () => {
    const r = notificacionesPendientes(base({
      dolarOficial: 1050, meta: { dolar: 1000, version: "2.95.0" },
      appVersion: "2.96.0",
      recordatorios: [{ id: "r1", texto: "Comprar usd", fecha: "2026-07-22" }],
    }));
    expect(r.nuevas.map((n) => n.tipo).sort()).toEqual(["dolar", "recordatorio", "version"]);
  });
});
