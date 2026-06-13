"use client";
import { useEffect, useState } from "react";
import { LIGHT_VARS, THEME_COLOR } from "@/lib/theme-init";

const LS_KEY = "finmoves-theme";

export function applyTheme(isLight: boolean) {
  const root = document.documentElement;
  if (isLight) {
    Object.entries(LIGHT_VARS).forEach(([k, v]) => root.style.setProperty(k, v));
    root.setAttribute("data-theme", "light");
  } else {
    Object.keys(LIGHT_VARS).forEach(k => root.style.removeProperty(k));
    root.removeAttribute("data-theme");
  }
  // Mantener la barra del navegador (theme-color) en sintonía con el tema actual.
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", isLight ? THEME_COLOR.light : THEME_COLOR.dark);
}

export function useTheme() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(LS_KEY);
    const isDark = saved === "dark";
    setDark(isDark);
    applyTheme(!isDark);
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    applyTheme(!next);
    localStorage.setItem(LS_KEY, next ? "dark" : "light");
  };

  return { dark, toggle };
}
