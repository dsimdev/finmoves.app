import { describe, it, expect } from "vitest";
import { recurrentKey, recurrentDocId } from "@/utils/recurrent-key";

describe("recurrentKey — la observación distingue recurrentes", () => {
  // El caso del usuario: GAMES·STEAM·ESO+ marcado como recurrente; cargar GAMES·STEAM·ESO Pass
  // NO debe matchear ese recurrente (son dos cosas distintas).
  it("STEAM ESO+ y STEAM ESO Pass son recurrentes DISTINTOS", () => {
    const eso = recurrentKey({ tipo: "Gasto", categoria: "GAMES", descripcion: "Steam", observaciones: "ESO+" });
    const pass = recurrentKey({ tipo: "Gasto", categoria: "GAMES", descripcion: "Steam", observaciones: "ESO Pass" });
    expect(eso).not.toBe(pass);
  });

  it("misma descripción + misma observación = MISMO recurrente (case/espacios no importan)", () => {
    const a = recurrentKey({ tipo: "Gasto", categoria: "GAMES", descripcion: "Steam", observaciones: "ESO+" });
    const b = recurrentKey({ tipo: "Gasto", categoria: "GAMES", descripcion: "  steam ", observaciones: " eso+  " });
    expect(a).toBe(b);
  });

  it("observación vacía y con observación son distintos", () => {
    const sin = recurrentKey({ tipo: "Gasto", categoria: "Car", descripcion: "Seguro" });
    const con = recurrentKey({ tipo: "Gasto", categoria: "Car", descripcion: "Seguro", observaciones: "Mercantil andina" });
    expect(sin).not.toBe(con);
  });

  it("dos observaciones distintas del mismo seguro son distintos recurrentes", () => {
    const a = recurrentKey({ tipo: "Gasto", categoria: "Car", descripcion: "Seguro", observaciones: "Mercantil andina" });
    const b = recurrentKey({ tipo: "Gasto", categoria: "Car", descripcion: "Seguro", observaciones: "otra aseguradora" });
    expect(a).not.toBe(b);
  });
});

describe("recurrentDocId — coherente con la clave lógica", () => {
  it("el doc id deriva de la misma clave (obs vacía no mete '_' fantasma)", () => {
    const f = { tipo: "Gasto", categoria: "Car", descripcion: "Seguro" };
    // El doc id es la clave saneada: comparten la misma base, así cliente/cron/doc no divergen.
    expect(recurrentDocId(f)).toBe(recurrentKey(f).replace(/[/.#$[\]]/g, "-"));
  });

  it("sanea caracteres que Firestore no admite en el id, sin cambiar la clave lógica", () => {
    const f = { tipo: "Gasto", categoria: "Web", descripcion: "Hosting", observaciones: "www.midominio.com" };
    const id = recurrentDocId(f);
    expect(id).not.toMatch(/[/.#$[\]]/);         // id saneado
    expect(recurrentKey(f)).toContain("www.midominio.com".toLowerCase()); // clave lógica intacta
  });
});
