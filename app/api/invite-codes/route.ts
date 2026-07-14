import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireOwner } from "@/lib/auth-route";
import { Timestamp } from "firebase-admin/firestore";

// Caracteres sin ambigüedad (sin 0/O, 1/I) para que sea fácil de dictar/copiar.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function randomCode(len = 6): string {
  let out = "";
  for (let i = 0; i < len; i++) out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return out;
}

export const CODE_TTL_MS = 24 * 60 * 60 * 1000; // los códigos sin usar caducan en 24h

// Lista SOLO los códigos disponibles (sin usar) y no vencidos. Solo el dueño.
// De paso, borra los vencidos sin uso (limpieza oportunista).
export async function GET(req: NextRequest) {
  const owner = await requireOwner(req);
  if (typeof owner !== "string") return owner;
  const snap = await adminDb().collection("inviteCodes").get();
  const now = Date.now();
  const codes: { code: string; createdAt: number }[] = [];
  await Promise.all(snap.docs.map(async (d) => {
    const data = d.data() as { used?: boolean; createdAt?: Timestamp };
    if (data.used) return;
    const createdAt = data.createdAt?.toMillis() ?? 0;
    if (now - createdAt > CODE_TTL_MS) { await d.ref.delete().catch(() => {}); return; } // vencido → borrar
    codes.push({ code: d.id, createdAt });
  }));
  codes.sort((a, b) => b.createdAt - a.createdAt);
  return NextResponse.json({ codes });
}

// Borra un código manualmente: body { code }. Solo el dueño.
export async function DELETE(req: NextRequest) {
  const owner = await requireOwner(req);
  if (typeof owner !== "string") return owner;
  const { code } = await req.json();
  if (!code) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  await adminDb().doc(`inviteCodes/${code}`).delete();
  return NextResponse.json({ ok: true });
}

// Genera un código de invitación de un solo uso. Solo el dueño (OWNER_UID).
export async function POST(req: NextRequest) {
  const ownerRes = await requireOwner(req);
  if (typeof ownerRes !== "string") return ownerRes;
  const uid = ownerRes;

  // Reintenta si por casualidad ya existe.
  let code = randomCode();
  for (let i = 0; i < 5; i++) {
    const ref = adminDb().doc(`inviteCodes/${code}`);
    if (!(await ref.get()).exists) {
      await ref.set({ used: false, createdAt: Timestamp.now(), createdBy: uid });
      return NextResponse.json({ code });
    }
    code = randomCode();
  }
  return NextResponse.json({ error: "retry" }, { status: 500 });
}
