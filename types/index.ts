export type TipoMovimiento = "Gasto" | "Ingreso" | "Move" | "CompraUSD" | "GastoUSD" | "CompraEUR" | "GastoEUR";
export type TipoCategoria = "Gasto" | "Ingreso" | "Ambos";
export type EstadoPeriodo = "activo" | "cerrado";
export type TipoCambioRef = "blue" | "oficial";

export interface Periodo {
  id: string;
  inicio: Date;
  fin: Date | null;
  sueldo: number;
  estado: EstadoPeriodo;
  resto: number;
}

export interface Movimiento {
  id: string;
  timestampCarga: Date;
  fecha: string;
  tipo: TipoMovimiento;
  categoria: string;
  descripcion: string;
  monto: number;
  medioPago: string;
  observaciones: string;
  periodoId: string;
  userId: string;
  cantidadUSD?: number;
  cotizacion?: number;
  origenAhorro?: string;
  // Dirección del Move. Ausente o "aDisponible" = clásico (Ahorros → Disponible);
  // "aAhorro" = inverso (Disponible → Ahorros). Netea contra el mismo moveTotal.
  direccionMove?: "aDisponible" | "aAhorro";
}

export interface ReservaUSD {
  totalUSD: number;
  costoPromedioARS: number;
  ultimaActualizacion: Date;
}

export interface Cotizacion {
  blue: number;
  oficial: number;
  blue_euro?: number;
  oficial_euro?: number;
  fuente: "api" | "manual" | "cache";
  timestamp: Date;
}

export interface Categoria {
  id: string;
  nombre: string;
  tipo: TipoCategoria;
  activa: boolean;
}

export interface MedioPago {
  id: string;
  nombre: string;
  activo: boolean;
}

export interface OrigenAhorro {
  id: string;
  nombre: string;
  activo: boolean;
}

export interface ConfigUsuario {
  categorias: Categoria[];
  mediosPago: MedioPago[];
  tipos: Array<{ nombre: string; activo: boolean }>;
  origenesAhorro: OrigenAhorro[];
  meta: {
    usdMensual: number;
    tipoCambioRef: TipoCambioRef;
    saldoUSD?: number;
    saldoEUR?: number;
    metaFecha?: string; // YYYY-MM-DD
    metaMoneda?: "USD"; // siempre USD
    metaMonto?: number;
    metaPorPeriodo?: number;
    ahorrosAcumSeedPeriodoId?: string;
    monedaPrincipal?: "ARS" | "USD" | "EUR";
    autoAhorro?: { activo: boolean; monto: number; mediosPago?: string[]; omitirDescripciones?: string[] };
    onboardingCompleto?: boolean;
    nombre?: string;
  };
}
