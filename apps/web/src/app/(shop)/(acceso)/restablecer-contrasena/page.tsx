import type { Metadata } from "next";
import { ResetForm } from "@/components/storefront/account/auth/reset-form";

export const metadata: Metadata = { title: "Contraseña nueva — Esencia Glow" };

/** El token viaja en la URL: `no-referrer` y `no-store` ya se aplican en next.config.ts. */
export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  const { token } = await searchParams;
  return <ResetForm token={typeof token === "string" && token.length > 0 ? token : null} />;
}
