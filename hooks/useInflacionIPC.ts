"use client";

import { useState, useEffect, useCallback } from "react";

const LS_KEY = "finmoves.ipc";
const TTL = 24 * 60 * 60 * 1000;

type IpcEntry = { fecha: string; valor: number }; // "YYYY-MM"

function periodoIdToYM(periodoId: string): string {
  const [d, m, y] = periodoId.split("/");
  return `${y}-${m.padStart(2, "0")}`;
}

export function useInflacionIPC() {
  const [data, setData] = useState<IpcEntry[] | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const { ts, entries } = JSON.parse(raw) as { ts: number; entries: IpcEntry[] };
        if (Date.now() - ts < TTL) { setData(entries); return; }
      }
    } catch {}

    // Series de variación mensual % del IPC nivel general nacional (INDEC).
    // Convertimos las variaciones a un índice acumulado base 100 para poder
    // calcular deflactores entre cualquier par de fechas.
    fetch("https://apis.datos.gob.ar/series/api/series/?ids=148.3_INIVELNAL_DICI_M_26&limit=120&sort=asc&format=json", { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => {
        const raw = (json.data as [string, number | null][]).filter(([, v]) => v !== null);
        if (raw.length === 0) return;
        let idx = 100;
        const entries: IpcEntry[] = raw.map(([fecha, variacion]) => {
          idx = idx * (1 + variacion! / 100);
          return { fecha, valor: idx };
        });
        setData(entries);
        localStorage.setItem(LS_KEY, JSON.stringify({ ts: Date.now(), entries }));
      })
      .catch(() => {});
  }, []);

  // Convierte un monto histórico a pesos de hoy según IPC.
  // Si el IPC no está disponible aún, devuelve el monto sin tocar.
  const deflatar = useCallback(
    (monto: number, periodoId: string): number => {
      if (!data || data.length === 0) return monto;
      const ym = periodoIdToYM(periodoId);
      const latest = data[data.length - 1]!;
      const entry = data.find((e) => e.fecha === ym) ?? data.find((e) => e.fecha > ym);
      if (!entry) return monto;
      return monto * (latest.valor / entry.valor);
    },
    [data]
  );

  return { deflatar, ipcDisponible: !!data };
}
