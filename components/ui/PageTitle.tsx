import type { CSSProperties, ReactNode } from "react";
import { titleGradText } from "./gradients";

// Título de página con gradiente de marca (azul → verde). Usado en las 5 pestañas.
export function PageTitle({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.5, display: "inline-block", ...titleGradText, ...style }}>
      {children}
    </div>
  );
}
