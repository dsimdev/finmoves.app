import { adminDb } from "@/lib/firebase-admin";
import { getSheetsClient, getSheetName, backupAndRotate, overwriteData, appendData } from "@/lib/google-sheets";
import { movimientoToRow } from "@/lib/sheet-format";
import { Timestamp } from "firebase-admin/firestore";
import type { Movimiento } from "@/types";

// Espejo app → Google Sheets. El sheet solo lo escribe la app (nadie edita directo
// en la hoja), así que su estado es exactamente lo del último sync. Eso habilita:
// - incremental (default): lee solo movimientos posteriores al último sincronizado
//   (syncMeta.lastSyncedTs) y los agrega al final. Costo: ~N docs nuevos.
// - full: lee toda la colección, respalda/rota la hoja y la sobrescribe. Corre si la
//   app editó/borró un movimiento (flag syncMeta.needsFullSync), si nunca hubo sync
//   (sin lastSyncedTs) o si se fuerza (sync manual desde Configuración).
// Actualiza users/{uid}/config/syncMeta (lastSync / lastError). Lanza si algo falla.
export async function syncUserMovimientosToSheet(
  uid: string,
  opts?: { forceFull?: boolean }
): Promise<{ synced: number; mode: "full" | "incremental" }> {
  const syncMetaRef = adminDb().doc(`users/${uid}/config/syncMeta`);
  try {
    const meta = (await syncMetaRef.get()).data() ?? {};
    const lastSyncedTs = meta.lastSyncedTs as Timestamp | undefined;
    const full = opts?.forceFull === true || meta.needsFullSync === true || !lastSyncedTs;

    const col = adminDb().collection(`users/${uid}/movimientos`);
    const snap = full
      ? await col.orderBy("timestampCarga", "asc").get()
      : await col.where("timestampCarga", ">", lastSyncedTs!).orderBy("timestampCarga", "asc").get();

    const rows = snap.docs.map((doc) => {
      const data = doc.data();
      const m = { ...data, id: doc.id, timestampCarga: (data.timestampCarga as Timestamp).toDate() } as Movimiento;
      return movimientoToRow(m);
    });

    // Incremental sin novedades: no hay nada que escribir en la hoja.
    if (full || rows.length > 0) {
      const sheets = await getSheetsClient();
      const sheetName = await getSheetName(sheets);
      if (full) {
        await backupAndRotate(sheets);
        await overwriteData(sheets, sheetName, rows);
      } else {
        await appendData(sheets, sheetName, rows);
      }
    }

    // El doc más nuevo sincronizado marca el corte del próximo incremental.
    const newestTs = snap.docs.length > 0
      ? (snap.docs[snap.docs.length - 1].get("timestampCarga") as Timestamp)
      : lastSyncedTs ?? null;
    await syncMetaRef.set({
      lastSync: Timestamp.now(),
      lastError: null,
      ...(newestTs ? { lastSyncedTs: newestTs } : {}),
      ...(full ? { needsFullSync: false } : {}),
    }, { merge: true });
    return { synced: rows.length, mode: full ? "full" : "incremental" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    try {
      await syncMetaRef.set({ lastError: { message, at: Timestamp.now() } }, { merge: true });
    } catch { /* ignore */ }
    throw err instanceof Error ? err : new Error(message);
  }
}
