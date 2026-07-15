"use client";

import { useState, useCallback } from "react";
import { doc, setDoc } from "firebase/firestore";
import { db } from "@/services/firebase/firebase";
import { useAuth } from "@/hooks/useAuth";
import { useData } from "@/app/(tabs)/data-context";

// Hint contextual de gesto: se muestra hasta que el usuario lo descarta. El estado
// "ya visto" se guarda en Firestore (config/meta.hintsVistos) → sobrevive a reinstalar,
// a diferencia del viejo useFirstVisit (localStorage). La lectura es gratis: config/meta
// ya se lee 1×/sesión (DataProvider). El descarte es 1 escritura chica con merge.
export function useHint(key: string): [boolean, () => void] {
  const { user } = useAuth();
  const { config, configLoading } = useData();
  // Descarte optimista local: apenas se toca la ×, se oculta ya (sin esperar el write).
  const [dismissedLocal, setDismissedLocal] = useState(false);

  const yaVisto = !!config?.meta.hintsVistos?.[key];
  // No mostrar mientras carga el config (evita el flash del hint que en realidad ya se vio).
  const show = !configLoading && !yaVisto && !dismissedLocal;

  const dismiss = useCallback(() => {
    setDismissedLocal(true);
    if (!user?.uid) return;
    setDoc(doc(db, `users/${user.uid}/config/meta`),
      { meta: { hintsVistos: { [key]: true } } }, { merge: true },
    ).catch(() => {});
  }, [user?.uid, key]);

  return [show, dismiss];
}
