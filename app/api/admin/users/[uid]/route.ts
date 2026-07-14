import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireOwner } from "@/lib/auth-route";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  const owner = await requireOwner(req);
  if (typeof owner !== "string") return owner;

  const { uid: targetUid } = await params;
  if (!targetUid) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  try {
    const doc = await adminDb().doc(`users/${targetUid}/config/permisosLog`).get();
    const data = doc.data() ?? {};
    const historial = (data.historial ?? []).map((log: any) => ({
      ...log,
      timestamp: log.timestamp?.toDate?.() ?? new Date(log.timestamp),
    }));
    return NextResponse.json({ historial });
  } catch {
    return NextResponse.json({ error: "Error reading log" }, { status: 500 });
  }
}
