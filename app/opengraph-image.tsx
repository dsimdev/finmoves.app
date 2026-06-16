import { ImageResponse } from "next/og";

// Imagen para Open Graph / Twitter (al compartir el link en redes/WhatsApp).
// Generada por código: branded 1200x630, sin assets externos.
export const alt = "FinMoves — Tus finanzas personales, claras";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#07090f",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 104, fontWeight: 800, color: "#7c8cff", letterSpacing: -2 }}>
          FinMoves
        </div>
        <div style={{ display: "flex", marginTop: 20, fontSize: 42, color: "#9aa9c7" }}>
          Tus finanzas personales, claras
        </div>
        <div style={{ display: "flex", marginTop: 28, fontSize: 26, color: "#5a7090" }}>
          Gastos · ingresos · ahorros · inversión · reportes
        </div>
        <div style={{ display: "flex", marginTop: 44, width: 220, height: 10, borderRadius: 5, background: "linear-gradient(90deg, #536dfe, #00e676)" }} />
      </div>
    ),
    { ...size }
  );
}
