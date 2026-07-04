"use client";

import { useBackButton } from "@/hooks/useBackButton";
import { useT } from "@/hooks/useTranslation";

// Aviso flotante del doble-back para salir. Siempre montado (aparece/desaparece con
// opacidad, sin layout shift). El hook maneja toda la lógica del botón "atrás".
export function BackExitToast() {
  const show = useBackButton();
  const t = useT();
  return (
    <div
      aria-live="polite"
      style={{
        position: "fixed",
        left: "50%",
        bottom: "calc(var(--nav-h) + 20px + env(safe-area-inset-bottom, 0px))",
        transform: `translateX(-50%) translateY(${show ? "0" : "16px"})`,
        opacity: show ? 1 : 0,
        pointerEvents: "none",
        transition: "opacity .2s ease, transform .2s ease",
        background: "var(--surface-alt)",
        border: "1px solid var(--border-hi)",
        color: "var(--text)",
        fontSize: 13,
        fontWeight: 600,
        padding: "10px 18px",
        borderRadius: 999,
        boxShadow: "0 6px 24px rgba(0,0,0,0.4)",
        zIndex: 300,
        whiteSpace: "nowrap",
      }}
    >
      {t.pressBackAgainToExit}
    </div>
  );
}
