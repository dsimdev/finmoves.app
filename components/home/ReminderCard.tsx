"use client";

import { useState } from "react";
import { CenterCard } from "@/components/ui/CenterCard";
import { useAuth } from "@/hooks/useAuth";
import { useT } from "@/hooks/useTranslation";
import { crearRecordatorio } from "@/services/firebase/recordatorios";

// Card de carga rápida de un recordatorio (texto + fecha) desde el Inicio, sin ir a
// Configuración. La cron lo manda como push cuando llega la fecha.
export function ReminderCard({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const t = useT();
  const [texto, setTexto] = useState("");
  const [fecha, setFecha] = useState("");
  const [saving, setSaving] = useState(false);

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

  return (
    <CenterCard open={open} onClose={onClose} title={t.reminderShort}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <div className="label">{t.reminderTextLabel}</div>
          <input className="input" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={t.reminderTextPlaceholder} autoFocus />
        </div>
        <div>
          <div className="label">{t.date}</div>
          <input className="input" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>
        <button type="button" onClick={guardar} disabled={!listo || saving} style={{
          height: 46, borderRadius: 12, border: "none", marginTop: 2, fontSize: 14, fontWeight: 700, cursor: listo ? "pointer" : "default",
          background: listo ? "var(--accent)" : "var(--surface-alt)", color: listo ? "#fff" : "var(--muted)", opacity: saving ? 0.6 : 1,
        }}>{t.save}</button>
      </div>
    </CenterCard>
  );
}
