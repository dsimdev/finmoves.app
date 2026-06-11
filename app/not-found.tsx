"use client";

import Link from "next/link";
import { useT } from "@/hooks/useTranslation";

export default function NotFound() {
  const t = useT();
  return (
    <div style={{
      minHeight: "100dvh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", textAlign: "center",
      padding: 24, gap: 16,
    }}>
      <div style={{
        fontSize: 64, fontWeight: 800, letterSpacing: -2, lineHeight: 1,
        background: "linear-gradient(110deg, var(--blue) 10%, var(--green) 90%)",
        WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
      }}>404</div>
      <div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>{t.notFoundTitle}</div>
        <div style={{ fontSize: 13, color: "var(--muted)" }}>{t.notFoundBody}</div>
      </div>
      <Link href="/" className="btn btn-primary" style={{ height: 42, padding: "0 20px", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", textDecoration: "none" }}>
        {t.notFoundHome}
      </Link>
    </div>
  );
}
