"use client";

import { createContext, useContext, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useAllMovimientos } from "@/hooks/useAllMovimientos";
import { useConfig } from "@/hooks/useConfig";
import { useAppPrefs } from "@/hooks/useAppPrefs";
import type { Movimiento, ConfigUsuario } from "@/types";

interface DataCtx {
  movimientos: Movimiento[];
  loading: boolean;        // carga de movimientos
  refresh: () => void;     // re-fetch de movimientos (tras escribir)
  updateMovimiento: (id: string, patch: Partial<Movimiento>) => void; // patch local (optimista)
  removeMovimiento: (id: string) => void;                              // quitar local (optimista)
  config: ConfigUsuario | null;
  configLoading: boolean;
  refreshConfig: () => void;
}

const Ctx = createContext<DataCtx | null>(null);

// Una única instancia de movimientos + config para todas las pestañas.
// Vive en el layout de tabs (que NO se desmonta al navegar entre pestañas),
// así se lee una sola vez por sesión en lugar de re-fetchear en cada montaje.
export function DataProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const router = useRouter();
  const { movimientos, loading, refresh, updateLocal, removeLocal } = useAllMovimientos(user?.uid);
  const { config, loading: configLoading, refresh: refreshConfig } = useConfig(user?.uid);
  const hydratePrefs = useAppPrefs((s) => s.hydrate);

  // Prefs por-usuario: la config (Firestore) es la fuente de verdad. Al cargarla,
  // hidratamos el store local para no arrastrar prefs de otro usuario del dispositivo.
  useEffect(() => {
    if (!config) return;
    hydratePrefs({
      monedaPrincipal: config.meta.monedaPrincipal,
      monedaInversiones: config.meta.monedaInversiones,
      showAhorros: config.meta.showAhorros,
      showReportes: config.meta.showReportes,
    });
  }, [config, hydratePrefs]);

  // Usuario nuevo sin onboarding completado → al wizard.
  useEffect(() => {
    if (config && config.meta.onboardingCompleto === false) router.replace("/onboarding");
  }, [config, router]);

  return (
    <Ctx.Provider value={{ movimientos, loading, refresh, updateMovimiento: updateLocal, removeMovimiento: removeLocal, config, configLoading, refreshConfig }}>
      {children}
    </Ctx.Provider>
  );
}

export function useData(): DataCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useData debe usarse dentro de <DataProvider>");
  return c;
}
