import { Loader } from "./Loader";

// Pantalla de carga: el spinner de la app envolviendo el logo FM (apilados en la misma
// celda de grid, centrados). <img> plano para que renderice al instante. Fondo propio
// para no ver el blanco del navegador antes de que pinte el tema.
export function LoadingSpinner() {
  return (
    <div style={{ position: "fixed", inset: 0, background: "var(--bg)", display: "grid", placeItems: "center" }}>
      <span style={{ display: "grid" }}>
        <span style={{ gridArea: "1 / 1", placeSelf: "center" }}>
          <Loader size={140} />
        </span>
        <img src="/logo-fm-1024.png" alt="" width={66} height={66}
          style={{ gridArea: "1 / 1", placeSelf: "center", opacity: 0.95 }} />
      </span>
    </div>
  );
}
