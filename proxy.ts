import { NextRequest, NextResponse } from "next/server";

function buildCsp(nonce: string): string {
  return [
    "default-src 'self'",
    // 'unsafe-inline' ignored by nonce-aware browsers ('strict-dynamic' takes precedence).
    // Kept as fallback for legacy browsers that don't support nonces.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-inline' https://www.googletagmanager.com https://apis.google.com https://www.gstatic.com https://www.google.com`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https://fonts.gstatic.com",
    "connect-src 'self' https: wss:",
    "frame-src 'self' https://*.firebaseapp.com https://firebasestorage.googleapis.com https://apis.google.com https://accounts.google.com https://www.google.com",
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
    "upgrade-insecure-requests",
  ].join("; ");
}

export function proxy(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  if (process.env.NODE_ENV === "production") {
    response.headers.set("content-security-policy", buildCsp(nonce));
  }

  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon\\.|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
