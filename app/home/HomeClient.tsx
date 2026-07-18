"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { PrivacyContent } from "@/components/legal/PrivacyContent";
import { TermsContent } from "@/components/legal/TermsContent";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";
import { useAppPrefs } from "@/hooks/useAppPrefs";
import { useTheme } from "@/hooks/useTheme";
import { IOSInstallBanner } from "@/components/pwa/IOSInstallBanner";
import { landing, type Slide, type Feature } from "@/locales/landing";

type Modal = "privacy" | "terms" | null;

function FeatureCarousel({ slides }: { slides: Slide[] }) {
  const [i, setI] = useState(0);
  const touchX = useRef<number | null>(null);
  const n = slides.length;
  const go = (d: number) => setI((p) => (p + d + n) % n);

  // Auto-desliza. El timer se reinicia con cada cambio (manual o automático),
  // así un click/swipe no provoca un salto inmediato.
  useEffect(() => {
    const t = setTimeout(() => setI((p) => (p + 1) % n), 4800);
    return () => clearTimeout(t);
  }, [i, n]);

  const onTouchStart = (e: React.TouchEvent) => { touchX.current = e.touches[0].clientX; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
    touchX.current = null;
  };

  const active = slides[i] ?? slides[0];

  return (
    <section className="fade-up-1" style={{ marginBottom: 56 }}>
      {/* Info del slide activo (cambia con la captura) */}
      <div style={{ textAlign: "center", minHeight: 92, marginBottom: 8 }}>
        <h2 key={active.title} className="fade-up" style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>{active.title}</h2>
        <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.6, maxWidth: 420, margin: "0 auto" }}>{active.desc}</p>
      </div>

      {/* Carrusel: una sola captura grande a la vez */}
      <div
        style={{ position: "relative", overflow: "hidden", maxWidth: 280, margin: "0 auto", touchAction: "pan-y" }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div style={{ display: "flex", transition: "transform 0.5s ease", transform: `translateX(-${i * 100}%)` }}>
          {slides.map((s) => (
            <div key={s.img} style={{ minWidth: "100%", display: "flex", justifyContent: "center", padding: "6px 0" }}>
              <div
                style={{
                  position: "relative",
                  width: "clamp(200px, 62vw, 248px)",
                  height: "clamp(380px, 64vh, 470px)",
                  borderRadius: 26,
                  overflow: "hidden",
                  border: "1px solid var(--border-hi)",
                  background: "var(--surface)",
                  boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
                }}
              >
                <Image src={s.img} alt={s.title} fill sizes="250px" style={{ objectFit: "cover", objectPosition: "top" }} />
              </div>
            </div>
          ))}
        </div>

        {/* Flechas (desktop; en mobile se usa swipe) */}
        <button aria-label="prev" onClick={() => go(-1)} style={arrowStyle("left")}>‹</button>
        <button aria-label="next" onClick={() => go(1)} style={arrowStyle("right")}>›</button>
      </div>

      {/* Dots */}
      <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 18 }}>
        {slides.map((s, idx) => (
          <button
            key={s.img}
            aria-label={s.title}
            onClick={() => setI(idx)}
            style={{
              width: idx === i ? 22 : 8,
              height: 8,
              borderRadius: 4,
              border: "none",
              cursor: "pointer",
              padding: 0,
              background: idx === i ? "var(--blue)" : "var(--border-hi)",
              transition: "width 0.3s ease, background 0.3s ease",
            }}
          />
        ))}
      </div>
    </section>
  );
}

function arrowStyle(side: "left" | "right"): React.CSSProperties {
  return {
    position: "absolute",
    top: "50%",
    [side]: 4,
    transform: "translateY(-50%)",
    width: 34,
    height: 34,
    borderRadius: "50%",
    border: "1px solid var(--border-hi)",
    background: "var(--surface)",
    color: "var(--text)",
    fontSize: 20,
    lineHeight: 1,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };
}

const FEATURE_ICONS: Record<string, React.ReactNode> = {
  calendar: <><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></>,
  bell: <><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></>,
  trending: <><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></>,
  shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></>,
};

// Grilla de features: 1 columna en móvil, 2 en desktop. Cada card es ícono + título + texto,
// sin capturas — las capturas ya cuentan la historia visual arriba.
function FeatureGrid({ title, features }: { title: string; features: Feature[] }) {
  return (
    <section className="fade-up-2" style={{ marginBottom: 56 }}>
      <h2 style={{ fontSize: "clamp(20px, 2.4vw, 28px)", fontWeight: 700, textAlign: "center", marginBottom: 28, letterSpacing: -0.5 }}>
        {title}
      </h2>
      <div className="landing-features">
        {features.map((f) => (
          <div key={f.title} className="soft" style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
            <div style={{ width: 40, height: 40, flexShrink: 0, borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--blue-dim)", color: "var(--blue)" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                {FEATURE_ICONS[f.icon]}
              </svg>
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 5 }}>{f.title}</div>
              <div style={{ fontSize: 13.5, color: "var(--muted)", lineHeight: 1.6 }}>{f.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function HomeClient() {
  const [modal, setModal] = useState<Modal>(null);
  const { canInstall, promptInstall } = useInstallPrompt();
  const lang = useAppPrefs((s) => s.lang);
  const setLang = useAppPrefs((s) => s.setLang);
  const { dark, toggle: toggleTheme } = useTheme();
  const t = landing[lang];

  return (
    <>
      <main className="landing-main" style={{ margin: "0 auto", padding: "60px 20px 80px", color: "var(--text)" }}>

        {/* Theme + idioma */}
        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <button
            onClick={toggleTheme}
            aria-label={dark ? "Modo claro" : "Modo oscuro"}
            style={{ width: 34, height: 34, borderRadius: "50%", border: "1px solid var(--border)", background: "transparent", color: "var(--text)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            {dark ? (
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/></svg>
            ) : (
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
            )}
          </button>
          <div style={{ display: "inline-flex", border: "1px solid var(--border)", borderRadius: 999, overflow: "hidden" }}>
            {(["es", "en"] as const).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                aria-label={l === "es" ? "Español" : "English"}
                style={{
                  padding: "6px 14px",
                  fontSize: 12,
                  fontWeight: 700,
                  border: "none",
                  cursor: "pointer",
                  background: lang === l ? "var(--blue)" : "transparent",
                  color: lang === l ? "#fff" : "var(--muted)",
                }}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Hero: apilado y centrado en móvil; en desktop, texto a la izquierda y una captura
            grande a la derecha (la landing-hero se convierte en 2 columnas por CSS). */}
        <header className="fade-up landing-hero">
          <div className="landing-hero-copy">
            <Image
              src="/icon-512.png"
              alt="FinMoves"
              width={80}
              height={80}
              priority
              style={{ objectFit: "contain", display: "block", borderRadius: 18, marginBottom: 14 }}
            />
            <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.5, color: "var(--text)", marginBottom: 18 }}>FinMoves</div>
            <h1
              className="title-gradient"
              style={{ fontSize: "clamp(30px, 4.4vw, 52px)", fontWeight: 700, letterSpacing: -1, marginBottom: 16, lineHeight: 1.12 }}
            >
              {t.line1}<br />{t.line2}
            </h1>
            <p style={{ fontSize: 16, color: "var(--muted)", maxWidth: 460, marginBottom: 32, lineHeight: 1.7 }}>
              {t.sub}
            </p>
            <div className="landing-cta">
              <Link
                href="/login"
                replace
                style={{
                  display: "inline-block",
                  padding: "14px 40px",
                  borderRadius: 12,
                  fontSize: 15,
                  fontWeight: 700,
                  color: "#fff",
                  textDecoration: "none",
                  background: "linear-gradient(110deg, var(--blue) 10%, var(--green) 130%)",
                  boxShadow: "0 0 28px rgba(83,109,254,0.4)",
                }}
              >
                {t.enter}
              </Link>
              {canInstall && (
                <button
                  onClick={promptInstall}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "14px 24px",
                    borderRadius: 12,
                    fontSize: 15,
                    fontWeight: 700,
                    color: "var(--text)",
                    background: "transparent",
                    border: "1px solid var(--border-hi)",
                    cursor: "pointer",
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  {t.install}
                </button>
              )}
            </div>
            {/* En desktop no se puede instalar la PWA del celular: se explica en vez de ofrecerla. */}
            <p className="landing-install-hint">{t.installHint}</p>
          </div>

          {/* Captura del hero: solo desktop. En móvil el carrusel de abajo ya la muestra. */}
          <div className="landing-hero-shot" aria-hidden>
            <div style={{ position: "relative", width: "clamp(268px, 24vw, 340px)", aspectRatio: "268 / 540", borderRadius: 28, overflow: "hidden", border: "1px solid var(--border-hi)", background: "var(--surface)", boxShadow: "0 24px 70px rgba(0,0,0,0.5)" }}>
              <Image src={t.slides[0].img} alt="" fill sizes="340px" style={{ objectFit: "cover", objectPosition: "top" }} />
            </div>
          </div>
        </header>

        {/* Features — carrusel en móvil, grilla de texto en desktop */}
        <div className="landing-carousel-only">
          <FeatureCarousel slides={t.slides} />
        </div>
        <FeatureGrid title={t.featuresTitle} features={t.features} />

        {/* Access note */}
        <section className="fade-up-2" style={{ textAlign: "center", marginBottom: 52 }}>
          <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.7 }}>
            {t.access1} <b style={{ color: "var(--text)" }}>{t.accessBold}</b> {t.access2}<br />
            {t.access3}
          </p>
        </section>

        {/* Footer */}
        <footer style={{ textAlign: "center", fontSize: 12, color: "var(--muted)", borderTop: "1px solid var(--border)", paddingTop: 20 }}>
          <div style={{ display: "flex", gap: 16, justifyContent: "center", marginBottom: 8 }}>
            <button
              onClick={() => setModal("privacy")}
              style={{ background: "none", border: "none", color: "var(--blue)", cursor: "pointer", fontSize: 12, padding: 0, textDecoration: "underline" }}
            >
              {t.privacy}
            </button>
            <button
              onClick={() => setModal("terms")}
              style={{ background: "none", border: "none", color: "var(--blue)", cursor: "pointer", fontSize: 12, padding: 0, textDecoration: "underline" }}
            >
              {t.terms}
            </button>
          </div>
          <div>{t.contact} <a href="mailto:info@finmoves.app" style={{ color: "var(--muted)" }}>info@finmoves.app</a></div>
          <div style={{ marginTop: 8 }}>© {new Date().getFullYear()} FinMoves</div>
        </footer>
      </main>

      <IOSInstallBanner />

      {/* Legal modal */}
      {modal && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(7,9,15,0.97)", overflowY: "auto" }}
          onClick={(e) => { if (e.target === e.currentTarget) setModal(null); }}
        >
          <div style={{ maxWidth: 760, margin: "0 auto", padding: "32px 24px 80px", color: "var(--text)", lineHeight: 1.7, fontSize: 15 }}>
            <button
              onClick={() => setModal(null)}
              style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "none", border: "1px solid var(--border)", borderRadius: 8, color: "var(--muted)", cursor: "pointer", padding: "8px 14px", fontSize: 13, marginBottom: 36 }}
            >
              ← {lang === "es" ? "Cerrar" : "Close"}
            </button>
            {modal === "privacy" ? <PrivacyContent /> : <TermsContent />}
          </div>
        </div>
      )}
    </>
  );
}
