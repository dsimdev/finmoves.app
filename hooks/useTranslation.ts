"use client";

import { useAppPrefs } from "./useAppPrefs";
import { es } from "@/locales/es";
import { en } from "@/locales/en";

export function useT() {
  const { lang } = useAppPrefs();
  return lang === "en" ? en : es;
}
