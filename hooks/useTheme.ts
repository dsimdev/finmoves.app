"use client";
import { useEffect, useState } from "react";

const LS_KEY = "finmoves-theme";

const LIGHT: Record<string, string> = {
  "--bg":          "#c8c8c8",
  "--surface":     "#f4f4f4",
  "--surface-alt": "#e4e4e4",
  "--border":      "#b8b8b8",
  "--border-hi":   "#909090",
  "--accent-dim":  "#3f52e828",
  "--green":       "#007a38",
  "--green-dim":   "#007a3822",
  "--red-dim":     "#ff525222",
  "--yellow":      "#a06200",
  "--yellow-dim":  "#a0620022",
  "--blue-dim":    "#536dfe22",
  "--text":        "#0d1524",
  "--muted":       "#4a5060",
  "--faint":       "#d0d0d0",
  "--nav-bg":      "rgba(244,244,244,0.92)",
};

export function applyTheme(isLight: boolean) {
  const root = document.documentElement;
  if (isLight) {
    Object.entries(LIGHT).forEach(([k, v]) => root.style.setProperty(k, v));
    root.setAttribute("data-theme", "light");
  } else {
    Object.keys(LIGHT).forEach(k => root.style.removeProperty(k));
    root.removeAttribute("data-theme");
  }
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
