import type { Movimiento } from "@/types";

// Búsqueda por PALABRA EXACTA sobre categoría + descripción + observaciones. Case-insensitive
// y sin tildes se resuelve por la partición en palabras: "car" pega en "Car" pero NO en
// "carga"/"recarga". Compartido por /analisis y el filtro in-place de Movimientos.

export const words = (s: string): string[] => s.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);

// ¿El texto (ya partido en palabras) contiene TODAS las palabras del término?
export const termMatches = (textWords: Set<string>, term: string): boolean => {
  const tw = words(term);
  return tw.length > 0 && tw.every((qw) => textWords.has(qw));
};

// Conjunto de palabras buscables de un movimiento (categoría + descripción + observaciones).
export const movWords = (m: Movimiento): Set<string> =>
  new Set(words(`${m.categoria ?? ""} ${m.descripcion ?? ""} ${m.observaciones ?? ""}`));

// ¿El movimiento matchea AL MENOS UNO de los términos (OR)?
export const movMatchesAny = (m: Movimiento, terms: string[]): boolean => {
  if (terms.length === 0) return false;
  const tw = movWords(m);
  return terms.some((term) => termMatches(tw, term));
};
