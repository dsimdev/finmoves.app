import type { ReactNode } from "react";
import { titleGradText } from "./gradients";

// Header unificado de las pestañas: título centrado en mono/uppercase con gradiente de
// marca, y slots opcionales a los lados para acciones (left/right). El grid de 3 columnas
// mantiene el título centrado aunque solo haya acción de un lado.
export function PageHeader({ title, subtitle, left, right, style }: {
  title: ReactNode;
  /** Línea secundaria centrada bajo el título (ej. días del período en Inicio). */
  subtitle?: ReactNode;
  left?: ReactNode;
  right?: ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 8, marginBottom: 20, minHeight: 32, ...style }}>
      <div style={{ display: "flex", alignItems: "center", justifySelf: "start", minWidth: 0 }}>{left}</div>
      <div style={{ textAlign: "center" }}>
        <h1 style={{ margin: 0, fontFamily: "var(--font-fredoka)", fontSize: 18, fontWeight: 600, letterSpacing: 5, textTransform: "uppercase", whiteSpace: "nowrap", paddingLeft: 5, ...titleGradText }}>
          {title}
        </h1>
        {subtitle}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifySelf: "end", minWidth: 0 }}>{right}</div>
    </div>
  );
}
