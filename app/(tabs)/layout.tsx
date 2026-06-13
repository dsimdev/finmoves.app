"use client";

import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { signOut } from "firebase/auth";
import { auth } from "@/services/firebase/firebase";
import { BottomNav } from "@/components/nav/BottomNav";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { UpdateBanner } from "@/components/pwa/UpdateBanner";
import { OfflineBanner } from "@/components/pwa/OfflineBanner";
import { LockScreen } from "@/components/pwa/LockScreen";
import { useInactivityLogout } from "@/hooks/useInactivityLogout";
import { isBiometricEnabledFor } from "@/lib/biometric";
import { DataProvider } from "./data-context";

export default function TabsLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  // Si hay desbloqueo biométrico configurado para este usuario, la app arranca
  // bloqueada hasta verificar la huella (gate de UI sobre la sesión activa).
  const [lockState, setLockState] = useState<"checking" | "locked" | "unlocked">("checking");
  useEffect(() => {
    if (loading || !user) return;
    setLockState(isBiometricEnabledFor(user.uid) ? "locked" : "unlocked");
  }, [loading, user]);

  useInactivityLogout(!!user);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  if (loading || (user && lockState === "checking")) return (
    <div style={{ background: "var(--bg)", color: "var(--text)", minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <LoadingSpinner />
    </div>
  );

  if (!user) return null;

  if (lockState === "locked") {
    return (
      <>
        <LockScreen
          onUnlock={() => setLockState("unlocked")}
          onUsePassword={async () => { await signOut(auth); }}
        />
        <UpdateBanner />
      </>
    );
  }

  return (
    <DataProvider>
      {children}
      <BottomNav />
      <UpdateBanner />
      <OfflineBanner />
    </DataProvider>
  );
}
