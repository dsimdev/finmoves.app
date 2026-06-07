"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppPrefs } from "@/hooks/useAppPrefs";

const TABS = [
  {
    href: "/",
    key: "inicio",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M3 12L12 3L21 12V21H15V15H9V21H3V12Z"
          stroke={active ? "var(--accent)" : "var(--muted)"} strokeWidth="1.8" strokeLinejoin="round"
          fill={active ? "var(--accent-dim)" : "none"} />
      </svg>
    ),
  },
  {
    href: "/movimientos",
    key: "movimientos",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="6" width="18" height="2.5" rx="1.25" fill={active ? "var(--accent)" : "var(--muted)"} />
        <rect x="3" y="11" width="13" height="2.5" rx="1.25" fill={active ? "var(--accent)" : "var(--muted)"} />
        <rect x="3" y="16" width="9" height="2.5" rx="1.25" fill={active ? "var(--accent)" : "var(--muted)"} />
        <circle cx="19.5" cy="18.5" r="3.5" fill={active ? "var(--accent)" : "var(--muted)"} />
        <path d="M19.5 17V20M18 18.5H21" stroke={active ? "#000" : "var(--bg)"} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/dolares",
    key: "ahorros",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9" stroke={active ? "var(--yellow)" : "var(--muted)"} strokeWidth="1.8" fill={active ? "var(--yellow-dim)" : "none"} />
        <path d="M12 7V17" stroke={active ? "var(--yellow)" : "var(--muted)"} strokeWidth="1.8" strokeLinecap="round" />
        <path d="M14.5 9.5C14.5 8.4 13.4 8 12 8C10.3 8 9 8.8 9 10C9 11.2 10.2 11.7 12 12C13.8 12.3 15 12.8 15 14C15 15.2 13.7 16 12 16C10.5 16 9.5 15.6 9.5 14.5"
          stroke={active ? "var(--yellow)" : "var(--muted)"} strokeWidth="1.8" strokeLinecap="round" fill="none" />
      </svg>
    ),
  },
  {
    href: "/resumen",
    key: "reportes",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="3" width="18" height="18" rx="3" stroke={active ? "var(--accent)" : "var(--muted)"} strokeWidth="1.8" fill={active ? "var(--accent-dim)" : "none"} />
        <path d="M7 17L10 13L13 15L17 10" stroke={active ? "var(--accent)" : "var(--muted)"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: "/config",
    key: "config",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" stroke={active ? "var(--accent)" : "var(--muted)"} strokeWidth="1.8" fill={active ? "var(--accent-dim)" : "none"} />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"
          stroke={active ? "var(--accent)" : "var(--muted)"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
    ),
  },
];

export function BottomNav() {
  const pathname = usePathname();
  const { showReportes, showAhorros } = useAppPrefs();

  const visible = TABS.filter((t) => {
    if (t.key === "reportes" && !showReportes) return false;
    if (t.key === "ahorros" && !showAhorros) return false;
    return true;
  });

  return (
    <nav style={{
      position: "fixed", bottom: 0, left: 0, right: 0,
      height: "var(--nav-h)",
      background: "rgba(7,9,15,0.92)",
      backdropFilter: "blur(16px)",
      WebkitBackdropFilter: "blur(16px)",
      borderTop: "1px solid var(--border)",
      display: "flex", alignItems: "stretch",
      zIndex: 100,
      paddingBottom: "env(safe-area-inset-bottom, 0px)",
    }}>
      {visible.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link key={tab.href} href={tab.href} style={{
            flex: 1, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            gap: 0, textDecoration: "none", paddingTop: 0,
          }}>
            {tab.icon(active)}
          </Link>
        );
      })}
    </nav>
  );
}
