"use client";

import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useCotizacion } from "@/hooks/useCotizacion";
import { useAppPrefs } from "@/hooks/useAppPrefs";
import { useMoney } from "@/hooks/useHideValues";
import { useT } from "@/hooks/useTranslation";
import { crearMovimiento, actualizarMovimiento, eliminarMovimiento } from "@/services/firebase/movimientos";
import { agruparPorPeriodo, formatARS, fechaCorta } from "@/utils/periodo";
import { serieTendencia } from "@/utils/reportes";
import { Movimiento, TipoMovimiento, ConfigUsuario } from "@/types";

const TrashIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
    <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);

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
  onClose: () => void;
  /** Avisar al padre para que refresque sus datos tras alta/edición/borrado. */
  onChanged: () => void;
}

// Modal de alta/edición/borrado de movimientos, reutilizable (Movimientos, Inicio).
export function MovementModal({ open, mode, movimiento, movimientos, config, activePeriodoId, onClose, onChanged }: MovementModalProps) {
  const { user } = useAuth();
  const { cotizacion } = useCotizacion();
  const { monedaInversiones, monedaPrincipal } = useAppPrefs();
  const { m: money } = useMoney();
  const t = useT();

  const monedaInversionesEfectiva: "USD" | "EUR" =
    monedaPrincipal === "USD" ? "EUR" : monedaPrincipal === "EUR" ? "USD" : monedaInversiones;
  const esEURMode = monedaInversionesEfectiva === "EUR";

  const TIPOS: { t: TipoMovimiento; label: string; color: string }[] = [
    { t: "Gasto", label: t.tipoDisplay["Gasto"], color: "var(--red)" },
    { t: "Ingreso", label: t.tipoDisplay["Ingreso"], color: "var(--green)" },
    { t: "Move", label: t.tipoDisplay["Move"], color: "var(--yellow)" },
    { t: esEURMode ? "CompraEUR" : "CompraUSD", label: esEURMode ? "+EUR" : "+USD", color: "var(--yellow)" },
    { t: esEURMode ? "GastoEUR" : "GastoUSD", label: esEURMode ? "-EUR" : "-USD", color: "var(--yellow)" },
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
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState("");

  // ── Edit state ──
  const [eMonto, setEMonto] = useState("");
  const [eDesc, setEDesc] = useState("");
  const [eMedio, setEMedio] = useState("");
  const [eObs, setEObs] = useState("");
  const [editLoading, setEditLoading] = useState(false);

  const resetAdd = () => {
    setDescripcion(""); setMonto(""); setCategoria(""); setOrigenAhorro("");
    setCantidadUSD(""); setCotizManual(""); setObservaciones(""); setAddError("");
    setMontoARSInput(""); setModoCarga("USD"); setFecha(hoyISO()); setAbreNuevoPeriodo(false); setMoveDir("aDisponible");
  };

  // Inicializar al abrir según el modo.
  useEffect(() => {
    if (!open) return;
    setView("form");
    if (mode === "add") {
      resetAdd();
      if (sinPeriodos) { setTipo("Ingreso"); setCategoria("Sueldo"); }
      else setTipo("Gasto");
    } else if (mode === "edit" && movimiento) {
      setEMonto(String(movimiento.monto));
      setEDesc(movimiento.descripcion || (movimiento as Movimiento & { origenAhorro?: string }).origenAhorro || "");
      setEMedio(movimiento.medioPago ?? "");
      setEObs(movimiento.observaciones ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, movimiento?.id]);

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

  const isLocked = movimiento ? movimiento.tipo === "Ingreso" && movimiento.categoria === "Sueldo" : false;
  // Un sueldo que ABRE período (su fecha define el periodoId) es el ancla → no se
  // puede borrar. Un sueldo "sumado" al período en curso sí es borrable.
  const esAperturaPeriodo = isLocked && !!movimiento && fechaAPeriodoId(movimiento.fecha) === movimiento.periodoId;
  const isDirtyEdit = !!movimiento && (
    eMonto !== String(movimiento.monto) ||
    eDesc !== (movimiento.descripcion ?? "") ||
    eMedio !== (movimiento.medioPago ?? "") ||
    eObs !== (movimiento.observaciones ?? "")
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
      await crearMovimiento(user.uid, {
        timestampCarga: new Date(), fecha, tipo,
        categoria: esMove ? "Move" : esCompraFX ? tipo : esGastoFX ? tipo : categoria,
        descripcion: esMove ? (moveDir === "aAhorro" ? "Move a ahorros" : "Move a disponible") : esCompraFX ? `Compra ${fxLabel}` : esGastoFX ? `Gasto ${fxLabel}` : esAhorros ? (origenAhorro || descripcion.trim()) : descripcion.trim(),
        monto: montoFinal,
        medioPago: esMove || esCompraFX ? "Mercado Pago" : esGastoFX ? "—" : medioPago,
        observaciones, periodoId: periodoIdFinal, userId: user.uid,
        ...(esMove ? { direccionMove: moveDir } : {}),
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
      onChanged(); onClose();
    } catch (err) { console.error(err); }
    finally { setEditLoading(false); }
  };

  const title = mode === "add" ? t.newMovement : view === "delete" ? t.delete : t.editMovement;

  return (
    <Sheet open={open} onClose={onClose} title={title}>
      {/* ADD */}
      {mode === "add" && (
        <form onSubmit={handleAdd}>
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
              <div className="label">{t.addTo}</div>
              <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
                {([fxLabel, "ARS"] as const).map((mo) => (
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
                {cotizacion ? (["oficial", "blue"] as const).map((rt) => {
                  const val = esCompraEUR
                    ? (rt === "oficial" ? cotizacion.oficial_euro : cotizacion.blue_euro) ?? cotizacion[rt]
                    : cotizacion[rt];
                  return (
                    <button key={rt} type="button" onClick={() => setCotizManual(String(val))}
                      className="pill" style={{
                        borderColor: (cotizManual === String(val) || (!cotizManual && rt === "oficial")) ? "var(--yellow)" : "var(--border)",
                        background: (cotizManual === String(val) || (!cotizManual && rt === "oficial")) ? "var(--yellow-dim)" : "transparent",
                        color: (cotizManual === String(val) || (!cotizManual && rt === "oficial")) ? "var(--yellow)" : "var(--muted)",
                      }}>{rt} ${val.toLocaleString("es-AR")}</button>
                  );
                }) : <span style={{ fontSize: 12, color: "var(--muted)" }}>{t.noExchangeRate}</span>}
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
                  <input className="input" type="number" value={cotizManual || String(cotizacion?.oficial ?? "")} onChange={(e) => setCotizManual(e.target.value)} placeholder="0" />
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
              <input className="input" type="text" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
            </div>
          )}
          {!esUSD && (
            <div style={{ marginBottom: 14 }}>
              <div className="label">{t.amount}</div>
              <input className="input" style={{ fontFamily: "var(--font-mono)" }} type="number" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="0" />
            </div>
          )}
          <div style={{ marginBottom: 14 }}>
            <div className="label">{t.date}</div>
            <input className="input" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
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
          <div style={{ marginBottom: 20 }}>
            <div className="label">{t.notesOptional}</div>
            <input className="input" type="text" value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
          </div>

          {tipo === "Gasto" && config?.meta.autoAhorro?.activo && (config.meta.autoAhorro.monto ?? 0) > 0 &&
           (!config.meta.autoAhorro.mediosPago?.length || config.meta.autoAhorro.mediosPago.includes(medioPago)) && (
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
                : <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
            </button>
          </div>
        </form>
      )}

      {/* EDIT */}
      {mode === "edit" && movimiento && view === "form" && (
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
            {[{ l: t.type, v: movimiento.tipo }, { l: t.category, v: movimiento.categoria }, { l: t.date, v: fechaCorta(movimiento.fecha) }].map((f) => (
              <div key={f.l} style={{ background: "var(--surface-alt)", borderRadius: "var(--radius-sm)", padding: "6px 12px" }}>
                <div style={{ fontSize: 9, color: "var(--muted)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 2 }}>{f.l}</div>
                <div style={{ fontSize: 12, fontWeight: 600 }}>{f.v}</div>
              </div>
            ))}
          </div>

          {/* Descripción y monto siempre editables (también en Sueldo). */}
          <div style={{ marginBottom: 14 }}>
            <div className="label">{t.description}</div>
            <input className="input" value={eDesc} onChange={(e) => setEDesc(e.target.value)} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <div className="label">{t.amount}</div>
            <input className="input" style={{ fontFamily: "var(--font-mono)" }} type="number" value={eMonto} onChange={(e) => setEMonto(e.target.value)} />
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
          <div style={{ marginBottom: 24 }}>
            <div className="label">{t.notes}</div>
            <input className="input" value={eObs} onChange={(e) => setEObs(e.target.value)} />
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
            {!esAperturaPeriodo && (
              <button onClick={() => setView("delete")} aria-label={t.delete} style={{ position: "absolute", right: 0, background: "none", border: "none", color: "var(--red)", cursor: "pointer", padding: 8 }}>
                <TrashIcon />
              </button>
            )}
          </div>
        </>
      )}

      {/* DELETE */}
      {mode === "edit" && movimiento && view === "delete" && (
        <div style={{ textAlign: "center", paddingTop: 8 }}>
          <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 8 }}>{t.deleteMovementTitle}</div>
          <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>{movimiento.descripcion || movimiento.categoria}</div>
          <div style={{ fontSize: 18, color: "var(--red)", fontFamily: "var(--font-mono)", fontWeight: 700, marginBottom: 10 }}>
            {money(movimiento.monto)}
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 24 }}>{t.actionIrreversible}</div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setView("form")} className="btn btn-ghost" style={{ flex: 1 }}>{t.cancel}</button>
            <button onClick={handleDelete} disabled={editLoading} className="btn btn-danger" style={{ flex: 1 }}>
              {editLoading ? "..." : t.yesDelete}
            </button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
