"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/hooks/useTranslation";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { SubHeader } from "../_shared";

const CHANGELOG_WEB_URL = "https://github.com/dsimdev/finmoves.app/blob/main/CHANGELOG_USER.md";

const boldify = (text: string) => text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
  part.startsWith("**") && part.endsWith("**") ? <strong key={i} style={{ fontWeight: 700 }}>{part.slice(2, -2)}</strong> : part
);

export default function HelpSettings() {
  const t = useT();
  const router = useRouter();
  const [changelog, setChangelog] = useState<string | null>(null);
  const [showChangelog, setShowChangelog] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [showGithubConfirm, setShowGithubConfirm] = useState(false);

  const openChangelog = async () => {
    if (!changelog) { const res = await fetch("/api/changelog"); setChangelog(await res.text()); }
    setShowChangelog(true);
  };
  useEffect(() => {
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("changelog") === "1") {
      openChangelog(); window.history.replaceState(null, "", "/settings/help");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const card: React.CSSProperties = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 16, marginBottom: 12 };

  return (
    <div className="page">
      <SubHeader title={t.guideSection} />

      <div style={{ ...card, display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{t.guideHowTitle}</div>
          <div style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.6 }}>{t.hintMovBody}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[t.guideMovements, t.guideInvestments, t.guideReports].map((txt, i) => (
            <div key={i} style={{ display: "flex", gap: 8, fontSize: 12.5, color: "var(--muted)", lineHeight: 1.5 }}>
              <span style={{ color: "var(--accent)", flexShrink: 0 }}>•</span>{txt}
            </div>
          ))}
        </div>
        <button onClick={() => router.push("/onboarding?replay=1")} style={{ marginTop: 4, height: 44, borderRadius: 12, border: "1px solid var(--accent)44", background: "var(--accent-dim)", color: "var(--accent)", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{t.replayTutorial}</button>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 36, padding: "12px 0" }}>
        <button onClick={() => setShowGithubConfirm(true)} aria-label="GitHub" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
          <span style={{ fontSize: 9, letterSpacing: 0.4, textTransform: "uppercase", fontWeight: 600 }}>GitHub</span>
        </button>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
          <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "var(--font-mono)", background: "linear-gradient(110deg, var(--blue) 10%, var(--green) 90%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>v{process.env.NEXT_PUBLIC_APP_VERSION}</div>
          <button onClick={openChangelog} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: 11, padding: 0, textDecoration: "underline" }}>changelog</button>
        </div>
      </div>

      <BottomSheet open={showChangelog} onClose={() => setShowChangelog(false)} title="Changelog">
        <div style={{ fontSize: 13, lineHeight: 1.65, color: "var(--text)" }}>
          {changelog ? (() => {
            const all = changelog.split("\n"); const top: string[] = []; let versions = 0;
            for (const line of all) { if (line.startsWith("## [")) { versions++; if (versions > 5) break; } top.push(line); }
            return top;
          })().map((line, i) => {
            if (line.startsWith("## ")) return <div key={i} style={{ fontSize: 14, fontWeight: 700, margin: "16px 0 4px", color: "var(--blue)" }}>{line.replace(/^## /, "")}</div>;
            if (line.startsWith("### ")) return <div key={i} style={{ fontSize: 11, fontWeight: 600, margin: "10px 0 2px", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{line.replace(/^### /, "")}</div>;
            if (line.startsWith("- ")) return <div key={i} style={{ paddingLeft: 10, marginBottom: 3 }}>• {boldify(line.replace(/^- /, ""))}</div>;
            if (line.startsWith("---")) return <hr key={i} style={{ border: "none", borderTop: "1px solid var(--border)", margin: "10px 0" }} />;
            if (line.startsWith("# ") || line.trim() === "" || line.startsWith("Todos los cambios") || line.startsWith("Formato basado") || line.startsWith("https://keep")) return null;
            return <div key={i}>{boldify(line)}</div>;
          }) : <div style={{ color: "var(--muted)" }}>Loading…</div>}
          <button onClick={() => setConfirmLeave(true)} aria-label={t.viewFullChangelog} title={t.viewFullChangelog} style={{ display: "block", width: "100%", textAlign: "center", margin: "20px auto 2px", background: "none", border: "none", color: "var(--muted)", fontSize: 12, fontStyle: "italic", cursor: "pointer" }}>{t.seeMore}</button>
        </div>
      </BottomSheet>

      {confirmLeave && (
        <ConfirmModal title={t.leaveSiteTitle} confirmLabel={t.leaveSiteConfirm} cancelLabel={t.cancel}
          onConfirm={() => { window.open(CHANGELOG_WEB_URL, "_blank", "noopener,noreferrer"); setConfirmLeave(false); }} onCancel={() => setConfirmLeave(false)}>{t.leaveSiteBody}</ConfirmModal>
      )}
      {showGithubConfirm && (
        <ConfirmModal title={t.openGitHub} confirmLabel={t.goToGitHub} cancelLabel={t.cancel} confirmColor="var(--blue)"
          onConfirm={() => { window.open("https://github.com/dsimdev/finmoves-app/blob/main/README.md", "_blank", "noopener,noreferrer"); setShowGithubConfirm(false); }} onCancel={() => setShowGithubConfirm(false)}>{t.goToGitHubBody}</ConfirmModal>
      )}
    </div>
  );
}
