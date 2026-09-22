import { PaymentMethod } from "@esencia-glow/shared";
import { Settings } from "../../src/models/settings.model.js";
import { User } from "../../src/models/user.model.js";
import { createOrder } from "../../src/services/order.service.js";
import { ensurePaymentIntent } from "../../src/services/order-payment-intent.service.js";
import { markOrderPaid } from "../../src/services/order-payment.service.js";
import { buildFakePaymentProvider } from "./fake-payment-provider.js";
import { buildCreateOrderInput, randomUserId, seedVariantWithStock } from "./checkout-fixtures.js";

/** UN proveedor de pagos falso por archivo de tests: su contador de intents
 * (`pi_fake_N`) debe seguir avanzando entre órdenes, o dos órdenes sembradas
 * en el mismo test chocarían con el índice único de `payment.intentId`. */
const paymentProvider = buildFakePaymentProvider();

interface SeededOrder {
  orderId: string;
  userId: string;
  adminId: string;
}

async function createUser(role: "customer" | "admin"): Promise<string> {
  const id = randomUserId();
  await User.create({
    _id: id,
    email: `${id}@example.com`,
    password: "P4ssword!!",
    firstName: role === "admin" ? "Admin" : "Ana",
    lastName: role === "admin" ? "Glow" : "Pérez",
    ...(role === "admin" ? { role: "admin" } : {}),
    emailVerified: true,
  });
  return id;
}

/** Orden `pending` con pago iniciado, lista para `markOrderPaid`. */
async function seedPendingOrder(): Promise<SeededOrder> {
  const userId = await createUser("customer");
  const adminId = await createUser("admin");
  const { variantId } = await seedVariantWithStock({ price: 50000, onHand: 10 });
  const input = await buildCreateOrderInput(userId, [{ itemType: "product" as const, itemId: variantId.toString(), quantity: 1 }], {
    paymentMethod: PaymentMethod.CARD,
  });
  const { order: created } = await createOrder(input);
  await ensurePaymentIntent(created._id.toString(), userId, { provider: paymentProvider });
  return { orderId: created._id.toString(), userId, adminId };
}

/** Orden ya `paid` (pasó por `markOrderPaid`, como lo haría el webhook). */
async function seedPaidOrder(): Promise<SeededOrder> {
  const seeded = await seedPendingOrder();
  await markOrderPaid({ orderId: seeded.orderId });
  return seeded;
}

const SHIPPING_ORIGIN = {
  fullName: "Esencia Glow",
  phone: "3312345678",
  street: "Av. Vallarta",
  exteriorNumber: "1234",
  neighborhood: "Americana",
  city: "Guadalajara",
  state: "Jalisco" as const,
  postalCode: "44160",
};

/** Deja capturada la dirección de origen en Settings (sin ella no se puede
 * comprar una guía). */
async function seedShippingOrigin(): Promise<void> {
  await Settings.findOneAndUpdate({ _id: "global" }, { $set: { "shipping.origin": SHIPPING_ORIGIN } }, { upsert: true });
}

export { seedPendingOrder, seedPaidOrder, seedShippingOrigin, SHIPPING_ORIGIN };
export type { SeededOrder };
