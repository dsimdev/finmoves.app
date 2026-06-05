"use client";

import { useState } from "react";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/services/firebase/firebase";
import { useRouter } from "next/navigation";
import { COLORS } from "@/constants/colors";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      router.push("/");
    } catch (err: any) {
      setError(err.message || "Auth error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        background: COLORS.bg,
        color: COLORS.text,
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
    >
      <div style={{ maxWidth: 400, width: "100%" }}>
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>
            💰 Finanzas
          </h1>
          <p style={{ fontSize: 13, color: COLORS.muted }}>
            {isSignUp ? "Crear cuenta" : "Inicia sesión"}
          </p>
        </div>

        <form onSubmit={handleAuth} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={{ display: "block", fontSize: 11, color: COLORS.muted, marginBottom: 6, letterSpacing: 1 }}>
              EMAIL
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                width: "100%",
                background: COLORS.surfaceAlt,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 6,
                padding: "10px 12px",
                color: COLORS.text,
                fontSize: 13,
                boxSizing: "border-box",
              }}
              disabled={loading}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 11, color: COLORS.muted, marginBottom: 6, letterSpacing: 1 }}>
              PASSWORD
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                width: "100%",
                background: COLORS.surfaceAlt,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 6,
                padding: "10px 12px",
                color: COLORS.text,
                fontSize: 13,
                boxSizing: "border-box",
              }}
              disabled={loading}
            />
          </div>

          {error && (
            <div style={{ background: COLORS.redDim, border: `1px solid ${COLORS.red}`, borderRadius: 6, padding: 12, fontSize: 12, color: COLORS.red }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              background: COLORS.accent,
              color: COLORS.bg,
              border: "none",
              borderRadius: 6,
              padding: "12px 18px",
              fontSize: 11,
              fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.6 : 1,
              letterSpacing: 2,
              textTransform: "uppercase",
            }}
          >
            {loading ? "..." : isSignUp ? "CREAR" : "INGRESAR"}
          </button>
        </form>

        <div style={{ marginTop: 20, textAlign: "center" }}>
          <button
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError("");
            }}
            style={{
              background: "none",
              border: "none",
              color: COLORS.accent,
              fontSize: 12,
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            {isSignUp ? "¿Ya tenés cuenta? Ingresar" : "¿No tenés cuenta? Crear"}
          </button>
        </div>
      </div>
    </div>
  );
}
