export type TipoMovimiento = "Gasto" | "Ingreso" | "Move" | "CompraUSD";
export type TipoCategoria = "Gasto" | "Ingreso" | "Ambos";
export type EstadoPeriodo = "activo" | "cerrado";
export type TipoCambioRef = "blue" | "oficial" | "mep";

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
  desde?: string;
  hacia?: string;
}

export interface ReservaUSD {
  totalUSD: number;
  costoPromedioARS: number;
  ultimaActualizacion: Date;
}

export interface Cotizacion {
  blue: number;
  oficial: number;
  mep: number;
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
  };
}
