"use client";

import { useState } from "react";
import { useT } from "@/hooks/useTranslation";
import { useAppPrefs } from "@/hooks/useAppPrefs";
import type { Recordatorio } from "@/services/firebase/recordatorios";

// Calendario de la card de recordatorios. No es un adorno: ES el control de entrada — se
// navega entre meses y se toca un día para cargar ahí (reemplaza al input de fecha, que
// ocupaba una fila y obligaba a escribir la fecha a mano).
//
// El punto bajo el número marca los días con algo; violeta = repetible, teal = puntual.

const DIAS_SEMANA = ["L", "M", "M", "J", "V", "S", "D"];

/** YYYY-MM-DD de un día del mes mostrado, sin pasar por Date (evita corrimientos de zona). */
const iso = (anio: number, mes0: number, dia: number) =>
  `${anio}-${String(mes0 + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;

export function ReminderCalendar({ recordatorios, seleccionado, onSelect }: {
  recordatorios: Recordatorio[];
  /** Día elegido (YYYY-MM-DD) o null si todavía no se tocó ninguno. */
  seleccionado: string | null;
  onSelect: (fecha: string) => void;
}) {
  const t = useT();
  const { lang } = useAppPrefs();
  const ar = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const hoyISO = ar.toISOString().slice(0, 10);

  // Mes en vista: arranca en el actual y se mueve con las flechas.
  const [vista, setVista] = useState({ anio: ar.getUTCFullYear(), mes: ar.getUTCMonth() });
  const { anio, mes } = vista;

  const mover = (delta: number) =>
    setVista(({ anio: a, mes: m }) => {
      const total = a * 12 + m + delta;
      return { anio: Math.floor(total / 12), mes: ((total % 12) + 12) % 12 };
    });

  const diasEnMes = new Date(Date.UTC(anio, mes + 1, 0)).getUTCDate();
  // getUTCDay(): 0=domingo. La grilla arranca en lunes, así que domingo pasa a ser 6.
  const offset = (new Date(Date.UTC(anio, mes, 1)).getUTCDay() + 6) % 7;

  // Día del mes → si tiene recordatorio y si alguno de ese día repite.
  const porDia = new Map<number, { repite: boolean }>();
  for (const r of recordatorios) {
    const [y, m, d] = r.fecha.split("-").map(Number);
    if (y !== anio || m !== mes + 1) continue;
    porDia.set(d, { repite: (porDia.get(d)?.repite ?? false) || !!r.repetir });
  }

  const celdas: (number | null)[] = [
    ...Array<null>(offset).fill(null),
    ...Array.from({ length: diasEnMes }, (_, i) => i + 1),
  ];

  const navBtn: React.CSSProperties = {
    background: "none", border: "none", color: "var(--muted)", cursor: "pointer",
    padding: 4, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 6,
  };

  return (
    <div style={{ marginBottom: 14 }}>
      {/* Mes en vista + navegación */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 7 }}>
        <button type="button" onClick={() => mover(-1)} aria-label={t.prevMonth} style={navBtn}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
        </button>
        {/* Solo el mes: el año se sobreentiende. Si la navegación sale del año en curso, se
            agrega para no perder la referencia. */}
        <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: 0.4 }}>
          {(() => {
            const d = new Date(Date.UTC(anio, mes, 1));
            const nombre = d.toLocaleDateString(lang === "en" ? "en-US" : "es-AR", { month: "long", timeZone: "UTC" });
            const mesCap = `${nombre.charAt(0).toUpperCase()}${nombre.slice(1)}`;
            return anio === ar.getUTCFullYear() ? mesCap : `${mesCap} ${anio}`;
          })()}
        </span>
        <button type="button" onClick={() => mover(1)} aria-label={t.nextMonth} style={navBtn}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 3 }}>
        {DIAS_SEMANA.map((d, i) => (
          <div key={i} style={{ textAlign: "center", fontSize: 8.5, color: "var(--muted)", fontWeight: 700, letterSpacing: 0.3 }}>{d}</div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
        {celdas.map((dia, i) => {
          if (dia === null) return <div key={`v${i}`} />;
          const fecha = iso(anio, mes, dia);
          const marca = porDia.get(dia);
          const esHoy = fecha === hoyISO;
          const sel = fecha === seleccionado;
          const color = marca?.repite ? "var(--purple)" : "var(--teal)";
          return (
            <button
              key={dia}
              type="button"
              onClick={() => onSelect(fecha)}
              aria-label={fecha}
              aria-pressed={sel}
              style={{
                aspectRatio: "1", display: "flex", flexDirection: "column", cursor: "pointer",
                alignItems: "center", justifyContent: "center", gap: 2, borderRadius: 7, padding: 0,
                background: sel ? "var(--accent)" : esHoy ? "var(--surface-alt)" : "transparent",
                border: `1px solid ${sel ? "var(--accent)" : esHoy ? "var(--border)" : "transparent"}`,
                transition: "background .12s",
              }}
            >
              <span style={{
                fontSize: 10, lineHeight: 1, fontVariantNumeric: "tabular-nums",
                color: sel ? "#fff" : marca ? "var(--text)" : "var(--muted)",
                fontWeight: sel || marca ? 700 : 400, opacity: sel || marca ? 1 : 0.55,
              }}>{dia}</span>
              <span style={{
                width: 4, height: 4, borderRadius: "50%",
                background: marca ? (sel ? "#fff" : color) : "transparent",
              }} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
