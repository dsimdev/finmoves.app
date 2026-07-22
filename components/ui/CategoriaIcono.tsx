import { visualDeCategoria, type CategoriaIconoId } from "@/utils/categoria-visual";

// Ícono de categoría en "tinte": fondo suave + borde del color, el mismo tratamiento que la
// app ya usa en el héroe del detalle y en el panel de notificaciones. El color pertenece a la
// CATEGORÍA; el tipo de movimiento lo sigue diciendo el color del monto.
//
// Un solo componente para lista de movimientos, Reportes, Análisis y la tabla de escritorio:
// así el color viaja solo a todas las vistas.

const TRAZOS: Record<CategoriaIconoId, React.ReactNode> = {
  comida: <><path d="M3 2v7c0 1.1.9 2 2 2h1v11M7 2v6M5 2v6" /><path d="M17 2v20M17 11h4c0-5-2-9-4-9" /></>,
  transporte: <><path d="M5 17h14M5 17a2 2 0 0 1-2-2V9l2-5h14l2 5v6a2 2 0 0 1-2 2M7 20v-3M17 20v-3M3 9h18" /><circle cx="7.5" cy="13.5" r="1" /><circle cx="16.5" cy="13.5" r="1" /></>,
  hogar: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" />,
  salud: <path d="M20.8 5.6a5.5 5.5 0 0 0-7.8 0L12 6.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l8.8 8.8 8.8-8.8a5.5 5.5 0 0 0 0-7.8z" />,
  ocio: <><path d="M6 11h4M8 9v4M15 12h.01M18 10h.01" /><rect x="2" y="6" width="20" height="12" rx="4" /></>,
  compras: <><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><path d="M3 6h18M16 10a4 4 0 0 1-8 0" /></>,
  servicios: <><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" /></>,
  educacion: <><path d="M22 10 12 5 2 10l10 5 10-5z" /><path d="M6 12v5c0 1 2.7 2.5 6 2.5s6-1.5 6-2.5v-5" /></>,
  mascotas: <><circle cx="11" cy="4" r="2" /><circle cx="18" cy="8" r="2" /><circle cx="20" cy="16" r="2" /><path d="M9 10c-3 2-5 5-5 8a3 3 0 0 0 3 3c2 0 3-1 5-1s3 1 5 1" /></>,
  viajes: <path d="M17.8 19.2 16 11l3.5-3.5a2.1 2.1 0 0 0-3-3L13 8 4.8 6.2a1 1 0 0 0-.9 1.7l6.1 4-2.5 2.5-2.8-.6a1 1 0 0 0-.9 1.7l3 2 2 3a1 1 0 0 0 1.7-.9l-.6-2.8 2.5-2.5 4 6.1a1 1 0 0 0 1.7-.9z" />,
  tecnologia: <><rect x="2" y="4" width="20" height="13" rx="2" /><path d="M8 21h8M12 17v4" /></>,
  chancho: <><path d="M4 11a7 7 0 0 1 7-6h3a7 7 0 0 1 6.3 4H21a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-.7a7 7 0 0 1-2.3 3v2a1 1 0 0 1-1 1h-1.5a1 1 0 0 1-1-1v-.6a9 9 0 0 1-3 0v.6a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1v-2a7 7 0 0 1-3-5.4z" /><path d="M10 5V3.6M16.5 11h.01" /></>,
  // Operaciones de divisa: el signo $, en amarillo (no es elegible, ver FIJAS).
  divisa: <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />,
  billete: <><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /><path d="M6 12h.01M18 12h.01" /></>,
  farmacia: <><rect x="3" y="3" width="18" height="18" rx="4" /><path d="M12 8v8M8 12h8" /></>,
  otros: <><circle cx="12" cy="12" r="1.4" /><circle cx="19" cy="12" r="1.4" /><circle cx="5" cy="12" r="1.4" /></>,
};

export function CategoriaIcono({ categoria, size = 34 }: {
  /** La categoría con lo que haya guardado; sin ícono/color se deduce del nombre. */
  categoria: { nombre: string; icono?: string; color?: string };
  /** Lado de la caja. El glifo escala con ella. */
  size?: number;
}) {
  const { icono, hex } = visualDeCategoria(categoria);
  const glifo = Math.round(size * 0.5);

  return (
    <span
      aria-hidden
      style={{
        width: size, height: size, borderRadius: Math.round(size * 0.3), flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: `color-mix(in srgb, ${hex} 16%, transparent)`,
        border: `1px solid color-mix(in srgb, ${hex} 40%, transparent)`,
        color: hex,
      }}
    >
      <svg width={glifo} height={glifo} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        {TRAZOS[icono]}
      </svg>
    </span>
  );
}

/** Solo el glifo, sin la caja de tinte (para el selector de íconos). */
export function CategoriaGlifo({ icono, size = 18 }: { icono: CategoriaIconoId; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {TRAZOS[icono]}
    </svg>
  );
}
