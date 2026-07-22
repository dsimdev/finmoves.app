// Repetición mensual de recordatorios: un recordatorio repetible vuelve SIEMPRE el mismo
// número de día ("el 23"), que es lo que uno espera de un vencimiento real (seguro, alquiler,
// cuota). Puro y testeable; el cron (lib/notifications.ts) lo usa al avisar.
//
// El caso que obliga a guardar el día aparte: un recordatorio del 31 no puede existir en
// febrero. Se muestra el último día del mes (28), pero el mes siguiente vuelve al 31 — si se
// derivara de la última fecha usada, un 31 se degradaría a 28 para siempre.

/** Último día de un mes (1-12). */
export function ultimoDiaDelMes(anio: number, mes: number): number {
  return new Date(Date.UTC(anio, mes, 0)).getUTCDate();
}

/**
 * Fecha de la próxima repetición mensual.
 *
 * @param fecha        fecha actual del recordatorio, YYYY-MM-DD
 * @param diaOriginal  día que el usuario eligió (1-31). Si falta, se toma el de `fecha`.
 * @returns            YYYY-MM-DD del mes siguiente, recortado al último día si no existe
 */
export function proximaFecha(fecha: string, diaOriginal?: number): string {
  const [y, m] = fecha.split("-").map(Number);
  const dia = diaOriginal ?? Number(fecha.split("-")[2]);

  // Mes siguiente (diciembre → enero del año que viene).
  const mesSig = m === 12 ? 1 : m + 1;
  const anioSig = m === 12 ? y + 1 : y;

  const diaFinal = Math.min(dia, ultimoDiaDelMes(anioSig, mesSig));
  return `${anioSig}-${String(mesSig).padStart(2, "0")}-${String(diaFinal).padStart(2, "0")}`;
}

/**
 * Avanza un recordatorio repetible hasta que su fecha quede en el futuro respecto de `hoy`.
 * Necesario si el cron no corrió por un tiempo: sin esto, un recordatorio mensual quedaría
 * atrasado y avisaría una vez por día hasta ponerse al día.
 */
export function avanzarHastaFutura(fecha: string, hoy: string, diaOriginal?: number): string {
  let f = proximaFecha(fecha, diaOriginal);
  // Cota de seguridad: 120 iteraciones = 10 años, imposible en uso real pero evita
  // un bucle infinito si entrara una fecha corrupta.
  for (let i = 0; f <= hoy && i < 120; i++) f = proximaFecha(f, diaOriginal);
  return f;
}
