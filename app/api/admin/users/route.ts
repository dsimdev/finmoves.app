import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { requireOwner } from "@/lib/auth-route";
import { pushYGuardar } from "@/lib/notif-store";
import { FieldValue } from "firebase-admin/firestore";

export const dynamic = "force-dynamic";

const PERMISOS_VALIDOS = ["comprobantes", "inversion"] as const;

// Cache de módulo: el panel es solo del owner y la lista cambia poco. 60s evita
// que refrescos seguidos re-lean 3 docs × usuario. Se invalida al cambiar permisos.
const USERS_CACHE_TTL = 60_000;
let usersCache: { data: unknown[]; ts: number } | null = null;

// Setea un permiso de un usuario: body { uid, key, value, motivo }. Solo el dueño.
export async function POST(req: NextRequest) {
  const owner = await requireOwner(req);
  if (typeof owner !== "string") return owner;
  const { uid: targetUid, key, value, motivo } = await req.json();
  if (!targetUid || !PERMISOS_VALIDOS.includes(key)) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  // Leer el valor anterior del permiso
  const oldPermisos = (await adminDb().doc(`users/${targetUid}/config/permisos`).get()).data() as Record<string, boolean> | undefined;
  const oldValue = oldPermisos?.[key] ?? false;

  // Actualizar el permiso
  await adminDb().doc(`users/${targetUid}/config/permisos`).set(
    { [key]: !!value },
    { merge: true }
  );

  // Guardar en el historial
  const now = new Date();
  await adminDb().doc(`users/${targetUid}/config/permisosLog`).set(
    {
      historial: FieldValue.arrayUnion({
        timestamp: now,
        key,
        oldValue,
        newValue: !!value,
        motivo: motivo ?? "Sin motivo",
        changedBy: owner,
      }),
    },
    { merge: true }
  );

  const labels: Record<string, string> = { comprobantes: "Imágenes", inversion: "Inversión" };
  const label = labels[key] ?? key;
  const timeStr = now.toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
  const body = value
    ? `Se activó ${label} por: ${motivo ?? "Sin motivo"} (${timeStr})`
    : `Se desactivó ${label} por: ${motivo ?? "Sin motivo"} (${timeStr})`;
  const pushDoc = await adminDb().doc(`users/${targetUid}/config/push`).get();
  if (pushDoc.exists) {
    await pushYGuardar(targetUid, "permiso", { title: "FinMoves", body, tag: "permission-change", url: "/settings" }, "/settings").catch(() => {});
  }
  usersCache = null; // cambió un permiso → la lista cacheada quedó vieja
  return NextResponse.json({ ok: true });
}

// Lista de usuarios registrados — SOLO el dueño (OWNER_UID). Combina Firebase Auth
// (email, alta) con su config de Firestore (nombre, permisos, si tiene push).
export async function GET(req: NextRequest) {
  const owner = await requireOwner(req);
  if (typeof owner !== "string") return owner;

  if (usersCache && Date.now() - usersCache.ts < USERS_CACHE_TTL) {
    return NextResponse.json({ users: usersCache.data });
  }

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
      const data = (await adminDb().doc(`users/${u.uid}/config/meta`).get()).data() as
        | { meta?: { nombre?: string } }
        | undefined;
      const meta = data?.meta;
      const permisos = ((await adminDb().doc(`users/${u.uid}/config/permisos`).get()).data() ?? {}) as Record<string, boolean>;
      const pushOn = (await adminDb().doc(`users/${u.uid}/config/push`).get()).exists;
      return {
        uid: u.uid,
        email: u.email ?? "",
        nombre: meta?.nombre ?? "",
        createdAt: u.metadata.creationTime ?? "",
        lastSignIn: u.metadata.lastSignInTime ?? "",
        pushOn,
        permisos,
        inviteCode: codeByUser.get(u.uid) ?? null,
        isOwner: u.uid === owner,
      };
    })
  );
  // Más nuevos primero.
  users.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  usersCache = { data: users, ts: Date.now() };
  return NextResponse.json({ users });
}
