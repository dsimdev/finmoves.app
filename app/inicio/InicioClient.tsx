"use client";
import Image from "next/image";
import { useState } from "react";
import { PrivacidadContent } from "@/components/legal/PrivacidadContent";
import { TerminosContent } from "@/components/legal/TerminosContent";

type Modal = "privacidad" | "terminos" | null;

const cards = [
  {
    title: "Movimientos",
    desc: "Registrá gastos e ingresos por categoría, medio de pago y período, con comprobantes opcionales.",
    img: "/pwa-login.jpeg",
  },
  {
    title: "Reportes",
    desc: "Visualizá en qué se va tu plata: por categoría, día, período, tendencias y proyecciones.",
    img: "/pwa-reports.jpeg",
  },
  {
    title: "Inversión",
    desc: "Seguí tu reserva en dólares/euros: compras, ventas y gastos con cotización y metas.",
    img: "/pwa-settings.jpeg",
  },
  {
    title: "Recordatorios",
    desc: "Avisos por fecha y notificaciones para no olvidarte de cargar o de tus vencimientos.",
    img: null,
  },
];

export function InicioClient() {
  const [modal, setModal] = useState<Modal>(null);

  return (
    <>
      <main style={{ maxWidth: 900, margin: "0 auto", padding: "60px 20px 80px", color: "var(--text)" }}>

        {/* Hero */}
        <header className="fade-up" style={{ textAlign: "center", marginBottom: 64 }}>
          <Image
            src="/logo5-cropped.png"
            alt="FinMoves"
            width={160}
            height={104}
            priority
            style={{ objectFit: "contain", display: "block", margin: "0 auto 24px" }}
          />
          <h1
            className="title-gradient"
            style={{ fontSize: "clamp(30px, 5vw, 48px)", fontWeight: 700, letterSpacing: -1, marginBottom: 16, lineHeight: 1.12 }}
          >
            Tus finanzas personales,<br />claras
          </h1>
          <p style={{ fontSize: 16, color: "var(--muted)", maxWidth: 460, margin: "0 auto 32px", lineHeight: 1.7 }}>
            Registrá, analizá y seguí tus gastos, ingresos, ahorros e inversiones.
            Tus datos son tuyos: privados, seguros, sin publicidad.
          </p>
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
            Ingresar
          </a>
        </header>

        {/* Feature cards */}
        <section
          className="fade-up-1"
          style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16, marginBottom: 56 }}
        >
          {cards.map(({ title, desc, img }) => (
            <div
              key={title}
              className="screen-card"
              style={{
                position: "relative",
                height: 260,
                borderRadius: 16,
                overflow: "hidden",
                border: "1px solid var(--border)",
                cursor: "default",
              }}
            >
              {img ? (
                <>
                  <Image
                    src={img}
                    alt={title}
                    fill
                    sizes="(max-width: 640px) 100vw, 50vw"
                    style={{ objectFit: "cover" }}
                  />
                  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(7,9,15,0.97) 28%, rgba(7,9,15,0.1) 100%)" }} />
                </>
              ) : (
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, var(--surface) 0%, #131c3e 100%)" }}>
                  <div style={{ position: "absolute", top: -24, right: -24, width: 140, height: 140, borderRadius: "50%", background: "rgba(83,109,254,0.09)" }} />
                  <div style={{ position: "absolute", top: 28, right: 28, width: 72, height: 72, borderRadius: "50%", background: "rgba(0,230,118,0.07)" }} />
                  <div style={{ position: "absolute", bottom: 40, left: -16, width: 80, height: 80, borderRadius: "50%", background: "rgba(83,109,254,0.05)" }} />
                </div>
              )}
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "20px 20px 24px" }}>
                <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 7 }}>{title}</h2>
                <p style={{ fontSize: 13, color: img ? "rgba(232,238,255,0.65)" : "var(--muted)", lineHeight: 1.55 }}>{desc}</p>
              </div>
            </div>
          ))}
        </section>

        {/* Access note */}
        <section className="fade-up-2" style={{ textAlign: "center", marginBottom: 52 }}>
          <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.7 }}>
            Acceso <b style={{ color: "var(--text)" }}>por invitación</b> — ingresá con un código provisto por el administrador.<br />
            Podés iniciar sesión con email o con tu cuenta de Google.
          </p>
        </section>

        {/* Footer */}
        <footer style={{ textAlign: "center", fontSize: 12, color: "var(--muted)", borderTop: "1px solid var(--border)", paddingTop: 20 }}>
          <div style={{ display: "flex", gap: 16, justifyContent: "center", marginBottom: 8 }}>
            <button
              onClick={() => setModal("privacidad")}
              style={{ background: "none", border: "none", color: "var(--blue)", cursor: "pointer", fontSize: 12, padding: 0, textDecoration: "underline" }}
            >
              Política de Privacidad
            </button>
            <button
              onClick={() => setModal("terminos")}
              style={{ background: "none", border: "none", color: "var(--blue)", cursor: "pointer", fontSize: 12, padding: 0, textDecoration: "underline" }}
            >
              Condiciones del Servicio
            </button>
          </div>
          <div>Contacto: <a href="mailto:info@finmoves.app" style={{ color: "var(--muted)" }}>info@finmoves.app</a></div>
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
              ← Cerrar
            </button>
            {modal === "privacidad" ? <PrivacidadContent /> : <TerminosContent />}
          </div>
        </div>
      )}
    </>
  );
}
