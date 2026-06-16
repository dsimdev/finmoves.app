"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { PrivacyContent } from "@/components/legal/PrivacyContent";
import { TermsContent } from "@/components/legal/TermsContent";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";
import { useAppPrefs } from "@/hooks/useAppPrefs";

type Modal = "privacy" | "terms" | null;
type Slide = { title: string; desc: string; img: string };

const T = {
  es: {
    line1: "Tus finanzas personales,",
    line2: "claras",
    sub: "FinMoves es tu app de finanzas personales: registrá, analizá y seguí tus gastos, ingresos, ahorros e inversiones. Tus datos son tuyos: privados, seguros, sin publicidad.",
    enter: "Ingresar",
    install: "Instalar",
    access1: "Acceso",
    accessBold: "por invitación",
    access2: "— ingresá con un código provisto por el administrador.",
    access3: "Podés iniciar sesión con email o con tu cuenta de Google.",
    privacy: "Política de Privacidad",
    terms: "Condiciones del Servicio",
    contact: "Contacto:",
    slides: [
      { title: "Movimientos", desc: "Cargá gastos e ingresos por categoría, medio de pago y período.", img: "/screenshots/new-movement.png" },
      { title: "Reportes", desc: "Mirá en qué se va tu plata: categorías, tendencias y proyecciones.", img: "/screenshots/reports-expenses.jpeg" },
      { title: "Inversión", desc: "Tu reserva en dólares o euros, con cotización y metas.", img: "/screenshots/portfolio.png" },
      { title: "Configuración", desc: "Ajustá monedas, idioma y preferencias a tu gusto.", img: "/screenshots/settings.png" },
    ] as Slide[],
  },
  en: {
    line1: "Your personal finances,",
    line2: "clear",
    sub: "FinMoves is your personal finance app: track and analyze your expenses, income, savings and investments. Your data is yours: private, secure, no ads.",
    enter: "Sign in",
    install: "Install",
    access1: "Access is",
    accessBold: "invite-only",
    access2: "— sign up with a code provided by the admin.",
    access3: "You can sign in with email or your Google account.",
    privacy: "Privacy Policy",
    terms: "Terms of Service",
    contact: "Contact:",
    slides: [
      { title: "Transactions", desc: "Log expenses and income by category, payment method and period.", img: "/screenshots/new-movement.png" },
      { title: "Reports", desc: "See where your money goes: categories, trends and projections.", img: "/screenshots/reports-expenses.jpeg" },
      { title: "Investments", desc: "Your USD/EUR reserve, with exchange rate and goals.", img: "/screenshots/portfolio.png" },
      { title: "Settings", desc: "Adjust currencies, language and preferences your way.", img: "/screenshots/settings.png" },
    ] as Slide[],
  },
};

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
    border: "1px solid var(--border)",
    background: "rgba(7,9,15,0.55)",
    backdropFilter: "blur(4px)",
    color: "var(--text)",
    fontSize: 20,
    lineHeight: 1,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };
}

export function HomeClient() {
  const [modal, setModal] = useState<Modal>(null);
  const { canInstall, promptInstall } = useInstallPrompt();
  const lang = useAppPrefs((s) => s.lang);
  const setLang = useAppPrefs((s) => s.setLang);
  const t = T[lang];

  return (
    <>
      <main style={{ maxWidth: 900, margin: "0 auto", padding: "60px 20px 80px", color: "var(--text)" }}>

        {/* Toggle de idioma */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
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

        {/* Hero */}
        <header className="fade-up" style={{ textAlign: "center", marginBottom: 56 }}>
          <Image
            src="/logo5-cropped.png"
            alt="FinMoves"
            width={160}
            height={104}
            priority
            style={{ objectFit: "contain", display: "block", margin: "0 auto 16px" }}
          />
          <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", color: "var(--muted)", marginBottom: 18 }}>FinMoves</div>
          <h1
            className="title-gradient"
            style={{ fontSize: "clamp(30px, 5vw, 48px)", fontWeight: 700, letterSpacing: -1, marginBottom: 16, lineHeight: 1.12 }}
          >
            {t.line1}<br />{t.line2}
          </h1>
          <p style={{ fontSize: 16, color: "var(--muted)", maxWidth: 460, margin: "0 auto 32px", lineHeight: 1.7 }}>
            {t.sub}
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <a
              href="/login"
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
            </a>
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
        </header>

        {/* Features — carrusel */}
        <FeatureCarousel slides={t.slides} />

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
