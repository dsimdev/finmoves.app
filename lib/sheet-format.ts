import type { Movimiento } from "@/types";

// Argentina = UTC-3 (sin horario de verano)
// El form de Google escribe la hora SIN padding (9:48:43), minutos y segundos con padding.
export function formatTimestampAR(date: Date): string {
  const ar = new Date(date.getTime() - 3 * 60 * 60 * 1000);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${ar.getUTCDate()}/${ar.getUTCMonth() + 1}/${ar.getUTCFullYear()} ${ar.getUTCHours()}:${pad(ar.getUTCMinutes())}:${pad(ar.getUTCSeconds())}`;
}

// "YYYY-MM-DD" → "D/M/YYYY" (formato del sheet)
export function isoToFechaAR(fecha: string): string {
  if (!fecha || !fecha.includes("-")) return fecha ?? "";
  const [y, m, d] = fecha.split("-");
  return `${parseInt(d)}/${parseInt(m)}/${y}`;
}

// Movimiento de Firestore → fila del sheet (orden de columnas A:I)
export function movimientoToRow(m: Movimiento): (string | number)[] {
  return [
    formatTimestampAR(m.timestampCarga),
    isoToFechaAR(m.fecha),
    m.tipo,
    m.categoria,
    m.descripcion ?? "",
    m.monto,
    m.medioPago ?? "",
    m.observaciones ?? "",
    m.periodoId,
  ];
}
