"use client";

import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useT } from "@/hooks/useTranslation";
import { useFirstVisit } from "@/hooks/useFirstVisit";
import { useInflacionIPC } from "@/hooks/useInflacionIPC";
import { SectionHint } from "@/components/ui/SectionHint";
import { useData } from "../data-context";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/services/firebase/firebase";
import { agruparPorPeriodo, gastosPorCategoria, formatARS } from "@/utils/periodo";
import { obtenerPresupuesto, guardarPresupuesto } from "@/services/firebase/presupuestos";
import { useMoney, MASK } from "@/hooks/useHideValues";
import {
  gastosPorMedioPago, gastosPorDescripcion, gastosPorFecha,
  kpisPeriodo, ritmoGasto, comparativaCategorias,
  serieTendencia, parsePeriodoId, diasSinGastos,
  historialSueldo, proyectarAhorros,
  progresoMetaUSD, periodosParaMetaUSD, estadisticasPeriodos, esGasto,
} from "@/utils/reportes";
import { useCotizacion } from "@/hooks/useCotizacion";
import { useAppPrefs } from "@/hooks/useAppPrefs";
import { EyeIcon } from "@/components/ui/EyeIcon";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { MiniStat } from "@/components/ui/MiniStat";
import { KpiInfoModal } from "@/components/ui/KpiInfoModal";
import { BottomSheet } from "@/components/ui/BottomSheet";

type Sub = "gastos" | "ingresos" | "movimientos" | "periodos";

const periodoAnio = (periodoId: string) => periodoId.split("/")[2] ?? "??";

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
function Bar({ nombre, monto, pct, color = "var(--accent)", oculto, presupuesto, onClick }: { nombre: string; monto: number; pct: number; color?: string; oculto?: boolean; presupuesto?: number; onClick?: () => void }) {
  const hasBudget = !!presupuesto && presupuesto > 0;
  const usedPct = hasBudget ? Math.round((monto / presupuesto!) * 100) : 0;
  const budgetColor = usedPct > 100 ? "var(--red)" : usedPct > 80 ? "var(--yellow)" : "var(--green)";
  const barColor = hasBudget ? budgetColor : color;
  const barWidth = hasBudget ? Math.min(usedPct, 100) : Math.min(pct, 100);
  // En modo presupuesto los números muestran el delta: cuánto se pasó (+) o falta (−).
  const deltaMonto = monto - (presupuesto ?? 0);
  const deltaPct = usedPct - 100;
  return (
    <div style={{ marginBottom: 13, cursor: onClick ? "pointer" : "default" }} onClick={onClick}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 1, gap: 10 }}>
        <span style={{ fontSize: 13, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{nombre}</span>
        <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--text)", whiteSpace: "nowrap" }}>
          {hasBudget ? (
            oculto ? MASK : <>{deltaMonto >= 0 ? "+" : "−"}{formatARS(Math.abs(deltaMonto))} <span style={{ fontSize: 11, color: budgetColor, fontWeight: 600 }}>{deltaPct >= 0 ? "+" : "−"}{Math.abs(deltaPct)}%</span></>
          ) : (
            <>{oculto ? MASK : formatARS(monto)} <span style={{ color: "var(--muted)", fontSize: 11 }}>{pct}%</span></>
          )}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 7 }}>
        <div style={{ flex: 1, height: 8, background: "var(--faint)", borderRadius: 999, overflow: "hidden" }}>
          <div style={{ height: "100%", borderRadius: 999, transition: "width 0.5s ease", width: `${barWidth}%`, background: barColor }} />
        </div>
        {hasBudget && !oculto && (
          <span style={{ fontSize: 10, color: "var(--muted)", fontFamily: "var(--font-mono)", flexShrink: 0, fontWeight: 600 }}>{abbr(presupuesto!)}</span>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, sub, color, danger, dimVar }: { label: string; value: string; sub?: string; color?: string; danger?: boolean; dimVar?: string }) {
  const cardStyle = danger
    ? { borderColor: "var(--red)66", background: "linear-gradient(135deg, var(--surface), var(--red-dim, var(--surface-alt)))" }
    : dimVar
    ? { background: `linear-gradient(135deg, var(--surface), ${dimVar})`, ...(color ? { borderColor: `${color}22` } : {}) }
    : {};
  return (
    <div className="soft" style={{ padding: 15, ...cardStyle }}>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 7 }}>{label}</div>
      <div style={{ fontSize: 19, fontWeight: 700, color: color ?? "var(--text)", fontFamily: "var(--font-mono)", lineHeight: 1.05 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function DonutChart({ data, size = 80, strokeWidth = 13, selected, onSelect }: {
  data: { value: number; color: string; key: string; label: string }[];
  size?: number; strokeWidth?: number;
  selected?: string | null;
  onSelect?: (key: string | null) => void;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return null;
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const cx = size / 2;
  let acc = 0;
  const sel = selected ? data.find(d => d.key === selected) : null;
  const ariaSummary = data.filter(d => d.value > 0)
    .map(d => `${d.label} ${Math.round((d.value / total) * 100)}%`).join(", ");
  return (
    <div role="img" aria-label={ariaSummary} style={{ position: "relative", width: size, height: size, flexShrink: 0 }} onClick={() => onSelect?.(null)}>
      <svg width={size} height={size} aria-hidden="true" style={{ transform: "rotate(-90deg)" }}>
        {data.filter(d => d.value > 0).map(({ value, color, key }, i) => {
          const dash = (value / total) * c;
          const offset = -acc;
          acc += dash;
          return <circle key={i} cx={cx} cy={cx} r={r} fill="none" stroke={color} strokeWidth={strokeWidth}
            strokeDasharray={`${dash} ${c - dash}`} strokeDashoffset={offset}
            opacity={selected && selected !== key ? 0.2 : 1}
            style={{ cursor: "pointer", transition: "opacity 0.2s" }}
            onClick={(e) => { e.stopPropagation(); onSelect?.(selected === key ? null : key); }} />;
        })}
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none", gap: 1 }}>
        {sel ? (
          <div style={{ fontSize: 18, fontWeight: 700, color: sel.color, fontFamily: "var(--font-mono)", lineHeight: 1 }}>{Math.round((sel.value / total) * 100)}%</div>
        ) : null}
      </div>
    </div>
  );
}

// Mini-stat compacto, fondo neutro, color sólo en el número.
function VBars({ data, max, oculto, refFrac, onBarClick }: { data: { label: string; value: number; color: string; hi?: boolean; best?: boolean; worst?: boolean; valueLabel?: string; periodoId?: string }[]; max: number; oculto?: boolean; refFrac?: number; onBarClick?: (periodoId: string) => void }) {
  return (
    <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, alignItems: "flex-end", scrollbarWidth: "none" }}>
      {data.map((d, i) => {
        const clickable = !!(onBarClick && d.periodoId);
        const Comp: "button" | "div" = clickable ? "button" : "div";
        return (
        <Comp key={i} type={clickable ? "button" : undefined}
          onClick={() => d.periodoId && onBarClick?.(d.periodoId)}
          aria-label={clickable ? `${shortPer(d.label)}: ${oculto ? "" : (d.valueLabel ?? abbr(d.value))}` : undefined}
          style={{ flexShrink: 0, width: 36, display: "flex", flexDirection: "column", alignItems: "center", gap: 5, cursor: clickable ? "pointer" : "default", background: "transparent", border: "none", padding: 0, font: "inherit" }}>
          <div style={{ fontSize: 8, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>{oculto ? "•" : (d.valueLabel ?? abbr(d.value))}</div>
          <div style={{ height: 96, width: 20, background: "var(--faint)", borderRadius: 7, display: "flex", alignItems: "flex-end", overflow: "hidden", position: "relative" }}>
            {refFrac != null && <div style={{ position: "absolute", left: 0, right: 0, bottom: `${Math.round(refFrac * 96)}px`, height: 1, background: "var(--text)44", zIndex: 1 }} />}
            <div style={{ width: "100%", height: `${max > 0 ? Math.round((d.value / max) * 100) : 0}%`, background: d.color, borderRadius: 7, transition: "height .5s ease" }} />
          </div>
          <div style={{ fontSize: 8, fontWeight: (d.best || d.worst || d.hi) ? 700 : 400, color: d.best ? "var(--green)" : d.worst ? "var(--red)" : d.hi ? "var(--accent)" : "var(--muted)" }}>{shortPer(d.label)}</div>
        </Comp>
        );
      })}
    </div>
  );
}

type DotDatum = { label: string; value: number; color: string; hi?: boolean; periodoId?: string };

// Gráfico de puntos conectados por una línea de tendencia, con escala automática al
// rango de datos. Soporta una línea de referencia (refValue: 0 para inflación, 100
// para gasto/sueldo) y una segunda serie opcional (series2, p.ej. IPC país).
function DotChart({ data, refValue, series2, series2Color, signed, onPointClick }: {
  data: DotDatum[];
  refValue?: number;
  series2?: (number | null)[];
  series2Color?: string;
  signed?: boolean;
  onPointClick?: (periodoId: string) => void;
}) {
  const topPad = 16, botPad = 16, chartH = 92, PX = 46;
  const s2vals = (series2 ?? []).filter((v): v is number => v != null);
  const all = [...data.map((d) => d.value), ...(refValue != null ? [refValue] : []), ...s2vals];
  let min = Math.min(...all), max = Math.max(...all);
  if (min === max) { min -= 1; max += 1; }
  const pad = (max - min) * 0.18; min -= pad; max += pad;
  const W = Math.max(data.length * PX, PX);
  const totalH = topPad + chartH + botPad;
  const y = (v: number) => topPad + chartH - ((v - min) / (max - min)) * chartH;
  const fmt = (v: number) => `${signed && v >= 0 ? "+" : ""}${v}%`;
  const pts = data.map((d, i) => ({ x: i * PX + PX / 2, y: y(d.value), d }));
  const linePts = pts.map((p) => `${p.x},${p.y}`).join(" ");
  const s2pts = series2 ? series2.map((v, i) => v == null ? null : `${i * PX + PX / 2},${y(v)}`).filter(Boolean).join(" ") : "";
  return (
    <div style={{ overflowX: "auto", scrollbarWidth: "none" }}>
      <svg width={W} height={totalH} style={{ display: "block" }}>
        {refValue != null && <line x1={0} x2={W} y1={y(refValue)} y2={y(refValue)} style={{ stroke: "var(--border-hi)" }} strokeWidth={1} strokeDasharray="3 3" />}
        {s2pts && <polyline points={s2pts} fill="none" style={{ stroke: series2Color ?? "var(--accent)" }} strokeWidth={1.5} strokeDasharray="4 3" opacity={0.85} />}
        {pts.length > 1 && <polyline points={linePts} fill="none" style={{ stroke: "var(--border-hi)" }} strokeWidth={1.5} opacity={0.45} />}
        {series2 && pts.map((p, i) => { const v = series2[i]; return v == null ? null : <circle key={`s2-${i}`} cx={p.x} cy={y(v)} r={2.5} style={{ fill: series2Color ?? "var(--accent)" }} />; })}
        {pts.map((p, i) => {
          const clickable = !!(onPointClick && p.d.periodoId);
          return (
            <g key={i} onClick={() => p.d.periodoId && onPointClick?.(p.d.periodoId)} style={{ cursor: clickable ? "pointer" : "default" }}>
              <text x={p.x} y={p.y - 9} textAnchor="middle" fontSize={8} fontFamily="var(--font-mono)" style={{ fill: "var(--muted)" }}>{fmt(p.d.value)}</text>
              <circle cx={p.x} cy={p.y} r={5} style={{ fill: p.d.color, stroke: "var(--surface)" }} strokeWidth={1.5} />
              <text x={p.x} y={totalH - 4} textAnchor="middle" fontSize={8} fontWeight={p.d.hi ? 700 : 400} style={{ fill: p.d.hi ? "var(--accent)" : "var(--muted)" }}>{p.d.label}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// Gráfico de área (línea rellena), escala automática al rango de datos. Usado para días.
function AreaChart({ data, onPointClick }: { data: { label: string; value: number; color: string; hi?: boolean; valueLabel?: string; periodoId?: string }[]; onPointClick?: (periodoId: string) => void }) {
  const topPad = 16, botPad = 16, chartH = 92, PX = 46;
  let min = Math.min(...data.map((d) => d.value)), max = Math.max(...data.map((d) => d.value));
  if (min === max) { min -= 1; max += 1; }
  const padv = (max - min) * 0.18; min -= padv; max += padv;
  const W = Math.max(data.length * PX, PX);
  const totalH = topPad + chartH + botPad;
  const baseY = topPad + chartH;
  const y = (v: number) => topPad + chartH - ((v - min) / (max - min)) * chartH;
  const pts = data.map((d, i) => ({ x: i * PX + PX / 2, y: y(d.value), d }));
  const linePts = pts.map((p) => `${p.x},${p.y}`).join(" ");
  const areaPts = pts.length ? `${pts[0].x},${baseY} ${linePts} ${pts[pts.length - 1].x},${baseY}` : "";
  return (
    <div style={{ overflowX: "auto", scrollbarWidth: "none" }}>
      <svg width={W} height={totalH} style={{ display: "block" }}>
        {pts.length > 0 && <polygon points={areaPts} style={{ fill: "var(--accent)" }} opacity={0.14} />}
        {pts.length > 1 && <polyline points={linePts} fill="none" style={{ stroke: "var(--accent)" }} strokeWidth={2} />}
        {pts.map((p, i) => {
          const clickable = !!(onPointClick && p.d.periodoId);
          return (
            <g key={i} onClick={() => p.d.periodoId && onPointClick?.(p.d.periodoId)} style={{ cursor: clickable ? "pointer" : "default" }}>
              <text x={p.x} y={p.y - 9} textAnchor="middle" fontSize={8} fontFamily="var(--font-mono)" style={{ fill: "var(--muted)" }}>{p.d.valueLabel ?? p.d.value}</text>
              <circle cx={p.x} cy={p.y} r={4} style={{ fill: p.d.color, stroke: "var(--surface)" }} strokeWidth={1.5} />
              <text x={p.x} y={totalH - 4} textAnchor="middle" fontSize={8} fontWeight={p.d.hi ? 700 : 400} style={{ fill: p.d.hi ? "var(--accent)" : "var(--muted)" }}>{p.d.label}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// Dos líneas acumuladas (serie A = vos, serie B = país) para comparar la inflación
// acumulada propia vs la del país a lo largo de los períodos.
function TwoLineChart({ points, colorA, onPointClick }: {
  points: { label: string; a: number; b: number | null; hi?: boolean; periodoId?: string }[];
  colorA: string;
  onPointClick?: (periodoId: string) => void;
}) {
  const topPad = 16, botPad = 16, chartH = 100, PX = 46;
  const bs = points.map((p) => p.b).filter((v): v is number => v != null);
  const all = [0, ...points.map((p) => p.a), ...bs];
  let min = Math.min(...all), max = Math.max(...all);
  if (min === max) { min -= 1; max += 1; }
  const pad = (max - min) * 0.15; min -= pad; max += pad;
  const W = Math.max(points.length * PX, PX);
  const totalH = topPad + chartH + botPad;
  const y = (v: number) => topPad + chartH - ((v - min) / (max - min)) * chartH;
  const aPts = points.map((p, i) => ({ x: i * PX + PX / 2, y: y(p.a), p }));
  const aLine = aPts.map((p) => `${p.x},${p.y}`).join(" ");
  const bLine = points.map((p, i) => p.b == null ? null : `${i * PX + PX / 2},${y(p.b)}`).filter(Boolean).join(" ");
  return (
    <div style={{ overflowX: "auto", scrollbarWidth: "none" }}>
      <svg width={W} height={totalH} style={{ display: "block" }}>
        {min < 0 && max > 0 && <line x1={0} x2={W} y1={y(0)} y2={y(0)} style={{ stroke: "var(--border-hi)" }} strokeWidth={1} strokeDasharray="3 3" />}
        {bLine && <polyline points={bLine} fill="none" style={{ stroke: "var(--accent)" }} strokeWidth={2} strokeDasharray="4 3" />}
        {aPts.length > 1 && <polyline points={aLine} fill="none" style={{ stroke: colorA }} strokeWidth={2} />}
        {points.map((p, i) => p.b == null ? null : <circle key={`b-${i}`} cx={i * PX + PX / 2} cy={y(p.b)} r={3} style={{ fill: "var(--accent)" }} />)}
        {aPts.map((p, i) => {
          const clickable = !!(onPointClick && p.p.periodoId);
          return (
            <g key={i} onClick={() => p.p.periodoId && onPointClick?.(p.p.periodoId)} style={{ cursor: clickable ? "pointer" : "default" }}>
              <circle cx={p.x} cy={p.y} r={4} style={{ fill: colorA, stroke: "var(--surface)" }} strokeWidth={1.5} />
              <text x={p.x} y={totalH - 4} textAnchor="middle" fontSize={8} fontWeight={p.p.hi ? 700 : 400} style={{ fill: p.p.hi ? "var(--accent)" : "var(--muted)" }}>{p.p.label}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ── Página ───────────────────────────────────────────────────────────────────
export default function ReportesPage() {
  const t = useT();
  const SUBS: { id: Sub; label: string }[] = [
    { id: "gastos",       label: t.tabExpenses },
    { id: "ingresos",     label: t.tabIncome },
    { id: "movimientos",  label: t.tabMovements },
    { id: "periodos",     label: t.tabPeriods },
  ];
  const { user } = useAuth();
  const { oculto, toggle, m: money } = useMoney();
  const { movimientos, loading, config } = useData();
  const { cotizacion } = useCotizacion();
  const reportOn = (_id: string) => true;
  const TIPO_COLOR: Record<string, string> = {
    Gasto: "var(--red)", Ingreso: "var(--green)",
    Move: "var(--purple)", MoveAhorro: "var(--purple)", MoveDisponible: "#26c6da",
    CompraUSD: "var(--yellow)", CompraEUR: "var(--yellow)",
    GastoUSD: "var(--red)", GastoEUR: "var(--red)",
    VentaUSD: "var(--red)", VentaEUR: "var(--red)",
  };
  const { monedaInversiones, monedaPrincipal } = useAppPrefs();
  const [showHint, dismissHint] = useFirstVisit("reports");

  const periodos = useMemo(() => agruparPorPeriodo(movimientos), [movimientos]);
  const [sub, setSub] = useState<Sub>("gastos");
  const [periodosSelIds, setPeriodosSelIds] = useState<string[]>([]);
  const [modalTop, setModalTop] = useState<"gastos" | "descs" | "movcat" | null>(null);
  const [kpiInfo, setKpiInfo] = useState<{ title: string; value: string; explain: string; color?: string } | null>(null);
  const [navPeriodo, setNavPeriodo] = useState<{ periodoId: string; target: Sub } | null>(null);
  const [modalSueldo, setModalSueldo] = useState(false);
  const [modalAhorros, setModalAhorros] = useState(false);
  const [diaModal, setDiaModal] = useState<string | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [presupuesto, setPresupuesto] = useState<Record<string, number> | null>(null);
  const [showBudget, setShowBudget] = useState(false);
  const [modalBudget, setModalBudget] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Record<string, string>>({});
  const [budgetSaving, setBudgetSaving] = useState(false);
  const [catModal, setCatModal] = useState<string | null>(null);
  const [medioModal, setMedioModal] = useState<string | null>(null);
  const [periodMetric, setPeriodMetric] = useState<"gasto" | "ingreso" | "dias" | "gastoSueldo" | "inflacion">("gasto");
  const { deflatar, ipcVar, ipcMensualUltimo } = useInflacionIPC();
  const [selectedMovTipo, setSelectedMovTipo] = useState<string | null>(null);

  // Multi-select: si no hay selección, usa el primero
  const activos = periodosSelIds.length > 0 ? periodosSelIds : [periodos[0]?.periodoId].filter(Boolean);
  const periodosActivos = periodos.filter((p) => activos.includes(p.periodoId));
  // Tendencia y proyección sólo tienen sentido en el período vigente (el más reciente).
  const esPeriodoVigente = activos.length === 1 && activos[0] === periodos[0]?.periodoId;

  // Combina todos los períodos seleccionados en uno virtual
  const periodo = periodosActivos.length > 0 ? {
    periodoId: activos.length === 1 ? activos[0]! : t.virtualPeriods(activos.length),
    sueldo: periodosActivos.reduce((sum, p) => sum + p.sueldo, 0),
    extras: periodosActivos.reduce((sum, p) => sum + p.extras, 0),
    total: periodosActivos.reduce((sum, p) => sum + p.total, 0),
    gastado: periodosActivos.reduce((sum, p) => sum + p.gastado, 0),
    gastadoPuro: periodosActivos.reduce((sum, p) => sum + p.gastadoPuro, 0),
    ahorros: periodosActivos.reduce((sum, p) => sum + p.ahorros, 0),
    resto: periodosActivos.reduce((sum, p) => sum + p.resto, 0),
    disponible: periodosActivos.reduce((sum, p) => sum + p.disponible, 0),
    moveDisponible: periodosActivos.reduce((sum, p) => sum + p.moveDisponible, 0),
    moveAhorros: periodosActivos.reduce((sum, p) => sum + p.moveAhorros, 0),
    pct: periodosActivos.length > 0 ? Math.round((periodosActivos.reduce((sum, p) => sum + p.gastado, 0) / periodosActivos.reduce((sum, p) => sum + p.total, 0)) * 100) : 0,
    movimientos: periodosActivos.flatMap((p) => p.movimientos),
  } : undefined;

  // Para comparativa y ritmo, usa el primer período (sólo si es un período individual)
  const idx1 = activos.length === 1 && activos[0] ? periodos.findIndex((p) => p.periodoId === activos[0]) : -1;
  const anterior = idx1 >= 0 ? periodos[idx1 + 1] : undefined;
  // finPeriodo = inicio del período siguiente (si existe), para cerrar el intervalo correctamente
  const finPeriodo = idx1 > 0 ? parsePeriodoId(periodos[idx1 - 1].periodoId) : null;

  const colorPct = (pct: number) => pct > 90 ? "var(--red)" : pct > 50 ? "var(--yellow)" : "var(--green)";

  // ── Cálculos del período seleccionado (sub Gastos) ──
  const cats = periodo ? gastosPorCategoria(periodo.movimientos, periodo.gastado) : [];
  const medios = periodo ? gastosPorMedioPago(periodo.movimientos, periodo.gastado) : [];
  const descs = periodo ? gastosPorDescripcion(periodo.movimientos, periodo.gastado, 5) : [];
  const descsModal = periodo ? gastosPorDescripcion(periodo.movimientos, periodo.gastado, 20) : [];
  // Descripciones que provienen de compras de divisa → su barra va en amarillo (el resto, gasto → rojo).
  const descsCompra = useMemo(() => {
    const s = new Set<string>();
    for (const m of (periodo?.movimientos ?? [])) {
      if (m.tipo === "CompraUSD" || m.tipo === "CompraEUR") s.add(m.descripcion || "—");
    }
    return s;
  }, [periodo]);
  const esCatCompra = (cat: string) => cat === "CompraUSD" || cat === "CompraEUR";
  const porFecha = periodo ? gastosPorFecha(periodo.movimientos, periodo.gastado) : [];
  // Split por día: gasto (rojo) vs compra USD (amarillo). Clave = fecha original.
  const splitPorFecha = useMemo(() => {
    const map = new Map<string, { gasto: number; compra: number }>();
    if (periodo) for (const m of periodo.movimientos) {
      if (!esGasto(m)) continue;
      const k = m.fecha || "—";
      const cur = map.get(k) ?? { gasto: 0, compra: 0 };
      if (m.tipo === "CompraUSD") cur.compra += m.monto; else cur.gasto += m.monto;
      map.set(k, cur);
    }
    return map;
  }, [periodo]);
  const kpis = periodo ? kpisPeriodo(periodo) : null;
  // Ritmo y comparativa sólo aplican a un período individual
  const ritmo = periodo && activos.length === 1 ? ritmoGasto(periodo, finPeriodo) : null;
  const comp = periodo && activos.length === 1 ? comparativaCategorias(periodo, anterior) : [];

  // ── Estadísticas avanzadas (Gastos) ──
  const promPorMov = periodo ? (() => {
    const n = periodo.movimientos.filter((m) => m.tipo === "Gasto").length;
    return n > 0 ? periodo.gastadoPuro / n : null;
  })() : null;
  const diasLibres = periodo ? (() => {
    if (activos.length === 1) {
      const start = parsePeriodoId(activos[0]!);
      const end = finPeriodo ?? new Date();
      return diasSinGastos(periodo.movimientos, start, end);
    }
    const agg = periodosActivos.map((p, i) => {
      const start = parsePeriodoId(p.periodoId);
      const idxInAll = periodos.findIndex((x) => x.periodoId === p.periodoId);
      const end = idxInAll > 0 ? parsePeriodoId(periodos[idxInAll - 1].periodoId) : new Date();
      return diasSinGastos(p.movimientos, start, end);
    });
    return { sinGasto: agg.reduce((s, d) => s + d.sinGasto, 0), total: agg.reduce((s, d) => s + d.total, 0) };
  })() : null;
  const catMasCrecio = comp.filter((c) => c.deltaPct !== null && c.deltaPct > 0).sort((a, b) => (b.deltaPct ?? 0) - (a.deltaPct ?? 0))[0] ?? null;


  // ── Ingresos ──
  // Ingresos a disponible (Sueldo + Extras). Moves son transferencias internas.
  const movIngresos = periodo
    ? periodo.movimientos
        .filter((m) =>
          m.tipo === "Ingreso" && m.categoria !== "Ahorros" && m.categoria !== "RESTO"
        )
        .sort((a, b) => b.monto - a.monto)
    : [];

  // Ingresos que fueron directo a ahorros (dinero real que entró pero no pasó por disponible)
  const movIngresosAhorros = periodo
    ? periodo.movimientos
        .filter((m) => m.tipo === "Ingreso" && m.categoria === "Ahorros")
        .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
    : [];

  const totalIngresos = periodo ? periodo.sueldo + periodo.moveDisponible : 0;
  const totalAhorradoDirecto = movIngresosAhorros.reduce((s, m) => s + m.monto, 0);

  const ingXCat: { cat: string; monto: number; pct: number }[] = (() => {
    if (!periodo) return [];
    const catMap = new Map<string, number>();
    if (periodo.sueldo > 0) catMap.set("Sueldo", periodo.sueldo);
    if (periodo.moveDisponible > 0) catMap.set("Move disponible", periodo.moveDisponible);
    for (const m of periodo.movimientos) {
      if (m.tipo === "Ingreso" && m.categoria !== "RESTO" && m.categoria !== "Sueldo") {
        catMap.set(m.categoria, (catMap.get(m.categoria) ?? 0) + m.monto);
      }
    }
    const totalCat = totalIngresos + totalAhorradoDirecto;
    return Array.from(catMap.entries())
      .filter(([, v]) => v > 0)
      .map(([cat, monto]) => ({ cat, monto, pct: totalCat > 0 ? Math.round((monto / totalCat) * 100) : 0 }))
      .sort((a, b) => b.monto - a.monto);
  })();

  const ingresosAnteriores = anterior ? anterior.sueldo + anterior.moveDisponible : 0;
  const deltaIngresos = anterior && ingresosAnteriores > 0
    ? Math.round(((totalIngresos - ingresosAnteriores) / ingresosAnteriores) * 100)
    : null;

  const ingXDesc: { cat: string; monto: number; pct: number }[] = (() => {
    if (!periodo) return [];
    const descMap = new Map<string, number>();
    for (const m of periodo.movimientos) {
      // Incluye todos los ingresos reales: Sueldo y RESTO (período anterior)
      if (m.tipo === "Ingreso") {
        const key = m.categoria === "RESTO" ? t.prevPeriodRemaining : (m.descripcion || m.categoria);
        descMap.set(key, (descMap.get(key) ?? 0) + m.monto);
      }
    }
    const totalAll = totalIngresos + totalAhorradoDirecto;
    return Array.from(descMap.entries())
      .filter(([, v]) => v > 0)
      .map(([cat, monto]) => ({ cat, monto, pct: totalAll > 0 ? Math.round((monto / totalAll) * 100) : 0 }))
      .sort((a, b) => b.monto - a.monto);
  })();

  const evolucionIngresos = useMemo(
    () => periodos.slice(0, 12),
    [periodos]
  );

  // ── Estadísticas avanzadas ──
  // Sueldo del período activo (no del más reciente) + variación vs el nivel salarial previo.
  const evolSueldoActivo = useMemo(() => {
    if (!periodo) return null;
    const ultimo = periodo.sueldo;
    if (activos.length !== 1) return { sueldo: ultimo, deltaPct: null as number | null, esVacaciones: false };
    const maxSueldo = Math.max(...periodos.map((p) => p.sueldo), 0);
    const esVac = (s: number) => s > 0 && s < maxSueldo * 0.5;
    const idx = periodos.findIndex((p) => p.periodoId === activos[0]);
    const ref = idx >= 0 ? periodos.slice(idx + 1).find((p) => p.sueldo > 0 && !esVac(p.sueldo) && p.sueldo !== ultimo) : undefined;
    const anteriorS = ref?.sueldo ?? null;
    const deltaPct = anteriorS ? Math.round(((ultimo - anteriorS) / anteriorS) * 100) : null;
    return { sueldo: ultimo, deltaPct, esVacaciones: esVac(ultimo) };
  }, [periodo, activos, periodos]);
  const suelHistorial = useMemo(() => historialSueldo(periodos), [periodos]);

  // ── Tendencias ──
  const seedPeriodoId = config?.meta.ahorrosAcumSeedPeriodoId;

  // Auto-guardar seed la primera vez que carga con períodos pero sin seed
  useEffect(() => {
    if (!user?.uid || !config || seedPeriodoId || periodos.length === 0) return;
    const cron = [...periodos].reverse();
    const newSeedId = cron[Math.max(0, cron.length - 2)]?.periodoId;
    if (!newSeedId) return;
    updateDoc(doc(db, `users/${user.uid}/config/meta`), { "meta.ahorrosAcumSeedPeriodoId": newSeedId });
  }, [user?.uid, !!config, !!seedPeriodoId, periodos.length]);

  // Cargar presupuesto del período activo (solo si hay un único período seleccionado)
  const activoPeriodoId = activos.length === 1 ? (activos[0] ?? null) : null;
  useEffect(() => {
    setShowBudget(false);
    if (!user?.uid || !activoPeriodoId) { setPresupuesto(null); return; }
    obtenerPresupuesto(user.uid, activoPeriodoId).then(setPresupuesto).catch(() => setPresupuesto(null));
  }, [user?.uid, activoPeriodoId]);

  const serie = useMemo(() => serieTendencia(periodos, seedPeriodoId), [periodos, seedPeriodoId]);
  const serieDesc = useMemo(() => [...serie].reverse(), [serie]);
  const maxTotal = Math.max(...serie.map((s) => s.total), 1);

  // ── Resumen general de períodos ──
  const validPeriodos = useMemo(() => serieDesc.filter((s) => s.total > 0), [serieDesc]);
  const mejorPeriodo = validPeriodos.length > 0 ? validPeriodos.reduce((b, s) => s.gastado / s.total < b.gastado / b.total ? s : b) : null;
  const peorPeriodo = validPeriodos.length > 0 ? validPeriodos.reduce((b, s) => s.gastado / s.total > b.gastado / b.total ? s : b) : null;
  // Inflación personal: variación promedio del gasto puro (sin compras de divisa,
  // que dispararían el número) entre períodos consecutivos.
  const inflacionPersonal = useMemo(() => {
    const chron = periodos
      .map((p) => ({ id: p.periodoId, gasto: p.movimientos.filter((m) => m.tipo === "Gasto").reduce((s, m) => s + m.monto, 0) }))
      .filter((p) => p.gasto > 0)
      .sort((a, b) => parsePeriodoId(a.id).getTime() - parsePeriodoId(b.id).getTime());
    if (chron.length < 2) return null;
    let sum = 0, n = 0;
    for (let i = 1; i < chron.length; i++) {
      const prev = chron[i - 1].gasto;
      if (prev > 0) { sum += (chron[i].gasto - prev) / prev; n++; }
    }
    return n > 0 ? Math.round((sum / n) * 100) : null;
  }, [periodos]);
  // Gasto más frecuente: categoría con más movimientos de tipo Gasto + su total acumulado.
  // ¿Tu sueldo le gana a la inflación? Suba salarial acumulada (primer nivel → último,
  // sin contar vacaciones) vs inflación país acumulada en toda tu historia.
  const sueldoVsInflacion = useMemo(() => {
    if (suelHistorial.length === 0 || periodos.length < 2) return null;
    const firstSalary = suelHistorial[suelHistorial.length - 1]!.de;
    const lastSalary = suelHistorial[0]!.a;
    if (firstSalary <= 0) return null;
    const suba = (lastSalary / firstSalary - 1) * 100;
    const pais = ipcVar(periodos[periodos.length - 1]!.periodoId, periodos[0]!.periodoId);
    if (pais == null) return null;
    return { gap: Math.round(suba - pais), suba: Math.round(suba), pais: Math.round(pais) };
  }, [suelHistorial, periodos, ipcVar]);

  // Ahorros acumulados al cierre del período seleccionado (para mostrar en Períodos)
  const ahorrosAcumPeriodo = activos.length === 1
    ? (serie.find((s) => s.periodoId === activos[0])?.ahorrosAcum ?? 0)
    : serie[serie.length - 1]?.ahorrosAcum ?? 0;
  const ahorrosAcumAnterior = anterior
    ? (serie.find((s) => s.periodoId === anterior.periodoId)?.ahorrosAcum ?? 0)
    : 0;
  const deltaAhorros = ahorrosAcumPeriodo > 0 && anterior ? ahorrosAcumPeriodo - ahorrosAcumAnterior : null;
  const deltaAhorrosPct = deltaAhorros !== null && ahorrosAcumAnterior > 0
    ? Math.round((deltaAhorros / ahorrosAcumAnterior) * 100)
    : null;

  // ── Tendencias / metas de ahorro ──
  const cotizActual = monedaInversiones === "EUR"
    ? (cotizacion?.oficial_euro ?? null)
    : (cotizacion?.oficial ?? null);
  const simBoloInv = monedaInversiones === "EUR" ? "€" : "U$D";

  // Reserva real en FX — suma cantidadUSD de CompraUSD/GastoUSD (igual que página Inversión)
  const tipoCompraFX = monedaInversiones === "EUR" ? "CompraEUR" : "CompraUSD";
  const tipoGastoFX  = monedaInversiones === "EUR" ? "GastoEUR"  : "GastoUSD";
  const tipoVentaFX  = monedaInversiones === "EUR" ? "VentaEUR"  : "VentaUSD";
  const SALDO_INICIAL = monedaInversiones === "EUR" ? (config?.meta.saldoEUR ?? 0) : (config?.meta.saldoUSD ?? 0);
  const reservaFX = useMemo(() => {
    let total = SALDO_INICIAL;
    for (const m of movimientos) {
      if (m.tipo === tipoCompraFX && m.cantidadUSD) total += m.cantidadUSD;
      else if ((m.tipo === tipoGastoFX || m.tipo === tipoVentaFX) && m.cantidadUSD) total -= m.cantidadUSD;
    }
    return Math.max(0, total);
  }, [movimientos, tipoCompraFX, tipoGastoFX, tipoVentaFX]);

  const metaMonto = config?.meta.metaMonto;
  const progresoMeta = metaMonto && cotizActual ? progresoMetaUSD(reservaFX * cotizActual, metaMonto, cotizActual) : null;
  const periodosParaMetaMonto = metaMonto && cotizActual ? periodosParaMetaUSD(serie, metaMonto, cotizActual) : null;
  const ahorrosEnUSD = reservaFX > 0 ? reservaFX : null;
  const promAhorroUSD = cotizActual && serie.length > 0
    ? (serie.reduce((s, p) => s + Math.max(0, p.ahorros), 0) / serie.length) / cotizActual : null;
  const proyUSD = cotizActual && serie.length >= 2 ? proyectarAhorros(serie, 3) / cotizActual : null;

  // ── Tendencias: Gastos ──
  const promGastoPorPeriodo = periodos.length > 0
    ? Math.round(periodos.reduce((s, p) => s + p.gastadoPuro, 0) / periodos.length) : 0;
  // Mediana por período (más robusta que el promedio ante períodos atípicos).
  const mediana = (arr: number[]) => {
    const v = arr.filter((x) => x > 0).sort((a, b) => a - b);
    if (v.length === 0) return 0;
    const mid = Math.floor(v.length / 2);
    return v.length % 2 ? v[mid] : Math.round((v[mid - 1] + v[mid]) / 2);
  };
  const medianaGastoPeriodo = useMemo(() => mediana(periodos.map((p) => p.gastadoPuro)), [periodos]);
  // Lo que entró a ahorros por período: depósitos (moveAhorros) + ingresos directos a ahorro.
  const medianaAhorroPeriodo = useMemo(() => mediana(periodos.map((p) => p.moveAhorros + p.ahorros)), [periodos]);
  // Proyección del próximo período: promedio histórico (excluye el período en curso, incompleto).
  const proyeccionAhorro = periodos.length >= 2
    ? Math.round(periodos.slice(1).reduce((s, p) => s + p.moveAhorros + p.ahorros, 0) / (periodos.length - 1)) : null;
  const estadPeriodos = useMemo(() => estadisticasPeriodos(periodos), [periodos]);
  const avgHistorico = periodos.length >= 2
    ? periodos.slice(1).reduce((s, p) => s + p.gastadoPuro, 0) / (periodos.length - 1) : 0;
  const tendenciaGasto = periodos.length >= 2 && avgHistorico > 0
    ? Math.round(((periodos[0].gastadoPuro - avgHistorico) / avgHistorico) * 100) : null;
  // Proyección mejorada: deflacta cada período histórico a pesos de hoy (los viejos
  // valían "menos pesos" y subestimaban) y proyecta al próximo período sumando el
  // último IPC mensual conocido.
  const proyeccionGasto = periodos.length >= 2 ? (() => {
    const hist = periodos.slice(1); // excluye el período en curso (incompleto)
    const realAvg = hist.reduce((s, p) => s + deflatar(p.gastadoPuro, p.periodoId), 0) / hist.length;
    const factor = ipcMensualUltimo != null ? 1 + ipcMensualUltimo / 100 : 1;
    return Math.round(realAvg * factor);
  })() : null;
  const avgHistoricoMovs = periodos.length >= 2
    ? periodos.slice(1).reduce((s, p) => s + p.movimientos.length, 0) / (periodos.length - 1) : 0;
  const tendenciaMovs = periodos.length >= 2 && avgHistoricoMovs > 0
    ? Math.round(((periodos[0].movimientos.length - avgHistoricoMovs) / avgHistoricoMovs) * 100) : null;

  // ── Movimientos: estadísticas de frecuencia ──
  const movCounts = useMemo(() => {
    if (!periodo) return null;
    const movs = periodo.movimientos;
    const tipoColor = TIPO_COLOR;
    const vTipo = (m: typeof movs[0]) =>
      m.tipo === "Move" ? (m.direccionMove === "aAhorro" ? "MoveAhorro" : "MoveDisponible") : m.tipo;
    const vCat = (m: typeof movs[0]) =>
      m.categoria === "Move" ? (m.direccionMove === "aAhorro" ? "Move ahorros" : "Move disponible") : m.categoria;
    const domColor = (tipoMap: Map<string, number>) => {
      const dom = [...tipoMap.entries()].reduce((a, b) => b[1] > a[1] ? b : a, ["", 0] as [string, number])[0];
      return tipoColor[dom] ?? "var(--accent)";
    };
    const porFechaMap = new Map<string, number>();
    for (const m of movs) porFechaMap.set(m.fecha, (porFechaMap.get(m.fecha) ?? 0) + 1);
    const [diaMasActivo, diaMasActivoN] = porFechaMap.size > 0
      ? [...porFechaMap.entries()].reduce((a, b) => b[1] > a[1] ? b : a)
      : ["—", 0];
    const porTipoMap = new Map<string, number>();
    for (const m of movs) { const k = vTipo(m); porTipoMap.set(k, (porTipoMap.get(k) ?? 0) + 1); }
    // Per-group type tracking
    const catTipo = new Map<string, Map<string, number>>();
    const catMonto = new Map<string, number>();
    const medioTipo = new Map<string, Map<string, number>>();
    const medioMonto = new Map<string, number>();
    const medioTipoMonto = new Map<string, Map<string, number>>();
    for (const m of movs) {
      const cat = vCat(m);
      if (cat && cat !== "RESTO") {
        if (!catTipo.has(cat)) catTipo.set(cat, new Map());
        const t = catTipo.get(cat)!; const vt = vTipo(m); t.set(vt, (t.get(vt) ?? 0) + 1);
        catMonto.set(cat, (catMonto.get(cat) ?? 0) + m.monto);
      }
      // Caso border: medioPago es un guión placeholder (- – —) → data basura que se
      // atribuye a Mercado Pago. Vacío/sin medio (ej. Ingreso) queda fuera del gráfico.
      const mpRaw = m.medioPago?.trim();
      const esGuion = !!mpRaw && /^[-–—]+$/.test(mpRaw);
      const mp = esGuion ? "Mercado Pago" : (mpRaw || null);
      if (mp) {
        if (!medioTipo.has(mp)) medioTipo.set(mp, new Map());
        const t = medioTipo.get(mp)!; const vt = vTipo(m); t.set(vt, (t.get(vt) ?? 0) + 1);
        medioMonto.set(mp, (medioMonto.get(mp) ?? 0) + m.monto);
        if (!medioTipoMonto.has(mp)) medioTipoMonto.set(mp, new Map());
        const tmAmt = medioTipoMonto.get(mp)!; tmAmt.set(vt, (tmAmt.get(vt) ?? 0) + m.monto);
      }
    }
    const porCat = [...catTipo.entries()].map(([cat, t]) => ({ cat, count: [...t.values()].reduce((a,b)=>a+b,0), total: catMonto.get(cat) ?? 0, color: domColor(t) })).sort((a,b)=>b.count-a.count);
    const porMedio = [...medioTipo.entries()].map(([medio, tMap]) => ({ medio, count: [...tMap.values()].reduce((a,b)=>a+b,0), total: medioMonto.get(medio) ?? 0, color: domColor(tMap), tipos: [...tMap.entries()].map(([tipo, n]) => ({ tipo, n, monto: medioTipoMonto.get(medio)?.get(tipo) ?? 0 })).sort((a,b)=>b.n-a.n) })).sort((a,b)=>b.count-a.count);
    const porDow = [0,0,0,0,0,0,0];
    for (const m of movs) {
      if (m.fecha) porDow[new Date(m.fecha.includes("-") ? m.fecha + "T12:00:00" : m.fecha).getDay()]++;
    }
    return {
      total: movs.length,
      diasActivos: porFechaMap.size,
      diaMasActivo, diaMasActivoN,
      porTipo: [...porTipoMap.entries()].sort((a,b)=>b[1]-a[1]),
      porCat, porMedio, porDow,
    };
  }, [periodo]);

  return (
    <div className="page">
      {loading ? (
        <LoadingSpinner />
      ) : periodos.length === 0 ? (
        <div className="soft" style={{ textAlign: "center", padding: 32, color: "var(--muted)", fontSize: 13 }}>{t.noMovementsReport}</div>
      ) : (
        <div key={sub} className="fade-up">
          <div style={{ marginBottom: 18 }}>
            <div className="label" style={{ marginBottom: 2 }}>{t.analysis}</div>
            <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.5, display: "inline-block", background: "linear-gradient(110deg, var(--blue) 10%, var(--green) 90%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>{t.pageTitleReports}</div>
          </div>
          {showHint && <SectionHint title={t.hintRepTitle} body={t.hintRepBody} onDismiss={dismissHint} />}
          <div className="subtabs">
            {SUBS.map((s) => {
              const isActive = sub === s.id;
              const tabColor = s.id === "gastos" ? "var(--red)" : s.id === "ingresos" ? "var(--green)" : "var(--blue)";
              const tabDim   = s.id === "gastos" ? "var(--red-dim)" : s.id === "ingresos" ? "var(--green-dim)" : "var(--blue-dim)";
              const tabGrad  = s.id === "movimientos" ? "linear-gradient(90deg, #26c6da, var(--purple))"
                             : s.id === "periodos"    ? "linear-gradient(90deg, var(--red), var(--green))"
                             : null;
              return (
                <button key={s.id} onClick={() => setSub(s.id)} className="subtab"
                  style={isActive ? (tabGrad ? {
                    border: "1px solid transparent",
                    backgroundImage: `linear-gradient(var(--surface-alt), var(--surface-alt)), ${tabGrad}`,
                    backgroundOrigin: "padding-box, border-box",
                    backgroundClip: "padding-box, border-box",
                  } : { background: `linear-gradient(135deg, var(--surface-alt) 0%, ${tabDim} 100%)`, color: tabColor, border: `1px solid ${tabColor}44` }) : {}}>
                  {isActive && tabGrad ? (
                    <span style={{ background: tabGrad, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                      {s.label}
                    </span>
                  ) : s.label}
                </button>
              );
            })}
          </div>
          {/* Selector de período — tap simple selecciona uno; toggle "Comparar" suma/quita.
              No aplica a Períodos (es una vista histórica de todos). */}
          {sub !== "periodos" && (() => {
            const subColor = sub === "gastos" ? "var(--red)" : sub === "ingresos" ? "var(--green)" : "var(--blue)";
            const subDim   = sub === "gastos" ? "var(--red-dim)" : sub === "ingresos" ? "var(--green-dim)" : "var(--blue-dim)";
            const isMovSub = sub === "movimientos";
            const movGrad  = "linear-gradient(90deg, #26c6da, var(--purple))";
            const activePill: React.CSSProperties = isMovSub ? {
              border: "1px solid transparent",
              backgroundImage: `linear-gradient(var(--bg), var(--bg)), ${movGrad}`,
              backgroundOrigin: "padding-box, border-box",
              backgroundClip: "padding-box, border-box",
              color: "var(--text)",
            } : { border: `1px solid ${subColor}`, background: subDim, color: subColor };
            const inactivePill: React.CSSProperties = { border: "1px solid var(--border)", background: "transparent", color: "var(--muted)" };
            const años = Array.from(new Set(periodos.map((p) => periodoAnio(p.periodoId))));
            const añosActivos = new Set(activos.map((id) => periodoAnio(id)));
            // En comparar multi-año mostramos todos los activos; si no, los del año en vista.
            const añoVista = periodoAnio(activos[0] ?? periodos[0]?.periodoId ?? "");
            const pilisAMostrar = añosActivos.size > 1
              ? periodos.filter((p) => añosActivos.has(periodoAnio(p.periodoId)))
              : periodos.filter((p) => periodoAnio(p.periodoId) === añoVista);

            const togglePill = (id: string) => {
              if (!compareMode) { setPeriodosSelIds([id]); return; }
              setPeriodosSelIds((prev) => {
                const current = prev.length > 0 ? prev : [periodos[0]?.periodoId].filter(Boolean) as string[];
                if (current.includes(id)) {
                  const next = current.filter((x) => x !== id);
                  return next.length > 0 ? next : current; // nunca dejar 0
                }
                return [...current, id];
              });
            };
            const selectYear = (año: string) => {
              if (compareMode) {
                const ids = periodos.filter((p) => periodoAnio(p.periodoId) === año).map((p) => p.periodoId);
                setPeriodosSelIds((prev) => {
                  const current = prev.length > 0 ? prev : [periodos[0]?.periodoId].filter(Boolean) as string[];
                  const todos = ids.every((id) => current.includes(id));
                  const next = todos ? current.filter((id) => !ids.includes(id)) : Array.from(new Set([...current, ...ids]));
                  return next.length > 0 ? next : current;
                });
              } else {
                const primero = periodos.find((p) => periodoAnio(p.periodoId) === año);
                if (primero) setPeriodosSelIds([primero.periodoId]);
              }
            };

            return (
              <div style={{ marginBottom: 16 }}>
                {/* Fila de años + toggle Comparar */}
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                  <div style={{ display: "flex", gap: 4, overflowX: "auto", padding: "3px 3px 4px", scrollbarWidth: "none", touchAction: "pan-x", flex: 1 }}>
                    {años.map((año) => {
                      const isAñoActivo = añosActivos.has(año);
                      return (
                        <button key={año} onClick={() => selectYear(año)}
                          style={{
                            flexShrink: 0, padding: "5px 13px", borderRadius: 999, fontSize: 11, fontWeight: 700, cursor: "pointer",
                            transition: "all 0.15s",
                            ...(isAñoActivo ? activePill : inactivePill),
                          }}
                        >{isMovSub && isAñoActivo ? <span style={{ background: movGrad, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>{año}</span> : año}</button>
                      );
                    })}
                  </div>
                  {periodos.length > 1 && (
                    <button onClick={() => setCompareMode((v) => { const nv = !v; if (!nv) setPeriodosSelIds((p) => p.slice(0, 1)); return nv; })}
                      style={{
                        flexShrink: 0, display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 999,
                        fontSize: 11, fontWeight: 700, cursor: "pointer", transition: "all 0.15s",
                        ...(compareMode ? activePill : inactivePill),
                      }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M7 10h14M7 10l-4 4 4 4"/><path d="M17 14H3M17 14l4-4-4-4" transform="translate(0 -4)"/>
                      </svg>
                    </button>
                  )}
                </div>
                {/* Pills de períodos */}
                <div style={{ display: "flex", gap: 6, overflowX: "auto", padding: "3px 3px 4px", scrollbarWidth: "none", alignItems: "center", touchAction: "pan-x" }}>
                  {pilisAMostrar.map((p) => {
                    const isSelected = activos.includes(p.periodoId);
                    return (
                      <button key={p.periodoId} onClick={() => togglePill(p.periodoId)}
                        style={{
                          flexShrink: 0, padding: "6px 14px", borderRadius: 999, fontSize: 11, fontWeight: 700, cursor: "pointer",
                          transition: "all 0.15s",
                          ...(isSelected ? activePill : inactivePill),
                        }}
                      >{isMovSub && isSelected ? <span style={{ background: movGrad, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>{shortPer(p.periodoId)}</span> : shortPer(p.periodoId)}</button>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* ══ GASTOS ══ */}
          {sub === "gastos" && periodo && kpis && (
            <>
              {/* Hero: Gastado */}
              {reportOn("gastos_kpis") && (() => {
                const pctColor = colorPct(periodo.pct);
                return (
                  <div className="soft" style={{ marginBottom: 12, background: "linear-gradient(135deg, var(--surface), var(--red-dim))" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <div style={{ fontSize: 12, color: "var(--muted)" }}>{t.spent}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {ritmo?.enCurso && <span className="badge" style={{ background: "var(--green-dim)", color: "var(--green)", border: "1px solid var(--green)44" }}>{t.ongoing}</span>}
                        <button onClick={toggle} aria-label={t.hideValues} style={{ background: "transparent", border: "none", color: oculto ? "var(--accent)" : "var(--muted)", width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}>
                          <EyeIcon off={oculto} />
                        </button>
                      </div>
                    </div>
                    <div style={{ fontSize: 30, fontWeight: 700, color: pctColor, fontFamily: "var(--font-mono)", letterSpacing: -0.5, lineHeight: 1 }}>{money(periodo.gastado)}</div>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 6, marginBottom: 10 }}>{t.ofTotal(periodo.pct)}</div>
                    <div className="bar-track"><div className="bar-fill" style={{ width: `${Math.min(periodo.pct, 100)}%`, background: pctColor }} /></div>
                  </div>
                );
              })()}

              {/* Mini-stats fila 1: 3 columnas */}
              {reportOn("gastos_kpis") && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                {esPeriodoVigente && tendenciaGasto !== null && (() => { const c = tendenciaGasto > 10 ? "var(--red)" : tendenciaGasto < -10 ? "var(--green)" : "var(--yellow)"; const v = `${tendenciaGasto >= 0 ? "+" : ""}${tendenciaGasto}%`; return (
                  <MiniStat center label={t.trend} value={v} color={c}
                    onClick={() => setKpiInfo({ title: t.trend, value: v, explain: `${t.kpiTrendInfo} Período actual: ${oculto ? "••" : formatARS(periodos[0].gastadoPuro)} · Promedio histórico: ${oculto ? "••" : formatARS(Math.round(avgHistorico))}`, color: c })} />
                ); })()}
                {periodo.moveAhorros > 0 && <MiniStat center label={t.toSavingsLabel} value={oculto ? "••" : abbr(periodo.moveAhorros)} color="var(--purple)"
                  onClick={() => setKpiInfo({ title: t.moveToSavingsTitle, value: oculto ? "••" : formatARS(periodo.moveAhorros), explain: t.kpiMoveToSavingsInfo, color: "var(--purple)" })} />}
              </div>
              )}

              {/* Mini-stats fila 2 */}
              {reportOn("gastos_kpis") && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 18 }}>
                {ritmo && <MiniStat center basis="1 1 45%" label={t.spendingPace} value={`${oculto ? "••" : abbr(ritmo.gastadoPorDia)}${t.perDay}`} color="var(--red)"
                  onClick={() => setKpiInfo({ title: t.spendingPace, value: `${oculto ? "••" : formatARS(ritmo.gastadoPorDia)}${t.perDay}`, explain: `${t.kpiPaceInfo} (${t.projection30days(oculto ? "••" : formatARS(ritmo.proyeccionCierre))})`, color: "var(--red)" })} />}
                {promPorMov != null && <MiniStat center basis="1 1 45%" label={t.avgPerExpense} value={oculto ? "••" : abbr(promPorMov)} color="var(--red)"
                  onClick={() => setKpiInfo({ title: t.avgPerExpense, value: oculto ? "••" : formatARS(promPorMov), explain: t.kpiAvgPerExpenseInfo, color: "var(--red)" })} />}
              </div>
              )}

              {/* Categorías */}
              {reportOn("gastos_otros") && (
              <div className="soft" style={{ marginBottom: 12, background: "linear-gradient(135deg, var(--surface), var(--surface-alt))" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{t.byCategory}</span>
                  {activos.length === 1 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {presupuesto && Object.keys(presupuesto).length > 0 && (
                        <button onClick={() => setShowBudget(v => !v)} style={{ background: showBudget ? "var(--accent-dim)" : "transparent", border: `1px solid ${showBudget ? "var(--accent)" : "var(--border)"}`, borderRadius: 6, color: showBudget ? "var(--accent)" : "var(--muted)", fontSize: 10, fontWeight: 600, padding: "3px 8px", cursor: "pointer", transition: "all 0.15s" }}>
                          {t.budget}
                        </button>
                      )}
                      <button onClick={() => {
                        const template = config?.meta.presupuestoTemplate ?? {};
                        const base = presupuesto ?? template;
                        setEditingBudget(Object.fromEntries(cats.map((c) => [c.categoria, String(base[c.categoria] ?? "")])));
                        setModalBudget(true);
                      }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: 4, display: "flex", alignItems: "center" }} aria-label={t.editBudget}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
                {cats.map((c) => <Bar key={c.categoria} nombre={c.categoria} monto={c.monto} pct={c.pct} color={esCatCompra(c.categoria) ? "var(--yellow)" : "var(--red)"} oculto={oculto} presupuesto={showBudget ? presupuesto?.[c.categoria] : undefined} onClick={() => setCatModal(c.categoria)} />)}
              </div>
              )}

              {/* Comparativa vs anterior */}
              {anterior && reportOn("gastos_otros") && (
                <div className="soft" style={{ marginBottom: 12, background: "linear-gradient(135deg, var(--surface), var(--surface-alt))" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{t.vsPrevPeriod}</div>
                  <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 12 }}>{shortPer(anterior.periodoId)}</div>
                  {comp.filter((c) => c.actual > 0 || c.anterior > 0).slice(0, 8).map((c) => (
                    <div key={c.categoria} className="row" style={{ padding: "8px 0" }}>
                      <span style={{ fontSize: 13 }}>{c.categoria}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {(() => { const diff = c.actual - c.anterior; return (
                          <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--muted)" }}>{diff >= 0 ? "+" : "−"}{money(Math.abs(diff))}</span>
                        ); })()}
                        {c.deltaPct !== null ? (
                          <span style={{ fontSize: 11, fontWeight: 700, color: c.deltaPct > 0 ? "var(--red)" : "var(--green)", minWidth: 48, textAlign: "right" }}>
                            {c.deltaPct > 0 ? "↑" : "↓"}{Math.abs(c.deltaPct)}%
                          </span>
                        ) : <span style={{ fontSize: 10, color: "var(--red)", minWidth: 48, textAlign: "right" }}>{t.new_}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}



              {/* Descripción (top) */}
              {reportOn("gastos_otros") && (
              <div className="soft" style={{ marginBottom: 12, cursor: "pointer", background: "linear-gradient(135deg, var(--surface), var(--surface-alt))" }} onClick={() => setModalTop("descs")}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>{t.top5Descriptions}</div>
                {descs.map((d) => <Bar key={d.nombre} nombre={d.nombre} monto={d.monto} pct={d.pct} color={descsCompra.has(d.nombre || "—") ? "var(--yellow)" : "var(--red)"} oculto={oculto} />)}
              </div>
              )}


              {/* Por fecha — barra apilada: rojo gasto, amarillo compra USD */}
              {reportOn("gastos_otros") && porFecha.length > 0 && (
                <div className="soft" style={{ marginBottom: 12, background: "linear-gradient(135deg, var(--surface), var(--surface-alt))" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{t.byDay}</span>
                    {[...splitPorFecha.values()].some((v) => v.compra > 0) && (
                      <div style={{ display: "flex", gap: 10, fontSize: 9, color: "var(--muted)" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: "var(--red)" }} />{t.spent}</span>
                        <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: "var(--yellow)" }} />USD</span>
                      </div>
                    )}
                  </div>
                  {(() => {
                    const maxTotal = Math.max(...porFecha.map((f) => f.monto), 1);
                    return (
                      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, alignItems: "flex-end", scrollbarWidth: "none" }}>
                        {porFecha.map((f, i) => {
                          const sp = splitPorFecha.get(f.nombre) ?? { gasto: f.monto, compra: 0 };
                          const gH = Math.round((sp.gasto / maxTotal) * 96);
                          const cH = Math.round((sp.compra / maxTotal) * 96);
                          return (
                            <div key={i} onClick={() => setDiaModal(sinAño(f.nombre))} style={{ flexShrink: 0, width: 36, display: "flex", flexDirection: "column", alignItems: "center", gap: 5, cursor: "pointer" }}>
                              <div style={{ fontSize: 8, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>{oculto ? "•" : abbr(f.monto)}</div>
                              <div style={{ height: 96, width: 20, background: "var(--faint)", borderRadius: 7, display: "flex", flexDirection: "column", justifyContent: "flex-end", overflow: "hidden" }}>
                                {cH > 0 && <div style={{ width: "100%", height: cH, background: "var(--yellow)", transition: "height .5s ease" }} />}
                                {gH > 0 && <div style={{ width: "100%", height: gH, background: "var(--red)", transition: "height .5s ease" }} />}
                              </div>
                              <div style={{ fontSize: 8, color: "var(--muted)" }}>{sinAño(f.nombre)}</div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              )}

            </>
          )}

          {/* ══ INGRESOS ══ */}
          {sub === "ingresos" && periodo && (
            <>
              {/* Hero + KPIs */}
              {reportOn("ingresos_kpis") && (
              <>
              <div className="soft" style={{ marginBottom: 12, background: "linear-gradient(160deg, var(--surface) 50%, #00e67610 100%)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>{t.availableIncome}</div>
                  <button onClick={toggle} aria-label={t.hideValues} style={{
                    background: "transparent", border: "none", color: oculto ? "var(--accent)" : "var(--muted)",
                    width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0,
                  }}>
                    <EyeIcon off={oculto} />
                  </button>
                </div>
                <div style={{ fontSize: 34, fontWeight: 700, color: "#00e676cc", letterSpacing: -1, lineHeight: 1, fontFamily: "var(--font-mono)" }}>
                  {money(totalIngresos)}
                </div>
                {deltaIngresos !== null && (
                  <div style={{ marginTop: 8, fontSize: 12, color: deltaIngresos >= 0 ? "var(--green)" : "var(--red)", fontWeight: 600 }}>
                    {deltaIngresos >= 0 ? "↑" : "↓"}{Math.abs(deltaIngresos)}% vs {shortPer(anterior!.periodoId)}
                  </div>
                )}
              </div>

              {/* Mini-stats: Sueldo · Retiros */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                {evolSueldoActivo ? (
                  <MiniStat center basis="1 1 45%" label={t.salary}
                    value={oculto ? "••" : abbr(evolSueldoActivo.sueldo)}
                    sub={evolSueldoActivo.esVacaciones ? t.leave : evolSueldoActivo.deltaPct !== null ? `${evolSueldoActivo.deltaPct >= 0 ? "+" : ""}${evolSueldoActivo.deltaPct}%` : undefined}
                    color={evolSueldoActivo.esVacaciones ? "var(--yellow)" : "var(--green)"}
                    onClick={suelHistorial.length > 0 ? () => setModalSueldo(true) : undefined} />
                ) : (
                  <MiniStat center basis="1 1 45%" label={t.salary} value={oculto ? "••" : abbr(periodo.sueldo)} color="var(--green)" />
                )}
                {periodo.moveDisponible > 0 && <MiniStat center basis="1 1 45%" label={t.withdrawals} value={oculto ? "••" : abbr(periodo.moveDisponible)} color="#26c6da"
                  onClick={() => setKpiInfo({ title: t.withdrawals, value: oculto ? "••" : formatARS(periodo.moveDisponible), explain: t.kpiWithdrawalsInfo, color: "#26c6da" })} />}
              </div>

              {/* Mini-stats: Total ingresado · Ahorros acum. */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                {reportOn("ingresos_kpis") && totalAhorradoDirecto > 0 && (
                  <MiniStat center basis="1 1 45%" label={t.totalIncome} value={oculto ? "••" : abbr(periodo.sueldo + totalAhorradoDirecto)} color="var(--green)"
                    onClick={() => setKpiInfo({ title: t.totalIncome, value: oculto ? "••" : formatARS(periodo.sueldo + totalAhorradoDirecto), explain: `${t.kpiTotalIncomeInfo} (${t.toSavingsLabel}: ${oculto ? "••" : formatARS(totalAhorradoDirecto)})`, color: "var(--green)" })} />
                )}
                <MiniStat center basis="1 1 45%" label={t.accumSavings}
                  value={ahorrosAcumPeriodo > 0 ? (oculto ? "••" : abbr(ahorrosAcumPeriodo)) : "—"}
                  color="var(--blue)"
                  onClick={ahorrosAcumPeriodo > 0 ? () => setKpiInfo({ title: t.accumSavings, value: oculto ? "••" : formatARS(ahorrosAcumPeriodo), explain: deltaAhorros !== null ? `${t.kpiAccumSavingsInfo} (${deltaAhorros >= 0 ? "+" : ""}${oculto ? "••" : formatARS(deltaAhorros)}${deltaAhorrosPct !== null ? ` · ${deltaAhorrosPct >= 0 ? "+" : ""}${deltaAhorrosPct}%` : ""})` : t.kpiAccumSavingsInfo, color: "var(--blue)" }) : undefined} />
              </div>

              </>
              )}

              {/* Por descripción */}
              {reportOn("ingresos_otros") && ingXDesc.length > 0 && (
                <div className="soft" style={{ marginBottom: 12, background: "linear-gradient(135deg, var(--surface), var(--surface-alt))" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>{t.byDescription}</div>
                  {ingXDesc.map((c) => (
                    <Bar key={c.cat} nombre={c.cat} monto={c.monto} pct={c.pct} color={c.cat === "Sueldo" ? "var(--green)" : "var(--blue)"} oculto={oculto} />
                  ))}
                </div>
              )}


              {/* Detalle de movimientos */}
              {reportOn("ingresos_otros") && (movIngresos.length > 0 || movIngresosAhorros.length > 0) && (
                <div className="soft" style={{ marginBottom: 12, background: "linear-gradient(135deg, var(--surface), var(--surface-alt))" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>{t.detail}</div>
                  {movIngresos.map((m) => (
                    <div key={m.id} className="row" style={{ padding: "9px 0" }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.descripcion || m.categoria}</div>
                        <div style={{ fontSize: 10, color: "var(--muted)" }}>{m.categoria} · {sinAño(m.fecha)}</div>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--green)", fontFamily: "var(--font-mono)", whiteSpace: "nowrap" }}>
                        +{money(m.monto)}
                      </span>
                    </div>
                  ))}
                  {movIngresosAhorros.length > 0 && (
                    <>
                      <div style={{ fontSize: 10, color: "var(--muted)", letterSpacing: 2, textTransform: "uppercase", padding: "10px 0 4px", borderTop: movIngresos.length > 0 ? "1px solid var(--faint)" : "none", marginTop: movIngresos.length > 0 ? 4 : 0 }}>
                        {t.directToSavings}
                      </div>
                      {movIngresosAhorros.slice(0, 5).map((m) => (
                        <div key={m.id} className="row" style={{ padding: "9px 0" }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.descripcion || m.origenAhorro || m.categoria}</div>
                            <div style={{ fontSize: 10, color: "var(--muted)" }}>{sinAño(m.fecha)}</div>
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--blue)", fontFamily: "var(--font-mono)", whiteSpace: "nowrap" }}>
                            +{money(m.monto)}
                          </span>
                        </div>
                      ))}
                      {movIngresosAhorros.length > 5 && (
                        <button onClick={() => setModalAhorros(true)} style={{ display: "block", width: "100%", textAlign: "center", margin: "8px auto 0", background: "none", border: "none", color: "var(--muted)", fontSize: 12, fontStyle: "italic", cursor: "pointer" }}>
                          {t.seeMore}
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}

              {movIngresos.length === 0 && movIngresosAhorros.length === 0 && (
                <div className="soft" style={{ textAlign: "center", padding: 32, color: "var(--muted)", fontSize: 13 }}>
                  {t.noIncomeThisPeriod}
                </div>
              )}

            </>
          )}

          {/* ══ PERÍODOS ══ */}
          {sub === "periodos" && periodo && (
            <>
              {/* Hero: inflación personal (variación promedio del gasto entre períodos) */}
              {reportOn("periodos_kpis") && (
              <div className="soft" onClick={inflacionPersonal != null ? () => setKpiInfo({ title: t.inflationTitle, value: `${inflacionPersonal >= 0 ? "+" : ""}${inflacionPersonal}%`, explain: t.kpiInflationAvgInfo, color: inflacionPersonal > 0 ? "var(--red)" : "var(--green)" }) : undefined}
                style={{ marginBottom: 12, background: "linear-gradient(135deg, var(--red-dim), var(--surface), var(--green-dim))", cursor: inflacionPersonal != null ? "pointer" : "default" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>{t.inflationTitle}</div>
                  <button onClick={(e) => { e.stopPropagation(); toggle(); }} aria-label={t.hideValues} style={{ background: "transparent", border: "none", color: oculto ? "var(--accent)" : "var(--muted)", width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}><EyeIcon off={oculto} /></button>
                </div>
                <div style={{ fontSize: 32, fontWeight: 700, color: inflacionPersonal == null ? "var(--muted)" : inflacionPersonal > 0 ? "var(--red)" : inflacionPersonal < 0 ? "var(--green)" : "var(--text)", fontFamily: "var(--font-mono)", letterSpacing: -0.5, lineHeight: 1 }}>
                  {inflacionPersonal == null ? "—" : `${inflacionPersonal >= 0 ? "+" : ""}${inflacionPersonal}%`}
                </div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 6 }}>{t.inflationSub} · {t.periodsCount(periodos.length)}</div>
              </div>
              )}

              {/* Gasto: típico (mediana) y proyección del próximo período */}
              {reportOn("periodos_kpis") && (
                <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                  <MiniStat center basis="1 1 0" label={t.avgSpent} value={oculto ? "••" : abbr(medianaGastoPeriodo)} color="var(--red)"
                    onClick={() => setKpiInfo({ title: t.avgSpent, value: oculto ? "••" : money(medianaGastoPeriodo), explain: t.kpiTypicalInfo, color: "var(--red)" })} />
                  {proyeccionGasto != null && (
                    <MiniStat center basis="1 1 0" label={t.nextPeriodProjection} value={oculto ? "••" : abbr(proyeccionGasto)} color="var(--red)"
                      onClick={() => setKpiInfo({ title: t.nextPeriodProjection, value: oculto ? "••" : formatARS(proyeccionGasto), explain: t.kpiNextProjInfo, color: "var(--red)" })} />
                  )}
                </div>
              )}

              {/* Ahorro: típico (mediana) y proyección del próximo período */}
              {reportOn("periodos_kpis") && (
                <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                  <MiniStat center basis="1 1 0" label={t.avgSavings} value={oculto ? "••" : abbr(medianaAhorroPeriodo)} color="var(--blue)"
                    onClick={() => setKpiInfo({ title: t.avgSavings, value: oculto ? "••" : money(medianaAhorroPeriodo), explain: t.kpiTypicalSavingsInfo, color: "var(--blue)" })} />
                  {proyeccionAhorro != null && (
                    <MiniStat center basis="1 1 0" label={t.projSavings} value={oculto ? "••" : abbr(proyeccionAhorro)} color="var(--blue)"
                      onClick={() => setKpiInfo({ title: t.projSavings, value: oculto ? "••" : money(proyeccionAhorro), explain: t.kpiProjInfo, color: "var(--blue)" })} />
                  )}
                </div>
              )}

              {/* ¿Tu sueldo le gana a la inflación? Veredicto + brecha. */}
              {reportOn("periodos_kpis") && sueldoVsInflacion != null && (() => {
                const { gap, suba, pais } = sueldoVsInflacion;
                const c = gap > 0 ? "var(--green)" : gap < 0 ? "var(--red)" : "var(--muted)";
                const verdict = gap > 0 ? t.salaryBeatsInflation : gap < 0 ? t.salaryLosesInflation : t.salaryTiesInflation;
                return (
                  <div className="soft" onClick={() => setKpiInfo({ title: t.salaryVsInflation, value: `${gap >= 0 ? "+" : ""}${gap} pts`, explain: t.kpiSalaryVsInflationInfo(suba, pais), color: c })}
                    style={{ marginBottom: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, background: "linear-gradient(135deg, var(--surface), var(--surface-alt))" }}>
                    <div style={{ fontSize: 12, color: c, minWidth: 0 }}>{verdict}</div>
                    <div style={{ fontSize: 26, fontWeight: 700, fontFamily: "var(--font-mono)", letterSpacing: -0.5, lineHeight: 1, color: c, flexShrink: 0 }}>{gap >= 0 ? "+" : ""}{gap} pts</div>
                  </div>
                );
              })()}

              {/* Por período — un solo gráfico con selector de métrica */}
              {reportOn("periodos_otros") && serieDesc.length > 0 && (() => {
                const metrics = [
                  { id: "gasto", label: t.mPeriodSpent },
                  { id: "ingreso", label: t.mPeriodIncome },
                  { id: "dias", label: t.mPeriodDays },
                  { id: "gastoSueldo", label: t.mPeriodRatio },
                  ...(monedaPrincipal === "ARS" ? [{ id: "inflacion", label: "IP" }] : []),
                ] as const;
                type BarDatum = { label: string; value: number; color: string; hi?: boolean; best?: boolean; worst?: boolean; valueLabel?: string; periodoId?: string };
                let data: BarDatum[] = [];
                let max = 1; let refFrac: number | undefined; let mask = false;
                if (periodMetric === "gasto") {
                  data = serieDesc.map((s) => ({ label: shortPer(s.periodoId), value: s.gastado, color: colorPct(s.total > 0 ? Math.round((s.gastado / s.total) * 100) : 0), hi: activos.includes(s.periodoId), best: s.periodoId === mejorPeriodo?.periodoId, worst: s.periodoId === peorPeriodo?.periodoId, periodoId: s.periodoId }));
                  max = maxTotal; mask = true;
                } else if (periodMetric === "ingreso") {
                  data = evolucionIngresos.map((p) => ({ label: shortPer(p.periodoId), value: p.sueldo + p.moveDisponible, color: "var(--green)", hi: activos.includes(p.periodoId), periodoId: p.periodoId }));
                  max = Math.max(...evolucionIngresos.map((p) => p.sueldo + p.moveDisponible), 1); mask = true;
                } else if (periodMetric === "dias") {
                  const hoy = new Date();
                  data = serieDesc.map((s, i) => {
                    const inicio = parsePeriodoId(s.periodoId);
                    const fin = i === 0 ? hoy : parsePeriodoId(serieDesc[i - 1].periodoId);
                    const rawDias = (fin.getTime() - inicio.getTime()) / 86400000;
                    const dias = Math.max(1, i === 0 ? Math.floor(rawDias) + 1 : Math.round(rawDias));
                    const color = dias <= 29 ? "var(--green)" : dias <= 31 ? "var(--yellow)" : "var(--red)";
                    return { label: shortPer(s.periodoId), value: dias, color, valueLabel: `${dias}d`, hi: activos.includes(s.periodoId), periodoId: s.periodoId };
                  });
                  max = Math.max(...data.map((d) => d.value), 1);
                } else if (periodMetric === "gastoSueldo") {
                  // Gasto real (sin FX) sobre sueldo. La referencia es el 100%.
                  data = serieDesc.filter((s) => s.sueldo > 0).map((s) => {
                    const pct = Math.round((s.gastadoPuro / s.sueldo) * 100);
                    return { label: shortPer(s.periodoId), value: pct, color: pct > 90 ? "var(--red)" : pct > 50 ? "var(--yellow)" : "var(--green)", valueLabel: `${pct}%`, hi: activos.includes(s.periodoId), periodoId: s.periodoId };
                  });
                  max = Math.max(...data.map((d) => d.value), 110);
                  refFrac = 100 / max;
                }
                // Inflación personal NOMINAL por período: variación del gasto puro vs el
                // período anterior (serieDesc va nuevo→viejo: anterior = serieDesc[i+1]).
                // Junto con la inflación del país (IPC) para comparar. Excluye el más viejo.
                // Inflación ACUMULADA: tu gasto puro vs el período base (el más viejo con
                // gasto>0) y la del país (IPC compuesto) desde el mismo mes base. serie va
                // viejo→nuevo, así que acumula hacia adelante.
                let inflPoints: { label: string; a: number; b: number | null; hi?: boolean; periodoId?: string }[] = [];
                let vosAcum: number | null = null, paisAcum: number | null = null;
                if (periodMetric === "inflacion") {
                  const baseIdx = serie.findIndex((s) => s.gastadoPuro > 0);
                  if (baseIdx >= 0) {
                    const baseG = serie[baseIdx]!.gastadoPuro;
                    const baseId = serie[baseIdx]!.periodoId;
                    inflPoints = serie.slice(baseIdx).map((s) => {
                      const vos = (s.gastadoPuro / baseG - 1) * 100;
                      const pais = ipcVar(baseId, s.periodoId);
                      return { label: shortPer(s.periodoId), a: Math.round(vos), b: pais != null ? Math.round(pais) : null, hi: activos.includes(s.periodoId), periodoId: s.periodoId };
                    });
                    if (inflPoints.length > 0) {
                      vosAcum = inflPoints[inflPoints.length - 1]!.a;
                      paisAcum = inflPoints[inflPoints.length - 1]!.b;
                    }
                  }
                }
                const vosColor = vosAcum != null && paisAcum != null ? (vosAcum > paisAcum ? "var(--red)" : "var(--green)") : "var(--text)";
                const sub = periodMetric === "gasto" ? t.subMetricSpent : periodMetric === "ingreso" ? t.subMetricIncome : periodMetric === "dias" ? t.subMetricDays : periodMetric === "inflacion" ? t.subMetricInflation : t.subMetricRatio;
                return (
                  <div className="soft" style={{ marginBottom: 12, background: "linear-gradient(135deg, var(--surface), var(--surface-alt))" }}>
                    <div style={{ display: "flex", gap: 6, overflowX: "auto", scrollbarWidth: "none", marginBottom: 14 }}>
                      {metrics.map((mt) => (
                        <button key={mt.id} type="button" onClick={() => setPeriodMetric(mt.id as typeof periodMetric)} className="pill" style={{ flexShrink: 0, fontSize: 11, padding: "4px 10px", borderColor: periodMetric === mt.id ? "var(--accent)" : "var(--border)", background: periodMetric === mt.id ? "var(--accent-dim)" : "transparent", color: periodMetric === mt.id ? "var(--accent)" : "var(--muted)" }}>{mt.label}</button>
                      ))}
                    </div>
                    {periodMetric === "inflacion"
                      ? (inflPoints.length > 1
                          ? <>
                              {vosAcum != null && (
                                <div style={{ textAlign: "center", marginBottom: 12, display: "flex", justifyContent: "center", gap: 16, flexWrap: "wrap" }}>
                                  <span>
                                    <span style={{ fontSize: 11, color: "var(--muted)" }}>{t.inflationAccYou} </span>
                                    <span style={{ fontSize: 18, fontWeight: 700, fontFamily: "var(--font-mono)", color: vosColor }}>{vosAcum >= 0 ? "+" : ""}{vosAcum}%</span>
                                  </span>
                                  {paisAcum != null && (
                                    <span>
                                      <span style={{ fontSize: 11, color: "var(--muted)" }}>{t.inflationAccCountry} </span>
                                      <span style={{ fontSize: 18, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--accent)" }}>+{paisAcum}%</span>
                                    </span>
                                  )}
                                </div>
                              )}
                              <TwoLineChart points={inflPoints} colorA={vosColor} onPointClick={(pid) => setNavPeriodo({ periodoId: pid, target: "gastos" })} />
                            </>
                          : <div style={{ fontSize: 12, color: "var(--muted)", textAlign: "center", padding: "16px 0" }}>{t.noRecords}</div>)
                      : periodMetric === "gastoSueldo"
                      ? (data.length > 0
                          ? <DotChart data={data} refValue={100} onPointClick={(pid) => setNavPeriodo({ periodoId: pid, target: "gastos" })} />
                          : <div style={{ fontSize: 12, color: "var(--muted)", textAlign: "center", padding: "16px 0" }}>{t.noRecords}</div>)
                      : periodMetric === "dias"
                      ? (data.length > 0
                          ? <AreaChart data={data} onPointClick={(pid) => setNavPeriodo({ periodoId: pid, target: "gastos" })} />
                          : <div style={{ fontSize: 12, color: "var(--muted)", textAlign: "center", padding: "16px 0" }}>{t.noRecords}</div>)
                      : data.length > 0
                      ? <VBars data={data} max={max} oculto={mask ? oculto : undefined} refFrac={refFrac}
                          onBarClick={(pid) => setNavPeriodo({ periodoId: pid, target: periodMetric === "ingreso" ? "ingresos" : "gastos" })} />
                      : <div style={{ fontSize: 12, color: "var(--muted)", textAlign: "center", padding: "16px 0" }}>{t.noRecords}</div>}
                    <div style={{ fontSize: 10, color: "var(--muted)", textAlign: "center", marginTop: 10 }}>{sub}</div>
                  </div>
                );
              })()}

            </>
          )}

          {/* ══ MOVIMIENTOS ══ */}
          {sub === "movimientos" && periodo && movCounts && (
            <>
              {reportOn("movimientos_kpis") && (() => {
                const tipoColor = TIPO_COLOR;
                const promDia = movCounts.diasActivos > 0 ? (movCounts.total / movCounts.diasActivos).toFixed(1) : "0";
                const mayor = periodo.movimientos.filter(m => m.categoria !== "Sueldo" && m.categoria !== "RESTO").reduce<(typeof periodo.movimientos)[number] | null>((mx, m) => (m.monto > (mx?.monto ?? -1) ? m : mx), null);
                return (
                  <>
                  {/* Hero: total + distribución por tipo */}
                  {(() => {
                    return (
                    <div className="soft" style={{ marginBottom: 12, background: "linear-gradient(135deg, var(--surface), var(--teal-dim) 60%, var(--purple-dim))", display: "grid", gridTemplateColumns: "auto 1fr auto", alignItems: "center", gap: 10 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>{t.totalMovements}</div>
                        <div style={{ fontSize: 26, fontWeight: 700, color: "var(--accent)", fontFamily: "var(--font-mono)", letterSpacing: -0.5, lineHeight: 1 }}>{movCounts.total}</div>
                        <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>{t.activeDays(movCounts.diasActivos)}</div>
                      </div>
                      <div style={{ display: "flex", justifyContent: "center" }}>
                        <DonutChart size={92} strokeWidth={13}
                          selected={selectedMovTipo} onSelect={setSelectedMovTipo}
                          data={movCounts.porTipo.map(([tipo, count]) => ({ key: tipo, value: count, color: tipoColor[tipo] ?? "var(--accent)", label: t.tipoDisplay[tipo] ?? tipo }))} />
                      </div>
                      {/* Leyenda tocable: una fila por tipo, selecciona/resalta el slice */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {movCounts.porTipo.map(([tipo, count]) => {
                          const active = selectedMovTipo === tipo;
                          const col = tipoColor[tipo] ?? "var(--accent)";
                          return (
                            <button key={tipo} type="button" aria-pressed={active} aria-label={`${t.tipoDisplay[tipo] ?? tipo}: ${count}`} onClick={() => setSelectedMovTipo(active ? null : tipo)}
                              style={{ display: "flex", alignItems: "center", gap: 5, padding: "3px 8px", borderRadius: 999, cursor: "pointer", transition: "all 0.15s",
                                border: `1px solid ${active ? col : "transparent"}`, background: active ? `${col}1a` : "transparent" }}>
                              <span style={{ width: 7, height: 7, borderRadius: 2, background: col, flexShrink: 0 }} />
                              <span style={{ fontSize: 10, color: active ? "var(--text)" : "var(--muted)", whiteSpace: "nowrap" }}>{t.tipoDisplay[tipo] ?? tipo}</span>
                              <b style={{ fontSize: 10, color: "var(--text)", fontFamily: "var(--font-mono)", marginLeft: "auto" }}>{count}</b>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    );
                  })()}

                  {/* Mini-stats: 2x2 grid — opción C */}
                  {(() => {
                    const hoy = new Date();
                    const esMismaFecha = (fecha: string) => { const d = new Date(fecha.includes("-") ? fecha + "T12:00:00" : fecha.split("/").length === 3 ? (() => { const [dd,mm,yy] = fecha.split("/"); return `${yy}-${mm.padStart(2,"0")}-${dd.padStart(2,"0")}T12:00:00`; })() : fecha); return d.getFullYear() === hoy.getFullYear() && d.getMonth() === hoy.getMonth() && d.getDate() === hoy.getDate(); };
                    const esActivo = finPeriodo === null;
                    const gastoHoy = esActivo
                      ? periodo.movimientos.filter(m => m.tipo === "Gasto" && esMismaFecha(m.fecha)).reduce((s, m) => s + m.monto, 0)
                      : null;
                    const totalDias = Math.max(1, Math.round(((finPeriodo ?? hoy).getTime() - parsePeriodoId(periodo.periodoId).getTime()) / 86400000));
                    const pctDias = kpis ? Math.round((kpis.diasConGasto / totalDias) * 100) : 0;
                    const diaCaro = kpis?.diaMayorGasto;
                    return (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                        <MiniStat center basis="1 1 45%" label={t.today} value={gastoHoy !== null ? (oculto ? "••" : abbr(gastoHoy)) : "—"} gradient="linear-gradient(90deg, #26c6da, var(--purple))"
                          onClick={gastoHoy !== null ? () => setKpiInfo({ title: t.todaySpent, value: oculto ? "••" : formatARS(gastoHoy), explain: t.kpiTodaySpentInfo, color: "#26c6da" }) : undefined} />
                        {diaCaro && <MiniStat center basis="1 1 45%" label={t.highestSpendingDay} value={oculto ? "••" : abbr(diaCaro.monto)} color="var(--red)"
                          onClick={() => setKpiInfo({ title: t.highestSpendingDay, value: oculto ? "••" : formatARS(diaCaro.monto), explain: `${t.kpiHighestDayInfo} (${sinAño(diaCaro.fecha)})`, color: "var(--red)" })} />}
                        {kpis && <MiniStat center basis="1 1 45%" label={t.avgDayWithExpense} value={oculto ? "••" : abbr(kpis.promedioDiario)} gradient="linear-gradient(90deg, #26c6da, var(--purple))"
                          onClick={() => setKpiInfo({ title: t.avgDayWithExpense, value: oculto ? "••" : formatARS(kpis!.promedioDiario), explain: `${t.kpiAvgDayInfo} (${t.daysWithExpenses(kpis!.diasConGasto)})`, color: "#26c6da" })} />}
                        {tendenciaMovs !== null && (() => { const c = tendenciaMovs > 10 ? "var(--red)" : tendenciaMovs < -10 ? "var(--green)" : "var(--yellow)"; const v = `${tendenciaMovs >= 0 ? "+" : ""}${tendenciaMovs}%`; return (
                          <MiniStat center basis="1 1 45%" label={t.trend} value={v} color={c}
                            onClick={() => setKpiInfo({ title: t.trend, value: v, explain: `Período actual: ${periodos[0]?.movimientos.length ?? 0} movimientos · Promedio histórico: ${Math.round(avgHistoricoMovs)}`, color: c })} />
                        ); })()}
                      </div>
                    );
                  })()}
                  </>
                );
              })()}

              {reportOn("movimientos_otros") && (
              <>

              {/* Por categoría (frecuencia + total) */}
              {movCounts.porCat.length > 0 && (
                <div className="soft" style={{ marginBottom: 12, background: "linear-gradient(135deg, var(--surface), var(--surface-alt))", cursor: movCounts.porCat.length > 5 ? "pointer" : undefined }}
                  onClick={movCounts.porCat.length > 5 ? () => setModalTop("movcat") : undefined}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>{t.byCategory}</div>
                  {movCounts.porCat.slice(0, 5).map(({ cat, count, total, color }) => (
                    <div key={cat} style={{ marginBottom: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                        <div style={{ fontSize: 12 }}>{cat}</div>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                          <span style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>{oculto ? "••" : abbr(total)}</span>
                          <span style={{ fontSize: 12, fontWeight: 700, fontFamily: "var(--font-mono)", color }}>{count}</span>
                        </div>
                      </div>
                      <div style={{ height: 4, background: "var(--faint)", borderRadius: 2 }}>
                        <div style={{ height: "100%", width: `${Math.round((count / movCounts.total) * 100)}%`, background: color, borderRadius: 2, transition: "width .5s ease" }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Por medio de pago */}
              {movCounts.porMedio.length > 0 && (
                <div className="soft" style={{ marginBottom: 12, background: "linear-gradient(135deg, var(--surface), var(--surface-alt))" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>{t.byPaymentMethod}</div>
                  {movCounts.porMedio.map(({ medio, count, tipos }) => (
                    <div key={medio} style={{ marginBottom: 12, cursor: "pointer" }} onClick={() => setMedioModal(medio)}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                        <span style={{ fontSize: 12 }}>{medio}</span>
                        <div style={{ display: "flex", gap: 6 }}>
                          {tipos.map(({ tipo, n }) => (
                            <span key={tipo} style={{ fontSize: 11, fontWeight: 700, fontFamily: "var(--font-mono)", color: TIPO_COLOR[tipo] ?? "var(--accent)" }}>{n}</span>
                          ))}
                        </div>
                      </div>
                      <div style={{ height: 5, background: "var(--faint)", borderRadius: 999, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${Math.round((count / movCounts.total) * 100)}%`, display: "flex", borderRadius: 999, overflow: "hidden", transition: "width .5s ease" }}>
                          {tipos.map(({ tipo, n }) => (
                            <div key={tipo} style={{ flex: n, background: TIPO_COLOR[tipo] ?? "var(--accent)" }} />
                          ))}
                        </div>
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
      )}

      {/* Card: ir al período seleccionado en el gráfico */}
      <BottomSheet open={!!navPeriodo} onClose={() => setNavPeriodo(null)} title={t.goToPeriodTitle}>
        {navPeriodo && (
          <>
            <div style={{ fontSize: 13, color: "var(--muted)", marginTop: -8, marginBottom: 20 }}>
              {(navPeriodo.target === "ingresos" ? t.goToPeriodIncome : t.goToPeriodSpent)(shortPer(navPeriodo.periodoId))}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setNavPeriodo(null)} style={{ flex: 1, padding: "13px 0", borderRadius: 14, fontSize: 14, fontWeight: 600, cursor: "pointer", background: "transparent", border: "1px solid var(--border)", color: "var(--muted)" }}>{t.cancel}</button>
              <button onClick={() => { setPeriodosSelIds([navPeriodo.periodoId]); setSub(navPeriodo.target); setNavPeriodo(null); }}
                className="btn" style={{ flex: 1, padding: "13px 0", borderRadius: 14, fontSize: 14, fontWeight: 700, cursor: "pointer", color: "#fff", border: "none", background: "linear-gradient(110deg, var(--blue) 10%, var(--green) 130%)" }}>{t.goToPeriodConfirm}</button>
            </div>
          </>
        )}
      </BottomSheet>

      {/* Modal: Historial de aumentos de sueldo */}
      <BottomSheet open={modalSueldo} onClose={() => setModalSueldo(false)} title={t.salaryHistory}>
        {suelHistorial.map((ev, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0", borderBottom: i < suelHistorial.length - 1 ? "1px solid var(--faint)" : "none" }}>
            <div>
              <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>{ev.cuando}</div>
              <div style={{ fontSize: 13, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>
                {money(ev.de)} → {money(ev.a)}
              </div>
            </div>
            <span style={{ fontSize: 18, fontWeight: 700, color: "var(--green)", fontFamily: "var(--font-mono)" }}>+{ev.pct}%</span>
          </div>
        ))}
      </BottomSheet>

      {/* Modal: Todo lo directo a ahorros */}
      <BottomSheet open={modalAhorros} onClose={() => setModalAhorros(false)} title={t.directToSavings}>
        {movIngresosAhorros.map((m) => (
          <div key={m.id} className="row" style={{ padding: "10px 0", borderBottom: "1px solid var(--faint)" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.descripcion || m.origenAhorro || m.categoria}</div>
              <div style={{ fontSize: 10, color: "var(--muted)" }}>{sinAño(m.fecha)}</div>
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--blue)", fontFamily: "var(--font-mono)", whiteSpace: "nowrap" }}>+{money(m.monto)}</span>
          </div>
        ))}
      </BottomSheet>

      {/* Modal: Todos los top gastos/descripciones */}
      <BottomSheet open={!!modalTop} onClose={() => setModalTop(null)}
        title={modalTop === "gastos" ? t.top20Expenses : modalTop === "movcat" ? t.allCategories : t.allDescriptions}>
            {modalTop === "descs" && descsModal.map((d, i) => (
              <div key={d.nombre} className="row" style={{ padding: "12px 0" }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", minWidth: 0 }}>
                  <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", width: 14, background: "linear-gradient(110deg, var(--blue) 10%, var(--green) 90%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>{i + 1}</span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13 }}>{d.nombre || "—"}</div>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", fontFamily: "var(--font-mono)" }}>{money(d.monto)}</div>
                  <div style={{ fontSize: 10, color: "var(--muted)" }}>{d.pct}%</div>
                </div>
              </div>
            ))}
            {modalTop === "movcat" && movCounts && movCounts.porCat.map(({ cat, count, total, color }, i) => (
              <div key={cat} className="row" style={{ padding: "12px 0" }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", minWidth: 0 }}>
                  <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", width: 14, background: "linear-gradient(110deg, var(--blue) 10%, var(--green) 90%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>{i + 1}</span>
                  <div style={{ fontSize: 13, flex: 1, minWidth: 0 }}>{cat || "—"}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color, fontFamily: "var(--font-mono)" }}>{count}×</div>
                  <div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>{oculto ? "••" : abbr(total)}</div>
                </div>
              </div>
            ))}
      </BottomSheet>

      <BottomSheet open={!!diaModal} onClose={() => setDiaModal(null)} title={diaModal ?? ""}>
        {(() => {
          if (!diaModal) return null;
          const fechaOriginal = porFecha.find((f) => sinAño(f.nombre) === diaModal)?.nombre ?? diaModal;
          const movsDia = (periodo?.movimientos ?? []).filter((m) => esGasto(m) && (sinAño(m.fecha) === diaModal || m.fecha === fechaOriginal)).sort((a, b) => b.monto - a.monto);
          const totalDia = movsDia.reduce((s, m) => s + m.monto, 0);
          return (
            <>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: -8, marginBottom: 16 }}>{`${money(totalDia)} · ${t.expensesCount(movsDia.length)}`}</div>
              {movsDia.map((m, i) => { const esCompra = m.tipo === "CompraUSD"; return (
                <div key={i} className="row" style={{ padding: "11px 0" }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{m.descripcion || (esCompra ? t.buyUsd : "—")}</div>
                    <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>{esCompra ? `${m.cantidadUSD ? `U$D ${m.cantidadUSD}` : t.reserve}${m.medioPago ? ` · ${m.medioPago}` : ""}` : `${m.categoria} · ${m.medioPago}`}</div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: esCompra ? "var(--yellow)" : "var(--red)", fontFamily: "var(--font-mono)", flexShrink: 0 }}>{money(m.monto)}</div>
                </div>
              ); })}
            </>
          );
        })()}
      </BottomSheet>

      {kpiInfo && <KpiInfoModal title={kpiInfo.title} value={kpiInfo.value} explain={kpiInfo.explain} color={kpiInfo.color} onClose={() => setKpiInfo(null)} />}

      {/* Modal: gastos de una categoría */}
      <BottomSheet open={!!catModal} onClose={() => setCatModal(null)} title={catModal ?? ""}>
        {(() => {
          if (!catModal || !periodo) return null;
          const movsCat = periodo.movimientos
            .filter((m) => (m.tipo === "Gasto" || m.tipo === "CompraUSD") && m.categoria === catModal)
            .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
          const totalCat = movsCat.reduce((s, m) => s + m.monto, 0);
          const budgetCat = presupuesto?.[catModal];
          return (
            <>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: -8, marginBottom: 16, display: "flex", gap: 10, alignItems: "center" }}>
                <span>{money(totalCat)} · {t.expensesCount(movsCat.length)}</span>
                {budgetCat && !oculto && (() => {
                  const usedPct = Math.round((totalCat / budgetCat) * 100);
                  const bc = usedPct > 100 ? "var(--red)" : usedPct > 80 ? "var(--yellow)" : "var(--green)";
                  return <span style={{ color: bc, fontWeight: 600 }}>{t.budget}: {money(budgetCat)} · {usedPct}%</span>;
                })()}
              </div>
              {movsCat.map((m) => (
                <div key={m.id} className="row" style={{ padding: "11px 0" }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.descripcion || "—"}</div>
                    <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>{sinAño(m.fecha)} · {m.medioPago}</div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", fontFamily: "var(--font-mono)", flexShrink: 0, marginLeft: 12 }}>{money(m.monto)}</div>
                </div>
              ))}
              {movsCat.length === 0 && (
                <div style={{ textAlign: "center", padding: "24px 0", color: "var(--muted)", fontSize: 13 }}>{t.noMovements}</div>
              )}
            </>
          );
        })()}
      </BottomSheet>

      {/* Modal: detalle por medio de pago — totales por tipo de movimiento */}
      <BottomSheet open={!!medioModal} onClose={() => setMedioModal(null)} title={medioModal ?? ""}>
        {(() => {
          if (!medioModal) return null;
          const data = movCounts?.porMedio.find((p) => p.medio === medioModal);
          if (!data) return null;
          return (
            <>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: -8, marginBottom: 16 }}>{money(data.total)} · {data.count}×</div>
              {data.tipos.map(({ tipo, n, monto }) => (
                <div key={tipo} className="row" style={{ padding: "11px 0" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: TIPO_COLOR[tipo] ?? "var(--accent)", flexShrink: 0 }} />
                    <span style={{ fontSize: 13 }}>{t.tipoDisplay[tipo] ?? tipo}</span>
                    <span style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>{n}×</span>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", fontFamily: "var(--font-mono)", flexShrink: 0, marginLeft: 12 }}>{money(monto)}</div>
                </div>
              ))}
            </>
          );
        })()}
      </BottomSheet>

      {/* Modal: editar presupuesto del período */}
      <BottomSheet open={modalBudget} onClose={() => setModalBudget(false)} title={t.budgetPeriod}>
        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: -10, marginBottom: 16 }}>
          {activos[0] ? shortPer(activos[0]) : ""}
          {config?.meta.presupuestoTemplate && Object.keys(config.meta.presupuestoTemplate).length > 0 && (
            <span style={{ marginLeft: 8, color: "var(--accent)" }}>· {t.budgetTemplate}</span>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
          {cats.map((c) => (
            <div key={c.categoria} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ flex: 1, fontSize: 13, color: "var(--text)" }}>{c.categoria}</span>
              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <span style={{ position: "absolute", left: 10, fontSize: 13, color: "var(--muted)", pointerEvents: "none" }}>$</span>
                <input
                  type="number"
                  inputMode="numeric"
                  value={editingBudget[c.categoria] ?? ""}
                  onChange={(e) => setEditingBudget((prev) => ({ ...prev, [c.categoria]: e.target.value }))}
                  placeholder="0"
                  className="input"
                  style={{ width: 130, paddingLeft: 22, textAlign: "right", fontFamily: "var(--font-mono)" }}
                />
              </div>
            </div>
          ))}
        </div>
        {(() => {
          const saved = presupuesto ?? {};
          const budgetIsDirty = cats.some(c => {
            const editVal = Math.round(parseFloat(editingBudget[c.categoria] ?? "") || 0);
            const savedVal = Math.round(saved[c.categoria] ?? 0);
            return editVal !== savedVal;
          });
          const disabled = budgetSaving || !budgetIsDirty;
          return (
            <button
              disabled={disabled}
              onClick={async () => {
                if (!user?.uid || !activos[0]) return;
                setBudgetSaving(true);
                try {
                  const categorias: Record<string, number> = {};
                  for (const [cat, val] of Object.entries(editingBudget)) {
                    const n = parseFloat(val);
                    if (!isNaN(n) && n > 0) categorias[cat] = n;
                  }
                  await guardarPresupuesto(user.uid, activos[0], categorias);
                  setPresupuesto(categorias);
                  setModalBudget(false);
                } finally {
                  setBudgetSaving(false);
                }
              }}
              style={{ width: "100%", padding: "14px 0", borderRadius: "var(--radius-sm)", background: "var(--accent)", border: "none", color: "#fff", fontSize: 15, fontWeight: 700, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.35 : 1, transition: "opacity 0.2s" }}>
              {budgetSaving ? "…" : t.save}
            </button>
          );
        })()}
      </BottomSheet>
    </div>
  );
}
