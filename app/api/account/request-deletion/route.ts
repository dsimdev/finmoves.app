import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { pushYGuardar } from "@/lib/notif-store";
import { FieldValue } from "firebase-admin/firestore";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let uid: string;
  let email: string;
  try {
    const decoded = await adminAuth().verifyIdToken(token);
    uid = decoded.uid;
    email = decoded.email ?? uid;
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  await adminDb().doc(`users/${uid}/config/meta`).set(
    { meta: { pendingDeletion: true, pendingDeletionAt: FieldValue.serverTimestamp() } },
    { merge: true }
  );

  const ownerUid = process.env.OWNER_UID ?? process.env.NEXT_PUBLIC_OWNER_UID;
  if (ownerUid) {
    await pushYGuardar(ownerUid, "baja", {
      title: "Solicitud de baja",
      body: `${email} solicitó la eliminación de su cuenta.`,
      tag: "deletion-request",
      url: "/admin",
    }, "/admin").catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
