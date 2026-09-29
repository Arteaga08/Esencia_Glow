import { pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";
import { Types } from "mongoose";
import { PaymentMethod, type CartLineInput } from "@esencia-glow/shared";
import { connectDatabase, disconnectDatabase } from "../config/db.js";
import { logger } from "../config/logger.js";
import { User } from "../models/user.model.js";
import { Order } from "../models/order.model.js";
import { Product } from "../models/product.model.js";
import { SubscriptionInvoice } from "../models/subscription-invoice.model.js";
import { createShippingQuote } from "../services/shipping-quote.service.js";
import { createOrder } from "../services/create-order.service.js";
import { markOrderPaid } from "../services/order-payment.service.js";

/**
 * Seed de demostración para el Resumen del panel (Milestone 2.9): pedidos
 * pagados y facturas de suscripción repartidos en los últimos 12 meses,
 * para que `/overview/preview/*` y `GET /admin/overview/sales` tengan datos
 * reales en los 4 rangos (día/semana/mes/año) — sin esto, la ventana móvil
 * de `resolveOverviewWindow` no tendría nada que mostrar salvo lo sembrado
 * "hoy" por otros seeds.
 *
 * Corre sobre las clientas y el catálogo que dejan `seed:customers` y
 * `seed:catalog` — nunca inventa productos ni usuarias propias, mismo
 * criterio que `seed-customers-demo.ts`. Los pedidos pasan por los
 * servicios reales (`createShippingQuote`, `createOrder`, `markOrderPaid`)
 * y solo DESPUÉS se retrasa `payment.capturedAt`/`createdAt` directo en la
 * colección (Mongoose no deja tocar timestamps) para repartirlos en el
 * tiempo — mismo patrón que `tests/routes/admin-customer-top.routes.test.ts`.
 *
 * Las facturas de suscripción son registros directos (`SubscriptionInvoice`
 * no tiene service propio, es un registro plano — ver
 * subscription-billing.service.ts): con refs sintéticos, NUNCA atados a una
 * `SubscriptionAccount` real — nada en el Resumen hace join sobre ellos, solo
 * suma `amountPaidCents` por `paidAt`.
 *
 * Idempotente por conteo: si ya hay 12 meses con datos, no siembra de más.
 */

const DEMO_EMAIL_DOMAIN = "esenciaglow.mx";
const MONTHS_BACK = 12;
const ORDERS_PER_MONTH = 3;
const INVOICES_PER_MONTH = 2;

const DESTINATION = {
  fullName: "Renata Solís",
  phone: "5512345699",
  street: "Av. Chapultepec",
  exteriorNumber: "220",
  neighborhood: "Roma Norte",
  city: "Ciudad de México",
  state: "Ciudad de México" as const,
  postalCode: "06700",
};

/** `SPF-POL-008` queda fuera: `seed:inventory` lo deja en 0 unidades. */
const CATALOG_SKUS = ["BAL-LAB-010", "CORP-SEC-100", "SPF-LIG-050", "ACE-NUT-030", "CRE-DIA-050"];

/** Instante dentro del mes `monthsAgo` meses antes de `now`, en un día fijo
 * (el 12) para no depender de cuántos días tiene cada mes. */
function dateInPastMonth(now: Date, monthsAgo: number, dayOffset: number): Date {
  const date = new Date(now);
  date.setUTCMonth(date.getUTCMonth() - monthsAgo, 12 + dayOffset);
  date.setUTCHours(15, 0, 0, 0);
  return date;
}

async function pickDemoCustomerIds(): Promise<string[]> {
  const users = await User.find({ email: new RegExp(`^demo-cliente-\\d+@${DEMO_EMAIL_DOMAIN}$`) })
    .select("_id")
    .lean();
  return users.map((user) => user._id.toString());
}

async function placeOrder(userId: string, sku: string): Promise<{ orderId: string; totalCents: number }> {
  const product = await Product.findOne({ "variants.sku": sku }).lean();
  const variant = product?.variants.find((v) => v.sku === sku);
  if (!product || !variant) throw new Error(`No se encontró la variante ${sku} — corre pnpm seed:catalog primero.`);

  const lines: CartLineInput[] = [{ itemType: "product", itemId: variant._id.toString(), quantity: 1 }];
  const quote = await createShippingQuote({ userId, destination: DESTINATION, lines });
  const rateId = quote.rates[0]!.rateId;

  const { order } = await createOrder({
    userId,
    lines,
    quoteId: quote._id.toString(),
    rateId,
    paymentMethod: PaymentMethod.CARD,
    termsAccepted: true,
    idempotencyKey: randomUUID(),
  });
  return { orderId: order._id.toString(), totalCents: order.totalCents };
}

async function seedOrdersForMonth(customerIds: string[], now: Date, monthsAgo: number): Promise<void> {
  for (let i = 0; i < ORDERS_PER_MONTH; i += 1) {
    const userId = customerIds[i % customerIds.length]!;
    const sku = CATALOG_SKUS[(monthsAgo + i) % CATALOG_SKUS.length]!;
    const { orderId } = await placeOrder(userId, sku);
    await markOrderPaid({ orderId });

    const capturedAt = dateInPastMonth(now, monthsAgo, i * 3);
    await Order.collection.updateOne(
      { _id: new Types.ObjectId(orderId) },
      { $set: { createdAt: capturedAt, "payment.capturedAt": capturedAt } },
    );
  }
}

async function seedInvoicesForMonth(now: Date, monthsAgo: number): Promise<void> {
  for (let i = 0; i < INVOICES_PER_MONTH; i += 1) {
    const paidAt = dateInPastMonth(now, monthsAgo, i * 5 + 1);
    await SubscriptionInvoice.create({
      invoiceRef: `in_demo_overview_${monthsAgo}_${i}`,
      accountId: new Types.ObjectId(),
      userId: new Types.ObjectId(),
      planId: new Types.ObjectId(),
      amountPaidCents: 39900 + i * 30000,
      currency: "mxn",
      paidAt,
    });
  }
}

async function seedOverviewDemo(): Promise<void> {
  const customerIds = await pickDemoCustomerIds();
  if (customerIds.length === 0) {
    logger.info("No hay clientas demo — corre `pnpm seed:customers` primero, se omite.");
    return;
  }

  const existingInvoiceCount = await SubscriptionInvoice.countDocuments({
    invoiceRef: /^in_demo_overview_/,
  });
  if (existingInvoiceCount >= MONTHS_BACK * INVOICES_PER_MONTH) {
    logger.info("Datos de demo del Resumen ya sembrados — se omite (idempotente).");
    return;
  }

  const now = new Date();
  for (let monthsAgo = 0; monthsAgo < MONTHS_BACK; monthsAgo += 1) {
    await seedOrdersForMonth(customerIds, now, monthsAgo);
    await seedInvoicesForMonth(now, monthsAgo);
    logger.info({ monthsAgo }, "Mes de demo del Resumen sembrado");
  }
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("seed:overview no corre en producción.");
  }
  await connectDatabase();
  try {
    await seedOverviewDemo();
  } finally {
    await disconnectDatabase();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    logger.error({ err: error }, "seed:overview falló");
    process.exitCode = 1;
  });
}

export { seedOverviewDemo };
