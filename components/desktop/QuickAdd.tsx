"use client";

import { useState, useRef } from "react";
import { useT } from "@/hooks/useTranslation";
import { useAuth } from "@/hooks/useAuth";
import { crearMovimientoConId, nuevoMovimientoId } from "@/services/firebase/movimientos";
import { num } from "@/utils/movement-fx";
import type { Movimiento, ConfigUsuario } from "@/types";

// Carga rápida de escritorio: una fila de campos sobre la tabla para cargar gastos seguidos
// sin tocar el mouse (Tab entre campos, Enter guarda y vuelve al monto). Cubre el caso
// FRECUENTE (gasto simple); todo lo demás —ingresos, moves, divisa, comprobantes, apertura
// de período— sigue en el modal completo, al que se llega con "Nuevo movimiento".

const hoyISO = () => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
};

export function QuickAdd({ config, periodoId, onCreated, onRollback, onError }: {
  config: ConfigUsuario | null;
  /** Período al que se cargan los movimientos (el activo de la pantalla). */
  periodoId: string | null;
  onCreated: (movs: Movimiento[]) => void;
  /** Deshace el alta optimista si la escritura falla. */
  onRollback: (id: string) => void;
  onError: (msg: string) => void;
}) {
  const t = useT();
  const { user } = useAuth();
  const [monto, setMonto] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [categoria, setCategoria] = useState("");
  const [medioPago, setMedioPago] = useState("");
  const [guardando, setGuardando] = useState(false);
  const montoRef = useRef<HTMLInputElement>(null);

  const categorias = (config?.categorias ?? []).filter((c) => c.tipo === "Gasto" && c.activa);
  const medios = (config?.mediosPago ?? []).filter((m) => m.activo);
  // Defaults: la primera categoría y el primer medio, para poder cargar con sólo el monto.
  const catFinal = categoria || categorias[0]?.nombre || "";
  const medioFinal = medioPago || medios[0]?.nombre || "";

  const montoNum = num(monto);
  const puedeGuardar = montoNum > 0 && !!catFinal && !!periodoId && !guardando;

  const guardar = async () => {
    if (!puedeGuardar || !user?.uid) return;
    setGuardando(true);
    const uid = user.uid;
    const now = new Date();
    const fecha = hoyISO();

    const creados: Movimiento[] = [{
      id: nuevoMovimientoId(uid),
      timestampCarga: now, fecha, tipo: "Gasto",
      categoria: catFinal, descripcion: descripcion.trim(), monto: montoNum,
      medioPago: medioFinal, observaciones: observaciones.trim(), periodoId: periodoId!, userId: uid,
    }];

    // Optimista: la fila aparece ya y el foco vuelve al monto para seguir cargando. Si la
    // escritura falla, se avisa y se revierte (mismo criterio que el alta del modal).
    onCreated(creados);
    setMonto(""); setDescripcion(""); setObservaciones("");
    setGuardando(false);
    montoRef.current?.focus();

    try {
      await Promise.all(creados.map(({ id, ...data }) => crearMovimientoConId(uid, id, data)));
    } catch (err) {
      console.error("[QuickAdd] fallo al persistir, revierto", err);
      creados.forEach((m) => onRollback(m.id));
      onError(t.errSaveFailed);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); guardar(); }
  };

  return (
    <div className="quickadd" onKeyDown={onKeyDown}>
      <input
        ref={montoRef}
        className="qa-monto"
        value={monto}
        onChange={(e) => setMonto(e.target.value)}
        type="number"
        inputMode="decimal"
        placeholder={t.amount}
        aria-label={t.amount}
      />
      <input
        className="qa-desc"
        value={descripcion}
        onChange={(e) => setDescripcion(e.target.value)}
        placeholder={t.description}
        aria-label={t.description}
      />
      <input
        className="qa-obs"
        value={observaciones}
        onChange={(e) => setObservaciones(e.target.value)}
        placeholder={t.notes}
        aria-label={t.notes}
      />
      <select value={catFinal} onChange={(e) => setCategoria(e.target.value)} aria-label={t.category}>
        {categorias.map((c) => <option key={c.nombre} value={c.nombre}>{c.nombre}</option>)}
      </select>
      <select value={medioFinal} onChange={(e) => setMedioPago(e.target.value)} aria-label={t.paymentMethod}>
        {medios.map((m) => <option key={m.nombre} value={m.nombre}>{m.nombre}</option>)}
      </select>
      <button onClick={guardar} disabled={!puedeGuardar} className="qa-save">
        {t.save}
      </button>
    </div>
  );
}
