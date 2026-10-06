"use client";

import Link from "next/link";
import { useState } from "react";
import { CreditCard, Storefront } from "@phosphor-icons/react";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { formatMoneyMXN } from "@/lib/format-money";
import { CTA_DISABLED, CTA_PRIMARY, FOCUS, LABEL, TEXT_LINK } from "@/components/storefront/cart/cta-styles";

type Method = "card" | "oxxo";

interface PaymentStepProps {
  /** `?estado=` de la vista: `oxxo` abre ese método, `rechazado` muestra el rechazo del banco. */
  state: string | null;
  totalCents: number;
  /** Confirmación con tarjeta. */
  doneHref: string;
  /** Confirmación con ficha OXXO. */
  oxxoDoneHref: string;
}

const METHODS: Array<{ id: Method; title: string; hint: string }> = [
  { id: "card", title: "Tarjeta", hint: "Crédito o débito" },
  { id: "oxxo", title: "OXXO", hint: "Paga en efectivo en tienda" },
];

/** Panel con el campo de tarjeta. El real es el campo seguro de Stripe (un iframe que no se estiliza por dentro). */
function CardPanel({ rejected }: { rejected: boolean }) {
  return (
    <div className="flex flex-col gap-4">
      {rejected ? <FieldError message="Tu banco rechazó el pago. Revisa los datos o prueba con otra tarjeta." /> : null}
      <Input label="Número de tarjeta" placeholder="4242 4242 4242 4242" inputMode="numeric" autoComplete="cc-number" error={rejected ? "El banco no autorizó esta tarjeta." : undefined} />
      <div className="grid grid-cols-2 gap-4">
        <Input label="Vence" placeholder="08/28" inputMode="numeric" autoComplete="cc-exp" />
        <Input label="CVC" placeholder="123" inputMode="numeric" autoComplete="cc-csc" />
      </div>
      <Input label="Nombre en la tarjeta" placeholder="María F. López" autoComplete="cc-name" />
      <p className="text-label text-muted-foreground-strong">Vista previa: en la tienda real estos campos los carga Stripe dentro de un recuadro seguro.</p>
    </div>
  );
}

/** Explica cómo funciona la ficha: el cliente debe saber que el pedido no sale hasta que OXXO confirme. */
function OxxoPanel() {
  return (
    <div className="flex flex-col gap-3 text-body text-foreground/80">
      <p>Al confirmar generamos una ficha con tu referencia. Tienes 2 días para pagarla en cualquier OXXO.</p>
      <p>Mientras tanto apartamos tus productos. Tu pedido se envía cuando OXXO confirma el pago, normalmente al siguiente día hábil.</p>
    </div>
  );
}

/**
 * Paso de pago: método (tarjeta u OXXO), sus campos, aceptación de términos y
 * botón con el total. El botón no se activa hasta aceptar los términos y lo
 * dice, en vez de dejar un botón apagado sin explicación.
 */
function PaymentStep({ state, totalCents, doneHref, oxxoDoneHref }: PaymentStepProps) {
  const [method, setMethod] = useState<Method>(state === "oxxo" ? "oxxo" : "card");
  const [accepted, setAccepted] = useState(state === "rechazado");

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <fieldset>
        <legend className={`mb-3 ${LABEL}`}>Método de pago</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {METHODS.map((item) => {
            const selected = item.id === method;
            const Icon = item.id === "card" ? CreditCard : Storefront;
            return (
              <label
                key={item.id}
                className={`flex min-h-16 cursor-pointer items-center gap-3 rounded-md border px-4 py-3 transition-colors duration-[var(--duration-base)] ease-out-quart has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring ${
                  selected ? "border-primary-action bg-blush" : "border-border-strong bg-surface hover:bg-muted"
                }`}
              >
                <input type="radio" name="payment-method" value={item.id} checked={selected} onChange={() => setMethod(item.id)} className="sr-only" />
                <Icon size={24} aria-hidden="true" className="shrink-0 text-foreground" />
                <span>
                  <span className="block text-subtitle text-foreground">{item.title}</span>
                  <span className="block text-body-sm text-muted-foreground-strong">{item.hint}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {method === "card" ? <CardPanel rejected={state === "rechazado"} /> : <OxxoPanel />}

      <label className="flex cursor-pointer items-start gap-3 text-body text-foreground">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(event) => setAccepted(event.target.checked)}
          className={`mt-0.5 size-5 shrink-0 cursor-pointer accent-primary-action ${FOCUS}`}
        />
        <span>
          Acepto los{" "}
          <Link href="#" className={`${TEXT_LINK} !min-h-0`}>
            términos y condiciones
          </Link>{" "}
          y el aviso de privacidad.
        </span>
      </label>

      {accepted ? (
        <Link href={method === "card" ? doneHref : oxxoDoneHref} className={`${CTA_PRIMARY} self-start`}>
          {method === "card" ? `Pagar ${formatMoneyMXN(totalCents)}` : "Generar ficha de pago"}
        </Link>
      ) : (
        <div className="flex flex-col items-start gap-2">
          <span aria-disabled="true" className={CTA_DISABLED}>
            {method === "card" ? `Pagar ${formatMoneyMXN(totalCents)}` : "Generar ficha de pago"}
          </span>
          <p className="text-body-sm text-muted-foreground-strong">Acepta los términos para continuar.</p>
        </div>
      )}
    </div>
  );
}

export { PaymentStep };
