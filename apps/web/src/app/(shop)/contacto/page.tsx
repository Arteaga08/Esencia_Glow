import type { Metadata } from "next";
import { ContactContent } from "@/components/storefront/legal/contact-content";
import { LegalPage } from "@/components/storefront/legal/legal-page";

export const metadata: Metadata = {
  title: "Contacto | Esencia Glow",
  description: "Escríbenos por WhatsApp para dudas de tu pedido, entregas, devoluciones o asesoría para elegir tus productos.",
};

export default function ContactPage() {
  return (
    <LegalPage title="Contacto" subtitle="Te ayudamos con tu pedido o a elegir tus productos.">
      <ContactContent />
    </LegalPage>
  );
}
