"use client";

import { useRef } from "react";

/**
 * Long-press reutilizable para listas. Devuelve un `bind(onLongPress, onClick)`
 * que se puede llamar dentro de un .map() (no es un hook por fila).
 * Tap corto → onClick; mantener apretado ~500ms → onLongPress (con vibración).
 * Se cancela si el dedo se mueve (scroll).
 */
export function useLongPress(ms = 500) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggered = useRef(false);
  const start = useRef<{ x: number; y: number } | null>(null);

  const clear = () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
  };

  return (onLongPress: () => void, onClick?: () => void) => ({
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    onTouchStart: (e: React.TouchEvent) => {
      triggered.current = false;
      start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      clear();
      timer.current = setTimeout(() => {
        triggered.current = true;
        onLongPress();
      }, ms);
    },
    onTouchMove: (e: React.TouchEvent) => {
      if (!start.current) return;
      const t = e.touches[0];
      if (Math.abs(t.clientX - start.current.x) > 10 || Math.abs(t.clientY - start.current.y) > 10) clear();
    },
    onTouchEnd: clear,
    onMouseDown: () => {
      triggered.current = false;
      clear();
      timer.current = setTimeout(() => { triggered.current = true; onLongPress(); }, ms);
    },
    onMouseUp: clear,
    onMouseLeave: clear,
    onClick: () => {
      if (triggered.current) { triggered.current = false; return; }
      onClick?.();
    },
  });
}
