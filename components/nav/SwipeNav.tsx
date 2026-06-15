"use client";

import { usePathname } from "next/navigation";
import { useSwipeNav } from "@/hooks/useSwipeNav";

/** Activa el swipe horizontal entre pestañas y aplica una transición suave al cambiar. */
export function SwipeNav({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  useSwipeNav();
  return (
    <div key={pathname} style={{ animation: "tabFade 220ms ease-out" }}>
      {children}
    </div>
  );
}
