"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useCotizacion } from "@/hooks/useCotizacion";
import { useAppPrefs } from "@/hooks/useAppPrefs";
import { useMoney } from "@/hooks/useHideValues";
import { useT } from "@/hooks/useTranslation";
import { crearMovimientoConId, nuevoMovimientoId, actualizarMovimiento, eliminarMovimiento } from "@/services/firebase/movimientos";
import { upsertRecurrente } from "@/services/firebase/recurrentes";
import { crearPlantilla, eliminarPlantilla, usarPlantilla, type Plantilla } from "@/services/firebase/plantillas";
import { useData } from "@/app/(tabs)/data-context";
import { uploadComprobante, deleteComprobante } from "@/lib/storage";
import { useComprobante } from "./useComprobante";
import { ComprobanteChooser } from "./ComprobanteChooser";
import { MediaViewer } from "@/components/ui/MediaViewer";
import { Loader } from "@/components/ui/Loader";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { BottomSheet as Sheet } from "@/components/ui/BottomSheet";
import { useScrollLock } from "@/hooks/useScrollLock";
import { agruparPorPeriodo, formatARS, fechaCorta, fechaAPeriodoId } from "@/utils/periodo";
import { serieTendencia } from "@/utils/reportes";
import { reservaFX } from "@/utils/reserva";
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
  /** Pre-llenado del alta (p.ej. desde el share target). Solo aplica en mode "add". */
  prefill?: { monto?: number; descripcion?: string } | null;
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
export function MovementModal({ open, mode, movimiento, movimientos, config, activePeriodoId, initialView, reserveMode, readOnly, prefill, onClose, onChanged, onCreated, onUpdated, onDeleted }: MovementModalProps) {
  const { user } = useAuth();
  const { plantillas, mutatePlantillas, refreshPlantillas, refreshRecurrentes } = useData();
  const { cotizacion } = useCotizacion();
  const { monedaInversiones, monedaPrincipal, saveFeedback } = useAppPrefs();
  const buzz = (pattern: number | number[]) => { if (saveFeedback) navigator.vibrate?.(pattern); };
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
    { t: (esEURMode ? "IngresoEUR" : "IngresoUSD") as TipoMovimiento, label: t.fxIncome, color: "var(--green)" },
    { t: (esEURMode ? "VentaEUR" : "VentaUSD") as TipoMovimiento, label: t.sell, color: "var(--red)" },
    { t: (esEURMode ? "GastoEUR" : "GastoUSD") as TipoMovimiento, label: t.spend, color: "var(--red)" },
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
  const [repetir, setRepetir] = useState(false);
  const [moveDir, setMoveDir] = useState<"aDisponible" | "aAhorro">("aDisponible");
  // Comprobante adjunto (alta y edición) + visor de media (hook dedicado).
  const {
    file: comprobanteFile,
    preview: comprobantePreview,
    removed: comprobanteRemoved,
    viewer,
    setViewer,
    reset: resetComprobante,
    onSelect: onComprobanteSelect,
    clear: clearComprobante,
  } = useComprobante();
  const [chooserAnchor, setChooserAnchor] = useState<DOMRect | null>(null);
  // Errores de la persistencia en background (el alta es optimista: el sheet ya se cerró).
  // `bgError` = aviso transitorio (auto-cierra). `pendingReceipt` = comprobante que no
  // se pudo subir; toast FIJO con "Reintentar" que retiene el File (no se pierde la foto).
  const [bgError, setBgError] = useState<string | null>(null);
  const [pendingReceipt, setPendingReceipt] = useState<{ movId: string; file: File } | null>(null);
  useEffect(() => {
    if (!bgError || pendingReceipt) return;
    const id = setTimeout(() => setBgError(null), 4500);
    return () => clearTimeout(id);
  }, [bgError, pendingReceipt]);

  // Sube el comprobante y parchea la URL en el movimiento ya visible. Reintenta una vez;
  // si falla, deja el File pendiente para que el usuario reintente sin volver a elegirlo.
  const subirComprobante = async (movId: string, file: File) => {
    if (!user?.uid) return;
    setPendingReceipt(null);
    for (let intento = 1; intento <= 2; intento++) {
      try {
        const up = await uploadComprobante(user.uid, file);
        await actualizarMovimiento(user.uid, movId, { comprobanteUrl: up.url, comprobantePath: up.path });
        onUpdated?.(movId, { comprobanteUrl: up.url, comprobantePath: up.path });
        return;
      } catch (err) {
        if (intento === 2) { console.error("[comprobante] no se pudo subir", err); setPendingReceipt({ movId, file }); }
      }
    }
  };
  const [addError, setAddError] = useState("");
  // Sin autofocus en el monto: abrir el modal no debe levantar el teclado solo.

  // ── Edit state ──
  const [eMonto, setEMonto] = useState("");
  const [eDesc, setEDesc] = useState("");
  const [eMedio, setEMedio] = useState("");
  const [eObs, setEObs] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");

  // Plantillas de gasto frecuente (del DataProvider, se leen 1×/sesión).
  const [tplDelete, setTplDelete] = useState<Plantilla | null>(null);
  const [tplSavedFlash, setTplSavedFlash] = useState(false);

  const resetAdd = () => {
    setDescripcion(""); setMonto(""); setCategoria(""); setOrigenAhorro("");
    setCantidadUSD(""); setCotizManual(""); setObservaciones(""); setAddError("");
    setMontoARSInput(""); setModoCarga("USD"); setFecha(hoyISO()); setAbreNuevoPeriodo(false); setMoveDir("aDisponible"); setRepetir(false);
    resetComprobante();
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
      // Prefill del share target (best-effort): se aplica sobre el form ya reseteado.
      if (prefill && !reserveMode) {
        if (prefill.monto) setMonto(String(prefill.monto));
        if (prefill.descripcion) setDescripcion(prefill.descripcion);
      }
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
  }, [open, mode, movimiento?.id, initialView, prefill?.monto, prefill?.descripcion]);

  const aplicarPlantilla = (p: Plantilla) => {
    setTipo("Gasto");
    setCategoria(p.categoria);
    setMonto(String(p.monto));
    setDescripcion(p.nombre);
    setMedioPago(p.medioPago);
    setObservaciones(p.observaciones ?? "");
    if (user?.uid) {
      usarPlantilla(user.uid, p.id).then(() => {
        mutatePlantillas((prev) => {
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
    refreshPlantillas();
  };

  const confirmarBorrarPlantilla = async () => {
    if (!user?.uid || !tplDelete) return;
    await eliminarPlantilla(user.uid, tplDelete.id);
    mutatePlantillas((prev) => prev.filter((x) => x.id !== tplDelete.id));
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
  const esIngresoUSD = tipo === "IngresoUSD";
  const esIngresoEUR = tipo === "IngresoEUR";
  const esCompraFX = esCompraUSD || esCompraEUR;
  const esGastoFX = esGastoUSD || esGastoEUR;
  const esVentaFX = esVentaUSD || esVentaEUR;
  const esIngresoFX = esIngresoUSD || esIngresoEUR;
  // Compra y Venta usan el form con cotización (cantidad + cotización → ARS).
  // Gasto e Ingreso FX solo necesitan cantidad (suman/restan a la reserva, sin disponible ni cotización).
  const esCompraOVenta = esCompraFX || esVentaFX;
  const esSoloCantidadFX = esGastoFX || esIngresoFX;
  const esUSD = esCompraFX || esGastoFX || esVentaFX || esIngresoFX;
  const fxLabel = esCompraEUR || esGastoEUR || esVentaEUR || esIngresoEUR ? "EUR" : "USD";
  const tipoColor = TIPOS.find((tx) => tx.t === tipo)?.color ?? "var(--accent)";

  const categoriasFiltradas = tipo === "Gasto"
    ? (config?.categorias.filter((c) => c.tipo === "Gasto" && c.activa) ?? [])
    : tipo === "Ingreso"
    ? (sinPeriodos
       ? [{ id: "sueldo", nombre: "Sueldo", tipo: "Ingreso" as const, activa: true }]
       : [{ id: "sueldo", nombre: "Sueldo", tipo: "Ingreso" as const, activa: true },
          { id: "ahorros", nombre: "Ahorros", tipo: "Ingreso" as const, activa: true }])
    : [];

  const cotizActual = cotizManual ? parseFloat(cotizManual) : (fxLabel === "EUR" ? cotizacion?.oficial_euro : cotizacion?.oficial) ?? 0;
  const usdFinal = !esUSD ? 0 : esSoloCantidadFX
    ? parseFloat(cantidadUSD || "0")
    : modoCarga === "USD"
    ? parseFloat(cantidadUSD || "0")
    : (cotizActual ? parseFloat(montoARSInput || "0") / cotizActual : 0);
  const arsCompraUSD = !esCompraOVenta ? 0 : modoCarga === "USD"
    ? parseFloat(cantidadUSD || "0") * cotizActual
    : parseFloat(montoARSInput || "0");

  // Reserva FX actual (misma cuenta que Inversión): saldo base + compras − gastos/ventas.
  const reservaActualFX = useMemo(() => {
    if (!reserveMode) return 0;
    const base = (esEURMode ? config?.meta.saldoEUR : config?.meta.saldoUSD) ?? 0;
    return reservaFX(movimientos, esEURMode ? "EUR" : "USD", base);
  }, [reserveMode, esEURMode, movimientos, config?.meta.saldoUSD, config?.meta.saldoEUR]);

  // Frecuencia de uso por categoría de gasto (para ordenar las pills).
  const catUso = useMemo(() => {
    const m = new Map<string, number>();
    for (const mv of movimientos) {
      if (mv.tipo === "Gasto" && mv.categoria) m.set(mv.categoria, (m.get(mv.categoria) ?? 0) + 1);
    }
    return m;
  }, [movimientos]);

  // El dueño cobra sueldo mensual: su sueldo SIEMPRE abre período (sin elección),
  // igual que el primer sueldo. El resto de los usuarios eligen con el toggle.
  const isOwner = !!user?.email && user.email === process.env.NEXT_PUBLIC_OWNER_EMAIL;
  const forzarNuevoPeriodo = esSueldo && (sinPeriodos || isOwner);
  const abrePeriodo = esSueldo && (forzarNuevoPeriodo || abreNuevoPeriodo);

  const canSubmit = (!!periodoActual || abrePeriodo) && (
    esSoloCantidadFX ? usdFinal > 0 :
    esCompraOVenta ? usdFinal > 0 && arsCompraUSD > 0 :
    esMove ? parseFloat(monto || "0") > 0 :
    !!categoria && parseFloat(monto || "0") > 0
  );

  // Un sueldo que ABRE período (su fecha define el periodoId) es el ancla → no se puede
  // borrar (se chequea en el efecto de apertura). Un sueldo "sumado" al período sí.
  const isLocked = movimiento ? movimiento.tipo === "Ingreso" && movimiento.categoria === "Sueldo" : false;
  // Movimiento de reserva (FX): muestra cantidad + cotización en el detalle.
  const esFXMov = !!movimiento && ["CompraUSD", "GastoUSD", "CompraEUR", "GastoEUR", "VentaUSD", "VentaEUR", "IngresoUSD", "IngresoEUR"].includes(movimiento.tipo);
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
    // Validación síncrona: si algo falla, el sheet queda abierto con el error.
    if (!user?.uid) { setAddError(t.errNotAuth); return; }
    if (!esMove && !esUSD && !categoria) { setAddError(t.errSelectCat); return; }
    const montoFinal = esCompraOVenta ? arsCompraUSD : esSoloCantidadFX ? 0 : parseFloat(monto);
    if (!esSoloCantidadFX && (!montoFinal || montoFinal <= 0)) { setAddError(t.errInvalidAmount); return; }
    if (esUSD && (!usdFinal || usdFinal <= 0)) { setAddError(t.errInvalidFX(fxLabel)); return; }
    const periodoIdFinal = abrePeriodo ? fechaAPeriodoId(fecha) : (periodoActual?.periodoId ?? null);
    if (!periodoIdFinal) { setAddError(t.errNoActivePeriod); return; }

    const uid = user.uid;
    const now = new Date();
    const file = canComprobante ? comprobanteFile : null; // capturar antes del reset

    // Construir los movimientos con id pre-generado (se muestran YA; el comprobante se
    // parchea después de subirlo). main + eventual RESTO de cierre + eventual auto-ahorro.
    const created: Movimiento[] = [];
    const mainId = nuevoMovimientoId(uid);
    const mainData: Omit<Movimiento, "id"> = {
      timestampCarga: now, fecha, tipo,
      categoria: esMove ? "Move" : esUSD ? tipo : categoria,
      descripcion: esMove ? (moveDir === "aAhorro" ? "Move a ahorros" : "Move a disponible") : esCompraFX ? `Compra ${fxLabel}` : esGastoFX ? `Gasto ${fxLabel}` : esVentaFX ? `Venta ${fxLabel}` : esIngresoFX ? `Ingreso ${fxLabel}` : esAhorros ? (origenAhorro || descripcion.trim()) : descripcion.trim(),
      monto: montoFinal,
      medioPago: esMove || esCompraFX || esVentaFX ? "Mercado Pago" : esGastoFX || esIngresoFX ? "—" : medioPago,
      observaciones, periodoId: periodoIdFinal, userId: uid,
      ...(esMove ? { direccionMove: moveDir } : {}),
      ...(esAhorros && origenAhorro ? { origenAhorro } : {}),
      ...(esCompraOVenta ? { cantidadUSD: usdFinal, cotizacion: cotizActual } : {}),
      ...(esSoloCantidadFX ? { cantidadUSD: usdFinal } : {}),
    };
    created.push({ ...mainData, id: mainId });

    if (abrePeriodo && !sinPeriodos && periodoActual && periodoActual.disponible > 0) {
      // Cierre del período anterior: el disponible sobrante se arrastra como RESTO
      // (Move a ahorros; agruparPorPeriodo no lo resta del disponible del nuevo período).
      const restoData: Omit<Movimiento, "id"> = {
        timestampCarga: now, fecha, tipo: "Move", direccionMove: "aAhorro",
        categoria: "RESTO", descripcion: "Resto período anterior",
        monto: periodoActual.disponible,
        medioPago: "—", observaciones: `de ${periodoActual.periodoId}`,
        periodoId: periodoIdFinal, userId: uid,
      };
      created.push({ ...restoData, id: nuevoMovimientoId(uid) });
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
        periodoId: periodoIdFinal, userId: uid, direccionMove: "aAhorro",
      };
      created.push({ ...aaData, id: nuevoMovimientoId(uid) });
    }

    // Snapshot del recurrente antes del reset (usa estado del form).
    const recurrenteData = (repetir && (tipo === "Gasto" || tipo === "Ingreso") && categoria !== "Ahorros" && descripcion.trim())
      ? { descripcion: descripcion.trim(), categoria, tipo, monto: montoFinal }
      : null;

    // ── Optimista: mostrar y cerrar YA; persistir en background. ──
    buzz(30);
    resetAdd();
    if (onCreated) onCreated(created); else onChanged();
    onClose();

    (async () => {
      try {
        await Promise.all(created.map(({ id, ...data }) => crearMovimientoConId(uid, id, data)));
      } catch (err) {
        console.error("[handleAdd] fallo al persistir, revierto", err);
        buzz([40, 60, 40]);
        created.forEach((m) => onDeleted?.(m.id)); // rollback del alta optimista
        setBgError(t.errSaveFailed);
        return;
      }
      if (recurrenteData) upsertRecurrente(uid, recurrenteData).then(refreshRecurrentes).catch(() => {});
      // Comprobante: subir en background y parchear la URL (recuperable si falla).
      if (file) await subirComprobante(mainId, file);
    })();
  };

  const handleEdit = async () => {
    if (!user?.uid || !movimiento) return;
    setEditLoading(true); setEditError("");
    try {
      // Igual que el alta: sin esto, borrar el campo persiste NaN y rompe todos los KPIs.
      const montoEdit = parseFloat(eMonto);
      if (!montoEdit || montoEdit <= 0) throw new Error(t.errInvalidAmount);
      buzz(30); // sincrónico: la Vibration API solo dispara con user-activation viva (no post-await)
      const update: Partial<Movimiento> = { monto: montoEdit, observaciones: eObs, descripcion: eDesc.trim() };
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
    buzz(30); // sincrónico (antes del await) para que la vibración dispare
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
    const box: React.CSSProperties = { width: 38, height: 38, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, textDecoration: "none", border: "1px solid var(--border)", background: "var(--surface-alt)", color: "var(--muted)" };
    const thumbImg: React.CSSProperties = { width: 38, height: 38, borderRadius: 8, objectFit: "cover", border: "1px solid var(--border)", display: "block" };
    // Hit-area de 32px (accesible) con el badge rojo de 18px centrado en la esquina.
    const removeHit: React.CSSProperties = { position: "absolute", top: -12, right: -12, width: 32, height: 32, background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" };
    const removeGlyph: React.CSSProperties = { width: 18, height: 18, borderRadius: "50%", background: "var(--red)", color: "#fff", border: "1.5px solid var(--bg)", fontSize: 11, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" };
    const pdfIcon = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>;
    const newIsPdf = comprobanteFile?.type === "application/pdf";
    const existingIsPdf = !!movimiento?.comprobantePath && movimiento.comprobantePath.toLowerCase().endsWith(".pdf");
    const showExisting = !!existingUrl && !comprobanteRemoved && !comprobantePreview;
    if (comprobantePreview) {
      return (
        <div style={{ position: "relative", flexShrink: 0 }}>
          {newIsPdf
            ? <button type="button" onClick={() => setViewer({ src: comprobantePreview, isPdf: true })} style={{ ...box, cursor: "pointer" }}>{pdfIcon}</button>
            : <button type="button" onClick={() => setViewer({ src: comprobantePreview, isPdf: false })} style={{ padding: 0, border: "none", background: "none", cursor: "pointer" }}><img src={comprobantePreview} alt="" style={thumbImg} /></button>}
          <button type="button" onClick={clearComprobante} aria-label={t.removeReceipt} style={removeHit}><span style={removeGlyph}>×</span></button>
        </div>
      );
    }
    if (showExisting) {
      return (
        <div style={{ position: "relative", flexShrink: 0 }}>
          {existingIsPdf
            ? <button type="button" onClick={() => setViewer({ src: existingUrl!, isPdf: true })} style={{ ...box, cursor: "pointer" }}>{pdfIcon}</button>
            : <button type="button" onClick={() => setViewer({ src: existingUrl!, isPdf: false })} style={{ padding: 0, border: "none", background: "none", cursor: "pointer" }}><img src={existingUrl} alt="" style={thumbImg} /></button>}
          <button type="button" onClick={clearComprobante} aria-label={t.removeReceipt} style={removeHit}><span style={removeGlyph}>×</span></button>
        </div>
      );
    }
    return (
      <button type="button" aria-label={t.attachReceipt} title={t.attachReceipt} onClick={(e) => setChooserAnchor(e.currentTarget.getBoundingClientRect())}
        style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 46, height: 46, color: "var(--muted)", cursor: "pointer", flexShrink: 0, background: "none", border: "none", padding: 0 }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
      </button>
    );
  };

  return (
    <>
    <Sheet open={open && view !== "delete" && !readOnly} onClose={onClose} title={title}>
      {/* ADD */}
      {mode === "add" && (
        <form onSubmit={handleAdd}>
          {reserveMode ? (
            /* Reserva: TIPO a todo el ancho (Compra/Ingreso verdes, Venta/Gasto rojos). */
            <div style={{ marginBottom: 16 }}>
              <div className="label">{t.type}</div>
              <div style={{ display: "flex", gap: 5 }}>
                {TIPOS.map(({ t: tt, label, color }) => (
                  <button key={tt} type="button" onClick={() => { setTipo(tt); resetAdd(); }}
                    className="pill" style={{
                      flex: 1, minWidth: 0, height: 42, padding: "0 4px", fontSize: 12,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      borderColor: tipo === tt ? color : "var(--border)",
                      background: tipo === tt ? color + "22" : "transparent",
                      color: tipo === tt ? color : "var(--muted)",
                    }}>{label}</button>
                ))}
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
                    <button key={tt} type="button" onClick={() => { setTipo(tt); resetAdd(); if (sinPeriodos) setCategoria("Sueldo"); }}
                      className="pill" style={sel && isMove ? {
                        border: "1px solid transparent",
                        backgroundImage: "linear-gradient(var(--surface), var(--surface)), linear-gradient(90deg, var(--teal), var(--purple))",
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
                {([["aDisponible", t.moveDirToDisponible], ["aAhorro", t.moveDirToAhorro]] as const).map(([d, label]) => {
                  const dc = d === "aAhorro" ? "var(--purple)" : "var(--teal)";
                  const dd = d === "aAhorro" ? "var(--purple-dim)" : "var(--teal-dim)";
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
                const ac = moveDir === "aAhorro" ? "var(--purple)" : "var(--teal)";
                const ad = moveDir === "aAhorro" ? "var(--purple-dim)" : "var(--teal-dim)";
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
              <div style={{ display: "flex", gap: 6, flexWrap: "nowrap", overflowX: "auto", paddingBottom: 2, scrollbarWidth: "none" }}>
                {[...categoriasFiltradas].sort((a, b) => (catUso.get(b.nombre) ?? 0) - (catUso.get(a.nombre) ?? 0)).map((c) => (
                  <button key={c.nombre} type="button" onClick={() => setCategoria(c.nombre)}
                    className="pill" style={{
                      flexShrink: 0,
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
                  <div className="label">{t.date}</div>
                  <input className="input" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
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
                  <div className="label">{t.exchangeRate}</div>
                  <input className="input" type="number" value={cotizManual || String((fxLabel === "EUR" ? cotizacion?.oficial_euro : cotizacion?.oficial) ?? "")} onChange={(e) => setCotizManual(e.target.value)} placeholder="0" />
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
                    <> · {t.remaining}: <span style={{ fontFamily: "var(--font-mono)", color: "var(--green)" }}>{money(periodoActual.disponible + arsCompraUSD)}</span></>
                  )}
                  {arsCompraUSD > 0 && esCompraFX && (() => {
                    const ratio = periodoActual.disponible > 0 ? arsCompraUSD / periodoActual.disponible : 1;
                    const restoColor = ratio < 0.30 ? "var(--green)" : ratio <= 0.70 ? "var(--yellow)" : "var(--red)";
                    return <> · {t.remaining}: <span style={{ fontFamily: "var(--font-mono)", color: restoColor }}>{money(periodoActual.disponible - arsCompraUSD)}</span></>;
                  })()}
                </div>
              )}
            </div>
          )}

          {esSoloCantidadFX && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                <div>
                  <div className="label">{esIngresoFX ? t.fxAmountReceived(fxLabel) : t.fxAmountSpent(fxLabel)}</div>
                  <input className="input" type="number" value={cantidadUSD} onChange={(e) => setCantidadUSD(e.target.value)} placeholder="0" style={{ fontFamily: "var(--font-mono)" }} />
                </div>
                <div>
                  <div className="label">{t.date}</div>
                  <input className="input" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
                </div>
              </div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 8 }}>
                {t.reserve}: <span style={{ fontFamily: "var(--font-mono)" }}>{fxLabel} {reservaActualFX.toFixed(2)}</span>
                {usdFinal > 0 && (esIngresoFX
                  ? <> · {t.remaining}: <span style={{ fontFamily: "var(--font-mono)", color: "var(--green)" }}>{fxLabel} {(reservaActualFX + usdFinal).toFixed(2)}</span></>
                  : (() => {
                      const queda = reservaActualFX - usdFinal;
                      const ratio = reservaActualFX > 0 ? usdFinal / reservaActualFX : 1;
                      const color = ratio < 0.30 ? "var(--green)" : ratio <= 0.70 ? "var(--yellow)" : "var(--red)";
                      return <> · {t.remaining}: <span style={{ fontFamily: "var(--font-mono)", color }}>{fxLabel} {queda.toFixed(2)}</span></>;
                    })())}
              </div>
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
              <button type="submit" disabled={!canSubmit} aria-label={t.save} style={{
                width: 52, height: 52, borderRadius: "50%",
                background: canSubmit ? "var(--green)" : "transparent",
                border: `2px solid ${canSubmit ? "var(--green)" : "var(--border)"}`,
                color: canSubmit ? "var(--bg)" : "var(--border)",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: canSubmit ? "pointer" : "default",
                transition: "background 0.2s, border-color 0.2s, color 0.2s",
                boxShadow: canSubmit ? "0 4px 20px var(--green)55" : "none",
              }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
            </div>
          </div>

          {!esMove && !esUSD && !esAhorros && (
            <button type="button" onClick={() => setRepetir((v) => !v)} style={{
              marginTop: 16, display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "9px 11px",
              background: repetir ? "var(--accent-dim)" : "transparent",
              border: `1px solid ${repetir ? "var(--accent)" : "var(--border)"}`, borderRadius: "var(--radius-sm)",
              color: repetir ? "var(--accent)" : "var(--muted)", cursor: "pointer", fontSize: 13, textAlign: "left",
            }}>
              <span style={{ width: 16, height: 16, flexShrink: 0, borderRadius: 4, border: `1px solid ${repetir ? "var(--accent)" : "var(--border-hi)"}`, background: repetir ? "var(--accent)" : "transparent" }} />
              {t.repeatEachPeriod}
            </button>
          )}
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
                {/* Misma lista que el alta (medios del usuario); el medio actual del
                    movimiento se muestra aunque esté desactivado, para no perderlo. */}
                {[...new Set([...(config?.mediosPago.filter((m) => m.activo).map((m) => m.nombre) ?? []), ...(eMedio ? [eMedio] : [])])].map((m) => (
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
                ? <Loader size={20} />
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
    <ComprobanteChooser anchor={chooserAnchor} onClose={() => setChooserAnchor(null)} onSelect={onComprobanteSelect} />
    {viewer && <MediaViewer src={viewer.src} isPdf={viewer.isPdf} onClose={() => setViewer(null)} />}
    {(pendingReceipt || bgError) && (
      <div role="alert" style={{
        position: "fixed", left: "50%", transform: "translateX(-50%)",
        bottom: "calc(var(--nav-h) + env(safe-area-inset-bottom, 0px) + 16px)", zIndex: 300,
        display: "flex", alignItems: "center", gap: 12,
        background: "var(--red-dim)", color: "var(--red)", border: "1px solid var(--red)",
        borderRadius: 12, padding: "10px 14px", fontSize: 13, fontWeight: 600,
        boxShadow: "0 6px 24px rgba(0,0,0,0.3)", maxWidth: "92%",
      }}>
        <span>{pendingReceipt ? t.errReceiptFailed : bgError}</span>
        {pendingReceipt && (
          <button onClick={() => subirComprobante(pendingReceipt.movId, pendingReceipt.file)}
            style={{ background: "var(--red)", color: "#fff", border: "none", borderRadius: 8, padding: "5px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>{t.retry}</button>
        )}
        <button onClick={() => { setPendingReceipt(null); setBgError(null); }} aria-label={t.cancel}
          style={{ background: "none", border: "none", color: "var(--red)", fontSize: 18, lineHeight: 1, cursor: "pointer", padding: 0, flexShrink: 0 }}>×</button>
      </div>
    )}
    </>
  );
}
