import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

async function requireOwner(req: NextRequest): Promise<string | NextResponse> {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let uid: string;
  try {
    uid = (await adminAuth().verifyIdToken(token)).uid;
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }
  const owner = process.env.OWNER_UID ?? process.env.NEXT_PUBLIC_OWNER_UID;
  if (!owner || uid !== owner) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return uid;
}

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
