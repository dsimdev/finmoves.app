"use client";

import { useState, useEffect, useCallback } from "react";

export interface ReporteToggle {
  id: string;
  label: string;
  seccion: "gastos" | "ingresos" | "periodos" | "tendencias";
}

export const REPORTES_TOGGLES: ReporteToggle[] = [
  { id: "gastos_kpis",            label: "KPIs",       seccion: "gastos" },
  { id: "gastos_otros",           label: "Otros datos", seccion: "gastos" },
  { id: "ingresos_kpis",          label: "KPIs",       seccion: "ingresos" },
  { id: "ingresos_otros",         label: "Otros datos", seccion: "ingresos" },
  { id: "periodos_kpis",          label: "KPIs",       seccion: "periodos" },
  { id: "periodos_otros",         label: "Otros datos", seccion: "periodos" },
  { id: "tendencias_gastos",      label: "Gastos",     seccion: "tendencias" },
  { id: "tendencias_ingresos",    label: "Ingresos",   seccion: "tendencias" },
  { id: "tendencias_inversiones", label: "Inversiones", seccion: "tendencias" },
];

const LS_KEY = "finmoves_report_config";

function loadFromStorage(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? "{}");
  } catch {
    return {};
  }
}

export function useReportConfig() {
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setOverrides(loadFromStorage());
  }, []);

  const isEnabled = useCallback(
    (id: string) => overrides[id] !== false,
    [overrides]
  );

  const toggle = useCallback((id: string) => {
    setOverrides((prev) => {
      const next = { ...prev, [id]: prev[id] === false ? true : false };
      localStorage.setItem(LS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const saveAll = useCallback((next: Record<string, boolean>) => {
    localStorage.setItem(LS_KEY, JSON.stringify(next));
    setOverrides(next);
  }, []);

  return { isEnabled, toggle, overrides, saveAll };
}
