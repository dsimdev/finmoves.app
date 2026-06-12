"use client";

import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { signOut } from "firebase/auth";
import { auth } from "@/services/firebase/firebase";
import { BottomNav } from "@/components/BottomNav";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { UpdateBanner } from "@/components/UpdateBanner";
import { OfflineBanner } from "@/components/OfflineBanner";
import { LockScreen } from "@/components/LockScreen";
import { useInactivityLogout } from "@/hooks/useInactivityLogout";
import { isBiometricEnabledFor } from "@/lib/biometric";
import { useConfig } from "@/hooks/useConfig";

export default function TabsLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { config } = useConfig(user?.uid);
  const router = useRouter();

  // Usuario nuevo sin onboarding completado → al wizard.
  useEffect(() => {
    if (config && config.meta.onboardingCompleto === false) router.replace("/onboarding");
  }, [config, router]);

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
      <LockScreen
        onUnlock={() => setLockState("unlocked")}
        onUsePassword={async () => { await signOut(auth); }}
      />
    );
  }

  return (
    <>
      {children}
      <BottomNav />
      <UpdateBanner />
      <OfflineBanner />
    </>
  );
}
