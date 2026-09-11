import { Types } from "mongoose";
import { OrderAction, OrderStatus, PaymentMethod } from "@esencia-glow/shared";
import { Order, type OrderDocument } from "../models/order.model.js";
import { recordAudit } from "./audit.service.js";
import { closePendingOrder } from "./order-closing.service.js";
import { settleCapturedPayment } from "./payment-settlement.service.js";
import { recordCardPaymentFailure } from "./card-payment-attempts.service.js";
import type { PaymentProvider, PaymentWebhookEvent } from "./payment-provider.js";

/**
 * Handlers de los tres eventos de pago que importan hasta 1.6.3 (§D del
 * plan de 1.6.2). Cada uno recibe el evento ya traducido (nunca
 * vocabulario crudo de Stripe) y decide el efecto sobre la orden — el
 * orquestador (`payment-webhook.service.ts`) solo despacha y traduce el
 * resultado a `PaymentEvent.status`.
 */

type HandlerOutcome =
  | { status: "processed"; orderId?: string }
  | { status: "ignored" }
  | { status: "rejected"; reason: string; orderId?: string };

/** Sella `adminAlertedAt` (una sola vez) y audita — misma forma que
 * `payment-settlement.service.ts`/`order-closing.service.ts` para
 * anomalías, sin transicionar la orden. */
async function flagIntentMismatch(orderId: string): Promise<void> {
  await Order.findOneAndUpdate(
    { _id: orderId, adminAlertedAt: { $exists: false } },
    { $set: { adminAlertedAt: new Date() } },
  );
  await recordAudit({
    action: OrderAction.ORDER_PAYMENT_ANOMALY,
    targetId: orderId,
    metadata: { reason: "intent_mismatch" },
  });
}

/**
 * Localiza la orden de un evento: primero por `payment.intentId` (índice
 * único, la búsqueda normal del webhook). Como respaldo, por
 * `metadata.orderId` — SOLO para localizar, nunca para autorizar (ver
 * ECOMMERCE_ARCHITECTURE_GUIDELINES.md §"El adapter habla nuestro
 * vocabulario"): sirve cuando Stripe ya creó el PI pero la orden todavía
 * no alcanzó a guardar su `intentId` (fallo entre `authorize()` y
 * `persistPaymentIntent`). Si la orden del hint YA tiene un intent
 * DISTINTO, es una anomalía real — nunca se adopta a ciegas.
 */
async function locateOrderForEvent(intentId: string, orderIdHint: string | undefined): Promise<OrderDocument | null> {
  const byIntent = await Order.findOne({ "payment.intentId": intentId });
  if (byIntent) return byIntent;

  if (!orderIdHint || !Types.ObjectId.isValid(orderIdHint)) return null;
  const hinted = await Order.findById(orderIdHint);
  if (!hinted) return null;

  if (hinted.payment.intentId) {
    if (hinted.payment.intentId !== intentId) {
      await flagIntentMismatch(hinted._id.toString());
      return null;
    }
    return hinted;
  }

  const adopted = await Order.findOneAndUpdate(
    { _id: hinted._id, "payment.intentId": { $exists: false } },
    { $set: { "payment.intentId": intentId } },
    { new: true },
  );
  // Si el claim pierde (otra ruta ya le asignó un intent entre medias —
  // p. ej. `ensurePaymentIntent` corriendo en paralelo), releer por
  // intentId es la fuente de verdad.
  return adopted ?? (await Order.findOne({ "payment.intentId": intentId }));
}

type CapturedEvent = Extract<PaymentWebhookEvent, { kind: "payment.captured" }>;
type FailedEvent = Extract<PaymentWebhookEvent, { kind: "payment.failed" }>;
type CanceledEvent = Extract<PaymentWebhookEvent, { kind: "payment.canceled" }>;

/**
 * `payment_intent.succeeded` -> `settleCapturedPayment`. Vuelve a consultar
 * Stripe (`getAuthorization`) en vez de confiar en el payload del evento:
 * es la única forma de leer la tarjeta (`latest_charge` expandido) y
 * cumple el contrato que ya documenta `payment-settlement.service.ts`
 * ("ambos consultan a Stripe" — el otro caller es el reconciliador).
 */
async function handleCaptured(event: CapturedEvent, provider: PaymentProvider): Promise<HandlerOutcome> {
  const order = await locateOrderForEvent(event.intentId, event.orderIdHint);
  if (!order) return { status: "rejected", reason: "order_not_found" };

  const authorization = await provider.getAuthorization(event.intentId);
  if (authorization.status !== "captured") {
    // Stripe todavía no confirma lo que el evento decía — transitorio, no
    // un rechazo de negocio: se propaga para que el orquestador marque
    // `failed` + 500 y Stripe reintente la entrega.
    throw new Error(`getAuthorization devolvió "${authorization.status}" para un evento payment_intent.succeeded`);
  }

  const settlement = await settleCapturedPayment(order._id.toString(), authorization);
  if (settlement.outcome === "amount_mismatch" || settlement.outcome === "late_payment") {
    // La anomalía ya quedó sellada por `settleCapturedPayment` — aquí solo
    // se traduce a rechazo de negocio (reintentar no lo arregla).
    return { status: "rejected", reason: settlement.outcome, orderId: order._id.toString() };
  }
  return { status: "processed", orderId: order._id.toString() };
}

/**
 * `payment_intent.payment_failed` -> tarjeta cuenta hacia el tope anti
 * card-testing; OXXO cierra directo (una ficha vencida sin pago no tiene
 * "otro intento" — decisión 6 del plan de 1.6.2).
 */
async function handleFailed(event: FailedEvent, provider: PaymentProvider): Promise<HandlerOutcome> {
  const order = await locateOrderForEvent(event.intentId, event.orderIdHint);
  if (!order) return { status: "rejected", reason: "order_not_found" };

  if (order.status !== OrderStatus.PENDING) {
    // Fuera de orden (Stripe no garantiza el orden de entrega): la orden
    // ya se resolvió por otro camino — no hay nada que hacer.
    return { status: "processed", orderId: order._id.toString() };
  }

  if (order.payment.method === PaymentMethod.CARD) {
    await recordCardPaymentFailure({
      orderId: order._id.toString(),
      eventId: event.eventId,
      ...(event.lastError ? { lastError: event.lastError } : {}),
      provider,
    });
  } else {
    await closePendingOrder(order._id.toString(), "system", {
      provider,
      reason: "La ficha OXXO venció sin pago.",
    });
  }
  return { status: "processed", orderId: order._id.toString() };
}

/** `payment_intent.canceled` -> cierra si sigue `pending`; cualquier otro
 * estado es un no-op (la orden ya se resolvió). */
async function handleCanceled(event: CanceledEvent, provider: PaymentProvider): Promise<HandlerOutcome> {
  const order = await locateOrderForEvent(event.intentId, event.orderIdHint);
  if (!order) return { status: "rejected", reason: "order_not_found" };

  if (order.status !== OrderStatus.PENDING) {
    return { status: "processed", orderId: order._id.toString() };
  }

  await closePendingOrder(order._id.toString(), "system", {
    provider,
    reason: "El pago se canceló en el procesador de pagos.",
  });
  return { status: "processed", orderId: order._id.toString() };
}

export { handleCaptured, handleFailed, handleCanceled, locateOrderForEvent };
export type { HandlerOutcome };
