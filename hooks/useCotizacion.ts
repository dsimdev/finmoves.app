"use client";

import { useEffect, useState } from "react";
import { Cotizacion } from "@/types";
import { getCotizacion } from "@/services/cotizacion";

export function useCotizacion() {
  const [cotizacion, setCotizacion] = useState<Cotizacion | null>(null);
  const [loading, setLoading] = useState(true);
  const [ultimaActualizacion, setUltimaActualizacion] = useState<Date | null>(null);
  const [minutosDesdeActualizacion, setMinutos] = useState<number | null>(null);

  useEffect(() => {
    getCotizacion().then((data) => {
      setCotizacion(data);
      setUltimaActualizacion(new Date());
      setMinutos(0);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!ultimaActualizacion) return;
    const id = setInterval(() => {
      setMinutos(Math.floor((Date.now() - ultimaActualizacion.getTime()) / 60000));
    }, 60000);
    return () => clearInterval(id);
  }, [ultimaActualizacion]);

  const refresh = async () => {
    setLoading(true);
    getCotizacion().then((data) => {
      setCotizacion(data);
      setUltimaActualizacion(new Date());
      setMinutos(0);
      setLoading(false);
    });
  };

  return { cotizacion, loading, minutosDesdeActualizacion, refresh };
}
