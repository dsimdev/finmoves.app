"use client";

import { useT } from "@/hooks/useTranslation";
import { DonutChart } from "@/components/reports/charts";
import { MiniStat } from "@/components/ui/MiniStat";
import { abbr, sinAño, colorZ, deltaMag, TIPO_COLOR } from "@/components/reports/format";
import { formatARS } from "@/utils/periodo";
import { type KpisPeriodo } from "@/utils/reportes";
import type { PeriodoResumen } from "@/utils/periodo";

type KpiInfo = { title: string; value: string; explain: string; color?: string };

interface MovCounts {
  total: number;
  diasActivos: number;
  porTipo: [string, number][];
  porCat: { cat: string; count: number; total: number; color: string }[];
  porMedio: { medio: string; count: number; total: number; color: string; tipos: { tipo: string; n: number; monto: number }[] }[];
}

interface Props {
  periodo: PeriodoResumen;
  periodos: PeriodoResumen[];
  movCounts: MovCounts;
  kpis: KpisPeriodo | null;
  finPeriodo: Date | null;
  tendenciaMovs: number | null;
  avgHistoricoMovs: number;
  oculto: boolean;
  selectedMovTipo: string | null;
  setSelectedMovTipo: (v: string | null) => void;
  setKpiInfo: (v: KpiInfo) => void;
  setModalTop: (v: "gastos" | "descs" | "movcat" | null) => void;
  setMedioModal: (v: string | null) => void;
}

// Subtab "Movimientos" de Reportes: distribución por tipo (donut + leyenda), mini-stats
// del día y de tendencia, y desgloses por categoría y medio de pago.
export function MovimientosTab({
  periodo, periodos, movCounts, kpis, finPeriodo, tendenciaMovs, avgHistoricoMovs,
  oculto, selectedMovTipo, setSelectedMovTipo, setKpiInfo, setModalTop, setMedioModal,
}: Props) {
  const t = useT();
  const reportOn = (_id: string) => true;
  const tipoColor = TIPO_COLOR;

  return (
    <>
      {reportOn("movimientos_kpis") && (
        <>
          {/* Hero: total + distribución por tipo */}
          <div className="soft" style={{ marginBottom: 12, background: "linear-gradient(135deg, var(--surface), var(--teal-dim) 60%, var(--purple-dim))", display: "grid", gridTemplateColumns: "auto 1fr auto", alignItems: "center", gap: 10 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>{t.totalMovements}</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: "var(--accent)", fontFamily: "var(--font-mono)", letterSpacing: -0.5, lineHeight: 1 }}>{movCounts.total}</div>
              <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>{t.activeDays(movCounts.diasActivos)}</div>
            </div>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <DonutChart size={92} strokeWidth={13}
                selected={selectedMovTipo} onSelect={setSelectedMovTipo}
                data={movCounts.porTipo.map(([tipo, count]) => ({ key: tipo, value: count, color: tipoColor[tipo] ?? "var(--accent)", label: t.tipoDisplay[tipo] ?? tipo }))} />
            </div>
            {/* Leyenda tocable: una fila por tipo, selecciona/resalta el slice */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {movCounts.porTipo.map(([tipo, count]) => {
                const active = selectedMovTipo === tipo;
                const col = tipoColor[tipo] ?? "var(--accent)";
                return (
                  <button key={tipo} type="button" aria-pressed={active} aria-label={`${t.tipoDisplay[tipo] ?? tipo}: ${count}`} onClick={() => setSelectedMovTipo(active ? null : tipo)}
                    style={{ display: "flex", alignItems: "center", gap: 5, padding: "3px 8px", borderRadius: 999, cursor: "pointer", transition: "all 0.15s",
                      border: `1px solid ${active ? col : "transparent"}`, background: active ? `${col}1a` : "transparent" }}>
                    <span style={{ width: 7, height: 7, borderRadius: 2, background: col, flexShrink: 0 }} />
                    <span style={{ fontSize: 10, color: active ? "var(--text)" : "var(--muted)", whiteSpace: "nowrap" }}>{t.tipoDisplay[tipo] ?? tipo}</span>
                    <b style={{ fontSize: 10, color: "var(--text)", fontFamily: "var(--font-mono)", marginLeft: "auto" }}>{count}</b>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Mini-stats: 2x2 grid */}
          {(() => {
            const hoy = new Date();
            const esMismaFecha = (fecha: string) => { const d = new Date(fecha.includes("-") ? fecha + "T12:00:00" : fecha.split("/").length === 3 ? (() => { const [dd,mm,yy] = fecha.split("/"); return `${yy}-${mm.padStart(2,"0")}-${dd.padStart(2,"0")}T12:00:00`; })() : fecha); return d.getFullYear() === hoy.getFullYear() && d.getMonth() === hoy.getMonth() && d.getDate() === hoy.getDate(); };
            const esActivo = finPeriodo === null;
            const gastoHoy = esActivo
              ? periodo.movimientos.filter(m => m.tipo === "Gasto" && esMismaFecha(m.fecha)).reduce((s, m) => s + m.monto, 0)
              : null;
            const diaCaro = kpis?.diaMayorGasto;
            return (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                <MiniStat center basis="1 1 45%" label={t.today} value={gastoHoy !== null ? (oculto ? "••" : abbr(gastoHoy)) : "—"} gradient="linear-gradient(90deg, var(--teal), var(--purple))"
                  onClick={gastoHoy !== null ? () => setKpiInfo({ title: t.todaySpent, value: oculto ? "••" : formatARS(gastoHoy), explain: t.kpiTodaySpentInfo, color: "var(--teal)" }) : undefined} />
                {diaCaro && <MiniStat center basis="1 1 45%" label={t.highestSpendingDay} value={oculto ? "••" : abbr(diaCaro.monto)} color="var(--red)"
                  onClick={() => setKpiInfo({ title: t.highestSpendingDay, value: oculto ? "••" : formatARS(diaCaro.monto), explain: `${t.kpiHighestDayInfo} (${sinAño(diaCaro.fecha)})`, color: "var(--red)" })} />}
                {kpis && <MiniStat center basis="1 1 45%" label={t.avgDayWithExpense} value={oculto ? "••" : abbr(kpis.promedioDiario)} gradient="linear-gradient(90deg, var(--teal), var(--purple))"
                  onClick={() => setKpiInfo({ title: t.avgDayWithExpense, value: oculto ? "••" : formatARS(kpis!.promedioDiario), explain: `${t.kpiAvgDayInfo} (${t.daysWithExpenses(kpis!.diasConGasto)})`, color: "var(--teal)" })} />}
                {tendenciaMovs !== null && (() => { const c = colorZ(periodos[0].movimientos.length, periodos.slice(1).map((p) => p.movimientos.length)); const mag = deltaMag(tendenciaMovs); const v = `${mag > 0 ? "+" : ""}${mag}%`; return (
                  <MiniStat center basis="1 1 45%" label={t.trend} value={v} color={c}
                    onClick={() => setKpiInfo({ title: t.trend, value: v, explain: `Período actual: ${periodos[0]?.movimientos.length ?? 0} movimientos · Promedio histórico: ${Math.round(avgHistoricoMovs)}`, color: c })} />
                ); })()}
              </div>
            );
          })()}
        </>
      )}

      {reportOn("movimientos_otros") && (
        <>
          {/* Por categoría (frecuencia + total) */}
          {movCounts.porCat.length > 0 && (
            <div className="soft" style={{ marginBottom: 12, background: "linear-gradient(135deg, var(--surface), var(--surface-alt))", cursor: movCounts.porCat.length > 5 ? "pointer" : undefined }}
              onClick={movCounts.porCat.length > 5 ? () => setModalTop("movcat") : undefined}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>{t.byCategory}</div>
              {movCounts.porCat.slice(0, 5).map(({ cat, count, total, color }) => (
                <div key={cat} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                    <div style={{ fontSize: 12 }}>{cat}</div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                      <span style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>{oculto ? "••" : abbr(total)}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, fontFamily: "var(--font-mono)", color }}>{count}</span>
                    </div>
                  </div>
                  <div style={{ height: 4, background: "var(--faint)", borderRadius: 2 }}>
                    <div style={{ height: "100%", width: `${Math.round((count / movCounts.total) * 100)}%`, background: color, borderRadius: 2, transition: "width .5s ease" }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Por medio de pago */}
          {movCounts.porMedio.length > 0 && (
            <div className="soft" style={{ marginBottom: 12, background: "linear-gradient(135deg, var(--surface), var(--surface-alt))" }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>{t.byPaymentMethod}</div>
              {movCounts.porMedio.map(({ medio, count, tipos }) => (
                <div key={medio} style={{ marginBottom: 12, cursor: "pointer" }} onClick={() => setMedioModal(medio)}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                    <span style={{ fontSize: 12 }}>{medio}</span>
                    <div style={{ display: "flex", gap: 6 }}>
                      {tipos.map(({ tipo, n }) => (
                        <span key={tipo} style={{ fontSize: 11, fontWeight: 700, fontFamily: "var(--font-mono)", color: TIPO_COLOR[tipo] ?? "var(--accent)" }}>{n}</span>
                      ))}
                    </div>
                  </div>
                  <div style={{ height: 5, background: "var(--faint)", borderRadius: 999, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${Math.round((count / movCounts.total) * 100)}%`, display: "flex", borderRadius: 999, overflow: "hidden", transition: "width .5s ease" }}>
                      {tipos.map(({ tipo, n }) => (
                        <div key={tipo} style={{ flex: n, background: TIPO_COLOR[tipo] ?? "var(--accent)" }} />
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
