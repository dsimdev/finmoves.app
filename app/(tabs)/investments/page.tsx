"use client";

import { useState, useEffect, useMemo } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/services/firebase/firebase";
import { useAuth } from "@/hooks/useAuth";
import { useData } from "../data-context";
import { MovementModal } from "@/components/movements/MovementModal";
import { useCotizacion } from "@/hooks/useCotizacion";
import { useT } from "@/hooks/useTranslation";
import { useHint } from "@/hooks/useHint";
import { SectionHint } from "@/components/ui/SectionHint";

function fechaCortaConAnio(fecha: string): string {
  if (!fecha) return "";
  if (fecha.includes("-")) {
    const [y, m, d] = fecha.split("-");
    return `${d}/${m}/${y.slice(-2)}`;
  }
  if (fecha.includes("/")) {
    const [d, m, y] = fecha.split("/");
    return `${d.padStart(2,"0")}/${m.padStart(2,"0")}/${(y??"").slice(-2)}`;
  }
  return fecha;
}
import { agruparPorPeriodo } from "@/utils/periodo";
import { serieTendencia, progresoMetaPropia, parsePeriodoId } from "@/utils/reportes";
import { useMoney, MASK } from "@/hooks/useHideValues";
import { useAppPrefs } from "@/hooks/useAppPrefs";
import { EyeIcon } from "@/components/ui/EyeIcon";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { MiniStat } from "@/components/ui/MiniStat";
import { KpiInfoModal } from "@/components/ui/KpiInfoModal";
import { Movimiento } from "@/types";
import { calcularReserva } from "@/utils/reserva";
import { PageHeader } from "@/components/ui/PageHeader";

export default function DolaresPage() {
  const { movimientos, loading, config, refresh: refreshData, updateMovimiento, removeMovimiento, prependMovimiento } = useData();
  const { user } = useAuth();
  const { cotizacion, minutosDesdeActualizacion, refresh } = useCotizacion();

  // Modal: alta de reserva (+/-) desde el botón, o detalle/edición al tocar una fila del historial.
  const [modal, setModal] = useState<{ mode: "add" } | { mode: "edit"; mov: Movimiento } | null>(null);
  const [historialOpen, setHistorialOpen] = useState(false);
  const [kpiInfo, setKpiInfo] = useState<{ title: string; value: string; explain: string; color?: string } | null>(null);

  useEffect(() => { refresh(); }, []);
  const t = useT();
  const { oculto, toggle, m: money } = useMoney();
  const { monedaInversiones, monedaPrincipal } = useAppPrefs();

  const [showHint, dismissHint] = useHint("tapKpis");

  const monedaInversionesEfectiva: "USD" | "EUR" =
    monedaPrincipal === "USD" ? "EUR" :
    monedaPrincipal === "EUR" ? "USD" :
    monedaInversiones;
  const esEUR = monedaInversionesEfectiva === "EUR";
  const simbolo = esEUR ? "€" : "U$D";

  // La cotización del usuario es SIEMPRE la oficial (el blue solo se elige en la carga).
  // Si hay cotización manual activa, reemplaza al oficial SOLO en la moneda de inversión activa.
  const manualOn = !!config?.meta.cotizacionManualActiva && (config?.meta.cotizacionManual ?? 0) > 0;
  const manualVal = config?.meta.cotizacionManual ?? 0;
  const cotizacionUSD = manualOn && !esEUR ? manualVal : (cotizacion ? cotizacion.oficial : null);
  const cotizacionEUR = manualOn && esEUR ? manualVal : (cotizacion ? cotizacion.oficial_euro ?? null : null);

  // ── USD ──
  const comprasUSD = movimientos
    .filter((m) => m.tipo === "CompraUSD" || m.tipo === "GastoUSD" || m.tipo === "VentaUSD" || m.tipo === "IngresoUSD")
    .sort((a, b) => b.timestampCarga.getTime() - a.timestampCarga.getTime());
  const historialUSD = comprasUSD; // compras (+) y retiros (−) de la reserva
  const { total: desdeMovimientosUSD, costoPromedio: costoPromedioUSD } = calcularReserva(comprasUSD, "USD");
  // La reserva es SOLO lo cargado como movimientos: el saldo inicial a mano se eliminó
  // (los ahorros se calculan, no se cargan). Ver CHANGELOG v2.89.1.
  const totalUSD = desdeMovimientosUSD;
  const reservaUSDenARS = cotizacionUSD ? totalUSD * cotizacionUSD : null;
  const gananciaUSD = cotizacionUSD && costoPromedioUSD > 0 ? desdeMovimientosUSD * (cotizacionUSD - costoPromedioUSD) : null;
  const gananciaPctUSD = gananciaUSD && desdeMovimientosUSD * costoPromedioUSD > 0 ? (gananciaUSD / (desdeMovimientosUSD * costoPromedioUSD)) * 100 : null;

  // ── EUR ──
  const comprasEUR = movimientos
    .filter((m) => m.tipo === "CompraEUR" || m.tipo === "GastoEUR" || m.tipo === "VentaEUR" || m.tipo === "IngresoEUR")
    .sort((a, b) => b.timestampCarga.getTime() - a.timestampCarga.getTime());
  const historialEUR = comprasEUR; // compras (+) y retiros (−) de la reserva
  const { total: desdeMovimientosEUR, costoPromedio: costoPromedioEUR } = calcularReserva(comprasEUR, "EUR");
  const totalEUR = desdeMovimientosEUR;
  const reservaEURenARS = cotizacionEUR ? totalEUR * cotizacionEUR : null;
  const gananciaEUR = cotizacionEUR && costoPromedioEUR > 0 ? desdeMovimientosEUR * (cotizacionEUR - costoPromedioEUR) : null;
  const gananciaPctEUR = gananciaEUR && desdeMovimientosEUR * costoPromedioEUR > 0 ? (gananciaEUR / (desdeMovimientosEUR * costoPromedioEUR)) * 100 : null;

  // ── Visibilidad de secciones FX (reserva/historial): solo si la parte FX está activa
  //    (ARS + permiso). La meta propia NO depende de esto (es para todos). showFX se define
  //    más abajo junto con esARS; acá se calcula la visibilidad por moneda de reserva. ──
  const showUSD = historialUSD.length > 0 || !esEUR;
  const showEUR = historialEUR.length > 0 || esEUR;
  const hasBoth = historialUSD.length > 0 && historialEUR.length > 0;

  // ── Meta — aplica a la moneda primaria configurada ──
  const totalDisplay = esEUR ? totalEUR : totalUSD;
  const metaUSD = config?.meta.metaPorPeriodo ?? config?.meta.usdMensual ?? 400;

  // ── Tendencias de inversión ──
  const periodos = useMemo(() => agruparPorPeriodo(movimientos), [movimientos]);

  const metaMonto = config?.meta.metaMonto ?? null;
  const inversionSeedId = config?.meta.inversionSeedPeriodoId;

  // ── Net worth ──
  const disponibleActual = periodos[0]?.disponible ?? 0;
  const ahorrosTotales = useMemo(() => {
    const serie = serieTendencia(periodos, config?.meta.ahorrosAcumSeedPeriodoId ?? undefined);
    return serie.length > 0 ? serie[serie.length - 1].ahorrosAcum : 0;
  }, [periodos, config?.meta.ahorrosAcumSeedPeriodoId]);
  const fxEnARS = (reservaUSDenARS ?? 0) + (reservaEURenARS ?? 0);
  const totalPatrimonio = disponibleActual + ahorrosTotales + fxEnARS;
  const totalEnUSD = cotizacionUSD && cotizacionUSD > 0 ? totalPatrimonio / cotizacionUSD : null;
  const showNetWorth = fxEnARS > 0;

  // Reserva FX (comprar divisa, patrimonio, meta FX): solo ARS con inversión habilitada.
  // showAhorros ya gatea la tab entera; acá adentro la META PROPIA es para TODOS y la
  // reserva FX depende de moneda ARS + permiso de inversión (dueño o permiso).
  const esARS = monedaPrincipal === "ARS";
  const isOwner = !!user?.email && user.email === process.env.NEXT_PUBLIC_OWNER_EMAIL;
  const inversionAllowed = isOwner || config?.meta.permisos?.inversion === true;
  const showFX = esARS && inversionAllowed;
  const simboloPropio = monedaPrincipal === "EUR" ? "€" : monedaPrincipal === "USD" ? "U$D" : "$";

  // Meta propia: progreso sobre los ahorros acumulados ya calculados (misma serie del patrimonio).
  const serieAhorros = useMemo(() => serieTendencia(periodos, config?.meta.ahorrosAcumSeedPeriodoId ?? undefined), [periodos, config?.meta.ahorrosAcumSeedPeriodoId]);
  const metaPropia = config?.meta.metaPropia;
  const progresoPropia = metaPropia?.monto ? progresoMetaPropia(serieAhorros, metaPropia.monto) : null;
  const fxLabel = historialUSD.length > 0 && historialEUR.length > 0 ? "divisas" : historialEUR.length > 0 ? "EUR" : "U$D";

  // Datos de ahorro para el usuario SIN reserva FX (EUR/USD): ritmo, proyección y mejor/peor
  // período. Todo sale de la serie ya calculada — solo la ventana desde el seed (evita arrastrar
  // períodos viejos con carga incompleta). El [0] de la serie es el más antiguo (orden cronológico).
  const ahorroStats = useMemo(() => {
    const seedIdx = config?.meta.ahorrosAcumSeedPeriodoId ? serieAhorros.findIndex((p) => p.periodoId === config.meta.ahorrosAcumSeedPeriodoId) : 0;
    const desde = Math.max(seedIdx >= 0 ? seedIdx : 0, 1); // arranca en 1: necesitamos el punto previo para el delta
    // El ritmo se mide como la VARIACIÓN NETA del ahorro acumulado por período (delta de
    // ahorrosAcum), no el ahorro bruto: así incluye lo que se desgató a disponible y nunca
    // puede ser mayor que el acumulado. Cada delta = cuánto subió/bajó el total ese período.
    const deltas = serieAhorros.slice(desde).map((p, i) => ({ periodoId: p.periodoId, delta: p.ahorrosAcum - serieAhorros[desde + i - 1]!.ahorrosAcum }));
    if (deltas.length === 0) return null;
    const ritmo = deltas.reduce((s, d) => s + d.delta, 0) / deltas.length;
    const acum = serieAhorros[serieAhorros.length - 1]?.ahorrosAcum ?? 0;
    const mejor = deltas.reduce((a, b) => (b.delta > a.delta ? b : a));
    const peor = deltas.reduce((a, b) => (b.delta < a.delta ? b : a));
    return { ritmo, proyeccion: acum + Math.max(0, ritmo) * 3, mejor, peor };
  }, [serieAhorros, config?.meta.ahorrosAcumSeedPeriodoId]);

  // Auto-anclar el seed la primera vez: el período actual es desde cuando se
  // empezó a corregir bien la carga FX. La ventana de promedio crece período a período.
  useEffect(() => {
    if (!user?.uid || !config || inversionSeedId || periodos.length === 0) return;
    updateDoc(doc(db, `users/${user.uid}/config/meta`), { "meta.inversionSeedPeriodoId": periodos[0].periodoId });
  }, [user?.uid, !!config, !!inversionSeedId, periodos.length]);

  // FX neto comprado por período (CompraFX - GastoFX - VentaFX por cantidadUSD).
  const tipoCompraFX  = esEUR ? "CompraEUR"  : "CompraUSD";
  const tipoGastoFX   = esEUR ? "GastoEUR"   : "GastoUSD";
  const tipoVentaFX   = esEUR ? "VentaEUR"   : "VentaUSD";
  const tipoIngresoFX = esEUR ? "IngresoEUR" : "IngresoUSD";
  const netFXDe = (movs: Movimiento[]) => movs.reduce((s, m) => {
    if ((m.tipo === tipoCompraFX || m.tipo === tipoIngresoFX) && m.cantidadUSD) return s + m.cantidadUSD;
    if ((m.tipo === tipoGastoFX || m.tipo === tipoVentaFX) && m.cantidadUSD) return s - m.cantidadUSD;
    return s;
  }, 0);

  // Promedio del ritmo FX sobre la ventana desde el seed (incluido) hasta el actual.
  // periodos[0] es el más nuevo; el seed queda más atrás → tomamos del 0 al seed.
  const promAhorroUSD = useMemo(() => {
    if (periodos.length === 0) return null;
    const seedIdx = inversionSeedId ? periodos.findIndex((p) => p.periodoId === inversionSeedId) : 0;
    const ventana = periodos.slice(0, (seedIdx >= 0 ? seedIdx : 0) + 1);
    if (ventana.length === 0) return null;
    const prom = ventana.reduce((s, p) => s + netFXDe(p.movimientos), 0) / ventana.length;
    return prom > 0 ? prom : null;
  }, [periodos, inversionSeedId, tipoCompraFX, tipoGastoFX, tipoVentaFX]);

  const ritmoFX = promAhorroUSD ?? 0;
  const periodosParaMeta = metaMonto && ritmoFX > 0
    ? Math.ceil(Math.max(0, metaMonto - totalDisplay) / ritmoFX) : null;
  const proyUSD = ritmoFX > 0 ? totalDisplay + ritmoFX * 3 : null;

  // Card de meta propia (sobre ahorros, moneda principal). Se ubica arriba (usuario sin FX)
  // o al final (usuario ARS con reserva FX) — ver render.
  const metaPropiaCard = progresoPropia && metaPropia ? (() => {
    const alcanzada = progresoPropia.faltante <= 0;
    const barColor = progresoPropia.pct >= 80 ? "var(--green)" : progresoPropia.pct >= 40 ? "var(--yellow)" : "var(--red)";
    return (
      <div className="card" style={{ background: "var(--surface)", marginBottom: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div className="label" style={{ marginBottom: 0 }}>{t.savingsGoal}</div>
            {alcanzada && <span className="badge" style={{ background: "var(--green-dim)", color: "var(--green)", border: "1px solid var(--green)44" }}>{t.reachedBadge}</span>}
          </div>
          {metaPropia.fecha && <div style={{ fontSize: 9, color: "var(--muted)" }}>{fechaCortaConAnio(metaPropia.fecha)}</div>}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 12 }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: "var(--green)", fontFamily: "var(--font-mono)", lineHeight: 1 }}>
            {oculto ? "••••" : `${simboloPropio} ${progresoPropia.acumulado.toLocaleString("es-AR")}`}
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>{t.savingsGoalOf(`${simboloPropio} ${metaPropia.monto.toLocaleString("es-AR")}`)}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: alcanzada ? "var(--green)" : "var(--muted)", fontFamily: "var(--font-mono)" }}>
              {alcanzada ? t.reached : t.remainingShort(oculto ? "••" : `${simboloPropio} ${Math.round(progresoPropia.faltante).toLocaleString("es-AR")}`)}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div className="progress-track" style={{ flex: 1, margin: 0 }}>
            <div className="progress-fill" style={{ width: `${progresoPropia.pct}%`, background: barColor }} />
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: barColor, fontFamily: "var(--font-mono)", minWidth: 36, textAlign: "right" }}>{progresoPropia.pct}%</span>
        </div>
        {progresoPropia.periodos !== null && (
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 10 }}>
            {progresoPropia.periodos === 0 ? t.reached : t.savingsGoalPeriods(progresoPropia.periodos)}
          </div>
        )}
      </div>
    );
  })() : null;

  // ── Cards para el usuario SIN reserva FX (EUR/USD). Patrimonio en su moneda + ritmo + mejor/peor.
  const mesDePeriodo = (periodoId: string) => {
    const d = parsePeriodoId(periodoId);
    return isNaN(d.getTime()) ? periodoId : d.toLocaleDateString("es-AR", { month: "short", year: "numeric" });
  };

  const patrimonioPropioCard = (
    <div className="card" style={{ background: "linear-gradient(135deg, var(--surface) 0%, color-mix(in srgb, var(--green) 8%, var(--surface)) 100%)", border: "1px solid color-mix(in srgb, var(--green) 20%, var(--border))", marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div className="label" style={{ marginBottom: 0 }}>{t.netWorthLabel}</div>
        <button onClick={toggle} aria-label={t.hideValues} style={{ background: "transparent", border: "none", color: oculto ? "var(--accent)" : "var(--muted)", width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}>
          <EyeIcon off={oculto} />
        </button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {[{ label: t.available, value: disponibleActual }, { label: t.savings, value: ahorrosTotales }].map(({ label, value }) => (
          <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>{label}</span>
            <span style={{ fontSize: 13, fontFamily: "var(--font-mono)", color: "var(--text)" }}>{oculto ? "••••" : `${simboloPropio} ${value.toLocaleString("es-AR")}`}</span>
          </div>
        ))}
      </div>
      <div style={{ height: 1, background: "color-mix(in srgb, var(--green) 25%, var(--border))", margin: "12px 0" }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <span style={{ fontSize: 11, color: "var(--muted)", paddingBottom: 4, textTransform: "capitalize" }}>total</span>
        <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "var(--font-mono)", letterSpacing: -1, lineHeight: 1, background: "linear-gradient(110deg, var(--green) 0%, var(--blue) 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
          {oculto ? "••••" : `${simboloPropio} ${(disponibleActual + ahorrosTotales).toLocaleString("es-AR")}`}
        </div>
      </div>
    </div>
  );

  const ritmoPropioCard = ahorroStats ? (
    <div className="card" style={{ marginBottom: 10 }}>
      <div className="label" style={{ marginBottom: 14 }}>{t.savingsRateTitle}</div>
      <div style={{ display: "flex", gap: 8 }}>
        <MiniStat basis="1 1 0" center color="var(--green)" label={t.statPerPeriod} value={oculto ? "••" : `${simboloPropio} ${Math.round(ahorroStats.ritmo).toLocaleString("es-AR")}`} />
        <MiniStat basis="1 1 0" center color="var(--green)" label={t.statProjection} value={oculto ? "••••" : `${simboloPropio} ${Math.round(ahorroStats.proyeccion).toLocaleString("es-AR")}`} />
        {progresoPropia?.periodos != null && (
          <MiniStat basis="1 1 0" center color="var(--green)" label={t.statToGoal} value={progresoPropia.periodos === 0 ? t.reached : `${progresoPropia.periodos} ${t.periodsShort}`} />
        )}
      </div>
    </div>
  ) : null;

  const mejorPeorCard = ahorroStats && ahorroStats.mejor.periodoId !== ahorroStats.peor.periodoId ? (
    <div className="card" style={{ marginBottom: 10 }}>
      <div className="label" style={{ marginBottom: 14 }}>{t.yourPeriods}</div>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1, borderRadius: "var(--radius-sm)", padding: "13px 14px", background: "var(--green-dim)", border: "1px solid color-mix(in srgb, var(--green) 30%, transparent)" }}>
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--green)" }}>{t.bestPeriod}</div>
          <div style={{ fontSize: 19, fontWeight: 700, fontFamily: "var(--font-mono)", lineHeight: 1, margin: "7px 0 3px", color: "var(--green)" }}>{oculto ? "••" : `+${simboloPropio} ${Math.round(ahorroStats.mejor.delta).toLocaleString("es-AR")}`}</div>
          <div style={{ fontSize: 11, color: "var(--muted)" }}>{mesDePeriodo(ahorroStats.mejor.periodoId)}</div>
        </div>
        <div style={{ flex: 1, borderRadius: "var(--radius-sm)", padding: "13px 14px", background: "var(--surface-alt)", border: "1px solid var(--border)" }}>
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--muted)" }}>{t.weakestPeriod}</div>
          <div style={{ fontSize: 19, fontWeight: 700, fontFamily: "var(--font-mono)", lineHeight: 1, margin: "7px 0 3px", color: ahorroStats.peor.delta < 0 ? "var(--red)" : "var(--text)" }}>{oculto ? "••" : `${ahorroStats.peor.delta >= 0 ? "+" : "−"}${simboloPropio} ${Math.abs(Math.round(ahorroStats.peor.delta)).toLocaleString("es-AR")}`}</div>
          <div style={{ fontSize: 11, color: "var(--muted)" }}>{mesDePeriodo(ahorroStats.peor.periodoId)}</div>
        </div>
      </div>
    </div>
  ) : null;

  // Fila del historial FX (usada dentro del panel). moneda determina los tipos de movimiento.
  const renderFila = (m: Movimiento, moneda: "USD" | "EUR") => {
    const esRetiro = m.tipo === (moneda === "EUR" ? "GastoEUR" : "GastoUSD");
    const esVenta = m.tipo === (moneda === "EUR" ? "VentaEUR" : "VentaUSD");
    const esIngreso = m.tipo === (moneda === "EUR" ? "IngresoEUR" : "IngresoUSD");
    const esSalida = esRetiro || esVenta;
    return (
      <div key={m.id} className="row" onClick={() => { setHistorialOpen(false); setModal({ mode: "edit", mov: m }); }} style={{ cursor: "pointer" }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 500 }}>{fechaCortaConAnio(m.fecha)}</div>
          {esVenta
            ? <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>{t.sell}{m.cotizacion ? ` · ${t.rate} $${m.cotizacion.toLocaleString("es-AR")}` : ""}</div>
            : esRetiro
            ? <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>{t.removeReserve}</div>
            : esIngreso
            ? <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>{t.fxIncome}</div>
            : m.cotizacion && <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>{t.rate} ${m.cotizacion.toLocaleString("es-AR")}</div>}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: esVenta ? "var(--red)" : esRetiro ? "var(--blue)" : esIngreso ? "var(--green)" : "var(--yellow)", fontFamily: "var(--font-mono)" }}>
            {esSalida ? "−" : "+"}{oculto ? "••" : m.cantidadUSD?.toFixed(2)}
          </div>
          {!esRetiro && !esIngreso && <div style={{ fontSize: 10, color: esVenta ? "var(--green)" : "var(--muted)" }}>{esVenta ? "+" : ""}{money(m.monto)}</div>}
        </div>
      </div>
    );
  };

  return (
    <>
    <div className="page">
      {loading ? (
        <LoadingSpinner />
      ) : (
        <div className="fade-up">
          <PageHeader title={t.portfolio} style={{ marginBottom: 24 }} right={
            showFX ? (
              <button onClick={() => setHistorialOpen(true)} aria-label={t.usdHistory} style={{ background: "transparent", border: "none", width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--muted)", padding: 0 }}>
                <svg width="21" height="21" viewBox="0 0 24 24" fill="none">
                  <line x1="9" y1="7" x2="20" y2="7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  <line x1="9" y1="12" x2="20" y2="12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  <line x1="9" y1="17" x2="20" y2="17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  <circle cx="4.5" cy="7" r="1.4" fill="currentColor" />
                  <circle cx="4.5" cy="12" r="1.4" fill="currentColor" />
                  <circle cx="4.5" cy="17" r="1.4" fill="currentColor" />
                </svg>
              </button>
            ) : undefined
          } />
          {showHint && <SectionHint title={t.hintInvTitle} body={t.hintInvBody} onDismiss={dismissHint} />}

          {/* Usuario SIN reserva FX (EUR/USD): patrimonio en su moneda, meta 2da, ritmo y períodos.
              Todo desde la serie ya calculada. Para el ARS estas cards no aplican (usa las FX). */}
          {!showFX && (<>
            {patrimonioPropioCard}
            {metaPropiaCard}
            {ritmoPropioCard}
            {mejorPeorCard}
          </>)}

          {/* ── NET WORTH ── (solo FX/ARS) */}
          {showFX && showNetWorth && (
            <div className="card" style={{ background: "linear-gradient(135deg, var(--surface) 0%, color-mix(in srgb, var(--green) 8%, var(--surface)) 100%)", border: "1px solid color-mix(in srgb, var(--green) 20%, var(--border))", marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div className="label" style={{ marginBottom: 0 }}>patrimonio</div>
                <button onClick={toggle} aria-label={t.hideValues} style={{ background: "transparent", border: "none", color: oculto ? "var(--accent)" : "var(--muted)", width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}>
                  <EyeIcon off={oculto} />
                </button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { label: "disponible", value: disponibleActual },
                  { label: "ahorros", value: ahorrosTotales },
                  { label: fxLabel, value: fxEnARS },
                ].map(({ label, value }) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 12, color: "var(--muted)", textTransform: "capitalize" }}>{label}</span>
                    <span style={{ fontSize: 13, fontFamily: "var(--font-mono)", color: "var(--text)" }}>{oculto ? "••••" : money(value)}</span>
                  </div>
                ))}
              </div>
              <div style={{ height: 1, background: "color-mix(in srgb, var(--green) 25%, var(--border))", margin: "12px 0" }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                <span style={{ fontSize: 11, color: "var(--muted)", paddingBottom: 4, textTransform: "capitalize" }}>total</span>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "var(--font-mono)", letterSpacing: -1, lineHeight: 1, background: "linear-gradient(110deg, var(--green) 0%, var(--blue) 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                    {oculto ? "••••" : money(totalPatrimonio)}
                  </div>
                  {totalEnUSD !== null && (
                    <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
                      {oculto ? "≈ U$D ••••" : `≈ U$D ${totalEnUSD.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} · oficial`}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── SECCIÓN USD ── (solo FX/ARS) */}
          {showFX && showUSD && (<>
          <div className="card" style={{ background: "linear-gradient(135deg, var(--surface) 0%, var(--yellow-dim) 100%)", marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1 }}>{t.usdReserve}</div>
            </div>
            <div style={{ fontSize: 36, fontWeight: 700, color: "var(--yellow)", letterSpacing: -1, lineHeight: 1, fontFamily: "var(--font-mono)" }}>
              U$D {oculto ? "••••" : totalUSD.toFixed(2)}
            </div>
            {reservaUSDenARS && (
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 8 }}>
                ≈ {money(reservaUSDenARS)} · {manualOn && !esEUR ? t.rateManual : t.rateOfficial} ${cotizacionUSD?.toLocaleString("es-AR")}
              </div>
            )}
            {gananciaUSD !== null && (
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)", fontSize: 12 }}>
                <span style={{ color: "var(--muted)" }}>{t.avgPrice}: <span style={{ color: "var(--text)", fontFamily: "var(--font-mono)" }}>{oculto ? MASK : "$" + costoPromedioUSD.toLocaleString("es-AR", { maximumFractionDigits: 0 })}</span></span>
                <span style={{ color: "var(--muted)" }}>{t.profit}: <span style={{ color: gananciaUSD >= 0 ? "var(--green)" : "var(--red)", fontFamily: "var(--font-mono)", fontWeight: 700 }}>{oculto ? MASK : `${gananciaUSD >= 0 ? "+" : ""}${money(gananciaUSD)}`}{gananciaPctUSD !== null && !oculto ? ` (${gananciaUSD >= 0 ? "+" : ""}${gananciaPctUSD.toFixed(1)}%)` : ""}</span></span>
              </div>
            )}
          </div>

          </>)}

          {/* ── SECCIÓN EUR ── (solo FX/ARS) */}
          {showFX && showEUR && (<>
          <div className="card" style={{ background: "linear-gradient(135deg, var(--surface) 0%, var(--yellow-dim) 100%)", marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1 }}>{t.eurReserve}</div>
            </div>
            <div style={{ fontSize: 36, fontWeight: 700, color: "var(--yellow)", letterSpacing: -1, lineHeight: 1, fontFamily: "var(--font-mono)" }}>
              € {oculto ? "••••" : totalEUR.toFixed(2)}
            </div>
            {reservaEURenARS && (
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 8 }}>
                ≈ {money(reservaEURenARS)} · {manualOn && esEUR ? t.rateManual : t.rateOfficial} ${cotizacionEUR?.toLocaleString("es-AR")}
              </div>
            )}
            {gananciaEUR !== null && (
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)", fontSize: 12 }}>
                <span style={{ color: "var(--muted)" }}>{t.avgPrice}: <span style={{ color: "var(--text)", fontFamily: "var(--font-mono)" }}>{oculto ? MASK : "$" + costoPromedioEUR.toLocaleString("es-AR", { maximumFractionDigits: 0 })}</span></span>
                <span style={{ color: "var(--muted)" }}>{t.profit}: <span style={{ color: gananciaEUR >= 0 ? "var(--green)" : "var(--red)", fontFamily: "var(--font-mono)", fontWeight: 700 }}>{oculto ? MASK : `${gananciaEUR >= 0 ? "+" : ""}${money(gananciaEUR)}`}{gananciaPctEUR !== null && !oculto ? ` (${gananciaEUR >= 0 ? "+" : ""}${gananciaPctEUR.toFixed(1)}%)` : ""}</span></span>
              </div>
            )}
          </div>


          </>)}

          {/* Meta FX (reserva en divisa) — solo FX/ARS. Mide contra la reserva (totalDisplay). */}
          {showFX && config?.meta.metaFX?.monto && (() => {
            const metaFXMonto = config.meta.metaFX.monto;
            const falta = Math.max(0, metaFXMonto - totalDisplay);
            const pctMeta = Math.min((totalDisplay / metaFXMonto) * 100, 100);
            const metaAlcanzada = falta <= 0;
            const barColor = pctMeta >= 80 ? "var(--green)" : pctMeta >= 40 ? "var(--yellow)" : "var(--red)";
            return (
              <div className="card" style={{ background: "var(--surface)", marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div className="label" style={{ marginBottom: 0 }}>{t.fxGoal}</div>
                    {metaAlcanzada && <span className="badge" style={{ background: "var(--green-dim)", color: "var(--green)", border: "1px solid var(--green)44" }}>{t.reachedBadge}</span>}
                  </div>
                  {config.meta.metaFX.fecha && <div style={{ fontSize: 9, color: "var(--muted)" }}>{fechaCortaConAnio(config.meta.metaFX.fecha)}</div>}
                </div>

                {/* Objetivo + faltan */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: "var(--yellow)", fontFamily: "var(--font-mono)", lineHeight: 1 }}>
                      {simbolo} {metaFXMonto.toLocaleString("es-AR")}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 6 }}>{t.remainingLabel}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: metaAlcanzada ? "var(--green)" : "var(--yellow)", fontFamily: "var(--font-mono)" }}>
                      {oculto ? "••" : (metaAlcanzada ? "0" : Math.round(falta).toLocaleString("es-AR"))}
                    </div>
                  </div>
                </div>

                {/* Barra */}
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div className="progress-track" style={{ flex: 1, margin: 0 }}>
                    <div className="progress-fill" style={{ width: `${pctMeta}%`, background: barColor }} />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: barColor, fontFamily: "var(--font-mono)", minWidth: 36, textAlign: "right" }}>{pctMeta.toFixed(1)}%</span>
                </div>

                {/* Mini-stats */}
                <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                  {(() => {
                    const avg = oculto ? "••" : (promAhorroUSD !== null ? Math.round(promAhorroUSD).toLocaleString("es-AR") : "—");
                    const goal = Math.round(metaUSD).toLocaleString("es-AR");
                    return (
                    <MiniStat basis="1 1 0" center color="var(--yellow)" label={t.statPerPeriod} value={avg}
                      onClick={() => setKpiInfo({ title: t.statPerPeriod, value: `${avg} / ${goal}`, explain: t.kpiPerPeriodInfo, color: "var(--yellow)" })} />
                  ); })()}
                  {proyUSD !== null && (
                    <MiniStat basis="1 1 0" center color="var(--yellow)" label={t.statProjection}
                      value={oculto ? "••••" : Math.round(proyUSD).toLocaleString("es-AR")}
                      onClick={() => setKpiInfo({ title: t.statProjection, value: oculto ? "••••" : `${simbolo} ${Math.round(proyUSD).toLocaleString("es-AR")}`, explain: t.kpiProjectionInfo, color: "var(--yellow)" })} />
                  )}
                  {periodosParaMeta !== null && (
                    <MiniStat basis="1 1 0" center color="var(--yellow)" label={t.statToGoal}
                      value={periodosParaMeta === 0 ? t.reached : `${periodosParaMeta} ${t.periodsShort}`}
                      onClick={() => setKpiInfo({ title: t.statToGoal, value: periodosParaMeta === 0 ? t.reached : `${periodosParaMeta} ${t.periodsShort}`, explain: t.kpiToGoalInfo, color: "var(--yellow)" })} />
                  )}
                </div>
              </div>
            );
          })()}

          {/* Meta de ahorro al final para el usuario ARS con reserva FX. */}
          {showFX && metaPropiaCard}

        </div>
      )}
    </div>

    {/* Panel de historial FX — accedido por el ícono de reloj en el header */}
    {historialOpen && showFX && (
      <div onClick={() => setHistorialOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 200, background: "color-mix(in srgb, var(--bg) 60%, transparent)", backdropFilter: "blur(4px)", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
        <div onClick={(e) => e.stopPropagation()} className="fade-up" style={{ background: "var(--surface)", borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTop: "1px solid var(--border)", padding: 16, maxHeight: "82vh", overflowY: "auto", paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 20px)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div className="label" style={{ marginBottom: 0 }}>{t.reserve}</div>
            <button onClick={() => setHistorialOpen(false)} aria-label={t.close} style={{ background: "transparent", border: "none", color: "var(--muted)", cursor: "pointer", padding: 4 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
            </button>
          </div>

          {showUSD && historialUSD.length > 0 && (
            <div style={{ marginBottom: historialEUR.length > 0 ? 18 : 0 }}>
              {historialEUR.length > 0 && <div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono)", marginBottom: 6 }}>U$D</div>}
              {historialUSD.map((m) => renderFila(m, "USD"))}
            </div>
          )}
          {showEUR && historialEUR.length > 0 && (
            <div>
              {historialUSD.length > 0 && <div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono)", marginBottom: 6 }}>EUR</div>}
              {historialEUR.map((m) => renderFila(m, "EUR"))}
            </div>
          )}

          {/* Cargar reserva vive acá dentro: fuera del panel se carga desde los atajos de Inicio. */}
          <div style={{ display: "flex", justifyContent: "center", marginTop: 18 }}>
            <button onClick={() => { setHistorialOpen(false); setModal({ mode: "add" }); }} aria-label={t.reserve} style={{ display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "none", color: "var(--green)", cursor: "pointer", padding: 8, filter: "drop-shadow(0 2px 12px var(--green)99)" }}>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            </button>
          </div>
        </div>
      </div>
    )}

    <MovementModal
      open={modal !== null}
      mode={modal?.mode === "edit" ? "edit" : "add"}
      reserveMode={modal?.mode === "add"}
      readOnly={modal?.mode === "edit"}
      movimiento={modal?.mode === "edit" ? modal.mov : null}
      movimientos={movimientos}
      config={config}
      onClose={() => setModal(null)}
      onChanged={refreshData}
      onCreated={prependMovimiento}
      onUpdated={updateMovimiento}
      onDeleted={removeMovimiento}
    />
    {kpiInfo && <KpiInfoModal title={kpiInfo.title} value={kpiInfo.value} explain={kpiInfo.explain} color={kpiInfo.color} onClose={() => setKpiInfo(null)} />}
    </>
  );
}
