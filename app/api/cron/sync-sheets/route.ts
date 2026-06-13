import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { syncUserMovimientosToSheet } from "@/lib/sync-sheets";
import { sendPushToUser } from "@/lib/web-push";
import { Timestamp } from "firebase-admin/firestore";

const DOLAR_THRESHOLD_PCT = 3;

// Aviso de nueva versión: notifica una vez cuando el build cambió.
async function checkNewVersion(uid: string) {
  const current = process.env.NEXT_PUBLIC_APP_VERSION ?? "0";
  const ref = adminDb().doc(`users/${uid}/config/notifyMeta`);
  const last = (await ref.get()).data()?.lastVersion as string | undefined;
  if (last && last !== current) {
    await sendPushToUser(uid, { title: "FinMoves", body: `Nueva versión ${current} disponible`, tag: "new-version", url: "/" });
  }
  await ref.set({ lastVersion: current }, { merge: true });
}

// Aviso de cambio brusco del dólar oficial (>= umbral vs. el chequeo anterior).
async function checkDolar(uid: string) {
  try {
    const res = await fetch("https://api.bluelytics.com.ar/v2/latest", { cache: "no-store" });
    const json = await res.json();
    const oficial = json?.oficial?.value_sell as number | undefined;
    if (!oficial) return;
    const ref = adminDb().doc(`users/${uid}/config/notifyMeta`);
    const last = (await ref.get()).data()?.lastDolarOficial as number | undefined;
    if (last) {
      const deltaPct = ((oficial - last) / last) * 100;
      if (Math.abs(deltaPct) >= DOLAR_THRESHOLD_PCT) {
        const dir = deltaPct > 0 ? "subió" : "bajó";
        await sendPushToUser(uid, {
          title: "Dólar oficial",
          body: `El oficial ${dir} ${Math.abs(deltaPct).toFixed(1)}% · $${oficial.toLocaleString("es-AR")}`,
          tag: "dolar", url: "/investments",
        });
      }
    }
    await ref.set({ lastDolarOficial: oficial }, { merge: true });
  } catch { /* ignore */ }
}

// Vercel invoca esta ruta diariamente (ver vercel.json) con Authorization: Bearer <CRON_SECRET>
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const uid = process.env.OWNER_UID ?? process.env.NEXT_PUBLIC_OWNER_UID;
  if (!uid) {
    return NextResponse.json({ error: "OWNER_UID not set" }, { status: 500 });
  }

  const syncMetaRef = adminDb().doc(`users/${uid}/config/syncMeta`);

  const appendLog = async (entry: { status: "ok" | "error"; type: "auto"; at: Timestamp; message: string }) => {
    try {
      const snap = await syncMetaRef.get();
      const prev = (snap.data()?.logs ?? []) as unknown[];
      await syncMetaRef.set({ logs: [entry, ...prev].slice(0, 30) }, { merge: true });
    } catch { /* ignore */ }
  };

  let result: { ok: boolean; synced?: number; error?: string };

  try {
    // syncUserMovimientosToSheet ya actualiza syncMeta (lastSync / lastError).
    const { synced } = await syncUserMovimientosToSheet(uid);
    await appendLog({ status: "ok", type: "auto", at: Timestamp.now(), message: `Sync automática · ${synced} movimientos` });
    result = { ok: true, synced };
  } catch (err) {
    console.error("[cron/sync-sheets]", err);
    const message = err instanceof Error ? err.message : String(err);
    await appendLog({ status: "error", type: "auto", at: Timestamp.now(), message });
    // Trigger 1: aviso de fallo de sync
    await sendPushToUser(uid, { title: "FinMoves", body: "Falló la sincronización con Google Sheets", tag: "sync-error", url: "/settings" });
    result = { ok: false, error: message };
  }

  // Trigger 2 y 3: nueva versión y cambio del dólar (siempre, aunque el sync falle)
  await checkNewVersion(uid);
  await checkDolar(uid);

  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
