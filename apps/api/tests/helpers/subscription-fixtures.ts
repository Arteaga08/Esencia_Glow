import { randomUUID } from "node:crypto";
import { Types } from "mongoose";
import { ProductChannel, ProductStatus, SubscriptionStatus } from "@esencia-glow/shared";
import { Category } from "../../src/models/category.model.js";
import { Product } from "../../src/models/product.model.js";
import { Inventory } from "../../src/models/inventory.model.js";
import { SubscriptionAccount, type SubscriptionAccountDocument } from "../../src/models/subscription-account.model.js";
import type { SubscriptionEditionDocument } from "../../src/models/subscription-edition.model.js";
import type { SubscriptionPlanDocument } from "../../src/models/subscription-plan.model.js";
import { createPlan, type CreateSubscriptionPlanInput } from "../../src/services/subscription-plan.service.js";
import {
  createEdition,
  updateEdition,
  type EditionItemInput,
} from "../../src/services/subscription-edition.service.js";
import { publishEdition } from "../../src/services/subscription-edition-publish.service.js";
import { applyStatusTransition, startSubscription } from "../../src/services/subscription-seat.service.js";
import type { SubscriptionWebhookEvent } from "../../src/services/subscription-provider.js";

/**
 * Fixtures del webhook de Billing (Fase 3 de 1.7.2a). Reusa servicios REALES
 * (`createPlan`, `startSubscription`, `applyStatusTransition`, `publishEdition`)
 * en vez de `Model.create` a mano para el estado que esos services son
 * dueños de mantener coherente (`seatsTaken`, `statusHistory`,
 * `publishedAt`) — mismo criterio que `checkout-fixtures.ts` con
 * `createShippingQuote`.
 */

let seedCounter = 0;

async function seedPlanWithStripeRefs(
  overrides: Partial<CreateSubscriptionPlanInput> = {},
): Promise<SubscriptionPlanDocument> {
  seedCounter += 1;
  const suffix = seedCounter;
  return createPlan({
    name: `Plan Sub ${suffix}`,
    description: "Plan de prueba para el webhook de Billing",
    priceCents: 59900,
    maxActiveSeats: 10,
    ...overrides,
  });
}

interface SeedSubscriptionVariantOpts {
  onHand?: number;
}

async function seedSubscriptionVariantWithStock(opts: SeedSubscriptionVariantOpts = {}) {
  seedCounter += 1;
  const suffix = seedCounter;
  const category = await Category.create({ name: `Cat Sub${suffix}`, slug: `cat-sub${suffix}` });
  const product = await Product.create({
    name: `Producto Sub${suffix}`,
    slug: `producto-sub${suffix}`,
    description: "Descripción de prueba",
    categoryId: category._id,
    status: ProductStatus.ACTIVE,
    channel: ProductChannel.SUBSCRIPTION,
    variants: [
      {
        sku: `SKU-SUB${suffix}`,
        name: "Variante",
        price: 50000,
        weightGrams: 200,
        dimensionsCm: { length: 10, width: 10, height: 10 },
        isActive: true,
      },
    ],
  });
  const variant = product.variants[0]!;
  await Inventory.create({
    productId: product._id,
    variantId: variant._id,
    sku: variant.sku,
    onHand: opts.onHand ?? 10,
    reserved: 0,
  });
  return { product, variantId: variant._id, sku: variant.sku };
}

interface SeedPublishedEditionInput {
  planId: string;
  cycleYear: number;
  cycleMonth: number;
  items: EditionItemInput[];
}

async function seedPublishedEdition(input: SeedPublishedEditionInput): Promise<SubscriptionEditionDocument> {
  const created = await createEdition({
    planId: input.planId,
    cycleYear: input.cycleYear,
    cycleMonth: input.cycleMonth,
    title: `Edición ${input.cycleYear}-${input.cycleMonth}`,
  });
  await updateEdition(created._id.toString(), { items: input.items });
  const adminId = new Types.ObjectId().toString();
  return publishEdition(created._id.toString(), adminId);
}

interface SeedSubscribedAccountInput {
  planId: string;
  status?: SubscriptionStatus;
  providerSubscriptionId?: string;
  providerCustomerId?: string;
}

/** Sube la cuenta hasta `status` pasando por las transiciones reales (nunca
 * un `Model.create` con el status ya puesto): así `seatsTaken` y
 * `statusHistory` quedan exactamente como los dejaría el webhook real. */
async function seedSubscribedAccount(input: SeedSubscribedAccountInput): Promise<SubscriptionAccountDocument> {
  const userId = new Types.ObjectId().toString();
  let account = await startSubscription({ userId, planId: input.planId });

  if (input.providerSubscriptionId || input.providerCustomerId) {
    const updated = await SubscriptionAccount.findByIdAndUpdate(
      account._id,
      {
        $set: {
          ...(input.providerSubscriptionId ? { providerSubscriptionId: input.providerSubscriptionId } : {}),
          ...(input.providerCustomerId ? { providerCustomerId: input.providerCustomerId } : {}),
        },
      },
      { new: true },
    );
    account = updated!;
  }

  const target = input.status ?? SubscriptionStatus.INCOMPLETE;
  if (target === SubscriptionStatus.INCOMPLETE) return account;

  account = await applyStatusTransition(account, SubscriptionStatus.ACTIVE, "system");
  if (target === SubscriptionStatus.ACTIVE) return account;

  if (target === SubscriptionStatus.PAST_DUE) {
    return applyStatusTransition(account, SubscriptionStatus.PAST_DUE, "system");
  }
  if (target === SubscriptionStatus.PAUSED) {
    return applyStatusTransition(account, SubscriptionStatus.PAUSED, "customer");
  }
  if (target === SubscriptionStatus.CANCELED) {
    return applyStatusTransition(account, SubscriptionStatus.CANCELED, "system");
  }
  return account;
}

type InvoicePaidEvent = Extract<SubscriptionWebhookEvent, { kind: "subscription.invoice_paid" }>;
type PaymentFailedEvent = Extract<SubscriptionWebhookEvent, { kind: "subscription.payment_failed" }>;
type SubscriptionUpdatedEvent = Extract<SubscriptionWebhookEvent, { kind: "subscription.updated" }>;
type SubscriptionCanceledEvent = Extract<SubscriptionWebhookEvent, { kind: "subscription.canceled" }>;

/** Constructores de eventos de DOMINIO (ya traducidos) — mismo criterio que
 * `capturedEvent`/`failedEvent` en payment-webhook.service.test.ts: esta
 * suite prueba el orquestador + handlers, no el traductor de Stripe (que ya
 * tiene su propia suite). */
function invoicePaidEvent(overrides: Partial<InvoicePaidEvent> = {}): InvoicePaidEvent {
  const now = new Date();
  return {
    kind: "subscription.invoice_paid",
    eventId: `evt_${randomUUID()}`,
    providerType: "invoice.paid",
    subscriptionRef: `sub_${randomUUID()}`,
    invoiceRef: `in_${randomUUID()}`,
    amountPaidCents: 59900,
    currency: "mxn",
    servicePeriodStart: now,
    servicePeriodEnd: now,
    billingReason: "subscription_cycle",
    ...overrides,
  };
}

function paymentFailedEvent(overrides: Partial<PaymentFailedEvent> = {}): PaymentFailedEvent {
  return {
    kind: "subscription.payment_failed",
    eventId: `evt_${randomUUID()}`,
    providerType: "invoice.payment_failed",
    subscriptionRef: `sub_${randomUUID()}`,
    invoiceRef: `in_${randomUUID()}`,
    attemptCount: 1,
    ...overrides,
  };
}

function subscriptionUpdatedEvent(overrides: Partial<SubscriptionUpdatedEvent> = {}): SubscriptionUpdatedEvent {
  return {
    kind: "subscription.updated",
    eventId: `evt_${randomUUID()}`,
    providerType: "customer.subscription.updated",
    subscriptionRef: `sub_${randomUUID()}`,
    status: "active",
    cancelAtPeriodEnd: false,
    ...overrides,
  };
}

function subscriptionCanceledEvent(overrides: Partial<SubscriptionCanceledEvent> = {}): SubscriptionCanceledEvent {
  return {
    kind: "subscription.canceled",
    eventId: `evt_${randomUUID()}`,
    providerType: "customer.subscription.deleted",
    subscriptionRef: `sub_${randomUUID()}`,
    canceledAt: new Date(),
    ...overrides,
  };
}

export {
  seedPlanWithStripeRefs,
  seedSubscriptionVariantWithStock,
  seedPublishedEdition,
  seedSubscribedAccount,
  invoicePaidEvent,
  paymentFailedEvent,
  subscriptionUpdatedEvent,
  subscriptionCanceledEvent,
};
