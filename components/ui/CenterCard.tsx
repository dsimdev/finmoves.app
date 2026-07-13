"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useScrollLock } from "@/hooks/useScrollLock";
import { useModalBack } from "@/hooks/useModalBack";

/**
 * Card flotante centrada (portal + overlay oscuro). A diferencia del BottomSheet, no
 * sube desde abajo: aparece en el centro con un pop suave, como una tarjeta. Cerrar por
 * overlay, botón ×, Escape o back. El contenido lo provee el caller.
 */
export function CenterCard({ open, onClose, title, titleColor, children, maxWidth = 360 }: {
  open: boolean;
  onClose: () => void;
  title?: string;
  titleColor?: string;
  children: React.ReactNode;
  maxWidth?: number;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  useScrollLock(open);
  useModalBack(open, onClose);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!mounted || !open) return null;

  return createPortal(
    <div data-center-card onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, animation: "ccFade .16s ease-out" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 20, width: "100%", maxWidth, maxHeight: "88vh", overflowY: "auto", boxShadow: "0 16px 48px rgba(0,0,0,0.55)", animation: "ccPop .18s cubic-bezier(.2,.9,.3,1.2)" }}>
        {title !== undefined && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 18px 0" }}>
            <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: 0.3, color: titleColor }}>{title}</span>
            <button onClick={onClose} aria-label="×" style={{ background: "none", border: "none", color: "var(--muted)", fontSize: 22, lineHeight: 1, cursor: "pointer", padding: 4, margin: -4 }}>×</button>
          </div>
        )}
        <div style={{ padding: 18 }}>{children}</div>
      </div>
      <style>{`
        @keyframes ccFade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes ccPop { from { opacity: 0; transform: scale(.94) } to { opacity: 1; transform: scale(1) } }
        @media (prefers-reduced-motion: reduce) { [data-center-card], [data-center-card] > div { animation: none !important } }
      `}</style>
    </div>,
    document.body
  );
}
