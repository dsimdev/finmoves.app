"use client";

import { useCallback, useRef, useState } from "react";
import { useBackDispatcher } from "@/hooks/useBackDispatcher";
import { useT } from "@/hooks/useTranslation";

// Monta el dispatcher del doble-back (inerte sin Navigation API) y muestra el aviso
// "tocá atrás de nuevo para salir" cuando estás en Inicio y el primer back se consumió.
export function BackExitToast() {
  const t = useT();
  const [show, setShow] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hint = useCallback(() => {
    setShow(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setShow(false), 2000);
  }, []);

  useBackDispatcher(hint);

  return (
    <div aria-live="polite" style={{
      position: "fixed", left: "50%",
      bottom: "calc(var(--nav-h) + env(safe-area-inset-bottom, 0px) + 16px)",
      transform: `translateX(-50%) translateY(${show ? "0" : "12px"})`,
      background: "var(--surface)", color: "var(--text)",
      border: "1px solid var(--border)", borderRadius: 999,
      padding: "10px 18px", fontSize: 13, fontWeight: 500,
      boxShadow: "0 6px 24px rgba(0,0,0,0.25)", zIndex: 200,
      opacity: show ? 1 : 0, pointerEvents: "none",
      transition: "opacity .2s ease, transform .2s ease",
    }}>
      {t.pressBackAgainToExit}
    </div>
  );
}
