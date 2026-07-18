"use client";

import { useT } from "@/hooks/useTranslation";
import { useMoney } from "@/hooks/useHideValues";
import { EyeIcon } from "@/components/ui/EyeIcon";
import { MiniStat } from "@/components/ui/MiniStat";
import { Bar } from "@/components/reports/charts";
import { abbr, sinAño, shortPer, deltaMag, deltaColor } from "@/components/reports/format";
import { formatARS } from "@/utils/periodo";
import type { PeriodoResumen } from "@/utils/periodo";
import type { Movimiento } from "@/types";

type KpiInfo = { title: string; value: string; explain: string; color?: string };

interface Props {
  periodo: PeriodoResumen;
  anterior?: PeriodoResumen;
  totalIngresos: number;
  deltaIngresos: number | null;
  evolSueldoActivo: { sueldo: number; deltaPct: number | null; esVacaciones: boolean } | null;
  suelHistorial: { de: number; a: number; pct: number; cuando: string }[];
  totalAhorradoDirecto: number;
  ahorrosAcumPeriodo: number;
  deltaAhorros: number | null;
  deltaAhorrosPct: number | null;
  ingXDesc: { cat: string; monto: number; pct: number }[];
  movIngresos: Movimiento[];
  movIngresosAhorros: Movimiento[];
  movResto: Movimiento[];
  setKpiInfo: (v: KpiInfo) => void;
  setModalSueldo: (v: boolean) => void;
  setModalAhorros: (v: boolean) => void;
}

// Subtab "Ingresos" de Reportes: hero del total disponible, mini-stats (sueldo, moves,
// total ingresado, ahorros acumulados), ingresos por descripción y detalle de movimientos.
export function IngresosTab({
  periodo, anterior, totalIngresos, deltaIngresos, evolSueldoActivo, suelHistorial,
  totalAhorradoDirecto, ahorrosAcumPeriodo, deltaAhorros, deltaAhorrosPct, ingXDesc,
  movIngresos, movIngresosAhorros, movResto, setKpiInfo, setModalSueldo, setModalAhorros,
}: Props) {
  const t = useT();
  const { oculto, toggle, m: money } = useMoney();
  const reportOn = (_id: string) => true;

  return (
    <>
      {/* Hero + KPIs */}
      {reportOn("ingresos_kpis") && (
      <>
      <div className="soft" style={{ marginBottom: 12, background: "linear-gradient(160deg, var(--surface) 50%, #00e67610 100%)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>{t.availableIncome}</div>
          <button onClick={toggle} aria-label={t.hideValues} style={{
            background: "transparent", border: "none", color: oculto ? "var(--accent)" : "var(--muted)",
            width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0,
          }}>
            <EyeIcon off={oculto} />
          </button>
        </div>
        <div style={{ fontSize: 34, fontWeight: 700, color: "#00e676cc", letterSpacing: -1, lineHeight: 1, fontFamily: "var(--font-mono)" }}>
          {money(totalIngresos)}
        </div>
        {/* Subtítulo: la comparativa contra el período anterior + lo que queda hoy sin gastar
            (el mismo número que el hero de Inicio, para no tener que cambiar de pantalla). */}
        <div style={{ marginTop: 8, fontSize: 12, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {deltaIngresos !== null && (() => { const mag = deltaMag(deltaIngresos); return (
            <span style={{ color: deltaColor(deltaIngresos, true), fontWeight: 600 }}>
              {mag === 0 ? "0" : <>{mag > 0 ? "↑" : "↓"}{Math.abs(mag)}</>}% vs {shortPer(anterior!.periodoId)}
            </span>
          ); })()}
          <span style={{ color: "var(--muted)" }}>
            {deltaIngresos !== null && "· "}{t.currentlyAvailable} <span style={{ fontFamily: "var(--font-mono)" }}>{money(periodo.disponible)}</span>
          </span>
        </div>
      </div>

      {/* Mini-stats: Sueldo · Retiros */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
        {evolSueldoActivo ? (
          <MiniStat center basis="1 1 45%" label={t.salary}
            value={oculto ? "••" : abbr(evolSueldoActivo.sueldo)}
            sub={evolSueldoActivo.esVacaciones ? t.leave : undefined}
            color={evolSueldoActivo.esVacaciones ? "var(--yellow)" : "var(--green)"}
            onClick={suelHistorial.length > 0 ? () => setModalSueldo(true) : undefined} />
        ) : (
          <MiniStat center basis="1 1 45%" label={t.salary} value={oculto ? "••" : abbr(periodo.sueldo)} color="var(--green)" />
        )}
        {(periodo.moveDisponible > 0 || periodo.moveAhorros > 0) && (
          <div style={{ background: "var(--surface-alt)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "11px 12px", minWidth: 0, flex: "1 1 45%", textAlign: "center" }}>
            <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 5, textTransform: "capitalize" }}>{t.moves}</div>
            <div style={{ display: "flex", justifyContent: "center", gap: 16 }}>
              {periodo.moveDisponible > 0 && (
                <div onClick={() => setKpiInfo({ title: t.withdrawals, value: oculto ? "••" : formatARS(periodo.moveDisponible), explain: t.kpiWithdrawalsInfo, color: "var(--teal)" })}
                  style={{ fontSize: 15, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--teal)", cursor: "pointer", whiteSpace: "nowrap" }}>
                  {oculto ? "••" : abbr(periodo.moveDisponible)}
                </div>
              )}
              {periodo.moveAhorros > 0 && (
                <div onClick={() => setKpiInfo({ title: t.moveToSavingsTitle, value: oculto ? "••" : formatARS(periodo.moveAhorros), explain: t.kpiMoveToSavingsInfo, color: "var(--purple)" })}
                  style={{ fontSize: 15, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--purple)", cursor: "pointer", whiteSpace: "nowrap" }}>
                  {oculto ? "••" : abbr(periodo.moveAhorros)}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Mini-stats: Total ingresado · Ahorros acum. */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        {reportOn("ingresos_kpis") && totalAhorradoDirecto > 0 && (
          <MiniStat center basis="1 1 45%" label={t.totalIncome} value={oculto ? "••" : abbr(periodo.sueldo + totalAhorradoDirecto)} color="var(--green)"
            onClick={() => setKpiInfo({ title: t.totalIncome, value: oculto ? "••" : formatARS(periodo.sueldo + totalAhorradoDirecto), explain: `${t.kpiTotalIncomeInfo} (${t.toSavingsLabel}: ${oculto ? "••" : formatARS(totalAhorradoDirecto)})`, color: "var(--green)" })} />
        )}
        <MiniStat center basis="1 1 45%" label={t.accumSavings}
          value={ahorrosAcumPeriodo > 0 ? (oculto ? "••" : abbr(ahorrosAcumPeriodo)) : "—"}
          color="var(--blue)"
          onClick={ahorrosAcumPeriodo > 0 ? () => setKpiInfo({ title: t.accumSavings, value: oculto ? "••" : formatARS(ahorrosAcumPeriodo), explain: deltaAhorros !== null ? `${t.kpiAccumSavingsInfo} (${deltaAhorros >= 0 ? "+" : ""}${oculto ? "••" : formatARS(deltaAhorros)}${deltaAhorrosPct !== null ? ` · ${deltaAhorrosPct >= 0 ? "+" : ""}${deltaAhorrosPct}%` : ""})` : t.kpiAccumSavingsInfo, color: "var(--blue)" }) : undefined} />
      </div>

      </>
      )}

      {/* Por descripción */}
      {reportOn("ingresos_otros") && ingXDesc.length > 0 && (
        <div className="soft" style={{ marginBottom: 12, background: "linear-gradient(135deg, var(--surface), var(--surface-alt))" }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>{t.byDescription}</div>
          {ingXDesc.map((c) => (
            <Bar key={c.cat} nombre={c.cat} monto={c.monto} pct={c.pct} color={c.cat === "Sueldo" ? "var(--green)" : "var(--blue)"} oculto={oculto} />
          ))}
        </div>
      )}


      {/* Detalle de movimientos */}
      {reportOn("ingresos_otros") && (movIngresos.length > 0 || movIngresosAhorros.length > 0 || movResto.length > 0) && (
        <div className="soft" style={{ marginBottom: 12, background: "linear-gradient(135deg, var(--surface), var(--surface-alt))" }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>{t.detail}</div>
          {movIngresos.map((m) => (
            <div key={m.id} className="row" style={{ padding: "9px 0" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.descripcion || m.categoria}</div>
                <div style={{ fontSize: 10, color: "var(--muted)" }}>{m.categoria} · {sinAño(m.fecha)}</div>
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--green)", fontFamily: "var(--font-mono)", whiteSpace: "nowrap" }}>
                +{money(m.monto)}
              </span>
            </div>
          ))}
          {(movIngresosAhorros.length > 0 || movResto.length > 0) && (
            <>
              <div style={{ fontSize: 10, color: "var(--muted)", letterSpacing: 2, textTransform: "uppercase", padding: "10px 0 4px", borderTop: movIngresos.length > 0 ? "1px solid var(--faint)" : "none", marginTop: movIngresos.length > 0 ? 4 : 0 }}>
                {t.directToSavings}
              </div>
              {movResto.map((m) => (
                <div key={m.id} className="row" style={{ padding: "9px 0" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.prevPeriodRemaining}</div>
                    <div style={{ fontSize: 10, color: "var(--muted)" }}>{sinAño(m.fecha)}</div>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--blue)", fontFamily: "var(--font-mono)", whiteSpace: "nowrap" }}>
                    +{money(m.monto)}
                  </span>
                </div>
              ))}
              {movIngresosAhorros.slice(0, 5).map((m) => (
                <div key={m.id} className="row" style={{ padding: "9px 0" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.descripcion || m.origenAhorro || m.categoria}</div>
                    <div style={{ fontSize: 10, color: "var(--muted)" }}>{sinAño(m.fecha)}</div>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--blue)", fontFamily: "var(--font-mono)", whiteSpace: "nowrap" }}>
                    +{money(m.monto)}
                  </span>
                </div>
              ))}
              {movIngresosAhorros.length > 5 && (
                <button onClick={() => setModalAhorros(true)} style={{ display: "block", width: "100%", textAlign: "center", margin: "8px auto 0", background: "none", border: "none", color: "var(--muted)", fontSize: 12, fontStyle: "italic", cursor: "pointer" }}>
                  {t.seeMore}
                </button>
              )}
            </>
          )}
        </div>
      )}

      {movIngresos.length === 0 && movIngresosAhorros.length === 0 && movResto.length === 0 && (
        <div className="soft" style={{ textAlign: "center", padding: 32, color: "var(--muted)", fontSize: 13 }}>
          {t.noIncomeThisPeriod}
        </div>
      )}
    </>
  );
}
