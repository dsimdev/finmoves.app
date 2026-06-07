"use client";

import { useState } from "react";
import Image from "next/image";
import { signInWithEmailAndPassword/*, createUserWithEmailAndPassword*/ } from "firebase/auth";
import { auth } from "@/services/firebase/firebase";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      // if (isSignUp) {
      //   await createUserWithEmailAndPassword(auth, email, password);
      // } else {
        await signInWithEmailAndPassword(auth, email, password);
      // }
      router.push("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Auth error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      height: "100dvh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
    }}>
      <div style={{ width: "min(400px, 100%)" }} className="fade-up">

        <div style={{ marginBottom: 32 }}>
          <Image
            src="/logo5-cropped.png"
            alt="FinMoves"
            width={240}
            height={163}
            priority
            style={{ objectFit: "contain", display: "block", margin: "0 auto" }}
          />
        </div>

        {/* Form */}
        <div style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          padding: 32,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}>
          <div>
            <div className="label" style={{ marginBottom: 6 }}>Email</div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              placeholder="tu@email.com"
              disabled={loading}
              autoComplete="email"
            />
          </div>

          <div>
            <div className="label" style={{ marginBottom: 6 }}>Contraseña</div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              placeholder="••••••••"
              disabled={loading}
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div style={{
              background: "var(--red-dim)",
              border: "1px solid var(--red)44",
              borderRadius: "var(--radius-sm)",
              padding: "10px 12px",
              fontSize: 11,
              color: "var(--red)",
              lineHeight: 1.5,
            }}>
              {error}
            </div>
          )}

          <button
            disabled={loading}
            className="btn btn-primary"
            style={{ marginTop: 4, height: 46, fontSize: 14, fontWeight: 700 }}
            onClick={handleAuth}
          >
            {loading ? "..." : "Ingresar"}
          </button>
        </div>

        {/* Sign up deshabilitado por ahora */}
        {/* <div style={{ marginTop: 20, textAlign: "center" }}>
          <button
            onClick={() => { setIsSignUp(!isSignUp); setError(""); }}
            style={{ background: "none", border: "none", color: "var(--muted)", fontSize: 12, cursor: "pointer" }}
          >
            ¿No tenés cuenta?{" "}
            <span style={{ color: "var(--accent)", fontWeight: 600 }}>Registrate</span>
          </button>
        </div> */}

      </div>
    </div>
  );
}
