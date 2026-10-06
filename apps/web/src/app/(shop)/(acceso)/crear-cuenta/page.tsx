import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { RegisterFlow } from "@/components/storefront/account/auth/register-flow";
import { getCustomerSession } from "@/lib/storefront/customer-session";
import { resolveRedirect } from "@/lib/storefront/safe-redirect";

export const metadata: Metadata = { title: "Crear cuenta — Esencia Glow" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ redirect?: string | string[] }> }) {
  const redirectTo = resolveRedirect((await searchParams).redirect);

  const session = await getCustomerSession();
  if (session && session.user.role === "customer") redirect(redirectTo);

  const loginHref = redirectTo === "/mi-cuenta" ? "/ingresar" : `/ingresar?redirect=${encodeURIComponent(redirectTo)}`;
  return <RegisterFlow loginHref={loginHref} />;
}
