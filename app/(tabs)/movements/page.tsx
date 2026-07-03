"use client";

import { useState, useMemo, useEffect } from "react";
import { useData } from "../data-context";
import { agruparPorPeriodo, fechaCorta } from "@/utils/periodo";
import { useMoney } from "@/hooks/useHideValues";
import { useHideOnScroll } from "@/hooks/useHideOnScroll";
import { Movimiento, TipoMovimiento } from "@/types";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { EyeIcon } from "@/components/ui/EyeIcon";
import { MovementModal } from "@/components/movements/MovementModal";
import { useLongPress } from "@/hooks/useLongPress";
import { useT } from "@/hooks/useTranslation";
import { useFirstVisit } from "@/hooks/useFirstVisit";
import { SectionHint } from "@/components/ui/SectionHint";
import { PageTitle } from "@/components/ui/PageTitle";
import { APP_GRAD_DIM, appGradText } from "@/components/ui/gradients";

function TipoDot({ tipo, categoria, direccionMove }: { tipo: TipoMovimiento; categoria: string; direccionMove?: string }) {
  let c = "var(--muted)";
  if (categoria === "RESTO") c = "var(--blue)"; // arrastre a ahorros (Ingreso viejo o Move nuevo)
  else if (tipo === "CompraUSD" || tipo === "CompraEUR" || tipo === "VentaUSD" || tipo === "VentaEUR") c = "var(--yellow)";
  else if (tipo === "Gasto") c = "var(--red)";
  else if (tipo === "Move") c = direccionMove === "aAhorro" ? "var(--purple)" : "var(--teal)";
  else if (tipo === "Ingreso") {
    if (categoria === "Ahorros") c = "var(--blue)";
    else c = "var(--green)";
  }
  return <div style={{ width: 8, height: 8, borderRadius: "50%", background: c, flexShrink: 0, marginTop: 5 }} />;
}

export default function MovimientosPage() {
  const { oculto, toggle, m: money } = useMoney();
  const { movimientos, loading, refresh, config, updateMovimiento, removeMovimiento, prependMovimiento, recurrentes } = useData();
  const t = useT();

  // Recurrentes activos → para marcar con un relojito los movimientos que matchean.
  const recurrenteKeys = useMemo(
    () => new Set(recurrentes.filter((r) => r.activo).map((r) => `${r.tipo}__${r.categoria}__${(r.descripcion || "").trim().toLowerCase()}`)),
    [recurrentes]
  );
  const esRecurrente = (m: Movimiento) => recurrenteKeys.has(`${m.tipo}__${m.categoria}__${(m.descripcion || "").trim().toLowerCase()}`);
  const [showHint, dismissHint] = useFirstVisit("movements");

  const periodos = agruparPorPeriodo(movimientos);
  const años = useMemo(() => Array.from(new Set(periodos.map((p) => p.periodoId.split("/")[2] ?? ""))).filter(Boolean), [periodos]);
  const [añoSel, setAñoSel] = useState<string>("");
  const añoActivo = añoSel || años[0] || "";
  const pillSel: React.CSSProperties = { border: "1px solid transparent", background: APP_GRAD_DIM };
  const pillOff: React.CSSProperties = { border: "1px solid var(--border)", background: "transparent", color: "var(--muted)" };
  const pillGradText: React.CSSProperties = appGradText;
  const periodosDelAño = useMemo(() => periodos.filter((p) => (p.periodoId.split("/")[2] ?? "") === añoActivo), [periodos, añoActivo]);
  const [periodoSel, setPeriodoSel] = useState<string | null>(null);
  const activePeriodoId = periodoSel ?? periodosDelAño[0]?.periodoId;
  const periodoActual = periodos.find((p) => p.periodoId === activePeriodoId);

  // Modal de alta/edición (componente compartido). `view` permite abrir directo en borrado.
  const [modalState, setModalState] = useState<{ mode: "add" | "edit"; mov?: Movimiento; view?: "form" | "delete" } | null>(null);
  const openAdd = () => setModalState({ mode: "add" });
  const openEdit = (m: Movimiento) => setModalState({ mode: "edit", mov: m });
  const bindLongPress = useLongPress();

  // Si llegamos con ?m=<id> (desde el dashboard), abrir ese movimiento para editar.
  useEffect(() => {
    if (loading || movimientos.length === 0) return;
    const id = new URLSearchParams(window.location.search).get("m");
    if (!id) return;
    const mov = movimientos.find((x) => x.id === id);
    if (mov) openEdit(mov);
    window.history.replaceState(null, "", "/movements");
  }, [loading, movimientos]);

  // Fade del botón flotante: se oculta mientras se navega (scroll) y reaparece
  // al detenerse, para no tapar la lista mientras la recorrés.
  const btnVisible = useHideOnScroll();

  const movsFiltrados = useMemo(() =>
    [...(periodoActual?.movimientos ?? [])]
      .filter((m) => m.tipo !== "GastoUSD" && m.tipo !== "GastoEUR" && m.tipo !== "IngresoUSD" && m.tipo !== "IngresoEUR")
      .sort((a, b) => {
        const d = b.fecha.localeCompare(a.fecha);
        if (d !== 0) return d;
        const tt = b.timestampCarga.getTime() - a.timestampCarga.getTime();
        if (tt !== 0) return tt;
        // Mismo instante (apertura de período): el Sueldo es el ancla → siempre el más
        // viejo (abajo de todo), determinístico entre dispositivos.
        const aSueldo = a.tipo === "Ingreso" && a.categoria === "Sueldo";
        const bSueldo = b.tipo === "Ingreso" && b.categoria === "Sueldo";
        if (aSueldo && !bSueldo) return 1;
        if (bSueldo && !aSueldo) return -1;
        return 0;
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

  // Días colapsables: para evitar el scroll infinito, solo el día más reciente
  // arranca abierto; el resto se muestra como resumen (total + nº) y se abren al tocar.
  const [diasAbiertos, setDiasAbiertos] = useState<Set<string>>(new Set());
  useEffect(() => {
    setDiasAbiertos(new Set(movsPorFecha[0] ? [movsPorFecha[0].fecha] : []));
    // Solo al cambiar de período/año: no resetear al editar para no cerrar lo que abriste.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePeriodoId]);
  const toggleDia = (fecha: string) => setDiasAbiertos((prev) => {
    const next = new Set(prev);
    next.has(fecha) ? next.delete(fecha) : next.add(fecha);
    return next;
  });

  return (
    <>
    <div className="page">

      {loading ? (
        <LoadingSpinner />
      ) : (
        <div className="fade-up">
          <div style={{ marginBottom: 20 }}>
            <PageTitle>{t.pageTitleMovements}</PageTitle>
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

          {showHint && movimientos.length > 0 && <SectionHint title={t.hintMovTitle} body={t.hintMovBody} onDismiss={dismissHint} />}

          <div style={{ display: "flex", gap: 4, marginBottom: 8, overflowX: "auto", scrollbarWidth: "none", touchAction: "pan-x" }}>
            {años.map((año) => {
              const sel = añoActivo === año;
              return (
              <button key={año} onClick={() => { setAñoSel(año); setPeriodoSel(null); }} style={{
                flexShrink: 0, padding: "4px 12px", borderRadius: 999, fontSize: 10, fontWeight: 700, cursor: "pointer",
                transition: "all 0.15s", ...(sel ? pillSel : pillOff),
              }}>{sel ? <span style={pillGradText}>{año}</span> : año}</button>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 16, paddingBottom: 2, scrollbarWidth: "none", touchAction: "pan-x" }}>
            {periodosDelAño.map((p) => {
              const isSelected = activePeriodoId === p.periodoId;
              const [d, m] = p.periodoId.split("/");
              return (
                <button key={p.periodoId} onClick={() => setPeriodoSel(p.periodoId)} style={{
                  flexShrink: 0, padding: "4px 12px", borderRadius: 999, fontSize: 10, fontWeight: 700, cursor: "pointer",
                  transition: "all 0.15s", ...(isSelected ? pillSel : pillOff),
                }}>{isSelected ? <span style={pillGradText}>{d}/{m}</span> : `${d}/${m}`}</button>
              );
            })}
          </div>

          {movsFiltrados.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: 32, color: "var(--muted)", fontSize: 13 }}>
              {t.noMovementsAdd}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {movsPorFecha.map(({ fecha, movs }, idx) => {
                // El día más reciente siempre abierto; el resto colapsa a un resumen (fecha + total).
                const abierto = idx === 0 ? true : diasAbiertos.has(fecha);
                // Conteo por tipo para el resumen colapsado. Orden de izq→der:
                // ingreso (verde), usd/dólares (amarillo), move (amarillo), gasto (rojo, a la derecha).
                let nGasto = 0, nMoveAhorro = 0, nMoveDisp = 0, nUsd = 0, nIngreso = 0;
                for (const m of movs) {
                  if (m.tipo === "Gasto") nGasto++;
                  else if (m.tipo === "Move") {
                    if (m.direccionMove === "aAhorro") nMoveAhorro++;
                    else nMoveDisp++;
                  }
                  else if (m.tipo === "Ingreso") nIngreso++;
                  else nUsd++;
                }
                return (
                <div key={fecha} className="card" style={{ padding: 0, overflow: "hidden", background: "linear-gradient(135deg, var(--surface), var(--surface-alt))" }}>
                  <button onClick={() => { if (idx !== 0) toggleDia(fecha); }} style={{
                    width: "100%", background: "none", cursor: idx === 0 ? "default" : "pointer",
                    display: "flex", alignItems: "center", gap: 10, padding: "12px 14px",
                    border: "none", borderBottom: abierto ? "1px solid var(--faint)" : "none",
                  }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", letterSpacing: 0.3 }}>{fechaCorta(fecha)}</span>
                    {!abierto && (
                      <span style={{ flex: 1, display: "flex", justifyContent: "flex-end", gap: 10, fontSize: 12, fontWeight: 700, fontFamily: "var(--font-mono)" }}>
                        {nIngreso > 0 && <span style={{ color: "var(--green)" }}>{nIngreso}</span>}
                        {nUsd > 0 && <span style={{ color: "var(--yellow)" }}>{nUsd}</span>}
                        {nMoveDisp > 0 && <span style={{ color: "var(--teal)" }}>{nMoveDisp}</span>}
                        {nMoveAhorro > 0 && <span style={{ color: "var(--purple)" }}>{nMoveAhorro}</span>}
                        {nGasto > 0 && <span style={{ color: "var(--red)" }}>{nGasto}</span>}
                      </span>
                    )}
                  </button>
                  {abierto && (
                  <>
                    {movs.map((m, i) => {
                      const isCompraFX = m.tipo === "CompraUSD" || m.tipo === "CompraEUR";
                      const isVentaFX = m.tipo === "VentaUSD" || m.tipo === "VentaEUR";
                      const isFX = isCompraFX || isVentaFX; // divisa → color amarillo
                      const isGasto = m.tipo === "Gasto";
                      const isMove = m.tipo === "Move";
                      const esResto = m.categoria === "RESTO"; // arrastre a ahorros: azul y "+"
                      const negativo = !esResto && (isGasto || isCompraFX || (isMove && m.direccionMove === "aAhorro"));
                      return (
                        <button key={m.id}
                          {...bindLongPress(() => setModalState({ mode: "edit", mov: m, view: "delete" }), () => openEdit(m))}
                          aria-label={t.edit} style={{
                          width: "100%", textAlign: "left", background: "none", cursor: "pointer",
                          display: "flex", alignItems: "flex-start", gap: 10, padding: "13px 14px",
                          border: "none", borderBottom: i < movs.length - 1 ? "1px solid var(--faint)" : "none",
                          WebkitTouchCallout: "none", WebkitUserSelect: "none", userSelect: "none",
                        }}>
                          <TipoDot tipo={m.tipo} categoria={m.categoria} direccionMove={m.direccionMove} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "flex", alignItems: "center", gap: 5 }}>
                              <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{m.descripcion || m.categoria}</span>
                              {esRecurrente(m) && (
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }} aria-label={t.recurrentsTitle}><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg>
                              )}
                            </div>
                            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                              {m.categoria}{m.observaciones && <span style={{ fontStyle: "italic" }}> · {m.observaciones.toLowerCase()}</span>}
                            </div>
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 700, color: esResto ? "var(--blue)" : isFX ? "var(--yellow)" : isGasto ? "var(--red)" : isMove ? (m.direccionMove === "aAhorro" ? "var(--purple)" : "var(--teal)") : "var(--green)", fontFamily: "var(--font-mono)", flexShrink: 0, marginTop: 1 }}>
                            {negativo ? "-" : "+"}{money(m.monto)}
                          </span>
                        </button>
                      );
                    })}
                  </>
                  )}
                </div>
                );
              })}
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

    <MovementModal
      open={modalState !== null}
      mode={modalState?.mode ?? "add"}
      movimiento={modalState?.mov ?? null}
      movimientos={movimientos}
      config={config}
      activePeriodoId={activePeriodoId}
      initialView={modalState?.view}
      onClose={() => setModalState(null)}
      onChanged={refresh}
      onCreated={prependMovimiento}
      onUpdated={updateMovimiento}
      onDeleted={removeMovimiento}
    />
    </>
  );
}
