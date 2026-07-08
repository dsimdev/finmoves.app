"use client";

import { useEffect, useState } from "react";
import { usePendingWrites } from "@/hooks/useSyncStatus";
import { useT } from "@/hooks/useTranslation";
import { Loader } from "@/components/ui/Loader";

// Chip "sincronizando…" cuando hay writes de movimientos en vuelo y hay conexión.
// El caso sin conexión ya lo cubre OfflineBanner (mismo lugar), así que no se encima:
// acá exigimos online para no mostrar los dos a la vez.
export function SyncIndicator() {
  const pending = usePendingWrites();
  const [online, setOnline] = useState(true);
  const t = useT();

  useEffect(() => {
    const upd = () => setOnline(navigator.onLine);
    upd();
    window.addEventListener("online", upd);
    window.addEventListener("offline", upd);
    return () => { window.removeEventListener("online", upd); window.removeEventListener("offline", upd); };
  }, []);

  if (pending <= 0 || !online) return null;

  return (
    <div style={{
      position: "fixed", left: 0, right: 0, top: "calc(12px + env(safe-area-inset-top, 0px))",
      zIndex: 9000, display: "flex", justifyContent: "center", pointerEvents: "none",
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        background: "var(--surface)", color: "var(--muted)",
        border: "1px solid var(--border)", borderRadius: 999,
        padding: "8px 16px", fontSize: 12, fontWeight: 600,
        boxShadow: "0 6px 20px rgba(0,0,0,0.3)",
      }}>
        <Loader size={15} />
        {t.syncing}
      </div>
    </div>
  );
}
