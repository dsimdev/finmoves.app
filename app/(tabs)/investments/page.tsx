"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/services/firebase/firebase";
import { useAuth } from "@/hooks/useAuth";
import { useData } from "../data-context";
import { MovementModal } from "@/components/movements/MovementModal";
import { useCotizacion } from "@/hooks/useCotizacion";
import { useT } from "@/hooks/useTranslation";
import { useFirstVisit } from "@/hooks/useFirstVisit";
import { SectionHint } from "@/components/ui/SectionHint";

function fechaCortaConAnio(fecha: string): string {
  if (!fecha) return "";
  if (fecha.includes("-")) {
    const [y, m, d] = fecha.split("-");
    return `${d}/${m}/${y.slice(-2)}`;
  }
  if (fecha.includes("/")) {
    const [d, m, y] = fecha.split("/");
    return `${d.padStart(2,"0")}/${m.padStart(2,"0")}/${(y??"").slice(-2)}`;
  }
  return fecha;
}
import { agruparPorPeriodo } from "@/utils/periodo";
import { serieTendencia } from "@/utils/reportes";
import { useMoney, MASK } from "@/hooks/useHideValues";
import { useAppPrefs } from "@/hooks/useAppPrefs";
import { EyeIcon } from "@/components/ui/EyeIcon";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { MiniStat } from "@/components/ui/MiniStat";
import { KpiInfoModal } from "@/components/ui/KpiInfoModal";
import { Movimiento } from "@/types";

function calcularReserva(movimientos: Movimiento[], moneda: "USD" | "EUR") {
  const tipoCompra = moneda === "USD" ? "CompraUSD" : "CompraEUR";
  const tipoGasto  = moneda === "USD" ? "GastoUSD"  : "GastoEUR";
  const tipoVenta  = moneda === "USD" ? "VentaUSD"  : "VentaEUR";
  // Costo promedio MÓVIL: procesar en orden cronológico (más viejo → más nuevo).
  // Al reducir la reserva (gasto/venta/retiro) baja la cantidad Y el costo acumulado
  // a precio promedio, así el promedio de lo que queda no se distorsiona.
  const orden = [...movimientos].sort((a, b) => a.timestampCarga.getTime() - b.timestampCarga.getTime());
  let total = 0;
  let costoTotalARS = 0;
  for (const m of orden) {
    if (m.tipo === tipoCompra && m.cantidadUSD) {
      total += m.cantidadUSD;
      costoTotalARS += m.monto;
    } else if ((m.tipo === tipoGasto || m.tipo === tipoVenta) && m.cantidadUSD) {
      // Gasto y Venta bajan la reserva (la Venta además sumó al disponible, ya contado).
      const avg = total > 0 ? costoTotalARS / total : 0;
      const baja = Math.min(m.cantidadUSD, Math.max(total, 0));
      total -= m.cantidadUSD;
      costoTotalARS -= baja * avg;
    }
  }
  return { total, costoTotalARS, costoPromedio: total > 0 ? costoTotalARS / total : 0 };
}

export default function DolaresPage() {
  const { movimientos, loading, config, refresh: refreshData, updateMovimiento, removeMovimiento, prependMovimiento } = useData();
  const { user } = useAuth();
  const { cotizacion, minutosDesdeActualizacion, refresh } = useCotizacion();

  // Modal: alta de reserva (+/-) desde el botón, o detalle/edición al tocar una fila del historial.
  const [modal, setModal] = useState<{ mode: "add" } | { mode: "edit"; mov: Movimiento } | null>(null);
  const [expandUSD, setExpandUSD] = useState(false);
  const [expandEUR, setExpandEUR] = useState(false);
  const [kpiInfo, setKpiInfo] = useState<{ title: string; value: string; explain: string; color?: string } | null>(null);
  // Botón flotante: se oculta al hacer scroll y reaparece al detenerse (igual que en Movimientos).
  const [btnVisible, setBtnVisible] = useState(true);
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const hideThenShow = () => {
      setBtnVisible(false);
      if (scrollTimer.current) clearTimeout(scrollTimer.current);
      scrollTimer.current = setTimeout(() => setBtnVisible(true), 700);
    };
    document.addEventListener("scroll", hideThenShow, { passive: true });
    document.addEventListener("touchmove", hideThenShow, { passive: true });
    return () => {
      document.removeEventListener("scroll", hideThenShow);
      document.removeEventListener("touchmove", hideThenShow);
      if (scrollTimer.current) clearTimeout(scrollTimer.current);
    };
  }, []);

  useEffect(() => { refresh(); }, []);
  const t = useT();
  const { oculto, toggle, m: money } = useMoney();
  const { monedaInversiones, monedaPrincipal } = useAppPrefs();

  const [showHint, dismissHint] = useFirstVisit("investments");

  const monedaInversionesEfectiva: "USD" | "EUR" =
    monedaPrincipal === "USD" ? "EUR" :
    monedaPrincipal === "EUR" ? "USD" :
    monedaInversiones;
  const esEUR = monedaInversionesEfectiva === "EUR";
  const simbolo = esEUR ? "€" : "U$D";

  // La cotización del usuario es SIEMPRE la oficial (el blue solo se elige en la carga).
  // Si hay cotización manual activa, reemplaza al oficial SOLO en la moneda de inversión activa.
  const manualOn = !!config?.meta.cotizacionManualActiva && (config?.meta.cotizacionManual ?? 0) > 0;
  const manualVal = config?.meta.cotizacionManual ?? 0;
  const cotizacionUSD = manualOn && !esEUR ? manualVal : (cotizacion ? cotizacion.oficial : null);
  const cotizacionEUR = manualOn && esEUR ? manualVal : (cotizacion ? cotizacion.oficial_euro ?? null : null);

  // ── USD ──
  const comprasUSD = movimientos
    .filter((m) => m.tipo === "CompraUSD" || m.tipo === "GastoUSD" || m.tipo === "VentaUSD")
    .sort((a, b) => b.timestampCarga.getTime() - a.timestampCarga.getTime());
  const historialUSD = comprasUSD; // compras (+) y retiros (−) de la reserva
  const { total: desdeMovimientosUSD, costoPromedio: costoPromedioUSD } = calcularReserva(comprasUSD, "USD");
  const totalUSD = (config?.meta.saldoUSD ?? 0) + desdeMovimientosUSD;
  const reservaUSDenARS = cotizacionUSD ? totalUSD * cotizacionUSD : null;
  const gananciaUSD = reservaUSDenARS && costoPromedioUSD > 0 ? reservaUSDenARS - desdeMovimientosUSD * costoPromedioUSD : null;
  const gananciaPctUSD = gananciaUSD && desdeMovimientosUSD * costoPromedioUSD > 0 ? (gananciaUSD / (desdeMovimientosUSD * costoPromedioUSD)) * 100 : null;

  // ── EUR ──
  const comprasEUR = movimientos
    .filter((m) => m.tipo === "CompraEUR" || m.tipo === "GastoEUR" || m.tipo === "VentaEUR")
    .sort((a, b) => b.timestampCarga.getTime() - a.timestampCarga.getTime());
  const historialEUR = comprasEUR; // compras (+) y retiros (−) de la reserva
  const { total: desdeMovimientosEUR, costoPromedio: costoPromedioEUR } = calcularReserva(comprasEUR, "EUR");
  const totalEUR = (config?.meta.saldoEUR ?? 0) + desdeMovimientosEUR;
  const reservaEURenARS = cotizacionEUR ? totalEUR * cotizacionEUR : null;
  const gananciaEUR = reservaEURenARS && costoPromedioEUR > 0 ? reservaEURenARS - desdeMovimientosEUR * costoPromedioEUR : null;
  const gananciaPctEUR = gananciaEUR && desdeMovimientosEUR * costoPromedioEUR > 0 ? (gananciaEUR / (desdeMovimientosEUR * costoPromedioEUR)) * 100 : null;

  // ── Visibilidad de secciones ──
  const showUSD = historialUSD.length > 0 || !esEUR;
  const showEUR = historialEUR.length > 0 || esEUR;
  const hasBoth = historialUSD.length > 0 && historialEUR.length > 0;

  // ── Meta — aplica a la moneda primaria configurada ──
  const totalDisplay = esEUR ? totalEUR : totalUSD;
  const metaUSD = config?.meta.metaPorPeriodo ?? config?.meta.usdMensual ?? 400;

  // ── Tendencias de inversión ──
  const periodos = useMemo(() => agruparPorPeriodo(movimientos), [movimientos]);

  const metaMonto = config?.meta.metaMonto ?? null;
  const inversionSeedId = config?.meta.inversionSeedPeriodoId;

  // ── Net worth ──
  const disponibleActual = periodos[0]?.disponible ?? 0;
  const ahorrosTotales = useMemo(() => {
    const serie = serieTendencia(periodos, config?.meta.ahorrosAcumSeedPeriodoId ?? undefined);
    return serie.length > 0 ? serie[serie.length - 1].ahorrosAcum : 0;
  }, [periodos, config?.meta.ahorrosAcumSeedPeriodoId]);
  const fxEnARS = (reservaUSDenARS ?? 0) + (reservaEURenARS ?? 0);
  const totalPatrimonio = disponibleActual + ahorrosTotales + fxEnARS;
  const totalEnUSD = cotizacionUSD && cotizacionUSD > 0 ? totalPatrimonio / cotizacionUSD : null;
  const showNetWorth = fxEnARS > 0;
  const fxLabel = historialUSD.length > 0 && historialEUR.length > 0 ? "divisas" : historialEUR.length > 0 ? "EUR" : "U$D";

  // Auto-anclar el seed la primera vez: el período actual es desde cuando se
  // empezó a corregir bien la carga FX. La ventana de promedio crece período a período.
  useEffect(() => {
    if (!user?.uid || !config || inversionSeedId || periodos.length === 0) return;
    updateDoc(doc(db, `users/${user.uid}/config/meta`), { "meta.inversionSeedPeriodoId": periodos[0].periodoId });
  }, [user?.uid, !!config, !!inversionSeedId, periodos.length]);

  // FX neto comprado por período (CompraFX - GastoFX - VentaFX por cantidadUSD).
  const tipoCompraFX = esEUR ? "CompraEUR" : "CompraUSD";
  const tipoGastoFX  = esEUR ? "GastoEUR"  : "GastoUSD";
  const tipoVentaFX  = esEUR ? "VentaEUR"  : "VentaUSD";
  const netFXDe = (movs: Movimiento[]) => movs.reduce((s, m) => {
    if (m.tipo === tipoCompraFX && m.cantidadUSD) return s + m.cantidadUSD;
    if ((m.tipo === tipoGastoFX || m.tipo === tipoVentaFX) && m.cantidadUSD) return s - m.cantidadUSD;
    return s;
  }, 0);

  // Promedio del ritmo FX sobre la ventana desde el seed (incluido) hasta el actual.
  // periodos[0] es el más nuevo; el seed queda más atrás → tomamos del 0 al seed.
  const promAhorroUSD = useMemo(() => {
    if (periodos.length === 0) return null;
    const seedIdx = inversionSeedId ? periodos.findIndex((p) => p.periodoId === inversionSeedId) : 0;
    const ventana = periodos.slice(0, (seedIdx >= 0 ? seedIdx : 0) + 1);
    if (ventana.length === 0) return null;
    const prom = ventana.reduce((s, p) => s + netFXDe(p.movimientos), 0) / ventana.length;
    return prom > 0 ? prom : null;
  }, [periodos, inversionSeedId, tipoCompraFX, tipoGastoFX, tipoVentaFX]);

  const ritmoFX = promAhorroUSD ?? 0;
  const periodosParaMeta = metaMonto && ritmoFX > 0
    ? Math.ceil(Math.max(0, metaMonto - totalDisplay) / ritmoFX) : null;
  const proyUSD = ritmoFX > 0 ? totalDisplay + ritmoFX * 3 : null;

  return (
    <>
    <div className="page">
      {loading ? (
        <LoadingSpinner />
      ) : (
        <div className="fade-up">
          <div style={{ marginBottom: 24 }}>
            <div className="label" style={{ marginBottom: 2 }}>{showUSD && showEUR ? `${t.currencyDollars} · ${t.currencyEuros}` : esEUR ? t.currencyEuros : t.currencyDollars}</div>
            <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.5, display: "inline-block", background: "linear-gradient(110deg, var(--blue) 10%, var(--green) 90%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>{t.portfolio}</div>
          </div>
          {showHint && <SectionHint title={t.hintInvTitle} body={t.hintInvBody} onDismiss={dismissHint} />}

          {/* ── NET WORTH ── */}
          {showNetWorth && (
            <div className="card" style={{ background: "linear-gradient(135deg, var(--surface) 0%, color-mix(in srgb, var(--green) 8%, var(--surface)) 100%)", border: "1px solid color-mix(in srgb, var(--green) 20%, var(--border))", marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div className="label" style={{ marginBottom: 0 }}>patrimonio</div>
                <button onClick={toggle} aria-label={t.hideValues} style={{ background: "transparent", border: "none", color: oculto ? "var(--accent)" : "var(--muted)", width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}>
                  <EyeIcon off={oculto} />
                </button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { label: "disponible", value: disponibleActual },
                  { label: "ahorros", value: ahorrosTotales },
                  { label: fxLabel, value: fxEnARS },
                ].map(({ label, value }) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>{label}</span>
                    <span style={{ fontSize: 13, fontFamily: "var(--font-mono)", color: "var(--text)" }}>{oculto ? "••••" : money(value)}</span>
                  </div>
                ))}
              </div>
              <div style={{ height: 1, background: "color-mix(in srgb, var(--green) 25%, var(--border))", margin: "12px 0" }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                <span style={{ fontSize: 11, color: "var(--muted)", paddingBottom: 4 }}>total</span>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "var(--font-mono)", letterSpacing: -1, lineHeight: 1, background: "linear-gradient(110deg, var(--green) 0%, var(--blue) 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                    {oculto ? "••••" : money(totalPatrimonio)}
                  </div>
                  {totalEnUSD !== null && (
                    <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
                      {oculto ? "≈ U$D ••••" : `≈ U$D ${totalEnUSD.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} · oficial`}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── SECCIÓN USD ── */}
          {showUSD && (<>
          <div className="card" style={{ background: "linear-gradient(135deg, var(--surface) 0%, var(--yellow-dim) 100%)", marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: "var(--muted)" }}>{t.usdReserve}</div>
              <button onClick={toggle} aria-label={t.hideValues} style={{
                background: "transparent", border: "none", color: oculto ? "var(--accent)" : "var(--muted)",
                width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0,
              }}>
                <EyeIcon off={oculto} />
              </button>
            </div>
            <div style={{ fontSize: 36, fontWeight: 700, color: "var(--yellow)", letterSpacing: -1, lineHeight: 1, fontFamily: "var(--font-mono)" }}>
              U$D {oculto ? "••••" : totalUSD.toFixed(2)}
            </div>
            {reservaUSDenARS && (
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 8 }}>
                ≈ {money(reservaUSDenARS)} · {manualOn && !esEUR ? t.rateManual : t.rateOfficial} ${cotizacionUSD?.toLocaleString("es-AR")}
              </div>
            )}
            {gananciaUSD !== null && (
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)", fontSize: 12 }}>
                <span style={{ color: "var(--muted)" }}>{t.avgPrice}: <span style={{ color: "var(--text)", fontFamily: "var(--font-mono)" }}>{oculto ? MASK : "$" + costoPromedioUSD.toLocaleString("es-AR", { maximumFractionDigits: 0 })}</span></span>
                <span style={{ color: "var(--muted)" }}>{t.profit}: <span style={{ color: gananciaUSD >= 0 ? "var(--green)" : "var(--red)", fontFamily: "var(--font-mono)", fontWeight: 700 }}>{oculto ? MASK : `${gananciaUSD >= 0 ? "+" : ""}${money(gananciaUSD)}`}{gananciaPctUSD !== null && !oculto ? ` (${gananciaUSD >= 0 ? "+" : ""}${gananciaPctUSD.toFixed(1)}%)` : ""}</span></span>
              </div>
            )}
          </div>

          </>)}

          {/* ── SECCIÓN EUR ── */}
          {showEUR && (<>
          <div className="card" style={{ background: "linear-gradient(135deg, var(--surface) 0%, var(--yellow-dim) 100%)", marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: "var(--muted)" }}>{t.eurReserve}</div>
              {!showUSD && (
                <button onClick={toggle} aria-label={t.hideValues} style={{
                  background: "transparent", border: "none", color: oculto ? "var(--accent)" : "var(--muted)",
                  width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0,
                }}>
                  <EyeIcon off={oculto} />
                </button>
              )}
            </div>
            <div style={{ fontSize: 36, fontWeight: 700, color: "var(--yellow)", letterSpacing: -1, lineHeight: 1, fontFamily: "var(--font-mono)" }}>
              € {oculto ? "••••" : totalEUR.toFixed(2)}
            </div>
            {reservaEURenARS && (
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 8 }}>
                ≈ {money(reservaEURenARS)} · {manualOn && esEUR ? t.rateManual : t.rateOfficial} ${cotizacionEUR?.toLocaleString("es-AR")}
              </div>
            )}
            {gananciaEUR !== null && (
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)", fontSize: 12 }}>
                <span style={{ color: "var(--muted)" }}>{t.avgPrice}: <span style={{ color: "var(--text)", fontFamily: "var(--font-mono)" }}>{oculto ? MASK : "$" + costoPromedioEUR.toLocaleString("es-AR", { maximumFractionDigits: 0 })}</span></span>
                <span style={{ color: "var(--muted)" }}>{t.profit}: <span style={{ color: gananciaEUR >= 0 ? "var(--green)" : "var(--red)", fontFamily: "var(--font-mono)", fontWeight: 700 }}>{oculto ? MASK : `${gananciaEUR >= 0 ? "+" : ""}${money(gananciaEUR)}`}{gananciaPctEUR !== null && !oculto ? ` (${gananciaEUR >= 0 ? "+" : ""}${gananciaPctEUR.toFixed(1)}%)` : ""}</span></span>
              </div>
            )}
          </div>


          </>)}

          {/* Meta — consolidada */}
          {config?.meta.metaMonto && (() => {
            const falta = Math.max(0, config.meta.metaMonto - totalDisplay);
            const pctMeta = Math.min((totalDisplay / config.meta.metaMonto) * 100, 100);
            const metaAlcanzada = falta <= 0;
            const barColor = pctMeta >= 80 ? "var(--green)" : pctMeta >= 40 ? "var(--yellow)" : "var(--red)";
            return (
              <div className="card" style={{ background: "linear-gradient(135deg, var(--surface), var(--surface-alt))", marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div className="label" style={{ marginBottom: 0 }}>{t.savingsGoal}</div>
                    {metaAlcanzada && <span className="badge" style={{ background: "var(--green-dim)", color: "var(--green)", border: "1px solid var(--green)44" }}>{t.reachedBadge}</span>}
                  </div>
                  {config.meta.metaFecha && <div style={{ fontSize: 9, color: "var(--muted)" }}>{fechaCortaConAnio(config.meta.metaFecha)}</div>}
                </div>

                {/* Objetivo + faltan */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 6 }}>{t.goal} {monedaInversiones}</div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: "var(--yellow)", fontFamily: "var(--font-mono)", lineHeight: 1 }}>
                      {simbolo} {config.meta.metaMonto.toLocaleString("es-AR")}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 6 }}>{t.remainingLabel}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: metaAlcanzada ? "var(--green)" : "var(--yellow)", fontFamily: "var(--font-mono)" }}>
                      {oculto ? "••" : (metaAlcanzada ? "0" : Math.round(falta).toLocaleString("es-AR"))}
                    </div>
                  </div>
                </div>

                {/* Barra */}
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div className="progress-track" style={{ flex: 1, margin: 0 }}>
                    <div className="progress-fill" style={{ width: `${pctMeta}%`, background: barColor }} />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: barColor, fontFamily: "var(--font-mono)", minWidth: 36, textAlign: "right" }}>{pctMeta.toFixed(1)}%</span>
                </div>

                {/* Mini-stats */}
                <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                  {(() => {
                    const avg = oculto ? "••" : (promAhorroUSD !== null ? Math.round(promAhorroUSD).toLocaleString("es-AR") : "—");
                    const goal = Math.round(metaUSD).toLocaleString("es-AR");
                    return (
                    <MiniStat basis="1 1 0" center color="var(--yellow)" label={t.statPerPeriod} value={avg}
                      onClick={() => setKpiInfo({ title: t.statPerPeriod, value: `${avg} / ${goal}`, explain: t.kpiPerPeriodInfo, color: "var(--yellow)" })} />
                  ); })()}
                  {proyUSD !== null && (
                    <MiniStat basis="1 1 0" center color="var(--yellow)" label={t.statProjection}
                      value={oculto ? "••••" : Math.round(proyUSD).toLocaleString("es-AR")}
                      onClick={() => setKpiInfo({ title: t.statProjection, value: oculto ? "••••" : `${simbolo} ${Math.round(proyUSD).toLocaleString("es-AR")}`, explain: t.kpiProjectionInfo, color: "var(--yellow)" })} />
                  )}
                  {periodosParaMeta !== null && (
                    <MiniStat basis="1 1 0" center color="var(--yellow)" label={t.statToGoal}
                      value={periodosParaMeta === 0 ? t.reached : `${periodosParaMeta} ${t.periodsShort}`}
                      onClick={() => setKpiInfo({ title: t.statToGoal, value: periodosParaMeta === 0 ? t.reached : `${periodosParaMeta} ${t.periodsShort}`, explain: t.kpiToGoalInfo, color: "var(--yellow)" })} />
                  )}
                </div>
              </div>
            );
          })()}

          {/* Historial USD */}
          {showUSD && historialUSD.length > 0 && (
            <div className="card" style={{ background: "linear-gradient(135deg, var(--surface), var(--surface-alt))", marginBottom: 10 }}>
              <div className="label">{t.usdHistory}</div>
              {(expandUSD ? historialUSD : historialUSD.slice(0, 5)).map((m) => {
                const esRetiro = m.tipo === "GastoUSD";
                const esVenta = m.tipo === "VentaUSD";
                const esSalida = esRetiro || esVenta;
                return (
                <div key={m.id} className="row" onClick={() => setModal({ mode: "edit", mov: m })} style={{ cursor: "pointer" }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 500 }}>{fechaCortaConAnio(m.fecha)}</div>
                    {esVenta
                      ? <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>{t.sell}{m.cotizacion ? ` · ${t.rate} $${m.cotizacion.toLocaleString("es-AR")}` : ""}</div>
                      : esRetiro
                      ? <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>{t.removeReserve}</div>
                      : m.cotizacion && <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>{t.rate} ${m.cotizacion.toLocaleString("es-AR")}</div>}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: esVenta ? "var(--red)" : esRetiro ? "var(--blue)" : "var(--yellow)", fontFamily: "var(--font-mono)" }}>
                      {esSalida ? "−" : "+"}{oculto ? "••" : m.cantidadUSD?.toFixed(2)}
                    </div>
                    {!esRetiro && <div style={{ fontSize: 10, color: esVenta ? "var(--green)" : "var(--muted)" }}>{esVenta ? "+" : ""}{money(m.monto)}</div>}
                  </div>
                </div>
              );})}
              {historialUSD.length > 5 && (
                <button onClick={() => setExpandUSD((v) => !v)} style={{ display: "block", width: "100%", textAlign: "center", margin: "12px auto 2px", background: "none", border: "none", color: "var(--muted)", fontSize: 12, fontStyle: "italic", cursor: "pointer" }}>
                  {expandUSD ? t.seeLess : t.seeMore}
                </button>
              )}
            </div>
          )}

          {/* Historial EUR */}
          {showEUR && historialEUR.length > 0 && (
            <div className="card" style={{ background: "linear-gradient(135deg, var(--surface), var(--surface-alt))" }}>
              <div className="label">{t.eurHistory}</div>
              {(expandEUR ? historialEUR : historialEUR.slice(0, 5)).map((m) => {
                const esRetiro = m.tipo === "GastoEUR";
                const esVenta = m.tipo === "VentaEUR";
                const esSalida = esRetiro || esVenta;
                return (
                <div key={m.id} className="row" onClick={() => setModal({ mode: "edit", mov: m })} style={{ cursor: "pointer" }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 500 }}>{fechaCortaConAnio(m.fecha)}</div>
                    {esVenta
                      ? <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>{t.sell}{m.cotizacion ? ` · ${t.rate} $${m.cotizacion.toLocaleString("es-AR")}` : ""}</div>
                      : esRetiro
                      ? <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>{t.removeReserve}</div>
                      : m.cotizacion && <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>{t.rate} ${m.cotizacion.toLocaleString("es-AR")}</div>}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: esVenta ? "var(--red)" : esRetiro ? "var(--blue)" : "var(--yellow)", fontFamily: "var(--font-mono)" }}>
                      {esSalida ? "−" : "+"}{oculto ? "••" : m.cantidadUSD?.toFixed(2)}
                    </div>
                    {!esRetiro && <div style={{ fontSize: 10, color: esVenta ? "var(--green)" : "var(--muted)" }}>{esVenta ? "+" : ""}{money(m.monto)}</div>}
                  </div>
                </div>
              );})}
              {historialEUR.length > 5 && (
                <button onClick={() => setExpandEUR((v) => !v)} style={{ display: "block", width: "100%", textAlign: "center", margin: "12px auto 2px", background: "none", border: "none", color: "var(--muted)", fontSize: 12, fontStyle: "italic", cursor: "pointer" }}>
                  {expandEUR ? t.seeLess : t.seeMore}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>

    {/* Botón flotante + para cargar reserva (igual estilo que Movimientos) */}
    {!loading && <button
      onClick={() => setModal({ mode: "add" })}
      aria-label={t.reserve}
      style={{
        position: "fixed",
        bottom: "calc(var(--nav-h) + 8px)",
        left: 0, right: 0, margin: "0 auto",
        width: 54, height: 54,
        borderRadius: "50%",
        background: "transparent",
        color: "var(--green)",
        border: "none",
        cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 100,
        filter: "drop-shadow(0 2px 12px var(--green)99)",
        opacity: btnVisible ? 1 : 0,
        pointerEvents: btnVisible ? "all" : "none",
        transition: "opacity 0.4s ease",
      }}
    >
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
        <line x1="12" y1="5" x2="12" y2="19"/>
        <line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
    </button>}

    <MovementModal
      open={modal !== null}
      mode={modal?.mode === "edit" ? "edit" : "add"}
      reserveMode={modal?.mode === "add"}
      readOnly={modal?.mode === "edit"}
      movimiento={modal?.mode === "edit" ? modal.mov : null}
      movimientos={movimientos}
      config={config}
      onClose={() => setModal(null)}
      onChanged={refreshData}
      onCreated={prependMovimiento}
      onUpdated={updateMovimiento}
      onDeleted={removeMovimiento}
    />
    {kpiInfo && <KpiInfoModal title={kpiInfo.title} value={kpiInfo.value} explain={kpiInfo.explain} color={kpiInfo.color} onClose={() => setKpiInfo(null)} />}
    </>
  );
}
