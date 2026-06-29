"use client";

import { useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// Chip activable/borrable (long-press) para categorías / medios / orígenes.
export function Chip({ label, colorVar, dimVar, activo, confirming, onToggle, onLongPress, onConfirmDelete }: {
  label: string; colorVar: string; dimVar: string; activo: boolean; confirming: boolean;
  onToggle: () => void; onLongPress: () => void; onConfirmDelete: () => void;
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);
  const start = () => { longPressed.current = false; timer.current = setTimeout(() => { longPressed.current = true; onLongPress(); }, 450); };
  const end = () => { if (timer.current) clearTimeout(timer.current); };
  const handleClick = () => { if (longPressed.current) { longPressed.current = false; return; } if (confirming) onConfirmDelete(); else onToggle(); };
  if (confirming) {
    return (
      <button onClick={onConfirmDelete} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 999, background: "var(--red-dim)", border: "1px solid var(--red)", color: "var(--red)", fontSize: 12.5, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
        {label}
      </button>
    );
  }
  return (
    <button onClick={handleClick} onPointerDown={start} onPointerUp={end} onPointerLeave={end} onPointerCancel={end}
      style={{ padding: "7px 14px", borderRadius: 999, fontSize: 12.5, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.15s", touchAction: "manipulation", border: `1px solid ${activo ? colorVar : "var(--border)"}`, background: activo ? dimVar : "transparent", color: activo ? colorVar : "var(--muted)", opacity: activo ? 1 : 0.55 }}>
      {label}
    </button>
  );
}

// Componentes compartidos del nuevo Settings drill-in (perfil + sub-pantallas).

export function Toggle({ activo, onClick, label }: { activo: boolean; onClick: () => void; label?: string }) {
  return (
    <button type="button" role="switch" aria-checked={activo} aria-label={label} onClick={onClick} style={{
      width: 44, height: 26, borderRadius: 13, border: "none", padding: 0,
      background: activo ? "var(--accent)" : "var(--border)",
      boxShadow: activo ? "0 0 0 3px var(--accent)30" : "inset 0 1px 3px rgba(0,0,0,0.15)",
      position: "relative", cursor: "pointer", transition: "background .25s, box-shadow .25s", flexShrink: 0,
    }}>
      <div style={{
        position: "absolute", top: 3, left: activo ? 21 : 3, width: 20, height: 20, borderRadius: "50%",
        background: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,0.25), 0 0 0 0.5px rgba(0,0,0,0.06)",
        transition: "left .22s cubic-bezier(0.34,1.56,0.64,1)",
      }} />
    </button>
  );
}

export function FlagAR({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ borderRadius: "50%", display: "block" }}>
      <clipPath id="flagAR"><circle cx="12" cy="12" r="12" /></clipPath>
      <g clipPath="url(#flagAR)">
        <rect width="24" height="8" fill="#74acdf" /><rect y="8" width="24" height="8" fill="#fff" /><rect y="16" width="24" height="8" fill="#74acdf" />
        <circle cx="12" cy="12" r="2.2" fill="#f6b40e" stroke="#85340a" strokeWidth="0.3" />
      </g>
    </svg>
  );
}

export function FlagGB({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ borderRadius: "50%", display: "block" }}>
      <clipPath id="flagGB"><circle cx="12" cy="12" r="12" /></clipPath>
      <g clipPath="url(#flagGB)">
        <rect width="24" height="24" fill="#012169" />
        <path d="M0 0 L24 24 M24 0 L0 24" stroke="#fff" strokeWidth="3.5" /><path d="M0 0 L24 24 M24 0 L0 24" stroke="#c8102e" strokeWidth="2" />
        <path d="M12 0 V24 M0 12 H24" stroke="#fff" strokeWidth="5.5" /><path d="M12 0 V24 M0 12 H24" stroke="#c8102e" strokeWidth="3" />
      </g>
    </svg>
  );
}

// Cabecera de una sub-pantalla de Settings: flecha atrás (vuelve a /settings) + título.
export function SubHeader({ title }: { title: string }) {
  const router = useRouter();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
      <button onClick={() => router.push("/settings")} aria-label="Atrás" style={{
        background: "none", border: "none", color: "var(--text)", cursor: "pointer", padding: 4, display: "flex", marginLeft: -4,
      }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
      </button>
      <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.4 }}>{title}</h1>
    </div>
  );
}

// Fila del landing que entra a un grupo (icono + título + subtítulo + chevron).
export function NavRow({ href, icon, title, sub, color = "var(--accent)" }: {
  href: string; icon: React.ReactNode; title: string; sub?: string; color?: string;
}) {
  return (
    <Link href={href} className="row" style={{
      display: "flex", alignItems: "center", gap: 13, padding: "13px 14px", textDecoration: "none",
      color: "inherit", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, marginBottom: 8,
    }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: `color-mix(in srgb, ${color} 14%, transparent)`, color }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{title}</div>
        {sub && <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sub}</div>}
      </div>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><polyline points="9 18 15 12 9 6" /></svg>
    </Link>
  );
}
