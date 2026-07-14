import webpush from "web-push";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "./firebase-admin";

const PUBLIC = process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const PRIVATE = process.env.VAPID_PRIVATE_KEY;
const SUBJECT = process.env.VAPID_SUBJECT || "mailto:info@finmoves.app";

let configured = false;
function ensure(): boolean {
  if (configured) return true;
  if (PUBLIC && PRIVATE) {
    webpush.setVapidDetails(SUBJECT, PUBLIC, PRIVATE);
    configured = true;
  }
  return configured;
}

export type PushPayload = {
  title: string;
  body: string;
  tag?: string;
  url?: string;
  // Botones de acción de la notificación (Android). Cada acción abre su URL de actionUrls.
  actions?: { action: string; title: string }[];
  actionUrls?: Record<string, string>;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Sub = webpush.PushSubscription;

// Lee las suscripciones del usuario, unificando el formato viejo (`subscription`: una
// sola, docs previos a multi-device) y el nuevo (`subscriptions`: array). Cada sub se
// identifica por su `endpoint` (único por navegador/dispositivo).
// Exportada para test: es la pieza que decide a quién se le manda push.
export function readSubs(data: FirebaseFirestore.DocumentData | undefined): Sub[] {
  if (!data) return [];
  const arr = data.subscriptions as Sub[] | undefined;
  if (Array.isArray(arr) && arr.length > 0) return arr.filter((s) => s?.endpoint);
  const single = data.subscription as Sub | undefined;
  return single?.endpoint ? [single] : [];
}

// Envía una notificación a TODAS las suscripciones del usuario (multi-dispositivo).
// Devuelve `true` si AL MENOS UNA se confirmó. Los callers deduplican (marcan "ya avisé")
// solo cuando esto devuelve true → un fallo transitorio se reintenta al día siguiente en
// vez de silenciarse para siempre.
// - 404/410 en una sub: expiró → se remueve del doc (las demás quedan). No cuenta como éxito.
// - Otros errores (timeout, 5xx de FCM): se reintenta 2 veces con backoff por sub. El
//   reintento NO re-lee Firestore (reusa las subs ya leídas) → 0 costo extra.
// - Al final, si alguna sub murió, se reescribe el doc con las vivas (1 escritura).
export async function sendPushToUser(uid: string, payload: PushPayload): Promise<boolean> {
  if (!ensure()) return false;
  const ref = adminDb().doc(`users/${uid}/config/push`);
  const snap = await ref.get();
  const subs = readSubs(snap.data());
  if (subs.length === 0) return false;

  const body = JSON.stringify(payload);
  const delays = [0, 1500, 4000];
  const dead = new Set<string>(); // endpoints a purgar (404/410)
  let anyOk = false;

  for (const sub of subs) {
    for (let i = 0; i < delays.length; i++) {
      if (delays[i]) await sleep(delays[i]);
      try {
        await webpush.sendNotification(sub, body);
        anyOk = true;
        break; // esta sub OK → siguiente
      } catch (err) {
        const code = (err as { statusCode?: number })?.statusCode;
        if (code === 404 || code === 410) {
          dead.add(sub.endpoint); // muerta: purgar, no reintentar
          break;
        }
        console.error("[web-push]", `sub intento ${i + 1}/${delays.length}`, err);
      }
    }
  }

  // Purga de suscripciones muertas: reescribe el doc solo con las vivas (1 escritura).
  // Se elimina también el campo legacy `subscription` (singular) para que no reviva.
  if (dead.size > 0) {
    const alive = subs.filter((s) => !dead.has(s.endpoint));
    await ref.set({ subscriptions: alive, subscription: FieldValue.delete() }, { merge: true }).catch(() => {});
  }

  return anyOk; // ninguna confirmó → el caller NO deduplica
}
