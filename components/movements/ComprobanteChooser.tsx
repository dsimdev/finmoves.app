"use client";

import { useRef } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { useT } from "@/hooks/useTranslation";

// Chooser propio para adjuntar comprobante (estilo action-sheet iOS): Cámara directa
// (capture), Galería o Archivo (PDF). Reemplaza al picker del SO, que no se puede
// estilizar. Los inputs viven fuera del sheet para seguir montados cuando el diálogo
// del sistema devuelve el archivo.
export function ComprobanteChooser({ open, onClose, onSelect }: {
  open: boolean;
  onClose: () => void;
  onSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  const t = useT();
  const camRef = useRef<HTMLInputElement>(null);
  const galRef = useRef<HTMLInputElement>(null);
  const docRef = useRef<HTMLInputElement>(null);

  const pick = (ref: React.RefObject<HTMLInputElement | null>) => {
    onClose();
    ref.current?.click();
  };

  const handle = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSelect(e);
    e.target.value = ""; // permite volver a elegir el mismo archivo
  };

  const rows = [
    {
      ref: camRef, label: t.chooserCamera, color: "var(--blue)",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
          <circle cx="12" cy="13" r="4" />
        </svg>
      ),
    },
    {
      ref: galRef, label: t.chooserGallery, color: "var(--green)",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="3" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="M21 15l-5-5L5 21" />
        </svg>
      ),
    },
    {
      ref: docRef, label: t.chooserFile, color: "var(--accent)",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6" />
        </svg>
      ),
    },
  ];

  return (
    <>
      <BottomSheet open={open} onClose={onClose}>
        <div style={{ fontSize: 13, color: "var(--muted)", margin: "0 4px 10px" }}>{t.attachReceipt.toLowerCase()}</div>
        <div style={{ background: "var(--surface-alt)", border: "1px solid var(--border)", borderRadius: 18, overflow: "hidden", marginBottom: 8 }}>
          {rows.map((r, i) => (
            <button key={i} type="button" onClick={() => pick(r.ref)} className="row" style={{
              display: "flex", alignItems: "center", gap: 14, width: "100%",
              padding: "14px 16px", background: "none", border: "none", cursor: "pointer",
              borderTop: i > 0 ? "1px solid var(--border)" : "none",
              color: "var(--text)", fontSize: 15.5, fontWeight: 600, textAlign: "left",
            }}>
              <span style={{ width: 38, height: 38, borderRadius: 11, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: `color-mix(in srgb, ${r.color} 14%, transparent)` }}>
                {r.icon}
              </span>
              {r.label}
            </button>
          ))}
        </div>
      </BottomSheet>
      <input ref={camRef} type="file" accept="image/*" capture="environment" onChange={handle} style={{ display: "none" }} />
      <input ref={galRef} type="file" accept="image/*" onChange={handle} style={{ display: "none" }} />
      <input ref={docRef} type="file" accept="application/pdf" onChange={handle} style={{ display: "none" }} />
    </>
  );
}
