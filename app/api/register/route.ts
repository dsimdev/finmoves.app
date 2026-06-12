import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { TEMPLATE_CONFIG } from "@/lib/default-config";
import { Timestamp } from "firebase-admin/firestore";

// Alta de cuenta por código de invitación. El signup público de Firebase queda
// cerrado: las cuentas se crean SOLO aquí, validando un código de un solo uso.
export async function POST(req: NextRequest) {
  let body: { email?: string; password?: string; code?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad-request" }, { status: 400 }); }

  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  const code = (body.code ?? "").trim().toUpperCase();

  if (!email || !password || !code) return NextResponse.json({ error: "missing-fields" }, { status: 400 });
  if (password.length < 6) return NextResponse.json({ error: "weak-password" }, { status: 400 });

  const codeRef = adminDb().doc(`inviteCodes/${code}`);
  const codeSnap = await codeRef.get();
  if (!codeSnap.exists || codeSnap.data()?.used) {
    return NextResponse.json({ error: "invalid-code" }, { status: 403 });
  }

  let uid: string;
  try {
    const user = await adminAuth().createUser({ email, password });
    uid = user.uid;
  } catch (err) {
    const code = (err as { code?: string })?.code ?? "";
    if (code === "auth/email-already-exists") return NextResponse.json({ error: "email-in-use" }, { status: 409 });
    if (code === "auth/invalid-email") return NextResponse.json({ error: "invalid-email" }, { status: 400 });
    return NextResponse.json({ error: "create-failed" }, { status: 400 });
  }

  // Config inicial + marcar el código como usado (atómico-ish: la cuenta ya existe).
  await adminDb().doc(`users/${uid}/config/meta`).set(TEMPLATE_CONFIG);
  await codeRef.set({ used: true, usedBy: uid, usedAt: Timestamp.now() }, { merge: true });

  return NextResponse.json({ ok: true });
}
