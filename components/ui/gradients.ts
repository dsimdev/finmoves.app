import type { CSSProperties } from "react";

// Gradiente de marca (pills, selectores, números destacados): azul → cian → verde.
export const APP_GRAD = "linear-gradient(110deg, var(--blue) 0%, #26c6da 40%, #2bd4b0 70%, var(--green) 100%)";
export const APP_GRAD_DIM = "linear-gradient(135deg, color-mix(in srgb, var(--blue) 13%, var(--surface-alt)), color-mix(in srgb, var(--green) 13%, var(--surface-alt)))";

// Gradiente de títulos: azul → verde.
export const TITLE_GRAD = "linear-gradient(110deg, var(--blue) 10%, var(--green) 90%)";

// Aplica un gradiente como color de texto (clip). Reutilizable en spans/números.
export const clipText = (gradient: string): CSSProperties => ({
  background: gradient,
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  backgroundClip: "text",
});

export const appGradText: CSSProperties = clipText(APP_GRAD);
export const titleGradText: CSSProperties = clipText(TITLE_GRAD);
