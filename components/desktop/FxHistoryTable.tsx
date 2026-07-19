"use client";

import { useT } from "@/hooks/useTranslation";
import { useMoney } from "@/hooks/useHideValues";
import { detalleTipo } from "@/components/movements/movement-shared";
import type { Movimiento } from "@/types";

// Historial de la reserva FX como tabla (escritorio). En móvil vive detrás del ícono de
// reloj, en un panel que sube desde abajo, porque no hay lugar; acá se muestra completo:
// es lo que explica de dónde salió la reserva y a qué precio.

// Ingreso y Gasto de divisa NO existen en Movimientos (sólo mueven la reserva): este
// historial es su único lugar, así que se borran desde acá. Compra y Venta sí están en
// Movimientos y se gestionan allá.
const esBorrableDesdeAqui = (m: Movimiento) =>
  m.tipo.startsWith("Ingreso") || m.tipo.startsWith("Gasto");

const fechaCorta = (f: string) => {
  if (!f) return "";
  if (f.includes("-")) { const [y, m, d] = f.split("-"); return `${d}/${m}/${y.slice(-2)}`; }
  const [d, m, y] = f.split("/");
  return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${(y ?? "").slice(-2)}`;
};

export function FxHistoryTable({ movimientos, onDelete, onVerComprobante }: {
  movimientos: Movimiento[];
  onDelete: (m: Movimiento) => void;
  /** Abre el comprobante adjunto a pantalla completa. */
  onVerComprobante?: (m: Movimiento) => void;
}) {
  const t = useT();
  const { m: money } = useMoney();

  if (movimientos.length === 0) {
    return <div className="soft" style={{ textAlign: "center", padding: 28, color: "var(--muted)", fontSize: 13 }}>{t.noMovements}</div>;
  }

  return (
    <div className="dt-wrap">
      <table className="dt">
        <thead>
          <tr>
            <th>{t.date}</th>
            <th>{t.type}</th>
            <th className="dt-flex">{t.notes}</th>
            <th style={{ textAlign: "right" }}>{t.quantity}</th>
            <th style={{ textAlign: "right" }}>{t.exchangeRate}</th>
            <th style={{ textAlign: "right" }}>{t.amount}</th>
            <th style={{ width: 48 }} />
          </tr>
        </thead>
        <tbody>
          {movimientos.map((m) => {
            const d = detalleTipo(m);
            const moneda = m.tipo.endsWith("EUR") ? "€" : "U$D";
            return (
              <tr key={m.id}>
                <td style={{ color: "var(--muted)", whiteSpace: "nowrap" }}>{fechaCorta(m.fecha)}</td>
                <td>
                  <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: d.color, marginRight: 9, verticalAlign: "middle" }} />
                  {t.tipoDisplay[m.tipo as keyof typeof t.tipoDisplay] ?? m.tipo}
                </td>
                <td className="dt-flex" style={{ color: "var(--muted)" }}>
                  {m.observaciones || m.descripcion || "—"}
                  {/* El comprobante se abre desde acá: en el historial no hay detalle que
                      abrir, el resto de los datos ya está en la fila. */}
                  {m.comprobanteUrl && (
                    <button
                      onClick={() => onVerComprobante?.(m)}
                      aria-label={t.receipt}
                      title={t.receipt}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "var(--accent)", marginLeft: 8, padding: 0, fontSize: 13 }}
                    >
                      📎
                    </button>
                  )}
                </td>
                <td style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontWeight: 600, color: d.color, whiteSpace: "nowrap" }}>
                  {d.prefix}{moneda} {m.cantidadUSD?.toFixed(2) ?? "—"}
                </td>
                <td style={{ textAlign: "right", fontFamily: "var(--font-mono)", color: "var(--muted)", whiteSpace: "nowrap" }}>
                  {m.cotizacion != null ? `$${m.cotizacion.toLocaleString("es-AR")}` : "—"}
                </td>
                <td style={{ textAlign: "right", fontFamily: "var(--font-mono)", whiteSpace: "nowrap" }}>
                  {m.monto > 0 ? money(m.monto) : "—"}
                </td>
                <td>
                  {/* Sólo los Ingreso/Gasto de divisa se borran desde acá: no existen en
                      Movimientos, así que este es su único lugar. Compras y ventas se editan
                      o eliminan desde Movimientos, como cualquier otro movimiento. */}
                  {esBorrableDesdeAqui(m) && (
                    <div className="dt-actions">
                      <button onClick={() => onDelete(m)} aria-label={t.delete} title={t.delete} className="dt-danger">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
