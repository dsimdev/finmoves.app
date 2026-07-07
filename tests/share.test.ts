import { describe, it, expect } from "vitest";
import { parseShareMovimiento } from "@/utils/share";

describe("parseShareMovimiento", () => {
  it("extrae monto AR con miles y decimales + comercio tras 'a'", () => {
    expect(parseShareMovimiento("", "Pagaste $1.234,56 a Kiosco Don Pepe")).toEqual({
      monto: 1234.56, descripcion: "Kiosco Don Pepe",
    });
  });

  it("monto con miles sin decimales", () => {
    expect(parseShareMovimiento("", "Transferencia por $50.000").monto).toBe(50000);
  });

  it("usa el título como descripción si es corto y no es URL", () => {
    const r = parseShareMovimiento("Pago a Farmacia", "$3.500");
    expect(r.monto).toBe(3500);
    expect(r.descripcion).toBe("Pago a Farmacia");
  });

  it("ignora una URL como descripción", () => {
    const r = parseShareMovimiento("https://mpago.la/abc", "$999");
    expect(r.monto).toBe(999);
    expect(r.descripcion).toBeUndefined();
  });

  it("entero simple sin signo", () => {
    expect(parseShareMovimiento("", "Gasté 4500 en el súper").monto).toBe(4500);
  });

  it("texto sin monto → sin monto", () => {
    expect(parseShareMovimiento("", "hola").monto).toBeUndefined();
  });

  it("vacío → objeto vacío", () => {
    expect(parseShareMovimiento("", "")).toEqual({});
  });
});
