import { describe, it, expect } from "vitest";
import { proximaFecha, avanzarHastaFutura, ultimoDiaDelMes } from "@/utils/recordatorio-repeat";

describe("ultimoDiaDelMes", () => {
  it("conoce los meses cortos y los bisiestos", () => {
    expect(ultimoDiaDelMes(2026, 1)).toBe(31);
    expect(ultimoDiaDelMes(2026, 2)).toBe(28);
    expect(ultimoDiaDelMes(2028, 2)).toBe(29); // bisiesto
    expect(ultimoDiaDelMes(2026, 4)).toBe(30);
  });
});

describe("proximaFecha — mismo día del mes siguiente", () => {
  it("mantiene el número de día", () => {
    expect(proximaFecha("2026-07-23")).toBe("2026-08-23");
    expect(proximaFecha("2026-08-23")).toBe("2026-09-23");
  });

  it("cruza el fin de año", () => {
    expect(proximaFecha("2026-12-15")).toBe("2027-01-15");
  });

  it("recorta al último día cuando el mes no tiene ese día", () => {
    // 31 de enero → febrero no tiene 31 → 28.
    expect(proximaFecha("2026-01-31")).toBe("2026-02-28");
    // En bisiesto llega hasta el 29.
    expect(proximaFecha("2028-01-31")).toBe("2028-02-29");
  });

  it("NO degrada el día original: 31 → 28 → vuelve a 31", () => {
    // Éste es el motivo de guardar diaOriginal. Sin él, después de febrero
    // el recordatorio quedaría clavado en 28 para siempre.
    const dia = 31;
    const feb = proximaFecha("2026-01-31", dia);
    expect(feb).toBe("2026-02-28");
    const mar = proximaFecha(feb, dia);
    expect(mar).toBe("2026-03-31"); // recupera el 31, no queda en 28
    const abr = proximaFecha(mar, dia);
    expect(abr).toBe("2026-04-30"); // abril tiene 30
    expect(proximaFecha(abr, dia)).toBe("2026-05-31"); // y vuelve a 31
  });

  it("sin diaOriginal usa el día de la fecha (comportamiento degradado)", () => {
    expect(proximaFecha("2026-02-28")).toBe("2026-03-28");
  });
});

describe("avanzarHastaFutura", () => {
  it("avanza un solo mes si con eso alcanza", () => {
    expect(avanzarHastaFutura("2026-07-23", "2026-07-23", 23)).toBe("2026-08-23");
  });

  it("salta varios meses si el cron estuvo caído", () => {
    // El recordatorio quedó en marzo y hoy es julio: debe ponerse en agosto, no en abril.
    expect(avanzarHastaFutura("2026-03-23", "2026-07-25", 23)).toBe("2026-08-23");
  });

  it("respeta el día original al saltar varios meses", () => {
    // De enero 31 hasta pasado abril → mayo 31 (no 28 ni 30).
    expect(avanzarHastaFutura("2026-01-31", "2026-04-30", 31)).toBe("2026-05-31");
  });
});
