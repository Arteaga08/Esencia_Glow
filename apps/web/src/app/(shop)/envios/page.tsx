import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo/page-metadata";
import { LegalPage } from "@/components/storefront/legal/legal-page";
import { ShippingContent } from "@/components/storefront/legal/shipping-content";
import { LEGAL_DETAILS } from "@/lib/storefront/legal/legal-details";

export const metadata: Metadata = buildPageMetadata({
  title: "Envíos y entregas | Esencia Glow",
  description: "Entrega local, recoger en tienda y envíos a todo México: costos, tiempos y seguimiento de tu pedido.",
  path: "/envios",
});

export default function ShippingPage() {
  return (
    <LegalPage title="Envíos y entregas" subtitle={`Última actualización: ${LEGAL_DETAILS.publishedAt}`}>
      <ShippingContent />
    </LegalPage>
  );
}
