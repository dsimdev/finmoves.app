import { storage } from "@/services/firebase/firebase";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";

// Comprime/redimensiona una imagen en el cliente antes de subir (los comprobantes
// salen del teléfono a varios MB; así quedan en ~cientos de KB y cargan rápido).
// Devuelve un Blob JPEG. Si algo falla, devuelve el archivo original.
async function compressImage(file: File, maxDim = 1600, quality = 0.8): Promise<Blob> {
  try {
    const dataUrl: string = await new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result as string);
      fr.onerror = rej;
      fr.readAsDataURL(file);
    });
    const img: HTMLImageElement = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = dataUrl;
    });
    let w = img.naturalWidth, h = img.naturalHeight;
    if (Math.max(w, h) > maxDim) {
      const s = maxDim / Math.max(w, h);
      w = Math.round(w * s); h = Math.round(h * s);
    }
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, w, h);
    const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, "image/jpeg", quality));
    // Si la compresión no achicó (raro), usar el original.
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

// Sube un comprobante a users/{uid}/comprobantes/... y devuelve URL + path.
// Imágenes → se comprimen a JPEG. PDFs → tal cual. Cache largo para re-vistas instantáneas.
export async function uploadComprobante(uid: string, file: File): Promise<{ url: string; path: string }> {
  const esImagen = file.type.startsWith("image/");
  const data: Blob = esImagen ? await compressImage(file) : file;
  const ext = esImagen ? "jpg" : ((file.name.split(".").pop() || "pdf").toLowerCase().replace(/[^a-z0-9]/g, "") || "pdf");
  const contentType = esImagen ? "image/jpeg" : (file.type || "application/pdf");
  const path = `users/${uid}/comprobantes/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const r = ref(storage, path);
  await uploadBytes(r, data, { contentType, cacheControl: "public, max-age=31536000, immutable" });
  const url = await getDownloadURL(r);
  return { url, path };
}

// Copia una foto de perfil (ej. la de Google) a nuestro Storage y devuelve la URL
// estable. Best-effort: si falla (CORS, sin red), devuelve null y se omite la foto.
export async function uploadAvatarFromUrl(uid: string, srcUrl: string): Promise<string | null> {
  try {
    const res = await fetch(srcUrl);
    if (!res.ok) return null;
    const blob = await res.blob();
    const r = ref(storage, `users/${uid}/avatar.jpg`);
    await uploadBytes(r, blob, { contentType: blob.type || "image/jpeg", cacheControl: "public, max-age=86400" });
    return await getDownloadURL(r);
  } catch {
    return null;
  }
}

// Borra un comprobante por su path. Best-effort (ignora si ya no existe).
export async function deleteComprobante(path: string | undefined): Promise<void> {
  if (!path) return;
  try { await deleteObject(ref(storage, path)); } catch { /* ya no existe / sin permiso */ }
}
