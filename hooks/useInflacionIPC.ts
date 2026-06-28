"use client";

import { useState, useEffect, useCallback } from "react";

const LS_KEY = "finmoves.ipc.argly";
const TTL = 24 * 60 * 60 * 1000;

type IpcEntry = { fecha: string; valor: number }; // "YYYY-MM" → cumulative index

function periodoIdToYM(periodoId: string): string {
  const [, m, y] = periodoId.split("/");
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

    fetch("https://www.argly.com.ar/v1/ipc?historico=true", { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => {
        const sorted = (json.data as { anio: number; mes: number; valor: number }[])
          .sort((a, b) => a.anio !== b.anio ? a.anio - b.anio : a.mes - b.mes);
        if (sorted.length === 0) return;
        let idx = 100;
        const entries: IpcEntry[] = sorted.map(({ anio, mes, valor }) => {
          idx = idx * (1 + valor / 100);
          return { fecha: `${anio}-${String(mes).padStart(2, "0")}`, valor: idx };
        });
        setData(entries);
        localStorage.setItem(LS_KEY, JSON.stringify({ ts: Date.now(), entries }));
      })
      .catch(() => {});
  }, []);

  const deflatar = useCallback(
    (monto: number, periodoId: string): number => {
      if (!data || data.length === 0) return monto;
      const ym = periodoIdToYM(periodoId);
      const latest = data[data.length - 1]!;
      const entry = data.find((e) => e.fecha === ym)
        ?? [...data].reverse().find((e) => e.fecha <= ym)
        ?? null;
      if (!entry) return monto;
      return monto * (latest.valor / entry.valor);
    },
    [data]
  );

  return { deflatar, ipcDisponible: !!data };
}
