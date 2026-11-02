import type { Metadata } from "next";
import { CookiesContent } from "@/components/storefront/legal/cookies-content";
import { LegalPage } from "@/components/storefront/legal/legal-page";
import { LEGAL_DETAILS } from "@/lib/storefront/legal/legal-details";

export const metadata: Metadata = {
  title: "Política de cookies | Esencia Glow",
  description: "Qué cookies usa la tienda de Esencia Glow, para qué sirven y cómo controlarlas.",
};

export default function CookiesPage() {
  return (
    <LegalPage title="Política de cookies" subtitle={`Última actualización: ${LEGAL_DETAILS.publishedAt}`}>
      <CookiesContent />
    </LegalPage>
  );
}
