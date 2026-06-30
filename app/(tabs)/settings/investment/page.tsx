"use client";

import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useData } from "../../data-context";
import { useAppPrefs } from "@/hooks/useAppPrefs";
import { useCotizacion } from "@/hooks/useCotizacion";
import { useT } from "@/hooks/useTranslation";
import { agruparPorPeriodo } from "@/utils/periodo";
import { parsePeriodoId } from "@/utils/reportes";
import { db } from "@/services/firebase/firebase";
import { doc, setDoc } from "firebase/firestore";
import { dbErrorMessage } from "@/lib/firebase-error";
import { Toggle, SubHeader } from "../_shared";

export default function InvestmentSettings() {
  const { user } = useAuth();
  const { config, movimientos, refreshConfig: refresh } = useData();
  const { showAhorros, monedaInversiones, monedaPrincipal, set: setPref, setMoneda } = useAppPrefs();
  const { cotizacion } = useCotizacion();
  const t = useT();

  const [guardando, setGuardando] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [metaFecha, setMetaFecha] = useState("");
  const [metaMonto, setMetaMonto] = useState("");
  const [metaSaldo, setMetaSaldo] = useState("");
  const [cotizManualOn, setCotizManualOn] = useState(false);
  const [cotizManualVal, setCotizManualVal] = useState("");

  const isOwner = !!user?.email && user.email === process.env.NEXT_PUBLIC_OWNER_EMAIL;
  const inversionAllowed = isOwner || config?.meta.permisos?.inversion === true;

  const saveConfig = async (newConfig: typeof config) => {
    if (!user?.uid || !newConfig) return;
    setGuardando(true);
    try { await setDoc(doc(db, `users/${user.uid}/config/meta`), newConfig); refresh(); }
    catch (err) { setSaveMsg({ ok: false, text: dbErrorMessage(err, t) }); setTimeout(() => setSaveMsg(null), 3000); }
    finally { setGuardando(false); }
  };

  const periodos = useMemo(() => agruparPorPeriodo(movimientos), [movimientos]);
  const totalUSD = useMemo(() => { let total = config?.meta.saldoUSD ?? 0; for (const m of movimientos) { if ((m.tipo === "CompraUSD" || m.tipo === "IngresoUSD") && m.cantidadUSD) total += m.cantidadUSD; else if ((m.tipo === "GastoUSD" || m.tipo === "VentaUSD") && m.cantidadUSD) total -= m.cantidadUSD; } return total; }, [movimientos, config?.meta.saldoUSD]);
  const totalEUR = useMemo(() => { let total = config?.meta.saldoEUR ?? 0; for (const m of movimientos) { if ((m.tipo === "CompraEUR" || m.tipo === "IngresoEUR") && m.cantidadUSD) total += m.cantidadUSD; else if ((m.tipo === "GastoEUR" || m.tipo === "VentaEUR") && m.cantidadUSD) total -= m.cantidadUSD; } return total; }, [movimientos, config?.meta.saldoEUR]);
  const totalReserva = monedaInversiones === "EUR" ? totalEUR : totalUSD;
  const tasaAuto = cotizacion ? (monedaInversiones === "EUR" ? cotizacion.oficial_euro ?? null : cotizacion.oficial) : null;
  const tasaEnUso = cotizManualOn && cotizManualVal && parseFloat(cotizManualVal) > 0 ? parseFloat(cotizManualVal) : tasaAuto;
  const seedGuardado = (monedaInversiones === "EUR" ? config?.meta.saldoEUR : config?.meta.saldoUSD)?.toString() ?? "";

  const sugeridoPorPeriodo = useMemo(() => {
    if (!metaFecha || !metaMonto || periodos.length < 2) return null;
    const meta = parseFloat(metaMonto);
    if (isNaN(meta) || meta <= 0 || totalReserva >= meta) return null;
    const fechaMeta = new Date(metaFecha + "T12:00:00");
    if (isNaN(fechaMeta.getTime())) return null;
    const hoy = new Date();
    if (fechaMeta <= hoy) return null;
    const fechasPeriodo = [...periodos].map((p) => parsePeriodoId(p.periodoId)).sort((a, b) => a.getTime() - b.getTime());
    const gaps = fechasPeriodo.slice(1).map((f, i) => f.getTime() - fechasPeriodo[i].getTime());
    const avgGapMs = gaps.reduce((s, g) => s + g, 0) / gaps.length;
    const periodosRestantes = Math.max(1, Math.round((fechaMeta.getTime() - hoy.getTime()) / avgGapMs));
    return Math.round(((meta - totalUSD) / periodosRestantes) * 100) / 100;
  }, [metaFecha, metaMonto, totalUSD, totalReserva, periodos]);

  const isDirtyAhorros = useMemo(() => {
    if (!config) return false;
    const raw = config.meta.metaFecha ?? "";
    let savedIso = raw;
    if (raw && !raw.includes("-")) { const [d, m, y] = raw.split("/").map(Number); savedIso = (d && m && y) ? `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}` : ""; }
    const savedManualOn = !!config.meta.cotizacionManualActiva;
    const savedManualVal = config.meta.cotizacionManual?.toString() ?? "";
    return metaFecha !== savedIso || metaMonto !== (config.meta.metaMonto?.toString() ?? "") || metaSaldo !== seedGuardado || cotizManualOn !== savedManualOn || (cotizManualOn && cotizManualVal !== savedManualVal);
  }, [metaFecha, metaMonto, metaSaldo, cotizManualOn, cotizManualVal, config, seedGuardado]);

  useEffect(() => {
    if (!config) return;
    const raw = config.meta.metaFecha ?? "";
    let iso = raw;
    if (raw && !raw.includes("-")) { const [d, m, y] = raw.split("/").map(Number); iso = (d && m && y) ? `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}` : ""; }
    setMetaFecha(iso);
    setMetaMonto(config.meta.metaMonto?.toString() ?? "");
    setMetaSaldo((monedaInversiones === "EUR" ? config.meta.saldoEUR : config.meta.saldoUSD)?.toString() ?? "");
    setCotizManualOn(!!config.meta.cotizacionManualActiva);
    setCotizManualVal(config.meta.cotizacionManual?.toString() ?? "");
  }, [config?.meta.metaFecha, config?.meta.metaMonto, config?.meta.cotizacionManualActiva, config?.meta.cotizacionManual, monedaInversiones]);

  const guardarMetaAhorro = async () => {
    if (!config) return;
    const newMeta = { ...config.meta };
    if (metaFecha) newMeta.metaFecha = metaFecha; else delete newMeta.metaFecha;
    if (metaMonto) newMeta.metaMonto = parseFloat(metaMonto); else delete newMeta.metaMonto;
    if (sugeridoPorPeriodo != null) newMeta.metaPorPeriodo = sugeridoPorPeriodo; else delete newMeta.metaPorPeriodo;
    if (metaSaldo && parseFloat(metaSaldo) > 0) { if (monedaInversiones === "EUR") newMeta.saldoEUR = parseFloat(metaSaldo); else newMeta.saldoUSD = parseFloat(metaSaldo); }
    else { if (monedaInversiones === "EUR") delete newMeta.saldoEUR; else delete newMeta.saldoUSD; }
    if (cotizManualOn && cotizManualVal && parseFloat(cotizManualVal) > 0) { newMeta.cotizacionManualActiva = true; newMeta.cotizacionManual = parseFloat(cotizManualVal); }
    else { delete newMeta.cotizacionManualActiva; delete newMeta.cotizacionManual; }
    newMeta.metaMoneda = "USD";
    await saveConfig({ ...config, meta: newMeta });
  };

  if (!config) return null;
  const card: React.CSSProperties = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 16, marginBottom: 12 };

  if (!inversionAllowed) {
    return (
      <div className="page">
        <SubHeader title={t.settingsTabInvestments} />
        <div style={{ ...card, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>{t.investmentsSection}</div>
      </div>
    );
  }

  return (
    <div className="page">
      <SubHeader title={t.settingsTabInvestments} />

      <div style={{ ...card, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: showAhorros ? "var(--green-dim)" : "var(--red-dim)", border: `1px solid ${showAhorros ? "var(--green)44" : "var(--red)44"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><polyline points="22 7 13.5 15.5 8.5 10.5 1 18" stroke={showAhorros ? "var(--green)" : "var(--red)"} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /><polyline points="16 7 22 7 22 13" stroke={showAhorros ? "var(--green)" : "var(--red)"} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>{t.investmentsSection}</div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{t.showInvestmentsLabel}</div>
          </div>
        </div>
        <Toggle activo={showAhorros} onClick={() => { const next = !showAhorros; setPref("showAhorros", next); saveConfig({ ...config, meta: { ...config.meta, showAhorros: next } }); }} />
      </div>

      {showAhorros && (
        <div style={card}>
          {/* Moneda de inversión */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--yellow-dim)", border: "1px solid var(--yellow)44", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: "var(--yellow)", fontFamily: "var(--font-mono)", lineHeight: 1 }}>{monedaPrincipal === "USD" ? "€" : monedaPrincipal === "EUR" ? "U$D" : (monedaInversiones === "EUR" ? "€" : "$")}</span>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{t.investmentCurrency}</div>
                {config.meta.metaMonto && <span style={{ fontSize: 10, color: "var(--muted)" }}>{t.activeGoal}</span>}
              </div>
              {monedaPrincipal === "ARS" ? (
                config.meta.metaMonto ? <div style={{ fontSize: 11, color: "var(--muted)" }}>{t.cantChangeWithGoal}</div> : (
                  <div style={{ display: "flex", gap: 6 }}>
                    {(["USD", "EUR"] as const).map((m) => (
                      <button key={m} onClick={() => { setMoneda(m); saveConfig({ ...config, meta: { ...config.meta, monedaInversiones: m } }); }} className="pill" style={{ borderColor: monedaInversiones === m ? "var(--yellow)" : "var(--border)", background: monedaInversiones === m ? "var(--yellow-dim)" : "transparent", color: monedaInversiones === m ? "var(--yellow)" : "var(--muted)" }}>{m}</button>
                    ))}
                  </div>
                )
              ) : <div style={{ fontSize: 11, color: "var(--muted)" }}>{monedaPrincipal === "USD" ? t.eurInvestments : t.usdInvestments}</div>}
            </div>
          </div>

          <div style={{ fontSize: 11, color: "var(--muted)", borderTop: "1px solid var(--faint)", paddingTop: 12, marginBottom: 12 }}>
            {t.exchangeRate}: {tasaEnUso != null ? `$${tasaEnUso.toLocaleString("es-AR")}` : "—"} ({monedaInversiones === "EUR" ? "EUR" : "USD"})
          </div>

          <div style={{ padding: "10px 14px", borderRadius: "var(--radius-sm)", background: "var(--surface-alt)", border: "1px solid var(--border)", marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{cotizManualOn ? t.rateModeManual : t.manualRateAuto}</div>
              <Toggle activo={cotizManualOn} onClick={() => setCotizManualOn((v) => !v)} />
            </div>
            {cotizManualOn && <input type="number" inputMode="decimal" value={cotizManualVal} placeholder="0" onChange={(e) => setCotizManualVal(e.target.value)} className="input" style={{ width: "100%", marginTop: 10, fontFamily: "var(--font-mono)" }} />}
          </div>

          <div style={{ marginBottom: 12 }}>
            <div className="label" style={{ marginBottom: 6 }}>{t.initialReserve(monedaInversiones === "EUR" ? "EUR" : "USD")}</div>
            <input type="number" value={metaSaldo} placeholder="0" onChange={(e) => setMetaSaldo(e.target.value)} className="input" style={{ width: "100%" }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
            <div><div className="label" style={{ marginBottom: 6 }}>{t.targetDate}</div><input type="date" value={metaFecha} onChange={(e) => setMetaFecha(e.target.value)} className="input" style={{ width: "100%" }} /></div>
            <div><div className="label" style={{ marginBottom: 6 }}>{t.targetAmount(monedaInversiones)}</div><input type="number" value={metaMonto} placeholder="0" onChange={(e) => setMetaMonto(e.target.value)} className="input" style={{ width: "100%" }} /></div>
          </div>

          <div style={{ padding: "10px 14px", borderRadius: "var(--radius-sm)", background: "var(--surface-alt)", border: "1px solid var(--border)", marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>{t.estimatedPerPeriod}</div>
            <div style={{ fontSize: 15, fontWeight: 700, fontFamily: "var(--font-mono)", color: sugeridoPorPeriodo != null ? "var(--green)" : "var(--muted)" }}>{sugeridoPorPeriodo != null ? `U$D ${sugeridoPorPeriodo.toLocaleString("es-AR")}` : "—"}</div>
          </div>

          <div style={{ position: "relative", display: "flex", justifyContent: "center", alignItems: "center", height: 52 }}>
            <button onClick={guardarMetaAhorro} disabled={!isDirtyAhorros || guardando} style={{ width: 56, height: 56, borderRadius: "50%", background: isDirtyAhorros ? "var(--green)" : "transparent", border: `2px solid ${isDirtyAhorros ? "var(--green)" : "var(--border)"}`, color: isDirtyAhorros ? "var(--bg)" : "var(--border)", display: "flex", alignItems: "center", justifyContent: "center", cursor: isDirtyAhorros ? "pointer" : "default", opacity: guardando ? 0.5 : 1 }}>
              {guardando
                ? <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="spin"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" strokeDasharray="28 56" /></svg>
                : <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            </button>
            {(metaFecha || metaMonto) && (
              <button onClick={() => { setMetaFecha(""); setMetaMonto(""); }} aria-label={t.clear} style={{ position: "absolute", right: 0, background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: 8 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><line x1="20" y1="4" x2="12" y2="12" /><path d="M12.5 11.5 6 18l3 3 6.5-6.5z" /><path d="M7 17.5 5 19.5M9 18.5 7.5 20M11 19.5 10 21" /></svg>
              </button>
            )}
          </div>
        </div>
      )}

      {saveMsg && <div className="fade-up" style={{ position: "fixed", left: 16, right: 16, bottom: "calc(var(--nav-h) + 16px)", zIndex: 150, padding: "12px 16px", borderRadius: "var(--radius-sm)", fontSize: 13, background: saveMsg.ok ? "var(--green-dim)" : "var(--red-dim)", border: `1px solid ${saveMsg.ok ? "var(--green)" : "var(--red)"}44`, color: saveMsg.ok ? "var(--green)" : "var(--red)", textAlign: "center", backdropFilter: "blur(8px)" }}>{saveMsg.text}</div>}
    </div>
  );
}
