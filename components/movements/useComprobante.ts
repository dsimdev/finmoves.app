import { useState } from "react";

// Estado del comprobante adjunto (alta y edición) + visor de media. Encapsula el
// ciclo de vida del object-URL de la preview (revoke al reemplazar/limpiar/reset).
export function useComprobante() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);
  const [viewer, setViewer] = useState<{ src: string; isPdf: boolean } | null>(null);

  const reset = () => {
    setPreview((p) => { if (p) URL.revokeObjectURL(p); return null; });
    setFile(null); setRemoved(false);
  };

  const onSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setRemoved(false);
  };

  const clear = () => {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null); setPreview(null); setRemoved(true);
  };

  return { file, preview, removed, viewer, setViewer, reset, onSelect, clear };
}
