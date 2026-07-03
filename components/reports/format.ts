// Helpers de formato compartidos por la página de Reportes y sus gráficos.

export const periodoAnio = (periodoId: string) => periodoId.split("/")[2] ?? "??";

export const abbr = (n: number) => {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${Math.round(n)}`;
};

export const shortPer = (s: string) => { const [d, m] = s.split("/"); return `${d}/${m}`; };

export const sinAño = (fecha: string) => {
  if (fecha.includes("-")) {
    const [, m, d] = fecha.split("-");
    return `${d}/${m}`;
  }
  return fecha.includes("/") ? fecha.split("/").slice(0, 2).join("/") : fecha;
};

// Escala de color del % gastado, anclada al 100% = todo el ingreso del período.
// Verde mientras hay margen, amarillo cerca del límite, rojo solo al pasarse.
export const colorPct = (pct: number) =>
  pct > 105 ? "var(--red)" : pct > 90 ? "var(--yellow)" : "var(--green)";
export const colorPctDim = (pct: number) =>
  pct > 105 ? "var(--red-dim)" : pct > 90 ? "var(--yellow-dim)" : "var(--green-dim)";

// Tratamiento del cero en un delta (% o pts). El valor debe venir SIN redondear.
// - 0 exacto (sin cambio real) → color de texto neutro.
// - |v| < 1 (redondearía a "0" pero no es 0) → color según signo (no se lo esconde).
// upIsGood: true si subir es "bueno" (verde al positivo); false si subir es "malo" (rojo).
export const deltaColor = (v: number, upIsGood: boolean): string =>
  v === 0 ? "var(--text)" : (upIsGood ? v > 0 : v < 0) ? "var(--green)" : "var(--red)";

// Magnitud a mostrar de un delta: entero salvo que |v|<1 y ≠0, donde se muestran
// hasta 2 decimales para no mentir un "0". El 0 real queda "0".
export const deltaMag = (v: number): number =>
  v !== 0 && Math.abs(v) < 1 ? Math.round(v * 100) / 100 : Math.round(v);
