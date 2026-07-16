"use client";

import { useState, useMemo, useEffect } from "react";
import { useData } from "../data-context";
import { agruparPorPeriodo, fechaCorta } from "@/utils/periodo";
import { movMatchesAny } from "@/utils/search";
import { recurrentKey } from "@/utils/recurrent-key";
import { useMoney } from "@/hooks/useHideValues";
import { useHideOnScroll } from "@/hooks/useHideOnScroll";
import { Movimiento, TipoMovimiento } from "@/types";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { EyeIcon } from "@/components/ui/EyeIcon";
import { MovementModal } from "@/components/movements/MovementModal";
import { MovementsFilter } from "@/components/movements/MovementsFilter";
import { useT } from "@/hooks/useTranslation";
import { useHint } from "@/hooks/useHint";
import { SectionHint } from "@/components/ui/SectionHint";
import { SwipeToDelete } from "@/components/ui/SwipeToDelete";
import { PageHeader } from "@/components/ui/PageHeader";
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
  const { movimientos, loading, refresh, config, updateMovimiento, removeMovimiento, prependMovimiento, recurrentes, recurrentesLoaded } = useData();
  const t = useT();

  // Recurrentes activos → para marcar con un relojito los movimientos que matchean.
  // La clave incluye la observación (recurrentKey, la MISMA que usan el doc id y el cron):
  // "Steam·eso+" y "Steam·eso pass" son recurrentes distintos, así que un movimiento solo
  // se marca si coincide TAMBIÉN la observación.
  const recurrenteKeys = useMemo(
    () => new Set(recurrentes.filter((r) => r.activo).map((r) => recurrentKey(r))),
    [recurrentes]
  );
  const esRecurrente = (m: Movimiento) => recurrenteKeys.has(recurrentKey(m));
  const [showHint, dismissHint] = useHint("swipeRow");

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

  // Filtro in-place (lupa): términos que acotan la lista al período SELECCIONADO. El popup
  // se abre desde la lupa del header y filtra sin navegar a otra pantalla.
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterTerms, setFilterTerms] = useState<string[]>([]);
  const filterActivo = filterTerms.length > 0;

  // Modal de alta/edición (componente compartido). `view` permite abrir directo en borrado.
  const [modalState, setModalState] = useState<{ mode: "add" | "edit"; mov?: Movimiento; view?: "form" | "delete"; prefill?: { tipo?: "Gasto" | "Ingreso"; categoria?: string; descripcion?: string; observaciones?: string } } | null>(null);
  const openAdd = () => setModalState({ mode: "add" });
  const openEdit = (m: Movimiento) => setModalState({ mode: "edit", mov: m });

  // Realce breve del movimiento recién cargado (feedback visual del guardado).
  const [flashIds, setFlashIds] = useState<Set<string>>(new Set());
  const handleCreated = (movs: Movimiento[]) => {
    prependMovimiento(movs);
    setFlashIds(new Set(movs.map((m) => m.id)));
    setTimeout(() => setFlashIds(new Set()), 1400);
  };

  // Deep-link a la carga: atajo del launcher (?nuevo=1), acción "Cargar" del push, o
  // ?recurrente=<id> (desde el panel de notificaciones) → alta pre-cargada con ese
  // recurrente (monto vacío). Espera a que `recurrentes` esté cargado para poder resolverlo.
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const recId = sp.get("recurrente");
    if (recId) {
      const r = recurrentes.find((x) => x.id === recId);
      if (r) {
        setModalState({ mode: "add", prefill: { tipo: r.tipo, categoria: r.categoria, descripcion: r.descripcion, observaciones: r.observaciones } });
        window.history.replaceState(window.history.state, "", "/movements");
      } else if (recurrentesLoaded) {
        // Template borrado (notificación vieja) → alta en blanco y URL limpia igual.
        openAdd();
        window.history.replaceState(window.history.state, "", "/movements");
      }
      return;
    }
    if (sp.get("nuevo") === "1") {
      openAdd();
      window.history.replaceState(window.history.state, "", "/movements");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recurrentes, recurrentesLoaded]);

  // Si llegamos con ?m=<id> (desde el dashboard), abrir ese movimiento para editar.
  useEffect(() => {
    if (loading || movimientos.length === 0) return;
    const id = new URLSearchParams(window.location.search).get("m");
    if (!id) return;
    const mov = movimientos.find((x) => x.id === id);
    if (mov) openEdit(mov);
    window.history.replaceState(window.history.state, "", "/movements");
  }, [loading, movimientos]);

  // Fade del botón flotante: se oculta mientras se navega (scroll) y reaparece
  // al detenerse, para no tapar la lista mientras la recorrés.
  const btnVisible = useHideOnScroll();

  const movsFiltrados = useMemo(() =>
    [...(periodoActual?.movimientos ?? [])]
      .filter((m) => m.tipo !== "GastoUSD" && m.tipo !== "GastoEUR" && m.tipo !== "IngresoUSD" && m.tipo !== "IngresoEUR")
      // Filtro de la lupa: si hay términos, acotar a los que matchean (OR, palabra exacta).
      .filter((m) => !filterActivo || movMatchesAny(m, filterTerms))
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
    [periodoActual, filterActivo, filterTerms]
  );

  // Resumen del filtro (total, cantidad, promedio) sobre lo matcheado en el período.
  const filterResumen = useMemo(() => {
    if (!filterActivo) return null;
    const total = movsFiltrados.reduce((s, m) => s + m.monto, 0);
    const count = movsFiltrados.length;
    return { total, count, avg: count > 0 ? total / count : 0 };
  }, [filterActivo, movsFiltrados]);

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
    // Con filtro activo, abrir TODOS los días (querés ver el resultado completo, no colapsado).
    // Sin filtro, solo el día más reciente (evita el scroll infinito).
    if (filterActivo) setDiasAbiertos(new Set(movsPorFecha.map((g) => g.fecha)));
    else setDiasAbiertos(new Set(movsPorFecha[0] ? [movsPorFecha[0].fecha] : []));
    // Al cambiar de período/año o al (des)activar el filtro. No al editar (no cerrar lo abierto).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePeriodoId, filterActivo]);
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
            <PageHeader
              title={t.pageTitleMovements}
              style={{ marginBottom: 0 }}
              right={
                <button onClick={() => setFilterOpen(true)} aria-label={t.filterTitle} style={{ position: "relative", background: "none", border: "none", cursor: "pointer", color: filterActivo ? "var(--accent)" : "var(--muted)", padding: 6, margin: -6, display: "flex" }}>
                  <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                  {filterActivo && <span style={{ position: "absolute", top: 2, right: 2, minWidth: 15, height: 15, padding: "0 3px", borderRadius: 8, background: "var(--accent)", color: "#fff", fontSize: 9, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>{filterTerms.length}</span>}
                </button>
              }
            />
            {periodoActual && (
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                {activePeriodoId === periodos[0]?.periodoId ? t.available : t.remaining}: <span style={{ color: "var(--green)", fontFamily: "var(--font-mono)" }}>{money(periodoActual.disponible)}</span>
                <button onClick={toggle} aria-label={t.hideValues} style={{
                  background: "transparent", border: "none", color: oculto ? "var(--accent)" : "var(--muted)",
                  borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                  padding: 8, margin: -8, // hit-area ~32px sin correr el layout
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

          {/* Resumen del filtro (lupa): total / cantidad / promedio de lo matcheado en el período. */}
          {filterResumen && (
            <div className="soft" style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", marginBottom: 10, border: "1px solid var(--accent)44" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {filterTerms.map((term) => (
                    <span key={term} style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)", background: "var(--accent-dim)", border: "1px solid var(--accent)", borderRadius: 999, padding: "2px 10px" }}>{term}</span>
                  ))}
                </div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 5 }}>
                  {t.filterCount(filterResumen.count)} · {t.filterAvg(money(filterResumen.avg))}
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--accent)" }}>{money(filterResumen.total)}</div>
                <button onClick={() => setFilterTerms([])} style={{ background: "none", border: "none", color: "var(--muted)", fontSize: 11, fontWeight: 600, cursor: "pointer", padding: "2px 0 0", textDecoration: "underline" }}>{t.filterClear}</button>
              </div>
            </div>
          )}

          {movsFiltrados.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: 32, color: "var(--muted)", fontSize: 13 }}>
              {filterActivo ? t.filterNoResults : t.noMovementsAdd}
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
                    {/* Con filtro activo y el día abierto: total de lo filtrado ese día a la
                        derecha, con el color del tipo (rojo gasto, verde ingreso, etc.). Si el
                        día mezcla tipos, queda neutro (accent). */}
                    {filterActivo && abierto && (() => {
                      // Color por tipo homogéneo (los conteos ya están calculados arriba).
                      const tipos = [nGasto > 0, nIngreso > 0, nMoveAhorro > 0, nMoveDisp > 0, nUsd > 0].filter(Boolean).length;
                      const color = tipos !== 1 ? "var(--accent)"
                        : nGasto > 0 ? "var(--red)"
                        : nIngreso > 0 ? "var(--green)"
                        : nMoveAhorro > 0 ? "var(--purple)"
                        : nMoveDisp > 0 ? "var(--teal)"
                        : "var(--yellow)"; // usd/fx
                      return (
                        <span style={{ flex: 1, textAlign: "right", fontSize: 13, fontWeight: 700, fontFamily: "var(--font-mono)", color }}>
                          {money(movs.reduce((s, m) => s + m.monto, 0))}
                        </span>
                      );
                    })()}
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
                        <SwipeToDelete key={m.id} deleteLabel={t.delete} editLabel={t.edit} railBg="var(--surface-alt)"
                          onEdit={() => setModalState({ mode: "edit", mov: m, view: "form" })}
                          onDelete={() => setModalState({ mode: "edit", mov: m, view: "delete" })}>
                        {(abierta) => (
                        <button
                          className={flashIds.has(m.id) ? "row-tap flash-row" : "row-tap"}
                          onClick={() => openEdit(m)}
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
                            {/* Al swipear (abierta), se oculta la observación para que el texto no
                                se corte contra el tacho; queda solo la categoría. */}
                            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {m.categoria}{!abierta && m.observaciones && <span style={{ fontStyle: "italic" }}> · {m.observaciones.toLowerCase()}</span>}
                            </div>
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 700, color: esResto ? "var(--blue)" : isFX ? "var(--yellow)" : isGasto ? "var(--red)" : isMove ? (m.direccionMove === "aAhorro" ? "var(--purple)" : "var(--teal)") : "var(--green)", fontFamily: "var(--font-mono)", flexShrink: 0, marginTop: 1, paddingRight: 4 }}>
                            {negativo ? "-" : "+"}{money(m.monto)}
                          </span>
                        </button>
                        )}
                        </SwipeToDelete>
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
      onClick={() => openAdd()}
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
      prefill={modalState?.prefill ?? null}
      onClose={() => setModalState(null)}
      onChanged={refresh}
      onCreated={handleCreated}
      onUpdated={updateMovimiento}
      onDeleted={removeMovimiento}
    />
    <MovementsFilter
      open={filterOpen}
      onClose={() => setFilterOpen(false)}
      movs={periodoActual?.movimientos ?? []}
      terms={filterTerms}
      onChange={setFilterTerms}
    />
    </>
  );
}
