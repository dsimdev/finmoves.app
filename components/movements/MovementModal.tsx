"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useCotizacion } from "@/hooks/useCotizacion";
import { useAppPrefs } from "@/hooks/useAppPrefs";
import { useMoney } from "@/hooks/useHideValues";
import { useT } from "@/hooks/useTranslation";
import { crearMovimiento, actualizarMovimiento, eliminarMovimiento } from "@/services/firebase/movimientos";
import { listarPlantillas, crearPlantilla, eliminarPlantilla, usarPlantilla, type Plantilla } from "@/services/firebase/plantillas";
import { uploadComprobante, deleteComprobante } from "@/lib/storage";
import { MediaViewer } from "@/components/ui/MediaViewer";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { BottomSheet as Sheet } from "@/components/ui/BottomSheet";
import { useScrollLock } from "@/hooks/useScrollLock";
import { agruparPorPeriodo, formatARS, fechaCorta } from "@/utils/periodo";
import { serieTendencia } from "@/utils/reportes";
import { Movimiento, TipoMovimiento, ConfigUsuario } from "@/types";

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
  /** Fallback para casos sin handler específico. */
  onChanged: () => void;
  /** Alta optimista: recibe los movimientos creados con su ID definitivo. */
  onCreated?: (movs: Movimiento[]) => void;
  /** Actualización optimista al editar/borrar. */
  onUpdated?: (id: string, patch: Partial<Movimiento>) => void;
  onDeleted?: (id: string) => void;
}

// Modal de alta/edición/borrado de movimientos, reutilizable (Movimientos, Inicio).
export function MovementModal({ open, mode, movimiento, movimientos, config, activePeriodoId, initialView, reserveMode, readOnly, onClose, onChanged, onCreated, onUpdated, onDeleted }: MovementModalProps) {
  const { user } = useAuth();
  const { cotizacion } = useCotizacion();
  const { monedaInversiones, monedaPrincipal } = useAppPrefs();
  const { m: money } = useMoney();
  const t = useT();
  // El detalle solo-lectura es un overlay aparte del Sheet → lockear su scroll.
  useScrollLock(open && !!readOnly);

  const monedaInversionesEfectiva: "USD" | "EUR" =
    monedaPrincipal === "USD" ? "EUR" : monedaPrincipal === "EUR" ? "USD" : monedaInversiones;
  const esEURMode = monedaInversionesEfectiva === "EUR";

  // En modo reserva (desde Inversión) solo se cargan +Reserva / -Reserva (FX).
  // En modo normal, las cargas a la reserva ya no se ofrecen acá.
  const TIPOS: { t: TipoMovimiento; label: string; color: string }[] = reserveMode ? [
    { t: (esEURMode ? "CompraEUR" : "CompraUSD") as TipoMovimiento, label: t.buy, color: "var(--green)" },
    { t: (esEURMode ? "VentaEUR" : "VentaUSD") as TipoMovimiento, label: t.sell, color: "var(--red)" },
    { t: (esEURMode ? "GastoEUR" : "GastoUSD") as TipoMovimiento, label: t.spend, color: "var(--blue)" },
  ] : [
    { t: "Gasto", label: t.tipoDisplay["Gasto"], color: "var(--red)" },
    { t: "Ingreso", label: t.tipoDisplay["Ingreso"], color: "var(--green)" },
    { t: "Move", label: t.tipoDisplay["Move"], color: "var(--purple)" },
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
  // El monto es el primer dato a cargar → foco al abrir el alta y al cambiar de tipo.
  const montoRef = useRef<HTMLInputElement>(null);
  const reserveRef = useRef<HTMLInputElement>(null);
  const focusMonto = () => requestAnimationFrame(() => montoRef.current?.focus());

  // ── Edit state ──
  const [eMonto, setEMonto] = useState("");
  const [eDesc, setEDesc] = useState("");
  const [eMedio, setEMedio] = useState("");
  const [eObs, setEObs] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");

  // Plantillas de gasto frecuente (solo modo alta).
  const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
  const [tplDelete, setTplDelete] = useState<Plantilla | null>(null);
  const [tplSavedFlash, setTplSavedFlash] = useState(false);

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
      // Foco en el monto una vez terminada la animación de apertura del sheet.
      const id = setTimeout(() => (reserveMode ? reserveRef.current : montoRef.current)?.focus(), 420);
      return () => clearTimeout(id);
    } else if (mode === "edit" && movimiento) {
      // El sueldo que abre período (ancla) no se puede borrar → forzar vista form.
      const esAncla = movimiento.tipo === "Ingreso" && movimiento.categoria === "Sueldo" &&
        fechaAPeriodoId(movimiento.fecha) === movimiento.periodoId;
      setView(initialView === "delete" && !esAncla ? "delete" : "form");
      setEMonto(String(movimiento.monto));
      setEDesc(movimiento.descripcion || (movimiento as Movimiento & { origenAhorro?: string }).origenAhorro || "");
      setEMedio(movimiento.medioPago ?? "");
      setEObs(movimiento.observaciones ?? "");
      setEditError("");
      resetComprobante();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, movimiento?.id, initialView]);

  // Cargar plantillas al abrir un alta normal (no reserva ni sin períodos).
  useEffect(() => {
    if (!open || mode !== "add" || reserveMode || !user?.uid) return;
    listarPlantillas(user.uid).then(setPlantillas).catch(() => {});
  }, [open, mode, reserveMode, user?.uid]);

  const aplicarPlantilla = (p: Plantilla) => {
    setTipo("Gasto");
    setCategoria(p.categoria);
    setMonto(String(p.monto));
    setDescripcion(p.nombre);
    setMedioPago(p.medioPago);
    setObservaciones(p.observaciones ?? "");
    if (user?.uid) {
      usarPlantilla(user.uid, p.id).then(() => {
        setPlantillas((prev) => {
          const updated = prev.map((x) => x.id === p.id ? { ...x, usageCount: (x.usageCount ?? 0) + 1 } : x);
          return [...updated].sort((a, b) => (b.usageCount ?? 0) - (a.usageCount ?? 0));
        });
      }).catch(() => {});
    }
  };

  const guardarComoPlantilla = async () => {
    if (!user?.uid || tipo !== "Gasto" || !categoria) return;
    await crearPlantilla(user.uid, {
      nombre: descripcion.trim() || categoria,
      categoria,
      monto: parseFloat(monto || "0"),
      medioPago,
      ...(observaciones.trim() ? { observaciones: observaciones.trim() } : {}),
    });
    setTplSavedFlash(true);
    setTimeout(() => setTplSavedFlash(false), 1800);
    listarPlantillas(user.uid).then(setPlantillas).catch(() => {});
  };

  const confirmarBorrarPlantilla = async () => {
    if (!user?.uid || !tplDelete) return;
    await eliminarPlantilla(user.uid, tplDelete.id);
    setPlantillas((prev) => prev.filter((x) => x.id !== tplDelete.id));
    setTplDelete(null);
  };

  const esSueldo = tipo === "Ingreso" && categoria === "Sueldo";
  const esAhorros = tipo === "Ingreso" && categoria === "Ahorros";
  const esMove = tipo === "Move";
  const esCompraUSD = tipo === "CompraUSD";
  const esGastoUSD = tipo === "GastoUSD";
  const esCompraEUR = tipo === "CompraEUR";
  const esGastoEUR = tipo === "GastoEUR";
  const esVentaUSD = tipo === "VentaUSD";
  const esVentaEUR = tipo === "VentaEUR";
  const esCompraFX = esCompraUSD || esCompraEUR;
  const esGastoFX = esGastoUSD || esGastoEUR;
  const esVentaFX = esVentaUSD || esVentaEUR;
  // Compra y Venta usan el mismo form (cantidad + cotización → ARS); Gasto solo cantidad.
  const esCompraOVenta = esCompraFX || esVentaFX;
  const esUSD = esCompraFX || esGastoFX || esVentaFX;
  const fxLabel = esCompraEUR || esGastoEUR || esVentaEUR ? "EUR" : "USD";
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
  const arsCompraUSD = !esCompraOVenta ? 0 : modoCarga === "USD"
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
    esCompraOVenta ? usdFinal > 0 && arsCompraUSD > 0 :
    esMove ? true :
    !!categoria && parseFloat(monto || "0") > 0
  );

  // Un sueldo que ABRE período (su fecha define el periodoId) es el ancla → no se puede
  // borrar (se chequea en el efecto de apertura). Un sueldo "sumado" al período sí.
  const isLocked = movimiento ? movimiento.tipo === "Ingreso" && movimiento.categoria === "Sueldo" : false;
  // Movimiento de reserva (FX): muestra cantidad + cotización en el detalle.
  const esFXMov = !!movimiento && ["CompraUSD", "GastoUSD", "CompraEUR", "GastoEUR", "VentaUSD", "VentaEUR"].includes(movimiento.tipo);
  const fxMovLabel = movimiento && (movimiento.tipo === "CompraEUR" || movimiento.tipo === "GastoEUR" || movimiento.tipo === "VentaEUR") ? "EUR" : "USD";
  // Quién puede adjuntar comprobantes: el dueño siempre, o quien tenga el permiso
  // habilitado por el dueño (default OFF para no-dueños). Ver panel Admin.
  const canComprobante = isOwner || config?.meta.permisos?.comprobantes === true;

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
      const montoFinal = esCompraOVenta ? arsCompraUSD : esGastoFX ? 0 : parseFloat(monto);
      if (!esGastoFX && (!montoFinal || montoFinal <= 0)) throw new Error(t.errInvalidAmount);
      if (esUSD && (!usdFinal || usdFinal <= 0)) throw new Error(t.errInvalidFX(fxLabel));
      const periodoIdFinal = abrePeriodo ? fechaAPeriodoId(fecha) : (periodoActual?.periodoId ?? null);
      if (!periodoIdFinal) throw new Error(t.errNoActivePeriod);
      let comprobante: { url: string; path: string } | null = null;
      if (canComprobante && comprobanteFile) comprobante = await uploadComprobante(user.uid, comprobanteFile);
      const now = new Date();
      const created: Movimiento[] = [];

      const mainData: Omit<Movimiento, "id"> = {
        timestampCarga: now, fecha, tipo,
        categoria: esMove ? "Move" : esUSD ? tipo : categoria,
        descripcion: esMove ? (moveDir === "aAhorro" ? "Move a ahorros" : "Move a disponible") : esCompraFX ? `Compra ${fxLabel}` : esGastoFX ? `Gasto ${fxLabel}` : esVentaFX ? `Venta ${fxLabel}` : esAhorros ? (origenAhorro || descripcion.trim()) : descripcion.trim(),
        monto: montoFinal,
        medioPago: esMove || esCompraFX || esVentaFX ? "Mercado Pago" : esGastoFX ? "—" : medioPago,
        observaciones, periodoId: periodoIdFinal, userId: user.uid,
        ...(esMove ? { direccionMove: moveDir } : {}),
        ...(comprobante ? { comprobanteUrl: comprobante.url, comprobantePath: comprobante.path } : {}),
        ...(esAhorros && origenAhorro ? { origenAhorro } : {}),
        ...(esCompraOVenta ? { cantidadUSD: usdFinal, cotizacion: cotizActual } : {}),
        ...(esGastoFX ? { cantidadUSD: usdFinal } : {}),
      };
      const mainId = await crearMovimiento(user.uid, mainData);
      created.push({ ...mainData, id: mainId });

      // Cierre del período anterior: el disponible sobrante se traslada como RESTO al nuevo período.
      if (abrePeriodo && !sinPeriodos && periodoActual && periodoActual.disponible > 0) {
        const restoData: Omit<Movimiento, "id"> = {
          timestampCarga: now, fecha, tipo: "Ingreso",
          categoria: "RESTO", descripcion: "Resto período anterior",
          monto: periodoActual.disponible,
          medioPago: "—", observaciones: `de ${periodoActual.periodoId}`,
          periodoId: periodoIdFinal, userId: user.uid,
        };
        const restoId = await crearMovimiento(user.uid, restoData);
        created.push({ ...restoData, id: restoId });
      }
      const autoAhorroMedios = config?.meta.autoAhorro?.mediosPago;
      const autoAhorroOmitir = config?.meta.autoAhorro?.omitirDescripciones ?? [];
      if (tipo === "Gasto" && config?.meta.autoAhorro?.activo && (config.meta.autoAhorro.monto ?? 0) > 0 &&
          (!autoAhorroMedios?.length || autoAhorroMedios.includes(medioPago)) &&
          !autoAhorroOmitir.some((d) => d.toLowerCase() === descripcion.trim().toLowerCase())) {
        const aaData: Omit<Movimiento, "id"> = {
          timestampCarga: now, fecha, tipo: "Move",
          categoria: "Move", descripcion: "Auto-ahorro",
          monto: config.meta.autoAhorro.monto,
          medioPago: "Mercado Pago", observaciones: `por ${categoria}`,
          periodoId: periodoIdFinal, userId: user.uid,
          direccionMove: "aAhorro",
        };
        const aaId = await crearMovimiento(user.uid, aaData);
        created.push({ ...aaData, id: aaId });
      }
      resetAdd();
      if (onCreated) onCreated(created); else onChanged();
      onClose();
    } catch (err: unknown) {
      setAddError(err instanceof Error ? err.message : t.unexpectedError);
    } finally {
      setAddLoading(false);
    }
  };

  const handleEdit = async () => {
    if (!user?.uid || !movimiento) return;
    setEditLoading(true); setEditError("");
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
      // Optimista: parchear en memoria en vez de re-leer toda la colección.
      if (onUpdated) onUpdated(movimiento.id, update); else onChanged();
      onClose();
    } catch (err) { console.error(err); setEditError(err instanceof Error ? err.message : t.unexpectedError); }
    finally { setEditLoading(false); }
  };

  const handleDelete = async () => {
    if (!user?.uid || !movimiento) return;
    setEditLoading(true); setEditError("");
    try {
      await eliminarMovimiento(user.uid, movimiento.id);
      await deleteComprobante(movimiento.comprobantePath); // borrar el comprobante asociado
      if (onDeleted) onDeleted(movimiento.id); else onChanged();
      onClose();
    } catch (err) { console.error(err); setEditError(err instanceof Error ? err.message : t.unexpectedError); }
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
          <div style={{ display: "grid", gridTemplateColumns: tipo === "Gasto" ? "4fr 1fr" : "1fr", gap: 10, marginBottom: 18, alignItems: "end" }}>
            <div>
              <div className="label">{t.type}</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {(sinPeriodos ? TIPOS.filter((x) => x.t === "Ingreso") : TIPOS).map(({ t: tt, label, color }) => {
                  const sel = tipo === tt;
                  const isMove = tt === "Move";
                  return (
                    <button key={tt} type="button" onClick={() => { setTipo(tt); resetAdd(); if (sinPeriodos) setCategoria("Sueldo"); focusMonto(); }}
                      className="pill" style={sel && isMove ? {
                        border: "1px solid transparent",
                        backgroundImage: "linear-gradient(#0e1524, #0e1524), linear-gradient(90deg, #26c6da, var(--purple))",
                        backgroundOrigin: "padding-box, border-box",
                        backgroundClip: "padding-box, border-box",
                        color: "var(--text)",
                      } : {
                        borderColor: sel ? color : "var(--border)",
                        background: sel ? color + "22" : "transparent",
                        color: sel ? color : "var(--muted)",
                      }}>{label}</button>
                  );
                })}
              </div>
            </div>
            {tipo === "Gasto" && (() => {
              const ready = !!categoria && parseFloat(monto || "0") > 0;
              return (
                <button type="button" onClick={ready ? guardarComoPlantilla : undefined} disabled={!ready} aria-label={t.tplSave} title={t.tplSave} style={{
                  width: "100%", minHeight: 34, display: "flex", alignItems: "center", justifyContent: "center",
                  border: `1px solid ${tplSavedFlash ? "var(--green)" : "var(--border)"}`, borderRadius: 999,
                  background: "transparent", color: tplSavedFlash ? "var(--green)" : ready ? "var(--text)" : "var(--muted)",
                  cursor: ready ? "pointer" : "default", padding: "4px",
                }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill={tplSavedFlash ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                  </svg>
                </button>
              );
            })()}
          </div>

          {/* Plantillas: tap precarga el form; × borra. Solo para gastos. */}
          {tipo === "Gasto" && plantillas.length > 0 && (
            <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 16, paddingBottom: 2, scrollbarWidth: "none" }}>
              {plantillas.map((p) => (
                <div key={p.id} className="pill" style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 6, borderColor: "var(--border)", padding: "5px 8px 5px 12px" }}>
                  <button type="button" onClick={() => aplicarPlantilla(p)} style={{ background: "none", border: "none", color: "var(--text)", cursor: "pointer", fontSize: 12, padding: 0 }}>
                    {p.nombre}
                  </button>
                  <button type="button" aria-label={t.tplDelete} onClick={() => setTplDelete(p)} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: 14, lineHeight: 1, padding: "0 2px" }}>×</button>
                </div>
              ))}
            </div>
          )}

          {/* Monto + Fecha — el monto es el primer dato; la fecha al lado (ya viene cargada). */}
          <div style={{ display: "grid", gridTemplateColumns: esUSD ? "1fr" : "1fr 1fr", gap: 10, marginBottom: 16 }}>
            {!esUSD && (
              <div>
                <div className="label">{t.amount}</div>
                <input ref={montoRef} className="input" style={{ fontFamily: "var(--font-mono)" }} type="number" inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="0" />
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
                {([["aDisponible", t.moveDirToDisponible], ["aAhorro", t.moveDirToAhorro]] as const).map(([d, label]) => {
                  const dc = d === "aAhorro" ? "var(--purple)" : "#26c6da";
                  const dd = d === "aAhorro" ? "var(--purple-dim)" : "#26c6da20";
                  return (
                    <button key={d} type="button" onClick={() => setMoveDir(d)} className="pill" style={{
                      flex: 1,
                      borderColor: moveDir === d ? dc : "var(--border)",
                      background: moveDir === d ? dd : "transparent",
                      color: moveDir === d ? dc : "var(--muted)",
                    }}>{label}</button>
                  );
                })}
              </div>
              {(() => {
                const ac = moveDir === "aAhorro" ? "var(--purple)" : "#26c6da";
                const ad = moveDir === "aAhorro" ? "var(--purple-dim)" : "#26c6da20";
                return (
              <div style={{ background: ad, border: `1px solid ${ac}44`, borderRadius: "var(--radius-sm)", padding: 12, fontSize: 12, color: ac }}>
                {moveDir === "aAhorro" ? t.moveToSavings : t.moveFromSavings}
                {periodoActual && (
                  <div style={{ color: "var(--muted)", marginTop: 4 }}>
                    {moveDir === "aAhorro" ? t.availableBalance(money(periodoActual.disponible)) : t.savingsBalance(money(ahorrosAcumActivo))}
                  </div>
                )}
              </div>
                );
              })()}
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

          {esCompraOVenta && (
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
                    <input ref={reserveRef} className="input" type="number" value={cantidadUSD} onChange={(e) => setCantidadUSD(e.target.value)} placeholder="0" />
                  ) : (
                    <input ref={reserveRef} className="input" type="number" value={montoARSInput} onChange={(e) => setMontoARSInput(e.target.value)} placeholder="0" />
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
                  {arsCompraUSD > 0 && esVentaFX && (
                    // La venta SUMA al disponible (entra ARS).
                    <> · {t.remaining}: <span style={{ fontFamily: "var(--font-mono)", color: "var(--green)" }}>{money(periodoActual.disponible + arsCompraUSD)}</span></>
                  )}
                  {arsCompraUSD > 0 && !esVentaFX && (() => {
                    // Compra: resta del disponible. Color según cuánto representa: <30% verde, 30-70% amarillo, >70% rojo.
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
              <input ref={reserveRef} className="input" type="number" value={cantidadUSD} onChange={(e) => setCantidadUSD(e.target.value)} placeholder="0" style={{ fontFamily: "var(--font-mono)" }} />
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

          {editError && (
            <div style={{ background: "var(--red-dim)", border: "1px solid var(--red)44", borderRadius: "var(--radius-sm)", padding: 12, marginBottom: 8, fontSize: 12, color: "var(--red)", textAlign: "center" }}>{editError}</div>
          )}
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
    {readOnly && movimiento && (
      <Sheet open={open} onClose={onClose} title={t.detail}>
        {/* Monto protagonista */}
        <div style={{ textAlign: "center", marginBottom: 18 }}>
          <div style={{ fontSize: 10, color: "var(--muted)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>{movimiento.tipo} · {movimiento.categoria}</div>
          <div style={{ fontSize: 30, fontWeight: 700, fontFamily: "var(--font-mono)", lineHeight: 1.05 }}>{money(movimiento.monto)}</div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>{fechaCorta(movimiento.fecha)}</div>
        </div>
        {esFXMov && (
          <div style={{ display: "grid", gridTemplateColumns: movimiento.cotizacion != null ? "1fr 1fr" : "1fr", gap: 8, marginBottom: 10 }}>
            <div style={{ background: "var(--surface-alt)", borderRadius: "var(--radius-sm)", padding: "9px 12px", minWidth: 0 }}>
              <div style={{ fontSize: 9, color: "var(--muted)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 3 }}>{t.quantity}</div>
              <div style={{ fontSize: 15, fontWeight: 700, fontFamily: "var(--font-mono)" }}>{fxMovLabel} {movimiento.cantidadUSD?.toFixed(2) ?? "—"}</div>
            </div>
            {movimiento.cotizacion != null && (
              <div style={{ background: "var(--surface-alt)", borderRadius: "var(--radius-sm)", padding: "9px 12px", minWidth: 0 }}>
                <div style={{ fontSize: 9, color: "var(--muted)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 3 }}>{t.exchangeRate}</div>
                <div style={{ fontSize: 15, fontWeight: 700, fontFamily: "var(--font-mono)" }}>${movimiento.cotizacion.toLocaleString("es-AR")}</div>
              </div>
            )}
          </div>
        )}
        {(movimiento.descripcion || movimiento.observaciones) && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
            {movimiento.descripcion && (
              <div style={{ background: "var(--surface-alt)", borderRadius: "var(--radius-sm)", padding: "9px 12px" }}>
                <div style={{ fontSize: 9, color: "var(--muted)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 3 }}>{t.description}</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{movimiento.descripcion}</div>
              </div>
            )}
            {movimiento.observaciones && (
              <div style={{ background: "var(--surface-alt)", borderRadius: "var(--radius-sm)", padding: "9px 12px" }}>
                <div style={{ fontSize: 9, color: "var(--muted)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 3 }}>{t.notes}</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{movimiento.observaciones}</div>
              </div>
            )}
          </div>
        )}
        {movimiento.comprobanteUrl && (
          <button type="button" onClick={() => setViewer({ src: movimiento.comprobanteUrl!, isPdf: !!movimiento.comprobantePath?.toLowerCase().endsWith(".pdf") })}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", padding: "11px 14px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", background: "none", color: "var(--accent)", fontSize: 13, cursor: "pointer" }}>
            📎 {t.receipt}
          </button>
        )}
      </Sheet>
    )}
    {open && view === "delete" && movimiento && (
      <ConfirmModal title={t.delete} confirmLabel={t.yesDelete} cancelLabel={t.cancel} confirmColor="var(--red)" loading={editLoading}
        onConfirm={handleDelete} onCancel={onClose}>
        <div style={{ textAlign: "center" }}>
          <div style={{ marginBottom: 6 }}>{t.deleteMovementTitle}</div>
          <div style={{ fontSize: 17, fontWeight: 700, color: "var(--text)", marginBottom: 2 }}>{movimiento.descripcion || movimiento.categoria}</div>
          <div style={{ fontSize: 18, color: "var(--red)", fontFamily: "var(--font-mono)", fontWeight: 700, marginBottom: 8 }}>{money(movimiento.monto)}</div>
          <div style={{ fontSize: 11 }}>{t.actionIrreversible}</div>
          {editError && <div style={{ fontSize: 12, color: "var(--red)", marginTop: 10, fontWeight: 600 }}>{editError}</div>}
        </div>
      </ConfirmModal>
    )}
    {tplDelete && (
      <ConfirmModal title={t.tplDelete} confirmLabel={t.yesDelete} cancelLabel={t.cancel} confirmColor="var(--red)"
        onConfirm={confirmarBorrarPlantilla} onCancel={() => setTplDelete(null)}>
        <div style={{ textAlign: "center" }}>
          <div style={{ marginBottom: 6 }}>{t.tplDeleteConfirm}</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>{tplDelete.nombre}</div>
        </div>
      </ConfirmModal>
    )}
    {viewer && <MediaViewer src={viewer.src} isPdf={viewer.isPdf} onClose={() => setViewer(null)} />}
    </>
  );
}
