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
import { useT } from "@/hooks/useTranslation";

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
  const t = useT();

  const periodos = useMemo(() => agruparPorPeriodo(movimientos), [movimientos]);
  const ultimoCargado = useMemo(() => {
    if (movimientos.length === 0) return null;
    return movimientos.reduce((a, b) =>
      new Date(a.timestampCarga).getTime() > new Date(b.timestampCarga).getTime() ? a : b
    ).timestampCarga;
  }, [movimientos]);
  const serie = useMemo(() => serieTendencia(periodos, config?.meta.ahorrosAcumSeedPeriodoId), [periodos, config?.meta.ahorrosAcumSeedPeriodoId]);
  const p = periodos[0];
  const ahorrosAcum = serie.length ? serie[serie.length - 1].ahorrosAcum : 0;
  const ultimos = p?.movimientos.slice(0, 5) ?? [];
  const pctDisp = p && p.total > 0 ? Math.round((p.disponible / p.total) * 100) : 0;
  const barColor = pctDisp < 10 ? "var(--red)" : pctDisp < 50 ? "var(--yellow)" : "var(--green)";
  const barColorDim = pctDisp < 10 ? "var(--red-dim)" : pctDisp < 50 ? "var(--yellow-dim)" : "var(--green-dim)";

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
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
            <div>
              <div className="label" style={{ marginBottom: 2 }}>{t.home}</div>
              <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.5, background: "linear-gradient(110deg, var(--blue) 10%, var(--green) 90%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>{t.pageTitleDashboard}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 2 }}>{t.period}</div>
              <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "var(--font-mono)", display: "inline-block", background: "linear-gradient(110deg, var(--blue) 10%, var(--green) 90%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>{fechaCorta(p.periodoId)}</div>
            </div>
          </div>

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
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
            {[
              { label: t.salary, value: money(p.sueldo), color: "var(--green)" },
              { label: t.spent, value: money(p.gastado), color: "var(--red)" },
              { label: t.savings, value: money(ahorrosAcum), color: "var(--blue)" },
              { label: t.withdrawals, value: p.extras > 0 ? money(p.extras) : "—", sub: t.fromSavings, color: "var(--yellow)" },
            ].map((k) => (
              <div key={k.label} className="soft" style={{ padding: 15, background: "linear-gradient(135deg, var(--surface), var(--surface-alt))" }}>
                <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 7 }}>{k.label}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: k.color, fontFamily: "var(--font-mono)" }}>{k.value}</div>
                {"sub" in k && <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>{k.sub}</div>}
              </div>
            ))}
          </div>

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
    </div>
  );
}
