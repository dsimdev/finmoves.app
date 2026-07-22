import { describe, it, expect } from "vitest";
import {
  COLORES_CATEGORIA, COLORES_LISTA, ICONOS_LISTA,
  visualPorNombre, visualDeCategoria,
} from "@/utils/categoria-visual";

// Los tonos que la app usa para marcar TIPO de movimiento (globals.css). Ninguno puede
// aparecer en la paleta de categorías: un gasto con ícono verde junto a un monto rojo se
// leería mal.
const SEMANTICOS = {
  green: "#00e676",   // ingreso
  red: "#ff5252",     // gasto
  yellow: "#ffab40",  // compra/venta de divisa
  purple: "#b06ddb",  // move a ahorro
  blue: "#536dfe",    // RESTO
  teal: "#26c6da",    // move a disponible
  accent: "#3f52e8",
};

describe("paleta de categorías", () => {
  it("no reutiliza ningún color semántico", () => {
    const usados = Object.values(COLORES_CATEGORIA).map((c) => c.toLowerCase());
    for (const [nombre, hex] of Object.entries(SEMANTICOS)) {
      expect(usados, `la paleta no debe incluir ${nombre}`).not.toContain(hex.toLowerCase());
    }
  });

  it("no repite tonos entre sí", () => {
    const usados = Object.values(COLORES_CATEGORIA);
    expect(new Set(usados).size).toBe(usados.length);
  });

  it("todos los colores son hex válidos", () => {
    for (const hex of Object.values(COLORES_CATEGORIA)) {
      expect(hex).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});

describe("visualPorNombre — defaults de categorías existentes", () => {
  it("reconoce las categorías típicas", () => {
    expect(visualPorNombre("Comida").icono).toBe("comida");
    expect(visualPorNombre("Transporte").icono).toBe("transporte");
    expect(visualPorNombre("Salud").icono).toBe("salud");
    expect(visualPorNombre("Servicios").icono).toBe("servicios");
  });

  it("matchea por inclusión, no por igualdad exacta", () => {
    expect(visualPorNombre("Comida y bebida").icono).toBe("comida");
    expect(visualPorNombre("Super / comida").icono).toBe("comida");
  });

  it("ignora mayúsculas y tildes", () => {
    expect(visualPorNombre("EDUCACIÓN").icono).toBe("educacion");
    expect(visualPorNombre("educacion").icono).toBe("educacion");
  });

  it("reconoce nombres reales del usuario", () => {
    // Categorías que aparecen en la app del owner.
    expect(visualPorNombre("Games").icono).toBe("ocio");
    expect(visualPorNombre("Health").icono).toBe("salud");
    expect(visualPorNombre("Car").icono).toBe("transporte");
    expect(visualPorNombre("Daily").icono).toBe("hogar");
    expect(visualPorNombre("Loki").icono).toBe("mascotas");
  });

  it("una categoría desconocida cae en el ícono neutro", () => {
    expect(visualPorNombre("Zxqw").icono).toBe("otros");
  });

  it("farmacia usa la cruz, no el corazón de salud", () => {
    expect(visualPorNombre("Farmacia").icono).toBe("farmacia");
    expect(visualPorNombre("Medicamentos").icono).toBe("farmacia");
    // "Salud" a secas sigue con el corazón.
    expect(visualPorNombre("Salud").icono).toBe("salud");
  });

  it("sueldo y efectivo usan el billete", () => {
    expect(visualPorNombre("Sueldo").icono).toBe("billete");
    expect(visualPorNombre("Efectivo").icono).toBe("billete");
  });

  it("el color de una desconocida es estable pero no siempre el mismo", () => {
    // Estable: dos llamadas al mismo nombre dan igual.
    expect(visualPorNombre("Zxqw").color).toBe(visualPorNombre("Zxqw").color);
    // Repartido: nombres distintos no caen todos en el mismo tono.
    const colores = new Set(["aaa", "bbb", "ccc", "ddd", "eee"].map((n) => visualPorNombre(n).color));
    expect(colores.size).toBeGreaterThan(1);
  });
});

describe("visualDeCategoria — lo elegido gana al default", () => {
  it("respeta el ícono y color guardados", () => {
    const v = visualDeCategoria({ nombre: "Comida", icono: "viajes", color: "menta" });
    expect(v.icono).toBe("viajes");
    expect(v.color).toBe("menta");
    expect(v.hex).toBe(COLORES_CATEGORIA.menta);
  });

  it("sin elección usa el default por nombre", () => {
    const v = visualDeCategoria({ nombre: "Transporte" });
    expect(v.icono).toBe("transporte");
    expect(COLORES_LISTA).toContain(v.color);
  });

  it("descarta valores inválidos y cae al default", () => {
    // Un doc viejo o corrupto no debe romper el render.
    const v = visualDeCategoria({ nombre: "Salud", icono: "inexistente", color: "fucsia" });
    expect(v.icono).toBe("salud");
    expect(COLORES_LISTA).toContain(v.color);
  });

  it("siempre devuelve un hex de la paleta", () => {
    const v = visualDeCategoria({ nombre: "Cualquiera" });
    expect(Object.values(COLORES_CATEGORIA)).toContain(v.hex);
  });
});

describe("catálogos", () => {
  it("cada ícono del listado es único", () => {
    expect(new Set(ICONOS_LISTA).size).toBe(ICONOS_LISTA.length);
  });
});
