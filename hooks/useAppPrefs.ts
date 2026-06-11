"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AppPrefs {
  showReportes: boolean;
  showAhorros: boolean;
  monedaInversiones: "USD" | "EUR";
  monedaPrincipal: "ARS" | "USD" | "EUR";
  lang: "es" | "en";
  set: (key: "showReportes" | "showAhorros", value: boolean) => void;
  setMoneda: (m: "USD" | "EUR") => void;
  setMonedaPrincipal: (m: "ARS" | "USD" | "EUR") => void;
  setLang: (l: "es" | "en") => void;
}

export const useAppPrefs = create<AppPrefs>()(
  persist(
    (set) => ({
      showReportes: false,
      showAhorros: false,
      monedaInversiones: "USD",
      monedaPrincipal: "ARS",
      lang: "es",
      set: (key, value) => set({ [key]: value }),
      setMoneda: (m) => set({ monedaInversiones: m }),
      setMonedaPrincipal: (m) => set({ monedaPrincipal: m }),
      setLang: (l) => set({ lang: l }),
    }),
    { name: "finmoves_app_prefs" }
  )
);
