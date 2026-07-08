import type { CSSProperties } from "react";

// Loader único de la app: dos arcos (blades) contrarrotando en colores de marca
// (blue / green). Estilo + animación en `.fm-ring` (globals.css), exceptuado de
// prefers-reduced-motion vía la clase `spin`, así gira aunque el sistema tenga el
// movimiento reducido activado.
export function Loader({ size = 48, thickness = 4 }: { size?: number; thickness?: number }) {
  return (
    <span
      className="fm-ring"
      role="status"
      aria-label="Cargando"
      style={{ width: size, height: size, "--fm-ring-w": `${thickness}px` } as CSSProperties}
    />
  );
}
