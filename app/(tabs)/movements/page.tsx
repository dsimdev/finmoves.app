"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useData } from "../data-context";
import { agruparPorPeriodo, fechaCorta } from "@/utils/periodo";
import { useMoney } from "@/hooks/useHideValues";
import { Movimiento, TipoMovimiento } from "@/types";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { EyeIcon } from "@/components/ui/EyeIcon";
import { MovementModal } from "@/components/movements/MovementModal";
import { useT } from "@/hooks/useTranslation";

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

export default function MovimientosPage() {
  const { oculto, toggle, m: money } = useMoney();
  const { movimientos, loading, refresh, config } = useData();
  const t = useT();

  const periodos = agruparPorPeriodo(movimientos);
  const años = useMemo(() => Array.from(new Set(periodos.map((p) => p.periodoId.split("/")[2] ?? ""))).filter(Boolean), [periodos]);
  const [añoSel, setAñoSel] = useState<string>("");
  const añoActivo = añoSel || años[0] || "";
  const periodosDelAño = useMemo(() => periodos.filter((p) => (p.periodoId.split("/")[2] ?? "") === añoActivo), [periodos, añoActivo]);
  const [periodoSel, setPeriodoSel] = useState<string | null>(null);
  const activePeriodoId = periodoSel ?? periodosDelAño[0]?.periodoId;
  const periodoActual = periodos.find((p) => p.periodoId === activePeriodoId);

  // Modal de alta/edición (componente compartido).
  const [modalState, setModalState] = useState<{ mode: "add" | "edit"; mov?: Movimiento } | null>(null);
  const openAdd = () => setModalState({ mode: "add" });
  const openEdit = (m: Movimiento) => setModalState({ mode: "edit", mov: m });

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
  const [btnVisible, setBtnVisible] = useState(true);
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const hideThenShow = () => {
      setBtnVisible(false);
      if (scrollTimer.current) clearTimeout(scrollTimer.current);
      scrollTimer.current = setTimeout(() => setBtnVisible(true), 700);
    };
    document.addEventListener("scroll", hideThenShow, { passive: true });
    document.addEventListener("touchmove", hideThenShow, { passive: true });
    return () => {
      document.removeEventListener("scroll", hideThenShow);
      document.removeEventListener("touchmove", hideThenShow);
      if (scrollTimer.current) clearTimeout(scrollTimer.current);
    };
  }, []);

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
            {años.map((año) => (
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
            {periodosDelAño.map((p) => {
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
                            {isGasto || (isMove && m.direccionMove === "aAhorro") ? "-" : "+"}{money(m.monto)}
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

    <MovementModal
      open={modalState !== null}
      mode={modalState?.mode ?? "add"}
      movimiento={modalState?.mov ?? null}
      movimientos={movimientos}
      config={config}
      activePeriodoId={activePeriodoId}
      onClose={() => setModalState(null)}
      onChanged={refresh}
    />
    </>
  );
}
