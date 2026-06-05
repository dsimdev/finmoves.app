"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useConfig } from "@/hooks/useConfig";
import { doc, setDoc } from "firebase/firestore";
import { db, auth } from "@/services/firebase/firebase";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";

type SeccionId = "categorias" | "medios" | "origenes" | "meta";

const SECCIONES: { id: SeccionId; label: string }[] = [
  { id: "categorias", label: "Categorías" },
  { id: "medios", label: "Medios" },
  { id: "origenes", label: "Orígenes" },
  { id: "meta", label: "Meta" },
];

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
  const { config, loading } = useConfig(user?.uid);
  const router = useRouter();
  const [seccion, setSeccion] = useState<SeccionId>("categorias");
  const [guardando, setGuardando] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoTipo, setNuevoTipo] = useState<"Gasto" | "Ingreso">("Gasto");
  const [metaUSD, setMetaUSD] = useState("");
  const [tipoCambio, setTipoCambio] = useState<"blue" | "oficial" | "mep">("blue");

  const saveConfig = async (newConfig: typeof config) => {
    if (!user?.uid || !newConfig) return;
    setGuardando(true);
    try {
      await setDoc(doc(db, `users/${user.uid}/config/meta`), newConfig);
      window.location.reload();
    } catch (err) { console.error(err); }
    finally { setGuardando(false); }
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
    saveConfig({ ...config, meta: { usdMensual: parseFloat(metaUSD) || config.meta.usdMensual, tipoCambioRef: tipoCambio || config.meta.tipoCambioRef } });

  return (
    <div className="page fade-up">

      <div style={{ marginBottom: 24 }}>
        <div className="label" style={{ marginBottom: 2 }}>Preferencias</div>
        <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.5 }}>Config</div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {SECCIONES.map(s => (
          <button key={s.id} onClick={() => { setSeccion(s.id); setNuevoNombre(""); }}
            className="pill"
            style={{
              borderColor: seccion === s.id ? "var(--accent)" : "var(--border)",
              background: seccion === s.id ? "var(--accent-dim)" : "transparent",
              color: seccion === s.id ? "var(--accent)" : "var(--muted)",
            }}>
            {s.label}
          </button>
        ))}
      </div>

      {/* Categorías */}
      {seccion === "categorias" && (
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
            <input value={nuevoNombre} onChange={e => setNuevoNombre(e.target.value)} placeholder="Nueva categoría" className="input" style={{ flex: 1 }} />
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
      {seccion === "medios" && (
        <div className="card">
          <div className="label">Medios de pago</div>
          {config.mediosPago.map(m => (
            <div key={m.nombre} className="row">
              <span style={{ fontSize: 12, color: m.activo ? "var(--text)" : "var(--muted)" }}>{m.nombre}</span>
              <Toggle activo={m.activo} onClick={() => toggleMedio(m.nombre)} />
            </div>
          ))}
          <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
            <input value={nuevoNombre} onChange={e => setNuevoNombre(e.target.value)} placeholder="Nuevo medio" className="input" style={{ flex: 1 }} />
            <button onClick={agregarMedio} disabled={guardando}
              style={{ background: "var(--green)", color: "var(--bg)", border: "none", borderRadius: "var(--radius-sm)", padding: "12px 16px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
              +
            </button>
          </div>
        </div>
      )}

      {/* Orígenes ahorro */}
      {seccion === "origenes" && (
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
            <input value={nuevoNombre} onChange={e => setNuevoNombre(e.target.value)} placeholder="Nuevo origen" className="input" style={{ flex: 1 }} />
            <button onClick={agregarOrigen} disabled={guardando}
              style={{ background: "var(--green)", color: "var(--bg)", border: "none", borderRadius: "var(--radius-sm)", padding: "12px 16px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
              +
            </button>
          </div>
        </div>
      )}

      {/* Meta USD */}
      {seccion === "meta" && (
        <div className="card">
          <div className="label">Meta de ahorro</div>
          <div style={{ marginBottom: 16 }}>
            <div className="label">USD por período</div>
            <input type="number" defaultValue={config.meta.usdMensual} onChange={e => setMetaUSD(e.target.value)} className="input" />
          </div>
          <div style={{ marginBottom: 20 }}>
            <div className="label">Tipo de cambio referencia</div>
            <div style={{ display: "flex", gap: 6 }}>
              {(["blue", "oficial", "mep"] as const).map(t => (
                <button key={t} type="button" onClick={() => setTipoCambio(t)}
                  className="pill"
                  style={{
                    borderColor: (tipoCambio || config.meta.tipoCambioRef) === t ? "var(--blue)" : "var(--border)",
                    background: (tipoCambio || config.meta.tipoCambioRef) === t ? "var(--blue-dim)" : "transparent",
                    color: (tipoCambio || config.meta.tipoCambioRef) === t ? "var(--blue)" : "var(--muted)",
                  }}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <button onClick={guardarMeta} disabled={guardando} className="btn btn-primary" style={{ width: "100%" }}>
            {guardando ? "Guardando..." : "Guardar"}
          </button>
        </div>
      )}

      <div style={{ marginTop: 32, textAlign: "center" }}>
        <button onClick={async () => { await signOut(auth); router.push("/login"); }}
          className="btn" style={{ background: "transparent", border: "1px solid var(--red)", color: "var(--red)" }}>
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
