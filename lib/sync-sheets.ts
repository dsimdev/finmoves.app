import { adminDb } from "@/lib/firebase-admin";
import { getSheetsClient, getSheetName, backupAndRotate, overwriteData } from "@/lib/google-sheets";
import { movimientoToRow } from "@/lib/sheet-format";
import { Timestamp } from "firebase-admin/firestore";
import type { Movimiento } from "@/types";

// Espejo app → Google Sheets: lee todos los movimientos del usuario (la app es la
// fuente de verdad), respalda/rota la hoja y la sobrescribe. Actualiza
// users/{uid}/config/syncMeta (lastSync / lastError). Lanza si algo falla.
// Usado tanto por el sync manual (/api/sync-sheets) como por el cron diario.
export async function syncUserMovimientosToSheet(uid: string): Promise<{ synced: number }> {
  const syncMetaRef = adminDb().doc(`users/${uid}/config/syncMeta`);
  try {
    const snap = await adminDb()
      .collection(`users/${uid}/movimientos`)
      .orderBy("timestampCarga", "asc")
      .get();

    const rows = snap.docs.map((doc) => {
      const data = doc.data();
      const m = { ...data, id: doc.id, timestampCarga: (data.timestampCarga as Timestamp).toDate() } as Movimiento;
      return movimientoToRow(m);
    });

    const sheets = await getSheetsClient();
    const sheetName = await getSheetName(sheets);
    await backupAndRotate(sheets);
    await overwriteData(sheets, sheetName, rows);

    await syncMetaRef.set({ lastSync: Timestamp.now(), lastError: null }, { merge: true });
    return { synced: rows.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    try {
      await syncMetaRef.set({ lastError: { message, at: Timestamp.now() } }, { merge: true });
    } catch { /* ignore */ }
    throw err instanceof Error ? err : new Error(message);
  }
}
