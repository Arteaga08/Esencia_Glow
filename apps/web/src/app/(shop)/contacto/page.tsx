import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo/page-metadata";
import { ContactContent } from "@/components/storefront/legal/contact-content";
import { LegalPage } from "@/components/storefront/legal/legal-page";

export const metadata: Metadata = buildPageMetadata({
  title: "Contacto | Esencia Glow",
  description: "Escríbenos por WhatsApp para dudas de tu pedido, entregas, devoluciones o asesoría para elegir tus productos.",
  path: "/contacto",
});

export default function ContactPage() {
  return (
    <LegalPage title="Contacto" subtitle="Te ayudamos con tu pedido o a elegir tus productos.">
      <ContactContent />
    </LegalPage>
  );
}
