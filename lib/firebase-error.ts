import type { AppLocale } from "@/locales/es";

// Extrae el código de error de Firebase (ej. "auth/invalid-credential") de un error desconocido.
function firebaseCode(err: unknown): string {
  if (err && typeof err === "object" && "code" in err) {
    return String((err as { code: unknown }).code);
  }
  return "";
}

// Mapea un error de Firebase Auth a un mensaje humano del locale activo.
export function authErrorMessage(err: unknown, t: AppLocale): string {
  const code = firebaseCode(err);
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return t.authInvalidCredential;
    case "auth/invalid-email":
      return t.authInvalidEmail;
    case "auth/user-disabled":
      return t.authUserDisabled;
    case "auth/too-many-requests":
      return t.authTooManyRequests;
    case "auth/network-request-failed":
      return t.authNetwork;
    default:
      return t.authGeneric;
  }
}

// Mapea un error de Firestore (guardado) a un mensaje humano del locale activo.
export function dbErrorMessage(err: unknown, t: AppLocale): string {
  const code = firebaseCode(err);
  switch (code) {
    case "permission-denied":
      return t.errPermission;
    case "unavailable":
    case "deadline-exceeded":
      return t.errUnavailable;
    default:
      return t.errSaveGeneric;
  }
}
