import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de Privacidad · FinMoves",
  description: "Cómo FinMoves trata tus datos.",
};

const ACTUALIZADO = "15 de junio de 2026";
const CONTACTO = "dmnsimon@gmail.com";

export default function PrivacidadPage() {
  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "48px 24px 80px", color: "var(--text)", lineHeight: 1.7, fontSize: 15 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 6 }}>Política de Privacidad</h1>
      <p style={{ color: "var(--muted)", marginBottom: 28 }}>FinMoves · Última actualización: {ACTUALIZADO}</p>

      <p style={{ marginBottom: 20 }}>
        FinMoves (&quot;la app&quot;) es una aplicación personal para registrar y analizar tus finanzas.
        El acceso es cerrado: solo se ingresa con un código de invitación. Esta política explica
        qué datos tratamos, para qué y cómo los protegemos.
      </p>

      <h2 style={hStyle}>Qué datos recopilamos</h2>
      <ul style={ulStyle}>
        <li><b>Cuenta:</b> tu correo electrónico (y, si iniciás sesión con Google, tu nombre y foto de perfil de Google).</li>
        <li><b>Datos que cargás:</b> movimientos, montos, categorías, medios de pago, descripciones, observaciones, fechas y, opcionalmente, comprobantes (imágenes/PDF) que adjuntes.</li>
        <li><b>Preferencias:</b> configuración de la app (tema, moneda, secciones visibles, etc.).</li>
        <li><b>Técnicos mínimos:</b> datos necesarios para que la app funcione (sesión, suscripción a notificaciones si la activás) y métricas de uso anónimas para mejorar la app.</li>
      </ul>

      <h2 style={hStyle}>Para qué los usamos</h2>
      <p>Únicamente para que la app funcione: mostrarte y analizar tus finanzas, sincronizar tu información entre tus dispositivos y enviarte notificaciones que vos habilites. <b>No vendemos ni compartimos tus datos</b> con terceros para publicidad.</p>

      <h2 style={hStyle}>Dónde se guardan</h2>
      <p>Tus datos se almacenan en la infraestructura de <b>Google Cloud / Firebase</b> (Authentication, Firestore y Storage). El acceso está restringido a tu propia cuenta mediante reglas de seguridad. Podemos generar respaldos de tu información para evitar pérdidas.</p>

      <h2 style={hStyle}>Inicio de sesión con Google</h2>
      <p>Si vinculás tu cuenta de Google, usamos tu nombre, correo y foto de perfil solo para identificar tu cuenta y completar tu perfil dentro de la app. No accedemos a otros datos de tu cuenta de Google.</p>

      <h2 style={hStyle}>Tus derechos</h2>
      <p>Podés exportar tu información desde la app y solicitar la eliminación de tu cuenta y tus datos escribiendo a <a href={`mailto:${CONTACTO}`} style={aStyle}>{CONTACTO}</a>. Atenderemos el pedido en un plazo razonable.</p>

      <h2 style={hStyle}>Retención</h2>
      <p>Conservamos tus datos mientras tu cuenta esté activa. Al eliminar la cuenta, borramos tu información (pueden quedar copias en respaldos por un tiempo limitado hasta su rotación).</p>

      <h2 style={hStyle}>Cambios</h2>
      <p>Podemos actualizar esta política. Publicaremos la versión vigente en esta misma página con su fecha de actualización.</p>

      <h2 style={hStyle}>Contacto</h2>
      <p>Por cualquier consulta sobre tus datos: <a href={`mailto:${CONTACTO}`} style={aStyle}>{CONTACTO}</a>.</p>

      <p style={{ marginTop: 32 }}><a href="/terminos" style={aStyle}>Condiciones del Servicio</a></p>
    </main>
  );
}

const hStyle: React.CSSProperties = { fontSize: 18, fontWeight: 700, margin: "28px 0 8px" };
const ulStyle: React.CSSProperties = { paddingLeft: 20, display: "flex", flexDirection: "column", gap: 8, margin: "8px 0" };
const aStyle: React.CSSProperties = { color: "var(--blue)", textDecoration: "underline" };
