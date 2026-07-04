"use client";

import { useRef } from "react";
import { createPortal } from "react-dom";
import { useModalBack } from "@/hooks/useModalBack";
import { useT } from "@/hooks/useTranslation";

// Chooser propio para adjuntar comprobante: card flotante anclada al clip con 3
// íconos — Cámara directa (capture), Galería y Archivo (PDF). Reemplaza al picker
// del SO, que no se puede estilizar. Los inputs viven fuera de la card para seguir
// montados cuando el diálogo del sistema devuelve el archivo.
export function ComprobanteChooser({ anchor, onClose, onSelect }: {
  /** Rect del botón 📎 al momento de abrir; null = cerrado. */
  anchor: DOMRect | null;
  onClose: () => void;
  onSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  const t = useT();
  const camRef = useRef<HTMLInputElement>(null);
  const galRef = useRef<HTMLInputElement>(null);
  const docRef = useRef<HTMLInputElement>(null);
  useModalBack(!!anchor, onClose);

  const pick = (ref: React.RefObject<HTMLInputElement | null>) => {
    onClose();
    ref.current?.click();
  };

  const handle = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSelect(e);
    e.target.value = ""; // permite volver a elegir el mismo archivo
  };

  const icon = (children: React.ReactNode) => (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{children}</svg>
  );
  const items = [
    { ref: camRef, label: t.chooserCamera, svg: icon(<><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></>) },
    { ref: galRef, label: t.chooserGallery, svg: icon(<><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></>) },
    { ref: docRef, label: t.chooserFile, svg: icon(<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></>) },
  ];

  return (
    <>
      {anchor && createPortal(
        // Backdrop transparente: tap afuera cierra sin tocar lo de abajo.
        <div style={{ position: "fixed", inset: 0, zIndex: 260 }} onClick={onClose}>
          <div className="fade-up" onClick={(e) => e.stopPropagation()} style={{
            position: "absolute",
            right: Math.max(10, window.innerWidth - anchor.right),
            // Arriba del clip; si el clip quedó muy alto, abajo.
            ...(anchor.top > 170
              ? { bottom: window.innerHeight - anchor.top + 10 }
              : { top: anchor.bottom + 10 }),
            background: "var(--surface)", border: "1px solid var(--border)",
            borderRadius: 18, padding: "10px 12px 12px",
            boxShadow: "0 12px 40px rgba(0,0,0,0.35)",
          }}>
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>{t.attachReceipt}</div>
            <div style={{ display: "flex", gap: 10 }}>
              {items.map((it, i) => (
                <button key={i} type="button" aria-label={it.label} title={it.label} onClick={() => pick(it.ref)} style={{
                  width: 54, height: 48, borderRadius: 13, cursor: "pointer",
                  border: "1px solid color-mix(in srgb, var(--blue) 30%, transparent)",
                  background: "color-mix(in srgb, var(--blue) 10%, transparent)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {it.svg}
                </button>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}
      <input ref={camRef} type="file" accept="image/*" capture="environment" onChange={handle} style={{ display: "none" }} />
      <input ref={galRef} type="file" accept="image/*" onChange={handle} style={{ display: "none" }} />
      <input ref={docRef} type="file" accept="application/pdf" onChange={handle} style={{ display: "none" }} />
    </>
  );
}
