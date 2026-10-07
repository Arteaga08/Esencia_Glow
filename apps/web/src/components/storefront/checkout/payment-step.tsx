"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { SpinnerGap } from "@phosphor-icons/react";
import { FieldError } from "@/components/ui/field-error";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckboxField } from "@/components/storefront/account/shared/checkbox-field";
import { formatMoneyMXN } from "@/lib/format-money";
import type { PreparedPayment } from "@/lib/storefront/checkout/prepare-payment";
import { useCardElement } from "@/lib/storefront/checkout/use-card-element";
import { CTA_DISABLED, CTA_PRIMARY, CTA_WIDTH, LABEL } from "../cart/cta-styles";

interface PaymentStepProps {
  amountCents: number;
  /** Aceptar términos se pide al crear el pedido; al reanudar ya se aceptaron. */
  requireTerms: boolean;
  prepare: () => Promise<PreparedPayment>;
}

const LINK_CLASS = "underline decoration-border-strong underline-offset-4 hover:decoration-foreground";

/**
 * Paso de pago, solo tarjeta. El campo de tarjeta es el de Stripe (un iframe: los
 * datos no pasan por esta app). Al pagar: revisa el formulario, pide a quien lo usa
 * el pedido y su `clientSecret`, y cobra. Un rechazo se avisa pegado al formulario
 * de tarjeta y se puede reintentar con los mismos datos del pedido.
 */
function PaymentStep({ amountCents, requireTerms, prepare }: PaymentStepProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const card = useCardElement(containerRef, amountCents);
  const [accepted, setAccepted] = useState(!requireTerms);
  const [paying, setPaying] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const goToConfirmation = (orderId: string) => router.push(`/checkout/confirmacion/${orderId}`);

  async function handlePay() {
    if (paying) return;
    setPaying(true);
    setCardError(null);
    setFormError(null);

    try {
      const invalid = await card.validate();
      if (invalid) {
        setCardError(invalid);
        return;
      }

      const prepared = await prepare();
      if (!prepared.ok) {
        if (prepared.settledOrderId) goToConfirmation(prepared.settledOrderId);
        else setFormError(prepared.message);
        return;
      }

      const outcome = await card.confirm(prepared.clientSecret, `${window.location.origin}/checkout/confirmacion/${prepared.orderId}`);
      if (outcome.status === "submitted" || outcome.status === "already") {
        goToConfirmation(prepared.orderId);
        return;
      }
      setCardError(outcome.message);
    } finally {
      setPaying(false);
    }
  }

  const unavailable = card.status === "unavailable";
  const label = `Pagar ${formatMoneyMXN(amountCents)}`;

  return (
    <div className="flex max-w-xl flex-col gap-6">
      {formError ? <FieldError message={formError} /> : null}

      <div>
        <p className={`mb-3 ${LABEL}`}>Tarjeta de crédito o débito</p>
        {unavailable ? (
          <FieldError message="Los pagos con tarjeta no están disponibles por ahora. Inténtalo de nuevo en unos minutos." />
        ) : (
          <>
            {card.status === "loading" ? <Skeleton className="h-36" /> : null}
            {/* Siempre en el flujo: el iframe de Stripe mide el ancho del contenedor al montarse. */}
            <div ref={containerRef} />
            {cardError ? (
              <div className="mt-3">
                <FieldError message={cardError} />
              </div>
            ) : null}
          </>
        )}
      </div>

      {requireTerms ? (
        <CheckboxField checked={accepted} onChange={setAccepted}>
          Acepto los{" "}
          <Link href="/terminos" target="_blank" className={LINK_CLASS}>
            términos y condiciones
          </Link>{" "}
          y el{" "}
          <Link href="/privacidad" target="_blank" className={LINK_CLASS}>
            aviso de privacidad
          </Link>
          .
        </CheckboxField>
      ) : null}

      {accepted && card.status === "ready" ? (
        // Mismo botón mientras paga (`aria-disabled`, no `disabled`): el foco no se pierde y el doble clic no hace nada.
        <button type="button" onClick={handlePay} aria-disabled={paying} aria-busy={paying} className={`${paying ? CTA_DISABLED : CTA_PRIMARY} ${CTA_WIDTH}`}>
          {paying ? <SpinnerGap size={18} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}
          {paying ? "Procesando el pago" : label}
        </button>
      ) : (
        <div className="flex flex-col items-start gap-2">
          <span aria-disabled="true" className={`${CTA_DISABLED} w-full sm:w-auto`}>
            {label}
          </span>
          {!accepted ? <p className="text-body-sm text-muted-foreground-strong">Acepta los términos para continuar.</p> : null}
        </div>
      )}
    </div>
  );
}

export { PaymentStep };
