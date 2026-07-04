import { Cotizacion } from "@/types";

const CACHE_TTL = 1000 * 60 * 30;
const LS_KEY = "finmoves.cotizacion";

let cache: { data: Cotizacion; ts: number } | null = null;
let inflight: Promise<Cotizacion | null> | null = null;

function readLS(): Cotizacion | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as Cotizacion;
    return { ...d, timestamp: new Date(d.timestamp) };
  } catch { return null; }
}

function writeLS(data: Cotizacion) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch { /* ignore */ }
}

async function fetchCotizacion(): Promise<Cotizacion | null> {
  // Último valor conocido (memoria → localStorage), para fallback y para
  // conservar el euro si el upstream no lo trae en esta consulta.
  const prev = cache?.data ?? readLS();
  try {
    const res = await fetch("/api/cotizacion");
    if (!res.ok) throw new Error("fetch");
    const j = await res.json();
    if (j.error || j.blue == null) throw new Error("empty");
    const data: Cotizacion = {
      blue: j.blue,
      oficial: j.oficial,
      blue_euro: j.blue_euro ?? prev?.blue_euro,
      oficial_euro: j.oficial_euro ?? prev?.oficial_euro,
      fuente: "api",
      timestamp: new Date(),
    };
    cache = { data, ts: Date.now() };
    writeLS(data);
    return data;
  } catch {
    if (prev) return { ...prev, fuente: "cache" };
    return null;
  }
}

export async function getCotizacion(): Promise<Cotizacion | null> {
  if (cache && Date.now() - cache.ts < CACHE_TTL) {
    return { ...cache.data, fuente: "cache" };
  }
  // Dedup: si ya hay un fetch en curso (p. ej. varios componentes montan a la vez con
  // caché fría), todos esperan la misma promesa en lugar de disparar fetches paralelos.
  if (!inflight) inflight = fetchCotizacion().finally(() => { inflight = null; });
  return inflight;
}

