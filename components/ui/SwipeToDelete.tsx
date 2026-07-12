"use client";

import { useRef, useState, type ReactNode } from "react";

const TRASH_W = 64; // ancho del área que descubre el tacho

/**
 * Fila deslizable: arrastrar hacia la IZQUIERDA descubre un tacho rojo a la derecha;
 * tocarlo dispara onDelete. Tocar la fila abierta (o deslizar de vuelta) la cierra.
 * Solo táctil, como el resto de los gestos de lista de la app. La intención del gesto
 * se decide una sola vez (horizontal vs vertical) para no pelear con el scroll.
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
  const [dx, setDx] = useState(0);
  const [touching, setTouching] = useState(false); // dedo abajo → sin transición (sigue al dedo)
  const base = useRef(0); // offset al empezar el gesto (0 o -TRASH_W si ya estaba abierta)
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
    setDx(Math.max(-TRASH_W - 20, Math.min(0, base.current + mx)));
  };
  const onTouchEnd = () => {
    start.current = null;
    setTouching(false);
    setDx((d) => (d < -TRASH_W / 2 ? -TRASH_W : 0));
  };

  return (
    <div style={{ position: "relative", overflow: "hidden", borderRadius: radius }}>
      <button
        type="button"
        onClick={() => { setDx(0); onDelete(); }}
        aria-label={deleteLabel}
        tabIndex={dx === 0 ? -1 : 0}
        style={{
          position: "absolute", top: 0, right: 0, bottom: 0, width: TRASH_W + 20,
          display: "flex", alignItems: "center", justifyContent: "center", paddingLeft: 20,
          background: "none", color: "var(--red)", border: "none", cursor: "pointer",
          opacity: dx === 0 ? 0 : 1, transition: "opacity .15s",
          pointerEvents: dx === 0 ? "none" : "auto",
        }}
      >
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></svg>
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
          if (dx !== 0) { e.preventDefault(); e.stopPropagation(); setDx(0); }
        }}
        style={{
          transform: `translateX(${dx}px)`,
          transition: touching ? "none" : "transform .18s",
          touchAction: "pan-y",
          background: dx !== 0 ? bg : undefined,
        }}
      >
        {children}
      </div>
    </div>
  );
}
