"use client";

import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { BottomNav } from "@/components/BottomNav";

export default function TabsLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  if (loading) return (
    <div style={{ background: "var(--bg)", color: "var(--text)", minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className="loading-pulse" style={{ fontSize: 12, color: "var(--muted)", letterSpacing: 3 }}>CARGANDO</div>
    </div>
  );

  if (!user) return null;

  return (
    <>
      {children}
      <BottomNav />
    </>
  );
}
