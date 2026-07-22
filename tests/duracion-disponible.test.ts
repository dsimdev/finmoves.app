import { describe, it, expect } from "vitest";
import { duracionDisponible, duracionMedianaPeriodos, DIAS_PERIODO_FALLBACK } from "@/utils/duracion-disponible";

// Ritmo = gastadoPuro / diasTranscurridos. La duración del período se mide de los períodos
// reales; estos casos usan el default de 30 salvo que se indique otra.

const dia = (iso: string) => new Date(`${iso}T00:00:00Z`);

describe("duracionMedianaPeriodos", () => {
  it("mide la distancia real entre períodos consecutivos", () => {
    // Cobros cada 30 días (lista del más nuevo al más viejo).
    expect(duracionMedianaPeriodos([dia("2026-03-02"), dia("2026-01-31"), dia("2026-01-01")])).toBe(30);
  });

  it("usa la MEDIANA: un período atípico no corre el número", () => {
    // Distancias: 14, 30, 30 → mediana 30 (el promedio daría ~25).
    const r = duracionMedianaPeriodos([
      dia("2026-03-16"), dia("2026-03-02"), dia("2026-01-31"), dia("2026-01-01"),
    ]);
    expect(r).toBe(30);
  });

  it("se adapta a ciclos que no son mensuales (quincenal)", () => {
    expect(duracionMedianaPeriodos([dia("2026-02-01"), dia("2026-01-17"), dia("2026-01-02")])).toBe(15);
  });

  it("sin historial suficiente cae al default", () => {
    expect(duracionMedianaPeriodos([])).toBe(DIAS_PERIODO_FALLBACK);
    expect(duracionMedianaPeriodos([dia("2026-01-01")])).toBe(DIAS_PERIODO_FALLBACK);
  });
});

describe("duracionDisponible", () => {
  it("proyecta los días que aguanta el disponible al ritmo actual", () => {
    // 10 días gastando 1000/día → 10.000 disponibles duran 10 días más.
    const r = duracionDisponible(10000, 10000, 10);
    expect(r.dias).toBe(10);
    expect(r.diasRestantes).toBe(20);
    expect(r.llega).toBe(false); // 10 < 20 → no llega al cierre
  });

  it("marca que llega cuando cubre lo que falta del período", () => {
    // 10 días gastando 500/día → 15.000 duran 30 días, faltan 20.
    const r = duracionDisponible(15000, 5000, 10);
    expect(r.dias).toBe(30);
    expect(r.llega).toBe(true);
  });

  it("sin gasto todavía no hay ritmo: el dato no existe", () => {
    const r = duracionDisponible(50000, 0, 5);
    expect(r.dias).toBeNull();
    expect(r.llega).toBe(true); // no se marca alarma sin datos
  });

  it("sin disponible dura 0 días y no llega", () => {
    const r = duracionDisponible(0, 20000, 12);
    expect(r.dias).toBe(0);
    expect(r.llega).toBe(false);
  });

  it("disponible negativo también es 0 (ya te pasaste)", () => {
    expect(duracionDisponible(-5000, 20000, 12).dias).toBe(0);
  });

  it("al final del período no quedan días restantes", () => {
    const r = duracionDisponible(3000, 30000, 30);
    expect(r.diasRestantes).toBe(0);
    expect(r.llega).toBe(true); // cualquier cosa "llega" si no falta nada
  });

  it("pasado el día 30 no devuelve restantes negativos", () => {
    expect(duracionDisponible(3000, 30000, 34).diasRestantes).toBe(0);
  });

  it("redondea para abajo: no promete un día que no cubre", () => {
    // 1000/día, 2500 disponibles → 2 días completos, no 2,5.
    expect(duracionDisponible(2500, 10000, 10).dias).toBe(2);
  });
});

describe("porDiaSugerido — cuánto podés gastar de acá al cierre", () => {
  it("reparte el disponible entre los días que faltan", () => {
    // Día 10 → faltan 20; 40.000 disponibles → 2.000 por día.
    expect(duracionDisponible(40000, 10000, 10).porDiaSugerido).toBe(2000);
  });

  it("existe aunque todavía no hayas gastado nada", () => {
    // Sin gasto no hay "te dura", pero sí se puede sugerir el reparto.
    const r = duracionDisponible(30000, 0, 15);
    expect(r.dias).toBeNull();
    expect(r.porDiaSugerido).toBe(2000); // 30.000 / 15 días restantes
  });

  it("no sugiere nada si el período ya cerró", () => {
    expect(duracionDisponible(5000, 20000, 30).porDiaSugerido).toBeNull();
    expect(duracionDisponible(5000, 20000, 33).porDiaSugerido).toBeNull();
  });

  it("no sugiere nada si no queda disponible", () => {
    expect(duracionDisponible(0, 20000, 10).porDiaSugerido).toBeNull();
    expect(duracionDisponible(-100, 20000, 10).porDiaSugerido).toBeNull();
  });

  it("respeta la duración real del período, no los 30 por defecto", () => {
    // Ciclo quincenal: al día 10 faltan 5, no 20.
    const q = duracionDisponible(10000, 5000, 10, 15);
    expect(q.diasRestantes).toBe(5);
    expect(q.porDiaSugerido).toBe(2000);
    // Con el default de 30 el mismo caso daría 20 días restantes y 500/día.
    const m = duracionDisponible(10000, 5000, 10);
    expect(m.diasRestantes).toBe(20);
    expect(m.porDiaSugerido).toBe(500);
  });

  it("caso real: los dos números describen el mismo período coherentemente", () => {
    // Datos de un período en curso: quedan 386.976 de 2.545.730, consumido 2.158.754
    // (gastos + moves a ahorros), día 22 de un ciclo de 29.
    const r = duracionDisponible(386976, 2158754, 22, 29);
    // Al ritmo real (98.125/día) el disponible dura menos de 4 días…
    expect(r.dias).toBe(3);
    // …pero faltan 7 para cerrar → NO llega, y el objetivo diario es bastante menor al ritmo.
    expect(r.diasRestantes).toBe(7);
    expect(r.llega).toBe(false);
    expect(Math.round(r.porDiaSugerido!)).toBe(55282);
    // La contradicción aparente se explica sola: 55.282 (objetivo) < 98.125 (ritmo actual).
    expect(r.porDiaSugerido!).toBeLessThan(2158754 / 22);
  });

  it("el veredicto 'llega' depende de la duración real", () => {
    // Dura 20 días. En ciclo quincenal (faltan 5) llega; en mensual (faltan 20) justo.
    expect(duracionDisponible(20000, 10000, 10, 15).llega).toBe(true);
    expect(duracionDisponible(20000, 10000, 10, 30).llega).toBe(true); // 20 >= 20
    expect(duracionDisponible(15000, 10000, 10, 30).llega).toBe(false); // 15 < 20
  });
});
