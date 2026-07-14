"use client";

import { useRef, useState, useEffect, type ReactNode } from "react";

const BTN_W = 46;     // ancho de cada botón que asoma a la derecha
const OPEN_AT = 28;   // umbral (px arrastrados) para quedar abierta al soltar

// Solo UNA fila abierta a la vez en toda la app: al abrir una, la anterior se cierra.
let cerrarAbierta: (() => void) | null = null;

/**
 * Fila deslizable: al arrastrar hacia la IZQUIERDA, el CONTENIDO se encoge (se le reserva
 * padding a la derecha) y ahí asoman los botones de acción. El contenido NO se empuja fuera
 * de la card — se reflowea con su ellipsis, así el texto nunca se corta contra el borde.
 * Deslizar de vuelta, tocar la fila, o abrir otra, la cierra. Solo táctil.
 *
 * Con `onEdit` se revelan DOS botones (lapicito editar + tacho eliminar); sin él, solo el
 * tacho (comportamiento original, usado en Notificaciones y Home).
 */
export function SwipeToDelete({ onDelete, onEdit, deleteLabel, editLabel, radius, railBg, children }: {
  onDelete: () => void;
  deleteLabel: string;
  /** Si se pasa, se agrega un lapicito (editar) a la izquierda del tacho → atajo directo
   *  a la edición sin abrir el detalle. */
  onEdit?: () => void;
  editLabel?: string;
  /** Radio del contenedor (ej. 12 en notificaciones; sin radio en listas flush). */
  radius?: number;
  /** Fondo del "carril" de los botones. En listas planas (Movimientos) se pasa
   *  "var(--red-dim)" para separarlo del monto y evitar el choque rojo-con-rojo. En
   *  notificaciones (cada fila ya es una card separada) se omite → sobre fondo transparente. */
  railBg?: string;
  /** ReactNode fijo, o función que recibe `abierta` (para recortar detalle mientras los
   *  botones asoman, ej. ocultar la observación). */
  children: ReactNode | ((abierta: boolean) => ReactNode);
}) {
  // Ancho revelado: 2 botones si hay editar, 1 si solo eliminar.
  const PANEL_W = onEdit ? BTN_W * 2 : BTN_W;
  const [pad, setPad] = useState(0); // px de contenido reservados a la derecha (0..TRASH_W)
  const [touching, setTouching] = useState(false);
  const base = useRef(0);
  const start = useRef<{ x: number; y: number } | null>(null);
  const horizontal = useRef<boolean | null>(null);
  const dragged = useRef(false);
  const cerrar = useRef(() => setPad(0));
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => { if (cerrarAbierta === cerrar.current) cerrarAbierta = null; }, []);

  // Con la fila abierta, cerrarla ante CUALQUIER interacción fuera de sus botones: un tap
  // en otro lado, un scroll, etc. (antes solo la cerraba abrir otra fila o tocar esta).
  useEffect(() => {
    if (pad === 0) return;
    const cerrarSiFuera = (e: Event) => {
      if (!rootRef.current?.contains(e.target as Node)) setPad(0);
    };
    // pointerdown cubre tap/click; scroll cierra al desplazar la lista. Capture para
    // adelantarse a que el toque se lo coma otro handler.
    document.addEventListener("pointerdown", cerrarSiFuera, true);
    window.addEventListener("scroll", () => setPad(0), { passive: true, once: true });
    return () => document.removeEventListener("pointerdown", cerrarSiFuera, true);
  }, [pad]);

  const abrir = () => {
    if (cerrarAbierta && cerrarAbierta !== cerrar.current) cerrarAbierta();
    cerrarAbierta = cerrar.current;
    setPad(PANEL_W);
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
    // El padding crece a medida que arrastrás a la izquierda; tope al ancho del panel.
    setPad(Math.max(0, Math.min(PANEL_W, base.current - mx)));
  };
  const onTouchEnd = () => {
    start.current = null;
    setTouching(false);
    if (pad >= OPEN_AT) abrir(); else cerrarSelf();
  };

  const abierta = pad > 0;

  return (
    <div ref={rootRef} style={{ position: "relative", borderRadius: radius, overflow: "hidden" }}>
      {/* Panel de acciones: asoma a la derecha en el hueco que deja el contenido al encogerse.
          Lapicito (editar) + tacho (eliminar), o solo el tacho si no hay onEdit. */}
      <div
        style={{
          position: "absolute", top: 0, bottom: 0, right: 0, width: PANEL_W,
          display: "flex", alignItems: "stretch",
          // Carril opcional (railBg): en listas planas separa los botones del monto; en
          // notificaciones se omite (la fila-card ya lo separa).
          background: railBg ?? "none",
          opacity: abierta ? Math.min(1, pad / PANEL_W) : 0, transition: touching ? "none" : "opacity .15s",
          pointerEvents: abierta ? "auto" : "none",
        }}
      >
        {onEdit && (
          <button
            type="button"
            onClick={() => { cerrarSelf(); onEdit(); }}
            aria-label={editLabel ?? "Editar"}
            tabIndex={abierta ? 0 : -1}
            style={{
              width: BTN_W, display: "flex", alignItems: "center", justifyContent: "center",
              background: "none", color: "var(--muted)", border: "none", cursor: "pointer",
            }}
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
          </button>
        )}
        <button
          type="button"
          onClick={() => { cerrarSelf(); onDelete(); }}
          aria-label={deleteLabel}
          tabIndex={abierta ? 0 : -1}
          style={{
            width: BTN_W, display: "flex", alignItems: "center", justifyContent: "center",
            background: "none", color: "var(--muted)", border: "none", cursor: "pointer",
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></svg>
        </button>
      </div>
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
