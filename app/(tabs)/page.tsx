"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useAllMovimientos } from "@/hooks/useAllMovimientos";
import { useConfig } from "@/hooks/useConfig";
import { useMoney } from "@/hooks/useHideValues";
import { agruparPorPeriodo, fechaCorta } from "@/utils/periodo";
import { serieTendencia } from "@/utils/reportes";
import { EyeIcon } from "@/components/EyeIcon";
import { Movimiento } from "@/types";
import { LoadingSpinner } from "@/components/LoadingSpinner";

function TipoColor(m: Movimiento) {
  if (m.tipo === "Gasto" || m.tipo === "CompraUSD") return "var(--red)";
  if (m.tipo === "Move") return "var(--yellow)";
  return "var(--green)";
}
function TipoPrefix(m: Movimiento) {
  return m.tipo === "Gasto" || m.tipo === "CompraUSD" ? "-" : "+";
}

export default function Dashboard() {
  const { user } = useAuth();
  const { movimientos, loading } = useAllMovimientos(user?.uid);
  const { config } = useConfig(user?.uid);
  const { oculto, toggle: toggleOculto, m: money } = useMoney();

  const periodos = useMemo(() => agruparPorPeriodo(movimientos), [movimientos]);
  const serie = useMemo(() => serieTendencia(periodos, config?.meta.ahorrosAcumSeedPeriodoId), [periodos, config?.meta.ahorrosAcumSeedPeriodoId]);
  const p = periodos[0];
  const ahorrosAcum = serie.length ? serie[serie.length - 1].ahorrosAcum : 0;
  const ultimos = p?.movimientos.slice(0, 6) ?? [];
  // % disponible sobre el sueldo del período (cuánto queda, no lo gastado)
  const pctDisp = p && p.sueldo > 0 ? Math.round((p.disponible / p.sueldo) * 100) : 0;
  const barColor = pctDisp < 10 ? "var(--red)" : pctDisp < 50 ? "var(--yellow)" : "var(--green)";

  return (
    <div className="page">

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <div className="label fade-up-1" style={{ marginBottom: 2 }}>Inicio</div>
          <div className="fade-up-2" style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.5, background: "linear-gradient(110deg, var(--blue) 10%, var(--green) 90%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>Dashboard</div>
        </div>
        {p && (
          <div className="fade-up-2" style={{ textAlign: "right" }}>
            <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 2 }}>Período</div>
            <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "var(--font-mono)", display: "inline-block", background: "linear-gradient(110deg, var(--blue) 10%, var(--green) 90%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>{p.periodoId}</div>
          </div>
        )}
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : !p ? (
        <div className="soft" style={{ textAlign: "center", padding: 32, color: "var(--muted)", fontSize: 13 }}>
          No hay datos. Cargá el primer movimiento.
        </div>
      ) : (
        <div className="fade-up">
          {/* Hero */}
          <div className="soft" style={{ borderColor: `${barColor}44`, marginBottom: 12, background: `linear-gradient(135deg, var(--surface) 0%, ${barColor}0d 100%)` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 7 }}>Disponible</div>
                <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: -1, color: "var(--text)", lineHeight: 1, fontFamily: "var(--font-mono)" }}>
                  {money(p.disponible)}
                </div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 7 }}>
                  de {money(p.total)} · {p.movimientos.length} mov.
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10, flexShrink: 0 }}>
                <span className="badge" style={{ background: barColor + "20", color: barColor, border: `1px solid ${barColor}44` }}>{pctDisp}%</span>
                <button onClick={toggleOculto} aria-label="Ocultar valores" style={{
                  background: "var(--surface-alt)", border: "1px solid var(--border)", color: oculto ? "var(--accent)" : "var(--muted)",
                  width: 34, height: 34, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
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
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
            {[
              { label: "Gastado", value: money(p.gastado), color: "var(--red)" },
              { label: "Ahorros", value: money(ahorrosAcum), color: "var(--blue)" },
              { label: "Sueldo", value: money(p.sueldo), color: "var(--green)" },
              { label: "Extras", value: p.extras > 0 ? money(p.extras) : "—", color: "var(--green)" },
            ].map((k) => (
              <div key={k.label} className="soft" style={{ padding: 15 }}>
                <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 7 }}>{k.label}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: k.color, fontFamily: "var(--font-mono)" }}>{k.value}</div>
              </div>
            ))}
          </div>

          {/* Últimos movimientos */}
          <div className="soft">
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Últimos movimientos</div>
            {ultimos.length === 0 ? (
              <div style={{ fontSize: 12, color: "var(--muted)", textAlign: "center", padding: "16px 0" }}>Sin movimientos</div>
            ) : ultimos.map((m) => (
              <div key={m.id} className="row" style={{ padding: "11px 0" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {m.descripcion || m.categoria}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>{m.categoria} · {fechaCorta(m.fecha)}</div>
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: TipoColor(m), marginLeft: 12, whiteSpace: "nowrap", fontFamily: "var(--font-mono)" }}>
                  {TipoPrefix(m)}{money(m.monto)}
                </span>
              </div>
            ))}
            <Link href="/movimientos" aria-label="Ver todos los movimientos" style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "16px auto 2px", width: 48, height: 48, borderRadius: "50%",
              background: "transparent", border: "none", color: "var(--accent)",
              textDecoration: "none", filter: "drop-shadow(0 2px 10px var(--accent)88)",
            }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
