import type { Metadata } from "next";
import Image from "next/image";

export const metadata: Metadata = {
  title: "FinMoves — Tus finanzas personales, claras",
  description: "FinMoves es una app personal para registrar tus gastos e ingresos, ver reportes, seguir tus ahorros e inversiones en dólares/euros y recibir recordatorios. Acceso por invitación.",
};

const features = [
  ["Movimientos", "Registrá gastos e ingresos por categoría, medio de pago y período, con comprobantes opcionales."],
  ["Reportes", "Visualizá en qué se va tu plata: por categoría, día, período, tendencias y proyecciones."],
  ["Inversión", "Seguí tu reserva en dólares/euros: compras, ventas y gastos, con cotización y metas de ahorro."],
  ["Recordatorios", "Avisos por fecha y notificaciones para no olvidarte de cargar o de tus vencimientos."],
];

export default function InicioPage() {
  return (
    <main style={{ maxWidth: 820, margin: "0 auto", padding: "56px 24px 80px", color: "var(--text)", lineHeight: 1.7 }}>
      <header style={{ textAlign: "center", marginBottom: 40 }}>
        <Image src="/logo5-cropped.png" alt="FinMoves" width={200} height={130} priority style={{ objectFit: "contain", display: "block", margin: "0 auto 12px" }} />
        <h1 style={{ fontSize: 30, fontWeight: 700, letterSpacing: -0.5, marginBottom: 10 }}>Tus finanzas personales, claras</h1>
        <p style={{ fontSize: 16, color: "var(--muted)", maxWidth: 560, margin: "0 auto" }}>
          FinMoves es una aplicación web personal para <b>registrar tus gastos e ingresos</b>, ver <b>reportes</b>,
          seguir tus <b>ahorros e inversiones</b> en dólares/euros y recibir <b>recordatorios</b>. Tus datos son tuyos:
          se guardan de forma privada y segura, no se venden ni se comparten.
        </p>
      </header>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, marginBottom: 40 }}>
        {features.map(([title, desc]) => (
          <div key={title} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 18 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>{title}</h2>
            <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.6 }}>{desc}</p>
          </div>
        ))}
      </section>

      <section style={{ textAlign: "center", marginBottom: 40 }}>
        <p style={{ fontSize: 14, color: "var(--muted)", marginBottom: 16 }}>
          El acceso es <b>por invitación</b>: se ingresa con un código provisto por el administrador. Podés iniciar sesión con email o con tu cuenta de Google.
        </p>
        <a href="/login" style={{ display: "inline-block", padding: "12px 28px", borderRadius: 12, fontSize: 15, fontWeight: 700, color: "#fff", textDecoration: "none", background: "linear-gradient(110deg, var(--blue) 10%, var(--green) 130%)" }}>
          Ingresar
        </a>
      </section>

      <footer style={{ textAlign: "center", fontSize: 12, color: "var(--muted)", borderTop: "1px solid var(--border)", paddingTop: 20 }}>
        <div style={{ display: "flex", gap: 16, justifyContent: "center", marginBottom: 8 }}>
          <a href="/privacidad" style={{ color: "var(--blue)", textDecoration: "none" }}>Política de Privacidad</a>
          <a href="/terminos" style={{ color: "var(--blue)", textDecoration: "none" }}>Condiciones del Servicio</a>
        </div>
        <div>Contacto: <a href="mailto:info@finmoves.app" style={{ color: "var(--muted)" }}>info@finmoves.app</a></div>
        <div style={{ marginTop: 8 }}>© {new Date().getFullYear()} FinMoves</div>
      </footer>
    </main>
  );
}
