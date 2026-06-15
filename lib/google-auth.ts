"use client";

import { GoogleAuthProvider, signInWithPopup, linkWithPopup, getAdditionalUserInfo, signOut } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "@/services/firebase/firebase";
import { uploadAvatarFromUrl } from "./storage";

const provider = new GoogleAuthProvider();

// Trae nombre + foto de Google al perfil. El nombre de Google PISA el guardado;
// la foto se copia a Storage (URL estable). Best-effort, no rompe el login si falla.
export async function syncGoogleProfile(): Promise<void> {
  const u = auth.currentUser;
  if (!u) return;
  const meta: Record<string, unknown> = {};
  if (u.displayName) meta.nombre = u.displayName;
  if (u.photoURL) {
    const stored = await uploadAvatarFromUrl(u.uid, u.photoURL);
    if (stored) meta.fotoURL = stored;
  }
  if (Object.keys(meta).length === 0) return;
  await setDoc(doc(db, `users/${u.uid}/config/meta`), { meta }, { merge: true }).catch(() => {});
}

// Login con Google. El registro sigue CERRADO (por código de invitación): si el
// popup crea una cuenta nueva (Google nunca vista), la borramos y rechazamos.
// Solo entra quien ya tiene cuenta y vinculó Google (ver linkGoogle).
export async function signInWithGoogle(): Promise<void> {
  const result = await signInWithPopup(auth, provider);
  const info = getAdditionalUserInfo(result);
  if (info?.isNewUser) {
    await result.user.delete().catch(() => {});
    await signOut(auth).catch(() => {});
    throw new Error("google-new-user");
  }
  await syncGoogleProfile();
}

// Vincula Google a la cuenta ya logueada (desde Configuración).
export async function linkGoogle(): Promise<void> {
  if (!auth.currentUser) throw new Error("no-user");
  await linkWithPopup(auth.currentUser, provider);
  await syncGoogleProfile();
}

export function isGoogleLinked(): boolean {
  return !!auth.currentUser?.providerData.some((p) => p.providerId === "google.com");
}
