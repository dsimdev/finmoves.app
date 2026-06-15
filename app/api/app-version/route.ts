import { NextResponse } from "next/server";
import { REQUIRE_UPDATE } from "@/lib/app-version";

export const dynamic = "force-dynamic";

// Lo consultan los clientes para saber si hay una versión nueva y si es de
// actualización obligatoria. Si `required` es true y la versión del server difiere
// de la que corre el cliente, este muestra el banner "Actualizar" persistente.
export function GET() {
  return NextResponse.json(
    { version: process.env.NEXT_PUBLIC_APP_VERSION ?? "0", required: REQUIRE_UPDATE },
    { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
  );
}
