"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useData } from "./data-context";
import { useMoney } from "@/hooks/useHideValues";
import { agruparPorPeriodo, fechaCorta } from "@/utils/periodo";
import { serieTendencia, inflacionPersonal as calcInflacionPersonal } from "@/utils/reportes";
import { EyeIcon } from "@/components/ui/EyeIcon";
import { Movimiento } from "@/types";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { MiniStat } from "@/components/ui/MiniStat";
import { KpiInfoModal } from "@/components/ui/KpiInfoModal";
import { MovementModal } from "@/components/movements/MovementModal";
import { useLongPress } from "@/hooks/useLongPress";
import { useT } from "@/hooks/useTranslation";
import { useAppPrefs } from "@/hooks/useAppPrefs";
import { useInflacionIPC } from "@/hooks/useInflacionIPC";
import { PageHeader } from "@/components/ui/PageHeader";
import { NotificationsBell } from "@/components/notifications/NotificationsBell";
import { DiasPeriodo } from "@/components/ui/DiasPeriodo";
import { deltaColor, deltaMag, colorPct, colorPctDim } from "@/components/reports/format";

function TipoColor(m: Movimiento) {
  if (m.categoria === "RESTO") return "var(--blue)"; // arrastre a ahorros del período anterior
  if (m.tipo === "CompraUSD") return "var(--yellow)";
  if (m.tipo === "Gasto") return "var(--red)";
  if (m.tipo === "Move") return m.direccionMove === "aAhorro" ? "var(--purple)" : "var(--teal)";
  return "var(--green)";
}
function TipoPrefix(m: Movimiento) {
  if (m.categoria === "RESTO") return "+"; // arrastre que entra como ahorros
  // Move "a ahorros" sale del disponible → signo negativo.
  if (m.tipo === "Move" && m.direccionMove === "aAhorro") return "-";
  return m.tipo === "Gasto" || m.tipo === "CompraUSD" ? "-" : "+";
}

export default function Dashboard() {
  const { movimientos, loading, refresh, config, updateMovimiento, removeMovimiento, prependMovimiento } = useData();
  const { oculto, toggle: toggleOculto, m: money } = useMoney();
  const t = useT();
  const { dashboardClasico, showAhorros, monedaPrincipal } = useAppPrefs();
  const { deflatar } = useInflacionIPC();
  const esARS = monedaPrincipal === "ARS";

  // Modal de alta/edición abierto desde el propio inicio (sin navegar).
  const [modalState, setModalState] = useState<{ mode: "add" | "edit"; mov?: Movimiento; view?: "form" | "delete" } | null>(null);
  const [kpiInfo, setKpiInfo] = useState<{ title: string; value: string; explain: string; color?: string } | null>(null);
  const bindLongPress = useLongPress();

  const periodos = useMemo(() => agruparPorPeriodo(movimientos), [movimientos]);
  const ultimoCargado = useMemo(() => {
    if (movimientos.length === 0) return null;
    return movimientos.reduce((a, b) =>
      new Date(a.timestampCarga).getTime() > new Date(b.timestampCarga).getTime() ? a : b
    ).timestampCarga;
  }, [movimientos]);
  const p = periodos[0];
  const serie = useMemo(() => serieTendencia(periodos, config?.meta.ahorrosAcumSeedPeriodoId), [periodos, config?.meta.ahorrosAcumSeedPeriodoId]);
  const ahorrosAcum = serie.length ? serie[serie.length - 1].ahorrosAcum : 0;
  // Solo gasto puro (sin compras de divisa, que disparan promedio y desvío).
  const gastos = useMemo(() => p?.movimientos.filter((m) => m.tipo === "Gasto") ?? [], [p]);
  const promPorMov = gastos.length > 0 ? Math.round(gastos.reduce((s, m) => s + m.monto, 0) / gastos.length) : 0;
  const desvioCV = useMemo(() => {
    if (gastos.length < 2 || promPorMov === 0) return 0;
    const avg = gastos.reduce((s, m) => s + m.monto, 0) / gastos.length;
    const sd = Math.sqrt(gastos.reduce((s, m) => s + (m.monto - avg) ** 2, 0) / gastos.length);
    return Math.round((sd / avg) * 100);
  }, [gastos, promPorMov]);
  // Solo ARS deflacta por IPC (variación real); otras monedas, nominal. Misma
  // fórmula exacta que Reportes (helper compartido).
  const inflacionPersonal = useMemo(
    () => calcInflacionPersonal(periodos, esARS ? deflatar : undefined),
    [periodos, deflatar, esARS],
  );
  const ultimos = p?.movimientos.filter((m) => m.tipo !== "GastoUSD" && m.tipo !== "GastoEUR" && m.tipo !== "IngresoUSD" && m.tipo !== "IngresoEUR").slice(0, 5) ?? [];
  const pctDisp = p && p.total > 0 ? Math.round((p.disponible / p.total) * 100) : 0;
  // Color anclado al gasto sobre el ingreso (misma escala que Reportes): verde mientras
  // hay margen, rojo solo al pasarte. Así no se pone en alerta por mover plata a ahorros.
  const gastadoPct = p && p.total > 0 ? (p.gastado / p.total) * 100 : 0;
  const barColor = colorPct(gastadoPct);
  const barColorDim = colorPctDim(gastadoPct);

  return (
    <div className="page">

      {loading ? (
        <LoadingSpinner />
      ) : !p ? (
        <div className="soft" style={{ textAlign: "center", padding: 32, color: "var(--muted)", fontSize: 13 }}>
          {t.noData}
        </div>
      ) : (
        <div className="fade-up">
          {/* Header: período (izq) · INICIO (centro) · campana (der) */}
          <PageHeader
            title={t.pageTitleDashboard}
            subtitle={<div style={{ marginTop: 2 }}><DiasPeriodo periodoId={p.periodoId} /></div>}
            right={<NotificationsBell />}
          />

          {/* Hero */}
          <div className="soft" style={{ borderColor: `${barColor}44`, marginBottom: 12, background: `linear-gradient(135deg, var(--surface) 0%, ${barColorDim} 100%)` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 7 }}>{t.available}</div>
                <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: -1, color: "var(--text)", lineHeight: 1, fontFamily: "var(--font-mono)" }}>
                  {money(p.disponible)}
                </div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 7 }}>
                  {t.of} {money(p.total)} · {p.movimientos.length} {t.movementsShort}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10, flexShrink: 0 }}>
                <span className="badge" style={{ background: barColor + "20", color: barColor, border: `1px solid ${barColor}44` }}>{pctDisp}%</span>
                <button onClick={toggleOculto} aria-label={t.hideValues} style={{
                  background: "none", border: "none", color: oculto ? "var(--accent)" : "var(--muted)",
                  display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 6,
                }}>
                  <EyeIcon off={oculto} />
                </button>
              </div>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${Math.max(0, Math.min(pctDisp, 100))}%`, background: barColor }} />
            </div>
          </div>

          {/* KPIs */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            {dashboardClasico ? (<>
              <MiniStat basis="1 1 45%" label={t.salary} value={money(p.sueldo)} color="var(--green)" />
              <MiniStat basis="1 1 45%" label={t.spent} value={money(p.gastadoPuro)} color="var(--red)" />
              <MiniStat basis="1 1 45%" label={t.savings} value={money(ahorrosAcum)} color="var(--blue)" />
              <MiniStat basis="1 1 45%" label={t.withdrawals} value={p.extras > 0 ? money(p.extras) : "—"} color="var(--teal)" />
            </>) : (<>
              <MiniStat center basis="1 1 45%" label={t.spent} value={money(p.gastadoPuro)} color="var(--red)"
                onClick={() => setKpiInfo({ title: t.spent, value: money(p.gastadoPuro), explain: t.kpiSpentRealInfo, color: "var(--red)" })} />
              <MiniStat center basis="1 1 45%" label={t.accumSavings} value={ahorrosAcum > 0 ? money(ahorrosAcum) : "—"} color="var(--blue)"
                onClick={() => setKpiInfo({ title: t.accumSavings, value: money(ahorrosAcum), explain: t.kpiAccumSavingsInfo, color: "var(--blue)" })} />
              {(() => { const ip = inflacionPersonal; const c = ip == null ? "var(--muted)" : deltaColor(ip, false); const mag = ip == null ? null : deltaMag(ip); const v = mag == null ? "—" : `${mag > 0 ? "+" : ""}${mag}%`; return (
                <MiniStat center basis="1 1 45%" label="Inflación" value={v} color={c}
                  onClick={() => setKpiInfo({ title: "Inflación", value: v, explain: esARS ? t.kpiInflationInfo : t.kpiInflationInfoNominal, color: c })} />
              ); })()}
              {(() => { const c = desvioCV <= 100 ? "var(--green)" : desvioCV <= 200 ? "var(--yellow)" : "var(--red)"; const v = desvioCV > 0 ? `±${desvioCV}%` : "—"; return (
                <MiniStat center basis="1 1 45%" label={t.spendSpread} value={v} color={c}
                  onClick={() => setKpiInfo({ title: t.spendSpread, value: v, explain: t.kpiSpendSpreadInfo, color: c })} />
              ); })()}
            </>)}
          </div>

          {/* Atajos */}
          {(() => {
            const chip: React.CSSProperties = {
              flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
              background: "var(--surface-alt)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)",
              padding: "12px 8px", textDecoration: "none", color: "var(--muted)", cursor: "pointer",
            };
            const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 600, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" };
            const svg = (color: string, children: React.ReactNode) => (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">{children}</svg>
            );
            return (
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                {/* Nuevo movimiento → abre el modal acá mismo */}
                <button onClick={() => setModalState({ mode: "add" })} style={{ ...chip, border: "1px solid var(--border)" }}>
                  {svg("var(--green)", <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>)}
                  <span style={lbl}>{t.newShort}</span>
                </button>
                {showAhorros && <Link href="/investments" style={chip}>
                  {svg("var(--yellow)", <><circle cx="12" cy="12" r="9"/><path d="M12 7v10M14.5 9.5C14.5 8.4 13.4 8 12 8s-3 .8-3 2 1.2 1.7 3 2 3 .8 3 2-1.3 2-3 2"/></>)}
                  <span style={lbl}>{t.portfolio}</span>
                </Link>}
                <Link href="/reports" style={chip}>
                  {svg("var(--red)", <><path d="M3 3v18h18"/><path d="M7 14l3-4 3 2 4-6"/></>)}
                  <span style={lbl}>{t.pageTitleReports}</span>
                </Link>
              </div>
            );
          })()}

          {/* Latest movements */}
          <div className="soft" style={{ background: "linear-gradient(135deg, var(--surface), var(--surface-alt))" }}>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{t.latestMovements}</div>
              {ultimoCargado && (
                <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>
                  {t.last} {new Date(ultimoCargado).toLocaleString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Argentina/Buenos_Aires" })}
                </div>
              )}
            </div>
            {ultimos.length === 0 ? (
              <div style={{ fontSize: 12, color: "var(--muted)", textAlign: "center", padding: "16px 0" }}>{t.noMovements}</div>
            ) : ultimos.map((m) => (
              <button key={m.id}
                {...bindLongPress(() => setModalState({ mode: "edit", mov: m, view: "delete" }), () => setModalState({ mode: "edit", mov: m }))}
                className="row" style={{ width: "100%", padding: "11px 0", background: "none", border: "none", textAlign: "left", color: "inherit", cursor: "pointer", WebkitTouchCallout: "none", WebkitUserSelect: "none", userSelect: "none" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {m.descripcion || m.categoria}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>{m.categoria} · {fechaCorta(m.fecha)}</div>
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: TipoColor(m), marginLeft: 12, whiteSpace: "nowrap", fontFamily: "var(--font-mono)" }}>
                  {TipoPrefix(m)}{money(m.monto)}
                </span>
              </button>
            ))}
            {p.movimientos.length > 5 && (
              <Link href="/movements" style={{
                display: "block", textAlign: "center", margin: "14px auto 2px",
                color: "var(--muted)", fontSize: 12, fontStyle: "italic",
                textDecoration: "none",
              }}>
                {t.seeMore}
              </Link>
            )}
          </div>
        </div>
      )}

      {kpiInfo && <KpiInfoModal title={kpiInfo.title} value={kpiInfo.value} explain={kpiInfo.explain} color={kpiInfo.color} onClose={() => setKpiInfo(null)} />}
      <MovementModal
        open={modalState !== null}
        mode={modalState?.mode ?? "add"}
        movimiento={modalState?.mov ?? null}
        movimientos={movimientos}
        config={config}
        activePeriodoId={p?.periodoId}
        initialView={modalState?.view}
        onClose={() => setModalState(null)}
        onChanged={refresh}
        onCreated={prependMovimiento}
        onUpdated={updateMovimiento}
        onDeleted={removeMovimiento}
      />
    </div>
  );
}
