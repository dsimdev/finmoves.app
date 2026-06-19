"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

const DISMISSED_KEY = "ios-install-dismissed";

function isIOSSafariWithoutStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
  const isStandalone = (navigator as { standalone?: boolean }).standalone === true;
  return isIOS && isSafari && !isStandalone;
}

export function IOSInstallBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isIOSSafariWithoutStandalone()) return;
    if (localStorage.getItem(DISMISSED_KEY)) return;
    const t = setTimeout(() => setVisible(true), 1800);
    return () => clearTimeout(t);
  }, []);

  const dismiss = () => {
    setVisible(false);
    localStorage.setItem(DISMISSED_KEY, "1");
  };

  if (!visible) return null;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9100,
      display: "flex", flexDirection: "column", justifyContent: "flex-end",
      background: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)",
    }} onClick={dismiss}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--surface)",
          borderTop: "1px solid var(--border-hi)",
          borderRadius: "24px 24px 0 0",
          padding: "8px 20px 36px",
          animation: "slideUp 0.35s cubic-bezier(0.32,0.72,0,1)",
        }}
      >
        {/* Handle */}
        <div style={{
          width: 36, height: 4, borderRadius: 2,
          background: "var(--border-hi)", margin: "10px auto 20px",
        }} />

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <Image src="/favicon.png" alt="FinMoves" width={40} height={40} style={{ borderRadius: 10 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Instalá FinMoves</div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
              Agregala a tu pantalla de inicio para acceder rápido
            </div>
          </div>
          <button onClick={dismiss} style={{
            background: "var(--surface-2)", border: "none", borderRadius: "50%",
            width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", color: "var(--muted)", flexShrink: 0,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Steps */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 28 }}>
          {/* Step 1 */}
          <div style={{
            display: "flex", alignItems: "center", gap: 14,
            background: "var(--surface-2)", borderRadius: 16, padding: "14px 16px",
            border: "1px solid var(--border)",
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12, flexShrink: 0,
              background: "linear-gradient(135deg, #536dfe 0%, #22c0c0 100%)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {/* iOS Share icon */}
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
                <polyline points="16 6 12 2 8 6"/>
                <line x1="12" y1="2" x2="12" y2="15"/>
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>
                Tocá el botón compartir
              </div>
              <div style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.5 }}>
                Es el ícono con la flecha hacia arriba, en la barra de Safari
              </div>
            </div>
            <div style={{
              width: 24, height: 24, borderRadius: "50%", background: "var(--blue)",
              color: "#fff", fontSize: 12, fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>1</div>
          </div>

          {/* Step 2 */}
          <div style={{
            display: "flex", alignItems: "center", gap: 14,
            background: "var(--surface-2)", borderRadius: 16, padding: "14px 16px",
            border: "1px solid var(--border)",
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12, flexShrink: 0,
              background: "linear-gradient(135deg, #22c0c0 0%, #00e676 100%)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {/* Add to Home Screen icon */}
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="3"/>
                <line x1="12" y1="8" x2="12" y2="16"/>
                <line x1="8" y1="12" x2="16" y2="12"/>
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>
                Elegí &quot;Añadir a pantalla de inicio&quot;
              </div>
              <div style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.5 }}>
                Deslizá la lista de opciones para encontrarlo
              </div>
            </div>
            <div style={{
              width: 24, height: 24, borderRadius: "50%", background: "var(--green)",
              color: "#07090f", fontSize: 12, fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>2</div>
          </div>
        </div>

        {/* Arrow apuntando hacia la barra de Safari */}
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 6 }}>
            el botón compartir está acá abajo
          </div>
          <div style={{ animation: "bouncDown 1.2s ease-in-out infinite", display: "inline-block" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <polyline points="19 12 12 19 5 12"/>
            </svg>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
        @keyframes bouncDown {
          0%, 100% { transform: translateY(0); }
          50%       { transform: translateY(7px); }
        }
      `}</style>
    </div>
  );
}
