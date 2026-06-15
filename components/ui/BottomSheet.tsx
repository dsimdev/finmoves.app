"use client";

import { useState, useEffect, useRef } from "react";

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
  const startY = useRef(0);
  const baseTy = useRef(0);

  useEffect(() => { if (open) setTy(0); }, [open]);

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

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, pointerEvents: open ? "all" : "none" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", backdropFilter: open ? "blur(4px)" : "blur(0px)", WebkitBackdropFilter: open ? "blur(4px)" : "blur(0px)", opacity: open ? 1 : 0, transition: "opacity 0.35s ease, backdrop-filter 0.35s ease" }} />
      <div ref={panelRef} style={{ position: "absolute", left: 0, right: 0, bottom: 0, background: "var(--bg)", borderRadius: "26px 26px 0 0", maxHeight: "92dvh", overflowY: "auto", border: "1px solid var(--border)", borderBottom: "none", boxShadow: "0 -16px 50px rgba(0,0,0,0.5)", transform: open ? `translateY(${ty}px)` : "translateY(101%)", opacity: open ? 1 : 0.4, transition: dragging ? "none" : "transform 0.46s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease", willChange: "transform" }}>
        <div style={{ padding: "4px 16px 0", position: "sticky", top: 0, background: "var(--bg)", zIndex: 1 }}>
          <div onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
            style={{ display: "flex", justifyContent: "center", padding: "8px 0 12px", cursor: dragging ? "grabbing" : "grab", touchAction: "none" }}>
            <div style={{ width: 42, height: 5, background: "var(--border)", borderRadius: 99 }} />
          </div>
          {title !== undefined && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <span style={{ fontSize: 16, fontWeight: 700 }}>{title}</span>
              <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--red)", fontSize: 22, cursor: "pointer", lineHeight: 1, padding: 4 }}>×</button>
            </div>
          )}
        </div>
        <div style={{ padding: "0 16px 40px" }}>{children}</div>
      </div>
    </div>
  );
}
