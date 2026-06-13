"use client";

import { createContext, useContext, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useAllMovimientos } from "@/hooks/useAllMovimientos";
import { useConfig } from "@/hooks/useConfig";
import type { Movimiento, ConfigUsuario } from "@/types";

interface DataCtx {
  movimientos: Movimiento[];
  loading: boolean;        // carga de movimientos
  refresh: () => void;     // re-fetch de movimientos (tras escribir)
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
  const { movimientos, loading, refresh } = useAllMovimientos(user?.uid);
  const { config, loading: configLoading, refresh: refreshConfig } = useConfig(user?.uid);

  // Usuario nuevo sin onboarding completado → al wizard.
  useEffect(() => {
    if (config && config.meta.onboardingCompleto === false) router.replace("/onboarding");
  }, [config, router]);

  return (
    <Ctx.Provider value={{ movimientos, loading, refresh, config, configLoading, refreshConfig }}>
      {children}
    </Ctx.Provider>
  );
}

export function useData(): DataCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useData debe usarse dentro de <DataProvider>");
  return c;
}
