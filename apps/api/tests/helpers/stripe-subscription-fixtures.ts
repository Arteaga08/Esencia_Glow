/**
 * Fixtures de webhooks de Stripe Billing (Milestone 1.7.2a), firmadas con
 * `signPayload` de stripe-webhook-fixtures.ts. Reproducen la forma ANIDADA
 * real de la API (`apiVersion: "2026-08-26.dahlia"`, verificada contra los
 * tipos de `stripe@22.6.2`) — no la forma plana de versiones viejas de la
 * API: `invoice.subscription` y `invoice.payment_intent` YA NO existen de
 * primer nivel (viven en `invoice.parent.subscription_details.subscription`
 * y `invoice.confirmation_secret`), y `Subscription.current_period_end`
 * tampoco (vive en `subscription.items.data[0].current_period_end`). Un
 * fixture con la forma vieja haría pasar el traductor contra algo que en
 * producción lee `undefined` en cada campo — ver riesgo 1.7.2a §12.
 */

interface BuildStripeInvoiceEventOptions {
  subscriptionId?: string | null;
  accountIdMetadata?: string;
  amountPaid?: number;
  currency?: string;
  billingReason?: string;
  periodStart?: number;
  periodEnd?: number;
  attemptCount?: number;
  nextPaymentAttempt?: number | null;
  confirmationSecret?: string;
}

function buildStripeInvoiceEvent(
  type: string,
  invoiceId: string,
  options: BuildStripeInvoiceEventOptions = {},
): string {
  const subscriptionId = options.subscriptionId === undefined ? `sub_${invoiceId}` : options.subscriptionId;
  const now = Math.floor(Date.now() / 1000);

  return JSON.stringify({
    id: `evt_${invoiceId}_${Math.random().toString(36).slice(2, 8)}`,
    object: "event",
    type,
    data: {
      object: {
        id: invoiceId,
        object: "invoice",
        amount_paid: options.amountPaid ?? 59900,
        amount_due: options.amountPaid ?? 59900,
        currency: options.currency ?? "mxn",
        billing_reason: options.billingReason ?? "subscription_cycle",
        attempt_count: options.attemptCount ?? 1,
        next_payment_attempt: options.nextPaymentAttempt === undefined ? null : options.nextPaymentAttempt,
        ...(options.confirmationSecret
          ? { confirmation_secret: { client_secret: options.confirmationSecret, type: "payment_intent" } }
          : {}),
        parent: subscriptionId
          ? {
              type: "subscription_details",
              quote_details: null,
              subscription_details: {
                subscription: subscriptionId,
                metadata: options.accountIdMetadata ? { accountId: options.accountIdMetadata } : {},
              },
            }
          : null,
        lines: {
          object: "list",
          data: [
            {
              period: {
                start: options.periodStart ?? now,
                end: options.periodEnd ?? now + 30 * 24 * 60 * 60,
              },
            },
          ],
        },
      },
    },
  });
}

interface BuildStripeSubscriptionEventOptions {
  accountIdMetadata?: string;
  status?: string;
  cancelAtPeriodEnd?: boolean;
  currentPeriodStart?: number;
  currentPeriodEnd?: number;
  canceledAt?: number | null;
  /** Hora real de término (`ended_at`). Distinta de `canceledAt` cuando la
   * cancelación es al fin del período: `canceled_at` es la SOLICITUD. */
  endedAt?: number | null;
  cancellationReason?: string;
  /** `pause_collection.behavior` — ausente => sin pausa (`null` en Stripe). */
  pauseCollectionBehavior?: string;
}

function buildStripeSubscriptionEvent(
  type: string,
  subscriptionId: string,
  options: BuildStripeSubscriptionEventOptions = {},
): string {
  const now = Math.floor(Date.now() / 1000);

  return JSON.stringify({
    id: `evt_${subscriptionId}_${Math.random().toString(36).slice(2, 8)}`,
    object: "event",
    type,
    data: {
      object: {
        id: subscriptionId,
        object: "subscription",
        status: options.status ?? "active",
        cancel_at_period_end: options.cancelAtPeriodEnd ?? false,
        canceled_at: options.canceledAt === undefined ? null : options.canceledAt,
        ended_at: options.endedAt === undefined ? null : options.endedAt,
        pause_collection: options.pauseCollectionBehavior
          ? { behavior: options.pauseCollectionBehavior, resumes_at: null }
          : null,
        cancellation_details: options.cancellationReason ? { reason: options.cancellationReason } : null,
        metadata: options.accountIdMetadata ? { accountId: options.accountIdMetadata } : {},
        items: {
          object: "list",
          data: [
            {
              current_period_start: options.currentPeriodStart ?? now,
              current_period_end: options.currentPeriodEnd ?? now + 30 * 24 * 60 * 60,
            },
          ],
        },
      },
    },
  });
}

export { buildStripeInvoiceEvent, buildStripeSubscriptionEvent };
