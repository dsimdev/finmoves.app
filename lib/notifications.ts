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
export async function notifyAllUsers(ctx: GlobalCtx): Promise<void> {
  const userRefs = await adminDb().collection("users").listDocuments();
  await Promise.all(userRefs.map((ref) => notifyUser(ref.id, ctx).catch((e) => console.error("[notify]", ref.id, e))));
}

async function notifyUser(uid: string, ctx: GlobalCtx): Promise<void> {
  // Sin suscripción → no hacemos nada (ni leemos movimientos).
  const pushSnap = await adminDb().doc(`users/${uid}/config/push`).get();
  if (!pushSnap.exists || !pushSnap.data()?.subscription) return;

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

  // Para meta y sueldo necesitamos los movimientos + config del usuario.
  const config = (await adminDb().doc(`users/${uid}/config/meta`).get()).data() as ConfigUsuario | undefined;
  if (config) {
    const snap = await adminDb().collection(`users/${uid}/movimientos`).get();
    const movimientos = snap.docs.map((d) => {
      const data = d.data();
      return { ...data, id: d.id, timestampCarga: (data.timestampCarga as Timestamp).toDate() } as Movimiento;
    });

    await checkMeta(uid, movimientos, config, notify, updates);
    await checkSueldo(uid, movimientos, notify, updates);
    await checkCargaOlvidada(uid, movimientos, notify, updates);
  }

  // Recordatorios puntuales del usuario (colección propia, independiente de config).
  await checkRecordatorios(uid);

  await notifyRef.set(updates, { merge: true });
}

// Carga olvidada: si pasaron >= N días desde el último movimiento cargado, avisa
// una sola vez por ese hueco (se re-arma cuando el usuario vuelve a cargar algo).
async function checkCargaOlvidada(uid: string, movs: Movimiento[], notify: Record<string, unknown>, updates: Record<string, unknown>) {
  if (movs.length === 0) return;
  const ultimo = movs.reduce((mx, m) => (m.timestampCarga > mx ? m.timestampCarga : mx), movs[0].timestampCarga);
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
  const snap = await adminDb().collection(`users/${uid}/recordatorios`).get();
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

// Meta de ahorro: avisa al cruzar 50/75/100% (una vez cada hito).
async function checkMeta(uid: string, movs: Movimiento[], config: ConfigUsuario, notify: Record<string, unknown>, updates: Record<string, unknown>) {
  const metaMonto = config.meta?.metaMonto;
  if (!metaMonto || metaMonto <= 0) return;

  // monedaInversiones vive en prefs del cliente; en el server usamos USD por defecto.
  const principal = config.meta?.monedaPrincipal;
  const moneda: "USD" | "EUR" = principal === "EUR" ? "USD" : principal === "USD" ? "EUR" : "USD";
  const compra = moneda === "USD" ? "CompraUSD" : "CompraEUR";
  const gasto = moneda === "USD" ? "GastoUSD" : "GastoEUR";
  const venta = moneda === "USD" ? "VentaUSD" : "VentaEUR";
  let total = moneda === "USD" ? (config.meta?.saldoUSD ?? 0) : (config.meta?.saldoEUR ?? 0);
  for (const m of movs) {
    if (m.tipo === compra && m.cantidadUSD) total += m.cantidadUSD;
    else if ((m.tipo === gasto || m.tipo === venta) && m.cantidadUSD) total -= m.cantidadUSD;
  }

  const pct = (total / metaMonto) * 100;
  const yaNotificados = (notify.metaHitos as number[] | undefined) ?? [];
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
