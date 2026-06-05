"use client";

import { COLORS } from "@/constants/colors";
import { useAuth } from "@/hooks/useAuth";
import { usePeriodos } from "@/hooks/usePeriodos";
import { signOut } from "firebase/auth";
import { auth } from "@/services/firebase/config";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { crearPeriodo } from "@/services/firebase/periodos";
import Link from "next/link";

const TABS = [
  { href: "/", label: "Dashboard" },
  { href: "/cargar", label: "Cargar" },
  { href: "/resumen", label: "Resumen" },
  { href: "/dolares", label: "USD" },
  { href: "/config", label: "Config" },
];

export default function Dashboard() {
  const { user } = useAuth();
  const { periodoActivo, periodos } = usePeriodos(user?.uid);
  const router = useRouter();
  const [creatingPeriodo, setCreatingPeriodo] = useState(false);

  // Crear período inicial si no existe
  useEffect(() => {
    if (!user?.uid || periodos.length > 0) return;

    const createInitialPeriodo = async () => {
      try {
        setCreatingPeriodo(true);
        const now = new Date();
        await crearPeriodo(user.uid, {
          id: "",
          inicio: now,
          fin: null,
          sueldo: 0,
          estado: "activo",
          resto: 0,
        });
      } catch (err) {
        console.error("Error creating initial periodo:", err);
      } finally {
        setCreatingPeriodo(false);
      }
    };

    createInitialPeriodo();
  }, [user?.uid, periodos.length]);

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  return (
    <div
      style={{
        fontFamily: "'IBM Plex Mono', monospace",
        background: COLORS.bg,
        color: COLORS.text,
        minHeight: "100vh",
        padding: "24px 20px",
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 10, color: COLORS.muted, letterSpacing: 4, textTransform: "uppercase", marginBottom: 4 }}>
              Finanzas App
            </div>
            <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: -1 }}>
              Dashboard
            </div>
          </div>
          <button
            onClick={handleLogout}
            style={{
              background: COLORS.red,
              color: COLORS.bg,
              border: "none",
              borderRadius: 6,
              padding: "10px 18px",
              fontSize: 11,
              letterSpacing: 2,
              textTransform: "uppercase",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            Logout
          </button>
        </div>

        {/* Navegación */}
        <div style={{ display: "flex", gap: 2, marginBottom: 24, flexWrap: "wrap", borderBottom: `1px solid ${COLORS.border}` }}>
          {TABS.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              style={{
                padding: "9px 18px",
                background: "none",
                border: "none",
                borderBottom: tab.href === "/" ? `2px solid ${COLORS.accent}` : "2px solid transparent",
                color: tab.href === "/" ? COLORS.accent : COLORS.muted,
                cursor: "pointer",
                fontSize: 11,
                letterSpacing: 2,
                textTransform: "uppercase",
                fontFamily: "'IBM Plex Mono', monospace",
                marginBottom: -1,
                textDecoration: "none",
              }}
            >
              {tab.label}
            </Link>
          ))}
        </div>

        <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 20 }}>
          <div style={{ fontSize: 14, color: COLORS.muted, marginBottom: 12 }}>
            Conectado como: <span style={{ color: COLORS.accent }}>{user?.email}</span>
          </div>
          <p style={{ color: COLORS.text, lineHeight: 1.6 }}>
            📊 Período activo: <span style={{ color: COLORS.green }}>{periodoActivo ? "✓" : "cargando..."}</span>
            {creatingPeriodo && " (creando período inicial...)"}
            <br />
            <br />
            🚀 Navegá por las pestañas arriba para:
            <br />
            • Cargar movimientos<br/>
            • Ver resumen de períodos<br/>
            • Gestionar reserva USD<br/>
            • Editar configuración
          </p>
        </div>
      </div>
    </div>
  );
}
