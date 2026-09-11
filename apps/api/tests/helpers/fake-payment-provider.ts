import { vi } from "vitest";
import type { PaymentAuthorization, PaymentProvider } from "../../src/services/payment-provider.js";

/**
 * Proveedor de pagos falso, determinista y sin red — inyectado en los
 * servicios que consumen `PaymentProvider` para testear sin llaves reales
 * de Stripe (ver plan de 1.6 §A).
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
    ...overrides,
  };
}

export { buildFakePaymentProvider };
