"use client";

import { useState } from "react";
import Image from "next/image";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/services/firebase/firebase";
import { useRouter } from "next/navigation";
import { useT } from "@/hooks/useTranslation";
import { authErrorMessage } from "@/lib/firebase-error";

export default function LoginPage() {
  const t = useT();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const router = useRouter();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError("");
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      router.push("/");
    } catch (err: unknown) {
      setError(authErrorMessage(err, t));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: "relative",
      minHeight: "100dvh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
      overflow: "hidden",
    }}>
      {/* Glows de fondo */}
      <div aria-hidden style={{
        position: "absolute", top: "-15%", left: "-10%", width: 420, height: 420,
        background: "radial-gradient(circle, var(--blue) 0%, transparent 70%)",
        opacity: 0.22, filter: "blur(40px)", pointerEvents: "none",
      }} />
      <div aria-hidden style={{
        position: "absolute", bottom: "-15%", right: "-10%", width: 420, height: 420,
        background: "radial-gradient(circle, var(--green) 0%, transparent 70%)",
        opacity: 0.18, filter: "blur(40px)", pointerEvents: "none",
      }} />

      <div style={{ width: "min(400px, 100%)", position: "relative", zIndex: 1 }} className="fade-up">

        <div style={{ marginBottom: 28 }}>
          <Image
            src="/logo5-cropped.png"
            alt="FinMoves"
            width={220}
            height={150}
            priority
            style={{ objectFit: "contain", display: "block", margin: "0 auto" }}
          />
        </div>

        {/* Form */}
        <form onSubmit={handleAuth} style={{
          background: "color-mix(in srgb, var(--surface) 75%, transparent)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          border: "1px solid var(--border-hi, var(--border))",
          borderRadius: 22,
          padding: 28,
          display: "flex",
          flexDirection: "column",
          gap: 18,
          boxShadow: "0 24px 64px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.04)",
        }}>
          {/* Email */}
          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: "var(--muted)", display: "flex", pointerEvents: "none" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="3" />
                <path d="m3 6 9 6 9-6" />
              </svg>
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              style={{ paddingLeft: 46, height: 52 }}
              placeholder={t.loginEmailPlaceholder}
              disabled={loading}
              autoComplete="email"
            />
          </div>

          {/* Password */}
          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: "var(--muted)", display: "flex", pointerEvents: "none" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="11" width="16" height="10" rx="2.5" />
                <path d="M8 11V7a4 4 0 0 1 8 0v4" />
              </svg>
            </span>
            <input
              type={showPw ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              style={{ paddingLeft: 46, paddingRight: 46, height: 52 }}
              placeholder={t.loginPassword}
              disabled={loading}
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPw(v => !v)}
              aria-label={showPw ? "Ocultar" : "Mostrar"}
              style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: 6, display: "flex" }}
            >
                {showPw ? (
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 12s3.5-7 10-7c1.6 0 3 .4 4.3 1M22 12s-3.5 7-10 7c-1.6 0-3-.4-4.3-1" />
                    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /><path d="M3 3l18 18" />
                  </svg>
                ) : (
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
          </div>

          {error && (
            <div style={{
              background: "var(--red-dim)",
              border: "1px solid var(--red)44",
              borderRadius: "var(--radius-sm)",
              padding: "10px 12px",
              fontSize: 12,
              color: "var(--red)",
              lineHeight: 1.5,
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn"
            style={{
              marginTop: 4, height: 48, fontSize: 14, fontWeight: 700,
              color: "#fff", border: "none",
              background: "linear-gradient(110deg, var(--blue) 10%, var(--green) 130%)",
              boxShadow: "0 8px 24px color-mix(in srgb, var(--blue) 40%, transparent)",
            }}
          >
            {loading ? t.loginSigningIn : t.loginSignIn}
          </button>
        </form>

      </div>
    </div>
  );
}
