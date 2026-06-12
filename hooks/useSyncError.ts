"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/services/firebase/firebase";
import { useAuth } from "./useAuth";

// True cuando el último intento de sync a Sheets falló (error más reciente que el
// último éxito). Se mantiene en tiempo real vía onSnapshot sobre syncMeta.
export function useSyncError(): boolean {
  const { user } = useAuth();
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!user?.uid) {
      setHasError(false);
      return;
    }
    const ref = doc(db, `users/${user.uid}/config/syncMeta`);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const d = snap.data();
        if (!d?.lastError) {
          setHasError(false);
          return;
        }
        const errAt = d.lastError?.at?.toDate?.()?.getTime?.() ?? 0;
        const syncAt = d.lastSync?.toDate?.()?.getTime?.() ?? 0;
        setHasError(errAt > syncAt);
      },
      () => setHasError(false)
    );
    return () => unsub();
  }, [user?.uid]);

  return hasError;
}
