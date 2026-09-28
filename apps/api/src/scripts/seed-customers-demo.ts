import { pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";
import { connectDatabase, disconnectDatabase } from "../config/db.js";
import { logger } from "../config/logger.js";
import { PaymentMethod, type CartLineInput } from "@esencia-glow/shared";
import { User } from "../models/user.model.js";
import { Product } from "../models/product.model.js";
import { createShippingQuote } from "../services/shipping-quote.service.js";
import { createOrder } from "../services/create-order.service.js";
import { markOrderPaid } from "../services/order-payment.service.js";
import { SubscriptionPlan } from "../models/subscription-plan.model.js";
import { startSubscription } from "../services/subscription-seat.service.js";

/**
 * Seed de demostración para el panel de Clientes (Milestone 2.6): ~8
 * clientas con historial de compra variado, sobre el catálogo real que ya
 * dejó `seed:catalog` (nunca inventa productos propios). Idempotente POR
 * CLIENTE (`demo-cliente-*@esenciaglow.mx`): cada clienta que ya existe se
 * salta entera (creación + pedidos), así que un rerun tras una corrida
 * interrumpida a la mitad retoma donde se quedó en vez de no hacer nada.
 *
 * Todo pasa por los servicios reales (`createShippingQuote`, `createOrder`,
 * `markOrderPaid`) — mismo criterio que `seed-inventory-demo.ts`: así los
 * totales, el inventario reservado/comprometido y la bitácora quedan
 * exactamente como los dejaría una compra real, nunca un `Model.create` a
 * mano con montos inventados.
 *
 * Suscripción: solo si ya existe un `SubscriptionPlan` activo en la base —
 * este seed nunca crea uno (necesitaría refs de Stripe reales).
 */

const DEMO_EMAIL_DOMAIN = "esenciaglow.mx";

const DESTINATION_ADDRESSES = [
  {
    fullName: "Ana Torres",
    phone: "5512345601",
    street: "Av. Insurgentes Sur",
    exteriorNumber: "1457",
    neighborhood: "Del Valle",
    city: "CDMX",
    state: "Ciudad de México" as const,
    postalCode: "03100",
  },
  {
    fullName: "María Fernanda López",
    phone: "3312345602",
    street: "Av. Chapultepec",
    exteriorNumber: "88",
    neighborhood: "Americana",
    city: "Guadalajara",
    state: "Jalisco" as const,
    postalCode: "44160",
  },
  {
    fullName: "Karla Jiménez",
    phone: "8112345603",
    street: "Av. Constitución",
    exteriorNumber: "400",
    neighborhood: "Centro",
    city: "Monterrey",
    state: "Nuevo León" as const,
    postalCode: "64000",
  },
];

interface DemoCustomerSpec {
  firstName: string;
  lastName: string;
  emailVerified: boolean;
  /** Número de pedidos PAGADOS a crear (una línea cada uno, SKU rotado). */
  paidOrders: number;
  /** Si además deja un pedido `pending` sin pagar (carrito abandonado). */
  withPendingOrder?: boolean;
}

const CUSTOMERS: DemoCustomerSpec[] = [
  { firstName: "Ana", lastName: "Torres", emailVerified: true, paidOrders: 3 },
  { firstName: "María Fernanda", lastName: "López", emailVerified: true, paidOrders: 1 },
  { firstName: "Karla", lastName: "Jiménez", emailVerified: true, paidOrders: 2, withPendingOrder: true },
  { firstName: "Daniela", lastName: "Ruiz", emailVerified: false, paidOrders: 0, withPendingOrder: true },
  { firstName: "Paola", lastName: "Mendoza", emailVerified: true, paidOrders: 5 },
  { firstName: "Regina", lastName: "Castillo", emailVerified: true, paidOrders: 0 },
  { firstName: "Ximena", lastName: "Ortega", emailVerified: true, paidOrders: 1 },
  { firstName: "Valentina", lastName: "Reyes", emailVerified: false, paidOrders: 0 },
];

async function ensureCustomer(spec: DemoCustomerSpec, index: number) {
  const email = `demo-cliente-${index + 1}@${DEMO_EMAIL_DOMAIN}`;
  const existing = await User.findOne({ email });
  if (existing) return { user: existing, wasExisting: true };
  const user = await User.create({
    email,
    password: "Contrasena1",
    firstName: spec.firstName,
    lastName: spec.lastName,
    role: "customer",
    emailVerified: spec.emailVerified,
  });
  return { user, wasExisting: false };
}

async function placeOrder(userId: string, sku: string, destination: (typeof DESTINATION_ADDRESSES)[number]) {
  const product = await Product.findOne({ "variants.sku": sku }).lean();
  const variant = product?.variants.find((v) => v.sku === sku);
  if (!product || !variant) throw new Error(`No se encontró la variante ${sku} — corre pnpm seed:catalog primero.`);

  const lines: CartLineInput[] = [{ itemType: "product", itemId: variant._id.toString(), quantity: 1 }];
  const quote = await createShippingQuote({ userId, destination, lines });
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
  return order;
}

// `SPF-POL-008` queda fuera a propósito: `seed:inventory` (Milestone 2.5) lo
// deja en 0 unidades para probar el estado "agotado" del panel — usarlo
// aquí tumbaría el seed con "Sin stock disponible".
const CATALOG_SKUS = [
  "BAL-LAB-010",
  "CORP-SEC-100",
  "CORP-KAR-200",
  "SPF-LIG-050",
  "ACE-NUT-030",
  "BRU-HID-100",
  "MAS-AVE-075",
  "CRE-DIA-050",
  "CRE-NOCT-050",
];

async function seedSubscriptionIfPlanExists(userId: string): Promise<void> {
  const plan = await SubscriptionPlan.findOne({ isActive: true }).sort({ createdAt: 1 }).lean();
  if (!plan) {
    logger.info("Sin SubscriptionPlan activo en la base — se omite la suscripción de demo (esperado antes de M2.7).");
    return;
  }
  await startSubscription({ userId, planId: plan._id.toString() });
}

/**
 * Idempotencia POR CLIENTE, no un solo guard global al principio: si el
 * script muere a medio lote (como pasó en la sesión que lo escribió, contra
 * un SKU sin stock), un rerun retoma justo donde se quedó en vez de no
 * hacer nada porque `demo-cliente-1@…` ya existe. Un cliente que YA existía
 * antes de este run se asume completo (creado + sus pedidos) y se salta
 * entero — nunca se le vuelven a poner pedidos encima.
 */
async function seedCustomersDemo(): Promise<void> {
  let skuCursor = 0;
  const nextSku = () => CATALOG_SKUS[skuCursor++ % CATALOG_SKUS.length]!;

  for (const [index, spec] of CUSTOMERS.entries()) {
    const { user, wasExisting } = await ensureCustomer(spec, index);
    if (wasExisting) {
      logger.info({ email: user.email }, "Cliente de demo ya existía — se omite (idempotente)");
      continue;
    }

    const destination = DESTINATION_ADDRESSES[index % DESTINATION_ADDRESSES.length]!;

    for (let i = 0; i < spec.paidOrders; i += 1) {
      const order = await placeOrder(user._id.toString(), nextSku(), destination);
      await markOrderPaid({ orderId: order._id.toString() });
    }
    if (spec.withPendingOrder) {
      await placeOrder(user._id.toString(), nextSku(), destination);
    }
    if (index === 0) {
      await seedSubscriptionIfPlanExists(user._id.toString());
    }

    logger.info({ email: user.email, paidOrders: spec.paidOrders }, "Cliente de demo sembrado");
  }
}

async function main(): Promise<void> {
  await connectDatabase();
  try {
    await seedCustomersDemo();
  } finally {
    await disconnectDatabase();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    logger.error({ err: error }, "seed:customers falló");
    process.exitCode = 1;
  });
}

export { seedCustomersDemo };
