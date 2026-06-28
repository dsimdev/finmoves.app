import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { TEMPLATE_CONFIG } from "@/lib/default-config";
import { Timestamp } from "firebase-admin/firestore";
import type { Firestore } from "firebase-admin/firestore";

// Rate limit durable en Firestore (no en memoria): así funciona aunque haya varias
// instancias de Cloud Run y no se resetea en cada cold start. Doc por IP en
// `rateLimits/{ip}`; lo escribe solo el Admin SDK (las reglas niegan al cliente).
async function checkRateLimit(db: Firestore, ip: string, limit = 10, windowMs = 60000): Promise<{ allowed: boolean; retryAfter: number }> {
  const id = ip.replace(/[^a-zA-Z0-9._:-]/g, "_").slice(0, 200) || "unknown";
  const ref = db.doc(`rateLimits/${id}`);
  return db.runTransaction(async (tx) => {
    const now = Date.now();
    const data = (await tx.get(ref)).data() as { count?: number; resetAt?: number } | undefined;
    if (!data || (data.resetAt ?? 0) <= now) {
      tx.set(ref, { count: 1, resetAt: now + windowMs });
      return { allowed: true, retryAfter: 0 };
    }
    if ((data.count ?? 0) >= limit) {
      return { allowed: false, retryAfter: Math.ceil(((data.resetAt ?? now) - now) / 1000) };
    }
    tx.update(ref, { count: (data.count ?? 0) + 1 });
    return { allowed: true, retryAfter: 0 };
  });
}

// Alta de cuenta por código de invitación. El signup público de Firebase queda
// cerrado: las cuentas se crean SOLO aquí, validando un código de un solo uso.
export async function POST(req: NextRequest) {
  const db = adminDb();
  const fwd = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown";
  const ip = fwd.split(",")[0].trim(); // primer hop = IP del cliente
  const { allowed, retryAfter } = await checkRateLimit(db, ip, 10, 60000); // 10 intentos / minuto
  if (!allowed) {
    return NextResponse.json({error: "rate-limit"}, {status: 429, headers: {"Retry-After": retryAfter.toString()}});
  }
  let body: { email?: string; password?: string; code?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad-request" }, { status: 400 }); }

  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  const code = (body.code ?? "").trim().toUpperCase();

  if (!email || !password || !code) return NextResponse.json({ error: "missing-fields" }, { status: 400 });
  if (password.length < 6) return NextResponse.json({ error: "weak-password" }, { status: 400 });

  const codeRef = db.doc(`inviteCodes/${code}`);

  // Reservar el código de forma atómica: si dos requests usan el mismo código en
  // paralelo, solo uno gana la transacción; el otro ve `used` y aborta.
  try {
    const CODE_TTL_MS = 24 * 60 * 60 * 1000; // caduca a las 24h sin uso
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(codeRef);
      const data = snap.data();
      if (!snap.exists || data?.used) throw new Error("invalid-code");
      const createdAt = (data?.createdAt as Timestamp | undefined)?.toMillis() ?? 0;
      if (createdAt && Date.now() - createdAt > CODE_TTL_MS) throw new Error("invalid-code"); // vencido
      tx.update(codeRef, { used: true, reservedAt: Timestamp.now() });
    });
  } catch {
    return NextResponse.json({ error: "invalid-code" }, { status: 403 });
  }

  let uid: string;
  try {
    const user = await adminAuth().createUser({ email, password });
    uid = user.uid;
  } catch (err) {
    // No se pudo crear la cuenta → liberar el código para que no se desperdicie.
    await codeRef.set({ used: false, reservedAt: null }, { merge: true }).catch(() => {});
    const code = (err as { code?: string })?.code ?? "";
    if (code === "auth/email-already-exists") return NextResponse.json({ error: "email-in-use" }, { status: 409 });
    if (code === "auth/invalid-email") return NextResponse.json({ error: "invalid-email" }, { status: 400 });
    return NextResponse.json({ error: "create-failed" }, { status: 400 });
  }

  // Config inicial + dejar registrado quién usó el código.
  await db.doc(`users/${uid}/config/meta`).set(TEMPLATE_CONFIG);
  await codeRef.set({ used: true, usedBy: uid, usedAt: Timestamp.now() }, { merge: true });

  return NextResponse.json({ ok: true });
}
