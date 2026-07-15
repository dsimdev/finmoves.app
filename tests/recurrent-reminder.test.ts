import { describe, it, expect } from "vitest";
import { shouldRemind, daysBetween, type RecReminderState } from "@/utils/recurrent-reminder";

// Ref fija para calcular fechas relativas: sumar N días a "2026-01-01".
const ref = "2026-01-01";
const dayN = (n: number) => {
  const d = new Date(Date.UTC(2026, 0, 1 + n));
  return d.toISOString().slice(0, 10);
};

describe("daysBetween", () => {
  it("cuenta días enteros", () => {
    expect(daysBetween("2026-01-01", "2026-01-01")).toBe(0);
    expect(daysBetween("2026-01-01", "2026-01-28")).toBe(27);
    expect(daysBetween("2026-01-01", dayN(25))).toBe(25);
  });
});

describe("shouldRemind — esquema 25 / 28 / semanal", () => {
  it("antes del día 25 no avisa", () => {
    expect(shouldRemind(ref, dayN(24), undefined)).toBeNull();
  });

  it("día 25: primer aviso (etapa 'pre')", () => {
    const r = shouldRemind(ref, dayN(25), undefined);
    expect(r).not.toBeNull();
    expect(r!.stage).toBe("pre");
    expect(r!.lastNotified).toBe(dayN(25));
  });

  it("día 26-27: no re-avisa si ya avisó el 'pre'", () => {
    const prev: RecReminderState = { ref, lastNotified: dayN(25), stage: "pre" };
    expect(shouldRemind(ref, dayN(26), prev)).toBeNull();
    expect(shouldRemind(ref, dayN(27), prev)).toBeNull();
  });

  it("día 28: segundo aviso (etapa 'due')", () => {
    const prev: RecReminderState = { ref, lastNotified: dayN(25), stage: "pre" };
    const r = shouldRemind(ref, dayN(28), prev);
    expect(r).not.toBeNull();
    expect(r!.stage).toBe("due");
    expect(r!.lastNotified).toBe(dayN(28));
  });

  it("después del 28 repite cada 7 días, no antes", () => {
    const prev: RecReminderState = { ref, lastNotified: dayN(28), stage: "due" };
    expect(shouldRemind(ref, dayN(30), prev)).toBeNull();  // solo pasaron 2 días
    expect(shouldRemind(ref, dayN(34), prev)).toBeNull();  // 6 días
    const r = shouldRemind(ref, dayN(35), prev);           // 7 días → sí
    expect(r).not.toBeNull();
    expect(r!.lastNotified).toBe(dayN(35));
  });

  it("no avisa dos veces el mismo día", () => {
    const prev: RecReminderState = { ref, lastNotified: dayN(28), stage: "due" };
    expect(shouldRemind(ref, dayN(28), prev)).toBeNull();
  });

  it("recurrente nunca cargado: cuenta desde createdAt (ref = createdAt)", () => {
    // Si nunca se cargó, el caller pasa createdAt como ref → mismo esquema.
    const created = "2026-03-01";
    expect(shouldRemind(created, dayN(0) === "2026-01-01" ? "2026-03-24" : "", undefined)).toBeNull(); // día 23
    const r = shouldRemind(created, "2026-03-26", undefined); // día 25
    expect(r).not.toBeNull();
    expect(r!.stage).toBe("pre");
  });

  it("al cargar (cambia la ref) el ciclo se reinicia", () => {
    // Estaba en 'due' con ref viejo; llega una carga nueva → ref cambia → estado no aplica.
    const prev: RecReminderState = { ref: "2026-01-01", lastNotified: "2026-02-05", stage: "due" };
    const nuevaRef = "2026-02-10"; // última carga reciente
    // A los 10 días de la nueva ref, todavía no toca (< 25).
    expect(shouldRemind(nuevaRef, "2026-02-20", prev)).toBeNull();
  });
});
