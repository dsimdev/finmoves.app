"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  {
    href: "/",
    label: "Inicio",
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
    label: "Movimientos",
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
    href: "/resumen",
    label: "Reportes",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="3" width="18" height="18" rx="3" stroke={active ? "var(--accent)" : "var(--muted)"} strokeWidth="1.8" fill={active ? "var(--accent-dim)" : "none"} />
        <path d="M7 17L10 13L13 15L17 10" stroke={active ? "var(--accent)" : "var(--muted)"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: "/dolares",
    label: "USD",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9" stroke={active ? "var(--yellow)" : "var(--muted)"} strokeWidth="1.8" fill={active ? "var(--yellow-dim)" : "none"} />
        <path d="M12 7V17M9.5 9.5H13.5C14.3 9.5 15 10.2 15 11C15 11.8 14.3 12.5 13.5 12.5H10.5C9.7 12.5 9 13.2 9 14C9 14.8 9.7 15.5 10.5 15.5H14.5"
          stroke={active ? "var(--yellow)" : "var(--muted)"} strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/config",
    label: "Config",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="2.5" stroke={active ? "var(--accent)" : "var(--muted)"} strokeWidth="1.8" />
        <path d="M15.5 12C15.5 13.93 13.93 15.5 12 15.5C10.07 15.5 8.5 13.93 8.5 12C8.5 10.07 10.07 8.5 12 8.5C13.93 8.5 15.5 10.07 15.5 12Z" stroke={active ? "var(--accent)" : "var(--muted)"} strokeWidth="1.8" fill="none" />
        <path d="M12 2V4M12 20V22M20 12H22M2 12H4M18.66 5.34L20.08 3.92M3.92 20.08L5.34 18.66M18.66 18.66L20.08 20.08M3.92 3.92L5.34 5.34" stroke={active ? "var(--accent)" : "var(--muted)"} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
];

export function BottomNav() {
  const pathname = usePathname();

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
      {TABS.map((tab) => {
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
