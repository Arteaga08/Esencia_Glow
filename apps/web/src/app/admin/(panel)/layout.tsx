import { UserRole } from "@esencia-glow/shared";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AdminShell } from "../../../components/shell/admin-shell";
import { NoAccess } from "../../../components/shell/no-access";
import { SessionUnavailable } from "../../../components/ui/session-unavailable";
import { getSessionState } from "../../../lib/session";
import { ADMIN_LOGIN_PATH } from "../../../lib/admin-routes";

// El panel nunca se indexa (FRONTEND_GUIDELINES.md §6 / DESIGN.md, Anti-referencias).
export const metadata: Metadata = {
  title: "Panel de Administración — Esencia Glow",
  description: "Panel administrativo de Esencia Glow.",
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};

/**
 * Guard de sesión (FRONTEND_GUIDELINES.md §2): valida contra el backend
 * (`GET /auth/me`, `cache: "no-store"`), no solo la presencia de la cookie.
 * Sin sesión válida → login. Con sesión pero sin rol admin → estado "Sin
 * permisos" explícito, nunca un redirect silencioso que cicle con el login. Si
 * el API no pudo responder (429, caído) la sesión NO se da por perdida: se
 * ofrece reintentar en vez de sacar a la admin al login.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const state = await getSessionState();
  if (state.status === "anonymous") redirect(ADMIN_LOGIN_PATH);
  if (state.status === "unavailable") {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background px-4">
        <SessionUnavailable />
      </div>
    );
  }
  const { session } = state;

  if (session.user.role !== UserRole.ADMIN) {
    return <NoAccess />;
  }

  return <AdminShell user={session.user}>{children}</AdminShell>;
}
