"use client";

import { useRef, useState, useEffect, type ReactNode } from "react";

const TRASH_W = 56;   // ancho del tacho que asoma a la derecha
const OPEN_AT = 28;   // umbral (px arrastrados) para quedar abierta al soltar

// Solo UNA fila abierta a la vez en toda la app: al abrir una, la anterior se cierra.
let cerrarAbierta: (() => void) | null = null;

/**
 * Fila deslizable: al arrastrar hacia la IZQUIERDA, el CONTENIDO se encoge (se le reserva
 * padding a la derecha) y ahí asoma un tacho rojo. El contenido NO se empuja fuera de la
 * card — se reflowea con su ellipsis, así el texto nunca se corta contra el borde. Tocar
 * el tacho borra; deslizar de vuelta, tocar la fila, o abrir otra, la cierra. Solo táctil.
 */
export function SwipeToDelete({ onDelete, deleteLabel, radius, railBg, children }: {
  onDelete: () => void;
  deleteLabel: string;
  /** Radio del contenedor (ej. 12 en notificaciones; sin radio en listas flush). */
  radius?: number;
  /** Fondo del "carril" del tacho. En listas planas (Movimientos) se pasa "var(--red-dim)"
   *  para separarlo del monto y evitar el choque rojo-con-rojo. En notificaciones (cada
   *  fila ya es una card separada) se omite → tacho sobre fondo transparente. */
  railBg?: string;
  /** ReactNode fijo, o función que recibe `abierta` (para recortar detalle mientras el
   *  tacho asoma, ej. ocultar la observación). */
  children: ReactNode | ((abierta: boolean) => ReactNode);
}) {
  const [pad, setPad] = useState(0); // px de contenido reservados a la derecha (0..TRASH_W)
  const [touching, setTouching] = useState(false);
  const base = useRef(0);
  const start = useRef<{ x: number; y: number } | null>(null);
  const horizontal = useRef<boolean | null>(null);
  const dragged = useRef(false);
  const cerrar = useRef(() => setPad(0));

  useEffect(() => () => { if (cerrarAbierta === cerrar.current) cerrarAbierta = null; }, []);

  const abrir = () => {
    if (cerrarAbierta && cerrarAbierta !== cerrar.current) cerrarAbierta();
    cerrarAbierta = cerrar.current;
    setPad(TRASH_W);
  };
  const cerrarSelf = () => {
    if (cerrarAbierta === cerrar.current) cerrarAbierta = null;
    setPad(0);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    horizontal.current = null;
    dragged.current = false;
    base.current = pad;
    setTouching(true);
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!start.current) return;
    const t = e.touches[0];
    const mx = t.clientX - start.current.x; // arrastrar a la izquierda → mx negativo
    const my = t.clientY - start.current.y;
    if (horizontal.current == null) {
      if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
      horizontal.current = Math.abs(mx) > Math.abs(my);
    }
    if (!horizontal.current) return;
    dragged.current = true;
    // El padding crece a medida que arrastrás a la izquierda; tope al ancho del tacho.
    setPad(Math.max(0, Math.min(TRASH_W, base.current - mx)));
  };
  const onTouchEnd = () => {
    start.current = null;
    setTouching(false);
    if (pad >= OPEN_AT) abrir(); else cerrarSelf();
  };

  const abierta = pad > 0;

  return (
    <div style={{ position: "relative", borderRadius: radius, overflow: "hidden" }}>
      {/* Tacho: aparece a la derecha en el hueco que deja el contenido al encogerse. */}
      <button
        type="button"
        onClick={() => { cerrarSelf(); onDelete(); }}
        aria-label={deleteLabel}
        tabIndex={abierta ? 0 : -1}
        style={{
          position: "absolute", top: 0, bottom: 0, right: 0, width: TRASH_W,
          display: "flex", alignItems: "center", justifyContent: "center",
          // Carril opcional (railBg): en listas planas separa el tacho del monto; en
          // notificaciones se omite (la fila-card ya lo separa).
          background: railBg ?? "none", color: "var(--red)", border: "none", cursor: "pointer",
          opacity: abierta ? Math.min(1, pad / TRASH_W) : 0, transition: touching ? "none" : "opacity .15s",
          pointerEvents: abierta ? "auto" : "none",
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></svg>
      </button>
      {/* Contenido: se le reserva `pad` px a la derecha → se encoge, no se desplaza fuera. */}
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        onClickCapture={(e) => {
          if (dragged.current) { e.preventDefault(); e.stopPropagation(); dragged.current = false; return; }
          if (abierta) { e.preventDefault(); e.stopPropagation(); cerrarSelf(); }
        }}
        style={{
          paddingRight: pad,
          transition: touching ? "none" : "padding-right .18s",
          touchAction: "pan-y",
        }}
      >
        {typeof children === "function" ? children(abierta) : children}
      </div>
    </div>
  );
}
