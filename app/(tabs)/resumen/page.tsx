"use client";

import { useState, useMemo, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useAllMovimientos } from "@/hooks/useAllMovimientos";
import { agruparPorPeriodo, gastosPorCategoria, formatARS } from "@/utils/periodo";
import { useMoney, MASK } from "@/hooks/useHideValues";
import {
  gastosPorMedioPago, gastosPorDescripcion, gastosPorFecha,
  kpisPeriodo, topGastos, ritmoGasto, comparativaCategorias,
  serieTendencia, parsePeriodoId,
  medioPagoMasUsadoCount, diasSinGastos,
  mejorPeriodo, peorPeriodo, promedioAhorroPeriodo, evolucionSueldo,
  gastoPromedioHistorico, proyectarAhorros, periodosParaMetaARS,
  generarInsights, Insight,
  ritmoAhorroActual, progresoMetaUSD, periodosParaMetaUSD, consistenciaAhorro, ahorrosVsProyectados, AhorroVsProyectado,
} from "@/utils/reportes";
import { useCotizacion } from "@/hooks/useCotizacion";
import { useConfig } from "@/hooks/useConfig";
import { useReportConfig } from "@/hooks/useReportConfig";

type Sub = "periodos" | "gastos" | "tendencias";

// ── Íconos ──────────────────────────────────────────────────────────────────
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

// ── Helpers de formato ───────────────────────────────────────────────────────
const abbr = (n: number) => {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${Math.round(n)}`;
};
const shortPer = (s: string) => { const [d, m] = s.split("/"); return `${d}/${m}`; };
const sinAño = (fecha: string) => {
  if (fecha.includes("-")) {
    const [, m, d] = fecha.split("-");
    return `${d}/${m}`;
  }
  return fecha.includes("/") ? fecha.split("/").slice(0, 2).join("/") : fecha;
};

// ── Componentes visuales ─────────────────────────────────────────────────────
function Bar({ nombre, monto, pct, color = "var(--accent)", oculto }: { nombre: string; monto: number; pct: number; color?: string; oculto?: boolean }) {
  return (
    <div style={{ marginBottom: 13 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 1, gap: 10 }}>
        <span style={{ fontSize: 13, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{nombre}</span>
        <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--text)", whiteSpace: "nowrap" }}>
          {oculto ? MASK : formatARS(monto)} <span style={{ color: "var(--muted)", fontSize: 11 }}>{pct}%</span>
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

function VBars({ data, max, oculto }: { data: { label: string; value: number; color: string; hi?: boolean }[]; max: number; oculto?: boolean }) {
  return (
    <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, alignItems: "flex-end", scrollbarWidth: "none" }}>
      {data.map((d, i) => (
        <div key={i} style={{ flexShrink: 0, width: 36, display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
          <div style={{ fontSize: 8, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>{oculto ? "•" : abbr(d.value)}</div>
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
  const { oculto, toggle, m: money } = useMoney();
  const { movimientos, loading } = useAllMovimientos(user?.uid);
  const { cotizacion } = useCotizacion();
  const { config } = useConfig(user?.uid);
  const { isEnabled: reportOn } = useReportConfig();

  const periodos = useMemo(() => agruparPorPeriodo(movimientos), [movimientos]);
  const [sub, setSub] = useState<Sub>("gastos");
  const [periodosSelIds, setPeriodosSelIds] = useState<string[]>([]);
  const [modalTop, setModalTop] = useState<"gastos" | "descs" | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggered = useRef(false);

  // Multi-select: si no hay selección, usa el primero
  const activos = periodosSelIds.length > 0 ? periodosSelIds : [periodos[0]?.periodoId].filter(Boolean);
  const periodosActivos = periodos.filter((p) => activos.includes(p.periodoId));

  // Combina todos los períodos seleccionados en uno virtual
  const periodo = periodosActivos.length > 0 ? {
    periodoId: activos.length === 1 ? activos[0]! : `${activos.length} períodos`,
    sueldo: periodosActivos.reduce((sum, p) => sum + p.sueldo, 0),
    extras: periodosActivos.reduce((sum, p) => sum + p.extras, 0),
    total: periodosActivos.reduce((sum, p) => sum + p.total, 0),
    gastado: periodosActivos.reduce((sum, p) => sum + p.gastado, 0),
    ahorros: periodosActivos.reduce((sum, p) => sum + p.ahorros, 0),
    resto: periodosActivos.reduce((sum, p) => sum + p.resto, 0),
    disponible: periodosActivos.reduce((sum, p) => sum + p.disponible, 0),
    pct: periodosActivos.length > 0 ? Math.round((periodosActivos.reduce((sum, p) => sum + p.gastado, 0) / periodosActivos.reduce((sum, p) => sum + p.total, 0)) * 100) : 0,
    movimientos: periodosActivos.flatMap((p) => p.movimientos),
  } : undefined;

  // Para comparativa y ritmo, usa el primer período (sólo si es un período individual)
  const idx1 = activos.length === 1 && activos[0] ? periodos.findIndex((p) => p.periodoId === activos[0]) : -1;
  const anterior = idx1 >= 0 ? periodos[idx1 + 1] : undefined;
  // finPeriodo = inicio del período siguiente (si existe), para cerrar el intervalo correctamente
  const finPeriodo = idx1 > 0 ? parsePeriodoId(periodos[idx1 - 1].periodoId) : null;

  const colorPct = (pct: number) => (pct > 100 ? "var(--red)" : pct > 80 ? "var(--yellow)" : "var(--green)");

  // ── Cálculos del período seleccionado (sub Gastos) ──
  const cats = periodo ? gastosPorCategoria(periodo.movimientos, periodo.gastado) : [];
  const medios = periodo ? gastosPorMedioPago(periodo.movimientos, periodo.gastado) : [];
  const descs = periodo ? gastosPorDescripcion(periodo.movimientos, periodo.gastado, 5) : [];
  const descsModal = periodo ? gastosPorDescripcion(periodo.movimientos, periodo.gastado, 20) : [];
  const porFecha = periodo ? gastosPorFecha(periodo.movimientos, periodo.gastado) : [];
  const kpis = periodo ? kpisPeriodo(periodo) : null;
  const top = periodo ? topGastos(periodo.movimientos, 5) : [];
  const topTodos = periodo ? topGastos(periodo.movimientos, 20) : [];
  // Ritmo y comparativa sólo aplican a un período individual
  const ritmo = periodo && activos.length === 1 ? ritmoGasto(periodo, finPeriodo) : null;
  const comp = periodo && activos.length === 1 ? comparativaCategorias(periodo, anterior) : [];

  // ── Estadísticas avanzadas (Gastos) ──
  const medioPagoTop = periodo ? medioPagoMasUsadoCount(periodo.movimientos) : null;
  const promPorMov = periodo && kpis && kpis.cantGastos > 0 ? periodo.gastado / kpis.cantGastos : null;
  const diasLibres = activos.length === 1 && periodo ? (() => {
    const start = parsePeriodoId(activos[0]!);
    const end = finPeriodo ?? new Date();
    return diasSinGastos(periodo.movimientos, start, end);
  })() : null;
  const catMasCrecio = comp.filter((c) => c.deltaPct !== null && c.deltaPct > 0).sort((a, b) => (b.deltaPct ?? 0) - (a.deltaPct ?? 0))[0] ?? null;

  // ── Estadísticas avanzadas (Períodos) ──
  const mejorPer = periodos.length > 1 ? mejorPeriodo(periodos) : null;
  const peorPer = periodos.length > 1 ? peorPeriodo(periodos) : null;
  const promedioAhorro = promedioAhorroPeriodo(periodos);
  const evolSueldo = evolucionSueldo(periodos);

  // ── Tendencias ──
  const serie = useMemo(() => serieTendencia(periodos), [periodos]);
  const maxTotal = Math.max(...serie.map((s) => s.total), 1);
  const maxSueldo = Math.max(...serie.map((s) => s.sueldo), 1);

  // ── Estadísticas avanzadas (Tendencias) ──
  const gastoPromHist = gastoPromedioHistorico(serie);
  const maxDisp = Math.max(...serie.map((s) => Math.abs(s.disponible)), 1);
  const metaUSD = config?.meta.usdMensual ?? 400;
  const cotizActual = cotizacion?.blue ?? null;
  const metaARS = cotizActual ? metaUSD * cotizActual : null;
  const periodosParaMeta = metaARS ? periodosParaMetaARS(serie, metaARS) : null;
  const insights: Insight[] = useMemo(() => generarInsights(periodos, serie), [periodos, serie]);

  // ── Estadísticas de metas de ahorro ──
  const ritmoAhorro = ritmoAhorroActual(serie);
  const ahorrosAcumActual = serie.length > 0 ? serie[serie.length - 1]!.ahorrosAcum : 0;
  const metaMonto = config?.meta.metaMonto;
  const metaPorPeriodo = config?.meta.metaPorPeriodo;
  const progresoMeta = metaMonto && cotizActual ? progresoMetaUSD(ahorrosAcumActual, metaMonto, cotizActual) : null;
  const periodosParaMetaMonto = metaMonto && cotizActual ? periodosParaMetaUSD(serie, metaMonto, cotizActual) : null;
  const consistencia = metaPorPeriodo ? consistenciaAhorro(periodos, metaPorPeriodo) : null;
  const datosAhorrosVsProyectados = metaPorPeriodo ? ahorrosVsProyectados(serie, metaPorPeriodo) : [];

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
          {/* Selector de período (Gastos) — Multi-select */}
          {sub !== "tendencias" && (
            <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 16, paddingBottom: 2, scrollbarWidth: "none", alignItems: "center" }}>
              {periodos.map((p) => {
                const isSelected = activos.includes(p.periodoId);
                return (
                  <button
                    key={p.periodoId}
                    onPointerDown={() => {
                      longPressTriggered.current = false;
                      longPressTimer.current = setTimeout(() => {
                        longPressTriggered.current = true;
                        setPeriodosSelIds(prev => {
                          const current = prev.length > 0 ? prev : [periodos[0]?.periodoId].filter(Boolean) as string[];
                          return current.includes(p.periodoId)
                            ? current.filter((id) => id !== p.periodoId)
                            : [...current, p.periodoId];
                        });
                      }, 400);
                    }}
                    onPointerUp={() => {
                      if (longPressTimer.current) clearTimeout(longPressTimer.current);
                    }}
                    onPointerCancel={() => {
                      if (longPressTimer.current) clearTimeout(longPressTimer.current);
                    }}
                    onClick={() => {
                      if (longPressTriggered.current) return;
                      setPeriodosSelIds([p.periodoId]);
                    }}
                    style={{
                      flexShrink: 0, padding: "6px 13px", borderRadius: 999, fontSize: 11, fontWeight: 600, cursor: "pointer",
                      border: `1px solid ${isSelected ? "var(--accent)" : "var(--border)"}`,
                      background: isSelected ? "var(--accent-dim)" : "transparent",
                      color: isSelected ? "var(--accent)" : "var(--muted)",
                      transition: "all 0.15s",
                      boxShadow: periodosSelIds.length > 1 && isSelected ? `0 0 0 2px var(--accent)` : "none",
                    }}
                  >{shortPer(p.periodoId)}</button>
                );
              })}
              {activos.length > 1 && (
                <span style={{ fontSize: 10, color: "var(--muted)", marginLeft: 6, whiteSpace: "nowrap" }}>
                  {activos.length} períodos
                </span>
              )}
            </div>
          )}

          {/* ══ GASTOS ══ */}
          {sub === "gastos" && periodo && kpis && (
            <>
              {/* KPIs */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 18 }}>
                <Stat label="Gastado" value={money(periodo.gastado)} sub={`${periodo.pct}% del total`} color={colorPct(periodo.pct)} />
                {ritmo && <Stat label="Promedio / día" value={money(kpis.promedioDiario)} sub={`${ritmo.diasTranscurridos} días`} />}
                <Stat label="Mayor gasto" value={kpis.diaMayorGasto ? money(kpis.diaMayorGasto.monto) : "—"} sub={kpis.diaMayorGasto ? sinAño(kpis.diaMayorGasto.fecha) : undefined} color="var(--red)" />
                {activos.length > 1 && (() => {
                  // Desde el inicio del período más antiguo hasta hoy (o fin del más reciente)
                  const oldest = periodosActivos[periodosActivos.length - 1];
                  const newest = periodosActivos[0];
                  const idxNewest = periodos.findIndex((p) => p.periodoId === newest?.periodoId);
                  const endDate = idxNewest > 0 ? parsePeriodoId(periodos[idxNewest - 1].periodoId) : new Date();
                  const startDate = parsePeriodoId(oldest?.periodoId || "");
                  const dias = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
                  const rango = `${shortPer(oldest?.periodoId || "")} → ${shortPer(newest?.periodoId || "")}`;
                  return <Stat label="Días" value={String(Math.abs(dias))} sub={rango} color="var(--blue)" />;
                })()}
                <Stat label="Movimientos" value={String(kpis.cantGastos + kpis.cantIngresos)} sub={`${kpis.cantGastos} gastos · ${kpis.cantIngresos} ingresos`} />
                {promPorMov !== null && reportOn("promPorMov") && <Stat label="Prom. por gasto" value={money(promPorMov)} sub={`${kpis.cantGastos} transacciones`} />}
                {diasLibres && reportOn("diasLibres") && <Stat label="Días sin gastos" value={String(diasLibres.sinGasto)} sub={`de ${diasLibres.total} días`} color="var(--green)" />}
              </div>

              {/* Ritmo de gasto (sólo para período individual) */}
              {ritmo && reportOn("ritmo") && (
              <div className="soft" style={{ marginBottom: 12, background: "linear-gradient(135deg, var(--surface), var(--accent-dim))", borderColor: "var(--accent)33" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>Ritmo de gasto</div>
                  <button onClick={toggle} aria-label="Ocultar valores" style={{
                    background: "transparent", border: "none", color: oculto ? "var(--accent)" : "var(--muted)",
                    width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0,
                  }}>
                    <EyeIcon off={oculto} />
                  </button>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                  <div>
                    <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "var(--font-mono)" }}>{money(ritmo.gastadoPorDia)}<span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 400 }}>/día</span></div>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>Proyección 30 días: {money(ritmo.proyeccionCierre)}</div>
                  </div>
                  {ritmo.enCurso && <span className="badge" style={{ background: "var(--green-dim)", color: "var(--green)", border: "1px solid var(--green)44" }}>EN CURSO</span>}
                </div>
              </div>
              )}

              {/* Categorías */}
              <div className="soft" style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Por categoría</div>
                {cats.map((c) => <Bar key={c.categoria} nombre={c.categoria} monto={c.monto} pct={c.pct} oculto={oculto} />)}
              </div>

              {/* Top 5 gastos */}
              {top.length > 0 && (
                <div className="soft" style={{ marginBottom: 12, cursor: "pointer" }} onClick={() => setModalTop("gastos")}>
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
                      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--red)", fontFamily: "var(--font-mono)", whiteSpace: "nowrap" }}>{money(m.monto)}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Descripción (top) */}
              <div className="soft" style={{ marginBottom: 12, cursor: "pointer" }} onClick={() => setModalTop("descs")}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Top 5 descripciones</div>
                {descs.map((d) => <Bar key={d.nombre} nombre={d.nombre} monto={d.monto} pct={d.pct} color="var(--yellow)" oculto={oculto} />)}
              </div>

              {/* Medios de pago */}
              <div className="soft" style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Por medio de pago</div>
                {medios.map((m) => <Bar key={m.nombre} nombre={m.nombre} monto={m.monto} pct={m.pct} color="var(--blue)" oculto={oculto} />)}
              </div>

              {/* Por fecha */}
              {porFecha.length > 0 && (
                <div className="soft" style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Por día</div>
                  <VBars max={Math.max(...porFecha.map((f) => f.monto), 1)} oculto={oculto} data={porFecha.map((f) => ({ label: sinAño(f.nombre), value: f.monto, color: "var(--red)" }))} />
                </div>
              )}

              {/* Comparativa vs anterior */}
              {anterior && reportOn("comparativa") && (
                <div className="soft" style={{ marginBottom: catMasCrecio && reportOn("catCrecio") ? 12 : 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>vs período anterior</div>
                  <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 12 }}>{shortPer(anterior.periodoId)} → {shortPer(periodo.periodoId)}</div>
                  {comp.filter((c) => c.actual > 0 || c.anterior > 0).slice(0, 8).map((c) => (
                    <div key={c.categoria} className="row" style={{ padding: "8px 0" }}>
                      <span style={{ fontSize: 13 }}>{c.categoria}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--muted)" }}>{money(c.actual)}</span>
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
              {catMasCrecio && reportOn("catCrecio") && (
                <div className="soft" style={{ background: "linear-gradient(135deg, var(--surface), var(--red-dim, var(--surface-alt)))", borderColor: "var(--red)22" }}>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 6 }}>Categoría que más creció</div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 14, fontWeight: 700 }}>{catMasCrecio.categoria}</span>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--red)", fontFamily: "var(--font-mono)" }}>{money(catMasCrecio.actual)}</div>
                      <div style={{ fontSize: 10, color: "var(--red)" }}>↑{catMasCrecio.deltaPct}% vs anterior</div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ══ PERÍODOS ══ */}
          {sub === "periodos" && periodo && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                <Stat label="Sueldo" value={money(periodo.sueldo)} color="var(--green)" />
                <Stat label="Extras" value={periodo.extras > 0 ? money(periodo.extras) : "—"} color="var(--green)" />
                <Stat label="Gastado" value={money(periodo.gastado)} sub={`${periodo.pct}%`} color={colorPct(periodo.pct)} />
                <Stat label="Disponible" value={money(periodo.disponible)} color={periodo.disponible >= 0 ? "var(--green)" : "var(--red)"} />
                <Stat label="Ahorros" value={periodo.ahorros > 0 ? money(periodo.ahorros) : "—"} color="var(--blue)" />
                <Stat label="Resto" value={periodo.resto > 0 ? money(periodo.resto) : "—"} />
                {promedioAhorro > 0 && <Stat label="Prom. ahorro" value={money(promedioAhorro)} sub="por período" color="var(--blue)" />}
                {evolSueldo && reportOn("evolSueldo") && <Stat label="Evolución sueldo" value={`${evolSueldo.deltaPct !== null ? (evolSueldo.deltaPct >= 0 ? "+" : "") + evolSueldo.deltaPct + "%" : "—"}`} sub={money(evolSueldo.delta)} color={evolSueldo.delta >= 0 ? "var(--green)" : "var(--red)"} />}
              </div>

              {(mejorPer || peorPer) && reportOn("mejorPeor") && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                  {mejorPer && (
                    <div className="soft" style={{ background: "linear-gradient(135deg, var(--surface), var(--green-dim))", borderColor: "var(--green)22" }}>
                      <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>Mejor período</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--green)" }}>{shortPer(mejorPer.periodoId)}</div>
                      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>{mejorPer.pct}% gastado</div>
                    </div>
                  )}
                  {peorPer && (
                    <div className="soft" style={{ background: "linear-gradient(135deg, var(--surface), var(--red-dim, var(--surface-alt)))", borderColor: "var(--red)22" }}>
                      <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>Peor período</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--red)" }}>{shortPer(peorPer.periodoId)}</div>
                      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>{peorPer.pct}% gastado</div>
                    </div>
                  )}
                </div>
              )}

              <div className="soft">
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Todos los períodos</div>
                {periodos.map((p) => {
                  const isAct = activos.includes(p.periodoId);
                  return (
                    <div key={p.periodoId} onClick={() => {
                      setPeriodosSelIds(isAct
                        ? activos.filter((id) => id !== p.periodoId)
                        : [...activos, p.periodoId]
                      );
                    }} style={{ padding: "11px 0", borderBottom: "1px solid var(--faint)", cursor: "pointer" }}>
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
              {/* Newest first para VBars */}
              {(() => {
                const serieDesc = [...serie].reverse();
                return (
                  <>
                    <div className="soft" style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Gastado por período</div>
                      <VBars max={maxTotal} oculto={oculto} data={serieDesc.map((s) => ({ label: shortPer(s.periodoId), value: s.gastado, color: colorPct(s.total > 0 ? Math.round((s.gastado / s.total) * 100) : 0), hi: activos.includes(s.periodoId) }))} />
                    </div>

                    {(() => {
                      const ultimo = serie[serie.length - 1];
                      const anterior = serie[serie.length - 2];
                      const delta = anterior ? ultimo.ahorrosAcum - anterior.ahorrosAcum : null;
                      const deltaPct = anterior && anterior.ahorrosAcum > 0 ? Math.round((delta! / anterior.ahorrosAcum) * 100) : null;
                      const deltaColor = delta !== null && delta >= 0 ? "var(--green)" : "var(--red)";
                      return (
                        <div className="soft" style={{ marginBottom: 12, background: "linear-gradient(135deg, var(--surface), var(--blue-dim))", borderColor: "var(--blue)33" }}>
                          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>Ahorros acumulados</div>
                          <div style={{ fontSize: 32, fontWeight: 700, color: "var(--blue)", fontFamily: "var(--font-mono)", letterSpacing: -1, lineHeight: 1 }}>
                            {money(ultimo.ahorrosAcum)}
                          </div>
                          {delta !== null && (
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
                              <span style={{ fontSize: 13, fontWeight: 700, color: deltaColor, fontFamily: "var(--font-mono)" }}>
                                {delta >= 0 ? "+" : ""}{money(delta)}
                              </span>
                              {deltaPct !== null && (
                                <span style={{ fontSize: 11, color: deltaColor }}>
                                  ({deltaPct >= 0 ? "+" : ""}{deltaPct}% vs {shortPer(anterior!.periodoId)})
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    <div className="soft" style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Sueldo por período</div>
                      <VBars max={maxSueldo} oculto={oculto} data={serieDesc.map((s) => ({ label: shortPer(s.periodoId), value: s.sueldo, color: "var(--green)" }))} />
                    </div>

                    {reportOn("disponible") && (
                    <div className="soft" style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Disponible por período</div>
                      <VBars max={maxDisp} oculto={oculto} data={serieDesc.map((s) => ({ label: shortPer(s.periodoId), value: Math.max(0, s.disponible), color: s.disponible >= 0 ? "var(--blue)" : "var(--red)" }))} />
                    </div>
                    )}

                    {/* Proyección ahorros */}
                    {serie.length >= 2 && reportOn("proyeccion") && (
                      <div className="soft" style={{ marginBottom: 12, background: "linear-gradient(135deg, var(--surface), var(--blue-dim))", borderColor: "var(--blue)33" }}>
                        <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 10 }}>Proyección ahorros acumulados</div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                          {[3, 6, 12].map((n) => (
                            <div key={n} style={{ textAlign: "center", padding: "10px 4px", background: "var(--faint)", borderRadius: "var(--radius-sm)" }}>
                              <div style={{ fontSize: 9, color: "var(--muted)", marginBottom: 6 }}>{n} períodos</div>
                              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--blue)", fontFamily: "var(--font-mono)" }}>{money(proyectarAhorros(serie, n))}</div>
                            </div>
                          ))}
                        </div>
                        <div style={{ fontSize: 9, color: "var(--muted)", marginTop: 8 }}>Basado en el promedio de ahorro histórico</div>
                      </div>
                    )}

                    {/* Períodos para meta USD */}
                    {periodosParaMeta !== null && cotizActual && reportOn("paraMeta") && (
                      <div className="soft" style={{ marginBottom: 12 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                          <div style={{ fontSize: 11, color: "var(--muted)" }}>Períodos para meta USD</div>
                          <div style={{ fontSize: 10, color: "var(--yellow)" }}>U$D {metaUSD}</div>
                        </div>
                        <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "var(--font-mono)", letterSpacing: -0.5, marginTop: 8 }}>
                          {periodosParaMeta === 0 ? "¡Meta alcanzada!" : `${periodosParaMeta} períodos`}
                        </div>
                        <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>
                          a ritmo actual · blue ${cotizActual.toLocaleString("es-AR")}
                        </div>
                      </div>
                    )}

                    {/* Ritmo de ahorro actual */}
                    {metaPorPeriodo && reportOn("ritmoAhorro") && (
                      <div className="soft" style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 8 }}>Ritmo de ahorro actual</div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                          <div style={{ fontSize: 24, fontWeight: 700, color: "var(--blue)", fontFamily: "var(--font-mono)" }}>{money(ritmoAhorro)}</div>
                          <div style={{ fontSize: 10, color: ritmoAhorro >= metaPorPeriodo ? "var(--green)" : "var(--yellow)" }}>
                            {ritmoAhorro >= metaPorPeriodo ? "✓ Cumple meta" : `${((ritmoAhorro / metaPorPeriodo) * 100).toFixed(0)}% de meta`}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Progreso meta USD */}
                    {progresoMeta !== null && reportOn("progreso") && (
                      <div className="soft" style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 8 }}>Progreso meta USD</div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                          <div style={{ fontSize: 20, fontWeight: 700, color: "var(--yellow)", fontFamily: "var(--font-mono)" }}>{progresoMeta}%</div>
                          <span className="badge" style={{ background: progresoMeta >= 100 ? "var(--green-dim)" : "var(--yellow-dim)", color: progresoMeta >= 100 ? "var(--green)" : "var(--yellow)", border: `1px solid ${progresoMeta >= 100 ? "var(--green)" : "var(--yellow)"}44` }}>
                            {progresoMeta >= 100 ? "ALCANZADA" : `U$D ${metaMonto}`}
                          </span>
                        </div>
                        <div className="progress-track"><div className="progress-fill" style={{ width: `${Math.min(progresoMeta, 100)}%`, background: progresoMeta >= 100 ? "var(--green)" : "var(--yellow)" }} /></div>
                      </div>
                    )}

                    {/* Períodos para meta USD */}
                    {periodosParaMetaMonto !== null && reportOn("periodosParaMeta") && (
                      <div className="soft" style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 6 }}>Períodos para alcanzar meta USD</div>
                        <div style={{ fontSize: 24, fontWeight: 700, color: "var(--yellow)", fontFamily: "var(--font-mono)" }}>
                          {periodosParaMetaMonto === 0 ? "¡Alcanzada!" : `${periodosParaMetaMonto} períodos`}
                        </div>
                      </div>
                    )}

                    {/* Ahorros vs Proyectados */}
                    {datosAhorrosVsProyectados.length > 0 && reportOn("ahorrosVsProyectados") && (
                      <div className="soft" style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Ahorros vs Proyectados</div>
                        {datosAhorrosVsProyectados.slice(-5).map((item: AhorroVsProyectado) => (
                          <div key={item.periodoId} style={{ marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
                            <span style={{ color: "var(--muted)" }}>{shortPer(item.periodoId)}</span>
                            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                              <span style={{ fontFamily: "var(--font-mono)", color: "var(--text)" }}>{money(item.real)}</span>
                              <span style={{ fontSize: 10, color: item.delta >= 0 ? "var(--green)" : "var(--red)", fontWeight: 700 }}>
                                {item.delta >= 0 ? "+" : ""}{money(item.delta)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Consistencia */}
                    {consistencia && reportOn("consistencia") && (
                      <div className="soft" style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 8 }}>Consistencia de ahorro</div>
                        <div style={{ fontSize: 20, fontWeight: 700, color: "var(--blue)", fontFamily: "var(--font-mono)", marginBottom: 6 }}>
                          {consistencia.cumplidos}/{consistencia.total}
                        </div>
                        <div style={{ fontSize: 10, color: "var(--muted)" }}>
                          {Math.round((consistencia.cumplidos / consistencia.total) * 100)}% de períodos alcanzaron la meta
                        </div>
                      </div>
                    )}

                    {/* Insights */}
                    {insights.length > 0 && reportOn("insights") && (
                      <div className="soft">
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Insights</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {insights.map((ins, i) => (
                            <div key={i} style={{
                              display: "flex", alignItems: "flex-start", gap: 10,
                              padding: "10px 12px", borderRadius: "var(--radius-sm)",
                              background: ins.tipo === "good" ? "var(--green-dim)" : ins.tipo === "warn" ? "rgba(255,80,80,0.08)" : "var(--faint)",
                              border: `1px solid ${ins.tipo === "good" ? "var(--green)33" : ins.tipo === "warn" ? "var(--red)33" : "var(--border)"}`,
                            }}>
                              <span style={{ fontSize: 13 }}>{ins.tipo === "good" ? "↑" : ins.tipo === "warn" ? "↓" : "·"}</span>
                              <span style={{ fontSize: 12, color: "var(--text)", lineHeight: 1.4 }}>
                                {ins.valor !== undefined
                                  ? ins.texto.replace("{n}", money(ins.valor))
                                  : ins.texto}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </>
          )}
        </div>
      )}

      {/* Modal: Todos los top gastos/descripciones */}
      {modalTop && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 200,
          display: "flex", alignItems: "flex-end", overflow: "hidden",
        }} onClick={() => setModalTop(null)}>
          <div style={{
            width: "100%", background: "var(--bg)", borderRadius: "20px 20px 0 0",
            height: "90dvh", overflowY: "auto", padding: 20, paddingBottom: 40,
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <span style={{ fontSize: 16, fontWeight: 700 }}>
                {modalTop === "gastos" ? "Top 20 gastos" : "Todas las descripciones"}
              </span>
              <button onClick={() => setModalTop(null)} style={{
                background: "var(--surface-alt)", border: "none", width: 32, height: 32,
                borderRadius: "50%", color: "var(--muted)", cursor: "pointer", fontSize: 18,
              }}>×</button>
            </div>
            {modalTop === "gastos" && topTodos.map((m, i) => (
              <div key={m.id} className="row" style={{ padding: "12px 0" }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", minWidth: 0 }}>
                  <span style={{ fontSize: 12, color: "var(--muted)", fontFamily: "var(--font-mono)", width: 14 }}>{i + 1}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.descripcion || m.categoria}</div>
                    <div style={{ fontSize: 10, color: "var(--muted)" }}>{m.categoria} · {sinAño(m.fecha)}</div>
                  </div>
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--red)", fontFamily: "var(--font-mono)", whiteSpace: "nowrap" }}>{money(m.monto)}</span>
              </div>
            ))}
            {modalTop === "descs" && descsModal.map((d, i) => (
              <div key={d.nombre} className="row" style={{ padding: "12px 0" }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", minWidth: 0 }}>
                  <span style={{ fontSize: 12, color: "var(--muted)", fontFamily: "var(--font-mono)", width: 14 }}>{i + 1}</span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13 }}>{d.nombre || "—"}</div>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--yellow)", fontFamily: "var(--font-mono)" }}>{money(d.monto)}</div>
                  <div style={{ fontSize: 10, color: "var(--muted)" }}>{d.pct}%</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
