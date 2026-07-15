// Lógica pura de recordatorio de recurrentes (testeable, sin Firestore). Decide si HOY
// corresponde avisar por un recurrente, según cuántos días pasaron desde su referencia
// (última carga que matchea, o createdAt si nunca se cargó) y el estado de dedup previo.
//
// Esquema de avisos (para TODOS los recurrentes):
//   - día PRE_DAYS (~25): aviso previo, una vez.
//   - día DUE_DAYS (~28): aviso "vencido", y luego cada REPEAT_DAYS (~7) mientras siga
//     sin cargarse (35, 42, …).
// Al cargar el recurrente, la referencia cambia (nueva última fecha) → el ciclo se reinicia
// solo (los días vuelven a ~0 y el estado guardado deja de aplicar a esa referencia).

export const PRE_DAYS = 25;
export const DUE_DAYS = 28;
export const REPEAT_DAYS = 7;

// Estado de dedup persistido por recurrente (en notifyMeta.recReminders[id]).
export type RecReminderState = {
  ref: string;        // fecha de referencia usada (YYYY-MM-DD): última carga o createdAt
  lastNotified: string; // último día que se avisó (YYYY-MM-DD), "" si nunca
  stage: "none" | "pre" | "due"; // etapa alcanzada del ciclo actual
};

// Días enteros entre dos fechas YYYY-MM-DD (b - a).
export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

// ¿Avisar hoy por este recurrente? Devuelve el nuevo estado si corresponde avisar, o null.
// - `ref`: fecha de referencia (última carga que matchea, o createdAt si nunca se cargó).
// - `today`: hoy (YYYY-MM-DD).
// - `prev`: estado guardado (o undefined la primera vez).
export function shouldRemind(
  ref: string,
  today: string,
  prev: RecReminderState | undefined,
): RecReminderState | null {
  const dias = daysBetween(ref, today);
  if (dias < PRE_DAYS) return null; // todavía no toca

  // Si la referencia cambió (se cargó → nueva última fecha, o createdAt distinto), el ciclo
  // previo ya no aplica: arrancamos limpio para esta referencia.
  const state: RecReminderState = prev && prev.ref === ref
    ? { ...prev }
    : { ref, lastNotified: "", stage: "none" };

  // Nunca avisar dos veces el mismo día.
  if (state.lastNotified === today) return null;

  if (dias >= DUE_DAYS) {
    // Etapa "vencido": el primer cruce de DUE avisa; después, cada REPEAT_DAYS.
    if (state.stage !== "due") {
      return { ref, lastNotified: today, stage: "due" };
    }
    // Ya está en "due": repetir solo si pasaron REPEAT_DAYS desde el último aviso.
    if (state.lastNotified && daysBetween(state.lastNotified, today) >= REPEAT_DAYS) {
      return { ref, lastNotified: today, stage: "due" };
    }
    return null;
  }

  // Etapa "pre" (PRE_DAYS ≤ dias < DUE_DAYS): avisar una sola vez.
  if (state.stage === "none") {
    return { ref, lastNotified: today, stage: "pre" };
  }
  return null;
}
