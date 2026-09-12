import type { ClientSession } from "mongoose";
import { InventoryAction, MAX_STATUS_HISTORY, OrderAction, OrderStatus, PaymentState } from "@esencia-glow/shared";
import { Order, type OrderDocument } from "../models/order.model.js";
import { AppError } from "../utils/app-error.js";
import { withTransaction } from "../utils/with-transaction.js";
import { assertTransition, getTransitionInventoryEffect, REFUNDABLE_ORDER_STATUSES } from "./order-state.js";
import { restockCommittedReservation, type RestockResult } from "./reservation-restock.service.js";
import { recordAudit } from "./audit.service.js";
import { sendRefundEmail } from "./order-email.service.js";

/**
 * `applyProviderRefund` — único camino que aplica lo que Stripe YA
 * confirmó (`charge.refunded`) a la orden (§4 del plan de 1.6.3): la
 * decisión de negocio de PEDIR el reembolso vive en `order-refund.service.ts`
 * (el endpoint admin); esta función solo traduce el hecho consumado, igual
 * que `payment-settlement.service.ts` traduce `payment_intent.succeeded`.
 *
 * Estados posibles de una orden `paid/processing/shipped/delivered` cuando
 * llega un reembolso:
 *  - `amount_anomaly`: moneda distinta o monto mayor al total — nunca
 *    transiciona, se sella `adminAlertedAt` para revisión humana.
 *  - `partial`: el monto acumulado no cubre el total — solo se guarda
 *    (con `$max`, nunca decrece), sin tocar `status`.
 *  - `off_cycle`: el monto SÍ cubre el total pero la orden está
 *    `pending`/`cancelled` (un reembolso hecho desde el Dashboard sobre un
 *    pago que nunca liquidamos por acá) — se guarda el monto y
 *    `payment.state: refunded`, sin transición de `status` (no hay un
 *    "desde" válido en la máquina de estados).
 *  - `refunded`: el monto cubre el total y la orden estaba en un estado
 *    refundable — transiciona. `transitioned` distingue la llamada que
 *    hizo la transición de un duplicado que la encuentra ya hecha.
 */
type ApplyRefundOutcome = "refunded" | "partial" | "off_cycle" | "amount_anomaly";

interface ApplyProviderRefundInput {
  amountRefundedCents: number;
  /** Tal cual la reporta Stripe (minúsculas) — se compara contra
   * `order.currency` (mayúsculas) normalizando aquí, igual que
   * `payment-settlement.service.ts`. */
  currency: string;
}

interface ApplyProviderRefundResult {
  outcome: ApplyRefundOutcome;
  order: OrderDocument | null;
  /** true SOLO si ESTA llamada transicionó la orden a `refunded` — el
   * caller usa esto para decidir si audita/envía el correo de reembolso
   * (decisión 2: solo con el reembolso TOTAL, nunca en un duplicado). */
  transitioned: boolean;
  /** Presente solo cuando hubo restock (transición desde `paid`/`processing`). */
  restock?: RestockResult;
}

async function applyProviderRefundCore(
  orderId: string,
  input: ApplyProviderRefundInput,
  session: ClientSession,
): Promise<ApplyProviderRefundResult> {
  const order = await Order.findById(orderId).session(session);
  if (!order) throw new AppError("Pedido no encontrado.", 404);

  if (order.currency !== input.currency.toUpperCase() || input.amountRefundedCents > order.totalCents) {
    const flagged = await Order.findOneAndUpdate(
      { _id: orderId, adminAlertedAt: { $exists: false } },
      { $set: { adminAlertedAt: new Date() } },
      { new: true, session },
    );
    return { outcome: "amount_anomaly", order: flagged ?? order, transitioned: false };
  }

  const now = new Date();
  const isTotal = input.amountRefundedCents >= order.totalCents;
  const previousAmount = order.payment.refundedAmountCents ?? 0;
  const amountIncreased = input.amountRefundedCents > previousAmount;

  if (order.status === OrderStatus.REFUNDED) {
    const updated = amountIncreased
      ? await Order.findOneAndUpdate(
          { _id: orderId },
          { $max: { "payment.refundedAmountCents": input.amountRefundedCents }, $set: { "payment.refundedAt": now } },
          { new: true, session },
        )
      : order;
    return { outcome: "refunded", order: updated, transitioned: false };
  }

  if (!isTotal) {
    const updated = amountIncreased
      ? await Order.findOneAndUpdate(
          { _id: orderId },
          { $max: { "payment.refundedAmountCents": input.amountRefundedCents } },
          { new: true, session },
        )
      : order;
    return { outcome: "partial", order: updated, transitioned: false };
  }

  if (!REFUNDABLE_ORDER_STATUSES.includes(order.status)) {
    // `pending`/`cancelled`: un reembolso total sobre un pedido que este
    // sistema no liquidó como pagado (hecho a mano desde el Dashboard de
    // Stripe sobre una anomalía previa). No hay transición válida desde
    // aquí en order-state.ts — se guarda el hecho y se marca para revisión.
    const updated = await Order.findOneAndUpdate(
      { _id: orderId },
      {
        $max: { "payment.refundedAmountCents": input.amountRefundedCents },
        $set: { "payment.refundedAt": now, "payment.state": PaymentState.REFUNDED },
      },
      { new: true, session },
    );
    return { outcome: "off_cycle", order: updated, transitioned: false };
  }

  assertTransition(order.status, OrderStatus.REFUNDED, "system");
  const claimed = await Order.findOneAndUpdate(
    { _id: orderId, status: order.status },
    {
      $set: { status: OrderStatus.REFUNDED, "payment.state": PaymentState.REFUNDED, "payment.refundedAt": now },
      $max: { "payment.refundedAmountCents": input.amountRefundedCents },
      $push: {
        statusHistory: {
          $each: [{ status: OrderStatus.REFUNDED, at: now, actorType: "system" }],
          $slice: -MAX_STATUS_HISTORY,
        },
      },
    },
    { new: true, session },
  );
  if (!claimed) {
    // Nunca debería pasar dentro de la MISMA transacción (nadie más escribe
    // con esta sesión) — defensivo, como el resto del módulo de órdenes.
    const reread = await Order.findById(orderId).session(session);
    return { outcome: "refunded", order: reread, transitioned: false };
  }

  const effect = getTransitionInventoryEffect(order.status, OrderStatus.REFUNDED);
  let restock: RestockResult | undefined;
  if (effect === "restock") {
    restock = await restockCommittedReservation(claimed.reservationId.toString(), session);
  }

  return { outcome: "refunded", order: claimed, transitioned: true, ...(restock ? { restock } : {}) };
}

async function applyProviderRefund(
  orderId: string,
  input: ApplyProviderRefundInput,
): Promise<ApplyProviderRefundResult> {
  const result = await withTransaction((session) => applyProviderRefundCore(orderId, input, session));

  if (result.outcome === "amount_anomaly") {
    await recordAudit({
      action: OrderAction.ORDER_PAYMENT_ANOMALY,
      targetId: orderId,
      metadata: { reason: "refund_amount_mismatch", amountCents: input.amountRefundedCents },
    });
    return result;
  }

  if (result.outcome === "off_cycle") {
    await recordAudit({
      action: OrderAction.ORDER_PAYMENT_ANOMALY,
      targetId: orderId,
      metadata: { reason: "refund_off_cycle", amountCents: input.amountRefundedCents },
    });
    return result;
  }

  if (result.transitioned) {
    await recordAudit({
      action: OrderAction.ORDER_REFUNDED,
      targetId: orderId,
      metadata: { amountCents: input.amountRefundedCents },
    });
    if (result.restock) {
      const missing = result.restock.missingVariants;
      await recordAudit({
        action: InventoryAction.RESERVATION_RESTOCKED,
        targetId: result.order!.reservationId,
        metadata: {
          orderId,
          missingVariantCount: missing.length,
          ...(missing.length > 0 ? { missingVariantSkus: missing.map((v) => v.sku).join(",") } : {}),
        },
      });
    }
    // Correo de reembolso: SOLO con el reembolso TOTAL (decisión 2 del plan
    // de 1.6.3) — un parcial hecho desde el Dashboard de Stripe no llega
    // aquí (`transitioned` es `false` para un parcial, ver el core).
    void sendRefundEmail(orderId, input.amountRefundedCents);
  }

  return result;
}

/**
 * `charge.refund.updated` con `status: failed|canceled` (webhook, §7 del
 * plan): el mutex de `payment.refundRequestedAt` se desmarca para que un
 * reintento sea posible, pero la alerta se sella una sola vez — mismo
 * criterio que `adminAlertedAt` en el resto del módulo. Sobre una orden ya
 * `refunded` (D7: terminal, no se revierte sola) solo se alerta.
 *
 * **Fencing por `requestedAtMs`** (hallazgo de code review de 1.6.3): sin
 * esto, un `refund.failed` TARDÍO de un intento viejo (p. ej. el lease
 * venció, un admin reclamó un segundo intento, y SOLO ENTONCES Stripe
 * entrega el fallo del primero) desmarcaría el mutex del intento nuevo
 * — que sigue en vuelo — y un tercer admin podría reclamarlo, dos
 * llamadas a Stripe compitiendo por el mismo pedido. `requestedAtMs`
 * viaja en `Refund.metadata` desde `order-refund.service.ts`: si está
 * presente, el `$unset` solo aplica cuando coincide EXACTAMENTE con el
 * `refundRequestedAt` que hay ahora mismo en la orden. Ausente (un
 * reembolso hecho a mano en el Dashboard, sin esa metadata) cae al
 * comportamiento anterior — desmarcar siempre — que sigue siendo correcto
 * ahí porque nuestro mutex nunca se activó para ese reembolso.
 */
async function recordRefundFailure(
  orderId: string,
  input: { refundId: string; reason?: string; requestedAtMs?: number },
): Promise<void> {
  const order = await Order.findById(orderId);
  if (!order) return;

  if (order.status !== OrderStatus.REFUNDED) {
    const unsetFilter: Record<string, unknown> = { _id: orderId };
    if (input.requestedAtMs !== undefined) {
      unsetFilter["payment.refundRequestedAt"] = new Date(input.requestedAtMs);
    }
    await Order.updateOne(unsetFilter, { $unset: { "payment.refundRequestedAt": "" } });
  }
  await Order.updateOne(
    { _id: orderId, adminAlertedAt: { $exists: false } },
    { $set: { adminAlertedAt: new Date() } },
  );
  await recordAudit({
    action: OrderAction.ORDER_REFUND_FAILED,
    targetId: orderId,
    metadata: { refundId: input.refundId, ...(input.reason ? { reason: input.reason } : {}) },
  });
}

export { applyProviderRefund, recordRefundFailure };
export type { ApplyRefundOutcome, ApplyProviderRefundInput, ApplyProviderRefundResult };
