"use client";

import { useEffect, useState } from "react";
import { Cotizacion } from "@/types";
import { getCotizacion } from "@/services/cotizacion";

export function useCotizacion() {
  const [cotizacion, setCotizacion] = useState<Cotizacion | null>(null);
  const [loading, setLoading] = useState(true);
  const [ultimaActualizacion, setUltimaActualizacion] = useState<Date | null>(null);

  useEffect(() => {
    const fetch = async () => {
      const data = await getCotizacion();
      setCotizacion(data);
      setUltimaActualizacion(new Date());
      setLoading(false);
    };
    fetch();
  }, []);

  const minutosDesdeActualizacion = ultimaActualizacion
    ? Math.floor((Date.now() - ultimaActualizacion.getTime()) / 60000)
    : null;

  return { cotizacion, loading, minutosDesdeActualizacion };
}
