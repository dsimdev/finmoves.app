"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useScrollLock } from "@/hooks/useScrollLock";

/**
 * Bottom-sheet genérico y arrastrable (patrón único de la app):
 * arrastrar el handle hacia abajo achica el modal (peek, sin perder lo cargado)
 * y hacia arriba lo restaura; bien abajo, cierra. El backdrop tapea para cerrar.
 *
 * `title` es opcional: si no se pasa, no se renderiza el encabezado (handle + ×).
 */
export function BottomSheet({ open, onClose, title, children }: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [ty, setTy] = useState(0);
  const [dragging, setDragging] = useState(false);
  // Portal a <body>: evita que un ancestro con transform (p.ej. la animación
  // .fade-up con fill `both`) capture el position:fixed y descoloque el modal.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  useScrollLock(open);
  const startY = useRef(0);
  const baseTy = useRef(0);

  useEffect(() => { if (open) setTy(0); }, [open]);

  // Acompañar el teclado: el visualViewport se achica al abrirse el teclado, pero
  // los elementos position:fixed siguen el layout viewport (no se mueven). Atamos
  // la altura/top del contenedor al visualViewport para que el sheet quede arriba
  // del teclado en vez de taparse.
  const [vv, setVv] = useState<{ h: number; top: number } | null>(null);
  useEffect(() => {
    const visualViewport = typeof window !== "undefined" ? window.visualViewport : null;
    if (!visualViewport) return;
    const sync = () => setVv({ h: visualViewport.height, top: visualViewport.offsetTop });
    sync();
    visualViewport.addEventListener("resize", sync);
    visualViewport.addEventListener("scroll", sync);
    return () => { visualViewport.removeEventListener("resize", sync); visualViewport.removeEventListener("scroll", sync); };
  }, []);

  const onDown = (e: React.PointerEvent) => {
    startY.current = e.clientY; baseTy.current = ty; setDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    const h = panelRef.current?.offsetHeight ?? 600;
    setTy(Math.min(h, Math.max(0, baseTy.current + (e.clientY - startY.current))));
  };
  const onUp = () => {
    if (!dragging) return;
    setDragging(false);
    const h = panelRef.current?.offsetHeight ?? 600;
    if (ty > h * 0.7) onClose();            // arrastrado bien abajo → cerrar
    else if (ty > h * 0.25) setTy(h * 0.5); // peek (achicado, datos intactos)
    else setTy(0);                          // restaurar a pantalla completa
  };

  if (!mounted) return null;

  return createPortal(
    <div data-no-swipe style={{ position: "fixed", left: 0, top: vv ? vv.top : 0, width: "100%", height: vv ? vv.h : "100%", zIndex: 200, pointerEvents: open ? "all" : "none" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", backdropFilter: open ? "blur(4px)" : "blur(0px)", WebkitBackdropFilter: open ? "blur(4px)" : "blur(0px)", opacity: open ? 1 : 0, transition: "opacity 0.35s ease, backdrop-filter 0.35s ease" }} />
      <div ref={panelRef} style={{ position: "absolute", left: 0, right: 0, bottom: 0, background: "var(--surface)", borderRadius: "26px 26px 0 0", maxHeight: "92%", overflowY: "auto", border: "1px solid var(--border)", borderBottom: "none", boxShadow: "0 -16px 50px rgba(0,0,0,0.5)", transform: open ? `translateY(${ty}px)` : "translateY(101%)", opacity: open ? 1 : 0.4, transition: dragging ? "none" : "transform 0.46s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease", willChange: "transform" }}>
        <div style={{ padding: "4px 16px 0", position: "sticky", top: 0, background: "var(--surface)", zIndex: 1 }}>
          <div onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
            style={{ display: "flex", justifyContent: "center", padding: "8px 0 12px", cursor: dragging ? "grabbing" : "grab", touchAction: "none" }}>
            <div style={{ width: 42, height: 5, background: "var(--border)", borderRadius: 99 }} />
          </div>
          {title !== undefined && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 0 12px", marginBottom: 16, borderBottom: "1px solid var(--border)" }}>
              <span style={{ fontSize: 16, fontWeight: 700 }}>{title}</span>
              <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--muted)", fontSize: 22, cursor: "pointer", lineHeight: 1, padding: 4 }}>×</button>
            </div>
          )}
        </div>
        <div style={{ padding: "0 16px 40px" }}>{children}</div>
      </div>
    </div>,
    document.body
  );
}
