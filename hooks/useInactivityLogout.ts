"use client";

import { useEffect, useRef } from "react";
import { signOut } from "firebase/auth";
import { auth } from "@/services/firebase/firebase";
import { useAppPrefs } from "@/hooks/useAppPrefs";

const TIMEOUT_MS = 8 * 60 * 60 * 1000; // 8 horas
const STORAGE_KEY = "finmoves_last_activity";
const ACTIVITY_EVENTS = ["mousedown", "keydown", "touchstart", "scroll"] as const;

// Cierra la sesión tras 8h sin actividad. Persiste el último timestamp en
// localStorage para que el conteo sobreviva a recargas y cierres de la PWA:
// al volver, si pasaron >8h desde la última actividad, desloguea de inmediato.
export function useInactivityLogout(enabled: boolean) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const logout = () => {
      localStorage.removeItem(STORAGE_KEY);
      useAppPrefs.getState().reset();
      signOut(auth);
    };

    const arm = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(logout, TIMEOUT_MS);
    };

    const markActivity = () => {
      localStorage.setItem(STORAGE_KEY, String(Date.now()));
      arm();
    };

    // Al montar / volver a foco: si ya se venció la ventana, cerrar ya.
    const checkExpiry = () => {
      const last = Number(localStorage.getItem(STORAGE_KEY) ?? 0);
      if (last && Date.now() - last >= TIMEOUT_MS) {
        logout();
        return;
      }
      markActivity();
    };

    checkExpiry();

    const onVisible = () => {
      if (document.visibilityState === "visible") checkExpiry();
    };

    for (const ev of ACTIVITY_EVENTS) window.addEventListener(ev, markActivity, { passive: true });
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      if (timer.current) clearTimeout(timer.current);
      for (const ev of ACTIVITY_EVENTS) window.removeEventListener(ev, markActivity);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled]);
}
