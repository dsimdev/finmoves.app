"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useData } from "../data-context";
import { agruparPorPeriodo } from "@/utils/periodo";
import { parsePeriodoId } from "@/utils/reportes";
import { doc, setDoc, getDoc, updateDoc } from "firebase/firestore";
import { db, auth } from "@/services/firebase/firebase";
import { signOut, getIdToken, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from "firebase/auth";
import { useRouter } from "next/navigation";
import type { ConfigUsuario } from "@/types";
import { isoToFechaAR } from "@/lib/sheet-format";
import { dbErrorMessage } from "@/lib/firebase-error";
import { platformAuthenticatorAvailable, isBiometricEnabledFor, registerBiometric, clearBiometric } from "@/lib/biometric";
import { linkGoogle, isGoogleLinked } from "@/lib/google-auth";
import { pushSupported, isPushEnabled, enablePush, disablePush } from "@/lib/push-client";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useTheme } from "@/hooks/useTheme";
import { useAppPrefs } from "@/hooks/useAppPrefs";
import { useCotizacion } from "@/hooks/useCotizacion";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { listarRecordatorios, crearRecordatorio, eliminarRecordatorio, type Recordatorio } from "@/services/firebase/recordatorios";
import { useScrollLock } from "@/hooks/useScrollLock";
import { useT } from "@/hooks/useTranslation";

function Toggle({ activo, onClick }: { activo: boolean; onClick: () => void }) {
  return (
    <div onClick={onClick} style={{
      width: 44, height: 26, borderRadius: 13,
      background: activo ? "var(--accent)" : "var(--border)",
      boxShadow: activo ? "0 0 0 3px var(--accent)30" : "inset 0 1px 3px rgba(0,0,0,0.15)",
      position: "relative", cursor: "pointer",
      transition: "background .25s, box-shadow .25s", flexShrink: 0,
    }}>
      <div style={{
        position: "absolute", top: 3, left: activo ? 21 : 3,
        width: 20, height: 20, borderRadius: "50%",
        background: "#fff",
        boxShadow: "0 1px 4px rgba(0,0,0,0.25), 0 0 0 0.5px rgba(0,0,0,0.06)",
        transition: "left .22s cubic-bezier(0.34,1.56,0.64,1)",
      }} />
    </div>
  );
}

function FlagAR({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ borderRadius: "50%", display: "block" }}>
      <clipPath id="flagAR"><circle cx="12" cy="12" r="12" /></clipPath>
      <g clipPath="url(#flagAR)">
        <rect width="24" height="8" fill="#74acdf" />
        <rect y="8" width="24" height="8" fill="#fff" />
        <rect y="16" width="24" height="8" fill="#74acdf" />
        <circle cx="12" cy="12" r="2.2" fill="#f6b40e" stroke="#85340a" strokeWidth="0.3" />
      </g>
    </svg>
  );
}

function FlagGB({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ borderRadius: "50%", display: "block" }}>
      <clipPath id="flagGB"><circle cx="12" cy="12" r="12" /></clipPath>
      <g clipPath="url(#flagGB)">
        <rect width="24" height="24" fill="#012169" />
        <path d="M0 0 L24 24 M24 0 L0 24" stroke="#fff" strokeWidth="3.5" />
        <path d="M0 0 L24 24 M24 0 L0 24" stroke="#c8102e" strokeWidth="2" />
        <path d="M12 0 V24 M0 12 H24" stroke="#fff" strokeWidth="5.5" />
        <path d="M12 0 V24 M0 12 H24" stroke="#c8102e" strokeWidth="3" />
      </g>
    </svg>
  );
}


function Chip({ label, colorVar, dimVar, activo, confirming, onToggle, onLongPress, onConfirmDelete }: {
  label: string; colorVar: string; dimVar: string; activo: boolean; confirming: boolean;
  onToggle: () => void; onLongPress: () => void; onConfirmDelete: () => void;
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);

  const start = () => {
    longPressed.current = false;
    timer.current = setTimeout(() => { longPressed.current = true; onLongPress(); }, 450);
  };
  const end = () => { if (timer.current) clearTimeout(timer.current); };

  const handleClick = () => {
    if (longPressed.current) { longPressed.current = false; return; }
    if (confirming) onConfirmDelete();
    else onToggle();
  };

  if (confirming) {
    return (
      <button onClick={onConfirmDelete} style={{
        display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 999,
        background: "var(--red-dim)", border: "1px solid var(--red)", color: "var(--red)",
        fontSize: 12.5, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
      }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/>
        </svg>
        {label}
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      onPointerDown={start}
      onPointerUp={end}
      onPointerLeave={end}
      onPointerCancel={end}
      style={{
        padding: "7px 14px", borderRadius: 999, fontSize: 12.5, fontWeight: 600, cursor: "pointer",
        whiteSpace: "nowrap", transition: "all 0.15s", touchAction: "manipulation",
        border: `1px solid ${activo ? colorVar : "var(--border)"}`,
        background: activo ? dimVar : "transparent",
        color: activo ? colorVar : "var(--muted)",
        opacity: activo ? 1 : 0.55,
      }}
    >
      {label}
    </button>
  );
}

function SectionHeader({ title, open, onClick, danger }: { title: string; open: boolean; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} style={{
      width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
      background: "none", border: "none", cursor: "pointer", padding: 0,
    }}>
      <span className="label" style={{ margin: 0, color: danger ? "var(--red)" : undefined }}>{title}</span>
      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {danger && <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--red)" }} />}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s" }}>
          <polyline points="6 9 12 15 18 9" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </button>
  );
}

export default function ConfigPage() {
  const { user } = useAuth();
  const { config, configLoading: loading, refreshConfig: refresh, movimientos } = useData();
  const router = useRouter();

  const { dark, toggle: toggleTheme } = useTheme();
  const { showReportes, showAhorros, dashboardClasico, monedaInversiones, monedaPrincipal, set: setPref, setMoneda, setMonedaPrincipal, lang, setLang } = useAppPrefs();
  const t = useT();


  const [guardando, setGuardando] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoTipo, setNuevoTipo] = useState<"Gasto" | "Ingreso">("Gasto");
  const [movSub, setMovSub] = useState<"categorias" | "medios" | "origenes">("categorias");
  // Long-press sobre un chip → modal flotante de confirmación de borrado.
  const [pendingDelete, setPendingDelete] = useState<{ kind: "cat" | "med" | "ori"; nombre: string } | null>(null);

  // Sync state
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [pendingLang, setPendingLang] = useState<"es" | "en" | null>(null);
  // Modal de cambio de contraseña
  const [showChangePass, setShowChangePass] = useState(false);
  const [currentPassInput, setCurrentPassInput] = useState("");
  const [passInput, setPassInput] = useState("");
  const [passVisible, setPassVisible] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [profileBusy, setProfileBusy] = useState(false);
  // Cambio de moneda principal
  const [pendingMoneda, setPendingMoneda] = useState<"ARS" | "USD" | "EUR" | null>(null);
  const [monedaBusy, setMonedaBusy] = useState(false);
  const openChangePass = () => {
    setPassInput("");
    setCurrentPassInput("");
    setPassVisible(false);
    setProfileMsg(null);
    setShowChangePass(true);
  };

  const changeMoneda = async (newMoneda: "ARS" | "USD" | "EUR") => {
    if (!user?.uid || monedaBusy || !config || newMoneda === config.meta.monedaPrincipal) return;
    setMonedaBusy(true);
    try {
      const newMeta = { ...config.meta, monedaPrincipal: newMoneda };
      // Si cambias a USD/EUR, desactiva la inversión
      if (newMoneda !== "ARS") {
        newMeta.showAhorros = false;
        setPref("showAhorros", false);
      }
      await setDoc(doc(db, `users/${user.uid}/config/meta`), { ...config, meta: newMeta });
      setMonedaPrincipal(newMoneda);
      setPendingMoneda(null);
      setProfileMsg({ ok: true, text: "Moneda actualizada" });
      setTimeout(() => setProfileMsg(null), 3000);
    } catch {
      setProfileMsg({ ok: false, text: "No se pudo cambiar la moneda" });
    } finally {
      setMonedaBusy(false);
    }
  };
  const savePassword = async () => {
    if (profileBusy) return;
    if (passInput.length < 6) { setProfileMsg({ ok: false, text: t.regWeakPassword }); return; }
    if (!currentPassInput) { setProfileMsg({ ok: false, text: t.currentPasswordRequired }); return; }
    setProfileBusy(true); setProfileMsg(null);
    try {
      const cred = EmailAuthProvider.credential(auth.currentUser!.email!, currentPassInput);
      await reauthenticateWithCredential(auth.currentUser!, cred);
      await updatePassword(auth.currentUser!, passInput);
      setProfileMsg({ ok: true, text: t.passwordChangedRelogin });
      setPassInput(""); setCurrentPassInput("");
      setTimeout(async () => { useAppPrefs.getState().reset(); await signOut(auth); router.replace("/home"); }, 1400);
    } catch (err) {
      const code = (err as { code?: string })?.code ?? "";
      const text = code === "auth/wrong-password" || code === "auth/invalid-credential"
        ? t.wrongCurrentPassword
        : code === "auth/requires-recent-login" ? t.reauthNeeded : t.profileError;
      setProfileMsg({ ok: false, text });
    } finally {
      setProfileBusy(false);
    }
  };
  // Acordeón de secciones (pestaña General) — Cuenta abierta por defecto
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({ account: true });
  const isOpen = (k: string) => !!openSections[k];
  // Acordeón exclusivo: abrir una cierra las demás
  const toggleSection = (k: string) => setOpenSections((p) => (p[k] ? {} : { [k]: true }));
  // Biometría
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioEnabled, setBioEnabled] = useState(false);
  const [bioError, setBioError] = useState("");
  useEffect(() => {
    platformAuthenticatorAvailable().then(setBioAvailable);
    setBioEnabled(isBiometricEnabledFor(user?.uid));
  }, [user?.uid]);
  // Vinculación con Google
  const [googleLinked, setGoogleLinked] = useState(false);
  const [googleErr, setGoogleErr] = useState("");
  const [confirmUnlink, setConfirmUnlink] = useState(false);
  const [fotoError, setFotoError] = useState(false);
  useEffect(() => { setGoogleLinked(isGoogleLinked()); }, [user?.uid]);
  // Lazy sync nombre desde Google al cargar config (por si se vinculó con el código viejo)
  useEffect(() => {
    const u = auth.currentUser;
    if (!u || !config || !isGoogleLinked()) return;
    const g = u.providerData.find((p) => p.providerId === "google.com");
    const googleName = g?.displayName;
    if (googleName && googleName !== config.meta.nombre) {
      setDoc(doc(db, `users/${u.uid}/config/meta`), { meta: { nombre: googleName } }, { merge: true })
        .then(() => refresh())
        .catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, config?.meta.nombre]);
  useEffect(() => { setFotoError(false); }, [config?.meta.fotoURL, googleLinked]);
  const handleLinkGoogle = async () => {
    if (googleLinked) return;
    setGoogleErr("");
    try {
      await linkGoogle();
      setGoogleLinked(true);
      refresh(); // traer nombre/foto que Google completó
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code !== "auth/popup-closed-by-user" && code !== "auth/cancelled-popup-request") {
        setGoogleErr(t.googleLinkErr);
        setTimeout(() => setGoogleErr(""), 4000);
      }
    }
  };
  const handleUnlinkGoogle = async () => {
    if (!auth.currentUser) return;
    try {
      const { unlink } = await import("firebase/auth");
      await unlink(auth.currentUser, "google.com");
      setGoogleLinked(false);
      setConfirmUnlink(false);
    } catch {
      setGoogleErr(t.googleUnlinkErr);
      setTimeout(() => setGoogleErr(""), 4000);
      setConfirmUnlink(false);
    }
  };
  const toggleBiometric = async () => {
    setBioError("");
    if (bioEnabled) {
      clearBiometric();
      setBioEnabled(false);
      return;
    }
    if (!user?.uid || !user.email) return;
    try {
      await registerBiometric(user.uid, user.email);
      setBioEnabled(true);
    } catch {
      setBioError(t.biometricEnableError);
      setTimeout(() => setBioError(""), 3000);
    }
  };
  // Notificaciones push
  const [pushAvailable, setPushAvailable] = useState(false);
  const [pushOn, setPushOn] = useState(false);
  const [pushError, setPushError] = useState("");
  const [pushBusy, setPushBusy] = useState(false);
  useEffect(() => {
    const ok = pushSupported();
    setPushAvailable(ok);
    if (ok) isPushEnabled().then(setPushOn);
  }, []);
  const togglePush = async () => {
    if (pushBusy || !user?.uid) return;
    setPushError("");
    setPushBusy(true);
    try {
      if (pushOn) {
        await disablePush(user.uid);
        setPushOn(false);
      } else {
        const ok = await enablePush(user.uid);
        if (ok) setPushOn(true);
        else { setPushError(t.notificationsDenied); setTimeout(() => setPushError(""), 6000); }
      }
    } catch (err) {
      console.error("push toggle:", err);
      const msg = err instanceof Error ? `${err.name}: ${err.message}` : t.notificationsError;
      setPushError(msg);
      setTimeout(() => setPushError(""), 8000);
    } finally {
      setPushBusy(false);
    }
  };
  // Códigos de invitación (solo dueño)
  const isOwner = !!user?.email && user.email === process.env.NEXT_PUBLIC_OWNER_EMAIL;
  // Inversión disponible solo si el dueño la habilitó (o si sos el dueño).
  const inversionAllowed = isOwner || config?.meta.permisos?.inversion === true;
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
      if (res.ok && data.code) {
        setInviteCode(data.code); setShowInviteModal(true);
      }
    } catch { /* ignore */ } finally { setGenBusy(false); }
  };
  const copyInviteCode = async () => {
    try { await navigator.clipboard.writeText(inviteCode); setCodeCopied(true); setTimeout(() => setCodeCopied(false), 2000); } catch { /* ignore */ }
  };
  const [changelog, setChangelog] = useState<string | null>(null);
  const [showChangelog, setShowChangelog] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  // Recordatorios puntuales
  const [showRecordatorios, setShowRecordatorios] = useState(false);
  const [recordatorios, setRecordatorios] = useState<Recordatorio[]>([]);
  const [recTexto, setRecTexto] = useState("");
  const [recFecha, setRecFecha] = useState("");
  const CHANGELOG_WEB_URL = "https://github.com/dsimdev/finmoves.app/blob/main/CHANGELOG_USER.md";
  // Mini-render de **negrita** del markdown (el changelog usa ** para resaltar).
  const boldify = (text: string) => text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**")
      ? <strong key={i} style={{ fontWeight: 700 }}>{part.slice(2, -2)}</strong>
      : part
  );
  const [showSyncLog, setShowSyncLog] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [syncError, setSyncError] = useState<{ message: string; at: Date } | null>(null);
  const [syncLogs, setSyncLogs] = useState<{ status: "ok" | "error"; type: "manual" | "auto"; at: Date; message: string }[]>([]);

  // ── Movimientos local state ──
  const [localCats, setLocalCats] = useState<ConfigUsuario["categorias"]>([]);
  const [localMedios, setLocalMedios] = useState<ConfigUsuario["mediosPago"]>([]);
  const [localOrigenes, setLocalOrigenes] = useState<ConfigUsuario["origenesAhorro"]>([]);
  const localCatsRef = useRef<ConfigUsuario["categorias"]>([]);
  const localMediosRef = useRef<ConfigUsuario["mediosPago"]>([]);
  const localOrigenesRef = useRef<ConfigUsuario["origenesAhorro"]>([]);
  const movSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didInitMov = useRef(false);

  useEffect(() => {
    if (config && !didInitMov.current) {
      setLocalCats(config.categorias);
      setLocalMedios(config.mediosPago);
      setLocalOrigenes(config.origenesAhorro);
      localCatsRef.current = config.categorias;
      localMediosRef.current = config.mediosPago;
      localOrigenesRef.current = config.origenesAhorro;
      didInitMov.current = true;
    }
  }, [config]);

  const isDirtyMovimientos = useMemo(() => {
    if (!config || !didInitMov.current) return false;
    return (
      JSON.stringify(localCats) !== JSON.stringify(config.categorias) ||
      JSON.stringify(localMedios) !== JSON.stringify(config.mediosPago) ||
      JSON.stringify(localOrigenes) !== JSON.stringify(config.origenesAhorro)
    );
  }, [localCats, localMedios, localOrigenes, config]);

  // ── Presupuesto template state ──
  const [localTemplate, setLocalTemplate] = useState<Record<string, string>>({});
  const [templateSaving, setTemplateSaving] = useState(false);

  useEffect(() => {
    if (!config) return;
    const tpl = config.meta.presupuestoTemplate ?? {};
    setLocalTemplate(Object.fromEntries(Object.entries(tpl).map(([k, v]) => [k, String(v)])));
  }, [!!config]);

  const templateIsDirty = useMemo(() => {
    const saved = config?.meta.presupuestoTemplate ?? {};
    const activeCats = (config?.categorias ?? []).filter(c => c.activa && (c.tipo === "Gasto" || c.tipo === "Ambos"));
    return activeCats.some(c => {
      const localVal = Math.round(parseFloat(localTemplate[c.nombre] ?? "") || 0);
      const savedVal = Math.round(saved[c.nombre] ?? 0);
      return localVal !== savedVal;
    });
  }, [localTemplate, config?.meta.presupuestoTemplate, config?.categorias]);

  const saveTemplate = async () => {
    if (!user?.uid || !config) return;
    setTemplateSaving(true);
    try {
      const categorias: Record<string, number> = {};
      for (const [cat, val] of Object.entries(localTemplate)) {
        const n = parseFloat(val);
        if (!isNaN(n) && n > 0) categorias[cat] = n;
      }
      await updateDoc(doc(db, `users/${user.uid}/config/meta`), { "meta.presupuestoTemplate": categorias });
      refresh();
      setSaveMsg({ ok: true, text: t.templateSaved });
      setTimeout(() => setSaveMsg(null), 2500);
    } catch {
      setSaveMsg({ ok: false, text: t.unexpectedError });
    } finally {
      setTemplateSaving(false);
    }
  };

  // ── Auto-ahorro modal state ──
  const [showAutoAhorroModal, setShowAutoAhorroModal] = useState(false);
  const [showExportConfirm, setShowExportConfirm] = useState(false);
  const [showGithubConfirm, setShowGithubConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteRequested, setDeleteRequested] = useState(false);
  const [localAutoMonto, setLocalAutoMonto] = useState("");
  const [localAutoMedios, setLocalAutoMedios] = useState<string[]>([]);
  const [localAutoOmitir, setLocalAutoOmitir] = useState<string[]>([]);
  const [localAutoOmitirInput, setLocalAutoOmitirInput] = useState("");

  // ── Ahorros state ──
  const [metaFecha, setMetaFecha] = useState("");
  const [metaMonto, setMetaMonto] = useState("");
  const [metaSaldo, setMetaSaldo] = useState("");
  const [cotizManualOn, setCotizManualOn] = useState(false);
  const [cotizManualVal, setCotizManualVal] = useState("");

  const periodos = useMemo(() => agruparPorPeriodo(movimientos), [movimientos]);

  const totalUSD = useMemo(() => {
    let total = config?.meta.saldoUSD ?? 0;
    for (const m of movimientos) {
      if (m.tipo === "CompraUSD" && m.cantidadUSD) total += m.cantidadUSD;
      else if (m.tipo === "GastoUSD" && m.cantidadUSD) total -= m.cantidadUSD;
    }
    return total;
  }, [movimientos]);

  const totalEUR = useMemo(() => {
    let total = config?.meta.saldoEUR ?? 0;
    for (const m of movimientos) {
      if (m.tipo === "CompraEUR" && m.cantidadUSD) total += m.cantidadUSD;
      else if (m.tipo === "GastoEUR" && m.cantidadUSD) total -= m.cantidadUSD;
    }
    return total;
  }, [movimientos, config?.meta.saldoEUR]);

  const totalReserva = monedaInversiones === "EUR" ? totalEUR : totalUSD;
  // Cotización en uso para la moneda de inversión activa: manual si está activa, si no el oficial.
  const { cotizacion } = useCotizacion();
  const tasaAuto = cotizacion ? (monedaInversiones === "EUR" ? cotizacion.oficial_euro ?? null : cotizacion.oficial) : null;
  const tasaEnUso = cotizManualOn && cotizManualVal && parseFloat(cotizManualVal) > 0 ? parseFloat(cotizManualVal) : tasaAuto;
  // Seed inicial según la moneda de inversión activa (saldoUSD / saldoEUR).
  const seedGuardado = (monedaInversiones === "EUR" ? config?.meta.saldoEUR : config?.meta.saldoUSD)?.toString() ?? "";

  const sugeridoPorPeriodo = useMemo(() => {
    if (!metaFecha || !metaMonto || periodos.length < 2) return null;
    const meta = parseFloat(metaMonto);
    if (isNaN(meta) || meta <= 0 || totalReserva >= meta) return null;
    const fechaMeta = new Date(metaFecha + "T12:00:00");
    if (isNaN(fechaMeta.getTime())) return null;
    const hoy = new Date();
    if (fechaMeta <= hoy) return null;
    const fechasPeriodo = [...periodos]
      .map((p) => parsePeriodoId(p.periodoId))
      .sort((a, b) => a.getTime() - b.getTime());
    const gaps = fechasPeriodo.slice(1).map((f, i) => f.getTime() - fechasPeriodo[i].getTime());
    const avgGapMs = gaps.reduce((sum, g) => sum + g, 0) / gaps.length;
    const msRestantes = fechaMeta.getTime() - hoy.getTime();
    const periodosRestantes = Math.max(1, Math.round(msRestantes / avgGapMs));
    return Math.round(((meta - totalUSD) / periodosRestantes) * 100) / 100;
  }, [metaFecha, metaMonto, totalUSD, periodos]);

  const isDirtyAhorros = useMemo(() => {
    if (!config) return false;
    const raw = config.meta.metaFecha ?? "";
    let savedIso = raw;
    if (raw && !raw.includes("-")) {
      const [d, m, y] = raw.split("/").map(Number);
      if (d && m && y) savedIso = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      else savedIso = "";
    }
    const savedManualOn = !!config.meta.cotizacionManualActiva;
    const savedManualVal = config.meta.cotizacionManual?.toString() ?? "";
    return metaFecha !== savedIso || metaMonto !== (config.meta.metaMonto?.toString() ?? "") || metaSaldo !== seedGuardado
      || cotizManualOn !== savedManualOn || (cotizManualOn && cotizManualVal !== savedManualVal);
  }, [metaFecha, metaMonto, metaSaldo, cotizManualOn, cotizManualVal, config]);

  // ── Effects ──

  useEffect(() => {
    if (!user?.uid) return;
    getDoc(doc(db, `users/${user.uid}/config/syncMeta`)).then((snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      const ts = data?.lastSync;
      if (ts?.toDate) setLastSync(ts.toDate());
      const err = data?.lastError;
      if (err?.at?.toDate) setSyncError({ message: err.message, at: err.at.toDate() });
      const rawLogs: { status: "ok" | "error"; type: "manual" | "auto"; at: { toDate?: () => Date }; message: string }[] = data?.logs ?? [];
      setSyncLogs(rawLogs.map(l => ({ ...l, at: l.at?.toDate?.() ?? new Date() })));
    });
  }, [user?.uid]);

  useEffect(() => {
    if (config) {
      const raw = config.meta.metaFecha ?? "";
      let iso = raw;
      if (raw && !raw.includes("-")) {
        const [d, m, y] = raw.split("/").map(Number);
        if (d && m && y) iso = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        else iso = "";
      }
      setMetaFecha(iso);
      setMetaMonto(config.meta.metaMonto?.toString() ?? "");
      setMetaSaldo((monedaInversiones === "EUR" ? config.meta.saldoEUR : config.meta.saldoUSD)?.toString() ?? "");
      setCotizManualOn(!!config.meta.cotizacionManualActiva);
      setCotizManualVal(config.meta.cotizacionManual?.toString() ?? "");
    }
  }, [config?.meta.metaFecha, config?.meta.metaMonto, config?.meta.cotizacionManualActiva, config?.meta.cotizacionManual]);

  useEffect(() => {
    if (config?.meta.monedaPrincipal) {
      setMonedaPrincipal(config.meta.monedaPrincipal);
    }
  }, [config?.meta.monedaPrincipal]);

  // ── Helpers ──
  const saveConfig = async (newConfig: typeof config) => {
    if (!user?.uid || !newConfig) return;
    setGuardando(true);
    try {
      await setDoc(doc(db, `users/${user.uid}/config/meta`), newConfig);
      refresh();
    } catch (err) {
      console.error("saveConfig:", err);
      setSaveMsg({ ok: false, text: dbErrorMessage(err, t) });
      setTimeout(() => setSaveMsg(null), 3000);
    } finally {
      setGuardando(false);
    }
  };

  const openChangelog = async () => {
    if (!changelog) {
      const res = await fetch("/api/changelog");
      const text = await res.text();
      setChangelog(text);
    }
    setShowChangelog(true);
  };

  const openRecordatorios = async () => {
    setShowRecordatorios(true);
    if (user?.uid) listarRecordatorios(user.uid).then(setRecordatorios).catch(() => {});
  };
  // Cargar recordatorios al montar para colorear el acceso (verde si hay alguno).
  useEffect(() => {
    if (user?.uid) listarRecordatorios(user.uid).then(setRecordatorios).catch(() => {});
  }, [user?.uid]);
  // Bloquear scroll de fondo con cualquier modal inline abierto (los BottomSheet
  // y los modales reutilizables ya lockean solos).
  useScrollLock(showRecordatorios || showAutoAhorroModal || showChangelog || showInviteModal || showSyncLog);
  const addRecordatorio = async () => {
    if (!user?.uid || !recTexto.trim() || !recFecha) return;
    await crearRecordatorio(user.uid, recTexto.trim(), recFecha);
    setRecTexto(""); setRecFecha("");
    listarRecordatorios(user.uid).then(setRecordatorios).catch(() => {});
  };
  const delRecordatorio = async (id: string) => {
    if (!user?.uid) return;
    await eliminarRecordatorio(user.uid, id);
    setRecordatorios((prev) => prev.filter((r) => r.id !== id));
  };

  // Abrir el changelog si llegamos con ?changelog=1 (desde el aviso de novedades).
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (new URLSearchParams(window.location.search).get("changelog") === "1") {
      openChangelog();
      window.history.replaceState(null, "", "/settings");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const exportJSON = () => {
    const data = {
      version: process.env.NEXT_PUBLIC_APP_VERSION,
      exportedAt: new Date().toISOString(),
      movimientos: [...movimientos]
        .sort((a, b) => a.timestampCarga.getTime() - b.timestampCarga.getTime())
        .map(m => ({ ...m, timestampCarga: m.timestampCarga.toISOString() })),
      config: {
        categorias: config?.categorias ?? [],
        mediosPago: config?.mediosPago ?? [],
        origenesAhorro: config?.origenesAhorro ?? [],
      },
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `finmoves_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRequestDeletion = async () => {
    if (!auth.currentUser) return;
    setDeleteBusy(true);
    try {
      const token = await getIdToken(auth.currentUser);
      await fetch("/api/account/request-deletion", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      setDeleteRequested(true);
      setShowDeleteConfirm(false);
    } catch { /* ignore */ } finally {
      setDeleteBusy(false);
    }
  };

  const appendSyncLog = async (uid: string, entry: { status: "ok" | "error"; type: "manual" | "auto"; at: Date; message: string }, prev: typeof syncLogs) => {
    const updated = [entry, ...prev].slice(0, 30);
    setSyncLogs(updated);
    await setDoc(doc(db, `users/${uid}/config/syncMeta`), { logs: updated }, { merge: true });
  };

  const handleSync = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    setSyncing(true);
    setSyncMsg(null);
    try {
      const token = await getIdToken(currentUser);
      const res = await fetch("/api/sync-sheets", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t.errorSyncing);
      const now = new Date();
      setLastSync(now);
      setSyncError(null);
      setSyncMsg({ ok: true, text: data.message });
      await appendSyncLog(currentUser.uid, { status: "ok", type: "manual", at: now, message: data.message ?? t.synced }, syncLogs);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t.errorSyncing;
      const now = new Date();
      setSyncError({ message, at: now });
      setSyncMsg({ ok: false, text: message });
      await appendSyncLog(currentUser.uid, { status: "error", type: "manual", at: now, message }, syncLogs);
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMsg(null), 4000);
    }
  };

  // ── Movimientos handlers ──
  const scheduleMovSave = (config: ConfigUsuario) => {
    if (movSaveTimer.current) clearTimeout(movSaveTimer.current);
    movSaveTimer.current = setTimeout(() => {
      saveConfig({ ...config, categorias: localCatsRef.current, mediosPago: localMediosRef.current, origenesAhorro: localOrigenesRef.current });
    }, 1500);
  };

  // Toggles: debounced (UI responde inmediato, Firestore espera 1.5s)
  const toggleCategoriaLocal = (nombre: string) => {
    if (!config) return;
    const next = localCatsRef.current.map(c => c.nombre === nombre ? { ...c, activa: !c.activa } : c);
    localCatsRef.current = next;
    setLocalCats(next);
    scheduleMovSave(config);
  };

  const toggleMedioLocal = (nombre: string) => {
    if (!config) return;
    const next = localMediosRef.current.map(m => m.nombre === nombre ? { ...m, activo: !m.activo } : m);
    localMediosRef.current = next;
    setLocalMedios(next);
    scheduleMovSave(config);
  };

  const toggleOrigenLocal = (nombre: string) => {
    if (!config) return;
    const next = localOrigenesRef.current.map(o => o.nombre === nombre ? { ...o, activo: !o.activo } : o);
    localOrigenesRef.current = next;
    setLocalOrigenes(next);
    scheduleMovSave(config);
  };

  // Adds/deletes: inmediatos (acciones deliberadas)
  const agregarCategoriaLocal = () => {
    if (!nuevoNombre.trim() || !config) return;
    const next = [...localCatsRef.current, { id: nuevoNombre, nombre: nuevoNombre.trim(), tipo: nuevoTipo, activa: true }];
    localCatsRef.current = next;
    setLocalCats(next);
    setNuevoNombre("");
    saveConfig({ ...config, categorias: next, mediosPago: localMediosRef.current, origenesAhorro: localOrigenesRef.current });
  };

  const eliminarCategoriaLocal = (nombre: string) => {
    if (!config) return;
    const next = localCatsRef.current.filter(c => c.nombre !== nombre);
    localCatsRef.current = next;
    setLocalCats(next);
    setPendingDelete(null);
    saveConfig({ ...config, categorias: next, mediosPago: localMediosRef.current, origenesAhorro: localOrigenesRef.current });
  };

  const eliminarMedioLocal = (nombre: string) => {
    if (!config) return;
    const next = localMediosRef.current.filter(m => m.nombre !== nombre);
    localMediosRef.current = next;
    setLocalMedios(next);
    setPendingDelete(null);
    saveConfig({ ...config, categorias: localCatsRef.current, mediosPago: next, origenesAhorro: localOrigenesRef.current });
  };

  const eliminarOrigenLocal = (nombre: string) => {
    if (!config) return;
    const next = localOrigenesRef.current.filter(o => o.nombre !== nombre);
    localOrigenesRef.current = next;
    setLocalOrigenes(next);
    setPendingDelete(null);
    saveConfig({ ...config, categorias: localCatsRef.current, mediosPago: localMediosRef.current, origenesAhorro: next });
  };

  const confirmPendingDelete = () => {
    if (!pendingDelete) return;
    if (pendingDelete.kind === "cat") eliminarCategoriaLocal(pendingDelete.nombre);
    else if (pendingDelete.kind === "med") eliminarMedioLocal(pendingDelete.nombre);
    else eliminarOrigenLocal(pendingDelete.nombre);
  };

  const agregarMedioLocal = () => {
    if (!nuevoNombre.trim() || !config) return;
    const next = [...localMediosRef.current, { id: nuevoNombre, nombre: nuevoNombre.trim(), activo: true }];
    localMediosRef.current = next;
    setLocalMedios(next);
    setNuevoNombre("");
    saveConfig({ ...config, categorias: localCatsRef.current, mediosPago: next, origenesAhorro: localOrigenesRef.current });
  };

  const agregarOrigenLocal = () => {
    if (!nuevoNombre.trim() || !config) return;
    const next = [...localOrigenesRef.current, { id: nuevoNombre, nombre: nuevoNombre.trim(), activo: true }];
    localOrigenesRef.current = next;
    setLocalOrigenes(next);
    setNuevoNombre("");
    saveConfig({ ...config, categorias: localCatsRef.current, mediosPago: localMediosRef.current, origenesAhorro: next });
  };

  const guardarMovimientos = () => {
    if (!config) return;
    saveConfig({ ...config, categorias: localCats, mediosPago: localMedios, origenesAhorro: localOrigenes });
  };

  const openAutoAhorroModal = () => {
    if (!config) return;
    setLocalAutoMonto(config.meta.autoAhorro?.monto?.toString() ?? "");
    setLocalAutoMedios(
      config.meta.autoAhorro?.mediosPago ??
      config.mediosPago.filter(m => m.activo).map(m => m.nombre)
    );
    setLocalAutoOmitir(config.meta.autoAhorro?.omitirDescripciones ?? []);
    setLocalAutoOmitirInput("");
    setShowAutoAhorroModal(true);
  };

  const handleToggleAutoAhorro = () => {
    if (!config) return;
    if (config.meta.autoAhorro?.activo) {
      saveConfig({ ...config, meta: { ...config.meta, autoAhorro: { ...config.meta.autoAhorro, activo: false } } });
    } else {
      openAutoAhorroModal();
    }
  };

  const confirmAutoAhorro = () => {
    if (!config) return;
    const monto = parseFloat(localAutoMonto) || 0;
    if (monto <= 0 || localAutoMedios.length === 0) return;
    saveConfig({ ...config, meta: { ...config.meta, autoAhorro: { activo: true, monto, mediosPago: localAutoMedios, omitirDescripciones: localAutoOmitir } } });
    setShowAutoAhorroModal(false);
  };

  const canConfirmAutoAhorro = (() => {
    const monto = parseFloat(localAutoMonto) || 0;
    if (monto <= 0 || localAutoMedios.length === 0) return false;
    const saved = config?.meta.autoAhorro;
    const montoChanged = monto !== (saved?.monto ?? 0);
    const mediosChanged = JSON.stringify([...localAutoMedios].sort()) !== JSON.stringify([...(saved?.mediosPago ?? [])].sort());
    const omitirChanged = JSON.stringify([...localAutoOmitir].sort()) !== JSON.stringify([...(saved?.omitirDescripciones ?? [])].sort());
    return montoChanged || mediosChanged || omitirChanged || !saved?.activo;
  })();

  // ── Ahorros handler ──
  const guardarMetaAhorro = async () => {
    if (!config) return;
    const newMeta = { ...config.meta };
    if (metaFecha) newMeta.metaFecha = metaFecha;
    else delete newMeta.metaFecha;
    if (metaMonto) newMeta.metaMonto = parseFloat(metaMonto);
    else delete newMeta.metaMonto;
    if (sugeridoPorPeriodo != null) newMeta.metaPorPeriodo = sugeridoPorPeriodo;
    else delete newMeta.metaPorPeriodo;
    if (metaSaldo && parseFloat(metaSaldo) > 0) {
      if (monedaInversiones === "EUR") newMeta.saldoEUR = parseFloat(metaSaldo);
      else newMeta.saldoUSD = parseFloat(metaSaldo);
    } else {
      if (monedaInversiones === "EUR") delete newMeta.saldoEUR;
      else delete newMeta.saldoUSD;
    }
    // Cotización manual: si está activa y tiene valor > 0, reemplaza a bluelytics en la valuación.
    if (cotizManualOn && cotizManualVal && parseFloat(cotizManualVal) > 0) {
      newMeta.cotizacionManualActiva = true;
      newMeta.cotizacionManual = parseFloat(cotizManualVal);
    } else {
      delete newMeta.cotizacionManualActiva;
      delete newMeta.cotizacionManual;
    }
    newMeta.metaMoneda = "USD";
    await saveConfig({ ...config, meta: newMeta });
  };

  if (loading || !config) return (
    <div className="page">
      <LoadingSpinner />
    </div>
  );

  return (
    <div className="page fade-up">

      <div style={{ marginBottom: 24 }}>
        <div className="label" style={{ marginBottom: 2 }}>{t.preferences}</div>
        <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.5, display: "inline-block", background: "linear-gradient(110deg, var(--blue) 10%, var(--green) 90%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>{t.pageTitleSettings}</div>
      </div>

      {/* ── Acordeón unificado ── */}
      <div className="fade-up" style={{ display: "flex", flexDirection: "column", gap: 12 }}>


          {/* ── Cuenta (incluye Sincronización) ── */}
          <div className="card">
            <SectionHeader title={t.account} open={isOpen("account")} onClick={() => toggleSection("account")} danger={!!syncError} />
            {isOpen("account") && (<div style={{ marginTop: 12 }}>

            {/* Perfil — inline con botones de contraseña + idioma */}
            {(() => {
              const googlePhoto = auth.currentUser?.providerData.find((p) => p.providerId === "google.com")?.photoURL;
              const fotoSrc = config.meta.fotoURL || googlePhoto || null;
              const tieneNombre = !!config.meta.nombre;
              return (
              <div className="row" style={{ padding: "10px 0" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
                  {fotoSrc && !fotoError ? (
                    <img src={fotoSrc} alt="" width={36} height={36} referrerPolicy="no-referrer" onError={() => setFotoError(true)} style={{ width: 36, height: 36, borderRadius: 10, objectFit: "cover", flexShrink: 0, border: "1px solid var(--green)44" }} />
                  ) : (
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: tieneNombre ? "var(--green-dim)" : "var(--surface-alt)", border: `1px solid ${tieneNombre ? "var(--green)44" : "var(--border)"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="8" r="4" stroke={tieneNombre ? "var(--green)" : "var(--muted)"} strokeWidth="1.7" />
                        <path d="M4 20c0-3.87 3.58-7 8-7s8 3.13 8 7" stroke={tieneNombre ? "var(--green)" : "var(--muted)"} strokeWidth="1.7" strokeLinecap="round" />
                      </svg>
                    </div>
                  )}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{config.meta.nombre || t.user}</div>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user?.email}</div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0, alignItems: "center" }}>
                  <button onClick={openChangePass} aria-label={t.changePassword} style={{ width: 34, height: 34, borderRadius: 9, border: "1px solid var(--border)", background: "var(--surface-alt)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--muted)" }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  </button>
                  {(["es", "en"] as const).map((l) => (
                    <button key={l} onClick={() => { if (l !== lang) setPendingLang(l); }} aria-label={l === "es" ? "Español" : "English"}
                      style={{ width: 34, height: 34, borderRadius: 9, border: `1px solid ${lang === l ? "var(--accent)44" : "var(--border)"}`, background: lang === l ? "var(--accent-dim)" : "var(--surface-alt)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", opacity: lang === l ? 1 : 0.55, transition: "all 0.15s" }}>
                      {l === "es" ? <FlagAR size={20} /> : <FlagGB size={20} />}
                    </button>
                  ))}
                </div>
              </div>
              );
            })()}

            {/* Vincular / Desvincular Google */}
            <div className="row" style={{ padding: "12px 0", borderTop: "1px solid var(--faint)" }}>
              <button onClick={googleLinked ? undefined : handleLinkGoogle} disabled={googleLinked} style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0, background: "none", border: "none", cursor: googleLinked ? "default" : "pointer", textAlign: "left", padding: 0 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: googleLinked ? "var(--green-dim)" : "var(--surface-alt)", border: `1px solid ${googleLinked ? "var(--green)44" : "var(--border)"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
                    <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z" />
                  </svg>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13 }}>{googleLinked ? t.googleLinked : t.googleLink}</div>
                  {(googleErr || !googleLinked) && (
                    <div style={{ fontSize: 11, color: googleErr ? "var(--red)" : "var(--muted)", marginTop: 2 }}>{googleErr || t.googleLinkSub}</div>
                  )}
                </div>
              </button>
              {googleLinked && (
                <button onClick={() => setConfirmUnlink(true)} style={{ flexShrink: 0, fontSize: 11, fontWeight: 600, color: "var(--muted)", background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "4px 10px", cursor: "pointer" }}>
                  {t.googleUnlink}
                </button>
              )}
            </div>

            {/* Sincronización (solo dueño) — la fila abre el historial */}
            {isOwner && (
            <button onClick={() => syncLogs.length > 0 && setShowSyncLog(true)} className="row" style={{ width: "100%", padding: "12px 0", borderTop: "1px solid var(--faint)", background: "none", border: "none", borderTopColor: "var(--faint)", cursor: syncLogs.length > 0 ? "pointer" : "default", textAlign: "left" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: syncError ? "var(--red-dim)" : lastSync ? "var(--green-dim)" : "var(--surface-alt)",
                  border: `1px solid ${syncError ? "var(--red)44" : lastSync ? "var(--green)44" : "var(--border)"}`,
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  <svg className={syncing ? "spin" : ""} width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16"
                      stroke={syncError ? "var(--red)" : lastSync ? "var(--green)" : "var(--muted)"}
                      strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13 }}>Google Sheets</div>
                  <div style={{ fontSize: 11, marginTop: 2, color: syncError ? "var(--red)" : lastSync ? "var(--green)" : "var(--muted)" }}>
                    {syncError
                      ? t.syncErrorMsg(syncError.at.toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Argentina/Buenos_Aires" }))
                      : lastSync
                        ? t.lastSyncMsg(lastSync.toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Argentina/Buenos_Aires" }))
                        : t.neverSynced}
                  </div>
                </div>
              </div>
              {syncError && (
                <span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); if (!syncing) handleSync(); }} style={{
                  display: "flex", alignItems: "center", gap: 6, flexShrink: 0,
                  background: "var(--red-dim)", color: "var(--red)",
                  border: "1px solid var(--red)44", borderRadius: "var(--radius-sm)",
                  padding: "8px 14px", fontSize: 12, fontWeight: 700, cursor: syncing ? "default" : "pointer",
                }}>
                  {syncing ? t.retrying : t.retry}
                </span>
              )}
            </button>
            )}

            {/* Moneda principal */}
            <div style={{ padding: "12px 0", borderTop: "1px solid var(--faint)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--green-dim)", border: "1px solid var(--green)44", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ fontSize: 16, fontWeight: 700, color: "var(--green)", fontFamily: "var(--font-mono)", lineHeight: 1 }}>$</span>
                </div>
                <span style={{ fontSize: 13 }}>Moneda</span>
              </span>
              <div style={{ display: "flex", gap: 6 }}>
                {(["ARS", "USD", "EUR"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => monedaPrincipal !== m && setPendingMoneda(m)}
                    disabled={monedaPrincipal === m}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: monedaPrincipal === m ? "default" : "pointer",
                      border: `2px solid ${monedaPrincipal === m ? "var(--green)" : "var(--border)"}`,
                      background: monedaPrincipal === m ? "var(--green-dim)" : "transparent",
                      color: monedaPrincipal === m ? "var(--green)" : "var(--muted)",
                      opacity: monedaPrincipal === m ? 1 : 0.6,
                    }}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* Backup */}
            <button onClick={() => setShowExportConfirm(true)} className="row" style={{ width: "100%", padding: "12px 0", borderTop: "1px solid var(--faint)", background: "none", border: "none", borderTopColor: "var(--faint)", cursor: "pointer", textAlign: "left" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--accent-dim)", border: "1px solid var(--accent)44", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "var(--accent)" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize: 13 }}>Backup</div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{t.exportJSON}</div>
                </div>
              </div>
            </button>


            {/* Generar invitación (solo dueño) */}
            {isOwner && (
              <button onClick={generateInviteCode} disabled={genBusy} className="row" style={{ width: "100%", padding: "12px 0", borderTop: "1px solid var(--faint)", background: "none", border: "none", borderTopColor: "var(--faint)", cursor: genBusy ? "default" : "pointer", textAlign: "left" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--accent-dim)", border: "1px solid var(--accent)44", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "var(--accent)" }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>
                    </svg>
                  </div>
                  <div style={{ fontSize: 13, color: genBusy ? "var(--muted)" : "var(--text)" }}>
                    {genBusy ? "Generando…" : "Generar invitación"}
                  </div>
                </div>
              </button>
            )}

            </div>)}
          </div>

          {/* Personalization */}
          <div className="card">
            <SectionHeader title={t.general} open={isOpen("general")} onClick={() => toggleSection("general")} />
            {isOpen("general") && (<div style={{ marginTop: 16 }}>

            {/* Theme mode */}
            <div className="row" style={{ padding: "12px 0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: dark ? "var(--surface-alt)" : "var(--yellow-dim)",
                  border: "1px solid var(--border)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}>
                  {dark ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79Z" stroke="var(--muted)" strokeWidth="1.7" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="4" stroke="var(--yellow)" strokeWidth="1.7" />
                      <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="var(--yellow)" strokeWidth="1.7" strokeLinecap="round" />
                    </svg>
                  )}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{t.darkMode}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                    {dark ? t.switchToLight : t.switchToDark}
                  </div>
                </div>
              </div>
              <Toggle activo={dark} onClick={toggleTheme} />
            </div>

            {/* Dashboard clásico */}
            <div className="row" style={{ padding: "12px 0", borderTop: "1px solid var(--faint)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--surface-alt)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{t.dashboardClasico}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{t.dashboardClasicoSub}</div>
                </div>
              </div>
              <Toggle activo={dashboardClasico} onClick={() => setPref("dashboardClasico", !dashboardClasico)} />
            </div>

            {/* Notificaciones */}
            {pushAvailable && (
              <div className="row" style={{ padding: "12px 0", borderTop: "1px solid var(--faint)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: pushOn ? "var(--green-dim)" : "var(--surface-alt)", border: `1px solid ${pushOn ? "var(--green)44" : "var(--border)"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={pushOn ? "var(--green)" : "var(--muted)"} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                    </svg>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13 }}>{t.notifications}</div>
                    <div style={{ fontSize: 11, color: pushError ? "var(--red)" : "var(--muted)", marginTop: 2 }}>{pushError || t.notificationsSub}</div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                  <Toggle activo={pushOn} onClick={togglePush} />
                </div>
              </div>
            )}

            {/* Recordatorios (requiere notificaciones activas) */}
            {pushOn && (
              <button onClick={openRecordatorios} className="row" style={{ width: "100%", padding: "12px 0", borderTop: "1px solid var(--faint)", background: "none", border: "none", borderTopColor: "var(--faint)", cursor: "pointer", textAlign: "left" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: recordatorios.length > 0 ? "var(--green-dim)" : "var(--orange-dim)", border: `1px solid ${recordatorios.length > 0 ? "var(--green)44" : "var(--orange)44"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: recordatorios.length > 0 ? "var(--green)" : "var(--orange)" }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="13" r="8" /><path d="M12 9v4l2 2" /><path d="M5 3 2 6" /><path d="m22 6-3-3" />
                    </svg>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13 }}>{t.reminders}</div>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{t.remindersSub}</div>
                  </div>
                </div>
              </button>
            )}

            {/* Desbloqueo con huella */}
            {bioAvailable && (
              <div className="row" style={{ padding: "12px 0", borderTop: "1px solid var(--faint)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: bioEnabled ? "var(--green-dim)" : "var(--surface-alt)", border: `1px solid ${bioEnabled ? "var(--green)44" : "var(--border)"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={bioEnabled ? "var(--green)" : "var(--muted)"} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 11c0 3 0 6-1 8.5" /><path d="M8 11a4 4 0 0 1 8 0c0 3.5-.5 6-1.5 8" />
                      <path d="M5 11a7 7 0 0 1 14 0c0 1.5 0 3-.3 4.5" /><path d="M3 9a9 9 0 0 1 4-3.5M21 9a9 9 0 0 0-4-3.5" />
                    </svg>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13 }}>{t.biometricUnlock}</div>
                    <div style={{ fontSize: 11, color: bioError ? "var(--red)" : "var(--muted)", marginTop: 2 }}>{bioError || t.biometricUnlockSub}</div>
                  </div>
                </div>
                <Toggle activo={bioEnabled} onClick={toggleBiometric} />
              </div>
            )}

            {/* Reportes */}
            <div className="row" style={{ padding: "12px 0", borderTop: "1px solid var(--faint)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: showReportes ? "var(--green-dim)" : "var(--red-dim)",
                  border: `1px solid ${showReportes ? "var(--green)44" : "var(--red)44"}`,
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="3" width="18" height="18" rx="2" stroke={showReportes ? "var(--green)" : "var(--red)"} strokeWidth="1.7" />
                    <path d="M3 9h18M9 3v18" stroke={showReportes ? "var(--green)" : "var(--red)"} strokeWidth="1.7" />
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{t.reportsSection}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{t.showReportsLabel}</div>
                </div>
              </div>
              <Toggle activo={showReportes} onClick={() => {
                const next = !showReportes;
                setPref("showReportes", next);
                if (config) saveConfig({ ...config, meta: { ...config.meta, showReportes: next } });
              }} />
            </div>

            {/* Auto-ahorro */}
            <div className="row" style={{ padding: "12px 0", borderTop: "1px solid var(--faint)" }}>
              <div
                style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, cursor: config.meta.autoAhorro?.activo ? "pointer" : "default" }}
                onClick={config.meta.autoAhorro?.activo ? openAutoAhorroModal : undefined}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: config.meta.autoAhorro?.activo ? "var(--green-dim)" : "var(--red-dim)",
                  border: `1px solid ${config.meta.autoAhorro?.activo ? "var(--green)44" : "var(--red)44"}`,
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M12 3C7 3 3 7 3 12s4 9 9 9 9-4 9-9" stroke={config.meta.autoAhorro?.activo ? "var(--green)" : "var(--red)"} strokeWidth="1.7" strokeLinecap="round" />
                    <path d="M16 3h5v5" stroke={config.meta.autoAhorro?.activo ? "var(--green)" : "var(--red)"} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M12 8v4l3 3" stroke={config.meta.autoAhorro?.activo ? "var(--green)" : "var(--red)"} strokeWidth="1.7" strokeLinecap="round" />
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>Auto-ahorro</div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                    {config.meta.autoAhorro?.activo && config.meta.autoAhorro.monto > 0 ? (() => {
                      const sym = monedaPrincipal === "USD" ? "U$D" : monedaPrincipal === "EUR" ? "€" : "$";
                      const monto = `${sym}${config.meta.autoAhorro.monto.toLocaleString("es-AR")} por gasto`;
                      const medios = config.meta.autoAhorro.mediosPago ?? [];
                      const allActive = config.mediosPago.filter(m => m.activo).map(m => m.nombre);
                      const mediosStr = medios.length === 0 || medios.length === allActive.length
                        ? t.allMethods
                        : medios.join(" + ");
                      const omitir = config.meta.autoAhorro.omitirDescripciones ?? [];
                      const omitirStr = omitir.length > 0 ? ` · ${t.skipPrefix} ${omitir.join(", ")}` : "";
                      return `${monto} · ${mediosStr}${omitirStr}`;
                    })() : t.setsFixedAmount}
                  </div>
                </div>
              </div>
              <Toggle activo={config.meta.autoAhorro?.activo ?? false} onClick={handleToggleAutoAhorro} />
            </div>
            </div>)}
          </div>

          {/* ── Movimientos ── */}
          <div className="card">
            <SectionHeader title={t.settingsTabMovements} open={isOpen("movimientos")} onClick={() => toggleSection("movimientos")} />
            {isOpen("movimientos") && (<div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 12 }}>

          <div style={{ display: "flex", gap: 6 }}>
            {([
              { id: "categorias", label: t.categories },
              { id: "medios",     label: t.methods },
              { id: "origenes",   label: t.originsLabel },
            ] as const).map(s => (
              <button key={s.id} onClick={() => { setMovSub(s.id); setNuevoNombre(""); }}
                className="pill"
                style={{
                  borderColor: movSub === s.id ? "var(--accent)" : "var(--border)",
                  background: movSub === s.id ? "var(--accent-dim)" : "transparent",
                  color: movSub === s.id ? "var(--accent)" : "var(--muted)",
                }}>
                {s.label}
              </button>
            ))}
          </div>

          {movSub === "categorias" && (
            <div>
              <div className="label">{t.categories}</div>
              <div style={{ marginBottom: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", gap: 6 }}>
                  {(["Gasto", "Ingreso"] as const).map(tipo => (
                    <button key={tipo} onClick={() => setNuevoTipo(tipo)} className="pill" style={{
                      borderColor: nuevoTipo === tipo ? (tipo === "Gasto" ? "var(--red)" : "var(--green)") : "var(--border)",
                      background: nuevoTipo === tipo ? (tipo === "Gasto" ? "var(--red-dim)" : "var(--green-dim)") : "transparent",
                      color: nuevoTipo === tipo ? (tipo === "Gasto" ? "var(--red)" : "var(--green)") : "var(--muted)",
                    }}>{tipo === "Gasto" ? t.expenseType : t.incomeType}</button>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input value={nuevoNombre} onChange={e => setNuevoNombre(e.target.value)}
                    placeholder={t.newCategory} className="input" style={{ flex: 1 }} />
                  <button onClick={agregarCategoriaLocal}
                    style={{ background: "none", border: "none", color: "var(--green)", fontSize: 26, fontWeight: 300, cursor: "pointer", padding: "0 8px", lineHeight: 1 }}>
                    +
                  </button>
                </div>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {[...localCats].sort((a, b) => a.tipo === b.tipo ? 0 : a.tipo === "Gasto" ? -1 : 1).map(c => (
                  <Chip key={c.nombre} label={c.nombre}
                    colorVar={c.tipo === "Gasto" ? "var(--red)" : "var(--green)"}
                    dimVar={c.tipo === "Gasto" ? "var(--red-dim)" : "var(--green-dim)"}
                    activo={c.activa}
                    confirming={false}
                    onToggle={() => toggleCategoriaLocal(c.nombre)}
                    onLongPress={() => setPendingDelete({ kind: "cat", nombre: c.nombre })}
                    onConfirmDelete={() => eliminarCategoriaLocal(c.nombre)}
                  />
                ))}
              </div>
              <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 12 }}>{t.chipHint}</div>
            </div>
          )}

          {movSub === "medios" && (
            <div>
              <div className="label">{t.paymentMethods}</div>
              <div style={{ marginBottom: 14, display: "flex", gap: 8 }}>
                <input value={nuevoNombre} onChange={e => setNuevoNombre(e.target.value)}
                  placeholder={t.newMethod} className="input" style={{ flex: 1 }} />
                <button onClick={agregarMedioLocal}
                  style={{ background: "none", border: "none", color: "var(--green)", fontSize: 26, fontWeight: 300, cursor: "pointer", padding: "0 8px", lineHeight: 1 }}>
                  +
                </button>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {localMedios.map(m => (
                  <Chip key={m.nombre} label={m.nombre}
                    colorVar="var(--blue)" dimVar="var(--blue-dim)"
                    activo={m.activo}
                    confirming={false}
                    onToggle={() => toggleMedioLocal(m.nombre)}
                    onLongPress={() => setPendingDelete({ kind: "med", nombre: m.nombre })}
                    onConfirmDelete={() => eliminarMedioLocal(m.nombre)}
                  />
                ))}
              </div>
              <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 12 }}>{t.chipHint}</div>
            </div>
          )}

          {movSub === "origenes" && (
            <div>
              <div className="label">{t.savingsOrigins}</div>
              <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 12, marginTop: -6 }}>{t.shownWhenAddingIncomeSavings}</div>
              <div style={{ marginBottom: 14, display: "flex", gap: 8 }}>
                <input value={nuevoNombre} onChange={e => setNuevoNombre(e.target.value)}
                  placeholder={t.newOrigin} className="input" style={{ flex: 1 }} />
                <button onClick={agregarOrigenLocal}
                  style={{ background: "none", border: "none", color: "var(--green)", fontSize: 26, fontWeight: 300, cursor: "pointer", padding: "0 8px", lineHeight: 1 }}>
                  +
                </button>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {localOrigenes.map(o => (
                  <Chip key={o.nombre} label={o.nombre}
                    colorVar="var(--green)" dimVar="var(--green-dim)"
                    activo={o.activo}
                    confirming={false}
                    onToggle={() => toggleOrigenLocal(o.nombre)}
                    onLongPress={() => setPendingDelete({ kind: "ori", nombre: o.nombre })}
                    onConfirmDelete={() => eliminarOrigenLocal(o.nombre)}
                  />
                ))}
              </div>
              <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 12 }}>{t.chipHint}</div>
            </div>
          )}

            </div>)}
          </div>

          {/* ── Presupuestos ── */}
          <div className="card">
            <SectionHeader title={t.settingsTabBudgets} open={isOpen("presupuestos")} onClick={() => toggleSection("presupuestos")} />
            {isOpen("presupuestos") && (<div style={{ marginTop: 12 }}>
              <div className="label" style={{ marginBottom: 4 }}>{t.budgetTemplate}</div>
              <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 16 }}>{t.budgetTemplateSub}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
                {(config?.categorias ?? []).filter(c => c.activa && (c.tipo === "Gasto" || c.tipo === "Ambos")).map(c => (
                  <div key={c.nombre} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ flex: 1, fontSize: 13, color: "var(--text)" }}>{c.nombre}</span>
                    <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                      <span style={{ position: "absolute", left: 10, fontSize: 13, color: "var(--muted)", pointerEvents: "none" }}>$</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={localTemplate[c.nombre] ?? ""}
                        onChange={e => setLocalTemplate(prev => ({ ...prev, [c.nombre]: e.target.value }))}
                        placeholder="0"
                        className="input"
                        style={{ width: 130, paddingLeft: 22, textAlign: "right", fontFamily: "var(--font-mono)" }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              {(() => {
                const disabled = templateSaving || !templateIsDirty;
                return (
                  <button
                    onClick={saveTemplate}
                    disabled={disabled}
                    style={{ width: "100%", padding: "12px 0", borderRadius: "var(--radius-sm)", background: "var(--accent)", border: "none", color: "#fff", fontSize: 14, fontWeight: 700, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.35 : 1, transition: "opacity 0.2s" }}>
                    {templateSaving ? "…" : t.save}
                  </button>
                );
              })()}
            </div>)}
          </div>

          {/* ── Inversión ── (toda la sección visible solo si el dueño habilitó el permiso) */}
          {inversionAllowed && (
          <div className="card">
            <SectionHeader title={t.settingsTabInvestments} open={isOpen("ahorros")} onClick={() => toggleSection("ahorros")} />
            {isOpen("ahorros") && (<div style={{ marginTop: 12 }}>
            {/* Mostrar sección de inversión (preferencia del usuario) */}
            <div className="row" style={{ padding: "12px 0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: showAhorros ? "var(--green-dim)" : "var(--red-dim)", border: `1px solid ${showAhorros ? "var(--green)44" : "var(--red)44"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <polyline points="22 7 13.5 15.5 8.5 10.5 1 18" stroke={showAhorros ? "var(--green)" : "var(--red)"} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                    <polyline points="16 7 22 7 22 13" stroke={showAhorros ? "var(--green)" : "var(--red)"} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{t.investmentsSection}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{t.showInvestmentsLabel}</div>
                </div>
              </div>
              <Toggle activo={showAhorros} onClick={() => {
                const next = !showAhorros;
                setPref("showAhorros", next);
                if (config) saveConfig({ ...config, meta: { ...config.meta, showAhorros: next } });
              }} />
            </div>

            {showAhorros && (<>
            {/* Moneda de inversión */}
            <div style={{ padding: "12px 0", borderTop: "1px solid var(--faint)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--yellow-dim)", border: "1px solid var(--yellow)44", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ fontSize: 16, fontWeight: 700, color: "var(--yellow)", fontFamily: "var(--font-mono)", lineHeight: 1 }}>
                    {monedaPrincipal === "USD" ? "€" : monedaPrincipal === "EUR" ? "U$D" : (monedaInversiones === "EUR" ? "€" : "$")}
                  </span>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{t.investmentCurrency}</div>
                    {config?.meta.metaMonto && <span style={{ fontSize: 10, color: "var(--muted)" }}>{t.activeGoal}</span>}
                  </div>
                  {monedaPrincipal === "ARS" ? (
                    config?.meta.metaMonto ? (
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>{t.cantChangeWithGoal}</div>
                    ) : (
                      <div style={{ display: "flex", gap: 6 }}>
                        {(["USD", "EUR"] as const).map((m) => (
                          <button key={m} onClick={() => { setMoneda(m); if (config) saveConfig({ ...config, meta: { ...config.meta, monedaInversiones: m } }); }} className="pill" style={{ borderColor: monedaInversiones === m ? "var(--yellow)" : "var(--border)", background: monedaInversiones === m ? "var(--yellow-dim)" : "transparent", color: monedaInversiones === m ? "var(--yellow)" : "var(--muted)" }}>{m}</button>
                        ))}
                      </div>
                    )
                  ) : (
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>{monedaPrincipal === "USD" ? t.eurInvestments : t.usdInvestments}</div>
                  )}
                </div>
              </div>
            </div>

            <div style={{ fontSize: 11, color: "var(--muted)", borderTop: "1px solid var(--faint)", paddingTop: 12, marginBottom: 12 }}>
              {t.exchangeRate}: {tasaEnUso != null ? `$${tasaEnUso.toLocaleString("es-AR")}` : "—"} ({monedaInversiones === "EUR" ? "EUR" : "USD"})
            </div>

            {/* Cotización: automática (bluelytics) o manual */}
            <div style={{ padding: "10px 14px", borderRadius: "var(--radius-sm)", background: "var(--surface-alt)", border: "1px solid var(--border)", marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{cotizManualOn ? t.rateModeManual : t.manualRateAuto}</div>
                <Toggle activo={cotizManualOn} onClick={() => setCotizManualOn((v) => !v)} />
              </div>
              {cotizManualOn && (
                <input type="number" inputMode="decimal" value={cotizManualVal} placeholder="0"
                  onChange={(e) => setCotizManualVal(e.target.value)} className="input"
                  style={{ width: "100%", marginTop: 10, fontFamily: "var(--font-mono)" }} />
              )}
            </div>

            <div style={{ marginBottom: 12 }}>
              <div className="label" style={{ marginBottom: 6 }}>{t.initialReserve(monedaInversiones === "EUR" ? "EUR" : "USD")}</div>
              <input type="number" value={metaSaldo} placeholder="0"
                onChange={(e) => setMetaSaldo(e.target.value)} className="input" style={{ width: "100%" }} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
              <div>
                <div className="label" style={{ marginBottom: 6 }}>{t.targetDate}</div>
                <input type="date" value={metaFecha}
                  onChange={(e) => setMetaFecha(e.target.value)} className="input" style={{ width: "100%" }} />
              </div>
              <div>
                <div className="label" style={{ marginBottom: 6 }}>{t.targetAmount(monedaInversiones)}</div>
                <input type="number" value={metaMonto} placeholder="0"
                  onChange={(e) => setMetaMonto(e.target.value)} className="input" style={{ width: "100%" }} />
              </div>
            </div>

            <div style={{
              padding: "10px 14px", borderRadius: "var(--radius-sm)",
              background: "var(--surface-alt)", border: "1px solid var(--border)",
              marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <div style={{ fontSize: 11, color: "var(--muted)" }}>{t.estimatedPerPeriod}</div>
              <div style={{ fontSize: 15, fontWeight: 700, fontFamily: "var(--font-mono)", color: sugeridoPorPeriodo != null ? "var(--green)" : "var(--muted)" }}>
                {sugeridoPorPeriodo != null ? `U$D ${sugeridoPorPeriodo.toLocaleString("es-AR")}` : "—"}
              </div>
            </div>

            <div style={{ position: "relative", display: "flex", justifyContent: "center", alignItems: "center", height: 52, marginTop: 4 }}>
              <button onClick={guardarMetaAhorro} disabled={!isDirtyAhorros || guardando} style={{
                width: 56, height: 56, borderRadius: "50%",
                background: isDirtyAhorros ? "var(--green)" : "transparent",
                border: `2px solid ${isDirtyAhorros ? "var(--green)" : "var(--border)"}`,
                color: isDirtyAhorros ? "var(--bg)" : "var(--border)",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: isDirtyAhorros ? "pointer" : "default",
                transition: "background 0.2s, border-color 0.2s, color 0.2s",
                boxShadow: isDirtyAhorros ? "0 4px 20px var(--green)55" : "none",
                opacity: guardando ? 0.5 : 1,
              }}>
                {guardando
                  ? <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="spin"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" strokeDasharray="28 56" /></svg>
                  : <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                }
              </button>
              {(metaFecha || metaMonto) && (
                <button onClick={() => { setMetaFecha(""); setMetaMonto(""); }} aria-label={t.clear} style={{ position: "absolute", right: 0, background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: 8 }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="20" y1="4" x2="12" y2="12" />
                    <path d="M12.5 11.5 6 18l3 3 6.5-6.5z" />
                    <path d="M7 17.5 5 19.5M9 18.5 7.5 20M11 19.5 10 21" />
                  </svg>
                </button>
              )}
            </div>

            </>)}
            </div>)}
          </div>
          )}

          {/* ── Guía ── */}
          <div className="card">
            <SectionHeader title={t.guideSection} open={isOpen("guia")} onClick={() => toggleSection("guia")} />
            {isOpen("guia") && (<div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 14 }}>
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
              <button onClick={() => router.push("/onboarding?replay=1")} style={{ marginTop: 4, height: 44, borderRadius: 12, border: "1px solid var(--accent)44", background: "var(--accent-dim)", color: "var(--accent)", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                {t.replayTutorial}
              </button>
            </div>)}
          </div>

          {/* App + logout — los 3 en una fila */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 32, padding: "20px 0 8px" }}>
            {/* GitHub */}
            <button onClick={() => setShowGithubConfirm(true)} aria-label="GitHub" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", flexShrink: 0, padding: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
              </svg>
              <span style={{ fontSize: 9, letterSpacing: 0.4, textTransform: "uppercase", fontWeight: 600 }}>GitHub</span>
            </button>

            {/* Versión + changelog */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
              <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "var(--font-mono)", background: "linear-gradient(110deg, var(--blue) 10%, var(--green) 90%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>v{process.env.NEXT_PUBLIC_APP_VERSION}</div>
              <button onClick={openChangelog} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: 11, padding: 0, textDecoration: "underline" }}>changelog</button>
            </div>

            {/* Logout */}
            <button onClick={() => setConfirmLogout(true)} aria-label={t.signOut} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--red)", flexShrink: 0, padding: 0, display: "flex", alignItems: "center", justifyContent: "center", filter: "drop-shadow(0 2px 8px var(--red)66)" }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </button>
          </div>

        </div>

        {/* Solicitar baja de cuenta */}
        {!isOwner && (
          <button onClick={() => setShowDeleteConfirm(true)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: 11, padding: "8px 0 24px", textDecoration: "underline", textUnderlineOffset: 3 }}>
            solicitar eliminación de cuenta
          </button>
        )}

      {saveMsg && (
        <div className="fade-up" style={{
          position: "fixed", left: 16, right: 16, bottom: "calc(var(--nav-h) + 16px)",
          zIndex: 150, padding: "12px 16px", borderRadius: "var(--radius-sm)", fontSize: 13,
          background: saveMsg.ok ? "var(--green-dim)" : "var(--red-dim)",
          border: `1px solid ${saveMsg.ok ? "var(--green)" : "var(--red)"}44`,
          color: saveMsg.ok ? "var(--green)" : "var(--red)",
          textAlign: "center", backdropFilter: "blur(8px)",
        }}>
          {saveMsg.text}
        </div>
      )}

      {syncMsg && (
        <div className="fade-up" style={{
          position: "fixed", left: 16, right: 16, bottom: "calc(var(--nav-h) + 16px)",
          zIndex: 150, padding: "12px 16px", borderRadius: "var(--radius-sm)", fontSize: 13,
          background: syncMsg.ok ? "var(--green-dim)" : "var(--red-dim)",
          border: `1px solid ${syncMsg.ok ? "var(--green)" : "var(--red)"}44`,
          color: syncMsg.ok ? "var(--green)" : "var(--red)",
          textAlign: "center", backdropFilter: "blur(8px)",
        }}>
          {syncMsg.text}
        </div>
      )}

      <BottomSheet open={showAutoAhorroModal} onClose={() => setShowAutoAhorroModal(false)} title="Auto-ahorro">
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <div>
                <div className="label" style={{ marginBottom: 8 }}>{t.autoSavingsAmountPerExpense(monedaPrincipal === "USD" ? "U$D" : monedaPrincipal === "EUR" ? "€" : "$")}</div>
                <input
                  type="number" value={localAutoMonto} placeholder="0" className="input"
                  style={{ fontFamily: "var(--font-mono)", fontSize: 15 }}
                  onChange={e => setLocalAutoMonto(e.target.value)}
                />
              </div>
              <div>
                <div className="label" style={{ marginBottom: 8 }}>{t.appliedPaymentMethods}</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {config.mediosPago.filter(m => m.activo).map(m => {
                    const sel = localAutoMedios.includes(m.nombre);
                    return (
                      <button key={m.nombre} type="button"
                        onClick={() => setLocalAutoMedios(sel ? localAutoMedios.filter(x => x !== m.nombre) : [...localAutoMedios, m.nombre])}
                        className="pill" style={{
                          borderColor: sel ? "var(--blue)" : "var(--border)",
                          background: sel ? "var(--blue-dim)" : "transparent",
                          color: sel ? "var(--blue)" : "var(--muted)",
                        }}>{m.nombre}</button>
                    );
                  })}
                </div>
              </div>
              <div>
                <div className="label" style={{ marginBottom: 8 }}>{t.descriptionsToSkip}</div>
                <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <input
                    value={localAutoOmitirInput}
                    onChange={e => setLocalAutoOmitirInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter" && localAutoOmitirInput.trim()) {
                        const val = localAutoOmitirInput.trim();
                        if (!localAutoOmitir.includes(val)) setLocalAutoOmitir([...localAutoOmitir, val]);
                        setLocalAutoOmitirInput("");
                      }
                    }}
                    placeholder={t.egPlaceholder}
                    style={{ flex: 1, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "8px 12px", fontSize: 13, color: "var(--text)" }}
                  />
                  <button type="button" onClick={() => {
                    const val = localAutoOmitirInput.trim();
                    if (val && !localAutoOmitir.includes(val)) setLocalAutoOmitir([...localAutoOmitir, val]);
                    setLocalAutoOmitirInput("");
                  }} style={{ background: "none", border: "none", color: "var(--green)", fontSize: 26, fontWeight: 300, cursor: "pointer", padding: "0 8px", lineHeight: 1 }}>+</button>
                </div>
                {localAutoOmitir.length > 0 && (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {localAutoOmitir.map(d => (
                      <div key={d} style={{ display: "flex", alignItems: "center", gap: 4, background: "var(--red-dim)", border: "1px solid var(--red)33", borderRadius: 999, padding: "3px 10px" }}>
                        <span style={{ fontSize: 12 }}>{d}</span>
                        <button type="button" onClick={() => setLocalAutoOmitir(localAutoOmitir.filter(x => x !== d))} style={{ background: "none", border: "none", color: "var(--red)", cursor: "pointer", fontSize: 14, padding: 0, lineHeight: 1 }}>×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", justifyContent: "center", marginTop: 4 }}>
                <button onClick={confirmAutoAhorro} disabled={!canConfirmAutoAhorro || guardando} style={{
                  width: 56, height: 56, borderRadius: "50%",
                  background: canConfirmAutoAhorro ? "var(--green)" : "transparent",
                  border: `2px solid ${canConfirmAutoAhorro ? "var(--green)" : "var(--border)"}`,
                  color: canConfirmAutoAhorro ? "var(--bg)" : "var(--border)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: canConfirmAutoAhorro ? "pointer" : "default",
                  transition: "background 0.2s, border-color 0.2s, color 0.2s",
                  boxShadow: canConfirmAutoAhorro ? "0 4px 20px var(--green)55" : "none",
                  opacity: guardando ? 0.5 : 1,
                }}>
                  {guardando
                    ? <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="spin"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" strokeDasharray="28 56" /></svg>
                    : <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  }
                </button>
              </div>
            </div>
      </BottomSheet>

      <BottomSheet open={showSyncLog} onClose={() => setShowSyncLog(false)} title={t.syncHistory}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {syncLogs.length === 0 ? (
                <div style={{ color: "var(--muted)", fontSize: 13, textAlign: "center", padding: 24 }}>{t.noRecords}</div>
              ) : syncLogs.map((log, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 12px",
                  borderRadius: "var(--radius-sm)",
                  background: log.status === "ok" ? "var(--green-dim)" : "var(--red-dim)",
                  border: `1px solid ${log.status === "ok" ? "var(--green)33" : "var(--red)33"}`,
                }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: "50%", flexShrink: 0, marginTop: 4,
                    background: log.status === "ok" ? "var(--green)" : "var(--red)",
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: log.status === "ok" ? "var(--green)" : "var(--red)" }}>
                      {log.message}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 3, display: "flex", gap: 8 }}>
                      <span>{log.at.toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Argentina/Buenos_Aires" })}</span>
                      <span style={{
                        padding: "1px 6px", borderRadius: 4,
                        background: log.type === "auto" ? "var(--blue-dim)" : "var(--surface-alt)",
                        color: log.type === "auto" ? "var(--blue)" : "var(--muted)",
                        border: `1px solid ${log.type === "auto" ? "var(--blue)33" : "var(--border)"}`,
                        fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em",
                      }}>{log.type === "auto" ? "Auto" : "Manual"}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
      </BottomSheet>

      <BottomSheet open={showChangelog} onClose={() => setShowChangelog(false)} title="Changelog">
            <div style={{ fontSize: 13, lineHeight: 1.65, color: "var(--text)" }}>
              {changelog ? (() => {
                // Sólo las últimas 5 versiones (cada versión empieza con "## [")
                const all = changelog.split("\n");
                const top: string[] = [];
                let versions = 0;
                for (const line of all) {
                  if (line.startsWith("## [")) { versions++; if (versions > 5) break; }
                  top.push(line);
                }
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

      <BottomSheet open={showRecordatorios} onClose={() => setShowRecordatorios(false)} title={t.reminders}>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <input className="input" type="text" placeholder={t.reminderTextPlaceholder} value={recTexto} onChange={(e) => setRecTexto(e.target.value)} style={{ flex: 1 }} />
          <input className="input" type="date" value={recFecha} onChange={(e) => setRecFecha(e.target.value)} style={{ width: 140 }} />
          <button onClick={addRecordatorio} disabled={!recTexto.trim() || !recFecha} aria-label={t.add} style={{
            flexShrink: 0, width: 44, borderRadius: "var(--radius-sm)", border: "none",
            background: recTexto.trim() && recFecha ? "var(--green)" : "var(--surface-alt)",
            color: recTexto.trim() && recFecha ? "var(--bg)" : "var(--muted)", cursor: recTexto.trim() && recFecha ? "pointer" : "default", fontSize: 22, lineHeight: 1,
          }}>+</button>
        </div>
        {recordatorios.length === 0 ? (
          <div style={{ textAlign: "center", color: "var(--muted)", fontSize: 13, padding: "16px 0" }}>{t.noReminders}</div>
        ) : recordatorios.map((r) => (
          <div key={r.id} className="row" style={{ padding: "11px 0", borderBottom: "1px solid var(--faint)" }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.texto}</div>
              <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>{isoToFechaAR(r.fecha)}</div>
            </div>
            <button onClick={() => delRecordatorio(r.id)} aria-label={t.delete} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: 18, lineHeight: 1, padding: "0 4px", flexShrink: 0 }}>×</button>
          </div>
        ))}
      </BottomSheet>


      {confirmLeave && (
        <ConfirmModal title={t.leaveSiteTitle} confirmLabel={t.leaveSiteConfirm} cancelLabel={t.cancel}
          onConfirm={() => { window.open(CHANGELOG_WEB_URL, "_blank", "noopener,noreferrer"); setConfirmLeave(false); }}
          onCancel={() => setConfirmLeave(false)}>{t.leaveSiteBody}</ConfirmModal>
      )}

      {showExportConfirm && (
        <ConfirmModal title="Backup" confirmLabel={t.download} cancelLabel={t.cancel} confirmColor="var(--blue)"
          onConfirm={() => { exportJSON(); setShowExportConfirm(false); }}
          onCancel={() => setShowExportConfirm(false)}>{t.exportJSONBody}</ConfirmModal>
      )}

      {showDeleteConfirm && (
        <ConfirmModal
          title="Solicitar eliminación"
          confirmLabel="Enviar solicitud"
          cancelLabel={t.cancel}
          confirmColor="var(--red)"
          loading={deleteBusy}
          onConfirm={handleRequestDeletion}
          onCancel={() => setShowDeleteConfirm(false)}
        >
          <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>
            Se notificará al administrador para que confirme la eliminación de tus datos. Tu cuenta se desactivará hasta que el admin complete el proceso.
          </div>
        </ConfirmModal>
      )}

      {deleteRequested && (
        <ConfirmModal
          title="Solicitud enviada"
          confirmLabel="Aceptar"
          cancelLabel=""
          confirmColor="var(--green)"
          onConfirm={() => setDeleteRequested(false)}
          onCancel={() => setDeleteRequested(false)}
        >
          <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>
            Tu solicitud fue recibida. El administrador confirmará la eliminación de tus datos y te avisará.
          </div>
        </ConfirmModal>
      )}

      {showGithubConfirm && (
        <ConfirmModal title={t.openGitHub} confirmLabel={t.goToGitHub} cancelLabel={t.cancel} confirmColor="var(--blue)"
          onConfirm={() => { window.open("https://github.com/dsimdev/finmoves-app/blob/main/README.md", "_blank", "noopener,noreferrer"); setShowGithubConfirm(false); }}
          onCancel={() => setShowGithubConfirm(false)}>{t.goToGitHubBody}</ConfirmModal>
      )}

      {showChangePass && (
        <ConfirmModal
          title={t.changePassword}
          confirmLabel={t.saveProfile}
          cancelLabel={t.cancel}
          confirmColor="var(--blue)"
          loading={profileBusy}
          onConfirm={savePassword}
          onCancel={() => { setShowChangePass(false); setPassInput(""); setCurrentPassInput(""); setProfileMsg(null); }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <input type="password" value={currentPassInput} onChange={(e) => setCurrentPassInput(e.target.value)} className="input" placeholder={t.currentPasswordPlaceholder} autoComplete="current-password" autoFocus />
            <div style={{ position: "relative" }}>
              <input type={passVisible ? "text" : "password"} value={passInput} onChange={(e) => setPassInput(e.target.value)} className="input" style={{ width: "100%", paddingRight: 40 }} placeholder={t.newPasswordPlaceholder} autoComplete="new-password" />
              <button onClick={() => setPassVisible(v => !v)} aria-label={passVisible ? t.hide : t.show} style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 6, color: "var(--muted)", display: "flex" }}>
                {passVisible
                  ? <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  : <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}
              </button>
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>{t.passwordHint}</div>
            {profileMsg && <div style={{ fontSize: 12, color: profileMsg.ok ? "var(--green)" : "var(--red)", lineHeight: 1.5 }}>{profileMsg.text}</div>}
          </div>
        </ConfirmModal>
      )}

      {confirmLogout && (
        <ConfirmModal title={t.signOutTitle} confirmLabel={t.signOut} cancelLabel={t.cancel} confirmColor="var(--red)"
          onConfirm={async () => { useAppPrefs.getState().reset(); await signOut(auth); router.replace("/home"); }}
          onCancel={() => setConfirmLogout(false)}>{t.signOutBody}</ConfirmModal>
      )}

      {confirmUnlink && (
        <ConfirmModal title={t.googleUnlinkTitle} confirmLabel={t.googleUnlink} cancelLabel={t.cancel} confirmColor="var(--red)"
          onConfirm={handleUnlinkGoogle} onCancel={() => setConfirmUnlink(false)}>{t.googleUnlinkBody}</ConfirmModal>
      )}

      {pendingMoneda && (
        <ConfirmModal
          title="Cambiar moneda"
          confirmLabel="Cambiar"
          cancelLabel={t.cancel}
          confirmColor="var(--blue)"
          loading={monedaBusy}
          onConfirm={() => changeMoneda(pendingMoneda)}
          onCancel={() => setPendingMoneda(null)}
        >
          <div>
            <strong>De {config?.meta.monedaPrincipal || "ARS"} a {pendingMoneda}</strong>
            {pendingMoneda !== "ARS" && (
              <><br /><br /><span style={{ color: "var(--orange)", fontWeight: 600 }}>⚠ Se desactivará la inversión</span></>
            )}
          </div>
        </ConfirmModal>
      )}

      <BottomSheet open={showInviteModal} onClose={() => setShowInviteModal(false)} title={t.inviteCodeModalTitle}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, background: "var(--accent-dim)", border: "1px solid var(--accent)44", borderRadius: 14, padding: "16px 18px" }}>
              <span style={{ flex: 1, fontSize: 26, fontWeight: 700, fontFamily: "var(--font-mono)", letterSpacing: 4, color: "var(--accent)", textAlign: "center" }}>{inviteCode}</span>
              <button onClick={copyInviteCode} aria-label={t.copy} style={{ background: codeCopied ? "var(--green-dim)" : "var(--surface)", border: `1px solid ${codeCopied ? "var(--green)" : "var(--border)"}`, borderRadius: 10, width: 42, height: 42, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: codeCopied ? "var(--green)" : "var(--muted)", flexShrink: 0 }}>
                {codeCopied ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                )}
              </button>
            </div>
      </BottomSheet>

      {pendingLang && (
        <ConfirmModal title={t.changeLanguageTitle} confirmLabel={t.confirm} cancelLabel={t.cancel} confirmColor="var(--blue)"
          onConfirm={() => { setLang(pendingLang); window.location.href = "/"; }}
          onCancel={() => setPendingLang(null)}>{t.changeLanguageBody}</ConfirmModal>
      )}

      {pendingDelete && (
        <ConfirmModal title={t.delete} confirmLabel={t.yesDelete} cancelLabel={t.cancel} confirmColor="var(--red)"
          onConfirm={confirmPendingDelete} onCancel={() => setPendingDelete(null)}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>{pendingDelete.nombre}</div>
            <div>{t.actionIrreversible}</div>
          </div>
        </ConfirmModal>
      )}
    </div>
  );
}
