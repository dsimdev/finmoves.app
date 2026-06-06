import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { getSheetsClient, getSheetName, backupAndRotate, overwriteData } from "@/lib/google-sheets";
import { movimientoToRow } from "@/lib/sheet-format";
import { Timestamp } from "firebase-admin/firestore";
import type { Movimiento } from "@/types";

export async function POST(req: NextRequest) {
  // Verificar el ID token de Firebase
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
    // Fuente de verdad: todos los movimientos de la app, en orden de carga.
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

    // Backup ANTES de reescribir. Si falla, abortamos sin tocar los datos.
    await backupAndRotate(sheets);

    // Espejo: la hoja Movimientos queda idéntica a la app.
    await overwriteData(sheets, sheetName, rows);

    return NextResponse.json({
      synced: rows.length,
      message: `Backup actualizado · ${rows.length} movimientos`,
    });
  } catch (err) {
    console.error("Sync error:", err);
    return NextResponse.json({ error: "Error al sincronizar" }, { status: 500 });
  }
}
