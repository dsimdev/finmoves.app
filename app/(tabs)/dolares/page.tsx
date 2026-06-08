"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useAllMovimientos } from "@/hooks/useAllMovimientos";
import { useCotizacion } from "@/hooks/useCotizacion";
import { useConfig } from "@/hooks/useConfig";

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
import { actualizarTipoCambio } from "@/services/firebase/config";
import { useMoney, MASK } from "@/hooks/useHideValues";
import { useAppPrefs } from "@/hooks/useAppPrefs";
import { EyeIcon } from "@/components/EyeIcon";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { Movimiento } from "@/types";

const SALDO_INICIAL_USD = 5.77;

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
  const { oculto, toggle, m: money } = useMoney();
  const { monedaInversiones } = useAppPrefs();

  const [tipoCambioSelUSD, setTipoCambioSelUSD] = useState<"blue" | "oficial" | null>(null);
  const [tipoCambioSelEUR, setTipoCambioSelEUR] = useState<"blue" | "oficial" | null>(null);

  const esEUR = monedaInversiones === "EUR";
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
  const totalUSD = SALDO_INICIAL_USD + desdeMovimientosUSD;
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

  return (
    <div className="page fade-up">

      <div style={{ marginBottom: 24 }}>
        <div className="label" style={{ marginBottom: 2 }}>Inversión</div>
        <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.5, display: "inline-block", background: "linear-gradient(110deg, var(--blue) 10%, var(--green) 90%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>{showUSD && showEUR ? "Dólares | Euros" : esEUR ? "Euros" : "Dólares"}</div>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <>
          {/* ── SECCIÓN USD ── */}
          {showUSD && (<>
          <div className="card" style={{ borderColor: "var(--yellow)44", background: "linear-gradient(135deg, var(--surface) 0%, var(--yellow-dim) 100%)", marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: "var(--muted)" }}>Reserva USD</div>
              <button onClick={toggle} aria-label="Ocultar valores" style={{
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
                ≈ {money(reservaUSDenARS)} · {tipoCambioRef} ${cotizacionUSD?.toLocaleString("es-AR")}
              </div>
            )}
            {gananciaUSD !== null && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 9, color: "var(--muted)", letterSpacing: 2, marginBottom: 4 }}>PRECIO PROM.</div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{oculto ? MASK : "$" + costoPromedioUSD.toLocaleString("es-AR", { maximumFractionDigits: 0 })}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 9, color: "var(--muted)", letterSpacing: 2, marginBottom: 4 }}>GANANCIA</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: gananciaUSD >= 0 ? "var(--green)" : "var(--red)" }}>
                    {gananciaUSD >= 0 ? "+" : ""}{money(gananciaUSD)}
                    {gananciaPctUSD !== null && <span style={{ fontSize: 10, marginLeft: 4 }}>({gananciaPctUSD.toFixed(1)}%)</span>}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="card" style={{ borderColor: "var(--yellow)44", background: "linear-gradient(135deg, var(--surface) 0%, var(--yellow-dim) 100%)", marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div className="label" style={{ marginBottom: 0 }}>Cotización USD</div>
              <div style={{ fontSize: 9, color: "var(--muted)" }}>
                {cotizacion && minutosDesdeActualizacion != null ? `hace ${minutosDesdeActualizacion} min` : "sin datos"}
              </div>
            </div>
            {cotizacion ? (
              <div style={{ display: "flex", gap: 8 }}>
                {(["oficial", "blue"] as const).map((t) => (
                  <div key={t} onClick={() => { setTipoCambioSelUSD(t); if (user?.uid) actualizarTipoCambio(user.uid, t); }}
                    style={{
                      flex: 1, cursor: "pointer",
                      background: t === tipoCambioRefUSD ? "linear-gradient(135deg, var(--surface) 0%, var(--yellow-dim) 100%)" : "var(--surface-alt)",
                      border: `1px solid ${t === tipoCambioRefUSD ? "var(--yellow)55" : "var(--border)"}`,
                      borderRadius: "var(--radius-sm)", padding: "10px 8px", textAlign: "center", transition: "all 0.15s",
                    }}>
                    <div style={{ fontSize: 9, color: "var(--muted)", textTransform: "uppercase", marginBottom: 6 }}>{t}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: t === tipoCambioRefUSD ? "var(--yellow)" : "var(--text)" }}>
                      {cotizacion[t] ? `$${cotizacion[t].toLocaleString("es-AR")}` : "—"}
                    </div>
                  </div>
                ))}
              </div>
            ) : <div style={{ fontSize: 12, color: "var(--muted)" }}>Sin datos. Verificá conexión.</div>}
          </div>
          </>)}

          {/* ── SECCIÓN EUR ── */}
          {showEUR && (<>
          <div className="card" style={{ borderColor: "var(--yellow)44", background: "linear-gradient(135deg, var(--surface) 0%, var(--yellow-dim) 100%)", marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: "var(--muted)" }}>Reserva EUR</div>
              {!showUSD && (
                <button onClick={toggle} aria-label="Ocultar valores" style={{
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
                ≈ {money(reservaEURenARS)} · {tipoCambioRef} ${cotizacionEUR?.toLocaleString("es-AR")}
              </div>
            )}
            {gananciaEUR !== null && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 9, color: "var(--muted)", letterSpacing: 2, marginBottom: 4 }}>PRECIO PROM.</div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{oculto ? MASK : "$" + costoPromedioEUR.toLocaleString("es-AR", { maximumFractionDigits: 0 })}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 9, color: "var(--muted)", letterSpacing: 2, marginBottom: 4 }}>GANANCIA</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: gananciaEUR >= 0 ? "var(--green)" : "var(--red)" }}>
                    {gananciaEUR >= 0 ? "+" : ""}{money(gananciaEUR)}
                    {gananciaPctEUR !== null && <span style={{ fontSize: 10, marginLeft: 4 }}>({gananciaPctEUR.toFixed(1)}%)</span>}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="card" style={{ borderColor: "var(--yellow)44", background: "linear-gradient(135deg, var(--surface) 0%, var(--yellow-dim) 100%)", marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div className="label" style={{ marginBottom: 0 }}>Cotización EUR</div>
              <div style={{ fontSize: 9, color: "var(--muted)" }}>
                {cotizacion && minutosDesdeActualizacion != null ? `hace ${minutosDesdeActualizacion} min` : "sin datos"}
              </div>
            </div>
            {cotizacion ? (
              <div style={{ display: "flex", gap: 8 }}>
                {(["oficial", "blue"] as const).map((t) => {
                  const val = t === "oficial" ? cotizacion.oficial_euro : cotizacion.blue_euro;
                  return (
                    <div key={t} onClick={() => setTipoCambioSelEUR(t)}
                      style={{
                        flex: 1, cursor: "pointer",
                        background: t === tipoCambioRefEUR ? "linear-gradient(135deg, var(--surface) 0%, var(--yellow-dim) 100%)" : "var(--surface-alt)",
                        border: `1px solid ${t === tipoCambioRefEUR ? "var(--yellow)55" : "var(--border)"}`,
                        borderRadius: "var(--radius-sm)", padding: "10px 8px", textAlign: "center", transition: "all 0.15s",
                      }}>
                      <div style={{ fontSize: 9, color: "var(--muted)", textTransform: "uppercase", marginBottom: 6 }}>{t}</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: t === tipoCambioRefEUR ? "var(--yellow)" : "var(--text)" }}>
                        {val ? `$${val.toLocaleString("es-AR")}` : "—"}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : <div style={{ fontSize: 12, color: "var(--muted)" }}>Sin datos. Verificá conexión.</div>}
          </div>
          </>)}

          {/* Meta por período — solo si hay meta de ahorro activa */}
          {config?.meta.metaMonto && (
          <div className="card" style={{ borderColor: "var(--yellow)44", background: "linear-gradient(135deg, var(--surface) 0%, var(--yellow-dim) 100%)", marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div>
                <div className="label" style={{ marginBottom: 4 }}>Meta por período</div>
                <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "var(--font-mono)" }}>
                  {simbolo} {oculto ? "••" : totalDisplay.toFixed(0)} <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 400, fontFamily: "var(--font)" }}>/ {metaUSD}</span>
                </div>
              </div>
              <span className="badge" style={{
                background: totalDisplay >= metaUSD ? "var(--green-dim)" : "var(--yellow-dim)",
                color: totalDisplay >= metaUSD ? "var(--green)" : "var(--yellow)",
                border: `1px solid ${totalDisplay >= metaUSD ? "var(--green)" : "var(--yellow)"}44`,
              }}>
                {totalDisplay >= metaUSD ? "ALCANZADA" : `${((totalDisplay / metaUSD) * 100).toFixed(0)}%`}
              </span>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{
                width: `${Math.min((totalDisplay / metaUSD) * 100, 100)}%`,
                background: totalDisplay >= metaUSD ? "var(--green)" : "var(--accent)",
              }} />
            </div>
          </div>
          )}

          {/* Meta de ahorro */}
          {config?.meta.metaMonto && (
            <div className="card" style={{ borderColor: "var(--yellow)44", background: "linear-gradient(135deg, var(--surface) 0%, var(--yellow-dim) 100%)", marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div className="label" style={{ marginBottom: 0 }}>Meta de ahorro</div>
                {config.meta.metaFecha && <div style={{ fontSize: 9, color: "var(--muted)" }}>{fechaCortaConAnio(config.meta.metaFecha)}</div>}
              </div>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 6 }}>Objetivo {monedaInversiones}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: "var(--yellow)", fontFamily: "var(--font-mono)" }}>
                  {simbolo} {config.meta.metaMonto.toLocaleString("es-AR")}
                </div>
              </div>
              {(() => {
                const falta = Math.max(0, config.meta.metaMonto - totalDisplay);
                return (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderTop: "1px solid var(--faint)", marginBottom: 8 }}>
                      <span style={{ fontSize: 11, color: "var(--muted)" }}>Ahorrado</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "var(--yellow)", fontFamily: "var(--font-mono)" }}>{simbolo} {oculto ? "••" : totalDisplay.toFixed(2)}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0" }}>
                      <span style={{ fontSize: 11, color: "var(--muted)" }}>Falta</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: falta <= 0 ? "var(--green)" : "var(--yellow)", fontFamily: "var(--font-mono)" }}>
                        {simbolo} {oculto ? "••" : (falta <= 0 ? "0.00" : falta.toFixed(2))}
                      </span>
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          {/* Historial USD */}
          {showUSD && historialUSD.length > 0 && (
            <div className="card" style={{ borderColor: "var(--yellow)44", background: "linear-gradient(135deg, var(--surface) 0%, var(--yellow-dim) 100%)", marginBottom: 10 }}>
              <div className="label">Historial compras USD</div>
              {historialUSD.map((m) => (
                <div key={m.id} className="row">
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 500 }}>{fechaCortaConAnio(m.fecha)}</div>
                    {m.cotizacion && <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>cotiz. ${m.cotizacion.toLocaleString("es-AR")}</div>}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--yellow)", fontFamily: "var(--font-mono)" }}>
                      +{oculto ? "••" : m.cantidadUSD?.toFixed(2)} USD
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
              <div className="label">Historial compras EUR</div>
              {historialEUR.map((m) => (
                <div key={m.id} className="row">
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 500 }}>{fechaCortaConAnio(m.fecha)}</div>
                    {m.cotizacion && <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>cotiz. ${m.cotizacion.toLocaleString("es-AR")}</div>}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--yellow)", fontFamily: "var(--font-mono)" }}>
                      +{oculto ? "••" : m.cantidadUSD?.toFixed(2)} EUR
                    </div>
                    <div style={{ fontSize: 10, color: "var(--muted)" }}>{money(m.monto)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
