"use client";

import type { Movimiento } from "@/types";
import { CategoriaIcono } from "@/components/ui/CategoriaIcono";

// Piezas compartidas por las vistas del MovementModal (detalle, reserva, edición).
// Vivían duplicadas dentro del modal: el héroe y los campos del detalle estaban escritos
// dos veces (Movimientos y reserva de Inversión) con diferencias sólo de tamaño.

// ── Íconos por familia de tipo ──
export const ICON_GASTO = <><line x1="12" y1="5" x2="12" y2="19" /><polyline points="6 13 12 19 18 13" /></>;
export const ICON_INGRESO = <><line x1="12" y1="19" x2="12" y2="5" /><polyline points="6 11 12 5 18 11" /></>;
export const ICON_MOVE = <><path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16" /></>;
export const ICON_FX = <><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></>;

export const TIPOS_FX_MOV = ["CompraUSD", "GastoUSD", "CompraEUR", "GastoEUR", "VentaUSD", "VentaEUR", "IngresoUSD", "IngresoEUR"];

export const esMovimientoFX = (m: Movimiento): boolean => TIPOS_FX_MOV.includes(m.tipo);

/** La divisa de un movimiento FX (para el label del detalle). */
export const monedaMovFX = (m: Movimiento): "USD" | "EUR" => (m.tipo.endsWith("EUR") ? "EUR" : "USD");

// Color, ícono, signo y etiqueta según el tipo. Misma paleta que la lista de movimientos
// (Gasto rojo, Move púrpura/teal, FX amarillo, RESTO azul).
export function detalleTipo(m: Movimiento): { color: string; icon: React.ReactNode; prefix: string; label: string } {
  if (m.categoria === "RESTO") return { color: "var(--blue)", icon: ICON_INGRESO, prefix: "+", label: m.tipo };
  if (esMovimientoFX(m)) {
    const neg = m.tipo.startsWith("Compra") || m.tipo.startsWith("Gasto");
    return { color: "var(--yellow)", icon: ICON_FX, prefix: neg ? "-" : "+", label: m.tipo };
  }
  if (m.tipo === "Gasto") return { color: "var(--red)", icon: ICON_GASTO, prefix: "-", label: m.tipo };
  if (m.tipo === "Move") {
    const aAhorro = m.direccionMove === "aAhorro";
    return { color: aAhorro ? "var(--purple)" : "var(--teal)", icon: ICON_MOVE, prefix: aAhorro ? "-" : "+", label: m.tipo };
  }
  return { color: "var(--green)", icon: ICON_INGRESO, prefix: "+", label: m.tipo };
}

// ── Estilos compartidos ──
export const detalleChip: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 11px", borderRadius: 999,
  background: "var(--surface-alt)", border: "1px solid var(--border)", color: "var(--muted)",
  fontSize: 11, fontWeight: 600,
};
export const detalleField: React.CSSProperties = { background: "var(--surface-alt)", borderRadius: "var(--radius-sm)", padding: "10px 13px", minWidth: 0 };
export const detalleFieldLabel: React.CSSProperties = { fontSize: 9, color: "var(--muted)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 3 };

// ── Íconos inline reusados en chips ──
export const IconoCalendario = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }}>
    <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);
export const IconoTarjeta = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }}>
    <rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" />
  </svg>
);
export const IconoRecurrente = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16" />
  </svg>
);

// ── Héroe del detalle: ícono en halo + tipo/categoría + monto grande + chips ──
export function DetalleHero({ movimiento, money, children, fxComoHeroe, categoria }: {
  movimiento: Movimiento;
  money: (n: number) => string;
  /** Chips bajo el monto (fecha, medio de pago, recurrente…). */
  children?: React.ReactNode;
  /**
   * Categoría del movimiento (de la config). Si viene, el héroe muestra SU ícono en vez de la
   * flecha genérica por tipo: la flecha repetía lo que ya dicen el signo y el color del monto.
   */
  categoria?: { nombre: string; icono?: string; color?: string };
  /**
   * Solo en Reserva: en una operación de divisa el dato es CUÁNTA divisa entró o salió, así
   * que va de héroe y los pesos quedan debajo. En Movimientos el héroe sigue siendo el monto
   * en pesos, que es lo que mueve el período.
   */
  fxComoHeroe?: boolean;
}) {
  const dc = detalleTipo(movimiento);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", marginBottom: 18 }}>
      {/* Con categoría, su ícono (en su color); sin ella, el ícono genérico por tipo. */}
      {categoria ? (
        <div style={{ marginBottom: 12 }}><CategoriaIcono categoria={categoria} size={56} /></div>
      ) : (
        <div style={{ width: 56, height: 56, borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12, background: `color-mix(in srgb, ${dc.color} 16%, transparent)`, border: `1px solid color-mix(in srgb, ${dc.color} 45%, transparent)`, color: dc.color }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">{dc.icon}</svg>
        </div>
      )}
      {/* Tipo y categoría coinciden en las operaciones de divisa ("COMPRAUSD · COMPRAUSD"):
          se muestra uno solo cuando dicen lo mismo. */}
      <div style={{ fontSize: 10, color: "var(--muted)", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 6 }}>
        {dc.label.toLowerCase() === movimiento.categoria.toLowerCase()
          ? dc.label
          : `${dc.label} · ${movimiento.categoria}`}
      </div>
      {fxComoHeroe && movimiento.cantidadUSD ? (
        <>
          <div style={{ fontSize: 32, fontWeight: 800, fontFamily: "var(--font-mono)", lineHeight: 1, color: dc.color }}>
            {movimiento.tipo.endsWith("EUR") ? "€" : "U$D"} {movimiento.cantidadUSD.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: 14, fontFamily: "var(--font-mono)", color: "var(--muted)", marginTop: 6 }}>
            {dc.prefix}{money(movimiento.monto)}
          </div>
        </>
      ) : (
        <div style={{ fontSize: 32, fontWeight: 800, fontFamily: "var(--font-mono)", lineHeight: 1, color: dc.color }}>{dc.prefix}{money(movimiento.monto)}</div>
      )}
      {children && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, flexWrap: "wrap", marginTop: 12 }}>{children}</div>
      )}
    </div>
  );
}

// ── Cantidad + cotización de un movimiento de reserva ──
export function DetalleFX({ movimiento, labels, sinCantidad, conObservaciones }: {
  movimiento: Movimiento;
  labels: { quantity: string; exchangeRate: string; notes?: string };
  /** En Reserva la cantidad ya es el héroe: repetirla acá sería decir dos veces lo mismo. */
  sinCantidad?: boolean;
  /** En Reserva las observaciones comparten fila con la cotización (dos datos cortos). */
  conObservaciones?: boolean;
}) {
  if (!esMovimientoFX(movimiento)) return null;
  const mostrarCantidad = !sinCantidad;
  const mostrarObs = conObservaciones && !!movimiento.observaciones;
  const celdas = [mostrarCantidad, movimiento.cotizacion != null, mostrarObs].filter(Boolean).length;
  return (
    <div style={{ display: "grid", gridTemplateColumns: celdas > 1 ? "1fr 1fr" : "1fr", gap: 8, marginBottom: 12 }}>
      {mostrarCantidad && (
      <div style={detalleField}>
        <div style={detalleFieldLabel}>{labels.quantity}</div>
        <div style={{ fontSize: 15, fontWeight: 700, fontFamily: "var(--font-mono)" }}>{monedaMovFX(movimiento)} {movimiento.cantidadUSD?.toFixed(2) ?? "—"}</div>
      </div>
      )}
      {movimiento.cotizacion != null && (
        <div style={detalleField}>
          <div style={detalleFieldLabel}>{labels.exchangeRate}</div>
          <div style={{ fontSize: 15, fontWeight: 700, fontFamily: "var(--font-mono)" }}>${movimiento.cotizacion.toLocaleString("es-AR")}</div>
        </div>
      )}
      {mostrarObs && (
        <div style={detalleField}>
          <div style={detalleFieldLabel}>{labels.notes}</div>
          <div style={{ fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis" }}>{movimiento.observaciones}</div>
        </div>
      )}
    </div>
  );
}

// ── Descripción y observaciones (se omite el bloque si no hay ninguna) ──
export function DetalleTextos({ movimiento, labels }: {
  movimiento: Movimiento;
  labels: { description: string; notes: string };
}) {
  if (!movimiento.descripcion && !movimiento.observaciones) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
      {movimiento.descripcion && (
        <div style={detalleField}>
          <div style={detalleFieldLabel}>{labels.description}</div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{movimiento.descripcion}</div>
        </div>
      )}
      {movimiento.observaciones && (
        <div style={detalleField}>
          <div style={detalleFieldLabel}>{labels.notes}</div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{movimiento.observaciones}</div>
        </div>
      )}
    </div>
  );
}

// ── Botón del comprobante: abre el visor a pantalla completa (no embebe la imagen) ──
export function ComprobanteButton({ movimiento, label, onOpen }: {
  movimiento: Movimiento;
  label: string;
  onOpen: (src: string, isPdf: boolean) => void;
}) {
  if (!movimiento.comprobanteUrl) return null;
  const isPdf = !!movimiento.comprobantePath?.toLowerCase().endsWith(".pdf");
  return (
    <button type="button" onClick={() => onOpen(movimiento.comprobanteUrl!, isPdf)}
      style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", padding: "11px 14px", marginBottom: 4, border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", background: "none", color: "var(--accent)", fontSize: 13, cursor: "pointer" }}>
      📎 {label}
    </button>
  );
}
