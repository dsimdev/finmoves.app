"use client";
import { useState, useCallback } from "react";

export function useFirstVisit(key: string): [boolean, () => void] {
  const storageKey = `finmoves_hint_${key}`;
  const [show, setShow] = useState(() => {
    if (typeof window === "undefined") return false;
    return !localStorage.getItem(storageKey);
  });
  const dismiss = useCallback(() => {
    try { localStorage.setItem(storageKey, "1"); } catch {}
    setShow(false);
  }, [storageKey]);
  return [show, dismiss];
}
