import { UserRole } from "@esencia-glow/shared";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AdminShell } from "../../../components/shell/admin-shell";
import { NoAccess } from "../../../components/shell/no-access";
import { getSession } from "../../../lib/session";
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
 * permisos" explícito, nunca un redirect silencioso que cicle con el login.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) redirect(ADMIN_LOGIN_PATH);

  if (session.user.role !== UserRole.ADMIN) {
    return <NoAccess />;
  }

  return <AdminShell user={session.user}>{children}</AdminShell>;
}
