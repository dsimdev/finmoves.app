"use client";

import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useAllMovimientos } from "@/hooks/useAllMovimientos";
import { useCotizacion } from "@/hooks/useCotizacion";
import { useConfig } from "@/hooks/useConfig";
import { agruparPorPeriodo } from "@/utils/periodo";
import { serieTendencia } from "@/utils/reportes";
import { actualizarTipoCambio } from "@/services/firebase/config";
import { useMoney, MASK } from "@/hooks/useHideValues";
import { Movimiento } from "@/types";

const SALDO_INICIAL_USD = 5.77;

const formatFecha = (fecha: string) => {
  // Convierte dd/MM/yyyy a dd-MM-yyyy (o al revés)
  if (fecha.includes("/")) return fecha.replace(/\//g, "-");
  return fecha;
};

function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
      {off ? (
        <>
          <path d="M2 12s3.5-7 10-7c1.6 0 3 .4 4.3 1M22 12s-3.5 7-10 7c-1.6 0-3-.4-4.3-1" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          <path d="M3 3l18 18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </>
      ) : (
        <>
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
          <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.7" />
        </>
      )}
    </svg>
  );
}

function calcularReserva(movimientos: Movimiento[]) {
  let totalUSD = 0;
  let costoTotalARS = 0;
  for (const m of movimientos) {
    if (m.tipo === "CompraUSD" && m.cantidadUSD) {
      totalUSD += m.cantidadUSD;
      costoTotalARS += m.monto;
    } else if (m.tipo === "GastoUSD" && m.cantidadUSD) {
      totalUSD -= m.cantidadUSD;
    }
  }
  return { totalUSD, costoTotalARS, costoPromedio: totalUSD > 0 ? costoTotalARS / totalUSD : 0 };
}

export default function DolaresPage() {
  const { user } = useAuth();
  const { movimientos, loading } = useAllMovimientos(user?.uid);
  const { cotizacion, minutosDesdeActualizacion } = useCotizacion();
  const { config } = useConfig(user?.uid);
  const { oculto, toggle, m: money } = useMoney();

  // Ahorros acumulados (en ARS) para meta de ahorro
  const periodos = useMemo(() => agruparPorPeriodo(movimientos), [movimientos]);
  const serie = useMemo(() => serieTendencia(periodos), [periodos]);
  const ahorrosAcumARS = serie.length > 0 ? serie[serie.length - 1]!.ahorrosAcum : 0;

  const [tipoCambioSel, setTipoCambioSel] = useState<"blue" | "oficial" | null>(null);

  const movimientosUSD = movimientos
    .filter((m) => m.tipo === "CompraUSD")
    .sort((a, b) => b.timestampCarga.getTime() - a.timestampCarga.getTime());

  const { totalUSD: desdeMovimientos, costoPromedio } = calcularReserva(movimientosUSD);
  const totalUSD = SALDO_INICIAL_USD + desdeMovimientos;

  const rawTipoCambio = tipoCambioSel ?? config?.meta.tipoCambioRef ?? "blue";
  const tipoCambioRef: "blue" | "oficial" = rawTipoCambio === "oficial" ? "oficial" : "blue";
  const cotizacionActual = cotizacion ? cotizacion[tipoCambioRef] : null;
  const reservaEnARS = cotizacionActual ? totalUSD * cotizacionActual : null;
  const gananciaARS = reservaEnARS && costoPromedio > 0 ? reservaEnARS - desdeMovimientos * costoPromedio : null;
  const gananciaPct = gananciaARS && desdeMovimientos * costoPromedio > 0 ? (gananciaARS / (desdeMovimientos * costoPromedio)) * 100 : null;
  const metaUSD = config?.meta.usdMensual ?? 400;

  return (
    <div className="page fade-up">

      <div style={{ marginBottom: 24 }}>
        <div className="label" style={{ marginBottom: 2 }}>Inversión</div>
        <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.5 }}>Reserva USD</div>
      </div>

      {loading ? (
        <div className="loading-pulse" style={{ fontSize: 11, color: "var(--muted)", letterSpacing: 3, textAlign: "center", paddingTop: 60 }}>CARGANDO...</div>
      ) : (
        <>
          {/* Hero reserva */}
          <div className="card" style={{ borderColor: "var(--yellow)44", background: "linear-gradient(135deg, var(--surface) 0%, var(--yellow-dim) 100%)", marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: "var(--muted)" }}>Reserva total</div>
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
            {reservaEnARS && (
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 8 }}>
                ≈ {money(reservaEnARS)} · {tipoCambioRef} ${cotizacionActual?.toLocaleString("es-AR")}
              </div>
            )}
            {gananciaARS !== null && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 9, color: "var(--muted)", letterSpacing: 2, marginBottom: 4 }}>PRECIO PROM.</div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{oculto ? MASK : "$" + costoPromedio.toLocaleString("es-AR", { maximumFractionDigits: 0 })}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 9, color: "var(--muted)", letterSpacing: 2, marginBottom: 4 }}>GANANCIA</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: gananciaARS >= 0 ? "var(--green)" : "var(--red)" }}>
                    {gananciaARS >= 0 ? "+" : ""}{money(gananciaARS)}
                    {gananciaPct !== null && <span style={{ fontSize: 10, marginLeft: 4 }}>({gananciaPct.toFixed(1)}%)</span>}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Cotización */}
          <div className="card" style={{ borderColor: "var(--blue)33", marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div className="label" style={{ marginBottom: 0 }}>Cotización</div>
              <div style={{ fontSize: 9, color: "var(--muted)" }}>
                {cotizacion && minutosDesdeActualizacion != null
                  ? `hace ${minutosDesdeActualizacion} min`
                  : "sin datos"}
              </div>
            </div>
            {cotizacion ? (
              <div style={{ display: "flex", gap: 8 }}>
                {(["blue", "oficial"] as const).map((t) => (
                  <div key={t} onClick={() => { setTipoCambioSel(t); if (user?.uid) actualizarTipoCambio(user.uid, t); }}
                    style={{
                      flex: 1, cursor: "pointer",
                      background: t === tipoCambioRef ? "var(--blue-dim)" : "var(--surface-alt)",
                      border: `1px solid ${t === tipoCambioRef ? "var(--blue)55" : "var(--border)"}`,
                      borderRadius: "var(--radius-sm)", padding: "10px 8px", textAlign: "center",
                      transition: "all 0.15s",
                    }}>
                    <div style={{ fontSize: 9, color: "var(--muted)", textTransform: "uppercase", marginBottom: 6 }}>{t}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: t === tipoCambioRef ? "var(--blue)" : "var(--text)" }}>
                      ${cotizacion[t].toLocaleString("es-AR")}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: "var(--muted)" }}>Sin datos. Verificá conexión.</div>
            )}
          </div>

          {/* Meta por período */}
          <div className="card" style={{ borderColor: "var(--accent)33", marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div>
                <div className="label" style={{ marginBottom: 4 }}>Meta por período</div>
                <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "var(--font-mono)" }}>
                  U$D {oculto ? "••" : totalUSD.toFixed(0)} <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 400, fontFamily: "var(--font)" }}>/ {metaUSD}</span>
                </div>
              </div>
              <span className="badge" style={{
                background: totalUSD >= metaUSD ? "var(--green-dim)" : "var(--yellow-dim)",
                color: totalUSD >= metaUSD ? "var(--green)" : "var(--yellow)",
                border: `1px solid ${totalUSD >= metaUSD ? "var(--green)" : "var(--yellow)"}44`,
              }}>
                {totalUSD >= metaUSD ? "ALCANZADA" : `${((totalUSD / metaUSD) * 100).toFixed(0)}%`}
              </span>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{
                width: `${Math.min((totalUSD / metaUSD) * 100, 100)}%`,
                background: totalUSD >= metaUSD ? "var(--green)" : "var(--accent)",
              }} />
            </div>
          </div>

          {/* Meta de ahorro */}
          {config?.meta.metaMonto && (
            <div className="card" style={{ borderColor: "var(--blue)33", background: "linear-gradient(135deg, var(--surface), var(--blue-dim, var(--surface-alt)))", marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div className="label" style={{ marginBottom: 0 }}>Meta de ahorro</div>
                {config.meta.metaFecha && <div style={{ fontSize: 9, color: "var(--muted)" }}>{formatFecha(config.meta.metaFecha)}</div>}
              </div>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 6 }}>Objetivo USD</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: "var(--blue)", fontFamily: "var(--font-mono)" }}>
                  U$D {config.meta.metaMonto.toLocaleString("es-AR")}
                </div>
              </div>
              {(() => {
                const faltaUSD = Math.max(0, config.meta.metaMonto - totalUSD);
                return (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderTop: "1px solid var(--faint)", marginBottom: 8 }}>
                      <span style={{ fontSize: 11, color: "var(--muted)" }}>Ahorrado</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "var(--blue)", fontFamily: "var(--font-mono)" }}>U$D {oculto ? "••" : totalUSD.toFixed(2)}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0" }}>
                      <span style={{ fontSize: 11, color: "var(--muted)" }}>Falta</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: faltaUSD <= 0 ? "var(--green)" : "var(--blue)", fontFamily: "var(--font-mono)" }}>
                        U$D {oculto ? "••" : (faltaUSD <= 0 ? "0.00" : faltaUSD.toFixed(2))}
                      </span>
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          {/* Historial */}
          <div className="card">
            <div className="label">Historial compras</div>
            {movimientosUSD.length === 0 ? (
              <div style={{ fontSize: 12, color: "var(--muted)", textAlign: "center", padding: "16px 0" }}>
                No hay operaciones USD registradas.
              </div>
            ) : movimientosUSD.map((m) => (
              <div key={m.id} className="row">
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500 }}>{m.fecha}</div>
                  {m.cotizacion && (
                    <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>
                      cotiz. ${m.cotizacion.toLocaleString("es-AR")}
                    </div>
                  )}
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
        </>
      )}
    </div>
  );
}
