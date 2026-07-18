import type { ConfigUsuario } from "@/types";

// Regla del auto-ahorro: cada gasto que cumple las condiciones dispara un Move a ahorros
// por un monto fijo. Vivía inline en el alta del modal; extraída para que cualquier camino
// de carga (modal, carga rápida de escritorio) aplique EXACTAMENTE la misma regla — si
// divergen, el mismo gasto ahorra o no según desde dónde lo cargues.

export interface AutoAhorroInput {
  tipo: string;
  categoria: string;
  descripcion: string;
  medioPago: string;
}

/** Monto del auto-ahorro que corresponde a este movimiento, o 0 si no aplica. */
export function montoAutoAhorro(config: ConfigUsuario | null, mov: AutoAhorroInput): number {
  const aa = config?.meta.autoAhorro;
  if (!aa?.activo || !(aa.monto > 0)) return 0;
  if (mov.tipo !== "Gasto") return 0;
  // Sin medios configurados = aplica a todos; con lista, solo a los de la lista.
  if (aa.mediosPago?.length && !aa.mediosPago.includes(mov.medioPago)) return 0;
  // Descripciones excluidas a mano por el usuario (comparación sin distinguir mayúsculas).
  const omitir = aa.omitirDescripciones ?? [];
  const desc = mov.descripcion.trim().toLowerCase();
  if (omitir.some((d) => d.toLowerCase() === desc)) return 0;
  return aa.monto;
}

export const aplicaAutoAhorro = (config: ConfigUsuario | null, mov: AutoAhorroInput): boolean =>
  montoAutoAhorro(config, mov) > 0;
