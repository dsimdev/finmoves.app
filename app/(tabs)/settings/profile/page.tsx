"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useData } from "../../data-context";
import { useAppPrefs } from "@/hooks/useAppPrefs";
import { useT } from "@/hooks/useTranslation";
import { db, auth } from "@/services/firebase/firebase";
import { doc, setDoc } from "firebase/firestore";
import { signOut, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from "firebase/auth";
import { linkGoogle, isGoogleLinked } from "@/lib/google-auth";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { SubHeader, FlagAR, FlagGB } from "../_shared";

export default function ProfileSettings() {
  const { user } = useAuth();
  const { config, refreshConfig: refresh } = useData();
  const { lang, setLang } = useAppPrefs();
  const t = useT();
  const router = useRouter();

  const [fotoError, setFotoError] = useState(false);
  const [googleLinked, setGoogleLinked] = useState(false);
  const [googleErr, setGoogleErr] = useState("");
  const [confirmUnlink, setConfirmUnlink] = useState(false);
  const [pendingLang, setPendingLang] = useState<"es" | "en" | null>(null);

  const [showChangePass, setShowChangePass] = useState(false);
  const [currentPassInput, setCurrentPassInput] = useState("");
  const [passInput, setPassInput] = useState("");
  const [passVisible, setPassVisible] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [profileBusy, setProfileBusy] = useState(false);

  useEffect(() => { setGoogleLinked(isGoogleLinked()); }, [user?.uid]);
  useEffect(() => { setFotoError(false); }, [config?.meta.fotoURL, googleLinked]);

  const handleLinkGoogle = async () => {
    if (googleLinked) return;
    setGoogleErr("");
    try { await linkGoogle(); setGoogleLinked(true); refresh(); }
    catch (err) {
      const code = (err as { code?: string })?.code;
      if (code !== "auth/popup-closed-by-user" && code !== "auth/cancelled-popup-request") {
        setGoogleErr(t.googleLinkErr); setTimeout(() => setGoogleErr(""), 4000);
      }
    }
  };
  const handleUnlinkGoogle = async () => {
    if (!auth.currentUser) return;
    try {
      const { unlink } = await import("firebase/auth");
      await unlink(auth.currentUser, "google.com");
      setGoogleLinked(false); setConfirmUnlink(false);
    } catch { setGoogleErr(t.googleUnlinkErr); setTimeout(() => setGoogleErr(""), 4000); setConfirmUnlink(false); }
  };

  const openChangePass = () => { setPassInput(""); setCurrentPassInput(""); setPassVisible(false); setProfileMsg(null); setShowChangePass(true); };
  const savePassword = async () => {
    if (profileBusy) return;
    if (passInput.length < 6) { setProfileMsg({ ok: false, text: t.regWeakPassword }); return; }
    if (!currentPassInput) { setProfileMsg({ ok: false, text: t.currentPasswordRequired }); return; }
    setProfileBusy(true); setProfileMsg(null);
    try {
      const cred = EmailAuthProvider.credential(auth.currentUser!.email!, currentPassInput);
      await reauthenticateWithCredential(auth.currentUser!, cred);
      await updatePassword(auth.currentUser!, passInput);
      setProfileMsg({ ok: true, text: t.passwordChangedRelogin });
      setPassInput(""); setCurrentPassInput("");
      setTimeout(async () => { useAppPrefs.getState().reset(); await signOut(auth); router.replace("/home"); }, 1400);
    } catch (err) {
      const code = (err as { code?: string })?.code ?? "";
      const text = code === "auth/wrong-password" || code === "auth/invalid-credential" ? t.wrongCurrentPassword
        : code === "auth/requires-recent-login" ? t.reauthNeeded : t.profileError;
      setProfileMsg({ ok: false, text });
    } finally { setProfileBusy(false); }
  };

  if (!config) return null;
  const googlePhoto = auth.currentUser?.providerData.find((p) => p.providerId === "google.com")?.photoURL;
  const fotoSrc = config.meta.fotoURL || googlePhoto || null;
  const card: React.CSSProperties = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 16, marginBottom: 12 };

  return (
    <div className="page">
      <SubHeader title={t.account} />

      {/* Tarjeta de perfil */}
      <div style={{ ...card, display: "flex", alignItems: "center", gap: 14 }}>
        {fotoSrc && !fotoError ? (
          <img src={fotoSrc} alt="" width={56} height={56} referrerPolicy="no-referrer" onError={() => setFotoError(true)} style={{ width: 56, height: 56, borderRadius: 16, objectFit: "cover", flexShrink: 0, border: "1px solid var(--green)44" }} />
        ) : (
          <div style={{ width: 56, height: 56, borderRadius: 16, background: config.meta.nombre ? "var(--green-dim)" : "var(--surface-alt)", border: `1px solid ${config.meta.nombre ? "var(--green)44" : "var(--border)"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="8" r="4" stroke={config.meta.nombre ? "var(--green)" : "var(--muted)"} strokeWidth="1.7" />
              <path d="M4 20c0-3.87 3.58-7 8-7s8 3.13 8 7" stroke={config.meta.nombre ? "var(--green)" : "var(--muted)"} strokeWidth="1.7" strokeLinecap="round" />
            </svg>
          </div>
        )}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{config.meta.nombre || t.user}</div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user?.email}</div>
        </div>
      </div>

      {/* Idioma */}
      <div style={{ ...card, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 14 }}>{t.language}</span>
        <div style={{ display: "flex", gap: 8 }}>
          {(["es", "en"] as const).map((l) => (
            <button key={l} onClick={() => { if (l !== lang) setPendingLang(l); }} aria-label={l === "es" ? "Español" : "English"}
              style={{ width: 38, height: 38, borderRadius: 10, border: `1px solid ${lang === l ? "var(--accent)44" : "var(--border)"}`, background: lang === l ? "var(--accent-dim)" : "var(--surface-alt)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", opacity: lang === l ? 1 : 0.55 }}>
              {l === "es" ? <FlagAR size={22} /> : <FlagGB size={22} />}
            </button>
          ))}
        </div>
      </div>

      {/* Contraseña */}
      <button onClick={openChangePass} style={{ ...card, width: "100%", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", textAlign: "left" }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--surface-alt)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "var(--muted)" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        </div>
        <span style={{ fontSize: 14, flex: 1 }}>{t.changePassword}</span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
      </button>

      {/* Google */}
      <div style={{ ...card, display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={googleLinked ? undefined : handleLinkGoogle} disabled={googleLinked} style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0, background: "none", border: "none", cursor: googleLinked ? "default" : "pointer", textAlign: "left", padding: 0 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: googleLinked ? "var(--green-dim)" : "var(--surface-alt)", border: `1px solid ${googleLinked ? "var(--green)44" : "var(--border)"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
              <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z" />
            </svg>
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14 }}>{googleLinked ? t.googleLinked : t.googleLink}</div>
            {(googleErr || !googleLinked) && <div style={{ fontSize: 11, color: googleErr ? "var(--red)" : "var(--muted)", marginTop: 2 }}>{googleErr || t.googleLinkSub}</div>}
          </div>
        </button>
        {googleLinked && (
          <button onClick={() => setConfirmUnlink(true)} style={{ flexShrink: 0, fontSize: 11, fontWeight: 600, color: "var(--muted)", background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "4px 10px", cursor: "pointer" }}>{t.googleUnlink}</button>
        )}
      </div>

      {showChangePass && (
        <ConfirmModal title={t.changePassword} confirmLabel={t.saveProfile} cancelLabel={t.cancel} confirmColor="var(--blue)" loading={profileBusy}
          onConfirm={savePassword} onCancel={() => { setShowChangePass(false); setPassInput(""); setCurrentPassInput(""); setProfileMsg(null); }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <input type="password" value={currentPassInput} onChange={(e) => setCurrentPassInput(e.target.value)} className="input" placeholder={t.currentPasswordPlaceholder} autoComplete="current-password" autoFocus />
            <div style={{ position: "relative" }}>
              <input type={passVisible ? "text" : "password"} value={passInput} onChange={(e) => setPassInput(e.target.value)} className="input" style={{ width: "100%", paddingRight: 40 }} placeholder={t.newPasswordPlaceholder} autoComplete="new-password" />
              <button onClick={() => setPassVisible(v => !v)} aria-label={passVisible ? t.hide : t.show} style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 6, color: "var(--muted)", display: "flex" }}>
                {passVisible
                  ? <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  : <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}
              </button>
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>{t.passwordHint}</div>
            {profileMsg && <div style={{ fontSize: 12, color: profileMsg.ok ? "var(--green)" : "var(--red)", lineHeight: 1.5 }}>{profileMsg.text}</div>}
          </div>
        </ConfirmModal>
      )}

      {confirmUnlink && (
        <ConfirmModal title={t.googleUnlinkTitle} confirmLabel={t.googleUnlink} cancelLabel={t.cancel} confirmColor="var(--red)"
          onConfirm={handleUnlinkGoogle} onCancel={() => setConfirmUnlink(false)}>{t.googleUnlinkBody}</ConfirmModal>
      )}

      {pendingLang && (
        <ConfirmModal title={t.changeLanguageTitle} confirmLabel={t.confirm} cancelLabel={t.cancel} confirmColor="var(--blue)"
          onConfirm={() => { setLang(pendingLang); window.location.href = "/"; }} onCancel={() => setPendingLang(null)}>{t.changeLanguageBody}</ConfirmModal>
      )}
    </div>
  );
}
