import type { Metadata } from "next";
import { VerifyFlow } from "@/components/storefront/account/auth/verify-flow";

export const metadata: Metadata = { title: "Activa tu cuenta — Esencia Glow" };

/** El token viaja en la URL: `no-referrer` y `no-store` ya se aplican en next.config.ts. */
export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  const { token } = await searchParams;
  return <VerifyFlow token={typeof token === "string" && token.length > 0 ? token : null} />;
}
