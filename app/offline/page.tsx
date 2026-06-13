"use client";

import Image from "next/image";
import { useT } from "@/hooks/useTranslation";

// Fallback que muestra el service worker cuando no hay red y la ruta no está en caché.
export default function OfflinePage() {
  const t = useT();
  return (
    <div style={{
      minHeight: "100dvh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: 18, padding: 24, textAlign: "center",
    }}>
      <Image src="/favicon.png" alt="FinMoves" width={72} height={72} style={{ opacity: 0.9 }} priority />
      <div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{t.offline}</div>
        <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6, maxWidth: 320 }}>{t.offlineBody}</div>
      </div>
      <button onClick={() => location.reload()} style={{
        height: 46, padding: "0 24px", borderRadius: 14, border: "none", cursor: "pointer",
        background: "linear-gradient(110deg, var(--blue) 10%, var(--green) 130%)",
        color: "#fff", fontSize: 14, fontWeight: 700,
      }}>{t.retry}</button>
    </div>
  );
}
