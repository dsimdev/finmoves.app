"use client";

import { useRef, useCallback } from "react";
import { feedback } from "@/lib/feedback";

// Long-press para entrar en modo selección (patrón de cualquier bandeja: WhatsApp, Gmail,
// Fotos). Devuelve handlers listos para pegar en el elemento.
//
// Dos cuidados que hacen la diferencia entre "anda" y "molesta":
//  · si el dedo se MUEVE, es un scroll, no un long-press → se cancela.
//  · al dispararse marca el gesto como consumido, para que el `click` que el navegador manda
//    después no abra además el detalle del movimiento.

const UMBRAL_MS = 450;
const TOLERANCIA_PX = 10;

export function useLongPress(onLongPress: () => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inicio = useRef<{ x: number; y: number } | null>(null);
  const disparado = useRef(false);

  const cancelar = useCallback(() => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    inicio.current = null;
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    disparado.current = false;
    inicio.current = { x: e.clientX, y: e.clientY };
    // El elemento se captura ACÁ: dentro del setTimeout el evento ya se recicló y
    // currentTarget viene en null.
    const el = e.currentTarget as HTMLElement;
    timer.current = setTimeout(() => {
      disparado.current = true;
      feedback("select", el); // el long-press "prendió" la selección: micro-feedback
      onLongPress();
    }, UMBRAL_MS);
  }, [onLongPress]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!inicio.current || !timer.current) return;
    const dx = Math.abs(e.clientX - inicio.current.x);
    const dy = Math.abs(e.clientY - inicio.current.y);
    if (dx > TOLERANCIA_PX || dy > TOLERANCIA_PX) cancelar(); // se está scrolleando
  }, [cancelar]);

  /** true si el click que sigue viene de un long-press ya atendido (hay que ignorarlo). */
  const consumioClick = useCallback(() => {
    if (!disparado.current) return false;
    disparado.current = false;
    return true;
  }, []);

  return {
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: cancelar,
      onPointerCancel: cancelar,
      onPointerLeave: cancelar,
      onContextMenu: (e: React.MouseEvent) => e.preventDefault(), // sin menú nativo al mantener
    },
    consumioClick,
  };
}
