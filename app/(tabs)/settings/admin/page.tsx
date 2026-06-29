"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useT } from "@/hooks/useTranslation";
import { auth } from "@/services/firebase/firebase";
import { getIdToken } from "firebase/auth";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { SubHeader } from "../_shared";

export default function AdminSettings() {
  const { user } = useAuth();
  const t = useT();
  const isOwner = !!user?.email && user.email === process.env.NEXT_PUBLIC_OWNER_EMAIL;

  const [inviteCode, setInviteCode] = useState("");
  const [genBusy, setGenBusy] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);

  const generateInviteCode = async () => {
    const u = auth.currentUser;
    if (!u || genBusy) return;
    setGenBusy(true); setCodeCopied(false);
    try {
      const token = await getIdToken(u);
      const res = await fetch("/api/invite-codes", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (res.ok && data.code) { setInviteCode(data.code); setShowInviteModal(true); }
    } catch { /* ignore */ } finally { setGenBusy(false); }
  };
  const copyInviteCode = async () => {
    try { await navigator.clipboard.writeText(inviteCode); setCodeCopied(true); setTimeout(() => setCodeCopied(false), 2000); } catch { /* ignore */ }
  };

  const card: React.CSSProperties = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 16, marginBottom: 12 };

  if (!isOwner) {
    return (
      <div className="page">
        <SubHeader title="Admin" />
        <div style={{ ...card, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>—</div>
      </div>
    );
  }

  return (
    <div className="page">
      <SubHeader title="Admin" />
      <button onClick={generateInviteCode} disabled={genBusy} style={{ ...card, width: "100%", display: "flex", alignItems: "center", gap: 12, cursor: genBusy ? "default" : "pointer", textAlign: "left" }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--accent-dim)", border: "1px solid var(--accent)44", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "var(--accent)" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
        </div>
        <span style={{ fontSize: 14, color: genBusy ? "var(--muted)" : "var(--text)" }}>{genBusy ? t.generatingInvite : t.generateInvite}</span>
      </button>

      <BottomSheet open={showInviteModal} onClose={() => setShowInviteModal(false)} title={t.inviteCodeModalTitle}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, background: "var(--accent-dim)", border: "1px solid var(--accent)44", borderRadius: 14, padding: "16px 18px" }}>
          <span style={{ flex: 1, fontSize: 26, fontWeight: 700, fontFamily: "var(--font-mono)", letterSpacing: 4, color: "var(--accent)", textAlign: "center" }}>{inviteCode}</span>
          <button onClick={copyInviteCode} aria-label={t.copy} style={{ background: codeCopied ? "var(--green-dim)" : "var(--surface)", border: `1px solid ${codeCopied ? "var(--green)" : "var(--border)"}`, borderRadius: 10, width: 42, height: 42, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: codeCopied ? "var(--green)" : "var(--muted)", flexShrink: 0 }}>
            {codeCopied
              ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>}
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
