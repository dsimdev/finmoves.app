import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb, adminBucket } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

export async function DELETE(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let uid: string;
  try {
    uid = (await adminAuth().verifyIdToken(token)).uid;
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const db = adminDb();

  // Borrar todos los datos del usuario (movimientos, config, recordatorios, plantillas).
  // recursiveDelete elimina el doc raíz + todas las subcolecciones en cascada.
  await db.recursiveDelete(db.doc(`users/${uid}`));

  // Borrar los archivos del usuario en Storage (comprobantes + avatar), que no viven
  // en Firestore. Sin esto, PII (recibos/fotos) quedaba huérfana tras eliminar la cuenta.
  try {
    await adminBucket().deleteFiles({ prefix: `users/${uid}/` });
  } catch (err) {
    console.error("[account/delete] storage cleanup:", err);
  }

  // Eliminar la cuenta de Firebase Auth.
  await adminAuth().deleteUser(uid);

  return NextResponse.json({ ok: true });
}
