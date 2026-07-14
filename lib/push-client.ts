"use client";

import { doc, setDoc, getDoc, deleteDoc, deleteField } from "firebase/firestore";
import { db } from "@/services/firebase/firebase";

type Sub = { endpoint: string; [k: string]: unknown };

// Lee las subs del doc unificando formato viejo (`subscription`) y nuevo (`subscriptions`).
function readSubs(data: Record<string, unknown> | undefined): Sub[] {
  if (!data) return [];
  const arr = data.subscriptions as Sub[] | undefined;
  if (Array.isArray(arr) && arr.length > 0) return arr.filter((s) => s?.endpoint);
  const single = data.subscription as Sub | undefined;
  return single?.endpoint ? [single] : [];
}

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window &&
    !!VAPID_PUBLIC
  );
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export async function isPushEnabled(): Promise<boolean> {
  if (!pushSupported()) return false;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  return !!sub;
}

// Pide permiso, suscribe y guarda la suscripción en Firestore.
export async function enablePush(uid: string): Promise<boolean> {
  if (!pushSupported()) return false;
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return false;
  const reg = await navigator.serviceWorker.ready;
  // Una suscripción previa pudo crearse con OTRA clave VAPID (p. ej. tras regenerarla):
  // re-suscribir con una applicationServerKey distinta lanza InvalidStateError.
  // Por eso desuscribimos siempre y recreamos con la VAPID actual.
  const existing = await reg.pushManager.getSubscription();
  if (existing) await existing.unsubscribe().catch(() => {});
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
  });
  // Multi-dispositivo: agregar la sub de ESTE device al array sin pisar las de otros.
  // Merge por `endpoint` (único por navegador): si el device ya estaba, se reemplaza.
  const ref = doc(db, `users/${uid}/config/push`);
  const json = sub.toJSON() as Sub;
  const stored = readSubs((await getDoc(ref)).data());
  const next = [...stored.filter((s) => s.endpoint !== json.endpoint), json];
  // Se elimina el campo legacy `subscription` (singular): ya migrado al array.
  await setDoc(ref, { subscriptions: next, subscription: deleteField(), updatedAt: Date.now() }, { merge: true });
  return true;
}

// Auto-reparación (item B): al abrir la app, si este device tiene permiso y una sub local
// activa pero su endpoint NO está en Firestore (doc limpiado, sub recreada por el navegador,
// device nuevo que perdió el registro), la re-agrega. Reemplaza depender de
// `pushsubscriptionchange`, que muchos navegadores no disparan de forma confiable.
// Barato: 1 lectura; escribe SOLO si faltaba. No pide permisos (no molesta si están denegados).
export async function syncPushSubscription(uid: string): Promise<void> {
  if (!pushSupported()) return;
  if (Notification.permission !== "granted") return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return; // sin sub local: el usuario no activó push en este device
  const ref = doc(db, `users/${uid}/config/push`);
  const existing = readSubs((await getDoc(ref)).data());
  const json = sub.toJSON() as Sub;
  if (existing.some((s) => s.endpoint === json.endpoint)) return; // ya registrada
  const next = [...existing, json];
  await setDoc(ref, { subscriptions: next, subscription: deleteField(), updatedAt: Date.now() }, { merge: true }).catch(() => {});
}

export async function disablePush(uid: string): Promise<void> {
  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  const endpoint = sub?.endpoint;
  if (sub) await sub.unsubscribe();
  // Quitar SOLO la sub de este device; las de otros dispositivos siguen activas.
  const ref = doc(db, `users/${uid}/config/push`);
  const remaining = readSubs((await getDoc(ref)).data()).filter((s) => s.endpoint !== endpoint);
  if (remaining.length > 0) {
    await setDoc(ref, { subscriptions: remaining, subscription: deleteField() }, { merge: true }).catch(() => {});
  } else {
    // Era el último dispositivo → borrar el doc (config/push.exists = "tiene push").
    await deleteDoc(ref).catch(() => {});
  }
}
