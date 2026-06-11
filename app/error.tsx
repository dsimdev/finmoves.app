"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useT } from "@/hooks/useTranslation";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useT();

  useEffect(() => {
    // El detalle queda en consola para diagnóstico
    console.error(error);
  }, [error]);

  return (
    <div style={{
      minHeight: "100dvh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", textAlign: "center",
      padding: 24, gap: 16,
    }}>
      <div style={{ fontSize: 40 }}>⚠️</div>
      <div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>{t.errorTitle}</div>
        <div style={{ fontSize: 13, color: "var(--muted)" }}>{t.errorBody}</div>
      </div>

      {/* Detalle técnico — visible a propósito para diagnóstico */}
      <pre style={{
        maxWidth: "min(520px, 100%)", width: "100%", textAlign: "left",
        background: "var(--surface-alt)", border: "1px solid var(--border)",
        borderRadius: "var(--radius-sm)", padding: 12, fontSize: 11,
        color: "var(--red)", whiteSpace: "pre-wrap", wordBreak: "break-word",
        maxHeight: 200, overflowY: "auto", fontFamily: "var(--font-mono)",
      }}>
        {error.message}{error.digest ? `\n\ndigest: ${error.digest}` : ""}
      </pre>

      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={reset} className="btn btn-primary" style={{ height: 42, padding: "0 20px", fontSize: 13, fontWeight: 700 }}>
          {t.errorRetry}
        </button>
        <Link href="/" className="btn" style={{ height: 42, padding: "0 20px", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", color: "var(--muted)", textDecoration: "none" }}>
          {t.errorHome}
        </Link>
      </div>
    </div>
  );
}
