"use client";

import Image from "next/image";
import { useSwUpdate } from "@/hooks/useSwUpdate";
import { useT } from "@/hooks/useTranslation";

export function UpdateBanner() {
  const waiting = useSwUpdate((s) => s.waiting);
  const t = useT();
  if (!waiting) return null;

  const applyUpdate = () => {
    // Pide al SW en espera que se active; controllerchange disparará el reload.
    waiting.postMessage({ type: "SKIP_WAITING" });
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 99999,
      background: "rgba(0,0,0,0.6)",
      backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
    }}>
      <div className="fade-up" style={{
        position: "relative", overflow: "hidden",
        background: "color-mix(in srgb, var(--surface) 80%, transparent)",
        backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
        border: "1px solid var(--border-hi, var(--border))",
        borderRadius: 28, padding: "40px 32px 32px",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 22,
        maxWidth: 320, width: "100%", textAlign: "center",
        boxShadow: "0 24px 64px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)",
      }}>
        {/* Glow superior */}
        <div aria-hidden style={{
          position: "absolute", top: -80, left: "50%", transform: "translateX(-50%)",
          width: 260, height: 200,
          background: "radial-gradient(ellipse, var(--blue) 0%, transparent 70%)",
          opacity: 0.22, filter: "blur(30px)", pointerEvents: "none",
        }} />

        {/* Logo + spinner — misma proporción que la pantalla de carga (logo ≈ 0.43 del ring) */}
        <div style={{ position: "relative", width: 150, height: 150 }}>
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Image src="/favicon.png" alt="FinMoves" width={64} height={64} style={{ opacity: 0.95 }} />
          </div>
          <div className="spin" style={{
            position: "absolute", inset: 0, borderRadius: "50%",
            border: "4px solid transparent",
            borderTopColor: "#536dfe",
            borderRightColor: "#3d8ef8",
            borderBottomColor: "#00c896",
            borderLeftColor: "#00e676",
          }} />
        </div>

        <div style={{ position: "relative" }}>
          <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 7, letterSpacing: -0.3 }}>{t.newVersionAvailable}</div>
          <div style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.5 }}>{t.updateToSeeLatest}</div>
        </div>

        <button
          onClick={applyUpdate}
          className="btn"
          style={{
            position: "relative", width: "100%", height: 50, borderRadius: 14, border: "none",
            background: "linear-gradient(110deg, var(--blue) 10%, var(--green) 130%)",
            color: "#fff", fontSize: 14.5, fontWeight: 700, cursor: "pointer",
            boxShadow: "0 8px 24px color-mix(in srgb, var(--blue) 40%, transparent)",
          }}
        >
          {t.update}
        </button>
      </div>
    </div>
  );
}
