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

// Envía una notificación a la suscripción guardada del usuario.
// Si la suscripción expiró (404/410), la borra de Firestore.
export async function sendPushToUser(uid: string, payload: PushPayload): Promise<void> {
  if (!ensure()) return;
  const ref = adminDb().doc(`users/${uid}/config/push`);
  const snap = await ref.get();
  const sub = snap.data()?.subscription as webpush.PushSubscription | undefined;
  if (!sub) return;
  try {
    await webpush.sendNotification(sub, JSON.stringify(payload));
  } catch (err) {
    const code = (err as { statusCode?: number })?.statusCode;
    if (code === 404 || code === 410) {
      await ref.delete().catch(() => {});
    } else {
      console.error("[web-push]", err);
    }
  }
}
