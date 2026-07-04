"use client";

import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useT } from "@/hooks/useTranslation";
import { useFirstVisit } from "@/hooks/useFirstVisit";
import { useInflacionIPC } from "@/hooks/useInflacionIPC";
import { useDolarHistorico } from "@/hooks/useDolarHistorico";
import { SectionHint } from "@/components/ui/SectionHint";
import { YearWrapped, wrappedYears } from "@/components/reports/YearWrapped";
import { useData } from "../data-context";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/services/firebase/firebase";
import { agruparPorPeriodo, gastosPorCategoria, formatARS } from "@/utils/periodo";
import { obtenerPresupuesto, guardarPresupuesto } from "@/services/firebase/presupuestos";
import { useMoney } from "@/hooks/useHideValues";
import {
  gastosPorMedioPago, gastosPorDescripcion, gastosPorFecha,
  kpisPeriodo, ritmoGasto, comparativaCategorias,
  serieTendencia, parsePeriodoId, diasSinGastos,
  historialSueldo, proyectarAhorros,
  progresoMetaUSD, periodosParaMetaUSD, estadisticasPeriodos, esGasto,
} from "@/utils/reportes";
import { reservaFX as calcularReservaFX } from "@/utils/reserva";
import { PageTitle } from "@/components/ui/PageTitle";
import { APP_GRAD_DIM, appGradText } from "@/components/ui/gradients";
import { Bar, Stat, DonutChart, VBars, DotChart, AreaChart, TwoLineChart, type DotDatum } from "@/components/reports/charts";
import { abbr, shortPer, sinAño, periodoAnio, deltaColor, deltaMag, colorPct, colorZ, TIPO_COLOR } from "@/components/reports/format";
import { useCotizacion } from "@/hooks/useCotizacion";
import { useAppPrefs } from "@/hooks/useAppPrefs";
import { EyeIcon } from "@/components/ui/EyeIcon";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { MiniStat } from "@/components/ui/MiniStat";
import { KpiInfoModal } from "@/components/ui/KpiInfoModal";
import { BottomSheet } from "@/components/ui/BottomSheet";

type Sub = "gastos" | "ingresos" | "movimientos" | "periodos";

// Gradiente de marca unificado para todos los selectores (blue → cyan → teal → green)
const gradText = appGradText;
const pillOn: React.CSSProperties = { border: "1px solid transparent", background: APP_GRAD_DIM };
const pillOff: React.CSSProperties = { border: "1px solid var(--border)", background: "transparent", color: "var(--muted)" };

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
  const { monedaInversiones, monedaPrincipal } = useAppPrefs();
  const [showHint, dismissHint] = useFirstVisit("reports");

  const periodos = useMemo(() => agruparPorPeriodo(movimientos), [movimientos]);
  const [sub, setSub] = useState<Sub>("gastos");
  const [wrappedOpen, setWrappedOpen] = useState(false);
  const hayWrapped = useMemo(() => wrappedYears(movimientos).length > 0, [movimientos]);
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
  const [periodMetric, setPeriodMetric] = useState<"gasto" | "ingreso" | "dias" | "gastoSueldo" | "inflacion" | "sueldoReal">("gasto");
  const [sueldoRealMode, setSueldoRealMode] = useState<"USD" | "IPC">("USD");
  const [metricPickerOpen, setMetricPickerOpen] = useState(false);
  const { deflatar, ipcVar, ipcMensualUltimo } = useInflacionIPC();
  const { dolarAt } = useDolarHistorico();
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

  // RESTO (arrastre del período anterior, ahora Move/aAhorro · antes Ingreso/RESTO).
  // Solo para MOSTRAR en el detalle "directo a ahorros" — NO entra en ningún total/KPI.
  const movResto = periodo
    ? periodo.movimientos
        .filter((m) => m.categoria === "RESTO")
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
    ? ((totalIngresos - ingresosAnteriores) / ingresosAnteriores) * 100
    : null;

  const ingXDesc: { cat: string; monto: number; pct: number }[] = (() => {
    if (!periodo) return [];
    const descMap = new Map<string, number>();
    for (const m of periodo.movimientos) {
      // Incluye todos los ingresos reales: Sueldo y RESTO (período anterior, ahora Move/aAhorro)
      if (m.tipo === "Ingreso" || m.categoria === "RESTO") {
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

  // Plantilla por defecto: en el período en curso, si no hay presupuesto propio guardado,
  // se aplica sola como presupuesto efectivo (sin persistir hasta que el usuario edite/guarde).
  const presupuestoTemplate = config?.meta.presupuestoTemplate ?? null;
  const templateValido = presupuestoTemplate && Object.keys(presupuestoTemplate).length > 0 ? presupuestoTemplate : null;
  const presupuestoEfectivo = presupuesto ?? (esPeriodoVigente ? templateValido : null);
  // Categorías del editor: unión de las que ya tienen gasto + las de la plantilla/presupuesto,
  // así en un período nuevo (sin gastos) igual aparecen todas para editar.
  const catsEditables = Array.from(new Set([
    ...cats.map((c) => c.categoria),
    ...Object.keys(presupuesto ?? {}),
    ...Object.keys(templateValido ?? {}),
  ]));
  // Con presupuesto visible, sumá las categorías presupuestadas que aún no tienen gasto
  // (monto 0) para ver el presupuesto completo, no solo lo ya gastado.
  const catsConPresu = showBudget && presupuestoEfectivo
    ? [...cats, ...Object.keys(presupuestoEfectivo)
        .filter((cat) => (presupuestoEfectivo[cat] ?? 0) > 0 && !cats.some((c) => c.categoria === cat))
        .map((cat) => ({ categoria: cat, monto: 0, pct: 0 }))]
    : cats;

  const serie = useMemo(() => serieTendencia(periodos, seedPeriodoId), [periodos, seedPeriodoId]);
  const serieDesc = useMemo(() => [...serie].reverse(), [serie]);
  const maxTotal = Math.max(...serie.map((s) => s.total), 1);

  // ── Resumen general de períodos ──
  // Excluye el período en curso (incompleto): gastó poco solo porque recién arranca,
  // no es "el mejor". Mismo criterio que inflación/tendencia.
  const validPeriodos = useMemo(() => serieDesc.filter((s) => s.total > 0 && s.periodoId !== periodos[0]?.periodoId), [serieDesc, periodos]);
  const mejorPeriodo = validPeriodos.length > 0 ? validPeriodos.reduce((b, s) => s.gastado / s.total < b.gastado / b.total ? s : b) : null;
  const peorPeriodo = validPeriodos.length > 0 ? validPeriodos.reduce((b, s) => s.gastado / s.total > b.gastado / b.total ? s : b) : null;
  // Inflación personal: variación promedio del gasto puro (sin compras de divisa,
  // que dispararían el número) entre períodos consecutivos.
  const inflacionPersonal = useMemo(() => {
    const chron = periodos
      .slice(1) // excluir el período en curso (incompleto): distorsiona la inflación
      .map((p) => ({ id: p.periodoId, gasto: p.movimientos.filter((m) => m.tipo === "Gasto").reduce((s, m) => s + m.monto, 0) }))
      .filter((p) => p.gasto > 0)
      .sort((a, b) => parsePeriodoId(a.id).getTime() - parsePeriodoId(b.id).getTime());
    if (chron.length < 2) return null;
    let sum = 0, n = 0;
    for (let i = 1; i < chron.length; i++) {
      const prev = chron[i - 1].gasto;
      if (prev > 0) { sum += (chron[i].gasto - prev) / prev; n++; }
    }
    return n > 0 ? (sum / n) * 100 : null;
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
    return { gap: suba - pais, suba: Math.round(suba), pais: Math.round(pais) };
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

  // Reserva real en FX (misma cuenta que página Inversión).
  const SALDO_INICIAL = monedaInversiones === "EUR" ? (config?.meta.saldoEUR ?? 0) : (config?.meta.saldoUSD ?? 0);
  const reservaFX = useMemo(
    () => Math.max(0, calcularReservaFX(movimientos, monedaInversiones === "EUR" ? "EUR" : "USD", SALDO_INICIAL)),
    [movimientos, monedaInversiones, SALDO_INICIAL]
  );

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
  // Proyección de ahorro: como el gasto, deflacta cada período a pesos de hoy y
  // proyecta al próximo período con el último IPC mensual (evita que los períodos
  // viejos, en pesos "más baratos", la dejen por debajo del nivel actual).
  const proyeccionAhorro = periodos.length >= 2 ? (() => {
    const hist = periodos.slice(1);
    const realAvg = hist.reduce((s, p) => s + deflatar(p.moveAhorros + p.ahorros, p.periodoId), 0) / hist.length;
    const factor = ipcMensualUltimo != null ? 1 + ipcMensualUltimo / 100 : 1;
    return Math.round(realAvg * factor);
  })() : null;
  const estadPeriodos = useMemo(() => estadisticasPeriodos(periodos), [periodos]);
  const avgHistorico = periodos.length >= 2
    ? periodos.slice(1).reduce((s, p) => s + p.gastadoPuro, 0) / (periodos.length - 1) : 0;
  const tendenciaGasto = periodos.length >= 2 && avgHistorico > 0
    ? ((periodos[0].gastadoPuro - avgHistorico) / avgHistorico) * 100 : null;
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
    ? ((periodos[0].movimientos.length - avgHistoricoMovs) / avgHistoricoMovs) * 100 : null;

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
          <div style={{ marginBottom: 18, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <div>
              <PageTitle>{t.pageTitleReports}</PageTitle>
            </div>
            {hayWrapped && (
              <button onClick={() => setWrappedOpen(true)} style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 6, background: "linear-gradient(110deg, var(--blue), var(--green))", border: "none", color: "#fff", borderRadius: 999, padding: "7px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", boxShadow: "0 2px 12px var(--accent)55" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                {t.yearWrapped}
              </button>
            )}
          </div>
          {showHint && <SectionHint title={t.hintRepTitle} body={t.hintRepBody} onDismiss={dismissHint} />}
          <div className="subtabs">
            {SUBS.map((s) => {
              const isActive = sub === s.id;
              return (
                <button key={s.id} onClick={() => setSub(s.id)} className="subtab"
                  style={isActive ? {
                    border: "1px solid transparent",
                    background: APP_GRAD_DIM,
                  } : {}}>
                  {isActive ? <span style={gradText}>{s.label}</span> : s.label}
                </button>
              );
            })}
          </div>
          {/* Selector de período — tap simple selecciona uno; toggle "Comparar" suma/quita.
              No aplica a Períodos (es una vista histórica de todos). */}
          {sub !== "periodos" && (() => {
            const activePill = pillOn;
            const inactivePill = pillOff;
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
                            flexShrink: 0, padding: "4px 12px", borderRadius: 999, fontSize: 10, fontWeight: 700, cursor: "pointer",
                            transition: "all 0.15s",
                            ...(isAñoActivo ? activePill : inactivePill),
                          }}
                        >{isAñoActivo ? <span style={gradText}>{año}</span> : año}</button>
                      );
                    })}
                  </div>
                  {periodos.length > 1 && (
                    <button onClick={() => setCompareMode((v) => { const nv = !v; if (!nv) setPeriodosSelIds((p) => p.slice(0, 1)); return nv; })}
                      style={{
                        flexShrink: 0, display: "flex", alignItems: "center", gap: 5, padding: "4px 12px", borderRadius: 999,
                        fontSize: 10, fontWeight: 700, cursor: "pointer", transition: "all 0.15s",
                        ...(compareMode ? activePill : inactivePill),
                      }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
                          flexShrink: 0, padding: "4px 12px", borderRadius: 999, fontSize: 10, fontWeight: 700, cursor: "pointer",
                          transition: "all 0.15s",
                          ...(isSelected ? activePill : inactivePill),
                        }}
                      >{isSelected ? <span style={gradText}>{shortPer(p.periodoId)}</span> : shortPer(p.periodoId)}</button>
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
                      <div style={{ display: "flex", alignItems: "baseline", gap: 8, minWidth: 0 }}>
                        <span style={{ fontSize: 12, color: "var(--muted)" }}>{t.spent}</span>
                        <span style={{ fontSize: 10.5, color: "var(--muted)" }}>{t.ofTotal(periodo.pct)}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {ritmo?.enCurso && <span className="badge" style={{ background: "var(--green-dim)", color: "var(--green)", border: "1px solid var(--green)44" }}>{t.ongoing}</span>}
                        <button onClick={toggle} aria-label={t.hideValues} style={{ background: "transparent", border: "none", color: oculto ? "var(--accent)" : "var(--muted)", width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}>
                          <EyeIcon off={oculto} />
                        </button>
                      </div>
                    </div>
                    <div style={{ fontSize: 30, fontWeight: 700, color: pctColor, fontFamily: "var(--font-mono)", letterSpacing: -0.5, lineHeight: 1 }}>{money(periodo.gastado)}</div>
                    {periodo.gastado > periodo.gastadoPuro && (
                      <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 6 }}>{t.spentBreakdown(money(periodo.gastadoPuro), money(periodo.gastado - periodo.gastadoPuro))}</div>
                    )}
                    <div className="bar-track" style={{ marginTop: 10 }}><div className="bar-fill" style={{ width: `${Math.min(periodo.pct, 100)}%`, background: pctColor }} /></div>
                  </div>
                );
              })()}

              {/* Mini-stats fila 1: 3 columnas */}
              {reportOn("gastos_kpis") && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                {esPeriodoVigente && tendenciaGasto !== null && (() => { const c = colorZ(periodos[0].gastadoPuro, periodos.slice(1).map((p) => p.gastadoPuro)); const mag = deltaMag(tendenciaGasto); const v = `${mag > 0 ? "+" : ""}${mag}%`; return (
                  <MiniStat center basis="1 1 45%" label={t.trend} value={v} color={c}
                    onClick={() => setKpiInfo({ title: t.trend, value: v, explain: `${t.kpiTrendInfo} Promedio histórico: ${oculto ? "••" : formatARS(Math.round(avgHistorico))}`, color: c })} />
                ); })()}
                {periodo.gastado > periodo.gastadoPuro && <MiniStat center basis="1 1 45%" label={t.realSpent} value={oculto ? "••" : abbr(periodo.gastadoPuro)} color="var(--red)"
                  onClick={() => setKpiInfo({ title: t.realSpent, value: oculto ? "••" : formatARS(periodo.gastadoPuro), explain: t.kpiRealSpentInfo, color: "var(--red)" })} />}
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
                      {presupuestoEfectivo && Object.keys(presupuestoEfectivo).length > 0 && (
                        <button onClick={() => setShowBudget(v => !v)} style={{ background: showBudget ? "var(--accent-dim)" : "transparent", border: `1px solid ${showBudget ? "var(--accent)" : "var(--border)"}`, borderRadius: 6, color: showBudget ? "var(--accent)" : "var(--muted)", fontSize: 10, fontWeight: 600, padding: "3px 8px", cursor: "pointer", transition: "all 0.15s" }}>
                          {t.budget}
                        </button>
                      )}
                      <button onClick={() => {
                        const template = config?.meta.presupuestoTemplate ?? {};
                        const base = presupuesto ?? template;
                        setEditingBudget(Object.fromEntries(catsEditables.map((cat) => [cat, String(base[cat] ?? "")])));
                        setModalBudget(true);
                      }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: 4, display: "flex", alignItems: "center" }} aria-label={t.editBudget}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
                {catsConPresu.map((c) => <Bar key={c.categoria} nombre={c.categoria} monto={c.monto} pct={c.pct} color={esCatCompra(c.categoria) ? "var(--yellow)" : "var(--red)"} oculto={oculto} presupuesto={showBudget ? presupuestoEfectivo?.[c.categoria] : undefined} onClick={() => setCatModal(c.categoria)} />)}
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
                        {c.deltaPct !== null ? (() => { const mag = deltaMag(c.deltaPct); return (
                          <span style={{ fontSize: 11, fontWeight: 700, color: deltaColor(c.deltaPct, false), minWidth: 48, textAlign: "right" }}>
                            {mag === 0 ? "0" : <>{mag > 0 ? "↑" : "↓"}{Math.abs(mag)}</>}%
                          </span>
                        ); })() : <span style={{ fontSize: 10, color: "var(--red)", minWidth: 48, textAlign: "right" }}>{t.new_}</span>}
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
                {deltaIngresos !== null && (() => { const mag = deltaMag(deltaIngresos); return (
                  <div style={{ marginTop: 8, fontSize: 12, color: deltaColor(deltaIngresos, true), fontWeight: 600 }}>
                    {mag === 0 ? "0" : <>{mag > 0 ? "↑" : "↓"}{Math.abs(mag)}</>}% vs {shortPer(anterior!.periodoId)}
                  </div>
                ); })()}
              </div>

              {/* Mini-stats: Sueldo · Retiros */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                {evolSueldoActivo ? (
                  <MiniStat center basis="1 1 45%" label={t.salary}
                    value={oculto ? "••" : abbr(evolSueldoActivo.sueldo)}
                    sub={evolSueldoActivo.esVacaciones ? t.leave : undefined}
                    color={evolSueldoActivo.esVacaciones ? "var(--yellow)" : "var(--green)"}
                    onClick={suelHistorial.length > 0 ? () => setModalSueldo(true) : undefined} />
                ) : (
                  <MiniStat center basis="1 1 45%" label={t.salary} value={oculto ? "••" : abbr(periodo.sueldo)} color="var(--green)" />
                )}
                {(periodo.moveDisponible > 0 || periodo.moveAhorros > 0) && (
                  <div style={{ background: "var(--surface-alt)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "11px 12px", minWidth: 0, flex: "1 1 45%", textAlign: "center" }}>
                    <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 5, textTransform: "capitalize" }}>{t.moves}</div>
                    <div style={{ display: "flex", justifyContent: "center", gap: 16 }}>
                      {periodo.moveDisponible > 0 && (
                        <div onClick={() => setKpiInfo({ title: t.withdrawals, value: oculto ? "••" : formatARS(periodo.moveDisponible), explain: t.kpiWithdrawalsInfo, color: "var(--teal)" })}
                          style={{ fontSize: 15, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--teal)", cursor: "pointer", whiteSpace: "nowrap" }}>
                          {oculto ? "••" : abbr(periodo.moveDisponible)}
                        </div>
                      )}
                      {periodo.moveAhorros > 0 && (
                        <div onClick={() => setKpiInfo({ title: t.moveToSavingsTitle, value: oculto ? "••" : formatARS(periodo.moveAhorros), explain: t.kpiMoveToSavingsInfo, color: "var(--purple)" })}
                          style={{ fontSize: 15, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--purple)", cursor: "pointer", whiteSpace: "nowrap" }}>
                          {oculto ? "••" : abbr(periodo.moveAhorros)}
                        </div>
                      )}
                    </div>
                  </div>
                )}
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
              {reportOn("ingresos_otros") && (movIngresos.length > 0 || movIngresosAhorros.length > 0 || movResto.length > 0) && (
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
                  {(movIngresosAhorros.length > 0 || movResto.length > 0) && (
                    <>
                      <div style={{ fontSize: 10, color: "var(--muted)", letterSpacing: 2, textTransform: "uppercase", padding: "10px 0 4px", borderTop: movIngresos.length > 0 ? "1px solid var(--faint)" : "none", marginTop: movIngresos.length > 0 ? 4 : 0 }}>
                        {t.directToSavings}
                      </div>
                      {movResto.map((m) => (
                        <div key={m.id} className="row" style={{ padding: "9px 0" }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.prevPeriodRemaining}</div>
                            <div style={{ fontSize: 10, color: "var(--muted)" }}>{sinAño(m.fecha)}</div>
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--blue)", fontFamily: "var(--font-mono)", whiteSpace: "nowrap" }}>
                            +{money(m.monto)}
                          </span>
                        </div>
                      ))}
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

              {movIngresos.length === 0 && movIngresosAhorros.length === 0 && movResto.length === 0 && (
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
              <div className="soft" onClick={inflacionPersonal != null ? () => setKpiInfo({ title: t.inflationTitle, value: `${deltaMag(inflacionPersonal) > 0 ? "+" : ""}${deltaMag(inflacionPersonal)}%`, explain: t.kpiInflationAvgInfo, color: deltaColor(inflacionPersonal, false) }) : undefined}
                style={{ marginBottom: 12, background: "linear-gradient(135deg, var(--red-dim), var(--surface), var(--green-dim))", cursor: inflacionPersonal != null ? "pointer" : "default" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>{t.inflationTitle}</div>
                  <button onClick={(e) => { e.stopPropagation(); toggle(); }} aria-label={t.hideValues} style={{ background: "transparent", border: "none", color: oculto ? "var(--accent)" : "var(--muted)", width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}><EyeIcon off={oculto} /></button>
                </div>
                <div style={{ fontSize: 32, fontWeight: 700, color: inflacionPersonal == null ? "var(--muted)" : deltaColor(inflacionPersonal, false), fontFamily: "var(--font-mono)", letterSpacing: -0.5, lineHeight: 1 }}>
                  {inflacionPersonal == null ? "—" : `${deltaMag(inflacionPersonal) > 0 ? "+" : ""}${deltaMag(inflacionPersonal)}%`}
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
                const c = deltaColor(gap, true);
                const verdict = gap > 0 ? t.salaryBeatsInflation : gap < 0 ? t.salaryLosesInflation : t.salaryTiesInflation;
                return (
                  <div className="soft" onClick={() => setKpiInfo({ title: t.salaryVsInflation, value: `${deltaMag(gap) > 0 ? "+" : ""}${deltaMag(gap)} pts`, explain: t.kpiSalaryVsInflationInfo(suba, pais), color: c })}
                    style={{ marginBottom: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, background: "linear-gradient(135deg, var(--surface), var(--surface-alt))" }}>
                    <div style={{ fontSize: 12, color: c, minWidth: 0 }}>{verdict}</div>
                    <div style={{ fontSize: 26, fontWeight: 700, fontFamily: "var(--font-mono)", letterSpacing: -0.5, lineHeight: 1, color: c, flexShrink: 0 }}>{deltaMag(gap) > 0 ? "+" : ""}{deltaMag(gap)} pts</div>
                  </div>
                );
              })()}

              {/* Por período — un solo gráfico con selector de métrica */}
              {reportOn("periodos_otros") && serieDesc.length > 0 && (() => {
                const metrics = [
                  { id: "gasto", label: t.mGastosTotales },
                  { id: "gastoSueldo", label: t.mGastoSobreSueldo },
                  { id: "dias", label: t.mDuracionDias },
                  ...(monedaPrincipal === "ARS" ? [{ id: "inflacion", label: t.mInflacionPersonal }] : []),
                  { id: "ingreso", label: t.mIngresosTotales },
                  ...(monedaPrincipal === "ARS" ? [{ id: "sueldoReal", label: t.mEvolucionSueldo }] : []),
                ] as const;
                type BarDatum = { label: string; value: number; color: string; hi?: boolean; best?: boolean; worst?: boolean; valueLabel?: string; periodoId?: string };
                let data: BarDatum[] = [];
                let max = 1; let refFrac: number | undefined; let mask = false;
                if (periodMetric === "gasto") {
                  // Barra neutra: la altura son pesos (magnitud). El semáforo % vive en
                  // "gasto sobre sueldo", donde altura y color hablan de lo mismo. El mejor/
                  // peor período sigue marcado por el color de la etiqueta (verde/rojo).
                  data = serieDesc.map((s) => ({ label: shortPer(s.periodoId), value: s.gastado, color: "var(--muted)", hi: activos.includes(s.periodoId), best: s.periodoId === mejorPeriodo?.periodoId, worst: s.periodoId === peorPeriodo?.periodoId, periodoId: s.periodoId }));
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
                  // Gasto real (sin FX) sobre sueldo, como excedente sobre el 100%:
                  // +86% = gastaste 186% del sueldo; -14% = gastaste el 86%. La línea (0) es el 100%.
                  data = serieDesc.filter((s) => s.sueldo > 0).map((s) => {
                    const full = Math.round((s.gastadoPuro / s.sueldo) * 100);
                    return { label: shortPer(s.periodoId), value: full - 100, color: colorPct(full), hi: activos.includes(s.periodoId), periodoId: s.periodoId };
                  });
                }
                // Inflación ACUMULADA: tu gasto puro vs el período base (el más viejo con
                // gasto>0) y la del país (IPC compuesto) desde el mismo mes base. Se calcula
                // viejo→nuevo y se invierte para mostrar el más reciente a la izquierda,
                // como el resto de los gráficos.
                let inflPoints: { label: string; a: number; b: number | null; hi?: boolean; periodoId?: string }[] = [];
                let vosAcum: number | null = null, paisAcum: number | null = null;
                if (periodMetric === "inflacion") {
                  // Excluir el período en curso (incompleto): distorsiona la inflación acumulada.
                  const serieCompleta = serie.slice(0, -1);
                  const baseIdx = serieCompleta.findIndex((s) => s.gastadoPuro > 0);
                  if (baseIdx >= 0) {
                    const baseG = serieCompleta[baseIdx]!.gastadoPuro;
                    const baseId = serieCompleta[baseIdx]!.periodoId;
                    const ordered = serieCompleta.slice(baseIdx).map((s) => {
                      const vos = (s.gastadoPuro / baseG - 1) * 100;
                      const pais = ipcVar(baseId, s.periodoId);
                      return { label: shortPer(s.periodoId), a: Math.round(vos), b: pais != null ? Math.round(pais) : null, hi: activos.includes(s.periodoId), periodoId: s.periodoId };
                    });
                    if (ordered.length > 0) {
                      vosAcum = ordered[ordered.length - 1]!.a;
                      paisAcum = ordered[ordered.length - 1]!.b;
                    }
                    inflPoints = ordered.reverse();
                  }
                }
                const vosColor = vosAcum != null && paisAcum != null ? (vosAcum > paisAcum ? "var(--red)" : "var(--green)") : "var(--text)";
                // Sueldo real en el tiempo: en USD (oficial histórico) o ajustado por IPC (pesos de hoy).
                const sueldoPts: DotDatum[] = periodMetric !== "sueldoReal" ? [] : serieDesc.filter((s) => s.sueldo > 0).map((s) => {
                  const val = sueldoRealMode === "USD"
                    ? (() => { const d = dolarAt(s.periodoId); return d ? Math.round(s.sueldo / d) : 0; })()
                    : Math.round(deflatar(s.sueldo, s.periodoId));
                  return { label: shortPer(s.periodoId), value: val, color: "var(--accent)", hi: activos.includes(s.periodoId), periodoId: s.periodoId };
                }).filter((p) => p.value > 0);
                const sub = periodMetric === "gasto" ? t.subMetricSpent : periodMetric === "ingreso" ? t.subMetricIncome : periodMetric === "dias" ? t.subMetricDays : periodMetric === "inflacion" ? t.subMetricInflation : periodMetric === "sueldoReal" ? (sueldoRealMode === "USD" ? t.subMetricSalaryUSD : t.subMetricSalaryIPC) : t.subMetricRatio;
                const curMetric = metrics.find((m) => m.id === periodMetric) ?? metrics[0];
                return (
                  <>
                  <div className="soft" style={{ marginBottom: 12, background: "linear-gradient(135deg, var(--surface), var(--surface-alt))" }}>
                    <button type="button" onClick={() => setMetricPickerOpen(true)}
                      style={{ width: "100%", marginBottom: 14, textAlign: "center", padding: "11px 14px", borderRadius: 12, border: "1px solid transparent", background: APP_GRAD_DIM, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                      <span style={gradText}>{curMetric.label}</span>
                    </button>
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
                      : periodMetric === "sueldoReal"
                      ? (sueldoPts.length > 0
                          ? <>
                              <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 12 }}>
                                {(["USD", "IPC"] as const).map((mo) => (
                                  <button key={mo} type="button" onClick={() => setSueldoRealMode(mo)} className="pill" style={{ fontSize: 11, padding: "3px 14px", borderColor: sueldoRealMode === mo ? "var(--accent)" : "var(--border)", background: sueldoRealMode === mo ? "var(--accent-dim)" : "transparent", color: sueldoRealMode === mo ? "var(--accent)" : "var(--muted)" }}>{mo === "USD" ? "USD" : "IPC"}</button>
                                ))}
                              </div>
                              <DotChart data={sueldoPts} format={sueldoRealMode === "USD" ? (v) => (oculto ? "U$D ••" : `U$D ${v.toLocaleString("es-AR")}`) : (v) => (oculto ? "••" : abbr(v))} onPointClick={(pid) => setNavPeriodo({ periodoId: pid, target: "ingresos" })} />
                            </>
                          : <div style={{ fontSize: 12, color: "var(--muted)", textAlign: "center", padding: "16px 0" }}>{t.noRecords}</div>)
                      : periodMetric === "gastoSueldo"
                      ? (data.length > 0
                          ? <DotChart data={data} refValue={0} signed onPointClick={(pid) => setNavPeriodo({ periodoId: pid, target: "gastos" })} />
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

                  <BottomSheet open={metricPickerOpen} onClose={() => setMetricPickerOpen(false)} title={t.chartLabel}>
                    {metrics.map((mt) => {
                      const active = periodMetric === mt.id;
                      return (
                        <button key={mt.id} type="button" onClick={() => { setPeriodMetric(mt.id as typeof periodMetric); setMetricPickerOpen(false); }}
                          style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "14px 4px", borderBottom: "1px solid var(--faint)", background: "none", border: "none", cursor: "pointer", textAlign: "left", color: active ? "var(--accent)" : "var(--text)", fontSize: 15, fontWeight: active ? 700 : 500 }}>
                          <span style={{ flex: 1 }}>{mt.label}</span>
                          {active && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
                        </button>
                      );
                    })}
                  </BottomSheet>
                  </>
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
                        <MiniStat center basis="1 1 45%" label={t.today} value={gastoHoy !== null ? (oculto ? "••" : abbr(gastoHoy)) : "—"} gradient="linear-gradient(90deg, var(--teal), var(--purple))"
                          onClick={gastoHoy !== null ? () => setKpiInfo({ title: t.todaySpent, value: oculto ? "••" : formatARS(gastoHoy), explain: t.kpiTodaySpentInfo, color: "var(--teal)" }) : undefined} />
                        {diaCaro && <MiniStat center basis="1 1 45%" label={t.highestSpendingDay} value={oculto ? "••" : abbr(diaCaro.monto)} color="var(--red)"
                          onClick={() => setKpiInfo({ title: t.highestSpendingDay, value: oculto ? "••" : formatARS(diaCaro.monto), explain: `${t.kpiHighestDayInfo} (${sinAño(diaCaro.fecha)})`, color: "var(--red)" })} />}
                        {kpis && <MiniStat center basis="1 1 45%" label={t.avgDayWithExpense} value={oculto ? "••" : abbr(kpis.promedioDiario)} gradient="linear-gradient(90deg, var(--teal), var(--purple))"
                          onClick={() => setKpiInfo({ title: t.avgDayWithExpense, value: oculto ? "••" : formatARS(kpis!.promedioDiario), explain: `${t.kpiAvgDayInfo} (${t.daysWithExpenses(kpis!.diasConGasto)})`, color: "var(--teal)" })} />}
                        {tendenciaMovs !== null && (() => { const c = colorZ(periodos[0].movimientos.length, periodos.slice(1).map((p) => p.movimientos.length)); const mag = deltaMag(tendenciaMovs); const v = `${mag > 0 ? "+" : ""}${mag}%`; return (
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
          const budgetCat = presupuestoEfectivo?.[catModal];
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
          {catsEditables.map((cat) => (
            <div key={cat} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ flex: 1, fontSize: 13, color: "var(--text)" }}>{cat}</span>
              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <span style={{ position: "absolute", left: 10, fontSize: 13, color: "var(--muted)", pointerEvents: "none" }}>$</span>
                <input
                  type="number"
                  inputMode="numeric"
                  value={editingBudget[cat] ?? ""}
                  onChange={(e) => setEditingBudget((prev) => ({ ...prev, [cat]: e.target.value }))}
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
          const budgetIsDirty = catsEditables.some(cat => {
            const editVal = Math.round(parseFloat(editingBudget[cat] ?? "") || 0);
            const savedVal = Math.round(saved[cat] ?? 0);
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

      <YearWrapped open={wrappedOpen} onClose={() => setWrappedOpen(false)} />
    </div>
  );
}
