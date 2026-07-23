// Simulador de meta: "¿en cuántos períodos llego si ahorro más / recorto un gasto?".
//
// NO recalcula proyecciones propias — recibe el ritmo base y cuántos períodos faltan HOY, y
// re-proyecta con un ritmo aumentado. Así el simulador y el número real de la card salen de la
// misma fórmula (ceil(faltante / ritmo)) y no pueden divergir. Puro y testeable.
//
// Trabaja en la UNIDAD de cada meta — no mezcla:
//   · Meta propia (ARS): faltante y ritmo en PESOS. El ritmo es el ahorro neto (ritmoAhorro).
//     Perillas: "ahorro más" (+$ por período) y "recorto un gasto" (el recorte va a ahorros
//     vía Move manual o vía el RESTO que se arrastra al cierre → +$ al ritmo). La diferencia
//     entre esas dos perillas es de PRESENTACIÓN, no de cálculo.
//   · Meta FX (USD/EUR): faltante y ritmo en DIVISA. El ritmo es la compra NETA de divisa
//     (compras − ventas), NO el ahorro en pesos convertido: recortar pesos no compra dólares
//     solo. Perilla única: "compro más divisa" (+X por período).
// El faltante y el ritmo se calculan afuera con las funciones que ya existen; acá solo se
// re-proyecta con el extra.

export interface SimulacionMeta {
  /** Períodos para llegar HOY, al ritmo actual. null si el ritmo es ≤0 (nunca llega). */
  periodosBase: number | null;
  /** Períodos para llegar con el extra aplicado. null si sigue sin llegar. */
  periodosSimulado: number | null;
  /** Cuántos períodos antes se llega (base − simulado). 0 si no cambió, null si no comparable. */
  periodosMenos: number | null;
  /** true si con el extra ya se alcanzó (0 períodos). */
  yaLlega: boolean;
}

/**
 * @param faltanteARS   cuánto falta para la meta, en ARS (para la FX, la meta ya viene
 *                      convertida a ARS por periodosParaMetaUSD; acá siempre se trabaja en ARS)
 * @param ritmoBase     ahorro por período actual, en ARS. null/≤0 = no se está ahorrando
 * @param extraPorPeriodo  cuánto más se ahorraría por período (≥0)
 */
export function simularMeta(
  faltanteARS: number,
  ritmoBase: number | null,
  extraPorPeriodo: number
): SimulacionMeta {
  const periodos = (ritmo: number | null): number | null => {
    if (faltanteARS <= 0) return 0;            // ya alcanzada
    if (ritmo == null || ritmo <= 0) return null; // sin ritmo, no llega nunca
    return Math.ceil(faltanteARS / ritmo);
  };

  const periodosBase = periodos(ritmoBase);
  const ritmoSim = (ritmoBase ?? 0) + Math.max(0, extraPorPeriodo);
  const periodosSimulado = periodos(ritmoSim > 0 ? ritmoSim : null);

  // Cuántos períodos se adelanta. Solo comparable si ambos números existen.
  const periodosMenos =
    periodosBase != null && periodosSimulado != null
      ? Math.max(0, periodosBase - periodosSimulado)
      : periodosSimulado != null && periodosBase == null
        ? null // antes no llegaba y ahora sí: hay mejora pero no un "X períodos antes" medible
        : null;

  return {
    periodosBase,
    periodosSimulado,
    periodosMenos,
    yaLlega: periodosSimulado === 0,
  };
}
