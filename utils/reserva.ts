import type { Movimiento, TipoMovimiento } from "@/types";

// Tipos de movimiento que afectan la reserva FX de cada moneda.
export function tiposReserva(moneda: "USD" | "EUR"): {
  compra: TipoMovimiento; gasto: TipoMovimiento; venta: TipoMovimiento; ingreso: TipoMovimiento;
} {
  return moneda === "USD"
    ? { compra: "CompraUSD", gasto: "GastoUSD", venta: "VentaUSD", ingreso: "IngresoUSD" }
    : { compra: "CompraEUR", gasto: "GastoEUR", venta: "VentaEUR", ingreso: "IngresoEUR" };
}

type MovReserva = Pick<Movimiento, "tipo" | "cantidadUSD">;

// Saldo de la reserva FX: base (saldo inicial en config) + compras/ingresos − gastos/ventas.
// Única fuente de verdad del cálculo — la usan Inversión, Reportes, el modal de alta,
// Configuración de inversión y la cron de notificaciones.
export function reservaFX(movs: MovReserva[], moneda: "USD" | "EUR", base = 0): number {
  const t = tiposReserva(moneda);
  let total = base;
  for (const m of movs) {
    if (!m.cantidadUSD) continue;
    if (m.tipo === t.compra || m.tipo === t.ingreso) total += m.cantidadUSD;
    else if (m.tipo === t.gasto || m.tipo === t.venta) total -= m.cantidadUSD;
  }
  return total;
}

// Reserva con costo promedio MÓVIL: procesa en orden cronológico (más viejo → más nuevo).
// Al reducir la reserva (gasto/venta/retiro) baja la cantidad Y el costo acumulado
// a precio promedio, así el promedio de lo que queda no se distorsiona.
export function calcularReserva(movimientos: Movimiento[], moneda: "USD" | "EUR") {
  const t = tiposReserva(moneda);
  const orden = [...movimientos].sort((a, b) => a.timestampCarga.getTime() - b.timestampCarga.getTime());
  let total = 0;
  let costoTotalARS = 0;
  for (const m of orden) {
    if (m.tipo === t.compra && m.cantidadUSD) {
      total += m.cantidadUSD;
      costoTotalARS += m.monto;
    } else if (m.tipo === t.ingreso && m.cantidadUSD) {
      // Ingreso en divisa (un pago en USD): suma a la reserva a costo 0 (no se compró con pesos).
      total += m.cantidadUSD;
    } else if ((m.tipo === t.gasto || m.tipo === t.venta) && m.cantidadUSD) {
      // Gasto y Venta bajan la reserva (la Venta además sumó al disponible, ya contado).
      const avg = total > 0 ? costoTotalARS / total : 0;
      const baja = Math.min(m.cantidadUSD, Math.max(total, 0));
      total -= m.cantidadUSD;
      costoTotalARS -= baja * avg;
    }
  }
  return { total, costoTotalARS, costoPromedio: total > 0 ? costoTotalARS / total : 0 };
}
