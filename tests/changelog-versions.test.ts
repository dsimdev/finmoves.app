import { describe, it, expect } from "vitest";
import { parseChangelogVersions, releasesSince, UPDATE_BANNER_THRESHOLD } from "@/lib/changelog-versions";

// Decide cuándo mostrar el aviso de novedades (banner + push). Los bordes importan: un
// Infinity de más molesta a todos los usuarios en cada release; uno de menos y nunca avisa.

const MD = `
# Changelog

## [2.90.1] - 2026-07-18
- fix del swipe

## [2.90.0] - 2026-07-17
- proyecciones

## [2.89.0] - 2026-07-16
- metas
`;

describe("parseChangelogVersions", () => {
  it("extrae las versiones en orden del archivo (nueva → vieja)", () => {
    expect(parseChangelogVersions(MD)).toEqual(["2.90.1", "2.90.0", "2.89.0"]);
  });

  it("ignora encabezados que no son de versión", () => {
    expect(parseChangelogVersions("# Changelog\n## Notas\n## [1.0.0]")).toEqual(["1.0.0"]);
  });

  it("changelog vacío o sin versiones → lista vacía, no rompe", () => {
    expect(parseChangelogVersions("")).toEqual([]);
    expect(parseChangelogVersions("texto suelto")).toEqual([]);
  });
});

describe("releasesSince", () => {
  const vs = ["2.90.1", "2.90.0", "2.89.0", "2.88.0"];

  it("cuenta los releases entre from (exclusivo) y to (inclusive)", () => {
    expect(releasesSince(vs, "2.89.0", "2.90.1")).toBe(2);
    expect(releasesSince(vs, "2.90.0", "2.90.1")).toBe(1);
  });

  it("misma versión = 0 releases (nada nuevo que avisar)", () => {
    expect(releasesSince(vs, "2.90.1", "2.90.1")).toBe(0);
  });

  it("usuario nuevo (from null) → Infinity: siempre ve el aviso", () => {
    expect(releasesSince(vs, null, "2.90.1")).toBe(Infinity);
  });

  it("from desconocido (reinstaló o versión vieja podada) → Infinity", () => {
    expect(releasesSince(vs, "1.0.0", "2.90.1")).toBe(Infinity);
  });

  it("to NO listado → 0: no molesta hasta que el changelog registre la versión", () => {
    // Protege del deploy en que package.json ya subió pero el CHANGELOG todavía no.
    expect(releasesSince(vs, "2.88.0", "2.91.0")).toBe(0);
  });

  it("el umbral del banner dispara a partir de 5 releases", () => {
    const largo = ["2.95.0", "2.94.0", "2.93.0", "2.92.0", "2.91.0", "2.90.0"];
    expect(releasesSince(largo, "2.90.0", "2.95.0")).toBe(5);
    expect(releasesSince(largo, "2.90.0", "2.95.0") >= UPDATE_BANNER_THRESHOLD).toBe(true);
    expect(releasesSince(largo, "2.91.0", "2.95.0") >= UPDATE_BANNER_THRESHOLD).toBe(false);
  });
});
