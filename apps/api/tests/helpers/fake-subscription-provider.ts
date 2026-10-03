import { vi } from "vitest";
import type { ProviderSubscription, SubscriptionProvider } from "../../src/services/subscription-provider.js";

/**
 * Proveedor de Stripe Billing falso, determinista y sin red — mismo patrón
 * que fake-payment-provider.ts. Refs deterministas por contador para poder
 * asertar sobre ellas en los tests.
 *
 * `startSubscription`/`getSubscription` (Fase 4) devuelven `status:
 * "incomplete"` con `clientSecret` — el golden path del endpoint de alta
 * nunca activa la cuenta por sí solo, eso lo decide el webhook real.
 *
 * Autoservicio (1.7.3): los métodos de mutación llevan ESTADO por ref
 * (`collectionPaused`, `cancelAtPeriodEnd`, `status`, `priceRef`), de modo que
 * un test puede leer `getSubscription(ref)` y comprobar lo que Stripe
 * "quedó" sabiendo — clave para las pruebas de compensación. Una ref que
 * nunca pasó por `startSubscription` (las cuentas de los tests se siembran
 * con un `providerSubscriptionId` arbitrario) se materializa como una
 * suscripción `active` en la primera mutación.
 */
function buildFakeSubscriptionProvider(overrides: Partial<SubscriptionProvider> = {}): SubscriptionProvider {
  let counter = 0;
  const subscriptions = new Map<string, ProviderSubscription>();

  function materialize(subscriptionRef: string): ProviderSubscription {
    const existing = subscriptions.get(subscriptionRef);
    if (existing) return existing;
    const created: ProviderSubscription = {
      subscriptionRef,
      status: "active",
      collectionPaused: false,
      cancelAtPeriodEnd: false,
      priceRef: "price_fake_initial",
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    };
    subscriptions.set(subscriptionRef, created);
    return created;
  }

  /** Aplica un parche al estado de la ref y devuelve una copia (un test no
   * debe poder mutar el estado interno por accidente). */
  function mutate(subscriptionRef: string, patch: Partial<ProviderSubscription>): ProviderSubscription {
    const next = { ...materialize(subscriptionRef), ...patch };
    subscriptions.set(subscriptionRef, next);
    return { ...next };
  }

  return {
    createPlanProduct: vi.fn().mockImplementation(async (input: { annualPriceCents?: number; quarterlyPriceCents?: number }) => {
      counter += 1;
      const refs: { productRef: string; priceRef: string; annualPriceRef?: string; quarterlyPriceRef?: string } = {
        productRef: `prod_fake_${counter}`,
        priceRef: `price_fake_${counter}`,
      };
      if (input.quarterlyPriceCents !== undefined) refs.quarterlyPriceRef = `price_fake_quarter_${counter}`;
      if (input.annualPriceCents !== undefined) refs.annualPriceRef = `price_fake_year_${counter}`;
      return refs;
    }),
    ensureCustomer: vi.fn().mockImplementation(async () => {
      counter += 1;
      return `cus_fake_${counter}`;
    }),
    startSubscription: vi.fn().mockImplementation(async () => {
      counter += 1;
      const subscriptionRef = `sub_fake_${counter}`;
      const subscription: ProviderSubscription = {
        subscriptionRef,
        collectionPaused: false,
        cancelAtPeriodEnd: false,
        status: "incomplete",
        clientSecret: `pi_fake_${counter}_secret`,
        firstChargeCents: 59900,
        currency: "mxn",
        nextChargeAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        latestChargeRef: `in_fake_${counter}`,
      };
      subscriptions.set(subscriptionRef, subscription);
      return subscription;
    }),
    getSubscription: vi.fn().mockImplementation(async (subscriptionRef: string) => {
      const found = subscriptions.get(subscriptionRef);
      if (found) return found;
      return {
        subscriptionRef,
        collectionPaused: false,
        cancelAtPeriodEnd: false,
        status: "incomplete",
        clientSecret: `pi_fake_unknown_secret`,
        firstChargeCents: 59900,
        currency: "mxn",
        nextChargeAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      } satisfies ProviderSubscription;
    }),
    // Igual que `getSubscription`: relee lo que `startSubscription`/una
    // mutación dejaron en el mapa. Un test que quiera simular "ya se pagó"
    // o "se anuló" llama `mutate`/pasa su propio override en `overrides`.
    getSubscriptionStart: vi.fn().mockImplementation(async ({ subscriptionRef }: { subscriptionRef: string }) => {
      const found = subscriptions.get(subscriptionRef);
      if (found) return found;
      return {
        subscriptionRef,
        collectionPaused: false,
        cancelAtPeriodEnd: false,
        status: "incomplete",
        clientSecret: `pi_fake_unknown_secret`,
        firstChargeCents: 59900,
        currency: "mxn",
        nextChargeAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      } satisfies ProviderSubscription;
    }),
    abandonSubscriptionStart: vi.fn().mockImplementation(async ({ subscriptionRef }: { subscriptionRef: string }) => {
      mutate(subscriptionRef, { status: "canceled" });
    }),
    pauseCollection: vi.fn().mockImplementation(async ({ subscriptionRef }: { subscriptionRef: string }) =>
      mutate(subscriptionRef, { collectionPaused: true }),
    ),
    resumeCollection: vi.fn().mockImplementation(async ({ subscriptionRef }: { subscriptionRef: string }) =>
      mutate(subscriptionRef, { collectionPaused: false }),
    ),
    setCancelAtPeriodEnd: vi
      .fn()
      .mockImplementation(async ({ subscriptionRef, cancelAtPeriodEnd }: { subscriptionRef: string; cancelAtPeriodEnd: boolean }) =>
        mutate(subscriptionRef, { cancelAtPeriodEnd }),
      ),
    cancelNow: vi.fn().mockImplementation(async ({ subscriptionRef }: { subscriptionRef: string }) =>
      mutate(subscriptionRef, { status: "canceled" }),
    ),
    changePrice: vi
      .fn()
      .mockImplementation(async ({ subscriptionRef, priceRef }: { subscriptionRef: string; priceRef: string }) =>
        mutate(subscriptionRef, { priceRef }),
      ),
    createPaymentMethodSetup: vi.fn().mockImplementation(async () => {
      counter += 1;
      return { clientSecret: `seti_fake_${counter}_secret` };
    }),
    // Por defecto un SetupIntent confirmado SIN refs: los tests de tarjeta
    // pasan su propio `getPaymentMethodSetup` con el customer/accountId que
    // quieran verificar (el caso feliz y el del customer ajeno).
    getPaymentMethodSetup: vi.fn().mockResolvedValue({ status: "succeeded" }),
    setDefaultPaymentMethod: vi.fn().mockResolvedValue(undefined),
    retryInvoicePayment: vi.fn().mockResolvedValue({ outcome: "paid" }),
    ...overrides,
  };
}

export { buildFakeSubscriptionProvider };
