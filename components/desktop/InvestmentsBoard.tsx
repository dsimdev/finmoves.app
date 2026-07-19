"use client";

import { useT } from "@/hooks/useTranslation";
import { useMoney } from "@/hooks/useHideValues";
import { EyeIcon } from "@/components/ui/EyeIcon";

// Tablero de Inversión para escritorio. En móvil cada dato vive en su card porque la
// pantalla es angosta y hay que scrollear; acá las cards no aportan —solo encierran— así
// que los números salen sueltos sobre una franja superior y el marco queda para lo que sí
// es una unidad: las metas con su barra de progreso.

export type Kpi = {
  label: string;
  value: string;
  /** Línea chica bajo el número (equivalencia, precio promedio, ganancia…). */
  sub?: string;
  color?: string;
  /** El número principal del tablero: más grande que el resto. */
  hero?: boolean;
};

/** Grupo de KPIs que son el MISMO tema (ej. reserva + precio promedio + ganancia son tu
 *  posición en divisa). Cada grupo es una card con su color, como en móvil. */
export type KpiGrupo = {
  titulo: string;
  /** Color de acento de la card: el mismo que tiene esa sección en móvil. */
  color?: string;
  kpis: Kpi[];
};

export type MetaBoard = {
  label: string;
  fecha?: string;
  /** Monto objetivo ya formateado. */
  objetivo: string;
  /** Cuánto falta, ya formateado. */
  faltante: string;
  pct: number;
  color: string;
  /** Mini-stats de la meta (ritmo, proyección, períodos para llegar). */
  stats?: { label: string; value: string }[];
  alcanzada?: boolean;
};

export function InvestmentsBoard({ grupos, metas, historial }: {
  /** KPIs agrupados por tema; cada grupo es una card, como en móvil. */
  grupos: KpiGrupo[];
  metas: MetaBoard[];
  /** Tabla del historial FX (se pasa armada desde la página). */
  historial?: React.ReactNode;
}) {
  const t = useT();
  const { oculto, toggle } = useMoney();

  return (
    <div className="inv-board">
      {/* Una card por tema (patrimonio, posición en divisa, ahorro), con el color que esa
          sección tiene en móvil. Los datos de un mismo tema van juntos adentro. */}
      <div className="inv-cards">
        {grupos.map((g, gi) => (
          <div key={g.titulo} className="soft inv-card" style={{ borderColor: g.color ? `color-mix(in srgb, ${g.color} 30%, var(--border))` : undefined }}>
            <div className="inv-card-head">
              <span className="inv-section-title" style={{ margin: 0, color: g.color ?? "var(--muted)" }}>{g.titulo}</span>
              {/* Un solo ojito para todo el tablero, en la primera card. */}
              {gi === 0 && (
                <button onClick={toggle} aria-label={t.hideValues} className="inv-eye">
                  <EyeIcon off={oculto} />
                </button>
              )}
            </div>
            <div className="inv-card-kpis">
              {g.kpis.map((k) => (
                <div key={k.label} className={k.hero ? "inv-kpi inv-kpi-hero" : "inv-kpi"}>
                  <div className="inv-kpi-label">{k.label}</div>
                  <div className="inv-kpi-value" style={{ color: k.color ?? "var(--text)" }}>{k.value}</div>
                  {k.sub && <div className="inv-kpi-sub">{k.sub}</div>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Metas: acá el marco SÍ aporta, porque barra + números son una unidad. */}
      {metas.length > 0 && (
        <div className="inv-metas">
          {metas.map((m) => (
            <div key={m.label} className="soft">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
                <span className="label" style={{ marginBottom: 0 }}>{m.label}</span>
                {m.fecha && <span style={{ fontSize: 10, color: "var(--muted)" }}>{m.fecha}</span>}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, marginBottom: 10 }}>
                <span style={{ fontSize: 26, fontWeight: 700, fontFamily: "var(--font-mono)", color: m.color }}>{m.objetivo}</span>
                <span style={{ fontSize: 13, color: "var(--muted)", fontFamily: "var(--font-mono)", whiteSpace: "nowrap" }}>
                  {m.alcanzada ? t.reached : `${t.remainingLabel} ${m.faltante}`}
                </span>
              </div>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: `${Math.min(m.pct, 100)}%`, background: m.color }} />
              </div>
              <div style={{ textAlign: "right", fontSize: 11, color: m.color, marginTop: 5, fontFamily: "var(--font-mono)" }}>{m.pct}%</div>
              {m.stats && m.stats.length > 0 && (
                <div className="inv-meta-stats">
                  {m.stats.map((s) => (
                    <div key={s.label}>
                      <div className="inv-kpi-label">{s.label}</div>
                      <div style={{ fontSize: 15, fontWeight: 700, fontFamily: "var(--font-mono)" }}>{s.value}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* El historial deja de vivir detrás del ícono de reloj: en escritorio hay lugar para
          mostrarlo, y es la parte que responde "de dónde salió esta reserva". */}
      {historial && (
        <section>
          <h2 className="inv-section-title">{t.usdHistory}</h2>
          {historial}
        </section>
      )}
    </div>
  );
}
