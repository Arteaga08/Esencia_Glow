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
 * Deliberadamente SIN `providerSubscriptionId`/`providerCustomerId`,
 * `statusHistory` ni `cancelReason`: son detalles de Stripe, rastro interno de
 * auditoría y texto libre de la clienta, no información que la API le
 * devuelva.
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
  /** Cuándo pidió la cancelación programada (solo con `cancelAtPeriodEnd`). */
  cancelRequestedAt?: string;
  /** La cancelación programada todavía se puede deshacer: sigue vigente el
   * período pagado. Lo deriva el servidor para que el front no compare fechas. */
  canUndoCancel: boolean;
  /** Presente solo mientras la suscripción está `PAUSED`. */
  pausedAt?: string;
  /** Hay un cambio de plan en curso: por unos segundos pausar, cancelar y
   * cambiar de plan dan 409. */
  planChangePending: boolean;
  /** Solo informativo mientras hay dunning en curso; 0 en el camino feliz. */
  dunningAttempts: number;
  startedAt?: string;
  shipments: MySubscriptionShipment[];
}

/**
 * Autoservicio de la tarjeta (Milestone 1.7.3): dos pasos. El primero da el
 * `clientSecret` para que el front confirme la tarjeta en sesión con Stripe;
 * el segundo (`PUT`, con el `setupIntentId` que el front ya confirmó) la fija
 * como método de pago de la suscripción.
 */
interface SetupPaymentMethodResult {
  clientSecret: string;
}

/** Qué pasó con la factura pendiente al cambiar la tarjeta. Solo se reintenta
 * la factura de una cuenta `PAST_DUE`; en cualquier otro estado es
 * `not_needed`. El estado de la cuenta NUNCA cambia aquí: quien la reactiva
 * es el webhook `invoice.paid`. */
type InvoiceRetryOutcome = "not_needed" | "paid" | "already_settled" | "requires_action" | "declined";

interface UpdatePaymentMethodResult {
  invoiceRetry: InvoiceRetryOutcome;
}

export type {
  StartSubscriptionResult,
  MySubscription,
  MySubscriptionPlan,
  MySubscriptionShipment,
  SetupPaymentMethodResult,
  UpdatePaymentMethodResult,
  InvoiceRetryOutcome,
};
