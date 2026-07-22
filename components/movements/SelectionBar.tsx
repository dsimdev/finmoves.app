"use client";

import { useState } from "react";
import { useT } from "@/hooks/useTranslation";
import { BottomSheet } from "@/components/ui/BottomSheet";
import type { Categoria } from "@/types";

// Barra de acciones del modo selección: reemplaza al header mientras hay movimientos elegidos
// (mismo patrón que WhatsApp/Gmail). Fija arriba, con el conteo a la izquierda y las acciones
// a la derecha; se sale con la ×.

export function SelectionBar({ count, nBorrables, nRecategorizables, categorias, onCancel, onDelete, onRecategorize }: {
  count: number;
  /** Cuántos de los elegidos se pueden borrar (el sueldo ancla no). */
  nBorrables: number;
  /** Cuántos admiten cambio de categoría (Move/FX/RESTO no). */
  nRecategorizables: number;
  categorias: Categoria[];
  onCancel: () => void;
  onDelete: () => void;
  onRecategorize: (categoria: string) => void;
}) {
  const t = useT();
  const [catOpen, setCatOpen] = useState(false);

  const accion: React.CSSProperties = {
    background: "none", border: "none", cursor: "pointer", padding: 8, margin: -2,
    display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8,
  };

  return (
    <>
      <div style={{
        position: "sticky", top: 0, zIndex: 20, display: "flex", alignItems: "center", gap: 10,
        padding: "10px 4px", marginBottom: 10,
        background: "var(--surface)", borderBottom: "1px solid var(--border)",
      }}>
        <button onClick={onCancel} aria-label={t.cancel} style={{ ...accion, color: "var(--muted)" }}>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>

        <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
          {t.selectedCount(count)}
        </span>

        {/* Cambiar categoría: solo si alguno de los elegidos la admite. */}
        <button
          onClick={() => setCatOpen(true)}
          disabled={nRecategorizables === 0}
          aria-label={t.changeCategory}
          title={t.changeCategory}
          style={{ ...accion, color: nRecategorizables === 0 ? "var(--border)" : "var(--accent)" }}
        >
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M20.6 8.7l-8-5.7a2 2 0 0 0-2.3 0l-8 5.7A2 2 0 0 0 1.5 10v9a2 2 0 0 0 2 2h17a2 2 0 0 0 2-2v-9a2 2 0 0 0-.9-1.3z" /><polyline points="8 13 12 16 16 13" /></svg>
        </button>

        {/* Borrar: se apaga si lo único elegido es el sueldo ancla. */}
        <button
          onClick={onDelete}
          disabled={nBorrables === 0}
          aria-label={t.delete}
          title={t.delete}
          style={{ ...accion, color: nBorrables === 0 ? "var(--border)" : "var(--red)" }}
        >
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
        </button>
      </div>

      {/* Selector de categoría destino. */}
      <BottomSheet open={catOpen} onClose={() => setCatOpen(false)} title={t.changeCategory}>
        <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 12 }}>
          {t.recategorizeHint(nRecategorizables)}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingBottom: 8 }}>
          {categorias.map((c) => (
            <button
              key={c.id}
              onClick={() => { onRecategorize(c.nombre); setCatOpen(false); }}
              style={{
                width: "100%", textAlign: "left", padding: "12px 14px", borderRadius: 10,
                border: "1px solid var(--border)", background: "var(--surface-alt)",
                color: "var(--text)", fontSize: 13.5, cursor: "pointer",
              }}
            >
              {c.nombre}
            </button>
          ))}
        </div>
      </BottomSheet>
    </>
  );
}
