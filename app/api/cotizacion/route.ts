import { NextResponse } from "next/server";

// Cotización cacheada en el SERVIDOR (compartida entre todos los usuarios y
// persistente entre cold starts), así un usuario nuevo no arranca sin datos.
export const revalidate = 1800; // 30 min

export async function GET() {
  try {
    const res = await fetch("https://api.bluelytics.com.ar/v2/latest", { next: { revalidate: 1800 } });
    if (!res.ok) throw new Error("upstream");
    const j = await res.json();
    return NextResponse.json({
      blue: j.blue?.value_sell ?? null,
      oficial: j.oficial?.value_sell ?? null,
      blue_euro: j.blue_euro?.value_sell ?? null,
      oficial_euro: j.oficial_euro?.value_sell ?? null,
    });
  } catch {
    return NextResponse.json({ error: "fetch-failed" }, { status: 502 });
  }
}
