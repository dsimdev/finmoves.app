import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

const PERMISOS_VALIDOS = ["comprobantes", "inversion"] as const;

// Verifica que el llamador sea el dueño (OWNER_UID). Devuelve su uid o un error.
async function requireOwner(req: NextRequest): Promise<string | NextResponse> {
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
  return uid;
}

// Setea un permiso de un usuario: body { uid, key, value }. Solo el dueño.
export async function POST(req: NextRequest) {
  const owner = await requireOwner(req);
  if (typeof owner !== "string") return owner;
  const { uid: targetUid, key, value } = await req.json();
  if (!targetUid || !PERMISOS_VALIDOS.includes(key)) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  await adminDb().doc(`users/${targetUid}/config/meta`).set(
    { permisos: { [key]: !!value } },
    { merge: true }
  );
  return NextResponse.json({ ok: true });
}

// Lista de usuarios registrados — SOLO el dueño (OWNER_UID). Combina Firebase Auth
// (email, alta) con su config de Firestore (nombre, permisos, si tiene push).
export async function GET(req: NextRequest) {
  const owner = await requireOwner(req);
  if (typeof owner !== "string") return owner;

  const list = await adminAuth().listUsers(1000);
  // Mapa uid → código que usó (para mostrarlo en cada usuario).
  const codesSnap = await adminDb().collection("inviteCodes").get();
  const codeByUser = new Map<string, string>();
  codesSnap.docs.forEach((d) => {
    const usedBy = (d.data() as { usedBy?: string }).usedBy;
    if (usedBy) codeByUser.set(usedBy, d.id);
  });
  const users = await Promise.all(
    list.users.map(async (u) => {
      const meta = (await adminDb().doc(`users/${u.uid}/config/meta`).get()).data() as
        | { nombre?: string; permisos?: Record<string, boolean> }
        | undefined;
      const pushOn = (await adminDb().doc(`users/${u.uid}/config/push`).get()).exists;
      return {
        uid: u.uid,
        email: u.email ?? "",
        nombre: meta?.nombre ?? "",
        createdAt: u.metadata.creationTime ?? "",
        lastSignIn: u.metadata.lastSignInTime ?? "",
        pushOn,
        permisos: meta?.permisos ?? {},
        inviteCode: codeByUser.get(u.uid) ?? null,
        isOwner: u.uid === owner,
      };
    })
  );
  // Más nuevos primero.
  users.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return NextResponse.json({ users });
}
