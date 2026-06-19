import type { Metadata, Viewport } from "next";
import { ServiceWorkerRegister } from "@/components/pwa/ServiceWorkerRegister";
import { FirebaseAnalytics } from "@/components/FirebaseAnalytics";
import { themeInitScript } from "@/lib/theme-init";
import "./globals.css";

// Color de barra del navegador / status bar. El default es el tema oscuro;
// el script de init lo ajusta al claro cuando corresponde (tema en localStorage).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#07090f",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://finmoves.app"),
  title: {
    default: "FinMoves — Tus finanzas personales, claras",
    template: "%s · FinMoves",
  },
  description:
    "Registrá gastos, ingresos, ahorros e inversiones por período. Reportes, metas y recordatorios. App personal, privada y sin publicidad. Acceso por invitación.",
  applicationName: "FinMoves",
  keywords: ["finanzas personales", "gastos", "presupuesto", "ahorros", "inversiones", "dólar", "euro", "app de finanzas", "FinMoves"],
  manifest: "/manifest.json",
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    siteName: "FinMoves",
    url: "https://finmoves.app",
    title: "FinMoves — Tus finanzas personales, claras",
    description: "Gastos, ingresos, ahorros e inversiones por período. Reportes, metas y recordatorios. Privada y sin publicidad.",
    locale: "es_AR",
    alternateLocale: ["en_US"],
  },
  twitter: {
    card: "summary_large_image",
    title: "FinMoves — Tus finanzas personales, claras",
    description: "Gastos, ingresos, ahorros e inversiones por período. Reportes, metas y recordatorios. Privada y sin publicidad.",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "FinMoves",
    startupImage: [
      { url: "/splash/750x1334.png",  media: "(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2)" },
      { url: "/splash/1125x2436.png", media: "(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3)" },
      { url: "/splash/1170x2532.png", media: "(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)" },
      { url: "/splash/1179x2556.png", media: "(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3)" },
      { url: "/splash/1284x2778.png", media: "(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3)" },
      { url: "/splash/1290x2796.png", media: "(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3)" },
    ],
  },
  icons: {
    icon: [
      { url: "/favicon.png", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        {children}
        <ServiceWorkerRegister />
        <FirebaseAnalytics />
      </body>
    </html>
  );
}
