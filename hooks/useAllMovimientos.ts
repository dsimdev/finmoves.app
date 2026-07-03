"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Movimiento } from "@/types";
import { collection, query, orderBy, where, getDocs, getCountFromServer, Timestamp } from "firebase/firestore";
import { db } from "@/services/firebase/firebase";

type SerializedMovimiento = Omit<Movimiento, "timestampCarga"> & { timestampCarga: string };

function cacheKey(uid: string) { return `moves_${uid}`; }

function saveCache(uid: string, movs: Movimiento[]) {
  try {
    localStorage.setItem(cacheKey(uid), JSON.stringify({
      count: movs.length,
      data: movs.map((m) => ({ ...m, timestampCarga: m.timestampCarga.toISOString() })),
    }));
  } catch { /* quota exceeded o SSR */ }
}

function loadCache(uid: string): { movimientos: Movimiento[]; count: number } | null {
  try {
    const raw = localStorage.getItem(cacheKey(uid));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { count: number; data: SerializedMovimiento[] };
    const movimientos = parsed.data.map((m) => ({ ...m, timestampCarga: new Date(m.timestampCarga) }));
    return { movimientos, count: parsed.count };
  } catch { return null; }
}

async function fullFetch(uid: string): Promise<Movimiento[]> {
  const ref = collection(db, `users/${uid}/movimientos`);
  const snap = await getDocs(query(ref, orderBy("timestampCarga", "desc")));
  return snap.docs.map((d) => ({
    ...d.data(),
    id: d.id,
    timestampCarga: (d.data().timestampCarga as Timestamp).toDate(),
  })) as Movimiento[];
}

// Trae solo los docs más nuevos que el último cacheado (rango sobre un único campo,
// no necesita índice compuesto). Convierte un re-sync típico de ~1.4K lecturas en 1–5.
async function incrementalFetch(uid: string, since: Date): Promise<Movimiento[]> {
  const ref = collection(db, `users/${uid}/movimientos`);
  const snap = await getDocs(query(ref, where("timestampCarga", ">", Timestamp.fromDate(since)), orderBy("timestampCarga", "desc")));
  return snap.docs.map((d) => ({
    ...d.data(),
    id: d.id,
    timestampCarga: (d.data().timestampCarga as Timestamp).toDate(),
  })) as Movimiento[];
}

export function useAllMovimientos(userId: string | undefined) {
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);
  const prevUserId = useRef<string | undefined>(undefined);

  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  const updateLocal = useCallback((id: string, patch: Partial<Movimiento>) => {
    setMovimientos((prev) => {
      const next = prev.map((m) => (m.id === id ? { ...m, ...patch } : m));
      if (userId) saveCache(userId, next);
      return next;
    });
  }, [userId]);

  const removeLocal = useCallback((id: string) => {
    setMovimientos((prev) => {
      const next = prev.filter((m) => m.id !== id);
      if (userId) saveCache(userId, next);
      return next;
    });
  }, [userId]);

  // Inserta movimientos al inicio (más recientes primero) y actualiza cache.
  // El count del cache queda igual al servidor, evitando un fullFetch en la próxima sesión.
  const prependLocal = useCallback((newMovs: Movimiento[]) => {
    setMovimientos((prev) => {
      const next = [...newMovs, ...prev];
      if (userId) saveCache(userId, next);
      return next;
    });
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    prevUserId.current = userId;

    const fetch = async () => {
      // Mostrar cache mientras verificamos conteo en servidor
      const cached = loadCache(userId);
      if (cached) {
        setMovimientos(cached.movimientos);
        setLoading(false);
      } else {
        setLoading(true);
      }

      // 1 lectura de agregación (no cobra como lectura de doc)
      const ref = collection(db, `users/${userId}/movimientos`);
      const countSnap = await getCountFromServer(query(ref));
      const serverCount = countSnap.data().count;

      if (cached && serverCount === cached.count) {
        setLoading(false);
        return;
      }

      // Server tiene MÁS docs (altas desde otra sesión/dispositivo): traer solo lo
      // nuevo y mergear. Si los números no cierran (también hubo borrados), cae al
      // full fetch de abajo como red de seguridad.
      if (cached && serverCount > cached.count && cached.movimientos.length > 0) {
        const newest = cached.movimientos.reduce((max, m) => m.timestampCarga > max ? m.timestampCarga : max, cached.movimientos[0].timestampCarga);
        const nuevos = await incrementalFetch(userId, newest);
        if (cached.count + nuevos.length === serverCount) {
          const ids = new Set(nuevos.map((m) => m.id));
          const next = [...nuevos, ...cached.movimientos.filter((m) => !ids.has(m.id))];
          setMovimientos(next);
          saveCache(userId, next);
          setLoading(false);
          return;
        }
      }

      // Conteo menor o merge inconsistente (borrados/ediciones cruzadas): re-fetch completo
      const data = await fullFetch(userId);
      setMovimientos(data);
      saveCache(userId, data);
      setLoading(false);
    };

    fetch().catch((err) => {
      console.error("Error fetching movimientos:", err);
      setLoading(false);
    });
  }, [userId, version]);

  return { movimientos, loading, refresh, updateLocal, removeLocal, prependLocal };
}
