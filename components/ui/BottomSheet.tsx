"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useScrollLock } from "@/hooks/useScrollLock";
import { useModalBack } from "@/hooks/useModalBack";

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
  useModalBack(open, onClose);
  const startY = useRef(0);
  const baseTy = useRef(0);
  const contentRef = useRef<HTMLDivElement>(null);
  const tyRef = useRef(0);

  useEffect(() => { tyRef.current = ty; }, [ty]);
  useEffect(() => { if (open) setTy(0); }, [open]);

  // Arrastre desde el cuerpo con listeners nativos no-pasivos: mantener apretado
  // ~280ms en cualquier parte entra en modo arrastre y, con preventDefault, frena el
  // scroll nativo (los listeners pointer pasivos de React no pueden hacerlo). Si se
  // mueve antes del umbral, es scroll y se cancela.
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    let timer: number | null = null, drag = false, sY = 0, base = 0, lastY = 0;
    const clear = () => { if (timer != null) { clearTimeout(timer); timer = null; } };
    const onTS = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      if ((e.target as HTMLElement).closest("button,a,input,textarea,select")) return;
      sY = lastY = e.touches[0].clientY; base = tyRef.current;
      timer = window.setTimeout(() => { drag = true; setDragging(true); sY = lastY; base = tyRef.current; }, 280);
    };
    const onTM = (e: TouchEvent) => {
      lastY = e.touches[0].clientY;
      if (!drag) { if (timer != null && Math.abs(lastY - sY) > 8) clear(); return; }
      e.preventDefault();
      const h = el.closest("[role=dialog]") instanceof HTMLElement ? (el.closest("[role=dialog]") as HTMLElement).offsetHeight : 600;
      const nty = Math.min(h, Math.max(0, base + (lastY - sY)));
      tyRef.current = nty; setTy(nty);
    };
    const onTE = () => {
      clear();
      if (!drag) return;
      drag = false; setDragging(false);
      const h = el.closest("[role=dialog]") instanceof HTMLElement ? (el.closest("[role=dialog]") as HTMLElement).offsetHeight : 600;
      const cur = tyRef.current;
      if (cur > h * 0.7) onClose();
      else { const snap = cur > h * 0.25 ? h * 0.5 : 0; tyRef.current = snap; setTy(snap); }
    };
    el.addEventListener("touchstart", onTS, { passive: true });
    el.addEventListener("touchmove", onTM, { passive: false });
    el.addEventListener("touchend", onTE, { passive: true });
    el.addEventListener("touchcancel", onTE, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onTS);
      el.removeEventListener("touchmove", onTM);
      el.removeEventListener("touchend", onTE);
      el.removeEventListener("touchcancel", onTE);
    };
  }, [onClose]);

  // Accesibilidad: al abrir, mover el foco al panel y atrapar Tab dentro del diálogo;
  // Escape cierra; al cerrar, devolver el foco al elemento que lo abrió.
  const lastFocused = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!open) return;
    lastFocused.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const raf = requestAnimationFrame(() => panel?.focus());
    const focusablesSel = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key === "Tab" && panel) {
        const f = Array.from(panel.querySelectorAll<HTMLElement>(focusablesSel));
        if (f.length === 0) { e.preventDefault(); panel.focus(); return; }
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKey);
      lastFocused.current?.focus?.();
    };
  }, [open, onClose]);

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
    // Permite arrastrar desde toda la cabecera, salvo el botón de cerrar.
    if ((e.target as HTMLElement).closest("[data-close]")) return;
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
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} style={{ position: "absolute", left: 0, right: 0, bottom: 0, background: "var(--surface)", borderRadius: "26px 26px 0 0", maxHeight: "92%", overflowY: "auto", border: "1px solid var(--border)", borderBottom: "none", boxShadow: "0 -16px 50px rgba(0,0,0,0.5)", transform: open ? `translateY(${ty}px)` : "translateY(101%)", opacity: open ? 1 : 0.4, transition: dragging ? "none" : "transform 0.46s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease", willChange: "transform", outline: "none" }}>
        <div onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
          style={{ padding: "4px 16px 0", position: "sticky", top: 0, background: "var(--surface)", zIndex: 1, cursor: dragging ? "grabbing" : "grab", touchAction: "none" }}>
          <div style={{ display: "flex", justifyContent: "center", padding: "8px 0 12px" }}>
            <div style={{ width: 42, height: 5, background: "var(--border)", borderRadius: 99 }} />
          </div>
          {title !== undefined && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 0 12px", marginBottom: 16, borderBottom: "1px solid var(--border)" }}>
              <span style={{ fontSize: 16, fontWeight: 700 }}>{title}</span>
              <button data-close onClick={onClose} aria-label="Cerrar" style={{ background: "none", border: "none", color: "var(--muted)", fontSize: 22, cursor: "pointer", lineHeight: 1, padding: 4 }}>×</button>
            </div>
          )}
        </div>
        <div ref={contentRef} style={{ padding: "0 16px 40px" }}>{children}</div>
      </div>
    </div>,
    document.body
  );
}
