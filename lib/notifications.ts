import { adminDb } from "./firebase-admin";
import { sendPushToUser } from "./web-push";
import { agruparPorPeriodo } from "@/utils/periodo";
import { parsePeriodoId } from "@/utils/reportes";
import { Timestamp } from "firebase-admin/firestore";
import type { Movimiento, ConfigUsuario } from "@/types";

const DOLAR_THRESHOLD_PCT = 3;
const HITOS = [50, 75, 100];
const SUELDO_REMINDER_DAYS = 33; // si pasó más de ~1 mes sin abrir período nuevo

const money = (n: number) => `$${Math.round(n).toLocaleString("es-AR")}`;

interface GlobalCtx {
  version: string;
  dolarOficial: number | null;
}

// Recorre TODOS los usuarios con suscripción push y manda los avisos que
// correspondan (versión nueva, cambio de dólar, meta de ahorro, recordatorio
// de sueldo). Cada aviso deduplica vía config/notifyMeta → correr el cron más
// seguido NO genera spam.
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

  // 1) Nueva versión (global).
  if (notify.lastVersion && notify.lastVersion !== ctx.version) {
    await sendPushToUser(uid, { title: "FinMoves", body: `Nueva versión ${ctx.version} disponible`, tag: "new-version", url: "/" });
  }
  updates.lastVersion = ctx.version;

  // 2) Cambio del dólar oficial (global, dedup por usuario).
  if (ctx.dolarOficial) {
    const last = notify.lastDolarOficial as number | undefined;
    if (last) {
      const deltaPct = ((ctx.dolarOficial - last) / last) * 100;
      if (Math.abs(deltaPct) >= DOLAR_THRESHOLD_PCT) {
        const dir = deltaPct > 0 ? "subió" : "bajó";
        await sendPushToUser(uid, { title: "Dólar oficial", body: `El oficial ${dir} ${Math.abs(deltaPct).toFixed(1)}% · $${ctx.dolarOficial.toLocaleString("es-AR")}`, tag: "dolar", url: "/investments" });
      }
    }
    updates.lastDolarOficial = ctx.dolarOficial;
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
  }

  await notifyRef.set(updates, { merge: true });
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
  let total = moneda === "USD" ? (config.meta?.saldoUSD ?? 0) : (config.meta?.saldoEUR ?? 0);
  for (const m of movs) {
    if (m.tipo === compra && m.cantidadUSD) total += m.cantidadUSD;
    else if (m.tipo === gasto && m.cantidadUSD) total -= m.cantidadUSD;
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
