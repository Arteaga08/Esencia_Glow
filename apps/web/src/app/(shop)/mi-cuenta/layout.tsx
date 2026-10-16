import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AccountShell } from "@/components/storefront/account/account-shell";
import { SessionGate } from "@/components/storefront/account/session-gate";
import { SessionUnavailable } from "@/components/ui/session-unavailable";
import { ADMIN_HOME_PATH } from "@/lib/admin-routes";
import { getCustomerSession } from "@/lib/storefront/customer-session";

// Cuenta personal: nunca se indexa.
export const metadata: Metadata = { title: "Mi cuenta — Esencia Glow", robots: { index: false, follow: false } };

/**
 * Guard de sesión server-side: valida contra el backend (`GET /auth/me`), no solo
 * la presencia de la cookie. Sin sesión NO se pinta ningún dato: `SessionGate`
 * intenta el refresco silencioso y, si no hay forma, manda a /ingresar. Una
 * cuenta del equipo no tiene "Mi cuenta": va al panel. Si el API no pudo
 * responder (429, caído) la sesión no se da por perdida: se ofrece reintentar.
 */
export default async function AccountLayout({ children }: { children: ReactNode }) {
  const state = await getCustomerSession();
  if (state.status === "anonymous") return <SessionGate />;
  if (state.status === "unavailable") {
    return (
      <main className="mx-auto max-w-shell px-4 pt-28 pb-32 md:px-8">
        <SessionUnavailable />
      </main>
    );
  }
  const { session } = state;
  if (session.user.role !== "customer") redirect(ADMIN_HOME_PATH);

  return <AccountShell firstName={session.user.firstName}>{children}</AccountShell>;
}
