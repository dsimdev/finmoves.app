import type { NextConfig } from "next";
import { version } from "./package.json";

// CSP is handled dynamically per-request in middleware.ts (nonce-based).
// Only static security headers live here.
const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: version,
  },
  async redirects() {
    return [
      { source: "/inicio", destination: "/home", permanent: true },
      { source: "/privacidad", destination: "/privacy", permanent: true },
      { source: "/terminos", destination: "/terms", permanent: true },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
        ],
      },
    ];
  },
};

export default nextConfig;
