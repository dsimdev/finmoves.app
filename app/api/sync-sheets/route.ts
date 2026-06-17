import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";
import { syncUserMovimientosToSheet } from "@/lib/sync-sheets";

// Sync manual disparado por el dueño desde Configuración. Solo el owner puede sincronizar.
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

  // Solo el owner puede triggereado sync (la funcionalidad es del dueño solamente).
  const owner = process.env.OWNER_UID ?? process.env.NEXT_PUBLIC_OWNER_UID;
  if (!owner || uid !== owner) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { synced } = await syncUserMovimientosToSheet(uid);
    return NextResponse.json({ synced, message: `Sync completa · ${synced} movimientos` });
  } catch (err) {
    console.error("Sync error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
