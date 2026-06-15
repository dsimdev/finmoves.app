import type { Metadata } from "next";
import { PrivacidadContent } from "@/components/legal/PrivacidadContent";

export const metadata: Metadata = {
  title: "Política de Privacidad · FinMoves",
  description: "Cómo FinMoves trata tus datos.",
};

export default function PrivacidadPage() {
  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "48px 24px 80px", color: "var(--text)", lineHeight: 1.7, fontSize: 15 }}>
      <PrivacidadContent />
      <p style={{ marginTop: 32 }}>
        <a href="/terminos" style={{ color: "var(--blue)", textDecoration: "underline" }}>Condiciones del Servicio</a>
        {" · "}
        <a href="/inicio" style={{ color: "var(--muted)", textDecoration: "none" }}>← Inicio</a>
      </p>
    </main>
  );
}
