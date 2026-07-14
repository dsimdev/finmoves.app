import { NextRequest, NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth-route";
import { syncUserMovimientosToSheet } from "@/lib/sync-sheets";

// Sync manual disparado por el dueño desde Configuración. Solo el owner puede sincronizar.
export async function POST(req: NextRequest) {
  const uid = await requireOwner(req);
  if (typeof uid !== "string") return uid;

  try {
    // Manual = full forzado: es el botón para dejar la hoja perfecta ya (espejo completo).
    const { synced } = await syncUserMovimientosToSheet(uid, { forceFull: true });
    return NextResponse.json({ synced, message: `Sync completa · ${synced} movimientos` });
  } catch (err) {
    // Detalle solo en logs del servidor; al cliente, mensaje genérico (evita filtrar
    // IDs de spreadsheet, email del service-account, etc.).
    console.error("Sync error:", err);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
