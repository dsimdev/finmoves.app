"use client";

import { useEffect, useState, useCallback, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useT } from "@/hooks/useTranslation";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { SwipeToDelete } from "@/components/ui/SwipeToDelete";
import { listarNotificaciones, marcarLeida, eliminarNotificacion, marcarTodasLeidas, type Notificacion, type NotifTipo } from "@/services/firebase/notificaciones";

// Ícono + color por tipo de notificación.
const META: Record<NotifTipo, { color: string; icon: ReactNode }> = {
  dolar: { color: "var(--yellow)", icon: <path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /> },
  version: { color: "var(--blue)", icon: <><path d="M12 2l2.4 7.4H22l-6 4.6 2.3 7.4-6.3-4.6L5.7 21 8 14 2 9.4h7.6z" /></> },
  recurrente: { color: "var(--purple)", icon: <><path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16" /></> },
  sueldo: { color: "var(--green)", icon: <><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /></> },
  carga: { color: "var(--teal)", icon: <><path d="M12 5v14M5 12h14" /></> },
  meta: { color: "var(--green)", icon: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="0.5" /></> },
  recordatorio: { color: "var(--blue)", icon: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></> },
  permiso: { color: "var(--teal)", icon: <><path d="M9 12l2 2 4-4" /><path d="M12 2l7 4v6c0 5-3.5 8-7 10-3.5-2-7-5-7-10V6z" /></> },
  sync: { color: "var(--blue)", icon: <><path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16" /></> },
  baja: { color: "var(--red)", icon: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></> },
};

const hace = (ms: number): string => {
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60) return "recién";
  const m = Math.floor(s / 60); if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60); if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24); if (d < 7) return `hace ${d} d`;
  return new Date(ms).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
};

// Fila con swipe a la izquierda → tacho para eliminar (SwipeToDelete). Tap → abre.
function Row({ n, onOpen, onDelete, deleteLabel }: { n: Notificacion; onOpen: () => void; onDelete: () => void; deleteLabel: string }) {
  const meta = META[n.tipo] ?? META.recordatorio;

  return (
    <SwipeToDelete onDelete={onDelete} deleteLabel={deleteLabel} radius={12}>
      <button
        onClick={onOpen}
        style={{
          width: "100%", display: "flex", alignItems: "flex-start", gap: 11, textAlign: "left", cursor: "pointer",
          padding: "12px 13px", borderRadius: 12, border: "1px solid var(--border)",
          background: n.leida ? "var(--surface)" : "var(--surface-alt)",
        }}
      >
        <span style={{ width: 32, height: 32, borderRadius: 9, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: `color-mix(in srgb, ${meta.color} 15%, transparent)`, border: `1px solid color-mix(in srgb, ${meta.color} 40%, transparent)` }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={meta.color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{meta.icon}</svg>
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{n.title}</span>
            {!n.leida && <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--accent)", flexShrink: 0 }} />}
          </span>
          <span style={{ display: "block", fontSize: 12, color: "var(--muted)", marginTop: 2, lineHeight: 1.4 }}>{n.body}</span>
          <span style={{ display: "block", fontSize: 10, color: "var(--muted)", marginTop: 4, opacity: 0.75 }}>{hace(n.createdAt)}</span>
        </span>
      </button>
    </SwipeToDelete>
  );
}

export function NotificationsBell() {
  const { user } = useAuth();
  const t = useT();
  const router = useRouter();
  const [items, setItems] = useState<Notificacion[]>([]);
  const [open, setOpen] = useState(false);

  const cargar = useCallback(() => {
    if (!user?.uid) return;
    listarNotificaciones(user.uid).then(setItems).catch(() => {});
  }, [user?.uid]);

  // Lectura única al montar (por batería, como el resto de la app). Se refresca al abrir.
  useEffect(() => { cargar(); }, [cargar]);

  const noLeidas = items.filter((n) => !n.leida).length;

  const abrirNotif = async (n: Notificacion) => {
    if (user?.uid && !n.leida) { marcarLeida(user.uid, n.id).catch(() => {}); setItems((prev) => prev.map((x) => x.id === n.id ? { ...x, leida: true } : x)); }
    setOpen(false);
    router.push(n.dest);
  };
  const eliminar = async (n: Notificacion) => {
    if (user?.uid) eliminarNotificacion(user.uid, n.id).catch(() => {});
    setItems((prev) => prev.filter((x) => x.id !== n.id));
  };
  const limpiarTodas = async () => {
    if (!user?.uid) return;
    const ids = items.filter((n) => !n.leida).map((n) => n.id);
    marcarTodasLeidas(user.uid, ids).catch(() => {});
    setItems((prev) => prev.map((x) => ({ ...x, leida: true })));
  };

  return (
    <>
      <button onClick={() => { setOpen(true); cargar(); }} aria-label={t.notifications} style={{ position: "relative", background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: 4, display: "flex" }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>
        {noLeidas > 0 && (
          <span style={{ position: "absolute", top: 0, right: 0, minWidth: 16, height: 16, padding: "0 4px", borderRadius: 8, background: "var(--red)", color: "#fff", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>{noLeidas > 9 ? "9+" : noLeidas}</span>
        )}
      </button>

      <BottomSheet open={open} onClose={() => setOpen(false)} title={t.notifications}>
        {items.length === 0 ? (
          <div style={{ textAlign: "center", color: "var(--muted)", fontSize: 13, padding: "28px 0" }}>{t.notificationsEmpty}</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {noLeidas > 0 && (
              <button onClick={limpiarTodas} style={{ alignSelf: "flex-end", background: "none", border: "none", color: "var(--accent)", fontSize: 12, fontWeight: 600, cursor: "pointer", padding: "0 2px 2px" }}>{t.markAllRead}</button>
            )}
            {items.map((n) => (
              <Row key={n.id} n={n} onOpen={() => abrirNotif(n)} onDelete={() => eliminar(n)} deleteLabel={t.delete} />
            ))}
            <div style={{ fontSize: 10, color: "var(--muted)", textAlign: "center", marginTop: 4, opacity: 0.7 }}>{t.notificationsSlideHint}</div>
          </div>
        )}
      </BottomSheet>
    </>
  );
}
