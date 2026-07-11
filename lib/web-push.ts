import webpush from "web-push";
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

// Envía una notificación a la suscripción guardada del usuario.
// Devuelve `true` SOLO si el envío se confirmó. Los callers deduplican (marcan
// "ya avisé") únicamente cuando esto devuelve true → un fallo transitorio se
// reintenta al día siguiente en vez de silenciarse para siempre.
// - 404/410: la suscripción expiró → se borra y se devuelve false (no reintentar).
// - Otros errores (timeout, 5xx de FCM): se reintenta 2 veces con backoff. El
//   reintento NO toca Firestore (reusa la suscripción ya leída) → 0 costo extra.
export async function sendPushToUser(uid: string, payload: PushPayload): Promise<boolean> {
  if (!ensure()) return false;
  const ref = adminDb().doc(`users/${uid}/config/push`);
  const snap = await ref.get();
  const sub = snap.data()?.subscription as webpush.PushSubscription | undefined;
  if (!sub) return false;

  const delays = [0, 1500, 4000];
  for (let i = 0; i < delays.length; i++) {
    if (delays[i]) await sleep(delays[i]);
    try {
      await webpush.sendNotification(sub, JSON.stringify(payload));
      return true;
    } catch (err) {
      const code = (err as { statusCode?: number })?.statusCode;
      if (code === 404 || code === 410) {
        await ref.delete().catch(() => {});
        return false; // suscripción muerta: no reintentar
      }
      console.error("[web-push]", `intento ${i + 1}/${delays.length}`, err);
    }
  }
  return false; // agotó reintentos sin confirmar → el caller NO deduplica
}
