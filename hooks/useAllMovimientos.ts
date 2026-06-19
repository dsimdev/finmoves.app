"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Movimiento } from "@/types";
import { collection, query, orderBy, getDocs, getCountFromServer, Timestamp } from "firebase/firestore";
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

  useEffect(() => {
    if (!userId) return;

    const userChanged = prevUserId.current !== userId;
    prevUserId.current = userId;

    // version > 0 y mismo usuario = refresh() explícito tras agregar un movimiento
    const isExplicitRefresh = version > 0 && !userChanged;

    const fetch = async () => {
      if (isExplicitRefresh) {
        // Después de agregar: re-fetch completo para traer el doc con ID de Firestore
        setLoading(true);
        const data = await fullFetch(userId);
        setMovimientos(data);
        saveCache(userId, data);
        setLoading(false);
        return;
      }

      // Carga inicial (o cambio de usuario): mostrar cache mientras verificamos
      const cached = loadCache(userId);
      if (cached) {
        setMovimientos(cached.movimientos);
        setLoading(false);
      } else {
        setLoading(true);
      }

      // 1 lectura de agregación para comparar el conteo
      const ref = collection(db, `users/${userId}/movimientos`);
      const countSnap = await getCountFromServer(query(ref));
      const serverCount = countSnap.data().count;

      if (cached && serverCount === cached.count) {
        // Cache válido — listo
        setLoading(false);
        return;
      }

      // Conteo distinto (alta o baja desde otra sesión/dispositivo): re-fetch completo
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

  return { movimientos, loading, refresh, updateLocal, removeLocal };
}
