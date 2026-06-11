"use client";

// Fallback de último recurso: se activa si falla el propio root layout.
// Reemplaza <html>/<body>, por eso no puede depender de globals.css ni de hooks de la app.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="es">
      <body style={{ margin: 0, background: "#08080f", color: "#e8e8f0", fontFamily: "system-ui, sans-serif" }}>
        <div style={{
          minHeight: "100dvh", display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", textAlign: "center",
          padding: 24, gap: 16,
        }}>
          <div style={{ fontSize: 40 }}>⚠️</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Algo salió mal</div>
          <pre style={{
            maxWidth: "min(520px, 100%)", width: "100%", textAlign: "left",
            background: "#16161f", border: "1px solid #2a2a35", borderRadius: 8,
            padding: 12, fontSize: 11, color: "#ff7b7b", whiteSpace: "pre-wrap",
            wordBreak: "break-word", maxHeight: 200, overflowY: "auto",
          }}>
            {error.message}{error.digest ? `\n\ndigest: ${error.digest}` : ""}
          </pre>
          <button onClick={reset} style={{
            height: 42, padding: "0 20px", fontSize: 13, fontWeight: 700,
            background: "#536dfe", color: "#fff", border: "none", borderRadius: 10, cursor: "pointer",
          }}>
            Reintentar
          </button>
        </div>
      </body>
    </html>
  );
}
