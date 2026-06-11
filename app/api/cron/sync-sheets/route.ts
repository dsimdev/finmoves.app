import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { getSheetsClient, getSheetName, backupAndRotate, overwriteData } from "@/lib/google-sheets";
import { movimientoToRow } from "@/lib/sheet-format";
import { Timestamp } from "firebase-admin/firestore";
import type { Movimiento } from "@/types";

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

  try {
    const snap = await adminDb()
      .collection(`users/${uid}/movimientos`)
      .orderBy("timestampCarga", "asc")
      .get();

    const rows = snap.docs.map((doc) => {
      const data = doc.data();
      const m = {
        ...data,
        id: doc.id,
        timestampCarga: (data.timestampCarga as Timestamp).toDate(),
      } as Movimiento;
      return movimientoToRow(m);
    });

    const sheets = await getSheetsClient();
    const sheetName = await getSheetName(sheets);
    await backupAndRotate(sheets);
    await overwriteData(sheets, sheetName, rows);

    await syncMetaRef.set({ lastSync: Timestamp.now(), lastError: null }, { merge: true });

    return NextResponse.json({ synced: rows.length, ok: true });
  } catch (err) {
    console.error("[cron/sync-sheets]", err);
    const message = err instanceof Error ? err.message : String(err);
    try {
      await syncMetaRef.set({ lastError: { message, at: Timestamp.now() } }, { merge: true });
    } catch { /* ignore */ }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
