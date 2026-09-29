import { pathToFileURL } from "node:url";
import { ProductChannel, ProductStatus, SubscriptionStatus } from "@esencia-glow/shared";
import { connectDatabase, disconnectDatabase } from "../config/db.js";
import { logger } from "../config/logger.js";
import { User } from "../models/user.model.js";
import { Category } from "../models/category.model.js";
import { Product, type ProductDocument } from "../models/product.model.js";
import { Inventory } from "../models/inventory.model.js";
import { SubscriptionPlan, type SubscriptionPlanDocument } from "../models/subscription-plan.model.js";
import { SubscriptionEdition } from "../models/subscription-edition.model.js";
import { SubscriptionAccount, type SubscriptionAccountDocument } from "../models/subscription-account.model.js";
import { applyStatusTransition, startSubscription } from "../services/subscription-seat.service.js";
import { updateEdition, type EditionItemInput } from "../services/subscription-edition.service.js";
import { publishEdition } from "../services/subscription-edition-publish.service.js";
import { resolveCycleFromDate } from "../utils/resolve-cycle.js";

/**
 * Seed de demostración para el panel de Suscripciones (Milestones 2.7a/2.7b):
 * 3 planes demo (mensual + anual) + 5 productos de canal `subscription` con
 * inventario + 3 ediciones (borrador, publicada, de otro plan) + 6 cuentas
 * cubriendo los 5 estados de `SubscriptionStatus` más las banderas que el
 * panel filtra.
 *
 * NUNCA toca Stripe: los planes se crean con `SubscriptionPlan.create`
 * directo (sin `providerProductId`/`providerPriceId`) en vez de `createPlan()`
 * (que exige `STRIPE_SECRET_KEY`, ver subscription-plan.service.ts) — mismo
 * motivo por el que `seed-customers-demo.ts` nunca crea un plan. **Por eso
 * estos planes NUNCA aparecen en el catálogo público** (`GET
 * /subscription-plans` exige `providerPriceId`, ver
 * `subscription-plan-public.service.ts`): para probar el alta de punta a
 * punta contra Stripe real (modo test) hay que crear un plan vía
 * `POST /admin/subscription-plans` con la llave de prueba ya configurada en
 * `.env.development.local`.
 *
 * Las cuentas y ediciones SÍ pasan por los servicios reales
 * (`startSubscription`/`applyStatusTransition`/`updateEdition`/
 * `publishEdition`) para que `seatsTaken`/`statusHistory`/`publishedAt`
 * queden coherentes — mismo criterio que `seedSubscribedAccount`/
 * `seedPublishedEdition` en tests/helpers/subscription-fixtures.ts.
 *
 * Corre sobre las clientas que deja `seed:customers`
 * (`demo-cliente-N@esenciaglow.mx`) — nunca crea usuarias propias, para no
 * duplicar esa fuente de verdad. Requiere haber corrido `pnpm seed:customers`
 * antes. Idempotente: cada paso verifica si ya existe antes de crear.
 */

const DEMO_EMAIL_DOMAIN = "esenciaglow.mx";
type DemoPlanSlug = "demo-caja-esencial" | "demo-caja-premium" | "demo-caja-deluxe";

interface DemoPlanSpec {
  slug: DemoPlanSlug;
  name: string;
  description: string;
  priceCents: number;
  /** ~10x el mensual, precedente de la decisión de Manuel para el precio
   * anual de las cajas demo. */
  annualPriceCents: number;
  maxActiveSeats: number;
}

const PLANS: DemoPlanSpec[] = [
  {
    slug: "demo-caja-esencial",
    name: "Caja Esencial (demo)",
    description: "Caja mensual de demostración — nunca sincronizada con Stripe.",
    priceCents: 39900,
    annualPriceCents: 399000,
    maxActiveSeats: 50,
  },
  {
    slug: "demo-caja-premium",
    name: "Caja Premium (demo)",
    description: "Caja mensual de demostración, nivel premium — nunca sincronizada con Stripe.",
    priceCents: 69900,
    annualPriceCents: 699000,
    maxActiveSeats: 50,
  },
  {
    slug: "demo-caja-deluxe",
    name: "Caja Deluxe (demo)",
    description: "Caja mensual de demostración, nivel deluxe — nunca sincronizada con Stripe.",
    priceCents: 99900,
    annualPriceCents: 999000,
    maxActiveSeats: 30,
  },
];

interface DemoProductSpec {
  slug: string;
  name: string;
  sku: string;
  price: number;
  onHand: number;
}

/** Canal `subscription` (1.7.1): fuera del catálogo público, solo elegibles
 * para ítems de edición. 5 productos alcanzan para armar ediciones variadas
 * sin acercarse a `MAX_EDITION_ITEMS` (20). */
const PRODUCTS: DemoProductSpec[] = [
  { slug: "demo-sub-serum-vitamina-c", name: "Sérum de vitamina C (demo)", sku: "DEMO-SUB-SERUM-C", price: 45000, onHand: 100 },
  { slug: "demo-sub-crema-hidratante", name: "Crema hidratante (demo)", sku: "DEMO-SUB-CREMA-HID", price: 38000, onHand: 100 },
  { slug: "demo-sub-mascarilla-arcilla", name: "Mascarilla de arcilla (demo)", sku: "DEMO-SUB-MASCARILLA", price: 32000, onHand: 100 },
  { slug: "demo-sub-aceite-facial", name: "Aceite facial (demo)", sku: "DEMO-SUB-ACEITE", price: 42000, onHand: 100 },
  { slug: "demo-sub-protector-solar", name: "Protector solar (demo)", sku: "DEMO-SUB-SPF", price: 36000, onHand: 100 },
];

interface DemoAccountSpec {
  /** Índice de `demo-cliente-N@esenciaglow.mx` (1-based, mismo esquema que
   * seed-customers-demo.ts). */
  customerIndex: number;
  planSlug: DemoPlanSlug;
  status: SubscriptionStatus;
  billingInterval?: "month" | "year";
  cancelAtPeriodEnd?: boolean;
  pastDueSince?: Date;
  dunningAttempts?: number;
}

const NOW = new Date();
const MONTH_MS = 30 * 24 * 60 * 60 * 1000;
const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

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
  {
    customerIndex: 6,
    planSlug: "demo-caja-deluxe",
    status: SubscriptionStatus.ACTIVE,
    billingInterval: "year",
    cancelAtPeriodEnd: true,
  },
];

async function ensureDemoPlan(spec: DemoPlanSpec): Promise<SubscriptionPlanDocument> {
  const existing = await SubscriptionPlan.findOne({ slug: spec.slug });
  if (existing) return existing;
  return SubscriptionPlan.create({
    name: spec.name,
    slug: spec.slug,
    description: spec.description,
    priceCents: spec.priceCents,
    annualPriceCents: spec.annualPriceCents,
    currency: "mxn",
    billingInterval: "month",
    maxActiveSeats: spec.maxActiveSeats,
    seatsTaken: 0,
    isActive: true,
    sortOrder: 0,
  });
}

async function ensureDemoCategory(): Promise<string> {
  const existing = await Category.findOne({ slug: "demo-suscripcion" });
  if (existing) return existing._id.toString();
  const created = await Category.create({ name: "Suscripción (demo)", slug: "demo-suscripcion" });
  return created._id.toString();
}

async function ensureDemoProduct(spec: DemoProductSpec, categoryId: string): Promise<ProductDocument> {
  const existing = await Product.findOne({ slug: spec.slug });
  if (existing) return existing;

  const product = await Product.create({
    name: spec.name,
    slug: spec.slug,
    description: `${spec.name} — producto de demostración exclusivo de suscripción.`,
    categoryId,
    status: ProductStatus.ACTIVE,
    channel: ProductChannel.SUBSCRIPTION,
    variants: [
      {
        sku: spec.sku,
        name: "Único",
        price: spec.price,
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
    onHand: spec.onHand,
    reserved: 0,
  });

  return product;
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

  const started = await startSubscription({
    userId: user._id.toString(),
    planId: plan._id.toString(),
    ...(spec.billingInterval ? { billingInterval: spec.billingInterval } : {}),
  });
  const account = await advanceToStatus(started, spec.status);

  const fields: Record<string, unknown> = {};
  if (spec.status !== SubscriptionStatus.INCOMPLETE && spec.status !== SubscriptionStatus.CANCELED) {
    fields.currentPeriodStart = NOW;
    fields.currentPeriodEnd = new Date(NOW.getTime() + (spec.billingInterval === "year" ? YEAR_MS : MONTH_MS));
  }
  if (spec.cancelAtPeriodEnd) fields.cancelAtPeriodEnd = true;
  if (spec.pastDueSince) fields.pastDueSince = spec.pastDueSince;
  if (spec.dunningAttempts) fields.dunningAttempts = spec.dunningAttempts;

  if (Object.keys(fields).length > 0) {
    await SubscriptionAccount.updateOne({ _id: account._id }, { $set: fields });
  }

  logger.info({ email, plan: plan.slug, status: spec.status }, "Cuenta de suscripción de demo sembrada");
}

async function ensureDemoEdition(
  planId: string,
  cycleYear: number,
  cycleMonth: number,
  items: EditionItemInput[],
  publish: boolean,
): Promise<void> {
  const existing = await SubscriptionEdition.findOne({ planId, cycleYear, cycleMonth });
  if (existing) {
    logger.info({ planId, cycleYear, cycleMonth }, "Edición de demo ya existía — se omite (idempotente)");
    return;
  }

  const created = await SubscriptionEdition.create({
    planId,
    cycleYear,
    cycleMonth,
    title: `Edición ${cycleYear}-${String(cycleMonth).padStart(2, "0")} (demo)`,
  });
  await updateEdition(created._id.toString(), { items });
  if (publish) {
    const adminId = (await User.findOne({ role: "admin" }).select("_id").lean())?._id?.toString();
    if (!adminId) throw new Error("No hay ningún admin sembrado — corre `pnpm seed:admin` primero.");
    await publishEdition(created._id.toString(), adminId);
  }

  logger.info({ planId, cycleYear, cycleMonth, publish }, "Edición de demo sembrada");
}

async function seedSubscriptionsDemo(): Promise<void> {
  const plans = await Promise.all(PLANS.map(ensureDemoPlan));
  const planBySlug = new Map(plans.map((plan) => [plan.slug, plan]));

  const categoryId = await ensureDemoCategory();
  const products = await Promise.all(PRODUCTS.map((spec) => ensureDemoProduct(spec, categoryId)));

  const esencial = planBySlug.get("demo-caja-esencial")!;
  const premium = planBySlug.get("demo-caja-premium")!;
  const { cycleYear, cycleMonth } = resolveCycleFromDate(NOW);
  const nextCycleDate = new Date(NOW);
  nextCycleDate.setUTCMonth(nextCycleDate.getUTCMonth() + 1);
  const { cycleYear: nextCycleYear, cycleMonth: nextCycleMonth } = resolveCycleFromDate(nextCycleDate);

  const variantId = (product: ProductDocument) => product.variants[0]!._id.toString();

  // Plan A (esencial), ciclo actual, publicada — la que usarían las cuentas
  // ACTIVE/PAST_DUE de arriba.
  await ensureDemoEdition(
    esencial._id.toString(),
    cycleYear,
    cycleMonth,
    [
      { productId: products[0]!._id.toString(), variantId: variantId(products[0]!), quantity: 1 },
      { productId: products[1]!._id.toString(), variantId: variantId(products[1]!), quantity: 1 },
      { productId: products[2]!._id.toString(), variantId: variantId(products[2]!), quantity: 2 },
    ],
    true,
  );
  // Plan A, ciclo SIGUIENTE, sin publicar — para ver el estado "borrador" en
  // el panel antes de armarla del todo.
  await ensureDemoEdition(
    esencial._id.toString(),
    nextCycleYear,
    nextCycleMonth,
    [{ productId: products[3]!._id.toString(), variantId: variantId(products[3]!), quantity: 1 }],
    false,
  );
  // Plan B (premium), ciclo actual, publicada.
  await ensureDemoEdition(
    premium._id.toString(),
    cycleYear,
    cycleMonth,
    [
      { productId: products[0]!._id.toString(), variantId: variantId(products[0]!), quantity: 1 },
      { productId: products[3]!._id.toString(), variantId: variantId(products[3]!), quantity: 1 },
      { productId: products[4]!._id.toString(), variantId: variantId(products[4]!), quantity: 1 },
    ],
    true,
  );

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
