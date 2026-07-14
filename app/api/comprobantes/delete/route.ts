import { NextRequest, NextResponse } from "next/server";
import { adminBucket } from "@/lib/firebase-admin";
import { requireUser } from "@/lib/auth-route";

// Borrado de comprobantes mediado por servidor (F3). Solo permite borrar archivos
// bajo el propio prefijo del usuario.
export async function POST(req: NextRequest) {
  const uid = await requireUser(req);
  if (typeof uid !== "string") return uid;

  const { path } = await req.json().catch(() => ({ path: null }));
  if (typeof path !== "string" || !path.startsWith(`users/${uid}/comprobantes/`)) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  await adminBucket().file(path).delete().catch(() => {});
  return NextResponse.json({ ok: true });
}
