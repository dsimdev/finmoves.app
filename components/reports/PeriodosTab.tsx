"use client";

import type { Dispatch, SetStateAction } from "react";
import { useT } from "@/hooks/useTranslation";
import { useMoney } from "@/hooks/useHideValues";
import { MiniStat } from "@/components/ui/MiniStat";
import { EyeIcon } from "@/components/ui/EyeIcon";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { TwoLineChart, DotChart, AreaChart, VBars, type DotDatum } from "@/components/reports/charts";
import { abbr, shortPer, colorPct, deltaMag, deltaColor } from "@/components/reports/format";
import { APP_GRAD_DIM, appGradText } from "@/components/ui/gradients";
import { formatARS } from "@/utils/periodo";
import { parsePeriodoId, type PuntoTendencia } from "@/utils/reportes";
import type { PeriodoResumen } from "@/utils/periodo";

type KpiInfo = { title: string; value: string; explain: string; color?: string };
type PeriodMetric = "gasto" | "ingreso" | "dias" | "gastoSueldo" | "inflacion" | "sueldoReal";
type NavTarget = "gastos" | "ingresos" | "movimientos" | "periodos";

interface Props {
  periodos: PeriodoResumen[];
  serie: PuntoTendencia[];
  serieDesc: PuntoTendencia[];
  activos: string[];
  maxTotal: number;
  evolucionIngresos: PeriodoResumen[];
  mejorPeriodo: PuntoTendencia | null;
  peorPeriodo: PuntoTendencia | null;
  inflacionPersonal: number | null;
  medianaGastoPeriodo: number;
  proyeccionGasto: number | null;
  medianaAhorroPeriodo: number;
  proyeccionAhorro: number | null;
  sueldoVsInflacion: { gap: number; suba: number; pais: number } | null;
  monedaPrincipal?: "ARS" | "USD" | "EUR";
  periodMetric: PeriodMetric;
  setPeriodMetric: Dispatch<SetStateAction<PeriodMetric>>;
  sueldoRealMode: "USD" | "IPC";
  setSueldoRealMode: Dispatch<SetStateAction<"USD" | "IPC">>;
  metricPickerOpen: boolean;
  setMetricPickerOpen: (v: boolean) => void;
  ipcVar: (prevId: string, currId: string) => number | null;
  dolarAt: (periodoId: string) => number | null;
  deflatar: (monto: number, periodoId: string) => number;
  setNavPeriodo: (v: { periodoId: string; target: NavTarget } | null) => void;
  setKpiInfo: (v: KpiInfo) => void;
}

// Subtab "Períodos" de Reportes: inflación personal, mediana/proyección de gasto y
// ahorro, sueldo vs inflación, y el gráfico histórico con selector de métrica.
export function PeriodosTab({
  periodos, serie, serieDesc, activos, maxTotal, evolucionIngresos, mejorPeriodo, peorPeriodo,
  inflacionPersonal, medianaGastoPeriodo, proyeccionGasto, medianaAhorroPeriodo, proyeccionAhorro,
  sueldoVsInflacion, monedaPrincipal, periodMetric, setPeriodMetric, sueldoRealMode, setSueldoRealMode,
  metricPickerOpen, setMetricPickerOpen, ipcVar, dolarAt, deflatar, setNavPeriodo, setKpiInfo,
}: Props) {
  const t = useT();
  const { oculto, toggle, m: money } = useMoney();
  const reportOn = (_id: string) => true;
  const gradText = appGradText;

  return (
            <>
              {/* Hero: inflación personal (variación promedio del gasto entre períodos) */}
              {reportOn("periodos_kpis") && (
              <div className="soft" onClick={inflacionPersonal != null ? () => setKpiInfo({ title: t.inflationTitle, value: `${deltaMag(inflacionPersonal) > 0 ? "+" : ""}${deltaMag(inflacionPersonal)}%`, explain: t.kpiInflationAvgInfo, color: deltaColor(inflacionPersonal, false) }) : undefined}
                style={{ marginBottom: 12, background: "linear-gradient(135deg, var(--red-dim), var(--surface), var(--green-dim))", cursor: inflacionPersonal != null ? "pointer" : "default" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>{t.inflationTitle}</div>
                  <button onClick={(e) => { e.stopPropagation(); toggle(); }} aria-label={t.hideValues} style={{ background: "transparent", border: "none", color: oculto ? "var(--accent)" : "var(--muted)", width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}><EyeIcon off={oculto} /></button>
                </div>
                <div style={{ fontSize: 32, fontWeight: 700, color: inflacionPersonal == null ? "var(--muted)" : deltaColor(inflacionPersonal, false), fontFamily: "var(--font-mono)", letterSpacing: -0.5, lineHeight: 1 }}>
                  {inflacionPersonal == null ? "—" : `${deltaMag(inflacionPersonal) > 0 ? "+" : ""}${deltaMag(inflacionPersonal)}%`}
                </div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 6 }}>{t.inflationSub} · {t.periodsCount(periodos.length)}</div>
              </div>
              )}

              {/* Gasto: típico (mediana) y proyección del próximo período */}
              {reportOn("periodos_kpis") && (
                <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                  <MiniStat center basis="1 1 0" label={t.avgSpent} value={oculto ? "••" : abbr(medianaGastoPeriodo)} color="var(--red)"
                    onClick={() => setKpiInfo({ title: t.avgSpent, value: oculto ? "••" : money(medianaGastoPeriodo), explain: t.kpiTypicalInfo, color: "var(--red)" })} />
                  {proyeccionGasto != null && (
                    <MiniStat center basis="1 1 0" label={t.nextPeriodProjection} value={oculto ? "••" : abbr(proyeccionGasto)} color="var(--red)"
                      onClick={() => setKpiInfo({ title: t.nextPeriodProjection, value: oculto ? "••" : formatARS(proyeccionGasto), explain: t.kpiNextProjInfo, color: "var(--red)" })} />
                  )}
                </div>
              )}

              {/* Ahorro: típico (mediana) y proyección del próximo período */}
              {reportOn("periodos_kpis") && (
                <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                  <MiniStat center basis="1 1 0" label={t.avgSavings} value={oculto ? "••" : abbr(medianaAhorroPeriodo)} color="var(--blue)"
                    onClick={() => setKpiInfo({ title: t.avgSavings, value: oculto ? "••" : money(medianaAhorroPeriodo), explain: t.kpiTypicalSavingsInfo, color: "var(--blue)" })} />
                  {proyeccionAhorro != null && (
                    <MiniStat center basis="1 1 0" label={t.projSavings} value={oculto ? "••" : abbr(proyeccionAhorro)} color="var(--blue)"
                      onClick={() => setKpiInfo({ title: t.projSavings, value: oculto ? "••" : money(proyeccionAhorro), explain: t.kpiProjInfo, color: "var(--blue)" })} />
                  )}
                </div>
              )}

              {/* ¿Tu sueldo le gana a la inflación? Veredicto + brecha. */}
              {reportOn("periodos_kpis") && sueldoVsInflacion != null && (() => {
                const { gap, suba, pais } = sueldoVsInflacion;
                const c = deltaColor(gap, true);
                const verdict = gap > 0 ? t.salaryBeatsInflation : gap < 0 ? t.salaryLosesInflation : t.salaryTiesInflation;
                return (
                  <div className="soft" onClick={() => setKpiInfo({ title: t.salaryVsInflation, value: `${deltaMag(gap) > 0 ? "+" : ""}${deltaMag(gap)} pts`, explain: t.kpiSalaryVsInflationInfo(suba, pais), color: c })}
                    style={{ marginBottom: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, background: "linear-gradient(135deg, var(--surface), var(--surface-alt))" }}>
                    <div style={{ fontSize: 12, color: c, minWidth: 0 }}>{verdict}</div>
                    <div style={{ fontSize: 26, fontWeight: 700, fontFamily: "var(--font-mono)", letterSpacing: -0.5, lineHeight: 1, color: c, flexShrink: 0 }}>{deltaMag(gap) > 0 ? "+" : ""}{deltaMag(gap)} pts</div>
                  </div>
                );
              })()}

              {/* Por período — un solo gráfico con selector de métrica */}
              {reportOn("periodos_otros") && serieDesc.length > 0 && (() => {
                const metrics = [
                  { id: "gasto", label: t.mGastosTotales },
                  { id: "gastoSueldo", label: t.mGastoSobreSueldo },
                  { id: "dias", label: t.mDuracionDias },
                  ...(monedaPrincipal === "ARS" ? [{ id: "inflacion", label: t.mInflacionPersonal }] : []),
                  { id: "ingreso", label: t.mIngresosTotales },
                  ...(monedaPrincipal === "ARS" ? [{ id: "sueldoReal", label: t.mEvolucionSueldo }] : []),
                ] as const;
                type BarDatum = { label: string; value: number; color: string; hi?: boolean; best?: boolean; worst?: boolean; valueLabel?: string; periodoId?: string };
                let data: BarDatum[] = [];
                let max = 1; let refFrac: number | undefined; let mask = false;
                if (periodMetric === "gasto") {
                  // Barra neutra: la altura son pesos (magnitud). El semáforo % vive en
                  // "gasto sobre sueldo", donde altura y color hablan de lo mismo. El mejor/
                  // peor período sigue marcado por el color de la etiqueta (verde/rojo).
                  data = serieDesc.map((s) => ({ label: shortPer(s.periodoId), value: s.gastado, color: "var(--muted)", hi: activos.includes(s.periodoId), best: s.periodoId === mejorPeriodo?.periodoId, worst: s.periodoId === peorPeriodo?.periodoId, periodoId: s.periodoId }));
                  max = maxTotal; mask = true;
                } else if (periodMetric === "ingreso") {
                  data = evolucionIngresos.map((p) => ({ label: shortPer(p.periodoId), value: p.sueldo + p.moveDisponible, color: "var(--green)", hi: activos.includes(p.periodoId), periodoId: p.periodoId }));
                  max = Math.max(...evolucionIngresos.map((p) => p.sueldo + p.moveDisponible), 1); mask = true;
                } else if (periodMetric === "dias") {
                  const hoy = new Date();
                  data = serieDesc.map((s, i) => {
                    const inicio = parsePeriodoId(s.periodoId);
                    const fin = i === 0 ? hoy : parsePeriodoId(serieDesc[i - 1].periodoId);
                    const rawDias = (fin.getTime() - inicio.getTime()) / 86400000;
                    const dias = Math.max(1, i === 0 ? Math.floor(rawDias) + 1 : Math.round(rawDias));
                    const color = dias <= 29 ? "var(--green)" : dias <= 31 ? "var(--yellow)" : "var(--red)";
                    return { label: shortPer(s.periodoId), value: dias, color, valueLabel: `${dias}d`, hi: activos.includes(s.periodoId), periodoId: s.periodoId };
                  });
                  max = Math.max(...data.map((d) => d.value), 1);
                } else if (periodMetric === "gastoSueldo") {
                  // Gasto real (sin FX) sobre sueldo, como excedente sobre el 100%:
                  // +86% = gastaste 186% del sueldo; -14% = gastaste el 86%. La línea (0) es el 100%.
                  data = serieDesc.filter((s) => s.sueldo > 0).map((s) => {
                    const full = Math.round((s.gastadoPuro / s.sueldo) * 100);
                    return { label: shortPer(s.periodoId), value: full - 100, color: colorPct(full), hi: activos.includes(s.periodoId), periodoId: s.periodoId };
                  });
                }
                // Inflación ACUMULADA: tu gasto puro vs el período base (el más viejo con
                // gasto>0) y la del país (IPC compuesto) desde el mismo mes base. Se calcula
                // viejo→nuevo y se invierte para mostrar el más reciente a la izquierda,
                // como el resto de los gráficos.
                let inflPoints: { label: string; a: number; b: number | null; hi?: boolean; periodoId?: string }[] = [];
                let vosAcum: number | null = null, paisAcum: number | null = null;
                if (periodMetric === "inflacion") {
                  // Excluir el período en curso (incompleto): distorsiona la inflación acumulada.
                  const serieCompleta = serie.slice(0, -1);
                  const baseIdx = serieCompleta.findIndex((s) => s.gastadoPuro > 0);
                  if (baseIdx >= 0) {
                    const baseG = serieCompleta[baseIdx]!.gastadoPuro;
                    const baseId = serieCompleta[baseIdx]!.periodoId;
                    const ordered = serieCompleta.slice(baseIdx).map((s) => {
                      const vos = (s.gastadoPuro / baseG - 1) * 100;
                      const pais = ipcVar(baseId, s.periodoId);
                      return { label: shortPer(s.periodoId), a: Math.round(vos), b: pais != null ? Math.round(pais) : null, hi: activos.includes(s.periodoId), periodoId: s.periodoId };
                    });
                    if (ordered.length > 0) {
                      vosAcum = ordered[ordered.length - 1]!.a;
                      paisAcum = ordered[ordered.length - 1]!.b;
                    }
                    inflPoints = ordered.reverse();
                  }
                }
                const vosColor = vosAcum != null && paisAcum != null ? (vosAcum > paisAcum ? "var(--red)" : "var(--green)") : "var(--text)";
                // Sueldo real en el tiempo: en USD (oficial histórico) o ajustado por IPC (pesos de hoy).
                const sueldoPts: DotDatum[] = periodMetric !== "sueldoReal" ? [] : serieDesc.filter((s) => s.sueldo > 0).map((s) => {
                  const val = sueldoRealMode === "USD"
                    ? (() => { const d = dolarAt(s.periodoId); return d ? Math.round(s.sueldo / d) : 0; })()
                    : Math.round(deflatar(s.sueldo, s.periodoId));
                  return { label: shortPer(s.periodoId), value: val, color: "var(--accent)", hi: activos.includes(s.periodoId), periodoId: s.periodoId };
                }).filter((p) => p.value > 0);
                const sub = periodMetric === "gasto" ? t.subMetricSpent : periodMetric === "ingreso" ? t.subMetricIncome : periodMetric === "dias" ? t.subMetricDays : periodMetric === "inflacion" ? t.subMetricInflation : periodMetric === "sueldoReal" ? (sueldoRealMode === "USD" ? t.subMetricSalaryUSD : t.subMetricSalaryIPC) : t.subMetricRatio;
                const curMetric = metrics.find((m) => m.id === periodMetric) ?? metrics[0];
                return (
                  <>
                  <div className="soft" style={{ marginBottom: 12, background: "linear-gradient(135deg, var(--surface), var(--surface-alt))" }}>
                    <button type="button" onClick={() => setMetricPickerOpen(true)}
                      style={{ width: "100%", marginBottom: 14, textAlign: "center", padding: "11px 14px", borderRadius: 12, border: "1px solid transparent", background: APP_GRAD_DIM, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                      <span style={gradText}>{curMetric.label}</span>
                    </button>
                    {periodMetric === "inflacion"
                      ? (inflPoints.length > 1
                          ? <>
                              {vosAcum != null && (
                                <div style={{ textAlign: "center", marginBottom: 12, display: "flex", justifyContent: "center", gap: 16, flexWrap: "wrap" }}>
                                  <span>
                                    <span style={{ fontSize: 11, color: "var(--muted)" }}>{t.inflationAccYou} </span>
                                    <span style={{ fontSize: 18, fontWeight: 700, fontFamily: "var(--font-mono)", color: vosColor }}>{vosAcum >= 0 ? "+" : ""}{vosAcum}%</span>
                                  </span>
                                  {paisAcum != null && (
                                    <span>
                                      <span style={{ fontSize: 11, color: "var(--muted)" }}>{t.inflationAccCountry} </span>
                                      <span style={{ fontSize: 18, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--accent)" }}>+{paisAcum}%</span>
                                    </span>
                                  )}
                                </div>
                              )}
                              <TwoLineChart points={inflPoints} colorA={vosColor} onPointClick={(pid) => setNavPeriodo({ periodoId: pid, target: "gastos" })} />
                            </>
                          : <div style={{ fontSize: 12, color: "var(--muted)", textAlign: "center", padding: "16px 0" }}>{t.noRecords}</div>)
                      : periodMetric === "sueldoReal"
                      ? (sueldoPts.length > 0
                          ? <>
                              <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 12 }}>
                                {(["USD", "IPC"] as const).map((mo) => (
                                  <button key={mo} type="button" onClick={() => setSueldoRealMode(mo)} className="pill" style={{ fontSize: 11, padding: "3px 14px", borderColor: sueldoRealMode === mo ? "var(--accent)" : "var(--border)", background: sueldoRealMode === mo ? "var(--accent-dim)" : "transparent", color: sueldoRealMode === mo ? "var(--accent)" : "var(--muted)" }}>{mo === "USD" ? "USD" : "IPC"}</button>
                                ))}
                              </div>
                              <DotChart data={sueldoPts} format={sueldoRealMode === "USD" ? (v) => (oculto ? "U$D ••" : `U$D ${v.toLocaleString("es-AR")}`) : (v) => (oculto ? "••" : abbr(v))} onPointClick={(pid) => setNavPeriodo({ periodoId: pid, target: "ingresos" })} />
                            </>
                          : <div style={{ fontSize: 12, color: "var(--muted)", textAlign: "center", padding: "16px 0" }}>{t.noRecords}</div>)
                      : periodMetric === "gastoSueldo"
                      ? (data.length > 0
                          ? <DotChart data={data} refValue={0} signed onPointClick={(pid) => setNavPeriodo({ periodoId: pid, target: "gastos" })} />
                          : <div style={{ fontSize: 12, color: "var(--muted)", textAlign: "center", padding: "16px 0" }}>{t.noRecords}</div>)
                      : periodMetric === "dias"
                      ? (data.length > 0
                          ? <AreaChart data={data} onPointClick={(pid) => setNavPeriodo({ periodoId: pid, target: "gastos" })} />
                          : <div style={{ fontSize: 12, color: "var(--muted)", textAlign: "center", padding: "16px 0" }}>{t.noRecords}</div>)
                      : data.length > 0
                      ? <VBars data={data} max={max} oculto={mask ? oculto : undefined} refFrac={refFrac}
                          onBarClick={(pid) => setNavPeriodo({ periodoId: pid, target: periodMetric === "ingreso" ? "ingresos" : "gastos" })} />
                      : <div style={{ fontSize: 12, color: "var(--muted)", textAlign: "center", padding: "16px 0" }}>{t.noRecords}</div>}
                    <div style={{ fontSize: 10, color: "var(--muted)", textAlign: "center", marginTop: 10 }}>{sub}</div>
                  </div>

                  <BottomSheet open={metricPickerOpen} onClose={() => setMetricPickerOpen(false)} title={t.chartLabel}>
                    {metrics.map((mt) => {
                      const active = periodMetric === mt.id;
                      return (
                        <button key={mt.id} type="button" onClick={() => { setPeriodMetric(mt.id as typeof periodMetric); setMetricPickerOpen(false); }}
                          style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "14px 4px", borderBottom: "1px solid var(--faint)", background: "none", border: "none", cursor: "pointer", textAlign: "left", color: active ? "var(--accent)" : "var(--text)", fontSize: 15, fontWeight: active ? 700 : 500 }}>
                          <span style={{ flex: 1 }}>{mt.label}</span>
                          {active && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
                        </button>
                      );
                    })}
                  </BottomSheet>
                  </>
                );
              })()}

            </>
  );
}
