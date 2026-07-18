export type TipoMovimiento = "Gasto" | "Ingreso" | "Move" | "CompraUSD" | "GastoUSD" | "CompraEUR" | "GastoEUR" | "VentaUSD" | "VentaEUR" | "IngresoUSD" | "IngresoEUR";
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
  // "aAhorro" = inverso (Disponible → Ahorros).
  direccionMove?: "aDisponible" | "aAhorro";
  // Comprobante adjunto (imagen en Cloud Storage). url para mostrar, path para borrar.
  comprobanteUrl?: string;
  comprobantePath?: string;
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

export interface Presupuesto {
  categorias: Record<string, number>;
}

export interface ConfigUsuario {
  categorias: Categoria[];
  mediosPago: MedioPago[];
  tipos: Array<{ nombre: string; activo: boolean }>;
  origenesAhorro: OrigenAhorro[];
  meta: {
    usdMensual: number;
    tipoCambioRef: TipoCambioRef;
    presupuestoTemplate?: Record<string, number>;
    /** @deprecated Saldo inicial cargado a mano. Ya NO se suma a la reserva (v2.89.1): la
     *  reserva es solo lo cargado como movimientos. Se conserva el campo por los datos
     *  viejos en Firestore, pero ningún cálculo lo lee. */
    saldoUSD?: number;
    /** @deprecated Ver saldoUSD. */
    saldoEUR?: number;
    // ── Metas de ahorro ──────────────────────────────────────────────────────
    // metaPropia: en la moneda PRINCIPAL del usuario (ARS/USD/EUR). El progreso se mide
    //   sobre los ahorros acumulados YA calculados (no se carga saldo a mano). Para TODOS.
    metaPropia?: { monto: number; fecha?: string };
    /** Hitos (50/75/100) ya festejados in-app, para no repetir el confeti. Se resetean al
     *  cambiar el monto de la meta (empieza un objetivo nuevo). Antes eran dedup de push
     *  (metaPropiaHitos/metaHitos en notifyMeta); los hitos ya no notifican, ver notifications.ts. */
    metaPropiaHitos?: number[];
    metaFXHitos?: number[];
    // metaFX: meta de la reserva en divisa (comprar USD/EUR). SOLO usuarios ARS. Migrada
    //   desde los campos viejos metaMonto/metaMoneda ("USD" siempre) / metaFecha.
    metaFX?: { monto: number; fecha?: string; moneda: "USD" | "EUR" };
    // Campos viejos (una sola meta USD): se conservan por retrocompat / migración a metaFX.
    metaFecha?: string; // YYYY-MM-DD
    metaMoneda?: "USD"; // siempre USD
    metaMonto?: number;
    metaPorPeriodo?: number;
    /** Cotización manual (oficial de la moneda de inversión activa). Si activa, reemplaza a bluelytics en la valuación. */
    cotizacionManual?: number;
    cotizacionManualActiva?: boolean;
    ahorrosAcumSeedPeriodoId?: string;
    /** Período desde el cual se promedia el ritmo de compra FX (la ventana crece período a período). */
    inversionSeedPeriodoId?: string;
    monedaPrincipal?: "ARS" | "USD" | "EUR";
    /** Prefs de UI persistidas por-usuario (fuente de verdad; el store local es solo caché). */
    monedaInversiones?: "USD" | "EUR";
    showAhorros?: boolean;
    showReportes?: boolean;
    autoAhorro?: { activo: boolean; monto: number; mediosPago?: string[]; omitirDescripciones?: string[] };
    onboardingCompleto?: boolean;
    /** Contador de mutaciones de movimientos: se incrementa en cada alta/edición/borrado.
     *  El cliente lo compara con el cacheado para detectar cambios hechos en otro dispositivo. */
    movsRevision?: number;
    /** Hints contextuales de gestos ya descartados por el usuario (persistidos en Firestore
     *  para que no reaparezcan al reinstalar, a diferencia del viejo localStorage). */
    hintsVistos?: Record<string, boolean>;
    nombre?: string;
    fotoURL?: string;
    /** Permisos por usuario, gestionados por el dueño desde el panel Admin.
     *  comprobantes: default OFF (el dueño habilita). inversion: default ON (el dueño revoca). */
    permisos?: { comprobantes?: boolean; inversion?: boolean };
  };
}
