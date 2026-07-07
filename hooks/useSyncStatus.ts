"use client";

import { useSyncExternalStore } from "react";
import { pendingWrites, subscribeSync } from "@/lib/sync-status";

// Cantidad de writes de movimientos todavía sin confirmar por el server.
export function usePendingWrites(): number {
  return useSyncExternalStore(subscribeSync, pendingWrites, () => 0);
}
