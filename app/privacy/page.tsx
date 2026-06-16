import type { Metadata } from "next";
import { PrivacyContent } from "@/components/legal/PrivacyContent";

export const metadata: Metadata = {
  title: "Política de Privacidad · FinMoves",
  description: "Cómo FinMoves trata tus datos.",
};

export default function PrivacyPage() {
  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "48px 24px 80px", color: "var(--text)", lineHeight: 1.7, fontSize: 15 }}>
      <PrivacyContent />
      <p style={{ marginTop: 32 }}>
        <a href="/terms" style={{ color: "var(--blue)", textDecoration: "underline" }}>Condiciones del Servicio</a>
        {" · "}
        <a href="/home" style={{ color: "var(--muted)", textDecoration: "none" }}>← Inicio</a>
      </p>
    </main>
  );
}
