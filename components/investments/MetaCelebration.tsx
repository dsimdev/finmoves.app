"use client";

import { useEffect, useState } from "react";
import { useT } from "@/hooks/useTranslation";

// Festejo del cruce de un hito de la meta propia (50/75/100%). Aparece sobre la pantalla
// donde estés al cargar el movimiento que cruzó el hito, porque ese es el instante en que
// el número cambia y lo estás mirando. Se va solo; tocarlo lo cierra antes.
// El confeti respeta prefers-reduced-motion vía la regla global de globals.css.

const DURACION_MS = 4000;
const PIEZAS = 14;

export function MetaCelebration({ hito, onDone }: { hito: number; onDone: () => void }) {
  const t = useT();
  const [saliendo, setSaliendo] = useState(false);

  useEffect(() => {
    const irse = setTimeout(() => setSaliendo(true), DURACION_MS);
    const cerrar = setTimeout(onDone, DURACION_MS + 300);
    return () => { clearTimeout(irse); clearTimeout(cerrar); };
  }, [onDone]);

  const esMetaCompleta = hito >= 100;
  const color = esMetaCompleta ? "var(--green)" : "var(--blue)";
  const titulo = esMetaCompleta ? t.metaHitoFullTitle : t.metaHitoTitle.replace("{pct}", String(hito));

  return (
    <div
      role="status"
      aria-live="polite"
      onClick={() => setSaliendo(true)}
      style={{
        position: "fixed", left: "50%",
        bottom: "calc(var(--nav-h) + env(safe-area-inset-bottom, 0px) + 16px)",
        transform: `translateX(-50%) translateY(${saliendo ? "12px" : "0"})`,
        opacity: saliendo ? 0 : 1,
        transition: "opacity .3s ease, transform .3s ease",
        background: "var(--surface)", color: "var(--text)",
        border: `1px solid ${color}`, borderRadius: 16,
        padding: "14px 20px", zIndex: 200, maxWidth: "min(92vw, 340px)",
        boxShadow: "0 6px 24px rgba(0,0,0,0.3)", cursor: "pointer",
      }}
    >
      {/* Confeti: piezas en arco sobre la card, con delay escalonado. */}
      <div aria-hidden style={{ position: "absolute", inset: 0, overflow: "visible", pointerEvents: "none" }}>
        {Array.from({ length: PIEZAS }).map((_, i) => (
          <span key={i} style={{
            position: "absolute", left: `${(i / (PIEZAS - 1)) * 100}%`, top: 0,
            width: 6, height: 6, borderRadius: i % 3 === 0 ? "50%" : 1,
            background: [color, "var(--yellow)", "var(--text-dim)"][i % 3],
            animation: `meta-confetti 1.1s ease-out ${i * 0.05}s both`,
          }} />
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 26, lineHeight: 1 }}>{esMetaCompleta ? "🎉" : "🚀"}</span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color }}>{titulo}</div>
          <div style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 2 }}>
            {esMetaCompleta ? t.metaHitoFullBody : t.metaHitoBody}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes meta-confetti {
          0%   { opacity: 0; transform: translateY(0) scale(.6); }
          25%  { opacity: 1; }
          100% { opacity: 0; transform: translateY(-42px) translateX(var(--dx, 0)) rotate(220deg) scale(1); }
        }
      `}</style>
    </div>
  );
}
