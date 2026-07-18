"use client";

import { useEffect, useRef, useState } from "react";
import { doc, setDoc } from "firebase/firestore";
import { db } from "@/services/firebase/firebase";
import { agruparPorPeriodo } from "@/utils/periodo";
import { serieTendencia } from "@/utils/reportes";
import { reservaFX } from "@/utils/reserva";
import { hitoAFestejar } from "@/utils/meta-hitos";
import type { Movimiento, ConfigUsuario } from "@/types";

// Detecta el cruce de un hito (50/75/100%) de las metas de ahorro y devuelve cuál festejar.
// Vive en el DataProvider: ahí llegan TODOS los movimientos (no los 150 del cron) y el alta
// optimista actualiza la lista al instante, así que el confeti sale en el mismo momento en
// que el número cambia en pantalla.
//
// Los hitos festejados se persisten en config/meta (metaPropiaHitos / metaFXHitos) para que
// no se repitan al reinstalar. Se resetean solos al cambiar el monto de la meta: `firma`
// incluye el monto, así que un objetivo nuevo arranca con el contador limpio.

type Festejo = { hito: number; key: string };

export function useMetaHitos(
  uid: string | undefined,
  movimientos: Movimiento[],
  config: ConfigUsuario | null,
  patchConfigMeta: (patch: Partial<ConfigUsuario["meta"]>) => void,
) {
  const [festejo, setFestejo] = useState<Festejo | null>(null);
  // Evita re-disparar mientras el confeti está en pantalla o si el efecto se re-ejecuta.
  const enVuelo = useRef<string | null>(null);

  const meta = config?.meta;
  const montoPropia = meta?.metaPropia?.monto ?? 0;
  const montoFX = meta?.metaFX?.monto ?? meta?.metaMonto ?? 0;

  useEffect(() => {
    if (!uid || !config || movimientos.length === 0) return;

    // ── Meta propia (ahorros acumulados, moneda principal) ──
    if (montoPropia > 0) {
      const serie = serieTendencia(agruparPorPeriodo(movimientos), meta?.ahorrosAcumSeedPeriodoId ?? undefined);
      const acum = serie.length > 0 ? serie[serie.length - 1]!.ahorrosAcum : 0;
      const yaFestejados = meta?.metaPropiaHitos ?? [];
      const hito = hitoAFestejar(acum, montoPropia, yaFestejados);
      if (hito !== null) {
        const key = `propia-${montoPropia}-${hito}`;
        if (enVuelo.current !== key) {
          enVuelo.current = key;
          setFestejo({ hito, key });
          const nuevos = Array.from(new Set([...yaFestejados, hito])).sort((a, b) => a - b);
          patchConfigMeta({ metaPropiaHitos: nuevos });
          setDoc(doc(db, `users/${uid}/config/meta`), { meta: { metaPropiaHitos: nuevos } }, { merge: true }).catch(() => {});
        }
        return; // una celebración por vez: si además cruzó la FX, sale en el próximo cambio
      }
    }

    // ── Meta FX (reserva en divisa, sólo ARS) ──
    const esARS = !meta?.monedaPrincipal || meta.monedaPrincipal === "ARS";
    if (esARS && montoFX > 0) {
      const moneda: "USD" | "EUR" = meta?.metaFX?.moneda ?? "USD";
      const reserva = reservaFX(movimientos, moneda);
      const yaFestejados = meta?.metaFXHitos ?? [];
      const hito = hitoAFestejar(reserva, montoFX, yaFestejados);
      if (hito !== null) {
        const key = `fx-${moneda}-${montoFX}-${hito}`;
        if (enVuelo.current !== key) {
          enVuelo.current = key;
          setFestejo({ hito, key });
          const nuevos = Array.from(new Set([...yaFestejados, hito])).sort((a, b) => a - b);
          patchConfigMeta({ metaFXHitos: nuevos });
          setDoc(doc(db, `users/${uid}/config/meta`), { meta: { metaFXHitos: nuevos } }, { merge: true }).catch(() => {});
        }
      }
    }
  }, [uid, movimientos, config, meta, montoPropia, montoFX, patchConfigMeta]);

  return { festejo, cerrarFestejo: () => setFestejo(null) };
}
