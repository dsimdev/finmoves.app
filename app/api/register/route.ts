import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { TEMPLATE_CONFIG } from "@/lib/default-config";
import { Timestamp } from "firebase-admin/firestore";

// Rate limit en memoria: [ip]: {count, resetAt}
const rateLimitMap = new Map<string, {count: number; resetAt: number}>();

function checkRateLimit(ip: string, limit = 10, windowMs = 60000): {allowed: boolean; retryAfter: number} {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || entry.resetAt <= now) {
    rateLimitMap.set(ip, {count: 1, resetAt: now + windowMs});
    return {allowed: true, retryAfter: 0};
  }
  if (entry.count >= limit) {
    return {allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000)};
  }
  entry.count++;
  return {allowed: true, retryAfter: 0};
}

// Alta de cuenta por código de invitación. El signup público de Firebase queda
// cerrado: las cuentas se crean SOLO aquí, validando un código de un solo uso.
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown";
  const {allowed, retryAfter} = checkRateLimit(ip, 10, 60000); // 10 intentos / minuto
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

  const db = adminDb();
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
