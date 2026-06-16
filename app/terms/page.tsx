import type { Metadata } from "next";
import { TermsContent } from "@/components/legal/TermsContent";

export const metadata: Metadata = {
  title: "Condiciones del Servicio · FinMoves",
  description: "Condiciones de uso de FinMoves.",
};

export default function TermsPage() {
  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "48px 24px 80px", color: "var(--text)", lineHeight: 1.7, fontSize: 15 }}>
      <TermsContent />
      <p style={{ marginTop: 32 }}>
        <a href="/privacy" style={{ color: "var(--blue)", textDecoration: "underline" }}>Política de Privacidad</a>
        {" · "}
        <a href="/home" style={{ color: "var(--muted)", textDecoration: "none" }}>← Inicio</a>
      </p>
    </main>
  );
}
