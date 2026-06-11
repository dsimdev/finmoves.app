"use client";

import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { BottomNav } from "@/components/BottomNav";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { UpdateBanner } from "@/components/UpdateBanner";
import { OfflineBanner } from "@/components/OfflineBanner";
import { useInactivityLogout } from "@/hooks/useInactivityLogout";

export default function TabsLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useInactivityLogout(!!user);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  if (loading) return (
    <div style={{ background: "var(--bg)", color: "var(--text)", minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <LoadingSpinner />
    </div>
  );

  if (!user) return null;

  return (
    <>
      {children}
      <BottomNav />
      <UpdateBanner />
      <OfflineBanner />
    </>
  );
}
