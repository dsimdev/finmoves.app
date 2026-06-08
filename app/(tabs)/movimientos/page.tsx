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
import { LoadingSpinner } from "@/components/LoadingSpinner";

// ── Íconos ────────────────────────────────────────────────────────────────────
const PencilIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
    <path d="M4 20h4L18.5 9.5a2.12 2.12 0 0 0-3-3L5 17v3Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    <path d="M13.5 6.5l3 3" stroke="currentColor" strokeWidth="1.7" />
  </svg>
);
const SaveIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
    <path d="M5 3h11l3 3v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    <path d="M8 3v5h6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    <rect x="7.5" y="13" width="9" height="6" rx="1" stroke="currentColor" strokeWidth="1.7" />
  </svg>
);
const TrashIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);
const EyeIcon = ({ off }: { off: boolean }) => (
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
              background: "var(--surface-alt)", border: "none", color: "var(--muted)",
              width: 32, height: 32, borderRadius: "50%", fontSize: 18, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1,
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
  const { monedaInversiones } = useAppPrefs();
  const esEURMode = monedaInversiones === "EUR";

  const TIPOS: { t: TipoMovimiento; label: string; color: string }[] = [
    { t: "Gasto",                             label: "Gasto",   color: "var(--red)" },
    { t: "Ingreso",                           label: "Ingreso", color: "var(--green)" },
    { t: "Move",                              label: "Move",    color: "var(--yellow)" },
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

  const ultimoCargado = useMemo(() => {
    if (movimientos.length === 0) return null;
    return movimientos.reduce((a, b) => {
      const ta = new Date(a.timestampCarga).getTime();
      const tb = new Date(b.timestampCarga).getTime();
      return ta > tb ? a : b;
    }).timestampCarga;
  }, [movimientos]);

  // ── Modal: "add" | "edit" | "delete" | null
  const [modal, setModal] = useState<"add" | "edit" | "delete" | null>(null);
  const [movSel, setMovSel] = useState<Movimiento | null>(null);

  // ── Add state ──────────────────────────────────────────────────────────────
  const [tipo, setTipo] = useState<TipoMovimiento>("Gasto");
  const [categoria, setCategoria] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [monto, setMonto] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
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
    ? [{ id: "sueldo", nombre: "Sueldo", tipo: "Ingreso" as const, activa: true },
       { id: "ahorros", nombre: "Ahorros", tipo: "Ingreso" as const, activa: true }]
    : [];

  const cotizActual = cotizManual ? parseFloat(cotizManual) : cotizacion?.blue ?? 0;
  // GastoFX: sólo divisa, no ARS. CompraFX: bidireccional divisa↔ARS
  const usdFinal = !esUSD ? 0 : esGastoFX
    ? parseFloat(cantidadUSD || "0")
    : modoCarga === "USD"
    ? parseFloat(cantidadUSD || "0")
    : (cotizActual ? parseFloat(montoARSInput || "0") / cotizActual : 0);
  const arsCompraUSD = !esCompraFX ? 0 : modoCarga === "USD"
    ? parseFloat(cantidadUSD || "0") * cotizActual
    : parseFloat(montoARSInput || "0");

  const movsFiltrados = useMemo(() =>
    [...(periodoActual?.movimientos ?? [])].sort((a, b) => b.timestampCarga.getTime() - a.timestampCarga.getTime()),
    [periodoActual]
  );

  const resetAdd = () => {
    setDescripcion(""); setMonto(""); setCategoria(""); setOrigenAhorro("");
    setCantidadUSD(""); setCotizManual(""); setObservaciones(""); setAddError("");
    setMontoARSInput(""); setModoCarga("USD");
    setFecha(new Date().toISOString().split("T")[0]);
  };

  const openAdd = () => { resetAdd(); setTipo("Gasto"); setModal("add"); };

  const openEdit = (m: Movimiento) => {
    setMovSel(m);
    setEMonto(String(m.monto));
    setEDesc(m.descripcion ?? "");
    setEMedio(m.medioPago ?? "");
    setEObs(m.observaciones ?? "");
    setModal("edit");
  };

  const closeModal = () => { setModal(null); setMovSel(null); };

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError("");
    setAddLoading(true);
    try {
      if (!user?.uid) throw new Error("No autenticado");
      if (!esMove && !esUSD && !categoria) throw new Error("Seleccioná una categoría");
      const montoFinal = esCompraFX ? arsCompraUSD : esGastoFX ? 0 : parseFloat(monto);
      if (!esGastoFX && (!montoFinal || montoFinal <= 0)) throw new Error("Monto inválido");
      if (esUSD && (!usdFinal || usdFinal <= 0)) throw new Error(`Cantidad ${fxLabel} inválida`);
      if (!periodoActual) throw new Error("No hay período activo");
      await crearMovimiento(user.uid, {
        timestampCarga: new Date(), fecha, tipo,
        categoria: esMove ? "Move" : esCompraFX ? tipo : esGastoFX ? tipo : categoria,
        descripcion: esMove ? "Move a disponible" : esCompraFX ? `Compra ${fxLabel}` : esGastoFX ? `Gasto ${fxLabel}` : descripcion.trim(),
        monto: montoFinal,
        medioPago: esMove || esCompraFX ? "Mercado Pago" : esGastoFX ? "—" : medioPago,
        observaciones, periodoId: periodoActual.periodoId, userId: user.uid,
        ...(esAhorros && origenAhorro ? { origenAhorro } : {}),
        ...(esCompraFX ? { cantidadUSD: usdFinal, cotizacion: cotizActual } : {}),
        ...(esGastoFX ? { cantidadUSD: usdFinal } : {}),
      });
      resetAdd(); closeModal(); refresh();
    } catch (err: unknown) {
      setAddError(err instanceof Error ? err.message : "Error inesperado");
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
  const modalTitle = modal === "add" ? "Nuevo movimiento" : modal === "delete" ? "Eliminar" : "Editar movimiento";

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
    <div className="page fade-up">

      <div style={{ marginBottom: 20 }}>
        <div className="label" style={{ marginBottom: 2 }}>Gestión</div>
        <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.5, display: "inline-block", background: "linear-gradient(110deg, var(--blue) 10%, var(--green) 90%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>Movimientos</div>
        {ultimoCargado && (
          <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>
            Último: {new Date(ultimoCargado).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/Buenos_Aires" })}
          </div>
        )}
        {periodoActual && (
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
            Disponible: <span style={{ color: "var(--green)", fontFamily: "var(--font-mono)" }}>{money(periodoActual.disponible)}</span>
            <button onClick={toggle} aria-label="Ocultar valores" style={{
              background: "transparent", border: "none", color: oculto ? "var(--accent)" : "var(--muted)",
              width: 20, height: 20, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0,
            }}>
              <EyeIcon off={oculto} />
            </button>
          </div>
        )}
      </div>

      {/* Períodos */}
      {/* Pills año */}
      <div style={{ display: "flex", gap: 4, marginBottom: 8, overflowX: "auto", scrollbarWidth: "none" }}>
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
      {/* Pills período */}
      <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 16, paddingBottom: 2, scrollbarWidth: "none" }}>
        {periodosDelAño.map(p => {
          const isSelected = activePeriodoId === p.periodoId;
          const [d, m] = p.periodoId.split("/");
          return (
            <button key={p.periodoId} onClick={() => setPeriodoSel(p.periodoId)} style={{
              flexShrink: 0, padding: "5px 12px", borderRadius: 999, fontSize: 11, fontWeight: 600, cursor: "pointer",
              border: `1px solid ${isSelected ? "var(--green)" : "var(--border)"}`,
              background: isSelected ? "var(--green-dim)" : "transparent",
              color: isSelected ? "var(--green)" : "var(--muted)",
              transition: "all 0.15s",
            }}>{d}/{m}</button>
          );
        })}
      </div>

      {/* Lista */}
      {loading ? (
        <LoadingSpinner />
      ) : movsFiltrados.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 32, color: "var(--muted)", fontSize: 13 }}>
          No hay movimientos. Usá + para agregar.
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {movsFiltrados.map((m, i) => {
            const isGasto = m.tipo === "Gasto" || m.tipo === "CompraUSD" || m.tipo === "CompraEUR";
            return (
              <div key={m.id} style={{
                display: "flex", alignItems: "flex-start", gap: 10, padding: "13px 14px",
                borderBottom: i < movsFiltrados.length - 1 ? "1px solid var(--faint)" : "none",
              }}>
                <TipoDot tipo={m.tipo} categoria={m.categoria} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {m.descripcion || m.categoria}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                    {m.categoria} · {fechaCorta(m.fecha)}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: isGasto ? "var(--red)" : "var(--green)", fontFamily: "var(--font-mono)" }}>
                    {isGasto ? "-" : "+"}{money(m.monto)}
                  </span>
                  <button onClick={() => openEdit(m)} aria-label="Editar" style={{
                    background: "var(--surface-alt)", border: "1px solid var(--border)",
                    color: "var(--muted)", borderRadius: 9, width: 30, height: 30, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}><PencilIcon /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>

    {/* Botón flotante — fijo sobre el navbar, se oculta tras inactividad */}
    <button
      onClick={openAdd}
      aria-label="Nuevo movimiento"
      style={{
        position: "fixed",
        bottom: "calc(var(--nav-h) - 8px)",
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
    </button>

    {/* ── MODAL ÚNICO — fuera del div animado para evitar stacking context ── */}
    <Modal open={modal !== null} onClose={closeModal} title={modalTitle}>

        {/* ADD */}
        {modal === "add" && (
          <form onSubmit={handleAdd}>
            <div style={{ marginBottom: 18 }}>
              <div className="label">Tipo</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {TIPOS.map(({ t, label, color }) => (
                  <button key={t} type="button" onClick={() => { setTipo(t); resetAdd(); }}
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
                Cierra el período actual, mueve el resto a Ahorros y abre uno nuevo.
              </div>
            )}
            {esMove && (
              <div style={{ background: "var(--yellow-dim)", border: "1px solid var(--yellow)44", borderRadius: "var(--radius-sm)", padding: 12, marginBottom: 16, fontSize: 12, color: "var(--yellow)" }}>
                Mueve saldo de Ahorros → Disponible
                {periodoActual && <div style={{ color: "var(--muted)", marginTop: 4 }}>Ahorros: {money(ahorrosAcumActivo)}</div>}
              </div>
            )}

            {!esMove && !esUSD && (
              <div style={{ marginBottom: 18 }}>
                <div className="label">Categoría</div>
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
                <div className="label">Origen</div>
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
                <div className="label">Ingresar en</div>
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

                <div className="label">Cotización</div>
                <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
                  {cotizacion ? (["blue", "oficial"] as const).map(t => {
                    const val = esCompraEUR
                      ? (t === "oficial" ? cotizacion.oficial_euro : cotizacion.blue_euro) ?? cotizacion[t]
                      : cotizacion[t];
                    return (
                      <button key={t} type="button" onClick={() => setCotizManual(String(val))}
                        className="pill" style={{
                          borderColor: (cotizManual === String(val) || (!cotizManual && t === "blue")) ? "var(--yellow)" : "var(--border)",
                          background: (cotizManual === String(val) || (!cotizManual && t === "blue")) ? "var(--yellow-dim)" : "transparent",
                          color: (cotizManual === String(val) || (!cotizManual && t === "blue")) ? "var(--yellow)" : "var(--muted)",
                        }}>{t} ${val.toLocaleString("es-AR")}</button>
                    );
                  }) : <span style={{ fontSize: 12, color: "var(--muted)" }}>Sin cotización</span>}
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
                    <div className="label">Cotización</div>
                    <input className="input" type="number" value={cotizManual || String(cotizacion?.blue ?? "")} onChange={e => setCotizManual(e.target.value)} placeholder="0" />
                  </div>
                </div>

                <div className="label">{modoCarga === "USD" ? "Total ARS" : `Equivale a ${fxLabel}`}</div>
                <div style={{ padding: "12px 14px", background: "var(--yellow-dim)", border: "1px solid var(--yellow)33", borderRadius: "var(--radius-sm)", fontSize: 14, fontWeight: 700, color: "var(--yellow)", fontFamily: "var(--font-mono)", marginBottom: 10 }}>
                  {modoCarga === "USD"
                    ? (arsCompraUSD > 0 ? formatARS(arsCompraUSD) : "—")
                    : (usdFinal > 0 ? `${fxLabel} ${usdFinal.toFixed(2)}` : "—")}
                </div>
              </div>
            )}

            {esGastoFX && (
              <div style={{ marginBottom: 18 }}>
                <div className="label">Cantidad {fxLabel} gastada</div>
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
                <div className="label">Descripción</div>
                <input className="input" type="text" value={descripcion} onChange={e => setDescripcion(e.target.value)} />
              </div>
            )}
            {!esUSD && (
              <div style={{ marginBottom: 14 }}>
                <div className="label">Monto</div>
                <input className="input" style={{ fontFamily: "var(--font-mono)" }} type="number" value={monto} onChange={e => setMonto(e.target.value)} placeholder="0" />
              </div>
            )}
            <div style={{ marginBottom: 14 }}>
              <div className="label">Fecha</div>
              <input className="input" type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
            </div>
            {!esMove && !esUSD && (
              <div style={{ marginBottom: 14 }}>
                <div className="label">Medio de pago</div>
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
              <div className="label">Observaciones (opcional)</div>
              <input className="input" type="text" value={observaciones} onChange={e => setObservaciones(e.target.value)} />
            </div>

            {addError && (
              <div style={{ background: "var(--red-dim)", border: "1px solid var(--red)44", borderRadius: "var(--radius-sm)", padding: 12, marginBottom: 14, fontSize: 12, color: "var(--red)" }}>
                {addError}
              </div>
            )}
            <button type="submit" disabled={addLoading} className="btn" style={{ width: "100%", background: "var(--green)", color: "var(--bg)" }}>
              {addLoading ? "Guardando..." : "Confirmar"}
            </button>
          </form>
        )}

        {/* EDIT */}
        {modal === "edit" && movSel && (
          <>
            <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
              {[{ l: "Tipo", v: movSel.tipo }, { l: "Categoría", v: movSel.categoria }, { l: "Fecha", v: fechaCorta(movSel.fecha) }].map(f => (
                <div key={f.l} style={{ background: "var(--surface-alt)", borderRadius: "var(--radius-sm)", padding: "6px 12px" }}>
                  <div style={{ fontSize: 9, color: "var(--muted)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 2 }}>{f.l}</div>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{f.v}</div>
                </div>
              ))}
            </div>

            <div style={{ marginBottom: 14 }}>
              <div className="label">Monto</div>
              <input className="input" style={{ fontFamily: "var(--font-mono)" }} type="number" value={eMonto} onChange={e => setEMonto(e.target.value)} />
            </div>
            {!isLocked && (
              <>
                <div style={{ marginBottom: 14 }}>
                  <div className="label">Descripción</div>
                  <input className="input" value={eDesc} onChange={e => setEDesc(e.target.value)} />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <div className="label">Medio de pago</div>
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
            <div style={{ marginBottom: 24 }}>
              <div className="label">Observaciones</div>
              <input className="input" value={eObs} onChange={e => setEObs(e.target.value)} />
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={handleEdit} disabled={editLoading} aria-label="Guardar" className="btn" style={{ flex: 1, background: "var(--green)", color: "var(--bg)" }}>
                {editLoading ? "..." : <SaveIcon />}
              </button>
              {!isLocked && (
                <button onClick={() => setModal("delete")} aria-label="Eliminar" className="btn" style={{ flex: 1, background: "transparent", border: "1px solid var(--red)", color: "var(--red)" }}>
                  <TrashIcon />
                </button>
              )}
            </div>
          </>
        )}

        {/* DELETE */}
        {modal === "delete" && movSel && (
          <div style={{ textAlign: "center", paddingTop: 8 }}>
            <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 8 }}>¿Eliminar este movimiento?</div>
            <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>{movSel.descripcion || movSel.categoria}</div>
            <div style={{ fontSize: 18, color: "var(--red)", fontFamily: "var(--font-mono)", fontWeight: 700, marginBottom: 28 }}>
              {money(movSel.monto)}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setModal("edit")} className="btn btn-ghost" style={{ flex: 1 }}>Cancelar</button>
              <button onClick={handleDelete} disabled={editLoading} className="btn btn-danger" style={{ flex: 1 }}>
                {editLoading ? "..." : "Sí, eliminar"}
              </button>
            </div>
          </div>
        )}

    </Modal>
    </>
  );
}
