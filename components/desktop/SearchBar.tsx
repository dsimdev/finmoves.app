"use client";

import { useState, useRef } from "react";
import { useT } from "@/hooks/useTranslation";
import { movMatchesAny } from "@/utils/search";
import type { Movimiento } from "@/types";

// Buscador siempre visible de la tabla (escritorio). En móvil el filtro es un popover
// anclado a la lupa porque no hay lugar; acá la barra vive sobre la tabla y no la tapa.
// Misma semántica que MovementsFilter: términos como pills, OR entre ellos, palabra exacta.

export function SearchBar({ movs, movsGlobal, terms, onChange, onNew, todosPeriodos, onTodosPeriodosChange, seleccionActiva, onToggleSeleccion }: {
  /** Movimientos del período (para el preview de coincidencias mientras se tipea). */
  movs: Movimiento[];
  /** Todos los movimientos (preview cuando el ámbito es global). */
  movsGlobal: Movimiento[];
  terms: string[];
  onChange: (terms: string[]) => void;
  /** Alta de movimiento: en escritorio reemplaza al botón flotante del móvil. */
  onNew: () => void;
  /** Ámbito: período seleccionado (false) o todo el historial (true). */
  todosPeriodos: boolean;
  onTodosPeriodosChange: (v: boolean) => void;
  /** Modo selección: en escritorio no hay long-press, se entra con este botón. */
  seleccionActiva: boolean;
  onToggleSeleccion: () => void;
}) {
  const t = useT();
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const addTerm = () => {
    const v = input.trim();
    if (!v) return;
    if (!terms.some((x) => x.toLowerCase() === v.toLowerCase())) onChange([...terms, v]);
    setInput("");
  };
  const removeTerm = (v: string) => onChange(terms.filter((x) => x !== v));

  const preview = input.trim()
    ? (todosPeriodos ? movsGlobal : movs).filter((m) => movMatchesAny(m, [input.trim()])).length
    : null;

  return (
    <div className="searchbar">
      <div className="searchbar-input">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--muted)", flexShrink: 0 }}>
          <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); addTerm(); }
            // Backspace con el campo vacío borra el último término: atajo esperado en
            // cualquier input de tags.
            if (e.key === "Backspace" && !input && terms.length > 0) removeTerm(terms[terms.length - 1]);
            if (e.key === "Escape") { setInput(""); inputRef.current?.blur(); }
          }}
          placeholder={t.filterPlaceholder}
          aria-label={t.filterTitle}
        />
        {/* Cuántos coinciden con lo tipeado, antes de fijarlo como término. */}
        {preview !== null && (
          <span style={{ fontSize: 11, color: "var(--muted)", whiteSpace: "nowrap" }}>
            {preview > 0 ? t.filterPreview(preview) : (todosPeriodos ? t.filterNoResultsGlobal : t.filterNoResults)}
          </span>
        )}
      </div>

      {/* Ámbito de la búsqueda: con "todos los períodos" el selector de pills de arriba se
          reduce a los que tienen coincidencias. Mismo comportamiento que en móvil. */}
      <button
        type="button"
        role="switch"
        aria-checked={todosPeriodos}
        onClick={() => onTodosPeriodosChange(!todosPeriodos)}
        className="searchbar-pill"
        style={{
          background: todosPeriodos ? "var(--accent-dim)" : "transparent",
          borderColor: todosPeriodos ? "var(--accent)" : "var(--border)",
          color: todosPeriodos ? "var(--accent)" : "var(--muted)",
        }}
      >
        {t.filterAllPeriods}
      </button>

      {/* Términos fijados: cada uno es un OR con los demás. */}
      {terms.map((term) => (
        <button key={term} onClick={() => removeTerm(term)} className="searchbar-pill">
          {term}
          <span aria-hidden style={{ opacity: 0.6 }}>×</span>
        </button>
      ))}

      {/* El total y el promedio de lo filtrado los muestra la card de resumen debajo; acá
          solo la acción de limpiar, para no repetir los mismos números dos veces. */}
      {terms.length > 0 && (
        <button onClick={() => onChange([])} className="searchbar-clear">{t.filterClear}</button>
      )}

      {/* Entrada al modo selección: en escritorio no hay long-press. */}
      <button
        type="button"
        onClick={onToggleSeleccion}
        aria-pressed={seleccionActiva}
        className="searchbar-pill"
        style={{
          background: seleccionActiva ? "var(--accent-dim)" : "transparent",
          borderColor: seleccionActiva ? "var(--accent)" : "var(--border)",
          color: seleccionActiva ? "var(--accent)" : "var(--muted)",
        }}
      >
        {seleccionActiva ? t.cancel : t.select}
      </button>

      {/* Escalón siguiente de la carga rápida, no una alternativa equivalente: abre el modal
          completo para lo que la fila de arriba no cubre (ingresos, moves, divisa,
          comprobantes, otra fecha). Por eso es secundario y el verde queda para "Guardar". */}
      <button onClick={onNew} className="btn-full-entry">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        {t.fullEntry}
      </button>
    </div>
  );
}
