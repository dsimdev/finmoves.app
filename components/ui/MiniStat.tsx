// Tarjeta de estadística compacta reutilizable (Reportes, Inversión, Dashboard).
export function MiniStat({
  label, value, sub, color, basis = "1 1 28%", center, onClick,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
  basis?: string;
  center?: boolean;
  onClick?: () => void;
}) {
  return (
    <div onClick={onClick} style={{ background: "var(--surface-alt)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "11px 12px", minWidth: 0, flex: basis, textAlign: center ? "center" : undefined, cursor: onClick ? "pointer" : undefined }}>
      <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: color ?? "var(--text)", fontFamily: "var(--font-mono)", lineHeight: 1.1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{value}</div>
      {sub && <div style={{ fontSize: 9, color: "var(--muted)", marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sub}</div>}
    </div>
  );
}
