import { adminDb } from "@/lib/firebase-admin";
import { getSheetsClient, getSheetName, backupAndRotate, overwriteData } from "@/lib/google-sheets";
import { movimientoToRow } from "@/lib/sheet-format";
import { Timestamp } from "firebase-admin/firestore";
import type { Movimiento } from "@/types";

// Espejo app → Google Sheets: escribe movimientos a Sheets y respalda la hoja.
// Si `movimientos` es pasado, usa ese array. Si no, lee de Firestore (para cron automático).
// Actualiza users/{uid}/config/syncMeta (lastSync / lastError). Lanza si algo falla.
export async function syncUserMovimientosToSheet(uid: string, movimientos?: unknown[]): Promise<{ synced: number }> {
  const syncMetaRef = adminDb().doc(`users/${uid}/config/syncMeta`);
  try {
    let rows: (string | number)[][];
    if (movimientos) {
      // Cliente pasó movimientos → no leer de Firestore
      rows = movimientos.map((m: unknown) => {
        const data = m as Record<string, unknown> & { timestampCarga?: { toDate: () => Date } | Date | number };
        let ts = data.timestampCarga;
        if (ts instanceof Date) {
          // already a Date
        } else if (typeof ts === 'number') {
          ts = new Date(ts);
        } else if (ts && typeof ts === 'object' && 'toDate' in ts) {
          ts = (ts as { toDate: () => Date }).toDate();
        }
        return movimientoToRow({ ...data, timestampCarga: ts } as Movimiento);
      });
    } else {
      // Cron automático → leer de Firestore (sin límite en este caso, asume reasonable dataset)
      const snap = await adminDb()
        .collection(`users/${uid}/movimientos`)
        .orderBy("timestampCarga", "asc")
        .get();
      rows = snap.docs.map((doc) => {
        const data = doc.data();
        const m = { ...data, id: doc.id, timestampCarga: (data.timestampCarga as Timestamp).toDate() } as Movimiento;
        return movimientoToRow(m);
      });
    }

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
