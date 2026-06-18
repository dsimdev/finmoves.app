"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { doc, setDoc } from "firebase/firestore";
import { db } from "@/services/firebase/firebase";
import { useAuth } from "@/hooks/useAuth";
import { useConfig } from "@/hooks/useConfig";
import { useAppPrefs } from "@/hooks/useAppPrefs";
import { useT } from "@/hooks/useTranslation";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { platformAuthenticatorAvailable, isBiometricEnabledFor, registerBiometric, clearBiometric } from "@/lib/biometric";
import { pushSupported, isPushEnabled, enablePush, disablePush } from "@/lib/push-client";

type Moneda = "ARS" | "USD" | "EUR";

const INVEST_STEP = 8; // índice del paso de inversión (requiere elegir sí/no)

export default function OnboardingPage() {
  const t = useT();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { config, loading: cfgLoading } = useConfig(user?.uid);
  const { setMonedaPrincipal, set: setPref, setLang, lang } = useAppPrefs();

  const [step, setStep] = useState(0);
  const [moneda, setMoneda] = useState<Moneda>("ARS");
  const [invierte, setInvierte] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  // Seguridad y avisos (se activan en el momento, no en finish).
  const [bioAvail, setBioAvail] = useState(false);
  const [pushAvail, setPushAvail] = useState(false);
  const [bioOn, setBioOn] = useState(false);
  const [pushOn, setPushOn] = useState(false);
  const [bioBusy, setBioBusy] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);

  // Modo "ver de nuevo": no redirige aunque el onboarding ya esté completo.
  const replay = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("replay");

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [authLoading, user, router]);

  useEffect(() => {
    platformAuthenticatorAvailable().then(setBioAvail);
    setPushAvail(pushSupported());
    setBioOn(isBiometricEnabledFor(user?.uid));
    isPushEnabled().then(setPushOn);
  }, [user?.uid]);

  // Si ya completó el onboarding (y no es replay), fuera.
  useEffect(() => {
    if (!replay && config && config.meta.onboardingCompleto !== false) router.replace("/");
  }, [config, router, replay]);

  if (authLoading || cfgLoading || !user || !config) {
    return <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center" }}><LoadingSpinner /></div>;
  }

  const finish = async () => {
    if (saving) return;
    // En modo "ver de nuevo" no toca la config; solo vuelve.
    if (replay) { router.replace("/"); return; }
    setSaving(true);
    setMonedaPrincipal(moneda);
    setPref("showAhorros", !!invierte);
    try {
      await setDoc(doc(db, `users/${user.uid}/config/meta`), {
        ...config,
        meta: { ...config.meta, monedaPrincipal: moneda, showAhorros: !!invierte, onboardingCompleto: true },
      });
      router.replace("/");
    } catch {
      setSaving(false);
    }
  };

  const toggleBio = async () => {
    if (!user || bioBusy) return;
    setBioBusy(true);
    try {
      if (bioOn) { clearBiometric(); setBioOn(false); }
      else { await registerBiometric(user.uid, user.email ?? ""); setBioOn(true); }
    } catch { /* cancelado o no disponible */ }
    finally { setBioBusy(false); }
  };

  const togglePush = async () => {
    if (!user || pushBusy) return;
    setPushBusy(true);
    try {
      if (pushOn) { await disablePush(user.uid); setPushOn(false); }
      else { setPushOn(await enablePush(user.uid)); }
    } catch { /* permiso denegado */ }
    finally { setPushBusy(false); }
  };

  const steps = [
    // 0 — Bienvenida
    <Screen key="w" icon={<Image src="/favicon.png" alt="" width={84} height={84} style={{ opacity: 0.95 }} priority />}
      title={t.obWelcomeTitle} body={t.obWelcomeBody} />,
    // 1 — Cómo funciona
    <Screen key="h" emoji="📅" title={t.obHowTitle} body={t.obHowBody} />,
    // 2 — Tipos de movimiento
    <Screen key="t" emoji="🔀" title={t.obTypesTitle} body={t.obTypesBody}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8, width: "100%", maxWidth: 340, textAlign: "left" }}>
        {([
          ["var(--red)", t.obTypeGasto],
          ["var(--green)", t.obTypeIngreso],
          ["var(--orange)", t.obTypeMove],
          ["var(--blue)", t.obTypeFx],
        ] as const).map(([c, txt]) => (
          <div key={txt} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13, color: "var(--text)" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: c, flexShrink: 0, marginTop: 6 }} />
            <span>{txt}</span>
          </div>
        ))}
      </div>
    </Screen>,
    // 3 — Moneda principal
    <Screen key="c" emoji="💱" title={t.obCurrencyTitle} body={t.obCurrencyBody}>
      <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 8 }}>
        {(["ARS", "USD", "EUR"] as Moneda[]).map((m) => (
          <button key={m} onClick={() => setMoneda(m)} style={{
            padding: "12px 22px", borderRadius: 14, fontSize: 15, fontWeight: 700, cursor: "pointer",
            border: `1px solid ${moneda === m ? "var(--accent)" : "var(--border)"}`,
            background: moneda === m ? "var(--accent-dim)" : "transparent",
            color: moneda === m ? "var(--accent)" : "var(--muted)",
          }}>{m}</button>
        ))}
      </div>
      <div style={{ marginTop: 16, padding: "12px 14px", borderRadius: 10, background: "var(--surface-alt)", border: "1px solid var(--border)", maxWidth: 340, width: "100%" }}>
        <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>{t.obCurrencyWarning}</div>
      </div>
    </Screen>,
    // 4 — Período
    <Screen key="p" emoji="📆" title={t.obPeriodTitle} body={t.obPeriodBody} />,
    // 5 — Ahorros vs Inversión
    <Screen key="sv" emoji="💰" title={t.obSavingsVsInvestTitle} body={t.obSavingsVsInvestBody} />,
    // 6 — Cálculo de ganancia
    <Screen key="g" emoji="📊" title={t.obGainCalculationTitle} body={t.obGainCalculationBody} />,
    // 7 — Reportes
    <Screen key="r" emoji="📈" title={t.obReportsTitle} body={t.obReportsBody} />,
    // 8 — Inversión / ahorros
    <Screen key="i" emoji="💎" title={t.obInvestTitle} body={t.obInvestBody}>
      <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 8 }}>
        <button onClick={() => setInvierte(true)} style={chipStyle(invierte === true, "var(--green)", "var(--green-dim)")}>{t.obInvestYes}</button>
        <button onClick={() => setInvierte(false)} style={chipStyle(invierte === false, "var(--muted)", "var(--surface-alt)")}>{t.obInvestNo}</button>
      </div>
    </Screen>,
    // 9 — Seguridad y avisos
    <Screen key="s" emoji="🔔" title={t.obSecurityTitle} body={t.obSecurityBody}>
      {(bioAvail || pushAvail) ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8, width: "100%", maxWidth: 340 }}>
          {bioAvail && <OnbRow label={t.obEnableBiometric} on={bioOn} busy={bioBusy} onClick={toggleBio} />}
          {pushAvail && <OnbRow label={t.obEnableNotifications} on={pushOn} busy={pushBusy} onClick={togglePush} />}
        </div>
      ) : (
        <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 8 }}>{t.obSecurityUnavailable}</div>
      )}
    </Screen>,
    // 10 — Listo
    <Screen key="d" emoji="🎉" title={t.obDoneTitle} body={t.obDoneBody} />,
  ];

  const isLast = step === steps.length - 1;
  const canNext = step !== INVEST_STEP || invierte !== null; // en inversión hay que elegir

  return (
    <div style={{ position: "relative", minHeight: "100dvh", display: "flex", flexDirection: "column", padding: "32px 24px", overflow: "hidden" }}>
      <div aria-hidden style={{ position: "absolute", top: "-15%", left: "-10%", width: 420, height: 420, background: "radial-gradient(circle, var(--blue) 0%, transparent 70%)", opacity: 0.18, filter: "blur(40px)", pointerEvents: "none" }} />
      <div aria-hidden style={{ position: "absolute", bottom: "-15%", right: "-10%", width: 420, height: 420, background: "radial-gradient(circle, var(--green) 0%, transparent 70%)", opacity: 0.14, filter: "blur(40px)", pointerEvents: "none" }} />

      {/* Idioma arriba a la derecha */}
      <div style={{ position: "relative", display: "flex", justifyContent: "flex-end", gap: 10, marginBottom: 8 }}>
        {(["es", "en"] as const).map((l) => (
          <button key={l} onClick={() => setLang(l)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, padding: "4px 8px", borderRadius: 8, color: lang === l ? "var(--accent)" : "var(--muted)", opacity: lang === l ? 1 : 0.5 }}>{l.toUpperCase()}</button>
        ))}
      </div>

      {/* Progreso */}
      <div style={{ position: "relative", display: "flex", gap: 6, justifyContent: "center", marginBottom: 12 }}>
        {steps.map((_, i) => (
          <div key={i} style={{ width: i === step ? 22 : 7, height: 7, borderRadius: 999, background: i <= step ? "var(--accent)" : "var(--border)", transition: "all 0.2s" }} />
        ))}
      </div>

      {/* Contenido */}
      <div key={step} className="fade-up" style={{ position: "relative", flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: "min(420px, 100%)" }}>{steps[step]}</div>
      </div>

      {/* Navegación */}
      <div style={{ position: "relative", display: "flex", gap: 12, alignItems: "center", maxWidth: 420, width: "100%", margin: "0 auto" }}>
        {step > 0 && (
          <button onClick={() => setStep((s) => s - 1)} style={{ background: "none", border: "1px solid var(--border)", borderRadius: 14, color: "var(--muted)", fontSize: 14, fontWeight: 600, padding: "13px 20px", cursor: "pointer" }}>{t.obBack}</button>
        )}
        <button onClick={isLast ? finish : () => setStep((s) => s + 1)} disabled={!canNext || saving}
          className="btn" style={{ flex: 1, height: 50, fontSize: 15, fontWeight: 700, color: "#fff", border: "none", borderRadius: 14, background: "linear-gradient(110deg, var(--blue) 10%, var(--green) 130%)", opacity: (!canNext || saving) ? 0.5 : 1 }}>
          {step === 0 ? t.obStart : isLast ? t.obFinish : t.obNext}
        </button>
      </div>
    </div>
  );
}

function chipStyle(active: boolean, color: string, dim: string): React.CSSProperties {
  return {
    padding: "12px 22px", borderRadius: 14, fontSize: 15, fontWeight: 700, cursor: "pointer",
    border: `1px solid ${active ? color : "var(--border)"}`,
    background: active ? dim : "transparent",
    color: active ? color : "var(--muted)",
  };
}

function OnbRow({ label, on, busy, onClick }: { label: string; on: boolean; busy: boolean; onClick: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", border: "1px solid var(--border)", borderRadius: 14, background: "var(--surface-alt)" }}>
      <span style={{ fontSize: 14, fontWeight: 600 }}>{label}</span>
      <button onClick={onClick} disabled={busy} aria-pressed={on} style={{
        width: 46, height: 28, borderRadius: 999, border: "none", flexShrink: 0,
        cursor: busy ? "default" : "pointer", opacity: busy ? 0.5 : 1,
        background: on ? "var(--green)" : "var(--border)", position: "relative", transition: "background 0.15s",
      }}>
        <span style={{ position: "absolute", top: 3, left: on ? 21 : 3, width: 22, height: 22, borderRadius: "50%", background: "#fff", transition: "left 0.15s" }} />
      </button>
    </div>
  );
}

function Screen({ icon, emoji, title, body, children }: { icon?: React.ReactNode; emoji?: string; title: string; body: string; children?: React.ReactNode }) {
  return (
    <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
      <div style={{ height: 90, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {icon ?? <span style={{ fontSize: 56 }}>{emoji}</span>}
      </div>
      <div>
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.5, marginBottom: 10 }}>{title}</div>
        <div style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.6, maxWidth: 360, margin: "0 auto" }}>{body}</div>
      </div>
      {children}
    </div>
  );
}
