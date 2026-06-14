"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import { useUpdateBanner } from "@/hooks/useUpdateBanner";
import { useT } from "@/hooks/useTranslation";

// Aviso de novedades (cada 5 versiones). Reusa el logo + spinner de la pantalla
// de carga. "Ver cambios" lleva a Configuración con el changelog abierto.
export function UpdateBanner() {
  const { show, dismiss } = useUpdateBanner();
  const router = useRouter();
  const t = useT();

  if (!show) return null;

  return (
    <div style={{
      position: "fixed", left: 0, right: 0, bottom: "calc(var(--nav-h) + 12px)",
      zIndex: 9000, display: "flex", justifyContent: "center", padding: "0 12px", pointerEvents: "none",
    }}>
      <div style={{
        pointerEvents: "all", display: "flex", alignItems: "center", gap: 12,
        background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16,
        padding: "10px 12px", boxShadow: "0 10px 30px rgba(0,0,0,0.4)", maxWidth: 440, width: "100%",
      }}>
        {/* Logo + spinner (como la pantalla de carga) */}
        <div style={{ position: "relative", width: 40, height: 40, flexShrink: 0 }}>
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Image src="/favicon.png" alt="" width={24} height={24} style={{ opacity: 0.95 }} />
          </div>
          <div className="spin" style={{
            position: "absolute", inset: 0, borderRadius: "50%", border: "3px solid transparent",
            borderTopColor: "#536dfe", borderRightColor: "#3d8ef8", borderBottomColor: "#00c896", borderLeftColor: "#00e676",
          }} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>{t.updateTitle}</div>
          <div style={{ fontSize: 11, color: "var(--muted)" }}>{t.updateBody}</div>
        </div>

        <button onClick={() => { dismiss(); router.push("/settings?changelog=1"); }} style={{
          flexShrink: 0, background: "linear-gradient(110deg, var(--blue) 10%, var(--green) 130%)",
          color: "#fff", border: "none", borderRadius: 10, padding: "8px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer",
        }}>{t.updateSeeChanges}</button>
        <button onClick={dismiss} aria-label="×" style={{
          flexShrink: 0, background: "none", border: "none", color: "var(--muted)", fontSize: 18, cursor: "pointer", padding: "0 2px",
        }}>×</button>
      </div>
    </div>
  );
}
