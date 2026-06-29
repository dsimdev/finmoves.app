"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useScrollLock } from "@/hooks/useScrollLock";
import { useModalBack } from "@/hooks/useModalBack";

/**
 * Modal flotante centrado para confirmaciones y advertencias (estilo unificado
 * en toda la app). Título + cuerpo libre + botones Cancelar / Confirmar.
 */
export function ConfirmModal({ title, children, confirmLabel, cancelLabel, confirmColor = "var(--accent)", loading, onConfirm, onCancel }: {
  title: string;
  children?: React.ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  confirmColor?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  useScrollLock(true);
  useModalBack(true, onCancel);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);
  if (!mounted) return null;

  return createPortal(
    <div data-no-swipe onClick={onCancel} style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 18, width: "100%", maxWidth: 340, padding: 22, boxShadow: "0 12px 40px rgba(0,0,0,0.5)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <span style={{ fontSize: 16, fontWeight: 700 }}>{title}</span>
          <button onClick={onCancel} aria-label={cancelLabel} style={{ background: "none", border: "none", color: "var(--red)", fontSize: 22, lineHeight: 1, cursor: "pointer", padding: 0 }}>×</button>
        </div>
        {children && <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6, marginBottom: 22 }}>{children}</div>}
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: "12px 0", borderRadius: 12, border: "1px solid var(--border)", background: "none", color: "var(--muted)", fontSize: 14, cursor: "pointer" }}>{cancelLabel}</button>
          <button onClick={onConfirm} disabled={loading} style={{ flex: 1, padding: "12px 0", borderRadius: 12, border: "none", background: confirmColor, color: "#fff", fontSize: 14, fontWeight: 700, cursor: loading ? "default" : "pointer", opacity: loading ? 0.6 : 1 }}>{loading ? "…" : confirmLabel}</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
