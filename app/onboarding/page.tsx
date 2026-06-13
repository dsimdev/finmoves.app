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

type Moneda = "ARS" | "USD" | "EUR";

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
  // Modo "ver de nuevo": no redirige aunque el onboarding ya esté completo.
  const replay = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("replay");

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [authLoading, user, router]);

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
        meta: { ...config.meta, monedaPrincipal: moneda, onboardingCompleto: true },
      });
      router.replace("/");
    } catch {
      setSaving(false);
    }
  };

  const steps = [
    // 0 — Bienvenida
    <Screen key="w" icon={<Image src="/favicon.png" alt="" width={84} height={84} style={{ opacity: 0.95 }} priority />}
      title={t.obWelcomeTitle} body={t.obWelcomeBody} />,
    // 1 — Cómo funciona
    <Screen key="h" emoji="📅" title={t.obHowTitle} body={t.obHowBody} />,
    // 2 — Moneda principal
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
    </Screen>,
    // 3 — Inversión
    <Screen key="i" emoji="📈" title={t.obInvestTitle} body={t.obInvestBody}>
      <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 8 }}>
        <button onClick={() => setInvierte(true)} style={chipStyle(invierte === true, "var(--green)", "var(--green-dim)")}>{t.obInvestYes}</button>
        <button onClick={() => setInvierte(false)} style={chipStyle(invierte === false, "var(--muted)", "var(--surface-alt)")}>{t.obInvestNo}</button>
      </div>
    </Screen>,
    // 4 — Listo
    <Screen key="d" emoji="🎉" title={t.obDoneTitle} body={t.obDoneBody} />,
  ];

  const isLast = step === steps.length - 1;
  const canNext = step !== 3 || invierte !== null; // en inversión hay que elegir

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
