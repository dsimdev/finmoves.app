import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireUserWithEmail } from "@/lib/auth-route";
import { pushYGuardar } from "@/lib/notif-store";
import { FieldValue } from "firebase-admin/firestore";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const auth = await requireUserWithEmail(req);
  if (!("uid" in auth)) return auth;
  const { uid, email } = auth;

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
