import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";

// Caracteres sin ambigüedad (sin 0/O, 1/I) para que sea fácil de dictar/copiar.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function randomCode(len = 6): string {
  let out = "";
  for (let i = 0; i < len; i++) out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return out;
}

// Genera un código de invitación de un solo uso. Solo el dueño (OWNER_UID).
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

  const owner = process.env.OWNER_UID ?? process.env.NEXT_PUBLIC_OWNER_UID;
  if (!owner || uid !== owner) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

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
