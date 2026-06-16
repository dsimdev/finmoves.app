"use client";

import { GoogleAuthProvider, signInWithPopup, linkWithPopup, getAdditionalUserInfo, signOut, type UserCredential } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "@/services/firebase/firebase";
import { uploadAvatarFromUrl } from "./storage";
import { ensureUserDoc } from "@/services/firebase/config";

const provider = new GoogleAuthProvider();

// El nombre/foto de Google vienen en el RESULTADO del popup (providerData /
// additionalUserInfo), NO en auth.currentUser.displayName (que tras vincular
// puede quedar vacío). Por eso leemos del credential.
function datosGoogle(result: UserCredential): { name?: string; photo?: string } {
  const g = result.user.providerData.find((p) => p.providerId === "google.com");
  const profile = getAdditionalUserInfo(result)?.profile as { name?: string; picture?: string } | undefined;
  return {
    name: g?.displayName ?? profile?.name ?? undefined,
    photo: g?.photoURL ?? profile?.picture ?? undefined,
  };
}

// Sincroniza nombre + foto al perfil. `overwriteName`: true al vincular (refresca
// desde Google), false al loguear (solo completa si está vacío, para no pisar un
// nombre que el usuario haya editado). La foto se copia a Storage (URL estable).
async function syncGoogleProfile(result: UserCredential, overwriteName: boolean): Promise<void> {
  const u = auth.currentUser;
  if (!u) return;
  const { name, photo } = datosGoogle(result);
  const meta: Record<string, unknown> = {};

  if (name) {
    if (overwriteName) {
      meta.nombre = name;
    } else {
      const snap = await getDoc(doc(db, `users/${u.uid}/config/meta`)).catch(() => null);
      const actual = (snap?.data() as { meta?: { nombre?: string } } | undefined)?.meta?.nombre;
      if (!actual) meta.nombre = name;
    }
  }
  if (photo) {
    const stored = await uploadAvatarFromUrl(u.uid, photo);
    if (stored) meta.fotoURL = stored;
  }
  if (Object.keys(meta).length === 0) return;
  await setDoc(doc(db, `users/${u.uid}/config/meta`), { meta }, { merge: true }).catch(() => {});
}

// Login con Google. Registro CERRADO: si crea una cuenta nueva, se borra y rechaza.
export async function signInWithGoogle(): Promise<void> {
  const result = await signInWithPopup(auth, provider);
  if (getAdditionalUserInfo(result)?.isNewUser) {
    await result.user.delete().catch(() => {});
    await signOut(auth).catch(() => {});
    throw new Error("google-new-user");
  }
  await syncGoogleProfile(result, false);
  await ensureUserDoc(result.user.uid).catch(() => {});
}

// Vincula Google a la cuenta logueada (desde Configuración) y refresca nombre+foto.
export async function linkGoogle(): Promise<void> {
  if (!auth.currentUser) throw new Error("no-user");
  const result = await linkWithPopup(auth.currentUser, provider);
  await syncGoogleProfile(result, true);
}

export function isGoogleLinked(): boolean {
  return !!auth.currentUser?.providerData.some((p) => p.providerId === "google.com");
}
