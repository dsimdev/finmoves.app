"use client";

export type AdminUserRow = {
  uid: string; email: string; nombre: string;
  createdAt: string; lastSignIn: string;
  pushOn: boolean; permisos: Record<string, boolean>;
  inviteCode: string | null; isOwner: boolean;
};

// Tabla de usuarios del panel admin (escritorio). En móvil cada usuario es un acordeón que
// hay que abrir para ver sus permisos; acá entran como columnas de toggles, así se ve de un
// vistazo quién tiene qué — que es justo lo que se va a mirar en un panel de administración.

const PERMISOS: { key: string; label: string }[] = [
  { key: "comprobantes", label: "Imágenes" },
  { key: "inversion", label: "Inversión" },
];

const fmtFecha = (iso: string) =>
  iso ? new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "2-digit" }) : "—";

export function UsersTable({ users, onTogglePerm }: {
  users: AdminUserRow[];
  onTogglePerm: (u: AdminUserRow, key: string, label: string, value: boolean) => void;
}) {
  return (
    <div className="dt-wrap">
      <table className="dt">
        <thead>
          <tr>
            <th>Usuario</th>
            <th>Email</th>
            <th>Última conexión</th>
            <th>Creado</th>
            {PERMISOS.map((p) => <th key={p.key} style={{ textAlign: "center" }}>{p.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.uid}>
              <td>
                {/* Punto verde = push activo, o sea sesión viva en algún dispositivo. */}
                <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: u.pushOn ? "var(--green)" : "var(--border)", marginRight: 9, verticalAlign: "middle" }} />
                {u.nombre || u.email}
                {u.isOwner && <span className="badge" style={{ marginLeft: 8, background: "var(--accent-dim)", color: "var(--accent)", border: "1px solid var(--accent)44" }}>owner</span>}
              </td>
              <td style={{ color: "var(--muted)" }}>{u.email}</td>
              <td style={{ color: "var(--muted)", whiteSpace: "nowrap" }}>
                {u.pushOn
                  ? <span style={{ color: "var(--green)" }}>online</span>
                  : u.lastSignIn ? new Date(u.lastSignIn).toLocaleString("es-AR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }) : "—"}
              </td>
              <td style={{ color: "var(--muted)", whiteSpace: "nowrap" }}>{fmtFecha(u.createdAt)}</td>
              {PERMISOS.map((p) => {
                const on = u.permisos[p.key] === true;
                return (
                  <td key={p.key} style={{ textAlign: "center" }}>
                    {/* El owner tiene todo por definición: no hay nada que togglear. */}
                    {u.isOwner ? (
                      <span style={{ color: "var(--muted)" }}>—</span>
                    ) : (
                      <button
                        onClick={() => onTogglePerm(u, p.key, p.label, !on)}
                        aria-label={`${p.label}: ${u.nombre || u.email}`}
                        aria-pressed={on}
                        style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "inline-flex" }}
                      >
                        <span style={{ width: 34, height: 19, borderRadius: 999, background: on ? "var(--green)" : "var(--surface-alt)", border: `1px solid ${on ? "var(--green)" : "var(--border)"}`, position: "relative", display: "block" }}>
                          <span style={{ position: "absolute", top: 2, left: on ? 16 : 2, width: 13, height: 13, borderRadius: "50%", background: "#fff", transition: "left 0.15s" }} />
                        </span>
                      </button>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
