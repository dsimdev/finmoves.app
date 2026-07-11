import { adminDb } from "./firebase-admin";
import { pushYGuardar } from "./notif-store";
import { agruparPorPeriodo } from "@/utils/periodo";
import { parsePeriodoId } from "@/utils/reportes";
import { reservaFX, tiposReserva } from "@/utils/reserva";
import { Timestamp } from "firebase-admin/firestore";
import type { Movimiento, ConfigUsuario } from "@/types";

const DOLAR_THRESHOLD_PCT = 3;
const HITOS = [50, 75, 100];
const SUELDO_REMINDER_DAYS = 30; // si pasó ~1 mes sin abrir período nuevo
const CARGA_OLVIDADA_DIAS = 3;   // días sin registrar ningún movimiento
const RECURRENTE_DIAS = 28; // días desde la última carga antes de recordar un recurrente
const RECURRENTE_LOOKBACK_DIAS = 35; // ventana de lectura (por fecha) para hallar la última carga.
// Cubre el umbral de 28d con ~7d de margen: el cron corre a diario y deduplica, así que
// el aviso dispara el primer día que se cruza el umbral (día 28, aún dentro de la ventana).
// No bajar de ~32: por debajo se arriesga perder el aviso si el cron falla varios días seguidos.

// Fecha de hoy en AR (UTC-3) como YYYY-MM-DD, para comparar contra recordatorios.
function hoyAR(): string {
  const ar = new Date(Date.now() - 3 * 60 * 60 * 1000);
  return ar.toISOString().slice(0, 10);
}

// YYYY-MM-DD (AR) de hace N días — para acotar lecturas por fecha del evento.
function isoHaceDiasAR(dias: number): string {
  const ar = new Date(Date.now() - 3 * 60 * 60 * 1000 - dias * 86_400_000);
  return ar.toISOString().slice(0, 10);
}

// Días entre dos fechas YYYY-MM-DD (b - a), en días enteros.
function diasEntre(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

const PRE_AVISO_DIAS = 3; // pre-aviso cuando faltan <= 3 días

const money = (n: number) => `$${Math.round(n).toLocaleString("es-AR")}`;

// Acción "Cargar" para los avisos que invitan a registrar un movimiento: abre directo
// el modal de alta (deep-link ?nuevo=1). El toque del cuerpo va al listado normal.
const CARGAR_ACCION = {
  actions: [{ action: "cargar", title: "Cargar" }],
  actionUrls: { cargar: "/movements?nuevo=1" },
};

interface GlobalCtx {
  dolarOficial: number | null;
}

// Recorre TODOS los usuarios con suscripción push y manda los avisos que
// correspondan (cambio de dólar, meta de ahorro, recordatorio de sueldo, carga
// olvidada, recordatorios puntuales). Cada aviso deduplica vía config/notifyMeta
// → correr el cron más seguido NO genera spam.
// Optimización: batch-read todos los config/push docs en paralelo, filtrar
// por suscripción activa, luego procesar solo esos usuarios.
export async function notifyAllUsers(ctx: GlobalCtx): Promise<void> {
  const userRefs = await adminDb().collection("users").listDocuments();

  // Leer todos los config/push en paralelo (en lugar de serial en notifyUser).
  const pushDocs = await Promise.all(
    userRefs.map((ref) => adminDb().doc(`${ref.path}/config/push`).get().catch(() => null))
  );

  // Filtrar solo usuarios con suscripción activa.
  const activeUids = userRefs
    .map((ref, i) => ({ uid: ref.id, push: pushDocs[i]?.data() }))
    .filter(({ push }) => push?.subscription)
    .map(({ uid }) => uid);

  // Procesar solo usuarios activos.
  await Promise.all(activeUids.map((uid) => notifyUser(uid, ctx).catch((e) => console.error("[notify]", uid, e))));
}

async function notifyUser(uid: string, ctx: GlobalCtx): Promise<void> {
  const notifyRef = adminDb().doc(`users/${uid}/config/notifyMeta`);
  const notify = (await notifyRef.get()).data() ?? {};
  const updates: Record<string, unknown> = {};

  // Cambio del dólar oficial. El baseline (lastDolarOficial) se re-ancla SOLO
  //    al avisar, así medimos el cambio ACUMULADO desde el último aviso y el
  //    resultado no depende de cada cuánto corra la cron (clave si corre por hora).
  if (ctx.dolarOficial) {
    const last = notify.lastDolarOficial as number | undefined;
    if (!last) {
      updates.lastDolarOficial = ctx.dolarOficial; // primer registro
    } else {
      const deltaPct = ((ctx.dolarOficial - last) / last) * 100;
      if (Math.abs(deltaPct) >= DOLAR_THRESHOLD_PCT) {
        const dir = deltaPct > 0 ? "subió" : "bajó";
        await pushYGuardar(uid, "dolar", { title: "Dólar oficial", body: `El oficial ${dir} ${Math.abs(deltaPct).toFixed(1)}% · $${ctx.dolarOficial.toLocaleString("es-AR")}`, tag: "dolar", url: "/investments" }, "/investments");
        updates.lastDolarOficial = ctx.dolarOficial; // re-anclar al avisar
      }
    }
  }

  // Versión nueva: push una vez por release MINOR/MAJOR (los patches se actualizan
  // solos). Convive con el banner in-app, que es quien hace el hard-refresh.
  await checkVersion(uid, notify, updates);

  // Los checks basados en movimientos corren UNA vez por día (no en cada corrida del
  // cron): son recordatorios diarios por naturaleza. El dólar/versión sí corren en
  // cada corrida (arriba) porque no leen movimientos. Esto baja las lecturas 4×→1×.
  const hoy = hoyAR();
  if (notify.lastDailyRun !== hoy) {
    const config = (await adminDb().doc(`users/${uid}/config/meta`).get()).data() as ConfigUsuario | undefined;
    if (config) {
      // Lectura de movimientos recientes compartida por sueldo y carga-olvidada (ambos
      // solo necesitan lo más nuevo). Recurrentes hace su propia lectura por ventana de
      // fecha, porque necesita ver más atrás que estos 150 en períodos de alto volumen.
      const recentSnap = await adminDb()
        .collection(`users/${uid}/movimientos`)
        .orderBy("timestampCarga", "desc")
        .limit(150)
        .get();
      const recientes = recentSnap.docs.map((d) => {
        const data = d.data();
        return { ...data, id: d.id, timestampCarga: (data.timestampCarga as Timestamp).toDate() } as Movimiento;
      });
      await checkMeta(uid, config, notify, updates);
      await checkSueldo(uid, recientes, notify, updates);
      await checkCargaOlvidada(uid, recientes, notify, updates);
      await checkRecurrentes(uid, notify, updates);
    }
    // Recordatorios puntuales del usuario (colección propia, independiente de config).
    await checkRecordatorios(uid);
    updates.lastDailyRun = hoy;
  }

  await notifyRef.set(updates, { merge: true });
}

// ¿`to` es un salto MINOR o MAJOR respecto de `from`? (los PATCH no avisan).
function esMinorOMajor(from: string, to: string): boolean {
  const [fM, fm] = from.split(".").map(Number);
  const [tM, tm] = to.split(".").map(Number);
  if ([fM, fm, tM, tm].some(Number.isNaN)) return false;
  return tM > fM || (tM === fM && tm > fm);
}

// Aviso de versión nueva. Baseline silencioso para usuarios nuevos (no spamear en
// su primer cron). Avanza el baseline aun en patches, para no acumular el salto.
async function checkVersion(uid: string, notify: Record<string, unknown>, updates: Record<string, unknown>) {
  const current = process.env.NEXT_PUBLIC_APP_VERSION;
  if (!current || current === "0") return;
  const last = notify.lastVersionNotified as string | undefined;
  if (!last) { updates.lastVersionNotified = current; return; } // primer registro
  if (current === last) return;
  if (esMinorOMajor(last, current)) {
    await pushYGuardar(uid, "version", { title: "FinMoves actualizado", body: `Nueva versión v${current} disponible`, tag: `version-${current}`, url: "/settings/help?changelog=1" }, "/settings/help?changelog=1");
  }
  updates.lastVersionNotified = current;
}

// Carga olvidada: si pasaron >= N días desde el último movimiento cargado, avisa
// una sola vez por ese hueco (se re-arma cuando el usuario vuelve a cargar algo).
async function checkCargaOlvidada(uid: string, movs: Movimiento[], notify: Record<string, unknown>, updates: Record<string, unknown>) {
  if (movs.length === 0) return;
  const ultimo = movs[0].timestampCarga as Date; // más reciente (orden desc)
  const dias = Math.floor((Date.now() - ultimo.getTime()) / 86_400_000);
  if (dias < CARGA_OLVIDADA_DIAS) return;
  const key = ultimo.getTime();
  if (notify.cargaRemindedFor === key) return; // ya avisé por este hueco
  const ok = await pushYGuardar(uid, "carga", { title: "FinMoves", body: `Hace ${dias} días que no registrás un movimiento`, tag: "carga", url: "/movements", ...CARGAR_ACCION }, "/movements?nuevo=1");
  if (ok) updates.cargaRemindedFor = key;
}

// Recordatorios puntuales, en dos tiempos:
//  1) Pre-aviso cuando faltan ≤3 días ("en unos días…"), una sola vez (flag avisadoPre).
//  2) El día (o pasado), aviso final y BORRA el recordatorio.
async function checkRecordatorios(uid: string) {
  const hoy = hoyAR();
  const snap = await adminDb()
    .collection(`users/${uid}/recordatorios`)
    .where("fecha", ">=", hoy)
    .get();
  await Promise.all(snap.docs.map(async (doc) => {
    const r = doc.data() as { texto?: string; fecha?: string; avisadoPre?: boolean };
    if (!r.fecha) return;
    const texto = r.texto ?? "";
    if (r.fecha <= hoy) {
      // Llegó la fecha → aviso final. Borrar SOLO si el push se confirmó; si falla,
      // se conserva y reintenta mañana (si no, el recordatorio se perdería sin avisar).
      const ok = await pushYGuardar(uid, "recordatorio", { title: "Recordatorio", body: texto, tag: `rec-${doc.id}`, url: "/movements" }, "/movements");
      if (ok) await doc.ref.delete().catch(() => {});
      return;
    }
    // Pre-aviso: faltan entre 1 y 3 días y todavía no se avisó.
    const faltan = diasEntre(hoy, r.fecha);
    if (faltan >= 1 && faltan <= PRE_AVISO_DIAS && !r.avisadoPre) {
      const cuando = faltan === 1 ? "mañana" : `en ${faltan} días`;
      const ok = await pushYGuardar(uid, "recordatorio", { title: "Recordatorio", body: `${cuando}: ${texto}`, tag: `rec-pre-${doc.id}`, url: "/movements" }, "/movements");
      if (ok) await doc.ref.set({ avisadoPre: true }, { merge: true });
    }
  }));
}

// Recurrentes (por fecha): por cada template activo, busca la última vez que se cargó
// un movimiento que matchee (tipo+categoría+descripción). Si pasaron ~28 días desde esa
// fecha, recuerda por push. Dedup por última-fecha → no re-avisa hasta que lo cargues de
// nuevo (ahí cambia la fecha y, al mes, vuelve a avisar).
async function checkRecurrentes(uid: string, notify: Record<string, unknown>, updates: Record<string, unknown>) {
  const recSnap = await adminDb().collection(`users/${uid}/recurrentes`).where("activo", "==", true).get();
  if (recSnap.empty) return;

  // Ventana por FECHA del evento (no por cantidad): una sola query, index-free (desigualdad
  // de un solo campo) y robusta al volumen del período. `fecha` se guarda como YYYY-MM-DD.
  const desde = isoHaceDiasAR(RECURRENTE_LOOKBACK_DIAS);
  const movsSnap = await adminDb()
    .collection(`users/${uid}/movimientos`)
    .where("fecha", ">=", desde)
    .get();
  const movs = movsSnap.docs.map((d) => d.data() as Movimiento);

  const hoy = hoyAR();
  const reminded = (notify.recReminded as Record<string, string>) ?? {};
  const nextReminded = { ...reminded };
  const nombres: string[] = [];
  const ids: string[] = [];

  for (const d of recSnap.docs) {
    const r = d.data() as { tipo: string; categoria: string; descripcion: string; observaciones?: string };
    // Última carga que matchee (tipo+categoría+descripción+observación) dentro de la ventana.
    // La observación distingue recurrentes homónimos (ej. "Steam·eso+" vs "Steam·eso pass");
    // los recurrentes viejos sin observación guardada matchean cargas sin observación.
    const desc = (r.descripcion || "").trim().toLowerCase();
    const obs = (r.observaciones || "").trim().toLowerCase();
    let ultima = "";
    for (const m of movs) {
      if (m.tipo !== r.tipo || m.categoria !== r.categoria) continue;
      if ((m.descripcion || "").trim().toLowerCase() !== desc || !m.fecha) continue;
      if ((m.observaciones || "").trim().toLowerCase() !== obs) continue;
      if (m.fecha > ultima) ultima = m.fecha;
    }
    if (!ultima) continue;
    if (diasEntre(ultima, hoy) < RECURRENTE_DIAS) continue;
    if (reminded[d.id] === ultima) continue; // ya avisé por esta última carga
    nombres.push(r.descripcion);
    ids.push(d.id);
    nextReminded[d.id] = ultima;
  }

  if (nombres.length === 0) return;
  const body = nombres.length === 1
    ? `¿Cargás "${nombres[0]}"? Hace ~1 mes de la última vez.`
    : `${nombres.length} recurrentes pendientes: ${nombres.slice(0, 3).join(", ")}${nombres.length > 3 ? "…" : ""}`;
  // Un solo recurrente → deep-link al modal pre-cargado; varios → listado general.
  const dest = ids.length === 1 ? `/movements?recurrente=${encodeURIComponent(ids[0])}` : "/movements";
  // Persistir el dedup SOLO si el push se confirmó: si falla, reintenta mañana.
  const ok = await pushYGuardar(uid, "recurrente", { title: "Recurrentes", body, tag: `rec-${hoy.slice(0, 7)}`, url: dest, ...CARGAR_ACCION }, dest);
  if (ok) updates.recReminded = nextReminded;
}

// Meta de ahorro: avisa al cruzar 50/75/100% (una vez cada hito).
async function checkMeta(uid: string, config: ConfigUsuario, notify: Record<string, unknown>, updates: Record<string, unknown>) {
  const metaMonto = config.meta?.metaMonto;
  if (!metaMonto || metaMonto <= 0) return;

  // Ya alcanzó el 100% → no queda ningún hito por avisar, evitamos leer nada.
  const yaNotificados = (notify.metaHitos as number[] | undefined) ?? [];
  if (yaNotificados.includes(100)) return;

  // monedaInversiones vive en prefs del cliente; en el server usamos USD por defecto.
  const principal = config.meta?.monedaPrincipal;
  const moneda: "USD" | "EUR" = principal === "EUR" ? "USD" : principal === "USD" ? "EUR" : "USD";
  const { compra, gasto, venta, ingreso } = tiposReserva(moneda);
  const base = moneda === "USD" ? (config.meta?.saldoUSD ?? 0) : (config.meta?.saldoEUR ?? 0);

  const q = adminDb()
    .collection(`users/${uid}/movimientos`)
    .where("tipo", "in", [compra, gasto, venta, ingreso]);

  // count() cuesta 1 lectura: si el nº de movs de inversión (y la moneda) no cambió
  // desde la última corrida, reusamos la suma cacheada en vez de leer todos los docs.
  // El saldo base se suma aparte SIEMPRE, así un cambio de base se refleja igual.
  const count = (await q.count().get()).data().count;
  let movSum: number;
  if (count === notify.metaMovCount && notify.metaCacheMoneda === moneda && typeof notify.metaMovSum === "number") {
    movSum = notify.metaMovSum as number;
  } else {
    const snap = await q.get();
    movSum = reservaFX(snap.docs.map((d) => d.data() as Movimiento), moneda);
    updates.metaMovCount = count;
    updates.metaMovSum = movSum;
    updates.metaCacheMoneda = moneda;
  }

  const pct = ((base + movSum) / metaMonto) * 100;
  const nuevos = HITOS.filter((h) => pct >= h && !yaNotificados.includes(h));
  if (nuevos.length === 0) return;

  const top = Math.max(...nuevos);
  const body = top >= 100
    ? `¡Alcanzaste tu meta de ${moneda} ${Math.round(metaMonto).toLocaleString("es-AR")}! 🎉`
    : `Vas ${top}% de tu meta de ${moneda} ${Math.round(metaMonto).toLocaleString("es-AR")}`;
  const ok = await pushYGuardar(uid, "meta", { title: "Meta de ahorro", body, tag: "meta", url: "/investments" }, "/investments");
  if (ok) updates.metaHitos = Array.from(new Set([...yaNotificados, ...nuevos]));
}

// Recordatorio de sueldo: si pasó más de ~1 mes desde el último período abierto.
async function checkSueldo(uid: string, movs: Movimiento[], notify: Record<string, unknown>, updates: Record<string, unknown>) {
  const periodos = agruparPorPeriodo(movs);
  if (periodos.length === 0) return;
  const ultimo = periodos[0].periodoId;
  const inicio = parsePeriodoId(ultimo);
  const dias = (Date.now() - inicio.getTime()) / 86_400_000;
  if (dias < SUELDO_REMINDER_DAYS) return;
  if (notify.sueldoRemindedFor === ultimo) return; // ya avisé por este gap

  // Marcar el dedup SOLO si el push se confirmó: un fallo transitorio se reintenta mañana.
  const ok = await pushYGuardar(uid, "sueldo", { title: "FinMoves", body: "Pasó más de un mes: ¿cargás el sueldo del nuevo período?", tag: "sueldo", url: "/movements?nuevo=1" }, "/movements?nuevo=1");
  if (ok) updates.sueldoRemindedFor = ultimo;
}
