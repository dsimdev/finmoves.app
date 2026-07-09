"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useData } from "../data-context";
import { agruparPorPeriodo } from "@/utils/periodo";
import { AreaChart, Stat } from "@/components/reports/charts";
import { abbr } from "@/components/reports/format";
import { useMoney } from "@/hooks/useHideValues";
import { useT } from "@/hooks/useTranslation";
import type { Movimiento } from "@/types";

// Acá NO hay selector de período (abarca todo el historial), así que las fechas llevan
// año (d/m/aa) para que no se confundan cuando se repiten entre años.
const yy = (y: string) => (y && y.length === 4 ? y.slice(2) : y || "");
// fecha del movimiento (ISO "YYYY-MM-DD" o "D/M/YYYY") → "d/m/aa".
const diaLabel = (f: string) => {
  if (f.includes("-")) { const [y, m, d] = f.split("-"); return `${+d}/${+m}/${yy(y)}`; }
  const [d, m, y] = f.split("/"); return `${d}/${m}/${yy(y)}`;
};
// periodoId "D/M/YYYY" → "d/m/aa".
const perLabel = (pid: string) => { const [d, m, y] = pid.split("/"); return `${d}/${m}/${yy(y)}`; };

// Color del punto según el tipo (mismo lenguaje que el resto de la app).
function dotColor(m: Movimiento): string {
  if (m.categoria === "RESTO") return "var(--blue)";
  if (m.tipo === "Gasto") return "var(--red)";
  if (m.tipo === "Ingreso") return m.categoria === "Ahorros" ? "var(--blue)" : "var(--green)";
  if (m.tipo === "Move") return m.direccionMove === "aAhorro" ? "var(--purple)" : "var(--teal)";
  return "var(--yellow)";
}

// Filtro avanzado de movimientos + evolución por período. Pensado para ir sumando
// criterios (hoy: texto/descripción y categorías). Todo client-side.
export default function AnalisisPage() {
  const router = useRouter();
  const { movimientos } = useData();
  const { m: money } = useMoney();
  const t = useT();

  const [texto, setTexto] = useState("");
  const [cats, setCats] = useState<Set<string>>(new Set());
  const [catQuery, setCatQuery] = useState("");
  const [catFocus, setCatFocus] = useState(false);
  const [openGrupo, setOpenGrupo] = useState<string | null>(null);
  const toggleCat = (c: string) =>
    setCats((prev) => { const n = new Set(prev); if (n.has(c)) n.delete(c); else n.add(c); return n; });

  const activo = texto.trim().length > 0 || cats.size > 0;

  const matches = useMemo(() => {
    if (!activo) return [];
    // Match por palabras: todas las palabras del texto deben aparecer (en cualquier
    // orden) en observación + descripción + categoría. Así "aubasa dock sud" matchea
    // aunque en la observación estén separadas o en otro orden.
    const tokens = texto.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return movimientos.filter((m) => {
      if (cats.size > 0 && !cats.has(m.categoria)) return false;
      if (tokens.length) {
        const hay = `${m.observaciones || ""} ${m.descripcion || ""} ${m.categoria || ""}`.toLowerCase();
        if (!tokens.every((tok) => hay.includes(tok))) return false;
      }
      return true;
    });
  }, [movimientos, texto, cats, activo]);

  const total = matches.reduce((s, m) => s + m.monto, 0);

  // Evolución: total del filtro por período, en orden cronológico (viejo → nuevo).
  const serie = useMemo(() => {
    const sum = new Map<string, number>();
    for (const m of matches) sum.set(m.periodoId, (sum.get(m.periodoId) ?? 0) + m.monto);
    // Convención de la app: el período MÁS RECIENTE va a la IZQUIERDA (reciente primero).
    // agruparPorPeriodo ya devuelve más nuevo → más viejo, así que NO se invierte.
    const orden = agruparPorPeriodo(movimientos).map((p) => p.periodoId);
    return orden.filter((pid) => sum.has(pid)).map((pid) => ({
      label: perLabel(pid), value: sum.get(pid)!, color: "var(--accent)", valueLabel: abbr(sum.get(pid)!), periodoId: pid,
    }));
  }, [matches, movimientos]);

  // Agrupar por descripción (misma descripción = una fila): Peajes, Súper, etc. Cada
  // grupo se abre para ver el detalle por día. Ordenados por total (los que más pesan).
  const grupos = useMemo(() => {
    const map = new Map<string, { label: string; movs: Movimiento[]; total: number }>();
    for (const m of matches) {
      const label = (m.descripcion?.trim() || m.categoria || "—");
      const key = label.toLowerCase();
      const g = map.get(key) ?? { label, movs: [], total: 0 };
      g.movs.push(m); g.total += m.monto;
      map.set(key, g);
    }
    return [...map.entries()].map(([key, g]) => {
      // Detalle por día: misma fecha (dentro del grupo = misma descripción) → sumado,
      // así una descripción con cientos de cargas no arma un scroll infinito.
      const diaMap = new Map<string, { total: number; count: number }>();
      for (const m of g.movs) {
        const d = diaMap.get(m.fecha) ?? { total: 0, count: 0 };
        d.total += m.monto; d.count += 1;
        diaMap.set(m.fecha, d);
      }
      const dias = [...diaMap.entries()].map(([fecha, d]) => ({ fecha, total: d.total, count: d.count }))
        .sort((a, b) => b.fecha.localeCompare(a.fecha));
      return { key, label: g.label, total: g.total, count: g.movs.length, color: dotColor(g.movs[0]), dias };
    }).sort((a, b) => b.total - a.total);
  }, [matches]);

  const categorias = useMemo(
    () => [...new Set(movimientos.map((m) => m.categoria).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [movimientos],
  );
  // Sugerencias de categoría según lo que se escribe (son muchas → se buscan, no se listan todas).
  const catSugerencias = useMemo(() => {
    const q = catQuery.trim().toLowerCase();
    return categorias.filter((c) => !cats.has(c) && (!q || c.toLowerCase().includes(q))).slice(0, 8);
  }, [categorias, cats, catQuery]);

  return (
    <div className="page fade-up">
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
        <button onClick={() => router.back()} aria-label={t.back} style={{ background: "none", border: "none", color: "var(--text)", cursor: "pointer", padding: 4, display: "flex", marginLeft: -4 }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
        </button>
        <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.4 }}>{t.analyzeTitle}</h1>
      </div>

      {/* Filtro: texto (observación/descripción) + categorías por combobox con búsqueda. */}
      <input
        className="input" value={texto} onChange={(e) => setTexto(e.target.value)}
        placeholder={t.analyzeSearchPlaceholder} enterKeyHint="search"
        style={{ marginBottom: 10 }}
      />

      {cats.size > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
          {[...cats].map((c) => (
            <span key={c} style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "var(--accent-dim)", color: "var(--accent)", border: "1px solid var(--accent)", borderRadius: 999, padding: "4px 6px 4px 11px", fontSize: 12.5, fontWeight: 600 }}>
              {c}
              <button type="button" onClick={() => toggleCat(c)} aria-label={t.removeReceipt} style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontSize: 16, lineHeight: 1, padding: "0 2px" }}>×</button>
            </span>
          ))}
        </div>
      )}
      <div style={{ position: "relative", marginBottom: 18 }}>
        <input
          className="input" value={catQuery} onChange={(e) => setCatQuery(e.target.value)}
          onFocus={() => setCatFocus(true)} onBlur={() => setTimeout(() => setCatFocus(false), 120)}
          placeholder={t.analyzeCategoryPlaceholder}
        />
        {catFocus && catSugerencias.length > 0 && (
          <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 20, marginTop: 4, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", boxShadow: "0 8px 24px rgba(0,0,0,0.35)", maxHeight: 260, overflowY: "auto" }}>
            {catSugerencias.map((c) => (
              <button key={c} type="button" onMouseDown={(e) => { e.preventDefault(); toggleCat(c); setCatQuery(""); }} style={{
                display: "block", width: "100%", textAlign: "left", background: "none", border: "none",
                borderTop: "1px solid var(--faint)", padding: "12px 14px", fontSize: 14, color: "var(--text)", cursor: "pointer",
              }}>{c}</button>
            ))}
          </div>
        )}
      </div>

      {!activo ? (
        <div className="soft" style={{ textAlign: "center", padding: 32, color: "var(--muted)", fontSize: 13 }}>{t.analyzeEmpty}</div>
      ) : matches.length === 0 ? (
        <div className="soft" style={{ textAlign: "center", padding: 32, color: "var(--muted)", fontSize: 13 }}>{t.analyzeNoResults}</div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
            <Stat label={t.analyzeTotal} value={money(total)} color="var(--accent)" dimVar="var(--accent-dim)" />
            <Stat label={t.analyzeCount} value={String(matches.length)} sub={t.analyzeAcrossPeriods(serie.length)} />
          </div>

          {serie.length > 1 && (
            <div className="soft" style={{ padding: "14px 12px", marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6, marginLeft: 4 }}>{t.analyzeEvolution}</div>
              <AreaChart data={serie} />
            </div>
          )}

          {/* Grupos por descripción (colapsados); abrir muestra el detalle por día. */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {grupos.map((g) => {
              const abierto = openGrupo === g.key;
              return (
                <div key={g.key} className="card" style={{ padding: 0, overflow: "hidden" }}>
                  <button onClick={() => setOpenGrupo(abierto ? null : g.key)} style={{
                    width: "100%", background: "none", border: "none", cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 10, padding: "13px 14px", textAlign: "left",
                  }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: g.color, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{g.label}</div>
                      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{t.analyzeTimes(g.count)} · {t.analyzeDays(g.dias.length)}</div>
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 700, fontFamily: "var(--font-mono)", flexShrink: 0 }}>{money(g.total)}</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, transform: abierto ? "rotate(180deg)" : "none", transition: "transform .2s" }}><polyline points="6 9 12 15 18 9" /></svg>
                  </button>
                  {abierto && (
                    <div style={{ borderTop: "1px solid var(--faint)", maxHeight: 300, overflowY: "auto" }}>
                      {g.dias.map((d) => (
                        <div key={d.fecha} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "9px 14px 9px 32px", borderTop: "1px solid var(--faint)" }}>
                          <span style={{ fontSize: 12, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>
                            {diaLabel(d.fecha)}{d.count > 1 && <span style={{ marginLeft: 5, opacity: 0.7 }}>×{d.count}</span>}
                          </span>
                          <span style={{ fontSize: 13, fontWeight: 600, fontFamily: "var(--font-mono)" }}>{money(d.total)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
