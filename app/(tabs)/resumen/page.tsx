"use client";

import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useAllMovimientos } from "@/hooks/useAllMovimientos";
import { agruparPorPeriodo, gastosPorCategoria, formatARS } from "@/utils/periodo";
import {
  gastosPorMedioPago, gastosPorDescripcion, gastosPorFecha,
  kpisPeriodo, topGastos, ritmoGasto, comparativaCategorias,
  serieTendencia, parsePeriodoId,
} from "@/utils/reportes";

type Sub = "periodos" | "gastos" | "tendencias";

// ── Helpers de formato ───────────────────────────────────────────────────────
const abbr = (n: number) => {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${Math.round(n)}`;
};
const shortPer = (s: string) => { const [d, m] = s.split("/"); return `${d}/${m}`; };

// ── Componentes visuales ─────────────────────────────────────────────────────
function Bar({ nombre, monto, pct, color = "var(--accent)" }: { nombre: string; monto: number; pct: number; color?: string }) {
  return (
    <div style={{ marginBottom: 13 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 1, gap: 10 }}>
        <span style={{ fontSize: 13, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{nombre}</span>
        <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--text)", whiteSpace: "nowrap" }}>
          {formatARS(monto)} <span style={{ color: "var(--muted)", fontSize: 11 }}>{pct}%</span>
        </span>
      </div>
      <div className="bar-track"><div className="bar-fill" style={{ width: `${Math.min(pct, 100)}%`, background: color }} /></div>
    </div>
  );
}

function Stat({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="soft" style={{ padding: 15 }}>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 7 }}>{label}</div>
      <div style={{ fontSize: 19, fontWeight: 700, color: color ?? "var(--text)", fontFamily: "var(--font-mono)", lineHeight: 1.05 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function VBars({ data, max }: { data: { label: string; value: number; color: string; hi?: boolean }[]; max: number }) {
  return (
    <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, alignItems: "flex-end", scrollbarWidth: "none" }}>
      {data.map((d, i) => (
        <div key={i} style={{ flexShrink: 0, width: 36, display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
          <div style={{ fontSize: 8, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>{abbr(d.value)}</div>
          <div style={{ height: 96, width: 20, background: "var(--faint)", borderRadius: 7, display: "flex", alignItems: "flex-end", overflow: "hidden" }}>
            <div style={{ width: "100%", height: `${max > 0 ? Math.round((d.value / max) * 100) : 0}%`, background: d.color, borderRadius: 7, transition: "height .5s ease" }} />
          </div>
          <div style={{ fontSize: 8, color: d.hi ? "var(--accent)" : "var(--muted)", fontWeight: d.hi ? 700 : 400 }}>{shortPer(d.label)}</div>
        </div>
      ))}
    </div>
  );
}

function Spark({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const w = 320, h = 56;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - (v / max) * (h - 4) - 2}`);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none" style={{ display: "block" }}>
      <polyline points={`0,${h} ${pts.join(" ")} ${w},${h}`} fill={color + "1a"} stroke="none" />
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

const SUBS: { id: Sub; label: string }[] = [
  { id: "gastos", label: "Gastos" },
  { id: "periodos", label: "Períodos" },
  { id: "tendencias", label: "Tendencias" },
];

// ── Página ───────────────────────────────────────────────────────────────────
export default function ReportesPage() {
  const { user } = useAuth();
  const { movimientos, loading } = useAllMovimientos(user?.uid);

  const periodos = useMemo(() => agruparPorPeriodo(movimientos), [movimientos]);
  const [sub, setSub] = useState<Sub>("gastos");
  const [periodoSel, setPeriodoSel] = useState<string | null>(null);

  const activeId = periodoSel ?? periodos[0]?.periodoId;
  const idx = periodos.findIndex((p) => p.periodoId === activeId);
  const periodo = idx >= 0 ? periodos[idx] : undefined;
  const anterior = idx >= 0 ? periodos[idx + 1] : undefined;
  const finPeriodo = idx > 0 ? parsePeriodoId(periodos[idx - 1].periodoId) : null;

  const colorPct = (pct: number) => (pct > 100 ? "var(--red)" : pct > 80 ? "var(--yellow)" : "var(--green)");

  // ── Cálculos del período seleccionado (sub Gastos) ──
  const cats = periodo ? gastosPorCategoria(periodo.movimientos, periodo.gastado) : [];
  const medios = periodo ? gastosPorMedioPago(periodo.movimientos, periodo.gastado) : [];
  const descs = periodo ? gastosPorDescripcion(periodo.movimientos, periodo.gastado) : [];
  const porFecha = periodo ? gastosPorFecha(periodo.movimientos, periodo.gastado) : [];
  const kpis = periodo ? kpisPeriodo(periodo) : null;
  const top = periodo ? topGastos(periodo.movimientos) : [];
  const ritmo = periodo ? ritmoGasto(periodo, finPeriodo) : null;
  const comp = periodo ? comparativaCategorias(periodo, anterior) : [];

  // ── Tendencias ──
  const serie = useMemo(() => serieTendencia(periodos), [periodos]);
  const maxTotal = Math.max(...serie.map((s) => s.total), 1);
  const maxSueldo = Math.max(...serie.map((s) => s.sueldo), 1);

  return (
    <div className="page">
      <div style={{ marginBottom: 18 }}>
        <div className="label fade-up-1" style={{ marginBottom: 2 }}>Análisis</div>
        <div className="fade-up-2" style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.5 }}>Reportes</div>
      </div>

      {/* Sub-tabs */}
      <div className="subtabs">
        {SUBS.map((s) => (
          <button key={s.id} onClick={() => setSub(s.id)} className={`subtab ${sub === s.id ? "subtab-active" : ""}`}>
            {s.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading-pulse" style={{ fontSize: 11, color: "var(--muted)", letterSpacing: 3, textAlign: "center", paddingTop: 60 }}>CARGANDO...</div>
      ) : periodos.length === 0 ? (
        <div className="soft" style={{ textAlign: "center", padding: 32, color: "var(--muted)", fontSize: 13 }}>No hay movimientos.</div>
      ) : (
        <div key={sub} className="fade-up">
          {/* Selector de período (Gastos) */}
          {sub !== "tendencias" && (
            <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 16, paddingBottom: 2, scrollbarWidth: "none" }}>
              {periodos.map((p) => (
                <button key={p.periodoId} onClick={() => setPeriodoSel(p.periodoId)} style={{
                  flexShrink: 0, padding: "6px 13px", borderRadius: 999, fontSize: 11, fontWeight: 600, cursor: "pointer",
                  border: `1px solid ${activeId === p.periodoId ? "var(--accent)" : "var(--border)"}`,
                  background: activeId === p.periodoId ? "var(--accent-dim)" : "transparent",
                  color: activeId === p.periodoId ? "var(--accent)" : "var(--muted)",
                }}>{shortPer(p.periodoId)}</button>
              ))}
            </div>
          )}

          {/* ══ GASTOS ══ */}
          {sub === "gastos" && periodo && kpis && ritmo && (
            <>
              {/* KPIs */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 18 }}>
                <Stat label="Gastado" value={formatARS(periodo.gastado)} sub={`${periodo.pct}% del total`} color={colorPct(periodo.pct)} />
                <Stat label="Promedio / día" value={abbr(kpis.promedioDiario)} sub={`${ritmo.diasTranscurridos} días`} />
                <Stat label="Mayor gasto" value={kpis.diaMayorGasto ? abbr(kpis.diaMayorGasto.monto) : "—"} sub={kpis.diaMayorGasto?.fecha} color="var(--red)" />
                <Stat label="Movimientos" value={String(kpis.cantGastos + kpis.cantIngresos)} sub={`${kpis.cantGastos} gastos · ${kpis.cantIngresos} ingresos`} />
              </div>

              {/* Ritmo de gasto */}
              <div className="soft" style={{ marginBottom: 12, background: "linear-gradient(135deg, var(--surface), var(--accent-dim))", borderColor: "var(--accent)33" }}>
                <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>Ritmo de gasto</div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                  <div>
                    <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "var(--font-mono)" }}>{formatARS(ritmo.gastadoPorDia)}<span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 400 }}>/día</span></div>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>Proyección 30 días: {formatARS(ritmo.proyeccionCierre)}</div>
                  </div>
                  {ritmo.enCurso && <span className="badge" style={{ background: "var(--green-dim)", color: "var(--green)", border: "1px solid var(--green)44" }}>EN CURSO</span>}
                </div>
              </div>

              {/* Categorías */}
              <div className="soft" style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Por categoría</div>
                {cats.map((c) => <Bar key={c.categoria} nombre={c.categoria} monto={c.monto} pct={c.pct} />)}
              </div>

              {/* Top 5 gastos */}
              {top.length > 0 && (
                <div className="soft" style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Top 5 gastos</div>
                  {top.map((m, i) => (
                    <div key={m.id} className="row" style={{ padding: "9px 0" }}>
                      <div style={{ display: "flex", gap: 10, alignItems: "center", minWidth: 0 }}>
                        <span style={{ fontSize: 12, color: "var(--muted)", fontFamily: "var(--font-mono)", width: 14 }}>{i + 1}</span>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.descripcion || m.categoria}</div>
                          <div style={{ fontSize: 10, color: "var(--muted)" }}>{m.categoria} · {m.fecha}</div>
                        </div>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--red)", fontFamily: "var(--font-mono)", whiteSpace: "nowrap" }}>{formatARS(m.monto)}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Medios de pago */}
              <div className="soft" style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Por medio de pago</div>
                {medios.map((m) => <Bar key={m.nombre} nombre={m.nombre} monto={m.monto} pct={m.pct} color="var(--blue)" />)}
              </div>

              {/* Descripción (top) */}
              <div className="soft" style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Top descripciones</div>
                {descs.map((d) => <Bar key={d.nombre} nombre={d.nombre} monto={d.monto} pct={d.pct} color="var(--yellow)" />)}
              </div>

              {/* Por fecha */}
              {porFecha.length > 0 && (
                <div className="soft" style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Por día</div>
                  <VBars max={Math.max(...porFecha.map((f) => f.monto), 1)} data={porFecha.map((f) => ({ label: f.nombre, value: f.monto, color: "var(--red)" }))} />
                </div>
              )}

              {/* Comparativa vs anterior */}
              {anterior && (
                <div className="soft">
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>vs período anterior</div>
                  <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 12 }}>{shortPer(anterior.periodoId)} → {shortPer(periodo.periodoId)}</div>
                  {comp.filter((c) => c.actual > 0 || c.anterior > 0).slice(0, 8).map((c) => (
                    <div key={c.categoria} className="row" style={{ padding: "8px 0" }}>
                      <span style={{ fontSize: 13 }}>{c.categoria}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--muted)" }}>{formatARS(c.actual)}</span>
                        {c.deltaPct !== null ? (
                          <span style={{ fontSize: 11, fontWeight: 700, color: c.deltaPct > 0 ? "var(--red)" : "var(--green)", minWidth: 48, textAlign: "right" }}>
                            {c.deltaPct > 0 ? "↑" : "↓"}{Math.abs(c.deltaPct)}%
                          </span>
                        ) : <span style={{ fontSize: 10, color: "var(--green)", minWidth: 48, textAlign: "right" }}>nuevo</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ══ PERÍODOS ══ */}
          {sub === "periodos" && periodo && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                <Stat label="Sueldo" value={formatARS(periodo.sueldo)} color="var(--green)" />
                <Stat label="Extras" value={periodo.extras > 0 ? formatARS(periodo.extras) : "—"} color="var(--green)" />
                <Stat label="Gastado" value={formatARS(periodo.gastado)} sub={`${periodo.pct}%`} color={colorPct(periodo.pct)} />
                <Stat label="Disponible" value={formatARS(periodo.disponible)} color={periodo.disponible >= 0 ? "var(--green)" : "var(--red)"} />
                <Stat label="Ahorros" value={periodo.ahorros > 0 ? formatARS(periodo.ahorros) : "—"} color="var(--blue)" />
                <Stat label="Resto" value={periodo.resto > 0 ? formatARS(periodo.resto) : "—"} />
              </div>

              <div className="soft">
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Todos los períodos</div>
                {periodos.map((p) => {
                  const isAct = p.periodoId === activeId;
                  return (
                    <div key={p.periodoId} onClick={() => setPeriodoSel(p.periodoId)} style={{ padding: "11px 0", borderBottom: "1px solid var(--faint)", cursor: "pointer" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: isAct ? "var(--accent)" : "var(--text)" }}>{p.periodoId}</span>
                        <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: colorPct(p.pct) }}>{p.pct}%</span>
                      </div>
                      <div className="bar-track"><div className="bar-fill" style={{ width: `${Math.min(p.pct, 100)}%`, background: colorPct(p.pct) }} /></div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* ══ TENDENCIAS ══ */}
          {sub === "tendencias" && serie.length > 0 && (
            <>
              <div className="soft" style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Gastado por período</div>
                <VBars max={maxTotal} data={serie.map((s) => ({ label: s.periodoId, value: s.gastado, color: colorPct(s.total > 0 ? Math.round((s.gastado / s.total) * 100) : 0), hi: s.periodoId === activeId }))} />
                <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 8 }}>Color según % del total gastado en cada período</div>
              </div>

              <div className="soft" style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Ahorros acumulados</div>
                <Spark values={serie.map((s) => s.ahorrosAcum)} color="var(--blue)" />
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
                  <span style={{ fontSize: 10, color: "var(--muted)" }}>{shortPer(serie[0].periodoId)}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--blue)", fontFamily: "var(--font-mono)" }}>{formatARS(serie[serie.length - 1].ahorrosAcum)}</span>
                </div>
              </div>

              <div className="soft">
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Sueldo por período</div>
                <VBars max={maxSueldo} data={serie.map((s) => ({ label: s.periodoId, value: s.sueldo, color: "var(--green)" }))} />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
