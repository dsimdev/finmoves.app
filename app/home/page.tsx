import type { Metadata } from "next";
import { HomeClient } from "./HomeClient";

export const metadata: Metadata = {
  title: "FinMoves — Tus finanzas personales, claras",
  description: "FinMoves es una app personal para registrar tus gastos e ingresos, ver reportes, seguir tus ahorros e inversiones en dólares/euros y recibir recordatorios. Acceso por invitación.",
  alternates: { canonical: "/home" },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "FinMoves",
  url: "https://finmoves.app",
  applicationCategory: "FinanceApplication",
  operatingSystem: "Web, Android, iOS",
  inLanguage: "es",
  description:
    "App personal para registrar gastos e ingresos por período, ver reportes, seguir ahorros e inversiones en dólares/euros y recibir recordatorios. Acceso por invitación.",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  publisher: {
    "@type": "Organization",
    name: "FinMoves",
    url: "https://finmoves.app",
    logo: "https://finmoves.app/icon-512.png",
  },
};

export default function HomePage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <HomeClient />
    </>
  );
}
