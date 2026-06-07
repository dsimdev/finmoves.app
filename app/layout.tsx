import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FinMoves",
  description: "Gestor de finanzas personales",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "FinMoves",
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
        <meta name="theme-color" content="#08080f" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <script dangerouslySetInnerHTML={{ __html: `try{if(localStorage.getItem('finmoves-theme')!=='dark'){var s=document.documentElement.style;s.setProperty('--bg','#c8c8c8');s.setProperty('--surface','#f4f4f4');s.setProperty('--surface-alt','#e4e4e4');s.setProperty('--border','#b8b8b8');s.setProperty('--border-hi','#909090');s.setProperty('--accent-dim','#00b4ff28');s.setProperty('--green','#007a38');s.setProperty('--green-dim','#007a3822');s.setProperty('--red-dim','#ff525222');s.setProperty('--yellow','#a06200');s.setProperty('--yellow-dim','#a0620022');s.setProperty('--blue-dim','#536dfe22');s.setProperty('--text','#0d1524');s.setProperty('--muted','#4a5060');s.setProperty('--faint','#d0d0d0');document.documentElement.setAttribute('data-theme','light');}}catch(e){}` }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
