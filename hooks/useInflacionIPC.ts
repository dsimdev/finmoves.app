"use client";

import { useState, useEffect, useCallback } from "react";

const LS_KEY = "finmoves.ipc.argly";
const TTL = 24 * 60 * 60 * 1000;

type IpcEntry = { fecha: string; valor: number }; // "YYYY-MM" → cumulative index

// El período arranca el día del sueldo (casi siempre a fin de mes) y cubre ~1 mes.
// Si arranca pasado el 15, la mayoría de los días caen en el mes SIGUIENTE → usamos
// ese mes para el IPC (el mes que el período realmente abarca, no el de inicio).
function periodoIdToYM(periodoId: string): string {
  const [dStr, mStr, yStr] = periodoId.split("/");
  let d = parseInt(dStr, 10), m = parseInt(mStr, 10), y = parseInt(yStr, 10);
  if (d > 15) { m += 1; if (m > 12) { m = 1; y += 1; } }
  return `${y}-${String(m).padStart(2, "0")}`;
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

  // Inflación del país (IPC acumulado) entre los meses de dos períodos.
  // Devuelve el % de variación del índice, o null si no hay datos.
  const ipcVar = useCallback(
    (prevPeriodoId: string, currPeriodoId: string): number | null => {
      if (!data || data.length === 0) return null;
      const find = (id: string) => {
        const ym = periodoIdToYM(id);
        return data.find((e) => e.fecha === ym)
          ?? [...data].reverse().find((e) => e.fecha <= ym)
          ?? null;
      };
      const a = find(prevPeriodoId), b = find(currPeriodoId);
      if (!a || !b || a.valor <= 0) return null;
      return (b.valor / a.valor - 1) * 100;
    },
    [data]
  );

  // Última variación mensual conocida del IPC (para proyectar al próximo período).
  const ipcMensualUltimo = data && data.length >= 2
    ? (data[data.length - 1]!.valor / data[data.length - 2]!.valor - 1) * 100
    : null;

  return { deflatar, ipcVar, ipcMensualUltimo, ipcDisponible: !!data };
}
