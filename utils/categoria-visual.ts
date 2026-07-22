// Identidad visual de las categorías: ícono + color propios.
//
// REGLA DE COLOR: los tonos semánticos de la app están RESERVADOS y no se ofrecen acá —
// verde (ingreso), rojo (gasto), violeta (move a ahorro), teal (move a disponible),
// amarillo (compra/venta de divisa) y azul (RESTO). Si una categoría pudiera ser verde, un
// gasto suyo mostraría ícono verde junto a un monto rojo y se leería mal. Por eso la paleta
// de categorías es un set aparte, elegido para no confundirse con ninguno de esos seis.

export type CategoriaColor =
  | "rosa" | "magenta" | "naranja" | "oliva" | "lima"
  | "menta" | "cielo" | "indigo" | "arena" | "contraste";

/**
 * Paleta de categorías: diez tonos repartidos por el círculo cromático, sin dos vecinos que
 * se confundan de un vistazo (había tres naranjas y dos violetas casi iguales) y sin grises,
 * que no daban identidad y competían con el texto apagado.
 *
 * `contraste` es especial: no es un hex fijo sino `var(--text)`, o sea negro en tema claro y
 * blanco en oscuro. Guardar "negro" a secas dejaba el ícono invisible al cambiar de tema.
 */
export const COLORES_CATEGORIA: Record<CategoriaColor, string> = {
  rosa: "#ff6e9c",       // rosa fuerte
  magenta: "#d94ecc",    // magenta/fucsia
  naranja: "#ff8a3d",    // el único naranja
  oliva: "#9aa83a",      // verde oliva apagado
  lima: "#c6e64a",       // lima brillante
  menta: "#5fd3a8",      // verde menta
  cielo: "#5bb8e8",      // celeste
  indigo: "#7c6bf0",     // índigo
  arena: "#d9b878",      // arena / mostaza suave
  contraste: "var(--text)",
};

export const COLORES_LISTA = Object.keys(COLORES_CATEGORIA) as CategoriaColor[];

/** Íconos disponibles. El id se guarda en el doc; el trazo lo dibuja CategoriaIcono. */
export type CategoriaIconoId =
  | "comida" | "transporte" | "hogar" | "salud" | "farmacia" | "ocio"
  | "compras" | "servicios" | "educacion" | "mascotas" | "viajes"
  | "tecnologia" | "billete" | "chancho" | "divisa" | "otros";

export const ICONOS_LISTA: CategoriaIconoId[] = [
  "comida", "transporte", "hogar", "salud", "farmacia", "ocio",
  "compras", "servicios", "educacion", "mascotas", "viajes",
  "tecnologia", "billete", "chancho", "otros",
];

// Defaults por nombre: las categorías que ya existen no tienen ícono ni color guardados, así
// que se les deduce uno por su nombre. Se comparan sin tildes ni mayúsculas y por inclusión,
// para que "Comida y bebida" o "Super/comida" también peguen.
const REGLAS: { claves: string[]; icono: CategoriaIconoId; color: CategoriaColor }[] = [
  { claves: ["comida", "super", "almuerzo", "resto", "delivery", "food"], icono: "comida", color: "naranja" },
  { claves: ["transporte", "nafta", "combustible", "auto", "car", "peaje", "uber", "taxi"], icono: "transporte", color: "cielo" },
  { claves: ["hogar", "casa", "alquiler", "expensas", "home", "daily"], icono: "hogar", color: "arena" },
  { claves: ["farmacia", "medicament", "remedio", "pharmacy"], icono: "farmacia", color: "menta" },
  { claves: ["salud", "medic", "health", "obra social"], icono: "salud", color: "menta" },
  { claves: ["sueldo", "salario", "efectivo", "cobro", "honorario", "salary", "cash"], icono: "billete", color: "contraste" },
  { claves: ["ocio", "juego", "game", "salida", "cine", "bar"], icono: "ocio", color: "rosa" },
  { claves: ["compra", "ropa", "shopping", "indument"], icono: "compras", color: "magenta" },
  { claves: ["servicio", "luz", "gas", "internet", "netflix", "suscrip", "service"], icono: "servicios", color: "indigo" },
  { claves: ["educa", "curso", "libro", "escuela", "facultad"], icono: "educacion", color: "lima" },
  { claves: ["mascota", "perro", "gato", "vet", "loki"], icono: "mascotas", color: "arena" },
  { claves: ["regalo", "gift"], icono: "compras", color: "rosa" },
  { claves: ["viaje", "vacacion", "hotel", "vuelo", "travel"], icono: "viajes", color: "cielo" },
  { claves: ["trabajo", "oficina", "work"], icono: "billete", color: "contraste" },
  { claves: ["deporte", "gimnasio", "gym", "sport"], icono: "salud", color: "lima" },
  { claves: ["belleza", "peluqu", "estetica"], icono: "compras", color: "magenta" },
  { claves: ["tecno", "compu", "celular", "software", "tech"], icono: "tecnologia", color: "indigo" },
  { claves: ["ahorro", "reserva", "saving", "inversion", "invest"], icono: "chancho", color: "menta" },
];

const normalizar = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");

/** Ícono y color que le corresponden a una categoría por su nombre (para las que no eligieron). */
export function visualPorNombre(nombre: string): { icono: CategoriaIconoId; color: CategoriaColor } {
  const n = normalizar(nombre);
  for (const r of REGLAS) {
    if (r.claves.some((k) => n.includes(k))) return { icono: r.icono, color: r.color };
  }
  // Sin coincidencia: ícono neutro y un color estable derivado del nombre, para que dos
  // categorías distintas no caigan siempre en el mismo tono.
  let hash = 0;
  for (let i = 0; i < n.length; i++) hash = (hash * 31 + n.charCodeAt(i)) >>> 0;
  return { icono: "otros", color: COLORES_LISTA[hash % COLORES_LISTA.length] };
}

// Categorías que NO son elegibles: su visual es parte del significado del movimiento, no una
// preferencia. Las operaciones de divisa van con el signo $ en amarillo (el mismo amarillo que
// las marca en toda la app) y el RESTO en azul, igual que su monto.
const FIJAS: Record<string, { icono: CategoriaIconoId; hex: string }> = {
  comprausd: { icono: "divisa", hex: "var(--yellow)" },
  compraeur: { icono: "divisa", hex: "var(--yellow)" },
  ventausd: { icono: "divisa", hex: "var(--yellow)" },
  ventaeur: { icono: "divisa", hex: "var(--yellow)" },
  dolares: { icono: "divisa", hex: "var(--yellow)" },
  resto: { icono: "chancho", hex: "var(--blue)" },
};

/** Resuelve lo elegido por el usuario, cayendo al default por nombre. */
export function visualDeCategoria(cat: { nombre: string; icono?: string; color?: string }) {
  // Las fijas ignoran lo guardado: su color dice qué tipo de operación es.
  const fija = FIJAS[normalizar(cat.nombre)];
  if (fija) return { icono: fija.icono, color: "contraste" as CategoriaColor, hex: fija.hex };

  const base = visualPorNombre(cat.nombre);
  const icono = (ICONOS_LISTA as string[]).includes(cat.icono ?? "") ? (cat.icono as CategoriaIconoId) : base.icono;
  const color = (COLORES_LISTA as string[]).includes(cat.color ?? "") ? (cat.color as CategoriaColor) : base.color;
  return { icono, color, hex: COLORES_CATEGORIA[color] };
}
