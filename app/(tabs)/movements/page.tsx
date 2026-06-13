"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useAllMovimientos } from "@/hooks/useAllMovimientos";
import { useConfig } from "@/hooks/useConfig";
import { useCotizacion } from "@/hooks/useCotizacion";
import { crearMovimiento, actualizarMovimiento, eliminarMovimiento } from "@/services/firebase/movimientos";
import { agruparPorPeriodo, formatARS, fechaCorta } from "@/utils/periodo";
import { serieTendencia } from "@/utils/reportes";
import { useMoney } from "@/hooks/useHideValues";
import { useAppPrefs } from "@/hooks/useAppPrefs";
import { Movimiento, TipoMovimiento } from "@/types";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { EyeIcon } from "@/components/ui/EyeIcon";
import { useT } from "@/hooks/useTranslation";

// ── Íconos ────────────────────────────────────────────────────────────────────
const TrashIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
    <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);

// ── Un solo Modal ────────────────────────────────────────────────────────────
function Modal({ open, onClose, title, children }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode;
}) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200,
      pointerEvents: open ? "all" : "none",
    }}>
      <div onClick={onClose} style={{
        position: "absolute", inset: 0,
        background: "rgba(0,0,0,0.75)",
        opacity: open ? 1 : 0,
        transition: "opacity 0.2s",
      }} />
      <div style={{
        position: "absolute", left: 0, right: 0, bottom: 0,
        background: "var(--bg)",
        borderRadius: "20px 20px 0 0",
        maxHeight: "92dvh",
        overflowY: "auto",
        transform: open ? "translateY(0)" : "translateY(100%)",
        transition: "transform 0.32s cubic-bezier(0.32,0.72,0,1)",
      }}>
        <div style={{ padding: "12px 16px 0", position: "sticky", top: 0, background: "var(--bg)", zIndex: 1 }}>
          <div style={{ width: 36, height: 4, background: "var(--border)", borderRadius: 2, margin: "0 auto 14px" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <span style={{ fontSize: 16, fontWeight: 700 }}>{title}</span>
            <button onClick={onClose} style={{
              background: "none", border: "none", color: "var(--red)",
              fontSize: 22, cursor: "pointer", lineHeight: 1, padding: 4,
            }}>×</button>
          </div>
        </div>
        <div style={{ padding: "0 16px 40px" }}>{children}</div>
      </div>
    </div>
  );
}

function TipoDot({ tipo, categoria }: { tipo: TipoMovimiento; categoria: string }) {
  let c = "var(--muted)";
  if (tipo === "Gasto" || tipo === "CompraUSD" || tipo === "CompraEUR") c = "var(--red)";
  else if (tipo === "Move") c = "var(--yellow)";
  else if (tipo === "Ingreso") {
    if (categoria === "Ahorros" || categoria === "RESTO") c = "var(--blue)";
    else c = "var(--green)";
  }
  return <div style={{ width: 8, height: 8, borderRadius: "50%", background: c, flexShrink: 0, marginTop: 5 }} />;
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function MovimientosPage() {
  const { user } = useAuth();
  const { oculto, toggle, m: money } = useMoney();
  const { movimientos, loading, refresh } = useAllMovimientos(user?.uid);
  const { config } = useConfig(user?.uid);
  const { cotizacion } = useCotizacion();
  const { monedaInversiones, monedaPrincipal } = useAppPrefs();
  const t = useT();
  const monedaInversionesEfectiva: "USD" | "EUR" =
    monedaPrincipal === "USD" ? "EUR" :
    monedaPrincipal === "EUR" ? "USD" :
    monedaInversiones;
  const esEURMode = monedaInversionesEfectiva === "EUR";

  const TIPOS: { t: TipoMovimiento; label: string; color: string }[] = [
    { t: "Gasto",                             label: t.tipoDisplay["Gasto"],   color: "var(--red)" },
    { t: "Ingreso",                           label: t.tipoDisplay["Ingreso"], color: "var(--green)" },
    { t: "Move",                              label: t.tipoDisplay["Move"],    color: "var(--yellow)" },
    { t: esEURMode ? "CompraEUR" : "CompraUSD", label: esEURMode ? "+EUR" : "+USD", color: "var(--yellow)" },
    { t: esEURMode ? "GastoEUR"  : "GastoUSD",  label: esEURMode ? "-EUR" : "-USD", color: "var(--yellow)" },
  ];

  const periodos = agruparPorPeriodo(movimientos);
  const años = useMemo(() => Array.from(new Set(periodos.map(p => p.periodoId.split("/")[2] ?? ""))).filter(Boolean), [periodos]);
  const [añoSel, setAñoSel] = useState<string>("");
  const añoActivo = añoSel || años[0] || "";
  const periodosDelAño = useMemo(() => periodos.filter(p => (p.periodoId.split("/")[2] ?? "") === añoActivo), [periodos, añoActivo]);
  const [periodoSel, setPeriodoSel] = useState<string | null>(null);
  const activePeriodoId = periodoSel ?? periodosDelAño[0]?.periodoId;
  const periodoActual = periodos.find(p => p.periodoId === activePeriodoId);
  // Ahorro acumulado (carry-forward) hasta el período activo — para el Move
  const serie = useMemo(() => serieTendencia(periodos, config?.meta.ahorrosAcumSeedPeriodoId), [periodos, config?.meta.ahorrosAcumSeedPeriodoId]);
  const ahorrosAcumActivo = serie.find(s => s.periodoId === activePeriodoId)?.ahorrosAcum ?? 0;

  // ── Modal: "add" | "edit" | "delete" | null
  const [modal, setModal] = useState<"add" | "edit" | "delete" | null>(null);
  const [movSel, setMovSel] = useState<Movimiento | null>(null);

  // ── Add state ──────────────────────────────────────────────────────────────
  const [tipo, setTipo] = useState<TipoMovimiento>("Gasto");
  const [categoria, setCategoria] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [monto, setMonto] = useState("");
  const [fecha, setFecha] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  });
  const [medioPago, setMedioPago] = useState("Mercado Pago");
  const [observaciones, setObservaciones] = useState("");
  const [origenAhorro, setOrigenAhorro] = useState("");
  const [cantidadUSD, setCantidadUSD] = useState("");
  const [montoARSInput, setMontoARSInput] = useState("");
  const [modoCarga, setModoCarga] = useState<"USD" | "ARS">("USD");
  const [cotizManual, setCotizManual] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState("");

  // ── Edit state ─────────────────────────────────────────────────────────────
  const [eMonto, setEMonto] = useState("");
  const [eDesc, setEDesc] = useState("");
  const [eMedio, setEMedio] = useState("");
  const [eObs, setEObs] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const isDirtyEdit = !!movSel && (
    eMonto !== String(movSel.monto) ||
    eDesc !== (movSel.descripcion ?? "") ||
    eMedio !== (movSel.medioPago ?? "") ||
    eObs !== (movSel.observaciones ?? "")
  );

  const esSueldo  = tipo === "Ingreso" && categoria === "Sueldo";
  const esAhorros = tipo === "Ingreso" && categoria === "Ahorros";
  const esMove    = tipo === "Move";
  const esCompraUSD = tipo === "CompraUSD";
  const esGastoUSD  = tipo === "GastoUSD";
  const esCompraEUR = tipo === "CompraEUR";
  const esGastoEUR  = tipo === "GastoEUR";
  const esCompraFX  = esCompraUSD || esCompraEUR;
  const esGastoFX   = esGastoUSD  || esGastoEUR;
  const esUSD       = esCompraFX  || esGastoFX;
  const fxLabel     = esCompraEUR || esGastoEUR ? "EUR" : "USD";
  const tipoColor = TIPOS.find(tx => tx.t === tipo)?.color ?? "var(--accent)";

  // Fade del botón flotante: visible al cargar, desaparece tras 2.5s sin scroll
  const [btnVisible, setBtnVisible] = useState(true);
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const show = () => {
      setBtnVisible(true);
      if (scrollTimer.current) clearTimeout(scrollTimer.current);
      scrollTimer.current = setTimeout(() => setBtnVisible(false), 1000);
    };
    scrollTimer.current = setTimeout(() => setBtnVisible(false), 2000);
    document.addEventListener("scroll", show, { passive: true });
    document.addEventListener("touchstart", show, { passive: true });
    document.addEventListener("touchmove", show, { passive: true });
    document.addEventListener("click", show);
    return () => {
      document.removeEventListener("scroll", show);
      document.removeEventListener("touchstart", show);
      document.removeEventListener("touchmove", show);
      document.removeEventListener("click", show);
      if (scrollTimer.current) clearTimeout(scrollTimer.current);
    };
  }, []);

  const categoriasFiltradas = tipo === "Gasto"
    ? (config?.categorias.filter(c => c.tipo === "Gasto" && c.activa) ?? [])
    : tipo === "Ingreso"
    ? (periodos.length === 0
       ? [{ id: "sueldo", nombre: "Sueldo", tipo: "Ingreso" as const, activa: true }]
       : [{ id: "sueldo", nombre: "Sueldo", tipo: "Ingreso" as const, activa: true },
          { id: "ahorros", nombre: "Ahorros", tipo: "Ingreso" as const, activa: true }])
    : [];

  const cotizActual = cotizManual ? parseFloat(cotizManual) : cotizacion?.oficial ?? 0;
  // GastoFX: sólo divisa, no ARS. CompraFX: bidireccional divisa↔ARS
  const usdFinal = !esUSD ? 0 : esGastoFX
    ? parseFloat(cantidadUSD || "0")
    : modoCarga === "USD"
    ? parseFloat(cantidadUSD || "0")
    : (cotizActual ? parseFloat(montoARSInput || "0") / cotizActual : 0);
  const arsCompraUSD = !esCompraFX ? 0 : modoCarga === "USD"
    ? parseFloat(cantidadUSD || "0") * cotizActual
    : parseFloat(montoARSInput || "0");

  // "YYYY-MM-DD" → "D/M/YYYY" (formato de periodoId)
  const fechaAPeriodoId = (f: string) => {
    const [y, m, d] = f.split("-");
    return d && m && y ? `${parseInt(d)}/${parseInt(m)}/${y}` : f;
  };
  // Sin períodos todavía (usuario nuevo): el primer Sueldo abre el período.
  const sinPeriodos = periodos.length === 0;

  const canSubmit = (!!periodoActual || (sinPeriodos && esSueldo)) && (
    esGastoFX ? usdFinal > 0 :
    esCompraFX ? usdFinal > 0 && arsCompraUSD > 0 :
    esMove ? true :
    !!categoria && parseFloat(monto || "0") > 0
  );

  const movsFiltrados = useMemo(() =>
    [...(periodoActual?.movimientos ?? [])].sort((a, b) => {
      const d = b.fecha.localeCompare(a.fecha);
      return d !== 0 ? d : b.timestampCarga.getTime() - a.timestampCarga.getTime();
    }),
    [periodoActual]
  );

  const movsPorFecha = useMemo(() => {
    const groups: { fecha: string; movs: typeof movsFiltrados }[] = [];
    for (const m of movsFiltrados) {
      if (groups.length === 0 || groups[groups.length - 1].fecha !== m.fecha)
        groups.push({ fecha: m.fecha, movs: [] });
      groups[groups.length - 1].movs.push(m);
    }
    return groups;
  }, [movsFiltrados]);

  const resetAdd = () => {
    setDescripcion(""); setMonto(""); setCategoria(""); setOrigenAhorro("");
    setCantidadUSD(""); setCotizManual(""); setObservaciones(""); setAddError("");
    setMontoARSInput(""); setModoCarga("USD");
    const now = new Date();
    setFecha(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`);
  };

  const openAdd = () => {
    resetAdd();
    if (periodos.length === 0) { setTipo("Ingreso"); setCategoria("Sueldo"); }
    else setTipo("Gasto");
    setModal("add");
  };

  const openEdit = (m: Movimiento) => {
    setMovSel(m);
    setEMonto(String(m.monto));
    setEDesc(m.descripcion || (m as Movimiento & { origenAhorro?: string }).origenAhorro || "");
    setEMedio(m.medioPago ?? "");
    setEObs(m.observaciones ?? "");
    setModal("edit");
  };

  const closeModal = () => { setModal(null); setMovSel(null); };

  // Si llegamos con ?m=<id> (desde el dashboard), abrir ese movimiento para editar.
  useEffect(() => {
    if (loading || movimientos.length === 0) return;
    const id = new URLSearchParams(window.location.search).get("m");
    if (!id) return;
    const mov = movimientos.find((x) => x.id === id);
    if (mov) openEdit(mov);
    window.history.replaceState(null, "", "/movements");
  }, [loading, movimientos]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError("");
    setAddLoading(true);
    try {
      if (!user?.uid) throw new Error(t.errNotAuth);
      if (!esMove && !esUSD && !categoria) throw new Error(t.errSelectCat);
      const montoFinal = esCompraFX ? arsCompraUSD : esGastoFX ? 0 : parseFloat(monto);
      if (!esGastoFX && (!montoFinal || montoFinal <= 0)) throw new Error(t.errInvalidAmount);
      if (esUSD && (!usdFinal || usdFinal <= 0)) throw new Error(t.errInvalidFX(fxLabel));
      // Si no hay período activo pero es el primer Sueldo, lo abre con su fecha.
      const periodoIdFinal = periodoActual?.periodoId ?? (sinPeriodos && esSueldo ? fechaAPeriodoId(fecha) : null);
      if (!periodoIdFinal) throw new Error(t.errNoActivePeriod);
      await crearMovimiento(user.uid, {
        timestampCarga: new Date(), fecha, tipo,
        categoria: esMove ? "Move" : esCompraFX ? tipo : esGastoFX ? tipo : categoria,
        descripcion: esMove ? "Move a disponible" : esCompraFX ? `Compra ${fxLabel}` : esGastoFX ? `Gasto ${fxLabel}` : esAhorros ? (origenAhorro || descripcion.trim()) : descripcion.trim(),
        monto: montoFinal,
        medioPago: esMove || esCompraFX ? "Mercado Pago" : esGastoFX ? "—" : medioPago,
        observaciones, periodoId: periodoIdFinal, userId: user.uid,
        ...(esAhorros && origenAhorro ? { origenAhorro } : {}),
        ...(esCompraFX ? { cantidadUSD: usdFinal, cotizacion: cotizActual } : {}),
        ...(esGastoFX ? { cantidadUSD: usdFinal } : {}),
      });
      const autoAhorroMedios = config?.meta.autoAhorro?.mediosPago;
      const autoAhorroOmitir = config?.meta.autoAhorro?.omitirDescripciones ?? [];
      if (tipo === "Gasto" && config?.meta.autoAhorro?.activo && (config.meta.autoAhorro.monto ?? 0) > 0 &&
          (!autoAhorroMedios?.length || autoAhorroMedios.includes(medioPago)) &&
          !autoAhorroOmitir.some(d => d.toLowerCase() === descripcion.trim().toLowerCase())) {
        await crearMovimiento(user.uid, {
          timestampCarga: new Date(), fecha, tipo: "Ingreso",
          categoria: "Ahorros", descripcion: "Auto-ahorro",
          monto: config.meta.autoAhorro.monto,
          medioPago: "—", observaciones: "por gasto",
          periodoId: periodoIdFinal, userId: user.uid,
        });
      }
      resetAdd(); closeModal(); refresh();
    } catch (err: unknown) {
      setAddError(err instanceof Error ? err.message : t.unexpectedError);
    } finally {
      setAddLoading(false);
    }
  };

  const handleEdit = async () => {
    if (!user?.uid || !movSel) return;
    setEditLoading(true);
    try {
      const locked = movSel.tipo === "Ingreso" && movSel.categoria === "Sueldo";
      const update: Partial<Movimiento> = { monto: parseFloat(eMonto), observaciones: eObs };
      if (!locked) { update.descripcion = eDesc.trim(); update.medioPago = eMedio; }
      await actualizarMovimiento(user.uid, movSel.id, update);
      closeModal(); refresh();
    } catch (err) { console.error(err); }
    finally { setEditLoading(false); }
  };

  const handleDelete = async () => {
    if (!user?.uid || !movSel) return;
    setEditLoading(true);
    try {
      await eliminarMovimiento(user.uid, movSel.id);
      closeModal(); refresh();
    } catch (err) { console.error(err); }
    finally { setEditLoading(false); }
  };

  const isLocked = movSel ? movSel.tipo === "Ingreso" && movSel.categoria === "Sueldo" : false;

  // ── Títulos del modal ──────────────────────────────────────────────────────
  const modalTitle = modal === "add" ? t.newMovement : modal === "delete" ? t.delete : t.editMovement;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
    <div className="page">

      {loading ? (
        <LoadingSpinner />
      ) : (
        <div className="fade-up">
          <div style={{ marginBottom: 20 }}>
            <div className="label" style={{ marginBottom: 2 }}>{t.management}</div>
            <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.5, display: "inline-block", background: "linear-gradient(110deg, var(--blue) 10%, var(--green) 90%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>{t.pageTitleMovements}</div>
            {periodoActual && (
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
                {activePeriodoId === periodos[0]?.periodoId ? t.available : t.remaining}: <span style={{ color: "var(--green)", fontFamily: "var(--font-mono)" }}>{money(periodoActual.disponible)}</span>
                <button onClick={toggle} aria-label={t.hideValues} style={{
                  background: "transparent", border: "none", color: oculto ? "var(--accent)" : "var(--muted)",
                  width: 20, height: 20, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0,
                }}>
                  <EyeIcon off={oculto} />
                </button>
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 4, marginBottom: 8, overflowX: "auto", scrollbarWidth: "none", touchAction: "pan-x" }}>
            {años.map(año => (
              <button key={año} onClick={() => { setAñoSel(año); setPeriodoSel(null); }} style={{
                flexShrink: 0, padding: "4px 12px", borderRadius: 999, fontSize: 10, fontWeight: 700, cursor: "pointer",
                border: `1px solid ${añoActivo === año ? "var(--blue)" : "var(--border)"}`,
                background: añoActivo === año ? "var(--blue-dim)" : "transparent",
                color: añoActivo === año ? "var(--blue)" : "var(--muted)",
                transition: "all 0.15s",
              }}>{año}</button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 16, paddingBottom: 2, scrollbarWidth: "none", touchAction: "pan-x" }}>
            {periodosDelAño.map(p => {
              const isSelected = activePeriodoId === p.periodoId;
              const [d, m] = p.periodoId.split("/");
              return (
                <button key={p.periodoId} onClick={() => setPeriodoSel(p.periodoId)} style={{
                  flexShrink: 0, padding: "4px 12px", borderRadius: 999, fontSize: 10, fontWeight: 700, cursor: "pointer",
                  border: `1px solid ${isSelected ? "var(--green)" : "var(--border)"}`,
                  background: isSelected ? "var(--green-dim)" : "transparent",
                  color: isSelected ? "var(--green)" : "var(--muted)",
                  transition: "all 0.15s",
                }}>{d}/{m}</button>
              );
            })}
          </div>

          {movsFiltrados.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: 32, color: "var(--muted)", fontSize: 13 }}>
              {t.noMovementsAdd}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {movsPorFecha.map(({ fecha, movs }) => (
                <div key={fecha}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", marginBottom: 6, paddingLeft: 2, letterSpacing: 0.3 }}>
                    {fechaCorta(fecha)}
                  </div>
                  <div className="card" style={{ padding: 0, overflow: "hidden", background: "linear-gradient(135deg, var(--surface), var(--surface-alt))" }}>
                    {movs.map((m, i) => {
                      const isGasto = m.tipo === "Gasto" || m.tipo === "CompraUSD" || m.tipo === "CompraEUR";
                      const isMove = m.tipo === "Move";
                      return (
                        <button key={m.id} onClick={() => openEdit(m)} aria-label={t.edit} style={{
                          width: "100%", textAlign: "left", background: "none", cursor: "pointer",
                          display: "flex", alignItems: "flex-start", gap: 10, padding: "13px 14px",
                          border: "none", borderBottom: i < movs.length - 1 ? "1px solid var(--faint)" : "none",
                        }}>
                          <TipoDot tipo={m.tipo} categoria={m.categoria} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {m.descripcion || m.categoria}
                            </div>
                            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                              {m.categoria}{m.observaciones && <span style={{ fontStyle: "italic" }}> · {m.observaciones.toLowerCase()}</span>}
                            </div>
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 700, color: isGasto ? "var(--red)" : isMove ? "var(--yellow)" : "var(--green)", fontFamily: "var(--font-mono)", flexShrink: 0, marginTop: 1 }}>
                            {isGasto ? "-" : "+"}{money(m.monto)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>

    {/* Botón flotante — fijo sobre el navbar, se oculta tras inactividad */}
    {!loading && <button
      onClick={openAdd}
      aria-label={t.newMovement}
      style={{
        position: "fixed",
        bottom: "calc(var(--nav-h) + 8px)",
        left: 0, right: 0, margin: "0 auto",
        width: 54, height: 54,
        borderRadius: "50%",
        background: "transparent",
        color: "var(--green)",
        border: "none",
        cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 100,
        filter: "drop-shadow(0 2px 12px var(--green)99)",
        opacity: btnVisible ? 1 : 0,
        pointerEvents: btnVisible ? "all" : "none",
        transition: "opacity 0.4s ease",
      }}
    >
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
        <line x1="12" y1="5" x2="12" y2="19"/>
        <line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
    </button>}

    {/* ── MODAL ÚNICO — fuera del div animado para evitar stacking context ── */}
    <Modal open={modal !== null} onClose={closeModal} title={modalTitle}>

        {/* ADD */}
        {modal === "add" && (
          <form onSubmit={handleAdd}>
            <div style={{ marginBottom: 18 }}>
              <div className="label">{t.type}</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {(periodos.length === 0 ? TIPOS.filter(x => x.t === "Ingreso") : TIPOS).map(({ t, label, color }) => (
                  <button key={t} type="button" onClick={() => { setTipo(t); resetAdd(); if (periodos.length === 0) setCategoria("Sueldo"); }}
                    className="pill" style={{
                      borderColor: tipo === t ? color : "var(--border)",
                      background: tipo === t ? color + "22" : "transparent",
                      color: tipo === t ? color : "var(--muted)",
                    }}>{label}</button>
                ))}
              </div>
            </div>

            {esSueldo && (
              <div style={{ background: "var(--yellow-dim)", border: "1px solid var(--yellow)44", borderRadius: "var(--radius-sm)", padding: 12, marginBottom: 16, fontSize: 12, color: "var(--yellow)", lineHeight: 1.7 }}>
                {sinPeriodos ? t.salaryOpensFirstPeriod : t.salaryOpensPeriod}
              </div>
            )}
            {esMove && (
              <div style={{ background: "var(--yellow-dim)", border: "1px solid var(--yellow)44", borderRadius: "var(--radius-sm)", padding: 12, marginBottom: 16, fontSize: 12, color: "var(--yellow)" }}>
                {t.moveFromSavings}
                {periodoActual && <div style={{ color: "var(--muted)", marginTop: 4 }}>{t.savingsBalance(money(ahorrosAcumActivo))}</div>}
              </div>
            )}

            {!esMove && !esUSD && (
              <div style={{ marginBottom: 18 }}>
                <div className="label">{t.category}</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {categoriasFiltradas.map(c => (
                    <button key={c.nombre} type="button" onClick={() => setCategoria(c.nombre)}
                      className="pill" style={{
                        borderColor: categoria === c.nombre ? tipoColor : "var(--border)",
                        background: categoria === c.nombre ? tipoColor + "22" : "transparent",
                        color: categoria === c.nombre ? tipoColor : "var(--muted)",
                      }}>{c.nombre}</button>
                  ))}
                </div>
              </div>
            )}

            {esAhorros && (
              <div style={{ marginBottom: 18 }}>
                <div className="label">{t.origin}</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {config?.origenesAhorro.filter(o => o.activo).map(o => (
                    <button key={o.nombre} type="button" onClick={() => setOrigenAhorro(o.nombre)}
                      className="pill" style={{
                        borderColor: origenAhorro === o.nombre ? "var(--blue)" : "var(--border)",
                        background: origenAhorro === o.nombre ? "var(--blue-dim)" : "transparent",
                        color: origenAhorro === o.nombre ? "var(--blue)" : "var(--muted)",
                      }}>{o.nombre}</button>
                  ))}
                </div>
              </div>
            )}

            {esCompraFX && (
              <div style={{ marginBottom: 18 }}>
                <div className="label">{t.addTo}</div>
                <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
                  {([fxLabel, "ARS"] as const).map(mo => (
                    <button key={mo} type="button" onClick={() => setModoCarga(mo === "ARS" ? "ARS" : "USD")} className="pill" style={{
                      flex: 1,
                      borderColor: (mo === "ARS" ? modoCarga === "ARS" : modoCarga === "USD") ? "var(--yellow)" : "var(--border)",
                      background: (mo === "ARS" ? modoCarga === "ARS" : modoCarga === "USD") ? "var(--yellow-dim)" : "transparent",
                      color: (mo === "ARS" ? modoCarga === "ARS" : modoCarga === "USD") ? "var(--yellow)" : "var(--muted)",
                    }}>{mo}</button>
                  ))}
                </div>

                <div className="label">{t.exchangeRate}</div>
                <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
                  {cotizacion ? (["oficial", "blue"] as const).map(t => {
                    const val = esCompraEUR
                      ? (t === "oficial" ? cotizacion.oficial_euro : cotizacion.blue_euro) ?? cotizacion[t]
                      : cotizacion[t];
                    return (
                      <button key={t} type="button" onClick={() => setCotizManual(String(val))}
                        className="pill" style={{
                          borderColor: (cotizManual === String(val) || (!cotizManual && t === "oficial")) ? "var(--yellow)" : "var(--border)",
                          background: (cotizManual === String(val) || (!cotizManual && t === "oficial")) ? "var(--yellow-dim)" : "transparent",
                          color: (cotizManual === String(val) || (!cotizManual && t === "oficial")) ? "var(--yellow)" : "var(--muted)",
                        }}>{t} ${val.toLocaleString("es-AR")}</button>
                    );
                  }) : <span style={{ fontSize: 12, color: "var(--muted)" }}>{t.noExchangeRate}</span>}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                  <div>
                    <div className="label">{modoCarga === "USD" ? fxLabel : "ARS"}</div>
                    {modoCarga === "USD" ? (
                      <input className="input" type="number" value={cantidadUSD} onChange={e => setCantidadUSD(e.target.value)} placeholder="0" />
                    ) : (
                      <input className="input" type="number" value={montoARSInput} onChange={e => setMontoARSInput(e.target.value)} placeholder="0" />
                    )}
                  </div>
                  <div>
                    <div className="label">{t.exchangeRate}</div>
                    <input className="input" type="number" value={cotizManual || String(cotizacion?.oficial ?? "")} onChange={e => setCotizManual(e.target.value)} placeholder="0" />
                  </div>
                </div>

                <div className="label">{modoCarga === "USD" ? "Total ARS" : t.equalTo(fxLabel)}</div>
                <div style={{ padding: "12px 14px", background: "var(--yellow-dim)", border: "1px solid var(--yellow)33", borderRadius: "var(--radius-sm)", fontSize: 14, fontWeight: 700, color: "var(--yellow)", fontFamily: "var(--font-mono)", marginBottom: 10 }}>
                  {modoCarga === "USD"
                    ? (arsCompraUSD > 0 ? formatARS(arsCompraUSD) : "—")
                    : (usdFinal > 0 ? `${fxLabel} ${usdFinal.toFixed(2)}` : "—")}
                </div>
              </div>
            )}

            {esGastoFX && (
              <div style={{ marginBottom: 18 }}>
                <div className="label">{t.fxAmountSpent(fxLabel)}</div>
                <input className="input" type="number" value={cantidadUSD} onChange={e => setCantidadUSD(e.target.value)} placeholder="0" style={{ fontFamily: "var(--font-mono)" }} />
                {usdFinal > 0 && (
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 8 }}>
                    Total: {fxLabel} {usdFinal.toFixed(2)}
                  </div>
                )}
              </div>
            )}

            {!esMove && !esUSD && !esAhorros && !esSueldo && (
              <div style={{ marginBottom: 14 }}>
                <div className="label">{t.description}</div>
                <input className="input" type="text" value={descripcion} onChange={e => setDescripcion(e.target.value)} />
              </div>
            )}
            {!esUSD && (
              <div style={{ marginBottom: 14 }}>
                <div className="label">{t.amount}</div>
                <input className="input" style={{ fontFamily: "var(--font-mono)" }} type="number" value={monto} onChange={e => setMonto(e.target.value)} placeholder="0" />
              </div>
            )}
            <div style={{ marginBottom: 14 }}>
              <div className="label">{t.date}</div>
              <input className="input" type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
            </div>
            {!esMove && !esUSD && (
              <div style={{ marginBottom: 14 }}>
                <div className="label">{t.paymentMethod}</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {config?.mediosPago.filter(m => m.activo).map(m => (
                    <button key={m.nombre} type="button" onClick={() => setMedioPago(m.nombre)}
                      className="pill" style={{
                        borderColor: medioPago === m.nombre ? "var(--accent)" : "var(--border)",
                        background: medioPago === m.nombre ? "var(--accent-dim)" : "transparent",
                        color: medioPago === m.nombre ? "var(--accent)" : "var(--muted)",
                      }}>{m.nombre}</button>
                  ))}
                </div>
              </div>
            )}
            <div style={{ marginBottom: 20 }}>
              <div className="label">{t.notesOptional}</div>
              <input className="input" type="text" value={observaciones} onChange={e => setObservaciones(e.target.value)} />
            </div>

            {tipo === "Gasto" && config?.meta.autoAhorro?.activo && (config.meta.autoAhorro.monto ?? 0) > 0 &&
             (!config.meta.autoAhorro.mediosPago?.length || config.meta.autoAhorro.mediosPago.includes(medioPago)) && (
              <div style={{ background: "var(--blue-dim)", border: "1px solid var(--blue)33", borderRadius: "var(--radius-sm)", padding: "10px 14px", marginBottom: 16, fontSize: 12, color: "var(--blue)", display: "flex", alignItems: "center", gap: 8 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M12 5v14M5 12l7 7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                {money(config.meta.autoAhorro.monto)} {t.toSavings}
              </div>
            )}

            {addError && (
              <div style={{ background: "var(--red-dim)", border: "1px solid var(--red)44", borderRadius: "var(--radius-sm)", padding: 12, marginBottom: 14, fontSize: 12, color: "var(--red)" }}>
                {addError}
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "center", marginTop: 24 }}>
              <button type="submit" disabled={!canSubmit || addLoading} style={{
                width: 56, height: 56, borderRadius: "50%",
                background: canSubmit ? "var(--green)" : "transparent",
                border: `2px solid ${canSubmit ? "var(--green)" : "var(--border)"}`,
                color: canSubmit ? "var(--bg)" : "var(--border)",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: canSubmit ? "pointer" : "default",
                transition: "background 0.2s, border-color 0.2s, color 0.2s",
                boxShadow: canSubmit ? "0 4px 20px var(--green)55" : "none",
              }}>
                {addLoading
                  ? <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="spin"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" strokeDasharray="28 56" /></svg>
                  : <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                }
              </button>
            </div>
          </form>
        )}

        {/* EDIT */}
        {modal === "edit" && movSel && (
          <>
            <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
              {[{ l: t.type, v: movSel.tipo }, { l: t.category, v: movSel.categoria }, { l: t.date, v: fechaCorta(movSel.fecha) }].map(f => (
                <div key={f.l} style={{ background: "var(--surface-alt)", borderRadius: "var(--radius-sm)", padding: "6px 12px" }}>
                  <div style={{ fontSize: 9, color: "var(--muted)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 2 }}>{f.l}</div>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{f.v}</div>
                </div>
              ))}
            </div>

            {!isLocked && (
              <>
                <div style={{ marginBottom: 14 }}>
                  <div className="label">{t.description}</div>
                  <input className="input" value={eDesc} onChange={e => setEDesc(e.target.value)} />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <div className="label">{t.amount}</div>
                  <input className="input" style={{ fontFamily: "var(--font-mono)" }} type="number" value={eMonto} onChange={e => setEMonto(e.target.value)} />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <div className="label">{t.paymentMethod}</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {["Mercado Pago", "Débito", "Efectivo"].map(m => (
                      <button key={m} type="button" onClick={() => setEMedio(m)} className="pill" style={{
                        borderColor: eMedio === m ? "var(--accent)" : "var(--border)",
                        background: eMedio === m ? "var(--accent-dim)" : "transparent",
                        color: eMedio === m ? "var(--accent)" : "var(--muted)",
                      }}>{m}</button>
                    ))}
                  </div>
                </div>
              </>
            )}
            {isLocked && (
              <div style={{ marginBottom: 14 }}>
                <div className="label">{t.amount}</div>
                <input className="input" style={{ fontFamily: "var(--font-mono)" }} type="number" value={eMonto} onChange={e => setEMonto(e.target.value)} />
              </div>
            )}
            <div style={{ marginBottom: 24 }}>
              <div className="label">{t.notes}</div>
              <input className="input" value={eObs} onChange={e => setEObs(e.target.value)} />
            </div>

            <div style={{ position: "relative", display: "flex", justifyContent: "center", alignItems: "center", height: 56, marginTop: 8 }}>
              <button onClick={handleEdit} disabled={!isDirtyEdit || editLoading} aria-label={t.save} style={{
                width: 56, height: 56, borderRadius: "50%",
                background: isDirtyEdit ? "var(--green)" : "transparent",
                border: `2px solid ${isDirtyEdit ? "var(--green)" : "var(--border)"}`,
                color: isDirtyEdit ? "var(--bg)" : "var(--border)",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: isDirtyEdit ? "pointer" : "default",
                transition: "background 0.2s, border-color 0.2s, color 0.2s",
                boxShadow: isDirtyEdit ? "0 4px 20px var(--green)55" : "none",
                opacity: editLoading ? 0.5 : 1,
              }}>
                {editLoading
                  ? <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="spin"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" strokeDasharray="28 56" /></svg>
                  : <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                }
              </button>
              {!isLocked && (
                <button onClick={() => setModal("delete")} aria-label={t.delete} style={{ position: "absolute", right: 0, background: "none", border: "none", color: "var(--red)", cursor: "pointer", padding: 8 }}>
                  <TrashIcon />
                </button>
              )}
            </div>
          </>
        )}

        {/* DELETE */}
        {modal === "delete" && movSel && (
          <div style={{ textAlign: "center", paddingTop: 8 }}>
            <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 8 }}>{t.deleteMovementTitle}</div>
            <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>{movSel.descripcion || movSel.categoria}</div>
            <div style={{ fontSize: 18, color: "var(--red)", fontFamily: "var(--font-mono)", fontWeight: 700, marginBottom: 28 }}>
              {money(movSel.monto)}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setModal("edit")} className="btn btn-ghost" style={{ flex: 1 }}>{t.cancel}</button>
              <button onClick={handleDelete} disabled={editLoading} className="btn btn-danger" style={{ flex: 1 }}>
                {editLoading ? "..." : t.yesDelete}
              </button>
            </div>
          </div>
        )}

    </Modal>
    </>
  );
}
