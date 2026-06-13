import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { ServiceWorkerRegister } from "@/components/pwa/ServiceWorkerRegister";
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
  title: "FinMoves",
  description: "Gestor de finanzas personales",
  manifest: "/manifest.json",
  applicationName: "FinMoves",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "FinMoves",
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
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
