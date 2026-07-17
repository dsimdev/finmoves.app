"use client";

import { useState, useEffect, useCallback } from "react";
import { CenterCard } from "@/components/ui/CenterCard";
import { useAuth } from "@/hooks/useAuth";
import { useT } from "@/hooks/useTranslation";
import { crearRecordatorio, listarRecordatorios, type Recordatorio } from "@/services/firebase/recordatorios";

// Días entre hoy (AR) y una fecha YYYY-MM-DD. Negativo = ya venció.
function diasHasta(fecha: string): number {
  const ar = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const hoy = Date.UTC(ar.getUTCFullYear(), ar.getUTCMonth(), ar.getUTCDate());
  const [y, m, d] = fecha.split("-").map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - hoy) / 86_400_000);
}

const ICON_CAL = (
  <><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></>
);

/**
 * Card de recordatorios del Inicio. Arriba, el PRÓXIMO a vencer como héroe (para ver todos
 * está Configuración → Notificaciones); abajo, el form para agregar uno nuevo.
 */
export function ReminderCard({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const t = useT();
  const [texto, setTexto] = useState("");
  const [fecha, setFecha] = useState("");
  const [saving, setSaving] = useState(false);
  const [proximo, setProximo] = useState<Recordatorio | null>(null);

  // El próximo a vencer: listarRecordatorios ya viene ordenado por fecha asc.
  const cargarProximo = useCallback(() => {
    if (!user?.uid) return;
    listarRecordatorios(user.uid).then((rs) => setProximo(rs[0] ?? null)).catch(() => {});
  }, [user?.uid]);
  useEffect(() => { if (open) cargarProximo(); }, [open, cargarProximo]);

  const guardar = async () => {
    if (!user?.uid || !texto.trim() || !fecha || saving) return;
    setSaving(true);
    try {
      await crearRecordatorio(user.uid, texto.trim(), fecha);
      setTexto(""); setFecha("");
      onClose();
    } catch { /* queda abierto para reintentar */ }
    finally { setSaving(false); }
  };

  const listo = !!texto.trim() && !!fecha;
  const dias = proximo ? diasHasta(proximo.fecha) : 0;
  const cuando = dias < 0 ? t.agendaOverdue : dias === 0 ? t.agendaToday : dias === 1 ? t.agendaTomorrow : t.agendaInDays(dias);
  // Urgencia por color: vencido rojo, hoy/mañana amarillo, más lejos teal.
  const c = dias < 0 ? "var(--red)" : dias <= 1 ? "var(--yellow)" : "var(--teal)";

  return (
    <CenterCard open={open} onClose={onClose} title={t.reminderShort}>
      {/* Héroe: el próximo a vencer. Ícono en halo + "cuándo" como protagonista. */}
      {proximo ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", marginBottom: 18 }}>
          <div style={{ width: 52, height: 52, borderRadius: 15, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 11, background: `color-mix(in srgb, ${c} 16%, transparent)`, border: `1px solid color-mix(in srgb, ${c} 45%, transparent)`, color: c }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">{ICON_CAL}</svg>
          </div>
          <div style={{ fontSize: 10, color: "var(--muted)", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 5 }}>{t.agendaNext}</div>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.3, lineHeight: 1.2, color: c }}>{cuando}</div>
          <div style={{ fontSize: 13, color: "var(--text)", marginTop: 6, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{proximo.texto}</div>
        </div>
      ) : (
        <div style={{ textAlign: "center", color: "var(--muted)", fontSize: 12.5, marginBottom: 16, lineHeight: 1.5 }}>{t.agendaEmpty}</div>
      )}

      {/* Alta de uno nuevo */}
      <div style={{ borderTop: "1px solid var(--faint)", paddingTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontSize: 10, color: "var(--muted)", letterSpacing: 1, textTransform: "uppercase" }}>{t.agendaNew}</div>
        <input className="input" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={t.reminderTextPlaceholder} autoFocus />
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "center" }}>
          <input className="input" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          <button type="button" onClick={guardar} disabled={!listo || saving} aria-label={t.save} style={{
            width: 46, height: 46, borderRadius: "50%", border: "none", flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: listo ? "var(--accent)" : "var(--surface-alt)", color: listo ? "#fff" : "var(--muted)",
            cursor: listo ? "pointer" : "default", opacity: saving ? 0.6 : 1, transition: "background .2s",
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
          </button>
        </div>
      </div>
    </CenterCard>
  );
}
