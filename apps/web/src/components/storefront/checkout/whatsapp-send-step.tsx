"use client";

import { useState } from "react";
import { WhatsappLogo } from "@phosphor-icons/react";
import { CTA_PRIMARY, CTA_SECONDARY, CTA_WIDTH } from "../cart/cta-styles";

interface WhatsappSendStepProps {
  /** Enlace `wa.me` con el pedido ya escrito. */
  href: string;
  onClearCart: () => void;
}

/**
 * Último paso del checkout por WhatsApp. El botón es un enlace real (no un
 * `window.open` tras un clic): así el navegador no lo bloquea. El carrito NO se
 * vacía solo: la clienta pudo cerrar WhatsApp sin mandar el mensaje, y perderlo
 * sería peor que dejárselo; al volver ella decide.
 */
function WhatsappSendStep({ href, onClearCart }: WhatsappSendStepProps) {
  const [opened, setOpened] = useState(false);

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <p className="text-body text-foreground/80">
        Te abrimos WhatsApp con tu pedido ya escrito. Solo envía el mensaje: la dueña confirma contigo el pago y la entrega.
      </p>

      <a href={href} target="_blank" rel="noopener noreferrer" onClick={() => setOpened(true)} className={`${CTA_PRIMARY} ${CTA_WIDTH}`}>
        <WhatsappLogo size={20} weight="fill" aria-hidden="true" />
        {opened ? "Abrir WhatsApp otra vez" : "Enviar pedido por WhatsApp"}
      </a>

      {opened ? (
        <div role="status" className="flex flex-col items-start gap-3 rounded-md border border-border-strong bg-surface p-4">
          <p className="text-body-sm text-foreground">¿Ya enviaste tu pedido? Si ya lo mandaste, puedes vaciar tu carrito.</p>
          <button type="button" onClick={onClearCart} className={`${CTA_SECONDARY} h-11`}>
            Ya lo envié, vaciar mi carrito
          </button>
        </div>
      ) : null}
    </div>
  );
}

export { WhatsappSendStep };
