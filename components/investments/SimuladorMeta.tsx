"use client";

import { useState } from "react";
import { useT } from "@/hooks/useTranslation";
import { simularMeta } from "@/utils/simulador-meta";

// Simulador "¿Y si…?" de una meta: se despliega dentro de la card y deja mover una perilla para
// ver cuántos períodos antes se llega. No toca datos — solo re-proyecta con un extra.
//
// Trabaja en la UNIDAD de la meta (pesos para la propia, divisa para la FX): quien lo usa pasa
// `faltante` y `ritmo` en esa unidad y `formatMonto` para mostrarla. Cada meta define sus
// perillas (ver `perillas`).

export interface Perilla {
  /** Etiqueta del modo ("Ahorro más", "Recorto un gasto", "Compro más"). */
  label: string;
  /** Texto del control (ej. "Guardo por período", "Compro por período"). */
  control: string;
  /** Máximo del slider, en la unidad de la meta. */
  max: number;
  /** Paso del slider. */
  step: number;
}

export function SimuladorMeta({ faltante, ritmo, formatMonto, color, perillas }: {
  faltante: number;
  ritmo: number | null;
  /** Formatea un monto en la unidad de la meta (con símbolo). */
  formatMonto: (n: number) => string;
  /** Acento de la meta (violeta la propia, amarillo la FX). */
  color: string;
  perillas: Perilla[];
}) {
  const t = useT();
  const [abierto, setAbierto] = useState(false);
  const [modo, setModo] = useState(0);
  const [extra, setExtra] = useState(0);

  const p = perillas[modo];
  const sim = simularMeta(faltante, ritmo, extra);

  const cambiarModo = (i: number) => { setModo(i); setExtra(0); };

  return (
    <div style={{ marginTop: 12, borderTop: "1px solid var(--faint)", paddingTop: 12 }}>
      {/* Disparador: un "¿Y si…?" chico. La card no crece hasta que se abre. */}
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        style={{
          display: "flex", alignItems: "center", gap: 7, width: "100%", background: "none",
          border: "none", padding: 0, cursor: "pointer", color: abierto ? color : "var(--muted)",
          fontSize: 12, fontWeight: 700,
        }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20v-6M6 20v-4M18 20v-8M3 20h18" /></svg>
        {t.simWhatIf}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ marginLeft: "auto", transform: abierto ? "rotate(180deg)" : "none", transition: "transform .2s" }}><polyline points="6 9 12 15 18 9" /></svg>
      </button>

      {/* Despliegue suave por grid (0fr→1fr): anima la altura sin conocerla, sin el salto del
          max-height. La animación se corta con prefers-reduced-motion (globals.css). */}
      <div className="sim-collapse" data-open={abierto} style={{ display: "grid", gridTemplateRows: abierto ? "1fr" : "0fr", transition: "grid-template-rows .24s ease" }}>
        <div style={{ overflow: "hidden" }}>
          <div style={{ paddingTop: 14 }}>
            {/* Modos, solo si hay más de uno (la meta FX tiene uno). */}
            {perillas.length > 1 && (
              <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
                {perillas.map((per, i) => (
                  <button key={per.label} type="button" onClick={() => cambiarModo(i)} aria-pressed={modo === i}
                    style={{
                      flex: 1, padding: "8px 4px", borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: "pointer",
                      background: modo === i ? "color-mix(in srgb, " + color + " 16%, transparent)" : "transparent",
                      border: `1px solid ${modo === i ? color : "var(--border)"}`,
                      color: modo === i ? color : "var(--muted)", transition: "all .15s",
                    }}>{per.label}</button>
                ))}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>{p.control}</span>
              <span style={{ fontSize: 15, fontWeight: 800, fontFamily: "var(--font-mono)", color }}>+{formatMonto(extra)}</span>
            </div>
            <input
              type="range" min={0} max={p.max} step={p.step} value={Math.min(extra, p.max)}
              onChange={(e) => setExtra(Number(e.target.value))}
              aria-label={p.control}
              className="sim-range"
              style={{ ["--sim-accent" as string]: color, ["--sim-fill" as string]: `${(Math.min(extra, p.max) / p.max) * 100}%` }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--muted)", fontFamily: "var(--font-mono)", marginTop: 2 }}>
              <span>+{formatMonto(0)}</span><span>+{formatMonto(p.max)}</span>
            </div>

            {/* Resultado: hoy → simulado. */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16, padding: "13px 14px", background: "var(--surface-alt)", borderRadius: "var(--radius-sm)" }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 18, fontWeight: 800, fontFamily: "var(--font-mono)", color: "var(--muted)" }}>{sim.periodosBase == null ? "—" : sim.periodosBase}</div>
                <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--muted)", marginTop: 2 }}>{t.simNow}</div>
              </div>
              <span style={{ color: "var(--muted)", fontSize: 16 }}>→</span>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 24, fontWeight: 800, fontFamily: "var(--font-mono)", color: sim.periodosMenos && sim.periodosMenos > 0 ? "var(--green)" : "var(--text)" }}>{sim.periodosSimulado == null ? "—" : sim.periodosSimulado}</div>
                <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--muted)", marginTop: 2 }}>{t.periodsShort}</div>
              </div>
              <div style={{ marginLeft: "auto", textAlign: "right", fontSize: 12, color: "var(--muted)", maxWidth: "14ch" }}>
                {extra === 0
                  ? t.simNoChange
                  : sim.periodosMenos && sim.periodosMenos > 0
                    ? <span dangerouslySetInnerHTML={{ __html: t.simEarlier(sim.periodosMenos) }} />
                    : sim.periodosBase == null && sim.periodosSimulado != null
                      ? t.simUnblocks
                      : t.simKeepGoing}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
