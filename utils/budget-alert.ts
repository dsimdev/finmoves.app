// Alerta de desvío de presupuesto: proyecta, con el ritmo del período, si una categoría
// va camino a pasarse de su presupuesto — y avisa ANTES de pasarse, cuando todavía se puede
// corregir. Pura y testeable (el check del cron en lib/notifications.ts la usa).
//
// Un período dura ~30 días (la app proyecta el cierre con `gastadoPorDia * 30`, ver
// utils/reportes.ts ritmoGasto). La proyección por categoría hace lo mismo: lo gastado hasta
// hoy, estirado al ritmo diario por los 30 días del período.

const DIAS_PERIODO = 30;

// No proyectar al principio del período: con pocos días el ritmo es ruido y avisaría de más.
// A partir de ~30% del período (9 días) el ritmo ya es representativo.
export const MIN_DIAS_PARA_PROYECTAR = 9;

// Umbral de proyección: avisar cuando el cierre proyectado supera el presupuesto. 1.0 = justo
// el presupuesto; un pelín arriba (1.05) evita avisar por un desvío trivial que se corrige solo.
export const UMBRAL_PROYECCION = 1.05;

export interface CategoriaEnRiesgo {
  categoria: string;
  gastado: number;
  presupuesto: number;
  /** Cierre proyectado al ritmo actual. */
  proyeccion: number;
  /** proyeccion / presupuesto, redondeado a % entero. */
  pctProyectado: number;
}

/**
 * Categorías que, al ritmo del período, van a cerrar por encima de su presupuesto.
 *
 * @param gastadoPorCategoria  lo gastado hasta hoy por categoría (solo las que tienen gasto)
 * @param presupuesto          presupuesto efectivo por categoría (override o template)
 * @param diasTranscurridos    días desde que abrió el período hasta hoy
 * @param yaAvisadas           categorías ya notificadas este período (dedup, no re-avisar)
 */
export function categoriasEnRiesgo(
  gastadoPorCategoria: Record<string, number>,
  presupuesto: Record<string, number>,
  diasTranscurridos: number,
  yaAvisadas: string[] = []
): CategoriaEnRiesgo[] {
  // Guarda de "período ya avanzado": antes de MIN_DIAS no hay datos suficientes para proyectar.
  if (diasTranscurridos < MIN_DIAS_PARA_PROYECTAR) return [];

  const avisadas = new Set(yaAvisadas);
  const enRiesgo: CategoriaEnRiesgo[] = [];

  for (const [categoria, presu] of Object.entries(presupuesto)) {
    if (!(presu > 0)) continue;               // categoría sin presupuesto real
    if (avisadas.has(categoria)) continue;    // ya avisé por esta en este período
    const gastado = gastadoPorCategoria[categoria] ?? 0;
    if (gastado <= 0) continue;               // sin gasto real → nada que proyectar

    const proyeccion = (gastado / diasTranscurridos) * DIAS_PERIODO;
    if (proyeccion <= presu * UMBRAL_PROYECCION) continue;

    enRiesgo.push({
      categoria,
      gastado,
      presupuesto: presu,
      proyeccion,
      pctProyectado: Math.round((proyeccion / presu) * 100),
    });
  }

  // Peor primero (mayor % proyectado): si hay varias, el cuerpo del push muestra las top.
  return enRiesgo.sort((a, b) => b.pctProyectado - a.pctProyectado);
}
