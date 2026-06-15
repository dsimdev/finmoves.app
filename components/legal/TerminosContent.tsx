import type { CSSProperties } from "react";

const ACTUALIZADO = "15 de junio de 2026";
const CONTACTO = "info@finmoves.app";

const h: CSSProperties = { fontSize: 18, fontWeight: 700, margin: "28px 0 8px" };
const ul: CSSProperties = { paddingLeft: 20, display: "flex", flexDirection: "column", gap: 8, margin: "8px 0" };
const a: CSSProperties = { color: "var(--blue)", textDecoration: "underline" };

export function TerminosContent() {
  return (
    <>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 6 }}>Condiciones del Servicio</h1>
      <p style={{ color: "var(--muted)", marginBottom: 28 }}>FinMoves · Última actualización: {ACTUALIZADO}</p>

      <p style={{ marginBottom: 20 }}>Al usar FinMoves (&quot;la app&quot;) aceptás estas condiciones. Si no estás de acuerdo, no uses la app.</p>

      <h2 style={h}>Qué es</h2>
      <p>FinMoves es una herramienta personal para registrar y analizar tus finanzas. Se ofrece como un servicio de uso personal.</p>

      <h2 style={h}>Acceso por invitación</h2>
      <p>El registro es <b>cerrado</b>: no hay registro público. Solo se puede crear una cuenta con un <b>código de invitación de un solo uso</b> provisto por el administrador.</p>

      <h2 style={h}>Tu cuenta</h2>
      <ul style={ul}>
        <li>Sos responsable de mantener la confidencialidad de tus credenciales y de la actividad de tu cuenta.</li>
        <li>Los datos que cargás son tuyos y sos responsable de su veracidad. FinMoves no brinda asesoramiento financiero.</li>
      </ul>

      <h2 style={h}>Uso aceptable</h2>
      <p>No debés usar la app para fines ilícitos, ni intentar vulnerar su seguridad o la de otros usuarios.</p>

      <h2 style={h}>Disponibilidad y garantías</h2>
      <p>La app se ofrece &quot;tal cual&quot; y &quot;según disponibilidad&quot;, sin garantías de funcionamiento ininterrumpido ni de ausencia de errores. Hacemos un esfuerzo razonable por proteger y respaldar tus datos, pero no garantizamos que no pueda haber pérdidas.</p>

      <h2 style={h}>Limitación de responsabilidad</h2>
      <p>En la medida permitida por la ley, FinMoves no será responsable por daños indirectos o pérdida de datos derivados del uso de la app. Las decisiones financieras que tomes son de tu exclusiva responsabilidad.</p>

      <h2 style={h}>Baja</h2>
      <p>Podés solicitar la eliminación de tu cuenta en cualquier momento escribiendo a <a href={`mailto:${CONTACTO}`} style={a}>{CONTACTO}</a>.</p>

      <h2 style={h}>Cambios</h2>
      <p>Podemos actualizar estas condiciones; la versión vigente se publica en esta página con su fecha.</p>

      <h2 style={h}>Contacto</h2>
      <p><a href={`mailto:${CONTACTO}`} style={a}>{CONTACTO}</a></p>
    </>
  );
}
