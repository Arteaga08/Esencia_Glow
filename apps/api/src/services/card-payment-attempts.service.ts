import { MAX_CARD_FAILED_ATTEMPTS, OrderAction, OrderStatus, PaymentMethod, PaymentState } from "@esencia-glow/shared";
import { Order } from "../models/order.model.js";
import { recordAudit } from "./audit.service.js";
import { closePendingOrder } from "./order-closing.service.js";
import type { PaymentProvider } from "./payment-provider.js";

/**
 * Anti card-testing (decisión 10 del plan de 1.6): cada rechazo de tarjeta
 * (`payment_intent.payment_failed`) suma 1 a `payment.failedAttempts`; al
 * llegar a `MAX_CARD_FAILED_ATTEMPTS` se cierra el pedido — cancela el PI
 * en Stripe y libera el stock, vía el mismo `closePendingOrder` que usan
 * el cliente, el admin y el barrendero.
 *
 * Idempotente por SÍ MISMO, no solo por el dedupe de `PaymentEvent`
 * (decisión 5 del plan de 1.6.2): `payment.failedEventIds` en el filtro
 * con `$ne` asegura que reprocesar el mismo evento (tras un error a
 * medias, o si el dedupe algún día fallara) nunca cuenta doble.
 */
const FAILED_EVENT_IDS_KEEP = 10;

interface RecordCardPaymentFailureInput {
  orderId: string;
  eventId: string;
  lastError?: string;
  provider: PaymentProvider;
}

async function recordCardPaymentFailure(input: RecordCardPaymentFailureInput): Promise<void> {
  const updated = await Order.findOneAndUpdate(
    {
      _id: input.orderId,
      status: OrderStatus.PENDING,
      "payment.method": PaymentMethod.CARD,
      "payment.failedEventIds": { $ne: input.eventId },
    },
    {
      $inc: { "payment.failedAttempts": 1 },
      $set: {
        "payment.state": PaymentState.FAILED,
        ...(input.lastError ? { "payment.lastError": input.lastError.slice(0, 500) } : {}),
      },
      $push: { "payment.failedEventIds": { $each: [input.eventId], $slice: -FAILED_EVENT_IDS_KEEP } },
    },
    { new: true },
  );

  if (updated) {
    await recordAudit({
      action: OrderAction.ORDER_PAYMENT_FAILED,
      targetId: input.orderId,
      metadata: { attempts: updated.payment.failedAttempts },
    });
  }

  // Releída sin el claim (`updated` es `null`) cuando este evento YA se
  // contó antes — sigue siendo necesario decidir si el tope ya se alcanzó
  // (p. ej. la reentrega de un evento después de que otro ya cerró el
  // pedido no debe intentar cerrarlo de nuevo, y `current.status` ya no
  // será `pending` en ese caso).
  const current = updated ?? (await Order.findById(input.orderId));
  if (current && current.status === OrderStatus.PENDING && current.payment.failedAttempts >= MAX_CARD_FAILED_ATTEMPTS) {
    await closePendingOrder(input.orderId, "system", {
      reason: "Demasiados intentos de pago rechazados.",
      provider: input.provider,
    });
  }
}

export { recordCardPaymentFailure };
