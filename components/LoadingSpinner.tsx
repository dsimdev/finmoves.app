import Image from "next/image";

export function LoadingSpinner() {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", paddingTop: 100, gap: 20,
    }}>
      <Image src="/favicon.png" alt="" width={56} height={56} style={{ borderRadius: 14, opacity: 0.9 }} />
      <div className="spin" style={{
        width: 32, height: 32, borderRadius: "50%",
        border: "3px solid transparent",
        borderTopColor: "var(--accent)",
        borderRightColor: "var(--green)",
        borderBottomColor: "var(--yellow)",
        borderLeftColor: "var(--red)",
      }} />
    </div>
  );
}
