import { vi } from "vitest";
import type { PaymentAuthorization, PaymentProvider, PaymentWebhookEvent } from "../../src/services/payment-provider.js";
import { parseStripeWebhookEvent } from "../../src/services/stripe-webhook-translator.js";
import { TEST_STRIPE_WEBHOOK_SECRET } from "./stripe-webhook-fixtures.js";

/**
 * Proveedor de pagos falso, determinista y sin red — inyectado en los
 * servicios que consumen `PaymentProvider` para testear sin llaves reales
 * de Stripe (ver plan de 1.6 §A). `parseWebhookEvent` usa el traductor
 * REAL con un secreto de prueba fijo (§9 del plan de 1.6.2): los tests de
 * rutas firman con `stripe-webhook-fixtures.ts` y ejercitan la
 * verificación de firma de verdad, sin red.
 */
function buildFakePaymentProvider(overrides: Partial<PaymentProvider> = {}): PaymentProvider {
  let counter = 0;
  const defaultAuthorization = (): PaymentAuthorization => {
    counter += 1;
    return {
      intentId: `pi_fake_${counter}`,
      status: "awaiting_customer",
      amountCents: 0,
      currency: "mxn",
      clientSecret: `pi_fake_${counter}_secret`,
    };
  };

  return {
    authorize: vi.fn().mockImplementation(async () => defaultAuthorization()),
    getAuthorization: vi.fn().mockImplementation(async (intentId: string) => ({
      intentId,
      status: "awaiting_customer",
      amountCents: 0,
      currency: "mxn",
      clientSecret: `${intentId}_secret`,
    })),
    cancel: vi.fn().mockResolvedValue("canceled"),
    refund: vi.fn().mockResolvedValue({ refundId: "re_fake_1", status: "succeeded" }),
    parseWebhookEvent: vi.fn().mockImplementation(
      (rawBody: Buffer, signature: string): PaymentWebhookEvent =>
        parseStripeWebhookEvent(rawBody, signature, { secret: TEST_STRIPE_WEBHOOK_SECRET, toleranceSeconds: 300 }),
    ),
    ...overrides,
  };
}

export { buildFakePaymentProvider };
