import type { Metadata } from "next";
import { InicioClient } from "./InicioClient";

export const metadata: Metadata = {
  title: "FinMoves — Tus finanzas personales, claras",
  description: "FinMoves es una app personal para registrar tus gastos e ingresos, ver reportes, seguir tus ahorros e inversiones en dólares/euros y recibir recordatorios. Acceso por invitación.",
};

export default function InicioPage() {
  return <InicioClient />;
}
