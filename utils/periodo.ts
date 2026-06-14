import { Movimiento } from "@/types";

export interface PeriodoResumen {
  periodoId: string;
  sueldo: number;
  extras: number;
  total: number;
  gastado: number;
  ahorros: number;
  resto: number;
  disponible: number;
  moveTotal: number;
  pct: number;
  movimientos: Movimiento[];
}

export interface GastoPorCategoria {
  categoria: string;
  monto: number;
  pct: number;
}

export function agruparPorPeriodo(movimientos: Movimiento[]): PeriodoResumen[] {
  const mapa = new Map<string, Movimiento[]>();

  for (const m of movimientos) {
    const pid = m.periodoId || "Sin período";
    if (!mapa.has(pid)) mapa.set(pid, []);
    mapa.get(pid)!.push(m);
  }

  const periodos: PeriodoResumen[] = [];

  for (const [periodoId, movs] of mapa.entries()) {
    let sueldo = 0;
    let extras = 0;
    let gastado = 0;
    let ahorrosBruto = 0; // total depositado en ahorros (Ahorros + RESTO)
    let restoBruto = 0;   // solo Ingreso/RESTO
    let moveTotal = 0;    // retiro de ahorros acumulados → ingresa como extra al período

    for (const m of movs) {
      if (m.tipo === "Gasto" || m.tipo === "CompraUSD") {
        gastado += m.monto;
      } else if (m.tipo === "Ingreso") {
        if (m.categoria === "Sueldo") {
          sueldo += m.monto;
        } else if (m.categoria === "Ahorros" || m.categoria === "RESTO") {
          ahorrosBruto += m.monto;
          if (m.categoria === "RESTO") restoBruto += m.monto;
        } else {
          extras += m.monto;
        }
      } else if (m.tipo === "Move") {
        // moveTotal con signo: "aDisponible" suma (ingreso del período, sale de
        // ahorros); "aAhorro" resta (sale del disponible, va a ahorros). Netean.
        moveTotal += m.direccionMove === "aAhorro" ? -m.monto : m.monto;
      }
    }

    // Move se trata como ingreso extra del período — no altera ahorros del período
    const extrasTotal = extras + moveTotal;
    const total = sueldo + extrasTotal;
    const disponible = total - gastado;
    const ahorros = ahorrosBruto; // solo lo depositado intencionalmente en ahorros
    const resto = restoBruto;
    const pct = total > 0 ? Math.round((gastado / total) * 100) : 0;

    periodos.push({ periodoId, sueldo, extras: extrasTotal, total, gastado, ahorros, resto, disponible, moveTotal, pct, movimientos: movs });
  }

  // Ordenar por fecha del periodoId (más reciente primero)
  periodos.sort((a, b) => {
    const parseFecha = (s: string) => {
      const [d, m, y] = s.split("/");
      return new Date(parseInt(y), parseInt(m) - 1, parseInt(d)).getTime();
    };
    try {
      return parseFecha(b.periodoId) - parseFecha(a.periodoId);
    } catch {
      return 0;
    }
  });

  return periodos;
}

export function gastosPorCategoria(
  movimientos: Movimiento[],
  totalGastado: number
): GastoPorCategoria[] {
  const mapa = new Map<string, number>();

  for (const m of movimientos) {
    if (m.tipo === "Gasto" || m.tipo === "CompraUSD") {
      mapa.set(m.categoria, (mapa.get(m.categoria) ?? 0) + m.monto);
    }
  }

  return Array.from(mapa.entries())
    .map(([categoria, monto]) => ({
      categoria,
      monto,
      pct: totalGastado > 0 ? Math.round((monto / totalGastado) * 100) : 0,
    }))
    .sort((a, b) => b.monto - a.monto);
}

export function formatARS(n: number): string {
  return "$" + n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatMoney(n: number, moneda: "ARS" | "USD" | "EUR" = "ARS"): string {
  const formatted = n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (moneda === "USD") return "U$D " + formatted;
  if (moneda === "EUR") return "€" + formatted;
  return "$" + formatted;
}

// Fecha corta para mostrar al lado de la categoría (el año ya está en el período)
// "YYYY-MM-DD" → "dd/MM"  ·  también tolera "D/M/YYYY"
export function fechaCorta(fecha: string): string {
  if (!fecha) return "";
  if (fecha.includes("-")) {
    const [, m, d] = fecha.split("-");
    return `${d}/${m}`;
  }
  if (fecha.includes("/")) {
    const [d, m] = fecha.split("/");
    return `${d.padStart(2, "0")}/${m.padStart(2, "0")}`;
  }
  return fecha;
}
