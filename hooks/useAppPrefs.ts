"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AppPrefs {
  showReportes: boolean;
  showAhorros: boolean;
  monedaInversiones: "USD" | "EUR";
  set: (key: "showReportes" | "showAhorros", value: boolean) => void;
  setMoneda: (m: "USD" | "EUR") => void;
}

export const useAppPrefs = create<AppPrefs>()(
  persist(
    (set) => ({
      showReportes: false,
      showAhorros: false,
      monedaInversiones: "USD",
      set: (key, value) => set({ [key]: value }),
      setMoneda: (m) => set({ monedaInversiones: m }),
    }),
    { name: "finmoves_app_prefs" }
  )
);
