"use client";

import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useConfig } from "@/hooks/useConfig";
import { useAllMovimientos } from "@/hooks/useAllMovimientos";
import { useReportConfig, REPORTES_TOGGLES } from "@/hooks/useReportConfig";
import { agruparPorPeriodo } from "@/utils/periodo";
import { serieTendencia, parsePeriodoId } from "@/utils/reportes";
import { doc, setDoc } from "firebase/firestore";
import { db, auth } from "@/services/firebase/firebase";
import { signOut, getIdToken } from "firebase/auth";
import { useRouter } from "next/navigation";

type Tab = "cuenta" | "movimientos" | "reportes" | "ahorros";

const TABS: { id: Tab; label: string }[] = [
  { id: "cuenta",      label: "Cuenta" },
  { id: "movimientos", label: "Movimientos" },
  { id: "reportes",    label: "Reportes" },
  { id: "ahorros",     label: "Ahorros" },
];

const SECCION_LABEL: Record<string, string> = {
  gastos: "Gastos",
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
  const { isEnabled, toggle: toggleReport } = useReportConfig();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("cuenta");
  const [guardando, setGuardando] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoTipo, setNuevoTipo] = useState<"Gasto" | "Ingreso">("Gasto");
  const [metaUSD, setMetaUSD] = useState("");
  const [tipoCambio, setTipoCambio] = useState<"blue" | "oficial" | "">("");
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [movSub, setMovSub] = useState<"categorias" | "medios" | "origenes">("categorias");

  // Meta de ahorro (siempre USD)
  const [metaFecha, setMetaFecha] = useState("");
  const [metaMonto, setMetaMonto] = useState("");
  const [metaPorPeriodo, setMetaPorPeriodo] = useState("");

  // Cálculo de sugerido para meta de ahorro (antes de useEffect)
  const periodos = useMemo(() => agruparPorPeriodo(movimientos), [movimientos]);
  const serie = useMemo(() => serieTendencia(periodos), [periodos]);
  const ahorrosActual = serie.length > 0 ? serie[serie.length - 1]!.ahorrosAcum : 0;

  const sugeridoPorPeriodo = useMemo(() => {
    if (!metaFecha || !metaMonto) return null;
    const meta = parseFloat(metaMonto);
    if (meta <= 0 || ahorrosActual >= meta) return null;

    const hoy = new Date();
    const [d, m, y] = metaFecha.split("/").map(Number);
    if (!d || !m || !y) return null;
    const fechaMeta = new Date(y, m - 1, d);

    if (fechaMeta <= hoy) return null;

    const periodosHastaFecha = periodos.filter((p) => {
      const pDate = parsePeriodoId(p.periodoId);
      return pDate < fechaMeta;
    }).length;

    if (periodosHastaFecha <= 0) return null;

    return Math.round(((meta - ahorrosActual) / periodosHastaFecha) * 100) / 100;
  }, [metaFecha, metaMonto, ahorrosActual, periodos]);

  // Sincronizar con config cuando carga o se actualiza
  useEffect(() => {
    if (config) {
      setMetaFecha(config.meta.metaFecha ?? "");
      setMetaMonto(config.meta.metaMonto?.toString() ?? "");
      setMetaPorPeriodo(config.meta.metaPorPeriodo?.toString() ?? "");
    }
  }, [config?.meta.metaFecha, config?.meta.metaMonto, config?.meta.metaPorPeriodo]);

  const saveConfig = async (newConfig: typeof config) => {
    if (!user?.uid || !newConfig) return;
    setGuardando(true);
    try {
      await setDoc(doc(db, `users/${user.uid}/config/meta`), newConfig);
      refresh();
    } catch (err) { console.error(err); }
    finally { setGuardando(false); }
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
      setSyncMsg({ ok: true, text: data.message });
    } catch (err: unknown) {
      setSyncMsg({ ok: false, text: err instanceof Error ? err.message : "Error al sincronizar" });
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMsg(null), 4000);
    }
  };

  if (loading || !config) return (
    <div className="page">
      <div className="loading-pulse" style={{ fontSize: 11, color: "var(--muted)", letterSpacing: 3, textAlign: "center", paddingTop: 60 }}>CARGANDO...</div>
    </div>
  );

  const toggleCategoria = (nombre: string) =>
    saveConfig({ ...config, categorias: config.categorias.map(c => c.nombre === nombre ? { ...c, activa: !c.activa } : c) });

  const toggleMedio = (nombre: string) =>
    saveConfig({ ...config, mediosPago: config.mediosPago.map(m => m.nombre === nombre ? { ...m, activo: !m.activo } : m) });

  const toggleOrigen = (nombre: string) =>
    saveConfig({ ...config, origenesAhorro: config.origenesAhorro.map(o => o.nombre === nombre ? { ...o, activo: !o.activo } : o) });

  const agregarCategoria = () => {
    if (!nuevoNombre.trim()) return;
    saveConfig({ ...config, categorias: [...config.categorias, { id: nuevoNombre, nombre: nuevoNombre.trim(), tipo: nuevoTipo, activa: true }] });
    setNuevoNombre("");
  };

  const agregarMedio = () => {
    if (!nuevoNombre.trim()) return;
    saveConfig({ ...config, mediosPago: [...config.mediosPago, { id: nuevoNombre, nombre: nuevoNombre.trim(), activo: true }] });
    setNuevoNombre("");
  };

  const agregarOrigen = () => {
    if (!nuevoNombre.trim()) return;
    saveConfig({ ...config, origenesAhorro: [...config.origenesAhorro, { id: nuevoNombre, nombre: nuevoNombre.trim(), activo: true }] });
    setNuevoNombre("");
  };

  const guardarMeta = () =>
    saveConfig({ ...config, meta: { usdMensual: parseFloat(metaUSD) || config.meta.usdMensual, tipoCambioRef: (tipoCambio || config.meta.tipoCambioRef) as "blue" | "oficial" } });

  // Agrupar toggles de reportes por sección
  const seccionesReporte = ["gastos", "periodos", "tendencias"] as const;

  const guardarMetaAhorro = async () => {
    if (!config) return;
    setGuardando(true);
    const newMeta = { ...config.meta };
    if (metaFecha) newMeta.metaFecha = metaFecha;
    else delete newMeta.metaFecha;
    if (metaMonto) newMeta.metaMonto = parseFloat(metaMonto);
    else delete newMeta.metaMonto;
    if (metaPorPeriodo) newMeta.metaPorPeriodo = parseFloat(metaPorPeriodo);
    else delete newMeta.metaPorPeriodo;
    newMeta.metaMoneda = "USD";
    await saveConfig({ ...config, meta: newMeta });
    setGuardando(false);
  };

  return (
    <div className="page fade-up">

      <div style={{ marginBottom: 24 }}>
        <div className="label" style={{ marginBottom: 2 }}>Preferencias</div>
        <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.5 }}>Config</div>
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
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>Exporta todos tus movimientos</div>
              </div>
              <button onClick={handleSync} disabled={syncing} style={{
                display: "flex", alignItems: "center", gap: 6,
                background: "var(--accent)", color: "#000",
                border: "none", borderRadius: "var(--radius-sm)",
                padding: "8px 14px", fontSize: 12, fontWeight: 700, cursor: syncing ? "default" : "pointer",
              }}>
                <svg className={syncing ? "spin" : ""} width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16"
                    stroke="#000" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {syncing ? "Sincronizando..." : "Sincronizar"}
              </button>
            </div>
          </div>

          <button onClick={async () => { await signOut(auth); router.push("/login"); }}
            className="btn" style={{ background: "transparent", border: "1px solid var(--red)", color: "var(--red)", marginTop: 8 }}>
            Cerrar sesión
          </button>
        </div>
      )}

      {/* ── MOVIMIENTOS ── */}
      {tab === "movimientos" && (
        <div key="movimientos" className="fade-up" style={{ display: "flex", flexDirection: "column", gap: 12 }}>

          {/* Sub-pills */}
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

          {/* Categorías */}
          {movSub === "categorias" && (
            <div className="card">
              <div className="label">Categorías</div>
              {config.categorias.map(c => (
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
                  <Toggle activo={c.activa} onClick={() => toggleCategoria(c.nombre)} />
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
                <button onClick={agregarCategoria} disabled={guardando}
                  style={{ background: "var(--green)", color: "var(--bg)", border: "none", borderRadius: "var(--radius-sm)", padding: "12px 16px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                  +
                </button>
              </div>
            </div>
          )}

          {/* Medios de pago */}
          {movSub === "medios" && (
            <div className="card">
              <div className="label">Medios de pago</div>
              {config.mediosPago.map(m => (
                <div key={m.nombre} className="row">
                  <span style={{ fontSize: 12, color: m.activo ? "var(--text)" : "var(--muted)" }}>{m.nombre}</span>
                  <Toggle activo={m.activo} onClick={() => toggleMedio(m.nombre)} />
                </div>
              ))}
              <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
                <input value={nuevoNombre} onChange={e => setNuevoNombre(e.target.value)}
                  placeholder="Nuevo medio" className="input" style={{ flex: 1 }} />
                <button onClick={agregarMedio} disabled={guardando}
                  style={{ background: "var(--green)", color: "var(--bg)", border: "none", borderRadius: "var(--radius-sm)", padding: "12px 16px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                  +
                </button>
              </div>
            </div>
          )}

          {/* Orígenes de ahorro */}
          {movSub === "origenes" && (
            <div className="card">
              <div className="label">Orígenes de ahorro</div>
              <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 12, marginTop: -6 }}>Aparecen al cargar Ingreso → Ahorros</div>
              {config.origenesAhorro.map(o => (
                <div key={o.nombre} className="row">
                  <span style={{ fontSize: 12, color: o.activo ? "var(--text)" : "var(--muted)" }}>{o.nombre}</span>
                  <Toggle activo={o.activo} onClick={() => toggleOrigen(o.nombre)} />
                </div>
              ))}
              <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
                <input value={nuevoNombre} onChange={e => setNuevoNombre(e.target.value)}
                  placeholder="Nuevo origen" className="input" style={{ flex: 1 }} />
                <button onClick={agregarOrigen} disabled={guardando}
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
          <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>
            Activá o desactivá cada sección de Reportes
          </div>
          {seccionesReporte.map((sec) => {
            const items = REPORTES_TOGGLES.filter((r) => r.seccion === sec);
            return (
              <div key={sec} className="card">
                <div className="label">{SECCION_LABEL[sec]}</div>
                {items.map((r) => (
                  <div key={r.id} className="row">
                    <span style={{ fontSize: 13, color: isEnabled(r.id) ? "var(--text)" : "var(--muted)" }}>{r.label}</span>
                    <Toggle activo={isEnabled(r.id)} onClick={() => toggleReport(r.id)} />
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* ── AHORROS ── */}
      {tab === "ahorros" && (
        <div key="ahorros" className="fade-up" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Meta de ahorro a fecha */}
          <div className="card">
            <div className="label">Meta de ahorro</div>
            <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 12, marginTop: -4 }}>
              Ahorros actuales: <strong>{ahorrosActual.toLocaleString("es-AR")}</strong>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div className="label" style={{ marginBottom: 6 }}>Fecha objetivo</div>
              <input type="text" value={metaFecha} placeholder="dd/MM/yyyy"
                onChange={(e) => setMetaFecha(e.target.value)} className="input" />
            </div>
            <div style={{ marginBottom: 16 }}>
              <div className="label" style={{ marginBottom: 6 }}>Monto objetivo (USD)</div>
              <input type="number" value={metaMonto} placeholder="0"
                onChange={(e) => setMetaMonto(e.target.value)} className="input" />
            </div>
            <button onClick={guardarMetaAhorro} disabled={guardando} className="btn btn-primary" style={{ width: "100%" }}>
              {guardando ? "Guardando..." : "Guardar meta"}
            </button>
          </div>

          {/* Por período sugerido */}
          <div className="card">
            <div className="label">Por período</div>
            {sugeridoPorPeriodo !== null && (
              <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 12, marginTop: -4 }}>
                Sugerido: <strong>USD {sugeridoPorPeriodo.toLocaleString("es-AR")}</strong>
              </div>
            )}
            <div style={{ marginBottom: 16 }}>
              <div className="label" style={{ marginBottom: 6 }}>Cantidad por período</div>
              <input type="number" value={metaPorPeriodo} placeholder={sugeridoPorPeriodo?.toString() ?? "0"}
                onChange={(e) => setMetaPorPeriodo(e.target.value)} className="input" />
            </div>
            <button onClick={guardarMetaAhorro} disabled={guardando} className="btn btn-primary" style={{ width: "100%" }}>
              {guardando ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </div>
      )}

      {/* Toast sync */}
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
