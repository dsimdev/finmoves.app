import type { NextConfig } from "next";
import { version } from "./package.json";

// CSP solo en producción: en dev rompería el HMR (usa eval/inline).
// script/style 'unsafe-inline' es necesario porque Next y React inyectan
// scripts de bootstrap y estilos inline (style={{...}}) en toda la app.
// connect-src https:/wss: deja pasar Firebase/Google/APIs sin enumerarlos uno a uno.
const CSP = [
  "default-src 'self'",
  // apis.google.com + gstatic: Firebase Auth / login con Google. googletagmanager: analytics.
  "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://apis.google.com https://www.gstatic.com",
  // fonts.googleapis.com: hoja de estilos de Google Fonts (import en globals.css).
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https://fonts.gstatic.com",
  "connect-src 'self' https: wss:",
  // accounts.google.com + apis.google.com: popup/iframe del login con Google.
  "frame-src 'self' https://*.firebaseapp.com https://firebasestorage.googleapis.com https://apis.google.com https://accounts.google.com",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  "upgrade-insecure-requests",
].join("; ");

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: version,
  },
  async redirects() {
    // La landing pasó de /inicio a /home. Redirect permanente para no romper
    // links viejos, lo indexado por Google ni la config de OAuth.
    return [{ source: "/inicio", destination: "/home", permanent: true }];
  },
  async headers() {
    const headers = [
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
      { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
    ];
    if (process.env.NODE_ENV === "production") {
      headers.push({ key: "Content-Security-Policy", value: CSP });
    }
    return [{ source: "/:path*", headers }];
  },
};

export default nextConfig;
