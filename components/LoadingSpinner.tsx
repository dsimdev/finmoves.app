import Image from "next/image";

export function LoadingSpinner() {
  return (
    <div style={{
      position: "fixed", inset: 0,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{ position: "relative", width: 160, height: 160 }}>
        <div style={{
          position: "absolute", inset: 0, display: "flex",
          alignItems: "center", justifyContent: "center",
        }}>
          <Image src="/favicon.png" alt="" width={100} height={100} style={{ borderRadius: 22, opacity: 0.9 }} />
        </div>
        <div className="spin" style={{
          position: "absolute", inset: 0,
          borderRadius: "50%",
          border: "4px solid transparent",
          borderTopColor: "var(--accent)",
          borderRightColor: "var(--green)",
          borderBottomColor: "var(--yellow)",
          borderLeftColor: "var(--red)",
        }} />
      </div>
    </div>
  );
}
