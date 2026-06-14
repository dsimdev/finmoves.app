"use client";

import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useCotizacion } from "@/hooks/useCotizacion";
import { useAppPrefs } from "@/hooks/useAppPrefs";
import { useMoney } from "@/hooks/useHideValues";
import { useT } from "@/hooks/useTranslation";
import { crearMovimiento, actualizarMovimiento, eliminarMovimiento } from "@/services/firebase/movimientos";
import { uploadComprobante, deleteComprobante } from "@/lib/storage";
import { MediaViewer } from "@/components/ui/MediaViewer";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { agruparPorPeriodo, formatARS, fechaCorta } from "@/utils/periodo";
import { serieTendencia } from "@/utils/reportes";
import { Movimiento, TipoMovimiento, ConfigUsuario } from "@/types";

// Bottom-sheet genérico.
function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, pointerEvents: open ? "all" : "none" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.75)", opacity: open ? 1 : 0, transition: "opacity 0.2s" }} />
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, background: "var(--bg)", borderRadius: "20px 20px 0 0", maxHeight: "92dvh", overflowY: "auto", transform: open ? "translateY(0)" : "translateY(100%)", transition: "transform 0.32s cubic-bezier(0.32,0.72,0,1)" }}>
        <div style={{ padding: "12px 16px 0", position: "sticky", top: 0, background: "var(--bg)", zIndex: 1 }}>
          <div style={{ width: 36, height: 4, background: "var(--border)", borderRadius: 2, margin: "0 auto 14px" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <span style={{ fontSize: 16, fontWeight: 700 }}>{title}</span>
            <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--red)", fontSize: 22, cursor: "pointer", lineHeight: 1, padding: 4 }}>×</button>
          </div>
        </div>
        <div style={{ padding: "0 16px 40px" }}>{children}</div>
      </div>
    </div>
  );
}

const hoyISO = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

interface MovementModalProps {
  open: boolean;
  mode: "add" | "edit";
  movimiento?: Movimiento | null;
  /** Movimientos del usuario (para derivar períodos/serie). */
  movimientos: Movimiento[];
  /** Config del usuario (provista por el padre desde DataProvider, sin re-leer). */
  config: ConfigUsuario | null;
  /** Período al que se carga el alta. Por defecto, el más reciente. */
  activePeriodoId?: string;
  /** Vista inicial en edición: "delete" abre directo la confirmación de borrado (long-press). */
  initialView?: "form" | "delete";
  /** Modo reserva (abierto desde Inversión): solo carga +Reserva / -Reserva (FX). */
  reserveMode?: boolean;
  /** Solo lectura (detalle desde el historial de Inversión): muestra el detalle sin editar. */
  readOnly?: boolean;
  onClose: () => void;
  /** Avisar al padre para que refresque sus datos tras alta/edición/borrado. */
  onChanged: () => void;
}

// Modal de alta/edición/borrado de movimientos, reutilizable (Movimientos, Inicio).
export function MovementModal({ open, mode, movimiento, movimientos, config, activePeriodoId, initialView, reserveMode, readOnly, onClose, onChanged }: MovementModalProps) {
  const { user } = useAuth();
  const { cotizacion } = useCotizacion();
  const { monedaInversiones, monedaPrincipal } = useAppPrefs();
  const { m: money } = useMoney();
  const t = useT();

  const monedaInversionesEfectiva: "USD" | "EUR" =
    monedaPrincipal === "USD" ? "EUR" : monedaPrincipal === "EUR" ? "USD" : monedaInversiones;
  const esEURMode = monedaInversionesEfectiva === "EUR";

  // En modo reserva (desde Inversión) solo se cargan +Reserva / -Reserva (FX).
  // En modo normal, las cargas a la reserva ya no se ofrecen acá.
  const TIPOS: { t: TipoMovimiento; label: string; color: string }[] = reserveMode ? [
    { t: (esEURMode ? "CompraEUR" : "CompraUSD") as TipoMovimiento, label: t.addReserve, color: "var(--green)" },
    { t: (esEURMode ? "GastoEUR" : "GastoUSD") as TipoMovimiento, label: t.removeReserve, color: "var(--red)" },
  ] : [
    { t: "Gasto", label: t.tipoDisplay["Gasto"], color: "var(--red)" },
    { t: "Ingreso", label: t.tipoDisplay["Ingreso"], color: "var(--green)" },
    { t: "Move", label: t.tipoDisplay["Move"], color: "var(--yellow)" },
  ];

  const periodos = useMemo(() => agruparPorPeriodo(movimientos), [movimientos]);
  const activeId = activePeriodoId ?? periodos[0]?.periodoId;
  const periodoActual = periodos.find((p) => p.periodoId === activeId);
  const serie = useMemo(() => serieTendencia(periodos, config?.meta.ahorrosAcumSeedPeriodoId), [periodos, config?.meta.ahorrosAcumSeedPeriodoId]);
  const ahorrosAcumActivo = serie.find((s) => s.periodoId === activeId)?.ahorrosAcum ?? 0;
  const sinPeriodos = periodos.length === 0;

  // "form" = alta o edición; "delete" = confirmación de borrado (sub-vista de edición).
  const [view, setView] = useState<"form" | "delete">("form");

  // ── Add state ──
  const [tipo, setTipo] = useState<TipoMovimiento>("Gasto");
  const [categoria, setCategoria] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [monto, setMonto] = useState("");
  const [fecha, setFecha] = useState(hoyISO);
  const [medioPago, setMedioPago] = useState("Mercado Pago");
  const [observaciones, setObservaciones] = useState("");
  const [origenAhorro, setOrigenAhorro] = useState("");
  const [cantidadUSD, setCantidadUSD] = useState("");
  const [montoARSInput, setMontoARSInput] = useState("");
  const [modoCarga, setModoCarga] = useState<"USD" | "ARS">("USD");
  const [cotizManual, setCotizManual] = useState("");
  const [abreNuevoPeriodo, setAbreNuevoPeriodo] = useState(false);
  const [moveDir, setMoveDir] = useState<"aDisponible" | "aAhorro">("aDisponible");
  // Comprobante adjunto (alta y edición).
  const [comprobanteFile, setComprobanteFile] = useState<File | null>(null);
  const [comprobantePreview, setComprobantePreview] = useState<string | null>(null);
  const [comprobanteRemoved, setComprobanteRemoved] = useState(false);
  const [viewer, setViewer] = useState<{ src: string; isPdf: boolean } | null>(null);
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState("");

  // ── Edit state ──
  const [eMonto, setEMonto] = useState("");
  const [eDesc, setEDesc] = useState("");
  const [eMedio, setEMedio] = useState("");
  const [eObs, setEObs] = useState("");
  const [editLoading, setEditLoading] = useState(false);

  const resetComprobante = () => {
    setComprobantePreview((p) => { if (p) URL.revokeObjectURL(p); return null; });
    setComprobanteFile(null); setComprobanteRemoved(false);
  };

  const resetAdd = () => {
    setDescripcion(""); setMonto(""); setCategoria(""); setOrigenAhorro("");
    setCantidadUSD(""); setCotizManual(""); setObservaciones(""); setAddError("");
    setMontoARSInput(""); setModoCarga("USD"); setFecha(hoyISO()); setAbreNuevoPeriodo(false); setMoveDir("aDisponible");
    resetComprobante();
  };

  const onComprobanteSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (comprobantePreview) URL.revokeObjectURL(comprobantePreview);
    setComprobanteFile(f);
    setComprobantePreview(URL.createObjectURL(f));
    setComprobanteRemoved(false);
  };

  const clearComprobante = () => {
    if (comprobantePreview) URL.revokeObjectURL(comprobantePreview);
    setComprobanteFile(null); setComprobantePreview(null); setComprobanteRemoved(true);
  };

  // Inicializar al abrir según el modo.
  useEffect(() => {
    if (!open) return;
    if (mode === "add") {
      setView("form");
      resetAdd();
      if (reserveMode) setTipo(esEURMode ? "CompraEUR" : "CompraUSD");
      else if (sinPeriodos) { setTipo("Ingreso"); setCategoria("Sueldo"); }
      else setTipo("Gasto");
    } else if (mode === "edit" && movimiento) {
      // El sueldo que abre período (ancla) no se puede borrar → forzar vista form.
      const esAncla = movimiento.tipo === "Ingreso" && movimiento.categoria === "Sueldo" &&
        fechaAPeriodoId(movimiento.fecha) === movimiento.periodoId;
      setView(initialView === "delete" && !esAncla ? "delete" : "form");
      setEMonto(String(movimiento.monto));
      setEDesc(movimiento.descripcion || (movimiento as Movimiento & { origenAhorro?: string }).origenAhorro || "");
      setEMedio(movimiento.medioPago ?? "");
      setEObs(movimiento.observaciones ?? "");
      resetComprobante();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, movimiento?.id, initialView]);

  const esSueldo = tipo === "Ingreso" && categoria === "Sueldo";
  const esAhorros = tipo === "Ingreso" && categoria === "Ahorros";
  const esMove = tipo === "Move";
  const esCompraUSD = tipo === "CompraUSD";
  const esGastoUSD = tipo === "GastoUSD";
  const esCompraEUR = tipo === "CompraEUR";
  const esGastoEUR = tipo === "GastoEUR";
  const esCompraFX = esCompraUSD || esCompraEUR;
  const esGastoFX = esGastoUSD || esGastoEUR;
  const esUSD = esCompraFX || esGastoFX;
  const fxLabel = esCompraEUR || esGastoEUR ? "EUR" : "USD";
  const tipoColor = TIPOS.find((tx) => tx.t === tipo)?.color ?? "var(--accent)";

  const categoriasFiltradas = tipo === "Gasto"
    ? (config?.categorias.filter((c) => c.tipo === "Gasto" && c.activa) ?? [])
    : tipo === "Ingreso"
    ? (sinPeriodos
       ? [{ id: "sueldo", nombre: "Sueldo", tipo: "Ingreso" as const, activa: true }]
       : [{ id: "sueldo", nombre: "Sueldo", tipo: "Ingreso" as const, activa: true },
          { id: "ahorros", nombre: "Ahorros", tipo: "Ingreso" as const, activa: true }])
    : [];

  const cotizActual = cotizManual ? parseFloat(cotizManual) : cotizacion?.oficial ?? 0;
  const usdFinal = !esUSD ? 0 : esGastoFX
    ? parseFloat(cantidadUSD || "0")
    : modoCarga === "USD"
    ? parseFloat(cantidadUSD || "0")
    : (cotizActual ? parseFloat(montoARSInput || "0") / cotizActual : 0);
  const arsCompraUSD = !esCompraFX ? 0 : modoCarga === "USD"
    ? parseFloat(cantidadUSD || "0") * cotizActual
    : parseFloat(montoARSInput || "0");

  const fechaAPeriodoId = (f: string) => {
    const [y, m, d] = f.split("-");
    return d && m && y ? `${parseInt(d)}/${parseInt(m)}/${y}` : f;
  };

  // El dueño cobra sueldo mensual: su sueldo SIEMPRE abre período (sin elección),
  // igual que el primer sueldo. El resto de los usuarios eligen con el toggle.
  const isOwner = !!user?.email && user.email === process.env.NEXT_PUBLIC_OWNER_EMAIL;
  const forzarNuevoPeriodo = esSueldo && (sinPeriodos || isOwner);
  const abrePeriodo = esSueldo && (forzarNuevoPeriodo || abreNuevoPeriodo);

  const canSubmit = (!!periodoActual || abrePeriodo) && (
    esGastoFX ? usdFinal > 0 :
    esCompraFX ? usdFinal > 0 && arsCompraUSD > 0 :
    esMove ? true :
    !!categoria && parseFloat(monto || "0") > 0
  );

  // Un sueldo que ABRE período (su fecha define el periodoId) es el ancla → no se puede
  // borrar (se chequea en el efecto de apertura). Un sueldo "sumado" al período sí.
  const isLocked = movimiento ? movimiento.tipo === "Ingreso" && movimiento.categoria === "Sueldo" : false;
  // Movimiento de reserva (FX): muestra cantidad + cotización en el detalle.
  const esFXMov = !!movimiento && ["CompraUSD", "GastoUSD", "CompraEUR", "GastoEUR"].includes(movimiento.tipo);
  const fxMovLabel = movimiento && (movimiento.tipo === "CompraEUR" || movimiento.tipo === "GastoEUR") ? "EUR" : "USD";
  // Quién puede adjuntar comprobantes. Hoy solo el dueño; a futuro: isOwner || isPremium.
  const canComprobante = isOwner;

  // Sugerencias de descripción para Gasto: descripciones ya usadas (filtradas por
  // la categoría elegida si hay una), ordenadas por frecuencia. Autocompletado nativo.
  const descSuggestions = useMemo(() => {
    if (tipo !== "Gasto") return [] as string[];
    const counts = new Map<string, number>();
    for (const m of movimientos) {
      if (m.tipo === "Gasto" && m.descripcion && (!categoria || m.categoria === categoria)) {
        counts.set(m.descripcion, (counts.get(m.descripcion) ?? 0) + 1);
      }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([d]) => d).slice(0, 8);
  }, [movimientos, categoria, tipo]);
  const isDirtyEdit = !!movimiento && (
    eMonto !== String(movimiento.monto) ||
    eDesc !== (movimiento.descripcion ?? "") ||
    eMedio !== (movimiento.medioPago ?? "") ||
    eObs !== (movimiento.observaciones ?? "") ||
    !!comprobanteFile || comprobanteRemoved
  );

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
      const periodoIdFinal = abrePeriodo ? fechaAPeriodoId(fecha) : (periodoActual?.periodoId ?? null);
      if (!periodoIdFinal) throw new Error(t.errNoActivePeriod);
      let comprobante: { url: string; path: string } | null = null;
      if (canComprobante && comprobanteFile) comprobante = await uploadComprobante(user.uid, comprobanteFile);
      await crearMovimiento(user.uid, {
        timestampCarga: new Date(), fecha, tipo,
        categoria: esMove ? "Move" : esCompraFX ? tipo : esGastoFX ? tipo : categoria,
        descripcion: esMove ? (moveDir === "aAhorro" ? "Move a ahorros" : "Move a disponible") : esCompraFX ? `Compra ${fxLabel}` : esGastoFX ? `Gasto ${fxLabel}` : esAhorros ? (origenAhorro || descripcion.trim()) : descripcion.trim(),
        monto: montoFinal,
        medioPago: esMove || esCompraFX ? "Mercado Pago" : esGastoFX ? "—" : medioPago,
        observaciones, periodoId: periodoIdFinal, userId: user.uid,
        ...(esMove ? { direccionMove: moveDir } : {}),
        ...(comprobante ? { comprobanteUrl: comprobante.url, comprobantePath: comprobante.path } : {}),
        ...(esAhorros && origenAhorro ? { origenAhorro } : {}),
        ...(esCompraFX ? { cantidadUSD: usdFinal, cotizacion: cotizActual } : {}),
        ...(esGastoFX ? { cantidadUSD: usdFinal } : {}),
      });
      // Cierre del período anterior: si este sueldo abre uno nuevo, el disponible
      // que sobró se traslada como RESTO (= ahorro) al período nuevo.
      if (abrePeriodo && !sinPeriodos && periodoActual && periodoActual.disponible > 0) {
        await crearMovimiento(user.uid, {
          timestampCarga: new Date(), fecha, tipo: "Ingreso",
          categoria: "RESTO", descripcion: "Resto período anterior",
          monto: periodoActual.disponible,
          medioPago: "—", observaciones: `de ${periodoActual.periodoId}`,
          periodoId: periodoIdFinal, userId: user.uid,
        });
      }
      const autoAhorroMedios = config?.meta.autoAhorro?.mediosPago;
      const autoAhorroOmitir = config?.meta.autoAhorro?.omitirDescripciones ?? [];
      if (tipo === "Gasto" && config?.meta.autoAhorro?.activo && (config.meta.autoAhorro.monto ?? 0) > 0 &&
          (!autoAhorroMedios?.length || autoAhorroMedios.includes(medioPago)) &&
          !autoAhorroOmitir.some((d) => d.toLowerCase() === descripcion.trim().toLowerCase())) {
        await crearMovimiento(user.uid, {
          timestampCarga: new Date(), fecha, tipo: "Ingreso",
          categoria: "Ahorros", descripcion: "Auto-ahorro",
          monto: config.meta.autoAhorro.monto,
          medioPago: "—", observaciones: "por gasto",
          periodoId: periodoIdFinal, userId: user.uid,
        });
      }
      resetAdd(); onChanged(); onClose();
    } catch (err: unknown) {
      setAddError(err instanceof Error ? err.message : t.unexpectedError);
    } finally {
      setAddLoading(false);
    }
  };

  const handleEdit = async () => {
    if (!user?.uid || !movimiento) return;
    setEditLoading(true);
    try {
      const update: Partial<Movimiento> = { monto: parseFloat(eMonto), observaciones: eObs, descripcion: eDesc.trim() };
      if (!isLocked) update.medioPago = eMedio;
      if (canComprobante) {
        if (comprobanteFile) {
          const up = await uploadComprobante(user.uid, comprobanteFile);
          update.comprobanteUrl = up.url; update.comprobantePath = up.path;
          await deleteComprobante(movimiento.comprobantePath); // borrar el anterior
        } else if (comprobanteRemoved && movimiento.comprobanteUrl) {
          update.comprobanteUrl = ""; update.comprobantePath = "";
          await deleteComprobante(movimiento.comprobantePath);
        }
      }
      await actualizarMovimiento(user.uid, movimiento.id, update);
      onChanged(); onClose();
    } catch (err) { console.error(err); }
    finally { setEditLoading(false); }
  };

  const handleDelete = async () => {
    if (!user?.uid || !movimiento) return;
    setEditLoading(true);
    try {
      await eliminarMovimiento(user.uid, movimiento.id);
      await deleteComprobante(movimiento.comprobantePath); // borrar el comprobante asociado
      onChanged(); onClose();
    } catch (err) { console.error(err); }
    finally { setEditLoading(false); }
  };

  const title = mode === "add" ? (reserveMode ? t.reserve : t.newMovement) : readOnly ? t.detail : view === "delete" ? t.delete : t.editMovement;

  // Versión compacta (ícono) del comprobante — va al lado del medio de pago (alta)
  // o de observaciones (edición). `existingUrl` = comprobante ya guardado (edición).
  const comprobanteIcon = (existingUrl?: string) => {
    const accept = "image/*,application/pdf";
    const box: React.CSSProperties = { width: 38, height: 38, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0, textDecoration: "none", border: "1px solid var(--border)", background: "var(--surface-alt)", color: "var(--muted)" };
    const thumbImg: React.CSSProperties = { width: 38, height: 38, borderRadius: 8, objectFit: "cover", border: "1px solid var(--border)", display: "block" };
    const removeBtn: React.CSSProperties = { position: "absolute", top: -6, right: -6, width: 18, height: 18, borderRadius: "50%", background: "var(--red)", color: "#fff", border: "1.5px solid var(--bg)", cursor: "pointer", fontSize: 11, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" };
    const newIsPdf = comprobanteFile?.type === "application/pdf";
    const existingIsPdf = !!movimiento?.comprobantePath && movimiento.comprobantePath.toLowerCase().endsWith(".pdf");
    const showExisting = !!existingUrl && !comprobanteRemoved && !comprobantePreview;
    if (comprobantePreview) {
      return (
        <div style={{ position: "relative", flexShrink: 0 }}>
          {newIsPdf
            ? <button type="button" onClick={() => setViewer({ src: comprobantePreview, isPdf: true })} style={{ ...box, cursor: "pointer" }}>📄</button>
            : <button type="button" onClick={() => setViewer({ src: comprobantePreview, isPdf: false })} style={{ padding: 0, border: "none", background: "none", cursor: "pointer" }}><img src={comprobantePreview} alt="" style={thumbImg} /></button>}
          <button type="button" onClick={clearComprobante} aria-label={t.removeReceipt} style={removeBtn}>×</button>
        </div>
      );
    }
    if (showExisting) {
      return (
        <div style={{ position: "relative", flexShrink: 0 }}>
          {existingIsPdf
            ? <button type="button" onClick={() => setViewer({ src: existingUrl!, isPdf: true })} style={{ ...box, cursor: "pointer" }}>📄</button>
            : <button type="button" onClick={() => setViewer({ src: existingUrl!, isPdf: false })} style={{ padding: 0, border: "none", background: "none", cursor: "pointer" }}><img src={existingUrl} alt="" style={thumbImg} /></button>}
          <button type="button" onClick={clearComprobante} aria-label={t.removeReceipt} style={removeBtn}>×</button>
        </div>
      );
    }
    return (
      <label aria-label={t.attachReceipt} title={t.attachReceipt} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 46, height: 46, fontSize: 26, color: "var(--muted)", cursor: "pointer", flexShrink: 0 }}>
        <input type="file" accept={accept} onChange={onComprobanteSelect} style={{ display: "none" }} />
        📎
      </label>
    );
  };

  return (
    <>
    <Sheet open={open && view !== "delete" && !readOnly} onClose={onClose} title={title}>
      {/* ADD */}
      {mode === "add" && (
        <form onSubmit={handleAdd}>
          {reserveMode ? (
            /* Reserva: TIPO + FECHA en la misma fila (compacto). */
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16, alignItems: "start" }}>
              <div>
                <div className="label">{t.type}</div>
                <div style={{ display: "flex", gap: 6 }}>
                  {TIPOS.map(({ t: tt, label, color }) => (
                    <button key={tt} type="button" onClick={() => { setTipo(tt); resetAdd(); }}
                      className="pill" style={{
                        flex: 1, height: 44, padding: "0 6px",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        borderColor: tipo === tt ? color : "var(--border)",
                        background: tipo === tt ? color + "22" : "transparent",
                        color: tipo === tt ? color : "var(--muted)",
                      }}>{label}</button>
                  ))}
                </div>
              </div>
              <div>
                <div className="label">{t.date}</div>
                <input className="input" type="date" style={{ height: 44 }} value={fecha} onChange={(e) => setFecha(e.target.value)} />
              </div>
            </div>
          ) : (<>
          <div style={{ marginBottom: 18 }}>
            <div className="label">{t.type}</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {(sinPeriodos ? TIPOS.filter((x) => x.t === "Ingreso") : TIPOS).map(({ t: tt, label, color }) => (
                <button key={tt} type="button" onClick={() => { setTipo(tt); resetAdd(); if (sinPeriodos) setCategoria("Sueldo"); }}
                  className="pill" style={{
                    borderColor: tipo === tt ? color : "var(--border)",
                    background: tipo === tt ? color + "22" : "transparent",
                    color: tipo === tt ? color : "var(--muted)",
                  }}>{label}</button>
              ))}
            </div>
          </div>

          {/* Monto + Fecha — el monto es el primer dato; la fecha al lado (ya viene cargada). */}
          <div style={{ display: "grid", gridTemplateColumns: esUSD ? "1fr" : "1fr 1fr", gap: 10, marginBottom: 16 }}>
            {!esUSD && (
              <div>
                <div className="label">{t.amount}</div>
                <input className="input" style={{ fontFamily: "var(--font-mono)" }} type="number" inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="0" />
              </div>
            )}
            <div>
              <div className="label">{t.date}</div>
              <input className="input" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>
          </div>
          </>)}

          {esMove && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                {([["aDisponible", t.moveDirToDisponible], ["aAhorro", t.moveDirToAhorro]] as const).map(([d, label]) => (
                  <button key={d} type="button" onClick={() => setMoveDir(d)} className="pill" style={{
                    flex: 1,
                    borderColor: moveDir === d ? "var(--yellow)" : "var(--border)",
                    background: moveDir === d ? "var(--yellow-dim)" : "transparent",
                    color: moveDir === d ? "var(--yellow)" : "var(--muted)",
                  }}>{label}</button>
                ))}
              </div>
              <div style={{ background: "var(--yellow-dim)", border: "1px solid var(--yellow)44", borderRadius: "var(--radius-sm)", padding: 12, fontSize: 12, color: "var(--yellow)" }}>
                {moveDir === "aAhorro" ? t.moveToSavings : t.moveFromSavings}
                {periodoActual && (
                  <div style={{ color: "var(--muted)", marginTop: 4 }}>
                    {moveDir === "aAhorro" ? t.availableBalance(money(periodoActual.disponible)) : t.savingsBalance(money(ahorrosAcumActivo))}
                  </div>
                )}
              </div>
            </div>
          )}

          {!esMove && !esUSD && (
            <div style={{ marginBottom: 18 }}>
              <div className="label">{t.category}</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {categoriasFiltradas.map((c) => (
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

          {/* Sueldo: dónde se imputa el período. El dueño y el primer sueldo
              siempre abren período (solo aviso). El resto elige con el toggle. */}
          {esSueldo && (sinPeriodos || isOwner) && (
            <div style={{ background: "var(--green-dim)", border: "1px solid var(--green)44", borderRadius: "var(--radius-sm)", padding: 12, marginBottom: 16, fontSize: 12, color: "var(--green)", lineHeight: 1.7 }}>
              {sinPeriodos ? t.salaryOpensFirstPeriod : t.salaryOpensPeriod}
            </div>
          )}
          {esSueldo && !sinPeriodos && !isOwner && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                {([false, true] as const).map((nuevo) => (
                  <button key={String(nuevo)} type="button" onClick={() => setAbreNuevoPeriodo(nuevo)} className="pill" style={{
                    flex: 1,
                    borderColor: abreNuevoPeriodo === nuevo ? "var(--green)" : "var(--border)",
                    background: abreNuevoPeriodo === nuevo ? "var(--green-dim)" : "transparent",
                    color: abreNuevoPeriodo === nuevo ? "var(--green)" : "var(--muted)",
                  }}>{nuevo ? t.periodNew : t.periodCurrent}</button>
                ))}
              </div>
              <div style={{ fontSize: 11, color: "var(--muted)", paddingLeft: 2 }}>
                {abreNuevoPeriodo ? t.salaryOpensPeriod : t.salaryToCurrentPeriod}
              </div>
            </div>
          )}

          {esAhorros && (
            <div style={{ marginBottom: 18 }}>
              <div className="label">{t.origin}</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {config?.origenesAhorro.filter((o) => o.activo).map((o) => (
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
              {/* Ingresar en + Cotización en un solo grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                <div>
                  <div className="label">{t.addTo}</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {([fxLabel, "ARS"] as const).map((mo) => (
                      <button key={mo} type="button" onClick={() => setModoCarga(mo === "ARS" ? "ARS" : "USD")} className="pill" style={{
                        flex: 1,
                        borderColor: (mo === "ARS" ? modoCarga === "ARS" : modoCarga === "USD") ? "var(--yellow)" : "var(--border)",
                        background: (mo === "ARS" ? modoCarga === "ARS" : modoCarga === "USD") ? "var(--yellow-dim)" : "transparent",
                        color: (mo === "ARS" ? modoCarga === "ARS" : modoCarga === "USD") ? "var(--yellow)" : "var(--muted)",
                      }}>{mo}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="label">{t.exchangeRate}</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {cotizacion ? (["oficial", "blue"] as const).map((rt) => {
                      const val = esCompraEUR
                        ? (rt === "oficial" ? cotizacion.oficial_euro : cotizacion.blue_euro) ?? cotizacion[rt]
                        : cotizacion[rt];
                      return (
                        <button key={rt} type="button" onClick={() => setCotizManual(String(val))}
                          className="pill" style={{
                            flex: 1,
                            borderColor: (cotizManual === String(val) || (!cotizManual && rt === "oficial")) ? "var(--yellow)" : "var(--border)",
                            background: (cotizManual === String(val) || (!cotizManual && rt === "oficial")) ? "var(--yellow-dim)" : "transparent",
                            color: (cotizManual === String(val) || (!cotizManual && rt === "oficial")) ? "var(--yellow)" : "var(--muted)",
                          }}>{rt}</button>
                      );
                    }) : <span style={{ fontSize: 12, color: "var(--muted)" }}>{t.noExchangeRate}</span>}
                  </div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                <div>
                  <div className="label">{modoCarga === "USD" ? fxLabel : "ARS"}</div>
                  {modoCarga === "USD" ? (
                    <input className="input" type="number" value={cantidadUSD} onChange={(e) => setCantidadUSD(e.target.value)} placeholder="0" />
                  ) : (
                    <input className="input" type="number" value={montoARSInput} onChange={(e) => setMontoARSInput(e.target.value)} placeholder="0" />
                  )}
                </div>
                <div>
                  <div className="label" style={{ visibility: "hidden" }}>{t.exchangeRate}</div>
                  <input className="input" type="number" value={cotizManual || String(cotizacion?.oficial ?? "")} onChange={(e) => setCotizManual(e.target.value)} placeholder="0" />
                </div>
              </div>

              <div className="label">{modoCarga === "USD" ? "Total ARS" : t.equalTo(fxLabel)}</div>
              <div style={{ padding: "12px 14px", background: "var(--yellow-dim)", border: "1px solid var(--yellow)33", borderRadius: "var(--radius-sm)", fontSize: 14, fontWeight: 700, color: "var(--yellow)", fontFamily: "var(--font-mono)", marginBottom: 6 }}>
                {modoCarga === "USD"
                  ? (arsCompraUSD > 0 ? formatARS(arsCompraUSD) : "—")
                  : (usdFinal > 0 ? `${fxLabel} ${usdFinal.toFixed(2)}` : "—")}
              </div>
              {periodoActual && (
                <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 10 }}>
                  {t.available}: <span style={{ fontFamily: "var(--font-mono)" }}>{money(periodoActual.disponible)}</span>
                  {arsCompraUSD > 0 && (() => {
                    // Color según cuánto representa la compra del disponible: <30% verde, 30-70% amarillo, >70% (o negativo) rojo.
                    const ratio = periodoActual.disponible > 0 ? arsCompraUSD / periodoActual.disponible : 1;
                    const restoColor = ratio < 0.30 ? "var(--green)" : ratio <= 0.70 ? "var(--yellow)" : "var(--red)";
                    return <> · {t.remaining}: <span style={{ fontFamily: "var(--font-mono)", color: restoColor }}>{money(periodoActual.disponible - arsCompraUSD)}</span></>;
                  })()}
                </div>
              )}
            </div>
          )}

          {esGastoFX && (
            <div style={{ marginBottom: 18 }}>
              <div className="label">{t.fxAmountSpent(fxLabel)}</div>
              <input className="input" type="number" value={cantidadUSD} onChange={(e) => setCantidadUSD(e.target.value)} placeholder="0" style={{ fontFamily: "var(--font-mono)" }} />
              {usdFinal > 0 && (
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 8 }}>
                  Total: {fxLabel} {usdFinal.toFixed(2)}
                </div>
              )}
            </div>
          )}

          {!esMove && !esUSD && !esAhorros && (
            <div style={{ marginBottom: 14 }}>
              <div className="label">{t.description}</div>
              <input className="input" type="text" list="finmoves-desc-sug" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} autoComplete="off" />
              {descSuggestions.length > 0 && (
                <datalist id="finmoves-desc-sug">
                  {descSuggestions.map((d) => <option key={d} value={d} />)}
                </datalist>
              )}
            </div>
          )}
          {!esMove && !esUSD && (
            <div style={{ marginBottom: 14 }}>
              <div className="label">{t.paymentMethod}</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {config?.mediosPago.filter((m) => m.activo).map((m) => (
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

          {/* Auto-ahorro: solo una vez cargada la descripción (y si no está en la lista a omitir). */}
          {tipo === "Gasto" && config?.meta.autoAhorro?.activo && (config.meta.autoAhorro.monto ?? 0) > 0 &&
           descripcion.trim().length > 0 &&
           (!config.meta.autoAhorro.mediosPago?.length || config.meta.autoAhorro.mediosPago.includes(medioPago)) &&
           !(config.meta.autoAhorro.omitirDescripciones ?? []).some((d) => d.toLowerCase() === descripcion.trim().toLowerCase()) && (
            <div style={{ background: "var(--blue-dim)", border: "1px solid var(--blue)33", borderRadius: "var(--radius-sm)", padding: "10px 14px", marginBottom: 16, fontSize: 12, color: "var(--blue)", display: "flex", alignItems: "center", gap: 8 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M12 5v14M5 12l7 7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {money(config.meta.autoAhorro.monto)} {t.toSavings}
            </div>
          )}

          {addError && (
            <div style={{ background: "var(--red-dim)", border: "1px solid var(--red)44", borderRadius: "var(--radius-sm)", padding: 12, marginBottom: 14, fontSize: 12, color: "var(--red)" }}>
              {addError}
            </div>
          )}

          {/* Observaciones (50%) + comprobante (25%) + enviar (25%) en la misma fila */}
          <div style={{ display: "grid", gridTemplateColumns: canComprobante ? "50% 25% 25%" : "70% 30%", gap: 10, alignItems: "end", marginTop: 8 }}>
            <div>
              <div className="label">{t.notes}</div>
              <input className="input" type="text" value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
            </div>
            {canComprobante && (
              <div style={{ display: "flex", justifyContent: "center" }}>
                {comprobanteIcon()}
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "center" }}>
              <button type="submit" disabled={!canSubmit || addLoading} aria-label={t.save} style={{
                width: 52, height: 52, borderRadius: "50%",
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
                  : <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* DETALLE (solo lectura): se renderiza como modal flotante fuera del Sheet (más abajo). */}

      {/* EDIT */}
      {mode === "edit" && movimiento && !readOnly && view === "form" && (
        <>
          {/* Grid de 3: Tipo · Categoría · Fecha (solo lectura). */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 14 }}>
            {[{ l: t.type, v: movimiento.tipo }, { l: t.category, v: movimiento.categoria }, { l: t.date, v: fechaCorta(movimiento.fecha) }].map((f) => (
              <div key={f.l} style={{ background: "var(--surface-alt)", borderRadius: "var(--radius-sm)", padding: "6px 10px", minWidth: 0 }}>
                <div style={{ fontSize: 9, color: "var(--muted)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 2 }}>{f.l}</div>
                <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.v}</div>
              </div>
            ))}
          </div>
          {/* Detalle de reserva (FX): cantidad + cotización, solo lectura. */}
          {esFXMov && (
            <div style={{ display: "grid", gridTemplateColumns: movimiento.cotizacion != null ? "1fr 1fr" : "1fr", gap: 8, marginBottom: 14 }}>
              <div style={{ background: "var(--surface-alt)", borderRadius: "var(--radius-sm)", padding: "6px 10px", minWidth: 0 }}>
                <div style={{ fontSize: 9, color: "var(--muted)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 2 }}>{t.quantity}</div>
                <div style={{ fontSize: 12, fontWeight: 600, fontFamily: "var(--font-mono)" }}>{fxMovLabel} {movimiento.cantidadUSD?.toFixed(2) ?? "—"}</div>
              </div>
              {movimiento.cotizacion != null && (
                <div style={{ background: "var(--surface-alt)", borderRadius: "var(--radius-sm)", padding: "6px 10px", minWidth: 0 }}>
                  <div style={{ fontSize: 9, color: "var(--muted)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 2 }}>{t.exchangeRate}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, fontFamily: "var(--font-mono)" }}>${movimiento.cotizacion.toLocaleString("es-AR")}</div>
                </div>
              )}
            </div>
          )}
          {/* Monto (30%) + Descripción (70%) — ambos editables (descripción también en Sueldo). */}
          <div style={{ display: "grid", gridTemplateColumns: "30% 70%", gap: 10, marginBottom: 14 }}>
            <div>
              <div className="label">{t.amount}</div>
              <input className="input" style={{ fontFamily: "var(--font-mono)" }} type="number" inputMode="decimal" value={eMonto} onChange={(e) => setEMonto(e.target.value)} />
            </div>
            <div>
              <div className="label">{t.description}</div>
              <input className="input" value={eDesc} onChange={(e) => setEDesc(e.target.value)} />
            </div>
          </div>
          {/* Medio de pago: no aplica al Sueldo (ancla del período). */}
          {!isLocked && (
            <div style={{ marginBottom: 14 }}>
              <div className="label">{t.paymentMethod}</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {["Mercado Pago", "Débito", "Efectivo"].map((m) => (
                  <button key={m} type="button" onClick={() => setEMedio(m)} className="pill" style={{
                    borderColor: eMedio === m ? "var(--accent)" : "var(--border)",
                    background: eMedio === m ? "var(--accent-dim)" : "transparent",
                    color: eMedio === m ? "var(--accent)" : "var(--muted)",
                  }}>{m}</button>
                ))}
              </div>
            </div>
          )}
          {/* Observaciones (70%) + comprobante compacto (30%) en la misma fila */}
          <div style={{ display: "grid", gridTemplateColumns: canComprobante ? "70% 30%" : "1fr", gap: 10, alignItems: "end", marginBottom: 24 }}>
            <div>
              <div className="label">{t.notes}</div>
              <input className="input" value={eObs} onChange={(e) => setEObs(e.target.value)} />
            </div>
            {canComprobante && (
              <div style={{ display: "flex", justifyContent: "center", paddingBottom: 4 }}>
                {comprobanteIcon(movimiento.comprobanteUrl)}
              </div>
            )}
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
                : <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
            </button>
          </div>
        </>
      )}

    </Sheet>
    {open && readOnly && movimiento && (
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 18, width: "100%", maxWidth: 360, maxHeight: "85vh", overflowY: "auto", padding: 20, boxShadow: "0 12px 40px rgba(0,0,0,0.5)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <span style={{ fontSize: 16, fontWeight: 700 }}>{t.detail}</span>
            <button onClick={onClose} aria-label={t.cancel} style={{ background: "none", border: "none", color: "var(--red)", fontSize: 22, lineHeight: 1, cursor: "pointer", padding: 0 }}>×</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 12 }}>
            {[{ l: t.type, v: movimiento.tipo }, { l: t.category, v: movimiento.categoria }, { l: t.date, v: fechaCorta(movimiento.fecha) }].map((f) => (
              <div key={f.l} style={{ background: "var(--surface-alt)", borderRadius: "var(--radius-sm)", padding: "6px 10px", minWidth: 0 }}>
                <div style={{ fontSize: 9, color: "var(--muted)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 2 }}>{f.l}</div>
                <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.v}</div>
              </div>
            ))}
          </div>
          {esFXMov && (
            <div style={{ display: "grid", gridTemplateColumns: movimiento.cotizacion != null ? "1fr 1fr" : "1fr", gap: 8, marginBottom: 12 }}>
              <div style={{ background: "var(--surface-alt)", borderRadius: "var(--radius-sm)", padding: "6px 10px" }}>
                <div style={{ fontSize: 9, color: "var(--muted)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 2 }}>{t.quantity}</div>
                <div style={{ fontSize: 12, fontWeight: 600, fontFamily: "var(--font-mono)" }}>{fxMovLabel} {movimiento.cantidadUSD?.toFixed(2) ?? "—"}</div>
              </div>
              {movimiento.cotizacion != null && (
                <div style={{ background: "var(--surface-alt)", borderRadius: "var(--radius-sm)", padding: "6px 10px" }}>
                  <div style={{ fontSize: 9, color: "var(--muted)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 2 }}>{t.exchangeRate}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, fontFamily: "var(--font-mono)" }}>${movimiento.cotizacion.toLocaleString("es-AR")}</div>
                </div>
              )}
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "30% 70%", gap: 10, marginBottom: 12 }}>
            <div style={{ background: "var(--surface-alt)", borderRadius: "var(--radius-sm)", padding: "6px 10px", minWidth: 0 }}>
              <div style={{ fontSize: 9, color: "var(--muted)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 2 }}>{t.amount}</div>
              <div style={{ fontSize: 12, fontWeight: 600, fontFamily: "var(--font-mono)" }}>{money(movimiento.monto)}</div>
            </div>
            <div style={{ background: "var(--surface-alt)", borderRadius: "var(--radius-sm)", padding: "6px 10px", minWidth: 0 }}>
              <div style={{ fontSize: 9, color: "var(--muted)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 2 }}>{t.description}</div>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{movimiento.descripcion || "—"}</div>
            </div>
          </div>
          {movimiento.observaciones && (
            <div style={{ background: "var(--surface-alt)", borderRadius: "var(--radius-sm)", padding: "6px 10px", marginBottom: 12 }}>
              <div style={{ fontSize: 9, color: "var(--muted)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 2 }}>{t.notes}</div>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{movimiento.observaciones}</div>
            </div>
          )}
          {movimiento.comprobanteUrl && (
            <button type="button" onClick={() => setViewer({ src: movimiento.comprobanteUrl!, isPdf: !!movimiento.comprobantePath?.toLowerCase().endsWith(".pdf") })}
              style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "10px 14px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", background: "none", color: "var(--accent)", fontSize: 13, cursor: "pointer" }}>
              📎 {t.receipt}
            </button>
          )}
        </div>
      </div>
    )}
    {open && view === "delete" && movimiento && (
      <ConfirmModal title={t.delete} confirmLabel={t.yesDelete} cancelLabel={t.cancel} confirmColor="var(--red)" loading={editLoading}
        onConfirm={handleDelete} onCancel={onClose}>
        <div style={{ textAlign: "center" }}>
          <div style={{ marginBottom: 6 }}>{t.deleteMovementTitle}</div>
          <div style={{ fontSize: 17, fontWeight: 700, color: "var(--text)", marginBottom: 2 }}>{movimiento.descripcion || movimiento.categoria}</div>
          <div style={{ fontSize: 18, color: "var(--red)", fontFamily: "var(--font-mono)", fontWeight: 700, marginBottom: 8 }}>{money(movimiento.monto)}</div>
          <div style={{ fontSize: 11 }}>{t.actionIrreversible}</div>
        </div>
      </ConfirmModal>
    )}
    {viewer && <MediaViewer src={viewer.src} isPdf={viewer.isPdf} onClose={() => setViewer(null)} />}
    </>
  );
}
