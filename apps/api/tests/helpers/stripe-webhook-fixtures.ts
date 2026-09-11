import Stripe from "stripe";

/**
 * Fixtures compartidas para firmar webhooks de Stripe en tests, sin llaves
 * reales ni red (§9 del plan de 1.6.2). El mismo secreto lo usa
 * `fake-payment-provider.ts` al construir su `parseWebhookEvent` por
 * defecto — así los tests de rutas firman payloads reales y ejercitan la
 * verificación de firma de verdad.
 */
const TEST_STRIPE_WEBHOOK_SECRET = "whsec_test_fixture_secret";

interface BuildStripeEventOptions {
  metadata?: Record<string, string>;
  lastError?: string;
}

/** Envolvente mínima de `Stripe.Event` para un PaymentIntent — solo los
 * campos que `stripe-webhook-translator.ts` lee. */
function buildStripeEvent(type: string, paymentIntentId: string, options: BuildStripeEventOptions = {}): string {
  return JSON.stringify({
    id: `evt_${paymentIntentId}_${Math.random().toString(36).slice(2, 8)}`,
    object: "event",
    type,
    data: {
      object: {
        id: paymentIntentId,
        object: "payment_intent",
        metadata: options.metadata ?? {},
        ...(options.lastError ? { last_payment_error: { message: options.lastError } } : {}),
      },
    },
  });
}

function signPayload(payload: string, opts: { timestamp?: number; secret?: string } = {}): string {
  return Stripe.webhooks.generateTestHeaderString({
    payload,
    secret: opts.secret ?? TEST_STRIPE_WEBHOOK_SECRET,
    ...(opts.timestamp !== undefined ? { timestamp: opts.timestamp } : {}),
  });
}

export { TEST_STRIPE_WEBHOOK_SECRET, buildStripeEvent, signPayload };
