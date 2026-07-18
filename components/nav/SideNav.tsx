"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppPrefs } from "@/hooks/useAppPrefs";
import { useAuth } from "@/hooks/useAuth";
import { useSyncError } from "@/hooks/useSyncError";

function gradColor(index: number, total: number) {
  const t = total <= 1 ? 0 : index / (total - 1);
  const r = Math.round(83  - 83  * t);
  const g = Math.round(109 + 121 * t);
  const b = Math.round(254 - 136 * t);
  const hex = (n: number) => n.toString(16).padStart(2, "0");
  const color = `#${hex(r)}${hex(g)}${hex(b)}`;
  return { color, dim: `${color}28` };
}

type IP = { active: boolean; color: string; dim: string };

const TABS = [
  {
    href: "/", key: "inicio",
    label: "inicio",
    icon: ({ active, color, dim }: IP) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M3 12L12 3L21 12V21H15V15H9V21H3V12Z"
          stroke={active ? color : "var(--muted)"} strokeWidth="1.8" strokeLinejoin="round"
          fill={active ? dim : "none"} />
      </svg>
    ),
  },
  {
    href: "/movements", key: "movements",
    label: "movimientos",
    icon: ({ active, color }: IP) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="6" width="18" height="2.5" rx="1.25" fill={active ? color : "var(--muted)"} />
        <rect x="3" y="11" width="13" height="2.5" rx="1.25" fill={active ? color : "var(--muted)"} />
        <rect x="3" y="16" width="9" height="2.5" rx="1.25" fill={active ? color : "var(--muted)"} />
        <circle cx="19.5" cy="18.5" r="3.5" fill={active ? color : "var(--muted)"} />
        <path d="M19.5 17V20M18 18.5H21" stroke={active ? "#000" : "var(--bg)"} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/reports", key: "reports",
    label: "reportes",
    icon: ({ active, color, dim }: IP) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="3" width="18" height="18" rx="3" stroke={active ? color : "var(--muted)"} strokeWidth="1.8" fill={active ? dim : "none"} />
        <path d="M7 17L10 13L13 15L17 10" stroke={active ? color : "var(--muted)"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: "/investments", key: "investments",
    label: "inversión",
    icon: ({ active, color, dim }: IP) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9" stroke={active ? color : "var(--muted)"} strokeWidth="1.8" fill={active ? dim : "none"} />
        <path d="M12 7V17" stroke={active ? color : "var(--muted)"} strokeWidth="1.8" strokeLinecap="round" />
        <path d="M14.5 9.5C14.5 8.4 13.4 8 12 8C10.3 8 9 8.8 9 10C9 11.2 10.2 11.7 12 12C13.8 12.3 15 12.8 15 14C15 15.2 13.7 16 12 16C10.5 16 9.5 15.6 9.5 14.5"
          stroke={active ? color : "var(--muted)"} strokeWidth="1.8" strokeLinecap="round" fill="none" />
      </svg>
    ),
  },
  {
    href: "/settings", key: "settings",
    label: "configuración",
    icon: ({ active, color, dim }: IP) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" stroke={active ? color : "var(--muted)"} strokeWidth="1.8" fill={active ? dim : "none"} />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"
          stroke={active ? color : "var(--muted)"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
    ),
  },
];

const ADMIN_TAB = {
  href: "/admin", key: "admin",
  label: "admin",
  icon: ({ active, color, dim }: IP) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M12 2 4 5v6c0 5 3.5 8 8 11 4.5-3 8-6 8-11V5l-8-3Z"
        stroke={active ? color : "var(--muted)"} strokeWidth="1.8" strokeLinejoin="round"
        fill={active ? dim : "none"} />
      <path d="m9 12 2 2 4-4" stroke={active ? color : "var(--muted)"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

export function SideNav() {
  const pathname = usePathname();
  const { showAhorros, showReportes } = useAppPrefs();
  const { user } = useAuth();
  const syncError = useSyncError();
  const isOwner = !!user?.email && user.email === process.env.NEXT_PUBLIC_OWNER_EMAIL;

  // showAhorros = toggle del usuario para la tab Inversión (meta + reserva FX viven dentro).
  const visible = TABS.filter((t) => {
    if (t.key === "investments" && !showAhorros) return false;
    if (t.key === "reports" && !showReportes) return false;
    return true;
  });

  const allTabs = isOwner ? [...visible, ADMIN_TAB] : visible;

  return (
    <nav className="sidenav">
      <div style={{ paddingLeft: 8, paddingBottom: 24, paddingTop: 4 }}>
        <span style={{
          fontSize: 18, fontWeight: 800, letterSpacing: -0.5,
          background: "linear-gradient(110deg, var(--blue) 10%, var(--green) 90%)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
        }}>FinMoves</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1 }}>
        {allTabs.map((tab, i) => {
          const active = pathname === tab.href;
          const { color, dim } = gradColor(i, allTabs.length);
          return (
            <Link key={tab.href} href={tab.href} replace style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 10px",
              borderRadius: 12,
              textDecoration: "none",
              background: active ? `${color}14` : "transparent",
              transition: "background 0.15s",
            }}>
              <span style={{ position: "relative", display: "flex", flexShrink: 0 }}>
                {tab.icon({ active, color, dim })}
                {tab.key === "settings" && syncError && (
                  <span style={{
                    position: "absolute", top: -2, right: -3,
                    width: 8, height: 8, borderRadius: "50%",
                    background: "var(--red)", border: "1.5px solid var(--nav-bg)",
                  }} />
                )}
              </span>
              <span style={{
                fontSize: 12, fontWeight: active ? 700 : 500,
                color: active ? color : "var(--muted)",
                letterSpacing: 0.2,
              }}>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
