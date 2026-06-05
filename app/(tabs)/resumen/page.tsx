"use client";

import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useAllMovimientos } from "@/hooks/useAllMovimientos";
import { agruparPorPeriodo, gastosPorCategoria, formatARS } from "@/utils/periodo";

export default function ResumenPage() {
  const { user } = useAuth();
  const { movimientos, loading } = useAllMovimientos(user?.uid);
  const [periodoSeleccionado, setPeriodoSeleccionado] = useState<string | null>(null);

  const periodos = useMemo(() => agruparPorPeriodo(movimientos), [movimientos]);
  const activePeriodoId = periodoSeleccionado ?? periodos[0]?.periodoId;
  const periodoActual = periodos.find((p) => p.periodoId === activePeriodoId);

  // Ahorros con carry-forward: si el período tiene ahorros > 0, suma el período anterior.
  // Si tiene 0, resetea (no arrastra nada).
  const ahorrosDisplay = useMemo(() => {
    const map = new Map<string, number>();
    const oldest = [...periodos].reverse(); // de más viejo a más reciente
    let prev = 0;
    for (const p of oldest) {
      if (p.ahorros > 0) {
        const val = p.ahorros + prev;
        map.set(p.periodoId, val);
        prev = val;
      } else {
        map.set(p.periodoId, 0);
        prev = 0;
      }
    }
    return map;
  }, [periodos]);

  const totalAhorros = ahorrosDisplay.get(periodos[0]?.periodoId) ?? 0;

  const categorias = periodoActual
    ? gastosPorCategoria(periodoActual.movimientos, periodoActual.gastado)
    : [];

  return (
    <div className="page fade-up">

      <div style={{ marginBottom: 20 }}>
        <div className="label" style={{ marginBottom: 2 }}>Historial</div>
        <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.5 }}>Resumen</div>
      </div>

      {/* KPI ahorros total */}
      {!loading && totalAhorros > 0 && (
        <div className="card" style={{ marginBottom: 16, background: "var(--blue-dim)", border: "1px solid var(--blue)44" }}>
          <div className="label" style={{ marginBottom: 6 }}>Ahorros totales</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "var(--blue)", fontFamily: "var(--font-mono)" }}>
            {formatARS(totalAhorros)}
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
            Saldo acumulado de todos los períodos
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading-pulse" style={{ fontSize: 11, color: "var(--muted)", letterSpacing: 3, textAlign: "center", paddingTop: 60 }}>CARGANDO...</div>
      ) : periodos.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 32, color: "var(--muted)", fontSize: 12 }}>
          No hay movimientos registrados.
        </div>
      ) : (
        <>
          {/* Lista de períodos */}
          <div className="card" style={{ marginBottom: 12, padding: 0, overflow: "hidden" }}>
            {periodos.map((p, i) => {
              const isActive = activePeriodoId === p.periodoId;
              const pctColor = p.pct > 100 ? "var(--red)" : p.pct > 80 ? "var(--yellow)" : "var(--green)";
              return (
                <div key={p.periodoId}
                  onClick={() => setPeriodoSeleccionado(p.periodoId)}
                  style={{
                    padding: "14px 16px",
                    background: isActive ? "var(--accent-dim)" : "transparent",
                    borderBottom: i < periodos.length - 1 ? "1px solid var(--faint)" : "none",
                    cursor: "pointer",
                    transition: "background 0.15s",
                  }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: isActive ? "var(--accent)" : "var(--text)" }}>
                      {p.periodoId}
                    </span>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--green)" }}>
                        {formatARS(p.disponible)}
                      </span>
                      <span className="badge" style={{ background: pctColor + "20", color: pctColor, border: `1px solid ${pctColor}44` }}>
                        {p.pct}%
                      </span>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 16, fontSize: 10, color: "var(--muted)" }}>
                    <span>S: <span style={{ color: "var(--text)" }}>{formatARS(p.sueldo)}</span></span>
                    <span>G: <span style={{ color: "var(--red)" }}>{formatARS(p.gastado)}</span></span>
                    {p.extras > 0 && <span>E: <span style={{ color: "var(--green)" }}>{formatARS(p.extras)}</span></span>}
                    {(ahorrosDisplay.get(p.periodoId) ?? 0) > 0 && <span>A: <span style={{ color: "var(--blue)" }}>{formatARS(ahorrosDisplay.get(p.periodoId)!)}</span></span>}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Detalle del período seleccionado */}
          {periodoActual && (
            <>
              <div className="label" style={{ marginBottom: 8 }}>Detalle · {periodoActual.periodoId}</div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                {[
                  { label: "Sueldo",    value: formatARS(periodoActual.sueldo),    color: "var(--text)" },
                  { label: "Extras",    value: periodoActual.extras > 0 ? formatARS(periodoActual.extras) : "—", color: "var(--green)" },
                  { label: "Total",     value: formatARS(periodoActual.total),     color: "var(--text)" },
                  { label: "Gastado",   value: formatARS(periodoActual.gastado),   color: "var(--red)" },
                  { label: "% Gastado", value: `${periodoActual.pct}%`,            color: periodoActual.pct > 100 ? "var(--red)" : periodoActual.pct > 80 ? "var(--yellow)" : "var(--green)" },
                  { label: "Disponible",value: formatARS(periodoActual.disponible),color: periodoActual.disponible >= 0 ? "var(--green)" : "var(--red)" },
                  { label: "Ahorros",   value: (ahorrosDisplay.get(periodoActual.periodoId) ?? 0) > 0 ? formatARS(ahorrosDisplay.get(periodoActual.periodoId)!) : "—", color: "var(--blue)" },
                  { label: "Resto",     value: periodoActual.resto > 0 ? formatARS(periodoActual.resto) : "—", color: "var(--muted)" },
                ].map((k) => (
                  <div key={k.label} className="card" style={{ padding: 14 }}>
                    <div style={{ fontSize: 9, color: "var(--muted)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>{k.label}</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: k.color, fontFamily: k.label === "% Gastado" ? "var(--font)" : "var(--font-mono)" }}>{k.value}</div>
                  </div>
                ))}
              </div>

              {/* Gastos por categoría */}
              {categorias.length > 0 && (
                <div className="card">
                  <div className="label">Gastos por categoría</div>
                  {categorias.map((c) => (
                    <div key={c.categoria} style={{ marginBottom: 14 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 5 }}>
                        <span style={{ color: "var(--text)" }}>{c.categoria}</span>
                        <span style={{ color: "var(--muted)" }}>{formatARS(c.monto)} · {c.pct}%</span>
                      </div>
                      <div className="progress-track">
                        <div className="progress-fill" style={{ width: `${Math.min(c.pct, 100)}%`, background: "var(--accent)" }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
