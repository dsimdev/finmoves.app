"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useData } from "../data-context";
import { useT } from "@/hooks/useTranslation";
import { useIsDesktop } from "@/hooks/useMediaQuery";

// En escritorio, Configuración deja de ser un menú que navega a otra pantalla: las secciones
// viven en una columna a la izquierda y el contenido de la elegida ocupa el resto (el patrón
// de VS Code, Slack o las Preferencias del sistema). Las sub-páginas no se tocan — Next las
// monta como `children` acá adentro.
// En móvil este layout es transparente: se ve el menú y luego la sub-página, como siempre.

const ICONS: Record<string, React.ReactNode> = {
  account: <><circle cx="12" cy="8" r="4" /><path d="M4 20c0-3.87 3.58-7 8-7s8 3.13 8 7" /></>,
  preferences: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></>,
  notifications: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></>,
  movements: <><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></>,
  investment: <><polyline points="22 7 13.5 15.5 8.5 10.5 1 18" /><polyline points="16 7 22 7 22 13" /></>,
  data: <><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" /><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" /></>,
  help: <><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></>,
};

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const t = useT();
  const pathname = usePathname();
  const isDesktop = useIsDesktop();
  const { user } = useAuth();
  const { config } = useData();

  const isOwner = !!user?.email && user.email === process.env.NEXT_PUBLIC_OWNER_EMAIL;
  const inversionAllowed = isOwner || config?.meta.permisos?.inversion === true;

  // En móvil el layout no aporta nada: el menú (page.tsx) y las sub-páginas se ven solas.
  if (!isDesktop) return <>{children}</>;

  const secciones = [
    { href: "/settings/account", icon: "account", label: t.account },
    { href: "/settings/preferences", icon: "preferences", label: t.preferences },
    { href: "/settings/notifications", icon: "notifications", label: t.notifications },
    { href: "/settings/movements", icon: "movements", label: t.settingsTabMovements },
    ...(inversionAllowed ? [{ href: "/settings/investment", icon: "investment", label: t.settingsTabInvestments }] : []),
    { href: "/settings/data", icon: "data", label: t.dataSection },
    { href: "/settings/help", icon: "help", label: t.guideSection },
  ];

  // El índice (/settings) no tiene contenido propio en escritorio: la primera sección hace de
  // landing, así la columna derecha nunca queda vacía.
  const enIndice = pathname === "/settings";

  return (
    <div className="page page-fluid settings-layout">
      <nav className="settings-nav" aria-label={t.pageTitleSettings}>
        <div className="settings-nav-title">{t.pageTitleSettings}</div>
        {secciones.map((s) => {
          const activa = pathname === s.href || (enIndice && s.href === "/settings/account");
          return (
            <Link key={s.href} href={s.href} className={activa ? "settings-nav-item is-active" : "settings-nav-item"}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                {ICONS[s.icon]}
              </svg>
              {s.label}
            </Link>
          );
        })}
      </nav>
      <div className="settings-content">{children}</div>
    </div>
  );
}
