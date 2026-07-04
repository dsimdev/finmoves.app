"use client";

import { useEffect, useState } from "react";
import { doubleBackEnabled, getDbgLog, clearDbgLog } from "@/lib/back-dispatcher";

// HUD de diagnóstico del doble-back. Visible SOLO con el flag `fmDoubleBack` ON.
// Muestra el log persistido en localStorage (sobrevive al cierre de la PWA, así al
// reabrir vemos qué pasó en el último back) + el estado de history en vivo. Temporal:
// se saca cuando el doble-back quede confirmado en Android.
export function BackDebugHud() {
  const [on, setOn] = useState(false);
  const [lines, setLines] = useState<string[]>([]);
  const [live, setLive] = useState("");
  const [open, setOpen] = useState(true);

  useEffect(() => { setOn(doubleBackEnabled()); }, []);

  useEffect(() => {
    if (!on) return;
    const tick = () => {
      setLines(getDbgLog());
      const st = window.history.state as { __fmTrap?: boolean } | null;
      setLive(`path=${window.location.pathname}  len=${window.history.length}  armed=${!!st?.__fmTrap}`);
    };
    tick();
    const id = setInterval(tick, 400);
    window.addEventListener("popstate", tick);
    return () => { clearInterval(id); window.removeEventListener("popstate", tick); };
  }, [on]);

  if (!on) return null;

  return (
    <div style={{
      position: "fixed", left: 6, right: 6, top: "calc(env(safe-area-inset-top, 0px) + 6px)",
      zIndex: 9999, fontFamily: "var(--font-mono, monospace)", fontSize: 10, lineHeight: 1.35,
      background: "rgba(0,0,0,0.86)", color: "#0f0", border: "1px solid #0f0", borderRadius: 8,
      padding: open ? "6px 8px" : "3px 8px", pointerEvents: "auto", maxHeight: "45vh", overflow: "auto",
    }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", color: "#9f9", marginBottom: open ? 4 : 0 }}>
        <button onClick={() => setOpen((v) => !v)} style={{ background: "none", border: "1px solid #0f0", color: "#0f0", borderRadius: 4, fontSize: 10, padding: "1px 6px" }}>{open ? "–" : "+"}</button>
        <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{live}</span>
        <button onClick={() => { clearDbgLog(); setLines([]); }} style={{ background: "none", border: "1px solid #0f0", color: "#0f0", borderRadius: 4, fontSize: 10, padding: "1px 6px" }}>clear</button>
      </div>
      {open && lines.map((l, i) => (
        <div key={i} style={{ whiteSpace: "pre-wrap", color: l.includes("->") ? "#ff0" : "#0f0" }}>{l}</div>
      ))}
    </div>
  );
}
