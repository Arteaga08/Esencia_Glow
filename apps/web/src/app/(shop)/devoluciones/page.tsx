import type { Metadata } from "next";
import { LegalPage } from "@/components/storefront/legal/legal-page";
import { ReturnsContent } from "@/components/storefront/legal/returns-content";
import { LEGAL_DETAILS } from "@/lib/storefront/legal/legal-details";

export const metadata: Metadata = {
  title: "Cambios y devoluciones | Esencia Glow",
  description: "Plazos, condiciones y pasos para cambiar o devolver un producto de Esencia Glow, y cómo se hace el reembolso.",
};

export default function ReturnsPage() {
  return (
    <LegalPage title="Cambios y devoluciones" subtitle={`Última actualización: ${LEGAL_DETAILS.publishedAt}`}>
      <ReturnsContent />
    </LegalPage>
  );
}
