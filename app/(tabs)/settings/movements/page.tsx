"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useData } from "../../data-context";
import { useAppPrefs } from "@/hooks/useAppPrefs";
import { useT } from "@/hooks/useTranslation";
import { db } from "@/services/firebase/firebase";
import { doc, setDoc, updateDoc } from "firebase/firestore";
import { dbErrorMessage } from "@/lib/firebase-error";
import type { ConfigUsuario } from "@/types";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Toggle, SubHeader } from "../_shared";

// Fila editable: nombre + switch activar/desactivar + borrar.
function ItemRow({ name, dot, activo, onToggle, onDelete }: { name: string; dot: string; activo: boolean; onToggle: () => void; onDelete: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 4px", borderBottom: "1px solid var(--faint)" }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: dot, flexShrink: 0, opacity: activo ? 1 : 0.4 }} />
      <span style={{ flex: 1, minWidth: 0, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", opacity: activo ? 1 : 0.5 }}>{name}</span>
      <Toggle activo={activo} onClick={onToggle} />
      <button onClick={onDelete} aria-label="Eliminar" style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", padding: 4, display: "flex", flexShrink: 0 }}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
      </button>
    </div>
  );
}

export default function MovementsSettings() {
  const { user } = useAuth();
  const { config, refreshConfig: refresh } = useData();
  const { monedaPrincipal } = useAppPrefs();
  const t = useT();

  const [guardando, setGuardando] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [movSub, setMovSub] = useState<"categorias" | "medios" | "origenes">("categorias");
  const [pendingDelete, setPendingDelete] = useState<{ kind: "cat" | "med" | "ori"; nombre: string } | null>(null);
  const [adding, setAdding] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoTipo, setNuevoTipo] = useState<"Gasto" | "Ingreso">("Gasto");
  const [showAutoAhorroModal, setShowAutoAhorroModal] = useState(false);
  const [localAutoMonto, setLocalAutoMonto] = useState("");
  const [localAutoMedios, setLocalAutoMedios] = useState<string[]>([]);
  const [localAutoOmitir, setLocalAutoOmitir] = useState<string[]>([]);
  const [localAutoOmitirInput, setLocalAutoOmitirInput] = useState("");

  const [localCats, setLocalCats] = useState<ConfigUsuario["categorias"]>([]);
  const [localMedios, setLocalMedios] = useState<ConfigUsuario["mediosPago"]>([]);
  const [localOrigenes, setLocalOrigenes] = useState<ConfigUsuario["origenesAhorro"]>([]);
  const catsRef = useRef<ConfigUsuario["categorias"]>([]);
  const mediosRef = useRef<ConfigUsuario["mediosPago"]>([]);
  const origRef = useRef<ConfigUsuario["origenesAhorro"]>([]);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didInit = useRef(false);

  useEffect(() => {
    if (config && !didInit.current) {
      setLocalCats(config.categorias); setLocalMedios(config.mediosPago); setLocalOrigenes(config.origenesAhorro);
      catsRef.current = config.categorias; mediosRef.current = config.mediosPago; origRef.current = config.origenesAhorro;
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
  const persist = () => { if (!config) return; saveConfig({ ...config, categorias: catsRef.current, mediosPago: mediosRef.current, origenesAhorro: origRef.current }); };
  const scheduleSave = () => { if (saveTimer.current) clearTimeout(saveTimer.current); saveTimer.current = setTimeout(persist, 1200); };

  const toggleCat = (n: string) => { const next = catsRef.current.map(c => c.nombre === n ? { ...c, activa: !c.activa } : c); catsRef.current = next; setLocalCats(next); scheduleSave(); };
  const toggleMed = (n: string) => { const next = mediosRef.current.map(m => m.nombre === n ? { ...m, activo: !m.activo } : m); mediosRef.current = next; setLocalMedios(next); scheduleSave(); };
  const toggleOri = (n: string) => { const next = origRef.current.map(o => o.nombre === n ? { ...o, activo: !o.activo } : o); origRef.current = next; setLocalOrigenes(next); scheduleSave(); };

  const delCat = (n: string) => { const next = catsRef.current.filter(c => c.nombre !== n); catsRef.current = next; setLocalCats(next); setPendingDelete(null); persist(); };
  const delMed = (n: string) => { const next = mediosRef.current.filter(m => m.nombre !== n); mediosRef.current = next; setLocalMedios(next); setPendingDelete(null); persist(); };
  const delOri = (n: string) => { const next = origRef.current.filter(o => o.nombre !== n); origRef.current = next; setLocalOrigenes(next); setPendingDelete(null); persist(); };
  const confirmDelete = () => { if (!pendingDelete) return; if (pendingDelete.kind === "cat") delCat(pendingDelete.nombre); else if (pendingDelete.kind === "med") delMed(pendingDelete.nombre); else delOri(pendingDelete.nombre); };

  const agregar = () => {
    const nombre = nuevoNombre.trim();
    if (!nombre || !config) return;
    if (movSub === "categorias") { const next = [...catsRef.current, { id: nombre, nombre, tipo: nuevoTipo, activa: true }]; catsRef.current = next; setLocalCats(next); }
    else if (movSub === "medios") { const next = [...mediosRef.current, { id: nombre, nombre, activo: true }]; mediosRef.current = next; setLocalMedios(next); }
    else { const next = [...origRef.current, { id: nombre, nombre, activo: true }]; origRef.current = next; setLocalOrigenes(next); }
    setNuevoNombre(""); persist();
  };

  // Auto-ahorro
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

  // Presupuesto (template por categoría) — fusionado desde la antigua sección Presupuestos.
  const [localTemplate, setLocalTemplate] = useState<Record<string, string>>({});
  const [templateSaving, setTemplateSaving] = useState(false);
  useEffect(() => {
    if (!config) return;
    const tpl = config.meta.presupuestoTemplate ?? {};
    setLocalTemplate(Object.fromEntries(Object.entries(tpl).map(([k, v]) => [k, String(v)])));
  }, [!!config]);
  const templateIsDirty = useMemo(() => {
    const saved = config?.meta.presupuestoTemplate ?? {};
    const activeCats = (config?.categorias ?? []).filter((c) => c.activa && (c.tipo === "Gasto" || c.tipo === "Ambos"));
    return activeCats.some((c) => Math.round(parseFloat(localTemplate[c.nombre] ?? "") || 0) !== Math.round(saved[c.nombre] ?? 0));
  }, [localTemplate, config?.meta.presupuestoTemplate, config?.categorias]);
  const saveTemplate = async () => {
    if (!user?.uid || !config) return;
    setTemplateSaving(true);
    try {
      const categorias: Record<string, number> = {};
      for (const [cat, val] of Object.entries(localTemplate)) { const n = parseFloat(val); if (!isNaN(n) && n > 0) categorias[cat] = n; }
      await updateDoc(doc(db, `users/${user.uid}/config/meta`), { "meta.presupuestoTemplate": categorias });
      refresh();
    } finally { setTemplateSaving(false); }
  };

  if (!config) return null;
  const presupuestoCats = config.categorias.filter((c) => c.activa && (c.tipo === "Gasto" || c.tipo === "Ambos"));
  const card: React.CSSProperties = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 16, marginBottom: 12 };
  const subs = [{ id: "categorias", label: t.categories }, { id: "medios", label: t.methods }, { id: "origenes", label: t.originsLabel }] as const;
  const closeAdd = () => { setAdding(false); setNuevoNombre(""); };

  return (
    <div className="page">
      <SubHeader title={t.settingsTabMovements} />

      <div style={card}>
        {/* Selector de sub-lista */}
        <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
          {subs.map(s => (
            <button key={s.id} onClick={() => { setMovSub(s.id); closeAdd(); }} className="pill" style={{
              flex: 1, borderColor: movSub === s.id ? "var(--accent)" : "var(--border)", background: movSub === s.id ? "var(--accent-dim)" : "transparent", color: movSub === s.id ? "var(--accent)" : "var(--muted)",
            }}>{s.label}</button>
          ))}
        </div>

        {/* Alta inline (se abre con el botón Agregar) */}
        {adding ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12, padding: 12, background: "var(--surface-alt)", borderRadius: 12, border: "1px solid var(--border)" }}>
            {movSub === "categorias" && (
              <div style={{ display: "flex", gap: 6 }}>
                {(["Gasto", "Ingreso"] as const).map(tipo => (
                  <button key={tipo} onClick={() => setNuevoTipo(tipo)} className="pill" style={{
                    flex: 1, borderColor: nuevoTipo === tipo ? (tipo === "Gasto" ? "var(--red)" : "var(--green)") : "var(--border)",
                    background: nuevoTipo === tipo ? (tipo === "Gasto" ? "var(--red-dim)" : "var(--green-dim)") : "transparent",
                    color: nuevoTipo === tipo ? (tipo === "Gasto" ? "var(--red)" : "var(--green)") : "var(--muted)",
                  }}>{tipo === "Gasto" ? t.expenseType : t.incomeType}</button>
                ))}
              </div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <input autoFocus value={nuevoNombre} onChange={e => setNuevoNombre(e.target.value)} onKeyDown={e => { if (e.key === "Enter") agregar(); }}
                placeholder={movSub === "categorias" ? t.newCategory : movSub === "medios" ? t.newMethod : t.newOrigin} className="input" style={{ flex: 1 }} />
              <button onClick={agregar} disabled={!nuevoNombre.trim()} aria-label={t.add} style={{ flexShrink: 0, width: 44, borderRadius: "var(--radius-sm)", border: "none", background: nuevoNombre.trim() ? "var(--green)" : "var(--surface)", color: nuevoNombre.trim() ? "var(--bg)" : "var(--muted)", cursor: nuevoNombre.trim() ? "pointer" : "default", fontSize: 22, lineHeight: 1 }}>+</button>
              <button onClick={closeAdd} aria-label={t.cancel} style={{ flexShrink: 0, width: 44, borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "transparent", color: "var(--muted)", cursor: "pointer", fontSize: 18, lineHeight: 1 }}>×</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAdding(true)} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", padding: "10px 0", marginBottom: 8, borderRadius: 10, border: "1px dashed var(--border-hi)", background: "transparent", color: "var(--accent)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            {t.add}
          </button>
        )}

        {/* Lista */}
        {movSub === "origenes" && <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>{t.shownWhenAddingIncomeSavings}</div>}
        {movSub === "categorias" && [...localCats].sort((a, b) => a.tipo === b.tipo ? 0 : a.tipo === "Gasto" ? -1 : 1).map(c => (
          <ItemRow key={c.nombre} name={c.nombre} dot={c.tipo === "Gasto" ? "var(--red)" : "var(--green)"} activo={c.activa} onToggle={() => toggleCat(c.nombre)} onDelete={() => setPendingDelete({ kind: "cat", nombre: c.nombre })} />
        ))}
        {movSub === "medios" && localMedios.map(m => (
          <ItemRow key={m.nombre} name={m.nombre} dot="var(--blue)" activo={m.activo} onToggle={() => toggleMed(m.nombre)} onDelete={() => setPendingDelete({ kind: "med", nombre: m.nombre })} />
        ))}
        {movSub === "origenes" && localOrigenes.map(o => (
          <ItemRow key={o.nombre} name={o.nombre} dot="var(--green)" activo={o.activo} onToggle={() => toggleOri(o.nombre)} onDelete={() => setPendingDelete({ kind: "ori", nombre: o.nombre })} />
        ))}
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
                return <button key={m.nombre} type="button" onClick={() => setLocalAutoMedios(sel ? localAutoMedios.filter(x => x !== m.nombre) : [...localAutoMedios, m.nombre])} className="pill" style={{ borderColor: sel ? "var(--blue)" : "var(--border)", background: sel ? "var(--blue-dim)" : "transparent", color: sel ? "var(--blue)" : "var(--muted)" }}>{m.nombre}</button>;
              })}
            </div>
          </div>
          <div>
            <div className="label" style={{ marginBottom: 8 }}>{t.descriptionsToSkip}</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <input value={localAutoOmitirInput} onChange={e => setLocalAutoOmitirInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && localAutoOmitirInput.trim()) { const val = localAutoOmitirInput.trim(); if (!localAutoOmitir.includes(val)) setLocalAutoOmitir([...localAutoOmitir, val]); setLocalAutoOmitirInput(""); } }}
                placeholder={t.egPlaceholder} style={{ flex: 1, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "8px 12px", fontSize: 13, color: "var(--text)" }} />
              <button type="button" onClick={() => { const val = localAutoOmitirInput.trim(); if (val && !localAutoOmitir.includes(val)) setLocalAutoOmitir([...localAutoOmitir, val]); setLocalAutoOmitirInput(""); }} style={{ background: "none", border: "none", color: "var(--green)", fontSize: 26, fontWeight: 300, cursor: "pointer", padding: "0 8px", lineHeight: 1 }}>+</button>
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
            <button onClick={confirmAutoAhorro} disabled={!canConfirmAutoAhorro || guardando} style={{ width: 56, height: 56, borderRadius: "50%", background: canConfirmAutoAhorro ? "var(--green)" : "transparent", border: `2px solid ${canConfirmAutoAhorro ? "var(--green)" : "var(--border)"}`, color: canConfirmAutoAhorro ? "var(--bg)" : "var(--border)", display: "flex", alignItems: "center", justifyContent: "center", cursor: canConfirmAutoAhorro ? "pointer" : "default", opacity: guardando ? 0.5 : 1 }}>
              {guardando
                ? <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="spin"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" strokeDasharray="28 56" /></svg>
                : <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            </button>
          </div>
        </div>
      </BottomSheet>

      {/* Presupuesto (template por categoría) */}
      <div style={card}>
        <div className="label" style={{ marginBottom: 4 }}>{t.budgetTemplate}</div>
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 16 }}>{t.budgetTemplateSub}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
          {presupuestoCats.map((c) => (
            <div key={c.nombre} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ flex: 1, fontSize: 13, color: "var(--text)" }}>{c.nombre}</span>
              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <span style={{ position: "absolute", left: 10, fontSize: 13, color: "var(--muted)", pointerEvents: "none" }}>$</span>
                <input type="number" inputMode="numeric" value={localTemplate[c.nombre] ?? ""} onChange={(e) => setLocalTemplate((prev) => ({ ...prev, [c.nombre]: e.target.value }))} placeholder="0" className="input" style={{ width: 130, paddingLeft: 22, textAlign: "right", fontFamily: "var(--font-mono)" }} />
              </div>
            </div>
          ))}
        </div>
        <button onClick={saveTemplate} disabled={templateSaving || !templateIsDirty} style={{ width: "100%", padding: "12px 0", borderRadius: "var(--radius-sm)", background: "var(--accent)", border: "none", color: "#fff", fontSize: 14, fontWeight: 700, cursor: (templateSaving || !templateIsDirty) ? "default" : "pointer", opacity: (templateSaving || !templateIsDirty) ? 0.35 : 1 }}>
          {templateSaving ? "…" : t.save}
        </button>
      </div>

      {pendingDelete && (
        <ConfirmModal title={t.delete} confirmLabel={t.yesDelete} cancelLabel={t.cancel} confirmColor="var(--red)" onConfirm={confirmDelete} onCancel={() => setPendingDelete(null)}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>{pendingDelete.nombre}</div>
            <div>{t.actionIrreversible}</div>
          </div>
        </ConfirmModal>
      )}

      {saveMsg && (
        <div className="fade-up" style={{ position: "fixed", left: 16, right: 16, bottom: "calc(var(--nav-h) + 16px)", zIndex: 150, padding: "12px 16px", borderRadius: "var(--radius-sm)", fontSize: 13, background: saveMsg.ok ? "var(--green-dim)" : "var(--red-dim)", border: `1px solid ${saveMsg.ok ? "var(--green)" : "var(--red)"}44`, color: saveMsg.ok ? "var(--green)" : "var(--red)", textAlign: "center", backdropFilter: "blur(8px)" }}>{saveMsg.text}</div>
      )}
    </div>
  );
}
