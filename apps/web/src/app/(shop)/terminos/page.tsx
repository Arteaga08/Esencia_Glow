import type { Metadata } from "next";
import { LegalPage } from "@/components/storefront/legal/legal-page";
import { TermsContent } from "@/components/storefront/legal/terms-content";
import { LEGAL_DETAILS } from "@/lib/storefront/legal/legal-details";

export const metadata: Metadata = {
  title: "Términos y condiciones | Esencia Glow",
  description: "Condiciones para comprar en Esencia Glow: cómo se hace un pedido, precios, pago, cupones y cancelaciones.",
};

export default function TermsPage() {
  return (
    <LegalPage title="Términos y condiciones" subtitle={`Última actualización: ${LEGAL_DETAILS.publishedAt}`}>
      <TermsContent />
    </LegalPage>
  );
}
