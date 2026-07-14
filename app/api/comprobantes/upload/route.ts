import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { adminDb, adminBucket } from "@/lib/firebase-admin";
import { requireUser } from "@/lib/auth-route";

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB (las imágenes ya vienen comprimidas del cliente)
// Whitelist explícita: image/* dejaba pasar SVG (contenido activo) — no hay caso de uso.
const ALLOWED = (ct: string) => ["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(ct);

// Subida de comprobantes mediada por servidor (F3): valida identidad, permiso, tipo
// y tamaño, y sube con el Admin SDK (las reglas de Storage deniegan la escritura
// directa del cliente). Devuelve una URL con download-token (no expira).
export async function POST(req: NextRequest) {
  const uid = await requireUser(req);
  if (typeof uid !== "string") return uid;

  // Permiso: dueño o quien tenga comprobantes=true en config/permisos — el doc
  // read-only que escribe SOLO el Admin SDK. Antes se leía config/meta, que el
  // usuario puede escribir (auto-escalación) y que el panel Admin NO escribe
  // (los habilitados por panel quedaban bloqueados).
  const owner = process.env.OWNER_UID ?? process.env.NEXT_PUBLIC_OWNER_UID;
  if (uid !== owner) {
    const permisos = (await adminDb().doc(`users/${uid}/config/permisos`).get()).data() as { comprobantes?: boolean } | undefined;
    if (permisos?.comprobantes !== true) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof Blob)) return NextResponse.json({ error: "No file" }, { status: 400 });
  const contentType = file.type || "application/octet-stream";
  if (!ALLOWED(contentType)) return NextResponse.json({ error: "Tipo no permitido" }, { status: 415 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Archivo muy grande" }, { status: 413 });

  const ext = contentType === "application/pdf" ? "pdf" : "jpg";
  const path = `users/${uid}/comprobantes/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const downloadToken = randomUUID();
  const buffer = Buffer.from(await file.arrayBuffer());

  const bucket = adminBucket();
  await bucket.file(path).save(buffer, {
    metadata: {
      contentType,
      cacheControl: "public, max-age=31536000, immutable",
      metadata: { firebaseStorageDownloadTokens: downloadToken },
    },
  });

  const url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(path)}?alt=media&token=${downloadToken}`;
  return NextResponse.json({ url, path });
}
