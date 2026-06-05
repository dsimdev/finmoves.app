"use client";

import { useEffect, useState } from "react";
import { Movimiento } from "@/types";
import { collection, query, orderBy, getDocs, Timestamp } from "firebase/firestore";
import { db } from "@/services/firebase/firebase";

export function useAllMovimientos(userId: string | undefined) {
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    const fetch = async () => {
      try {
        const ref = collection(db, `users/${userId}/movimientos`);
        const q = query(ref, orderBy("timestampCarga", "desc"));
        const snap = await getDocs(q);

        const data = snap.docs.map((d) => ({
          ...d.data(),
          id: d.id, // después del spread para no ser sobreescrito por id: "" del documento
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
  }, [userId]);

  return { movimientos, loading };
}
