import { ADVICE_WHATSAPP_HREF, STORE_WHATSAPP_HREF } from "@/lib/storefront/contact";
import { LEGAL_DETAILS as D } from "@/lib/storefront/legal/legal-details";
import { LegalLink, LegalParagraph } from "./legal-blocks";

const WHATSAPP_BUTTON =
  "inline-flex min-h-12 cursor-pointer items-center justify-center rounded-md border px-7 py-3 type-shop-cta text-foreground " +
  "transition-colors duration-[var(--duration-base)] ease-out-quart motion-reduce:transition-none " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

/** Contacto: los dos WhatsApp de la tienda (pedidos y asesoría), el correo y el horario. */
function ContactContent() {
  return (
    <>
      <section className="flex flex-col gap-3">
        <h2 className="text-section-title text-foreground">WhatsApp</h2>
        <LegalParagraph>
          Es la forma más rápida de hablar con nosotras. Escríbenos al {D.whatsapp} para dudas de un pedido, entregas, cambios o devoluciones, o
          pide asesoría para elegir tus productos.
        </LegalParagraph>
        <div className="mt-2 flex flex-wrap gap-3">
          <a href={STORE_WHATSAPP_HREF} target="_blank" rel="noopener noreferrer" className={`${WHATSAPP_BUTTON} border-foreground bg-surface hover:bg-primary`}>
            Dudas de un pedido
          </a>
          <a href={ADVICE_WHATSAPP_HREF} target="_blank" rel="noopener noreferrer" className={`${WHATSAPP_BUTTON} border-border-strong hover:bg-muted`}>
            Quiero asesoría
          </a>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-section-title text-foreground">Correo</h2>
        <LegalParagraph>{D.supportEmail}</LegalParagraph>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-section-title text-foreground">Horario de atención</h2>
        <LegalParagraph>
          {D.supportHours}. Respondemos en {D.responseTime}.
        </LegalParagraph>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-section-title text-foreground">Antes de escribirnos</h2>
        <LegalParagraph>
          Quizá tu respuesta ya está en <LegalLink href="/envios">Envíos y entregas</LegalLink> o en{" "}
          <LegalLink href="/devoluciones">Cambios y devoluciones</LegalLink>.
        </LegalParagraph>
      </section>
    </>
  );
}

export { ContactContent };
