"use client";

import { useState, useEffect, useCallback } from "react";

export interface ReporteToggle {
  id: string;
  label: string;
  seccion: "gastos" | "periodos" | "tendencias";
}

export const REPORTES_TOGGLES: ReporteToggle[] = [
  { id: "ritmo",       label: "Ritmo de gasto",         seccion: "gastos" },
  { id: "diasLibres",  label: "Días sin gastos",         seccion: "gastos" },
  { id: "promPorMov",  label: "Prom. por movimiento",    seccion: "gastos" },
  { id: "comparativa", label: "Comparativa vs anterior", seccion: "gastos" },
  { id: "catCrecio",   label: "Cat. que más creció",     seccion: "gastos" },
  { id: "mejorPeor",   label: "Mejor / Peor período",    seccion: "periodos" },
  { id: "evolSueldo",  label: "Evolución sueldo",        seccion: "periodos" },
  { id: "disponible",  label: "Disponible por período",  seccion: "tendencias" },
  { id: "proyeccion",  label: "Proyección ahorros",      seccion: "tendencias" },
  { id: "paraMeta",    label: "Períodos para meta",      seccion: "tendencias" },
  { id: "ritmoAhorro", label: "Ritmo de ahorro actual",  seccion: "tendencias" },
  { id: "progreso",    label: "Progreso meta USD",       seccion: "tendencias" },
  { id: "periodosParaMeta", label: "Períodos para meta USD", seccion: "tendencias" },
  { id: "ahorrosVsProyectados", label: "Ahorros vs proyectados", seccion: "tendencias" },
  { id: "consistencia", label: "Consistencia ahorro",    seccion: "tendencias" },
  { id: "insights",    label: "Insights",                seccion: "tendencias" },
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
    (id: string) => overrides[id] !== false, // default ON
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
