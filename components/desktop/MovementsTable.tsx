"use client";

import { useState, useMemo } from "react";
import { useT } from "@/hooks/useTranslation";
import { useMoney } from "@/hooks/useHideValues";
import { detalleTipo } from "@/components/movements/movement-shared";
import { ordenarPor, type ColumnaOrden, type DireccionOrden } from "@/utils/movement-sort";
import { fechaCorta } from "@/utils/periodo";
import type { Movimiento } from "@/types";

// Tabla de movimientos para escritorio. A diferencia de la lista del móvil (una fila por
// tap, montos abreviados, agrupada por día), acá se prioriza la DENSIDAD y la comparación:
// montos completos, columnas ordenables y ~40 filas visibles sin scrollear.

type Props = {
  movimientos: Movimiento[];
  onEdit: (m: Movimiento) => void;
  onDelete: (m: Movimiento) => void;
};

const COLUMNAS: { id: ColumnaOrden; labelKey: "date" | "description" | "category" | "paymentMethod" | "amount"; align?: "right" }[] = [
  { id: "fecha", labelKey: "date" },
  { id: "descripcion", labelKey: "description" },
  { id: "categoria", labelKey: "category" },
  { id: "medioPago", labelKey: "paymentMethod" },
  { id: "monto", labelKey: "amount", align: "right" },
];

export function MovementsTable({ movimientos, onEdit, onDelete }: Props) {
  const t = useT();
  const { m: money } = useMoney();
  const [orden, setOrden] = useState<{ col: ColumnaOrden; dir: DireccionOrden }>({ col: "fecha", dir: "desc" });

  const filas = useMemo(() => ordenarPor(movimientos, orden.col, orden.dir), [movimientos, orden]);

  // Click en una columna: si ya es la activa invierte la dirección; si no, arranca en su
  // orden natural (desc: fecha más nueva, monto más alto, A→Z en texto).
  const toggleOrden = (col: ColumnaOrden) =>
    setOrden((p) => (p.col === col ? { col, dir: p.dir === "desc" ? "asc" : "desc" } : { col, dir: col === "monto" || col === "fecha" ? "desc" : "asc" }));

  if (filas.length === 0) {
    return <div className="soft" style={{ textAlign: "center", padding: 32, color: "var(--muted)", fontSize: 13 }}>{t.noMovements}</div>;
  }

  return (
    <div className="dt-wrap">
      <table className="dt">
        <thead>
          <tr>
            {COLUMNAS.map((c) => {
              const activa = orden.col === c.id;
              return (
                <th key={c.id} onClick={() => toggleOrden(c.id)}
                  className={c.id === "descripcion" ? "dt-flex" : undefined}
                  style={{ textAlign: c.align ?? "left", cursor: "pointer", color: activa ? "var(--text)" : undefined }}
                  aria-sort={activa ? (orden.dir === "asc" ? "ascending" : "descending") : "none"}>
                  {t[c.labelKey]}
                  <span style={{ opacity: activa ? 1 : 0.25, marginLeft: 5, fontSize: 9 }}>
                    {activa && orden.dir === "asc" ? "▲" : "▼"}
                  </span>
                </th>
              );
            })}
            <th style={{ width: 78 }} />
          </tr>
        </thead>
        <tbody>
          {filas.map((m) => {
            const d = detalleTipo(m);
            return (
              <tr key={m.id} onDoubleClick={() => onEdit(m)}>
                <td style={{ color: "var(--muted)", whiteSpace: "nowrap" }}>{fechaCorta(m.fecha)}</td>
                <td className="dt-flex">
                  {/* Punto de color por tipo: la misma paleta que la lista del móvil, pero
                      como marca chica en vez de ícono grande (en tabla el color alcanza). */}
                  <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: d.color, marginRight: 9, verticalAlign: "middle" }} />
                  {m.descripcion || <span style={{ color: "var(--muted)" }}>—</span>}
                  {m.observaciones && <span style={{ color: "var(--muted)", fontSize: 11, marginLeft: 8 }}>{m.observaciones}</span>}
                </td>
                <td style={{ color: "var(--muted)" }}>{m.categoria}</td>
                <td style={{ color: "var(--muted)" }}>{m.medioPago || "—"}</td>
                {/* Monto COMPLETO (sin abbr): en desktop entra y evita tener que abrir el
                    detalle para ver los centavos. */}
                <td style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontWeight: 600, color: d.color, whiteSpace: "nowrap" }}>
                  {d.prefix}{money(m.monto)}
                </td>
                <td>
                  {/* Acciones por fila: aparecen al pasar el mouse (ver .dt tbody tr:hover). */}
                  <div className="dt-actions">
                    <button onClick={() => onEdit(m)} aria-label={t.edit} title={t.edit}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                    </button>
                    <button onClick={() => onDelete(m)} aria-label={t.delete} title={t.delete} className="dt-danger">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
