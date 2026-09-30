# Cobro real del alta de suscripción — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hacer que `startSubscription()` cobre de verdad contra Stripe (precio completo del ciclo, sin prorrateo, ancla de renovación en un día fijo futuro), reemplazando el mecanismo `add_invoice_items` (que Stripe rechaza o no factura nada, según la variante probada) por una factura manual de alta, con todos sus efectos secundarios ajustados (replay del endpoint, traductor de webhooks, barrendero de altas abandonadas).

**Architecture:** `startSubscription()` crea la Subscription con ancla futura y `proration_behavior:"none"` (línea recurrente en $0), y por separado crea+finaliza una Invoice manual (InvoiceItem `price_data` one-time por el precio completo, ligada a esa Subscription) cuyo `confirmation_secret` es el `clientSecret` que el front confirma. Como la Subscription en Stripe queda `active` desde el día 1 (sin tarjeta), el estado "¿sigue esperando confirmación?" pasa a derivarse de la FACTURA (nuevo método `getSubscriptionStart`), no de `sub.status`. El traductor de webhooks acepta la forma de esta factura (`billing_reason:"manual"`, línea `invoice_item_details`). Un nuevo barrendero cancela altas abandonadas cuya factura nunca se pagó (Stripe ya no auto-expira la Subscription, porque nunca queda `incomplete`).

**Tech Stack:** Node/TS, Express, Mongoose, Stripe SDK 22.6.2 (API `2026-08-26.dahlia`), Vitest.

**Contexto de por qué (no lo pierdas al ejecutar tarea por tarea):** el mecanismo anterior (`billing_cycle_anchor_config` futuro + `add_invoice_items` con el Price recurrente) fue reportado por QA como roto (`invalid_request_error`). El primer intento de arreglo (cambiar `price` por `price_data` en `add_invoice_items`) sí evita el rechazo de Stripe, pero **verificado empíricamente contra la cuenta de test real**: con ancla futura + `proration_behavior:"none"`, Stripe **no genera ningún invoice** al crear la Subscription — la cuenta queda `active` sin cobrar nada, sin tarjeta. Las otras dos variantes probadas (ancla=ahora, o ancla futura con proration por defecto) tampoco logran "precio completo sin prorratear ni duplicar". El mecanismo de este plan (factura manual) SÍ fue verificado end-to-end contra Stripe test: genera un `confirmation_secret` real por el monto exacto, ligado correctamente a la Subscription.

---

## Estado de partida (ya existe en el worktree, rama `fix-subscription-first-invoice`)

`apps/api/src/services/stripe-subscription-provider.ts` tiene el intento anterior (`price_data` en `add_invoice_items`) y sus tests en `apps/api/tests/services/stripe-subscription-provider.test.ts` — este plan los **reemplaza por completo** (Tarea 2).

---

### Task 1: `SubscriptionProvider` — nuevos métodos en la interfaz agnóstica

**Files:**
- Modify: `apps/api/src/services/subscription-provider.ts`

- [ ] **Step 1: Agregar los tipos y métodos nuevos a la interfaz**

Justo debajo de `interface StartProviderSubscriptionInput` (antes de `ProviderSubscription`), sin tocar nada de lo existente:

```typescript
/**
 * Rama replay del alta (Fase 4): con el mecanismo de factura manual (ver
 * stripe-subscription-provider.ts), `sub.status` en Stripe queda `active`
 * desde el día 1 sin importar si ya se pagó — ya NO sirve para decidir si el
 * `clientSecret` sigue vigente. Este método relee la FACTURA de alta
 * (`invoiceRef`, guardado en `SubscriptionAccount.latestInvoiceId`) y
 * traduce SU estado como el `status` del DTO.
 */
interface GetSubscriptionStartInput {
  subscriptionRef: string;
  invoiceRef: string;
}

/**
 * Barrendero de altas abandonadas (Fase 5, ver jobs/expire-incomplete-subscriptions.ts):
 * cancela la Subscription y anula la factura de alta cuando la clienta nunca
 * confirmó la tarjeta. Sin `idempotencyKey`: cancelar/anular algo ya
 * cancelado/anulado es un no-op tolerado por el adapter, nunca un error que
 * deba reintentarse con una key nueva.
 */
interface AbandonSubscriptionStartInput {
  subscriptionRef: string;
  invoiceRef: string;
}
```

En `interface SubscriptionProvider`, justo debajo de `startSubscription`/`getSubscription`:

```typescript
  startSubscription(input: StartProviderSubscriptionInput): Promise<ProviderSubscription>;
  getSubscription(subscriptionRef: string): Promise<ProviderSubscription>;
  getSubscriptionStart(input: GetSubscriptionStartInput): Promise<ProviderSubscription>;
  abandonSubscriptionStart(input: AbandonSubscriptionStartInput): Promise<void>;
```

Y en los `export type` finales del archivo, agregar `GetSubscriptionStartInput` y `AbandonSubscriptionStartInput` a la lista.

- [ ] **Step 2: Verificar que compila (esto solo rompe la implementación, es esperado)**

Run: `cd apps/api && npx tsc -p tsconfig.json --noEmit`
Expected: FAIL — `createStripeSubscriptionProvider` (stripe-subscription-provider.ts) y `buildFakeSubscriptionProvider` (tests/helpers/fake-subscription-provider.ts) ya no cumplen la interfaz `SubscriptionProvider` (les faltan `getSubscriptionStart`/`abandonSubscriptionStart`). Se corrige en las Tareas 2 y 3.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/services/subscription-provider.ts
git commit -m "feat(subscriptions): agrega getSubscriptionStart/abandonSubscriptionStart a la interfaz del proveedor"
```

---

### Task 2: `stripe-subscription-provider.ts` — mecanismo de factura manual

**Files:**
- Modify: `apps/api/src/services/stripe-subscription-provider.ts`
- Modify (reescribir el bloque `startSubscription`): `apps/api/tests/services/stripe-subscription-provider.test.ts`

#### Step 1: Reemplazar el `StripeBillingClientLike` para incluir Invoices/InvoiceItems completos

`apps/api/src/services/stripe-subscription-provider.ts` — reemplazar el bloque `prices`/`invoices` actual (líneas ~37-58) por:

```typescript
  prices: {
    create: Stripe["prices"]["create"];
    retrieve: Stripe["prices"]["retrieve"];
  };
  customers: {
    create: Stripe["customers"]["create"];
    update: Stripe["customers"]["update"];
  };
  subscriptions: {
    create: Stripe["subscriptions"]["create"];
    retrieve: Stripe["subscriptions"]["retrieve"];
    update: Stripe["subscriptions"]["update"];
    cancel: Stripe["subscriptions"]["cancel"];
  };
  setupIntents: {
    create: Stripe["setupIntents"]["create"];
    retrieve: Stripe["setupIntents"]["retrieve"];
  };
  invoiceItems: {
    create: Stripe["invoiceItems"]["create"];
  };
  invoices: {
    create: Stripe["invoices"]["create"];
    finalizeInvoice: Stripe["invoices"]["finalizeInvoice"];
    voidInvoice: Stripe["invoices"]["voidInvoice"];
    retrieve: Stripe["invoices"]["retrieve"];
    pay: Stripe["invoices"]["pay"];
  };
```

(`products`/`customers` ya existían igual — solo se agregan `prices.retrieve`, `invoiceItems`, y tres métodos nuevos en `invoices`.)

#### Step 2: Escribir los tests ANTES de tocar `startSubscription`

Reemplazar TODO el bloque `describe("services/stripe-subscription-provider — startSubscription", ...)` y su `buildFakeStripeSubscription`/helpers asociados (de la Tarea anterior) por lo siguiente. Primero, el `buildFakeClient` del archivo necesita los nuevos métodos en sus defaults — modificar la función `buildFakeClient` al inicio del archivo:

```typescript
function buildFakeClient(overrides: Partial<StripeBillingClientLike> = {}): StripeBillingClientLike {
  return {
    products: { create: vi.fn() },
    prices: { create: vi.fn(), retrieve: vi.fn() },
    customers: { create: vi.fn(), update: vi.fn() },
    subscriptions: { create: vi.fn(), retrieve: vi.fn(), update: vi.fn(), cancel: vi.fn() },
    setupIntents: { create: vi.fn(), retrieve: vi.fn() },
    invoiceItems: { create: vi.fn() },
    invoices: { create: vi.fn(), finalizeInvoice: vi.fn(), voidInvoice: vi.fn(), retrieve: vi.fn(), pay: vi.fn() },
    ...overrides,
  } as StripeBillingClientLike;
}
```

Ahora el bloque de tests de `startSubscription` (reemplaza el existente por completo):

```typescript
/**
 * Fabrica una `Stripe.Subscription` recién creada con el mecanismo de
 * factura manual: `latest_invoice` SIEMPRE `null` (confirmado contra Stripe
 * real — con ancla futura + proration:none, Stripe no genera ningún invoice
 * al crear la Subscription), `status: "active"` desde el día 1 (sin
 * tarjeta). El período del ítem SÍ está poblado (lo necesita `startSubscription`
 * para `currentPeriodStart/End`/`nextChargeAt`).
 */
function buildFakeStripeSubscription(overrides: Record<string, unknown> = {}) {
  const now = Math.floor(Date.now() / 1000);
  const anchor = now + 10 * 24 * 60 * 60;
  return {
    id: "sub_1",
    object: "subscription",
    status: "active",
    billing_cycle_anchor: anchor,
    latest_invoice: null,
    items: {
      object: "list",
      data: [{ current_period_start: now, current_period_end: anchor }],
    },
    ...overrides,
  };
}

/** Precio recurrente que `startSubscription` relee vía `prices.retrieve`
 * para armar el `price_data` de la factura manual. */
function buildFakePrice(overrides: Record<string, unknown> = {}) {
  return {
    id: "price_1",
    object: "price",
    currency: "mxn",
    unit_amount: 59900,
    product: "prod_1",
    recurring: { interval: "month" },
    ...overrides,
  };
}

/** Factura manual finalizada — `confirmation_secret` expandido (PaymentIntent
 * real, confirmado contra Stripe test), `status: "open"` hasta que se pague. */
function buildFakeFinalizedInvoice(overrides: Record<string, unknown> = {}) {
  return {
    id: "in_manual_1",
    object: "invoice",
    status: "open",
    amount_due: 59900,
    currency: "mxn",
    billing_reason: "manual",
    confirmation_secret: { client_secret: "pi_manual_1_secret", type: "payment_intent" },
    ...overrides,
  };
}

describe("services/stripe-subscription-provider — startSubscription (factura manual de alta)", () => {
  function buildHappyPathClient(overrides: Partial<StripeBillingClientLike> = {}) {
    const subscriptionsCreate = vi.fn().mockResolvedValue(buildFakeStripeSubscription());
    const pricesRetrieve = vi.fn().mockResolvedValue(buildFakePrice());
    const invoiceItemsCreate = vi.fn().mockResolvedValue({ id: "ii_1" });
    const invoicesCreate = vi.fn().mockResolvedValue({ id: "in_manual_1" });
    const invoicesFinalize = vi.fn().mockResolvedValue(buildFakeFinalizedInvoice());
    const client = buildFakeClient({
      subscriptions: { create: subscriptionsCreate, retrieve: vi.fn(), update: vi.fn(), cancel: vi.fn() },
      prices: { create: vi.fn(), retrieve: pricesRetrieve },
      invoiceItems: { create: invoiceItemsCreate },
      invoices: {
        create: invoicesCreate,
        finalizeInvoice: invoicesFinalize,
        voidInvoice: vi.fn(),
        retrieve: vi.fn(),
        pay: vi.fn(),
      },
      ...overrides,
    });
    return { client, subscriptionsCreate, pricesRetrieve, invoiceItemsCreate, invoicesCreate, invoicesFinalize };
  }

  it("crea la Subscription (ancla futura, proration:none, SIN add_invoice_items) y la factura manual por el precio completo", async () => {
    const { client, subscriptionsCreate, pricesRetrieve, invoiceItemsCreate, invoicesCreate, invoicesFinalize } =
      buildHappyPathClient();
    const provider = createStripeSubscriptionProvider(client);

    const result = await provider.startSubscription({
      customerRef: "cus_1",
      priceRef: "price_1",
      billingAnchorDay: 15,
      metadata: { accountId: "acc_1", userId: "user_1", planId: "plan_1" },
      idempotencyKey: "account:acc_1:sub:1000",
    });

    // La Subscription: SIN add_invoice_items, ancla futura, proration none.
    const [subParams, subOptions] = subscriptionsCreate.mock.calls[0];
    expect(subParams.customer).toBe("cus_1");
    expect(subParams.items).toEqual([{ price: "price_1" }]);
    expect(subParams.payment_behavior).toBe("default_incomplete");
    expect(subParams.billing_cycle_anchor_config).toEqual({ day_of_month: 15, hour: 15 });
    expect(subParams.proration_behavior).toBe("none");
    expect(subParams).not.toHaveProperty("add_invoice_items");
    expect(subParams.metadata).toEqual({ accountId: "acc_1", userId: "user_1", planId: "plan_1" });
    expect(subOptions.idempotencyKey).toBe("account:acc_1:sub:1000:sub");

    // El Price recurrente se relee para conocer el monto exacto.
    expect(pricesRetrieve).toHaveBeenCalledWith("price_1");

    // El InvoiceItem: price_data one-time por el monto exacto del Price
    // recurrente, ligado a la Subscription, con el período del ciclo parcial.
    const [itemParams, itemOptions] = invoiceItemsCreate.mock.calls[0];
    expect(itemParams.customer).toBe("cus_1");
    expect(itemParams.subscription).toBe("sub_1");
    expect(itemParams.price_data).toEqual({ currency: "mxn", product: "prod_1", unit_amount: 59900 });
    expect(itemParams.period).toEqual({
      start: expect.any(Number),
      end: buildFakeStripeSubscription().billing_cycle_anchor,
    });
    expect(itemOptions.idempotencyKey).toBe("account:acc_1:sub:1000:invoice-item");

    // La Invoice: ligada a la misma Subscription, cobro automático.
    const [invoiceParams, invoiceOptions] = invoicesCreate.mock.calls[0];
    expect(invoiceParams.customer).toBe("cus_1");
    expect(invoiceParams.subscription).toBe("sub_1");
    expect(invoiceParams.collection_method).toBe("charge_automatically");
    expect(invoiceOptions.idempotencyKey).toBe("account:acc_1:sub:1000:invoice");

    expect(invoicesFinalize).toHaveBeenCalledWith("in_manual_1", { expand: ["confirmation_secret"] });

    // El DTO: status SIEMPRE "incomplete" (no se deriva de sub.status, que
    // Stripe deja "active" sin cobrar), clientSecret/monto/moneda de la
    // FACTURA, no de la Subscription.
    expect(result.status).toBe("incomplete");
    expect(result.subscriptionRef).toBe("sub_1");
    expect(result.clientSecret).toBe("pi_manual_1_secret");
    expect(result.firstChargeCents).toBe(59900);
    expect(result.currency).toBe("mxn");
    expect(result.nextChargeAt).toEqual(new Date(buildFakeStripeSubscription().billing_cycle_anchor * 1000));
    expect(result.currentPeriodStart).toBeInstanceOf(Date);
    expect(result.currentPeriodEnd).toBeInstanceOf(Date);
  });

  it("con billingAnchorMonth agrega month al billing_cycle_anchor_config (alta anual)", async () => {
    const { client, subscriptionsCreate } = buildHappyPathClient();
    const provider = createStripeSubscriptionProvider(client);

    await provider.startSubscription({
      customerRef: "cus_1",
      priceRef: "price_year_1",
      billingAnchorDay: 15,
      billingAnchorMonth: 9,
      metadata: { accountId: "acc_1", userId: "user_1", planId: "plan_1" },
      idempotencyKey: "account:acc_1:sub:1000",
    });

    const [subParams] = subscriptionsCreate.mock.calls[0];
    expect(subParams.billing_cycle_anchor_config).toEqual({ day_of_month: 15, hour: 15, month: 9 });
  });

  it("si el Price recurrente viene con product expandido a objeto, usa su id en price_data", async () => {
    const { client, invoiceItemsCreate } = buildHappyPathClient({
      prices: { create: vi.fn(), retrieve: vi.fn().mockResolvedValue(buildFakePrice({ product: { id: "prod_expandido" } })) },
    });
    const provider = createStripeSubscriptionProvider(client);

    await provider.startSubscription({
      customerRef: "cus_1",
      priceRef: "price_1",
      billingAnchorDay: 15,
      metadata: { accountId: "acc_1", userId: "user_1", planId: "plan_1" },
      idempotencyKey: "account:acc_1:sub:1000",
    });

    const [itemParams] = invoiceItemsCreate.mock.calls[0];
    expect(itemParams.price_data.product).toBe("prod_expandido");
  });

  it("si el Price recurrente no tiene unit_amount (por tramos), rechaza con 502 y no crea nada en Stripe", async () => {
    const { client, subscriptionsCreate, invoiceItemsCreate } = buildHappyPathClient({
      prices: { create: vi.fn(), retrieve: vi.fn().mockResolvedValue(buildFakePrice({ unit_amount: null })) },
    });
    const provider = createStripeSubscriptionProvider(client);

    await expect(
      provider.startSubscription({
        customerRef: "cus_1",
        priceRef: "price_1",
        billingAnchorDay: 15,
        metadata: { accountId: "acc_1", userId: "user_1", planId: "plan_1" },
        idempotencyKey: "account:acc_1:sub:1000",
      }),
    ).rejects.toMatchObject({ statusCode: 502 });
    expect(subscriptionsCreate).not.toHaveBeenCalled();
    expect(invoiceItemsCreate).not.toHaveBeenCalled();
  });

  it("traduce un fallo de Stripe en subscriptions.create a 502", async () => {
    const { client } = buildHappyPathClient({
      subscriptions: { create: vi.fn().mockRejectedValue({ type: "StripeAPIError" }), retrieve: vi.fn(), update: vi.fn(), cancel: vi.fn() },
    });
    const provider = createStripeSubscriptionProvider(client);

    await expect(
      provider.startSubscription({
        customerRef: "cus_1",
        priceRef: "price_1",
        billingAnchorDay: 1,
        metadata: { accountId: "a", userId: "u", planId: "p" },
        idempotencyKey: "k",
      }),
    ).rejects.toMatchObject({ statusCode: 502 });
  });

  it("traduce un fallo de Stripe en invoices.create a 502", async () => {
    const { client } = buildHappyPathClient({
      invoices: {
        create: vi.fn().mockRejectedValue({ type: "StripeAPIError" }),
        finalizeInvoice: vi.fn(),
        voidInvoice: vi.fn(),
        retrieve: vi.fn(),
        pay: vi.fn(),
      },
    });
    const provider = createStripeSubscriptionProvider(client);

    await expect(
      provider.startSubscription({
        customerRef: "cus_1",
        priceRef: "price_1",
        billingAnchorDay: 1,
        metadata: { accountId: "a", userId: "u", planId: "p" },
        idempotencyKey: "k",
      }),
    ).rejects.toMatchObject({ statusCode: 502 });
  });
});

describe("services/stripe-subscription-provider — getSubscriptionStart (rama replay del alta)", () => {
  it("factura open -> status incomplete, con clientSecret vigente", async () => {
    const invoicesRetrieve = vi.fn().mockResolvedValue(buildFakeFinalizedInvoice());
    const subscriptionsRetrieve = vi.fn().mockResolvedValue(buildFakeStripeSubscription());
    const client = buildFakeClient({
      invoices: { create: vi.fn(), finalizeInvoice: vi.fn(), voidInvoice: vi.fn(), retrieve: invoicesRetrieve, pay: vi.fn() },
      subscriptions: { create: vi.fn(), retrieve: subscriptionsRetrieve, update: vi.fn(), cancel: vi.fn() },
    });
    const provider = createStripeSubscriptionProvider(client);

    const result = await provider.getSubscriptionStart({ subscriptionRef: "sub_1", invoiceRef: "in_manual_1" });

    expect(invoicesRetrieve).toHaveBeenCalledWith("in_manual_1", { expand: ["confirmation_secret"] });
    expect(result.status).toBe("incomplete");
    expect(result.clientSecret).toBe("pi_manual_1_secret");
    expect(result.firstChargeCents).toBe(59900);
    expect(result.currency).toBe("mxn");
    expect(result.nextChargeAt).toBeInstanceOf(Date);
  });

  it("factura paid -> status active, sin clientSecret", async () => {
    const invoicesRetrieve = vi.fn().mockResolvedValue(buildFakeFinalizedInvoice({ status: "paid" }));
    const client = buildFakeClient({
      invoices: { create: vi.fn(), finalizeInvoice: vi.fn(), voidInvoice: vi.fn(), retrieve: invoicesRetrieve, pay: vi.fn() },
      subscriptions: { create: vi.fn(), retrieve: vi.fn().mockResolvedValue(buildFakeStripeSubscription()), update: vi.fn(), cancel: vi.fn() },
    });
    const provider = createStripeSubscriptionProvider(client);

    const result = await provider.getSubscriptionStart({ subscriptionRef: "sub_1", invoiceRef: "in_manual_1" });

    expect(result.status).toBe("active");
    expect(result.clientSecret).toBeUndefined();
  });

  it.each(["void", "uncollectible"])("factura %s -> status canceled, sin clientSecret", async (status) => {
    const invoicesRetrieve = vi.fn().mockResolvedValue(buildFakeFinalizedInvoice({ status }));
    const client = buildFakeClient({
      invoices: { create: vi.fn(), finalizeInvoice: vi.fn(), voidInvoice: vi.fn(), retrieve: invoicesRetrieve, pay: vi.fn() },
      subscriptions: { create: vi.fn(), retrieve: vi.fn().mockResolvedValue(buildFakeStripeSubscription()), update: vi.fn(), cancel: vi.fn() },
    });
    const provider = createStripeSubscriptionProvider(client);

    const result = await provider.getSubscriptionStart({ subscriptionRef: "sub_1", invoiceRef: "in_manual_1" });

    expect(result.status).toBe("canceled");
    expect(result.clientSecret).toBeUndefined();
  });

  it("traduce un fallo de Stripe a 502", async () => {
    const client = buildFakeClient({
      invoices: { create: vi.fn(), finalizeInvoice: vi.fn(), voidInvoice: vi.fn(), retrieve: vi.fn().mockRejectedValue({ type: "StripeAPIError" }), pay: vi.fn() },
    });
    const provider = createStripeSubscriptionProvider(client);

    await expect(
      provider.getSubscriptionStart({ subscriptionRef: "sub_1", invoiceRef: "in_manual_1" }),
    ).rejects.toMatchObject({ statusCode: 502 });
  });
});

describe("services/stripe-subscription-provider — abandonSubscriptionStart (barrendero)", () => {
  it("anula la factura open y cancela la Subscription", async () => {
    const invoicesRetrieve = vi.fn().mockResolvedValue(buildFakeFinalizedInvoice());
    const voidInvoice = vi.fn().mockResolvedValue({});
    const subscriptionsCancel = vi.fn().mockResolvedValue({});
    const client = buildFakeClient({
      invoices: { create: vi.fn(), finalizeInvoice: vi.fn(), voidInvoice, retrieve: invoicesRetrieve, pay: vi.fn() },
      subscriptions: { create: vi.fn(), retrieve: vi.fn(), update: vi.fn(), cancel: subscriptionsCancel },
    });
    const provider = createStripeSubscriptionProvider(client);

    await provider.abandonSubscriptionStart({ subscriptionRef: "sub_1", invoiceRef: "in_manual_1" });

    expect(voidInvoice).toHaveBeenCalledWith("in_manual_1");
    expect(subscriptionsCancel).toHaveBeenCalledWith("sub_1");
  });

  it("si la factura ya no está open (pagada mientras el barrendero corría), no intenta anularla igual cancela la Subscription", async () => {
    const invoicesRetrieve = vi.fn().mockResolvedValue(buildFakeFinalizedInvoice({ status: "paid" }));
    const voidInvoice = vi.fn();
    const subscriptionsCancel = vi.fn().mockResolvedValue({});
    const client = buildFakeClient({
      invoices: { create: vi.fn(), finalizeInvoice: vi.fn(), voidInvoice, retrieve: invoicesRetrieve, pay: vi.fn() },
      subscriptions: { create: vi.fn(), retrieve: vi.fn(), update: vi.fn(), cancel: subscriptionsCancel },
    });
    const provider = createStripeSubscriptionProvider(client);

    await provider.abandonSubscriptionStart({ subscriptionRef: "sub_1", invoiceRef: "in_manual_1" });

    expect(voidInvoice).not.toHaveBeenCalled();
    expect(subscriptionsCancel).toHaveBeenCalledWith("sub_1");
  });

  it("tolera 'ya cancelada' de Stripe al cancelar la Subscription (no relanza)", async () => {
    const client = buildFakeClient({
      invoices: {
        create: vi.fn(),
        finalizeInvoice: vi.fn(),
        voidInvoice: vi.fn().mockResolvedValue({}),
        retrieve: vi.fn().mockResolvedValue(buildFakeFinalizedInvoice()),
        pay: vi.fn(),
      },
      subscriptions: {
        create: vi.fn(),
        retrieve: vi.fn(),
        update: vi.fn(),
        cancel: vi.fn().mockRejectedValue({ type: "StripeInvalidRequestError", code: "resource_missing" }),
      },
    });
    const provider = createStripeSubscriptionProvider(client);

    await expect(
      provider.abandonSubscriptionStart({ subscriptionRef: "sub_1", invoiceRef: "in_manual_1" }),
    ).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 3: Run tests, verificar que fallan (falta la implementación)**

Run: `cd apps/api && npx vitest run tests/services/stripe-subscription-provider.test.ts`
Expected: FAIL — `provider.getSubscriptionStart`/`provider.abandonSubscriptionStart` no existen, y `startSubscription` todavía arma el payload viejo (`add_invoice_items` con `price_data`).

- [ ] **Step 4: Implementar — reemplazar `startSubscription` y agregar los dos métodos nuevos**

Reemplazar el método `startSubscription` completo (y su JSDoc) dentro de `createStripeSubscriptionProvider(...)` por:

```typescript
    /**
     * Mecanismo de FACTURA MANUAL de alta (verificado contra Stripe test,
     * ver docs/superpowers/plans/2026-09-29-subscription-first-invoice-fix.md):
     * `add_invoice_items` no sirve aquí — con `billing_cycle_anchor_config`
     * futuro, Stripe no genera NINGÚN invoice al crear la Subscription, sin
     * importar `proration_behavior`. En cambio:
     *
     * 1. La Subscription se crea con ancla futura + `proration_behavior:"none"`
     *    y SIN `add_invoice_items` — su línea recurrente cobra $0 en el
     *    período parcial, por diseño (no hay nada que prorratear).
     * 2. Se relee el Price recurrente (`prices.retrieve`) para conocer su
     *    `currency`/`unit_amount`/`product` — el monto del primer cobro
     *    NUNCA se inventa, siempre sale de ahí.
     * 3. Se crea un InvoiceItem `price_data` (one-time, ad-hoc) por ese
     *    mismo monto, ligado a la Subscription, con el período real del
     *    ciclo parcial (`period: {start: ahora, end: sub.billing_cycle_anchor}`)
     *    — lo lee el traductor de webhooks (`extractServicePeriod`).
     * 4. Se crea y finaliza una Invoice aparte (`collection_method:
     *    "charge_automatically"`) — SU `confirmation_secret` (no el de
     *    `sub.latest_invoice`, que queda `null`) es el PaymentIntent real que
     *    el front confirma.
     *
     * La Subscription en Stripe queda `status:"active"` desde el día 1, sin
     * tarjeta (confirmado) — por eso el DTO devuelve `status:"incomplete"`
     * FIJO aquí, nunca derivado de `sub.status`: la única fuente de verdad de
     * "¿ya se pagó?" es la factura manual (ver `getSubscriptionStart`).
     *
     * Tres `idempotencyKey` derivadas de la base (sufijos `:sub`/
     * `:invoice-item`/`:invoice`), mismo patrón que `createPlanProduct`: cada
     * paso es reintentable de forma independiente si uno de los tres falla.
     */
    async startSubscription(input: StartProviderSubscriptionInput): Promise<ProviderSubscription> {
      try {
        const recurringPrice = await client.prices.retrieve(input.priceRef);
        if (recurringPrice.unit_amount === null) {
          // Defensivo: nuestros Prices siempre son `unit_amount` fijo (nunca
          // por tramos ni `custom_unit_amount`) — si esto ocurre, es un Price
          // mal creado a mano en Stripe, no un dato que podamos inventar.
          throw new AppError("No pudimos iniciar tu suscripción.", 502);
        }

        const sub = await client.subscriptions.create(
          {
            customer: input.customerRef,
            items: [{ price: input.priceRef }],
            payment_behavior: "default_incomplete",
            payment_settings: {
              payment_method_types: ["card"],
              save_default_payment_method: "on_subscription",
            },
            billing_cycle_anchor_config: {
              day_of_month: input.billingAnchorDay,
              hour: BILLING_ANCHOR_HOUR_UTC,
              ...(input.billingAnchorMonth !== undefined ? { month: input.billingAnchorMonth } : {}),
            },
            proration_behavior: "none",
            metadata: input.metadata,
          },
          { idempotencyKey: `${input.idempotencyKey}:sub` },
        );

        await client.invoiceItems.create(
          {
            customer: input.customerRef,
            subscription: sub.id,
            price_data: {
              currency: recurringPrice.currency,
              product: toId(recurringPrice.product)!,
              unit_amount: recurringPrice.unit_amount,
            },
            period: { start: Math.floor(Date.now() / 1000), end: sub.billing_cycle_anchor },
          },
          { idempotencyKey: `${input.idempotencyKey}:invoice-item` },
        );

        const draftInvoice = await client.invoices.create(
          {
            customer: input.customerRef,
            subscription: sub.id,
            collection_method: "charge_automatically",
            auto_advance: false,
          },
          { idempotencyKey: `${input.idempotencyKey}:invoice` },
        );
        const invoice = await client.invoices.finalizeInvoice(draftInvoice.id!, {
          expand: ["confirmation_secret"],
        });

        const period = readCurrentPeriod(sub);
        return {
          subscriptionRef: sub.id,
          status: "incomplete",
          clientSecret: readInvoiceClientSecret(invoice),
          firstChargeCents: invoice.amount_due,
          currency: invoice.currency,
          nextChargeAt: new Date(sub.billing_cycle_anchor * 1000),
          currentPeriodStart: period.start,
          currentPeriodEnd: period.end,
          collectionPaused: Boolean(sub.pause_collection),
          cancelAtPeriodEnd: sub.cancel_at_period_end,
          priceRef: sub.items.data[0]?.price?.id,
        };
      } catch (error) {
        if (error instanceof AppError) throw error;
        translateStripeError(error);
      }
    },

    /**
     * Rama replay del alta: relee la FACTURA (no la Subscription, que ya
     * quedó `active` desde el día 1 sin importar el pago) y traduce SU
     * estado — `open` -> sigue esperando confirmación, `paid` -> ya se
     * cobró (el webhook debió activar la cuenta), `void`/`uncollectible` ->
     * la clienta o el barrendero la dieron de baja. `draft` no debería
     * ocurrir (`startSubscription` siempre finaliza) pero cae en
     * `incomplete` con un warning, mismo criterio defensivo que
     * `mapProviderSubscriptionStatus`.
     */
    async getSubscriptionStart(input: GetSubscriptionStartInput): Promise<ProviderSubscription> {
      try {
        const invoice = await client.invoices.retrieve(input.invoiceRef, { expand: ["confirmation_secret"] });
        const sub = await client.subscriptions.retrieve(input.subscriptionRef);
        const status = mapInvoiceStartStatus(invoice.status);
        const period = readCurrentPeriod(sub);
        return {
          subscriptionRef: input.subscriptionRef,
          status,
          ...(status === "incomplete"
            ? { clientSecret: readInvoiceClientSecret(invoice), firstChargeCents: invoice.amount_due, currency: invoice.currency }
            : {}),
          nextChargeAt: new Date(sub.billing_cycle_anchor * 1000),
          currentPeriodStart: period.start,
          currentPeriodEnd: period.end,
          collectionPaused: Boolean(sub.pause_collection),
          cancelAtPeriodEnd: sub.cancel_at_period_end,
          priceRef: sub.items.data[0]?.price?.id,
        };
      } catch (error) {
        translateStripeError(error);
      }
    },

    /**
     * Barrendero de altas abandonadas (jobs/expire-incomplete-subscriptions.ts):
     * anula la factura de alta (si sigue `open`; si ya no lo está, alguien más
     * la resolvió — no es un error) y cancela la Subscription. Tolera que la
     * Subscription ya esté cancelada (carrera con otra corrida del barrendero
     * o con Stripe mismo): no relanza en ese caso, cualquier otro fallo sí.
     */
    async abandonSubscriptionStart(input: AbandonSubscriptionStartInput): Promise<void> {
      try {
        const invoice = await client.invoices.retrieve(input.invoiceRef);
        if (invoice.status === "open") {
          await client.invoices.voidInvoice(input.invoiceRef);
        }
      } catch (error) {
        translateStripeError(error);
      }
      try {
        await client.subscriptions.cancel(input.subscriptionRef);
      } catch (error) {
        const shape = readErrorShape(error);
        if (shape.type === "StripeInvalidRequestError") return;
        translateStripeError(error);
      }
    },
```

Agregar estos dos helpers privados cerca de `readClientSecret`/`readFirstCharge` (mismo lugar, arriba de `createStripeSubscriptionProvider`):

```typescript
/** `confirmation_secret` de una FACTURA (no de una Subscription) — misma
 * forma anidada, pero de `Stripe.Invoice` en vez de `sub.latest_invoice`. */
function readInvoiceClientSecret(invoice: Stripe.Invoice): string | undefined {
  return invoice.confirmation_secret?.client_secret ?? undefined;
}

/** Traduce el `status` de la factura MANUAL de alta a nuestro vocabulario —
 * solo válido para `getSubscriptionStart`, nunca para el estado general de
 * una suscripción (eso lo sigue traduciendo `mapProviderSubscriptionStatus`
 * sobre `sub.status`). */
function mapInvoiceStartStatus(status: Stripe.Invoice.Status | null): ProviderSubscriptionStatus {
  switch (status) {
    case "open":
      return "incomplete";
    case "paid":
      return "active";
    case "void":
    case "uncollectible":
      return "canceled";
    default:
      logger.warn({ status }, "Estado de factura de alta no reconocido, se trata como incomplete");
      return "incomplete";
  }
}
```

Y en el bloque `import type { ... } from "./subscription-provider.js"` al inicio del archivo, agregar `GetSubscriptionStartInput` y `AbandonSubscriptionStartInput` a la lista de tipos importados.

- [ ] **Step 5: Run tests, verificar que pasan**

Run: `cd apps/api && npx vitest run tests/services/stripe-subscription-provider.test.ts`
Expected: PASS (todos los tests nuevos y los que no tocan `startSubscription`/`getSubscriptionStart`/`abandonSubscriptionStart`, como `createPlanProduct`/`ensureCustomer`/`changePrice`, siguen en verde sin cambios).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/services/stripe-subscription-provider.ts apps/api/tests/services/stripe-subscription-provider.test.ts
git commit -m "fix(subscriptions): reemplaza add_invoice_items por una factura manual de alta"
```

---

### Task 3: `fake-subscription-provider.ts` — fakes de los dos métodos nuevos

**Files:**
- Modify: `apps/api/tests/helpers/fake-subscription-provider.ts`

- [ ] **Step 1: Agregar los dos métodos al fake**

Dentro del objeto que devuelve `buildFakeSubscriptionProvider`, justo debajo de `getSubscription`:

```typescript
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
```

- [ ] **Step 2: Verificar que compila**

Run: `cd apps/api && npx tsc -p tsconfig.json --noEmit`
Expected: PASS (la interfaz `SubscriptionProvider` ya queda completamente implementada por el fake y por `createStripeSubscriptionProvider`).

- [ ] **Step 3: Commit**

```bash
git add apps/api/tests/helpers/fake-subscription-provider.ts
git commit -m "test(subscriptions): agrega getSubscriptionStart/abandonSubscriptionStart al fake provider"
```

---

### Task 4: `subscription-start.service.ts` — persistir `latestInvoiceId` y usar `getSubscriptionStart` en el replay

**Files:**
- Modify: `apps/api/src/services/subscription-start.service.ts`
- Modify: `apps/api/tests/services/subscription-start.service.test.ts`

- [ ] **Step 1: Actualizar los tests existentes de la rama replay ANTES de tocar el service**

En `apps/api/tests/services/subscription-start.service.test.ts`, el test de la línea ~129 (`"segunda llamada mientras sigue INCOMPLETE con ref -> ..."`) — cambiar las dos aserciones de `fake.getSubscription` por `fake.getSubscriptionStart`:

```typescript
    expect(second.clientSecret).toBe(first.clientSecret);
    expect(fake.startSubscription).toHaveBeenCalledTimes(1);
    expect(fake.getSubscriptionStart).toHaveBeenCalledTimes(1);
```

El test de la línea ~301-318 (replay con otro plan): cambiar `expect(fake.getSubscription).not.toHaveBeenCalled();` por `expect(fake.getSubscriptionStart).not.toHaveBeenCalled();`.

El test de la línea ~323 (`"replay de una suscripción que Stripe ya canceló"`) — leer el bloque completo primero (`sed -n '320,360p' apps/api/tests/services/subscription-start.service.test.ts`) y cambiar el override `getSubscription: vi.fn().mockResolvedValue({...})` por `getSubscriptionStart: vi.fn().mockResolvedValue({...status: "canceled"...})`, manteniendo el resto del test igual (sigue esperando 409).

- [ ] **Step 2: Run tests, verificar que fallan (el service todavía llama a `getSubscription`)**

Run: `cd apps/api && npx vitest run tests/services/subscription-start.service.test.ts`
Expected: FAIL en los tests de la rama replay (`fake.getSubscriptionStart` nunca se llamó, `fake.getSubscription` sí).

- [ ] **Step 3: Implementar — `persistProviderRefs` guarda `latestInvoiceId`, el replay usa `getSubscriptionStart`**

En `persistProviderRefs`, agregar `latestInvoiceId` al `$set`. Como `ProviderSubscription` no trae ese campo (el vocabulario "invoice" es de Stripe, no cruza la interfaz agnóstica), se toma del `subscriptionRef`... **no** — en realidad hace falta que `startSubscription` (el método del provider) SÍ exponga el ref de la factura manual de alguna forma agnóstica. Revisar: la forma más simple sin ensuciar `ProviderSubscription` con vocabulario de Stripe es reutilizar el campo ya neutral que existe — no hay uno. Agregar un campo opcional a `ProviderSubscription` (Task 1, revisar antes de este paso) llamado `latestInvoiceRef?: string` — **volver a `subscription-provider.ts` (Task 1) y agregarlo**:

```typescript
interface ProviderSubscription {
  subscriptionRef: string;
  status: ProviderSubscriptionStatus;
  clientSecret?: string;
  firstChargeCents?: number;
  currency?: string;
  nextChargeAt?: Date;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  collectionPaused: boolean;
  cancelAtPeriodEnd: boolean;
  priceRef?: string;
  /** Ref de la factura de alta (mecanismo de factura manual, ver
   * stripe-subscription-provider.ts) — SOLO poblado por `startSubscription`,
   * para que `subscription-start.service.ts` lo persista en
   * `SubscriptionAccount.latestInvoiceId` y lo reuse en la rama replay
   * (`getSubscriptionStart`). Vocabulario agnóstico a propósito ("ref de
   * cobro", no "invoice"), mismo criterio que `subscriptionRef`/`priceRef`. */
  latestChargeRef?: string;
}
```

Y en `stripe-subscription-provider.ts` (Task 2), en el `return` de `startSubscription`, agregar `latestChargeRef: invoice.id` (con `invoice.id!` si TypeScript lo pide — el SDK lo tipa opcional pero siempre viene poblado en una factura recién finalizada). Actualizar también el test de la Tarea 2 que verifica el DTO completo (Step 2 de la Tarea 2) para incluir `expect(result.latestChargeRef).toBe("in_manual_1");`, y en `fake-subscription-provider.ts` (Task 3) agregar `latestChargeRef: `in_fake_${counter}`` al objeto que arma `startSubscription`.

Ahora en `subscription-start.service.ts`:

```typescript
async function persistProviderRefs(
  account: SubscriptionAccountDocument,
  customerRef: string,
  subscription: ProviderSubscription,
): Promise<void> {
  const updated = await SubscriptionAccount.findOneAndUpdate(
    { _id: account._id, status: SubscriptionStatus.INCOMPLETE },
    {
      $set: {
        providerCustomerId: customerRef,
        providerSubscriptionId: subscription.subscriptionRef,
        ...(subscription.latestChargeRef ? { latestInvoiceId: subscription.latestChargeRef } : {}),
        ...(subscription.currentPeriodStart ? { currentPeriodStart: subscription.currentPeriodStart } : {}),
        ...(subscription.currentPeriodEnd ? { currentPeriodEnd: subscription.currentPeriodEnd } : {}),
      },
    },
    { new: true },
  );
  if (updated) return;

  const refreshed = await SubscriptionAccount.findById(account._id);
  const hasBothRefs =
    refreshed?.providerSubscriptionId === subscription.subscriptionRef &&
    refreshed?.providerCustomerId === customerRef;
  if (hasBothRefs) return;
  throw new AppError("No se pudo confirmar la suscripción, contacta a soporte.", 500);
}
```

Y la rama replay (dentro de `startSubscriptionForUser`, donde hoy dice `const subscription = await provider.getSubscription(existingAccount.providerSubscriptionId); assertConfirmable(subscription);`):

```typescript
    // `getSubscriptionStart` (no `getSubscription`): con el mecanismo de
    // factura manual, `sub.status` en Stripe queda `active` desde el día 1
    // sin importar el pago — la única fuente de verdad de "¿sigue esperando
    // confirmación?" es la factura de alta.
    if (!existingAccount.latestInvoiceId) {
      // Defensivo: `persistProviderRefs` siempre escribe ambos refs juntos —
      // no debería existir una cuenta con `providerSubscriptionId` sin
      // `latestInvoiceId`. Un 502 aquí es más honesto que asumir un estado.
      throw new AppError("No se pudo confirmar la suscripción, contacta a soporte.", 502);
    }
    const subscription = await provider.getSubscriptionStart({
      subscriptionRef: existingAccount.providerSubscriptionId,
      invoiceRef: existingAccount.latestInvoiceId,
    });
    assertConfirmable(subscription);
    return buildResult(subscription);
```

- [ ] **Step 4: Run tests, verificar que pasan**

Run: `cd apps/api && npx vitest run tests/services/subscription-start.service.test.ts`
Expected: PASS.

- [ ] **Step 5: Actualizar el comentario del campo `latestInvoiceId` en el modelo (ya no está reservado)**

`apps/api/src/models/subscription-account.model.ts` — reemplazar el comentario de `latestInvoiceId?: string;`:

```typescript
  /** Ref de la factura de alta (mecanismo de factura manual, Milestone
   * "fix cobro real del alta") — la usa la rama replay del endpoint de alta
   * (`getSubscriptionStart`) y el barrendero de altas abandonadas
   * (`jobs/expire-incomplete-subscriptions.ts`) para saber si la clienta ya
   * pagó, sin depender de `sub.status` (que Stripe deja `active` desde el
   * día 1 en este mecanismo). Se llena SIEMPRE junto con
   * `providerSubscriptionId`, nunca por separado. */
  latestInvoiceId?: string;
```

- [ ] **Step 6: Correr toda la suite de suscripciones para descartar regresiones**

Run: `cd apps/api && npx vitest run tests/services tests/routes tests/jobs -t "subscri"`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/services/subscription-provider.ts apps/api/src/services/subscription-start.service.ts apps/api/src/services/stripe-subscription-provider.ts apps/api/src/models/subscription-account.model.ts apps/api/tests/services/subscription-start.service.test.ts apps/api/tests/services/stripe-subscription-provider.test.ts apps/api/tests/helpers/fake-subscription-provider.ts
git commit -m "fix(subscriptions): persiste latestInvoiceId y usa getSubscriptionStart en el replay del alta"
```

---

### Task 5: Traductor de webhooks — aceptar la factura manual

**Files:**
- Modify: `apps/api/src/services/stripe-subscription-webhook-translator.ts`
- Modify: `apps/api/tests/services/stripe-subscription-webhook-translator.test.ts`

- [ ] **Step 1: Actualizar el test existente que hoy asume "manual" -> "other"**

Leer primero `apps/api/tests/services/stripe-subscription-webhook-translator.test.ts` líneas 80-100 completas. El test `"invoice.paid con billing_reason distinto de create/cycle -> billingReason 'other'"` usa `billingReason: "manual"` como su ejemplo de "otro" — eso ya no es cierto (este plan lo mapea a `subscription_create`). Cambiar su fixture a un `billing_reason` que SÍ siga siendo ajeno al dominio, p. ej. `"quote_accept"`:

```typescript
  it("invoice.paid con billing_reason distinto de create/cycle/manual -> billingReason 'other'", () => {
    const payload = buildStripeInvoiceEvent("invoice.paid", "in_2", { billingReason: "quote_accept" });
    const event = JSON.parse(payload);
    const result = translateInvoicePaidEvent("stripe", event.id, event.data.object);
    expect(result).toMatchObject({ kind: "subscription.invoice_paid", billingReason: "other" });
  });
```

- [ ] **Step 2: Agregar los dos tests nuevos (billing_reason "manual", y período desde una línea invoice_item_details)**

Justo debajo del test anterior:

```typescript
  it("invoice.paid con billing_reason 'manual' (factura manual de alta) se traduce como subscription_create", () => {
    const payload = buildStripeInvoiceEvent("invoice.paid", "in_manual_1", {
      billingReason: "manual",
      lines: [{ start: 1_700_000_000, end: 1_702_592_000, parentType: "invoice_item_details" }],
    });
    const event = JSON.parse(payload);
    const result = translateInvoicePaidEvent("stripe", event.id, event.data.object);
    expect(result).toMatchObject({ kind: "subscription.invoice_paid", billingReason: "subscription_create" });
  });

  it("invoice.paid con SOLO una línea invoice_item_details (factura manual, sin línea de suscripción) igual resuelve el período", () => {
    const payload = buildStripeInvoiceEvent("invoice.paid", "in_manual_2", {
      billingReason: "manual",
      lines: [{ start: 1_700_000_000, end: 1_702_592_000, parentType: "invoice_item_details" }],
    });
    const event = JSON.parse(payload);
    const result = translateInvoicePaidEvent("stripe", event.id, event.data.object);
    expect(result).toMatchObject({
      servicePeriodStart: new Date(1_700_000_000 * 1000),
      servicePeriodEnd: new Date(1_702_592_000 * 1000),
    });
  });
```

(El test ya existente en la línea ~68, `"invoice.paid con dos líneas... usa el período de subscription_item_details, no el de índice 0"`, NO se toca — sigue siendo la prueba de que `subscription_item_details` gana cuando ambas líneas coexisten.)

- [ ] **Step 3: Run tests, verificar que fallan**

Run: `cd apps/api && npx vitest run tests/services/stripe-subscription-webhook-translator.test.ts`
Expected: FAIL en los dos tests nuevos (`mapBillingReason`/`extractServicePeriod` todavía no reconocen "manual"/`invoice_item_details` solo).

- [ ] **Step 4: Implementar**

En `apps/api/src/services/stripe-subscription-webhook-translator.ts`, reemplazar `mapBillingReason`:

```typescript
function mapBillingReason(reason: string | null): "subscription_create" | "subscription_cycle" | "other" {
  if (reason === "subscription_create") return "subscription_create";
  if (reason === "subscription_cycle") return "subscription_cycle";
  // "manual": la factura de alta (mecanismo de factura manual, ver
  // stripe-subscription-provider.ts) — semánticamente ES el cobro de alta,
  // aunque Stripe la etiqueta distinto de subscription_create porque no la
  // generó su propio motor de facturación de Subscriptions.
  if (reason === "manual") return "subscription_create";
  return "other";
}
```

Y reemplazar `extractServicePeriod`:

```typescript
/** La línea de SUSCRIPCIÓN (`subscription_item_details`) es la fuente
 * preferida del período de servicio — ver docstring previo. Si no hay
 * ninguna (factura MANUAL de alta, mecanismo de factura manual: su única
 * línea es `invoice_item_details`, con el período que `startSubscription`
 * fijó a mano), se usa esa como fallback. En el diseño actual nunca
 * coexisten ambos tipos en la misma factura, así que no hay ambigüedad real
 * que resolver entre "cuál invoice_item_details" — a lo sumo hay una. */
function extractServicePeriod(invoice: Stripe.Invoice): { start: Date; end: Date } | undefined {
  const lines = invoice.lines?.data ?? [];
  const subscriptionLine = lines.find((line) => line.parent?.type === "subscription_item_details");
  const fallbackLine = lines.find((line) => line.parent?.type === "invoice_item_details");
  const period = subscriptionLine?.period ?? fallbackLine?.period;
  if (!period) return undefined;
  return { start: new Date(period.start * 1000), end: new Date(period.end * 1000) };
}
```

- [ ] **Step 5: Run tests, verificar que pasan**

Run: `cd apps/api && npx vitest run tests/services/stripe-subscription-webhook-translator.test.ts`
Expected: PASS.

- [ ] **Step 6: Correr también los tests de los handlers de webhook (consumen este traductor indirectamente vía fixtures)**

Run: `cd apps/api && npx vitest run tests/services/subscription-webhook-handlers.test.ts`
Expected: PASS (sin cambios de código en handlers — solo para confirmar que nada dependía del mapeo viejo de "manual").

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/services/stripe-subscription-webhook-translator.ts apps/api/tests/services/stripe-subscription-webhook-translator.test.ts
git commit -m "fix(subscriptions): el traductor de webhooks reconoce la factura manual de alta"
```

---

### Task 6: Barrendero de altas abandonadas — nueva pasada en `expire-incomplete-subscriptions.ts`

**Files:**
- Modify: `apps/api/src/jobs/expire-incomplete-subscriptions.ts`
- Modify: `apps/api/tests/jobs/expire-incomplete-subscriptions.test.ts`

- [ ] **Step 1: Leer el test existente completo primero**

`cd apps/api && cat tests/jobs/expire-incomplete-subscriptions.test.ts` — entender el patrón de setup (cómo siembra cuentas, qué provider fake usa si alguno) antes de escribir los tests nuevos, para seguir exactamente el mismo estilo.

- [ ] **Step 2: Escribir los tests nuevos ANTES de tocar el job**

Agregar un nuevo `describe` al final del archivo de test (usar `buildFakeSubscriptionProvider`/`__setSubscriptionProviderForTests` como hacen los tests de servicios de suscripción — importarlos igual que `subscription-start.service.test.ts`):

```typescript
describe("jobs/expire-incomplete-subscriptions — altas abandonadas (factura manual sin pagar)", () => {
  it("cancela en Stripe y transiciona a CANCELED una cuenta INCOMPLETE con providerSubscriptionId+latestInvoiceId vencida", async () => {
    const fake = buildFakeSubscriptionProvider();
    __setSubscriptionProviderForTests(fake);

    await openEnrollmentSafely(); // o el helper equivalente ya usado en este archivo/los fixtures del proyecto
    const plan = await seedPlanWithStripeRefs({ maxActiveSeats: 5 });
    const userId = await seedUser();
    const { clientSecret: _clientSecret } = await startSubscriptionForUser({ userId, planId: plan._id.toString() });

    const account = await SubscriptionAccount.findOne({ userId });
    // Retrocede seatHeldAt más allá del threshold, como ya hace el resto de
    // este archivo para el caso "sin providerSubscriptionId".
    await SubscriptionAccount.updateOne({ _id: account!._id }, { $set: { seatHeldAt: new Date(Date.now() - 60 * 60_000) } });

    const summary = await expireIncompleteSubscriptions(new Date(), 30);

    expect(summary.expired).toBeGreaterThanOrEqual(1);
    expect(fake.abandonSubscriptionStart).toHaveBeenCalledWith({
      subscriptionRef: account!.providerSubscriptionId,
      invoiceRef: account!.latestInvoiceId,
    });
    const reloaded = await SubscriptionAccount.findById(account!._id);
    expect(reloaded?.status).toBe(SubscriptionStatus.CANCELED);
    const refreshedPlan = await SubscriptionPlan.findById(plan._id);
    expect(refreshedPlan?.seatsTaken).toBe(0);
  });

  it("no toca una cuenta INCOMPLETE con providerSubscriptionId reciente (dentro del threshold)", async () => {
    const fake = buildFakeSubscriptionProvider();
    __setSubscriptionProviderForTests(fake);

    await openEnrollmentSafely();
    const plan = await seedPlanWithStripeRefs({ maxActiveSeats: 5 });
    const userId = await seedUser();
    await startSubscriptionForUser({ userId, planId: plan._id.toString() });

    const summary = await expireIncompleteSubscriptions(new Date(), 30);

    expect(fake.abandonSubscriptionStart).not.toHaveBeenCalled();
    const account = await SubscriptionAccount.findOne({ userId });
    expect(account?.status).toBe(SubscriptionStatus.INCOMPLETE);
  });

  it("sin proveedor de Stripe configurado, no falla el barrendero (solo se salta esta pasada)", async () => {
    __setSubscriptionProviderForTests(undefined);

    await openEnrollmentSafely();
    const plan = await seedPlanWithStripeRefs({ maxActiveSeats: 5 });
    const userId = await seedUser();
    // Cuenta sembrada a mano (sin pasar por Stripe) para simular el caso.
    const account = await SubscriptionAccount.create({
      userId,
      planId: plan._id,
      status: SubscriptionStatus.INCOMPLETE,
      cancelAtPeriodEnd: false,
      statusHistory: [],
      dunningAttempts: 0,
      seatHeldAt: new Date(Date.now() - 60 * 60_000),
      providerSubscriptionId: "sub_manual_seed",
      latestInvoiceId: "in_manual_seed",
    });

    await expect(expireIncompleteSubscriptions(new Date(), 30)).resolves.toBeDefined();
    const reloaded = await SubscriptionAccount.findById(account._id);
    expect(reloaded?.status).toBe(SubscriptionStatus.INCOMPLETE); // no se tocó
  });
});
```

(Revisar los imports que ya usa `subscription-start.service.test.ts` — `openEnrollment`/`updateSubscriptionSettings` o el helper local `openEnrollmentSafely` de ESE archivo no existen en `expire-incomplete-subscriptions.test.ts` todavía: agregarlos, importando desde los mismos módulos, o copiar el patrón exacto que ya use ese archivo de test para abrir inscripciones — **leer el archivo real en el Step 1 antes de escribir esto** y ajustar los imports/helpers al patrón que encuentres ahí, no asumir a ciegas los nombres de este plan.)

- [ ] **Step 3: Run tests, verificar que fallan**

Run: `cd apps/api && npx vitest run tests/jobs/expire-incomplete-subscriptions.test.ts`
Expected: FAIL — el job todavía no tiene la segunda pasada.

- [ ] **Step 4: Implementar la segunda pasada en el job**

Reemplazar el archivo completo `apps/api/src/jobs/expire-incomplete-subscriptions.ts`:

```typescript
import { SubscriptionAction, SubscriptionStatus } from "@esencia-glow/shared";
import { SubscriptionAccount } from "../models/subscription-account.model.js";
import { applyStatusTransition } from "../services/subscription-seat.service.js";
import { recordAudit } from "../services/audit.service.js";
import { resolveSubscriptionProvider } from "../services/subscription-provider.js";
import { AppError } from "../utils/app-error.js";
import { logger } from "../config/logger.js";

const DEFAULT_BATCH_SIZE = 100;

interface ExpireIncompleteSubscriptionsSummary {
  scanned: number;
  expired: number;
  failed: number;
}

/**
 * Barrendero de cuentas `INCOMPLETE` sin `providerSubscriptionId` (Fase 5 de
 * 1.7.2a, §E del plan) — red de seguridad para el caso "el proceso murió
 * entre reclamar el cupo y compensar" que `subscription-start.service.ts`
 * deja documentado y aceptado: si `compensateFailedStart` mismo falla (o el
 * proceso muere antes de llegar al `catch`), la cuenta se queda `INCOMPLETE`
 * para siempre sin este barrendero.
 *
 * `providerSubscriptionId: {$exists: false}` es la guarda crítica del filtro
 * (mismo criterio documentado en §E): una cuenta esperando el 3DS de la
 * clienta YA tiene `providerSubscriptionId` (lo persiste el endpoint de alta
 * antes de devolver el `clientSecret`), así que este barrendero jamás la
 * toca — solo libera cuentas donde Stripe nunca llegó a confirmar nada.
 */
async function expireOrphanedAccounts(threshold: Date, batchSize: number): Promise<ExpireIncompleteSubscriptionsSummary> {
  const stale = await SubscriptionAccount.find({
    status: SubscriptionStatus.INCOMPLETE,
    providerSubscriptionId: { $exists: false },
    seatHeldAt: { $lt: threshold },
  })
    .select("_id")
    .limit(batchSize)
    .lean();

  let expired = 0;
  let failed = 0;

  for (const { _id } of stale) {
    try {
      const account = await SubscriptionAccount.findById(_id);
      if (!account) continue;
      if (account.status !== SubscriptionStatus.INCOMPLETE || account.providerSubscriptionId) continue;

      await applyStatusTransition(account, SubscriptionStatus.CANCELED, "system");
      await recordAudit({ action: SubscriptionAction.SUBSCRIPTION_INCOMPLETE_EXPIRED, targetId: _id });
      expired += 1;
    } catch (error) {
      if (error instanceof AppError && error.statusCode === 409) {
        try {
          const reloaded = await SubscriptionAccount.findById(_id);
          const stillMatches =
            reloaded?.status === SubscriptionStatus.INCOMPLETE && !reloaded.providerSubscriptionId;
          if (!stillMatches) continue;
        } catch (reloadError) {
          failed += 1;
          logger.error(
            { err: reloadError, accountId: _id.toString() },
            "Fallo al releer una cuenta tras un 409 al expirar suscripciones incompletas",
          );
          continue;
        }
      }
      failed += 1;
      logger.error({ err: error, accountId: _id.toString() }, "Fallo al expirar una suscripción incompleta");
    }
  }

  return { scanned: stale.length, expired, failed };
}

/**
 * Segunda pasada (mecanismo de factura manual de alta): cuentas `INCOMPLETE`
 * que YA tienen `providerSubscriptionId`/`latestInvoiceId` — la clienta
 * reclamó el cupo y Stripe generó su factura de alta, pero nunca confirmó la
 * tarjeta. Antes de este mecanismo, Stripe expiraba sola la Subscription
 * `incomplete` en ~23h y el webhook `customer.subscription.deleted` cerraba
 * la cuenta local; con la factura manual, la Subscription queda `active`
 * desde el día 1 y ESE auto-expiro de Stripe nunca ocurre — sin esta pasada,
 * una clienta que abandona el checkout dejaría una Subscription viva en
 * Stripe para siempre, sin cobrar nada.
 *
 * Sin proveedor configurado (dev sin credenciales de Stripe), esta pasada se
 * salta entera — no hay nada que cancelar en un Stripe que no existe, y
 * lanzar aquí tumbaría el resto del tick de cron.
 */
async function expireAbandonedInvoices(threshold: Date, batchSize: number): Promise<ExpireIncompleteSubscriptionsSummary> {
  const provider = resolveSubscriptionProvider();
  if (!provider) return { scanned: 0, expired: 0, failed: 0 };

  const stale = await SubscriptionAccount.find({
    status: SubscriptionStatus.INCOMPLETE,
    providerSubscriptionId: { $exists: true },
    latestInvoiceId: { $exists: true },
    seatHeldAt: { $lt: threshold },
  })
    .select("_id")
    .limit(batchSize)
    .lean();

  let expired = 0;
  let failed = 0;

  for (const { _id } of stale) {
    try {
      const account = await SubscriptionAccount.findById(_id);
      if (!account) continue;
      if (
        account.status !== SubscriptionStatus.INCOMPLETE ||
        !account.providerSubscriptionId ||
        !account.latestInvoiceId
      ) {
        continue;
      }

      await provider.abandonSubscriptionStart({
        subscriptionRef: account.providerSubscriptionId,
        invoiceRef: account.latestInvoiceId,
      });
      await applyStatusTransition(account, SubscriptionStatus.CANCELED, "system");
      await recordAudit({ action: SubscriptionAction.SUBSCRIPTION_INCOMPLETE_EXPIRED, targetId: _id });
      expired += 1;
    } catch (error) {
      if (error instanceof AppError && error.statusCode === 409) {
        try {
          const reloaded = await SubscriptionAccount.findById(_id);
          const stillMatches = reloaded?.status === SubscriptionStatus.INCOMPLETE && Boolean(reloaded.providerSubscriptionId);
          if (!stillMatches) continue;
        } catch (reloadError) {
          failed += 1;
          logger.error(
            { err: reloadError, accountId: _id.toString() },
            "Fallo al releer una cuenta tras un 409 al expirar una factura de alta abandonada",
          );
          continue;
        }
      }
      failed += 1;
      logger.error({ err: error, accountId: _id.toString() }, "Fallo al expirar una factura de alta abandonada");
    }
  }

  return { scanned: stale.length, expired, failed };
}

async function expireIncompleteSubscriptions(
  now: Date = new Date(),
  thresholdMinutes: number,
  batchSize: number = DEFAULT_BATCH_SIZE,
): Promise<ExpireIncompleteSubscriptionsSummary> {
  const threshold = new Date(now.getTime() - thresholdMinutes * 60_000);
  const orphaned = await expireOrphanedAccounts(threshold, batchSize);
  const abandoned = await expireAbandonedInvoices(threshold, batchSize);
  return {
    scanned: orphaned.scanned + abandoned.scanned,
    expired: orphaned.expired + abandoned.expired,
    failed: orphaned.failed + abandoned.failed,
  };
}

export { expireIncompleteSubscriptions };
export type { ExpireIncompleteSubscriptionsSummary };
```

- [ ] **Step 5: Run tests, verificar que pasan**

Run: `cd apps/api && npx vitest run tests/jobs/expire-incomplete-subscriptions.test.ts`
Expected: PASS. Confirmar también que los tests YA EXISTENTES en ese archivo (la pasada vieja, sin tocar) siguen en verde — no deberían haberse movido de sitio ni de comportamiento.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/jobs/expire-incomplete-subscriptions.ts apps/api/tests/jobs/expire-incomplete-subscriptions.test.ts
git commit -m "feat(subscriptions): el barrendero cancela altas abandonadas con factura manual sin pagar"
```

---

### Task 7: Verificación completa de la suite + code review + verificación manual contra Stripe

**Files:** ninguno nuevo — solo comandos.

- [ ] **Step 1: Suite completa del backend**

Run: `cd apps/api && npx vitest run`
Expected: PASS, 0 fallos. Prestar atención especial a `tests/jobs/reconcile-pending-plan-changes.test.ts` y `tests/services/subscription-self-service.service.test.ts` (usan `provider.getSubscription`, NO tocado por este plan, pero conviene confirmar que siguen en verde sin cambios).

- [ ] **Step 2: Typecheck y lint**

Run: `cd apps/api && npx tsc -p tsconfig.json --noEmit && npx eslint src tests`
Expected: PASS.

- [ ] **Step 3: `requesting-code-review`**

Invocar el skill `requesting-code-review` sobre el diff completo de la rama (todas las Tareas 1-6) antes de dar por cerrado el fix — toca lógica de pagos/dinero, carril crítico.

- [ ] **Step 4: Verificación manual end-to-end contra Stripe test**

Script descartable (scratchpad, NO se commitea) que:
1. Construye el provider real (`createStripeSubscriptionProvider` + `getStripeClient()`, con `.env.development.local` cargado igual que en la verificación previa de este mismo plan).
2. Llama `startSubscription(...)` con un Customer/Price de prueba reales — confirma `status:"incomplete"`, `clientSecret` presente, `firstChargeCents` == el precio del Price, sin `invalid_request_error`.
3. Adjunta un método de pago de prueba (`pm_card_visa`, el token estándar de Stripe test) al PaymentIntent detrás de ese `clientSecret` y lo confirma (`client.paymentIntents.confirm(id, {payment_method: "pm_card_visa"})` — extraer el PaymentIntent id del `clientSecret` con `clientSecret.split("_secret_")[0]`).
4. Confirma que la factura pasó a `paid` (`client.invoices.retrieve(invoiceRef)`).
5. Llama `getSubscriptionStart({subscriptionRef, invoiceRef})` — confirma que ahora devuelve `status:"active"`.
6. Alimenta el JSON real de esa factura pagada (obtenido con `expand:["lines"]`) directo a `translateInvoicePaidEvent` (import directo del traductor, sin pasar por HTTP/firma de webhook) — confirma que produce un evento `billingReason:"subscription_create"` con `servicePeriodStart/End` poblados, NO `{kind:"ignored"}`.
7. Limpieza: cancela la Subscription y anula/dejar la factura como quede (ya pagada, no se puede anular — está bien, es una factura de prueba en modo test).

Reportar el resultado (con evidencia real de cada paso, no solo "pasó") antes de considerar el fix terminado.

- [ ] **Step 5: `verification-before-completion`**

Correr el checklist de ese skill antes de anunciar el trabajo como terminado: build, tests, typecheck, lint, y el resultado real (no asumido) del Step 4.

- [ ] **Step 6: Mostrar el diff completo y pedir aprobación para commitear/pushear**

`git status`/`git diff` sobre TODO lo acumulado en la rama `fix-subscription-first-invoice` — el usuario decide si commitea/pushea/abre PR (regla no-negociable: nunca `git add`/`commit`/`push` sin su autorización explícita).

---

## Self-review de este plan

- **Cobertura del spec:** las 4 piezas señaladas en el brainstorming (persistencia de `latestInvoiceId`, rama replay, traductor de webhooks, barrendero) están cada una en su propia tarea (4, 4, 5, 6), más el mecanismo base (Tarea 2) y la interfaz (Tarea 1). Nada quedó fuera.
- **Consistencia de tipos:** `latestChargeRef` (agnóstico) en `ProviderSubscription` ⟶ `invoice.id` en `stripe-subscription-provider.ts` ⟶ `SubscriptionAccount.latestInvoiceId` en `persistProviderRefs` — mismo nombre de campo del modelo en las Tareas 4 y 6. `GetSubscriptionStartInput`/`AbandonSubscriptionStartInput` se definen una vez (Tarea 1) y se usan igual en las Tareas 2, 3, 4, 6.
- **Nada de features no pedidas:** no se toca `changePrice`/pausa/cancelación/self-service — esos siguen usando `sub.status` real, que sigue siendo válido para una cuenta YA activa (el problema del mecanismo de factura manual es específico del momento de la creación).
