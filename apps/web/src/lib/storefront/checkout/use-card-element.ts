"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { loadStripe, type Stripe, type StripeElements } from "@stripe/stripe-js";
import { STRIPE_APPEARANCE } from "./stripe-appearance";
import { PUBLISHABLE_KEY } from "./stripe-config";
import { GENERIC_MESSAGE, mapIntentStatus, mapStripeError, DECLINED_MESSAGE, type ConfirmOutcome } from "./stripe-outcomes";

type CardElementStatus = "loading" | "ready" | "unavailable";

let stripePromise: Promise<Stripe | null> | null = null;

/** Se carga la primera vez que se necesita, no al importar: así el resto de la tienda no descarga Stripe.js. */
function getStripe(): Promise<Stripe | null> {
  if (!PUBLISHABLE_KEY) return Promise.resolve(null);
  // Si falla (bloqueador de anuncios, sin red) no se queda guardada la promesa rechazada: se puede reintentar.
  stripePromise ??= loadStripe(PUBLISHABLE_KEY).catch((error: unknown) => {
    stripePromise = null;
    throw error;
  });
  return stripePromise;
}

/**
 * Campo de tarjeta de Stripe (Payment Element) en modo diferido: se monta antes
 * de que exista el pedido, con el monto a cobrar. Los datos de la tarjeta viven
 * en el iframe de Stripe; esta app nunca los ve. `validate` comprueba el formulario
 * y `confirm` cobra con el `clientSecret` del pedido ya creado.
 */
function useCardElement(containerRef: RefObject<HTMLDivElement | null>, amountCents: number) {
  const [status, setStatus] = useState<CardElementStatus>(PUBLISHABLE_KEY ? "loading" : "unavailable");
  const stripeRef = useRef<Stripe | null>(null);
  const elementsRef = useRef<StripeElements | null>(null);
  // Siempre el monto vigente: si cambia mientras Stripe.js carga, el campo nace con el correcto.
  const amountRef = useRef(amountCents);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let cancelled = false;
    let destroy: (() => void) | undefined;

    void getStripe().then((stripe) => {
      if (cancelled) return;
      if (!stripe) {
        setStatus("unavailable");
        return;
      }
      stripeRef.current = stripe;
      const elements = stripe.elements({
        mode: "payment",
        amount: amountRef.current,
        currency: "mxn",
        // El PaymentIntent del API es solo de tarjeta y la tienda no cobra con OXXO:
        // se excluyen los métodos que Stripe ofrecería en MXN si estuvieran activos en el Dashboard.
        excludedPaymentMethodTypes: ["oxxo", "customer_balance"],
        locale: "es-419",
        appearance: STRIPE_APPEARANCE,
      });
      elementsRef.current = elements;

      const card = elements.create("payment", { wallets: { applePay: "never", googlePay: "never" } });
      card.on("ready", () => !cancelled && setStatus("ready"));
      card.on("loaderror", () => !cancelled && setStatus("unavailable"));
      card.mount(container);
      destroy = () => card.destroy();
    }).catch(() => {
      if (!cancelled) setStatus("unavailable");
    });

    return () => {
      cancelled = true;
      destroy?.();
      elementsRef.current = null;
    };
  }, [containerRef]);

  useEffect(() => {
    amountRef.current = amountCents;
    elementsRef.current?.update({ amount: amountCents });
  }, [amountCents]);

  /** Revisa lo escrito en el formulario de tarjeta; devuelve el mensaje del error, o `null` si está completo. */
  const validate = useCallback(async (): Promise<string | null> => {
    const elements = elementsRef.current;
    if (!elements) return GENERIC_MESSAGE;
    const { error } = await elements.submit();
    if (!error) return null;
    const outcome = mapStripeError(error);
    return "message" in outcome ? outcome.message : GENERIC_MESSAGE;
  }, []);

  const confirm = useCallback(async (clientSecret: string, returnUrl: string): Promise<ConfirmOutcome> => {
    const stripe = stripeRef.current;
    const elements = elementsRef.current;
    if (!stripe || !elements) return { status: "error", message: GENERIC_MESSAGE };

    const result = await stripe.confirmPayment({ elements, clientSecret, confirmParams: { return_url: returnUrl }, redirect: "if_required" });
    if (result.error) return mapStripeError(result.error);

    const outcome = mapIntentStatus(result.paymentIntent.status);
    if (outcome === "submitted") return { status: "submitted" };
    return outcome === "declined" ? { status: "declined", message: DECLINED_MESSAGE } : { status: "error", message: GENERIC_MESSAGE };
  }, []);

  return { status, validate, confirm };
}

export { useCardElement };
export type { CardElementStatus };
