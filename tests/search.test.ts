import { describe, it, expect } from "vitest";
import { words, termMatches, movWords, movMatchesAny } from "@/utils/search";
import type { Movimiento } from "@/types";

// La regla del negocio acá es "palabra EXACTA": buscar "car" NO debe traer "recarga".
// Es el corazón de /analisis y del filtro de Movimientos, y no tenía tests.

const mov = (over: Partial<Movimiento> = {}): Movimiento => ({
  id: "1", timestampCarga: new Date(), fecha: "2026-07-18", tipo: "Gasto",
  categoria: "Auto", descripcion: "Nafta", monto: 1000, medioPago: "Débito",
  observaciones: "", periodoId: "1/7/2026", userId: "u", ...over,
});

describe("words", () => {
  it("parte por cualquier no-alfanumérico y baja a minúsculas", () => {
    expect(words("Peaje-Autopista, 2026")).toEqual(["peaje", "autopista", "2026"]);
  });

  it("descarta vacíos y puntuación suelta", () => {
    expect(words("  ...  ")).toEqual([]);
  });

  it("conserva letras con tilde y ñ como parte de la palabra", () => {
    // \p{L} las toma: "años" no se parte en "a"+"os".
    expect(words("Años Ñandú")).toEqual(["años", "ñandú"]);
  });
});

describe("termMatches", () => {
  const tw = new Set(words("Carga de nafta en Shell"));

  it("pega por palabra exacta", () => {
    expect(termMatches(tw, "nafta")).toBe(true);
    expect(termMatches(tw, "NAFTA")).toBe(true);
  });

  it("NO pega por substring (el caso car/recarga de la auditoría)", () => {
    expect(termMatches(new Set(words("recarga sube")), "car")).toBe(false);
  });

  it("término de varias palabras exige TODAS (AND interno)", () => {
    expect(termMatches(tw, "nafta shell")).toBe(true);
    expect(termMatches(tw, "nafta ypf")).toBe(false);
  });

  it("término vacío no matchea nada", () => {
    expect(termMatches(tw, "")).toBe(false);
    expect(termMatches(tw, "   ")).toBe(false);
  });
});

describe("movWords", () => {
  it("junta categoría + descripción + observaciones", () => {
    const w = movWords(mov({ categoria: "Auto", descripcion: "Nafta", observaciones: "ruta 2" }));
    expect(w.has("auto")).toBe(true);
    expect(w.has("nafta")).toBe(true);
    expect(w.has("ruta")).toBe(true);
  });

  it("tolera campos ausentes sin romper", () => {
    const w = movWords(mov({ descripcion: undefined, observaciones: undefined }));
    expect(w.has("auto")).toBe(true);
  });
});

describe("movMatchesAny", () => {
  it("es un OR entre términos (juntar rubros distintos: peajes + nafta)", () => {
    const m = mov({ descripcion: "Peaje" });
    expect(movMatchesAny(m, ["nafta", "peaje"])).toBe(true);
  });

  it("sin términos no matchea (lista vacía = sin filtro, no 'todo')", () => {
    expect(movMatchesAny(mov(), [])).toBe(false);
  });

  it("matchea por observaciones, no sólo por descripción", () => {
    expect(movMatchesAny(mov({ observaciones: "eso pass" }), ["pass"])).toBe(true);
  });
});
