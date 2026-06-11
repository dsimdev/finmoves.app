"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@/hooks/useAuth";
import { useConfig } from "@/hooks/useConfig";
import { useAllMovimientos } from "@/hooks/useAllMovimientos";
import { useReportConfig, REPORTES_TOGGLES } from "@/hooks/useReportConfig";
import { agruparPorPeriodo } from "@/utils/periodo";
import { parsePeriodoId } from "@/utils/reportes";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { db, auth } from "@/services/firebase/firebase";
import { signOut, getIdToken } from "firebase/auth";
import { useRouter } from "next/navigation";
import type { ConfigUsuario } from "@/types";
import { formatTimestampAR, isoToFechaAR } from "@/lib/sheet-format";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { useTheme } from "@/hooks/useTheme";
import { useAppPrefs } from "@/hooks/useAppPrefs";
import { useT } from "@/hooks/useTranslation";

type Tab = "cuenta" | "movimientos" | "reportes" | "ahorros";

function Toggle({ activo, onClick }: { activo: boolean; onClick: () => void }) {
  return (
    <div onClick={onClick} style={{
      width: 44, height: 26, borderRadius: 13,
      background: activo ? "var(--accent)" : "var(--border)",
      boxShadow: activo ? "0 0 0 3px var(--accent)30" : "inset 0 1px 3px rgba(0,0,0,0.15)",
      position: "relative", cursor: "pointer",
      transition: "background .25s, box-shadow .25s", flexShrink: 0,
    }}>
      <div style={{
        position: "absolute", top: 3, left: activo ? 21 : 3,
        width: 20, height: 20, borderRadius: "50%",
        background: "#fff",
        boxShadow: "0 1px 4px rgba(0,0,0,0.25), 0 0 0 0.5px rgba(0,0,0,0.06)",
        transition: "left .22s cubic-bezier(0.34,1.56,0.64,1)",
      }} />
    </div>
  );
}


export default function ConfigPage() {
  const { user } = useAuth();
  const { config, loading, refresh } = useConfig(user?.uid);
  const { movimientos } = useAllMovimientos(user?.uid);
  const { overrides, saveAll: saveReportes } = useReportConfig();
  const router = useRouter();

  const { dark, toggle: toggleTheme } = useTheme();
  const { showReportes, showAhorros, monedaInversiones, monedaPrincipal, set: setPref, setMoneda, setMonedaPrincipal, lang, setLang } = useAppPrefs();
  const t = useT();

  const ALL_TABS: { id: Tab; label: string }[] = [
    { id: "cuenta",      label: "General" },
    { id: "movimientos", label: t.settingsTabMovements },
    { id: "ahorros",     label: t.settingsTabInvestments },
    { id: "reportes",    label: t.settingsTabReports },
  ];

  const SECCION_LABEL: Record<string, string> = {
    gastos: t.sectionExpenses,
    ingresos: t.sectionIncome,
    movimientos: t.sectionMovements,
    periodos: t.sectionPeriods,
  };

  const TABS = ALL_TABS.filter((tab) => {
    if (tab.id === "reportes" && !showReportes) return false;
    if (tab.id === "ahorros" && !showAhorros) return false;
    return true;
  });
  const [tab, setTab] = useState<Tab>("cuenta");
  useEffect(() => {
    if (!showReportes && tab === "reportes") setTab("cuenta");
  }, [showReportes, tab]);
  const [guardando, setGuardando] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoTipo, setNuevoTipo] = useState<"Gasto" | "Ingreso">("Gasto");
  const [movSub, setMovSub] = useState<"categorias" | "medios" | "origenes">("categorias");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Sync state
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [changelog, setChangelog] = useState<string | null>(null);
  const [showChangelog, setShowChangelog] = useState(false);
  const [showSyncLog, setShowSyncLog] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [syncError, setSyncError] = useState<{ message: string; at: Date } | null>(null);
  const [syncLogs, setSyncLogs] = useState<{ status: "ok" | "error"; type: "manual" | "auto"; at: Date; message: string }[]>([]);

  // ── Movimientos local state ──
  const [localCats, setLocalCats] = useState<ConfigUsuario["categorias"]>([]);
  const [localMedios, setLocalMedios] = useState<ConfigUsuario["mediosPago"]>([]);
  const [localOrigenes, setLocalOrigenes] = useState<ConfigUsuario["origenesAhorro"]>([]);
  const localCatsRef = useRef<ConfigUsuario["categorias"]>([]);
  const localMediosRef = useRef<ConfigUsuario["mediosPago"]>([]);
  const localOrigenesRef = useRef<ConfigUsuario["origenesAhorro"]>([]);
  const movSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didInitMov = useRef(false);

  useEffect(() => {
    if (config && !didInitMov.current) {
      setLocalCats(config.categorias);
      setLocalMedios(config.mediosPago);
      setLocalOrigenes(config.origenesAhorro);
      localCatsRef.current = config.categorias;
      localMediosRef.current = config.mediosPago;
      localOrigenesRef.current = config.origenesAhorro;
      didInitMov.current = true;
    }
  }, [config]);

  const isDirtyMovimientos = useMemo(() => {
    if (!config || !didInitMov.current) return false;
    return (
      JSON.stringify(localCats) !== JSON.stringify(config.categorias) ||
      JSON.stringify(localMedios) !== JSON.stringify(config.mediosPago) ||
      JSON.stringify(localOrigenes) !== JSON.stringify(config.origenesAhorro)
    );
  }, [localCats, localMedios, localOrigenes, config]);

  // ── Reportes local state — siempre en sync con overrides (localStorage) ──
  const [localReportes, setLocalReportes] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setLocalReportes(overrides);
  }, [overrides]);

  const isDirtyReportes = useMemo(() =>
    JSON.stringify(localReportes) !== JSON.stringify(overrides),
    [localReportes, overrides]
  );

  const localIsEnabled = (id: string) => localReportes[id] !== false;

  // ── Auto-ahorro modal state ──
  const [showAutoAhorroModal, setShowAutoAhorroModal] = useState(false);
  const [showExportConfirm, setShowExportConfirm] = useState(false);
  const [showGithubConfirm, setShowGithubConfirm] = useState(false);
  const [localAutoMonto, setLocalAutoMonto] = useState("");
  const [localAutoMedios, setLocalAutoMedios] = useState<string[]>([]);
  const [localAutoOmitir, setLocalAutoOmitir] = useState<string[]>([]);
  const [localAutoOmitirInput, setLocalAutoOmitirInput] = useState("");

  // ── Ahorros state ──
  const [metaFecha, setMetaFecha] = useState("");
  const [metaMonto, setMetaMonto] = useState("");

  const periodos = useMemo(() => agruparPorPeriodo(movimientos), [movimientos]);

  const totalUSD = useMemo(() => {
    const SALDO_INICIAL_USD = 5.77;
    let total = SALDO_INICIAL_USD;
    for (const m of movimientos) {
      if (m.tipo === "CompraUSD" && m.cantidadUSD) total += m.cantidadUSD;
      else if (m.tipo === "GastoUSD" && m.cantidadUSD) total -= m.cantidadUSD;
    }
    return total;
  }, [movimientos]);

  const totalEUR = useMemo(() => {
    let total = 0;
    for (const m of movimientos) {
      if (m.tipo === "CompraEUR" && m.cantidadUSD) total += m.cantidadUSD;
      else if (m.tipo === "GastoEUR" && m.cantidadUSD) total -= m.cantidadUSD;
    }
    return total;
  }, [movimientos]);

  const totalReserva = monedaInversiones === "EUR" ? totalEUR : totalUSD;
  const simboloReserva = monedaInversiones === "EUR" ? "€" : "U$D";

  const sugeridoPorPeriodo = useMemo(() => {
    if (!metaFecha || !metaMonto || periodos.length < 2) return null;
    const meta = parseFloat(metaMonto);
    if (isNaN(meta) || meta <= 0 || totalReserva >= meta) return null;
    const fechaMeta = new Date(metaFecha + "T12:00:00");
    if (isNaN(fechaMeta.getTime())) return null;
    const hoy = new Date();
    if (fechaMeta <= hoy) return null;
    const fechasPeriodo = [...periodos]
      .map((p) => parsePeriodoId(p.periodoId))
      .sort((a, b) => a.getTime() - b.getTime());
    const gaps = fechasPeriodo.slice(1).map((f, i) => f.getTime() - fechasPeriodo[i].getTime());
    const avgGapMs = gaps.reduce((sum, g) => sum + g, 0) / gaps.length;
    const msRestantes = fechaMeta.getTime() - hoy.getTime();
    const periodosRestantes = Math.max(1, Math.round(msRestantes / avgGapMs));
    return Math.round(((meta - totalUSD) / periodosRestantes) * 100) / 100;
  }, [metaFecha, metaMonto, totalUSD, periodos]);

  const isDirtyAhorros = useMemo(() => {
    if (!config) return false;
    const raw = config.meta.metaFecha ?? "";
    let savedIso = raw;
    if (raw && !raw.includes("-")) {
      const [d, m, y] = raw.split("/").map(Number);
      if (d && m && y) savedIso = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      else savedIso = "";
    }
    return metaFecha !== savedIso || metaMonto !== (config.meta.metaMonto?.toString() ?? "");
  }, [metaFecha, metaMonto, config]);

  // ── Effects ──
  useEffect(() => {
    if (!user?.uid) return;
    getDoc(doc(db, `users/${user.uid}/config/syncMeta`)).then((snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      const ts = data?.lastSync;
      if (ts?.toDate) setLastSync(ts.toDate());
      const err = data?.lastError;
      if (err?.at?.toDate) setSyncError({ message: err.message, at: err.at.toDate() });
      const rawLogs: { status: "ok" | "error"; type: "manual" | "auto"; at: { toDate?: () => Date }; message: string }[] = data?.logs ?? [];
      setSyncLogs(rawLogs.map(l => ({ ...l, at: l.at?.toDate?.() ?? new Date() })));
    });
  }, [user?.uid]);

  useEffect(() => {
    if (config) {
      const raw = config.meta.metaFecha ?? "";
      let iso = raw;
      if (raw && !raw.includes("-")) {
        const [d, m, y] = raw.split("/").map(Number);
        if (d && m && y) iso = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        else iso = "";
      }
      setMetaFecha(iso);
      setMetaMonto(config.meta.metaMonto?.toString() ?? "");
    }
  }, [config?.meta.metaFecha, config?.meta.metaMonto]);

  useEffect(() => {
    if (config?.meta.monedaPrincipal) {
      setMonedaPrincipal(config.meta.monedaPrincipal);
    }
  }, [config?.meta.monedaPrincipal]);

  // ── Helpers ──
  const saveConfig = async (newConfig: typeof config) => {
    if (!user?.uid || !newConfig) return;
    setGuardando(true);
    try {
      await setDoc(doc(db, `users/${user.uid}/config/meta`), newConfig);
      refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : t.errorSaving;
      setSaveMsg({ ok: false, text: msg });
      setTimeout(() => setSaveMsg(null), 3000);
    } finally {
      setGuardando(false);
    }
  };

  const openChangelog = async () => {
    if (!changelog) {
      const res = await fetch("/api/changelog");
      const text = await res.text();
      setChangelog(text);
    }
    setShowChangelog(true);
  };

  const exportCSV = () => {
    const header = ["Timestamp", t.csvDate, t.csvType, t.csvCategory, t.csvDescription, t.csvAmount, t.csvPaymentMethod, t.csvNotes, t.csvPeriod];
    const rows = [...movimientos]
      .sort((a, b) => a.timestampCarga.getTime() - b.timestampCarga.getTime())
      .map(m => [
        formatTimestampAR(m.timestampCarga),
        isoToFechaAR(m.fecha),
        m.tipo,
        m.categoria,
        m.descripcion ?? "",
        m.monto,
        m.medioPago ?? "",
        m.observaciones ?? "",
        m.periodoId,
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(","));
    const csv = [header.join(","), ...rows].join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `finmoves_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const appendSyncLog = async (uid: string, entry: { status: "ok" | "error"; type: "manual" | "auto"; at: Date; message: string }, prev: typeof syncLogs) => {
    const updated = [entry, ...prev].slice(0, 30);
    setSyncLogs(updated);
    await setDoc(doc(db, `users/${uid}/config/syncMeta`), { logs: updated }, { merge: true });
  };

  const handleSync = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    setSyncing(true);
    setSyncMsg(null);
    try {
      const token = await getIdToken(currentUser);
      const res = await fetch("/api/sync-sheets", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t.errorSyncing);
      const now = new Date();
      setLastSync(now);
      setSyncError(null);
      setSyncMsg({ ok: true, text: data.message });
      await appendSyncLog(currentUser.uid, { status: "ok", type: "manual", at: now, message: data.message ?? t.synced }, syncLogs);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t.errorSyncing;
      const now = new Date();
      setSyncError({ message, at: now });
      setSyncMsg({ ok: false, text: message });
      await appendSyncLog(currentUser.uid, { status: "error", type: "manual", at: now, message }, syncLogs);
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMsg(null), 4000);
    }
  };

  // ── Movimientos handlers ──
  const scheduleMovSave = (config: ConfigUsuario) => {
    if (movSaveTimer.current) clearTimeout(movSaveTimer.current);
    movSaveTimer.current = setTimeout(() => {
      saveConfig({ ...config, categorias: localCatsRef.current, mediosPago: localMediosRef.current, origenesAhorro: localOrigenesRef.current });
    }, 1500);
  };

  // Toggles: debounced (UI responde inmediato, Firestore espera 1.5s)
  const toggleCategoriaLocal = (nombre: string) => {
    if (!config) return;
    const next = localCatsRef.current.map(c => c.nombre === nombre ? { ...c, activa: !c.activa } : c);
    localCatsRef.current = next;
    setLocalCats(next);
    scheduleMovSave(config);
  };

  const toggleMedioLocal = (nombre: string) => {
    if (!config) return;
    const next = localMediosRef.current.map(m => m.nombre === nombre ? { ...m, activo: !m.activo } : m);
    localMediosRef.current = next;
    setLocalMedios(next);
    scheduleMovSave(config);
  };

  const toggleOrigenLocal = (nombre: string) => {
    if (!config) return;
    const next = localOrigenesRef.current.map(o => o.nombre === nombre ? { ...o, activo: !o.activo } : o);
    localOrigenesRef.current = next;
    setLocalOrigenes(next);
    scheduleMovSave(config);
  };

  // Adds/deletes: inmediatos (acciones deliberadas)
  const agregarCategoriaLocal = () => {
    if (!nuevoNombre.trim() || !config) return;
    const next = [...localCatsRef.current, { id: nuevoNombre, nombre: nuevoNombre.trim(), tipo: nuevoTipo, activa: true }];
    localCatsRef.current = next;
    setLocalCats(next);
    setNuevoNombre("");
    saveConfig({ ...config, categorias: next, mediosPago: localMediosRef.current, origenesAhorro: localOrigenesRef.current });
  };

  const eliminarCategoriaLocal = (nombre: string) => {
    if (!config) return;
    const next = localCatsRef.current.filter(c => c.nombre !== nombre);
    localCatsRef.current = next;
    setLocalCats(next);
    setConfirmDelete(null);
    saveConfig({ ...config, categorias: next, mediosPago: localMediosRef.current, origenesAhorro: localOrigenesRef.current });
  };

  const eliminarMedioLocal = (nombre: string) => {
    if (!config) return;
    const next = localMediosRef.current.filter(m => m.nombre !== nombre);
    localMediosRef.current = next;
    setLocalMedios(next);
    setConfirmDelete(null);
    saveConfig({ ...config, categorias: localCatsRef.current, mediosPago: next, origenesAhorro: localOrigenesRef.current });
  };

  const eliminarOrigenLocal = (nombre: string) => {
    if (!config) return;
    const next = localOrigenesRef.current.filter(o => o.nombre !== nombre);
    localOrigenesRef.current = next;
    setLocalOrigenes(next);
    setConfirmDelete(null);
    saveConfig({ ...config, categorias: localCatsRef.current, mediosPago: localMediosRef.current, origenesAhorro: next });
  };

  const agregarMedioLocal = () => {
    if (!nuevoNombre.trim() || !config) return;
    const next = [...localMediosRef.current, { id: nuevoNombre, nombre: nuevoNombre.trim(), activo: true }];
    localMediosRef.current = next;
    setLocalMedios(next);
    setNuevoNombre("");
    saveConfig({ ...config, categorias: localCatsRef.current, mediosPago: next, origenesAhorro: localOrigenesRef.current });
  };

  const agregarOrigenLocal = () => {
    if (!nuevoNombre.trim() || !config) return;
    const next = [...localOrigenesRef.current, { id: nuevoNombre, nombre: nuevoNombre.trim(), activo: true }];
    localOrigenesRef.current = next;
    setLocalOrigenes(next);
    setNuevoNombre("");
    saveConfig({ ...config, categorias: localCatsRef.current, mediosPago: localMediosRef.current, origenesAhorro: next });
  };

  const guardarMovimientos = () => {
    if (!config) return;
    saveConfig({ ...config, categorias: localCats, mediosPago: localMedios, origenesAhorro: localOrigenes });
  };

  const openAutoAhorroModal = () => {
    if (!config) return;
    setLocalAutoMonto(config.meta.autoAhorro?.monto?.toString() ?? "");
    setLocalAutoMedios(
      config.meta.autoAhorro?.mediosPago ??
      config.mediosPago.filter(m => m.activo).map(m => m.nombre)
    );
    setLocalAutoOmitir(config.meta.autoAhorro?.omitirDescripciones ?? []);
    setLocalAutoOmitirInput("");
    setShowAutoAhorroModal(true);
  };

  const handleToggleAutoAhorro = () => {
    if (!config) return;
    if (config.meta.autoAhorro?.activo) {
      saveConfig({ ...config, meta: { ...config.meta, autoAhorro: { ...config.meta.autoAhorro, activo: false } } });
    } else {
      openAutoAhorroModal();
    }
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

  // ── Reportes handlers (auto-save) ──
  const toggleLocalReporte = (id: string) => {
    setLocalReportes(prev => {
      const next = { ...prev };
      if (next[id] === false) delete next[id];
      else next[id] = false;
      saveReportes(next);
      const allOff = REPORTES_TOGGLES.every(r => next[r.id] === false);
      if (allOff) setPref("showReportes", false);
      return next;
    });
  };

  const guardarReportes = () => saveReportes(localReportes);

  // ── Ahorros handler ──
  const guardarMetaAhorro = async () => {
    if (!config) return;
    const newMeta = { ...config.meta };
    if (metaFecha) newMeta.metaFecha = metaFecha;
    else delete newMeta.metaFecha;
    if (metaMonto) newMeta.metaMonto = parseFloat(metaMonto);
    else delete newMeta.metaMonto;
    if (sugeridoPorPeriodo != null) newMeta.metaPorPeriodo = sugeridoPorPeriodo;
    else delete newMeta.metaPorPeriodo;
    newMeta.metaMoneda = "USD";
    await saveConfig({ ...config, meta: newMeta });
  };

  if (loading || !config) return (
    <div className="page">
      <LoadingSpinner />
    </div>
  );

  return (
    <div className="page fade-up">

      <div style={{ marginBottom: 24 }}>
        <div className="label" style={{ marginBottom: 2 }}>{t.preferences}</div>
        <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.5, display: "inline-block", background: "linear-gradient(110deg, var(--blue) 10%, var(--green) 90%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>Settings</div>
      </div>

      {/* Pills principales */}
      <div style={{ display: "flex", gap: 6, marginBottom: 20, overflowX: "auto", scrollbarWidth: "none" }}>
        {TABS.map(tabItem => (
          <button key={tabItem.id} onClick={() => { setTab(tabItem.id); setNuevoNombre(""); }}
            className="pill"
            style={{
              flexShrink: 0,
              borderColor: tab === tabItem.id ? "var(--accent)" : "var(--border)",
              background: tab === tabItem.id ? "var(--accent-dim)" : "transparent",
              color: tab === tabItem.id ? "var(--accent)" : "var(--muted)",
            }}>
            {tabItem.label}
          </button>
        ))}
      </div>

      {/* ── CUENTA ── */}
      {tab === "cuenta" && (
        <div key="cuenta" className="fade-up" style={{ display: "flex", flexDirection: "column", gap: 12 }}>

          {/* Sync */}
          <div className="card">
            <div className="label">{t.sync}</div>
            <div className="row" style={{ padding: "10px 0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: syncError ? "var(--red-dim)" : lastSync ? "var(--green-dim)" : "var(--surface-alt)",
                  border: `1px solid ${syncError ? "var(--red)44" : lastSync ? "var(--green)44" : "var(--border)"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}>
                  <svg className={syncing ? "spin" : ""} width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16"
                      stroke={syncError ? "var(--red)" : lastSync ? "var(--green)" : "var(--muted)"}
                      strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize: 13 }}>Google Sheets</div>
                  <div style={{ fontSize: 11, marginTop: 2, color: syncError ? "var(--red)" : lastSync ? "var(--green)" : "var(--muted)" }}>
                    {syncError
                      ? t.syncErrorMsg(syncError.at.toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Argentina/Buenos_Aires" }))
                      : lastSync
                        ? t.lastSyncMsg(lastSync.toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Argentina/Buenos_Aires" }))
                        : t.neverSynced}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {syncError && (
                  <button onClick={handleSync} disabled={syncing} style={{
                    display: "flex", alignItems: "center", gap: 6,
                    background: "var(--red-dim)", color: "var(--red)",
                    border: "1px solid var(--red)44", borderRadius: "var(--radius-sm)",
                    padding: "8px 14px", fontSize: 12, fontWeight: 700, cursor: syncing ? "default" : "pointer",
                  }}>
                    {syncing ? t.retrying : t.retry}
                  </button>
                )}
                {syncLogs.length > 0 && (
                  <button onClick={() => setShowSyncLog(true)} title={t.viewHistory} style={{
                    background: "var(--surface-alt)", border: "1px solid var(--border)",
                    borderRadius: 10, width: 36, height: 36,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: "pointer", color: "var(--muted)", flexShrink: 0,
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="9"/>
                      <polyline points="12 7 12 12 15 15"/>
                    </svg>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Personalization */}
          <div className="card">
            <div className="label" style={{ marginBottom: 16 }}>{t.general}</div>

            {/* Theme mode */}
            <div className="row" style={{ padding: "12px 0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: dark ? "var(--surface-alt)" : "var(--yellow-dim)",
                  border: "1px solid var(--border)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}>
                  {dark ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79Z" stroke="var(--muted)" strokeWidth="1.7" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="4" stroke="var(--yellow)" strokeWidth="1.7" />
                      <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="var(--yellow)" strokeWidth="1.7" strokeLinecap="round" />
                    </svg>
                  )}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{t.darkMode}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                    {dark ? t.switchToLight : t.switchToDark}
                  </div>
                </div>
              </div>
              <Toggle activo={dark} onClick={toggleTheme} />
            </div>

            {/* Language */}
            <div className="row" style={{ padding: "12px 0", borderTop: "1px solid var(--border)" }}>
              <div style={{ fontSize: 13 }}>{t.language}</div>
              <div style={{ display: "flex", gap: 6 }}>
                {(["es", "en"] as const).map((l) => (
                  <button
                    key={l}
                    onClick={() => setLang(l)}
                    style={{
                      padding: "6px 12px", borderRadius: 999, fontSize: 12, fontWeight: 700,
                      border: `1px solid ${lang === l ? "var(--accent)" : "var(--border)"}`,
                      background: lang === l ? "var(--accent-dim)" : "transparent",
                      color: lang === l ? "var(--accent)" : "var(--muted)",
                      cursor: "pointer",
                    }}
                  >
                    {l === "es" ? "🇦🇷 ES" : "🇬🇧 EN"}
                  </button>
                ))}
              </div>
            </div>

            {/* Moneda principal */}
            <div style={{ padding: "12px 0", borderTop: "1px solid var(--faint)", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: "var(--accent-dim)", border: "1px solid var(--accent)44",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--accent)", fontFamily: "var(--font-mono)", lineHeight: 1 }}>
                  {monedaPrincipal === "USD" ? "U$D" : monedaPrincipal === "EUR" ? "€" : "$"}
                </span>
              </div>
              <div style={{ flex: 1, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{t.mainCurrency}</div>
                <span className="badge" style={{ background: "var(--accent-dim)", color: "var(--accent)", border: "1px solid var(--accent)44" }}>{monedaPrincipal}</span>
              </div>
            </div>

            {/* Reportes */}
            <div className="row" style={{ padding: "12px 0", borderTop: "1px solid var(--faint)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: showReportes ? "var(--green-dim)" : "var(--red-dim)",
                  border: `1px solid ${showReportes ? "var(--green)44" : "var(--red)44"}`,
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="3" width="18" height="18" rx="2" stroke={showReportes ? "var(--green)" : "var(--red)"} strokeWidth="1.7" />
                    <path d="M3 9h18M9 3v18" stroke={showReportes ? "var(--green)" : "var(--red)"} strokeWidth="1.7" />
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{t.reportsSection}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{t.showReportsLabel}</div>
                </div>
              </div>
              <Toggle activo={showReportes} onClick={() => {
                const next = !showReportes;
                setPref("showReportes", next);
                if (next) {
                  const reset: Record<string, boolean> = {};
                  REPORTES_TOGGLES.forEach(r => { reset[r.id] = true; });
                  saveReportes(reset);
                  setLocalReportes(reset);
                }
              }} />
            </div>

            {/* Inversión */}
            <div className="row" style={{ padding: "12px 0", borderTop: "1px solid var(--faint)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: showAhorros ? "var(--green-dim)" : "var(--red-dim)",
                  border: `1px solid ${showAhorros ? "var(--green)44" : "var(--red)44"}`,
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <polyline points="22 7 13.5 15.5 8.5 10.5 1 18" stroke={showAhorros ? "var(--green)" : "var(--red)"} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                    <polyline points="16 7 22 7 22 13" stroke={showAhorros ? "var(--green)" : "var(--red)"} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{t.investmentsSection}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{t.showInvestmentsLabel}</div>
                </div>
              </div>
              <Toggle activo={showAhorros} onClick={() => setPref("showAhorros", !showAhorros)} />
            </div>

            {/* Moneda de inversión */}
            {showAhorros && (
            <div style={{ padding: "12px 0", borderTop: "1px solid var(--faint)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: "var(--yellow-dim)", border: "1px solid var(--yellow)44",
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  <span style={{ fontSize: 16, fontWeight: 700, color: "var(--yellow)", fontFamily: "var(--font-mono)", lineHeight: 1 }}>
                    {monedaPrincipal === "USD" ? "€" : monedaPrincipal === "EUR" ? "U$D" : (monedaInversiones === "EUR" ? "€" : "$")}
                  </span>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{t.investmentCurrency}</div>
                    {config?.meta.metaMonto && <span style={{ fontSize: 10, color: "var(--muted)" }}>{t.activeGoal}</span>}
                  </div>
                  {monedaPrincipal === "ARS" ? (
                    config?.meta.metaMonto ? (
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>{t.cantChangeWithGoal}</div>
                    ) : (
                      <div style={{ display: "flex", gap: 6 }}>
                        {(["USD", "EUR"] as const).map((m) => (
                          <button key={m} onClick={() => setMoneda(m)} className="pill" style={{
                            borderColor: monedaInversiones === m ? "var(--yellow)" : "var(--border)",
                            background: monedaInversiones === m ? "var(--yellow-dim)" : "transparent",
                            color: monedaInversiones === m ? "var(--yellow)" : "var(--muted)",
                          }}>{m}</button>
                        ))}
                      </div>
                    )
                  ) : (
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>
                      {monedaPrincipal === "USD" ? t.eurInvestments : t.usdInvestments}
                    </div>
                  )}
                </div>
              </div>
            </div>
            )}

            {/* Auto-ahorro */}
            <div className="row" style={{ padding: "12px 0", borderTop: "1px solid var(--faint)" }}>
              <div
                style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, cursor: config.meta.autoAhorro?.activo ? "pointer" : "default" }}
                onClick={config.meta.autoAhorro?.activo ? openAutoAhorroModal : undefined}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: config.meta.autoAhorro?.activo ? "var(--green-dim)" : "var(--red-dim)",
                  border: `1px solid ${config.meta.autoAhorro?.activo ? "var(--green)44" : "var(--red)44"}`,
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M12 3C7 3 3 7 3 12s4 9 9 9 9-4 9-9" stroke={config.meta.autoAhorro?.activo ? "var(--green)" : "var(--red)"} strokeWidth="1.7" strokeLinecap="round" />
                    <path d="M16 3h5v5" stroke={config.meta.autoAhorro?.activo ? "var(--green)" : "var(--red)"} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M12 8v4l3 3" stroke={config.meta.autoAhorro?.activo ? "var(--green)" : "var(--red)"} strokeWidth="1.7" strokeLinecap="round" />
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>Auto-ahorro</div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                    {config.meta.autoAhorro?.activo && config.meta.autoAhorro.monto > 0 ? (() => {
                      const sym = monedaPrincipal === "USD" ? "U$D" : monedaPrincipal === "EUR" ? "€" : "$";
                      const monto = `${sym}${config.meta.autoAhorro.monto.toLocaleString("es-AR")} por gasto`;
                      const medios = config.meta.autoAhorro.mediosPago ?? [];
                      const allActive = config.mediosPago.filter(m => m.activo).map(m => m.nombre);
                      const mediosStr = medios.length === 0 || medios.length === allActive.length
                        ? t.allMethods
                        : medios.join(" + ");
                      const omitir = config.meta.autoAhorro.omitirDescripciones ?? [];
                      const omitirStr = omitir.length > 0 ? ` · ${t.skipPrefix} ${omitir.join(", ")}` : "";
                      return `${monto} · ${mediosStr}${omitirStr}`;
                    })() : t.setsFixedAmount}
                  </div>
                </div>
              </div>
              <Toggle activo={config.meta.autoAhorro?.activo ?? false} onClick={handleToggleAutoAhorro} />
            </div>
          </div>

          {/* Cuenta */}
          <div className="card">
            <div className="label">{t.account}</div>
            <div className="row" style={{ padding: "10px 0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: "var(--surface-alt)", border: "1px solid var(--border)",
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="8" r="4" stroke="var(--muted)" strokeWidth="1.7" />
                    <path d="M4 20c0-3.87 3.58-7 8-7s8 3.13 8 7" stroke="var(--muted)" strokeWidth="1.7" strokeLinecap="round" />
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize: 13 }}>{t.user}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{user?.email}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="label">App</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 18, padding: "8px 0" }}>
              {/* 1. Logo */}
              <img src="/logo5-cropped.png" alt="FinMoves" style={{ width: 72, borderRadius: 12, objectFit: "contain", flexShrink: 0 }} />
              {/* 2. Versión + changelog */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
                <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "var(--font-mono)", background: "linear-gradient(110deg, var(--blue) 10%, var(--green) 90%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>v{process.env.NEXT_PUBLIC_APP_VERSION}</div>
                <button onClick={openChangelog} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: 11, padding: 0, textDecoration: "underline" }}>changelog</button>
              </div>
              {/* 3. GitHub */}
              <button onClick={() => setShowGithubConfirm(true)} aria-label="GitHub" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", flexShrink: 0, padding: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
                </svg>
                <span style={{ fontSize: 9, letterSpacing: 0.4, textTransform: "uppercase", fontWeight: 600 }}>GitHub</span>
              </button>
              {/* 4. Export CSV */}
              <button onClick={() => setShowExportConfirm(true)} aria-label={t.exportCSV} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", flexShrink: 0, padding: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                <span style={{ fontSize: 9, letterSpacing: 0.4, textTransform: "uppercase", fontWeight: 600 }}>Backup</span>
              </button>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "center", marginTop: 12 }}>
            {confirmLogout ? (
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <button onClick={() => setConfirmLogout(false)} style={{
                  background: "none", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)",
                  color: "var(--muted)", fontSize: 13, padding: "8px 16px", cursor: "pointer",
                }}>{t.cancel}</button>
                <button onClick={async () => { await signOut(auth); router.push("/login"); }} style={{
                  background: "var(--red-dim)", border: "1px solid var(--red)44", borderRadius: "var(--radius-sm)",
                  color: "var(--red)", fontSize: 13, fontWeight: 700, padding: "8px 16px", cursor: "pointer",
                }}>{t.confirm}</button>
              </div>
            ) : (
              <button onClick={() => setConfirmLogout(true)} aria-label={t.signOut} style={{
                background: "transparent", border: "none", cursor: "pointer",
                color: "var(--red)", display: "flex", alignItems: "center", justifyContent: "center",
                width: 54, height: 54, borderRadius: "50%",
                filter: "drop-shadow(0 2px 10px var(--red)88)",
              }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── MOVIMIENTOS ── */}
      {tab === "movimientos" && (
        <div key="movimientos" className="fade-up" style={{ display: "flex", flexDirection: "column", gap: 12 }}>

          <div style={{ display: "flex", gap: 6 }}>
            {([
              { id: "categorias", label: t.categories },
              { id: "medios",     label: t.methods },
              { id: "origenes",   label: t.originsLabel },
            ] as const).map(s => (
              <button key={s.id} onClick={() => { setMovSub(s.id); setNuevoNombre(""); }}
                className="pill"
                style={{
                  borderColor: movSub === s.id ? "var(--accent)" : "var(--border)",
                  background: movSub === s.id ? "var(--accent-dim)" : "transparent",
                  color: movSub === s.id ? "var(--accent)" : "var(--muted)",
                }}>
                {s.label}
              </button>
            ))}
          </div>

          {movSub === "categorias" && (
            <div className="card">
              <div className="label">{t.categories}</div>
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
                  <input value={nuevoNombre} onChange={e => setNuevoNombre(e.target.value)}
                    placeholder={t.newCategory} className="input" style={{ flex: 1 }} />
                  <button onClick={agregarCategoriaLocal}
                    style={{ background: "none", border: "none", color: "var(--green)", fontSize: 26, fontWeight: 300, cursor: "pointer", padding: "0 8px", lineHeight: 1 }}>
                    +
                  </button>
                </div>
              </div>
              {localCats.map(c => (
                <div key={c.nombre} className="row">
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flex: 1 }}>
                    {confirmDelete === `cat_${c.nombre}` ? (
                      <>
                        <span style={{ fontSize: 11, color: "var(--red)" }}>{t.deleteQ}</span>
                        <button onClick={() => eliminarCategoriaLocal(c.nombre)} style={{ background: "var(--red-dim)", color: "var(--red)", border: "1px solid var(--red)44", borderRadius: "var(--radius-sm)", padding: "2px 8px", fontSize: 11, cursor: "pointer" }}>{t.yes}</button>
                        <button onClick={() => setConfirmDelete(null)} style={{ background: "var(--surface-alt)", color: "var(--muted)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "2px 8px", fontSize: 11, cursor: "pointer" }}>{t.no}</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => setConfirmDelete(`cat_${c.nombre}`)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "var(--red)", lineHeight: 1, fontSize: 12, flexShrink: 0 }}>✕</button>
                        <span style={{ fontSize: 12, color: c.activa ? "var(--text)" : "var(--muted)" }}>{c.nombre}</span>
                        <span className="badge" style={{
                          background: c.tipo === "Gasto" ? "var(--red-dim)" : "var(--green-dim)",
                          color: c.tipo === "Gasto" ? "var(--red)" : "var(--green)",
                          border: `1px solid ${c.tipo === "Gasto" ? "var(--red)" : "var(--green)"}44`,
                        }}>{c.tipo}</span>
                      </>
                    )}
                  </div>
                  {confirmDelete !== `cat_${c.nombre}` && <Toggle activo={c.activa} onClick={() => toggleCategoriaLocal(c.nombre)} />}
                </div>
              ))}
            </div>
          )}

          {movSub === "medios" && (
            <div className="card">
              <div className="label">{t.paymentMethods}</div>
              <div style={{ marginBottom: 14, display: "flex", gap: 8 }}>
                <input value={nuevoNombre} onChange={e => setNuevoNombre(e.target.value)}
                  placeholder={t.newMethod} className="input" style={{ flex: 1 }} />
                <button onClick={agregarMedioLocal}
                  style={{ background: "none", border: "none", color: "var(--green)", fontSize: 26, fontWeight: 300, cursor: "pointer", padding: "0 8px", lineHeight: 1 }}>
                  +
                </button>
              </div>
              {localMedios.map(m => (
                <div key={m.nombre} className="row">
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flex: 1 }}>
                    {confirmDelete === `med_${m.nombre}` ? (
                      <>
                        <span style={{ fontSize: 11, color: "var(--red)" }}>{t.deleteQ}</span>
                        <button onClick={() => eliminarMedioLocal(m.nombre)} style={{ background: "var(--red-dim)", color: "var(--red)", border: "1px solid var(--red)44", borderRadius: "var(--radius-sm)", padding: "2px 8px", fontSize: 11, cursor: "pointer" }}>{t.yes}</button>
                        <button onClick={() => setConfirmDelete(null)} style={{ background: "var(--surface-alt)", color: "var(--muted)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "2px 8px", fontSize: 11, cursor: "pointer" }}>{t.no}</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => setConfirmDelete(`med_${m.nombre}`)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "var(--red)", lineHeight: 1, fontSize: 12, flexShrink: 0 }}>✕</button>
                        <span style={{ fontSize: 12, color: m.activo ? "var(--text)" : "var(--muted)" }}>{m.nombre}</span>
                      </>
                    )}
                  </div>
                  {confirmDelete !== `med_${m.nombre}` && <Toggle activo={m.activo} onClick={() => toggleMedioLocal(m.nombre)} />}
                </div>
              ))}
            </div>
          )}

          {movSub === "origenes" && (
            <div className="card">
              <div className="label">{t.savingsOrigins}</div>
              <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 12, marginTop: -6 }}>{t.shownWhenAddingIncomeSavings}</div>
              <div style={{ marginBottom: 14, display: "flex", gap: 8 }}>
                <input value={nuevoNombre} onChange={e => setNuevoNombre(e.target.value)}
                  placeholder={t.newOrigin} className="input" style={{ flex: 1 }} />
                <button onClick={agregarOrigenLocal}
                  style={{ background: "none", border: "none", color: "var(--green)", fontSize: 26, fontWeight: 300, cursor: "pointer", padding: "0 8px", lineHeight: 1 }}>
                  +
                </button>
              </div>
              {localOrigenes.map(o => (
                <div key={o.nombre} className="row">
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flex: 1 }}>
                    {confirmDelete === `ori_${o.nombre}` ? (
                      <>
                        <span style={{ fontSize: 11, color: "var(--red)" }}>{t.deleteQ}</span>
                        <button onClick={() => eliminarOrigenLocal(o.nombre)} style={{ background: "var(--red-dim)", color: "var(--red)", border: "1px solid var(--red)44", borderRadius: "var(--radius-sm)", padding: "2px 8px", fontSize: 11, cursor: "pointer" }}>{t.yes}</button>
                        <button onClick={() => setConfirmDelete(null)} style={{ background: "var(--surface-alt)", color: "var(--muted)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "2px 8px", fontSize: 11, cursor: "pointer" }}>{t.no}</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => setConfirmDelete(`ori_${o.nombre}`)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "var(--red)", lineHeight: 1, fontSize: 12, flexShrink: 0 }}>✕</button>
                        <span style={{ fontSize: 12, color: o.activo ? "var(--text)" : "var(--muted)" }}>{o.nombre}</span>
                      </>
                    )}
                  </div>
                  {confirmDelete !== `ori_${o.nombre}` && <Toggle activo={o.activo} onClick={() => toggleOrigenLocal(o.nombre)} />}
                </div>
              ))}
            </div>
          )}

        </div>
      )}

      {/* ── REPORTES ── */}
      {tab === "reportes" && (
        <div key="reportes" className="fade-up" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {(["gastos", "ingresos", "movimientos", "periodos"] as const).map((sec) => (
            <div key={sec} className="card">
              <div className="label">{SECCION_LABEL[sec]}</div>
              {REPORTES_TOGGLES.filter((r) => r.seccion === sec).map((r) => (
                <div key={r.id} className="row">
                  <span style={{ fontSize: 13, color: localIsEnabled(r.id) ? "var(--text)" : "var(--muted)" }}>{r.label}</span>
                  <Toggle activo={localIsEnabled(r.id)} onClick={() => toggleLocalReporte(r.id)} />
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* ── AHORROS ── */}
      {tab === "ahorros" && (
        <div key="ahorros" className="fade-up" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="card">
            <div className="label">{t.savingsGoalSettings}</div>
            <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 16, marginTop: -4 }}>
              {t.currentReserve(simboloReserva, totalReserva.toFixed(2))}
            </div>
            <div style={{ marginBottom: 12 }}>
              <div className="label" style={{ marginBottom: 6 }}>{t.targetDate}</div>
              <input type="date" value={metaFecha}
                onChange={(e) => setMetaFecha(e.target.value)} className="input" />
            </div>
            <div style={{ marginBottom: 16 }}>
              <div className="label" style={{ marginBottom: 6 }}>{t.targetAmount(monedaInversiones)}</div>
              <input type="number" value={metaMonto} placeholder="0"
                onChange={(e) => setMetaMonto(e.target.value)} className="input" />
            </div>

            <div style={{
              padding: "12px 14px", borderRadius: "var(--radius-sm)",
              background: "var(--surface-alt)", border: "1px solid var(--border)",
              marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <div style={{ fontSize: 11, color: "var(--muted)" }}>{t.estimatedPerPeriod}</div>
              <div style={{ fontSize: 15, fontWeight: 700, fontFamily: "var(--font-mono)", color: sugeridoPorPeriodo != null ? "var(--green)" : "var(--muted)" }}>
                {sugeridoPorPeriodo != null ? `U$D ${sugeridoPorPeriodo.toLocaleString("es-AR")}` : "—"}
              </div>
            </div>

            <div style={{ position: "relative", display: "flex", justifyContent: "center", alignItems: "center", height: 56, marginTop: 8 }}>
              <button onClick={guardarMetaAhorro} disabled={!isDirtyAhorros || guardando} style={{
                width: 56, height: 56, borderRadius: "50%",
                background: isDirtyAhorros ? "var(--green)" : "transparent",
                border: `2px solid ${isDirtyAhorros ? "var(--green)" : "var(--border)"}`,
                color: isDirtyAhorros ? "var(--bg)" : "var(--border)",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: isDirtyAhorros ? "pointer" : "default",
                transition: "background 0.2s, border-color 0.2s, color 0.2s",
                boxShadow: isDirtyAhorros ? "0 4px 20px var(--green)55" : "none",
                opacity: guardando ? 0.5 : 1,
              }}>
                {guardando
                  ? <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="spin"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" strokeDasharray="28 56" /></svg>
                  : <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                }
              </button>
              {(metaFecha || metaMonto) && (
                <button onClick={async () => {
                  if (!config) return;
                  const newMeta = { ...config.meta };
                  delete newMeta.metaFecha; delete newMeta.metaMonto; delete newMeta.metaPorPeriodo;
                  await saveConfig({ ...config, meta: newMeta });
                  setMetaFecha(""); setMetaMonto("");
                }} style={{ position: "absolute", right: 0, background: "none", border: "none", cursor: "pointer", color: "var(--red)", padding: 8 }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                  </svg>
                </button>
              )}
            </div>

          </div>
        </div>
      )}

      {saveMsg && (
        <div className="fade-up" style={{
          position: "fixed", left: 16, right: 16, bottom: "calc(var(--nav-h) + 16px)",
          zIndex: 150, padding: "12px 16px", borderRadius: "var(--radius-sm)", fontSize: 13,
          background: saveMsg.ok ? "var(--green-dim)" : "var(--red-dim)",
          border: `1px solid ${saveMsg.ok ? "var(--green)" : "var(--red)"}44`,
          color: saveMsg.ok ? "var(--green)" : "var(--red)",
          textAlign: "center", backdropFilter: "blur(8px)",
        }}>
          {saveMsg.text}
        </div>
      )}

      {syncMsg && (
        <div className="fade-up" style={{
          position: "fixed", left: 16, right: 16, bottom: "calc(var(--nav-h) + 16px)",
          zIndex: 150, padding: "12px 16px", borderRadius: "var(--radius-sm)", fontSize: 13,
          background: syncMsg.ok ? "var(--green-dim)" : "var(--red-dim)",
          border: `1px solid ${syncMsg.ok ? "var(--green)" : "var(--red)"}44`,
          color: syncMsg.ok ? "var(--green)" : "var(--red)",
          textAlign: "center", backdropFilter: "blur(8px)",
        }}>
          {syncMsg.text}
        </div>
      )}

      {showAutoAhorroModal && mounted && createPortal(
        <div onClick={() => setShowAutoAhorroModal(false)} style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "var(--bg)", borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 480 }}>
            <div style={{ padding: "12px 16px 0" }}>
              <div style={{ width: 36, height: 4, background: "var(--border)", borderRadius: 2, margin: "0 auto 14px" }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <span style={{ fontSize: 16, fontWeight: 700 }}>Auto-ahorro</span>
                <button onClick={() => setShowAutoAhorroModal(false)} style={{ background: "none", border: "none", color: "var(--red)", fontSize: 22, cursor: "pointer", lineHeight: 1, padding: 4 }}>×</button>
              </div>
            </div>
            <div style={{ padding: "0 16px 40px", display: "flex", flexDirection: "column", gap: 20 }}>
              <div>
                <div className="label" style={{ marginBottom: 8 }}>{t.autoSavingsAmountPerExpense(monedaPrincipal === "USD" ? "U$D" : monedaPrincipal === "EUR" ? "€" : "$")}</div>
                <input
                  type="number" value={localAutoMonto} placeholder="0" className="input"
                  style={{ fontFamily: "var(--font-mono)", fontSize: 15 }}
                  onChange={e => setLocalAutoMonto(e.target.value)}
                  autoFocus
                />
              </div>
              <div>
                <div className="label" style={{ marginBottom: 8 }}>{t.appliedPaymentMethods}</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {config.mediosPago.filter(m => m.activo).map(m => {
                    const sel = localAutoMedios.includes(m.nombre);
                    return (
                      <button key={m.nombre} type="button"
                        onClick={() => setLocalAutoMedios(sel ? localAutoMedios.filter(x => x !== m.nombre) : [...localAutoMedios, m.nombre])}
                        className="pill" style={{
                          borderColor: sel ? "var(--blue)" : "var(--border)",
                          background: sel ? "var(--blue-dim)" : "transparent",
                          color: sel ? "var(--blue)" : "var(--muted)",
                        }}>{m.nombre}</button>
                    );
                  })}
                </div>
              </div>
              <div>
                <div className="label" style={{ marginBottom: 8 }}>{t.descriptionsToSkip}</div>
                <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <input
                    value={localAutoOmitirInput}
                    onChange={e => setLocalAutoOmitirInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter" && localAutoOmitirInput.trim()) {
                        const val = localAutoOmitirInput.trim();
                        if (!localAutoOmitir.includes(val)) setLocalAutoOmitir([...localAutoOmitir, val]);
                        setLocalAutoOmitirInput("");
                      }
                    }}
                    placeholder={t.egPlaceholder}
                    style={{ flex: 1, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "8px 12px", fontSize: 13, color: "var(--text)" }}
                  />
                  <button type="button" onClick={() => {
                    const val = localAutoOmitirInput.trim();
                    if (val && !localAutoOmitir.includes(val)) setLocalAutoOmitir([...localAutoOmitir, val]);
                    setLocalAutoOmitirInput("");
                  }} style={{ background: "none", border: "none", color: "var(--green)", fontSize: 26, fontWeight: 300, cursor: "pointer", padding: "0 8px", lineHeight: 1 }}>+</button>
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
                  width: 56, height: 56, borderRadius: "50%",
                  background: canConfirmAutoAhorro ? "var(--green)" : "transparent",
                  border: `2px solid ${canConfirmAutoAhorro ? "var(--green)" : "var(--border)"}`,
                  color: canConfirmAutoAhorro ? "var(--bg)" : "var(--border)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: canConfirmAutoAhorro ? "pointer" : "default",
                  transition: "background 0.2s, border-color 0.2s, color 0.2s",
                  boxShadow: canConfirmAutoAhorro ? "0 4px 20px var(--green)55" : "none",
                  opacity: guardando ? 0.5 : 1,
                }}>
                  {guardando
                    ? <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="spin"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" strokeDasharray="28 56" /></svg>
                    : <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  }
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {showSyncLog && mounted && createPortal(
        <div onClick={() => setShowSyncLog(false)} style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "var(--surface)", borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 480, maxHeight: "70vh", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px 12px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>{t.syncHistory}</span>
              <button onClick={() => setShowSyncLog(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: 22, lineHeight: 1, padding: 4 }}>×</button>
            </div>
            <div style={{ overflowY: "auto", padding: "12px 20px 32px", display: "flex", flexDirection: "column", gap: 8 }}>
              {syncLogs.length === 0 ? (
                <div style={{ color: "var(--muted)", fontSize: 13, textAlign: "center", padding: 24 }}>{t.noRecords}</div>
              ) : syncLogs.map((log, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 12px",
                  borderRadius: "var(--radius-sm)",
                  background: log.status === "ok" ? "var(--green-dim)" : "var(--red-dim)",
                  border: `1px solid ${log.status === "ok" ? "var(--green)33" : "var(--red)33"}`,
                }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: "50%", flexShrink: 0, marginTop: 4,
                    background: log.status === "ok" ? "var(--green)" : "var(--red)",
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: log.status === "ok" ? "var(--green)" : "var(--red)" }}>
                      {log.message}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 3, display: "flex", gap: 8 }}>
                      <span>{log.at.toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Argentina/Buenos_Aires" })}</span>
                      <span style={{
                        padding: "1px 6px", borderRadius: 4,
                        background: log.type === "auto" ? "var(--blue-dim)" : "var(--surface-alt)",
                        color: log.type === "auto" ? "var(--blue)" : "var(--muted)",
                        border: `1px solid ${log.type === "auto" ? "var(--blue)33" : "var(--border)"}`,
                        fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em",
                      }}>{log.type === "auto" ? "Auto" : "Manual"}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}

      {showChangelog && mounted && createPortal(
        <div onClick={() => setShowChangelog(false)} style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "var(--surface)", borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 480, maxHeight: "75vh", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px 12px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>Changelog</span>
              <button onClick={() => setShowChangelog(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: 22, lineHeight: 1, padding: 4 }}>×</button>
            </div>
            <div style={{ overflowY: "auto", padding: "16px 20px 32px", fontSize: 13, lineHeight: 1.65, color: "var(--text)" }}>
              {changelog ? changelog.split("\n").map((line, i) => {
                if (line.startsWith("## ")) return <div key={i} style={{ fontSize: 14, fontWeight: 700, margin: "16px 0 4px", color: "var(--blue)" }}>{line.replace(/^## /, "")}</div>;
                if (line.startsWith("### ")) return <div key={i} style={{ fontSize: 11, fontWeight: 600, margin: "10px 0 2px", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{line.replace(/^### /, "")}</div>;
                if (line.startsWith("- ")) return <div key={i} style={{ paddingLeft: 10, marginBottom: 3 }}>• {line.replace(/^- /, "")}</div>;
                if (line.startsWith("---")) return <hr key={i} style={{ border: "none", borderTop: "1px solid var(--border)", margin: "10px 0" }} />;
                if (line.startsWith("# ") || line.trim() === "" || line.startsWith("Todos los cambios") || line.startsWith("Formato basado") || line.startsWith("https://keep")) return null;
                return <div key={i}>{line}</div>;
              }) : <div style={{ color: "var(--muted)" }}>Loading…</div>}
            </div>
          </div>
        </div>,
        document.body
      )}

      {showExportConfirm && mounted && createPortal(
        <div onClick={() => setShowExportConfirm(false)} style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "var(--bg)", borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 480, padding: "24px 20px 32px" }}>
            <div style={{ width: 36, height: 4, background: "var(--border)", borderRadius: 2, margin: "0 auto 20px" }} />
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{t.exportCSV}</div>
            <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 24 }}>{t.exportCSVBody}</div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowExportConfirm(false)} style={{ flex: 1, padding: "12px 0", borderRadius: 12, border: "1px solid var(--border)", background: "none", color: "var(--muted)", fontSize: 14, cursor: "pointer" }}>{t.cancel}</button>
              <button onClick={() => { exportCSV(); setShowExportConfirm(false); }} style={{ flex: 1, padding: "12px 0", borderRadius: 12, border: "none", background: "var(--blue)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>{t.download}</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {showGithubConfirm && mounted && createPortal(
        <div onClick={() => setShowGithubConfirm(false)} style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "var(--bg)", borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 480, padding: "24px 20px 32px" }}>
            <div style={{ width: 36, height: 4, background: "var(--border)", borderRadius: 2, margin: "0 auto 20px" }} />
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{t.openGitHub}</div>
            <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 24 }}>{t.goToGitHubBody}</div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowGithubConfirm(false)} style={{ flex: 1, padding: "12px 0", borderRadius: 12, border: "1px solid var(--border)", background: "none", color: "var(--muted)", fontSize: 14, cursor: "pointer" }}>{t.cancel}</button>
              <button onClick={() => { window.open("https://github.com/dsimdev/finmoves-app/blob/main/README.md", "_blank", "noopener,noreferrer"); setShowGithubConfirm(false); }} style={{ flex: 1, padding: "12px 0", borderRadius: 12, border: "none", background: "var(--blue)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>{t.goToGitHub}</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
