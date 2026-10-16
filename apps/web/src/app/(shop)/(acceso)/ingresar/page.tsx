import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/storefront/account/auth/login-form";
import { getCustomerSession } from "@/lib/storefront/customer-session";
import { resolveRedirect } from "@/lib/storefront/safe-redirect";

export const metadata: Metadata = { title: "Ingresar — Esencia Glow" };

/** `/ingresar`: con sesión válida va directo al destino; si no, el formulario. */
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ redirect?: string | string[] }> }) {
  const redirectTo = resolveRedirect((await searchParams).redirect);

  // Sin poder confirmar la sesión (`unavailable`) se muestra el formulario: es lo seguro.
  const state = await getCustomerSession();
  if (state.status === "authenticated" && state.session.user.role === "customer") redirect(redirectTo);

  // El destino viaja también al ir a crear cuenta, para no perder a dónde iba.
  const registerHref = redirectTo === "/mi-cuenta" ? "/crear-cuenta" : `/crear-cuenta?redirect=${encodeURIComponent(redirectTo)}`;
  return <LoginForm redirectTo={redirectTo} registerHref={registerHref} />;
}
