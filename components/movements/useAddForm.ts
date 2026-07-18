"use client";

import { useState, useCallback, useMemo } from "react";
import type { TipoMovimiento } from "@/types";

// Estado del formulario de ALTA del MovementModal. Eran 15 useState sueltos en el cuerpo
// del modal, mezclados con el estado de edición y el de comprobantes; acá quedan juntos
// y el reset vive al lado de los campos que resetea (antes era fácil olvidar uno).

export const hoyISO = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

export interface AddFormState {
  tipo: TipoMovimiento;
  categoria: string;
  descripcion: string;
  monto: string;
  fecha: string;
  medioPago: string;
  observaciones: string;
  origenAhorro: string;
  cantidadUSD: string;
  montoARSInput: string;
  modoCarga: "USD" | "ARS";
  cotizManual: string;
  abreNuevoPeriodo: boolean;
  repetir: boolean;
  moveDir: "aDisponible" | "aAhorro";
}

const INICIAL: Omit<AddFormState, "fecha"> = {
  tipo: "Gasto",
  categoria: "",
  descripcion: "",
  monto: "",
  medioPago: "Mercado Pago",
  observaciones: "",
  origenAhorro: "",
  cantidadUSD: "",
  montoARSInput: "",
  modoCarga: "USD",
  cotizManual: "",
  abreNuevoPeriodo: false,
  repetir: false,
  moveDir: "aDisponible",
};

// ── Transiciones puras (testeables sin montar el hook ni DOM) ──

/** Estado inicial del form, con la fecha en HOY. */
export const estadoInicial = (): AddFormState => ({ ...INICIAL, fecha: hoyISO() });

// Reset conservando `tipo` y `medioPago`: el tipo lo fija el efecto de apertura del modal
// (reserva / sin períodos / prefill) JUSTO DESPUÉS del reset, y pisarlo acá lo haría
// parpadear a "Gasto"; el medio de pago se mantiene entre altas seguidas a propósito
// (cargás varios gastos con la misma tarjeta sin re-elegirla).
export const estadoReseteado = (prev: AddFormState): AddFormState => ({
  ...INICIAL, tipo: prev.tipo, medioPago: prev.medioPago, fecha: hoyISO(),
});

export const estadoParcheado = (prev: AddFormState, patch: Partial<AddFormState>): AddFormState =>
  ({ ...prev, ...patch });

export function useAddForm() {
  const [form, setForm] = useState<AddFormState>(estadoInicial);

  /** Parche de uno o varios campos a la vez: set({ tipo: "Gasto", categoria: "" }). */
  const set = useCallback((patch: Partial<AddFormState>) => {
    setForm((prev) => estadoParcheado(prev, patch));
  }, []);

  const reset = useCallback(() => setForm(estadoReseteado), []);

  // Setters por campo: mantienen la ergonomía de useState en el JSX (onChange={setMonto})
  // sin que el modal tenga que armar el objeto de parche en cada input.
  const campo = useCallback(
    <K extends keyof AddFormState>(k: K) => (v: AddFormState[K]) => setForm((prev) => ({ ...prev, [k]: v })),
    [],
  );

  const setters = useMemo(() => ({
    setTipo: campo("tipo"),
    setCategoria: campo("categoria"),
    setDescripcion: campo("descripcion"),
    setMonto: campo("monto"),
    setFecha: campo("fecha"),
    setMedioPago: campo("medioPago"),
    setObservaciones: campo("observaciones"),
    setOrigenAhorro: campo("origenAhorro"),
    setCantidadUSD: campo("cantidadUSD"),
    setMontoARSInput: campo("montoARSInput"),
    setModoCarga: campo("modoCarga"),
    setCotizManual: campo("cotizManual"),
    setAbreNuevoPeriodo: campo("abreNuevoPeriodo"),
    setRepetir: campo("repetir"),
    setMoveDir: campo("moveDir"),
  }), [campo]);

  return { form, set, reset, ...setters };
}
