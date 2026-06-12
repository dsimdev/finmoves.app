import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";
import { sendPushToUser } from "@/lib/web-push";

// Dispara una notificación de prueba a la suscripción del usuario autenticado.
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let uid: string;
  try {
    uid = (await adminAuth().verifyIdToken(token)).uid;
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  await sendPushToUser(uid, {
    title: "FinMoves",
    body: "Notificación de prueba ✓",
    tag: "test",
    url: "/settings",
  });
  return NextResponse.json({ ok: true });
}
