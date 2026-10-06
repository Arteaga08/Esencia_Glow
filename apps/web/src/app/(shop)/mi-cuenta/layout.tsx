import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AccountShell } from "@/components/storefront/account/account-shell";
import { SessionGate } from "@/components/storefront/account/session-gate";
import { ADMIN_HOME_PATH } from "@/lib/admin-routes";
import { getCustomerSession } from "@/lib/storefront/customer-session";

// Cuenta personal: nunca se indexa.
export const metadata: Metadata = { title: "Mi cuenta — Esencia Glow", robots: { index: false, follow: false } };

/**
 * Guard de sesión server-side: valida contra el backend (`GET /auth/me`), no solo
 * la presencia de la cookie. Sin sesión NO se pinta ningún dato: `SessionGate`
 * intenta el refresco silencioso y, si no hay forma, manda a /ingresar. Una
 * cuenta del equipo no tiene "Mi cuenta": va al panel.
 */
export default async function AccountLayout({ children }: { children: ReactNode }) {
  const session = await getCustomerSession();
  if (!session) return <SessionGate />;
  if (session.user.role !== "customer") redirect(ADMIN_HOME_PATH);

  return <AccountShell firstName={session.user.firstName}>{children}</AccountShell>;
}
