import { pathToFileURL } from "node:url";
import { SubscriptionStatus } from "@esencia-glow/shared";
import { connectDatabase, disconnectDatabase } from "../config/db.js";
import { logger } from "../config/logger.js";
import { User } from "../models/user.model.js";
import { SubscriptionPlan, type SubscriptionPlanDocument } from "../models/subscription-plan.model.js";
import { SubscriptionAccount, type SubscriptionAccountDocument } from "../models/subscription-account.model.js";
import { applyStatusTransition, startSubscription } from "../services/subscription-seat.service.js";

/**
 * Seed de demostración para el panel de Cuentas de suscripción (Milestone
 * 2.7a): 2 planes demo + 6 cuentas cubriendo los 5 estados de
 * `SubscriptionStatus` más las dos banderas que el panel filtra
 * (`cancelAtPeriodEnd`, `dunningAttempts`/`pastDueSince`).
 *
 * NUNCA toca Stripe: los planes se crean con `SubscriptionPlan.create`
 * directo (sin `providerProductId`/`providerPriceId`) en vez de
 * `createPlan()` (que exige `STRIPE_SECRET_KEY` configurada, ver
 * subscription-plan.service.ts) — mismo motivo por el que
 * `seed-customers-demo.ts` nunca crea un plan. Las cuentas SÍ pasan por los
 * servicios reales (`startSubscription`/`applyStatusTransition`) para que
 * `seatsTaken`/`statusHistory` queden coherentes, igual que
 * `seedSubscribedAccount` en los tests.
 *
 * Corre sobre las clientas que deja `seed:customers`
 * (`demo-cliente-N@esenciaglow.mx`) — nunca crea usuarias propias, para no
 * duplicar esa fuente de verdad. Requiere haber corrido `pnpm seed:customers`
 * antes.
 */

const DEMO_EMAIL_DOMAIN = "esenciaglow.mx";
type DemoPlanSlug = "demo-caja-esencial" | "demo-caja-premium";

interface DemoPlanSpec {
  slug: DemoPlanSlug;
  name: string;
  description: string;
  priceCents: number;
  maxActiveSeats: number;
}

const PLANS: DemoPlanSpec[] = [
  {
    slug: "demo-caja-esencial",
    name: "Caja Esencial (demo)",
    description: "Caja mensual de demostración — nunca sincronizada con Stripe.",
    priceCents: 39900,
    maxActiveSeats: 50,
  },
  {
    slug: "demo-caja-premium",
    name: "Caja Premium (demo)",
    description: "Caja mensual de demostración, nivel premium — nunca sincronizada con Stripe.",
    priceCents: 69900,
    maxActiveSeats: 50,
  },
];

interface DemoAccountSpec {
  /** Índice de `demo-cliente-N@esenciaglow.mx` (1-based, mismo esquema que
   * seed-customers-demo.ts). */
  customerIndex: number;
  planSlug: DemoPlanSlug;
  status: SubscriptionStatus;
  cancelAtPeriodEnd?: boolean;
  pastDueSince?: Date;
  dunningAttempts?: number;
}

const NOW = new Date();
const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

const ACCOUNTS: DemoAccountSpec[] = [
  { customerIndex: 1, planSlug: "demo-caja-esencial", status: SubscriptionStatus.INCOMPLETE },
  { customerIndex: 2, planSlug: "demo-caja-esencial", status: SubscriptionStatus.ACTIVE },
  {
    customerIndex: 3,
    planSlug: "demo-caja-premium",
    status: SubscriptionStatus.PAST_DUE,
    pastDueSince: new Date(NOW.getTime() - 5 * 24 * 60 * 60 * 1000),
    dunningAttempts: 2,
  },
  { customerIndex: 4, planSlug: "demo-caja-esencial", status: SubscriptionStatus.PAUSED },
  { customerIndex: 5, planSlug: "demo-caja-premium", status: SubscriptionStatus.CANCELED },
  { customerIndex: 6, planSlug: "demo-caja-esencial", status: SubscriptionStatus.ACTIVE, cancelAtPeriodEnd: true },
];

async function ensureDemoPlan(spec: DemoPlanSpec): Promise<SubscriptionPlanDocument> {
  const existing = await SubscriptionPlan.findOne({ slug: spec.slug });
  if (existing) return existing;
  return SubscriptionPlan.create({
    name: spec.name,
    slug: spec.slug,
    description: spec.description,
    priceCents: spec.priceCents,
    currency: "mxn",
    billingInterval: "month",
    maxActiveSeats: spec.maxActiveSeats,
    seatsTaken: 0,
    isActive: true,
    sortOrder: 0,
  });
}

/** Sube la cuenta hasta `status` pasando por las transiciones reales — calco
 * de `seedSubscribedAccount` en tests/helpers/subscription-fixtures.ts. */
async function advanceToStatus(
  account: SubscriptionAccountDocument,
  status: SubscriptionStatus,
): Promise<SubscriptionAccountDocument> {
  if (status === SubscriptionStatus.INCOMPLETE) return account;

  const current = await applyStatusTransition(account, SubscriptionStatus.ACTIVE, "system");
  if (status === SubscriptionStatus.ACTIVE) return current;

  if (status === SubscriptionStatus.PAST_DUE) return applyStatusTransition(current, SubscriptionStatus.PAST_DUE, "system");
  if (status === SubscriptionStatus.PAUSED) return applyStatusTransition(current, SubscriptionStatus.PAUSED, "customer");
  if (status === SubscriptionStatus.CANCELED) return applyStatusTransition(current, SubscriptionStatus.CANCELED, "system");
  return current;
}

async function seedDemoAccount(spec: DemoAccountSpec, planBySlug: Map<string, SubscriptionPlanDocument>): Promise<void> {
  const email = `demo-cliente-${spec.customerIndex}@${DEMO_EMAIL_DOMAIN}`;
  const user = await User.findOne({ email });
  if (!user) {
    logger.info({ email }, "Clienta de demo no existe — corre `pnpm seed:customers` primero, se omite");
    return;
  }

  const existingAccount = await SubscriptionAccount.findOne({ userId: user._id });
  if (existingAccount) {
    logger.info({ email }, "Cuenta de suscripción de demo ya existía — se omite (idempotente)");
    return;
  }

  const plan = planBySlug.get(spec.planSlug);
  if (!plan) throw new Error(`Plan demo ${spec.planSlug} no encontrado — esto no debería pasar.`);

  const started = await startSubscription({ userId: user._id.toString(), planId: plan._id.toString() });
  const account = await advanceToStatus(started, spec.status);

  const fields: Record<string, unknown> = {};
  if (spec.status !== SubscriptionStatus.INCOMPLETE && spec.status !== SubscriptionStatus.CANCELED) {
    fields.currentPeriodStart = NOW;
    fields.currentPeriodEnd = new Date(NOW.getTime() + MONTH_MS);
  }
  if (spec.cancelAtPeriodEnd) fields.cancelAtPeriodEnd = true;
  if (spec.pastDueSince) fields.pastDueSince = spec.pastDueSince;
  if (spec.dunningAttempts) fields.dunningAttempts = spec.dunningAttempts;

  if (Object.keys(fields).length > 0) {
    await SubscriptionAccount.updateOne({ _id: account._id }, { $set: fields });
  }

  logger.info({ email, plan: plan.slug, status: spec.status }, "Cuenta de suscripción de demo sembrada");
}

async function seedSubscriptionsDemo(): Promise<void> {
  const plans = await Promise.all(PLANS.map(ensureDemoPlan));
  const planBySlug = new Map(plans.map((plan) => [plan.slug, plan]));

  for (const spec of ACCOUNTS) {
    await seedDemoAccount(spec, planBySlug);
  }
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("seed:subscriptions no corre en producción.");
  }
  await connectDatabase();
  try {
    await seedSubscriptionsDemo();
  } finally {
    await disconnectDatabase();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    logger.error({ err: error }, "seed:subscriptions falló");
    process.exitCode = 1;
  });
}

export { seedSubscriptionsDemo };
