"use client";

import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useData } from "../../data-context";
import { useT } from "@/hooks/useTranslation";
import { db } from "@/services/firebase/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { SubHeader } from "../_shared";

export default function BudgetsSettings() {
  const { user } = useAuth();
  const { config, refreshConfig: refresh } = useData();
  const t = useT();
  const [localTemplate, setLocalTemplate] = useState<Record<string, string>>({});
  const [templateSaving, setTemplateSaving] = useState(false);

  useEffect(() => {
    if (!config) return;
    const tpl = config.meta.presupuestoTemplate ?? {};
    setLocalTemplate(Object.fromEntries(Object.entries(tpl).map(([k, v]) => [k, String(v)])));
  }, [!!config]);

  const templateIsDirty = useMemo(() => {
    const saved = config?.meta.presupuestoTemplate ?? {};
    const activeCats = (config?.categorias ?? []).filter(c => c.activa && (c.tipo === "Gasto" || c.tipo === "Ambos"));
    return activeCats.some(c => {
      const localVal = Math.round(parseFloat(localTemplate[c.nombre] ?? "") || 0);
      const savedVal = Math.round(saved[c.nombre] ?? 0);
      return localVal !== savedVal;
    });
  }, [localTemplate, config?.meta.presupuestoTemplate, config?.categorias]);

  const saveTemplate = async () => {
    if (!user?.uid || !config) return;
    setTemplateSaving(true);
    try {
      const categorias: Record<string, number> = {};
      for (const [cat, val] of Object.entries(localTemplate)) {
        const n = parseFloat(val);
        if (!isNaN(n) && n > 0) categorias[cat] = n;
      }
      await updateDoc(doc(db, `users/${user.uid}/config/meta`), { "meta.presupuestoTemplate": categorias });
      refresh();
    } finally { setTemplateSaving(false); }
  };

  if (!config) return null;
  const activeCats = config.categorias.filter(c => c.activa && (c.tipo === "Gasto" || c.tipo === "Ambos"));

  return (
    <div className="page">
      <SubHeader title={t.settingsTabBudgets} />
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 16 }}>
        <div className="label" style={{ marginBottom: 4 }}>{t.budgetTemplate}</div>
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 16 }}>{t.budgetTemplateSub}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
          {activeCats.map(c => (
            <div key={c.nombre} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ flex: 1, fontSize: 13, color: "var(--text)" }}>{c.nombre}</span>
              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <span style={{ position: "absolute", left: 10, fontSize: 13, color: "var(--muted)", pointerEvents: "none" }}>$</span>
                <input type="number" inputMode="numeric" value={localTemplate[c.nombre] ?? ""} onChange={e => setLocalTemplate(prev => ({ ...prev, [c.nombre]: e.target.value }))} placeholder="0" className="input" style={{ width: 130, paddingLeft: 22, textAlign: "right", fontFamily: "var(--font-mono)" }} />
              </div>
            </div>
          ))}
        </div>
        <button onClick={saveTemplate} disabled={templateSaving || !templateIsDirty} style={{ width: "100%", padding: "12px 0", borderRadius: "var(--radius-sm)", background: "var(--accent)", border: "none", color: "#fff", fontSize: 14, fontWeight: 700, cursor: (templateSaving || !templateIsDirty) ? "default" : "pointer", opacity: (templateSaving || !templateIsDirty) ? 0.35 : 1 }}>
          {templateSaving ? "…" : t.save}
        </button>
      </div>
    </div>
  );
}
