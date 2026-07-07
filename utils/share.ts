// Parser best-effort del contenido compartido a la app (share target). Mercado Pago
// y otras apps mandan `title`/`text` sin formato estable, así que extraemos lo que se
// puede (monto y una descripción) para pre-llenar el alta; el usuario confirma.

export interface SharePrefill {
  monto?: number;
  descripcion?: string;
}

// Convierte un token numérico argentino ("1.234,56", "50.000", "3500") a número.
function parseMontoAR(token: string): number | undefined {
  let n = token;
  if (n.includes(",")) n = n.replace(/\./g, "").replace(",", ".");   // 1.234,56 → 1234.56
  else if (n.includes(".")) n = n.replace(/\./g, "");                 // 1.234 → 1234 (miles)
  const v = parseFloat(n);
  return Number.isFinite(v) && v > 0 ? v : undefined;
}

function extraerMonto(raw: string): number | undefined {
  // Preferir un monto con signo $ (formato típico AR: $1.234,56).
  const conSigno = raw.match(/\$\s*(\d[\d.]*(?:,\d{1,2})?)/);
  if (conSigno) { const m = parseMontoAR(conSigno[1]); if (m) return m; }
  // Fallback: número con miles (1.234), con decimales (1234,56) o entero de 3+ dígitos.
  const generico = raw.match(/\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+,\d{1,2}|\d{3,}/);
  return generico ? parseMontoAR(generico[0]) : undefined;
}

function extraerDescripcion(title: string, raw: string): string | undefined {
  const t = title.trim();
  if (t && !/^https?:\/\//i.test(t) && t.length <= 60) return t;
  // "…a Comercio" / "…para Comercio" (nombre del destinatario).
  const m = raw.match(/\b(?:a|para)\s+([\p{L}][\p{L}\p{N} .'&-]{1,40})/u);
  if (m) return m[1].trim().replace(/[.\s]+$/, "");
  return undefined;
}

export function parseShareMovimiento(title = "", text = ""): SharePrefill {
  const raw = [title, text].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  if (!raw) return {};
  const monto = extraerMonto(raw);
  const descripcion = extraerDescripcion(title, raw);
  return { ...(monto ? { monto } : {}), ...(descripcion ? { descripcion } : {}) };
}
