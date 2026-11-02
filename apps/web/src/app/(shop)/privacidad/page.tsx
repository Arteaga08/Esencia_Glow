import type { Metadata } from "next";
import { LegalPage } from "@/components/storefront/legal/legal-page";
import { PrivacyContent } from "@/components/storefront/legal/privacy-content";
import { LEGAL_DETAILS } from "@/lib/storefront/legal/legal-details";

export const metadata: Metadata = {
  title: "Aviso de privacidad | Esencia Glow",
  description: "Qué datos personales recaba Esencia Glow, para qué los usa, con quién los comparte y cómo ejercer tus derechos.",
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Aviso de privacidad" subtitle={`Última actualización: ${LEGAL_DETAILS.publishedAt}`}>
      <PrivacyContent />
    </LegalPage>
  );
}
