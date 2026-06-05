"use client";

import { useAuth } from "@/hooks/useAuth";
import { useAllMovimientos } from "@/hooks/useAllMovimientos";
import { agruparPorPeriodo, formatARS } from "@/utils/periodo";
import { Movimiento } from "@/types";

function TipoColor(m: Movimiento) {
  if (m.tipo === "Gasto" || m.tipo === "CompraUSD") return "var(--red)";
  if (m.tipo === "Move") return "var(--yellow)";
  return "var(--green)";
}

function TipoPrefix(m: Movimiento) {
  if (m.tipo === "Gasto" || m.tipo === "CompraUSD") return "-";
  return "+";
}

export default function Dashboard() {
  const { user } = useAuth();
  const { movimientos, loading } = useAllMovimientos(user?.uid);

  const periodos = agruparPorPeriodo(movimientos);
  const p = periodos[0];
  const ultimos = p?.movimientos.slice(0, 6) ?? [];
  const pct = p?.pct ?? 0;
  const barColor = pct > 100 ? "var(--red)" : pct > 80 ? "var(--yellow)" : "var(--green)";

  return (
    <div className="page fade-up">

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <div className="label" style={{ marginBottom: 2 }}>Finanzas App</div>
          <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.5 }}>Dashboard</div>
        </div>
        {p && (
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 9, color: "var(--muted)", letterSpacing: 2, marginBottom: 2 }}>PERÍODO</div>
            <div style={{ fontSize: 12, color: "var(--accent)", fontWeight: 700 }}>{p.periodoId}</div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="loading-pulse" style={{ fontSize: 11, color: "var(--muted)", letterSpacing: 3, textAlign: "center", paddingTop: 60 }}>CARGANDO...</div>
      ) : !p ? (
        <div className="card" style={{ textAlign: "center", padding: 32, color: "var(--muted)", fontSize: 12 }}>
          No hay datos. Cargá el primer movimiento.
        </div>
      ) : (
        <>
          {/* Hero */}
          <div className="card" style={{ borderColor: `${barColor}44`, marginBottom: 12, background: `linear-gradient(135deg, var(--surface) 0%, ${barColor}08 100%)` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
              <div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 6 }}>Disponible</div>
                <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: -1, color: "var(--text)", lineHeight: 1 }}>
                  {formatARS(p.disponible)}
                </div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 6 }}>
                  de {formatARS(p.total)} · {p.movimientos.length} movimientos
                </div>
              </div>
              <span className="badge" style={{ background: barColor + "20", color: barColor, border: `1px solid ${barColor}44`, marginTop: 4 }}>
                {pct}%
              </span>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${Math.min(pct, 100)}%`, background: barColor }} />
            </div>
          </div>

          {/* KPIs */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
            {[
              { label: "Gastado", value: formatARS(p.gastado), color: "var(--red)" },
              { label: "Ahorros", value: formatARS(p.ahorros), color: "var(--blue)" },
              { label: "Sueldo", value: formatARS(p.sueldo), color: "var(--green)" },
              { label: "Extras", value: p.extras > 0 ? formatARS(p.extras) : "—", color: "var(--green)" },
            ].map((k) => (
              <div key={k.label} className="card" style={{ padding: 14 }}>
                <div style={{ fontSize: 9, color: "var(--muted)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>{k.label}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: k.color }}>{k.value}</div>
              </div>
            ))}
          </div>

          {/* Últimos movimientos */}
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <span className="label" style={{ marginBottom: 0 }}>Últimos movimientos</span>
            </div>
            {ultimos.length === 0 ? (
              <div style={{ fontSize: 12, color: "var(--muted)", textAlign: "center", padding: "16px 0" }}>Sin movimientos</div>
            ) : ultimos.map((m) => (
              <div key={m.id} className="row">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {m.descripcion || m.categoria}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>
                    {m.categoria} · {m.fecha}
                  </div>
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: TipoColor(m), marginLeft: 12, whiteSpace: "nowrap" }}>
                  {TipoPrefix(m)}{formatARS(m.monto)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
