"use client";

import Image from "next/image";
import { useVersionCheck } from "@/hooks/useVersionCheck";
import { useT } from "@/hooks/useTranslation";

export function UpdateBanner() {
  const hasUpdate = useVersionCheck();
  const t = useT();
  if (!hasUpdate) return null;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 99999,
      background: "rgba(0,0,0,0.75)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        background: "var(--bg)", borderRadius: 24, padding: "36px 32px",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 20,
        maxWidth: 300, width: "90%", textAlign: "center",
        boxShadow: "0 24px 64px rgba(0,0,0,0.4)",
      }}>
        <div style={{ position: "relative", width: 120, height: 120 }}>
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Image src="/favicon.png" alt="FinMoves" width={72} height={72} style={{ opacity: 0.95 }} />
          </div>
          <div className="spin" style={{
            position: "absolute", inset: 0, borderRadius: "50%",
            border: "3px solid transparent",
            borderTopColor: "#536dfe",
            borderRightColor: "#3d8ef8",
            borderBottomColor: "#00c896",
            borderLeftColor: "#00e676",
          }} />
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>{t.newVersionAvailable}</div>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>{t.updateToSeeLatest}</div>
        </div>
        <button
          onClick={() => window.location.reload()}
          style={{
            width: "100%", padding: "14px 0", borderRadius: 12, border: "none",
            background: "var(--blue)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer",
          }}
        >
          {t.update}
        </button>
      </div>
    </div>
  );
}
