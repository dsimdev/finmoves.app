"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useAllMovimientos } from "@/hooks/useAllMovimientos";
import { useConfig } from "@/hooks/useConfig";
import { useAppPrefs } from "@/hooks/useAppPrefs";
import { listarRecurrentes, type Recurrente } from "@/services/firebase/recurrentes";
import { listarPlantillas, type Plantilla } from "@/services/firebase/plantillas";
import type { Movimiento, ConfigUsuario } from "@/types";

interface DataCtx {
  movimientos: Movimiento[];
  loading: boolean;
  refresh: () => void;
  updateMovimiento: (id: string, patch: Partial<Movimiento>) => void;
  removeMovimiento: (id: string) => void;
  prependMovimiento: (movs: Movimiento[]) => void;
  config: ConfigUsuario | null;
  configLoading: boolean;
  refreshConfig: () => void;
  recurrentes: Recurrente[];
  plantillas: Plantilla[];
  refreshRecurrentes: () => void;
  refreshPlantillas: () => void;
  mutateRecurrentes: React.Dispatch<React.SetStateAction<Recurrente[]>>;
  mutatePlantillas: React.Dispatch<React.SetStateAction<Plantilla[]>>;
}

const Ctx = createContext<DataCtx | null>(null);

// Una única instancia de movimientos + config para todas las pestañas.
// Vive en el layout de tabs (que NO se desmonta al navegar entre pestañas),
// así se lee una sola vez por sesión en lugar de re-fetchear en cada montaje.
export function DataProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const router = useRouter();
  const { movimientos, loading, refresh, updateLocal, removeLocal, prependLocal } = useAllMovimientos(user?.uid);
  const { config, loading: configLoading, refresh: refreshConfig } = useConfig(user?.uid);
  const hydratePrefs = useAppPrefs((s) => s.hydrate);

  // Recurrentes y plantillas: se leen una vez por sesión (antes se re-leían en cada
  // visita a Movimientos y en cada apertura del modal de alta, respectivamente).
  const [recurrentes, setRecurrentes] = useState<Recurrente[]>([]);
  const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
  const uid = user?.uid;
  useEffect(() => {
    if (!uid) { setRecurrentes([]); setPlantillas([]); return; }
    listarRecurrentes(uid).then(setRecurrentes).catch(() => {});
    listarPlantillas(uid).then(setPlantillas).catch(() => {});
  }, [uid]);
  const refreshRecurrentes = useCallback(() => { if (uid) listarRecurrentes(uid).then(setRecurrentes).catch(() => {}); }, [uid]);
  const refreshPlantillas = useCallback(() => { if (uid) listarPlantillas(uid).then(setPlantillas).catch(() => {}); }, [uid]);

  // Prefs por-usuario: la config (Firestore) es la fuente de verdad. Al cargarla,
  // hidratamos el store local para no arrastrar prefs de otro usuario del dispositivo.
  useEffect(() => {
    if (!config) return;
    // Permiso de Inversión gestionado por el dueño: si no lo tiene (y no es el dueño),
    // se fuerza showAhorros=false → no ve la pestaña ni la sección y no la puede reactivar.
    const isOwner = !!user?.email && user.email === process.env.NEXT_PUBLIC_OWNER_EMAIL;
    const inversionAllowed = isOwner || config.meta.permisos?.inversion === true;
    hydratePrefs({
      monedaPrincipal: config.meta.monedaPrincipal,
      monedaInversiones: config.meta.monedaInversiones,
      showAhorros: inversionAllowed ? config.meta.showAhorros : false,
      showReportes: config.meta.showReportes,
    });
  }, [config, hydratePrefs, user?.email]);

  // Usuario nuevo sin onboarding completado → al wizard.
  useEffect(() => {
    if (config && config.meta.onboardingCompleto === false) router.replace("/onboarding");
  }, [config, router]);

  return (
    <Ctx.Provider value={{ movimientos, loading, refresh, updateMovimiento: updateLocal, removeMovimiento: removeLocal, prependMovimiento: prependLocal, config, configLoading, refreshConfig, recurrentes, plantillas, refreshRecurrentes, refreshPlantillas, mutateRecurrentes: setRecurrentes, mutatePlantillas: setPlantillas }}>
      {children}
    </Ctx.Provider>
  );
}

export function useData(): DataCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useData debe usarse dentro de <DataProvider>");
  return c;
}
