import type { Metadata } from "next";
import { TerminosContent } from "@/components/legal/TerminosContent";

export const metadata: Metadata = {
  title: "Condiciones del Servicio · FinMoves",
  description: "Condiciones de uso de FinMoves.",
};

export default function TerminosPage() {
  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "48px 24px 80px", color: "var(--text)", lineHeight: 1.7, fontSize: 15 }}>
      <TerminosContent />
      <p style={{ marginTop: 32 }}>
        <a href="/privacidad" style={{ color: "var(--blue)", textDecoration: "underline" }}>Política de Privacidad</a>
        {" · "}
        <a href="/inicio" style={{ color: "var(--muted)", textDecoration: "none" }}>← Inicio</a>
      </p>
    </main>
  );
}
