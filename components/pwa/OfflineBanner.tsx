"use client";

import { useEffect, useState } from "react";
import { useT } from "@/hooks/useTranslation";

export function OfflineBanner() {
  const t = useT();
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!offline) return null;

  return (
    <div style={{
      position: "fixed", left: 0, right: 0, bottom: "calc(64px + env(safe-area-inset-bottom, 0px))",
      zIndex: 9000, display: "flex", justifyContent: "center", pointerEvents: "none",
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        background: "var(--red-dim)", color: "var(--red)",
        border: "1px solid var(--red)44", borderRadius: 999,
        padding: "8px 16px", fontSize: 12, fontWeight: 700,
        boxShadow: "0 6px 20px rgba(0,0,0,0.3)",
      }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--red)" }} />
        {t.offline}
      </div>
    </div>
  );
}
