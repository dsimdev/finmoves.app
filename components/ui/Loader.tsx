import type { CSSProperties } from "react";

// Loader único de la app: dos arcos (blades) contrarrotando en colores de marca
// (blue / cyan / green). Estilo + animación en `.fm-ring` (globals.css), exceptuado de
// prefers-reduced-motion vía la clase `spin`, así gira aunque el sistema tenga el
// movimiento reducido activado.
//
// `color` fuerza un color sólido para las blades: útil sobre fondos donde el gradiente
// de marca no contrasta (p.ej. un botón que ya es ese gradiente → usar "#fff").
export function Loader({ size = 48, thickness = 4, color }: { size?: number; thickness?: number; color?: string }) {
  const style = {
    width: size,
    height: size,
    "--fm-ring-w": `${thickness}px`,
    ...(color ? { "--fm-ring-c1": color, "--fm-ring-c2": color, "--fm-ring-c3": color } : {}),
  } as CSSProperties;

  return <span className="fm-ring" role="status" aria-label="Cargando" style={style} />;
}
