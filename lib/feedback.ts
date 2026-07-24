// Feedback físico de la app: un pulso VISUAL corto sobre el elemento tocado.
//
// Esto era feedback HÁPTICO (navigator.vibrate + pulso visual). La vibración se sacó en
// v2.102.0: Apple nunca implementó la Vibration API y cerró el único hack (el del switch) en
// iOS 26.5, así que en iPhone no disparó nunca. Mantener un toggle de "Vibración" en
// Preferencias era prometer algo que en la mitad de los dispositivos no pasaba.
// NO hay alternativa web — no re-investigar.
//
// Queda el pulso visual, que siempre funcionó y anda en cualquier dispositivo. Como ahora es
// el único feedback, pisa más fuerte que antes (comprime y rebota; ver globals.css).

export type FeedbackTipo = "success" | "delete" | "light" | "select";

// Clase CSS por tipo (definida en globals.css):
//   punch = comprime y rebota, para confirmaciones con peso (guardar).
//   tap   = compresión corta, para toques livianos (navegar, seleccionar).
//   shake = sacudida lateral, para borrar.
const CLASE: Record<FeedbackTipo, string> = {
  success: "fb-punch",
  delete: "fb-shake",
  light: "fb-tap",
  select: "fb-tap",
};

/**
 * Dispara el pulso visual sobre un elemento.
 * @param tipo qué acción es (define la animación)
 * @param el   elemento al que aplicárselo (el botón/fila tocado). Sin elemento no hay efecto.
 */
export function feedback(tipo: FeedbackTipo, el?: HTMLElement | null) {
  if (!el) return;
  const clase = CLASE[tipo];
  el.classList.remove(clase);
  // Forzar reflow para reiniciar la animación aunque se toque en ráfaga.
  void el.offsetWidth;
  el.classList.add(clase);
  el.addEventListener("animationend", () => el.classList.remove(clase), { once: true });
}
