import { describe, it, expect } from "vitest";
import { agruparGastosPorDescripcion } from "@/utils/agrupar-gastos";

describe("agruparGastosPorDescripcion", () => {
  it("suma los que comparten descripcion y cuenta las veces", () => {
    const out = agruparGastosPorDescripcion([
      { descripcion: "CAR", monto: 500 },
      { descripcion: "CAR", monto: 300 },
      { descripcion: "Nafta", monto: 10000 },
    ]);
    expect(out).toEqual([
      { descripcion: "Nafta", total: 10000, veces: 1 },
      { descripcion: "CAR", total: 800, veces: 2 },
    ]);
  });

  it("ordena por total descendente, no por cantidad", () => {
    const out = agruparGastosPorDescripcion([
      { descripcion: "chico", monto: 10 },
      { descripcion: "chico", monto: 10 },
      { descripcion: "chico", monto: 10 },
      { descripcion: "grande", monto: 1000 },
    ]);
    expect(out.map((g) => g.descripcion)).toEqual(["grande", "chico"]);
  });

  it("ignora mayusculas y espacios de mas al agrupar", () => {
    const out = agruparGastosPorDescripcion([
      { descripcion: "Peaje", monto: 100 },
      { descripcion: "peaje", monto: 100 },
      { descripcion: "  PEAJE  ", monto: 100 },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ total: 300, veces: 3 });
  });

  it("muestra la PRIMERA forma vista de la descripcion", () => {
    const out = agruparGastosPorDescripcion([
      { descripcion: "Peaje", monto: 100 },
      { descripcion: "PEAJE", monto: 100 },
    ]);
    expect(out[0].descripcion).toBe("Peaje");
  });

  it("agrupa los sin descripcion bajo un guion", () => {
    const out = agruparGastosPorDescripcion([
      { descripcion: "", monto: 50 },
      { monto: 70 },
      { descripcion: "   ", monto: 30 },
    ]);
    expect(out).toEqual([{ descripcion: "—", total: 150, veces: 3 }]);
  });

  it("lista vacia devuelve vacio", () => {
    expect(agruparGastosPorDescripcion([])).toEqual([]);
  });
});
