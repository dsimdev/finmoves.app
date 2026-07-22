// Identidad visual de las categorías: ícono + color propios.
//
// REGLA DE COLOR: los tonos semánticos de la app están RESERVADOS y no se ofrecen acá —
// verde (ingreso), rojo (gasto), violeta (move a ahorro), teal (move a disponible),
// amarillo (compra/venta de divisa) y azul (RESTO). Si una categoría pudiera ser verde, un
// gasto suyo mostraría ícono verde junto a un monto rojo y se leería mal. Por eso la paleta
// de categorías es un set aparte, elegido para no confundirse con ninguno de esos seis.

export type CategoriaColor =
  | "rosa" | "lima" | "coral" | "indigo" | "menta"
  | "lavanda" | "oxido" | "arena" | "pizarra" | "cielo";

/** Paleta de categorías. Ninguno de estos tonos se usa para marcar tipo de movimiento. */
export const COLORES_CATEGORIA: Record<CategoriaColor, string> = {
  rosa: "#ff6e9c",
  lima: "#c6e64a",
  coral: "#ff8a5b",
  indigo: "#7c6bf0",
  menta: "#5fd3a8",
  lavanda: "#c9a7f0",
  oxido: "#c9705c",
  arena: "#d9b878",
  pizarra: "#8fa3c4",
  cielo: "#5bb8e8",
};

export const COLORES_LISTA = Object.keys(COLORES_CATEGORIA) as CategoriaColor[];

/** Íconos disponibles. El id se guarda en el doc; el trazo lo dibuja CategoriaIcono. */
export type CategoriaIconoId =
  | "comida" | "transporte" | "hogar" | "salud" | "ocio" | "compras"
  | "servicios" | "educacion" | "mascotas" | "regalos" | "viajes"
  | "trabajo" | "deporte" | "belleza" | "tecnologia" | "billete"
  | "farmacia" | "otros";

export const ICONOS_LISTA: CategoriaIconoId[] = [
  "comida", "transporte", "hogar", "salud", "farmacia", "ocio",
  "compras", "servicios", "educacion", "mascotas", "regalos", "viajes",
  "trabajo", "deporte", "belleza", "tecnologia", "billete", "otros",
];

// Defaults por nombre: las categorías que ya existen no tienen ícono ni color guardados, así
// que se les deduce uno por su nombre. Se comparan sin tildes ni mayúsculas y por inclusión,
// para que "Comida y bebida" o "Super/comida" también peguen.
const REGLAS: { claves: string[]; icono: CategoriaIconoId; color: CategoriaColor }[] = [
  { claves: ["comida", "super", "almuerzo", "resto", "delivery", "food"], icono: "comida", color: "coral" },
  { claves: ["transporte", "nafta", "combustible", "auto", "car", "peaje", "uber", "taxi"], icono: "transporte", color: "cielo" },
  { claves: ["hogar", "casa", "alquiler", "expensas", "home", "daily"], icono: "hogar", color: "arena" },
  { claves: ["farmacia", "medicament", "remedio", "pharmacy"], icono: "farmacia", color: "menta" },
  { claves: ["salud", "medic", "health", "obra social"], icono: "salud", color: "menta" },
  { claves: ["sueldo", "salario", "efectivo", "cobro", "honorario", "salary", "cash"], icono: "billete", color: "pizarra" },
  { claves: ["ocio", "juego", "game", "salida", "cine", "bar"], icono: "ocio", color: "rosa" },
  { claves: ["compra", "ropa", "shopping", "indument"], icono: "compras", color: "lavanda" },
  { claves: ["servicio", "luz", "gas", "internet", "netflix", "suscrip", "service"], icono: "servicios", color: "indigo" },
  { claves: ["educa", "curso", "libro", "escuela", "facultad"], icono: "educacion", color: "lima" },
  { claves: ["mascota", "perro", "gato", "vet", "loki"], icono: "mascotas", color: "oxido" },
  { claves: ["regalo", "gift"], icono: "regalos", color: "rosa" },
  { claves: ["viaje", "vacacion", "hotel", "vuelo", "travel"], icono: "viajes", color: "cielo" },
  { claves: ["trabajo", "oficina", "work"], icono: "trabajo", color: "pizarra" },
  { claves: ["deporte", "gimnasio", "gym", "sport"], icono: "deporte", color: "lima" },
  { claves: ["belleza", "peluqu", "estetica"], icono: "belleza", color: "lavanda" },
  { claves: ["tecno", "compu", "celular", "software", "tech"], icono: "tecnologia", color: "pizarra" },
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

/** Resuelve lo elegido por el usuario, cayendo al default por nombre. */
export function visualDeCategoria(cat: { nombre: string; icono?: string; color?: string }) {
  const base = visualPorNombre(cat.nombre);
  const icono = (ICONOS_LISTA as string[]).includes(cat.icono ?? "") ? (cat.icono as CategoriaIconoId) : base.icono;
  const color = (COLORES_LISTA as string[]).includes(cat.color ?? "") ? (cat.color as CategoriaColor) : base.color;
  return { icono, color, hex: COLORES_CATEGORIA[color] };
}
