import { Cotizacion } from "@/types";

const API_URL = "https://api.bluelytics.com.ar/v2/latest";
const CACHE_TTL = 1000 * 60 * 30;

let cache: { data: Cotizacion; ts: number } | null = null;

export async function getCotizacion(): Promise<Cotizacion | null> {
  if (cache && Date.now() - cache.ts < CACHE_TTL) {
    return { ...cache.data, fuente: "cache" };
  }

  try {
    const res = await fetch(API_URL);
    const json = await res.json();
    const data: Cotizacion = {
      blue: json.blue.value_sell,
      oficial: json.oficial.value_sell,
      blue_euro: json.blue_euro?.value_sell,
      oficial_euro: json.oficial_euro?.value_sell,
      fuente: "api",
      timestamp: new Date(),
    };
    cache = { data, ts: Date.now() };
    return data;
  } catch {
    if (cache) return { ...cache.data, fuente: "cache" };
    return null;
  }
}

