import { NextResponse } from "next/server";

// IPC (inflación) cacheado en el SERVIDOR. El cliente NO puede pegarle directo a argly:
// su API responde 200 pero SIN header CORS (Access-Control-Allow-Origin), así que el
// navegador bloquea la respuesta cross-origin. Desde el servidor no hay CORS; el cliente
// consume esta ruta (mismo origen) y recibe el histórico ya listo. Cache 6h (el IPC es
// mensual: no hace falta refrescar seguido).
export const revalidate = 21600; // 6 h

export async function GET() {
  try {
    const res = await fetch("https://api.argly.com.ar/v1/ipc?historico=true", { next: { revalidate: 21600 } });
    if (!res.ok) throw new Error("upstream");
    const j = await res.json();
    // Se devuelve `data` tal cual (array de {anio, mes, valor}) para no cambiar el parseo del cliente.
    return NextResponse.json({ data: j.data ?? [] });
  } catch {
    return NextResponse.json({ error: "fetch-failed" }, { status: 502 });
  }
}
