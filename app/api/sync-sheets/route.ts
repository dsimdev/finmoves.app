import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { getSheetsClient, getSheetName, backupAndRotate, overwriteData, appendData } from "@/lib/google-sheets";
import { movimientoToRow } from "@/lib/sheet-format";
import { Timestamp } from "firebase-admin/firestore";
import type { Movimiento } from "@/types";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let uid: string;
  try {
    const decoded = await adminAuth().verifyIdToken(token);
    uid = decoded.uid;
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  try {
    // Leer último timestamp de sync (1 sola lectura)
    const syncMetaRef = adminDb().doc(`users/${uid}/config/syncMeta`);
    const syncMetaSnap = await syncMetaRef.get();
    const lastSync = syncMetaSnap.exists ? (syncMetaSnap.data()!.lastSync as Timestamp) : null;

    // Solo leer movimientos nuevos si hay sync previa
    const baseQuery = adminDb()
      .collection(`users/${uid}/movimientos`)
      .orderBy("timestampCarga", "asc");

    const snap = await (lastSync
      ? baseQuery.where("timestampCarga", ">", lastSync)
      : baseQuery
    ).get();

    // Nada nuevo desde la última sync
    if (lastSync && snap.empty) {
      return NextResponse.json({ synced: 0, message: "Sin cambios desde la última sync" });
    }

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

    if (!lastSync) {
      // Primera sync: backup completo + overwrite
      await backupAndRotate(sheets);
      await overwriteData(sheets, sheetName, rows);
    } else {
      // Sync incremental: solo append, sin backup
      await appendData(sheets, sheetName, rows);
    }

    // Guardar timestamp de esta sync
    await syncMetaRef.set({ lastSync: Timestamp.now() }, { merge: true });

    const msg = lastSync
      ? `${rows.length} movimiento${rows.length !== 1 ? "s" : ""} nuevo${rows.length !== 1 ? "s" : ""} sincronizado${rows.length !== 1 ? "s" : ""}`
      : `Sync completa · ${rows.length} movimientos`;

    return NextResponse.json({ synced: rows.length, message: msg });
  } catch (err) {
    console.error("Sync error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
