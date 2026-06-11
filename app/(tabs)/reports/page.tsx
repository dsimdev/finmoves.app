"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useT } from "@/hooks/useTranslation";
import { useAllMovimientos } from "@/hooks/useAllMovimientos";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/services/firebase/firebase";
import { agruparPorPeriodo, gastosPorCategoria, formatARS } from "@/utils/periodo";
import { useMoney, MASK } from "@/hooks/useHideValues";
import {
  gastosPorMedioPago, gastosPorDescripcion, gastosPorFecha,
  kpisPeriodo, ritmoGasto, comparativaCategorias,
  serieTendencia, parsePeriodoId, diasSinGastos,
  evolucionSueldo, historialSueldo, proyectarAhorros,
  progresoMetaUSD, periodosParaMetaUSD,
} from "@/utils/reportes";
import { useCotizacion } from "@/hooks/useCotizacion";
import { useConfig } from "@/hooks/useConfig";
import { useReportConfig } from "@/hooks/useReportConfig";
import { useAppPrefs } from "@/hooks/useAppPrefs";
import { EyeIcon } from "@/components/EyeIcon";
import { LoadingSpinner } from "@/components/LoadingSpinner";

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

function VBars({ data, max, oculto, onBarClick }: { data: { label: string; value: number; color: string; hi?: boolean }[]; max: number; oculto?: boolean; onBarClick?: (label: string) => void }) {
  return (
    <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, alignItems: "flex-end", scrollbarWidth: "none" }}>
      {data.map((d, i) => (
        <div key={i} onClick={() => onBarClick?.(d.label)} style={{ flexShrink: 0, width: 36, display: "flex", flexDirection: "column", alignItems: "center", gap: 5, cursor: onBarClick ? "pointer" : "default" }}>
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
  const { movimientos, loading } = useAllMovimientos(user?.uid);
  const { cotizacion } = useCotizacion();
  const { config } = useConfig(user?.uid);
  const { isEnabled: reportOn } = useReportConfig();
  const { monedaInversiones } = useAppPrefs();

  const periodos = useMemo(() => agruparPorPeriodo(movimientos), [movimientos]);
  const [sub, setSub] = useState<Sub>("gastos");
  const [periodosSelIds, setPeriodosSelIds] = useState<string[]>([]);
  const [modalTop, setModalTop] = useState<"gastos" | "descs" | "movdescs" | "movcat" | null>(null);
  const [modalTopExpanded, setModalTopExpanded] = useState(false);
  const [modalSueldo, setModalSueldo] = useState(false);
  const [modalSueldoExpanded, setModalSueldoExpanded] = useState(false);
  const [diaModal, setDiaModal] = useState<string | null>(null);
  const [diaModalExpanded, setDiaModalExpanded] = useState(false);
  const sheetDragY = useRef<number | null>(null);
  const [proyPeriodos, setProyPeriodos] = useState(6);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggered = useRef(false);
  const longPressTimerYear = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggeredYear = useRef(false);

  // Multi-select: si no hay selección, usa el primero
  const activos = periodosSelIds.length > 0 ? periodosSelIds : [periodos[0]?.periodoId].filter(Boolean);
  const periodosActivos = periodos.filter((p) => activos.includes(p.periodoId));

  // Combina todos los períodos seleccionados en uno virtual
  const periodo = periodosActivos.length > 0 ? {
    periodoId: activos.length === 1 ? activos[0]! : t.virtualPeriods(activos.length),
    sueldo: periodosActivos.reduce((sum, p) => sum + p.sueldo, 0),
    extras: periodosActivos.reduce((sum, p) => sum + p.extras, 0),
    total: periodosActivos.reduce((sum, p) => sum + p.total, 0),
    gastado: periodosActivos.reduce((sum, p) => sum + p.gastado, 0),
    ahorros: periodosActivos.reduce((sum, p) => sum + p.ahorros, 0),
    resto: periodosActivos.reduce((sum, p) => sum + p.resto, 0),
    disponible: periodosActivos.reduce((sum, p) => sum + p.disponible, 0),
    moveTotal: periodosActivos.reduce((sum, p) => sum + p.moveTotal, 0),
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
  const porFecha = periodo ? gastosPorFecha(periodo.movimientos, periodo.gastado) : [];
  const kpis = periodo ? kpisPeriodo(periodo) : null;
  // Ritmo y comparativa sólo aplican a un período individual
  const ritmo = periodo && activos.length === 1 ? ritmoGasto(periodo, finPeriodo) : null;
  const comp = periodo && activos.length === 1 ? comparativaCategorias(periodo, anterior) : [];

  // ── Estadísticas avanzadas (Gastos) ──
  const promPorMov = periodo && kpis && kpis.cantGastos > 0 ? periodo.gastado / kpis.cantGastos : null;
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

  const totalIngresos = periodo ? periodo.sueldo + periodo.moveTotal : 0;
  const totalAhorradoDirecto = movIngresosAhorros.reduce((s, m) => s + m.monto, 0);

  const ingXCat: { cat: string; monto: number; pct: number }[] = (() => {
    if (!periodo) return [];
    const catMap = new Map<string, number>();
    if (periodo.sueldo > 0) catMap.set("Sueldo", periodo.sueldo);
    if (periodo.moveTotal > 0) catMap.set("Retiros", periodo.moveTotal);
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

  const ingresosAnteriores = anterior ? anterior.sueldo + anterior.moveTotal : 0;
  const deltaIngresos = anterior && ingresosAnteriores > 0
    ? Math.round(((totalIngresos - ingresosAnteriores) / ingresosAnteriores) * 100)
    : null;

  const ingXDesc: { cat: string; monto: number; pct: number }[] = (() => {
    if (!periodo) return [];
    const descMap = new Map<string, number>();
    for (const m of periodo.movimientos) {
      // Incluye todos los ingresos reales (a disponible Y a ahorros directo)
      if (m.tipo === "Ingreso" && m.categoria !== "RESTO" && m.categoria !== "Sueldo") {
        const key = m.descripcion || m.categoria;
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
  const evolSueldo = evolucionSueldo(periodos);
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

  const serie = useMemo(() => serieTendencia(periodos, seedPeriodoId), [periodos, seedPeriodoId]);
  const serieDesc = useMemo(() => [...serie].reverse(), [serie]);
  const maxTotal = Math.max(...serie.map((s) => s.total), 1);

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
  const SALDO_INICIAL = monedaInversiones === "EUR" ? 0 : 5.77;
  const reservaFX = useMemo(() => {
    let total = SALDO_INICIAL;
    for (const m of movimientos) {
      if (m.tipo === tipoCompraFX && m.cantidadUSD) total += m.cantidadUSD;
      else if (m.tipo === tipoGastoFX && m.cantidadUSD) total -= m.cantidadUSD;
    }
    return Math.max(0, total);
  }, [movimientos, tipoCompraFX, tipoGastoFX]);

  const metaMonto = config?.meta.metaMonto;
  const progresoMeta = metaMonto && cotizActual ? progresoMetaUSD(reservaFX * cotizActual, metaMonto, cotizActual) : null;
  const periodosParaMetaMonto = metaMonto && cotizActual ? periodosParaMetaUSD(serie, metaMonto, cotizActual) : null;
  const ahorrosEnUSD = reservaFX > 0 ? reservaFX : null;
  const promAhorroUSD = cotizActual && serie.length > 0
    ? (serie.reduce((s, p) => s + Math.max(0, p.ahorros), 0) / serie.length) / cotizActual : null;
  const proyUSD = cotizActual && serie.length >= 2 ? proyectarAhorros(serie, 3) / cotizActual : null;

  // ── Tendencias: Gastos ──
  const promGastoPorPeriodo = periodos.length > 0
    ? Math.round(periodos.reduce((s, p) => s + p.gastado, 0) / periodos.length) : 0;
  const avgUlt3 = periodos.slice(0, 3).reduce((s, p) => s + p.gastado, 0) / Math.max(periodos.slice(0, 3).length, 1);
  const avgPrev3 = periodos.slice(3, 6).reduce((s, p) => s + p.gastado, 0) / Math.max(periodos.slice(3, 6).length, 1);
  const tendenciaGasto = periodos.length >= 4
    ? Math.round(((avgUlt3 - avgPrev3) / avgPrev3) * 100) : null;
  const proyeccionGasto = periodos.length >= 2 ? Math.round(avgUlt3) : null;

  // ── Movimientos: estadísticas de frecuencia ──
  const movCounts = useMemo(() => {
    if (!periodo) return null;
    const movs = periodo.movimientos;
    const tipoColor: Record<string, string> = {
      Gasto: "var(--red)", Ingreso: "var(--green)", Move: "var(--yellow)",
      CompraUSD: "var(--yellow)", CompraEUR: "var(--yellow)",
      GastoUSD: "var(--red)", GastoEUR: "var(--red)",
    };
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
    for (const m of movs) porTipoMap.set(m.tipo, (porTipoMap.get(m.tipo) ?? 0) + 1);
    // Per-group type tracking
    const catTipo = new Map<string, Map<string, number>>();
    const descTipo = new Map<string, Map<string, number>>();
    const medioTipo = new Map<string, Map<string, number>>();
    for (const m of movs) {
      if (m.categoria && m.categoria !== "RESTO") {
        if (!catTipo.has(m.categoria)) catTipo.set(m.categoria, new Map());
        const t = catTipo.get(m.categoria)!; t.set(m.tipo, (t.get(m.tipo) ?? 0) + 1);
      }
      const dk = m.descripcion || m.categoria;
      if (dk && dk !== "RESTO") {
        if (!descTipo.has(dk)) descTipo.set(dk, new Map());
        const t = descTipo.get(dk)!; t.set(m.tipo, (t.get(m.tipo) ?? 0) + 1);
      }
      if (m.medioPago) {
        if (!medioTipo.has(m.medioPago)) medioTipo.set(m.medioPago, new Map());
        const t = medioTipo.get(m.medioPago)!; t.set(m.tipo, (t.get(m.tipo) ?? 0) + 1);
      }
    }
    const porCat = [...catTipo.entries()].map(([cat, t]) => ({ cat, count: [...t.values()].reduce((a,b)=>a+b,0), color: domColor(t) })).sort((a,b)=>b.count-a.count);
    const porDesc = [...descTipo.entries()].map(([desc, t]) => ({ desc, count: [...t.values()].reduce((a,b)=>a+b,0), color: domColor(t) })).sort((a,b)=>b.count-a.count);
    const porMedio = [...medioTipo.entries()].map(([medio, t]) => ({ medio, count: [...t.values()].reduce((a,b)=>a+b,0), color: domColor(t) })).sort((a,b)=>b.count-a.count);
    const porDow = [0,0,0,0,0,0,0];
    for (const m of movs) {
      if (m.fecha) porDow[new Date(m.fecha.includes("-") ? m.fecha + "T12:00:00" : m.fecha).getDay()]++;
    }
    return {
      total: movs.length,
      diasActivos: porFechaMap.size,
      diaMasActivo, diaMasActivoN,
      porTipo: [...porTipoMap.entries()].sort((a,b)=>b[1]-a[1]),
      porCat, porDesc, porMedio, porDow,
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
            <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.5, display: "inline-block", background: "linear-gradient(110deg, var(--blue) 10%, var(--green) 90%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>Reports</div>
          </div>
          <div className="subtabs">
            {SUBS.map((s) => {
              const isActive = sub === s.id;
              const tabColor = s.id === "gastos" ? "var(--red)" : s.id === "ingresos" ? "var(--green)" : "var(--blue)";
              const tabDim   = s.id === "gastos" ? "var(--red-dim)" : s.id === "ingresos" ? "var(--green-dim)" : "var(--blue-dim)";
              return (
                <button key={s.id} onClick={() => setSub(s.id)} className="subtab"
                  style={isActive ? { background: `linear-gradient(135deg, var(--surface-alt) 0%, ${tabDim} 100%)`, color: tabColor, border: `1px solid ${tabColor}44` } : {}}>
                  {s.label}
                </button>
              );
            })}
          </div>
          {/* Selector de período — agrupado por año, multi-select con long press */}
          {(() => {
            const subColor = sub === "gastos" ? "var(--red)" : sub === "ingresos" ? "var(--green)" : "var(--blue)";
            const subDim   = sub === "gastos" ? "var(--red-dim)" : sub === "ingresos" ? "var(--green-dim)" : "var(--blue-dim)";
            const años = Array.from(new Set(periodos.map((p) => periodoAnio(p.periodoId))));
            // Todos los años que tienen al menos un período seleccionado
            const añosActivos = new Set(activos.map((id) => periodoAnio(id)));
            // Pills: si hay multi-año, mostrar todos los activos; si no, solo el del primer seleccionado
            const añoVista = periodoAnio(activos[0] ?? periodos[0]?.periodoId ?? "");
            const pilisAMostrar = añosActivos.size > 1
              ? periodos.filter((p) => añosActivos.has(periodoAnio(p.periodoId)))
              : periodos.filter((p) => periodoAnio(p.periodoId) === añoVista);
            return (
              <div style={{ marginBottom: 16 }}>
                {/* Tabs de año — click: selecciona primer período; long press: toggle todos los del año */}
                <div style={{ display: "flex", gap: 4, overflowX: "auto", padding: "3px 3px 4px", marginBottom: 4, scrollbarWidth: "none", touchAction: "pan-x" }}>
                  {años.map((año) => {
                    const isAñoActivo = añosActivos.has(año);
                    return (
                      <button
                        key={año}
                        onPointerDown={() => {
                          longPressTriggeredYear.current = false;
                          longPressTimerYear.current = setTimeout(() => {
                            longPressTriggeredYear.current = true;
                            const idsDelAño = periodos.filter((p) => periodoAnio(p.periodoId) === año).map((p) => p.periodoId);
                            setPeriodosSelIds((prev) => {
                              const current = prev.length > 0 ? prev : [periodos[0]?.periodoId].filter(Boolean) as string[];
                              const todosSeleccionados = idsDelAño.every((id) => current.includes(id));
                              return todosSeleccionados
                                ? current.filter((id) => !idsDelAño.includes(id))
                                : Array.from(new Set([...current, ...idsDelAño]));
                            });
                          }, 400);
                        }}
                        onPointerUp={() => { if (longPressTimerYear.current) clearTimeout(longPressTimerYear.current); }}
                        onPointerCancel={() => { if (longPressTimerYear.current) clearTimeout(longPressTimerYear.current); }}
                        onClick={() => {
                          if (longPressTriggeredYear.current) { longPressTriggeredYear.current = false; return; }
                          const primero = periodos.find((p) => periodoAnio(p.periodoId) === año);
                          if (primero) setPeriodosSelIds([primero.periodoId]);
                        }}
                        style={{
                          flexShrink: 0, padding: "4px 12px", borderRadius: 999, fontSize: 10, fontWeight: 700, cursor: "pointer",
                          border: `1px solid ${isAñoActivo ? subColor : "var(--border)"}`,
                          background: isAñoActivo ? subDim : "transparent",
                          color: isAñoActivo ? subColor : "var(--muted)",
                          transition: "all 0.15s",
                          boxShadow: añosActivos.size > 1 && isAñoActivo ? `0 0 0 2px ${subColor}` : "none",
                        }}
                      >{año}</button>
                    );
                  })}
                </div>
                {/* Pills de períodos */}
                <div style={{ display: "flex", gap: 6, overflowX: "auto", padding: "3px 3px 4px", scrollbarWidth: "none", alignItems: "center", touchAction: "pan-x" }}>
                  {pilisAMostrar.map((p) => {
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
                        onPointerUp={() => { if (longPressTimer.current) clearTimeout(longPressTimer.current); }}
                        onPointerCancel={() => { if (longPressTimer.current) clearTimeout(longPressTimer.current); }}
                        onClick={() => {
                          if (longPressTriggered.current) return;
                          setPeriodosSelIds([p.periodoId]);
                        }}
                        style={{
                          flexShrink: 0, padding: "4px 12px", borderRadius: 999, fontSize: 10, fontWeight: 700, cursor: "pointer",
                          border: `1px solid ${isSelected ? subColor : "var(--border)"}`,
                          background: isSelected ? subDim : "transparent",
                          color: isSelected ? subColor : "var(--muted)",
                          transition: "all 0.15s",
                          boxShadow: periodosSelIds.length > 1 && isSelected ? `0 0 0 2px ${subColor}` : "none",
                        }}
                      >{shortPer(p.periodoId)}</button>
                    );
                  })}
                  {activos.length > 1 && (
                    <span style={{ fontSize: 10, color: "var(--muted)", marginLeft: 6, whiteSpace: "nowrap" }}>
                      {activos.length}×
                    </span>
                  )}
                </div>
              </div>
            );
          })()}

          {/* ══ GASTOS ══ */}
          {sub === "gastos" && periodo && kpis && (
            <>
              {/* Ritmo de gasto (sólo para período individual) */}
              {ritmo && reportOn("gastos_kpis") && (
              <div className="soft" style={{ marginBottom: 12, background: "linear-gradient(135deg, var(--surface), var(--red-dim))", borderColor: "var(--red)22" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>{t.spendingPace}</div>
                  <button onClick={toggle} aria-label={t.hideValues} style={{
                    background: "transparent", border: "none", color: oculto ? "var(--accent)" : "var(--muted)",
                    width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0,
                  }}>
                    <EyeIcon off={oculto} />
                  </button>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                  <div>
                    <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "var(--font-mono)" }}>{money(ritmo.gastadoPorDia)}<span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 400 }}>{t.perDay}</span></div>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>{t.projection30days(money(ritmo.proyeccionCierre))}</div>
                  </div>
                  {ritmo.enCurso && <span className="badge" style={{ background: "var(--green-dim)", color: "var(--green)", border: "1px solid var(--green)44" }}>{t.ongoing}</span>}
                </div>
              </div>
              )}

              {/* KPIs fila 1: Gastado + Prom/día */}
              {reportOn("gastos_kpis") && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                <Stat label={t.spent} value={money(periodo.gastado)} sub={t.ofTotal(periodo.pct)} color={colorPct(periodo.pct)} danger={periodo.pct > 100} dimVar={periodo.pct > 90 ? "var(--red-dim)" : periodo.pct > 50 ? "var(--yellow-dim)" : "var(--green-dim)"} />
                {ritmo && <Stat label={t.avgDayWithExpense} value={money(kpis.promedioDiario)} sub={t.daysWithExpenses(kpis.diasConGasto)} color="var(--red)" dimVar="var(--red-dim)" />}
                {activos.length > 1 && (() => {
                  const oldest = periodosActivos[periodosActivos.length - 1];
                  const newest = periodosActivos[0];
                  const idxNewest = periodos.findIndex((p) => p.periodoId === newest?.periodoId);
                  const endDate = idxNewest > 0 ? parsePeriodoId(periodos[idxNewest - 1].periodoId) : new Date();
                  const startDate = parsePeriodoId(oldest?.periodoId || "");
                  const dias = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
                  const rango = `${shortPer(oldest?.periodoId || "")} → ${shortPer(newest?.periodoId || "")}`;
                  return <Stat label={t.days} value={String(Math.abs(dias))} sub={rango} color="var(--blue)" dimVar="var(--blue-dim)" />;
                })()}
              </div>
              )}

              {/* KPIs fila 2: Mayor gasto 50% | Movimientos 25% | Días sin gastos 25% */}
              {reportOn("gastos_kpis") && (
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
                <Stat label={t.highestSpendingDay} value={kpis.diaMayorGasto ? money(kpis.diaMayorGasto.monto) : "—"} sub={kpis.diaMayorGasto ? sinAño(kpis.diaMayorGasto.fecha) : undefined} color="var(--red)" dimVar="var(--red-dim)" />
                {diasLibres && <Stat label={t.expenseFreeDays} value={String(diasLibres.sinGasto)} sub={t.ofDays(diasLibres.total)} color="var(--green)" dimVar="var(--green-dim)" />}
                {tendenciaGasto !== null && <Stat label={t.trend} value={`${tendenciaGasto >= 0 ? "+" : ""}${tendenciaGasto}%`} sub={t.last3vsPrev3} color={tendenciaGasto > 10 ? "var(--red)" : tendenciaGasto < -10 ? "var(--green)" : "var(--yellow)"} dimVar={tendenciaGasto > 10 ? "var(--red-dim)" : tendenciaGasto < -10 ? "var(--green-dim)" : "var(--yellow-dim)"} />}
              </div>
              )}

              {/* KPIs fila 3: Prom. por gasto | Proyección */}
              {reportOn("gastos_kpis") && (promPorMov !== null || proyeccionGasto !== null) && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 18 }}>
                {promPorMov !== null && <Stat label={t.avgPerExpense} value={money(promPorMov)} sub={t.transactions(kpis.cantGastos)} color="var(--red)" dimVar="var(--red-dim)" />}
                {proyeccionGasto !== null && <Stat label={t.nextPeriodProjection} value={money(proyeccionGasto)} sub={t.avgLast3} color="var(--red)" dimVar="var(--red-dim)" />}
              </div>
              )}

              {/* Categorías */}
              {reportOn("gastos_otros") && (
              <div className="soft" style={{ marginBottom: 12, background: "linear-gradient(135deg, var(--surface), var(--surface-alt))" }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>{t.byCategory}</div>
                {cats.map((c) => <Bar key={c.categoria} nombre={c.categoria} monto={c.monto} pct={c.pct} oculto={oculto} />)}
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
                        <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--muted)" }}>{c.anterior > 0 ? money(c.anterior) : "—"}</span>
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

              {/* Categoría que más creció */}
              {catMasCrecio && reportOn("gastos_otros") && (
                <div className="soft" style={{ marginBottom: 12, background: "linear-gradient(135deg, var(--surface), var(--red-dim, var(--surface-alt)))", borderColor: "var(--red)22" }}>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 6 }}>{t.fastestGrowingCat}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 14, fontWeight: 700 }}>{catMasCrecio.categoria}</span>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--red)", fontFamily: "var(--font-mono)" }}>{money(catMasCrecio.actual)}</div>
                      <div style={{ fontSize: 10, color: "var(--red)" }}>{t.vsPrevious(catMasCrecio.deltaPct!)}</div>
                    </div>
                  </div>
                </div>
              )}


              {/* Descripción (top) */}
              {reportOn("gastos_otros") && (
              <div className="soft" style={{ marginBottom: 12, cursor: "pointer", background: "linear-gradient(135deg, var(--surface), var(--surface-alt))" }} onClick={() => setModalTop("descs")}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>{t.top5Descriptions}</div>
                {descs.map((d) => <Bar key={d.nombre} nombre={d.nombre} monto={d.monto} pct={d.pct} color="var(--yellow)" oculto={oculto} />)}
              </div>
              )}

              {/* Medios de pago */}
              {reportOn("gastos_otros") && (
              <div className="soft" style={{ marginBottom: 12, background: "linear-gradient(135deg, var(--surface), var(--surface-alt))" }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Por medio de pago</div>
                {medios.map((m) => <Bar key={m.nombre} nombre={m.nombre} monto={m.monto} pct={m.pct} color="var(--blue)" oculto={oculto} />)}
              </div>
              )}

              {/* Por fecha */}
              {reportOn("gastos_otros") && porFecha.length > 0 && (
                <div className="soft" style={{ marginBottom: 12, background: "linear-gradient(135deg, var(--surface), var(--surface-alt))" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>{t.byDay}</div>
                  <VBars max={Math.max(...porFecha.map((f) => f.monto), 1)} oculto={oculto} data={porFecha.map((f) => ({ label: sinAño(f.nombre), value: f.monto, color: "var(--red)" }))} onBarClick={(label) => { setDiaModal(label); setDiaModalExpanded(false); }} />
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
              <div className="soft" style={{ marginBottom: 12, background: "linear-gradient(135deg, var(--surface), var(--green-dim))", borderColor: "var(--green)33" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>{t.availableIncome}</div>
                  <button onClick={toggle} aria-label={t.hideValues} style={{
                    background: "transparent", border: "none", color: oculto ? "var(--accent)" : "var(--muted)",
                    width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0,
                  }}>
                    <EyeIcon off={oculto} />
                  </button>
                </div>
                <div style={{ fontSize: 34, fontWeight: 700, color: "var(--green)", letterSpacing: -1, lineHeight: 1, fontFamily: "var(--font-mono)" }}>
                  {money(totalIngresos)}
                </div>
                {deltaIngresos !== null && (
                  <div style={{ marginTop: 8, fontSize: 12, color: deltaIngresos >= 0 ? "var(--green)" : "var(--red)", fontWeight: 600 }}>
                    {deltaIngresos >= 0 ? "↑" : "↓"}{Math.abs(deltaIngresos)}% vs {shortPer(anterior!.periodoId)}
                  </div>
                )}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                {evolSueldo ? (
                  <div className="soft" onClick={suelHistorial.length > 0 ? () => setModalSueldo(true) : undefined} style={{ padding: 15, cursor: suelHistorial.length > 0 ? "pointer" : undefined, background: evolSueldo.esVacaciones ? "linear-gradient(135deg, var(--surface), var(--yellow-dim))" : "linear-gradient(135deg, var(--surface), var(--green-dim))", borderColor: evolSueldo.esVacaciones ? "var(--yellow)33" : "var(--green)33" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>{t.salary}</div>
                      {evolSueldo.esVacaciones && <span className="badge" style={{ background: "var(--yellow-dim)", color: "var(--yellow)", border: "1px solid var(--yellow)44", fontSize: 9 }}>{t.leave}</span>}
                      {!evolSueldo.esVacaciones && evolSueldo.deltaPct !== null && (
                        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--green)", fontFamily: "var(--font-mono)" }}>{evolSueldo.deltaPct >= 0 ? "+" : ""}{evolSueldo.deltaPct}%</div>
                      )}
                    </div>
                    <div style={{ fontSize: 19, fontWeight: 700, color: "var(--green)", fontFamily: "var(--font-mono)", lineHeight: 1.05 }}>{money(evolSueldo.ultimo)}</div>
                    {evolSueldo.anterior !== null && <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>Anterior: {money(evolSueldo.anterior)}</div>}
                  </div>
                ) : (
                  <Stat label={t.salary} value={money(periodo.sueldo)} color="var(--green)" dimVar="var(--green-dim)" />
                )}
                {periodo.moveTotal > 0 && <Stat label={t.withdrawals} value={money(periodo.moveTotal)} sub={t.fromSavings} color="var(--yellow)" dimVar="var(--yellow-dim)" />}
              </div>

              {/* Total ingresado */}
              {reportOn("ingresos_kpis") && totalAhorradoDirecto > 0 && (
                <div className="soft" style={{ marginBottom: 12, background: "linear-gradient(135deg, var(--surface), var(--green-dim))", borderColor: "var(--green)22" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 6 }}>{t.totalIncome}</div>
                      <div style={{ fontSize: 26, fontWeight: 700, color: "var(--green)", fontFamily: "var(--font-mono)", letterSpacing: -0.5, lineHeight: 1 }}>
                        {money(periodo.sueldo + totalAhorradoDirecto)}
                      </div>
                      <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 8 }}>
                        {t.salaryPlusSavings}
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 12 }}>
                      <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>{t.salary}</div>
                      <div style={{ fontSize: 12, fontWeight: 700, fontFamily: "var(--font-mono)" }}>{money(periodo.sueldo)}</div>
                      <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 6, marginBottom: 4 }}>{t.toSavingsLabel}</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--blue)", fontFamily: "var(--font-mono)" }}>{money(totalAhorradoDirecto)}</div>
                    </div>
                  </div>
                </div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                <div className="soft" style={{ padding: 15, background: "linear-gradient(135deg, var(--surface), var(--blue-dim))", borderColor: "var(--blue)22" }}>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 7 }}>{t.accumSavings}</div>
                  <div style={{ fontSize: 19, fontWeight: 700, color: "var(--blue)", fontFamily: "var(--font-mono)", lineHeight: 1.05 }}>
                    {ahorrosAcumPeriodo > 0 ? money(ahorrosAcumPeriodo) : "—"}
                  </div>
                  {deltaAhorros !== null && (
                    <div style={{ fontSize: 10, color: deltaAhorros >= 0 ? "var(--green)" : "var(--red)", marginTop: 4, fontFamily: "var(--font-mono)" }}>
                      {deltaAhorros >= 0 ? "+" : ""}{money(deltaAhorros)}
                      {deltaAhorrosPct !== null && <span style={{ fontFamily: "var(--font)" }}> ({deltaAhorrosPct >= 0 ? "+" : ""}{deltaAhorrosPct}% vs {shortPer(anterior!.periodoId)})</span>}
                    </div>
                  )}
                </div>
                {serie.length >= 2 && (
                  <div className="soft" style={{ padding: 15, background: "linear-gradient(135deg, var(--surface), var(--blue-dim))", borderColor: "var(--blue)22" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>{t.savingsProjection}</div>
                      <div style={{ display: "flex", gap: 4 }}>
                        {[3, 6, 12].map((n) => (
                          <button key={n} onClick={() => setProyPeriodos(n)} style={{
                            padding: "4px 10px", borderRadius: 999, fontSize: 10, fontWeight: 700, cursor: "pointer",
                            border: `1px solid ${proyPeriodos === n ? "var(--blue)" : "var(--border)"}`,
                            background: proyPeriodos === n ? "var(--blue-dim)" : "transparent",
                            color: proyPeriodos === n ? "var(--blue)" : "var(--muted)",
                          }}>{n}p</button>
                        ))}
                      </div>
                    </div>
                    <div style={{ fontSize: 19, fontWeight: 700, color: "var(--blue)", fontFamily: "var(--font-mono)", lineHeight: 1.05 }}>
                      {money(proyectarAhorros(serie, proyPeriodos))}
                    </div>
                  </div>
                )}
              </div>
              </>
              )}

              {/* Por categoría */}
              {reportOn("ingresos_otros") && ingXCat.length > 0 && (
                <div className="soft" style={{ marginBottom: 12, background: "linear-gradient(135deg, var(--surface), var(--surface-alt))" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>{t.byCategory}</div>
                  {ingXCat.map((c) => (
                    <Bar key={c.cat} nombre={c.cat} monto={c.monto} pct={c.pct} color="var(--green)" oculto={oculto} />
                  ))}
                </div>
              )}

              {/* Por descripción */}
              {reportOn("ingresos_otros") && ingXDesc.length > 0 && (
                <div className="soft" style={{ marginBottom: 12, background: "linear-gradient(135deg, var(--surface), var(--surface-alt))" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>{t.byDescription}</div>
                  {ingXDesc.map((c) => (
                    <Bar key={c.cat} nombre={c.cat} monto={c.monto} pct={c.pct} color="var(--blue)" oculto={oculto} />
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
                      {movIngresosAhorros.map((m) => (
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
              {reportOn("periodos_kpis") && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                <Stat label={t.salary} value={money(periodo.sueldo)} color="var(--green)" dimVar="var(--green-dim)" />
                <Stat label={t.withdrawals} value={periodo.extras > 0 ? money(periodo.extras) : "—"} sub={t.fromSavings} color="var(--yellow)" dimVar="var(--yellow-dim)" />
                <Stat label={t.spent} value={money(periodo.gastado)} sub={`${periodo.pct}%`} color={colorPct(periodo.pct)} danger={periodo.pct > 100} dimVar={periodo.pct > 90 ? "var(--red-dim)" : periodo.pct > 50 ? "var(--yellow-dim)" : "var(--green-dim)"} />
                <Stat label={periodo.periodoId === periodos[0]?.periodoId ? t.available : t.remaining} value={money(periodo.disponible)} color={periodo.disponible >= 0 ? "var(--green)" : "var(--red)"} dimVar={periodo.disponible >= 0 ? "var(--green-dim)" : "var(--red-dim)"} />
                <Stat label={t.projection} value={proyeccionGasto !== null ? money(proyeccionGasto) : "—"} sub={t.nextPeriod} color="var(--red)" dimVar="var(--red-dim)" />
                <Stat label={t.prevPeriodRemaining} value={periodo.resto > 0 ? money(periodo.resto) : "—"} color={periodo.resto > 0 ? "var(--green)" : "var(--muted)"} dimVar={periodo.resto > 0 ? "var(--green-dim)" : undefined} />
              </div>
              )}

              {/* Gastado por período */}
              {reportOn("periodos_otros") && serieDesc.length > 0 && (
                <div className="soft" style={{ marginBottom: 12, background: "linear-gradient(135deg, var(--surface), var(--surface-alt))" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>{t.spentPerPeriod}</div>
                  <VBars max={maxTotal} oculto={oculto} data={serieDesc.map((s) => ({ label: shortPer(s.periodoId), value: s.gastado, color: colorPct(s.total > 0 ? Math.round((s.gastado / s.total) * 100) : 0), hi: activos.includes(s.periodoId) }))} />
                </div>
              )}
              {reportOn("periodos_kpis") && (() => {
                const valid = serieDesc.filter((s) => s.total > 0);
                const mejor = valid.length > 0 ? valid.reduce((b, s) => s.gastado / s.total < b.gastado / b.total ? s : b) : null;
                const peor = valid.length > 0 ? valid.reduce((b, s) => s.gastado / s.total > b.gastado / b.total ? s : b) : null;
                return (
                  <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
                    <Stat label={t.periodAvg} value={money(promGastoPorPeriodo)} sub={t.periodsCount(periodos.length)} color="var(--red)" dimVar="var(--red-dim)" />
                    {mejor && <Stat label={t.bestPeriod} value={shortPer(mejor.periodoId)} sub={`${Math.round((mejor.gastado / mejor.total) * 100)}%`} color="var(--green)" dimVar="var(--green-dim)" />}
                    {peor && <Stat label={t.worstPeriod} value={shortPer(peor.periodoId)} sub={`${Math.round((peor.gastado / peor.total) * 100)}%`} color="var(--red)" dimVar="var(--red-dim)" />}
                  </div>
                );
              })()}

              {/* Gastos vs sueldo por período */}
              {reportOn("periodos_otros") && serieDesc.filter((s) => s.sueldo > 0).length > 0 && (
                <div className="soft" style={{ marginBottom: 12, background: "linear-gradient(135deg, var(--surface), var(--surface-alt))" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>{t.expensesVsSalary}</div>
                  {(() => {
                    const data = serieDesc.filter((s) => s.sueldo > 0).map((s) => ({
                      label: shortPer(s.periodoId),
                      pct: Math.round((s.gastado / s.sueldo) * 100),
                      hi: activos.includes(s.periodoId),
                    }));
                    const maxPct = Math.max(...data.map((d) => d.pct), 110);
                    const lineBottom = Math.round((100 / maxPct) * 96);
                    const color = (pct: number) => pct > 90 ? "var(--red)" : pct > 50 ? "var(--yellow)" : "var(--green)";
                    return (
                      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, alignItems: "flex-end", scrollbarWidth: "none" }}>
                        {data.map((d, i) => (
                          <div key={i} style={{ flexShrink: 0, width: 36, display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
                            <div style={{ fontSize: 8, color: "var(--red)", fontFamily: "var(--font-mono)", fontWeight: 700, minHeight: 10 }}>
                              {!oculto && d.pct > 100 ? `+${d.pct - 100}%` : ""}
                            </div>
                            <div style={{ height: 96, width: 20, background: "var(--faint)", borderRadius: 7, position: "relative", display: "flex", alignItems: "flex-end", overflow: "hidden" }}>
                              <div style={{ position: "absolute", bottom: lineBottom, left: 0, right: 0, height: 1, background: "var(--text)44", zIndex: 1 }} />
                              <div style={{ width: "100%", height: `${Math.min(Math.round((d.pct / maxPct) * 100), 100)}%`, background: color(d.pct), borderRadius: 7, transition: "height .5s ease" }} />
                            </div>
                            <div style={{ fontSize: 8, color: d.hi ? "var(--accent)" : "var(--muted)", fontWeight: d.hi ? 700 : 400 }}>{d.label}</div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Evolución ingresos */}
              {evolucionIngresos.length > 1 && (
                <div className="soft" style={{ marginBottom: 12, background: "linear-gradient(135deg, var(--surface), var(--surface-alt))", borderColor: "var(--green)22" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>{t.incomeEvolution}</div>
                  <VBars
                    max={Math.max(...evolucionIngresos.map((p) => p.sueldo + p.moveTotal), 1)}
                    oculto={oculto}
                    data={evolucionIngresos.map((p) => ({
                      label: shortPer(p.periodoId),
                      value: p.sueldo + p.moveTotal,
                      color: "var(--green)",
                      hi: activos.includes(p.periodoId),
                    }))}
                  />
                </div>
              )}
            </>
          )}

          {/* ══ MOVIMIENTOS ══ */}
          {sub === "movimientos" && periodo && movCounts && (
            <>
              {reportOn("movimientos_kpis") && (
              <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                <Stat label={t.totalMovements} value={String(movCounts.total)} sub={t.activeDays(movCounts.diasActivos)} color="var(--accent)" dimVar="var(--blue-dim)" />
                <Stat label={t.mostActiveDay} value={sinAño(movCounts.diaMasActivo)} sub={t.movCount(movCounts.diaMasActivoN)} color="var(--accent)" dimVar="var(--blue-dim)" />
              </div>
              </>
              )}

              {reportOn("movimientos_otros") && (
              <>
              {/* Por tipo — cards */}
              {(() => {
                const colorMap: Record<string, [string, string]> = {
                  Gasto:      ["var(--red)",    "var(--red-dim)"],
                  Ingreso:    ["var(--green)",  "var(--green-dim)"],
                  Move:       ["var(--yellow)", "var(--yellow-dim)"],
                  CompraUSD:  ["var(--yellow)", "var(--yellow-dim)"],
                  CompraEUR:  ["var(--yellow)", "var(--yellow-dim)"],
                  GastoUSD:   ["var(--red)",    "var(--red-dim)"],
                  GastoEUR:   ["var(--red)",    "var(--red-dim)"],
                };
                return (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
                    {movCounts.porTipo.map(([tipo, count]) => {
                      const [color, dim] = colorMap[tipo] ?? ["var(--accent)", "var(--blue-dim)"];
                      return (
                        <div key={tipo} className="soft" style={{ padding: 14, background: `linear-gradient(135deg, var(--surface), ${dim})`, borderColor: `${color}33` }}>
                          <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>{t.tipoDisplay[tipo] ?? tipo}</div>
                          <div style={{ fontSize: 22, fontWeight: 700, color, fontFamily: "var(--font-mono)", lineHeight: 1 }}>{count}</div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {/* Por categoría (frecuencia) */}
              {movCounts.porCat.length > 0 && (
                <div className="soft" style={{ marginBottom: 12, background: "linear-gradient(135deg, var(--surface), var(--surface-alt))", cursor: movCounts.porCat.length > 5 ? "pointer" : undefined }}
                  onClick={movCounts.porCat.length > 5 ? () => setModalTop("movcat") : undefined}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>{t.byCategory}</div>
                  {movCounts.porCat.slice(0, 5).map(({ cat, count, color }) => (
                    <div key={cat} style={{ marginBottom: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <div style={{ fontSize: 12 }}>{cat}</div>
                        <div style={{ fontSize: 12, fontWeight: 700, fontFamily: "var(--font-mono)" }}>{count}</div>
                      </div>
                      <div style={{ height: 4, background: "var(--faint)", borderRadius: 2 }}>
                        <div style={{ height: "100%", width: `${Math.round((count / movCounts.total) * 100)}%`, background: color, borderRadius: 2, transition: "width .5s ease" }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Por descripción (frecuencia) */}
              {movCounts.porDesc.length > 0 && (
                <div className="soft" style={{ marginBottom: 12, cursor: "pointer", background: "linear-gradient(135deg, var(--surface), var(--surface-alt))" }}
                  onClick={movCounts.porDesc.length > 5 ? () => setModalTop("movdescs") : undefined}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>{t.top5Descriptions}</div>
                  {movCounts.porDesc.slice(0, 5).map(({ desc, count, color }) => (
                    <div key={desc} style={{ marginBottom: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <div style={{ fontSize: 12 }}>{desc}</div>
                        <div style={{ fontSize: 12, fontWeight: 700, fontFamily: "var(--font-mono)" }}>{count}</div>
                      </div>
                      <div style={{ height: 4, background: "var(--faint)", borderRadius: 2 }}>
                        <div style={{ height: "100%", width: `${Math.round((count / movCounts.total) * 100)}%`, background: color, borderRadius: 2, transition: "width .5s ease" }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Por día de semana */}
              <div className="soft" style={{ marginBottom: 12, background: "linear-gradient(135deg, var(--surface), var(--surface-alt))" }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>{t.byDayOfWeek}</div>
                {(() => {
                  const maxDow = Math.max(...movCounts.porDow, 1);
                  const DIAS = t.dayNames;
                  return (
                    <div style={{ display: "flex", gap: 6, alignItems: "flex-end", justifyContent: "space-around" }}>
                      {movCounts.porDow.map((n, i) => (
                        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
                          <div style={{ fontSize: 9, fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--muted)", minHeight: 12 }}>{n > 0 ? n : ""}</div>
                          <div style={{ height: 72, width: "100%", maxWidth: 28, background: "var(--faint)", borderRadius: 6, display: "flex", alignItems: "flex-end", overflow: "hidden" }}>
                            <div style={{ width: "100%", height: `${Math.round((n / maxDow) * 100)}%`, background: "var(--accent)", borderRadius: 6, transition: "height .5s ease" }} />
                          </div>
                          <div style={{ fontSize: 9, color: "var(--muted)" }}>{DIAS[i]}</div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              </>
              )}
            </>
          )}
        </div>
      )}

      {/* Modal: Historial de aumentos de sueldo */}
      {modalSueldo && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 200,
          display: "flex", alignItems: "flex-end", overflow: "hidden",
        }} onClick={() => { setModalSueldo(false); setModalSueldoExpanded(false); }}>
          <div style={{
            width: "100%", background: "var(--bg)", borderRadius: "20px 20px 0 0",
            maxHeight: modalSueldoExpanded ? "90dvh" : "50dvh", overflowY: "auto", padding: "20px 20px 40px",
            transition: "max-height 0.3s cubic-bezier(0.4,0,0.2,1)",
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: "var(--border)", margin: "0 auto 16px", cursor: "grab", touchAction: "none" }}
              onPointerDown={(e) => { sheetDragY.current = e.clientY; (e.target as HTMLElement).setPointerCapture(e.pointerId); }}
              onPointerMove={(e) => {
                if (sheetDragY.current === null) return;
                const dy = sheetDragY.current - e.clientY;
                if (dy > 30) { setModalSueldoExpanded(true); sheetDragY.current = null; }
                else if (dy < -30 && modalSueldoExpanded) { setModalSueldoExpanded(false); sheetDragY.current = null; }
              }}
              onPointerUp={() => { sheetDragY.current = null; }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <span style={{ fontSize: 16, fontWeight: 700 }}>{t.salaryHistory}</span>
              <button onClick={() => setModalSueldo(false)} style={{ background: "none", border: "none", color: "var(--red)", cursor: "pointer", fontSize: 22, padding: 4, lineHeight: 1 }}>×</button>
            </div>
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
          </div>
        </div>
      )}

      {/* Modal: Todos los top gastos/descripciones */}
      {modalTop && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 200,
          display: "flex", alignItems: "flex-end", overflow: "hidden",
        }} onClick={() => { setModalTop(null); setModalTopExpanded(false); }}>
          <div style={{
            width: "100%", background: "var(--bg)", borderRadius: "20px 20px 0 0",
            maxHeight: modalTopExpanded ? "90dvh" : "50dvh", overflowY: "auto", padding: 20, paddingBottom: 40,
            transition: "max-height 0.3s cubic-bezier(0.4,0,0.2,1)",
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: "var(--border)", margin: "0 auto 16px", cursor: "grab", touchAction: "none" }}
              onPointerDown={(e) => { sheetDragY.current = e.clientY; (e.target as HTMLElement).setPointerCapture(e.pointerId); }}
              onPointerMove={(e) => {
                if (sheetDragY.current === null) return;
                const dy = sheetDragY.current - e.clientY;
                if (dy > 30) { setModalTopExpanded(true); sheetDragY.current = null; }
                else if (dy < -30 && modalTopExpanded) { setModalTopExpanded(false); sheetDragY.current = null; }
              }}
              onPointerUp={() => { sheetDragY.current = null; }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <span style={{ fontSize: 16, fontWeight: 700 }}>
                {modalTop === "gastos" ? t.top20Expenses : modalTop === "movdescs" ? t.allDescriptions : modalTop === "movcat" ? t.allCategories : t.allDescriptions}
              </span>
              <button onClick={() => setModalTop(null)} style={{
                background: "none", border: "none", color: "var(--red)", cursor: "pointer", fontSize: 22, padding: 4, lineHeight: 1,
              }}>×</button>
            </div>
            {modalTop === "descs" && descsModal.map((d, i) => (
              <div key={d.nombre} className="row" style={{ padding: "12px 0" }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", minWidth: 0 }}>
                  <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", width: 14, background: "linear-gradient(110deg, var(--blue) 10%, var(--green) 90%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>{i + 1}</span>
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
            {modalTop === "movdescs" && movCounts && movCounts.porDesc.map(({ desc, count, color }, i) => (
              <div key={desc} className="row" style={{ padding: "12px 0" }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", minWidth: 0 }}>
                  <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", width: 14, background: "linear-gradient(110deg, var(--blue) 10%, var(--green) 90%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>{i + 1}</span>
                  <div style={{ fontSize: 13, flex: 1, minWidth: 0 }}>{desc || "—"}</div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color, fontFamily: "var(--font-mono)" }}>{count}×</div>
              </div>
            ))}
            {modalTop === "movcat" && movCounts && movCounts.porCat.map(({ cat, count, color }, i) => (
              <div key={cat} className="row" style={{ padding: "12px 0" }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", minWidth: 0 }}>
                  <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", width: 14, background: "linear-gradient(110deg, var(--blue) 10%, var(--green) 90%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>{i + 1}</span>
                  <div style={{ fontSize: 13, flex: 1, minWidth: 0 }}>{cat || "—"}</div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color, fontFamily: "var(--font-mono)" }}>{count}×</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {diaModal && (() => {
        const fechaOriginal = porFecha.find((f) => sinAño(f.nombre) === diaModal)?.nombre ?? diaModal;
        const movsDia = (periodo?.movimientos ?? []).filter((m) => m.tipo === "Gasto" && (sinAño(m.fecha) === diaModal || m.fecha === fechaOriginal)).sort((a, b) => b.monto - a.monto);
        const totalDia = movsDia.reduce((s, m) => s + m.monto, 0);
        return (
          <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
            onClick={() => { setDiaModal(null); setDiaModalExpanded(false); }}>
            <div style={{ width: "100%", background: "var(--bg)", borderRadius: "20px 20px 0 0", maxHeight: diaModalExpanded ? "90dvh" : "50dvh", overflowY: "auto", padding: 20, paddingBottom: 40, transition: "max-height 0.3s cubic-bezier(0.4,0,0.2,1)" }}
              onClick={(e) => e.stopPropagation()}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: "var(--border)", margin: "0 auto 16px", cursor: "grab", touchAction: "none" }}
                onPointerDown={(e) => { sheetDragY.current = e.clientY; (e.target as HTMLElement).setPointerCapture(e.pointerId); }}
                onPointerMove={(e) => {
                  if (sheetDragY.current === null) return;
                  const dy = sheetDragY.current - e.clientY;
                  if (dy > 30) { setDiaModalExpanded(true); sheetDragY.current = null; }
                  else if (dy < -30 && diaModalExpanded) { setDiaModalExpanded(false); sheetDragY.current = null; }
                }}
                onPointerUp={() => { sheetDragY.current = null; }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <span style={{ fontSize: 16, fontWeight: 700 }}>{diaModal}</span>
                <button onClick={() => setDiaModal(null)} style={{ background: "none", border: "none", color: "var(--red)", cursor: "pointer", fontSize: 22, padding: 4, lineHeight: 1 }}>×</button>
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 16 }}>{`${money(totalDia)} · ${t.expensesCount(movsDia.length)}`}</div>
              {movsDia.map((m, i) => (
                <div key={i} className="row" style={{ padding: "11px 0" }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{m.descripcion || "—"}</div>
                    <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>{m.categoria} · {m.medioPago}</div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--red)", fontFamily: "var(--font-mono)", flexShrink: 0 }}>{money(m.monto)}</div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
