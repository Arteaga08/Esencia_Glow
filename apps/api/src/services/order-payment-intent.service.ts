import { OrderStatus, PaymentMethod, type CheckoutPaymentInfo } from "@esencia-glow/shared";
import { Order, type OrderAttrs } from "../models/order.model.js";
import { StockReservation } from "../models/stock-reservation.model.js";
import { User } from "../models/user.model.js";
import { AppError } from "../utils/app-error.js";
import { withTransaction } from "../utils/with-transaction.js";
import { getSettings } from "./settings.service.js";
import { computeOrderExpiresAt, computeReservationExpiresAt } from "./payment-deadlines.js";
import { resolvePaymentProvider, type PaymentAuthorization, type PaymentProvider } from "./payment-provider.js";

/**
 * `ensurePaymentIntent` — gancho de checkout de 1.6 (§B del plan): crea el
 * PaymentIntent la primera vez que se llama para un pedido (idempotente
 * hacia Stripe con `order:<id>:intent`) y, en llamadas posteriores (replay
 * HTTP, "reanudar pago"), consulta el existente sin crear otro. Se usa
 * tanto desde el checkout (justo después de `createOrder`) como desde
 * `POST /orders/:id/payment` (reanudar).
 */

interface EnsurePaymentIntentOptions {
  /** Inyectable para tests — en producción se resuelve por configuración
   * (`resolvePaymentProvider`). `undefined` explícito (no solo ausente)
   * fuerza el camino de "sin proveedor configurado", útil para probar el
   * 503 sin tocar variables de entorno globales. */
  provider?: PaymentProvider;
}

interface EnsurePaymentIntentResult {
  order: OrderAttrs & { _id: unknown };
  payment: CheckoutPaymentInfo;
}

function buildShippingParam(order: OrderAttrs) {
  const address = order.shippingAddress;
  return {
    name: address.fullName,
    address: {
      line1: `${address.street} ${address.exteriorNumber}`,
      ...(address.interiorNumber ? { line2: `Int. ${address.interiorNumber}` } : {}),
      city: address.city,
      state: address.state,
      postal_code: address.postalCode,
      country: "MX",
    },
  };
}

function buildCheckoutPaymentInfo(method: PaymentMethod, authorization: PaymentAuthorization): CheckoutPaymentInfo {
  if (method === PaymentMethod.OXXO) {
    return {
      method,
      ...(authorization.voucher
        ? {
            oxxoVoucher: {
              hostedVoucherUrl: authorization.voucher.hostedVoucherUrl,
              expiresAt: authorization.voucher.expiresAt.toISOString(),
            },
          }
        : {}),
    };
  }
  return { method, ...(authorization.clientSecret ? { clientSecret: authorization.clientSecret } : {}) };
}

/**
 * Aplica el resultado de `authorize()` a la orden: guarda `intentId` y, solo
 * para OXXO, `voucherExpiresAt` + el `expiresAt` recalculado de la orden y
 * su reserva (ahora que Stripe ya confirmó cuándo vence la ficha real, no
 * la cota superior conservadora usada al crear el pedido). El claim
 * (`"payment.intentId": {$exists:false}` en el filtro) es lo que hace que
 * dos llamadas concurrentes —que ya recibieron el MISMO PI de Stripe por la
 * idempotency key— nunca pisen el resultado la una de la otra.
 */
async function persistPaymentIntent(
  order: OrderAttrs & { _id: unknown; reservationId: unknown },
  authorization: PaymentAuthorization,
): Promise<void> {
  const now = new Date();
  const setFields: Record<string, unknown> = { "payment.intentId": authorization.intentId };
  let newOrderExpiresAt: Date | undefined;

  if (order.payment.method === PaymentMethod.OXXO && authorization.voucher) {
    const settings = await getSettings();
    setFields["payment.voucherExpiresAt"] = authorization.voucher.expiresAt;
    newOrderExpiresAt = computeOrderExpiresAt({
      method: PaymentMethod.OXXO,
      now,
      reservationTtlMinutes: settings.inventory.reservationTtlMinutes,
      oxxoVoucherDays: settings.payments.oxxoVoucherDays,
      oxxoConfirmationGraceHours: settings.payments.oxxoConfirmationGraceHours,
      voucherExpiresAt: authorization.voucher.expiresAt,
    });
    setFields.expiresAt = newOrderExpiresAt;
  }

  await withTransaction(async (session) => {
    const claimed = await Order.findOneAndUpdate(
      { _id: order._id, status: OrderStatus.PENDING, "payment.intentId": { $exists: false } },
      { $set: setFields },
      { new: true, session },
    );
    // Si el claim pierde (otra llamada concurrente ya guardó el mismo
    // intentId, o la orden ya no es `pending`), no hay nada más que hacer
    // aquí: `ensurePaymentIntent` relee la orden después de esta función.
    if (claimed && newOrderExpiresAt) {
      const reservationExpiresAt = computeReservationExpiresAt(newOrderExpiresAt);
      await StockReservation.updateOne(
        { _id: order.reservationId },
        { $set: { expiresAt: reservationExpiresAt } },
        { session },
      );
    }
  });
}

async function ensurePaymentIntent(
  orderId: string,
  userId: string,
  options: EnsurePaymentIntentOptions = {},
): Promise<EnsurePaymentIntentResult> {
  const provider = "provider" in options ? options.provider : resolvePaymentProvider();
  if (!provider) {
    throw new AppError("Los pagos no están configurados.", 503);
  }

  // Anti-IDOR: propiedad dentro del filtro, 404 (no 403) si no es suya.
  const order = await Order.findOne({ _id: orderId, userId });
  if (!order) throw new AppError("Pedido no encontrado.", 404);
  if (order.status !== OrderStatus.PENDING) {
    throw new AppError(`No se puede pagar un pedido en estado "${order.status}".`, 409);
  }

  if (order.payment.intentId) {
    const authorization = await provider.getAuthorization(order.payment.intentId);
    return { order, payment: buildCheckoutPaymentInfo(order.payment.method, authorization) };
  }

  const customer = await User.findById(userId).select("email").lean();
  if (!customer) throw new AppError("Pedido no encontrado.", 404);

  const settings = await getSettings();
  const authorization = await provider.authorize({
    orderId: order._id.toString(),
    orderNumber: order.orderNumber,
    amountCents: order.totalCents,
    currency: order.currency,
    method: order.payment.method,
    customer: { email: customer.email, name: order.shippingAddress.fullName },
    shipping: buildShippingParam(order),
    ...(order.payment.method === PaymentMethod.OXXO ? { oxxoVoucherDays: settings.payments.oxxoVoucherDays } : {}),
    idempotencyKey: `order:${order._id.toString()}:intent`,
  });

  await persistPaymentIntent(order, authorization);

  const reloaded = await Order.findById(order._id);
  if (!reloaded) throw new AppError("Pedido no encontrado.", 404);

  return { order: reloaded, payment: buildCheckoutPaymentInfo(reloaded.payment.method, authorization) };
}

export { ensurePaymentIntent };
export type { EnsurePaymentIntentOptions, EnsurePaymentIntentResult };
