/**
 * Contrato de la clienta para el módulo de suscripciones (Fase 4 de
 * 1.7.2a), mismo criterio que `CheckoutResult` en `order.ts`: solo lo que
 * el front necesita mostrar la leyenda legal antes de confirmar la
 * tarjeta. Los DTOs admin (planes/ediciones) siguen en
 * `apps/api/src/services/subscription-dto.ts` — este es el único contrato
 * de suscripciones que vive en `shared`, porque es el único con una ruta
 * pública hasta ahora.
 *
 * Sin ninguna noción de "activa": eso lo decide únicamente el webhook,
 * nunca la respuesta de este endpoint (mismo criterio que `CheckoutResult`
 * respecto a "pagado").
 */
interface StartSubscriptionResult {
  clientSecret: string;
  firstChargeCents: number;
  currency: string;
  nextChargeAt: string;
}

/**
 * Lo que la suscriptora ve de su propia suscripción (`GET /subscriptions/me`,
 * Milestone 1.7.2b). Vive en `shared` por la misma razón que
 * `StartSubscriptionResult`: es un contrato de ruta pública, consumido por
 * el storefront de M3.
 *
 * Deliberadamente SIN `providerSubscriptionId`/`providerCustomerId` ni
 * `statusHistory`: son detalles de Stripe y rastro interno de auditoría, no
 * información de la clienta.
 */
interface MySubscriptionPlan {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  currency: string;
}

interface MySubscriptionShipment {
  id: string;
  cycleYear: number;
  cycleMonth: number;
  status: string;
  carrier?: string;
  trackingNumber?: string;
  shippedAt?: string;
  deliveredAt?: string;
}

interface MySubscription {
  id: string;
  status: string;
  plan: MySubscriptionPlan;
  /** Fin del período pagado = fecha del próximo cobro. Ausente mientras la
   * cuenta sigue `INCOMPLETE` (Stripe todavía no cobró nada). */
  nextChargeAt?: string;
  cancelAtPeriodEnd: boolean;
  /** Solo informativo mientras hay dunning en curso; 0 en el camino feliz. */
  dunningAttempts: number;
  startedAt?: string;
  shipments: MySubscriptionShipment[];
}

export type { StartSubscriptionResult, MySubscription, MySubscriptionPlan, MySubscriptionShipment };
