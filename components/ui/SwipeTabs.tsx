"use client";

import { useRef, useState, type ReactNode } from "react";

const THRESHOLD = 0.22;  // fracción del ancho arrastrada para confirmar cambio al soltar
const SLOP = 10;         // px antes de decidir si el gesto es horizontal o vertical
const GAP = 16;          // px de separación entre pantallas

/**
 * Contenedor de tabs con swipe horizontal tipo carrusel (feeling native). Las N pantallas
 * están SIEMPRE montadas lado a lado en un track; navegar solo desliza el track (no re-monta
 * nada), así el contenido ya está precargado y la navegación es fluida.
 *
 * `onProgress(p)` reporta el progreso del arrastre ∈ [-1, 1] (negativo = hacia el tab
 * siguiente, positivo = hacia el anterior), para que la fila de pills acompañe el dedo.
 *
 * Guard anti-carrusel: si el gesto nace DIRECTAMENTE sobre un scroller horizontal que aún
 * puede moverse en esa dirección (las tiras de pills), ese scroll manda y no cambia de tab.
 */
export function SwipeTabs({ index, count, onIndexChange, onProgress, children }: {
  index: number;
  count: number;
  onIndexChange: (next: number) => void;
  onProgress?: (p: number) => void;
  children: ReactNode[];
}) {
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const horizontal = useRef<boolean | null>(null);
  const allow = useRef(true);
  const width = useRef(1);
  const wrap = useRef<HTMLDivElement>(null);

  // ¿El toque nace sobre un scroller horizontal que TODAVÍA puede moverse en `dirSign`?
  // Solo entonces cede el gesto (para no robarle el scroll a las tiras de pills). Si el
  // scroller ya está en su tope hacia ese lado, el swipe de tab gana.
  const startedInScroller = (target: EventTarget | null, dirSign: number): boolean => {
    let el = target as HTMLElement | null;
    while (el && el !== wrap.current && el !== document.body) {
      // Solo cuentan scrollers REALES (overflow-x scroll/auto), no cualquier elemento con
      // contenido desbordado (p.ej. el propio track flex, que desborda pero no scrollea).
      const ox = getComputedStyle(el).overflowX;
      if ((ox === "auto" || ox === "scroll") && el.scrollWidth > el.clientWidth + 2) {
        const max = el.scrollWidth - el.clientWidth;
        // dirSign<0 (arrastro a la izq → tab siguiente): el scroller manda si puede ir a la derecha.
        // dirSign>0 (arrastro a la der → tab anterior): manda si puede ir a la izquierda.
        if (dirSign < 0 && el.scrollLeft < max - 1) return true;
        if (dirSign > 0 && el.scrollLeft > 1) return true;
      }
      el = el.parentElement;
    }
    return false;
  };

  const report = (p: number) => onProgress?.(Math.max(-1, Math.min(1, p)));

  const onTouchStart = (e: React.TouchEvent) => {
    start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    horizontal.current = null;
    allow.current = true;
    width.current = wrap.current?.clientWidth || window.innerWidth || 1;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!start.current) return;
    const mx = e.touches[0].clientX - start.current.x;
    const my = e.touches[0].clientY - start.current.y;
    if (horizontal.current == null) {
      if (Math.abs(mx) < SLOP && Math.abs(my) < SLOP) return;
      horizontal.current = Math.abs(mx) > Math.abs(my);
      if (horizontal.current && startedInScroller(e.target, mx)) allow.current = false;
    }
    if (!horizontal.current || !allow.current) return;
    const atStart = index === 0 && mx > 0;
    const atEnd = index === count - 1 && mx < 0;
    const nx = atStart || atEnd ? mx * 0.3 : mx;
    setDragging(true);
    setDx(nx);
    report(nx / width.current);
  };
  const onTouchEnd = () => {
    start.current = null;
    if (dragging && allow.current) {
      const frac = dx / width.current;
      if (frac <= -THRESHOLD && index < count - 1) onIndexChange(index + 1);
      else if (frac >= THRESHOLD && index > 0) onIndexChange(index - 1);
    }
    setDragging(false);
    setDx(0);
    report(0);
  };

  const pct = -index * (100 / count);

  return (
    <div ref={wrap} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onTouchCancel={onTouchEnd}
      style={{ overflow: "hidden", touchAction: "pan-y" }}>
      {/* El GAP va como separación de flexbox ENTRE slides (no como padding de cada una,
          que angostaría la pantalla activa). El translateX compensa los `index` gaps que
          quedan a la izquierda de la slide activa, para que quede alineada al borde. */}
      <div style={{
        display: "flex",
        alignItems: "flex-start",
        gap: GAP,
        width: `${count * 100}%`,
        transform: `translateX(calc(${pct}% - ${index * GAP}px + ${dx}px))`,
        transition: dragging ? "none" : "transform .26s cubic-bezier(.2,.8,.2,1)",
      }}>
        {children.map((child, i) => {
          // Altura del track = la de la slide ACTIVA. Las inactivas se colapsan (height 0 +
          // overflow hidden) para no dejar un hueco negro cuando son más cortas/altas que la
          // activa. Mientras se arrastra, la vecina se despliega para que asome de verdad.
          const activa = i === index;
          const vecinaVisible = dragging && (i === index - 1 || i === index + 1);
          const colapsada = !activa && !vecinaVisible;
          return (
            <div key={i} style={{
              width: `${100 / count}%`, flexShrink: 0, boxSizing: "border-box",
              alignSelf: "flex-start",
              maxHeight: colapsada ? 0 : undefined,
              overflow: colapsada ? "hidden" : undefined,
            }}>
              {child}
            </div>
          );
        })}
      </div>
    </div>
  );
}
