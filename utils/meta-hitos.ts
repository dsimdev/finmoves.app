// Hitos de la meta propia (50/75/100%). La celebración es IN-APP y no por push: el
// acumulado sólo se mueve cuando el usuario carga un movimiento, o sea que siempre está
// mirando la app en ese momento. Un push del cron llegaría después de que ya lo vio.

export const HITOS_META = [50, 75, 100] as const;

/** Hitos cruzados que todavía no se festejaron. Vacío si no hay meta o ya se festejaron todos. */
export function hitosNuevos(acumulado: number, meta: number, yaFestejados: number[] = []): number[] {
  if (!(meta > 0)) return [];
  const pct = (Math.max(0, acumulado) / meta) * 100;
  return HITOS_META.filter((h) => pct >= h && !yaFestejados.includes(h));
}

/** El hito a mostrar cuando se cruzan varios de una (ej. 0 → 100% de un saque): el mayor. */
export function hitoAFestejar(acumulado: number, meta: number, yaFestejados: number[] = []): number | null {
  const nuevos = hitosNuevos(acumulado, meta, yaFestejados);
  return nuevos.length > 0 ? Math.max(...nuevos) : null;
}
