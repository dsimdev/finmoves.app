"use client";

import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useAllMovimientos } from "@/hooks/useAllMovimientos";
import { useCotizacion } from "@/hooks/useCotizacion";
import { useConfig } from "@/hooks/useConfig";
import { useT } from "@/hooks/useTranslation";

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
import { serieTendencia, proyectarAhorros, periodosParaMetaUSD } from "@/utils/reportes";
import { actualizarTipoCambio } from "@/services/firebase/config";
import { useMoney, MASK } from "@/hooks/useHideValues";
import { useAppPrefs } from "@/hooks/useAppPrefs";
import { EyeIcon } from "@/components/EyeIcon";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { Movimiento } from "@/types";

function calcularReserva(movimientos: Movimiento[], moneda: "USD" | "EUR") {
  const tipoCompra = moneda === "USD" ? "CompraUSD" : "CompraEUR";
  const tipoGasto  = moneda === "USD" ? "GastoUSD"  : "GastoEUR";
  let total = 0;
  let costoTotalARS = 0;
  for (const m of movimientos) {
    if (m.tipo === tipoCompra && m.cantidadUSD) {
      total += m.cantidadUSD;
      costoTotalARS += m.monto;
    } else if (m.tipo === tipoGasto && m.cantidadUSD) {
      total -= m.cantidadUSD;
    }
  }
  return { total, costoTotalARS, costoPromedio: total > 0 ? costoTotalARS / total : 0 };
}

export default function DolaresPage() {
  const { user } = useAuth();
  const { movimientos, loading } = useAllMovimientos(user?.uid);
  const { cotizacion, minutosDesdeActualizacion, refresh } = useCotizacion();
  const { config } = useConfig(user?.uid);

  useEffect(() => { refresh(); }, []);
  const t = useT();
  const { oculto, toggle, m: money } = useMoney();
  const { monedaInversiones, monedaPrincipal } = useAppPrefs();

  const [tipoCambioSelUSD, setTipoCambioSelUSD] = useState<"blue" | "oficial" | null>(null);
  const [tipoCambioSelEUR, setTipoCambioSelEUR] = useState<"blue" | "oficial" | null>(null);

  const monedaInversionesEfectiva: "USD" | "EUR" =
    monedaPrincipal === "USD" ? "EUR" :
    monedaPrincipal === "EUR" ? "USD" :
    monedaInversiones;
  const esEUR = monedaInversionesEfectiva === "EUR";
  const simbolo = esEUR ? "€" : "U$D";

  const savedRef: "blue" | "oficial" = config?.meta.tipoCambioRef === "blue" ? "blue" : "oficial";
  const tipoCambioRefUSD: "blue" | "oficial" = tipoCambioSelUSD ?? savedRef;
  const tipoCambioRefEUR: "blue" | "oficial" = tipoCambioSelEUR ?? savedRef;
  const tipoCambioRef = tipoCambioRefUSD; // kept for saveConfig calls
  const cotizacionUSD = cotizacion ? cotizacion[tipoCambioRefUSD] : null;
  const cotizacionEUR = cotizacion ? (tipoCambioRefEUR === "oficial" ? cotizacion.oficial_euro : cotizacion.blue_euro) ?? null : null;

  // ── USD ──
  const comprasUSD = movimientos
    .filter((m) => m.tipo === "CompraUSD" || m.tipo === "GastoUSD")
    .sort((a, b) => b.timestampCarga.getTime() - a.timestampCarga.getTime());
  const historialUSD = comprasUSD.filter(m => m.tipo === "CompraUSD");
  const { total: desdeMovimientosUSD, costoPromedio: costoPromedioUSD } = calcularReserva(comprasUSD, "USD");
  const totalUSD = (config?.meta.saldoUSD ?? 0) + desdeMovimientosUSD;
  const reservaUSDenARS = cotizacionUSD ? totalUSD * cotizacionUSD : null;
  const gananciaUSD = reservaUSDenARS && costoPromedioUSD > 0 ? reservaUSDenARS - desdeMovimientosUSD * costoPromedioUSD : null;
  const gananciaPctUSD = gananciaUSD && desdeMovimientosUSD * costoPromedioUSD > 0 ? (gananciaUSD / (desdeMovimientosUSD * costoPromedioUSD)) * 100 : null;

  // ── EUR ──
  const comprasEUR = movimientos
    .filter((m) => m.tipo === "CompraEUR" || m.tipo === "GastoEUR")
    .sort((a, b) => b.timestampCarga.getTime() - a.timestampCarga.getTime());
  const historialEUR = comprasEUR.filter(m => m.tipo === "CompraEUR");
  const { total: totalEUR, costoPromedio: costoPromedioEUR } = calcularReserva(comprasEUR, "EUR");
  const reservaEURenARS = cotizacionEUR ? totalEUR * cotizacionEUR : null;
  const gananciaEUR = reservaEURenARS && costoPromedioEUR > 0 ? reservaEURenARS - totalEUR * costoPromedioEUR : null;
  const gananciaPctEUR = gananciaEUR && totalEUR * costoPromedioEUR > 0 ? (gananciaEUR / (totalEUR * costoPromedioEUR)) * 100 : null;

  // ── Visibilidad de secciones ──
  const showUSD = historialUSD.length > 0 || !esEUR;
  const showEUR = historialEUR.length > 0 || esEUR;
  const hasBoth = historialUSD.length > 0 && historialEUR.length > 0;

  // ── Meta — aplica a la moneda primaria configurada ──
  const totalDisplay = esEUR ? totalEUR : totalUSD;
  const metaUSD = config?.meta.metaPorPeriodo ?? config?.meta.usdMensual ?? 400;

  // ── Tendencias de inversión ──
  const periodos = useMemo(() => agruparPorPeriodo(movimientos), [movimientos]);
  const serie = useMemo(() => serieTendencia(periodos), [periodos]);
  const cotizOficial = cotizacion?.oficial ?? null;
  const metaMonto = config?.meta.metaMonto ?? null;
  const promAhorroUSD = cotizOficial && serie.length > 0
    ? (serie.reduce((s, p) => s + Math.max(0, p.ahorros), 0) / serie.length) / cotizOficial : null;
  const periodosParaMeta = metaMonto && cotizOficial ? periodosParaMetaUSD(serie, metaMonto, cotizOficial) : null;
  const proyUSD = cotizOficial && serie.length >= 2 ? proyectarAhorros(serie, 3) / cotizOficial : null;

  return (
    <div className="page">
      {loading ? (
        <LoadingSpinner />
      ) : (
        <div className="fade-up">
          <div style={{ marginBottom: 24 }}>
            <div className="label" style={{ marginBottom: 2 }}>{t.portfolio}</div>
            <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.5, display: "inline-block", background: "linear-gradient(110deg, var(--blue) 10%, var(--green) 90%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>{showUSD && showEUR ? `${t.currencyDollars} | ${t.currencyEuros}` : esEUR ? t.currencyEuros : t.currencyDollars}</div>
          </div>
          {/* ── SECCIÓN USD ── */}
          {showUSD && (<>
          <div className="card" style={{ borderColor: "var(--yellow)44", background: "linear-gradient(135deg, var(--surface) 0%, var(--yellow-dim) 100%)", marginBottom: 10 }}>
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
                ≈ {money(reservaUSDenARS)} · {tipoCambioRef === "oficial" ? t.rateOfficial : t.rateBlue} {t.rate} ${cotizacionUSD?.toLocaleString("es-AR")}
              </div>
            )}
            {gananciaUSD !== null && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 9, color: "var(--muted)", letterSpacing: 2, marginBottom: 4 }}>{t.avgPrice}</div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{oculto ? MASK : "$" + costoPromedioUSD.toLocaleString("es-AR", { maximumFractionDigits: 0 })}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 9, color: "var(--muted)", letterSpacing: 2, marginBottom: 4 }}>{t.profit}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: gananciaUSD >= 0 ? "var(--green)" : "var(--red)" }}>
                    {gananciaUSD >= 0 ? "+" : ""}{money(gananciaUSD)}
                    {gananciaPctUSD !== null && <span style={{ fontSize: 10, marginLeft: 4 }}>({gananciaPctUSD.toFixed(1)}%)</span>}
                  </div>
                </div>
              </div>
            )}
          </div>

          </>)}

          {/* ── SECCIÓN EUR ── */}
          {showEUR && (<>
          <div className="card" style={{ borderColor: "var(--yellow)44", background: "linear-gradient(135deg, var(--surface) 0%, var(--yellow-dim) 100%)", marginBottom: 10 }}>
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
                ≈ {money(reservaEURenARS)} · {tipoCambioRef === "oficial" ? t.rateOfficial : t.rateBlue} {t.rate} ${cotizacionEUR?.toLocaleString("es-AR")}
              </div>
            )}
            {gananciaEUR !== null && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 9, color: "var(--muted)", letterSpacing: 2, marginBottom: 4 }}>{t.avgPrice}</div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{oculto ? MASK : "$" + costoPromedioEUR.toLocaleString("es-AR", { maximumFractionDigits: 0 })}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 9, color: "var(--muted)", letterSpacing: 2, marginBottom: 4 }}>{t.profit}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: gananciaEUR >= 0 ? "var(--green)" : "var(--red)" }}>
                    {gananciaEUR >= 0 ? "+" : ""}{money(gananciaEUR)}
                    {gananciaPctEUR !== null && <span style={{ fontSize: 10, marginLeft: 4 }}>({gananciaPctEUR.toFixed(1)}%)</span>}
                  </div>
                </div>
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
              <div className="card" style={{ borderColor: "var(--yellow)44", background: "linear-gradient(135deg, var(--surface) 0%, var(--yellow-dim) 100%)", marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div className="label" style={{ marginBottom: 0 }}>{t.savingsGoal}</div>
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

                {/* Mini-stats inline */}
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
                  <div>
                    <div style={{ fontSize: 9, color: "var(--muted)", letterSpacing: 1, marginBottom: 4 }}>{t.statPerPeriod}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--yellow)", fontFamily: "var(--font-mono)" }}>
                      {oculto ? "••" : totalDisplay.toFixed(0)}<span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 400 }}>/{metaUSD}</span>
                    </div>
                  </div>
                  {proyUSD !== null && (
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 9, color: "var(--muted)", letterSpacing: 1, marginBottom: 4 }}>{t.statProjection}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--yellow)", fontFamily: "var(--font-mono)" }}>{oculto ? "••••" : proyUSD.toFixed(0)}</div>
                    </div>
                  )}
                  {periodosParaMeta !== null && (
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 9, color: "var(--muted)", letterSpacing: 1, marginBottom: 4 }}>{t.statToGoal}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--yellow)", fontFamily: "var(--font-mono)" }}>
                        {periodosParaMeta === 0 ? t.reached : `${periodosParaMeta} ${t.periodsShort}`}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Historial USD */}
          {showUSD && historialUSD.length > 0 && (
            <div className="card" style={{ borderColor: "var(--yellow)44", background: "linear-gradient(135deg, var(--surface) 0%, var(--yellow-dim) 100%)", marginBottom: 10 }}>
              <div className="label">{t.usdHistory}</div>
              {historialUSD.map((m) => (
                <div key={m.id} className="row">
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 500 }}>{fechaCortaConAnio(m.fecha)}</div>
                    {m.cotizacion && <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>{t.rate} ${m.cotizacion.toLocaleString("es-AR")}</div>}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--yellow)", fontFamily: "var(--font-mono)" }}>
                      +{oculto ? "••" : m.cantidadUSD?.toFixed(2)}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--muted)" }}>{money(m.monto)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Historial EUR */}
          {showEUR && historialEUR.length > 0 && (
            <div className="card" style={{ borderColor: "var(--yellow)44", background: "linear-gradient(135deg, var(--surface) 0%, var(--yellow-dim) 100%)" }}>
              <div className="label">{t.eurHistory}</div>
              {historialEUR.map((m) => (
                <div key={m.id} className="row">
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 500 }}>{fechaCortaConAnio(m.fecha)}</div>
                    {m.cotizacion && <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>{t.rate} ${m.cotizacion.toLocaleString("es-AR")}</div>}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--yellow)", fontFamily: "var(--font-mono)" }}>
                      +{oculto ? "••" : m.cantidadUSD?.toFixed(2)}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--muted)" }}>{money(m.monto)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
