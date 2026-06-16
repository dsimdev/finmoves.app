import type { MetadataRoute } from "next";

const BASE = "https://finmoves.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${BASE}/home`, lastModified: now, changeFrequency: "monthly", priority: 1 },
    { url: `${BASE}/login`, lastModified: now, changeFrequency: "yearly", priority: 0.5 },
    { url: `${BASE}/privacidad`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/terminos`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];
}
