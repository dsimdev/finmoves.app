export function SectionHint({ title, body, onDismiss }: { title: string; body: string; onDismiss: () => void }) {
  return (
    <div style={{
      display: "flex", gap: 12, alignItems: "flex-start",
      background: "var(--surface-alt)",
      border: "1px solid var(--border)",
      borderLeft: "3px solid var(--accent)",
      borderRadius: "var(--radius-sm)", padding: "12px 14px",
      marginBottom: 12,
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 3, color: "var(--text)" }}>{title}</div>
        <div style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.5 }}>{body}</div>
      </div>
      <button onClick={onDismiss} style={{
        background: "none", border: "none", cursor: "pointer",
        color: "var(--muted)", padding: 0, flexShrink: 0,
        display: "flex", alignItems: "center",
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}
