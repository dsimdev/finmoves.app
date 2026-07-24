import { describe, it, expect } from "vitest";
import { proyectarRecurrentes, proyectadosPorFecha, sumarDias } from "@/utils/recurrent-forecast";
import { DUE_DAYS } from "@/utils/recurrent-reminder";

const rec = (over: Partial<Parameters<typeof proyectarRecurrentes>[0][number]> = {}) => ({
  id: "r1", tipo: "Gasto", categoria: "Servicios", descripcion: "Netflix",
  monto: 5000, activo: true, createdAt: Date.UTC(2026, 0, 1), ...over,
});

const mov = (over: Record<string, unknown> = {}) => ({
  tipo: "Gasto", categoria: "Servicios", descripcion: "Netflix", fecha: "2026-06-01", ...over,
});

describe("sumarDias", () => {
  it("suma sin corrimiento de zona", () => {
    expect(sumarDias("2026-06-01", 28)).toBe("2026-06-29");
  });
  it("cruza fin de mes y de año", () => {
    expect(sumarDias("2026-01-31", 1)).toBe("2026-02-01");
    expect(sumarDias("2026-12-25", 10)).toBe("2027-01-04");
  });
});

describe("proyectarRecurrentes", () => {
  it("proyecta a ultima carga + DUE_DAYS", () => {
    const [p] = proyectarRecurrentes([rec()], [mov({ fecha: "2026-06-01" })], "2026-06-10");
    expect(p.fecha).toBe(sumarDias("2026-06-01", DUE_DAYS));
  });

  it("usa la carga MAS RECIENTE cuando hay varias", () => {
    const movs = [mov({ fecha: "2026-04-01" }), mov({ fecha: "2026-06-01" }), mov({ fecha: "2026-05-01" })];
    const [p] = proyectarRecurrentes([rec()], movs, "2026-06-10");
    expect(p.fecha).toBe(sumarDias("2026-06-01", DUE_DAYS));
  });

  it("cae a createdAt si nunca se cargo", () => {
    // Mediodía UTC → mismo día en AR.
    const [p] = proyectarRecurrentes([rec({ createdAt: Date.UTC(2026, 5, 2, 12) })], [], "2026-06-10");
    expect(p.fecha).toBe(sumarDias("2026-06-02", DUE_DAYS));
  });

  it("ignora los inactivos", () => {
    expect(proyectarRecurrentes([rec({ activo: false })], [], "2026-06-10")).toHaveLength(0);
  });

  // createdAt a mediodía UTC: la referencia se calcula en hora AR (UTC-3), así que
  // medianoche UTC caería en el día anterior.
  const CREADO_1_JUN = Date.UTC(2026, 5, 1, 12);

  it("no matchea si difiere la observacion (recurrentes homonimos)", () => {
    // El movimiento tiene obs "eso+", el recurrente "eso pass" → no es su carga.
    const r = rec({ observaciones: "eso pass", createdAt: CREADO_1_JUN });
    const [p] = proyectarRecurrentes([r], [mov({ observaciones: "eso+", fecha: "2026-06-20" })], "2026-06-25");
    // Cae a createdAt (2026-06-01), no a la carga ajena del 20.
    expect(p.fecha).toBe(sumarDias("2026-06-01", DUE_DAYS));
  });

  it("no matchea si difiere la categoria", () => {
    const r = rec({ createdAt: CREADO_1_JUN });
    const [p] = proyectarRecurrentes([r], [mov({ categoria: "Ocio", fecha: "2026-06-20" })], "2026-06-25");
    expect(p.fecha).toBe(sumarDias("2026-06-01", DUE_DAYS));
  });

  it("la referencia por createdAt se toma en hora AR, no UTC", () => {
    // Medianoche UTC del 2 de junio = 21:00 del 1 de junio en AR → la ref es el 1.
    const [p] = proyectarRecurrentes([rec({ createdAt: Date.UTC(2026, 5, 2) })], [], "2026-06-10");
    expect(p.fecha).toBe(sumarDias("2026-06-01", DUE_DAYS));
  });

  describe("estado segun el ciclo del cron", () => {
    it("lejos antes de PRE_DAYS", () => {
      const [p] = proyectarRecurrentes([rec()], [mov({ fecha: "2026-06-01" })], "2026-06-10");
      expect(p.estado).toBe("lejos");
    });
    it("cerca entre PRE_DAYS y DUE_DAYS", () => {
      const [p] = proyectarRecurrentes([rec()], [mov({ fecha: "2026-06-01" })], "2026-06-27");
      expect(p.estado).toBe("cerca");
    });
    it("vencido desde DUE_DAYS", () => {
      const [p] = proyectarRecurrentes([rec()], [mov({ fecha: "2026-06-01" })], "2026-06-29");
      expect(p.estado).toBe("vencido");
      expect(p.dias).toBe(28);
    });
    it("sigue vencido mucho despues", () => {
      const [p] = proyectarRecurrentes([rec()], [mov({ fecha: "2026-06-01" })], "2026-08-01");
      expect(p.estado).toBe("vencido");
    });
  });

  it("proyecta cada recurrente por separado", () => {
    const rs = [
      rec({ id: "a", descripcion: "Netflix" }),
      rec({ id: "b", descripcion: "Spotify" }),
    ];
    const movs = [mov({ descripcion: "Netflix", fecha: "2026-06-01" }), mov({ descripcion: "Spotify", fecha: "2026-06-05" })];
    const out = proyectarRecurrentes(rs, movs, "2026-06-10");
    expect(out.map((p) => p.fecha)).toEqual([
      sumarDias("2026-06-01", DUE_DAYS),
      sumarDias("2026-06-05", DUE_DAYS),
    ]);
  });
});

describe("proyectadosPorFecha", () => {
  it("agrupa los que caen el mismo dia", () => {
    const rs = [rec({ id: "a", descripcion: "Netflix" }), rec({ id: "b", descripcion: "Spotify" })];
    const movs = [mov({ descripcion: "Netflix", fecha: "2026-06-01" }), mov({ descripcion: "Spotify", fecha: "2026-06-01" })];
    const mapa = proyectadosPorFecha(proyectarRecurrentes(rs, movs, "2026-06-10"));
    expect(mapa.size).toBe(1);
    expect(mapa.get(sumarDias("2026-06-01", DUE_DAYS))).toHaveLength(2);
  });
});
