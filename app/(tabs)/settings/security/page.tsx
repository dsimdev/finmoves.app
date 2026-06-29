"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useT } from "@/hooks/useTranslation";
import { auth } from "@/services/firebase/firebase";
import { signOut, getIdToken } from "firebase/auth";
import { useAppPrefs } from "@/hooks/useAppPrefs";
import { platformAuthenticatorAvailable, isBiometricEnabledFor, registerBiometric, clearBiometric } from "@/lib/biometric";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { Toggle, SubHeader } from "../_shared";

export default function SecuritySettings() {
  const { user } = useAuth();
  const t = useT();
  const router = useRouter();

  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioEnabled, setBioEnabled] = useState(false);
  const [bioError, setBioError] = useState("");
  useEffect(() => {
    platformAuthenticatorAvailable().then(setBioAvailable);
    setBioEnabled(isBiometricEnabledFor(user?.uid));
  }, [user?.uid]);
  const toggleBiometric = async () => {
    setBioError("");
    if (bioEnabled) { clearBiometric(); setBioEnabled(false); return; }
    if (!user?.uid || !user.email) return;
    try { await registerBiometric(user.uid, user.email); setBioEnabled(true); }
    catch { setBioError(t.biometricEnableError); setTimeout(() => setBioError(""), 3000); }
  };

  const [confirmLogout, setConfirmLogout] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteRequested, setDeleteRequested] = useState(false);
  const handleRequestDeletion = async () => {
    if (!auth.currentUser) return;
    setDeleteBusy(true);
    try {
      const token = await getIdToken(auth.currentUser);
      await fetch("/api/account/request-deletion", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      setDeleteRequested(true); setShowDeleteConfirm(false);
    } catch { /* ignore */ } finally { setDeleteBusy(false); }
  };

  const row: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "14px 16px", marginBottom: 10 };
  const ic: React.CSSProperties = { width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 };

  return (
    <div className="page">
      <SubHeader title={t.security} />

      {bioAvailable && (
        <div style={row}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            <div style={{ ...ic, background: bioEnabled ? "var(--green-dim)" : "var(--surface-alt)", border: `1px solid ${bioEnabled ? "var(--green)44" : "var(--border)"}` }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={bioEnabled ? "var(--green)" : "var(--muted)"} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 11c0 3 0 6-1 8.5" /><path d="M8 11a4 4 0 0 1 8 0c0 3.5-.5 6-1.5 8" /><path d="M5 11a7 7 0 0 1 14 0c0 1.5 0 3-.3 4.5" /><path d="M3 9a9 9 0 0 1 4-3.5M21 9a9 9 0 0 0-4-3.5" />
              </svg>
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14 }}>{t.biometricUnlock}</div>
              <div style={{ fontSize: 11, color: bioError ? "var(--red)" : "var(--muted)", marginTop: 2 }}>{bioError || t.biometricUnlockSub}</div>
            </div>
          </div>
          <Toggle activo={bioEnabled} onClick={toggleBiometric} />
        </div>
      )}

      <button onClick={() => setConfirmLogout(true)} style={{ ...row, width: "100%", cursor: "pointer", textAlign: "left" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ ...ic, background: "var(--surface-alt)", border: "1px solid var(--border)", color: "var(--muted)" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          </div>
          <span style={{ fontSize: 14 }}>{t.signOut}</span>
        </div>
      </button>

      <button onClick={() => setShowDeleteConfirm(true)} style={{ ...row, width: "100%", cursor: "pointer", textAlign: "left" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ ...ic, background: "var(--red-dim)", border: "1px solid var(--red)44", color: "var(--red)" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
          </div>
          <span style={{ fontSize: 14, color: "var(--red)" }}>{t.deleteAccount}</span>
        </div>
      </button>

      {confirmLogout && (
        <ConfirmModal title={t.signOutTitle} confirmLabel={t.signOut} cancelLabel={t.cancel} confirmColor="var(--red)"
          onConfirm={async () => { useAppPrefs.getState().reset(); await signOut(auth); router.replace("/home"); }}
          onCancel={() => setConfirmLogout(false)}>{t.signOutBody}</ConfirmModal>
      )}

      {showDeleteConfirm && (
        <ConfirmModal title={t.deleteAccountTitle} confirmLabel={t.deleteAccountConfirm} cancelLabel={t.cancel} confirmColor="var(--red)" loading={deleteBusy}
          onConfirm={handleRequestDeletion} onCancel={() => setShowDeleteConfirm(false)}>
          <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>{t.deleteAccountBody}</div>
        </ConfirmModal>
      )}

      {deleteRequested && (
        <ConfirmModal title={t.deleteAccountSentTitle} confirmLabel={t.accept} cancelLabel="" confirmColor="var(--green)"
          onConfirm={() => setDeleteRequested(false)} onCancel={() => setDeleteRequested(false)}>
          <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>{t.deleteAccountSentBody}</div>
        </ConfirmModal>
      )}
    </div>
  );
}
