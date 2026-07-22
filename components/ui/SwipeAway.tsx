"use client";

import { useRef, useState, type ReactNode } from "react";

// Deslizar para eliminar, en un solo gesto: la fila acompaña al dedo sobre un fondo rojo con
// el tacho, y al soltar pasado el umbral se borra. Sin botones intermedios — el mismo patrón
// de Mercado Pago o Gmail.
//
// Distinto de SwipeToDelete (que revela botones y se queda abierta): ese sigue en Movimientos,
// donde además hay editar y borrar necesita más deliberación. Éste es para listas donde la
// única acción es eliminar y el ítem no es crítico (notificaciones, historial de reserva).

const UMBRAL = 96;       // px de arrastre para que soltar elimine
const ICONO_DESDE = 24;  // a partir de acá el tacho empieza a aparecer

export function SwipeAway({ onDelete, deleteLabel, radius, children, confirma }: {
  onDelete: () => void;
  deleteLabel: string;
  radius?: number;
  children: ReactNode;
  /**
   * true cuando `onDelete` abre una confirmación en vez de borrar. En ese caso la fila NO se
   * va de pantalla (si se cancela, tiene que seguir ahí): vuelve a su lugar y el modal decide.
   */
  confirma?: boolean;
}) {
  const [dx, setDx] = useState(0);        // desplazamiento actual (negativo = a la izquierda)
  const [saliendo, setSaliendo] = useState(false);
  const [touching, setTouching] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const horizontal = useRef<boolean | null>(null);
  const arrastro = useRef(false);

  const avance = Math.min(1, Math.abs(dx) / UMBRAL);
  const armado = Math.abs(dx) >= UMBRAL; // soltar acá elimina

  const onTouchStart = (e: React.TouchEvent) => {
    start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    horizontal.current = null;
    arrastro.current = false;
    setTouching(true);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!start.current) return;
    const t = e.touches[0];
    const mx = t.clientX - start.current.x;
    const my = t.clientY - start.current.y;
    // Hasta no superar un mínimo no se decide el eje: si el gesto es vertical, es scroll.
    if (horizontal.current == null) {
      if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
      horizontal.current = Math.abs(mx) > Math.abs(my);
    }
    if (!horizontal.current) return;
    arrastro.current = true;
    // Solo hacia la izquierda; con resistencia pasado el umbral para que se sienta el tope.
    const bruto = Math.min(0, mx);
    const suave = Math.abs(bruto) > UMBRAL ? -(UMBRAL + (Math.abs(bruto) - UMBRAL) * 0.35) : bruto;
    setDx(suave);
  };

  const onTouchEnd = () => {
    start.current = null;
    setTouching(false);
    if (!armado) { setDx(0); return; }
    if (confirma) {
      // La fila vuelve a su lugar y la decisión queda en el modal que abre onDelete.
      setDx(0);
      onDelete();
      return;
    }
    // Sale de la pantalla y recién ahí se avisa: el ítem no "parpadea" antes de irse.
    setSaliendo(true);
    setDx(-window.innerWidth);
    setTimeout(onDelete, 180);
  };

  return (
    <div style={{ position: "relative", borderRadius: radius, overflow: "hidden" }}>
      {/* Fondo que se revela: se tiñe de rojo a medida que avanza el gesto y se satura del
          todo cuando soltar ya elimina. */}
      <div
        aria-hidden
        style={{
          position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "flex-end",
          paddingRight: 18, borderRadius: radius,
          background: armado ? "var(--red)" : "var(--red-dim)",
          opacity: dx === 0 ? 0 : 1,
          transition: touching ? "background .12s" : "opacity .18s, background .12s",
        }}
      >
        <span style={{
          display: "flex", color: armado ? "#fff" : "var(--red)",
          // El tacho aparece progresivamente y crece un poco al quedar armado.
          opacity: Math.abs(dx) < ICONO_DESDE ? 0 : avance,
          transform: `scale(${armado ? 1.12 : 0.9 + avance * 0.1})`,
          transition: touching ? "transform .1s, color .12s" : "opacity .18s",
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-label={deleteLabel}>
            <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
            <line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" />
          </svg>
        </span>
      </div>

      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        // Un arrastre no debe disparar el tap de la fila (abrir la notificación).
        onClickCapture={(e) => {
          if (arrastro.current) { e.preventDefault(); e.stopPropagation(); arrastro.current = false; }
        }}
        style={{
          transform: `translateX(${dx}px)`,
          transition: touching ? "none" : saliendo ? "transform .18s ease-in" : "transform .22s cubic-bezier(.2,.9,.3,1.1)",
          touchAction: "pan-y",
          position: "relative",
        }}
      >
        {children}
      </div>
    </div>
  );
}
