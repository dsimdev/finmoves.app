"use client";

import { useRef, useState, type ReactNode } from "react";

const TRASH_W = 56;   // cuánto se corre la fila al abrir (= ancho del hueco del tacho)
const OPEN_AT = 32;   // umbral para quedar abierta al soltar

/**
 * Fila deslizable en CUALQUIER dirección: al arrastrar, la fila se corre y detrás
 * queda un tacho rojo compacto FIJO del lado hacia donde deslizás (izquierda → tacho
 * a la derecha; derecha → tacho a la izquierda). Tocarlo dispara onDelete. Si ya está
 * abierta y volvés a deslizar (o tocás la fila), se cierra. Solo táctil. La intención
 * del gesto (horizontal vs vertical) se decide una vez para no pelear con el scroll.
 */
export function SwipeToDelete({ onDelete, deleteLabel, radius, bg, children }: {
  onDelete: () => void;
  deleteLabel: string;
  /** Radio del contenedor (ej. 12 en notificaciones; sin radio en listas flush). */
  radius?: number;
  /** Fondo para filas transparentes (ej. sobre una card con gradiente): se aplica solo
   *  mientras la fila está corrida, para que el tacho no se transparente debajo. */
  bg?: string;
  children: ReactNode;
}) {
  const [dx, setDx] = useState(0); // <0 abierta a la izquierda, >0 a la derecha, 0 cerrada
  const [touching, setTouching] = useState(false);
  const base = useRef(0);
  const start = useRef<{ x: number; y: number } | null>(null);
  const horizontal = useRef<boolean | null>(null);
  const dragged = useRef(false);

  const onTouchStart = (e: React.TouchEvent) => {
    start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    horizontal.current = null;
    dragged.current = false;
    base.current = dx;
    setTouching(true);
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!start.current) return;
    const t = e.touches[0];
    const mx = t.clientX - start.current.x;
    const my = t.clientY - start.current.y;
    if (horizontal.current == null) {
      if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
      horizontal.current = Math.abs(mx) > Math.abs(my);
    }
    if (!horizontal.current) return;
    dragged.current = true;
    // Tope elástico: no se corre más que el ancho del tacho (+ un pelín de resistencia).
    const raw = base.current + mx;
    setDx(Math.max(-TRASH_W, Math.min(TRASH_W, raw)));
  };
  const onTouchEnd = () => {
    start.current = null;
    setTouching(false);
    // Queda abierta hacia el lado deslizado solo si superó el umbral; si no, cierra.
    setDx((d) => (d <= -OPEN_AT ? -TRASH_W : d >= OPEN_AT ? TRASH_W : 0));
  };

  const abierta = dx !== 0;
  // El tacho vive del lado OPUESTO al movimiento: fila a la izquierda (dx<0) → tacho derecha.
  const ladoIzq = dx > 0;

  return (
    <div style={{ position: "relative", overflow: "hidden", borderRadius: radius }}>
      <button
        type="button"
        onClick={() => { setDx(0); onDelete(); }}
        aria-label={deleteLabel}
        tabIndex={abierta ? 0 : -1}
        style={{
          position: "absolute", top: 0, bottom: 0, width: TRASH_W,
          left: ladoIzq ? 0 : undefined, right: ladoIzq ? undefined : 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "none", color: "var(--red)", border: "none", cursor: "pointer",
          opacity: abierta ? 1 : 0, transition: "opacity .12s",
          pointerEvents: abierta ? "auto" : "none",
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></svg>
      </button>
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        onClickCapture={(e) => {
          // Tras un drag, el touchend genera un click fantasma → tragarlo.
          if (dragged.current) { e.preventDefault(); e.stopPropagation(); dragged.current = false; return; }
          // Fila abierta: el tap la cierra en lugar de disparar su acción.
          if (abierta) { e.preventDefault(); e.stopPropagation(); setDx(0); }
        }}
        style={{
          transform: `translateX(${dx}px)`,
          transition: touching ? "none" : "transform .18s",
          touchAction: "pan-y",
          background: abierta ? bg : undefined,
          position: "relative",
        }}
      >
        {children}
      </div>
    </div>
  );
}
