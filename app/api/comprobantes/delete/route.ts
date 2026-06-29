import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminBucket } from "@/lib/firebase-admin";

// Borrado de comprobantes mediado por servidor (F3). Solo permite borrar archivos
// bajo el propio prefijo del usuario.
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let uid: string;
  try { uid = (await adminAuth().verifyIdToken(token)).uid; }
  catch { return NextResponse.json({ error: "Invalid token" }, { status: 401 }); }

  const { path } = await req.json().catch(() => ({ path: null }));
  if (typeof path !== "string" || !path.startsWith(`users/${uid}/comprobantes/`)) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  await adminBucket().file(path).delete().catch(() => {});
  return NextResponse.json({ ok: true });
}
