// Helpers de versiones del changelog (sirven en cliente y servidor, sin DOM/node).

// Cada 5 versiones nuevas mostramos el aviso de novedades (banner + push).
export const UPDATE_BANNER_THRESHOLD = 5;

// Parsea las versiones de un CHANGELOG markdown ("## [x.y.z]"),
// devueltas de la más nueva a la más vieja (orden del archivo).
export function parseChangelogVersions(md: string): string[] {
  const re = /^##\s*\[(\d+\.\d+\.\d+)\]/gm;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(md)) !== null) out.push(m[1]);
  return out;
}

// Cuántos releases hay entre `from` (exclusivo) y `to` (inclusive), sobre la
// lista ordenada nueva→vieja. Si `from` es null o no está en la lista, Infinity.
// Si `to` no está listado aún, 0 (no molestar hasta que el changelog lo registre).
export function releasesSince(versions: string[], from: string | null, to: string): number {
  const idxTo = versions.indexOf(to);
  if (idxTo === -1) return 0;
  if (!from) return Infinity;
  const idxFrom = versions.indexOf(from);
  if (idxFrom === -1) return Infinity;
  return idxFrom - idxTo;
}
