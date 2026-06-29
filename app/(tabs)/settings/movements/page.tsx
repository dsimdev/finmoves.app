"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useData } from "../../data-context";
import { useAppPrefs } from "@/hooks/useAppPrefs";
import { useT } from "@/hooks/useTranslation";
import { db } from "@/services/firebase/firebase";
import { doc, setDoc } from "firebase/firestore";
import { dbErrorMessage } from "@/lib/firebase-error";
import type { ConfigUsuario } from "@/types";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Toggle, Chip, SubHeader } from "../_shared";

export default function MovementsSettings() {
  const { user } = useAuth();
  const { config, refreshConfig: refresh } = useData();
  const { monedaPrincipal } = useAppPrefs();
  const t = useT();

  const [guardando, setGuardando] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoTipo, setNuevoTipo] = useState<"Gasto" | "Ingreso">("Gasto");
  const [movSub, setMovSub] = useState<"categorias" | "medios" | "origenes">("categorias");
  const [pendingDelete, setPendingDelete] = useState<{ kind: "cat" | "med" | "ori"; nombre: string } | null>(null);

  const [localCats, setLocalCats] = useState<ConfigUsuario["categorias"]>([]);
  const [localMedios, setLocalMedios] = useState<ConfigUsuario["mediosPago"]>([]);
  const [localOrigenes, setLocalOrigenes] = useState<ConfigUsuario["origenesAhorro"]>([]);
  const localCatsRef = useRef<ConfigUsuario["categorias"]>([]);
  const localMediosRef = useRef<ConfigUsuario["mediosPago"]>([]);
  const localOrigenesRef = useRef<ConfigUsuario["origenesAhorro"]>([]);
  const movSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didInit = useRef(false);

  useEffect(() => {
    if (config && !didInit.current) {
      setLocalCats(config.categorias); setLocalMedios(config.mediosPago); setLocalOrigenes(config.origenesAhorro);
      localCatsRef.current = config.categorias; localMediosRef.current = config.mediosPago; localOrigenesRef.current = config.origenesAhorro;
      didInit.current = true;
    }
  }, [config]);

  const saveConfig = async (newConfig: typeof config) => {
    if (!user?.uid || !newConfig) return;
    setGuardando(true);
    try { await setDoc(doc(db, `users/${user.uid}/config/meta`), newConfig); refresh(); }
    catch (err) { setSaveMsg({ ok: false, text: dbErrorMessage(err, t) }); setTimeout(() => setSaveMsg(null), 3000); }
    finally { setGuardando(false); }
  };

  const scheduleMovSave = (cfg: ConfigUsuario) => {
    if (movSaveTimer.current) clearTimeout(movSaveTimer.current);
    movSaveTimer.current = setTimeout(() => {
      saveConfig({ ...cfg, categorias: localCatsRef.current, mediosPago: localMediosRef.current, origenesAhorro: localOrigenesRef.current });
    }, 1500);
  };

  const toggleCategoriaLocal = (nombre: string) => { if (!config) return; const next = localCatsRef.current.map(c => c.nombre === nombre ? { ...c, activa: !c.activa } : c); localCatsRef.current = next; setLocalCats(next); scheduleMovSave(config); };
  const toggleMedioLocal = (nombre: string) => { if (!config) return; const next = localMediosRef.current.map(m => m.nombre === nombre ? { ...m, activo: !m.activo } : m); localMediosRef.current = next; setLocalMedios(next); scheduleMovSave(config); };
  const toggleOrigenLocal = (nombre: string) => { if (!config) return; const next = localOrigenesRef.current.map(o => o.nombre === nombre ? { ...o, activo: !o.activo } : o); localOrigenesRef.current = next; setLocalOrigenes(next); scheduleMovSave(config); };

  const agregarCategoriaLocal = () => { if (!nuevoNombre.trim() || !config) return; const next = [...localCatsRef.current, { id: nuevoNombre, nombre: nuevoNombre.trim(), tipo: nuevoTipo, activa: true }]; localCatsRef.current = next; setLocalCats(next); setNuevoNombre(""); saveConfig({ ...config, categorias: next, mediosPago: localMediosRef.current, origenesAhorro: localOrigenesRef.current }); };
  const agregarMedioLocal = () => { if (!nuevoNombre.trim() || !config) return; const next = [...localMediosRef.current, { id: nuevoNombre, nombre: nuevoNombre.trim(), activo: true }]; localMediosRef.current = next; setLocalMedios(next); setNuevoNombre(""); saveConfig({ ...config, categorias: localCatsRef.current, mediosPago: next, origenesAhorro: localOrigenesRef.current }); };
  const agregarOrigenLocal = () => { if (!nuevoNombre.trim() || !config) return; const next = [...localOrigenesRef.current, { id: nuevoNombre, nombre: nuevoNombre.trim(), activo: true }]; localOrigenesRef.current = next; setLocalOrigenes(next); setNuevoNombre(""); saveConfig({ ...config, categorias: localCatsRef.current, mediosPago: localMediosRef.current, origenesAhorro: next }); };

  const eliminarCategoriaLocal = (nombre: string) => { if (!config) return; const next = localCatsRef.current.filter(c => c.nombre !== nombre); localCatsRef.current = next; setLocalCats(next); setPendingDelete(null); saveConfig({ ...config, categorias: next, mediosPago: localMediosRef.current, origenesAhorro: localOrigenesRef.current }); };
  const eliminarMedioLocal = (nombre: string) => { if (!config) return; const next = localMediosRef.current.filter(m => m.nombre !== nombre); localMediosRef.current = next; setLocalMedios(next); setPendingDelete(null); saveConfig({ ...config, categorias: localCatsRef.current, mediosPago: next, origenesAhorro: localOrigenesRef.current }); };
  const eliminarOrigenLocal = (nombre: string) => { if (!config) return; const next = localOrigenesRef.current.filter(o => o.nombre !== nombre); localOrigenesRef.current = next; setLocalOrigenes(next); setPendingDelete(null); saveConfig({ ...config, categorias: localCatsRef.current, mediosPago: localMediosRef.current, origenesAhorro: next }); };
  const confirmPendingDelete = () => { if (!pendingDelete) return; if (pendingDelete.kind === "cat") eliminarCategoriaLocal(pendingDelete.nombre); else if (pendingDelete.kind === "med") eliminarMedioLocal(pendingDelete.nombre); else eliminarOrigenLocal(pendingDelete.nombre); };

  // Auto-ahorro
  const [showAutoAhorroModal, setShowAutoAhorroModal] = useState(false);
  const [localAutoMonto, setLocalAutoMonto] = useState("");
  const [localAutoMedios, setLocalAutoMedios] = useState<string[]>([]);
  const [localAutoOmitir, setLocalAutoOmitir] = useState<string[]>([]);
  const [localAutoOmitirInput, setLocalAutoOmitirInput] = useState("");
  const openAutoAhorroModal = () => {
    if (!config) return;
    setLocalAutoMonto(config.meta.autoAhorro?.monto?.toString() ?? "");
    setLocalAutoMedios(config.meta.autoAhorro?.mediosPago ?? config.mediosPago.filter(m => m.activo).map(m => m.nombre));
    setLocalAutoOmitir(config.meta.autoAhorro?.omitirDescripciones ?? []);
    setLocalAutoOmitirInput(""); setShowAutoAhorroModal(true);
  };
  const handleToggleAutoAhorro = () => {
    if (!config) return;
    if (config.meta.autoAhorro?.activo) saveConfig({ ...config, meta: { ...config.meta, autoAhorro: { ...config.meta.autoAhorro, activo: false } } });
    else openAutoAhorroModal();
  };
  const confirmAutoAhorro = () => {
    if (!config) return;
    const monto = parseFloat(localAutoMonto) || 0;
    if (monto <= 0 || localAutoMedios.length === 0) return;
    saveConfig({ ...config, meta: { ...config.meta, autoAhorro: { activo: true, monto, mediosPago: localAutoMedios, omitirDescripciones: localAutoOmitir } } });
    setShowAutoAhorroModal(false);
  };
  const canConfirmAutoAhorro = (() => {
    const monto = parseFloat(localAutoMonto) || 0;
    if (monto <= 0 || localAutoMedios.length === 0) return false;
    const saved = config?.meta.autoAhorro;
    const montoChanged = monto !== (saved?.monto ?? 0);
    const mediosChanged = JSON.stringify([...localAutoMedios].sort()) !== JSON.stringify([...(saved?.mediosPago ?? [])].sort());
    const omitirChanged = JSON.stringify([...localAutoOmitir].sort()) !== JSON.stringify([...(saved?.omitirDescripciones ?? [])].sort());
    return montoChanged || mediosChanged || omitirChanged || !saved?.activo;
  })();

  if (!config) return null;
  const card: React.CSSProperties = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 16, marginBottom: 12 };
  const addBtn: React.CSSProperties = { background: "none", border: "none", color: "var(--green)", fontSize: 26, fontWeight: 300, cursor: "pointer", padding: "0 8px", lineHeight: 1 };

  return (
    <div className="page">
      <SubHeader title={t.settingsTabMovements} />

      <div style={card}>
        <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
          {([{ id: "categorias", label: t.categories }, { id: "medios", label: t.methods }, { id: "origenes", label: t.originsLabel }] as const).map(s => (
            <button key={s.id} onClick={() => { setMovSub(s.id); setNuevoNombre(""); }} className="pill" style={{
              borderColor: movSub === s.id ? "var(--accent)" : "var(--border)", background: movSub === s.id ? "var(--accent-dim)" : "transparent", color: movSub === s.id ? "var(--accent)" : "var(--muted)",
            }}>{s.label}</button>
          ))}
        </div>

        {movSub === "categorias" && (
          <div>
            <div style={{ marginBottom: 14, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", gap: 6 }}>
                {(["Gasto", "Ingreso"] as const).map(tipo => (
                  <button key={tipo} onClick={() => setNuevoTipo(tipo)} className="pill" style={{
                    borderColor: nuevoTipo === tipo ? (tipo === "Gasto" ? "var(--red)" : "var(--green)") : "var(--border)",
                    background: nuevoTipo === tipo ? (tipo === "Gasto" ? "var(--red-dim)" : "var(--green-dim)") : "transparent",
                    color: nuevoTipo === tipo ? (tipo === "Gasto" ? "var(--red)" : "var(--green)") : "var(--muted)",
                  }}>{tipo === "Gasto" ? t.expenseType : t.incomeType}</button>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <input value={nuevoNombre} onChange={e => setNuevoNombre(e.target.value)} placeholder={t.newCategory} className="input" style={{ flex: 1 }} />
                <button onClick={agregarCategoriaLocal} style={addBtn}>+</button>
              </div>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {[...localCats].sort((a, b) => a.tipo === b.tipo ? 0 : a.tipo === "Gasto" ? -1 : 1).map(c => (
                <Chip key={c.nombre} label={c.nombre} colorVar={c.tipo === "Gasto" ? "var(--red)" : "var(--green)"} dimVar={c.tipo === "Gasto" ? "var(--red-dim)" : "var(--green-dim)"} activo={c.activa} confirming={false}
                  onToggle={() => toggleCategoriaLocal(c.nombre)} onLongPress={() => setPendingDelete({ kind: "cat", nombre: c.nombre })} onConfirmDelete={() => eliminarCategoriaLocal(c.nombre)} />
              ))}
            </div>
            <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 12 }}>{t.chipHint}</div>
          </div>
        )}

        {movSub === "medios" && (
          <div>
            <div style={{ marginBottom: 14, display: "flex", gap: 8 }}>
              <input value={nuevoNombre} onChange={e => setNuevoNombre(e.target.value)} placeholder={t.newMethod} className="input" style={{ flex: 1 }} />
              <button onClick={agregarMedioLocal} style={addBtn}>+</button>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {localMedios.map(m => (
                <Chip key={m.nombre} label={m.nombre} colorVar="var(--blue)" dimVar="var(--blue-dim)" activo={m.activo} confirming={false}
                  onToggle={() => toggleMedioLocal(m.nombre)} onLongPress={() => setPendingDelete({ kind: "med", nombre: m.nombre })} onConfirmDelete={() => eliminarMedioLocal(m.nombre)} />
              ))}
            </div>
            <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 12 }}>{t.chipHint}</div>
          </div>
        )}

        {movSub === "origenes" && (
          <div>
            <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 12 }}>{t.shownWhenAddingIncomeSavings}</div>
            <div style={{ marginBottom: 14, display: "flex", gap: 8 }}>
              <input value={nuevoNombre} onChange={e => setNuevoNombre(e.target.value)} placeholder={t.newOrigin} className="input" style={{ flex: 1 }} />
              <button onClick={agregarOrigenLocal} style={addBtn}>+</button>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {localOrigenes.map(o => (
                <Chip key={o.nombre} label={o.nombre} colorVar="var(--green)" dimVar="var(--green-dim)" activo={o.activo} confirming={false}
                  onToggle={() => toggleOrigenLocal(o.nombre)} onLongPress={() => setPendingDelete({ kind: "ori", nombre: o.nombre })} onConfirmDelete={() => eliminarOrigenLocal(o.nombre)} />
              ))}
            </div>
            <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 12 }}>{t.chipHint}</div>
          </div>
        )}
      </div>

      {/* Auto-ahorro */}
      <div style={{ ...card, display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ flex: 1, cursor: config.meta.autoAhorro?.activo ? "pointer" : "default" }} onClick={config.meta.autoAhorro?.activo ? openAutoAhorroModal : undefined}>
          <div style={{ fontSize: 14, fontWeight: 500 }}>{t.autoSavings}</div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
            {config.meta.autoAhorro?.activo && config.meta.autoAhorro.monto > 0 ? (() => {
              const sym = monedaPrincipal === "USD" ? "U$D" : monedaPrincipal === "EUR" ? "€" : "$";
              const monto = `${sym}${config.meta.autoAhorro.monto.toLocaleString("es-AR")} por gasto`;
              const medios = config.meta.autoAhorro.mediosPago ?? [];
              const allActive = config.mediosPago.filter(m => m.activo).map(m => m.nombre);
              const mediosStr = medios.length === 0 || medios.length === allActive.length ? t.allMethods : medios.join(" + ");
              const omitir = config.meta.autoAhorro.omitirDescripciones ?? [];
              const omitirStr = omitir.length > 0 ? ` · ${t.skipPrefix} ${omitir.join(", ")}` : "";
              return `${monto} · ${mediosStr}${omitirStr}`;
            })() : t.setsFixedAmount}
          </div>
        </div>
        <Toggle activo={config.meta.autoAhorro?.activo ?? false} onClick={handleToggleAutoAhorro} />
      </div>

      {pendingDelete && (
        <ConfirmModal title={t.delete} confirmLabel={t.yesDelete} cancelLabel={t.cancel} confirmColor="var(--red)" onConfirm={confirmPendingDelete} onCancel={() => setPendingDelete(null)}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>{pendingDelete.nombre}</div>
            <div>{t.actionIrreversible}</div>
          </div>
        </ConfirmModal>
      )}

      <BottomSheet open={showAutoAhorroModal} onClose={() => setShowAutoAhorroModal(false)} title={t.autoSavings}>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div>
            <div className="label" style={{ marginBottom: 8 }}>{t.autoSavingsAmountPerExpense(monedaPrincipal === "USD" ? "U$D" : monedaPrincipal === "EUR" ? "€" : "$")}</div>
            <input type="number" value={localAutoMonto} placeholder="0" className="input" style={{ fontFamily: "var(--font-mono)", fontSize: 15 }} onChange={e => setLocalAutoMonto(e.target.value)} />
          </div>
          <div>
            <div className="label" style={{ marginBottom: 8 }}>{t.appliedPaymentMethods}</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {config.mediosPago.filter(m => m.activo).map(m => {
                const sel = localAutoMedios.includes(m.nombre);
                return (
                  <button key={m.nombre} type="button" onClick={() => setLocalAutoMedios(sel ? localAutoMedios.filter(x => x !== m.nombre) : [...localAutoMedios, m.nombre])} className="pill" style={{
                    borderColor: sel ? "var(--blue)" : "var(--border)", background: sel ? "var(--blue-dim)" : "transparent", color: sel ? "var(--blue)" : "var(--muted)",
                  }}>{m.nombre}</button>
                );
              })}
            </div>
          </div>
          <div>
            <div className="label" style={{ marginBottom: 8 }}>{t.descriptionsToSkip}</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <input value={localAutoOmitirInput} onChange={e => setLocalAutoOmitirInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && localAutoOmitirInput.trim()) { const val = localAutoOmitirInput.trim(); if (!localAutoOmitir.includes(val)) setLocalAutoOmitir([...localAutoOmitir, val]); setLocalAutoOmitirInput(""); } }}
                placeholder={t.egPlaceholder} style={{ flex: 1, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "8px 12px", fontSize: 13, color: "var(--text)" }} />
              <button type="button" onClick={() => { const val = localAutoOmitirInput.trim(); if (val && !localAutoOmitir.includes(val)) setLocalAutoOmitir([...localAutoOmitir, val]); setLocalAutoOmitirInput(""); }} style={addBtn}>+</button>
            </div>
            {localAutoOmitir.length > 0 && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {localAutoOmitir.map(d => (
                  <div key={d} style={{ display: "flex", alignItems: "center", gap: 4, background: "var(--red-dim)", border: "1px solid var(--red)33", borderRadius: 999, padding: "3px 10px" }}>
                    <span style={{ fontSize: 12 }}>{d}</span>
                    <button type="button" onClick={() => setLocalAutoOmitir(localAutoOmitir.filter(x => x !== d))} style={{ background: "none", border: "none", color: "var(--red)", cursor: "pointer", fontSize: 14, padding: 0, lineHeight: 1 }}>×</button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={{ display: "flex", justifyContent: "center", marginTop: 4 }}>
            <button onClick={confirmAutoAhorro} disabled={!canConfirmAutoAhorro || guardando} style={{
              width: 56, height: 56, borderRadius: "50%", background: canConfirmAutoAhorro ? "var(--green)" : "transparent",
              border: `2px solid ${canConfirmAutoAhorro ? "var(--green)" : "var(--border)"}`, color: canConfirmAutoAhorro ? "var(--bg)" : "var(--border)",
              display: "flex", alignItems: "center", justifyContent: "center", cursor: canConfirmAutoAhorro ? "pointer" : "default", opacity: guardando ? 0.5 : 1,
            }}>
              {guardando
                ? <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="spin"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" strokeDasharray="28 56" /></svg>
                : <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            </button>
          </div>
        </div>
      </BottomSheet>

      {saveMsg && (
        <div className="fade-up" style={{ position: "fixed", left: 16, right: 16, bottom: "calc(var(--nav-h) + 16px)", zIndex: 150, padding: "12px 16px", borderRadius: "var(--radius-sm)", fontSize: 13, background: saveMsg.ok ? "var(--green-dim)" : "var(--red-dim)", border: `1px solid ${saveMsg.ok ? "var(--green)" : "var(--red)"}44`, color: saveMsg.ok ? "var(--green)" : "var(--red)", textAlign: "center", backdropFilter: "blur(8px)" }}>{saveMsg.text}</div>
      )}
    </div>
  );
}
