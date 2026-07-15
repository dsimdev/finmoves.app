// Identidad de un recurrente = tipo + categoría + descripción + OBSERVACIÓN.
// La observación SÍ distingue (ej. GAMES·STEAM·"ESO+" y GAMES·STEAM·"ESO Pass" son dos
// recurrentes distintos, y el usuario marca solo el que quiere). Por eso la normalización
// tiene que ser IDÉNTICA en los tres lugares que la usan, o un recurrente matchea de más /
// de menos: el doc id (services/firebase/recurrentes), el relojito del cliente (movements)
// y el cron (notifications). Antes cada uno normalizaba distinto (obs vacía → "_" vs "",
// y el slug reemplazaba caracteres especiales que las otras no) → posibles desalineaciones.

// Campos mínimos para derivar la clave.
export type RecurrentKeyFields = {
  tipo: string;
  categoria: string;
  descripcion?: string;
  observaciones?: string;
};

// Normaliza un campo de texto: trim + minúsculas. Vacío queda vacío (NO "_"): así el
// relojito y el cron, que comparan con "", coinciden con el doc.
const norm = (s?: string) => (s || "").trim().toLowerCase();

// Clave canónica (lógica) de un recurrente: la MISMA en cliente y cron para comparar.
export function recurrentKey(f: RecurrentKeyFields): string {
  return `${f.tipo}__${f.categoria}__${norm(f.descripcion)}__${norm(f.observaciones)}`;
}

// Id de documento Firestore: la clave canónica saneada (Firestore no admite / . # $ [ ]).
// Deriva de la MISMA clave canónica → el doc id y la comparación lógica nunca divergen.
export function recurrentDocId(f: RecurrentKeyFields): string {
  return recurrentKey(f).replace(/[/.#$[\]]/g, "-").slice(0, 250);
}
