"use client";

import Image from "next/image";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";
import { useT } from "@/hooks/useTranslation";

export function InstallBanner() {
  const { canInstall, promptInstall } = useInstallPrompt();
  const t = useT();

  if (!canInstall) return null;

  const accentBorder = "color-mix(in srgb, var(--accent) 40%, transparent)";
  return (
    <div style={{
      position: "fixed", left: 0, right: 0, bottom: "calc(var(--nav-h) + 12px + env(safe-area-inset-bottom, 0px))",
      zIndex: 8999, display: "flex", justifyContent: "center", padding: "0 12px", pointerEvents: "none",
    }}>
      <div style={{
        pointerEvents: "all", display: "flex", alignItems: "center", gap: 12,
        background: "var(--surface)", border: `1px solid ${accentBorder}`, borderRadius: 16,
        padding: "10px 12px", boxShadow: "0 10px 30px rgba(0,0,0,0.4)", maxWidth: 440, width: "100%",
      }}>
        <div style={{ width: 40, height: 40, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 12, background: "var(--accent-dim)", border: `1px solid ${accentBorder}` }}>
          <Image src="/favicon.png" alt="" width={24} height={24} style={{ opacity: 0.95 }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>{t.installTitle}</div>
          <div style={{ fontSize: 11, color: "var(--muted)" }}>{t.installBody}</div>
        </div>
        <button onClick={promptInstall} style={{
          flexShrink: 0,
          background: "linear-gradient(110deg, var(--blue) 10%, var(--green) 130%)",
          color: "#fff", border: "none", borderRadius: 10,
          padding: "8px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer",
        }}>{t.installAction}</button>
      </div>
    </div>
  );
}
