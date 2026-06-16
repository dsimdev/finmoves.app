import type { MetadataRoute } from "next";

// El contenido de la app está detrás de login (invite-only); igualmente
// se listan en el sitemap solo las páginas públicas.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: "https://finmoves.app/sitemap.xml",
    host: "https://finmoves.app",
  };
}
