import { describe, it, expect } from "vitest";
import { movMatchesAny } from "@/utils/search";
import type { Movimiento } from "@/types";

// Cubre el recorte del selector de año/período cuando la búsqueda es global: qué pills
// sobreviven, y a cuál se cae cuando el año o el período elegido dejan de tener resultados.
// Réplica de la derivación que hace movements/page.tsx (periodosVisibles → años → activo).

const mov = (id: string, periodoId: string, descripcion: string): Movimiento => ({
  id, periodoId, descripcion,
  timestampCarga: new Date(), fecha: "2026-03-12", tipo: "Gasto",
  categoria: "Varios", monto: 100, medioPago: "Débito", observaciones: "", userId: "u",
});

// Períodos del más nuevo al más viejo, como los devuelve agruparPorPeriodo.
const periodos = [
  { periodoId: "05/09/2026", movimientos: [mov("a", "05/09/2026", "super"), mov("b", "05/09/2026", "dentista")] },
  { periodoId: "12/03/2026", movimientos: [mov("c", "12/03/2026", "nafta")] },
  { periodoId: "10/11/2025", movimientos: [mov("d", "10/11/2025", "dentista")] },
];

// — lo mismo que calcula la página —
const visibles = (terms: string[], global: boolean) =>
  global ? periodos.filter((p) => p.movimientos.some((m) => movMatchesAny(m, terms))) : periodos;
const añosDe = (ps: typeof periodos) =>
  Array.from(new Set(ps.map((p) => p.periodoId.split("/")[2] ?? ""))).filter(Boolean);
const añoActivoDe = (años: string[], añoSel: string) => (añoSel && años.includes(añoSel) ? añoSel : años[0] ?? "");
const activoDe = (ps: typeof periodos, sel: string | null) =>
  sel && ps.some((p) => p.periodoId === sel) ? sel : ps[0]?.periodoId;

describe("búsqueda global — recorte del selector", () => {
  it("sin búsqueda global, el selector muestra todos los períodos", () => {
    expect(visibles(["dentista"], false)).toHaveLength(3);
  });

  it("con global, solo quedan los períodos que tienen coincidencias", () => {
    const v = visibles(["dentista"], true);
    expect(v.map((p) => p.periodoId)).toEqual(["05/09/2026", "10/11/2025"]);
  });

  it("los años se recortan a los que tienen coincidencias", () => {
    expect(añosDe(visibles(["dentista"], true))).toEqual(["2026", "2025"]);
    // "nafta" solo existe en 2026 → 2025 desaparece del selector.
    expect(añosDe(visibles(["nafta"], true))).toEqual(["2026"]);
  });

  it("si el año elegido ya no tiene resultados, cae al más reciente que sí", () => {
    const años = añosDe(visibles(["nafta"], true)); // ["2026"]
    // Estabas parado en 2025, pero "nafta" no está ahí.
    expect(añoActivoDe(años, "2025")).toBe("2026");
  });

  it("respeta el año elegido si sigue teniendo resultados", () => {
    const años = añosDe(visibles(["dentista"], true)); // ["2026","2025"]
    expect(añoActivoDe(años, "2025")).toBe("2025");
  });

  it("si el período elegido no matchea, salta al más reciente con resultados", () => {
    const v = visibles(["dentista"], true);
    // Estabas en 12/03 (sin dentista) → salta al más nuevo con resultados.
    expect(activoDe(v, "12/03/2026")).toBe("05/09/2026");
    // Si el que tenías sí matchea, se queda.
    expect(activoDe(v, "10/11/2025")).toBe("10/11/2025");
  });

  it("sin coincidencias en ningún período, el selector queda vacío", () => {
    const v = visibles(["inexistente"], true);
    expect(v).toEqual([]);
    expect(añosDe(v)).toEqual([]);
    expect(activoDe(v, null)).toBeUndefined();
  });
});
