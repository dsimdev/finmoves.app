"use client";

import { useEffect, useState, useCallback } from "react";
import { Movimiento } from "@/types";
import { collection, query, orderBy, getDocs, Timestamp } from "firebase/firestore";
import { db } from "@/services/firebase/firebase";

export function useAllMovimientos(userId: string | undefined) {
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);

  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  // Actualización optimista en memoria: evita re-leer toda la colección tras editar/borrar.
  const updateLocal = useCallback((id: string, patch: Partial<Movimiento>) => {
    setMovimientos((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }, []);
  const removeLocal = useCallback((id: string) => {
    setMovimientos((prev) => prev.filter((m) => m.id !== id));
  }, []);

  useEffect(() => {
    if (!userId) return;

    const fetch = async () => {
      setLoading(true);
      try {
        const ref = collection(db, `users/${userId}/movimientos`);
        const q = query(ref, orderBy("timestampCarga", "desc"));
        const snap = await getDocs(q);

        const data = snap.docs.map((d) => ({
          ...d.data(),
          id: d.id,
          timestampCarga: (d.data().timestampCarga as Timestamp).toDate(),
        })) as Movimiento[];

        setMovimientos(data);
      } catch (err) {
        console.error("Error fetching movimientos:", err);
      } finally {
        setLoading(false);
      }
    };

    fetch();
  }, [userId, version]);

  return { movimientos, loading, refresh, updateLocal, removeLocal };
}
