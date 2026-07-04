"use client";

import type { Dispatch, SetStateAction } from "react";
import { useT } from "@/hooks/useTranslation";
import { useMoney } from "@/hooks/useHideValues";
import { EyeIcon } from "@/components/ui/EyeIcon";
import { MiniStat } from "@/components/ui/MiniStat";
import { Bar } from "@/components/reports/charts";
import { abbr, sinAño, shortPer, colorPct, colorZ, deltaMag, deltaColor } from "@/components/reports/format";
import { formatARS } from "@/utils/periodo";
import type { PeriodoResumen } from "@/utils/periodo";
import type { ConfigUsuario } from "@/types";

type KpiInfo = { title: string; value: string; explain: string; color?: string };
type Cat = { categoria: string; monto: number; pct: number };
type Desc = { nombre: string; monto: number; pct: number };

interface Props {
  periodo: PeriodoResumen;
  periodos: PeriodoResumen[];
  activos: string[];
  anterior?: PeriodoResumen;
  esPeriodoVigente: boolean;
  ritmo: { enCurso: boolean; gastadoPorDia: number; proyeccionCierre: number } | null;
  tendenciaGasto: number | null;
  avgHistorico: number;
  promPorMov: number | null;
  comp: { categoria: string; actual: number; anterior: number; deltaPct: number | null }[];
  descs: Desc[];
  descsCompra: Set<string>;
  porFecha: Desc[];
  splitPorFecha: Map<string, { gasto: number; compra: number }>;
  catsConPresu: Cat[];
  catsEditables: string[];
  esCatCompra: (cat: string) => boolean;
  presupuesto: Record<string, number> | null;
  presupuestoEfectivo: Record<string, number> | null;
  showBudget: boolean;
  config: ConfigUsuario | null;
  setShowBudget: Dispatch<SetStateAction<boolean>>;
  setEditingBudget: Dispatch<SetStateAction<Record<string, string>>>;
  setModalBudget: (v: boolean) => void;
  setCatModal: (v: string | null) => void;
  setDiaModal: (v: string | null) => void;
  setModalTop: (v: "gastos" | "descs" | "movcat" | null) => void;
  setKpiInfo: (v: KpiInfo) => void;
}

// Subtab "Gastos" de Reportes: hero del gastado, mini-stats (tendencia, gasto real,
// ritmo, prom. por mov), categorías con presupuesto, comparativa vs anterior,
// top descripciones y gasto por día.
export function GastosTab({
  periodo, periodos, activos, anterior, esPeriodoVigente, ritmo, tendenciaGasto, avgHistorico,
  promPorMov, comp, descs, descsCompra, porFecha, splitPorFecha, catsConPresu, catsEditables,
  esCatCompra, presupuesto, presupuestoEfectivo, showBudget, config,
  setShowBudget, setEditingBudget, setModalBudget, setCatModal, setDiaModal, setModalTop, setKpiInfo,
}: Props) {
  const t = useT();
  const { oculto, toggle, m: money } = useMoney();
  const reportOn = (_id: string) => true;

  return (
    <>
      {/* Hero: Gastado */}
      {reportOn("gastos_kpis") && (() => {
        const pctColor = colorPct(periodo.pct);
        return (
          <div className="soft" style={{ marginBottom: 12, background: "linear-gradient(135deg, var(--surface), var(--red-dim))" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, minWidth: 0 }}>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>{t.spent}</span>
                <span style={{ fontSize: 10.5, color: "var(--muted)" }}>{t.ofTotal(periodo.pct)}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {ritmo?.enCurso && <span className="badge" style={{ background: "var(--green-dim)", color: "var(--green)", border: "1px solid var(--green)44" }}>{t.ongoing}</span>}
                <button onClick={toggle} aria-label={t.hideValues} style={{ background: "transparent", border: "none", color: oculto ? "var(--accent)" : "var(--muted)", width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}>
                  <EyeIcon off={oculto} />
                </button>
              </div>
            </div>
            <div style={{ fontSize: 30, fontWeight: 700, color: pctColor, fontFamily: "var(--font-mono)", letterSpacing: -0.5, lineHeight: 1 }}>{money(periodo.gastado)}</div>
            {periodo.gastado > periodo.gastadoPuro && (
              <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 6 }}>{t.spentBreakdown(money(periodo.gastadoPuro), money(periodo.gastado - periodo.gastadoPuro))}</div>
            )}
            <div className="bar-track" style={{ marginTop: 10 }}><div className="bar-fill" style={{ width: `${Math.min(periodo.pct, 100)}%`, background: pctColor }} /></div>
          </div>
        );
      })()}

      {/* Mini-stats fila 1 */}
      {reportOn("gastos_kpis") && (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
        {esPeriodoVigente && tendenciaGasto !== null && (() => { const c = colorZ(periodos[0].gastadoPuro, periodos.slice(1).map((p) => p.gastadoPuro)); const mag = deltaMag(tendenciaGasto); const v = `${mag > 0 ? "+" : ""}${mag}%`; return (
          <MiniStat center basis="1 1 45%" label={t.trend} value={v} color={c}
            onClick={() => setKpiInfo({ title: t.trend, value: v, explain: `${t.kpiTrendInfo} Promedio histórico: ${oculto ? "••" : formatARS(Math.round(avgHistorico))}`, color: c })} />
        ); })()}
        {periodo.gastado > periodo.gastadoPuro && <MiniStat center basis="1 1 45%" label={t.realSpent} value={oculto ? "••" : abbr(periodo.gastadoPuro)} color="var(--red)"
          onClick={() => setKpiInfo({ title: t.realSpent, value: oculto ? "••" : formatARS(periodo.gastadoPuro), explain: t.kpiRealSpentInfo, color: "var(--red)" })} />}
      </div>
      )}

      {/* Mini-stats fila 2 */}
      {reportOn("gastos_kpis") && (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 18 }}>
        {ritmo && <MiniStat center basis="1 1 45%" label={t.spendingPace} value={`${oculto ? "••" : abbr(ritmo.gastadoPorDia)}${t.perDay}`} color="var(--red)"
          onClick={() => setKpiInfo({ title: t.spendingPace, value: `${oculto ? "••" : formatARS(ritmo.gastadoPorDia)}${t.perDay}`, explain: `${t.kpiPaceInfo} (${t.projection30days(oculto ? "••" : formatARS(ritmo.proyeccionCierre))})`, color: "var(--red)" })} />}
        {promPorMov != null && <MiniStat center basis="1 1 45%" label={t.avgPerExpense} value={oculto ? "••" : abbr(promPorMov)} color="var(--red)"
          onClick={() => setKpiInfo({ title: t.avgPerExpense, value: oculto ? "••" : formatARS(promPorMov), explain: t.kpiAvgPerExpenseInfo, color: "var(--red)" })} />}
      </div>
      )}

      {/* Categorías */}
      {reportOn("gastos_otros") && (
      <div className="soft" style={{ marginBottom: 12, background: "linear-gradient(135deg, var(--surface), var(--surface-alt))" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{t.byCategory}</span>
          {activos.length === 1 && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {presupuestoEfectivo && Object.keys(presupuestoEfectivo).length > 0 && (
                <button onClick={() => setShowBudget(v => !v)} style={{ background: showBudget ? "var(--accent-dim)" : "transparent", border: `1px solid ${showBudget ? "var(--accent)" : "var(--border)"}`, borderRadius: 6, color: showBudget ? "var(--accent)" : "var(--muted)", fontSize: 10, fontWeight: 600, padding: "3px 8px", cursor: "pointer", transition: "all 0.15s" }}>
                  {t.budget}
                </button>
              )}
              <button onClick={() => {
                const template = config?.meta.presupuestoTemplate ?? {};
                const base = presupuesto ?? template;
                setEditingBudget(Object.fromEntries(catsEditables.map((cat) => [cat, String(base[cat] ?? "")])));
                setModalBudget(true);
              }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: 4, display: "flex", alignItems: "center" }} aria-label={t.editBudget}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>
            </div>
          )}
        </div>
        {catsConPresu.map((c) => <Bar key={c.categoria} nombre={c.categoria} monto={c.monto} pct={c.pct} color={esCatCompra(c.categoria) ? "var(--yellow)" : "var(--red)"} oculto={oculto} presupuesto={showBudget ? presupuestoEfectivo?.[c.categoria] : undefined} onClick={() => setCatModal(c.categoria)} />)}
      </div>
      )}

      {/* Comparativa vs anterior */}
      {anterior && reportOn("gastos_otros") && (
        <div className="soft" style={{ marginBottom: 12, background: "linear-gradient(135deg, var(--surface), var(--surface-alt))" }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{t.vsPrevPeriod}</div>
          <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 12 }}>{shortPer(anterior.periodoId)}</div>
          {comp.filter((c) => c.actual > 0 || c.anterior > 0).slice(0, 8).map((c) => (
            <div key={c.categoria} className="row" style={{ padding: "8px 0" }}>
              <span style={{ fontSize: 13 }}>{c.categoria}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {(() => { const diff = c.actual - c.anterior; return (
                  <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--muted)" }}>{diff >= 0 ? "+" : "−"}{money(Math.abs(diff))}</span>
                ); })()}
                {c.deltaPct !== null ? (() => { const mag = deltaMag(c.deltaPct); return (
                  <span style={{ fontSize: 11, fontWeight: 700, color: deltaColor(c.deltaPct, false), minWidth: 48, textAlign: "right" }}>
                    {mag === 0 ? "0" : <>{mag > 0 ? "↑" : "↓"}{Math.abs(mag)}</>}%
                  </span>
                ); })() : <span style={{ fontSize: 10, color: "var(--red)", minWidth: 48, textAlign: "right" }}>{t.new_}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Descripción (top) */}
      {reportOn("gastos_otros") && (
      <div className="soft" style={{ marginBottom: 12, cursor: "pointer", background: "linear-gradient(135deg, var(--surface), var(--surface-alt))" }} onClick={() => setModalTop("descs")}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>{t.top5Descriptions}</div>
        {descs.map((d) => <Bar key={d.nombre} nombre={d.nombre} monto={d.monto} pct={d.pct} color={descsCompra.has(d.nombre || "—") ? "var(--yellow)" : "var(--red)"} oculto={oculto} />)}
      </div>
      )}

      {/* Por fecha — barra apilada: rojo gasto, amarillo compra USD */}
      {reportOn("gastos_otros") && porFecha.length > 0 && (
        <div className="soft" style={{ marginBottom: 12, background: "linear-gradient(135deg, var(--surface), var(--surface-alt))" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{t.byDay}</span>
            {[...splitPorFecha.values()].some((v) => v.compra > 0) && (
              <div style={{ display: "flex", gap: 10, fontSize: 9, color: "var(--muted)" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: "var(--red)" }} />{t.spent}</span>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: "var(--yellow)" }} />USD</span>
              </div>
            )}
          </div>
          {(() => {
            const maxTotal = Math.max(...porFecha.map((f) => f.monto), 1);
            return (
              <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, alignItems: "flex-end", scrollbarWidth: "none" }}>
                {porFecha.map((f, i) => {
                  const sp = splitPorFecha.get(f.nombre) ?? { gasto: f.monto, compra: 0 };
                  const gH = Math.round((sp.gasto / maxTotal) * 96);
                  const cH = Math.round((sp.compra / maxTotal) * 96);
                  return (
                    <div key={i} onClick={() => setDiaModal(sinAño(f.nombre))} style={{ flexShrink: 0, width: 36, display: "flex", flexDirection: "column", alignItems: "center", gap: 5, cursor: "pointer" }}>
                      <div style={{ fontSize: 8, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>{oculto ? "•" : abbr(f.monto)}</div>
                      <div style={{ height: 96, width: 20, background: "var(--faint)", borderRadius: 7, display: "flex", flexDirection: "column", justifyContent: "flex-end", overflow: "hidden" }}>
                        {cH > 0 && <div style={{ width: "100%", height: cH, background: "var(--yellow)", transition: "height .5s ease" }} />}
                        {gH > 0 && <div style={{ width: "100%", height: gH, background: "var(--red)", transition: "height .5s ease" }} />}
                      </div>
                      <div style={{ fontSize: 8, color: "var(--muted)" }}>{sinAño(f.nombre)}</div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}
    </>
  );
}
