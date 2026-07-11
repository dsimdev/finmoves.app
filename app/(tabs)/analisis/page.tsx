"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useData } from "../data-context";
import { agruparPorPeriodo } from "@/utils/periodo";
import { parsePeriodoId } from "@/utils/reportes";
import { MultiLineChart, Stat } from "@/components/reports/charts";
import { abbr } from "@/components/reports/format";
import { useMoney } from "@/hooks/useHideValues";
import { useT } from "@/hooks/useTranslation";
import type { Movimiento } from "@/types";

// Sin selector de período de la app → fechas con año (d/m/aa).
const yy = (y: string) => (y && y.length === 4 ? y.slice(2) : y || "");
const diaLabel = (f: string) => {
  if (f.includes("-")) { const [y, m, d] = f.split("-"); return `${+d}/${+m}/${yy(y)}`; }
  const [d, m, y] = f.split("/"); return `${d}/${m}/${yy(y)}`;
};
const perLabel = (pid: string) => { const [d, m, y] = pid.split("/"); return `${d}/${m}/${yy(y)}`; };

// Match por PALABRA EXACTA: "car" pega en la categoría "Car" pero NO en "carga"/"recarga".
const palabras = (s: string) => s.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
const termMatch = (textWords: Set<string>, term: string) => {
  const tw = palabras(term);
  return tw.length > 0 && tw.every((qw) => textWords.has(qw));
};

// Color para el grupo SELECCIONADO (por orden de selección; el total va en --accent).
// Los primeros son colores fuertes de marca; a partir de ahí se generan con golden-angle
// para que nunca se repitan aunque selecciones muchos grupos.
const SEED = ["var(--green)", "var(--yellow)", "var(--purple)", "var(--teal)", "#ff6e40", "#b388ff"];
const selPalette = (i: number) => {
  if (i < SEED.length) return SEED[i];
  const h = Math.round((i * 137.508) % 360); // ángulo áureo → hues bien separados
  return `hsl(${h} 70% 60%)`;
};

export default function AnalisisPage() {
  const router = useRouter();
  const { movimientos } = useData();
  const { m: money } = useMoney();
  const t = useT();

  const [input, setInput] = useState("");
  const [pills, setPills] = useState<string[]>([]);
  const [periodosSel, setPeriodosSel] = useState<Set<string>>(new Set());
  const [seleccionados, setSeleccionados] = useState<string[]>([]); // orden de selección → color estable
  const [openGrupo, setOpenGrupo] = useState<string | null>(null);

  const addPill = () => {
    const v = input.trim();
    if (!v) return;
    setPills((p) => (p.some((x) => x.toLowerCase() === v.toLowerCase()) ? p : [...p, v]));
    setInput("");
  };
  const removePill = (v: string) => setPills((p) => p.filter((x) => x !== v));
  const toggleSel = (key: string) => setSeleccionados((s) => (s.includes(key) ? s.filter((k) => k !== key) : [...s, key]));
  const togglePeriodo = (pid: string) => setPeriodosSel((s) => { const n = new Set(s); if (n.has(pid)) n.delete(pid); else n.add(pid); return n; });
  const selColor = (key: string) => { const i = seleccionados.indexOf(key); return i >= 0 ? selPalette(i) : null; };

  // Términos OR (pills + texto en curso): matchea cualquiera → se pueden juntar cosas de
  // distintas categorías para comparar.
  const terms = useMemo(() => [...pills, ...(input.trim() ? [input.trim()] : [])], [pills, input]);
  const activo = terms.length > 0;

  const matchesAll = useMemo(() => {
    if (!activo) return [];
    return movimientos.filter((m) => {
      const tw = new Set(palabras(`${m.categoria ?? ""} ${m.descripcion ?? ""} ${m.observaciones ?? ""}`));
      return terms.some((term) => termMatch(tw, term));
    });
  }, [movimientos, terms, activo]);

  const periodosAll = useMemo(() => {
    const orden = agruparPorPeriodo(movimientos).map((p) => p.periodoId); // reciente → viejo
    return orden.filter((pid) => matchesAll.some((m) => m.periodoId === pid));
  }, [matchesAll, movimientos]);
  // Ventana = períodos elegidos por el usuario (o todos si no eligió).
  const periodos = useMemo(() => (periodosSel.size ? periodosAll.filter((p) => periodosSel.has(p)) : periodosAll), [periodosAll, periodosSel]);
  const matches = useMemo(() => {
    if (!periodosSel.size) return matchesAll;
    return matchesAll.filter((m) => periodosSel.has(m.periodoId));
  }, [matchesAll, periodosSel]);

  // 2 períodos elegidos → comparativa directa (viejo → nuevo) en cada fila.
  const dos = useMemo(() => {
    if (periodosSel.size !== 2) return null;
    const [a, b] = [...periodos].sort((x, y) => parsePeriodoId(x).getTime() - parsePeriodoId(y).getTime());
    return { old: a, new: b };
  }, [periodosSel, periodos]);

  const analysis = useMemo(() => {
    if (matches.length === 0) return null;
    const totalPer = new Map<string, number>();
    for (const m of matches) totalPer.set(m.periodoId, (totalPer.get(m.periodoId) ?? 0) + m.monto);

    const gmap = new Map<string, Movimiento[]>();
    for (const m of matches) {
      const label = m.descripcion?.trim() || m.categoria || "—";
      const arr = gmap.get(label) ?? []; arr.push(m); gmap.set(label, arr);
    }
    const grupos = [...gmap.entries()].map(([label, movs]) => {
      const per = new Map<string, number>();
      for (const m of movs) per.set(m.periodoId, (per.get(m.periodoId) ?? 0) + m.monto);
      const dmap = new Map<string, { total: number; count: number; obs: Set<string> }>();
      for (const m of movs) {
        const d = dmap.get(m.fecha) ?? { total: 0, count: 0, obs: new Set<string>() };
        d.total += m.monto; d.count++; const o = m.observaciones?.trim(); if (o) d.obs.add(o);
        dmap.set(m.fecha, d);
      }
      const dias = [...dmap.entries()].map(([fecha, d]) => ({ fecha, total: d.total, count: d.count, obs: [...d.obs].join(", ") }))
        .sort((a, b) => b.fecha.localeCompare(a.fecha));
      return { key: label.toLowerCase(), label, total: movs.reduce((s, m) => s + m.monto, 0), count: movs.length, per, dias };
    }).sort((a, b) => b.total - a.total);

    return { totalPer, grupos, total: matches.reduce((s, m) => s + m.monto, 0) };
  }, [matches]);

  const chartSeries = useMemo(() => {
    if (!analysis) return [];
    const total = { key: "__total", color: "var(--accent)", width: 2.6, values: periodos.map((pid) => analysis.totalPer.get(pid) ?? 0) };
    const sel = seleccionados.map((key) => {
      const g = analysis.grupos.find((x) => x.key === key);
      if (!g) return null;
      return { key, color: selColor(key)!, values: periodos.map((pid) => g.per.get(pid) ?? 0) };
    }).filter(Boolean) as { key: string; color: string; values: number[] }[];
    return [total, ...sel];
  }, [analysis, seleccionados, periodos]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="page fade-up">
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
        <button onClick={() => router.back()} aria-label={t.back} style={{ background: "none", border: "none", color: "var(--text)", cursor: "pointer", padding: 4, display: "flex", marginLeft: -4 }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
        </button>
        <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.4 }}>{t.analyzeTitle}</h1>
      </div>

      {pills.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          {pills.map((p) => (
            <span key={p} style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "var(--accent-dim)", color: "var(--accent)", border: "1px solid var(--accent)", borderRadius: 999, padding: "4px 6px 4px 12px", fontSize: 13, fontWeight: 600 }}>
              {p}
              <button type="button" onClick={() => removePill(p)} aria-label={t.remove} style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontSize: 16, lineHeight: 1, padding: "0 2px" }}>×</button>
            </span>
          ))}
        </div>
      )}
      <div style={{ position: "relative", marginBottom: 14 }}>
        <input
          className="input" value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addPill(); } }}
          placeholder={t.analyzeSearchPlaceholder} enterKeyHint="search" style={{ paddingRight: 46 }}
        />
        <button type="button" onClick={addPill} disabled={!input.trim()} aria-label={t.add} style={{
          position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", width: 34, height: 34, borderRadius: 9, border: "none",
          background: input.trim() ? "var(--accent)" : "var(--surface-alt)", color: input.trim() ? "#fff" : "var(--muted)",
          display: "flex", alignItems: "center", justifyContent: "center", cursor: input.trim() ? "pointer" : "default",
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
        </button>
      </div>

      {!activo ? (
        <div className="soft" style={{ textAlign: "center", padding: 32, color: "var(--muted)", fontSize: 13 }}>{t.analyzeEmpty}</div>
      ) : !analysis ? (
        <div className="soft" style={{ textAlign: "center", padding: 32, color: "var(--muted)", fontSize: 13 }}>{t.analyzeNoResults}</div>
      ) : (
        <>
          {/* Selector de períodos (multi). Elegí 2 → comparativa directa de esos 2 en cada fila. */}
          {periodosAll.length > 1 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: "var(--muted)" }}>{dos ? t.analyzeComparing : t.analyzePeriodsHint}</span>
                {(periodosSel.size > 0 || seleccionados.length > 0) && (
                  <button type="button" onClick={() => { setPeriodosSel(new Set()); setSeleccionados([]); }} style={{
                    flexShrink: 0, background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontSize: 11, fontWeight: 600, padding: "2px 4px",
                  }}>{t.analyzeClearSel}</button>
                )}
              </div>
              <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2, scrollbarWidth: "none" }}>
                {periodosAll.map((pid) => {
                  const on = periodosSel.has(pid);
                  return (
                    <button key={pid} type="button" onClick={() => togglePeriodo(pid)} className="pill" style={{
                      flexShrink: 0, borderColor: on ? "var(--accent)" : "var(--border)", background: on ? "var(--accent-dim)" : "transparent", color: on ? "var(--accent)" : "var(--muted)",
                    }}>{perLabel(pid)}</button>
                  );
                })}
              </div>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
            <Stat label={t.analyzeTotal} value={money(analysis.total)} color="var(--accent)" dimVar="var(--accent-dim)" />
            <Stat label={t.analyzeCount} value={String(matches.length)} sub={t.analyzeAcrossPeriods(periodos.length)} />
          </div>

          {periodos.length > 1 && (
            <div className="soft" style={{ padding: "14px 12px", marginBottom: 8 }}>
              <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6, marginLeft: 4 }}>{t.analyzeEvolution}</div>
              <MultiLineChart labels={periodos.map(perLabel)} series={chartSeries} />
            </div>
          )}
          <div style={{ fontSize: 11, color: "var(--muted)", margin: "0 4px 14px" }}>{t.analyzeBreakdownHint}</div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {analysis.grupos.map((g) => {
              const abierto = openGrupo === g.key;
              const c = selColor(g.key);
              const sel = c != null;
              return (
                <div key={g.key} className="card" style={{ padding: 0, overflow: "hidden", border: `1px solid ${sel ? c : "var(--border)"}` }}>
                  <div style={{ display: "flex", alignItems: "stretch" }}>
                    <button onClick={() => toggleSel(g.key)} aria-pressed={sel} style={{
                      flex: 1, minWidth: 0, background: "none", border: "none", cursor: "pointer",
                      display: "flex", alignItems: "center", gap: 10, padding: "12px 4px 12px 14px", textAlign: "left",
                    }}>
                      <div style={{ width: 9, height: 9, borderRadius: "50%", flexShrink: 0, background: sel ? c : "var(--muted)", opacity: sel ? 1 : 0.45 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{g.label}</div>
                        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{t.analyzeTimes(g.count)} · {t.analyzeDays(g.dias.length)}</div>
                      </div>
                      {dos ? (() => {
                        const vo = g.per.get(dos.old) ?? 0, vn = g.per.get(dos.new) ?? 0;
                        const delta = vo > 0 ? Math.round(((vn - vo) / vo) * 100) : (vn > 0 ? null : 0);
                        const dc = delta == null ? "var(--muted)" : delta > 0 ? "var(--red)" : delta < 0 ? "var(--green)" : "var(--muted)";
                        return (
                          <div style={{ textAlign: "right", flexShrink: 0, fontFamily: "var(--font-mono)" }}>
                            <div style={{ fontSize: 12 }}>{abbr(vo)} <span style={{ color: "var(--muted)" }}>→</span> {abbr(vn)}</div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: dc, marginTop: 1 }}>{delta == null ? t.analyzeNew : `${delta > 0 ? "+" : ""}${delta}%`}</div>
                          </div>
                        );
                      })() : (
                        <span style={{ fontSize: 14, fontWeight: 700, fontFamily: "var(--font-mono)", flexShrink: 0 }}>{money(g.total)}</span>
                      )}
                    </button>
                    <button onClick={() => setOpenGrupo(abierto ? null : g.key)} aria-label={t.analyzeDetail} style={{
                      background: "none", border: "none", borderLeft: "1px solid var(--faint)", cursor: "pointer",
                      padding: "0 12px", color: "var(--muted)", display: "flex", alignItems: "center",
                    }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: abierto ? "rotate(180deg)" : "none", transition: "transform .2s" }}><polyline points="6 9 12 15 18 9" /></svg>
                    </button>
                  </div>
                  {abierto && (
                    <div style={{ borderTop: "1px solid var(--faint)", maxHeight: 300, overflowY: "auto" }}>
                      {g.dias.map((d, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "9px 14px 9px 32px", borderTop: i > 0 ? "1px solid var(--faint)" : "none" }}>
                          <span style={{ fontSize: 12, color: "var(--muted)", fontFamily: "var(--font-mono)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {diaLabel(d.fecha)}{d.count > 1 && <span style={{ marginLeft: 5, opacity: 0.7 }}>×{d.count}</span>}
                            {d.obs && <span style={{ marginLeft: 6, fontStyle: "italic", opacity: 0.85 }}>· {d.obs}</span>}
                          </span>
                          <span style={{ fontSize: 13, fontWeight: 600, fontFamily: "var(--font-mono)", flexShrink: 0 }}>{money(d.total)}</span>
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
