// Identidad visual de las categorías: ícono + color propios.
//
// REGLA DE COLOR: los tonos semánticos de la app están RESERVADOS y no se ofrecen acá —
// verde (ingreso), rojo (gasto), violeta (move a ahorro), teal (move a disponible),
// amarillo (compra/venta de divisa) y azul (RESTO). Si una categoría pudiera ser verde, un
// gasto suyo mostraría ícono verde junto a un monto rojo y se leería mal. Por eso la paleta
// de categorías es un set aparte, elegido para no confundirse con ninguno de esos seis.

// Declarados EN ORDEN DE TONO (rojo → amarillo → verde → cian → azul → violeta → rosa), que es
// el orden en que se pintan en el selector. Ver COLORES_CATEGORIA.
export type CategoriaColor =
  | "coral" | "naranja" | "arena" | "dorado"
  | "oliva" | "olivaProfundo" | "lima"
  | "menta" | "mentaProfunda" | "turquesaClaro" | "turquesa"
  | "petroleo" | "cielo" | "grafito"
  | "indigo" | "violeta" | "magenta" | "rosa"
  | "contraste";

/**
 * Paleta de categorías: un tono por ícono (18 y 18), ordenados por MATIZ para que el selector
 * se recorra como un círculo cromático — rojo → amarillo → verde → cian → azul → violeta →
 * rosa — y no como una bolsa de colores sueltos. Sin dos vecinos que se confundan de un
 * vistazo (había tres naranjas y dos violetas casi iguales) y sin grises neutros, que no daban
 * identidad y competían con el texto apagado.
 *
 * EJE DE LUMINOSIDAD: el círculo de matices ya está saturado — con seis tonos semánticos
 * vedados, casi todo matiz nuevo cae a menos de 60 de distancia de alguno existente. Por eso
 * la variedad extra no sale de matices nuevos sino de versiones CLARAS/PROFUNDAS de familias
 * que ya están (oliva/olivaProfundo, menta/mentaProfunda, turquesa/turquesaClaro): ahí la
 * distancia la da el brillo, no el tono.
 *
 * Para agregar un color: sumarlo al type Y a este record EN SU POSICIÓN DE TONO, y correr el
 * test de distancia (tests/categoria-visual.test.ts) — el margen es fino (el par más cercano
 * está en 66.8, con umbral 60) y es fácil violarlo sin darse cuenta.
 *
 * `contraste` es especial: no es un hex fijo sino `var(--text)`, o sea negro en tema claro y
 * blanco en oscuro. Guardar "negro" a secas dejaba el ícono invisible al cambiar de tema.
 * Va último a propósito: no tiene matiz, así que no entra en el orden del círculo.
 */
export const COLORES_CATEGORIA: Record<CategoriaColor, string> = {
  coral: "#e8492e",          //   9° rojo-teja intenso
  naranja: "#ff8a3d",        //  24° naranja cálido
  arena: "#d9b878",          //  40° arena / mostaza suave
  dorado: "#f5d020",         //  50° amarillo dorado brillante
  oliva: "#9aa83a",          //  68° verde oliva apagado
  olivaProfundo: "#5c6b1f",  //  72° oliva oscuro
  lima: "#c6e64a",           //  72° lima brillante
  menta: "#5fd3a8",          // 158° verde menta
  mentaProfunda: "#1f8f6b",  // 161° verde profundo
  turquesaClaro: "#9ceee5",  // 173° aguamarina claro
  turquesa: "#20d3c2",       // 174° turquesa saturado
  petroleo: "#0f4450",       // 191° azul petróleo muy oscuro
  cielo: "#5bb8e8",          // 200° celeste
  grafito: "#4a5a7a",        // 220° azul grisáceo (identidad sin ser gris neutro)
  indigo: "#7c6bf0",         // 248° índigo
  violeta: "#7326b8",        // 272° violeta profundo
  magenta: "#d94ecc",        // 306° magenta/fucsia
  rosa: "#ff6e9c",           // 341° rosa fuerte
  contraste: "var(--text)",
};

export const COLORES_LISTA = Object.keys(COLORES_CATEGORIA) as CategoriaColor[];

/** Íconos disponibles. El id se guarda en el doc; el trazo lo dibuja CategoriaIcono. */
export type CategoriaIconoId =
  | "comida" | "cafe" | "transporte" | "hogar" | "salud" | "farmacia" | "ocio"
  | "gimnasio" | "compras" | "regalo" | "servicios" | "educacion" | "mascotas"
  | "viajes" | "tecnologia" | "billete" | "chancho" | "divisa" | "move" | "otros";

// Los ELEGIBLES desde el selector: 18, uno por color de la paleta (COLORES_CATEGORIA), para
// que se pueda dar identidad única a cada categoría. `divisa` y `move` quedan afuera a
// propósito: son operaciones del sistema con color fijo, no categorías que el usuario elija.
export const ICONOS_LISTA: CategoriaIconoId[] = [
  "comida", "cafe", "transporte", "hogar", "salud", "farmacia",
  "ocio", "gimnasio", "compras", "regalo", "servicios", "educacion",
  "mascotas", "viajes", "tecnologia", "billete", "chancho", "otros",
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
  { claves: ["cafe", "bar", "starbucks", "coffee"], icono: "cafe", color: "coral" },
  { claves: ["ocio", "juego", "game", "salida", "cine"], icono: "ocio", color: "rosa" },
  { claves: ["compra", "ropa", "shopping", "indument"], icono: "compras", color: "magenta" },
  { claves: ["servicio", "luz", "gas", "internet", "netflix", "suscrip", "service"], icono: "servicios", color: "indigo" },
  { claves: ["educa", "curso", "libro", "escuela", "facultad"], icono: "educacion", color: "lima" },
  { claves: ["mascota", "perro", "gato", "vet", "loki"], icono: "mascotas", color: "arena" },
  { claves: ["regalo", "gift", "cumple"], icono: "regalo", color: "rosa" },
  { claves: ["viaje", "vacacion", "hotel", "vuelo", "travel"], icono: "viajes", color: "cielo" },
  { claves: ["trabajo", "oficina", "work"], icono: "billete", color: "contraste" },
  { claves: ["deporte", "gimnasio", "gym", "sport", "club"], icono: "gimnasio", color: "lima" },
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
  // Move: flechas cruzándose. Color mixto teal+purple (los dos lados que conecta: disponible y
  // ahorros), sin importar la dirección. Se pinta con gradiente (ver CategoriaIcono).
  move: { icono: "move", hex: "var(--teal)" },
};

/** Categorías cuyo ícono se pinta con un GRADIENTE en vez de un color plano. */
export const GRADIENTE_CATEGORIA: Record<string, string> = {
  move: "linear-gradient(135deg, var(--teal), var(--purple))",
};

/** Resuelve lo elegido por el usuario, cayendo al default por nombre. */
export function visualDeCategoria(cat: { nombre: string; icono?: string; color?: string }) {
  // Las fijas ignoran lo guardado: su color dice qué tipo de operación es. Algunas (Move) se
  // pintan con gradiente en vez de color plano.
  const clave = normalizar(cat.nombre);
  const fija = FIJAS[clave];
  if (fija) return { icono: fija.icono, color: "contraste" as CategoriaColor, hex: fija.hex, gradiente: GRADIENTE_CATEGORIA[clave] };

  const base = visualPorNombre(cat.nombre);
  const icono = (ICONOS_LISTA as string[]).includes(cat.icono ?? "") ? (cat.icono as CategoriaIconoId) : base.icono;
  const color = (COLORES_LISTA as string[]).includes(cat.color ?? "") ? (cat.color as CategoriaColor) : base.color;
  return { icono, color, hex: COLORES_CATEGORIA[color], gradiente: undefined as string | undefined };
}
