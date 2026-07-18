"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useData } from "../../data-context";
import { useTheme } from "@/hooks/useTheme";
import { useAppPrefs } from "@/hooks/useAppPrefs";
import { useT } from "@/hooks/useTranslation";
import { db } from "@/services/firebase/firebase";
import { doc, setDoc } from "firebase/firestore";
import { dbErrorMessage } from "@/lib/firebase-error";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { Toggle, SubHeader, FlagAR, FlagGB } from "../_shared";

export default function PreferencesSettings() {
  const { user } = useAuth();
  const { config, refreshConfig: refresh } = useData();
  const { dark, toggle: toggleTheme } = useTheme();
  const { showReportes, dashboardClasico, monedaPrincipal, lang, set: setPref, setMonedaPrincipal, setLang } = useAppPrefs();
  const t = useT();
  const [, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pendingLang, setPendingLang] = useState<"es" | "en" | null>(null);
  const [pendingMoneda, setPendingMoneda] = useState<"ARS" | "USD" | "EUR" | null>(null);
  const [monedaBusy, setMonedaBusy] = useState(false);

  const saveConfig = async (newConfig: typeof config) => {
    if (!user?.uid || !newConfig) return;
    try { await setDoc(doc(db, `users/${user.uid}/config/meta`), newConfig); refresh(); }
    catch (err) { setSaveMsg({ ok: false, text: dbErrorMessage(err, t) }); }
  };

  const changeMoneda = async (newMoneda: "ARS" | "USD" | "EUR") => {
    if (!user?.uid || monedaBusy || !config || newMoneda === config.meta.monedaPrincipal) return;
    setMonedaBusy(true);
    try {
      const newMeta = { ...config.meta, monedaPrincipal: newMoneda };
      // La tab Inversión ya no depende de la moneda: el usuario EUR/USD también tiene meta de
      // ahorro y patrimonio. Solo la reserva FX se limita a ARS (se gatea aparte, no acá).
      await setDoc(doc(db, `users/${user.uid}/config/meta`), { ...config, meta: newMeta });
      setMonedaPrincipal(newMoneda);
      setPendingMoneda(null);
    } catch { /* ignore */ } finally { setMonedaBusy(false); }
  };

  const row: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "14px 16px", marginBottom: 10 };
  const ic: React.CSSProperties = { width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 };

  return (
    <div className="page">
      <SubHeader title={t.preferences} />

      {/* Tema */}
      <div style={row}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ ...ic, background: dark ? "var(--surface-alt)" : "var(--yellow-dim)", border: "1px solid var(--border)" }}>
            {dark
              ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79Z" stroke="var(--muted)" strokeWidth="1.7" strokeLinejoin="round" /></svg>
              : <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="4" stroke="var(--yellow)" strokeWidth="1.7" /><path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="var(--yellow)" strokeWidth="1.7" strokeLinecap="round" /></svg>}
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>{t.darkMode}</div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{dark ? t.switchToLight : t.switchToDark}</div>
          </div>
        </div>
        <Toggle activo={dark} onClick={toggleTheme} />
      </div>

      {/* Idioma */}
      <div style={row}>
        <span style={{ fontSize: 14 }}>{t.language}</span>
        <div style={{ display: "flex", gap: 8 }}>
          {(["es", "en"] as const).map((l) => (
            <button key={l} onClick={() => { if (l !== lang) setPendingLang(l); }} aria-label={l === "es" ? "Español" : "English"}
              style={{ width: 38, height: 38, borderRadius: 10, border: `1px solid ${lang === l ? "var(--accent)44" : "var(--border)"}`, background: lang === l ? "var(--accent-dim)" : "var(--surface-alt)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", opacity: lang === l ? 1 : 0.55 }}>
              {l === "es" ? <FlagAR size={22} /> : <FlagGB size={22} />}
            </button>
          ))}
        </div>
      </div>

      {/* Moneda principal */}
      <div style={row}>
        <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ ...ic, background: "var(--green-dim)", border: "1px solid var(--green)44" }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: "var(--green)", fontFamily: "var(--font-mono)", lineHeight: 1 }}>$</span>
          </div>
          <span style={{ fontSize: 14 }}>{t.mainCurrency}</span>
        </span>
        <div style={{ display: "flex", gap: 6 }}>
          {(["ARS", "USD", "EUR"] as const).map((m) => (
            <button key={m} onClick={() => monedaPrincipal !== m && setPendingMoneda(m)} disabled={monedaPrincipal === m}
              style={{ padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: monedaPrincipal === m ? "default" : "pointer", border: `2px solid ${monedaPrincipal === m ? "var(--green)" : "var(--border)"}`, background: monedaPrincipal === m ? "var(--green-dim)" : "transparent", color: monedaPrincipal === m ? "var(--green)" : "var(--muted)", opacity: monedaPrincipal === m ? 1 : 0.6 }}>{m}</button>
          ))}
        </div>
      </div>

      {/* Dashboard clásico */}
      <div style={row}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ ...ic, background: "var(--surface-alt)", border: "1px solid var(--border)" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>{t.dashboardClasico}</div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{t.dashboardClasicoSub}</div>
          </div>
        </div>
        <Toggle activo={dashboardClasico} onClick={() => setPref("dashboardClasico", !dashboardClasico)} />
      </div>


      {/* Reportes visibles */}
      <div style={row}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ ...ic, background: showReportes ? "var(--green-dim)" : "var(--red-dim)", border: `1px solid ${showReportes ? "var(--green)44" : "var(--red)44"}` }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="2" stroke={showReportes ? "var(--green)" : "var(--red)"} strokeWidth="1.7" /><path d="M3 9h18M9 3v18" stroke={showReportes ? "var(--green)" : "var(--red)"} strokeWidth="1.7" /></svg>
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>{t.reportsSection}</div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{t.showReportsLabel}</div>
          </div>
        </div>
        <Toggle activo={showReportes} onClick={() => {
          const next = !showReportes;
          setPref("showReportes", next);
          if (config) saveConfig({ ...config, meta: { ...config.meta, showReportes: next } });
        }} />
      </div>

      {pendingLang && (
        <ConfirmModal title={t.changeLanguageTitle} confirmLabel={t.confirm} cancelLabel={t.cancel} confirmColor="var(--blue)"
          onConfirm={() => { setLang(pendingLang); window.location.href = "/"; }} onCancel={() => setPendingLang(null)}>{t.changeLanguageBody}</ConfirmModal>
      )}
      {pendingMoneda && (
        <ConfirmModal title={t.changeCurrencyTitle} confirmLabel={t.change} cancelLabel={t.cancel} confirmColor="var(--blue)" loading={monedaBusy}
          onConfirm={() => changeMoneda(pendingMoneda)} onCancel={() => setPendingMoneda(null)}>
          <div>
            <strong>{config?.meta.monedaPrincipal || "ARS"} → {pendingMoneda}</strong>
            {pendingMoneda !== "ARS" && <><br /><br /><span style={{ color: "var(--yellow)", fontWeight: 600 }}>{t.currencyDisablesInvestment}</span></>}
          </div>
        </ConfirmModal>
      )}
    </div>
  );
}
