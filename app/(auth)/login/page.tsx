"use client";

import { useState } from "react";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/services/firebase/firebase";
import { useRouter } from "next/navigation";

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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Auth error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100dvh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
      background: "var(--bg)",
    }}>
      <div style={{ maxWidth: 380, width: "100%" }} className="fade-up">

        <div style={{ marginBottom: 40, textAlign: "center" }}>
          <div style={{ fontSize: 11, color: "var(--accent)", letterSpacing: 4, marginBottom: 10 }}>FINANZAS APP</div>
          <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: -0.5 }}>
            {isSignUp ? "Crear cuenta" : "Bienvenido"}
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 8 }}>
            {isSignUp ? "Registrate para continuar" : "Ingresá a tu cuenta"}
          </div>
        </div>

        <div className="card">
          <form onSubmit={handleAuth} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <div className="label">Email</div>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                className="input" disabled={loading} autoComplete="email" />
            </div>

            <div>
              <div className="label">Contraseña</div>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                className="input" disabled={loading} autoComplete={isSignUp ? "new-password" : "current-password"} />
            </div>

            {error && (
              <div style={{ background: "var(--red-dim)", border: "1px solid var(--red)44", borderRadius: "var(--radius-sm)", padding: 12, fontSize: 11, color: "var(--red)", lineHeight: 1.5 }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn btn-primary" style={{ marginTop: 4 }}>
              {loading ? "..." : isSignUp ? "Crear cuenta" : "Ingresar"}
            </button>
          </form>
        </div>

        <div style={{ marginTop: 20, textAlign: "center" }}>
          <button onClick={() => { setIsSignUp(!isSignUp); setError(""); }}
            style={{ background: "none", border: "none", color: "var(--accent)", fontSize: 12, cursor: "pointer" }}>
            {isSignUp ? "¿Ya tenés cuenta? Ingresar" : "¿No tenés cuenta? Registrarse"}
          </button>
        </div>
      </div>
    </div>
  );
}
