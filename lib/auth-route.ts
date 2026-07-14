import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";

// Autenticación de rutas API. Centraliza el parse del header "Bearer <idToken>" y la
// verificación con el Admin SDK, que antes estaba copiada literal en 8 rutas.
// Todas devuelven el uid (o el par uid+email) en éxito, o un NextResponse de error
// listo para retornar. El caller chequea `typeof x !== "string"` para cortar temprano.

function bearer(req: NextRequest): string | null {
  const authHeader = req.headers.get("authorization") ?? "";
  return authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
}

// Verifica el idToken y devuelve el uid del llamador (cualquier usuario logueado).
export async function requireUser(req: NextRequest): Promise<string | NextResponse> {
  const token = bearer(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return (await adminAuth().verifyIdToken(token)).uid;
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }
}

// Como requireUser, pero además devuelve el email (fallback al uid si el token no lo trae).
export async function requireUserWithEmail(req: NextRequest): Promise<{ uid: string; email: string } | NextResponse> {
  const token = bearer(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const decoded = await adminAuth().verifyIdToken(token);
    return { uid: decoded.uid, email: decoded.email ?? decoded.uid };
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }
}

// Verifica el idToken Y que el llamador sea el dueño (OWNER_UID). Devuelve su uid o error.
export async function requireOwner(req: NextRequest): Promise<string | NextResponse> {
  const uid = await requireUser(req);
  if (typeof uid !== "string") return uid;
  const owner = process.env.OWNER_UID ?? process.env.NEXT_PUBLIC_OWNER_UID;
  if (!owner || uid !== owner) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return uid;
}
