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
