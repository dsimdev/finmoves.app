export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`
        html { height: 100%; }
        body {
          height: 100dvh !important;
          display: grid !important;
          place-content: center !important;
        }
      `}</style>
      {children}
    </>
  );
}
