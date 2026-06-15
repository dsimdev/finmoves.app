import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { syncUserMovimientosToSheet } from "@/lib/sync-sheets";
import { sendPushToUser } from "@/lib/web-push";
import { notifyAllUsers } from "@/lib/notifications";
import { Timestamp } from "firebase-admin/firestore";

// Cotización oficial del dólar (una sola vez, se reparte a todos los usuarios).
async function fetchDolarOficial(): Promise<number | null> {
  try {
    const res = await fetch("https://api.bluelytics.com.ar/v2/latest", { cache: "no-store" });
    const json = await res.json();
    return (json?.oficial?.value_sell as number | undefined) ?? null;
  } catch {
    return null;
  }
}

// Cloud Scheduler invoca esta ruta con Authorization: Bearer <CRON_SECRET>.
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ownerUid = process.env.OWNER_UID ?? process.env.NEXT_PUBLIC_OWNER_UID;
  if (!ownerUid) {
    return NextResponse.json({ error: "OWNER_UID not set" }, { status: 500 });
  }

  // ── 1) Sync a Google Sheets — SOLO el dueño (es su funcionalidad) ──
  const syncMetaRef = adminDb().doc(`users/${ownerUid}/config/syncMeta`);
  const appendLog = async (entry: { status: "ok" | "error"; type: "auto"; at: Timestamp; message: string }) => {
    try {
      const snap = await syncMetaRef.get();
      const prev = (snap.data()?.logs ?? []) as unknown[];
      await syncMetaRef.set({ logs: [entry, ...prev].slice(0, 30) }, { merge: true });
    } catch { /* ignore */ }
  };

  // El sync a Sheets se auto-limita a ~1×/día aunque la cron corra más seguido
  // (la frecuencia alta es para las notificaciones, no para re-sincronizar Sheets).
  const SYNC_MIN_INTERVAL_MS = 20 * 60 * 60 * 1000;
  const lastAutoSync = (await syncMetaRef.get()).data()?.lastAutoSync as Timestamp | undefined;
  const shouldSync = !lastAutoSync || Date.now() - lastAutoSync.toMillis() > SYNC_MIN_INTERVAL_MS;

  let result: { ok: boolean; synced?: number; error?: string; skipped?: boolean };
  if (!shouldSync) {
    result = { ok: true, skipped: true };
  } else {
    try {
      const { synced } = await syncUserMovimientosToSheet(ownerUid);
      await syncMetaRef.set({ lastAutoSync: Timestamp.now() }, { merge: true });
      await appendLog({ status: "ok", type: "auto", at: Timestamp.now(), message: `Sync automática · ${synced} movimientos` });
      result = { ok: true, synced };
    } catch (err) {
      console.error("[cron/sync-sheets]", err);
      const message = err instanceof Error ? err.message : String(err);
      await appendLog({ status: "error", type: "auto", at: Timestamp.now(), message });
      // Aviso de fallo de sync — solo al dueño.
      await sendPushToUser(ownerUid, { title: "FinMoves", body: "Falló la sincronización con Google Sheets", tag: "sync-error", url: "/settings" });
      result = { ok: false, error: message };
    }
  }

  // ── 2) Avisos para TODOS los usuarios (versión, dólar, meta, sueldo) ──
  // Idempotente: deduplica vía config/notifyMeta, así correrlo más seguido no spamea.
  try {
    await notifyAllUsers({
      dolarOficial: await fetchDolarOficial(),
    });
  } catch (err) {
    console.error("[cron/notify]", err);
  }

  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
