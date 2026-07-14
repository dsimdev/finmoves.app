import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb, adminBucket } from "@/lib/firebase-admin";
import { requireUser } from "@/lib/auth-route";

export const dynamic = "force-dynamic";

export async function DELETE(req: NextRequest) {
  const uid = await requireUser(req);
  if (typeof uid !== "string") return uid;

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
