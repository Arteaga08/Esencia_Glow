import type { PaymentMethod } from "@esencia-glow/shared";
import { env } from "../config/env.js";
import { isStripeConfigured, getStripeClient } from "../config/stripe.js";
import { createStripePaymentProvider } from "./stripe-payment-provider.js";

/**
 * Interfaz angosta del proveedor de pagos — mismo patrón que
 * media-provider.ts/shipping-provider.ts. Vocabulario propio del dominio:
 * nada llamado `payment_intent`/`client_secret`/`whsec_` escapa de este
 * archivo ni de stripe-payment-provider.ts (ver
 * ECOMMERCE_ARCHITECTURE_GUIDELINES.md §"El adapter habla nuestro
 * vocabulario"). Sin `capture`: este proyecto no tiene captura manual.
 */
interface PaymentCustomerInput {
  email: string;
  name: string;
}

interface PaymentShippingAddressInput {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
}

interface PaymentShippingInput {
  name: string;
  address: PaymentShippingAddressInput;
}

interface AuthorizePaymentInput {
  orderId: string;
  orderNumber: string;
  amountCents: number;
  currency: string;
  method: PaymentMethod;
  customer: PaymentCustomerInput;
  shipping: PaymentShippingInput;
  /** Requerido solo para `method: "oxxo"`. */
  oxxoVoucherDays?: number;
  idempotencyKey: string;
}

type PaymentAuthorizationStatus =
  | "awaiting_customer"
  | "processing"
  | "captured"
  | "requires_new_method"
  | "canceled";

interface PaymentAuthorization {
  intentId: string;
  status: PaymentAuthorizationStatus;
  amountCents: number;
  currency: string;
  /** Solo tarjeta, mientras el pago no se ha confirmado. */
  clientSecret?: string;
  /** Solo tarjeta, y solo una vez que Stripe ya tiene un cargo del cual
   * leerlo (nunca antes de capturar — frontera PCI SAQ-A). */
  card?: { brand: string; last4: string };
  /** Solo OXXO. */
  voucher?: { expiresAt: Date; hostedVoucherUrl: string };
  lastError?: string;
}

type CancelOutcome = "canceled" | "already_captured" | "not_cancelable";

interface PaymentProvider {
  authorize(input: AuthorizePaymentInput): Promise<PaymentAuthorization>;
  getAuthorization(intentId: string): Promise<PaymentAuthorization>;
  cancel(intentId: string, idempotencyKey: string): Promise<CancelOutcome>;
}

/**
 * Seam de pruebas: en `NODE_ENV=test` (nunca en dev/producción), un
 * proveedor falso inyectado explícitamente tiene prioridad sobre la
 * resolución real — así los tests de rutas (supertest contra `buildApp()`)
 * ejercitan el checkout completo (incluida la creación del PaymentIntent)
 * sin llaves reales de Stripe. `"unset"` distingue "nunca se llamó" de
 * "se llamó con `undefined`" (para probar el 503 explícitamente).
 */
let testOverride: PaymentProvider | undefined | "unset" = "unset";

function __setPaymentProviderForTests(provider: PaymentProvider | undefined): void {
  if (!env.isTest) {
    throw new Error("__setPaymentProviderForTests solo puede usarse en NODE_ENV=test");
  }
  testOverride = provider;
}

/** Único condicional de proveedor de todo el proyecto — mismo patrón que
 * `resolveMediaProvider()`/`resolveShippingProvider()`. */
function resolvePaymentProvider(): PaymentProvider | undefined {
  if (env.isTest && testOverride !== "unset") return testOverride;
  if (!isStripeConfigured()) return undefined;
  const client = getStripeClient();
  if (!client) return undefined;
  return createStripePaymentProvider(client);
}

export { resolvePaymentProvider, __setPaymentProviderForTests };
export type {
  PaymentProvider,
  AuthorizePaymentInput,
  PaymentAuthorization,
  PaymentAuthorizationStatus,
  CancelOutcome,
  PaymentCustomerInput,
  PaymentShippingInput,
  PaymentShippingAddressInput,
};
