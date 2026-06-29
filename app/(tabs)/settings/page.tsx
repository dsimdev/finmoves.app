"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useData } from "../data-context";
import { useT } from "@/hooks/useTranslation";
import { auth } from "@/services/firebase/firebase";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { NavRow } from "./_shared";

export default function SettingsLanding() {
  const { user } = useAuth();
  const { config, configLoading: loading } = useData();
  const t = useT();
  const [fotoError, setFotoError] = useState(false);
  useEffect(() => { setFotoError(false); }, [config?.meta.fotoURL]);

  const isOwner = !!user?.email && user.email === process.env.NEXT_PUBLIC_OWNER_EMAIL;
  const inversionAllowed = isOwner || config?.meta.permisos?.inversion === true;

  if (loading || !config) return <div className="page"><LoadingSpinner /></div>;

  const googlePhoto = auth.currentUser?.providerData.find((p) => p.providerId === "google.com")?.photoURL;
  const fotoSrc = config.meta.fotoURL || googlePhoto || null;
  const tieneNombre = !!config.meta.nombre;

  const i = (children: React.ReactNode) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{children}</svg>;

  return (
    <div className="page fade-up">
      <div style={{ marginBottom: 20 }}>
        <div className="label" style={{ marginBottom: 2 }}>{t.pageTitleSettings}</div>
        <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.5, display: "inline-block", background: "linear-gradient(110deg, var(--blue) 10%, var(--green) 90%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>{t.account}</div>
      </div>

      {/* Header de perfil → edita perfil */}
      <Link href="/settings/profile" style={{ textDecoration: "none", color: "inherit", display: "flex", alignItems: "center", gap: 14, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 16, marginBottom: 16 }}>
        {fotoSrc && !fotoError ? (
          <img src={fotoSrc} alt="" width={52} height={52} referrerPolicy="no-referrer" onError={() => setFotoError(true)} style={{ width: 52, height: 52, borderRadius: 14, objectFit: "cover", flexShrink: 0, border: "1px solid var(--green)44" }} />
        ) : (
          <div style={{ width: 52, height: 52, borderRadius: 14, background: tieneNombre ? "var(--green-dim)" : "var(--surface-alt)", border: `1px solid ${tieneNombre ? "var(--green)44" : "var(--border)"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke={tieneNombre ? "var(--green)" : "var(--muted)"} strokeWidth="1.7" /><path d="M4 20c0-3.87 3.58-7 8-7s8 3.13 8 7" stroke={tieneNombre ? "var(--green)" : "var(--muted)"} strokeWidth="1.7" strokeLinecap="round" /></svg>
          </div>
        )}
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{config.meta.nombre || t.user}</div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user?.email}</div>
        </div>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><polyline points="9 18 15 12 9 6" /></svg>
      </Link>

      <NavRow href="/settings/preferences" color="var(--accent)" title={t.preferences} sub={t.darkMode}
        icon={i(<><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></>)} />

      <NavRow href="/settings/notifications" color="var(--green)" title={t.notifications} sub={t.notificationsSub}
        icon={i(<><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></>)} />

      <NavRow href="/settings/security" color="var(--red)" title={t.security} sub={t.biometricUnlock}
        icon={i(<><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></>)} />

      <NavRow href="/settings/movements" color="var(--blue)" title={t.settingsTabMovements} sub={t.categories}
        icon={i(<><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></>)} />

      <NavRow href="/settings/budgets" color="var(--yellow)" title={t.settingsTabBudgets} sub={t.budgetTemplate}
        icon={i(<><path d="M3 3v18h18"/><rect x="7" y="12" width="3" height="6"/><rect x="12" y="8" width="3" height="10"/><rect x="17" y="5" width="3" height="13"/></>)} />

      {inversionAllowed && (
        <NavRow href="/settings/investment" color="var(--green)" title={t.settingsTabInvestments} sub={t.investmentCurrency}
          icon={i(<><polyline points="22 7 13.5 15.5 8.5 10.5 1 18"/><polyline points="16 7 22 7 22 13"/></>)} />
      )}

      <NavRow href="/settings/data" color="var(--accent)" title={t.dataSection} sub={isOwner ? "Google Sheets · Backup" : "Backup"}
        icon={i(<><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></>)} />

      {isOwner && (
        <NavRow href="/settings/admin" color="var(--accent)" title="Admin" sub={t.generateInvite}
          icon={i(<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></>)} />
      )}

      <NavRow href="/settings/help" color="var(--muted)" title={t.guideSection} sub={`v${process.env.NEXT_PUBLIC_APP_VERSION}`}
        icon={i(<><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></>)} />
    </div>
  );
}
