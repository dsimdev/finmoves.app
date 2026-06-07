"use client";

import { useState, useMemo, useEffect, useRef } from "react";
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
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { useTheme } from "@/hooks/useTheme";
import { useAppPrefs } from "@/hooks/useAppPrefs";

type Tab = "cuenta" | "movimientos" | "reportes" | "ahorros";

const ALL_TABS: { id: Tab; label: string }[] = [
  { id: "cuenta",      label: "Cuenta" },
  { id: "movimientos", label: "Movimientos" },
  { id: "reportes",    label: "Reportes" },
  { id: "ahorros",     label: "Inversiones" },
];

const SECCION_LABEL: Record<string, string> = {
  gastos: "Gastos",
  ingresos: "Ingresos",
  periodos: "Períodos",
  tendencias: "Tendencias",
};

function Toggle({ activo, onClick }: { activo: boolean; onClick: () => void }) {
  return (
    <div onClick={onClick} style={{
      width: 40, height: 22, borderRadius: 11,
      background: activo ? "var(--accent)" : "var(--faint)",
      position: "relative", cursor: "pointer", transition: "background .2s", flexShrink: 0,
    }}>
      <div style={{
        position: "absolute", top: 3, left: activo ? 20 : 3,
        width: 16, height: 16, borderRadius: 8,
        background: "var(--text)", transition: "left .15s",
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
  const { showReportes, showAhorros, monedaInversiones, set: setPref, setMoneda } = useAppPrefs();
  const TABS = ALL_TABS.filter((t) => {
    if (t.id === "reportes" && !showReportes) return false;
    if (t.id === "ahorros" && !showAhorros) return false;
    return true;
  });
  const [tab, setTab] = useState<Tab>("cuenta");
  const [guardando, setGuardando] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoTipo, setNuevoTipo] = useState<"Gasto" | "Ingreso">("Gasto");
  const [movSub, setMovSub] = useState<"categorias" | "medios" | "origenes">("categorias");

  // Sync state
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [syncError, setSyncError] = useState<{ message: string; at: Date } | null>(null);

  // ── Movimientos local state ──
  const [localCats, setLocalCats] = useState<ConfigUsuario["categorias"]>([]);
  const [localMedios, setLocalMedios] = useState<ConfigUsuario["mediosPago"]>([]);
  const [localOrigenes, setLocalOrigenes] = useState<ConfigUsuario["origenesAhorro"]>([]);
  const didInitMov = useRef(false);

  useEffect(() => {
    if (config && !didInitMov.current) {
      setLocalCats(config.categorias);
      setLocalMedios(config.mediosPago);
      setLocalOrigenes(config.origenesAhorro);
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

  // ── Reportes local state ──
  const [localReportes, setLocalReportes] = useState<Record<string, boolean>>({});
  const didInitRep = useRef(false);

  useEffect(() => {
    if (!didInitRep.current && Object.keys(overrides).length >= 0) {
      setLocalReportes(overrides);
      didInitRep.current = true;
    }
  }, [overrides]);

  const isDirtyReportes = useMemo(() =>
    JSON.stringify(localReportes) !== JSON.stringify(overrides),
    [localReportes, overrides]
  );

  const localIsEnabled = (id: string) => localReportes[id] !== false;

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

  const sugeridoPorPeriodo = useMemo(() => {
    if (!metaFecha || !metaMonto || periodos.length < 2) return null;
    const meta = parseFloat(metaMonto);
    if (isNaN(meta) || meta <= 0 || totalUSD >= meta) return null;
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

  // ── Helpers ──
  const saveConfig = async (newConfig: typeof config) => {
    if (!user?.uid || !newConfig) return;
    setGuardando(true);
    try {
      await setDoc(doc(db, `users/${user.uid}/config/meta`), newConfig);
      refresh();
      setSaveMsg({ ok: true, text: "Guardado" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al guardar";
      setSaveMsg({ ok: false, text: msg });
    } finally {
      setGuardando(false);
      setTimeout(() => setSaveMsg(null), 3000);
    }
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
      if (!res.ok) throw new Error(data.error ?? "Error");
      setLastSync(new Date());
      setSyncError(null);
      setSyncMsg({ ok: true, text: data.message });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error al sincronizar";
      setSyncError({ message, at: new Date() });
      setSyncMsg({ ok: false, text: message });
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMsg(null), 4000);
    }
  };

  // ── Movimientos handlers (local only) ──
  const toggleCategoriaLocal = (nombre: string) =>
    setLocalCats(prev => prev.map(c => c.nombre === nombre ? { ...c, activa: !c.activa } : c));

  const toggleMedioLocal = (nombre: string) =>
    setLocalMedios(prev => prev.map(m => m.nombre === nombre ? { ...m, activo: !m.activo } : m));

  const toggleOrigenLocal = (nombre: string) =>
    setLocalOrigenes(prev => prev.map(o => o.nombre === nombre ? { ...o, activo: !o.activo } : o));

  const agregarCategoriaLocal = () => {
    if (!nuevoNombre.trim()) return;
    setLocalCats(prev => [...prev, { id: nuevoNombre, nombre: nuevoNombre.trim(), tipo: nuevoTipo, activa: true }]);
    setNuevoNombre("");
  };

  const agregarMedioLocal = () => {
    if (!nuevoNombre.trim()) return;
    setLocalMedios(prev => [...prev, { id: nuevoNombre, nombre: nuevoNombre.trim(), activo: true }]);
    setNuevoNombre("");
  };

  const agregarOrigenLocal = () => {
    if (!nuevoNombre.trim()) return;
    setLocalOrigenes(prev => [...prev, { id: nuevoNombre, nombre: nuevoNombre.trim(), activo: true }]);
    setNuevoNombre("");
  };

  const guardarMovimientos = () => {
    if (!config) return;
    saveConfig({ ...config, categorias: localCats, mediosPago: localMedios, origenesAhorro: localOrigenes });
  };

  // ── Reportes handlers (local only) ──
  const toggleLocalReporte = (id: string) =>
    setLocalReportes(prev => ({ ...prev, [id]: prev[id] === false ? true : false }));

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
        <div className="label" style={{ marginBottom: 2 }}>Preferencias</div>
        <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.5, display: "inline-block", background: "linear-gradient(110deg, var(--blue) 10%, var(--green) 90%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>Configuraciones</div>
      </div>

      {/* Pills principales */}
      <div style={{ display: "flex", gap: 6, marginBottom: 20, overflowX: "auto", scrollbarWidth: "none" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); setNuevoNombre(""); }}
            className="pill"
            style={{
              flexShrink: 0,
              borderColor: tab === t.id ? "var(--accent)" : "var(--border)",
              background: tab === t.id ? "var(--accent-dim)" : "transparent",
              color: tab === t.id ? "var(--accent)" : "var(--muted)",
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── CUENTA ── */}
      {tab === "cuenta" && (
        <div key="cuenta" className="fade-up" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="card">
            <div className="label">Cuenta</div>
            <div className="row" style={{ padding: "10px 0" }}>
              <div>
                <div style={{ fontSize: 13 }}>Usuario</div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{user?.email}</div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="label">Sincronización</div>
            <div className="row" style={{ padding: "10px 0" }}>
              <div>
                <div style={{ fontSize: 13 }}>Google Sheets</div>
                <div style={{ fontSize: 11, marginTop: 2, color: syncError ? "var(--red)" : lastSync ? "var(--green)" : "var(--muted)" }}>
                  {syncError
                    ? `Error de sync: ${syncError.at.toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/Buenos_Aires" })}`
                    : lastSync
                      ? `Última sync: ${lastSync.toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/Buenos_Aires" })}`
                      : "Nunca sincronizado"}
                </div>
              </div>
              {syncError && (
                <button onClick={handleSync} disabled={syncing} style={{
                  display: "flex", alignItems: "center", gap: 6,
                  background: "var(--red-dim)", color: "var(--red)",
                  border: "1px solid var(--red)44", borderRadius: "var(--radius-sm)",
                  padding: "8px 14px", fontSize: 12, fontWeight: 700, cursor: syncing ? "default" : "pointer",
                }}>
                  <svg className={syncing ? "spin" : ""} width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16"
                      stroke="var(--red)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {syncing ? "Reintentando..." : "Reintentar"}
                </button>
              )}
            </div>
          </div>

          <div className="card">
            <div className="label" style={{ marginBottom: 16 }}>Preferencias generales</div>
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
                  <div style={{ fontSize: 13, fontWeight: 500 }}>Modo oscuro</div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                    {dark ? "Cambiá a tema claro" : "Cambiá a tema oscuro"}
                  </div>
                </div>
              </div>
              <Toggle activo={dark} onClick={toggleTheme} />
            </div>
            <div className="row" style={{ padding: "12px 0", borderTop: "1px solid var(--faint)" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>Reportes</div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>Mostrar sección de reportes</div>
              </div>
              <Toggle activo={showReportes} onClick={() => setPref("showReportes", !showReportes)} />
            </div>
            <div className="row" style={{ padding: "12px 0", borderTop: "1px solid var(--faint)" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>Inversiones</div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>Mostrar sección de inversiones</div>
              </div>
              <Toggle activo={showAhorros} onClick={() => setPref("showAhorros", !showAhorros)} />
            </div>
            {showAhorros && (
            <div style={{ padding: "12px 0", borderTop: "1px solid var(--faint)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>Moneda de inversiones</div>
                {config?.meta.metaMonto && <span style={{ fontSize: 10, color: "var(--muted)" }}>meta activa</span>}
              </div>
              {config?.meta.metaMonto ? (
                <div style={{ fontSize: 11, color: "var(--muted)" }}>
                  No se puede cambiar mientras haya una meta de ahorro activa.
                </div>
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
              )}
            </div>
            )}
          </div>

          <div className="card">
            <div className="label">App</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, padding: "8px 0" }}>
              <img src="/logo5-cropped.png" alt="FinMoves" style={{ width: 100, borderRadius: 12, objectFit: "contain", flexShrink: 0 }} />
              <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "var(--font-mono)", background: "linear-gradient(110deg, var(--blue) 10%, var(--green) 90%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>v{process.env.NEXT_PUBLIC_APP_VERSION}</div>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "center", marginTop: 12 }}>
            <button
              onClick={async () => { await signOut(auth); router.push("/login"); }}
              aria-label="Cerrar sesión"
              style={{
                background: "transparent", border: "none", cursor: "pointer",
                color: "var(--red)", display: "flex", alignItems: "center", justifyContent: "center",
                width: 54, height: 54, borderRadius: "50%",
                filter: "drop-shadow(0 2px 10px var(--red)88)",
              }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* ── MOVIMIENTOS ── */}
      {tab === "movimientos" && (
        <div key="movimientos" className="fade-up" style={{ display: "flex", flexDirection: "column", gap: 12 }}>

          <div style={{ display: "flex", gap: 6 }}>
            {([
              { id: "categorias", label: "Categorías" },
              { id: "medios",     label: "Medios" },
              { id: "origenes",   label: "Orígenes" },
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
              <div className="label">Categorías</div>
              {localCats.map(c => (
                <div key={c.nombre} className="row">
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flex: 1 }}>
                    <span style={{ fontSize: 12, color: c.activa ? "var(--text)" : "var(--muted)" }}>{c.nombre}</span>
                    <span className="badge" style={{
                      background: c.tipo === "Gasto" ? "var(--red-dim)" : "var(--green-dim)",
                      color: c.tipo === "Gasto" ? "var(--red)" : "var(--green)",
                      border: `1px solid ${c.tipo === "Gasto" ? "var(--red)" : "var(--green)"}44`,
                    }}>
                      {c.tipo}
                    </span>
                  </div>
                  <Toggle activo={c.activa} onClick={() => toggleCategoriaLocal(c.nombre)} />
                </div>
              ))}
              <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
                <input value={nuevoNombre} onChange={e => setNuevoNombre(e.target.value)}
                  placeholder="Nueva categoría" className="input" style={{ flex: 1 }} />
                <select value={nuevoTipo} onChange={e => setNuevoTipo(e.target.value as "Gasto" | "Ingreso")}
                  className="input" style={{ width: "auto", padding: "12px 8px" }}>
                  <option value="Gasto">Gasto</option>
                  <option value="Ingreso">Ingreso</option>
                </select>
                <button onClick={agregarCategoriaLocal}
                  style={{ background: "var(--green)", color: "var(--bg)", border: "none", borderRadius: "var(--radius-sm)", padding: "12px 16px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                  +
                </button>
              </div>
            </div>
          )}

          {movSub === "medios" && (
            <div className="card">
              <div className="label">Medios de pago</div>
              {localMedios.map(m => (
                <div key={m.nombre} className="row">
                  <span style={{ fontSize: 12, color: m.activo ? "var(--text)" : "var(--muted)" }}>{m.nombre}</span>
                  <Toggle activo={m.activo} onClick={() => toggleMedioLocal(m.nombre)} />
                </div>
              ))}
              <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
                <input value={nuevoNombre} onChange={e => setNuevoNombre(e.target.value)}
                  placeholder="Nuevo medio" className="input" style={{ flex: 1 }} />
                <button onClick={agregarMedioLocal}
                  style={{ background: "var(--green)", color: "var(--bg)", border: "none", borderRadius: "var(--radius-sm)", padding: "12px 16px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                  +
                </button>
              </div>
            </div>
          )}

          {movSub === "origenes" && (
            <div className="card">
              <div className="label">Orígenes de ahorro</div>
              <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 12, marginTop: -6 }}>Aparecen al cargar Ingreso → Ahorros</div>
              {localOrigenes.map(o => (
                <div key={o.nombre} className="row">
                  <span style={{ fontSize: 12, color: o.activo ? "var(--text)" : "var(--muted)" }}>{o.nombre}</span>
                  <Toggle activo={o.activo} onClick={() => toggleOrigenLocal(o.nombre)} />
                </div>
              ))}
              <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
                <input value={nuevoNombre} onChange={e => setNuevoNombre(e.target.value)}
                  placeholder="Nuevo origen" className="input" style={{ flex: 1 }} />
                <button onClick={agregarOrigenLocal}
                  style={{ background: "var(--green)", color: "var(--bg)", border: "none", borderRadius: "var(--radius-sm)", padding: "12px 16px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                  +
                </button>
              </div>
            </div>
          )}

        </div>
      )}

      {/* ── REPORTES ── */}
      {tab === "reportes" && (
        <div key="reportes" className="fade-up" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {(["gastos", "ingresos", "periodos"] as const).map((sec) => (
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
          <div className="card">
            <div className="label">Tendencias</div>
            {REPORTES_TOGGLES.filter((r) => r.seccion === "tendencias").map((r) => (
              <div key={r.id} className="row">
                <span style={{ fontSize: 13, color: localIsEnabled(r.id) ? "var(--text)" : "var(--muted)" }}>{r.label}</span>
                <Toggle activo={localIsEnabled(r.id)} onClick={() => toggleLocalReporte(r.id)} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── AHORROS ── */}
      {tab === "ahorros" && (
        <div key="ahorros" className="fade-up" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="card">
            <div className="label">Meta de ahorro</div>
            <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 16, marginTop: -4 }}>
              Reserva actual: <strong>U$D {totalUSD.toFixed(2)}</strong>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div className="label" style={{ marginBottom: 6 }}>Fecha objetivo</div>
              <input type="date" value={metaFecha}
                onChange={(e) => setMetaFecha(e.target.value)} className="input" />
            </div>
            <div style={{ marginBottom: 16 }}>
              <div className="label" style={{ marginBottom: 6 }}>Monto objetivo (USD)</div>
              <input type="number" value={metaMonto} placeholder="0"
                onChange={(e) => setMetaMonto(e.target.value)} className="input" />
            </div>

            <div style={{
              padding: "12px 14px", borderRadius: "var(--radius-sm)",
              background: "var(--surface-alt)", border: "1px solid var(--border)",
              marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <div style={{ fontSize: 11, color: "var(--muted)" }}>Por período estimado</div>
              <div style={{ fontSize: 15, fontWeight: 700, fontFamily: "var(--font-mono)", color: sugeridoPorPeriodo != null ? "var(--green)" : "var(--muted)" }}>
                {sugeridoPorPeriodo != null ? `U$D ${sugeridoPorPeriodo.toLocaleString("es-AR")}` : "—"}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Botón guardar flotante — diskette, aparece solo con cambios */}
      {((tab === "movimientos" && isDirtyMovimientos) ||
        tab === "reportes" ||
        (tab === "ahorros" && isDirtyAhorros)) && (
        <button
          onClick={tab === "movimientos" ? guardarMovimientos : tab === "reportes" ? guardarReportes : guardarMetaAhorro}
          disabled={guardando}
          aria-label="Guardar cambios"
          style={{
            position: "fixed",
            bottom: "calc(var(--nav-h) + 14px)",
            left: 0, right: 0, margin: "0 auto",
            width: 54, height: 54,
            borderRadius: "50%",
            background: "transparent",
            color: "var(--accent)",
            border: "none", cursor: guardando ? "default" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 160,
            filter: "drop-shadow(0 2px 12px var(--accent)99)",
            opacity: guardando ? 0.5 : 1,
            transition: "opacity 0.4s ease",
          }}
        >
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
            <polyline points="17 21 17 13 7 13 7 21"/>
            <polyline points="7 3 7 8 15 8"/>
          </svg>
        </button>
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
    </div>
  );
}
