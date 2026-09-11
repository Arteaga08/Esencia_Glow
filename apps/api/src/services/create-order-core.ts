import { Types, type ClientSession } from "mongoose";
import { CATALOG_CURRENCY, OrderPriority, OrderStatus, PaymentMethod, PaymentState } from "@esencia-glow/shared";
import { Order, type OrderDocument } from "../models/order.model.js";
import type { getSettings } from "./settings.service.js";
import { resolveCartLines, type ResolvedLine } from "./cart-resolution.service.js";
import { computeCartFingerprint } from "./cart-fingerprint.js";
import { resolveUsableRate, type UsableRate } from "./shipping-quote.service.js";
import { reserveStock } from "./stock-reservation.service.js";
import { computeOrderTotals } from "./order-totals.js";
import { generateOrderNumber } from "./order-number.js";
import { computeOrderExpiresAt, computeReservationExpiresAt } from "./payment-deadlines.js";
import {
  IdempotencyConflictSignal,
  PendingOrderExistsSignal,
  OrderNumberConflictSignal,
  isDuplicateKeyError,
  keyPatternHas,
  assertOxxoAmountInRange,
  toPlainShippingAddress,
  toPlainParcel,
  toOrderLine,
} from "./create-order-mappers.js";
import type { CreateOrderInput } from "./create-order-mappers.js";

/**
 * `createOrderCore` — el cuerpo de la transacción de checkout, separado de
 * `createOrder` (el retry loop + manejo de conflictos/replay) por el tope
 * de 250 líneas por archivo. Ver create-order.service.ts para el punto de
 * entrada público y create-order-mappers.ts para los helpers puros.
 */
async function createOrderCore(
  input: CreateOrderInput & { requestHash: string },
  orderId: Types.ObjectId,
  settings: Awaited<ReturnType<typeof getSettings>>,
  session: ClientSession,
): Promise<OrderDocument> {
  const cartFingerprint = computeCartFingerprint(input.lines);

  const { quote, rate }: UsableRate = await resolveUsableRate(
    { quoteId: input.quoteId, rateId: input.rateId, userId: input.userId, cartFingerprint },
    session,
  );

  const resolvedLines = await resolveCartLines(input.lines, session);

  // Totales ANTES de reservar: si el monto no califica para OXXO, la
  // operación se rechaza sin haber tocado inventario (0 órdenes, 0
  // reservado) — validar después de reservar dejaría stock apartado por un
  // pedido que nunca se va a crear.
  const totals = computeOrderTotals({
    lineTotalsCents: resolvedLines.map((line) => line.lineTotalCents),
    chosenRateAmountCents: rate.amountCents,
    cheapestRateAmountCents: quote.cheapestAmountCents,
    taxRateBps: settings.commerce.taxRateBps,
    freeShippingThresholdCents: settings.commerce.freeShippingThresholdCents,
  });

  if (input.paymentMethod === PaymentMethod.OXXO) {
    assertOxxoAmountInRange(totals.totalCents);
  }

  const now = new Date();
  const orderExpiresAt = computeOrderExpiresAt({
    method: input.paymentMethod,
    now,
    reservationTtlMinutes: settings.inventory.reservationTtlMinutes,
    oxxoVoucherDays: settings.payments.oxxoVoucherDays,
    oxxoConfirmationGraceHours: settings.payments.oxxoConfirmationGraceHours,
  });
  const reservationExpiresAt = computeReservationExpiresAt(orderExpiresAt);
  const reservationTtlMinutes = Math.ceil((reservationExpiresAt.getTime() - now.getTime()) / 60_000);

  const reservationLines = resolvedLines.flatMap((line) => line.reservationLines);
  const sourceBundles = resolvedLines
    .map((line) => line.sourceBundle)
    .filter((sourceBundle): sourceBundle is NonNullable<ResolvedLine["sourceBundle"]> => !!sourceBundle);

  const reservation = await reserveStock(
    {
      cartRef: orderId.toString(),
      userId: input.userId,
      lines: reservationLines,
      ttlMinutes: reservationTtlMinutes,
      sourceBundles: sourceBundles.length > 0 ? sourceBundles : undefined,
    },
    session,
  );
  // El TTL de arriba solo se usa para que reserveStock calcule un
  // `expiresAt` cercano; aquí se fija el valor EXACTO derivado del mismo
  // `now`, para que `order.expiresAt` y `reservation.expiresAt` guarden la
  // relación exacta que exige el cierre "Stripe-first" (§D del plan de 1.6).
  reservation.expiresAt = reservationExpiresAt;
  await reservation.save({ session });

  const userObjectId = new Types.ObjectId(input.userId);
  const orderNumber = generateOrderNumber();

  try {
    const [order] = await Order.create(
      [
        {
          _id: orderId,
          orderNumber,
          userId: userObjectId,
          status: OrderStatus.PENDING,
          lines: resolvedLines.map(toOrderLine),
          subtotalCents: totals.subtotalCents,
          discountCents: totals.discountCents,
          taxCents: totals.taxCents,
          taxRateBps: totals.taxRateBps,
          shippingCents: totals.shippingCents,
          totalCents: totals.totalCents,
          currency: CATALOG_CURRENCY,
          payment: {
            provider: "stripe",
            method: input.paymentMethod,
            state: PaymentState.PENDING,
            captureMethod: "automatic",
            failedAttempts: 0,
          },
          shippingAddress: toPlainShippingAddress(quote.destination),
          shippingSelection: {
            rateId: rate.rateId,
            carrier: rate.carrier,
            service: rate.service,
            amountCents: rate.amountCents,
            estimatedDays: rate.estimatedDays,
          },
          parcel: toPlainParcel(quote.parcel),
          termsAcceptedAt: now,
          idempotencyKey: input.idempotencyKey,
          requestHash: input.requestHash,
          reservationId: reservation._id,
          expiresAt: orderExpiresAt,
          statusHistory: [{ status: OrderStatus.PENDING, at: now, actorType: "user", actorId: userObjectId }],
          priority: OrderPriority.NORMAL,
          internalNotes: [],
          inventoryIncident: false,
        },
      ],
      { session },
    );
    return order as OrderDocument;
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error;
    if (keyPatternHas(error, "orderNumber")) throw new OrderNumberConflictSignal();
    if (keyPatternHas(error, "idempotencyKey")) throw new IdempotencyConflictSignal();
    // { userId: 1 } parcial por status "pending" — verificado explícito
    // (no un `else` ciego): si algún día se agrega otro índice único que
    // `Order.create` pueda violar, esto debe reventar como error crudo en
    // vez de mentir con un 409 "ya tienes un pedido pendiente".
    if (keyPatternHas(error, "userId")) throw new PendingOrderExistsSignal();
    throw error;
  }
}


export { createOrderCore };
