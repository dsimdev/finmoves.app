import Image from "next/image";

export function LoadingSpinner() {
  return (
    <div style={{
      position: "fixed", inset: 0,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{ position: "relative", width: 260, height: 260 }}>
        <div style={{
          position: "absolute", inset: 0, display: "flex",
          alignItems: "center", justifyContent: "center",
        }}>
          <Image src="/favicon.png" alt="" width={110} height={110} priority style={{ opacity: 0.9 }} />
        </div>
        <div className="spin" style={{
          position: "absolute", inset: 0,
          borderRadius: "50%",
          border: "4px solid transparent",
          borderTopColor: "#536dfe",
          borderRightColor: "#3d8ef8",
          borderBottomColor: "#00c896",
          borderLeftColor: "#00e676",
        }} />
      </div>
    </div>
  );
}
