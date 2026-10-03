import { pathToFileURL } from "node:url";
import { ProductChannel, ProductStatus, SubscriptionStatus } from "@esencia-glow/shared";
import { connectDatabase, disconnectDatabase } from "../config/db.js";
import { logger } from "../config/logger.js";
import { User } from "../models/user.model.js";
import { Category } from "../models/category.model.js";
import { Product, type ProductDocument } from "../models/product.model.js";
import { Inventory } from "../models/inventory.model.js";
import { HomeContent } from "../models/home-content.model.js";
import { SubscriptionPlan, type SubscriptionPlanDocument } from "../models/subscription-plan.model.js";
import { SubscriptionEdition } from "../models/subscription-edition.model.js";
import { SubscriptionAccount, type SubscriptionAccountDocument } from "../models/subscription-account.model.js";
import { applyStatusTransition, startSubscription } from "../services/subscription-seat.service.js";
import { updateEdition, type EditionItemInput } from "../services/subscription-edition.service.js";
import { publishEdition } from "../services/subscription-edition-publish.service.js";
import { createPlan } from "../services/subscription-plan.service.js";
import { addPlanImages } from "../services/subscription-plan-image.service.js";
import { slugify } from "../utils/slugify.js";
import { resolveCycleFromDate } from "../utils/resolve-cycle.js";

/**
 * Seed de demostración para Suscripciones (Milestones 2.7a/2.7b/3.1.7b): UNA
 * caja con tres periodos de cobro (mensual $499, trimestral $1,467 y anual
 * $5,748, los precios de la propuesta del home) + 5 productos de canal
 * `subscription` con inventario + 2 ediciones (mes en curso publicada, mes
 * siguiente en borrador) + 7 cuentas cubriendo los 5 estados de
 * `SubscriptionStatus`, los tres intervalos y las banderas que el panel
 * filtra.
 *
 * El plan SÍ pasa por `createPlan()` y por tanto toca Stripe en modo test
 * (crea Product + 3 Prices con la llave `sk_test_…` de
 * `.env.development.local`): sin `providerPriceId` el catálogo público
 * (`GET /subscription-plans`, ver `subscription-plan-public.service.ts`) no
 * lo listaría y el bloque Suscripción del home quedaría vacío. Las
 * SUSCRIPCIONES de las cuentas demo, en cambio, nunca existen en Stripe: se
 * crean con los servicios locales (`startSubscription`/
 * `applyStatusTransition`), así que cobrar o cancelar una desde el panel no
 * tiene contraparte allá.
 *
 * Fotos: la portada de Kits del home (`HomeContent.kits`) se descarga y se
 * vuelve a subir como imagen PROPIA del plan (`addPlanImages`), para que
 * borrar la foto del plan desde el panel nunca rompa la portada de Kits. Sin
 * portada de Kits (o sin Cloudinary) el plan se crea sin fotos y avisa.
 *
 * Las ediciones y cuentas pasan por los servicios reales para que
 * `seatsTaken`/`statusHistory`/`publishedAt` queden coherentes — mismo
 * criterio que `seedSubscribedAccount`/`seedPublishedEdition` en
 * tests/helpers/subscription-fixtures.ts.
 *
 * Corre sobre las clientas que deja `seed:customers`
 * (`demo-cliente-N@esenciaglow.mx`) — nunca crea usuarias propias, para no
 * duplicar esa fuente de verdad. Requiere haber corrido `pnpm seed:customers`
 * y `pnpm seed:admin` antes. Idempotente: cada paso verifica si ya existe
 * antes de crear (el plan por `slug`, sin volver a tocar Stripe).
 * Para empezar de cero: `pnpm reset:subscriptions --confirm`.
 */

const DEMO_EMAIL_DOMAIN = "esenciaglow.mx";
interface DemoPlanSpec {
  name: string;
  description: string;
  shortDescription: string;
  /** Mensual, trimestral y anual en centavos (Milestone 3.1.7). */
  priceCents: number;
  quarterlyPriceCents: number;
  annualPriceCents: number;
  maxActiveSeats: number;
  highlights: string[];
}

/** Una sola caja con tres periodos (decisión de negocio de 3.1.7). El texto
 * es el del fixture aprobado del bloque Suscripción del home. */
const PLAN: DemoPlanSpec = {
  name: "Caja Esencia Glow",
  description: "Una selección curada de skincare y lifestyle, distinta cada mes.",
  shortDescription: "Tu caja mensual de skincare y lifestyle.",
  priceCents: 49900,
  quarterlyPriceCents: 146700,
  annualPriceCents: 574800,
  maxActiveSeats: 50,
  highlights: [
    "Envío gratis en cada caja",
    "Productos de tamaño completo y de viaje",
    "Una selección nueva cada mes",
    "Cancela cuando quieras",
  ],
};

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
  status: SubscriptionStatus;
  billingInterval?: "quarter" | "year";
  cancelAtPeriodEnd?: boolean;
  pastDueSince?: Date;
  dunningAttempts?: number;
}

const NOW = new Date();
const DAY_MS = 24 * 60 * 60 * 1000;
const PERIOD_MS = { month: 30 * DAY_MS, quarter: 90 * DAY_MS, year: 365 * DAY_MS } as const;

const ACCOUNTS: DemoAccountSpec[] = [
  { customerIndex: 1, status: SubscriptionStatus.INCOMPLETE },
  { customerIndex: 2, status: SubscriptionStatus.ACTIVE },
  {
    customerIndex: 3,
    status: SubscriptionStatus.PAST_DUE,
    pastDueSince: new Date(NOW.getTime() - 5 * DAY_MS),
    dunningAttempts: 2,
  },
  { customerIndex: 4, status: SubscriptionStatus.PAUSED },
  { customerIndex: 5, status: SubscriptionStatus.CANCELED },
  { customerIndex: 6, status: SubscriptionStatus.ACTIVE, billingInterval: "quarter" },
  { customerIndex: 7, status: SubscriptionStatus.ACTIVE, billingInterval: "year", cancelAtPeriodEnd: true },
];

/** Portada de Kits del home como buffer, o `undefined` si no hay (o no baja). */
async function readKitsCoverBuffer(): Promise<Buffer | undefined> {
  const home = await HomeContent.findById("home").lean();
  const url = home?.kits?.images?.desktop?.url ?? home?.kits?.images?.mobile?.url;
  if (!url) return undefined;
  const response = await fetch(url);
  if (!response.ok) return undefined;
  return Buffer.from(await response.arrayBuffer());
}

async function ensureDemoPlan(spec: DemoPlanSpec): Promise<SubscriptionPlanDocument> {
  const existing = await SubscriptionPlan.findOne({ slug: slugify(spec.name) });
  if (existing) return existing;

  // Toca Stripe (modo test): Product + 3 Prices. Falla con 503 si no hay llave.
  const plan = await createPlan({
    name: spec.name,
    description: spec.description,
    shortDescription: spec.shortDescription,
    priceCents: spec.priceCents,
    quarterlyPriceCents: spec.quarterlyPriceCents,
    annualPriceCents: spec.annualPriceCents,
    maxActiveSeats: spec.maxActiveSeats,
    sortOrder: 0,
    highlights: spec.highlights,
  });

  try {
    const cover = await readKitsCoverBuffer();
    if (cover) {
      return await addPlanImages(plan._id.toString(), [cover], spec.name);
    }
    logger.warn("No hay portada de Kits en el home: el plan se creó sin fotos");
  } catch (error) {
    logger.warn({ err: error }, "No se pudo subir la foto del plan (¿Cloudinary configurado?): se creó sin fotos");
  }
  return plan;
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

async function seedDemoAccount(spec: DemoAccountSpec, plan: SubscriptionPlanDocument): Promise<void> {
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

  const started = await startSubscription({
    userId: user._id.toString(),
    planId: plan._id.toString(),
    ...(spec.billingInterval ? { billingInterval: spec.billingInterval } : {}),
  });
  const account = await advanceToStatus(started, spec.status);

  const fields: Record<string, unknown> = {};
  if (spec.status !== SubscriptionStatus.INCOMPLETE && spec.status !== SubscriptionStatus.CANCELED) {
    fields.currentPeriodStart = NOW;
    fields.currentPeriodEnd = new Date(NOW.getTime() + PERIOD_MS[spec.billingInterval ?? "month"]);
  }
  if (spec.cancelAtPeriodEnd) fields.cancelAtPeriodEnd = true;
  if (spec.pastDueSince) fields.pastDueSince = spec.pastDueSince;
  if (spec.dunningAttempts) fields.dunningAttempts = spec.dunningAttempts;

  if (Object.keys(fields).length > 0) {
    await SubscriptionAccount.updateOne({ _id: account._id }, { $set: fields });
  }

  logger.info({ email, plan: plan.slug, status: spec.status, interval: spec.billingInterval ?? "month" }, "Cuenta de suscripción de demo sembrada");
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
  const plan = await ensureDemoPlan(PLAN);

  const categoryId = await ensureDemoCategory();
  const products = await Promise.all(PRODUCTS.map((spec) => ensureDemoProduct(spec, categoryId)));

  const { cycleYear, cycleMonth } = resolveCycleFromDate(NOW);
  const nextCycleDate = new Date(NOW);
  nextCycleDate.setUTCMonth(nextCycleDate.getUTCMonth() + 1);
  const { cycleYear: nextCycleYear, cycleMonth: nextCycleMonth } = resolveCycleFromDate(nextCycleDate);

  const variantId = (product: ProductDocument) => product.variants[0]!._id.toString();

  // Mes en curso, publicada — la que usarían las cuentas ACTIVE/PAST_DUE.
  await ensureDemoEdition(
    plan._id.toString(),
    cycleYear,
    cycleMonth,
    [
      { productId: products[0]!._id.toString(), variantId: variantId(products[0]!), quantity: 1 },
      { productId: products[1]!._id.toString(), variantId: variantId(products[1]!), quantity: 1 },
      { productId: products[2]!._id.toString(), variantId: variantId(products[2]!), quantity: 2 },
    ],
    true,
  );
  // Mes SIGUIENTE, sin publicar — para ver el estado "borrador" en el panel
  // antes de armarla del todo.
  await ensureDemoEdition(
    plan._id.toString(),
    nextCycleYear,
    nextCycleMonth,
    [{ productId: products[3]!._id.toString(), variantId: variantId(products[3]!), quantity: 1 }],
    false,
  );

  for (const spec of ACCOUNTS) {
    await seedDemoAccount(spec, plan);
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
