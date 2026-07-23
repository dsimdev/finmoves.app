// Feedback háptico central. Combina dos cosas, porque ninguna sola alcanza:
//   · Vibración del hardware (navigator.vibrate): funciona en Android. En iOS NO — Apple nunca
//     implementó la Vibration API y cerró el único hack (el switch) en iOS 26.5. Por eso no se
//     depende de ella.
//   · Pulso VISUAL (un micro-punch de escala): funciona en cualquier dispositivo y es el que
//     garantiza la "respuesta". Lo aplica quien llama, con la clase que devuelve este módulo.
//
// Se dispara SINCRÓNICO dentro del gesto: navigator.vibrate necesita una activación de usuario
// viva, así que llamarla después de un `await` la pierde (ese fue el bug histórico). Llamar a
// haptic() SIEMPRE antes de cualquier await.

export type HapticTipo = "success" | "delete" | "light" | "select";

// Patrón de vibración por tipo, en ms. Cortos y distintos entre sí para que "se sientan"
// diferente sin molestar (guardar ≠ borrar).
const PATRON: Record<HapticTipo, number | number[]> = {
  success: 18,        // guardar/confirmar: un tick nítido
  delete: [22, 30, 22], // borrar: doble golpe, más "definitivo"
  light: 8,           // navegación/tab: apenas un roce
  select: 12,         // toggle/selección: micro-tap
};

// Clase CSS del punch visual por tipo (definida en globals.css). El success/select dan un
// rebote de escala; delete un shake corto.
const CLASE_VISUAL: Record<HapticTipo, string> = {
  success: "haptic-punch",
  delete: "haptic-shake",
  light: "haptic-punch",
  select: "haptic-punch",
};

// El toggle de Preferencias controla SOLO la vibración del hardware. El pulso visual va
// SIEMPRE: no molesta, no depende de permisos y le da respuesta a todos (incluido iOS, donde la
// vibración nunca dispara). El pref vive en el store de React; la app lo espeja acá.
let vibracionOn = true;
export function setHapticsEnabled(v: boolean) { vibracionOn = v; }

/**
 * Dispara el háptico. Llamar SINCRÓNICO dentro del gesto (antes de cualquier await).
 * @param tipo    qué acción es (define patrón de vibración y pulso visual)
 * @param el      elemento opcional al que aplicarle el punch visual (el botón/fila tocado)
 */
export function haptic(tipo: HapticTipo, el?: HTMLElement | null) {
  // Vibración (Android) — solo si el usuario la dejó activada. Envuelto en try: algunos
  // navegadores tiran si no hay activación de usuario viva.
  if (vibracionOn) {
    try {
      if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
        navigator.vibrate(PATRON[tipo]);
      }
    } catch { /* no pasa nada: el visual igual corre */ }
  }

  // Punch visual: SIEMPRE (no lo gatea el toggle). Se re-dispara quitando y re-agregando clase.
  if (el) {
    const clase = CLASE_VISUAL[tipo];
    el.classList.remove(clase);
    // Forzar reflow para reiniciar la animación aunque se toque en ráfaga.
    void el.offsetWidth;
    el.classList.add(clase);
    el.addEventListener("animationend", () => el.classList.remove(clase), { once: true });
  }
}
