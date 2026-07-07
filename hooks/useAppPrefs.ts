"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AppPrefs {
  showReportes: boolean;
  showAhorros: boolean;
  dashboardClasico: boolean;
  saveFeedback: boolean;
  monedaInversiones: "USD" | "EUR";
  monedaPrincipal: "ARS" | "USD" | "EUR";
  lang: "es" | "en";
  set: (key: "showReportes" | "showAhorros" | "dashboardClasico" | "saveFeedback", value: boolean) => void;
  setMoneda: (m: "USD" | "EUR") => void;
  setMonedaPrincipal: (m: "ARS" | "USD" | "EUR") => void;
  setLang: (l: "es" | "en") => void;
  /** Hidrata desde la config del usuario (Firestore = fuente de verdad). Solo pisa lo definido. */
  hydrate: (p: Partial<Pick<AppPrefs, "showReportes" | "showAhorros" | "monedaInversiones" | "monedaPrincipal">>) => void;
  /** Resetea a defaults (al cerrar sesión, para no filtrar prefs entre usuarios del dispositivo). */
  reset: () => void;
}

const DEFAULTS = {
  showReportes: false,
  showAhorros: false,
  dashboardClasico: false,
  saveFeedback: true,
  monedaInversiones: "USD" as const,
  monedaPrincipal: "ARS" as const,
};

export const useAppPrefs = create<AppPrefs>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      lang: "es",
      set: (key, value) => set({ [key]: value }),
      setMoneda: (m) => set({ monedaInversiones: m }),
      setMonedaPrincipal: (m) => set({ monedaPrincipal: m }),
      setLang: (l) => set({ lang: l }),
      hydrate: (p) => set((s) => ({
        showReportes: p.showReportes ?? s.showReportes,
        showAhorros: p.showAhorros ?? s.showAhorros,
        monedaInversiones: p.monedaInversiones ?? s.monedaInversiones,
        monedaPrincipal: p.monedaPrincipal ?? s.monedaPrincipal,
      })),
      reset: () => set({ ...DEFAULTS }),
    }),
    { name: "finmoves_app_prefs" }
  )
);
