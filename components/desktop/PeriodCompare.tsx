"use client";

import { useMemo } from "react";
import { useT } from "@/hooks/useTranslation";
import { useMoney } from "@/hooks/useHideValues";
import { gastosPorCategoria } from "@/utils/periodo";
import { deltaMag, deltaColor } from "@/components/reports/format";
import type { PeriodoResumen } from "@/utils/periodo";

// Comparador de períodos lado a lado (escritorio). En móvil Reportes muestra UN período por
// vez y comparar obliga a ir y volver entre selecciones; acá cada período es una columna y
// cada métrica una fila, que es como se lee una comparación.
//
// La columna de la izquierda es la MÁS ANTIGUA: el delta de cada período se mide contra la
// columna anterior, así se lee la evolución de izquierda a derecha.

type Fila = {
  label: string;
  /** Valor por período, ya formateado. */
  valores: string[];
  /** Variación % contra el período anterior (null en el primero o si no aplica). */
  deltas: (number | null)[];
  /** true = subir es bueno (ingresos, ahorros); false = subir es malo (gastos). */
  subirEsBueno?: boolean;
  destacada?: boolean;
};

export function PeriodCompare({ periodos }: { periodos: PeriodoResumen[] }) {
  const t = useT();
  const { m: money } = useMoney();

  // Los períodos llegan del más nuevo al más viejo; para leer la evolución se invierte.
  const cols = useMemo(() => [...periodos].reverse(), [periodos]);

  const filas = useMemo((): Fila[] => {
    const serie = (get: (p: PeriodoResumen) => number) => cols.map(get);
    // Variación de cada columna contra la anterior. La primera no tiene con qué comparar.
    // Denominador en valor absoluto: con base negativa (ej. disponible en rojo) dividir por
    // el valor con signo invertía el delta —ir de −1000 a −500 (mejora) daba negativo—.
    const deltasDe = (vals: number[]) =>
      vals.map((v, i) => (i === 0 || !vals[i - 1] ? null : ((v - vals[i - 1]) / Math.abs(vals[i - 1])) * 100));

    const mk = (label: string, get: (p: PeriodoResumen) => number, opts: { subirEsBueno?: boolean; destacada?: boolean } = {}): Fila => {
      const vals = serie(get);
      return { label, valores: vals.map(money), deltas: deltasDe(vals), ...opts };
    };

    return [
      mk(t.salary, (p) => p.sueldo, { subirEsBueno: true, destacada: true }),
      mk(t.spent, (p) => p.gastadoPuro),
      mk(t.savings, (p) => p.moveAhorros, { subirEsBueno: true }),
      mk(t.available, (p) => p.disponible, { subirEsBueno: true, destacada: true }),
      {
        label: t.movementsShort,
        valores: cols.map((p) => String(p.movimientos.length)),
        deltas: deltasDe(cols.map((p) => p.movimientos.length)),
      },
    ];
  }, [cols, money, t]);

  // Categorías presentes en cualquiera de los períodos, ordenadas por gasto total.
  const categorias = useMemo(() => {
    const porPeriodo = cols.map((p) => new Map(gastosPorCategoria(p.movimientos, p.gastado).map((c) => [c.categoria, c.monto])));
    const nombres = new Set<string>();
    for (const m of porPeriodo) for (const k of m.keys()) nombres.add(k);
    return [...nombres]
      .map((cat) => ({ cat, montos: porPeriodo.map((m) => m.get(cat) ?? 0) }))
      .sort((a, b) => b.montos.reduce((s, v) => s + v, 0) - a.montos.reduce((s, v) => s + v, 0));
  }, [cols]);

  if (cols.length < 2) {
    return (
      <div className="soft" style={{ textAlign: "center", padding: 28, color: "var(--muted)", fontSize: 13 }}>
        {t.compareHint}
      </div>
    );
  }

  const celdaDelta = (d: number | null, subirEsBueno = false) => {
    if (d === null) return null;
    const mag = deltaMag(d);
    if (mag === 0) return <span className="cmp-delta" style={{ color: "var(--muted)" }}>0%</span>;
    return (
      <span className="cmp-delta" style={{ color: deltaColor(d, subirEsBueno) }}>
        {mag > 0 ? "↑" : "↓"}{Math.abs(mag)}%
      </span>
    );
  };

  return (
    <div className="dt-wrap">
      <table className="dt cmp">
        <thead>
          <tr>
            <th className="dt-flex" />
            {cols.map((p) => <th key={p.periodoId} style={{ textAlign: "right" }}>{p.periodoId}</th>)}
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.label} className={f.destacada ? "cmp-destacada" : undefined}>
              <td className="dt-flex" style={{ color: "var(--muted)" }}>{f.label}</td>
              {f.valores.map((v, i) => (
                <td key={i} style={{ textAlign: "right", fontFamily: "var(--font-mono)", whiteSpace: "nowrap" }}>
                  {v}
                  {celdaDelta(f.deltas[i], f.subirEsBueno)}
                </td>
              ))}
            </tr>
          ))}

          {/* Gasto por categoría: la parte que responde "en qué cambió" entre períodos. */}
          {categorias.length > 0 && (
            <tr className="cmp-sep">
              <td className="dt-flex" colSpan={cols.length + 1}>{t.byCategory}</td>
            </tr>
          )}
          {categorias.map(({ cat, montos }) => (
            <tr key={cat}>
              <td className="dt-flex" style={{ color: "var(--muted)" }}>{cat}</td>
              {montos.map((m, i) => {
                const prev = i > 0 ? montos[i - 1] : 0;
                const d = i === 0 || !prev ? null : ((m - prev) / Math.abs(prev)) * 100;
                return (
                  <td key={i} style={{ textAlign: "right", fontFamily: "var(--font-mono)", whiteSpace: "nowrap", color: m === 0 ? "var(--muted)" : undefined }}>
                    {m === 0 ? "—" : money(m)}
                    {celdaDelta(d)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
