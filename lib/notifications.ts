import { adminDb } from "./firebase-admin";
import { sendPushToUser } from "./web-push";
import { agruparPorPeriodo } from "@/utils/periodo";
import { parsePeriodoId } from "@/utils/reportes";
import { Timestamp } from "firebase-admin/firestore";
import type { Movimiento, ConfigUsuario } from "@/types";

const DOLAR_THRESHOLD_PCT = 3;
const HITOS = [50, 75, 100];
const SUELDO_REMINDER_DAYS = 30; // si pasó ~1 mes sin abrir período nuevo
const CARGA_OLVIDADA_DIAS = 3;   // días sin registrar ningún movimiento
const RECURRENTE_DIAS = 28; // días desde la última carga antes de recordar un recurrente

// Fecha de hoy en AR (UTC-3) como YYYY-MM-DD, para comparar contra recordatorios.
function hoyAR(): string {
  const ar = new Date(Date.now() - 3 * 60 * 60 * 1000);
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
        await sendPushToUser(uid, { title: "Dólar oficial", body: `El oficial ${dir} ${Math.abs(deltaPct).toFixed(1)}% · $${ctx.dolarOficial.toLocaleString("es-AR")}`, tag: "dolar", url: "/investments" });
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
      // Una sola lectura de movimientos recientes, compartida por los checks (antes
      // cada check —y cada recurrente— disparaba su propia query a movimientos).
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
      await checkRecurrentes(uid, recientes, notify, updates);
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
    await sendPushToUser(uid, { title: "FinMoves actualizado", body: `Nueva versión v${current} disponible`, tag: `version-${current}`, url: "/" });
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
  await sendPushToUser(uid, { title: "FinMoves", body: `Hace ${dias} días que no registrás un movimiento`, tag: "carga", url: "/movements" });
  updates.cargaRemindedFor = key;
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
      // Llegó la fecha → aviso final + borrar.
      await sendPushToUser(uid, { title: "Recordatorio", body: texto, tag: `rec-${doc.id}`, url: "/movements" });
      await doc.ref.delete().catch(() => {});
      return;
    }
    // Pre-aviso: faltan entre 1 y 3 días y todavía no se avisó.
    const faltan = diasEntre(hoy, r.fecha);
    if (faltan >= 1 && faltan <= PRE_AVISO_DIAS && !r.avisadoPre) {
      const cuando = faltan === 1 ? "mañana" : `en ${faltan} días`;
      await sendPushToUser(uid, { title: "Recordatorio", body: `${cuando}: ${texto}`, tag: `rec-pre-${doc.id}`, url: "/movements" });
      await doc.ref.set({ avisadoPre: true }, { merge: true });
    }
  }));
}

// Recurrentes (por fecha): por cada template activo, busca la última vez que se cargó
// un movimiento que matchee (tipo+categoría+descripción). Si pasaron ~28 días desde esa
// fecha, recuerda por push. Dedup por última-fecha → no re-avisa hasta que lo cargues de
// nuevo (ahí cambia la fecha y, al mes, vuelve a avisar).
async function checkRecurrentes(uid: string, movs: Movimiento[], notify: Record<string, unknown>, updates: Record<string, unknown>) {
  const recSnap = await adminDb().collection(`users/${uid}/recurrentes`).where("activo", "==", true).get();
  if (recSnap.empty) return;

  const hoy = hoyAR();
  const reminded = (notify.recReminded as Record<string, string>) ?? {};
  const nextReminded = { ...reminded };
  const nombres: string[] = [];

  for (const d of recSnap.docs) {
    const r = d.data() as { tipo: string; categoria: string; descripcion: string };
    // Última carga que matchee (tipo+categoría+descripción) dentro de los movimientos
    // recientes ya leídos — sin una query por recurrente.
    const desc = (r.descripcion || "").trim().toLowerCase();
    let ultima = "";
    for (const m of movs) {
      if (m.tipo !== r.tipo || m.categoria !== r.categoria) continue;
      if ((m.descripcion || "").trim().toLowerCase() !== desc || !m.fecha) continue;
      if (m.fecha > ultima) ultima = m.fecha;
    }
    if (!ultima) continue;
    if (diasEntre(ultima, hoy) < RECURRENTE_DIAS) continue;
    if (reminded[d.id] === ultima) continue; // ya avisé por esta última carga
    nombres.push(r.descripcion);
    nextReminded[d.id] = ultima;
  }

  if (nombres.length === 0) return;
  const body = nombres.length === 1
    ? `¿Cargás "${nombres[0]}"? Hace ~1 mes de la última vez.`
    : `${nombres.length} recurrentes pendientes: ${nombres.slice(0, 3).join(", ")}${nombres.length > 3 ? "…" : ""}`;
  await sendPushToUser(uid, { title: "Recurrentes", body, tag: `rec-${hoy.slice(0, 7)}`, url: "/movements" });
  updates.recReminded = nextReminded;
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
  const compra = moneda === "USD" ? "CompraUSD" : "CompraEUR";
  const gasto = moneda === "USD" ? "GastoUSD" : "GastoEUR";
  const venta = moneda === "USD" ? "VentaUSD" : "VentaEUR";
  const ingreso = moneda === "USD" ? "IngresoUSD" : "IngresoEUR";
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
    movSum = 0;
    for (const d of snap.docs) {
      const m = d.data() as Movimiento;
      if ((m.tipo === compra || m.tipo === ingreso) && m.cantidadUSD) movSum += m.cantidadUSD;
      else if ((m.tipo === gasto || m.tipo === venta) && m.cantidadUSD) movSum -= m.cantidadUSD;
    }
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
  await sendPushToUser(uid, { title: "Meta de ahorro", body, tag: "meta", url: "/investments" });
  updates.metaHitos = Array.from(new Set([...yaNotificados, ...nuevos]));
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

  await sendPushToUser(uid, { title: "FinMoves", body: "Pasó más de un mes: ¿cargás el sueldo del nuevo período?", tag: "sueldo", url: "/movements" });
  updates.sueldoRemindedFor = ultimo;
}
